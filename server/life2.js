// Round 2–3 server systems: tuning & repair shop, KU Shop online orders (parcels), fishing, player-to-player ride hailing.
// Same contract as everything else: the server prices it, checks positions/rate limits, commits atomically, then replies.
'use strict';
const crypto = require('crypto');

function makeLife2(ctx) {
  const { cat, PLACE, store, players, io, runOp, snap, log, rules } = ctx;
  const { VEHICLES, TUNING, ONLINE_SHOP, ITEMS, CLOTHES, FISH_TABLE } = cat;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const res = (x = {}) => ({ ok: true, ledger: [], claims: [], ...x });
  const posOf = (id) => { const p = PLACE[id]; if (!p) return null; if (p.at) return [p.at[0], p.at[1]]; if (p.rect) return p.rect.near ? [p.rect.near[0], p.rect.near[1]] : [p.rect.x, p.rect.z]; return null; };
  const near = (st, pt, r) => !!st && !!pt && Math.hypot(st[0] - pt[0], st[2] - pt[1]) <= r;
  const online = (acc) => { for (const p of players.values()) if (p.accountId === acc && p.profile) return p; return null; };
  const ownerOf = (acc) => online(acc) || (() => { const profile = store.loadProfile(acc); return profile ? { accountId: acc, profile, mem: {}, offline: true } : null; })();
  const notify = (acc, n) => { const p = online(acc); if (p) io.to(p.sid).emit('notif', n); };
  const pushMe = (o) => { if (o && !o.offline && o.sid) io.to(o.sid).emit('me', snap(o.profile, o)); };
  const clsOf = (v) => (VEHICLES[v.type] && VEHICLES[v.type].cls) || 'car';

  // ---------------- tuning / paint / repair (only at the garage) ----------------
  function garage(p, req, me) {
    const shop = posOf('TUNING'); if (!near(me.st, shop, 70)) return { ok: false, err: 'Bring your vehicle to the Auto Garage & Tuning shop' };
    const v = p.vehicles.find(x => x.vid === Number(req.vid)); if (!v) return { ok: false, err: 'Not your vehicle' };
    const cls = clsOf(v); const B = TUNING.base[cls] || TUNING.base.car; v.mods = { ...(v.mods || {}) };
    let price = 0, what = '';
    if (req.op === 'tune') {
      const part = String(req.part || ''); if (!TUNING.max[part]) return { ok: false, err: 'Unknown part' };
      if (cls === 'bike' && part === 'exhaust') return { ok: false, err: 'Bicycles have no exhaust 🙂' };
      const lvl = (v.mods[part] || 0) + 1; if (lvl > TUNING.max[part]) return { ok: false, err: 'Already at the maximum level' };
      price = B[part] * lvl; what = `${v.type}:${part}:${lvl}`; v.mods[part] = lvl;
    } else if (req.op === 'paint') {
      const col = String(req.color || ''); const ok = TUNING.paints.includes(col) || (VEHICLES[v.type] && VEHICLES[v.type].colors.includes(col)); if (!ok) return { ok: false, err: 'Unknown colour' };
      if (col === v.color) return { ok: false, err: 'Already this colour' }; price = B.paint; what = `${v.type}:paint`; v.color = col;
    } else if (req.op === 'repair') {
      const c = v.condition ?? 1; if (c >= 0.995) return { ok: false, err: 'No damage to repair' };
      price = Math.max(50, Math.round((1 - c) * B.repair)); what = `${v.type}:repair`; v.condition = 1;
    } else return { ok: false, err: 'Unknown garage job' };
    if (p.money < price) return { ok: false, err: 'Not enough money' };
    p.money -= price; return res({ price, vid: v.vid, ledger: [{ delta: -price, kind: 'garage', ref: what.slice(0, 40) }] });
  }

  // ---------------- KU Shop: online orders delivered as parcels ----------------
  const ONLINE = new Set(Object.values(ONLINE_SHOP).flat());
  function shopOrder(me, d) {
    const items = {}; let qty = 0, sub = 0;
    for (const [id, q0] of Object.entries(d.items || {})) { const q = Math.floor(Number(q0) || 0); if (q <= 0) continue; if (!ONLINE.has(id) || !ITEMS[id] || !(ITEMS[id].price > 0)) return { ok: false, err: 'Not sold online' }; items[id] = q; qty += q; sub += ITEMS[id].price * q; }
    const clothes = [...new Set((d.clothes || []).map(String))];
    for (const c of clothes) { const C = CLOTHES[c]; if (!C || C.shop !== 'mall' || C.npc) return { ok: false, err: 'Not sold online' }; if (me.profile.wardrobe.includes(c)) return { ok: false, err: 'You already own ' + C.name }; if (C.level && me.profile.level < C.level) return { ok: false, err: `Requires level ${C.level}` }; sub += C.price; qty++; }
    if (qty < 1 || qty > 12) return { ok: false, err: 'Order 1–12 items' };
    const ship = sub >= 1000 ? 0 : 40; const total = sub + ship; const now = Date.now(); const eta = now + Math.round(rnd(40, 100) * 1000 * (Number(process.env.PARCEL_SCALE) || 1)); let pid = null;
    const r = runOp(me, 'shop_online', d.rid, (p) => {
      for (const [id, q] of Object.entries(items)) if ((p.inventory[id] || 0) + q > 99) return { ok: false, err: 'Bag is full' };
      if (p.money < total) return { ok: false, err: 'Not enough money' };
      p.money -= total; return res({ total, ship, ledger: [{ delta: -total, kind: 'online_shop', ref: `${qty} items` }] });
    }, (db, n) => { pid = store.parcelInsert(me.accountId, { items, clothes }, total, eta, n); });
    if (r.ok) r.parcel = { id: pid, eta, items, clothes, total };
    return r;
  }
  function tickParcels(now = Date.now()) {
    let due; try { due = store.parcelsDue(now); } catch (e) { return; }
    for (const pc of due) {
      try {
        const o = ownerOf(pc.acc); if (!o) continue;
        const r = runOp(o, 'parcel', null, (p) => { for (const [id, q] of Object.entries(pc.items.items || {})) p.inventory[id] = Math.min(99, (p.inventory[id] || 0) + q); for (const c of pc.items.clothes || []) if (!p.wardrobe.includes(c)) p.wardrobe.push(c); return res(); }, (db, n) => { if (!store.parcelDone(pc.id, n)) throw new Error('parcel state changed'); });
        if (r.ok) { pushMe(o); notify(pc.acc, { type: 'parcel', id: pc.id, items: pc.items }); }
      } catch (e) { log('[parcels]', pc.id, e.message); }
    }
  }

  // ---------------- fishing (coast / pier) and selling the catch ----------------
  const COAST_X = -1270;
  function fish(p, req, mem, now, me, day) {
    if (!me.st || me.st[0] > COAST_X) return { ok: false, err: 'Fish from the beach or the pier at Ao Udom' };
    if (now - (mem.fishAt || 0) < 18000) return { ok: false, err: 'Wait for the next bite…' };
    mem.fishDay = mem.fishDay || {}; const k = 'd' + day; if ((mem.fishDay[k] || 0) >= 40) return { ok: false, err: 'The fish have stopped biting today' };
    mem.fishAt = now; mem.fishDay[k] = (mem.fishDay[k] || 0) + 1;
    const s = Math.max(0, Math.min(1, Number(req.s) || 0)); if (s < 0.2) return res({ caught: null }); // it got away
    const table = FISH_TABLE.map(([id, w]) => [id, (id === 'fish_snapper' || id === 'fish_crab') ? w * (0.6 + s) : id === 'boot_old' ? w * (1.2 - s) : w]);
    let tot = table.reduce((a, x) => a + x[1], 0), r = Math.random() * tot, got = table[0][0]; for (const [id, w] of table) { r -= w; if (r <= 0) { got = id; break; } }
    if ((p.inventory[got] || 0) >= 99) return { ok: false, err: 'Bag is full' };
    p.inventory[got] = (p.inventory[got] || 0) + 1; const out = res({ caught: got }); rules.grantXP(p, got === 'boot_old' ? 2 : 12, out); return out;
  }
  function sellFish(p, req, me) {
    if (!['MARKET', 'SEAFOOD'].some(id => near(me.st, posOf(id), 90))) return { ok: false, err: 'Sell your catch at the Ao Udom market or the seafood restaurant' };
    let total = 0, n = 0; for (const [id, q] of Object.entries(p.inventory)) { const it = ITEMS[id]; if (it && it.cat === 'fish' && q > 0) { total += (it.sell || 0) * q; n += q; delete p.inventory[id]; } }
    if (!n) return { ok: false, err: 'No fish to sell' };
    p.money += total; return res({ sold: n, amount: total, ledger: total ? [{ delta: total, kind: 'sell_fish', ref: n + ' pcs' }] : [] });
  }

  // ---------------- player ride hailing (escrow) ----------------
  const motorOf = (st) => st && st[6] && VEHICLES[st[6]] && st[6] !== 'bicycle';
  const pub = (r) => ({ id: r.id, paxName: store.nameOf(r.pax), pickup: r.pickup, dest: r.dest, fare: r.fare, status: r.status, driverName: r.driver ? store.nameOf(r.driver) : null });
  function rideRequest(me, d) {
    if (!me.st) return { ok: false, err: 'Position unknown' };
    const to = PLACE[d.to] ? posOf(d.to) : null; if (!to) return { ok: false, err: 'Pick a destination' };
    const from = [me.st[0], me.st[2]]; const dist = Math.hypot(to[0] - from[0], to[1] - from[1]); if (dist < 120 || dist > 2800) return { ok: false, err: 'Too close or too far' };
    if (store.ridesActive().some(r => r.pax === me.accountId)) return { ok: false, err: 'You already have a ride request' };
    const fare = Math.max(40, Math.min(600, Math.round(35 + dist * 0.16))); let rid = null;
    const destName = PLACE[d.to].th || PLACE[d.to].name;
    const r = runOp(me, 'ride_request', d.rid, (p) => { if (p.money < fare) return { ok: false, err: 'Not enough money' }; p.money -= fare; return res({ fare, ledger: [{ delta: -fare, kind: 'ride_request', ref: d.to }] }); },
      (db, n) => { rid = store.rideInsert({ pax: me.accountId, pickup: { x: from[0], z: from[1], name: String(d.fromName || '').slice(0, 60) }, dest: { x: to[0], z: to[1], id: d.to, name: destName }, fare }, n); });
    if (!r.ok) return r; const ride = store.rideGet(rid); r.ride = pub(ride);
    for (const pl of players.values()) if (pl.profile && pl !== me) io.to(pl.sid).emit('notif', { type: 'ride_new', ride: pub(ride) });
    return r;
  }
  function rideList(me) { return { ok: true, list: store.ridesActive().filter(r => r.status === 'open' || r.pax === me.accountId || r.driver === me.accountId).map(r => ({ ...pub(r), mine: r.pax === me.accountId, driving: r.driver === me.accountId })) }; }
  function rideAccept(me, d, now) {
    const r = store.rideGet(Number(d.id)); if (!r || r.status !== 'open') return { ok: false, err: 'Ride no longer available' };
    if (r.pax === me.accountId) return { ok: false, err: 'That is your own request' };
    if (!motorOf(me.st)) return { ok: false, err: 'Get on a motorbike or car first' };
    if (store.ridesActive().some(x => x.driver === me.accountId && x.status !== 'open')) return { ok: false, err: 'Finish your current ride first' };
    if (!store.rideSet(r.id, 'open', 'accepted', me.accountId, now)) return { ok: false, err: 'Someone else took it' };
    notify(r.pax, { type: 'ride_accepted', id: r.id, driver: me.profile.name });
    return { ok: true, ride: { ...pub(store.rideGet(r.id)), driving: true } };
  }
  // the passenger hops on when the driver is right next to them
  function rideBoard(me, d, now) {
    const r = store.rideGet(Number(d.id)); if (!r || r.status !== 'accepted') return { ok: false, err: 'Ride not ready' };
    if (me.accountId !== r.pax && me.accountId !== r.driver) return { ok: false, err: 'Not your ride' };
    const pax = online(r.pax), drv = online(r.driver); if (!pax || !drv || !pax.st || !drv.st) return { ok: false, err: 'Both players must be online' };
    if (Math.hypot(pax.st[0] - drv.st[0], pax.st[2] - drv.st[2]) > 12) return { ok: false, err: 'The driver is not next to you yet' };
    if (!store.rideSet(r.id, 'accepted', 'boarded', null, now)) return { ok: false, err: 'Ride state changed' };
    io.to(pax.sid).emit('notif', { type: 'ride_boarded', id: r.id, driverId: drv.id, driver: drv.profile.name, dest: r.dest, role: 'pax' });
    io.to(drv.sid).emit('notif', { type: 'ride_boarded', id: r.id, paxId: pax.id, pax: pax.profile.name, dest: r.dest, role: 'driver' });
    drv.mem.rideBoardedAt = now; return { ok: true };
  }
  function rideFinish(me, d, now) {
    const r = store.rideGet(Number(d.id)); if (!r || r.status !== 'boarded' || r.driver !== me.accountId) return { ok: false, err: 'No ride to finish' };
    if (!near(me.st, [r.dest.x, r.dest.z], 45)) return { ok: false, err: 'Not at the destination yet' };
    const pax = online(r.pax); if (pax && pax.st && Math.hypot(pax.st[0] - me.st[0], pax.st[2] - me.st[2]) > 20) return { ok: false, err: 'Your passenger is not with you' };
    const dist = Math.hypot(r.dest.x - r.pickup.x, r.dest.z - r.pickup.z); if (now - (me.mem.rideBoardedAt || 0) < dist / 95 * 1000) return { ok: false, err: 'Trip too fast to be real' };
    const out = runOp(me, 'ride_fare', 'ride_' + r.id, (p) => { p.money += r.fare; const o = res({ amount: r.fare, ledger: [{ delta: r.fare, kind: 'ride_fare', ref: 'ride:' + r.id, cp: r.pax }] }); rules.grantXP(p, 50, o); p.counters.jobs = (p.counters.jobs || 0) + 1; return o; },
      (db, n) => { if (!store.rideSet(r.id, 'boarded', 'done', null, n)) throw new Error('ride state changed'); });
    if (out.ok && !out.replay) notify(r.pax, { type: 'ride_done', id: r.id, driver: me.profile.name, dest: r.dest });
    return out;
  }
  function rideCancel(me, d, now) {
    const r = store.rideGet(Number(d.id)); if (!r) return { ok: false, err: 'Unknown ride' };
    if (r.driver === me.accountId && r.status === 'accepted') { if (!store.rideSet(r.id, 'accepted', 'open', null, now)) return { ok: false, err: 'Too late' }; store._db.run('UPDATE rides SET driver_id = NULL WHERE id = ?', r.id); notify(r.pax, { type: 'ride_reopened', id: r.id }); return { ok: true }; }
    if (r.pax !== me.accountId || !['open', 'accepted'].includes(r.status)) return { ok: false, err: 'Cannot cancel now' };
    return refundRide(r, 'cancelled', now, me);
  }
  function refundRide(r, status, now, hint) {
    const pax = hint || ownerOf(r.pax); if (!pax) return { ok: false, err: 'Passenger not found' };
    const out = runOp(pax, 'ride_refund', null, (p) => { p.money += r.fare; return res({ refunded: r.fare, ledger: [{ delta: r.fare, kind: 'ride_refund', ref: 'ride:' + r.id }] }); }, (db, n) => { if (!store.rideSet(r.id, r.status, status, null, n)) throw new Error('ride state changed'); });
    if (out.ok) { pushMe(pax); notify(r.pax, { type: 'ride_refunded', id: r.id, amount: r.fare }); if (r.driver) notify(r.driver, { type: 'ride_cancelled', id: r.id }); }
    return out;
  }
  function tickRides(now = Date.now()) {
    let list; try { list = store.ridesActive(); } catch (e) { return; }
    for (const r of list) {
      const age = now - r.updated;
      try { if ((r.status === 'open' && age > 3 * 60e3) || (r.status === 'accepted' && age > 8 * 60e3) || (r.status === 'boarded' && age > 15 * 60e3)) refundRide(r, 'expired', now); } catch (e) { log('[rides]', r.id, e.message); }
    }
  }
  function recoverRides(now = Date.now()) { for (const r of store.ridesActive()) refundRide(r, 'expired', now); } // after a restart nobody is mid-ride any more

  return { garage, shopOrder, tickParcels, fish, sellFish, rideRequest, rideList, rideAccept, rideBoard, rideFinish, rideCancel, tickRides, recoverRides, posOf };
}

module.exports = { makeLife2 };
