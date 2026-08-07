import { db } from './index';
import { users } from './schema';
import { eq } from 'drizzle-orm';

export async function getUserById(id: number) {
  const result = await db.select().from(users).where(eq(users.id, id));
  return result[0];
}

export async function getUserByUsername(username: string) {
  if (!username) return undefined;
  const cleanUsername = username.trim().toLowerCase();
  const allUsers = await db.select().from(users);
  return allUsers.find(u => u.username.trim().toLowerCase() === cleanUsername);
}

export async function createUser(data: typeof users.$inferInsert) {
  const cleanData = {
    ...data,
    username: data.username.trim().toLowerCase()
  };
  const result = await db.insert(users).values(cleanData).returning();
  return result[0];
}
