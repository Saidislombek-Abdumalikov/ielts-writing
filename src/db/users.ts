import { db } from './index';
import { users } from './schema';
import { eq } from 'drizzle-orm';

export async function getUserById(id: number) {
  try {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  } catch (err) {
    console.error('Error in getUserById:', err);
    return undefined;
  }
}

export async function getUserByUsername(username: string) {
  if (!username) return undefined;
  const cleanUsername = username.trim().toLowerCase();
  try {
    const allUsers = await db.select().from(users);
    return allUsers.find(u => u.username && u.username.trim().toLowerCase() === cleanUsername);
  } catch (err) {
    console.error('Error querying getUserByUsername:', err);
    return undefined;
  }
}

export async function createUser(data: typeof users.$inferInsert) {
  const cleanData = {
    ...data,
    username: data.username.trim().toLowerCase()
  };
  const result = await db.insert(users).values(cleanData).returning();
  return result[0];
}
