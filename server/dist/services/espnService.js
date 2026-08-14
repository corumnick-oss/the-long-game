"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncGamesByEventIds = syncGamesByEventIds;
exports.syncWeekGames = syncWeekGames;
exports.updateLiveScores = updateLiveScores;
exports.syncWinProbabilities = syncWinProbabilities;
exports.syncBoxScoreStats = syncBoxScoreStats;
exports.backfillTeamStats = backfillTeamStats;
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const notificationService_1 = require("./notificationService");
const BASE = process.env['ESPN_API_BASE_URL'] ?? 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const CORE_BASE = 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl';
// ESPN's /teams list endpoint returns 400 from Railway (server-side blocked).
// Hard-code the 32 stable ESPN NFL team IDs so we can skip that call.
const NFL_TEAM_IDS = [
    '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
    '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
    '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
    '33', '34', // Ravens (33), Texans (34) — IDs 31/32 unused
];
// axios sends its own default `User-Agent: axios/x.x.x` header on every request unless
// explicitly stripped — a well-known scraping-library signature that Akamai's bot manager
// blocks outright, regardless of anything else we do with headers on top of it (confirmed:
// requests kept getting 400/403'd from Railway even after removing a spoofed browser UA,
// because axios's own default UA was still there underneath). The original Replit
// implementation never had this problem because it used the runtime's native fetch(), which
// doesn't inject a library-identifying header. Use fetch() here too — no custom headers at all.
//
// Backoff: if ESPN starts rejecting us, the 30-second live-score cron must not just keep
// hammering it at full volume forever — a single failed /scoreboard call cascades into up to
// 32 more requests via the team-schedule fallback, every 30 seconds, indefinitely. If ESPN's
// block is a rate-based temporary one, that nonstop retry traffic can keep re-triggering/
// extending it and it never gets a chance to expire. Track failures here; updateLiveScores()
// (the automatic cron) checks this and skips entirely while backed off. Manual admin-triggered
// syncs (the "Sync Scores Only" button) bypass the skip and always attempt a fresh request —
// but still feed their result back into this same state, so a successful manual sync clears
// the backoff immediately and a failed one extends it too.
let consecutiveEspnFailures = 0;
let espnBackoffUntil = 0;
function isEspnBackedOff() {
    return Date.now() < espnBackoffUntil;
}
async function espnFetch(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) {
            const err = new Error(`ESPN request failed: ${res.status} ${res.statusText}`);
            err.status = res.status;
            throw err;
        }
        const data = await res.json();
        consecutiveEspnFailures = 0;
        espnBackoffUntil = 0;
        return data;
    }
    catch (err) {
        consecutiveEspnFailures++;
        // 1m, 2m, 4m, 8m, ... capped at 20m so a real recovery isn't missed for too long.
        const backoffMs = Math.min(60_000 * 2 ** (consecutiveEspnFailures - 1), 20 * 60_000);
        espnBackoffUntil = Date.now() + backoffMs;
        throw err;
    }
}
// 1=preseason, 2=regular, 3=postseason
const SEASON_TYPE_MAP = { preseason: 1, regular: 2, postseason: 3 };
function parseStatus(state) {
    if (state === 'pre')
        return 'pre';
    if (state === 'in')
        return 'in';
    return 'post';
}
function totalRecord(comp) {
    return comp.records?.find(r => r.type === 'total')?.summary ?? null;
}
// Grades every pick for a finished game (sets picks.isCorrect). This is the only place that
// writes isCorrect for live (non-migrated) games — leaderboard/H2H/achievements all read it,
// so if a sync path adds a game without calling this, results for that game silently never count.
// Ties are left ungraded (null) — not a win or a loss for either side.
async function gradeGamePicks(gameId, homeScore, awayScore) {
    if (homeScore === awayScore)
        return;
    const homeWon = homeScore > awayScore;
    await db_1.db.update(schema_1.picks)
        .set({ isCorrect: (0, drizzle_orm_1.sql) `(${schema_1.picks.pick} = 'home') = ${homeWon}` })
        .where((0, drizzle_orm_1.eq)(schema_1.picks.gameId, gameId));
}
// Sync for future seasons: ESPN's scoreboard and core API are blocked from server-side
// requests. Instead, collect event IDs by fetching each team's schedule (same domain
// as summary/winprobs — works from Railway), then fetch a summary per unique event.
async function syncWeekGamesFromTeamSchedules(week, season, seasonType) {
    const st = SEASON_TYPE_MAP[seasonType] ?? 2;
    // Step 1: use hard-coded team IDs — ESPN's /teams list returns 400 from Railway
    const teamIds = NFL_TEAM_IDS;
    // Step 2: collect unique event IDs for the requested week from all team schedules
    const eventIds = new Set();
    let firstTeamDone = false;
    for (const teamId of teamIds) {
        try {
            const schedResp = await espnFetch(`${BASE}/teams/${teamId}/schedule?season=${season}&seasontype=${st}`);
            const events = schedResp?.events ?? [];
            if (!firstTeamDone) {
                console.log(`[ESPN] team ${teamId} schedule: ${events.length} events, week numbers: ${[...new Set(events.map((e) => e.week?.number))].join(',')}`);
                firstTeamDone = true;
            }
            for (const ev of events) {
                if (ev.week?.number === week && ev.id) {
                    eventIds.add(String(ev.id));
                }
            }
        }
        catch (err) {
            const status = err?.status;
            const msg = err?.message ?? String(err);
            if (!firstTeamDone) {
                console.warn(`[ESPN] team ${teamId} schedule failed: ${status ?? msg}`);
                firstTeamDone = true;
            }
            // skip this team and continue
        }
    }
    if (eventIds.size === 0) {
        console.warn(`[ESPN] no events found via team schedules for ${seasonType} ${season} week ${week}`);
        return 0;
    }
    // Step 3: fetch summary + upsert for each unique event
    return syncGamesByEventIds([...eventIds], week, season, seasonType);
}
// Sync games from a known list of ESPN event IDs via /summary (works from Railway).
// Used by both the server-side team-schedule path and the mobile-assisted path for future seasons.
async function syncGamesByEventIds(eventIds, week, season, seasonType) {
    let upserted = 0;
    for (const eventId of eventIds) {
        try {
            const data = await espnFetch(`${BASE}/summary?event=${eventId}`);
            const comp = data.header?.competitions?.[0];
            if (!comp) {
                console.warn(`[ESPN] no competition in summary for event ${eventId}`);
                continue;
            }
            const home = comp.competitors?.find((c) => c.homeAway === 'home');
            const away = comp.competitors?.find((c) => c.homeAway === 'away');
            if (!home || !away) {
                console.warn(`[ESPN] missing competitors for event ${eventId}`);
                continue;
            }
            const pickcenter = Array.isArray(data.pickcenter) ? data.pickcenter[0] : null;
            const spreadVal = pickcenter?.spread != null ? parseFloat(pickcenter.spread) : null;
            const status = parseStatus(comp.status?.type?.state ?? 'pre');
            const homeScore = home.score != null ? parseInt(String(home.score), 10) : null;
            const awayScore = away.score != null ? parseInt(String(away.score), 10) : null;
            const row = {
                espnId: String(eventId),
                week,
                season,
                seasonType,
                sport: 'nfl',
                homeTeam: home.team?.displayName ?? '',
                awayTeam: away.team?.displayName ?? '',
                homeTeamLogo: home.team?.logo ?? null,
                awayTeamLogo: away.team?.logo ?? null,
                homeTeamRecord: totalRecord(home),
                awayTeamRecord: totalRecord(away),
                spread: spreadVal,
                favoriteTeam: null,
                gameTime: comp.date ? new Date(comp.date) : null,
                status,
                homeScore: homeScore != null && !isNaN(homeScore) ? homeScore : null,
                awayScore: awayScore != null && !isNaN(awayScore) ? awayScore : null,
                period: comp.status?.period ?? null,
                displayClock: comp.status?.displayClock ?? null,
                statusType: comp.status?.type?.name ?? null,
                isScoreLocked: false,
            };
            const [savedGame] = await db_1.db.insert(schema_1.games).values({ id: undefined, ...row }).onConflictDoUpdate({
                target: schema_1.games.espnId,
                set: {
                    status: row.status, homeScore: row.homeScore, awayScore: row.awayScore,
                    homeTeamRecord: row.homeTeamRecord, awayTeamRecord: row.awayTeamRecord,
                    period: row.period, displayClock: row.displayClock, statusType: row.statusType,
                    homeTeamLogo: row.homeTeamLogo, awayTeamLogo: row.awayTeamLogo,
                    spread: row.spread, favoriteTeam: row.favoriteTeam, gameTime: row.gameTime,
                },
            }).returning({ id: schema_1.games.id });
            upserted++;
            if (savedGame && row.status === 'post' && row.homeScore != null && row.awayScore != null) {
                await gradeGamePicks(savedGame.id, row.homeScore, row.awayScore).catch(err => console.error(`[ESPN] gradeGamePicks failed for game ${savedGame.id}:`, err));
            }
        }
        catch (err) {
            console.warn(`[ESPN] failed to sync event ${eventId}: ${err?.message}`);
        }
    }
    return upserted;
}
async function syncWeekGames(week, season, seasonType = 'regular') {
    // ESPN's /scoreboard has historically 400'd (or returned wrong-year data) for requests
    // Railway considers "future" — try it first (it's the richer, single-call endpoint), and
    // fall back to the team-schedule + per-event /summary path (syncWeekGamesFromTeamSchedules)
    // on any failure or empty result. Deliberately not gated on season > getCurrentNFLSeason():
    // that comparison doesn't flip until Sept 1 and would otherwise misclassify live preseason
    // weeks as "future" all August.
    const st = SEASON_TYPE_MAP[seasonType] ?? 2;
    const url = `${BASE}/scoreboard?week=${week}&seasontype=${st}&season=${season}&limit=50`;
    let events = [];
    try {
        const data = await espnFetch(url);
        events = data.events ?? [];
    }
    catch (err) {
        console.warn(`[ESPN] /scoreboard failed for ${seasonType} ${season} week ${week} (${err?.status ?? err?.message}) — falling back to team-schedule sync`);
    }
    if (events.length === 0) {
        return syncWeekGamesFromTeamSchedules(week, season, seasonType);
    }
    // Pre-fetch existing games to detect in→post transitions for notifications
    const existingGames = await db_1.db.query.games.findMany({ where: (0, drizzle_orm_1.eq)(schema_1.games.week, week) });
    const existingByEspnId = new Map(existingGames.map(g => [g.espnId, g]));
    const justFinished = [];
    let upserted = 0;
    for (const event of events) {
        const comp = event.competitions[0];
        if (!comp)
            continue;
        const home = comp.competitors.find(c => c.homeAway === 'home');
        const away = comp.competitors.find(c => c.homeAway === 'away');
        if (!home || !away)
            continue;
        const status = parseStatus(comp.status.type.state);
        const odds = comp.odds?.[0];
        const spread = odds?.spread ? parseFloat(odds.spread) : null;
        const favoriteTeam = odds?.homeTeamOdds?.favorite === false ? away.team.displayName : home.team.displayName;
        const homeScore = home.score ? parseInt(home.score, 10) : null;
        const awayScore = away.score ? parseInt(away.score, 10) : null;
        const row = {
            espnId: event.id,
            week,
            season,
            seasonType,
            sport: 'nfl',
            homeTeam: home.team.displayName,
            awayTeam: away.team.displayName,
            homeTeamLogo: home.team.logo ?? null,
            awayTeamLogo: away.team.logo ?? null,
            homeTeamRecord: totalRecord(home),
            awayTeamRecord: totalRecord(away),
            spread,
            favoriteTeam: spread ? favoriteTeam : null,
            gameTime: new Date(event.date),
            status,
            homeScore,
            awayScore,
            period: comp.status.period ?? null,
            displayClock: comp.status.displayClock ?? null,
            statusType: comp.status.type.name ?? null,
            isScoreLocked: false,
        };
        // Detect in→post transition for game-final notifications
        const existing = existingByEspnId.get(event.id);
        if (existing?.status === 'in' && status === 'post' && homeScore != null && awayScore != null) {
            justFinished.push({ id: existing.id, espnId: event.id, homeTeam: row.homeTeam, awayTeam: row.awayTeam, homeScore, awayScore });
        }
        const [savedGame] = await db_1.db.insert(schema_1.games).values({ id: undefined, ...row }).onConflictDoUpdate({
            target: schema_1.games.espnId,
            set: {
                status: row.status,
                homeScore: row.homeScore,
                awayScore: row.awayScore,
                homeTeamRecord: row.homeTeamRecord,
                awayTeamRecord: row.awayTeamRecord,
                period: row.period,
                displayClock: row.displayClock,
                statusType: row.statusType,
                homeTeamLogo: row.homeTeamLogo,
                awayTeamLogo: row.awayTeamLogo,
                spread: row.spread,
                favoriteTeam: row.favoriteTeam,
                gameTime: row.gameTime,
            },
        }).returning({ id: schema_1.games.id });
        upserted++;
        // Grade every pick tied to this game whenever it's final with a score — not just on the
        // in→post transition below, so a game that arrives already-final on its first-ever sync
        // (e.g. catching up after the app missed the live window) still gets its picks graded.
        if (savedGame && row.status === 'post' && row.homeScore != null && row.awayScore != null) {
            await gradeGamePicks(savedGame.id, row.homeScore, row.awayScore).catch(err => console.error(`[ESPN] gradeGamePicks failed for game ${savedGame.id}:`, err));
        }
    }
    // Fire game-final notifications and sync box score stats for just-finished games
    for (const game of justFinished) {
        if (game.homeScore === game.awayScore)
            continue; // tie — no clear correct/incorrect to report
        const homeWon = game.homeScore > game.awayScore;
        // Write winningTeamWinProb/losingTeamWinProb now that we know who won.
        // These are used to evaluate ESPN's pre-game prediction accuracy.
        const existing = existingByEspnId.get(game.espnId);
        if (existing?.homeTeamFPI != null && existing?.awayTeamFPI != null) {
            await db_1.db.update(schema_1.games).set({
                winningTeamWinProb: homeWon ? existing.homeTeamFPI : existing.awayTeamFPI,
                losingTeamWinProb: homeWon ? existing.awayTeamFPI : existing.homeTeamFPI,
            }).where((0, drizzle_orm_1.eq)(schema_1.games.id, game.id));
        }
        try {
            const gamePicks = await db_1.db.query.picks.findMany({ where: (0, drizzle_orm_1.eq)(schema_1.picks.gameId, game.id) });
            for (const pick of gamePicks) {
                const isCorrect = pick.pick === 'home' ? homeWon : !homeWon;
                (0, notificationService_1.notifyGameFinal)(pick.userId, game.homeTeam, game.awayTeam, game.homeScore, game.awayScore, isCorrect).catch(err => console.error('[ESPN] notifyGameFinal failed for user', pick.userId, err));
            }
        }
        catch (err) {
            console.error('[ESPN] Game final notification batch failed for game', game.id, err);
        }
        // Sync box score stats asynchronously — don't block the live update loop
        syncBoxScoreStats({ id: game.id, espnId: game.espnId, week, season, seasonType, homeTeam: game.homeTeam, awayTeam: game.awayTeam, homeScore: game.homeScore, awayScore: game.awayScore })
            .catch(err => console.error('[ESPN] syncBoxScoreStats failed for game', game.id, err));
    }
    return upserted;
}
// Live update pass: re-syncs every game that should have started (by scheduled kickoff) but
// isn't marked final yet. This is what actually flips a game pre→in→post — nothing else does,
// so this must not be gated on games already being 'in' (that was the original bug: nothing
// ever bootstrapped the first pre→in transition for a week automatically).
async function updateLiveScores() {
    // Manual kill switch (Railway env var, no deploy needed to flip) — used while diagnosing
    // ESPN blocking, so the automatic cron stays fully silent instead of relying on backoff
    // alone. The "Sync Scores Only" admin button is unaffected and still always attempts fresh.
    if (process.env['DISABLE_LIVE_SCORE_SYNC'] === 'true') {
        return;
    }
    if (isEspnBackedOff()) {
        const secondsLeft = Math.ceil((espnBackoffUntil - Date.now()) / 1000);
        console.warn(`[ESPN] Backed off after repeated failures — skipping this cycle (${secondsLeft}s left)`);
        return;
    }
    const now = new Date();
    const activeGames = await db_1.db.query.games.findMany({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.ne)(schema_1.games.status, 'post'), (0, drizzle_orm_1.lte)(schema_1.games.gameTime, now)),
    });
    // Group by season + week + seasonType (using each game's own fields, not a globally
    // recomputed "current season" — getCurrentNFLSeason() doesn't flip to 2026 until Sept 1,
    // so during preseason it would silently resync the wrong season's week).
    const seen = new Set();
    for (const game of activeGames) {
        const key = `${game.season}:${game.seasonType}:${game.week}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        await syncWeekGames(game.week, game.season, game.seasonType);
    }
}
async function syncWinProbabilities(week, season) {
    const weekGames = await db_1.db.query.games.findMany({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.games.week, week), (0, drizzle_orm_1.eq)(schema_1.games.season, season), (0, drizzle_orm_1.eq)(schema_1.games.seasonType, 'regular')),
    });
    console.log(`[WinProb] week=${week} season=${season}: found ${weekGames.length} games`);
    let updated = 0;
    for (const game of weekGames) {
        try {
            const url = `${BASE}/summary?event=${game.espnId}`;
            const data = await espnFetch(url);
            // Only use pre-game predictor — homeTeamFPI/awayTeamFPI store the pre-kickoff prediction.
            // winningTeamWinProb/losingTeamWinProb are set post-game when the actual winner is known.
            const predictor = data.predictor;
            if (!predictor?.homeTeam?.gameProjection || !predictor?.awayTeam?.gameProjection)
                continue;
            const homeTeamFPI = Math.round(parseFloat(predictor.homeTeam.gameProjection));
            const awayTeamFPI = Math.round(parseFloat(predictor.awayTeam.gameProjection));
            await db_1.db.update(schema_1.games).set({ homeTeamFPI, awayTeamFPI }).where((0, drizzle_orm_1.eq)(schema_1.games.id, game.id));
            updated++;
        }
        catch (err) {
            console.warn(`[WinProb] failed for espnId=${game.espnId}: ${err?.message}`);
        }
    }
    console.log(`[WinProb] updated ${updated}/${weekGames.length} games`);
    return updated;
}
// Sync box score stats for a completed game into team_game_stats (idempotent — delete + insert).
async function syncBoxScoreStats(game) {
    try {
        const data = await espnFetch(`${BASE}/summary?event=${game.espnId}`);
        const teams = data.boxscore?.teams ?? [];
        if (teams.length === 0) {
            console.warn(`[ESPN] No boxscore teams for event ${game.espnId}`);
            return;
        }
        const home = teams.find((t) => t.homeAway === 'home');
        const away = teams.find((t) => t.homeAway === 'away');
        if (!home || !away) {
            console.warn(`[ESPN] Missing home/away boxscore for event ${game.espnId}`);
            return;
        }
        const getStat = (team, name) => team.statistics?.find((s) => s.name === name)?.displayValue ?? null;
        const parseYards = (val) => {
            if (!val)
                return null;
            const n = parseInt(val, 10);
            return isNaN(n) ? null : n;
        };
        const parseRatio = (val) => {
            // "6-14" → 42.9%
            if (!val)
                return null;
            const parts = val.split('-').map(Number);
            if (parts.length !== 2 || !parts[1])
                return null;
            return Math.round((parts[0] / parts[1]) * 1000) / 10;
        };
        const homeTotalYards = parseYards(getStat(home, 'totalYards'));
        const homePassYards = parseYards(getStat(home, 'netPassingYards'));
        const homeRushYards = parseYards(getStat(home, 'rushingYards'));
        const homeThirdDownRaw = getStat(home, 'thirdDownEff');
        const homeRedZoneRaw = getStat(home, 'redZoneAttempts');
        const homeThirdDown = parseRatio(homeThirdDownRaw);
        const homeRedZone = parseRatio(homeRedZoneRaw);
        const homeSacksRaw = getStat(home, 'sacksYardsLost'); // "2-15"
        const homeTurnovers = parseYards(getStat(home, 'turnovers'));
        const homeFirstDowns = parseYards(getStat(home, 'firstDowns'));
        const awayTotalYards = parseYards(getStat(away, 'totalYards'));
        const awayPassYards = parseYards(getStat(away, 'netPassingYards'));
        const awayRushYards = parseYards(getStat(away, 'rushingYards'));
        const awayThirdDownRaw = getStat(away, 'thirdDownEff');
        const awayRedZoneRaw = getStat(away, 'redZoneAttempts');
        const awayThirdDown = parseRatio(awayThirdDownRaw);
        const awayRedZone = parseRatio(awayRedZoneRaw);
        const awaySacksRaw = getStat(away, 'sacksYardsLost');
        const awayTurnovers = parseYards(getStat(away, 'turnovers'));
        const awayFirstDowns = parseYards(getStat(away, 'firstDowns'));
        // Defensive sacks = how many times this team's defense sacked the opponent
        const homeDefSacks = awaySacksRaw ? (parseInt(awaySacksRaw.split('-')[0], 10) || null) : null;
        const awayDefSacks = homeSacksRaw ? (parseInt(homeSacksRaw.split('-')[0], 10) || null) : null;
        // QB sacked (offensive stat — how many times this team's own QB was sacked)
        const homeOffSacks = homeSacksRaw ? (parseInt(homeSacksRaw.split('-')[0], 10) || null) : null;
        const awayOffSacks = awaySacksRaw ? (parseInt(awaySacksRaw.split('-')[0], 10) || null) : null;
        // Idempotent — delete existing rows for this game before reinserting
        await db_1.db.delete(schema_1.teamGameStats).where((0, drizzle_orm_1.eq)(schema_1.teamGameStats.gameId, game.id));
        await db_1.db.insert(schema_1.teamGameStats).values([
            {
                gameId: game.id,
                season: game.season,
                week: game.week,
                sport: 'nfl',
                teamName: game.homeTeam,
                isHomeTeam: true,
                yardsPerGame: homeTotalYards,
                yardsAllowedPerGame: awayTotalYards,
                pointsPerGame: game.homeScore,
                pointsAllowedPerGame: game.awayScore,
                thirdDownConversion: homeThirdDown,
                redZoneEfficiency: homeRedZone,
                sackRate: homeDefSacks,
                additionalStats: {
                    passingYards: homePassYards,
                    rushingYards: homeRushYards,
                    seasonType: game.seasonType,
                    turnovers: homeTurnovers,
                    firstDowns: homeFirstDowns,
                    sacksAllowed: homeOffSacks,
                    thirdDownRaw: homeThirdDownRaw,
                    redZoneRaw: homeRedZoneRaw,
                },
            },
            {
                gameId: game.id,
                season: game.season,
                week: game.week,
                sport: 'nfl',
                teamName: game.awayTeam,
                isHomeTeam: false,
                yardsPerGame: awayTotalYards,
                yardsAllowedPerGame: homeTotalYards,
                pointsPerGame: game.awayScore,
                pointsAllowedPerGame: game.homeScore,
                thirdDownConversion: awayThirdDown,
                redZoneEfficiency: awayRedZone,
                sackRate: awayDefSacks,
                additionalStats: {
                    passingYards: awayPassYards,
                    rushingYards: awayRushYards,
                    seasonType: game.seasonType,
                    turnovers: awayTurnovers,
                    firstDowns: awayFirstDowns,
                    sacksAllowed: awayOffSacks,
                    thirdDownRaw: awayThirdDownRaw,
                    redZoneRaw: awayRedZoneRaw,
                },
            },
        ]);
        console.log(`[ESPN] Box score synced: ${game.awayTeam} @ ${game.homeTeam} W${game.week}`);
    }
    catch (err) {
        console.warn(`[ESPN] Box score sync failed for event ${game.espnId}: ${err?.message}`);
    }
}
// Backfill team_game_stats for all completed games in a season+type. Safe to re-run.
async function backfillTeamStats(season, seasonType = 'regular') {
    const completedGames = await db_1.db.query.games.findMany({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.games.season, season), (0, drizzle_orm_1.eq)(schema_1.games.status, 'post'), (0, drizzle_orm_1.eq)(schema_1.games.seasonType, seasonType), (0, drizzle_orm_1.eq)(schema_1.games.sport, 'nfl')),
    });
    console.log(`[ESPN] Backfilling stats: ${completedGames.length} ${seasonType} games for ${season}`);
    let synced = 0;
    for (const game of completedGames) {
        await syncBoxScoreStats({
            id: game.id,
            espnId: game.espnId,
            week: game.week,
            season: game.season,
            seasonType: game.seasonType,
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            homeScore: game.homeScore,
            awayScore: game.awayScore,
        });
        synced++;
    }
    return synced;
}
//# sourceMappingURL=espnService.js.map