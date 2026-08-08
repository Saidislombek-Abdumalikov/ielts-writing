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
    async function init() {
      // Seed default accounts on first load
      try {
        await seedDefaultAccounts();
      } catch (e) {
        console.error('Seed error:', e);
      }

      // Restore session from localStorage
      const savedUserId = localStorage.getItem('userId');
      if (savedUserId) {
        try {
          const user = await getUserById(savedUserId);
          if (user) {
            setDbUser({ id: user.id, username: user.username, name: user.name, email: user.email, role: user.role });
            setIsImpersonating(Boolean(localStorage.getItem('originalAdminUserId')));
          } else {
            localStorage.removeItem('userId');
            localStorage.removeItem('originalAdminUserId');
          }
        } catch {
          localStorage.removeItem('userId');
          localStorage.removeItem('originalAdminUserId');
        }
      }
      setLoading(false);
    }
    init();
  }, []);

  const login = async (username: string, password: string): Promise<User> => {
    const user = await getUserByUsername(username);
    if (!user) throw new Error('User does not exist. Please check your username.');
    
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) throw new Error('Incorrect password. Please try again.');
    
    const safeUser: User = { id: user.id, username: user.username, name: user.name, email: user.email, role: user.role };
    localStorage.setItem('userId', user.id);
    localStorage.removeItem('originalAdminUserId');
    setDbUser(safeUser);
    setIsImpersonating(false);
    return safeUser;
  };

  const signIn = (user: User) => {
    localStorage.setItem('userId', user.id);
    localStorage.removeItem('originalAdminUserId');
    setDbUser(user);
    setIsImpersonating(false);
  };

  const signOut = () => {
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
    
    localStorage.setItem('userId', targetUser.id);
    setDbUser({ id: targetUser.id, username: targetUser.username, name: targetUser.name, email: targetUser.email, role: targetUser.role });
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
        setDbUser({ id: admin.id, username: admin.username, name: admin.name, email: admin.email, role: admin.role });
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
