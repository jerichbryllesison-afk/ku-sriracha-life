#!/usr/bin/env node
// Verification of the living-campus server systems: starter home + bike, housing, own business, ride / delivery jobs,
// NPC ride hailing, player-to-player food orders (escrow, NPC fallback, refunds), friends, DMs, feed, photos, player log.
// Run: npm run test:life   (temp data folder; needs socket.io-client from devDependencies)
'use strict';
const { spawn } = require('child_process'); const fs = require('fs'); const os = require('os'); const path = require('path'); const crypto = require('crypto'); const http = require('http');
let ioc; try { ioc = require('socket.io-client'); } catch (e) { console.error('npm install first'); process.exit(1); }
const ROOT = path.join(__dirname, '..'); const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kusl-life-'));
let failed = 0, total = 0; const ok = (n, c, i = '') => { total++; if (!c) failed++; console.log(`${c ? '  ✔' : '  ✖'} ${n}${i ? '  — ' + i : ''}`); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const tok = () => crypto.randomBytes(24).toString('hex'); const rid = () => crypto.randomBytes(10).toString('hex');
const PORT = 3800 + Math.floor(Math.random() * 90);
function startServer() { return new Promise((res, rej) => { const p = spawn(process.execPath, [path.join(ROOT, 'server.js')], { env: { ...process.env, RENDER: '', ADMIN_KEY: '', DATA_DIR: TMP, PORT: String(PORT), CREATES_PER_HOUR: '1000', CONNECTS_PER_MIN: '1000', ORDER_OPEN_MS: '3000', ORDER_NPC_SCALE: '0.05' }, stdio: ['ignore', 'pipe', 'pipe'] }); let out = ''; p.stdout.on('data', d => { out += d; if (/running on/.test(out)) res({ p, log: () => out }); }); p.stderr.on('data', d => { out += d; }); p.on('exit', c => rej(new Error('exit ' + c + out))); }); }
function get(p) { return new Promise((res, rej) => http.get({ host: '127.0.0.1', port: PORT, path: p }, (r) => { const ch = []; r.on('data', c => ch.push(c)); r.on('end', () => res({ status: r.statusCode, body: Buffer.concat(ch), type: r.headers['content-type'] })); }).on('error', rej)); }
function client(token) { return new Promise((resolve, reject) => { const s = ioc(`http://127.0.0.1:${PORT}`, { auth: { token }, transports: ['websocket'], reconnection: false, forceNew: true }); const ev = {}; for (const n of ['notif', 'me', 'pjoin']) s.on(n, d => (ev[n] = ev[n] || []).push(d)); s.on('connect', () => s.emit('hello', {})); s.on('welcome', (w) => resolve({ s, w, ev, rpc: (e, d) => new Promise(r => s.timeout(8000).emit(e, d, (err, x) => r(err ? { ok: false, err: 'timeout' } : x))), at: (x, z) => s.emit('state', [x, 1, z, 0, 0, 0, '', '', 0, '', 1]) })); s.on('connect_error', reject); }); }
const waitFor = async (fn, ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(100); } return false; };

(async () => {
  console.log('Living campus — server verification (' + TMP + ')');
  const srv = await startServer(); const key = fs.readFileSync(path.join(TMP, 'admin-key.txt'), 'utf8').trim();
  const A = await client(tok()); let r = await A.rpc('create', { name: 'Ann', faculty: 'eng' });
  const B = await client(tok()); await B.rpc('create', { name: 'Ben', faculty: 'sci' }); await sleep(300);
  let a = (await A.rpc('sync', {})).me, b = (await B.rpc('sync', {})).me;
  console.log('\n[home & starter kit]');
  ok('every new player gets a unique dorm room', a.home && b.home && a.home.type === 'dorm' && a.home.id !== b.home.id, `${a.home && a.home.id} / ${b.home && b.home.id}`);
  ok('every new player gets a starter bicycle', a.vehicles.some(v => v.type === 'bicycle') && b.vehicles.some(v => v.type === 'bicycle'));
  r = await A.rpc('home', { op: 'move', type: 'kens', rid: rid() }); ok('luxury condo needs the level', !r.ok && /level/i.test(r.err));
  await A.rpc('cmd', { text: '/admin ' + key }); await A.rpc('adm', { op: 'level', t: 'me', level: 12 }); await A.rpc('adm', { op: 'money', t: 'me', mode: 'set', amount: 400000 });
  r = await A.rpc('home', { op: 'move', type: 'kens', rid: rid() });
  ok('move to Kensington: server charges the lease and assigns a room', r.ok && r.me.money === 400000 - 95000 && r.me.home.type === 'kens' && /^KENS-\d{3,4}$/.test(r.me.home.id), r.me && r.me.home && r.me.home.id);
  console.log('\n[own business]');
  r = await A.rpc('biz', { op: 'buy', kind: 'friedstall', rid: rid() }); ok('buy a fried-snack stall', r.ok && r.me.biz && r.me.biz.kind === 'friedstall' && r.me.money === 305000 - 15000);
  r = await A.rpc('job', { op: 'start', job: 'bizdel', b: [-830, 560], s: 1 }); ok('cannot cook away from the stall', !r.ok);
  A.at(-860, 480); await sleep(150);
  r = await A.rpc('job', { op: 'start', job: 'bizdel', b: [-830, 560], s: 1 });
  ok('server writes the customer order', r.ok && r.order && r.order.value > 0 && Object.keys(r.order.items).length > 0, JSON.stringify(r.order));
  const jid = r.jid; const value = r.order.value;
  A.at(-830, 560); await sleep(120); r = await A.rpc('job', { op: 'finish', jid }); ok('teleport delivery rejected (travel time floor)', !r.ok && /fast/.test(r.err));
  await sleep(2100); r = await A.rpc('job', { op: 'finish', jid });
  ok('delivery pays margin + tip computed by the server', r.ok && r.amount >= Math.round(value * 0.55) && r.amount <= 780 && r.me.biz.sales === value, `paid ${r.amount} for order ${value}`);
  console.log('\n[ride driver]');
  r = await B.rpc('job', { op: 'start', job: 'ride', a: [-773, 28], b: [-1236, 412] }); ok('ride job needs a motor vehicle (bicycle is not enough)', !r.ok);
  await A.rpc('adm', { op: 'give', t: B.w.id, kind: 'vehicle', id: 'wave' }); await sleep(200);
  r = await B.rpc('job', { op: 'start', job: 'ride', a: [-773, 28], b: [-1236, 412] }); const rj = r.jid; ok('ride job ticket', r.ok);
  r = await B.rpc('job', { op: 'step', jid: rj }); ok('passenger pickup checked against position', !r.ok);
  B.at(-770, 30); await sleep(120); r = await B.rpc('job', { op: 'step', jid: rj }); ok('pickup at the passenger', r.ok);
  B.at(-1236, 412); await sleep(14000); r = await B.rpc('job', { op: 'finish', jid: rj });
  ok('fare computed from distance by the server', r.ok && r.amount > 100 && r.amount <= 630, 'fare ' + r.amount);
  console.log('\n[NPC ride hailing]');
  const m0 = (await B.rpc('sync', {})).me.money; r = await B.rpc('hail', { to: 'B07', rid: rid() });
  ok('hail charges a server-computed fare', r.ok && r.fare > 30 && r.me.money === m0 - r.fare, 'fare ' + r.fare);
  console.log('\n[player-to-player food order]');
  A.at(-850, 470); await sleep(100); const am0 = (await A.rpc('sync', {})).me;
  r = await A.rpc('order', { op: 'create', shop: 'B07', items: { krapao: 1, thaitea: 1 }, dest: { x: -850, z: 470, name: 'Ann' }, rid: rid() });
  ok('order created, food + fee held in escrow', r.ok && r.me.money === am0.money - r.food - r.fee && r.food === 75, `food ${r.food} fee ${r.fee}`);
  const oid = r.order.id; ok('other players are notified of the new order', await waitFor(() => (B.ev.notif || []).some(n => n.type === 'order_new' && n.order.id === oid)));
  r = await A.rpc('order', { op: 'create', shop: 'B07', items: { krapao: 99 }, dest: { x: -850, z: 470 }, rid: rid() }); ok('order size limited', !r.ok);
  r = await A.rpc('order', { op: 'create', shop: 'B07', items: { steamedcrab: 1 }, dest: { x: -850, z: 470 }, rid: rid() }); ok('items must be on that shop\'s menu', !r.ok);
  r = await A.rpc('order', { op: 'accept', id: oid }); ok('buyer cannot deliver own order', !r.ok);
  r = await B.rpc('order', { op: 'accept', id: oid }); const oj = r.jid; ok('rider accepts the order', r.ok && !!oj);
  ok('buyer told who accepted', await waitFor(() => (A.ev.notif || []).some(n => n.type === 'order_accepted' && n.rider === 'Ben')));
  B.at(-802, 215); await sleep(120); r = await B.rpc('job', { op: 'step', jid: oj }); ok('rider picks up at the restaurant', r.ok);
  B.at(-850, 470); await sleep(6500); const bm0 = (await B.rpc('sync', {})).me.money; r = await B.rpc('job', { op: 'finish', jid: oj });
  ok('rider paid the delivery fee', r.ok && r.me.money > bm0 && r.amount >= 20, 'paid ' + r.amount);
  a = (await A.rpc('sync', {})).me; ok('buyer receives the food in the inventory', (a.inventory.krapao || 0) >= 1 && (a.inventory.thaitea || 0) >= 1);
  r = await B.rpc('job', { op: 'finish', jid: oj }); ok('order cannot be paid twice', !r.ok || r.replay);
  const am1 = (await A.rpc('sync', {})).me.money; r = await A.rpc('order', { op: 'create', shop: 'FOODST', items: { kaitod: 2 }, dest: { x: -850, z: 470, name: 'Ann' }, rid: rid() });
  ok('nobody accepts → NPC rider delivers', r.ok && await waitFor(() => (A.ev.notif || []).some(n => n.type === 'order_delivered' && n.id === r.order.id), 12000));
  r = await A.rpc('order', { op: 'create', shop: 'B07', items: { water: 1 }, dest: { x: -850, z: 470 }, rid: rid() }); const am2 = r.me.money;
  const c = await A.rpc('order', { op: 'cancel', id: r.order.id }); ok('cancel before anyone accepts → full refund', c.ok && c.me.money === am2 + r.food + r.fee);
  console.log('\n[social]');
  r = await A.rpc('soc', { op: 'online' }); ok('online list shows other players with faculty & level', r.ok && r.list.some(p => p.name === 'Ben' && p.faculty === 'sci' && p.level >= 1));
  const benUid = r.list.find(p => p.name === 'Ben').uid;
  r = await A.rpc('soc', { op: 'profile', uid: benUid }); ok('public profile (no private data)', r.ok && r.profile.name === 'Ben' && r.profile.money === undefined && r.profile.token === undefined);
  r = await A.rpc('soc', { op: 'friend', uid: benUid }); ok('friend request sent', r.ok && r.state === 'requested');
  ok('Ben notified of the request', await waitFor(() => (B.ev.notif || []).some(n => n.type === 'friend_request' && n.name === 'Ann')));
  const annUid = (B.ev.notif || []).find(n => n.type === 'friend_request').uid;
  r = await B.rpc('soc', { op: 'friend', uid: annUid }); ok('accepting makes them friends', r.ok && r.state === 'friends');
  r = await A.rpc('soc', { op: 'friends' }); ok('friend list (online flag)', r.friends.some(f => f.name === 'Ben' && f.online));
  r = await A.rpc('soc', { op: 'dm', uid: benUid, text: 'ไปกินข้าวกันไหม <b>' }); ok('direct message', r.ok && await waitFor(() => (B.ev.notif || []).some(n => n.type === 'dm' && /ไปกินข้าว/.test(n.text) && !/<b>/.test(n.text))));
  r = await B.rpc('soc', { op: 'thread', uid: annUid }); ok('DM thread history', r.ok && r.list.length === 1 && !r.list[0].mine);
  r = await A.rpc('soc', { op: 'invite', uid: benUid, act: 'basketball', place: 'Gym' }); ok('activity invite delivered with location', r.ok && await waitFor(() => (B.ev.notif || []).some(n => n.type === 'invite' && n.act === 'basketball')));
  r = await A.rpc('soc', { op: 'post', text: 'วันนี้อากาศดีมาก ☀️', place: 'KU' }); const pid = r.post && r.post.id; ok('post to the shared feed', r.ok && pid);
  ok('everyone online is notified of the post', await waitFor(() => (B.ev.notif || []).some(n => n.type === 'post' && n.post.id === pid)));
  r = await A.rpc('soc', { op: 'post', text: 'again' }); ok('post rate limit', !r.ok);
  r = await B.rpc('soc', { op: 'like', id: pid }); ok('like', r.ok && r.liked && r.likes === 1);
  ok('author notified of the like', await waitFor(() => (A.ev.notif || []).some(n => n.type === 'like' && n.id === pid)));
  r = await B.rpc('soc', { op: 'comment', id: pid, text: 'จริง 555' }); ok('comment', r.ok && r.list.length === 1);
  r = await B.rpc('soc', { op: 'feed' }); ok('feed shows likes / comments counts', r.ok && r.list[0].id === pid && r.list[0].likes === 1 && r.list[0].comments === 1);
  const jpeg = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8]), crypto.randomBytes(800), Buffer.from([0xff, 0xd9])]).toString('base64');
  r = await B.rpc('soc', { op: 'post', text: 'photo', photo: jpeg }); ok('photo post', r.ok && r.post.media);
  const med = await get('/media/' + r.post.media + '.jpg'); ok('photo served as image/jpeg', med.status === 200 && med.type === 'image/jpeg' && med.body.length === 804);
  await sleep(100); r = await A.rpc('soc', { op: 'post', text: 'x', photo: 'data:image/jpeg;base64,' + Buffer.from('<script>alert(1)</script>'.repeat(30)).toString('base64') });
  ok('non-JPEG upload rejected', !r.ok);
  console.log('\n[owner player log]');
  const C = await client(tok()); await C.rpc('create', { name: 'Cat' }); await sleep(1200); C.s.close(); await sleep(500);
  const files = fs.existsSync(path.join(TMP, 'logs')) ? fs.readdirSync(path.join(TMP, 'logs')) : [];
  const txt = files.length ? fs.readFileSync(path.join(TMP, 'logs', files[0]), 'utf8') : '';
  ok('session log file written (Bangkok time, minutes)', /player,account,faculty,level,login_bangkok/.test(txt) && /"Cat"/.test(txt), files.join(','));
  r = await A.rpc('adm', { op: 'logticket' }); const csv = await get(r.url);
  ok('owner downloads the full player log (CSV)', csv.status === 200 && /SESSIONS/.test(csv.body.toString()) && /"Ann"/.test(csv.body.toString()) && /"Cat"/.test(csv.body.toString()));
  r = await B.rpc('adm', { op: 'logticket' }); ok('non-admin cannot get the log', !r.ok);
  ok('log is not reachable without a ticket', (await get('/_k/log/abc')).status === 404);
  A.s.close(); B.s.close(); await sleep(300); srv.p.kill('SIGINT'); await sleep(800);
  console.log(`\n${total - failed}/${total} checks passed`); if (!process.env.KEEP) fs.rmSync(TMP, { recursive: true, force: true }); process.exit(failed ? 1 : 0);
})().catch(e => { console.error('TEST ERROR', e); process.exit(2); });
