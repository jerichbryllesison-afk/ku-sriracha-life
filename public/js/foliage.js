// Foliage: one 1024² texture atlas (bark strip + alpha-tested leaf clusters, palm fronds, shrubs) and
// card-based tree meshes. Canopies are built from many leaf-cluster cards spread over the old canopy
// volumes, with "volume" normals (pointing away from each canopy centre) so lighting reads as a soft
// leafy mass; inner cards are darkened (baked canopy occlusion). Leaf-shaped shadows come for free from
// three's alpha-tested shadow depth pass. Sun back-lighting gives leaves translucency.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { shared } from './nature.js';

const A = 1024;
// atlas cells in px [x, y, w, h]
const CELL = {
  bark: [0, 0, 192, 1024], broad: [192, 0, 416, 416], fine: [608, 0, 416, 416], nonsi: [192, 416, 416, 416],
  palm: [608, 416, 416, 192], shrub: [608, 608, 416, 224], bloom: [192, 832, 416, 192], litter: [608, 832, 416, 192],
};
const uvRect = (c, inset = 3) => { const [x, y, w, h] = CELL[c]; return [(x + inset) / A, 1 - (y + h - inset) / A, (x + w - inset) / A, 1 - (y + inset) / A]; }; // u0 v0 u1 v1 (flipY)

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ---------- atlas painting ----------
function leaf(ctx, x, y, a, L, W, col, rib) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(L * 0.45, -W, L, 0); ctx.quadraticCurveTo(L * 0.45, W, 0, 0); ctx.fill();
  if (rib) { ctx.strokeStyle = rib; ctx.lineWidth = Math.max(0.6, W * 0.12); ctx.beginPath(); ctx.moveTo(L * 0.05, 0); ctx.lineTo(L * 0.85, 0); ctx.stroke(); }
  ctx.restore();
}
const hsl = (h, s, l) => `hsl(${h},${s}%,${l}%)`;
function cluster(ctx, cell, r, o) {
  const [x0, y0, w, h] = CELL[cell]; const cx = x0 + w / 2, cy = y0 + h / 2, R = Math.min(w, h) * 0.47;
  // twigs
  ctx.lineCap = 'round';
  for (let i = 0; i < o.twigs; i++) { const a = r() * Math.PI * 2; ctx.strokeStyle = `rgba(70,52,34,0.9)`; ctx.lineWidth = 2 + r() * 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R * 0.8, cy + Math.sin(a) * R * 0.8); ctx.stroke(); }
  // leaves: back (dark) to front (light), denser in the middle, ragged silhouette
  for (let i = 0; i < o.n; i++) {
    const t = i / o.n; const a = r() * Math.PI * 2; const d = Math.pow(r(), o.spread || 0.7) * R * (0.85 + Math.sin(a * 5 + o.seed) * 0.12);
    const x = cx + Math.cos(a) * d * (w / Math.min(w, h)) * 0.98, y = cy + Math.sin(a) * d * (h / Math.min(w, h)) * 0.98;
    const L = o.L[0] + r() * (o.L[1] - o.L[0]); if (Math.hypot((x - cx) / (w / 2), (y - cy) / (h / 2)) * (w / 2) + L > R * 1.06) continue;
    const ang = a + (r() - 0.5) * 1.6;
    const l = o.light[0] + t * (o.light[1] - o.light[0]) + (r() - 0.5) * 8;
    leaf(ctx, x, y, ang, L, L * o.wr, hsl(o.hue + (r() - 0.5) * o.hueVar, o.sat + (r() - 0.5) * 12, l), o.rib ? hsl(o.hue, o.sat - 10, l + 10) : null);
  }
  if (o.flowers) for (let i = 0; i < o.flowers.n; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R * 0.8; const fx = cx + Math.cos(a) * d, fy = cy + Math.sin(a) * d;
    for (let k = 0; k < o.flowers.dots; k++) { const rr = o.flowers.size * (0.6 + r() * 0.6); ctx.fillStyle = hsl(o.flowers.hue + (r() - 0.5) * 8, o.flowers.sat, o.flowers.l + (r() - 0.5) * 12); ctx.beginPath(); ctx.arc(fx + (r() - 0.5) * o.flowers.spread, fy + (r() - 0.5) * o.flowers.spread, rr, 0, 7); ctx.fill(); }
  }
}
function paintAtlas() {
  const c = document.createElement('canvas'); c.width = c.height = A; const ctx = c.getContext('2d'); const r = rng(1234);
  // bark strip: vertical fibres + plates
  { const [x0, y0, w, h] = CELL.bark; ctx.fillStyle = '#7d6c5a'; ctx.fillRect(x0, y0, w, h);
    for (let i = 0; i < 900; i++) { const x = x0 + r() * w, y = y0 + r() * h, g = 55 + r() * 60; ctx.fillStyle = `rgba(${g},${g * 0.84},${g * 0.68},${0.35 + r() * 0.4})`; ctx.fillRect(x, y, 1 + r() * 3, 8 + r() * 40); }
    for (let i = 0; i < 140; i++) { const x = x0 + r() * w, y = y0 + r() * h; ctx.strokeStyle = 'rgba(28,22,16,0.55)'; ctx.lineWidth = 1 + r() * 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + (r() - 0.5) * 8, y + 20, x + (r() - 0.5) * 8, y + 40, x + (r() - 0.5) * 6, y + 60 + r() * 60); ctx.stroke(); }
    for (let i = 0; i < 60; i++) { ctx.fillStyle = `rgba(150,145,120,${0.08 + r() * 0.12})`; ctx.beginPath(); ctx.ellipse(x0 + r() * w, y0 + r() * h, 6 + r() * 14, 10 + r() * 30, 0, 0, 7); ctx.fill(); } }
  // broad-leaf cluster (rain tree / mango / generic): many small oval leaves, warm greens
  cluster(ctx, 'broad', r, { n: 520, L: [16, 30], wr: 0.42, hue: 92, hueVar: 16, sat: 42, light: [16, 38], twigs: 8, rib: true, seed: 1 });
  // fine pinnate leaflets (forest)
  cluster(ctx, 'fine', r, { n: 1500, L: [9, 16], wr: 0.33, hue: 100, hueVar: 14, sat: 38, light: [13, 33], twigs: 10, seed: 2 });
  // nonsi: fine leaflets + golden blossom panicles
  cluster(ctx, 'nonsi', r, { n: 1300, L: [9, 15], wr: 0.36, hue: 88, hueVar: 12, sat: 44, light: [16, 36], twigs: 10, seed: 3, flowers: { n: 22, dots: 26, size: 3.2, spread: 26, hue: 47, sat: 88, l: 56 } });
  // shrub
  cluster(ctx, 'shrub', r, { n: 900, L: [10, 18], wr: 0.5, hue: 96, hueVar: 14, sat: 44, light: [16, 38], twigs: 6, seed: 4 });
  // bougainvillea
  cluster(ctx, 'bloom', r, { n: 600, L: [10, 17], wr: 0.55, hue: 98, hueVar: 12, sat: 40, light: [16, 34], twigs: 4, seed: 5, flowers: { n: 34, dots: 14, size: 4.2, spread: 22, hue: 322, sat: 72, l: 52 } });
  // leaf litter (ground cards under trees)
  cluster(ctx, 'litter', r, { n: 420, L: [10, 20], wr: 0.45, hue: 34, hueVar: 26, sat: 40, light: [22, 42], twigs: 5, seed: 6 });
  // palm frond: rib along u, leaflets swept back on both sides, tapering to the tip
  { const [x0, y0, w, h] = CELL.palm; const cy = y0 + h / 2; ctx.lineCap = 'round';
    for (let i = 0; i < 70; i++) { const t = i / 70; const x = x0 + 8 + t * (w - 16); const len = (h * 0.47) * (0.35 + 0.65 * Math.sin(Math.min(1, t * 1.15) * Math.PI) ) ; const l = 22 + r() * 14;
      for (const sd of [-1, 1]) { const a = sd * (1.05 + r() * 0.15); ctx.save(); ctx.translate(x, cy); ctx.rotate(a - 0.0); ctx.fillStyle = hsl(84 + r() * 12, 40 + r() * 10, l); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.5, -3.2, len, 0.6); ctx.quadraticCurveTo(len * 0.5, 3.2, 0, 0); ctx.fill(); ctx.restore(); } }
    ctx.strokeStyle = '#8c7a4c'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x0 + 4, cy); ctx.lineTo(x0 + w - 6, cy); ctx.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

// ---------- geometry ----------
class FB { // foliage builder: non-indexed position/normal/uv/color
  constructor() { this.p = []; this.n = []; this.u = []; this.c = []; }
  tri(a, b, c, na, nb, nc, ua, ub, uc, ca, cb, cc) { this.p.push(...a, ...b, ...c); this.n.push(...na, ...nb, ...nc); this.u.push(...ua, ...ub, ...uc); this.c.push(...ca, ...cb, ...cc); }
  quad(P, N, U, C) { this.tri(P[0], P[1], P[2], N[0], N[1], N[2], U[0], U[1], U[2], C[0], C[1], C[2]); this.tri(P[0], P[2], P[3], N[0], N[2], N[3], U[0], U[2], U[3], C[0], C[2], C[3]); }
  build() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g.computeBoundingSphere(); return g; }
}
const lin = (v) => Math.pow(v, 2.2);
const V3 = THREE.Vector3;

function trunk(fb, h, r0, r1, bend, col, segs = 8, rows = 4, from = new V3(0, 0, 0), dir = new V3(0, 1, 0)) {
  const [u0, v0, u1, v1] = uvRect('bark', 1); const up = dir.clone().normalize();
  const side = Math.abs(up.y) > 0.9 ? new V3(1, 0, 0) : new V3(0, 1, 0); const ax = new V3().crossVectors(up, side).normalize(), az = new V3().crossVectors(ax, up).normalize();
  const ring = (k) => { const t = k / rows; const r = r0 + (r1 - r0) * t; const c = from.clone().addScaledVector(up, h * t).addScaledVector(ax, bend * t * t); const pts = []; for (let i = 0; i <= segs; i++) { const a = i / segs * Math.PI * 2; const d = ax.clone().multiplyScalar(Math.cos(a)).addScaledVector(az, Math.sin(a)); pts.push([c.clone().addScaledVector(d, r), d]); } return pts; };
  const cl = [lin(col[0]), lin(col[1]), lin(col[2])]; const dark = cl.map(v => v * 0.55);
  let prev = ring(0);
  for (let k = 1; k <= rows; k++) {
    const cur = ring(k);
    for (let i = 0; i < segs; i++) {
      const U = (i / segs) * (u1 - u0) + u0, U2 = ((i + 1) / segs) * (u1 - u0) + u0, Va = v0 + (v1 - v0) * ((k - 1) / rows) * Math.min(1, h / 8), Vb = v0 + (v1 - v0) * (k / rows) * Math.min(1, h / 8);
      const a = prev[i], b = prev[i + 1], c = cur[i + 1], d = cur[i];
      const ca = k === 1 ? dark : cl;
      fb.quad([a[0].toArray(), b[0].toArray(), c[0].toArray(), d[0].toArray()], [a[1].toArray(), b[1].toArray(), c[1].toArray(), d[1].toArray()], [[U, Va], [U2, Va], [U2, Vb], [U, Vb]], [ca, ca, cl, cl]);
    }
    prev = cur;
  }
}
// leaf cards spread over an ellipsoid canopy volume
function canopy(fb, r, vol, cell, n, size, opt = {}) {
  const [cx, cy, cz, rad, sy = 1] = vol; const [u0, v0, u1, v1] = uvRect(cell);
  const ctr = new V3(cx, cy, cz);
  for (let i = 0; i < n; i++) {
    // point biased to the shell, more on top
    const d = new V3().randomDirection(); if (d.y < -0.35 && r() < 0.6) d.y = -d.y * 0.5;
    const shell = 0.55 + Math.pow(r(), 0.5) * 0.45;
    const p = new V3(cx + d.x * rad * shell, cy + d.y * rad * sy * shell, cz + d.z * rad * shell);
    // card normal: mostly outward, randomised; build in-plane axes
    const nrm = d.clone().multiplyScalar(0.7).add(new V3(r() - 0.5, r() * 0.6, r() - 0.5)).normalize();
    const tmp = Math.abs(nrm.y) > 0.95 ? new V3(1, 0, 0) : new V3(0, 1, 0);
    const ax = new V3().crossVectors(nrm, tmp).normalize(); const ay = new V3().crossVectors(ax, nrm).normalize();
    const roll = r() * Math.PI * 2, cr = Math.cos(roll), sr = Math.sin(roll);
    const ex = ax.clone().multiplyScalar(cr).addScaledVector(ay, sr), ey = ax.clone().multiplyScalar(-sr).addScaledVector(ay, cr);
    const s = size * (0.75 + r() * 0.5) / 2;
    const P = [p.clone().addScaledVector(ex, -s).addScaledVector(ey, -s), p.clone().addScaledVector(ex, s).addScaledVector(ey, -s), p.clone().addScaledVector(ex, s).addScaledVector(ey, s), p.clone().addScaledVector(ex, -s).addScaledVector(ey, s)];
    const N = [], C = [];
    for (const q of P) {
      const o = q.clone().sub(ctr); o.y /= sy; const len = o.length() / rad; o.normalize();
      const vn = o.multiplyScalar(0.8).add(new V3(0, 0.25, 0)).normalize(); N.push(vn.toArray());
      const occl = 0.42 + 0.58 * Math.min(1, Math.max(0, (len - 0.25) / 0.8)) * (0.75 + 0.25 * Math.max(0, o.y + 0.3));
      const tint = opt.tint || [1, 1, 1]; const k = occl * (0.9 + r() * 0.2); C.push([lin(k * tint[0]), lin(k * tint[1]), lin(k * tint[2])]);
    }
    // random flip of the texture for variety
    const fu = r() < 0.5; const U = fu ? [[u0, v0], [u1, v0], [u1, v1], [u0, v1]] : [[u1, v0], [u0, v0], [u0, v1], [u1, v1]];
    fb.quad(P.map(q => q.toArray()), N, U, C);
  }
}
function palmFronds(fb, r, top, count, len, droop, lift = 0.35) {
  const [u0, v0, u1, v1] = uvRect('palm', 2);
  for (let f = 0; f < count; f++) {
    const rot = f / count * Math.PI * 2 + r() * 0.3, tilt = lift + r() * 0.35, L = len * (0.85 + r() * 0.3), W = 1.05;
    const dir = new V3(Math.cos(rot), 0, Math.sin(rot)), side = new V3(-Math.sin(rot), 0, Math.cos(rot));
    const seg = 7; let prev = null;
    for (let i = 0; i <= seg; i++) {
      const t = i / seg; const x = t * L * Math.cos(tilt), y = top + t * L * Math.sin(tilt) - t * t * droop;
      const c = new V3(0, y, 0).addScaledVector(dir, x); const sag = 0.18 * Math.sin(t * Math.PI);
      const a = c.clone().addScaledVector(side, -W).add(new V3(0, -sag, 0)), b = c.clone().addScaledVector(side, W).add(new V3(0, -sag, 0));
      const u = u0 + (u1 - u0) * t; const k = lin(0.75 + 0.25 * t);
      if (prev) fb.quad([prev.a.toArray(), prev.b.toArray(), b.toArray(), a.toArray()], [[0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0]], [[prev.u, v0], [prev.u, v1], [u, v1], [u, v0]], [[prev.k, prev.k, prev.k], [prev.k, prev.k, prev.k], [k, k, k], [k, k, k]]);
      prev = { a, b, u, k };
    }
  }
}
function litterCard(fb, r, rad) { // flat ring of leaf litter under a canopy (y slightly above ground)
  const [u0, v0, u1, v1] = uvRect('litter'); const k = lin(0.8);
  for (let i = 0; i < 3; i++) { const a = r() * Math.PI * 2, d = r() * rad * 0.4, s = rad * (0.55 + r() * 0.3); const x = Math.cos(a) * d, z = Math.sin(a) * d, y = 0.12 + i * 0.01; const c = Math.cos(a * 3), sn = Math.sin(a * 3);
    const P = [[-s, y, -s], [s, y, -s], [s, y, s], [-s, y, s]].map(([px, py, pz]) => [x + px * c - pz * sn, py, z + px * sn + pz * c]);
    fb.quad(P, [[0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0]], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], [[k, k, k], [k, k, k], [k, k, k], [k, k, k]]); }
}

const BARK = [0.86, 0.8, 0.72], PALMBARK = [0.95, 0.9, 0.8];
export function treeGeometriesHD() {
  const R = rng(42); const G = {}; const mk = (fn) => { const fb = new FB(); fn(fb); return fb.build(); };
  G.rain = mk(fb => { // ก้ามปู rain tree: short thick trunk, big umbrella crown on spreading limbs
    trunk(fb, 3.6, 0.48, 0.32, 0.3, BARK, 10, 4);
    const vols = []; for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, rr = i === 0 ? 0 : 3.7; vols.push([Math.cos(a) * rr, 5.7 + R() * 0.8, Math.sin(a) * rr, 2.7 + R() * 0.6, 0.55]); }
    for (const v of vols.slice(1)) trunk(fb, Math.hypot(v[0], v[2], v[1] - 3.4) * 0.9, 0.2, 0.08, 0, BARK, 6, 2, new V3(0, 3.3, 0), new V3(v[0], v[1] - 3.4, v[2]));
    for (const v of vols) canopy(fb, R, v, 'broad', 17, 2.6);
    litterCard(fb, R, 6);
  });
  G.nonsi = mk(fb => { // นนทรี: upright, fine foliage, golden blossoms
    trunk(fb, 3.2, 0.26, 0.18, 0.15, BARK, 8, 4);
    const vols = [[0, 4.7, 0, 1.9, 0.9], [1.3, 4.2, 0.4, 1.4, 0.8], [-1.2, 4.3, -0.5, 1.4, 0.8], [0.3, 5.5, -0.9, 1.3, 0.8], [-0.4, 4.1, 1.2, 1.3, 0.8]];
    for (const v of vols.slice(1)) trunk(fb, 2.0, 0.1, 0.05, 0, BARK, 5, 2, new V3(0, 2.9, 0), new V3(v[0], v[1] - 2.9, v[2]));
    vols.forEach((v, i) => canopy(fb, R, v, i % 2 ? 'nonsi' : 'fine', 16, 1.9));
    litterCard(fb, R, 3);
  });
  G.forest = mk(fb => {
    trunk(fb, 4.6, 0.3, 0.18, 0.2, BARK, 8, 4);
    for (const v of [[0, 5.6, 0, 2.4, 1.1], [0.9, 4.8, 0.6, 1.8, 1], [-0.9, 5.0, -0.4, 1.8, 1], [0, 7.0, 0, 1.6, 1]]) canopy(fb, R, v, 'fine', 15, 2.1);
  });
  G.round = mk(fb => { // mango-like dense round crown
    trunk(fb, 2.5, 0.32, 0.22, 0.1, BARK, 8, 3);
    for (const v of [[0, 3.9, 0, 2.2, 0.85], [1, 3.5, 0.5, 1.5, 1], [-1, 3.6, -0.4, 1.5, 1]]) canopy(fb, R, v, 'broad', 20, 2.0);
    litterCard(fb, R, 3);
  });
  G.palm = mk(fb => { trunk(fb, 8.6, 0.26, 0.17, 1.2, PALMBARK, 8, 6); palmFronds(fb, R, 8.4, 12, 4.6, 2.2); });
  G.royal = mk(fb => { trunk(fb, 9.2, 0.34, 0.24, 0, [0.82, 0.8, 0.76], 10, 6); palmFronds(fb, R, 9.3, 12, 3.8, 1.8, 0.6); });
  G.bush = mk(fb => { for (const v of [[0, 0.6, 0, 0.9, 0.75], [0.7, 0.5, 0.2, 0.7, 0.7], [-0.6, 0.5, -0.3, 0.7, 0.7]]) canopy(fb, R, v, 'shrub', 12, 1.0); });
  G.flower = mk(fb => { for (const v of [[0, 0.7, 0, 1.0, 0.8], [0.8, 0.6, 0.2, 0.7, 0.8]]) canopy(fb, R, v, 'bloom', 14, 1.1); });
  { const g = new THREE.IcosahedronGeometry(1, 1); g.scale(1, 0.6, 1); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = 0.85 + R() * 0.3; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } g.computeVertexNormals();
    const ng = g.toNonIndexed(); const n = ng.attributes.position.count; const [u0, v0] = uvRect('bark');
    ng.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2).map((_, i) => i % 2 ? v0 + 0.1 : u0 + 0.05), 2));
    ng.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(lin(0.75)), 3)); G.rock = ng; }
  return G;
}
export function treeGeometriesLoHD() {
  const R = rng(7); const fb = new FB();
  trunk(fb, 4.2, 0.3, 0.2, 0, BARK, 5, 1);
  canopy(fb, R, [0, 5.3, 0, 2.6, 0.95], 'broad', 14, 3.0);
  return { generic: fb.build() };
}

export function foliageMaterialHD() {
  const map = paintAtlas();
  const m = new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: 0.78, metalness: 0, side: THREE.DoubleSide, alphaTest: 0.5, alphaToCoverage: true });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.time; sh.uniforms.uSunDir = shared.sunDir; sh.uniforms.uSunCol = shared.sunCol;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; varying vec3 vWP;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #else
          vec3 ip = vec3(0.0);
        #endif
        float sway = max(0.0, position.y - 1.8) * 0.04;
        float gust = 0.6 + 0.4 * sin(uTime * 0.37 + ip.x * 0.01);
        transformed.x += sin(uTime * 1.3 + ip.x * 0.11 + ip.z * 0.07 + position.y * 0.3) * sway * gust;
        transformed.z += cos(uTime * 1.1 + ip.z * 0.09 + position.x * 0.2) * sway * 0.7 * gust;
        if (uv.x > 0.19) transformed += normal * sin(uTime * 5.0 + position.x * 3.1 + position.z * 2.3 + ip.x) * 0.035 * step(1.0, position.y);`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        #ifdef USE_INSTANCING
          vWP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uSunDir; uniform vec3 uSunCol; varying vec3 vWP;')
      // keep volume normals on both faces (no back-face flip) so the canopy shades as one mass
      .replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''))
      .replace('#include <opaque_fragment>', `
        #ifdef USE_MAP
        { vec3 Vd = normalize(vWP - cameraPosition); float bl = pow(max(dot(Vd, uSunDir), 0.0), 3.0);
          float leafM = step(0.19, vMapUv.x);
          outgoingLight += diffuseColor.rgb * uSunCol * (0.08 + bl * 0.55) * leafM; }
        #endif
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'foliageHD1';
  return m;
}
