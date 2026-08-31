import { Router } from 'express';
import { db } from '../db';
import * as schema from '../db/schema';
import { eq, and, asc, inArray } from 'drizzle-orm';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { isWeekLocked } from '../utils/lockTime';
import { getCurrentNFLSeason, getCurrentWeekAndType } from '../utils/season';

const router = Router();

// GET /api/games/current-week — data-driven current week + season type (same logic the
// scheduler uses), so mobile doesn't have to guess with client-side calendar math.
router.get('/current-week', optionalAuth, async (req, res) => {
  const { week, seasonType } = await getCurrentWeekAndType();
  res.json({ week, season: getCurrentNFLSeason(), seasonType });
});

// Average over nullable numbers
const avgOf = (nums: (number | null | undefined)[]): number | null => {
  const valid = nums.filter((v): v is number => v != null && typeof v === 'number' && !isNaN(v));
  return valid.length ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10 : null;
};

// 2025 games stored team names as abbreviations; 2026+ games store full names.
// Used to translate when falling back to 2025 stats for 2026 pre-game display.
const NFL_FULL_TO_ABBREV: Record<string, string> = {
  'Arizona Cardinals': 'ARI',
  'Atlanta Falcons': 'ATL',
  'Baltimore Ravens': 'BAL',
  'Buffalo Bills': 'BUF',
  'Carolina Panthers': 'CAR',
  'Chicago Bears': 'CHI',
  'Cincinnati Bengals': 'CIN',
  'Cleveland Browns': 'CLE',
  'Dallas Cowboys': 'DAL',
  'Denver Broncos': 'DEN',
  'Detroit Lions': 'DET',
  'Green Bay Packers': 'GB',
  'Houston Texans': 'HOU',
  'Indianapolis Colts': 'IND',
  'Jacksonville Jaguars': 'JAX',
  'Kansas City Chiefs': 'KC',
  'Las Vegas Raiders': 'LV',
  'Los Angeles Chargers': 'LAC',
  'Los Angeles Rams': 'LAR',
  'Miami Dolphins': 'MIA',
  'Minnesota Vikings': 'MIN',
  'New England Patriots': 'NE',
  'New Orleans Saints': 'NO',
  'New York Giants': 'NYG',
  'New York Jets': 'NYJ',
  'Philadelphia Eagles': 'PHI',
  'Pittsburgh Steelers': 'PIT',
  'San Francisco 49ers': 'SF',
  'Seattle Seahawks': 'SEA',
  'Tampa Bay Buccaneers': 'TB',
  'Tennessee Titans': 'TEN',
  'Washington Commanders': 'WSH',
};

type TeamStats = {
  ppg: number | null;
  ppga: number | null;
  ypg: number | null;
  yapg: number | null;
  passYpg: number | null;
  rushYpg: number | null;
  thirdDownPct: number | null;
  redZonePct: number | null;
  sacksPG: number | null;
  turnoversPG: number | null;
};

async function fetchTeamStatsMap(
  teamNames: string[],
  season: number,
  seasonType: string,
): Promise<{ map: Record<string, TeamStats>; seasonUsed: number | null }> {
  if (teamNames.length === 0) return { map: {}, seasonUsed: null };

  // Get completed game IDs for a given season+type, then pull stats for our teams.
  // Joining through games avoids relying on additionalStats.seasonType being set correctly.
  const getRows = async (s: number, st: string, queryNames: string[]) => {
    const completedGames = await db.query.games.findMany({
      where: and(
        eq(schema.games.season, s),
        eq(schema.games.seasonType, st),
        eq(schema.games.sport, 'nfl'),
        eq(schema.games.status, 'post'),
      ),
      columns: { id: true },
    });
    if (completedGames.length === 0) return [];
    const gameIds = completedGames.map(g => g.id);
    return db.query.teamGameStats.findMany({
      where: and(
        inArray(schema.teamGameStats.teamName, queryNames),
        inArray(schema.teamGameStats.gameId, gameIds),
        eq(schema.teamGameStats.sport, 'nfl'),
      ),
    });
  };

  const currentRows = await getRows(season, seasonType, teamNames);

  // Fall back to last season PER TEAM (not all-or-nothing): a team that hasn't played a
  // completed game this season yet keeps showing 2025 averages until it has, so early in a
  // new season some cards show 2026 numbers and others still show 2025 rather than going blank.
  // 2025 stats were stored under ESPN abbreviations, so query with those.
  const abbrevNames = teamNames.map(n => NFL_FULL_TO_ABBREV[n] ?? n);
  const covered = new Set(currentRows.map(r => r.teamName));
  const anyMissingCurrent = teamNames.some(n => !covered.has(n) && !covered.has(NFL_FULL_TO_ABBREV[n] ?? n));
  const priorRows = (season > 2025 && anyMissingCurrent) ? await getRows(2025, 'regular', abbrevNames) : [];

  const map: Record<string, TeamStats> = {};
  let usedCurrent = false;
  let usedPrior = false;
  for (const name of teamNames) {
    const abbrev = NFL_FULL_TO_ABBREV[name] ?? name;
    let tr = currentRows.filter(r => r.teamName === name || r.teamName === abbrev);
    if (tr.length > 0) {
      usedCurrent = true;
    } else {
      tr = priorRows.filter(r => r.teamName === name || r.teamName === abbrev);
      if (tr.length > 0) usedPrior = true;
    }
    map[name] = {
      ppg:          avgOf(tr.map(r => r.pointsPerGame)),
      ppga:         avgOf(tr.map(r => r.pointsAllowedPerGame)),
      ypg:          avgOf(tr.map(r => r.yardsPerGame)),
      yapg:         avgOf(tr.map(r => r.yardsAllowedPerGame)),
      passYpg:      avgOf(tr.map(r => (r.additionalStats as any)?.passingYards)),
      rushYpg:      avgOf(tr.map(r => (r.additionalStats as any)?.rushingYards)),
      thirdDownPct: avgOf(tr.map(r => r.thirdDownConversion)),
      redZonePct:   avgOf(tr.map(r => r.redZoneEfficiency)),
      sacksPG:      avgOf(tr.map(r => r.sackRate)),
      turnoversPG:  avgOf(tr.map(r => (r.additionalStats as any)?.turnovers)),
    };
  }
  // Report the oldest season actually shown, so the "using older averages" note stays visible
  // while any team on screen is still on last year's numbers.
  const seasonUsed: number | null = usedPrior ? 2025 : (usedCurrent ? season : null);
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
  let locked = false;
  if (week && gameList.length > 0) {
    locked = await isWeekLocked(week, season, seasonType);
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

  // Determine which weeks have picks open for this season+type
  const unlockedRows = await db.query.unlockedWeeks.findMany({
    where: and(eq(schema.unlockedWeeks.season, season), eq(schema.unlockedWeeks.seasonType, seasonType)),
  });
  const unlockedWeekNums = new Set(unlockedRows.map(r => r.week));

  res.json(gameList.map(game => ({
    ...game,
    isPicksOpen: unlockedWeekNums.has(game.week),
    isLocked: locked,
    myPick: myPicksMap[game.id] ?? null,
    homePickPct: pickPctMap[game.id]?.homePickPct ?? null,
    awayPickPct: pickPctMap[game.id]?.awayPickPct ?? null,
    homePPG:           statsMap[game.homeTeam]?.ppg ?? null,
    homePPGA:          statsMap[game.homeTeam]?.ppga ?? null,
    homeYPG:           statsMap[game.homeTeam]?.ypg ?? null,
    homeYAPG:          statsMap[game.homeTeam]?.yapg ?? null,
    homePassYPG:       statsMap[game.homeTeam]?.passYpg ?? null,
    homeRushYPG:       statsMap[game.homeTeam]?.rushYpg ?? null,
    homeThirdDownPct:  statsMap[game.homeTeam]?.thirdDownPct ?? null,
    homeRedZonePct:    statsMap[game.homeTeam]?.redZonePct ?? null,
    homeSacksPG:       statsMap[game.homeTeam]?.sacksPG ?? null,
    homeTurnoversPG:   statsMap[game.homeTeam]?.turnoversPG ?? null,
    awayPPG:           statsMap[game.awayTeam]?.ppg ?? null,
    awayPPGA:          statsMap[game.awayTeam]?.ppga ?? null,
    awayYPG:           statsMap[game.awayTeam]?.ypg ?? null,
    awayYAPG:          statsMap[game.awayTeam]?.yapg ?? null,
    awayPassYPG:       statsMap[game.awayTeam]?.passYpg ?? null,
    awayRushYPG:       statsMap[game.awayTeam]?.rushYpg ?? null,
    awayThirdDownPct:  statsMap[game.awayTeam]?.thirdDownPct ?? null,
    awayRedZonePct:    statsMap[game.awayTeam]?.redZonePct ?? null,
    awaySacksPG:       statsMap[game.awayTeam]?.sacksPG ?? null,
    awayTurnoversPG:   statsMap[game.awayTeam]?.turnoversPG ?? null,
    statsSeasonUsed,
  })));
});

// GET /api/games/:id
router.get('/:id', optionalAuth, async (req, res) => {
  const game = await db.query.games.findFirst({
    where: eq(schema.games.id, req.params['id'] as string),
  });

  if (!game) { res.status(404).json({ error: 'Game not found' }); return; }

  const locked = await isWeekLocked(game.week, game.season, game.seasonType);

  const unlockedRow = await db.query.unlockedWeeks.findFirst({
    where: and(eq(schema.unlockedWeeks.week, game.week), eq(schema.unlockedWeeks.season, game.season), eq(schema.unlockedWeeks.seasonType, game.seasonType)),
  });
  const isPicksOpen = !!unlockedRow;

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

  // Team stats averages (pre-game context)
  const { map: statsMap, seasonUsed: statsSeasonUsed } = await fetchTeamStatsMap(
    [game.homeTeam, game.awayTeam],
    game.season,
    game.seasonType,
  );

  // Actual box score for completed games
  const buildBoxScore = (row: typeof import('../db/schema').teamGameStats.$inferSelect | undefined) => {
    if (!row) return null;
    const a = row.additionalStats as any;
    return {
      totalYards:    row.yardsPerGame,
      passYards:     a?.passingYards ?? null,
      rushYards:     a?.rushingYards ?? null,
      thirdDown:     row.thirdDownConversion,
      thirdDownRaw:  a?.thirdDownRaw ?? null,
      redZone:       row.redZoneEfficiency,
      redZoneRaw:    a?.redZoneRaw ?? null,
      sacks:         row.sackRate,
      turnovers:     a?.turnovers ?? null,
      firstDowns:    a?.firstDowns ?? null,
    };
  };

  let homeBoxScore = null;
  let awayBoxScore = null;
  if (game.status === 'post') {
    const boxRows = await db.query.teamGameStats.findMany({
      where: eq(schema.teamGameStats.gameId, game.id),
    });
    homeBoxScore = buildBoxScore(boxRows.find(r => r.isHomeTeam));
    awayBoxScore = buildBoxScore(boxRows.find(r => !r.isHomeTeam));
  }

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
    isPicksOpen,
    homePPG:          statsMap[game.homeTeam]?.ppg ?? null,
    homePPGA:         statsMap[game.homeTeam]?.ppga ?? null,
    homeYPG:          statsMap[game.homeTeam]?.ypg ?? null,
    homeYAPG:         statsMap[game.homeTeam]?.yapg ?? null,
    homePassYPG:      statsMap[game.homeTeam]?.passYpg ?? null,
    homeRushYPG:      statsMap[game.homeTeam]?.rushYpg ?? null,
    homeThirdDownPct: statsMap[game.homeTeam]?.thirdDownPct ?? null,
    homeRedZonePct:   statsMap[game.homeTeam]?.redZonePct ?? null,
    homeSacksPG:      statsMap[game.homeTeam]?.sacksPG ?? null,
    homeTurnoversPG:  statsMap[game.homeTeam]?.turnoversPG ?? null,
    awayPPG:          statsMap[game.awayTeam]?.ppg ?? null,
    awayPPGA:         statsMap[game.awayTeam]?.ppga ?? null,
    awayYPG:          statsMap[game.awayTeam]?.ypg ?? null,
    awayYAPG:         statsMap[game.awayTeam]?.yapg ?? null,
    awayPassYPG:      statsMap[game.awayTeam]?.passYpg ?? null,
    awayRushYPG:      statsMap[game.awayTeam]?.rushYpg ?? null,
    awayThirdDownPct: statsMap[game.awayTeam]?.thirdDownPct ?? null,
    awayRedZonePct:   statsMap[game.awayTeam]?.redZonePct ?? null,
    awaySacksPG:      statsMap[game.awayTeam]?.sacksPG ?? null,
    awayTurnoversPG:  statsMap[game.awayTeam]?.turnoversPG ?? null,
    statsSeasonUsed,
    homeBoxScore,
    awayBoxScore,
    homeTeamRecentGames: makeRecentGames(game.homeTeam),
    awayTeamRecentGames: makeRecentGames(game.awayTeam),
  });
});

export default router;
