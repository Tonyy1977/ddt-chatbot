import { db } from '@/db';
import { chats, messages } from '@/db/schema';
import { count, sql, eq } from 'drizzle-orm';
import { MessageSquare, Users, TrendingUp, Clock } from 'lucide-react';

async function getStats() {
  const [totalChats] = await db.select({ count: count() }).from(chats);
  const [totalMessages] = await db.select({ count: count() }).from(messages);
  const [userMessages] = await db.select({ count: count() }).from(messages).where(eq(messages.role, 'user'));

  const [todayMessages] = await db.select({ count: count() }).from(messages).where(
    sql`${messages.createdAt} >= CURRENT_DATE`
  );

  const [activeSessions] = await db.select({
    count: sql<number>`count(distinct ${chats.id})`
  }).from(chats).where(
    sql`${chats.updatedAt} >= NOW() - INTERVAL '24 hours'`
  );

  return {
    totalChats: totalChats?.count || 0,
    totalMessages: totalMessages?.count || 0,
    userMessages: userMessages?.count || 0,
    todayMessages: todayMessages?.count || 0,
    activeSessions: activeSessions?.count || 0,
  };
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  color: 'cyan' | 'purple' | 'green' | 'amber';
}) {
  const colors = {
    cyan: 'from-cyan-500/20 to-blue-500/20 border-cyan-500/30 text-cyan-400',
    purple: 'from-purple-500/20 to-pink-500/20 border-purple-500/30 text-purple-400',
    green: 'from-green-500/20 to-emerald-500/20 border-green-500/30 text-green-400',
    amber: 'from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-400',
  };

  return (
    <div className={`relative p-5 rounded-xl bg-gradient-to-br ${colors[color].split(' ').slice(0, 2).join(' ')} border ${colors[color].split(' ')[2]} backdrop-blur-sm`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center ${colors[color].split(' ')[3]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="text-3xl font-bold text-white mb-1">{value}</div>
      <div className="text-sm text-[#C9CDD6]/60 font-mono uppercase tracking-wider">{label}</div>
    </div>
  );
}

export default async function DashboardPage() {
  const stats = await getStats();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Command Deck</h1>
        <p className="text-[#C9CDD6]/60 text-sm">DDT Enterprise chatbot overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Conversations" value={stats.totalChats} color="cyan" />
        <StatCard icon={MessageSquare} label="Total Messages" value={stats.totalMessages} color="purple" />
        <StatCard icon={TrendingUp} label="Messages Today" value={stats.todayMessages} color="green" />
        <StatCard icon={Clock} label="Active (24h)" value={stats.activeSessions} color="amber" />
      </div>

      {/* Quick Info */}
      <div className="p-5 rounded-xl bg-white/[0.02] border border-white/10 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-cyan-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">Quick Stats</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5">
            <span className="text-[#C9CDD6]/60">User Messages</span>
            <span className="text-white font-medium">{stats.userMessages}</span>
          </div>
          <div className="flex justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5">
            <span className="text-[#C9CDD6]/60">Bot Responses</span>
            <span className="text-white font-medium">{Number(stats.totalMessages) - Number(stats.userMessages)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
