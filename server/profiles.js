import { getSql } from './db.js';

// The name shown on leaderboards: the sign-up name, else the part of the email before "@".
export function displayName(user) {
  const n = (user.name || '').trim() || (user.email || '').split('@')[0] || 'Grower';
  return n.replace(/\s+/g, ' ').slice(0, 24);
}

// Makes sure the signed-in user has a profile row (needed before they own sessions or join competitions).
// Returns a query that has not run yet: await it, or pass it to sql.transaction([...]) together with the
// write that needs it, so both reach Neon in one round trip.
// The "where" skips the write when the name has not changed, so the common case touches nothing on disk.
export function upsertProfile(user) {
  return getSql()`insert into profiles (user_id, display_name) values (${user.id}, ${displayName(user)})
    on conflict (user_id) do update set display_name = excluded.display_name, updated_at = now()
    where profiles.display_name is distinct from excluded.display_name`;
}
