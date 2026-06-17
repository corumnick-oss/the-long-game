import { db } from '../db';
import * as schema from '../db/schema';
import { eq, sql } from 'drizzle-orm';

async function main() {
  console.log('Adding season_type column to unlocked_weeks (IF NOT EXISTS)...');
  await db.execute(sql`
    ALTER TABLE unlocked_weeks
    ADD COLUMN IF NOT EXISTS season_type text NOT NULL DEFAULT 'regular'
  `);
  console.log('Column added (or already existed).');

  // Clear any stale 2026 unlock rows — admin will re-unlock preseason week 1
  const deleted = await db.delete(schema.unlockedWeeks)
    .where(eq(schema.unlockedWeeks.season, 2026))
    .returning({ id: schema.unlockedWeeks.id });
  console.log(`Deleted ${deleted.length} stale unlocked_weeks rows for 2026.`);
  console.log('Done. Admin should re-unlock preseason week 1 from the NFL Tools tab.');
}

main().catch(console.error).finally(() => process.exit(0));
