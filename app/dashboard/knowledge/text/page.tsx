'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AlignLeft, Save, Loader2, Trash2, Check, Minus } from 'lucide-react';
import { useKnowledge, formatBytes, calculateStringSize } from '../context/KnowledgeContext';

export default function TextSnippetPage() {
  const router = useRouter();
  const { addItem, removeItem, getItemsByType } = useKnowledge();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const textItems = getItemsByType('text');
  const currentContentSize = calculateStringSize(content);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === textItems.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(textItems.map(item => item.id)));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected item${selectedIds.size > 1 ? 's' : ''}?`)) return;

    setIsDeleting(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map(async (id) => {
          const response = await fetch(`/api/knowledge/${id}`, { method: 'DELETE' });
          if (response.ok) removeItem(id);
        })
      );
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Bulk delete error:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      alert('Please fill in both title and content');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'text', name: title, content }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save');

      addItem({
        type: 'text',
        name: title,
        size: calculateStringSize(content),
        status: 'ready',
        content,
      });

      setTitle('');
      setContent('');
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Text Form Card */}
      <div className="rounded-2xl overflow-hidden bg-white/[0.02] border border-white/10">
        <div className="px-6 py-5 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <AlignLeft className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Add Text Snippet</h2>
                <p className="text-sm text-white/40">Write or paste content to train your AI</p>
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
              <span className="text-xs font-mono text-blue-400">{formatBytes(currentContentSize)}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white/60">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a descriptive title..."
              className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.05] transition-all duration-200"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-white/60">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste or type your content here..."
              rows={8}
              className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.05] transition-all duration-200 resize-y min-h-[200px]"
            />
          </div>

          <motion.button
            type="submit"
            disabled={isSubmitting || !title.trim() || !content.trim()}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-4 px-6 rounded-xl font-semibold bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-200 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <><Loader2 className="w-5 h-5 animate-spin" />Saving...</>
            ) : (
              <><Save className="w-5 h-5" />Save Text Snippet</>
            )}
          </motion.button>
        </form>
      </div>

      {/* Existing Text Snippets Card */}
      <div className="rounded-2xl overflow-hidden bg-white/[0.02] border border-white/10">
        <div className="px-6 py-4 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {textItems.length > 0 && (
                <button
                  onClick={toggleSelectAll}
                  className={`w-5 h-5 rounded border flex items-center justify-center transition-all duration-200
                    ${selectedIds.size === textItems.length
                      ? 'bg-blue-500 border-blue-500'
                      : selectedIds.size > 0 ? 'bg-blue-500/50 border-blue-500' : 'border-white/20 hover:border-white/40'
                    }`}
                >
                  {selectedIds.size === textItems.length ? <Check className="w-3 h-3 text-white" /> : selectedIds.size > 0 ? <Minus className="w-3 h-3 text-white" /> : null}
                </button>
              )}
              <h3 className="text-sm font-semibold text-white">Existing Text Snippets</h3>
            </div>
            <div className="flex items-center gap-3">
              {selectedIds.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  disabled={isDeleting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  Delete ({selectedIds.size})
                </button>
              )}
              <span className="text-xs font-mono text-white/30">{textItems.length} items</span>
            </div>
          </div>
        </div>

        <div className="divide-y divide-white/5">
          {textItems.length === 0 ? (
            <div className="p-8 text-center">
              <AlignLeft className="w-8 h-8 text-white/10 mx-auto mb-2" />
              <p className="text-sm text-white/30">No text snippets yet</p>
              <p className="text-xs text-white/20 mt-1">Add your first snippet above</p>
            </div>
          ) : (
            textItems.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`group flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors cursor-pointer
                  ${selectedIds.has(item.id) ? 'bg-blue-500/10' : ''}`}
                onClick={() => toggleSelect(item.id)}
              >
                <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-all duration-200
                  ${selectedIds.has(item.id) ? 'bg-blue-500 border-blue-500' : 'border-white/20 group-hover:border-white/40'}`}
                >
                  {selectedIds.has(item.id) && <Check className="w-3 h-3 text-white" />}
                </div>

                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <AlignLeft className="w-4 h-4 text-blue-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{item.name}</p>
                  <p className="text-xs text-white/30 mt-0.5">{new Date(item.createdAt).toLocaleDateString()}</p>
                </div>

                <span className="px-2 py-1 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {formatBytes(item.size)}
                </span>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
