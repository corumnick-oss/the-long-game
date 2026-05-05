import { Router } from 'express';
import { db } from '../db';
import * as schema from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { optionalAuth } from '../middleware/auth';
import { getCurrentNFLSeason } from '../utils/season';

const router = Router();

// GET /api/trophies?userId=X&season=Y&week=X
router.get('/', optionalAuth, async (req, res) => {
  const season = req.query['season'] ? parseInt(req.query['season'] as string, 10) : getCurrentNFLSeason();
  const userId = req.query['userId'] as string | undefined;
  const week = req.query['week'] ? parseInt(req.query['week'] as string, 10) : undefined;

  const conditions = [eq(schema.trophies.season, season), eq(schema.trophies.sport, 'nfl')];
  if (userId) conditions.push(eq(schema.trophies.userId, userId));
  if (week) conditions.push(eq(schema.trophies.week, week));

  const result = await db.query.trophies.findMany({
    where: and(...conditions),
    orderBy: [desc(schema.trophies.earnedAt)],
  });

  res.json(result);
});

export default router;
