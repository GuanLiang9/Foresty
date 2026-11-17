// GET /api/leaderboard?period=week|month — top players by focus time.
// Anyone can read it; if the caller is signed in, their own row is marked and their rank returned.
import { getSql } from '../server/db.js';
import { getUser } from '../server/auth.js';
import { ensureSchema } from '../server/schema.js';

const DAYS = { week: 7, month: 30 };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const period = DAYS[req.query?.period] ? req.query.period : 'week';
  const since = new Date(Date.now() - DAYS[period] * 24 * 60 * 60 * 1000).toISOString();

  try {
    const [user] = await Promise.all([getUser(req), ensureSchema()]);
    const sql = getSql();
    // rank() gives tied players the same position.
    const rows = await sql`
      with totals as (
        select f.user_id, p.display_name, sum(f.seconds)::int as seconds, count(*)::int as plants
        from focus_sessions f join profiles p using (user_id)
        where f.ended_at >= ${since}
        group by f.user_id, p.display_name
      )
      select *, rank() over (order by seconds desc)::int as rank from totals
      order by seconds desc, display_name`;
    const top = rows.slice(0, 50).map((r) => ({ rank: r.rank, name: r.display_name, minutes: Math.floor(r.seconds / 60), plants: r.plants, me: r.user_id === user?.id }));
    const mine = user && rows.find((r) => r.user_id === user.id);
    const me = mine ? { rank: mine.rank, minutes: Math.floor(mine.seconds / 60), plants: mine.plants } : null;
    return res.status(200).json({ period, top, me, signedIn: Boolean(user) });
  } catch (err) {
    console.error('leaderboard failed:', err);
    return res.status(500).json({ error: 'Could not load the leaderboard' });
  }
}
