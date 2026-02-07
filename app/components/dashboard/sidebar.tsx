'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import {
  LayoutDashboard,
  LogOut,
  History,
  ChevronDown,
  ChevronRight,
  Sparkles,
  BarChart3,
  Activity,
  Shield,
  User,
  FileText,
  AlignLeft,
  Globe,
  MessageCircleQuestion,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface NavSection {
  title: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

function buildNavigation(): NavSection[] {
  return [
    {
      title: 'Command',
      defaultOpen: true,
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
        { label: 'Analytics', href: '/dashboard/analytics', icon: <BarChart3 className="w-5 h-5" /> },
      ],
    },
    {
      title: 'Activities',
      defaultOpen: true,
      items: [
        { label: 'Chat History', href: '/dashboard/history', icon: <History className="w-5 h-5" /> },
      ],
    },
    {
      title: 'Knowledge Base',
      defaultOpen: true,
      items: [
        { label: 'Files', href: '/dashboard/knowledge/files', icon: <FileText className="w-5 h-5" /> },
        { label: 'Text Snippet', href: '/dashboard/knowledge/text', icon: <AlignLeft className="w-5 h-5" /> },
        { label: 'Website', href: '/dashboard/knowledge/website', icon: <Globe className="w-5 h-5" /> },
        { label: 'Q&A', href: '/dashboard/knowledge/qa', icon: <MessageCircleQuestion className="w-5 h-5" /> },
      ],
    },
  ];
}

function NavSectionComponent({ section, pathname }: { section: NavSection; pathname: string | null }) {
  const [isOpen, setIsOpen] = React.useState(section.defaultOpen ?? true);

  const hasActiveItem = section.items.some(
    (item) => pathname === item.href || (item.href !== '/dashboard' && (pathname ?? '').startsWith(item.href))
  );

  React.useEffect(() => {
    if (hasActiveItem) setIsOpen(true);
  }, [hasActiveItem]);

  return (
    <div className="mb-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2
          font-mono text-[10px] text-[#C9CDD6]/40 uppercase tracking-[0.15em]
          hover:text-cyan-400/60 transition-colors"
      >
        <span>{section.title}</span>
        {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-1 mt-1 overflow-hidden"
          >
            {section.items.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/dashboard' && (pathname ?? '').startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl
                    text-sm font-medium transition-all duration-200 group
                    ${isActive
                      ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                      : 'text-[#C9CDD6]/60 hover:bg-white/[0.03] hover:text-white border border-transparent'
                    }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute inset-0 bg-cyan-500/5 rounded-xl"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                    />
                  )}
                  <span className={`relative z-10 transition-colors ${isActive ? 'text-cyan-400' : 'text-[#C9CDD6]/40 group-hover:text-cyan-400/60'}`}>
                    {item.icon}
                  </span>
                  <span className="relative z-10 flex-1">{item.label}</span>
                  {isActive && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]"
                    />
                  )}
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PilotIDCard({ email }: { email: string }) {
  return (
    <div className="p-4 border-t border-white/5">
      <div className="relative p-3 rounded-xl bg-white/[0.02] border border-white/10 hover:border-cyan-500/20 transition-colors group">
        <div className="absolute top-0 right-0 w-6 h-6 border-t border-r border-cyan-500/20 rounded-bl-lg" />
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20
              border border-cyan-500/30 flex items-center justify-center
              group-hover:shadow-[0_0_15px_rgba(34,211,238,0.2)] transition-shadow">
              <User className="w-5 h-5 text-cyan-400" />
            </div>
            <motion.div
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-[#0A1F44]"
            />
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-mono text-[9px] text-cyan-400/60 tracking-wider">PILOT ID</span>
            <p className="text-sm font-medium text-white truncate">{email}</p>
          </div>
        </div>
        <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-green-400/60" />
            <span className="font-mono text-[8px] text-green-400/60 tracking-wider">AUTHENTICATED</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-cyan-400/60" />
            <span className="font-mono text-[8px] text-cyan-400/60 tracking-wider">ACTIVE</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardSidebar({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const navigation = React.useMemo(() => buildNavigation(), []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <aside className="w-64 h-screen flex flex-col bg-[#0A1F44]/95 backdrop-blur-xl border-r border-white/5 shadow-[1px_0_30px_rgba(0,0,0,0.3)]">
      <div className="px-4 py-5 border-b border-white/5">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="relative">
            <motion.div
              animate={{ opacity: [1, 0.7, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20
                border border-cyan-500/40 flex items-center justify-center
                group-hover:shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-shadow"
            >
              <Sparkles className="w-5 h-5 text-cyan-400" />
            </motion.div>
            <motion.div
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 rounded-xl border border-cyan-500/30"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-white truncate group-hover:text-cyan-300 transition-colors">
              DDT Enterprise
            </h1>
            <div className="flex items-center gap-1.5">
              <motion.div
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full bg-green-400"
              />
              <span className="font-mono text-[9px] text-cyan-400/60 uppercase tracking-wider">Mission Control</span>
            </div>
          </div>
        </Link>
      </div>

      <div className="px-4 py-3 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-3 h-3 text-cyan-400" />
            <span className="font-mono text-[9px] text-[#C9CDD6]/40 tracking-wider">STATUS</span>
          </div>
          <div className="flex items-center gap-1.5">
            <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="font-mono text-[9px] text-green-400 tracking-wider">ONLINE</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navigation.map((section) => (
          <NavSectionComponent key={section.title} section={section} pathname={pathname} />
        ))}
      </nav>

      {userEmail && <PilotIDCard email={userEmail} />}

      <div className="p-4 border-t border-white/5">
        <button
          onClick={handleSignOut}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl
            text-[#C9CDD6]/60 text-sm font-medium bg-white/[0.02] border border-white/10
            hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

export default DashboardSidebar;
