'use client';

import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, PieChart } from 'lucide-react';
import {
  LineChart, Line, PieChart as RechartsPie, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface AnalyticsData {
  totalMessages: number;
  userMessages: number;
  botMessages: number;
  uniqueSessions: number;
  messagesPerDay: { date: string; count: number }[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch from existing API
        const summaryRes = await fetch('/api/analytics/summary');
        const summary = await summaryRes.json();

        // Fetch all messages for per-day breakdown
        const msgsRes = await fetch('/api/messages');
        const msgs = await msgsRes.json();

        // Group by day
        const dayMap: Record<string, number> = {};
        msgs.forEach((m: { createdAt: string }) => {
          const day = new Date(m.createdAt).toISOString().slice(0, 10);
          dayMap[day] = (dayMap[day] || 0) + 1;
        });

        const messagesPerDay = Object.entries(dayMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-30)
          .map(([date, count]) => ({ date: date.slice(5), count }));

        setData({
          ...summary,
          messagesPerDay,
        });
      } catch (err) {
        console.error('Analytics fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-center text-[#C9CDD6]/40 py-12">Failed to load analytics</div>;
  }

  const pieData = [
    { name: 'User', value: data.userMessages },
    { name: 'Bot', value: data.botMessages },
  ];
  const PIE_COLORS = ['#3b82f6', '#22d3ee'];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Analytics</h1>
        <p className="text-[#C9CDD6]/60 text-sm">Chatbot performance metrics</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Messages', value: data.totalMessages, icon: BarChart3 },
          { label: 'User Messages', value: data.userMessages, icon: TrendingUp },
          { label: 'Bot Responses', value: data.botMessages, icon: PieChart },
          { label: 'Unique Sessions', value: data.uniqueSessions, icon: BarChart3 },
        ].map(card => (
          <div key={card.label} className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <card.icon className="w-4 h-4 text-cyan-400" />
              <span className="text-[10px] font-mono text-[#C9CDD6]/40 uppercase tracking-wider">{card.label}</span>
            </div>
            <div className="text-2xl font-bold text-white">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Messages Per Day */}
        <div className="p-5 rounded-xl bg-white/[0.02] border border-white/10">
          <h3 className="text-sm font-medium text-white mb-4">Messages Per Day (Last 30 days)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.messagesPerDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: '#C9CDD6', fontSize: 10 }} />
              <YAxis tick={{ fill: '#C9CDD6', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#0A1F44', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
              <Line type="monotone" dataKey="count" stroke="#22d3ee" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* User vs Bot */}
        <div className="p-5 rounded-xl bg-white/[0.02] border border-white/10">
          <h3 className="text-sm font-medium text-white mb-4">User vs Bot Messages</h3>
          <ResponsiveContainer width="100%" height={250}>
            <RechartsPie>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value" label={(props: any) => `${props.name} ${(props.percent * 100).toFixed(0)}%`}>
                {pieData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#0A1F44', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
            </RechartsPie>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
