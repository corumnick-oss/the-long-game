# The Long Game — Complete Project Briefing for Claude Code

## IMPORTANT: Read This First
This document contains everything you need to know about this project. Read it completely before writing any code or making any suggestions. Every decision in here has been carefully discussed and agreed upon with Nick (the owner). Do not deviate from these decisions without explicitly asking first. When in doubt, ask Nick.

When starting a session say: "I've read CLAUDE.md and I'm ready to continue."

---

## Project Overview

**App Name:** The Long Game
**Type:** iOS and Android mobile app (React Native / Expo)
**Purpose:** NFL picks app where users predict winners of each week's games and compete on leaderboards
**Current Status:** Backend built and deployed to Railway. Build errors being fixed. Endpoints not yet tested.
**Railway URL:** https://thelonggame-production.up.railway.app
**Target Launch:** Before NFL Season 2026 (starts September 4, 2026)
**Owner:** Nick (Corums) — GitHub: corumnick-oss — Windows 11 — iPhone user — Admin team name: Nicholas

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

## Tech Stack — All Final

### Mobile App
- React Native with Expo (SDK 52+)
- Expo Router (file-based navigation)
- TanStack Query (data fetching, same as original web app)
- React Native Firebase (auth)
- NativeWind (Tailwind for React Native)
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
- Railway (hosting)

### Auth
- Firebase project: the-long-game-prod-bef05
- Bundle ID: com.thelonggame.picks — NEVER CHANGE THIS
- Sign-in methods: Email/Password + Google Sign-In + Apple Sign-In
- Apple Sign-In is REQUIRED by Apple whenever Google Sign-In is offered
- Profile photo from OAuth provider if available, initials fallback if not

### Infrastructure
- GitHub: corumnick-oss / TheLongGame (repo exists, code pushed)
- Railway: connected to GitHub, auto-deploys on push
- Apple Developer: approved (Individual account)
- Google Play: NOT set up yet (not urgent, needed before Android launch)
- Firebase Project: the-long-game-prod-bef05
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
├── mobile/                          ← Expo React Native app (blank, needs building)
│   ├── App.tsx
│   ├── app.json
│   └── package.json
└── server/                          ← Express.js backend (BUILT, deployment issues)
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
    │   │   ├── espnService.ts
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

### Railway Variables (set in Railway dashboard — same keys, different values)
- NODE_ENV should be `production` on Railway
- FIREBASE_PRIVATE_KEY: no quotes in Railway dashboard, keep all \n characters
- DATABASE_URL: from Railway PostgreSQL service → Connect tab

### Railway Deployment Settings
- Root Directory: server
- Build Command: npm run build
- Start Command: npm start

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

| Table | Records | Notes |
|---|---|---|
| users | 7 | Active users only, exclude 2 test accounts |
| games | 272 | Season 2025 ONLY — exclude all 2024 games (272 games with zero picks) |
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
- winningTeamWinProb (decimal, nullable) — win prob of winning team AT GAME TIME
- losingTeamWinProb (decimal, nullable) — win prob of losing team AT GAME TIME
- isScoreLocked (boolean, default false) — prevents ESPN sync overwriting manual corrections

### picks
- id (uuid PK)
- userId (text, FK → users.id)
- gameId (uuid, FK → games.id)
- pick (text) — 'home' or 'away'
- isCorrect (boolean, nullable) — set after game finishes
- pickWinProbability (decimal, nullable) — ESPN win probability FOR THE PICKED TEAM at moment of pick submission. Critical for future premium analytics.
- pointsEarned (decimal, nullable) — for future game modes. null = standard mode (1 or 0)
- createdAt (timestamp)

### trophies
- id (uuid PK)
- userId (text, FK → users.id)
- type (text) — see Trophy Types section
- name (text)
- description (text) — specific, e.g. "Picked Jets to beat Bills with only 31% win probability"
- week (integer, nullable)
- season (integer)
- sport (text, default 'nfl')
- gameId (uuid, nullable) — for game-specific trophies (Lone Wolf, Contrarian)
- earnedAt (timestamp)

### team_game_stats (NEW — for pre-game stats and future premium)
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
- additionalStats (jsonb, nullable) — sport-specific extras, future stats
- createdAt (timestamp)

### player_stats (NEW — for head-to-head top performers on game cards)
- id (uuid PK)
- gameId (uuid, FK → games.id)
- season, week (integer)
- sport (text)
- teamName (text)
- position (text) — 'QB', 'RB', 'WR', 'DEF'
- playerName (text)
- stat1 (decimal) — yards (passing/rushing/receiving)
- stat2 (decimal) — touchdowns
- stat3 (decimal) — additional (INTs for QB, carries for RB, receptions for WR)
- stat4 (decimal) — additional stat
- additionalStats (jsonb, nullable)
- createdAt (timestamp)

### activity_log (UPDATED)
- id (uuid PK)
- type (text)
- message (text)
- metadata (jsonb, nullable)
- visibility (text) — 'global', 'personal', 'admin'
- targetUserId (text, nullable) — null for global events, userId for personal events
- createdAt (timestamp)

### push_tokens (NEW)
- id (uuid PK)
- userId (text, FK → users.id)
- token (text, unique) — Expo push token
- platform (text) — 'ios', 'android'
- createdAt, updatedAt (timestamps)

### tiebreaker_games (NEW — replaces old hardcoded week18_tiebreakers)
- id (uuid PK)
- season (integer)
- week (integer)
- gameId (uuid, FK → games.id)
- description (text) — e.g. "Predict the total combined score"
- actualTotal (integer, nullable) — filled after game ends
- designatedAt (timestamp)

### tiebreaker_picks (NEW)
- id (uuid PK)
- userId (text, FK → users.id)
- tiebreakerGameId (uuid, FK → tiebreaker_games.id)
- season (integer)
- predictedTotal (integer)
- createdAt, updatedAt (timestamps)

### week_settings (NEW — replaces hardcoded lock times)
- id (uuid PK)
- week (integer)
- season (integer)
- lockTime (timestamp, nullable) — overrides default Wednesday 9PM PST if set
- notes (text, nullable) — e.g. "Week 18 — Saturday games"

### app_settings (NEW)
- id (uuid PK)
- key (text, unique)
- value (text)
- updatedAt (timestamp)
Keys used: 'seasonStartDate', 'currentSeason', 'preseasonMode'

### pick_audit_log (KEEP FROM ORIGINAL)
- id (uuid PK)
- userId, gameId, action
- previousPick, newPick (text, nullable)
- adminId (text, nullable) — set when admin makes a change on behalf of user
- createdAt (timestamp)

### unlocked_weeks (KEEP FROM ORIGINAL)
- id (uuid PK)
- week, season (integer)
- unlockedAt (timestamp)
- unlockedBy (text) — admin userId

---

## Trophy System — Complete

### Currently Active (bugs already fixed in trophyService.ts)

**most_wins** — User with most correct picks that week. Ties = multiple winners.

**loser** — User with most incorrect picks that week. Ties = multiple losers. The sad football image. Has personality — it stings, which makes winning meaningful.

**upset_pick** — Correctly picked the team with the LOWEST win probability that won. Uses winningTeamWinProb NOT FPI (FPI is team strength rating, NOT probability — this was a bug that's been fixed). Floating point comparison uses epsilon tolerance 0.01.

**lone_wolf** — The ONLY player to correctly pick the winner. Requires: winningPicks.length === 1 AND losingPicks.length >= 1. The second condition prevents awarding when only one person picked the game at all. Will become rare as user base grows.

**contrarian** — NEW TROPHY. Correctly picked the winner when 20% or fewer of all players who picked that game chose that team. Requires more than 1 winner pick (if only 1, that's Lone Wolf territory — no double award). Multiple Contrarian trophies can be awarded per week (one per qualifying game). More attainable than Lone Wolf as app grows.

### Bug Fixes Already Applied (trophyService.ts is the fixed version)
1. Lone Wolf: added `losingPicks.length >= 1` requirement
2. Upset Pick: changed from homeTeamFPI/awayTeamFPI to winningTeamWinProb
3. Floating point: `Math.abs(a - b) < 0.01` instead of `===`

### Trophy Images
- most_wins: existing ✓
- loser: existing sad football ✓
- upset_pick: existing ✓
- lone_wolf: existing ✓
- contrarian: NEEDS NEW CUSTOM IMAGE — use placeholder for now

### Future Trophies — Discuss With Nick Before Implementing
**Weekly:**
- perfect_week — went undefeated for entire week

**Season-end (awarded once at season end):**
- sharpshooter — highest accuracy full season
- most_improved — biggest accuracy jump first half vs second half
- the_goat — season champion (most wins)
- consistency_king — fewest weeks below .500
- chaos_agent — most upset picks attempted all season
- oracle — most correct upset picks all season

**Milestone (awarded when threshold hit, fires personal activity event):**
- century_club — 100 correct picks all-time
- hot_hand — 10 correct picks in a row across any games
- faithful — submitted picks every single week of the season

---

## Scheduling — Complete Cron Job List

All times Pacific. Handles PST/PDT automatically.

| Schedule | What | Notes |
|---|---|---|
| Every 30 seconds | Live score updates | ONLY runs when games are in progress |
| Tuesday 6AM PST | Weekly transition | Awards trophies for last week, unlocks new week, syncs team stats |
| Tuesday 9PM PST | Win probability refresh | Updates FPI + win prob for upcoming week |
| Wednesday 6AM PST | Win probability refresh | Second refresh before picks lock |
| Wednesday 5PM PST | Win probability refresh | NEW — added because ESPN data sometimes not available yet |
| Wednesday 8PM PST | Push notification | "1 hour left to submit your Week X picks!" |
| Wednesday 9PM PST | Picks lock + push | Lock fires, send "Picks locked. Good luck!" notification |

REMOVED: Monday 12PM CBB sync — gone entirely (no CBB).

### Season Detection — CRITICAL — NEVER HARDCODE A YEAR
Every place that references the current season must use this:

```typescript
export function getCurrentNFLSeason(): number {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();
  // NFL season runs September through February
  // Jan-August = previous year's season
  return month >= 9 ? year : year - 1;
}
```

This lives in server/src/utils/season.ts. Import and use it everywhere. Never write `season: 2025` or `CURRENT_SEASON = 2025` in code.

### Lock Times — Admin Configurable
- Default: Wednesday 9PM PST
- Each week can have its own lock time via week_settings table
- Admin sets this from admin panel
- Handles: weeks where first game is Saturday instead of Thursday, Week 18 special cases
- Previously hardcoded to January 2nd for Week 18 — now admin-configurable per week

### Season Start Date — Admin Configurable
- Admin sets this once per season each August
- Stored in app_settings table as 'seasonStartDate'
- Currently hardcoded to September 5th — must be replaced with dynamic lookup
- Admin panel has "Sync New Season" button that pulls new season's Week 1 games

### Preseason Mode
- Stored as 'preseasonMode' boolean in app_settings
- When true: preseason games visible, separate preseason leaderboard active
- When false OR regular season Week 1 syncs: preseason hidden everywhere
- Admin can manually toggle off as safeguard
- Preseason data NEVER deleted — just excluded from all regular season queries
- Preseason picks, stats, trophies are completely isolated from regular season
- Nothing from preseason carries into regular season stats

---

## App Navigation Structure

### Bottom Tab Bar (4 tabs)
1. **Picks** 🏈 — current week's games, make picks
2. **Leaderboard** 🏆 — rankings
3. **Week Picks** 👥 — everyone's picks (RENAMED from "All Picks")
4. **Profile** 👤 — stats, trophies, H2H, settings

### Bell Icon 🔔 (top-right of header, all screens)
- Tapping opens Activity slide-in panel
- Two internal tabs: Global Feed | Your Activity
- NOT a bottom tab — saves tab space for future 5th tab

### Admin Dashboard
- Accessed via: Profile tab → Settings gear ⚙️ → "Admin Dashboard"
- Conditionally rendered — ONLY visible when user.isAdmin === true
- Never a separate bottom tab
- Never accessible to non-admin users

### Auth Screens (shown when not logged in)
- Splash/onboarding screen
- Login screen
- Sign up screen
- Forgot password screen

---

## CRITICAL: Pick Visibility Rules — Never Violate

This is the most important rule in the entire app. Violating it ruins the competition.

> NO ONE's picks are visible ANYWHERE until the Wednesday 9PM PST lock has passed for that week.

This means:
- Week Picks tab: shows "picks not available yet" message before lock
- Game Detail screen player pick list: completely hidden before lock
- Other user profile H2H pick comparison: completely hidden before lock
- All Picks in any form anywhere: hidden before lock

The ONE exception: a user's OWN picks on their OWN Picks tab. They made them, they see them.

After lock:
- Week Picks tab: shows full grid for current week
- Game Detail: shows full player pick list
- Other user profiles: shows H2H pick comparison for CURRENT WEEK ONLY

Past weeks: always visible (they're already locked, no competitive advantage)

---

## Screen Designs — Detailed Decisions

### Picks Tab

**Week Selector:**
- Arrow navigation (< Week 9 of 18 >)
- Current week labeled "Week X (Current)"
- Current week = Tuesday 6AM PST after last week's games conclude

**Game Card — 3 States:**

State 1 UPCOMING (before game starts):
```
┌─────────────────────────────────────┐  ← blue border if you picked this game
│  [Away Logo]  Away Team Name        │
│               7-4                   │
│               PPG: 24.3             │
│               Def Rank: 8th         │
│  ─────────────── @ ───────────────  │
│  [Home Logo]  Home Team Name        │  ← green bg if they're winning/won
│               9-2                   │
│               PPG: 28.1             │
│               Def Rank: 3rd         │
│  Sun Dec 15 · 1:00 PM PST · -3.5   │
│  Win Prob: 62% ──────────────────   │
└─────────────────────────────────────┘
```
Shows: team logos (larger than web version), FULL team names (never abbreviations), records, PPG, defensive rank, game time, spread, win probability bar. Pre-game stats help users decide their pick.

State 2 LIVE (game in progress):
```
│  [Away Logo]  Away Team Name    17  │
│               Q3  4:23             │
│               Picks: 4 (57%) ████░ │
│  ─────────────── @ ───────────────  │
│  [Home Logo]  Home Team Name    14  │
│               Picks: 3 (43%) ███░░ │
```
Shows: score prominently, quarter + clock, pick percentage bars (6px thick). Stats disappear, replaced by live score.

State 3 FINAL:
```
│  [Away Logo]  Away Team Name    17  │  ← red border = losing team
│               7-5                   │
│               Picks: 4 (57%) ████░ │
│  ─────────────── @ ───────────────  │
│  [Home Logo]  Home Team Name    14  │  ← green border+bg = winning team
│               9-3                   │
│               Picks: 3 (43%) ███░░ │
│  FINAL                         ✓/✗ │  ← your result
```

**Card border rules:**
- Blue outer border = the team you picked (visible in all states)
- Green background/border = winning team (visible after game ends)
- These two work simultaneously: blue outer + green inner is a correct pick

**Pick percentage bars:**
- Only visible AFTER Wednesday lock (not before — don't let users see how others are leaning)
- 6px thick (thicker than web version)
- Equal width for both teams so percentage fill is directly comparable
- Shows count and percentage: "4 picks (57%)"

**Tiebreaker:**
- Admin designates one game per season as the tiebreaker (usually the marquee final game of the season)
- Shown as a SEPARATE card below the designated game card — NOT embedded inside it
- All users see and submit it
- Mandatory for Week 18 pick submission
- Longies tiebreaker compared only against other Longies
- Global tiebreaker compared against all users
- Card design:
```
┌─────────────────────────────────┐
│  🏆 Season Tiebreaker           │
│  [Game name]                    │
│  Predict total combined score:  │
│  ┌──────┐                       │
│  │  __  │  points               │
│  └──────┘                       │
│  Used only if season ends in tie│
└─────────────────────────────────┘
```

**Submit button:**
- Sticky at bottom of screen
- Only appears after user has picked ALL games for the week
- "Submit Picks" → confirms → shows "✓ Your picks for Week X have been submitted"
- No Download/Export button (removed from mobile app)

### Leaderboard Tab

**Toggle structure:**
```
[Longies]     [Global]        ← group selector (top pill)
[Season]      [Weekly]        ← time selector (second pill)
Week 9 (Current)    < >       ← only shown in Weekly mode
```
Longies users see Longies/Season by default.
Global users see Global/Season by default.

**Leaderboard row design:**
```
🏆  [S]  Squid              11-5
         7 picks different  68.8%
─────────────────────────────────
🥈  [L]  Leo                10-6
         10 picks different 62.5%
─────────────────────────────────
🥉  [N]  Nicholas           10-6    ← blue highlight = your row
                            62.5%   ← NO "picks different" on own row
─────────────────────────────────
 4  [G]  Gmac                9-7
         5 picks different  56.3%
```

Rules:
- 🏆🥈🥉 for top 3, numbers (4, 5, 6...) for rest
- Avatar circle with initials (or Google/Apple profile photo)
- "X picks different" = how many games this person picked differently than YOU this week
- Hide "picks different" text entirely on your OWN row (not "0 picks different" — just hide it)
- Blue highlight background on your own row
- Accuracy % shown for all users
- Longies appear on Global leaderboard too (they're not hidden from global)
- Tappable rows → navigate to that user's profile
- Pull to refresh

**Tiebreaker column** visible on season leaderboard showing each user's prediction and distance from actual total.

### Week Picks Tab (renamed from All Picks)

**Before Wednesday lock:**
Shows message: "Week X picks will be available after picks lock on [date/time]."
Past weeks ARE still viewable — select via week selector.

**After Wednesday lock — compact horizontal grid:**
```
┌──────────┬──────┬──────┬──────┐
│          │[CAR] │[SEA] │[KC]  │  ← team logos only (stacked away/home)
│  Player  │  @   │  @   │  @   │
│          │[TB]  │[SF]  │[BUF] │
│          │14-16 │13-3  │27-21 │
│          │FINAL │FINAL │FINAL │
├──────────┼──────┼──────┼──────┤
│ Leo      │🔴    │🟢    │🔴    │  ← red/green pick result
│ Gmac     │🔴    │🔴    │🟢    │
│ Purdy M… │🟢    │🔴    │🟢    │  ← names truncated with ellipsis
└──────────┴──────┴──────┴──────┘
         ← scroll right for more games →
```

- Left column FIXED (doesn't scroll with games)
- Player names truncated with ellipsis — no wrapping
- Pick cells ~44px logo badges with green/red border
- Tapping any cell → Game Detail screen for that game
- Tapping column header → Game Detail screen for that game

### Game Detail Screen

Accessed from:
- Picks tab: tap a game card
- Week Picks tab: tap a column header or pick cell

**Header (compact):**
```
← CAR @ TB                    FINAL
  Sat Jan 3 · 1:30 PM PST
```

**Score card:** Same top/bottom layout as Picks tab game cards

**Navigation:** Previous game / Next game buttons + swipe left/right gesture between games in the week

**Before lock (accessed from Picks tab):**
Shows game info + pre-game stats + head-to-head top performers
Player pick list is COMPLETELY HIDDEN

**After lock:**
Player pick list appears below score card:
```
┌─────────────────────────────────────┐
│  All Player Picks (7)               │
│─────────────────────────────────────│
│  [L]  Leo          [Panthers] 🔴   │  ← tappable → Leo's profile
│  [S]  Squid        [Bucs]     🟢   │
│  [N]  Nicholas ●  [Bucs]     🟢   │  ← ● = you (blue highlight)
│  [G]  Gmac         [Panthers] 🔴   │
│  [TP] The Purdy M  [Bucs]     🟢   │
│  [KA] Kevin Akers  [Panthers] 🔴   │
│  [E]  EWIK         [Bucs]     🟢   │
└─────────────────────────────────────┘
```
- Avatar initials on left
- Full team name in middle
- Pick logo badge (team logo) on right with green/red border
- ✓/✗ overlay on badge corner
- Blue highlight on own row
- Chevron > on each row indicating tappable
- Tapping → that user's profile
- Bottom padding so last item clears tab bar

### Profile Tab (own profile)

**Header section:**
```
[N]  Nicholas
     Member since Oct 2025
     🏆 Ranked #2 of 7 (Longies) · #156 Global
     ⭐ Longie                              ⚙️
```
- Avatar: Google/Apple profile photo if available, initials circle if not
- Longie badge if isLongie: true
- Both Longies rank AND Global rank shown
- Settings gear ⚙️ top right → Settings screen

**2×2 Stats Grid:**
```
┌──────────────┬──────────────┐
│ Season       │ Accuracy     │
│ 179-93       │ 65.8%        │
├──────────────┼──────────────┤
│ Best Week    │ Trophies     │
│ Wk 1 (14-2) │ 13           │
└──────────────┴──────────────┘
```
Plus "This Week: 8-4" shown separately.
Stats count only CONCLUDED games. Updates live on Sundays as games finish.

**Week-by-week history:**
```
Week 18  ████████░░  10-6  ✓ above .500
Week 17  ██████████  11-5  ✓
Week 16  ████░░░░░░   6-10 ✗ below .500
```
Color coded: green = above .500, red = below.

**Auto-generated insights (all calculable from existing pick data):**
- 🎯 Best team to pick all-time: "You're 12-2 picking the Chiefs"
- 😬 Worst team to pick: "You're 2-11 picking the Giants — maybe stop?"
- 📈 Underdog record: "You're 8-3 picking underdogs this season"
- 🏠 Home vs Away: "You pick home teams correctly 71% of the time"
- ⚡ Upset specialist: "You've correctly picked 5 upsets (top 3 in group)"
- 📅 Best day: "You're 34-12 on Sunday games, 8-14 on Thursday games"
NOTE: No "current streak" — games change too quickly on Sundays to be useful

**Head to Head vs every Longie:**
- Shows W-L-T record per Longie (by week — who got more correct picks that week)
- Ties = weeks where both had the same number of correct picks → counted as T
- Example: "vs Kevin Akers: 9W - 7L - 2T"

**Trophy Case:**
Summary at top:
```
🏆 Trophy Case                    13 total
─────────────────────────────────────────
Most Wins    ████  5
Upset Pick   ███   3
Lone Wolf    ██    2
Loser        ██    2
Contrarian   █     1
```
Then 2-column grid of trophy cards below.
Dark background on trophy images (no white square artifact from web version).
Tap any trophy → detail view showing full description and which week.

### Other User Profiles (tappable from anywhere)

Accessible by tapping:
- Any player row on Leaderboard
- Any player name in Week Picks grid
- Any player row in Game Detail pick list

Same layout as own profile EXCEPT:
- No settings gear
- H2H section shows their record vs YOU specifically (not vs all Longies)
- No email shown ever
- No full pick history shown (redundant — available in Week Picks)

**H2H Pick Comparison (THE FEATURE Nick loves most):**
This appears as a section on other user profiles.
ONLY visible after Wednesday 9PM PST lock.
ONLY shows current week — never past weeks.

```
┌─────────────────────────────────────┐
│  Your Picks vs Leo This Week        │
│  3 picks different                  │
│─────────────────────────────────────│
│  Kansas City Chiefs    ✓ same pick  │
│  Philadelphia Eagles   ✓ same pick  │
│  Tampa Bay Buccaneers  ← you        │
│  Carolina Panthers     ← Leo        │  ← DIFFERENT
│  Green Bay Packers     ✓ same pick  │
│  Dallas Cowboys        ← you        │
│  New York Giants       ← Leo        │  ← DIFFERENT
│  ...                                │
└─────────────────────────────────────┘
```
Games where you agree show same pick + checkmark.
Games where you disagree show your pick on one line, their pick below — highlighted.
This explains exactly what the "X picks different" number on the leaderboard means.
Only current week because: past weeks are irrelevant to current competition, and picks are already viewable in Week Picks tab anyway.

### Activity Panel (bell icon)

Two-tab slide-in panel from top-right bell icon.

**Global Feed tab:**
Events visible to ALL users:
- 🔓 "Week X picks are now open"
- 🔒 "Week X picks are now locked"
- 🏆 "Week X trophies have been awarded" (bulk, not per-user)
- 👤 "[Team Name] joined The Long Game" (new user joined)
- ⚠️ "Scores corrected: [Away] @ [Home] X-Y" (transparency when admin corrects)
- Generic stats refresh messages (no operational detail)
Paginated: 20 per load, Load More button at bottom.

**Your Activity tab:**
Events personal to logged-in user only:
- ✅ "You submitted your Week X picks"
- 🏆 "You won Lone Wolf for Week X — [full description]"
- 📈 "Week X: 10-6 · Season rank #3"
- 🎯 "Century Club unlocked! 100 correct picks all-time"
- 🔓 "Week X picks are now open for you"
- 🔒 "Your Week X picks are locked. Good luck!"
Paginated: 20 per load.

**Activity types and visibility:**
- week_unlock: global
- week_lock: global
- trophy_award (bulk): global
- trophy_earn (individual): personal (targetUserId set)
- user_join: global
- score_correction: global
- stats_update: admin only (never shown to users)
- pick_submit: personal only (targetUserId set)
- weekly_result: personal (targetUserId set)
- milestone: personal (targetUserId set)
- account_delete: admin only (never shown to users)
- admin_action: admin only

### Admin Dashboard (3 tabs, admin only)

**Tab 1 — Users:**
Vertical card list (NOT a table — tables break on mobile):
```
┌─────────────────────────────────┐
│  [N]  Nicholas                  │
│       b2msbro@gmail.com         │
│       Longie ✅    Admin ✅      │
│                   [Picks] [🗑️] │
└─────────────────────────────────┘
```
- Longie toggle switch per user (tap to grant/revoke)
- "Manage Picks" → AdminUserPicksPage
- Delete button with confirmation dialog

**AdminUserPicksPage:**
- READ-ONLY by default — Nick can browse picks without risk of accidentally changing them
- "Enable Editing" button at top — shows confirmation: "Are you sure you want to edit [name]'s picks? This will be logged."
- Only after confirming does edit mode activate
- ALL admin pick edits written to pick_audit_log with adminId set

**Tab 2 — NFL Tools:**
Game Data section:
- Sync NFL Week Games (week selector + button) — use when games get flexed/rescheduled
- Sync NFL Scores (button) — force immediate score refresh when auto-update lags
- Sync Pick Correctness (week selector + button) — manual override when auto-sync misses picks. Sometimes picks don't auto-update as correct — this fixes it for a specific week.
- Refresh Team Stats (button)
- Correct NFL Game Scores (week + game selector + score inputs) — manual score correction, locks game from ESPN sync overwriting

Season Management section:
- Season Start Date (date picker) — admin sets once each August
- Sync New Season (button) — pulls new season's games when season rolls over
- Sync Preseason Games (button) — for preseason testing
- Preseason Mode toggle — manual safeguard to hide preseason data

Week Settings section:
- Per-week lock time override (week selector + datetime picker)
- Manual week lock/unlock toggle

Picks & Trophies section:
- Award Trophies (week selector + button) — if auto-award missed a week
- Recalculate Trophies (week + type selector + button) — RED/destructive. Deletes existing trophies for that week/type and recalculates. Use with caution. Includes 'contrarian' in type dropdown.
- Designate Tiebreaker Game (season + week + game selectors)

**Tab 3 — Data:**
- Export All Data (CSV) — users, picks, trophies, leaderboard snapshot
- Export Win Probability Data (CSV) — for building own analytics model

---

## Pre-Game Stats on Game Cards — Detailed

When a game hasn't started, the game card (upcoming state) shows:
- Team offensive ranking + yards per game
- Team defensive ranking + yards allowed per game
- Win probability bar (visual)

Plus HEAD-TO-HEAD TOP PERFORMERS comparison:

```
PASSING
                Mahomes    Allen
Yards           2,847      2,631
TDs             22         19
INTs            4          6
Rating          104.2      98.7

RUSHING
                Pacheco    Cook
Yards           487        412
TDs             5          3
YPC             4.1        4.4

RECEIVING
                Rice       Diggs
Yards           634        589
TDs             6          4
Rec             52         48
```

This is SEASON stats (not per-game stats) — how each team's top performers are doing heading into this matchup. Gives users real analytical context to make decisions.
Data from ESPN public API, stored in player_stats table, refreshed Tuesday 6AM.
These stats replace the card content when the game goes live (score takes over).

---

## Push Notifications — 5 Triggers

| Trigger | Message | When |
|---|---|---|
| Week unlocked | "Week X picks are now open! 🏈" | Tuesday 6AM PST |
| Deadline approaching | "1 hour left to submit your Week X picks!" | Wednesday 8PM PST |
| Picks locked | "Picks are locked. Good luck this week! 🏈" | Wednesday 9PM PST |
| Trophy earned | "🏆 You won [Trophy Name] for Week X!" | Tuesday after scoring runs |
| Game final | "Final: [Team] [score]-[score]. Your pick: ✓/✗" | As games end Sunday/Monday |

**Permission flow:**
1. User signs in and sees Picks screen for first time
2. Wait ~10-12 seconds (let them see value first)
3. Show in-app prompt: "Stay on top of your picks — get notified when picks lock and scores update" with Allow / Maybe Later buttons
4. If Allow → system permission dialog appears
5. If Maybe Later → ask again after 7 days
6. Never ask more than twice total

Two-step approach is critical: iOS only lets you ask for system permission once. The in-app prompt preserves that one shot.

---

## Data Collection (Running in Background — No UI Yet)

These fields/tables are being populated NOW even though the premium features aren't built yet. After 1-2 seasons this data powers premium analytics.

- pickWinProbability on picks table — ESPN win probability for picked team at moment of submission
- team_game_stats — weekly snapshots of team stats (kept historically, not overwritten)
- player_stats — weekly top performers per position per team
- Win probability outcomes: winningTeamWinProb stored on games table → compare against actual outcome
- Matchup signals stored in additionalStats JSON columns

After one NFL season: can analyze "teams with 30-35% win probability won X% of the time" to calibrate the Probability game mode scoring.

---

## Complete Build Plan — Phase by Phase

### Phase 1 — Backend (MOSTLY COMPLETE)
- [x] Create Railway PostgreSQL database
- [x] Write Drizzle schema (src/db/schema.ts)
- [x] Run migrations
- [x] Write 2025 data migration script (src/scripts/migrate-2025.ts)
- [x] Build all Express routes
- [x] Deploy to Railway (URL: thelonggame-production.up.railway.app)
- [ ] Fix Railway build errors (TypeScript compilation failing — in progress)
- [ ] Test all endpoints working
- [ ] Run migration script to import 2025 CSV data
- [ ] Verify leaderboard matches known 2025 results

### Phase 2 — Expo Foundation
- [ ] Expo Router navigation setup (4 bottom tabs + bell icon)
- [ ] Firebase Auth (email/password + Google + Apple sign-in)
- [ ] TanStack Query connected to Railway backend
- [ ] NativeWind setup and dark theme configured
- [ ] Notification permission flow (10 second delay, 2-step)
- [ ] Push token registration to backend

### Phase 3 — Auth Screens
- [ ] Splash/onboarding screen (logo, tagline)
- [ ] Login screen (Google button, Apple button, Email button)
- [ ] Sign up screen (email, password, team name field)
- [ ] Forgot password screen

### Phase 4 — Core Screens
- [ ] Picks Tab (game cards 3 states, week selector, submit flow, tiebreaker card)
- [ ] Leaderboard Tab (Longies/Global toggle, Season/Weekly toggle, row design)
- [ ] Week Picks Tab (lock behavior, compact grid, fixed left column)
- [ ] Profile Tab (stats grid, insights, H2H, trophy case)
- [ ] Game Detail Screen (compact header, prev/next, pick list after lock)

### Phase 5 — Advanced Features
- [ ] Activity bell panel (Global + Your Activity tabs)
- [ ] Other user profiles (viewable from leaderboard, week picks, game detail)
- [ ] H2H pick comparison on other profiles (after lock, current week only)
- [ ] Push notifications (all 5 triggers wired to backend cron jobs)
- [ ] Admin dashboard (3 tabs)
- [ ] AdminUserPicksPage (read-only default + confirm-to-edit)

### Phase 6 — Preseason Testing
- [ ] Preseason mode fully working
- [ ] All screens tested with preseason data
- [ ] Safeguard toggle confirmed working
- [ ] Confirmed preseason data does not carry to regular season

### Phase 7 — 2025 Data Migration
- [ ] 7 Longies sign up with Google/Apple Sign-In
- [ ] Nick runs UID reassignment script linking new UIDs to old picks/trophies
- [ ] Verify all 7 users see correct 2025 stats
- [ ] Verify leaderboard matches: KA 181-91, Nick 179-93, Squid 177-95...

### Phase 8 — Polish
- [ ] Loading states on every screen
- [ ] Error states on every screen
- [ ] Empty states on every screen
- [ ] Smooth animations and transitions
- [ ] Android testing (friend's Android phone or emulator)
- [ ] Edge cases (no picks submitted, mid-season join, etc.)

### Phase 9 — App Store Submission

#### Before Submitting Either Store
- [ ] Privacy policy page live on web (Apple requires URL)
- [ ] Terms of service page live on web
- [ ] Support email working
- [ ] TestFlight beta tested on real iPhone
- [ ] Tested on real Android device
- [ ] All push notifications working end-to-end
- [ ] Google Sign-In and Apple Sign-In working
- [ ] Zero crashes on all common user flows

#### Apple App Store
- [ ] App icon (1024×1024px — simple, football-themed, works at 60px on home screen)
- [ ] Screenshots: 6.5" iPhone required + 12.9" iPad required
- [ ] App name: "The Long Game"
- [ ] Subtitle (30 chars max): "NFL Picks & Leaderboards"
- [ ] Description (4000 chars max)
- [ ] Keywords (100 chars max — research top search terms)
- [ ] Category: Sports
- [ ] Age Rating: 4+
- [ ] EAS production build: `eas build --platform ios --profile production`
- [ ] Submit to App Store: `eas submit --platform ios`
- [ ] Apple review: 1-7 days
- [ ] Address any rejection feedback

#### Google Play Store
- [ ] Set up Google Play Developer account ($25 one-time) — NOT DONE YET
- [ ] App icon (512×512px)
- [ ] Feature graphic (1024×500px)
- [ ] Screenshots (minimum 2)
- [ ] Short description (80 chars)
- [ ] Full description (4000 chars)
- [ ] Privacy Policy URL
- [ ] Category: Sports
- [ ] Content rating questionnaire
- [ ] EAS production build: `eas build --platform android --profile production`
- [ ] Submit: `eas submit --platform android`
- [ ] Google review: 1-3 days

---

## Future Features — Not Building Now, Architecture Supports

### Premium Tier ("Long Game Pro")
Price: ~$4.99/month or $29.99/season (season price anchors well — less than Netflix for the whole NFL season)
Payment: Stripe web-only — users subscribe on a webpage, NOT inside the app. This avoids Apple's 30% cut on in-app purchases. Spotify and Netflix use the same approach. isPremium field on users table is already there (default false).

Premium features planned:
- Win probability bucket analysis: "Teams with 30-35% win probability won 44% of the time across 3 seasons" — powered by our own historical data
- Matchup intelligence: pass rush advantage, defense susceptible to run, WR vs CB approximation — all from free ESPN data we already collect
- Historical matchup data: how these two teams have performed historically
- Trend analysis: how each team performed last 4 weeks vs season average
- Pick trend data: what % of app users picked each team (revealed after deadline)
- Full data export: CSV of complete pick history for external analysis
- Weather impact analysis
- PFF data licensing: when revenue supports it (~$1,000-2,000/year), replace approximations with actual player grades (CB coverage grade, WR separation, QB pressure rate, etc.)

Simple matchup indicators (pass defense rank vs pass offense rank, etc.) are FREE for all users — this is basic helpful info. Premium is the deep analytical layer on top.

### Private Pools
- Create a pool (like a fantasy league)
- Commissioner role — controls pool settings
- Invite members via link or code
- Optional buy-in tracking (keep it informal to avoid gambling regulation)
- Pool-specific leaderboard
- Pool can have its own game mode
- pools table, pool_members table, pool_settings table

### Game Modes (future, after data collection)
- Probability Mode: points scale inversely with win probability. Higher risk = higher reward. Exact bracket thresholds TBD after one full season of win probability data. Clean tiers (e.g. 70%+ = 0.5 pts, 55-70% = 0.8 pts, 45-55% = 1.0 pts, 35-44% = 1.4 pts, under 35% = 2.0 pts)
- Upset Hunter: only correct underdog picks score points
- Lock of the Week: designate one pick per week as your "lock" — worth double if correct, zero if wrong
- pointsEarned field on picks table already supports all of these

### Additional Sports (curated only)
- March Madness brackets (6 rounds, 3 weeks in March)
- FIFA World Cup brackets (64 games, ~1 month every 4 years)
- NCAA Top 25 season matchups (week-by-week like NFL but college)
- All sport-agnostic: sport field already on every table

### User Feedback / Support
Build in this order when ready:
1. Option A: Simple feedback form → sends email to Nick (build after launch)
2. Option C: Crisp.chat integration (when user base grows, ~$30/month, generous free tier)
Hold off on building this until public users exist. 7 Longies = just text Nick directly.

---

## ESPN API Reference

Base URL: https://site.api.espn.com/apis/site/v2/sports/football/nfl
No API key required for public endpoints.

Key endpoints:
- Scoreboard: /scoreboard?week={week}&seasontype=2&season={year}
- Preseason: /scoreboard?week={week}&seasontype=1&season={year}
- Team stats: /teams/{teamId}/statistics
- Game detail/summary: /summary?event={espnId}

Win probability range in NFL: approximately 20%-80% (never near 0% or 100% — too competitive). This is important for Probability Mode bracket design.

---

## 20 Rules — Never Violate Without Asking Nick

1. **No CBB ever.** NFL only. Future multi-sport = brackets only (March Madness, World Cup).
2. **Dark mode only.** No light mode toggle. Never.
3. **No ads ever.** Permanent decision.
4. **Pick visibility.** No one sees anyone's picks before Wednesday 9PM PST lock. No exceptions except own picks on own page.
5. **Full team names.** Never abbreviations anywhere in the mobile app. "Carolina Panthers" not "CAR".
6. **Top/bottom card layout.** Away team on top, home team on bottom. Never left/right split.
7. **"Longies"** is the friend group name. isLongie boolean. Not "Premier", not "VIP", not anything else.
8. **isPremium** = future paid users only. Don't build payment infrastructure yet.
9. **Never hardcode a year.** Always use getCurrentNFLSeason(). Every single place.
10. **Lock times are admin-configurable per week.** No hardcoded dates anywhere.
11. **Preseason is completely isolated.** Zero contamination of regular season stats.
12. **H2H pick comparison:** current week only, after lock only, other user profiles only.
13. **Admin picks page:** read-only by default. Require explicit confirmation + audit log to edit.
14. **Activity feeds:** two tabs (Global + Your Activity). Paginated 20 per load.
15. **Tiebreaker:** admin-designates one game per season. All users submit. Longies compared to Longies only, Global compared to all.
16. **Sport-agnostic architecture.** Every relevant table has a sport field. Never NFL-specific table names.
17. **No Download Picks button** in mobile app. Removed.
18. **Export All Data** = admin only feature.
19. **Bundle ID = com.thelonggame.picks.** Never change. Ever.
20. **Stripe web-only** for premium subscriptions. No in-app purchase. Avoids Apple's 30% cut.

---

## Open Questions — Ask Nick Before Deciding

- New season/milestone trophy implementation details (discuss when building those)
- Google Play Developer account setup (not urgent, before Android launch)
- Domain name (still deciding — thelonggameapp.com or similar)
- Contrarian trophy custom artwork
- Exact premium subscription pricing and specific feature set
- Whether to show preseason results anywhere after regular season starts

---

## About Nick

- GitHub: corumnick-oss
- Admin team name in app: Nicholas
- Windows 11 PC, iPhone (primary test device)
- No prior mobile development experience
- Comfortable following step-by-step instructions
- Always ask before making product or design decisions — never assume
- Use **this Claude.ai chat** for planning, brainstorming, and strategic decisions
- Use **Claude Code** for building, debugging, and writing code
- Original web app built on Replit (spent ~$200) — do not reference that code