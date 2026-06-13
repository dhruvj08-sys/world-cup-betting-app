import { eq } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { matches } from '../src/db/schema.js';

// Mock response from an external API like API-Football
const mockApiFixtures = [
  { fixture: { id: 8651 }, teams: { home: { name: "Germany" }, away: { name: "Scotland" } } },
  { fixture: { id: 8652 }, teams: { home: { name: "Hungary" }, away: { name: "Switzerland" } } },
  { fixture: { id: 8653 }, teams: { home: { name: "Spain" }, away: { name: "Croatia" } } },
  { fixture: { id: 8654 }, teams: { home: { name: "Italy" }, away: { name: "Albania" } } },
  { fixture: { id: 8655 }, teams: { home: { name: "Slovenia" }, away: { name: "Denmark" } } },
  { fixture: { id: 8656 }, teams: { home: { name: "Serbia" }, away: { name: "England" } } },
  { fixture: { id: 8657 }, teams: { home: { name: "Poland" }, away: { name: "Netherlands" } } },
  { fixture: { id: 8658 }, teams: { home: { name: "Austria" }, away: { name: "France" } } },
];

async function syncFixtures() {
  console.log("Fetching internal matches...");
  const internalMatches = await db.select().from(matches);

  console.log(`Found ${internalMatches.length} internal matches. Syncing with external API data...`);

  for (const match of internalMatches) {
    // Attempt fuzzy matching by team names
    const mappedFixture = mockApiFixtures.find(
      (f) =>
        f.teams.home.name.includes(match.teamA) &&
        f.teams.away.name.includes(match.teamB)
    );

    if (mappedFixture) {
      console.log(`Mapping Match ${match.id} (${match.teamA} vs ${match.teamB}) to externalId: ${mappedFixture.fixture.id}`);
      await db.update(matches)
        .set({ externalId: mappedFixture.fixture.id.toString() })
        .where(eq(matches.id, match.id));
    } else {
      console.log(`Could not find external mapping for Match ${match.id} (${match.teamA} vs ${match.teamB})`);
    }
  }

  console.log("Sync complete!");
  process.exit(0);
}

syncFixtures().catch(console.error);
