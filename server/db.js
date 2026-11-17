// Server-only Neon Postgres client.
//
// This file lives outside src/ on purpose: Vite only bundles what src/ imports,
// so DATABASE_URL (which contains the database password) never ships to the browser.
// Import it from Node scripts or the API functions in api/, never from React components.
import { neon } from '@neondatabase/serverless';

let client;

// Vercel's Neon integration sets DATABASE_URL, and also POSTGRES_URL on some setups.
export function databaseUrl() {
  return (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim().replace(/^['"]|['"]$/g, '');
}

// Returns a `sql` tagged template: sql`select * from t where id = ${id}`.
// Values in ${} are sent as query parameters, so they are safe from SQL injection.
// Each call is one HTTPS request to Neon, which suits serverless functions and scripts.
// Created on first use so a missing env var gives a clear error instead of crashing on import.
export function getSql() {
  if (client) return client;
  const url = databaseUrl();
  if (!url) throw new Error('DATABASE_URL is not set. Add it to .env locally, or to Vercel > Settings > Environment Variables.');
  client = neon(url);
  return client;
}

// Tests swap in a local database client here; the app never calls this.
export function setSqlForTests(fake) { client = fake; }
