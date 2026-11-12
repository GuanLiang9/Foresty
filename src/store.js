import { useSyncExternalStore } from 'react';
import { SPECIES, SP, TAGS, TAG_COLORS, ACHIEVEMENTS, QUESTS, LEVELS, SHIELD_PRICE, MAX_SHIELDS } from './data';
import { dayKey, mulberry } from './lib/util';
import * as audio from './lib/audio';

// `?demo` makes one minute pass per second so a full session can be tried in under a minute.
export const SPEED = new URLSearchParams(location.search).has('demo') ? 60 : 1;
export const GRACE = 10000; // ms away from the app before a Deep Focus plant withers
export const MAX_SW = 180 * 60; // stopwatch cap (s)
export const MIN_SW = 10 * 60; // stopwatch minimum for a living plant (s)
const KEY = 'evergrove:v1';

const defaults = () => ({
  coins: 0,
  owned: ['oak', 'pine'],
  selected: 'oak',
  sessions: [],
  tags: TAGS,
  settings: { duration: 25, mode: 'timer', deep: true, tag: 'work', haptics: true, sfx: true, awake: true, goal: 60, breakMin: 5, sounds: {} },
  active: null,
  ach: {},
  quests: { date: dayKey(), claimed: {} },
  freezes: 0,
  frozen: {},
  onboarded: false,
});

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw) { const d = defaults(); return { ...d, ...raw, settings: { ...d.settings, ...raw.settings } }; }
  } catch {}
  return defaults();
}

let state = load();
const subs = new Set();
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };
const commit = (next) => { state = next; persist(); subs.forEach((f) => f()); };
const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };

export const useStore = () => useSyncExternalStore(subscribe, () => state);
export const set = (patch) => commit({ ...state, ...patch });
export const setSetting = (k, v) => commit({ ...state, settings: { ...state.settings, [k]: v } });
export const haptic = (p) => { if (state.settings.haptics) try { navigator.vibrate?.(p); } catch {} };
export const sfx = (k) => state.settings.sfx && audio.chime(k);

/* ---------- derived ---------- */

const dayNum = (k) => Math.round(new Date(`${k}T12:00:00`).getTime() / 864e5);

export function okDays(s) {
  return new Set(s.sessions.filter((x) => x.ok).map((x) => dayKey(x.end)));
}

// Shielded days keep a streak alive but do not add to it.
export function streakOf(s) {
  const days = okDays(s), d = new Date();
  d.setHours(12, 0, 0, 0);
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(d)) || s.frozen[dayKey(d)]) {
    if (days.has(dayKey(d))) n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function bestStreak(s) {
  const nums = [...new Set([...okDays(s), ...Object.keys(s.frozen)])].map(dayNum).sort((a, b) => a - b);
  let best = 0, run = 0;
  nums.forEach((n, i) => { run = i && n - nums[i - 1] === 1 ? run + 1 : 1; best = Math.max(best, run); });
  return Math.max(best, streakOf(s));
}

export const xpOf = (s) => Math.floor(s.sessions.reduce((n, x) => n + (x.ok ? x.secs : 0), 0) / 60);

export function levelInfo(xp) {
  const need = (n) => 15 * n * (n + 1); // cumulative minutes to finish level n
  let level = 1;
  while (xp >= need(level)) level++;
  const lo = need(level - 1), hi = need(level);
  return { level, title: LEVELS[Math.min(LEVELS.length - 1, Math.floor((level - 1) / 2))], into: xp - lo, span: hi - lo };
}

export function lifetime(s) {
  const ok = s.sessions.filter((x) => x.ok), byDay = {};
  ok.forEach((x) => { const k = dayKey(x.end); byDay[k] = (byDay[k] || 0) + 1; });
  return {
    trees: ok.length,
    dead: s.sessions.length - ok.length,
    minutes: ok.reduce((n, x) => n + x.secs, 0) / 60,
    longest: ok.reduce((n, x) => Math.max(n, x.secs), 0) / 60,
    best: bestStreak(s),
    species: s.owned.length,
    golden: ok.filter((x) => x.golden).length,
    maxDay: Math.max(0, ...Object.values(byDay)),
    early: ok.some((x) => { const h = new Date(x.start).getHours(); return h >= 4 && h < 7; }),
    night: ok.some((x) => { const h = new Date(x.end).getHours(); return h >= 22 || h < 4; }),
  };
}

export function todayMinutes(s) {
  const k = dayKey();
  return s.sessions.reduce((n, x) => n + (x.ok && dayKey(x.end) === k ? x.secs : 0), 0) / 60;
}

export function questsOf(s) {
  const k = dayKey(), r = mulberry(+k.replace(/-/g, ''));
  const t = s.sessions.filter((x) => dayKey(x.end) === k), ok = t.filter((x) => x.ok);
  const T = {
    min: ok.reduce((n, x) => n + x.secs, 0) / 60,
    count: ok.length,
    clean: t.length === ok.length ? ok.length : 0,
    long: ok.some((x) => x.secs >= 2700) ? 1 : 0,
    tags: new Set(ok.map((x) => x.tag)).size,
    deep: ok.some((x) => x.deep) ? 1 : 0,
    noon: ok.some((x) => new Date(x.end).getHours() < 12) ? 1 : 0,
  };
  return QUESTS.map((slot) => {
    const q = slot[Math.floor(r() * slot.length)], v = Math.min(q.goal, Math.floor(T[q.k]));
    return { ...q, v, done: v >= q.goal, claimed: s.quests.date === k && !!s.quests.claimed[q.id] };
  });
}

export function periodRange(kind, off) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const f = (x, o) => x.toLocaleDateString('en-SG', o);
  let a, b, label;
  if (kind === 'day') {
    d.setDate(d.getDate() + off);
    a = new Date(d); b = new Date(d); b.setDate(b.getDate() + 1);
    label = off === 0 ? 'Today' : off === -1 ? 'Yesterday' : f(a, { weekday: 'short', day: 'numeric', month: 'short' });
  } else if (kind === 'week') {
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + off * 7);
    a = new Date(d); b = new Date(d); b.setDate(b.getDate() + 7);
    label = off === 0 ? 'This week' : `${f(a, { day: 'numeric', month: 'short' })} – ${f(new Date(b - 1), { day: 'numeric', month: 'short' })}`;
  } else if (kind === 'month') {
    a = new Date(d.getFullYear(), d.getMonth() + off, 1); b = new Date(a.getFullYear(), a.getMonth() + 1, 1);
    label = f(a, { month: 'long', year: 'numeric' });
  } else {
    a = new Date(d.getFullYear() + off, 0, 1); b = new Date(a.getFullYear() + 1, 0, 1);
    label = String(a.getFullYear());
  }
  return { a: +a, b: +b, label };
}

/* ---------- actions ---------- */

function award(next, at) {
  const L = lifetime(next), unlocked = [];
  for (const A of ACHIEVEMENTS) {
    if (next.ach[A.id] || !A.test(L)) continue;
    unlocked.push(A);
    next = { ...next, ach: { ...next.ach, [A.id]: at }, coins: next.coins + A.reward };
  }
  return [next, unlocked];
}

export function startSession(note) {
  const { settings: c } = state, now = Date.now();
  commit({ ...state, active: { start: now, seen: now, planned: c.duration * 60, mode: c.mode, species: state.selected, tag: c.tag, note: note.trim(), deep: c.deep } });
}

export const cancelSession = () => commit({ ...state, active: null });

// Liveness marker: lets a relaunch tell "app was killed mid-session" from "still running".
export function heartbeat() {
  if (!state.active) return;
  state = { ...state, active: { ...state.active, seen: Date.now() } };
  persist();
}

export function finishSession(ok, at = Date.now(), reason) {
  const s = state, a = s.active;
  if (!a) return null;
  const elapsed = Math.max(0, ((at - a.start) / 1000) * SPEED);
  const timer = a.mode === 'timer';
  const secs = Math.round(timer ? (ok ? a.planned : Math.min(elapsed, a.planned)) : Math.min(elapsed, MAX_SW));
  const min = secs / 60;
  const before = { streak: streakOf(s), level: levelInfo(xpOf(s)).level };
  const golden = ok && Math.random() < 0.06 + Math.min(min, 120) / 1200;
  let coins = ok ? Math.max(1, Math.round(min * 0.5 * (1 + Math.min(before.streak, 10) * 0.03))) : 0;
  if (golden) coins *= 2;
  const session = { id: at, start: a.start, end: at, secs, p: timer ? secs / a.planned : Math.min(1, secs / 1800), species: a.species, tag: a.tag, note: a.note, ok, golden, coins, deep: a.deep, mode: a.mode };
  let next = { ...s, active: null, sessions: [...s.sessions, session], coins: s.coins + coins }, unlocked = [];
  if (ok) [next, unlocked] = award(next, at);
  commit(next);
  const streak = streakOf(next), level = levelInfo(xpOf(next));
  return { session, coins, golden, unlocked, reason, streak, streakUp: streak > before.streak, level, levelUp: level.level > before.level };
}

export function buy(id) {
  const sp = SP[id];
  if (!sp || state.owned.includes(id) || state.coins < sp.price) return false;
  const [next, unlocked] = award({ ...state, coins: state.coins - sp.price, owned: [...state.owned, id], selected: id }, Date.now());
  commit(next);
  return unlocked;
}

export const select = (id) => state.owned.includes(id) && commit({ ...state, selected: id });

export function buyShield() {
  if (state.coins < SHIELD_PRICE || state.freezes >= MAX_SHIELDS) return false;
  commit({ ...state, coins: state.coins - SHIELD_PRICE, freezes: state.freezes + 1 });
  return true;
}

export function claimQuest(id) {
  const q = questsOf(state).find((x) => x.id === id);
  if (!q || !q.done || q.claimed) return 0;
  commit({ ...state, coins: state.coins + q.reward, quests: { date: dayKey(), claimed: { ...state.quests.claimed, [id]: 1 } } });
  return q.reward;
}

export const deleteSession = (id) => commit({ ...state, sessions: state.sessions.filter((x) => x.id !== id) });

export function addTag(name) {
  name = name.trim().slice(0, 16);
  if (!name) return;
  const id = `t${Date.now()}`;
  commit({ ...state, tags: [...state.tags, { id, name, color: TAG_COLORS[state.tags.length % TAG_COLORS.length] }], settings: { ...state.settings, tag: id } });
}

// Runs on launch/resume: resets daily quests and spends shields on missed days.
export function rollover() {
  const s = state, today = dayKey(), patch = {};
  if (s.quests.date !== today) patch.quests = { date: today, claimed: {} };
  const days = okDays(s), d = new Date(), missed = [];
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - 1);
  const live = () => days.has(dayKey(d)) || s.frozen[dayKey(d)];
  while (missed.length <= s.freezes && !live()) { missed.push(dayKey(d)); d.setDate(d.getDate() - 1); }
  let used = 0;
  if (missed.length && missed.length <= s.freezes && live()) {
    used = missed.length;
    patch.freezes = s.freezes - used;
    patch.frozen = { ...s.frozen, ...Object.fromEntries(missed.map((k) => [k, 1])) };
  }
  if (Object.keys(patch).length) commit({ ...s, ...patch });
  return used;
}

export const exportData = () => JSON.stringify({ ...state, active: null }, null, 2);

export function importData(text) {
  const raw = JSON.parse(text);
  if (!raw || !Array.isArray(raw.sessions) || !Array.isArray(raw.owned)) throw new Error('bad file');
  const d = defaults();
  commit({
    ...d,
    coins: Math.max(0, +raw.coins || 0),
    owned: raw.owned.filter((id) => SP[id]),
    selected: SP[raw.selected] ? raw.selected : 'oak',
    sessions: raw.sessions.filter((x) => x && Number.isFinite(x.start) && Number.isFinite(x.end) && Number.isFinite(x.secs) && SP[x.species]),
    tags: Array.isArray(raw.tags) && raw.tags.length ? raw.tags.map((t) => ({ id: String(t.id), name: String(t.name).slice(0, 16), color: /^#[0-9a-f]{6}$/i.test(t.color) ? t.color : '#34d399' })) : d.tags,
    settings: { ...d.settings, ...(raw.settings || {}) },
    ach: raw.ach || {},
    freezes: Math.min(MAX_SHIELDS, +raw.freezes || 0),
    frozen: raw.frozen || {},
    onboarded: true,
  });
}

export const resetAll = () => commit({ ...defaults(), onboarded: true });
export const speciesCount = SPECIES.length;
