// Owner-only trainer / admin tools.
// - The key never ships to clients. Source: ADMIN_KEY env var (24+ chars), or — on a local machine only — an auto-generated
//   key stored in data/admin-key.txt (git-ignored). On a cloud host without ADMIN_KEY, admin is disabled.
// - Unlock in game by typing `/admin <key>` in chat. Wrong keys get the same reply as any unknown command.
// - The trainer UI code is NOT in /public: it is served once, per unlocked session, from a random one-time URL.
// - Every admin action is written to the admin_log table.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function loadAdminKey({ env, dataDir, storage, log }) {
  if (env.ADMIN_KEY) {
    if (String(env.ADMIN_KEY).length < 24) { log('[admin] ADMIN_KEY is shorter than 24 characters — owner trainer DISABLED'); return null; }
    return { key: String(env.ADMIN_KEY), source: 'env' };
  }
  if (storage.host !== 'local') { log('[admin] owner trainer disabled on this host — set the ADMIN_KEY environment variable (24+ random characters) to enable it'); return null; }
  const file = path.join(dataDir, 'admin-key.txt');
  let key = null; try { key = fs.readFileSync(file, 'utf8').trim(); } catch (e) { }
  if (!key || key.length < 24) { key = crypto.randomBytes(24).toString('base64url'); fs.writeFileSync(file, key + '\n', { mode: 0o600 }); }
  return { key, source: 'file', file };
}

function makeAdmin(ctx) {
  const { store, rules, cat, io, players, runOp, snap, clientProfile, sys, log, storage, keyInfo, uiFile, pub } = ctx;
  const enabled = !!keyInfo;
  const keyHash = enabled ? crypto.createHash('sha256').update(keyInfo.key).digest() : null;
  const fails = new Map(); let globalFails = []; const uiTokens = new Map(); const tickets = new Map();

  function check(me, key, now) {
    if (!enabled || typeof key !== 'string' || key.length > 200) return false;
    const f = (fails.get(me.accountId) || []).filter(t => now - t < 15 * 60e3); globalFails = globalFails.filter(t => now - t < 60 * 60e3);
    if (f.length >= 5 || globalFails.length >= 50) return false; // locked out (silently)
    const ok = crypto.timingSafeEqual(crypto.createHash('sha256').update(key).digest(), keyHash);
    if (!ok) { f.push(now); fails.set(me.accountId, f); globalFails.push(now); store.adminLog('auth_fail', me.accountId, { name: me.profile && me.profile.name }); return false; }
    fails.delete(me.accountId); return true;
  }
  function unlock(me, now) {
    me.admin = true; const tok = crypto.randomBytes(24).toString('hex'); uiTokens.set(tok, { sid: me.sid, exp: now + 5 * 60e3 });
    store.adminLog('auth_ok', me.accountId, { name: me.profile && me.profile.name });
    return '/_k/' + tok + '.js';
  }
  function routes(app) {
    app.get('/_k/:file', (req, res) => {
      const m = /^([a-f0-9]{48})\.js$/.exec(req.params.file || ''); const t = m && uiTokens.get(m[1]);
      if (!t || Date.now() > t.exp || !players.has(t.sid) || !players.get(t.sid).admin) return res.status(404).end();
      uiTokens.delete(m[1]);
      res.setHeader('Cache-Control', 'no-store'); res.type('application/javascript'); res.send(fs.readFileSync(uiFile, 'utf8'));
    });
    // owner-only player log (CSV, Excel-friendly UTF-8 BOM, Asia/Bangkok time)
    app.get('/_k/log/:ticket', (req, res) => {
      const t = tickets.get(String(req.params.ticket || '')); tickets.delete(String(req.params.ticket || ''));
      if (!t || t.kind !== 'log' || Date.now() > t.exp || !players.has(t.sid) || !players.get(t.sid).admin) return res.status(404).end();
      const bkk = (ms) => ms ? new Date(Number(ms) + 7 * 3600e3).toISOString().replace('T', ' ').slice(0, 19) : '';
      const q = (s) => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
      const lines = ['\ufeff# KU Sriracha Life — player log (times: Asia/Bangkok)', '', 'PLAYERS', 'player,account,faculty,level,money,total_play_min,active_min,sessions,first_seen,last_login'];
      for (const r of store.playerSummary()) lines.push([q(r.name), r.acc, r.faculty, r.level, r.money, Math.round(r.play / 60), Math.round(r.active / 60), r.sessions, bkk(r.created), bkk(r.last)].join(','));
      lines.push('', 'SESSIONS', 'player,account,login,logout,minutes,end_reason,device');
      for (const s of store.sessionLog({ limit: 20000 })) { const end = s.ended_at || s.last_seen_at; lines.push([q(s.name), s.acc, bkk(s.started_at), s.ended_at ? bkk(s.ended_at) : 'online', ((end - s.started_at) / 60000).toFixed(1), s.end_reason || '', q(String(s.client || '').slice(0, 60))].join(',')); }
      store.adminLog('export_player_log', t.acc, {});
      res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Disposition', `attachment; filename="kusl-player-log-${bkk(Date.now()).slice(0, 10)}.csv"`); res.send(lines.join('\r\n'));
    });
    app.get('/_k/dl/:ticket', (req, res) => {
      const t = tickets.get(String(req.params.ticket || '')); tickets.delete(String(req.params.ticket || ''));
      if (!t || t.kind === 'log' || Date.now() > t.exp || !players.has(t.sid) || !players.get(t.sid).admin) return res.status(404).end();
      const tmp = path.join(store.backupDir, `export-${process.pid}-${Date.now()}.db`);
      try {
        const v = store.backupTo(tmp); if (!v.ok) { try { fs.unlinkSync(tmp); } catch (e) { } return res.status(500).send('Backup verification failed'); }
        store.adminLog('export_backup', t.acc, { bytes: v.bytes, accounts: v.accounts });
        res.download(tmp, `kusl-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.db`, () => { try { fs.unlinkSync(tmp); } catch (e) { } });
      } catch (e) { try { fs.unlinkSync(tmp); } catch (_) { } res.status(500).send('Backup failed'); }
    });
  }

  // ---------- targets ----------
  function resolve(me, t) {
    if (!t || t === 'me') return me;
    for (const p of players.values()) if ((p.id === t || p.accountId === t) && p.profile) return p;
    if (/^a[0-9a-f]{16}$/.test(t)) { const profile = store.loadProfile(t); if (profile) return { accountId: t, profile, mem: {}, offline: true, id: null }; }
    return null;
  }
  function notify(tp) { if (tp && !tp.offline && tp.sid) io.to(tp.sid).emit('me', snap(tp.profile, tp)); }
  const num = (v, a, b) => { v = Math.floor(Number(v)); return Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : null; };

  function handle(me, d, now = Date.now()) {
    if (!me.admin) return { ok: false, err: 'Unknown command' };
    const op = String(d.op || ''); const tp = ['players', 'find', 'announce', 'backup', 'backups', 'integrity', 'ticket', 'logticket', 'log', 'server', 'playerlog', 'hidepost', 'event'].includes(op) ? null : resolve(me, d.t);
    const needT = () => { if (!tp) throw new Error('Player not found'); };
    const audit = (detail) => store.adminLog(op, tp ? tp.accountId : null, detail);
    try {
      switch (op) {
        case 'players': return { ok: true, list: [...players.values()].filter(p => p.profile).map(p => ({ id: p.id, acc: p.accountId, name: p.profile.name, level: p.profile.level, money: p.profile.money, fac: p.profile.faculty, pos: p.st ? [Math.round(p.st[0]), Math.round(p.st[2])] : null, play: Math.round(p.profile.playtime || 0), admin: !!p.admin })) };
        case 'find': return { ok: true, list: store.findAccounts(String(d.q || '')) };
        case 'inspect': needT(); return { ok: true, profile: clientProfile(tp.profile), account: store.account(tp.accountId), ledger: store.ledgerFor(tp.accountId, 25), sessions: store.sessionsFor(tp.accountId, 12), playtime: store.playtime(tp.accountId), online: !tp.offline };
        case 'money': {
          needT(); const amt = num(d.amount, 0, 1e12); if (amt === null) return { ok: false, err: 'Invalid amount' };
          const r = runOp(tp, 'admin', null, (p) => { const delta = d.mode === 'set' ? amt - p.money : d.mode === 'take' ? -Math.min(amt, p.money) : amt; if (!delta) return { ok: false, err: 'No change' }; p.money += delta; return { ok: true, delta, ledger: [{ delta, kind: 'admin', ref: d.mode || 'add' }], claims: [] }; });
          if (r.ok) { audit({ mode: d.mode || 'add', amount: amt, delta: r.delta }); notify(tp); } return r;
        }
        case 'xp': {
          needT(); const n = num(d.n, 1, 1e7); if (!n) return { ok: false, err: 'Invalid XP' };
          const r = runOp(tp, 'admin', null, (p) => { const out = { ok: true, ledger: [], claims: [] }; rules.grantXP(p, n, out); return out; });
          if (r.ok) { audit({ xp: n }); notify(tp); } return r;
        }
        case 'level': {
          needT(); const L = num(d.level, 1, cat.MAX_LEVEL); if (!L) return { ok: false, err: 'Invalid level' };
          const r = runOp(tp, 'admin', null, (p) => { p.level = L; p.xp = 0; return { ok: true, ledger: [], claims: [] }; });
          if (r.ok) { audit({ level: L }); notify(tp); io.emit('pinfo', pub(tp)); } return r;
        }
        case 'give': {
          needT(); const kind = String(d.kind), id = String(d.id || '');
          const r = runOp(tp, 'admin', null, (p) => {
            if (kind === 'item') { if (!cat.ITEMS[id]) return { ok: false, err: 'Unknown item' }; p.inventory[id] = Math.min(999, (p.inventory[id] || 0) + (num(d.qty, 1, 999) || 1)); }
            else if (kind === 'cloth') { if (!cat.CLOTHES[id]) return { ok: false, err: 'Unknown clothing' }; if (!p.wardrobe.includes(id)) p.wardrobe.push(id); }
            else if (kind === 'hair') { if (!cat.HAIRSTYLES.some(h => h.id === id)) return { ok: false, err: 'Unknown hairstyle' }; if (!p.hairs.includes(id)) p.hairs.push(id); }
            else if (kind === 'vehicle') { const V = cat.VEHICLES[id]; if (!V) return { ok: false, err: 'Unknown vehicle' }; if (p.vehicles.length >= 12) return { ok: false, err: 'Garage full (12)' }; p.vehicles.push({ type: id, color: V.colors.includes(d.color) ? d.color : V.colors[0], fuel: 1 }); }
            else return { ok: false, err: 'Unknown kind' };
            return { ok: true, ledger: [], claims: [] };
          });
          if (r.ok) { audit({ kind, id, qty: d.qty }); notify(tp); } return r;
        }
        case 'unlock': {
          needT(); const r = runOp(tp, 'admin', null, (p) => { for (const [id, c] of Object.entries(cat.CLOTHES)) if (!c.npc && !p.wardrobe.includes(id)) p.wardrobe.push(id); for (const h of cat.HAIRSTYLES) if (!p.hairs.includes(h.id)) p.hairs.push(h.id); return { ok: true, ledger: [], claims: [] }; });
          if (r.ok) { audit({}); notify(tp); } return r;
        }
        case 'take': {
          needT(); const vid = num(d.vid, 1, 1e12);
          const r = runOp(tp, 'admin', null, (p) => { const i = p.vehicles.findIndex(v => v.vid === vid); if (i < 0) return { ok: false, err: 'No such vehicle' }; p.vehicles.splice(i, 1); return { ok: true, ledger: [], claims: [] }; });
          if (r.ok) { audit({ vid }); notify(tp); } return r;
        }
        case 'quest': {
          needT(); const n = num(d.main, 0, cat.MAIN_QUESTS.length); if (n === null) return { ok: false, err: 'Invalid quest' };
          const r = runOp(tp, 'admin', null, (p) => { p.quests.main = n; return { ok: true, ledger: [], claims: [] }; });
          if (r.ok) { audit({ main: n }); notify(tp); } return r;
        }
        case 'rename': { needT(); const name = store.rename(tp.accountId, d.name, now, { force: true }); tp.profile.name = name; audit({ name }); if (!tp.offline) { notify(tp); io.emit('pinfo', pub(tp)); } return { ok: true, name }; }
        case 'heal': { needT(); if (tp.offline) return { ok: false, err: 'Player offline' }; io.to(tp.sid).emit('force', { heal: 1 }); audit({}); return { ok: true }; }
        case 'tp': { needT(); if (tp.offline) return { ok: false, err: 'Player offline' }; const x = Number(d.x), z = Number(d.z); if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > 6000 || Math.abs(z) > 6000) return { ok: false, err: 'Bad position' }; io.to(tp.sid).emit('force', { tp: [x, z] }); audit({ x, z }); return { ok: true }; }
        case 'bring': { needT(); if (tp.offline || !me.st) return { ok: false, err: 'Unavailable' }; io.to(tp.sid).emit('force', { tp: [me.st[0] + 2, me.st[2] + 2] }); audit({}); return { ok: true }; }
        case 'kick': { needT(); if (tp.offline) return { ok: false, err: 'Player offline' }; if (tp === me) return { ok: false, err: 'That is you' }; const s = io.sockets.sockets.get(tp.sid); tp.endReason = 'kicked'; if (s) { s.emit('kick', { reason: String(d.reason || 'Kicked by admin').slice(0, 80) }); s.disconnect(true); } audit({ reason: d.reason }); return { ok: true }; }
        case 'mute': { needT(); const mins = num(d.minutes, 0, 60 * 24 * 30) || 0; const until = mins ? now + mins * 60e3 : 0; store.setMuted(tp.accountId, until); if (!tp.offline) tp.mutedUntil = until; audit({ minutes: mins }); return { ok: true }; }
        case 'ban': {
          needT(); if (tp === me) return { ok: false, err: 'That is you' }; store.setBanned(tp.accountId, !!d.on, d.reason); audit({ on: !!d.on, reason: d.reason });
          if (d.on && !tp.offline) { const s = io.sockets.sockets.get(tp.sid); tp.endReason = 'banned'; if (s) { s.emit('kick', { reason: 'Banned' }); s.disconnect(true); } }
          return { ok: true };
        }
        case 'announce': { const t = String(d.text || '').replace(/[<>]/g, '').trim().slice(0, 160); if (!t) return { ok: false, err: 'Empty' }; sys('📢 ' + t); store.adminLog('announce', null, { text: t }); return { ok: true }; }
        case 'backup': { const r = store.backup('manual', 20); store.adminLog('backup', null, { ok: r.ok, bytes: r.bytes }); return { ok: r.ok, backup: { file: path.basename(r.file), bytes: r.bytes, accounts: r.accounts, verified: r.ok }, warning: storage.persistent ? null : 'This host is ephemeral: backups stored on the server disappear on restart. Use "Download backup".' }; }
        case 'backups': return { ok: true, list: store.listBackups().slice(0, 30) };
        case 'integrity': return { ok: true, integrity: store.integrity(), counts: store.counts() };
        case 'ticket': { const t = crypto.randomBytes(18).toString('hex'); tickets.set(t, { sid: me.sid, acc: me.accountId, exp: now + 60e3 }); return { ok: true, url: '/_k/dl/' + t }; }
        case 'log': return { ok: true, list: store.adminLogList(80) };
        case 'logticket': { const t = crypto.randomBytes(18).toString('hex'); tickets.set(t, { sid: me.sid, acc: me.accountId, exp: now + 60e3, kind: 'log' }); return { ok: true, url: '/_k/log/' + t }; }
        case 'playerlog': return { ok: true, players: store.playerSummary().slice(0, 200), sessions: store.sessionLog({ limit: 150 }) };
        case 'event': { const ev = admin.events; if (!ev) return { ok: false, err: 'Events unavailable' }; ev.start(now, cat.CAMPUS_EVENTS[d.kind] ? d.kind : undefined); store.adminLog('event', null, { kind: d.kind }); return { ok: true, event: ev.current() }; }
        case 'hidepost': { const id = num(d.id, 1, 1e12); store.postHide(id, d.on !== false); store.adminLog('hide_post', null, { id }); return { ok: true }; }
        case 'server': return { ok: true, uptime: Math.round(process.uptime()), mem: Math.round(process.memoryUsage().rss / 1e6), players: players.size, storage: { mode: storage.mode, host: storage.host, persistent: storage.persistent, warnings: storage.warnings }, engine: store.engine, sqlite: store.sqliteVersion, db: path.basename(store.file), dbBytes: (() => { try { return fs.statSync(store.file).size; } catch (e) { return 0; } })(), counts: store.counts() };
        default: return { ok: false, err: 'Unknown op' };
      }
    } catch (e) { return { ok: false, err: e.message || 'Failed' }; }
  }
  const admin = { enabled, check, unlock, routes, handle, events: null };
  return admin;
}

module.exports = { loadAdminKey, makeAdmin };
