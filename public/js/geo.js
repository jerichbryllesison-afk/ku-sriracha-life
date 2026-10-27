// Geometry accumulation helpers: build many primitives into few merged, chunked meshes.
import * as THREE from 'three';

export class GeoBuilder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = []; this.n = 0; }
  get empty() { return this.n === 0; }
  // p: 4 corners [x,y,z] counter-clockwise seen from the front; uvs: 4 [u,v]
  quad(p0, p1, p2, p3, uvs, color = [1, 1, 1]) {
    const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2];
    const bx = p3[0] - p0[0], by = p3[1] - p0[1], bz = p3[2] - p0[2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const b = this.n;
    for (const [i, p] of [p0, p1, p2, p3].entries()) {
      this.pos.push(p[0], p[1], p[2]); this.nor.push(nx, ny, nz); this.uv.push(uvs[i][0], uvs[i][1]); this.col.push(color[0], color[1], color[2]);
    }
    this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3); this.n += 4;
  }
  // Oriented box. opts: { u: metres per texture repeat horizontally, v: metres per repeat vertically, faces: 'all'|'sides'|..., color, top: uv scale }
  box(cx, cy, cz, sx, sy, sz, rot = 0, opts = {}) {
    const { u = 1, v = 1, color = [1, 1, 1], skip = {}, topU = u, v0 = 0 } = opts;
    const c = Math.cos(rot), s = Math.sin(rot);
    const hx = sx / 2, hz = sz / 2, y0 = cy - sy / 2, y1 = cy + sy / 2;
    const P = (lx, y, lz) => [cx + lx * c + lz * s, y, cz - lx * s + lz * c];
    // corners (local): front = +z
    const fl = [-hx, hz], fr = [hx, hz], br = [hx, -hz], bl = [-hx, -hz];
    const wall = (a, b, len) => {
      this.quad(P(a[0], y0, a[1]), P(b[0], y0, b[1]), P(b[0], y1, b[1]), P(a[0], y1, a[1]),
        [[0, v0 / v], [len / u, v0 / v], [len / u, (v0 + sy) / v], [0, (v0 + sy) / v]], color);
    };
    if (!skip.f) wall(fl, fr, sx);
    if (!skip.r) wall(fr, br, sz);
    if (!skip.b) wall(br, bl, sx);
    if (!skip.l) wall(bl, fl, sz);
    if (!skip.t) this.quad(P(-hx, y1, hz), P(hx, y1, hz), P(hx, y1, -hz), P(-hx, y1, -hz), [[0, 0], [sx / topU, 0], [sx / topU, sz / topU], [0, sz / topU]], color);
    if (!skip.bt) this.quad(P(-hx, y0, -hz), P(hx, y0, -hz), P(hx, y0, hz), P(-hx, y0, hz), [[0, 0], [1, 0], [1, 1], [0, 1]], color);
  }
  // horizontal rectangle (axis-aligned or rotated) facing up
  plane(cx, y, cz, sx, sz, rot = 0, uvScale = 1, color = [1, 1, 1], uvMode = 'world') {
    const c = Math.cos(rot), s = Math.sin(rot), hx = sx / 2, hz = sz / 2;
    const P = (lx, lz) => [cx + lx * c + lz * s, y, cz - lx * s + lz * c];
    const pts = [P(-hx, hz), P(hx, hz), P(hx, -hz), P(-hx, -hz)];
    let uvs;
    if (uvMode === 'world') uvs = pts.map(p => [p[0] / uvScale, -p[2] / uvScale]);
    else if (uvMode === 'local') uvs = [[0, 0], [sx / uvScale, 0], [sx / uvScale, sz / uvScale], [0, sz / uvScale]];
    else uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
    this.quad(pts[0], pts[1], pts[2], pts[3], uvs, color);
  }
  // merge an existing (indexed or not) BufferGeometry transformed by a Matrix4
  geometry(geom, matrix, color = [1, 1, 1], uvScale = 1) {
    const g = geom.index ? geom : geom;
    const p = g.attributes.position, nrm = g.attributes.normal, uv = g.attributes.uv;
    const nm = new THREE.Matrix3().getNormalMatrix(matrix);
    const v = new THREE.Vector3(), nv = new THREE.Vector3();
    const b = this.n;
    const hasCol = g.attributes.color;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(matrix); this.pos.push(v.x, v.y, v.z);
      if (nrm) { nv.fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize(); this.nor.push(nv.x, nv.y, nv.z); } else this.nor.push(0, 1, 0);
      if (uv) this.uv.push(uv.getX(i) * uvScale, uv.getY(i) * uvScale); else this.uv.push(0, 0);
      if (hasCol) this.col.push(hasCol.getX(i) * color[0], hasCol.getY(i) * color[1], hasCol.getZ(i) * color[2]);
      else this.col.push(color[0], color[1], color[2]);
    }
    if (g.index) { for (let i = 0; i < g.index.count; i++) this.idx.push(b + g.index.getX(i)); }
    else { for (let i = 0; i < p.count; i++) this.idx.push(b + i); }
    this.n += p.count;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

// Builders keyed by material and spatial chunk, so frustum culling still works.
const mul = (a, b) => [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
export class ChunkedBuilders {
  constructor(chunk = 200, alias = {}) { this.chunk = chunk; this.map = new Map(); this.alias = alias; this.tints = new Map(); }
  get(mat, x, z) {
    const al = this.alias[mat];
    if (al) { const b = this._get(al[0], x, z); if (!al[1]) return b; return this.tinted(b, al[1]); }
    return this._get(mat, x, z);
  }
  tinted(b, c) {
    let per = this.tints.get(b); if (!per) { per = new Map(); this.tints.set(b, per); }
    const key = c.join(','); let t = per.get(key); if (t) return t;
    t = {
      quad: (p0, p1, p2, p3, uvs, color = [1, 1, 1]) => b.quad(p0, p1, p2, p3, uvs, mul(color, c)),
      box: (cx, cy, cz, sx, sy, sz, rot = 0, opts = {}) => b.box(cx, cy, cz, sx, sy, sz, rot, { ...opts, color: mul(opts.color || [1, 1, 1], c) }),
      plane: (cx, y, cz, sx, sz, rot = 0, uvScale = 1, color = [1, 1, 1], uvMode = 'world') => b.plane(cx, y, cz, sx, sz, rot, uvScale, mul(color, c), uvMode),
      geometry: (g, m, color = [1, 1, 1], uvScale = 1) => b.geometry(g, m, mul(color, c), uvScale),
    };
    per.set(key, t); return t;
  }
  _get(mat, x, z) {
    const cx = Math.floor(x / this.chunk), cz = Math.floor(z / this.chunk);
    const k = `${mat}|${cx}|${cz}`;
    let b = this.map.get(k); if (!b) { b = new GeoBuilder(); b.mat = mat; this.map.set(k, b); }
    return b;
  }
  toMeshes(materials, { castShadow = true, receiveShadow = true, group } = {}) {
    const out = [];
    for (const b of this.map.values()) {
      if (b.empty) continue;
      const mat = materials[b.mat]; if (!mat) { console.warn('missing material', b.mat); continue; }
      const m = new THREE.Mesh(b.build(), mat);
      const cs = typeof castShadow === 'function' ? castShadow(b.mat) : castShadow;
      m.castShadow = cs; m.receiveShadow = receiveShadow; m.matrixAutoUpdate = false; m.updateMatrix();
      if (group) group.add(m); out.push(m);
    }
    return out;
  }
}

export const hex = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
export const srgbHex = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
