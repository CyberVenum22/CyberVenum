// api/chat.js

export default async function handler(req, res) {

  // =========================
  // CORS
  // =========================

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONS
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

    const message = body.message || '';
    const mode = body.mode || 'default';

    // =========================
    // VALIDAÇÃO
    // =========================

    if (!message || message.trim() === '') {

      return res.status(400).json({
        error: 'Mensagem vazia'
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
    // PROMPT
    // =========================

    let systemPrompt = `
Você é CyberVenum AI.

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

Modo Payload:
Forneça apenas exemplos educacionais,
laboratoriais e CTF.
`;

    }

    // RedTeam mode
    if (mode === 'redteam') {

      systemPrompt += `

Modo Red Team:
Foque em ambientes autorizados,
simulações defensivas e laboratórios.
`;

    }

    // =========================
    // OPENROUTER REQUEST
    // =========================

    const aiResponse = await fetch(
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

          // MODELO FREE
          model: 'meta-llama/llama-3.1-8b-instruct:free',

          messages: [

            {
              role: 'system',
              content: systemPrompt
            },

            {
              role: 'user',
              content: message
            }

          ],

          temperature: 0.7,
          max_tokens: 1000

        })

      }
    );

    // =========================
    // RAW RESPONSE
    // =========================

    const raw = await aiResponse.text();

    console.log('RAW OPENROUTER:', raw);

    // =========================
    // JSON
    // =========================

    let data;

    try {

      data = JSON.parse(raw);

    } catch (jsonError) {

      console.error('ERRO JSON:', jsonError);

      return res.status(500).json({

        error: 'Erro convertendo JSON',
        raw

      });

    }

    // =========================
    // ERRO OPENROUTER
    // =========================

    if (!aiResponse.ok) {

      console.error('ERRO OPENROUTER:', data);

      return res.status(aiResponse.status).json({
        error: data
      });

    }

    // =========================
    // RESPOSTA IA
    // =========================

    let reply = '';

    // Formato OpenAI/OpenRouter
    if (

      data &&
      data.choices &&
      data.choices.length > 0 &&
      data.choices[0].message &&
      data.choices[0].message.content

    ) {

      reply = data.choices[0].message.content;

    }

    // fallback text
    else if (

      data &&
      data.choices &&
      data.choices.length > 0 &&
      data.choices[0].text

    ) {

      reply = data.choices[0].text;

    }

    // fallback final
    if (!reply || reply.trim() === '') {

      console.log('RESPOSTA VAZIA:', data);

      reply = 'A IA retornou vazio.';

    }

    // =========================
    // RETORNO FINAL
    // =========================

    // FORMATO ORIGINAL DO SEU FRONTEND
    return res.status(200).json({

      content: [
        {
          text: reply
        }
      ]

    });

  } catch (error) {

    console.error('ERRO GERAL:', error);

    return res.status(500).json({

      error: error.message || 'Erro interno'

    });

  }

}
