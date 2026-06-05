# The Long Game — Complete Project Briefing for Claude Code

## IMPORTANT: Read This First
This document contains everything you need to know about this project. Read it completely before writing any code or making any suggestions. Every decision in here has been carefully discussed and agreed upon with Nick (the owner). Do not deviate from these decisions without explicitly asking first. When in doubt, ask Nick.

When starting a session say: "I've read CLAUDE.md and I'm ready to continue."

---

## ⚠️ DO THIS FIRST NEXT SESSION — 2026 Game Sync (IN PROGRESS, needs fix)

**Goal:** Populate the DB with 2026 NFL game schedules so the Picks tab shows games.

**Current state (as of June 4 2026):** The admin sync for 2026 games is partially working but needs more investigation. The latest deployed approach (commit `65307ac`) uses team schedules to collect event IDs, then fetches summaries. Railway has NOT been tested yet after this commit — test it first thing.

**To test:** Admin → NFL Tools → set to 2026 → Regular Season → manually set week to 1 (week defaults to 18 in offseason) → tap "Sync Week 1 from ESPN". If it shows ✓ Synced 16 games, it worked. Then try Full Season sync.

---

### What We Know About the ESPN + Railway Problem

**Root cause:** ESPN's APIs behave differently when called server-side from Railway vs from a browser/mobile app.

| Endpoint | Browser | Railway |
|---|---|---|
| `site.api.espn.com/scoreboard?season=2026` | Returns 2025 data (ignores season param) | Returns HTTP 400 |
| `sports.core.api.espn.com/seasons/2026/...` | Returns 2026 event refs ✓ | Returns HTTP 400 (proxies to internal `.pvt` network) |
| `site.api.espn.com/summary?event={2025-id}` | Works ✓ | Works ✓ (win probs uses this) |
| `site.api.espn.com/summary?event={2026-id}` | Works ✓ | Unknown — not yet confirmed |
| `site.api.espn.com/teams/{id}/schedule?season=2026` | Works, 7 events ✓ | Should work (same domain as summary) — not yet confirmed from Railway |

**What we tried (in order):**
1. `&dates=2026` on scoreboard → ESPN returns "Failed to get events endpoint" (400) — REMOVED
2. `season=2026` on scoreboard (no dates) → ESPN silently returns 2025 data from browser, 400 from Railway
3. ESPN core API (`sports.core.api.espn.com`) → 400 from Railway; ESPN proxies to internal `.pvt` network that's blocked
4. Detect wrong-season by checking `data.season.year` → correct detection, but still blocked by Railway before reaching that check
5. Bypass scoreboard entirely for `season > getCurrentNFLSeason()`, go straight to core API → core API is also blocked from Railway
6. Add browser User-Agent to all requests → didn't fix Railway blocking
7. **Current approach (not yet tested from Railway):** Fetch all 32 team schedules from `site.api.espn.com/teams/{id}/schedule?season=2026`, collect unique event IDs per week, fetch `summary?event={id}` for each. This stays entirely on `site.api.espn.com` which Railway can reach.

**Known limitation:** ESPN's team schedule only shows the first ~8 weeks of the 2026 season. Weeks 9-18 will sync 0 games until ESPN adds them (probably August). That's acceptable for now.

**If team-schedule approach also fails:**
- Try fetching `summary?event=401872931` (known 2026 KC week 1 event ID) directly from a Railway test endpoint
- If that 400s, ESPN is blocking Railway from accessing any 2026 event data
- If it 200s, the team schedule collection step is failing — debug that specifically

**Admin week default bug:** `getCurrentNFLWeek()` returns 18 in the offseason. The admin NFL Tools week picker defaults to 18. User needs to manually tap `−` to get to week 1. OTA fix pending (admin.tsx change: `useState(() => season > currentSeason ? 1 : getCurrentNFLWeek())`).

---

Previously fixed bugs (done June 4 2026):
- ✅ Admin year selector now defaults to and allows 2026
- ✅ Week Picks tab has season selector + preseason/regular toggle
- ✅ Team Central uses combined entry selector with preseason support
- ✅ GameCard team names are tappable → Team Detail
- ✅ Backend picks/week and teams routes support seasonType param

---

## ⚠️ ALSO CHECK AT SESSION START

Files that should exist but are NOT in git (verify manually):
- `mobile/.env` (gitignored — contains EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 309276847432-j5unna6kj6k780gsk6fksveoklv57673.apps.googleusercontent.com)
- `server/.env` (gitignored — contains all Railway secrets)
- `server/dist/` (in .gitignore but force-committed — check `git ls-files server/dist | head` to confirm it's tracked)

---

## Project Overview

**App Name:** The Long Game
**Type:** iOS and Android mobile app (React Native / Expo)
**Purpose:** NFL picks app where users predict winners of each week's games and compete on leaderboards
**Current Status:** Phase 5 in progress. Preview build (`cfa11e3a`) active on Nick's iPhone. OTA updates confirmed working on preview channel (`eas update --branch preview`). Google/Apple Sign-In still blocked (Firebase config fixes needed — see BLOCKED section). Picks by Team, Team Central, and Team Detail screens shipped June 2 2026. Navigation bugs fixed, pick % bars fixed, Week Picks scroll sync fixed.
**Railway URL:** https://thelonggame-production.up.railway.app
**Target Launch:** App Store submission late July 2026. Regular season starts September 4, 2026.
**Owner:** Nick (Corums) — GitHub: corumnick-oss — Windows 11 — iPhone user — Admin team name: Nicholas
**Local Code Path:** C:\Dev\TheLongGame

---

## LAUNCH STRATEGY — Read This First

### The Plan
- **Do NOT wait for preseason to submit to the App Store**
- Submit to Apple and Google in **late July** — well before preseason starts August 7
- Use **preseason (Aug 7-28) as live testing** with OTA updates while app is already in the App Store
- Regular season starts **September 4, 2026** — hard deadline

### Why This Works — 3 Ways to Push Updates
1. **OTA Updates (Expo Updates)** — INSTANT, no App Store review needed. Covers 95% of all fixes: UI bugs, logic fixes, API changes, screen redesigns. Run `eas update --branch development --message "fix description"` for dev builds, `eas update --branch preview --message "fix description"` for preview builds. **CRITICAL: the preview build uses `--branch preview`. Publishing to `development` or `production` will NOT reach it.**
2. **Backend Updates** — INSTANT. Push to GitHub → Railway auto-deploys. No App Store involved.
3. **App Store Update** — Only needed for new native packages, permission changes, or major version bumps. Takes 1-3 days review. Rarely needed for bug fixes.

### Timeline
- **Now (June)** — EAS dev build installed, Google/Apple Sign-In working, push notifications tested
- **Early July** — TestFlight preview build for Longies, fix issues, run 2025 data migration
- **Late July** — Submit to App Store and Google Play
- **August 7-28** — Preseason live: real picks on preseason games, live score updates, polish via OTA
- **September 4** — Regular season opens, app transitions automatically

### Three Build Types
| Build | Command | Purpose | Who |
|---|---|---|---|
| `development` | `eas build --profile development` | Dev testing, connects to Metro | Just Nick |
| `preview` | `eas build --profile preview` | TestFlight beta | Longies |
| `production` | `eas build --profile production` | App Store submission | Everyone |

### What Actually Blocks App Store Submission
Must have before submitting:
- Google/Apple Sign-In working (needs EAS dev build first)
- Push notifications working and cron-triggered
- Preseason handling (season flip, functional picks)
- Past seasons accessible (leaderboard + profile)
- Pre-game team stats on GameCard
- Post-game box scores on Game Detail
- Splash/onboarding screen
- No crashes on core flows

Can fix post-launch with OTA updates:
- UI polish, minor bugs, text changes
- Achievement case artwork
- Non-native feature additions
- Any JavaScript/React Native changes

### EAS Dev Build
An EAS dev build is a real version of YOUR app (bundle ID `com.thelonggame.picks`) installed on Nick's iPhone. It's NOT Expo Go. It unlocks Google Sign-In, Apple Sign-In, and push notifications which all fail in Expo Go because Expo Go runs under `host.exp.exponent` not our bundle ID.

To create one (already done — see EAS section below):
```bash
cd mobile
eas build --platform ios --profile development
```

### EAS CLI Windows Bug — IMPORTANT
EAS CLI v20 has a Windows bug: `EPERM: operation not permitted, rmdir` during project upload. It uses non-recursive `rmdir` to clean up a temp shallow clone, which fails on Windows.

**Fix applied to:** `C:\nvm4w\nodejs\node_modules\eas-cli\build\build\utils\repository.js`
Wrap the `finally` block's `remove` call in a try/catch that swallows EPERM errors.

**⚠️ This patch is lost if `eas-cli` is updated.** Re-apply after any `npm install -g eas-cli`.
See memory file for exact patch: `eas-cli-windows-fix.md`

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
- **Achievements terminology** ✅ — weekly awards renamed to "Achievements" throughout UI. DB table still called `trophies`.
- **Dynamic season labels** ✅ — uses `getCurrentNFLSeason()` everywhere in mobile UI
- **ESPN score-only sync** ✅ — `syncWeekScores()` updates scores/status without touching game metadata
- **EAS project initialized** ✅ — `eas.json` created, project linked to @nickcorum/the-long-game, Apple push key registered
- **expo-dev-client installed** ✅ — required for EAS development builds
- **EAS CLI Windows bug patched** ✅ — `repository.js` finally block patched to not throw on temp dir cleanup EPERM
- **Notification testing in Admin Dashboard** ✅ — NFL Tools tab: "Send Test Notification Now" (immediate) + "Schedule Deadline Reminder Test" (1/5/10/30m presets that fire real "1 hour left for picks" message)
- **notificationService.ts** ✅ — all 5 push triggers built and wired: week unlocked + deadline + picks locked in scheduler.ts; trophy earned in trophyService.ts; game final in espnService.ts (in→post transition detection).
- **EAS iOS dev build installed** ✅ — installed on Nick's iPhone (June 1 2026). Developer Mode enabled. App runs under bundle ID `com.thelonggame.picks`.
- **mobile/.npmrc added** ✅ — `legacy-peer-deps=true` so EAS build server uses same install behavior as local
- **Package versions fixed for SDK 54** ✅ — `expo-dev-client` `~6.0.21`, `react-native-worklets` `0.5.1`, `expo` `~54.0.35`, `expo-router` `~6.0.24` (were all mismatched, causing EAS build failures)
- **Push token registration fixed** ✅ — `getExpoPushTokenAsync()` now passes `projectId` from `Constants.expoConfig.extra.eas.projectId` (was silently failing without it)
- **Admin notification endpoints fixed** ✅ — `/notifications/test` and `/notifications/schedule-test` now use `req.currentUser!.id` (were crashing with `req.user.uid` which is undefined)
- **Admin notification error display improved** ✅ — shows real server error message instead of generic "is push token registered?"
- **Push notifications working end-to-end** ✅ — confirmed June 1 2026. Token registered, test notification delivered, scheduled deadline reminder delivered. `setNotificationHandler` added so notifications show in foreground. Expo ticket errors surface in admin UI.
- **All 5 push cron triggers wired** ✅ — week unlocked + deadline + picks locked in scheduler.ts; achievement earned in trophyService.ts; game final in espnService.ts (detects in→post transition, notifies each user who picked that game).
- **Google Sign-In** — native SDK installed, account picker works. Firebase credential failing (see BLOCKED below).
- **Apple Sign-In** — `expo-apple-authentication` in plugins, code complete. Firebase credential failing (see BLOCKED below).
- **Onboarding/splash screen built** ✅ — embedded inside `login.tsx` as a view state (shown once via AsyncStorage, skipped on return visits). Logo + tagline + 4 feature rows + Get Started CTA. No separate route — avoids Expo Router routing issues. Working on preview build.
- **Trophy → Achievement terminology** ✅ — `notifyTrophyEarned` renamed to `notifyAchievementEarned`, notification message updated, `type Trophy` → `Achievement`, `useMyTrophies` → `useMyAchievements` in all mobile code. DB table `trophies` and API routes unchanged.
- **iOS Firebase app registered** ✅ — bundle ID `com.thelonggame.picks` registered in Firebase, `GoogleService-Info.plist` downloaded. Reversed client ID: `com.googleusercontent.apps.63838358971-fv3guakh4ib42uag36n98jp121fr7m0h`.
- **OTA branch mismatch fixed** ✅ — dev builds use `--branch development`, preview/prod use `--branch preview`/`production`. Was root cause of all OTA failures.
- **Preview build created** ✅ — `cfa11e3a` installed on Nick's iPhone (June 2 2026). Works standalone, no Metro needed. OTA via `eas update --branch preview`.
- **AuthGate routing fixed** ✅ — logged-in users can navigate to game detail, user profiles, admin, picks-by-team, and team routes without being redirected back to picks. Named routes are explicitly excluded from the cold-launch redirect. Cold launch (undefined segments) still redirects to tabs correctly.
- **Navigation bug fixed** ✅ — tapping game cards, leaderboard rows, and week picks names was redirecting to week 18 picks screen. Root cause: AuthGate `!inTabsGroup` check was too broad. Fixed by explicitly listing valid non-tab routes.
- **Pick % bars fixed** ✅ — `showPct` now derives from `game.homePickPct !== null` (server truth) instead of the client-side Wednesday 9PM lock check. Fixes bars disappearing in offseason and Wednesday pre-lock edge cases.
- **Week Picks scroll sync fixed** ✅ — all rows now scroll together at the same rate. Final approach: `isSyncing` mutex with `requestAnimationFrame` reset (~16ms). Blocks echo events from programmatic `scrollTo` while resetting fast enough that every user scroll event still propagates. Two prior attempts (50ms timeout → rate difference; scrollSource tracking → no sync at all) both abandoned.
- **Picks by Team screen** ✅ — accessible from Profile → Insights → "Picks by Team →". Shows user's W-L record for every team they've picked, sortable by most picked / accuracy / A-Z. Summary bar (overall record, team count, accuracy). Each team row taps to Team Detail. Backend: `GET /api/picks/by-team?season=X`.
- **Team Central screen** ✅ — accessible from Picks tab ("Team Central" entry button). Shows all 32 NFL teams with season W-L record and community pick accuracy. Search bar + 3 sort modes. Backend: `GET /api/teams?season=X`.
- **Team Detail screen** ✅ — accessible from Team Central and Picks by Team. Shows team logo/record, PPG/PPG Allowed/point differential (calculated from actual game scores), community picks (total picks across all users, W-L, accuracy bar), and last 10 games with result/score/opponent. Backend: `GET /api/teams/:name?season=X`.

### Auth — FIXED (June 3 2026) ✅
- **Google Sign-In** ✅ — OAuth clients now from correct Firebase project `the-long-game-prod-bef05` (`309276847432-*`). `mobile/.env` and `AuthContext.tsx` updated. New preview build with correct `iosUrlScheme`.
- **Apple Sign-In** ✅ — Firebase Service ID changed to `com.thelonggame.picks`. Working on preview build.
- **New user account creation** ✅ — `requireFirebaseToken` middleware added for `POST /api/users` to allow brand-new OAuth users to create their DB record.

### Known TODOs (Before Launch)
- **Preseason handling** ✅ — season flips August 1, preseason games synced separately via seasonType. Picks tab has Preseason/Regular toggle + P1-P4 weeks. Defaults to 2026 Preseason, flips to Regular Season Sept 7.
- **Past seasons feature** ✅ (partial) — Leaderboard and Picks tab have season selectors. Profile past seasons row still needed.
- **Week Picks tab** ✅ — season selector + preseason/regular toggle added (June 4 2026)
- **Team Central** ✅ — combined entry selector with preseason support added (June 4 2026)
- **Admin dashboard** ✅ — year selector max fixed to current year (June 4 2026)
- **Pre-game team stats on GameCard** — BEFORE LAUNCH. Show PPG, OppPPG, total yards, pass yards/TDs, rush yards/TDs, defensive yards allowed, offensive/defensive rankings for both teams. ESPN `/summary?event={id}` predictor section. DB tables already exist (`team_game_stats`, `player_stats`).
- **Post-game box scores on Game Detail** — BEFORE LAUNCH. Store team totals + top QB/RB/WR stats permanently after each game. Builds our own proprietary database. Same ESPN endpoint, boxscore section.
- **Splash/onboarding screen** ✅ — built, embedded in login.tsx. Blocked by OTA issue above.
- **Onboarding polish (before launch)** — Nick wants the splash/onboarding screen redesigned before launch. Currently looks generic with plain emoji icons. Needs custom imagery, better visual design, more branded feel. OTA-safe change.
- **Week 18 2025 tiebreaker is wrong** — check `tiebreaker_games` and `tiebreaker_picks` tables for week 18 season 2025. Fix via Admin → NFL Tools → score correction or directly in DB.
- **Achievement case UI redesign** — placeholder emojis need custom artwork. Contrarian image was never created. Consider full-screen detail on tap.
- **Trophies (podium) system** — season-end 1st/2nd/3rd/last place awards. NOT YET BUILT. Design with Nick before implementing.
- **Admin: email editing** — deferred. Workaround: new account + UID reassignment.
- **Team Central + Picks by Team — real-time updates needed** — both features currently use static query data (staleTime: 5min / 2min). During the season, team records, PPG, and pick accuracy all change as games complete. To make these live: either (a) reduce staleTime to 30s so they poll alongside the game score refresh, or (b) wire TanStack Query cache invalidation for `['teams', ...]` and `['picks-by-team', ...]` keys inside the same logic that invalidates `['games', ...]` after the live score sync. Option (b) is cleaner. Must be done before 2026 season opens.
- **Team Central — expand stats** — currently shows PPG / PPG Allowed / point differential derived from game scores. Nick wants to add yards per game, yards allowed, sacks, defensive stats, pass/rush breakdown. These require populating `team_game_stats` table via `syncTeamStats()` (not yet built — see Phase 7). Once that's built, Team Detail screen should pull from that table instead of aggregating raw scores.
- **In-app feedback / bug report** — users should be able to submit feedback or report bugs from within the app. Sends an email to Nick (nickcorum@gmail.com). Location: Profile tab (accessible to all users, not just admins). Implementation decision needed: simple `mailto:` deep link (OTA-safe, zero backend) vs. in-app form that POSTs to a backend endpoint which sends via nodemailer/SendGrid (better UX, no dependency on native mail app). Discuss with Nick before building.

### seed:nick — Re-run After Any Cleanup
`npm run seed:nick` (from server/) must be re-run any time Nick's test data is wiped. It:
- Looks up nickcorum@gmail.com UID via Firebase Admin
- Sets isAdmin=true, isLongie=true, teamName=Nicholas
- Copies all 179 2025 picks from CSV → DB (mapped via espnId)
- Copies all Nicholas trophies from CSV → DB
Requires FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in server/.env

### Season Detection — ALWAYS USE THIS
`getCurrentNFLSeason()` correctly returns 2025 until the 2026 season begins. It will need updating to handle the preseason start date (Aug 7) — see Known TODOs above.

### What's Next — Priority Order
1. **Fix Google Sign-In** — get correct web client ID from Firebase Console → update `mobile/.env` → push OTA (see BLOCKED section above)
2. **Fix Apple Sign-In** — change Service ID in Firebase Console from `com.thelonggame.picks.siwa` to `com.thelonggame.picks` (see BLOCKED section above)
3. **Team Central + Picks by Team real-time updates** — wire cache invalidation for `['teams', ...]` and `['picks-by-team', ...]` when live score sync runs (see Known TODOs above)
4. **Preseason handling** — season flip logic for Aug 7, functional preseason picks/leaderboard
5. **Past seasons** — leaderboard season selector + profile past seasons row
6. **Pre-game team stats** — ESPN sync → GameCard display + Team Central expanded stats (PPG, yards, sacks, rankings)
7. **Post-game box scores** — ESPN sync after finals → Game Detail display + permanent DB storage
8. **TestFlight preview build for Longies** — early July, `eas build --profile preview` + `eas submit`
9. **2025 data migration** — when Longies sign up with Google/Apple
10. **App Store + Google Play submission** — target late July
11. **Trophies (podium) system** — design with Nick first
12. **In-app feedback / bug report** — Profile tab, email to Nick, decide mailto vs backend form first

### Important: Railway Environment Variables (Learned the Hard Way)
- `FIREBASE_PROJECT_ID` had trailing whitespace which caused all token verification to silently fail
- If picks/myPick ever stop working: check Railway Variables for trailing spaces on FIREBASE_PROJECT_ID
- Symptom: optionalAuth logs "incorrect aud claim" with spaces in the expected value

### Apple + Google Sign-In — IN PROGRESS (June 2 2026)
- Both tested on preview build. Native flows (account picker) work. Firebase credential step fails for both. See BLOCKED section for exact fixes needed.
- **These are CRITICAL for launch** — must be working before App Store submission.

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
- Premium analytics tier ("Long Game Pro") — paying users get deep stats powered by OUR OWN proprietary database built from seasons of stored game/pick/outcome data
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
- Post-game box scores in `team_game_stats` + `player_stats`

After one full 2026 season we have proprietary data no API can sell us:
- Win probability vs actual outcome (for Probability Mode calibration)
- User pick accuracy patterns (best team, worst team, home/away, day of week)
- Matchup intelligence built from our own historical data
- Every QB/RB/WR performance linked to team win/loss outcomes

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
- expo-dev-client (required for development builds)

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
- EAS Project: @nickcorum/the-long-game (projectId: cb389856-b1ab-42c9-a22b-803f25093e22) ✅
- Google Play: NOT set up yet (not urgent, needed before Android launch)
- Firebase Project: the-long-game-prod-bef05 ✅
- Bundle ID: com.thelonggame.picks (both iOS and Android)

---

## File Structure (What Actually Exists)

```
TheLongGame/
├── CLAUDE.md                        ← this file
├── .gitignore                       ← root gitignore (.claude/, Needed info/)
├── .easignore                       ← EAS upload exclusions (.claude/, data/, server/, etc.)
├── data/                            ← 2025 CSV files for migration
│   ├── picks.csv                    (1,903 picks)
│   ├── games.csv                    (272 games, 2025 season)
│   ├── trophies.csv                 (109 trophies)
│   ├── users.csv                    (9 users, only migrate 7)
│   └── week18_tiebreakers.csv       (7 entries)
├── mobile/                          ← Expo React Native app
│   ├── app/
│   │   ├── _layout.tsx              ← root layout (QueryClientProvider + AuthProvider + AuthGate)
│   │   ├── admin.tsx                ← Admin Dashboard (3 tabs: Users, NFL Tools, Data)
│   │   ├── picks-by-team.tsx        ← Picks by Team screen (from Profile → Insights)
│   │   ├── team-central.tsx         ← Team Central list (all 32 teams, from Picks tab)
│   │   ├── team/
│   │   │   └── [name].tsx           ← Team Detail (record, PPG, community picks, recent games)
│   │   ├── game/
│   │   │   └── [id].tsx             ← Game Detail screen
│   │   ├── user/
│   │   │   └── [id].tsx             ← Public profile screen
│   │   ├── (auth)/
│   │   │   ├── _layout.tsx
│   │   │   ├── login.tsx            ← login screen (email working; Apple/Google need EAS build)
│   │   │   ├── signup.tsx           ← signup screen
│   │   │   └── forgot-password.tsx  ← forgot password screen
│   │   └── (tabs)/
│   │       ├── _layout.tsx          ← 4 bottom tabs + bell icon header
│   │       ├── picks.tsx            ← Picks tab (COMPLETE)
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
│   │   │   ├── usePicksData.ts      ← TanStack Query hooks for picks/games
│   │   │   ├── useAdminData.ts      ← Admin hooks including notification testing
│   │   │   ├── useNotificationPermission.ts ← permission + push token registration
│   │   │   ├── useProfile.ts        ← useMyProfile, useMyAchievements, usePicksByTeam
│   │   │   ├── useTeams.ts          ← useTeamList, useTeamDetail
│   │   │   ├── useLeaderboard.ts    ← leaderboard hook
│   │   │   └── useWeekPicks.ts      ← week picks grid hook
│   │   └── lib/
│   │       ├── firebase.ts          ← Firebase init with AsyncStorage persistence
│   │       ├── queryClient.ts       ← TanStack Query + apiFetch() with Bearer token
│   │       ├── nflSeason.ts         ← getCurrentNFLSeason(), getCurrentNFLWeek()
│   │       └── lockTime.ts          ← isWeekCurrentlyLocked() (client-side best-effort)
│   ├── app.json                     ← bundle ID, EAS projectId, expo-dev-client plugin
│   ├── eas.json                     ← development/preview/production build profiles
│   ├── babel.config.js
│   ├── metro.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── nativewind-env.d.ts
│   ├── .env                         ← EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
│   └── package.json
└── server/                          ← Express.js backend (BUILT AND DEPLOYED)
    ├── src/
    │   ├── index.ts
    │   ├── types.ts
    │   ├── db/
    │   │   ├── index.ts
    │   │   └── schema.ts            ← complete Drizzle schema
    │   ├── routes/
    │   │   ├── activity.ts
    │   │   ├── admin.ts             ← includes notification test endpoints
    │   │   ├── games.ts
    │   │   ├── leaderboard.ts
    │   │   ├── picks.ts             ← includes GET /by-team?season=X endpoint
    │   │   ├── pushTokens.ts
    │   │   ├── teams.ts             ← GET /api/teams, GET /api/teams/:name
    │   │   ├── tiebreaker.ts
    │   │   ├── trophies.ts
    │   │   └── users.ts
    │   ├── services/
    │   │   ├── espnService.ts       ← ESPN API isolated here
    │   │   ├── notificationService.ts ← all 5 push triggers built, not yet cron-wired
    │   │   ├── scheduler.ts         ← cron jobs (push triggers NOT yet connected)
    │   │   └── trophyService.ts     ← bug-fixed version
    │   ├── utils/
    │   │   ├── lockTime.ts
    │   │   └── season.ts            ← getCurrentNFLSeason()
    │   ├── middleware/
    │   │   └── auth.ts
    │   └── scripts/
    │       └── migrate-2025.ts      ← imports CSV data into database
    ├── dist/                        ← compiled JS (committed to git, used by Railway)
    ├── Dockerfile
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
- Builder: DOCKERFILE (configured in Railway dashboard — `railway.toml` was deleted from repo, Railway setting persists)
- Dockerfile copies pre-compiled dist — does NOT run tsc on Railway
- When making backend changes: ALWAYS run `npm run build` in server/ locally first
- Commit both src/ changes AND dist/ changes together (`git add -f server/dist/`)

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
- additionalStats (jsonb, nullable) — post-game box score stored here
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
- additionalStats (jsonb, nullable) — full box score details
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

### tiebreaker_games / tiebreaker_picks / week_settings / app_settings / pick_audit_log / unlocked_weeks
(unchanged — see prior schema documentation)

---

## Achievement & Trophy System

### Terminology (IMPORTANT)
- **Achievements** = Weekly awards earned throughout the season. Stored in `trophies` DB table. Displayed as "Achievements" everywhere in UI.
- **Trophies** = Season-end podium placements (1st, 2nd, 3rd, last place). **NOT YET BUILT.** Design with Nick before implementing.

### Achievement Types (all bugs fixed in trophyService.ts)
- **most_wins** — Most correct picks that week. Ties = multiple winners.
- **loser** — Most incorrect picks that week. Stings a little.
- **upset_pick** — Correctly picked lowest win probability winner. Uses winningTeamWinProb.
- **lone_wolf** — ONLY player to correctly pick a winner. Rare and valuable.
- **contrarian** — Correctly picked winner when ≤20% of players chose that team. Multiple per week possible.

### Trophy Images
- most_wins, loser, upset_pick, lone_wolf: existing images ✓
- contrarian: NEEDS NEW IMAGE — placeholder for now

---

## Scheduling

| Schedule | What |
|---|---|
| Every 30 seconds | Live score updates (only when games live) |
| Tuesday 6AM PST | Weekly transition (trophies, unlock, stats sync) |
| Tuesday 9PM PST | Win probability refresh |
| Wednesday 6AM PST | Win probability refresh |
| Wednesday 5PM PST | Win probability refresh (added — ESPN sometimes slow) |
| Wednesday 8PM PST | Push: "1 hour left for Week X picks!" ← NOT YET WIRED |
| Wednesday 9PM PST | Picks lock + push notification ← NOT YET WIRED |

Push notification cron triggers (all 5) need to be wired to scheduler.ts — functions exist in notificationService.ts.

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

**TODO:** This function needs updating to handle the preseason start (Aug 7). When preseason starts, the season should flip to 2026 even though it's August. Options: check app_settings for preseasonStartDate, or change cutoff to month >= 8.

### Lock Times
- Default: Wednesday 9PM PST
- Admin-configurable per week via week_settings table
- Season start date: admin-configurable, stored in app_settings

### Preseason — FUNCTIONAL, NOT ISOLATED
The 2026 preseason (Aug 7–Sept 3) is a REAL picks period, not a sandboxed test mode:
- Picks work on preseason games
- Live score updates during preseason games
- Leaderboard tracks preseason results separately from regular season (filtered by seasonType)
- Regular season (Sept 4) resets to Week 1 regular season games — preseason data preserved
- Preseason leaderboard accessible via past seasons / seasonType filter
- The `preseasonMode` app_settings toggle remains as an admin safeguard but preseason IS functional by default

**Rule 11 updated:** Preseason stats and leaderboard are kept SEPARATE from regular season via `seasonType` field, but preseason is fully functional — picks, live scores, and leaderboards all work.

---

## App Navigation

### Bottom Tabs (4)
1. Picks 🏈
2. Leaderboard 🏆
3. Week Picks 👥
4. Profile 👤

### Bell Icon 🔔 (header top-right)
- Activity slide-in panel — Global Feed | Your Activity tabs, paginated 20 per load

### Admin
- Profile → Settings ⚙️ → Admin Dashboard (admins only)
- 3 tabs: Users | NFL Tools | Data
- NFL Tools includes: Sync Games, Sync Scores, Sync Win Probs, Award Achievements, Unlock Week, Score Correction, **Send Test Notification Now**, **Schedule Deadline Reminder Test**

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
- 6px thick pick percentage bars (visible after lock only)
- 3 states: upcoming (pre-game stats), live (score+clock), final (score+result)

### Pre-Game Card Stats (TO BUILD)
Both teams side by side:
- PPG / Opp PPG
- Total yards per game / yards allowed per game
- Pass yards + TDs, Rush yards + TDs
- Defensive ranking
- Win probability bar (already shown)
- Top QB/RB/WR season averages

Week 1 2026 edge case: if no current-season stats exist yet, fall back to prior season stats.

### Leaderboard
- Longies users: Longies/Season default
- Global users: Global/Season default
- Toggles: Longies/Global (top) + Season/Weekly (below)
- **Season selector for all users (TO BUILD)** — same +/− control admin has, lets users view 2025 final standings
- Row: trophy/rank | avatar | team name | "X picks different" | W-L | accuracy%
- Blue highlight own row, tappable rows → profiles

### Week Picks Tab
Before lock: message + past weeks viewable
After lock: compact horizontal grid with synchronized scroll

### Game Detail
- Compact header: "CAR @ TB" + date/time
- Prev/Next + swipe gesture
- Before lock: pre-game stats only, NO picks visible
- After lock: player pick list with avatars
- **Post-game box score section (TO BUILD)** — team totals, top QB/RB/WR (final games only)

### Profile (own)
- Header: avatar, name, member since, Longie badge, ⚙️ gear (admins only), Sign Out
- 2×2 stats: Record | Accuracy | Best Week | Achievements
- Week-by-week color-coded history
- Auto insights: best team, worst team, underdog record, etc. + "Picks by Team →" tappable row
- H2H vs every Longie
- Achievement Case
- **Past Seasons row (TO BUILD)** — W-L per season for historical context

### Picks by Team Screen ✅ BUILT
- Accessible from Profile → Insights → "Picks by Team →"
- User's own W-L record for every team they've picked this season (only settled games)
- Summary bar: overall record, team count, accuracy %
- Sort by: Most Picked (default) | Accuracy | A–Z
- Each row: team logo, name, W-L record, accuracy % (color coded green/yellow/red)
- Tapping a team row navigates to Team Detail
- Only visible to the user themselves (not on public profiles)
- **TODO: real-time updates** — invalidate `['picks-by-team', ...]` when scores sync

### Team Central Screen ✅ BUILT
- Accessible from Picks tab ("Team Central 🏟️" button below WeekSelector)
- Lists all 32 NFL teams with season W-L record + community pick accuracy
- Search bar to filter by team name
- Sort by: Record (default) | Pick % | A–Z
- Each row: logo, name, games played, season W-L, pick accuracy %
- Tapping a team navigates to Team Detail
- **TODO: real-time updates** — invalidate `['teams', ...]` when scores sync

### Team Detail Screen ✅ BUILT
- Accessible from Team Central and Picks by Team
- Team logo hero + season record (color coded) + games played
- Scoring stats: PPG / PPG Allowed / point differential (calculated from actual game scores, NOT ESPN pregame estimates)
- Community Picks section: total picks from all users, W-L breakdown, accuracy bar
- Recent Games: last 10 games with W/L badge, score, opponent logo, vs/@ indicator, week number
- **TODO: expand stats** when `syncTeamStats()` is built — add yards, sacks, rankings from `team_game_stats` table

### Other User Profiles
- H2H vs YOU specifically
- H2H Pick Comparison: current week only, after lock only
- No email, no full pick history

### Admin (3 tabs) — BUILT ✅
**Users:** Inline teamName edit, Longie toggle, Admin/Longie badges.
**NFL Tools:** Week picker, Sync buttons, Award Achievements, Unlock Week, Score Correction, **Notification Testing** (Send Test Now + Schedule with 1/5/10/30m presets).
**Data:** Export Season Data, Export Week Picks.

---

## Pre-Game Stats & Post-Game Box Scores (TO BUILD — Before Launch)

This is a priority feature before launch. The DB tables (`team_game_stats`, `player_stats`) are already in the schema — just needs population and display.

### Pre-Game (ESPN `/summary?event={id}` predictor section)
Sync on: Tuesday 6AM + Wednesday syncs (before lock)
Store in: `team_game_stats` (season stats) + `player_stats` (top performers)
Display on: GameCard pre-game state, Game Detail before lock

Stats to show per team:
- PPG + Opp PPG
- Total YPG + yards allowed
- Pass yards/game + pass TDs/game
- Rush yards/game + rush TDs/game
- Offensive rank + Defensive rank
- Top QB, RB, WR season averages (yards, TDs)

### Post-Game Box Score (ESPN `/summary?event={id}` boxscore section)
Sync on: when game status flips to 'post'
Store in: `team_game_stats.additionalStats` (jsonb) + `player_stats`
Display on: Game Detail final state

Stats to show:
- Team: total yards, pass yards, rush yards, TDs, turnovers, 3rd-down %, red zone
- Top QB: comp/att, pass yards, TDs, INTs
- Top RB: carries, rush yards, TDs
- Top WR: rec/targets, yards, TDs

### Implementation Plan
1. `espnService.ts`: add `syncTeamStats(game)` — pre-game stats from predictor section
2. `espnService.ts`: add `syncBoxScore(game)` — post-game stats from boxscore section
3. Wire `syncTeamStats` to Tuesday 6AM + Wednesday sync crons
4. Wire `syncBoxScore` to live score update loop (trigger when game goes 'post')
5. `GET /api/games` list: include pre-game team stats per game
6. `GET /api/games/:id`: include post-game box score
7. GameCard: show team stats in pre-game state
8. Game Detail: show box score section for final games
9. Add `npm run sync:stats` script to backfill 2025 box scores

---

## Push Notifications

| Trigger | Message | When | Status |
|---|---|---|---|
| Week unlocked | "Week X picks are now open! 🏈" | Tue 6AM | function built, NOT wired |
| Deadline | "1 hour left for Week X picks!" | Wed 8PM | function built, NOT wired |
| Locked | "Picks locked. Good luck! 🏈" | Wed 9PM | function built, NOT wired |
| Achievement | "🏆 You earned [Achievement] for Week X!" | Tue after scoring | function built, NOT wired |
| Final | "Final: [score]. Your pick: ✓/✗" | As games end | function built, NOT wired |

All functions live in `server/src/services/notificationService.ts`. Need to be called from `scheduler.ts`.

### Testing Push Notifications
Admin Dashboard → NFL Tools:
- **Send Test Notification Now** — fires immediately to the admin's device
- **Schedule Deadline Reminder Test** — fires "1 hour left for picks" message after 1/5/10/30 min delay

Requires: EAS dev build installed + app opened at least once to register push token.

Permission: in-app prompt 10 seconds after first login → system dialog. Maybe Later re-asks after 7 days.

---

## Complete Build Plan

### Phase 1 — Backend ✅ COMPLETE
### Phase 2 — Expo Foundation ✅ COMPLETE
### Phase 3 — Auth Screens (mostly complete)
- [ ] Splash/onboarding (logo, tagline)
- [x] Login, Sign up, Forgot password

### Phase 4 — Core Screens ✅ COMPLETE

### Phase 5 — Advanced Features (IN PROGRESS)
- [x] EAS project initialized, eas.json created, expo-dev-client installed ✅
- [x] EAS iOS dev build installed on Nick's iPhone ✅ (June 1 2026)
- [x] Preview build installed on Nick's iPhone ✅ (June 2 2026, `cfa11e3a`)
- [x] OTA updates working on preview channel ✅ — `eas update --branch preview`
- [ ] Google/Apple Sign-In — code complete, Firebase config fixes needed (see BLOCKED)
- [x] Activity bell panel ✅
- [x] notificationService.ts — all 5 triggers built ✅
- [x] Notification testing in Admin Dashboard ✅ (Send Test Now + Schedule)
- [ ] Wire push notification cron triggers to scheduler.ts
- [x] Admin dashboard ✅
- [x] Picks by Team screen ✅ (June 2 2026)
- [x] Team Central screen ✅ (June 2 2026)
- [x] Team Detail screen ✅ (June 2 2026)
- [ ] Team Central + Picks by Team real-time cache invalidation

### Phase 6 — Season & History
- [ ] Preseason handling — season flip Aug 7, functional picks/leaderboard for preseason
- [ ] Past seasons feature — leaderboard season selector + profile past seasons row
- [ ] `getCurrentNFLSeason()` updated to handle preseason start date

### Phase 7 — Team Stats & Box Scores (Before Launch)
- [ ] `syncTeamStats()` in espnService.ts — pre-game stats from ESPN predictor
- [ ] `syncBoxScore()` in espnService.ts — post-game box scores stored permanently
- [ ] Wire to cron schedule (pre-game: Tuesday + Wednesday; post-game: live loop)
- [ ] API returns stats with game data
- [ ] GameCard pre-game state shows team stats
- [ ] Game Detail final state shows box score
- [ ] Backfill 2025 box scores with sync:stats script

### Phase 8 — TestFlight & Migration (Early July)
- [ ] `eas build --platform ios --profile preview` + `eas submit --platform ios`
- [ ] Add Longies as TestFlight testers by email
- [ ] 7 Longies sign up with Google/Apple Sign-In
- [ ] Run UID reassignment script
- [ ] Verify 2025 stats correct for all users
- [ ] Fix issues via OTA updates

### Phase 9 — Polish
- [ ] Loading/error/empty states everywhere
- [ ] Android testing (emulator or Nick's dad's phone)
- [ ] Achievement case UI redesign with custom images
- [ ] UI + icon polish pass
- [ ] Haptic feedback via expo-haptics (OTA-safe)
- [ ] **In-app feedback / bug report** — Profile tab, sends email to nickcorum@gmail.com. Decide mailto vs backend form before building.

### Phase 10 — App Store Submission (Target: Late July)

#### Before Either Store
- [ ] Privacy policy live at a URL (GitHub Pages is fine)
- [ ] Terms of service live at a URL
- [ ] Support email working
- [ ] Zero crashes on core flows
- [ ] Push notifications tested and working
- [ ] Google/Apple sign-in working

#### Apple App Store
- [ ] App icon (1024×1024px)
- [ ] Screenshots: 6.5" iPhone required
- [ ] App name: "The Long Game" / Subtitle: "NFL Picks & Leaderboards"
- [ ] Category: Sports, Age rating: 4+
- [ ] `eas build --platform ios --profile production`
- [ ] `eas submit --platform ios` — review 1-7 days

#### Google Play Store
- [ ] Set up Google Play Developer account ($25) — NOT DONE YET
- [ ] `eas build --platform android --profile production`
- [ ] `eas submit --platform android` — review 1-3 days

---

## Future Features — Post-Launch

### Team History Screen
Tapping a team logo opens that team's past game history. ESPN `/teams/{teamId}/schedule` endpoint.

### Premium ("Long Game Pro") ~$4.99/month or $29.99/season
- Stripe web-only (no in-app purchase — avoids Apple's 30% cut)
- Powered by OUR OWN database — not a third-party API
- Win probability bucket analysis, matchup intelligence, historical trends
- isPremium field already in users table

### Private Pools — Target: 2026–2027 Season
Commissioner, buy-in tracking, pool leaderboards, pool game modes. Friends/coworkers compete in their own group with optional buy-in.

**Architecture notes (discussed June 2026):**
- Current `isLongie` boolean is a hardcoded single-pool concept — when pools arrive, "Longies" becomes just one pool among many and `isLongie` migrates to pool membership
- Needs: `pools` table (id, name, commissioner, invite code, buy-in) + `pool_members` table (poolId, userId, role)
- Leaderboard, tiebreaker, and trophy queries need a `poolId` filter option added
- Current architecture is clean enough to add pools without a rebuild — it's an addition, not a rewrite

### Admin: Custom Push Broadcast — Target: 2026 Season
Allow admins to send a custom push notification message to all users (or a subset) directly from the Admin Dashboard. Use case: announcements, hype messages, reminders.

**Scope when building:**
- New "Broadcast" section in Admin → NFL Tools tab (or its own tab)
- Input: message title + body text
- Target selector: All Users / Longies Only / specific user(s)
- Sends via existing `notificationService.ts` / Expo Push API infrastructure
- Log sent broadcasts to `activity_log` for audit trail

### Game Modes
- Probability Mode: points scale with win probability
- Upset Hunter: underdog picks only
- Lock of the Week: double or nothing one pick

### Trophies (Podium) System
Season-end 1st/2nd/3rd/last place awards. Last-place prize keeps eliminated players engaged. Design with Nick before implementing.

### Additional Sports (curated)
March Madness brackets, FIFA World Cup brackets, NCAA Top 25.

---

## ESPN API

Base: https://site.api.espn.com/apis/site/v2/sports/football/nfl
- Scoreboard: /scoreboard?week={week}&seasontype=2&season={year}
- Preseason: /scoreboard?week={week}&seasontype=1&season={year}
- Game summary (stats + box score): /summary?event={espnId}
- Team stats: /teams/{teamId}/statistics
No API key required. Win probability range: ~20%–80%.

---

## Mobile Setup — Lessons Learned

These are hard-won fixes. Don't undo them.

### Node.js Version — REQUIRED: v20+
- Expo SDK 54 requires Node.js v20 or higher
- Fix: `nvm install 20 && nvm use 20` (nvm-windows is installed)

### Package Installation
- Always use `--legacy-peer-deps` when running `npm install` in mobile/

### NativeWind v4
- `babel.config.js`: `jsxImportSource: 'nativewind'` inside babel-preset-expo options
- `metro.config.js`: wrap with `withNativeWind(config, { input: './src/global.css' })`

### react-native-reanimated v4
- Babel plugin: `'react-native-worklets/plugin'` NOT `'react-native-reanimated/plugin'`

### Firebase Auth
- Use Firebase JS SDK v12 (NOT @react-native-firebase)
- `getReactNativePersistence` needs module augmentation in `nativewind-env.d.ts`

### TextInput (iOS)
- NEVER set padding via className — iOS clips text
- Use `style={{ height: 52, paddingHorizontal: 16 }}` as a prop

### Apple/Google Sign-In in Expo Go
- Both DO NOT work in Expo Go — bundle ID mismatch
- Fix = EAS dev build. All config is correct and ready to test.

### EAS Build — Package Versions Must Match SDK 54 Exactly
EAS runs strict `npm ci` (no `--legacy-peer-deps`). Two things required:
1. `mobile/.npmrc` must contain `legacy-peer-deps=true` — already committed.
2. Package versions must satisfy Expo SDK 54 peer deps. Run `npx expo-doctor` before any EAS build. Correct versions for SDK 54:
   - `expo`: `~54.0.35`
   - `expo-dev-client`: `~6.0.21` (NOT `^56.x` — that's a completely wrong major)
   - `expo-router`: `~6.0.24`
   - `react-native-worklets`: `0.5.1` (reanimated 4.1.x hard-validates this at pod install level — `0.9.x` will fail)
   - Always use `npx expo install <package>` not plain `npm install` for Expo packages

### EAS CLI on Windows — CRITICAL
EAS CLI v20 has a Windows `EPERM: rmdir` bug during project upload.
**Patch location:** `C:\nvm4w\nodejs\node_modules\eas-cli\build\build\utils\repository.js`
**Fix:** Wrap `finally { await fs_extra.remove(shallowClonePath) }` in try/catch swallowing EPERM.
**This patch is lost on `npm install -g eas-cli` upgrades — re-apply after any upgrade.**

### To Start the App
```
cd mobile
npx expo start
```
Add `--clear` for Metro cache issues.

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
11. Preseason picks and leaderboard are FUNCTIONAL. Preseason stats kept separate from regular season via `seasonType` field. Preseason leaderboard is its own view, not mixed into regular season standings.
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

- Preseason season flip: change `getCurrentNFLSeason()` to flip on Aug 7, or use app_settings `preseasonStartDate`?
- Past seasons: how many years back to support in season selector?
- Trophies (podium) system design — 1st/2nd/3rd/last place, prize details
- Contrarian trophy artwork
- Premium pricing and features
- Google Play account setup timing
- Domain name decision

---

## About Nick

- GitHub: corumnick-oss
- Admin team name: Nicholas
- Windows 11, iPhone, no prior mobile dev experience
- Always ask before making product/design decisions
- Use Claude.ai chat for planning and strategy
- Use Claude Code for building
- Original Replit web app — do not reference that code

---

## Future: UI & Icon Polish Pass

**Lowest priority — do after launch or as OTA update.**

**Admin Dashboard** — tab bar polish, score editor inputs, avatar initials on user cards
**Activity Panel** — empty state illustration, Dynamic Island safe area
**Profile Tab** — achievement case custom artwork, gear icon layout
**Picks Tab / GameCard** — CORRECT/WRONG badges could be icon-only; live pulsing indicator
**Week Picks Tab** — name column width may truncate on some screen sizes
**All Tabs** — haptic feedback (expo-haptics, OTA-safe), custom tab bar icon set, consistent activeOpacity

Do as a dedicated polish session after core launch requirements are met. Most are OTA-safe.
