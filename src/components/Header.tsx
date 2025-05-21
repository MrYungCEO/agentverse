
"use client";

import Link from 'next/link';
import Logo from './Logo';
import KinglyAgentIcon from './KinglyAgentIcon';
import { SidebarTrigger } from '@/components/ui/sidebar'; // Import SidebarTrigger

const Header = () => {
  // useAuth hook is no longer needed here as nav items are in ClientSidebarMenu
  // const { isAdminAuthenticated, logout, loading } = useAuth(); 

  return (
    <header className="bg-background/80 backdrop-blur-md sticky top-0 z-50 border-b border-border">
      <div className="container mx-auto px-4 h-20 flex items-center"> {/* Removed justify-between to allow trigger on left */}
        <div className="flex items-center space-x-2 sm:space-x-4"> {/* Wrapper for trigger and logo */}
          <SidebarTrigger className="md:hidden" /> {/* SidebarTrigger, hidden on md and up if sidebar is static, or always visible */}
          {/* Forcing trigger to be visible on all screen to demonstrate desktop toggle too */}
          {/* <SidebarTrigger />  // Use this if you want it always visible, even on desktop */}
          
          <Link href="/" className="group flex items-center space-x-2">
            <KinglyAgentIcon className="h-10 w-10 text-primary group-hover:text-accent transition-colors duration-300" />
            <Logo className="h-12 w-auto" />
          </Link>
        </div>
        
        {/* The navigation <nav> has been removed as its items are now in ClientSidebarMenu within the Sidebar */}
        {/* Add other header elements here if needed, e.g., user profile, search bar, etc. */}
      </div>
    </header>
  );
};

export default Header;
