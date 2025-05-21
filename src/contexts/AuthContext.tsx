
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
const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN || "Khalifa888$";
const AUTH_STORAGE_KEY = 'agentverse_admin_auth';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true); // Initialize loading to true
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setLoading(true); // Set loading to true when starting to check auth status
    try {
      const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
      if (storedAuth === 'true') {
        setIsAdminAuthenticated(true);
      } else {
        setIsAdminAuthenticated(false); // Ensure it's false if not 'true'
      }
    } catch (error) {
      console.error("Failed to access localStorage:", error);
      setIsAdminAuthenticated(false); // Assume not authenticated on error
    }
    setLoading(false); // Set loading to false after checking
  }, []); // Runs once on mount

  useEffect(() => {
    if (!loading) { // Only run redirection logic after initial auth check is complete
      if (!isAdminAuthenticated && pathname?.startsWith('/admin') && pathname !== '/admin/login') {
        router.push('/admin/login');
      }
      // If user is authenticated and on login page, AdminLoginPage's own effect will redirect to dashboard.
    }
  }, [isAdminAuthenticated, loading, pathname, router]);

  const login = useCallback((token: string): boolean => {
    if (token === ADMIN_TOKEN) {
      setLoading(true); // Indicate state is changing
      setIsAdminAuthenticated(true);
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, 'true');
      } catch (error) {
        console.error("Failed to access localStorage:", error);
      }
      setLoading(false);
      return true;
    }
    return false;
  }, []); // No dependencies needed that change

  const logout = useCallback(() => {
    setLoading(true); // Indicate state is changing
    setIsAdminAuthenticated(false);
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (error) {
      console.error("Failed to access localStorage:", error);
    }
    router.push('/admin/login'); // Direct navigation after logout
    setLoading(false);
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
