import React, { createContext, useContext, useEffect, useState } from 'react';
import { getUserById, getUserByUsername, verifyPassword, seedDefaultAccounts } from '../lib/db';

interface User {
  id: string;
  username: string;
  name: string;
  email: string | null;
  role: 'teacher' | 'student' | 'admin';
}

interface AuthContextType {
  dbUser: User | null;
  loading: boolean;
  isImpersonating: boolean;
  signIn: (user: User) => void;
  signOut: () => void;
  impersonateUser: (targetUserId: string) => Promise<void>;
  exitImpersonation: () => Promise<void>;
  login: (username: string, password: string) => Promise<User>;
}

const AuthContext = createContext<AuthContextType>({
  dbUser: null,
  loading: true,
  isImpersonating: false,
  signIn: () => {},
  signOut: () => {},
  impersonateUser: async () => {},
  exitImpersonation: async () => {},
  login: async () => { throw new Error('Not initialized'); },
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dbUser, setDbUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('originalAdminUserId'));
  });

  useEffect(() => {
    let mounted = true;

    // Run seeding/purge in background without blocking initial app render
    seedDefaultAccounts().catch(e => console.warn('Background seed warning:', e));

    async function init() {
      try {
        const savedUserId = localStorage.getItem('userId');
        if (savedUserId) {
          // 1. Try restoring from local cached user profile first (instant offline protection)
          const localCachedRaw = localStorage.getItem(`user_profile_cache_${savedUserId}`);
          if (localCachedRaw) {
            try {
              const cachedUser = JSON.parse(localCachedRaw) as User;
              if (cachedUser && mounted) {
                setDbUser(cachedUser);
                setIsImpersonating(Boolean(localStorage.getItem('originalAdminUserId')));
              }
            } catch {
              // Ignore JSON parse error
            }
          }

          // 2. Fetch fresh user data from server if online
          if (navigator.onLine) {
            try {
              const user = await getUserById(savedUserId);
              if (user && mounted) {
                const safeUser: User = { id: user.id, username: user.username, name: user.name, email: user.email, role: user.role };
                setDbUser(safeUser);
                localStorage.setItem(`user_profile_cache_${user.id}`, JSON.stringify(safeUser));
                setIsImpersonating(Boolean(localStorage.getItem('originalAdminUserId')));
              } else if (!localCachedRaw) {
                localStorage.removeItem('userId');
                localStorage.removeItem('originalAdminUserId');
                setDbUser(null);
              }
            } catch (e) {
              console.warn('Network load note, preserving cached offline user session:', e);
            }
          }
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    // Safety timeout: ensure loading is NEVER true for more than 1.5 seconds
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 1500);

    init();

    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, []);

  const login = async (username: string, password: string): Promise<User> => {
    const user = await getUserByUsername(username);
    if (!user) throw new Error('User does not exist. Please check your username.');
    
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) throw new Error('Incorrect password. Please try again.');
    
    const safeUser: User = { id: user.id, username: user.username, name: user.name, email: user.email, role: user.role };
    localStorage.setItem('userId', user.id);
    localStorage.setItem(`user_profile_cache_${user.id}`, JSON.stringify(safeUser));
    localStorage.removeItem('originalAdminUserId');
    setDbUser(safeUser);
    setIsImpersonating(false);
    return safeUser;
  };

  const signIn = (user: User) => {
    localStorage.setItem('userId', user.id);
    localStorage.setItem(`user_profile_cache_${user.id}`, JSON.stringify(user));
    localStorage.removeItem('originalAdminUserId');
    setDbUser(user);
    setIsImpersonating(false);
  };

  const signOut = () => {
    const currentUserId = localStorage.getItem('userId');
    if (currentUserId) {
      localStorage.removeItem(`user_profile_cache_${currentUserId}`);
    }
    localStorage.removeItem('userId');
    localStorage.removeItem('originalAdminUserId');
    setDbUser(null);
    setIsImpersonating(false);
  };

  const impersonateUser = async (targetUserId: string) => {
    const currentUserId = localStorage.getItem('userId');
    const existingAdminId = localStorage.getItem('originalAdminUserId');
    
    if (!existingAdminId && currentUserId) {
      localStorage.setItem('originalAdminUserId', currentUserId);
    }

    const targetUser = await getUserById(targetUserId);
    if (!targetUser) throw new Error('User not found');
    
    const safeUser: User = { id: targetUser.id, username: targetUser.username, name: targetUser.name, email: targetUser.email, role: targetUser.role };
    localStorage.setItem('userId', targetUser.id);
    localStorage.setItem(`user_profile_cache_${targetUser.id}`, JSON.stringify(safeUser));
    setDbUser(safeUser);
    setIsImpersonating(true);
  };

  const exitImpersonation = async () => {
    const adminId = localStorage.getItem('originalAdminUserId');
    if (adminId) {
      localStorage.setItem('userId', adminId);
      localStorage.removeItem('originalAdminUserId');
      setIsImpersonating(false);
      const admin = await getUserById(adminId);
      if (admin) {
        const safeUser: User = { id: admin.id, username: admin.username, name: admin.name, email: admin.email, role: admin.role };
        setDbUser(safeUser);
        localStorage.setItem(`user_profile_cache_${admin.id}`, JSON.stringify(safeUser));
      }
    }
  };

  return (
    <AuthContext.Provider value={{ dbUser, loading, isImpersonating, signIn, signOut, impersonateUser, exitImpersonation, login }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
