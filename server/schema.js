// Creates the leaderboard tables the first time the API runs (safe to run again: "if not exists").
// That way there is no separate migration step to remember.
//
// Speed: this runs once per server instance ("cold start"). All statements go to Neon as ONE
// transaction, so it costs one network round trip instead of one per statement.
import { getSql } from './db.js';

let ready;

const statements = (sql) => [
  // One row per signed-in player. user_id is the Neon Auth user id (the JWT "sub").
  sql`create table if not exists profiles (
    user_id text primary key,
    display_name text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  // One row per finished focus session. client_id is the app's own id for the session,
  // so sending the same session twice is harmless (the primary key ignores the copy).
  sql`create table if not exists focus_sessions (
    user_id text not null references profiles(user_id) on delete cascade,
    client_id text not null,
    species text,
    started_at timestamptz not null,
    ended_at timestamptz not null,
    seconds integer not null check (seconds between 60 and 10800),
    created_at timestamptz not null default now(),
    primary key (user_id, client_id)
  )`,
  sql`create index if not exists focus_sessions_ended_at_idx on focus_sessions (ended_at)`,
  // A friendly competition: everyone who joins races on focus time between starts_at and ends_at.
  sql`create table if not exists competitions (
    id bigint generated always as identity primary key,
    code text not null unique,
    name text not null,
    created_by text not null references profiles(user_id) on delete cascade,
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    reward integer not null,
    created_at timestamptz not null default now()
  )`,
  sql`create table if not exists competition_members (
    competition_id bigint not null references competitions(id) on delete cascade,
    user_id text not null references profiles(user_id) on delete cascade,
    joined_at timestamptz not null default now(),
    reward_claimed_at timestamptz,
    primary key (competition_id, user_id)
  )`,
  // One row per player: their whole game (plants, history, coins, settings) so every device can sync.
  // version goes up by one on every save; a save only works if the sender saw the latest version.
  sql`create table if not exists game_state (
    user_id text primary key references profiles(user_id) on delete cascade,
    data jsonb not null,
    version integer not null default 1,
    updated_at timestamptz not null default now()
  )`,
  sql`create index if not exists competition_members_user_idx on competition_members (user_id)`,
  // Speeds up "my focus per day" on the leaderboard and race standings: both look up one player's
  // sessions in a time window. The index holds the seconds too, so Postgres never reads the table.
  sql`create index if not exists focus_sessions_user_ended_idx on focus_sessions (user_id, ended_at) include (seconds)`,
];

export function ensureSchema() {
  ready ??= (async () => {
    const sql = getSql();
    try {
      await sql.transaction(statements(sql));
    } catch (err) {
      // Two brand-new server instances creating the same table at the same moment can clash once; the retry sees it exists.
      if (!/already exists|duplicate key/i.test(String(err?.message))) throw err;
      await sql.transaction(statements(sql));
    }
  })().catch((err) => { ready = null; throw err; });
  return ready;
}
