// /api/competitions?op=... — friendly focus-time races between players.
//
//   GET  op=list              → competitions I'm in, newest first, with my rank and the leader
//   GET  op=get&id=123        → one competition with full standings (members only)
//   POST op=create {name,days}→ start a race now, lasting `days` (1–30); returns its invite code
//   POST op=join   {code}     → join with an invite code
//   POST op=claim  {id}       → winner collects the coin reward once the race has ended
//
// Standings are worked out from focus_sessions, so nothing extra has to be uploaded:
// every finished session that ended inside the race window counts.
import { randomInt } from 'node:crypto';
import { getSql } from '../server/db.js';
import { cors } from '../server/cors.js';
import { getUser } from '../server/auth.js';
import { ensureSchema } from '../server/schema.js';
import { upsertProfile } from '../server/profiles.js';

const DAY = 24 * 60 * 60 * 1000;
const MAX_MEMBERS = 50;
const MAX_ACTIVE_CREATED = 10;

// Longer races pay more, but less per day: 1 day 100, 1 week 430, 1 month 1280 coins.
export const rewardFor = (days) => Math.round((100 * days ** 0.75) / 10) * 10;

// No 0/O or 1/I/L, so codes are easy to read out loud.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

// Everyone's focus time inside each race's window, for the races with these ids.
// Works for one race or many at once, so the race list needs one query instead of one per race.
const standingsRows = (sql, ids) => sql`
  select m.competition_id::text as cid, m.user_id, p.display_name,
         coalesce(sum(f.seconds), 0)::int as seconds, count(f.client_id)::int as plants
  from competition_members m
  join competitions c on c.id = m.competition_id
  join profiles p on p.user_id = m.user_id
  left join focus_sessions f on f.user_id = m.user_id and f.ended_at >= c.starts_at and f.ended_at < c.ends_at
  where m.competition_id = any(${ids.map(String)}::bigint[])
  group by m.competition_id, m.user_id, p.display_name
  order by m.competition_id, seconds desc, p.display_name`;

// Turns one race's rows (already sorted, most focus first) into ranked standings.
function rankRows(rows, meId) {
  const top = rows[0]?.seconds || 0;
  let rank = 0, prev = -1;
  return rows.map((r, i) => {
    if (r.seconds !== prev) { rank = i + 1; prev = r.seconds; }
    // Winners: everyone tied for first, and only if they focused at all.
    return { rank, name: r.display_name, minutes: Math.floor(r.seconds / 60), plants: r.plants, me: r.user_id === meId, leader: top > 0 && r.seconds === top };
  });
}

async function standings(sql, c, meId) {
  return rankRows(await standingsRows(sql, [c.id]), meId);
}

function summary(c, board, member) {
  const ended = new Date(c.ends_at).getTime() <= Date.now();
  const me = board.find((r) => r.me);
  const won = ended && Boolean(me?.leader);
  return {
    id: Number(c.id), name: c.name, code: c.code, reward: c.reward,
    startsAt: new Date(c.starts_at).toISOString(), endsAt: new Date(c.ends_at).toISOString(),
    ended, members: board.length, myRank: me?.rank ?? null, myMinutes: me?.minutes ?? 0,
    leader: board.find((r) => r.leader)?.name ?? null,
    won, claimed: Boolean(member?.reward_claimed_at),
  };
}

async function getCompetition(sql, id) {
  const [c] = await sql`select * from competitions where id = ${id}`;
  return c || null;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  res.setHeader('Cache-Control', 'no-store');

  const schema = ensureSchema(); // overlaps with the sign-in check below
  schema.catch(() => {});
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in first' });
  const op = req.query?.op;
  const body = req.body || {};

  try {
    await schema;
    const sql = getSql();

    if (req.method === 'GET' && op === 'list') {
      const mine = await sql`
        select c.*, m.reward_claimed_at from competitions c
        join competition_members m on m.competition_id = c.id and m.user_id = ${user.id}
        order by c.ends_at < now(), c.ends_at desc
        limit 30`;
      // One query for every race's standings (it used to be one query per race).
      const rows = mine.length ? await standingsRows(sql, mine.map((c) => c.id)) : [];
      const byRace = new Map();
      for (const r of rows) { if (!byRace.has(r.cid)) byRace.set(r.cid, []); byRace.get(r.cid).push(r); }
      const list = mine.map((c) => summary(c, rankRows(byRace.get(String(c.id)) || [], user.id), c));
      return res.status(200).json({ competitions: list });
    }

    if (req.method === 'GET' && op === 'get') {
      const id = Math.floor(Number(req.query.id));
      if (!Number.isSafeInteger(id) || id < 1) return res.status(404).json({ error: 'Competition not found' });
      // The race, my membership and the standings in one round trip.
      const [[c], [member], rows] = await sql.transaction([
        sql`select * from competitions where id = ${id}`,
        sql`select * from competition_members where competition_id = ${id} and user_id = ${user.id}`,
        standingsRows(sql, [id]),
      ], { readOnly: true });
      if (!c || !member) return res.status(404).json({ error: 'Competition not found' });
      const board = rankRows(rows, user.id);
      return res.status(200).json({ competition: summary(c, board, member), standings: board });
    }

    if (req.method === 'POST' && op === 'create') {
      const days = Math.round(Number(body.days));
      if (!(days >= 1 && days <= 30)) return res.status(400).json({ error: 'Pick between 1 and 30 days' });
      const name = String(body.name || '').replace(/\s+/g, ' ').trim().slice(0, 40) || 'Focus race';
      await upsertProfile(user);
      const [{ n }] = await sql`select count(*)::int as n from competitions where created_by = ${user.id} and ends_at > now()`;
      if (n >= MAX_ACTIVE_CREATED) return res.status(429).json({ error: `You can run up to ${MAX_ACTIVE_CREATED} races at once` });
      const now = Date.now();
      for (let attempt = 0; attempt < 5; attempt++) {
        const [c] = await sql`
          insert into competitions (code, name, created_by, starts_at, ends_at, reward)
          values (${newCode()}, ${name}, ${user.id}, ${new Date(now).toISOString()}, ${new Date(now + days * DAY).toISOString()}, ${rewardFor(days)})
          on conflict (code) do nothing
          returning *`;
        if (!c) continue; // code already taken: try another
        await sql`insert into competition_members (competition_id, user_id) values (${c.id}, ${user.id})`;
        return res.status(200).json({ competition: summary(c, await standings(sql, c, user.id), null) });
      }
      return res.status(500).json({ error: 'Could not create a code, please try again' });
    }

    if (req.method === 'POST' && op === 'join') {
      const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const [c] = code ? await sql`select * from competitions where code = ${code}` : [];
      if (!c) return res.status(404).json({ error: 'No race with that code' });
      if (new Date(c.ends_at).getTime() <= Date.now()) return res.status(400).json({ error: 'That race has already finished' });
      const [{ n }] = await sql`select count(*)::int as n from competition_members where competition_id = ${c.id}`;
      if (n >= MAX_MEMBERS) return res.status(400).json({ error: 'That race is full' });
      await upsertProfile(user);
      await sql`insert into competition_members (competition_id, user_id) values (${c.id}, ${user.id}) on conflict do nothing`;
      return res.status(200).json({ competition: summary(c, await standings(sql, c, user.id), null) });
    }

    if (req.method === 'POST' && op === 'claim') {
      const c = await getCompetition(sql, Number(body.id));
      if (!c) return res.status(404).json({ error: 'Competition not found' });
      if (new Date(c.ends_at).getTime() > Date.now()) return res.status(400).json({ error: 'The race is still running' });
      const me = (await standings(sql, c, user.id)).find((r) => r.me);
      if (!me) return res.status(404).json({ error: 'Competition not found' });
      if (!me.leader) return res.status(403).json({ error: 'Only the winner can claim the reward' });
      // The "is null" check makes this safe to call twice: only the first call gets coins.
      const [row] = await sql`update competition_members set reward_claimed_at = now()
        where competition_id = ${c.id} and user_id = ${user.id} and reward_claimed_at is null returning 1`;
      return res.status(200).json({ coins: row ? c.reward : 0, alreadyClaimed: !row });
    }

    return res.status(404).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('competitions failed:', err);
    return res.status(500).json({ error: 'Something went wrong with competitions' });
  }
}
