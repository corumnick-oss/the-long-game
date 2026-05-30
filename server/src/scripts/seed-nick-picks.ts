/**
 * Seeds nickcorum@gmail.com with Nicholas's 2025 picks for testing.
 * Looks up the Firebase UID via Admin SDK — no need to sign out/in first.
 *
 * Run: npm run seed:nick  (from server/ directory, with server/.env present)
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import admin from 'firebase-admin';
import * as schema from '../db/schema.js';

const NICHOLAS_OLD_UID = 'KNCanobU7uVRwHBloZcTX4hohOD2';
const TARGET_EMAIL = 'nickcorum@gmail.com';
const DATA_DIR = path.join(__dirname, '../../../data');

// ── Firebase Admin ────────────────────────────────────────────────────────────
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env['FIREBASE_PROJECT_ID']!,
    clientEmail: process.env['FIREBASE_CLIENT_EMAIL']!,
    privateKey: process.env['FIREBASE_PRIVATE_KEY']!.replace(/\\n/g, '\n'),
  }),
});

// ── Database ──────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
  ssl: { rejectUnauthorized: false },
});
const db = drizzle(pool, { schema });

function readCsv(file: string): Record<string, string>[] {
  const raw = fs.readFileSync(path.join(DATA_DIR, file), 'utf-8');
  return parse(raw, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
}

function parseDate(val: string): Date | null {
  if (!val) return null;
  const d = new Date(val.replace(/^"|"$/g, ''));
  return isNaN(d.getTime()) ? null : d;
}

async function main() {
  // 1. Look up UID from Firebase — no app sign-in required
  console.log(`Looking up Firebase UID for ${TARGET_EMAIL}...`);
  let firebaseUid: string;
  try {
    const firebaseUser = await admin.auth().getUserByEmail(TARGET_EMAIL);
    firebaseUid = firebaseUser.uid;
    console.log(`Firebase UID: ${firebaseUid}`);
  } catch (err: any) {
    console.error(`Could not find Firebase user for ${TARGET_EMAIL}: ${err.message}`);
    console.error('Make sure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are set in server/.env');
    process.exit(1);
  }

  // 2. Upsert user record in the database
  const existing = await db.query.users.findFirst({ where: eq(schema.users.id, firebaseUid) });
  if (existing) {
    console.log(`Found existing DB record: "${existing.teamName}"`);
    await db.update(schema.users)
      .set({ isAdmin: true, isLongie: true, teamName: 'Nicholas', nflAccess: true, updatedAt: new Date() })
      .where(eq(schema.users.id, firebaseUid));
  } else {
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

  // 3. Remove the old migration Nicholas record if it exists (avoids duplicate on leaderboard)
  const oldNicholasExists = await db.query.users.findFirst({ where: eq(schema.users.id, NICHOLAS_OLD_UID) });
  if (oldNicholasExists) {
    await db.delete(schema.picks).where(eq(schema.picks.userId, NICHOLAS_OLD_UID));
    await db.delete(schema.trophies).where(eq(schema.trophies.userId, NICHOLAS_OLD_UID));
    await db.delete(schema.users).where(eq(schema.users.id, NICHOLAS_OLD_UID));
    console.log('Removed old migration Nicholas record (picks + trophies + user)');
  }

  // 5. Build espnId → DB game UUID
  const dbGames = await db.query.games.findMany({ where: eq(schema.games.season, 2025) });
  const espnToDb = new Map(dbGames.map(g => [g.espnId, g.id]));
  console.log(`${dbGames.length} games found in DB for 2025 season`);

  // 6. Build CSV game UUID → espnId
  const csvGames = readCsv('games.csv').filter(g => g['season'] === '2025');
  const csvToEspn = new Map(csvGames.map(g => [g['id']!, g['espn_id']!]));

  // 7. Get Nicholas's picks from CSV
  const nicholasPicks = readCsv('picks.csv').filter(p => p['user_id'] === NICHOLAS_OLD_UID);
  console.log(`${nicholasPicks.length} picks found for Nicholas in CSV`);

  // 8. Clear any existing picks (makes script safe to re-run)
  await db.delete(schema.picks).where(eq(schema.picks.userId, firebaseUid));
  console.log('Cleared existing picks');

  // 9. Map CSV game UUIDs → live DB game UUIDs
  let matched = 0;
  let unmatched = 0;
  const rows = [];

  for (const p of nicholasPicks) {
    const espnId = csvToEspn.get(p['game_id']!);
    const dbGameId = espnId ? espnToDb.get(espnId) : undefined;
    if (!dbGameId) { unmatched++; continue; }

    rows.push({
      id: randomUUID(),
      userId: firebaseUid,
      gameId: dbGameId,
      pick: p['pick']! as 'home' | 'away',
      isCorrect: p['is_correct'] === 'true' ? true : p['is_correct'] === 'false' ? false : null,
      pickWinProbability: null,
      pointsEarned: null,
      createdAt: parseDate(p['created_at']!) ?? new Date(),
    });
    matched++;
  }

  if (unmatched > 0) {
    console.warn(`Warning: ${unmatched} picks skipped — game not found in DB`);
  }

  // 10. Insert in batches
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
