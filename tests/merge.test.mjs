// Run: npm test   (rules in src/lib/merge.js)
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeDocs, toDoc, applyDoc, skey } from '../src/lib/merge.js';

const S = (id, species = 'oak', secs = 1500) => ({ id, start: id - secs * 1000, end: id, secs, species, ok: true, tag: 'work', p: 1, golden: false, coins: 0 });
const T0 = 1_700_000_000_000;
const doc = (o = {}) => ({
  v: 1, coins: 0, boosts: 0, freezes: 0, boostDay: '', owned: ['oak', 'pine'], ownedSounds: [], tags: [{ id: 'work', name: 'Work', color: '#34d399' }],
  sessions: [], deleted: [], ach: {}, claims: {}, frozen: {}, quests: { date: '2026-11-17', claimed: {} },
  prefs: { at: 0, settings: { goal: 60 }, selected: 'oak', wish: null }, onboarded: false, ...o,
});

test('fresh device pulls everything from the cloud', () => {
  const cloud = doc({ coins: 500, owned: ['oak', 'pine', 'sun'], sessions: [S(T0), S(T0 + 9e6)], prefs: { at: 5, settings: { goal: 90 }, selected: 'sun', wish: null } });
  const m = mergeDocs(doc(), cloud, {});
  assert.equal(m.sessions.length, 2); assert.equal(m.coins, 500); assert.ok(m.owned.includes('sun'));
  assert.equal(m.prefs.settings.goal, 90); assert.equal(m.prefs.selected, 'sun');
});

test('PWA with data signs in to an empty account: nothing lost, cloud gets it all', () => {
  const local = doc({ coins: 300, sessions: [S(T0), S(T0 + 9e6)], owned: ['oak', 'pine', 'cactus'] });
  const m = mergeDocs(local, null, {});
  assert.equal(m.sessions.length, 2); assert.equal(m.coins, 300); assert.deepEqual(m.owned.sort(), ['cactus', 'oak', 'pine']);
});

test('two devices that never synced: sessions union, coins add, no duplicates', () => {
  const shared = S(T0), a = S(T0 + 1e7), b = S(T0 + 2e7);
  const phone = doc({ coins: 100, sessions: [shared, a] }), cloud = doc({ coins: 70, sessions: [shared, b] });
  const m = mergeDocs(phone, cloud, {});
  assert.equal(m.sessions.length, 3); assert.equal(m.coins, 170);
  // merging again with the result is stable (idempotent)
  const again = mergeDocs(m, m, { coins: 170 });
  assert.deepEqual(again.sessions, m.sessions); assert.equal(again.coins, 170);
});

test('counters add only this device\'s own changes since last sync', () => {
  // cloud 200 (other device earned +50 since), this device was at 150 when it last synced and spent 40 -> 110
  const m = mergeDocs(doc({ coins: 110 }), doc({ coins: 200 }), { coins: 150 });
  assert.equal(m.coins, 160);
  assert.equal(mergeDocs(doc({ coins: 0 }), doc({ coins: 10 }), { coins: 500 }).coins, 0); // never negative
});

test('an empty device never wipes a non-empty cloud', () => {
  const cloud = doc({ coins: 900, sessions: [S(T0)], owned: ['oak', 'pine', 'bamboo'], ach: { first: 1 } });
  const m = mergeDocs(doc(), cloud, {});
  assert.equal(m.coins, 900); assert.equal(m.sessions.length, 1); assert.ok(m.owned.includes('bamboo')); assert.deepEqual(m.ach, { first: 1 });
});

test('deleting a session sticks (tombstone) and union does not resurrect it', () => {
  const x = S(T0), y = S(T0 + 1e7);
  const m = mergeDocs(doc({ sessions: [y], deleted: [skey(x)] }), doc({ sessions: [x, y] }), {});
  assert.deepEqual(m.sessions.map((s) => s.id), [y.id]);
});

test('settings: newest change wins; selected plant must be owned', () => {
  const m = mergeDocs(doc({ prefs: { at: 10, settings: { goal: 30 }, selected: 'oak', wish: null } }), doc({ prefs: { at: 20, settings: { goal: 45 }, selected: 'pine', wish: null } }), {});
  assert.equal(m.prefs.settings.goal, 45); assert.equal(m.prefs.selected, 'pine');
  const bad = mergeDocs(doc({ prefs: { at: 9, settings: {}, selected: 'sun', wish: null } }), doc({ prefs: { at: 1, settings: {}, selected: 'oak', wish: null } }), {});
  assert.equal(bad.prefs.selected, 'oak'); // 'sun' is not owned
});

test('quests: newer day wins, same day unions claims', () => {
  const m1 = mergeDocs(doc({ quests: { date: '2026-11-18', claimed: { a: 1 } } }), doc({ quests: { date: '2026-11-17', claimed: { b: 1 } } }), {});
  assert.deepEqual(m1.quests, { date: '2026-11-18', claimed: { a: 1 } });
  const m2 = mergeDocs(doc({ quests: { date: '2026-11-17', claimed: { a: 1 } } }), doc({ quests: { date: '2026-11-17', claimed: { b: 1 } } }), {});
  assert.deepEqual(m2.quests.claimed, { a: 1, b: 1 });
});

test('two trees of one species from the same harvest are both kept', () => {
  const a = { ...S(T0), id: T0 }, b = { ...S(T0), id: T0 + 1 };
  assert.equal(mergeDocs(doc({ sessions: [a, b] }), null, {}).sessions.length, 2);
});

test('applyDoc leaves the running session alone', () => {
  const s = { ...doc(), settings: { goal: 60 }, selected: 'oak', wish: null, active: { start: 1 }, harvest: { a: 1 }, pomo: { round: 2 } };
  const out = applyDoc(s, mergeDocs(toDoc(s), doc({ coins: 5 }), {}));
  assert.deepEqual(out.active, { start: 1 }); assert.deepEqual(out.pomo, { round: 2 }); assert.equal(out.coins, 5);
});
