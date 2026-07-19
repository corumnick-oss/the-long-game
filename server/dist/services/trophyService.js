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
exports.calculateWeeklyTrophies = calculateWeeklyTrophies;
exports.awardWeeklyTrophies = awardWeeklyTrophies;
exports.calculateSeasonStandings = calculateSeasonStandings;
exports.awardSeasonTrophies = awardSeasonTrophies;
const db_1 = require("../db");
const schema = __importStar(require("../db/schema"));
const drizzle_orm_1 = require("drizzle-orm");
const notificationService_1 = require("./notificationService");
async function calculateWeeklyTrophies(week, season) {
    const weekGames = await db_1.db.query.games.findMany({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.games.week, week), (0, drizzle_orm_1.eq)(schema.games.season, season), (0, drizzle_orm_1.eq)(schema.games.sport, 'nfl')),
    });
    const completedGames = weekGames.filter(g => g.status === 'post');
    if (completedGames.length === 0)
        return { mostWins: [], mostLosses: [], upsetPick: [], loneWolf: [], contrarian: [] };
    const gameIds = completedGames.map(g => g.id);
    const allPicks = await db_1.db.query.picks.findMany({
        where: (0, drizzle_orm_1.inArray)(schema.picks.gameId, gameIds),
    });
    // Group picks
    const picksByUser = new Map();
    const picksByGame = new Map();
    for (const pick of allPicks) {
        if (!picksByUser.has(pick.userId))
            picksByUser.set(pick.userId, new Map());
        picksByUser.get(pick.userId).set(pick.gameId, pick);
        if (!picksByGame.has(pick.gameId))
            picksByGame.set(pick.gameId, []);
        picksByGame.get(pick.gameId).push(pick);
    }
    const userMetrics = new Map();
    for (const [userId, userPicks] of Array.from(picksByUser.entries())) {
        let correctPicks = 0;
        let incorrectPicks = 0;
        let lowestWinProbabilityPick = null;
        for (const [gameId, pick] of Array.from(userPicks.entries())) {
            const game = completedGames.find(g => g.id === gameId);
            if (!game)
                continue;
            if (pick.isCorrect) {
                correctPicks++;
                if (game.winningTeamWinProb != null) {
                    const winProb = game.winningTeamWinProb;
                    const pickedTeam = pick.pick === 'home' ? game.homeTeam : game.awayTeam;
                    const opponentTeam = pick.pick === 'home' ? game.awayTeam : game.homeTeam;
                    if (!lowestWinProbabilityPick || winProb < lowestWinProbabilityPick.winProbability) {
                        lowestWinProbabilityPick = { gameId, winProbability: winProb, pickedTeam, opponentTeam };
                    }
                }
            }
            else {
                incorrectPicks++;
            }
        }
        userMetrics.set(userId, { correctPicks, incorrectPicks, lowestWinProbabilityPick });
    }
    // ── 1. Most Wins ──
    const mostWins = [];
    let maxWins = 0;
    for (const [userId, m] of Array.from(userMetrics.entries())) {
        if (m.correctPicks > maxWins) {
            maxWins = m.correctPicks;
            mostWins.length = 0;
            mostWins.push({ userId, value: m.correctPicks });
        }
        else if (m.correctPicks === maxWins && maxWins > 0)
            mostWins.push({ userId, value: m.correctPicks });
    }
    // ── 2. Most Losses ──
    const mostLosses = [];
    let maxLosses = 0;
    for (const [userId, m] of Array.from(userMetrics.entries())) {
        if (m.incorrectPicks > maxLosses) {
            maxLosses = m.incorrectPicks;
            mostLosses.length = 0;
            mostLosses.push({ userId, value: m.incorrectPicks });
        }
        else if (m.incorrectPicks === maxLosses && maxLosses > 0)
            mostLosses.push({ userId, value: m.incorrectPicks });
    }
    // ── 3. Upset Pick ──
    const EPSILON = 0.01;
    const upsetPick = [];
    let lowestWinProb = Infinity;
    for (const [userId, m] of Array.from(userMetrics.entries())) {
        if (!m.lowestWinProbabilityPick)
            continue;
        const { winProbability, pickedTeam, opponentTeam } = m.lowestWinProbabilityPick;
        if (winProbability < lowestWinProb - EPSILON) {
            lowestWinProb = winProbability;
            upsetPick.length = 0;
            upsetPick.push({ userId, value: winProbability, teamName: pickedTeam, opponentName: opponentTeam, winProbability });
        }
        else if (Math.abs(winProbability - lowestWinProb) < EPSILON) {
            upsetPick.push({ userId, value: winProbability, teamName: pickedTeam, opponentName: opponentTeam, winProbability });
        }
    }
    // ── 4. Lone Wolf ──
    const loneWolf = [];
    for (const game of completedGames) {
        const gamePicks = picksByGame.get(game.id) ?? [];
        const isHomeWinner = game.homeScore != null && game.awayScore != null && game.homeScore > game.awayScore;
        const isAwayWinner = game.homeScore != null && game.awayScore != null && game.awayScore > game.homeScore;
        if (!isHomeWinner && !isAwayWinner)
            continue;
        const winSide = isHomeWinner ? 'home' : 'away';
        const winTeam = isHomeWinner ? game.homeTeam : game.awayTeam;
        const loseTeam = isHomeWinner ? game.awayTeam : game.homeTeam;
        const winningPicks = gamePicks.filter(p => p.pick === winSide);
        const losingPicks = gamePicks.filter(p => p.pick !== winSide);
        if (winningPicks.length === 1 && losingPicks.length >= 1 && winningPicks[0]) {
            loneWolf.push({ userId: winningPicks[0].userId, value: 1, gameId: game.id, teamName: winTeam, opponentName: loseTeam });
        }
    }
    // ── 5. Contrarian ──
    const CONTRARIAN_THRESHOLD = 0.20;
    const contrarian = [];
    for (const game of completedGames) {
        const gamePicks = picksByGame.get(game.id) ?? [];
        if (gamePicks.length === 0)
            continue;
        const isHomeWinner = game.homeScore != null && game.awayScore != null && game.homeScore > game.awayScore;
        const isAwayWinner = game.homeScore != null && game.awayScore != null && game.awayScore > game.homeScore;
        if (!isHomeWinner && !isAwayWinner)
            continue;
        const winSide = isHomeWinner ? 'home' : 'away';
        const winTeam = isHomeWinner ? game.homeTeam : game.awayTeam;
        const loseTeam = isHomeWinner ? game.awayTeam : game.homeTeam;
        const winningPicks = gamePicks.filter(p => p.pick === winSide);
        const percentage = winningPicks.length / gamePicks.length;
        // Contrarian: ≤20% picked winner AND more than 1 winner pick (lone wolf is handled separately)
        if (percentage <= CONTRARIAN_THRESHOLD && winningPicks.length > 1) {
            for (const pick of winningPicks) {
                if (pick.isCorrect) {
                    contrarian.push({ userId: pick.userId, value: percentage, gameId: game.id, teamName: winTeam, opponentName: loseTeam, pickPercentage: Math.round(percentage * 100) });
                }
            }
        }
    }
    return { mostWins, mostLosses, upsetPick, loneWolf, contrarian };
}
async function awardWeeklyTrophies(week, season, specificType) {
    console.log(`Awarding trophies for Week ${week}, Season ${season}${specificType ? ` (${specificType})` : ''}...`);
    const results = await calculateWeeklyTrophies(week, season);
    const toAward = [];
    if (!specificType || specificType === 'most_wins') {
        for (const c of results.mostWins)
            toAward.push({ userId: c.userId, type: 'most_wins', name: 'Most Wins of the Week', description: `Got ${c.value} picks correct this week`, week, season, sport: 'nfl' });
    }
    if (!specificType || specificType === 'loser') {
        for (const c of results.mostLosses)
            toAward.push({ userId: c.userId, type: 'loser', name: 'Loser of the Week', description: `Got ${c.value} picks wrong this week`, week, season, sport: 'nfl' });
    }
    if (!specificType || specificType === 'upset_pick') {
        for (const c of results.upsetPick)
            toAward.push({ userId: c.userId, type: 'upset_pick', name: 'Upset Pick of the Week', description: `Picked ${c.teamName} to beat ${c.opponentName} with only ${Math.round(c.winProbability)}% win probability`, week, season, sport: 'nfl' });
    }
    if (!specificType || specificType === 'lone_wolf') {
        for (const c of results.loneWolf)
            toAward.push({ userId: c.userId, type: 'lone_wolf', name: 'Lone Wolf', description: `Was the only player to pick ${c.teamName} to beat ${c.opponentName}`, week, season, sport: 'nfl', gameId: c.gameId });
    }
    if (!specificType || specificType === 'contrarian') {
        for (const c of results.contrarian)
            toAward.push({ userId: c.userId, type: 'contrarian', name: 'Contrarian', description: `Correctly picked ${c.teamName} when only ${c.pickPercentage}% chose them`, week, season, sport: 'nfl', gameId: c.gameId });
    }
    let awarded = 0;
    for (const trophy of toAward) {
        const isPerGame = trophy.type === 'lone_wolf' || trophy.type === 'contrarian';
        const existing = await db_1.db.query.trophies.findFirst({
            where: isPerGame && trophy.gameId
                ? (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.trophies.userId, trophy.userId), (0, drizzle_orm_1.eq)(schema.trophies.type, trophy.type), (0, drizzle_orm_1.eq)(schema.trophies.week, week), (0, drizzle_orm_1.eq)(schema.trophies.season, season), (0, drizzle_orm_1.eq)(schema.trophies.gameId, trophy.gameId))
                : (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.trophies.userId, trophy.userId), (0, drizzle_orm_1.eq)(schema.trophies.type, trophy.type), (0, drizzle_orm_1.eq)(schema.trophies.week, week), (0, drizzle_orm_1.eq)(schema.trophies.season, season)),
        });
        if (!existing) {
            await db_1.db.insert(schema.trophies).values(trophy);
            awarded++;
            (0, notificationService_1.notifyAchievementEarned)(trophy.userId, trophy.name, week).catch(err => console.error('[Trophies] notifyAchievementEarned failed:', err));
        }
    }
    console.log(`Awarded ${awarded} trophies for Week ${week}`);
    return awarded;
}
// Gridirons-only, regular season standings — same ranking rule as the leaderboard (wins desc, losses asc).
async function calculateSeasonStandings(season) {
    const result = await db_1.db.execute((0, drizzle_orm_1.sql) `
    SELECT
      u.id AS user_id,
      u.team_name,
      COALESCE(CAST(COUNT(CASE WHEN p.is_correct = true  THEN 1 END) AS INTEGER), 0) AS wins,
      COALESCE(CAST(COUNT(CASE WHEN p.is_correct = false THEN 1 END) AS INTEGER), 0) AS losses
    FROM users u
    LEFT JOIN games g ON g.season = ${season} AND g.sport = 'nfl' AND g.season_type = 'regular'
    LEFT JOIN picks p ON p.user_id = u.id AND p.game_id = g.id
    WHERE u.is_gridiron = true
    GROUP BY u.id, u.team_name
    HAVING COUNT(p.id) > 0
    ORDER BY wins DESC, losses ASC
  `);
    const rows = result.rows ?? result;
    return rows.map((row, idx) => ({
        userId: row.user_id,
        teamName: row.team_name,
        wins: Number(row.wins),
        losses: Number(row.losses),
        rank: idx + 1,
    }));
}
async function awardSeasonTrophies(season) {
    const standings = await calculateSeasonStandings(season);
    if (standings.length === 0)
        return [];
    const lastRank = standings[standings.length - 1].rank;
    const toAward = [];
    for (const entry of standings) {
        let placement = null;
        if (entry.rank === 1)
            placement = 'champion';
        else if (entry.rank === 2)
            placement = 'runner_up';
        else if (entry.rank === 3)
            placement = 'third_place';
        else if (entry.rank === lastRank && lastRank > 3)
            placement = 'last_place';
        if (placement) {
            toAward.push({ userId: entry.userId, teamName: entry.teamName, placement, wins: entry.wins, losses: entry.losses });
        }
    }
    const awarded = [];
    for (const trophy of toAward) {
        const existing = await db_1.db.query.seasonTrophies.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.seasonTrophies.userId, trophy.userId), (0, drizzle_orm_1.eq)(schema.seasonTrophies.season, season), (0, drizzle_orm_1.eq)(schema.seasonTrophies.placement, trophy.placement)),
        });
        if (!existing) {
            await db_1.db.insert(schema.seasonTrophies).values({
                userId: trophy.userId,
                season,
                sport: 'nfl',
                placement: trophy.placement,
                wins: trophy.wins,
                losses: trophy.losses,
            });
            awarded.push(trophy);
        }
    }
    return awarded;
}
//# sourceMappingURL=trophyService.js.map