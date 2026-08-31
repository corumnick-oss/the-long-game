# The Long Game — Complete Project Briefing for Claude Code

## IMPORTANT: Read This First
This document contains everything you need to know about this project. Read it completely before writing any code or making any suggestions. Every decision in here has been carefully discussed and agreed upon with Nick (the owner). Do not deviate from these decisions without explicitly asking first. When in doubt, ask Nick.

**ALWAYS confirm your implementation plan with Nick BEFORE writing any code.** List the files you intend to change and what you'll do to each. Wait for Nick to say "go ahead" or "yes" before making edits. This prevents wasted work if Nick's priorities have changed.

When starting a session say: "I've read CLAUDE.md and I'm ready to continue."

---

## ⚠️ DO THIS FIRST NEXT SESSION

### ✅ Moved the app into the 2026 regular season + preseason no longer counts for default picks + automatic win-prob syncs + per-team stats fallback — DONE (Aug 30 2026)
Four things (items 1–3 in one backend + OTA deploy; item 4 a same-day backend-only follow-up):

1. **App now defaults to 2026 regular season, Week 1, everywhere** (preseason still reachable via each screen's season toggle). Mechanism: a new `app_settings.forceRegularSeason` flag. When `'true'`, `getCurrentWeekAndType()` (`server/src/utils/season.ts`) reports the regular season even before Week 1 is unlocked or the first game kicks off — the week is still computed normally so it auto-advances as weeks unlock, and the flag can be left on permanently (no-op once the season truly starts). **Nick set it via `npm run season:regular` from `server/`** (new script `src/scripts/set-regular-season.ts`; `npm run season:regular -- off` reverts). Also added `'forceRegularSeason'` to the `PATCH /api/admin/app-settings` allowlist. Mobile: dropped the hardcoded "flip to regular on Sept 7" calendar guesses in `picks.tsx` / `leaderboard.tsx` / `week-picks.tsx` (now just default to regular); `leaderboard.tsx` also now moves its season selector to whatever `useCurrentWeek()` reports (it previously ignored the server entirely). `picks.tsx` "week not open yet" banner reworded from the day-specific "unlock at 6:00 AM PST on Tuesday" to a generic "This week's picks aren't open yet."
   - **"Show now, open later" was Nick's explicit choice** — the flag makes the whole app *display* regular Week 1 now, but Week 1 picks stay closed (locked banner) until Nick actually taps **Admin → NFL Tools → Unlock Week → Week 1, Regular Season** (still planned for ~Sun Sept 6, see the reminder below). `determineSeasonType()` also now flips to `'regular'` the moment *any* regular week exists in `unlocked_weeks`, so once Nick unlocks Week 1 the scheduler/notifications are fully consistent too.
   - ⚠️ **Nick MUST still manually unlock Week 1.** With `forceRegularSeason` on but Week 1 not unlocked, and the first regular game not until Sept 9, the Tuesday 6AM cron stays in preseason mode through Sept 8 and will NOT auto-open Week 1. If Nick never taps Unlock Week, Week 1 doesn't open until the Tuesday *after* the first game (Sept 15) — far too late. The visible locked "Week 1" banner all week is the reminder; the Sept 6 plan below stands.
2. **Preseason picks no longer count toward default-pick eligibility.** `applyDefaultPicks()` (`scheduler.ts`) built its "has this user completed at least one other week" set from a query filtered only by season+sport — so 2026 preseason picks made everyone eligible for auto-fill in regular Week 1. Now filtered by `seasonType` too: a user needs ≥1 *other completed regular-season week* before missing games get auto-filled. Net effect — regular-season Week 1 auto-fills nobody (which is what the old "explicitly skip week 1" note in the reminder below always claimed, but the code hadn't actually done since preseason data existed). Auto-picks apply to **all `nflAccess` users, not just Gridirons** (unchanged — that's every 2026 user per Rule 8).
3. **Automatic win-probability syncs restored** — see the rewritten "Win Probability — weekly workflow" section below. Removed the stale Tuesday-9PM and Wednesday-6AM crons; win-prob now syncs Tuesday 6AM (folded into the weekly transition) + Wednesday 5PM, plus the existing admin button. Works from Railway via the Pi relay now (the "broken from Railway" era ended with the permanent Pi relay in mid-August; nobody had re-enabled the automatic path).

Also hardened the Tuesday 6AM cron: it now bails early if the week it would unlock is already unlocked (stops it re-syncing/re-sending "week open" every Tuesday once all synced weeks are done — a latent bug), and `nextWeekToUnlock()` won't advance to week N+1 while week N is still open (protects against an early manual unlock making the next Tuesday job jump ahead).

4. **Pre-game team stats on GameCards / Game Detail now fall back to last season PER TEAM**, matching what Team Detail already did. `fetchTeamStatsMap()` in `server/src/routes/games.ts` used to switch the whole request off 2025 the moment *any* 2026 regular game completed — so mid-Week-1, teams that hadn't played yet showed blank pre-game stats. Now each team keeps its 2025 averages until it has a completed 2026 game, then switches individually; `statsSeasonUsed` reports the oldest season still shown (so the "Using 2025 season averages" note stays until every team on screen is on 2026). Skips the 2025 query entirely once all requested teams have current-season stats. Backend-only, no OTA needed.

Deployed Aug 30 2026: backend build + commit + push (Railway auto-deploy); `npm run season:regular` run by Nick (`forceRegularSeason` now `'true'` in prod — confirmed `GET /api/games/current-week` returns regular Week 1); mobile `eas update --branch preview` (group `0d4b086d-8961-4e4d-bba3-e452dc44e5f0`). Item 4 (per-team stats fallback) shipped as a same-day backend-only follow-up commit.

### ⚠️ KNOWN ISSUE, LEAVE AS-IS FOR NOW (Nick's call, Aug 25 2026) — Leaderboard weekly week-picker still collapses unexpectedly
Built as part of the Aug 25 2026 feature batch below. The week picker (Leaderboard → Weekly → tap the "Week N ▼" pill) is supposed to stay expanded after selecting a different week, only collapsing when the pill is tapped again (`pickerOpen` state in `ListHeader`, `mobile/app/(tabs)/leaderboard.tsx`). Two attempts didn't fix it — first separated the picker from the Season/Weekly toggle into its own explicit expand/collapse control (fixed the original "doesn't feel like a dropdown" complaint), second removed an explicit `setPickerOpen(false)` from the `WeekSelector`'s `onSelect` callback — but Nick reports it still collapses after picking a week. Root cause not found; something else is closing it (possibly the FlatList `ListHeaderComponent` re-rendering/remounting `ListHeader` in a way that resets its local `pickerOpen` state, but not confirmed). **Deliberately left broken for now — not worth further time this session.** If picked back up: check whether `ListHeader`'s local `useState` is actually surviving re-renders of the parent `LeaderboardScreen` (add a log, or just lift `pickerOpen` into `LeaderboardScreen`'s own state and pass it down instead of keeping it local to `ListHeader`, which would rule out a remount-losing-state theory regardless of whether that's the actual cause).

### ✅ Weekly bonus opt-in badge, Leaderboard week picker, required OAuth team name, admin CSV export — DONE (Aug 25 2026)
Four features built and shipped in one session:

1. **Weekly bonus opt-in marker** — this is the feature described as "NOT YET BUILT" further down in this doc (see "Next priority items" — that entry is now stale, superseded by this one). Final shape differs from the original draft plan: badge text is plain **"Bonus"** (not a dollar amount), and the admin toggle lives **inline on the Leaderboard's Gridirons-filtered weekly view** (not a separate NFL Tools admin-panel section — Nick's call once the Leaderboard week-selector work below made that screen the natural place for it). Shows only in the Gridirons-filtered weekly view, never Global, and persists correctly per-week as you browse past weeks (not just the current one).
   - `server/src/db/schema.ts` — new `weeklyBonusOptins` table (userId, week, season, seasonType, sport)
   - `server/src/scripts/migrate-weekly-bonus-optins.ts` — migration, **already run by Nick against prod**
   - `server/src/routes/admin.ts` — `POST /api/admin/weekly-bonus/toggle` (idempotent insert/delete)
   - `server/src/routes/leaderboard.ts` — `GET /api/leaderboard` now includes each entry's `weeklyBonusOptIn` flag when `type=weekly&filter=gridirons`
   - `mobile/app/(tabs)/leaderboard.tsx` — "Bonus" badge under a Gridiron's name in the weekly view; admins can tap it to toggle
2. **Leaderboard weekly view is now browsable to any past week**, not hardcoded to only ever show the current week. Reuses the existing `WeekSelector` component (already used elsewhere in the app) for consistency, capped so you can't browse into a future week. **UX went through a few iterations based on Nick's live testing**: originally the week bubbles appeared automatically the instant you switched to the "Weekly" toggle (with the toggle's own label doubling as the current week, e.g. "Week 4") — Nick found this confusing/undiscoverable, not feeling like a real control. Redesigned so "Weekly" is just a plain view-type toggle, and a separate "Week N ▼" pill underneath is what explicitly expands/collapses the week-bubble picker (chevron flips ▼/▲ to show state). **Known remaining bug, deliberately left as-is** — see the entry directly above; the picker is supposed to stay open across multiple week selections but still collapses after picking a week despite two fix attempts.
3. **Team name prompt required after a new Google/Apple sign-up with no usable name.** Closes the gap the Aug 19 2026 Settings fix only partially addressed (that let a user fix an existing bad team name, but did nothing at the moment of signup). Google never provides a name to the app at all; Apple only shares one on the very first authorization (or never, with Hide My Email) — in either case, if `POST /api/users` reports the account as brand-new (201, not 200) and no real name came through, the app now shows a **required, non-skippable** modal asking for a team name before continuing (Nick's explicit call — no "skip for later" option). `mobile/src/context/AuthContext.tsx` (`needsTeamName` state), new `mobile/src/components/TeamNamePrompt.tsx`, wired into `mobile/app/_layout.tsx` (held until team name is set before the notification-permission prompt is even allowed to show, so the two never stack).
4. **Admin CSV export of a locked week's Gridirons-only picks**, for backup/transparency (proving to players Nick isn't manipulating picks) — this is Rule 18 territory (admin export), not Rule 17 (no player-facing picks-download button); the two were never actually in conflict. Real design constraint: the mobile app has no direct file-save mechanism without adding new native dependencies (`expo-sharing`/`expo-file-system` aren't installed, and adding them would force a full native rebuild across TestFlight/Android instead of shipping via OTA) — so instead, tapping "Download Week N Picks CSV" in Admin → Data mints a short-lived (5 min), single-use token via an authenticated request, then opens `${API_BASE}/api/exports/picks.csv?token=...` in the system browser, which can't carry a Bearer header but doesn't need to. Gated to only work once that week is actually locked (same reasoning as the Aug 19 2026 pick-audit-log fix — Nick is a player too, no pre-lock peeking at his own week). CSV columns: Player, Away Team, Home Team, Picked, Result, Picked At (UTC) — Result correctly distinguishes **Pending** (game hasn't finished) from **Tie** (game finished tied), both of which leave `picks.isCorrect` null so the game's own `status` column is what actually tells them apart (a first pass conflated the two as "Tie/Pending" until Nick caught it).
   - `server/src/services/exportTokens.ts` — in-memory token store
   - `server/src/routes/exports.ts` — new router, mounted at `/api/exports` in `index.ts`, deliberately **not** under `admin.ts`'s blanket `requireAuth`/`requireAdmin` middleware since a browser tab can't send a Bearer token
   - `server/src/routes/admin.ts` — `POST /api/admin/export-week-picks-token` (normal admin-authenticated route that mints the token)
   - `mobile/app/admin.tsx` Data tab — real export button (replaced the old placeholder that just verified JSON record counts via the now-deleted `useExportWeekPicks` hook)

All four are backend + JS-only, no new native dependencies — shipped via the normal backend deploy + `eas update --branch preview`, reaching TestFlight, Play Store closed testing, and the sideload build identically, no rebuild needed.

### 📌 DECIDED Aug 25 2026 — running the whole season on TestFlight (iOS) + Play Store closed testing (Android), NOT chasing public store release right now
After the second iOS rejection and the still-unresolved Android sign-in bug (both below), talked it through with Nick and decided to stop chasing public App Store/Play Store release under time pressure. Neither platform's *testing* distribution has a season-length problem once you know the actual mechanics:
- **iOS — TestFlight Internal Testing** (not External, not the public App Store) is the plan. Internal Testing (up to 100 testers, added as App Store Connect team members under Users and Access) never goes through Apple's guideline review at all — it's not a workaround, Apple built it to not require review. The Gridirons (7 people) fit easily under the 100 cap. The pending/rejected App Store submission is being **left as-is, not withdrawn** — it doesn't interfere with Internal Testing running in parallel, and can be resubmitted whenever the metadata fix (below) is actually done.
  - **Caveat, needs a recurring process**: TestFlight builds expire 90 days after upload — not a data-loss event (tester just opens TestFlight and taps Update, same as any app update), but it does require action, and TestFlight only shows the "expires in X days" warning ~30 days out. To avoid this landing mid-season with no warning, **push a fresh internal-testing build proactively every ~60 days** rather than waiting for expiry. Not yet done: no fresh build has been pushed to reset the clock — current build 3's actual upload date isn't logged anywhere in this doc, so the real expiry date is unknown. **Next session: check build 3's actual upload date in App Store Connect (or just push a fresh one now to get a clean, known 90-day clock), then pencil in rebuild checkpoints roughly every 60 days through the season (regular season runs Sept 4 2026 – early/mid Feb 2027).**
- **Android — stay on Play Store closed testing, do NOT switch testers to the sideload APK.** Unlike iOS, closed testing has **no expiration at all** — an installed app from a closed-testing release keeps working indefinitely, same as production. The 12-tester/14-day requirement mentioned elsewhere in this doc is *only* a gate Google checks before allowing promotion to a public Production listing — it does not limit or expire the closed-testing track itself, and is irrelevant unless/until Nick wants a public Play Store listing. Switching existing testers to the sideload APK instead would actually make things worse — the Play Store build and the sideload build are signed with different certificates, so Android refuses to install one over the other; every tester would have to uninstall and manually sideload-install (enabling "install unknown apps," working around Play Protect warnings), a much rougher UX than the Play Store's normal one-tap update. Sideloading remains a reasonable fallback only if the Play Store track becomes truly unusable, not a proactive move.
- **Net effect of both:** the two "UNRESOLVED" items directly below are now background/best-effort, not season-blocking — see each entry's Aug 25 2026 update for current status.

### ⚠️ ACTION REQUIRED before deploying the Aug 24 2026 lock-time fix (see below) — run the migration FIRST
`npm run migrate:week-lock-tracking` (from `server/`) must be run against prod **before** (or in the same breath as, but not after) pushing this backend change. It adds two nullable columns (`reminder_sent_at`, `lock_processed_at`) to `unlocked_weeks` that the new code queries by name on every request that touches that table — including the existing Tuesday-unlock job and `applyDefaultPicks` — so if the new code deploys first, every one of those queries will fail with a Postgres "column does not exist" error until the migration runs. Same reason as every other schema change: the sandbox's auto-mode classifier blocks direct prod-DB writes from Claude Code, so **Nick has to run this one himself**, same as `migrate-notification-prefs.ts` before it. The script also backfills every already-past week's tracking columns so the new dynamic cron doesn't treat years of history as "pending" on its first tick (see below) — it deliberately leaves the currently-open week unmarked so it still gets a real reminder/lock notification at its actual lock time.

### Reminder — manually unlock Week 1 (regular season) on Sunday, Sept 6 2026, not Tuesday
Week 1's earliest game is Wednesday Sept 9, 2026, so its real lock time (see below) is Tuesday Sept 8 at 11:59PM PST. As of the Aug 30 2026 change above, the app already *displays* regular-season Week 1 everywhere (via `forceRegularSeason`), but Week 1 picks stay **closed** until Nick unlocks the week — and the Tuesday 6AM cron will NOT auto-open it (it's still in preseason mode until the first regular game on Sept 9). So this manual step is now required, not just a nicety: **on or after Sunday, Sept 6, go to Admin → NFL Tools → "Unlock Week" → Week 1, Regular Season.** Safe to do early — `applyDefaultPicks` no longer auto-fills regular Week 1 for anyone (preseason picks don't count toward eligibility as of Aug 30 2026), achievement-award logic skips week 1 (`week > 1` guard), and the games are pre-synced. One thing the manual button does NOT do that the Tuesday auto-unlock would: send the "Week 1 is now open!" push. To notify players, follow up with Admin → NFL Tools → Broadcast Notification (All Users) right after tapping Unlock Week.

### ✅ Admin Activity tab timestamps weren't forced to PST — DONE (Aug 24 2026)
Nick flagged that the activity feed didn't look like it was showing PST. Found it: Admin → Activity tab (`ActivityTab` in `mobile/admin.tsx`, the pick-audit-trail used for dispute resolution) formatted `pick_audit_log.created_at` via `toLocaleString()` with no `timeZone` option — so it silently rendered in whatever timezone the viewing phone's OS was set to, not a fixed PST. That matters specifically here because this screen exists to judge picks against the fixed PST lock deadline (see below) — if the admin's device isn't set to Pacific, timestamps would be off from the actual rule boundary with no indication. Fixed by explicitly passing `timeZone: 'America/Los_Angeles'` and appending " PT" to the display, matching the convention already used elsewhere (e.g. `emailService.ts`'s `formatGameTime`). Also fixed the same missing-timezone pattern in the Admin Feedback tab's two timestamp displays (list + detail modal) for consistency, since they're the same bug even though Nick didn't flag those specifically.
- **Deliberately NOT changed:** game-time displays elsewhere in the app (`GameCard.tsx`, `game/[id].tsx`, `team/[name].tsx`, etc.) also omit `timeZone` and render in the device's local timezone — that's correct as-is, since a kickoff time is naturally most useful shown in whatever timezone the viewer is actually in, unlike the lock-deadline/audit-trail timestamps above, which are a fixed rule boundary that has to mean the same thing regardless of viewer location.
- **Deployed** Aug 24 2026 via `eas update --branch preview` (update group `11a2c96e-08f9-4c55-9a21-9e68c0185d56`, bundled with the mobile copy changes from the lock-time fix below).
- **First two attempts didn't actually work — both were chasing the wrong layer.** Attempt 1 assumed `toLocaleString`'s `timeZone` option just needed to be added. Attempt 2, after Nick confirmed force-close/reopen didn't help, assumed Hermes doesn't reliably honor that option on-device and replaced it with manual DST-math in `mobile/src/lib/pacificTime.ts` (still a good, ICU-independent helper — kept). Nick tested on iOS specifically and still saw the same wrong result, which ruled out Hermes/Android-specific ICU gaps entirely (iOS has full ICU) and pointed at the input itself being wrong before either formatter ever ran.
- **Actual root cause, found by testing the real server code path directly (not just the ORM):** `GET /api/admin/pick-audit-log` (`server/src/routes/admin.ts`) builds its response via raw `db.execute(sql\`...\`)` (needed for the multi-table JOIN), which returns Postgres `timestamp` columns as a **plain non-ISO string** (`"2026-08-20 06:59:00.918"` — space instead of `T`, no `Z`/offset) instead of a JS `Date` object. `new Date()` on that ambiguous format gets parsed as **local device time**, silently corrupting the instant before any client-side formatting ever ran — so both earlier "fixes" were correctly converting an already-wrong value. Confirmed by testing `db.execute()` directly: the exact same query through Drizzle's typed `db.query.pickAuditLog.findMany()` API returns a proper `Date` object (correctly serializes with `Z`), but the raw-SQL path used by this specific route does not. No other raw-`db.execute()` route in the codebase selects a timestamp column this way (checked `users.ts`, `leaderboard.ts`) — this was isolated to this one query. The Feedback tab (`GET /api/admin/feedback`) was never actually affected either — it uses `db.query.activityLog.findMany()` (the ORM path), so its `createdAt` was always a proper Date; touching it earlier wasn't wrong, just unnecessary.
- **Fixed at the source**: the SQL now formats the timestamp explicitly as ISO 8601 (`to_char(pal.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS."000Z"') AS created_at`), so `new Date()` on the client parses it unambiguously as UTC on any engine, no more reliance on non-standard string parsing. **Lesson for next time a raw `db.execute(sql...)` query needs to return a timestamp: always format it explicitly like this in the SQL — don't select the raw column.**
- **Deployed** Aug 25 2026: backend build + commit + push (Railway auto-deploying). No mobile change needed this time — `pacificTime.ts` was already correct, it just needed a correctly-formatted input.

### ✅ Lock time now formula-driven, not always Wednesday — DONE (Aug 24 2026)
Nick flagged that Week 1's earliest game is on a Wednesday (Sept 9, 2026) and the last regular-season week is Saturday-only — both broke the old lock-time logic. Root cause: `getWeekLockTime()` in `server/src/utils/lockTime.ts` didn't compute "the day before the first game" — it walked backward from the first game's date to **the most recent Wednesday**, which only coincidentally matched a normal week (first game Thursday → lock Wednesday). For a week whose first game IS Wednesday, that walked back zero days, locking hours *after* that game already kicked off; for a Saturday-only week, it walked back three days, locking Wednesday instead of the intended Friday.
- **Fixed the formula itself** (not a special case for these two weeks): lock = 11:59PM Pacific the calendar day before the week's earliest game, full stop. This produces the correct day for every week automatically — normal week → Wednesday (unchanged), Wednesday-opener week → Tuesday, Saturday-only week → Friday — with no per-week admin overrides needed (the existing `week_settings.lockTime` override still exists for genuine one-offs, just isn't needed for this).
- Every pick-visibility check in the app (`GET /api/games`, `/api/picks/week`, Game Detail's pick list, tiebreakers, public-profile H2H) already reads off `isWeekLocked()`/`getWeekLockTime()` — confirmed by grep, no other code path duplicates the old Wednesday assumption — so fixing this one function fixes visibility everywhere with no route changes needed.
- **The actual lock actions (not just the visibility check) also had to become dynamic.** They used to fire on fixed `Wed 8PM` (reminder) / `Wed 11:59PM` (locked push + default picks + proof-of-picks email) crons in `server/src/services/scheduler.ts` — which would've fired a day late for a Tuesday-lock week and up to two days early for a Friday-lock week. Replaced both with a single cron that runs every 5 minutes and checks every unlocked-but-not-yet-processed week against its own real computed lock time, guarded by two new nullable columns on `unlocked_weeks` (`reminderSentAt`, `lockProcessedAt`) so each fires exactly once. This also makes the whole thing self-healing — if the server is ever down when a week's lock time passes, the next tick after it comes back still catches it and fires the actions once, instead of silently skipping that week forever. Requires the migration above.
- Fixed every user-facing and internal reference that hardcoded "Wednesday": `mobile/app/rules.tsx`, `mobile/app/(auth)/login.tsx` (onboarding), `mobile/app/game/[id].tsx`, `mobile/app/(tabs)/week-picks.tsx`, `mobile/app/user/[id].tsx` (all now say "this week's lock" generically instead of naming a day), `server/src/services/notificationService.ts`'s week-unlocked push (now fetches and formats that week's real lock date/time instead of a hardcoded string), and `server/src/services/emailService.ts`'s proof-of-picks email (same — now shows the real lock date/time it was actually locked at). Comments in `server/src/utils/season.ts` and `server/src/routes/admin.ts` updated for accuracy; `server/src/scripts/backfill-week-lock.ts`'s comment describing the historical Aug 5 2026 DST bug was deliberately left as-is (it's describing what actually happened at the time, not current behavior).
- **Also found and fixed before deploying**: `unlocked_weeks` has no unique constraint on (week, season, seasonType) — `onConflictDoNothing()` on the insert has never actually enforced one-row-per-week (confirmed live: prod had 3 duplicate rows for 2026 preseason week 1 alone, from repeated manual "Unlock Week" taps during testing, plus one more for week 2). That never mattered under the old "current week" logic, but the new per-row dynamic cron would have fired the lock push/email once per duplicate row for the same real week. Deduped by (week, season, seasonType) in the cron loop before this ever deployed — see `scheduler.ts`. The underlying missing unique constraint itself was left alone (would need a data dedup pass on existing duplicate rows first, and isn't causing any other problem) — not urgent, revisit only if it comes up again.
- **Deployed** Aug 24 2026: migration (`npm run migrate:week-lock-tracking`, run by Nick against prod — backfilled 7 existing rows across 3 real preseason weeks + old testing/duplicate rows as already-processed, left 0 pending since we're between preseason weeks 3 and 4 right now) → backend commit `b77b071` pushed to `main` (Railway auto-deploying) → mobile OTA via `eas update --branch preview` (update group `11a2c96e-08f9-4c55-9a21-9e68c0185d56`).
- **Verification plan, not yet done**: preseason week 4 unlocks via tomorrow's Tuesday 6AM job (Aug 25). Watch it lock later that week (whatever day its earliest game lands on) via Admin → Activity tab, the push notifications, and the proof-of-picks email, before Week 1 of the real regular season (the actual Tuesday/Wednesday case this was built for) depends on it. Check next session if not already confirmed working.

### ⚠️ BACKGROUND, NOT SEASON-BLOCKING — iOS App Store rejected a 2nd time Aug 25 2026 (season plan is now TestFlight Internal Testing — see decision above)
Apple rejected the Aug 16 2026 submission: "metadata appears to contain potentially misleading references to third-party content... resembles NFL teams/leagues without authorization." Confirmed with Nick: no NFL license exists. Root cause found — Promotional Text, Description, and Keywords fields in App Store Connect all referenced "NFL" directly (e.g. "free NFL picks app", keywords `nfl, nfl picks, nfl pick em, nfl games`). No Subtitle field was set (not a factor). Rewrote all three fields to use generic "football"/"pro football" language, and added a disclaimer sentence to the Description ("not affiliated with, endorsed by, or sponsored by the NFL or any professional football league or team"). Nick made the changes in App Store Connect and resubmitted Aug 21 2026.

**Rejected again Aug 25 2026, two separate issues — both still open, neither started:**
1. **Guideline 4.1(a), still flagged as "metadata... resembles third-party sports teams/leagues."** This round it's almost certainly the **screenshots**, not the text fields (those were already fixed above). Checked the actual screenshot files (`Screenshots/iOS/`, 7 images) — every one shows real official NFL team names and logos (Cowboys star, Eagles wing, Lions, Bengals, Packers, Steelers, etc.), since screenshots are just captures of the real app showing real games, and screenshots count as "metadata" for App Store review. This is the same standing risk already noted below (real ESPN logo artwork, no license) — it just went from "someday, Nick's call" to "actually blocking public release."
   - **There is no way to get a clean screenshot without this fix touching the app itself first** — you can't screenshot around real logos when every game shown is a real game. The only real fix is replacing ESPN's real logo artwork with generic team-colored badges (color + abbreviation, no logo shape) app-wide, *then* retaking screenshots against that. Team names as plain text are believed fine to leave alone (well-settled fair use across the whole fantasy-sports category, and Apple's language reads as being about the recognizable graphic marks specifically) — only the logo images need replacing.
   - **Draft plan discussed but NOT approved/started**: new static `mobile/src/lib/teamColors.ts` (32-team map: name → abbreviation + primary/secondary hex, since the app currently stores zero team color/abbreviation data anywhere, only ESPN's raw logo URLs in `games.homeTeamLogo`/`awayTeamLogo`), a new `TeamBadge` component, swapped in for every real-logo `<Image>` across `GameCard.tsx`, `game/[id].tsx`, `week-picks.tsx`, `team/[name].tsx`, `team-central.tsx`, `picks-by-team.tsx`, `user/[id].tsx`. Backend/DB untouched (can keep syncing logo URLs, just stop rendering them). Pure UI change, ships via OTA. **Badge visual style not yet decided with Nick** (was mid-discussion, deprioritized due to time — pick this back up whenever there's time to spend on it, not urgent since TestFlight doesn't need it).
2. **Guideline 4 — Sign in with Apple button not "clearly identifiable... as a button."** Root cause found: `mobile/app/(auth)/login.tsx` already uses Apple's own official `AppleAuthentication.AppleAuthenticationButton` component (the correct, compliant approach) but with `buttonStyle: BLACK` on the app's dark theme (`bg-background` — Rule 2 is dark-mode-only) — a black button on a near-black screen has almost no contrast. The Google button directly above it is white/clearly visible by comparison. **Fix identified but NOT yet applied**: change `buttonStyle` to `WHITE` or `WHITE_OUTLINE`. One-line prop change in `login.tsx`, ships via OTA, no rebuild — trivial to do whenever there's a few minutes, just hasn't been done yet.

**Follow-up cleanup, same day (Aug 21 2026):** for consistency (not because Apple required it — these weren't flagged), also scrubbed literal "NFL" text from in-app copy and the public legal pages:
- `mobile/app/(auth)/login.tsx` — onboarding tagline "NFL Picks & Leaderboards" → "Football Picks & Leaderboards" (2 spots), rotating rules-summary bullet "Pick the winner of every NFL game..." → "...pro football game..."
- `mobile/app/rules.tsx` — "pick the winner of each NFL game" → "each game"
- `docs/terms.html` + `docs/privacy.html` — "NFL picks and leaderboard app" → "football picks and leaderboard app", added the same non-affiliation disclaimer sentence, bumped "Last updated" to August 21, 2026
- Committed as `ed9e68c`, pushed to `main` (GitHub Pages redeploys the two docs pages automatically)
- Shipped to the app via `eas update --branch preview`, update group `ea89501b-009f-4544-ac7f-95b76b476f3a` — reaches iOS + Android on next cold start, no rebuild needed

**Deliberately NOT changed, per this session's reasoning:**
- Team names displayed in-app and real game scores — left as-is. These are core app functionality, not marketing metadata, and referencing real teams/scores to describe real games is standard, legally settled practice across the entire fantasy-sports/pick'em category (same reasoning every competitor — ESPN, Yahoo Sports, Sleeper, DraftKings — relies on). Apple's rejection language specifically said "metadata," meaning the marketing text fields, not in-app screens.
- Screenshots were left untouched after this first rejection since nothing in Apple's message pointed at them specifically — that assumption turned out to be wrong on the 2nd rejection, see the logo/screenshot entry above.

### ⚠️ BACKGROUND, NOT SEASON-BLOCKING — Android Google Sign-In broken for all closed-testing users (as of Aug 25 2026)
**Deprioritized Aug 25 2026 due to time constraints — deliberately NOT being investigated right now.** Nick's call: Android users on the closed-testing build simply cannot use Google Sign-In until this gets picked back up. **Workaround for Android users in the meantime: sign in with email/password instead** (unaffected by this bug — worth mentioning to testers who hit it). Since Play Store closed testing has no expiration (see decision above), there's no time pressure forcing this — pick the `adb logcat` investigation back up whenever there's bandwidth, no rush this season. Original investigation notes below, still accurate and still the right next step when resumed.

Nick reported two bugs Aug 20 2026: (1) forgot-password emails never arriving, (2) Google Sign-In broken on Android. Investigated both:

1. **Forgot-password emails — NOT a bug.** Tested with both an email/password account and a Google-signup account; both "failures" turned out to be the reset email landing in spam. `sendPasswordResetEmail(auth, email)` in `AuthContext.tsx` is stock Firebase, no code issue. **Possible future improvement** (not done, not requested yet): route password-reset emails through Resend (already set up + verified domain `gridironsports.net` for the weekly picks email) instead of Firebase's default sender, for better deliverability if this becomes a recurring complaint from real users post-launch.

2. **Google Sign-In on Android — two issues found, only the first is confirmed fixed:**
   - **Fixed & confirmed:** initial symptom was `DEVELOPER_ERROR` — root cause was that only ONE Android SHA-1 fingerprint was registered in Firebase (the Play Store "App Signing key" cert added Aug 18, `9F:09:3D:B1:BB:33:37:66:42:9F:C8:83:48:4D:3E:70:EB:26:49:B0`), but Nick's dad was testing a sideloaded **internal/preview APK**, signed with EAS's own preview-profile keystore — a completely different cert never registered anywhere. Got that cert's SHA-1 via `eas credentials -p android` (must be run in a real interactive terminal — `eas credentials` needs arrow-key menus and does not work through Claude Code's `!` prefix, no TTY) → **preview keystore SHA-1: `BD:E7:7B:7A:76:BA:DC:4C:F7:20:FE:7B:58:B8:E1:D1:48:FC:91:55`**. Added as a *second* fingerprint in Firebase Console → Project settings → Your apps → Android app → SHA certificate fingerprints (Nick initially replaced the Play Store one by mistake — both are now correctly present side by side; **don't let there ever be only one** — the Play Store cert is needed once Android actually ships through Play, the EAS preview cert is needed for the internal APK Nick's dad sideloads). This resolved the `DEVELOPER_ERROR`.
   - **NOT yet confirmed fixed:** after the fingerprint fix, a new symptom appeared — the Google account picker opens and shows the account, but tapping an email does nothing (no error, no navigation, no crash). Suspected cause: `AuthContext.tsx`'s `signInWithGoogle()` was calling `GoogleSignin.getTokens()` after `signIn()` to fetch a separate `accessToken`, which on this library version (`@react-native-google-signin/google-signin` 16.1.2) goes through a legacy `GoogleAuthUtil`-based Android native path that can require a secondary "recovery" intent — if that doesn't complete, the promise never resolves or rejects, so nothing visibly happens. Fixed by rewriting `signInWithGoogle()` to use the `idToken` returned directly in `signIn()`'s response instead (the officially recommended pattern for this library version — Firebase's `GoogleAuthProvider.credential()` only needs an idToken, not an accessToken). Also normalized the cancel case: this library version returns `{ type: 'cancelled' }` from `signIn()` instead of throwing, so `signInWithGoogle()` now throws a normalized `{ code: 'SIGN_IN_CANCELLED' }` error itself so `login.tsx`'s existing cancel-handling still works unchanged.
   - **Published via OTA** Aug 20 2026 (`eas update --branch preview`, update group `67e6c856-aa45-4aca-b2d1-b705466ac9b6`) — JS-only change, no rebuild needed.
   - **Nick's dad retested and reported "same thing"** (still nothing happens after tapping an email) — but this was NOT yet properly diagnosed before the session ended: didn't confirm (a) whether the phone was fully force-closed (swiped from recent apps) before retesting, since OTA updates only apply on a true cold start, not a background/foreground cycle, or (b) whether the account picker dialog actually closes when tapped, or (c) whether any spinner/loading state appears — all of which would help tell a stale-bundle problem apart from a hang that happens even earlier, inside the native account picker itself before the JS fix would ever run.
   - **Next session: start by getting those three answers from Nick's dad**, then re-diagnose from there. If the OTA genuinely was applied and it still hangs identically, the `getTokens()` theory is likely wrong and the hang is happening in native code before `signIn()` ever resolves — at that point, get `adb logcat` output from the phone (connect via USB to Nick's PC) while attempting sign-in, since there is no way to see JS-level errors on a non-dev-client sideloaded APK otherwise.
   - **Aug 24-25 2026: `DEVELOPER_ERROR` again** — not the silent-hang symptom above, the *original* error code, on a completely different distribution than before. **Correcting stale status first: Google Play identity verification DID clear at some point after Aug 20 (never logged here) — Play Console access has been open, and Nick has been running a real closed-testing track for about a week, 5/12 testers recruited.** The "blocked on identity verification" framing elsewhere in this doc (Launch Strategy, Tech Stack, Open TODOs) is now stale — Android is actively in closed testing, not blocked on Play Console access. **Confirmed with Nick: `DEVELOPER_ERROR` is happening to *every* closed-testing tester, including his dad — everyone is now on the real Play Store closed-testing install (re-signed by Google Play App Signing), not a sideloaded APK.** That's a different, harder problem than the Aug 18 fix addressed, since it means the fingerprint that matters is whatever's actually driving Play Store distribution, not the sideload keystore.
   - **Full config audit done Aug 25 2026 — every standard cause of `DEVELOPER_ERROR` checked out clean, root cause still not found:**
     - Play Console → Setup → App integrity: App signing key certificate (**"Classic key"** type — Google is NOT generating a new key, it's using whatever was originally uploaded) = `9F:09:3D:B1:BB:33:37:66:42:9F:C8:83:48:4D:3E:70:EB:26:49:B0`, Upload key certificate = `BD:E7:7B:7A:76:BA:DC:4C:F7:20:FE:7B:58:B8:E1:D1:48:FC:91:55` — **both exactly match what's already registered in Firebase.** Not a missing/wrong cert.
     - Google Cloud Console → APIs & Services → Credentials: two Android-type OAuth clients exist (created Aug 17 and Aug 20), both named "Android client for com.thelonggame.picks (auto created by Google Service)", both confirmed package name `com.thelonggame.picks`. So both SHA-1s did sync from Firebase into real OAuth clients — not a sync failure.
     - Google Cloud Console → APIs & Services → OAuth consent screen: Publishing status = **"In production"**, not "Testing" — so this isn't a restricted-test-user-allowlist problem either.
     - Web client ID: confirmed the live "Web client (Auto created by Google Service)" in Google Cloud Console is `309276847432-j5unna6kj6k780gsk6fksveoklv57673.apps.googleusercontent.com` — exactly matches `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` as hardcoded in **all three** `mobile/eas.json` build profiles (`development`/`preview`/`production`) and in `mobile/.env`. Also confirmed this app has no bundled `google-services.json` at all (uses Firebase JS SDK, not React Native Firebase), so there's no stale-bundled-config-file possibility either.
     - **Every configuration-level explanation is now exhausted.** Next step has to be `adb logcat` on a real device during a live sign-in attempt, to see Google's actual internal rejection reason instead of guessing at more config. Exact steps (Developer Options + USB debugging on the phone, installing platform-tools, `adb devices`, `adb logcat -c` then `adb logcat` filtered for `GoogleSignIn|DEVELOPER_ERROR|SignInHub|Auth|GmsClient`) are ready to go — **blocked only on physical access to a phone that can reproduce it (Nick's dad's phone), not on any further diagnosis. Do this first next session.**
   - **Side effect of this session's investigation, not directly relevant to the closed-testing bug but available if useful:** built a fresh Android `preview`-profile APK (reuses the already-registered preview keystore, so no new Firebase registration needed) — install link: `https://expo.dev/accounts/nickcorum/projects/the-long-game/builds/384f335a-84f1-4ec1-bf3d-537c028a6320`. This is a *sideloaded* distribution, separate from the Play Store closed-testing track that's actually broken — useful as a clean, known-good sideload test artifact if that ever becomes relevant again, but won't by itself fix the closed-testing issue since that's a Play Store distribution problem, not a sideload one.

### 🚀 App Store submission push (Aug 16 2026) — iOS submitted, Android in progress

**iOS: submitted for App Store review** (Aug 16 2026, evening). Build 3 (already on TestFlight, `preview` profile/channel) was reused for the production submission — no separate production build was needed since it's already store-distribution and picks up OTA updates on the same channel. Filled in: description, promotional text, keywords, copyright (`© 2026 Nicholas Corum` — locked to Nick's legal name since the Apple Developer account is Individual, not Organization), support URL (new `docs/support.html`, see below), privacy policy URL (`docs/privacy.html`), and the "does this app access third-party content" question (answered **yes** — ESPN game data/logos). Now just waiting on Apple's review (historically 1-3 days).

**Android: blocked on Google Play identity verification**, everything else prepped and ready to resume the moment it clears:
- Google Play developer account created tonight, developer name **"Gridiron Sports"** (Nick's choice — public "Offered by" name, independent of Apple's forced legal-name seller field; can be changed later without much friction, unlike Apple's).
- Account owner login: `nickcorum@gmail.com`. Public-facing contact email on the store listing: `corumnick@gmail.com` (Nick's personal choice, low-risk — not the login).
- **Device-owner verification: DONE** — Nick borrowed his dad's Android phone, added `nickcorum@gmail.com` as a second Google account on it (didn't touch his dad's existing account/data), installed the Google Play Console app, verified from there.
- **Currently waiting on Google's account-level identity verification** ($25 fee + ID check) — this is the blocker keeping Nick out of Play Console proper (can't create the app listing, can't start closed testing, until this clears). No action to take, just waiting.
- **12-tester / 14-day closed-testing requirement**: only 1 of 12 lined up so far (Nick's dad, via his own separate Google account/phone — confirmed a different account than the device-verification account counts fine). Need 11 more real people with Android phones + their own Google accounts, opted in continuously for 14 days, before Google will allow a production release. **Fallback if 12 can't be found**: direct APK sideloading (`distribution: "internal"`, what Nick's dad already uses) works indefinitely for the whole season with zero Play Store gate — OTA updates reach it identically either way. Not a hard blocker on launch, just blocks the *Play Store listing* specifically.
- **Android production AAB already built** and sitting ready: `eas build --profile production --platform android` (build succeeded Aug 16 2026). Nothing needs to be rebuilt for tonight's code changes — they reached it via the OTA channel automatically (see eas.json fix below). Just needs to be uploaded to Play Console's closed-testing track once Nick is unblocked.
- **eas.json fix (important, already shipped)**: the `production` build profile didn't declare an `updates` channel, which would have silently split future `eas update` pushes across two channels (iOS store build on `preview`, Android production build on nothing/orphaned). Fixed by adding `"channel": "preview"` to the `production` profile — now **every build (dev, preview, and production, both platforms) shares the single `preview` OTA channel**, so one `eas update --branch preview` always reaches everyone. Confirmed this pattern holds going forward — no more per-platform OTA pushes needed.

**Also shipped in this same push, all live via OTA already:**
- **In-app Rules/"How It Works" page** (`mobile/app/rules.tsx`) — cleared the App Store hard-blocker requiring the rules to be explained both in first-run onboarding and reachable afterward. Content covers: season-long win condition (most wins by season's end), lock time, default-pick behavior, weekly achievements, leaderboard. Ends with "Good luck! 🏈". Linked from the **app-wide header** (next to the feedback chat-bubble icon in `mobile/app/(tabs)/_layout.tsx`, visible on every tab) — NOT from Profile specifically (moved there after Nick found the original Profile-icon placement didn't fit visually). Onboarding (`login.tsx`) has its own condensed bullet summary of the same content, wrapped in a `ScrollView` to fit.
- **New `mobile/app/settings.tsx`** — currently holds only Delete Account (moved off the bottom of Profile per Nick's request), gated behind two sequential confirmation `Alert`s ("Delete Account?" → "Are you absolutely sure?") before it fires. Linked from a new gear-style icon in Profile's header row. This is also the natural home for the granular notification-preference toggles described in the "remaining notification overhaul" plan below, when that gets built — don't create a second settings screen, extend this one.
- **In-app account deletion** (`DELETE /api/users/me`) — cleared Apple's Guideline 5.1.1v requirement. Anonymizes the `users` row (doesn't hard-delete, since `picks`/`trophies`/`pick_audit_log` are referenced by other users' leaderboards/H2H) and deletes the Firebase Auth account + push tokens.
- **Lock time → 11:59PM PST everywhere** (see dedicated entry below).
- **New static pages for store requirements**, all under `docs/`, served live via GitHub Pages (`corumnick-oss.github.io/the-long-game/...`, enabled once this session — Settings → Pages → Deploy from branch → `main` → `/docs`):
  - `docs/privacy.html` — rewritten mid-session to drop the internal "Gridirons" feature name entirely (Nick's call — it's just an internal friend-subgroup flag, not something an outside reader or reviewer needs explained); now describes the app generically as open to anyone.
  - `docs/terms.html` — same generic-app framing, explicitly states no real-money wagering/gambling.
  - `docs/support.html` — new, satisfies Apple's required support URL field (separate from privacy policy). Points to the in-app feedback icon + email.
- **Picks tab: "week not unlocked yet" banner** — below Team Central, shown when every game in the selected week has `isPicksOpen: false` (the API's existing per-week-unlock flag, already computed server-side from the `unlocked_weeks` table). Reads "Week picks locked. They'll unlock at 6:00 AM PST on Tuesday."
- **Leaderboard W-L text sizing** — now matches the accuracy % next to it (`text-white font-bold`, was small muted gray).
- **Removed the temporary preseason H2H toggle** on public profiles (`user/[id].tsx`) — no longer needed now that regular-season data exists to compare against.
- **EWIK is sitting out the 2026 season** (Nick's call) — do not run his UID reassignment. His row stays in the Gridirons table below purely as 2025 historical record.
- 7 iOS screenshots taken by Nick (Picks, Leaderboard, Week Picks, Profile, Game Details, Game Preview, Rules) at 1170×2532 — Apple's App Store Connect required 1284×2778 for the mandatory size bucket, so all 7 were resized (`docs`-adjacent scratch step, not committed to the repo — the originals live in `C:\Dev\TheLongGame\Screenshots\iOS\`, resized copies in `...\iOS-1284x2778\`). **Gotcha hit and fixed**: first resize attempt preserved an alpha/transparency channel (`Format32bppArgb`) which Apple silently rejected on upload with no clear error — re-generated as flattened 24-bit RGB (`Format24bppRgb`) and the upload succeeded. If this comes up again for future screenshot batches, flatten transparency before upload.

### ✅ Raspberry Pi ESPN relay — PERMANENT FIX SHIPPED (Aug 15-16 2026)

The ESPN/Akamai block on Railway (full history in the "ESPN/Akamai background" section below) is now solved permanently via a Raspberry Pi running 24/7 on Nick's home network, relaying Railway's ESPN requests through a real residential IP. **PC relay stopgap is retired** — both its processes were already stopped, `C:\Dev\espn-relay` on Nick's PC is now just a historical reference (the same `relay.js` was copied to the Pi as-is).

**Confirmed end-to-end (Aug 15-16 2026):** watched Railway's 30-second cron hit the Pi's relay log live, watched two real in-progress preseason games (Eagles@Ravens, Cowboys@Seahawks) have their clock/score update in the production DB in step with ESPN's actual live feed. No manual sync needed — fully automatic.

**Setup:**
- Hardware: Raspberry Pi 4, hostname `espn-relay` (reachable at `espn-relay.local` on the home LAN), OS: Raspberry Pi OS Lite (64-bit), SSH user `nickcorum`
- SSH: key-based auth (Nick's PC has the private key at `~/.ssh/id_ed25519`; the Pi has the matching public key in `~/.ssh/authorized_keys`) — no password needed from Nick's PC. Password auth still works too (same password set in Raspberry Pi Imager) but isn't needed day-to-day.
- Relay: `~/relay.js` on the Pi (identical to `C:\Dev\espn-relay\relay.js` — uses `fetch()`, never the raw `https` module, see Akamai background below for why that matters), run as systemd service `espn-relay` (`ExecStart=/usr/bin/node /home/nickcorum/relay.js 8787`, `Restart=always`, enabled on boot). Service file: `/etc/systemd/system/espn-relay.service`.
- Tunnel: named/persistent Cloudflare Tunnel (not a quick tunnel — URL never changes), name `espn-relay`, tunnel ID `45f920c4-e52d-49af-8639-f10489b014d6`, routed to **`https://espn-relay.gridironsports.net`** (same Cloudflare account/zone as the main domain). Config at `/etc/cloudflared/config.yml`, credentials at `~/.cloudflared/45f920c4-e52d-49af-8639-f10489b014d6.json` and `~/.cloudflared/cert.pem`. Runs as systemd service `cloudflared`, enabled on boot.
- Railway: `ESPN_API_BASE_URL` = `https://espn-relay.gridironsports.net/apis/site/v2/sports/football/nfl`. `DISABLE_LIVE_SCORE_SYNC` unset.

**Routine health check / troubleshooting** (from Nick's PC, passwordless):
```
ssh nickcorum@espn-relay.local "sudo systemctl status espn-relay cloudflared --no-pager"
```
Both should show `active (running)`. To restart either: `ssh nickcorum@espn-relay.local "sudo systemctl restart espn-relay"` (or `cloudflared`). To tail live relay traffic: `ssh nickcorum@espn-relay.local "journalctl -u espn-relay -f"`. If the Pi loses power/reboots, both services auto-start — nothing manual needed. If `espn-relay.local` won't resolve, check the Pi's actual IP via your router and SSH to that instead (mDNS occasionally flakes on some networks).

**If ESPN blocks the Pi's residential IP too, someday:** re-read the "ESPN/Akamai background" section below — the fix would need a *different* residential/non-cloud network, not a code change, since `fetch()` + non-cloud origin is already confirmed as the working combination.

**Hardware note for any future SD card work:** the first microSD card (Onn/Walmart store brand) got bricked by an interrupted Raspberry Pi Imager write — went from working to completely unreadable (0 bytes/"No Media" in Windows, undetected on 2 PCs, hung SD Card Formatter, invisible to `diskpart`) after the write was interrupted. Replacement was a name-brand card and worked fine. **Never unplug/interrupt Raspberry Pi Imager mid-write**, and prefer SanDisk/Samsung/Kingston over store-brand cards for anything Pi-related.

### ✅ Lock time changed to 11:59PM PST — DONE (Aug 16 2026)
Wednesday lock moved from 9PM to **11:59PM PST**, pulled forward out of the deferred notification-overhaul plan because the new in-app Rules page (see below) needed to state the real lock time. The 8PM "1 hour left" reminder push **stays at 8PM** but its copy no longer claims "1 hour left" (no longer accurate at ~4 hours out) — now reads "[Week] picks lock tonight at 11:59 PM!". Updated: `server/src/utils/lockTime.ts` (`pacificWallTimeToUtc(..., 23, 59)`), `server/src/services/scheduler.ts` (lock cron `'59 23 * * 3'`), `server/src/services/notificationService.ts`, `server/src/services/emailService.ts`, `server/src/routes/admin.ts` (comment), `server/src/utils/season.ts` (comments), `mobile/app/(tabs)/week-picks.tsx`, `mobile/app/game/[id].tsx`, `mobile/app/user/[id].tsx`, `mobile/app/rules.tsx`, `mobile/app/(auth)/login.tsx` (onboarding rules summary). `server/src/scripts/backfill-week-lock.ts`'s comment was deliberately left as-is — it describes a specific historical bug that really did fire at 9PM at the time, changing it would misrepresent history. No DB migration involved — pure code/copy change, safe to deploy same as any other backend push.

### ✅ Editable team name in Settings + admin pick-audit-log hidden pre-lock — DONE (Aug 19 2026)
Two fixes, both shipped (backend push + OTA), no native changes:
1. **Apple Sign-In "Hide My Email" could leave a user stuck with a random team name.** `AuthContext.tsx`'s `signInWithApple` only gets the real name from Apple on the very first login (and only if shared); after that, `syncUserToBackend` falls back to `user.displayName ?? email.split('@')[0]`. With Hide My Email, the email is a random relay string (e.g. `abc123xyz@privaterelay.appleid.com`), so that string silently became the team name with no way to fix it — `PATCH /api/users/me` already supported editing `teamName`, but nothing in the app called it. Fixed by adding an editable Team Name field to `mobile/app/settings.tsx` (new `useUpdateTeamName()` hook in `mobile/src/hooks/useProfile.ts`). Deeper fix (force a name-confirmation step during onboarding for new OAuth users) deferred to the planned onboarding redesign — this unblocks the affected user immediately without a bigger flow change this close to launch.
2. **Admin could see everyone's current-week picks before lock, via the Activity tab.** `GET /api/admin/pick-audit-log` (used by `mobile/app/admin.tsx`'s Activity tab) had no lock-time gating — it returned exact picked teams the instant anyone picked, for any week including the current unlocked one. Since Nick is both admin and a player, this was an unfair real-time advantage, on top of violating Rule 4's spirit. Fixed in `server/src/routes/admin.ts`: rows for any not-yet-locked week (checked via the existing `isWeekLocked()` from `lockTime.ts`, per that row's own `week`+`season_type`) are filtered out entirely before the response is sent. Past/already-locked weeks are returned in full, unchanged — still fully usable for "I never picked that" dispute resolution. `GET /api/admin/picks` (the raw admin picks list, used for admin pick-editing) was deliberately left ungated — out of scope, not what was reported, and may have a legitimate need to show pre-lock picks for admin corrections; revisit if Nick flags that one too.

### ✅ Per-game push notifications replaced with a weekly summary — DONE (Aug 20 2026)
Nick found the per-game "Final: {away} X, {home} Y / Your pick was correct/wrong" push (`notifyGameFinal`, fired once per pick from `espnService.ts`'s `justFinished` loop) too spammy on a full game day — up to ~16 pushes per person per week. Rather than build the previously-planned "item 2" personalization (see git history for the old plan text — now moot), removed per-game pushes entirely and built the previously-planned "item 4" week-summary notification to replace them:
- `server/src/services/espnService.ts` — removed the per-pick `notifyGameFinal(...)` loop (grading via `gradeGamePicks` and win-probability writing, both separate code paths, are untouched)
- `server/src/services/notificationService.ts` — deleted `notifyGameFinal`; added `notifyWeekSummary(userId, week, seasonType, wins, losses)` — "Week X wrap-up" / "You went W-L this week! 🏈"
- `server/src/services/trophyService.ts` — new `getWeeklyRecords(week, season, seasonType)` returns each participant's W-L for a week (only users with ≥1 pick that week; ties/ungraded picks excluded from both counts)
- `server/src/services/scheduler.ts` — in the Tuesday 6AM weekly-transition cron, right after the existing achievement-award step, calls `getWeeklyRecords(week - 1, ...)` and sends `notifyWeekSummary` to each participant. Runs for **both** preseason and regular season (unlike Achievements, which stay regular-season-only).

No DB change, no mobile change (no notification-tap handling existed for the old `game_final` type). Deployed via the normal backend push (build + commit `dist` + push to `main` → Railway auto-deploy).

### ✅ Granular notification settings — DONE (Aug 20 2026)
Nick asked for per-category notification toggles in Settings, with one hard requirement: admin broadcasts/test sends must always reach everyone regardless of a user's toggle choices. Built:
- `server/src/db/schema.ts` — 3 boolean columns on `users`: `notifyWeekUnlocked`, `notifyWeekLocked`, `notifyWeekSummary` (all `default(true)`)
- `server/src/scripts/migrate-notification-prefs.ts` — one-off `ADD COLUMN IF NOT EXISTS` migration — **already run against prod** (Nick ran it manually — the sandbox's auto-mode classifier blocks direct prod-DB writes from Claude Code, so this one always needs Nick to run it himself, same command each time schema changes: `npm run migrate:notification-prefs` from `server/`)
- `server/src/routes/users.ts` — `PATCH /api/users/me` accepts the 3 new fields (GET already spread the full user row, no change needed there)
- `server/src/services/notificationService.ts` — `notifyWeekUnlocked`, `notifyDeadlineApproaching`, `notifyPicksLocked`, `notifyWeekSummary` each filter recipients by the matching preference column via a new `sendPushToOptedInUsers()` helper (deadline reminder + picks-locked both key off the single `notifyWeekLocked` column, since both are lock-related — Nick's Aug 15 2026 call). **Admin broadcast (`POST /api/admin/notifications/broadcast`) and test-send routes were deliberately left untouched** — they call `sendPushToUsers`/`sendPushToAllUsers` directly, never the opted-in helper, so they always reach everyone by construction, satisfying Nick's "admin messages go through regardless" requirement with no special-case code.
- `mobile/src/hooks/useProfile.ts` — `useUpdateNotificationPrefs()` hook, `notifyWeekUnlocked`/`notifyWeekLocked`/`notifyWeekSummary` added to `MyProfile`
- `mobile/app/settings.tsx` — new "Notifications" section, 3 toggle rows, above Danger Zone

Achievement-earned pushes stay always-on/not toggleable (unchanged, Nick's Aug 15 2026 call). **Not built:** a master push-notifications on/off switch that re-triggers the OS permission prompt — wasn't part of what Nick asked for this round; the 3 category toggles only affect delivery for users who already have push enabled at the OS level. Revisit if Nick wants that closing-the-loop UX later.

Deployed Aug 20 2026: backend via normal build + commit `dist` + push to `main` (Railway auto-deploy); mobile via `eas update --branch preview` (update group `8bae4d71-e253-4fb8-9666-0d1848d7789e`).

<details>
<summary>ESPN/Akamai background — why this was needed (click to expand historical debugging)</summary>

**Symptom:** ESPN's edge (Akamai) 400/403s every request that originates from a cloud/serverless host — confirmed against Railway (both its default region and us-east) and a Cloudflare Worker. Only non-cloud/residential networks succeed.

**Tried and ruled out, in order:**
1. Removing the spoofed Chrome User-Agent (Aug 10 2026 fix) — necessary but NOT sufficient; this was a recurrence, not something that fix actually finished solving.
2. Manual Railway redeploy hoping for a fresh egress IP — no change (Railway confirms redeploys in the same region don't rotate the outbound IP; their paid "Static Outbound IP" add-on isn't guaranteed dedicated either).
3. Cloudflare Worker relay (`espn-relay.corumnick.workers.dev` — inactive, safe to delete) — ALSO blocked by Akamai. Ruled out "just Railway."
4. Swapped `axios` → native `fetch()` for every ESPN call in `espnService.ts` — still blocked from Railway. Ruled out axios's default `User-Agent` as the sole cause.
5. Switched Railway's deployment region to us-east (Aug 13 2026) — no change. Ruled out "just the default Railway region/IP range."

**Conclusion:** Akamai blocks cloud/serverless-origin traffic broadly, regardless of specific IP/region/provider. Only real residential/dev-machine networks get through — hence running a relay on Pi hardware on Nick's home network.

**Client-level finding (Aug 13 2026):** it's not just *where* the request comes from — *which HTTP client* matters too. Node's raw `https` module (`https.request`) gets fingerprinted and blocked by Akamai even from a normal residential network. Node's native `fetch()` (undici) succeeds from the exact same machine/network. `espnService.ts` and `relay.js` both use `fetch()` exclusively — **any new relay/proxy code for this must use `fetch()`, never the raw `https`/`http` module**, or it'll silently reproduce this block.

**Shipped mitigations, still live in production:**
- `d2b1b99` — exponential backoff in `espnFetch()`/`updateLiveScores()` (up to 20 min between automatic attempts after repeated failures; manual admin sync always attempts fresh).
- `4e88e77` — `DISABLE_LIVE_SCORE_SYNC=true` Railway env var kill switch, available if the Pi relay ever needs to be taken offline for maintenance.

**Timeline:** PC-based relay stopgap (Aug 13-14 2026, same `relay.js` running on Nick's desktop through a Cloudflare quick tunnel) proved the approach worked before the Pi hardware was ready, then was fully retired once the Pi took over (Aug 15-16 2026).
</details>

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
Sends every user their own locked-in picks for the week as a private, individual email (dark-themed HTML matching app style) right after Wednesday 11:59PM lock, once default picks are applied so it reflects each user's final state. **One separate email per user, containing only that user's own picks — never anyone else's.**
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

### ✅ Temporary preseason toggle on public profile pick comparisons — REMOVED (Aug 16 2026)
Added Aug 12 2026 so Nick could test H2H pick comparisons on `user/[id].tsx` before the 2026 regular season had any games to compare. Removed outright now that it's no longer needed — `PickComparison` in `mobile/app/user/[id].tsx` always compares `seasonType: 'regular'` again, the `useCurrentWeek` import and preseason-toggle pill are gone. Season record/week-history/insights on profiles remain regular-season-only (unchanged, see "Profile stats regular-season-only" above).

### ✅ Rules page — HARD BLOCKER cleared (Aug 16 2026)
New `mobile/app/rules.tsx` — a standalone "How It Works" screen (matches the app's existing stack-screen header pattern, back button + title) covering: picks lock Wednesday 11:59PM PST, missing picks default to Raiders (if playing) or away team after your first active week, achievements awarded Tuesday, leaderboard global vs. friend-group view. Reachable two ways per the hard-blocker requirement: (a) inline in onboarding — `login.tsx`'s first-run screen now has a "How It Works" bullet summary between the features list and the Get Started button (wrapped the onboarding content in a `ScrollView` to fit it; full rules text lives only in `rules.tsx` to avoid duplicating copy that could drift), and (b) a permanent book-icon link in Profile's header row (`profile.tsx`), next to the admin gear/sign out icons, for existing users. Since the app went from "Gridirons-only" framing to "open to anyone" (see privacy policy discussion), the copy is written generically — Gridirons mentioned only as an optional private friend-group feature, not the premise of the app.

### ✅ In-app account deletion — Apple 5.1.1v requirement cleared (Aug 16 2026)
Apple requires any app with account creation to also offer in-app self-service deletion. New `DELETE /api/users/me` (`server/src/routes/users.ts`) — deletes the Firebase Auth account and the user's push tokens, but **anonymizes rather than hard-deletes** the `users` row (email → `deleted-<uid>@deleted.local`, teamName → "Deleted User", flags cleared) since `picks`/`trophies`/`pick_audit_log` reference `userId` and other users' leaderboards/H2H history depend on those rows staying intact — matches what `docs/privacy.html` already promises. Mobile: `useDeleteAccount()` hook (`mobile/src/hooks/useProfile.ts`) + a "Delete Account" button at the bottom of Profile (`profile.tsx`) behind a destructive confirmation `Alert`, signs the user out locally on success.

### Next priority items:
1. **UI polish pass** — Go screen by screen: Login/Onboarding → Picks tab → Game Detail → Leaderboard → Week Picks → Profile. **This is the final gate before App Store + Google Play submission.** (Activity panel was removed — replaced by feedback modal.)
2. **Past seasons row on Profile** — W-L per season for historical context
3. **Onboarding polish** — Nick wants a fuller visual redesign before launch (the Aug 16 2026 rules addition covers the *content* requirement only, not a redesign)
4. **TestFlight for remaining Gridirons** — after UID reassignments are done, invite via App Store Connect → TestFlight → External Testing → add by email.
5. **ascAppId for non-interactive TestFlight submits** — add to `eas.json` submit.preview profile so `eas submit --non-interactive` works without Nick's Apple ID/2FA each time. Find in App Store Connect → My Apps → The Long Game → General → App Information → Apple ID (10-digit number).
6. ~~Weekly bonus pool opt-in marker~~ — **DONE Aug 25 2026**, see the dated entry near the top of this doc. Ended up on the Leaderboard's weekly Gridirons view (not Week Picks/NFL Tools as originally drafted), badge text is plain "Bonus" (not "$5").

### Win Probability — weekly workflow
✅ **Automatic from Railway again** (Aug 30 2026) — the "broken from Railway" era ended when the Pi relay went permanent (Aug 15-16 2026); `syncWinProbabilities()` calls `${ESPN_API_BASE_URL}/summary?event=…`, which is the relay, so it works from Railway with no local script needed. Verified the relay returns the `predictor` field for `/summary` (Aug 30 2026). Now runs on two crons: **Tuesday 6AM PT** (folded into the weekly-transition job, right after the new week opens) and **Wednesday 5PM PT** (`scheduler.ts`). Admins can also trigger a sync any time via **Admin → NFL Tools → "Sync Win Probabilities"** (button already existed; `POST /api/admin/games/sync-probs`). The old `npm run sync:winprobs <week> 2026` local script still exists as a manual fallback if the relay ever goes down, but shouldn't be needed.

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
**Status:** iOS submitted for App Store review (Aug 16 2026, using existing preview/TestFlight build 3 — no separate production build needed). Android: Play Console identity verification cleared, closed testing is live (5/12 testers, ~1 week in as of Aug 25 2026) — but **Google Sign-In is broken with `DEVELOPER_ERROR` for every closed-testing tester right now, top priority to fix next session** (see "UNRESOLVED, TOP PRIORITY" entry above). Every build profile (dev/preview/production, both platforms) now shares one OTA channel (`preview`) — a single `eas update --branch preview` reaches everyone regardless of store status.  
**Railway URL:** https://thelonggame-production.up.railway.app  
**Target Launch:** iOS submitted Aug 16 2026 (Apple review typically 1-3 days). Android: closed testing live, 5/12 testers toward the 14-day requirement, blocked on the Google Sign-In bug above — OR ship via direct APK sideload indefinitely as a fallback if needed. Regular season starts September 4, 2026.  
**Owner:** Nick (Corums) — GitHub: corumnick-oss — Windows 11 — iPhone — Admin team name: Nicholas  
**Local Code Path:** C:\Dev\TheLongGame

---

## Launch Strategy

- Original plan was submission in late July before preseason (Aug 7) started; actual iOS submission happened Aug 16 2026 instead (see "DO THIS FIRST NEXT SESSION" at the top) — preseason has been serving as live testing via OTA in the meantime regardless of the delay.
- **Hard deadline:** Regular season September 4, 2026

### 3 Ways to Push Updates
1. **OTA Updates** — INSTANT, no review. `eas update --branch preview` for preview build, `--branch development` for dev build. As of Aug 16 2026, the `production` build profile is also bound to the `preview` channel (see eas.json fix above) — so `--branch preview` now reaches dev, preview, AND production builds on both platforms. Only `--branch development` is still separate.
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

All core infrastructure, screens, stats, and push notifications are complete. iOS submitted for App Store review (Aug 16 2026); Android is in closed testing (5/12 testers) but Google Sign-In is currently broken there — see "UNRESOLVED, TOP PRIORITY NEXT SESSION" near the top of this doc. See "DO THIS FIRST NEXT SESSION" at the top of this doc for the current submission status and "Next priority items" below for what's left post-launch.

### Open TODOs — Priority Order
This list has mostly been superseded by "Next priority items" above (achievement images/display/redesign, all 3 Gridiron UID reassignments, and in-app feedback are all done — see their own dated ✅ entries elsewhere in this doc). Remaining genuinely open items not tracked elsewhere:
1. **Week 18 2025 tiebreaker** — check `tiebreaker_games` and `tiebreaker_picks` tables for week 18 season 2025
2. **Admin email editing** — deferred. Workaround: new account + UID reassignment.
3. **Leaderboard Season Selector for all users** — same +/− control the admin already has; currently admin-only (see "TO BUILD" note further down)
4. ⚠️ **Android Google Sign-In SHA-1 fingerprint** — this fixed a real `DEVELOPER_ERROR` on Aug 18 2026 for sideloaded APKs, but a *different* `DEVELOPER_ERROR` reappeared Aug 24-25 2026 for real Play Store closed-testing installs, and a full config audit (SHA-1s, OAuth clients, consent screen, webClientId) found nothing wrong — see "UNRESOLVED, TOP PRIORITY NEXT SESSION" near the top of this doc. Not actually done.

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
| Gmac | garciagarrett24@gmail.com | no | Gmac | ✅ done (reassign:user, Aug 18 2026) |
| leocorum (Leo/dad) | leocorum@gmail.com | no | Leo | ✅ done (reassign:user) |
| EWIK | erikhernandez531@yahoo.com | no | EWIK | 🚫 sitting out 2026 (Nick's call, Aug 16 2026) — do not migrate |

DO NOT migrate: CBB Test (nicholas.corum@sce.com) or blank team name (nickcorum@gmail.com).

**2025 Final Leaderboard** (verify migration against this):
1. Kevin Akers 181-91 (66.5%) | 2. Nicholas 179-93 (65.8%) | 3. TheRidl3r (was Squid) 177-95 (65.1%)
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
- Google Play: developer account created (Aug 16 2026), developer name "Gridiron Sports". Identity verification cleared (exact date not logged); closed testing live since ~Aug 18 2026, 5/12 testers as of Aug 25 2026. Google Sign-In currently broken for closed-testing installs — see "UNRESOLVED, TOP PRIORITY NEXT SESSION" above.
- Bundle ID: com.thelonggame.picks (both platforms)

---

## File Structure

```
TheLongGame/
├── CLAUDE.md
├── FUTURE.md                        ← post-launch features (read when planning future work)
├── data/                            ← 2025 CSV files for migration
├── docs/                            ← static pages served via GitHub Pages (corumnick-oss.github.io/the-long-game/...)
│   ├── privacy.html                 ← privacy policy (app store required)
│   ├── terms.html                   ← terms of service
│   └── support.html                 ← support page (App Store Connect required support URL)
├── mobile/
│   ├── app/
│   │   ├── _layout.tsx              ← root layout (QueryClientProvider + AuthProvider + AuthGate + OTA check)
│   │   ├── +not-found.tsx           ← blank dark screen (prevents not-found flash on cold launch)
│   │   ├── admin.tsx                ← Admin Dashboard (3 tabs: Users, NFL Tools, Data)
│   │   ├── picks-by-team.tsx        ← Picks by Team (from Profile → Insights)
│   │   ├── team-central.tsx         ← Team Central list (from Picks tab)
│   │   ├── rules.tsx                ← How It Works / Rules (linked from the app-wide tabs header, next to feedback icon)
│   │   ├── settings.tsx             ← Team Name (editable) + Notifications (3 toggles) + Delete Account (double-confirm)
│   │   ├── team/[name].tsx          ← Team Detail
│   │   ├── game/[id].tsx            ← Game Detail
│   │   ├── user/[id].tsx            ← Public profile
│   │   ├── (auth)/
│   │   │   ├── login.tsx            ← login + onboarding/splash (shown once via AsyncStorage)
│   │   │   ├── signup.tsx
│   │   │   └── forgot-password.tsx
│   │   └── (tabs)/
│   │       ├── _layout.tsx          ← 4 bottom tabs + header (Rules book icon + feedback chat icon)
│   │       ├── picks.tsx
│   │       ├── leaderboard.tsx
│   │       ├── week-picks.tsx
│   │       └── profile.tsx
│   ├── src/
│   │   ├── components/
│   │   │   ├── GameCard.tsx
│   │   │   ├── WeekSelector.tsx
│   │   │   ├── TiebreakerCard.tsx
│   │   │   ├── NotificationPrompt.tsx
│   │   │   └── TeamNamePrompt.tsx   ← required team-name modal after a new Google/Apple sign-up with no usable name
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
    │   │   └── exports.ts           ← token-authenticated CSV export (not under admin.ts's Bearer-auth middleware — a browser tab can't send one)
    │   ├── services/
    │   │   ├── espnService.ts       ← ALL ESPN logic isolated here
    │   │   ├── notificationService.ts ← all 5 push triggers
    │   │   ├── scheduler.ts         ← cron jobs
    │   │   ├── trophyService.ts
    │   │   └── exportTokens.ts      ← short-lived single-use tokens backing exports.ts
    │   ├── utils/season.ts          ← getCurrentNFLSeason()
    │   ├── middleware/auth.ts
    │   └── scripts/
│       │   ├── migrate-2025.ts      ← initial 2025 data import
│       │   ├── reassign-user.ts     ← migrate picks/trophies from old UID to new Firebase UID
│       │   └── migrate-weekly-bonus-optins.ts ← creates weekly_bonus_optins table
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

Additional tables beyond the main ones: `tiebreaker_games`, `tiebreaker_picks`, `week_settings`, `app_settings`, `pick_audit_log`, `unlocked_weeks`, `push_tokens`, `activity_log`, `team_game_stats`, `player_stats`, `weekly_bonus_optins` (userId, week, season, seasonType, sport — simple opt-in marker for Nick's optional $5/week side pool, shown as a "Bonus" badge on the Leaderboard's weekly Gridirons view, no winner computation).

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
| Tuesday 6AM PST | Weekly transition (trophies, unlock, stats sync, + win probability refresh for the newly-opened week) |
| Wednesday 5PM PST | Win probability refresh |
| Every 5 min | Dynamic lock check: fires "[Week] picks lock tonight!" ~4h before that week's real lock time, and picks-locked push + default picks + proof-of-picks email exactly at it |

Push functions wired: `notifyWeekUnlocked` + `notifyDeadlineApproaching` + `notifyPicksLocked` + `notifyWeekSummary` in `scheduler.ts`; `notifyAchievementEarned` in `trophyService.ts`. (Per-game `notifyGameFinal` was removed Aug 20 2026 in favor of `notifyWeekSummary` — see "remaining notification overhaul" section above.)

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
- Default: 11:59PM PST the calendar day before that week's earliest game (usually Wednesday, since games usually start Thursday — but a week whose earliest game is itself a Wednesday locks Tuesday, and a Saturday-only week locks Friday). See "Lock time now formula-driven, not always Wednesday" below.
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

> NO ONE's picks visible ANYWHERE until that week's lock time passes (11:59PM PST the day before the week's earliest game — see "Lock time now formula-driven, not always Wednesday").

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
| Deadline | "[Week] picks lock tonight at 11:59 PM!" | Wed 8PM | wired |
| Locked | "Picks locked. Good luck! 🏈" | Wed 11:59PM | wired |
| Achievement | "🏆 You earned [Achievement] for Week X!" | Tue after scoring | wired |
| Week summary | "[Week] wrap-up — You went W-L this week! 🏈" | Tue 6AM (both preseason + regular) | wired |

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
4. Never show anyone's picks before that week's lock time (11:59PM PST the day before the week's earliest game — not always Wednesday).
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

---

## About Nick

- GitHub: corumnick-oss | Admin team name: Nicholas
- Windows 11, iPhone, no prior mobile dev experience
- Always ask before making product/design decisions
- Use Claude.ai chat for planning and strategy; Claude Code for building
- Original Replit web app — do not reference that code
