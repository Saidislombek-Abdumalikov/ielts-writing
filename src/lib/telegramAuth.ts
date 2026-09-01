/**
 * Telegram Authentication Verification Contract & WebApp InitData Helper.
 * Prepares the architecture for Telegram Bot authentication -> WebApp InitData validation -> Supabase JWT Session binding.
 */

export interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export interface ParsedTelegramInitData {
  query_id?: string;
  user?: TelegramWebAppUser;
  auth_date: number;
  hash: string;
}

/**
 * Parses raw Telegram WebApp initData string into structured object.
 */
export function parseTelegramInitData(initDataStr: string): ParsedTelegramInitData | null {
  if (!initDataStr) return null;
  try {
    const params = new URLSearchParams(initDataStr);
    const authDate = parseInt(params.get('auth_date') || '0', 10);
    const hash = params.get('hash') || '';
    const userRaw = params.get('user');
    const user = userRaw ? JSON.parse(userRaw) as TelegramWebAppUser : undefined;

    return {
      query_id: params.get('query_id') || undefined,
      user,
      auth_date: authDate,
      hash,
    };
  } catch (e) {
    console.warn('Failed to parse Telegram initData:', e);
    return null;
  }
}

/**
 * Validates if Telegram initData authentication timestamp is within acceptable window (e.g. 24 hours).
 */
export function isTelegramAuthFresh(authDate: number, maxAgeSeconds = 86400): boolean {
  if (!authDate) return false;
  const now = Math.floor(Date.now() / 1000);
  return (now - authDate) <= maxAgeSeconds;
}
