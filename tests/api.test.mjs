// API checks on an in-memory Postgres: the speed changes must give the same answers as before.
// Run: npm test
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

const pg = new PGlite();
const sql = fakeSql(pg);
(await import('../server/db.js')).setSqlForTests(sql);
const { packJar } = await import('../server/auth.js');
const h = {};
for (const n of ['state', 'sessions', 'leaderboard', 'competitions']) h[n] = (await import(`../api/${n}.js`)).default;

async function call(name, { method = 'GET', query = {}, body, user = 'me' } = {}) {
  const headers = user ? { authorization: `Bearer ${packJar({ uid: user })}` } : {};
  let out = null, status = 200;
  const res = { setHeader() {}, status(c) { status = c; return res; }, json(o) { out = o; return res; }, end() {} };
  const before = sql.stats.trips;
  await h[name]({ method, query, body, headers }, res);
  return { status, body: out, trips: sql.stats.trips - before };
}

const now = Date.now(), H = 3600e3;
const session = (id, hoursAgo, mins) => { const end = Math.round(now - hoursAgo * H); return { id, start: end - mins * 60e3, end, secs: mins * 60, species: 'oak' }; };
const grove = (n) => ({ v: 1, coins: n, boosts: 0, freezes: 0, owned: [], ownedSounds: [], tags: [], deleted: [], ach: {}, claims: {}, frozen: {}, quests: {}, prefs: {}, sessions: [] });

test.after(() => auth.close());

test('state: a background check sends no data when nothing changed, and the full grove when it did', async () => {
  const empty = await call('state', { query: { known: '0' } });
  assert.deepEqual(empty.body, { version: 0, unchanged: true });
  const saved = await call('state', { method: 'PUT', body: { data: grove(5), baseVersion: 0 } });
  assert.equal(saved.body.version, 1);
  assert.equal(saved.trips, 1, 'profile + save in one round trip');
  assert.deepEqual((await call('state', { query: { known: '1' } })).body, { version: 1, unchanged: true });
  const changed = await call('state', { query: { known: '0' } });
  assert.equal(changed.body.version, 1);
  assert.equal(changed.body.data.coins, 5);
  assert.equal((await call('state')).body.data.coins, 5, 'a plain GET still returns everything');
  const stale = await call('state', { method: 'PUT', body: { data: grove(9), baseVersion: 0 } });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.version, 1);
  const next = await call('state', { method: 'PUT', body: { data: grove(9), baseVersion: 1 } });
  assert.equal(next.body.version, 2);
  assert.equal((await call('state', { method: 'PUT', body: { data: grove(10), baseVersion: 1 } })).status, 409, 'two devices can never both save on the same version');
});

test('sessions: re-uploading the same sessions never double counts', async () => {
  const list = [session('a', 1, 30), session('b', 2, 20)];
  const first = await call('sessions', { method: 'POST', user: 'twice', body: { sessions: list } });
  assert.equal(first.trips, 1);
  await call('sessions', { method: 'POST', user: 'twice', body: { sessions: list } });
  const [{ n, s }] = (await pg.query("select count(*)::int n, sum(seconds)::int s from focus_sessions where user_id = 'twice'")).rows;
  assert.deepEqual([n, s], [2, 3000]);
});

test('leaderboard: top 50 plus my own rank when I am further down', async () => {
  for (let i = 0; i < 60; i++) await call('sessions', { method: 'POST', user: `p${String(i).padStart(2, '0')}`, body: { sessions: [session(`x${i}`, 1, 100 + i)] } });
  await call('sessions', { method: 'POST', user: 'slow', body: { sessions: [session('s1', 1, 61)] } });
  const r = await call('leaderboard', { user: 'slow', query: { period: 'week', tz: '0' } });
  assert.equal(r.trips, 1, 'board and my chart in one round trip');
  assert.equal(r.body.top.length, 50);
  assert.equal(r.body.top[0].minutes, 159);
  assert.equal(r.body.top[0].rank, 1);
  assert.ok(!r.body.top.some((x) => x.me));
  assert.equal(r.body.me.minutes, 61);
  assert.equal(r.body.me.rank, 61); // 60 players focused more
});

test('races: the list and a single race agree on standings', async () => {
  const made = [];
  for (let i = 0; i < 3; i++) made.push((await call('competitions', { method: 'POST', user: 'host', query: { op: 'create' }, body: { name: `R${i}`, days: 7 } })).body.competition);
  for (const c of made.slice(0, 2)) await call('competitions', { method: 'POST', user: 'p00', query: { op: 'join' }, body: { code: c.code } });
  const t = Date.now() + 1000;
  await call('sessions', { method: 'POST', user: 'host', body: { sessions: [{ id: 'h1', start: t - 61e3, end: t, secs: 61, species: 'oak' }] } });
  const list = await call('competitions', { user: 'host', query: { op: 'list' } });
  assert.equal(list.body.competitions.length, 3);
  assert.ok(list.trips <= 2, `list took ${list.trips} round trips`);
  for (const c of list.body.competitions) {
    const one = await call('competitions', { user: 'host', query: { op: 'get', id: String(c.id) } });
    assert.equal(one.trips, 1);
    assert.deepEqual(one.body.competition, c);
    assert.equal(one.body.standings.length, c.members);
    assert.equal(c.myMinutes, 1, 'my session inside the race window counts');
  }
  const outsider = await call('competitions', { user: 'nobody', query: { op: 'get', id: String(made[0].id) } });
  assert.equal(outsider.status, 404, 'only members can see a race');
  assert.equal((await call('competitions', { user: 'host', query: { op: 'get', id: 'abc' } })).status, 404);
});
