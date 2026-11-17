// Tiny wrapper for calling our own API (the functions in api/ on Vercel).
// On Vercel the app and API share one domain, so relative URLs like 'api/health' work.
// On GitHub Pages, API_URL points at the Vercel site instead.
// Never put secrets here: everything in src/ is shipped to the browser.
import { getToken } from './auth';

const BASE = import.meta.env.API_URL ? `${import.meta.env.API_URL}/api/` : 'api/';

export async function api(path, { method = 'GET', body } = {}) {
  const token = await getToken();
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`; // lets the API know who you are
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}
