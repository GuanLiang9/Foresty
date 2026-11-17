// End-to-end check of cloud sync with two simulated devices (two separate browser storages).
// Run: npm run test:e2e   (needs Chromium via Playwright; uses an in-memory Postgres, no real Neon or secrets)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { PGlite } from '@electric-sql/pglite';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(import.meta.dirname, '..'), DIST = path.join(ROOT, 'dist-e2e');
const APP = 4000, AUTH = 4100;

/* --- stand-in for Neon Auth: email + password, cookie sessions --- */
const users = new Map();
const authServer = http.createServer(async (req, res) => {
  let body = ''; for await (const c of req) body += c;
  const j = (code, o, h = {}) => { res.writeHead(code, { 'Content-Type': 'application/json', ...h }); res.end(JSON.stringify(o)); };
  const url = req.url.split('?')[0], b = body ? JSON.parse(body) : {};
  const cookie = /sess=([^;]+)/.exec(req.headers.cookie || '')?.[1];
  if (url === '/sign-up/email') { const u = { id: `u_${users.size + 1}`, name: b.name, email: b.email, password: b.password }; users.set(b.email, u); return j(200, { user: { id: u.id, name: u.name, email: u.email } }, { 'Set-Cookie': `sess=${u.id}; Path=/` }); }
  if (url === '/sign-in/email') { const u = users.get(b.email); if (!u || u.password !== b.password) return j(401, { message: 'Invalid email or password' }); return j(200, { user: { id: u.id, name: u.name, email: u.email } }, { 'Set-Cookie': `sess=${u.id}; Path=/` }); }
  if (url === '/get-session') { const u = [...users.values()].find((x) => x.id === cookie); return u ? j(200, { user: { id: u.id, name: u.name, email: u.email } }) : j(200, null); }
  if (url === '/sign-out') return j(200, { ok: true }, { 'Set-Cookie': 'sess=; Max-Age=0; Path=/' });
  j(404, {});
});
await new Promise((r) => authServer.listen(AUTH, r));
process.env.NEON_AUTH_URL = `http://localhost:${AUTH}`;

/* --- real API handlers on an in-memory Postgres --- */
const pg = new PGlite();
const { setSqlForTests } = await import('../server/db.js');
setSqlForTests((strings, ...vals) => { let q = strings[0]; vals.forEach((_, i) => { q += `$${i + 1}${strings[i + 1]}`; }); return pg.query(q, vals).then((r) => r.rows); });
const handlers = {};
for (const n of ['auth', 'state', 'sessions', 'leaderboard']) handlers[n] = (await import(`../api/${n}.js`)).default;
let offline = new Set(); // contexts whose API calls we cut
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const appServer = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/api/')) {
    let raw = ''; for await (const c of req) raw += c;
    req.body = raw ? JSON.parse(raw) : undefined;
    req.query = Object.fromEntries(u.searchParams);
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
    const h = handlers[u.pathname.slice(5)];
    return h ? h(req, res) : res.status(404).json({ error: 'nope' });
  }
  const f = path.join(DIST, u.pathname === '/' ? 'index.html' : u.pathname);
  if (!f.startsWith(DIST) || !fs.existsSync(f)) { res.statusCode = 404; return res.end(); }
  res.setHeader('Content-Type', MIME[path.extname(f)] || 'application/octet-stream'); res.end(fs.readFileSync(f));
});
await new Promise((r) => appServer.listen(APP, r));

execSync(`npx vite build --outDir ${DIST} --emptyOutDir`, { cwd: ROOT, env: { ...process.env, NEON_AUTH_URL: process.env.NEON_AUTH_URL, API_URL: '' }, stdio: 'ignore' });

/* --- helpers --- */
const browser = await chromium.launch();
const HOUR = 3600e3, NOW = Date.now();
const sess = (hoursAgo, species = 'oak', secs = 1500) => { const end = Math.round(NOW - hoursAgo * HOUR); return { id: end, start: end - secs * 1000, end, secs, p: 1, species, tag: 'work', note: '', ok: true, golden: false, coins: 0, deep: true, mode: 'timer' }; };
const device = async (seed) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${APP}/`);
  if (seed) await page.evaluate((s) => localStorage.setItem('evergrove:v1', JSON.stringify(s)), { onboarded: true, ...seed });
  await page.reload();
  return { ctx, page };
};
const local = (d) => d.page.evaluate(() => JSON.parse(localStorage.getItem('evergrove:v1')));
const cloud = async (uid) => (await pg.query('select data, version from game_state where user_id=$1', [uid])).rows[0];
const until = async (fn, what, ms = 15000) => { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch {} if (Date.now() - t > ms) throw new Error(`timed out: ${what}`); await new Promise((r) => setTimeout(r, 150)); } };
const signIn = async (d, email, mode = 'in') => {
  await d.page.getByRole('button', { name: 'Ranks' }).click();
  if (mode === 'up') { await d.page.getByText('New here?').click(); await d.page.getByPlaceholder('Display name').fill('Tester'); }
  await d.page.getByPlaceholder('Email').fill(email); await d.page.getByPlaceholder('Password').fill('password123');
  await d.page.getByRole('button', { name: mode === 'up' ? 'Create account' : 'Sign in', exact: true }).click();
};
const cut = (d, on) => on ? d.page.route('**/api/state', (r) => r.abort()) : d.page.unroute('**/api/state');
const ok = (m) => console.log('  ✓', m);

try {
  console.log('1. Phone PWA has 3 plants + 120 coins, signs up: cloud gets everything');
  const phone = await device({ coins: 120, sessions: [sess(30), sess(26, 'pine', 900), sess(2, 'oak')], owned: ['oak', 'pine', 'sun'], settings: { goal: 90 } });
  await signIn(phone, 'me@example.com', 'up');
  const uid = await until(() => users.get('me@example.com')?.id, 'account');
  let row = await until(async () => { const r = await cloud(uid); return r?.data.sessions.length === 3 && r; }, 'cloud has 3 plants');
  assert.equal(row.data.coins, 120); assert.ok(row.data.owned.includes('sun')); ok('3 plants, 120 coins, owned plants in the cloud');

  console.log('2. Fresh browser signs in: shows the same plants, coins and settings');
  const web = await device({});
  await signIn(web, 'me@example.com');
  let st = await until(async () => { const s = await local(web); return s.sessions.length === 3 && s; }, 'browser pulls 3 plants');
  assert.equal(st.coins, 120); assert.ok(st.owned.includes('sun')); assert.equal(st.settings.goal, 90); ok('browser has 3 plants, 120 coins, owned sun, goal 90');
  await web.page.getByRole('button', { name: 'Grove' }).click();
  await web.page.waitForTimeout(500);
  console.log('   (grove screen rendered with synced data)');

  console.log('3. Offline on the phone: plant grown offline, uploaded when back online, browser picks it up');
  await cut(phone, true);
  const s0 = await local(phone);
  await phone.page.evaluate((x) => { const s = JSON.parse(localStorage.getItem('evergrove:v1')); s.sessions.push(x); s.coins += 20; localStorage.setItem('evergrove:v1', JSON.stringify(s)); }, sess(0.5, 'pine', 1200));
  await phone.page.reload(); await phone.page.waitForTimeout(1500);
  assert.equal((await cloud(uid)).data.sessions.length, 3); ok('while offline the cloud is unchanged, phone keeps its data');
  await cut(phone, false);
  await phone.page.evaluate(() => dispatchEvent(new Event('online')));
  row = await until(async () => { const r = await cloud(uid); return r.data.sessions.length === 4 && r; }, 'offline plant uploaded');
  assert.equal(row.data.coins, 140); ok('back online: 4 plants, 140 coins in cloud');
  await web.page.evaluate(() => dispatchEvent(new Event('online')));
  st = await until(async () => { const s = await local(web); return s.sessions.length === 4 && s; }, 'browser sees the new plant'); assert.equal(st.coins, 140); ok('browser pulled the plant grown offline on the phone');

  console.log('4. Both devices change things at the same time (conflict): nothing lost or doubled');
  await cut(phone, true); await cut(web, true);
  const edit = (d, x, coins) => d.page.evaluate(([x, c]) => { const s = JSON.parse(localStorage.getItem('evergrove:v1')); s.sessions.push(x); s.coins += c; localStorage.setItem('evergrove:v1', JSON.stringify(s)); }, [x, coins]);
  await edit(phone, sess(0.2, 'oak'), 30); await edit(web, sess(0.1, 'pine', 600), 10);
  await phone.page.reload(); await web.page.reload(); await phone.page.waitForTimeout(800);
  await cut(phone, false); await phone.page.evaluate(() => dispatchEvent(new Event('online')));
  await until(async () => (await cloud(uid)).data.sessions.length === 5, 'phone pushed');
  await cut(web, false); await web.page.evaluate(() => dispatchEvent(new Event('online')));
  row = await until(async () => { const r = await cloud(uid); return r.data.sessions.length === 6 && r; }, 'web merged in');
  assert.equal(row.data.coins, 180); ok('6 plants, 180 coins (140 + 30 + 10) with no duplicates');
  await phone.page.evaluate(() => dispatchEvent(new Event('online')));
  st = await until(async () => { const s = await local(phone); return s.sessions.length === 6 && s; }, 'phone converges'); assert.equal(st.coins, 180);
  assert.equal(new Set(st.sessions.map((x) => `${x.id}|${x.species}`)).size, 6); ok('both devices end on the same 6 plants / 180 coins');

  console.log('5. Browser with its OWN old data signs in to an account that already has plants');
  const web2 = await device({ coins: 55, sessions: [sess(200, 'cactus', 1200), sess(100, 'oak', 1800)], owned: ['oak', 'pine', 'cactus'] });
  await signIn(web2, 'me@example.com');
  st = await until(async () => { const s = await local(web2); return s.sessions.length === 8 && s; }, 'merge of local + cloud');
  assert.equal(st.coins, 235); assert.ok(st.owned.includes('cactus') && st.owned.includes('sun'));
  row = await until(async () => { const r = await cloud(uid); return r.data.sessions.length === 8 && r; }, 'cloud has all 8'); assert.equal(row.data.coins, 235);
  ok('8 plants, 235 coins, both sets of owned plants; cloud matches');

  console.log('6. Leaderboard stays idempotent after merging (no double counting)');
  await Promise.all([web2.page, phone.page, web.page].map((p) => p.evaluate(() => dispatchEvent(new Event('online')))));
  await new Promise((r) => setTimeout(r, 3000));
  const lb = (await pg.query('select count(*)::int n, sum(seconds)::int s from focus_sessions where user_id=$1', [uid])).rows[0];
  const week = st.sessions.concat([]).filter((x) => x.ok && x.end >= Date.now() - 7 * 24 * HOUR && x.secs >= 60);
  const expected = new Set(week.map((x) => `${x.start}-${x.end}-${x.species}`)).size;
  assert.equal(lb.n, expected);
  const dup = (await pg.query('select client_id, count(*) from focus_sessions group by 1 having count(*)>1')).rows;
  assert.equal(dup.length, 0); ok(`leaderboard rows: ${lb.n} (unique, within the week window); a repeat run adds none`);
  const lbBefore = lb.n; await web2.page.getByRole('button', { name: 'Ranks' }).click(); await new Promise((r) => setTimeout(r, 1500));
  assert.equal((await pg.query('select count(*)::int n from focus_sessions')).rows[0].n, lbBefore);

  console.log('7. A different account on the same browser never receives the first account’s plants');
  await web2.page.getByRole('button', { name: 'Ranks' }).click();
  await web2.page.getByLabel('Sign out').click(); await web2.page.waitForTimeout(1200);
  await signIn(web2, 'other@example.com', 'up');
  const uid2 = await until(() => users.get('other@example.com')?.id, 'second account');
  await until(async () => (await local(web2)).sessions.length === 0, 'local grove reset');
  await new Promise((r) => setTimeout(r, 1500));
  const r2 = await cloud(uid2); assert.ok(!r2 || r2.data.sessions.length === 0); ok('second account starts empty; first account untouched');
  assert.equal((await cloud(uid)).data.sessions.length, 8);

  console.log('\nAll sync scenarios passed.');
} catch (e) { console.error('\nFAILED:', e.message); process.exitCode = 1; }
await browser.close(); authServer.close(); appServer.close(); fs.rmSync(DIST, { recursive: true, force: true }); process.exit(process.exitCode || 0);
