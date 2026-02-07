import { Suspense } from 'react';
import {
  MessageSquare,
  Clock,
  Users,
  Zap,
  Activity,
  Bot,
  User,
  Database,
  BarChart3,
} from 'lucide-react';
import { db } from '@/db';
import { chats, messages, knowledgeSources } from '@/db/schema';
import { count, sql, eq, and, gte, lte } from 'drizzle-orm';
import {
  ActivityTrendChart,
  PeakHourBarChart,
  TopicsPieChart,
  DayOfWeekChart,
  DateFilter,
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

const RANGE_LABELS: Record<string, string> = {
  '7d': 'LAST 7 DAYS',
  '30d': 'LAST 30 DAYS',
  '90d': 'LAST 90 DAYS',
  'all': 'ALL TIME',
  'custom': 'CUSTOM RANGE',
};

// ============================================
// DATE RANGE RESOLVER
// ============================================

interface DateRange {
  days: number | null; // null = all time
  fromDate: string | null; // ISO date for custom
  toDate: string | null;
  label: string;
}

function resolveDateRange(searchParams: Record<string, string | string[] | undefined>): DateRange {
  const range = (searchParams.range as string) || '30d';
  const from = searchParams.from as string | undefined;
  const to = searchParams.to as string | undefined;

  if (range === 'custom' && from && to) {
    return { days: null, fromDate: from, toDate: to, label: `${from} — ${to}` };
  }
  if (range === 'all') return { days: null, fromDate: null, toDate: null, label: 'ALL TIME' };
  if (range === '7d') return { days: 7, fromDate: null, toDate: null, label: 'LAST 7 DAYS' };
  if (range === '90d') return { days: 90, fromDate: null, toDate: null, label: 'LAST 90 DAYS' };
  return { days: 30, fromDate: null, toDate: null, label: 'LAST 30 DAYS' };
}

// Build SQL WHERE fragment for messages table date filtering
function msgDateFilter(dr: DateRange) {
  if (dr.fromDate && dr.toDate) {
    return sql`created_at >= ${dr.fromDate}::date AND created_at < (${dr.toDate}::date + INTERVAL '1 day')`;
  }
  if (dr.days) {
    return sql`created_at >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date - INTERVAL '${sql.raw(String(dr.days))} days'`;
  }
  return sql`TRUE`;
}

// Build SQL WHERE fragment for chats table date filtering
function chatDateFilter(dr: DateRange) {
  if (dr.fromDate && dr.toDate) {
    return sql`created_at >= ${dr.fromDate}::date AND created_at < (${dr.toDate}::date + INTERVAL '1 day')`;
  }
  if (dr.days) {
    return sql`created_at >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date - INTERVAL '${sql.raw(String(dr.days))} days'`;
  }
  return sql`TRUE`;
}

// ============================================
// DATA FETCHING
// ============================================

async function getAnalyticsData(dr: DateRange) {
  const mFilter = msgDateFilter(dr);
  const cFilter = chatDateFilter(dr);

  const isCustomRange = !!(dr.fromDate && dr.toDate);
  const isAllTime = !dr.days && !isCustomRange;

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
    // Total chats (filtered)
    db.execute(sql`SELECT COUNT(*)::int AS count FROM chats WHERE ${cFilter}`),
    // Total messages (filtered)
    db.execute(sql`SELECT COUNT(*)::int AS count FROM messages WHERE ${mFilter}`),
    // User messages (filtered)
    db.execute(sql`SELECT COUNT(*)::int AS count FROM messages WHERE role = 'user' AND ${mFilter}`),
    // Bot messages (filtered)
    db.execute(sql`SELECT COUNT(*)::int AS count FROM messages WHERE role = 'assistant' AND ${mFilter}`),
    // Unique visitors (filtered)
    db.execute(sql`SELECT COUNT(DISTINCT visitor_id)::int AS count FROM chats WHERE ${cFilter}`),
    // Daily messages — dynamic range
    isCustomRange
      ? db.execute(sql`
          WITH days AS (
            SELECT generate_series(
              ${dr.fromDate}::date,
              ${dr.toDate}::date,
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
            WHERE ${mFilter}
            GROUP BY DATE(created_at AT TIME ZONE 'America/New_York')
          ) m ON m.day = d.day
          ORDER BY d.day
        `)
      : isAllTime
      ? db.execute(sql`
          WITH bounds AS (
            SELECT
              COALESCE(MIN(DATE(created_at AT TIME ZONE 'America/New_York')), CURRENT_DATE) AS first_day,
              (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date AS last_day
            FROM messages
          ),
          days AS (
            SELECT generate_series(
              (SELECT first_day FROM bounds),
              (SELECT last_day FROM bounds),
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
            GROUP BY DATE(created_at AT TIME ZONE 'America/New_York')
          ) m ON m.day = d.day
          ORDER BY d.day
        `)
      : db.execute(sql`
          WITH days AS (
            SELECT generate_series(
              (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date - INTERVAL '${sql.raw(String(dr.days! - 1))} days',
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
            WHERE ${mFilter}
            GROUP BY DATE(created_at AT TIME ZONE 'America/New_York')
          ) m ON m.day = d.day
          ORDER BY d.day
        `),
    // Hourly distribution (filtered) — Eastern time
    db.execute(sql`
      SELECT
        EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/New_York')::int AS hour,
        COUNT(*)::int AS count
      FROM messages
      WHERE ${mFilter}
      GROUP BY EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/New_York')
      ORDER BY hour
    `),
    // Topics aggregation (filtered)
    db.execute(sql`
      SELECT
        topic,
        COUNT(*)::int AS count
      FROM messages,
        jsonb_array_elements_text(topics) AS topic
      WHERE jsonb_array_length(topics) > 0 AND ${mFilter}
      GROUP BY topic
      ORDER BY count DESC
      LIMIT 6
    `),
    // Day of week distribution (filtered) — Eastern time
    db.execute(sql`
      SELECT
        EXTRACT(DOW FROM created_at AT TIME ZONE 'America/New_York')::int AS dow,
        COUNT(*)::int AS count
      FROM messages
      WHERE ${mFilter}
      GROUP BY EXTRACT(DOW FROM created_at AT TIME ZONE 'America/New_York')
      ORDER BY dow
    `),
    // Avg messages per session (filtered)
    db.execute(sql`
      SELECT COALESCE(AVG(msg_count), 0)::numeric(10,1) AS avg_per_session
      FROM (
        SELECT chat_id, COUNT(*) AS msg_count
        FROM messages
        WHERE ${mFilter}
        GROUP BY chat_id
      ) sub
    `),
    // Avg response length (filtered)
    db.execute(sql`
      SELECT COALESCE(AVG(LENGTH(content)), 0)::int AS avg_length
      FROM messages
      WHERE role = 'assistant' AND ${mFilter}
    `),
    // Knowledge sources count (not date-filtered)
    db.select({ count: count() }).from(knowledgeSources).where(eq(knowledgeSources.status, 'ready')),
  ]);

  const totalChats = (totalChatsResult.rows as any[])[0]?.count || 0;
  const totalMessages = (totalMessagesResult.rows as any[])[0]?.count || 0;
  const userMessages = (userMessagesResult.rows as any[])[0]?.count || 0;
  const botMessages = (botMessagesResult.rows as any[])[0]?.count || 0;
  const uniqueVisitors = (uniqueVisitorsResult.rows as any[])[0]?.count || 0;

  const dailyMessages = (dailyMessagesResult.rows as Array<{ date: string; count: number }>);

  // Hourly — fill missing hours
  const hourlyMap = new Map<number, number>();
  (hourlyResult.rows as Array<{ hour: number; count: number }>).forEach(r => {
    hourlyMap.set(r.hour, r.count);
  });
  const peakHours = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: hourlyMap.get(i) || 0,
  }));

  let busiestHour = 0;
  let busiestHourCount = 0;
  peakHours.forEach(h => {
    if (h.count > busiestHourCount) {
      busiestHour = h.hour;
      busiestHourCount = h.count;
    }
  });

  const topics = (topicsResult.rows as Array<{ topic: string; count: number }>).map(r => ({
    name: r.topic,
    value: r.count,
  }));

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dowMap = new Map<number, number>();
  (dayOfWeekResult.rows as Array<{ dow: number; count: number }>).forEach(r => {
    dowMap.set(r.dow, r.count);
  });
  const dayOfWeek = DAY_NAMES.map((day, i) => ({
    day,
    count: dowMap.get(i) || 0,
  }));

  let busiestDay = 0;
  let busiestDayCount = 0;
  dayOfWeek.forEach((d, i) => {
    if (d.count > busiestDayCount) {
      busiestDay = i;
      busiestDayCount = d.count;
    }
  });

  const avgPerSession = Number((avgPerSessionResult.rows as any[])[0]?.avg_per_session || 0);
  const avgResponseLength = Number((avgResponseLengthResult.rows as any[])[0]?.avg_length || 0);
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

async function AnalyticsContent({ dateRange }: { dateRange: DateRange }) {
  const data = await getAnalyticsData(dateRange);

  const chartSubtitle = dateRange.days
    ? `Daily message volume — last ${dateRange.days} days`
    : dateRange.fromDate
    ? `Daily message volume — ${dateRange.fromDate} to ${dateRange.toDate}`
    : 'Daily message volume — all time (last 30 days shown)';

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
        <ChartPanel title="Message Activity" subtitle={chartSubtitle}>
          <ActivityTrendChart data={data.dailyMessages} />
        </ChartPanel>
      </div>

      {/* Peak Hours + Topics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ChartPanel title="Peak Hours" subtitle="When your visitors are most active">
          <PeakHourBarChart data={data.peakHours} goldenHour={data.busiestHour} />
        </ChartPanel>
        <ChartPanel title="Conversation Topics" subtitle="What visitors are asking about">
          <TopicsPieChart data={data.topics} />
        </ChartPanel>
      </div>

      {/* Day of Week + Stats Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartPanel title="Day of Week" subtitle="Message distribution across the week">
          <DayOfWeekChart data={data.dayOfWeek} busiestDay={data.busiestDay} />
        </ChartPanel>

        <div className="rounded-2xl bg-white/[0.02] backdrop-blur-xl border border-white/10 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5">
            <h2 className="text-sm font-semibold text-white">Message Intelligence</h2>
            <p className="text-[#C9CDD6]/40 text-xs mt-0.5">Key performance metrics</p>
          </div>
          <div className="p-4 space-y-1">
            <StatRow icon={<User className="w-3.5 h-3.5" />} label="User Messages" value={String(data.userMessages)} color="text-blue-400" />
            <StatRow icon={<Bot className="w-3.5 h-3.5" />} label="Bot Responses" value={String(data.botMessages)} color="text-cyan-400" />
            <StatRow icon={<BarChart3 className="w-3.5 h-3.5" />} label="Response Rate" value={`${data.responseRate}%`} color="text-green-400" />
            <StatRow icon={<MessageSquare className="w-3.5 h-3.5" />} label="Avg Response Length" value={`${data.avgResponseLength} chars`} color="text-purple-400" />
            <StatRow icon={<Database className="w-3.5 h-3.5" />} label="Knowledge Sources" value={String(data.knowledgeCount)} color="text-amber-400" />
            <StatRow icon={<Users className="w-3.5 h-3.5" />} label="Unique Visitors" value={String(data.uniqueVisitors)} color="text-rose-400" />
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

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const dateRange = resolveDateRange(params);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
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

        <Suspense fallback={<div className="h-8 w-48 rounded-lg bg-white/[0.03] animate-pulse" />}>
          <DateFilter />
        </Suspense>
      </div>

      {/* Content */}
      <Suspense fallback={<AnalyticsSkeleton />}>
        <AnalyticsContent dateRange={dateRange} />
      </Suspense>
    </div>
  );
}
