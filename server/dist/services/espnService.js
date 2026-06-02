"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncWeekGames = syncWeekGames;
exports.updateLiveScores = updateLiveScores;
exports.syncWeekScores = syncWeekScores;
exports.syncWinProbabilities = syncWinProbabilities;
const axios_1 = __importDefault(require("axios"));
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const season_1 = require("../utils/season");
const notificationService_1 = require("./notificationService");
const BASE = process.env['ESPN_API_BASE_URL'] ?? 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
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
async function syncWeekGames(week, season, seasonType = 'regular') {
    const st = SEASON_TYPE_MAP[seasonType] ?? 2;
    const url = `${BASE}/scoreboard?week=${week}&seasontype=${st}&limit=50`;
    const { data } = await axios_1.default.get(url);
    const events = data.events ?? [];
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
            justFinished.push({ id: existing.id, homeTeam: row.homeTeam, awayTeam: row.awayTeam, homeScore, awayScore });
        }
        await db_1.db.insert(schema_1.games).values({ id: undefined, ...row }).onConflictDoUpdate({
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
        });
        upserted++;
    }
    // Fire game-final notifications for any games that just finished
    for (const game of justFinished) {
        try {
            const gamePicks = await db_1.db.query.picks.findMany({ where: (0, drizzle_orm_1.eq)(schema_1.picks.gameId, game.id) });
            const homeWon = game.homeScore > game.awayScore;
            for (const pick of gamePicks) {
                const isCorrect = pick.pick === 'home' ? homeWon : !homeWon;
                (0, notificationService_1.notifyGameFinal)(pick.userId, game.homeTeam, game.awayTeam, game.homeScore, game.awayScore, isCorrect).catch(err => console.error('[ESPN] notifyGameFinal failed for user', pick.userId, err));
            }
        }
        catch (err) {
            console.error('[ESPN] Game final notification batch failed for game', game.id, err);
        }
    }
    return upserted;
}
async function updateLiveScores() {
    const season = (0, season_1.getCurrentNFLSeason)();
    // Find weeks with in-progress games
    const liveGames = await db_1.db.query.games.findMany({
        where: (0, drizzle_orm_1.eq)(schema_1.games.status, 'in'),
    });
    const weeks = [...new Set(liveGames.map(g => g.week))];
    for (const week of weeks) {
        await syncWeekGames(week, season, 'regular');
    }
}
async function syncWeekScores(week, season, seasonType = 'regular') {
    const st = SEASON_TYPE_MAP[seasonType] ?? 2;
    const url = `${BASE}/scoreboard?week=${week}&seasontype=${st}&limit=50`;
    const { data } = await axios_1.default.get(url);
    const events = data.events ?? [];
    let updated = 0;
    for (const event of events) {
        const comp = event.competitions[0];
        if (!comp)
            continue;
        const home = comp.competitors.find(c => c.homeAway === 'home');
        const away = comp.competitors.find(c => c.homeAway === 'away');
        if (!home || !away)
            continue;
        await db_1.db.update(schema_1.games).set({
            status: parseStatus(comp.status.type.state),
            homeScore: home.score ? parseInt(home.score, 10) : null,
            awayScore: away.score ? parseInt(away.score, 10) : null,
            period: comp.status.period ?? null,
            displayClock: comp.status.displayClock ?? null,
            statusType: comp.status.type.name ?? null,
        }).where((0, drizzle_orm_1.eq)(schema_1.games.espnId, event.id));
        updated++;
    }
    return updated;
}
async function syncWinProbabilities(week, season) {
    const weekGames = await db_1.db.query.games.findMany({
        where: (0, drizzle_orm_1.eq)(schema_1.games.week, week),
    });
    for (const game of weekGames) {
        try {
            const url = `${BASE}/summary?event=${game.espnId}`;
            const { data } = await axios_1.default.get(url);
            const winProb = data.winprobability;
            if (!Array.isArray(winProb) || winProb.length === 0)
                continue;
            const last = winProb[winProb.length - 1];
            const homeWinProb = Math.round(last.homeWinPercentage * 100);
            const awayWinProb = 100 - homeWinProb;
            // Determine which team won (for post-game), or current leader (for pre/live)
            const homeIsLeading = homeWinProb >= awayWinProb;
            await db_1.db.update(schema_1.games).set({
                winningTeamWinProb: homeIsLeading ? homeWinProb : awayWinProb,
                losingTeamWinProb: homeIsLeading ? awayWinProb : homeWinProb,
            }).where((0, drizzle_orm_1.eq)(schema_1.games.id, game.id));
        }
        catch {
            // Individual game failure shouldn't stop the whole sync
        }
    }
}
//# sourceMappingURL=espnService.js.map