'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, Search, Loader2, CheckCircle2, AlertCircle,
  ExternalLink, Link2, Trash2, Check, Minus,
  Map, Network, ChevronRight, X, Filter,
} from 'lucide-react';
import { useKnowledge, formatBytes } from '../context/KnowledgeContext';

type CrawlMode = 'single' | 'crawl' | 'sitemap';
type Phase = 'input' | 'discovery' | 'review' | 'importing';

interface DiscoveredPage {
  url: string;
  title?: string;
  depth: number;
  selected: boolean;
  status?: 'pending' | 'importing' | 'done' | 'error';
  error?: string;
}

function ModeTab({ mode, currentMode, onClick, icon: Icon, label, description }: {
  mode: CrawlMode; currentMode: CrawlMode; onClick: () => void;
  icon: React.ElementType; label: string; description: string;
}) {
  const isActive = mode === currentMode;
  return (
    <button
      onClick={onClick}
      className={`flex-1 p-4 rounded-xl border transition-all duration-200
        ${isActive
          ? 'bg-green-500/10 border-green-500/30 shadow-lg shadow-green-500/10'
          : 'bg-white/[0.02] border-white/10 hover:bg-white/[0.04] hover:border-white/20'
        }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isActive ? 'bg-green-500/20' : 'bg-white/5'}`}>
          <Icon className={`w-5 h-5 ${isActive ? 'text-green-400' : 'text-white/40'}`} />
        </div>
        <div className="text-left">
          <p className={`text-sm font-medium ${isActive ? 'text-white' : 'text-white/60'}`}>{label}</p>
          <p className="text-xs text-white/40">{description}</p>
        </div>
      </div>
    </button>
  );
}

export default function WebsitePage() {
  const { removeItem, refreshItems, getItemsByType } = useKnowledge();

  const [mode, setMode] = useState<CrawlMode>('single');
  const [phase, setPhase] = useState<Phase>('input');
  const [url, setUrl] = useState('');
  const [includePaths, setIncludePaths] = useState('');
  const [excludePaths, setExcludePaths] = useState('');
  const [discoveredPages, setDiscoveredPages] = useState<DiscoveredPage[]>([]);
  const [discoveryDomain, setDiscoveryDomain] = useState('');
  const [discoveryErrors, setDiscoveryErrors] = useState<string[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const websiteItems = [...getItemsByType('website'), ...getItemsByType('url')];

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === websiteItems.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(websiteItems.map(item => item.id)));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected website${selectedIds.size > 1 ? 's' : ''}?`)) return;
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

  const handleDiscover = async () => {
    if (!url.trim()) { alert('Please enter a URL'); return; }
    let validUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) validUrl = 'https://' + url;
    try { new URL(validUrl); } catch { alert('Please enter a valid URL'); return; }

    setPhase('discovery');
    setIsDiscovering(true);
    setDiscoveryErrors([]);

    try {
      const response = await fetch('/api/knowledge/website/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: validUrl, mode, includePaths: includePaths || undefined, excludePaths: excludePaths || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Discovery failed');

      setDiscoveryDomain(data.domain);
      setDiscoveredPages(
        data.urls.map((u: { url: string; title?: string; depth: number }) => ({
          ...u, selected: true, status: 'pending',
        }))
      );
      if (data.errors?.length) setDiscoveryErrors(data.errors);
      setPhase('review');
    } catch (error) {
      setDiscoveryErrors([error instanceof Error ? error.message : 'Discovery failed']);
      setPhase('input');
    } finally { setIsDiscovering(false); }
  };

  const togglePageSelect = (url: string) => {
    setDiscoveredPages(prev => prev.map(p => (p.url === url ? { ...p, selected: !p.selected } : p)));
  };

  const selectAllPages = () => {
    const allSelected = discoveredPages.every(p => p.selected);
    setDiscoveredPages(prev => prev.map(p => ({ ...p, selected: !allSelected })));
  };

  const handleImport = async () => {
    const selected = discoveredPages.filter(p => p.selected);
    if (selected.length === 0) { alert('Please select at least one page to import'); return; }

    setPhase('importing');
    setImportProgress({ current: 0, total: selected.length });

    for (let i = 0; i < selected.length; i += 5) {
      const batch = selected.slice(i, i + 5);
      await Promise.all(
        batch.map(async (page) => {
          setDiscoveredPages(prev => prev.map(p => (p.url === page.url ? { ...p, status: 'importing' } : p)));
          try {
            const response = await fetch('/api/knowledge', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'website', url: page.url }),
            });
            if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'Import failed'); }
            setDiscoveredPages(prev => prev.map(p => (p.url === page.url ? { ...p, status: 'done' } : p)));
          } catch (error) {
            setDiscoveredPages(prev =>
              prev.map(p => p.url === page.url
                ? { ...p, status: 'error', error: error instanceof Error ? error.message : 'Failed' }
                : p
              )
            );
          }
        })
      );
      setImportProgress({ current: Math.min(i + 5, selected.length), total: selected.length });
    }
    refreshItems();
  };

  const handleReset = () => {
    setPhase('input'); setUrl(''); setIncludePaths(''); setExcludePaths('');
    setDiscoveredPages([]); setDiscoveryDomain(''); setDiscoveryErrors([]);
    setImportProgress({ current: 0, total: 0 });
  };

  const selectedCount = discoveredPages.filter(p => p.selected).length;
  const importedCount = discoveredPages.filter(p => p.status === 'done').length;
  const errorCount = discoveredPages.filter(p => p.status === 'error').length;

  return (
    <div className="space-y-6">
      {/* Main Card */}
      <div className="rounded-2xl overflow-hidden bg-white/[0.02] border border-white/10">
        <div className="px-6 py-5 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <Globe className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Add Website</h2>
                <p className="text-sm text-white/40">
                  {phase === 'input' && 'Choose import mode and enter URL'}
                  {phase === 'discovery' && 'Discovering pages...'}
                  {phase === 'review' && `Found ${discoveredPages.length} pages`}
                  {phase === 'importing' && `Importing ${importProgress.current}/${importProgress.total}`}
                </p>
              </div>
            </div>
            {(phase === 'review' || phase === 'importing') && (
              <button onClick={handleReset} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-sm transition-colors">
                <X className="w-4 h-4" /> Start Over
              </button>
            )}
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* INPUT PHASE */}
          {phase === 'input' && (
            <>
              <div className="space-y-3">
                <label className="block text-sm font-medium text-white/60">Import Mode</label>
                <div className="flex gap-3">
                  <ModeTab mode="single" currentMode={mode} onClick={() => setMode('single')} icon={Link2} label="Single URL" description="Import one page" />
                  <ModeTab mode="crawl" currentMode={mode} onClick={() => setMode('crawl')} icon={Network} label="Crawl Site" description="Discover pages" />
                  <ModeTab mode="sitemap" currentMode={mode} onClick={() => setMode('sitemap')} icon={Map} label="Sitemap" description="Import from sitemap.xml" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-white/60">{mode === 'sitemap' ? 'Sitemap URL' : 'Website URL'}</label>
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2"><Link2 className="w-5 h-5 text-white/30" /></div>
                    <input
                      type="url" value={url} onChange={(e) => setUrl(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !isDiscovering) handleDiscover(); }}
                      placeholder={mode === 'sitemap' ? 'https://example.com/sitemap.xml' : 'https://example.com'}
                      className="w-full pl-12 pr-4 py-4 rounded-xl bg-white/[0.03] border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-green-500/50 focus:bg-white/[0.05] transition-all duration-200 font-mono text-sm"
                    />
                  </div>
                  <motion.button type="button" onClick={handleDiscover} disabled={isDiscovering || !url.trim()} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="px-8 py-4 rounded-xl font-semibold bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white shadow-lg shadow-green-500/25 transition-all duration-200 flex items-center gap-2"
                  >
                    {isDiscovering ? <><Loader2 className="w-5 h-5 animate-spin" />Scanning...</> : <><Search className="w-5 h-5" />{mode === 'single' ? 'Fetch' : 'Scan'}</>}
                  </motion.button>
                </div>
              </div>

              {(mode === 'crawl' || mode === 'sitemap') && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-white/60"><Filter className="w-4 h-4" /> Path Filters (optional)</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-white/40">Include paths</label>
                      <input type="text" value={includePaths} onChange={(e) => setIncludePaths(e.target.value)} placeholder="/blog/*, /docs/*"
                        className="w-full px-4 py-3 rounded-lg bg-white/[0.03] border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-green-500/50 transition-all duration-200 font-mono text-sm" />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-white/40">Exclude paths</label>
                      <input type="text" value={excludePaths} onChange={(e) => setExcludePaths(e.target.value)} placeholder="/admin/*, /api/*"
                        className="w-full px-4 py-3 rounded-lg bg-white/[0.03] border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-green-500/50 transition-all duration-200 font-mono text-sm" />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* DISCOVERY PHASE */}
          {phase === 'discovery' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-green-500/20 flex items-center justify-center mb-4">
                <Loader2 className="w-8 h-8 text-green-400 animate-spin" />
              </div>
              <p className="text-white font-medium">Discovering pages...</p>
              <p className="text-sm text-white/40 mt-1">{url}</p>
            </div>
          )}

          {/* REVIEW PHASE */}
          {phase === 'review' && (
            <>
              <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{discoveryDomain}</p>
                    <p className="text-xs text-white/40">{discoveredPages.length} pages found</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-white/60">{selectedCount} selected</span>
                  <motion.button onClick={handleImport} disabled={selectedCount === 0} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="px-6 py-2 rounded-lg font-semibold bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white text-sm shadow-lg transition-all duration-200 flex items-center gap-2"
                  >
                    <ChevronRight className="w-4 h-4" /> Import Selected
                  </motion.button>
                </div>
              </div>

              {discoveryErrors.length > 0 && (
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-xs text-yellow-400 font-medium mb-1">Some issues occurred:</p>
                  <ul className="text-xs text-yellow-400/70 space-y-0.5">
                    {discoveryErrors.slice(0, 3).map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-between">
                <button onClick={selectAllPages} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-sm transition-colors">
                  {discoveredPages.every(p => p.selected) ? <><Minus className="w-4 h-4" /> Deselect All</> : <><Check className="w-4 h-4" /> Select All</>}
                </button>
                <span className="text-xs text-white/40 font-mono">{selectedCount}/{discoveredPages.length} pages</span>
              </div>

              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {discoveredPages.map((page) => (
                  <motion.div key={page.url} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className={`group flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 cursor-pointer
                      ${page.selected ? 'bg-green-500/10 border-green-500/30' : 'bg-white/[0.02] border-white/10 hover:bg-white/[0.04]'}`}
                    onClick={() => togglePageSelect(page.url)}
                  >
                    <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-all duration-200
                      ${page.selected ? 'bg-green-500 border-green-500' : 'border-white/20'}`}>
                      {page.selected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{page.title || page.url}</p>
                      <p className="text-xs text-white/30 truncate font-mono">{page.url}</p>
                    </div>
                    {page.depth > 0 && <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 text-white/40">depth {page.depth}</span>}
                    <a href={page.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                      className="p-2 rounded-lg hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors opacity-0 group-hover:opacity-100">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </motion.div>
                ))}
              </div>
            </>
          )}

          {/* IMPORTING PHASE */}
          {phase === 'importing' && (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/60">Importing pages...</span>
                  <span className="text-white font-mono">{importProgress.current}/{importProgress.total}</span>
                </div>
                <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                    className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full" transition={{ duration: 0.3 }} />
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1 text-green-400"><CheckCircle2 className="w-3 h-3" />{importedCount} imported</span>
                  {errorCount > 0 && <span className="flex items-center gap-1 text-red-400"><AlertCircle className="w-3 h-3" />{errorCount} failed</span>}
                </div>
              </div>

              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2">
                {discoveredPages.filter(p => p.selected).map((page) => (
                  <motion.div key={page.url} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/10">
                    <div className="flex-shrink-0">
                      {page.status === 'done' ? (
                        <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-green-400" /></div>
                      ) : page.status === 'error' ? (
                        <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center"><AlertCircle className="w-4 h-4 text-red-400" /></div>
                      ) : page.status === 'importing' ? (
                        <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center"><Loader2 className="w-4 h-4 text-green-400 animate-spin" /></div>
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center"><Globe className="w-4 h-4 text-white/30" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{page.title || page.url}</p>
                      <p className="text-xs text-white/30 truncate font-mono">{page.url}</p>
                      {page.status === 'error' && <p className="text-xs text-red-400 mt-0.5">{page.error}</p>}
                    </div>
                  </motion.div>
                ))}
              </div>

              {importProgress.current === importProgress.total && (
                <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onClick={handleReset}
                  className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white shadow-lg transition-all duration-200">
                  Done - Import More
                </motion.button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Existing Websites Card */}
      <div className="rounded-2xl overflow-hidden bg-white/[0.02] border border-white/10">
        <div className="px-6 py-4 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {websiteItems.length > 0 && (
                <button onClick={toggleSelectAll}
                  className={`w-5 h-5 rounded border flex items-center justify-center transition-all duration-200
                    ${selectedIds.size === websiteItems.length ? 'bg-green-500 border-green-500' : selectedIds.size > 0 ? 'bg-green-500/50 border-green-500' : 'border-white/20 hover:border-white/40'}`}>
                  {selectedIds.size === websiteItems.length ? <Check className="w-3 h-3 text-white" /> : selectedIds.size > 0 ? <Minus className="w-3 h-3 text-white" /> : null}
                </button>
              )}
              <h3 className="text-sm font-semibold text-white">Existing Websites</h3>
            </div>
            <div className="flex items-center gap-3">
              {selectedIds.size > 0 && (
                <button onClick={handleBulkDelete} disabled={isDeleting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium transition-colors disabled:opacity-50">
                  {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  Delete ({selectedIds.size})
                </button>
              )}
              <span className="text-xs font-mono text-white/30">{websiteItems.length} items</span>
            </div>
          </div>
        </div>
        <div className="divide-y divide-white/5">
          {websiteItems.length === 0 ? (
            <div className="p-8 text-center">
              <Globe className="w-8 h-8 text-white/10 mx-auto mb-2" />
              <p className="text-sm text-white/30">No websites added yet</p>
              <p className="text-xs text-white/20 mt-1">Enter a URL above to get started</p>
            </div>
          ) : (
            websiteItems.map((item) => (
              <motion.div key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className={`group flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors cursor-pointer
                  ${selectedIds.has(item.id) ? 'bg-green-500/10' : ''}`}
                onClick={() => toggleSelect(item.id)}>
                <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-all duration-200
                  ${selectedIds.has(item.id) ? 'bg-green-500 border-green-500' : 'border-white/20 group-hover:border-white/40'}`}>
                  {selectedIds.has(item.id) && <Check className="w-3 h-3 text-white" />}
                </div>
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                  <Globe className="w-4 h-4 text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{item.name}</p>
                  <p className="text-xs text-white/30 mt-0.5">{new Date(item.createdAt).toLocaleDateString()}</p>
                </div>
                <span className="px-2 py-1 rounded text-[10px] font-mono bg-green-500/10 text-green-400 border border-green-500/20">
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
