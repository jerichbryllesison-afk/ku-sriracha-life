// Storage layer: the ONLY module that knows how player data is laid out in SQLite.
// Gameplay code works with plain profile objects and calls store.commit()/store.saveData(); swapping SQLite for
// PostgreSQL/Supabase later means re-implementing this file (same method contract), not the gameplay rules.
//
// Guarantees
// - Every money / inventory / ownership / reward change is one ACID transaction (BEGIN IMMEDIATE … COMMIT).
// - A change is acknowledged to the player only after COMMIT returns. Any error → ROLLBACK → the op reports failure.
// - money is CHECK (>= 0) in the schema; every balance change writes a ledger row and the ledger must explain the delta.
// - Reward claims have a PRIMARY KEY (account, claim_key) → a duplicate claim cannot be written twice.
// - Requests carry an idempotency key (rid); a replayed rid returns the stored result instead of applying again.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const driver = require('./driver');
const migrations = require('./migrations');

const DATA_FIELDS = ['look', 'year', 'stats', 'skills', 'gpa', 'gradePoints', 'credits', 'classes', 'quests', 'clubs', 'collected', 'counters', 'pos', 'social', 'equip'];
const NAME_RE = /^[\p{L}\p{M}\p{N} _.\-']{2,18}$/u;

const nameKey = (s) => String(s).normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
const cleanName = (s) => String(s || '').normalize('NFKC').replace(/[<>"`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 18);
const newId = () => 'a' + crypto.randomBytes(8).toString('hex');

class StoreError extends Error { constructor(code, msg) { super(msg || code); this.code = code; } }

function openStore({ dataDir, file, eco, cat, log = console.log, backupDir }) {
  fs.mkdirSync(dataDir, { recursive: true });
  const dbFile = file || path.join(dataDir, 'kusl.db');
  const existed = fs.existsSync(dbFile) && fs.statSync(dbFile).size > 0;
  const db = driver.open(dbFile);
  db.exec('PRAGMA journal_mode = WAL'); db.exec('PRAGMA synchronous = FULL'); db.exec('PRAGMA foreign_keys = ON'); db.exec('PRAGMA busy_timeout = 5000');
  const bdir = backupDir || path.join(dataDir, 'backups');

  // ---------- helpers ----------
  function pickData(p) { const d = {}; for (const k of DATA_FIELDS) if (p[k] !== undefined) d[k] = p[k]; if (d.quests) { d.quests = { ...d.quests }; delete d.quests.main; } return d; }
  function uniqueName(base, exceptId) {
    let name = cleanName(base) || 'Student'; if (name.length < 2) name = name + '_';
    for (let i = 0; i < 50; i++) {
      const cand = i === 0 ? name : (name.slice(0, 13) + ' ' + (1000 + crypto.randomInt(9000)));
      const row = db.get('SELECT account_id FROM characters WHERE name_key = ?', nameKey(cand));
      if (!row || row.account_id === exceptId) return cand;
    }
    return name.slice(0, 10) + ' ' + crypto.randomBytes(3).toString('hex');
  }
  function insertCharacter(id, p, now) {
    const name = uniqueName(p.name);
    const num = (v, a, b, d) => { v = Math.floor(Number(v)); return Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : d; };
    db.run(`INSERT INTO characters (account_id, display_name, name_key, faculty, program, student_id, level, xp, money, main_quest, last_allowance_day, data, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id, name, nameKey(name), String(p.faculty || 'eng').slice(0, 8), String(p.program || '').slice(0, 60), String(p.studentId || '').slice(0, 16) || '6' + String(crypto.randomInt(1e9)).padStart(9, '0'),
      num(p.level, 1, 60, 1), num(p.xp, 0, 1e9, 0), num(p.money, 0, 1e12, 0), num(p.quests && p.quests.main, 0, 1000, 0), num(p.lastAllowanceDay, -1, 1e9, -1),
      JSON.stringify(pickData(p)), num(p.created, 0, 1e15, now) || now, now);
    return name;
  }
  // used by migration 2 (players.json import) — values are clamped; nothing negative or absurd is carried over
  function importProfile(dbx, key, p, now) {
    const id = newId();
    dbx.run('INSERT INTO accounts (id, token_hash, created_at, last_login_at) VALUES (?,?,?,?)', id, key, Number(p.created) || now, null);
    insertCharacter(id, p, now);
    const money = Math.max(0, Math.floor(Number(p.money) || 0));
    if (money) dbx.run('INSERT INTO ledger (account_id, delta, balance_after, kind, ref, created_at) VALUES (?,?,?,?,?,?)', id, money, money, 'import', 'players.json', now);
    for (const [k, q] of Object.entries(p.inventory || {})) { const n = Math.min(999, Math.floor(Number(q) || 0)); if (n > 0 && cat.ITEMS[k]) dbx.run('INSERT OR IGNORE INTO inventory VALUES (?,?,?)', id, k, n); }
    for (const w of new Set(p.wardrobe || [])) if (cat.CLOTHES[w]) dbx.run('INSERT OR IGNORE INTO wardrobe VALUES (?,?,?)', id, w, now);
    for (const h of new Set(p.hairs || [])) dbx.run('INSERT OR IGNORE INTO hairs VALUES (?,?,?)', id, String(h), now);
    for (const v of (p.vehicles || []).slice(0, 12)) if (v && cat.VEHICLES[v.type]) dbx.run('INSERT INTO vehicles (account_id, type, color, fuel, acquired_at) VALUES (?,?,?,?,?)', id, v.type, String(v.color || cat.VEHICLES[v.type].colors[0]).slice(0, 16), Math.max(0, Math.min(1, Number(v.fuel) || 0)), now);
    for (const c of new Set(p.claimed || [])) dbx.run('INSERT OR IGNORE INTO claims (account_id, claim_key, amount, created_at) VALUES (?,?,?,?)', id, String(c).slice(0, 40), 0, now);
    return id;
  }

  // ---------- migrations (backup first if there is data to protect) ----------
  const todo = migrations.pending(db);
  let preBackup = null;
  if (existed && todo.length && db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='accounts'")) {
    preBackup = backupTo(path.join(bdir, `pre-migrate-${stamp()}.db`)); log(`[db] backup before migration → ${path.basename(preBackup.file)} (${preBackup.ok ? 'verified' : 'VERIFY FAILED'})`);
    if (!preBackup.ok) throw new Error('Refusing to migrate: pre-migration backup failed verification');
  }
  const applied = migrations.migrate(db, { dataDir, log, importProfile: (dbx, key, p, now) => importProfile(dbx, key, p, now) });
  if (applied.length) log(`[db] migrations applied: ${applied.join(', ')}`);

  // ---------- crash recovery: sessions left open by a crash / kill / host restart ----------
  const stale = db.run("UPDATE sessions SET ended_at = last_seen_at, end_reason = 'server_restart' WHERE ended_at IS NULL");
  if (stale.changes) log(`[db] closed ${stale.changes} session(s) left open by the previous run (server_restart)`);

  // ---------- read ----------
  function accountByToken(hash) { return db.get('SELECT * FROM accounts WHERE token_hash = ?', hash) || null; }
  function createAccount(hash, now = Date.now()) { const id = newId(); db.run('INSERT INTO accounts (id, token_hash, created_at, last_login_at) VALUES (?,?,?,?)', id, hash, now, now); return id; }
  function touchLogin(id, now = Date.now()) { db.run('UPDATE accounts SET last_login_at = ? WHERE id = ?', now, id); }
  function account(id) { return db.get('SELECT * FROM accounts WHERE id = ?', id) || null; }

  function loadProfile(id) {
    const c = db.get('SELECT * FROM characters WHERE account_id = ?', id); if (!c) return null;
    let d = {}; try { d = JSON.parse(c.data || '{}'); } catch (e) { d = {}; }
    const base = eco.newProfile({});
    const p = { ...base };
    for (const k of DATA_FIELDS) if (d[k] !== undefined) p[k] = d[k];
    p.stats = { ...base.stats, ...(d.stats || {}) }; p.skills = { ...base.skills, ...(d.skills || {}) }; p.counters = { ...base.counters, ...(d.counters || {}) };
    p.quests = { ...base.quests, ...(d.quests || {}), main: Number(c.main_quest) };
    if (!p.quests.daily) p.quests.daily = { day: -1, prog: {}, done: [] }; if (!p.quests.side) p.quests.side = {};
    Object.assign(p, {
      name: c.display_name, faculty: c.faculty, program: c.program, studentId: c.student_id,
      money: Number(c.money), xp: Number(c.xp), level: Number(c.level), lastAllowanceDay: Number(c.last_allowance_day),
      created: Number(c.created_at), playtime: Number(c.playtime_s), nameChangedAt: Number(c.name_changed_at),
    });
    p.inventory = {}; for (const r of db.all('SELECT item_id, qty FROM inventory WHERE account_id = ?', id)) p.inventory[r.item_id] = Number(r.qty);
    p.wardrobe = db.all('SELECT item_id FROM wardrobe WHERE account_id = ? ORDER BY acquired_at, item_id', id).map(r => r.item_id);
    p.hairs = db.all('SELECT hair_id FROM hairs WHERE account_id = ? ORDER BY acquired_at', id).map(r => r.hair_id);
    p.vehicles = db.all('SELECT id, type, color, fuel, mods, condition FROM vehicles WHERE account_id = ? ORDER BY id', id).map(r => { let mods = {}; try { mods = JSON.parse(r.mods || '{}'); } catch (e) { } return { vid: Number(r.id), type: r.type, color: r.color, fuel: Number(r.fuel), mods, condition: Number(r.condition ?? 1) }; });
    p._claims = new Set(db.all('SELECT claim_key FROM claims WHERE account_id = ?', id).map(r => r.claim_key));
    p.home = null; if (c.home) { const h = db.get('SELECT property_id, tier, acquired_at FROM housing WHERE account_id = ? AND property_id = ?', id, c.home); if (h) p.home = homeOf(h.property_id, h.tier, Number(h.acquired_at)); }
    const bz = db.get('SELECT kind, place_id, level, sales, opened_at FROM businesses WHERE account_id = ?', id);
    p.biz = bz ? { kind: bz.kind, place: bz.place_id, level: Number(bz.level), sales: Number(bz.sales), opened: Number(bz.opened_at) } : null;
    p.claimed = [];
    p.txlog = recentTx(id, 30);
    return p;
  }
  // home ids look like "B08B-312" (place-floor+room); type = HOUSING key
  function homeOf(pid, type, at) { const m = /^([A-Z0-9_]+)-(\d+)(\d\d)$/.exec(pid) || []; return { id: pid, type, place: m[1] || pid, floor: Number(m[2] || 1), room: Number(m[3] || 1), since: at || 0 }; }
  function takenRooms(place) { return new Set(db.all('SELECT property_id FROM housing WHERE property_id LIKE ?', place + '-%').map(r => r.property_id)); }
  function recentTx(id, n) { return db.all('SELECT delta, kind, ref, created_at FROM ledger WHERE account_id = ? ORDER BY id DESC LIMIT ?', id, n).reverse().map(r => ({ t: Number(r.created_at), d: Number(r.delta), w: (r.kind + (r.ref ? ':' + r.ref : '')).slice(0, 40) })); }

  function createCharacter(id, p, now = Date.now()) {
    return db.tx(() => {
      if (db.get('SELECT 1 FROM characters WHERE account_id = ?', id)) throw new StoreError('exists', 'Character already exists');
      const name = insertCharacter(id, p, now);
      if (p.money) db.run('INSERT INTO ledger (account_id, delta, balance_after, kind, ref, created_at) VALUES (?,?,?,?,?,?)', id, p.money, p.money, 'start', 'new_character', now);
      for (const [k, q] of Object.entries(p.inventory || {})) if (q > 0) db.run('INSERT INTO inventory VALUES (?,?,?)', id, k, q);
      for (const w of new Set(p.wardrobe || [])) db.run('INSERT INTO wardrobe VALUES (?,?,?)', id, w, now);
      return name;
    });
  }

  // ---------- write: one atomic commit for one or more accounts ----------
  // changes: [{ id, before, after, ledger: [{delta, kind, ref, cp}], claims: [{key, amount}] }]
  // req: { id, rid, op, result } → stored for idempotent replay
  function persistOne(c, now) {
    const { id, before: b, after: a } = c; const ledger = c.ledger || [];
    if (!Number.isSafeInteger(a.money) || a.money < 0) throw new StoreError('invalid', 'Invalid balance');
    const sum = ledger.reduce((s, l) => s + l.delta, 0);
    if (a.money - b.money !== sum) throw new StoreError('ledger', 'Ledger does not match balance change');
    const r = db.run(`UPDATE characters SET money = ?, xp = ?, level = ?, main_quest = ?, last_allowance_day = ?, faculty = ?, program = ?, data = ?, updated_at = ?
                      WHERE account_id = ? AND money = ?`,
      a.money, Math.max(0, Math.floor(a.xp)), a.level | 0, a.quests.main | 0, a.lastAllowanceDay | 0, String(a.faculty).slice(0, 8), String(a.program || '').slice(0, 60), JSON.stringify(pickData(a)), now, id, b.money);
    if (r.changes !== 1) throw new StoreError('stale', 'Balance changed concurrently');
    let bal = b.money;
    for (const l of ledger) { if (!Number.isSafeInteger(l.delta) || l.delta === 0) throw new StoreError('invalid', 'Invalid ledger amount'); bal += l.delta; db.run('INSERT INTO ledger (account_id, delta, balance_after, kind, ref, counterparty, created_at) VALUES (?,?,?,?,?,?,?)', id, l.delta, bal, l.kind, l.ref || null, l.cp || null, now); }
    // inventory
    const keys = new Set([...Object.keys(b.inventory || {}), ...Object.keys(a.inventory || {})]);
    for (const k of keys) { const qa = Math.floor(a.inventory[k] || 0), qb = Math.floor(b.inventory[k] || 0); if (qa === qb) continue; if (qa > 0) db.run('INSERT INTO inventory VALUES (?,?,?) ON CONFLICT(account_id, item_id) DO UPDATE SET qty = excluded.qty', id, k, qa); else db.run('DELETE FROM inventory WHERE account_id = ? AND item_id = ?', id, k); }
    // wardrobe / hairs
    const wb = new Set(b.wardrobe), wa = new Set(a.wardrobe);
    for (const w of wa) if (!wb.has(w)) db.run('INSERT INTO wardrobe VALUES (?,?,?)', id, w, now);
    for (const w of wb) if (!wa.has(w)) db.run('DELETE FROM wardrobe WHERE account_id = ? AND item_id = ?', id, w);
    const hb = new Set(b.hairs), ha = new Set(a.hairs);
    for (const h of ha) if (!hb.has(h)) db.run('INSERT INTO hairs VALUES (?,?,?)', id, h, now);
    for (const h of hb) if (!ha.has(h)) db.run('DELETE FROM hairs WHERE account_id = ? AND hair_id = ?', id, h);
    // vehicles (stable row ids)
    const vb = new Map(b.vehicles.filter(v => v.vid).map(v => [v.vid, v])); const keep = new Set();
    for (const v of a.vehicles) {
      const clamp01 = (x, d) => Math.max(0, Math.min(1, Number.isFinite(+x) ? +x : d));
      if (!v.vid) { v.vid = db.run('INSERT INTO vehicles (account_id, type, color, fuel, acquired_at, mods, condition) VALUES (?,?,?,?,?,?,?)', id, v.type, v.color, clamp01(v.fuel, 1), now, JSON.stringify(v.mods || {}), clamp01(v.condition, 1)).lastId; }
      else if (vb.has(v.vid)) { const o = vb.get(v.vid); if (o.fuel !== v.fuel || o.color !== v.color || (o.condition ?? 1) !== (v.condition ?? 1) || JSON.stringify(o.mods || {}) !== JSON.stringify(v.mods || {})) db.run('UPDATE vehicles SET fuel = ?, color = ?, condition = ?, mods = ? WHERE id = ? AND account_id = ?', clamp01(v.fuel, 1), String(v.color).slice(0, 16), clamp01(v.condition, 1), JSON.stringify(v.mods || {}), v.vid, id); }
      keep.add(v.vid);
    }
    for (const vid of vb.keys()) if (!keep.has(vid)) db.run('DELETE FROM vehicles WHERE id = ? AND account_id = ?', vid, id);
    // home (unique room index → two players can never get the same room)
    const hb0 = b.home && b.home.id, ha0 = a.home && a.home.id;
    if (hb0 !== ha0) {
      db.run('DELETE FROM housing WHERE account_id = ?', id);
      if (ha0) db.run('INSERT INTO housing (account_id, property_id, tier, acquired_at) VALUES (?,?,?,?)', id, ha0, a.home.type, now);
      db.run('UPDATE characters SET home = ? WHERE account_id = ?', ha0 || null, id);
    }
    // own business
    if (JSON.stringify(b.biz || null) !== JSON.stringify(a.biz || null)) {
      if (!a.biz) db.run('DELETE FROM businesses WHERE account_id = ?', id);
      else db.run('INSERT INTO businesses (account_id, kind, place_id, level, sales, opened_at) VALUES (?,?,?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET kind = excluded.kind, place_id = excluded.place_id, level = excluded.level, sales = excluded.sales', id, a.biz.kind, a.biz.place, a.biz.level | 0, Math.max(0, a.biz.sales | 0), a.biz.opened || now);
    }
    // one-time claims (PRIMARY KEY makes a duplicate impossible)
    for (const cl of c.claims || []) { db.run('INSERT INTO claims (account_id, claim_key, amount, created_at) VALUES (?,?,?,?)', id, cl.key, cl.amount | 0, now); a._claims.add(cl.key); }
    if (ledger.length) a.txlog = recentTx(id, 30);
  }
  function commit(changes, req, txFn) {
    const now = Date.now(); let extra;
    try {
      db.tx(() => {
        for (const c of changes) persistOne(c, now);
        if (txFn) extra = txFn(db, now);
        if (req && req.rid) db.run('INSERT INTO requests (account_id, rid, op, result, created_at) VALUES (?,?,?,?,?)', req.id, req.rid, req.op, JSON.stringify(req.result || {}), now);
      });
    } catch (e) {
      // roll back in-memory side effects made during persist (vehicle ids, claim set) — caller discards `after` anyway
      if (/UNIQUE constraint failed: claims/.test(e.message)) throw new StoreError('duplicate_claim', 'Already claimed');
      if (/UNIQUE constraint failed: requests/.test(e.message)) throw new StoreError('duplicate_request', 'Duplicate request');
      if (/UNIQUE constraint failed: housing/.test(e.message)) throw new StoreError('room_taken', 'That room was just taken — try again');
      if (/CHECK constraint failed/.test(e.message)) throw new StoreError('constraint', 'Rejected by database rules');
      if (e instanceof StoreError) throw e;
      throw new StoreError('storage', 'Storage error: ' + e.message);
    }
    return extra;
  }
  function replay(id, rid) { if (!rid) return null; const r = db.get('SELECT op, result FROM requests WHERE account_id = ? AND rid = ?', id, rid); if (!r) return null; try { return { op: r.op, result: JSON.parse(r.result) }; } catch (e) { return { op: r.op, result: {} }; } }

  // non-economic, client-owned state (looks, needs, skills, quest progress, position). Batched by the server.
  function saveData(list) {
    const now = Date.now();
    db.tx(() => {
      for (const { id, p } of list) {
        db.run('UPDATE characters SET data = ?, faculty = ?, program = ?, updated_at = ? WHERE account_id = ?', JSON.stringify(pickData(p)), String(p.faculty).slice(0, 8), String(p.program || '').slice(0, 60), now, id);
        for (const v of p.vehicles) if (v.vid) db.run('UPDATE vehicles SET fuel = ?, condition = ? WHERE id = ? AND account_id = ?', Math.max(0, Math.min(1, Number(v.fuel) || 0)), Math.max(0, Math.min(1, Number(v.condition ?? 1))), v.vid, id);
      }
    });
  }

  // ---------- display name ----------
  function rename(id, raw, now = Date.now(), { cooldownMs = 24 * 3600e3, force = false } = {}) {
    const name = cleanName(raw);
    if (/[<>"`\\]/.test(String(raw || '')) || !NAME_RE.test(name)) throw new StoreError('invalid_name', 'Name must be 2–18 letters, numbers, spaces or _ . - \'');
    return db.tx(() => {
      const c = db.get('SELECT display_name, name_changed_at FROM characters WHERE account_id = ?', id); if (!c) throw new StoreError('missing', 'No character');
      if (c.display_name === name) return name;
      if (!force && now - Number(c.name_changed_at) < cooldownMs) throw new StoreError('cooldown', 'You can change your name once every 24 hours');
      const taken = db.get('SELECT account_id FROM characters WHERE name_key = ?', nameKey(name));
      if (taken && taken.account_id !== id) throw new StoreError('taken', 'That name is already taken');
      db.run('UPDATE characters SET display_name = ?, name_key = ?, name_changed_at = ?, updated_at = ? WHERE account_id = ?', name, nameKey(name), now, now, id);
      db.run('INSERT INTO name_history (account_id, old_name, new_name, changed_at) VALUES (?,?,?,?)', id, c.display_name, name, now);
      return name;
    });
  }

  // ---------- sessions & playtime (all timestamps are UTC epoch ms) ----------
  function sessionStart(id, now, client) { return db.run('INSERT INTO sessions (account_id, started_at, last_seen_at, client) VALUES (?,?,?,?)', id, now, now, String(client || '').slice(0, 80)).lastId; }
  // entries: [{ id, sid, addS, addActiveS, end?: reason }]
  function sessionTick(entries, now) {
    if (!entries.length) return;
    db.tx(() => {
      for (const e of entries) {
        if (e.addS > 0 || e.addActiveS > 0) db.run('UPDATE characters SET playtime_s = playtime_s + ?, active_s = active_s + ? WHERE account_id = ?', Math.max(0, e.addS | 0), Math.max(0, e.addActiveS | 0), e.id);
        if (e.sid) { if (e.end) db.run('UPDATE sessions SET last_seen_at = ?, ended_at = ?, end_reason = ? WHERE id = ? AND ended_at IS NULL', now, now, e.end, e.sid); else db.run('UPDATE sessions SET last_seen_at = ? WHERE id = ?', now, e.sid); }
      }
    });
  }
  function playtime(id) { const r = db.get('SELECT playtime_s, active_s FROM characters WHERE account_id = ?', id); return r ? { total: Number(r.playtime_s), active: Number(r.active_s) } : { total: 0, active: 0 }; }

  // ---------- social: feed, likes, comments, media, direct messages, friends ----------
  const nameOf = (id) => { const r = db.get('SELECT display_name n FROM characters WHERE account_id = ?', id); return r ? r.n : '?'; };
  function publicProfile(id) {
    const c = db.get('SELECT c.account_id id, c.display_name name, c.faculty, c.program, c.level, c.playtime_s play, c.home, c.created_at created, h.tier FROM characters c LEFT JOIN housing h ON h.account_id = c.account_id AND h.property_id = c.home WHERE c.account_id = ?', id);
    if (!c) return null;
    const n = (q) => Number(db.get(q, id).n);
    return { id: c.id, name: c.name, faculty: c.faculty, program: c.program, level: Number(c.level), playtime: Number(c.play), homeTier: c.tier || null, homePlace: c.home ? String(c.home).split('-')[0] : null, created: Number(c.created),
      friends: n("SELECT count(*) n FROM friends WHERE account_id = ? AND status = 'accepted'"), posts: n('SELECT count(*) n FROM posts WHERE account_id = ? AND hidden = 0') };
  }
  function mediaPut(id, mime, buf) { return db.run('INSERT INTO media (account_id, mime, bytes, created_at) VALUES (?,?,?,?)', id, mime, buf, Date.now()).lastId; }
  function mediaGet(mid) { return db.get('SELECT m.mime, m.bytes FROM media m WHERE m.id = ? AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.media_id = m.id AND p.hidden = 1)', mid) || null; }
  function postCreate(id, text, place, mediaId) { return db.run('INSERT INTO posts (account_id, text, place, media_id, created_at) VALUES (?,?,?,?,?)', id, text, place || null, mediaId || null, Date.now()).lastId; }
  function feed(viewer, { before = 0, limit = 25, author = null } = {}) {
    const rows = db.all(`SELECT p.id, p.account_id author, c.display_name name, c.faculty, c.level, p.text, p.place, p.media_id media, p.created_at t,
        (SELECT count(*) FROM post_likes l WHERE l.post_id = p.id) likes, (SELECT count(*) FROM post_comments k WHERE k.post_id = p.id) comments,
        EXISTS (SELECT 1 FROM post_likes l WHERE l.post_id = p.id AND l.account_id = ?) liked
      FROM posts p JOIN characters c ON c.account_id = p.account_id WHERE p.hidden = 0 AND (? = 0 OR p.id < ?) AND (? IS NULL OR p.account_id = ?) ORDER BY p.id DESC LIMIT ?`, viewer, before, before, author, author, Math.min(50, limit));
    return rows.map(r => ({ id: Number(r.id), author: r.author, name: r.name, faculty: r.faculty, level: Number(r.level), text: r.text, place: r.place, media: r.media ? Number(r.media) : null, t: Number(r.t), likes: Number(r.likes), comments: Number(r.comments), liked: !!Number(r.liked) }));
  }
  function postGet(pid) { return db.get('SELECT id, account_id author, text, hidden FROM posts WHERE id = ?', pid) || null; }
  function likeToggle(id, pid) {
    return db.tx(() => { const had = db.get('SELECT 1 FROM post_likes WHERE post_id = ? AND account_id = ?', pid, id); if (had) db.run('DELETE FROM post_likes WHERE post_id = ? AND account_id = ?', pid, id); else db.run('INSERT INTO post_likes VALUES (?,?,?)', pid, id, Date.now()); return { liked: !had, likes: Number(db.get('SELECT count(*) n FROM post_likes WHERE post_id = ?', pid).n) }; });
  }
  function comment(id, pid, text) { return db.run('INSERT INTO post_comments (post_id, account_id, text, created_at) VALUES (?,?,?,?)', pid, id, text, Date.now()).lastId; }
  function comments(pid) { return db.all('SELECT k.id, k.account_id author, c.display_name name, k.text, k.created_at t FROM post_comments k JOIN characters c ON c.account_id = k.account_id WHERE k.post_id = ? ORDER BY k.id LIMIT 60', pid).map(r => ({ id: Number(r.id), author: r.author, name: r.name, text: r.text, t: Number(r.t) })); }
  function report(id, pid) { return db.tx(() => { const r = db.run('INSERT OR IGNORE INTO post_reports VALUES (?,?,?)', pid, id, Date.now()); if (r.changes) db.run('UPDATE posts SET reports = reports + 1, hidden = CASE WHEN reports + 1 >= 3 THEN 1 ELSE hidden END WHERE id = ?', pid); return r.changes > 0; }); }
  function postHide(pid, hidden = 1) { db.run('UPDATE posts SET hidden = ? WHERE id = ?', hidden ? 1 : 0, pid); }
  function postDelete(id, pid) { return db.run('DELETE FROM posts WHERE id = ? AND account_id = ?', pid, id).changes > 0; }
  function dmSend(from, to, text) { return db.run('INSERT INTO messages (from_id, to_id, text, created_at) VALUES (?,?,?,?)', from, to, text, Date.now()).lastId; }
  function dmThread(a, b, n = 60) { db.run('UPDATE messages SET read_at = ? WHERE to_id = ? AND from_id = ? AND read_at IS NULL', Date.now(), a, b); return db.all('SELECT id, from_id f, text, created_at t FROM messages WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?) ORDER BY id DESC LIMIT ?', a, b, b, a, n).reverse().map(r => ({ id: Number(r.id), mine: r.f === a, text: r.text, t: Number(r.t) })); }
  function dmInbox(a) {
    return db.all(`SELECT other, c.display_name name, max(t) t, sum(unread) unread, (SELECT text FROM messages m2 WHERE (m2.from_id = other AND m2.to_id = ?) OR (m2.from_id = ? AND m2.to_id = other) ORDER BY id DESC LIMIT 1) last FROM (
        SELECT CASE WHEN from_id = ? THEN to_id ELSE from_id END other, created_at t, CASE WHEN to_id = ? AND read_at IS NULL THEN 1 ELSE 0 END unread FROM messages WHERE from_id = ? OR to_id = ?
      ) JOIN characters c ON c.account_id = other GROUP BY other ORDER BY t DESC LIMIT 40`, a, a, a, a, a, a).map(r => ({ id: r.other, name: r.name, t: Number(r.t), unread: Number(r.unread), last: r.last }));
  }
  function friendState(a, b) { const x = db.get('SELECT status FROM friends WHERE account_id = ? AND friend_id = ?', a, b), y = db.get('SELECT status FROM friends WHERE account_id = ? AND friend_id = ?', b, a); return { mine: x ? x.status : null, theirs: y ? y.status : null }; }
  function friendRequest(a, b) {
    return db.tx(() => {
      const st = friendState(a, b); if (st.theirs === 'blocked' || st.mine === 'blocked') return 'blocked';
      if (st.mine === 'accepted') return 'friends';
      if (st.theirs === 'pending') { db.run("INSERT INTO friends VALUES (?,?,'accepted',?) ON CONFLICT(account_id, friend_id) DO UPDATE SET status = 'accepted'", a, b, Date.now()); db.run("UPDATE friends SET status = 'accepted' WHERE account_id = ? AND friend_id = ?", b, a); return 'friends'; }
      db.run("INSERT INTO friends VALUES (?,?,'pending',?) ON CONFLICT(account_id, friend_id) DO UPDATE SET status = 'pending'", a, b, Date.now()); return 'requested';
    });
  }
  function friendRemove(a, b) { db.tx(() => { db.run('DELETE FROM friends WHERE account_id = ? AND friend_id = ?', a, b); db.run("DELETE FROM friends WHERE account_id = ? AND friend_id = ? AND status <> 'blocked'", b, a); }); }
  function friendBlock(a, b) { db.tx(() => { db.run("INSERT INTO friends VALUES (?,?,'blocked',?) ON CONFLICT(account_id, friend_id) DO UPDATE SET status = 'blocked'", a, b, Date.now()); db.run("DELETE FROM friends WHERE account_id = ? AND friend_id = ? AND status <> 'blocked'", b, a); }); }
  function friendsOf(a) {
    const acc = db.all("SELECT f.friend_id id, c.display_name name, c.faculty, c.level FROM friends f JOIN characters c ON c.account_id = f.friend_id WHERE f.account_id = ? AND f.status = 'accepted' ORDER BY c.display_name", a);
    const inc = db.all("SELECT f.account_id id, c.display_name name, c.faculty, c.level FROM friends f JOIN characters c ON c.account_id = f.account_id WHERE f.friend_id = ? AND f.status = 'pending' AND NOT EXISTS (SELECT 1 FROM friends g WHERE g.account_id = ? AND g.friend_id = f.account_id)", a, a);
    const out = db.all("SELECT f.friend_id id, c.display_name name FROM friends f JOIN characters c ON c.account_id = f.friend_id WHERE f.account_id = ? AND f.status = 'pending'", a);
    const mapL = (r) => ({ id: r.id, name: r.name, faculty: r.faculty, level: r.level != null ? Number(r.level) : null });
    return { friends: acc.map(mapL), incoming: inc.map(mapL), outgoing: out.map(mapL) };
  }
  // ---------- player-to-player orders ----------
  function orderInsert(o, now) { return db.run('INSERT INTO orders (buyer_id, shop, items, food_cost, fee, dest, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)', o.buyer, o.shop, JSON.stringify(o.items), o.food, o.fee, JSON.stringify(o.dest), 'open', now, now).lastId; }
  function orderSet(oid, from, to, rider, now) { return db.run(`UPDATE orders SET status = ?, rider_id = COALESCE(?, rider_id), updated_at = ? WHERE id = ? AND status = ?`, to, rider || null, now || Date.now(), oid, from).changes === 1; }
  function orderGet(oid) { const r = db.get('SELECT * FROM orders WHERE id = ?', oid); if (!r) return null; return { id: Number(r.id), buyer: r.buyer_id, rider: r.rider_id, shop: r.shop, items: JSON.parse(r.items), food: Number(r.food_cost), fee: Number(r.fee), dest: JSON.parse(r.dest), status: r.status, created: Number(r.created_at), updated: Number(r.updated_at) }; }
  function ordersActive() { return db.all("SELECT id FROM orders WHERE status IN ('open','accepted','picked','npc') ORDER BY id").map(r => orderGet(Number(r.id))); }
  // ---------- online-shop parcels ----------
  function parcelInsert(acc, items, total, eta, now) { return db.run("INSERT INTO parcels (account_id, items, total, status, eta, created_at) VALUES (?,?,?,'shipping',?,?)", acc, JSON.stringify(items), total, eta, now).lastId; }
  function parcelsDue(now) { return db.all("SELECT id, account_id acc, items, total, eta FROM parcels WHERE status = 'shipping' AND eta <= ? ORDER BY id LIMIT 50", now).map(r => ({ id: Number(r.id), acc: r.acc, items: JSON.parse(r.items), total: Number(r.total), eta: Number(r.eta) })); }
  function parcelDone(pid, now) { return db.run("UPDATE parcels SET status = 'delivered', delivered_at = ? WHERE id = ? AND status = 'shipping'", now, pid).changes === 1; }
  function parcelsOf(acc) { return db.all('SELECT id, items, total, status, eta, created_at t FROM parcels WHERE account_id = ? ORDER BY id DESC LIMIT 20', acc).map(r => ({ id: Number(r.id), items: JSON.parse(r.items), total: Number(r.total), status: r.status, eta: Number(r.eta), t: Number(r.t) })); }
  // ---------- player ride requests ----------
  function rideInsert(r, now) { return db.run("INSERT INTO rides (passenger_id, pickup, dest, fare, status, created_at, updated_at) VALUES (?,?,?,?,'open',?,?)", r.pax, JSON.stringify(r.pickup), JSON.stringify(r.dest), r.fare, now, now).lastId; }
  function rideSet(id, from, to, driver, now) { return db.run('UPDATE rides SET status = ?, driver_id = COALESCE(?, driver_id), updated_at = ? WHERE id = ? AND status = ?', to, driver || null, now || Date.now(), id, from).changes === 1; }
  function rideGet(id) { const r = db.get('SELECT * FROM rides WHERE id = ?', id); return r ? { id: Number(r.id), pax: r.passenger_id, driver: r.driver_id, pickup: JSON.parse(r.pickup), dest: JSON.parse(r.dest), fare: Number(r.fare), status: r.status, created: Number(r.created_at), updated: Number(r.updated_at) } : null; }
  function ridesActive() { return db.all("SELECT id FROM rides WHERE status IN ('open','accepted','boarded') ORDER BY id").map(r => rideGet(Number(r.id))); }
  // ---------- owner-only player log ----------
  function sessionLog({ since = 0, limit = 5000 } = {}) {
    return db.all(`SELECT s.id, s.account_id acc, c.display_name name, c.faculty, c.level, s.started_at, s.ended_at, s.last_seen_at, s.end_reason, s.client
      FROM sessions s LEFT JOIN characters c ON c.account_id = s.account_id WHERE s.started_at >= ? ORDER BY s.id DESC LIMIT ?`, since, limit);
  }
  function playerSummary() {
    return db.all(`SELECT c.account_id acc, c.display_name name, c.faculty, c.level, c.money, c.playtime_s play, c.active_s active, c.created_at created, a.last_login_at last,
      (SELECT count(*) FROM sessions s WHERE s.account_id = c.account_id) sessions FROM characters c JOIN accounts a ON a.id = c.account_id ORDER BY a.last_login_at DESC`);
  }

  // ---------- admin / moderation (server-side only; never exposed to normal players) ----------
  function adminLog(action, target, detail) { try { db.run('INSERT INTO admin_log (at, action, target, detail) VALUES (?,?,?,?)', Date.now(), action, target || null, detail ? JSON.stringify(detail).slice(0, 2000) : null); } catch (e) { log('[db] admin log failed', e.message); } }
  function adminLogList(n = 60) { return db.all('SELECT at, action, target, detail FROM admin_log ORDER BY id DESC LIMIT ?', n); }
  function findAccounts(q, n = 20) { const k = '%' + nameKey(q).replace(/[%_]/g, '') + '%'; return db.all('SELECT c.account_id id, c.display_name name, c.level, c.money, c.playtime_s playtime, a.last_login_at lastLogin, a.banned FROM characters c JOIN accounts a ON a.id = c.account_id WHERE c.name_key LIKE ? ORDER BY a.last_login_at DESC LIMIT ?', k, n); }
  function ledgerFor(id, n = 50) { return db.all('SELECT delta, balance_after bal, kind, ref, counterparty cp, created_at t FROM ledger WHERE account_id = ? ORDER BY id DESC LIMIT ?', id, n); }
  function sessionsFor(id, n = 30) { return db.all('SELECT started_at, last_seen_at, ended_at, end_reason, client FROM sessions WHERE account_id = ? ORDER BY id DESC LIMIT ?', id, n); }
  function setBanned(id, on, reason) { db.run('UPDATE accounts SET banned = ?, ban_reason = ? WHERE id = ?', on ? 1 : 0, on ? String(reason || '').slice(0, 120) : null, id); }
  function setMuted(id, until) { db.run('UPDATE accounts SET muted_until = ? WHERE id = ?', until, id); }
  function counts() { const g = (t) => Number(db.get(`SELECT count(*) n FROM ${t}`).n); return { accounts: g('accounts'), characters: g('characters'), ledger: g('ledger'), sessions: g('sessions'), vehicles: g('vehicles'), claims: g('claims') }; }
  function kvGet(k) { const r = db.get('SELECT v FROM kv WHERE k = ?', k); return r ? r.v : null; }
  function kvSet(k, v) { db.run('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, String(v)); }
  function prune(now = Date.now()) { db.run('DELETE FROM requests WHERE created_at < ?', now - 7 * 864e5); }
  function integrity() { try { const r = db.all('PRAGMA quick_check'); return r.length === 1 && Object.values(r[0])[0] === 'ok'; } catch (e) { return false; } }

  // ---------- backups: VACUUM INTO = consistent online snapshot (safe while the server is writing) ----------
  function stamp() { return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-'); }
  function backupTo(dest) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    db.run('VACUUM INTO ?', dest);
    return verifyFile(dest);
  }
  function backup(label = 'auto', keep = 12) {
    const res = backupTo(path.join(bdir, `${label}-${stamp()}.db`));
    try { const files = fs.readdirSync(bdir).filter(f => f.startsWith(label + '-') && f.endsWith('.db')).sort(); while (files.length > keep) fs.unlinkSync(path.join(bdir, files.shift())); } catch (e) { }
    return res;
  }
  function listBackups() { try { return fs.readdirSync(bdir).filter(f => f.endsWith('.db')).sort().reverse().map(f => { const s = fs.statSync(path.join(bdir, f)); return { file: f, bytes: s.size, at: s.mtimeMs }; }); } catch (e) { return []; } }
  function close() { try { db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch (e) { } db.close(); }

  return {
    engine: db.engine, file: dbFile, backupDir: bdir, sqliteVersion: db.sqliteVersion(), applied, preBackup, StoreError,
    accountByToken, createAccount, touchLogin, account, loadProfile, createCharacter, commit, replay, saveData, rename, nameKey,
    sessionStart, sessionTick, playtime, homeOf, takenRooms, nameOf, publicProfile, mediaPut, mediaGet, postCreate, feed, postGet, likeToggle, comment, comments, report, postHide, postDelete,
    dmSend, dmThread, dmInbox, friendState, friendRequest, friendRemove, friendBlock, friendsOf, orderInsert, orderSet, orderGet, ordersActive, parcelInsert, parcelsDue, parcelDone, parcelsOf, rideInsert, rideSet, rideGet, ridesActive, sessionLog, playerSummary, adminLog, adminLogList, findAccounts, ledgerFor, sessionsFor, setBanned, setMuted, counts, kvGet, kvSet, prune, integrity,
    backup, backupTo, listBackups, close, _db: db,
  };
}

// Open a backup / foreign DB file read-only-ish and verify it (integrity + it really is a KU Sriracha Life DB).
function verifyFile(file) {
  const out = { file, ok: false, bytes: 0, accounts: 0, characters: 0, schema: 0, error: null };
  try {
    out.bytes = fs.statSync(file).size;
    const d = driver.open(file);
    try {
      const ic = d.all('PRAGMA integrity_check'); const okIc = ic.length === 1 && Object.values(ic[0])[0] === 'ok';
      out.schema = Number((d.get('SELECT max(id) m FROM schema_migrations') || {}).m || 0);
      out.accounts = Number(d.get('SELECT count(*) n FROM accounts').n); out.characters = Number(d.get('SELECT count(*) n FROM characters').n);
      out.ok = okIc && out.schema > 0; if (!okIc) out.error = 'integrity_check failed';
    } finally { d.close(); }
  } catch (e) { out.error = e.message; }
  return out;
}

module.exports = { openStore, verifyFile, StoreError, nameKey, cleanName, NAME_RE, DATA_FIELDS };
