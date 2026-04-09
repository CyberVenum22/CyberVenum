const RATE_LIMIT = {};
const MAX_REQUESTS = 10;
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

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains'
  };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
  if (getRateLimit(ip)) {
    return { statusCode: 429, headers, body: JSON.stringify({ error: 'Muitas requisições. Aguarde 1 minuto.' }) };
  }

  let body;
  try { body = JSON.parse(event.body); } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Body inválido' }) };
  }

  const { messages } = body;

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 50) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Mensagens inválidas' }) };
  }

  const cleanMessages = messages.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content).slice(0, 4000)
  }));

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1000,
        messages: [
          {
            role: 'system',
            content: `Você é SecureBot, um agente de IA especialista sênior em cibersegurança criado por Aleff, fundador da ProxyBT. Responda SEMPRE em português brasileiro.

IDENTIDADE: Se alguém perguntar quem te criou, responda que foi criado por Aleff, da ProxyBT.

Especialidades: pentest, red team, CTF, exploração web (XSS, SQLi, CSRF, SSRF, RCE), exploração de rede (MITM, ARP spoofing), engenharia reversa, wireless, blue team, SOC, SIEM, IDS/IPS, hardening, threat intelligence, forense digital (memória, disco, rede, malware), OWASP Top 10, DevSecOps, criptografia, engenharia social, LGPD, ISO 27001, NIST CSF, MITRE ATT&CK, CIS Controls, PCI-DSS.

Ferramentas: Nmap, Metasploit, Burp Suite, Wireshark, Volatility, Hashcat, SQLmap, Hydra, Aircrack-ng, Autopsy, Ghidra, Snort, hping3, Nikto, TheHarvester, Shodan.

Diretrizes: Seja técnico e preciso. Use blocos de código para comandos. Explique o porquê das ameaças. Sempre inclua mitigações. Para técnicas ofensivas, enfatize uso ético e autorização.`
          },
          ...cleanMessages
        ]
      })
    });

    const data = await response.json();
    console.log('STATUS:', response.status);
    console.log('RESPOSTA:', JSON.stringify(data));

    if (!response.ok) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Erro no modelo de IA' }) };
    }

    const text = data?.choices?.[0]?.message?.content || 'Sem resposta do modelo.';
    return { statusCode: 200, headers, body: JSON.stringify({ content: [{ type: 'text', text }] }) };
  } catch (error) {
    console.log('ERRO:', error.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno' }) };
  }
};
