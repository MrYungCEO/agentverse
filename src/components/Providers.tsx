"use client";

import type { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { TemplateProvider } from '@/contexts/TemplateContext';

export const AppProviders = ({ children }: { children: ReactNode }) => {
  return (
    <AuthProvider>
      <TemplateProvider>
        {children}
      </TemplateProvider>
    </AuthProvider>
  );
};
