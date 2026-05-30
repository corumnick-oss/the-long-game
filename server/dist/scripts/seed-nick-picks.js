"use strict";
/**
 * Seeds nickcorum@gmail.com with Nicholas's 2025 picks for testing.
 * Looks up the Firebase UID via Admin SDK — no need to sign out/in first.
 *
 * Run: npm run seed:nick  (from server/ directory, with server/.env present)
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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const sync_1 = require("csv-parse/sync");
const node_postgres_1 = require("drizzle-orm/node-postgres");
const pg_1 = require("pg");
const drizzle_orm_1 = require("drizzle-orm");
const crypto_1 = require("crypto");
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const schema = __importStar(require("../db/schema.js"));
const NICHOLAS_OLD_UID = 'KNCanobU7uVRwHBloZcTX4hohOD2';
const TARGET_EMAIL = 'nickcorum@gmail.com';
const DATA_DIR = path.join(__dirname, '../../../data');
// ── Firebase Admin ────────────────────────────────────────────────────────────
firebase_admin_1.default.initializeApp({
    credential: firebase_admin_1.default.credential.cert({
        projectId: process.env['FIREBASE_PROJECT_ID'],
        clientEmail: process.env['FIREBASE_CLIENT_EMAIL'],
        privateKey: process.env['FIREBASE_PRIVATE_KEY'].replace(/\\n/g, '\n'),
    }),
});
// ── Database ──────────────────────────────────────────────────────────────────
const pool = new pg_1.Pool({
    connectionString: process.env['DATABASE_URL'],
    ssl: { rejectUnauthorized: false },
});
const db = (0, node_postgres_1.drizzle)(pool, { schema });
function readCsv(file) {
    const raw = fs.readFileSync(path.join(DATA_DIR, file), 'utf-8');
    return (0, sync_1.parse)(raw, { columns: true, skip_empty_lines: true });
}
function parseDate(val) {
    if (!val)
        return null;
    const d = new Date(val.replace(/^"|"$/g, ''));
    return isNaN(d.getTime()) ? null : d;
}
async function main() {
    // 1. Look up UID from Firebase — no app sign-in required
    console.log(`Looking up Firebase UID for ${TARGET_EMAIL}...`);
    let firebaseUid;
    try {
        const firebaseUser = await firebase_admin_1.default.auth().getUserByEmail(TARGET_EMAIL);
        firebaseUid = firebaseUser.uid;
        console.log(`Firebase UID: ${firebaseUid}`);
    }
    catch (err) {
        console.error(`Could not find Firebase user for ${TARGET_EMAIL}: ${err.message}`);
        console.error('Make sure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are set in server/.env');
        process.exit(1);
    }
    // 2. Upsert user record in the database
    const existing = await db.query.users.findFirst({ where: (0, drizzle_orm_1.eq)(schema.users.id, firebaseUid) });
    if (existing) {
        console.log(`Found existing DB record: "${existing.teamName}"`);
        await db.update(schema.users)
            .set({ isAdmin: true, isLongie: true, teamName: 'Nicholas', nflAccess: true, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema.users.id, firebaseUid));
    }
    else {
        console.log('No DB record found — creating one...');
        await db.insert(schema.users).values({
            id: firebaseUid,
            email: TARGET_EMAIL,
            teamName: 'Nicholas',
            isAdmin: true,
            isLongie: true,
            isPremium: false,
            nflAccess: true,
            profileImageUrl: null,
        });
    }
    console.log('User: isAdmin=true, isLongie=true, teamName=Nicholas');
    // 3. Build espnId → DB game UUID
    const dbGames = await db.query.games.findMany({ where: (0, drizzle_orm_1.eq)(schema.games.season, 2025) });
    const espnToDb = new Map(dbGames.map(g => [g.espnId, g.id]));
    console.log(`${dbGames.length} games found in DB for 2025 season`);
    // 4. Build CSV game UUID → espnId
    const csvGames = readCsv('games.csv').filter(g => g['season'] === '2025');
    const csvToEspn = new Map(csvGames.map(g => [g['id'], g['espn_id']]));
    // 5. Get Nicholas's picks from CSV
    const nicholasPicks = readCsv('picks.csv').filter(p => p['user_id'] === NICHOLAS_OLD_UID);
    console.log(`${nicholasPicks.length} picks found for Nicholas in CSV`);
    // 6. Clear any existing picks (makes script safe to re-run)
    await db.delete(schema.picks).where((0, drizzle_orm_1.eq)(schema.picks.userId, firebaseUid));
    console.log('Cleared existing picks');
    // 7. Map CSV game UUIDs → live DB game UUIDs
    let matched = 0;
    let unmatched = 0;
    const rows = [];
    for (const p of nicholasPicks) {
        const espnId = csvToEspn.get(p['game_id']);
        const dbGameId = espnId ? espnToDb.get(espnId) : undefined;
        if (!dbGameId) {
            unmatched++;
            continue;
        }
        rows.push({
            id: (0, crypto_1.randomUUID)(),
            userId: firebaseUid,
            gameId: dbGameId,
            pick: p['pick'],
            isCorrect: p['is_correct'] === 'true' ? true : p['is_correct'] === 'false' ? false : null,
            pickWinProbability: null,
            pointsEarned: null,
            createdAt: parseDate(p['created_at']) ?? new Date(),
        });
        matched++;
    }
    if (unmatched > 0) {
        console.warn(`Warning: ${unmatched} picks skipped — game not found in DB`);
    }
    // 8. Insert in batches
    const BATCH = 50;
    for (let i = 0; i < rows.length; i += BATCH) {
        await db.insert(schema.picks).values(rows.slice(i, i + BATCH));
    }
    console.log(`\nInserted ${matched} picks for ${TARGET_EMAIL}`);
    console.log('Done! Pull-to-refresh in the app to see your 2025 picks.\n');
    await pool.end();
    process.exit(0);
}
main().catch(err => {
    console.error('\nScript failed:', err.message);
    pool.end().finally(() => process.exit(1));
});
//# sourceMappingURL=seed-nick-picks.js.map