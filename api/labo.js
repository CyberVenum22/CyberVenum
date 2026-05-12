const RATE_LIMIT = {};

// Labs pré-definidos para garantir funcionamento mesmo sem o modelo
const LABS_PREDEFINED = {
  'sqli': {
    title: 'SQL Injection Lab — MySQL + PHP',
    description: 'Ambiente completo para praticar SQL Injection clássico, blind, union-based e error-based com banco MySQL real.',
    difficulty: 'Intermediário',
    estimated_time: '3-4 horas',
    services: [
      { name: 'dvwa', image: 'vulnerables/web-dvwa', purpose: 'App web vulnerável', ports: ['8080:80'], vulnerabilities: ['SQLi Classic', 'SQLi Blind', 'XSS', 'File Upload', 'Command Injection'] },
      { name: 'webgoat', image: 'webgoat/goat-and-wolf', purpose: 'Desafios guiados OWASP', ports: ['8081:8080', '9090:9090'], vulnerabilities: ['SQLi', 'XXE', 'SSRF', 'JWT'] }
    ],
    docker_compose: `version: '3'
services:
  dvwa:
    image: vulnerables/web-dvwa
    ports:
      - "8080:80"
    restart: unless-stopped

  webgoat:
    image: webgoat/goat-and-wolf
    ports:
      - "8081:8080"
      - "9090:9090"
    restart: unless-stopped`,
    objectives: ['Explorar SQLi clássico no DVWA', 'Praticar blind boolean e time-based', 'Completar módulos SQLi no WebGoat', 'Usar sqlmap para automação'],
    hints: ['Comece com DVWA security level: Low', 'Use sqlmap -u "http://localhost:8080/..." --dbs', 'Tente: \'OR 1=1--', 'Para blind: use SLEEP(5) para time-based'],
    flags: ['flag{sqli_union_based}', 'flag{blind_time_based}', 'flag{admin_password_dumped}'],
    tools_needed: ['sqlmap', 'burpsuite', 'curl', 'nmap']
  },
  'xss': {
    title: 'XSS Lab — Reflected, Stored, DOM',
    description: 'Ambiente para praticar todos os tipos de Cross-Site Scripting com bypass de filtros.',
    difficulty: 'Iniciante',
    estimated_time: '2-3 horas',
    services: [
      { name: 'dvwa', image: 'vulnerables/web-dvwa', purpose: 'XSS reflected e stored', ports: ['8080:80'], vulnerabilities: ['XSS Reflected', 'XSS Stored', 'XSS DOM'] },
      { name: 'xss-game', image: 'terjanq/xss-game', purpose: 'Desafios progressivos XSS', ports: ['8082:8080'], vulnerabilities: ['XSS DOM', 'XSS Filter Bypass'] }
    ],
    docker_compose: `version: '3'
services:
  dvwa:
    image: vulnerables/web-dvwa
    ports:
      - "8080:80"
    restart: unless-stopped

  xss-game:
    image: terjanq/xss-game
    ports:
      - "8082:8080"
    restart: unless-stopped`,
    objectives: ['Executar XSS reflected básico', 'Criar XSS stored persistente', 'Explorar DOM XSS', 'Bypassar filtros com encoding'],
    hints: ['Comece: <script>alert(1)</script>', 'Para bypass: <img src=x onerror=alert(1)>', 'Tente: javascript:alert(1)', 'Use Burp Suite para modificar requisições'],
    flags: ['flag{xss_reflected}', 'flag{xss_stored_admin}', 'flag{dom_xss_bypass}'],
    tools_needed: ['burpsuite', 'firefox devtools', 'curl']
  },
  'pentest': {
    title: 'Network Pentest Lab — Múltiplos Alvos',
    description: 'Rede com múltiplas máquinas vulneráveis para praticar reconhecimento, exploração e pós-exploração.',
    difficulty: 'Avançado',
    estimated_time: '6-8 horas',
    services: [
      { name: 'metasploitable', image: 'tleemcjr/metasploitable2', purpose: 'Alvo clássico de pentest', ports: ['2222:22', '8888:80', '2121:21'], vulnerabilities: ['vsftpd backdoor', 'UnrealIRCd', 'Samba', 'DVWA'] },
      { name: 'dvwa', image: 'vulnerables/web-dvwa', purpose: 'Aplicação web vulnerável', ports: ['8080:80'], vulnerabilities: ['SQLi', 'XSS', 'File Upload', 'Command Injection'] },
      { name: 'webgoat', image: 'webgoat/goat-and-wolf', purpose: 'OWASP WebGoat', ports: ['8081:8080'], vulnerabilities: ['Injection', 'Auth', 'SSRF'] }
    ],
    docker_compose: `version: '3'
services:
  metasploitable:
    image: tleemcjr/metasploitable2
    ports:
      - "2222:22"
      - "8888:80"
      - "2121:21"
    restart: unless-stopped

  dvwa:
    image: vulnerables/web-dvwa
    ports:
      - "8080:80"
    restart: unless-stopped

  webgoat:
    image: webgoat/goat-and-wolf
    ports:
      - "8081:8080"
    restart: unless-stopped`,
    objectives: ['Reconhecimento com nmap', 'Explorar vsftpd backdoor via Metasploit', 'Comprometer DVWA via SQLi', 'Escalar privilégios no Metasploitable'],
    hints: ['nmap -sV -sC 172.17.0.0/24', 'use exploit/unix/ftp/vsftpd_234_backdoor', 'Porta 21: tente anonymous login', 'Samba: use exploit/multi/samba/usermap_script'],
    flags: ['flag{nmap_recon_completo}', 'flag{vsftpd_backdoor_rce}', 'flag{root_metasploitable}'],
    tools_needed: ['nmap', 'metasploit', 'sqlmap', 'burpsuite', 'netcat']
  },
  'buffer': {
    title: 'Buffer Overflow Lab — Stack Exploitation',
    description: 'Ambiente Linux 32-bit para aprender buffer overflow, shellcode e bypass de proteções.',
    difficulty: 'Avançado',
    estimated_time: '5-6 horas',
    services: [
      { name: 'pwn-env', image: 'skysider/pwn_docker', purpose: 'Ambiente de exploração binária', ports: ['4444:4444'], vulnerabilities: ['Stack BOF', 'Format String', 'Heap Overflow'] },
      { name: 'protostar', image: 'mrpnkt/protostar', purpose: 'Desafios progressivos de pwn', ports: ['2323:22'], vulnerabilities: ['Stack0-Stack7', 'Format0-Format4', 'Heap0-Heap3'] }
    ],
    docker_compose: `version: '3'
services:
  pwn-env:
    image: skysider/pwn_docker
    ports:
      - "4444:4444"
    privileged: true
    restart: unless-stopped

  protostar:
    image: mrpnkt/protostar
    ports:
      - "2323:22"
    restart: unless-stopped`,
    objectives: ['Entender layout de memória stack', 'Explorar stack0 no Protostar', 'Criar shellcode funcional', 'Bypassar NX com ROP chains'],
    hints: ['ssh user@localhost -p 2323 (senha: user)', 'Use pwndbg/gef para debugging', 'python -c "print(\'A\'*100)" | ./vuln', 'ROPgadget --binary ./vuln --rop'],
    flags: ['flag{stack0_complete}', 'flag{eip_control}', 'flag{shellcode_exec}'],
    tools_needed: ['gdb', 'pwndbg', 'pwntools', 'python', 'ROPgadget']
  },
  'active-directory': {
    title: 'Active Directory Lab — Windows Enterprise',
    description: 'Ambiente completo com Domain Controller Windows para praticar ataques Kerberos, LDAP e lateral movement.',
    difficulty: 'Avançado',
    estimated_time: '8+ horas',
    services: [
      { name: 'badblood', image: 'davidprowe/badblood', purpose: 'AD populado com usuários vulneráveis', ports: ['389:389', '636:636', '3268:3268'], vulnerabilities: ['Kerberoasting', 'AS-REP Roasting', 'Pass-the-Hash', 'DCSync'] }
    ],
    docker_compose: `version: '3'
services:
  badblood:
    image: davidprowe/badblood
    ports:
      - "389:389"
      - "636:636"
      - "3268:3268"
    environment:
      DOMAIN: CYBERVENUM.LOCAL
      DOMAIN_PASSWORD: "P@ssw0rd123!"
    restart: unless-stopped`,
    objectives: ['Enumerar AD com ldapdomaindump', 'Executar Kerberoasting', 'Realizar AS-REP Roasting', 'DCSync para dump de hashes'],
    hints: ['ldapsearch -x -H ldap://localhost -b "dc=cybervenum,dc=local"', 'impacket-GetUserSPNs cybervenum.local/user:pass', 'impacket-GetNPUsers -no-pass -usersfile users.txt', 'secretsdump.py cybervenum.local/admin@DC_IP'],
    flags: ['flag{kerberoast_hash}', 'flag{asrep_cracked}', 'flag{dcsync_ntds}'],
    tools_needed: ['impacket', 'bloodhound', 'crackmapexec', 'hashcat', 'ldapdomaindump']
  },
  'forense': {
    title: 'Forense Digital Lab — Análise Completa',
    description: 'Ambiente com imagens de disco e memória para análise forense usando Autopsy e Volatility.',
    difficulty: 'Intermediário',
    estimated_time: '4-5 horas',
    services: [
      { name: 'autopsy', image: 'forensicim/autopsy', purpose: 'Plataforma forense digital', ports: ['9999:9999'], vulnerabilities: ['Análise de disco', 'Recuperação de arquivos deletados'] },
      { name: 'volatility', image: 'remnux/volatility', purpose: 'Análise de memória RAM', ports: [], vulnerabilities: ['Análise de processos', 'Extração de artefatos'] }
    ],
    docker_compose: `version: '3'
services:
  autopsy:
    image: forensicim/autopsy
    ports:
      - "9999:9999"
    volumes:
      - ./evidence:/evidence
    restart: unless-stopped

  volatility:
    image: remnux/volatility
    volumes:
      - ./memory-dumps:/dumps
    command: tail -f /dev/null
    restart: unless-stopped`,
    objectives: ['Adquirir imagem forense com dd', 'Analisar sistema de arquivos com Autopsy', 'Analisar dump de memória com Volatility', 'Identificar IOCs e construir timeline'],
    hints: ['dd if=/dev/sda of=imagem.dd bs=512', 'vol.py -f dump.vmem --profile=WinXPSP2x86 pslist', 'vol.py imageinfo para identificar perfil', 'Volatility: cmdscan, netscan, malfind'],
    flags: ['flag{deleted_file_recovered}', 'flag{malware_process_found}', 'flag{network_ioc_identified}'],
    tools_needed: ['autopsy', 'volatility3', 'dd', 'strings', 'wireshark']
  },
  'malware': {
    title: 'Malware Analysis Lab — Análise Estática e Dinâmica',
    description: 'Sandbox isolada para análise segura de malware com ferramentas profissionais.',
    difficulty: 'Avançado',
    estimated_time: '4-6 horas',
    services: [
      { name: 'cuckoo', image: 'blacktop/cuckoo', purpose: 'Sandbox automática de malware', ports: ['8000:8000', '8090:8090'], vulnerabilities: [] },
      { name: 'remnux', image: 'remnux/remnux-distro', purpose: 'Análise estática de malware', ports: ['2222:22'], vulnerabilities: [] }
    ],
    docker_compose: `version: '3'
services:
  cuckoo:
    image: blacktop/cuckoo
    ports:
      - "8000:8000"
      - "8090:8090"
    privileged: true
    restart: unless-stopped

  remnux:
    image: remnux/remnux-distro
    ports:
      - "2222:22"
    command: /sbin/init
    privileged: true
    restart: unless-stopped`,
    objectives: ['Analisar executável com strings e file', 'Desmontar binário com Ghidra', 'Submeter sample ao Cuckoo sandbox', 'Identificar C2 e IOCs'],
    hints: ['strings malware.exe | grep -i http', 'file malware.exe para identificar tipo', 'pestudio para análise PE', 'flare-vm para ambiente Windows de análise'],
    flags: ['flag{c2_server_identified}', 'flag{persistence_mechanism}', 'flag{iocs_extracted}'],
    tools_needed: ['ghidra', 'strings', 'pestudio', 'wireshark', 'cuckoo']
  }
};

function matchLab(topic) {
  const t = topic.toLowerCase();
  if (t.includes('sql') || t.includes('injection') || t.includes('sqli')) return LABS_PREDEFINED['sqli'];
  if (t.includes('xss') || t.includes('cross-site') || t.includes('csrf')) return LABS_PREDEFINED['xss'];
  if (t.includes('pentest') || t.includes('network') || t.includes('rede') || t.includes('metasploit')) return LABS_PREDEFINED['pentest'];
  if (t.includes('buffer') || t.includes('overflow') || t.includes('pwn') || t.includes('bof')) return LABS_PREDEFINED['buffer'];
  if (t.includes('active directory') || t.includes('kerberos') || t.includes('ad') || t.includes('windows')) return LABS_PREDEFINED['active-directory'];
  if (t.includes('foren') || t.includes('volatil') || t.includes('autopsy') || t.includes('memória') || t.includes('disco')) return LABS_PREDEFINED['forense'];
  if (t.includes('malware') || t.includes('análise') || t.includes('sandbox') || t.includes('virus')) return LABS_PREDEFINED['malware'];
  return null;
}

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { topic, token } = req.body;
  if (!token || token !== process.env.SESSION_TOKEN) return res.status(401).json({ error: 'Não autorizado' });
  if (!topic) return res.status(400).json({ error: 'Tópico inválido' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  const now = Date.now();
  if (RATE_LIMIT[ip] && now - RATE_LIMIT[ip] < 20000) return res.status(429).json({ error: 'Aguarde 20s entre gerações' });
  RATE_LIMIT[ip] = now;

  // Tenta match direto primeiro (sempre funciona)
  const predefined = matchLab(topic);
  if (predefined) return res.status(200).json(predefined);

  // Tenta gerar via Groq com prompt muito restrito
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1500,
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content: 'Você é uma API que retorna APENAS JSON válido. NUNCA retorne texto, markdown ou explicações. APENAS o objeto JSON.'
          },
          {
            role: 'user',
            content: `{"action":"generate_lab","topic":"${topic.replace(/"/g, '')}"}\n\nRetorne este JSON preenchido:\n{"title":"","description":"","difficulty":"","estimated_time":"","services":[{"name":"","image":"","purpose":"","ports":[],"vulnerabilities":[]}],"docker_compose":"","objectives":[],"hints":[],"flags":[],"tools_needed":[]}`
          }
        ]
      })
    });

    if (!r.ok) throw new Error('Groq error ' + r.status);

    const data = await r.json();
    let text = (data.choices?.[0]?.message?.content || '').trim();

    // Limpar agressivamente
    text = text.replace(/^[^{]*/s, '').replace(/[^}]*$/s, '');
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No JSON found');
    text = text.slice(start, end + 1);

    const lab = JSON.parse(text);
    if (!lab.title || !lab.docker_compose) throw new Error('JSON incompleto');

    return res.status(200).json(lab);
  } catch {
    // Fallback: gera lab genérico funcional para o tópico
    return res.status(200).json({
      title: `Lab: ${topic}`,
      description: `Ambiente Docker para praticar ${topic} com ferramentas reais.`,
      difficulty: 'Intermediário',
      estimated_time: '3-4 horas',
      services: [
        {
          name: 'dvwa',
          image: 'vulnerables/web-dvwa',
          purpose: 'Damn Vulnerable Web Application — alvos para exploração',
          ports: ['8080:80'],
          vulnerabilities: ['SQLi', 'XSS', 'CSRF', 'File Upload', 'Command Injection', 'File Inclusion']
        },
        {
          name: 'webgoat',
          image: 'webgoat/goat-and-wolf',
          purpose: 'OWASP WebGoat — desafios guiados',
          ports: ['8081:8080', '9090:9090'],
          vulnerabilities: ['Injection', 'Authentication', 'XXE', 'SSRF', 'JWT']
        },
        {
          name: 'juice-shop',
          image: 'bkimminich/juice-shop',
          purpose: 'OWASP Juice Shop — app moderna vulnerável',
          ports: ['3000:3000'],
          vulnerabilities: ['XSS', 'SQLi', 'IDOR', 'Broken Auth', 'Sensitive Data']
        }
      ],
      docker_compose: `version: '3'
services:
  dvwa:
    image: vulnerables/web-dvwa
    ports:
      - "8080:80"
    restart: unless-stopped

  webgoat:
    image: webgoat/goat-and-wolf
    ports:
      - "8081:8080"
      - "9090:9090"
    restart: unless-stopped

  juice-shop:
    image: bkimminich/juice-shop
    ports:
      - "3000:3000"
    restart: unless-stopped`,
      objectives: [
        `Explorar vulnerabilidades de ${topic} no DVWA`,
        'Completar módulos relacionados no WebGoat',
        'Resolver desafios no OWASP Juice Shop',
        'Usar ferramentas como Burp Suite e sqlmap'
      ],
      hints: [
        'Acesse DVWA em http://localhost:8080 (admin/password)',
        'WebGoat em http://localhost:8081/WebGoat',
        'Juice Shop em http://localhost:3000',
        'Use Burp Suite como proxy (127.0.0.1:8080)'
      ],
      flags: ['flag{lab_iniciado}', 'flag{primeira_vuln}', 'flag{lab_completo}'],
      tools_needed: ['burpsuite', 'nmap', 'sqlmap', 'dirb', 'curl']
    });
  }
}
