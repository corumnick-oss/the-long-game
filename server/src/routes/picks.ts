import { Router } from 'express';
import { db } from '../db';
import * as schema from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { isWeekLocked } from '../utils/lockTime';
import { getCurrentNFLSeason } from '../utils/season';

const router = Router();

// GET /api/picks?week=X&season=Y  — always returns only the requesting user's own picks
router.get('/', requireAuth, async (req, res) => {
  const season = req.query['season'] ? parseInt(req.query['season'] as string, 10) : getCurrentNFLSeason();
  const week = req.query['week'] ? parseInt(req.query['week'] as string, 10) : undefined;

  let gameIds: string[] | undefined;
  if (week) {
    const weekGames = await db.query.games.findMany({
      where: and(eq(schema.games.week, week), eq(schema.games.season, season), eq(schema.games.sport, 'nfl')),
    });
    gameIds = weekGames.map(g => g.id);
  }

  const conditions = [eq(schema.picks.userId, req.currentUser!.id)];
  if (gameIds?.length) conditions.push(inArray(schema.picks.gameId, gameIds));

  const myPicks = await db.query.picks.findMany({ where: and(...conditions) });
  res.json(myPicks);
});

// GET /api/picks/week — full grid of all Longie picks (only after lock)
router.get('/week', requireAuth, async (req, res) => {
  const season = req.query['season'] ? parseInt(req.query['season'] as string, 10) : getCurrentNFLSeason();
  const week = parseInt(req.query['week'] as string, 10);

  if (!week) { res.status(400).json({ error: 'week is required' }); return; }

  const locked = await isWeekLocked(week, season);
  if (!locked) {
    res.json({ locked: false, picks: [] });
    return;
  }

  const weekGames = await db.query.games.findMany({
    where: and(eq(schema.games.week, week), eq(schema.games.season, season), eq(schema.games.sport, 'nfl')),
  });
  const gameIds = weekGames.map(g => g.id);
  if (!gameIds.length) { res.json({ locked: true, picks: [] }); return; }

  const allPicks = await db.query.picks.findMany({
    where: inArray(schema.picks.gameId, gameIds),
  });

  res.json({ locked: true, picks: allPicks });
});

// POST /api/picks  — submit or update a pick (before lock)
router.post('/', requireAuth, async (req, res) => {
  const { gameId, pick } = req.body as { gameId: string; pick: 'home' | 'away' };

  if (!gameId || !pick || !['home', 'away'].includes(pick)) {
    res.status(400).json({ error: 'gameId and pick (home|away) are required' });
    return;
  }

  const game = await db.query.games.findFirst({ where: eq(schema.games.id, gameId) });
  if (!game) { res.status(404).json({ error: 'Game not found' }); return; }

  const locked = await isWeekLocked(game.week, game.season);
  if (locked) { res.status(403).json({ error: 'Picks are locked for this week' }); return; }

  // Upsert — user can change pick before lock
  const existing = await db.query.picks.findFirst({
    where: and(eq(schema.picks.userId, req.currentUser!.id), eq(schema.picks.gameId, gameId)),
  });

  if (existing) {
    await db.update(schema.picks).set({ pick }).where(eq(schema.picks.id, existing.id));
    res.json({ ...existing, pick });
  } else {
    const [newPick] = await db.insert(schema.picks).values({
      userId: req.currentUser!.id,
      gameId,
      pick,
      pickWinProbability: game.winningTeamWinProb,
    }).returning();
    res.status(201).json(newPick);
  }
});

// DELETE /api/picks/:id — remove a pick before lock
router.delete('/:id', requireAuth, async (req, res) => {
  const pick = await db.query.picks.findFirst({ where: eq(schema.picks.id, req.params['id']!) });

  if (!pick) { res.status(404).json({ error: 'Pick not found' }); return; }
  if (pick.userId !== req.currentUser!.id) { res.status(403).json({ error: 'Not your pick' }); return; }

  const game = await db.query.games.findFirst({ where: eq(schema.games.id, pick.gameId) });
  if (!game) { res.status(404).json({ error: 'Game not found' }); return; }

  const locked = await isWeekLocked(game.week, game.season);
  if (locked) { res.status(403).json({ error: 'Picks are locked' }); return; }

  await db.delete(schema.picks).where(eq(schema.picks.id, pick.id));
  res.status(204).send();
});

export default router;
