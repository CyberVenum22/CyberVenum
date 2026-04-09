export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.SESSION_TOKEN}`) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const { messages } = req.body;
  
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'Você é o SecureBot, criado por Aleff da ProxyBT...' },
          ...messages
        ]
      })
    });

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || 'Sem resposta.';
    return res.status(200).json({ content: [{ text }] });
  } catch (error) {
    return res.status(500).json({ error: 'Erro no servidor' });
  }
}
