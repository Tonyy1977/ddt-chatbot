'use client';

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';

interface TopicsPieChartProps {
  data: Array<{ name: string; value: number }>;
}

const COLORS = ['#22D3EE', '#C084FC', '#22C55E', '#FBBF24', '#F43F5E', '#94A3B8'];

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name?: string; value?: number }> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-4 py-3 border border-white/10 backdrop-blur-xl"
      style={{ backgroundColor: 'rgba(10,31,68,0.95)' }}>
      <p className="text-white text-sm font-semibold">{payload[0].name}</p>
      <p className="text-[#C9CDD6] text-sm">
        {payload[0].value} mention{payload[0].value !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

export function TopicsPieChart({ data }: TopicsPieChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[#C9CDD6]/40 text-sm">
        No topic data yet
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={90}
            dataKey="value"
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mt-2">
        {data.map((entry, i) => (
          <div key={entry.name} className="flex items-center gap-2 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span className="text-[#C9CDD6]/60">
              {entry.name}{' '}
              <span className="text-white font-medium">
                ({Math.round((entry.value / total) * 100)}%)
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
