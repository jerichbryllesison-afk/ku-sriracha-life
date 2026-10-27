// Props for the real map: gate, fence, stadium, beach & pier, hill landmark, street furniture, parked vehicles, trees.
import * as THREE from 'three';
import { MAP, groundHeight, flattenRect } from './mapdata.js';
import { SURF } from './collision.js';
import { hex, GeoBuilder } from './geo.js';
import { hipRoof } from './buildings.js';
import { carGeometry, motoGeometry } from './vehicle-models.js';
import { inPoly, CAMPUS_POLY } from './polybuild.js';
import { edgePoint } from './roadnet.js';

const M4 = () => new THREE.Matrix4();
export const GATE = { x: -1064, z: 166, w: 22 };
export const TRACKP = { x: -934, z: 337, w: 84, d: 160 };
export const PIERP = { x0: -1328, x1: -1470, z: -84, w: 6 };

const FONT = {
  K: ['1...1', '1..1.', '1.1..', '11...', '1.1..', '1..1.', '1...1'], U: ['1...1', '1...1', '1...1', '1...1', '1...1', '1...1', '.111.'],
  S: ['.1111', '1....', '1....', '.111.', '....1', '....1', '1111.'], R: ['1111.', '1...1', '1...1', '1111.', '1.1..', '1..1.', '1...1'],
  I: ['.111.', '..1..', '..1..', '..1..', '..1..', '..1..', '.111.'], A: ['.111.', '1...1', '1...1', '11111', '1...1', '1...1', '1...1'],
  C: ['.1111', '1....', '1....', '1....', '1....', '1....', '.1111'], H: ['1...1', '1...1', '1...1', '11111', '1...1', '1...1', '1...1'], ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};

// before terrain is meshed: flatten pads for special structures
export function prepareGround(ctx) {
  const T = TRACKP; const h = groundHeight(T.x, T.z);
  flattenRect(T.x - T.w / 2 - 4, T.z - T.d / 2 - 4, T.x + T.w / 2 + 4, T.z + T.d / 2 + 4, h, 14);
  const gh = groundHeight(GATE.x, GATE.z); flattenRect(GATE.x - 8, GATE.z - 16, GATE.x + 8, GATE.z + 16, gh, 8);
  for (const r of ctx.rects) { const y = groundHeight(r.x, r.z); flattenRect(r.x - r.w / 2 - 1, r.z - r.d / 2 - 1, r.x + r.w / 2 + 1, r.z + r.d / 2 + 1, y, 6); }
}

// find a free spot for a procedural structure near a target
export function findSpot(col, cx, cz, w, d) {
  const ok = (x, z) => { for (let zz = z - d / 2 - 2; zz <= z + d / 2 + 2; zz += 2) for (let xx = x - w / 2 - 2; xx <= x + w / 2 + 2; xx += 2) { const s = col.surfAt(xx, zz); if (!(s === SURF.GRASS || s === SURF.URBAN || s === SURF.DIRT || s === SURF.FOREST)) return false; } return true; };
  for (let r = 0; r < 160; r += 4) for (let a = 0; a < Math.PI * 2; a += Math.max(0.2, 4 / Math.max(4, r))) { const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; if (ok(x, z)) return [x, z]; }
  return [cx, cz];
}

export function buildLandmarks(ctx) {
  const { B, col, rnd } = ctx;
  const g = (m, x, z) => B.get(m, x, z);
  // ---------- main gate arch ----------
  {
    const x = GATE.x, z0 = GATE.z, y = groundHeight(x, z0), hz = GATE.w / 2 + 1;
    for (const s of [-1, 1]) { g('trim', x, z0).box(x, y + 4.5, z0 + s * hz, 2.2, 9, 2.2, 0, { u: 2, v: 3 }); g('trimGreen', x, z0).box(x, y + 9.2, z0 + s * hz, 2.6, 0.5, 2.6); g('trimGold', x, z0).geometry(new THREE.ConeGeometry(0.9, 1.6, 4), M4().makeTranslation(x, y + 10.25, z0 + s * hz)); col.addBox(x, z0 + s * hz, 1.1, 1.1, 0, y + 9); }
    g('trimGreen', x, z0).box(x, y + 7.6, z0, 1.6, 1.8, hz * 2, 0, { u: 2, v: 2 });
    ctx.bigSigns.push({ x: x - 0.82, y: y + 7.6, z: z0, nx: -1, nz: 0, w: 22, h: 1.6, th: 'มหาวิทยาลัยเกษตรศาสตร์ วิทยาเขตศรีราชา', en: 'KASETSART UNIVERSITY  SRIRACHA CAMPUS' });
    ctx.bigSigns.push({ x: x + 0.82, y: y + 7.6, z: z0, nx: 1, nz: 0, w: 22, h: 1.6, th: 'ยินดีต้อนรับ นิสิต มก.ศรีราชา', en: 'WELCOME TO KU SRIRACHA' });
    // monument + flags just inside the gate
    const mx = x + 14, mz = z0 + hz + 9, my = groundHeight(mx, mz);
    g('trim', mx, mz).box(mx, my + 1.2, mz, 16, 2.4, 1.4, 0, { u: 3, v: 2 }); g('trimGreen', mx, mz).box(mx, my + 2.5, mz, 16.4, 0.25, 1.6);
    col.addBox(mx, mz, 8, 0.7, 0, my + 2.6);
    ctx.bigSigns.push({ x: mx, y: my + 1.35, z: mz - 0.72, nx: 0, nz: -1, w: 14, h: 1.75, th: 'มหาวิทยาลัยเกษตรศาสตร์', en: 'KASETSART UNIVERSITY • SRIRACHA' });
    for (let i = 0; i < 3; i++) { const fx = mx - 4 + i * 4, fz = mz + 4; const fy = groundHeight(fx, fz); g('metal', fx, fz).geometry(new THREE.CylinderGeometry(0.07, 0.09, 11, 8), M4().makeTranslation(fx, fy + 5.5, fz)); ctx.flags.push({ x: fx + 0.9, y: fy + 10, z: fz, kind: i === 1 ? 'ku' : 'th' }); col.addCircle(fx, fz, 0.15, fy + 11); }
    ctx.pois.gateSign = { x: mx, z: mz - 3, name: 'KU Main Gate Sign' };
    // security booth
    const bx = x + 8, bz = z0 - hz - 4;
    ctx.securitySpot = { x: bx, z: bz };
  }
  // ---------- campus fence along Sukhumvit ----------
  {
    const fx = -1074; let runStart = null;
    const flush = (z0, z1) => {
      if (z1 - z0 < 3) return; const cz = (z0 + z1) / 2; const len = z1 - z0;
      const y = groundHeight(fx, cz);
      g('trim', fx, cz).box(fx, y + 0.3, cz, 0.35, 1.2, len, 0, { u: 3, v: 1 });
      g('fence', fx, cz).box(fx, y + 1.5, cz, 0.02, 1.4, len, 0, { u: 1.2, v: 1.4, skip: { t: true, bt: true } });
      for (let t = 0; t <= len; t += 3) { const pz = z0 + t; const py = groundHeight(fx, pz); g('trim', fx, pz).box(fx, py + 1.1, pz, 0.4, 2.4, 0.4, 0, { u: 1, v: 2 }); }
      col.addWall(fx, z0, fx, z1, 0.4, y + 2.4);
    };
    for (let z = -345; z <= 640; z += 1.5) {
      const bad = [-3, 0, 3].some(o => { const s = col.surfAt(fx + o, z); return s === SURF.ROAD; }) || col.surfAt(fx, z) === SURF.BUILDING;
      if (!bad && runStart === null) runStart = z;
      if (bad && runStart !== null) { flush(runStart, z - 1.5); runStart = null; }
    }
    if (runStart !== null) flush(runStart, 640);
  }
  // ---------- bus stop ----------
  { const bx = -1077, bz = 132, by = groundHeight(bx, bz);
    g('metal', bx, bz).box(bx, by + 1.4, bz - 3, 0.1, 2.8, 0.1); g('metal', bx, bz).box(bx, by + 1.4, bz + 3, 0.1, 2.8, 0.1); g('glass', bx, bz).box(bx + 0.7, by + 1.3, bz, 0.05, 2.2, 6);
    g('roofGreen', bx, bz).box(bx, by + 2.85, bz, 2.2, 0.12, 6.6); g('paint', bx, bz).box(bx + 0.3, by + 0.5, bz, 0.5, 0.06, 5, 0, { color: [0.8, 0.8, 0.82] });
    col.addBox(bx + 0.7, bz, 0.1, 3, 0, by + 2.5); ctx.pois.busStop = { x: bx - 2, z: bz, name: 'Sukhumvit Bus Stop' }; }
  // ---------- stadium ----------
  buildStadium(ctx, g, col);
  // ---------- hill: viewpoint + KU letters ----------
  buildHill(ctx, g, col);
  // ---------- coast: pier, boats, umbrellas ----------
  buildBeach(ctx, g, col, rnd);
}

function buildStadium(ctx, g, col) {
  const T = TRACKP; const y = groundHeight(T.x, T.z);
  const R = T.w / 2, Ls = T.d - T.w, lw = 9.8, ri = R - lw;
  const gb = g('track', T.x, T.z); const N = 40;
  const mk = (rad, zc) => { const o = []; for (let i = 0; i <= N; i++) { const a = i / N * Math.PI; o.push([T.x + Math.cos(a) * rad, zc + Math.sin(a) * rad]); } return o; };
  const zn = T.z - Ls / 2, zs = T.z + Ls / 2;
  const ring = (rad) => [...mk(rad, zn).map(([x, z]) => [x, zn - (z - zn)]), ...mk(rad, zs).map(([x, z]) => [2 * T.x - x, z])];
  const outer = ring(R), inner = ring(ri); let v = 0;
  for (let i = 0; i < outer.length; i++) {
    const j = (i + 1) % outer.length; const a = inner[i], b = outer[i], c = outer[j], d = inner[j];
    const v1 = v + Math.hypot(c[0] - b[0], c[1] - b[1]) / 4;
    gb.quad([a[0], y + 0.07, a[1]], [b[0], y + 0.07, b[1]], [c[0], y + 0.07, c[1]], [d[0], y + 0.07, d[1]], [[0, v], [1, v], [1, v1], [0, v1]]); v = v1;
  }
  const sh = new THREE.Shape(inner.map(([x, z]) => new THREE.Vector2(x - T.x, -(z - T.z))));
  const fg = new THREE.ShapeGeometry(sh, 2); fg.rotateX(-Math.PI / 2);
  const uvA = fg.attributes.uv, pA = fg.attributes.position; for (let i = 0; i < pA.count; i++) uvA.setXY(i, pA.getX(i) / 12, pA.getZ(i) / 12);
  g('field', T.x, T.z).geometry(fg, M4().makeTranslation(T.x, y + 0.065, T.z));
  col.fillRect(T.x - R, T.z - T.d / 2, T.x + R, T.z + T.d / 2, SURF.SPORT, (s) => s !== SURF.BUILDING);
  const pw = 60, pl = 96; const line = (x, z, sx, sz) => g('mark', x, z).plane(x, y + 0.075, z, sx, sz, 0, 1, [0.95, 0.95, 0.95]);
  line(T.x - pw / 2, T.z, 0.12, pl); line(T.x + pw / 2, T.z, 0.12, pl); line(T.x, T.z - pl / 2, pw, 0.12); line(T.x, T.z + pl / 2, pw, 0.12); line(T.x, T.z, pw, 0.12);
  for (const s of [-1, 1]) {
    const gz = T.z + s * pl / 2;
    g('white', T.x, gz).box(T.x - 3.66, y + 1.22, gz, 0.12, 2.44, 0.12); g('white', T.x, gz).box(T.x + 3.66, y + 1.22, gz, 0.12, 2.44, 0.12); g('white', T.x, gz).box(T.x, y + 2.44, gz, 7.44, 0.12, 0.12);
    g('fence', T.x, gz).box(T.x, y + 1.2, gz + s * 1.0, 7.3, 2.4, 2.0, 0, { u: 1, v: 1, skip: { bt: true } });
    col.addCircle(T.x - 3.66, gz, 0.1, y + 2.5); col.addCircle(T.x + 3.66, gz, 0.1, y + 2.5);
  }
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = T.x + dx * (R + 6), z = T.z + dz * (T.d / 2 - 10), fy = groundHeight(x, z);
    g('metal', x, z).geometry(new THREE.CylinderGeometry(0.25, 0.45, 24, 8), M4().makeTranslation(x, fy + 12, z));
    g('trimDark', x, z).box(x, fy + 24.5, z, 3.5, 2, 0.6, Math.atan2(T.x - x, T.z - z));
    ctx.floodlights.push({ x, y: fy + 24, z, tx: T.x, tz: T.z }); col.addCircle(x, z, 0.5, fy + 24);
  }
  ctx.trackCheckpoints = [[T.x - R + lw / 2, T.z], [T.x, T.z - T.d / 2 + lw / 2], [T.x + R - lw / 2, T.z], [T.x, T.z + T.d / 2 - lw / 2]];
  ctx.pois.trackStart = { x: T.x - R + lw / 2, z: T.z, name: 'KU Stadium Track' };
}

function buildHill(ctx, g, col) {
  // summit = highest heightmap sample
  const H = MAP.heights; let best = 0; for (let i = 1; i < H.length; i++) if (H[i] > H[best]) best = i;
  const sx = MAP.b.minX + (best % MAP.nx) * MAP.step, sz = MAP.b.minZ + Math.floor(best / MAP.nx) * MAP.step, sy = H[best];
  g('wood', sx, sz).box(sx, sy + 0.3, sz, 14, 1.2, 14, 0, { u: 2, v: 1 });
  col.fillRect(sx - 7, sz - 7, sx + 7, sz + 7, SURF.PLATFORM); col.platforms.push({ x0: sx - 7, x1: sx + 7, z0: sz - 7, z1: sz + 7, h: sy + 0.9 });
  for (const [dx, dz] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) { g('white', sx + dx, sz + dz).box(sx + dx, sy + 2.6, sz + dz, 0.35, 3.6, 0.35); col.addCircle(sx + dx, sz + dz, 0.25, sy + 4.5); }
  hipRoof(g('roofTile', sx, sz), sx, sy + 4.4, sz, 12, 12, 3);
  ctx.pois.hillTop = { x: sx, z: sz, name: 'KU Hill Viewpoint' };
  // KU SRIRACHA letters on the slope facing campus (west)
  let lx = sx - 40; for (let x = sx - 300; x < sx; x += 2) { if (groundHeight(x, sz) > sy * 0.5) { lx = x; break; } }
  const text = 'KU SRIRACHA'; const bs = 1.6; let z = sz - (text.length * 6 * bs) / 2;
  const lb = g('letters', lx, sz);
  for (const ch of text) {
    const glyph = FONT[ch] || FONT[' '];
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (glyph[r][c] === '1') {
      const bz = z + c * bs + bs / 2; const bx = lx + (6 - r) * 0.6; const by = groundHeight(lx, bz) + (6 - r) * bs + bs / 2 + 0.4;
      lb.box(bx, by, bz, bs * 0.9, bs * 0.95, bs * 0.95);
    }
    z += 6 * bs;
  }
  ctx.lettersBox = { x: lx, z: sz, hz: (text.length * 6 * bs) / 2 };
  col.addBox(lx + 2, sz, 3, (text.length * 6 * bs) / 2, 0, groundHeight(lx, sz) + 14);
}

function buildBeach(ctx, g, col, rnd) {
  const P = PIERP; const deck = col.pierY;
  for (let x = P.x0; x > P.x1; x -= 4) g('wood', x - 2, P.z).box(x - 2, deck - 0.15, P.z, 4, 0.3, P.w, 0, { u: 2, v: 1 });
  col.fillRect(P.x1, P.z - P.w / 2, P.x0, P.z + P.w / 2, SURF.PIER);
  g('wood', P.x1 - 6, P.z).box(P.x1 - 6, deck - 0.15, P.z, 14, 0.3, 16, 0, { u: 2, v: 1 }); col.fillRect(P.x1 - 13, P.z - 8, P.x1 + 1, P.z + 8, SURF.PIER);
  for (let x = P.x0 - 6; x > P.x1 - 12; x -= 6) for (const s of [-1, 1]) {
    const zz = P.z + (x < P.x1 ? s * 7.6 : s * (P.w / 2 + 0.1));
    g('wood', x, zz).geometry(new THREE.CylinderGeometry(0.18, 0.18, 8, 6), M4().makeTranslation(x, deck - 4, zz));
    g('wood', x, zz).box(x, deck + 0.55, zz, 0.12, 1.1, 0.12);
  }
  for (const s of [-1, 1]) { const cx = (P.x0 + P.x1) / 2; g('wood', cx, P.z).box(cx, deck + 1.05, P.z + s * (P.w / 2 + 0.1), P.x0 - P.x1, 0.08, 0.08); col.addWall(P.x0 - 4, P.z + s * (P.w / 2 + 0.2), P.x1, P.z + s * (P.w / 2 + 0.2), 0.2, deck + 2); }
  for (const s of [-1, 1]) col.addWall(P.x1, P.z + s * 8, P.x1 - 13, P.z + s * 8, 0.2, deck + 2);
  col.addWall(P.x1 - 13, P.z - 8, P.x1 - 13, P.z + 8, 0.2, deck + 2);
  for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) { const px = P.x1 - 7 + dx, pz = P.z + dz; g('white', px, pz).box(px, deck + 1.45, pz, 0.25, 2.9, 0.25); col.addCircle(px, pz, 0.2, deck + 3); }
  hipRoof(g('roofTile', P.x1 - 7, P.z), P.x1 - 7, deck + 2.9, P.z, 8, 8, 2.2);
  for (const x of [P.x0 - 15, P.x0 - 55, P.x0 - 95, P.x0 - 135]) ctx.lampSpots.push({ x, z: P.z + P.w / 2 + 0.3, y: deck, h: 4.2 }, { x: x - 20, z: P.z - P.w / 2 - 0.3, y: deck, h: 4.2 });
  ctx.pois.pierEnd = { x: P.x1 - 8, z: P.z, name: 'Ao Udom Pier' };
  ctx.pois.beach = { x: MAP.b.coastX + 25, z: -160, name: 'Ao Udom Beach' };
  // boats
  const boatCols = ['#1f6fb5', '#c0392b', '#16a085', '#f1c40f', '#ecf0f1'];
  for (let i = 0; i < 8; i++) {
    const bx = P.x1 + 40 - i * 18 - rnd() * 6, bz = P.z + (i % 2 ? 1 : -1) * (14 + rnd() * 24);
    const gb = new GeoBuilder(); const c = hex(boatCols[i % boatCols.length]);
    gb.box(0, 0.4, 0, 2.2, 0.9, 7, 0, { color: c }); gb.box(0, 0.95, 0, 2.3, 0.18, 7.1, 0, { color: [0.95, 0.95, 0.92] });
    gb.geometry(new THREE.ConeGeometry(1.15, 2.4, 4).rotateX(Math.PI / 2).rotateZ(Math.PI / 4).scale(1, 0.6, 1), M4().makeTranslation(0, 0.55, 4.6), c);
    gb.box(0, 1.5, -1.2, 1.6, 1.1, 2, 0, { color: [0.92, 0.92, 0.9] }); gb.box(0, 2.1, -1.2, 1.9, 0.1, 2.4, 0, { color: hex('#8e2b20') }); gb.box(0, 2.6, 1.6, 0.08, 3.2, 0.08, 0, { color: [0.3, 0.25, 0.2] });
    const m = new THREE.Mesh(gb.build(), ctx.mats.paint); m.position.set(bx, -0.1, bz); m.rotation.y = rnd() * Math.PI; m.castShadow = true;
    ctx.group.add(m); ctx.boats.push(m); col.addCircle(bx, bz, 3, 2);
  }
  const ucol = ['#e74c3c', '#f1c40f', '#2980b9', '#27ae60', '#e67e22', '#ffffff'];
  for (let z = MAP.b.minZ + 30; z < MAP.b.maxZ - 30; z += 20) {
    if (Math.abs(z - P.z) < 16 || Math.abs(z + 40) < 16) continue;
    const x = MAP.b.coastX + 14 + rnd() * 14, y = groundHeight(x, z);
    g('metal', x, z).box(x, y + 1.25, z, 0.06, 2.5, 0.06);
    g('fabric', x, z).geometry(new THREE.ConeGeometry(1.6, 0.7, 8, 1, true), M4().makeTranslation(x, y + 2.5, z), hex(ucol[(rnd() * ucol.length) | 0]));
    for (const s of [-1, 1]) g('paint', x, z).box(x + 0.4, y + 0.25, z + s * 1.2, 1.9, 0.12, 0.65, 0.05, { color: [0.95, 0.95, 0.93] });
    col.addCircle(x, z, 0.12, y + 2.5);
  }
}

// ---------- instanced street furniture ----------
export function buildFurniture(ctx, spots, medians) {
  const { col } = ctx; const mats = ctx.mats;
  const lampPos = spots.lamps.slice();
  for (const sp of ctx.lampSpots) lampPos.push({ x: sp.x, z: sp.z, rot: 0, dbl: false, h: sp.h, y: sp.y });
  const poleG = new THREE.CylinderGeometry(0.07, 0.11, 1, 8); poleG.translate(0, 0.5, 0);
  const armG = new THREE.BoxGeometry(0.08, 0.08, 1.6); armG.translate(0, 0, 0.8);
  const headG = new THREE.BoxGeometry(0.35, 0.14, 0.7);
  const poles = new THREE.InstancedMesh(poleG, mats.metal, lampPos.length);
  const arms = new THREE.InstancedMesh(armG, mats.metal, lampPos.length * 2);
  const heads = new THREE.InstancedMesh(headG, mats.lampHead, lampPos.length * 2);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  let ai = 0;
  lampPos.forEach((L, i) => {
    const y = L.y ?? (groundHeight(L.x, L.z) - 0.02);
    m.compose(p.set(L.x, y, L.z), q.identity(), s.set(1, L.h, 1)); poles.setMatrixAt(i, m);
    for (const r of (L.dbl ? [L.rot, L.rot + Math.PI] : [L.rot])) {
      q.setFromAxisAngle(Y, r);
      m.compose(p.set(L.x, y + L.h - 0.05, L.z), q, s.set(1, 1, 1)); arms.setMatrixAt(ai, m);
      const hx = L.x + Math.sin(r) * 1.55, hz = L.z + Math.cos(r) * 1.55;
      m.compose(p.set(hx, y + L.h - 0.12, hz), q, s.set(1, 1, 1)); heads.setMatrixAt(ai, m);
      ctx.lamps.push({ x: hx, y: y + L.h - 0.4, z: hz }); ai++;
    }
    col.addCircle(L.x, L.z, 0.15, y + L.h);
  });
  arms.count = ai; heads.count = ai;
  for (const im of [poles, arms, heads]) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = im !== heads; ctx.group.add(im); }
  // power poles + wires
  const ppG = new THREE.CylinderGeometry(0.12, 0.18, 9, 6); ppG.translate(0, 4.5, 0);
  const pp = new THREE.InstancedMesh(ppG, mats.concrete, Math.max(1, spots.poles.length));
  const cr = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 0.1, 0.1), mats.concrete, Math.max(1, spots.poles.length));
  const wire = [];
  spots.poles.forEach((P, i) => {
    const y = groundHeight(P.x, P.z); m.compose(p.set(P.x, y, P.z), q.identity(), s.set(1, 1, 1)); pp.setMatrixAt(i, m);
    m.compose(p.set(P.x, y + 8.4, P.z), q.setFromAxisAngle(Y, P.rot + Math.PI / 2), s.set(1, 1, 1)); cr.setMatrixAt(i, m);
    col.addCircle(P.x, P.z, 0.2, y + 9);
    const nx = spots.poles[i + 1];
    if (nx && nx.line === P.line && Math.hypot(nx.x - P.x, nx.z - P.z) < 60) {
      const y2 = groundHeight(nx.x, nx.z); const px = Math.cos(P.rot), pz = -Math.sin(P.rot);
      for (const off of [-0.6, 0, 0.6]) for (const dh of [8.35, 7.6]) {
        const ax = P.x + px * off, az = P.z + pz * off, bx = nx.x + px * off, bz = nx.z + pz * off;
        for (let k = 0; k < 6; k++) { const t0 = k / 6, t1 = (k + 1) / 6; const sag = (t) => -Math.sin(t * Math.PI) * 0.9; wire.push(ax + (bx - ax) * t0, y + dh + (y2 - y) * t0 + sag(t0), az + (bz - az) * t0, ax + (bx - ax) * t1, y + dh + (y2 - y) * t1 + sag(t1), az + (bz - az) * t1); }
      }
    }
  });
  pp.count = spots.poles.length; cr.count = spots.poles.length;
  for (const im of [pp, cr]) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = true; ctx.group.add(im); }
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
  ctx.group.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.75 })));
  // Sukhumvit median strip (instanced)
  if (medians.length) {
    const mg = new GeoBuilder(); mg.box(0, 0.12, 0, 2.8, 0.3, 3.05, 0, { color: [0.8, 0.79, 0.76] }); mg.box(0, 0.28, 0, 2.5, 0.04, 3.0, 0, { color: hex('#4f7d3a') });
    const mm = new THREE.InstancedMesh(mg.build(), mats.paint, medians.length);
    medians.forEach((d, i) => { m.compose(p.set(d.x, groundHeight(d.x, d.z), d.z), q.setFromAxisAngle(Y, d.r), s.set(1, 1, 1)); mm.setMatrixAt(i, m); });
    mm.instanceMatrix.needsUpdate = true; mm.computeBoundingSphere(); mm.receiveShadow = true; ctx.group.add(mm);
    for (let i = 0; i < medians.length; i += 3) ctx.trees.push({ type: i % 9 === 0 ? 'flower' : 'bush', x: medians[i].x, y: groundHeight(medians[i].x, medians[i].z) + 0.25, z: medians[i].z, s: 0.65, r: i, c: [1, 1, 1] });
  }
  // benches + bins near campus doors
  const benchPos = [], binPos = [];
  for (const d of ctx.campusDoors.concat(Object.values(ctx.placeObjs).filter(p => inPoly(p.x, p.z, CAMPUS_POLY)).map(p => p._door))) {
    if (!d) continue; const tx = -d.nz, tz = d.nx;
    for (const sgn of [-1, 1]) { const bx = d.x + tx * sgn * 6 + d.nx * 1.5, bz = d.z + tz * sgn * 6 + d.nz * 1.5; const sf = col.surfAt(bx, bz); if (sf === SURF.BUILDING || sf === SURF.ROAD || sf === SURF.WATER) continue; benchPos.push({ x: bx, z: bz, rot: Math.atan2(d.nx, d.nz) + Math.PI }); binPos.push({ x: bx + tx * sgn * 1.4, z: bz + tz * sgn * 1.4 }); }
  }
  const benchGB = new GeoBuilder(); benchGB.box(0, 0.45, 0, 1.8, 0.06, 0.5, 0, { color: hex('#7a5232') }); benchGB.box(0, 0.75, -0.22, 1.8, 0.4, 0.05, 0, { color: hex('#7a5232') });
  for (const x of [-0.75, 0.75]) benchGB.box(x, 0.22, 0, 0.08, 0.45, 0.45, 0, { color: [0.2, 0.2, 0.22] });
  const benches = new THREE.InstancedMesh(benchGB.build(), mats.paint, Math.max(1, benchPos.length));
  benchPos.forEach((b, i) => { const y = col.heightAt(b.x, b.z); m.compose(p.set(b.x, y, b.z), q.setFromAxisAngle(Y, b.rot), s.set(1, 1, 1)); benches.setMatrixAt(i, m); col.addCircle(b.x, b.z, 0.55, y + 0.9, 'bench'); ctx.seats.push({ x: b.x, z: b.z, y: y + 0.45, rot: b.rot }); });
  benches.count = benchPos.length;
  const binGB = new GeoBuilder(); binGB.geometry(new THREE.CylinderGeometry(0.28, 0.24, 0.85, 10), M4().makeTranslation(0, 0.43, 0), hex('#0d6b52')); binGB.geometry(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 10), M4().makeTranslation(0, 0.88, 0), [0.25, 0.25, 0.25]);
  const bins = new THREE.InstancedMesh(binGB.build(), mats.paint, Math.max(1, binPos.length));
  binPos.forEach((b, i) => { const y = col.heightAt(b.x, b.z); m.compose(p.set(b.x, y, b.z), q.identity(), s.set(1, 1, 1)); bins.setMatrixAt(i, m); col.addCircle(b.x, b.z, 0.3, y + 0.9); });
  bins.count = binPos.length;
  for (const im of [benches, bins]) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = true; im.receiveShadow = true; ctx.group.add(im); }
}

// ---------- parked vehicles ----------
let _pm = null; function PARK_MAT() { if (!_pm) _pm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.4 }); return _pm; }
export function buildParked(ctx, net) {
  const { col, rnd } = ctx; const items = [];
  const carPal = ['#e6e6e6', '#111111', '#7f8c8d', '#c0392b', '#2c3e50', '#bdc3c7', '#2980b9', '#8e2b20', '#f5f5f0', '#34495e'];
  const motoPal = ['#c0392b', '#1f3a93', '#111111', '#e6e6e6', '#0b6b4f', '#d35400', '#8e44ad', '#f1c40f'];
  // motorbike rows beside campus building entrances (very Thai)
  for (const d of ctx.campusDoors.concat(Object.values(ctx.placeObjs).map(p => p._door))) {
    if (!d || rnd() < 0.3) continue; const tx = -d.nz, tz = d.nx; const side = rnd() < 0.5 ? -1 : 1; const n = 6 + ((rnd() * 14) | 0);
    for (let i = 0; i < n; i++) { const off = 9 + i * 0.95; const x = d.x + tx * side * off + d.nx * 1.2, z = d.z + tz * side * off + d.nz * 1.2; const sf = col.surfAt(x, z); if (sf === SURF.BUILDING || sf === SURF.ROAD || sf === SURF.WATER) break; if (rnd() < 0.85) items.push({ x, z, r: Math.atan2(d.nx, d.nz) + (rnd() - 0.5) * 0.25, geo: 'm', pal: motoPal }); }
  }
  // cars parked on road shoulders outside campus
  const P = {};
  for (const e of net.edges) {
    if (e.campus || e.w < 6 || e.w > 14) continue;
    for (let s = e.trim0 + 6; s < e.len - e.trim1 - 6; s += 9) {
      if (rnd() > 0.16) continue;
      const q = edgePoint(e, s, -(e.w / 2 + 1.2), P); const sf = col.surfAt(q.x, q.z); if (!(sf === SURF.WALK || sf === SURF.URBAN || sf === SURF.GRASS || sf === SURF.DIRT)) continue;
      if (col.blocked(q.x, q.z, 1.6)) continue;
      items.push({ x: q.x, z: q.z, r: Math.atan2(q.tx, q.tz) + (rnd() < 0.5 ? Math.PI : 0), geo: 'c' + ['hatch', 'sedan', 'pickup'][(rnd() * 3) | 0], pal: carPal });
    }
  }
  const groups = new Map();
  for (const it of items) { const k = it.geo + '|' + Math.floor(it.x / 700) + '|' + Math.floor(it.z / 700); let a = groups.get(k); if (!a) groups.set(k, a = []); a.push(it); }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1), c = new THREE.Color(), Y = new THREE.Vector3(0, 1, 0);
  for (const [k, list] of groups) {
    const gk = k.split('|')[0]; const geo = gk[0] === 'c' ? carGeometry(gk.slice(1)) : motoGeometry('wave');
    const im = new THREE.InstancedMesh(geo, PARK_MAT(), list.length);
    list.forEach((it, i) => {
      const y = col.heightAt(it.x, it.z) + (gk[0] === 'c' ? 0.02 : 0);
      p.set(it.x, y, it.z); q.setFromAxisAngle(Y, it.r); m4.compose(p, q, s); im.setMatrixAt(i, m4); c.set(it.pal[(rnd() * it.pal.length) | 0]); im.setColorAt(i, c);
      if (gk[0] === 'c') col.addBox(it.x, it.z, 0.9, 2.1, it.r, y + 1.5); else col.addCircle(it.x, it.z, 0.42, y + 1.1);
    });
    im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); ctx.group.add(im); ctx.parkedMeshes.push(im);
  }
}

// ---------- vegetation from the real land-use ----------
export function placeTrees(ctx, spots) {
  const { col, rnd } = ctx; const T = ctx.trees; const b = MAP.b;
  const tint = () => { const v = 0.85 + rnd() * 0.3; return [v, v * (0.95 + rnd() * 0.1), v * 0.9]; };
  const BAD = new Set([SURF.BUILDING, SURF.ROAD, SURF.WALK, SURF.RAIL, SURF.WATER, SURF.PLAZA, SURF.SPORT, SURF.PIER, SURF.POOL, SURF.PARKING, SURF.PLATFORM]);
  const clear = (x, z, r) => { for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r], [r * 0.7, r * 0.7], [-r * 0.7, r * 0.7], [r * 0.7, -r * 0.7], [-r * 0.7, -r * 0.7]]) if (BAD.has(col.surfAt(x + dx, z + dz))) return false; return true; };
  const add = (type, x, z, s, solid = true) => { const y = groundHeight(x, z); T.push({ type, x, y: y - 0.1, z, s, r: rnd() * Math.PI * 2, c: tint() }); if (solid && type !== 'bush' && type !== 'flower') col.addCircle(x, z, type === 'palm' || type === 'royal' ? 0.28 : 0.4 * s, y + 6); };
  const lb = ctx.lettersBox;
  const noise = (x, z) => Math.sin(x * 0.013 + Math.sin(z * 0.009) * 2) * Math.cos(z * 0.011 - x * 0.004) * 0.5 + 0.5;
  // avenue trees along roads
  for (const a of spots.avenue) if (clear(a.x, a.z, 2.2)) add(a.campus ? (rnd() < 0.6 ? 'nonsi' : 'rain') : (rnd() < 0.5 ? 'round' : 'rain'), a.x, a.z, 0.85 + rnd() * 0.3);
  // scatter by land use
  const step = 7;
  for (let z = b.minZ + 4; z < b.maxZ - 4; z += step) for (let x = b.minX + 4; x < b.maxX - 4; x += step) {
    const jx = x + (rnd() - 0.5) * step * 0.9, jz = z + (rnd() - 0.5) * step * 0.9;
    const s = col.surfAt(jx, jz);
    if (lb && Math.abs(jx - lb.x - 4) < 26 && Math.abs(jz - lb.z) < lb.hz + 8) continue;
    let p = 0, type = 'round';
    const campus = jx > -1083 && jx < -460 && jz > -345 && jz < 640 && inPoly(jx, jz, CAMPUS_POLY);
    if (s === SURF.FOREST) { p = 0.82; type = rnd() < 0.72 ? 'forest' : (rnd() < 0.6 ? 'round' : 'rain'); }
    else if (s === SURF.GRASS) { p = campus ? 0.12 : 0.05 + noise(jx, jz) * 0.22; const r = rnd(); type = campus ? (r < 0.4 ? 'rain' : r < 0.7 ? 'nonsi' : 'round') : (r < 0.45 ? 'round' : r < 0.65 ? 'palm' : r < 0.85 ? 'forest' : 'rain'); }
    else if (s === SURF.URBAN) { p = 0.07; type = rnd() < 0.5 ? 'round' : 'palm'; }
    else if (s === SURF.DIRT || s === SURF.FARM) { p = 0.03; type = 'round'; }
    else if (s === SURF.SAND) { if (jx > b.coastX + 6) { p = 0.06; type = 'palm'; } }
    if (rnd() > p) continue;
    if (!clear(jx, jz, s === SURF.FOREST ? 2 : 3.2)) continue;
    add(type, jx, jz, 0.75 + rnd() * 0.5, s !== SURF.FOREST || rnd() < 0.25);
  }
  // beach road palms
  const bx = b.beachX;
  for (let z = b.minZ + 10; z < b.maxZ - 10; z += 16) for (const off of [-9.5, 9.5]) { const x = bx + off; if (clear(x, z, 1.2) && (col.surfAt(x, z) === SURF.GRASS || col.surfAt(x, z) === SURF.SAND)) add('palm', x, z, 0.9 + rnd() * 0.25); }
  // shrubs along campus building walls
  for (const d of ctx.campusDoors) {
    const tx = -d.nz, tz = d.nx;
    for (let o = -d.len / 2 + 2; o < d.len / 2; o += 3.2) { if (Math.abs(o) < 5) continue; const x = d.x - d.nx * 2.1 + tx * o, z = d.z - d.nz * 2.1 + tz * o; const s = col.surfAt(x, z); if (s === SURF.GRASS || s === SURF.URBAN) add(rnd() < 0.3 ? 'flower' : 'bush', x, z, 0.6 + rnd() * 0.3, false); }
  }
}
