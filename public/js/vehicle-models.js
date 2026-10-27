// Procedural vehicle models (forward = +Z). Body parts are vertex-coloured white so paint can be applied.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GeoBuilder } from './geo.js';

const W = [1, 1, 1];
const GLASS = [0.06, 0.08, 0.1], TIRE = [0.05, 0.05, 0.055], CHROME = [0.72, 0.73, 0.75], DARK = [0.12, 0.12, 0.13], LIGHT = [1.0, 0.97, 0.85], TAIL = [0.75, 0.04, 0.04], SEAT = [0.08, 0.07, 0.07], GREY = [0.35, 0.35, 0.37], PLATE = [0.95, 0.95, 0.92], ORANGE = [1, 0.55, 0.05];
const M = (x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)); m.setPosition(x, y, z); return m; };
let LO = false;
const rbox = (w, h, d, r = 0.12) => LO ? new THREE.BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01));
const cyl = (r1, r2, h, s = 12) => new THREE.CylinderGeometry(r1, r2, h, LO ? Math.min(s, 6) : s, 1, LO);

function wheelGeo(r, w, spokes = false) {
  const gb = new GeoBuilder();
  if (spokes) {
    gb.geometry(new THREE.TorusGeometry(r - 0.025, 0.028, 6, 24).rotateY(Math.PI / 2), new THREE.Matrix4(), TIRE);
    gb.geometry(new THREE.TorusGeometry(r - 0.06, 0.012, 4, 24).rotateY(Math.PI / 2), new THREE.Matrix4(), CHROME);
    gb.geometry(cyl(0.035, 0.035, 0.1, 8).rotateZ(Math.PI / 2), new THREE.Matrix4(), GREY);
    for (let i = 0; i < 8; i++) gb.geometry(new THREE.BoxGeometry(0.008, r * 1.85, 0.008).rotateX(i / 8 * Math.PI), new THREE.Matrix4(), CHROME);
    return gb.build();
  }
  gb.geometry(new THREE.CylinderGeometry(r, r, w, LO ? 10 : 18).rotateZ(Math.PI / 2), new THREE.Matrix4(), TIRE);
  if (!LO) gb.geometry(cyl(r * 0.62, r * 0.62, w + 0.02, 14).rotateZ(Math.PI / 2), new THREE.Matrix4(), CHROME);
  if (spokes) for (let i = 0; i < 6; i++) gb.geometry(new THREE.BoxGeometry(0.02, r * 1.7, 0.02).rotateX(i / 6 * Math.PI), new THREE.Matrix4(), CHROME);
  return gb.build();
}

// Car-like vehicles. returns { body: GeoBuilder (paint), trim: GeoBuilder, wheels: [{x,y,z,r,front}], seat:{x,y,z}, dims }
function carParts(type) {
  const body = new GeoBuilder(), trim = new GeoBuilder();
  const S = {
    hatch: { L: 3.95, Wd: 1.72, H: 0.62, by: 0.66, cab: [1.56, 0.62, 2.1, -0.3], wr: 0.31, wz: 1.25, wx: 0.76 },
    sedan: { L: 4.75, Wd: 1.82, H: 0.6, by: 0.66, cab: [1.6, 0.58, 2.4, -0.15], wr: 0.33, wz: 1.5, wx: 0.8 },
    pickup: { L: 5.2, Wd: 1.85, H: 0.78, by: 0.92, cab: [1.66, 0.72, 1.9, 0.75], wr: 0.4, wz: 1.6, wx: 0.82 },
    super: { L: 4.5, Wd: 1.98, H: 0.5, by: 0.52, cab: [1.5, 0.45, 1.8, -0.2], wr: 0.34, wz: 1.42, wx: 0.86 },
    songthaew: { L: 5.2, Wd: 1.85, H: 0.78, by: 0.92, cab: [1.66, 0.72, 1.6, 1.25], wr: 0.4, wz: 1.6, wx: 0.82 },
    taxi: { L: 4.75, Wd: 1.82, H: 0.6, by: 0.66, cab: [1.6, 0.58, 2.4, -0.15], wr: 0.33, wz: 1.5, wx: 0.8 },
  }[type];
  const { L, Wd, H, by, cab, wr, wz, wx } = S;
  body.geometry(rbox(Wd, H, L, 0.16), M(0, by, 0));
  // hood / trunk subtle slopes
  if (type === 'super') { body.geometry(rbox(Wd * 0.96, 0.18, L * 0.32, 0.08), M(0, by + H / 2 + 0.02, L * 0.3, -0.12)); }
  const [cw, ch, cl, cz] = cab; const cy = by + H / 2 + ch / 2 - 0.02;
  trim.geometry(rbox(cw, ch, cl, 0.14), M(0, cy, cz), GLASS);
  body.geometry(rbox(cw * 0.98, 0.07, cl * 0.82, 0.03), M(0, cy + ch / 2 + 0.01, cz - cl * 0.03));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) body.geometry(new THREE.BoxGeometry(0.07, ch * 0.98, 0.09), M(sx * (cw / 2 - 0.03), cy, cz + sz * (cl / 2 - 0.12), sz * -0.35));
  for (const sx of [-1, 1]) body.geometry(new THREE.BoxGeometry(0.06, ch * 0.9, 0.08), M(sx * (cw / 2 - 0.02), cy, cz));
  // bumpers, grille, lights
  trim.geometry(rbox(Wd * 0.98, 0.22, 0.22, 0.08), M(0, by - H / 2 + 0.16, L / 2 - 0.05), DARK);
  trim.geometry(rbox(Wd * 0.98, 0.22, 0.22, 0.08), M(0, by - H / 2 + 0.16, -L / 2 + 0.05), DARK);
  trim.box(0, by + 0.02, L / 2 + 0.005, Wd * 0.42, 0.16, 0.04, 0, { color: DARK });
  for (const sx of [-1, 1]) {
    trim.box(sx * Wd * 0.33, by + 0.12, L / 2 - 0.02, Wd * 0.22, 0.12, 0.08, 0, { color: LIGHT });
    trim.box(sx * Wd * 0.36, by + 0.12, -L / 2 + 0.02, Wd * 0.2, 0.12, 0.08, 0, { color: TAIL });
    trim.box(sx * (Wd / 2 + 0.06), cy - ch / 2 + 0.06, cz + cl / 2 - 0.15, 0.12, 0.09, 0.16, 0, { color: DARK });
  }
  trim.box(0, by - 0.12, L / 2 + 0.07, 0.42, 0.13, 0.02, 0, { color: PLATE }); trim.box(0, by - 0.05, -L / 2 - 0.07, 0.42, 0.13, 0.02, 0, { color: PLATE });
  // wheel arches (dark)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) trim.geometry(cyl(wr + 0.05, wr + 0.05, 0.08, 14, 1).rotateZ(Math.PI / 2), M(sx * (Wd / 2 - 0.02), wr, sz * wz), DARK);
  if (type === 'pickup' || type === 'songthaew') {
    // open bed
    const bedL = L * 0.42, bz = -L / 2 + bedL / 2 + 0.05;
    trim.box(0, by + H / 2 + 0.01, bz, Wd * 0.9, 0.03, bedL, 0, { color: DARK });
    for (const sx of [-1, 1]) body.box(sx * (Wd / 2 - 0.04), by + H / 2 + 0.22, bz, 0.08, 0.45, bedL);
    body.box(0, by + H / 2 + 0.22, -L / 2 + 0.06, Wd, 0.45, 0.08);
    if (type === 'songthaew') {
      body.box(0, by + H / 2 + 1.55, bz - 0.05, Wd + 0.04, 0.08, bedL + 0.3);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) trim.box(sx * (Wd / 2 - 0.02), by + H / 2 + 0.85, bz + sz * (bedL / 2), 0.05, 1.4, 0.05, 0, { color: CHROME });
      for (const sx of [-1, 1]) trim.box(sx * (Wd / 2 - 0.3), by + H / 2 + 0.25, bz, 0.4, 0.06, bedL - 0.2, 0, { color: SEAT });
    }
  }
  if (type === 'super') body.box(0, by + H / 2 + 0.28, -L / 2 + 0.2, Wd * 0.9, 0.05, 0.35); // spoiler
  if (type === 'taxi') trim.box(0, cy + ch / 2 + 0.14, cz, 0.6, 0.16, 0.25, 0, { color: [1, 0.85, 0.1] });
  const wheels = []; for (const sx of [-1, 1]) for (const sz of [1, -1]) wheels.push({ x: sx * wx, y: wr, z: sz * wz, r: wr, front: sz > 0 });
  return { body, trim, wheels, wheelGeo: wheelGeo(wr, 0.24), seat: { x: type === 'pickup' || type === 'songthaew' ? -0.38 : -0.38, y: by + 0.05, z: cz + cl * 0.12 }, dims: { L, W: Wd, H: cy + ch / 2 } };
}

function motoParts(type) {
  const body = new GeoBuilder(), trim = new GeoBuilder();
  const bike = type === 'bicycle';
  const wr = bike ? 0.34 : type === 'sport' ? 0.31 : type === 'click' ? 0.26 : 0.29;
  const fz = bike ? 0.55 : 0.68, rz = bike ? -0.5 : -0.62;
  if (bike) {
    const tube = (x0, y0, z0, x1, y1, z1, r = 0.025, c = W) => { const a = new THREE.Vector3(x0, y0, z0), b = new THREE.Vector3(x1, y1, z1); const L = a.distanceTo(b); const g = cyl(r, r, L, 6); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)); (c === W ? body : trim).geometry(g, m, c); };
    tube(0, wr, rz, 0, 0.62, -0.18); tube(0, 0.62, -0.18, 0, 0.85, 0.36); tube(0, wr, rz, 0, 0.78, -0.12); tube(0, 0.62, -0.18, 0, wr, fz - 0.05, 0.025); tube(0, 0.85, 0.36, 0, wr, fz, 0.022, CHROME); tube(0, 0.78, -0.12, 0, 0.92, -0.2, 0.02, CHROME);
    trim.box(0, 0.95, -0.2, 0.14, 0.05, 0.26, 0, { color: SEAT });
    tube(-0.28, 1.0, 0.36, 0.28, 1.0, 0.36, 0.018, CHROME); tube(0, 0.85, 0.36, 0, 1.0, 0.36, 0.02, CHROME);
    trim.box(0, 0.9, 0.62, 0.34, 0.22, 0.26, 0, { color: [0.15, 0.15, 0.15] }); // basket
    trim.box(0, 0.9, 0.5, 0.06, 0.06, 0.05, 0, { color: LIGHT });
  } else {
    if (type === 'sport') {
      body.geometry(rbox(0.42, 0.5, 1.15, 0.12), M(0, 0.78, 0.12, 0.12));
      body.geometry(rbox(0.36, 0.26, 0.55, 0.1), M(0, 0.98, 0.05));
      trim.box(0, 0.98, -0.42, 0.26, 0.1, 0.6, 0, { color: SEAT });
      body.geometry(rbox(0.25, 0.14, 0.5, 0.06), M(0, 1.02, -0.78, -0.25));
      trim.geometry(cyl(0.05, 0.06, 0.6).rotateX(Math.PI / 2 - 0.3), M(0.18, 0.5, -0.55), CHROME);
      trim.box(0, 1.08, 0.52, 0.32, 0.18, 0.06, -0, { color: GLASS });
      trim.box(0, 0.88, 0.7, 0.2, 0.1, 0.06, 0, { color: LIGHT });
      trim.geometry(cyl(0.02, 0.02, 0.62).rotateZ(Math.PI / 2), M(0, 1.02, 0.42), CHROME);
    } else {
      // underbone / scooter body
      body.geometry(rbox(0.36, 0.62, 0.22, 0.08), M(0, 0.7, 0.48, -0.25)); // leg shield
      if (type === 'click') body.box(0, 0.42, 0.05, 0.36, 0.08, 0.6); // floorboard
      else trim.geometry(cyl(0.04, 0.04, 0.8).rotateX(Math.PI / 2 - 0.35), M(0, 0.62, 0.12), GREY);
      body.geometry(rbox(0.34, 0.36, 0.75, 0.12), M(0, 0.66, -0.35));
      trim.geometry(rbox(0.3, 0.1, 0.62, 0.05), M(0, 0.88, -0.3), SEAT);
      trim.box(0, 0.38, -0.12, 0.28, 0.26, 0.36, 0, { color: GREY }); // engine
      trim.geometry(cyl(0.04, 0.045, 0.6).rotateX(Math.PI / 2), M(0.17, 0.32, -0.5), CHROME);
      body.geometry(rbox(0.3, 0.22, 0.26, 0.08), M(0, 1.0, 0.56)); // headlight cowl
      trim.box(0, 1.0, 0.7, 0.16, 0.08, 0.02, 0, { color: LIGHT });
      trim.geometry(cyl(0.017, 0.017, 0.68).rotateZ(Math.PI / 2), M(0, 1.06, 0.5), CHROME);
      for (const sx of [-1, 1]) trim.box(sx * 0.12, 1.12, 0.5, 0.06, 0.04, 0.05, 0, { color: CHROME });
      trim.box(0, 0.7, -0.76, 0.14, 0.06, 0.04, 0, { color: TAIL });
      for (const sx of [-1, 1]) trim.box(sx * 0.16, 0.98, 0.62, 0.05, 0.04, 0.05, 0, { color: ORANGE });
      trim.box(0, 0.56, -0.83, 0.18, 0.12, 0.02, 0, { color: PLATE });
    }
    // forks
    for (const sx of [-1, 1]) trim.geometry(cyl(0.025, 0.025, 0.7).rotateX(-0.42), M(sx * 0.07, wr + 0.32, fz - 0.14), CHROME);
    trim.geometry(cyl(0.03, 0.03, 0.5).rotateX(0.25), M(0, wr + 0.2, rz + 0.22), GREY);
    body.box(0, wr + 0.08, fz, 0.12, 0.04, 0.45); // front fender
  }
  const wheels = [{ x: 0, y: wr, z: fz, r: wr, front: true }, { x: 0, y: wr, z: rz, r: wr, front: false }];
  return { body, trim, wheels, wheelGeo: wheelGeo(wr, bike ? 0.05 : 0.11, bike), seat: { x: 0, y: bike ? 0.97 : 0.9, z: bike ? -0.2 : -0.25 }, dims: { L: 1.9, W: 0.7, H: 1.2 } };
}

const isMoto = (t) => ['bicycle', 'wave', 'click', 'sport', 'moto', 'scooter'].includes(t);
const motoKey = (t) => t === 'moto' ? 'wave' : t === 'scooter' ? 'click' : t;

export function vehicleParts(type) { return isMoto(type) ? motoParts(motoKey(type)) : carParts(type === 'car' ? 'hatch' : type); }

function merged(parts) {
  const all = new GeoBuilder();
  const add = (gb) => { const g = gb.build(); all.geometry(g, new THREE.Matrix4()); };
  add(parts.body); add(parts.trim);
  for (const w of parts.wheels) all.geometry(parts.wheelGeo, new THREE.Matrix4().makeTranslation(w.x, w.y, w.z));
  return all.build();
}
const cache = {};
export function carGeometry(type) { if (!cache['c' + type]) { LO = true; cache['c' + type] = merged(carParts(type)); LO = false; } return cache['c' + type]; }
export function motoGeometry(type) { if (!cache['m' + type]) { LO = true; cache['m' + type] = merged(motoParts(type)); LO = false; } return cache['m' + type]; }

// Full drivable model: Group with painted body, trim, and spinning wheels.
export function buildVehicleModel(type, color, mats) {
  const parts = vehicleParts(type);
  const g = new THREE.Group();
  const paint = mats.paintFor(color);
  const bm = new THREE.Mesh(parts.body.build(), paint); bm.castShadow = true; bm.receiveShadow = true; g.add(bm);
  const tm = new THREE.Mesh(parts.trim.build(), mats.vehTrim); tm.castShadow = true; g.add(tm);
  const wheels = [];
  for (const w of parts.wheels) {
    const pivot = new THREE.Group(); pivot.position.set(w.x, w.y, w.z);
    const wm = new THREE.Mesh(parts.wheelGeo, mats.vehTrim); wm.castShadow = true; pivot.add(wm); g.add(pivot);
    wheels.push({ pivot, mesh: wm, front: w.front, r: w.r });
  }
  // headlight glow (used at night)
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(isMoto(type) ? 0.25 : parts.dims.W * 0.9, 0.18), mats.headGlow.clone());
  glow.position.set(0, isMoto(type) ? 1.0 : 0.78, parts.dims.L / 2 + 0.06); g.add(glow);
  return { group: g, wheels, seat: parts.seat, dims: parts.dims, moto: isMoto(type), bike: type === 'bicycle', glow, body: bm };
}
