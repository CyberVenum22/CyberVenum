const RATE_LIMIT = {};
export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { topic, token } = req.body;
  if (!token || token !== process.env.SESSION_TOKEN) return res.status(401).json({ error: 'Não autorizado' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  const now = Date.now();
  if (RATE_LIMIT[ip] && now - RATE_LIMIT[ip] < 30000) return res.status(429).json({ error: 'Aguarde 30s' });
  RATE_LIMIT[ip] = now;

  const prompt = `Gere um ambiente de laboratório Docker completo para aprender: ${topic}

Retorne APENAS um JSON válido com esta estrutura exata:
{
  "title": "nome do lab",
  "description": "descrição do que o usuário vai aprender",
  "difficulty": "Iniciante|Intermediário|Avançado",
  "estimated_time": "tempo estimado",
  "services": [
    {
      "name": "nome_servico",
      "image": "imagem_docker_real",
      "purpose": "para que serve",
      "ports": ["8080:80"],
      "environment": {"VAR": "valor"},
      "vulnerabilities": ["lista de vulnerabilidades para explorar"]
    }
  ],
  "docker_compose": "conteúdo completo do docker-compose.yml",
  "objectives": ["objetivo 1", "objetivo 2"],
  "hints": ["dica 1", "dica 2"],
  "flags": ["flag{exemplo_flag}"],
  "tools_needed": ["ferramenta1", "ferramenta2"]
}`;

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2000,
        messages: [
          { role: 'system', content: 'Você é um especialista em criação de laboratórios de cibersegurança. Retorne APENAS JSON válido, sem markdown, sem explicações.' },
          { role: 'user', content: prompt }
        ]
      })
    });
    const data = await r.json();
    const text = data.choices?.[0]?.message?.content || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const lab = JSON.parse(clean);
    return res.status(200).json(lab);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao gerar laboratório: ' + err.message });
  }
}
