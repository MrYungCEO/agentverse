"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  isAdminAuthenticated: boolean;
  login: (token: string) => boolean;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// It's better to put this in .env.local, but for scaffolding purposes:
const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN || "SUPER_SECRET_TOKEN"; 
const AUTH_STORAGE_KEY = 'agentverse_admin_auth';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    try {
      const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
      if (storedAuth === 'true') {
        setIsAdminAuthenticated(true);
      }
    } catch (error) {
      console.error("Failed to access localStorage:", error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading && !isAdminAuthenticated && pathname?.startsWith('/admin') && pathname !== '/admin/login') {
      router.push('/admin/login');
    }
  }, [isAdminAuthenticated, loading, pathname, router]);

  const login = useCallback((token: string): boolean => {
    if (token === ADMIN_TOKEN) {
      setIsAdminAuthenticated(true);
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, 'true');
      } catch (error) {
        console.error("Failed to access localStorage:", error);
      }
      return true;
    }
    return false;
  }, [router]);

  const logout = useCallback(() => {
    setIsAdminAuthenticated(false);
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (error) {
      console.error("Failed to access localStorage:", error);
    }
    router.push('/admin/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ isAdminAuthenticated, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
