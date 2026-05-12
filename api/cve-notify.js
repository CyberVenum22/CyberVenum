export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  const { token } = req.query;
  if (!token || token !== process.env.SESSION_TOKEN) return res.status(401).json({ error: 'Não autorizado' });

  const results = { cves: [], total: 0, updated: new Date().toISOString(), source: '' };

  // Tentativa 1: NVD API v2 com headers corretos
  try {
    const now = new Date();
    const yesterday = new Date(now - 24 * 60 * 60 * 1000);
    const fmt = d => d.toISOString().replace(/\.\d{3}Z$/, '.000Z');

    const nvdUrl = `https://services.nvd.nist.gov/rest/json/cves/2.0?cvssV3Severity=CRITICAL&pubStartDate=${fmt(yesterday)}&pubEndDate=${fmt(now)}&resultsPerPage=10`;

    const r = await fetch(nvdUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CyberVenum-ProxyBT/1.0'
      },
      signal: AbortSignal.timeout(8000)
    });

    if (r.ok) {
      const contentType = r.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await r.json();
        results.cves = (data.vulnerabilities || []).map(v => {
          const cve = v.cve;
          const m31 = cve.metrics?.cvssMetricV31?.[0];
          const m30 = cve.metrics?.cvssMetricV30?.[0];
          const metrics = m31 || m30;
          return {
            id: cve.id,
            description: cve.descriptions?.find(d => d.lang === 'en')?.value?.slice(0, 250) || 'Sem descrição',
            cvss: metrics?.cvssData?.baseScore || null,
            severity: metrics?.cvssData?.baseSeverity || 'CRITICAL',
            published: cve.published,
            references: cve.references?.slice(0, 2).map(ref => ref.url) || []
          };
        });
        results.total = data.totalResults || results.cves.length;
        results.source = 'NVD';
        return res.status(200).json(results);
      }
    }
  } catch {}

  // Tentativa 2: CISA Known Exploited Vulnerabilities (sempre funciona)
  try {
    const r = await fetch('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json', {
      headers: { 'Accept': 'application/json', 'User-Agent': 'CyberVenum/1.0' },
      signal: AbortSignal.timeout(8000)
    });

    if (r.ok) {
      const data = await r.json();
      const recent = (data.vulnerabilities || [])
        .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))
        .slice(0, 10);

      results.cves = recent.map(v => ({
        id: v.cveID,
        description: `${v.product} (${v.vendorProject}) — ${v.shortDescription || v.vulnerabilityName}`,
        cvss: null,
        severity: 'CRÍTICA (exploração ativa)',
        published: v.dateAdded,
        references: [`https://nvd.nist.gov/vuln/detail/${v.cveID}`],
        exploited: true,
        action: v.requiredAction
      }));
      results.total = data.count || results.cves.length;
      results.source = 'CISA KEV (exploração ativa confirmada)';
      return res.status(200).json(results);
    }
  } catch {}

  // Tentativa 3: Usar Groq para gerar CVEs recentes via busca
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `Liste os 5 CVEs críticos mais recentes de 2024/2025 que você conhece. Retorne APENAS JSON válido no formato:
{"cves":[{"id":"CVE-XXXX-XXXXX","description":"descrição","cvss":9.8,"severity":"CRÍTICO","published":"2025-01-01","references":["https://nvd.nist.gov/vuln/detail/CVE-XXXX-XXXXX"]}]}`
        }]
      })
    });

    if (r.ok) {
      const data = await r.json();
      let text = data.choices?.[0]?.message?.content || '';
      text = text.replace(/```json|```/g, '').trim();
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      if (jsonStart !== -1) {
        const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
        results.cves = parsed.cves || [];
        results.total = results.cves.length;
        results.source = 'Base de conhecimento do modelo (APIs externas indisponíveis)';
        return res.status(200).json(results);
      }
    }
  } catch {}

  // Fallback final
  results.cves = [];
  results.source = 'Serviços temporariamente indisponíveis';
  results.message = 'Tente novamente em alguns minutos. APIs NVD e CISA podem estar com lentidão.';
  return res.status(200).json(results);
}
