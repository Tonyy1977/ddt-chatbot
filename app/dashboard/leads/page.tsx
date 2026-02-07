'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Mail,
  Phone,
  Clock,
  MessageSquare,
  Search,
  Filter,
  Download,
  UserPlus,
  Loader2,
  X,
} from 'lucide-react';
import { getLeads } from '@/app/actions/leads';

interface Lead {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  chatId: string | null;
  status: string;
  createdAt: Date;
}

function TableHeader() {
  return (
    <div className="grid grid-cols-[1fr_1.5fr_1fr_1fr_1fr] gap-4 px-4 py-3
      bg-white/[0.02] border-b border-white/10
      font-mono text-[10px] text-[#C9CDD6]/50 uppercase tracking-wider">
      <div className="flex items-center gap-2">
        <Users className="w-3.5 h-3.5" />
        Lead Name
      </div>
      <div className="flex items-center gap-2">
        <Mail className="w-3.5 h-3.5" />
        Email
      </div>
      <div className="flex items-center gap-2">
        <Phone className="w-3.5 h-3.5" />
        Phone
      </div>
      <div className="flex items-center gap-2">
        <Clock className="w-3.5 h-3.5" />
        Captured At
      </div>
      <div className="flex items-center gap-2">
        <MessageSquare className="w-3.5 h-3.5" />
        Source
      </div>
    </div>
  );
}

function TableRow({ lead }: { lead: Lead }) {
  const capturedAt = new Date(lead.createdAt);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-[1fr_1.5fr_1fr_1fr_1fr] gap-4 px-4 py-4
        border-b border-white/5 hover:bg-white/[0.02]
        transition-colors duration-200 group"
    >
      <div className="text-white font-medium truncate">{lead.name || '\u2014'}</div>
      <div className="text-[#C9CDD6]/70 truncate">{lead.email || '\u2014'}</div>
      <div className="text-[#C9CDD6]/70">{lead.phone || '\u2014'}</div>
      <div className="text-[#C9CDD6]/50 font-mono text-sm">
        {capturedAt.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-cyan-400/60" />
        <span className="text-[#C9CDD6]/70 truncate capitalize">{lead.source}</span>
      </div>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-20 px-6"
    >
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10
          border border-cyan-500/20 flex items-center justify-center">
          <UserPlus className="w-9 h-9 text-cyan-400/60" />
        </div>
        <div className="absolute inset-0 rounded-2xl border border-cyan-500/10 scale-125 opacity-50" />
      </div>
      <h3 className="text-lg font-medium text-white mb-2">No leads captured yet</h3>
      <p className="text-[#C9CDD6]/50 text-sm text-center max-w-md mb-6">
        When visitors share their contact info in chat, leads will appear here automatically.
      </p>
      <a
        href="/dashboard/history"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl
          bg-cyan-500/10 text-cyan-400 border border-cyan-500/20
          hover:bg-cyan-500/20 hover:border-cyan-500/30
          transition-all duration-200 text-sm font-medium"
      >
        <MessageSquare className="w-4 h-4" />
        View Chat History
      </a>
    </motion.div>
  );
}

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = [headers.join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function LeadsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    getLeads()
      .then((data) => setAllLeads(data as Lead[]))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredLeads = allLeads.filter((lead) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (lead.name || '').toLowerCase().includes(q) ||
      (lead.email || '').toLowerCase().includes(q) ||
      (lead.phone || '').toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleExport = () => {
    const date = new Date().toISOString().slice(0, 10);
    downloadCSV(
      `leads-${date}.csv`,
      ['Name', 'Email', 'Phone', 'Source', 'Status', 'Captured At'],
      filteredLeads.map((l) => [
        l.name || '',
        l.email || '',
        l.phone || '',
        l.source,
        l.status,
        new Date(l.createdAt).toISOString(),
      ])
    );
  };

  const activeFilterCount = statusFilter !== 'all' ? 1 : 0;

  const thisWeekCount = allLeads.filter((lead) => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return new Date(lead.createdAt) >= weekAgo;
  }).length;

  return (
    <div className="min-h-screen">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20
            border border-cyan-500/30 flex items-center justify-center">
            <Users className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">Leads</h1>
            <p className="text-[#C9CDD6]/50 text-sm">
              Contacts captured from chat conversations
            </p>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Leads', value: allLeads.length },
          { label: 'This Week', value: thisWeekCount },
          { label: 'New', value: allLeads.filter((l) => l.status === 'new').length },
        ].map((stat, i) => (
          <div
            key={i}
            className="p-4 rounded-xl bg-white/[0.02] border border-white/10"
          >
            <p className="text-[#C9CDD6]/50 text-xs font-mono uppercase tracking-wider mb-1">
              {stat.label}
            </p>
            <p className="text-2xl font-semibold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Controls Bar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C9CDD6]/40" />
          <input
            type="text"
            placeholder="Search leads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl
              bg-white/[0.03] border border-white/10
              text-white placeholder:text-[#C9CDD6]/30
              focus:outline-none focus:border-cyan-500/30 focus:bg-white/[0.05]
              transition-all duration-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl
              border transition-all duration-200 text-sm
              ${showFilters || activeFilterCount > 0
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                : 'bg-white/[0.03] border-white/10 text-[#C9CDD6]/60 hover:text-white hover:border-white/20'
              }`}
          >
            <Filter className="w-4 h-4" />
            Filter
            {activeFilterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-[10px] font-mono">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={handleExport}
            disabled={filteredLeads.length === 0}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl
              bg-white/[0.03] border border-white/10
              text-[#C9CDD6]/60 hover:text-white hover:border-white/20
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-all duration-200 text-sm"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-6 mb-6 p-4 rounded-xl bg-white/[0.02] border border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#C9CDD6]/40 font-mono uppercase tracking-wider">
                  Status
                </span>
                <div className="flex gap-1">
                  {['all', 'new', 'contacted'].map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200
                        ${statusFilter === s
                          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                          : 'text-[#C9CDD6]/50 hover:text-white border border-transparent hover:border-white/10'
                        }`}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              {activeFilterCount > 0 && (
                <button
                  onClick={() => setStatusFilter('all')}
                  className="flex items-center gap-1 text-xs text-[#C9CDD6]/40 hover:text-white transition-colors ml-auto"
                >
                  <X className="w-3 h-3" />
                  Clear
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table Container */}
      <div className="rounded-xl border border-white/10 bg-white/[0.01] overflow-hidden">
        <TableHeader />
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
          </div>
        ) : filteredLeads.length > 0 ? (
          <div>
            {filteredLeads.map((lead) => (
              <TableRow key={lead.id} lead={lead} />
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Footer */}
      {allLeads.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-[#C9CDD6]/40 text-sm">
          <span>Showing {filteredLeads.length} of {allLeads.length} leads</span>
          <span className="font-mono text-xs">Last synced: Just now</span>
        </div>
      )}
    </div>
  );
}
