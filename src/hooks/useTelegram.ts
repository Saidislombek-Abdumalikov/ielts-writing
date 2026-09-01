import { useEffect, useState } from 'react';
import { TelegramWebAppUser, parseTelegramInitData } from '../lib/telegramAuth';

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramWebAppUser;
    query_id?: string;
    auth_date?: number;
    hash?: string;
  };
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  expand: () => void;
  close: () => void;
  ready: () => void;
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    onClick: (fn: () => void) => void;
    offClick: (fn: () => void) => void;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export function useTelegram() {
  const [isTelegram, setIsTelegram] = useState(false);
  const [tgUser, setTgUser] = useState<TelegramWebAppUser | null>(null);
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg && tg.initData) {
      setIsTelegram(true);
      tg.ready();
      tg.expand();

      if (tg.initDataUnsafe?.user) {
        setTgUser(tg.initDataUnsafe.user);
      } else {
        const parsed = parseTelegramInitData(tg.initData);
        if (parsed?.user) setTgUser(parsed.user);
      }

      if (tg.colorScheme) {
        setColorScheme(tg.colorScheme);
      }
    }
  }, []);

  const triggerHaptic = (style: 'light' | 'medium' | 'heavy' | 'error' | 'success' | 'warning' = 'light') => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;
    try {
      if (style === 'light' || style === 'medium' || style === 'heavy') {
        tg.HapticFeedback?.impactOccurred(style);
      } else {
        tg.HapticFeedback?.notificationOccurred(style);
      }
    } catch {
      // Ignore if not supported in test environments
    }
  };

  return {
    isTelegram,
    tgUser,
    colorScheme,
    webApp: window.Telegram?.WebApp,
    triggerHaptic,
  };
}
