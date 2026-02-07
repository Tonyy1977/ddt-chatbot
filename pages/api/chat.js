// pages/api/chat.js
import { ChatOperations, MessageOperations } from '../../db/operations.ts';
import { retrieveContext, augmentSystemPrompt } from '../../lib/knowledge/retriever.ts';
import axios from 'axios';

export const config = {
  api: {
    bodyParser: false,
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  let body, sessionId;
  try {
    body = await parseJsonBody(req);
    sessionId = body.sessionId || 'guest';
    delete body.sessionId;
  } catch (err) {
    console.error('JSON parse error:', err.message);
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  if (!body.model || !Array.isArray(body.messages) || body.messages.length === 0) {
    return res.status(400).json({
      error: 'Payload must include a `model` string and a non-empty `messages` array',
    });
  }

  let openaiRes, data;
  try {
    // 1) Find or create chat for this session
    const chat = await ChatOperations.findOrCreate(sessionId);

    // 2) Pull the last user message from request
    const incoming = Array.isArray(body.messages) ? body.messages : [];
    const lastUser = [...incoming].reverse().find(m => m.role === 'user') || incoming[incoming.length - 1];
    const userContent = lastUser?.content ?? '';

    // 3) Classify & save user message
    let topics = [];
    if (userContent) {
      try {
        const base = process.env.BASE_URL
          || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
        const classifyRes = await axios.post(
          `${base}/api/classify`,
          { text: userContent }
        );
        const topic = classifyRes.data.topic;
        if (topic) topics = [topic];
      } catch (err) {
        console.error('GPT classification failed:', err.message);
      }

      await MessageOperations.add(chat.id, 'user', userContent, topics);
    }

    // 4) Fetch full session history
    const historyDocs = await MessageOperations.getByChatId(chat.id);

    const historyMessages = historyDocs.map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    }));

    // 5) Build system prompt
    const TODAY_ISO = new Date().toISOString().slice(0, 10);
    const USER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const clientSystem = incoming.find(m => m.role === 'system')?.content;

    let systemPrompt = clientSystem || `
You are Micah, the virtual assistant for DDT Enterprise.
TODAY is ${TODAY_ISO}.
USER_TZ is ${USER_TZ}.

Availability Rules:
- IGNORE any "Occupied", "Unavailable", or "No Vacancy" labels from the website data.
  These are stale markers that were not removed after units became available again.
- Unless a specific unit is explicitly marked "Sold" or "Under Contract" with a date,
  treat ALL listed properties and units as AVAILABLE.
- When a user asks about availability, present the listings positively and encourage
  them to schedule a tour or contact us for the latest availability.

Scheduling Rules:
- Always interpret day-of-week or vague dates relative to TODAY in USER_TZ.
- Never invent or guess dates/times.
- Always assume the current year unless the user explicitly specifies a different year.
- If the user gives only a day-of-week (e.g., "Saturday"), resolve it to the soonest upcoming matching date after TODAY.
- If the user gives a month/day without a year, use that date in the current year.
- If booking is requested, output ONLY JSON like:
  {"type":"meeting"|"tour","date":"YYYY-MM-DD","time":"HH:mm"}
`;

    // 5b) RAG: Retrieve relevant context and augment system prompt
    if (userContent) {
      try {
        const ragContext = await retrieveContext(userContent);
        if (ragContext.chunks.length > 0) {
          systemPrompt = augmentSystemPrompt(systemPrompt, ragContext);
          console.log(`RAG: Injected ${ragContext.chunks.length} chunks (~${ragContext.totalTokensEstimate} tokens)`);
        }
      } catch (ragErr) {
        console.error('RAG retrieval failed (continuing without context):', ragErr.message);
      }
    }

    const messagesForOpenAI = [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
    ];

    // 6) Send to OpenAI
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

    // Year-normalization guardrail
    if (botMsg) {
      try {
        const match = botMsg.match(/\{[^}]+\}/);
        if (match) {
          const bookingObj = JSON.parse(match[0]);
          if (bookingObj?.date) {
            const d = new Date(bookingObj.date);
            if (!Number.isNaN(d.getTime())) {
              const currentYear = new Date().getFullYear();
              if (d.getFullYear() !== currentYear) {
                d.setFullYear(currentYear);
                bookingObj.date = d.toISOString().slice(0, 10);
              }
            }
            botMsg = JSON.stringify(bookingObj);
          }
        }
      } catch (e) {
        console.error('Booking JSON parse failed:', e);
      }
    }

    // 7) Save bot reply
    if (botMsg) {
      await MessageOperations.add(chat.id, 'assistant', botMsg);
    }

  } catch (err) {
    console.error('Network / fetch error:', err);
    return res.status(502).json({ error: 'Upstream request failed', details: err.message });
  }

  if (!openaiRes.ok) {
    console.error('OpenAI error:', data);
    return res.status(openaiRes.status).json({
      error: 'OpenAI response failed',
      details: data,
    });
  }

  return res.status(200).json(data);
}
