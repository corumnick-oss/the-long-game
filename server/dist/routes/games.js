"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const schema = __importStar(require("../db/schema"));
const drizzle_orm_1 = require("drizzle-orm");
const auth_1 = require("../middleware/auth");
const lockTime_1 = require("../utils/lockTime");
const season_1 = require("../utils/season");
const router = (0, express_1.Router)();
// Average over nullable numbers
const avgOf = (nums) => {
    const valid = nums.filter((v) => v != null && typeof v === 'number' && !isNaN(v));
    return valid.length ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10 : null;
};
async function fetchTeamStatsMap(teamNames, season, seasonType) {
    if (teamNames.length === 0)
        return { map: {}, seasonUsed: null };
    const query = (s) => db_1.db.query.teamGameStats.findMany({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.inArray)(schema.teamGameStats.teamName, teamNames), (0, drizzle_orm_1.eq)(schema.teamGameStats.season, s), (0, drizzle_orm_1.eq)(schema.teamGameStats.sport, 'nfl')),
    });
    let rows = await query(season);
    let filtered = rows.filter(r => r.additionalStats?.seasonType === seasonType);
    let seasonUsed = null;
    if (filtered.length === 0 && season > 2025) {
        rows = await query(2025);
        filtered = rows.filter(r => r.additionalStats?.seasonType === 'regular');
        if (filtered.length > 0)
            seasonUsed = 2025;
    }
    else if (filtered.length > 0) {
        seasonUsed = season;
    }
    const map = {};
    for (const name of teamNames) {
        const tr = filtered.filter(r => r.teamName === name);
        map[name] = {
            ppg: avgOf(tr.map(r => r.pointsPerGame)),
            ppga: avgOf(tr.map(r => r.pointsAllowedPerGame)),
            ypg: avgOf(tr.map(r => r.yardsPerGame)),
            yapg: avgOf(tr.map(r => r.yardsAllowedPerGame)),
            passYpg: avgOf(tr.map(r => r.additionalStats?.passingYards)),
            rushYpg: avgOf(tr.map(r => r.additionalStats?.rushingYards)),
        };
    }
    return { map, seasonUsed };
}
// GET /api/games?week=X&season=Y
router.get('/', auth_1.optionalAuth, async (req, res) => {
    const season = req.query['season'] ? parseInt(req.query['season'], 10) : (0, season_1.getCurrentNFLSeason)();
    const week = req.query['week'] ? parseInt(req.query['week'], 10) : undefined;
    const seasonType = req.query['seasonType'] ?? 'regular';
    const conditions = [(0, drizzle_orm_1.eq)(schema.games.season, season), (0, drizzle_orm_1.eq)(schema.games.sport, 'nfl'), (0, drizzle_orm_1.eq)(schema.games.seasonType, seasonType)];
    if (week)
        conditions.push((0, drizzle_orm_1.eq)(schema.games.week, week));
    const gameList = await db_1.db.query.games.findMany({
        where: (0, drizzle_orm_1.and)(...conditions),
        orderBy: [(0, drizzle_orm_1.asc)(schema.games.gameTime)],
    });
    // Attach viewer's own picks if authenticated
    let myPicksMap = {};
    if (req.currentUser && week) {
        const myPicks = await db_1.db.query.picks.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.picks.userId, req.currentUser.id), ...gameList.map(g => (0, drizzle_orm_1.eq)(schema.picks.gameId, g.id)).slice(0, 1)),
        });
        // Fetch all my picks for these games
        const allMyPicks = await db_1.db.query.picks.findMany({
            where: (0, drizzle_orm_1.eq)(schema.picks.userId, req.currentUser.id),
        });
        myPicksMap = Object.fromEntries(allMyPicks.filter(p => gameList.some(g => g.id === p.gameId)).map(p => [p.gameId, p.pick]));
    }
    // Compute pick % after lock
    let pickPctMap = {};
    if (week && gameList.length > 0) {
        const locked = await (0, lockTime_1.isWeekLocked)(week, season);
        if (locked) {
            const gameIds = gameList.map(g => g.id);
            const allPicks = await db_1.db.query.picks.findMany({
                where: (0, drizzle_orm_1.inArray)(schema.picks.gameId, gameIds),
            });
            for (const game of gameList) {
                const gamePicks = allPicks.filter(p => p.gameId === game.id);
                const total = gamePicks.length;
                if (total === 0) {
                    pickPctMap[game.id] = { homePickPct: null, awayPickPct: null };
                }
                else {
                    const homeCount = gamePicks.filter(p => p.pick === 'home').length;
                    pickPctMap[game.id] = {
                        homePickPct: Math.round((homeCount / total) * 100),
                        awayPickPct: Math.round(((total - homeCount) / total) * 100),
                    };
                }
            }
        }
    }
    // Attach team stats averages
    const allTeamNames = [...new Set(gameList.flatMap(g => [g.homeTeam, g.awayTeam]))];
    const { map: statsMap, seasonUsed: statsSeasonUsed } = await fetchTeamStatsMap(allTeamNames, season, seasonType);
    res.json(gameList.map(game => ({
        ...game,
        myPick: myPicksMap[game.id] ?? null,
        homePickPct: pickPctMap[game.id]?.homePickPct ?? null,
        awayPickPct: pickPctMap[game.id]?.awayPickPct ?? null,
        homePPG: statsMap[game.homeTeam]?.ppg ?? null,
        homePPGA: statsMap[game.homeTeam]?.ppga ?? null,
        homeYPG: statsMap[game.homeTeam]?.ypg ?? null,
        homeYAPG: statsMap[game.homeTeam]?.yapg ?? null,
        homePassYPG: statsMap[game.homeTeam]?.passYpg ?? null,
        homeRushYPG: statsMap[game.homeTeam]?.rushYpg ?? null,
        awayPPG: statsMap[game.awayTeam]?.ppg ?? null,
        awayPPGA: statsMap[game.awayTeam]?.ppga ?? null,
        awayYPG: statsMap[game.awayTeam]?.ypg ?? null,
        awayYAPG: statsMap[game.awayTeam]?.yapg ?? null,
        awayPassYPG: statsMap[game.awayTeam]?.passYpg ?? null,
        awayRushYPG: statsMap[game.awayTeam]?.rushYpg ?? null,
        statsSeasonUsed,
    })));
});
// GET /api/games/:id
router.get('/:id', auth_1.optionalAuth, async (req, res) => {
    const game = await db_1.db.query.games.findFirst({
        where: (0, drizzle_orm_1.eq)(schema.games.id, req.params['id']),
    });
    if (!game) {
        res.status(404).json({ error: 'Game not found' });
        return;
    }
    const locked = await (0, lockTime_1.isWeekLocked)(game.week, game.season);
    let pickBreakdown = null;
    if (locked) {
        const gamePicks = await db_1.db.query.picks.findMany({
            where: (0, drizzle_orm_1.eq)(schema.picks.gameId, game.id),
        });
        const userIds = [...new Set(gamePicks.map(p => p.userId))];
        const usersData = userIds.length
            ? await db_1.db.query.users.findMany({ where: (0, drizzle_orm_1.and)(...userIds.map(id => (0, drizzle_orm_1.eq)(schema.users.id, id)).slice(0, 1)) })
            : [];
        // Re-fetch users properly
        const allUsers = await db_1.db.query.users.findMany();
        const usersMap = Object.fromEntries(allUsers.map(u => [u.id, u]));
        const homeCount = gamePicks.filter(p => p.pick === 'home').length;
        const awayCount = gamePicks.filter(p => p.pick === 'away').length;
        const total = gamePicks.length;
        pickBreakdown = {
            homePct: total ? Math.round((homeCount / total) * 100) : 0,
            awayPct: total ? Math.round((awayCount / total) * 100) : 0,
            picks: gamePicks.map(p => ({
                userId: p.userId,
                teamName: usersMap[p.userId]?.teamName ?? 'Unknown',
                profileImageUrl: usersMap[p.userId]?.profileImageUrl ?? null,
                pick: p.pick,
                isCorrect: p.isCorrect,
            })),
        };
    }
    // Always return viewer's own pick
    let myPick = null;
    if (req.currentUser) {
        const myPickRecord = await db_1.db.query.picks.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.picks.userId, req.currentUser.id), (0, drizzle_orm_1.eq)(schema.picks.gameId, game.id)),
        });
        myPick = myPickRecord?.pick ?? null;
    }
    // Team stats for this game
    const { map: statsMap, seasonUsed: statsSeasonUsed } = await fetchTeamStatsMap([game.homeTeam, game.awayTeam], game.season, game.seasonType);
    // Last 5 completed games for each team this season
    const seasonGames = await db_1.db.query.games.findMany({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.games.sport, 'nfl'), (0, drizzle_orm_1.eq)(schema.games.season, game.season), (0, drizzle_orm_1.eq)(schema.games.seasonType, game.seasonType), (0, drizzle_orm_1.eq)(schema.games.status, 'post')),
        orderBy: [(0, drizzle_orm_1.asc)(schema.games.gameTime)],
    });
    const makeRecentGames = (teamName) => seasonGames
        .filter(g => (g.homeTeam === teamName || g.awayTeam === teamName) && g.id !== game.id)
        .sort((a, b) => new Date(b.gameTime).getTime() - new Date(a.gameTime).getTime())
        .slice(0, 5)
        .map(g => {
        const isHome = g.homeTeam === teamName;
        const teamScore = isHome ? g.homeScore : g.awayScore;
        const oppScore = isHome ? g.awayScore : g.homeScore;
        return {
            gameId: g.id,
            week: g.week,
            gameTime: g.gameTime,
            isHome,
            opponent: isHome ? g.awayTeam : g.homeTeam,
            opponentLogo: isHome ? g.awayTeamLogo : g.homeTeamLogo,
            teamScore,
            oppScore,
            result: teamScore !== null && oppScore !== null ? (teamScore > oppScore ? 'W' : 'L') : null,
        };
    });
    res.json({
        ...game,
        pickBreakdown,
        myPick,
        isLocked: locked,
        homePPG: statsMap[game.homeTeam]?.ppg ?? null,
        homePPGA: statsMap[game.homeTeam]?.ppga ?? null,
        homeYPG: statsMap[game.homeTeam]?.ypg ?? null,
        homeYAPG: statsMap[game.homeTeam]?.yapg ?? null,
        homePassYPG: statsMap[game.homeTeam]?.passYpg ?? null,
        homeRushYPG: statsMap[game.homeTeam]?.rushYpg ?? null,
        awayPPG: statsMap[game.awayTeam]?.ppg ?? null,
        awayPPGA: statsMap[game.awayTeam]?.ppga ?? null,
        awayYPG: statsMap[game.awayTeam]?.ypg ?? null,
        awayYAPG: statsMap[game.awayTeam]?.yapg ?? null,
        awayPassYPG: statsMap[game.awayTeam]?.passYpg ?? null,
        awayRushYPG: statsMap[game.awayTeam]?.rushYpg ?? null,
        statsSeasonUsed,
        homeTeamRecentGames: makeRecentGames(game.homeTeam),
        awayTeamRecentGames: makeRecentGames(game.awayTeam),
    });
});
exports.default = router;
//# sourceMappingURL=games.js.map