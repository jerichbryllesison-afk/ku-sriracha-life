// AI traffic on the real road graph (keep-left, Thailand). Rendered with one InstancedMesh per car type.
import * as THREE from 'three';
import { carGeometry, motoGeometry } from './vehicle-models.js';
import { edgePoint } from './roadnet.js';
import { GeoBuilder } from './geo.js';

const TYPES = [
  { key: 'hatch', geo: () => carGeometry('hatch'), r: 1.0, len: 4, w: 3 },
  { key: 'sedan', geo: () => carGeometry('sedan'), r: 1.05, len: 4.7, w: 2 },
  { key: 'pickup', geo: () => carGeometry('pickup'), r: 1.1, len: 5.2, w: 3 },
  { key: 'songthaew', geo: () => carGeometry('songthaew'), r: 1.1, len: 5.2, w: 1.2 },
  { key: 'taxi', geo: () => carGeometry('taxi'), r: 1.05, len: 4.7, w: 0.8 },
  { key: 'moto', geo: () => motoGeometry('wave'), r: 0.5, len: 1.9, w: 9 },
];
const PAL = ['#e6e6e6', '#111111', '#7f8c8d', '#c0392b', '#2c3e50', '#bdc3c7', '#2980b9', '#8e2b20', '#f5f5f0', '#34495e', '#d35400'];
const TAXI_PAL = ['#e6519b', '#f1c40f', '#27ae60', '#2980b9', '#e67e22'];

function trafficMaterial() {
  const m = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.45, clearcoat: 1, clearcoatRoughness: 0.14 });
  m.userData.night = { value: 0 };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = m.userData.night;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGeoCol;').replace('#include <color_vertex>', '#include <color_vertex>\nvGeoCol = color.rgb;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uNight; varying vec3 vGeoCol;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nif (vGeoCol.r > 0.99 && vGeoCol.b > 0.8 && vGeoCol.b < 0.9) totalEmissiveRadiance += vec3(1.0, 0.95, 0.8) * uNight * 3.0;\nif (vGeoCol.r > 0.6 && vGeoCol.g < 0.1) totalEmissiveRadiance += vec3(1.0, 0.05, 0.02) * (0.3 + uNight * 2.0);');
  };
  return m;
}

export class Traffic {
  constructor(world, scene, max = 24) {
    this.world = world; this.net = world.net; this.max = max; this.cars = []; this.mat = trafficMaterial();
    this.edges = this.net.edges.filter(e => e.w >= 5.5 && e.len > 25);
    this.meshes = TYPES.map(t => { const im = new THREE.InstancedMesh(t.geo(), this.mat, max); im.count = 0; im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; scene.add(im); return im; });
    this.tmp = {}; this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(0, 0, 0, 'YXZ'); this.v = new THREE.Vector3(); this.s = new THREE.Vector3(1, 1, 1); this.c = new THREE.Color();
    this.spawnTimer = 0;
    // seated riders for motorbikes (one instanced mesh, tinted per rider)
    const rg = new GeoBuilder(); const legs = [0.16, 0.18, 0.28], skin = [0.75, 0.55, 0.42];
    rg.box(0, 0.86, -0.22, 0.32, 0.18, 0.26, 0, { color: legs });
    for (const s of [-1, 1]) { rg.box(s * 0.12, 0.84, 0.02, 0.13, 0.13, 0.42, 0, { color: legs }); rg.box(s * 0.15, 0.58, 0.22, 0.11, 0.46, 0.12, 0, { color: legs }); rg.box(s * 0.15, 0.36, 0.3, 0.12, 0.08, 0.22, 0, { color: [0.12, 0.12, 0.12] });
      const arm = new THREE.Matrix4().makeRotationX(-0.75).premultiply(new THREE.Matrix4().makeTranslation(s * 0.23, 1.16, 0.08)); rg.geometry(new THREE.BoxGeometry(0.09, 0.09, 0.5), arm, [1, 1, 1]);
      rg.box(s * 0.27, 0.99, 0.33, 0.08, 0.08, 0.08, 0, { color: skin }); }
    rg.box(0, 1.14, -0.17, 0.36, 0.5, 0.22, 0, { color: [1, 1, 1] });
    rg.geometry(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 8), new THREE.Matrix4().makeTranslation(0, 1.42, -0.15), skin);
    rg.geometry(new THREE.SphereGeometry(0.155, 12, 9), new THREE.Matrix4().makeTranslation(0, 1.56, -0.14), [0.92, 0.92, 0.92]);
    rg.box(0, 1.55, -0.01, 0.2, 0.07, 0.04, 0, { color: [0.08, 0.08, 0.1] });
    this.riders = new THREE.InstancedMesh(rg.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }), max); this.riders.count = 0; this.riders.castShadow = true; this.riders.frustumCulled = false; scene.add(this.riders);
    this.RIDER_PAL = ['#ffffff', '#1f5fbf', '#c4262e', '#2f9a5a', '#f2c230', '#6b4aa8', '#e67e22', '#9aa3ab', '#0d6b52'].map(c => new THREE.Color(c));
  }
  pickType() { const tot = TYPES.reduce((a, t) => a + t.w, 0); let r = Math.random() * tot; for (let i = 0; i < TYPES.length; i++) { r -= TYPES[i].w; if (r <= 0) return i; } return 0; }
  spawn(px, pz, near = false) {
    // choose an edge 80–320 m away (or anywhere close when near)
    for (let tries = 0; tries < 30; tries++) {
      const e = this.edges[(Math.random() * this.edges.length) | 0];
      const s = e.trim0 + 3 + Math.random() * Math.max(1, e.len - e.trim0 - e.trim1 - 6);
      const p = edgePoint(e, s, 0, {}); const d = Math.hypot(p.x - px, p.z - pz);
      if (d < (near ? 40 : 90) || d > 330) continue;
      const dir = Math.random() < 0.5 ? 1 : -1; const lane = (Math.random() * e.perDir) | 0;
      const ti = this.pickType(); const T = TYPES[ti];
      const color = T.key === 'taxi' ? TAXI_PAL[(Math.random() * TAXI_PAL.length) | 0] : T.key === 'songthaew' ? '#b81d24' : PAL[(Math.random() * PAL.length) | 0];
      const car = { e, s, dir, lane, ti, r: T.r, speed: 0, target: 0, color: new THREE.Color(color), x: p.x, z: p.z, y: 0, h: Math.atan2(p.tx * dir, p.tz * dir), turn: null, stuck: 0, honk: 0, len: T.len, next: null, vTurn: 99, pitch: 0, acc: 0, drv: 0.9 + Math.random() * 0.2, moto: ti === 5, rider: this.RIDER_PAL[(Math.random() * this.RIDER_PAL.length) | 0] };
      if (this.cars.some(c => Math.hypot(c.x - p.x, c.z - p.z) < 12)) continue;
      this.cars.push(car); return car;
    }
    return null;
  }
  // keep-left; motorbikes ride the left edge of the outer lane (as in Thailand), cars use their lane centre
  laneLat(car) { const e = car.e; if (car.moto || (car.ti === 5)) return car.dir * (e.median / 2 + e.perDir * e.laneW - 0.9); return car.dir * (e.median / 2 + (Math.min(car.lane, e.perDir - 1) + 0.5) * e.laneW); }
  speedLimit(e) { return e.w >= 30 ? 19 : e.w >= 11 ? 14 : e.campus ? 8 : 11; }
  update(dt, focus, playerVeh, playerPos, night) {
    this.mat.userData.night.value = night;
    // spawn / despawn
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.5;
      if (this.cars.length < this.max) this.spawn(focus.x, focus.z, this.cars.length < this.max / 3);
      this.cars = this.cars.filter(c => Math.hypot(c.x - focus.x, c.z - focus.z) < 420);
    }
    const P = this.tmp;
    for (const car of this.cars) {
      const e = car.e;
      // Intelligent Driver Model (Treiber): smooth car-following with a comfortable gap, plus curve anticipation
      const v0 = this.speedLimit(e) * car.drv * (car.moto ? 1.08 : 1);
      const fx = Math.sin(car.h), fz = Math.cos(car.h);
      let gap = 1e9, vl = 0;
      for (const o of this.cars) {
        if (o === car) continue; const dx = o.x - car.x, dz = o.z - car.z; const ahead = dx * fx + dz * fz; if (ahead <= 0 || ahead > 45) continue;
        const side = Math.abs(dx * fz - dz * fx); if (side > (car.moto || o.moto ? 1.3 : 2.1)) continue;
        const g = ahead - (o.len + car.len) / 2; if (g < gap) { gap = g; vl = o.speed * Math.max(0, Math.sin(o.h) * fx + Math.cos(o.h) * fz); }
      }
      const obst = [];
      if (playerVeh) obst.push([playerVeh.x, playerVeh.z, playerVeh.moto ? 0.6 : 1.4, Math.abs(playerVeh.speed || 0)]);
      if (playerPos) obst.push([playerPos.x, playerPos.z, 0.6, 0]);
      let byPlayer = false;
      for (const [ox, oz, orr, ov] of obst) { const dx = ox - car.x, dz = oz - car.z; const ahead = dx * fx + dz * fz; if (ahead <= 0 || ahead > 30) continue; const side = Math.abs(dx * fz - dz * fx); if (side < 1.6 + orr) { const g = ahead - car.len / 2 - orr; if (g < gap) { gap = g; vl = ov; byPlayer = true; } } }
      // horn decisions (drivers honk for a reason, not at random): time-to-collision with the player / player vehicle,
      // being blocked by them, a sudden cut-in, or a long jam — each with probability, per-car cooldown and a global gap
      car.hornCd = Math.max(0, (car.hornCd || 0) - dt);
      if (this.onHonk && car.hornCd <= 0 && gap < 1e8) {
        const closing = car.speed - vl, ttc = closing > 0.5 ? gap / closing : 99; let style = null, p = 0;
        if (byPlayer && car.speed > 3 && ttc < 2.2 && gap < 16) { style = 'warn'; p = 0.85; }
        else if (byPlayer && car.speed < 0.5 && gap < 8) { car.blockT = (car.blockT || 0) + dt; if (car.blockT > 3.5) { style = 'annoyed'; p = 0.6; car.blockT = 0; } }
        else if (!byPlayer && gap < 5 && closing > 3) { style = 'warn'; p = 0.45; }
        else if (!byPlayer && car.stuck > 8) { style = 'annoyed'; p = 0.25; }
        if (!byPlayer || car.speed >= 0.5) car.blockT = 0;
        if (style) { car.hornCd = 6 + Math.random() * 6; const now = performance.now(); if (Math.random() < p && now - (this.lastHonk || 0) > 1200) { this.lastHonk = now; this.onHonk(car, style); } }
      }
      const aMax = car.moto ? 2.6 : 1.8, bComf = 2.4, T = car.moto ? 1.0 : 1.4, s0 = car.moto ? 1.5 : 2.2, v = car.speed;
      let acc = aMax * (1 - Math.pow(v / Math.max(1, v0), 4));
      if (gap < 1e8) { const sStar = s0 + Math.max(0, v * T + v * (v - vl) / (2 * Math.sqrt(aMax * bComf))); acc -= aMax * Math.pow(sStar / Math.max(0.3, gap), 2); }
      // pick the next road early and slow for the bend: v_allowed = sqrt(v_turn² + 2·b·d)
      if (!car.turn) {
        const endS = car.dir > 0 ? e.len - e.trim1 : e.trim0; const dEnd = Math.abs(endS - car.s);
        if (!car.next && dEnd < 50) {
          const node = car.dir > 0 ? e.n1 : e.n0; const opts = node.edges.filter(x => x.e !== e && x.e.w >= 5.5);
          car.next = opts.length ? opts[(Math.random() * opts.length) | 0] : { e, end: car.dir > 0 ? 1 : 0 };
          const t0 = edgePoint(e, endS, 0, {}); const ne = car.next.e, nd = car.next.end === 0 ? 1 : -1; const t1 = edgePoint(ne, nd > 0 ? ne.trim0 + 0.5 : ne.len - ne.trim1 - 0.5, 0, {});
          const ax = t0.tx * car.dir, az = t0.tz * car.dir, bx = t1.tx * nd, bz = t1.tz * nd; const ang = Math.acos(Math.max(-1, Math.min(1, ax * bx + az * bz)));
          car.vTurn = ang < 0.25 ? 99 : Math.max(3.0, Math.min(13, 3.5 + 8.5 * (1 - ang / Math.PI)));
        }
        if (car.next && car.vTurn < 99) { const allowed = Math.sqrt(car.vTurn * car.vTurn + 2 * 1.8 * Math.max(0, dEnd - 2)); if (v > allowed) acc = Math.min(acc, -(v - allowed) * 1.5 - 0.5); }
      } else if (v > car.vTurn) acc = Math.min(acc, -1.5);
      acc = Math.max(-7, Math.min(aMax, acc));
      car.acc = acc; car.speed = Math.max(0, v + acc * dt);
      if (car.speed < 0.2 && gap < 6) car.stuck += dt; else car.stuck = Math.max(0, car.stuck - dt);
      if (car.stuck > 25) { car.dead = true; continue; }
      // move
      if (car.turn) {
        const t = car.turn; t.t += car.speed * dt / t.len;
        const u = Math.min(1, t.t); const a = 1 - u;
        const x = a * a * t.p0[0] + 2 * a * u * t.c[0] + u * u * t.p1[0], z = a * a * t.p0[1] + 2 * a * u * t.c[1] + u * u * t.p1[1];
        const dx = x - car.x, dz = z - car.z; if (dx * dx + dz * dz > 1e-6) car.h = Math.atan2(dx, dz);
        car.x = x; car.z = z;
        if (u >= 1) { car.e = t.e; car.dir = t.dir; car.s = t.dir > 0 ? t.e.trim0 : t.e.len - t.e.trim1; car.turn = null; car.vTurn = 99; }
      } else {
        car.s += car.dir * car.speed * dt;
        const endS = car.dir > 0 ? e.len - e.trim1 : e.trim0;
        if ((car.dir > 0 && car.s >= endS) || (car.dir < 0 && car.s <= endS)) {
          car.s = endS;
          const node = car.dir > 0 ? e.n1 : e.n0;
          const opts = node.edges.filter(x => x.e !== e && x.e.w >= 5.5);
          let nxt = car.next || (opts.length ? opts[(Math.random() * opts.length) | 0] : { e, end: car.dir > 0 ? 1 : 0 }); car.next = null;
          const ne = nxt.e; const ndir = nxt.end === 0 ? 1 : -1;
          const p0 = edgePoint(e, car.s, this.laneLat(car), {});
          const tmpCar = { e: ne, dir: ndir, lane: car.lane, moto: car.moto, ti: car.ti };
          const ns = ndir > 0 ? ne.trim0 : ne.len - ne.trim1;
          const p1 = edgePoint(ne, ns, this.laneLat(tmpCar), {});
          const c = [node.x, node.z];
          const len = Math.hypot(p1.x - p0.x, p1.z - p0.z) * 1.15 + 0.5;
          car.turn = { p0: [p0.x, p0.z], p1: [p1.x, p1.z], c: [(c[0] * 2 + p0.x + p1.x) / 4, (c[1] * 2 + p0.z + p1.z) / 4], t: 0, len, e: ne, dir: ndir };
        } else {
          const p = edgePoint(e, car.s, this.laneLat(car), P);
          car.x = p.x; car.z = p.z; const th = Math.atan2(p.tx * car.dir, p.tz * car.dir);
          let dh = th - car.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); car.h += dh * Math.min(1, dt * 8);
        }
      }
      car.y = this.world.heightAt(car.x, car.z);
    }
    this.cars = this.cars.filter(c => !c.dead);
    // write instances
    const counts = new Array(TYPES.length).fill(0); let nr = 0;
    for (const car of this.cars) {
      const im = this.meshes[car.ti]; const i = counts[car.ti]++;
      car.pitch += ((-car.acc * (car.moto ? 0.004 : 0.007)) - car.pitch) * Math.min(1, dt * 4); // body squat / dive
      const roll = car.turn ? 0 : 0; this.e.set(car.pitch, car.h, roll); this.q.setFromEuler(this.e); this.v.set(car.x, car.y, car.z); this.m4.compose(this.v, this.q, this.s);
      im.setMatrixAt(i, this.m4); im.setColorAt(i, car.color);
      if (car.moto) { this.riders.setMatrixAt(nr, this.m4); this.riders.setColorAt(nr, car.rider); nr++; }
    }
    this.meshes.forEach((im, k) => { im.count = counts[k]; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; });
    this.riders.count = nr; this.riders.instanceMatrix.needsUpdate = true; if (this.riders.instanceColor) this.riders.instanceColor.needsUpdate = true;
  }
  // colliders for player vehicle interaction
  colliders() { return this.cars.map(c => ({ x: c.x, z: c.z, r: c.r * 1.3, car: c, circles: () => [[c.x + Math.sin(c.h) * c.len * 0.25, c.z + Math.cos(c.h) * c.len * 0.25, c.r], [c.x - Math.sin(c.h) * c.len * 0.25, c.z - Math.cos(c.h) * c.len * 0.25, c.r]], bump(dx, dz) { c.speed *= 0.5; } })); }
}
