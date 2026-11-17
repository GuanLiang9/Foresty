// Uploads finished sessions from the last week so they count on the leaderboard.
// Game data still lives on the device; this only sends a copy of recent completed plants.
import { getState, SPEED } from '../store';
import { getAccount } from './auth';
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
