// Server-side game rules: every reward, wage and XP amount is computed HERE from server state.
// The client only says what it did ("I finished shift jid with score s"); it never says how much it should get.
// Each op mutates a CLONE of the profile and returns { ok, ledger, claims, ... }; server.js commits it atomically.
'use strict';
const crypto = require('crypto');

function makeRules(cat, eco) {
  const { JOBS, MAIN_QUESTS, SIDE_QUESTS, DAILY, ITEMS, CLOTHES, VEHICLES, HAIRSTYLES, MAX_LEVEL, xpForLevel, JOB_COOLDOWN_MS, FACULTIES } = cat;
  const BAG_MAX = 99;

  // ---------- XP & levels (server-authoritative) ----------
  function grantXP(p, n, out) {
    n = Math.max(0, Math.round(n)); if (!n || p.level >= MAX_LEVEL) return;
    p.xp += n; out.xp = (out.xp || 0) + n;
    while (p.level < MAX_LEVEL && p.xp >= xpForLevel(p.level)) {
      p.xp -= xpForLevel(p.level); p.level++;
      (out.ups = out.ups || []).push(p.level);
      const key = 'lv' + p.level;
      if (!p._claims.has(key)) { const bonus = p.level * 100; p.money += bonus; out.ledger.push({ delta: bonus, kind: 'level_bonus', ref: String(p.level) }); out.claims.push({ key, amount: bonus }); out.bonus = (out.bonus || 0) + bonus; }
    }
    if (p.level >= MAX_LEVEL) p.xp = 0;
  }
  const res = () => ({ ok: true, ledger: [], claims: [] });

  // Client-reported activity XP: only whitelisted reasons, server-side caps, minimum gaps and per-game-day limits.
  const XP_RULES = {
    eat: { max: 8, gap: 400, perDay: 40 }, discover: { max: 12, gap: 250, perDay: 160 }, talk: { max: 10, gap: 1500, perDay: 80 },
    study: { max: 39, gap: 20000 }, class: { max: 150, gap: 12000, perDay: 3 }, workout: { max: 50, gap: 9000 }, futsal: { max: 60, gap: 9000 },
    activity: { max: 60, gap: 4000, perDay: 30 }, club: { max: 40, gap: 1000, perDay: 2 }, lap: { max: 40, gap: 20000 },
    tutorial: { max: 50, once: 'tut' }, misc: { max: 10, gap: 3000, perDay: 50 },
  };
  const XP_WINDOW_MS = 10 * 60e3, XP_WINDOW_MAX = 5000;
  function xp(p, req, mem, day, now) {
    const rule = XP_RULES[req.r]; if (!rule) return { ok: false, err: 'Unknown activity' };
    const n = Math.min(rule.max, Math.max(0, Math.round(Number(req.n) || 0))); if (!n) return { ok: false, err: 'Nothing to grant' };
    mem.xpAt = mem.xpAt || {}; mem.xpDay = mem.xpDay || {}; mem.xpWin = (mem.xpWin || []).filter(e => now - e[0] < XP_WINDOW_MS);
    const out = res();
    if (rule.once) { if (p._claims.has(rule.once)) return { ok: false, err: 'Already claimed' }; out.claims.push({ key: rule.once, amount: 0 }); }
    if (rule.gap && now - (mem.xpAt[req.r] || 0) < rule.gap) return { ok: false, err: 'Too fast' };
    const dk = req.r + '@' + day; if (rule.perDay && (mem.xpDay[dk] || 0) >= rule.perDay) return { ok: false, err: 'Daily limit reached' };
    const winSum = mem.xpWin.reduce((s, e) => s + e[1], 0); if (winSum + n > XP_WINDOW_MAX) return { ok: false, err: 'Slow down' };
    mem.xpAt[req.r] = now; mem.xpDay[dk] = (mem.xpDay[dk] || 0) + 1; mem.xpWin.push([now, n]);
    grantXP(p, n, out); return out;
  }

  // ---------- shop ----------
  function buy(p, req, me) {
    if (req.kind === 'item') { const q = Math.max(1, Math.min(20, req.qty | 0 || 1)); if ((p.inventory[req.id] || 0) + q > BAG_MAX) return { ok: false, err: 'Bag is full' }; }
    const before = p.money;
    const r = eco.applyBuy(p, { kind: req.kind, id: String(req.id || ''), qty: req.qty, color: req.color });
    if (!r.ok) return r;
    const out = res(); out.cost = r.cost;
    if (r.cost) out.ledger.push({ delta: -(before - p.money), kind: 'buy', ref: (req.kind + ':' + req.id).slice(0, 40) });
    if (req.kind === 'vehicle') grantXP(p, 60, out);
    if (req.kind === 'rent') me.rental = true;
    if (req.kind === 'fuel') me.mem.refuelAt = Date.now();
    return out;
  }
  function useItem(p, req) {
    const id = String(req.id || ''); if (!ITEMS[id] || !(p.inventory[id] > 0)) return { ok: false, err: 'You do not have that' };
    if (ITEMS[id].gadget || ITEMS[id].deco) return { ok: false, err: 'This item is kept, not used up' };
    p.inventory[id]--; if (!p.inventory[id]) delete p.inventory[id];
    const out = res(); out.used = id; return out;
  }
  function allowance(p, day) {
    const before = p.money; const r = eco.applyAllowance(p, day); if (!r.ok) return { ok: false, err: 'Already received today' };
    const out = res(); out.amount = p.money - before; out.ledger.push({ delta: out.amount, kind: 'allowance', ref: 'day' + day }); return out;
  }

  // ---------- quests / rewards (one-time keys enforced by the claims table) ----------
  function dailyList(day) { const out = []; const a = DAILY.slice(); let s = day * 9301 + 49297; for (let i = 0; i < 3; i++) { s = (s * 233280 + 11) % 1e9; const k = s % a.length; out.push(a.splice(k, 1)[0]); } return out; }
  function claim(p, req, day, mem, now, me) {
    const out = res(); let money = 0, key, xpGain = 0;
    if (req.type === 'main') {
      const q = MAIN_QUESTS[p.quests.main]; if (!q) return { ok: false, err: 'All main quests complete' };
      if (q.id !== req.id) return { ok: false, err: 'Not your current quest' };
      const o = q.obj;
      if (o.type === 'money' && p.money < o.target) return { ok: false, err: 'Objective not met' };
      if (o.type === 'level' && p.level < o.target) return { ok: false, err: 'Objective not met' };
      if (o.type === 'buy' && o.target === 'uniform' && !p.wardrobe.some(w => w.startsWith('uniform'))) return { ok: false, err: 'Objective not met' };
      if (o.type === 'buy' && o.target === 'vehicle' && !p.vehicles.length && !me.rental) return { ok: false, err: 'Objective not met' };
      if (now - (mem.mainAt || 0) < 4000) return { ok: false, err: 'Too fast' };
      mem.mainAt = now; money = q.money; xpGain = q.xp; key = 'main:' + q.id; p.quests.main++;
    } else if (req.type === 'daily') {
      const q = dailyList(day).find(x => x.id === req.id); if (!q) return { ok: false, err: 'Not one of today\'s dailies' };
      if (now - (mem.dailyAt || 0) < 3000) return { ok: false, err: 'Too fast' };
      mem.dailyAt = now; money = q.money; xpGain = q.xp; key = 'daily:' + q.id + '@' + day;
    } else if (req.type === 'side') {
      const q = SIDE_QUESTS.find(x => x.id === req.id); if (!q) return { ok: false, err: 'Unknown task' };
      if (now - (mem.sideAt || 0) < 15000) return { ok: false, err: 'Too fast' };
      mem.sideAt = now; money = q.money; xpGain = q.xp; key = 'side:' + q.id + '@' + day;
    } else if (req.type === 'collect') {
      const n = Number(req.id); if (!Number.isInteger(n) || n < 0 || n >= 25) return { ok: false, err: 'Unknown flower' };
      if (now - (mem.collectAt || 0) < 1500) return { ok: false, err: 'Too fast' };
      mem.collectAt = now; money = eco.COLLECT_REWARD; xpGain = 60; key = 'c' + n;
    } else return { ok: false, err: 'Unknown reward' };
    // legacy (pre-database) keys count as already claimed
    const legacy = key.startsWith('main:') ? key.slice(5) : key.startsWith('daily:') || key.startsWith('side:') ? key.slice(key.indexOf(':') + 1) : null;
    if (p._claims.has(key) || (legacy && p._claims.has(legacy))) { if (req.type === 'main') { out.amount = 0; out.already = true; return out; } return { ok: false, err: 'Already claimed' }; } // main: advance without paying twice
    out.claims.push({ key, amount: money });
    if (money) { p.money += money; out.ledger.push({ delta: money, kind: 'reward', ref: key.slice(0, 40) }); }
    out.amount = money; grantXP(p, xpGain, out); return out;
  }

  // ---------- jobs: server issues a single-use shift ticket, then computes the wage itself ----------
  const MIN_DUR = { keys: 3500, memory: 4500, timing: 3500, quiz: 5000, progress: 3000 };
  const MAX_SPEED = 95; // m/s — faster than any vehicle in the game (AMG GT ≈ 85 m/s tuned); anything quicker is not real travel
  const inMap = (a) => Array.isArray(a) && a.length >= 2 && a.every((v, i) => i > 1 || (Number.isFinite(+v) && Math.abs(+v) < 6000));
  const near = (pos, pt, r) => pos && Math.hypot(pos[0] - pt[0], pos[2] - pt[1]) <= r;
  function jobStart(p, req, mem, now, me) {
    const j = JOBS[req.job]; if (!j) return { ok: false, err: 'Unknown job' };
    if (j.level && p.level < j.level) return { ok: false, err: `Requires level ${j.level}` };
    if (j.req) for (const [k, v] of Object.entries(j.req)) if ((p.skills[k] || 0) < v) return { ok: false, err: `Requires ${k.toUpperCase()} ${v}` };
    mem.jobs = mem.jobs || new Map(); for (const [k, t] of mem.jobs) if (now - t.t0 > 30 * 60e3) mem.jobs.delete(k);
    mem.jobEnd = mem.jobEnd || {};
    if (now - (mem.jobEnd[req.job] || 0) < JOB_COOLDOWN_MS * 0.9) return { ok: false, err: 'Your next shift starts in a few seconds…' };
    if ([...mem.jobs.values()].some(t => t.job === req.job)) for (const [k, t] of mem.jobs) if (t.job === req.job) mem.jobs.delete(k); // restart replaces an unfinished shift
    const t = { job: req.job, t0: now, game: j.game };
    if (api.ext) { const x = api.ext.jobStartExtra(p, req, mem, now, me, t); if (x) { if (!x.ok) return x; const jid = crypto.randomBytes(9).toString('hex'); mem.jobs.set(jid, t); return { ok: true, jid, minMs: 0, order: x.order }; } }
    if (req.job === 'p2p') return { ok: false, err: 'Accept a player order in KU Ride' };
    if (j.game === 'route') {
      const b = req.b; if (!inMap(b)) return { ok: false, err: 'Invalid destination' };
      const a = req.job === 'delivery' ? req.a : (me.st ? [me.st[0], me.st[2]] : null); if (!inMap(a)) return { ok: false, err: 'Invalid pickup' };
      if (req.job === 'taxi' && !p.vehicles.some(v => VEHICLES[v.type] && ['moto', 'scooter', 'sport'].includes(VEHICLES[v.type].type)) && !me.rental) return { ok: false, err: 'You need your own motorbike' };
      const dist = Math.hypot(a[0] - b[0], a[1] - b[1]); if (dist < 100 || dist > 2700) return { ok: false, err: 'Invalid route' };
      Object.assign(t, { a: [+a[0], +a[1]], b: [+b[0], +b[1]], dist, picked: req.job === 'taxi' ? now : 0 });
    }
    const jid = crypto.randomBytes(9).toString('hex'); mem.jobs.set(jid, t);
    return { ok: true, jid, minMs: MIN_DUR[j.game] || 0 };
  }
  function jobStep(req, mem, now, me) {
    const t = mem.jobs && mem.jobs.get(String(req.jid)); if (!t || t.game !== 'route') return { ok: false, err: 'No active job' };
    if (t.picked) return { ok: true };
    if (!near(me.st, t.a, t.pickR || 30)) return { ok: false, err: 'Not at the pickup point' };
    t.picked = now; if (t.oid && api.ext) api.ext.orderPicked(me, t, now); return { ok: true };
  }
  function jobFinish(p, req, mem, now, me) {
    const jid = String(req.jid || ''); const t = mem.jobs && mem.jobs.get(jid); if (!t) return { ok: false, err: 'No active shift (it may have expired)' };
    const j = JOBS[t.job]; const out = res(); let pay = 0, xpGain = 0;
    if (t.job === 'p2p') return { ok: false, err: 'Deliver player orders from KU Ride' };
    if (t.game === 'route') {
      if (!t.picked) return { ok: false, err: 'Pick up first' };
      if (!near(me.st, t.b, 30)) return { ok: false, err: 'Not at the destination' };
      const secs = (now - t.picked) / 1000; if (secs < t.dist / MAX_SPEED) return { ok: false, err: 'Trip too fast to be real' };
      if (api.ext && api.ext.jobFinishExtra(p, t, secs, out)) pay = out.amount;
      else if (t.job === 'delivery') { const limit = t.dist / 7 + 50; const tip = secs <= limit ? Math.round(30 + Math.max(0, limit - secs) * 1.5) : 0; pay = Math.min(j.pay[1] * 1.5, 60 + t.dist * 0.12 + tip); out.tip = tip; }
      else { const limit = t.dist / 9 + 40; pay = Math.min(j.pay[1] * 1.5, 40 + t.dist * 0.15 + (secs <= limit ? 40 : 0)); }
      xpGain = j.xp;
    } else {
      if (now - t.t0 < (MIN_DUR[t.game] || 0)) return { ok: false, err: 'Shift too short' };
      const s = Math.max(0, Math.min(1, Number(req.s) || 0)); const skillB = 1 + Math.max(0, Math.min(100, p.skills[j.skill] || 0)) / 200;
      pay = (j.pay[0] + (j.pay[1] - j.pay[0]) * s) * skillB * (s > 0 ? 1 : 0.3); xpGain = j.xp * (0.4 + s); out.score = s;
    }
    mem.jobs.delete(jid); mem.jobEnd = mem.jobEnd || {}; mem.jobEnd[t.job] = now;
    pay = Math.max(0, Math.round(pay)); out.amount = pay; out.job = t.job;
    if (pay) { p.money += pay; out.ledger.push({ delta: pay, kind: 'job', ref: t.job + ':' + jid.slice(0, 8) }); }
    grantXP(p, xpGain, out); p.counters.jobs = (p.counters.jobs || 0) + 1;
    return out;
  }

  // ---------- client-owned (non-economic) state: bounded and rate-limited ----------
  const FAC_IDS = new Set((FACULTIES || []).map(f => f.id));
  function applyClientState(p, data, mem, now) {
    if (!data || typeof data !== 'object') return;
    const num = (v, a, b, d) => { v = Number(v); return Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : d; };
    const dt = Math.min(120, Math.max(1, (now - (mem.saveAt || now - 10000)) / 1000)); mem.saveAt = now;
    if (data.look && typeof data.look === 'object' && JSON.stringify(data.look).length < 1500) { const L = { ...data.look }; for (const slot of ['top', 'bottom', 'shoes', 'hat', 'glasses', 'bag']) if (L[slot] && !p.wardrobe.includes(L[slot])) L[slot] = null; p.look = L; }
    if (typeof data.faculty === 'string' && (!FAC_IDS.size || FAC_IDS.has(data.faculty))) p.faculty = data.faculty;
    if (typeof data.program === 'string') p.program = data.program.replace(/[<>]/g, '').slice(0, 60);
    p.year = num(data.year, 1, 5, p.year);
    if (data.stats) for (const k of ['health', 'energy', 'hunger', 'mood']) p.stats[k] = num(data.stats[k], 0, 100, p.stats[k]);
    // skills affect wages → they may rise at most ~0.25 points per second of play
    if (data.skills) for (const k of ['int', 'fit', 'cha', 'drv']) { const v = num(data.skills[k], 0, 100, p.skills[k]); p.skills[k] = Math.min(v, (p.skills[k] || 0) + 0.25 * dt + 0.5); }
    p.gpa = num(data.gpa, 0, 4, p.gpa); p.gradePoints = num(data.gradePoints, 0, 1e6, p.gradePoints); p.credits = num(data.credits, 0, 1e5, p.credits); p.classes = num(data.classes, 0, 1e6, p.classes);
    if (data.quests && typeof data.quests === 'object' && JSON.stringify(data.quests).length < 6000) { const main = p.quests.main; p.quests = { side: data.quests.side || {}, daily: data.quests.daily || { day: -1, prog: {}, done: [] }, main }; }
    if (Array.isArray(data.clubs)) p.clubs = data.clubs.slice(0, 8).map(String);
    if (Array.isArray(data.collected)) p.collected = [...new Set(data.collected.slice(0, 40).map(Number).filter(n => Number.isInteger(n) && n >= 0 && n < 40))];
    if (data.counters && typeof data.counters === 'object') for (const k of Object.keys(p.counters)) p.counters[k] = num(data.counters[k], 0, 1e9, p.counters[k]);
    if (Array.isArray(data.vehicleCond)) data.vehicleCond.forEach((c, i) => { const v = p.vehicles[i]; if (!v) return; const nc = num(c, 0, 1, v.condition ?? 1); if (nc < (v.condition ?? 1)) v.condition = nc; }); // wear only goes down; repairs are paid
    if (Array.isArray(data.vehicleFuel)) data.vehicleFuel.forEach((f, i) => { const v = p.vehicles[i]; if (!v) return; const nf = num(f, 0, 1, v.fuel); if (nf <= v.fuel || now - (mem.refuelAt || 0) < 30000) v.fuel = nf; }); // fuel only goes up right after a paid refuel
    // equipped gadgets: only items the player owns
    if (data.equip && typeof data.equip === 'object') { const e = {}; for (const [slot, id] of Object.entries(data.equip)) if (ITEMS[id] && ITEMS[id].gadget === slot && (p.inventory[id] || 0) > 0) e[slot] = id; p.equip = e; }
    // NPC friends / family relationship state written by the client (cosmetic, size-capped)
    if (data.social && typeof data.social === 'object') { const j = JSON.stringify(data.social); if (j.length <= 16000) p.social = data.social; }
    if (Array.isArray(data.pos)) p.pos = [num(data.pos[0], -6000, 6000, 0), num(data.pos[1], -100, 600, 0), num(data.pos[2], -6000, 6000, 0)];
  }

  const api = { grantXP, xp, buy, useItem, allowance, claim, dailyList, jobStart, jobStep, jobFinish, applyClientState, XP_RULES, MIN_DUR, ext: null };
  return api;
}

module.exports = { makeRules };
