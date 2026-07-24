/**
 * Reassigns a Gridiron's 2025 picks/trophies from their old UID to their new Firebase UID.
 *
 * Usage:
 *   npm run reassign:user -- --old BQMdo8NUOgY8n0QxdUophLPMewp2 --email cloud7king10@yahoo.com
 *
 * The script finds the new Firebase UID by looking up the user with that email
 * who is NOT the old UID, then migrates all data over.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq, and, ne } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import {
  users,
  picks,
  trophies,
  pushTokens,
  tiebreakerPicks,
  activityLog,
} from '../db/schema.js';

const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
  ssl: { rejectUnauthorized: false },
});
const db = drizzle(pool, { schema });

// ── Parse args ────────────────────────────────────────────────────────────────

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const oldUid = getArg('--old');
  const email  = getArg('--email');

  if (!oldUid || !email) {
    console.error('Usage: npm run reassign:user -- --old <OLD_UID> --email <EMAIL>');
    process.exit(1);
  }

  // ── Find both user records ─────────────────────────────────────────────────

  const allMatching = await db
    .select()
    .from(users)
    .where(eq(users.email, email));

  console.log(`\nFound ${allMatching.length} user(s) with email ${email}:`);
  allMatching.forEach(u => console.log(`  id=${u.id}  teamName=${u.teamName}  createdAt=${u.createdAt}`));

  const oldUser = allMatching.find(u => u.id === oldUid);
  const newUser = allMatching.find(u => u.id !== oldUid);

  if (!oldUser) {
    console.error(`\n❌ Old user with UID ${oldUid} not found. Already reassigned?`);
    process.exit(1);
  }
  if (!newUser) {
    console.error(`\n❌ No new user found with email ${email}. Has this person signed up yet?`);
    process.exit(1);
  }

  const newUid = newUser.id;
  console.log(`\nOld UID (migrated 2025 account): ${oldUid}  [${oldUser.teamName}]`);
  console.log(`New UID (fresh Firebase account): ${newUid}  [${newUser.teamName}]`);

  // ── Count existing data so we can confirm ────────────────────────────────

  const [pickCount]   = await db.select().from(picks).where(eq(picks.userId, oldUid));
  const [trophyCount] = await db.select().from(trophies).where(eq(trophies.userId, oldUid));

  const totalPicks   = await db.select().from(picks).where(eq(picks.userId, oldUid));
  const totalTrophies = await db.select().from(trophies).where(eq(trophies.userId, oldUid));
  console.log(`\nData to migrate: ${totalPicks.length} picks, ${totalTrophies.length} trophies`);

  // ── Step 1: Update new user record with Gridiron status from old account ──

  await db.update(users).set({
    isGridiron: oldUser.isGridiron,
    isAdmin:    oldUser.isAdmin,
    isPremium:  oldUser.isPremium,
    nflAccess:  oldUser.nflAccess,
    updatedAt:  new Date(),
  }).where(eq(users.id, newUid));
  console.log('\n✓ Updated new user record with Gridiron/admin flags');

  // ── Step 2: Migrate all child records old → new ───────────────────────────

  const migratedPicks = await db
    .update(picks)
    .set({ userId: newUid })
    .where(eq(picks.userId, oldUid));
  console.log(`✓ Migrated picks`);

  await db.update(trophies).set({ userId: newUid }).where(eq(trophies.userId, oldUid));
  console.log(`✓ Migrated trophies`);

  await db.update(pushTokens).set({ userId: newUid }).where(eq(pushTokens.userId, oldUid));
  console.log(`✓ Migrated push tokens`);

  await db.update(tiebreakerPicks).set({ userId: newUid }).where(eq(tiebreakerPicks.userId, oldUid));
  console.log(`✓ Migrated tiebreaker picks`);

  await db.update(activityLog).set({ targetUserId: newUid }).where(eq(activityLog.targetUserId, oldUid));
  console.log(`✓ Migrated activity log`);

  // pick_audit_log has no FK constraint — raw SQL is fine
  await pool.query(`UPDATE pick_audit_log SET user_id = $1 WHERE user_id = $2`, [newUid, oldUid]);
  console.log(`✓ Migrated pick audit log`);

  // ── Step 3: Delete the old migrated record (no children left) ─────────────

  await db.delete(users).where(eq(users.id, oldUid));
  console.log(`✓ Deleted old migrated record`);

  console.log(`\n✅ Done! ${newUser.teamName} now has all 2025 picks and trophies.`);
  console.log(`   New UID: ${newUid}`);
  await pool.end();
}

main().catch(e => {
  console.error(e);
  pool.end();
  process.exit(1);
});
