// Campus life simulation: a population of named people with roles, daily schedules and purposeful activities.
// Instead of random wanderers, a "director" keeps the places around the player populated according to the time of
// day (class changes, lunch rush, afternoon sports…) and every person runs a small plan: walk the sidewalk network
// (A* over the real road graph, keep-left) to a destination, then do something there — sit and eat, chat in a group,
// jog the track, play football or takraw, wait at the motorbike-taxi stand, sell at a food cart, direct traffic.
import * as THREE from 'three';
import { Character, makeLabel, makeBubble } from './character.js';
import { edgePoint } from './roadnet.js';
import { SURF } from './collision.js';
import { randomLook } from './npcs.js';
import { GATE, TRACKP } from './props2.js';
import { GeoBuilder } from './geo.js';
import { motoGeometry } from './vehicle-models.js';
import { FACULTIES } from '../shared/catalog.js';

const NAMES_M = ['Somchai', 'Krit', 'Nattapong', 'Thanakorn', 'Pakorn', 'Ton', 'Bank', 'Mos', 'Golf', 'Arm', 'Beam', 'Film', 'Peach', 'Boss', 'Kao', 'Tae', 'Non', 'Ohm', 'Pond', 'Kong'];
const NAMES_F = ['Ploy', 'Mint', 'Fah', 'Praew', 'Ice', 'Nok', 'Ning', 'Jan', 'Pim', 'Fern', 'Bam', 'May', 'Noey', 'Aom', 'Kwan', 'Bow', 'Pang', 'Namtan', 'View', 'Prang'];
const ADULT_M = ['Lung Chai', 'Pi Daeng', 'Lung Sak', 'Pi Ek', 'Na Wit', 'Pi Tum'];
const ADULT_F = ['Pa Noi', 'Je Daeng', 'Pi Jiap', 'Na Pen', 'Pa Lek', 'Je Kim'];
const LINES = {
  chat: ['เมื่อคืนอ่านหนังสือถึงตีสาม 😩', 'Did you finish the lab report?', 'ไปกินข้าวกันไหม?', 'Quiz tomorrow, right?', 'อาจารย์ปล่อยเร็ววันนี้!', 'Which section are you in?', 'งานกลุ่มส่งวันศุกร์นะ', 'ร้อนมากวันนี้', 'เย็นนี้ไปอ่าวอุดมกัน', 'Midterm is next week…'],
  eat: ['อร่อยมาก!', 'กะเพราไก่ไข่ดาว ที่นี่เด็ดสุด', 'เผ็ดมาก 🔥', 'อิ่มแล้ว ไปเรียนต่อ', 'ข้าวมันไก่ 45 บาทเอง', 'ขอน้ำแข็งเพิ่มหน่อย'],
  sport: ['ส่งมา! ส่งมา!', 'เข้าแล้ว! Goal!', 'Nice pass!', 'อีกลูก!', 'กลับมาช่วยกันตั้งรับ!', 'เตะดี ๆ!'],
  jog: ['อีกสองรอบ!', 'Training for the KU run', 'เหนื่อยแต่ไหว'],
  takraw: ['ฮึบ!', 'Nice save!', 'ส่งมาเลย', 'ตะกร้อลูกนี้สวย'],
  win: ['ไปไหนครับ? วินครับ', 'ไปอ่าวอุดม 30 บาทครับ', 'Need a ride?', 'ขึ้นเลยครับ เร็วทันใจ'],
  vendor: ['รับอะไรดีคะ?', 'หมูปิ้งไม้ละ 10 บาท', 'ร้อน ๆ ค่ะ', 'ขอบคุณค่า', 'ข้าวเหนียวด้วยไหมคะ?'],
  guard: ['ชะลอหน่อยครับ', 'Please slow down', 'จอดตรงนั้นได้เลยครับ'],
  class: ['สายแล้ว!', 'Room 301 อยู่ตึกไหน?', 'Lab เริ่มเก้าโมงนะ', 'ช่วยจดเลคเชอร์ให้หน่อย', 'Running late for class!'],
  shop: ['แวะเซเว่นก่อน', 'ซื้อนมเย็นก่อนเข้าเรียน', 'ข้าวกล่องไมโครเวฟ 😋', 'บัตรเติมเงินหมดพอดี'],
  walk: ['สวัสดีครับ', 'สวัสดีค่ะ', 'Hi!', 'ไปไหนมา?'],
};
const pick = (a) => a[(Math.random() * a.length) | 0];
const rr = (a, b) => a + Math.random() * (b - a);
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const bump = (h, c, w) => Math.max(0, 1 - Math.abs(h - c) / w);
const OK_FOOT = new Set([SURF.WALK, SURF.PLAZA, SURF.GRASS, SURF.URBAN, SURF.PARKING, SURF.SPORT, SURF.DIRT]);

// ---------- time-of-day demand (0..1) ----------
const D = {
  classFlow: (h) => 0.25 + [7.9, 9.0, 10.0, 12.0, 13.0, 15.0, 16.0].reduce((a, c) => Math.max(a, bump(h, c, 0.35)), 0) * 0.75,
  eat: (h) => Math.max(0.12, bump(h, 7.4, 0.8) * 0.55, bump(h, 12.3, 1.1), bump(h, 15.2, 0.6) * 0.4, bump(h, 17.4, 0.8) * 0.75),
  football: (h) => (h > 15.4 ? 1 : (h > 9 && h < 11.5) ? 0.7 : 0),
  jog: (h) => (h < 8.3 ? 0.8 : h > 16 ? 1 : 0.25),
  takraw: (h) => (h > 15.5 || (h > 12 && h < 13)) ? 1 : 0.3,
  social: (h) => 0.55 + bump(h, 12.5, 1.2) * 0.35,
};

// ---------- sidewalk pathfinding on the real road graph ----------
class Walkways {
  constructor(net) {
    this.net = net; this.nodes = net.nodes; this.grid = new Map();
    for (const n of this.nodes) { const k = Math.floor(n.x / 60) + ',' + Math.floor(n.z / 60); let a = this.grid.get(k); if (!a) this.grid.set(k, a = []); a.push(n); }
  }
  nearest(x, z) {
    let best = null, bd = 1e9; const cx = Math.floor(x / 60), cz = Math.floor(z / 60);
    for (let r = 0; r < 4 && !best; r++) for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) { const a = this.grid.get((cx + i) + ',' + (cz + j)); if (a) for (const n of a) { const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; best = n; } } }
    return best;
  }
  // returns waypoints [[x,z]...] along sidewalks (keep-left) ending at the target
  path(sx, sz, tx, tz) {
    const direct = Math.hypot(tx - sx, tz - sz);
    const a = this.nearest(sx, sz), b = this.nearest(tx, tz);
    if (!a || !b || a === b || direct < 45) return [[tx, tz]];
    const open = new Map([[a, 0]]), g = new Map([[a, 0]]), came = new Map(); let it = 0;
    const hf = (n) => Math.hypot(n.x - b.x, n.z - b.z);
    while (open.size && it++ < 3000) {
      let cur = null, cf = 1e18; for (const [n, f] of open) if (f < cf) { cf = f; cur = n; }
      if (cur === b) break; open.delete(cur);
      for (const { e, end } of cur.edges) {
        const nb = end === 0 ? e.n1 : e.n0; const ng = g.get(cur) + e.len * (e.w >= 30 ? 1.15 : 1);
        if (ng < (g.get(nb) ?? 1e18)) { g.set(nb, ng); came.set(nb, { from: cur, e, fwd: end === 0 }); open.set(nb, ng + hf(nb)); }
      }
    }
    if (!came.has(b)) return [[tx, tz]];
    const legs = []; let cur = b; while (cur !== a) { const c = came.get(cur); legs.push(c); cur = c.from; } legs.reverse();
    const pts = []; const P = {};
    for (const { e, fwd } of legs) {
      const lat = (fwd ? 1 : -1) * (e.w / 2 + 1.6);
      const s0 = fwd ? e.trim0 : e.len - e.trim1, s1 = fwd ? e.len - e.trim1 : e.trim0; const n = Math.max(1, Math.ceil(Math.abs(s1 - s0) / 8));
      for (let i = 0; i <= n; i++) { const q = edgePoint(e, s0 + (s1 - s0) * i / n, lat, P); pts.push([q.x, q.z]); }
    }
    pts.push([tx, tz]); return pts;
  }
}

// ---------- the simulation ----------
export class LifeSim {
  constructor(world, scene, opts = {}) {
    this.world = world; this.scene = scene; this.max = opts.max || 60; this.agents = []; this.walk = new Walkways(world.net);
    this.timer = 0; this.flowAcc = 0; this.frame = 0; this.P = {};
    this.buildVenues();
    this.buildProps();
  }
  // ----- venues -----
  buildVenues() {
    const W = this.world, col = W.col, places = W.places;
    const okSpot = (x, z, r = 0.9) => OK_FOOT.has(col.surfAt(x, z)) && !col.blocked(x, z, r) && col.surfAt(x + 2, z) !== SURF.ROAD && col.surfAt(x - 2, z) !== SURF.ROAD && col.surfAt(x, z + 2) !== SURF.ROAD && col.surfAt(x, z - 2) !== SURF.ROAD;
    this.classDoors = Object.values(places).filter(p => ['lecture', 'faculty', 'lab', 'library', 'office', 'hall'].includes(p.kind) && p._door);
    this.dormDoors = Object.values(places).filter(p => p.kind === 'dorm' && p._door);
    this.shopDoors = Object.values(places).filter(p => ['mart', 'coop', 'cafe'].includes(p.kind) && p._door);
    // food courts with stainless tables + red plastic stools (very Thai)
    this.food = [];
    for (const [id, nT] of [['B07', 10], ['FOODST', 8], ['MARKET', 8], ['MOOKATA', 4], ['NOODLE', 4], ['SEAFOOD', 4], ['CAFE', 3], ['BREW', 3], ['MART3', 2]]) {
      const pl = places[id]; if (!pl || !pl._door) continue; const d = pl._door; const tx = -d.nz, tz = d.nx; const tables = [];
      for (let o = 4.5; o <= 16 && tables.length < nT; o += 3.2) for (let s = -9; s <= 9 && tables.length < nT; s += 3.2) {
        const x = d.x + d.nx * o + tx * s, z = d.z + d.nz * o + tz * s; if (!okSpot(x, z, 1.4)) continue;
        if (tables.some(t => Math.hypot(t.x - x, t.z - z) < 2.9)) continue;
        const rot = Math.atan2(d.nx, d.nz);
        const seats = [[0.85, 0], [-0.85, 0], [0, 0.85], [0, -0.85]].map(([a, b]) => { const c = Math.cos(rot), sn = Math.sin(rot); const sx = x + a * c + b * sn, sz = z - a * sn + b * c; return { x: sx, z: sz, h: Math.atan2(x - sx, z - sz), taken: null }; });
        tables.push({ x, z, rot, seats }); col.addCircle(x, z, 0.5, W.heightAt(x, z) + 0.8, 'table');
      }
      if (tables.length) this.food.push({ id, pl, door: d, tables, cap: tables.length * 4 });
    }
    // food carts (vendor + queue): outside the gate near 7-Eleven, and at the food street / market
    this.carts = [];
    const cartAt = (x, z, h, color) => { if (!OK_FOOT.has(col.surfAt(x, z))) return; this.carts.push({ x, z, h, color, vendor: null, queue: [] }); col.addCircle(x, z, 0.9, W.heightAt(x, z) + 1.4, 'cart'); };
    for (const id of ['MART3', 'FOODST', 'MARKET', 'B07']) {
      const pl = places[id]; if (!pl || !pl._door) continue; const d = pl._door; const tx = -d.nz, tz = d.nx;
      for (const s of [-6.5, 6.5]) { const x = d.x + d.nx * 2.2 + tx * s, z = d.z + d.nz * 2.2 + tz * s; if (!col.blocked(x, z, 1.0)) cartAt(x, z, Math.atan2(d.nx, d.nz), pick(['#d9412f', '#2f7fd9', '#e3a21a', '#2fa34e'])); }
    }
    // social spots: lawns / plazas in front of campus buildings + benches
    this.social = [];
    for (const pl of this.classDoors.concat(this.dormDoors)) {
      const d = pl._door; const tx = -d.nz, tz = d.nx;
      for (const [o, s] of [[9, -7], [11, 6], [14, 0]]) { const x = d.x + d.nx * o + tx * s, z = d.z + d.nz * o + tz * s; if (okSpot(x, z, 1.6)) { this.social.push({ x, z, group: null }); break; } }
    }
    this.benches = (W.seats || []).map(s => ({ ...s, pair: null }));
    // sports: stadium track loop, football pitch, takraw circles near dorms
    const T = TRACKP; const R = T.w / 2 - 3.2, Ls = T.d - T.w; const loop = [];
    for (let i = 0; i < 24; i++) { const a = Math.PI + i / 23 * Math.PI; loop.push([T.x + Math.cos(a) * R, T.z - Ls / 2 + Math.sin(a) * R]); }
    for (let i = 0; i < 24; i++) { const a = i / 23 * Math.PI; loop.push([T.x + Math.cos(a) * R, T.z + Ls / 2 + Math.sin(a) * R]); }
    this.track = { pts: loop, cum: [0] }; for (let i = 1; i <= loop.length; i++) { const a = loop[i - 1], b = loop[i % loop.length]; this.track.cum.push(this.track.cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
    this.pitch = { x: T.x, z: T.z, hx: 27, hz: 44, players: [], ball: null, cool: 0 };
    this.takraw = [];
    for (const pl of this.dormDoors) { const d = pl._door; for (const o of [16, 22]) { const x = d.x + d.nx * o, z = d.z + d.nz * o; if (okSpot(x, z, 2.2) && col.surfAt(x, z) === SURF.GRASS) { this.takraw.push({ x, z, players: [], ball: null, t: 0, from: 0, to: 1 }); break; } } }
    // gate: motorbike-taxi stand (outside, Sukhumvit side) + security guard
    this.win = null; for (const [ox, oz] of [[-15, 16], [-15, -16], [-20, 18], [-12, 20]]) { const x = GATE.x + ox, z = GATE.z + oz; if (OK_FOOT.has(col.surfAt(x, z)) && !col.blocked(x, z, 1.2)) { this.win = { x, z, h: Math.PI / 2, riders: [] }; break; } }
    this.guard = { x: GATE.x + 3, z: GATE.z + 12.5, h: -Math.PI / 2, agent: null };
  }
  buildProps() {
    const W = this.world, mats = W.mats, sc = this.scene; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), Y = new THREE.Vector3(0, 1, 0);
    const tables = this.food.flatMap(f => f.tables);
    if (tables.length) {
      const tg = new GeoBuilder(); tg.geometry(new THREE.CylinderGeometry(0.62, 0.62, 0.04, 20), new THREE.Matrix4().makeTranslation(0, 0.74, 0), [0.78, 0.8, 0.82]); tg.geometry(new THREE.CylinderGeometry(0.05, 0.05, 0.72, 8), new THREE.Matrix4().makeTranslation(0, 0.37, 0), [0.6, 0.62, 0.64]); tg.geometry(new THREE.CylinderGeometry(0.3, 0.32, 0.03, 14), new THREE.Matrix4().makeTranslation(0, 0.015, 0), [0.6, 0.62, 0.64]);
      const tm = new THREE.InstancedMesh(tg.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.85 }), tables.length);
      tables.forEach((t, i) => { m4.compose(p.set(t.x, W.heightAt(t.x, t.z), t.z), q.setFromAxisAngle(Y, t.rot), one); tm.setMatrixAt(i, m4); });
      tm.castShadow = true; tm.receiveShadow = true; tm.computeBoundingSphere(); sc.add(tm);
      const sg = new GeoBuilder(); sg.geometry(new THREE.CylinderGeometry(0.17, 0.2, 0.44, 12, 1, true), new THREE.Matrix4().makeTranslation(0, 0.22, 0), [1, 1, 1]); sg.geometry(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 12), new THREE.Matrix4().makeTranslation(0, 0.445, 0), [1, 1, 1]);
      const seats = tables.flatMap(t => t.seats); const sm = new THREE.InstancedMesh(sg.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide }), seats.length); const c = new THREE.Color();
      seats.forEach((s, i) => { m4.compose(p.set(s.x, W.heightAt(s.x, s.z), s.z), q.identity(), one); sm.setMatrixAt(i, m4); sm.setColorAt(i, c.set(Math.random() < 0.8 ? '#c8202a' : '#2a5bc8')); });
      sm.castShadow = true; sm.receiveShadow = true; sm.computeBoundingSphere(); sc.add(sm);
    }
    if (this.carts.length) {
      const cg = new GeoBuilder();
      cg.box(0, 0.5, 0, 1.6, 0.9, 0.8, 0, { color: [0.82, 0.84, 0.86] }); cg.box(0, 1.15, 0.05, 1.5, 0.4, 0.62, 0, { color: [0.75, 0.88, 0.95] });
      for (const [x, z] of [[-0.7, 0.35], [0.7, 0.35], [-0.7, -0.35], [0.7, -0.35]]) cg.box(x, 1.75, z, 0.04, 1.1, 0.04, 0, { color: [0.6, 0.6, 0.6] });
      cg.geometry(new THREE.CylinderGeometry(0.06, 1.35, 0.45, 10, 1, true), new THREE.Matrix4().makeTranslation(0, 2.4, 0), [1, 1, 1]);
      cg.geometry(new THREE.TorusGeometry(0.22, 0.05, 6, 12), new THREE.Matrix4().makeRotationY(Math.PI / 2).premultiply(new THREE.Matrix4().makeTranslation(0.82, 0.25, 0)), [0.1, 0.1, 0.1]);
      const cm = new THREE.InstancedMesh(cg.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.4, side: THREE.DoubleSide }), this.carts.length); const c = new THREE.Color();
      this.carts.forEach((k, i) => { m4.compose(p.set(k.x, W.heightAt(k.x, k.z), k.z), q.setFromAxisAngle(Y, k.h), one); cm.setMatrixAt(i, m4); cm.setColorAt(i, c.set(k.color)); });
      cm.castShadow = true; cm.receiveShadow = true; cm.computeBoundingSphere(); sc.add(cm);
    }
    if (this.win) {
      const n = 5; const mm = new THREE.InstancedMesh(motoGeometry('wave'), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.3 }), n); const c = new THREE.Color();
      this.win.motos = [];
      for (let i = 0; i < n; i++) { const x = this.win.x + 0, z = this.win.z + (i - 2) * 1.25; this.win.motos.push({ x, z }); m4.compose(p.set(x, W.heightAt(x, z), z), q.setFromAxisAngle(Y, this.win.h), one); mm.setMatrixAt(i, m4); mm.setColorAt(i, c.set(pick(['#1b1b1b', '#c0392b', '#2c3e50', '#7f8c8d', '#f5f5f0']))); W.col.addCircle(x, z, 0.5, W.heightAt(x, z) + 1.1, 'moto'); }
      mm.castShadow = true; mm.computeBoundingSphere(); sc.add(mm);
      // simple roof shelter for the win
      const sg = new GeoBuilder(); for (const [x, z] of [[-1.2, -3.6], [1.2, -3.6], [-1.2, 3.6], [1.2, 3.6]]) sg.box(x, 1.3, z, 0.08, 2.6, 0.08, 0, { color: [0.5, 0.52, 0.55] }); sg.box(0, 2.65, 0, 3.0, 0.08, 8.0, 0, { color: [0.95, 0.55, 0.15] });
      const sh = new THREE.Mesh(sg.build(), mats.paint); sh.position.set(this.win.x, W.heightAt(this.win.x, this.win.z), this.win.z); sh.castShadow = true; sc.add(sh);
    }
    // balls
    const ballMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 });
    this.pitch.ball = { m: new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), ballMat), x: this.pitch.x, y: 0.11, z: this.pitch.z, vx: 0, vy: 0, vz: 0 }; this.pitch.ball.m.castShadow = true; sc.add(this.pitch.ball.m); this.pitch.ball.m.visible = false;
    const tkMat = new THREE.MeshStandardMaterial({ color: 0xd9a032, roughness: 0.7, wireframe: false });
    for (const k of this.takraw) { k.ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 1), tkMat); k.ball.castShadow = true; k.ball.visible = false; sc.add(k.ball); }
  }

  // ----- agents -----
  makeAgent(role, opts = {}) {
    const look = randomLook(); const f = look.gender === 'f';
    let name;
    if (role === 'student' || role === 'athlete') {
      name = pick(f ? NAMES_F : NAMES_M);
      if (opts.uniform !== false && role === 'student' && Math.random() < 0.75) { look.top = f ? 'uniform_f' : 'uniform_m'; look.bottom = f ? 'skirt_black' : 'slacks_black'; look.shoes = 'shoes_black'; }
      if (role === 'athlete') { look.top = opts.jersey || pick(['ku_tee', 'tee_white', 'jersey_blue']); look.bottom = 'shorts'; look.shoes = 'sneakers_white'; look.bag = null; look.hat = null; }
    } else {
      name = pick(f ? ADULT_F : ADULT_M); look.bag = null;
      if (role === 'win') { look.top = 'vest_win'; look.bottom = 'jeans'; look.hat = Math.random() < 0.4 ? 'cap_black' : null; }
      if (role === 'guard') { look.top = 'guard_shirt'; look.bottom = 'slacks_black'; look.shoes = 'shoes_black'; look.hat = 'cap_black'; }
      if (role === 'vendor') { look.top = 'vendor_tee'; look.bottom = f ? 'skirt_black' : 'jeans'; look.hat = Math.random() < 0.5 ? 'bucket' : null; }
      if (role === 'local') { look.top = pick(['tee_white', 'tee_black', 'polo_navy', 'hawaii', 'tee_red', 'tee_yellow']); look.bottom = pick(['jeans', 'shorts', 'chinos']); }
    }
    if (opts.look) Object.assign(look, opts.look);
    const faculty = pick(FACULTIES).id;
    const c = new Character(look);
    const a = { role, name, faculty, look, c, x: 0, z: 0, y: 0, h: 0, speed: 0, vx: 0, vz: 0, wp: [], wpi: 0, plan: [], step: null, emote: null, act: null, t: 0, animAcc: 0, stuck: 0, lastD: 1e9, walkSpeed: rr(1.2, 1.5), topic: opts.topic || role };
    const label = makeLabel(name); label.position.y = 2.05; label.visible = false; c.root.add(label); a.label = label;
    const bub = makeBubble(); bub.position.y = 2.55; c.root.add(bub); a.bubble = bub;
    a.talkLine = () => pick(LINES[a.topic] || LINES.walk);
    this.scene.add(c.root); this.agents.push(a); return a;
  }
  place(a, x, z, h = 0) { a.x = x; a.z = z; a.h = h; a.y = this.world.heightAt(x, z); }
  remove(a) { a.dead = true; a.c.root.removeFromParent(); a.c.mesh.geometry.dispose(); if (a.seat) a.seat.taken = null; if (a.onRemove) a.onRemove(); }
  say(a, kind, chance = 1) { if (Math.random() > chance || a.bubble.visible || a.dist > 28) return; a.bubble.userData.show(pick(LINES[kind] || LINES.walk)); a.bubble.userData.until = performance.now() + 3500; if (this.onSay) this.onSay(a, kind); }
  goto(a, tx, tz, then) { const pts = this.walk.path(a.x, a.z, tx, tz); a.wp = pts; a.wpi = 0; a.act = 'walk'; a.then = then; a.stuck = 0; }
  inView(x, z, cam) { const dx = x - cam.position.x, dz = z - cam.position.z; const d = Math.hypot(dx, dz); if (d > 70) return false; const f = this._camF; return (dx * f.x + dz * f.z) / (d || 1) > 0.35; }

  // ----- director: keep venues near the player populated according to time of day -----
  direct(focus, cam, h) {
    const near = (x, z, r = 170) => (x - focus.x) ** 2 + (z - focus.z) ** 2 < r * r;
    const budgetLeft = () => this.max - this.agents.length;
    // fixed roles
    if (this.guard && near(this.guard.x, this.guard.z) && !this.guard.agent && budgetLeft() > 0) { const a = this.makeAgent('guard', { topic: 'guard' }); this.place(a, this.guard.x, this.guard.z, this.guard.h); a.act = 'pose'; a.pose = 'guard'; a.home = this.guard; this.guard.agent = a; a.onRemove = () => { this.guard.agent = null; }; }
    if (this.win && near(this.win.x, this.win.z)) while (this.win.riders.length < 5 && budgetLeft() > 0) {
      const i = this.win.riders.length; const a = this.makeAgent('win', { topic: 'win', look: { gender: 'm' } }); const m = this.win.motos[i];
      if (i < 3) { this.place(a, m.x, m.z, this.win.h); a.y -= 0.12; a.act = 'pose'; a.pose = 'sitride'; a.fixY = true; }
      else { this.place(a, this.win.x - 1.8, this.win.z + (i === 3 ? -0.6 : 0.6), i === 3 ? 0.3 : Math.PI - 0.3); a.act = 'pose'; a.pose = 'talk'; }
      this.win.riders.push(a); a.onRemove = () => { this.win.riders = this.win.riders.filter(r => r !== a); };
    }
    for (const k of this.carts) if (near(k.x, k.z) && !k.vendor && budgetLeft() > 0) {
      const a = this.makeAgent('vendor', { topic: 'vendor' }); const bx = k.x - Math.sin(k.h) * 0.9, bz = k.z - Math.cos(k.h) * 0.9; this.place(a, bx, bz, k.h); a.act = 'pose'; a.pose = 'work'; k.vendor = a; a.onRemove = () => { k.vendor = null; };
    }
    // eating at food courts (sit at a free stool)
    const eatW = D.eat(h);
    for (const f of this.food) {
      if (!near(f.door.x, f.door.z)) continue;
      const want = Math.round(f.cap * 0.75 * eatW), have = f.tables.reduce((a, t) => a + t.seats.filter(s => s.taken).length, 0);
      if (have < want && budgetLeft() > 4) {
        const free = f.tables.flatMap(t => t.seats).filter(s => !s.taken); if (!free.length) continue;
        // groups of friends sit together at one table
        const t = pick(f.tables.filter(t => t.seats.some(s => !s.taken))); const n = Math.min(t.seats.filter(s => !s.taken).length, 1 + ((Math.random() * 3) | 0));
        for (let i = 0; i < n; i++) {
          const s = t.seats.find(s => !s.taken); if (!s) break; const a = this.makeAgent(Math.random() < 0.85 ? 'student' : 'local', { topic: 'eat' }); s.taken = a; a.seat = s;
          if (this.inView(s.x, s.z, cam)) { const d = f.door; this.place(a, d.x + d.nx * 1.5, d.z + d.nz * 1.5, Math.atan2(d.nx, d.nz)); this.goto(a, s.x, s.z, () => this.sitEat(a)); }
          else { this.place(a, s.x, s.z, s.h); this.sitEat(a, rr(0.1, 0.9)); }
        }
      }
    }
    // football (5-a-side-ish) on the stadium pitch
    const P = this.pitch; const wantFb = near(P.x, P.z, 220) ? Math.round(10 * D.football(h)) : 0;
    if (P.players.length < wantFb && budgetLeft() > 0) { const team = P.players.length % 2; const a = this.makeAgent('athlete', { topic: 'sport', jersey: team ? 'jersey_red' : 'jersey_blue' }); a.team = team; a.home = this.formation(P.players.filter(p => p.team === team).length); this.place(a, P.x + a.home[0], P.z + a.home[1] * (team ? -1 : 1)); a.act = 'football'; a.runSpeed = rr(4.6, 6.2); P.players.push(a); a.onRemove = () => { P.players = P.players.filter(p => p !== a); }; }
    else if (P.players.length > wantFb + 1) this.remove(P.players[P.players.length - 1]);
    // joggers on the track
    const joggers = this.agents.filter(a => a.act === 'jog').length, wantJog = near(P.x, P.z, 220) ? Math.round(7 * D.jog(h)) : 0;
    if (joggers < wantJog && budgetLeft() > 0) { const a = this.makeAgent('athlete', { topic: 'jog', jersey: pick(['ku_tee', 'tee_white', 'tee_black']) }); a.trackS = Math.random() * this.track.cum[this.track.cum.length - 1]; a.jogSpeed = rr(2.6, 3.6); const q = this.trackPoint(a.trackS); this.place(a, q[0], q[1]); a.act = 'jog'; }
    // takraw circles
    for (const k of this.takraw) {
      if (!near(k.x, k.z, 150)) continue; const want = D.takraw(h) > 0.5 ? 4 : 0;
      while (k.players.length < want && budgetLeft() > 0) { const i = k.players.length; const a = this.makeAgent('athlete', { topic: 'takraw', jersey: pick(['tee_white', 'ku_tee', 'tee_black', 'tee_red']), look: { gender: 'm' } }); const ang = i / 4 * Math.PI * 2; this.place(a, k.x + Math.cos(ang) * 1.7, k.z + Math.sin(ang) * 1.7, Math.atan2(-Math.cos(ang), -Math.sin(ang))); a.act = 'pose'; a.pose = null; a.takraw = k; k.players.push(a); a.onRemove = () => { k.players = k.players.filter(p => p !== a); }; }
    }
    // chatting groups on lawns and friends on benches
    const socW = D.social(h);
    for (const s of this.social) {
      if (!near(s.x, s.z, 150) || s.group || Math.random() > 0.25 * socW || budgetLeft() < 4) continue;
      const n = 2 + ((Math.random() * 3) | 0); const g = { members: [], speaker: 0, t: 0, spot: s }; s.group = g;
      for (let i = 0; i < n; i++) { const a = this.makeAgent('student', { topic: 'chat' }); const ang = i / n * Math.PI * 2 + Math.random() * 0.3; const r = 0.75 + n * 0.12; this.place(a, s.x + Math.cos(ang) * r, s.z + Math.sin(ang) * r, Math.atan2(-Math.cos(ang), -Math.sin(ang))); a.act = 'group'; a.group = g; a.life = rr(60, 200); g.members.push(a); a.onRemove = () => { g.members = g.members.filter(m => m !== a); if (!g.members.length) s.group = null; }; }
    }
    for (const b of this.benches) {
      if (!near(b.x, b.z, 120) || b.pair || Math.random() > 0.08 * socW || budgetLeft() < 3) continue;
      const pair = []; b.pair = pair; const tx = Math.cos(b.rot || 0), tz = -Math.sin(b.rot || 0);
      for (const s of [-0.45, 0.45]) { const a = this.makeAgent('student', { topic: 'chat' }); this.place(a, b.x + tx * s, b.z + tz * s, (b.rot || 0) + Math.PI); a.act = 'pose'; a.pose = 'sitTalk'; a.life = rr(60, 180); a.fixY = true; a.y = b.y - 0.45; pair.push(a); a.onRemove = () => { b.pair = null; }; }
      // face the bench's forward direction (benches face away from the backrest)
      pair.forEach(a => { a.h = (b.rot || 0); });
    }
    // purposeful walkers: class changes, going to eat, going to 7-Eleven, heading home
    this.flowAcc += D.classFlow(h) * 0.9;
    while (this.flowAcc >= 1 && budgetLeft() > 6) {
      this.flowAcc -= 1;
      const src = this.nearDoor(focus, cam); if (!src) break;
      const a = this.makeAgent('student', { topic: 'class' }); const d = src._door; this.place(a, d.x + d.nx * 1.2, d.z + d.nz * 1.2, Math.atan2(d.nx, d.nz));
      const r = Math.random(); let dst;
      if (eatW > 0.6 && r < 0.5 && this.food.length) { const f = pick(this.food); dst = f.door; a.topic = 'eat'; }
      else if (h > 16.8 && r < 0.6 && this.dormDoors.length) { dst = pick(this.dormDoors)._door; a.topic = 'chat'; }
      else if (r < 0.15 && this.shopDoors.length) { dst = pick(this.shopDoors)._door; a.topic = 'shop'; }
      else { const opts = this.classDoors.filter(p => p !== src && Math.hypot(p._door.x - d.x, p._door.z - d.z) < 420); dst = (opts.length ? pick(opts) : src)._door; }
      if (h > 7.6 && h < 8.1 || bump(h, 13, 0.15) > 0) a.walkSpeed = rr(1.6, 2.0); // hurrying to class
      this.goto(a, dst.x + dst.nx * 1.0, dst.z + dst.nz * 1.0, () => { this.say(a, a.topic, 0.15); this.remove(a); }); // goes inside
    }
    // town life outside campus: people walking along Sukhumvit / going to 7-Eleven
    const m3 = this.world.places.MART3; if (m3 && near(m3._door.x, m3._door.z) && Math.random() < 0.35 && budgetLeft() > 8) {
      const a = this.makeAgent(Math.random() < 0.6 ? 'local' : 'student', { topic: 'shop', uniform: false }); const d = m3._door; const side = Math.random() < 0.5 ? -1 : 1;
      const sx = d.x + d.nx * 2 - d.nz * side * 60, sz = d.z + d.nz * 2 + d.nx * side * 60; this.place(a, sx, sz, 0);
      if (Math.random() < 0.6) this.goto(a, d.x + d.nx, d.z + d.nz, () => this.remove(a));
      else { const k = this.carts.find(c => Math.hypot(c.x - d.x, c.z - d.z) < 12 && c.queue.length < 3); if (k) { const qx = k.x + Math.sin(k.h) * (1.3 + k.queue.length * 0.8), qz = k.z + Math.cos(k.h) * (1.3 + k.queue.length * 0.8); k.queue.push(a); a.cart = k; this.goto(a, qx, qz, () => { a.act = 'pose'; a.pose = null; a.h = k.h + Math.PI; a.life = rr(8, 20); a.after = () => { k.queue = k.queue.filter(q => q !== a); this.goto(a, sx * 2 - d.x, sz * 2 - d.z, () => this.remove(a)); }; }); } else this.goto(a, d.x - d.nz * side * 60, d.z + d.nx * side * 60, () => this.remove(a)); }
    }
  }
  sitEat(a, progress = 0) { const s = a.seat; a.x = s.x; a.z = s.z; a.h = s.h; a.y = this.world.heightAt(s.x, s.z); a.act = 'pose'; a.pose = 'eat'; a.fixY = true; a.life = rr(90, 260) * (1 - progress);
    a.after = () => { const tbl = s; s.taken = null; a.seat = null; a.fixY = false; const dst = pick(this.classDoors.concat(this.dormDoors)); if (dst) this.goto(a, dst._door.x, dst._door.z, () => this.remove(a)); else this.remove(a); }; }
  nearDoor(focus, cam) {
    const cands = this.classDoors.concat(this.dormDoors).filter(p => { const d = p._door; const dd = Math.hypot(d.x - focus.x, d.z - focus.z); return dd < 150 && dd > 12; });
    return cands.length ? pick(cands) : null;
  }
  // roles relative to own goal (negative z = own half): keeper, two backs, two wings, striker
  formation(j) { const F = [[0, -36], [-10, -20], [10, -20], [-14, 0], [14, 0], [0, 14]]; return F[j % F.length].slice(); }
  trackPoint(s) { const T = this.track, L = T.cum[T.cum.length - 1]; s = ((s % L) + L) % L; let i = 1; while (T.cum[i] < s) i++; const a = T.pts[i - 1], b = T.pts[i % T.pts.length]; const k = (s - T.cum[i - 1]) / (T.cum[i] - T.cum[i - 1]); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; }

  // ----- per-frame -----
  update(dt, focus, cam, dangers, hour) {
    this.frame++; this._camF = new THREE.Vector3(); cam.getWorldDirection(this._camF);
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 1.0; this.direct(focus, cam, hour);
      for (const a of this.agents) { const d = Math.hypot(a.x - focus.x, a.z - focus.z); if (d > 200) this.remove(a); }
      this.agents = this.agents.filter(a => !a.dead);
    }
    this.updateFootball(dt);
    for (const k of this.takraw) this.updateTakraw(k, dt);
    // conversation turn-taking
    for (const s of this.social) { const g = s.group; if (!g || !g.members.length) continue; g.t -= dt; if (g.t <= 0) { g.t = rr(2.5, 5.5); g.speaker = (Math.random() * g.members.length) | 0; const sp = g.members[g.speaker]; if (sp) this.say(sp, 'chat', 0.3); if (Math.random() < 0.12) g.laugh = 1.6; } if (g.laugh > 0) g.laugh -= dt; }
    const camP = cam.position;
    for (const a of this.agents) {
      if (a.dead) continue;
      a.dist = Math.hypot(a.x - camP.x, a.z - camP.z);
      a.t += dt;
      // vehicles: step aside
      let flee = null; for (const v of dangers) { const dx = a.x - v.x, dz = a.z - v.z, d = Math.hypot(dx, dz); if (d < 5 && Math.abs(v.speed) > 4) flee = [dx / (d || 1), dz / (d || 1)]; }
      if (flee && !a.fixY) { a.x += flee[0] * dt * 5; a.z += flee[1] * dt * 5; a.h = Math.atan2(flee[0], flee[1]); a.speed = 5; if (Math.random() < 0.01) this.say(a, 'walk', 1); }
      else if (a.act === 'walk') this.stepWalk(a, dt);
      else if (a.act === 'jog') { a.trackS += a.jogSpeed * dt; const q = this.trackPoint(a.trackS), q2 = this.trackPoint(a.trackS + 1.5); a.x = q[0]; a.z = q[1]; a.h = Math.atan2(q2[0] - q[0], q2[1] - q[1]); a.speed = a.jogSpeed; }
      else if (a.act === 'group') { const g = a.group; const sp = g.members[g.speaker]; a.speed = 0; if (sp && sp !== a) { const th = Math.atan2(sp.x - a.x, sp.z - a.z); let dh = th - a.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); a.h += dh * Math.min(1, dt * 2); } a.pose = g.laugh > 0 ? 'laugh' : sp === a ? 'talk' : 'listen'; this.tickLife(a, dt); }
      else if (a.act === 'pose') { a.speed = 0; this.tickLife(a, dt); if (a.pose === 'work' && Math.random() < 0.002) this.say(a, 'vendor', 0.5); }
      else if (a.act === 'football') { /* driven by updateFootball */ }
      if (!a.fixY) a.y = this.world.heightAt(a.x, a.z);
      // render + animation LOD
      const vis = a.dist < 175; a.c.root.visible = vis; if (!vis) continue;
      a.c.root.position.set(a.x, a.y, a.z); a.c.root.rotation.y = a.h;
      const every = a.dist < 45 ? 1 : a.dist < 100 ? 3 : 6; a.animAcc += dt;
      if (this.frame % every === 0) { const emote = a.emote || (a.speed < 0.25 ? a.pose : null); a.c.animate(a.animAcc, { mode: 'walk', speed: Math.min(a.speed, 7.5), grounded: true, emote, kickT: a.kickT, accel: 0, turn: 0 }); a.animAcc = 0; }
      if (a.kickT !== undefined) { a.kickT += dt * 2.2; if (a.kickT > 1) a.kickT = undefined; }
      a.label.visible = a.dist < 9;
      if (a.bubble.visible && performance.now() > a.bubble.userData.until) a.bubble.visible = false;
    }
    this.agents = this.agents.filter(a => !a.dead);
  }
  tickLife(a, dt) { if (a.life === undefined) return; a.life -= dt; if (a.life <= 0) { a.life = undefined; const f = a.after; a.after = null; if (f) f(); else if (a.group) { this.remove(a); } else if (a.pose === 'sitTalk') this.remove(a); } }
  stepWalk(a, dt) {
    const tgt = a.wp[a.wpi]; if (!tgt) { a.act = 'idle'; a.speed = 0; const f = a.then; a.then = null; if (f) f(); return; }
    const dx = tgt[0] - a.x, dz = tgt[1] - a.z, d = Math.hypot(dx, dz);
    const last = a.wpi === a.wp.length - 1;
    if (d < (last ? 0.35 : 1.2)) { a.wpi++; return; }
    const th = Math.atan2(dx, dz); let dh = th - a.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); a.h += dh * Math.min(1, dt * 6);
    const sp = a.walkSpeed * (last && d < 2 ? Math.max(0.4, d / 2) : 1) * (Math.abs(dh) > 1.2 ? 0.5 : 1);
    let nx = a.x + Math.sin(a.h) * sp * dt, nz = a.z + Math.cos(a.h) * sp * dt;
    // personal space: gentle separation from nearby people
    for (const o of this.agents) { if (o === a || o.dead) continue; const ox = nx - o.x, oz = nz - o.z, od = ox * ox + oz * oz; if (od < 0.5 && od > 1e-6) { const k = (0.7 - Math.sqrt(od)) * 0.5; nx += ox * k; nz += oz * k; } }
    if (!(last && d < 1.6)) { const r = this.world.col.resolve(nx, nz, 0.3, a.y, 1.7); nx = r.x; nz = r.z; }
    const moved = Math.hypot(nx - a.x, nz - a.z); a.speed = moved / Math.max(dt, 1e-3); a.x = nx; a.z = nz;
    // stuck → skip ahead (or vanish when far from the camera)
    if (d > a.lastD - 0.01) a.stuck += dt; else a.stuck = 0; a.lastD = Math.min(d, a.lastD); if (Math.abs(d - a.lastD) > 2) a.lastD = d;
    if (a.stuck > 3) { a.stuck = 0; a.lastD = 1e9; if (a.dist > 40) { a.x = tgt[0]; a.z = tgt[1]; } a.wpi++; }
  }
  // ----- sports -----
  updateFootball(dt) {
    const P = this.pitch, B = P.ball; const on = P.players.length >= 4; B.m.visible = on && P.players.some(p => p.dist < 175);
    if (!on) { for (const p of P.players.slice()) if (p.act === 'football') { P.players = P.players.filter(q => q !== p); p.onRemove = null; const d = pick(this.dormDoors.length ? this.dormDoors : this.classDoors); if (d) this.goto(p, d._door.x, d._door.z, () => this.remove(p)); else this.remove(p); } return; }
    const g = 9.81;
    // ball physics: gravity, bounce, rolling friction, pitch bounds
    B.vy -= g * dt; B.x += B.vx * dt; B.y += B.vy * dt; B.z += B.vz * dt;
    if (B.y < 0.11) { B.y = 0.11; if (B.vy < -1) B.vy = -B.vy * 0.45; else B.vy = 0; const sp = Math.hypot(B.vx, B.vz); if (sp > 0) { const k = Math.max(0, sp - 1.6 * dt) / sp; B.vx *= k; B.vz *= k; } }
    B.vx *= 1 - 0.05 * dt; B.vz *= 1 - 0.05 * dt;
    if (Math.abs(B.x - P.x) > P.hx + 2) { B.vx = -B.vx * 0.5; B.x = P.x + Math.sign(B.x - P.x) * (P.hx + 2); }
    if (Math.abs(B.z - P.z) > P.hz + 2) {
      if (Math.abs(B.x - P.x) < 3.66) { const sc = P.players.filter(p => p.team === (B.z > P.z ? 0 : 1)); if (sc.length) this.say(pick(sc), 'sport', 1); }
      B.x = P.x; B.z = P.z; B.vx = B.vz = B.vy = 0;
    }
    B.m.position.set(B.x, this.world.heightAt(B.x, B.z) + B.y, B.z); B.m.rotation.x += B.vz * dt * 4; B.m.rotation.z -= B.vx * dt * 4;
    P.cool -= dt;
    // nearest player of each team chases; others hold formation shifted towards the ball
    for (const team of [0, 1]) {
      const ps = P.players.filter(p => p.team === team); let ch = null, bd = 1e9;
      for (const p of ps) { const d = Math.hypot(p.x - B.x, p.z - B.z); if (d < bd) { bd = d; ch = p; } }
      for (const p of ps) {
        const dir = team ? -1 : 1; let tx, tz;
        if (p === ch) { tx = B.x - B.vx * 0.15; tz = B.z - B.vz * 0.15 - dir * 0.6; }
        else { tx = P.x + p.home[0] * 0.85 + (B.x - P.x) * 0.35; tz = P.z + p.home[1] * dir * 0.85 + (B.z - P.z) * 0.45; }
        const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
        const want = p === ch ? p.runSpeed : Math.min(p.runSpeed * 0.6, d * 0.8);
        const vx = d > 0.2 ? dx / d * want : 0, vz = d > 0.2 ? dz / d * want : 0;
        p.vx += (vx - p.vx) * Math.min(1, dt * 4); p.vz += (vz - p.vz) * Math.min(1, dt * 4);
        p.x += p.vx * dt; p.z += p.vz * dt; p.speed = Math.hypot(p.vx, p.vz);
        const fh = p.speed > 0.5 ? Math.atan2(p.vx, p.vz) : Math.atan2(B.x - p.x, B.z - p.z); let dh = fh - p.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); p.h += dh * Math.min(1, dt * 7);
        // kick: towards a teammate further up the pitch or at goal
        if (p === ch && bd < 0.9 && B.y < 0.5 && P.cool <= 0) {
          const goal = [P.x, P.z + dir * (P.hz + 2)]; const mates = ps.filter(m => m !== p && (m.z - p.z) * dir > 2);
          const tgt = Math.abs(goal[1] - p.z) < 22 || !mates.length ? goal : [pick(mates).x, pick(mates).z];
          const kx = tgt[0] - B.x, kz = tgt[1] - B.z, kd = Math.hypot(kx, kz) || 1; const power = Math.min(19, 6 + kd * 0.45);
          B.vx = kx / kd * power + rr(-0.8, 0.8); B.vz = kz / kd * power; B.vy = kd > 18 ? rr(2, 5) : rr(0, 1.2); p.kickT = 0; P.cool = 0.45; if (this.onKick) this.onKick(B.x, B.y, B.z, power);
          if (Math.random() < 0.08) this.say(p, 'sport', 1);
        }
      }
    }
  }
  updateTakraw(k, dt) {
    if (k.players.length < 3) { if (k.ball) k.ball.visible = false; return; }
    k.ball.visible = k.players[0].dist < 120;
    k.t += dt / 0.95;
    if (k.t >= 1) { k.t = 0; k.from = k.to; let n; do { n = (Math.random() * k.players.length) | 0; } while (n === k.from && k.players.length > 1); k.to = n; const p = k.players[k.from]; p.kickT = 0; if (this.onKick) this.onKick(k.ball.position.x, k.ball.position.y, k.ball.position.z, 5); if (Math.random() < 0.05) this.say(p, 'takraw', 1); }
    const a = k.players[k.from], b = k.players[k.to]; if (!a || !b) return; const u = k.t;
    const x = a.x + (b.x - a.x) * u, z = a.z + (b.z - a.z) * u, y = this.world.heightAt(x, z) + 0.6 + Math.sin(u * Math.PI) * 2.6;
    k.ball.position.set(x, y, z); k.ball.rotation.x += dt * 8;
    for (const p of k.players) { p.pose = 'juggle'; p.speed = 0; const th = Math.atan2(k.ball.position.x - p.x, k.ball.position.z - p.z); let dh = th - p.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); p.h += dh * Math.min(1, dt * 3); }
  }
  nearest(x, z, r = 2.6) { let best = null, bd = r; for (const a of this.agents) { if (a.dead) continue; const d = Math.hypot(a.x - x, a.z - z); if (d < bd) { bd = d; best = a; } } return best; }
}
