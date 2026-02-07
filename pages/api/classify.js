import { Configuration, OpenAIApi } from 'openai';

const config = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});

const openai = new OpenAIApi(config);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { text } = req.body;

  try {
    const response = await openai.createChatCompletion({
      model: 'gpt-4o', // or 'gpt-3.5-turbo'
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
        {
          role: 'user',
          content: text
        }
      ],
      temperature: 0.2,
    });

    const topic = response.data.choices[0].message.content.trim();
    console.log("🧠 Detected topic:", topic);
    res.status(200).json({ topic });
  } catch (err) {
    console.error('❌ Topic classification error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to classify topic' });
  }
}
