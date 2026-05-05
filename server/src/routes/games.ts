import { Router } from 'express';
import { db } from '../db';
import * as schema from '../db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { isWeekLocked } from '../utils/lockTime';
import { getCurrentNFLSeason } from '../utils/season';

const router = Router();

// GET /api/games?week=X&season=Y
router.get('/', optionalAuth, async (req, res) => {
  const season = req.query['season'] ? parseInt(req.query['season'] as string, 10) : getCurrentNFLSeason();
  const week = req.query['week'] ? parseInt(req.query['week'] as string, 10) : undefined;

  const conditions = [eq(schema.games.season, season), eq(schema.games.sport, 'nfl')];
  if (week) conditions.push(eq(schema.games.week, week));

  const gameList = await db.query.games.findMany({
    where: and(...conditions),
    orderBy: [asc(schema.games.gameTime)],
  });

  // Attach viewer's own picks if authenticated
  let myPicksMap: Record<string, string> = {};
  if (req.currentUser && week) {
    const myPicks = await db.query.picks.findMany({
      where: and(eq(schema.picks.userId, req.currentUser.id), ...gameList.map(g => eq(schema.picks.gameId, g.id)).slice(0, 1)),
    });
    // Fetch all my picks for these games
    const allMyPicks = await db.query.picks.findMany({
      where: eq(schema.picks.userId, req.currentUser.id),
    });
    myPicksMap = Object.fromEntries(allMyPicks.filter(p => gameList.some(g => g.id === p.gameId)).map(p => [p.gameId, p.pick]));
  }

  res.json(gameList.map(game => ({
    ...game,
    myPick: myPicksMap[game.id] ?? null,
  })));
});

// GET /api/games/:id
router.get('/:id', optionalAuth, async (req, res) => {
  const game = await db.query.games.findFirst({
    where: eq(schema.games.id, req.params['id']!),
  });

  if (!game) { res.status(404).json({ error: 'Game not found' }); return; }

  const locked = await isWeekLocked(game.week, game.season);

  let pickBreakdown = null;
  if (locked) {
    const gamePicks = await db.query.picks.findMany({
      where: eq(schema.picks.gameId, game.id),
    });

    const userIds = [...new Set(gamePicks.map(p => p.userId))];
    const usersData = userIds.length
      ? await db.query.users.findMany({ where: and(...userIds.map(id => eq(schema.users.id, id)).slice(0, 1)) })
      : [];
    // Re-fetch users properly
    const allUsers = await db.query.users.findMany();
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
    const myPickRecord = await db.query.picks.findFirst({
      where: and(eq(schema.picks.userId, req.currentUser.id), eq(schema.picks.gameId, game.id)),
    });
    myPick = myPickRecord?.pick ?? null;
  }

  res.json({ ...game, pickBreakdown, myPick, isLocked: locked });
});

export default router;
