// Economy rules shared by the server (authoritative online) and the client (offline mode).
import { ITEMS, CLOTHES, VEHICLES, HAIRSTYLES, RENTAL, JOBS, MAIN_QUESTS, SIDE_QUESTS, DAILY, START_MONEY, DAILY_ALLOWANCE, JOB_COOLDOWN_MS } from './catalog.js';

export const SERVICES = { hotel: 450, condo: 650, gym: 80, pool: 30, clinic: 300, futsal: 40, haircolor: 60, meditate: 0, club: 0 };
export const FUEL_PRICE = 36; // baht / litre
export const COLLECT_REWARD = 150;
export const PROTECTED = ['money', 'wardrobe', 'vehicles', 'claimed', 'hairs', 'bank', 'txlog'];

export function newProfile(o = {}) {
  return {
    v: 1, name: String(o.name || 'Student').slice(0, 18), look: o.look || null, faculty: o.faculty || 'eng', program: o.program || '', year: 1,
    studentId: o.studentId || ('6' + (5 + Math.floor(Math.random() * 3)) + String(Math.floor(Math.random() * 1e8)).padStart(8, '0')),
    money: START_MONEY, xp: 0, level: 1,
    stats: { health: 100, energy: 90, hunger: 80, mood: 75 }, skills: { int: 5, fit: 5, cha: 5, drv: 3 },
    gpa: 0, gradePoints: 0, credits: 0, classes: 0,
    inventory: { water: 1, sandwich: 1 }, wardrobe: ['tee_white', 'jeans', 'sneakers_white', 'backpack', 'shorts', 'sandals', 'dress_pink', 'ku_tee', 'hawaii'], hairs: [],
    vehicles: [], claimed: [], quests: { main: 0, side: {}, daily: { day: -1, prog: {}, done: [] } }, clubs: [], collected: [],
    counters: { meals: 0, jobs: 0, studies: 0, run: 0, drive: 0, talks: 0, chats: 0 },
    lastAllowanceDay: -1, pos: null, txlog: [], created: Date.now(),
  };
}

export function priceOf(kind, id, qty = 1) {
  if (kind === 'item') { const it = ITEMS[id]; return it && it.price > 0 ? it.price * qty : null; }
  if (kind === 'cloth') { const c = CLOTHES[id]; return c && !c.npc ? c.price : null; }
  if (kind === 'vehicle') { const v = VEHICLES[id]; return v ? v.price : null; }
  if (kind === 'hair') { const h = HAIRSTYLES.find(x => x.id === id); return h ? h.price : null; }
  if (kind === 'rent') return RENTAL.price;
  if (kind === 'fuel') return Math.max(0, Math.round(Math.min(80, qty) * FUEL_PRICE));
  if (kind === 'service') return SERVICES[id] ?? null;
  return null;
}

function log(p, delta, what) { p.txlog = (p.txlog || []).slice(-29); p.txlog.push({ t: Date.now(), d: delta, w: String(what).slice(0, 40) }); }

// req: { kind, id, qty, color }
export function applyBuy(p, req) {
  const qty = Math.max(1, Math.min(20, req.qty | 0 || 1));
  const cost = priceOf(req.kind, req.id, req.kind === 'fuel' ? Number(req.qty) || 0 : qty);
  if (cost === null) return { ok: false, err: 'Unknown item' };
  if (req.kind === 'cloth') { const c = CLOTHES[req.id]; if (c.level && p.level < c.level) return { ok: false, err: `Requires level ${c.level}` }; if (p.wardrobe.includes(req.id)) return { ok: false, err: 'Already owned' }; }
  if (req.kind === 'vehicle') { const v = VEHICLES[req.id]; if (v.level && p.level < v.level) return { ok: false, err: `Requires level ${v.level}` }; if (p.vehicles.length >= 6) return { ok: false, err: 'Garage full (6)' }; }
  if (req.kind === 'hair' && p.hairs.includes(req.id)) return { ok: true, cost: 0, money: p.money };
  if (p.money < cost) return { ok: false, err: 'Not enough money' };
  p.money -= cost;
  if (req.kind === 'item') { p.inventory[req.id] = (p.inventory[req.id] || 0) + qty; }
  else if (req.kind === 'cloth') p.wardrobe.push(req.id);
  else if (req.kind === 'vehicle') { const v = VEHICLES[req.id]; const color = v.colors.includes(req.color) ? req.color : v.colors[0]; p.vehicles.push({ type: req.id, color, fuel: 1 }); }
  else if (req.kind === 'hair') p.hairs.push(req.id);
  log(p, -cost, req.kind + ':' + req.id);
  return { ok: true, cost, money: p.money };
}

// req: { job, amount }  memo: per-player transient object for cooldowns
export function applyEarn(p, req, memo, now = Date.now()) {
  const job = JOBS[req.job]; if (!job) return { ok: false, err: 'Unknown job' };
  const amount = Math.round(Number(req.amount) || 0);
  const cap = job.pay[1] * 1.6 + 60;
  if (amount <= 0 || amount > cap) return { ok: false, err: 'Invalid amount' };
  memo.lastEarn = memo.lastEarn || {};
  if (now - (memo.lastEarn[req.job] || 0) < JOB_COOLDOWN_MS * 0.5) return { ok: false, err: 'Too fast' };
  memo.lastEarn[req.job] = now;
  p.money += amount; log(p, amount, 'job:' + req.job);
  return { ok: true, amount, money: p.money };
}

// req: { type: 'main'|'side'|'daily'|'collect', id, day }
export function applyClaim(p, req, day) {
  let money = 0; let key;
  if (req.type === 'main') { const q = MAIN_QUESTS.find(x => x.id === req.id); if (!q) return { ok: false }; money = q.money; key = q.id; }
  else if (req.type === 'side') { const q = SIDE_QUESTS.find(x => x.id === req.id); if (!q) return { ok: false }; money = q.money; key = q.id + '@' + day; }
  else if (req.type === 'daily') { const q = DAILY.find(x => x.id === req.id); if (!q) return { ok: false }; money = q.money; key = q.id + '@' + day; }
  else if (req.type === 'collect') { const n = Number(req.id); if (!(n >= 0 && n < 40)) return { ok: false }; money = COLLECT_REWARD; key = 'c' + n; }
  else if (req.type === 'level') { const n = Number(req.id) | 0; if (n < 2 || n > p.level + 1) return { ok: false }; money = n * 100; key = 'lv' + n; }
  else return { ok: false };
  if (p.claimed.includes(key)) return { ok: false, err: 'Already claimed' };
  p.claimed.push(key); if (p.claimed.length > 600) p.claimed = p.claimed.slice(-600);
  p.money += money; if (money) log(p, money, 'reward:' + req.id);
  return { ok: true, amount: money, money: p.money };
}

export function applyAllowance(p, day) {
  if (p.lastAllowanceDay === day) return { ok: false };
  p.lastAllowanceDay = day; p.money += DAILY_ALLOWANCE; log(p, DAILY_ALLOWANCE, 'allowance');
  return { ok: true, amount: DAILY_ALLOWANCE, money: p.money };
}

export function sanitizeSave(p, data) {
  // merge client-owned fields only
  if (!data || typeof data !== 'object') return;
  const num = (v, a, b, d) => { v = Number(v); return Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : d; };
  if (typeof data.name === 'string') p.name = data.name.replace(/[<>]/g, '').slice(0, 18) || p.name;
  if (data.look && typeof data.look === 'object') p.look = data.look;
  if (typeof data.faculty === 'string') p.faculty = data.faculty.slice(0, 8);
  if (typeof data.program === 'string') p.program = data.program.slice(0, 60);
  p.year = num(data.year, 1, 5, p.year);
  p.xp = num(data.xp, 0, 1e9, p.xp); p.level = num(data.level, 1, 60, p.level);
  if (data.stats) for (const k of ['health', 'energy', 'hunger', 'mood']) p.stats[k] = num(data.stats[k], 0, 100, p.stats[k]);
  if (data.skills) for (const k of ['int', 'fit', 'cha', 'drv']) p.skills[k] = num(data.skills[k], 0, 100, p.skills[k]);
  p.gpa = num(data.gpa, 0, 4, p.gpa); p.gradePoints = num(data.gradePoints, 0, 1e6, p.gradePoints); p.credits = num(data.credits, 0, 1e5, p.credits); p.classes = num(data.classes, 0, 1e6, p.classes);
  if (data.inventory && typeof data.inventory === 'object') { const inv = {}; for (const [k, v] of Object.entries(data.inventory)) if (ITEMS[k]) inv[k] = num(v, 0, 99, 0); p.inventory = inv; }
  if (data.quests && typeof data.quests === 'object') p.quests = data.quests;
  if (Array.isArray(data.clubs)) p.clubs = data.clubs.slice(0, 8).map(String);
  if (Array.isArray(data.collected)) p.collected = data.collected.slice(0, 40).map(Number);
  if (data.counters && typeof data.counters === 'object') for (const k of Object.keys(p.counters)) p.counters[k] = num(data.counters[k], 0, 1e9, p.counters[k]);
  if (Array.isArray(data.vehicleFuel)) data.vehicleFuel.forEach((f, i) => { if (p.vehicles[i]) p.vehicles[i].fuel = num(f, 0, 1, 1); });
  if (data.pos && Array.isArray(data.pos)) p.pos = [num(data.pos[0], -5000, 5000, 0), num(data.pos[1], -100, 500, 0), num(data.pos[2], -5000, 5000, 0)];
  if (data.look && typeof data.look === 'object') { const L = data.look; for (const slot of ['top', 'bottom', 'shoes', 'hat', 'glasses', 'bag']) if (L[slot] && !p.wardrobe.includes(L[slot])) L[slot] = null; }
}
