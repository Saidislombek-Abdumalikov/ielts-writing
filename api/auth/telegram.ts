import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

interface TelegramUserPayload {
  id: number | string;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

/**
 * Validates Telegram WebApp initData string using HMAC-SHA256.
 */
function verifyTelegramWebAppData(initData: string, botToken: string): { isValid: boolean; user?: any } {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return { isValid: false };

    const authDate = parseInt(params.get('auth_date') || '0', 10);
    const now = Math.floor(Date.now() / 1000);
    // Ensure auth_date is within acceptable freshness (24 hours)
    if (!authDate || (now - authDate) > 86400) {
      return { isValid: false };
    }

    // Sort parameters alphabetically excluding hash
    const checkPairs: string[] = [];
    params.forEach((val, key) => {
      if (key !== 'hash') {
        checkPairs.push(`${key}=${val}`);
      }
    });
    checkPairs.sort();
    const dataCheckString = checkPairs.join('\n');

    // WebApp HMAC Secret: HMAC_SHA256("WebAppData", botToken)
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    const isValid = crypto.timingSafeEqual(Buffer.from(calculatedHash, 'hex'), Buffer.from(hash, 'hex'));
    if (!isValid) return { isValid: false };

    const userRaw = params.get('user');
    const user = userRaw ? JSON.parse(userRaw) : undefined;
    return { isValid: true, user };
  } catch (e) {
    console.error('Error in verifyTelegramWebAppData:', e);
    return { isValid: false };
  }
}

/**
 * Validates Telegram Login Widget payload using HMAC-SHA256.
 */
function verifyTelegramLoginWidget(payload: TelegramUserPayload, botToken: string): boolean {
  try {
    const { hash, ...data } = payload;
    if (!hash) return false;

    const authDate = Number(data.auth_date);
    const now = Math.floor(Date.now() / 1000);
    if (!authDate || (now - authDate) > 86400) {
      return false;
    }

    const checkPairs: string[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null && value !== '') {
        checkPairs.push(`${key}=${value}`);
      }
    }
    checkPairs.sort();
    const dataCheckString = checkPairs.join('\n');

    // Login Widget HMAC Secret: SHA256(botToken)
    const secretKey = crypto.createHash('sha256').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    return crypto.timingSafeEqual(Buffer.from(calculatedHash, 'hex'), Buffer.from(hash, 'hex'));
  } catch (e) {
    console.error('Error in verifyTelegramLoginWidget:', e);
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error('Server error: TELEGRAM_BOT_TOKEN is not configured.');
    return res.status(500).json({ error: 'Authentication service is temporarily unconfigured' });
  }

  const { initData, widgetData } = req.body || {};

  let verifiedUser: { id: string | number; first_name: string; last_name?: string; username?: string; photo_url?: string } | null = null;

  if (initData && typeof initData === 'string') {
    const result = verifyTelegramWebAppData(initData, botToken);
    if (!result.isValid || !result.user) {
      return res.status(401).json({ error: 'Invalid or expired Telegram WebApp authentication signature' });
    }
    verifiedUser = result.user;
  } else if (widgetData && typeof widgetData === 'object') {
    const isValid = verifyTelegramLoginWidget(widgetData, botToken);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid or expired Telegram Login Widget signature' });
    }
    verifiedUser = widgetData;
  } else {
    return res.status(400).json({ error: 'Missing Telegram authentication data' });
  }

  if (!verifiedUser || !verifiedUser.id) {
    return res.status(400).json({ error: 'Failed to extract Telegram user identity' });
  }

  const telegramId = String(verifiedUser.id);
  const telegramUsername = verifiedUser.username || `tg_${telegramId}`;
  const fullName = [verifiedUser.first_name, verifiedUser.last_name].filter(Boolean).join(' ') || telegramUsername;

  // Generate safe user identity response with default role 'student' if new
  const authenticatedUser = {
    telegramId,
    username: telegramUsername,
    name: fullName,
    photoUrl: verifiedUser.photo_url || null,
    authDate: Math.floor(Date.now() / 1000),
  };

  return res.status(200).json({
    success: true,
    user: authenticatedUser,
  });
}
