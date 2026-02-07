import { Suspense } from 'react';
import {
  MessageSquare,
  Clock,
  Users,
  Zap,
  Activity,
  TrendingUp,
  Bot,
  User,
  Database,
  BarChart3,
} from 'lucide-react';
import { db } from '@/db';
import { chats, messages, knowledgeSources } from '@/db/schema';
import { count, sql, eq } from 'drizzle-orm';
import {
  ActivityTrendChart,
  PeakHourBarChart,
  TopicsPieChart,
  DayOfWeekChart,
} from '@/app/components/dashboard/analytics';

// ============================================
// KPI CARD
// ============================================

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  accent: 'cyan' | 'purple' | 'green' | 'amber';
}

const accentMap = {
  cyan: {
    border: 'border-cyan-500/20',
    bg: 'from-cyan-500/10 to-cyan-500/5',
    glow: 'shadow-[0_0_20px_rgba(34,211,238,0.1)]',
    iconBg: 'bg-cyan-500/20 border-cyan-500/30',
    iconText: 'text-cyan-400',
    value: 'text-cyan-400',
  },
  purple: {
    border: 'border-purple-500/20',
    bg: 'from-purple-500/10 to-purple-500/5',
    glow: 'shadow-[0_0_20px_rgba(168,85,247,0.1)]',
    iconBg: 'bg-purple-500/20 border-purple-500/30',
    iconText: 'text-purple-400',
    value: 'text-purple-400',
  },
  green: {
    border: 'border-green-500/20',
    bg: 'from-green-500/10 to-green-500/5',
    glow: 'shadow-[0_0_20px_rgba(34,197,94,0.1)]',
    iconBg: 'bg-green-500/20 border-green-500/30',
    iconText: 'text-green-400',
    value: 'text-green-400',
  },
  amber: {
    border: 'border-amber-500/20',
    bg: 'from-amber-500/10 to-amber-500/5',
    glow: 'shadow-[0_0_20px_rgba(245,158,11,0.1)]',
    iconBg: 'bg-amber-500/20 border-amber-500/30',
    iconText: 'text-amber-400',
    value: 'text-amber-400',
  },
};

function KPICard({ title, value, subtitle, icon, accent }: KPICardProps) {
  const c = accentMap[accent];
  return (
    <div className={`relative rounded-2xl overflow-hidden bg-gradient-to-br ${c.bg} border ${c.border} backdrop-blur-xl p-5 ${c.glow}`}>
      <div className={`absolute top-0 right-0 w-10 h-10 border-t border-r ${c.border} rounded-bl-xl`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[#C9CDD6]/60 text-xs font-medium uppercase tracking-wider">{title}</p>
          <p className={`${c.value} font-mono text-2xl font-bold mt-1`}>{value}</p>
          <p className="text-[#C9CDD6]/40 text-xs mt-1">{subtitle}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl ${c.iconBg} border flex items-center justify-center`}>
          <div className={c.iconText}>{icon}</div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// CHART PANEL
// ============================================

function ChartPanel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/[0.02] backdrop-blur-xl border border-white/10 overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {subtitle && <p className="text-[#C9CDD6]/40 text-xs mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ============================================
// FORMAT HELPERS
// ============================================

function formatHour(hour: number): string {
  if (hour === 0) return '12:00 AM';
  if (hour < 12) return `${hour}:00 AM`;
  if (hour === 12) return '12:00 PM';
  return `${hour - 12}:00 PM`;
}

// ============================================
// DATA FETCHING
// ============================================

async function getAnalyticsData() {
  // Run all queries in parallel
  const [
    totalChatsResult,
    totalMessagesResult,
    userMessagesResult,
    botMessagesResult,
    uniqueVisitorsResult,
    dailyMessagesResult,
    hourlyResult,
    topicsResult,
    dayOfWeekResult,
    avgPerSessionResult,
    avgResponseLengthResult,
    knowledgeCountResult,
  ] = await Promise.all([
    // Total chats
    db.select({ count: count() }).from(chats),
    // Total messages
    db.select({ count: count() }).from(messages),
    // User messages
    db.select({ count: count() }).from(messages).where(eq(messages.role, 'user')),
    // Bot messages
    db.select({ count: count() }).from(messages).where(eq(messages.role, 'assistant')),
    // Unique visitors
    db.select({ count: sql<number>`count(distinct ${chats.visitorId})` }).from(chats),
    // Daily messages (last 30 days) — in Eastern time
    db.execute(sql`
      WITH days AS (
        SELECT generate_series(
          (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date - INTERVAL '29 days',
          (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date,
          '1 day'::interval
        )::date AS day
      )
      SELECT
        TO_CHAR(d.day, 'Mon DD') AS date,
        COALESCE(m.cnt, 0)::int AS count
      FROM days d
      LEFT JOIN (
        SELECT DATE(created_at AT TIME ZONE 'America/New_York') AS day, COUNT(*) AS cnt
        FROM messages
        WHERE created_at >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date - INTERVAL '29 days'
        GROUP BY DATE(created_at AT TIME ZONE 'America/New_York')
      ) m ON m.day = d.day
      ORDER BY d.day
    `),
    // Hourly distribution — in Eastern time
    db.execute(sql`
      SELECT
        EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/New_York')::int AS hour,
        COUNT(*)::int AS count
      FROM messages
      GROUP BY EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/New_York')
      ORDER BY hour
    `),
    // Topics aggregation
    db.execute(sql`
      SELECT
        topic,
        COUNT(*)::int AS count
      FROM messages,
        jsonb_array_elements_text(topics) AS topic
      WHERE jsonb_array_length(topics) > 0
      GROUP BY topic
      ORDER BY count DESC
      LIMIT 6
    `),
    // Day of week distribution — in Eastern time
    db.execute(sql`
      SELECT
        EXTRACT(DOW FROM created_at AT TIME ZONE 'America/New_York')::int AS dow,
        COUNT(*)::int AS count
      FROM messages
      GROUP BY EXTRACT(DOW FROM created_at AT TIME ZONE 'America/New_York')
      ORDER BY dow
    `),
    // Avg messages per session
    db.execute(sql`
      SELECT COALESCE(AVG(msg_count), 0)::numeric(10,1) AS avg_per_session
      FROM (
        SELECT chat_id, COUNT(*) AS msg_count
        FROM messages
        GROUP BY chat_id
      ) sub
    `),
    // Avg response length
    db.execute(sql`
      SELECT COALESCE(AVG(LENGTH(content)), 0)::int AS avg_length
      FROM messages
      WHERE role = 'assistant'
    `),
    // Knowledge sources count
    db.select({ count: count() }).from(knowledgeSources).where(eq(knowledgeSources.status, 'ready')),
  ]);

  const totalChats = totalChatsResult[0]?.count || 0;
  const totalMessages = totalMessagesResult[0]?.count || 0;
  const userMessages = userMessagesResult[0]?.count || 0;
  const botMessages = botMessagesResult[0]?.count || 0;
  const uniqueVisitors = uniqueVisitorsResult[0]?.count || 0;

  // Daily messages — already formatted from SQL
  const dailyMessages = (dailyMessagesResult.rows as Array<{ date: string; count: number }>);

  // Hourly — fill in missing hours
  const hourlyMap = new Map<number, number>();
  (hourlyResult.rows as Array<{ hour: number; count: number }>).forEach(r => {
    hourlyMap.set(r.hour, r.count);
  });
  const peakHours = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: hourlyMap.get(i) || 0,
  }));

  // Find busiest hour
  let busiestHour = 0;
  let busiestHourCount = 0;
  peakHours.forEach(h => {
    if (h.count > busiestHourCount) {
      busiestHour = h.hour;
      busiestHourCount = h.count;
    }
  });

  // Topics
  const topics = (topicsResult.rows as Array<{ topic: string; count: number }>).map(r => ({
    name: r.topic,
    value: r.count,
  }));

  // Day of week — fill in missing days
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dowMap = new Map<number, number>();
  (dayOfWeekResult.rows as Array<{ dow: number; count: number }>).forEach(r => {
    dowMap.set(r.dow, r.count);
  });
  const dayOfWeek = DAY_NAMES.map((day, i) => ({
    day,
    count: dowMap.get(i) || 0,
  }));

  // Find busiest day
  let busiestDay = 0;
  let busiestDayCount = 0;
  dayOfWeek.forEach((d, i) => {
    if (d.count > busiestDayCount) {
      busiestDay = i;
      busiestDayCount = d.count;
    }
  });

  const avgPerSession = Number((avgPerSessionResult.rows as Array<{ avg_per_session: string }>)[0]?.avg_per_session || 0);
  const avgResponseLength = Number((avgResponseLengthResult.rows as Array<{ avg_length: number }>)[0]?.avg_length || 0);
  const knowledgeCount = knowledgeCountResult[0]?.count || 0;
  const responseRate = Number(userMessages) > 0 ? (Number(botMessages) / Number(userMessages) * 100).toFixed(0) : '0';

  return {
    totalChats,
    totalMessages,
    userMessages,
    botMessages,
    uniqueVisitors,
    dailyMessages,
    peakHours,
    busiestHour,
    busiestHourCount,
    topics,
    dayOfWeek,
    busiestDay,
    avgPerSession,
    avgResponseLength,
    knowledgeCount,
    responseRate,
  };
}

// ============================================
// ANALYTICS CONTENT (Server Component)
// ============================================

async function AnalyticsContent() {
  const data = await getAnalyticsData();

  return (
    <>
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          title="Conversations"
          value={data.totalChats}
          subtitle={`${data.uniqueVisitors} unique visitors`}
          icon={<Users className="w-5 h-5" />}
          accent="cyan"
        />
        <KPICard
          title="Total Messages"
          value={data.totalMessages}
          subtitle={`${data.userMessages} user / ${data.botMessages} bot`}
          icon={<MessageSquare className="w-5 h-5" />}
          accent="purple"
        />
        <KPICard
          title="Peak Hour"
          value={data.busiestHourCount > 0 ? formatHour(data.busiestHour) : 'N/A'}
          subtitle={data.busiestHourCount > 0 ? `${data.busiestHourCount} messages` : 'No data yet'}
          icon={<Clock className="w-5 h-5" />}
          accent="green"
        />
        <KPICard
          title="Avg / Session"
          value={data.avgPerSession}
          subtitle="messages per conversation"
          icon={<Zap className="w-5 h-5" />}
          accent="amber"
        />
      </div>

      {/* Activity Trend */}
      <div className="mb-6">
        <ChartPanel
          title="Message Activity"
          subtitle="Daily message volume over the last 30 days"
        >
          <ActivityTrendChart data={data.dailyMessages} />
        </ChartPanel>
      </div>

      {/* Peak Hours + Topics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ChartPanel
          title="Peak Hours"
          subtitle="When your visitors are most active"
        >
          <PeakHourBarChart data={data.peakHours} goldenHour={data.busiestHour} />
        </ChartPanel>

        <ChartPanel
          title="Conversation Topics"
          subtitle="What visitors are asking about"
        >
          <TopicsPieChart data={data.topics} />
        </ChartPanel>
      </div>

      {/* Day of Week + Stats Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartPanel
          title="Day of Week"
          subtitle="Message distribution across the week"
        >
          <DayOfWeekChart data={data.dayOfWeek} busiestDay={data.busiestDay} />
        </ChartPanel>

        {/* Stats Panel */}
        <div className="rounded-2xl bg-white/[0.02] backdrop-blur-xl border border-white/10 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5">
            <h2 className="text-sm font-semibold text-white">Message Intelligence</h2>
            <p className="text-[#C9CDD6]/40 text-xs mt-0.5">Key performance metrics</p>
          </div>
          <div className="p-4 space-y-1">
            <StatRow
              icon={<User className="w-3.5 h-3.5" />}
              label="User Messages"
              value={String(data.userMessages)}
              color="text-blue-400"
            />
            <StatRow
              icon={<Bot className="w-3.5 h-3.5" />}
              label="Bot Responses"
              value={String(data.botMessages)}
              color="text-cyan-400"
            />
            <StatRow
              icon={<BarChart3 className="w-3.5 h-3.5" />}
              label="Response Rate"
              value={`${data.responseRate}%`}
              color="text-green-400"
            />
            <StatRow
              icon={<MessageSquare className="w-3.5 h-3.5" />}
              label="Avg Response Length"
              value={`${data.avgResponseLength} chars`}
              color="text-purple-400"
            />
            <StatRow
              icon={<Database className="w-3.5 h-3.5" />}
              label="Knowledge Sources"
              value={String(data.knowledgeCount)}
              color="text-amber-400"
            />
            <StatRow
              icon={<Users className="w-3.5 h-3.5" />}
              label="Unique Visitors"
              value={String(data.uniqueVisitors)}
              color="text-rose-400"
            />
          </div>
        </div>
      </div>
    </>
  );
}

function StatRow({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <span className="text-sm text-[#C9CDD6]/60">{label}</span>
      </div>
      <span className="text-sm font-mono font-semibold text-white">{value}</span>
    </div>
  );
}

// ============================================
// LOADING SKELETON
// ============================================

function AnalyticsSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl bg-white/[0.02] border border-white/10 p-5">
            <div className="h-3 bg-white/5 rounded w-20 mb-3" />
            <div className="h-7 bg-white/5 rounded w-24 mb-2" />
            <div className="h-3 bg-white/5 rounded w-28" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-white/[0.02] border border-white/10 p-6 mb-6">
        <div className="h-4 bg-white/5 rounded w-40 mb-4" />
        <div className="h-64 bg-white/[0.03] rounded-lg" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl bg-white/[0.02] border border-white/10 p-6">
            <div className="h-4 bg-white/5 rounded w-32 mb-4" />
            <div className="h-64 bg-white/[0.03] rounded-lg" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl bg-white/[0.02] border border-white/10 p-6">
            <div className="h-4 bg-white/5 rounded w-32 mb-4" />
            <div className="h-64 bg-white/[0.03] rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function AnalyticsPage() {
  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span className="text-[10px] font-mono text-[#C9CDD6]/40 tracking-wider uppercase">
              Business Intelligence
            </span>
          </div>
          <h1 className="text-xl font-bold text-white">Performance Insights</h1>
          <p className="text-[#C9CDD6]/50 text-sm mt-0.5">
            Understand your visitors and optimize your response strategy
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/10 text-[#C9CDD6]/40 text-xs font-mono">
          <TrendingUp className="w-3.5 h-3.5" />
          LAST 30 DAYS
        </div>
      </div>

      {/* Content */}
      <Suspense fallback={<AnalyticsSkeleton />}>
        <AnalyticsContent />
      </Suspense>
    </div>
  );
}
