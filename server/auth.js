// Verifies who is calling the API, using the JWT that Neon Auth gives a signed-in user.
//
// How it works: Neon Auth signs each user's token with a private key and publishes the
// matching public keys (a "JWKS"). We download those public keys and check the signature.
// If it checks out, the token really came from Neon Auth and `sub` is the user's id.
// No passwords or secrets are needed on our side for this.
import { createLocalJWKSet, jwtVerify } from 'jose';

export const authBase = () => (process.env.NEON_AUTH_URL || process.env.NEON_AUTH_BASE_URL || process.env.VITE_NEON_AUTH_URL || '').trim().replace(/\/+$/, '');

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

// --- Session "jar": Neon Auth's cookies, carried by the app as one opaque bearer token. ---
// Format: "s1." + base64url(JSON {cookieName: value}). Built and read only by this server.

export const packJar = (jar) => (Object.keys(jar).length ? 's1.' + Buffer.from(JSON.stringify(jar)).toString('base64url') : '');

export function unpackJar(token) {
  if (!token || !token.startsWith('s1.')) return {};
  try {
    const jar = JSON.parse(Buffer.from(token.slice(3), 'base64url').toString('utf8'));
    return jar && typeof jar === 'object' && !Array.isArray(jar) ? jar : {};
  } catch { return {}; }
}

// Applies "Set-Cookie" headers from Neon Auth: new values replace old ones, expired ones are removed.
export function mergeSetCookies(jar, setCookies) {
  const next = { ...jar };
  for (const line of setCookies) {
    const [pair, ...attrs] = line.split(';');
    const i = pair.indexOf('=');
    if (i < 1) continue;
    const name = pair.slice(0, i).trim(), value = pair.slice(i + 1).trim();
    const expired = !value || attrs.some((a) => /^\s*max-age\s*=\s*(0|-)/i.test(a) || (/^\s*expires\s*=/i.test(a) && Date.parse(a.split('=').slice(1).join('=')) < Date.now()));
    if (expired) delete next[name]; else next[name] = value;
  }
  return next;
}

export const jarHeader = (jar) => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');

// Asks Neon Auth "who is this?" using the jar's cookies. Cached briefly so each API call isn't a round trip.
const sessionCache = new Map();
async function userFromJar(token) {
  const hit = sessionCache.get(token);
  if (hit && hit.until > Date.now()) return hit.user;
  const jar = unpackJar(token);
  if (!Object.keys(jar).length) return null;
  let user = null;
  try {
    const res = await fetch(`${authBase()}/get-session`, { headers: { Accept: 'application/json', Cookie: jarHeader(jar), Origin: 'https://guanliang9.github.io' } });
    const data = res.ok ? await res.json().catch(() => null) : null;
    if (data?.user?.id) user = { id: String(data.user.id), name: data.user.name || '', email: data.user.email || '' };
  } catch { return null; } // network blip: don't cache
  if (sessionCache.size > 500) sessionCache.clear();
  sessionCache.set(token, { user, until: Date.now() + 60_000 });
  return user;
}

// Returns { id, name, email } for a valid "Authorization: Bearer <token>" header, otherwise null.
// The token is either our session jar (normal case) or a Neon Auth JWT.
export async function getUser(req) {
  const match = /^Bearer\s+(.+)$/i.exec(req.headers?.authorization || '');
  if (!match) return null;
  if (match[1].startsWith('s1.')) return userFromJar(match[1]);
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
