// pages/api/analytics/summary.js
import dbConnect from '../../../lib/dbConnect.js';
import Message from '../../../models/Message.js';

export default async function handler(req, res) {
  await dbConnect();

  try {
    const messages = await Message.find({});
    const totalMessages = messages.length;
    const userMessages = messages.filter(msg => msg.sender === 'user').length;
    const botMessages = messages.filter(msg => msg.sender === 'bot').length;
    const uniqueSessions = new Set(messages.map(m => m.sessionId)).size;

    res.status(200).json({
      totalMessages,
      userMessages,
      botMessages,
      uniqueSessions,
    });
  } catch (err) {
    console.error('❌ Analytics error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}
