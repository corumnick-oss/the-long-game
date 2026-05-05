import { Router } from 'express';
import { db } from '../db';
import * as schema from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { getCurrentNFLSeason } from '../utils/season';
import { isWeekLocked } from '../utils/lockTime';

const router = Router();

// GET /api/tiebreaker?week=X&season=Y
router.get('/', requireAuth, async (req, res) => {
  const season = req.query['season'] ? parseInt(req.query['season'] as string, 10) : getCurrentNFLSeason();
  const week = req.query['week'] ? parseInt(req.query['week'] as string, 10) : undefined;

  const conditions = [eq(schema.tiebreakerGames.season, season)];
  if (week) conditions.push(eq(schema.tiebreakerGames.week, week));

  const tbGame = await db.query.tiebreakerGames.findFirst({ where: and(...conditions) });
  if (!tbGame) { res.json(null); return; }

  const game = await db.query.games.findFirst({ where: eq(schema.games.id, tbGame.gameId) });

  // Get viewer's pick
  const myPick = await db.query.tiebreakerPicks.findFirst({
    where: and(eq(schema.tiebreakerPicks.userId, req.currentUser!.id), eq(schema.tiebreakerPicks.tiebreakerGameId, tbGame.id)),
  });

  // After lock, show all Longie picks
  const locked = await isWeekLocked(tbGame.week, season);
  let allPicks = null;
  if (locked) {
    allPicks = await db.query.tiebreakerPicks.findMany({
      where: eq(schema.tiebreakerPicks.tiebreakerGameId, tbGame.id),
    });
  }

  res.json({ tiebreakerGame: tbGame, game, myPick, allPicks, isLocked: locked });
});

// POST /api/tiebreaker — submit or update
router.post('/', requireAuth, async (req, res) => {
  const { tiebreakerGameId, predictedTotal } = req.body as { tiebreakerGameId: string; predictedTotal: number };

  if (!tiebreakerGameId || predictedTotal == null) {
    res.status(400).json({ error: 'tiebreakerGameId and predictedTotal required' });
    return;
  }

  const tbGame = await db.query.tiebreakerGames.findFirst({ where: eq(schema.tiebreakerGames.id, tiebreakerGameId) });
  if (!tbGame) { res.status(404).json({ error: 'Tiebreaker game not found' }); return; }

  const locked = await isWeekLocked(tbGame.week, tbGame.season);
  if (locked) { res.status(403).json({ error: 'Picks are locked' }); return; }

  const existing = await db.query.tiebreakerPicks.findFirst({
    where: and(eq(schema.tiebreakerPicks.userId, req.currentUser!.id), eq(schema.tiebreakerPicks.tiebreakerGameId, tiebreakerGameId)),
  });

  if (existing) {
    const [updated] = await db.update(schema.tiebreakerPicks).set({ predictedTotal, updatedAt: new Date() }).where(eq(schema.tiebreakerPicks.id, existing.id)).returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(schema.tiebreakerPicks).values({
      userId: req.currentUser!.id,
      tiebreakerGameId,
      season: tbGame.season,
      predictedTotal,
    }).returning();
    res.status(201).json(created);
  }
});

export default router;
