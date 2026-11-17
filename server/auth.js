// Verifies who is calling the API, using the JWT that Neon Auth gives a signed-in user.
//
// How it works: Neon Auth signs each user's token with a private key and publishes the
// matching public keys (a "JWKS"). We download those public keys and check the signature.
// If it checks out, the token really came from Neon Auth and `sub` is the user's id.
// No passwords or secrets are needed on our side for this.
import { createLocalJWKSet, jwtVerify } from 'jose';

const authBase = () => (process.env.NEON_AUTH_URL || process.env.NEON_AUTH_BASE_URL || process.env.VITE_NEON_AUTH_URL || '').trim().replace(/\/+$/, '');

let keys = null, keysAt = 0;

async function loadKeys(force = false) {
  if (keys && !force && Date.now() - keysAt < 60 * 60 * 1000) return keys;
  const base = authBase();
  if (!base) throw new Error('NEON_AUTH_URL is not set');
  // Neon Auth serves its public keys at one of these paths depending on version.
  for (const path of ['/.well-known/jwks.json', '/jwks']) {
    try {
      const res = await fetch(base + path);
      if (!res.ok) continue;
      const body = await res.json();
      if (Array.isArray(body?.keys) && body.keys.length) {
        keys = createLocalJWKSet(body);
        keysAt = Date.now();
        return keys;
      }
    } catch {}
  }
  throw new Error('Could not load Neon Auth public keys');
}

// Returns { id, name, email } for a valid "Authorization: Bearer <jwt>" header, otherwise null.
export async function getUser(req) {
  const match = /^Bearer\s+(.+)$/i.exec(req.headers?.authorization || '');
  if (!match) return null;
  const verify = async (force) => (await jwtVerify(match[1], await loadKeys(force))).payload;
  let payload;
  try {
    payload = await verify(false);
  } catch (err) {
    // Neon Auth may have rotated its keys since we cached them: refresh once and retry.
    if (err?.code !== 'ERR_JWKS_NO_MATCHING_KEY') return null;
    try { payload = await verify(true); } catch { return null; }
  }
  if (!payload?.sub) return null;
  // Only accept tokens issued by our own Neon Auth project.
  if (payload.iss) {
    try { if (new URL(payload.iss).origin !== new URL(authBase()).origin) return null; } catch { return null; }
  }
  return { id: String(payload.sub), name: typeof payload.name === 'string' ? payload.name : '', email: typeof payload.email === 'string' ? payload.email : '' };
}
