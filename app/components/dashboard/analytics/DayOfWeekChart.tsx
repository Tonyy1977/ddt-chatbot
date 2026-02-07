'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';

interface DayOfWeekChartProps {
  data: Array<{ day: string; count: number }>;
  busiestDay: number;
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

export function DayOfWeekChart({ data, busiestDay }: DayOfWeekChartProps) {
  const hasData = data.some((d) => d.count > 0);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-64 text-[#C9CDD6]/40 text-sm">
        No daily data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.05)"
          vertical={false}
        />
        <XAxis
          dataKey="day"
          tick={{ fill: '#C9CDD6', opacity: 0.4, fontSize: 11 }}
          axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#C9CDD6', opacity: 0.4, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={i === busiestDay ? '#22C55E' : 'rgba(34,211,238,0.4)'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
