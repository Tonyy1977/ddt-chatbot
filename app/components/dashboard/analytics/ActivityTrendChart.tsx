'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

interface ActivityTrendChartProps {
  data: Array<{ date: string; count: number }>;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-4 py-3 border border-white/10 backdrop-blur-xl"
      style={{ backgroundColor: 'rgba(10,31,68,0.95)' }}>
      <p className="text-white text-sm font-semibold">{label}</p>
      <p className="text-cyan-400 text-sm">
        {payload[0].value} message{payload[0].value !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

export function ActivityTrendChart({ data }: ActivityTrendChartProps) {
  const hasData = data.some((d) => d.count > 0);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-64 text-[#C9CDD6]/40 text-sm">
        No message data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="cyanGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22D3EE" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#22D3EE" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.05)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fill: '#C9CDD6', opacity: 0.4, fontSize: 11 }}
          axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: '#C9CDD6', opacity: 0.4, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#22D3EE"
          strokeWidth={2}
          fill="url(#cyanGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
