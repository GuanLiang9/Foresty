// Server-only Neon Postgres client.
//
// This file lives outside src/ on purpose: Vite only bundles what src/ imports,
// so DATABASE_URL (which contains the database password) never ships to the browser.
// Import it from Node scripts or serverless functions, never from React components.
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env and paste your Neon connection string.');
}

// `sql` is a tagged template: sql`select * from t where id = ${id}`.
// Values in ${} are sent as query parameters, so they are safe from SQL injection.
// Each call is one HTTPS request to Neon, which suits serverless and scripts.
export const sql = neon(url);
