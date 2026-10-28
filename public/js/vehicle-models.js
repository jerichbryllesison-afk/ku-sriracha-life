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

// ---------------------------------------------------------------------------------------------------------------
// Detailed look-alike models for the living-campus vehicle line-up (original low-poly designs, no logos).
// Cars use an extruded side profile so the silhouette (hood, windscreen rake, roof line, boot) reads like the real class.
function extrudeProfile(pts, width, bevel = 0.045) {
  const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.05, width - bevel * 2), bevelEnabled: !LO, bevelThickness: bevel, bevelSize: bevel, bevelSegments: LO ? 1 : 2, steps: 1, curveSegments: 2 });
  g.translate(0, 0, -(width - bevel * 2) / 2); g.rotateY(-Math.PI / 2); return g;
}
function alloyWheel(r, w, spokes = 5) {
  const gb = new GeoBuilder();
  gb.geometry(new THREE.CylinderGeometry(r, r, w, LO ? 12 : 22).rotateZ(Math.PI / 2), new THREE.Matrix4(), TIRE);
  gb.geometry(new THREE.CylinderGeometry(r * 0.7, r * 0.7, w + 0.015, LO ? 10 : 20).rotateZ(Math.PI / 2), new THREE.Matrix4(), DARK);
  if (!LO) for (let i = 0; i < spokes; i++) gb.geometry(new THREE.BoxGeometry(w + 0.03, r * 1.3, 0.05).rotateX(i / spokes * Math.PI), new THREE.Matrix4(), CHROME);
  gb.geometry(new THREE.CylinderGeometry(r * 0.16, r * 0.16, w + 0.04, 10).rotateZ(Math.PI / 2), new THREE.Matrix4(), CHROME);
  return gb.build();
}
const LUX = {
  // lower body side profile [z, y], greenhouse (glass) profile, widths, wheels
  camry: { L: 4.92, Wd: 1.84, cabW: 1.56, wr: 0.34, wz: 1.42, wx: 0.8, seatY: 0.68, seatZ: 0.05, spokes: 5,
    body: [[-2.40, 0.30], [-2.47, 0.50], [-2.45, 0.74], [-2.30, 0.88], [-1.55, 0.93], [1.05, 0.93], [1.28, 0.90], [2.25, 0.78], [2.44, 0.66], [2.48, 0.46], [2.40, 0.30]],
    glass: [[-1.58, 0.91], [-0.86, 1.40], [0.36, 1.44], [1.10, 0.92]], roof: [-0.25, 1.43, 1.22] },
  civic: { L: 4.68, Wd: 1.80, cabW: 1.52, wr: 0.33, wz: 1.38, wx: 0.79, seatY: 0.64, seatZ: 0.0, spokes: 10, black: true,
    body: [[-2.28, 0.30], [-2.35, 0.52], [-2.31, 0.80], [-2.14, 0.96], [-2.04, 0.93], [1.00, 0.91], [1.20, 0.88], [2.14, 0.76], [2.31, 0.62], [2.36, 0.44], [2.28, 0.28]],
    glass: [[-2.02, 0.92], [-0.78, 1.36], [0.30, 1.40], [1.03, 0.90]], roof: [-0.24, 1.39, 1.1] },
  bmw3: { L: 4.71, Wd: 1.83, cabW: 1.55, wr: 0.34, wz: 1.42, wx: 0.8, seatY: 0.66, seatZ: -0.1, spokes: 7,
    body: [[-2.28, 0.30], [-2.36, 0.52], [-2.34, 0.76], [-2.20, 0.90], [-1.48, 0.94], [0.86, 0.93], [1.08, 0.91], [2.12, 0.80], [2.30, 0.68], [2.36, 0.48], [2.28, 0.30]],
    glass: [[-1.50, 0.92], [-0.96, 1.42], [0.20, 1.45], [0.90, 0.93]], roof: [-0.38, 1.44, 1.1] },
  amggt: { L: 4.73, Wd: 1.98, cabW: 1.50, wr: 0.36, wz: 1.38, wx: 0.86, seatY: 0.56, seatZ: -0.45, spokes: 10, black: true,
    body: [[-2.28, 0.26], [-2.36, 0.50], [-2.33, 0.80], [-2.16, 0.98], [-1.74, 0.96], [0.14, 0.86], [0.42, 0.84], [2.00, 0.72], [2.30, 0.58], [2.37, 0.42], [2.28, 0.24]],
    glass: [[-1.76, 0.94], [-0.86, 1.25], [-0.22, 1.28], [0.18, 0.86]], roof: [-0.55, 1.27, 0.6] },
};
function luxCarParts(model) {
  const body = new GeoBuilder(), trim = new GeoBuilder(); const S = LUX[model]; const { L, Wd, cabW, wr, wz, wx } = S;
  body.geometry(extrudeProfile(S.body, Wd, 0.06), new THREE.Matrix4());
  trim.geometry(extrudeProfile(S.glass, cabW, 0.035), new THREE.Matrix4(), GLASS);
  const [rz, ry, rl] = S.roof; (S.black ? trim : body).geometry(rbox(cabW * 0.96, 0.05, rl, 0.02), M(0, ry + 0.01, rz), S.black ? DARK : W);
  const zf = S.body[S.body.length - 2][0], zr = S.body[1][0];
  // chrome / black window line, side mirrors, skirts
  for (const sx of [-1, 1]) {
    trim.box(sx * (cabW / 2 + 0.005), S.glass[0][1] + 0.02, (S.glass[0][0] + S.glass[3][0]) / 2, 0.02, 0.025, Math.abs(S.glass[3][0] - S.glass[0][0]) * 0.92, 0, { color: S.black ? DARK : CHROME });
    trim.geometry(rbox(0.16, 0.1, 0.2, 0.04), M(sx * (Wd / 2 + 0.05), S.glass[3][1] + 0.08, S.glass[3][0] - 0.18), DARK);
    trim.box(sx * (Wd / 2 - 0.02), 0.34, 0, 0.06, 0.08, L * 0.5, 0, { color: DARK });
    for (const sz of [-1, 1]) trim.geometry(cyl(wr + 0.06, wr + 0.06, 0.09, 16).rotateZ(Math.PI / 2), M(sx * (Wd / 2 - 0.03), wr, sz * wz), DARK);
  }
  // front: grille, LED headlights; rear: full-width tail bar
  if (model === 'bmw3') { for (const sx of [-1, 1]) { trim.geometry(rbox(0.26, 0.2, 0.06, 0.05), M(sx * 0.16, 0.66, zf + 0.02), CHROME); trim.geometry(rbox(0.22, 0.16, 0.06, 0.04), M(sx * 0.16, 0.66, zf + 0.04), DARK); } trim.box(0, 0.42, zf + 0.03, Wd * 0.7, 0.14, 0.05, 0, { color: DARK }); }
  else if (model === 'amggt') { trim.geometry(rbox(0.62, 0.3, 0.06, 0.06), M(0, 0.5, zf + 0.02), DARK); for (let i = -6; i <= 6; i++) trim.box(i * 0.045, 0.5, zf + 0.06, 0.012, 0.26, 0.02, 0, { color: CHROME }); for (const sx of [-1, 1]) trim.box(sx * 0.62, 0.38, zf, 0.3, 0.14, 0.05, 0, { color: DARK }); }
  else if (model === 'camry') { trim.box(0, 0.44, zf + 0.03, Wd * 0.74, 0.22, 0.05, 0, { color: DARK }); trim.box(0, 0.66, zf + 0.01, Wd * 0.36, 0.05, 0.04, 0, { color: DARK }); }
  else { trim.box(0, 0.47, zf + 0.03, Wd * 0.6, 0.2, 0.05, 0, { color: DARK }); }
  for (const sx of [-1, 1]) { trim.box(sx * Wd * 0.34, 0.68, zf - 0.02, Wd * 0.24, 0.06, 0.12, sx * 0.12, { color: LIGHT }); trim.box(sx * Wd * 0.36, 0.64, zf - 0.03, Wd * 0.18, 0.025, 0.1, sx * 0.12, { color: CHROME }); }
  trim.box(0, model === 'amggt' ? 0.86 : 0.82, zr - 0.01, Wd * 0.86, 0.06, 0.06, 0, { color: TAIL });
  for (const sx of [-1, 1]) trim.box(sx * Wd * 0.38, model === 'amggt' ? 0.82 : 0.78, zr, Wd * 0.18, 0.1, 0.06, 0, { color: TAIL });
  trim.box(0, 0.38, zr + 0.02, 0.42, 0.12, 0.02, 0, { color: PLATE }); trim.box(0, 0.4, zf + 0.06, 0.42, 0.12, 0.02, 0, { color: PLATE });
  trim.box(0, 0.32, zr + 0.02, Wd * 0.9, 0.12, 0.06, 0, { color: DARK }); // diffuser
  if (model === 'amggt') { for (const sx of [-1, 1]) for (const k of [0, 1]) trim.geometry(cyl(0.045, 0.045, 0.1, 10).rotateX(Math.PI / 2), M(sx * (0.5 + k * 0.12), 0.3, zr), CHROME); body.box(0, 1.0, -2.12, Wd * 0.7, 0.03, 0.18); for (const sx of [-1, 1]) body.geometry(rbox(0.18, 0.36, 1.1, 0.08), M(sx * (Wd / 2 - 0.02), 0.62, -1.25)); }
  if (model === 'civic') { body.box(0, 0.99, -2.12, Wd * 0.62, 0.025, 0.14); trim.geometry(cyl(0.05, 0.05, 0.1, 10).rotateX(Math.PI / 2), M(0, 0.3, zr), CHROME); }
  if (model === 'bmw3') for (const sx of [-1, 1]) trim.geometry(cyl(0.04, 0.04, 0.1, 10).rotateX(Math.PI / 2), M(sx * 0.55, 0.3, zr), CHROME);
  const wheels = []; for (const sx of [-1, 1]) for (const sz of [1, -1]) wheels.push({ x: sx * wx, y: wr, z: sz * wz, r: wr, front: sz > 0 });
  return { body, trim, wheels, wheelGeo: alloyWheel(wr, 0.25, S.spokes), seat: { x: -0.38, y: S.seatY, z: S.seatZ }, dims: { L, W: Wd, H: S.roof[1] + 0.05 } };
}
function luxMotoParts(model) {
  const body = new GeoBuilder(), trim = new GeoBuilder();
  const P = { click160: { wr: 0.27, fz: 0.66, rz: -0.6 }, pcx: { wr: 0.29, fz: 0.74, rz: -0.66 }, vespa: { wr: 0.25, fz: 0.6, rz: -0.55 }, forza: { wr: 0.31, fz: 0.82, rz: -0.74 } }[model];
  const { wr, fz, rz } = P;
  if (model === 'vespa') {
    // monocoque steel body: curved leg shield, round side cowls, handlebar headlight
    body.geometry(new THREE.CylinderGeometry(0.24, 0.24, 0.78, 16, 1, true, -Math.PI / 2 - 0.9, 1.8).rotateX(-0.18), M(0, 0.72, 0.46));
    body.box(0, 0.36, 0.05, 0.34, 0.06, 0.62);
    body.geometry(new THREE.SphereGeometry(0.3, 14, 10).scale(0.75, 0.62, 1.25), M(0, 0.6, -0.36));
    for (const sx of [-1, 1]) body.geometry(new THREE.SphereGeometry(0.16, 10, 8).scale(0.6, 0.8, 1.7), M(sx * 0.17, 0.55, -0.32));
    trim.geometry(rbox(0.28, 0.09, 0.66, 0.04), M(0, 0.88, -0.28), [0.32, 0.2, 0.12]);
    body.geometry(rbox(0.22, 0.12, 0.22, 0.06), M(0, 1.04, 0.52));
    trim.geometry(new THREE.SphereGeometry(0.075, 12, 8), M(0, 1.05, 0.64), CHROME); trim.box(0, 1.05, 0.71, 0.1, 0.1, 0.01, 0, { color: LIGHT });
    trim.geometry(cyl(0.016, 0.016, 0.62).rotateZ(Math.PI / 2), M(0, 1.1, 0.5), CHROME);
    body.geometry(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.7, 0.5, 1.2), M(0, wr + 0.06, fz));
    trim.box(0, 0.86, -0.72, 0.24, 0.03, 0.22, 0, { color: CHROME }); trim.box(0, 0.62, -0.74, 0.12, 0.06, 0.03, 0, { color: TAIL });
    trim.box(0, 0.48, -0.79, 0.16, 0.1, 0.02, 0, { color: PLATE });
  } else {
    const big = model === 'forza' || model === 'pcx';
    body.geometry(rbox(big ? 0.5 : 0.4, big ? 0.72 : 0.62, 0.26, 0.1), M(0, 0.74, fz - 0.18, -0.22)); // front apron
    body.box(0, 0.42, 0.06, big ? 0.42 : 0.36, 0.08, big ? 0.7 : 0.6); // floorboard
    if (big) trim.geometry(rbox(0.16, 0.16, 0.5, 0.05), M(0, 0.5, 0.06), GREY); // centre tunnel
    body.geometry(rbox(big ? 0.4 : 0.34, 0.38, big ? 0.95 : 0.78, 0.13), M(0, 0.68, -0.38));
    body.geometry(rbox(0.26, 0.16, 0.4, 0.06), M(0, 0.62, rz - 0.04, 0.25)); // tail
    trim.geometry(rbox(big ? 0.34 : 0.3, 0.1, big ? 0.82 : 0.64, 0.05), M(0, 0.9, -0.34), SEAT);
    if (model === 'forza') trim.geometry(rbox(0.32, 0.1, 0.12, 0.04), M(0, 0.98, -0.64), SEAT);
    trim.box(0, 0.38, -0.16, 0.28, 0.24, 0.4, 0, { color: GREY });
    trim.geometry(cyl(0.045, 0.05, 0.6).rotateX(Math.PI / 2), M(0.18, 0.34, -0.52), model === 'click160' ? DARK : CHROME);
    body.geometry(rbox(big ? 0.38 : 0.32, 0.22, 0.3, 0.08), M(0, 1.02, fz - 0.1));
    if (big) trim.geometry(rbox(model === 'forza' ? 0.42 : 0.3, model === 'forza' ? 0.4 : 0.16, 0.03, 0.03), M(0, model === 'forza' ? 1.32 : 1.18, fz - 0.06, -0.35), GLASS); // windscreen
    for (const sx of [-1, 1]) trim.box(sx * (big ? 0.11 : 0.08), 1.0, fz + 0.06, 0.12, 0.05, 0.03, sx * 0.25, { color: LIGHT });
    trim.box(0, 0.94, fz + 0.07, 0.1, 0.06, 0.02, 0, { color: LIGHT });
    trim.geometry(cyl(0.017, 0.017, 0.66).rotateZ(Math.PI / 2), M(0, 1.1, fz - 0.16), DARK);
    for (const sx of [-1, 1]) trim.box(sx * 0.13, 1.16, fz - 0.16, 0.05, 0.04, 0.05, 0, { color: DARK });
    trim.box(0, 0.72, rz - 0.2, 0.18, 0.05, 0.03, 0, { color: TAIL }); trim.box(0, 0.54, rz - 0.24, 0.16, 0.1, 0.02, 0, { color: PLATE });
    body.box(0, wr + 0.08, fz, 0.13, 0.04, 0.45);
  }
  for (const sx of [-1, 1]) trim.geometry(cyl(0.025, 0.025, 0.7).rotateX(-0.42), M(sx * 0.07, wr + 0.32, fz - 0.14), model === 'vespa' ? GREY : CHROME);
  const wheels = [{ x: 0, y: wr, z: fz, r: wr, front: true }, { x: 0, y: wr, z: rz, r: wr, front: false }];
  return { body, trim, wheels, wheelGeo: alloyWheel(wr, 0.12, model === 'vespa' ? 5 : 6), seat: { x: 0, y: 0.9, z: -0.3 }, dims: { L: model === 'forza' ? 2.15 : 1.95, W: 0.75, H: 1.25 } };
}

const MOTO_MODELS = ['bicycle', 'wave', 'click', 'sport', 'moto', 'scooter', 'click160', 'pcx', 'vespa', 'forza'];
const MODEL_OF = { bicycle: 'bicycle', wave: 'wave', click: 'click160', pcx: 'pcx', vespa: 'vespa', forza: 'forza', sport: 'sport', civic: 'civic', camry: 'camry', bmw3: 'bmw3', amggt: 'amggt', hatch: 'hatch', pickup: 'pickup', sedan: 'sedan', supercar: 'super' };
const modelKey = (t) => MODEL_OF[t] || t;
const isMoto = (t) => MOTO_MODELS.includes(modelKey(t));
const motoKey = (t) => t === 'moto' ? 'wave' : t === 'scooter' ? 'click' : t;

export function vehicleParts(type) {
  const m = modelKey(type);
  if (LUX[m]) return luxCarParts(m);
  if (['click160', 'pcx', 'vespa', 'forza'].includes(m)) return luxMotoParts(m);
  return isMoto(m) ? motoParts(motoKey(m)) : carParts(m === 'car' ? 'hatch' : m);
}

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
