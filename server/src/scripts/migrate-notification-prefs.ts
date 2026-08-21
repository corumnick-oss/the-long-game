import { db } from '../db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Adding notification preference columns to users (IF NOT EXISTS)...');
  await db.execute(sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS notify_week_unlocked boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS notify_week_locked boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS notify_week_summary boolean NOT NULL DEFAULT true
  `);
  console.log('Columns added (or already existed).');
}

main().catch(console.error).finally(() => process.exit(0));
