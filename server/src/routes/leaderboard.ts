import { Router } from 'express';
import { db } from '../db';
import * as schema from '../db/schema';
import { sql, eq, and } from 'drizzle-orm';
import { optionalAuth } from '../middleware/auth';
import { getCurrentNFLSeason } from '../utils/season';

const router = Router();

// GET /api/leaderboard?type=season|weekly&week=X&season=Y&filter=gridirons|global
router.get('/', optionalAuth, async (req, res) => {
  const season = req.query['season'] ? parseInt(req.query['season'] as string, 10) : getCurrentNFLSeason();
  const type = (req.query['type'] as string) ?? 'season';
  const week = req.query['week'] ? parseInt(req.query['week'] as string, 10) : undefined;
  const filter = (req.query['filter'] as string) ?? (req.currentUser?.isGridiron ? 'gridirons' : 'global');
  const seasonType = (req.query['seasonType'] as string) ?? 'regular';

  const isWeekly = type === 'weekly' && week != null;
  const gridironsOnly = filter === 'gridirons';

  const gameFilter = isWeekly
    ? sql`g.season = ${season} AND g.week = ${week} AND g.sport = 'nfl' AND g.season_type = ${seasonType}`
    : sql`g.season = ${season} AND g.sport = 'nfl' AND g.season_type = ${seasonType}`;

  const userFilter = gridironsOnly ? sql`u.is_gridiron = true` : sql`u.nfl_access = true`;

  // Join order: users → games (filtered) → picks
  // This ensures is_correct counts only apply to the filtered game set
  const result = await db.execute(sql`
    SELECT
      u.id                  AS user_id,
      u.team_name,
      u.profile_image_url,
      u.is_gridiron,
      u.is_premium,
      u.is_admin,
      COALESCE(CAST(COUNT(CASE WHEN p.is_correct = true  THEN 1 END) AS INTEGER), 0) AS wins,
      COALESCE(CAST(COUNT(CASE WHEN p.is_correct = false THEN 1 END) AS INTEGER), 0) AS losses,
      COALESCE(CAST((
        SELECT COUNT(*) FROM trophies t
        WHERE t.user_id = u.id AND t.season = ${season} AND t.sport = 'nfl'
      ) AS INTEGER), 0) AS trophy_count
    FROM users u
    LEFT JOIN games g ON ${gameFilter}
    LEFT JOIN picks p ON p.user_id = u.id AND p.game_id = g.id
    WHERE ${userFilter}
    GROUP BY u.id, u.team_name, u.profile_image_url, u.is_gridiron, u.is_premium, u.is_admin
    HAVING COUNT(p.id) > 0
    ORDER BY wins DESC, losses ASC
  `);

  const rows = (result as any).rows ?? result;
  const viewerId = req.currentUser?.id;

  // Add rank + picks different from viewer
  const entries = (rows as any[]).map((row: any, idx: number) => {
    const wins = Number(row.wins);
    const losses = Number(row.losses);
    return {
      rank: idx + 1,
      userId: row.user_id as string,
      teamName: row.team_name as string,
      profileImageUrl: row.profile_image_url as string | null,
      isGridiron: row.is_gridiron as boolean,
      isPremium: row.is_premium as boolean,
      wins,
      losses,
      accuracy: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 1000) / 10 : 0,
      trophyCount: Number(row.trophy_count),
      isCurrentUser: row.user_id === viewerId,
    };
  });

  res.json({ type, week, season, filter, entries });
});

export default router;
