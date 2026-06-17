# The Long Game — Complete Project Briefing for Claude Code

## IMPORTANT: Read This First
This document contains everything you need to know about this project. Read it completely before writing any code or making any suggestions. Every decision in here has been carefully discussed and agreed upon with Nick (the owner). Do not deviate from these decisions without explicitly asking first. When in doubt, ask Nick.

**ALWAYS confirm your implementation plan with Nick BEFORE writing any code.** List the files you intend to change and what you'll do to each. Wait for Nick to say "go ahead" or "yes" before making edits. This prevents wasted work if Nick's priorities have changed.

When starting a session say: "I've read CLAUDE.md and I'm ready to continue."

---

## ⚠️ DO THIS FIRST NEXT SESSION

### ACTION REQUIRED: Re-unlock preseason week 1 picks
The DB migration added `season_type` to `unlocked_weeks` and cleared the old stale row. Nick must open the Admin tab → NFL Tools → select **Preseason** tab → Week 1 → tap **Unlock Week**. This re-enables preseason week 1 picks with the correct seasonType.

### Bug to fix next session: GameCard bounces when changing pick
Tapping to change a pick still causes the GameCard to briefly jump/bounce in the FlatList. The `✓` checkmark was made always-rendered with transparent color to fix the text-level shift, but something else is still causing a height change — likely the stats lines (PPG/YPG) conditionally showing/hiding or a border width change. Investigate what changes between picked/unpicked state in `TeamRow` (in `GameCard.tsx`) and ensure all conditional content reserves constant height.

### Next priority items after that:
1. **Team Central + Picks by Team real-time cache invalidation** — invalidate `['teams', ...]` + `['picks-by-team', ...]` when live score sync runs
2. **Past seasons row on Profile** — W-L per season for historical context
3. **Onboarding polish** — Nick wants redesign before launch
4. **TestFlight preview build for Longies** — early July, `eas build --profile preview` + `eas submit`

### ⚠️ BEFORE PRESEASON STARTS (Aug 7) — Default Picks Preseason Fix
`applyDefaultPicks()` in `scheduler.ts` hardcodes `seasonType: 'regular'`. During preseason weeks (Aug 7–28), it queries for regular season games, finds none, and silently does nothing — **preseason default picks will NOT fire**. Regular season (Sept 4+) works correctly.

**Fix needed before Aug 7:** Detect the active seasonType from the week's games (or pass it in from the scheduler context) instead of hardcoding `'regular'`. The lock cron already knows the week — add a query to determine whether that week has preseason or regular season games and pass it through.

**Also future feature:** Add a rules/explanation page in the app so users know that missing picks defaults to Raiders (if playing) or away team.

### COMPLETED SESSION June 20 2026 (picks gate fix)
- **Picks gate: `isPicksOpen` via `unlockedWeeks`** — Root cause of "all 2026 regular season games open": season flip to March broke the old `game.season > getCurrentNFLSeason()` guard. Fixed with proper DB-backed gate:
  - `unlocked_weeks` table got a new `season_type` column (migration run locally: `npm run migrate:unlocked-weeks`)
  - `GET /api/games` now returns `isPicksOpen: boolean` per game based on `unlockedWeeks` (week+season+seasonType)
  - `POST /api/picks` rejects with 403 if week not in `unlockedWeeks` for that seasonType
  - `GET /api/admin/unlock-week` now accepts and stores `seasonType`
  - Tuesday 6AM scheduler auto-inserts into `unlockedWeeks` when opening regular season weeks
  - `GameCard.tsx` uses `game.isPicksOpen` instead of season-year comparison
  - Admin Unlock Week dialog now shows which seasonType is being unlocked
- **2026 regular season picks deleted** — Nick manually deleted them; no 2025 data was touched
- Backend rebuilt and deployed to Railway; OTA pushed to preview branch

### COMPLETED SESSION June 19 2026
- **Season selector layout fixed (Profile + Team Detail)** — compact centered circular buttons matching admin week picker style. OTA pushed.
- **Team Detail season-change crash fixed** — two-part fix: (1) `seasonType` converted to state, resets to 'regular' when season changes; (2) backend `teams.ts` now translates team name full↔abbrev (using `NFL_FULL_TO_ABBREV`/`NFL_ABBREV_TO_FULL`) and retries lookup if initial query returns empty — fixes crash when navigating from 2026 full-name to 2025 abbreviated data. Backend rebuilt and deployed.
- **Push notifications confirmed wired** — all 5 functions already called: `notifyWeekUnlocked` + `notifyDeadlineApproaching` + `notifyPicksLocked` in `scheduler.ts`; `notifyAchievementEarned` in `trophyService.ts`; `notifyGameFinal` in `espnService.ts`. CLAUDE.md was stale on this.
- **Season flip cutoff changed to March** — `getCurrentNFLSeason()` now returns current year when `month >= 3` (was `month >= 8`). App now shows 2026 as the current season. Both `server/src/utils/season.ts` and `mobile/src/lib/nflSeason.ts` updated. Backend deployed, OTA pushed.
- **Pick indicator improved** — selected team row highlighted with 20% blue background (was ~0%); non-picked team dims when other is selected. `GameCard.tsx` updated. OTA pushed.
- **Default picks at lock time** — `applyDefaultPicks()` runs at Wednesday 9PM PT after lock; fills missing picks with Raiders (if playing) or away team; sends push notification to affected users. `notifyDefaultPicksApplied()` added. Backend deployed. NOTE: only works for regular season — see preseason fix note above.

### COMPLETED SESSION June 18 2026
- **Pre-game stats fix (2026)** — Root cause: `team_game_stats` stores 2025 team names as ESPN abbreviations; 2026 `games` table stores full names. `fetchTeamStatsMap` fallback was querying full names against abbreviation rows → no match. Added `NFL_FULL_TO_ABBREV` map (32 teams) in `server/src/routes/games.ts`; translate names before 2025 fallback query and match rows by either format when averaging. Backend rebuilt and deployed.
- **Spread replaced with win probability** — GameCard divider: removed `Spread: X` label. Game Detail header: shows `away% – home%` under "vs" when `winningTeamWinProb` + `favoriteTeam` are set. Removed Spread stat row from pre-game stats table. WinProbBar remains at bottom of stats section.
- **Stat table header alignment fixed** — pre-game and box score headers used `justify-between` with auto-width label; `StatRow` uses `flex-1`. Switched headers to `flex-row` with `flex-1` label so columns line up. Both pre-game averages and box score headers fixed.
- **Android preview APK built** — `eas build --profile preview --platform android`. Download link available in EAS dashboard. OTA updates work on Android preview build the same as iOS (`eas update --branch preview`).

### COMPLETED SESSION June 17 2026
- **ESPN stats sync root cause** — ESPN returns 400 for historical 2025 game summaries from Railway's server IP (server-side block on bulk historical data). Works fine from local/browser IPs.
- **`backfill-stats-local.ts` script** — runs ESPN backfill from local machine, bypassing Railway IP block. `npm run backfill:stats` in server/. Re-run after any espnService.ts changes.
- **Expanded stats** — extracted sacks (defensive), turnovers, first downs, raw ratio strings (e.g. "6-14" for 3rd down) from ESPN boxscore. Added to `team_game_stats` via `sackRate` column + `additionalStats` JSONB fields.
- **Box score on Game Detail (post-game)** — `game/[id].tsx` now shows actual box score for completed games (Total/Pass/Rush yards, 3rd Down as ratio, Red Zone as ratio, Sacks, Turnovers, 1st Downs). Pre-game still shows season averages. Live shows neither.
- **Expanded averages on Game Detail (pre-game)** — stats table now includes 3rd Down %, Red Zone %, Sacks/G, Turnovers/G in addition to existing PPG/YPG stats.
- **Efficiency section on Team Detail** — new section below Yards with 3rd Down %, Red Zone %, Sacks/G, Turnovers/G.
- **2026 pre-game fallback** — backend already had 2025 fallback logic in `fetchTeamStatsMap`. Now populated with full stats. 2026 games will auto-populate as they complete via live sync.
- **2025 data fully backfilled** — all 272 regular season games have complete box score stats in `team_game_stats`. Re-ran `npm run backfill:stats` locally after expanding ESPN extraction.
- **ESPN box score sync (live 2026)** — `syncBoxScoreStats` fires automatically when a game goes `in → post` in the live loop. New fields will populate in real time.

### COMPLETED SESSION June 16 2026
- **Pre-game team stats** — full implementation shipped (backend + mobile). See session-2026-06-16.md for complete file list.
- **Win probability `*100` bug** — FIXED in GameCard.tsx and game/[id].tsx WinProbBar.
- **Startup crash (ypg)** — `ypg` added to TeamRow type but missing from destructuring → ReferenceError crash on every render. FIXED.
- **Season selectors** — +/- on Profile tab and Team Detail screen. Buttons visible now but layout wrong (see fixes above). Upper bound uses `new Date().getFullYear()`.
- **Team detail Yards section** — YPG/YAPG/Pass YPG/Rush YPG display added below Scoring section.
- **Admin Sync Team Stats button** — in NFL Tools tab, triggers backfill of all completed games for selected season/type. Note: Admin button still hits Railway (blocked for historical data) — use `npm run backfill:stats` locally instead.

### COMPLETED SESSION June 15 2026
- **Picks tab crash** — `onTeamPress` in `TeamRow` type but missing from destructuring → ReferenceError. Fixed. Error boundary removed.
- **Admin/Data tab week default** — `getCurrentNFLWeek()` returned 18 in offseason. Fixed: return 1 when week > 18.
- **2026 regular season synced** — 272/272 games (all with logos). ESPN scoreboard blocked for future seasons; team-schedule approach works.
- **2026 preseason synced** — 49 games (weeks 1–4). Week 1 = Hall of Fame game only.
- **Team logos fixed** — ESPN summary returns empty logo for future games; sync script now collects logos from team schedule (`logos[0].href`) and uses as fallback.
- **"Picks locked" message** — hidden for future season games (`game.season > getCurrentNFLSeason()`).
- **Team tap in game detail** — tapping team logo/name in `game/[id].tsx` navigates to Team Central.
- **`sync:2026:preseason` npm script** — `--preseason` flag added to local sync script.
- **Diagnostic no-auth routes removed** — `GET /api/admin/test-espn-2026` and `test-espn-scoreboard-2026` removed from `admin.ts`. Built and pushed.
- **Live score fixes** — `updateLiveScores()` seasonType bug fixed; OT/HALFTIME display added; client polls every 30s during live games. Committed.

---

## ⚠️ ALSO CHECK AT SESSION START

Files that should exist but are NOT in git (verify manually):
- `mobile/.env` (gitignored — contains `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 309276847432-j5unna6kj6k780gsk6fksveoklv57673.apps.googleusercontent.com`)
- `server/.env` (gitignored — contains all Railway secrets)
- `server/dist/` (in .gitignore but force-committed — check `git ls-files server/dist | head` to confirm it's tracked)

---

## Project Overview

**App Name:** The Long Game  
**Type:** iOS and Android mobile app (React Native / Expo)  
**Purpose:** NFL picks app where users predict game winners and compete on leaderboards  
**Status:** Phase 5 in progress. Preview build (`cfa11e3a`) on Nick's iPhone. OTA updates working on preview channel.  
**Railway URL:** https://thelonggame-production.up.railway.app  
**Target Launch:** App Store submission late July 2026. Regular season starts September 4, 2026.  
**Owner:** Nick (Corums) — GitHub: corumnick-oss — Windows 11 — iPhone — Admin team name: Nicholas  
**Local Code Path:** C:\Dev\TheLongGame

---

## Launch Strategy

- Submit to Apple and Google in **late July** — before preseason starts August 7
- Use **preseason (Aug 7-28) as live testing** via OTA updates while app is already in the App Store
- **Hard deadline:** Regular season September 4, 2026

### 3 Ways to Push Updates
1. **OTA Updates** — INSTANT, no review. `eas update --branch preview` for preview build, `--branch development` for dev build. **CRITICAL: `--branch preview` only — publishing to `production` or `development` will NOT reach preview build.**
2. **Backend Updates** — INSTANT. Push to GitHub → Railway auto-deploys.
3. **App Store Update** — 1-3 days. Only for new native packages, permission changes, or major version bumps.

### Build Types
| Build | Command | Purpose |
|---|---|---|
| `development` | `eas build --profile development` | Dev testing (Nick only) |
| `preview` | `eas build --profile preview` | TestFlight beta (Longies) |
| `production` | `eas build --profile production` | App Store |

### EAS CLI Windows Bug — IMPORTANT
EAS CLI v20 has `EPERM: operation not permitted, rmdir` bug on Windows during upload.  
**Patch:** `C:\nvm4w\nodejs\node_modules\eas-cli\build\build\utils\repository.js` — wrap the `finally` block's `remove` call in try/catch swallowing EPERM.  
**⚠️ Lost on any `npm install -g eas-cli` upgrade — re-apply after every upgrade.**

---

## Current Status

### What's Built (as of June 4 2026)
All core infrastructure and screens are complete:
- Backend deployed to Railway, all API routes working, 2025 season data in DB (272 games)
- EAS dev build + preview build installed on Nick's iPhone; OTA updates confirmed working
- Google + Apple Sign-In fixed June 3 2026

**Screens and features:**
- **Picks tab** — GameCard (pre/live/final states), WeekSelector, TiebreakerCard, pick % bars after lock, preseason/regular toggle, Team Central entry button
- **Leaderboard tab** — Longies/Global + Season/Weekly toggles, rank badges, W-L + accuracy, tap rows → profiles
- **Week Picks tab** — compact grid with synchronized horizontal scroll, pick outcome tinting, season/type selector
- **Profile tab** — avatar, season stats, weekly history color blocks, insights, H2H vs Longies, achievement case
- **Game Detail** (`game/[id].tsx`) — compact header, prev/next, pre-game stats (PPG/OppPPG), pick list after lock
- **Public Profile** (`user/[id].tsx`) — H2H vs viewer, pick comparison (current week, after lock only)
- **Picks by Team** (`picks-by-team.tsx`) — from Profile → Insights; W-L per team, sortable, taps → Team Detail
- **Team Central** (`team-central.tsx`) — from Picks tab; all 32 teams, W-L + community pick %, search + sort
- **Team Detail** (`team/[name].tsx`) — logo/record, PPG/PPG-Allowed/point diff, community picks, last 10 games
- **Admin Dashboard** (`admin.tsx`) — Users tab (teamName edit, Longie toggle), NFL Tools tab (sync + notifications + score correction), Data tab (exports)
- **Activity bell** — slide-in drawer, Global Feed + Your Activity tabs, paginated 20/load
- **Onboarding/splash** — embedded in `login.tsx`, shown once via AsyncStorage

### Known TODOs (Before Launch)
- **Pre-game team stats on GameCard** — BEFORE LAUNCH. ESPN `/summary?event={id}` predictor section. DB tables (`team_game_stats`, `player_stats`) already exist.
- **Post-game box scores on Game Detail** — BEFORE LAUNCH. ESPN boxscore section, stored permanently after each game.
- **Wire push notification crons** — all 5 functions built in `notificationService.ts`, need calling from `scheduler.ts`.
- **Team Central + Picks by Team real-time updates** — invalidate `['teams', ...]` + `['picks-by-team', ...]` cache keys when live score sync runs (same logic as `['games', ...]`).
- **Preseason season flip** — `getCurrentNFLSeason()` needs to flip on Aug 7, not Sept 1. Options: change cutoff to month >= 8, or check app_settings for preseasonStartDate. Discuss with Nick.
- **Past seasons row on Profile** — W-L per season for historical context.
- **Onboarding polish** — Nick wants redesign before launch (currently plain emoji icons, needs custom imagery).
- **Week 18 2025 tiebreaker wrong** — check `tiebreaker_games` and `tiebreaker_picks` tables for week 18 season 2025.
- **Achievement case UI redesign** — placeholder emojis need custom artwork. Contrarian image never created.
- **Trophies (podium) system** — season-end 1st/2nd/3rd/last place. NOT YET BUILT. Design with Nick first.
- **In-app feedback / bug report** — Profile tab, email to nickcorum@gmail.com. Decide: `mailto:` deep link (OTA-safe, zero backend) vs. in-app form via nodemailer/SendGrid. Discuss with Nick.
- **Admin email editing** — deferred. Workaround: new account + UID reassignment.

### seed:nick — Re-run After Any Cleanup
`npm run seed:nick` (from server/) sets nickcorum@gmail.com as isAdmin=true, isLongie=true, teamName=Nicholas and copies 179 2025 picks + all trophies from CSV. Requires FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in server/.env.

### Season Detection — ALWAYS USE THIS
```typescript
export function getCurrentNFLSeason(): number {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  return month >= 9 ? year : year - 1;
}
```
NEVER hardcode 2025 or any year. Lives in `server/src/utils/season.ts` and `mobile/src/lib/nflSeason.ts`.

### What's Next — Priority Order
1. **Investigate ESPN stats sync** — check Railway logs for "No boxscore teams" warnings; determine if ESPN returns historical boxscore data from server; fix if needed
2. **Wire push notification crons** — call functions from `notificationService.ts` in `scheduler.ts`
3. **Preseason season flip** — `getCurrentNFLSeason()` update for Aug 7 (hard deadline — preseason starts Aug 7)
4. **Post-game box scores on Game Detail** — `syncBoxScoreStats` is built; add final-game display section on Game Detail
5. **Team Central + Picks by Team real-time cache invalidation**
6. **Past seasons** — Profile past seasons row
7. **Onboarding polish**
8. **TestFlight preview build for Longies** — early July, `eas build --profile preview` + `eas submit`
9. **2025 data migration** — when Longies sign up with Google/Apple
10. **App Store + Google Play submission** — target late July

---

## Deployment

### Backend Changes Workflow (DO NOT CHANGE THIS)
- Railway injects NODE_ENV=production which breaks TypeScript — so we pre-compile locally
- When making backend changes: run `npm run build` in server/ first, then commit both src and dist
- `git add -f server/dist/` (it's in .gitignore but must be committed)
- Push to main → Railway auto-deploys via Dockerfile (which copies pre-compiled dist)
- Build command in Railway: blank. Start command: `node dist/index.js`
- GitHub repo: corumnick-oss/the-long-game (lowercase, hyphen)
- drizzle-orm pinned to 0.45.1 (0.45.2 broken publish)
- axios pinned to 1.7.9 (1.16.0 broken publish)
- TypeScript pinned to ^5.8.3 (6.x has incompatible module resolution)

### Railway Environment Variables — CRITICAL
- **No trailing whitespace on any variable** — especially FIREBASE_PROJECT_ID (had trailing space that silently broke all token auth; symptom: "incorrect aud claim" with spaces in expected value)
- FIREBASE_PRIVATE_KEY: no quotes, keep all \n characters
- If picks/myPick ever stop working: check Railway Variables for trailing spaces

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
Firebase project: the-long-game-prod-bef05. Bundle ID: com.thelonggame.picks — **NEVER CHANGE**.

---

## The Longies — Nick's Friend Group

7 active users from 2025 season. All isLongie: true. Will create FRESH accounts via Google/Apple Sign-In, then Nick runs UID reassignment script.

| Team Name | Email | Is Admin |
|---|---|---|
| Nicholas (Nick) | b2msbro@gmail.com | YES |
| Squid | cloud7king10@yahoo.com | no |
| Kevin Akers | kakers91@gmail.com | no |
| The Purdy Mouths | jhayhurst714@gmail.com | no |
| Gmac | garciagarrett24@gmail.com | no |
| Leo | leocorum@gmail.com | no |
| EWIK | erikhernandez531@yahoo.com | no |

DO NOT migrate: CBB Test (nicholas.corum@sce.com) or blank team name (nickcorum@gmail.com).

**2025 Final Leaderboard** (verify migration against this):
1. Kevin Akers 181-91 (66.5%) | 2. Nicholas 179-93 (65.8%) | 3. Squid 177-95 (65.1%)
4. Leo 175-97 (64.3%) | 5. EWIK 172-100 (63.2%) | 6. The Purdy Mouths 165-107 (60.7%) | 7. Gmac 165-107 (60.7%)

Migration script: `server/src/scripts/migrate-2025.ts` — imports 7 users, 272 games, 1903 picks, 109 trophies from `data/` CSVs. Skip: activity_log, pick_audit_log, unlocked_weeks, sessions.

---

## Tech Stack

### Mobile
- React Native with Expo (SDK 54, React Native 0.81.5, New Architecture enabled)
- Expo Router v6 (file-based navigation)
- TanStack Query v5
- Firebase JS SDK v12 (auth — NOT React Native Firebase)
- NativeWind v4 (Tailwind for React Native)
- Expo Notifications + Expo Push API
- EAS Build + EAS Submit + Expo Updates (OTA)
- expo-dev-client

### Backend
- Express.js + TypeScript, PostgreSQL on Railway, Drizzle ORM
- Firebase Admin SDK (verify tokens), node-cron, ESPN public API (no key)

### Auth
- Firebase project: the-long-game-prod-bef05
- Sign-in: Email/Password + Google + Apple (Apple required whenever Google is offered)
- Profile photo from OAuth if available, initials fallback

### Infrastructure
- GitHub: corumnick-oss/the-long-game
- Railway: auto-deploys on push to main
- Apple Developer: approved (Individual account)
- EAS Project: @nickcorum/the-long-game (projectId: cb389856-b1ab-42c9-a22b-803f25093e22)
- Google Play: NOT set up yet
- Bundle ID: com.thelonggame.picks (both platforms)

---

## File Structure

```
TheLongGame/
├── CLAUDE.md
├── FUTURE.md                        ← post-launch features (read when planning future work)
├── data/                            ← 2025 CSV files for migration
├── mobile/
│   ├── app/
│   │   ├── _layout.tsx              ← root layout (QueryClientProvider + AuthProvider + AuthGate)
│   │   ├── admin.tsx                ← Admin Dashboard (3 tabs: Users, NFL Tools, Data)
│   │   ├── picks-by-team.tsx        ← Picks by Team (from Profile → Insights)
│   │   ├── team-central.tsx         ← Team Central list (from Picks tab)
│   │   ├── team/[name].tsx          ← Team Detail
│   │   ├── game/[id].tsx            ← Game Detail
│   │   ├── user/[id].tsx            ← Public profile
│   │   ├── (auth)/
│   │   │   ├── login.tsx            ← login + onboarding/splash (shown once via AsyncStorage)
│   │   │   ├── signup.tsx
│   │   │   └── forgot-password.tsx
│   │   └── (tabs)/
│   │       ├── _layout.tsx          ← 4 bottom tabs + bell icon header
│   │       ├── picks.tsx
│   │       ├── leaderboard.tsx
│   │       ├── week-picks.tsx
│   │       └── profile.tsx
│   ├── src/
│   │   ├── components/
│   │   │   ├── GameCard.tsx
│   │   │   ├── WeekSelector.tsx
│   │   │   ├── TiebreakerCard.tsx
│   │   │   └── NotificationPrompt.tsx
│   │   ├── context/AuthContext.tsx  ← Firebase auth (email + Google + Apple)
│   │   ├── hooks/
│   │   │   ├── usePicksData.ts
│   │   │   ├── useAdminData.ts
│   │   │   ├── useNotificationPermission.ts
│   │   │   ├── useProfile.ts        ← useMyProfile, useMyAchievements, usePicksByTeam
│   │   │   ├── useTeams.ts          ← useTeamList, useTeamDetail
│   │   │   ├── useLeaderboard.ts
│   │   │   └── useWeekPicks.ts
│   │   └── lib/
│   │       ├── firebase.ts
│   │       ├── queryClient.ts       ← TanStack Query + apiFetch() with Bearer token
│   │       ├── nflSeason.ts         ← getCurrentNFLSeason(), getCurrentNFLWeek()
│   │       └── lockTime.ts
│   ├── app.json, eas.json, babel.config.js, metro.config.js
│   ├── .env                         ← EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
│   └── package.json
└── server/
    ├── src/
    │   ├── db/schema.ts             ← complete Drizzle schema ← READ THIS for DB structure
    │   ├── routes/
    │   │   ├── activity.ts, admin.ts, games.ts, leaderboard.ts
    │   │   ├── picks.ts             ← includes GET /by-team?season=X
    │   │   ├── pushTokens.ts, teams.ts, tiebreaker.ts, trophies.ts, users.ts
    │   ├── services/
    │   │   ├── espnService.ts       ← ALL ESPN logic isolated here
    │   │   ├── notificationService.ts ← all 5 push triggers (not yet wired to crons)
    │   │   ├── scheduler.ts         ← cron jobs
    │   │   └── trophyService.ts
    │   ├── utils/season.ts          ← getCurrentNFLSeason()
    │   ├── middleware/auth.ts
    │   └── scripts/migrate-2025.ts
    ├── dist/                        ← committed to git, used by Railway
    ├── Dockerfile
    └── package.json
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

### Railway Variables
Same as local, plus: NODE_ENV=production, FIREBASE_PRIVATE_KEY without quotes. **No trailing whitespace on any variable.**

---

## Database Schema

See **`server/src/db/schema.ts`** for the complete Drizzle schema.

Key business logic fields to know:
- `games.seasonType`: `'regular'` | `'preseason'` | `'postseason'` — used to separate preseason from regular season stats/leaderboards
- `games.season`: always use `getCurrentNFLSeason()`, never hardcode
- `games.status`: `'pre'` | `'in'` | `'post'`
- `games.isScoreLocked`: admin can lock individual game scores
- `picks.pick`: `'home'` | `'away'`
- `picks.pickWinProbability`: ESPN win % for the picked team at moment of submission
- `trophies` table stores what UI calls **Achievements** (weekly awards). Season-end podium **Trophies** are not yet built.
- Every table has a `sport` field (default `'nfl'`) for future multi-sport support

Additional tables beyond the main ones: `tiebreaker_games`, `tiebreaker_picks`, `week_settings`, `app_settings`, `pick_audit_log`, `unlocked_weeks`, `push_tokens`, `activity_log`, `team_game_stats`, `player_stats`.

---

## Achievement & Trophy System

### Terminology (IMPORTANT)
- **Achievements** = Weekly awards. Stored in `trophies` DB table. Always say "Achievements" in UI.
- **Trophies** = Season-end podium (1st/2nd/3rd/last). **NOT YET BUILT.** Design with Nick first.

### Achievement Types (bugs fixed in trophyService.ts)
- **most_wins** — Most correct picks that week (ties = multiple winners)
- **loser** — Most incorrect picks that week
- **upset_pick** — Correctly picked lowest win probability winner (uses `winningTeamWinProb`)
- **lone_wolf** — ONLY player to correctly pick a winner
- **contrarian** — Correctly picked winner when ≤20% of players chose that team

Trophy images: most_wins, loser, upset_pick, lone_wolf have images. **contrarian needs new image** — placeholder now.

---

## Scheduling

| Schedule | What |
|---|---|
| Every 30 seconds | Live score updates (only when games in progress) |
| Tuesday 6AM PST | Weekly transition (trophies, unlock, stats sync) |
| Tuesday 9PM PST | Win probability refresh |
| Wednesday 6AM PST | Win probability refresh |
| Wednesday 5PM PST | Win probability refresh |
| Wednesday 8PM PST | Push: "1 hour left for Week X picks!" ← **NOT YET WIRED** |
| Wednesday 9PM PST | Picks lock + push notification ← **NOT YET WIRED** |

All 5 push functions in `notificationService.ts`. Need to be called from `scheduler.ts`.

### Lock Times
- Default: Wednesday 9PM PST
- Admin-configurable per week via `week_settings` table

### Preseason — FUNCTIONAL, NOT ISOLATED
The 2026 preseason (Aug 7–Sept 3) is a REAL picks period:
- Picks, live scores, and leaderboard all work during preseason
- Preseason stats kept SEPARATE from regular season via `seasonType` field
- Regular season (Sept 4) resets to Week 1 — preseason data preserved and accessible via seasonType filter
- `preseasonMode` app_settings toggle exists as admin safeguard but preseason IS functional by default

---

## App Navigation

**Bottom Tabs:** Picks 🏈 | Leaderboard 🏆 | Week Picks 👥 | Profile 👤  
**Bell icon** (header top-right) — Activity panel: Global Feed | Your Activity, paginated 20/load  
**Admin** — Profile → ⚙️ Settings → Admin Dashboard (admins only). Tabs: Users | NFL Tools | Data

---

## CRITICAL: Pick Visibility Rules

> NO ONE's picks visible ANYWHERE until Wednesday 9PM PST lock passes.

- Week Picks tab: hidden before lock
- Game Detail pick list: hidden before lock
- Profile H2H comparison: hidden before lock
- **Exception:** YOUR OWN picks on YOUR OWN picks page only

After lock: Week Picks full grid, Game Detail pick list, other profiles H2H for **current week only** (never past weeks).

---

## Screens — Key Details

### Game Card Rules (NEVER change without asking Nick)
- Away team TOP, home team BOTTOM — NEVER left/right
- Full team names — NEVER abbreviations
- Blue outer border = your pick
- Green background = winning team
- 6px thick pick % bars — visible after lock only
- 3 states: pre-game (stats), live (score+clock), final (score+result)

### TO BUILD: Game Preview Screen (Pre-Game Stats on GameCard)

The locked pre-game GameCard state should show team stats side by side before picks lock. DB tables (`team_game_stats`, `player_stats`) already exist in schema.

**Stats to show (decide with Nick which subset to surface in UI):**
- PPG / PPG Allowed
- Total yards/game / yards allowed/game
- Offensive rank / Defensive rank
- 3rd down conversion %
- Red zone efficiency
- Win probability bar (from ESPN predictor section, already synced as `winningTeamWinProb` on game)
- Top QB: comp/att, pass yards, TDs, INTs
- Top RB: carries, rush yards, TDs
- Top WR: receptions/targets, yards, TDs

**Stats fallback strategy (IMPORTANT — discuss with Nick before building):**
- Preseason 2026 games: show 2025 season averages (no 2026 data yet)
- Regular season Week 1 2026: show 2025 season averages (no 2026 games played yet)
- Regular season Week 2+ 2026: show 2026 running averages (accumulated from played games)
- Logic: query `team_game_stats` for `season=2026` first; if no rows, fall back to `season=2025`

**Collection:**
- Pre-game stats: ESPN `/summary?event={id}` predictor section — sync on Tuesday 6AM + Wednesday crons
- Post-game stats (box score): ESPN `/summary?event={id}` boxscore section — sync when game goes 'post'

### TO BUILD: Post-Game Box Score on Game Detail
Visible only on final games: team totals (yards, pass, rush, TDs, turnovers, 3rd-down %, red zone) + top QB (comp/att, pass yards, TDs, INTs), RB (carries, rush yards, TDs), WR (rec/targets, yards, TDs).

### TO BUILD: Pre/Post Stats Implementation Plan
1. Explore ESPN `/summary?event={id}` predictor + boxscore sections to confirm available fields
2. `espnService.ts`: add `syncTeamStats(game)` — pre-game stats from ESPN predictor section
3. `espnService.ts`: add `syncBoxScore(game)` — post-game stats from ESPN boxscore section
4. Wire `syncTeamStats` to Tuesday 6AM + Wednesday crons
5. Wire `syncBoxScore` to live loop when game status goes 'post'
6. Update `GET /api/games` and `GET /api/games/:id` to include stats with 2025 fallback when no 2026 rows
7. GameCard pre-game state shows team stats; Game Detail final state shows box score
8. Add `npm run sync:stats` to backfill 2025 box scores

### TO BUILD: Leaderboard Season Selector (all users)
Same +/− control the admin has, lets any user view 2025 final standings.

### TO BUILD: Profile Past Seasons Row
W-L per season for historical context.

### Other Built Screen Notes
- **Team Central** — real-time updates needed: invalidate `['teams', ...]` cache when scores sync
- **Picks by Team** — real-time updates needed: invalidate `['picks-by-team', ...]` cache when scores sync
- **Team Detail** — expand stats when `syncTeamStats()` is built (add yards, sacks, rankings from `team_game_stats`)
- **Public Profile** — H2H pick comparison: current week only, after lock only, no email, no full pick history

---

## Push Notifications

| Trigger | Message | When | Status |
|---|---|---|---|
| Week unlocked | "Week X picks are now open! 🏈" | Tue 6AM | built, NOT wired |
| Deadline | "1 hour left for Week X picks!" | Wed 8PM | built, NOT wired |
| Locked | "Picks locked. Good luck! 🏈" | Wed 9PM | built, NOT wired |
| Achievement | "🏆 You earned [Achievement] for Week X!" | Tue after scoring | built, NOT wired |
| Final | "Final: [score]. Your pick: ✓/✗" | As games end | built, NOT wired |

All in `notificationService.ts`. Test via Admin → NFL Tools → "Send Test Notification Now" or "Schedule Deadline Reminder Test" (1/5/10/30m presets).

---

## ESPN API

Base: `https://site.api.espn.com/apis/site/v2/sports/football/nfl`
- Regular scoreboard: `/scoreboard?week={week}&seasontype=2&season={year}`
- Preseason: `/scoreboard?week={week}&seasontype=1&season={year}`
- Game summary (stats + box score): `/summary?event={espnId}`
- Team schedule: `/teams/{teamId}/schedule?season={year}`

No API key required. Win probability range: ~20%–80%. All ESPN logic is isolated in `espnService.ts` — switching data providers means rewriting only that file.

---

## Mobile Setup — Critical Lessons (Don't Undo These)

- **Node.js**: v20+ required (`nvm use 20` — nvm-windows installed)
- **npm install**: always `--legacy-peer-deps` in mobile/; `mobile/.npmrc` has this for EAS builds
- **NativeWind v4**: `babel.config.js` needs `jsxImportSource: 'nativewind'`; `metro.config.js` wraps with `withNativeWind`
- **react-native-reanimated v4**: Babel plugin is `'react-native-worklets/plugin'` NOT `'react-native-reanimated/plugin'`
- **Firebase**: Use JS SDK v12, NOT @react-native-firebase; `getReactNativePersistence` needs module augmentation in `nativewind-env.d.ts`
- **TextInput iOS**: NEVER set padding via className — use `style={{ height: 52, paddingHorizontal: 16 }}`
- **Google/Apple Sign-In**: DO NOT work in Expo Go (bundle ID mismatch) — require EAS dev build
- **EAS SDK 54 package versions** (run `npx expo-doctor` before building):
  - `expo`: `~54.0.35`, `expo-dev-client`: `~6.0.21`, `expo-router`: `~6.0.24`, `react-native-worklets`: `0.5.1`
  - Always use `npx expo install <package>` not plain `npm install`
- **EAS CLI Windows EPERM bug**: Patch `C:\nvm4w\nodejs\node_modules\eas-cli\build\build\utils\repository.js` — wrap `finally { await fs_extra.remove(shallowClonePath) }` in try/catch. **Re-apply after every eas-cli upgrade.**
- **Start app**: `cd mobile && npx expo start` (add `--clear` for cache issues)

---

## 20 Rules — Never Violate Without Asking Nick

1. No CBB ever. Future = brackets only.
2. Dark mode only. Never light mode.
3. No ads ever.
4. Never show anyone's picks before Wednesday 9PM PST lock.
5. Full team names always. Never abbreviations.
6. Top/bottom game card layout. Never left/right.
7. Friend group = "Longies". isLongie boolean.
8. isPremium = future paid tier, ~$10/season. Free tier: Picks tab, Leaderboard, own Profile only. Premium tier: full access (Team Central, GameCards with stats, other players' profiles, Game Detail, etc.). All 2026 users get full access. `isPremium` field already on users table. Stripe web-only (no in-app purchase). Do NOT build premium gating yet — plan and confirm with Nick first.
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
- In-app feedback: `mailto:` deep link vs. in-app form with nodemailer/SendGrid?

---

## About Nick

- GitHub: corumnick-oss | Admin team name: Nicholas
- Windows 11, iPhone, no prior mobile dev experience
- Always ask before making product/design decisions
- Use Claude.ai chat for planning and strategy; Claude Code for building
- Original Replit web app — do not reference that code
