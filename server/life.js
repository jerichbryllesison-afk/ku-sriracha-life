// Living-campus systems on the server: homes, starter kit, own business, NPC ride hailing, player-to-player food orders.
// Same rules as the rest of the economy: the server computes every price and wage, commits atomically, and only then replies.
'use strict';

function makeLife(ctx) {
  const { cat, PLACE, store, players, io, runOp, snap, log } = ctx;
  const { HOUSING, BUSINESSES, SHOPS, ITEMS, VEHICLES, ORDER_KINDS, JOBS } = cat;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ri = (a, b) => Math.floor(rnd(a, b + 1));
  const posOf = (id) => { const p = PLACE[id]; if (!p) return null; if (p.at) return [p.at[0], p.at[1]]; if (p.rect) return p.rect.near ? [p.rect.near[0], p.rect.near[1]] : [p.rect.x, p.rect.z]; return null; };
  const inMap = (a) => Array.isArray(a) && a.length >= 2 && Number.isFinite(+a[0]) && Number.isFinite(+a[1]) && Math.abs(+a[0]) < 6000 && Math.abs(+a[1]) < 6000;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const near = (st, pt, r) => !!st && Math.hypot(st[0] - pt[0], st[2] - pt[1]) <= r;
  const res = (x = {}) => ({ ok: true, ledger: [], claims: [], ...x });
  const online = (accountId) => { for (const p of players.values()) if (p.accountId === accountId && p.profile) return p; return null; };
  const ownerOf = (accountId) => online(accountId) || (() => { const profile = store.loadProfile(accountId); return profile ? { accountId, profile, mem: {}, offline: true } : null; })();
  const notify = (accountId, n) => { const p = online(accountId); if (p) io.to(p.sid).emit('notif', n); };
  const cleanText = (s, n) => String(s || '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

  // ---------------- homes ----------------
  function freeRoom(type) {
    const def = HOUSING[type]; if (!def) return null;
    for (let tries = 0; tries < 80; tries++) {
      const place = def.places[ri(0, def.places.length - 1)]; const taken = store.takenRooms(place);
      const floor = ri(def.floors[0], def.floors[1]), room = ri(1, def.rooms); const id = `${place}-${floor}${String(room).padStart(2, '0')}`;
      if (!taken.has(id)) return store.homeOf(id, type, Date.now());
    }
    return null;
  }
  // first login: unique cheap dorm room + a starter bicycle (once per account)
  function starterKit(me) {
    const p = me.profile; const needHome = !p.home, needBike = !p._claims.has('starter_vehicle');
    if (!needHome && !needBike) return null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = runOp(me, 'starter', null, (q) => {
        const out = res({ starter: {} });
        if (!q.home) { const h = freeRoom('dorm'); if (!h) return { ok: false, err: 'No free dorm room' }; q.home = h; out.starter.home = h; }
        if (!q._claims.has('starter_vehicle')) { const V = VEHICLES.bicycle; out.claims.push({ key: 'starter_vehicle', amount: 0 }); if (!q.vehicles.some(v => v.type === 'bicycle')) { q.vehicles.push({ type: 'bicycle', color: V.colors[ri(0, V.colors.length - 1)], fuel: 1 }); out.starter.bike = true; } }
        return out;
      });
      if (r.ok || !/room/.test(r.err || '')) return r;
    }
    return null;
  }
  function moveHome(p, type) {
    const def = HOUSING[type]; if (!def) return { ok: false, err: 'Unknown home' };
    if (def.level && p.level < def.level) return { ok: false, err: `Requires level ${def.level}` };
    if (p.home && p.home.type === type) return { ok: false, err: 'You already live here' };
    if (p.money < def.price) return { ok: false, err: 'Not enough money' };
    const h = freeRoom(type); if (!h) return { ok: false, err: 'Fully booked — try another building' };
    const out = res({ home: h }); if (def.price) { p.money -= def.price; out.ledger.push({ delta: -def.price, kind: 'housing', ref: type }); }
    p.home = h; return out;
  }

  // ---------------- own business ----------------
  function bizBuy(p, kind) {
    const B = BUSINESSES[kind]; if (!B) return { ok: false, err: 'Unknown business' };
    if (p.level < (B.level || 1)) return { ok: false, err: `Requires level ${B.level}` };
    if (p.biz) return { ok: false, err: 'You already own a business' };
    if (p.money < B.price) return { ok: false, err: 'Not enough money' };
    p.money -= B.price; p.biz = { kind, place: B.place, level: 1, sales: 0, opened: Date.now() };
    return res({ biz: p.biz, ledger: [{ delta: -B.price, kind: 'business', ref: kind }] });
  }
  // the server writes the customer's order (items + value); the client only shows it
  function bizOrder(biz) {
    const B = BUSINESSES[biz.kind]; const ids = Object.keys(B.menu); const n = ri(1, 3); const items = {};
    for (let i = 0; i < n; i++) { const id = ids[ri(0, ids.length - 1)]; items[id] = (items[id] || 0) + ri(1, 2); }
    const value = Object.entries(items).reduce((s, [id, q]) => s + B.menu[id] * q, 0);
    return { items, value };
  }

  // ---------------- extra route jobs (ticket checks live in rules.jobStart / jobFinish) ----------------
  // returns null when this module does not handle the job kind
  function jobStartExtra(p, req, mem, now, me, t) {
    if (req.job === 'ride') {
      if (!p.vehicles.some(v => VEHICLES[v.type] && VEHICLES[v.type].type !== 'bicycle') && !me.rental) return { ok: false, err: 'You need a motorbike or car' };
      if (!inMap(req.a) || !inMap(req.b)) return { ok: false, err: 'Invalid route' };
      const d = dist(req.a, req.b); if (d < 100 || d > 2700) return { ok: false, err: 'Invalid route' };
      Object.assign(t, { a: [+req.a[0], +req.a[1]], b: [+req.b[0], +req.b[1]], dist: d, picked: 0 }); return { ok: true };
    }
    if (req.job === 'bizdel') {
      if (!p.biz) return { ok: false, err: 'You do not own a business' };
      const sp = posOf(p.biz.place); if (!sp || !near(me.st, sp, 110)) return { ok: false, err: 'Cook at your stall first' };
      if (!inMap(req.b)) return { ok: false, err: 'Invalid destination' };
      const d = dist(sp, req.b); if (d < 60 || d > 2700) return { ok: false, err: 'Invalid route' };
      const order = bizOrder(p.biz);
      Object.assign(t, { a: sp, b: [+req.b[0], +req.b[1]], dist: d, picked: now, order, cook: Math.max(0, Math.min(1, Number(req.s) || 0)) });
      return { ok: true, order };
    }
    return null;
  }
  function jobFinishExtra(p, t, secs, out) {
    const j = JOBS[t.job];
    if (t.job === 'ride') { const limit = t.dist / 9 + 40; out.amount = Math.min(j.pay[1] * 1.5, 35 + t.dist * 0.17 + (secs <= limit ? 30 : 0)); return true; }
    if (t.job === 'bizdel') {
      const B = BUSINESSES[p.biz ? p.biz.kind : 'friedstall']; const limit = t.dist / 7 + 60; const tip = Math.round((secs <= limit ? 15 + (limit - secs) * 0.5 : 0) + t.cook * 25);
      out.amount = Math.min(j.pay[1] * 1.5, t.order.value * B.margin + tip); out.tip = tip; out.order = t.order;
      if (p.biz) p.biz.sales += t.order.value; return true;
    }
    return false;
  }

  // ---------------- NPC ride hailing (fast travel; fare charged by the server from your real position) ----------------
  function hail(p, req, me) {
    const to = req.to && PLACE[req.to] ? posOf(req.to) : inMap(req.xz) ? [+req.xz[0], +req.xz[1]] : null; if (!to) return { ok: false, err: 'Unknown destination' };
    if (!me.st) return { ok: false, err: 'Position unknown' };
    const d = Math.hypot(me.st[0] - to[0], me.st[2] - to[1]); if (d < 60) return { ok: false, err: 'You are already there' };
    const fare = Math.min(450, Math.round(30 + d * 0.11)); if (p.money < fare) return { ok: false, err: 'Not enough money' };
    p.money -= fare; return res({ fare, eta: Math.round(rnd(5, 9)), ledger: [{ delta: -fare, kind: 'ride_hail', ref: String(req.to || 'xy').slice(0, 20) }] });
  }

  // ---------------- player-to-player food orders (escrow) ----------------
  const OPEN_MS = Number(process.env.ORDER_OPEN_MS) || 40e3, EXPIRE_MS = 15 * 60e3, NPC_K = Number(process.env.ORDER_NPC_SCALE) || 1;
  const summary = (o) => ({ id: o.id, shop: o.shop, shopName: PLACE[o.shop] ? (PLACE[o.shop].th || PLACE[o.shop].name) : o.shop, items: o.items, food: o.food, fee: o.fee, dest: o.dest, status: o.status, buyerName: store.nameOf(o.buyer), created: o.created, mine: false });
  function orderCreate(me, d) {
    const shop = PLACE[d.shop]; if (!shop || !ORDER_KINDS.includes(shop.kind)) return { ok: false, err: 'This place does not deliver' };
    const menu = new Set((SHOPS[shop.kind] || {}).items || []); const items = {}; let qty = 0, food = 0;
    for (const [id, q0] of Object.entries(d.items || {})) { const q = Math.floor(Number(q0) || 0); if (q <= 0) continue; if (!menu.has(id) || !ITEMS[id] || !(ITEMS[id].price > 0)) return { ok: false, err: 'Item not on the menu' }; items[id] = q; qty += q; food += ITEMS[id].price * q; }
    if (qty < 1 || qty > 6) return { ok: false, err: 'Order 1–6 items' };
    const dest = d.dest || {}; const dxz = [Number(dest.x), Number(dest.z)]; if (!inMap(dxz)) return { ok: false, err: 'Invalid address' };
    const sp = posOf(d.shop); const dd = dist(sp, dxz); if (dd > 2800) return { ok: false, err: 'Too far for delivery' };
    const fee = Math.max(20, Math.min(180, Math.round(20 + dd * 0.06)));
    let oid = null;
    const r = runOp(me, 'order', d.rid, (p) => {
      if (store.ordersActive().filter(o => o.buyer === me.accountId).length >= 3) return { ok: false, err: 'You already have 3 active orders' };
      if (p.money < food + fee) return { ok: false, err: 'Not enough money' };
      p.money -= food + fee;
      return res({ food, fee, ledger: [{ delta: -(food + fee), kind: 'order', ref: d.shop }] });
    }, (db, now) => { oid = store.orderInsert({ buyer: me.accountId, shop: d.shop, items, food, fee, dest: { x: dxz[0], z: dxz[1], name: cleanText(dest.name, 60) || 'Address' } }, now); return oid; });
    if (!r.ok) return r;
    const o = store.orderGet(oid); if (!o) return r; r.order = { ...summary(o), mine: true };
    for (const pl of players.values()) if (pl.profile && pl !== me) io.to(pl.sid).emit('notif', { type: 'order_new', order: summary(o) });
    return r;
  }
  function orderList(me) {
    const all = store.ordersActive().filter(o => o.status === 'open' || o.buyer === me.accountId || o.rider === me.accountId);
    return { ok: true, list: all.map(o => ({ ...summary(o), mine: o.buyer === me.accountId, riding: o.rider === me.accountId })) };
  }
  function orderAccept(me, d, now) {
    const o = store.orderGet(Number(d.id)); if (!o || o.status !== 'open') return { ok: false, err: 'Order no longer available' };
    if (o.buyer === me.accountId) return { ok: false, err: 'You cannot deliver your own order' };
    me.mem.jobs = me.mem.jobs || new Map(); if ([...me.mem.jobs.values()].some(t => t.job === 'p2p')) return { ok: false, err: 'Finish your current order first' };
    if (!store.orderSet(o.id, 'open', 'accepted', me.accountId, now)) return { ok: false, err: 'Someone else took it' };
    const a = posOf(o.shop), b = [o.dest.x, o.dest.z]; const jid = require('crypto').randomBytes(9).toString('hex');
    me.mem.jobs.set(jid, { job: 'p2p', game: 'route', t0: now, a, b, dist: dist(a, b), picked: 0, oid: o.id, pickR: 90 });
    notify(o.buyer, { type: 'order_accepted', id: o.id, rider: me.profile.name });
    return { ok: true, jid, order: { ...summary(store.orderGet(o.id)), riding: true }, pickup: a };
  }
  function orderPicked(me, t, now) { if (t.oid && store.orderSet(t.oid, 'accepted', 'picked', null, now)) { const o = store.orderGet(t.oid); notify(o.buyer, { type: 'order_picked', id: o.id, rider: me.profile.name }); } }
  // called by rules.jobFinish for p2p tickets: pays the rider, gives the food to the buyer, closes the order — one transaction
  function orderDeliver(me, jid, now) {
    const t = me.mem.jobs && me.mem.jobs.get(jid); if (!t || t.job !== 'p2p') return { ok: false, err: 'No active order' };
    if (!t.picked) return { ok: false, err: 'Pick up the food first' };
    if (!near(me.st, t.b, 30)) return { ok: false, err: 'Not at the address' };
    const o = store.orderGet(t.oid); if (!o || o.status !== 'picked') return { ok: false, err: 'Order no longer active' };
    const buyer = ownerOf(o.buyer); if (!buyer) return { ok: false, err: 'Buyer not found' };
    const secs = (now - t.picked) / 1000; const tip = secs <= t.dist / 7 + 60 ? 15 : 0;
    const r = runOp(me, 'job', 'job_' + jid, (p) => {
      p.money += o.fee + tip; const out = res({ amount: o.fee + tip, tip, job: 'p2p', ledger: [{ delta: o.fee + tip, kind: 'delivery_fee', ref: 'order:' + o.id, cp: o.buyer }] });
      ctx.rules.grantXP(p, JOBS.p2p.xp, out); p.counters.jobs = (p.counters.jobs || 0) + 1;
      const bb = buyer.profile, ba = structuredClone(bb); for (const [id, q] of Object.entries(o.items)) ba.inventory[id] = Math.min(99, (ba.inventory[id] || 0) + q);
      out.extra = [{ owner: buyer, before: bb, after: ba, ledger: [], claims: [] }];
      return out;
    }, (db, n) => { if (!store.orderSet(o.id, 'picked', 'delivered', null, n)) throw new Error('order state changed'); });
    if (r.ok && !r.replay) { me.mem.jobs.delete(jid); notify(o.buyer, { type: 'order_delivered', id: o.id, rider: me.profile.name, items: o.items }); if (!buyer.offline) io.to(buyer.sid).emit('me', snap(buyer.profile, buyer)); }
    return r;
  }
  function orderCancel(me, d, now) {
    const o = store.orderGet(Number(d.id)); if (!o) return { ok: false, err: 'Unknown order' };
    if (o.rider === me.accountId && (o.status === 'accepted')) { // rider gives the job back
      if (!store.orderSet(o.id, 'accepted', 'open', null, now)) return { ok: false, err: 'Too late' };
      for (const [k, t] of me.mem.jobs || []) if (t.oid === o.id) me.mem.jobs.delete(k);
      notify(o.buyer, { type: 'order_reopened', id: o.id }); return { ok: true };
    }
    if (o.buyer !== me.accountId || o.status !== 'open') return { ok: false, err: 'Only an order nobody accepted can be cancelled' };
    return refund(o, 'cancelled', now, me);
  }
  function refund(o, status, now, ownerHint) {
    const buyer = ownerHint || ownerOf(o.buyer); if (!buyer) return { ok: false, err: 'Buyer not found' };
    const r = runOp(buyer, 'order_refund', null, (p) => { p.money += o.food + o.fee; return res({ refunded: o.food + o.fee, ledger: [{ delta: o.food + o.fee, kind: 'order_refund', ref: 'order:' + o.id }] }); },
      (db, n) => { if (!store.orderSet(o.id, o.status, status, null, n)) throw new Error('order state changed'); });
    if (r.ok && !buyer.offline && buyer.sid) { io.to(buyer.sid).emit('me', snap(buyer.profile, buyer)); io.to(buyer.sid).emit('notif', { type: 'order_refunded', id: o.id, amount: o.food + o.fee }); }
    return r;
  }
  // NPC riders take orders nobody accepted; stuck orders are refunded
  const npcDue = new Map();
  function tickOrders(now = Date.now()) {
    let list; try { list = store.ordersActive(); } catch (e) { return; }
    for (const o of list) {
      try {
        if (o.status === 'open' && now - o.created > OPEN_MS) { if (store.orderSet(o.id, 'open', 'npc', null, now)) { npcDue.set(o.id, now + rnd(35, 75) * 1000 * NPC_K); notify(o.buyer, { type: 'order_npc', id: o.id }); } }
        else if (o.status === 'npc') {
          if (!npcDue.has(o.id)) npcDue.set(o.id, now + rnd(20, 40) * 1000 * NPC_K);
          if (now >= npcDue.get(o.id)) {
            const buyer = ownerOf(o.buyer); if (!buyer) continue;
            const r = runOp(buyer, 'order_npc', null, (p) => { for (const [id, q] of Object.entries(o.items)) p.inventory[id] = Math.min(99, (p.inventory[id] || 0) + q); return res(); }, (db, n) => { if (!store.orderSet(o.id, 'npc', 'delivered', null, n)) throw new Error('order state changed'); });
            npcDue.delete(o.id);
            if (r.ok && !buyer.offline) { io.to(buyer.sid).emit('me', snap(buyer.profile, buyer)); io.to(buyer.sid).emit('notif', { type: 'order_delivered', id: o.id, rider: null, items: o.items }); }
          }
        } else if ((o.status === 'accepted' || o.status === 'picked') && now - o.updated > EXPIRE_MS) {
          const rider = o.rider && online(o.rider); if (rider && rider.mem.jobs) for (const [k, t] of rider.mem.jobs) if (t.oid === o.id) rider.mem.jobs.delete(k);
          refund(o, 'expired', now);
        }
      } catch (e) { log('[orders] tick error', o.id, e.message); }
    }
  }
  // after a restart nobody holds the in-memory rider tickets → those orders are finished by NPC riders
  function recoverOrders(now = Date.now()) { for (const o of store.ordersActive()) if (o.status === 'accepted' || o.status === 'picked') store.orderSet(o.id, o.status, 'npc', null, now); }

  return { starterKit, moveHome, bizBuy, jobStartExtra, jobFinishExtra, hail, orderCreate, orderList, orderAccept, orderPicked, orderDeliver, orderCancel, tickOrders, recoverOrders, posOf, freeRoom };
}

module.exports = { makeLife };
