# The Long Game — Complete Project Briefing for Claude Code

## IMPORTANT: Read This First
This document contains everything you need to know about this project. Read it completely before writing any code or making any suggestions. Every decision in here has been carefully discussed and agreed upon with Nick (the owner). Do not deviate from these decisions without explicitly asking first.

When starting a session say: "I've read CLAUDE.md and I'm ready to continue."

---

## Project Overview

**App Name:** The Long Game
**Type:** iOS and Android mobile app (React Native / Expo)
**Purpose:** NFL picks app where users predict winners of each week's games and compete on leaderboards
**Current Status:** Setup complete. Deployed to Railway. Need to test variables and endpoints.
**Target Launch:** Before NFL Season 2026 (starts September 4, 2026)
**Owner:** Nick (Corums) — GitHub: corumnick-oss — Windows 11 — iPhone user

---

## The Vision — Big Picture

This is not just a friend group app. The long-term vision is:

- A **publicly available** iOS and Android app on the App Store and Google Play
- **Hundreds of thousands of users** competing globally
- A **multi-sport platform** supporting NFL (primary), March Madness brackets, FIFA World Cup brackets, NCAA Top 25 matchups — curated high-stakes events only, not every sport every day
- A **premium analytics tier** ("Long Game Pro") where paying users get deep statistical analysis — win probability bucket analysis, matchup intelligence, historical trends, data exports
- **Private pools** (like fantasy football leagues) where groups of friends or coworkers compete with their own leaderboard, commissioner, and optional buy-in
- **Multiple game modes** — Standard (1 point per correct pick), Probability Mode (points scale with ESPN win probability), Upset Hunter, Lock of the Week
- The app should feel like a **real product**, not a hobby project
- **No ads ever** — firm decision, will not change

Nick built a web app on Replit with his 7 friends for the 2025 NFL season. We are migrating everything off Replit into a proper mobile app with a professional backend.

---

## Tech Stack — Final Decisions

### Mobile App
- **Framework:** React Native with Expo (SDK 52+)
- **Navigation:** Expo Router (file-based routing)
- **State/Data:** TanStack Query
- **Auth:** React Native Firebase
- **UI:** NativeWind (Tailwind for React Native)
- **Push Notifications:** Expo Notifications + Expo Push API
- **Build/Deploy:** EAS Build + EAS Submit
- **OTA Updates:** Expo Updates

### Backend
- **Server:** Express.js with TypeScript
- **Database:** PostgreSQL on Railway
- **ORM:** Drizzle ORM
- **Auth:** Firebase Admin SDK
- **Job Scheduling:** node-cron
- **External API:** ESPN public API (no key required)
- **Hosting:** Railway

### Auth
- **Provider:** Firebase (project: the-long-game-prod-bef05)
- **Bundle ID:** com.thelonggame.picks (NEVER CHANGE THIS)
- **Sign-in methods:** Email/Password, Google Sign-In, Apple Sign-In
- Apple Sign-In REQUIRED by Apple when offering Google Sign-In
- Profile photo from OAuth provider if available, initials fallback

### Infrastructure
- **GitHub:** corumnick-oss
- **Railway:** Connected to GitHub
- **Apple Developer:** Approved (Individual account)
- **Google Play:** Not yet set up (not urgent)
- **Firebase Project:** the-long-game-prod-bef05
- **Bundle ID:** com.thelonggame.picks (both iOS and Android)

---

## Current File Structure

```
TheLongGame/
├── CLAUDE.md                  ← this file
├── mobile/                    ← Expo React Native app (created, blank)
│   ├── App.tsx
│   ├── app.json
│   ├── package.json
│   └── ...
└── server/                    ← Express.js backend (in progress)
    ├── src/
    │   ├── db/                ← Database schema and connection
    │   ├── routes/            ← API routes
    │   ├── services/          ← ESPN API, notifications, trophies
    │   ├── utils/             ← Helper functions
    │   └── middleware/        ← Auth middleware
    ├── .env                   ← Environment variables (never commit)
    ├── .gitignore
    ├── package.json
    └── tsconfig.json
```

---

## Environment Variables (server/.env)

```
DATABASE_URL=your_railway_database_url_here    <- NOT YET SET
FIREBASE_PROJECT_ID=the-long-game-prod-bef05
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@the-long-game-prod-bef05.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
PORT=3000
NODE_ENV=development
ESPN_API_BASE_URL=https://site.api.espn.com/apis/site/v2/sports/football/nfl
CURRENT_SEASON=2025
```

DATABASE_URL is not yet set — Railway database needs to be created first.

---

## Firebase Config (public, safe to use in code)

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

## Users — The Friend Group ("Longies")

There are 7 active users from the 2025 season. They are called **"Longies"** — Nick's inner circle who compete in a season-long pool with real money on the line.

| Team Name | Email | Is Admin |
|---|---|---|
| Nicholas (Nick) | b2msbro@gmail.com | YES |
| Squid | cloud7king10@yahoo.com | no |
| Kevin Akers | kakers91@gmail.com | no |
| The Purdy Mouths | jhayhurst714@gmail.com | no |
| Gmac | garciagarrett24@gmail.com | no |
| Leo | leocorum@gmail.com | no |
| EWIK | erikhernandez531@yahoo.com | no |

These 7 users will create fresh accounts using Google or Apple Sign-In. After signup, Nick runs a reassignment script linking new Firebase UIDs to 2025 season data.

**DO NOT migrate:**
- CBB Test (nicholas.corum@sce.com)
- Blank team name (nickcorum@gmail.com)

---

## 2025 Season Data to Migrate

CSV files are in the project. Migration script needed after database is created.

| Table | Records | Notes |
|---|---|---|
| users | 7 | Active users only |
| games | 272 | Season 2025 only, exclude 2024 |
| picks | 1,903 | All 7 players, all 18 weeks |
| trophies | 109 | All 7 players |
| week18_tiebreakers | 7 | All players |

**2025 Final Season Leaderboard:**
1. Kevin Akers 181-91 (66.5%)
2. Nicholas 179-93 (65.8%)
3. Squid 177-95 (65.1%)
4. Leo 175-97 (64.3%)
5. EWIK 172-100 (63.2%)
6. The Purdy Mouths 165-107 (60.7%)
7. Gmac 165-107 (60.7%)

---

## Database Schema — Complete

### Users
- id (text PK, Firebase UID), email, teamName, isAdmin (false), isLongie (false), isPremium (false), nflAccess (true), profileImageUrl, createdAt, updatedAt

### Games
- id (uuid PK), espnId, week, season, seasonType ('regular'/'preseason'/'postseason'), sport ('nfl'), homeTeam, awayTeam, homeTeamLogo, awayTeamLogo, homeTeamRecord, awayTeamRecord, spread, favoriteTeam, gameTime, status ('pre'/'in'/'post'), homeScore, awayScore, homeTeamPPG, homeTeamPPGAllowed, homeTeamFPI, awayTeamPPG, awayTeamPPGAllowed, awayTeamFPI, period, displayClock, statusType, winningTeamWinProb, losingTeamWinProb, isScoreLocked (false)

### Picks
- id (uuid PK), userId (FK users), gameId (FK games), pick ('home'/'away'), isCorrect, pickWinProbability (at time of pick), pointsEarned (future game modes), createdAt

### Trophies
- id (uuid PK), userId (FK users), type, name, description, week, season, sport ('nfl'), gameId (nullable, for Lone Wolf/Contrarian), earnedAt

### Team Game Stats (NEW)
- id (uuid PK), gameId (FK games), season, week, sport, teamName, isHomeTeam, offensiveRank, defensiveRank, yardsPerGame, yardsAllowedPerGame, pointsPerGame, pointsAllowedPerGame, sackRate, thirdDownConversion, redZoneEfficiency, homeRecord, awayRecord, last3Games, additionalStats (jsonb), createdAt

### Player Stats (NEW)
- id (uuid PK), gameId (FK games), season, week, sport, teamName, position ('QB'/'RB'/'WR'/'DEF'), playerName, stat1 (yards), stat2 (TDs), stat3, stat4, additionalStats (jsonb), createdAt

### Activity Log (UPDATED)
- id (uuid PK), type, message, metadata (jsonb), visibility ('global'/'personal'/'admin'), targetUserId (nullable), createdAt

### Push Tokens (NEW)
- id (uuid PK), userId (FK users), token (unique), platform ('ios'/'android'), createdAt, updatedAt

### Tiebreaker Games (NEW - replaces week18_tiebreakers)
- id (uuid PK), season, week, gameId (FK games), description, actualTotal (nullable), designatedAt

### Tiebreaker Picks (NEW)
- id (uuid PK), userId (FK users), tiebreakerGameId (FK tiebreaker_games), season, predictedTotal, createdAt, updatedAt

### Week Settings (NEW)
- id (uuid PK), week, season, lockTime (nullable, overrides default Wed 9PM PST), notes

### App Settings (NEW)
- id (uuid PK), key (unique), value, updatedAt
- Keys: 'seasonStartDate', 'currentSeason', 'preseasonMode'

### Pick Audit Log (KEEP)
- id (uuid PK), userId, gameId, action, previousPick, newPick, adminId (nullable), createdAt

### Unlocked Weeks (KEEP)
- id (uuid PK), week, season, unlockedAt, unlockedBy

---

## Trophy Types

### Current (bugs already fixed)
- `most_wins` — Most correct picks in week
- `loser` — Most incorrect picks in week
- `upset_pick` — Correctly picked lowest win prob team (uses winningTeamWinProb NOT FPI)
- `lone_wolf` — ONLY player to correctly pick winner (requires 1+ others picked loser)
- `contrarian` — NEW: Correctly picked winner when 20% or fewer chose that team (requires >1 winner pick)

### Bug Fixes Already Applied (trophyService.ts)
1. Lone Wolf: `winningPicks.length === 1 && losingPicks.length >= 1`
2. Upset Pick: uses `winningTeamWinProb` not FPI
3. Floating point: epsilon tolerance 0.01

### Future Trophies (discuss with Nick before implementing)
Weekly: `perfect_week`
Season-end: `sharpshooter`, `most_improved`, `the_goat`, `consistency_king`, `chaos_agent`, `oracle`
Milestone: `century_club` (100 correct), `hot_hand` (10 in a row), `faithful` (every week)

### Trophy Images
- most_wins, loser, upset_pick, lone_wolf: existing images
- contrarian: NEEDS NEW IMAGE (placeholder for now)

---

## Scheduling

| Schedule | What |
|---|---|
| Every 30 seconds | Live score updates (only when games live) |
| Tuesday 6AM PST | Weekly transition (trophies, unlock, sync stats) |
| Tuesday 9PM PST | Win probability refresh |
| Wednesday 6AM PST | Win probability refresh |
| Wednesday 5PM PST | Win probability refresh (NEW) |
| Wednesday 9PM PST | Week lock notification + push |

Removed: Monday 12PM CBB sync.

### Season Detection — ALWAYS USE THIS, NEVER HARDCODE YEARS
```typescript
export function getCurrentNFLSeason(): number {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  return month >= 9 ? year : year - 1;
}
```

### Lock Times
- Default: Wednesday 9PM PST
- Configurable per week via week_settings table
- Admin sets season start date once per season
- All hardcoded dates removed

### Preseason Mode
- preseasonMode in app_settings
- Completely isolated from regular season
- Admin toggle as safeguard
- Data never deleted, just excluded from queries

---

## Navigation Structure

### Bottom Tabs (4)
1. Picks
2. Leaderboard
3. Week Picks (renamed from All Picks)
4. Profile

### Bell Icon (header top-right)
- Activity slide-in panel
- Two tabs: Global Feed | Your Activity

### Admin
- Profile > Settings > Admin Dashboard
- Only visible when isAdmin: true

---

## Pick Visibility — CRITICAL — NEVER VIOLATE

No one's picks visible anywhere until Wednesday 9PM PST lock passes.
- Week Picks: hidden before lock
- Game Detail pick list: hidden before lock
- Profile H2H comparison: hidden before lock
- Exception: your OWN picks on YOUR OWN picks page only

After lock:
- Week Picks shows full grid
- Game Detail shows player picks
- Other profiles show H2H for CURRENT WEEK ONLY (never past weeks)

---

## Screen Design Decisions

### Game Cards
- Top/bottom layout (away top, home bottom) — NOT left/right
- Full team names not abbreviations
- Blue outer border = your pick
- Green background = winning team
- 6px thick pick percentage bars
- 3 states: upcoming (pre-game stats), live (score+clock), final (score+result)

### Leaderboard
- Default: Season view
- Longies see Longies leaderboard by default
- Global users see Global leaderboard by default
- Toggles: Longies/Global (top) + Season/Weekly (below)
- Row: trophy/rank | avatar | team name | "X picks different" (hidden own row) | W-L | accuracy
- Blue highlight own row, trophies top 3, numbers rest
- Tappable rows to profiles
- Longies appear on Global leaderboard too

### Week Picks Tab
- Before lock: message + past weeks viewable
- After lock: compact horizontal grid, fixed left column, scrollable games, ~44px logos

### Game Detail
- Compact header
- Prev/Next + swipe gesture
- Before lock: pre-game stats only, no picks
- After lock: player pick list with avatars, tappable to profiles

### Profile (own)
- Header: avatar, name, member since, rank, Longie badge, settings gear
- 2x2 stats: Record | Accuracy | Best Week | Trophies
- This Week record
- Week-by-week color-coded history
- Auto insights: best team, worst team, underdog record, home/away, upset rank, best day of week
- H2H vs every Longie (W-L-T, ties counted as ties)
- Trophy Case: 2-col grid, counts at top, tap for detail

### Other User Profiles
- H2H vs viewer specifically
- H2H pick comparison: current week ONLY, ONLY after lock
- No email, no full pick history

### Activity Panel
- Global: week events, trophy awards, new users, score corrections (paginated 20)
- Your Activity: picks submitted, trophies earned, weekly results, milestones (paginated 20)

### Admin (3 tabs)
- Users: vertical cards, Longie toggle, read-only picks (confirm+audit to edit)
- NFL Tools: sync, correct scores, lock times, season config, trophies, tiebreaker
- Data: Export All Data CSV, Export Win Probability CSV

---

## Pre-Game Stats on Game Cards

- Offensive/defensive ranking, yards per game, yards allowed
- Win probability bar
- Head-to-head top performers: QB/RB/WR side by side
- ESPN public API, refreshed Tuesday 6AM

---

## Push Notifications (5 triggers)

| Trigger | Message | When |
|---|---|---|
| Week unlocked | "Week X picks are now open!" | Tue 6AM |
| Deadline | "1 hour left for Week X picks!" | Wed 8PM |
| Locked | "Picks locked. Good luck!" | Wed 9PM |
| Trophy | "You won [Trophy] for Week X!" | Tue after scoring |
| Final | "Final: [score]. Your pick: correct/wrong" | As games end |

Permission flow: in-app prompt 10 seconds after first login, then system dialog. Maybe Later re-asks after 7 days.

---

## Complete Build Plan

### Phase 1 — Backend Migration (CURRENT - The X marks complete)
- [X] Create Railway PostgreSQL database (NEXT STEP)
- [X] Write Drizzle schema (src/db/schema.ts)
- [X] Run migrations
- [X] Write 2025 data migration script
- [X] Build all Express routes
- [X] Deploy to Railway
  NOTE: We need to test this was deployed successfully. Check that variables are correct.
- [ ] Test all endpoints

### Phase 2 — Expo Foundation
- [ ] Expo Router navigation setup
- [ ] Firebase Auth (email, Google, Apple)
- [ ] TanStack Query connected to Railway
- [ ] NativeWind setup
- [ ] Dark mode default
- [ ] Notification permission flow

### Phase 3 — Auth Screens
- [ ] Splash/onboarding
- [ ] Login (Google, Apple, Email)
- [ ] Sign up (email, password, team name)
- [ ] Forgot password

### Phase 4 — Core Screens
- [ ] Picks Tab (game cards 3 states, submit, tiebreaker)
- [ ] Leaderboard Tab (toggles, rows)
- [ ] Week Picks Tab (grid, lock behavior)
- [ ] Profile Tab (stats, insights, H2H, trophy case)
- [ ] Game Detail Screen

### Phase 5 — Advanced Features
- [ ] Activity bell panel
- [ ] Other user profiles + H2H comparison
- [ ] Push notifications (all 5 triggers)
- [ ] Admin dashboard (3 tabs)
- [ ] Admin user picks page

### Phase 6 — Preseason Testing
- [ ] Preseason mode working
- [ ] All screens tested
- [ ] Safeguard toggle working
- [ ] Confirmed reset for regular season

### Phase 7 — Data Migration
- [ ] 7 friends sign up
- [ ] Run UID reassignment script
- [ ] Verify 2025 data correct

### Phase 8 — Polish
- [ ] Loading/error/empty states
- [ ] Animations
- [ ] Android testing
- [ ] Edge cases

### Phase 9 — App Store Submission

#### Apple App Store Steps
- [ ] App icon (1024x1024px, simple, works at 60px)
- [ ] Screenshots: 6.5" iPhone (required) + 12.9" iPad (required)
- [ ] App name: "The Long Game"
- [ ] Subtitle (30 chars): "NFL Picks and Leaderboards"
- [ ] Description (4000 chars max)
- [ ] Keywords (100 chars max)
- [ ] Privacy Policy URL (webpage required)
- [ ] Support URL
- [ ] Category: Sports
- [ ] Age Rating: 4+
- [ ] EAS build: `eas build --platform ios --profile production`
- [ ] Submit: `eas submit --platform ios`
- [ ] Review wait: 1-7 days
- [ ] Address any rejections

#### Google Play Store Steps
- [ ] Set up Google Play Developer account ($25) — NOT DONE YET
- [ ] App icon (512x512px)
- [ ] Feature graphic (1024x500px)
- [ ] Screenshots (minimum 2)
- [ ] Short description (80 chars)
- [ ] Full description (4000 chars)
- [ ] Privacy Policy URL
- [ ] Category: Sports
- [ ] Content rating questionnaire
- [ ] EAS build: `eas build --platform android --profile production`
- [ ] Submit: `eas submit --platform android`
- [ ] Review wait: 1-3 days

#### Before Submitting Either Store
- [ ] Privacy policy live on web
- [ ] Terms of service live on web
- [ ] Support email working
- [ ] TestFlight tested on real iPhone
- [ ] Tested on real Android
- [ ] Push notifications working
- [ ] Google/Apple sign-in working
- [ ] No crashes

---

## Future Features (Not Building Now — Architecture Supports)

### Premium Tier
- Stripe web-only (~$4.99/month or $29.99/season)
- Win probability bucket analysis
- Matchup intelligence (pass rush, WR vs CB, run defense)
- Historical trends and data export
- Weather impact analysis
- PFF data licensing when revenue supports

### Private Pools
- Commissioner role, buy-in tracking, pool leaderboards

### Game Modes
- Probability Mode (points scale with win probability)
- Upset Hunter (underdog picks only)
- Lock of the Week (double or nothing)

### More Sports
- March Madness brackets
- FIFA World Cup brackets
- NCAA Top 25 matchups

### User Feedback / Support Chat
Four options discussed — choose one when ready to build:

**Option A — Simple Feedback Form (easiest, build first)**
- A screen in the app where users type feedback and hit send
- Goes straight to Nick's email (support@thelonggameapp.com or similar)
- No real-time chat, no back and forth
- Takes about 1 day to build
- Good for early stage when user base is small

**Option B — In-App Messaging with Admin (moderate)**
- Users send Nick a message from inside the app
- Nick replies from the admin dashboard
- Like a support ticket system
- New messages table in database
- Nick sees all messages in admin panel
- Takes a few days to build

**Option C — Third-Party Live Chat (recommended for scale)**
- Real-time chat using Intercom, Crisp, or Zendesk
- Professional support dashboard for Nick
- Push notifications when users message
- Handles conversation history automatically
- Cost: ~$30-100/month depending on service
- Best choice once app has real public users
- Crisp.chat is recommended — generous free tier, great mobile SDK

**Option D — Community Link (zero build time)**
- A button in the app that opens a Discord server or community page
- Free, instant, users can help each other
- Good interim solution before building proper support

**Decision:** Not building yet. With 7 Longies Nick knows everyone personally.
Build Option A (simple feedback form) after launch when public users need support.
Upgrade to Option C (Crisp) when user base grows and support volume increases.

---

## ESPN API

Base: https://site.api.espn.com/apis/site/v2/sports/football/nfl
- Scoreboard: /scoreboard?week={week}&seasontype=2
- Preseason: /scoreboard?week={week}&seasontype=1
- Team stats: /teams/{teamId}/statistics
- Game summary: /summary?event={espnId}
No API key required.

---

## 20 Rules — Never Break Without Asking Nick

1. No CBB — NFL only. Future = brackets only.
2. Dark mode only.
3. No ads ever.
4. Never show anyone's picks before Wednesday 9PM PST lock.
5. Full team names always, no abbreviations.
6. Top/bottom game card layout, not left/right.
7. Friend group = "Longies", isLongie boolean.
8. isPremium = future paid tier, not building yet.
9. Never hardcode year — always getCurrentNFLSeason().
10. Lock times admin-configurable per week.
11. Preseason completely isolated from regular season.
12. H2H pick comparison: current week only, after lock only, other profiles only.
13. Admin picks page: read-only default, confirm + audit log to edit.
14. Activity: two tabs, paginated 20 per load.
15. Tiebreaker: admin-designates, all users submit, Longies vs Longies only.
16. Every table has sport field (sport-agnostic architecture).
17. No Download Picks button in mobile app.
18. Export All Data = admin only.
19. Bundle ID = com.thelonggame.picks, never change.
20. Stripe web-only for premium, no in-app purchase.

---

## Open Questions (Ask Nick Before Deciding)

- New trophy implementation details
- Google Play account setup timing
- Domain name decision
- Contrarian trophy artwork
- Premium pricing and features details

---

## About Nick

- GitHub: corumnick-oss, Admin team name: Nicholas
- Windows 11, iPhone, no prior mobile dev experience
- Always ask before making product decisions
- Use this chat (Claude.ai) for planning
- Use Claude Code for building
