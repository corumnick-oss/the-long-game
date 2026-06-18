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
const lockTime_1 = require("../utils/lockTime");
const router = (0, express_1.Router)();
// GET /api/users/me?season=X
router.get('/me', auth_1.requireAuth, async (req, res) => {
    const user = req.currentUser;
    const season = req.query['season'] ? parseInt(req.query['season'], 10) : (0, season_1.getCurrentNFLSeason)();
    const stats = await getUserStats(user.id, season);
    res.json({ ...user, ...stats });
});
// PATCH /api/users/me
router.patch('/me', auth_1.requireAuth, async (req, res) => {
    const { teamName, profileImageUrl } = req.body;
    const updates = { updatedAt: new Date() };
    if (teamName?.trim())
        updates.teamName = teamName.trim();
    if (profileImageUrl !== undefined)
        updates.profileImageUrl = profileImageUrl || null;
    const [updated] = await db_1.db.update(schema.users).set(updates).where((0, drizzle_orm_1.eq)(schema.users.id, req.currentUser.id)).returning();
    res.json(updated);
});
// POST /api/users — create user profile on first login
router.post('/', auth_1.requireFirebaseToken, async (req, res) => {
    const { teamName, profileImageUrl } = req.body;
    const uid = req.currentUser?.id ?? req.uid;
    const existing = await db_1.db.query.users.findFirst({ where: (0, drizzle_orm_1.eq)(schema.users.id, uid) });
    if (existing) {
        res.json(existing);
        return;
    }
    const [newUser] = await db_1.db.insert(schema.users).values({
        id: uid,
        email: req.body.email ?? '',
        teamName: teamName?.trim() ?? 'New Player',
        isAdmin: false,
        isLongie: false,
        isPremium: false,
        nflAccess: true,
        profileImageUrl: profileImageUrl ?? null,
    }).returning();
    res.status(201).json(newUser);
});
// GET /api/users/:id?season=X — other user profile (limited info + H2H vs viewer)
router.get('/:id', auth_1.optionalAuth, async (req, res) => {
    const targetUser = await db_1.db.query.users.findFirst({ where: (0, drizzle_orm_1.eq)(schema.users.id, req.params['id']) });
    if (!targetUser) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    const season = req.query['season'] ? parseInt(req.query['season'], 10) : (0, season_1.getCurrentNFLSeason)();
    const stats = await getUserStats(targetUser.id, season, { publicOnly: true });
    // H2H vs viewer (current week only, after lock only)
    let h2hCurrentWeek = null;
    if (req.currentUser && req.currentUser.id !== targetUser.id) {
        h2hCurrentWeek = await getCurrentWeekH2H(req.currentUser.id, targetUser.id, season);
    }
    res.json({
        id: targetUser.id,
        teamName: targetUser.teamName,
        profileImageUrl: targetUser.profileImageUrl,
        isLongie: targetUser.isLongie,
        isPremium: targetUser.isPremium,
        createdAt: targetUser.createdAt,
        ...stats,
        h2hCurrentWeek,
    });
});
async function getUserStats(userId, season, opts) {
    // Season record
    const seasonResult = await db_1.db.execute((0, drizzle_orm_1.sql) `
    SELECT
      COALESCE(SUM(CASE WHEN p.is_correct = true  THEN 1 ELSE 0 END), 0)::integer AS wins,
      COALESCE(SUM(CASE WHEN p.is_correct = false THEN 1 ELSE 0 END), 0)::integer AS losses
    FROM picks p
    JOIN games g ON g.id = p.game_id
    WHERE p.user_id = ${userId} AND g.season = ${season} AND g.sport = 'nfl'
  `);
    const seasonRows = (seasonResult.rows ?? seasonResult);
    const seasonRow = seasonRows[0] ?? { wins: 0, losses: 0 };
    // Week-by-week history
    const weekHistoryResult = await db_1.db.execute((0, drizzle_orm_1.sql) `
    SELECT
      g.week,
      COALESCE(SUM(CASE WHEN p.is_correct = true  THEN 1 ELSE 0 END), 0)::integer AS wins,
      COALESCE(SUM(CASE WHEN p.is_correct = false THEN 1 ELSE 0 END), 0)::integer AS losses
    FROM picks p
    JOIN games g ON g.id = p.game_id
    WHERE p.user_id = ${userId} AND g.season = ${season} AND g.sport = 'nfl'
    GROUP BY g.week
    ORDER BY g.week ASC
  `);
    const history = (weekHistoryResult.rows ?? weekHistoryResult);
    const bestWeek = history.reduce((best, row) => {
        return Number(row.wins) > Number(best?.wins ?? 0) ? row : best;
    }, null);
    // Trophy count
    const trophyResult = await db_1.db.execute((0, drizzle_orm_1.sql) `
    SELECT COUNT(*)::integer AS count FROM trophies
    WHERE user_id = ${userId} AND season = ${season} AND sport = 'nfl'
  `);
    const trophyRows = (trophyResult.rows ?? trophyResult);
    const trophyCount = Number(trophyRows[0]?.count ?? 0);
    // H2H vs all Longies (own profile only)
    let h2h = null;
    if (!opts?.publicOnly) {
        h2h = await getFullH2H(userId, season);
    }
    // Auto insights
    const insights = await getInsights(userId, season);
    const wins = Number(seasonRow.wins);
    const losses = Number(seasonRow.losses);
    return {
        seasonRecord: { wins, losses },
        accuracy: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 1000) / 10 : 0,
        bestWeek: bestWeek ? { week: Number(bestWeek.week), wins: Number(bestWeek.wins) } : null,
        trophyCount,
        weeklyHistory: history.map((r) => ({ week: Number(r.week), wins: Number(r.wins), losses: Number(r.losses) })),
        h2h,
        insights,
    };
}
async function getFullH2H(userId, season) {
    const longies = await db_1.db.query.users.findMany({ where: (0, drizzle_orm_1.eq)(schema.users.isLongie, true) });
    const results = [];
    for (const opponent of longies) {
        if (opponent.id === userId)
            continue;
        const h2h = await calcH2H(userId, opponent.id, season);
        results.push({ opponentId: opponent.id, teamName: opponent.teamName, profileImageUrl: opponent.profileImageUrl, ...h2h });
    }
    return results;
}
// H2H for current week only, after lock — for other user profiles
async function getCurrentWeekH2H(viewerId, targetId, season) {
    // Find the most recent week with a lock that has passed
    const latestLockedGame = await db_1.db.query.games.findFirst({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.games.season, season), (0, drizzle_orm_1.eq)(schema.games.sport, 'nfl'), (0, drizzle_orm_1.eq)(schema.games.status, 'post')),
        orderBy: [(0, drizzle_orm_1.desc)(schema.games.week)],
    });
    if (!latestLockedGame)
        return null;
    const week = latestLockedGame.week;
    const locked = await (0, lockTime_1.isWeekLocked)(week, season);
    if (!locked)
        return null;
    return calcH2H(viewerId, targetId, season, week);
}
async function calcH2H(userId1, userId2, season, week) {
    const weekFilter = week != null ? (0, drizzle_orm_1.sql) ` AND g.week = ${week}` : (0, drizzle_orm_1.sql) ``;
    const result = await db_1.db.execute((0, drizzle_orm_1.sql) `
    SELECT
      SUM(CASE WHEN p1.is_correct = true  AND p2.is_correct = false THEN 1 ELSE 0 END)::integer AS wins,
      SUM(CASE WHEN p1.is_correct = false AND p2.is_correct = true  THEN 1 ELSE 0 END)::integer AS losses,
      SUM(CASE WHEN p1.is_correct = p2.is_correct                   THEN 1 ELSE 0 END)::integer AS ties
    FROM picks p1
    JOIN picks p2 ON p2.game_id = p1.game_id AND p2.user_id = ${userId2}
    JOIN games g  ON g.id = p1.game_id AND g.season = ${season} AND g.sport = 'nfl'${weekFilter}
    WHERE p1.user_id = ${userId1}
  `);
    const h2hRows = (result.rows ?? result);
    const row = h2hRows[0] ?? { wins: 0, losses: 0, ties: 0 };
    return { wins: Number(row.wins), losses: Number(row.losses), ties: Number(row.ties) };
}
async function getInsights(userId, season) {
    // Best/worst team pick rates
    const teamStatsResult = await db_1.db.execute((0, drizzle_orm_1.sql) `
    SELECT
      CASE WHEN p.pick = 'home' THEN g.home_team ELSE g.away_team END AS team,
      COUNT(*)::integer AS total,
      SUM(CASE WHEN p.is_correct = true THEN 1 ELSE 0 END)::integer AS correct
    FROM picks p
    JOIN games g ON g.id = p.game_id
    WHERE p.user_id = ${userId} AND g.season = ${season} AND g.sport = 'nfl' AND g.status = 'post' AND p.is_correct IS NOT NULL
    GROUP BY team
    HAVING COUNT(*) >= 3
    ORDER BY (SUM(CASE WHEN p.is_correct = true THEN 1 ELSE 0 END)::float / COUNT(*)) DESC
  `);
    const teams = (teamStatsResult.rows ?? teamStatsResult);
    const makeTeamStat = (row) => row ? {
        team: row.team,
        wins: Number(row.correct),
        losses: Number(row.total) - Number(row.correct),
        accuracy: Math.round((Number(row.correct) / Number(row.total)) * 100),
    } : null;
    const bestTeam = makeTeamStat(teams[0]);
    const worstTeam = makeTeamStat(teams[teams.length - 1]);
    return { bestTeam, worstTeam };
}
exports.default = router;
//# sourceMappingURL=users.js.map