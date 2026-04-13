import { timingSafeEqual } from 'crypto';

const ATTEMPTS = {};
const MAX = 5;
const LOCK_MS = 30 * 1000;

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  const now = Date.now();

  if (!ATTEMPTS[ip]) ATTEMPTS[ip] = { count: 0, locked: 0 };
  const a = ATTEMPTS[ip];

  if (now < a.locked) {
    const wait = Math.ceil((a.locked - now) / 1000);
    return res.status(429).json({ error: `Bloqueado. Aguarde ${wait}s.` });
  }

  const { password } = req.body;
  const correctPassword = process.env.ACCESS_PASSWORD;
  const sessionToken = process.env.SESSION_TOKEN;

  if (!password || !correctPassword || !sessionToken) {
    return res.status(400).json({ error: 'Configuração inválida' });
  }

  let match = false;
  try {
    const bufA = Buffer.from(password);
    const bufB = Buffer.from(correctPassword);
    if (bufA.length === bufB.length) {
      match = timingSafeEqual(bufA, bufB);
    }
  } catch {
    match = false;
  }

  if (!match) {
    a.count++;
    if (a.count >= MAX) {
      a.locked = now + LOCK_MS;
      a.count = 0;
      return res.status(429).json({ error: 'Muitas tentativas. Bloqueado por 30s.' });
    }
    return res.status(401).json({ error: `Senha incorreta. Tentativa ${a.count}/${MAX}.` });
  }

  a.count = 0;
  return res.status(200).json({ ok: true, token: sessionToken });
}
