// KU Sriracha Life — online server (one shared world, max 100 players).
// Serves the game from /public, relays player state, chat and runs the authoritative economy.
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Server } = require('socket.io');

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const SAVE_FILE = path.join(DATA_DIR, 'players.json');
const MAX_PLAYERS = 100;

(async () => {
  const cat = await import('./public/shared/catalog.js');
  const eco = await import('./public/shared/economy.js');

  fs.mkdirSync(DATA_DIR, { recursive: true });
  let db = {};
  try { db = JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8')); } catch (e) { db = {}; }
  let dirty = false;
  function persist() {
    if (!dirty) return; dirty = false;
    const tmp = SAVE_FILE + '.tmp';
    try { fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, SAVE_FILE); } catch (e) { console.error('save failed', e.message); }
  }
  setInterval(persist, 5000);

  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });
  app.get('/api/health', (req, res) => res.json({ ok: true, players: players.size, max: MAX_PLAYERS }));
  // Game code/data revalidate on every load (ETag → cheap 304s) so an update never mixes old and new files in the
  // browser cache; only the versioned three.js vendor folder is cached long-term.
  app.use(express.static(path.join(__dirname, 'public'), { etag: true, lastModified: true, setHeaders(res, p) { res.setHeader('Cache-Control', /[\\/]vendor[\\/]/.test(p) ? 'public, max-age=604800, immutable' : 'no-cache'); } }));
  const server = http.createServer(app);
  const io = new Server(server, { maxHttpBufferSize: 64 * 1024, pingInterval: 10000, pingTimeout: 15000, cors: { origin: true } });

  const players = new Map(); // socket.id -> { id, key, profile, st, memo, chatAt }
  const chatLog = [];
  const gameDay = () => cat.gameTime(Date.now()).day;
  const keyOf = (token) => crypto.createHash('sha256').update(String(token)).digest('hex').slice(0, 32);
  const pub = (pl) => ({ id: pl.id, name: pl.profile.name, look: pl.profile.look, level: pl.profile.level, faculty: pl.profile.faculty });
  const sys = (text) => { const m = { id: 0, name: 'KU', text, t: Date.now(), sys: true }; chatLog.push(m); if (chatLog.length > 40) chatLog.shift(); io.emit('chat', m); };
  const clean = (s, n) => String(s || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

  io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (typeof token !== 'string' || !/^[a-f0-9]{32,64}$/.test(token)) return next(new Error('bad token'));
    socket.data.key = keyOf(token); next();
  });

  io.on('connection', (socket) => {
    const key = socket.data.key;
    // one session per token: kick older
    for (const [sid, pl] of players) if (pl.key === key) { const old = io.sockets.sockets.get(sid); if (old) { old.emit('kick', { reason: 'Logged in from another tab' }); old.disconnect(true); } }
    let me = null;
    socket.on('hello', (hello) => {
      if (me) { socket.emit('welcome', welcomePayload()); return; }
      if (players.size >= MAX_PLAYERS) { socket.emit('full', { max: MAX_PLAYERS }); socket.disconnect(true); return; }
      const profile = db[key] || null;
      me = { id: crypto.randomBytes(4).toString('hex'), key, profile, st: null, memo: {}, chatAt: 0, chatCount: 0 };
      players.set(socket.id, me);
      socket.emit('welcome', welcomePayload());
      if (profile) announce();
    });
    function welcomePayload() {
      return { id: me.id, serverTime: Date.now(), profile: me.profile, players: [...players.values()].filter(p => p !== me && p.profile).map(pub), chat: chatLog, online: players.size, max: MAX_PLAYERS };
    }
    function announce() { socket.broadcast.emit('pjoin', pub(me)); io.emit('online', players.size); sys(`${me.profile.name} joined KU Sriracha`); }
    socket.on('create', (data, ack) => {
      if (!me || typeof ack !== 'function') return;
      if (me.profile) return ack({ ok: true, profile: me.profile });
      const p = eco.newProfile({ name: clean(data && data.name, 18) || 'Student', look: data && data.look, faculty: clean(data && data.faculty, 8), program: clean(data && data.program, 60) });
      eco.sanitizeSave(p, data || {});
      db[key] = p; dirty = true; me.profile = p; ack({ ok: true, profile: p }); announce();
    });
    socket.on('save', (data) => { if (!me || !me.profile) return; const oldLook = JSON.stringify(me.profile.look); eco.sanitizeSave(me.profile, data); dirty = true; if (JSON.stringify(me.profile.look) !== oldLook || data.levelChanged) socket.broadcast.emit('pinfo', pub(me)); });
    socket.on('state', (s) => {
      if (!me || !me.profile || !Array.isArray(s) || s.length < 6) return;
      for (let i = 0; i < 6; i++) if (!Number.isFinite(+s[i])) return;
      me.st = s.slice(0, 12); me.stAt = Date.now();
    });
    const econ = (fn) => (data, ack) => { if (!me || !me.profile || typeof ack !== 'function') return; let r; try { r = fn(data || {}); } catch (e) { r = { ok: false, err: 'Error' }; } if (r && r.ok) dirty = true; ack({ ...r, money: me.profile.money, profile: r && r.ok ? { wardrobe: me.profile.wardrobe, vehicles: me.profile.vehicles, inventory: me.profile.inventory, hairs: me.profile.hairs, claimed: me.profile.claimed } : undefined }); };
    socket.on('buy', econ((d) => eco.applyBuy(me.profile, d)));
    socket.on('earn', econ((d) => eco.applyEarn(me.profile, d, me.memo)));
    socket.on('claim', econ((d) => eco.applyClaim(me.profile, d, gameDay())));
    socket.on('allowance', econ(() => eco.applyAllowance(me.profile, gameDay())));
    socket.on('transfer', econ((d) => {
      const amt = Math.floor(Number(d.amount) || 0); if (amt < 1 || amt > 1e7) return { ok: false, err: 'Invalid amount' };
      if (me.profile.money < amt) return { ok: false, err: 'Not enough money' };
      const target = [...players.entries()].find(([, p]) => p.id === d.to && p.profile); if (!target) return { ok: false, err: 'Player offline' };
      const [tsid, tp] = target; if (tp === me) return { ok: false, err: 'That is you' };
      me.profile.money -= amt; tp.profile.money += amt;
      io.to(tsid).emit('money', { money: tp.profile.money, delta: amt, from: me.profile.name });
      return { ok: true, amount: amt };
    }));
    socket.on('chat', (text) => {
      if (!me || !me.profile) return; const now = Date.now();
      if (now - me.chatAt < 900) return; me.chatAt = now;
      const t = clean(text, 140); if (!t) return;
      const m = { id: me.id, name: me.profile.name, text: t, t: now }; chatLog.push(m); if (chatLog.length > 40) chatLog.shift(); io.emit('chat', m);
    });
    socket.on('ping', (_, ack) => { if (typeof ack === 'function') ack(Date.now()); });
    socket.on('disconnect', () => {
      players.delete(socket.id);
      if (me && me.profile) { io.emit('pleave', me.id); io.emit('online', players.size); }
      dirty = true;
    });
  });

  // 10 Hz snapshots
  setInterval(() => {
    if (!players.size) return; const now = Date.now(); const arr = [];
    for (const p of players.values()) if (p.st && p.profile && now - p.stAt < 5000) arr.push([p.id, ...p.st]);
    io.volatile.emit('snap', { t: now, p: arr });
  }, 100);

  const shutdown = () => { dirty = true; persist(); process.exit(0); };
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
  server.listen(PORT, () => console.log(`KU Sriracha Life running on http://localhost:${PORT}  (max ${MAX_PLAYERS} players)`));
})();
