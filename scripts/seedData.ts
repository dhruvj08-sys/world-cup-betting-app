import { db } from '../src/db/index.js';
import { matches, users } from '../src/db/schema.js';

async function seed() {
  console.log("Seeding remote database...");
  const now = new Date();
  
  // Insert system user
  await db.insert(users).values({
    id: 1,
    uid: 'system_webhook',
    email: 'system@worldcup.com',
    displayName: 'System Automation',
    isGlobalAdmin: true
  }).onConflictDoNothing();

  await db.insert(matches).values([
    { teamA: "Germany", teamAFlag: "🇩🇪", teamB: "Scotland", teamBFlag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", stage: "Group Stage", groupName: "Group A", kickoffTime: new Date(now.getTime() - 1000 * 60 * 60 * 48), lockTime: new Date(now.getTime() - 1000 * 60 * 60 * 48 - 1000 * 60 * 10), status: 'finished', scoreA: 5, scoreB: 1, poolStatus: 'eligible' },
    { teamA: "Hungary", teamAFlag: "🇭🇺", teamB: "Switzerland", teamBFlag: "🇨🇭", stage: "Group Stage", groupName: "Group A", kickoffTime: new Date(now.getTime() - 1000 * 60 * 60 * 24), lockTime: new Date(now.getTime() - 1000 * 60 * 60 * 24 - 1000 * 60 * 10), status: 'finished', scoreA: 1, scoreB: 3, poolStatus: 'eligible' },
    { teamA: "Slovenia", teamAFlag: "🇸🇮", teamB: "Denmark", teamBFlag: "🇩🇰", stage: "Group Stage", groupName: "Group C", kickoffTime: new Date(now.getTime() - 1000 * 60 * 10), lockTime: new Date(now.getTime() - 1000 * 60 * 10 - 1000 * 60 * 10), status: 'scheduled', scoreA: null, scoreB: null, poolStatus: 'eligible' },
  ]);

  console.log("Database successfully seeded!");
  process.exit(0);
}

seed().catch(console.error);
