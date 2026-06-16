"use strict";
/**
 * sync-2026-local.ts
 * Run: npm run sync:2026
 *
 * Fetches the 2026 NFL schedule from ESPN (local machine — no ESPN block),
 * then upserts games directly into the Railway PostgreSQL database.
 * Safe to re-run; uses espnId as upsert key.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const node_postgres_1 = require("drizzle-orm/node-postgres");
const pg_1 = require("pg");
const schema = __importStar(require("../db/schema.js"));
const schema_js_1 = require("../db/schema.js");
const SEASON = 2026;
const SEASON_TYPE = process.argv.includes('--preseason') ? 'preseason' : 'regular';
const SEASON_TYPE_NUM = SEASON_TYPE === 'preseason' ? 1 : 2;
const MAX_WEEK = SEASON_TYPE === 'preseason' ? 4 : 18;
const NFL_TEAM_IDS = [
    '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
    '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
    '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
    '33', '34',
];
const BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const ESPN_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'application/json',
};
const pool = new pg_1.Pool({
    connectionString: process.env['DATABASE_URL'],
    ssl: { rejectUnauthorized: false },
});
const db = (0, node_postgres_1.drizzle)(pool, { schema });
function parseStatus(state) {
    if (state === 'in')
        return 'in';
    if (state === 'post')
        return 'post';
    return 'pre';
}
function totalRecord(comp) {
    return comp.records?.find((r) => r.type === 'total')?.summary ?? null;
}
async function fetchEventIdsByWeek() {
    console.log(`Fetching schedules for ${NFL_TEAM_IDS.length} teams...`);
    const byWeek = new Map();
    const logoMap = new Map();
    await Promise.all(NFL_TEAM_IDS.map(async (teamId) => {
        try {
            const resp = await axios_1.default.get(`${BASE}/teams/${teamId}/schedule?season=${SEASON}&seasontype=${SEASON_TYPE_NUM}`, { headers: ESPN_HEADERS });
            const events = resp.data?.events ?? [];
            for (const ev of events) {
                const week = ev.week?.number;
                if (week && week >= 1 && week <= MAX_WEEK && ev.id) {
                    if (!byWeek.has(week))
                        byWeek.set(week, new Set());
                    byWeek.get(week).add(String(ev.id));
                    // Collect logos here — summary endpoint returns empty logo for future games
                    if (!logoMap.has(String(ev.id))) {
                        const comp = ev.competitions?.[0];
                        const home = comp?.competitors?.find((c) => c.homeAway === 'home');
                        const away = comp?.competitors?.find((c) => c.homeAway === 'away');
                        logoMap.set(String(ev.id), {
                            homeLogo: home?.team?.logos?.[0]?.href ?? null,
                            awayLogo: away?.team?.logos?.[0]?.href ?? null,
                        });
                    }
                }
            }
        }
        catch (err) {
            console.warn(`  Team ${teamId} schedule failed: ${err?.response?.status ?? err?.message}`);
        }
    }));
    return { byWeek, logoMap };
}
async function syncEvent(eventId, week, logoMap) {
    try {
        const { data } = await axios_1.default.get(`${BASE}/summary?event=${eventId}`, { headers: ESPN_HEADERS });
        const comp = data.header?.competitions?.[0];
        if (!comp)
            return false;
        const home = comp.competitors?.find((c) => c.homeAway === 'home');
        const away = comp.competitors?.find((c) => c.homeAway === 'away');
        if (!home || !away)
            return false;
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
            sport: 'nfl',
            homeTeam: home.team?.displayName ?? '',
            awayTeam: away.team?.displayName ?? '',
            homeTeamLogo: home.team?.logo || logos?.homeLogo || null,
            awayTeamLogo: away.team?.logo || logos?.awayLogo || null,
            homeTeamRecord: totalRecord(home),
            awayTeamRecord: totalRecord(away),
            spread: spreadVal,
            favoriteTeam: null,
            gameTime: comp.date ? new Date(comp.date) : null,
            status,
            homeScore: homeScore != null && !isNaN(homeScore) ? homeScore : null,
            awayScore: awayScore != null && !isNaN(awayScore) ? awayScore : null,
            period: comp.status?.period ?? null,
            displayClock: comp.status?.displayClock ?? null,
            statusType: comp.status?.type?.name ?? null,
            isScoreLocked: false,
        };
        await db.insert(schema_js_1.games).values({ id: undefined, ...row }).onConflictDoUpdate({
            target: schema_js_1.games.espnId,
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
    }
    catch (err) {
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
        const eventIds = [...byWeek.get(week)];
        process.stdout.write(`Week ${week}: ${eventIds.length} games... `);
        let weekSynced = 0;
        for (const id of eventIds) {
            if (await syncEvent(id, week, logoMap))
                weekSynced++;
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
//# sourceMappingURL=sync-2026-local.js.map