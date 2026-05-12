// Sistema de salas CTF multiplayer via polling
const rooms = {};
const MAX_ROOMS = 50;
const ROOM_TTL = 2 * 60 * 60 * 1000; // 2h

function cleanRooms() {
  const now = Date.now();
  for (const id in rooms) {
    if (now - rooms[id].updatedAt > ROOM_TTL) delete rooms[id];
  }
}

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Access-Control-Allow-Origin', '*');
  cleanRooms();

  const { action, token } = req.body || req.query;
  if (!token || token !== process.env.SESSION_TOKEN) return res.status(401).json({ error: 'Não autorizado' });

  if (req.method === 'GET') {
    // Polling: buscar mensagens e estado da sala
    const { roomId, since } = req.query;
    if (!roomId || !rooms[roomId]) return res.status(404).json({ error: 'Sala não encontrada' });
    const room = rooms[roomId];
    const sinceTs = parseInt(since) || 0;
    const newMessages = room.messages.filter(m => m.ts > sinceTs);
    return res.status(200).json({ room: { ...room, messages: newMessages }, ok: true });
  }

  const body = req.body;

  if (body.action === 'create') {
    if (Object.keys(rooms).length >= MAX_ROOMS) return res.status(429).json({ error: 'Limite de salas atingido' });
    const id = Math.random().toString(36).slice(2, 8).toUpperCase();
    rooms[id] = {
      id, name: body.name || `CTF Room ${id}`,
      challenge: body.challenge || 'Desafio livre',
      createdAt: Date.now(), updatedAt: Date.now(),
      users: [], messages: [], progress: {}, solved: false
    };
    return res.status(200).json({ roomId: id, room: rooms[id] });
  }

  if (body.action === 'join') {
    const room = rooms[body.roomId];
    if (!room) return res.status(404).json({ error: 'Sala não encontrada' });
    if (!room.users.find(u => u.id === body.userId)) {
      room.users.push({ id: body.userId, name: body.userName, joinedAt: Date.now(), points: 0 });
      room.messages.push({ ts: Date.now(), type: 'system', text: `🟢 ${body.userName} entrou na sala` });
    }
    room.updatedAt = Date.now();
    return res.status(200).json({ ok: true, room });
  }

  if (body.action === 'message') {
    const room = rooms[body.roomId];
    if (!room) return res.status(404).json({ error: 'Sala não encontrada' });
    const msg = { ts: Date.now(), type: 'chat', userId: body.userId, userName: body.userName, text: String(body.text).slice(0, 500) };
    room.messages.push(msg);
    if (room.messages.length > 200) room.messages = room.messages.slice(-200);
    room.updatedAt = Date.now();
    return res.status(200).json({ ok: true });
  }

  if (body.action === 'submit_flag') {
    const room = rooms[body.roomId];
    if (!room) return res.status(404).json({ error: 'Sala não encontrada' });
    const correct = body.flag?.toLowerCase().trim() === (room.solution || '').toLowerCase().trim();
    if (correct) {
      room.solved = true;
      const user = room.users.find(u => u.id === body.userId);
      if (user) user.points += 100;
      room.messages.push({ ts: Date.now(), type: 'system', text: `🏆 ${body.userName} resolveu o desafio! +100 pontos` });
    }
    room.updatedAt = Date.now();
    return res.status(200).json({ correct, message: correct ? '🎉 Flag correta!' : '❌ Flag incorreta. Tente novamente!' });
  }

  if (body.action === 'leave') {
    const room = rooms[body.roomId];
    if (room) {
      room.users = room.users.filter(u => u.id !== body.userId);
      room.messages.push({ ts: Date.now(), type: 'system', text: `🔴 ${body.userName} saiu da sala` });
      room.updatedAt = Date.now();
    }
    return res.status(200).json({ ok: true });
  }

  if (body.action === 'list') {
    const list = Object.values(rooms).map(r => ({ id: r.id, name: r.name, users: r.users.length, solved: r.solved, challenge: r.challenge.slice(0, 80) }));
    return res.status(200).json({ rooms: list });
  }

  return res.status(400).json({ error: 'Ação inválida' });
}
