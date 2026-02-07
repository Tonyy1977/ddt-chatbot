// pages/api/tag-topic.js
import { ChatOperations, MessageOperations } from '../../db/operations.ts';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { sessionId, sender, text, topic } = req.body;

  try {
    const chat = await ChatOperations.findOrCreate(sessionId);
    const role = sender === 'user' ? 'user' : 'assistant';
    const topics = topic ? [topic] : [];

    const msg = await MessageOperations.add(chat.id, role, text, topics);

    res.status(200).json({ success: true, data: msg });
  } catch (err) {
    console.error('Error tagging topic:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}
