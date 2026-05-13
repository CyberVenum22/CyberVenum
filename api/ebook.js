const RATE_LIMIT = {};
const BOOK_STORE = {}; // Armazena chunks do livro por sessão
const BOOK_TTL = 2 * 60 * 60 * 1000; // 2 horas

function getRateLimit(ip) {
  const now = Date.now();
  if (!RATE_LIMIT[ip] || now - RATE_LIMIT[ip].start > 60000) {
    RATE_LIMIT[ip] = { count: 1, start: now };
    return false;
  }
  RATE_LIMIT[ip].count++;
  return RATE_LIMIT[ip].count > 30;
}

function cleanOldBooks() {
  const now = Date.now();
  for (const key in BOOK_STORE) {
    if (now - BOOK_STORE[key].createdAt > BOOK_TTL) delete BOOK_STORE[key];
  }
}

// Divide texto em chunks de ~6000 chars com overlap
function chunkText(text, size = 6000, overlap = 500) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + size));
    i += size - overlap;
  }
  return chunks;
}

// Busca chunks mais relevantes para a pergunta
function findRelevantChunks(chunks, question, maxChunks = 4) {
  const words = question.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3);

  const scored = chunks.map((chunk, idx) => {
    const lower = chunk.toLowerCase();
    let score = 0;
    for (const word of words) {
      const matches = (lower.match(new RegExp(word, 'g')) || []).length;
      score += matches;
    }
    return { idx, chunk, score };
  });

  // Sempre inclui o começo do livro (contexto)
  const topChunks = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxChunks)
    .sort((a, b) => a.idx - b.idx);

  // Garante que o chunk 0 (início) está incluído se não foi selecionado
  if (!topChunks.find(c => c.idx === 0) && chunks.length > 0) {
    topChunks.unshift({ idx: 0, chunk: chunks[0], score: 0 });
    if (topChunks.length > maxChunks) topChunks.pop();
  }

  return topChunks.map(c => c.chunk);
}

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  if (getRateLimit(ip)) return res.status(429).json({ error: 'Muitas requisições.' });

  const { action, token, sessionId } = req.body;
  if (!token || token !== process.env.SESSION_TOKEN) return res.status(401).json({ error: 'Não autorizado' });

  cleanOldBooks();

  // ── UPLOAD: recebe o texto extraído do PDF/DOC ──────────────────────
  if (action === 'upload') {
    const { text, filename, totalChars } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Texto inválido ou vazio' });
    }

    if (text.length > 500000) {
      return res.status(400).json({ error: 'Arquivo muito grande. Máximo 500.000 caracteres.' });
    }

    const chunks = chunkText(text);
    const bookId = sessionId || `book_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    BOOK_STORE[bookId] = {
      filename: filename || 'documento',
      text: text.slice(0, 2000), // resumo do início
      chunks,
      totalChars: totalChars || text.length,
      createdAt: Date.now(),
      wordCount: text.split(/\s+/).length
    };

    // Gera resumo inicial via Groq
    try {
      const introText = text.slice(0, 4000);
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 600,
          messages: [
            { role: 'system', content: 'Você é um assistente especialista em análise de documentos. Responda em português brasileiro.' },
            { role: 'user', content: `Analise o início deste documento e forneça: 1) Título provável, 2) Assunto principal (2-3 frases), 3) Principais tópicos que serão abordados (lista de 5-8 itens), 4) Público-alvo. Seja conciso.\n\nINÍCIO DO DOCUMENTO:\n${introText}` }
          ]
        }),
        signal: AbortSignal.timeout(15000)
      });

      if (r.ok) {
        const data = await r.json();
        BOOK_STORE[bookId].summary = data.choices?.[0]?.message?.content || '';
      }
    } catch {}

    return res.status(200).json({
      bookId,
      filename: BOOK_STORE[bookId].filename,
      chunks: chunks.length,
      totalChars: text.length,
      wordCount: BOOK_STORE[bookId].wordCount,
      summary: BOOK_STORE[bookId].summary || 'Documento carregado com sucesso!'
    });
  }

  // ── CHAT: responde perguntas sobre o livro ──────────────────────────
  if (action === 'chat') {
    const { bookId, question, history = [] } = req.body;

    if (!bookId || !BOOK_STORE[bookId]) {
      return res.status(404).json({ error: 'Documento não encontrado. Faça o upload novamente.' });
    }

    if (!question || question.trim().length < 2) {
      return res.status(400).json({ error: 'Pergunta inválida' });
    }

    const book = BOOK_STORE[bookId];
    const relevantChunks = findRelevantChunks(book.chunks, question);
    const context = relevantChunks.join('\n\n---\n\n');

    const systemPrompt = `Você é Cyber Venum, assistente especialista criado por Aleff da ProxyBT. Responda SEMPRE em português brasileiro.

Você está analisando o documento: "${book.filename}"
Total: ${book.wordCount.toLocaleString()} palavras, ${book.chunks.length} seções

INSTRUÇÕES:
- Responda APENAS com base no conteúdo do documento fornecido
- Se a informação não estiver no documento, diga claramente
- Cite seções ou trechos relevantes quando possível
- Seja detalhado e didático
- Para conceitos complexos, explique passo a passo
- Se pedir resumo, seja completo mas objetivo

TRECHO(S) RELEVANTE(S) DO DOCUMENTO:
${context}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6).map(m => ({ role: m.role, content: String(m.content).slice(0, 3000) })),
      { role: 'user', content: question }
    ];

    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 2048,
          messages
        }),
        signal: AbortSignal.timeout(25000)
      });

      if (!r.ok) {
        const err = await r.text().catch(() => '');
        return res.status(502).json({ error: 'Erro no modelo: ' + err.slice(0, 100) });
      }

      const data = await r.json();
      const answer = data.choices?.[0]?.message?.content || 'Sem resposta.';
      return res.status(200).json({ answer, chunks_used: relevantChunks.length });

    } catch (e) {
      if (e.name === 'TimeoutError' || e.name === 'AbortError') {
        return res.status(504).json({ error: 'Tempo limite excedido. Tente uma pergunta mais curta.' });
      }
      return res.status(500).json({ error: 'Erro interno: ' + e.message });
    }
  }

  // ── INFO: retorna info do livro carregado ───────────────────────────
  if (action === 'info') {
    const { bookId } = req.body;
    if (!bookId || !BOOK_STORE[bookId]) return res.status(404).json({ error: 'Documento não encontrado' });
    const book = BOOK_STORE[bookId];
    return res.status(200).json({
      filename: book.filename,
      chunks: book.chunks.length,
      wordCount: book.wordCount,
      totalChars: book.totalChars,
      summary: book.summary
    });
  }

  // ── FULL SUMMARY: resumo completo do documento ──────────────────────
  if (action === 'full_summary') {
    const { bookId } = req.body;
    if (!bookId || !BOOK_STORE[bookId]) return res.status(404).json({ error: 'Documento não encontrado' });

    const book = BOOK_STORE[bookId];
    // Usa os primeiros e últimos chunks + alguns do meio para resumo global
    const totalChunks = book.chunks.length;
    const selectedChunks = [];

    // Primeiros 2 chunks
    for (let i = 0; i < Math.min(2, totalChunks); i++) selectedChunks.push(book.chunks[i]);
    // Meio
    const mid = Math.floor(totalChunks / 2);
    if (mid > 2) selectedChunks.push(book.chunks[mid]);
    // Últimos 2
    for (let i = Math.max(totalChunks - 2, 0); i < totalChunks; i++) {
      if (!selectedChunks.includes(book.chunks[i])) selectedChunks.push(book.chunks[i]);
    }

    const context = selectedChunks.join('\n\n---\n\n');

    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 2048,
          messages: [
            { role: 'system', content: 'Você é Cyber Venum, assistente especialista criado por Aleff da ProxyBT. Responda em português brasileiro.' },
            { role: 'user', content: `Faça um resumo COMPLETO e DETALHADO do documento "${book.filename}". Inclua: 1) Visão geral, 2) Capítulos/seções principais com seus conteúdos, 3) Conceitos-chave explicados, 4) Conclusões e pontos mais importantes.\n\nCONTEÚDO:\n${context}` }
          ]
        }),
        signal: AbortSignal.timeout(25000)
      });

      const data = await r.json();
      return res.status(200).json({ answer: data.choices?.[0]?.message?.content || 'Sem resumo.' });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(400).json({ error: 'Ação inválida' });
}
