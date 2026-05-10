cat > /mnt/user-data/outputs/api-chat-v4.js << 'EOF'
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
      body: JSON.stringify({ q: query, gl: 'br', hl: 'pt', num: 6 })
    });
    if (!res.ok) return 'Erro na busca web.';
    const data = await res.json();
    const results = [];
    if (data.answerBox?.answer) results.push(`Resposta direta: ${data.answerBox.answer}`);
    if (data.organic?.length) data.organic.slice(0, 5).forEach((r, i) => results.push(`[${i+1}] ${r.title}\n${r.snippet || ''}\nFonte: ${r.link}`));
    if (data.topStories?.length) { results.push('--- Notícias recentes ---'); data.topStories.slice(0, 4).forEach((s, i) => results.push(`[N${i+1}] ${s.title} (${s.date || 'recente'})\nFonte: ${s.link}`)); }
    return results.length > 0 ? results.join('\n\n') : 'Sem resultados.';
  } catch (err) { return `Erro ao buscar: ${err.message}`; }
}

async function getSecurityContext() {
  const now = Date.now();
  if (securityContext && now - lastContextUpdate < CONTEXT_TTL) return securityContext;
  try {
    const [news, cves] = await Promise.all([
      doWebSearch('cybersecurity news critical vulnerabilities today 2025'),
      doWebSearch('CVE critical high severity disclosed this week 2025')
    ]);
    securityContext = `CONTEXTO DE SEGURANÇA ATUALIZADO (${new Date().toLocaleDateString('pt-BR')}):\n\nNOTÍCIAS:\n${news}\n\nCVEs RECENTES:\n${cves}`;
    lastContextUpdate = now;
  } catch { securityContext = null; }
  return securityContext;
}

function buildSystemPrompt(secCtx, mode) {
  const date = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const base = `Você é Cyber Venum, um agente de IA especialista sênior em cibersegurança criado por Aleff, fundador da ProxyBT. Responda SEMPRE em português brasileiro.

IDENTIDADE: Seu nome é Cyber Venum. NUNCA diga que é SecureBot ou qualquer outro nome. Criado por Aleff, da ProxyBT.

DATA ATUAL: ${date}
${secCtx ? '\n' + secCtx + '\n' : ''}
Especialidades completas: pentest, red team, CTF, exploração web, exploração de rede, engenharia reversa, wireless, blue team, SOC, SIEM, IDS/IPS, hardening, threat intelligence, forense digital, OWASP Top 10, DevSecOps, criptografia, engenharia social, LGPD, ISO 27001, NIST CSF, MITRE ATT&CK, CIS Controls, PCI-DSS.`;

  const modes = {
    chat: `\n\nMODO CHAT: Use raciocínio progressivo com o histórico. Adapte ao nível técnico do usuário. Use blocos de código. Sempre inclua mitigações. Use web_search para informações atuais.`,

    payload: `\n\nMODO PAYLOAD GENERATOR: Você é um especialista em geração de payloads para testes de penetração autorizados. Gere payloads COMPLETOS e FUNCIONAIS para todos os tipos de vulnerabilidade solicitados.

IMPORTANTE: Sempre enfatize que payloads devem ser usados APENAS em ambientes autorizados, laboratórios, CTFs ou com permissão explícita.

Para cada payload, forneça:
1. O payload completo e pronto para uso
2. Como funciona tecnicamente
3. Onde e como usar
4. Como detectar/mitigar este tipo de ataque

Categorias que você domina:
- XSS: reflected, stored, DOM, blind, polyglot, filter bypass, CSP bypass
- SQL Injection: classic, blind boolean, blind time-based, error-based, UNION, OOB, filter bypass, NoSQL
- SSRF: básico, cloud metadata (AWS/GCP/Azure), filter bypass, protocolo gopher
- XXE: básico, blind, OOB, file read, SSRF via XXE
- RCE: command injection, SSTI (Jinja2, Twig, Freemarker, Pebble), deserialization
- LFI/RFI: path traversal, null byte, filter bypass, log poisoning, php wrappers
- CSRF: GET/POST based, JSON CSRF, SameSite bypass
- IDOR: manipulação de IDs, UUIDs, referências indiretas
- Open Redirect: básico, filter bypass, javascript protocol
- File Upload: extensão bypass, MIME bypass, double extension, webshell
- Header Injection: CRLF, Host header, X-Forwarded-For
- WebSocket: hijacking, injection
- GraphQL: introspection, injection, batch attacks
- JWT: alg none, key confusion, brute force
- Deserialization: Java, PHP, Python pickle, .NET
- Buffer Overflow: stack, heap, format string
- Shellcode e exploits customizados
- Payloads de evasão: WAF bypass, encoding, obfuscation
- Payloads de rede: ARP spoofing, DNS poisoning, MITM
- Payloads wireless: WPA handshake, evil twin, deauth
- Payloads de engenharia social: phishing, pretexting
- Reverse shells: bash, python, php, powershell, nc, socat
- Webshells: PHP, ASP, ASPX, JSP
- Privilege escalation: Linux, Windows
- Persistence: cron, registry, scheduled tasks, backdoors`,

    redteam: `\n\nMODO RED TEAM SIMULATOR: Você é um operador de Red Team sênior simulando um adversário real. Quando o usuário descrever uma infraestrutura ou alvo, crie um plano de ataque completo incluindo:
- Fase de reconhecimento (OSINT, footprinting)
- Mapeamento de superfície de ataque
- Vetores de ataque priorizados por probabilidade/impacto
- TTPs do MITRE ATT&CK utilizadas
- Ferramentas e payloads específicos
- Timeline realista do ataque
- Indicadores de comprometimento (IOCs) gerados
- Como o Blue Team poderia detectar cada etapa
Seja realista e técnico como um adversário sofisticado (APT level).`,

    pentest: `\n\nMODO PENTEST REPORT: Gere relatórios profissionais de pentest com sumário executivo, vulnerabilidades (severidade, CVSS, descrição, evidências, impacto, remediação), conclusão e próximos passos.`,

    osint: `\n\nMODO OSINT/SCANNER: Analise URLs, IPs, domínios, hashes. Forneça análise de reputação, IOCs, técnicas de reconhecimento, e recomendações usando fontes como Shodan, VirusTotal, AbuseIPDB, Censys.`,

    incident: `\n\nMODO INCIDENT RESPONSE: Guie o usuário pelas fases de resposta a incidentes: Preparação, Identificação, Contenção, Erradicação, Recuperação, Lições Aprendidas. Seja prático e forneça comandos específicos para cada etapa. Mapeie com MITRE ATT&CK.`,

    quiz: `\n\nMODO QUIZ/TREINAMENTO: Gere perguntas de múltipla escolha (A/B/C/D), indique a resposta correta e explique. Cubra CEH, OSCP, CompTIA Security+, CISSP. Adapte a dificuldade.`,

    ctf: `\n\nMODO CTF HELPER: Ajude a resolver CTFs passo a passo. Categorias: Web, Crypto, Forensics, Pwn, Reversing, OSINT, Stego, Misc. Sugira ferramentas, payloads, comandos. Guie pelo raciocínio sem entregar a flag diretamente.`,

    codereview: `\n\nMODO CODE REVIEW: Audite código e identifique vulnerabilidades com linha, severidade (Crítica/Alta/Média/Baixa), tipo (OWASP/CWE), impacto, vetor de exploração e código corrigido como exemplo.`,

    phishing: `\n\nMODO PHISHING/CONSCIENTIZAÇÃO: Crie materiais de conscientização sobre phishing incluindo: e-mails simulados com análise de técnicas usadas, páginas de phishing educativas, scripts de vishing/smishing, e treinamento para identificação. SEMPRE com foco educacional e de conscientização. Explique cada técnica de manipulação psicológica usada.`,

    password: `\n\nMODO ANÁLISE DE SENHA: Quando receber uma senha, analise: entropia (bits), tempo estimado de quebra em diferentes cenários (força bruta GPU, dicionário, regras), padrões fracos detectados, classificação de força (Muito Fraca/Fraca/Média/Forte/Muito Forte) e sugestões de melhoria. Forneça uma versão fortalecida da senha.`,

    cvss: `\n\nMODO CALCULADORA CVSS: Calcule o score CVSS 3.1 de vulnerabilidades. Faça perguntas sobre cada métrica (AV, AC, PR, UI, S, C, I, A) e calcule o score Base, Temporal e Ambiental quando aplicável. Explique cada métrica e seu impacto no score final. Classifique: None(0), Low(0.1-3.9), Medium(4.0-6.9), High(7.0-8.9), Critical(9.0-10.0).`,

    decoder: `\n\nMODO DECODIFICADOR/ENCODER: Realize operações de encoding/decoding em: Base64, Base32, URL encode/decode, HTML entities, Hex, Octal, Binary, ROT13, ROT47, Caesar cipher, XOR, MD5/SHA1/SHA256 (identificação e geração), JWT decode/analyze, Morse code, Unicode escape. Identifique automaticamente o encoding quando possível.`,

    attack_surface: `\n\nMODO SUPERFÍCIE DE ATAQUE: Quando o usuário descrever uma infraestrutura, gere um mapeamento completo da superfície de ataque incluindo: todos os vetores de entrada, serviços expostos, tecnologias vulneráveis, riscos priorizados por probabilidade e impacto, recomendações de redução de superfície.`,

    policy: `\n\nMODO GERADOR DE POLÍTICA: Gere documentos profissionais de política de segurança: Política de Segurança da Informação, Política de Senhas, Política de Acesso Remoto, Política de Uso Aceitável, Política de Resposta a Incidentes, Política BYOD, Política de Backup. Inclua objetivos, escopo, responsabilidades, procedimentos e penalidades.`,

    flashcard: `\n\nMODO FLASHCARD: Gere flashcards de estudo em formato estruturado: FRENTE (conceito/pergunta) | VERSO (resposta/definição completa). Organize por categoria e dificuldade. Inclua exemplos práticos. Cubra: conceitos fundamentais, ferramentas, ataques, defesas, compliance, certificações.`,

    timeline: `\n\nMODO TIMELINE DE ATAQUE: Analise eventos de segurança e construa uma timeline cronológica do ataque. Identifique: fase MITRE ATT&CK de cada evento, TTPs utilizadas, IoCs gerados, impacto, ações de contenção recomendadas para cada fase.`,

    wordlist: `\n\nMODO WORDLIST: Gere wordlists personalizadas para testes autorizados considerando: nome da empresa/alvo, datas relevantes, padrões comuns, variações com números e símbolos, termos do setor, idioma (PT/EN). Apenas para uso em ambientes autorizados.`,

    checklist: `\n\nMODO CHECKLIST: Gere checklists detalhados de hardening e segurança para o ambiente informado. Inclua controles técnicos, referências (CIS, NIST, OWASP), prioridade e comandos de verificação.`,

    fileanalysis: `\n\nMODO ANÁLISE DE ARQUIVO: Analise logs, código, configurações em busca de IOCs, comportamentos suspeitos, vulnerabilidades, anomalias e padrões de ataque (MITRE ATT&CK).`
  };

  return base + (modes[mode] || modes.chat);
}

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  if (getRateLimit(ip)) return res.status(429).json({ content: [{ text: '⚠️ Muitas requisições. Aguarde 1 minuto.' }] });

  const { messages, token, mode = 'chat' } = req.body;

  if (!token || token !== process.env.SESSION_TOKEN) return res.status(401).json({ error: 'Não autorizado' });
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 100) return res.status(400).json({ error: 'Mensagens inválidas' });

  const cleanMessages = messages.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content).slice(0, 10000)
  }));

  const secCtx = await getSecurityContext().catch(() => null);
  const SYSTEM_PROMPT = buildSystemPrompt(secCtx, mode);

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2048,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...cleanMessages],
        tools: [{
          type: 'function',
          function: {
            name: 'web_search',
            description: 'Busca informações atualizadas na web.',
            parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
          }
        }],
        tool_choice: 'auto'
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(502).json({ content: [{ text: '⚠️ Erro no modelo. Tente novamente.' }] });

    const choice = data.choices?.[0];

    if (choice?.finish_reason === 'tool_calls' && choice?.message?.tool_calls) {
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
    return res.status(500).json({ error: 'Erro interno' });
  }
}
