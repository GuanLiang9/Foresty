// Sign-in state for the app, backed by Neon Auth through our own API (/api/auth).
//
// The browser never talks to Neon Auth directly: the app is on github.io and Neon Auth on
// neon.tech, and browsers block Neon Auth's login cookie there. Our API does the talking and
// hands back an opaque session token, which we keep in localStorage and send as
// "Authorization: Bearer <token>". Nothing here is secret beyond that per-user token.
import { useSyncExternalStore } from 'react';

export const authEnabled = Boolean(import.meta.env.NEON_AUTH_URL);
const BASE = import.meta.env.API_URL ? `${import.meta.env.API_URL}/api/` : 'api/';

const TOKEN_KEY = 'evergrove:session';
const readToken = () => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };
const saveToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {} };

// { status: 'off' | 'loading' | 'out' | 'in', user }
let account = { status: authEnabled ? 'loading' : 'off', user: null };
const subs = new Set();
const setAccount = (next) => { account = next; subs.forEach((f) => f()); };
export const useAccount = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => account);
export const getAccount = () => account;

async function call(op, { method = 'GET', body } = {}) {
  const headers = {};
  const token = readToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}auth?op=${op}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

export async function refreshAccount() {
  if (!authEnabled) return account;
  if (!readToken()) { setAccount({ status: 'out', user: null }); return account; }
  try {
    const r = await call('session');
    if (r.ok && r.data?.user) {
      if (r.data.token) saveToken(r.data.token); // Neon Auth may refresh the session
      setAccount({ status: 'in', user: r.data.user });
    } else {
      if (r.ok || r.status === 401) saveToken(''); // session ended
      setAccount({ status: 'out', user: null });
    }
  } catch {
    // Offline: keep whatever we knew, but stop showing a spinner.
    if (account.status === 'loading') setAccount({ status: 'out', user: null });
  }
  return account;
}

async function start(op, body) {
  saveToken('');
  const r = await call(op, { method: 'POST', body });
  if (!r.ok) throw new Error(r.data?.error || 'Something went wrong');
  if (r.data?.token) saveToken(r.data.token);
  const acc = await refreshAccount();
  // Never claim success unless the session really stuck.
  if (acc.status !== 'in') throw new Error('Signed in, but the session could not be confirmed. Please try again.');
  return acc;
}

export const signIn = (email, password) => start('sign-in', { email, password });
export const signUp = (name, email, password) => start('sign-up', { name, email, password });

export async function signOut() {
  try { await call('sign-out', { method: 'POST', body: {} }); } catch {}
  saveToken('');
  setAccount({ status: 'out', user: null });
}

// The token our API uses to know who is calling. Null when signed out.
export const getToken = async () => (authEnabled && account.status === 'in' ? readToken() || null : null);
