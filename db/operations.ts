// db/operations.ts - Database operations for DDT Chatbot
import { db } from './index';
import { chats, messages } from './schema';
import { eq, desc, sql, asc, count } from 'drizzle-orm';
import crypto from 'crypto';

function generateId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 20);
}

// ============================================
// CHAT OPERATIONS
// ============================================
export const ChatOperations = {
  async findOrCreate(visitorId: string) {
    // Look for existing active chat for this visitor
    const existing = await db
      .select()
      .from(chats)
      .where(eq(chats.visitorId, visitorId))
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    // Create new chat
    const id = generateId();
    const [chat] = await db.insert(chats).values({
      id,
      visitorId,
      status: 'active',
    }).returning();

    return chat;
  },

  async getById(id: string) {
    const [chat] = await db.select().from(chats).where(eq(chats.id, id)).limit(1);
    return chat || null;
  },

  async getAllWithLastMessage() {
    const result = await db.execute(sql`
      SELECT
        c.id,
        c.visitor_id,
        c.visitor_name,
        c.visitor_email,
        c.status,
        c.created_at,
        c.updated_at,
        (SELECT count(*) FROM messages m WHERE m.chat_id = c.id) as message_count,
        (SELECT m.content FROM messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
        (SELECT m.created_at FROM messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_at
      FROM chats c
      ORDER BY last_message_at DESC NULLS LAST
    `);
    return result.rows;
  },

  async delete(id: string) {
    await db.delete(chats).where(eq(chats.id, id));
  },
};

// ============================================
// MESSAGE OPERATIONS
// ============================================
export const MessageOperations = {
  async add(chatId: string, role: string, content: string, topics: string[] = [], metadata: Record<string, unknown> = {}) {
    const id = generateId();
    const [msg] = await db.insert(messages).values({
      id,
      chatId,
      role,
      content,
      topics,
      metadata,
    }).returning();
    return msg;
  },

  async getByChatId(chatId: string) {
    return db
      .select()
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(asc(messages.createdAt));
  },

  async getAll() {
    const result = await db.execute(sql`
      SELECT
        m.id,
        m.chat_id,
        m.role,
        m.content,
        m.topics,
        m.metadata,
        m.created_at,
        c.visitor_id as session_id
      FROM messages m
      JOIN chats c ON c.id = m.chat_id
      ORDER BY m.created_at ASC
    `);
    return result.rows;
  },

  async getAnalyticsSummary() {
    const totalResult = await db.select({ count: count() }).from(messages);
    const userResult = await db.select({ count: count() }).from(messages).where(eq(messages.role, 'user'));
    const botResult = await db.select({ count: count() }).from(messages).where(eq(messages.role, 'assistant'));
    const sessionResult = await db.select({ count: sql<number>`count(distinct ${chats.visitorId})` }).from(chats);

    return {
      totalMessages: totalResult[0]?.count || 0,
      userMessages: userResult[0]?.count || 0,
      botMessages: botResult[0]?.count || 0,
      uniqueSessions: sessionResult[0]?.count || 0,
    };
  },
};
