// Procedural skinned human (1 draw call) with outfits and procedural animation.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CLOTHES } from '../shared/catalog.js';

const BONES = [
  ['root', -1, 0, 0, 0], ['hips', 0, 0, 0.93, 0], ['spine', 1, 0, 0.11, 0], ['chest', 2, 0, 0.19, 0], ['neck', 3, 0, 0.21, 0], ['head', 4, 0, 0.08, 0],
  ['shoulderL', 3, 0.18, 0.16, 0], ['upperArmL', 6, 0.0, 0, 0], ['forearmL', 7, 0, -0.27, 0], ['handL', 8, 0, -0.25, 0],
  ['shoulderR', 3, -0.18, 0.16, 0], ['upperArmR', 10, 0.0, 0, 0], ['forearmR', 11, 0, -0.27, 0], ['handR', 12, 0, -0.25, 0],
  ['thighL', 1, 0.092, -0.04, 0], ['shinL', 14, 0, -0.42, 0], ['footL', 15, 0, -0.42, 0],
  ['thighR', 1, -0.092, -0.04, 0], ['shinR', 17, 0, -0.42, 0], ['footR', 18, 0, -0.42, 0],
];
const BI = Object.fromEntries(BONES.map((b, i) => [b[0], i]));
const bindWorld = (() => { const out = []; BONES.forEach((b, i) => { const p = b[1] < 0 ? [0, 0, 0] : out[b[1]]; out[i] = [p[0] + b[2], p[1] + b[3], p[2] + b[4]]; }); return out; })();

const PIX = { K: ['1001', '1010', '1100', '1010', '1001'], U: ['1001', '1001', '1001', '1001', '0110'], E: ['111', '100', '110', '100', '111'], N: ['1001', '1101', '1011', '1001', '1001'], G: ['0111', '1000', '1011', '1001', '0111'] };

function lin(hex) { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; }
function shade(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }

class PartBuilder {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.si = []; this.sw = []; this.idx = []; this.n = 0; }
  add(geo, bone, color, mat) {
    const g = geo.index ? geo : geo; const p = g.attributes.position, nr = g.attributes.normal;
    const m = new THREE.Matrix4().makeTranslation(...bindWorld[bone]); if (mat) m.multiply(mat);
    const nm = new THREE.Matrix3().getNormalMatrix(m); const v = new THREE.Vector3(), nv = new THREE.Vector3();
    const base = this.n;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m); this.pos.push(v.x, v.y, v.z);
      nv.fromBufferAttribute(nr, i).applyMatrix3(nm).normalize(); this.nor.push(nv.x, nv.y, nv.z);
      this.col.push(color[0], color[1], color[2]); this.si.push(bone, 0, 0, 0); this.sw.push(1, 0, 0, 0);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) this.idx.push(base + g.index.getX(i)); else for (let i = 0; i < p.count; i++) this.idx.push(base + i);
    this.n += p.count;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(this.idx); g.computeBoundingSphere(); g.boundingSphere.radius = 1.4; g.boundingSphere.center.set(0, 0.9, 0);
    return g;
  }
}
const T = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const cap = (r, l, seg = 7) => new THREE.CapsuleGeometry(r, l, 3, seg);
const sph = (r, w = 12, h = 9) => new THREE.SphereGeometry(r, w, h);
const rb = (w, h, d, r = 0.03) => new RoundedBoxGeometry(w, h, d, 2, r);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

export const DEFAULT_LOOK = { gender: 'm', skin: '#e8b991', hair: 'short', hairColor: '#1a1410', top: 'tee_white', bottom: 'jeans', shoes: 'sneakers_white', hat: null, glasses: null, bag: 'backpack', height: 1, build: 1 };

export function buildBodyGeometry(look) {
  const L = { ...DEFAULT_LOOK, ...look };
  const f = L.gender === 'f';
  const skin = lin(L.skin), hairC = lin(L.hairColor);
  const top = CLOTHES[L.top] || CLOTHES.tee_white, bottom = CLOTHES[L.bottom] || CLOTHES.jeans, shoes = CLOTHES[L.shoes] || CLOTHES.sneakers_white;
  const topC = lin(top.color), botC = lin(bottom.color), shoeC = lin(shoes.color);
  const P = new PartBuilder();
  const dress = top.style === 'dress';
  const longSleeve = ['hoodie', 'jacket'].includes(top.style);
  const shortsLike = bottom.style === 'shorts', skirt = bottom.style === 'skirt' || dress;
  const sw = f ? 0.9 : 1.0, hw = f ? 1.06 : 1.0;
  // torso
  P.add(rb(0.31 * hw, 0.2, 0.2, 0.06), BI.hips, dress ? topC : botC, T(0, -0.01, 0));
  P.add(rb(0.28 * (f ? 0.86 : 1), 0.17, 0.18, 0.05), BI.spine, topC, T(0, 0.06, 0));
  P.add(rb(0.36 * sw, 0.27, 0.21, 0.07), BI.chest, topC, T(0, 0.09, 0));
  if (f) { P.add(sph(0.058, 10, 8), BI.chest, topC, T(0.055, 0.06, 0.07, 0, 0, 0, 1, 0.85, 0.7)); P.add(sph(0.058, 10, 8), BI.chest, topC, T(-0.055, 0.06, 0.07, 0, 0, 0, 1, 0.85, 0.7)); }
  // shoulders (rounded caps)
  P.add(sph(0.056, 10, 8), BI.shoulderL, topC, T(-0.01, -0.02, 0)); P.add(sph(0.056, 10, 8), BI.shoulderR, topC, T(0.01, -0.02, 0));
  // clothing details
  if (top.style === 'shirt' || top.style === 'blouse') {
    P.add(box(0.06, 0.035, 0.03), BI.chest, shade(topC, 0.92), T(0.045, 0.215, 0.09, 0, 0, -0.5)); P.add(box(0.06, 0.035, 0.03), BI.chest, shade(topC, 0.92), T(-0.045, 0.215, 0.09, 0, 0, 0.5));
    for (let i = 0; i < 4; i++) P.add(sph(0.007, 5, 4), BI.chest, [0.5, 0.5, 0.5], T(0, 0.17 - i * 0.07, 0.106));
    if (L.top === 'uniform_f') P.add(sph(0.012, 6, 5), BI.chest, lin('#d4a63a'), T(-0.08, 0.15, 0.105)); // KU pin
    if (L.top === 'hawaii') for (let i = 0; i < 14; i++) P.add(sph(0.016, 5, 4), BI.chest, lin(['#f1c40f', '#e74c3c', '#ffffff'][i % 3]), T((Math.sin(i * 7.1)) * 0.14, Math.cos(i * 3.3) * 0.1 + 0.08, 0.106));
  }
  if (top.style === 'hoodie') {
    P.add(new THREE.TorusGeometry(0.095, 0.035, 6, 12, Math.PI * 1.3), BI.chest, shade(topC, 0.9), T(0, 0.2, -0.03, -1.0, 0, Math.PI * 1.15));
    P.add(box(0.2, 0.08, 0.02), BI.spine, shade(topC, 0.85), T(0, 0.04, 0.095));
    P.add(cap(0.006, 0.08, 4), BI.chest, [0.9, 0.9, 0.9], T(0.035, 0.12, 0.108)); P.add(cap(0.006, 0.08, 4), BI.chest, [0.9, 0.9, 0.9], T(-0.035, 0.12, 0.108));
  }
  if (top.style === 'jacket') {
    P.add(box(0.1, 0.3, 0.01), BI.chest, lin(L.top === 'eng_shop' ? '#7a1414' : '#e8e8e8'), T(0, 0.07, 0.104)); // inner shirt strip
    P.add(box(0.012, 0.3, 0.012), BI.chest, shade(topC, 0.7), T(0.05, 0.07, 0.108)); P.add(box(0.012, 0.3, 0.012), BI.chest, shade(topC, 0.7), T(-0.05, 0.07, 0.108));
    P.add(box(0.07, 0.04, 0.03), BI.chest, shade(topC, 0.85), T(0.06, 0.215, 0.09, 0, 0, -0.6)); P.add(box(0.07, 0.04, 0.03), BI.chest, shade(topC, 0.85), T(-0.06, 0.215, 0.09, 0, 0, 0.6));
  }
  if (top.print === 'KU' || top.print === 'ENG') {
    const text = top.print === 'KU' ? 'KU' : 'ENG'; const back = top.print === 'ENG'; const bs = 0.016; let x0 = 0;
    const widths = [...text].map(ch => PIX[ch][0].length); const total = widths.reduce((a, b) => a + b + 1, -1) * bs; x0 = -total / 2;
    for (const ch of text) { const gl = PIX[ch]; for (let r = 0; r < 5; r++) for (let c = 0; c < gl[r].length; c++) if (gl[r][c] === '1') { const xx = x0 + c * bs + bs / 2; P.add(box(bs * 0.95, bs * 0.95, 0.01), BI.chest, [0.95, 0.95, 0.92], T(back ? -xx : xx, 0.14 - r * bs, back ? -0.107 : 0.107)); } x0 += (gl[0].length + 1) * bs; }
  }
  // belt for uniform pants
  if (L.bottom === 'slacks_black' || L.bottom === 'chinos' || L.bottom === 'jeans') { P.add(box(0.315 * hw, 0.035, 0.205), BI.hips, [0.04, 0.04, 0.04], T(0, 0.075, 0)); P.add(box(0.05, 0.035, 0.01), BI.hips, L.bottom === 'slacks_black' ? lin('#c9b26a') : [0.7, 0.7, 0.7], T(0, 0.075, 0.105)); }
  // neck + head
  P.add(new THREE.CylinderGeometry(0.048, 0.055, 0.11, 10), BI.neck, skin, T(0, 0.04, 0));
  P.add(sph(0.112, 16, 12), BI.head, skin, T(0, 0.1, 0.005, 0, 0, 0, 0.94, 1.08, 1.0));
  P.add(sph(0.03, 6, 5), BI.head, shade(skin, 0.95), T(0.105, 0.095, -0.005, 0, 0, 0, 0.5, 1, 0.8)); P.add(sph(0.03, 6, 5), BI.head, shade(skin, 0.95), T(-0.105, 0.095, -0.005, 0, 0, 0, 0.5, 1, 0.8));
  P.add(box(0.026, 0.042, 0.03), BI.head, shade(skin, 0.93), T(0, 0.072, 0.11, -0.2));
  for (const s of [-1, 1]) {
    P.add(sph(0.019, 8, 6), BI.head, [0.95, 0.95, 0.95], T(s * 0.04, 0.092, 0.099, 0, 0, 0, 1, 0.8, 0.6));
    P.add(sph(0.0105, 6, 5), BI.head, [0.03, 0.025, 0.02], T(s * 0.04, 0.091, 0.109));
    P.add(box(0.036, 0.008, 0.01), BI.head, shade(hairC, 0.9), T(s * 0.042, 0.118, 0.106, 0, 0, s * -0.12));
  }
  P.add(box(0.04, 0.008, 0.01), BI.head, f ? lin('#b5484f') : lin('#8a4a40'), T(0, 0.042, 0.105));
  // hair
  addHair(P, L.hair, hairC, f);
  // arms
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? 1 : -1;
    const ua = BI['upperArm' + side], fa = BI['forearm' + side], hd = BI['hand' + side];
    P.add(cap(0.046, 0.18), ua, skin, T(0, -0.13, 0));
    if (longSleeve || top.style === 'shirt' && L.top === 'polo_navy') P.add(cap(0.054, 0.19), ua, topC, T(0, -0.13, 0));
    else if (top.style !== 'dress' || true) P.add(cap(0.056, 0.07), ua, topC, T(0, -0.06, 0));
    P.add(sph(0.045, 8, 6), fa, longSleeve ? topC : skin, T(0, 0, 0));
    P.add(cap(0.04, 0.17), fa, longSleeve ? topC : skin, T(0, -0.12, 0));
    if (longSleeve) P.add(cap(0.036, 0.02), fa, shade(topC, 0.85), T(0, -0.225, 0));
    P.add(rb(0.07, 0.095, 0.035, 0.015), hd, skin, T(0, -0.05, 0));
    P.add(cap(0.012, 0.03, 4), hd, skin, T(s * -0.03, -0.035, 0.02, 0, 0, s * 0.6));
  }
  // legs
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? 1 : -1;
    const th = BI['thigh' + side], sh = BI['shin' + side], ft = BI['foot' + side];
    const thighC = skirt || shortsLike && false ? skin : botC;
    P.add(cap(0.068 * (f ? 1.04 : 1), 0.3), th, skirt ? skin : botC, T(0, -0.2, 0));
    if (shortsLike) { P.add(cap(0.074, 0.18), th, botC, T(0, -0.12, 0)); }
    P.add(sph(0.06, 9, 7), sh, skirt || shortsLike ? skin : botC, T(0, 0.0, 0));
    P.add(cap(0.052, 0.3), sh, skirt || shortsLike ? skin : botC, T(0, -0.21, 0));
    if (!skirt && !shortsLike) P.add(cap(0.056, 0.04), sh, shade(botC, 0.9), T(0, -0.37, 0));
    void thighC; void s;
    // shoes
    const st = shoes.style;
    if (st === 'sandal') { P.add(rb(0.09, 0.03, 0.24, 0.012), ft, shoeC, T(0, -0.035, 0.045)); P.add(rb(0.08, 0.05, 0.2, 0.02), ft, skin, T(0, 0, 0.04)); }
    else if (st === 'boot') { P.add(rb(0.105, 0.14, 0.25, 0.03), ft, shoeC, T(0, -0.0, 0.045)); }
    else {
      P.add(rb(0.1, 0.085, 0.25, 0.035), ft, shoeC, T(0, -0.012, 0.045));
      if (st === 'sneaker') { P.add(rb(0.104, 0.025, 0.255, 0.01), ft, [0.95, 0.95, 0.95], T(0, -0.045, 0.045)); }
    }
  }
  if (skirt) {
    const g = new THREE.CylinderGeometry(0.17 * hw, dress ? 0.3 : 0.25, dress ? 0.42 : 0.34, 14, 1, true);
    P.add(g, BI.hips, dress ? topC : botC, T(0, dress ? -0.17 : -0.13, 0));
    P.add(new THREE.CylinderGeometry(0.168 * hw, 0.168 * hw, 0.02, 14), BI.hips, dress ? topC : botC, T(0, 0.04, 0));
  }
  // hat
  if (L.hat && CLOTHES[L.hat]) addHat(P, CLOTHES[L.hat], f);
  if (L.glasses && CLOTHES[L.glasses]) {
    const gc = CLOTHES[L.glasses]; const sun = gc.style === 'sunglasses';
    for (const s of [-1, 1]) { P.add(sun ? rb(0.05, 0.032, 0.008, 0.008) : new THREE.TorusGeometry(0.02, 0.004, 4, 12), BI.head, sun ? [0.02, 0.02, 0.03] : lin(gc.color), T(s * 0.041, 0.116, 0.118)); P.add(box(0.004, 0.004, 0.11), BI.head, lin(gc.color), T(s * 0.068, 0.12, 0.064)); }
    P.add(box(0.02, 0.004, 0.004), BI.head, lin(gc.color), T(0, 0.12, 0.118));
  }
  if (L.bag && CLOTHES[L.bag]) {
    const bc = lin(CLOTHES[L.bag].color);
    if (CLOTHES[L.bag].style === 'backpack') {
      P.add(rb(0.28, 0.34, 0.13, 0.05), BI.chest, bc, T(0, 0.03, -0.16)); P.add(rb(0.22, 0.12, 0.05, 0.02), BI.chest, shade(bc, 0.85), T(0, -0.06, -0.235));
      for (const s of [-1, 1]) P.add(box(0.026, 0.26, 0.01), BI.chest, shade(bc, 0.8), T(s * 0.11, 0.1, 0.107));
    } else { P.add(rb(0.05, 0.3, 0.26, 0.02), BI.hips, bc, T(0.2, 0.0, 0.0)); P.add(box(0.025, 0.4, 0.012), BI.chest, bc, T(0.08, 0.05, 0.0, 0, 0, -0.5)); }
  }
  return P.build();
}

function addHair(P, style, c, f) {
  const H = BI.head; const dark = shade(c, 0.85);
  const capG = (r, sy = 1) => { const g = new THREE.SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55); return [g, sy]; };
  switch (style) {
    case 'buzz': { const [g] = capG(0.117); P.add(g, H, dark, T(0, 0.105, -0.002, -0.32, 0, 0, 0.95, 1.05, 1.02)); break; }
    case 'spiky': { const [g] = capG(0.12); P.add(g, H, c, T(0, 0.11, -0.005, -0.34, 0, 0, 0.96, 1.06, 1.03)); for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; P.add(new THREE.ConeGeometry(0.03, 0.09, 5), H, c, T(Math.cos(a) * 0.06, 0.2 + Math.sin(i) * 0.01, Math.sin(a) * 0.06 - 0.01, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5)); } break; }
    case 'side': { const [g] = capG(0.122); P.add(g, H, c, T(0, 0.108, -0.006, -0.34, 0, 0.05, 0.97, 1.08, 1.05)); P.add(rb(0.17, 0.05, 0.08, 0.02), H, c, T(0.02, 0.2, 0.06, 0.3, 0, -0.15)); break; }
    case 'bob': { const [g] = capG(0.125); P.add(g, H, c, T(0, 0.1, -0.008, -0.36, 0, 0, 0.98, 1.1, 1.06)); P.add(new THREE.CylinderGeometry(0.128, 0.135, 0.13, 16, 1, true, Math.PI * 0.25, Math.PI * 1.5), H, c, T(0, 0.07, -0.01)); P.add(rb(0.2, 0.04, 0.05, 0.015), H, c, T(0, 0.18, 0.085, 0.4)); break; }
    case 'long': { const [g] = capG(0.125); P.add(g, H, c, T(0, 0.1, -0.008, -0.36, 0, 0, 0.98, 1.1, 1.06)); P.add(rb(0.22, 0.32, 0.07, 0.03), H, c, T(0, -0.03, -0.075)); for (const s of [-1, 1]) P.add(rb(0.045, 0.22, 0.06, 0.02), H, c, T(s * 0.105, 0.03, 0.0)); P.add(rb(0.2, 0.04, 0.05, 0.015), H, c, T(0, 0.18, 0.085, 0.4)); break; }
    case 'ponytail': { const [g] = capG(0.123); P.add(g, H, c, T(0, 0.1, -0.006, -0.34, 0, 0, 0.97, 1.08, 1.05)); P.add(sph(0.03, 8, 6), H, dark, T(0, 0.15, -0.115)); P.add(cap(0.035, 0.18, 6), H, c, T(0, 0.04, -0.15, 0.25)); break; }
    case 'bun': { const [g] = capG(0.123); P.add(g, H, c, T(0, 0.1, -0.006, -0.34, 0, 0, 0.97, 1.08, 1.05)); P.add(sph(0.06, 10, 8), H, c, T(0, 0.23, -0.05)); break; }
    case 'curly': { for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const y = 0.16 + (i % 3) * 0.025; P.add(sph(0.045, 7, 5), H, c, T(Math.cos(a) * 0.085, y, Math.sin(a) * 0.085 - 0.01)); } P.add(sph(0.08, 10, 8), H, c, T(0, 0.19, -0.01)); break; }
    default: { const [g] = capG(0.121); P.add(g, H, c, T(0, 0.106, -0.006, -0.34, 0, 0, 0.96, 1.07, 1.04)); P.add(rb(0.17, 0.035, 0.06, 0.015), H, c, T(0, 0.19, 0.08, 0.35)); }
  }
  void f;
}
function addHat(P, h, f) {
  const H = BI.head; const c = lin(h.color);
  if (h.style === 'cap') { P.add(new THREE.SphereGeometry(0.127, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), H, c, T(0, 0.12, 0, -0.08)); P.add(rb(0.15, 0.012, 0.1, 0.005), H, shade(c, 0.85), T(0, 0.135, 0.13, -0.15)); }
  else if (h.style === 'bucket') { P.add(new THREE.CylinderGeometry(0.1, 0.128, 0.1, 14), H, c, T(0, 0.2, 0)); P.add(new THREE.CylinderGeometry(0.19, 0.19, 0.012, 16), H, c, T(0, 0.15, 0, -0.06)); }
  else if (h.style === 'beanie') { P.add(new THREE.SphereGeometry(0.128, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.55), H, c, T(0, 0.12, -0.005, -0.32, 0, 0, 1, 1.12, 1.05)); P.add(sph(0.03, 6, 5), H, shade(c, 1.2), T(0, 0.26, -0.02)); }
  else if (h.style === 'helmet') { P.add(new THREE.SphereGeometry(0.16, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), H, c, T(0, 0.08, -0.01)); P.add(new THREE.SphereGeometry(0.162, 14, 6, -0.9, 1.8, Math.PI * 0.3, Math.PI * 0.22), H, [0.05, 0.06, 0.08], T(0, 0.08, 0)); }
  void f;
}

let sharedMat = null;
export function characterMaterial() { if (!sharedMat) sharedMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.0 }); return sharedMat; }

const tmpE = new THREE.Euler();
export class Character {
  constructor(look = {}) {
    this.root = new THREE.Group();
    this.bones = BONES.map(b => { const o = new THREE.Bone(); o.name = b[0]; return o; });
    BONES.forEach((b, i) => { this.bones[i].position.set(b[2], b[3], b[4]); if (b[1] >= 0) this.bones[b[1]].add(this.bones[i]); });
    this.bones[0].updateMatrixWorld(true);
    this.skeleton = new THREE.Skeleton(this.bones);
    this.look = { ...DEFAULT_LOOK, ...look };
    this.mesh = null; this.setLook(this.look);
    this.phase = Math.random() * 10; this.t = Math.random() * 10;
    this.cur = {}; // smoothed euler per bone
    this.phone = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.14, 0.012), new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.3, metalness: 0.6, emissive: 0x2a6bd8, emissiveIntensity: 0.6 }));
    this.phone.position.set(0, -0.11, 0.03); this.phone.rotation.x = -0.2; this.phone.visible = false; this.bones[BI.handR].add(this.phone);
  }
  setLook(look) {
    this.look = { ...DEFAULT_LOOK, ...look };
    const geo = buildBodyGeometry(this.look);
    if (this.mesh) { this.mesh.geometry.dispose(); this.mesh.geometry = geo; this.mesh.boundingSphere = null; }
    else {
      this.mesh = new THREE.SkinnedMesh(geo, characterMaterial());
      this.mesh.add(this.bones[0]); this.mesh.bind(this.skeleton, new THREE.Matrix4());
      this.mesh.castShadow = true; this.mesh.receiveShadow = true; this.mesh.frustumCulled = true;
      this.root.add(this.mesh);
    }
    const s = (this.look.height || 1) * (this.look.gender === 'f' ? 0.955 : 1); this.mesh.scale.set(s * (this.look.build || 1), s, s * (this.look.build || 1));
  }
  // st: { mode, speed (m/s), grounded, vy, emote, steer, pedal }
  animate(dt, st) {
    if (this.seed === undefined) this.seed = Math.random() * 10;
    this.t += dt; const t = this.t;
    const tg = {}; const set = (b, x = 0, y = 0, z = 0) => { tg[b] = [x, y, z]; };
    let hipsY = 0, hipsX = 0, rootLean = 0;
    const mode = st.mode || 'walk';
    const sp = st.speed || 0;
    this.phone.visible = st.emote === 'phone';
    if (mode === 'walk' || mode === 'swim' && false) {
      if (!st.grounded) { // jump / fall
        this._sk = undefined;
        const up = (st.vy || 0) > 0;
        set('thighL', up ? -0.7 : -0.3); set('thighR', up ? -0.1 : 0.2); set('shinL', up ? 1.1 : 0.5); set('shinR', up ? 0.5 : 0.3);
        set('upperArmL', -0.4, 0, 0.5); set('upperArmR', 0.2, 0, -0.5); set('forearmL', -0.6); set('forearmR', -0.5); set('spine', 0.1);
      } else if (sp > 0.25) {
        // stride-locked gait: phase advances with distance travelled (one step = π), so feet don't skate.
        // step length grows with speed (walk ~0.7 m → sprint ~1.6 m), cadence follows from v = 2·step·f.
        const run = Math.min(1, Math.max(0, (sp - 2.0) / 3.2));
        const step = 0.62 + Math.min(1, sp / 7) * 0.95;
        this.phase += sp * dt * Math.PI / step;
        const p = this.phase, s = Math.sin(p), c = Math.cos(p);
        // heel strike = lowest pelvis point (|cos p| = 0) → animation event for footstep audio, alternating feet
        { const k = Math.floor((p - Math.PI / 2) / Math.PI); if (this._sk !== undefined && k !== this._sk && this.sfx) this.sfx('step', k & 1, run, sp); this._sk = k; }
        const A = 0.36 + run * 0.42; // thigh swing amplitude (rad)
        set('thighL', -s * A - run * 0.18, 0, 0.02); set('thighR', s * A - run * 0.18, 0, -0.02);
        // knee: flexes during swing (foot passing), almost straight at heel strike; more flexion when running
        set('shinL', Math.max(0, -Math.cos(p + 0.5)) * (0.55 + run * 1.1) + 0.06 + run * 0.15); set('shinR', Math.max(0, Math.cos(p + 0.5)) * (0.55 + run * 1.1) + 0.06 + run * 0.15);
        set('footL', s * 0.22 * (1 - run * 0.4) - Math.max(0, Math.sin(p - 0.6)) * 0.15); set('footR', -s * 0.22 * (1 - run * 0.4) - Math.max(0, -Math.sin(p - 0.6)) * 0.15);
        // arms counter-swing the legs; elbows bend more as speed rises
        set('upperArmL', s * (0.32 + run * 0.5), 0, 0.09 + run * 0.05); set('upperArmR', -s * (0.32 + run * 0.5), 0, -0.09 - run * 0.05);
        set('forearmL', -0.22 - run * 1.05 - Math.max(0, s) * 0.18); set('forearmR', -0.22 - run * 1.05 - Math.max(0, -s) * 0.18);
        // torso: pelvis yaws with the stride, chest counter-rotates, head stays level (vestibular stabilisation)
        const lean = Math.max(-0.12, Math.min(0.25, (st.accel || 0) * 0.025)) + run * 0.16;
        set('hips', 0, s * (0.1 + run * 0.06), s * 0.04 * (1 - run));
        set('spine', 0.03 + lean, s * 0.05, (st.turn || 0) * -0.06 * Math.min(1, sp / 4));
        set('chest', 0, -s * (0.12 + run * 0.08), 0); set('neck', -0.02 - run * 0.08); set('head', -lean * 0.4, s * 0.06, 0);
        // vertical bob: lowest at heel strike (twice per cycle), larger flight phase when running
        hipsY = (Math.abs(c) - 0.5) * (0.03 + run * 0.06) - run * 0.05;
        hipsX = s * 0.025 * (1 - run * 0.6);
        rootLean = 0; this.bank = (this.bank || 0) + ((-(st.turn || 0) * Math.min(1, sp / 6) * 0.12) - (this.bank || 0)) * Math.min(1, dt * 5);
      } else {
        this._sk = undefined;
        const b = Math.sin(t * 1.8);
        set('upperArmL', 0.02, 0, 0.09 + b * 0.01); set('upperArmR', 0.02, 0, -0.09 - b * 0.01); set('forearmL', -0.12); set('forearmR', -0.12);
        set('chest', 0.01 + b * 0.012); set('head', Math.sin(t * 0.37) * 0.04, Math.sin(t * 0.23) * 0.25, 0); set('thighL', 0, 0, 0.02); set('thighR', 0, 0, -0.02);
        if (st.emote === 'wave') { set('upperArmR', -0.2, 0, -2.6); set('forearmR', 0, 0, -0.4 + Math.sin(t * 9) * 0.45); set('head', 0, -0.2); }
        else if (st.emote === 'dance') { const d = t * 6; set('hips', 0, Math.sin(d) * 0.3, Math.sin(d) * 0.08); set('upperArmL', -1.2 + Math.sin(d) * 0.6, 0, 0.8); set('upperArmR', -1.2 - Math.sin(d) * 0.6, 0, -0.8); set('forearmL', -1); set('forearmR', -1); set('thighL', -Math.max(0, Math.sin(d)) * 0.5); set('thighR', -Math.max(0, -Math.sin(d)) * 0.5); set('shinL', Math.max(0, Math.sin(d)) * 0.8); set('shinR', Math.max(0, -Math.sin(d)) * 0.8); hipsY = Math.abs(Math.sin(d)) * 0.05; set('head', Math.sin(d * 2) * 0.15); }
        else if (st.emote === 'phone') { set('upperArmR', -0.55, 0.3, -0.25); set('forearmR', -1.75, 0, 0); set('handR', 0.3); set('head', 0.35, 0); set('upperArmL', -0.2, 0, 0.15); set('forearmL', -1.2); }
        else if (st.emote === 'clap') { const k = Math.sin(t * 12) * 0.15; { const cb = Math.floor((t * 12 - Math.PI * 1.5) / (Math.PI * 2)); if (this._cb !== undefined && cb !== this._cb && this.sfx) this.sfx('clap'); this._cb = cb; } set('upperArmL', -0.9, 0, 0.35 + k); set('upperArmR', -0.9, 0, -0.35 - k); set('forearmL', -0.9, 0, -0.5); set('forearmR', -0.9, 0, 0.5); }
        else if (st.emote === 'think') { set('upperArmR', -0.6, 0, -0.2); set('forearmR', -2.2); set('head', 0.1, 0.2); set('upperArmL', -0.4, 0, 0.3); set('forearmL', -1.4, 0.6); }
        else if (st.emote === 'sit') { set('thighL', -1.55, 0, 0.08); set('thighR', -1.55, 0, -0.08); set('shinL', 1.5); set('shinR', 1.5); set('upperArmL', -0.3, 0, 0.12); set('upperArmR', -0.3, 0, -0.12); set('forearmL', -0.6); set('forearmR', -0.6); hipsY = -0.47; }
        else if (st.emote === 'pushup') { const k = (Math.sin(t * 3) + 1) * 0.5; rootLean = 1.35; set('upperArmL', -1.45 + k * 0.4, 0, 0.3); set('upperArmR', -1.45 + k * 0.4, 0, -0.3); set('forearmL', -k * 0.8); set('forearmR', -k * 0.8); hipsY = -0.62 - k * 0.12; }
        else if (st.emote === 'eat') { const k = Math.max(0, Math.sin(t * 1.4 + (this.seed || 0) * 3)); set('thighL', -1.55, 0, 0.08); set('thighR', -1.55, 0, -0.08); set('shinL', 1.5); set('shinR', 1.5); hipsY = -0.47;
          set('upperArmR', -0.75 - k * 0.55, 0, -0.18); set('forearmR', -1.0 - k * 1.05); set('upperArmL', -0.75, 0, 0.2); set('forearmL', -0.7); set('spine', 0.18 - k * 0.08); set('head', 0.22 - k * 0.15, Math.sin(t * 0.3 + (this.seed || 0)) * 0.2); }
        else if (st.emote === 'talk' || st.emote === 'sitTalk') { const sd = this.seed || 0, a = Math.sin(t * 2.1 + sd), b = Math.sin(t * 1.3 + sd * 2), g = Math.max(0, Math.sin(t * 0.7 + sd * 5));
          if (st.emote === 'sitTalk') { set('thighL', -1.55, 0, 0.08); set('thighR', -1.55, 0, -0.08); set('shinL', 1.5); set('shinR', 1.5); hipsY = -0.47; }
          set('upperArmR', -0.35 - g * 0.5 + a * 0.12, 0.1, -0.15 - g * 0.15); set('forearmR', -0.9 - g * 0.5 + b * 0.2, 0, 0); set('upperArmL', -0.15 + b * 0.1 * g, 0, 0.12); set('forearmL', -0.45 - g * 0.3);
          set('head', Math.sin(t * 3.1 + sd) * 0.06, Math.sin(t * 0.5 + sd) * 0.3, Math.sin(t * 0.9) * 0.04); set('chest', 0, a * 0.05, 0); }
        else if (st.emote === 'listen') { const sd = this.seed || 0; set('upperArmL', -0.25, 0.3, 0.42); set('upperArmR', -0.25, -0.3, -0.42); set('forearmL', -1.75, -0.2, 0.3); set('forearmR', -1.75, 0.2, -0.3); set('head', Math.max(0, Math.sin(t * 2.3 + sd)) * 0.12, Math.sin(t * 0.4 + sd) * 0.25); set('thighL', 0, 0, 0.06); set('hips', 0, 0, 0.04); }
        else if (st.emote === 'laugh') { const k = Math.sin(t * 16); set('head', -0.35 + k * 0.05, 0, 0); set('chest', -0.05 + k * 0.03); set('upperArmL', -0.2, 0, 0.25); set('upperArmR', -0.4, 0, -0.35); set('forearmR', -1.4); set('forearmL', -0.5); }
        else if (st.emote === 'kick') { const k = Math.max(0, Math.sin(Math.min(1, (st.kickT || 0)) * Math.PI)); set('thighR', -0.2 - k * 1.1); set('shinR', 0.9 - k * 0.8); set('thighL', 0.15); set('upperArmL', -0.6 * k, 0, 0.4); set('upperArmR', 0.3 * k, 0, -0.4); set('spine', -0.1 * k); }
        else if (st.emote === 'juggle') { const p = t * 5.2 + (this.seed || 0), s = Math.sin(p); const L = s > 0; set(L ? 'thighL' : 'thighR', -0.95 * Math.abs(s), 0, L ? -0.45 : 0.45); set(L ? 'shinL' : 'shinR', 0.6 * Math.abs(s), 0, 0); set('upperArmL', -0.3, 0, 0.55); set('upperArmR', -0.3, 0, -0.55); set('head', 0.4, 0, 0); hipsY = -0.03 * Math.abs(s); }
        else if (st.emote === 'guard') { const k = Math.sin(t * 2.4); set('upperArmR', -1.4, 0, -1.2 + k * 0.5); set('forearmR', -0.3); set('upperArmL', 0.05, 0, 0.1); set('head', 0, k * 0.4, 0); }
        else if (st.emote === 'sitride') { set('thighL', -1.25, 0, 0.18); set('thighR', -1.25, 0, -0.18); set('shinL', 1.25); set('shinR', 1.25); set('spine', 0.15); set('upperArmL', -0.3, 0, 0.15); set('upperArmR', -0.6, 0, -0.2); set('forearmR', -1.4); set('forearmL', -0.4); set('head', 0.1, Math.sin(t * 0.4 + (this.seed || 0)) * 0.5); hipsY = -0.02; }
        else if (st.emote === 'work') { const k = Math.sin(t * 7); set('upperArmL', -0.9 + k * 0.2, 0, 0.2); set('upperArmR', -0.9 - k * 0.2, 0, -0.2); set('forearmL', -0.8); set('forearmR', -0.8); set('head', 0.3); set('spine', 0.15); }
      }
    } else if (mode === 'ride' || mode === 'bike') {
      const pedal = mode === 'bike'; if (pedal) this.phase += dt * sp * 1.4;
      const p = this.phase;
      set('hips', 0, 0, 0); set('spine', 0.22 + (st.sport ? 0.25 : 0)); set('neck', -0.15 - (st.sport ? 0.2 : 0));
      set('thighL', pedal ? -1.15 + Math.sin(p) * 0.35 : -1.25, 0, 0.18); set('thighR', pedal ? -1.15 - Math.sin(p) * 0.35 : -1.25, 0, -0.18);
      set('shinL', pedal ? 1.1 + Math.cos(p) * 0.3 : 1.25); set('shinR', pedal ? 1.1 - Math.cos(p) * 0.3 : 1.25);
      const steer = st.steer || 0;
      set('upperArmL', -1.0 - (st.sport ? 0.25 : 0) + steer * 0.15, 0, 0.25); set('upperArmR', -1.0 - (st.sport ? 0.25 : 0) - steer * 0.15, 0, -0.25);
      set('forearmL', -0.35); set('forearmR', -0.35); set('head', 0, -steer * 0.3);
      hipsY = -0.02;
    } else if (mode === 'drive' || mode === 'passenger') {
      set('thighL', -1.45, 0, 0.06); set('thighR', -1.45, 0, -0.06); set('shinL', 1.25); set('shinR', 1.25); set('spine', -0.12);
      const steer = st.steer || 0;
      if (mode === 'drive') { set('upperArmL', -1.05, 0, 0.32 + steer * 0.25); set('upperArmR', -1.05, 0, -0.32 + steer * 0.25); set('forearmL', -0.55, -steer * 0.3); set('forearmR', -0.55, -steer * 0.3); }
      else { set('upperArmL', -0.3, 0, 0.1); set('upperArmR', -0.3, 0, -0.1); set('forearmL', -0.9); set('forearmR', -0.9); }
      set('head', 0, -steer * 0.25);
      hipsY = -0.45;
    } else if (mode === 'swim') {
      this.phase += dt * (1.5 + sp);
      const p = this.phase;
      rootLean = 1.35;
      set('upperArmL', -Math.PI + (p % (Math.PI * 2)) * 1.0, 0, 0.2); set('upperArmR', -Math.PI + ((p + Math.PI) % (Math.PI * 2)) * 1.0, 0, -0.2);
      set('thighL', Math.sin(p * 2) * 0.3); set('thighR', -Math.sin(p * 2) * 0.3); set('shinL', 0.2); set('shinR', 0.2); set('head', -0.9);
      hipsY = -0.75;
    } else if (mode === 'sleep') {
      rootLean = -1.5; hipsY = -0.75; set('upperArmL', 0, 0, 0.2); set('upperArmR', 0, 0, -0.2);
    }
    // smooth towards targets
    const k = Math.min(1, dt * (mode === 'walk' ? 14 : 10));
    for (let i = 1; i < BONES.length; i++) {
      const name = BONES[i][0]; const target = tg[name] || [0, 0, 0];
      let c = this.cur[name]; if (!c) c = this.cur[name] = [0, 0, 0];
      c[0] += (target[0] - c[0]) * k; c[1] += (target[1] - c[1]) * k; c[2] += (target[2] - c[2]) * k;
      this.bones[i].rotation.set(c[0], c[1], c[2]);
    }
    const hb = this.bones[BI.hips];
    this.hy = (this.hy ?? 0) + (hipsY - (this.hy ?? 0)) * k; hb.position.y = 0.93 + this.hy;
    this.lean = (this.lean ?? 0) + (rootLean - (this.lean ?? 0)) * Math.min(1, dt * 6); this.bones[0].rotation.x = this.lean;
    hb.position.x = (this.hx = (this.hx ?? 0) + (hipsX - (this.hx ?? 0)) * k);
    if (mode !== 'walk' || sp <= 0.25) this.bank = (this.bank || 0) * Math.max(0, 1 - dt * 5);
    this.bones[0].rotation.z = this.bank || 0;
    void tmpE;
  }
}

// Name tag sprite
export function makeLabel(text, sub = '', color = '#ffffff', bg = 'rgba(10,20,16,0.55)') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
  const draw = (t, s, col) => {
    x.clearRect(0, 0, 512, 128);
    x.font = `700 40px 'Sarabun','Leelawadee UI','Tahoma',sans-serif`; const w = Math.min(500, Math.max(x.measureText(t).width, s ? x.measureText(s).width * 0.7 : 0) + 40);
    x.fillStyle = bg; const h = s ? 100 : 62; const y0 = 64 - h / 2; x.beginPath(); x.roundRect(256 - w / 2, y0, w, h, 24); x.fill();
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = col; x.fillText(t, 256, s ? 48 : 64);
    if (s) { x.font = `600 26px 'Sarabun','Tahoma',sans-serif`; x.fillStyle = '#9fe0bf'; x.fillText(s, 256, 86); }
  };
  draw(text, sub, color);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: true }));
  sp.scale.set(1.6, 0.4, 1); sp.renderOrder = 10;
  sp.userData.update = (t, s, col = color) => { draw(t, s, col); tex.needsUpdate = true; };
  return sp;
}
export function makeBubble() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160; const x = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(2.4, 0.75, 1); sp.renderOrder = 11; sp.visible = false;
  sp.userData.show = (text) => {
    x.clearRect(0, 0, 512, 160); x.font = `600 30px 'Sarabun','Leelawadee UI','Tahoma',sans-serif`;
    const words = text.split(' '); const lines = []; let line = '';
    for (const w of words) { const t2 = line ? line + ' ' + w : w; if (x.measureText(t2).width > 440 && line) { lines.push(line); line = w; } else line = t2; } lines.push(line);
    const L = lines.slice(0, 3); const h = 30 + L.length * 36;
    x.fillStyle = 'rgba(255,255,255,0.95)'; x.beginPath(); x.roundRect(20, 140 - h - 14, 472, h, 22); x.fill();
    x.beginPath(); x.moveTo(240, 126); x.lineTo(256, 152); x.lineTo(272, 126); x.fill();
    x.fillStyle = '#1b2a24'; x.textAlign = 'center'; x.textBaseline = 'middle';
    L.forEach((l, i) => x.fillText(l, 256, 140 - h - 14 + 32 + i * 36));
    tex.needsUpdate = true; sp.visible = true; sp.userData.until = performance.now() + 6000;
  };
  return sp;
}
