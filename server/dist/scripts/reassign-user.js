"use strict";
/**
 * Reassigns a Gridiron's 2025 picks/trophies from their old UID to their new Firebase UID.
 *
 * Usage:
 *   npm run reassign:user -- --old BQMdo8NUOgY8n0QxdUophLPMewp2 --email cloud7king10@yahoo.com
 *
 * The script finds the new Firebase UID by looking up the user with that email
 * who is NOT the old UID, then migrates all data over.
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
Object.defineProperty(exports, "__esModule", { value: true });
const node_postgres_1 = require("drizzle-orm/node-postgres");
const pg_1 = require("pg");
const drizzle_orm_1 = require("drizzle-orm");
const schema = __importStar(require("../db/schema.js"));
const schema_js_1 = require("../db/schema.js");
const pool = new pg_1.Pool({
    connectionString: process.env['DATABASE_URL'],
    ssl: { rejectUnauthorized: false },
});
const db = (0, node_postgres_1.drizzle)(pool, { schema });
// ── Parse args ────────────────────────────────────────────────────────────────
function getArg(flag) {
    const idx = process.argv.indexOf(flag);
    return idx !== -1 ? process.argv[idx + 1] : undefined;
}
async function main() {
    const oldUid = getArg('--old');
    const email = getArg('--email');
    if (!oldUid || !email) {
        console.error('Usage: npm run reassign:user -- --old <OLD_UID> --email <EMAIL>');
        process.exit(1);
    }
    // ── Find both user records ─────────────────────────────────────────────────
    const allMatching = await db
        .select()
        .from(schema_js_1.users)
        .where((0, drizzle_orm_1.eq)(schema_js_1.users.email, email));
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
    const [pickCount] = await db.select().from(schema_js_1.picks).where((0, drizzle_orm_1.eq)(schema_js_1.picks.userId, oldUid));
    const [trophyCount] = await db.select().from(schema_js_1.trophies).where((0, drizzle_orm_1.eq)(schema_js_1.trophies.userId, oldUid));
    const totalPicks = await db.select().from(schema_js_1.picks).where((0, drizzle_orm_1.eq)(schema_js_1.picks.userId, oldUid));
    const totalTrophies = await db.select().from(schema_js_1.trophies).where((0, drizzle_orm_1.eq)(schema_js_1.trophies.userId, oldUid));
    console.log(`\nData to migrate: ${totalPicks.length} picks, ${totalTrophies.length} trophies`);
    // ── Step 1: Update new user record with Gridiron status from old account ──
    await db.update(schema_js_1.users).set({
        isGridiron: oldUser.isGridiron,
        isAdmin: oldUser.isAdmin,
        isPremium: oldUser.isPremium,
        nflAccess: oldUser.nflAccess,
        updatedAt: new Date(),
    }).where((0, drizzle_orm_1.eq)(schema_js_1.users.id, newUid));
    console.log('\n✓ Updated new user record with Gridiron/admin flags');
    // ── Step 2: Migrate all child records old → new ───────────────────────────
    const migratedPicks = await db
        .update(schema_js_1.picks)
        .set({ userId: newUid })
        .where((0, drizzle_orm_1.eq)(schema_js_1.picks.userId, oldUid));
    console.log(`✓ Migrated picks`);
    await db.update(schema_js_1.trophies).set({ userId: newUid }).where((0, drizzle_orm_1.eq)(schema_js_1.trophies.userId, oldUid));
    console.log(`✓ Migrated trophies`);
    await db.update(schema_js_1.seasonTrophies).set({ userId: newUid }).where((0, drizzle_orm_1.eq)(schema_js_1.seasonTrophies.userId, oldUid));
    console.log(`✓ Migrated season trophies`);
    await db.update(schema_js_1.pushTokens).set({ userId: newUid }).where((0, drizzle_orm_1.eq)(schema_js_1.pushTokens.userId, oldUid));
    console.log(`✓ Migrated push tokens`);
    await db.update(schema_js_1.tiebreakerPicks).set({ userId: newUid }).where((0, drizzle_orm_1.eq)(schema_js_1.tiebreakerPicks.userId, oldUid));
    console.log(`✓ Migrated tiebreaker picks`);
    await db.update(schema_js_1.activityLog).set({ targetUserId: newUid }).where((0, drizzle_orm_1.eq)(schema_js_1.activityLog.targetUserId, oldUid));
    console.log(`✓ Migrated activity log`);
    // pick_audit_log has no FK constraint — raw SQL is fine
    await pool.query(`UPDATE pick_audit_log SET user_id = $1 WHERE user_id = $2`, [newUid, oldUid]);
    console.log(`✓ Migrated pick audit log`);
    // ── Step 3: Delete the old migrated record (no children left) ─────────────
    await db.delete(schema_js_1.users).where((0, drizzle_orm_1.eq)(schema_js_1.users.id, oldUid));
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
//# sourceMappingURL=reassign-user.js.map