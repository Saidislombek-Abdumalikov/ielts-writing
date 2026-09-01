/**
 * Authentication Service
 * Handles client-server authentication flows, Telegram verification, and session resolution.
 */

import { getUserByTelegramId, getUserByUsername, createUser, updateUser, DbUser } from '../db';

export interface TelegramVerifiedIdentity {
  telegramId: string;
  username: string;
  name: string;
  photoUrl?: string | null;
  authDate: number;
}

export interface AuthSessionUser {
  id: string;
  telegramId?: string | null;
  username: string;
  name: string;
  email: string | null;
  role: 'student' | 'teacher' | 'admin';
  groupId?: string | null;
  teacherId?: string | null;
  photoUrl?: string | null;
}

/**
 * Sends cryptographic Telegram authentication data to the backend API for HMAC verification.
 */
export async function verifyTelegramWithBackend(payload: {
  initData?: string;
  widgetData?: any;
}): Promise<TelegramVerifiedIdentity> {
  const response = await fetch('/api/auth/telegram', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok || !data.success || !data.user) {
    throw new Error(data.error || 'Telegram verification failed. Please try again.');
  }

  return data.user as TelegramVerifiedIdentity;
}

/**
 * Resolves or registers an application user from verified Telegram credentials.
 * Ensures default role is strictly 'student' and never permits client self-promotion to 'admin'.
 */
export async function resolveTelegramUserSession(
  verified: TelegramVerifiedIdentity
): Promise<AuthSessionUser> {
  // 1. Check if user already exists by telegramId
  let existingUser = await getUserByTelegramId(verified.telegramId);

  // 2. Fallback: Check if user exists by username to link accounts
  if (!existingUser && verified.username) {
    existingUser = await getUserByUsername(verified.username);
    if (existingUser) {
      // Link the existing user account to this verified telegramId
      await updateUser(existingUser.id, {
        telegramId: verified.telegramId,
      });
      existingUser.telegramId = verified.telegramId;
    }
  }

  if (existingUser) {
    // Preserve existing database ID, role, group, and teacher linkage
    return {
      id: existingUser.id,
      telegramId: existingUser.telegramId || verified.telegramId,
      username: existingUser.username,
      name: existingUser.name,
      email: existingUser.email || null,
      role: existingUser.role,
      groupId: existingUser.groupId || null,
      teacherId: existingUser.teacherId || null,
      photoUrl: verified.photoUrl || null,
    };
  }

  // 3. User does not exist -> Create new student account (strictly 'student' role)
  const newUser = await createUser({
    telegramId: verified.telegramId,
    username: verified.username,
    name: verified.name,
    password: `tg_auth_${verified.telegramId}_${Date.now()}`,
    role: 'student', // Strict default: new accounts are always 'student'
  });

  return {
    id: newUser.id,
    telegramId: newUser.telegramId || verified.telegramId,
    username: newUser.username,
    name: newUser.name,
    email: newUser.email || null,
    role: newUser.role,
    groupId: newUser.groupId || null,
    teacherId: newUser.teacherId || null,
    photoUrl: verified.photoUrl || null,
  };
}
