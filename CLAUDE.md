# The Long Game — Complete Project Briefing for Claude Code

## IMPORTANT: Read This First
This document contains everything you need to know about this project. Read it completely before writing any code or making any suggestions. Every decision in here has been carefully discussed and agreed upon with Nick (the owner). Do not deviate from these decisions without explicitly asking first. When in doubt, ask Nick.

When starting a session say: "I've read CLAUDE.md and I'm ready to continue."

---

## Project Overview

**App Name:** The Long Game
**Type:** iOS and Android mobile app (React Native / Expo)
**Purpose:** NFL picks app where users predict winners of each week's games and compete on leaderboards
**Current Status:** Phase 4 COMPLETE. Phase 5 mostly done (Activity panel + Admin dashboard built). Push notifications + EAS build + Google/Apple Sign-In remain before launch.
**Railway URL:** https://thelonggame-production.up.railway.app
**Target Launch:** Before NFL Season 2026 (starts September 4, 2026)
**Owner:** Nick (Corums) — GitHub: corumnick-oss — Windows 11 — iPhone user — Admin team name: Nicholas
**Local Code Path:** C:\Dev\TheLongGame

---

## LAUNCH STRATEGY — Read This First

### The Plan
- **Do NOT wait for preseason to submit to the App Store**
- Submit to Apple and Google in **late July** — well before preseason starts August 7
- Use **preseason (Aug 7-28) to polish** with OTA updates while app is already live
- Regular season starts **September 4, 2026** — hard deadline

### Why This Works — 3 Ways to Push Updates
1. **OTA Updates (Expo Updates)** — INSTANT, no App Store review needed. Covers 95% of all fixes: UI bugs, logic fixes, API changes, screen redesigns. Run `eas update --branch production --message "fix description"` and users get it automatically.
2. **Backend Updates** — INSTANT. Push to GitHub → Railway auto-deploys. No App Store involved.
3. **App Store Update** — Only needed for new native packages, permission changes, or major version bumps. Takes 1-3 days review. Rarely needed for bug fixes.

### Timeline
- **Now (June)** — EAS dev build, get Google/Apple Sign-In working, finish Phase 5
- **Early July** — TestFlight with Longies, fix issues, run 2025 data migration
- **Late July** — Submit to App Store and Google Play
- **August 7-28** — Preseason: polish with OTA updates, app already live
- **September 4** — Regular season opens 🏈

### What Actually Blocks App Store Submission
Must have before submitting:
- Google/Apple Sign-In working (needs EAS dev build first)
- Push notifications working
- Admin dashboard (to manage Longies)
- Activity panel
- No crashes on core flows
- Splash/onboarding screen

Can fix post-launch with OTA updates:
- UI polish, minor bugs, text changes
- Non-native feature additions
- Any JavaScript/React Native changes

### EAS Dev Build — Do This Immediately
An EAS dev build is a real version of YOUR app (bundle ID `com.thelonggame.picks`) installed on Nick's iPhone. It's NOT Expo Go. It unlocks Google Sign-In, Apple Sign-In, and push notifications which all fail in Expo Go because Expo Go runs under `host.exp.exponent` not our bundle ID.

To create one:
```bash
cd mobile
eas build --platform ios --profile development
```
EAS builds in the cloud (no Mac needed), ~15-30 minutes. Install via TestFlight link.

---

## CURRENT STATUS — Read This Before Starting Any Session

### What's Done
- Backend fully built and deployed to Railway ✅
- PostgreSQL database running on Railway ✅
- All API routes working and tested ✅
- 2025 season data in database (272 games confirmed returning from API) ✅
- GitHub connected to Railway with auto-deploy ✅
- Expo mobile app fully scaffolded and running in Expo Go ✅
- Firebase Auth configured (email working; Google + Apple need EAS dev build to test) ✅
- NativeWind dark theme configured ✅
- TanStack Query connected to Railway backend ✅
- 4-tab navigation with bell icon header ✅
- Login / Signup / Forgot Password screens ✅
- Notification permission flow (10 sec delay, "Maybe Later" after 7 days) ✅
- Push token registration to backend ✅
- **Picks Tab** ✅ — GameCard (3 states), WeekSelector, TiebreakerCard, pick % bars, lock logic, game card taps → Game Detail
- **Leaderboard Tab** ✅ — Longies/Global + Season/Weekly toggles, rank badges, W-L, accuracy, rows tap → profiles
- **Week Picks Tab** ✅ — compact grid, synchronized horizontal scroll, pick outcome tinting, week selector, bounce-scroll fixed, header scrollable
- **Profile Tab (own)** ✅ — avatar, season stats, weekly history color blocks, insights, H2H vs Longies, achievement case
- **Game Detail Screen** ✅ — compact header, prev/next, team stats (PPG/OppPPG), pick list after lock, tappable from Picks + Week Picks
- **Public Profile Screen** ✅ — other user profiles, season stats, weekly history, H2H vs viewer, pick comparison (Nick's fav feature)
- **Auth timing fixed** ✅ — user.uid in query key, token from React state (not auth.currentUser)
- **seed:nick script** ✅ — `npm run seed:nick` in server/ seeds nickcorum@gmail.com with Nicholas's 2025 picks + achievements
- **Game Detail improvements** ✅ — winner highlighted green, loser dimmed, MY PICK badge (green ✓ or red ✗), outcome banner
- **Profile insights** ✅ — shows W-L record alongside accuracy % for best/worst team
- **H2H rows tappable** ✅ — navigate to opponent's public profile
- **Public profiles tappable from leaderboard** ✅
- **Week Picks bounce scroll fixed** ✅ — header row is scrollable and syncs with game rows
- **Debug logs removed** ✅ — `[apiFetch]` and `[useGames]` logs removed from queryClient.ts + usePicksData.ts
- **Week Picks names tappable** ✅ — tapping a player name navigates to their public profile
- **GameCard polish** ✅ — wrong-pick row gets red tint, pending-pick gets blue tint (matching border colors)
- **Activity bell panel** ✅ — slide-in drawer, Global Feed + Your Activity tabs, paginated 20 per load
- **Admin dashboard** ✅ — Users tab (Longie toggle + inline teamName edit), NFL Tools tab (Sync Games, Sync Scores Only, Sync Win Probs, Award Achievements, Unlock Week, inline score correction editor), Data tab (season + weekly picks export). Season selector in header for viewing past seasons. Gear icon on profile for admins.
- **Achievements terminology** ✅ — weekly awards (most_wins, upset_pick, lone_wolf, contrarian, loser) renamed to "Achievements" throughout all UI. DB table still called `trophies` (rename when building new Trophy/podium system).
- **Dynamic season labels** ✅ — "2025 Season" now uses `getCurrentNFLSeason()` everywhere in mobile UI
- **ESPN score-only sync** ✅ — `syncWeekScores()` in espnService.ts updates scores/status without touching game metadata; `POST /api/admin/games/sync-scores` route added

### Known TODOs (Before Launch)
- **EAS dev build** — needed immediately to test Google/Apple sign-in ← DO THIS FIRST
- **Google/Apple Sign-In** — must work before launch, currently blocked by Expo Go limitation
- **Splash/onboarding screen** — logo + tagline screen not yet built
- **Achievement case UI redesign** — current design uses placeholder emojis; needs:
  - Custom artwork/images per type (most_wins, loser, upset_pick, lone_wolf, contrarian)
  - Better grid layout in profile
  - Contrarian artwork was never created (placeholder only)
  - Consider full-screen detail on tap (description, week earned, game context)
- **Trophies (podium) system** — NEW concept: season-end 1st/2nd/3rd/last place awards. Not yet built. Design and award logic TBD with Nick. Last-place prize keeps eliminated players engaged.
- **Admin: email editing** — backend needs Firebase Admin SDK email update; deferred (simpler fix is new account + UID reassignment)

### seed:nick — Re-run After Any Cleanup
`npm run seed:nick` (from server/) must be re-run any time Nick's test data is wiped. It:
- Looks up nickcorum@gmail.com UID via Firebase Admin
- Sets isAdmin=true, isLongie=true, teamName=Nicholas
- Copies all 179 2025 picks from CSV → DB (mapped via espnId)
- Copies all Nicholas trophies from CSV → DB
Requires FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in server/.env

### Showing 2025 Season — CORRECT BEHAVIOR
getCurrentNFLSeason() correctly returns 2025 in May 2026 because the 2026 NFL season starts September 4, 2026. It will flip automatically on that date. No fix needed.

### What's Next — Priority Order
1. **EAS dev build** — run `eas build --platform ios --profile development` in mobile/ ← DO THIS FIRST
2. **Google/Apple Sign-In** — fix once EAS dev build is available (critical for launch)
3. **Push notifications** — all 5 triggers wired up (Phase 5)
4. **Splash/onboarding screen**
5. **Submit to App Store and Google Play** — target late July
6. **Run 2025 data migration** — when Longies are ready to sign up
7. **Trophies (podium) system** — season-end 1st/2nd/3rd/last place (design with Nick first)

### Important: Railway Environment Variables (Learned the Hard Way)
- `FIREBASE_PROJECT_ID` had trailing whitespace which caused all token verification to silently fail
- If picks/myPick ever stop working: check Railway Variables for trailing spaces on FIREBASE_PROJECT_ID
- Symptom: optionalAuth logs "incorrect aud claim" with spaces in the expected value

### Apple + Google Sign-In — DEFERRED TO EAS DEV BUILD
- **Why deferred:** Both require a real build with bundle ID `com.thelonggame.picks`. Expo Go runs under `host.exp.exponent` so Apple identity tokens fail Firebase validation and Google OAuth is blocked. This is NOT a configuration bug — it is a fundamental Expo Go limitation.
- **Apple:** Apple Developer Portal App ID + Service ID (`com.thelonggame.picks.siwa`) configured. Firebase has Team ID `NMR4HYNN3K`, Key ID, and private key entered. Nonce fix in code with expo-crypto. Ready to test once we have an EAS dev build.
- **Google:** Web Client ID in `mobile/.env`. Gets "OAuth 2.0 policy" error in Expo Go. Will fix with native Google Sign-In SDK during EAS dev build phase.
- **These are CRITICAL for launch** — must be tested and working before App Store submission.

### Important Deployment Notes (Learned the Hard Way)
- Railway injects NODE_ENV=production which breaks TypeScript compilation
- Solution: pre-compile dist locally, commit dist to GitHub, Dockerfile copies dist directly
- Current Dockerfile at server/Dockerfile uses pre-compiled dist — DO NOT change this approach
- `server/dist` is in .gitignore but MUST be committed — use `git add -f server/dist/`
- Build command in Railway: blank (Dockerfile handles everything)
- Start command: node dist/index.js
- When making backend changes: run `npm run build` in server/ locally first, then commit both src and dist
- GitHub repo name: corumnick-oss/the-long-game (lowercase, note the hyphen)
- Auto-deploy is working — pushing to main triggers Railway automatically
- drizzle-orm pinned to 0.45.1 (0.45.2 was a broken publish — no .d.ts files)
- axios pinned to 1.7.9 (1.16.0 was a broken publish — no .d.ts files)
- TypeScript pinned to ^5.8.3 (6.x has incompatible module resolution for this setup)

---

## The Big Picture Vision

This is NOT just a friend group app. Nick has a large vision:

- Publicly available iOS + Android app with hundreds of thousands of users
- Multi-sport platform — NFL first, then March Madness brackets, FIFA World Cup brackets, NCAA Top 25 matchups. Curated high-stakes events only — NOT every sport every day. The concept is scarcity: fewer games = more emotional investment per pick.
- Premium analytics tier ("Long Game Pro") — paying users get deep stats to help make better picks
- Private pools (like fantasy football leagues) — friends/coworkers compete in their own group with commissioner and optional buy-in
- Multiple game modes — Standard (current), Probability Mode, Upset Hunter, Lock of the Week
- No ads ever — firm, permanent decision
- The app should feel like a real product, not a hobby project

Nick spent ~$200 building the original web app on Replit with 7 friends for the 2025 NFL season. We are migrating everything off Replit into a proper production app.

---

## ESPN API — Usage and Future Strategy

### Current Usage
ESPN's public API is undocumented and unofficial. It has no formal terms of service for developers. At small scale (thousands of users) ESPN tolerates this usage — most sports apps use it. This is fine for launch and the first season.

### If ESPN Blocks Access or App Grows Large
The ESPN service is isolated in `server/src/services/espnService.ts`. Switching APIs means rewriting ONLY that file — routes, database, and mobile app are untouched. This is the correct architecture.

Recommended alternatives when needed:
- **Sportradar** — industry standard, official NFL data licensing, ~$500-2000/month at scale
- **The Odds API** — good for spread and win probability data, affordable tiers
- **SportsData.io** — mid-range pricing, good NFL coverage

### Premium Analytics Come From OUR OWN Database
The premium analytics features do NOT require a paid API. They come from data we already collect:
- `winningTeamWinProb` stored on every game
- `pickWinProbability` stored at pick submission time
- All pick outcomes for every user every week
- Team stats snapshots in `team_game_stats`

After one full 2026 season we have proprietary data no API can sell us:
- Win probability vs actual outcome (for Probability Mode calibration)
- User pick accuracy patterns (best team, worst team, home/away, day of week)
- Matchup intelligence built from our own historical data

This data gets more valuable every season. It IS the premium product. ESPN just feeds us raw game data to populate it.

---

## Tech Stack — All Final

### Mobile App
- React Native with Expo (SDK 54, React Native 0.81.5, New Architecture enabled)
- Expo Router v6 (file-based navigation)
- TanStack Query v5 (data fetching)
- Firebase JS SDK v12 (auth — NOT React Native Firebase package)
- NativeWind v4 (Tailwind for React Native)
- Expo Notifications + Expo Push API (push notifications)
- EAS Build + EAS Submit (cloud builds, no Mac needed)
- Expo Updates (OTA updates without App Store re-review)

### Backend
- Express.js with TypeScript
- PostgreSQL on Railway
- Drizzle ORM
- Firebase Admin SDK (verify auth tokens)
- node-cron (scheduled jobs)
- ESPN public API (no key required)
- Railway (hosting) — DEPLOYED AND WORKING

### Auth
- Firebase project: the-long-game-prod-bef05
- Bundle ID: com.thelonggame.picks — NEVER CHANGE THIS
- Sign-in methods: Email/Password + Google Sign-In + Apple Sign-In
- Apple Sign-In is REQUIRED by Apple whenever Google Sign-In is offered
- Profile photo from OAuth provider if available, initials fallback if not

### Infrastructure
- GitHub: corumnick-oss/the-long-game (lowercase, with hyphen)
- Railway: connected to GitHub, auto-deploys on push to main ✅
- Apple Developer: approved (Individual account) ✅
- Google Play: NOT set up yet (not urgent, needed before Android launch)
- Firebase Project: the-long-game-prod-bef05 ✅
- Bundle ID: com.thelonggame.picks (both iOS and Android)

---

## File Structure (What Actually Exists)

```
TheLongGame/
├── CLAUDE.md                        ← this file
├── data/                            ← 2025 CSV files for migration
│   ├── picks.csv                    (1,903 picks)
│   ├── games.csv                    (272 games, 2025 season)
│   ├── trophies.csv                 (109 trophies)
│   ├── users.csv                    (9 users, only migrate 7)
│   └── week18_tiebreakers.csv       (7 entries)
├── mobile/                          ← Expo React Native app (BUILT, running in Expo Go)
│   ├── app/
│   │   ├── _layout.tsx              ← root layout (QueryClientProvider + AuthProvider + AuthGate)
│   │   ├── (auth)/
│   │   │   ├── _layout.tsx
│   │   │   ├── login.tsx            ← login screen (email working; Apple/Google need EAS build)
│   │   │   ├── signup.tsx           ← signup screen
│   │   │   └── forgot-password.tsx  ← forgot password screen
│   │   └── (tabs)/
│   │       ├── _layout.tsx          ← 4 bottom tabs + bell icon header
│   │       ├── picks.tsx            ← Picks tab (COMPLETE — game cards, week selector, tiebreaker)
│   │       ├── leaderboard.tsx      ← Leaderboard tab (COMPLETE)
│   │       ├── week-picks.tsx       ← Week Picks tab (COMPLETE)
│   │       └── profile.tsx          ← Profile tab (COMPLETE)
│   ├── src/
│   │   ├── global.css               ← Tailwind directives
│   │   ├── components/
│   │   │   ├── GameCard.tsx         ← game card (pre/live/final states, pick % bars)
│   │   │   ├── WeekSelector.tsx     ← horizontal scrollable week selector
│   │   │   ├── TiebreakerCard.tsx   ← tiebreaker input card
│   │   │   └── NotificationPrompt.tsx ← in-app notification permission prompt
│   │   ├── context/
│   │   │   └── AuthContext.tsx      ← Firebase auth context (email + Google + Apple)
│   │   ├── hooks/
│   │   │   ├── usePicksData.ts      ← TanStack Query hooks: useGames, useTiebreaker, useSubmitPick, useSubmitTiebreaker
│   │   │   └── useNotificationPermission.ts ← notification permission + push token registration
│   │   └── lib/
│   │       ├── firebase.ts          ← Firebase init with AsyncStorage persistence
│   │       ├── queryClient.ts       ← TanStack Query + apiFetch() with Bearer token
│   │       ├── nflSeason.ts         ← getCurrentNFLSeason(), getCurrentNFLWeek()
│   │       └── lockTime.ts          ← isWeekCurrentlyLocked() (client-side best-effort)
│   ├── app.json                     ← bundle ID com.thelonggame.picks, scheme thelonggame
│   ├── babel.config.js              ← jsxImportSource nativewind, react-native-worklets/plugin
│   ├── metro.config.js              ← withNativeWind wrapper
│   ├── tailwind.config.js           ← custom dark color palette
│   ├── tsconfig.json                ← strict, @/* → ./src/*
│   ├── nativewind-env.d.ts          ← NativeWind types + Firebase module augmentation
│   ├── .env                         ← EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
│   └── package.json
└── server/                          ← Express.js backend (BUILT AND DEPLOYED)
    ├── src/
    │   ├── index.ts                 ← main server entry
    │   ├── types.ts
    │   ├── db/
    │   │   ├── index.ts             ← database connection
    │   │   └── schema.ts            ← complete Drizzle schema
    │   ├── routes/
    │   │   ├── activity.ts
    │   │   ├── admin.ts
    │   │   ├── games.ts
    │   │   ├── leaderboard.ts
    │   │   ├── picks.ts
    │   │   ├── pushTokens.ts
    │   │   ├── tiebreaker.ts
    │   │   ├── trophies.ts
    │   │   └── users.ts
    │   ├── services/
    │   │   ├── espnService.ts       ← ESPN API isolated here — easy to swap to Sportradar/SportsData later
    │   │   ├── notificationService.ts
    │   │   ├── scheduler.ts
    │   │   └── trophyService.ts     ← bug-fixed version
    │   ├── utils/
    │   │   ├── lockTime.ts
    │   │   └── season.ts            ← getCurrentNFLSeason()
    │   ├── middleware/
    │   │   └── auth.ts
    │   └── scripts/
    │       └── migrate-2025.ts      ← imports CSV data into database
    ├── dist/                        ← compiled JS (committed to git, used by Railway)
    ├── Dockerfile                   ← copies pre-compiled dist, no TypeScript build
    ├── railway.toml                 ← sets builder to DOCKERFILE
    ├── .env                         ← never commit this
    ├── .gitignore
    ├── package.json
    └── tsconfig.json
```

---

## Environment Variables

### Local (server/.env)
```
DATABASE_URL=<railway postgresql connection string>
FIREBASE_PROJECT_ID=the-long-game-prod-bef05
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@the-long-game-prod-bef05.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
PORT=3000
NODE_ENV=development
ESPN_API_BASE_URL=https://site.api.espn.com/apis/site/v2/sports/football/nfl
CURRENT_SEASON=2025
```

### Railway Variables (set in Railway dashboard)
- NODE_ENV: production
- FIREBASE_PRIVATE_KEY: no quotes, keep all \n characters
- DATABASE_URL: from Railway PostgreSQL service → Connect tab
- All other variables same as local
- **CRITICAL:** No trailing whitespace on any variable — especially FIREBASE_PROJECT_ID

### Railway Deployment (IMPORTANT — DO NOT CHANGE)
- Builder: DOCKERFILE (set in server/railway.toml)
- Dockerfile copies pre-compiled dist — does NOT run tsc on Railway
- When making backend changes: ALWAYS run `npm run build` in server/ locally first
- Commit both src/ changes AND dist/ changes together

---

## Firebase Config (public, safe in code)

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyAd8Me9csnIzKQR2Im902JxR6g7jg1KYEw",
  authDomain: "the-long-game-prod-bef05.firebaseapp.com",
  projectId: "the-long-game-prod-bef05",
  storageBucket: "the-long-game-prod-bef05.firebasestorage.app",
  messagingSenderId: "309276847432",
  appId: "1:309276847432:web:8b5297c3718fc51624177d"
};
```

---

## The Longies — Nick's Friend Group

7 active users from the 2025 season. Called "Longies" — Nick's inner circle competing in a season-long pool with real money on the line. All 7 are isLongie: true.

| Team Name | Email | Is Admin |
|---|---|---|
| Nicholas (Nick) | b2msbro@gmail.com | YES |
| Squid | cloud7king10@yahoo.com | no |
| Kevin Akers | kakers91@gmail.com | no |
| The Purdy Mouths | jhayhurst714@gmail.com | no |
| Gmac | garciagarrett24@gmail.com | no |
| Leo | leocorum@gmail.com | no |
| EWIK | erikhernandez531@yahoo.com | no |

These 7 will create FRESH accounts using Google or Apple Sign-In in the new app. After they sign up, Nick runs a UID reassignment script to link their new Firebase UIDs to the 2025 season data. Nick coordinates this via group text.

DO NOT migrate these test accounts:
- CBB Test (nicholas.corum@sce.com)
- Blank team name (nickcorum@gmail.com)

---

## 2025 Season Data — Migration Details

Migration script: server/src/scripts/migrate-2025.ts
Status: Script written, needs to be run to import data into Railway database.

| Table | Records | Notes |
|---|---|---|
| users | 7 | Active users only, exclude 2 test accounts |
| games | 272 | Season 2025 ONLY — exclude all 2024 games |
| picks | 1,903 | All 7 players, all 18 weeks, complete |
| trophies | 109 | All 7 players |
| week18_tiebreakers | 7 | All players submitted |

Skip migrating: activity_log, pick_audit_log, unlocked_weeks, sessions (regenerate fresh)

2025 Final Season Leaderboard (verify migration against this):
1. Kevin Akers 181-91 (66.5%)
2. Nicholas 179-93 (65.8%)
3. Squid 177-95 (65.1%)
4. Leo 175-97 (64.3%)
5. EWIK 172-100 (63.2%)
6. The Purdy Mouths 165-107 (60.7%)
7. Gmac 165-107 (60.7%)

---

## Database Schema — Complete

### users
- id (text PK) — Firebase UID
- email (text, unique)
- teamName (text) — display name shown everywhere in app
- isAdmin (boolean, default false)
- isLongie (boolean, default false) — Nick's inner circle
- isPremium (boolean, default false) — future paid tier, not used yet
- nflAccess (boolean, default TRUE) — all new users get true automatically
- profileImageUrl (text, nullable) — from Google/Apple OAuth
- createdAt, updatedAt (timestamps)

### games
- id (uuid PK)
- espnId (text, unique)
- week (integer)
- season (integer) — NEVER hardcode, use getCurrentNFLSeason()
- seasonType (text) — 'regular', 'preseason', 'postseason'
- sport (text, default 'nfl') — sport-agnostic for future sports
- homeTeam, awayTeam (text) — FULL team names always
- homeTeamLogo, awayTeamLogo (text) — URLs
- homeTeamRecord, awayTeamRecord (text)
- spread (text, nullable)
- favoriteTeam (text, nullable)
- gameTime (timestamp)
- status (text) — 'pre', 'in', 'post'
- homeScore, awayScore (integer, nullable)
- homeTeamPPG, homeTeamPPGAllowed, homeTeamFPI (decimal, nullable)
- awayTeamPPG, awayTeamPPGAllowed, awayTeamFPI (decimal, nullable)
- period (integer, nullable)
- displayClock (text, nullable)
- statusType (text, nullable)
- winningTeamWinProb (decimal, nullable)
- losingTeamWinProb (decimal, nullable)
- isScoreLocked (boolean, default false)

### picks
- id (uuid PK)
- userId (text, FK → users.id)
- gameId (uuid, FK → games.id)
- pick (text) — 'home' or 'away'
- isCorrect (boolean, nullable)
- pickWinProbability (decimal, nullable) — ESPN win probability FOR THE PICKED TEAM at moment of submission
- pointsEarned (decimal, nullable) — for future game modes
- createdAt (timestamp)

### trophies
- id (uuid PK)
- userId (text, FK → users.id)
- type (text)
- name (text)
- description (text)
- week (integer, nullable)
- season (integer)
- sport (text, default 'nfl')
- gameId (uuid, nullable) — for Lone Wolf, Contrarian
- earnedAt (timestamp)

### team_game_stats
- id (uuid PK)
- gameId (uuid, FK → games.id)
- season, week (integer)
- sport (text)
- teamName (text)
- isHomeTeam (boolean)
- offensiveRank, defensiveRank (integer, nullable)
- yardsPerGame, yardsAllowedPerGame (decimal, nullable)
- pointsPerGame, pointsAllowedPerGame (decimal, nullable)
- sackRate, thirdDownConversion, redZoneEfficiency (decimal, nullable)
- homeRecord, awayRecord (text, nullable)
- last3Games (text, nullable)
- additionalStats (jsonb, nullable)
- createdAt (timestamp)

### player_stats
- id (uuid PK)
- gameId (uuid, FK → games.id)
- season, week (integer)
- sport (text)
- teamName (text)
- position (text) — 'QB', 'RB', 'WR', 'DEF'
- playerName (text)
- stat1 (decimal) — yards
- stat2 (decimal) — touchdowns
- stat3 (decimal) — additional stat
- stat4 (decimal) — additional stat
- additionalStats (jsonb, nullable)
- createdAt (timestamp)

### activity_log
- id (uuid PK)
- type (text)
- message (text)
- metadata (jsonb, nullable)
- visibility (text) — 'global', 'personal', 'admin'
- targetUserId (text, nullable)
- createdAt (timestamp)

### push_tokens
- id (uuid PK)
- userId (text, FK → users.id)
- token (text, unique)
- platform (text) — 'ios', 'android'
- createdAt, updatedAt (timestamps)

### tiebreaker_games
- id (uuid PK)
- season (integer)
- week (integer)
- gameId (uuid, FK → games.id)
- description (text)
- actualTotal (integer, nullable)
- designatedAt (timestamp)

### tiebreaker_picks
- id (uuid PK)
- userId (text, FK → users.id)
- tiebreakerGameId (uuid, FK → tiebreaker_games.id)
- season (integer)
- predictedTotal (integer)
- createdAt, updatedAt (timestamps)

### week_settings
- id (uuid PK)
- week (integer)
- season (integer)
- lockTime (timestamp, nullable) — overrides default Wednesday 9PM PST
- notes (text, nullable)

### app_settings
- id (uuid PK)
- key (text, unique)
- value (text)
- updatedAt (timestamp)
Keys: 'seasonStartDate', 'currentSeason', 'preseasonMode'

### pick_audit_log
- id (uuid PK)
- userId, gameId, action
- previousPick, newPick (text, nullable)
- adminId (text, nullable)
- createdAt (timestamp)

### unlocked_weeks
- id (uuid PK)
- week, season (integer)
- unlockedAt (timestamp)
- unlockedBy (text)

---

## Achievement & Trophy System

### Terminology (IMPORTANT)
- **Achievements** = Weekly awards earned throughout the season. These are stored in the `trophies` DB table (rename pending). Displayed as "Achievements" everywhere in the UI.
- **Trophies** = Season-end podium placements (1st, 2nd, 3rd, last place). **NOT YET BUILT.** The last-place "trophy" comes with a prize — keeps players engaged even after falling out of contention. Design with Nick before implementing.

### Achievement System — Complete

### Currently Active (bugs already fixed in trophyService.ts)

**most_wins** — Most correct picks that week. Ties = multiple winners.

**loser** — Most incorrect picks that week. Ties = multiple losers. Sad football image. Stings a little — makes winning meaningful.

**upset_pick** — Correctly picked lowest win probability winner. Uses winningTeamWinProb NOT FPI. Floating point epsilon 0.01.

**lone_wolf** — ONLY player to correctly pick winner. Requires winningPicks.length === 1 AND losingPicks.length >= 1. Will become very rare as user base grows.

**contrarian** — NEW. Correctly picked winner when 20% or fewer of players chose that team. Requires >1 winner pick (not Lone Wolf territory). Multiple per week possible. More attainable than Lone Wolf.

### Bug Fixes Applied (trophyService.ts)
1. Lone Wolf: added `losingPicks.length >= 1`
2. Upset Pick: uses `winningTeamWinProb` not FPI
3. Floating point: `Math.abs(a - b) < 0.01`

### Trophy Images
- most_wins, loser, upset_pick, lone_wolf: existing images ✓
- contrarian: NEEDS NEW IMAGE — placeholder for now

### Future Trophies — Discuss With Nick Before Implementing
Weekly: `perfect_week`
Season-end: `sharpshooter`, `most_improved`, `the_goat`, `consistency_king`, `chaos_agent`, `oracle`
Milestone: `century_club` (100 correct), `hot_hand` (10 in a row), `faithful` (every week submitted)

---

## Scheduling

| Schedule | What |
|---|---|
| Every 30 seconds | Live score updates (only when games live) |
| Tuesday 6AM PST | Weekly transition (trophies, unlock, stats sync) |
| Tuesday 9PM PST | Win probability refresh |
| Wednesday 6AM PST | Win probability refresh |
| Wednesday 5PM PST | Win probability refresh (added — ESPN sometimes slow) |
| Wednesday 8PM PST | Push: "1 hour left for Week X picks!" |
| Wednesday 9PM PST | Picks lock + push notification |

REMOVED: Monday 12PM CBB sync.

### Season Detection — ALWAYS USE THIS
```typescript
export function getCurrentNFLSeason(): number {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  return month >= 9 ? year : year - 1;
}
```
NEVER hardcode 2025 or any year. Lives in server/src/utils/season.ts.

### Lock Times
- Default: Wednesday 9PM PST
- Admin-configurable per week via week_settings table
- Season start date: admin-configurable, stored in app_settings

### Preseason Mode
- 'preseasonMode' boolean in app_settings
- Completely isolated from regular season
- Admin toggle as safeguard
- Data never deleted, excluded from queries

---

## App Navigation

### Bottom Tabs (4)
1. Picks 🏈
2. Leaderboard 🏆
3. Week Picks 👥 (renamed from All Picks)
4. Profile 👤

### Bell Icon 🔔 (header top-right)
- Activity slide-in panel
- Two tabs: Global Feed | Your Activity
- NOT a bottom tab

### Admin
- Profile → Settings ⚙️ → Admin Dashboard
- Only visible when isAdmin: true

---

## CRITICAL: Pick Visibility Rules

> NO ONE's picks visible ANYWHERE until Wednesday 9PM PST lock passes.

- Week Picks tab: hidden before lock
- Game Detail pick list: hidden before lock
- Profile H2H comparison: hidden before lock
- Exception: YOUR OWN picks on YOUR OWN picks page only

After lock:
- Week Picks: full grid
- Game Detail: player pick list
- Other profiles: H2H for CURRENT WEEK ONLY (never past weeks)

---

## Screen Designs — Detailed

### Game Cards
- Top/bottom layout (away top, home bottom) — NEVER left/right
- Full team names — NEVER abbreviations
- Blue outer border = your pick
- Green background = winning team
- 6px thick pick percentage bars
- Pick % bars only visible AFTER Wednesday lock
- 3 states: upcoming (pre-game stats), live (score+clock), final (score+result)

### Upcoming Card State
Shows: team logos (larger), full names, records, PPG, defensive rank, game time, spread, win probability bar, head-to-head top performers (QB/RB/WR side by side with season stats).

### Leaderboard
- Longies users: Longies/Season default
- Global users: Global/Season default
- Toggles: Longies/Global (top) + Season/Weekly (below)
- Row: trophy/rank | avatar | team name | "X picks different" | W-L | accuracy%
- "X picks different" = games picked differently than YOU this week
- HIDE "picks different" entirely on your own row (not "0" — just hide it)
- Blue highlight own row
- 🏆🥈🥉 top 3, numbers rest
- Tappable rows → profiles
- Longies appear on Global leaderboard too
- Tiebreaker column on season leaderboard

### Week Picks Tab
Before lock: message + past weeks viewable
After lock: compact horizontal grid
- Fixed left column (truncated names, ellipsis)
- ~44px logo badges
- Tap → Game Detail

### Game Detail
- Compact header: "CAR @ TB" + date/time
- Prev/Next + swipe gesture
- Before lock: pre-game stats only, NO picks visible
- After lock: player pick list with avatars, tappable to profiles

### Profile (own)
- Header: avatar, name, member since, Longies rank + Global rank, Longie badge, ⚙️
- 2×2 stats: Record | Accuracy | Best Week | Trophies
- This Week record
- Week-by-week color-coded history (green = above .500, red = below)
- Auto insights: best team, worst team, underdog record, home/away, upset rank, best day
- NO current streak (games change too fast on Sundays)
- H2H vs every Longie (W-L-T, ties counted as T)
- Trophy Case: summary counts + 2-col grid, tap for detail

### Other User Profiles
Tappable from: Leaderboard rows, Week Picks names, Game Detail pick list

- H2H vs YOU specifically
- H2H Pick Comparison (Nick's favorite feature):
  - ONLY after Wednesday lock
  - ONLY current week
  - Shows side by side your pick vs their pick for each game
  - Highlights games where you differ
  - Explains the "X picks different" number on leaderboard
- No email, no full pick history

### Activity Panel
Global Feed: week unlock/lock, trophy awards (bulk), new user joined, score corrections. Paginated 20.
Your Activity: picks submitted, trophy earned (individual), weekly result, milestones. Paginated 20.

Activity visibility rules:
- global: week_unlock, week_lock, trophy_award, user_join, score_correction
- personal: pick_submit, trophy_earn, weekly_result, milestone
- admin only: stats_update, account_delete, admin_action

### Admin (3 tabs)
**Users:** Vertical cards, Longie toggle, Manage Picks (read-only default, confirm+audit to edit)
**NFL Tools:** Sync games/scores/correctness/stats, correct scores, season config, lock times, trophies, tiebreaker, preseason
**Data:** Export All Data CSV, Export Win Probability CSV

---

## Pre-Game Stats on Game Cards

Head-to-head top performers comparison (season stats):
```
PASSING          Mahomes    Allen
Yards            2,847      2,631
TDs              22         19
INTs             4          6

RUSHING          Pacheco    Cook
Yards            487        412
TDs              5          3

RECEIVING        Rice       Diggs
Yards            634        589
TDs              6          4
```
Plus offensive/defensive ranking, yards per game, win probability bar.
From ESPN public API, stored in player_stats table, refreshed Tuesday 6AM.

---

## Push Notifications

| Trigger | Message | When |
|---|---|---|
| Week unlocked | "Week X picks are now open! 🏈" | Tue 6AM |
| Deadline | "1 hour left for Week X picks!" | Wed 8PM |
| Locked | "Picks locked. Good luck! 🏈" | Wed 9PM |
| Trophy | "🏆 You won [Trophy] for Week X!" | Tue after scoring |
| Final | "Final: [score]. Your pick: ✓/✗" | As games end |

Permission: in-app prompt 10 seconds after first login → system dialog. Maybe Later re-asks after 7 days.

---

## Complete Build Plan

### Phase 1 — Backend ✅ COMPLETE
- [x] Create Railway PostgreSQL database
- [x] Write Drizzle schema
- [x] Run migrations
- [x] Write 2025 data migration script
- [x] Build all Express routes
- [x] Deploy to Railway — WORKING ✅
- [x] Test endpoints — games API confirmed returning 2025 data ✅
- [ ] Run migration script to import 2025 CSV data (pending — run when ready)
- [ ] Verify leaderboard matches known 2025 results (pending)

### Phase 2 — Expo Foundation ✅ COMPLETE
- [x] Expo Router navigation (4 bottom tabs + bell icon)
- [x] Firebase Auth (email working; Google + Apple deferred to EAS dev build)
- [x] TanStack Query connected to Railway backend
- [x] NativeWind + dark theme
- [x] Notification permission flow (10 sec delay, "Maybe Later" after 7 days)
- [x] Push token registration to backend

### Phase 3 — Auth Screens ✅ MOSTLY COMPLETE
- [ ] Splash/onboarding (logo, tagline) ← TODO
- [x] Login (Google, Apple, Email buttons) — email works; OAuth needs EAS dev build
- [x] Sign up (email, password, team name)
- [x] Forgot password

### Phase 4 — Core Screens ✅ COMPLETE
- [x] Picks Tab (game cards 3 states, week selector, submit, tiebreaker, pick %)
- [x] Leaderboard Tab (Longies/Global, Season/Weekly toggles, tappable rows)
- [x] Week Picks Tab (compact synchronized grid, all outcomes color-coded)
- [x] Profile Tab (own profile: stats, weekly history, insights, H2H, trophies)
- [x] Game Detail Screen (header, prev/next, stats, pick list after lock)
- [x] Public profile screen (other users: stats, H2H, pick comparison)
- [x] **GameCard correct/incorrect UI polish** ✅ — wrong-pick red tint, pending blue tint
- [x] **Remove debug console.logs** ✅ — removed from queryClient.ts and usePicksData.ts
- [x] **Week Picks: player names tappable** ✅ — navigates to public profile

### Phase 5 — Advanced Features (NEXT PRIORITY)
- [ ] **EAS dev build** — do this first, unlocks Google/Apple sign-in testing ← DO FIRST
- [ ] **Google/Apple Sign-In** — fix once EAS build available, CRITICAL for launch
- [x] Activity bell panel (Global + Your Activity) ✅
- [ ] Push notifications (all 5 triggers wired to cron jobs)
- [x] Admin dashboard ✅ — Users (teamName edit, Longie toggle), NFL Tools (sync games, sync scores, sync probs, award achievements, unlock week, inline score editor), Data (season + weekly export), season selector
- [ ] AdminUserPicksPage (read-only + confirm-to-edit) — deferred to future

### Phase 6 — Preseason Testing
- [ ] Preseason mode working end-to-end
- [ ] All screens tested
- [ ] Safeguard toggle working
- [ ] Confirmed no contamination of regular season

### Phase 7 — 2025 Data Migration
- [ ] 7 Longies sign up with Google/Apple
- [ ] Run UID reassignment script
- [ ] Verify 2025 stats correct for all users

### Phase 8 — Polish
- [ ] Loading/error/empty states everywhere
- [ ] Animations and transitions
- [ ] Android testing
- [ ] Edge cases
- [ ] Trophy case UI redesign with custom images

### Phase 9 — App Store Submission (Target: Late July)

#### Before Either Store
- [ ] Privacy policy live on web
- [ ] Terms of service live on web
- [ ] Support email working
- [ ] TestFlight tested on real iPhone
- [ ] Tested on real Android
- [ ] Push notifications working
- [ ] Google/Apple sign-in working
- [ ] Zero crashes

#### Apple App Store
- [ ] App icon (1024×1024px)
- [ ] Screenshots: 6.5" iPhone + 12.9" iPad
- [ ] App name: "The Long Game"
- [ ] Subtitle: "NFL Picks & Leaderboards"
- [ ] Description, keywords, category (Sports), age rating (4+)
- [ ] Privacy Policy URL
- [ ] `eas build --platform ios --profile production`
- [ ] `eas submit --platform ios` — review 1-7 days

#### Google Play Store
- [ ] Set up Google Play Developer account ($25) — NOT DONE YET
- [ ] App icon (512×512px), feature graphic (1024×500px)
- [ ] Description, content rating
- [ ] Privacy Policy URL
- [ ] `eas build --platform android --profile production`
- [ ] `eas submit --platform android` — review 1-3 days

---

## Future Features — Not Building Now

### Team History Screen
Tapping a team logo (anywhere in the app) opens that team's past game history — schedule, scores, results. Would use ESPN API's `/teams/{teamId}/schedule` endpoint. Useful context for making picks.

### Advanced Game Stats (Pre-Game + Post-Game)
Discussed and scoped — deferring to let the 2026 season generate real data.

**Pre-game card stats** (ESPN `/summary?event={id}` predictor section):
- Team season stats: YPG, OppYPG, rush/pass yards, 3rd-down %, red zone %, sack rate, home/away record
- Top QB/WR/RB season averages: yards/game, TDs/game, carries/completions/receptions per game
- Win probability bar (already shown)
- Week 1 2026 edge case: if no current-season stats exist, fall back to 2025 stats

**Post-game box score** (ESPN `/summary?event={id}` boxscore section):
- Team: total yards, pass yards, rush yards, pass TDs, rush TDs, turnovers, 3rd-down efficiency, red zone
- Top QB: completions/attempts, passing yards, TDs, INTs
- Top RB: carries, rush yards, TDs
- Top WR: receptions/targets, receiving yards, TDs

**Implementation when ready:**
1. `espnService.ts`: add `syncBoxScore(game)` → stores in `team_game_stats` + `player_stats`
2. `espnService.ts`: update `syncWinProbabilities` to also store predictor team stats
3. Add `npm run sync:stats` script to backfill 2025 completed games
4. `GET /api/games` list: include pregame season stats per game
5. `GET /api/games/:id`: include post-game box score
6. GameCard: show team stats + player season averages for pre games
7. Game Detail: show box score section for final games
- DB tables (`team_game_stats`, `player_stats`) are already in schema — just needs population

### Premium ("Long Game Pro") ~$4.99/month or $29.99/season
- Stripe web-only (no in-app purchase — avoids Apple's 30% cut)
- Powered by OUR OWN database — not a third-party API (see ESPN API Strategy section)
- Win probability bucket analysis (own historical data)
- Matchup intelligence (pass rush, WR vs CB, run defense)
- Historical trends, data export, weather impact
- PFF licensing when revenue supports it
- isPremium field already in users table (default false)

### Private Pools
- Commissioner, buy-in tracking, pool leaderboards, pool game modes

### Game Modes
- Probability Mode: points scale with win probability (bracket thresholds TBD after data)
- Upset Hunter: underdog picks only
- Lock of the Week: double or nothing one pick
- pointsEarned field already in picks table

### Additional Sports (curated)
- March Madness brackets, FIFA World Cup brackets, NCAA Top 25

### User Feedback / Support
1. Simple feedback form → email (build after launch)
2. Crisp.chat (~$30/month, when user base grows)
Not building yet — 7 Longies = just text Nick.

---

## ESPN API

Base: https://site.api.espn.com/apis/site/v2/sports/football/nfl
- Scoreboard: /scoreboard?week={week}&seasontype=2&season={year}
- Preseason: /scoreboard?week={week}&seasontype=1&season={year}
- Team stats: /teams/{teamId}/statistics
- Game summary: /summary?event={espnId}
No API key required.
NFL win probability range: ~20%-80%.

---

## Mobile Setup — Lessons Learned (Important for Next Session)

These are hard-won fixes. Don't undo them.

### Node.js Version — REQUIRED: v20+
- Expo SDK 54 requires **Node.js v20 or higher** — v18 is NOT compatible
- Symptom of wrong version: `TypeError: configs.toReversed is not a function` → cascades into `ERR_UNSUPPORTED_ESM_URL_SCHEME` on Windows
- Fix: `nvm install 20 && nvm use 20` (nvm-windows is installed)
- Verify: `node --version` must show v20.x.x or higher

### Package Installation
- Always use `--legacy-peer-deps` when running `npm install` in the mobile/ folder
- There is a react-dom peer dep version conflict that's harmless but breaks install without the flag

### NativeWind v4
- `babel.config.js` must have `jsxImportSource: 'nativewind'` inside `babel-preset-expo` options
- `metro.config.js` must wrap config with `withNativeWind(config, { input: './src/global.css' })`
- TypeScript className support requires `/// <reference types="nativewind/types" />` in `nativewind-env.d.ts`

### react-native-reanimated v4
- The Babel plugin moved to a separate package: `react-native-worklets`
- `babel.config.js` plugin must be `'react-native-worklets/plugin'` NOT `'react-native-reanimated/plugin'`

### Firebase Auth
- Use Firebase JS SDK v12 (NOT the `@react-native-firebase` package)
- `getReactNativePersistence` is not in the TypeScript types — module augmentation in `nativewind-env.d.ts` handles this
- The file needs `export {}` at the top to be treated as a module (not ambient declaration)

### TextInput (iOS)
- NEVER set padding via className on TextInput — iOS clips the text
- Always use `style={{ height: 52, paddingHorizontal: 16 }}` as a prop instead
- ScrollView: use `contentContainerStyle` prop, NOT `contentContainerClassName`

### Apple Sign-In in Expo Go
- Does NOT work in Expo Go — Apple identity token `aud` claim = `host.exp.exponent` (Expo's bundle ID)
- Firebase rejects it because it's configured for `com.thelonggame.picks`
- This is not a config bug. Fix = EAS dev build
- All Apple config IS correct: App ID, Service ID, Firebase Team ID/Key ID/private key all set up

### Google Sign-In in Expo Go
- Gets "OAuth 2.0 policy violation" error in Expo Go
- Fix = native Google Sign-In SDK during EAS dev build phase
- Web Client ID already in `mobile/.env`

### To Start the App
```
cd mobile
npx expo start
```
Add `--clear` if there are any Metro bundler cache issues.

---

## 20 Rules — Never Violate Without Asking Nick

1. No CBB ever. Future = brackets only.
2. Dark mode only. Never light mode.
3. No ads ever.
4. Never show anyone's picks before Wednesday 9PM PST lock.
5. Full team names always. Never abbreviations.
6. Top/bottom game card layout. Never left/right.
7. Friend group = "Longies". isLongie boolean.
8. isPremium = future paid only. Not building yet.
9. Never hardcode a year. Always getCurrentNFLSeason().
10. Lock times admin-configurable per week.
11. Preseason completely isolated from regular season.
12. H2H pick comparison: current week only, after lock only, other profiles only.
13. Admin picks page: read-only default, confirm + audit log to edit.
14. Activity: two tabs, paginated 20 per load.
15. Tiebreaker: admin-designates, all submit, Longies vs Longies only.
16. Sport-agnostic architecture — every table has sport field.
17. No Download Picks button in mobile app.
18. Export All Data = admin only.
19. Bundle ID = com.thelonggame.picks. Never change.
20. Stripe web-only for premium. No in-app purchase.

---

## Open Questions — Ask Nick Before Deciding

- New season/milestone trophy details (discuss when building)
- Google Play account setup timing
- Domain name decision
- Contrarian trophy artwork
- Premium pricing and features

---

## About Nick

- GitHub: corumnick-oss
- Admin team name: Nicholas
- Windows 11, iPhone, no prior mobile dev experience
- Always ask before making product/design decisions
- Use Claude.ai chat for planning and strategy
- Use Claude Code for building
- Original Replit web app — do not reference that code