import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function migrate() {
  const { db } = await import('../src/db/index.js');
  const { sql } = await import('drizzle-orm');

  const test = await db.execute(sql`SELECT 1 as ok`);
  console.log('Connected OK');

  await db.execute(sql`DELETE FROM score_events`);
  await db.execute(sql`DELETE FROM picks`);
  await db.execute(sql`DELETE FROM matches`);
  console.log('Cleared old data');

  try {
    await db.execute(sql`ALTER TABLE matches ADD CONSTRAINT matches_external_id_unique UNIQUE (external_id)`);
    console.log('Added unique constraint on external_id');
  } catch (e: any) {
    if (e.message?.includes('already exists')) {
      console.log('Unique constraint already exists');
    } else {
      console.log('Constraint note:', e.message?.substring(0, 100));
    }
  }

  await db.execute(sql`ALTER TABLE room_members ADD COLUMN IF NOT EXISTS amount_paid INTEGER NOT NULL DEFAULT 0`);
  console.log('Ensured amount_paid column exists');

  console.log('Schema migration complete');
  process.exit(0);
}

migrate().catch(e => { console.error(e); process.exit(1); });
