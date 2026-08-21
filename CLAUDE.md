# The Long Game — Complete Project Briefing for Claude Code

## IMPORTANT: Read This First
This document contains everything you need to know about this project. Read it completely before writing any code or making any suggestions. Every decision in here has been carefully discussed and agreed upon with Nick (the owner). Do not deviate from these decisions without explicitly asking first. When in doubt, ask Nick.

**ALWAYS confirm your implementation plan with Nick BEFORE writing any code.** List the files you intend to change and what you'll do to each. Wait for Nick to say "go ahead" or "yes" before making edits. This prevents wasted work if Nick's priorities have changed.

When starting a session say: "I've read CLAUDE.md and I'm ready to continue."

---

## ⚠️ DO THIS FIRST NEXT SESSION

### ⚠️ UNRESOLVED — Android Google Sign-In still not confirmed working (as of Aug 20 2026)
Nick reported two bugs Aug 20 2026: (1) forgot-password emails never arriving, (2) Google Sign-In broken on Android. Investigated both:

1. **Forgot-password emails — NOT a bug.** Tested with both an email/password account and a Google-signup account; both "failures" turned out to be the reset email landing in spam. `sendPasswordResetEmail(auth, email)` in `AuthContext.tsx` is stock Firebase, no code issue. **Possible future improvement** (not done, not requested yet): route password-reset emails through Resend (already set up + verified domain `gridironsports.net` for the weekly picks email) instead of Firebase's default sender, for better deliverability if this becomes a recurring complaint from real users post-launch.

2. **Google Sign-In on Android — two issues found, only the first is confirmed fixed:**
   - **Fixed & confirmed:** initial symptom was `DEVELOPER_ERROR` — root cause was that only ONE Android SHA-1 fingerprint was registered in Firebase (the Play Store "App Signing key" cert added Aug 18, `9F:09:3D:B1:BB:33:37:66:42:9F:C8:83:48:4D:3E:70:EB:26:49:B0`), but Nick's dad was testing a sideloaded **internal/preview APK**, signed with EAS's own preview-profile keystore — a completely different cert never registered anywhere. Got that cert's SHA-1 via `eas credentials -p android` (must be run in a real interactive terminal — `eas credentials` needs arrow-key menus and does not work through Claude Code's `!` prefix, no TTY) → **preview keystore SHA-1: `BD:E7:7B:7A:76:BA:DC:4C:F7:20:FE:7B:58:B8:E1:D1:48:FC:91:55`**. Added as a *second* fingerprint in Firebase Console → Project settings → Your apps → Android app → SHA certificate fingerprints (Nick initially replaced the Play Store one by mistake — both are now correctly present side by side; **don't let there ever be only one** — the Play Store cert is needed once Android actually ships through Play, the EAS preview cert is needed for the internal APK Nick's dad sideloads). This resolved the `DEVELOPER_ERROR`.
   - **NOT yet confirmed fixed:** after the fingerprint fix, a new symptom appeared — the Google account picker opens and shows the account, but tapping an email does nothing (no error, no navigation, no crash). Suspected cause: `AuthContext.tsx`'s `signInWithGoogle()` was calling `GoogleSignin.getTokens()` after `signIn()` to fetch a separate `accessToken`, which on this library version (`@react-native-google-signin/google-signin` 16.1.2) goes through a legacy `GoogleAuthUtil`-based Android native path that can require a secondary "recovery" intent — if that doesn't complete, the promise never resolves or rejects, so nothing visibly happens. Fixed by rewriting `signInWithGoogle()` to use the `idToken` returned directly in `signIn()`'s response instead (the officially recommended pattern for this library version — Firebase's `GoogleAuthProvider.credential()` only needs an idToken, not an accessToken). Also normalized the cancel case: this library version returns `{ type: 'cancelled' }` from `signIn()` instead of throwing, so `signInWithGoogle()` now throws a normalized `{ code: 'SIGN_IN_CANCELLED' }` error itself so `login.tsx`'s existing cancel-handling still works unchanged.
   - **Published via OTA** Aug 20 2026 (`eas update --branch preview`, update group `67e6c856-aa45-4aca-b2d1-b705466ac9b6`) — JS-only change, no rebuild needed.
   - **Nick's dad retested and reported "same thing"** (still nothing happens after tapping an email) — but this was NOT yet properly diagnosed before the session ended: didn't confirm (a) whether the phone was fully force-closed (swiped from recent apps) before retesting, since OTA updates only apply on a true cold start, not a background/foreground cycle, or (b) whether the account picker dialog actually closes when tapped, or (c) whether any spinner/loading state appears — all of which would help tell a stale-bundle problem apart from a hang that happens even earlier, inside the native account picker itself before the JS fix would ever run.
   - **Next session: start by getting those three answers from Nick's dad**, then re-diagnose from there. If the OTA genuinely was applied and it still hangs identically, the `getTokens()` theory is likely wrong and the hang is happening in native code before `signIn()` ever resolves — at that point, get `adb logcat` output from the phone (connect via USB to Nick's PC) while attempting sign-in, since there is no way to see JS-level errors on a non-dev-client sideloaded APK otherwise.

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

### Win Probability — weekly workflow
⚠️ **Currently broken from Railway** — see "UNRESOLVED, IN PROGRESS — ESPN live score sync blocked from Railway" at the top of this doc. The Aug 10 2026 UA fix below did NOT durably resolve it; ESPN/Akamai is blocking all Railway (and Cloudflare Worker) traffic again as of Aug 12-13 2026. Until the Raspberry Pi relay is live, run locally instead: `npm run sync:winprobs <week> 2026` from `server/`, e.g. `npm run sync:winprobs 1 2026`, ideally Wednesday afternoon before the 11:59PM lock.

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
**Status:** iOS submitted for App Store review (Aug 16 2026, using existing preview/TestFlight build 3 — no separate production build needed). Android production AAB built and ready, blocked only on Google Play's account identity verification clearing (in progress) before Play Console access opens up. Every build profile (dev/preview/production, both platforms) now shares one OTA channel (`preview`) — a single `eas update --branch preview` reaches everyone regardless of store status.  
**Railway URL:** https://thelonggame-production.up.railway.app  
**Target Launch:** iOS submitted Aug 16 2026 (Apple review typically 1-3 days). Android: Play Store listing pending Google identity verification + 12-tester/14-day closed test, OR ship via direct APK sideload indefinitely if 12 testers can't be found — either way not blocking the season. Regular season starts September 4, 2026.  
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

All core infrastructure, screens, stats, and push notifications are complete. iOS submitted for App Store review (Aug 16 2026); Android pending Google Play identity verification. See "DO THIS FIRST NEXT SESSION" at the top of this doc for the current submission status and "Next priority items" below for what's left post-launch.

### Open TODOs — Priority Order
This list has mostly been superseded by "Next priority items" above (achievement images/display/redesign, all 3 Gridiron UID reassignments, and in-app feedback are all done — see their own dated ✅ entries elsewhere in this doc). Remaining genuinely open items not tracked elsewhere:
1. **Week 18 2025 tiebreaker** — check `tiebreaker_games` and `tiebreaker_picks` tables for week 18 season 2025
2. **Admin email editing** — deferred. Workaround: new account + UID reassignment.
3. **Leaderboard Season Selector for all users** — same +/− control the admin already has; currently admin-only (see "TO BUILD" note further down)
4. ✅ **Android Google Sign-In SHA-1 fingerprint** — DONE (Aug 18 2026). Found via Play Console → Setup → App integrity → "Protect with Play" redirect → App signing page → App signing key certificate. SHA-1 `9F:09:3D:B1:BB:33:37:66:42:9F:C8:83:48:4D:3E:70:EB:26:49:B0` added to Firebase Console → the-long-game-prod → Project settings → Your apps → Android app (com.thelonggame.picks) → SHA certificate fingerprints. No rebuild needed, takes effect server-side within minutes.

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
- Google Play: developer account created (Aug 16 2026), developer name "Gridiron Sports", awaiting Google's identity verification before Play Console access opens (see "DO THIS FIRST NEXT SESSION" above)
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
| Wednesday 8PM PST | Push: "[Week] picks lock tonight at 11:59 PM!" |
| Wednesday 11:59PM PST | Picks lock + push notification |

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
- Default: Wednesday 11:59PM PST
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

> NO ONE's picks visible ANYWHERE until Wednesday 11:59PM PST lock passes.

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
4. Never show anyone's picks before Wednesday 11:59PM PST lock.
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
