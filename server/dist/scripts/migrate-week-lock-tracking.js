"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("../db");
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("../db/schema");
const lockTime_1 = require("../utils/lockTime");
// Adds the two lock-tracking columns, then backfills every EXISTING unlocked_weeks row so the
// new dynamic lock-check cron (scheduler.ts) doesn't treat years of already-passed weeks as
// "pending" on its very first tick after deploy -- that would resend "Picks locked" pushes and
// proof-of-picks emails for every already-finished week in history. Only the currently-open
// week (whose real lock time hasn't passed yet as of when this runs) is deliberately left
// unmarked, so it still gets its real reminder/lock actions fired for real when its lock time
// actually arrives.
async function main() {
    console.log('Adding lock-tracking columns to unlocked_weeks (IF NOT EXISTS)...');
    await db_1.db.execute((0, drizzle_orm_1.sql) `
    ALTER TABLE unlocked_weeks
    ADD COLUMN IF NOT EXISTS reminder_sent_at timestamp,
    ADD COLUMN IF NOT EXISTS lock_processed_at timestamp
  `);
    console.log('Columns added (or already existed).');
    const rows = await db_1.db.query.unlockedWeeks.findMany();
    const now = new Date();
    let backfilled = 0;
    let leftPending = 0;
    for (const row of rows) {
        const seasonType = row.seasonType;
        const lockTime = await (0, lockTime_1.getWeekLockTime)(row.week, row.season, seasonType);
        if (lockTime && lockTime <= now) {
            await db_1.db.update(schema_1.unlockedWeeks)
                .set({ reminderSentAt: lockTime, lockProcessedAt: lockTime })
                .where((0, drizzle_orm_1.sql) `${schema_1.unlockedWeeks.id} = ${row.id}`);
            backfilled++;
        }
        else {
            // Lock time is in the future (or unknown) -- this is the currently-open week. Leave both
            // columns NULL so the dynamic cron fires its real reminder + lock actions on schedule.
            leftPending++;
        }
    }
    console.log(`Backfilled ${backfilled} already-locked week(s) as processed; left ${leftPending} currently-open week(s) pending.`);
}
main().catch(console.error).finally(() => process.exit(0));
//# sourceMappingURL=migrate-week-lock-tracking.js.map