// pages/api/chat.js
import dbConnect from '../../lib/dbConnect.js';
import Message from '../../models/Message.js';
import axios from 'axios';

export const config = {
  api: {
    bodyParser: false, // Required if manually parsing body
  },
};

async function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  let body, sessionId;
  try {
    body = await parseJsonBody(req);
    sessionId = body.sessionId || 'guest';
    delete body.sessionId;
  } catch (err) {
    console.error('❌ JSON parse error:', err.message);
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  console.log('📨 Received body:', JSON.stringify(body));

  if (!body.model || !Array.isArray(body.messages) || body.messages.length === 0) {
    return res.status(400).json({
      error: 'Payload must include a `model` string and a non-empty `messages` array',
    });
  }

  let openaiRes, data;
try {
  // 1) Pull the last user message from request (supports [system,user] or just [user])
  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const lastUser = [...incoming].reverse().find(m => m.role === 'user') || incoming[incoming.length - 1];
  const userContent = lastUser?.content ?? '';

  // 2) Classify & SAVE the latest user message FIRST (so it’s in the DB history)
  let topics = [];
  if (userContent) {
    try {
      const classifyRes = await axios.post(
        `${process.env.BASE_URL || 'http://localhost:3000'}/api/classify`,
        { text: userContent }
      );
      const topic = classifyRes.data.topic;
      if (topic) topics = [topic];
    } catch (err) {
      console.error('⚠️ GPT classification failed:', err.message);
    }

    await Message.create({
      sessionId,
      sender: 'user',
      text: userContent,
      topics,
    });
  }

  // 3) Fetch the FULL updated session history (now includes the message we just saved)
  const historyDocs = await Message.find({ sessionId }).sort({ createdAt: 1 }).lean();

  const historyMessages = historyDocs.map(m => ({
    role: m.sender === 'user' ? 'user' : 'assistant',
    content: m.text,
  }));

  // 4) Use the client’s system prompt if provided, otherwise build one with TODAY + USER_TZ
const TODAY_ISO = new Date().toISOString().slice(0, 10);
const USER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

const clientSystem = incoming.find(m => m.role === 'system')?.content;

const systemPrompt = clientSystem || `
You are Micah, the virtual assistant for DDT Enterprise.
TODAY is ${TODAY_ISO}.
USER_TZ is ${USER_TZ}.

📅 Scheduling Rules:
- Always interpret day-of-week or vague dates relative to TODAY in USER_TZ.
- Never invent or guess dates/times.
- Always assume the current year is 2025 unless the user explicitly specifies a different year.
- If the user gives only a day-of-week (e.g., "Saturday"), resolve it to the soonest upcoming matching date after TODAY.
- If the user gives a month/day without a year (e.g., "October 2"), use that date in 2025.
- If booking is requested, output ONLY JSON like:
  {"type":"meeting"|"tour","date":"YYYY-MM-DD","time":"HH:mm"}
`;
  const messagesForOpenAI = [
    { role: 'system', content: systemPrompt },
    ...historyMessages,
  ];

  // 5) Send the assembled conversation to OpenAI
  openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: body.model,
      messages: messagesForOpenAI,
    }),
  });

    data = await openaiRes.json();

let botMsg = data.choices?.[0]?.message?.content;

// 🛡️ Year-normalization guardrail (dynamic to current year)
if (botMsg) {
  try {
    const match = botMsg.match(/\{[^}]+\}/);
    if (match) {
      const bookingObj = JSON.parse(match[0]);

      if (bookingObj?.date) {
        const d = new Date(bookingObj.date);
        if (Number.isNaN(d.getTime())) {
          console.warn("⚠️ Skipping date normalization — invalid date from model:", bookingObj.date);
        } else {
          const currentYear = new Date().getFullYear();

          // If GPT gave a past or wrong year, normalize to current year
          if (d.getFullYear() !== currentYear) {
            d.setFullYear(currentYear);
            bookingObj.date = d.toISOString().slice(0, 10);
            console.log("🔧 Normalized booking date to:", bookingObj.date);
          }
        }

        // Re-stringify the normalized object back into botMsg
        botMsg = JSON.stringify(bookingObj);
      }
    }
  } catch (e) {
    console.error("⚠️ Booking JSON parse failed:", e);
  }
} else {
  console.warn('⚠️ OpenAI response missing message content:', data);
}

// 6) Save the bot reply (after possible normalization)
if (botMsg) {
  await Message.create({ sessionId, sender: 'bot', text: botMsg });
}

} catch (err) {
  console.error('❌ Network / fetch error:', err);
  return res.status(502).json({ error: 'Upstream request failed', details: err.message });
}

  if (!openaiRes.ok) {
    console.error('❌ OpenAI error:', data);
    return res.status(openaiRes.status).json({
      error: 'OpenAI response failed',
      details: data,
    });
  }

  return res.status(200).json(data);
}
