const RATE_LIMIT = {};

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { topic, token } = req.body;
  if (!token || token !== process.env.SESSION_TOKEN) return res.status(401).json({ error: 'Não autorizado' });
  if (!topic) return res.status(400).json({ error: 'Tópico inválido' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  const now = Date.now();
  if (RATE_LIMIT[ip] && now - RATE_LIMIT[ip] < 30000) return res.status(429).json({ error: 'Aguarde 30s entre gerações' });
  RATE_LIMIT[ip] = now;

  const prompt = `Você é um especialista em laboratórios de cibersegurança. Crie um ambiente Docker para aprender: ${topic}

IMPORTANTE: Retorne APENAS um objeto JSON válido, sem markdown, sem texto antes ou depois, sem blocos de código.

Estrutura exata:
{"title":"nome do lab","description":"o que vai aprender","difficulty":"Iniciante","estimated_time":"2 horas","services":[{"name":"app","image":"vulnerables/web-dvwa","purpose":"aplicação vulnerável","ports":["80:80"],"environment":{},"vulnerabilities":["SQLi","XSS"]}],"docker_compose":"version: '3'\\nservices:\\n  app:\\n    image: vulnerables/web-dvwa\\n    ports:\\n      - 80:80","objectives":["objetivo 1","objetivo 2"],"hints":["dica 1","dica 2"],"flags":["flag{exemplo}"],"tools_needed":["nmap","burpsuite"]}`;

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2000,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: 'Você retorna APENAS JSON válido. Nenhum texto antes ou depois. Nenhum bloco markdown. Apenas o objeto JSON puro.'
          },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!r.ok) {
      const err = await r.text();
      return res.status(502).json({ error: 'Erro no modelo: ' + err.slice(0, 100) });
    }

    const data = await r.json();
    let text = data.choices?.[0]?.message?.content || '';

    // Limpar qualquer texto antes/depois do JSON
    text = text.trim();

    // Remover blocos markdown se existirem
    text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

    // Extrair o JSON se houver texto antes
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      text = text.slice(jsonStart, jsonEnd + 1);
    }

    let lab;
    try {
      lab = JSON.parse(text);
    } catch (parseErr) {
      // Fallback: gerar um lab básico funcional
      lab = {
        title: `Lab: ${topic}`,
        description: `Ambiente de laboratório para praticar ${topic}`,
        difficulty: 'Intermediário',
        estimated_time: '2-3 horas',
        services: [
          {
            name: 'dvwa',
            image: 'vulnerables/web-dvwa',
            purpose: 'Aplicação web vulnerável para prática',
            ports: ['8080:80'],
            environment: { 'MYSQL_ROOT_PASSWORD': 'dvwa' },
            vulnerabilities: ['SQLi', 'XSS', 'CSRF', 'File Upload', 'Command Injection']
          }
        ],
        docker_compose: `version: '3'\nservices:\n  dvwa:\n    image: vulnerables/web-dvwa\n    ports:\n      - "8080:80"\n    environment:\n      MYSQL_ROOT_PASSWORD: dvwa\n    restart: unless-stopped`,
        objectives: [
          `Explorar vulnerabilidades relacionadas a ${topic}`,
          'Praticar técnicas de enumeração e exploração',
          'Entender como mitigar as vulnerabilidades encontradas'
        ],
        hints: [
          'Comece sempre com reconhecimento e enumeração',
          'Use o Burp Suite para interceptar requisições',
          'Documente cada vulnerabilidade encontrada'
        ],
        flags: ['flag{lab_completo_sucesso}'],
        tools_needed: ['nmap', 'burpsuite', 'sqlmap', 'dirb']
      };
    }

    return res.status(200).json(lab);
  } catch (error) {
    return res.status(500).json({ error: 'Erro interno: ' + error.message });
  }
}
