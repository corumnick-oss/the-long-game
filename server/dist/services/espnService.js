"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncWeekGames = syncWeekGames;
exports.updateLiveScores = updateLiveScores;
exports.syncWinProbabilities = syncWinProbabilities;
const axios_1 = __importDefault(require("axios"));
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const season_1 = require("../utils/season");
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
            homeScore: home.score ? parseInt(home.score, 10) : null,
            awayScore: away.score ? parseInt(away.score, 10) : null,
            period: comp.status.period ?? null,
            displayClock: comp.status.displayClock ?? null,
            statusType: comp.status.type.name ?? null,
            isScoreLocked: false,
        };
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