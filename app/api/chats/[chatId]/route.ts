// app/api/chats/[chatId]/route.ts
import { NextResponse } from 'next/server';
import { MessageOperations, ChatOperations } from '@/db/operations';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params;

  try {
    const msgs = await MessageOperations.getByChatId(chatId);
    return NextResponse.json({
      messages: msgs.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    console.error('Error fetching chat messages:', err);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params;

  try {
    await ChatOperations.delete(chatId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting chat:', err);
    return NextResponse.json({ error: 'Failed to delete chat' }, { status: 500 });
  }
}
