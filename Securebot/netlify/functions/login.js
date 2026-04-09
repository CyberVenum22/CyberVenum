const ATTEMPTS = {};
const MAX = 5;
const LOCK = 30 * 1000;

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const ip = event.headers['x-forwarded-for'] || 'unknown';
  const now = Date.now();

  if (!ATTEMPTS[ip]) ATTEMPTS[ip] = { count: 0, locked: 0 };
  const a = ATTEMPTS[ip];

  if (now < a.locked) {
    return { statusCode: 429, headers, body: JSON.stringify({ error: 'Bloqueado temporariamente.' }) };
  }

  let body;
  try { body = JSON.parse(event.body); } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Body inválido' }) };
  }

  const { password } = body;
  const correctPassword = process.env.ACCESS_PASSWORD;

  if (!password || !correctPassword) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Parâmetros inválidos' }) };
  }

  if (password !== correctPassword) {
    a.count++;
    if (a.count >= MAX) { a.locked = now + LOCK; a.count = 0; }
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Senha incorreta' }) };
  }

  a.count = 0;
  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
};
