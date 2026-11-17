// POST /api/sessions — a signed-in player uploads their recent finished sessions.
// Body: { sessions: [{ id, start, end, secs, species }] } (start/end in ms since 1970).
import { getSql } from '../server/db.js';
import { cors } from '../server/cors.js';
import { getUser } from '../server/auth.js';
import { ensureSchema } from '../server/schema.js';

const MAX_ITEMS = 200;
const MAX_SECS = 180 * 60; // the longest tree in the app
const WINDOW_MS = 8 * 24 * 60 * 60 * 1000; // only recent sessions count; the leaderboard is weekly

// Basic sanity checks so a hand-crafted request cannot claim impossible focus time.
function clean(x, now) {
  const start = Number(x?.start), end = Number(x?.end), secs = Math.round(Number(x?.secs));
  const id = String(x?.id ?? '').slice(0, 64);
  if (!id || !Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(secs)) return null;
  if (secs < 60 || secs > MAX_SECS) return null;
  if (end > now + 60_000 || end < now - WINDOW_MS || start > end) return null;
  if (secs > (end - start) / 1000 + 5) return null; // can't focus longer than the wall-clock time that passed
  const species = typeof x.species === 'string' ? x.species.slice(0, 40) : null;
  return { id, start: new Date(start).toISOString(), end: new Date(end).toISOString(), secs, species };
}

export function displayName(user) {
  const n = (user.name || '').trim() || (user.email || '').split('@')[0] || 'Grower';
  return n.replace(/\s+/g, ' ').slice(0, 24);
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in first' });

  const list = Array.isArray(req.body?.sessions) ? req.body.sessions.slice(0, MAX_ITEMS) : [];
  const now = Date.now();
  const rows = list.map((x) => clean(x, now)).filter(Boolean);

  try {
    await ensureSchema();
    const sql = getSql();
    await sql`insert into profiles (user_id, display_name) values (${user.id}, ${displayName(user)})
      on conflict (user_id) do update set display_name = excluded.display_name, updated_at = now()`;
    if (rows.length) {
      // unnest turns the arrays into rows, so all sessions go in with one query.
      await sql`insert into focus_sessions (user_id, client_id, started_at, ended_at, seconds, species)
        select ${user.id}, * from unnest(
          ${rows.map((r) => r.id)}::text[],
          ${rows.map((r) => r.start)}::timestamptz[],
          ${rows.map((r) => r.end)}::timestamptz[],
          ${rows.map((r) => r.secs)}::int[],
          ${rows.map((r) => r.species)}::text[]
        )
        on conflict (user_id, client_id) do nothing`;
    }
    return res.status(200).json({ ok: true, accepted: rows.length, rejected: list.length - rows.length });
  } catch (err) {
    console.error('sessions upload failed:', err);
    return res.status(500).json({ error: 'Could not save sessions' });
  }
}
