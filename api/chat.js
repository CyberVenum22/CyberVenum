export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: req.body.messages
      })
    });

    const data = await response.json();
    
    if (response.status === 401) {
      return res.status(401).json({ content: [{ text: "Erro 401: A chave GROQ_API_KEY na Vercel está inválida ou expirada." }] });
    }

    const text = data?.choices?.[0]?.message?.content || 'Sem resposta.';
    return res.status(200).json({ content: [{ text }] });
  } catch (error) {
    return res.status(500).json({ error: 'Erro interno' });
  }
}
