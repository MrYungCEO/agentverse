
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AppProviders } from '@/components/Providers';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Toaster } from "@/components/ui/toaster";
import { 
  SidebarProvider, 
  Sidebar, 
  SidebarHeader, 
  SidebarContent, 
  SidebarFooter, 
  SidebarInset 
} from '@/components/ui/sidebar';
import KinglyAgentIcon from '@/components/KinglyAgentIcon';
import Logo from '@/components/Logo';
import Link from 'next/link';
import ClientSidebarMenu from '@/components/layout/ClientSidebarMenu';


const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'AgentVerse by Kingly Kreationz',
  description: 'Explore and download n8n or Make.com automation agent templates.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}>
        <AppProviders> {/* AppProviders is now the outermost provider within body */}
          <SidebarProvider>
            <Sidebar>
              <SidebarHeader className="p-4 border-b border-sidebar-border">
                <Link href="/" className="group flex items-center space-x-2">
                  <KinglyAgentIcon className="h-10 w-10 text-primary group-hover:text-accent transition-colors duration-300" />
                  <Logo className="h-12 w-auto" />
                </Link>
              </SidebarHeader>
              <SidebarContent>
                <ClientSidebarMenu />
              </SidebarContent>
              {/* Optional: Add a SidebarFooter here if needed */}
              {/* <SidebarFooter className="p-2 border-t border-sidebar-border">
                <p className="text-xs text-sidebar-foreground/70">© AgentVerse</p>
              </SidebarFooter> */}
            </Sidebar>
            <SidebarInset>
              {/* AppProviders is no longer here; it's wrapping SidebarProvider */}
              <Header />
              <main className="flex-grow container mx-auto px-4 py-8">
                {children}
              </main>
              <Footer />
              <Toaster />
            </SidebarInset>
          </SidebarProvider>
        </AppProviders>
      </body>
    </html>
  );
}
