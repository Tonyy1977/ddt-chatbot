// pages/api/admin/messages.js
import { MessageOperations } from '../../../db/operations.ts';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const rows = await MessageOperations.getAll();

      const result = rows.map(m => ({
        _id: m.id,
        sessionId: m.session_id,
        sender: m.role === 'user' ? 'user' : 'bot',
        text: m.content,
        topics: m.topics || [],
        createdAt: m.created_at,
      }));

      res.status(200).json(result);
    } catch (err) {
      console.error('Error fetching messages:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  } else {
    res.status(405).json({ success: false, error: 'Method not allowed' });
  }
}
