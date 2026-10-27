// Buildings: procedural facades, roofs, canopies, signs, special structures + collision + surface raster.
import * as THREE from 'three';
import { groundHeight } from './mapdata.js';
import { SURF } from './collision.js';
import { hex, GeoBuilder } from './geo.js';
import { canvas, toTex, THAI_FONT } from './textures.js';

const DOOR_N = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

// ---------- sign atlas ----------
export class SignAtlas {
  constructor() { this.c = canvas(2048, 4096); this.ctx = this.c.getContext('2d'); this.n = 0; this.cols = 2; this.rows = 32; }
  add(th, en, { bg = '#0d6b52', fg = '#ffffff', sub = '#cfeee2', border = '#e3c25c' } = {}) {
    const i = this.n++; const cx = (i % this.cols) * 1024, cy = Math.floor(i / this.cols) * 128; const ctx = this.ctx;
    ctx.fillStyle = bg; ctx.fillRect(cx, cy, 1024, 128);
    if (border) { ctx.strokeStyle = border; ctx.lineWidth = 6; ctx.strokeRect(cx + 5, cy + 5, 1014, 118); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const fit = (t, size, weight) => { let s = size; ctx.font = `${weight} ${s}px ${THAI_FONT}`; while (ctx.measureText(t).width > 960 && s > 10) { s -= 2; ctx.font = `${weight} ${s}px ${THAI_FONT}`; } };
    fit(th, 52, 700); ctx.fillStyle = fg; ctx.fillText(th, cx + 512, cy + 46);
    fit(en.toUpperCase(), 30, 700); ctx.fillStyle = sub; ctx.fillText(en.toUpperCase(), cx + 512, cy + 96);
    const u0 = cx / 2048, v1 = 1 - cy / 4096, u1 = (cx + 1024) / 2048, v0 = 1 - (cy + 128) / 4096;
    return [u0, v0, u1, v1];
  }
  addHalf(text, bg) {
    if (!this.half || this.half.used >= 2) { this.half = { i: this.n++, used: 0 }; }
    const i = this.half.i, k = this.half.used++; const cx = (i % this.cols) * 1024 + k * 512, cy = Math.floor(i / this.cols) * 128; const ctx = this.ctx;
    ctx.fillStyle = bg; ctx.fillRect(cx, cy, 512, 128); ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.strokeRect(cx + 6, cy + 6, 500, 116);
    ctx.fillStyle = '#fff'; ctx.font = `700 58px ${THAI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, cx + 256, cy + 66, 480);
    return [cx / 2048, 1 - (cy + 128) / 4096, (cx + 512) / 2048, 1 - cy / 4096];
  }
  texture() { const t = toTex(this.c, { repeat: false }); t.flipY = true; return t; }
}

// put a sign quad on a facade: centre (x,y,z), facing direction (nx,nz), width
function signQuad(b, uv, x, y, z, nx, nz, w, aspect = 8) {
  const h = w / aspect; const tx = nz, tz = -nx; // tangent (right when looking at sign)
  const hw = w / 2;
  const p0 = [x - tx * hw, y - h / 2, z - tz * hw], p1 = [x + tx * hw, y - h / 2, z + tz * hw], p2 = [x + tx * hw, y + h / 2, z + tz * hw], p3 = [x - tx * hw, y + h / 2, z - tz * hw];
  b.quad(p0, p1, p2, p3, [[uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]]);
}

const FAC = { ku: 'ku', kuglass: 'kuglass', brick: 'brick', concrete: 'concrete', dorm: 'dorm', shop: 'shop', glass: 'glass', hall: 'hall', mart: 'ku', showroom: 'glass' };
const GF_DOOR = { mart: 'mart', shop: 'shutter', showroom: 'showroom', glass: 'darkglass', dorm: 'lobby' };
const GF_SIDE = { shop: 'shutter', glass: 'darkglass', showroom: 'showroom', brick: 'brickw', mart: 'mart' };
const SIGN_COLORS = {
  mart: { bg: '#0a8a4a', border: '#f39c12' }, gas: { bg: '#b81d24', border: '#ffffff' }, fashion: { bg: '#222222', border: '#e98fb0' },
  moto: { bg: '#c0392b', border: '#ffffff' }, cars: { bg: '#1c2b4a', border: '#c9d6e8' }, bank: { bg: '#4b2a7a', border: '#e3c25c' },
  mookata: { bg: '#8e2b20', border: '#f5b041' }, fitness: { bg: '#111111', border: '#e74c3c' }, noodle: { bg: '#7b4a2a', border: '#f7dc6f' },
  clinic: { bg: '#ffffff', fg: '#1b7f5a', sub: '#2c3e50', border: '#1b7f5a' }, hotel: { bg: '#1e3a5f', border: '#e3c25c' }, seafood: { bg: '#0e5a8a', border: '#f7dc6f' },
  cafe: { bg: '#4a2f22', border: '#d7b98e' }, barber: { bg: '#1f3a93', border: '#e74c3c' }, condo: { bg: '#2c3e50', border: '#bdc3c7' }, market: { bg: '#d35400', border: '#f7dc6f' },
};

export function buildRect(b, ctx) {
  const { B, col, atlas, rnd, interact } = ctx;
  const st = b.style;
  const hx = b.w / 2, hz = b.d / 2;
  const y0 = Math.min(groundHeight(b.x - hx, b.z - hz), groundHeight(b.x + hx, b.z - hz), groundHeight(b.x - hx, b.z + hz), groundHeight(b.x + hx, b.z + hz), groundHeight(b.x, b.z));
  const dn = DOOR_N[b.door || 's'];
  const faceLen = dn[0] ? b.d : b.w;
  const fx = b.x + dn[0] * (hx), fz = b.z + dn[1] * (hz);
  const door = { x: fx + dn[0] * 3.2, z: fz + dn[1] * 3.2, nx: dn[0], nz: dn[1], y: y0 };
  b._door = door; b._y0 = y0;
  const sc = SIGN_COLORS[b.kind] || {};
  const uv = atlas.add(b.th || b.name, b.name, sc);
  const tint = st === 'shop' ? hex(['#f3d9a4', '#cfe3d4', '#f2c6b4', '#d6dff0', '#f6e7b0', '#e3d2ec'][(rnd() * 6) | 0]) : [0.94 + rnd() * 0.06, 0.94 + rnd() * 0.06, 0.94 + rnd() * 0.06];
  const g = (m) => B.get(m, b.x, b.z);
  if (FAC[st]) boxBuilding(b, y0, st, tint, uv, faceLen, dn, g, col, rnd);
  else special(b, y0, st, uv, dn, g, col, rnd, ctx);
  interact.push({ id: b.id, b, x: door.x, z: door.z, r: st === 'canteen' || st === 'market' || st === 'pool' ? Math.max(hx, hz) + 2 : 3.4 });
  return door;
}
export { SIGN_COLORS, signQuad };

function boxBuilding(b, y0, st, tint, uv, faceLen, dn, g, col, rnd) {
  const fh = b.fh || (st === 'shop' ? 3.4 : 3.8); const floors = Math.max(1, b.floors); const H = floors * fh;
  const facKey = 'fac_' + FAC[st];
  const doorKind = GF_DOOR[st] || 'lobby', sideKind = GF_SIDE[st] || 'plain';
  // plinth
  g('trimDark').box(b.x, y0 - 1.0, b.z, b.w + 0.3, 2.0 + 0.3, b.d + 0.3, 0, { u: 2, v: 2, skip: { bt: true } });
  // ground floor: each face separately so the door face gets the entrance texture
  const faces = { s: 'f', e: 'r', n: 'b', w: 'l' };
  for (const side of ['s', 'e', 'n', 'w']) {
    const kind = side === b.door ? doorKind : sideKind;
    const skip = { t: true, bt: true, f: true, r: true, b: true, l: true }; skip[faces[side]] = false;
    g('gf_' + kind).box(b.x, y0 + fh / 2, b.z, b.w, fh - 0.3, b.d, 0, { u: 7.2, v: fh, skip, color: tint });
  }
  // upper floors
  if (floors > 1) g(facKey).box(b.x, y0 + fh + (H - fh) / 2, b.z, b.w, H - fh, b.d, 0, { u: 7.2, v: fh * 2, skip: { t: true, bt: true }, color: tint });
  // floor slab band between gf and upper
  g('trim').box(b.x, y0 + fh - 0.15, b.z, b.w + 0.25, 0.3, b.d + 0.25, 0, { u: 4, v: 1, color: tint });
  // roof + parapet
  g('roof').plane(b.x, y0 + H + 0.02, b.z, b.w, b.d, 0, 8);
  const ph = 1.0, pt = 0.35, top = y0 + H;
  g('trim').box(b.x, top + ph / 2, b.z - b.d / 2 + pt / 2, b.w, ph, pt, 0, { u: 4, v: 1, color: tint });
  g('trim').box(b.x, top + ph / 2, b.z + b.d / 2 - pt / 2, b.w, ph, pt, 0, { u: 4, v: 1, color: tint });
  g('trim').box(b.x - b.w / 2 + pt / 2, top + ph / 2, b.z, pt, ph, b.d - pt * 2, 0, { u: 4, v: 1, color: tint });
  g('trim').box(b.x + b.w / 2 - pt / 2, top + ph / 2, b.z, pt, ph, b.d - pt * 2, 0, { u: 4, v: 1, color: tint });
  // KU green accent band on campus styles
  if (st === 'ku' || st === 'kuglass' || st === 'hall') g('trimGreen').box(b.x, top + ph + 0.12, b.z, b.w + 0.1, 0.24, b.d + 0.1, 0, { u: 4, v: 1, skip: { bt: true, t: true } });
  // rooftop clutter
  if (floors >= 2 && b.w > 12) {
    g('trim').box(b.x + (rnd() - 0.5) * b.w * 0.4, top + 1.6, b.z + (rnd() - 0.5) * b.d * 0.3, 6, 3.2, 4.5, 0, { u: 4, v: 4, color: tint });
    const n = 2 + ((rnd() * 5) | 0);
    for (let i = 0; i < n; i++) {
      const ax = b.x + (rnd() - 0.5) * (b.w - 4), az = b.z + (rnd() - 0.5) * (b.d - 4);
      if (rnd() < 0.5) g('paint').box(ax, top + 0.6, az, 1.6, 1.2, 1.0, rnd() * 3, { color: [0.85, 0.85, 0.83] });
      else g('paint').geometry(TANK, new THREE.Matrix4().makeTranslation(ax, top + 1.2, az), hex(rnd() < 0.5 ? '#3b6fb5' : '#d9d4c7'));
    }
  }
  // entrance canopy + sign
  const nx = dn[0], nz = dn[1];
  const fx = b.x + nx * b.w / 2, fz = b.z + nz * b.d / 2;
  const cw = Math.min(12, faceLen * 0.45), cd = st === 'shop' ? 1.6 : 3.4;
  const cy = y0 + fh - 0.45;
  const ccx = fx + nx * cd / 2, ccz = fz + nz * cd / 2;
  if (nx) g(st === 'mart' ? 'trimGreen' : 'trim').box(ccx, cy, ccz, cd, 0.35, cw, 0, { u: 3, v: 1, color: tint });
  else g(st === 'mart' ? 'trimGreen' : 'trim').box(ccx, cy, ccz, cw, 0.35, cd, 0, { u: 3, v: 1, color: tint });
  if (st !== 'shop' && st !== 'mart') {
    for (const s of [-1, 1]) {
      const px = fx + nx * (cd - 0.3) + (nx ? 0 : s * (cw / 2 - 0.3)), pz = fz + nz * (cd - 0.3) + (nz ? 0 : s * (cw / 2 - 0.3));
      g('trim').box(px, y0 + (fh - 0.45) / 2, pz, 0.4, fh - 0.45, 0.4, 0, { u: 1, v: 3, color: tint });
      col.addCircle(px, pz, 0.3, y0 + fh);
    }
  }
  const sw = Math.min(faceLen * 0.75, 20, Math.max(6, faceLen * 0.6));
  const sy = floors >= 3 ? y0 + H - sw / 16 - 0.5 : (floors > 1 ? y0 + fh + 0.9 + sw / 16 : y0 + fh - 0.05 + sw / 16 + 0.2);
  if (floors > 1) signQuad(g('sign'), uv, fx + nx * 0.12, sy, fz + nz * 0.12, nx, nz, sw);
  if (floors === 1) { // sign board sits on top of the canopy front
    signQuad(g('sign'), uv, ccx + nx * (cd / 2 + 0.05), cy + 0.6, ccz + nz * (cd / 2 + 0.05), nx, nz, Math.min(sw, cw));
  }
  col.addBox(b.x, b.z, b.w / 2, b.d / 2, 0, y0 + H + 1, -50, b.id);
  col.fillRect(b.x - b.w / 2, b.z - b.d / 2, b.x + b.w / 2, b.z + b.d / 2, SURF.BUILDING);
}

const TANK = (() => { const gg = new THREE.CylinderGeometry(0.8, 0.8, 1.8, 10); gg.deleteAttribute('uv'); gg.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(gg.attributes.position.count * 2), 2)); return gg; })();
const CYL = (r1, r2, h, s = 8) => new THREE.CylinderGeometry(r1, r2, h, s);
const M4 = () => new THREE.Matrix4();

function special(b, y0, st, uv, dn, g, col, rnd, ctx) {
  const hx = b.w / 2, hz = b.d / 2;
  const nx = dn[0], nz = dn[1];
  const signPost = (w = 6, hgt = 3.2) => {
    const px = b.x + nx * (hx + 4) + (nz ? -w * 0.4 : 0), pz = b.z + nz * (hz + 4) + (nx ? -w * 0.4 : 0);
    g('metal').box(px - (nz ? w / 2 : 0), y0 + hgt / 2, pz - (nx ? w / 2 : 0), 0.15, hgt, 0.15);
    g('metal').box(px + (nz ? w / 2 : 0), y0 + hgt / 2, pz + (nx ? w / 2 : 0), 0.15, hgt, 0.15);
    signQuad(g('sign'), uv, px + nx * 0.1, y0 + hgt - 0.1, pz + nz * 0.1, nx, nz, w);
    signQuad(g('sign'), uv, px - nx * 0.1, y0 + hgt - 0.1, pz - nz * 0.1, -nx, -nz, w);
  };
  if (st === 'canteen') {
    const H = b.floors > 1 ? 7 : 5;
    g('plaza').plane(b.x, y0 + 0.08, b.z, b.w, b.d, 0, 3);
    col.fillRect(b.x - hx, b.z - hz, b.x + hx, b.z + hz, SURF.PLAZA);
    const step = 7; const cxn = Math.max(2, Math.round(b.w / step)), czn = Math.max(2, Math.round(b.d / step));
    for (let i = 0; i <= cxn; i++) for (let j = 0; j <= czn; j++) {
      if (i > 0 && i < cxn && j > 0 && j < czn && (i + j) % 2) continue;
      const px = b.x - hx + i * b.w / cxn, pz = b.z - hz + j * b.d / czn;
      g('trim').box(px, y0 + H / 2, pz, 0.5, H, 0.5, 0, { u: 1, v: 3 }); col.addCircle(px, pz, 0.35, y0 + H);
    }
    // hip roof
    hipRoof(g('roofMetal'), b.x, y0 + H, b.z, b.w + 3, b.d + 3, 3.2);
    g('trimGreen').box(b.x, y0 + H - 0.4, b.z, b.w + 3.1, 0.8, b.d + 3.1, 0, { u: 4, v: 1, skip: { t: true, bt: true } });
    // tables + benches
    for (let i = 0; i < Math.floor(b.w / 4.5) - 1; i++) for (let j = 0; j < Math.floor(b.d / 5) - 1; j++) {
      const tx = b.x - hx + 4 + i * 4.5, tz = b.z - hz + 4 + j * 5;
      g('paint').box(tx, y0 + 0.75, tz, 1.0, 0.06, 2.4, 0, { color: [0.92, 0.92, 0.9] });
      g('paint').box(tx, y0 + 0.37, tz, 0.12, 0.74, 0.12, 0, { color: [0.5, 0.5, 0.52] });
      g('paint').box(tx - 0.8, y0 + 0.45, tz, 0.35, 0.06, 2.4, 0, { color: hex('#2e8b57') });
      g('paint').box(tx + 0.8, y0 + 0.45, tz, 0.35, 0.06, 2.4, 0, { color: hex('#2e8b57') });
    }
    // food stall counters along the back
    const bx = b.x - nx * (hx - 2.5), bz = b.z - nz * (hz - 2.5);
    const cnt = 6;
    for (let k = 0; k < cnt; k++) {
      const off = (k - (cnt - 1) / 2) * ((nx ? b.d : b.w) / cnt);
      const sx = bx + (nz ? off : 0), sz = bz + (nx ? off : 0);
      g('paint').box(sx, y0 + 0.55, sz, nx ? 1.4 : (nx ? 1.4 : (b.w / cnt) - 1), 1.1, nz ? 1.4 : (b.d / cnt) - 1, 0, { color: hex(['#e67e22', '#c0392b', '#16a085', '#2980b9', '#8e44ad', '#d4ac0d'][k % 6]) });
      col.addCircle(sx, sz, 0.8, y0 + 1.2);
    }
    signPost(Math.min(12, b.w * 0.4), 4);
    return;
  }
  if (st === 'market' || st === 'stall') {
    g('plaza').plane(b.x, y0 + 0.07, b.z, b.w, b.d, 0, 3);
    col.fillRect(b.x - hx, b.z - hz, b.x + hx, b.z + hz, SURF.PLAZA);
    const cols = ['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad', '#e74c3c', '#16a085', '#f1c40f'];
    const sx = 4.5, sz = 4.5;
    for (let x = b.x - hx + sx / 2; x < b.x + hx - 0.5; x += sx) for (let z = b.z - hz + sz / 2; z < b.z + hz - 0.5; z += sz) {
      if (b.d > 20 && Math.abs(z - b.z) < 2.6) continue; // aisle
      const c = hex(cols[(rnd() * cols.length) | 0]);
      // canopy (two sloped planes)
      const hgt = 2.6;
      const gb = g('fabric');
      gb.quad([x - 1.9, y0 + hgt, z + 1.9], [x + 1.9, y0 + hgt, z + 1.9], [x + 1.9, y0 + hgt + 0.8, z], [x - 1.9, y0 + hgt + 0.8, z], [[0, 0], [1, 0], [1, 1], [0, 1]], c);
      gb.quad([x + 1.9, y0 + hgt, z - 1.9], [x - 1.9, y0 + hgt, z - 1.9], [x - 1.9, y0 + hgt + 0.8, z], [x + 1.9, y0 + hgt + 0.8, z], [[0, 0], [1, 0], [1, 1], [0, 1]], c);
      for (const [px, pz] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) g('metal').box(x + px, y0 + hgt / 2, z + pz, 0.07, hgt, 0.07);
      g('paint').box(x, y0 + 0.45, z + 1.2, 3.2, 0.9, 0.9, 0, { color: hex('#8d6e4f') });
      // goods
      for (let k = 0; k < 4; k++) g('paint').box(x - 1.2 + k * 0.8, y0 + 0.97, z + 1.2, 0.5, 0.14, 0.5, 0, { color: hex(['#e74c3c', '#f1c40f', '#27ae60', '#e67e22', '#ecf0f1'][(rnd() * 5) | 0]) });
      col.addBox(x, z + 1.2, 1.6, 0.45, 0, y0 + 1);
    }
    signPost(Math.min(10, b.w * 0.5), 4);
    return;
  }
  if (st === 'gas') {
    // canopy towards the door side, shop at the back
    const shopD = 8; const canD = b.d;
    const canX = b.x + nx * 4, canZ = b.z + nz * 4;
    const H = 5.6;
    g('plaza').plane(b.x, y0 + 0.07, b.z, b.w + 10, b.d + 4, 0, 4);
    col.fillRect(b.x - hx - 5, b.z - hz - 2, b.x + hx + 5, b.z + hz + 2, SURF.PLAZA);
    g('white').box(canX, y0 + H, canZ, nx ? 18 : b.w, 0.9, nx ? canD : 18, 0, { u: 4, v: 1 });
    g('paint').box(canX, y0 + H - 0.55, canZ, (nx ? 18 : b.w) + 0.05, 0.25, (nx ? canD : 18) + 0.05, 0, { color: hex('#c0392b'), skip: { t: true, bt: true } });
    for (const a of [-1, 1]) for (const c2 of [-1, 1]) {
      const px = canX + (nx ? a * 5 : a * (b.w / 2 - 3)), pz = canZ + (nx ? c2 * (canD / 2 - 3) : c2 * 5);
      g('white').box(px, y0 + H / 2, pz, 0.5, H, 0.5); col.addCircle(px, pz, 0.35, y0 + H);
      g('paint').box(px + (nx ? 0 : 1.6), y0 + 0.8, pz + (nx ? 1.6 : 0), 0.8, 1.6, 0.6, 0, { color: hex('#ecf0f1') });
      g('paint').box(px + (nx ? 0 : 1.6), y0 + 1.25, pz + (nx ? 1.6 : 0) + 0.01, 0.6, 0.4, 0.62, 0, { color: hex('#c0392b') });
      col.addCircle(px + (nx ? 0 : 1.6), pz + (nx ? 1.6 : 0), 0.5, y0 + 1.6);
    }
    // shop building behind
    const sxp = b.x - nx * (hx - shopD / 2 + 3), szp = b.z - nz * (hz - shopD / 2 + 3);
    const sw = nx ? shopD : b.w * 0.6, sd = nx ? b.d * 0.6 : shopD;
    g('gf_mart').box(sxp, y0 + 1.9, szp, sw, 3.8, sd, 0, { u: 7.2, v: 3.8, skip: { t: true, bt: true } });
    g('roof').plane(sxp, y0 + 3.82, szp, sw, sd, 0, 8);
    col.addBox(sxp, szp, sw / 2, sd / 2, 0, y0 + 4);
    // price pylon
    const pyx = b.x + nx * (hx + 3) + (nz ? hx - 2 : 0), pyz = b.z + nz * (hz + 3) + (nx ? hz - 2 : 0);
    g('paint').box(pyx, y0 + 3.5, pyz, 1.6, 7, 0.5, nx ? Math.PI / 2 : 0, { color: hex('#c0392b') });
    signQuad(g('sign'), uv, pyx + nx * 0.4, y0 + 6.2, pyz + nz * 0.4, nx, nz, 4.8);
    col.addCircle(pyx, pyz, 0.9, y0 + 7);
    return;
  }
  if (st === 'thai') {
    const ph = 0.45, H = b.fh || 4.2;
    g('trim').box(b.x, y0 + ph / 2 - 0.3, b.z, b.w + 1, ph + 0.6, b.d + 1, 0, { u: 2, v: 1 });
    g('wood').plane(b.x, y0 + ph + 0.01, b.z, b.w + 0.9, b.d + 0.9, 0, 2);
    col.fillRect(b.x - hx - 0.5, b.z - hz - 0.5, b.x + hx + 0.5, b.z + hz + 0.5, SURF.PLATFORM);
    col.platforms.push({ x0: b.x - hx - 0.5, x1: b.x + hx + 0.5, z0: b.z - hz - 0.5, z1: b.z + hz + 0.5, h: y0 + ph });
    // steps
    g('trim').box(b.x + nx * (hx + 1.0), y0 + 0.12, b.z + nz * (hz + 1.0), nx ? 1.0 : 4, 0.24, nz ? 1.0 : 4, 0, { u: 2, v: 1 });
    for (const a of [-1, 1]) for (const c2 of [-1, -0.33, 0.33, 1]) {
      const px = b.x + a * (hx - 0.4), pz = b.z + c2 * (hz - 0.4);
      g('white').geometry(CYL(0.22, 0.26, H, 10), M4().makeTranslation(px, y0 + ph + H / 2, pz)); col.addCircle(px, pz, 0.28, y0 + H);
    }
    for (const c2 of [-1, 1]) for (const a of [-0.33, 0.33]) { const px = b.x + a * (hx - 0.4), pz = b.z + c2 * (hz - 0.4); g('white').geometry(CYL(0.22, 0.26, H, 10), M4().makeTranslation(px, y0 + ph + H / 2, pz)); }
    thaiRoof(g('roofTile'), g('gable'), b.x, y0 + ph + H, b.z, b.w + 2, b.d + 2, b.w > 16);
    // low benches inside
    if (b.kind === 'seafood') {
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j += 2) { g('paint').box(b.x + i * 5, y0 + ph + 0.74, b.z + j * 3, 1.4, 0.06, 1.4, 0, { color: [0.95, 0.95, 0.95] }); g('paint').box(b.x + i * 5, y0 + ph + 0.37, b.z + j * 3, 0.1, 0.74, 0.1, 0, { color: [0.4, 0.4, 0.4] }); }
    }
    signPost(Math.min(8, b.w * 0.6), 3);
    return;
  }
  if (st === 'hangar') {
    const H = 5;
    g('fac_concrete').box(b.x, y0 + H / 2, b.z, b.w, H, b.d, 0, { u: 7.2, v: 7.6, skip: { t: true, bt: true } });
    // barrel roof: half cylinder along x
    const r = b.d / 2; const geo = new THREE.CylinderGeometry(r, r, b.w, 20, 1, true, 0, Math.PI);
    const m = M4().makeRotationZ(Math.PI / 2); m.premultiply(M4().makeScale(1, 0.45, 1)); m.premultiply(M4().makeTranslation(b.x, y0 + H, b.z));
    g('roofMetal').geometry(geo, m, [1, 1, 1], 6);
    // end walls (half-ellipse fill) approximated with box gables
    for (const s of [-1, 1]) { const sh = new THREE.Shape(); sh.absarc(0, 0, r, 0, Math.PI, false); const sg = new THREE.ShapeGeometry(sh, 12); const mm = M4().makeScale(1, 0.45, 1); mm.premultiply(M4().makeRotationY(s > 0 ? Math.PI / 2 : -Math.PI / 2)); mm.premultiply(M4().makeTranslation(b.x + s * hx, y0 + H, b.z)); g('trim').geometry(sg, mm); }
    // big hangar door
    g('trimDark').box(b.x + nx * (hx + 0.05), y0 + 2.2, b.z + nz * (hz + 0.06), nx ? 0.1 : b.w * 0.55, 4.4, nz ? 0.1 : b.w * 0.55);
    signQuad(g('sign'), uv, b.x + nx * (hx + 0.15), y0 + H - 0.2, b.z + nz * (hz + 0.15), nx, nz, Math.min(14, b.w * 0.5));
    // a small aircraft mock-up outside
    const ax = b.x + nx * (hz + 9) - (nz ? 12 : 0), az = b.z + nz * (hz + 9);
    aircraft(g('white'), g('paint'), ax, y0, az);
    col.addCircle(ax, az, 3.2, y0 + 3);
    col.addBox(b.x, b.z, hx, hz, 0, y0 + H + r * 0.45);
    col.fillRect(b.x - hx, b.z - hz, b.x + hx, b.z + hz, SURF.BUILDING);
    return;
  }
  if (st === 'pool') {
    g('plaza').plane(b.x, y0 + 0.07, b.z, b.w, b.d, 0, 2);
    col.fillRect(b.x - hx, b.z - hz, b.x + hx, b.z + hz, SURF.PLAZA);
    const pw = 50, pd = 21;
    // basin walls
    g('poolTile').plane(b.x, y0 - 1.6, b.z, pw, pd, 0, 4);
    g('poolTile').box(b.x, y0 - 0.78, b.z, pw, 1.62, pd, 0, { u: 4, v: 4, skip: { t: true, bt: true } });
    ctx.pools.push({ x: b.x, z: b.z, w: pw, d: pd, y: y0 - 0.25 });
    col.fillRect(b.x - pw / 2, b.z - pd / 2, b.x + pw / 2, b.z + pd / 2, SURF.POOL);
    // lane ropes
    for (let i = 1; i < 8; i++) g('paint').box(b.x, y0 - 0.2, b.z - pd / 2 + i * pd / 8, pw, 0.08, 0.08, 0, { color: i % 2 ? hex('#e74c3c') : hex('#f1c40f') });
    // starting blocks
    for (let i = 0; i < 8; i++) g('white').box(b.x - pw / 2 - 0.6, y0 + 0.35, b.z - pd / 2 + (i + 0.5) * pd / 8, 0.7, 0.6, 0.6);
    // stands + changing room
    g('trim').box(b.x, y0 + 0.5, b.z - hz + 2, b.w - 6, 1.0, 2, 0, { u: 2, v: 1 });
    g('trim').box(b.x, y0 + 1.0, b.z - hz + 0.9, b.w - 6, 2.0, 1.4, 0, { u: 2, v: 1 });
    col.addBox(b.x, b.z - hz + 1.6, (b.w - 6) / 2, 1.6, 0, y0 + 2);
    g('fac_ku').box(b.x + hx - 5, y0 + 1.9, b.z + hz - 3, 9, 3.8, 5, 0, { u: 7.2, v: 7.6, skip: { bt: true } });
    col.addBox(b.x + hx - 5, b.z + hz - 3, 4.5, 2.5, 0, y0 + 4);
    // fence
    fenceRect(g, col, b.x, b.z, b.w, b.d, y0, 1.6, dn, 6);
    signPost(7, 3.2);
    return;
  }
  if (st === 'court') {
    const H = b.fh || 8;
    g('futsal').plane(b.x, y0 + 0.08, b.z, b.w - 4, b.d - 4, 0, 1, [1, 1, 1], 'unit');
    g('plaza').plane(b.x, y0 + 0.06, b.z, b.w, b.d, 0, 3);
    col.fillRect(b.x - hx, b.z - hz, b.x + hx, b.z + hz, SURF.SPORT);
    for (const a of [-1, 0, 1]) for (const c2 of [-1, 1]) { const px = b.x + a * (hx - 0.3), pz = b.z + c2 * (hz - 0.3); g('metal').box(px, y0 + H / 2, pz, 0.4, H, 0.4); col.addCircle(px, pz, 0.3, y0 + H); }
    const r = b.d / 2 + 0.5; const geo = new THREE.CylinderGeometry(r, r, b.w + 1, 18, 1, true, 0, Math.PI);
    const m = M4().makeRotationZ(Math.PI / 2); m.premultiply(M4().makeScale(1, 0.3, 1)); m.premultiply(M4().makeTranslation(b.x, y0 + H, b.z));
    g('roofGreen').geometry(geo, m, [1, 1, 1], 6);
    // goals
    for (const s of [-1, 1]) { const gx = b.x + s * (hx - 3); g('white').box(gx, y0 + 1, b.z - 1.5, 0.1, 2, 0.1); g('white').box(gx, y0 + 1, b.z + 1.5, 0.1, 2, 0.1); g('white').box(gx, y0 + 2, b.z, 0.1, 0.1, 3.1); }
    signPost(7, 3.2);
    return;
  }
  if (st === 'stand') {
    // stepped seating facing east (towards the track)
    const steps = 7; const H = b.fh || 7;
    for (let i = 0; i < steps; i++) {
      const t = i / steps; const w = b.w * (1 - t);
      g('trim').box(b.x - b.w / 2 + w / 2 + b.w * t, y0 + (i + 1) * 0.6 / 2, b.z, w, (i + 1) * 0.6, b.d, 0, { u: 2, v: 1 });
      g('paint').box(b.x - b.w / 2 + b.w * t + 0.4, y0 + (i + 1) * 0.6 + 0.12, b.z, 0.5, 0.25, b.d - 1, 0, { color: hex(i % 2 ? '#0d6b52' : '#e3c25c') });
    }
    for (let k = -2; k <= 2; k++) { g('metal').box(b.x - hx + 0.5, y0 + H / 2, b.z + k * b.d / 4.4, 0.4, H, 0.4); }
    g('roofGreen').box(b.x + 1, y0 + H, b.z, b.w + 4, 0.3, b.d + 2, -0.0, { u: 4, v: 4 });
    col.addBox(b.x, b.z, hx, hz, 0, y0 + 4.5);
    col.fillRect(b.x - hx, b.z - hz, b.x + hx, b.z + hz, SURF.BUILDING);
    signQuad(g('sign'), uv, b.x + hx + 2.2, y0 + H - 0.6, b.z, 1, 0, 12);
    return;
  }
  if (st === 'greenhouse') {
    const H = b.fh || 5;
    g('glass').box(b.x, y0 + H / 2, b.z, b.w, H, b.d, 0, { skip: { bt: true } });
    for (let x = -hx; x <= hx + 0.01; x += 4) { g('white').box(b.x + x, y0 + H / 2, b.z - hz, 0.12, H, 0.12); g('white').box(b.x + x, y0 + H / 2, b.z + hz, 0.12, H, 0.12); g('white').box(b.x + x, y0 + H, b.z, 0.12, 0.12, b.d); }
    hipRoof(g('glass'), b.x, y0 + H, b.z, b.w, b.d, 1.6);
    for (let i = 0; i < 6; i++) g('paint').box(b.x, y0 + 0.4, b.z - hz + 2 + i * (b.d - 4) / 5, b.w - 4, 0.8, 1.2, 0, { color: hex('#3f8a3a') });
    col.addBox(b.x, b.z, hx, hz, 0, y0 + H + 1.5);
    col.fillRect(b.x - hx, b.z - hz, b.x + hx, b.z + hz, SURF.BUILDING);
    signPost(7, 3);
    return;
  }
}

export function hipRoof(gb, cx, y, cz, w, d, h) {
  const hx = w / 2, hz = d / 2; const r = Math.min(hx, hz) * 0.9;
  const ridge = Math.max(0, hx - r);
  const A = [cx - hx, y, cz + hz], Bp = [cx + hx, y, cz + hz], C = [cx + hx, y, cz - hz], D = [cx - hx, y, cz - hz];
  const E = [cx - ridge, y + h, cz], F = [cx + ridge, y + h, cz];
  const u = (p) => [p[0] / 4, p[2] / 4];
  gb.quad(A, Bp, F, E, [u(A), u(Bp), [F[0] / 4, F[1] / 4], [E[0] / 4, E[1] / 4]]);
  gb.quad(C, D, E, F, [u(C), u(D), [E[0] / 4, E[1] / 4], [F[0] / 4, F[1] / 4]]);
  gb.quad(Bp, C, F, F, [[0, 0], [d / 4, 0], [d / 8, h / 4], [d / 8, h / 4]]);
  gb.quad(D, A, E, E, [[0, 0], [d / 4, 0], [d / 8, h / 4], [d / 8, h / 4]]);
}

function thaiRoof(gb, gold, cx, y, cz, w, d, wide) {
  // two-tier steep gable roof with overhang, long axis along x if w>=d
  const alongX = w >= d;
  const L = alongX ? w : d, W = alongX ? d : w;
  const tiers = [{ y, L: L, W: W, h: W * 0.55 }, { y: y + W * 0.38, L: L * 0.62, W: W * 0.62, h: W * 0.4 }];
  for (const t of tiers) {
    const hl = t.L / 2, hw = t.W / 2;
    const P = (a, yy, b) => alongX ? [cx + a, yy, cz + b] : [cx + b, yy, cz + a];
    const r0 = P(-hl, t.y, hw), r1 = P(hl, t.y, hw), r2 = P(hl, t.y + t.h, 0), r3 = P(-hl, t.y + t.h, 0);
    const l0 = P(hl, t.y, -hw), l1 = P(-hl, t.y, -hw), l2 = P(-hl, t.y + t.h, 0), l3 = P(hl, t.y + t.h, 0);
    const uvq = [[0, 0], [t.L / 3, 0], [t.L / 3, t.W / 3], [0, t.W / 3]];
    if (alongX) { gb.quad(r0, r1, r2, r3, uvq); gb.quad(l0, l1, l2, l3, uvq); }
    else { gb.quad(r1, r0, r3, r2, uvq); gb.quad(l1, l0, l3, l2, uvq); }
    // gable triangles (gold trim)
    for (const s of [-1, 1]) {
      const a = P(s * hl, t.y, -hw), b2 = P(s * hl, t.y, hw), c = P(s * hl, t.y + t.h, 0);
      if ((s > 0) === alongX) gold.quad(a, c, c, b2, [[0, 0], [0.5, 1], [0.5, 1], [1, 0]]); else gold.quad(b2, c, c, a, [[0, 0], [0.5, 1], [0.5, 1], [1, 0]]);
      if ((s > 0) !== alongX) gold.quad(a, c, c, b2, [[0, 0], [0.5, 1], [0.5, 1], [1, 0]]); else gold.quad(b2, c, c, a, [[0, 0], [0.5, 1], [0.5, 1], [1, 0]]);
      // chofa finial
      const tip = P(s * (hl + 0.1), t.y + t.h + 0.6, 0);
      gold.geometry(new THREE.ConeGeometry(0.12, 1.2, 6), M4().makeTranslation(tip[0], tip[1], tip[2]));
    }
    gold.box(alongX ? cx : cx, t.y + t.h + 0.06, cz, alongX ? t.L : 0.2, 0.15, alongX ? 0.2 : t.L);
  }
}

function aircraft(wb, pb, x, y, z) {
  wb.geometry(new THREE.CylinderGeometry(0.7, 0.5, 9, 12).rotateZ(Math.PI / 2), M4().makeTranslation(x, y + 2.2, z));
  wb.geometry(new THREE.ConeGeometry(0.7, 1.6, 12).rotateZ(-Math.PI / 2), M4().makeTranslation(x + 5.3, y + 2.2, z));
  wb.box(x, y + 2.1, z, 2.2, 0.15, 11);
  wb.box(x - 4, y + 2.4, z, 1.2, 0.12, 3.6);
  wb.box(x - 4.2, y + 3.2, z, 1.2, 1.6, 0.12);
  pb.box(x + 2.6, y + 2.5, z, 1.2, 0.5, 1.1, 0, { color: hex('#2c3e50') });
  pb.box(x, y + 1.0, z - 1.3, 0.12, 2.0, 0.12, 0, { color: [0.3, 0.3, 0.3] }); pb.box(x, y + 1.0, z + 1.3, 0.12, 2.0, 0.12, 0, { color: [0.3, 0.3, 0.3] }); pb.box(x + 3.5, y + 1.0, z, 0.12, 2.0, 0.12, 0, { color: [0.3, 0.3, 0.3] });
}

export function fenceRect(g, col, cx, cz, w, d, y0, h, dn, gap) {
  const hx = w / 2, hz = d / 2;
  const sides = [['n', cx - hx, cz - hz, cx + hx, cz - hz], ['s', cx - hx, cz + hz, cx + hx, cz + hz], ['w', cx - hx, cz - hz, cx - hx, cz + hz], ['e', cx + hx, cz - hz, cx + hx, cz + hz]];
  const doorSide = Object.keys(DOOR_N).find(k => DOOR_N[k][0] === dn[0] && DOOR_N[k][1] === dn[1]);
  for (const [s, x0, z0, x1, z1] of sides) {
    const segs = [];
    if (s === doorSide) {
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2; const L = Math.hypot(x1 - x0, z1 - z0); const t = (L / 2 - gap / 2) / L;
      segs.push([x0, z0, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t]); segs.push([x1 - (x1 - x0) * t, z1 - (z1 - z0) * t, x1, z1]); void mx; void mz;
    } else segs.push([x0, z0, x1, z1]);
    for (const [a, b2, c, e] of segs) {
      const L = Math.hypot(c - a, e - b2); if (L < 0.5) continue;
      const along = Math.abs(c - a) > Math.abs(e - b2);
      g('metal').box((a + c) / 2, y0 + h - 0.05, (b2 + e) / 2, along ? L : 0.06, 0.08, along ? 0.06 : L);
      g('metal').box((a + c) / 2, y0 + 0.2, (b2 + e) / 2, along ? L : 0.06, 0.08, along ? 0.06 : L);
      g('fence').box((a + c) / 2, y0 + h / 2, (b2 + e) / 2, along ? L : 0.03, h, along ? 0.03 : L, 0, { u: 1, v: 1 });
      const n = Math.max(1, Math.round(L / 3));
      for (let i = 0; i <= n; i++) { const px = a + (c - a) * i / n, pz = b2 + (e - b2) * i / n; g('metal').box(px, y0 + h / 2, pz, 0.08, h, 0.08); }
      col.addWall(a, b2, c, e, 0.2, y0 + h);
    }
  }
}
