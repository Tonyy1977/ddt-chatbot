'use client';

import { motion } from 'framer-motion';
import { Activity, Shield, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';

function PulsingBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vh] h-[150vh] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(34, 211, 238, 0.08) 0%, rgba(10, 31, 68, 0) 60%)',
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vh] h-[100vh] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.05) 0%, transparent 50%)',
        }}
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />
    </div>
  );
}

function GridOverlay() {
  return (
    <div
      className="absolute inset-0 pointer-events-none opacity-[0.03]"
      style={{
        backgroundImage: `
          linear-gradient(rgba(201, 205, 214, 1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(201, 205, 214, 1) 1px, transparent 1px)
        `,
        backgroundSize: '50px 50px',
      }}
    />
  );
}

function ScanLines() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.02]">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)',
        }}
      />
    </div>
  );
}

function CornerBrackets() {
  const corners = [
    { position: 'top-4 left-4', borders: 'border-t-2 border-l-2' },
    { position: 'top-4 right-4', borders: 'border-t-2 border-r-2' },
    { position: 'bottom-4 left-4', borders: 'border-b-2 border-l-2' },
    { position: 'bottom-4 right-4', borders: 'border-b-2 border-r-2' },
  ];

  return (
    <>
      {corners.map((corner, i) => (
        <div
          key={i}
          className={`absolute ${corner.position} w-8 h-8 ${corner.borders} border-cyan-500/30 pointer-events-none z-50`}
        />
      ))}
    </>
  );
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [systemTime, setSystemTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setSystemTime(now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="min-h-[100dvh] bg-[#0A1F44] relative overflow-x-hidden font-sans"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {/* Background Effects */}
      <PulsingBackground />
      <GridOverlay />
      <ScanLines />
      <CornerBrackets />

      {/* Top HUD Bar */}
      <div className="absolute top-0 left-0 right-0 h-14 z-40">
        <div className="h-full mx-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]"
            />
            <span className="text-white font-semibold text-lg tracking-tight">
              DDT Enterprise
            </span>
          </div>

          <div className="hidden md:flex items-center gap-4 text-[10px] font-mono text-[#C9CDD6]/50 tracking-wider">
            <span className="flex items-center gap-1.5">
              <Activity size={10} className="text-cyan-400" />
              STATUS: <span className="text-cyan-400">ONLINE</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Shield size={10} className="text-green-400" />
              SECURE
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-6 text-[10px] font-mono text-[#C9CDD6]/40 tracking-wider">
            <span className="text-cyan-400">{systemTime}</span>
          </div>

          <div className="flex md:hidden items-center">
            <span className="font-mono text-[10px] text-cyan-400">{systemTime}</span>
          </div>

          <div className="hidden md:block w-32" />
        </div>

        <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-[100dvh] flex items-center justify-center px-4 py-20 sm:p-4 sm:pt-20">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md md:max-w-[500px] mx-auto"
        >
          {/* Brand Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', bounce: 0.4 }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl
                bg-gradient-to-br from-cyan-500/20 to-blue-500/20
                border border-cyan-500/40 mb-4
                shadow-[0_0_30px_rgba(34,211,238,0.2)]"
            >
              <Sparkles className="w-8 h-8 text-cyan-400" />
            </motion.div>
            <h1 className="text-2xl font-bold text-white mb-1">
              DDT Mission Control
            </h1>
            <p className="text-[#C9CDD6]/60 text-sm">
              Property Management Dashboard
            </p>
          </div>

          {/* Auth Card */}
          <div className="relative">
            <motion.div
              className="absolute -inset-[1px] rounded-2xl opacity-50"
              style={{
                background: 'linear-gradient(90deg, rgba(34,211,238,0.3), rgba(59,130,246,0.3), rgba(34,211,238,0.3))',
                backgroundSize: '200% 100%',
              }}
              animate={{ backgroundPosition: ['0% 0%', '200% 0%'] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
            />

            <div className="relative bg-white/[0.03] backdrop-blur-xl rounded-2xl
              border border-white/10 p-5 sm:p-8
              shadow-[0_0_40px_rgba(0,0,0,0.3)]">
              {children}
            </div>
          </div>
        </motion.div>
      </div>

      {/* System Status Badge */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.8 }}
        className="absolute bottom-6 left-6 z-40"
      >
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg
          bg-[#0A1F44]/80 backdrop-blur-xl border border-cyan-500/20
          font-mono text-[9px] text-cyan-400/80 tracking-wider">
          <motion.div
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-1.5 h-1.5 rounded-full bg-green-400"
          />
          SYSTEM STATUS: SECURE
        </div>
      </motion.div>
    </div>
  );
}
