import { requireAuth } from '@/lib/supabase/server';
import { ChatOperations } from '@/db/operations';
import { ChatHistoryClient } from './ChatHistoryClient';

export default async function HistoryPage() {
  await requireAuth();

  const chats = await ChatOperations.getAllWithLastMessage();

  const threads = (chats as Record<string, unknown>[]).map((c) => ({
    id: c.id as string,
    visitorId: c.visitor_id as string || 'Unknown',
    lastMessage: c.last_message as string || 'No messages yet',
    messageCount: Number(c.message_count) || 0,
    updatedAt: c.last_message_at as string || c.created_at as string,
  }));

  return <ChatHistoryClient initialThreads={threads} />;
}
