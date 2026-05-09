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
Especialidades: pentest, red team, CTF, XSS, SQLi, CSRF, SSRF, RCE, LFI/RFI, MITM, engenharia reversa, wireless, blue team, SOC, SIEM, IDS/IPS, hardening, threat intelligence, forense digital, OWASP Top 10, DevSecOps, criptografia, engenharia social, LGPD, ISO 27001, NIST CSF, MITRE ATT&CK, CIS Controls, PCI-DSS.`;

  const modes = {
    chat: `\n\nMODO: Chat geral. Use o histórico completo para raciocínio progressivo. Construa sobre respostas anteriores. Adapte-se ao nível técnico do usuário. Use blocos de código para comandos. Sempre inclua mitigações.`,

    pentest: `\n\nMODO PENTEST REPORT: Você é um especialista em geração de relatórios de pentest profissionais. Quando receber descrição de vulnerabilidades encontradas, gere um relatório completo com:
- Sumário executivo
- Vulnerabilidades com severidade (Crítica/Alta/Média/Baixa), CVSS score, descrição técnica, evidências, impacto e recomendação de correção
- Conclusão e próximos passos
Use formato estruturado e profissional.`,

    osint: `\n\nMODO OSINT/SCANNER: Você é um especialista em OSINT e análise de reputação. Quando receber URL, IP, domínio ou hash, analise usando seu conhecimento sobre:
- Indicadores de comprometimento (IOCs)
- Técnicas de reconhecimento
- Fontes públicas (Shodan, VirusTotal, AbuseIPDB, Censys)
- WHOIS, DNS, ASN, geolocalização
Forneça análise detalhada e recomendações.`,

    quiz: `\n\nMODO QUIZ/TREINAMENTO: Você é um instrutor de cibersegurança. Gere perguntas de múltipla escolha com 4 opções (A, B, C, D), indique a resposta correta e explique o porquê. Adapte a dificuldade conforme solicitado. Cubra tópicos de certificações: CEH, OSCP, CompTIA Security+, CISSP. Quando o usuário responder, avalie e dê feedback detalhado.`,

    ctf: `\n\nMODO CTF HELPER: Você é um especialista em CTF (Capture The Flag). Ajude a resolver desafios passo a passo com raciocínio detalhado. Categorias: Web, Crypto, Forensics, Pwn/Binary, Reversing, OSINT, Steganography, Misc. Sugira ferramentas específicas, payloads, comandos. NUNCA entregue a flag diretamente — guie o usuário pelo raciocínio.`,

    codereview: `\n\nMODO CODE REVIEW: Você é um especialista em segurança de código. Analise o código fornecido e identifique:
- Vulnerabilidades com linha específica e severidade (Crítica/Alta/Média/Baixa/Info)
- Tipo de vulnerabilidade (OWASP, CWE)
- Impacto e vetor de exploração
- Código corrigido como exemplo
Seja preciso e técnico.`,

    wordlist: `\n\nMODO WORDLIST: Você é um especialista em geração de wordlists para testes de penetração autorizados. Quando receber informações do alvo, gere wordlists personalizadas considerando: nome da empresa, datas relevantes, padrões comuns de senha, variações com números e símbolos, termos do setor. Sempre enfatize que deve ser usado apenas em ambientes autorizados.`,

    checklist: `\n\nMODO CHECKLIST: Você é um especialista em hardening e compliance. Gere checklists detalhados de segurança personalizados para o ambiente informado. Inclua: controles técnicos, referências (CIS Benchmarks, NIST, OWASP), prioridade de implementação e comandos de verificação quando aplicável.`,

    fileanalysis: `\n\nMODO ANÁLISE DE ARQUIVO: Você é um especialista em análise forense e threat hunting. Analise o conteúdo fornecido (logs, código, configurações, pcap descriptions) em busca de: IOCs, comportamentos suspeitos, vulnerabilidades, anomalias, padrões de ataque (MITRE ATT&CK). Seja detalhado e técnico.`
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
            description: 'Busca informações atualizadas na web. Use para notícias, CVEs, vulnerabilidades ou qualquer dado recente.',
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
