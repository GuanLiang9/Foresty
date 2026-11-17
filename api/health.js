// GET /api/health — confirms the API is running and can reach Neon.
//
// Vercel turns every file in api/ into a serverless function at the matching URL.
// The function runs on Vercel's servers, so it can read DATABASE_URL safely;
// the browser only ever sees the JSON this returns.
import { getSql, databaseUrl } from '../server/db.js';
import { cors } from '../server/cors.js';

// Explains a failure without leaking the connection string or password.
function diagnose(url, err) {
  if (!url) return 'DATABASE_URL is not set for this deployment. Add it in Vercel > Settings > Environment Variables (tick Preview and Production), then redeploy.';
  if (!/^postgres(ql)?:\/\//.test(url)) return 'DATABASE_URL does not start with postgresql:// — copy only the connection string from Neon, without "psql" or quotes.';
  const msg = String(err?.message || err);
  if (/password authentication failed/i.test(msg)) return 'Neon rejected the password. Copy the connection string again from Neon (click Connect, show password).';
  if (/does not exist/i.test(msg)) return 'The database or role in the connection string does not exist. Copy it again from Neon.';
  if (/ENOTFOUND|getaddrinfo|fetch failed/i.test(msg)) return 'Could not find that Neon host. Check the connection string is complete.';
  return 'Query failed; see the function logs in Vercel for details.';
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const url = databaseUrl();
  let host = null;
  try { host = new URL(url).hostname; } catch {}

  try {
    const sql = getSql();
    const t = Date.now();
    const [row] = await sql`select now() as time`;
    // Speed check: every query is a trip from the Vercel function to Neon. If the two are far apart
    // (say Vercel in Washington "iad1" and Neon in Singapore "ap-southeast-1") each trip adds ~200 ms.
    // Compare these two and pick the matching Vercel region in Settings > Functions if they differ.
    const neonRegion = /\.([a-z]{2}-[a-z]+-\d)\./.exec(host || '')?.[1] || null;
    return res.status(200).json({ ok: true, database: 'connected', host, time: row.time, queryMs: Date.now() - t, neonRegion, functionRegion: process.env.VERCEL_REGION || null });
  } catch (err) {
    console.error('health check failed:', err);
    // The host name is not secret; the user/password part of the URL is never returned.
    return res.status(500).json({ ok: false, database: 'unreachable', env_var_set: Boolean(url), host, reason: diagnose(url, err) });
  }
}
