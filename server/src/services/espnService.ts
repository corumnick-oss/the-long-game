import axios from 'axios';
import { db } from '../db';
import { games, picks, teamGameStats } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { getCurrentNFLSeason } from '../utils/season';
import { notifyGameFinal } from './notificationService';

const BASE = process.env['ESPN_API_BASE_URL'] ?? 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const CORE_BASE = 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl';

// ESPN's /teams list endpoint returns 400 from Railway (server-side blocked).
// Hard-code the 32 stable ESPN NFL team IDs so we can skip that call.
const NFL_TEAM_IDS = [
  '1','2','3','4','5','6','7','8','9','10',
  '11','12','13','14','15','16','17','18','19','20',
  '21','22','23','24','25','26','27','28','29','30',
  '33','34', // Ravens (33), Texans (34) — IDs 31/32 unused
];

// ESPN blocks server-side requests without a browser UA on some endpoints
const ESPN_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'application/json',
};

// 1=preseason, 2=regular, 3=postseason
const SEASON_TYPE_MAP: Record<string, number> = { preseason: 1, regular: 2, postseason: 3 };

interface ESPNCompetitor {
  homeAway: 'home' | 'away';
  score?: string;
  team: { displayName: string; logo?: string; abbreviation: string };
  records?: Array<{ type: string; summary: string }>;
}

interface ESPNEvent {
  id: string;
  competitions: Array<{
    status: {
      type: { name: string; state: string; completed: boolean };
      period: number;
      displayClock: string;
    };
    competitors: ESPNCompetitor[];
    odds?: Array<{ spread?: string; homeTeamOdds?: { favorite: boolean } }>;
  }>;
  date: string;
}

function parseStatus(state: string): 'pre' | 'in' | 'post' {
  if (state === 'pre') return 'pre';
  if (state === 'in') return 'in';
  return 'post';
}

function totalRecord(comp: ESPNCompetitor): string | null {
  return comp.records?.find(r => r.type === 'total')?.summary ?? null;
}

// Sync for future seasons: ESPN's scoreboard and core API are blocked from server-side
// requests. Instead, collect event IDs by fetching each team's schedule (same domain
// as summary/winprobs — works from Railway), then fetch a summary per unique event.
async function syncWeekGamesFromTeamSchedules(week: number, season: number, seasonType: 'regular' | 'preseason' | 'postseason'): Promise<number> {
  const st = SEASON_TYPE_MAP[seasonType] ?? 2;

  // Step 1: use hard-coded team IDs — ESPN's /teams list returns 400 from Railway
  const teamIds = NFL_TEAM_IDS;

  // Step 2: collect unique event IDs for the requested week from all team schedules
  const eventIds = new Set<string>();
  let firstTeamDone = false;
  for (const teamId of teamIds) {
    try {
      const schedResp = await axios.get(
        `${BASE}/teams/${teamId}/schedule?season=${season}&seasontype=${st}`,
        { headers: ESPN_HEADERS },
      );
      const events: any[] = schedResp.data?.events ?? [];
      if (!firstTeamDone) {
        console.log(`[ESPN] team ${teamId} schedule: ${events.length} events, week numbers: ${[...new Set(events.map((e: any) => e.week?.number))].join(',')}`);
        firstTeamDone = true;
      }
      for (const ev of events) {
        if (ev.week?.number === week && ev.id) {
          eventIds.add(String(ev.id));
        }
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.message ?? String(err);
      if (!firstTeamDone) {
        console.warn(`[ESPN] team ${teamId} schedule failed: ${status ?? msg}`);
        firstTeamDone = true;
      }
      // skip this team and continue
    }
  }

  if (eventIds.size === 0) {
    console.warn(`[ESPN] no events found via team schedules for ${seasonType} ${season} week ${week}`);
    return 0;
  }

  // Step 3: fetch summary + upsert for each unique event
  return syncGamesByEventIds([...eventIds], week, season, seasonType);
}

// Sync games from a known list of ESPN event IDs via /summary (works from Railway).
// Used by both the server-side team-schedule path and the mobile-assisted path for future seasons.
export async function syncGamesByEventIds(
  eventIds: string[],
  week: number,
  season: number,
  seasonType: 'regular' | 'preseason' | 'postseason',
): Promise<number> {
  let upserted = 0;
  for (const eventId of eventIds) {
    try {
      const { data } = await axios.get(`${BASE}/summary?event=${eventId}`, { headers: ESPN_HEADERS });
      const comp = data.header?.competitions?.[0];
      if (!comp) { console.warn(`[ESPN] no competition in summary for event ${eventId}`); continue; }

      const home = comp.competitors?.find((c: any) => c.homeAway === 'home');
      const away = comp.competitors?.find((c: any) => c.homeAway === 'away');
      if (!home || !away) { console.warn(`[ESPN] missing competitors for event ${eventId}`); continue; }

      const pickcenter = Array.isArray(data.pickcenter) ? data.pickcenter[0] : null;
      const spreadVal = pickcenter?.spread != null ? parseFloat(pickcenter.spread) : null;
      const status = parseStatus(comp.status?.type?.state ?? 'pre');
      const homeScore = home.score != null ? parseInt(String(home.score), 10) : null;
      const awayScore = away.score != null ? parseInt(String(away.score), 10) : null;

      const row = {
        espnId: String(eventId),
        week,
        season,
        seasonType,
        sport: 'nfl',
        homeTeam: home.team?.displayName ?? '',
        awayTeam: away.team?.displayName ?? '',
        homeTeamLogo: home.team?.logo ?? null,
        awayTeamLogo: away.team?.logo ?? null,
        homeTeamRecord: totalRecord(home),
        awayTeamRecord: totalRecord(away),
        spread: spreadVal,
        favoriteTeam: null as string | null,
        gameTime: comp.date ? new Date(comp.date) : null,
        status,
        homeScore: homeScore != null && !isNaN(homeScore) ? homeScore : null,
        awayScore: awayScore != null && !isNaN(awayScore) ? awayScore : null,
        period: comp.status?.period ?? null,
        displayClock: comp.status?.displayClock ?? null,
        statusType: comp.status?.type?.name ?? null,
        isScoreLocked: false,
      };

      await db.insert(games).values({ id: undefined as any, ...row }).onConflictDoUpdate({
        target: games.espnId,
        set: {
          status: row.status, homeScore: row.homeScore, awayScore: row.awayScore,
          homeTeamRecord: row.homeTeamRecord, awayTeamRecord: row.awayTeamRecord,
          period: row.period, displayClock: row.displayClock, statusType: row.statusType,
          homeTeamLogo: row.homeTeamLogo, awayTeamLogo: row.awayTeamLogo,
          spread: row.spread, favoriteTeam: row.favoriteTeam, gameTime: row.gameTime,
        },
      });
      upserted++;
    } catch (err: any) {
      console.warn(`[ESPN] failed to sync event ${eventId}: ${err?.message}`);
    }
  }
  return upserted;
}

export async function syncWeekGames(week: number, season: number, seasonType: 'regular' | 'preseason' | 'postseason' = 'regular'): Promise<number> {
  // For future seasons ESPN's scoreboard returns 400 or wrong-year data from server-side requests.
  // Skip it entirely and use the core API which has the actual schedule.
  if (season > getCurrentNFLSeason()) {
    return syncWeekGamesFromTeamSchedules(week, season, seasonType);
  }

  const st = SEASON_TYPE_MAP[seasonType] ?? 2;
  const url = `${BASE}/scoreboard?week=${week}&seasontype=${st}&season=${season}&limit=50`;

  const { data } = await axios.get<{ events?: ESPNEvent[] }>(url, { headers: ESPN_HEADERS });
  const events = data.events ?? [];

  if (events.length === 0) return 0;

  // Pre-fetch existing games to detect in→post transitions for notifications
  const existingGames = await db.query.games.findMany({ where: eq(games.week, week) });
  const existingByEspnId = new Map(existingGames.map(g => [g.espnId, g]));

  type JustFinished = { id: string; espnId: string; homeTeam: string; awayTeam: string; homeScore: number; awayScore: number };
  const justFinished: JustFinished[] = [];

  let upserted = 0;
  for (const event of events) {
    const comp = event.competitions[0];
    if (!comp) continue;

    const home = comp.competitors.find(c => c.homeAway === 'home');
    const away = comp.competitors.find(c => c.homeAway === 'away');
    if (!home || !away) continue;

    const status = parseStatus(comp.status.type.state);
    const odds = comp.odds?.[0];
    const spread = odds?.spread ? parseFloat(odds.spread) : null;
    const favoriteTeam = odds?.homeTeamOdds?.favorite === false ? away.team.displayName : home.team.displayName;
    const homeScore = home.score ? parseInt(home.score, 10) : null;
    const awayScore = away.score ? parseInt(away.score, 10) : null;

    const row = {
      espnId: event.id,
      week,
      season,
      seasonType,
      sport: 'nfl',
      homeTeam: home.team.displayName,
      awayTeam: away.team.displayName,
      homeTeamLogo: home.team.logo ?? null,
      awayTeamLogo: away.team.logo ?? null,
      homeTeamRecord: totalRecord(home),
      awayTeamRecord: totalRecord(away),
      spread,
      favoriteTeam: spread ? favoriteTeam : null,
      gameTime: new Date(event.date),
      status,
      homeScore,
      awayScore,
      period: comp.status.period ?? null,
      displayClock: comp.status.displayClock ?? null,
      statusType: comp.status.type.name ?? null,
      isScoreLocked: false,
    };

    // Detect in→post transition for game-final notifications
    const existing = existingByEspnId.get(event.id);
    if (existing?.status === 'in' && status === 'post' && homeScore != null && awayScore != null) {
      justFinished.push({ id: existing.id, espnId: event.id, homeTeam: row.homeTeam, awayTeam: row.awayTeam, homeScore, awayScore });
    }

    await db.insert(games).values({ id: undefined as any, ...row }).onConflictDoUpdate({
      target: games.espnId,
      set: {
        status: row.status,
        homeScore: row.homeScore,
        awayScore: row.awayScore,
        homeTeamRecord: row.homeTeamRecord,
        awayTeamRecord: row.awayTeamRecord,
        period: row.period,
        displayClock: row.displayClock,
        statusType: row.statusType,
        homeTeamLogo: row.homeTeamLogo,
        awayTeamLogo: row.awayTeamLogo,
        spread: row.spread,
        favoriteTeam: row.favoriteTeam,
        gameTime: row.gameTime,
      },
    });
    upserted++;
  }

  // Fire game-final notifications and sync box score stats for just-finished games
  for (const game of justFinished) {
    try {
      const gamePicks = await db.query.picks.findMany({ where: eq(picks.gameId, game.id) });
      const homeWon = game.homeScore > game.awayScore;
      for (const pick of gamePicks) {
        const isCorrect = pick.pick === 'home' ? homeWon : !homeWon;
        notifyGameFinal(pick.userId, game.homeTeam, game.awayTeam, game.homeScore, game.awayScore, isCorrect).catch(err =>
          console.error('[ESPN] notifyGameFinal failed for user', pick.userId, err)
        );
      }
    } catch (err) {
      console.error('[ESPN] Game final notification batch failed for game', game.id, err);
    }
    // Sync box score stats asynchronously — don't block the live update loop
    syncBoxScoreStats({ id: game.id, espnId: game.espnId, week, season, seasonType, homeTeam: game.homeTeam, awayTeam: game.awayTeam, homeScore: game.homeScore, awayScore: game.awayScore })
      .catch(err => console.error('[ESPN] syncBoxScoreStats failed for game', game.id, err));
  }

  return upserted;
}

export async function updateLiveScores(): Promise<void> {
  const season = getCurrentNFLSeason();
  const liveGames = await db.query.games.findMany({
    where: eq(games.status, 'in'),
  });

  // Group by week + seasonType so preseason games hit the right scoreboard endpoint
  const seen = new Set<string>();
  for (const game of liveGames) {
    const key = `${game.week}:${game.seasonType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await syncWeekGames(game.week, season, game.seasonType as 'regular' | 'preseason' | 'postseason');
  }
}

export async function syncWeekScores(week: number, season: number, seasonType: 'regular' | 'preseason' | 'postseason' = 'regular'): Promise<number> {
  const st = SEASON_TYPE_MAP[seasonType] ?? 2;
  const url = `${BASE}/scoreboard?week=${week}&seasontype=${st}&season=${season}&limit=50`;

  const { data } = await axios.get<{ events: ESPNEvent[] }>(url, { headers: ESPN_HEADERS });
  const events = data.events ?? [];

  let updated = 0;
  for (const event of events) {
    const comp = event.competitions[0];
    if (!comp) continue;
    const home = comp.competitors.find(c => c.homeAway === 'home');
    const away = comp.competitors.find(c => c.homeAway === 'away');
    if (!home || !away) continue;

    await db.update(games).set({
      status: parseStatus(comp.status.type.state),
      homeScore: home.score ? parseInt(home.score, 10) : null,
      awayScore: away.score ? parseInt(away.score, 10) : null,
      period: comp.status.period ?? null,
      displayClock: comp.status.displayClock ?? null,
      statusType: comp.status.type.name ?? null,
    }).where(eq(games.espnId, event.id));
    updated++;
  }
  return updated;
}

export async function syncWinProbabilities(week: number, season: number): Promise<void> {
  const weekGames = await db.query.games.findMany({
    where: eq(games.week, week),
  });

  for (const game of weekGames) {
    try {
      const url = `${BASE}/summary?event=${game.espnId}`;
      const { data } = await axios.get<any>(url);

      const winProb = data.winprobability;
      if (!Array.isArray(winProb) || winProb.length === 0) continue;

      const last = winProb[winProb.length - 1] as { homeWinPercentage: number };
      const homeWinProb = Math.round(last.homeWinPercentage * 100);
      const awayWinProb = 100 - homeWinProb;

      const homeIsLeading = homeWinProb >= awayWinProb;
      await db.update(games).set({
        winningTeamWinProb: homeIsLeading ? homeWinProb : awayWinProb,
        losingTeamWinProb: homeIsLeading ? awayWinProb : homeWinProb,
        favoriteTeam: homeIsLeading ? game.homeTeam : game.awayTeam,
      }).where(eq(games.id, game.id));
    } catch {
      // Individual game failure shouldn't stop the whole sync
    }
  }
}

// Sync box score stats for a completed game into team_game_stats (idempotent — delete + insert).
export async function syncBoxScoreStats(game: {
  id: string;
  espnId: string;
  week: number;
  season: number;
  seasonType: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
}): Promise<void> {
  try {
    const { data } = await axios.get(`${BASE}/summary?event=${game.espnId}`, { headers: ESPN_HEADERS });

    const teams: any[] = data.boxscore?.teams ?? [];
    if (teams.length === 0) {
      console.warn(`[ESPN] No boxscore teams for event ${game.espnId}`);
      return;
    }

    const home = teams.find((t: any) => t.homeAway === 'home');
    const away = teams.find((t: any) => t.homeAway === 'away');
    if (!home || !away) {
      console.warn(`[ESPN] Missing home/away boxscore for event ${game.espnId}`);
      return;
    }

    const getStat = (team: any, name: string): string | null =>
      team.statistics?.find((s: any) => s.name === name)?.displayValue ?? null;

    const parseYards = (val: string | null): number | null => {
      if (!val) return null;
      const n = parseInt(val, 10);
      return isNaN(n) ? null : n;
    };

    const parseRatio = (val: string | null): number | null => {
      // "6-14" → 42.9%
      if (!val) return null;
      const parts = val.split('-').map(Number);
      if (parts.length !== 2 || !parts[1]) return null;
      return Math.round((parts[0] / parts[1]) * 1000) / 10;
    };

    const homeTotalYards  = parseYards(getStat(home, 'totalYards'));
    const homePassYards   = parseYards(getStat(home, 'netPassingYards'));
    const homeRushYards   = parseYards(getStat(home, 'rushingYards'));
    const homeThirdDown   = parseRatio(getStat(home, 'thirdDownEff'));
    const homeRedZone     = parseRatio(getStat(home, 'redZoneAttempts'));

    const awayTotalYards  = parseYards(getStat(away, 'totalYards'));
    const awayPassYards   = parseYards(getStat(away, 'netPassingYards'));
    const awayRushYards   = parseYards(getStat(away, 'rushingYards'));
    const awayThirdDown   = parseRatio(getStat(away, 'thirdDownEff'));
    const awayRedZone     = parseRatio(getStat(away, 'redZoneAttempts'));

    // Idempotent — delete existing rows for this game before reinserting
    await db.delete(teamGameStats).where(eq(teamGameStats.gameId, game.id));

    await db.insert(teamGameStats).values([
      {
        gameId: game.id,
        season: game.season,
        week: game.week,
        sport: 'nfl',
        teamName: game.homeTeam,
        isHomeTeam: true,
        yardsPerGame: homeTotalYards,
        yardsAllowedPerGame: awayTotalYards,
        pointsPerGame: game.homeScore,
        pointsAllowedPerGame: game.awayScore,
        thirdDownConversion: homeThirdDown,
        redZoneEfficiency: homeRedZone,
        additionalStats: { passingYards: homePassYards, rushingYards: homeRushYards, seasonType: game.seasonType },
      },
      {
        gameId: game.id,
        season: game.season,
        week: game.week,
        sport: 'nfl',
        teamName: game.awayTeam,
        isHomeTeam: false,
        yardsPerGame: awayTotalYards,
        yardsAllowedPerGame: homeTotalYards,
        pointsPerGame: game.awayScore,
        pointsAllowedPerGame: game.homeScore,
        thirdDownConversion: awayThirdDown,
        redZoneEfficiency: awayRedZone,
        additionalStats: { passingYards: awayPassYards, rushingYards: awayRushYards, seasonType: game.seasonType },
      },
    ]);

    console.log(`[ESPN] Box score synced: ${game.awayTeam} @ ${game.homeTeam} W${game.week}`);
  } catch (err: any) {
    console.warn(`[ESPN] Box score sync failed for event ${game.espnId}: ${err?.message}`);
  }
}

// Backfill team_game_stats for all completed games in a season+type. Safe to re-run.
export async function backfillTeamStats(season: number, seasonType: string = 'regular'): Promise<number> {
  const completedGames = await db.query.games.findMany({
    where: and(
      eq(games.season, season),
      eq(games.status, 'post'),
      eq(games.seasonType, seasonType),
      eq(games.sport, 'nfl'),
    ),
  });

  console.log(`[ESPN] Backfilling stats: ${completedGames.length} ${seasonType} games for ${season}`);

  let synced = 0;
  for (const game of completedGames) {
    await syncBoxScoreStats({
      id: game.id,
      espnId: game.espnId,
      week: game.week,
      season: game.season,
      seasonType: game.seasonType,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
    });
    synced++;
  }

  return synced;
}
