export default async function handler(req, res) {

  // Permitir apenas POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Método não permitido'
    });
  }

  try {

    // Body recebido
    const body = req.body || {};

    const message = body.message || '';
    const mode = body.mode || 'default';

    // Verificar mensagem
    if (!message || message.trim() === '') {
      return res.status(400).json({
        error: 'Mensagem vazia'
      });
    }

    // API KEY
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: 'OPENROUTER_API_KEY não configurada'
      });
    }

    // Prompt principal
    let systemPrompt = `
Você é CyberVenum AI.

Especialista em:
- Cybersecurity
- Red Team
- Blue Team
- SOC
- Linux
- Networking
- Threat Intelligence
- Ethical Hacking

Sempre responda em português brasileiro.
`;

    // Payload mode
    if (mode === 'payload') {

      systemPrompt += `

Modo Payload:
Forneça apenas exemplos educacionais,
CTF e laboratoriais.
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

    // Request OpenRouter
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

          model: 'openai/gpt-4o-mini',

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
          max_tokens: 1200

        })

      }
    );

    // Texto bruto
    const rawText = await response.text();

    // Debug
    console.log('RAW OPENROUTER:', rawText);

    // Converter JSON
    let data;

    try {

      data = JSON.parse(rawText);

    } catch (jsonError) {

      console.error('Erro JSON:', jsonError);

      return res.status(500).json({
        error: 'Resposta inválida da IA',
        raw: rawText
      });

    }

    // Verifica erro API
    if (!response.ok) {

      console.error('Erro OpenRouter:', data);

      return res.status(response.status).json({
        error: data
      });

    }

    // Resposta final IA
    let reply = 'Sem resposta da IA';

    // Formato OpenAI/OpenRouter
    if (
      data &&
      data.choices &&
      data.choices.length > 0
    ) {

      // GPT/OpenAI format
      if (
        data.choices[0].message &&
        data.choices[0].message.content
      ) {

        reply = data.choices[0].message.content;

      }

      // fallback text
      else if (data.choices[0].text) {

        reply = data.choices[0].text;

      }

    }

    // Segurança extra
    if (!reply || reply.trim() === '') {
      reply = 'A IA não retornou conteúdo.';
    }

    // Debug final
    console.log('REPLY FINAL:', reply);

    // Retorno
    return res.status(200).json({
      reply
    });

  } catch (error) {

    console.error('ERRO INTERNO:', error);

    return res.status(500).json({
      error: error.message || 'Erro interno'
    });

  }

}
