// Sign-in state for the app, backed by Neon Auth.
//
// The auth URL is public (it is like a login page address), so it is fine in the browser bundle.
// The Neon Auth library is loaded only when needed, keeping the first load fast and offline-friendly.
import { useSyncExternalStore } from 'react';

const AUTH_URL = import.meta.env.NEON_AUTH_URL;
export const authEnabled = Boolean(AUTH_URL);

// The app (github.io) and Neon Auth live on different sites, so browsers (Safari especially)
// block Neon Auth's login cookie as a "third-party cookie". Instead we keep the session token
// ourselves and send it as an "Authorization: Bearer" header on every auth request.
const TOKEN_KEY = 'evergrove:auth-token';
const readToken = () => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };
const saveToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {} };

let clientPromise;
// The options go to the adapter: createAuthClient's own fetchOptions only forwards headers.
const client = () => (clientPromise ??= Promise.all([import('@neondatabase/auth'), import('@neondatabase/auth/vanilla/adapters')])
  .then(([{ createAuthClient }, { BetterAuthVanillaAdapter }]) => createAuthClient(AUTH_URL, {
    adapter: BetterAuthVanillaAdapter({
      fetchOptions: {
        auth: { type: 'Bearer', token: readToken },
        // Neon Auth returns a fresh session token in this header after sign-in.
        onSuccess: (ctx) => { const t = ctx.response.headers.get('set-auth-token'); if (t) saveToken(t); },
      },
    }),
  })));

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

// Sign-in also returns the session token in the response body; keep it in case the header was hidden.
async function finishSignIn(r) {
  check(r);
  if (r?.data?.token) saveToken(r.data.token);
  const acc = await refreshAccount();
  // Never claim success unless the session really stuck.
  if (acc.status !== 'in') throw new Error('Signed in, but this browser did not keep the session. Try again, or allow cookies for this site.');
  return acc;
}

export async function signIn(email, password) {
  return finishSignIn(await (await client()).signIn.email({ email, password }));
}

export async function signUp(name, email, password) {
  return finishSignIn(await (await client()).signUp.email({ name, email, password }));
}

export async function signOut() {
  try { await (await client()).signOut(); } catch {}
  saveToken('');
  setAccount({ status: 'out', user: null });
}

// The short-lived token our API checks to know who is calling. Null when signed out.
export async function getToken() {
  if (!authEnabled || account.status !== 'in') return null;
  try {
    const jwt = await (await client()).getJWTToken?.();
    if (jwt) return jwt;
  } catch {}
  // Fallback: ask Neon Auth directly, proving who we are with the stored session token.
  try {
    const res = await fetch(`${AUTH_URL.replace(/\/+$/, '')}/token`, { headers: { Authorization: `Bearer ${readToken()}` } });
    return res.ok ? (await res.json())?.token || null : null;
  } catch { return null; }
}
