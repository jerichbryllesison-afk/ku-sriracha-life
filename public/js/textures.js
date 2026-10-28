// Procedural texture factory — every texture in the game is generated here (no image downloads).
import * as THREE from 'three';

let maxAniso = 8;
export function setMaxAnisotropy(a) { maxAniso = a; }

export function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// tileable value noise
function makeNoise(period, seed) {
  const r = rng(seed); const g = new Float32Array(period * period);
  for (let i = 0; i < g.length; i++) g[i] = r();
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y); const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const x0 = ((xi % period) + period) % period, y0 = ((yi % period) + period) % period;
    const x1 = (x0 + 1) % period, y1 = (y0 + 1) % period;
    const a = g[y0 * period + x0], b = g[y0 * period + x1], c = g[y1 * period + x0], d = g[y1 * period + x1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
// fbm field, values ~0..1, tileable over size
export function fbmField(size, basePeriod, octaves, seed) {
  const out = new Float32Array(size * size);
  const noises = []; for (let o = 0; o < octaves; o++) noises.push(makeNoise(basePeriod << o, seed + o * 101));
  let norm = 0; for (let o = 0; o < octaves; o++) norm += Math.pow(0.5, o);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0, amp = 1;
    for (let o = 0; o < octaves; o++) { const p = basePeriod << o; v += noises[o](x / size * p, y / size * p) * amp; amp *= 0.5; }
    out[y * size + x] = v / norm;
  }
  return out;
}

function heightToNormalCanvas(hf, size, strength) {
  const c = canvas(size, size); const ctx = c.getContext('2d'); const img = ctx.createImageData(size, size); const d = img.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const l = hf[y * size + ((x - 1 + size) % size)], r = hf[y * size + ((x + 1) % size)];
    const u = hf[((y - 1 + size) % size) * size + x], dn = hf[((y + 1) % size) * size + x];
    let nx = (l - r) * strength, ny = (u - dn) * strength, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const i = (y * size + x) * 4; d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); return c;
}
function heightFromCanvas(c) {
  const ctx = c.getContext('2d'); const d = ctx.getImageData(0, 0, c.width, c.height).data; const out = new Float32Array(c.width * c.height);
  for (let i = 0; i < out.length; i++) out[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255;
  return out;
}

export function toTex(c, { srgb = true, repeat = true, aniso = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = aniso ? maxAniso : 1;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

function fieldToCanvas(f, size, colorFn) {
  const c = canvas(size, size); const ctx = c.getContext('2d'); const img = ctx.createImageData(size, size); const d = img.data;
  for (let i = 0; i < size * size; i++) { const [r, g, b] = colorFn(f[i], i); d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0); return c;
}
const mix = (a, b, t) => a + (b - a) * t;

// ---------------- ground textures ----------------
export function grassTextures() {
  const S = 512; const f = fbmField(S, 8, 5, 11); const f2 = fbmField(S, 64, 2, 23); const r = rng(5);
  const c = fieldToCanvas(f, S, (v, i) => {
    const b = f2[i]; const n = r() * 0.12;
    const t = Math.min(1, Math.max(0, v * 1.4 - 0.2));
    return [mix(64, 118, t) * (0.85 + b * 0.3 + n), mix(90, 136, t) * (0.85 + b * 0.25 + n), mix(42, 64, t) * (0.9 + n)];
  });
  const ctx = c.getContext('2d');
  // blades
  for (let i = 0; i < 9000; i++) {
    const x = r() * S, y = r() * S, l = 2 + r() * 5; const g = 90 + r() * 80;
    ctx.strokeStyle = `rgba(${g * 0.68 | 0},${g | 0},${g * 0.44 | 0},${0.35 + r() * 0.4})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 2, y - l); ctx.stroke();
  }
  const h = heightFromCanvas(c);
  return { map: toTex(c), normalMap: toTex(heightToNormalCanvas(h, S, 3.5), { srgb: false }) };
}

export function sandTextures() {
  const S = 256; const f = fbmField(S, 16, 4, 31); const r = rng(9);
  const c = fieldToCanvas(f, S, (v) => { const n = (r() - 0.5) * 18; return [214 + v * 26 + n, 196 + v * 22 + n, 156 + v * 18 + n]; });
  return { map: toTex(c), normalMap: toTex(heightToNormalCanvas(heightFromCanvas(c), S, 2.0), { srgb: false }) };
}

export function dirtTextures() {
  const S = 256; const f = fbmField(S, 8, 5, 77); const r = rng(3);
  const c = fieldToCanvas(f, S, (v) => { const n = (r() - 0.5) * 20; return [110 + v * 50 + n, 86 + v * 40 + n, 58 + v * 26 + n]; });
  const ctx = c.getContext('2d');
  for (let i = 0; i < 500; i++) { ctx.fillStyle = `rgba(${60 + r() * 60},${50 + r() * 40},${30 + r() * 30},0.6)`; ctx.beginPath(); ctx.arc(r() * S, r() * S, 0.6 + r() * 1.8, 0, 7); ctx.fill(); }
  return { map: toTex(c), normalMap: toTex(heightToNormalCanvas(heightFromCanvas(c), S, 3), { srgb: false }) };
}

export function asphaltTextures() {
  const S = 512; const f = fbmField(S, 16, 5, 41); const f2 = fbmField(S, 4, 3, 43); const r = rng(17);
  const c = fieldToCanvas(f, S, (v, i) => { const n = (r() - 0.5) * 36; const base = 58 + v * 26 + f2[i] * 14 + n; return [base, base, base * 1.03]; });
  const ctx = c.getContext('2d');
  for (let i = 0; i < 2600; i++) { const g = 80 + r() * 90; ctx.fillStyle = `rgba(${g},${g},${g},${0.25 + r() * 0.4})`; ctx.fillRect(r() * S, r() * S, 1 + r() * 1.5, 1 + r() * 1.5); }
  // soft repair patches / worn spots (radial, no hard rectangles), thin hairline cracks
  for (let i = 0; i < 9; i++) {
    const x = r() * S, y = r() * S, rad = 20 + r() * 55, dark = r() < 0.6;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
      g.addColorStop(0, dark ? 'rgba(30,30,32,0.22)' : 'rgba(150,148,142,0.14)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
    }
  }
  ctx.strokeStyle = 'rgba(22,22,22,0.4)'; ctx.lineWidth = 0.8;
  for (let i = 0; i < 6; i++) { let x = r() * S, y = r() * S; ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 7; k++) { x += (r() - 0.5) * 24; y += (r() - 0.5) * 24; ctx.lineTo(x, y); } ctx.stroke(); }
  const h = heightFromCanvas(c);
  return { map: toTex(c), normalMap: toTex(heightToNormalCanvas(h, S, 2.4), { srgb: false }) };
}

export function paverTextures() {
  const S = 256; const c = canvas(S, S); const ctx = c.getContext('2d'); const r = rng(29);
  ctx.fillStyle = '#7d7a74'; ctx.fillRect(0, 0, S, S);
  const n = 4, s = S / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n * 2; x++) {
    const off = (y % 2) * s / 2; const w = s / 2;
    const v = 150 + r() * 34; const tint = r() < 0.06 ? [v * 0.93, v * 0.82, v * 0.74] : [v, v * 0.97, v * 0.92];
    ctx.fillStyle = `rgb(${tint[0] | 0},${tint[1] | 0},${tint[2] | 0})`;
    ctx.fillRect(((x * w + off) % S) + 1.5, y * s + 1.5, w - 3, s - 3);
    if (((x * w + off) % S) + w > S) ctx.fillRect(((x * w + off) % S) - S + 1.5, y * s + 1.5, w - 3, s - 3);
  }
  const img = ctx.getImageData(0, 0, S, S); const d = img.data;
  for (let i = 0; i < d.length; i += 4) { const k = (r() - 0.5) * 22; d[i] += k; d[i + 1] += k; d[i + 2] += k; }
  ctx.putImageData(img, 0, 0);
  return { map: toTex(c), normalMap: toTex(heightToNormalCanvas(heightFromCanvas(c), S, 5), { srgb: false }) };
}

export function curbTexture() {
  const c = canvas(256, 32); const ctx = c.getContext('2d');
  for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? '#e9e6df' : '#c3332a'; ctx.fillRect(i * 64, 0, 64, 32); }
  return toTex(c);
}
export function concreteTextures(seed = 51, base = 170) {
  const S = 256; const f = fbmField(S, 8, 5, seed); const r = rng(seed);
  const c = fieldToCanvas(f, S, (v) => { const n = (r() - 0.5) * 14; const b = base - 25 + v * 50 + n; return [b, b * 0.99, b * 0.96]; });
  return { map: toTex(c), normalMap: toTex(heightToNormalCanvas(heightFromCanvas(c), S, 1.6), { srgb: false }) };
}

export function barkTexture() {
  const S = 128; const c = canvas(S, S); const ctx = c.getContext('2d'); const r = rng(61);
  ctx.fillStyle = '#5a4634'; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 160; i++) { const x = r() * S; const g = 50 + r() * 50; ctx.strokeStyle = `rgba(${g},${g * 0.8},${g * 0.6},0.7)`; ctx.lineWidth = 1 + r() * 2; ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + (r() - 0.5) * 10, S * 0.3, x + (r() - 0.5) * 10, S * 0.6, x, S); ctx.stroke(); }
  return toTex(c);
}

export function waterNormal() {
  const S = 256; const f = fbmField(S, 8, 4, 91);
  return toTex(heightToNormalCanvas(f, S, 6), { srgb: false });
}

// ---------------- facades ----------------
// Each facade tile = 2 bays wide x 2 floors tall (1 bay = 3.6 m)
const FACADE_STYLES = {
  ku: { wall: '#ece6d6', trim: '#0d6b52', glass: ['#4a6378', '#7f9bb0'], winW: 0.62, winH: 0.5, fins: true },
  kuglass: { wall: '#e8e4da', trim: '#0d6b52', glass: ['#35576e', '#8fb2c6'], winW: 0.9, winH: 0.62, band: true },
  brick: { wall: '#9a4f36', trim: '#e8e1d2', glass: ['#3c4c5a', '#7d93a6'], winW: 0.5, winH: 0.5, brick: true },
  concrete: { wall: '#b9b6ae', trim: '#8e8a82', glass: ['#3a4d5e', '#7a92a6'], winW: 0.94, winH: 0.38, ribbon: true },
  dorm: { wall: '#f0e3c8', trim: '#c96b3b', glass: ['#4a5b68', '#8ea2b2'], winW: 0.42, winH: 0.55, balcony: true },
  shop: { wall: '#e9c88f', trim: '#7b4a2a', glass: ['#3d4f5f', '#8aa3b8'], winW: 0.5, winH: 0.5, shophouse: true },
  glass: { wall: '#2d4252', trim: '#a9b4bc', glass: ['#2b4a62', '#9cc1d8'], winW: 0.96, winH: 0.9, curtain: true },
  hall: { wall: '#e6e0d0', trim: '#0d6b52', glass: ['#3b5163', '#86a0b3'], winW: 0.8, winH: 0.16, hall: true },
};
export const FACADE_KEYS = Object.keys(FACADE_STYLES);

export function facadeTextures(key, seed = 1) {
  const st = FACADE_STYLES[key]; const S = 512, B = 256; const r = rng(seed * 997 + key.length * 13);
  const c = canvas(S, S), ctx = c.getContext('2d');
  const e = canvas(S, S), ex = e.getContext('2d');
  const m = canvas(S, S), mx = m.getContext('2d');
  ex.fillStyle = '#000'; ex.fillRect(0, 0, S, S);
  mx.fillStyle = 'rgb(0,225,0)'; mx.fillRect(0, 0, S, S); // G = roughness, B = metalness
  const hc = canvas(S, S), hx = hc.getContext('2d'); hx.fillStyle = 'rgb(150,150,150)'; hx.fillRect(0, 0, S, S); // relief: windows recessed, trims raised
  ctx.fillStyle = st.wall; ctx.fillRect(0, 0, S, S);
  if (st.brick) {
    for (let y = 0; y < S; y += 8) for (let x = -16; x < S; x += 24) {
      const ox = (y / 8) % 2 ? 12 : 0; const v = 0.82 + r() * 0.3;
      ctx.fillStyle = `rgb(${154 * v | 0},${78 * v | 0},${54 * v | 0})`; ctx.fillRect(x + ox + 1, y + 1, 22, 6);
    }
  }
  // wall grain
  const img = ctx.getImageData(0, 0, S, S), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const k = (r() - 0.5) * 10; d[i] += k; d[i + 1] += k; d[i + 2] += k; }
  ctx.putImageData(img, 0, 0);
  for (let fy = 0; fy < 2; fy++) for (let bx = 0; bx < 2; bx++) {
    const x0 = bx * B, y0 = fy * B;
    let ww = st.winW * B, wh = st.winH * B; let wx = x0 + (B - ww) / 2, wy = y0 + B * 0.24;
    if (st.ribbon) { wx = x0; ww = B; wy = y0 + B * 0.3; }
    if (st.curtain) { wx = x0 + 2; ww = B - 4; wy = y0 + 2; wh = B - 4; }
    if (st.hall) { wy = y0 + B * 0.1; }
    if (st.shophouse && fy === 1) { wy = y0 + B * 0.2; }
    // glass with sky gradient
    const g = ctx.createLinearGradient(0, wy, 0, wy + wh); g.addColorStop(0, st.glass[1]); g.addColorStop(1, st.glass[0]);
    ctx.fillStyle = g; ctx.fillRect(wx, wy, ww, wh); hx.fillStyle = 'rgb(55,55,55)'; hx.fillRect(wx, wy, ww, wh); hx.strokeStyle = 'rgb(205,205,205)'; hx.lineWidth = 4; hx.strokeRect(wx, wy, ww, wh);
    // reflections
    ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.beginPath(); ctx.moveTo(wx + ww * 0.1, wy + wh); ctx.lineTo(wx + ww * 0.45, wy); ctx.lineTo(wx + ww * 0.6, wy); ctx.lineTo(wx + ww * 0.25, wy + wh); ctx.fill();
    // curtains / blinds inside some windows
    if (r() < 0.45 && !st.curtain) { ctx.fillStyle = `rgba(${200 + r() * 50},${190 + r() * 50},${160 + r() * 50},0.55)`; ctx.fillRect(wx + 3, wy + 3, ww * (0.3 + r() * 0.5), wh - 6); }
    // mullions / frames
    ctx.strokeStyle = st.curtain ? '#9aa6ae' : '#5c5c5c'; ctx.lineWidth = st.curtain ? 3 : 4; ctx.strokeRect(wx, wy, ww, wh);
    ctx.lineWidth = 2; const div = st.ribbon ? 4 : (st.curtain ? 2 : 2);
    for (let k = 1; k < div; k++) { ctx.beginPath(); ctx.moveTo(wx + ww * k / div, wy); ctx.lineTo(wx + ww * k / div, wy + wh); ctx.stroke(); }
    if (st.curtain) { ctx.beginPath(); ctx.moveTo(wx, wy + wh * 0.72); ctx.lineTo(wx + ww, wy + wh * 0.72); ctx.stroke(); }
    // sill
    if (!st.curtain && !st.ribbon) { ctx.fillStyle = st.trim; ctx.fillRect(wx - 6, wy + wh, ww + 12, 7); hx.fillStyle = 'rgb(235,235,235)'; hx.fillRect(wx - 6, wy + wh, ww + 12, 7); }
    // emissive lit windows
    const lit = r() < 0.42;
    if (lit) {
      const warm = r() < 0.7; const a = 0.55 + r() * 0.45;
      ex.fillStyle = warm ? `rgba(255,${200 + r() * 40 | 0},${120 + r() * 50 | 0},${a})` : `rgba(${200 + r() * 40 | 0},${225 + r() * 30 | 0},255,${a})`;
      ex.fillRect(wx + 3, wy + 3, ww - 6, wh - 6);
      ex.fillStyle = 'rgba(0,0,0,0.35)'; for (let k = 1; k < div; k++) ex.fillRect(wx + ww * k / div - 1, wy, 3, wh);
    }
    mx.fillStyle = 'rgb(0,28,90)'; mx.fillRect(wx, wy, ww, wh);
    // fins / bands / balconies
    if (st.fins) { ctx.fillStyle = st.trim; hx.fillStyle = 'rgb(240,240,240)'; for (const fx of [x0 + 10, x0 + B - 22]) { ctx.fillRect(fx, y0, 12, B); hx.fillRect(fx, y0, 12, B); } ctx.fillStyle = 'rgba(0,0,0,0.15)'; for (const fx of [x0 + 22, x0 + B - 10]) ctx.fillRect(fx, y0, 3, B); }
    if (st.band) { ctx.fillStyle = st.trim; ctx.fillRect(x0, y0 + B * 0.88, B, B * 0.12); hx.fillStyle = 'rgb(225,225,225)'; hx.fillRect(x0, y0 + B * 0.88, B, B * 0.12); mx.fillStyle = 'rgb(0,160,0)'; mx.fillRect(x0, y0 + B * 0.88, B, B * 0.12); }
    if (st.hall) { ctx.fillStyle = st.trim; ctx.fillRect(x0, y0 + B * 0.32, B, 10); ctx.fillStyle = 'rgba(0,0,0,0.06)'; for (let k = 0; k < 6; k++) ctx.fillRect(x0 + k * 43, y0 + B * 0.36, 2, B * 0.64); }
    if (st.balcony) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x0 + 8, y0 + B * 0.80, B - 16, 6);
      ctx.fillStyle = st.trim; ctx.fillRect(x0 + 8, y0 + B * 0.62, B - 16, 5);
      ctx.strokeStyle = '#d9d2c2'; ctx.lineWidth = 2; for (let k = 0; k < 14; k++) { const xx = x0 + 12 + k * (B - 24) / 13; ctx.beginPath(); ctx.moveTo(xx, y0 + B * 0.62); ctx.lineTo(xx, y0 + B * 0.80); ctx.stroke(); }
      // AC unit + laundry
      ctx.fillStyle = '#e8e8e4'; ctx.fillRect(x0 + B - 70, y0 + B * 0.66, 48, 30); ctx.fillStyle = '#9a9a9a'; ctx.beginPath(); ctx.arc(x0 + B - 46, y0 + B * 0.66 + 15, 10, 0, 7); ctx.fill();
      if (r() < 0.7) { ctx.strokeStyle = '#777'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0 + 16, y0 + B * 0.58); ctx.lineTo(x0 + 120, y0 + B * 0.58); ctx.stroke(); for (let k = 0; k < 4; k++) { ctx.fillStyle = ['#d94b4b', '#3b7dd8', '#f2c230', '#ffffff', '#59b36b', '#e98fb0'][(r() * 6) | 0]; ctx.fillRect(x0 + 22 + k * 24, y0 + B * 0.58, 18, 22 + r() * 14); } }
    }
    if (st.shophouse) { ctx.fillStyle = st.trim; ctx.fillRect(x0, y0, 6, B); ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x0 + 6, y0, 4, B); }
    // stains below windows (tropical weathering)
    ctx.fillStyle = 'rgba(40,40,30,0.07)';
    for (let k = 0; k < 4; k++) { const sx = wx + r() * ww; ctx.fillRect(sx, wy + wh + 6, 2 + r() * 5, 20 + r() * 50); }
  }
  // floor slab lines
  ctx.fillStyle = 'rgba(0,0,0,0.10)'; ctx.fillRect(0, B - 3, S, 3); ctx.fillRect(0, S - 3, S, 3); hx.fillStyle = 'rgb(120,120,120)'; hx.fillRect(0, B - 3, S, 3); hx.fillRect(0, S - 3, S, 3);
  if (st.curtain) { ctx.fillStyle = '#9aa6ae'; ctx.fillRect(0, 0, S, 3); ctx.fillRect(0, B, S, 3); }
  return { map: toTex(c), emissiveMap: toTex(e), rmMap: toTex(m, { srgb: false }), normalMap: toTex(heightToNormalCanvas(heightFromCanvas(hc), S, 3.0), { srgb: false }) };
}

// Ground floor (2 bays wide x 1 floor) variants
export function groundFloorTextures(kind, seed = 3) {
  const W = 512, H = 256; const r = rng(seed + kind.length * 7);
  const c = canvas(W, H), ctx = c.getContext('2d');
  const e = canvas(W, H), ex = e.getContext('2d'); ex.fillStyle = '#000'; ex.fillRect(0, 0, W, H);
  const m = canvas(W, H), mx = m.getContext('2d'); mx.fillStyle = 'rgb(0,220,0)'; mx.fillRect(0, 0, W, H);
  const wall = { lobby: '#dcd5c4', shutter: '#d8c08c', mart: '#f1f1ee', showroom: '#e6e6e6', plain: '#d7d0bf', brickw: '#8f4a33', darkglass: '#2a3a46' }[kind] || '#ddd';
  ctx.fillStyle = wall; ctx.fillRect(0, 0, W, H);
  const glass = (x, y, w, h, light) => {
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#9ab7c9'); g.addColorStop(1, '#2f4656');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h); mx.fillStyle = 'rgb(0,25,80)'; mx.fillRect(x, y, w, h);
    if (light) { ex.fillStyle = light; ex.fillRect(x + 2, y + 2, w - 4, h - 4); }
  };
  if (kind === 'lobby' || kind === 'darkglass' || kind === 'showroom') {
    for (let i = 0; i < 4; i++) { glass(i * 128 + 6, 30, 116, H - 30, `rgba(255,236,190,${0.5 + r() * 0.3})`); }
    ctx.strokeStyle = '#555'; ctx.lineWidth = 5; for (let i = 0; i < 4; i++) ctx.strokeRect(i * 128 + 6, 30, 116, H - 30);
    ctx.fillStyle = '#444'; ctx.fillRect(0, 22, W, 10);
  } else if (kind === 'shutter') {
    for (let i = 0; i < 2; i++) {
      const x = i * 256 + 14; const open = r() < 0.6;
      if (open) { glass(x, 40, 228, H - 40, `rgba(255,220,160,0.75)`); ctx.fillStyle = 'rgba(80,60,40,0.6)'; ctx.fillRect(x, 40, 228, 18); }
      else { ctx.fillStyle = '#a9a9a6'; ctx.fillRect(x, 40, 228, H - 40); ctx.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = 44; y < H; y += 8) ctx.fillRect(x, y, 228, 2); }
      ctx.fillStyle = ['#c0392b', '#1f6f9a', '#0d6b52', '#d68910', '#6c3483'][(r() * 5) | 0]; ctx.fillRect(x - 6, 6, 240, 28);
      ex.fillStyle = 'rgba(255,255,255,0.35)'; ex.fillRect(x - 6, 6, 240, 28);
    }
  } else if (kind === 'mart') {
    ctx.fillStyle = '#0a8a4a'; ctx.fillRect(0, 0, W, 24); ctx.fillStyle = '#f39c12'; ctx.fillRect(0, 24, W, 10); ctx.fillStyle = '#d62f2f'; ctx.fillRect(0, 34, W, 6);
    ex.fillStyle = 'rgba(255,255,255,0.5)'; ex.fillRect(0, 0, W, 40);
    for (let i = 0; i < 4; i++) glass(i * 128 + 4, 46, 120, H - 46, 'rgba(240,250,255,0.95)');
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) ctx.fillRect(i * 128 + 14 + k * 26, 120, 18, 60 + r() * 30);
  } else {
    for (let i = 0; i < 2; i++) glass(i * 256 + 60, 50, 136, 120, r() < 0.4 ? 'rgba(255,230,180,0.6)' : null);
    ctx.fillStyle = '#5a4a3a'; ctx.fillRect(220, 70, 72, H - 70);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, H - 8, W, 8);
  return { map: toTex(c), emissiveMap: toTex(e), rmMap: toTex(m, { srgb: false }) };
}

export function roofTextures(kind) {
  const S = 256; const c = canvas(S, S), ctx = c.getContext('2d'); const r = rng(kind.length * 31);
  if (kind === 'tile') {
    ctx.fillStyle = '#b4532a'; ctx.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 16) for (let x = 0; x < S; x += 16) { const v = 0.8 + r() * 0.35; ctx.fillStyle = `rgb(${190 * v | 0},${84 * v | 0},${42 * v | 0})`; ctx.beginPath(); ctx.ellipse(x + 8 + ((y / 16) % 2) * 8, y + 10, 8, 9, 0, 0, Math.PI); ctx.fill(); }
  } else if (kind === 'metal') {
    ctx.fillStyle = '#9aa1a6'; ctx.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += 16) { const g = ctx.createLinearGradient(x, 0, x + 16, 0); g.addColorStop(0, '#7d858a'); g.addColorStop(0.5, '#c4cacd'); g.addColorStop(1, '#7d858a'); ctx.fillStyle = g; ctx.fillRect(x, 0, 16, S); }
    for (let i = 0; i < 30; i++) { ctx.fillStyle = `rgba(120,70,40,${r() * 0.15})`; ctx.fillRect(r() * S, r() * S, 10 + r() * 40, 2 + r() * 30); }
  } else if (kind === 'green') {
    ctx.fillStyle = '#2f6f5a'; ctx.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += 16) { ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x, 0, 6, S); }
  } else {
    const f = fbmField(S, 8, 5, 71);
    const cc = fieldToCanvas(f, S, (v) => { const b = 120 + v * 70 + (r() - 0.5) * 14; return [b, b * 0.98, b * 0.94]; });
    ctx.drawImage(cc, 0, 0);
    ctx.strokeStyle = 'rgba(60,60,60,0.25)'; ctx.lineWidth = 2; for (let i = 0; i <= S; i += 64) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, S); ctx.moveTo(0, i); ctx.lineTo(S, i); ctx.stroke(); }
    for (let i = 0; i < 12; i++) { ctx.fillStyle = `rgba(30,35,25,${0.05 + r() * 0.12})`; ctx.beginPath(); ctx.ellipse(r() * S, r() * S, 10 + r() * 40, 6 + r() * 25, r() * 3, 0, 7); ctx.fill(); }
  }
  return { map: toTex(c), normalMap: toTex(heightToNormalCanvas(heightFromCanvas(c), S, 2.5), { srgb: false }) };
}

// sports surfaces
export function trackTexture() {
  const c = canvas(512, 64), ctx = c.getContext('2d'); const r = rng(81);
  ctx.fillStyle = '#b5452f'; ctx.fillRect(0, 0, 512, 64);
  const img = ctx.getImageData(0, 0, 512, 64), d = img.data; for (let i = 0; i < d.length; i += 4) { const k = (r() - 0.5) * 30; d[i] += k; d[i + 1] += k * 0.6; d[i + 2] += k * 0.5; } ctx.putImageData(img, 0, 0);
  ctx.fillStyle = '#f2f2f2'; for (let i = 0; i <= 8; i++) ctx.fillRect(i * (512 / 8) - (i === 8 ? 3 : 0), 0, 3, 64);
  return toTex(c);
}
export function fieldTexture() {
  const c = canvas(256, 256), ctx = c.getContext('2d'); const r = rng(83);
  for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#3f8a3a' : '#4b9a44'; ctx.fillRect(0, i * 32, 256, 32); }
  const img = ctx.getImageData(0, 0, 256, 256), d = img.data; for (let i = 0; i < d.length; i += 4) { const k = (r() - 0.5) * 26; d[i] += k * 0.6; d[i + 1] += k; d[i + 2] += k * 0.4; } ctx.putImageData(img, 0, 0);
  return toTex(c);
}
export function courtTexture(color = '#2e6fa3', line = '#ffffff', w = 512, h = 256) {
  const c = canvas(w, h), ctx = c.getContext('2d');
  ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = line; ctx.lineWidth = 4; ctx.strokeRect(8, 8, w - 16, h - 16);
  ctx.beginPath(); ctx.moveTo(w / 2, 8); ctx.lineTo(w / 2, h - 8); ctx.stroke();
  ctx.beginPath(); ctx.arc(w / 2, h / 2, h * 0.16, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.arc(8, h / 2, h * 0.3, -Math.PI / 2, Math.PI / 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(w - 8, h / 2, h * 0.3, Math.PI / 2, Math.PI * 1.5); ctx.stroke();
  return toTex(c, { repeat: false });
}
export function poolTexture() {
  const S = 256; const c = canvas(S, S), ctx = c.getContext('2d');
  ctx.fillStyle = '#3fb5d6'; ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; for (let i = 0; i <= S; i += 16) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, S); ctx.moveTo(0, i); ctx.lineTo(S, i); ctx.stroke(); }
  return toTex(c);
}
export function parkingTexture() {
  const c = canvas(256, 256), ctx = c.getContext('2d');
  ctx.fillStyle = '#4c4c4e'; ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#e8e8e8'; for (let i = 0; i < 256; i += 64) ctx.fillRect(i, 0, 4, 110);
  for (let i = 0; i < 256; i += 64) ctx.fillRect(i, 146, 4, 110);
  return toTex(c);
}
export function farmTexture() {
  const c = canvas(256, 256), ctx = c.getContext('2d'); const r = rng(95);
  ctx.fillStyle = '#7a5a3a'; ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 16) { ctx.fillStyle = '#5f4429'; ctx.fillRect(0, y, 256, 5); for (let x = 0; x < 256; x += 6) { ctx.fillStyle = `rgb(${50 + r() * 40 | 0},${120 + r() * 60 | 0},${40 + r() * 20 | 0})`; ctx.beginPath(); ctx.arc(x + r() * 3, y + 10, 2 + r() * 2.5, 0, 7); ctx.fill(); } }
  return toTex(c);
}

// ---------------- text signs ----------------
export const THAI_FONT = "'Sarabun','Noto Sans Thai','Leelawadee UI','Tahoma',sans-serif";
export function signTexture(lines, { w = 1024, h = 256, bg = '#0d6b52', fg = '#ffffff', sub = '#d9efe6', border = '#e8c766' } = {}) {
  const c = canvas(w, h), ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  if (border) { ctx.strokeStyle = border; ctx.lineWidth = 8; ctx.strokeRect(10, 10, w - 20, h - 20); }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const fit = (t, size, weight) => { let s = size; ctx.font = `${weight} ${s}px ${THAI_FONT}`; while (ctx.measureText(t).width > w - 60 && s > 12) { s -= 2; ctx.font = `${weight} ${s}px ${THAI_FONT}`; } };
  if (lines.length === 1) { fit(lines[0], h * 0.5, 700); ctx.fillStyle = fg; ctx.fillText(lines[0], w / 2, h / 2); }
  else { fit(lines[0], h * 0.38, 700); ctx.fillStyle = fg; ctx.fillText(lines[0], w / 2, h * 0.38); fit(lines[1], h * 0.22, 600); ctx.fillStyle = sub; ctx.fillText(lines[1], w / 2, h * 0.74); }
  return toTex(c, { repeat: false });
}

export function iconTexture(emoji, color = '#0d6b52') {
  const S = 128; const c = canvas(S, S), ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(S / 2, S / 2 + 4, 52, 0, 7); ctx.fill();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(S / 2, S / 2, 50, 0, 7); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.stroke();
  ctx.font = `60px 'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(emoji, S / 2, S / 2 + 4);
  return toTex(c, { repeat: false, aniso: false });
}

export function printTexture(text, color) {
  const c = canvas(128, 128), ctx = c.getContext('2d');
  ctx.fillStyle = color; ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.font = `900 54px ${THAI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 64);
  return toTex(c, { repeat: false });
}
