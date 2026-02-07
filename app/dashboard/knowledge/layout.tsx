// Knowledge Base Layout - Server component
import { requireAuth } from '@/lib/supabase/server';
import { db, knowledgeSources } from '@/db';
import { KnowledgeProvider, type KnowledgeItem } from './context/KnowledgeContext';

export default async function KnowledgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();

  // Get all knowledge sources
  const sources = await db.select().from(knowledgeSources);

  // Transform sources for client
  const initialSources: KnowledgeItem[] = sources.map(s => ({
    id: s.id,
    name: s.name,
    type: s.type as KnowledgeItem['type'],
    status: s.status as KnowledgeItem['status'],
    size: ((s.metadata as any)?.fileSize || (s.metadata as any)?.contentSize || 0) as number,
    createdAt: s.createdAt.toISOString(),
    metadata: s.metadata as Record<string, unknown>,
  }));

  return (
    <KnowledgeProvider initialItems={initialSources}>
      {/* Tab Navigation */}
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Knowledge Base</h1>
          <p className="text-[#C9CDD6]/60 text-sm">Train your AI with documents, text, websites, and Q&A pairs</p>
        </div>

        <KnowledgeTabs />

        <div className="mt-6">
          {children}
        </div>
      </div>
    </KnowledgeProvider>
  );
}

function KnowledgeTabs() {
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/10 w-fit">
      <TabLink href="/dashboard/knowledge/files" label="Files" />
      <TabLink href="/dashboard/knowledge/text" label="Text" />
      <TabLink href="/dashboard/knowledge/website" label="Website" />
      <TabLink href="/dashboard/knowledge/qa" label="Q&A" />
    </div>
  );
}

function TabLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="px-4 py-2 rounded-lg text-sm font-medium text-[#C9CDD6]/60 hover:text-white hover:bg-white/[0.05] transition-all"
    >
      {label}
    </a>
  );
}
