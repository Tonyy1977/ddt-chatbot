'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircleQuestion, Plus, X, Save, Loader2,
  HelpCircle, Trash2, Check, Minus,
} from 'lucide-react';
import { useKnowledge, formatBytes, calculateStringSize } from '../context/KnowledgeContext';

export default function QAPage() {
  const router = useRouter();
  const { addItem, removeItem, getItemsByType } = useKnowledge();

  const [title, setTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [variations, setVariations] = useState<string[]>([]);
  const [newVariation, setNewVariation] = useState('');
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVariationInput, setShowVariationInput] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const qaItems = getItemsByType('qa');
  const currentContentSize = calculateStringSize(title + question + variations.join('') + answer);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === qaItems.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(qaItems.map(item => item.id)));
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
    } catch (error) { console.error('Bulk delete error:', error); }
    finally { setIsDeleting(false); }
  };

  const handleAddVariation = () => {
    if (newVariation.trim() && !variations.includes(newVariation.trim())) {
      setVariations([...variations, newVariation.trim()]);
      setNewVariation('');
      setShowVariationInput(false);
    }
  };

  const handleRemoveVariation = (index: number) => {
    setVariations(variations.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !question.trim() || !answer.trim()) {
      alert('Please fill in title, question, and answer');
      return;
    }

    setIsSubmitting(true);
    const content = JSON.stringify({ question, variations, answer });

    try {
      const response = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'qa', name: title, content }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save');

      addItem({
        type: 'qa',
        name: title,
        size: calculateStringSize(content),
        status: 'ready',
        content,
      });

      setTitle('');
      setQuestion('');
      setVariations([]);
      setAnswer('');
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Q&A Form Card */}
      <div className="rounded-2xl overflow-hidden bg-white/[0.02] border border-white/10">
        <div className="px-6 py-5 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <MessageCircleQuestion className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Add Q&A Pair</h2>
                <p className="text-sm text-white/40">Define question-answer pairs for precise responses</p>
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
              <span className="text-xs font-mono text-purple-400">{formatBytes(currentContentSize)}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Title */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white/60">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="E.g., Refund Policy, Business Hours..."
              className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.05] transition-all duration-200" />
          </div>

          {/* Question */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-white/60">Question</label>
              <div className="flex items-center gap-1 text-xs text-white/30">
                <HelpCircle className="w-3 h-3" /> Main question users might ask
              </div>
            </div>
            <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)}
              placeholder="What is your refund policy?"
              className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.05] transition-all duration-200" />

            {/* Variations */}
            <div className="pt-2 space-y-2">
              <AnimatePresence>
                {variations.map((variation, index) => (
                  <motion.div key={index} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2">
                    <div className="flex-1 px-4 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-sm text-purple-300">{variation}</div>
                    <button type="button" onClick={() => handleRemoveVariation(index)}
                      className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>

              <AnimatePresence>
                {showVariationInput && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2">
                    <input type="text" value={newVariation} onChange={(e) => setNewVariation(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); handleAddVariation(); }
                        if (e.key === 'Escape') { setShowVariationInput(false); setNewVariation(''); }
                      }}
                      placeholder="Add an alternate phrasing..." autoFocus
                      className="flex-1 px-4 py-2 rounded-lg bg-white/[0.03] border border-purple-500/30 text-white placeholder-white/30 text-sm focus:outline-none focus:border-purple-500/50 transition-all duration-200" />
                    <button type="button" onClick={handleAddVariation} className="p-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 transition-colors">
                      <Plus className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => { setShowVariationInput(false); setNewVariation(''); }}
                      className="p-2 rounded-lg hover:bg-white/10 text-white/40 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {!showVariationInput && (
                <button type="button" onClick={() => setShowVariationInput(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 transition-colors">
                  <Plus className="w-3 h-3" /> Add Variation
                </button>
              )}
            </div>
          </div>

          {/* Answer */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white/60">Answer</label>
            <textarea value={answer} onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type the answer here..."
              rows={6}
              className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.05] transition-all duration-200 resize-y min-h-[150px]" />
          </div>

          {/* Submit */}
          <motion.button type="submit" disabled={isSubmitting || !title.trim() || !question.trim() || !answer.trim()}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="w-full py-4 px-6 rounded-xl font-semibold bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-200 flex items-center justify-center gap-2">
            {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" />Saving...</> : <><Save className="w-5 h-5" />Save Q&A Pair</>}
          </motion.button>
        </form>
      </div>

      {/* Existing Q&A Pairs Card */}
      <div className="rounded-2xl overflow-hidden bg-white/[0.02] border border-white/10">
        <div className="px-6 py-4 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {qaItems.length > 0 && (
                <button onClick={toggleSelectAll}
                  className={`w-5 h-5 rounded border flex items-center justify-center transition-all duration-200
                    ${selectedIds.size === qaItems.length ? 'bg-purple-500 border-purple-500' : selectedIds.size > 0 ? 'bg-purple-500/50 border-purple-500' : 'border-white/20 hover:border-white/40'}`}>
                  {selectedIds.size === qaItems.length ? <Check className="w-3 h-3 text-white" /> : selectedIds.size > 0 ? <Minus className="w-3 h-3 text-white" /> : null}
                </button>
              )}
              <h3 className="text-sm font-semibold text-white">Existing Q&A Pairs</h3>
            </div>
            <div className="flex items-center gap-3">
              {selectedIds.size > 0 && (
                <button onClick={handleBulkDelete} disabled={isDeleting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium transition-colors disabled:opacity-50">
                  {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  Delete ({selectedIds.size})
                </button>
              )}
              <span className="text-xs font-mono text-white/30">{qaItems.length} items</span>
            </div>
          </div>
        </div>

        <div className="divide-y divide-white/5">
          {qaItems.length === 0 ? (
            <div className="p-8 text-center">
              <MessageCircleQuestion className="w-8 h-8 text-white/10 mx-auto mb-2" />
              <p className="text-sm text-white/30">No Q&A pairs yet</p>
              <p className="text-xs text-white/20 mt-1">Add your first Q&A above</p>
            </div>
          ) : (
            qaItems.map((item) => (
              <motion.div key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className={`group flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors cursor-pointer
                  ${selectedIds.has(item.id) ? 'bg-purple-500/10' : ''}`}
                onClick={() => toggleSelect(item.id)}>
                <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-all duration-200
                  ${selectedIds.has(item.id) ? 'bg-purple-500 border-purple-500' : 'border-white/20 group-hover:border-white/40'}`}>
                  {selectedIds.has(item.id) && <Check className="w-3 h-3 text-white" />}
                </div>
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                  <MessageCircleQuestion className="w-4 h-4 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{item.name}</p>
                  <p className="text-xs text-white/30 mt-0.5">{new Date(item.createdAt).toLocaleDateString()}</p>
                </div>
                <span className="px-2 py-1 rounded text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
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
