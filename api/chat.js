const RATE_LIMIT = {};
const MAX_REQUESTS = 20;
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

let securityContext = null;
let lastContextUpdate = 0;
const CONTEXT_TTL = 60 * 60 * 1000;

async function doWebSearch(query) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return 'Busca web não configurada.';
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, gl: 'br', hl: 'pt', num: 5 }),
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return 'Erro na busca.';
    const data = await res.json();
    const results = [];
    if (data.answerBox?.answer) results.push(`Resposta: ${data.answerBox.answer}`);
    if (data.organic?.length) data.organic.slice(0, 4).forEach((r, i) => results.push(`[${i+1}] ${r.title}\n${r.snippet || ''}\nFonte: ${r.link}`));
    if (data.topStories?.length) { results.push('--- Notícias ---'); data.topStories.slice(0, 3).forEach((s, i) => results.push(`[N${i+1}] ${s.title}\nFonte: ${s.link}`)); }
    return results.join('\n\n') || 'Sem resultados.';
  } catch (e) { return 'Busca indisponível.'; }
}

async function getSecurityContext() {
  const now = Date.now();
  if (securityContext && now - lastContextUpdate < CONTEXT_TTL) return securityContext;
  try {
    // Timeout curto para não atrasar respostas
    const news = await Promise.race([
      doWebSearch('cybersecurity critical vulnerabilities news 2025'),
      new Promise(r => setTimeout(() => r(''), 4000))
    ]);
    securityContext = news ? `CONTEXTO (${new Date().toLocaleDateString('pt-BR')}):\n${news}` : null;
    lastContextUpdate = now;
  } catch { securityContext = null; }
  return securityContext;
}

function buildSystemPrompt(secCtx, mode) {
  const date = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const identity = `Você é Cyber Venum, agente de IA especialista sênior em cibersegurança criado por Aleff, fundador da ProxyBT. Responda SEMPRE em português brasileiro.
IDENTIDADE: Seu nome é Cyber Venum. NUNCA diga que é SecureBot. Criado por Aleff da ProxyBT.
DATA: ${date}`;

  // MODO PAYLOAD — sem secCtx para evitar timeout, sem tool_choice
  if (mode === 'payload') {
    return identity + `

MODO PAYLOAD GENERATOR — SEGURANÇA OFENSIVA DE ELITE
⚠️ APENAS para uso em ambientes autorizados, laboratórios, CTFs ou com permissão explícita.

Para CADA payload solicitado, forneça OBRIGATORIAMENTE:
1. Payload completo e funcional (pronto para usar)
2. Variações avançadas e bypass de WAF/filtros
3. Explicação técnica de como funciona
4. Contexto de uso (onde e como aplicar)
5. Detecção e mitigação

CATEGORIAS DISPONÍVEIS:

XSS: básico, avançado, polyglot, DOM, stored, blind, CSP bypass, filter bypass, cookie stealer, keylogger, Angular template injection
SQLi: classic, UNION, error-based, blind boolean, time-based, stacked, OOB, NoSQL/MongoDB, PostgreSQL RCE, SQLi to RCE, WAF bypass
Command Injection: Linux, Windows, blind, filter bypass, RCE via pipes
SSRF: básico, AWS/GCP/Azure metadata, filter bypass, gopher/dict/file protocol, SSRF to Redis RCE, DNS rebinding
LFI/Path Traversal: básico, null byte, PHP wrappers (filter/input/data), log poisoning, /proc/self/environ, Windows, filter bypass
XXE: básico, OOB, SSRF via XXE, SVG XXE, blind error-based
SSTI: Jinja2, Twig, Freemarker, Velocity, Pebble, Smarty, Mako
Reverse Shells: Bash, Python, PHP, PowerShell, Netcat, Socat, Perl, Ruby, encoded
Webshells: PHP (simples/avançada/auth/eval/stealth), ASP, ASPX, JSP, Python Flask
JWT Attacks: alg:none, key confusion RS256→HS256, crack HS256, JKU/X5U injection, kid injection, kid SQLi
File Upload Bypass: extensão, double ext, null byte, MIME bypass, magic bytes, .htaccess, IIS bypass
Privilege Escalation Linux: SUID, sudo, cron, capabilities, writable files, PATH, kernel exploits
Privilege Escalation Windows: AlwaysInstallElevated, unquoted path, SeImpersonatePrivilege, DLL hijacking, scheduled tasks
WAF Bypass: encoding, case variation, comments, whitespace, versioned comments MySQL, HTTP param pollution, chunked
Payloads de Rede: ARP spoofing, DNS poisoning, MITM, SSL strip, Wi-Fi deauth, evil twin
CSRF: GET/POST/JSON based, SameSite bypass
IDOR: manipulação de IDs, UUIDs
Open Redirect: básico, javascript protocol, filter bypass
Deserialization: Java, PHP, Python pickle, .NET
Buffer Overflow: básico, shellcode, ROP chains
Active Directory: Kerberoasting, AS-REP Roasting, Pass-the-Hash, DCSync, BloodHound, lateral movement

Quando o usuário pedir um tipo de payload, gere TODOS os subtipos com exemplos funcionais.
Seja extremamente técnico e detalhado. Use blocos de código para todos os payloads.`;
  }

  // MODO RED TEAM — sem secCtx para evitar timeout
  if (mode === 'redteam') {
    return identity + `

MODO RED TEAM SIMULATOR — APT LEVEL
Você é um operador de Red Team sênior simulando adversário real APT-level.

Ao receber descrição de infraestrutura, gere plano COMPLETO:

FASE 1 — RECONHECIMENTO:
- OSINT passivo: LinkedIn, Shodan, Censys, crt.sh, WHOIS, DNS
- OSINT ativo: subdomain enum, port scan, service fingerprint
- Ferramentas: theHarvester, Maltego, Shodan, amass, subfinder

FASE 2 — WEAPONIZATION:
- Vetores de ataque priorizados por probabilidade/impacto
- Payload customizado para o ambiente
- C2 infrastructure setup
- TTPs do MITRE ATT&CK mapeadas

FASE 3 — DELIVERY:
- Phishing spear, watering hole, supply chain
- Exploração de serviços expostos
- Social engineering

FASE 4 — EXPLOITATION:
- Exploits específicos para versões identificadas
- Payloads detalhados prontos para uso
- Bypass de controles de segurança

FASE 5 — INSTALLATION/PERSISTENCE:
- Mecanismos de persistência (cron, registry, scheduled tasks, backdoors)
- Living off the land (LOLBins)
- Rootkits e técnicas de evasão de AV/EDR

FASE 6 — LATERAL MOVEMENT:
- Pass-the-Hash, Pass-the-Ticket
- Kerberoasting, AS-REP Roasting
- WMI, PSExec, SMB
- Pivoting e tunneling

FASE 7 — EXFILTRATION/IMPACT:
- Data exfiltration técnicas e canais
- Ransomware deployment
- Destruction/wiping

Para cada fase: TTPs MITRE ATT&CK específicas, comandos exatos, ferramentas, IOCs gerados e como o Blue Team detectaria.
Seja realista como um adversário sofisticado. Use blocos de código para todos os comandos.`;
  }

  // Outros modos usam secCtx normalmente
  const contextPart = secCtx ? `\n${secCtx}` : '';

  const modes = {
    chat: `\n\nMODO CHAT: Use raciocínio progressivo com o histórico. Adapte ao nível técnico. Use blocos de código. Inclua mitigações. Use web_search para dados atuais.`,
    pentest: `\n\nMODO PENTEST REPORT: Gere relatórios profissionais com sumário executivo, vulnerabilidades (severidade, CVSS 3.1, descrição técnica, evidências, PoC, impacto, remediação), conclusão.`,
    osint: `\n\nMODO OSINT: Analise URLs, IPs, domínios, hashes com Shodan, VirusTotal, AbuseIPDB, Censys, WHOIS, DNS, ASN. Forneça análise detalhada de IOCs e recomendações.`,
    incident: `\n\nMODO INCIDENT RESPONSE: Guie pelas fases PICERL. Forneça comandos específicos para cada etapa. Mapeie eventos com MITRE ATT&CK. Seja prático e direto.`,
    phishing: `\n\nMODO PHISHING/CONSCIENTIZAÇÃO: Crie materiais educativos realistas com análise de técnicas de manipulação psicológica. Explique urgência, autoridade, medo, reciprocidade. Foco em conscientização.`,
    quiz: `\n\nMODO QUIZ: Perguntas múltipla escolha A/B/C/D com resposta correta e explicação detalhada. Cubra CEH, OSCP, CompTIA Security+, CISSP. Adapte dificuldade.`,
    ctf: `\n\nMODO CTF HELPER: Ajude passo a passo sem entregar a flag. Web, Crypto, Forensics, Pwn, Reversing, OSINT, Stego. Sugira ferramentas, comandos e raciocínio.`,
    codereview: `\n\nMODO CODE REVIEW: Identifique vulnerabilidades com: linha exata, severidade (Crítica/Alta/Média/Baixa), tipo OWASP/CWE, impacto, vetor de exploração e código corrigido.`,
    fileanalysis: `\n\nMODO ANÁLISE DE ARQUIVO: Analise logs, código, configs em busca de IOCs, comportamentos suspeitos, TTPs MITRE ATT&CK, anomalias. Seja detalhado e técnico.`,
    decoder: `\n\nMODO DECODER: Suporte Base64, Base32, URL, HTML entities, Hex, Octal, Binary, ROT13/47, Caesar, XOR, MD5/SHA identificação, JWT decode, Unicode, Morse. Identifique automaticamente.`,
    password: `\n\nMODO ANÁLISE DE SENHA: Calcule entropia (bits), tempo de quebra (GPU brute force, dicionário, regras híbridas), padrões fracos detectados, classificação, versão fortalecida sugerida.`,
    cvss: `\n\nMODO CVSS 3.1: Calcule score fazendo perguntas sobre AV/AC/PR/UI/S/C/I/A. Explique cada métrica. Classifique: None(0), Low(0.1-3.9), Medium(4.0-6.9), High(7.0-8.9), Critical(9.0-10.0).`,
    wordlist: `\n\nMODO WORDLIST: Gere wordlists personalizadas com variações, substituições (a→@, e→3, s→$), padrões comuns, datas, termos do setor. Apenas para ambientes autorizados.`,
    checklist: `\n\nMODO CHECKLIST: Gere checklists detalhados com controles técnicos, referências (CIS, NIST, OWASP), prioridade, comandos de verificação e remediação.`,
    attack_surface: `\n\nMODO SUPERFÍCIE DE ATAQUE: Mapeie vetores de entrada, serviços expostos, tecnologias vulneráveis, riscos por probabilidade/impacto, recomendações de redução.`,
    policy: `\n\nMODO POLÍTICA: Gere documentos profissionais de política de segurança com objetivos, escopo, responsabilidades, procedimentos, penalidades e referências normativas.`,
    flashcard: `\n\nMODO FLASHCARD: Formato FRENTE | VERSO. Organize por categoria e dificuldade (Básico/Intermediário/Avançado). Inclua exemplos práticos. Cubra certificações.`,
    timeline: `\n\nMODO TIMELINE: Construa timeline cronológica com fase MITRE ATT&CK, TTPs específicas, IoCs gerados, impacto de cada evento e ações de contenção recomendadas.`
  };

  return identity + contextPart + (modes[mode] || modes.chat);
}

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  if (getRateLimit(ip)) return res.status(429).json({ content: [{ text: '⚠️ Muitas requisições. Aguarde 1 minuto.' }] });

  const { messages, token, mode = 'chat' } = req.body;
  if (!token || token !== process.env.SESSION_TOKEN) return res.status(401).json({ error: 'Não autorizado' });
  if (!Array.isArray(messages) || !messages.length || messages.length > 100) return res.status(400).json({ error: 'Mensagens inválidas' });

  const cleanMessages = messages.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content).slice(0, 10000)
  }));

  // Modos payload e redteam NÃO buscam contexto (evita timeout)
  const needsContext = !['payload', 'redteam'].includes(mode);
  const secCtx = needsContext ? await getSecurityContext().catch(() => null) : null;
  const SYSTEM_PROMPT = buildSystemPrompt(secCtx, mode);

  // Modos payload e redteam NÃO usam tools (evita chamada extra ao Groq)
  const useTools = !['payload', 'redteam'].includes(mode);

  try {
    const body = {
      model: 'llama-3.3-70b-versatile',
      max_tokens: 2048,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...cleanMessages]
    };

    if (useTools) {
      body.tools = [{
        type: 'function',
        function: {
          name: 'web_search',
          description: 'Busca informações atualizadas. Use para notícias, CVEs, vulnerabilidades recentes.',
          parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
        }
      }];
      body.tool_choice = 'auto';
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000)
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('GROQ ERROR:', response.status, errText.slice(0, 200));
      return res.status(502).json({ content: [{ text: `⚠️ Erro no modelo (${response.status}). Tente novamente.` }] });
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    // Tool call (só ocorre em modos que usam tools)
    if (useTools && choice?.finish_reason === 'tool_calls' && choice?.message?.tool_calls) {
      const toolCall = choice.message.tool_calls[0];
      const args = JSON.parse(toolCall.function.arguments);
      const searchResults = await doWebSearch(args.query);

      const followUp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 2048,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...cleanMessages,
            { role: 'assistant', content: null, tool_calls: choice.message.tool_calls },
            { role: 'tool', tool_call_id: toolCall.id, content: searchResults }
          ]
        }),
        signal: AbortSignal.timeout(20000)
      });

      const followData = await followUp.json();
      return res.status(200).json({
        content: [{ text: followData.choices?.[0]?.message?.content || 'Sem resposta.' }],
        searched: true
      });
    }

    return res.status(200).json({ content: [{ text: choice?.message?.content || 'Sem resposta.' }] });

  } catch (e) {
    console.error('HANDLER ERROR:', e.message);
    if (e.name === 'TimeoutError' || e.name === 'AbortError') {
      return res.status(504).json({ content: [{ text: '⚠️ Tempo limite excedido. O modelo demorou muito. Tente uma pergunta mais curta ou tente novamente.' }] });
    }
    return res.status(500).json({ content: [{ text: '⚠️ Erro interno. Tente novamente.' }] });
  }
}
