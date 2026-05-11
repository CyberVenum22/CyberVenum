export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { target, token } = req.body;
  if (!token || token !== process.env.SESSION_TOKEN) return res.status(401).json({ error: 'Não autorizado' });
  if (!target) return res.status(400).json({ error: 'Target inválido' });

  const results = { target, timestamp: new Date().toISOString(), sources: {} };

  // AbuseIPDB
  try {
    if (process.env.ABUSEIPDB_KEY) {
      const r = await fetch(`https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(target)}&maxAgeInDays=90&verbose`, {
        headers: { 'Key': process.env.ABUSEIPDB_KEY, 'Accept': 'application/json' }
      });
      if (r.ok) {
        const d = await r.json();
        results.sources.abuseipdb = {
          score: d.data?.abuseConfidenceScore,
          totalReports: d.data?.totalReports,
          country: d.data?.countryCode,
          isp: d.data?.isp,
          domain: d.data?.domain,
          isWhitelisted: d.data?.isWhitelisted,
          lastReported: d.data?.lastReportedAt
        };
      }
    }
  } catch {}

  // VirusTotal
  try {
    if (process.env.VIRUSTOTAL_KEY) {
      const isIP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(target);
      const endpoint = isIP
        ? `https://www.virustotal.com/api/v3/ip_addresses/${target}`
        : `https://www.virustotal.com/api/v3/domains/${target}`;
      const r = await fetch(endpoint, { headers: { 'x-apikey': process.env.VIRUSTOTAL_KEY } });
      if (r.ok) {
        const d = await r.json();
        const stats = d.data?.attributes?.last_analysis_stats;
        results.sources.virustotal = {
          malicious: stats?.malicious || 0,
          suspicious: stats?.suspicious || 0,
          harmless: stats?.harmless || 0,
          undetected: stats?.undetected || 0,
          reputation: d.data?.attributes?.reputation,
          country: d.data?.attributes?.country,
          asn: d.data?.attributes?.asn,
          asOwner: d.data?.attributes?.as_owner
        };
      }
    }
  } catch {}

  // Shodan
  try {
    if (process.env.SHODAN_KEY) {
      const r = await fetch(`https://api.shodan.io/shodan/host/${target}?key=${process.env.SHODAN_KEY}`);
      if (r.ok) {
        const d = await r.json();
        results.sources.shodan = {
          org: d.org,
          isp: d.isp,
          country: d.country_name,
          city: d.city,
          ports: d.ports,
          vulnerabilities: d.vulns,
          os: d.os,
          hostnames: d.hostnames?.slice(0, 5)
        };
      }
    }
  } catch {}

  // DNS lookup via public API
  try {
    const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(target)}&type=A`);
    if (r.ok) {
      const d = await r.json();
      results.sources.dns = {
        answers: d.Answer?.slice(0, 5).map(a => ({ type: a.type, data: a.data, ttl: a.TTL })) || [],
        status: d.Status
      };
    }
  } catch {}

  return res.status(200).json(results);
}
