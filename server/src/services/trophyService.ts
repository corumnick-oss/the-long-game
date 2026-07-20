import { db } from '../db';
import * as schema from '../db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { notifyAchievementEarned } from './notificationService';

export interface TrophyCandidate { userId: string; value: number }
export interface LoneWolfCandidate extends TrophyCandidate { gameId: string; teamName: string; opponentName: string }
export interface UpsetPickCandidate extends TrophyCandidate { teamName: string; opponentName: string; winProbability: number }
export interface ContrarianCandidate extends TrophyCandidate { gameId: string; teamName: string; opponentName: string; pickPercentage: number }

export interface WeeklyTrophyResults {
  mostWins: TrophyCandidate[];
  mostLosses: TrophyCandidate[];
  upsetPick: UpsetPickCandidate[];
  loneWolf: LoneWolfCandidate[];
  contrarian: ContrarianCandidate[];
}

export async function calculateWeeklyTrophies(week: number, season: number): Promise<WeeklyTrophyResults> {
  const weekGames = await db.query.games.findMany({
    where: and(eq(schema.games.week, week), eq(schema.games.season, season), eq(schema.games.sport, 'nfl')),
  });

  const completedGames = weekGames.filter(g => g.status === 'post');
  if (completedGames.length === 0) return { mostWins: [], mostLosses: [], upsetPick: [], loneWolf: [], contrarian: [] };

  const gameIds = completedGames.map(g => g.id);
  const allPicks = await db.query.picks.findMany({
    where: inArray(schema.picks.gameId, gameIds),
  });

  // Group picks
  const picksByUser = new Map<string, Map<string, typeof allPicks[0]>>();
  const picksByGame = new Map<string, typeof allPicks>();

  for (const pick of allPicks) {
    if (!picksByUser.has(pick.userId)) picksByUser.set(pick.userId, new Map());
    picksByUser.get(pick.userId)!.set(pick.gameId, pick);

    if (!picksByGame.has(pick.gameId)) picksByGame.set(pick.gameId, []);
    picksByGame.get(pick.gameId)!.push(pick);
  }

  // Per-user metrics
  type Metrics = {
    correctPicks: number;
    incorrectPicks: number;
    lowestWinProbabilityPick: { gameId: string; winProbability: number; pickedTeam: string; opponentTeam: string } | null;
  };
  const userMetrics = new Map<string, Metrics>();

  for (const [userId, userPicks] of Array.from(picksByUser.entries())) {
    let correctPicks = 0;
    let incorrectPicks = 0;
    let lowestWinProbabilityPick: Metrics['lowestWinProbabilityPick'] = null;

    for (const [gameId, pick] of Array.from(userPicks.entries())) {
      const game = completedGames.find(g => g.id === gameId);
      if (!game) continue;

      if (pick.isCorrect) {
        correctPicks++;
        if (game.winningTeamWinProb != null) {
          const winProb = game.winningTeamWinProb;
          const pickedTeam = pick.pick === 'home' ? game.homeTeam : game.awayTeam;
          const opponentTeam = pick.pick === 'home' ? game.awayTeam : game.homeTeam;
          if (!lowestWinProbabilityPick || winProb < lowestWinProbabilityPick.winProbability) {
            lowestWinProbabilityPick = { gameId, winProbability: winProb, pickedTeam, opponentTeam };
          }
        }
      } else {
        incorrectPicks++;
      }
    }

    userMetrics.set(userId, { correctPicks, incorrectPicks, lowestWinProbabilityPick });
  }

  // ── 1. Most Wins ──
  const mostWins: TrophyCandidate[] = [];
  let maxWins = 0;
  for (const [userId, m] of Array.from(userMetrics.entries())) {
    if (m.correctPicks > maxWins) { maxWins = m.correctPicks; mostWins.length = 0; mostWins.push({ userId, value: m.correctPicks }); }
    else if (m.correctPicks === maxWins && maxWins > 0) mostWins.push({ userId, value: m.correctPicks });
  }

  // ── 2. Most Losses ──
  const mostLosses: TrophyCandidate[] = [];
  let maxLosses = 0;
  for (const [userId, m] of Array.from(userMetrics.entries())) {
    if (m.incorrectPicks > maxLosses) { maxLosses = m.incorrectPicks; mostLosses.length = 0; mostLosses.push({ userId, value: m.incorrectPicks }); }
    else if (m.incorrectPicks === maxLosses && maxLosses > 0) mostLosses.push({ userId, value: m.incorrectPicks });
  }

  // ── 3. Upset Pick ──
  const EPSILON = 0.01;
  const upsetPick: UpsetPickCandidate[] = [];
  let lowestWinProb = Infinity;
  for (const [userId, m] of Array.from(userMetrics.entries())) {
    if (!m.lowestWinProbabilityPick) continue;
    const { winProbability, pickedTeam, opponentTeam } = m.lowestWinProbabilityPick;
    if (winProbability < lowestWinProb - EPSILON) {
      lowestWinProb = winProbability;
      upsetPick.length = 0;
      upsetPick.push({ userId, value: winProbability, teamName: pickedTeam, opponentName: opponentTeam, winProbability });
    } else if (Math.abs(winProbability - lowestWinProb) < EPSILON) {
      upsetPick.push({ userId, value: winProbability, teamName: pickedTeam, opponentName: opponentTeam, winProbability });
    }
  }

  // ── 4. Lone Wolf ──
  const loneWolf: LoneWolfCandidate[] = [];
  for (const game of completedGames) {
    const gamePicks = picksByGame.get(game.id) ?? [];
    const isHomeWinner = game.homeScore != null && game.awayScore != null && game.homeScore > game.awayScore;
    const isAwayWinner = game.homeScore != null && game.awayScore != null && game.awayScore > game.homeScore;
    if (!isHomeWinner && !isAwayWinner) continue;

    const winSide = isHomeWinner ? 'home' : 'away';
    const winTeam = isHomeWinner ? game.homeTeam : game.awayTeam;
    const loseTeam = isHomeWinner ? game.awayTeam : game.homeTeam;

    const winningPicks = gamePicks.filter(p => p.pick === winSide);
    const losingPicks = gamePicks.filter(p => p.pick !== winSide);

    if (winningPicks.length === 1 && losingPicks.length >= 1 && winningPicks[0]) {
      loneWolf.push({ userId: winningPicks[0].userId, value: 1, gameId: game.id, teamName: winTeam, opponentName: loseTeam });
    }
  }

  // ── 5. Contrarian ──
  const CONTRARIAN_THRESHOLD = 0.20;
  const contrarian: ContrarianCandidate[] = [];
  for (const game of completedGames) {
    const gamePicks = picksByGame.get(game.id) ?? [];
    if (gamePicks.length === 0) continue;

    const isHomeWinner = game.homeScore != null && game.awayScore != null && game.homeScore > game.awayScore;
    const isAwayWinner = game.homeScore != null && game.awayScore != null && game.awayScore > game.homeScore;
    if (!isHomeWinner && !isAwayWinner) continue;

    const winSide = isHomeWinner ? 'home' : 'away';
    const winTeam = isHomeWinner ? game.homeTeam : game.awayTeam;
    const loseTeam = isHomeWinner ? game.awayTeam : game.homeTeam;

    const winningPicks = gamePicks.filter(p => p.pick === winSide);
    const percentage = winningPicks.length / gamePicks.length;

    // Contrarian: ≤20% picked winner AND more than 1 winner pick (lone wolf is handled separately)
    if (percentage <= CONTRARIAN_THRESHOLD && winningPicks.length > 1) {
      for (const pick of winningPicks) {
        if (pick.isCorrect) {
          contrarian.push({ userId: pick.userId, value: percentage, gameId: game.id, teamName: winTeam, opponentName: loseTeam, pickPercentage: Math.round(percentage * 100) });
        }
      }
    }
  }

  return { mostWins, mostLosses, upsetPick, loneWolf, contrarian };
}

export async function awardWeeklyTrophies(week: number, season: number, specificType?: string): Promise<number> {
  console.log(`Awarding trophies for Week ${week}, Season ${season}${specificType ? ` (${specificType})` : ''}...`);
  const results = await calculateWeeklyTrophies(week, season);

  type TrophyInsert = typeof schema.trophies.$inferInsert;
  const toAward: TrophyInsert[] = [];

  if (!specificType || specificType === 'most_wins') {
    for (const c of results.mostWins) toAward.push({ userId: c.userId, type: 'most_wins', name: 'Most Wins of the Week', description: `Got ${c.value} picks correct this week`, week, season, sport: 'nfl' });
  }
  if (!specificType || specificType === 'loser') {
    for (const c of results.mostLosses) toAward.push({ userId: c.userId, type: 'loser', name: 'Loser of the Week', description: `Got ${c.value} picks wrong this week`, week, season, sport: 'nfl' });
  }
  if (!specificType || specificType === 'upset_pick') {
    for (const c of results.upsetPick) toAward.push({ userId: c.userId, type: 'upset_pick', name: 'Upset Pick of the Week', description: `Picked ${c.teamName} to beat ${c.opponentName} with only ${Math.round(c.winProbability)}% win probability`, week, season, sport: 'nfl' });
  }
  if (!specificType || specificType === 'lone_wolf') {
    for (const c of results.loneWolf) toAward.push({ userId: c.userId, type: 'lone_wolf', name: 'Lone Wolf', description: `Was the only player to pick ${c.teamName} to beat ${c.opponentName}`, week, season, sport: 'nfl', gameId: c.gameId });
  }
  if (!specificType || specificType === 'contrarian') {
    for (const c of results.contrarian) toAward.push({ userId: c.userId, type: 'contrarian', name: 'Contrarian', description: `Correctly picked ${c.teamName} when only ${c.pickPercentage}% chose them`, week, season, sport: 'nfl', gameId: c.gameId });
  }

  let awarded = 0;
  for (const trophy of toAward) {
    const isPerGame = trophy.type === 'lone_wolf' || trophy.type === 'contrarian';
    const existing = await db.query.trophies.findFirst({
      where: isPerGame && trophy.gameId
        ? and(eq(schema.trophies.userId, trophy.userId), eq(schema.trophies.type, trophy.type), eq(schema.trophies.week, week), eq(schema.trophies.season, season), eq(schema.trophies.gameId, trophy.gameId))
        : and(eq(schema.trophies.userId, trophy.userId), eq(schema.trophies.type, trophy.type), eq(schema.trophies.week, week), eq(schema.trophies.season, season)),
    });

    if (!existing) {
      await db.insert(schema.trophies).values(trophy);
      awarded++;
      notifyAchievementEarned(trophy.userId, trophy.name, week).catch(err =>
        console.error('[Trophies] notifyAchievementEarned failed:', err)
      );
    }
  }

  console.log(`Awarded ${awarded} trophies for Week ${week}`);
  return awarded;
}

// ── Season podium (Trophies) ────────────────────────────────────────────────

export interface SeasonStandingEntry {
  userId: string;
  teamName: string;
  wins: number;
  losses: number;
  rank: number;
}

// Gridirons-only, regular season standings — same ranking rule as the leaderboard (wins desc, losses asc).
export async function calculateSeasonStandings(season: number): Promise<SeasonStandingEntry[]> {
  const result = await db.execute(sql`
    SELECT
      u.id AS user_id,
      u.team_name,
      COALESCE(CAST(COUNT(CASE WHEN p.is_correct = true  THEN 1 END) AS INTEGER), 0) AS wins,
      COALESCE(CAST(COUNT(CASE WHEN p.is_correct = false THEN 1 END) AS INTEGER), 0) AS losses
    FROM users u
    LEFT JOIN games g ON g.season = ${season} AND g.sport = 'nfl' AND g.season_type = 'regular'
    LEFT JOIN picks p ON p.user_id = u.id AND p.game_id = g.id
    WHERE u.is_gridiron = true
    GROUP BY u.id, u.team_name
    HAVING COUNT(p.id) > 0
    ORDER BY wins DESC, losses ASC
  `);

  const rows = (result as any).rows ?? result;
  return (rows as any[]).map((row, idx) => ({
    userId: row.user_id as string,
    teamName: row.team_name as string,
    wins: Number(row.wins),
    losses: Number(row.losses),
    rank: idx + 1,
  }));
}

export interface SeasonTrophyAward { userId: string; teamName: string; placement: string; wins: number; losses: number }

export async function awardSeasonTrophies(season: number): Promise<SeasonTrophyAward[]> {
  const standings = await calculateSeasonStandings(season);
  if (standings.length === 0) return [];

  // Last place: everyone tied with the bottom record (wins/losses), not just whichever
  // row happened to land in the final sequential rank slot.
  const last = standings[standings.length - 1]!;
  const toAward: SeasonTrophyAward[] = [];

  for (const entry of standings) {
    let placement: string | null = null;
    if (entry.rank === 1) placement = 'champion';
    else if (entry.rank === 2) placement = 'runner_up';
    else if (entry.rank === 3) placement = 'third_place';
    else if (entry.rank > 3 && entry.wins === last.wins && entry.losses === last.losses) placement = 'last_place';

    if (placement) {
      toAward.push({ userId: entry.userId, teamName: entry.teamName, placement, wins: entry.wins, losses: entry.losses });
    }
  }

  const awarded: SeasonTrophyAward[] = [];
  for (const trophy of toAward) {
    const existing = await db.query.seasonTrophies.findFirst({
      where: and(
        eq(schema.seasonTrophies.userId, trophy.userId),
        eq(schema.seasonTrophies.season, season),
        eq(schema.seasonTrophies.placement, trophy.placement),
      ),
    });
    if (!existing) {
      await db.insert(schema.seasonTrophies).values({
        userId: trophy.userId,
        season,
        sport: 'nfl',
        placement: trophy.placement,
        wins: trophy.wins,
        losses: trophy.losses,
      });
      awarded.push(trophy);
    }
  }

  return awarded;
}
