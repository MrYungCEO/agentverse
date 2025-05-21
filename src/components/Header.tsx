
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
        <div className="flex items-center space-x-2 sm:space-x-4"> {/* Wrapper for trigger */}
          <SidebarTrigger className="" /> {/* SidebarTrigger, always visible */}
          {/* The Logo and KinglyAgentIcon are removed from here as they are in SidebarHeader */}
        </div>
        
        {/* The navigation <nav> has been removed as its items are now in ClientSidebarMenu within the Sidebar */}
        {/* Add other header elements here if needed, e.g., user profile, search bar, etc. */}
      </div>
    </header>
  );
};

export default Header;
