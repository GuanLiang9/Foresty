// Speed check for EverGrove. Run: npm run bench
//
// 1. App load: builds the app, opens it in Chromium on a throttled "slow 4G" phone profile
//    (150 ms latency, 1.6 Mbps down, CPU slowed 4x) and times how long until the app is on screen.
// 2. API: calls the real API handlers against an in-memory Postgres and counts database round trips.
//    With Neon each round trip is a separate HTTPS request (roughly 5-50 ms each, more if Vercel and
//    Neon are in different regions), so fewer round trips is the main way to make the API faster.
//    Every round trip here also waits LATENCY ms, so the times are a rough picture of the real thing.
//
// Set BENCH_ROOT=/path/to/other/checkout to measure another version of the app with the same script.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { PGlite } from '@electric-sql/pglite';
import { fakeSql } from './fake-sql.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(process.env.BENCH_ROOT || path.join(import.meta.dirname, '..'));
const DIST = path.join(ROOT, 'dist-bench');
const LATENCY = 20;
const RUNS = 5;
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

/* ---------------- 1. App load ---------------- */
async function appLoad() {
  execSync(`npx vite build --outDir ${DIST} --emptyOutDir`, { cwd: ROOT, stdio: 'ignore', env: { ...process.env, API_URL: '', NEON_AUTH_URL: '' } });
  const js = fs.readdirSync(path.join(DIST, 'assets')).filter((f) => f.endsWith('.js'));
  const sizes = js.map((f) => zlib.gzipSync(fs.readFileSync(path.join(DIST, 'assets', f))).length);
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
  let served = 0; // bytes the server sent, to see what a repeat visit really downloads
  let delay = 0; // extra wait before every answer (the browser's network throttling doesn't reach service workers)
  const server = http.createServer(async (req, res) => {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    const u = new URL(req.url, 'http://x');
    const f = path.join(DIST, u.pathname === '/' ? 'index.html' : u.pathname);
    if (!f.startsWith(DIST) || !fs.existsSync(f)) { res.statusCode = 404; return res.end(); }
    const body = fs.readFileSync(f), ext = path.extname(f);
    // Compress like GitHub Pages does, so byte counts match the real site.
    const zip = ['.html', '.js', '.css', '.json', '.webmanifest', '.svg'].includes(ext);
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    if (zip) res.setHeader('Content-Encoding', 'gzip');
    const out = zip ? zlib.gzipSync(body) : body;
    served += out.length;
    res.end(out);
  });
  await new Promise((r) => server.listen(4300, r));
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const times = [], bytes = [];
  for (let i = 0; i < RUNS; i++) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block' });
    await ctx.addInitScript(() => { if (!localStorage.getItem('evergrove:v1')) localStorage.setItem('evergrove:v1', JSON.stringify({ onboarded: true })); });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    let got = 0;
    cdp.on('Network.loadingFinished', (e) => { got += e.encodedDataLength; });
    const t0 = Date.now();
    await page.goto('http://localhost:4300/');
    await page.getByRole('button', { name: 'Grove' }).waitFor();
    times.push(Date.now() - t0);
    await page.waitForTimeout(300);
    bytes.push(got);
    await ctx.close();
  }
  // Repeat visit of the installed app: the service worker has saved the files from the first visit.
  const again = [], againBytes = [], lieFi = [];
  for (let i = 0; i < RUNS; i++) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
    await ctx.addInitScript(() => { if (!localStorage.getItem('evergrove:v1')) localStorage.setItem('evergrove:v1', JSON.stringify({ onboarded: true })); });
    const page = await ctx.newPage();
    await page.goto('http://localhost:4300/');
    await page.getByRole('button', { name: 'Grove' }).waitFor();
    await page.waitForTimeout(2500); // let the service worker save everything
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    delay = 150;
    served = 0;
    let t0 = Date.now();
    await page.reload();
    await page.getByRole('button', { name: 'Grove' }).waitFor();
    again.push(Date.now() - t0);
    await page.waitForTimeout(1500);
    againBytes.push(served);
    // "Lie-fi": connected, but every request takes 4 seconds to answer.
    delay = 4000;
    t0 = Date.now();
    await page.reload();
    await page.getByRole('button', { name: 'Grove' }).waitFor({ timeout: 30000 });
    lieFi.push(Date.now() - t0);
    delay = 0;
    await ctx.close();
  }
  await browser.close();
  server.close();
  fs.rmSync(DIST, { recursive: true, force: true });
  return { files: js.length, jsGz: sizes.reduce((a, b) => a + b, 0), entryGz: Math.max(...sizes), ms: median(times), firstLoadBytes: median(bytes), repeatMs: median(again), repeatBytes: median(againBytes), lieFiMs: median(lieFi) };
}

/* ---------------- 2. API ---------------- */
async function api() {
  const auth = http.createServer((req, res) => {
    const id = /uid=([^;]+)/.exec(req.headers.cookie || '')?.[1];
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(id ? { user: { id, name: id, email: `${id}@x.dev` } } : null));
  });
  await new Promise((r) => auth.listen(4310, r));
  process.env.NEON_AUTH_URL = 'http://localhost:4310';
  const pg = new PGlite();
  await pg.query('select 1'); // start the in-memory database first so its startup is not counted
  const sql = fakeSql(pg, { latency: LATENCY });
  const { setSqlForTests } = await import(path.join(ROOT, 'server/db.js'));
  setSqlForTests(sql);
  const { packJar } = await import(path.join(ROOT, 'server/auth.js'));
  const h = {};
  for (const n of ['state', 'sessions', 'leaderboard', 'competitions']) h[n] = (await import(path.join(ROOT, `api/${n}.js`))).default;
  const token = (id) => packJar({ uid: id });

  const call = async (name, { method = 'GET', query = {}, body, user = 'me' } = {}) => {
    const req = { method, query, body, headers: { authorization: `Bearer ${token(user)}`, origin: 'https://guanliang9.github.io' } };
    let out = '', status = 200;
    const res = { setHeader() {}, status(c) { status = c; return res; }, json(o) { out = JSON.stringify(o); return res; }, end() {} };
    const before = sql.stats.trips, t = performance.now();
    await h[name](req, res);
    return { trips: sql.stats.trips - before, ms: Math.round(performance.now() - t), bytes: out.length, status, body: out ? JSON.parse(out) : null };
  };

  const now = Date.now(), H = 3600e3;
  const session = (k, hoursAgo) => { const end = Math.round(now - hoursAgo * H); return { id: `${k}`, start: end - 1500e3, end, secs: 1500, species: 'oak' }; };
  const grove = (n) => ({ v: 1, coins: 500, boosts: 0, freezes: 0, owned: ['oak', 'pine'], ownedSounds: [], tags: [], deleted: [], ach: {}, claims: {}, frozen: {}, quests: {}, prefs: {},
    sessions: [...Array(n)].map((_, i) => ({ start: now - i * H - 1500e3, end: now - i * H, secs: 1500, species: 'oak', ok: true, tag: 'work', note: '', golden: false, coins: 10, id: now - i * H })) });

  const rows = {};
  // First request on a fresh server ("cold start"): also creates the tables.
  rows['Cold start: first request (GET state)'] = await call('state');
  // 120 players with sessions this week, so the leaderboard has real work to do.
  for (let u = 0; u < 120; u++) await call('sessions', { method: 'POST', user: `p${u}`, body: { sessions: [...Array(8)].map((_, k) => session(`${u}-${k}`, k * 15 + 1)) } });
  rows['Upload finished sessions (POST sessions)'] = await call('sessions', { method: 'POST', body: { sessions: [...Array(10)].map((_, k) => session(`me-${k}`, k * 10 + 1)) } });
  rows['Save the grove (PUT state)'] = await call('state', { method: 'PUT', body: { data: grove(300), baseVersion: 0 } });
  rows['Load the grove (GET state)'] = await call('state');
  const v = rows['Load the grove (GET state)'].body.version;
  rows['Background check, nothing changed (GET state)'] = await call('state', { query: { known: String(v) } });
  rows['Leaderboard (GET leaderboard)'] = await call('leaderboard', { query: { period: 'week', tz: '-480' } });
  let first;
  for (let i = 0; i < 6; i++) {
    const r = await call('competitions', { method: 'POST', query: { op: 'create' }, body: { name: `Race ${i}`, days: 7 } });
    first ??= r.body.competition;
    for (let u = 0; u < 8; u++) await call('competitions', { method: 'POST', query: { op: 'join' }, user: `p${u}`, body: { code: r.body.competition.code } });
  }
  rows['My races, 6 races (GET competitions list)'] = await call('competitions', { query: { op: 'list' } });
  rows['One race (GET competitions get)'] = await call('competitions', { query: { op: 'get', id: String(first.id) } });
  auth.close();
  return rows;
}

const mode = process.argv[2] || 'all';
const out = {};
if (mode !== 'api') out.app = await appLoad();
if (mode !== 'app') out.api = await api();
if (out.app) {
  const a = out.app;
  console.log(`\nApp load (slow 4G phone, median of ${RUNS})`);
  console.log(`  time until the app is on screen   ${a.ms} ms`);
  console.log(`  downloaded on first visit         ${kb(a.firstLoadBytes)}`);
  console.log(`  JavaScript, all files (gzip)      ${kb(a.jsGz)} in ${a.files} file${a.files > 1 ? 's' : ''}`);
  console.log(`  largest JavaScript file (gzip)    ${kb(a.entryGz)}`);
  console.log(`  repeat visit: time until on screen ${a.repeatMs} ms`);
  console.log(`  repeat visit: downloaded           ${kb(a.repeatBytes)}`);
  console.log(`  repeat visit on "lie-fi" (4 s per request) ${a.lieFiMs} ms`);
}
if (out.api) {
  console.log(`\nAPI (each database round trip waits ${LATENCY} ms)`);
  for (const [k, r] of Object.entries(out.api)) console.log(`  ${k.padEnd(48)} ${String(r.trips).padStart(2)} trips  ${String(r.ms).padStart(4)} ms  ${kb(r.bytes).padStart(9)}`);
}
if (process.env.BENCH_JSON) fs.writeFileSync(process.env.BENCH_JSON, JSON.stringify(out, null, 2));
process.exit(0);
