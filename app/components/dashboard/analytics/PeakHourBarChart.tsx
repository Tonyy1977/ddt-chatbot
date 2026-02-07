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

interface PeakHourBarChartProps {
  data: Array<{ hour: number; count: number }>;
  goldenHour: number;
}

function formatHour(hour: number): string {
  if (hour === 0) return '12am';
  if (hour < 12) return `${hour}am`;
  if (hour === 12) return '12pm';
  return `${hour - 12}pm`;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value?: number; payload?: { hour: number } }> }) {
  if (!active || !payload?.length) return null;
  const hour = payload[0].payload?.hour ?? 0;
  return (
    <div className="rounded-xl px-4 py-3 border border-white/10 backdrop-blur-xl"
      style={{ backgroundColor: 'rgba(10,31,68,0.95)' }}>
      <p className="text-white text-sm font-semibold">
        {formatHour(hour)} - {formatHour((hour + 1) % 24)}
      </p>
      <p className="text-purple-400 text-sm">
        {payload[0].value} message{payload[0].value !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

export function PeakHourBarChart({ data, goldenHour }: PeakHourBarChartProps) {
  const hasData = data.some((d) => d.count > 0);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-64 text-[#C9CDD6]/40 text-sm">
        No hourly data yet
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
          dataKey="hour"
          tick={{ fill: '#C9CDD6', opacity: 0.4, fontSize: 10 }}
          axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
          tickLine={false}
          tickFormatter={(h: number) => `${h}h`}
        />
        <YAxis
          tick={{ fill: '#C9CDD6', opacity: 0.4, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell
              key={entry.hour}
              fill={entry.hour === goldenHour ? '#22C55E' : 'rgba(168,85,247,0.4)'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
