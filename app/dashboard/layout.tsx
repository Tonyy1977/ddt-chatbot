import Link from 'next/link';
import { Sparkles, Activity } from 'lucide-react';
import { requireAuth } from '@/lib/supabase/server';
import { DashboardSidebar } from '@/app/components/dashboard/sidebar';
import {
  MobileSidebarProvider,
  MobileSidebarTrigger,
  MobileSidebarDrawer,
} from '@/app/components/dashboard/mobile-sidebar';
import { SignOutButton } from './SignOutButton';

function GridOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none opacity-[0.02]" style={{
      backgroundImage: `linear-gradient(rgba(201, 205, 214, 1) 1px, transparent 1px), linear-gradient(90deg, rgba(201, 205, 214, 1) 1px, transparent 1px)`,
      backgroundSize: '50px 50px',
    }} />
  );
}

function ScanLines() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.015]">
      <div className="absolute inset-0" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)',
      }} />
    </div>
  );
}

function RadialGradient() {
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vh] h-[150vh] rounded-full opacity-60" style={{
      background: 'radial-gradient(circle, rgba(34, 211, 238, 0.06) 0%, rgba(10, 31, 68, 0) 60%)',
    }} />
  );
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const authUser = await requireAuth();

  return (
    <MobileSidebarProvider>
      <div className="relative h-[100dvh] bg-[#0A1F44] overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <RadialGradient />
          <GridOverlay />
          <ScanLines />
        </div>

        {/* Desktop Sidebar */}
        <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 z-30 pointer-events-auto">
          <DashboardSidebar userEmail={authUser?.email} />
        </aside>

        {/* Main Content */}
        <div className="relative z-10 h-full flex flex-col lg:pl-64 pointer-events-auto">
          {/* Mobile Header */}
          <header className="lg:hidden sticky top-0 z-20 h-16 bg-[#0A1F44]/95 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-4"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <div className="flex items-center gap-3">
              <MobileSidebarTrigger />
              <Link href="/dashboard" className="flex items-center gap-2 group">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/40 flex items-center justify-center group-hover:shadow-[0_0_15px_rgba(34,211,238,0.3)] transition-shadow">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                </div>
                <span className="font-semibold text-white group-hover:text-cyan-300 transition-colors">DDT Enterprise</span>
              </Link>
            </div>
            <SignOutButton />
          </header>

          {/* Desktop Header */}
          <header className="hidden lg:flex h-14 bg-[#0A1F44]/80 backdrop-blur-xl border-b border-white/5 items-center justify-between px-6 relative">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-[10px] font-mono text-[#C9CDD6]/40 tracking-wider">
                <Activity className="w-3 h-3 text-cyan-400" />
                <span>MISSION CONTROL</span>
                <span className="text-white/20">/</span>
                <span className="text-cyan-400/60">COMMAND DECK</span>
              </div>
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-4 text-[10px] font-mono text-[#C9CDD6]/30 tracking-wider">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-green-400/60">SYSTEMS NOMINAL</span>
              </div>
            </div>
            <SignOutButton />
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto p-4">
            {children}
          </main>

          {/* Bottom Status Bar */}
          <footer className="hidden xl:flex h-8 bg-[#0A1F44]/80 border-t border-white/5 items-center justify-between px-6">
            <div className="flex items-center gap-4 text-[9px] font-mono text-[#C9CDD6]/30 tracking-wider">
              <span>DDT MISSION CONTROL</span>
              <span className="text-white/10">|</span>
              <span>CONN: SECURE</span>
            </div>
            <div className="flex items-center gap-4 text-[9px] font-mono text-[#C9CDD6]/30 tracking-wider">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />API: ONLINE
              </span>
              <span className="text-white/10">|</span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />DB: CONNECTED
              </span>
            </div>
          </footer>
        </div>

        {/* Mobile Sidebar Drawer */}
        <MobileSidebarDrawer />
      </div>
    </MobileSidebarProvider>
  );
}
