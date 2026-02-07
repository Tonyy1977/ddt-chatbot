'use client';

// Knowledge Context - State Management for Knowledge Items
// Simplified from ai-saas: no tenant/agent scoping

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export interface KnowledgeItem {
  id: string;
  name: string;
  type: 'pdf' | 'txt' | 'md' | 'docx' | 'url' | 'text' | 'website' | 'qa' | 'file';
  status: 'pending' | 'processing' | 'ready' | 'error';
  size: number;
  createdAt: string;
  metadata?: Record<string, unknown>;
  content?: string;
}

interface KnowledgeContextType {
  items: KnowledgeItem[];
  addItem: (item: Omit<KnowledgeItem, 'id' | 'createdAt'>) => KnowledgeItem;
  removeItem: (id: string) => void;
  getItemsByType: (type: KnowledgeItem['type']) => KnowledgeItem[];
  isLoading: boolean;
  refreshItems: () => Promise<void>;
}

const KnowledgeContext = createContext<KnowledgeContextType | null>(null);

export function useKnowledge() {
  const context = useContext(KnowledgeContext);
  if (!context) {
    throw new Error('useKnowledge must be used within a KnowledgeProvider');
  }
  return context;
}

interface KnowledgeProviderProps {
  children: React.ReactNode;
  initialItems?: KnowledgeItem[];
}

export function KnowledgeProvider({
  children,
  initialItems = [],
}: KnowledgeProviderProps) {
  const [items, setItems] = useState<KnowledgeItem[]>(initialItems);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (initialItems.length > 0) {
      setItems(initialItems);
    }
  }, [initialItems]);

  const addItem = useCallback((itemData: Omit<KnowledgeItem, 'id' | 'createdAt'>): KnowledgeItem => {
    const newItem: KnowledgeItem = {
      ...itemData,
      id: `local_${crypto.randomUUID().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
    };
    setItems(prev => [newItem, ...prev]);
    return newItem;
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const getItemsByType = useCallback((type: KnowledgeItem['type']): KnowledgeItem[] => {
    return items.filter(item => item.type === type);
  }, [items]);

  const refreshItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/knowledge');
      if (response.ok) {
        const data = await response.json();
        const serverItems: KnowledgeItem[] = (data.knowledgeSources || []).map((source: {
          id: string;
          name: string;
          type: string;
          status: string;
          createdAt: string;
          metadata?: Record<string, unknown>;
        }) => {
          const metadata = source.metadata || {};
          const rawSize = metadata.size ?? metadata.fileSize ?? metadata.contentSize ?? 0;
          const size = typeof rawSize === 'number' ? rawSize : (parseInt(String(rawSize), 10) || 0);

          return {
            id: source.id,
            name: source.name,
            type: source.type as KnowledgeItem['type'],
            status: source.status as KnowledgeItem['status'],
            size,
            createdAt: source.createdAt,
            metadata: source.metadata,
          };
        });
        setItems(serverItems);
      }
    } catch (error) {
      console.error('Failed to refresh knowledge items:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <KnowledgeContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        getItemsByType,
        isLoading,
        refreshItems,
      }}
    >
      {children}
    </KnowledgeContext.Provider>
  );
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function calculateStringSize(str: string): number {
  return new Blob([str]).size;
}
