// chatbot-app/api/admin/messages.js
import dbConnect from '../../lib/dbConnect.js';
import Message from '../../models/Message.js';

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === 'GET') {
    try {
      const messages = await Message.find({}).sort({ createdAt: 1 });
      res.status(200).json(messages);
    } catch (err) {
      console.error('❌ Error fetching messages:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  } else {
    res.status(405).json({ success: false, error: 'Method not allowed' });
  }
}
