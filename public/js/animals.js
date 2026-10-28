// Campus animals and sky traffic: soi dogs and cats that live around dorms, canteens, markets and the beach, plus the
// occasional airliner crossing the sky. Low-poly instanced meshes (4 draw calls for all animals, 1 for the plane) so the
// cost stays flat; matches the existing art style (vertex-coloured MeshStandardMaterial).
import * as THREE from 'three';
import { SURF } from './collision.js';

const rr = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const DOG_COLS = ['#c9a26b', '#2b2a28', '#e9e4da', '#7a5232', '#b98a52', '#d8c8a8'];
const CAT_COLS = ['#e08a3c', '#8a8580', '#232222', '#efefe9', '#d9a066', '#6d5a48'];

function partGeo(parts) { // [geometry, matrix, [r,g,b]] → merged geometry with vertex colours
  const geos = []; for (const [g, m, c] of parts) { const gg = g.clone().applyMatrix4(m).toNonIndexed(); const n = gg.attributes.position.count; const col = new Float32Array(n * 3); for (let i = 0; i < n; i++) col.set(c, i * 3); gg.setAttribute('color', new THREE.BufferAttribute(col, 3)); gg.deleteAttribute('uv'); geos.push(gg); }
  let len = 0; for (const g of geos) len += g.attributes.position.count; const pos = new Float32Array(len * 3), nor = new Float32Array(len * 3), col = new Float32Array(len * 3); let o = 0;
  for (const g of geos) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3)); return out;
}
const T = (x, y, z, rx = 0, ry = 0, rz = 0, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));
const W = [1, 1, 1], NOSE = [0.08, 0.06, 0.06], EYE = [0.05, 0.05, 0.05], PINK = [0.9, 0.6, 0.6];

function dogBody() {
  return partGeo([
    [new THREE.BoxGeometry(0.3, 0.28, 0.72), T(0, 0.5, 0), W], [new THREE.BoxGeometry(0.24, 0.24, 0.26), T(0, 0.7, 0.42), W],
    [new THREE.BoxGeometry(0.14, 0.12, 0.14), T(0, 0.64, 0.6), W], [new THREE.BoxGeometry(0.06, 0.05, 0.04), T(0, 0.67, 0.68), NOSE],
    [new THREE.ConeGeometry(0.06, 0.14, 4), T(-0.08, 0.88, 0.38, 0, 0, 0.2), W], [new THREE.ConeGeometry(0.06, 0.14, 4), T(0.08, 0.88, 0.38, 0, 0, -0.2), W],
    [new THREE.BoxGeometry(0.03, 0.03, 0.02), T(-0.07, 0.76, 0.55), EYE], [new THREE.BoxGeometry(0.03, 0.03, 0.02), T(0.07, 0.76, 0.55), EYE],
    [new THREE.CylinderGeometry(0.03, 0.04, 0.32, 5), T(0, 0.66, -0.46, -0.9, 0, 0), W],
  ]);
}
function catBody() {
  return partGeo([
    [new THREE.BoxGeometry(0.18, 0.18, 0.44), T(0, 0.3, 0), W], [new THREE.BoxGeometry(0.17, 0.15, 0.15), T(0, 0.42, 0.26), W],
    [new THREE.ConeGeometry(0.045, 0.09, 4), T(-0.05, 0.53, 0.25), W], [new THREE.ConeGeometry(0.045, 0.09, 4), T(0.05, 0.53, 0.25), W],
    [new THREE.BoxGeometry(0.03, 0.02, 0.02), T(0, 0.4, 0.34), PINK], [new THREE.BoxGeometry(0.025, 0.025, 0.02), T(-0.045, 0.45, 0.335), EYE], [new THREE.BoxGeometry(0.025, 0.025, 0.02), T(0.045, 0.45, 0.335), EYE],
    [new THREE.CylinderGeometry(0.02, 0.025, 0.34, 5), T(0, 0.48, -0.3, 0.5, 0, 0), W],
  ]);
}
function legGeo(h, w) { const g = new THREE.BoxGeometry(w, h, w); g.translate(0, -h / 2, 0); return partGeo([[g, new THREE.Matrix4(), W]]); }

export class Animals {
  constructor({ scene, world, audio, player, quality = 'max' }) {
    Object.assign(this, { scene, world, audio, player });
    const mob = quality === 'mobile' || quality === 'low'; this.nDog = mob ? 5 : 8; this.nCat = mob ? 6 : 10;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
    this.dogIM = new THREE.InstancedMesh(dogBody(), mat, this.nDog); this.dogLeg = new THREE.InstancedMesh(legGeo(0.36, 0.07), mat, this.nDog * 4);
    this.catIM = new THREE.InstancedMesh(catBody(), mat, this.nCat); this.catLeg = new THREE.InstancedMesh(legGeo(0.21, 0.045), mat, this.nCat * 4);
    for (const m of [this.dogIM, this.dogLeg, this.catIM, this.catLeg]) { m.castShadow = !mob; m.frustumCulled = false; scene.add(m); }
    // where animals hang out: dorms, canteens, markets, mini-marts, the temple pavilion, condos, the beach
    const kinds = ['dorm', 'cafeteria', 'foodstreet', 'market', 'mart', 'pavilion', 'condo', 'seafood', 'noodle', 'residence'];
    this.anchors = Object.values(world.places).filter(p => kinds.includes(p.kind) && p._door).map(p => ({ x: p._door.x, z: p._door.z }));
    this.list = [];
    for (let i = 0; i < this.nDog; i++) this.list.push(this.make('dog', i, pick(DOG_COLS)));
    for (let i = 0; i < this.nCat; i++) this.list.push(this.make('cat', i, pick(CAT_COLS)));
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.one = new THREE.Vector3(1, 1, 1); this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
    this.reloc = 0; this.plane = this.buildPlane(); this.planeT = rr(40, 90);
  }
  make(kind, i, col) {
    const a = { kind, i, x: 0, z: 0, h: Math.random() * 6.28, state: 'idle', t: rr(1, 4), tx: 0, tz: 0, phase: Math.random() * 6, speed: 0, home: null, bark: 0, far: true };
    (kind === 'dog' ? this.dogIM : this.catIM).setColorAt(i, new THREE.Color(col));
    for (let k = 0; k < 4; k++) (kind === 'dog' ? this.dogLeg : this.catLeg).setColorAt(i * 4 + k, new THREE.Color(col).multiplyScalar(0.92));
    return a;
  }
  spot(cx, cz, r) { const col = this.world.col; for (let k = 0; k < 12; k++) { const x = cx + rr(-r, r), z = cz + rr(-r, r); const s = col.surfAt(x, z); if (s !== SURF.BUILDING && s !== SURF.WATER && s !== SURF.POOL && s !== SURF.ROAD && !col.blocked(x, z, 0.4)) return [x, z]; } return null; }
  place(a) {
    const p = this.player.pos; const near = this.anchors.filter(h => { const d = Math.hypot(h.x - p.x, h.z - p.z); return d > 25 && d < 170; });
    const h = near.length ? pick(near) : pick(this.anchors); if (!h) return; const s = this.spot(h.x, h.z, 14); if (!s) return;
    a.home = h; a.x = s[0]; a.z = s[1]; a.state = Math.random() < 0.5 ? 'idle' : 'sit'; a.t = rr(2, 8); a.far = false;
  }
  update(dt, hour) {
    const p = this.player.pos, run = this.player.speed > 4.5 && !this.player.vehicle;
    this.reloc -= dt; const doReloc = this.reloc <= 0; if (doReloc) this.reloc = 2;
    for (const a of this.list) {
      const d = Math.hypot(a.x - p.x, a.z - p.z);
      if (doReloc && (a.far || d > 210)) { this.place(a); continue; }
      a.t -= dt;
      if (a.state === 'walk') {
        const dx = a.tx - a.x, dz = a.tz - a.z, dd = Math.hypot(dx, dz);
        if (dd < 0.3 || a.t <= 0) { a.state = a.kind === 'cat' ? pick(['sit', 'idle', 'sleep']) : pick(['idle', 'sit', 'sleep', 'idle']); a.t = rr(3, 12); a.speed = 0; }
        else { const th = Math.atan2(dx, dz); let dh = th - a.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); a.h += dh * Math.min(1, dt * 5); const sp = a.kind === 'dog' ? (a.flee ? 3.2 : 1.3) : (a.flee ? 3.6 : 0.8); const nx = a.x + Math.sin(a.h) * sp * dt, nz = a.z + Math.cos(a.h) * sp * dt; if (!this.world.col.blocked(nx, nz, 0.3)) { a.x = nx; a.z = nz; a.speed = sp; } else { a.t = 0; } }
      } else if (a.t <= 0) { const s = this.spot(a.home ? a.home.x : a.x, a.home ? a.home.z : a.z, 14); if (s) { a.tx = s[0]; a.tz = s[1]; a.state = 'walk'; a.flee = false; a.t = 20; } else a.t = 3; }
      // cats dash away from a running player; dogs bark at runners and get curious
      if (d < 4 && run && a.kind === 'cat' && !a.flee) { const ang = Math.atan2(a.x - p.x, a.z - p.z); a.tx = a.x + Math.sin(ang) * 9; a.tz = a.z + Math.cos(ang) * 9; a.state = 'walk'; a.flee = true; a.t = 4; if (Math.random() < 0.5) this.audio.animal3D && this.audio.animal3D(a.x, 0.4, a.z, 'hiss'); }
      a.bark -= dt; if (a.kind === 'dog' && d < 14 && a.bark <= 0 && (run || Math.random() < 0.004)) { a.bark = rr(6, 14); if (this.audio.animal3D) this.audio.animal3D(a.x, 0.7, a.z, 'bark'); if (run && d < 8) { a.state = 'idle'; a.t = 2; a.h = Math.atan2(p.x - a.x, p.z - a.z); } }
      if (a.kind === 'cat' && d < 18 && Math.random() < 0.0015 && this.audio.animal3D) this.audio.animal3D(a.x, 0.4, a.z, 'meow');
      a.phase += dt * (a.speed > 0 ? a.speed * (a.kind === 'dog' ? 6 : 9) : 0);
      this.pose(a, d);
    }
    for (const m of [this.dogIM, this.dogLeg, this.catIM, this.catLeg]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = false; }
    this.updatePlane(dt);
  }
  pose(a, d) {
    const body = a.kind === 'dog' ? this.dogIM : this.catIM, legs = a.kind === 'dog' ? this.dogLeg : this.catLeg;
    if (d > 150 || a.far) { body.setMatrixAt(a.i, this.zero); for (let k = 0; k < 4; k++) legs.setMatrixAt(a.i * 4 + k, this.zero); return; }
    const y = this.world.heightAt(a.x, a.z); const dog = a.kind === 'dog';
    const sit = a.state === 'sit', sleep = a.state === 'sleep'; const drop = sleep ? (dog ? 0.34 : 0.19) : sit ? (dog ? 0.12 : 0.06) : 0; const pitch = sit ? -0.35 : 0;
    this.e.set(pitch, a.h, sleep ? 0.0 : 0); this.q.setFromEuler(this.e); this.v.set(a.x, y - drop, a.z); this.m4.compose(this.v, this.q, this.one); body.setMatrixAt(a.i, this.m4);
    const lx = dog ? 0.1 : 0.06, lzF = dog ? 0.26 : 0.15, lzB = dog ? -0.26 : -0.15, ly = dog ? 0.38 : 0.23; const s = Math.sin(a.phase) * (a.speed > 0 ? 0.6 : 0);
    const L = [[-lx, lzF, s], [lx, lzF, -s], [-lx, lzB, -s], [lx, lzB, s]];
    const c = Math.cos(a.h), sn = Math.sin(a.h);
    for (let k = 0; k < 4; k++) {
      const [ox, oz, sw] = L[k]; const fold = sleep ? 1.4 : sit && oz < 0 ? 1.2 : 0;
      this.e.set(sw + (fold ? (oz < 0 ? -fold : fold * 0.2) : 0), a.h, 0); this.q.setFromEuler(this.e);
      this.v.set(a.x + ox * c + oz * sn, y + ly - drop * (oz < 0 || sleep ? 1 : 0.4), a.z - ox * sn + oz * c); this.m4.compose(this.v, this.q, this.one); legs.setMatrixAt(a.i * 4 + k, this.m4);
    }
  }
  // ---------------- airliner crossing the sky ----------------
  buildPlane() {
    const white = [0.94, 0.95, 0.96], blue = [0.12, 0.3, 0.6], grey = [0.6, 0.62, 0.66];
    const g = partGeo([
      [new THREE.CylinderGeometry(1.9, 1.9, 38, 10).rotateX(Math.PI / 2), new THREE.Matrix4(), white], [new THREE.ConeGeometry(1.9, 5, 10).rotateX(Math.PI / 2), T(0, 0, 21.5), white], [new THREE.ConeGeometry(1.9, 7, 10).rotateX(-Math.PI / 2), T(0, 0.4, -22.5), white],
      [new THREE.BoxGeometry(34, 0.5, 6), T(0, -0.6, 1), grey], [new THREE.BoxGeometry(12, 0.4, 3), T(0, 0.6, -21), grey], [new THREE.BoxGeometry(0.4, 6, 4), T(0, 3.6, -21.5), blue],
      [new THREE.CylinderGeometry(1, 1, 4, 8).rotateX(Math.PI / 2), T(-8, -1.8, 3), grey], [new THREE.CylinderGeometry(1, 1, 4, 8).rotateX(Math.PI / 2), T(8, -1.8, 3), grey], [new THREE.BoxGeometry(3.86, 0.6, 30), T(0, 0.2, 0), blue],
    ]);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.2 })); m.visible = false; m.frustumCulled = false; this.scene.add(m);
    return { mesh: m, on: false, x: 0, z: 0, y: 0, h: 0, sp: 0, t: 0, snd: null };
  }
  updatePlane(dt) {
    const P = this.plane, p = this.player.pos;
    if (!P.on) { this.planeT -= dt; if (this.planeT > 0) return; this.planeT = rr(110, 240); P.on = true; P.h = Math.random() * Math.PI * 2; P.y = rr(650, 950); P.sp = rr(105, 125); const off = rr(-500, 500); P.x = p.x - Math.sin(P.h) * 2600 + Math.cos(P.h) * off; P.z = p.z - Math.cos(P.h) * 2600 - Math.sin(P.h) * off; P.t = 0; P.mesh.visible = true; P.snd = this.audio.jet3D ? this.audio.jet3D() : null; }
    P.x += Math.sin(P.h) * P.sp * dt; P.z += Math.cos(P.h) * P.sp * dt; P.t += dt;
    P.mesh.position.set(P.x, P.y, P.z); P.mesh.rotation.set(0, P.h, 0);
    if (P.snd) P.snd.update(P.x, P.y, P.z, P.sp, P.h);
    if (P.t > 5400 / P.sp) { P.on = false; P.mesh.visible = false; if (P.snd) { P.snd.stop(); P.snd = null; } }
  }
}
