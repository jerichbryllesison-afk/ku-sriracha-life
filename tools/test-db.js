#!/usr/bin/env node
// Automated verification of the database / economy milestone. Starts real server processes on a temporary data
// folder (your data/ is never touched), connects real socket.io clients and tries the exploits.
// Run:  npm run test:db      (needs the dev dependency socket.io-client: `npm install`)
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
let ioc; try { ioc = require('socket.io-client'); } catch (e) { console.error('Install the test client first:  npm install'); process.exit(1); }

const ROOT = path.join(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kusl-test-'));
const results = []; let failed = 0;
const ok = (name, cond, info = '') => { results.push([cond ? 'PASS' : 'FAIL', name, info]); if (!cond) failed++; console.log(`${cond ? '  ✔' : '  ✖'} ${name}${info ? '  — ' + info : ''}`); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const tok = () => crypto.randomBytes(24).toString('hex');

function startServer(dir, port, env = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [path.join(ROOT, 'server.js')], { env: { ...process.env, RENDER: '', RAILWAY_ENVIRONMENT: '', FLY_APP_NAME: '', DYNO: '', K_SERVICE: '', ADMIN_KEY: '', ...env, DATA_DIR: dir, PORT: String(port), CREATES_PER_HOUR: '1000', CONNECTS_PER_MIN: '1000' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; const t = setTimeout(() => reject(new Error('server start timeout\n' + out)), 15000);
    p.stdout.on('data', d => { out += d; if (/running on/.test(out)) { clearTimeout(t); resolve({ p, log: () => out }); } });
    p.stderr.on('data', d => { out += d; });
    p.on('exit', (c) => { if (!/running on/.test(out)) { clearTimeout(t); reject(new Error('server exited ' + c + '\n' + out)); } });
  });
}
const stopServer = (srv, sig = 'SIGINT') => new Promise(r => { srv.p.on('exit', () => r()); srv.p.kill(sig); });
function get(port, p) { return new Promise((res, rej) => http.get({ host: '127.0.0.1', port, path: p }, (r) => { const ch = []; r.on('data', c => ch.push(c)); r.on('end', () => res({ status: r.statusCode, body: Buffer.concat(ch), headers: r.headers })); }).on('error', rej)); }
function client(port, token) {
  return new Promise((resolve, reject) => {
    const s = ioc(`http://127.0.0.1:${port}`, { auth: { token }, transports: ['websocket'], reconnection: false, forceNew: true });
    const ev = {}; const onAny = (n, d) => { (ev[n] = ev[n] || []).push(d); };
    for (const n of ['pjoin', 'pleave', 'chat', 'money', 'me', 'force', 'kick']) s.on(n, d => onAny(n, d));
    s.on('connect', () => s.emit('hello', {}));
    s.on('welcome', (w) => resolve({ s, w, ev, rpc: (e, d) => new Promise(r => s.timeout(8000).emit(e, d, (err, x) => r(err ? { ok: false, err: 'timeout' } : x))), close: () => s.close() }));
    s.on('connect_error', reject);
  });
}
const rid = () => crypto.randomBytes(10).toString('hex');

(async () => {
  console.log('KU Sriracha Life — database & economy verification\n  temp data dir: ' + TMP);
  const dir = path.join(TMP, 'local'); fs.mkdirSync(dir, { recursive: true });
  // legacy save file to import (copied from the project if present, otherwise a synthetic one)
  const legacy = {}; const legacyTok = tok(); const legacyKey = crypto.createHash('sha256').update(legacyTok).digest('hex').slice(0, 32);
  legacy[legacyKey] = { name: 'Legacy Player', money: 12345, level: 4, xp: 10, inventory: { water: 3 }, wardrobe: ['tee_white'], vehicles: [{ type: 'bicycle', color: '#0b6b4f', fuel: 1 }], claimed: ['c3', 'lv2'], quests: { main: 2 } };
  const src = path.join(ROOT, 'data', 'players.json'); let extra = 0;
  if (fs.existsSync(src)) { try { const j = JSON.parse(fs.readFileSync(src, 'utf8')); for (const [k, v] of Object.entries(j)) { legacy[k] = v; extra++; } } catch (e) { } }
  fs.writeFileSync(path.join(dir, 'players.json'), JSON.stringify(legacy));
  const jsonHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, 'players.json'))).digest('hex');
  const PORT = 3900 + Math.floor(Math.random() * 90);

  console.log('\n[1] first start: auto-create database, migrations, players.json import');
  let srv = await startServer(dir, PORT);
  ok('database file created automatically', fs.existsSync(path.join(dir, 'kusl.db')));
  ok('migrations applied on first start', /migrations applied: 1:core_schema, 2:import_players_json, 3:world_seed/.test(srv.log()));
  const imported = Number((/(\d+) profile\(s\) imported/.exec(srv.log()) || [])[1]);
  ok('legacy players.json imported', imported === Object.keys(legacy).length, `${imported}/${Object.keys(legacy).length} (incl. ${extra} from the project file)`);
  ok('players.json left unchanged', crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, 'players.json'))).digest('hex') === jsonHash);
  const health = JSON.parse((await get(PORT, '/api/health')).body);
  ok('health: db ok + storage persistent on a local machine', health.ok && health.storage.mode === 'persistent', JSON.stringify(health.storage));

  console.log('\n[2] create player, authoritative economy');
  const tA = tok(), tB = tok();
  let A = await client(PORT, tA);
  ok('new token → no profile yet', A.w.profile === null);
  let r = await A.rpc('create', { name: 'Alice', faculty: 'eng', money: 9999999, xp: 99999, level: 60, inventory: { water: 99 } });
  ok('create player', r.ok && r.profile.name === 'Alice');
  ok('create ignores client money/xp/level/inventory', r.ok && r.profile.money === 2000 && r.profile.level === 1 && r.profile.xp === 0 && (r.profile.inventory.water || 0) <= 1, `money ${r.profile.money} lvl ${r.profile.level}`);
  const legacyC = await client(PORT, legacyTok);
  ok('imported player logs in with old token: money/level/vehicle kept', legacyC.w.profile && legacyC.w.profile.money === 12345 && legacyC.w.profile.level === 4 && legacyC.w.profile.vehicles.length === 1 && legacyC.w.profile.quests.main === 2);
  r = await legacyC.rpc('claim', { type: 'collect', id: 3, rid: rid() });
  ok('imported claim keys still block re-claim', !r.ok && /Already/.test(r.err));
  legacyC.close();

  let m0 = (await A.rpc('sync', {})).me.money;
  r = await A.rpc('earn', { job: 'ta', amount: 99999 });
  ok('legacy "earn" (client-sent wage) rejected', !r.ok);
  A.s.emit('save', { money: 5e6, xp: 1e6, level: 60, name: 'Hacker', inventory: { energy: 99 }, quests: { main: 14 } }); await sleep(300);
  let me = (await A.rpc('sync', {})).me;
  ok('save cannot change money / xp / level / name / inventory / main quest', me.money === m0 && me.level === 1 && me.xp === 0 && me.name === 'Alice' && !me.inventory.energy && me.main === 0);
  r = await A.rpc('job', { op: 'finish', jid: 'deadbeefdeadbeef00', s: 1 });
  ok('job finish without a server ticket rejected', !r.ok);
  let st = await A.rpc('job', { op: 'start', job: 'canteen' });
  ok('job start issues a ticket', st.ok && /^[a-f0-9]{18}$/.test(st.jid));
  r = await A.rpc('job', { op: 'finish', jid: st.jid, s: 1, amount: 99999 });
  ok('instant finish rejected (shift too short)', !r.ok && /short/.test(r.err));
  await sleep(3700);
  r = await A.rpc('job', { op: 'finish', jid: st.jid, s: 999, amount: 99999 });
  const capPay = Math.round(110 * (1 + 5 / 200)); // canteen max × skill bonus at start skills
  ok('wage computed by server (score clamped, client amount ignored)', r.ok && r.amount > 0 && r.amount <= capPay && r.me.money === m0 + r.amount, `paid ${r.amount}, max ${capPay}`);
  const m1 = r.me.money;
  r = await A.rpc('job', { op: 'finish', jid: st.jid, s: 1 });
  ok('same shift cannot be paid twice (replay)', r.me.money === m1 && (r.replay || !r.ok), JSON.stringify({ ok: r.ok, replay: r.replay }));
  st = await A.rpc('job', { op: 'start', job: 'canteen' });
  ok('job cooldown enforced by server', !st.ok);

  console.log('\n[3] duplicate / concurrent claims, idempotency, negative balances');
  const conc = await Promise.all([1, 2, 3, 4, 5].map(() => A.rpc('claim', { type: 'collect', id: 7, rid: rid() })));
  ok('5 simultaneous claims of one flower → exactly one paid', conc.filter(x => x.ok).length === 1, conc.map(x => x.ok ? 'ok' : x.err).join(','));
  await sleep(1600);
  r = await A.rpc('claim', { type: 'collect', id: 7, rid: rid() });
  ok('claiming the same flower later → Already claimed', !r.ok && /Already/.test(r.err));
  r = await A.rpc('claim', { type: 'main', id: 'nope', rid: rid() });
  ok('main quest out of order rejected', !r.ok);
  me = (await A.rpc('sync', {})).me; const before = me.money;
  const R = rid();
  const b1 = await A.rpc('buy', { kind: 'item', id: 'water', qty: 3, rid: R });
  const b2 = await A.rpc('buy', { kind: 'item', id: 'water', qty: 3, rid: R });
  ok('same purchase id twice → charged once (idempotency key)', b1.ok && b2.replay && b2.me.money === b1.me.money && b1.me.money === before - b1.cost, `cost ${b1.cost}`);
  ok('inventory saved by purchase', b1.me.inventory.water >= 3);
  r = await A.rpc('buy', { kind: 'vehicle', id: 'supercar', color: '#fff', rid: rid() });
  ok('cannot buy what you cannot afford', !r.ok && r.me.money === b1.me.money);
  r = await A.rpc('transfer', { to: 'x', amount: -500 });
  ok('negative transfer rejected', !r.ok);
  r = await A.rpc('use', { id: 'water', rid: rid() });
  ok('using an item decrements the server inventory', r.ok && r.me.inventory.water === b1.me.inventory.water - 1);
  r = await A.rpc('use', { id: 'energy', rid: rid() });
  ok('cannot use an item you do not own', !r.ok);

  console.log('\n[4] XP is server-validated');
  r = await A.rpc('xp', { r: 'study', n: 1e9 });
  ok('client XP capped per activity', r.ok && r.xp === 39, 'granted ' + r.xp);
  r = await A.rpc('xp', { r: 'study', n: 30 });
  ok('activity XP rate-limited', !r.ok && /fast/i.test(r.err));
  r = await A.rpc('xp', { r: 'godmode', n: 100 });
  ok('unknown XP source rejected', !r.ok);

  console.log('\n[5] two players at once, display names, transfers');
  const B = await client(PORT, tB); r = await B.rpc('create', { name: 'Bob', faculty: 'sci' }); await sleep(300);
  ok('second player online concurrently', r.ok && A.ev.pjoin && A.ev.pjoin.some(p => p.name === 'Bob'));
  r = await B.rpc('rename', { name: 'alice' });
  ok('display name must be unique (case-insensitive)', !r.ok && /taken/.test(r.err));
  r = await B.rpc('rename', { name: '<script>' });
  ok('unsafe display name rejected', !r.ok);
  r = await B.rpc('rename', { name: 'Bobby' }); const r2 = await B.rpc('rename', { name: 'Bobby2' });
  ok('rename works once, then 24 h cooldown', r.ok && r.name === 'Bobby' && !r2.ok);
  r = await A.rpc('transfer', { to: B.w.id, amount: 100 });
  ok('transfers locked for brand-new accounts (anti alt-farming)', !r.ok && /level 3/.test(r.err));

  console.log('\n[6] owner trainer (admin)');
  const key = fs.readFileSync(path.join(dir, 'admin-key.txt'), 'utf8').trim();
  r = await B.rpc('cmd', { text: '/admin wrong-key-123' }); const unk = await B.rpc('cmd', { text: '/whatever' });
  ok('wrong admin key looks exactly like an unknown command', JSON.stringify(r) === JSON.stringify(unk), r.msg);
  r = await B.rpc('adm', { op: 'money', t: 'me', mode: 'set', amount: 1e9 });
  ok('non-admin cannot use admin ops', !r.ok);
  r = await A.rpc('cmd', { text: '/admin ' + key });
  ok('correct key unlocks trainer (one-time UI URL)', r.ok && /^\/_k\/[a-f0-9]{48}\.js$/.test(r.ui));
  const ui1 = await get(PORT, r.ui), ui2 = await get(PORT, r.ui);
  ok('trainer UI served once, then 404', ui1.status === 200 && /Owner Trainer/.test(ui1.body.toString()) && ui2.status === 404);
  ok('trainer UI is not in /public', (await get(PORT, '/admin-ui.js')).status === 404 && !fs.existsSync(path.join(ROOT, 'public', 'admin-ui.js')));
  r = await A.rpc('adm', { op: 'money', t: 'me', mode: 'set', amount: 5000000 });
  ok('admin: set own money', r.ok && r.me.money === 5000000);
  r = await A.rpc('adm', { op: 'level', t: 'me', level: 10 });
  ok('admin: set level', r.ok && r.me.level === 10);
  r = await A.rpc('adm', { op: 'give', t: 'me', kind: 'vehicle', id: 'supercar' });
  ok('admin: give vehicle (vehicle ownership row)', r.ok && r.me.vehicles.some(v => v.type === 'supercar' && v.vid));
  r = await A.rpc('adm', { op: 'money', t: B.w.id, mode: 'add', amount: 777 }); await sleep(200);
  ok('admin: give another player money (they are notified)', r.ok && B.ev.me && B.ev.me.some(x => x.money === 2777));
  const pl = await A.rpc('adm', { op: 'players' });
  ok('admin: list online players', pl.ok && pl.list.length === 2);
  const bal = (await A.rpc('sync', {})).me.money;
  r = await A.rpc('transfer', { to: B.w.id, amount: 1000, rid: rid() }); await sleep(200);
  ok('transfer A→B atomic (both balances, receiver notified)', r.ok && r.me.money === bal - 1000 && B.ev.money && B.ev.money[0].money === 3777);
  r = await A.rpc('transfer', { to: B.w.id, amount: 1e7 });
  ok('transfer beyond balance rejected', !r.ok);
  let lock = 0; for (let i = 0; i < 6; i++) { const x = await B.rpc('cmd', { text: '/admin guess' + i }); lock += x.ok ? 1 : 0; }
  r = await B.rpc('cmd', { text: '/admin ' + key });
  ok('admin brute-force lockout after 5 wrong keys (even the right key is refused)', !r.ui);
  const tk = await A.rpc('adm', { op: 'ticket' }); const dl = await get(PORT, tk.url);
  const dlFile = path.join(TMP, 'download.db'); fs.writeFileSync(dlFile, dl.body);
  const { verifyFile } = require('../server/storage/store');
  const vf = verifyFile(dlFile);
  ok('admin: export backup download is a valid, verified database', dl.status === 200 && vf.ok && vf.characters >= 3, `${(dl.body.length / 1024).toFixed(0)} KB, ${vf.characters} characters`);
  ok('download ticket is single-use', (await get(PORT, tk.url)).status === 404);

  console.log('\n[7] sessions & playtime');
  const t0 = Date.now(); const C = await client(PORT, tok()); await C.rpc('create', { name: 'Timer' }); await sleep(3200); C.close(); await sleep(400);
  me = (await A.rpc('sync', {})).me;
  B.close(); await sleep(300);
  const aMoney = me.money, aInv = me.inventory, aLevel = me.level;
  A.close(); await sleep(400);

  console.log('\n[8] stop / start: persistence');
  await stopServer(srv); ok('graceful shutdown', true);
  srv = await startServer(dir, PORT);
  ok('restart does not re-run migrations', !/migrations applied/.test(srv.log()));
  A = await client(PORT, tA);
  ok('after restart: money, level, inventory, name identical', A.w.profile.money === aMoney && A.w.profile.level === aLevel && JSON.stringify(A.w.profile.inventory) === JSON.stringify(aInv) && A.w.profile.name === 'Alice', `money ${A.w.profile.money}`);
  ok('after restart: owned vehicles kept', A.w.profile.vehicles.some(v => v.type === 'supercar'));
  const B2 = await client(PORT, tB);
  ok('after restart: second player data kept (renamed, balance)', B2.w.profile.name === 'Bobby' && B2.w.profile.money === 3777);
  const r3 = await A.rpc('cmd', { text: '/admin ' + key });
  ok('admin key persists across restarts (local)', !!r3.ui);
  const sess = await A.rpc('adm', { op: 'find', q: 'Timer' }); const ins = await A.rpc('adm', { op: 'inspect', t: sess.list[0].id });
  const s0 = ins.sessions[0]; const dur = (s0.ended_at - s0.started_at) / 1000;
  ok('session recorded with UTC start/end and reason', s0 && s0.ended_at && /disconnect/.test(s0.end_reason), `${s0.end_reason}`);
  ok('playtime matches real connected time', Math.abs(dur - (ins.playtime.total)) <= 1 && dur >= 2.5 && dur <= 5, `session ${dur.toFixed(1)} s, playtime ${ins.playtime.total} s`);
  // crash: kill -9 while a player is online, then check data and session recovery
  const beforeCrash = (await A.rpc('adm', { op: 'money', t: 'me', mode: 'add', amount: 1 })).me.money;
  await stopServer(srv, 'SIGKILL');
  srv = await startServer(dir, PORT);
  ok('crash recovery: open sessions closed as server_restart', /closed \d+ session\(s\) left open/.test(srv.log()));
  A = await client(PORT, tA);
  ok('crash: a committed change survives kill -9', A.w.profile.money === beforeCrash);
  A.close(); B2.close(); await sleep(200);
  await stopServer(srv);

  console.log('\n[9] direct database constraints');
  const driver = require('../server/storage/driver'); const d = driver.open(path.join(dir, 'kusl.db'));
  let neg = false; try { d.run("UPDATE characters SET money = -1 WHERE display_name = 'Alice'"); } catch (e) { neg = /CHECK/.test(e.message); }
  ok('database itself refuses a negative balance (CHECK)', neg);
  let dup = false; const acc = d.get("SELECT account_id FROM characters WHERE display_name = 'Alice'").account_id; try { d.run("INSERT INTO claims VALUES (?, 'c7', 1, 0)", acc); } catch (e) { dup = /UNIQUE|PRIMARY/.test(e.message); }
  ok('database itself refuses a duplicate claim (PRIMARY KEY)', dup);
  const led = d.get('SELECT (SELECT money FROM characters WHERE account_id = ?) m, (SELECT sum(delta) FROM ledger WHERE account_id = ?) s', acc, acc);
  ok('ledger explains every baht of the balance', Number(led.m) === Number(led.s), `balance ${led.m} = Σledger ${led.s}`);
  d.close();

  console.log('\n[10] Render-like host: ephemeral detection');
  const dir2 = path.join(TMP, 'render'); fs.mkdirSync(dir2);
  srv = await startServer(dir2, PORT + 1, { RENDER: 'true' });
  const h2 = JSON.parse((await get(PORT + 1, '/api/health')).body);
  ok('RENDER=true → storage reported EPHEMERAL', h2.storage.mode === 'ephemeral' && h2.storage.persistent === false);
  const E = await client(PORT + 1, tok());
  ok('players are told storage is temporary (welcome payload)', E.w.storage && E.w.storage.persistent === false && /temporar|ชั่วคราว/.test(E.w.storage.en + E.w.storage.th));
  ok('owner trainer disabled on cloud without ADMIN_KEY', /trainer disabled/.test(srv.log()) && !fs.existsSync(path.join(dir2, 'admin-key.txt')));
  E.close(); await stopServer(srv);
  srv = await startServer(dir2, PORT + 1, { RENDER: 'true', ADMIN_KEY: 'short' });
  ok('weak ADMIN_KEY refused', /shorter than 24/.test(srv.log())); await stopServer(srv);
  const strong = crypto.randomBytes(24).toString('base64url');
  srv = await startServer(dir2, PORT + 1, { RENDER: 'true', ADMIN_KEY: strong });
  const F = await client(PORT + 1, tok()); await F.rpc('create', { name: 'Owner' }); r = await F.rpc('cmd', { text: '/admin ' + strong });
  ok('ADMIN_KEY from environment unlocks trainer on cloud', !!r.ui);
  ok('game page still served on cloud mode', (await get(PORT + 1, '/')).status === 200);
  F.close(); await stopServer(srv);
  srv = await startServer(dir2, PORT + 1, { RENDER: 'true', PERSISTENT_DATA: '1' });
  ok('declared persistent disk on same filesystem → warning shown', /probably NOT a mounted persistent disk/.test(srv.log())); await stopServer(srv);

  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  fs.writeFileSync(path.join(TMP, 'results.json'), JSON.stringify(results, null, 1));
  if (!process.env.KEEP) fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('TEST RUN ERROR', e); process.exit(2); });
