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
const season_1 = require("../utils/season");
const avgOf = (nums) => {
    const valid = nums.filter((v) => v != null && typeof v === 'number' && !isNaN(v));
    return valid.length ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10 : null;
};
const router = (0, express_1.Router)();
async function buildTeamStats(season, seasonType = 'regular') {
    const allGames = await db_1.db.query.games.findMany({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.games.season, season), (0, drizzle_orm_1.eq)(schema.games.sport, 'nfl'), (0, drizzle_orm_1.eq)(schema.games.seasonType, seasonType)),
    });
    const teams = {};
    const ensure = (name, logo) => {
        if (!teams[name]) {
            teams[name] = { name, logo: logo ?? null, wins: 0, losses: 0, pointsScored: [], pointsAllowed: [], pickWins: 0, pickLosses: 0 };
        }
    };
    for (const game of allGames) {
        ensure(game.homeTeam, game.homeTeamLogo);
        ensure(game.awayTeam, game.awayTeamLogo);
        if (game.status !== 'post' || game.homeScore === null || game.awayScore === null)
            continue;
        const homeWon = game.homeScore > game.awayScore;
        teams[game.homeTeam].wins += homeWon ? 1 : 0;
        teams[game.homeTeam].losses += homeWon ? 0 : 1;
        teams[game.homeTeam].pointsScored.push(game.homeScore);
        teams[game.homeTeam].pointsAllowed.push(game.awayScore);
        teams[game.awayTeam].wins += homeWon ? 0 : 1;
        teams[game.awayTeam].losses += homeWon ? 1 : 0;
        teams[game.awayTeam].pointsScored.push(game.awayScore);
        teams[game.awayTeam].pointsAllowed.push(game.homeScore);
    }
    // Aggregate pick W-L across all users
    const finishedGameIds = allGames.filter(g => g.status === 'post').map(g => g.id);
    if (finishedGameIds.length > 0) {
        const allPicks = await db_1.db.query.picks.findMany({
            where: (0, drizzle_orm_1.inArray)(schema.picks.gameId, finishedGameIds),
        });
        const gameMap = Object.fromEntries(allGames.map(g => [g.id, g]));
        for (const pick of allPicks) {
            if (pick.isCorrect === null)
                continue;
            const game = gameMap[pick.gameId];
            if (!game)
                continue;
            const teamName = pick.pick === 'home' ? game.homeTeam : game.awayTeam;
            if (!teams[teamName])
                continue;
            if (pick.isCorrect)
                teams[teamName].pickWins++;
            else
                teams[teamName].pickLosses++;
        }
    }
    const avg = (arr) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;
    return Object.values(teams).map(t => ({
        name: t.name,
        logo: t.logo,
        wins: t.wins,
        losses: t.losses,
        ppg: avg(t.pointsScored),
        ppgAllowed: avg(t.pointsAllowed),
        pickWins: t.pickWins,
        pickLosses: t.pickLosses,
        pickTotal: t.pickWins + t.pickLosses,
        pickAccuracy: t.pickWins + t.pickLosses > 0
            ? Math.round((t.pickWins / (t.pickWins + t.pickLosses)) * 100)
            : null,
    }));
}
// GET /api/teams?season=X — all teams with stats
router.get('/', auth_1.optionalAuth, async (req, res) => {
    const season = req.query['season'] ? parseInt(req.query['season'], 10) : (0, season_1.getCurrentNFLSeason)();
    const seasonType = req.query['seasonType'] ?? 'regular';
    const teams = await buildTeamStats(season, seasonType);
    teams.sort((a, b) => b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name));
    res.json(teams);
});
// GET /api/teams/:name?season=X — team detail with recent games
router.get('/:name', auth_1.optionalAuth, async (req, res) => {
    const season = req.query['season'] ? parseInt(req.query['season'], 10) : (0, season_1.getCurrentNFLSeason)();
    const seasonType = req.query['seasonType'] ?? 'regular';
    const teamName = decodeURIComponent(req.params['name']);
    const allGames = await db_1.db.query.games.findMany({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.games.season, season), (0, drizzle_orm_1.eq)(schema.games.sport, 'nfl'), (0, drizzle_orm_1.eq)(schema.games.seasonType, seasonType)),
    });
    const teamGames = allGames.filter(g => g.homeTeam === teamName || g.awayTeam === teamName).sort((a, b) => {
        const at = a.gameTime ? new Date(a.gameTime).getTime() : 0;
        const bt = b.gameTime ? new Date(b.gameTime).getTime() : 0;
        return bt - at;
    });
    if (!teamGames.length) {
        res.status(404).json({ error: 'Team not found' });
        return;
    }
    let wins = 0, losses = 0;
    const pointsScored = [];
    const pointsAllowed = [];
    const recentGames = teamGames.filter(g => g.status === 'post').slice(0, 5).map(game => {
        const isHome = game.homeTeam === teamName;
        const opponent = isHome ? game.awayTeam : game.homeTeam;
        const opponentLogo = isHome ? game.awayTeamLogo : game.homeTeamLogo;
        const myScore = isHome ? game.homeScore : game.awayScore;
        const theirScore = isHome ? game.awayScore : game.homeScore;
        let result = null;
        if (game.status === 'post' && myScore !== null && theirScore !== null) {
            result = myScore > theirScore ? 'W' : 'L';
        }
        return {
            gameId: game.id,
            week: game.week,
            gameTime: game.gameTime,
            status: game.status,
            isHome,
            opponent,
            opponentLogo,
            myScore,
            theirScore,
            result,
        };
    });
    for (const game of teamGames) {
        if (game.status !== 'post' || game.homeScore === null || game.awayScore === null)
            continue;
        const isHome = game.homeTeam === teamName;
        const myScore = isHome ? game.homeScore : game.awayScore;
        const theirScore = isHome ? game.awayScore : game.homeScore;
        if (myScore > theirScore)
            wins++;
        else
            losses++;
        pointsScored.push(myScore);
        pointsAllowed.push(theirScore);
    }
    // Pick W-L for this team across all users
    const gameIds = teamGames.map(g => g.id);
    let pickWins = 0, pickLosses = 0;
    if (gameIds.length > 0) {
        const gamePicks = await db_1.db.query.picks.findMany({
            where: (0, drizzle_orm_1.inArray)(schema.picks.gameId, gameIds),
        });
        const gameMap = Object.fromEntries(teamGames.map(g => [g.id, g]));
        for (const pick of gamePicks) {
            if (pick.isCorrect === null)
                continue;
            const game = gameMap[pick.gameId];
            if (!game)
                continue;
            const pickedTeam = pick.pick === 'home' ? game.homeTeam : game.awayTeam;
            if (pickedTeam !== teamName)
                continue;
            if (pick.isCorrect)
                pickWins++;
            else
                pickLosses++;
        }
    }
    const avg = (arr) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;
    const logo = teamGames[0]?.homeTeam === teamName ? teamGames[0].homeTeamLogo : teamGames[0]?.awayTeamLogo;
    // Team stats from team_game_stats (yards, passing, rushing)
    let statsRows = await db_1.db.query.teamGameStats.findMany({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.teamGameStats.teamName, teamName), (0, drizzle_orm_1.eq)(schema.teamGameStats.season, season), (0, drizzle_orm_1.eq)(schema.teamGameStats.sport, 'nfl')),
    });
    let statsSeasonUsed = null;
    let filteredStats = statsRows.filter(r => r.additionalStats?.seasonType === seasonType);
    if (filteredStats.length === 0 && season > 2025) {
        statsRows = await db_1.db.query.teamGameStats.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.teamGameStats.teamName, teamName), (0, drizzle_orm_1.eq)(schema.teamGameStats.season, 2025), (0, drizzle_orm_1.eq)(schema.teamGameStats.sport, 'nfl')),
        });
        filteredStats = statsRows.filter(r => r.additionalStats?.seasonType === 'regular');
        if (filteredStats.length > 0)
            statsSeasonUsed = 2025;
    }
    else if (filteredStats.length > 0) {
        statsSeasonUsed = season;
    }
    res.json({
        name: teamName,
        logo: logo ?? null,
        wins,
        losses,
        ppg: avg(pointsScored),
        ppgAllowed: avg(pointsAllowed),
        ypg: avgOf(filteredStats.map(r => r.yardsPerGame)),
        yapg: avgOf(filteredStats.map(r => r.yardsAllowedPerGame)),
        passYpg: avgOf(filteredStats.map(r => r.additionalStats?.passingYards)),
        rushYpg: avgOf(filteredStats.map(r => r.additionalStats?.rushingYards)),
        thirdDownPct: avgOf(filteredStats.map(r => r.thirdDownConversion)),
        redZonePct: avgOf(filteredStats.map(r => r.redZoneEfficiency)),
        sacksPG: avgOf(filteredStats.map(r => r.sackRate)),
        turnoversPG: avgOf(filteredStats.map(r => r.additionalStats?.turnovers)),
        statsSeasonUsed,
        pickWins,
        pickLosses,
        pickTotal: pickWins + pickLosses,
        pickAccuracy: pickWins + pickLosses > 0 ? Math.round((pickWins / (pickWins + pickLosses)) * 100) : null,
        recentGames,
    });
});
exports.default = router;
//# sourceMappingURL=teams.js.map