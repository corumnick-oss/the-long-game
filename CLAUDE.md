# The Long Game — Complete Project Briefing for Claude Code

## IMPORTANT: Read This First
This document contains everything you need to know about this project. Read it completely before writing any code or making any suggestions. Every decision in here has been carefully discussed and agreed upon with Nick (the owner). Do not deviate from these decisions without explicitly asking first. When in doubt, ask Nick.

**ALWAYS confirm your implementation plan with Nick BEFORE writing any code.** List the files you intend to change and what you'll do to each. Wait for Nick to say "go ahead" or "yes" before making edits. This prevents wasted work if Nick's priorities have changed.

When starting a session say: "I've read CLAUDE.md and I'm ready to continue."

---

## ⚠️ DO THIS FIRST NEXT SESSION

### ✅ GameCard bounce fix — CONFIRMED WORKING
### ✅ Team Central + Picks by Team real-time cache invalidation — DONE
### ✅ Pre-game stats + post-game box scores — SHIPPED
### ✅ Push notifications — ALL 5 WIRED
### ✅ TestFlight preview build — SUBMITTED; TheRidl3r added as internal tester
### ✅ Win probability — homeTeamFPI/awayTeamFPI on Game Detail page (blue/amber bar, team labels, hidden after lock)
### ✅ Away/Home labels — added to GameCard and Game Detail page
### ✅ Pick % bar — shown on both GameCard (picks tab) and Game Detail (after lock)
### ✅ Longies → Gridirons rename — complete in all code, DB column (is_longie → is_gridiron), and UI
### ✅ OTA auto-update — app checks for update on launch and restarts silently (one close, not two)
### ✅ Public profile season selector — users can view any past season on another user's profile
### ✅ Pick comparison week navigation — WeekSelector on public profiles lets you browse any past week's H2H
### ✅ H2H Win Pct on own profile — replaced W/L/T with win percentage (green ≥50%, red below)
### ✅ Launch screen flash fix — blank +not-found.tsx backstop + SplashScreen.hideAsync() after navigation
### ✅ Profile season selector bug fix — was using calendar year (2026), now uses getCurrentNFLSeason() (2025)
### ✅ Profile stats regular-season-only — week history, season record, H2H, and insights all filter to season_type = 'regular'; preseason picks no longer bleed into profile

### ✅ Custom broadcast notification — Admin → NFL Tools → Broadcast Notification card (title, body, All Users / Gridirons Only toggle)
### ✅ In-app feedback — Chat bubble icon in header (replaces activity bell). Stored in activity_log, push notification to admins, viewable in Admin → Feedback tab
### ✅ OTA update UX — Dark overlay with spinner shown before reload (no more jarring screen jump)

### ⚠️ PENDING — Do these next session:
1. **Award 2025 season trophies (podium)** — Kevin Akers = 1st, Nicholas = 2nd, TheRidl3r = 3rd. Last place: Gmac and Purdy Mouths tied at 165-107 — ask Nick which gets it (or both). Trophy system not yet built — design with Nick first.
2. **Feedback detail modal — needs full-screen treatment** — Currently slides up from the bottom (partial sheet). Nick wants it to fill the full screen so text is larger and more readable. Redesign as a full-screen modal, not a bottom sheet.
3. **TestFlight push notifications for test users** — Two TestFlight users (not Nick) are not receiving push notifications. Most likely cause: they denied or dismissed the notification permission prompt. Fix: ask them to go to iPhone Settings → The Long Game → Notifications and enable. If already enabled, check Railway logs for their push token — may not be registered. See NotificationPrompt component.
4. **Achievement images** — All 5 images needed from ChatGPT. None exist yet. Drop in `mobile/assets/achievements/`. See Achievement section below.
5. **Achievement display on public profiles** — Currently not shown on other users' profiles. Need to fetch `/api/trophies?userId=X&season=Y` and display season-filtered achievements.

### Next priority items (after the above):
1. **UI polish pass** — Go screen by screen: Login/Onboarding → Picks tab → Game Detail → Leaderboard → Week Picks → Profile → Activity panel. **This is the final gate before App Store + Google Play submission.**
2. **App logo** — Needed before App Store + Google Play submission. Nick to supply artwork. Must be added to app.json (icon field) and EAS build assets before submitting to stores.
3. **Rules/instructions page** — Before launch, add a rules page accessible from (a) onboarding (first-time user flow) and (b) somewhere in the app (Profile or Settings). Rules: picks lock Wednesday 9PM PST, missing picks default to Raiders (if playing) or away team, weekly achievements awarded Tuesday, leaderboard shows all users or Gridirons-only. Confirm copy + placement with Nick before building.
4. **Achievement display redesign** — see details below
5. **Past seasons row on Profile** — W-L per season for historical context
6. **Onboarding polish** — Nick wants redesign before launch
7. **TestFlight for remaining Gridirons** — after UID reassignments are done, invite via App Store Connect → TestFlight → External Testing → add by email.

### Win Probability — weekly workflow
Before each week's games: run `npm run sync:winprobs <week> 2026` from `server/`. Example: `npm run sync:winprobs 1 2026`. The admin "Sync Win Probabilities" button is blocked on Railway (ESPN IP block on /summary endpoint — see ESPN section below). Run locally once per week, ideally Wednesday afternoon before the 9PM lock.

### Achievement images + Profile display redesign (discuss with Nick)
Current state: Achievement case on Profile uses placeholder emojis. Nick wants real images and a better layout.

**Images needed — ALL 5 must be generated by ChatGPT (none exist yet):**
- `most_wins` — Top Picker
- `loser` — Rough Week
- `upset_pick` — Upset Pick
- `lone_wolf` — Lone Wolf
- `contrarian` — Contrarian

Drop images in `mobile/assets/achievements/` once generated.

**Profile display to redesign:**
- Current: emoji grid in "Achievement Case" section, no visual hierarchy
- Discuss with Nick: card-style layout? show count + most recent per type? show all earned vs. just types unlocked? trophy room aesthetic?
- Also decide: does the Achievement Case show ALL-TIME achievements or just current season?
- The public profile (`user/[id].tsx`) also shows `trophyCount` — may need updating once display is redesigned

### UID Reassignment Script
When a Gridiron signs up fresh and needs their 2025 picks migrated from the old account:
```
npm run reassign:user -- --old <OLD_UID> --email <EMAIL>
```
Script: `server/src/scripts/reassign-user.ts`. Migrates picks, trophies, push tokens, tiebreaker picks, activity log, audit log. Copies isGridiron/isAdmin/isPremium/nflAccess flags. Deletes old record. Reusable for all Gridirons.

### ⚠️ BEFORE PRESEASON STARTS (Aug 7) — Default Picks Preseason Fix
`applyDefaultPicks()` in `scheduler.ts` previously hardcoded `seasonType: 'regular'` — **FIXED**. It now reads seasonType from the `unlocked_weeks` row and also guards against running if the week is not unlocked. Cron timezone also fixed (now passes `{ timezone: 'America/Los_Angeles' }` explicitly to all schedules).

**Also future feature:** Add a rules/explanation page in the app so users know that missing picks defaults to Raiders (if playing) or away team.

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
| `preview` | `eas build --profile preview` | TestFlight beta (Gridirons) |
| `production` | `eas build --profile production` | App Store |

### EAS CLI Windows Bug — IMPORTANT
EAS CLI v20 has `EPERM: operation not permitted, rmdir` bug on Windows during upload.  
**Patch:** `C:\nvm4w\nodejs\node_modules\eas-cli\build\build\utils\repository.js` — wrap the `finally` block's `remove` call in try/catch swallowing EPERM.  
**⚠️ Lost on any `npm install -g eas-cli` upgrade — re-apply after every upgrade.**

---

## Current Status

All core infrastructure, screens, stats, and push notifications are complete. Preview build active on Nick's iPhone.

### Open TODOs — Priority Order
1. **TheRidl3r + Leo UID reassignments** — see PENDING section above
2. **2025 podium trophies** — award champion/runner_up/third_place (and last_place?) for 2025 season. NOT YET BUILT. Design with Nick first.
3. **Achievement images** — all 5 from ChatGPT, drop in `mobile/assets/achievements/`
4. **Achievement display on public profiles** — currently not shown
5. **Achievement display redesign** — card layout, scope decision
6. **Past seasons row on Profile** — W-L per season for historical context
7. **Onboarding polish** — Nick wants redesign before launch
8. **TestFlight for remaining Gridirons** — after UID reassignments complete
9. **Week 18 2025 tiebreaker** — check `tiebreaker_games` and `tiebreaker_picks` tables for week 18 season 2025
10. **In-app feedback / bug report** — Profile tab, email to nickcorum@gmail.com. Decide: `mailto:` deep link vs. in-app form. Discuss with Nick.
11. **Admin email editing** — deferred. Workaround: new account + UID reassignment.
12. **App Store + Google Play submission** — target late July. Android Google Sign-In needs SHA-1 fingerprint — fix when Google Play is set up (Play App Signing gives the definitive SHA-1).
13. **Leaderboard Season Selector** — all users (currently admin only)

### seed:nick — Re-run After Any Cleanup
`npm run seed:nick` (from server/) sets nickcorum@gmail.com as isAdmin=true, isGridiron=true, teamName=Nicholas and copies 179 2025 picks + all trophies from CSV. Requires FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in server/.env.

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

## The Gridirons — Nick's Friend Group

7 active users from 2025 season. All isGridiron: true. Create FRESH accounts via Google/Apple Sign-In, then run UID reassignment script (see above).

| 2026 Team Name | Email | Is Admin | 2025 Name | Migration Status |
|---|---|---|---|---|
| Nicholas (Nick) | b2msbro@gmail.com | YES | Nicholas | ✅ done (seed:nick) |
| TheRidl3r | cloud7king10@yahoo.com | no | Squid | ✅ done (reassign:user) |
| Kevin Akers | kakers91@gmail.com | no | Kevin Akers | ✅ done (reassign:user) |
| The Purdy Mouths | jhayhurst714@gmail.com | no | The Purdy Mouths | ❌ not yet signed up |
| Gmac | garciagarrett24@gmail.com | no | Gmac | ❌ not yet signed up |
| leocorum (Leo/dad) | leocorum@gmail.com | no | Leo | ✅ done (reassign:user) |
| EWIK | erikhernandez531@yahoo.com | no | EWIK | ❌ not yet signed up |

DO NOT migrate: CBB Test (nicholas.corum@sce.com) or blank team name (nickcorum@gmail.com).

**2025 Final Leaderboard** (verify migration against this):
1. Kevin Akers 181-91 (66.5%) | 2. Nicholas 179-93 (65.8%) | 3. TheRidl3r (was Squid) 177-95 (65.1%)
4. Leo 175-97 (64.3%) | 5. EWIK 172-100 (63.2%) | 6. The Purdy Mouths 165-107 (60.7%) | 7. Gmac 165-107 (60.7%)

**Pending UID reassignments (old UIDs):**
- TheRidl3r: old UID = `BQMdo8NUOgY8n0QxdUophLPMewp2`
- Leo/dad: old UID = `uTosuZBxPucsOAnCnHmdA3pzBlb2`

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
│   │   ├── _layout.tsx              ← root layout (QueryClientProvider + AuthProvider + AuthGate + OTA check)
│   │   ├── +not-found.tsx           ← blank dark screen (prevents not-found flash on cold launch)
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
    │   │   ├── notificationService.ts ← all 5 push triggers
    │   │   ├── scheduler.ts         ← cron jobs
    │   │   └── trophyService.ts
    │   ├── utils/season.ts          ← getCurrentNFLSeason()
    │   ├── middleware/auth.ts
    │   └── scripts/
│       │   ├── migrate-2025.ts      ← initial 2025 data import
│       │   └── reassign-user.ts     ← migrate picks/trophies from old UID to new Firebase UID
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

### Achievement Types
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
| Wednesday 8PM PST | Push: "1 hour left for Week X picks!" |
| Wednesday 9PM PST | Picks lock + push notification |

All 5 push functions wired: `notifyWeekUnlocked` + `notifyDeadlineApproaching` + `notifyPicksLocked` in `scheduler.ts`; `notifyAchievementEarned` in `trophyService.ts`; `notifyGameFinal` in `espnService.ts`.

### ESPN `/summary` Endpoint — Railway IP Block
ESPN returns 400 for any `/summary?event=` request from Railway's server IP (confirmed — even with browser User-Agent headers). This affects two things:

1. **Stats backfill** — must run locally: `npm run backfill:stats` in server/
2. **Win probability sync** — must run locally: `npm run sync:winprobs <week> <season>` in server/
   - Example before week 1: `npm run sync:winprobs 1 2026`
   - The Tuesday/Wednesday cron jobs attempt this automatically but will fail if Railway is still blocked. The Admin → NFL Tools → "Sync Win Probabilities" button also fails for the same reason.
   - **Workaround:** run the local script before each week's games. Re-run if you see `homeTeamFPI`/`awayTeamFPI` null on GameCards.
   - Live score updates are NOT affected (they use the scoreboard endpoint, not /summary).

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

### TO BUILD: Leaderboard Season Selector (all users)
Same +/− control the admin has, lets any user view 2025 final standings.

### TO BUILD: Profile Past Seasons Row
W-L per season for historical context.

### PICK VISIBILITY RULE UPDATE
Rule 12 is now expanded: H2H pick comparison on public profiles shows current week (after lock) AND all past weeks/past seasons via WeekSelector navigation.

### Screen Notes
- **Game Detail** — pre-game: season averages (PPG, YPG, 3rd Down %, Red Zone %, Sacks, Turnovers); post-game: actual box score; live: neither
- **Team Detail** — PPG, YPG, efficiency stats (3rd Down %, Red Zone %, Sacks/G, Turnovers/G). Stats fall back to 2025 when no 2026 games played.
- **Public Profile** — Season selector (past seasons viewable). Pick comparison with `WeekSelector` for browsing any past week's H2H. Comparison hidden before lock for current week, always visible for past weeks/seasons. Profile stats (record, week history, H2H, insights) filter to regular season only — preseason excluded.
- **Admin Sync Team Stats button** — hits Railway (blocked) — use `npm run backfill:stats` locally instead
- **Admin Sync Win Probabilities button** — hits Railway (blocked) — use `npm run sync:winprobs <week> <season>` locally instead

---

## Push Notifications

| Trigger | Message | When | Status |
|---|---|---|---|
| Week unlocked | "Week X picks are now open! 🏈" | Tue 6AM | wired |
| Deadline | "1 hour left for Week X picks!" | Wed 8PM | wired |
| Locked | "Picks locked. Good luck! 🏈" | Wed 9PM | wired |
| Achievement | "🏆 You earned [Achievement] for Week X!" | Tue after scoring | wired |
| Final | "Final: [score]. Your pick: ✓/✗" | As games end | wired |

Test via Admin → NFL Tools → "Send Test Notification Now" or "Schedule Deadline Reminder Test" (1/5/10/30m presets).

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
7. Friend group = "Gridirons". isGridiron boolean.
8. isPremium = future paid tier, ~$10/season. Free tier: Picks tab, Leaderboard, own Profile only. Premium tier: full access (Team Central, GameCards with stats, other players' profiles, Game Detail, etc.). All 2026 users get full access. `isPremium` field already on users table. Stripe web-only (no in-app purchase). Do NOT build premium gating yet — plan and confirm with Nick first.
9. Never hardcode a year. Always getCurrentNFLSeason().
10. Lock times admin-configurable per week.
11. Preseason picks and leaderboard are FUNCTIONAL. Preseason stats kept separate from regular season via `seasonType` field. Preseason leaderboard is its own view, not mixed into regular season standings.
12. H2H pick comparison on other profiles: current week visible after lock only; past weeks and past seasons always visible via WeekSelector. Your own profile H2H Win Pct (aggregated %, not per-game) is always visible.
13. Admin picks page: read-only default, confirm + audit log to edit.
14. Activity: two tabs, paginated 20 per load.
15. Tiebreaker: admin-designates, all submit, Gridirons vs Gridirons only.
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
