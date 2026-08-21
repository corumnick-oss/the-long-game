"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("../db");
const drizzle_orm_1 = require("drizzle-orm");
async function main() {
    console.log('Adding notification preference columns to users (IF NOT EXISTS)...');
    await db_1.db.execute((0, drizzle_orm_1.sql) `
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS notify_week_unlocked boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS notify_week_locked boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS notify_week_summary boolean NOT NULL DEFAULT true
  `);
    console.log('Columns added (or already existed).');
}
main().catch(console.error).finally(() => process.exit(0));
//# sourceMappingURL=migrate-notification-prefs.js.map