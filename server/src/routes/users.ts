import { Router } from 'express';
import { db } from '../db';
import * as schema from '../db/schema';
import { sql, eq, and, desc, asc } from 'drizzle-orm';
import { requireAuth, optionalAuth, requireFirebaseToken } from '../middleware/auth';
import { getCurrentNFLSeason } from '../utils/season';
import { isWeekLocked } from '../utils/lockTime';

const router = Router();

// GET /api/users/me?season=X
router.get('/me', requireAuth, async (req, res) => {
  const user = req.currentUser!;
  const season = req.query['season'] ? parseInt(req.query['season'] as string, 10) : getCurrentNFLSeason();

  const stats = await getUserStats(user.id, season);
  res.json({ ...user, ...stats });
});

// PATCH /api/users/me
router.patch('/me', requireAuth, async (req, res) => {
  const { teamName, profileImageUrl } = req.body as { teamName?: string; profileImageUrl?: string };

  const updates: Partial<typeof schema.users.$inferInsert> = { updatedAt: new Date() };
  if (teamName?.trim()) updates.teamName = teamName.trim();
  if (profileImageUrl !== undefined) updates.profileImageUrl = profileImageUrl || null;

  const [updated] = await db.update(schema.users).set(updates).where(eq(schema.users.id, req.currentUser!.id)).returning();
  res.json(updated);
});

// POST /api/users — create user profile on first login
router.post('/', requireFirebaseToken, async (req, res) => {
  const { teamName, profileImageUrl } = req.body as { teamName?: string; profileImageUrl?: string };
  const uid = req.currentUser?.id ?? req.uid!;

  const existing = await db.query.users.findFirst({ where: eq(schema.users.id, uid) });
  if (existing) { res.json(existing); return; }

  const [newUser] = await db.insert(schema.users).values({
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

// GET /api/users/:id — other user profile (limited info + H2H vs viewer)
router.get('/:id', optionalAuth, async (req, res) => {
  const targetUser = await db.query.users.findFirst({ where: eq(schema.users.id, req.params['id'] as string) });
  if (!targetUser) { res.status(404).json({ error: 'User not found' }); return; }

  const season = getCurrentNFLSeason();
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

async function getUserStats(userId: string, season: number, opts?: { publicOnly?: boolean }) {
  // Season record
  const seasonResult = await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN p.is_correct = true  THEN 1 ELSE 0 END), 0)::integer AS wins,
      COALESCE(SUM(CASE WHEN p.is_correct = false THEN 1 ELSE 0 END), 0)::integer AS losses
    FROM picks p
    JOIN games g ON g.id = p.game_id
    WHERE p.user_id = ${userId} AND g.season = ${season} AND g.sport = 'nfl'
  `);
  const seasonRows = ((seasonResult as any).rows ?? seasonResult) as any[];
  const seasonRow = seasonRows[0] ?? { wins: 0, losses: 0 };

  // Week-by-week history
  const weekHistoryResult = await db.execute(sql`
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

  const history = ((weekHistoryResult as any).rows ?? weekHistoryResult) as any[];
  const bestWeek = history.reduce((best: any, row: any) => {
    return Number(row.wins) > Number(best?.wins ?? 0) ? row : best;
  }, null);

  // Trophy count
  const trophyResult = await db.execute(sql`
    SELECT COUNT(*)::integer AS count FROM trophies
    WHERE user_id = ${userId} AND season = ${season} AND sport = 'nfl'
  `);
  const trophyRows = ((trophyResult as any).rows ?? trophyResult) as any[];
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
    weeklyHistory: history.map((r: any) => ({ week: Number(r.week), wins: Number(r.wins), losses: Number(r.losses) })),
    h2h,
    insights,
  };
}

async function getFullH2H(userId: string, season: number) {
  const longies = await db.query.users.findMany({ where: eq(schema.users.isLongie, true) });

  const results = [];
  for (const opponent of longies) {
    if (opponent.id === userId) continue;
    const h2h = await calcH2H(userId, opponent.id, season);
    results.push({ opponentId: opponent.id, teamName: opponent.teamName, profileImageUrl: opponent.profileImageUrl, ...h2h });
  }
  return results;
}

// H2H for current week only, after lock — for other user profiles
async function getCurrentWeekH2H(viewerId: string, targetId: string, season: number) {
  // Find the most recent week with a lock that has passed
  const latestLockedGame = await db.query.games.findFirst({
    where: and(eq(schema.games.season, season), eq(schema.games.sport, 'nfl'), eq(schema.games.status, 'post')),
    orderBy: [desc(schema.games.week)],
  });
  if (!latestLockedGame) return null;

  const week = latestLockedGame.week;
  const locked = await isWeekLocked(week, season);
  if (!locked) return null;

  return calcH2H(viewerId, targetId, season, week);
}

async function calcH2H(userId1: string, userId2: string, season: number, week?: number) {
  const weekFilter = week != null ? sql` AND g.week = ${week}` : sql``;

  const result = await db.execute(sql`
    SELECT
      SUM(CASE WHEN p1.is_correct = true  AND p2.is_correct = false THEN 1 ELSE 0 END)::integer AS wins,
      SUM(CASE WHEN p1.is_correct = false AND p2.is_correct = true  THEN 1 ELSE 0 END)::integer AS losses,
      SUM(CASE WHEN p1.is_correct = p2.is_correct                   THEN 1 ELSE 0 END)::integer AS ties
    FROM picks p1
    JOIN picks p2 ON p2.game_id = p1.game_id AND p2.user_id = ${userId2}
    JOIN games g  ON g.id = p1.game_id AND g.season = ${season} AND g.sport = 'nfl'${weekFilter}
    WHERE p1.user_id = ${userId1}
  `);
  const h2hRows = ((result as any).rows ?? result) as any[];
  const row = h2hRows[0] ?? { wins: 0, losses: 0, ties: 0 };
  return { wins: Number(row.wins), losses: Number(row.losses), ties: Number(row.ties) };
}

async function getInsights(userId: string, season: number) {
  // Best/worst team pick rates
  const teamStatsResult = await db.execute(sql`
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
  const teams = ((teamStatsResult as any).rows ?? teamStatsResult) as any[];
  const makeTeamStat = (row: any) => row ? {
    team: row.team as string,
    wins: Number(row.correct),
    losses: Number(row.total) - Number(row.correct),
    accuracy: Math.round((Number(row.correct) / Number(row.total)) * 100),
  } : null;

  const bestTeam = makeTeamStat(teams[0]);
  const worstTeam = makeTeamStat(teams[teams.length - 1]);

  return { bestTeam, worstTeam };
}

export default router;
