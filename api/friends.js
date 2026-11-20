// /api/friends?op=... — friends, their focus time and their groves.
//
//   GET  op=me                → my friend code (created on first use)
//   GET  op=list              → { me, friends, incoming, outgoing } with this week's minutes
//   POST op=request {code}    → ask the owner of a friend code to be friends (auto-accepts a crossed request)
//   POST op=accept  {uid}     → accept an incoming request
//   POST op=remove  {uid}     → unfriend, decline or cancel
//   GET  op=grove&uid&a&b     → that player's finished/withered sessions ended in [a,b) (ms). Friends and race mates only.
//
// Groves come from the synced game_state, so they carry withered/golden plants and older history than focus_sessions.
// Notes and tags are never sent.
import { getSql } from '../server/db.js';
import { cors } from '../server/cors.js';
import { getUser } from '../server/auth.js';
import { ensureSchema } from '../server/schema.js';
import { upsertProfile } from '../server/profiles.js';
import { canView } from '../server/access.js';
import { newCode, cleanCode } from '../server/codes.js';

const DAY = 24 * 60 * 60 * 1000;
const MAX_FRIENDS = 200;
const MAX_WINDOW = 400 * DAY;
const MAX_PLANTS = 500;

async function myCode(sql, user) {
  await upsertProfile(user);
  for (let i = 0; i < 5; i++) {
    const [row] = await sql`select friend_code from profiles where user_id = ${user.id}`;
    if (row?.friend_code) return row.friend_code;
    try {
      await sql`update profiles set friend_code = ${newCode(8)} where user_id = ${user.id} and friend_code is null`;
    } catch (err) {
      if (err?.code !== '23505') throw err; // code taken by someone else: try another
    }
  }
  throw new Error('Could not create a friend code');
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  res.setHeader('Cache-Control', 'no-store');

  const schema = ensureSchema();
  schema.catch(() => {});
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in first' });
  const op = req.query?.op;
  const body = req.body || {};

  try {
    await schema;
    const sql = getSql();

    if (req.method === 'GET' && op === 'me') {
      return res.status(200).json({ code: await myCode(sql, user) });
    }

    if (req.method === 'GET' && op === 'list') {
      const since = new Date(Date.now() - 7 * DAY).toISOString();
      const [friends, incoming, outgoing, mine] = await sql.transaction([
        sql`select fr.friend_id as uid, p.display_name as name, coalesce(sum(s.seconds), 0)::int as seconds
            from friendships fr join profiles p on p.user_id = fr.friend_id
            left join focus_sessions s on s.user_id = fr.friend_id and s.ended_at >= ${since}
            where fr.user_id = ${user.id} and fr.status = 'accepted'
            group by fr.friend_id, p.display_name order by seconds desc, p.display_name`,
        sql`select fr.user_id as uid, p.display_name as name from friendships fr join profiles p on p.user_id = fr.user_id
            where fr.friend_id = ${user.id} and fr.status = 'pending' order by fr.created_at`,
        sql`select fr.friend_id as uid, p.display_name as name from friendships fr join profiles p on p.user_id = fr.friend_id
            where fr.user_id = ${user.id} and fr.status = 'pending' order by fr.created_at`,
        sql`select coalesce(sum(seconds), 0)::int as seconds from focus_sessions where user_id = ${user.id} and ended_at >= ${since}`,
      ], { readOnly: true });
      const m = (r) => ({ uid: r.uid, name: r.name, minutes: Math.floor((r.seconds || 0) / 60) });
      return res.status(200).json({ me: { minutes: Math.floor((mine[0]?.seconds || 0) / 60) }, friends: friends.map(m), incoming: incoming.map(m), outgoing: outgoing.map(m) });
    }

    if (req.method === 'POST' && op === 'request') {
      const code = cleanCode(body.code);
      const [target] = code ? await sql`select user_id, display_name from profiles where friend_code = ${code}` : [];
      if (!target) return res.status(404).json({ error: 'No player with that friend code' });
      if (target.user_id === user.id) return res.status(400).json({ error: 'That is your own code' });
      await upsertProfile(user);
      const [[{ n }], links] = await sql.transaction([
        sql`select count(*)::int as n from friendships where user_id = ${user.id} and status = 'accepted'`,
        sql`select user_id, status from friendships where (user_id = ${user.id} and friend_id = ${target.user_id}) or (user_id = ${target.user_id} and friend_id = ${user.id})`,
      ], { readOnly: true });
      if (links.some((l) => l.status === 'accepted')) return res.status(400).json({ error: 'You are already friends' });
      if (links.some((l) => l.user_id === user.id)) return res.status(400).json({ error: 'Request already sent' });
      if (n >= MAX_FRIENDS) return res.status(400).json({ error: 'Friend list is full' });
      if (links.some((l) => l.user_id === target.user_id)) {
        await sql.transaction([
          sql`update friendships set status = 'accepted' where user_id = ${target.user_id} and friend_id = ${user.id}`,
          sql`insert into friendships (user_id, friend_id, status) values (${user.id}, ${target.user_id}, 'accepted') on conflict (user_id, friend_id) do update set status = 'accepted'`,
        ]);
        return res.status(200).json({ status: 'accepted', name: target.display_name });
      }
      await sql`insert into friendships (user_id, friend_id, status) values (${user.id}, ${target.user_id}, 'pending') on conflict do nothing`;
      return res.status(200).json({ status: 'pending', name: target.display_name });
    }

    if (req.method === 'POST' && op === 'accept') {
      const uid = String(body.uid || '');
      const [row] = await sql`update friendships set status = 'accepted' where user_id = ${uid} and friend_id = ${user.id} and status = 'pending' returning 1`;
      if (!row) return res.status(404).json({ error: 'No request from that player' });
      await sql`insert into friendships (user_id, friend_id, status) values (${user.id}, ${uid}, 'accepted') on conflict (user_id, friend_id) do update set status = 'accepted'`;
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'POST' && op === 'remove') {
      const uid = String(body.uid || '');
      await sql`delete from friendships where (user_id = ${user.id} and friend_id = ${uid}) or (user_id = ${uid} and friend_id = ${user.id})`;
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'GET' && op === 'grove') {
      const uid = String(req.query.uid || '');
      const a = Math.floor(Number(req.query.a)), b = Math.floor(Number(req.query.b));
      if (!uid || !Number.isFinite(a) || !Number.isFinite(b) || b <= a || b - a > MAX_WINDOW) return res.status(400).json({ error: 'Bad time range' });
      if (!(await canView(sql, user.id, uid))) return res.status(404).json({ error: 'Player not found' });
      const [[p], rows] = await sql.transaction([
        sql`select display_name from profiles where user_id = ${uid}`,
        sql`select jsonb_build_object('id', x->'id', 'start', x->'start', 'end', x->'end', 'secs', x->'secs', 'species', x->'species', 'ok', x->'ok', 'golden', x->'golden', 'p', x->'p') as s
            from game_state g, jsonb_array_elements(g.data->'sessions') x
            where g.user_id = ${uid} and (x->>'end')::numeric >= ${a} and (x->>'end')::numeric < ${b}
            order by (x->>'end')::numeric desc limit ${MAX_PLANTS}`,
      ], { readOnly: true });
      return res.status(200).json({ name: p?.display_name || 'Grower', sessions: rows.map((r) => r.s).reverse() });
    }

    return res.status(404).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('friends failed:', err);
    return res.status(500).json({ error: 'Something went wrong with friends' });
  }
}
