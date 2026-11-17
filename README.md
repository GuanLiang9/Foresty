# Evergrove

A focus timer that grows a plant while you stay off your phone. Leave, and it withers. Every session lands in an isometric grove that fills up over days, weeks and years.

Installable PWA, mobile-first, works offline, no account needed. Game data stays in the browser's `localStorage`. Signing in is optional and only adds the leaderboard.

**Live app:** https://guanliang9.github.io/Foresty/

## Focus modes

The Focus screen has three modes:

| Mode | How it works |
| --- | --- |
| Plant a tree | Pick a tree; it sets its own focus time (10–180 min). Finish it and it is planted |
| Pomodoro | Focus rounds with short and long breaks (see below). Each finished round grows one tree |
| Free focus | Open-ended stopwatch. Stop after 10 min and spend the minutes on any mix of owned trees |

### Pomodoro

The classic cycle: **25 min focus → 5 min short break**, repeated, with a **15 min long break after every 4 rounds**. The timer icon next to the tree picker opens its settings:

| Setting | Default | Range |
| --- | --- | --- |
| Focus | 25 min | 5–90 min |
| Short break | 5 min | 1–30 min |
| Long break | 15 min | 5–45 min |
| Long break after | 4 rounds | 2–8 rounds |
| Auto-start breaks | On | The break clock starts the moment a round ends |
| Auto-start next round | Off | Only while the app is open, so a round never starts without you |

There is also a **Reset cycle** button to go back to round 1.

- A finished round is a normal session, so it earns coins, counts for streaks, quests and levels, and is uploaded to the leaderboard.
- A round grows your selected tree only if the tree fits in the round (a 120-min tree can't grow in a 25-min round). Otherwise it grows the biggest tree you own that fits. Rare, long trees still need long focus.
- Breaks are timed from an end timestamp, not by counting ticks, so they stay correct if the phone sleeps or the tab is in the background.

## Run it locally

```bash
npm install
npm run dev      # http://localhost:5173, also exposed on your LAN
npm run build    # production build in dist/
npm run preview  # serve the build
```

Add `?demo` to the URL (e.g. `http://localhost:5173/?demo`) to run time at ×60: a 25-minute round takes 25 seconds and a 5-minute break takes 5. Good for trying the whole Pomodoro cycle quickly. Demo sessions are never uploaded to the leaderboard.

`npm run dev` only serves the app. Without the env vars below, sign-in and the leaderboard are hidden and everything else works. To run the API too, see [Backend: local development](#local-development).

## How it fits together

```
          ┌─────────────────────────────┐
 phone ──▶│ GitHub Pages                │  the app (static files, no secrets)
          │ guanliang9.github.io/Foresty│
          └──────────────┬──────────────┘
                         │ fetch(API_URL + '/api/...')   (CORS allowed by server/cors.js)
                         ▼
          ┌─────────────────────────────┐
          │ Vercel serverless functions │  api/*.js, reads DATABASE_URL + NEON_AUTH_URL
          └───────┬─────────────┬───────┘
                  │ SQL (HTTPS) │ sign-in, server to server
                  ▼             ▼
            Neon Postgres    Neon Auth
```

- **Frontend: GitHub Pages.** `.github/workflows/deploy.yml` builds and deploys on every push to `main`. The app stays here so installed home-screen copies keep working.
- **API: Vercel.** Every file in `api/` becomes a function at `/api/<name>`. Vercel builds the same repo, so it also serves a copy of the app, but the GitHub Pages copy is the main one.
- **Database and login: Neon.** Postgres for the leaderboard data, Neon Auth for email + password accounts.

**The rule about secrets:** `DATABASE_URL` contains your database password, so it only lives in Vercel's env vars and is only read by code in `server/` and `api/`. Everything in `src/` is shipped to the browser, so `src/` never imports `server/db.js`. The two values baked into the browser build (`NEON_AUTH_URL`, `API_URL`) are public URLs, not secrets.

### API endpoints

| Endpoint | What it does |
| --- | --- |
| `GET /api/health` | Checks the API can reach Neon. Returns `{"ok":true,"database":"connected",...}`, or a plain-English reason it can't (without leaking the password) |
| `/api/auth?op=sign-up\|sign-in\|sign-out\|session` | Proxy to Neon Auth (see below) |
| `POST /api/sessions` | A signed-in player uploads finished sessions from the last week |
| `GET /api/leaderboard?period=week\|month` | Top players by focus time over 7 or 30 days, with your own rank if signed in |

Shared server code lives in `server/`: `db.js` (Neon client, `getSql()`), `auth.js` (session checks), `cors.js` (which sites may call the API), `schema.js` (creates the `profiles` and `focus_sessions` tables on first use, so there is no migration step).

### Login (Neon Auth through the Vercel API)

Players sign up or sign in with email + password from **Journey → Leaderboard**.

The browser never talks to Neon Auth directly. Neon Auth keeps you signed in with a cookie, but the app is on `github.io` and Neon Auth on `neon.tech`, so browsers block that cookie as a third-party cookie. Instead:

1. `src/lib/auth.js` calls `api/auth.js` on Vercel.
2. `api/auth.js` talks to Neon Auth server to server, where cookies just work, and packs Neon's cookies into one opaque token (`s1.…`).
3. The app keeps that token in `localStorage` and sends it as `Authorization: Bearer <token>`.
4. `server/auth.js` checks the token with Neon Auth on every API call that needs a user.

### Leaderboard

Under **Journey → Leaderboard**, with a 7-day and a 30-day view.

- `src/lib/sync.js` uploads your completed sessions from the past week (Plant a tree, Pomodoro and Free focus all count; withered ones don't).
- `api/sessions.js` sanity-checks each one (1–180 min, not in the future, not longer than the real time that passed) and stores it. Sending the same session twice is ignored.
- `api/leaderboard.js` sums focus time per player and ranks them (ties share a rank).

Limit: the server can't fully prove a session was honest, since a determined player could craft fake requests within those checks. Fine for friends; a public leaderboard would need sessions timed on the server.

**Planned (not merged yet):** a Leaderboard tab in the nav bar, charts, and timed competitions with winner rewards.

## Setup

### 1. Environment variables

| Name | Where to set it | Value | Secret? |
| --- | --- | --- | --- |
| `DATABASE_URL` | Vercel | Neon **pooled** connection string (host contains `-pooler`) | **Yes** |
| `NEON_AUTH_URL` | Vercel **and** GitHub Actions variable | Neon Console → Auth → Configuration → Auth URL | No |
| `API_URL` | GitHub Actions variable | Your Vercel production URL, e.g. `https://foresty.vercel.app` (no trailing slash) | No |
| `ALLOWED_ORIGINS` | Vercel (optional) | Extra sites allowed to call the API, comma-separated, e.g. `http://localhost:5173`. GitHub Pages is always allowed | No |

`vite.config.js` reads `NEON_AUTH_URL` and `API_URL` without the usual `VITE_` prefix, so the same names work on Vercel and in GitHub Actions. If `NEON_AUTH_URL` is missing from the build, the leaderboard card is simply hidden.

### 2. Neon

1. Neon Console → your project → **Connect** → copy the **pooled** connection string. That is `DATABASE_URL`.
2. Neon Console → **Auth** → enable it and copy the **Auth URL**. That is `NEON_AUTH_URL`.
3. Neon Auth → **Domains**: add `https://guanliang9.github.io` and any Vercel URLs you sign in from.

### 3. Vercel (the API)

1. Import the GitHub repo into Vercel.
2. **Settings → Environment Variables**: add `DATABASE_URL` and `NEON_AUTH_URL`, ticking both **Production** and **Preview**.
3. **Redeploy**. New env vars only apply to new deployments.
4. Open `https://<your-app>.vercel.app/api/health`. You should see `"database":"connected"`.

(Alternative for step 2: Vercel → **Storage / Integrations → Neon** links the project and sets `DATABASE_URL` for you.)

### 4. GitHub Pages (the app)

1. Repo **Settings → Pages → Source: GitHub Actions**.
2. Repo **Settings → Secrets and variables → Actions → Variables** tab: add `NEON_AUTH_URL` and `API_URL`. Use **Variables**, not Secrets; these get baked into public files anyway.
3. Push to `main`, or run the **Deploy** workflow from the Actions tab.
4. On your phone, open the Pages URL → **Add to Home Screen** (iOS: Share menu; Android: Settings → Install inside the app). Installing a PWA needs HTTPS, which Pages gives you.

### Local development

```bash
cp .env.example .env   # paste DATABASE_URL and NEON_AUTH_URL; .env is gitignored
npm run db:check       # prints "Connected to Neon" if DATABASE_URL works
npx vercel dev         # runs the app and the api/ functions together
```

With `vercel dev` the app and API share one address, so `API_URL` isn't needed. Never commit `.env`.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `/api/health` says `DATABASE_URL is not set` | Add it in Vercel for Production and Preview, then redeploy |
| Leaderboard card doesn't show on GitHub Pages | `NEON_AUTH_URL` wasn't set when the app was built. Add the Actions variable, then deploy again |
| App on Pages can't reach the API | Check the `API_URL` variable is your Vercel URL with no trailing slash, then deploy again |
| Pages still shows old code after a fix | The Deploy workflow cancels older runs when a new one starts, and **re-running an old run deploys that old commit**. Re-run the newest run on `main`, or start a fresh one with **Run workflow** |
| Sign-in fails with a domain/origin error | Add the site to Neon Auth → Domains |

## What is in it

| Area | Details |
| --- | --- |
| Focus modes | Plant a tree, Pomodoro and Free focus (see above). Free focus leftover minutes still earn coins |
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
- Your grove doesn't sync between devices (only leaderboard totals go to the server). Use Settings → Backup to move a grove.

## Stack

- **App:** React 18, Vite, Tailwind CSS 3, lucide-react. Icons are generated by `npm run icons`.
- **API:** Vercel serverless functions (Node), `@neondatabase/serverless` for SQL, `jose` for token checks.
- **Data:** Neon Postgres and Neon Auth.
