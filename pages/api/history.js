// pages/api/history.js
import { ChatOperations, MessageOperations } from '../../db/operations.ts';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { sessionId } = req.query;

    try {
      const chat = await ChatOperations.findOrCreate(sessionId);
      const msgs = await MessageOperations.getByChatId(chat.id);

      // Map to the shape the frontend expects
      const result = msgs.map(m => ({
        _id: m.id,
        sessionId,
        sender: m.role === 'user' ? 'user' : 'bot',
        text: m.content,
        topics: m.topics || [],
        createdAt: m.createdAt,
      }));

      res.status(200).json(result);
    } catch (err) {
      console.error('Error fetching history:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  } else {
    res.status(405).json({ success: false, error: 'Method not allowed' });
  }
}
