import { db } from './index.ts';
import { users } from './schema.ts';
import { eq } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string, displayName?: string, avatarUrl?: string) {
  // Generate a fallback display name if missing
  const finalDisplayName = displayName || (email ? email.split('@')[0] : 'Guest');

  // Use upsert to handle concurrent inserts of the same user ID safely.
  const result = await db.insert(users)
    .values({
      uid,
      email: email || '',
      displayName: finalDisplayName,
      avatarUrl: avatarUrl || null,
    })
    .onConflictDoUpdate({
      target: users.uid,
      set: {
        email: email || '',
        displayName: finalDisplayName,
        avatarUrl: avatarUrl || null,
      },
    })
    .returning();

  return result[0];
}
