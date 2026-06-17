# The Long Game — Future Features (Post-Launch)

Read this file when planning work beyond the 2026 launch. These features have been discussed and agreed upon with Nick but are NOT being built now.

---

## The Big Picture Vision

This is NOT just a friend group app:
- Publicly available iOS + Android with hundreds of thousands of users
- Multi-sport platform — NFL first, then March Madness brackets, FIFA World Cup, NCAA Top 25. Curated high-stakes events only — scarcity = more emotional investment per pick
- Premium analytics tier ("Long Game Pro") — powered by OUR OWN proprietary database built from seasons of stored game/pick/outcome data. After one full 2026 season we have data no API can sell us.
- Private pools (like fantasy football leagues)
- Multiple game modes
- No ads ever — firm, permanent decision

---

## App Store Requirements Checklist (Late July 2026)

### Before Either Store
- [ ] Privacy policy at a URL (GitHub Pages is fine)
- [ ] Terms of service at a URL
- [ ] Zero crashes on core flows
- [ ] Push notifications tested and working
- [ ] Google/Apple sign-in working

### Apple App Store
- [ ] App icon (1024×1024px)
- [ ] Screenshots: 6.5" iPhone required
- [ ] App name: "The Long Game" / Subtitle: "NFL Picks & Leaderboards"
- [ ] Category: Sports, Age rating: 4+
- [ ] `eas build --platform ios --profile production`
- [ ] `eas submit --platform ios` — review 1-7 days

### Google Play Store
- [ ] Set up Google Play Developer account ($25) — NOT DONE YET
- [ ] `eas build --platform android --profile production`
- [ ] `eas submit --platform android` — review 1-3 days

---

## Known Infrastructure Fixes (Next Season Prep)

### Future Season Game Sync — ESPN Scoreboard Limitation
ESPN's scoreboard endpoint (`/scoreboard?season=2026`) silently returns the current season's data when the requested season doesn't exist yet. Confirmed June 2026: `season=2026` returned 2025 Week 1 games.

**Current workaround:** `server/src/scripts/sync-2026-local.ts` — run locally via `npm run sync:2026`. Fetches all 32 team schedules (which DO expose future season data — confirmed all 18 weeks available as of June 2026), collects event IDs, then upserts via `/summary?event={id}`. Nick runs this manually with `DATABASE_URL` in `server/.env`.

**Proper fix before 2027 season:** Build an admin "Sync Future Season" button that triggers the team-schedule approach (`syncWeekGamesFromTeamSchedules`) from Railway rather than requiring a local script run. The team schedule endpoint works server-side; the scoreboard endpoint doesn't for future seasons. Route already exists in `espnService.ts` — just needs an admin UI trigger and a cron/button to call it each week once the schedule is published (ESPN typically adds weeks 9–18 in August).

---

## Post-Launch Features

### Team History Screen
Tapping a team logo opens that team's full past game history. ESPN `/teams/{teamId}/schedule` endpoint.

### Premium — "Long Game Pro" (~$4.99/month or $29.99/season)
- Stripe web-only (no in-app purchase — avoids Apple's 30% cut). Rule 20.
- Powered by OUR OWN database — not a third-party API
- Win probability bucket analysis, matchup intelligence, historical trends
- `isPremium` field already in users table, not activated yet

### Private Pools — Target: 2026–2027 Season
Commissioner, buy-in tracking, pool leaderboards, pool game modes.

**Architecture notes:**
- Current `isLongie` boolean is a hardcoded single-pool concept — when pools arrive, "Longies" becomes one pool among many and `isLongie` migrates to pool membership
- Needs: `pools` table (id, name, commissioner, invite code, buy-in) + `pool_members` table (poolId, userId, role)
- Leaderboard, tiebreaker, and trophy queries need a `poolId` filter option added
- Current architecture is clean enough to add pools without a rebuild — it's an addition, not a rewrite

### Admin: Custom Push Broadcast — Target: 2026 Season
Allow admins to send a custom push notification to all users or a subset from Admin Dashboard.

**Scope when building:**
- New "Broadcast" section in Admin → NFL Tools tab (or its own tab)
- Input: message title + body text
- Target selector: All Users / Longies Only / specific user(s)
- Sends via existing `notificationService.ts` / Expo Push API infrastructure
- Log sent broadcasts to `activity_log` for audit trail

### Game Modes
- **Probability Mode** — points scale with win probability
- **Upset Hunter** — underdog picks only
- **Lock of the Week** — double or nothing one pick

### Trophies (Podium) System
Season-end 1st/2nd/3rd/last place awards. Last-place prize keeps eliminated players engaged. Design with Nick before implementing.

### Additional Sports (curated)
March Madness brackets, FIFA World Cup brackets, NCAA Top 25.

---

## Post-Launch Polish Pass

**Admin Dashboard** — tab bar polish, score editor inputs, avatar initials on user cards  
**Activity Panel** — empty state illustration, Dynamic Island safe area  
**Profile Tab** — achievement case custom artwork, gear icon layout  
**Picks Tab / GameCard** — CORRECT/WRONG badges could be icon-only; live pulsing indicator  
**Week Picks Tab** — name column width may truncate on some screen sizes  
**All Tabs** — haptic feedback (expo-haptics, OTA-safe), custom tab bar icon set, consistent activeOpacity

All are OTA-safe changes. Do as a dedicated polish session after core launch.

---

## Premium Analytics — What OUR Database Enables

After one full 2026 season:
- Win probability vs actual outcome (calibration for Probability Mode)
- User pick accuracy patterns (best team, worst team, home/away, day of week)
- Matchup intelligence from historical data
- Every QB/RB/WR performance linked to team win/loss outcomes

This data gets more valuable every season. It IS the premium product. ESPN just feeds raw game data to populate it. Fields already collected: `winningTeamWinProb` on every game, `pickWinProbability` on every pick, all pick outcomes, team stats in `team_game_stats`, post-game box scores in `team_game_stats.additionalStats` + `player_stats`.

### Raw ESPN Box Score Archive — Future-Proof Stats Vault

**Goal:** Store the full raw ESPN `/summary?event={id}` JSON response for every completed game so we can compute any stat we want later without being dependent on ESPN remaining available or accessible.

**Why:** ESPN's API is undocumented and could change or block us at any time. Storing the raw payload gives us:
- A complete historical record we own
- Freedom to derive any custom stat (QBR, target share, pressure rate, etc.) without re-hitting ESPN
- Foundation for "Long Game Pro" analytics that can't be bought from a third-party API

**Implementation sketch (when ready to build):**
- New table: `espn_game_snapshots` — `id`, `espnGameId` (text, unique), `season`, `week`, `capturedAt` (timestamp), `rawJson` (jsonb)
- In `espnService.ts`: after fetching `/summary?event={id}`, also upsert the full response into `espn_game_snapshots`
- Wire to the same trigger that calls `syncBoxScoreStats` (when game goes `in → post`)
- Backfill: fetch + store raw JSON for all 272 2025 games via a local script (ESPN's historical endpoints work from local IP, not Railway)
- Keep the existing computed `team_game_stats` rows for fast querying — this is an archival layer alongside it, not a replacement

**Note:** The JSON payloads are ~50–200 KB per game. 272 games/season × 10 seasons = a few hundred MB of JSONB — totally fine for PostgreSQL on Railway.
