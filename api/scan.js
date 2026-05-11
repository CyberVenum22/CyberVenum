export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { url, token } = req.body;
  if (!token || token !== process.env.SESSION_TOKEN) return res.status(401).json({ error: 'Não autorizado' });
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'URL inválida' });

  let targetUrl = url.trim();
  if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;

  const results = {
    url: targetUrl,
    timestamp: new Date().toISOString(),
    score: 100,
    checks: []
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    let response;
    try {
      response = await fetch(targetUrl, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (Security Scanner)' }
      });
    } finally {
      clearTimeout(timeout);
    }

    const headers = Object.fromEntries(response.headers.entries());
    const body = await response.text().catch(() => '');

    // 1. HTTPS
    const isHttps = targetUrl.startsWith('https://');
    results.checks.push({ id: 'https', name: 'HTTPS', severity: 'critical', passed: isHttps, detail: isHttps ? 'Site usa HTTPS' : 'Site não usa HTTPS — dados em texto claro', impact: 'Interceptação de tráfego (MITM)' });
    if (!isHttps) results.score -= 20;

    // 2. HSTS
    const hsts = headers['strict-transport-security'];
    const hasHsts = !!hsts;
    const hstsLong = hsts && parseInt(hsts.match(/max-age=(\d+)/)?.[1]||0) >= 31536000;
    results.checks.push({ id: 'hsts', name: 'HSTS', severity: 'high', passed: hasHsts, detail: hasHsts ? `HSTS ativo: ${hsts}` : 'Strict-Transport-Security ausente', impact: 'Downgrade para HTTP possível' });
    if (!hasHsts) results.score -= 10;

    // 3. CSP
    const csp = headers['content-security-policy'];
    const hasCSP = !!csp;
    const unsafeCSP = csp && (csp.includes("'unsafe-inline'") || csp.includes("'unsafe-eval'") || csp.includes('*'));
    results.checks.push({ id: 'csp', name: 'Content-Security-Policy', severity: 'high', passed: hasCSP && !unsafeCSP, detail: !hasCSP ? 'CSP ausente — XSS não mitigado' : unsafeCSP ? `CSP fraco: ${csp.slice(0,100)}` : `CSP configurado: ${csp.slice(0,80)}...`, impact: 'Cross-Site Scripting (XSS)' });
    if (!hasCSP) results.score -= 12; else if (unsafeCSP) results.score -= 6;

    // 4. X-Frame-Options
    const xfo = headers['x-frame-options'];
    const hasXFO = !!xfo;
    results.checks.push({ id: 'xfo', name: 'X-Frame-Options', severity: 'medium', passed: hasXFO, detail: hasXFO ? `X-Frame-Options: ${xfo}` : 'X-Frame-Options ausente', impact: 'Clickjacking attack' });
    if (!hasXFO) results.score -= 8;

    // 5. X-Content-Type-Options
    const xcto = headers['x-content-type-options'];
    results.checks.push({ id: 'xcto', name: 'X-Content-Type-Options', severity: 'medium', passed: xcto === 'nosniff', detail: xcto ? `X-Content-Type-Options: ${xcto}` : 'X-Content-Type-Options ausente', impact: 'MIME sniffing attacks' });
    if (!xcto) results.score -= 5;

    // 6. Referrer-Policy
    const rp = headers['referrer-policy'];
    results.checks.push({ id: 'rp', name: 'Referrer-Policy', severity: 'low', passed: !!rp, detail: rp ? `Referrer-Policy: ${rp}` : 'Referrer-Policy ausente', impact: 'Vazamento de URLs sensíveis' });
    if (!rp) results.score -= 3;

    // 7. Permissions-Policy
    const pp = headers['permissions-policy'];
    results.checks.push({ id: 'pp', name: 'Permissions-Policy', severity: 'low', passed: !!pp, detail: pp ? `Permissions-Policy configurada` : 'Permissions-Policy ausente', impact: 'Acesso não controlado a câmera/mic/geo' });
    if (!pp) results.score -= 3;

    // 8. Server Header
    const server = headers['server'];
    const exposesVersion = server && /[0-9]/.test(server);
    results.checks.push({ id: 'server', name: 'Server Header', severity: 'medium', passed: !server || !exposesVersion, detail: server ? `Server: ${server} ${exposesVersion ? '— versão exposta!' : ''}` : 'Server header não exposto', impact: 'Fingerprinting de tecnologia' });
    if (exposesVersion) results.score -= 7;

    // 9. X-Powered-By
    const xpb = headers['x-powered-by'];
    results.checks.push({ id: 'xpb', name: 'X-Powered-By', severity: 'medium', passed: !xpb, detail: xpb ? `X-Powered-By: ${xpb} — tecnologia exposta!` : 'X-Powered-By não exposto', impact: 'Fingerprinting de tecnologia' });
    if (xpb) results.score -= 5;

    // 10. Cookie Security
    const setCookie = headers['set-cookie'];
    if (setCookie) {
      const hasHttpOnly = setCookie.includes('HttpOnly') || setCookie.includes('httponly');
      const hasSecure = setCookie.includes('Secure') || setCookie.includes('secure');
      const hasSameSite = setCookie.includes('SameSite') || setCookie.includes('samesite');
      const cookieOk = hasHttpOnly && hasSecure && hasSameSite;
      results.checks.push({ id: 'cookie', name: 'Cookie Security', severity: 'high', passed: cookieOk, detail: `HttpOnly: ${hasHttpOnly?'✓':'✗'} | Secure: ${hasSecure?'✓':'✗'} | SameSite: ${hasSameSite?'✓':'✗'}`, impact: 'Session hijacking, CSRF' });
      if (!hasHttpOnly) results.score -= 8;
      if (!hasSecure) results.score -= 5;
      if (!hasSameSite) results.score -= 4;
    }

    // 11. Open Redirect check
    const redirected = response.redirected && response.url !== targetUrl;
    if (redirected) {
      results.checks.push({ id: 'redirect', name: 'Redirecionamento', severity: 'info', passed: true, detail: `Redirecionado para: ${response.url}`, impact: 'Verificar se redirecionamento é seguro' });
    }

    // 12. Information Disclosure in body
    const infoPatterns = [
      { pattern: /mysql_error|ORA-\d+|Microsoft OLE DB|ODBC SQL/i, name: 'Erro de banco de dados exposto', sev: 'critical' },
      { pattern: /phpinfo\(\)|PHP Version|php\.ini/i, name: 'Informações PHP expostas', sev: 'high' },
      { pattern: /stack trace|at System\.|at java\.|Traceback \(most recent/i, name: 'Stack trace exposta', sev: 'high' },
      { pattern: /wp-login\.php|wp-content\/plugins/i, name: 'WordPress detectado', sev: 'info' },
      { pattern: /debug=true|debug_mode|APP_DEBUG/i, name: 'Modo debug ativo', sev: 'high' },
    ];
    for (const p of infoPatterns) {
      if (p.pattern.test(body)) {
        results.checks.push({ id: 'disclosure_'+p.name, name: 'Divulgação: '+p.name, severity: p.sev, passed: false, detail: p.name+' detectado no corpo da resposta', impact: 'Information disclosure' });
        if (p.sev === 'critical') results.score -= 15;
        else if (p.sev === 'high') results.score -= 10;
      }
    }

    // 13. Status code
    results.status = response.status;
    results.finalUrl = response.url;
    results.score = Math.max(0, Math.min(100, results.score));

    // Grade
    if (results.score >= 90) results.grade = 'A+';
    else if (results.score >= 80) results.grade = 'A';
    else if (results.score >= 70) results.grade = 'B';
    else if (results.score >= 60) results.grade = 'C';
    else if (results.score >= 50) results.grade = 'D';
    else results.grade = 'F';

  } catch (err) {
    results.error = err.name === 'AbortError' ? 'Timeout — site demorou muito para responder' : `Erro ao acessar: ${err.message}`;
    results.score = 0; results.grade = 'N/A';
  }

  return res.status(200).json(results);
}
