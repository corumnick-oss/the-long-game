import { db } from '../db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Creating weekly_bonus_optins table (IF NOT EXISTS)...');
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS weekly_bonus_optins (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      user_id text NOT NULL REFERENCES users(id),
      week integer NOT NULL,
      season integer NOT NULL,
      season_type text DEFAULT 'regular' NOT NULL,
      sport text DEFAULT 'nfl' NOT NULL,
      created_at timestamp DEFAULT now() NOT NULL,
      UNIQUE(user_id, week, season, season_type, sport)
    )
  `);
  console.log('Table created (or already existed).');
}

main().catch(console.error).finally(() => process.exit(0));
