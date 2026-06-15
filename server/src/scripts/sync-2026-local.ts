/**
 * sync-2026-local.ts
 * Run: npm run sync:2026
 *
 * Fetches the 2026 NFL schedule from ESPN (local machine — no ESPN block),
 * then upserts games directly into the Railway PostgreSQL database.
 * Safe to re-run; uses espnId as upsert key.
 */

import axios from 'axios';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../db/schema.js';
import { games } from '../db/schema.js';

const SEASON = 2026;
const SEASON_TYPE: 'regular' | 'preseason' = process.argv.includes('--preseason') ? 'preseason' : 'regular';
const SEASON_TYPE_NUM = SEASON_TYPE === 'preseason' ? 1 : 2;
const MAX_WEEK = SEASON_TYPE === 'preseason' ? 4 : 18;

const NFL_TEAM_IDS = [
  '1','2','3','4','5','6','7','8','9','10',
  '11','12','13','14','15','16','17','18','19','20',
  '21','22','23','24','25','26','27','28','29','30',
  '33','34',
];

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const ESPN_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'application/json',
};

const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
  ssl: { rejectUnauthorized: false },
});
const db = drizzle(pool, { schema });

function parseStatus(state: string): 'pre' | 'in' | 'post' {
  if (state === 'in') return 'in';
  if (state === 'post') return 'post';
  return 'pre';
}

function totalRecord(comp: any): string | null {
  return comp.records?.find((r: any) => r.type === 'total')?.summary ?? null;
}

type LogoMap = Map<string, { homeLogo: string | null; awayLogo: string | null }>;

async function fetchEventIdsByWeek(): Promise<{ byWeek: Map<number, Set<string>>; logoMap: LogoMap }> {
  console.log(`Fetching schedules for ${NFL_TEAM_IDS.length} teams...`);
  const byWeek = new Map<number, Set<string>>();
  const logoMap: LogoMap = new Map();

  await Promise.all(NFL_TEAM_IDS.map(async (teamId) => {
    try {
      const resp = await axios.get(
        `${BASE}/teams/${teamId}/schedule?season=${SEASON}&seasontype=${SEASON_TYPE_NUM}`,
        { headers: ESPN_HEADERS },
      );
      const events: any[] = resp.data?.events ?? [];
      for (const ev of events) {
        const week: number = ev.week?.number;
        if (week && week >= 1 && week <= MAX_WEEK && ev.id) {
          if (!byWeek.has(week)) byWeek.set(week, new Set());
          byWeek.get(week)!.add(String(ev.id));
          // Collect logos here — summary endpoint returns empty logo for future games
          if (!logoMap.has(String(ev.id))) {
            const comp = ev.competitions?.[0];
            const home = comp?.competitors?.find((c: any) => c.homeAway === 'home');
            const away = comp?.competitors?.find((c: any) => c.homeAway === 'away');
            logoMap.set(String(ev.id), {
              homeLogo: home?.team?.logos?.[0]?.href ?? null,
              awayLogo: away?.team?.logos?.[0]?.href ?? null,
            });
          }
        }
      }
    } catch (err: any) {
      console.warn(`  Team ${teamId} schedule failed: ${err?.response?.status ?? err?.message}`);
    }
  }));

  return { byWeek, logoMap };
}

async function syncEvent(eventId: string, week: number, logoMap: LogoMap): Promise<boolean> {
  try {
    const { data } = await axios.get(`${BASE}/summary?event=${eventId}`, { headers: ESPN_HEADERS });
    const comp = data.header?.competitions?.[0];
    if (!comp) return false;

    const home = comp.competitors?.find((c: any) => c.homeAway === 'home');
    const away = comp.competitors?.find((c: any) => c.homeAway === 'away');
    if (!home || !away) return false;

    const logos = logoMap.get(String(eventId));
    const pickcenter = Array.isArray(data.pickcenter) ? data.pickcenter[0] : null;
    const spreadVal = pickcenter?.spread != null ? parseFloat(pickcenter.spread) : null;
    const status = parseStatus(comp.status?.type?.state ?? 'pre');
    const homeScore = home.score != null ? parseInt(String(home.score), 10) : null;
    const awayScore = away.score != null ? parseInt(String(away.score), 10) : null;

    const row = {
      espnId: String(eventId),
      week,
      season: SEASON,
      seasonType: SEASON_TYPE,
      sport: 'nfl' as const,
      homeTeam: home.team?.displayName ?? '',
      awayTeam: away.team?.displayName ?? '',
      homeTeamLogo: home.team?.logo || logos?.homeLogo || null,
      awayTeamLogo: away.team?.logo || logos?.awayLogo || null,
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
        homeTeam: row.homeTeam, awayTeam: row.awayTeam,
        homeTeamLogo: row.homeTeamLogo, awayTeamLogo: row.awayTeamLogo,
        homeTeamRecord: row.homeTeamRecord, awayTeamRecord: row.awayTeamRecord,
        spread: row.spread, gameTime: row.gameTime, status: row.status,
        homeScore: row.homeScore, awayScore: row.awayScore,
        period: row.period, displayClock: row.displayClock, statusType: row.statusType,
      },
    });
    return true;
  } catch (err: any) {
    console.warn(`  Event ${eventId} failed: ${err?.message}`);
    return false;
  }
}

async function main() {
  console.log(`\n=== Syncing ${SEASON} ${SEASON_TYPE} season games ===\n`);

  const { byWeek, logoMap } = await fetchEventIdsByWeek();

  const weeks = [...byWeek.keys()].sort((a, b) => a - b);
  console.log(`Found ${weeks.length} weeks with games: ${weeks.join(', ')}\n`);

  let totalSynced = 0;

  for (const week of weeks) {
    const eventIds = [...byWeek.get(week)!];
    process.stdout.write(`Week ${week}: ${eventIds.length} games... `);
    let weekSynced = 0;
    for (const id of eventIds) {
      if (await syncEvent(id, week, logoMap)) weekSynced++;
    }
    console.log(`${weekSynced}/${eventIds.length} synced`);
    totalSynced += weekSynced;
  }

  console.log(`\nDone. Total synced: ${totalSynced} games.\n`);
  await pool.end();
}

main().catch(err => {
  console.error(err);
  pool.end();
  process.exit(1);
});
