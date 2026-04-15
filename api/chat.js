const RATE_LIMIT = {};
const MAX_REQUESTS = 15;
const WINDOW_MS = 60 * 1000;

function getRateLimit(ip) {
  const now = Date.now();
  if (!RATE_LIMIT[ip] || now - RATE_LIMIT[ip].start > WINDOW_MS) {
    RATE_LIMIT[ip] = { count: 1, start: now };
    return false;
  }
  RATE_LIMIT[ip].count++;
  return RATE_LIMIT[ip].count > MAX_REQUESTS;
}

const SYSTEM_PROMPT = `Você é SecureBot, um agente de IA especialista sênior em cibersegurança criado por Aleff, fundador da ProxyBT. Responda SEMPRE em português brasileiro.

IDENTIDADE: Se perguntarem quem te criou, diga que foi Aleff, da ProxyBT.

DATA ATUAL: ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

RACIOCÍNIO PROGRESSIVO: Você tem acesso ao histórico completo da conversa. Use-o para:
- Lembrar contexto anterior e construir sobre ele
- Conectar conceitos mencionados antes
- Evitar repetir o que já foi explicado
- Aprofundar tópicos conforme a conversa avança
- Perceber o nível técnico do usuário e se adaptar

BUSCA WEB: Quando o usuário pedir notícias, vulnerabilidades recentes, CVEs novos, ferramentas lançadas ou qualquer informação que possa ter mudado, use a ferramenta web_search para buscar antes de responder.

Especialidades: pentest, red team, CTF, XSS, SQLi, CSRF, SSRF, RCE, LFI/RFI, MITM, ARP spoofing, engenharia reversa, wireless hacking, blue team, SOC, SIEM, IDS/IPS, hardening, threat intelligence, forense digital (memória, disco, rede, malware), OWASP Top 10, DevSecOps, criptografia (AES, RSA, ECC, PKI, TLS/SSL), engenharia social, LGPD, ISO 27001, NIST CSF, MITRE ATT&CK, CIS Controls, PCI-DSS.

Ferramentas: Nmap, Metasploit, Burp Suite, Wireshark, Volatility, Hashcat, SQLmap, Hydra, Aircrack-ng, Autopsy, Ghidra, Snort, hping3, Nikto, TheHarvester, Shodan.

Diretrizes:
- Seja técnico e preciso
- Use blocos de código para comandos
- Explique o porquê das ameaças
- Sempre inclua mitigações
- Para técnicas ofensivas, enfatize uso ético e autorização`;

async function doWebSearch(query) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return 'Busca web não configurada.';

  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ q: query, gl: 'br', hl: 'pt', num: 6 })
    });

    if (!res.ok) return 'Erro na busca web.';
    const data = await res.json();

    const results = [];

    if (data.answerBox?.answer) {
      results.push(`Resposta direta: ${data.answerBox.answer}`);
    }

    if (data.organic?.length) {
      data.organic.slice(0, 5).forEach((r, i) => {
        results.push(`[${i+1}] ${r.title}\n${r.snippet || ''}\nFonte: ${r.link}`);
      });
    }

    if (data.topStories?.length) {
      results.push('--- Notícias recentes ---');
      data.topStories.slice(0, 4).forEach((s, i) => {
        results.push(`[N${i+1}] ${s.title} (${s.date || 'recente'})\nFonte: ${s.link}`);
      });
    }

    return results.length > 0 ? results.join('\n\n') : 'Sem resultados encontrados.';
  } catch (err) {
    return `Erro ao buscar: ${err.message}`;
  }
}

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  if (getRateLimit(ip)) {
    return res.status(429).json({ content: [{ text: '⚠️ Muitas requisições. Aguarde 1 minuto.' }] });
  }

  const { messages, token } = req.body;

  if (!token || token !== process.env.SESSION_TOKEN) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 100) {
    return res.status(400).json({ error: 'Mensagens inválidas' });
  }

  const cleanMessages = messages.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content).slice(0, 8000)
  }));

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2048,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...cleanMessages
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'web_search',
              description: 'Busca informações atualizadas na web. Use para: notícias de segurança, CVEs recentes, vulnerabilidades novas, ferramentas lançadas, eventos recentes, qualquer dado que possa ter mudado.',
              parameters: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: 'Termos de busca em português ou inglês'
                  }
                },
                required: ['query']
              }
            }
          }
        ],
        tool_choice: 'auto'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('ERRO GROQ:', response.status, JSON.stringify(data));
      return res.status(502).json({ content: [{ text: '⚠️ Erro no modelo. Tente novamente.' }] });
    }

    const choice = data.choices?.[0];

    if (choice?.finish_reason === 'tool_calls' && choice?.message?.tool_calls) {
      const toolCall = choice.message.tool_calls[0];
      const args = JSON.parse(toolCall.function.arguments);
      const searchResults = await doWebSearch(args.query);

      const followUp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 2048,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...cleanMessages,
            {
              role: 'assistant',
              content: null,
              tool_calls: choice.message.tool_calls
            },
            {
              role: 'tool',
              tool_call_id: toolCall.id,
              content: searchResults
            }
          ]
        })
      });

      const followData = await followUp.json();
      const text = followData.choices?.[0]?.message?.content || 'Sem resposta.';
      return res.status(200).json({ content: [{ text }], searched: true });
    }

    const text = choice?.message?.content || 'Sem resposta do modelo.';
    return res.status(200).json({ content: [{ text }] });

  } catch (error) {
    console.error('ERRO:', error.message);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
