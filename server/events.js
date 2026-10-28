// Campus events: every few minutes the server starts a shared event somewhere on the map (football at the stadium, beach
// clean-up, food fair, live band…). Anyone who spends a minute there while it runs gets a reward once — alone or together.
'use strict';

function makeEvents(ctx) {
  const { cat, PLACE, players, io, runOp, rules, log } = ctx;
  const EV = cat.CAMPUS_EVENTS; const keys = Object.keys(EV).filter(k => PLACE[EV[k].place]);
  const posOf = (id) => { const p = PLACE[id]; if (!p) return null; if (p.at) return [p.at[0], p.at[1]]; if (p.rect) return p.rect.near ? [p.rect.near[0], p.rect.near[1]] : [p.rect.x, p.rect.z]; return null; };
  const K = Number(process.env.EVENT_SCALE) || 1; // tests shorten the timings
  const DURATION = 5 * 60e3 * K, NEED = 60e3 * K, RADIUS = 55;
  let cur = null, next = Date.now() + (60 + Math.random() * 90) * 1000 * K, seq = 0;
  const pub = () => cur && { id: cur.id, kind: cur.kind, th: EV[cur.kind].th, en: EV[cur.kind].en, icon: EV[cur.kind].icon, place: cur.place, pos: cur.pos, ends: cur.ends };
  function start(now, kind) {
    const k = kind || keys[Math.floor(Math.random() * keys.length)]; const e = EV[k];
    cur = { id: `${now.toString(36)}${(++seq).toString(36)}`, kind: k, place: e.place, pos: posOf(e.place), ends: now + DURATION, here: new Map(), done: new Set() };
    io.emit('notif', { type: 'event_start', event: pub() });
  }
  function tick(now = Date.now()) {
    if (!cur && now >= next && players.size) start(now);
    if (!cur) return;
    if (now >= cur.ends) { io.emit('notif', { type: 'event_end', id: cur.id }); cur = null; next = now + (5 + Math.random() * 5) * 60e3 * K; return; }
    for (const me of players.values()) {
      if (!me.profile || !me.st || cur.done.has(me.accountId)) continue;
      if (Math.hypot(me.st[0] - cur.pos[0], me.st[2] - cur.pos[1]) > RADIUS) continue;
      const t = (cur.here.get(me.accountId) || 0) + 5000; cur.here.set(me.accountId, t); // tick runs every 5 s
      if (t >= NEED) {
        cur.done.add(me.accountId); const key = 'event:' + cur.id;
        const r = runOp(me, 'event', null, (p) => { if (p._claims.has(key)) return { ok: false, err: 'Already rewarded' }; const out = { ok: true, ledger: [{ delta: 150, kind: 'event', ref: cur.kind }], claims: [{ key, amount: 150 }], amount: 150 }; p.money += 150; rules.grantXP(p, 80, out); return out; });
        if (r.ok) { io.to(me.sid).emit('me', r.me); io.to(me.sid).emit('notif', { type: 'event_reward', id: cur.id, kind: cur.kind, amount: 150, xp: 80 }); }
        else log('[events] reward failed', r.err);
      }
    }
  }
  return { tick, current: pub, start, _state: () => cur };
}

module.exports = { makeEvents };
