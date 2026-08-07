import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

interface User {
  id: number;
  username: string;
  name: string;
  email: string | null;
  role: 'teacher' | 'student' | 'admin';
}

interface AuthContextType {
  dbUser: User | null;
  loading: boolean;
  isImpersonating: boolean;
  signIn: (token: string, user: User) => void;
  signOut: () => void;
  impersonateUser: (targetUserId: number) => Promise<void>;
  exitImpersonation: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  dbUser: null,
  loading: true,
  isImpersonating: false,
  signIn: () => {},
  signOut: () => {},
  impersonateUser: async () => {},
  exitImpersonation: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dbUser, setDbUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('originalAdminToken'));
  });

  const fetchCurrentUser = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const user = await api.get('/api/users/me');
        setDbUser(user);
        setIsImpersonating(Boolean(localStorage.getItem('originalAdminToken')));
      } catch (error) {
        console.error("Failed to fetch user, token invalid");
        localStorage.removeItem('token');
        localStorage.removeItem('originalAdminToken');
        setDbUser(null);
        setIsImpersonating(false);
      }
    } else {
      setDbUser(null);
      setIsImpersonating(false);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const signIn = (token: string, user: User) => {
    localStorage.setItem('token', token);
    localStorage.removeItem('originalAdminToken');
    setDbUser(user);
    setIsImpersonating(false);
  };

  const signOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('originalAdminToken');
    setDbUser(null);
    setIsImpersonating(false);
  };

  const impersonateUser = async (targetUserId: number) => {
    const currentToken = localStorage.getItem('token');
    const existingAdminToken = localStorage.getItem('originalAdminToken');

    // Save admin token if not saved yet
    if (!existingAdminToken && currentToken) {
      localStorage.setItem('originalAdminToken', currentToken);
    }

    const data = await api.post(`/api/auth/impersonate/${targetUserId}`, {});
    localStorage.setItem('token', data.token);
    setDbUser(data.user);
    setIsImpersonating(true);
  };

  const exitImpersonation = async () => {
    const adminToken = localStorage.getItem('originalAdminToken');
    if (adminToken) {
      localStorage.setItem('token', adminToken);
      localStorage.removeItem('originalAdminToken');
      setIsImpersonating(false);
      await fetchCurrentUser();
    }
  };

  return (
    <AuthContext.Provider value={{ dbUser, loading, isImpersonating, signIn, signOut, impersonateUser, exitImpersonation }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
