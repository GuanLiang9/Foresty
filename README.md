# Evergrove

A focus timer that grows a plant while you stay off your phone. Leave, and it withers. Every session lands in an isometric grove that fills up over days, weeks and years.

Installable PWA, mobile-first, works offline, no account, no backend. All data stays in the browser's `localStorage`.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173, also exposed on your LAN
npm run build    # production build in dist/
npm run preview  # serve the build
```

Add `?demo` to the URL to run time at ×60 (a 25-minute session takes 25 seconds). Useful for trying the whole loop quickly.

## Database (Neon Postgres)

The app still runs fully on `localStorage`. A Neon Postgres connection is wired in for server-side code, ready for syncing data later.

1. In the [Neon Console](https://console.neon.tech), open project `blue-river-83534589` and click **Connect** to copy the connection strings.
2. `cp .env.example .env` and paste them into `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct).
3. `npm run db:check` should print `Connected to Neon`.

`server/db.js` exports a `sql` client. Only import it from Node scripts or serverless functions, never from `src/`: the connection string contains your database password, and anything in `src/` ends up in the public browser bundle.

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
- Nothing syncs between devices. Use Settings → Backup to move a grove.

## Stack

React 18, Vite, Tailwind CSS 3, lucide-react. No runtime dependencies beyond those. Icons are generated by `npm run icons`.
