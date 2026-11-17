// Creates the leaderboard tables the first time the API runs (safe to run again: "if not exists").
// That way there is no separate migration step to remember.
import { getSql } from './db.js';

let ready;

export function ensureSchema() {
  ready ??= (async () => {
    const sql = getSql();
    // One row per signed-in player. user_id is the Neon Auth user id (the JWT "sub").
    await sql`create table if not exists profiles (
      user_id text primary key,
      display_name text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`;
    // One row per finished focus session. client_id is the app's own id for the session,
    // so sending the same session twice is harmless (the primary key ignores the copy).
    await sql`create table if not exists focus_sessions (
      user_id text not null references profiles(user_id) on delete cascade,
      client_id text not null,
      species text,
      started_at timestamptz not null,
      ended_at timestamptz not null,
      seconds integer not null check (seconds between 60 and 10800),
      created_at timestamptz not null default now(),
      primary key (user_id, client_id)
    )`;
    await sql`create index if not exists focus_sessions_ended_at_idx on focus_sessions (ended_at)`;
    // A friendly competition: everyone who joins races on focus time between starts_at and ends_at.
    await sql`create table if not exists competitions (
      id bigint generated always as identity primary key,
      code text not null unique,
      name text not null,
      created_by text not null references profiles(user_id) on delete cascade,
      starts_at timestamptz not null,
      ends_at timestamptz not null,
      reward integer not null,
      created_at timestamptz not null default now()
    )`;
    await sql`create table if not exists competition_members (
      competition_id bigint not null references competitions(id) on delete cascade,
      user_id text not null references profiles(user_id) on delete cascade,
      joined_at timestamptz not null default now(),
      reward_claimed_at timestamptz,
      primary key (competition_id, user_id)
    )`;
    await sql`create index if not exists competition_members_user_idx on competition_members (user_id)`;
  })().catch((err) => { ready = null; throw err; });
  return ready;
}
