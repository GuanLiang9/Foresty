// GET /api/health — confirms the API is running and can reach Neon.
//
// Vercel turns every file in api/ into a serverless function at the matching URL.
// The function runs on Vercel's servers, so it can read DATABASE_URL safely;
// the browser only ever sees the JSON this returns.
import { getSql } from '../server/db.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sql = getSql();
    const [row] = await sql`select now() as time`;
    return res.status(200).json({ ok: true, database: 'connected', time: row.time });
  } catch (err) {
    console.error('health check failed:', err);
    // Don't send err.message to the browser: driver errors can include host names.
    return res.status(500).json({ ok: false, database: 'unreachable' });
  }
}
