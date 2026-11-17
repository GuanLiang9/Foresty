// Cloud-sync merge rules. Pure functions (no browser, no network) so they are easy to test.
//
// A "doc" is the part of the game state that follows your account between devices.
// Not synced (stays on the device): the running session, an unspent harvest, the Pomodoro timer.
//
// Rules, in one line each:
//  - sessions, owned plants/sounds, tags, achievements, challenge claims, shields used: UNION. Nothing is ever dropped.
//  - deleted sessions: remembered as "tombstones" so a delete is not undone by the union.
//  - coins, boosts, shield count: counters. Merged as  cloud + (what this device changed since it last synced).
//  - settings, selected plant, wish: last writer wins (by the time of the last change).
//  - daily quests: the newer day wins; the same day unions what was claimed.
// An empty side can never wipe a non-empty one: unions keep everything, and a fresh device has changed nothing (delta 0).
import { SP, SOUNDS, FREE_SOUNDS, MAX_SHIELDS } from '../data.js';

export const MAX_SESSIONS = 20000;
export const MAX_TOMBS = 2000;
export const COUNTERS = ['coins', 'boosts', 'freezes'];
const CAPS = { coins: Infinity, boosts: 9, freezes: MAX_SHIELDS };

// Stable identity of a session. Includes id so two trees from one Free-focus harvest never collide.
export const skey = (x) => `${x.id}|${x.start}|${x.end}|${x.species}`;

const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
const arr = (x) => (Array.isArray(x) ? x : []);
const num = (x) => (Number.isFinite(+x) ? +x : 0);
const uniq = (a) => [...new Set(a)];

export function toDoc(s) {
  return {
    v: 1,
    coins: s.coins, boosts: s.boosts, freezes: s.freezes, boostDay: s.boostDay || '',
    owned: s.owned, ownedSounds: s.ownedSounds, tags: s.tags,
    sessions: s.sessions, deleted: arr(s.deleted),
    ach: s.ach, claims: s.claims, frozen: s.frozen, quests: s.quests,
    prefs: { at: s.prefsAt || 0, settings: s.settings, selected: s.selected, wish: s.wish },
    onboarded: !!s.onboarded,
  };
}

const validSession = (x) => x && Number.isFinite(x.start) && Number.isFinite(x.end) && Number.isFinite(x.secs) && SP[x.species];

function unionObj(a, b, pick) {
  const out = { ...obj(a) };
  for (const [k, v] of Object.entries(obj(b))) out[k] = k in out ? pick(out[k], v) : v;
  return out;
}

// local: the device's state (or its doc). cloud: the account's doc, or null if none yet.
// base: the counters this device saw at its last sync ({} if never) so only its own changes are added to the cloud.
export function mergeDocs(localDoc, cloudDoc, base = {}) {
  const L = localDoc, C = cloudDoc || null, c = obj(C);
  const out = { v: 1 };
  for (const k of COUNTERS) {
    const mine = num(L[k]), seen = C ? num(base[k]) : 0;
    out[k] = Math.max(0, Math.min(CAPS[k], Math.round((C ? num(c[k]) : 0) + mine - seen)));
  }
  out.boostDay = [L.boostDay, c.boostDay].filter(Boolean).sort().pop() || '';

  out.deleted = uniq([...arr(c.deleted), ...arr(L.deleted)]).slice(-MAX_TOMBS);
  const dead = new Set(out.deleted), seen = new Map();
  for (const x of [...arr(c.sessions), ...arr(L.sessions)]) {
    if (!validSession(x)) continue;
    const k = skey(x);
    if (!dead.has(k) && !seen.has(k)) seen.set(k, x);
  }
  out.sessions = [...seen.values()].sort((a, b) => a.end - b.end || a.id - b.id).slice(-MAX_SESSIONS);

  out.owned = uniq(['oak', 'pine', ...arr(c.owned), ...arr(L.owned)].filter((id) => SP[id]));
  out.ownedSounds = uniq([...FREE_SOUNDS, ...arr(c.ownedSounds), ...arr(L.ownedSounds)].filter((id) => SOUNDS.some((x) => x.id === id)));
  const tags = new Map();
  for (const t of [...arr(c.tags), ...arr(L.tags)]) if (t && t.id) tags.set(t.id, t); // this device wins a clash
  out.tags = [...tags.values()];

  out.ach = unionObj(c.ach, L.ach, (a, b) => Math.min(num(a) || Infinity, num(b) || Infinity));
  out.claims = unionObj(c.claims, L.claims, (a) => a);
  out.frozen = unionObj(c.frozen, L.frozen, (a) => a);

  const lq = obj(L.quests), cq = obj(c.quests);
  out.quests = !cq.date || lq.date > cq.date ? lq : lq.date < cq.date ? cq : { date: lq.date, claimed: { ...obj(cq.claimed), ...obj(lq.claimed) } };

  const lp = obj(L.prefs), cp = obj(c.prefs);
  const mineWins = !C || !c.prefs || num(lp.at) > num(cp.at);
  const w = mineWins ? lp : cp;
  out.prefs = { at: Math.max(num(lp.at), num(cp.at)), settings: { ...obj(cp.settings), ...obj(lp.settings), ...obj(w.settings) }, selected: w.selected, wish: w.wish };
  if (!out.owned.includes(out.prefs.selected)) out.prefs.selected = out.owned.includes(lp.selected) ? lp.selected : 'oak';
  if (out.prefs.wish && (!SP[out.prefs.wish] || SP[out.prefs.wish].exclusive || out.owned.includes(out.prefs.wish))) out.prefs.wish = null;
  out.onboarded = !!(L.onboarded || c.onboarded);
  return out;
}

// Puts a merged doc back into a full state, leaving the device-only parts (active, harvest, pomo) alone.
export function applyDoc(s, d) {
  return {
    ...s,
    coins: d.coins, boosts: d.boosts, freezes: d.freezes, boostDay: d.boostDay,
    owned: d.owned, ownedSounds: d.ownedSounds, tags: d.tags.length ? d.tags : s.tags,
    sessions: d.sessions, deleted: d.deleted,
    ach: d.ach, claims: d.claims, frozen: d.frozen, quests: d.quests,
    settings: { ...s.settings, ...d.prefs.settings }, selected: d.prefs.selected, wish: d.prefs.wish, prefsAt: d.prefs.at,
    onboarded: d.onboarded || s.onboarded,
  };
}
