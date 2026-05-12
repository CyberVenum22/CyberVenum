const RATE_LIMIT = {};

export default async function handler(req, res) {

  // =========================
  // CORS
  // =========================

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // =========================
  // APENAS POST
  // =========================

  if (req.method !== 'POST') {

    return res.status(405).json({
      error: 'Método não permitido'
    });

  }

  try {

    // =========================
    // BODY
    // =========================

    const body = req.body || {};

    const messages = body.messages || [];
    const mode = body.mode || 'default';

    // =========================
    // VALIDAR MENSAGENS
    // =========================

    if (!Array.isArray(messages) || messages.length === 0) {

      return res.status(400).json({
        error: 'Mensagens inválidas'
      });

    }

    // =========================
    // API KEY
    // =========================

    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {

      return res.status(500).json({
        error: 'OPENROUTER_API_KEY não configurada'
      });

    }

    // =========================
    // SYSTEM PROMPT
    // =========================

    let systemPrompt = `
Você é Cyber Venum.

Especialista em:
- Cybersecurity
- Red Team
- Blue Team
- SOC
- Linux
- Networking
- Ethical Hacking
- Threat Intelligence

Sempre responda em português brasileiro.
`;

    // Payload mode
    if (mode === 'payload') {

      systemPrompt += `

MODO PAYLOAD:
Forneça exemplos apenas para:
- laboratórios
- CTF
- ambientes autorizados
`;

    }

    // RedTeam mode
    if (mode === 'redteam') {

      systemPrompt += `

MODO RED TEAM:
Foque em:
- simulações defensivas
- ambientes autorizados
- laboratórios
`;

    }

    // =========================
    // MESSAGES FORMAT
    // =========================

    const formattedMessages = [

      {
        role: 'system',
        content: systemPrompt
      },

      ...messages.map(m => ({
        role:
          m.role === 'assistant'
            ? 'assistant'
            : 'user',

        content:
          typeof m.content === 'string'
            ? m.content
            : JSON.stringify(m.content)
      }))

    ];

    // =========================
    // OPENROUTER
    // =========================

    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {

        method: 'POST',

        headers: {

          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',

          'HTTP-Referer': 'https://cybervenum.vercel.app',
          'X-Title': 'CyberVenum'

        },

        body: JSON.stringify({

          model: 'meta-llama/llama-3.1-8b-instruct:free',

          messages: formattedMessages,

          temperature: 0.7,
          max_tokens: 1200

        })

      }
    );

    // =========================
    // RAW
    // =========================

    const raw = await response.text();

    console.log('RAW:', raw);

    // =========================
    // JSON
    // =========================

    let data;

    try {

      data = JSON.parse(raw);

    } catch {

      return res.status(500).json({
        error: 'Erro JSON',
        raw
      });

    }

    // =========================
    // ERRO OPENROUTER
    // =========================

    if (!response.ok) {

      return res.status(response.status).json({
        error: data
      });

    }

    // =========================
    // RESPOSTA
    // =========================

    let reply = '';

    if (
      data &&
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content
    ) {

      reply = data.choices[0].message.content;

    }

    // fallback
    if (!reply) {

      reply = 'Sem resposta da IA.';

    }

    // =========================
    // FORMATO ORIGINAL FRONTEND
    // =========================

    return res.status(200).json({

      content: [
        {
          text: reply
        }
      ],

      searched: false

    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error: error.message
    });

  }

}
