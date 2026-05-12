export default async function handler(req, res) {
      });
    }

    let systemPrompt = `
Você é Cyber Venum, especialista em cibersegurança criado por Aleff.
Responda sempre em português brasileiro.
`;

    if (mode === 'payload') {
      systemPrompt += `
Modo Payload:
Forneça exemplos apenas para ambientes autorizados e laboratoriais.
Explique tecnicamente.
`;
    }

    if (mode === 'redteam') {
      systemPrompt += `
Modo Red Team:
Foque em simulações defensivas, laboratórios e CTF.
`;
    }

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
          max_tokens: 1800
        })
      }
    );

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return res.status(500).json({
        error: 'Resposta inválida da IA',
        raw: text
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: data
      });
    }

    const reply =
      data.choices?.[0]?.message?.content ||
      'Sem resposta da IA';

    return res.status(200).json({
      reply
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: err.message
    });
  }
}
