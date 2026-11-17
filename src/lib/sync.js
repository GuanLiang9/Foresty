// Uploads finished sessions from the last week so they count on the leaderboard.
// Game data still lives on the device; this only sends a copy of recent completed plants.
import { useSyncExternalStore } from 'react';
import { getState, SPEED, applySynced, startFresh, onWipe } from '../store';
import { toDoc, applyDoc, mergeDocs, COUNTERS } from './merge';
import { getAccount, signOut } from './auth';
import { api } from './api';

const WEEK = 7 * 24 * 60 * 60 * 1000;
let lastSent = '', running = null;

export function syncSessions() {
  if (SPEED > 1 || getAccount().status !== 'in') return Promise.resolve(); // demo mode runs time ×60; never upload it
  const since = Date.now() - WEEK;
  const recent = getState().sessions
    .filter((x) => x.ok && x.end >= since && x.secs >= 60)
    .map((x) => ({ id: `${x.start}-${x.end}-${x.species}`, start: x.start, end: x.end, secs: x.secs, species: x.species }));
  const key = recent.map((x) => x.id).join('|');
  if (key === lastSent) return running || Promise.resolve();
  running = api('sessions', { method: 'POST', body: { sessions: recent } })
    .then(() => { lastSent = key; })
    .catch(() => {}) // offline: try again next time
    .finally(() => { running = null; });
  return running;
}

/* ---------- full cloud sync of the game (plants, history, coins, settings) ---------- */
// The account keeps one copy of your game in the cloud. Every device that signs in pulls it,
// merges it with what it has (rules in lib/merge.js), and pushes the result back.
//
// Bookkeeping lives in localStorage "evergrove:sync":
//   owner   which account this device's data is synced with
//   version the cloud copy's version the last time we saw it (a push only succeeds if nobody else pushed since)
//   base    the cloud's coin/boost/shield counters at that version, so we only ever add *our own* changes

const META = 'evergrove:sync';
const readMeta = () => { try { return JSON.parse(localStorage.getItem(META)) || {}; } catch { return {}; } };
const writeMeta = (m) => { try { localStorage.setItem(META, JSON.stringify(m)); } catch {} };
const counters = (d) => Object.fromEntries(COUNTERS.map((k) => [k, d?.[k] || 0]));

// { phase: 'off' | 'idle' | 'syncing' | 'ok' | 'offline', at, added, n }  (added = sessions brought in by the last sync)
let status = { phase: 'off', at: 0, added: 0, n: 0 };
const subs = new Set();
const setStatus = (p) => { status = { ...status, ...p }; subs.forEach((f) => f()); };
export const useSyncStatus = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => status);

// Erase-all on this device forgets what we knew, so the cloud copy comes back in full instead of being "subtracted".
onWipe(() => { const m = readMeta(); writeMeta({ owner: m.owner }); lastSig = ''; });

let lastSig = '', gameRun = null, again = false;
// Postgres jsonb reorders object keys, so compare with keys sorted or every pull would look like a change.
const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
const sigOf = (doc) => JSON.stringify(canon(doc));

// One round: pull, merge, apply, push. Retries when another device pushed in between.
async function round(uid) {
  let meta = readMeta();
  if (meta.owner && meta.owner !== uid) { startFresh(); meta = {}; lastSig = ''; } // someone else's grove: never mix it into this account
  for (let tries = 0; tries < 4; tries++) {
    // Fast path: once this page has synced, we know which cloud version our data is based on. Ask the server
    // "still version N?" and it answers without sending the whole grove. Usually nothing changed on the other
    // devices, so this check costs a few bytes instead of the full history every minute.
    if (tries === 0 && lastSig && meta.owner === uid && meta.version != null) {
      const r = await api(`state?known=${meta.version}`);
      if (r.unchanged) {
        const doc = toDoc(getState());
        if (sigOf(doc) === lastSig) return 0; // nothing new on either side
        // Only this device changed: our data already is "cloud + my changes", so send it as is (like pushIfChanged).
        try {
          const saved = await api('state', { method: 'PUT', body: { data: doc, baseVersion: meta.version } });
          writeMeta({ owner: uid, version: saved.version, base: counters(doc) });
          lastSig = sigOf(doc);
          return 0;
        } catch (err) {
          if (err.status !== 409) throw err; // another device saved in the meantime: do the full merge below
          continue;
        }
      }
      // Changed elsewhere: the response already carries the new cloud copy, so merge it right away.
      const added = await mergeAndPush(uid, meta, r.data, r.version);
      if (added != null) return added;
      meta = readMeta();
      continue;
    }
    const { data: cloud, version } = await api('state');
    const added = await mergeAndPush(uid, meta, cloud, version);
    if (added != null) return added;
    meta = readMeta();
  }
  throw new Error('Sync is busy, will retry');
}

// Merges a cloud copy into this device and uploads the result. Returns the number of plants that came in,
// or null when another device saved first (the caller then pulls again).
async function mergeAndPush(uid, meta, cloud, version) {
  const before = applySynced((s) => applyDoc(s, mergeDocs(toDoc(s), cloud, meta.base)));
  const merged = toDoc(getState());
  const added = merged.sessions.length - before.sessions.length;
  writeMeta({ owner: uid, version, base: counters(cloud) });
  if (cloud && sigOf(merged) === sigOf(cloud)) { lastSig = sigOf(merged); return added; } // nothing new to send
  try {
    const r = await api('state', { method: 'PUT', body: { data: merged, baseVersion: version } });
    writeMeta({ owner: uid, version: r.version, base: counters(merged) });
    lastSig = sigOf(merged);
    return added;
  } catch (err) {
    if (err.status !== 409) throw err; // 409: someone else pushed first, so pull again and re-merge
    return null;
  }
}

export function syncGame({ force = false } = {}) {
  const acc = getAccount();
  if (SPEED > 1 || acc.status !== 'in') return Promise.resolve();
  if (gameRun) { again = true; return gameRun; }
  setStatus({ phase: 'syncing' });
  gameRun = round(acc.user.id)
    .then((added) => setStatus({ phase: 'ok', at: Date.now(), added, n: status.n + 1 }))
    .catch((err) => setStatus({ phase: err.status ? 'error' : 'offline', error: err.message })) // no network: local play continues, we try again later
    .finally(() => { gameRun = null; if (again) { again = false; syncGame(); } });
  return gameRun;
}

// Cheap upload after a local change: skips the pull when nothing changed, and when our version is still current
// the local doc already equals "cloud + my changes", so it can be sent as is.
export async function pushIfChanged() {
  const acc = getAccount();
  if (SPEED > 1 || acc.status !== 'in' || gameRun) return;
  const doc = toDoc(getState());
  if (sigOf(doc) === lastSig) return;
  const meta = readMeta();
  if (meta.owner !== acc.user.id || meta.version == null) return syncGame();
  gameRun = api('state', { method: 'PUT', body: { data: doc, baseVersion: meta.version } })
    .then((r) => { writeMeta({ owner: meta.owner, version: r.version, base: counters(doc) }); lastSig = sigOf(doc); setStatus({ phase: 'ok', at: Date.now() }); })
    .catch((err) => { if (err.status === 409) again = true; else setStatus({ phase: err.status ? 'error' : 'offline', error: err.message }); })
    .finally(() => { gameRun = null; if (again) { again = false; syncGame(); } });
  return gameRun;
}

// Sign out after a last upload, so nothing made while signed in is left behind.
export async function signOutSynced() {
  try { await Promise.race([syncGame(), new Promise((r) => setTimeout(r, 4000))]); } catch {}
  return signOut();
}
