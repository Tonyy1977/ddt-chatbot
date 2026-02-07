'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, FileText, CheckCircle2, XCircle, Loader2,
  Trash2, Check, Minus,
} from 'lucide-react';
import { useKnowledge, formatBytes } from '../context/KnowledgeContext';

interface UploadingFile {
  file: File;
  progress: number;
  status: 'uploading' | 'processing' | 'done' | 'error';
  error?: string;
}

export default function FilesPage() {
  const { removeItem, refreshItems, getItemsByType } = useKnowledge();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const fileItems = ['file', 'pdf', 'txt', 'md', 'docx'].flatMap(type =>
    getItemsByType(type as any)
  );

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === fileItems.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(fileItems.map(item => item.id)));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected file${selectedIds.size > 1 ? 's' : ''}?`)) return;

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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    setUploadingFiles((prev) =>
      prev.map((f) =>
        f.file === file ? { ...f, progress: 30, status: 'uploading' } : f
      )
    );

    try {
      const response = await fetch('/api/knowledge', {
        method: 'POST',
        body: formData,
      });

      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.file === file ? { ...f, progress: 60, status: 'processing' } : f
        )
      );

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Upload failed');

      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.file === file ? { ...f, progress: 100, status: 'done' } : f
        )
      );

      setTimeout(() => {
        refreshItems();
        setUploadingFiles((prev) => prev.filter((f) => f.file !== file));
      }, 1500);
    } catch (error) {
      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.file === file
            ? { ...f, status: 'error', error: error instanceof Error ? error.message : 'Upload failed' }
            : f
        )
      );
    }
  };

  const handleFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      return ['pdf', 'txt', 'md', 'doc', 'docx'].includes(ext || '');
    });

    if (validFiles.length === 0) {
      alert('Please upload PDF, TXT, MD, DOC, or DOCX files only');
      return;
    }

    const newUploadingFiles: UploadingFile[] = validFiles.map((file) => ({
      file, progress: 0, status: 'uploading' as const,
    }));

    setUploadingFiles((prev) => [...prev, ...newUploadingFiles]);
    validFiles.forEach(uploadFile);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
  };

  return (
    <div className="space-y-6">
      {/* Upload Card */}
      <div className="rounded-2xl overflow-hidden bg-white/[0.02] border border-white/10">
        <div className="px-6 py-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Upload Files</h2>
              <p className="text-sm text-white/40">Train your AI with PDF, TXT, or Markdown documents</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative min-h-[300px] rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center
              ${isDragging
                ? 'border-cyan-400 bg-cyan-500/10 scale-[1.02]'
                : 'border-white/20 hover:border-cyan-400/50 bg-white/[0.02]'
              }`}
          >
            <input
              type="file"
              multiple
              accept=".pdf,.txt,.md,.doc,.docx"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />

            <motion.div
              animate={isDragging ? { scale: 1.1, y: -10 } : { scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="flex flex-col items-center"
            >
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 transition-all duration-300
                ${isDragging ? 'bg-cyan-500/20 shadow-[0_0_30px_rgba(34,211,238,0.3)]' : 'bg-white/5'}`}
              >
                <Upload className={`w-10 h-10 transition-colors ${isDragging ? 'text-cyan-400' : 'text-white/30'}`} />
              </div>

              <h3 className="text-xl font-semibold text-white mb-2">
                {isDragging ? 'Drop files here' : 'Drag & drop files'}
              </h3>
              <p className="text-sm text-white/40 mb-6">or click anywhere to browse</p>

              <div className="flex items-center gap-2">
                {['PDF', 'TXT', 'MD', 'DOC', 'DOCX'].map((format) => (
                  <span key={format} className="px-3 py-1.5 text-xs font-mono bg-white/5 border border-white/10 rounded-lg text-white/40">
                    {format}
                  </span>
                ))}
              </div>
              <p className="text-xs text-white/20 mt-4">Maximum file size: 10MB</p>
            </motion.div>
          </div>

          {/* Uploading Files */}
          <AnimatePresence>
            {uploadingFiles.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6 space-y-3"
              >
                {uploadingFiles.map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/10"
                  >
                    <div className="flex-shrink-0">
                      {item.status === 'done' ? (
                        <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5 text-green-400" />
                        </div>
                      ) : item.status === 'error' ? (
                        <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                          <XCircle className="w-5 h-5 text-red-400" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{item.file.name}</p>
                      <p className="text-xs text-white/40">
                        {item.status === 'uploading' && 'Uploading...'}
                        {item.status === 'processing' && 'Processing document...'}
                        {item.status === 'done' && 'Complete!'}
                        {item.status === 'error' && <span className="text-red-400">{item.error}</span>}
                      </p>
                      {(item.status === 'uploading' || item.status === 'processing') && (
                        <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${item.progress}%` }}
                            className="h-full bg-cyan-500 rounded-full"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex-shrink-0 text-xs font-mono text-white/30">
                      {(item.file.size / 1024).toFixed(0)} KB
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Existing Files Card */}
      <div className="rounded-2xl overflow-hidden bg-white/[0.02] border border-white/10">
        <div className="px-6 py-4 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {fileItems.length > 0 && (
                <button
                  onClick={toggleSelectAll}
                  className={`w-5 h-5 rounded border flex items-center justify-center transition-all duration-200
                    ${selectedIds.size === fileItems.length
                      ? 'bg-cyan-500 border-cyan-500'
                      : selectedIds.size > 0
                        ? 'bg-cyan-500/50 border-cyan-500'
                        : 'border-white/20 hover:border-white/40'
                    }`}
                >
                  {selectedIds.size === fileItems.length ? (
                    <Check className="w-3 h-3 text-white" />
                  ) : selectedIds.size > 0 ? (
                    <Minus className="w-3 h-3 text-white" />
                  ) : null}
                </button>
              )}
              <h3 className="text-sm font-semibold text-white">Existing Files</h3>
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
              <span className="text-xs font-mono text-white/30">{fileItems.length} items</span>
            </div>
          </div>
        </div>

        <div className="divide-y divide-white/5">
          {fileItems.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-8 h-8 text-white/10 mx-auto mb-2" />
              <p className="text-sm text-white/30">No files uploaded yet</p>
              <p className="text-xs text-white/20 mt-1">Drag & drop files above to get started</p>
            </div>
          ) : (
            fileItems.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`group flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors cursor-pointer
                  ${selectedIds.has(item.id) ? 'bg-cyan-500/10' : ''}`}
                onClick={() => toggleSelect(item.id)}
              >
                <div
                  className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-all duration-200
                    ${selectedIds.has(item.id) ? 'bg-cyan-500 border-cyan-500' : 'border-white/20 group-hover:border-white/40'}`}
                >
                  {selectedIds.has(item.id) && <Check className="w-3 h-3 text-white" />}
                </div>

                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-cyan-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{item.name}</p>
                  <p className="text-xs text-white/30 mt-0.5">{new Date(item.createdAt).toLocaleDateString()}</p>
                </div>

                <span className="px-2 py-1 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
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
