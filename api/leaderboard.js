// GET /api/leaderboard?period=week|month — top players by focus time.
// Anyone can read it; if the caller is signed in, their own row is marked and their rank returned.
import { getSql } from '../server/db.js';
import { cors } from '../server/cors.js';
import { getUser } from '../server/auth.js';
import { ensureSchema } from '../server/schema.js';
import { canView } from '../server/access.js';

const DAYS = { week: 7, month: 30 };
const DAY = 24 * 60 * 60 * 1000;

// ?uid=X&from=ms&to=ms&tz=N — one player's focus minutes per day. Anyone on the board is already public, so any
// signed-in player may look; `canGrove` says whether the grove itself may be opened (friends and race mates only).
async function player(req, res, sql, user) {
  if (!user) return res.status(401).json({ error: 'Sign in first' });
  const uid = String(req.query.uid), from = Math.floor(Number(req.query.from)), to = Math.floor(Number(req.query.to));
  if (!uid || !Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > 31 * DAY) return res.status(400).json({ error: 'Bad time range' });
  const tz = Math.max(-840, Math.min(840, Math.round(Number(req.query.tz) || 0)));
  const a = new Date(from).toISOString(), b = new Date(to).toISOString();
  const [[[p], days, [n]], canGrove] = await Promise.all([
    sql.transaction([
      sql`select display_name from profiles where user_id = ${uid}`,
      sql`select to_char((ended_at at time zone 'UTC') - (${tz}::int * interval '1 minute'), 'YYYY-MM-DD') as day, sum(seconds)::int as seconds
          from focus_sessions where user_id = ${uid} and ended_at >= ${a} and ended_at < ${b} group by 1 order by 1`,
      sql`select count(*)::int as n from focus_sessions where user_id = ${uid} and ended_at >= ${a} and ended_at < ${b}`,
    ], { readOnly: true }),
    canView(sql, user.id, uid),
  ]);
  if (!p) return res.status(404).json({ error: 'Player not found' });
  const daily = days.map((d) => ({ day: d.day, minutes: Math.floor(d.seconds / 60) }));
  return res.status(200).json({ name: p.display_name, daily, minutes: daily.reduce((t, d) => t + d.minutes, 0), plants: n.n, canGrove });
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const period = DAYS[req.query?.period] ? req.query.period : 'week';
  const since = new Date(Date.now() - DAYS[period] * 24 * 60 * 60 * 1000).toISOString();

  try {
    const [user] = await Promise.all([getUser(req), ensureSchema()]);
    const sql = getSql();
    if (req.query?.uid) return await player(req, res, sql, user);
    const meId = user?.id ?? '';
    // rank() gives tied players the same position. Only the top 50 plus my own row come back from the
    // database, instead of every player who focused this week.
    const board = sql`
      with totals as (
        select f.user_id, p.display_name, sum(f.seconds)::int as seconds, count(*)::int as plants
        from focus_sessions f join profiles p using (user_id)
        where f.ended_at >= ${since}
        group by f.user_id, p.display_name
      ), ranked as (
        select *, rank() over (order by seconds desc)::int as rank,
               row_number() over (order by seconds desc, display_name)::int as pos
        from totals
      )
      select * from ranked where pos <= 50 or user_id = ${meId}
      order by pos`;
    // My focus minutes per local day, for the chart. `tz` is the browser's getTimezoneOffset() (minutes behind UTC).
    const tz = Math.max(-840, Math.min(840, Math.round(Number(req.query?.tz) || 0)));
    const daily = sql`
      select to_char((ended_at at time zone 'UTC') - (${tz}::int * interval '1 minute'), 'YYYY-MM-DD') as day, sum(seconds)::int as seconds
      from focus_sessions where user_id = ${meId} and ended_at >= ${since}
      group by 1 order by 1`;
    // Both queries go to Neon together: one round trip instead of two.
    const [rows, days] = user ? await sql.transaction([board, daily], { readOnly: true }) : [await board, []];
    const top = rows.filter((r) => r.pos <= 50).map((r) => ({ rank: r.rank, uid: r.user_id, name: r.display_name, minutes: Math.floor(r.seconds / 60), plants: r.plants, me: r.user_id === user?.id }));
    const mine = user && rows.find((r) => r.user_id === user.id);
    const me = mine ? { rank: mine.rank, minutes: Math.floor(mine.seconds / 60), plants: mine.plants } : null;
    return res.status(200).json({ period, top, me, daily: days.map((d) => ({ day: d.day, minutes: Math.floor(d.seconds / 60) })), signedIn: Boolean(user) });
  } catch (err) {
    console.error('leaderboard failed:', err);
    return res.status(500).json({ error: 'Could not load the leaderboard' });
  }
}
