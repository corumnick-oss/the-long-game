import axios from 'axios';
import { db } from '../db';
import { games, picks } from '../db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentNFLSeason } from '../utils/season';
import { notifyGameFinal } from './notificationService';

const BASE = process.env['ESPN_API_BASE_URL'] ?? 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const CORE_BASE = 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl';

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

  // Step 1: get all 32 team IDs
  let teamIds: string[] = [];
  try {
    const teamsResp = await axios.get(`${BASE}/teams?limit=100`, { headers: ESPN_HEADERS });
    const items: any[] = teamsResp.data?.sports?.[0]?.leagues?.[0]?.teams ?? [];
    teamIds = items.map((t: any) => t.team?.id).filter(Boolean);
  } catch (err: any) {
    throw new Error(`Failed to fetch NFL teams: ${err?.message}`);
  }
  if (teamIds.length === 0) throw new Error('No NFL teams returned from ESPN');

  // Step 2: collect unique event IDs for the requested week from all team schedules
  const eventIds = new Set<string>();
  for (const teamId of teamIds) {
    try {
      const schedResp = await axios.get(
        `${BASE}/teams/${teamId}/schedule?season=${season}&seasontype=${st}`,
        { headers: ESPN_HEADERS },
      );
      const events: any[] = schedResp.data?.events ?? [];
      for (const ev of events) {
        if (ev.week?.number === week && ev.id) {
          eventIds.add(String(ev.id));
        }
      }
    } catch { /* skip teams that fail */ }
  }

  if (eventIds.size === 0) {
    console.warn(`[ESPN] no events found via team schedules for ${seasonType} ${season} week ${week}`);
    return 0;
  }

  // Step 3: fetch summary + upsert for each unique event
  const allEventIds = [...eventIds];

  let upserted = 0;
  for (const eventId of allEventIds) {
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

  type JustFinished = { id: string; homeTeam: string; awayTeam: string; homeScore: number; awayScore: number };
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
      justFinished.push({ id: existing.id, homeTeam: row.homeTeam, awayTeam: row.awayTeam, homeScore, awayScore });
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

  // Fire game-final notifications for any games that just finished
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
  }

  return upserted;
}

export async function updateLiveScores(): Promise<void> {
  const season = getCurrentNFLSeason();
  // Find weeks with in-progress games
  const liveGames = await db.query.games.findMany({
    where: eq(games.status, 'in'),
  });

  const weeks = [...new Set(liveGames.map(g => g.week))];
  for (const week of weeks) {
    await syncWeekGames(week, season, 'regular');
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

      // Determine which team won (for post-game), or current leader (for pre/live)
      const homeIsLeading = homeWinProb >= awayWinProb;
      await db.update(games).set({
        winningTeamWinProb: homeIsLeading ? homeWinProb : awayWinProb,
        losingTeamWinProb: homeIsLeading ? awayWinProb : homeWinProb,
      }).where(eq(games.id, game.id));
    } catch {
      // Individual game failure shouldn't stop the whole sync
    }
  }
}
