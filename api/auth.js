// /api/auth?op=... — a small proxy between the app and Neon Auth.
//
// Why: the app runs on github.io and Neon Auth on neon.tech. Neon Auth keeps you signed in
// with a cookie, but browsers block cookies from a different site ("third-party cookies").
// So the browser never talks to Neon Auth directly. Instead:
//   browser ──(token in Authorization header)──▶ this function ──(cookies)──▶ Neon Auth
// Server-to-server there's no browser, so cookies just work. We hand the cookies back to the
// app as one opaque token, which it stores and sends with each request.
import { cors } from '../server/cors.js';
import { authBase, packJar, unpackJar, mergeSetCookies, jarHeader } from '../server/auth.js';

// Only these Neon Auth endpoints are reachable through the proxy.
const OPS = {
  'sign-up': { path: 'sign-up/email', method: 'POST' },
  'sign-in': { path: 'sign-in/email', method: 'POST' },
  'sign-out': { path: 'sign-out', method: 'POST' },
  session: { path: 'get-session', method: 'GET' },
};

export default async function handler(req, res) {
  if (cors(req, res)) return;
  res.setHeader('Cache-Control', 'no-store');

  const op = OPS[req.query?.op];
  if (!op || req.method !== op.method) return res.status(404).json({ error: 'Unknown auth action' });
  const base = authBase();
  if (!base) return res.status(500).json({ error: 'Sign-in is not configured (NEON_AUTH_URL missing)' });

  const jar = unpackJar((/^Bearer\s+(.+)$/i.exec(req.headers.authorization || '') || [])[1]);
  const headers = { Accept: 'application/json', Origin: req.headers.origin || 'https://guanliang9.github.io' };
  if (Object.keys(jar).length) headers.Cookie = jarHeader(jar);
  let body;
  if (op.method === 'POST') {
    headers['Content-Type'] = 'application/json';
    const b = req.body || {};
    // Pass through only the fields Neon Auth needs.
    body = JSON.stringify(op.path === 'sign-up/email' ? { name: b.name, email: b.email, password: b.password }
      : op.path === 'sign-in/email' ? { email: b.email, password: b.password } : {});
  }

  let upstream;
  try {
    upstream = await fetch(`${base}/${op.path}`, { method: op.method, headers, body });
  } catch (err) {
    console.error('auth proxy: Neon Auth unreachable', err);
    return res.status(502).json({ error: 'Could not reach the sign-in service' });
  }

  const nextJar = mergeSetCookies(jar, upstream.headers.getSetCookie?.() || []);
  const data = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    return res.status(upstream.status).json({ error: data?.message || data?.error || `Sign-in service error (${upstream.status})` });
  }
  return res.status(200).json({
    user: data?.user || null,
    // Opaque token for the app to keep (it holds Neon Auth's session cookies). Empty after sign-out.
    token: op.path === 'sign-out' ? '' : packJar(nextJar),
  });
}
