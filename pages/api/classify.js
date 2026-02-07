import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { text } = req.body;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a classification assistant. Classify the message into ONE of these categories:
- Complaint
- Compliment
- Maintenance
- Inquiry
- Rent/Payment
- Other

Respond with only the category name.`
        },
        { role: 'user', content: text }
      ],
      temperature: 0.2,
    });

    const topic = response.choices[0].message.content.trim();
    console.log('Detected topic:', topic);
    res.status(200).json({ topic });
  } catch (err) {
    console.error('Topic classification error:', err.message);
    res.status(500).json({ error: 'Failed to classify topic' });
  }
}
