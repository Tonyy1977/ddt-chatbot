'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar, ChevronDown } from 'lucide-react';

const PRESETS = [
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
  { label: '90D', value: '90d' },
  { label: 'All', value: 'all' },
] as const;

export function DateFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentRange = searchParams?.get('range') || '30d';
  const currentFrom = searchParams?.get('from') || '';
  const currentTo = searchParams?.get('to') || '';
  const isCustom = currentRange === 'custom';

  const [showCustom, setShowCustom] = useState(isCustom);
  const [from, setFrom] = useState(currentFrom);
  const [to, setTo] = useState(currentTo);

  const applyPreset = (value: string) => {
    setShowCustom(false);
    router.push(`/dashboard/analytics?range=${value}`);
  };

  const applyCustom = () => {
    if (from && to) {
      router.push(`/dashboard/analytics?range=custom&from=${from}&to=${to}`);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Preset buttons */}
      <div className="flex items-center rounded-lg bg-white/[0.03] border border-white/10 overflow-hidden">
        {PRESETS.map((preset) => (
          <button
            key={preset.value}
            onClick={() => applyPreset(preset.value)}
            className={`px-3 py-1.5 text-xs font-mono transition-colors ${
              currentRange === preset.value && !isCustom
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                : 'text-[#C9CDD6]/40 hover:text-[#C9CDD6]/70 hover:bg-white/[0.03]'
            }`}
          >
            {preset.label}
          </button>
        ))}
        <button
          onClick={() => setShowCustom(!showCustom)}
          className={`px-3 py-1.5 text-xs font-mono flex items-center gap-1 transition-colors ${
            isCustom
              ? 'bg-cyan-500/20 text-cyan-400'
              : 'text-[#C9CDD6]/40 hover:text-[#C9CDD6]/70 hover:bg-white/[0.03]'
          }`}
        >
          <Calendar className="w-3 h-3" />
          <ChevronDown className={`w-3 h-3 transition-transform ${showCustom ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Custom date picker */}
      {showCustom && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-white text-xs font-mono focus:border-cyan-500/50 focus:outline-none [color-scheme:dark]"
          />
          <span className="text-[#C9CDD6]/30 text-xs">to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-white text-xs font-mono focus:border-cyan-500/50 focus:outline-none [color-scheme:dark]"
          />
          <button
            onClick={applyCustom}
            disabled={!from || !to}
            className="px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-mono hover:bg-cyan-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
