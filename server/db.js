// Server-only Neon Postgres client.
//
// This file lives outside src/ on purpose: Vite only bundles what src/ imports,
// so DATABASE_URL (which contains the database password) never ships to the browser.
// Import it from Node scripts or the API functions in api/, never from React components.
import { neon } from '@neondatabase/serverless';

let client;

// Returns a `sql` tagged template: sql`select * from t where id = ${id}`.
// Values in ${} are sent as query parameters, so they are safe from SQL injection.
// Each call is one HTTPS request to Neon, which suits serverless functions and scripts.
// Created on first use so a missing env var gives a clear error instead of crashing on import.
export function getSql() {
  if (client) return client;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set. Add it to .env locally, or to Vercel > Settings > Environment Variables.');
  client = neon(url);
  return client;
}
