'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { LogOut } from 'lucide-react';

export function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <button
      onClick={handleSignOut}
      className="flex items-center gap-2 px-3 py-2 rounded-lg
        text-[#C9CDD6]/60 text-sm font-medium
        hover:text-cyan-400 hover:bg-cyan-500/10
        border border-transparent hover:border-cyan-500/20
        transition-all duration-200"
    >
      <LogOut className="w-4 h-4" />
      <span className="hidden sm:inline">Sign out</span>
    </button>
  );
}
