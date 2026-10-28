#!/usr/bin/env node
// Verification of round 2–3 server systems: new vehicle line-up, tuning/paint/repair, KU Shop parcels, fishing & selling,
// player ride hailing (escrow, boarding, fare), campus events, proximity-voice signalling relay.
// Run: npm run test:world   (temp data folder; needs socket.io-client)
'use strict';
const { spawn } = require('child_process'); const fs = require('fs'); const os = require('os'); const path = require('path'); const crypto = require('crypto');
let ioc; try { ioc = require('socket.io-client'); } catch (e) { console.error('npm install first'); process.exit(1); }
const ROOT = path.join(__dirname, '..'); const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kusl-world-'));
let failed = 0, total = 0; const ok = (n, c, i = '') => { total++; if (!c) failed++; console.log(`${c ? '  ✔' : '  ✖'} ${n}${i ? '  — ' + i : ''}`); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const tok = () => crypto.randomBytes(24).toString('hex'); const rid = () => crypto.randomBytes(10).toString('hex');
const PORT = 3700 + Math.floor(Math.random() * 90);
function startServer() { return new Promise((res, rej) => { const p = spawn(process.execPath, [path.join(ROOT, 'server.js')], { env: { ...process.env, RENDER: '', ADMIN_KEY: '', DATA_DIR: TMP, PORT: String(PORT), CREATES_PER_HOUR: '1000', CONNECTS_PER_MIN: '1000', PARCEL_SCALE: '0.03', EVENT_SCALE: '0.1' }, stdio: ['ignore', 'pipe', 'pipe'] }); let out = ''; p.stdout.on('data', d => { out += d; if (/running on/.test(out)) res({ p, log: () => out }); }); p.stderr.on('data', d => { out += d; }); p.on('exit', c => rej(new Error('exit ' + c + out))); }); }
function client(token) { return new Promise((resolve, reject) => { const s = ioc(`http://127.0.0.1:${PORT}`, { auth: { token }, transports: ['websocket'], reconnection: false, forceNew: true }); const ev = {}; for (const n of ['notif', 'me', 'rtc', 'pinfo']) s.on(n, d => (ev[n] = ev[n] || []).push(d)); s.on('connect', () => s.emit('hello', {})); s.on('welcome', (w) => resolve({ s, w, ev, rpc: (e, d) => new Promise(r => s.timeout(8000).emit(e, d, (err, x) => r(err ? { ok: false, err: 'timeout' } : x))), at: (x, z, veh) => s.emit('state', [x, 1, z, 0, veh ? 2 : 0, 0, veh || '', veh ? '#fff' : '', 0, '', 1]) })); s.on('connect_error', reject); }); }
const waitFor = async (fn, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(100); } return false; };

(async () => {
  console.log('Round 2–3 server verification (' + TMP + ')');
  const srv = await startServer(); const key = fs.readFileSync(path.join(TMP, 'admin-key.txt'), 'utf8').trim();
  const A = await client(tok()); await A.rpc('create', { name: 'Ann' }); const B = await client(tok()); await B.rpc('create', { name: 'Ben' }); await sleep(300);
  await A.rpc('cmd', { text: '/admin ' + key }); await A.rpc('adm', { op: 'level', t: 'me', level: 30 }); await A.rpc('adm', { op: 'money', t: 'me', mode: 'set', amount: 30000000 });
  console.log('\n[vehicles]');
  let r = await A.rpc('buy', { kind: 'vehicle', id: 'supercar', rid: rid() }); ok('retired generic models are no longer sold', !r.ok && /No longer sold/.test(r.err));
  const bought = []; await sleep(2500); for (const id of ['civic', 'camry', 'bmw3', 'amggt', 'click', 'pcx']) { r = await A.rpc('buy', { kind: 'vehicle', id, color: '', rid: rid() }); if (r.ok) bought.push(id); else console.log('   ', id, r.err); await sleep(200); }
  ok('new line-up can be bought (Civic, Camry, 330e, AMG GT, Click, PCX)', bought.length === 6, bought.join(','));
  await sleep(200); r = await A.rpc('buy', { kind: 'vehicle', id: 'vespa', rid: rid() }); await sleep(200); const r2 = await A.rpc('buy', { kind: 'vehicle', id: 'forza', rid: rid() });
  ok('garage limit enforced (8)', r.ok && !r2.ok && /Garage full/.test(r2.err), `${r.ok} ${r2.err}`);
  const amg = r.me.vehicles.find(v => v.type === 'amggt');
  console.log('\n[garage: tuning, paint, repair]');
  r = await A.rpc('garage', { op: 'tune', vid: amg.vid, part: 'engine', rid: rid() }); ok('tuning only at the garage', !r.ok && /Garage/.test(r.err));
  A.at(-1144, 226); await sleep(150); const m0 = (await A.rpc('sync', {})).me.money;
  r = await A.rpc('garage', { op: 'tune', vid: amg.vid, part: 'engine', rid: rid() }); ok('engine stage 1 priced by the server', r.ok && r.price === 380000 && r.me.money === m0 - 380000 && r.me.vehicles.find(v => v.vid === amg.vid).mods.engine === 1, 'price ' + r.price);
  r = await A.rpc('garage', { op: 'tune', vid: amg.vid, part: 'exhaust', rid: rid() }); const r3 = await A.rpc('garage', { op: 'tune', vid: amg.vid, part: 'exhaust', rid: rid() });
  ok('sport exhaust max level 1', r.ok && !r3.ok);
  r = await A.rpc('garage', { op: 'paint', vid: amg.vid, color: '#ff7a00', rid: rid() }); ok('paint changes colour', r.ok && r.me.vehicles.find(v => v.vid === amg.vid).color === '#ff7a00');
  r = await A.rpc('garage', { op: 'paint', vid: amg.vid, color: '#123456', rid: rid() }); ok('unknown paint rejected', !r.ok);
  A.s.emit('save', { vehicleCond: r.me.vehicles.map(v => v.vid === amg.vid ? 0.5 : 1), vehicleFuel: r.me.vehicles.map(v => v.fuel) }); await sleep(300);
  A.s.emit('save', { vehicleCond: r.me.vehicles.map(() => 1) }); await sleep(300);
  let me = (await A.rpc('sync', {})).me; ok('crash wear saved, and cannot be "repaired" by the client', me.vehicles.find(v => v.vid === amg.vid).condition === 0.5);
  r = await A.rpc('garage', { op: 'repair', vid: amg.vid, rid: rid() }); ok('repair cost from damage, condition restored', r.ok && r.price === 75000 && r.me.vehicles.find(v => v.vid === amg.vid).condition === 1, 'price ' + r.price);
  console.log('\n[KU Shop parcels]');
  const bm0 = (await B.rpc('sync', {})).me.money;
  r = await B.rpc('shop', { op: 'buy', items: { snack_chips: 2, mask_pack: 1 }, clothes: [], rid: rid() }); ok('online order charged incl. shipping under ฿1000', r.ok && r.total === 30 * 2 + 199 + 40 && r.me.money === bm0 - r.total, 'total ' + r.total);
  r = await B.rpc('shop', { op: 'buy', items: { phone_tara: 1 }, rid: rid() }); ok('expensive online order rejected without money', !r.ok);
  r = await B.rpc('shop', { op: 'buy', items: { steamedcrab: 1 }, rid: rid() }); ok('restaurant food is not sold online', !r.ok);
  ok('parcel delivered later into the bag + notification', await waitFor(() => (B.ev.notif || []).some(n => n.type === 'parcel'), 10000));
  me = (await B.rpc('sync', {})).me; ok('parcel items in inventory', me.inventory.snack_chips === 2 && me.inventory.mask_pack === 1);
  await A.rpc('adm', { op: 'money', t: B.w.id, mode: 'add', amount: 5000 });
  r = await B.rpc('shop', { op: 'buy', items: {}, clothes: ['nova_tee', 'stride_court'], rid: rid() }); ok('brand clothes online (free shipping ≥ ฿1000)', r.ok && r.total === 890 + 3290);
  ok('clothes parcel arrives in the wardrobe', await waitFor(() => (B.ev.me || []).some(x => (x.wardrobe || []).includes('nova_tee') && x.wardrobe.includes('stride_court')), 10000));
  console.log('\n[fishing]');
  r = await B.rpc('fish', { s: 1 }); ok('fishing only at the coast', !r.ok);
  B.at(-1330, -60); await sleep(150); r = await B.rpc('fish', { s: 1 });
  ok('catch rolled by the server', r.ok && (r.caught === null || /^(fish_|boot_)/.test(r.caught)), String(r.caught));
  r = await B.rpc('fish', { s: 1 }); ok('bite cooldown', !r.ok);
  await A.rpc('adm', { op: 'give', t: B.w.id, kind: 'item', id: 'fish_snapper', qty: 3 }); await sleep(200);
  B.at(-800, 200); await sleep(150); r = await B.rpc('sellfish', { rid: rid() }); ok('selling only at the market / seafood restaurant', !r.ok);
  B.at(-1232, -125); await sleep(150); const bm1 = (await B.rpc('sync', {})).me.money;
  r = await B.rpc('sellfish', { rid: rid() }); ok('catch sold at server prices', r.ok && r.amount >= 360 && r.me.money === bm1 + r.amount && !r.me.inventory.fish_snapper, 'sold ' + r.sold + ' for ' + r.amount);
  console.log('\n[player ride hailing]');
  B.at(-773, 30); A.at(-760, 30, 'civic'); await sleep(200); const bm2 = (await B.rpc('sync', {})).me.money;
  r = await B.rpc('ride', { op: 'request', to: 'MARKET', fromName: 'Lecture 1', rid: rid() }); const ride = r.ride;
  ok('ride request: fare held in escrow', r.ok && r.me.money === bm2 - r.fare && r.fare >= 40, 'fare ' + r.fare);
  ok('drivers are notified', await waitFor(() => (A.ev.notif || []).some(n => n.type === 'ride_new' && n.ride.id === ride.id)));
  r = await A.rpc('ride', { op: 'accept', id: ride.id }); ok('driver in a car accepts', r.ok);
  r = await B.rpc('ride', { op: 'board', id: ride.id }); ok('cannot board until the driver is next to you', !r.ok);
  A.at(-772, 32, 'civic'); await sleep(150); r = await B.rpc('ride', { op: 'board', id: ride.id }); ok('passenger boards', r.ok && await waitFor(() => (B.ev.notif || []).some(n => n.type === 'ride_boarded')));
  A.at(-1232, -125, 'civic'); B.at(-1231, -124); await sleep(6000); const am = (await A.rpc('sync', {})).me.money;
  r = await A.rpc('ride', { op: 'finish', id: ride.id }); ok('driver paid the fare at the destination', r.ok && r.me.money === am + ride.fare, 'fare ' + ride.fare);
  ok('passenger told the ride is done', await waitFor(() => (B.ev.notif || []).some(n => n.type === 'ride_done')));
  r = await A.rpc('ride', { op: 'finish', id: ride.id }); ok('fare cannot be collected twice', !r.ok || r.replay);
  const bm3 = (await B.rpc('sync', {})).me.money; r = await B.rpc('ride', { op: 'request', to: 'B07', rid: rid() }); const c = await B.rpc('ride', { op: 'cancel', id: r.ride.id });
  ok('cancelled request refunded', c.ok && c.me.money === bm3);
  console.log('\n[campus events]');
  r = await A.rpc('adm', { op: 'event', kind: 'beach' }); ok('event broadcast to everyone', r.ok && await waitFor(() => (B.ev.notif || []).some(n => n.type === 'event_start' && n.event.kind === 'beach')));
  const pos = r.event.pos; B.at(pos[0] + 5, pos[1]); const bm4 = (await B.rpc('sync', {})).me.money;
  ok('being there earns the reward once', await waitFor(() => (B.ev.notif || []).some(n => n.type === 'event_reward'), 15000));
  await sleep(6000); me = (await B.rpc('sync', {})).me; ok('reward = ฿150 + XP, paid once', me.money === bm4 + 150, `${bm4} → ${me.money}`);
  console.log('\n[voice signalling relay]');
  A.at(-800, 200); B.at(-805, 200); await sleep(150);
  A.s.emit('rtc', { to: B.w.id, t: 'offer', d: { sdp: 'x' } }); await sleep(300); ok('no relay unless both enabled voice', !(B.ev.rtc || []).length);
  A.s.emit('voice', true); B.s.emit('voice', true); await sleep(300);
  const bId = B.w.id, aId = A.w.id; A.s.emit('rtc', { to: bId, t: 'offer', d: { sdp: 'v=0' } }); ok('offer relayed to a nearby player', await waitFor(() => (B.ev.rtc || []).some(m => m.t === 'offer' && m.from === aId)));
  B.at(-200, 200); await sleep(200); const n0 = (B.ev.rtc || []).length; A.s.emit('rtc', { to: bId, t: 'ice', d: { c: 1 } }); await sleep(400); ok('no relay to players far away', (B.ev.rtc || []).length === n0);
  A.s.emit('rtc', { to: bId, t: 'evil', d: {} }); await sleep(200); ok('unknown signalling types dropped', (B.ev.rtc || []).length === n0);
  ok('voice flag visible to others (for the speaker icon)', (A.ev.pinfo || []).some(p => p.name === 'Ben' && p.voice === true));
  A.s.close(); B.s.close(); await sleep(300); srv.p.kill('SIGINT'); await sleep(800);
  console.log(`\n${total - failed}/${total} checks passed`); if (!process.env.KEEP) fs.rmSync(TMP, { recursive: true, force: true }); process.exit(failed ? 1 : 0);
})().catch(e => { console.error('TEST ERROR', e); process.exit(2); });
