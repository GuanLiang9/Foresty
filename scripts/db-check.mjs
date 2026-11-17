// Quick connection test: npm run db:check
import { sql } from '../server/db.js';

try {
  const [row] = await sql`select version(), now() as server_time, current_database() as db`;
  console.log('Connected to Neon');
  console.log('  database:', row.db);
  console.log('  time:    ', row.server_time);
  console.log('  version: ', row.version.split(',')[0]);
} catch (err) {
  console.error('Could not connect to Neon:', err.message);
  process.exit(1);
}
