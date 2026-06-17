import { Router } from 'express';
import { db } from '../db';
import * as schema from '../db/schema';
import { eq, and, inArray, asc } from 'drizzle-orm';
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
  const seasonType = (req.query['seasonType'] as string) ?? 'regular';

  if (!week) { res.status(400).json({ error: 'week is required' }); return; }

  const locked = await isWeekLocked(week, season);

  const weekGames = await db.query.games.findMany({
    where: and(eq(schema.games.week, week), eq(schema.games.season, season), eq(schema.games.sport, 'nfl'), eq(schema.games.seasonType, seasonType)),
    orderBy: [asc(schema.games.gameTime)],
  });

  if (!locked) {
    res.json({ locked: false, week, season, games: weekGames.map(g => ({
      id: g.id, homeTeam: g.homeTeam, awayTeam: g.awayTeam,
      homeTeamLogo: g.homeTeamLogo, awayTeamLogo: g.awayTeamLogo,
      homeScore: g.homeScore, awayScore: g.awayScore, status: g.status,
    })), users: [], picksByUser: {} });
    return;
  }

  const gameIds = weekGames.map(g => g.id);

  const [longies, allPicks] = await Promise.all([
    db.query.users.findMany({ where: eq(schema.users.isLongie, true) }),
    gameIds.length
      ? db.query.picks.findMany({ where: inArray(schema.picks.gameId, gameIds) })
      : Promise.resolve([]),
  ]);

  // picksByUser[userId][gameId] = { pick, isCorrect }
  const picksByUser: Record<string, Record<string, { pick: string; isCorrect: boolean | null }>> = {};
  for (const p of allPicks) {
    if (!picksByUser[p.userId]) picksByUser[p.userId] = {};
    picksByUser[p.userId][p.gameId] = { pick: p.pick, isCorrect: p.isCorrect ?? null };
  }

  res.json({
    locked: true,
    week,
    season,
    games: weekGames.map(g => ({
      id: g.id,
      homeTeam: g.homeTeam,
      awayTeam: g.awayTeam,
      homeTeamLogo: g.homeTeamLogo,
      awayTeamLogo: g.awayTeamLogo,
      homeScore: g.homeScore,
      awayScore: g.awayScore,
      status: g.status,
    })),
    users: longies.map(u => ({
      id: u.id,
      teamName: u.teamName,
      profileImageUrl: u.profileImageUrl,
    })),
    picksByUser,
  });
});

// GET /api/picks/by-team?season=X  — caller's W-L record grouped by team picked
router.get('/by-team', requireAuth, async (req, res) => {
  const season = req.query['season'] ? parseInt(req.query['season'] as string, 10) : getCurrentNFLSeason();

  const seasonGames = await db.query.games.findMany({
    where: and(eq(schema.games.season, season), eq(schema.games.sport, 'nfl')),
  });
  if (!seasonGames.length) { res.json([]); return; }

  const gameIds = seasonGames.map(g => g.id);
  const userPicks = await db.query.picks.findMany({
    where: and(
      eq(schema.picks.userId, req.currentUser!.id),
      inArray(schema.picks.gameId, gameIds),
    ),
  });

  const gamesMap = Object.fromEntries(seasonGames.map(g => [g.id, g]));
  const byTeam: Record<string, { wins: number; losses: number; logo: string | null }> = {};

  for (const pick of userPicks) {
    if (pick.isCorrect === null) continue; // unsettled game
    const game = gamesMap[pick.gameId];
    if (!game) continue;
    const teamName = pick.pick === 'home' ? game.homeTeam : game.awayTeam;
    const logo = pick.pick === 'home' ? game.homeTeamLogo : game.awayTeamLogo;
    if (!byTeam[teamName]) byTeam[teamName] = { wins: 0, losses: 0, logo: logo ?? null };
    if (pick.isCorrect) byTeam[teamName].wins++;
    else byTeam[teamName].losses++;
  }

  const result = Object.entries(byTeam).map(([team, stats]) => ({
    team,
    wins: stats.wins,
    losses: stats.losses,
    logo: stats.logo,
    total: stats.wins + stats.losses,
    accuracy: stats.wins + stats.losses > 0
      ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100)
      : 0,
  })).sort((a, b) => b.total - a.total);

  res.json(result);
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

  const unlocked = await db.query.unlockedWeeks.findFirst({
    where: and(
      eq(schema.unlockedWeeks.week, game.week),
      eq(schema.unlockedWeeks.season, game.season),
      eq(schema.unlockedWeeks.seasonType, game.seasonType),
    ),
  });
  if (!unlocked) { res.status(403).json({ error: 'Picks not yet open for this week' }); return; }

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
  const pick = await db.query.picks.findFirst({ where: eq(schema.picks.id, req.params['id'] as string) });

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
