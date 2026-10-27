// 2.5D collision world: oriented boxes + circles on a spatial hash, plus a 1 m surface raster.
import { MAP, groundHeight } from './mapdata.js';

export const SURF = { GRASS: 0, ROAD: 1, WALK: 2, BUILDING: 3, SAND: 4, WATER: 5, PIER: 6, DIRT: 7, PLAZA: 8, PARKING: 9, SPORT: 10, MEDIAN: 11, FARM: 12, FOREST: 13, PLATFORM: 14, POOL: 15, RAIL: 16, URBAN: 17 };
const CELL = 16;

export class CollisionWorld {
  constructor() {
    this.grid = new Map();
    this.boxes = []; this.circles = [];
    this.minX = MAP.b.minX; this.minZ = MAP.b.minZ;
    this.w = MAP.sw; this.h = MAP.sh;
    this.surf = MAP.surface;
    this.pierY = 1.8;
    this.platforms = [];
  }
  _cells(x0, z0, x1, z1, fn) {
    const a = Math.floor(x0 / CELL), b = Math.floor(z0 / CELL), c = Math.floor(x1 / CELL), d = Math.floor(z1 / CELL);
    for (let i = a; i <= c; i++) for (let j = b; j <= d; j++) fn(i + ',' + j);
  }
  _insert(obj, x0, z0, x1, z1) {
    this._cells(x0, z0, x1, z1, (k) => { let arr = this.grid.get(k); if (!arr) { arr = []; this.grid.set(k, arr); } arr.push(obj); });
  }
  // box centred at (x,z), half extents hx,hz, rotation (radians, same as three.js rotation.y), top height
  addBox(x, z, hx, hz, rot = 0, top = 100, bottom = -50, tag = null) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const o = { t: 0, x, z, hx, hz, c, s, top, bottom, tag };
    const ex = Math.abs(hx * c) + Math.abs(hz * s), ez = Math.abs(hx * s) + Math.abs(hz * c);
    this.boxes.push(o); this._insert(o, x - ex, z - ez, x + ex, z + ez); return o;
  }
  addCircle(x, z, r, top = 100, tag = null) {
    const o = { t: 1, x, z, r, top, bottom: -50, tag }; this.circles.push(o); this._insert(o, x - r, z - r, x + r, z + r); return o;
  }
  // segment wall (fence) as thin box
  addWall(x0, z0, x1, z1, thick = 0.3, top = 2) {
    const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz);
    const rot = Math.atan2(-dz, dx); // rotate local +x onto segment
    return this.addBox((x0 + x1) / 2, (z0 + z1) / 2, L / 2, thick / 2, rot, top);
  }
  query(x, z, r) {
    const out = new Set();
    this._cells(x - r, z - r, x + r, z + r, (k) => { const arr = this.grid.get(k); if (arr) for (const o of arr) out.add(o); });
    return out;
  }
  // Resolve a circle (radius r, feet height y, body height hgt) against the world. Returns {x,z,hit,nx,nz}
  resolve(x, z, r, y = 0, hgt = 1.8, ignoreTag = null) {
    let hit = false, nx = 0, nz = 0;
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const o of this.query(x, z, r + 1)) {
        if (o.tag && o.tag === ignoreTag) continue;
        if (y > o.top - 0.05 || y + hgt < o.bottom) continue;
        if (o.t === 1) {
          const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz), m = r + o.r;
          if (d < m && d > 1e-6) { const p = (m - d); x += dx / d * p; z += dz / d * p; nx = dx / d; nz = dz / d; hit = moved = true; }
        } else {
          // to local
          const dx = x - o.x, dz = z - o.z;
          const lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c;
          const cx = Math.max(-o.hx, Math.min(o.hx, lx)), cz = Math.max(-o.hz, Math.min(o.hz, lz));
          let ddx = lx - cx, ddz = lz - cz; let d = Math.hypot(ddx, ddz);
          if (d < r) {
            let px, pz;
            if (d < 1e-6) { // centre inside box: push out along shallowest axis
              const ox = o.hx - Math.abs(lx), oz = o.hz - Math.abs(lz);
              if (ox < oz) { px = Math.sign(lx) || 1; pz = 0; d = -ox; } else { px = 0; pz = Math.sign(lz) || 1; d = -oz; }
            } else { px = ddx / d; pz = ddz / d; }
            const push = r - d;
            const lx2 = lx + px * push, lz2 = lz + pz * push;
            // back to world
            x = o.x + lx2 * o.c + lz2 * o.s; z = o.z - lx2 * o.s + lz2 * o.c;
            nx = px * o.c + pz * o.s; nz = -px * o.s + pz * o.c; hit = moved = true;
          }
        }
      }
      if (!moved) break;
    }
    return { x, z, hit, nx, nz };
  }
  // Is point blocked (for spawning)
  blocked(x, z, r = 0.5) {
    for (const o of this.query(x, z, r + 1)) {
      if (o.t === 1) { if (Math.hypot(x - o.x, z - o.z) < r + o.r) return true; }
      else { const dx = x - o.x, dz = z - o.z; const lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c; if (Math.abs(lx) < o.hx + r && Math.abs(lz) < o.hz + r) return true; }
    }
    return false;
  }
  // Segment test for camera: returns fraction 0..1 of first hit (approx, 2.5D)
  raySegment(x0, y0, z0, x1, y1, z1, pad = 0.3) {
    let best = 1;
    const minx = Math.min(x0, x1), maxx = Math.max(x0, x1), minz = Math.min(z0, z1), maxz = Math.max(z0, z1);
    const cand = new Set();
    this._cells(minx - 2, minz - 2, maxx + 2, maxz + 2, (k) => { const arr = this.grid.get(k); if (arr) for (const o of arr) cand.add(o); });
    for (const o of cand) {
      if (o.t !== 0 || o.top < 2.5) continue;
      // transform to local, slab test in 2D with padding
      const ax = x0 - o.x, az = z0 - o.z, bx = x1 - o.x, bz = z1 - o.z;
      const lx0 = ax * o.c - az * o.s, lz0 = ax * o.s + az * o.c, lx1 = bx * o.c - bz * o.s, lz1 = bx * o.s + bz * o.c;
      const dx = lx1 - lx0, dz = lz1 - lz0; let t0 = 0, t1 = 1;
      const hx = o.hx + pad, hz = o.hz + pad;
      const clip = (p, q) => { if (Math.abs(p) < 1e-9) return q >= 0; const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } return true; };
      if (clip(-dx, lx0 + hx) && clip(dx, hx - lx0) && clip(-dz, lz0 + hz) && clip(dz, hz - lz0)) {
        const yAt = y0 + (y1 - y0) * t0;
        if (yAt < o.top && t0 < best) best = t0;
      }
    }
    return best;
  }
  // ---------------- surface raster ----------------
  idx(x, z) { const ix = Math.floor(x - this.minX), iz = Math.floor(z - this.minZ); if (ix < 0 || iz < 0 || ix >= this.w || iz >= this.h) return -1; return iz * this.w + ix; }
  surfAt(x, z) { const i = this.idx(x, z); return i < 0 ? SURF.WATER : this.surf[i]; }
  fillRect(x0, z0, x1, z1, type, onlyIf = null) {
    const a = Math.max(0, Math.floor(Math.min(x0, x1) - this.minX)), b = Math.max(0, Math.floor(Math.min(z0, z1) - this.minZ));
    const c = Math.min(this.w - 1, Math.ceil(Math.max(x0, x1) - this.minX) - 1), d = Math.min(this.h - 1, Math.ceil(Math.max(z0, z1) - this.minZ) - 1);
    for (let j = b; j <= d; j++) for (let i = a; i <= c; i++) { const k = j * this.w + i; if (onlyIf === null || onlyIf(this.surf[k])) this.surf[k] = type; }
  }
  fillRotRect(cx, cz, sx, sz, rot, type) {
    const c = Math.cos(rot), s = Math.sin(rot); const ex = Math.abs(sx / 2 * c) + Math.abs(sz / 2 * s), ez = Math.abs(sx / 2 * s) + Math.abs(sz / 2 * c);
    for (let z = Math.floor(cz - ez); z <= cz + ez; z++) for (let x = Math.floor(cx - ex); x <= cx + ex; x++) {
      const dx = x + 0.5 - cx, dz = z + 0.5 - cz; const lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (Math.abs(lx) <= sx / 2 && Math.abs(lz) <= sz / 2) { const i = this.idx(x, z); if (i >= 0) this.surf[i] = type; }
    }
  }
  fillPoly(pts, type, onlyIf = null) { // pts flat [x,z,...]
    let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity; const n = pts.length / 2;
    for (let i = 0; i < n; i++) { minx = Math.min(minx, pts[i * 2]); maxx = Math.max(maxx, pts[i * 2]); minz = Math.min(minz, pts[i * 2 + 1]); maxz = Math.max(maxz, pts[i * 2 + 1]); }
    for (let z = Math.floor(minz); z <= maxz; z++) {
      const zc = z + 0.5; const xs = [];
      for (let i = 0, j = n - 1; i < n; j = i++) { const zi = pts[i * 2 + 1], zj = pts[j * 2 + 1]; if ((zi > zc) !== (zj > zc)) xs.push(pts[i * 2] + (zc - zi) / (zj - zi) * (pts[j * 2] - pts[i * 2])); }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - 0.5); x <= xs[k + 1] - 0.5; x++) { const id = this.idx(x, z); if (id >= 0 && (onlyIf === null || onlyIf(this.surf[id]))) this.surf[id] = type; }
    }
  }
  fillEllipse(cx, cz, rx, rz, type) {
    for (let z = Math.floor(cz - rz); z <= cz + rz; z++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const a = (x + 0.5 - cx) / rx, b = (z + 0.5 - cz) / rz; if (a * a + b * b <= 1) { const i = this.idx(x, z); if (i >= 0) this.surf[i] = type; }
    }
  }
  // walkable surface height (feet) at x,z
  heightAt(x, z) {
    const s = this.surfAt(x, z);
    if (s === SURF.PIER) return this.pierY;
    if (s === SURF.PLATFORM) { for (const p of this.platforms) if (x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1) return p.h; }
    if (s === SURF.POOL) return groundHeight(x, z) - 1.6;
    const g = groundHeight(x, z);
    if (s === SURF.WALK || s === SURF.MEDIAN) return g + 0.15;
    if (s === SURF.PLAZA) return g + 0.06;
    if (s === SURF.WATER) return g;
    return g;
  }
}
