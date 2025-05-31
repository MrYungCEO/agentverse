
"use client";

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { HomeIcon, LayoutDashboard, LogIn, LogOut, Settings } from 'lucide-react'; // Removed Wand2
import { usePathname } from 'next/navigation';

export default function ClientSidebarMenu() {
  const { isAdminAuthenticated, logout, loading } = useAuth();
  const pathname = usePathname();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={pathname === "/"} tooltip="Home">
          <Link href="/">
            <HomeIcon />
            <span>Home</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>

      {!loading && isAdminAuthenticated && (
        <>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith('/admin/dashboard')} tooltip="Admin Dashboard">
              <Link href="/admin/dashboard">
                <LayoutDashboard />
                <span>Dashboard</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {/* Link to Template Generator Page Removed
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith('/admin/template-generator')} tooltip="Workflow Generator">
              <Link href="/admin/template-generator">
                <Wand2 />
                <span>Workflow Generator</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          */}
          <SidebarMenuItem>
            <SidebarMenuButton onClick={logout} tooltip="Logout">
              <LogOut />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </>
      )}
      {!loading && !isAdminAuthenticated && (
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={pathname === "/admin/login"} tooltip="Admin Login">
            <Link href="/admin/login">
              <LogIn />
              <span>Admin Login</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      )}
       {/* Example of a settings link, can be removed or adapted */}
      {/* <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={pathname === "/settings"} tooltip="Settings">
          <Link href="/settings"> 
            <SettingsIcon />
            <span>Settings</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem> */}
    </SidebarMenu>
  );
}
