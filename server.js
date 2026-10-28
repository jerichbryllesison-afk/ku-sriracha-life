// KU Sriracha Life — online server (one shared world, max 100 players).
// Serves the game from /public, relays player state and chat, and runs the AUTHORITATIVE economy on an embedded
// SQLite database (created automatically — no external service, no setup). See docs/DATABASE.md.
'use strict';
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Server } = require('socket.io');
const { openStore } = require('./server/storage/store');
const { detect } = require('./server/storage/mode');
const { makeRules } = require('./server/rules');
const { loadAdminKey, makeAdmin } = require('./server/admin');
const { makeLife } = require('./server/life');
const { makeSocial } = require('./server/social');
const { makeLife2 } = require('./server/life2');
const { makeEvents } = require('./server/events');

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const MAX_PLAYERS = 100;
const BACKUP_EVERY_MS = 6 * 3600e3;
const CONNECTS_PER_MIN = Number(process.env.CONNECTS_PER_MIN) || 40;
const CREATES_PER_HOUR = Number(process.env.CREATES_PER_HOUR) || 10;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

(async () => {
  const cat = await import('./public/shared/catalog.js');
  const eco = await import('./public/shared/economy.js');
  const { PLACE } = await import('./public/js/places.js');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const storage = detect(process.env, DATA_DIR, __dirname);

  // ---------------- database ----------------
  let store;
  try { store = openStore({ dataDir: DATA_DIR, eco, cat, log }); }
  catch (e) { console.error('\n[db] FATAL — the database could not be opened, so the server will not start (no silent data loss).\n     ' + e.message + '\n'); process.exit(1); }
  const PID_FILE = path.join(DATA_DIR, 'server.pid'); try { fs.writeFileSync(PID_FILE, String(process.pid)); } catch (e) { }
  log(`[db] ${store.engine} (SQLite ${store.sqliteVersion}) → ${store.file}`);
  log(`[db] storage mode: ${storage.mode.toUpperCase()} (host: ${storage.host})`);
  for (const w of storage.warnings) log('[db] WARNING: ' + w);
  { const c = store.counts(); log(`[db] ${c.characters} character(s), ${c.ledger} ledger row(s)`); if (c.accounts) { const b = store.backup('startup', 5); log(`[db] startup backup ${b.ok ? 'verified' : 'FAILED'} → ${path.relative(__dirname, b.file)}`); } }
  const rules = makeRules(cat, eco);
  const worldSeed = Number(store.kvGet('world_seed')) || 1;
  let lastWriteError = null;

  // ---------------- state ----------------
  const players = new Map(); // socket.id -> session object (me)
  const memos = new Map();   // accountId -> cooldown/job memo (survives reconnects, not restarts)
  const memOf = (id) => { if (!id) return {}; let m = memos.get(id); if (!m) { m = {}; memos.set(id, m); } return m; };
  const chatLog = [];
  const gameDay = () => cat.gameTime(Date.now()).day;
  const keyOf = (token) => crypto.createHash('sha256').update(String(token)).digest('hex').slice(0, 32);
  const pub = (pl) => ({ id: pl.id, name: pl.profile.name, look: pl.profile.look, level: pl.profile.level, faculty: pl.profile.faculty, voice: !!pl.voice });
  const sys = (text) => { const m = { id: 0, name: 'KU', text, t: Date.now(), sys: true }; chatLog.push(m); if (chatLog.length > 40) chatLog.shift(); io.emit('chat', m); };
  const clean = (s, n) => String(s || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
  const playNow = (p, me) => Math.floor((p.playtime || 0) + (me && me.accAt ? (Date.now() - me.accAt) / 1000 : 0));
  // the server-owned part of a profile, sent after every authoritative change
  const snap = (p, me) => ({ money: p.money, xp: p.xp, level: p.level, main: p.quests.main, inventory: p.inventory, wardrobe: p.wardrobe, hairs: p.hairs, vehicles: p.vehicles, lastAllowanceDay: p.lastAllowanceDay, txlog: p.txlog, name: p.name, playtime: playNow(p, me), home: p.home, biz: p.biz, uid: me && me.accountId });
  const clientProfile = (p, me) => { const { _claims, claimed, nameChangedAt, ...rest } = p; return { ...rest, playtime: playNow(p, me) }; };
  const ridOk = (r) => typeof r === 'string' && /^[A-Za-z0-9_-]{8,48}$/.test(r) ? r : null;

  // Run one authoritative operation: mutate a clone → commit atomically → only then swap the cached profile and ack.
  function runOp(me, op, rid, fn, txFn) {
    rid = ridOk(rid);
    if (rid) { const prev = store.replay(me.accountId, rid); if (prev) return { ...prev.result, replay: true, me: snap(me.profile, me) }; }
    const before = me.profile; const after = structuredClone(before);
    let r; try { r = fn(after); } catch (e) { log('[op] error', op, e.message); return { ok: false, err: 'Server error', me: snap(before, me) }; }
    if (!r || !r.ok) return { ok: false, err: (r && r.err) || 'Rejected', me: snap(before, me) };
    const { ledger, claims, extra, ...result } = r;
    const changes = [{ id: me.accountId, before, after, ledger, claims }];
    for (const x of extra || []) changes.push({ id: x.owner.accountId, before: x.before, after: x.after, ledger: x.ledger, claims: x.claims });
    try { store.commit(changes, rid ? { id: me.accountId, rid, op, result } : null, txFn); }
    catch (e) {
      lastWriteError = { at: Date.now(), code: e.code, msg: e.message }; log('[db] commit rejected', op, e.code || '', e.message);
      return { ok: false, err: e.code === 'duplicate_claim' ? 'Already claimed' : e.code === 'duplicate_request' ? 'Duplicate request' : e.code === 'room_taken' ? e.message : 'Could not save — nothing was charged or paid. Try again.', me: snap(before, me) };
    }
    me.profile = after; for (const x of extra || []) x.owner.profile = x.after;
    return { ...result, me: snap(after, me) };
  }

  // ---------------- sessions & playtime ----------------
  function startSession(me, ua) {
    const now = Date.now();
    try { me.sessionId = store.sessionStart(me.accountId, now, ua); store.touchLogin(me.accountId, now); } catch (e) { log('[db] session start failed', e.message); }
    me.accAt = now; me.lastMoveAt = now; me.sessionStartedAt = now;
  }
  function sessionEntry(me, now, end) {
    const add = Math.max(0, Math.floor((now - me.accAt) / 1000)); const active = now - (me.lastMoveAt || 0) < 120e3 ? add : 0;
    return { id: me.accountId, sid: me.sessionId, addS: add, addActiveS: active, end, _me: me, _t: me.accAt + add * 1000 };
  }
  // owner-only plain-text player log: one CSV line per finished session (Asia/Bangkok time), data/logs/sessions-YYYY-MM.csv
  const LOG_DIR = path.join(DATA_DIR, 'logs');
  const bkk = (ms) => new Date(ms + 7 * 3600e3).toISOString().replace('T', ' ').slice(0, 19);
  function logSessionLine(me, now, reason) {
    try {
      if (!me.sessionStartedAt) return; fs.mkdirSync(LOG_DIR, { recursive: true });
      const f = path.join(LOG_DIR, `sessions-${bkk(now).slice(0, 7)}.csv`); const head = fs.existsSync(f) ? '' : 'player,account,faculty,level,login_bangkok,logout_bangkok,minutes,total_playtime_min,end_reason\n';
      const q = (s) => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
      fs.appendFileSync(f, head + [q(me.profile.name), me.accountId, me.profile.faculty, me.profile.level, bkk(me.sessionStartedAt), bkk(now), ((now - me.sessionStartedAt) / 60000).toFixed(1), Math.round((me.profile.playtime || 0) / 60), reason].join(',') + '\n');
    } catch (e) { log('[log] session line failed', e.message); }
  }
  function flushSessions(list, now) {
    if (!list.length) return;
    try { store.sessionTick(list, now); for (const e of list) { e._me.accAt = e._t; e._me.profile.playtime = (e._me.profile.playtime || 0) + e.addS; if (e.end) logSessionLine(e._me, now, e.end); } }
    catch (e) { lastWriteError = { at: now, code: 'session', msg: e.message }; log('[db] session tick failed', e.message); }
  }
  function flushData(force) {
    const list = []; for (const me of players.values()) if (me.profile && me.accountId && (me.dirty || force)) list.push({ id: me.accountId, p: me.profile, me });
    if (!list.length) return true;
    try { store.saveData(list); for (const x of list) x.me.dirty = false; return true; }
    catch (e) { lastWriteError = { at: Date.now(), code: 'save', msg: e.message }; log('[db] save failed (will retry)', e.message); return false; }
  }
  setInterval(() => flushData(false), 5000);
  setInterval(() => { const now = Date.now(); flushSessions([...players.values()].filter(m => m.profile && m.sessionId).map(m => sessionEntry(m, now, null)), now); }, 60e3);
  setInterval(() => { try { store.prune(); const b = store.backup('auto', 8); log(`[db] scheduled backup ${b.ok ? 'verified' : 'FAILED'}`); } catch (e) { log('[db] scheduled backup failed', e.message); } }, BACKUP_EVERY_MS);

  // ---------------- http ----------------
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'same-origin'); next(); });
  let healthCache = { t: 0, ok: true };
  app.get('/api/health', (req, res) => {
    if (Date.now() - healthCache.t > 30e3) healthCache = { t: Date.now(), ok: store.integrity() };
    res.json({ ok: healthCache.ok, players: players.size, max: MAX_PLAYERS, db: { engine: store.engine, ok: healthCache.ok, lastWriteError: lastWriteError ? { at: lastWriteError.at, code: lastWriteError.code } : null }, storage: { mode: storage.mode, persistent: storage.persistent, host: storage.host, note: storage.note_en } });
  });
  const adminKey = loadAdminKey({ env: process.env, dataDir: DATA_DIR, storage, log });
  const server = http.createServer(app);
  const io = new Server(server, { maxHttpBufferSize: 64 * 1024, pingInterval: 10000, pingTimeout: 15000, cors: { origin: true } });
  const admin = makeAdmin({ store, rules, cat, io, players, runOp, snap, clientProfile, sys, log, storage, keyInfo: adminKey, uiFile: path.join(__dirname, 'server', 'admin-ui.js'), pub });
  admin.routes(app);
  const life = makeLife({ cat, PLACE, store, players, io, runOp, snap, log, rules }); rules.ext = life;
  const social = makeSocial({ store, players, io, log, cat }); social.routes(app);
  try { life.recoverOrders(); } catch (e) { log('[orders] recover failed', e.message); }
  setInterval(() => life.tickOrders(), 5000);
  const life2 = makeLife2({ cat, PLACE, store, players, io, runOp, snap, log, rules });
  try { life2.recoverRides(); } catch (e) { log('[rides] recover failed', e.message); }
  const events = makeEvents({ cat, PLACE, players, io, runOp, rules, log }); admin.events = events;
  setInterval(() => { life2.tickParcels(); life2.tickRides(); events.tick(); }, 5000);
  if (adminKey && adminKey.source === 'file') log(`[admin] owner trainer key (keep it secret): ${adminKey.key}\n         saved in ${path.relative(__dirname, adminKey.file)} · in game chat type:  /admin <key>`);
  else if (adminKey) log('[admin] owner trainer enabled (ADMIN_KEY from environment)');
  // Game code/data revalidate on every load (ETag → cheap 304s); only the versioned three.js vendor folder is cached long-term.
  app.use(express.static(path.join(__dirname, 'public'), { etag: true, lastModified: true, setHeaders(res, p) { res.setHeader('Cache-Control', /[\\/]vendor[\\/]/.test(p) ? 'public, max-age=604800, immutable' : 'no-cache'); } }));

  // ---------------- per-IP limits (in memory; IPs are never stored) ----------------
  const trustProxy = !!(process.env.RENDER || process.env.TRUST_PROXY);
  const ipOf = (socket) => { const xf = trustProxy && socket.handshake.headers['x-forwarded-for']; return String(xf ? xf.split(',')[0] : socket.handshake.address || '').trim(); };
  const ipHits = new Map(); const ipCreates = new Map();
  const hit = (map, ip, windowMs, max) => { const now = Date.now(); const a = (map.get(ip) || []).filter(t => now - t < windowMs); if (a.length >= max) { map.set(ip, a); return false; } a.push(now); map.set(ip, a); return true; };
  setInterval(() => { const now = Date.now(); for (const m of [ipHits, ipCreates]) for (const [k, a] of m) if (!a.length || now - a[a.length - 1] > 3600e3) m.delete(k); }, 600e3);
  const bucket = (me, rate = 8, burst = 20) => { const now = Date.now(); const b = me.bucket || (me.bucket = { t: now, n: burst }); b.n = Math.min(burst, b.n + (now - b.t) / 1000 * rate); b.t = now; if (b.n < 1) return false; b.n--; return true; };

  io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (typeof token !== 'string' || !/^[a-f0-9]{32,64}$/.test(token)) return next(new Error('bad token'));
    if (!hit(ipHits, ipOf(socket), 60e3, CONNECTS_PER_MIN)) return next(new Error('rate limited'));
    socket.data.key = keyOf(token); next();
  });

  io.on('connection', (socket) => {
    const key = socket.data.key;
    // one session per account: the older tab is closed
    for (const [sid, pl] of players) if (pl.key === key) { const old = io.sockets.sockets.get(sid); pl.endReason = 'replaced'; if (old) { old.emit('kick', { reason: 'Logged in from another tab' }); old.disconnect(true); } }
    let me = null;
    socket.on('hello', () => {
      if (me) { socket.emit('welcome', welcomePayload()); return; }
      if (players.size >= MAX_PLAYERS) { socket.emit('full', { max: MAX_PLAYERS }); socket.disconnect(true); return; }
      let acc = null, profile = null;
      try { acc = store.accountByToken(key); profile = acc ? store.loadProfile(acc.id) : null; }
      catch (e) { log('[db] load failed', e.message); socket.emit('kick', { reason: 'Server storage error — please try again shortly' }); socket.disconnect(true); return; }
      if (acc && acc.banned) { socket.emit('kick', { reason: 'Banned' }); socket.disconnect(true); return; }
      me = { id: crypto.randomBytes(4).toString('hex'), sid: socket.id, key, accountId: acc ? acc.id : null, profile, st: null, mem: memOf(acc && acc.id), chatAt: 0, mutedUntil: acc ? Number(acc.muted_until) : 0, ip: ipOf(socket) };
      players.set(socket.id, me);
      if (profile) { startSession(me, socket.handshake.headers['user-agent']); life.starterKit(me); }
      socket.emit('welcome', welcomePayload());
      if (profile) announce();
    });
    function welcomePayload() {
      return { id: me.id, serverTime: Date.now(), profile: me.profile ? clientProfile(me.profile, me) : null, players: [...players.values()].filter(p => p !== me && p.profile).map(pub), chat: chatLog, online: players.size, max: MAX_PLAYERS, storage: { mode: storage.mode, persistent: storage.persistent, host: storage.host, en: storage.note_en, th: storage.note_th }, world: { seed: worldSeed }, event: events.current() };
    }
    function announce() { socket.broadcast.emit('pjoin', pub(me)); io.emit('online', players.size); sys(`${me.profile.name} joined KU Sriracha`); }
    socket.on('create', (data, ack) => {
      if (!me || typeof ack !== 'function') return;
      if (me.profile) return ack({ ok: true, profile: clientProfile(me.profile, me) });
      if (!hit(ipCreates, me.ip, 3600e3, CREATES_PER_HOUR)) return ack({ ok: false, err: 'Too many new characters from this network — try again later' });
      const d = data && typeof data === 'object' ? data : {};
      const p = eco.newProfile({ name: clean(d.name, 18) || 'Student', faculty: clean(d.faculty, 8), program: clean(d.program, 60) });
      rules.applyClientState(p, { look: d.look, faculty: d.faculty, program: d.program }, {}, Date.now()); // only cosmetic fields are taken from the client
      try {
        if (!me.accountId) me.accountId = store.createAccount(key);
        store.createCharacter(me.accountId, p);
        me.profile = store.loadProfile(me.accountId); me.mem = memOf(me.accountId);
      } catch (e) { log('[db] create failed', e.message); lastWriteError = { at: Date.now(), code: 'create', msg: e.message }; return ack({ ok: false, err: 'Could not create your character (storage error). Please try again.' }); }
      startSession(me, socket.handshake.headers['user-agent']); life.starterKit(me);
      ack({ ok: true, profile: clientProfile(me.profile, me) }); announce();
    });
    socket.on('save', (data) => {
      if (!me || !me.profile || !data || typeof data !== 'object') return;
      const oldLook = JSON.stringify(me.profile.look); rules.applyClientState(me.profile, data, me.mem, Date.now()); me.dirty = true;
      if (JSON.stringify(me.profile.look) !== oldLook) socket.broadcast.emit('pinfo', pub(me));
    });
    socket.on('state', (s) => {
      if (!me || !me.profile || !Array.isArray(s) || s.length < 6) return;
      for (let i = 0; i < 6; i++) if (!Number.isFinite(+s[i])) return;
      if (Math.abs(s[0]) > 6000 || Math.abs(s[2]) > 6000) return;
      const st = s.slice(0, 12); if (me.st && (Math.abs(st[0] - me.st[0]) > 0.05 || Math.abs(st[2] - me.st[2]) > 0.05 || st[3] !== me.st[3])) me.lastMoveAt = Date.now();
      me.st = st; me.stAt = Date.now();
    });
    // authoritative RPCs: authenticated by the socket's account, rate-limited, validated, atomic
    const rpc = (name, fn, rate, burst) => socket.on(name, (data, ack) => {
      if (typeof ack !== 'function') return;
      if (!me || !me.profile) return ack({ ok: false, err: 'Not ready' });
      const bk = rate ? ((me.bks || (me.bks = {}))[name] || (me.bks[name] = {})) : me; // own limiter for throttled RPCs, shared one for the rest
      if (!bucket(bk, rate, burst)) return ack({ ok: false, err: 'Too many requests', me: snap(me.profile, me) });
      let r; try { r = fn(data && typeof data === 'object' ? data : {}, Date.now()); } catch (e) { log('[rpc] error', name, e.message); r = { ok: false, err: 'Server error' }; }
      ack(r);
    });
    rpc('sync', () => ({ ok: true, me: snap(me.profile, me) }));
    rpc('buy', (d) => runOp(me, 'buy', d.rid, (p) => rules.buy(p, d, me)));
    rpc('use', (d) => runOp(me, 'use', d.rid, (p) => rules.useItem(p, d)));
    rpc('claim', (d, now) => runOp(me, 'claim', d.rid, (p) => rules.claim(p, d, gameDay(), me.mem, now, me)));
    rpc('allowance', () => runOp(me, 'allowance', null, (p) => rules.allowance(p, gameDay())));
    rpc('xp', (d, now) => runOp(me, 'xp', null, (p) => rules.xp(p, d, me.mem, gameDay(), now)));
    rpc('job', (d, now) => {
      if (d.op === 'start') return rules.jobStart(me.profile, d, me.mem, now, me);
      if (d.op === 'step') return rules.jobStep(d, me.mem, now, me);
      if (d.op === 'cancel') { if (me.mem.jobs) me.mem.jobs.delete(String(d.jid)); return { ok: true }; }
      if (d.op === 'finish') { const t = me.mem.jobs && me.mem.jobs.get(String(d.jid || '')); if (t && t.job === 'p2p') return life.orderDeliver(me, String(d.jid), now); return runOp(me, 'job', 'job_' + String(d.jid || '').slice(0, 40), (p) => rules.jobFinish(p, d, me.mem, now, me)); }
      return { ok: false, err: 'Unknown job op' };
    });
    rpc('earn', () => ({ ok: false, err: 'The game was updated — please refresh the page' }));
    rpc('home', (d) => d.op === 'move' ? runOp(me, 'home', d.rid, (p) => life.moveHome(p, String(d.type || ''))) : { ok: true, home: me.profile.home });
    rpc('biz', (d) => d.op === 'buy' ? runOp(me, 'biz', d.rid, (p) => life.bizBuy(p, String(d.kind || ''))) : { ok: true, biz: me.profile.biz });
    rpc('hail', (d) => runOp(me, 'hail', d.rid, (p) => life.hail(p, d, me)), 1, 3);
    rpc('order', (d, now) => d.op === 'create' ? life.orderCreate(me, d) : d.op === 'accept' ? life.orderAccept(me, d, now) : d.op === 'cancel' ? life.orderCancel(me, d, now) : life.orderList(me), 4, 10);
    rpc('soc', (d, now) => social.handle(me, d, now), 6, 14);
    rpc('garage', (d) => runOp(me, 'garage', d.rid, (p) => life2.garage(p, d, me)), 2, 5);
    rpc('shop', (d) => d.op === 'buy' ? life2.shopOrder(me, d) : { ok: true, list: store.parcelsOf(me.accountId) }, 2, 5);
    rpc('fish', (d, now) => runOp(me, 'fish', null, (p) => life2.fish(p, d, me.mem, now, me, gameDay())), 1, 3);
    rpc('sellfish', (d) => runOp(me, 'sellfish', d.rid, (p) => life2.sellFish(p, d, me)), 1, 3);
    rpc('ride', (d, now) => d.op === 'request' ? life2.rideRequest(me, d) : d.op === 'accept' ? life2.rideAccept(me, d, now) : d.op === 'board' ? life2.rideBoard(me, d, now) : d.op === 'finish' ? life2.rideFinish(me, d, now) : d.op === 'cancel' ? life2.rideCancel(me, d, now) : life2.rideList(me), 4, 10);
    // proximity voice chat: the server only relays WebRTC signalling between players who are near each other
    socket.on('voice', (on) => { if (!me || !me.profile) return; const v = !!on; if (v === !!me.voice) return; me.voice = v; io.emit('pinfo', pub(me)); });
    socket.on('rtc', (m) => {
      if (!me || !me.profile || !m || typeof m !== 'object' || !['offer', 'answer', 'ice', 'bye'].includes(m.t)) return;
      if (!bucket(me.rtcB || (me.rtcB = {}), 40, 80)) return;
      const to = [...players.values()].find(p => p.id === m.to && p.profile); if (!to || !to.voice || !me.voice) return;
      if (m.t !== 'bye' && (!to.st || !me.st || Math.hypot(to.st[0] - me.st[0], to.st[2] - me.st[2]) > 90)) return;
      let size = 0; try { size = JSON.stringify(m.d || null).length; } catch (e) { return; } if (size > 16000) return;
      io.to(to.sid).emit('rtc', { from: me.id, t: m.t, d: m.d });
    }); // pre-database clients sent their own wage
    rpc('transfer', (d, now) => {
      const amt = Math.floor(Number(d.amount) || 0); if (amt < 1 || amt > 1e7) return { ok: false, err: 'Invalid amount' };
      if (now - (me.mem.transferAt || 0) < 3000) return { ok: false, err: 'Too fast' };
      if (me.profile.level < 3 && playNow(me.profile, me) < 1800) return { ok: false, err: 'Transfers unlock at level 3 or after 30 minutes of play' };
      const target = [...players.values()].find(p => p.id === d.to && p.profile); if (!target) return { ok: false, err: 'Player offline' };
      if (target === me || target.accountId === me.accountId) return { ok: false, err: 'That is you' };
      const r = runOp(me, 'transfer', d.rid, (p) => {
        if (p.money < amt) return { ok: false, err: 'Not enough money' };
        p.money -= amt; const tb = target.profile, ta = structuredClone(tb); ta.money += amt;
        return { ok: true, amount: amt, ledger: [{ delta: -amt, kind: 'transfer_out', cp: target.accountId }], claims: [], extra: [{ owner: target, before: tb, after: ta, ledger: [{ delta: amt, kind: 'transfer_in', cp: me.accountId }], claims: [] }] };
      });
      if (r.ok && !r.replay) { me.mem.transferAt = now; io.to(target.sid).emit('money', { money: target.profile.money, delta: amt, from: me.profile.name, me: snap(target.profile, target) }); }
      return r;
    });
    rpc('rename', (d, now) => {
      try { const name = store.rename(me.accountId, d.name, now); me.profile.name = name; socket.broadcast.emit('pinfo', pub(me)); return { ok: true, name }; }
      catch (e) { return { ok: false, err: e.code ? e.message : 'Could not change name' }; }
    }, 1, 3);
    // slash commands from the chat box (never broadcast)
    rpc('cmd', (d, now) => {
      const text = String(d.text || '').trim().slice(0, 300); const [c, ...args] = text.split(/\s+/);
      const unknown = { ok: true, msg: 'Unknown command. Type /help' };
      if (c === '/help') return { ok: true, msg: '/online · /playtime · /time' };
      if (c === '/online') return { ok: true, msg: `${players.size}/${MAX_PLAYERS} online` };
      if (c === '/playtime') { const s = playNow(me.profile, me); return { ok: true, msg: `${Math.floor(s / 3600)}h ${Math.floor(s / 60) % 60}m` }; }
      if (c === '/time') { const t = cat.gameTime(now); return { ok: true, msg: `Day ${t.day} · ${String(Math.floor(t.hour)).padStart(2, '0')}:${String(Math.floor(t.hour % 1 * 60)).padStart(2, '0')}` }; }
      if (c === '/admin') { if (admin.check(me, args.join(' '), now)) return { ok: true, msg: 'OK', ui: admin.unlock(me, now) }; return d.quiet ? { ok: false } : unknown; }
      return unknown;
    }, 2, 5);
    socket.on('adm', (d, ack) => { if (typeof ack !== 'function' || !me || !me.profile) return; if (!me.admin) return ack({ ok: false, err: 'Unknown command' }); ack(admin.handle(me, d && typeof d === 'object' ? d : {})); });
    socket.on('chat', (text) => {
      if (!me || !me.profile) return; const now = Date.now();
      if (now - me.chatAt < 900) return; me.chatAt = now;
      const t = clean(text, 140); if (!t || t[0] === '/') return; // commands are never broadcast
      if (me.mutedUntil && now < me.mutedUntil) { socket.emit('chat', { id: 0, name: 'KU', text: 'You are muted', t: now, sys: true }); return; }
      const m = { id: me.id, name: me.profile.name, text: t, t: now }; chatLog.push(m); if (chatLog.length > 40) chatLog.shift(); io.emit('chat', m);
    });
    // cosmetic sound events (e.g. horn): whitelisted, rate-limited, relayed only to players within hearing range
    socket.on('sfx', (k) => {
      if (!me || !me.profile || !me.st || k !== 'horn') return; const now = Date.now(); if (now - (me.sfxAt || 0) < 250) return; me.sfxAt = now;
      const x = me.st[0], z = me.st[2];
      for (const [sid, p] of players) { if (p === me || !p.st) continue; const dx = p.st[0] - x, dz = p.st[2] - z; if (dx * dx + dz * dz < 220 * 220) io.to(sid).volatile.emit('sfx', { id: me.id, k }); }
    });
    socket.on('ping', (_, ack) => { if (typeof ack === 'function') ack(Date.now()); });
    socket.on('disconnect', (reason) => {
      players.delete(socket.id);
      if (me && me.profile) {
        flushData(false);
        if (me.sessionId) flushSessions([sessionEntry(me, Date.now(), me.endReason || String(reason || 'disconnect').replace(/\s+/g, '_').slice(0, 32))], Date.now());
        io.emit('pleave', me.id); io.emit('online', players.size);
      }
    });
  });

  // 10 Hz snapshots
  setInterval(() => {
    if (!players.size) return; const now = Date.now(); const arr = [];
    for (const p of players.values()) if (p.st && p.profile && now - p.stAt < 5000) arr.push([p.id, ...p.st]);
    io.volatile.emit('snap', { t: now, p: arr });
  }, 100);

  let closing = false;
  const shutdown = (sig) => {
    if (closing) return; closing = true; log(`[server] ${sig} — saving and closing the database…`);
    const now = Date.now();
    flushData(true);
    flushSessions([...players.values()].filter(m => m.profile && m.sessionId).map(m => sessionEntry(m, now, 'server_shutdown')), now);
    store.close(); try { fs.unlinkSync(PID_FILE); } catch (e) { }
    log('[server] closed cleanly'); process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT')); process.on('SIGTERM', () => shutdown('SIGTERM')); process.on('SIGHUP', () => shutdown('SIGHUP'));
  server.listen(PORT, () => {
    log(`KU Sriracha Life running on http://localhost:${PORT}  (max ${MAX_PLAYERS} players)`);
    if (!storage.persistent) log('[db] ⚠ EPHEMERAL STORAGE — players are told their progress may be lost on restart.');
  });
})();
