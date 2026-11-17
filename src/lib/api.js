// Tiny wrapper for calling our own API (the functions in api/ on Vercel).
// The app and API share one domain, so relative URLs like 'api/health' just work.
// Never put secrets here: everything in src/ is shipped to the browser.

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`api/${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}
