"use client";

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation'; // Corrected: use next/router for older Next.js versions or next/navigation for App Router
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface AdminAuthGuardProps {
  children: ReactNode;
}

const AdminAuthGuard = ({ children }: AdminAuthGuardProps) => {
  const { isAdminAuthenticated, loading } = useAuth();
  const router = useRouter(); 

  useEffect(() => {
    if (!loading && !isAdminAuthenticated) {
      router.push('/admin/login');
    }
  }, [isAdminAuthenticated, loading, router]);

  if (loading || !isAdminAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Verifying admin access...</p>
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminAuthGuard;
