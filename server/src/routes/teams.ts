import { Router } from 'express';
import { db } from '../db';
import * as schema from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { optionalAuth } from '../middleware/auth';
import { getCurrentNFLSeason } from '../utils/season';

// 2025 games stored team names as ESPN abbreviations; 2026+ store full names.
const NFL_FULL_TO_ABBREV: Record<string, string> = {
  'Arizona Cardinals': 'ARI', 'Atlanta Falcons': 'ATL', 'Baltimore Ravens': 'BAL',
  'Buffalo Bills': 'BUF', 'Carolina Panthers': 'CAR', 'Chicago Bears': 'CHI',
  'Cincinnati Bengals': 'CIN', 'Cleveland Browns': 'CLE', 'Dallas Cowboys': 'DAL',
  'Denver Broncos': 'DEN', 'Detroit Lions': 'DET', 'Green Bay Packers': 'GB',
  'Houston Texans': 'HOU', 'Indianapolis Colts': 'IND', 'Jacksonville Jaguars': 'JAX',
  'Kansas City Chiefs': 'KC', 'Las Vegas Raiders': 'LV', 'Los Angeles Chargers': 'LAC',
  'Los Angeles Rams': 'LAR', 'Miami Dolphins': 'MIA', 'Minnesota Vikings': 'MIN',
  'New England Patriots': 'NE', 'New Orleans Saints': 'NO', 'New York Giants': 'NYG',
  'New York Jets': 'NYJ', 'Philadelphia Eagles': 'PHI', 'Pittsburgh Steelers': 'PIT',
  'San Francisco 49ers': 'SF', 'Seattle Seahawks': 'SEA', 'Tampa Bay Buccaneers': 'TB',
  'Tennessee Titans': 'TEN', 'Washington Commanders': 'WSH',
};
const NFL_ABBREV_TO_FULL = Object.fromEntries(Object.entries(NFL_FULL_TO_ABBREV).map(([k, v]) => [v, k]));

function translateTeamName(name: string): string | null {
  return NFL_FULL_TO_ABBREV[name] ?? NFL_ABBREV_TO_FULL[name] ?? null;
}

const avgOf = (nums: (number | null | undefined)[]): number | null => {
  const valid = nums.filter((v): v is number => v != null && typeof v === 'number' && !isNaN(v));
  return valid.length ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10 : null;
};

const router = Router();

async function buildTeamStats(season: number, seasonType: string = 'regular') {
  const allGames = await db.query.games.findMany({
    where: and(eq(schema.games.season, season), eq(schema.games.sport, 'nfl'), eq(schema.games.seasonType, seasonType)),
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
  const seasonType = (req.query['seasonType'] as string) ?? 'regular';
  const teams = await buildTeamStats(season, seasonType);
  teams.sort((a, b) => b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name));
  res.json(teams);
});

// GET /api/teams/:name?season=X — team detail with recent games
router.get('/:name', optionalAuth, async (req, res) => {
  const season = req.query['season'] ? parseInt(req.query['season'] as string, 10) : getCurrentNFLSeason();
  const seasonType = (req.query['seasonType'] as string) ?? 'regular';
  const teamName = decodeURIComponent(req.params['name'] as string);

  const allGames = await db.query.games.findMany({
    where: and(eq(schema.games.season, season), eq(schema.games.sport, 'nfl'), eq(schema.games.seasonType, seasonType)),
  });

  let resolvedName = teamName;
  let teamGames = allGames.filter(
    g => g.homeTeam === teamName || g.awayTeam === teamName,
  );

  // 2025 uses abbreviations, 2026+ uses full names — translate and retry if no match.
  if (teamGames.length === 0) {
    const alt = translateTeamName(teamName);
    if (alt) {
      const altGames = allGames.filter(g => g.homeTeam === alt || g.awayTeam === alt);
      if (altGames.length > 0) {
        resolvedName = alt;
        teamGames = altGames;
      }
    }
  }

  teamGames = teamGames.sort((a, b) => {
    const at = a.gameTime ? new Date(a.gameTime).getTime() : 0;
    const bt = b.gameTime ? new Date(b.gameTime).getTime() : 0;
    return bt - at;
  });

  if (!teamGames.length) { res.status(404).json({ error: 'Team not found' }); return; }

  let wins = 0, losses = 0;
  const pointsScored: number[] = [];
  const pointsAllowed: number[] = [];

  const recentGames = teamGames.filter(g => g.status === 'post').slice(0, 5).map(game => {
    const isHome = game.homeTeam === resolvedName;
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
    const isHome = game.homeTeam === resolvedName;
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
      if (pickedTeam !== resolvedName) continue;
      if (pick.isCorrect) pickWins++; else pickLosses++;
    }
  }

  const avg = (arr: number[]) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;
  const logo = teamGames[0]?.homeTeam === resolvedName ? teamGames[0].homeTeamLogo : teamGames[0]?.awayTeamLogo;

  // Team stats from team_game_stats — use abbrev for 2025 data, full name for 2026+
  const statsName = NFL_FULL_TO_ABBREV[resolvedName] ?? resolvedName;
  let statsRows = await db.query.teamGameStats.findMany({
    where: and(
      eq(schema.teamGameStats.teamName, statsName),
      eq(schema.teamGameStats.season, season),
      eq(schema.teamGameStats.sport, 'nfl'),
    ),
  });
  let statsSeasonUsed: number | null = null;
  let filteredStats = statsRows.filter(r => (r.additionalStats as any)?.seasonType === seasonType);

  if (filteredStats.length === 0 && season > 2025) {
    statsRows = await db.query.teamGameStats.findMany({
      where: and(
        eq(schema.teamGameStats.teamName, statsName),
        eq(schema.teamGameStats.season, 2025),
        eq(schema.teamGameStats.sport, 'nfl'),
      ),
    });
    filteredStats = statsRows.filter(r => (r.additionalStats as any)?.seasonType === 'regular');
    if (filteredStats.length > 0) statsSeasonUsed = 2025;
  } else if (filteredStats.length > 0) {
    statsSeasonUsed = season;
  }

  // Fall back to 2025 game averages for PPG if no completed games in current season
  let ppgOut = avg(pointsScored);
  let ppgAllowedOut = avg(pointsAllowed);
  if (ppgOut === null && season > 2025) {
    const games2025 = await db.query.games.findMany({
      where: and(
        eq(schema.games.season, 2025),
        eq(schema.games.sport, 'nfl'),
        eq(schema.games.seasonType, 'regular'),
      ),
    });
    const scored2025: number[] = [];
    const allowed2025: number[] = [];
    for (const g of games2025) {
      if (g.status !== 'post' || g.homeScore === null || g.awayScore === null) continue;
      if (g.homeTeam === statsName) { scored2025.push(g.homeScore); allowed2025.push(g.awayScore); }
      else if (g.awayTeam === statsName) { scored2025.push(g.awayScore); allowed2025.push(g.homeScore); }
    }
    if (scored2025.length > 0) {
      ppgOut = avg(scored2025);
      ppgAllowedOut = avg(allowed2025);
      if (statsSeasonUsed === null) statsSeasonUsed = 2025;
    }
  }

  res.json({
    name: NFL_ABBREV_TO_FULL[resolvedName] ?? resolvedName,
    logo: logo ?? null,
    wins,
    losses,
    ppg: ppgOut,
    ppgAllowed: ppgAllowedOut,
    ypg:          avgOf(filteredStats.map(r => r.yardsPerGame)),
    yapg:         avgOf(filteredStats.map(r => r.yardsAllowedPerGame)),
    passYpg:      avgOf(filteredStats.map(r => (r.additionalStats as any)?.passingYards)),
    rushYpg:      avgOf(filteredStats.map(r => (r.additionalStats as any)?.rushingYards)),
    thirdDownPct: avgOf(filteredStats.map(r => r.thirdDownConversion)),
    redZonePct:   avgOf(filteredStats.map(r => r.redZoneEfficiency)),
    sacksPG:      avgOf(filteredStats.map(r => r.sackRate)),
    turnoversPG:  avgOf(filteredStats.map(r => (r.additionalStats as any)?.turnovers)),
    statsSeasonUsed,
    pickWins,
    pickLosses,
    pickTotal: pickWins + pickLosses,
    pickAccuracy: pickWins + pickLosses > 0 ? Math.round((pickWins / (pickWins + pickLosses)) * 100) : null,
    recentGames,
  });
});

export default router;
