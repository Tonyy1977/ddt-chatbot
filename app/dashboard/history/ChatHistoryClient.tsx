'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Search, Trash2, Download, ChevronRight, User, Bot, X } from 'lucide-react';

interface Thread {
  id: string;
  visitorId: string;
  lastMessage: string;
  messageCount: number;
  updatedAt: string;
}

interface Message {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

export function ChatHistoryClient({ initialThreads }: { initialThreads: Thread[] }) {
  const [threads, setThreads] = useState(initialThreads);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const filteredThreads = threads.filter(t =>
    t.visitorId.toLowerCase().includes(search.toLowerCase()) ||
    t.lastMessage.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (!selectedThread) return;
    setLoading(true);
    fetch(`/api/chats/${selectedThread.id}`)
      .then(res => res.json())
      .then(data => setMessages(data.messages || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedThread]);

  const handleDelete = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this conversation?')) return;
    await fetch(`/api/chats/${chatId}`, { method: 'DELETE' });
    setThreads(prev => prev.filter(t => t.id !== chatId));
    if (selectedThread?.id === chatId) {
      setSelectedThread(null);
      setMessages([]);
    }
  };

  const handleExportCSV = () => {
    const rows = [['Session', 'Role', 'Content', 'Time']];
    if (selectedThread && messages.length) {
      messages.forEach(m => {
        rows.push([selectedThread.visitorId, m.role, `"${m.content.replace(/"/g, '""')}"`, m.createdAt]);
      });
    }
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${selectedThread?.visitorId || 'all'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Chat History</h1>
          <p className="text-[#C9CDD6]/60 text-sm">{threads.length} conversations</p>
        </div>
        {selectedThread && (
          <button onClick={handleExportCSV}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-[#C9CDD6]/60 text-sm bg-white/[0.03] border border-white/10 hover:border-cyan-500/30 hover:text-cyan-400 transition-all">
            <Download className="w-4 h-4" /><span className="hidden sm:inline">Export CSV</span>
          </button>
        )}
      </div>

      <div className="flex gap-4 h-[calc(100vh-220px)]">
        {/* Thread List */}
        <div className="w-full md:w-96 flex flex-col rounded-xl bg-white/[0.02] border border-white/10 overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-white/5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C9CDD6]/40" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-9 pr-4 py-2 bg-black/20 border border-white/10 rounded-lg text-white text-sm placeholder-[#C9CDD6]/30 focus:border-cyan-500/50 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Threads */}
          <div className="flex-1 overflow-y-auto">
            {filteredThreads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[#C9CDD6]/40">
                <MessageSquare className="w-8 h-8 mb-2" />
                <p className="text-sm">No conversations found</p>
              </div>
            ) : (
              filteredThreads.map(thread => (
                <div
                  key={thread.id}
                  onClick={() => setSelectedThread(thread)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedThread(thread)}
                  className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/[0.03] transition-colors group cursor-pointer ${selectedThread?.id === thread.id ? 'bg-cyan-500/5 border-l-2 border-l-cyan-400' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white truncate max-w-[60%]">{thread.visitorId}</span>
                    <span className="text-[10px] text-[#C9CDD6]/40 font-mono">{formatTime(thread.updatedAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[#C9CDD6]/50 truncate max-w-[70%]">{thread.lastMessage}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-cyan-400/60 font-mono">{thread.messageCount} msgs</span>
                      <button onClick={(e) => handleDelete(thread.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 hover:text-red-400 text-[#C9CDD6]/30 transition-all">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Message Detail */}
        <div className="hidden md:flex flex-1 flex-col rounded-xl bg-white/[0.02] border border-white/10 overflow-hidden">
          {!selectedThread ? (
            <div className="flex flex-col items-center justify-center h-full text-[#C9CDD6]/30">
              <ChevronRight className="w-12 h-12 mb-3" />
              <p className="text-sm">Select a conversation to view messages</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/[0.01]">
                <div>
                  <h3 className="text-sm font-medium text-white">{selectedThread.visitorId}</h3>
                  <p className="text-[10px] text-[#C9CDD6]/40 font-mono">{selectedThread.messageCount} messages</p>
                </div>
                <button onClick={() => { setSelectedThread(null); setMessages([]); }}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-[#C9CDD6]/40 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-6 h-6 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                  </div>
                ) : (
                  <AnimatePresence>
                    {messages.map((msg, i) => (
                      <motion.div
                        key={msg.id || i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className={`flex gap-3 ${msg.role === 'user' ? '' : ''}`}
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-cyan-500/20 border border-cyan-500/30'}`}>
                          {msg.role === 'user' ? <User className="w-3.5 h-3.5 text-blue-400" /> : <Bot className="w-3.5 h-3.5 text-cyan-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-white">{msg.role === 'user' ? 'Visitor' : 'Micah'}</span>
                            <span className="text-[10px] text-[#C9CDD6]/30 font-mono">
                              {new Date(msg.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-sm text-[#C9CDD6]/80 whitespace-pre-wrap break-words">{msg.content}</p>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
