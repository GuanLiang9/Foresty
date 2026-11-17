// /api/state — the signed-in player's whole game, so every device shows the same plants and history.
//   GET → { data, version }            data is null until something has been saved
//   GET ?known=N → { version, unchanged: true } when the cloud copy is still version N (no data sent)
//   PUT { data, baseVersion }          saves; only works if baseVersion is the latest version (else 409 + the latest)
// The app does the merging (src/lib/merge.js). The server only guards the door: who you are, sane shape and size,
// and "nobody else saved since you looked" so two devices can never overwrite each other blindly.
import { getSql } from '../server/db.js';
import { cors } from '../server/cors.js';
import { getUser } from '../server/auth.js';
import { ensureSchema } from '../server/schema.js';
import { upsertProfile } from '../server/profiles.js';

const MAX_BYTES = 3_500_000; // Vercel's body limit is 4.5 MB
const MAX_SESSIONS = 20000;

// Shape check only. Values are the player's own game, so we just make sure nothing is the wrong kind of thing.
export function validate(d) {
  const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
  if (!isObj(d) || d.v !== 1) return 'Bad data';
  for (const k of ['coins', 'boosts', 'freezes']) if (!Number.isFinite(d[k]) || d[k] < 0) return `Bad ${k}`;
  for (const k of ['owned', 'ownedSounds', 'tags', 'sessions', 'deleted']) if (!Array.isArray(d[k])) return `Bad ${k}`;
  for (const k of ['ach', 'claims', 'frozen', 'quests', 'prefs']) if (!isObj(d[k])) return `Bad ${k}`;
  if (d.sessions.length > MAX_SESSIONS) return 'Too many sessions';
  if (!d.sessions.every((x) => isObj(x) && Number.isFinite(x.start) && Number.isFinite(x.end) && Number.isFinite(x.secs) && typeof x.species === 'string')) return 'Bad session';
  return null;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });

  // Start checking the tables while we find out who is calling: the two waits overlap instead of adding up.
  const schema = ensureSchema();
  schema.catch(() => {}); // handled below; this only stops an "unhandled rejection" if the caller is signed out
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in first' });

  try {
    await schema;
    const sql = getSql();
    if (req.method === 'GET') {
      // The app checks for changes every minute and whenever it is reopened. Usually nothing changed, so when it
      // tells us the version it already has, we answer "unchanged" instead of sending the whole grove again.
      const known = req.query?.known != null && req.query.known !== '' ? Math.floor(Number(req.query.known)) : null;
      if (Number.isInteger(known) && known >= 0 && known < 2 ** 31) {
        const [row] = await sql`select version, case when version = ${known} then null else data end as data
          from game_state where user_id = ${user.id}`;
        const version = row?.version ?? 0;
        if (version === known) return res.status(200).json({ version, unchanged: true });
        return res.status(200).json({ data: row?.data ?? null, version });
      }
      const [row] = await sql`select data, version from game_state where user_id = ${user.id}`;
      return res.status(200).json({ data: row?.data ?? null, version: row?.version ?? 0 });
    }

    const { data, baseVersion } = req.body || {};
    const problem = validate(data);
    if (problem) return res.status(400).json({ error: problem });
    const text = JSON.stringify(data);
    if (text.length > MAX_BYTES) return res.status(413).json({ error: 'Game data is too large' });
    const base = Math.max(0, Math.floor(Number(baseVersion) || 0));

    // Exactly one save can win for a given version, so concurrent saves cannot both succeed.
    // The profile row and the save travel together in one transaction: one round trip to Neon instead of two.
    const save = base === 0
      ? sql`insert into game_state (user_id, data) values (${user.id}, ${text}::jsonb) on conflict (user_id) do nothing returning version`
      : sql`update game_state set data = ${text}::jsonb, version = version + 1, updated_at = now()
          where user_id = ${user.id} and version = ${base} returning version`;
    const [, saved] = await sql.transaction([upsertProfile(user), save]);
    if (saved[0]) return res.status(200).json({ ok: true, version: saved[0].version });
    const [row] = await sql`select version from game_state where user_id = ${user.id}`;
    return res.status(409).json({ error: 'Changed on another device', version: row?.version ?? 0 });
  } catch (err) {
    console.error('state failed:', err);
    return res.status(500).json({ error: 'Could not sync' });
  }
}
