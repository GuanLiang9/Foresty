# Evergrove

A focus timer that grows a plant while you stay off your phone. Leave, and it withers. Every session lands in an isometric grove that fills up over days, weeks and years.

Installable PWA, mobile-first, works offline, no account needed. Game data lives in the browser's `localStorage`; signed-in players also get it synced to their account (Vercel + Neon) so a phone and a browser show the same grove.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173, also exposed on your LAN
npm run build    # production build in dist/
npm run preview  # serve the build
```

Add `?demo` to the URL to run time at ×60 (a 25-minute session takes 25 seconds). Useful for trying the whole loop quickly.

## Backend (Vercel + Neon Postgres)

The app is hosted on Vercel, which also runs the backend: every file in `api/` becomes a serverless function at `/api/<name>`. Functions talk to Neon Postgres through `server/db.js`. Game data still lives in `localStorage` first; the backend powers login, leaderboards and cloud sync.

```
phone/browser ──fetch('api/health')──▶ Vercel function (api/health.js) ──SQL over HTTPS──▶ Neon
     (no secrets)                          (reads DATABASE_URL)
```

**Connect the database on Vercel** (no clone needed):
1. Neon Console → project `blue-river-83534589` → **Connect** → copy the **pooled** connection string.
2. Vercel → your project → **Settings → Environment Variables** → add `DATABASE_URL` with that value for Production and Preview.
3. Redeploy, then open `https://<your-app>.vercel.app/api/health`. You should see `{"ok":true,"database":"connected",...}`.

(Alternative: Vercel → **Storage / Integrations → Neon** links the project and sets `DATABASE_URL` for you.)

**Locally:** `cp .env.example .env`, paste the strings, then `npm run db:check`. To run the API functions locally use `npx vercel dev` instead of `npm run dev`.

Only import `server/db.js` from `api/` or `scripts/`, never from `src/`: everything in `src/` is shipped to the browser, and the connection string contains your database password.

### Login and leaderboard (Neon Auth)

Players sign in (email + password) from the **Ranks** tab, see their focus chart and the leaderboard for the last 7 or 30 days, and race friends in **competitions**.

- `src/lib/auth.js` signs people in through `api/auth.js`, a small proxy to Neon Auth. Browsers block Neon Auth's cookie on github.io (third-party cookie), so the proxy talks to Neon Auth server-to-server and gives the app an opaque session token to send as `Authorization: Bearer`.
- `src/lib/sync.js` uploads finished sessions from the past week, with that token, to `POST /api/sessions`.
- `api/sessions.js` checks the token with Neon Auth (`server/auth.js`), sanity-checks each session (max 180 min, not in the future, not longer than the real time that passed) and stores it. Re-sending the same session is ignored.
- `api/leaderboard.js` sums the stored sessions per player.
- Tables (`profiles`, `focus_sessions`) are created automatically on the first API call (`server/schema.js`).

Setup:
1. Copy the **Auth URL** from Neon Console → Auth → Configuration.
2. Vercel → Settings → Environment Variables: add `NEON_AUTH_URL` (and `DATABASE_URL`), then redeploy.
3. GitHub repo → Settings → Secrets and variables → Actions → **Variables**: add `NEON_AUTH_URL` and `API_URL` (your Vercel production URL, e.g. `https://foresty.vercel.app`), then re-run the Deploy workflow.
4. Neon Auth → Domains: add `https://guanliang9.github.io` (and any Vercel URLs you sign in from).

The app at `https://guanliang9.github.io/Foresty/` calls the API on Vercel; `server/cors.js` allows that origin. Without `NEON_AUTH_URL` the leaderboard card is hidden and the app works as before.

Limits: the app can't fully prove a session was honest, since a determined player could craft fake requests within those limits. Fine for friends; for a public leaderboard, sessions would need to be timed on the server.

**Competitions** (`api/competitions.js`): from Ranks → Races, anyone signed in can start a race lasting 1, 3, 7, 14 or 30 days. The creator gets a 6-character invite code to share; friends join with it (up to 50 players). Standings are the total focus time of every finished session that ended inside the race window. When the timer runs out, whoever has the most focus time (ties share the win, and nobody wins if nobody focused) can claim the prize once: 100 coins for a day, 430 for a week, 1280 for a month. The server marks the prize as claimed, so it can't be collected twice, and the app adds the coins to the grove.

Tables: `profiles`, `focus_sessions`, `competitions`, `competition_members`, `game_state` (all created automatically, no migration to run).

### Cloud sync (same grove on phone and browser)

An installed PWA and the same site in a browser have **separate storage** (on iOS too), so a grove only follows you through your account. Signed in, `src/lib/sync.js` keeps one copy of your game per account in the `game_state` table (`api/state.js`: `GET` to pull, `PUT` to save; a save only succeeds if nobody else saved since you pulled, otherwise the app pulls and merges again). It syncs on sign-in, when the app returns to the front, once a minute, and a few seconds after each change. Offline play works as before and uploads later. Nothing extra to set up: the table is created on first use.

Merge rules (`src/lib/merge.js`, tested in `tests/merge.test.mjs`):

| Data | Rule |
| --- | --- |
| Plants and history (sessions), owned plants/sounds, tags, milestones, claimed challenges, shield days | **Union**: everything from both sides is kept; a session is the same one if id, start, end and species match, so it is never duplicated |
| Deleted sessions | Remembered, so deleting on one device is not undone by the other |
| Coins, boosts, shield count | Cloud value **plus only what this device changed since its last sync**, so two devices' earnings add up and nothing is counted twice |
| Settings, selected plant, wish | Last change wins |
| Daily quests | Newer day wins; same day merges claims |
| Running session, unspent harvest, Pomodoro timer | Stay on the device |

An empty side can never wipe a full one. Signing into a *different* account on a device starts that device from the new account's grove, never mixing the two. **Erase all data** only clears the device; signing in again brings the cloud copy back. The leaderboard upload is unchanged and idempotent (same session id means the same row), so merging does not double count.

`npm test` runs the merge rules. `npm run test:e2e` drives two simulated devices in Chromium (sign-up with local data, fresh sign-in, offline then online, simultaneous edits, leaderboard dedupe, account switch) against an in-memory Postgres, with no secrets.


## Friends

Ranks tab, **Friends** view (needs an account).

- Share your 8-character friend code, or enter someone else's. Requests must be accepted; if you both ask, you are friends at once.
- Tap a friend to open their grove: day / week / month focus hours, grown vs withered plants, and their isometric island.
- In **Races**, tap any player in the standings to see their grove for the race window. A progress bar shows how much of the race has passed, and each row shows the gap to the leader.
- Only friends and race mates can view a grove (`server/access.js`). Notes and tags are never sent. Groves come from the synced `game_state`, so they need cloud sync to have run on that player's device.

API: `api/friends.js` (`me`, `list`, `request`, `accept`, `remove`, `grove`). New tables `friendships` and `profiles.friend_code` are created by `ensureSchema()`.

## Put it on your phone

Installing a PWA needs HTTPS, so host the build. The included workflow deploys to GitHub Pages on every push to `main`:

1. Repo **Settings → Pages → Source: GitHub Actions**
2. Re-run the **Deploy** workflow (or push again)
3. Open the Pages URL on the phone → **Add to Home Screen** (iOS: Share menu; Android: Settings → Install inside the app)

## What is in it

| Area | Details |
| --- | --- |
| Plant a tree | Every species has a fixed focus time (10–180 min); rarer trees ask for longer. Pick the tree, finish its time, it is planted |
| Free focus | Open-ended stopwatch. Stop after 10 min and spend the minutes on any mix of owned trees; leftover minutes still earn coins |
| Session controls | Tags, a one-line intention, 10-second cancel window, pause (5 min total per session), hold-to-give-up, optional auto-start after a break |
| Challenges | Monthly 15-hour challenge and seven yearly events, each rewarding a species that cannot be bought (see below). Journey shows an event calendar with countdowns |
| Boosts | 2× coins on the next session, earned by reaching the daily goal or clearing all three daily quests |
| Deep Focus | Leaving the app for more than 10 seconds withers the plant. Screen wake lock keeps the phone from locking mid-session |
| Plants | 33 species drawn procedurally in SVG, each growing from seed to maturity; longer sessions grow bigger plants. Includes a pink garden, festive plants (candy cane, poinsettia, decorated Christmas trees) and the Soulmate pair |
| Rewards | Coins per session, +15 first-bloom bonus for the first plant each day, streak bonus, random golden blooms (double coins), unlockable species |
| Habit loop | Daily streak with purchasable streak shields, daily goal, three rotating daily quests, 22 milestones, levels, a savings goal that tracks coins toward a chosen plant |
| Grove | Day / week / month / year islands, focus totals, time-of-day chart, tag breakdown, session timeline |
| Sound | Eight mixable ambient layers synthesised with Web Audio; three free, five unlocked with coins |
| Extras | Break timer, completion notifications, JSON backup and restore |

## Soulmate pair

The two rarest trees in the grove, marked with a shimmering **Soulmate** label and a glowing tile in the Nursery.

| Tree | Price | Session | Look |
| --- | --- | --- | --- |
| Bobo’s Heart | 3000 coins | 120 min | Pink heart canopy, gold rim and crown |
| Jobo’s Heart | 2800 coins | 120 min | Blue heart canopy, gold rim and crown |

Both beat like a heart, pulse a soft halo, and have orbiting lights, twinkling sparkles and rising hearts. Each links to its other half in the Nursery. Milestones: grow either one (+300 each), grow both for **Soulmates** (+600).

## Events and exclusive plants

Exclusive plants cannot be bought. Each event repeats every year (dates inclusive); the Nursery shows where each one comes from.

| Event | Dates | Goal | Reward |
| --- | --- | --- | --- |
| Lunar Spring | 15 Jan – 8 Feb | Grow 12 plants | Lucky Mandarin |
| Sweethearts | 9 – 28 Feb | Grow 10 plants | Cupid’s Heart |
| Spring Bloom | 10 Mar – 10 Apr | Grow 12 plants | Petal Willow |
| Midsummer | 10 Jun – 10 Jul | Grow 12 plants | Sun Spire |
| Ember Days | 5 – 30 Nov | Grow 12 plants | Starpine |
| Winter Lights | 1 – 18 Dec | Grow 12 plants | Frostcap |
| Christmas | 19 – 31 Dec | Grow 8 plants | Pink Noel |
| Monthly challenge | Every month | Focus 15 hours | Lantern Maple, Tide Palm, Rose Cactus (rotating) |

An exclusive plant you already own pays 300 coins instead.

## Platform limits worth knowing

- A web app cannot see which other app you opened, only that this one was hidden. Locking the screen counts as leaving, which is why the wake lock is on by default.
- iOS does not expose vibration to web apps, and only delivers notifications to an installed PWA.
- Without an account nothing syncs between devices. Sign in (Ranks tab) to sync, or use Settings → Backup to move a grove by file.

## Stack

React 18, Vite, Tailwind CSS 3, lucide-react. No runtime dependencies beyond those. Icons are generated by `npm run icons`.
