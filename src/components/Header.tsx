
"use client";

import Link from 'next/link';
import Logo from './Logo';
import KinglyAgentIcon from './KinglyAgentIcon'; // Import the new icon
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, LogIn, LayoutDashboard, HomeIcon } from 'lucide-react';

const Header = () => {
  const { isAdminAuthenticated, logout, loading } = useAuth();

  return (
    <header className="bg-background/80 backdrop-blur-md sticky top-0 z-50 border-b border-border">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between">
        <Link href="/" className="group flex items-center space-x-2">
          <KinglyAgentIcon className="h-10 w-10 text-primary group-hover:text-accent transition-colors duration-300" /> {/* Added Icon */}
          <Logo className="h-12 w-auto" />
        </Link>
        <nav className="flex items-center space-x-2 sm:space-x-4">
          <Button variant="ghost" asChild className="hover:text-primary transition-colors">
            <Link href="/">
              <HomeIcon className="mr-2 h-4 w-4 sm:hidden" />
              <span className="hidden sm:inline">Home</span>
            </Link>
          </Button>
          {!loading && (
            isAdminAuthenticated ? (
              <>
                <Button variant="ghost" asChild className="hover:text-primary transition-colors">
                  <Link href="/admin/dashboard">
                    <LayoutDashboard className="mr-2 h-4 w-4 sm:hidden" />
                     <span className="hidden sm:inline">Dashboard</span>
                  </Link>
                </Button>
                <Button variant="ghost" onClick={logout} className="hover:text-destructive transition-colors">
                  <LogOut className="mr-2 h-4 w-4 sm:hidden" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </>
            ) : (
              <Button variant="ghost" asChild className="hover:text-primary transition-colors">
                <Link href="/admin/login">
                  <LogIn className="mr-2 h-4 w-4 sm:hidden" />
                   <span className="hidden sm:inline">Admin Login</span>
                </Link>
              </Button>
            )
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
