export default async function handler(req, res) {
  // Permitir apenas POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Método não permitido'
    });
  }

  try {
    // Dados enviados pelo frontend
    const { message, mode } = req.body;

    // Verifica mensagem
    if (!message) {
      return res.status(400).json({
        error: 'Mensagem não enviada'
      });
    }

    // API KEY
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: 'OPENROUTER_API_KEY não configurada'
      });
    }

    // Prompt base
    let systemPrompt = `
Você é CyberVenum AI.
Especialista em:
- Cybersecurity
- Blue Team
- Red Team
- SOC
- Threat Intelligence
- Networking
- Linux
- Ethical Hacking

Sempre responda em português brasileiro.
`;

    // Modos extras
    if (mode === 'payload') {
      systemPrompt += `
Modo Payload:
Forneça apenas exemplos educacionais e laboratoriais.
`;
    }

    if (mode === 'redteam') {
      systemPrompt += `
Modo Red Team:
Foque em ambientes autorizados, laboratórios e CTF.
`;
    }

    // Request OpenRouter
    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
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
          max_tokens: 1500
        })
      }
    );

    // Texto bruto
    const text = await response.text();

    // Converter JSON
    let data;

    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error('Erro parse JSON:', text);

      return res.status(500).json({
        error: 'Resposta inválida da IA',
        raw: text
      });
    }

    // Erro OpenRouter
    if (!response.ok) {
      console.error('Erro OpenRouter:', data);

      return res.status(response.status).json({
        error: data
      });
    }

    // Resposta IA
    const reply =
      data?.choices?.[0]?.message?.content ||
      'Sem resposta da IA';

    // Retorno final
    return res.status(200).json({
      reply
    });

  } catch (error) {
    console.error('Erro interno:', error);

    return res.status(500).json({
      error: error.message
    });
  }
}
