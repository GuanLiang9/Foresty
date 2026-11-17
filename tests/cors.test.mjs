// The app on github.io calls the API on Vercel, so the browser's CORS preflight must allow every method we use (incl. PUT for /api/state).
import test from 'node:test';
import assert from 'node:assert/strict';
import { cors } from '../server/cors.js';

test('preflight from the Pages origin allows GET, POST and PUT', () => {
  const headers = {};
  const res = { setHeader: (k, v) => { headers[k] = v; }, end() {} };
  assert.equal(cors({ method: 'OPTIONS', headers: { origin: 'https://guanliang9.github.io' } }, res), true);
  for (const m of ['GET', 'POST', 'PUT']) assert.ok(headers['Access-Control-Allow-Methods'].includes(m), m);
});
