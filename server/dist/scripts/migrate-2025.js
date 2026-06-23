"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const sync_1 = require("csv-parse/sync");
const node_postgres_1 = require("drizzle-orm/node-postgres");
const pg_1 = require("pg");
const schema = __importStar(require("../db/schema.js"));
// dotenv/config is preloaded via --require in the npm script
const pool = new pg_1.Pool({
    connectionString: process.env['DATABASE_URL'],
    ssl: { rejectUnauthorized: false },
});
const db = (0, node_postgres_1.drizzle)(pool, { schema });
// Users to exclude per CLAUDE.md
const SKIP_USER_IDS = new Set([
    'TMDrsh4b9FSPWippYBFXpTZG1Bk1', // CBB Test (nicholas.corum@sce.com)
    'iV0ZLYs6sfdPOxhkaNgpt232E7H2', // blank team name (nickcorum@gmail.com)
]);
const LONGIE_USER_IDS = new Set([
    '5Sg3H3XuN7cEb8TLhyA8p8j3hg12', // EWIK
    'BQMdo8NUOgY8n0QxdUophLPMewp2', // Squid
    'HHUFVmkNFOVQRY811qCFh46cuM63', // Kevin Akers
    'KNCanobU7uVRwHBloZcTX4hohOD2', // Nicholas (admin)
    'MrwsvsZKPwTJ4SwYnAKtyPEAsrq2', // The Purdy Mouths
    'fr8mqCiecfbf9coDGLRV2l3U4Ex1', // Gmac
    'uTosuZBxPucsOAnCnHmdA3pzBlb2', // Leo
]);
// Week 18 tiebreaker: JAX vs TEN (the final game, score was 41-7 = total 48)
const TIEBREAKER_ESPN_ID = '401772970';
const DATA_DIR = path.join(__dirname, '../../../data');
const BATCH = 50;
function readCsv(file) {
    const content = fs.readFileSync(path.join(DATA_DIR, file), 'utf-8');
    return (0, sync_1.parse)(content, { columns: true, skip_empty_lines: true });
}
// CSV timestamps are stored as "2025-01-01T00:00:00.000Z" (with surrounding quotes)
function parseDate(val) {
    if (!val)
        return null;
    const stripped = val.replace(/^"|"$/g, '');
    const d = new Date(stripped);
    return isNaN(d.getTime()) ? null : d;
}
function parseBool(val) {
    return val === 'true';
}
function parseFloat2(val) {
    if (!val)
        return null;
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
}
function parseInt2(val) {
    if (!val)
        return null;
    const n = parseInt(val, 10);
    return isNaN(n) ? null : n;
}
async function insertBatched(table, rows) {
    for (let i = 0; i < rows.length; i += BATCH) {
        await db.insert(table).values(rows.slice(i, i + BATCH)).onConflictDoNothing();
    }
}
async function main() {
    console.log('Starting 2025 data migration...\n');
    // ── 1. Users ──────────────────────────────────────────────────────────────
    const rawUsers = readCsv('users.csv');
    const usersToInsert = rawUsers
        .filter(u => !SKIP_USER_IDS.has(u['id']))
        .map(u => ({
        id: u['id'],
        email: u['email'],
        teamName: u['team_name'],
        isAdmin: parseBool(u['is_admin']),
        isGridiron: LONGIE_USER_IDS.has(u['id']),
        isPremium: false,
        nflAccess: parseBool(u['nfl_access']),
        profileImageUrl: u['profile_image_url'] || null,
        createdAt: parseDate(u['created_at']) ?? new Date(),
        updatedAt: parseDate(u['updated_at']) ?? new Date(),
    }));
    console.log(`Inserting ${usersToInsert.length} users...`);
    await insertBatched(schema.users, usersToInsert);
    // ── 2. Games (2025 only) ──────────────────────────────────────────────────
    const rawGames = readCsv('games.csv');
    const gamesToInsert = rawGames
        .filter(g => g['season'] === '2025')
        .map(g => ({
        id: g['id'],
        espnId: g['espn_id'],
        week: parseInt2(g['week']),
        season: 2025,
        seasonType: 'regular',
        sport: 'nfl',
        homeTeam: g['home_team'],
        awayTeam: g['away_team'],
        homeTeamLogo: g['home_team_logo'] || null,
        awayTeamLogo: g['away_team_logo'] || null,
        homeTeamRecord: g['home_team_record'] || null,
        awayTeamRecord: g['away_team_record'] || null,
        spread: parseFloat2(g['spread']),
        favoriteTeam: g['favorite_team'] || null,
        gameTime: parseDate(g['game_time']),
        status: g['status'] || 'post',
        homeScore: parseInt2(g['home_score']),
        awayScore: parseInt2(g['away_score']),
        homeTeamPPG: parseFloat2(g['home_team_ppg']),
        homeTeamPPGAllowed: parseFloat2(g['home_team_ppg_allowed']),
        homeTeamFPI: parseFloat2(g['home_team_fpi']),
        awayTeamPPG: parseFloat2(g['away_team_ppg']),
        awayTeamPPGAllowed: parseFloat2(g['away_team_ppg_allowed']),
        awayTeamFPI: parseFloat2(g['away_team_fpi']),
        period: parseInt2(g['period']),
        displayClock: g['display_clock'] || null,
        statusType: g['status_type'] || null,
        winningTeamWinProb: parseFloat2(g['winning_team_win_prob']),
        losingTeamWinProb: parseFloat2(g['losing_team_win_prob']),
        isScoreLocked: false,
    }));
    console.log(`Inserting ${gamesToInsert.length} games...`);
    await insertBatched(schema.games, gamesToInsert);
    // ── 3. Picks ──────────────────────────────────────────────────────────────
    const validGameIds = new Set(gamesToInsert.map(g => g.id));
    const rawPicks = readCsv('picks.csv');
    const picksToInsert = rawPicks
        .filter(p => LONGIE_USER_IDS.has(p['user_id']) && validGameIds.has(p['game_id']))
        .map(p => ({
        id: p['id'],
        userId: p['user_id'],
        gameId: p['game_id'],
        pick: p['pick'],
        isCorrect: p['is_correct'] === 'true' ? true : p['is_correct'] === 'false' ? false : null,
        pickWinProbability: null,
        pointsEarned: null,
        createdAt: parseDate(p['created_at']) ?? new Date(),
    }));
    console.log(`Inserting ${picksToInsert.length} picks...`);
    await insertBatched(schema.picks, picksToInsert);
    // ── 4. Trophies ───────────────────────────────────────────────────────────
    const rawTrophies = readCsv('trophies.csv');
    const trophiesToInsert = rawTrophies
        .filter(t => LONGIE_USER_IDS.has(t['user_id']))
        .map(t => ({
        id: t['id'],
        userId: t['user_id'],
        type: t['type'],
        name: t['name'],
        description: t['description'],
        week: parseInt2(t['week']),
        season: parseInt2(t['season']),
        sport: t['sport'] || 'nfl',
        gameId: t['game_id'] || null,
        earnedAt: parseDate(t['earned_at']) ?? new Date(),
    }));
    console.log(`Inserting ${trophiesToInsert.length} trophies...`);
    await insertBatched(schema.trophies, trophiesToInsert);
    // ── 5. Tiebreaker picks (Week 18) ─────────────────────────────────────────
    const tbGame = gamesToInsert.find(g => g.espnId === TIEBREAKER_ESPN_ID);
    if (!tbGame) {
        console.warn('Could not find JAX vs TEN Week 18 game — skipping tiebreaker picks');
    }
    else {
        const actualTotal = tbGame.homeScore != null && tbGame.awayScore != null
            ? tbGame.homeScore + tbGame.awayScore
            : null;
        const [tbGameRecord] = await db
            .insert(schema.tiebreakerGames)
            .values({
            season: 2025,
            week: 18,
            gameId: tbGame.id,
            description: 'Week 18 tiebreaker: predict combined score of JAX vs TEN',
            actualTotal,
        })
            .returning();
        const rawTb = readCsv('week18_tiebreakers.csv');
        const tbPicksToInsert = rawTb
            .filter(t => LONGIE_USER_IDS.has(t['user_id']))
            .map(t => ({
            id: t['id'],
            userId: t['user_id'],
            tiebreakerGameId: tbGameRecord.id,
            season: parseInt2(t['season']),
            predictedTotal: parseInt2(t['predicted_total']),
            createdAt: parseDate(t['created_at']) ?? new Date(),
            updatedAt: parseDate(t['updated_at']) ?? new Date(),
        }));
        console.log(`Inserting ${tbPicksToInsert.length} tiebreaker picks...`);
        await db.insert(schema.tiebreakerPicks).values(tbPicksToInsert).onConflictDoNothing();
    }
    console.log('\nMigration complete!');
    await pool.end();
    process.exit(0);
}
main().catch(err => {
    console.error('\nMigration failed:', err);
    pool.end().finally(() => process.exit(1));
});
//# sourceMappingURL=migrate-2025.js.map