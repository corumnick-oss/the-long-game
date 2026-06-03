import { Router } from 'express';
import { db } from '../db';
import * as schema from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { optionalAuth } from '../middleware/auth';
import { getCurrentNFLSeason } from '../utils/season';

const router = Router();

async function buildTeamStats(season: number) {
  const allGames = await db.query.games.findMany({
    where: and(eq(schema.games.season, season), eq(schema.games.sport, 'nfl')),
  });

  type TeamData = {
    name: string;
    logo: string | null;
    wins: number;
    losses: number;
    pointsScored: number[];
    pointsAllowed: number[];
    pickWins: number;
    pickLosses: number;
  };

  const teams: Record<string, TeamData> = {};

  const ensure = (name: string, logo: string | null | undefined) => {
    if (!teams[name]) {
      teams[name] = { name, logo: logo ?? null, wins: 0, losses: 0, pointsScored: [], pointsAllowed: [], pickWins: 0, pickLosses: 0 };
    }
  };

  for (const game of allGames) {
    ensure(game.homeTeam, game.homeTeamLogo);
    ensure(game.awayTeam, game.awayTeamLogo);
    if (game.status !== 'post' || game.homeScore === null || game.awayScore === null) continue;
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
    const allPicks = await db.query.picks.findMany({
      where: inArray(schema.picks.gameId, finishedGameIds),
    });
    const gameMap = Object.fromEntries(allGames.map(g => [g.id, g]));
    for (const pick of allPicks) {
      if (pick.isCorrect === null) continue;
      const game = gameMap[pick.gameId];
      if (!game) continue;
      const teamName = pick.pick === 'home' ? game.homeTeam : game.awayTeam;
      if (!teams[teamName]) continue;
      if (pick.isCorrect) teams[teamName].pickWins++;
      else teams[teamName].pickLosses++;
    }
  }

  const avg = (arr: number[]) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;

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
router.get('/', optionalAuth, async (req, res) => {
  const season = req.query['season'] ? parseInt(req.query['season'] as string, 10) : getCurrentNFLSeason();
  const teams = await buildTeamStats(season);
  teams.sort((a, b) => b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name));
  res.json(teams);
});

// GET /api/teams/:name?season=X — team detail with recent games
router.get('/:name', optionalAuth, async (req, res) => {
  const season = req.query['season'] ? parseInt(req.query['season'] as string, 10) : getCurrentNFLSeason();
  const teamName = decodeURIComponent(req.params['name'] as string);

  const allGames = await db.query.games.findMany({
    where: and(eq(schema.games.season, season), eq(schema.games.sport, 'nfl')),
  });

  const teamGames = allGames.filter(
    g => g.homeTeam === teamName || g.awayTeam === teamName,
  ).sort((a, b) => {
    const at = a.gameTime ? new Date(a.gameTime).getTime() : 0;
    const bt = b.gameTime ? new Date(b.gameTime).getTime() : 0;
    return bt - at;
  });

  if (!teamGames.length) { res.status(404).json({ error: 'Team not found' }); return; }

  let wins = 0, losses = 0;
  const pointsScored: number[] = [];
  const pointsAllowed: number[] = [];

  const recentGames = teamGames.slice(0, 10).map(game => {
    const isHome = game.homeTeam === teamName;
    const opponent = isHome ? game.awayTeam : game.homeTeam;
    const opponentLogo = isHome ? game.awayTeamLogo : game.homeTeamLogo;
    const myScore = isHome ? game.homeScore : game.awayScore;
    const theirScore = isHome ? game.awayScore : game.homeScore;
    let result: 'W' | 'L' | null = null;
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
    if (game.status !== 'post' || game.homeScore === null || game.awayScore === null) continue;
    const isHome = game.homeTeam === teamName;
    const myScore = isHome ? game.homeScore : game.awayScore;
    const theirScore = isHome ? game.awayScore : game.homeScore;
    if (myScore > theirScore) wins++; else losses++;
    pointsScored.push(myScore);
    pointsAllowed.push(theirScore);
  }

  // Pick W-L for this team across all users
  const gameIds = teamGames.map(g => g.id);
  let pickWins = 0, pickLosses = 0;
  if (gameIds.length > 0) {
    const gamePicks = await db.query.picks.findMany({
      where: inArray(schema.picks.gameId, gameIds),
    });
    const gameMap = Object.fromEntries(teamGames.map(g => [g.id, g]));
    for (const pick of gamePicks) {
      if (pick.isCorrect === null) continue;
      const game = gameMap[pick.gameId];
      if (!game) continue;
      const pickedTeam = pick.pick === 'home' ? game.homeTeam : game.awayTeam;
      if (pickedTeam !== teamName) continue;
      if (pick.isCorrect) pickWins++; else pickLosses++;
    }
  }

  const avg = (arr: number[]) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;
  const logo = teamGames[0]?.homeTeam === teamName ? teamGames[0].homeTeamLogo : teamGames[0]?.awayTeamLogo;

  res.json({
    name: teamName,
    logo: logo ?? null,
    wins,
    losses,
    ppg: avg(pointsScored),
    ppgAllowed: avg(pointsAllowed),
    pickWins,
    pickLosses,
    pickTotal: pickWins + pickLosses,
    pickAccuracy: pickWins + pickLosses > 0 ? Math.round((pickWins / (pickWins + pickLosses)) * 100) : null,
    recentGames,
  });
});

export default router;
