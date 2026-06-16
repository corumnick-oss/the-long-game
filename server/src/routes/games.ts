import { Router } from 'express';
import { db } from '../db';
import * as schema from '../db/schema';
import { eq, and, asc, inArray } from 'drizzle-orm';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { isWeekLocked } from '../utils/lockTime';
import { getCurrentNFLSeason } from '../utils/season';

const router = Router();

// Average over nullable numbers
const avgOf = (nums: (number | null | undefined)[]): number | null => {
  const valid = nums.filter((v): v is number => v != null && typeof v === 'number' && !isNaN(v));
  return valid.length ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10 : null;
};

type TeamStats = {
  ppg: number | null;
  ppga: number | null;
  ypg: number | null;
  yapg: number | null;
  passYpg: number | null;
  rushYpg: number | null;
};

async function fetchTeamStatsMap(
  teamNames: string[],
  season: number,
  seasonType: string,
): Promise<{ map: Record<string, TeamStats>; seasonUsed: number | null }> {
  if (teamNames.length === 0) return { map: {}, seasonUsed: null };

  const query = (s: number) =>
    db.query.teamGameStats.findMany({
      where: and(
        inArray(schema.teamGameStats.teamName, teamNames),
        eq(schema.teamGameStats.season, s),
        eq(schema.teamGameStats.sport, 'nfl'),
      ),
    });

  let rows = await query(season);
  let filtered = rows.filter(r => (r.additionalStats as any)?.seasonType === seasonType);

  let seasonUsed: number | null = null;
  if (filtered.length === 0 && season > 2025) {
    rows = await query(2025);
    filtered = rows.filter(r => (r.additionalStats as any)?.seasonType === 'regular');
    if (filtered.length > 0) seasonUsed = 2025;
  } else if (filtered.length > 0) {
    seasonUsed = season;
  }

  const map: Record<string, TeamStats> = {};
  for (const name of teamNames) {
    const tr = filtered.filter(r => r.teamName === name);
    map[name] = {
      ppg:      avgOf(tr.map(r => r.pointsPerGame)),
      ppga:     avgOf(tr.map(r => r.pointsAllowedPerGame)),
      ypg:      avgOf(tr.map(r => r.yardsPerGame)),
      yapg:     avgOf(tr.map(r => r.yardsAllowedPerGame)),
      passYpg:  avgOf(tr.map(r => (r.additionalStats as any)?.passingYards)),
      rushYpg:  avgOf(tr.map(r => (r.additionalStats as any)?.rushingYards)),
    };
  }
  return { map, seasonUsed };
}

// GET /api/games?week=X&season=Y
router.get('/', optionalAuth, async (req, res) => {
  const season = req.query['season'] ? parseInt(req.query['season'] as string, 10) : getCurrentNFLSeason();
  const week = req.query['week'] ? parseInt(req.query['week'] as string, 10) : undefined;
  const seasonType = (req.query['seasonType'] as string) ?? 'regular';

  const conditions = [eq(schema.games.season, season), eq(schema.games.sport, 'nfl'), eq(schema.games.seasonType, seasonType)];
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

  // Compute pick % after lock
  let pickPctMap: Record<string, { homePickPct: number | null; awayPickPct: number | null }> = {};
  if (week && gameList.length > 0) {
    const locked = await isWeekLocked(week, season);
    if (locked) {
      const gameIds = gameList.map(g => g.id);
      const allPicks = await db.query.picks.findMany({
        where: inArray(schema.picks.gameId, gameIds),
      });
      for (const game of gameList) {
        const gamePicks = allPicks.filter(p => p.gameId === game.id);
        const total = gamePicks.length;
        if (total === 0) {
          pickPctMap[game.id] = { homePickPct: null, awayPickPct: null };
        } else {
          const homeCount = gamePicks.filter(p => p.pick === 'home').length;
          pickPctMap[game.id] = {
            homePickPct: Math.round((homeCount / total) * 100),
            awayPickPct: Math.round(((total - homeCount) / total) * 100),
          };
        }
      }
    }
  }

  // Attach team stats averages
  const allTeamNames = [...new Set(gameList.flatMap(g => [g.homeTeam, g.awayTeam]))];
  const { map: statsMap, seasonUsed: statsSeasonUsed } = await fetchTeamStatsMap(allTeamNames, season, seasonType);

  res.json(gameList.map(game => ({
    ...game,
    myPick: myPicksMap[game.id] ?? null,
    homePickPct: pickPctMap[game.id]?.homePickPct ?? null,
    awayPickPct: pickPctMap[game.id]?.awayPickPct ?? null,
    homePPG:      statsMap[game.homeTeam]?.ppg ?? null,
    homePPGA:     statsMap[game.homeTeam]?.ppga ?? null,
    homeYPG:      statsMap[game.homeTeam]?.ypg ?? null,
    homeYAPG:     statsMap[game.homeTeam]?.yapg ?? null,
    homePassYPG:  statsMap[game.homeTeam]?.passYpg ?? null,
    homeRushYPG:  statsMap[game.homeTeam]?.rushYpg ?? null,
    awayPPG:      statsMap[game.awayTeam]?.ppg ?? null,
    awayPPGA:     statsMap[game.awayTeam]?.ppga ?? null,
    awayYPG:      statsMap[game.awayTeam]?.ypg ?? null,
    awayYAPG:     statsMap[game.awayTeam]?.yapg ?? null,
    awayPassYPG:  statsMap[game.awayTeam]?.passYpg ?? null,
    awayRushYPG:  statsMap[game.awayTeam]?.rushYpg ?? null,
    statsSeasonUsed,
  })));
});

// GET /api/games/:id
router.get('/:id', optionalAuth, async (req, res) => {
  const game = await db.query.games.findFirst({
    where: eq(schema.games.id, req.params['id'] as string),
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

  // Team stats for this game
  const { map: statsMap, seasonUsed: statsSeasonUsed } = await fetchTeamStatsMap(
    [game.homeTeam, game.awayTeam],
    game.season,
    game.seasonType,
  );

  // Last 5 completed games for each team this season
  const seasonGames = await db.query.games.findMany({
    where: and(
      eq(schema.games.sport, 'nfl'),
      eq(schema.games.season, game.season),
      eq(schema.games.seasonType, game.seasonType),
      eq(schema.games.status, 'post'),
    ),
    orderBy: [asc(schema.games.gameTime)],
  });

  const makeRecentGames = (teamName: string) =>
    seasonGames
      .filter(g => (g.homeTeam === teamName || g.awayTeam === teamName) && g.id !== game.id)
      .sort((a, b) => new Date(b.gameTime!).getTime() - new Date(a.gameTime!).getTime())
      .slice(0, 5)
      .map(g => {
        const isHome = g.homeTeam === teamName;
        const teamScore = isHome ? g.homeScore : g.awayScore;
        const oppScore = isHome ? g.awayScore : g.homeScore;
        return {
          gameId: g.id,
          week: g.week,
          gameTime: g.gameTime,
          isHome,
          opponent: isHome ? g.awayTeam : g.homeTeam,
          opponentLogo: isHome ? g.awayTeamLogo : g.homeTeamLogo,
          teamScore,
          oppScore,
          result: teamScore !== null && oppScore !== null ? (teamScore > oppScore ? 'W' : 'L') as 'W' | 'L' : null,
        };
      });

  res.json({
    ...game,
    pickBreakdown,
    myPick,
    isLocked: locked,
    homePPG:      statsMap[game.homeTeam]?.ppg ?? null,
    homePPGA:     statsMap[game.homeTeam]?.ppga ?? null,
    homeYPG:      statsMap[game.homeTeam]?.ypg ?? null,
    homeYAPG:     statsMap[game.homeTeam]?.yapg ?? null,
    homePassYPG:  statsMap[game.homeTeam]?.passYpg ?? null,
    homeRushYPG:  statsMap[game.homeTeam]?.rushYpg ?? null,
    awayPPG:      statsMap[game.awayTeam]?.ppg ?? null,
    awayPPGA:     statsMap[game.awayTeam]?.ppga ?? null,
    awayYPG:      statsMap[game.awayTeam]?.ypg ?? null,
    awayYAPG:     statsMap[game.awayTeam]?.yapg ?? null,
    awayPassYPG:  statsMap[game.awayTeam]?.passYpg ?? null,
    awayRushYPG:  statsMap[game.awayTeam]?.rushYpg ?? null,
    statsSeasonUsed,
    homeTeamRecentGames: makeRecentGames(game.homeTeam),
    awayTeamRecentGames: makeRecentGames(game.awayTeam),
  });
});

export default router;
