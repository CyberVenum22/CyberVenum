export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  const { token } = req.query;
  if (!token || token !== process.env.SESSION_TOKEN) return res.status(401).json({ error: 'Não autorizado' });

  try {
    // NVD API - CVEs críticos das últimas 24h
    const now = new Date();
    const yesterday = new Date(now - 24 * 60 * 60 * 1000);
    const fmt = d => d.toISOString().split('.')[0];

    const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?cvssV3Severity=CRITICAL&pubStartDate=${fmt(yesterday)}&pubEndDate=${fmt(now)}&resultsPerPage=10`;

    const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) throw new Error('NVD API error');

    const data = await r.json();
    const cves = (data.vulnerabilities || []).map(v => {
      const cve = v.cve;
      const metrics = cve.metrics?.cvssMetricV31?.[0] || cve.metrics?.cvssMetricV30?.[0];
      return {
        id: cve.id,
        description: cve.descriptions?.find(d => d.lang === 'en')?.value?.slice(0, 200) || 'Sem descrição',
        cvss: metrics?.cvssData?.baseScore,
        severity: metrics?.cvssData?.baseSeverity,
        published: cve.published,
        references: cve.references?.slice(0, 2).map(r => r.url) || []
      };
    });

    return res.status(200).json({ cves, total: data.totalResults, updated: now.toISOString() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
