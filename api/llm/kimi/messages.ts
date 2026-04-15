const KIMI_API_URL = 'https://api.kimi.com/coding/v1/messages';
const KIMI_MODEL = 'kimi-k2-thinking';
const KIMI_MAX_TOKENS = 1024;

type KimiMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'KIMI_API_KEY is not configured on the server' });
    return;
  }

  const rawMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const messages: KimiMessage[] = rawMessages
    .filter((message: any) => message && typeof message.content === 'string' && typeof message.role === 'string')
    .map((message: any) => ({
      role: message.role === 'assistant' || message.role === 'system' ? message.role : 'user',
      content: message.content,
    }));

  if (messages.length === 0) {
    res.status(400).json({ error: 'messages is required' });
    return;
  }

  try {
    const upstream = await fetch(KIMI_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: KIMI_MODEL,
        max_tokens: KIMI_MAX_TOKENS,
        messages,
      }),
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.send(text);
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to call Kimi API',
      message: error?.message || 'Unknown error',
    });
  }
}
