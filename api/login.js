const crypto = require('crypto');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { password } = req.body;
  const correctPassword = process.env.ACCESS_PASSWORD;
  const sessionToken = process.env.SESSION_TOKEN;

  const bufferPass = Buffer.from(password || "");
  const bufferCorrect = Buffer.from(correctPassword || "");

  if (bufferPass.length === bufferCorrect.length && crypto.timingSafeEqual(bufferPass, bufferCorrect)) {
    return res.status(200).json({ ok: true, token: sessionToken });
  }

  return res.status(401).json({ error: 'Senha incorreta' });
}
