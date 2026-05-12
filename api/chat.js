export default async function handler(req, res) {

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Método não permitido'
    });
  }

  try {

    // Body
    const body = req.body || {};

    const message = body.message || '';

    // Verifica mensagem
    if (!message.trim()) {
      return res.status(400).json({
        error: 'Mensagem vazia'
      });
    }

    // API KEY
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: 'OPENROUTER_API_KEY não encontrada'
      });
    }

    // Prompt
    const systemPrompt = `
Você é CyberVenum AI.

Especialista em:
- Cybersecurity
- Red Team
- Blue Team
- SOC
- Linux
- Networking
- Ethical Hacking

Responda SEMPRE em português brasileiro.
`;

    // Request OpenRouter
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

          // MODELO MAIS ESTÁVEL
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

    // RAW
    const raw = await aiResponse.text();

    console.log('RAW OPENROUTER:', raw);

    // JSON
    let data;

    try {

      data = JSON.parse(raw);

    } catch (e) {

      return res.status(500).json({
        error: 'Erro convertendo JSON',
        raw
      });

    }

    // Erro OpenRouter
    if (!aiResponse.ok) {

      return res.status(aiResponse.status).json({
        error: data
      });

    }

    // DEBUG
    console.log(
      'DATA:',
      JSON.stringify(data, null, 2)
    );

    // Resposta
    let reply = '';

    // OpenAI/OpenRouter
    if (
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content
    ) {

      reply = data.choices[0].message.content;

    }

    // fallback text
    else if (
      data.choices &&
      data.choices[0] &&
      data.choices[0].text
    ) {

      reply = data.choices[0].text;

    }

    // fallback final
    if (!reply || reply.trim() === '') {

      console.log('RESPOSTA VAZIA:', data);

      reply = 'A IA respondeu vazio. Verifique logs da Vercel.';

    }

    // Final
    return res.status(200).json({
      reply
    });

  } catch (error) {

    console.error('ERRO GERAL:', error);

    return res.status(500).json({
      error: error.message
    });

  }

}
