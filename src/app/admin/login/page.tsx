
"use client";

import { useState, type FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { KeyRound, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';


export default function AdminLoginPage() {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const { login, isAdminAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // This effect handles redirecting if the user becomes authenticated
  // or if they were already authenticated when landing on this page (after auth state is loaded).
  useEffect(() => {
    if (!authLoading && isAdminAuthenticated) {
      router.push('/admin/dashboard');
    }
  }, [authLoading, isAdminAuthenticated, router]);

  // If still loading auth state, or if already authenticated and redirect is in progress, show minimal UI or null.
  if (authLoading || (!authLoading && isAdminAuthenticated)) {
    return null; // Or a loading spinner if preferred during the brief moment before redirect
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (login(token)) {
      toast({
        title: "Login Successful",
        description: "Redirecting to dashboard...",
        variant: "default",
      });
      // The useEffect above will handle the redirect once isAdminAuthenticated is true.
    } else {
      setError('Invalid admin token. Please try again.');
      toast({
        title: "Login Failed",
        description: "Invalid admin token.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-10rem)] py-12">
      <Card className="w-full max-w-md shadow-2xl shadow-primary/20 border-border">
        <CardHeader className="text-center">
          <KeyRound className="mx-auto h-12 w-12 text-primary mb-4" />
          <CardTitle className="text-3xl font-bold">Admin Access</CardTitle>
          <CardDescription>Enter your secure token to manage AgentVerse templates.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Input
                id="token"
                type="password"
                placeholder="Enter your admin token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                className="text-lg px-4 py-6"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive flex items-center">
                <ShieldAlert className="h-4 w-4 mr-2"/> {error}
              </p>
            )}
            <Button type="submit" className="w-full text-lg py-6 glow-button">
              Unlock Dashboard
            </Button>
          </form>
        </CardContent>
         <CardFooter className="text-xs text-muted-foreground text-center block">
          <p>This area is restricted. Ensure you have authorization before attempting to log in.</p>
          <p className="mt-2">For development, default token is "Khalifa888$" or check .env.local for NEXT_PUBLIC_ADMIN_TOKEN.</p>
        </CardFooter>
      </Card>
    </div>
  );
}
