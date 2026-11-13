import { useSyncExternalStore } from 'react';
import { SP, BUYABLE, TAGS, TAG_COLORS, ACHIEVEMENTS, QUESTS, LEVELS, SOUNDS, FREE_SOUNDS, MONTHLY, EVENTS, DUPLICATE_REWARD, SHIELD_PRICE, MAX_SHIELDS } from './data';
import { dayKey, mulberry } from './lib/util';
import * as audio from './lib/audio';

// `?demo` makes one minute pass per second so a full session can be tried in under a minute.
export const SPEED = new URLSearchParams(location.search).has('demo') ? 60 : 1;
export const GRACE = 10000; // ms away from the app before a Deep Focus plant withers
export const MAX_SW = 180 * 60; // Free focus cap (s)
export const MIN_SW = 10 * 60; // Free focus minimum before anything can be planted (s)
export const PAUSE_MAX = (5 * 60 * 1000) / SPEED; // total pause allowance per session (ms)
const KEY = 'evergrove:v1';

const defaults = () => ({
  coins: 0,
  owned: ['oak', 'pine'],
  ownedSounds: FREE_SOUNDS,
  selected: 'oak',
  sessions: [],
  tags: TAGS,
  settings: { mode: 'timer', deep: true, tag: 'work', haptics: true, sfx: true, awake: true, auto: false, goal: 60, breakMin: 5, sounds: {} },
  active: null,
  harvest: null,
  ach: {},
  quests: { date: dayKey(), claimed: {} },
  claims: {},
  boosts: 0,
  boostDay: '',
  freezes: 0,
  frozen: {},
  onboarded: false,
});

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw) {
      const d = defaults(), s = { ...d, ...raw, settings: { ...d.settings, ...raw.settings } };
      // Drop anything that refers to a species or sound this build does not know, so a stale save cannot crash a screen.
      s.sessions = s.sessions.filter((x) => x && SP[x.species]);
      s.owned = [...new Set(['oak', 'pine', ...s.owned.filter((id) => SP[id])])];
      s.ownedSounds = [...new Set([...FREE_SOUNDS, ...s.ownedSounds.filter((id) => SOUNDS.some((x) => x.id === id))])];
      if (!s.owned.includes(s.selected)) s.selected = 'oak';
      if (s.active && !SP[s.active.species]) s.active = null;
      if (!s.tags.length) s.tags = d.tags;
      return s;
    }
  } catch {}
  return defaults();
}

let state = load();
const subs = new Set();
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };
const commit = (next) => { state = next; persist(); subs.forEach((f) => f()); };
const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };

export const getState = () => state;
export const useStore = () => useSyncExternalStore(subscribe, getState);
export const set = (patch) => commit({ ...state, ...patch });
export const setSetting = (k, v) => commit({ ...state, settings: { ...state.settings, [k]: v } });
export const haptic = (p) => { if (state.settings.haptics) try { navigator.vibrate?.(p); } catch {} };
export const sfx = (k) => state.settings.sfx && audio.chime(k);

/* ---------- derived ---------- */

const dayNum = (k) => Math.round(new Date(`${k}T12:00:00`).getTime() / 864e5);
const minutesIn = (s, a, b) => s.sessions.reduce((n, x) => n + (x.ok && x.end >= a && x.end < b ? x.secs : 0), 0) / 60;

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
    buyable: BUYABLE.filter((x) => s.owned.includes(x.id)).length,
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

// The monthly challenge plus the seasonal event that is running now (or, failing that, the next one).
export function challengesOf(s) {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth(), t = +now;
  const a = +new Date(y, m, 1), b = +new Date(y, m + 1, 1), mk = `m-${y}-${m + 1}`;
  const mv = Math.min(MONTHLY.goal, Math.floor(minutesIn(s, a, b)));
  const monthly = { key: mk, name: `${now.toLocaleDateString('en-SG', { month: 'long' })} challenge`, text: 'Focus for 15 hours this month', v: mv, goal: MONTHLY.goal, shown: `${Math.floor(mv / 60)}h ${mv % 60}m / 15h`, reward: MONTHLY.rewards[(y * 12 + m) % MONTHLY.rewards.length], a, b, active: true, claimed: !!s.claims[mk] };
  const windows = [y, y + 1].flatMap((yr) => EVENTS.map((E) => ({ ...E, key: `e-${E.id}-${yr}`, a: +new Date(yr, E.from[0] - 1, E.from[1]), b: +new Date(yr, E.to[0] - 1, E.to[1] + 1) })));
  const E = windows.filter((w) => w.b > t).sort((p, q) => p.a - q.a)[0];
  const active = t >= E.a;
  const ev = active ? Math.min(E.goal, s.sessions.filter((x) => x.ok && x.end >= E.a && x.end < E.b).length) : 0;
  return { monthly, event: { ...E, text: `Grow ${E.goal} plants during ${E.name}`, v: ev, shown: `${ev} / ${E.goal}`, active, claimed: !!s.claims[E.key] } };
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

/* ---------- session clock ---------- */

// Paused time never counts as focus. The allowance is capped, so a pause left running resumes by itself.
// `|| 0`: sessions started by an older build have no pause fields.
export const pausedTotal = (a, now) => (a.pausedMs || 0) + (a.pausedAt ? Math.max(0, Math.min(now - a.pausedAt, PAUSE_MAX - (a.pausedMs || 0))) : 0);
export const isPaused = (a, now) => !!a.pausedAt && now - a.pausedAt < PAUSE_MAX - (a.pausedMs || 0);
export const pauseLeft = (a, now) => PAUSE_MAX - pausedTotal(a, now);
export const elapsedOf = (a, now) => Math.max(0, ((now - a.start - pausedTotal(a, now)) / 1000) * SPEED);

export function togglePause() {
  const a = state.active, now = Date.now();
  if (!a) return;
  if (a.pausedAt) commit({ ...state, active: { ...a, pausedMs: pausedTotal(a, now), pausedAt: null } });
  else if ((a.pausedMs || 0) < PAUSE_MAX) commit({ ...state, active: { ...a, pausedAt: now } });
}

// Folds an expired pause back into the session so the UI shows it as running again.
export function settlePause() {
  const a = state.active, now = Date.now();
  if (a?.pausedAt && !isPaused(a, now)) commit({ ...state, active: { ...a, pausedMs: PAUSE_MAX, pausedAt: null } });
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

// Pays out one or more grown plants: coins, golden blooms, boost, daily-goal boost, milestones.
function reward(s, drafts, totalMin, at) {
  const before = { streak: streakOf(s), level: levelInfo(xpOf(s)).level, today: todayMinutes(s) };
  const boosted = s.boosts > 0;
  const sessions = drafts.map((d) => ({ ...d, golden: Math.random() < 0.06 + Math.min(d.secs / 60, 120) / 1200, coins: 0 }));
  const golden = sessions.some((x) => x.golden);
  let coins = Math.max(1, Math.round(totalMin * 0.5 * (1 + Math.min(before.streak, 10) * 0.03)));
  if (golden) coins *= 2;
  if (boosted) coins *= 2;
  sessions[0].coins = coins;
  let next = { ...s, sessions: [...s.sessions, ...sessions], coins: s.coins + coins, boosts: s.boosts - (boosted ? 1 : 0) }, unlocked;
  const today = dayKey(), boostEarned = before.today < s.settings.goal && todayMinutes(next) >= s.settings.goal && s.boostDay !== today;
  if (boostEarned) next = { ...next, boosts: next.boosts + 1, boostDay: today };
  [next, unlocked] = award(next, at);
  const streak = streakOf(next), level = levelInfo(xpOf(next));
  return [next, { sessions, session: sessions[0], minutes: totalMin, coins, golden, boosted, boostEarned, unlocked, streak, streakUp: streak > before.streak, level, levelUp: level.level > before.level }];
}

export function startSession(note = '') {
  const { settings: c } = state, now = Date.now(), timer = c.mode === 'timer';
  commit({ ...state, active: { start: now, seen: now, pausedAt: null, pausedMs: 0, planned: timer ? SP[state.selected].min * 60 : MAX_SW, mode: c.mode, species: state.selected, tag: c.tag, note: note.trim(), deep: c.deep } });
}

export const cancelSession = () => commit({ ...state, active: null });

// Liveness marker: lets a relaunch tell "app was killed mid-session" from "still running".
export function heartbeat() {
  if (!state.active) return;
  state = { ...state, active: { ...state.active, seen: Date.now() } };
  persist();
}

// Ends a "Plant a tree" session, or records a withered plant for either mode.
export function finishSession(ok, at = Date.now(), reason) {
  const s = state, a = s.active;
  if (!a) return null;
  const el = elapsedOf(a, at), timer = a.mode === 'timer';
  const secs = Math.round(timer ? (ok ? a.planned : Math.min(el, a.planned)) : Math.min(el, MAX_SW));
  const draft = { id: at, start: a.start, end: at, secs, p: timer ? secs / a.planned : Math.min(1, secs / MIN_SW), species: a.species, tag: a.tag, note: a.note, ok, golden: false, coins: 0, deep: a.deep, mode: a.mode };
  if (!ok) {
    commit({ ...s, active: null, sessions: [...s.sessions, draft] });
    return { sessions: [draft], session: draft, minutes: secs / 60, coins: 0, unlocked: [], reason };
  }
  const [next, r] = reward({ ...s, active: null }, [draft], secs / 60, at);
  commit(next);
  return r;
}

// Ends Free focus. Under the minimum the plant withers; otherwise the minutes wait to be spent on trees.
export function stopFree(at = Date.now(), reason = 'short') {
  const a = state.active;
  if (!a) return null;
  const el = elapsedOf(a, at);
  if (el < MIN_SW) return { failed: finishSession(false, at, reason) };
  commit({ ...state, active: null, harvest: { start: a.start, end: at, secs: Math.round(Math.min(el, MAX_SW)), tag: a.tag, note: a.note, deep: a.deep } });
  return { harvest: true };
}

// Spends harvested minutes on a chosen set of owned species. Unspent minutes still earn coins.
export function confirmHarvest(ids) {
  const s = state, h = s.harvest;
  if (!h || !ids.length || ids.some((id) => !s.owned.includes(id))) return null;
  const used = ids.reduce((n, id) => n + SP[id].min * 60, 0);
  if (used > h.secs) return null;
  const drafts = ids.map((id, i) => ({ id: h.end + i, start: h.start, end: h.end, secs: SP[id].min * 60 + (i === 0 ? h.secs - used : 0), p: 1, species: id, tag: h.tag, note: h.note, ok: true, deep: h.deep, mode: 'stopwatch' }));
  const [next, r] = reward({ ...s, harvest: null }, drafts, h.secs / 60, h.end);
  commit(next);
  return r;
}

export function buy(id) {
  const sp = SP[id];
  if (!sp || sp.exclusive || state.owned.includes(id) || state.coins < sp.price) return false;
  const [next, unlocked] = award({ ...state, coins: state.coins - sp.price, owned: [...state.owned, id], selected: id }, Date.now());
  commit(next);
  return unlocked;
}

export const select = (id) => state.owned.includes(id) && commit({ ...state, selected: id });

export function buySound(id) {
  const snd = SOUNDS.find((x) => x.id === id);
  if (!snd || state.ownedSounds.includes(id) || state.coins < snd.price) return false;
  commit({ ...state, coins: state.coins - snd.price, ownedSounds: [...state.ownedSounds, id] });
  return true;
}

export function buyShield() {
  if (state.coins < SHIELD_PRICE || state.freezes >= MAX_SHIELDS) return false;
  commit({ ...state, coins: state.coins - SHIELD_PRICE, freezes: state.freezes + 1 });
  return true;
}

// Claiming the day's third quest also grants a 2× coin boost for the next session.
export function claimQuest(id) {
  const all = questsOf(state), q = all.find((x) => x.id === id);
  if (!q || !q.done || q.claimed) return null;
  const boost = all.every((x) => x.id === id || x.claimed);
  commit({ ...state, coins: state.coins + q.reward, boosts: state.boosts + (boost ? 1 : 0), quests: { date: dayKey(), claimed: { ...state.quests.claimed, [id]: 1 } } });
  return { reward: q.reward, boost };
}

export function claimChallenge(key) {
  const { monthly, event } = challengesOf(state), c = [monthly, event].find((x) => x.key === key);
  if (!c || !c.active || c.claimed || c.v < c.goal) return null;
  const dupe = state.owned.includes(c.reward);
  const [next] = award({ ...state, claims: { ...state.claims, [key]: 1 }, coins: state.coins + (dupe ? DUPLICATE_REWARD : 0), owned: dupe ? state.owned : [...state.owned, c.reward] }, Date.now());
  commit(next);
  return dupe ? { coins: DUPLICATE_REWARD } : { species: c.reward };
}

export const deleteSession = (id) => commit({ ...state, sessions: state.sessions.filter((x) => x.id !== id) });

export function addTag(name) {
  name = name.trim().slice(0, 16);
  if (!name) return;
  const id = `t${Date.now()}`;
  commit({ ...state, tags: [...state.tags, { id, name, color: TAG_COLORS[state.tags.length % TAG_COLORS.length] }], settings: { ...state.settings, tag: id } });
}

export const isCustomTag = (id) => !TAGS.some((t) => t.id === id);

export function removeTag(id) {
  if (!isCustomTag(id)) return;
  const tags = state.tags.filter((t) => t.id !== id);
  commit({ ...state, tags, settings: { ...state.settings, tag: state.settings.tag === id ? tags[0].id : state.settings.tag } });
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

export const exportData = () => JSON.stringify({ ...state, active: null, harvest: null }, null, 2);

export function importData(text) {
  const raw = JSON.parse(text);
  if (!raw || !Array.isArray(raw.sessions) || !Array.isArray(raw.owned)) throw new Error('bad file');
  const d = defaults(), obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
  commit({
    ...d,
    coins: Math.max(0, +raw.coins || 0),
    owned: [...new Set(['oak', 'pine', ...raw.owned.filter((id) => SP[id])])],
    ownedSounds: [...new Set([...FREE_SOUNDS, ...(Array.isArray(raw.ownedSounds) ? raw.ownedSounds.filter((id) => SOUNDS.some((x) => x.id === id)) : [])])],
    selected: SP[raw.selected] && raw.owned.includes(raw.selected) ? raw.selected : 'oak',
    sessions: raw.sessions.filter((x) => x && Number.isFinite(x.start) && Number.isFinite(x.end) && Number.isFinite(x.secs) && SP[x.species]),
    tags: Array.isArray(raw.tags) && raw.tags.length ? raw.tags.map((t) => ({ id: String(t.id), name: String(t.name).slice(0, 16), color: /^#[0-9a-f]{6}$/i.test(t.color) ? t.color : '#34d399' })) : d.tags,
    settings: { ...d.settings, ...obj(raw.settings) },
    ach: obj(raw.ach),
    claims: obj(raw.claims),
    boosts: Math.max(0, Math.min(9, +raw.boosts || 0)),
    boostDay: typeof raw.boostDay === 'string' ? raw.boostDay : '',
    freezes: Math.max(0, Math.min(MAX_SHIELDS, +raw.freezes || 0)),
    frozen: obj(raw.frozen),
    onboarded: true,
  });
}

export const resetAll = () => commit({ ...defaults(), onboarded: true });
