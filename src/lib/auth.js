// Sign-in state for the app, backed by Neon Auth.
//
// The auth URL is public (it is like a login page address), so it is fine in the browser bundle.
// The Neon Auth library is loaded only when needed, keeping the first load fast and offline-friendly.
import { useSyncExternalStore } from 'react';

const AUTH_URL = import.meta.env.VITE_NEON_AUTH_URL;
export const authEnabled = Boolean(AUTH_URL);

let clientPromise;
const client = () => (clientPromise ??= import('@neondatabase/auth').then((m) => m.createAuthClient(AUTH_URL)));

// { status: 'off' | 'loading' | 'out' | 'in', user }
let account = { status: authEnabled ? 'loading' : 'off', user: null };
const subs = new Set();
const setAccount = (next) => { account = next; subs.forEach((f) => f()); };
export const useAccount = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => account);
export const getAccount = () => account;

export async function refreshAccount() {
  if (!authEnabled) return account;
  try {
    const res = await (await client()).getSession();
    const user = res?.data?.user || res?.user || null;
    setAccount(user ? { status: 'in', user } : { status: 'out', user: null });
  } catch {
    // Offline or auth unreachable: keep whatever we knew, but stop showing a spinner.
    if (account.status === 'loading') setAccount({ status: 'out', user: null });
  }
  return account;
}

// Better Auth returns { data, error } instead of throwing; turn errors into exceptions with readable text.
const check = (r) => { if (r?.error) throw new Error(r.error.message || 'Something went wrong'); return r; };

export async function signIn(email, password) {
  check(await (await client()).signIn.email({ email, password }));
  return refreshAccount();
}

export async function signUp(name, email, password) {
  check(await (await client()).signUp.email({ name, email, password }));
  return refreshAccount();
}

export async function signOut() {
  try { await (await client()).signOut(); } catch {}
  setAccount({ status: 'out', user: null });
}

// The short-lived token our API checks to know who is calling. Null when signed out.
export async function getToken() {
  if (!authEnabled || account.status !== 'in') return null;
  try { return (await (await client()).getJWTToken?.()) || null; } catch { return null; }
}
