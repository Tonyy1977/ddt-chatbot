'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu, X, LayoutDashboard, History, ChevronDown, ChevronRight,
  Sparkles, BarChart3, Activity, Shield, UserPlus, FileText, AlignLeft, Globe, MessageCircleQuestion,
} from 'lucide-react';

interface NavItem { label: string; href: string; icon: React.ReactNode; }
interface NavSection { title: string; items: NavItem[]; defaultOpen?: boolean; }

interface MobileSidebarContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggle: () => void;
}

const MobileSidebarContext = React.createContext<MobileSidebarContextType | null>(null);

function useMobileSidebar() {
  const context = React.useContext(MobileSidebarContext);
  if (!context) throw new Error('useMobileSidebar must be used within MobileSidebarProvider');
  return context;
}

export function MobileSidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => { setIsOpen(false); }, [pathname]);

  React.useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const toggle = React.useCallback(() => setIsOpen(prev => !prev), []);

  return (
    <MobileSidebarContext.Provider value={{ isOpen, setIsOpen, toggle }}>
      {children}
    </MobileSidebarContext.Provider>
  );
}

function buildNavigation(): NavSection[] {
  return [
    {
      title: 'Command', defaultOpen: true,
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
        { label: 'Analytics', href: '/dashboard/analytics', icon: <BarChart3 className="w-5 h-5" /> },
      ],
    },
    {
      title: 'Activities', defaultOpen: true,
      items: [
        { label: 'Chat History', href: '/dashboard/history', icon: <History className="w-5 h-5" /> },
        { label: 'Leads', href: '/dashboard/leads', icon: <UserPlus className="w-5 h-5" /> },
      ],
    },
    {
      title: 'Knowledge Base', defaultOpen: true,
      items: [
        { label: 'Files', href: '/dashboard/knowledge/files', icon: <FileText className="w-5 h-5" /> },
        { label: 'Text Snippet', href: '/dashboard/knowledge/text', icon: <AlignLeft className="w-5 h-5" /> },
        { label: 'Website', href: '/dashboard/knowledge/website', icon: <Globe className="w-5 h-5" /> },
        { label: 'Q&A', href: '/dashboard/knowledge/qa', icon: <MessageCircleQuestion className="w-5 h-5" /> },
      ],
    },
  ];
}

function NavSectionComponent({ section, pathname, onNavigate }: { section: NavSection; pathname: string | null; onNavigate: () => void }) {
  const [isOpen, setIsOpen] = React.useState(section.defaultOpen ?? true);
  const hasActiveItem = section.items.some(item => pathname === item.href || (item.href !== '/dashboard' && (pathname ?? '').startsWith(item.href)));
  React.useEffect(() => { if (hasActiveItem) setIsOpen(true); }, [hasActiveItem]);

  return (
    <div className="mb-3">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between px-3 py-2 font-mono text-[10px] text-[#C9CDD6]/40 uppercase tracking-[0.15em] hover:text-cyan-400/60 transition-colors">
        <span>{section.title}</span>
        {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="space-y-1 mt-1 overflow-hidden">
            {section.items.map(item => {
              const isActive = pathname === item.href || (item.href !== '/dashboard' && (pathname ?? '').startsWith(item.href));
              return (
                <Link key={item.href} href={item.href} onClick={onNavigate}
                  className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${isActive ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30' : 'text-[#C9CDD6]/60 hover:bg-white/[0.03] hover:text-white border border-transparent'}`}>
                  {isActive && <motion.div layoutId="mobile-sidebar-active" className="absolute inset-0 bg-cyan-500/5 rounded-xl" transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }} />}
                  <span className={`relative z-10 transition-colors ${isActive ? 'text-cyan-400' : 'text-[#C9CDD6]/40 group-hover:text-cyan-400/60'}`}>{item.icon}</span>
                  <span className="relative z-10 flex-1">{item.label}</span>
                  {isActive && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />}
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function MobileSidebarTrigger() {
  const { toggle } = useMobileSidebar();
  return (
    <button onClick={toggle} className="p-2 rounded-lg text-[#C9CDD6]/60 hover:text-cyan-400 hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/20 transition-all duration-200 lg:hidden" aria-label="Open menu">
      <Menu className="w-6 h-6" />
    </button>
  );
}

export function MobileSidebarDrawer() {
  const pathname = usePathname();
  const { isOpen, setIsOpen } = useMobileSidebar();
  const navigation = React.useMemo(() => buildNavigation(), []);
  const closeDrawer = () => setIsOpen(false);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            onClick={closeDrawer} className="fixed inset-0 bg-black/60 backdrop-blur-sm lg:hidden" style={{ zIndex: 999 }} aria-hidden="true" />
        )}
      </AnimatePresence>

      <aside
        className={`fixed inset-y-0 left-0 w-72 lg:hidden bg-[#0A1F44] backdrop-blur-2xl border-r border-white/10 shadow-[4px_0_40px_rgba(0,0,0,0.5)] flex flex-col transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ zIndex: 1000, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)', paddingLeft: 'env(safe-area-inset-left)' }}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/5">
          <Link href="/dashboard" className="flex items-center gap-3 group" onClick={closeDrawer}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/40 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-cyan-400" />
            </div>
            <h1 className="text-base font-semibold text-white truncate group-hover:text-cyan-300 transition-colors">DDT Enterprise</h1>
          </Link>
          <button onClick={closeDrawer} className="p-2 rounded-lg text-[#C9CDD6]/40 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors" aria-label="Close menu">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-3 h-3 text-cyan-400" />
              <span className="font-mono text-[9px] text-[#C9CDD6]/40 tracking-wider">STATUS</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="font-mono text-[9px] text-green-400 tracking-wider">ONLINE</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navigation.map(section => <NavSectionComponent key={section.title} section={section} pathname={pathname} onNavigate={closeDrawer} />)}
        </nav>

        <div className="px-4 py-3 border-t border-white/5">
          <div className="flex items-center justify-between text-[9px] font-mono text-[#C9CDD6]/30 tracking-wider">
            <div className="flex items-center gap-1.5"><Shield className="w-3 h-3 text-green-400/60" /><span>SECURE</span></div>
          </div>
        </div>
      </aside>
    </>
  );
}
