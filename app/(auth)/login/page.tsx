'use client';

import { useState, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { Lock, Mail, ArrowRight, Fingerprint, AlertTriangle } from 'lucide-react';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [blink, setBlink] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get('redirectTo') || '/dashboard';

  useEffect(() => {
    const interval = setInterval(() => setBlink(b => !b), 530);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Terminal Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Fingerprint className="w-5 h-5 text-cyan-400" />
          <span className="font-mono text-[10px] text-cyan-400 tracking-[0.2em]">
            SECURITY ACCESS TERMINAL
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <motion.div
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-1.5 h-1.5 rounded-full bg-green-400"
          />
          <span className="font-mono text-[9px] text-green-400">READY</span>
        </div>
      </div>

      <h2 className="text-xl font-semibold text-white mb-2">
        Initialize Session
      </h2>
      <p className="text-[#C9CDD6]/60 text-sm mb-6">
        Enter credentials to access Mission Control
      </p>

      {/* Email/Password Form */}
      <form onSubmit={handleLogin} className="space-y-4">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2"
          >
            <AlertTriangle size={16} className="text-red-400 shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </motion.div>
        )}

        {/* Email Input */}
        <div>
          <label
            htmlFor="email"
            className="block font-mono text-[10px] text-[#C9CDD6]/40 tracking-wider mb-2"
          >
            USER IDENTIFIER
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C9CDD6]/40" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full pl-11 pr-4 py-3
                bg-black/20 backdrop-blur-sm
                border border-white/10 rounded-xl
                text-white text-sm placeholder-[#C9CDD6]/30
                focus:border-cyan-500/50 focus:outline-none
                focus:ring-1 focus:ring-cyan-500/20
                focus:shadow-[0_0_20px_rgba(34,211,238,0.1)]
                transition-all duration-200"
              placeholder="admin@ddt-enterprise.com"
            />
          </div>
        </div>

        {/* Password Input */}
        <div>
          <label
            htmlFor="password"
            className="block font-mono text-[10px] text-[#C9CDD6]/40 tracking-wider mb-2"
          >
            ACCESS KEY
          </label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C9CDD6]/40" />
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full pl-11 pr-4 py-3
                bg-black/20 backdrop-blur-sm
                border border-white/10 rounded-xl
                text-white text-sm placeholder-[#C9CDD6]/30
                focus:border-cyan-500/50 focus:outline-none
                focus:ring-1 focus:ring-cyan-500/20
                focus:shadow-[0_0_20px_rgba(34,211,238,0.1)]
                transition-all duration-200"
              placeholder="Enter access key"
            />
          </div>
        </div>

        {/* Submit Button */}
        <motion.button
          type="submit"
          disabled={loading}
          whileHover={{ scale: loading ? 1 : 1.01 }}
          whileTap={{ scale: loading ? 1 : 0.99 }}
          className="relative w-full py-3 rounded-xl
            bg-gradient-to-r from-cyan-500/20 to-blue-500/20
            border border-cyan-500/40
            text-cyan-300 font-mono text-sm tracking-wider
            hover:from-cyan-500/30 hover:to-blue-500/30
            hover:shadow-[0_0_30px_rgba(34,211,238,0.3)]
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-300
            flex items-center justify-center gap-2 group overflow-hidden"
        >
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12"
            initial={{ x: '-100%' }}
            animate={{ x: '200%' }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
          />

          {loading ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-4 h-4 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full"
              />
              <span>AUTHENTICATING...</span>
            </>
          ) : (
            <>
              <span>INITIALIZE SESSION</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </motion.button>
      </form>

      {/* Terminal Footer */}
      <div className="mt-6 pt-6 border-t border-white/5">
        <div className="flex items-center justify-between">
          <p className="text-xs text-[#C9CDD6]/30 font-mono">
            DDT Enterprise Admin Access
          </p>
          <div className="font-mono text-[10px] text-cyan-400/60">
            {'>'}
            <span className={blink ? 'opacity-100' : 'opacity-0'}>_</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-white/5 rounded-lg w-3/4" />
          <div className="h-4 bg-white/5 rounded-lg w-1/2" />
          <div className="h-12 bg-white/5 rounded-xl" />
          <div className="h-12 bg-white/5 rounded-xl" />
          <div className="h-12 bg-white/5 rounded-xl" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
