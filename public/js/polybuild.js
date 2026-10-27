// Buildings from the real map footprints: extruded polygons with procedural facades, roofs, signs.
import * as THREE from 'three';
import { MAP, groundHeight } from './mapdata.js';
import { SURF } from './collision.js';
import { hex } from './geo.js';
import { signQuad, SIGN_COLORS } from './buildings.js';

export const CAMPUS_POLY = [[-1083, -345], [-735, -345], [-690, -50], [-600, 300], [-460, 560], [-470, 640], [-1083, 640]];
export function inPoly(x, z, poly) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
}
const FAC = { ku: 'ku', kuglass: 'kuglass', brick: 'brick', concrete: 'concrete', dorm: 'dorm', shop: 'shop', glass: 'glass', hall: 'hall', mart: 'ku', showroom: 'glass', house: 'dorm', warehouse: 'concrete', stand: 'concrete' };
const GF_DOOR = { mart: 'mart', shop: 'shutter', showroom: 'showroom', glass: 'darkglass', dorm: 'lobby', house: 'plain', warehouse: 'plain' };
const GF_SIDE = { shop: 'shutter', glass: 'darkglass', showroom: 'showroom', brick: 'brickw', mart: 'mart', house: 'plain', warehouse: 'plain' };
const ROOF_TINTS = ['#ffffff', '#ffffff', '#ffd2c0', '#a9b8ff', '#9fd6a8', '#d0a080', '#c8c8c8', '#ff9e8a'];
const SHOP_COLS = ['#f3d9a4', '#cfe3d4', '#f2c6b4', '#d6dff0', '#f6e7b0', '#e3d2ec', '#f4f1ea', '#cfe8ef', '#f7d1d1', '#e9e2c9'];
const HOUSE_COLS = ['#f4efe4', '#efe0c4', '#dfe9e0', '#f1d9cf', '#e6e2f0', '#f5e6c8', '#e3ecf2', '#f2f2f2'];

function quadAuto(gb, a, b, c, d, uvs, color, wantUp) {
  // flips winding if the resulting normal faces the wrong way
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
  const ny = uz * vx - ux * vz;
  if ((ny < 0) === wantUp) gb.quad(a, d, c, b, [uvs[0], uvs[3], uvs[2], uvs[1]], color);
  else gb.quad(a, b, c, d, uvs, color);
  void uy; void vy;
}

function hipRoofQuad(gb, P, y, h, color, overhang = 0.5) {
  // P: 4 corners [x,z]; long axis ridge
  const A = P[0], Bq = P[1], C = P[2], D = P[3];
  const len = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  let [a, b, c, d] = (len(A, Bq) + len(C, D) >= len(Bq, C) + len(D, A)) ? [A, Bq, C, D] : [Bq, C, D, A];
  // grow by overhang from centre
  const cx = (a[0] + b[0] + c[0] + d[0]) / 4, cz = (a[1] + b[1] + c[1] + d[1]) / 4;
  const grow = (p) => { const dx = p[0] - cx, dz = p[1] - cz, L = Math.hypot(dx, dz) || 1; return [p[0] + dx / L * overhang, p[1] + dz / L * overhang]; };
  [a, b, c, d] = [grow(a), grow(b), grow(c), grow(d)];
  const mAD = [(a[0] + d[0]) / 2, (a[1] + d[1]) / 2], mBC = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2];
  const L = len(mAD, mBC), s = (len(a, d) + len(b, c)) / 2;
  const ux = (mBC[0] - mAD[0]) / (L || 1), uz = (mBC[1] - mAD[1]) / (L || 1);
  const inset = Math.min(L / 2, s / 2);
  const E = [mAD[0] + ux * inset, y + h, mAD[1] + uz * inset], F = [mBC[0] - ux * inset, y + h, mBC[1] - uz * inset];
  const v = (p) => [p[0], y, p[1]]; const uvp = (p) => [p[0] / 3, p[2] / 3];
  const a3 = v(a), b3 = v(b), c3 = v(c), d3 = v(d);
  quadAuto(gb, a3, b3, F, E, [uvp(a3), uvp(b3), uvp(F), uvp(E)], color, true);
  quadAuto(gb, c3, d3, E, F, [uvp(c3), uvp(d3), uvp(E), uvp(F)], color, true);
  quadAuto(gb, b3, c3, F, F, [uvp(b3), uvp(c3), uvp(F), uvp(F)], color, true);
  quadAuto(gb, d3, a3, E, E, [uvp(d3), uvp(a3), uvp(E), uvp(E)], color, true);
}

function rectCorners(r, c) {
  const [w, h, angDeg] = r; const t = angDeg * Math.PI / 180; const cw = Math.cos(t), sw = Math.sin(t);
  const ax = [cw * w / 2, sw * w / 2], bx = [-sw * h / 2, cw * h / 2];
  return [[c[0] - ax[0] - bx[0], c[1] - ax[1] - bx[1]], [c[0] + ax[0] - bx[0], c[1] + ax[1] - bx[1]], [c[0] + ax[0] + bx[0], c[1] + ax[1] + bx[1]], [c[0] - ax[0] + bx[0], c[1] - ax[1] + bx[1]]];
}

export function buildMapBuildings(ctx) {
  const { B, col, atlas, rnd, interact } = ctx;
  const list = MAP.meta.buildings;
  // match named places to footprints
  const named = new Map();
  for (const pl of ctx.places) {
    if (!pl.at) continue;
    let best = -1, bd = 1e9;
    list.forEach((b, i) => { if (named.has(i)) return; const d = Math.hypot(b.c[0] - pl.at[0], b.c[1] - pl.at[1]) - (pl.town ? Math.min(30, Math.sqrt(b.a) * 0.3) : 0); if (pl.town && (b.a < 120 || b.a > 4000)) return; if (d < bd) { bd = d; best = i; } });
    if (best >= 0 && bd < (pl.town ? 60 : 25)) named.set(best, pl);
  }
  const lights = [];
  list.forEach((bd, i) => {
    const pts = []; for (let k = 0; k < bd.p.length; k += 2) pts.push([bd.p[k], bd.p[k + 1]]);
    const n = pts.length; if (n < 3) return;
    const pl = named.get(i);
    const campus = inPoly(bd.c[0], bd.c[1], CAMPUS_POLY);
    const a = bd.a, aspect = Math.max(bd.r[0], bd.r[1]) / Math.max(1, Math.min(bd.r[0], bd.r[1]));
    const nearSuk = bd.c[0] > -1175 && bd.c[0] < -1050;
    let style, floors, fh = 3.6, hip = false;
    if (pl) { style = pl.style; floors = pl.floors; fh = pl.fh || (style === 'shop' ? 3.4 : 3.8); }
    else if (campus) {
      if (a > 1200) { style = ['ku', 'kuglass', 'concrete', 'brick'][(rnd() * 4) | 0]; floors = Math.min(7, 3 + ((a / 900) | 0)); fh = 3.8; }
      else if (a > 300) { style = ['ku', 'brick', 'dorm', 'kuglass'][(rnd() * 4) | 0]; floors = 2 + ((rnd() * 3) | 0); fh = 3.7; }
      else { style = 'ku'; floors = 1 + (rnd() < 0.4 ? 1 : 0); fh = 3.5; hip = bd.f > 0.85 && n === 4; }
    } else {
      if (a > 3200) { style = 'warehouse'; floors = 1; fh = 7 + rnd() * 3; }
      else if (a > 900) { style = ['concrete', 'glass', 'dorm', 'kuglass', 'shop'][(rnd() * 5) | 0]; floors = (nearSuk ? 4 : 2) + ((rnd() * 4) | 0); fh = 3.6; }
      else if (a > 140) {
        if (aspect > 2.2 || nearSuk) { style = 'shop'; floors = 2 + ((rnd() * 3) | 0); fh = 3.4; }
        else { style = 'house'; floors = 1 + (rnd() < 0.55 ? 1 : 0); fh = 3.2; hip = bd.f > 0.82; }
      } else { style = 'house'; floors = 1; fh = 3.1; hip = bd.f > 0.78; }
    }
    // ground level = lowest corner
    let y0 = Infinity; for (const p of pts) y0 = Math.min(y0, groundHeight(p[0], p[1])); y0 = Math.min(y0, groundHeight(bd.c[0], bd.c[1]));
    const H = floors * fh; const top = y0 + H;
    const facKey = 'fac_' + (FAC[style] || 'concrete');
    let tint;
    if (style === 'shop') tint = hex(SHOP_COLS[(rnd() * SHOP_COLS.length) | 0]);
    else if (style === 'house') tint = hex(HOUSE_COLS[(rnd() * HOUSE_COLS.length) | 0]);
    else { const v = 0.9 + rnd() * 0.1; tint = [v, v, v * (0.97 + rnd() * 0.03)]; }
    const g = (m) => B.get(m, bd.c[0], bd.c[1]);
    // door edge: edge whose outward normal points to the nearest road
    let doorEdge = -1;
    if (pl || style === 'shop' || campus) {
      let bestD = 1e9;
      for (let k = 0; k < n; k++) {
        const p0 = pts[k], p1 = pts[(k + 1) % n]; const dx = p1[0] - p0[0], dz = p1[1] - p0[1]; const L = Math.hypot(dx, dz); if (L < 4) continue;
        const nx = -dz / L, nz = dx / L; const mx = (p0[0] + p1[0]) / 2, mz = (p0[1] + p1[1]) / 2;
        for (let t = 1; t < 45; t += 1.5) { const s = col.surfAt(mx + nx * t, mz + nz * t); if (s === SURF.BUILDING && t > 2) break; if (s === SURF.ROAD || s === SURF.WALK) { const sc = t - Math.min(L, 30) * 0.08; if (sc < bestD) { bestD = sc; doorEdge = k; } break; } }
      }
      if (doorEdge < 0) { let L0 = 0; for (let k = 0; k < n; k++) { const p0 = pts[k], p1 = pts[(k + 1) % n]; const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]); if (L > L0) { L0 = L; doorEdge = k; } } }
    }
    const doorKind = GF_DOOR[style] || 'lobby', sideKind = GF_SIDE[style] || 'plain';
    // walls
    const isWare = style === 'warehouse';
    for (let k = 0; k < n; k++) {
      const p0 = pts[k], p1 = pts[(k + 1) % n]; const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]); if (L < 0.05) continue;
      const A0 = [p0[0], y0 - 3, p0[1]], A1 = [p1[0], y0 - 3, p1[1]];
      // plinth
      g('trimDark').quad(A0, A1, [p1[0], y0 + 0.2, p1[1]], [p0[0], y0 + 0.2, p0[1]], [[0, 0], [L / 2, 0], [L / 2, 1], [0, 1]]);
      if (isWare) {
        g('roofMetal').quad([p0[0], y0 + 0.2, p0[1]], [p1[0], y0 + 0.2, p1[1]], [p1[0], top, p1[1]], [p0[0], top, p0[1]], [[0, 0], [L / 4, 0], [L / 4, H / 4], [0, H / 4]], tint);
        continue;
      }
      const gk = 'gf_' + (k === doorEdge ? doorKind : sideKind);
      const gfTop = Math.min(top, y0 + fh);
      g(gk).quad([p0[0], y0 + 0.2, p0[1]], [p1[0], y0 + 0.2, p1[1]], [p1[0], gfTop, p1[1]], [p0[0], gfTop, p0[1]], [[0, 0.05], [L / 7.2, 0.05], [L / 7.2, 1], [0, 1]], tint);
      if (floors > 1) g(facKey).quad([p0[0], gfTop, p0[1]], [p1[0], gfTop, p1[1]], [p1[0], top, p1[1]], [p0[0], top, p0[1]], [[0, 0], [L / 7.2, 0], [L / 7.2, (H - fh) / (2 * fh)], [0, (H - fh) / (2 * fh)]], tint);
      // slab band
      if (floors > 1 && style !== 'house') g('trim').quad([p0[0], gfTop - 0.1, p0[1]], [p1[0], gfTop - 0.1, p1[1]], [p1[0], gfTop + 0.18, p1[1]], [p0[0], gfTop + 0.18, p0[1]], [[0, 0], [L / 4, 0], [L / 4, 0.1], [0, 0.1]], tint);
      if (!hip) { // parapet: outer + inner face + cap
        const ph = style === 'house' ? 0.5 : 0.95;
        g('trim').quad([p0[0], top, p0[1]], [p1[0], top, p1[1]], [p1[0], top + ph, p1[1]], [p0[0], top + ph, p0[1]], [[0, 0], [L / 4, 0], [L / 4, ph / 4], [0, ph / 4]], tint);
        g('trim').quad([p1[0], top, p1[1]], [p0[0], top, p0[1]], [p0[0], top + ph, p0[1]], [p1[0], top + ph, p1[1]], [[0, 0], [L / 4, 0], [L / 4, ph / 4], [0, ph / 4]], tint);
      }
      col.addWall(p0[0], p0[1], p1[0], p1[1], 0.5, top + 1);
    }
    if (isWare) for (let k = 0; k < n; k++) { const p0 = pts[k], p1 = pts[(k + 1) % n]; col.addWall(p0[0], p0[1], p1[0], p1[1], 0.5, top + 1); }
    // roof
    if (hip) {
      const P = n === 4 ? pts : rectCorners(bd.r, bd.c);
      const tc = hex(ROOF_TINTS[(rnd() * ROOF_TINTS.length) | 0]);
      hipRoofQuad(g(rnd() < 0.8 ? 'roofTile' : 'roofMetal'), P, top, Math.min(3.2, Math.min(bd.r[0], bd.r[1]) * 0.3), tc, 0.6);
    } else {
      const contour = pts.map(p => new THREE.Vector2(p[0], p[1]));
      let tris = [];
      try { tris = THREE.ShapeUtils.triangulateShape(contour, []); } catch (e) { tris = []; }
      const rm = isWare ? 'roofMetal' : 'roof';
      const gb = g(rm);
      const RT = [[1, 1, 1], [1.0, 0.96, 0.88], [0.8, 0.8, 0.82], [0.92, 0.9, 0.86], [0.7, 0.72, 0.74], [0.95, 0.88, 0.8]];
      const rtint = isWare ? hex(ROOF_TINTS[(rnd() * ROOF_TINTS.length) | 0]) : RT[(rnd() * RT.length) | 0];
      for (const t of tris) {
        const P0 = [pts[t[0]][0], top + 0.03, pts[t[0]][1]], P1 = [pts[t[1]][0], top + 0.03, pts[t[1]][1]], P2 = [pts[t[2]][0], top + 0.03, pts[t[2]][1]];
        const uv = (p) => [p[0] / 6, p[2] / 6];
        quadAuto(gb, P0, P1, P2, P2, [uv(P0), uv(P1), uv(P2), uv(P2)], rtint, true);
      }
      // rooftop clutter on bigger flat roofs
      if (a > 250 && floors >= 2) {
        const nU = Math.min(6, 1 + ((a / 400) | 0));
        for (let k = 0; k < nU; k++) {
          const t = 0.2 + rnd() * 0.6, q = 0.2 + rnd() * 0.6; const [ax, az] = [bd.c[0] + (rnd() - 0.5) * Math.min(bd.r[0], bd.r[1]) * 0.5, bd.c[1] + (rnd() - 0.5) * Math.min(bd.r[0], bd.r[1]) * 0.5]; void t; void q;
          if (col.surfAt(ax, az) !== SURF.BUILDING) continue;
          const rr = rnd();
          if (rr < 0.22 && campus) { const tA = (bd.r[2] || 0) * Math.PI / 180; for (let q = 0; q < 4; q++) { const px = ax + q * 1.9 * Math.cos(tA), pz = az + q * 1.9 * Math.sin(tA); if (col.surfAt(px, pz) === SURF.BUILDING) g('paint').box(px, top + 0.45, pz, 1.7, 0.08, 3.2, -tA, { color: [0.08, 0.12, 0.22] }); } }
          else if (rr < 0.6) g('paint').box(ax, top + 0.6, az, 1.6, 1.2, 1.0, rnd() * 3, { color: [0.85, 0.85, 0.83] });
          else g('paint').geometry(TANK, new THREE.Matrix4().makeTranslation(ax, top + 1.0, az), hex(rnd() < 0.5 ? '#3b6fb5' : '#d9d4c7'));
        }
      }
    }
    // shophouse awnings + generic sign boards on the street face
    if (style === 'shop' && doorEdge >= 0 && !pl) {
      const p0 = pts[doorEdge], p1 = pts[(doorEdge + 1) % n]; const dx = p1[0] - p0[0], dz = p1[1] - p0[1]; const L = Math.hypot(dx, dz); const nx = -dz / L, nz = dx / L;
      const units = Math.max(1, Math.round(L / 4.5));
      for (let u = 0; u < units; u++) {
        const t0 = u / units, t1 = (u + 1) / units; const ax0 = p0[0] + dx * t0, az0 = p0[1] + dz * t0, ax1 = p0[0] + dx * t1, az1 = p0[1] + dz * t1;
        const c = hex(['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad', '#16a085', '#d35400', '#e84393'][(rnd() * 8) | 0]);
        const yA = y0 + fh - 0.35;
        g('fabric').quad([ax0, yA, az0], [ax1, yA, az1], [ax1 + nx * 1.6, yA - 0.5, az1 + nz * 1.6], [ax0 + nx * 1.6, yA - 0.5, az0 + nz * 1.6], [[0, 0], [1, 0], [1, 1], [0, 1]], c);
        if (ctx.genericSigns && rnd() < 0.75) {
          const uv = ctx.genericSigns[(rnd() * ctx.genericSigns.length) | 0];
          const w = Math.min(4.2, L / units * 0.92); const mx = (ax0 + ax1) / 2, mz = (az0 + az1) / 2;
          signQuad(g('sign2'), uv, mx + nx * 0.08, y0 + fh + 0.55, mz + nz * 0.08, nx, nz, w, 4);
        }
      }
    }
    // named: canopy, sign, interaction
    if (pl && doorEdge >= 0) {
      const p0 = pts[doorEdge], p1 = pts[(doorEdge + 1) % n]; const dx = p1[0] - p0[0], dz = p1[1] - p0[1]; const L = Math.hypot(dx, dz); const nx = -dz / L, nz = dx / L;
      const mx = (p0[0] + p1[0]) / 2, mz = (p0[1] + p1[1]) / 2;
      const sc = SIGN_COLORS[pl.kind] || {};
      const uv = atlas.add(pl.th || pl.name, pl.name, sc);
      const sw = Math.min(L * 0.8, 22, Math.max(6, L * 0.6));
      const sy = floors >= 3 ? top - sw / 16 - 0.6 : y0 + fh + 0.25 + sw / 16;
      signQuad(g('sign'), uv, mx + nx * 0.15, sy, mz + nz * 0.15, nx, nz, sw);
      // canopy
      const cw = Math.min(11, L * 0.5), cd = 3.2, cy = y0 + Math.min(fh, 3.6) - 0.3;
      const tx = dx / L, tz = dz / L;
      const cx = mx + nx * cd / 2, cz = mz + nz * cd / 2;
      g(pl.style === 'mart' ? 'trimGreen' : 'trim').box(cx, cy, cz, cw, 0.32, cd, Math.atan2(-tz, tx), { u: 3, v: 1, color: tint });
      for (const s of [-1, 1]) { const px = mx + nx * (cd - 0.3) + tx * s * (cw / 2 - 0.3), pz = mz + nz * (cd - 0.3) + tz * s * (cw / 2 - 0.3); g('trim').box(px, (y0 + cy) / 2, pz, 0.36, cy - y0, 0.36, 0, { u: 1, v: 3, color: tint }); col.addCircle(px, pz, 0.28, cy); }
      const door = { x: mx + nx * 4.2, z: mz + nz * 4.2, nx, nz, y: y0 };
      const place = { ...pl, x: bd.c[0], z: bd.c[1], w: bd.r[0], d: bd.r[1], _door: door, _y0: y0, poly: pts, top };
      ctx.placeObjs[pl.id] = place;
      interact.push({ id: pl.id, b: place, x: door.x, z: door.z, r: 3.6 });
      lights.push(door);
    }
    if (campus && !pl && doorEdge >= 0 && floors >= 2) ctx.campusDoors.push(edgeDoor(pts, doorEdge));
    ctx.bldInfo.push({ c: bd.c, top, campus, style, a });
  });
  return lights;
}
function edgeDoor(pts, k) { const n = pts.length; const p0 = pts[k], p1 = pts[(k + 1) % n]; const dx = p1[0] - p0[0], dz = p1[1] - p0[1]; const L = Math.hypot(dx, dz); return { x: (p0[0] + p1[0]) / 2 - dz / L * 3.5, z: (p0[1] + p1[1]) / 2 + dx / L * 3.5, nx: -dz / L, nz: dx / L, len: L }; }

const TANK = (() => { const gg = new THREE.CylinderGeometry(0.8, 0.8, 1.8, 10); return gg; })();
