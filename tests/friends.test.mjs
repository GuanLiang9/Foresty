// Friends API on an in-memory Postgres. Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { PGlite } from '@electric-sql/pglite';
import { fakeSql } from './fake-sql.mjs';

const auth = http.createServer((req, res) => {
  const id = /uid=([^;]+)/.exec(req.headers.cookie || '')?.[1];
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(id ? { user: { id, name: id, email: `${id}@x.dev` } } : null));
});
await new Promise((r) => auth.listen(0, r));
process.env.NEON_AUTH_URL = `http://localhost:${auth.address().port}`;

const sql = fakeSql(new PGlite());
(await import('../server/db.js')).setSqlForTests(sql);
const { packJar } = await import('../server/auth.js');
const h = {};
for (const n of ['state', 'friends', 'competitions']) h[n] = (await import(`../api/${n}.js`)).default;

async function call(name, { method = 'GET', query = {}, body, user = 'me' } = {}) {
  const headers = user ? { authorization: `Bearer ${packJar({ uid: user })}` } : {};
  let out = null, status = 200;
  const res = { setHeader() {}, status(c) { status = c; return res; }, json(o) { out = o; return res; }, end() {} };
  await h[name]({ method, query, body, headers }, res);
  return { status, body: out };
}
const F = (user, op, extra = {}) => call('friends', { user, query: { op, ...extra.query }, method: extra.body ? 'POST' : 'GET', body: extra.body });

const now = Date.now(), H = 3600e3;
const ses = (id, hoursAgo, mins, more = {}) => { const end = Math.round(now - hoursAgo * H); return { id, start: end - mins * 60e3, end, secs: mins * 60, species: 'oak', ok: true, golden: false, p: 1, tag: 'work', note: 'secret', ...more }; };
const doc = (sessions) => ({ v: 1, coins: 0, boosts: 0, freezes: 0, owned: [], ownedSounds: [], tags: [], deleted: [], ach: {}, claims: {}, frozen: {}, quests: {}, prefs: {}, sessions });
const save = (user, sessions) => call('state', { user, method: 'PUT', body: { data: doc(sessions), baseVersion: 0 } });
const range = { a: String(now - 24 * H), b: String(now + H) };

test.after(() => auth.close());

test('friends: request, accept, list, remove', async () => {
  const { body: { code: ca } } = await F('alice', 'me');
  assert.match(ca, /^[A-Z0-9]{8}$/);
  assert.equal((await F('alice', 'me')).body.code, ca, 'code is stable');
  await F('bob', 'me');
  assert.equal((await F('bob', 'request', { body: { code: 'ZZZZZZZZ' } })).status, 404);
  assert.equal((await F('alice', 'request', { body: { code: ca } })).status, 400, 'own code');
  assert.equal((await F('bob', 'request', { body: { code: ca } })).body.status, 'pending');
  assert.equal((await F('bob', 'request', { body: { code: ca } })).status, 400, 'duplicate');
  assert.equal((await F('alice', 'list')).body.incoming[0].uid, 'bob');
  assert.equal((await F('bob', 'list')).body.outgoing[0].uid, 'alice');
  assert.equal((await F('bob', 'accept', { body: { uid: 'alice' } })).status, 404, 'cannot accept your own request');
  assert.equal((await F('alice', 'accept', { body: { uid: 'bob' } })).status, 200);
  assert.equal((await F('alice', 'list')).body.friends[0].uid, 'bob');
  assert.equal((await F('bob', 'list')).body.friends[0].uid, 'alice');
  await F('alice', 'remove', { body: { uid: 'bob' } });
  assert.equal((await F('alice', 'list')).body.friends.length, 0);
  assert.equal((await F('bob', 'list')).body.friends.length, 0);
});

test('friends: crossed requests auto-accept', async () => {
  const { body: { code: cc } } = await F('cat', 'me');
  const { body: { code: cd } } = await F('dan', 'me');
  await F('cat', 'request', { body: { code: cd } });
  assert.equal((await F('dan', 'request', { body: { code: cc } })).body.status, 'accepted');
  assert.equal((await F('cat', 'list')).body.friends[0].uid, 'dan');
});

test('grove: friends and race mates only, window respected, no notes or tags', async () => {
  await save('eve', [ses('a', 1, 30), ses('b', 2, 20, { ok: false, golden: true }), ses('old', 24 * 30, 40)]);
  const { body: { code } } = await F('eve', 'me');
  await F('fay', 'me');
  const get = (user, q = {}) => F(user, 'grove', { query: { uid: 'eve', ...range, ...q } });

  assert.equal((await get('fay')).status, 404, 'stranger');
  await F('fay', 'request', { body: { code } });
  assert.equal((await get('fay')).status, 404, 'pending is not enough');
  await F('eve', 'accept', { body: { uid: 'fay' } });
  const r = await get('fay');
  assert.equal(r.status, 200);
  assert.equal(r.body.name, 'eve');
  assert.deepEqual(r.body.sessions.map((x) => x.id), ['b', 'a'], 'only the window, oldest first');
  assert.equal(r.body.sessions[0].ok, false);
  assert.equal(r.body.sessions[0].golden, true);
  assert.ok(r.body.sessions.every((x) => !('note' in x) && !('tag' in x)));
  assert.equal((await get('eve')).status, 200, 'my own grove');
  assert.equal((await get('fay', { b: String(now + 500 * 24 * H) })).status, 400, 'window over 400 days');

  const race = (await call('competitions', { user: 'eve', method: 'POST', query: { op: 'create' }, body: { name: 'R', days: 7 } })).body.competition;
  await call('competitions', { user: 'gus', method: 'POST', query: { op: 'join' }, body: { code: race.code } });
  assert.equal((await get('gus')).status, 200, 'race mate');
  const st = (await call('competitions', { user: 'gus', query: { op: 'get', id: String(race.id) } })).body.standings;
  assert.ok(st.every((x) => typeof x.uid === 'string'), 'standings carry uid');
});
