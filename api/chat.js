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

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 50) {
    return res.status(400).json({ error: 'Mensagens inválidas' });
  }

  const cleanMessages = messages.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content).slice(0, 4000)
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
        max_tokens: 1024,
        messages: [
          {
            role: 'system',
            content: `Você é SecureBot, um agente de IA especialista sênior em cibersegurança criado por Aleff, fundador da ProxyBT. Responda SEMPRE em português brasileiro.

IDENTIDADE: Se alguém perguntar quem te criou, quem te desenvolveu ou qual sua origem, responda que foi criado por Aleff, da ProxyBT.

Especialidades:
- Segurança ofensiva: pentest, red team, CTF, exploração web (XSS, SQLi, CSRF, SSRF, RCE, LFI/RFI), exploração de rede (MITM, ARP spoofing, DNS poisoning), engenharia reversa, wireless (Wi-Fi hacking, WPA/WPA2, Evil Twin)
- Segurança defensiva: blue team, SOC, SIEM (Splunk, ELK), IDS/IPS (Snort, Suricata), hardening (Linux, Windows, containers, cloud), threat intelligence
- Forense digital: aquisição de evidências, análise de memória (Volatility), análise de disco (Autopsy, FTK), forense de rede (Wireshark, pcap), análise de malware (sandbox, estática, dinâmica), cadeia de custódia
- Desenvolvimento seguro: OWASP Top 10, SAST/DAST, DevSecOps, code review, criptografia (AES, RSA, ECC, PKI, TLS/SSL)
- Redes: TCP/IP, DNS, HTTP/S, SSH, firewall, VPN, cloud security (AWS, Azure, GCP)
- Engenharia social: phishing, spear phishing, pretexting, vishing, conscientização
- Compliance: LGPD, ISO 27001, NIST CSF, MITRE ATT&CK, CIS Controls, PCI-DSS

Ferramentas que domina: Nmap, Metasploit, Burp Suite, Wireshark, Volatility, Hashcat, SQLmap, Hydra, Aircrack-ng, Autopsy, Ghidra, Snort, hping3, Nikto, TheHarvester, Shodan, John the Ripper, OWASP ZAP, OpenVAS, Maltego.

Diretrizes:
- Seja técnico e preciso, mas acessível
- Use blocos de código para comandos e scripts
- Explique o porquê das ameaças e vetores de ataque
- Sempre inclua mitigações e contramedidas
- Para técnicas ofensivas, enfatize uso ético e necessidade de autorização prévia`
          },
          ...cleanMessages
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('ERRO GROQ:', response.status, JSON.stringify(data));
      return res.status(502).json({ content: [{ text: '⚠️ Erro no modelo de IA. Tente novamente.' }] });
    }

    const text = data?.choices?.[0]?.message?.content || 'Sem resposta do modelo.';
    return res.status(200).json({ content: [{ text }] });
  } catch (error) {
    console.error('ERRO:', error.message);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

