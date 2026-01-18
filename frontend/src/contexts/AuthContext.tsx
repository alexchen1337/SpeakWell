'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useMemo, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { authService } from '@/services/auth';

interface User {
  id: string;
  email: string;
  name: string;
  role?: string;
  organization?: string;
  group?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  refreshAuth: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const hasCheckedAuth = useRef(false);

  const checkAuth = async () => {
    try {
      const userData = await authService.getCurrentUser();
      setUser(userData);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const isAuthPage = pathname?.startsWith('/login') || pathname?.startsWith('/auth');
    
    if (!hasCheckedAuth.current && !isAuthPage) {
      hasCheckedAuth.current = true;
      checkAuth();
    } else if (isAuthPage) {
      setLoading(false);
    }
  }, [pathname]);

  const login = useCallback(() => {
    router.push('/login');
  }, [router]);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (error) {
      // ignore logout errors
    }
    setUser(null);
    authService.clearCache();
    router.push('/login');
  }, [router]);

  const refreshAuth = useCallback(async () => {
    hasCheckedAuth.current = false;
    await checkAuth();
  }, []);

  const refreshUser = useCallback(async () => {
    authService.clearCache();
    await checkAuth();
  }, []);

  const contextValue = useMemo(() => ({
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
    refreshAuth,
    refreshUser,
  }), [user, loading, login, logout, refreshAuth, refreshUser]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

