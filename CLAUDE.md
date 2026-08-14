# The Long Game — Complete Project Briefing for Claude Code

## IMPORTANT: Read This First
This document contains everything you need to know about this project. Read it completely before writing any code or making any suggestions. Every decision in here has been carefully discussed and agreed upon with Nick (the owner). Do not deviate from these decisions without explicitly asking first. When in doubt, ask Nick.

**ALWAYS confirm your implementation plan with Nick BEFORE writing any code.** List the files you intend to change and what you'll do to each. Wait for Nick to say "go ahead" or "yes" before making edits. This prevents wasted work if Nick's priorities have changed.

When starting a session say: "I've read CLAUDE.md and I'm ready to continue."

---

## ⚠️ DO THIS FIRST NEXT SESSION

### ⚠️ TEMPORARILY WORKING via PC relay — Raspberry Pi still needed for a permanent fix (updated Aug 13-14 2026)

**Symptom (root problem, still true until the Pi is up):** ESPN's edge (Akamai) 400/403s every request that originates from a cloud/serverless host — confirmed against Railway (both its default region and us-east) and a Cloudflare Worker. Only non-cloud/residential networks succeed. `updateLiveScores()` (30s cron) and Admin → NFL Tools → "Sync Scores Only" both call `syncWeekGames()`, which fails from Railway on both `/scoreboard` and the team-schedule fallback whenever this block is active.

**Tried and ruled out, in order:**
1. Removing the spoofed Chrome User-Agent (Aug 10 2026 fix) — necessary but NOT sufficient; this is a recurrence, not something that fix actually finished solving.
2. Manual Railway redeploy hoping for a fresh egress IP — no change (Railway confirms redeploys in the same region don't rotate the outbound IP; their paid "Static Outbound IP" add-on isn't guaranteed dedicated either — don't buy it for this).
3. Cloudflare Worker relay (`espn-relay.corumnick.workers.dev` — inactive/never wired up, safe to delete) — ALSO blocked by Akamai. Ruled out "just Railway."
4. Swapped `axios` → native `fetch()` for every ESPN call in `espnService.ts` — still blocked from Railway. Ruled out axios's default `User-Agent` header as the sole cause.
5. Switched Railway's deployment region to us-east (Aug 13 2026) — no change, same 400s. Ruled out "just the default Railway region/IP range."

**Current best explanation (unconfirmed):** Akamai blocks cloud/serverless-origin traffic broadly, regardless of specific IP/region/provider. Only real residential/dev-machine networks get through.

**Important client-level finding (Aug 13 2026):** it's not just about *where* the request comes from — *which HTTP client* matters too. Node's raw `https` module (`https.request`) gets fingerprinted and blocked by Akamai even from a normal residential network. Node's native `fetch()` (undici) succeeds from the exact same machine, same network, same moment. `espnService.ts` already uses `fetch()` everywhere (confirmed safe) — but **any new relay/proxy code written for this must use `fetch()`, never the raw `https`/`http` module**, or it'll silently reproduce this same block.

**Shipped mitigations, live in production:**
- `d2b1b99` — exponential backoff in `espnFetch()`/`updateLiveScores()` (up to 20 min between automatic attempts after repeated failures; manual admin sync always attempts fresh).
- `4e88e77` — `DISABLE_LIVE_SCORE_SYNC=true` Railway env var kill switch for the automatic cron.

**Current live status (Aug 13-14 2026 overnight):** ESPN sync is working again, temporarily, via a relay running on Nick's own PC (not the Pi yet — see below). `DISABLE_LIVE_SCORE_SYNC` is unset and `ESPN_API_BASE_URL` on Railway points at a Cloudflare quick-tunnel URL forwarding to that PC relay. Confirmed end-to-end: live scores, pick grading, and box-score/team-stats sync all flowing into production. **This stops working the moment Nick's PC sleeps, restarts, or the two processes below get closed** — see "Continuing PC-based sync" below for how to keep it alive or restart it.

**Raspberry Pi — the actual permanent fix, still pending:** Nick has a Pi 4 (1GB, purchased Aug 13 2026) but no microSD card yet as of Aug 14 2026. Plan: same relay approach as the PC stopgap below, just running permanently on the Pi instead of Nick's desktop, exposed via Cloudflare Tunnel (free, no port-forwarding or static home IP needed — same Cloudflare account as `gridironsports.net`). **The working relay code already exists and is proven** — `C:\Dev\espn-relay\relay.js` on Nick's PC — so the Pi setup can copy that file directly instead of writing new passthrough logic (the old plan to reuse the abandoned/never-tested Cloudflare Worker code is superseded — that code was never confirmed working and predates the fetch()-vs-https finding above).

Remaining Pi steps once the microSD card is available:
1. Flash Raspberry Pi OS (Lite is enough) via Raspberry Pi Imager, pre-configuring SSH + WiFi so it boots headless.
2. SSH in, install Node.js.
3. Copy `C:\Dev\espn-relay\relay.js` onto the Pi as-is (already uses `fetch()`, already proven working) and run it (`node relay.js 8787`).
4. Install `cloudflared` on the Pi, run `cloudflared tunnel --url http://localhost:8787` (or set up a named/persistent tunnel tied to the Cloudflare account instead of a quick tunnel, so the URL doesn't change on restart — worth doing properly here since the Pi runs unattended).
5. Set up both the relay script and `cloudflared` as systemd services so they survive reboots.
6. Test the tunnel URL from an external network to confirm it reaches ESPN successfully.
7. Set `ESPN_API_BASE_URL` on Railway to `<tunnel-url>/apis/site/v2/sports/football/nfl`.
8. Confirm `DISABLE_LIVE_SCORE_SYNC` is unset on Railway, confirm via Logs (not Deploy Logs — see below) + a live game that scores/status/clock update automatically.
9. Once the Pi is confirmed stable, shut down the PC relay/tunnel processes (see below) — no longer needed.

**Continuing PC-based sync until the Pi is ready:**
- Two processes must both stay running on Nick's PC: the relay (`C:\Dev\espn-relay\relay.js`, a plain Node script that forwards ESPN requests via `fetch()`) and `cloudflared.exe` (in the same folder) running a quick tunnel pointed at it.
- **If they're still running, nothing to do** — check with `tasklist /FI "IMAGENAME eq node.exe"` and `tasklist /FI "IMAGENAME eq cloudflared.exe"` in a terminal.
- **If they've stopped** (PC restarted, terminal closed, etc.), restart both:
  1. Open a terminal, `cd C:\Dev\espn-relay`, run `node relay.js 8787` — leave this window open.
  2. Open a second terminal, `cd C:\Dev\espn-relay`, run `cloudflared.exe tunnel --url http://localhost:8787` — leave this window open too. It prints a new `https://<random>.trycloudflare.com` URL.
  3. **The quick-tunnel URL changes every time `cloudflared` restarts.** If the printed URL differs from what's currently set, update `ESPN_API_BASE_URL` on Railway to `<new-url>/apis/site/v2/sports/football/nfl` and save (Railway auto-restarts on env var change).
  4. Confirm `DISABLE_LIVE_SCORE_SYNC` is unset on Railway.
- A convenience script, `C:\Dev\espn-relay\start-relay.bat`, opens both processes in separate windows automatically — double-click it instead of typing the two commands above. It still won't survive a full PC shutdown/restart, and the tunnel URL still may change — check the Cloudflare Tunnel window it opens for the current URL and update Railway if it's different from before.
- Bottom line: as long as those two windows stay open and the PC stays on and awake, sync keeps working exactly like it will once the Pi takes over permanently.

### ✅ Box score sync silently skipping already-final games — FIXED (Aug 13 2026)
`syncBoxScoreStats()` only fired off a detected in→post transition, so any game that skipped straight from `pre` to already-`post` on its first successful sync (e.g. after an ESPN outage, like the one above) never got `team_game_stats` populated — same gap pick grading already had a fix for (Aug 10 2026). Now checked via whether stats already exist for the game instead of relying on the transition, so it self-heals on the next cron tick regardless of how the game was missed. Confirmed live: self-healed all 5 of that night's already-finished preseason Week 2 games automatically after deploy, no manual backfill needed. This wasn't preseason-specific — the same gap would hit regular season under the same "missed the live window" conditions, which is a real risk until the Pi relay is permanent.

### ✅ Ties treated as neither a win nor a loss — FIXED (Aug 13 2026)
`picks.isCorrect` correctly stays `null` for a tied final game (by design — see `gradeGamePicks()`), but several UI spots derived win/loss purely from a live score comparison instead of reading that field, which silently rendered a tie as a **loss** for anyone who picked either team (red ✗). Fixed in `GameCard.tsx`, `game/[id].tsx` (outcome banner, "MY PICK" badges, everyone's-picks list), and `week-picks.tsx` (grid cells) — all now show a distinct yellow "Tie" instead. Caught via the Patriots 13–13 Colts preseason Week 2 game.

### ✅ Live badge color + placement, Week Picks score layout — DONE (Aug 13 2026)
- `GameCard.tsx`: live badge recolored from red (read as an error state) to blue; format is one combined line, `"LIVE - Q4 12:11"`.
- `game/[id].tsx`: quarter/clock moved from the top header down to below the (now blue, was red) "LIVE" text under the score.
- `week-picks.tsx`: columns widened (52px → 68px) to show the score directly beside each team's full-size logo instead of shrinking logos to fit; winner's score bold/green, loser's muted; small "F" divider when final instead of "vs".

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

### ✅ TestFlight push notifications fixed — root cause was missing `expo-notifications` plugin in app.json. Without it, iOS never adds the `aps-environment` entitlement, so the app can't register for remote notifications at all (no Notifications entry in iOS Settings). Fix: added `"expo-notifications"` to plugins array in app.json. Also added `autoIncrement: true` + preview submit profile to eas.json, and set `appVersionSource: "remote"` (EAS now manages build numbers). New preview build submitted July 2026 — external testers update via TestFlight app.

### ✅ Soft-lock on picks — GameCard.tsx: once a game has a pick, team rows stop responding to taps until the user taps the "✎ Edit Pick" pill (top-right of card, white outline). Tapping it unlocks the card for one change; after picking, a green "✓ Pick saved" pill shows briefly (1.2s) before reverting to the white Edit Pick state. Prevents accidental pick changes while scrolling.

### ✅ Achievement images wired in — all 5 images (most_wins, loser, upset_pick, lone_wolf, contrarian) already existed in `mobile/assets/Achievements/` (Nick had generated them, CLAUDE.md just hadn't been updated). Renamed to lowercase `mobile/assets/achievements/{type}.png` (matches DB type keys, avoids case-sensitivity issues on EAS build servers) and wired into `profile.tsx`. Achievement Case redesigned: full-bleed square badge images (not tiny icons), no more 12-item cap (was showing "+N more" with no way to view them — now shows all), bigger summary count chips.

### ✅ Season podium Trophies system — BUILT. New `season_trophies` DB table; `calculateSeasonStandings()`/`awardSeasonTrophies()` in `trophyService.ts` (Gridirons-only, regular season, reuses leaderboard ranking; ties for last place all get awarded, not just one). Admin → NFL Tools → "Award [Season] Season Trophies" previews computed standings before committing (reusable every year). "Trophy Case" section added to own Profile and public profiles (🥇🥈🥉🥄 emoji placeholders — real artwork can come later same as Achievements did). **2025 season awarded**: Kevin Akers = champion, Nicholas = runner-up, TheRidl3r = third place, Gmac + Purdy Mouths = last place (tied, both awarded per Nick's call).

### ✅ Feedback detail modal — now full-screen (Admin → Feedback tab → tap a card). Was a bottom sheet capped at 80% height; now a full page with back-button header and larger text (18pt/28 line-height).

### ✅ Weekly Achievements on public profiles — `usePublicAchievements(userId, season)` added to `useProfile.ts` (hits the existing `GET /api/trophies?userId=X&season=Y`, which already filtered server-side by season). `user/[id].tsx` now renders an Achievements section with the same badge-image cards as the owner's own profile. Because `season` is passed straight from the profile's season-selector state into the query, achievements strictly only show for the year they were earned — flipping the selector refetches and swaps the set.

### ✅ Week lock time bug fixed + locked-state pill on picks — `getWeekLockTime()` in `server/src/utils/lockTime.ts` was computing the Wednesday 9PM PST deadline a full day early (Wednesday 05:00 UTC instead of Thursday 05:00 UTC), ignored DST, and didn't filter by `seasonType` — so preseason and regular season weeks sharing a week number could pick up each other's lock time. This caused preseason Week 1 picks to lock ~2 days early, which made pick edits silently fail/revert and made Week Picks show as locked before the real deadline. Fixed with proper Pacific-timezone wall-clock math (DST-aware) and a `seasonType` filter on `week_settings` + the games lookup. Also: `GET /api/games` now returns the server's authoritative `isLocked` per week (was previously a hardcoded-false client-side guess in `mobile/src/lib/lockTime.ts`, which is now deleted); `picks.tsx` reads `games[0].isLocked` instead. `GameCard.tsx` shows a "🔒 Picks locked" pill in place of the tappable Edit Pick once a week locks.

### ✅ App icon shipped — Nick supplied `App_Icon_Updated.png` (full-bleed square logo, no pre-baked rounding). Resized to `icon.png` (1024×1024, iOS). Android's `adaptive-icon.png` and `splash-icon.png` were still Expo's default placeholder bullseye graphic (never customized) — fixed both: chroma-keyed the navy background out of the logo to a transparent cutout, then composited it into Android's safe zone (~60-65% fill, so circular/squircle launcher masks don't clip "THE"/"GAME"). Verified by compositing against the actual `#0f0f0f` background color both use.
- **eas.json fix**: `preview` profile had `"distribution": "store"` for both platforms (from the earlier TestFlight fix) — this breaks Android since Google Play isn't set up and "store" distribution builds an AAB, not an installable APK. Split into platform-specific overrides: `ios.distribution: "store"` (TestFlight), `android.distribution: "internal"` (direct APK download link, matches how Nick tests on his dad's phone).
- **Shipped**: iOS build 3 uploaded to App Store Connect (submitted manually by Nick — non-interactive `eas submit` needs `ascAppId` in eas.json which isn't set yet, and Apple ID/2FA can't be automated). Android build installed via direct APK link. Both confirmed looking good on-device.
- Icon/splash changes are native — they do **not** ship via OTA (`eas update`). Only a full `eas build` + reinstall (TestFlight update / new APK) shows them.

### ✅ Live scores, pick grading, and preseason/regular-season stat bleed — FIXED (Aug 10 2026). Nick reported the Aug 6 preseason opener never got a live score, quarter/clock, or final result, and wins weren't awarded. Four compounding bugs found and fixed (commits `074a19a`, `88f9ff3`, `6869fc9`, `625b799`):
1. **`picks.isCorrect` was never being written for any live 2026 game** — only the one-time 2025 CSV migration ever set it, so wins/losses, H2H, and Achievements silently never counted. Added `gradeGamePicks()` in `espnService.ts`, called whenever a synced game resolves to `status='post'` with both scores present. Ties are left ungraded (not a win or loss for either side).
2. **The live-score cron could never bootstrap itself** — it only looked at games already `status='in'`, but nothing ever performed the first pre→in transition automatically during preseason (the only job that could, Tuesday 6AM, is regular-season-only and skips itself via `isPreseasonMode()`). `updateLiveScores()` now finds games where `gameTime <= now AND status != 'post'` instead, and syncs using each game's own `season`/`seasonType` instead of a globally recomputed `getCurrentNFLSeason()` (which doesn't flip to 2026 until Sept 1 and was silently resyncing the wrong season).
3. **Root cause of every ESPN request failing: a spoofed Chrome `User-Agent` header — not a "Railway IP block."** This had been misdiagnosed for months (see the old "Railway IP Block" section this replaced, further down). Akamai's bot detection 403s that specific header combination on every endpoint, from any network — confirmed by direct testing. Removed the UA override entirely in `espnService.ts` and `sync-2026-local.ts`. This also means the Admin → NFL Tools "Sync Team Stats" / "Sync Win Probabilities" buttons should now work directly from Railway — the local-script workaround should no longer be needed most weeks (see ESPN section further down).
4. **Preseason/regular-season week-number collision** — `calculateWeeklyTrophies` (weekly Achievements) and `GET /api/picks/by-team` didn't filter by `seasonType`, so once the regular season starts, a Week 1 calculation would've also pulled in preseason Week 1's games (same week number, same season year). Both now scoped to `seasonType` (default `'regular'`).
- Also fixed: mobile's `useSyncScores` hook never sent `seasonType` at all (silently requested regular-season data during preseason and failed — this was the proximate cause of the "Sync Scores Only" button failure Nick hit); removed the dead-end duplicate `syncWeekScores` function (no fallback, no grading) in favor of routing through the fixed `syncWeekGames`; added `npm run sync:games -- <week> <season> <seasonType>` as a reusable local backfill script (matches the `sync:winprobs`/`backfill:stats` pattern).
- **Verified against production**: the Aug 6 game now shows `status=post`, `homeScore=30`, `awayScore=33`, `period=4`, `STATUS_FINAL`; all 6 picks on it graded correctly. This week's real 16-game preseason slate (ESPN's own "week 1" turned out to be just the standalone Hall of Fame Game — the main slate is "week 2", kicking off Thu Aug 13) didn't even exist in the DB yet and has been synced in with correct kickoff times, picks open and unlocked.
- **Small UI fix in the same pass**: the "🔒 Picks locked" pill (added in the Aug 5 lock-time fix above) was showing even once a game went live or final, sitting redundantly next to the quarter/clock or FINAL badge. Now gated to pre-kickoff only (`GameCard.tsx`).
- **OTA published Aug 10 2026** — the mobile-side changes (Sync Scores fix, locked-pill fix) shipped via `eas update --branch preview`, confirmed working on Nick's device (close + reopen app to pick up).

### ✅ Week Picks Gridirons/Global filter — DONE (Aug 10 2026). `GET /api/picks/week` was hardcoded to Gridirons-only for every viewer, no selector at all. Now mirrors `/api/leaderboard`'s filter pattern exactly: Gridirons default to seeing Gridirons and can toggle to Global (same `Toggle` UI as the Leaderboard tab); everyone else is always forced to `'global'` server-side regardless of what's requested, and the toggle is only rendered for Gridirons in the first place. `useWeekPicks` hook and `week-picks.tsx` updated to match.

### Preseason win probability — CONFIRMED: no data, not a bug
Nick asked why preseason games don't show win probability on Game Detail. Tested directly against ESPN's `/summary` for an actual 2026 preseason game — the `predictor` field (FPI-based projection the app reads) is simply absent for preseason games; ESPN doesn't publish it (FPI is a season-strength model, preseason rosters/lineups aren't representative). Also, `syncWinProbabilities()` in `espnService.ts` is hardcoded to `seasonType='regular'` anyway. Nothing to fix — this is an ESPN data-availability limit, not a sync bug. Don't "fix" this again without first re-checking whether ESPN has started publishing preseason predictor data.

### ✅ Admin pick-activity audit trail + readable DB view + pick-from-Game-Detail — DONE (Aug 10 2026)
For dispute resolution ("I never picked that" / "I didn't change it"):
- `pick_audit_log` (already existed in schema, but was only written to on admin overrides) now logs **every** pick action — `create`, `update`, `delete` (in `picks.ts`), `default_applied` (in `scheduler.ts`'s `applyDefaultPicks`), and `admin_edit` (unchanged) — each with an exact server timestamp.
- New `GET /api/admin/pick-audit-log?season=&seasonType=&week=&userId=` resolves entries to readable team names (joins `users`/`games`). New Admin → **Activity** tab (5th tab) browses it by season type + week, showing player, matchup, exact timestamp, and a plain-English action description (e.g. "Changed pick from Seahawks to Cowboys").
- New read-only Postgres view **`picks_readable`** (created via `server/src/scripts/create-picks-readable-view.ts`, already run against production — re-run anytime with `npx tsx --require dotenv/config src/scripts/create-picks-readable-view.ts` from `server/`, it's `CREATE OR REPLACE` so always safe) — lets Railway's DB browser show the matchup + actual picked team name next to each pick row instead of just raw game/user IDs. Not part of the app's query path, purely for manual inspection: `SELECT * FROM picks_readable ORDER BY created_at DESC;`
- Game Detail screen (`game/[id].tsx`) now has a "Pick to win" button under each team — a separate tap target from the existing team blocks (which still navigate to Team Detail on tap, unchanged). Reuses the same `useSubmitPick` hook/eligibility rule (`canPick = !isLocked && isPicksOpen && (isPre || isLive)`) as the Picks tab's `GameCard`. `GET /api/games/:id` now also returns `isPicksOpen` (previously only the list route did) so this eligibility check works correctly on Game Detail.

### ✅ Current-week/season-type detection fixed (root cause of "Week 18" notifications during preseason) — DONE (Aug 10 2026)
Nick noticed weekly push notifications still said "make your Week 18 picks" during preseason. Root cause: `getCurrentNFLWeek()` derived "current week" by taking the max week number across ALL games for the season with no `seasonType` filter — once the full 2026 regular-season schedule (weeks 1-18) got synced ahead of time, it always won that comparison. Confirmed in `activity_log`: the Wednesday lock notification said "Week 18 picks are locked" every week since June regardless of what was actually happening.
- Replaced with `getCurrentWeekAndType()` in `server/src/utils/season.ts` — **data-driven, not calendar-guessed** (calendar math doesn't work here: 2026's preseason "week 1" was a lone standalone Hall of Fame Game a full week before the real 16-game "week 2" slate). Regular season is considered active once its first game's kickoff has passed; otherwise preseason. Within whichever is active, current week = the first one whose picks aren't locked yet, so it auto-advances week to week and rolls from preseason into regular season the moment the latter's opening kickoff passes. `getCurrentNFLSeason()` itself was already correct (flips in March, not the September CLAUDE.md previously and incorrectly documented — fixed that too).
- Threaded `seasonType` through every scheduler cron job and all push-notification text (`notificationService.ts`) — now says "Preseason Week X" during preseason instead of a bare "Week X". Tuesday's weekly-transition job no longer bails via the effectively-always-off `isPreseasonMode()` toggle; it now runs correctly for whichever season type is actually current. Win-prob sync crons skip preseason entirely (ESPN has no predictor data for it, confirmed directly against their API).
- Added `GET /api/games/current-week` + mobile `useCurrentWeek()` hook so screens can correct their default landing week/season-type using the same data-driven answer instead of guessing with calendar math. Wired into **`picks.tsx`** and **`week-picks.tsx`** (both were stuck defaulting to "week 1" for the entire preseason window before this — Nick hit the `week-picks.tsx` case live and it was fixed same night). Each keeps its fast calendar-guess for the very first paint (`getDefaultSeasonType()` in `picks.tsx`, `getDefaultEntryIdx()` in `week-picks.tsx`), then corrects itself once via `useEffect` when the real server answer loads — but only if the user hasn't already navigated away from the default season/type.
- **NOT YET wired to this fix**: `leaderboard.tsx`'s weekly-view toggle, `admin.tsx`'s NFL Tools week picker, and `user/[id].tsx` (public profile) still use the old calendar-guess `getCurrentNFLWeek()` from `nflSeason.ts` for their default week. Lower impact (Leaderboard defaults to season view not weekly; Admin/profile are lower-traffic or manually-navigated), but same underlying bug if anyone hits it — apply the same `useCurrentWeek()` pattern if it comes up again.
- Shipped via OTA (`eas update --branch preview`) same night — confirmed picked up on Nick's device.

### ✅ Weekly picks proof-of-record email — SHIPPED (Aug 10 2026)
Sends every user their own locked-in picks for the week as a private, individual email (dark-themed HTML matching app style) right after Wednesday 9PM lock, once default picks are applied so it reflects each user's final state. **One separate email per user, containing only that user's own picks — never anyone else's.**
- `server/src/services/emailService.ts` — `sendWeeklyPicksEmails(week, season, seasonType, onlyUserId?)`, wired into the Wednesday 9PM cron in `scheduler.ts`. Uses [Resend](https://resend.com); `RESEND_API_KEY` in `server/.env` and Railway variables (**note: Nick regenerated this key once already — Resend only shows a key's value once at creation, so "Add API Key" again creates a new one, doesn't reveal the old one. If email stops working, check whether the key was regenerated and Railway wasn't updated to match.**)
- **Domain**: `gridironsports.net` (bought and verified in Resend, DNS records added at registrar). Sender is `The Long Game <picks@gridironsports.net>`, set via `EMAIL_FROM` in Railway variables (falls back to Resend's shared `onboarding@resend.dev` if unset — **that shared sender can ONLY deliver to the Resend account's own verified email, not to real users, so `EMAIL_FROM` must stay set on Railway or the feature silently stops reaching anyone but the account owner**).
- Testing tools: `sendPreviewEmail(toEmail, teamName)` in `emailService.ts` sends the real template with dummy picks (no real data needed) — use this to check template changes. Admin → NFL Tools → "Send Test Picks Email (to yourself)" button (`POST /api/admin/email/test`) sends the calling admin their own real current-week picks. `GET /api/admin/email/status` returns `{resendConfigured: boolean}` to unambiguously check whether `RESEND_API_KEY` reached the deployment (a 0-sent test result is otherwise ambiguous between "no picks" and "key missing").
- Found and fixed a silent-failure bug while testing: the Resend SDK returns API errors as `{ error }` instead of throwing, so a rejected send was resolving "successfully" and getting counted as delivered. Now checked explicitly — see `sendWeeklyPicksEmails`'s per-user try block.
- **Verified fully end-to-end against production** (Aug 10 2026): real `POST /api/admin/email/test` call against Railway returned `{ sent: 1, week: 2, season: 2026, seasonType: 'preseason' }` using Nicholas's actual current picks, delivered via the verified domain to his real app-account email (`nickcorum@gmail.com`, which is NOT the same address his Resend account is registered under — proving the shared-sender restriction is fully resolved). Wednesday 9PM lock should now email everyone automatically going forward.

### ✅ "Current week" rollover bug fixed (root cause of missed week 2 email + app jumping to week 3 early) — DONE (Aug 12 2026)
Nick reported two related bugs: (1) preseason week 2's proof-of-picks email never went out even though picks locked, and (2) the app started defaulting to preseason week 3 the instant week 2 locked — a full week before week 3's games even start. Root cause was the Aug 10 2026 `getCurrentWeekAndType()` fix above: it defined "current week" as the first week whose lock time (computed from wall-clock math against each week's own games) hadn't passed yet. Since the full season schedule is pre-synced ahead of time, week 3's games already existed in the DB with a computable (future) lock time well before Tuesday's job ever formally opened it — so the instant week 2's own Wednesday 9PM lock passed, week 3 already looked like "the first unlocked week" to that formula, even though it wasn't actually open. This hit two places at once: the Wednesday 9PM cron itself reads "current week" to know what to lock/email/default-pick, so at 9:00pm it could already see week 3 (empty, no picks) instead of week 2 (real data) — hence zero emails sent; and `GET /api/games/current-week` (→ mobile's `useCurrentWeek()`) had the same premature jump, hence the app UI snapping forward early.
- Fixed in `server/src/utils/season.ts`: "current week" is now driven by the `unlocked_weeks` table (what the Tuesday 6AM job has actually opened) instead of raw lock-time math — `getCurrentWeekAndType()` reports the max already-unlocked week for the active season type, so it only advances on Tuesday, never merely because Wednesday's lock passed. A new `getNextWeekToUnlock()` (used only by the Tuesday 6AM cron) finds the next sequential week not yet in `unlocked_weeks` to sync/unlock — decoupled from the display-facing "current week" so the two don't fight over the same value.
- Verified live against production immediately after deploy: `GET /api/games/current-week` correctly returned `{week: 2, season: 2026, seasonType: 'preseason'}` (previously would have already shown 3).
- **Week 2's missed lock actions were backfilled manually** the same night via a new one-off script, `npm run backfill:week-lock -- <week> <season> <seasonType>` (`server/src/scripts/backfill-week-lock.ts`, exports `applyDefaultPicks` from `scheduler.ts` for reuse) — ran `backfill:week-lock -- 2 2026 preseason` against production: applied default picks for 2 users, sent 7/11 weekly picks emails (the other users had zero week 2 picks and correctly got skipped, not defaulted — see next entry).

### ✅ Week Picks tab no longer shows non-participants; default-pick eligibility now requires a completed prior week — DONE (Aug 12 2026)
Nick noticed Week Picks was showing users (Gmac, The Purdy Mouths, EWIK) who'd never made a single pick, with blank rows. Root cause: `GET /api/picks/week` in `server/src/routes/picks.ts` listed every user matching the Gridirons/Global filter (`isGridiron`/`nflAccess`) with no check for prior participation — unlike the leaderboard query, which already requires `HAVING COUNT(picks) > 0`. Fixed by applying that same "at least one pick this season+seasonType" gate to the Week Picks user list, so membership now matches the leaderboard exactly.
- Nick separately flagged that `applyDefaultPicks()` (Raiders/away-team auto-fill for missed games) had no participation gate at all — a freshly-created account with zero real picks would still get auto-filled every week, making brand-new non-players look like active participants indefinitely. **Confirmed with Nick**: default picks should only apply to a user once they've already completed at least one *other* week this season (their very first active week is never auto-filled, even for games they forgot) — implemented in `applyDefaultPicks()` in `scheduler.ts`. This is stricter than "made any pick this week" — a user who picks only 1 of 8 games in their first-ever week will NOT get the other 7 defaulted; only from their 2nd active week onward does missing-game auto-fill kick in.

### ✅ Temporary preseason toggle on public profile pick comparisons — DONE (Aug 12 2026), REMOVE before regular season starts
Nick needed to test H2H pick comparisons on `user/[id].tsx` before the 2026 regular season has any games to compare. Season record/week-history/insights on profiles intentionally stay regular-season-only (see "Profile stats regular-season-only" above) — this does NOT change. Added a small toggle pill, shown only inside the H2H comparison section and only while `useCurrentWeek()` reports `seasonType === 'preseason'` for the viewed (current) season, that switches just that section's `useWeekPicks` call between `seasonType: 'regular'` and `'preseason'`. **This is explicitly temporary** (Nick's call, Aug 12 2026) — self-limiting in that it disappears on its own once regular season starts (the gating condition goes false), but the toggle code itself (`PickComparison` in `mobile/app/user/[id].tsx`) should be removed outright once regular season data exists and it's no longer needed for testing.

### Next priority items:
1. **UI polish pass** — Go screen by screen: Login/Onboarding → Picks tab → Game Detail → Leaderboard → Week Picks → Profile. **This is the final gate before App Store + Google Play submission.** (Activity panel was removed — replaced by feedback modal.)
2. **Rules/instructions page — HARD BLOCKER before App Store/Google Play submission (Nick reconfirmed Aug 12 2026).** Two requirements: (a) the default first-run screen a brand-new user lands on (onboarding flow) must itself explain the rules — not just link out to them; (b) rules must also be reachable afterward from somewhere in the app (Profile or Settings) for existing users. Rules to cover: picks lock Wednesday 9PM PST, missing picks default to Raiders (if playing) or away team — but only after a user has completed at least one prior week (see default-pick eligibility fix, Aug 12 2026), weekly achievements awarded Tuesday, leaderboard shows all users or Gridirons-only. Confirm exact copy + placement with Nick before building.
3. **Past seasons row on Profile** — W-L per season for historical context
4. **Onboarding polish** — Nick wants redesign before launch
5. **TestFlight for remaining Gridirons** — after UID reassignments are done, invite via App Store Connect → TestFlight → External Testing → add by email.
6. **ascAppId for non-interactive TestFlight submits** — add to `eas.json` submit.preview profile so `eas submit --non-interactive` works without Nick's Apple ID/2FA each time. Find in App Store Connect → My Apps → The Long Game → General → App Information → Apple ID (10-digit number).
7. **Remove the temporary preseason H2H toggle before regular season starts** — `PickComparison` in `mobile/app/user/[id].tsx` (added Aug 12 2026, see below). Testing-only; self-hides once regular season begins but the toggle code should be deleted outright, not just left dormant.

### Win Probability — weekly workflow
⚠️ **Currently broken from Railway** — see "UNRESOLVED, IN PROGRESS — ESPN live score sync blocked from Railway" at the top of this doc. The Aug 10 2026 UA fix below did NOT durably resolve it; ESPN/Akamai is blocking all Railway (and Cloudflare Worker) traffic again as of Aug 12-13 2026. Until the Raspberry Pi relay is live, run locally instead: `npm run sync:winprobs <week> 2026` from `server/`, e.g. `npm run sync:winprobs 1 2026`, ideally Wednesday afternoon before the 9PM lock.

### Achievement images + Profile display redesign — DONE
All 5 images wired in (`mobile/assets/achievements/`), Achievement Case redesigned to full-bleed badge images with no item cap. Shown on both own Profile and public profiles, season-filtered. See "Achievement & Trophy System" section above.

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
**Status:** Phase 5 in progress. Preview build 3 on Nick's iPhone (TestFlight) and Android (direct APK), both with the new branded app icon. OTA updates working on preview channel. All mobile/backend work that had been sitting uncommitted locally is now pushed to GitHub (was previously only reflected in the actual TestFlight/EAS build, not git history).  
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
  // Flip to new season in March — after the Super Bowl, before preseason
  return month >= 3 ? year : year - 1;
}
```
NEVER hardcode 2025 or any year. Lives in `server/src/utils/season.ts` and `mobile/src/lib/nflSeason.ts` (identical logic, kept in sync manually). This snippet previously said `month >= 9` here, which was stale/wrong — the actual code has flipped at March for a while; the doc just never got updated to match, which caused real confusion during the Aug 10 2026 "Week 18" bug investigation. **For "what week is it," don't use `getCurrentNFLSeason()` alone** — use `getCurrentWeekAndType()` (server) / `useCurrentWeek()` (mobile), which are data-driven and season-type-aware. See the Aug 10 2026 entries above.

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
- **Achievements** = Weekly awards. Stored in `trophies` DB table. Always say "Achievements" in UI. All 5 have real images in `mobile/assets/achievements/`.
- **Trophies** = Season-end podium (champion/runner_up/third_place/last_place). **BUILT** — stored in `season_trophies` DB table. Awarded via Admin → NFL Tools → "Award Season Trophies" (see below). Displayed as "Trophy Case" on Profile + public profiles, currently emoji placeholders (🥇🥈🥉🥄).

### Achievement Types
- **most_wins** — Most correct picks that week (ties = multiple winners)
- **loser** — Most incorrect picks that week
- **upset_pick** — Correctly picked lowest win probability winner (uses `winningTeamWinProb`)
- **lone_wolf** — ONLY player to correctly pick a winner
- **contrarian** — Correctly picked winner when ≤20% of players chose that team

All 5 achievement images done, in `mobile/assets/achievements/{most_wins,loser,upset_pick,lone_wolf,contrarian}.png`.

### Season Trophies (podium)
- Table: `season_trophies` (userId, season, sport, placement, wins, losses, awardedAt)
- Logic: `calculateSeasonStandings(season)` + `awardSeasonTrophies(season)` in `server/src/services/trophyService.ts` — Gridirons-only, regular season, same ranking as leaderboard (wins desc, losses asc). Idempotent — re-running skips already-awarded placements.
- Last place: ties on wins/losses both get awarded (not just whichever row lands in the last sequential rank slot — rank numbers are always sequential 1..N even when records tie).
- Admin endpoints: `GET /api/admin/season-standings?season=X` (preview), `POST /api/admin/trophies/award-season` (commit). Public: `GET /api/trophies/season?userId=X` (all seasons, for profile display).
- Mobile: Admin → NFL Tools → Actions → "Award [Season] Season Trophies" — shows computed standings in a confirm dialog before committing. Run this every year after the regular season ends.

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

### ⚠️ SUPERSEDED — see "UNRESOLVED, IN PROGRESS" entry at the top of this doc (Aug 13 2026)
This section originally claimed the fix below was the full resolution. It wasn't — the same blocking (400/403 from Railway) resumed/never actually stopped, and was later confirmed to also hit a Cloudflare Worker and a native-`fetch()` rewrite, ruling out both "just Railway" and "just axios's default UA" as the full explanation. Kept below for historical context on the UA finding, which was still a real and worthwhile fix, just not sufficient on its own.

### Aug 10 2026 — "Railway IP Block" on ESPN was actually (partly) a bad User-Agent header
Every ESPN call in `espnService.ts` (and `sync-2026-local.ts`) sent a hardcoded desktop-Chrome
`User-Agent` string on every request. Tested directly against `site.api.espn.com` from multiple
networks: that header alone — with none of a real browser's other fingerprint headers — gets
403'd by Akamai's bot detection on **every** endpoint (`/scoreboard`, `/summary`, `/teams/*/schedule`),
including requests that otherwise succeed fine. This was never Railway-specific; a request with no
UA override (axios/curl default) succeeds from anywhere, including Railway. Removed the UA override
entirely (`ESPN_HEADERS` now just sends `Accept: application/json`). Confirmed against production
that live scores, quarter/clock, and pick grading now flow automatically via the 30-second cron —
no manual sync should be needed most weeks going forward.

The section below describing the old workaround is kept for reference / in case Akamai's rules
change again, but as of this fix the local-script requirement should no longer apply:

1. Stats backfill: `npm run backfill:stats` in server/ (should now also work via Admin → NFL Tools button)
2. Win probability sync: `npm run sync:winprobs <week> <season>` in server/ (should now also work via the admin button / Tuesday-Wednesday crons)
3. New: `npm run sync:games -- <week> <season> <seasonType>` — reusable local wrapper around `syncWeekGames`, for manual backfill if a week's automatic sync ever misses (e.g. `npm run sync:games -- 1 2026 preseason`).

If any of these start failing with 403s again, re-run the diagnostic: `curl -A "axios/1.7.9" -H "Accept: application/json" "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=1&seasontype=1&season=2026&limit=50"` — a plain/no-UA request succeeding while the app's requests fail would point back at a header/fingerprint issue, not an IP block.

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
**Admin** — Profile → ⚙️ Settings → Admin Dashboard (admins only). Tabs: Users | NFL Tools | Data | Feedback | Activity (pick-action audit trail, added Aug 10 2026)

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
- **Admin Sync Team Stats / Win Probabilities buttons** — should now work directly from Railway (Aug 10 2026 fix, see ESPN section). If either ever 403s again, fall back to `npm run backfill:stats` / `npm run sync:winprobs <week> <season>` locally.

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

- Past seasons: how many years back to support in season selector?
- Season trophy (podium) real artwork — currently emoji placeholders (🥇🥈🥉🥄), same path as Achievements (ChatGPT-generated images later)
- Premium pricing and features
- Google Play account setup timing

---

## About Nick

- GitHub: corumnick-oss | Admin team name: Nicholas
- Windows 11, iPhone, no prior mobile dev experience
- Always ask before making product/design decisions
- Use Claude.ai chat for planning and strategy; Claude Code for building
- Original Replit web app — do not reference that code
