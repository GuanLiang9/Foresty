import { getAccount } from './auth';

// Last answers from the server, kept while the app is open ("stale while revalidate"): reopening a view shows the
// previous copy instantly while a fresh one loads. Keyed by account, so signing in as someone else never leaks data.
const seen = new Map();
const keyOf = (k) => `${getAccount().user?.id}:${k}`;
export const remember = (k, v) => { seen.set(keyOf(k), v); return v; };
export const recall = (k) => seen.get(keyOf(k)) ?? null;
