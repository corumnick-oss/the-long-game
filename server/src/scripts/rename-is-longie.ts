import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'is_longie'
    `);
    if (rows.length === 0) {
      console.log('Column is_longie not found — already renamed or never existed.');
      return;
    }
    await client.query('ALTER TABLE users RENAME COLUMN is_longie TO is_gridiron');
    console.log('Done: renamed users.is_longie → users.is_gridiron');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
