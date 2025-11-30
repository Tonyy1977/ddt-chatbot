import dbConnect from '../../lib/dbConnect.js';
import Message from '../../models/Message.js';

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== 'POST') return res.status(405).end();

  const { sessionId, sender, text, topic } = req.body;

  try {
    const msg = await Message.create({
      sessionId,
      sender,
      text,
      topic,
      timestamp: new Date()
    });

    res.status(200).json({ success: true, data: msg });
  } catch (err) {
    console.error('❌ Error tagging topic:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}
