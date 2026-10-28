// World orchestrator for the real KU Sriracha map: materials, terrain, buildings, roads, props, trees, night lights.
import * as THREE from 'three';
import * as TX from './textures.js';
import { ChunkedBuilders } from './geo.js';
import { CollisionWorld, SURF } from './collision.js';
import { loadMap, MAP, groundHeight } from './mapdata.js';
import { buildRect, SignAtlas } from './buildings.js';
import { buildMapBuildings } from './polybuild.js';
import { buildRoadNet, buildMarkings, buildCurbs, roadsideSpots } from './roadnet.js';
import { prepareGround, findSpot, buildLandmarks, buildFurniture, buildParked, placeTrees, GATE } from './props2.js';
import { buildTerrain, buildWater, buildTreeLOD, shared } from './nature.js';
import { treeGeometriesHD, treeGeometriesLoHD, foliageMaterialHD } from './foliage.js';
import { PLACES } from './places.js';

const tick = () => new Promise(r => setTimeout(r, 0));
function plankTexture() {
  const c = TX.canvas(256, 256), x = c.getContext('2d');
  for (let i = 0; i < 8; i++) { const v = 0.75 + Math.random() * 0.3; x.fillStyle = `rgb(${138 * v | 0},${100 * v | 0},${66 * v | 0})`; x.fillRect(0, i * 32, 256, 30); x.fillStyle = 'rgba(40,25,10,0.6)'; x.fillRect(0, i * 32 + 30, 256, 2); for (let k = 0; k < 30; k++) { x.fillStyle = `rgba(60,40,20,${Math.random() * 0.2})`; x.fillRect(Math.random() * 256, i * 32 + Math.random() * 30, 20 + Math.random() * 60, 1); } }
  return TX.toTex(c);
}
function fenceTexture() { const c = TX.canvas(64, 64), x = c.getContext('2d'); x.fillStyle = '#2f3a35'; for (let i = 0; i < 4; i++) x.fillRect(i * 16 + 6, 0, 4, 64); x.fillRect(0, 2, 64, 4); x.fillRect(0, 58, 64, 4); return TX.toTex(c); }
function flagTexture(kind) {
  const c = TX.canvas(192, 128), x = c.getContext('2d');
  if (kind === 'th') { const s = [['#A51931', 1], ['#F4F5F8', 1], ['#2D2A4A', 2], ['#F4F5F8', 1], ['#A51931', 1]]; let y = 0; for (const [col, h] of s) { x.fillStyle = col; x.fillRect(0, y, 192, h * 128 / 6 + 1); y += h * 128 / 6; } }
  else { x.fillStyle = '#0d6b52'; x.fillRect(0, 0, 192, 128); x.fillStyle = '#fff'; x.font = `900 64px ${TX.THAI_FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('KU', 96, 66); }
  return TX.toTex(c, { repeat: false });
}
const GENERIC_SIGNS = ['ร้านอาหารตามสั่ง', 'ร้านกาแฟ', 'มินิมาร์ท', 'ร้านซ่อมรถ', 'ร้านเสริมสวย', 'ร้านขายยา', 'ร้านโทรศัพท์', 'ถ่ายเอกสาร', 'ร้านซักรีด', 'ก๋วยเตี๋ยว', 'ข้าวมันไก่', 'หอพัก', 'วัสดุก่อสร้าง', 'ร้านทอง', 'ชานมไข่มุก', 'ส้มตำ'];
const GENERIC_COLS = ['#c0392b', '#1f6f9a', '#0d6b52', '#d68910', '#6c3483', '#b03a2e', '#117a65', '#2e4053'];
function genericSignAtlas() {
  const c = TX.canvas(1024, 1024), x = c.getContext('2d'); const uvs = [];
  GENERIC_SIGNS.forEach((t, i) => {
    const cx = (i % 2) * 512, cy = Math.floor(i / 2) * 128; x.fillStyle = GENERIC_COLS[i % GENERIC_COLS.length]; x.fillRect(cx, cy, 512, 128);
    x.strokeStyle = '#fff'; x.lineWidth = 5; x.strokeRect(cx + 6, cy + 6, 500, 116);
    x.fillStyle = '#fff'; x.font = `700 58px ${TX.THAI_FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, cx + 256, cy + 66, 480);
    uvs.push([cx / 1024, 1 - (cy + 128) / 1024, (cx + 512) / 1024, 1 - cy / 1024]);
  });
  return { tex: TX.toTex(c, { repeat: false }), uvs };
}

export async function buildWorld(renderer, scene, quality, onProgress = () => {}) {
  onProgress(0.03, 'Loading the KU Sriracha map…');
  await loadMap();
  TX.setMaxAnisotropy(Math.min(quality.aniso || 8, renderer.capabilities.getMaxAnisotropy()));
  onProgress(0.08, 'Painting textures…'); await tick();
  const tex = {
    grass: TX.grassTextures(), sand: TX.sandTextures(), dirt: TX.dirtTextures(), asphalt: TX.asphaltTextures(), paver: TX.paverTextures(),
    concrete: TX.concreteTextures(51, 185), waterN: TX.waterNormal(), roof: TX.roofTextures('concrete'), roofMetal: TX.roofTextures('metal'), roofTile: TX.roofTextures('tile'), roofGreen: TX.roofTextures('green'), farm: TX.farmTexture(),
  };
  await tick(); onProgress(0.14, 'Drawing building facades…');
  const fac = {}; for (const k of TX.FACADE_KEYS) fac[k] = TX.facadeTextures(k, 3);
  const gf = {}; for (const k of ['lobby', 'shutter', 'mart', 'showroom', 'plain', 'brickw', 'darkglass']) gf[k] = TX.groundFloorTextures(k, 5);
  await tick(); onProgress(0.2, 'Mixing materials…');
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const facadeMat = (t) => std({ map: t.map, normalMap: t.normalMap || null, normalScale: new THREE.Vector2(0.9, 0.9), emissiveMap: t.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0, roughnessMap: t.rmMap, metalnessMap: t.rmMap, roughness: 1, metalness: 1, vertexColors: true, envMapIntensity: 1.3, side: THREE.DoubleSide });
  const mats = {
    mark: std({ vertexColors: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 }),
    plaza: std({ map: tex.paver.map, normalMap: tex.paver.normalMap, roughness: 0.8, color: 0xe8d8c0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
    curb: std({ map: tex.concrete.map, roughness: 0.85, color: 0xdedbd4 }),
    parking: std({ map: TX.parkingTexture(), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
    roof: std({ map: tex.roof.map, normalMap: tex.roof.normalMap, roughness: 0.9, side: THREE.DoubleSide, vertexColors: true }),
    roofMetal: std({ map: tex.roofMetal.map, normalMap: tex.roofMetal.normalMap, roughness: 0.45, metalness: 0.6, side: THREE.DoubleSide, vertexColors: true }),
    roofTile: std({ map: tex.roofTile.map, normalMap: tex.roofTile.normalMap, roughness: 0.72, side: THREE.DoubleSide, vertexColors: true }),
    roofGreen: std({ map: tex.roofGreen.map, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide }),
    trim: std({ map: tex.concrete.map, roughness: 0.8, vertexColors: true, side: THREE.DoubleSide }),
    trimDark: std({ color: 0x3c3f43, roughness: 0.7 }),
    trimGreen: std({ color: 0x0d6b52, roughness: 0.55, metalness: 0.1 }),
    trimGold: std({ color: 0xc9962e, roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide }),
    gable: std({ color: 0x8c3a22, roughness: 0.6, metalness: 0.1, side: THREE.DoubleSide }),
    white: std({ color: 0xf2f1ec, roughness: 0.6 }),
    metal: std({ color: 0x6d7276, roughness: 0.45, metalness: 0.6 }),
    concrete: std({ map: tex.concrete.map, roughness: 0.9, color: 0xcfcac0 }),
    paint: std({ vertexColors: true, roughness: 0.6, metalness: 0.05, side: THREE.DoubleSide }),
    fabric: std({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }),
    wood: std({ map: plankTexture(), roughness: 0.85 }),
    glass: std({ color: 0x9fc7d8, roughness: 0.14, metalness: 0.6, envMapIntensity: 1.6, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }),
    fence: std({ map: fenceTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.4 }),
    track: std({ map: TX.trackTexture(), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
    field: std({ map: TX.fieldTexture(), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
    futsal: std({ map: TX.courtTexture('#2e6fa3', '#ffffff'), roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
    court_basket: std({ map: TX.courtTexture('#3d7a4f', '#f5f5f5'), roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
    poolTile: std({ map: TX.poolTexture(), roughness: 0.3, side: THREE.DoubleSide }),
    farm: std({ map: tex.farm, roughness: 0.95 }),
    letters: std({ color: 0xffffff, roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0 }),
    lampHead: std({ color: 0xffffff, emissive: 0xffe2a8, emissiveIntensity: 0, roughness: 0.3 }),
    vehTrim: std({ vertexColors: true, roughness: 0.35, metalness: 0.35 }),
    headGlow: new THREE.MeshBasicMaterial({ color: 0xfff3d0, transparent: true, opacity: 0, depthWrite: false }),
  };
  for (const k of TX.FACADE_KEYS) mats['fac_' + k] = facadeMat(fac[k]);
  for (const k of Object.keys(gf)) mats['gf_' + k] = facadeMat(gf[k]);
  const paintCache = new Map();
  mats.paintFor = (c) => { let m = paintCache.get(c); if (!m) { m = new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.3, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.14 }); paintCache.set(c, m); } return m; };
  const emissiveMats = [...TX.FACADE_KEYS.map(k => mats['fac_' + k]), ...Object.keys(gf).map(k => mats['gf_' + k])];

  const group = new THREE.Group(); group.name = 'world'; scene.add(group);
  const col = new CollisionWorld();
  const rnd = (() => { let s = 1234567; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
  const lin = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
  const B = new ChunkedBuilders(640, { fabric: ['paint', null], trimDark: ['paint', lin('#3c3f43')], trimGreen: ['paint', lin('#0d6b52')], white: ['paint', lin('#f2f1ec')], gable: ['paint', lin('#8c3a22')], sign2: ['sign', null] });
  const atlas = new SignAtlas();
  const ctx = { reflections: quality.reflections !== false && quality.shadows > 0, B, col, rnd, atlas, interact: [], pools: [], trees: [], lamps: [], lampSpots: [], bigSigns: [], flags: [], boats: [], floodlights: [], seats: [], mats, group,
    places: PLACES, placeObjs: {}, campusDoors: [], bldInfo: [], rects: [], pois: {}, parkedMeshes: [], genericSigns: GENERIC_SIGNS.map((t, i) => atlas.addHalf(t, GENERIC_COLS[i % GENERIC_COLS.length])) };

  onProgress(0.26, 'Placing special structures…'); await tick();
  // resolve procedural places (coast strip, campus specials)
  const rectPlaces = [];
  for (const pl of PLACES) {
    if (!pl.rect) continue; const r = pl.rect; let x, z;
    if (r.gate) { x = GATE.x + 9; z = GATE.z - GATE.w / 2 - 6; }
    else if (r.near) [x, z] = findSpot(col, r.near[0], r.near[1], r.w, r.d);
    else { x = r.x; z = r.z; }
    const b = { ...pl, x, z, w: r.w, d: r.d, door: r.door || (r.gate ? 'w' : 's'), floors: pl.floors };
    // door towards the nearest road
    if (!r.door) { let best = 1e9; for (const [k, nx, nz] of [['n', 0, -1], ['s', 0, 1], ['e', 1, 0], ['w', -1, 0]]) { for (let t = 1; t < 60; t += 2) { const s = col.surfAt(x + nx * (r.w / 2 + t), z + nz * (r.d / 2 + t)); if (s === SURF.ROAD || s === SURF.WALK) { if (t < best) { best = t; b.door = k; } break; } } } }
    rectPlaces.push(b); ctx.rects.push(b);
  }
  prepareGround(ctx);
  onProgress(0.32, 'Sculpting terrain…'); await tick();
  const terr = buildTerrain(tex); group.add(terr.terrain); group.add(terr.ring);
  onProgress(0.4, 'Raising buildings…'); await tick();
  buildMapBuildings(ctx);
  for (const b of rectPlaces) { buildRect(b, ctx); ctx.placeObjs[b.id] = b; }
  onProgress(0.52, 'Painting road markings…'); await tick();
  const net = buildRoadNet();
  const { medians } = buildMarkings(net, col, mats, group);
  buildCurbs(net, B);
  const spots = roadsideSpots(net, col);
  onProgress(0.6, 'Gates, stadium, beach and pier…'); await tick();
  buildLandmarks(ctx);
  buildFurniture(ctx, spots, medians);
  buildParked(ctx, net);
  onProgress(0.68, 'Filling the sea and ponds…'); await tick();
  buildWater(tex, ctx).forEach(m => group.add(m));
  onProgress(0.74, 'Growing trees…'); await tick();
  placeTrees(ctx, spots);
  const fmat = foliageMaterialHD();
  const treeLOD = buildTreeLOD(ctx.trees, treeGeometriesHD(), treeGeometriesLoHD(), fmat, quality.treeShadows !== false);
  // canopy occlusion mask (2 m/px): shades + adds leaf litter to the ground under every crown, even beyond shadow range
  { const b = MAP.b, cw = Math.ceil((b.maxX - b.minX) / 2), chh = Math.ceil((b.maxZ - b.minZ) / 2); const cd = new Uint8Array(cw * chh);
    const CR = { rain: 6.2, nonsi: 3.0, forest: 2.9, round: 2.7, palm: 2.0, royal: 1.8, bush: 1.1, flower: 1.2 };
    for (const t of ctx.trees) { const rr = (CR[t.type] || 0) * t.s; if (!rr) continue; const px = (t.x - b.minX) / 2, pz = (t.z - b.minZ) / 2, rp = rr / 2 + 1;
      for (let z = Math.max(0, Math.floor(pz - rp)); z <= Math.min(chh - 1, Math.ceil(pz + rp)); z++) for (let x = Math.max(0, Math.floor(px - rp)); x <= Math.min(cw - 1, Math.ceil(px + rp)); x++) {
        const d = Math.hypot(x - px, z - pz) / (rr / 2); if (d >= 1.15) continue; const v = Math.round(255 * Math.min(1, (1.15 - d) / 0.55) * (t.type === 'palm' || t.type === 'royal' ? 0.5 : 1)); const i = z * cw + x; if (v > cd[i]) cd[i] = v; } }
    const ct = new THREE.DataTexture(cd, cw, chh, THREE.RedFormat, THREE.UnsignedByteType); ct.magFilter = ct.minFilter = THREE.LinearFilter; ct.needsUpdate = true;
    terr.mat.userData.uniforms.uCanopy.value = ct; MAP.canopyTex = ct; }
  group.add(treeLOD.root);
  onProgress(0.84, 'Merging geometry…'); await tick();
  mats.sign = std({ map: atlas.texture(), roughness: 0.6, emissive: 0xffffff, emissiveIntensity: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2, side: THREE.DoubleSide });
  mats.sign.emissiveMap = mats.sign.map;
  B.toMeshes(mats, { castShadow: (m) => !['sign', 'mark', 'plaza', 'parking', 'track', 'field', 'futsal', 'court_basket', 'farm', 'glass', 'poolTile'].includes(m), receiveShadow: true, group });
  for (const s of ctx.bigSigns) {
    const t = TX.signTexture([s.th, s.en], { w: 1536, h: 192 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), std({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0, roughness: 0.5 }));
    m.position.set(s.x, s.y, s.z); m.rotation.y = Math.atan2(s.nx, s.nz); group.add(m); emissiveMats.push(m.material);
  }
  for (const f of ctx.flags) {
    const g = new THREE.PlaneGeometry(1.8, 1.2, 12, 6); g.translate(0.9, 0, 0);
    const m = std({ map: flagTexture(f.kind), side: THREE.DoubleSide, roughness: 0.8 });
    m.onBeforeCompile = (sh) => { sh.uniforms.uTime = shared.time; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat k = position.x / 1.8; transformed.z += sin(uTime*4.0 + position.x*3.0) * 0.18 * k; transformed.y += sin(uTime*3.0 + position.x*2.0) * 0.05 * k;'); };
    const fm = new THREE.Mesh(g, m); fm.position.set(f.x - 0.9, f.y, f.z); fm.castShadow = true; group.add(fm);
  }
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
  for (const f of ctx.floodlights) { const gm = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), glowMat); gm.position.set(f.x, f.y + 0.5, f.z); gm.lookAt(f.tx, f.y, f.tz); group.add(gm); }

  onProgress(0.92, 'Drawing the map…'); await tick();
  const mapCanvas = drawMap(col, ctx);
  const lights = [];
  for (let i = 0; i < (quality.pointLights ?? 6); i++) { const l = new THREE.PointLight(0xffd9a0, 0, 26, 1.6); scene.add(l); lights.push(l); }
  let lightTimer = 0, lodTimer = 0;
  const _fwd = new THREE.Vector3();
  // horizontal half-FOV + 28° margin (so turning the camera never reveals un-filled tree instances before the next update)
  const _cosLim = (cam) => { if (!cam) return -1; const h = Math.atan(Math.tan(cam.fov * Math.PI / 360) * cam.aspect) + 0.49; return h >= Math.PI ? -1 : Math.cos(h); };
  const pois = { ...ctx.pois };
  for (const [id, p] of Object.entries(ctx.placeObjs)) pois[id] = { x: p._door.x, z: p._door.z, name: p.name };
  pois.plaza = { x: -980, z: 30, name: 'KU Front Lawn' };
  pois.lake = { x: -1000, z: -40, name: 'Front Pond' };
  const world = { reflectionsOn: true, get waterBodies() { return ctx.waterBodies; },
    col, net, interact: ctx.interact, seats: ctx.seats, mapCanvas, mats, group, places: ctx.placeObjs, pois,
    deliveryHomes: MAP.meta.buildings.filter((b, i) => b.a > 70 && b.a < 700 && i % 7 === 0 && !(b.c[0] > -1083 && b.c[0] < -460 && b.c[1] > -345 && b.c[1] < 640)).map((b, i) => ({ x: b.c[0], z: b.c[1], name: `House ${10 + (i * 7) % 90}/${1 + (i * 13) % 40} · บ้านเลขที่` })),
    waterLevel(x, z) { if (x < MAP.b.coastX + 30) return 0; for (const w of MAP.meta.water) { const p = w.p; let ins = false; for (let i = 0, j = p.length / 2 - 1; i < p.length / 2; j = i++) { const xi = p[i * 2], zi = p[i * 2 + 1], xj = p[j * 2], zj = p[j * 2 + 1]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) ins = !ins; } if (ins) return w.y; } for (const pl of ctx.pools) if (Math.abs(x - pl.x) < pl.w / 2 && Math.abs(z - pl.z) < pl.d / 2) return pl.y; return -100; },
    trackCheckpoints: ctx.trackCheckpoints, lamps: ctx.lamps, bounds: MAP.b, treeLOD, terrainMat: terr.mat,
    heightAt: (x, z) => col.heightAt(x, z), groundHeight,
    spawn: (() => { for (let r = 0; r < 40; r += 1.5) for (let a = 0; a < 6.28; a += 0.4) { const x = GATE.x + 22 + Math.cos(a) * r, z = GATE.z + 14 + Math.sin(a) * r; const sf = col.surfAt(x, z); if ((sf === SURF.WALK || sf === SURF.PLAZA || sf === SURF.GRASS || sf === SURF.URBAN) && !col.blocked(x, z, 0.6)) return { x, z, ry: Math.PI / 2 }; } return { x: GATE.x + 22, z: GATE.z + 4, ry: Math.PI / 2 }; })(),
    update(dt, env, focus, camera) {
      shared.time.value += dt;
      if (ctx.foamTex) ctx.foamTex.offset.y += dt * 0.02;
      const n = env.night;
      const wi = n * 1.35; for (const m of emissiveMats) m.emissiveIntensity = wi;
      mats.sign.emissiveIntensity = n * 0.55; mats.lampHead.emissiveIntensity = n * 4 + 0.05; mats.letters.emissiveIntensity = n * 2.2;
      mats.headGlow.opacity = n * 0.95; glowMat.opacity = n * 0.9;
      terr.mat.userData.uniforms.uWet.value = env.rain || 0;
      for (const b of ctx.boats) { b.position.y = -0.15 + Math.sin(shared.time.value * 1.1 + b.position.x) * 0.12; b.rotation.z = Math.sin(shared.time.value * 0.9 + b.position.z) * 0.05; b.rotation.x = Math.sin(shared.time.value * 0.7 + b.position.x) * 0.03; }
      { const c = camera ? camera.position : focus; if (camera) camera.getWorldDirection(_fwd); treeLOD.update(c.x, c.z, (quality.treeHi ?? 240) * (world.treeScale || 1), quality.treeLo ?? 900, camera ? _fwd : null, _cosLim(camera)); }
      lodTimer -= dt; if (lodTimer <= 0) { lodTimer = 0.4; const c = camera ? camera.position : focus;
        // planar reflection follows the nearest water body within 420 m (one extra scene render at most)
        if (ctx.waterBodies) { let best = null, bd = 420;
          for (const wb of ctx.waterBodies) { const d = wb.sea ? Math.max(0, c.x - (MAP.b.coastX + 30)) : Math.max(0, Math.hypot(wb.x - c.x, wb.z - c.z) - wb.r); if (d < bd) { bd = d; best = wb; } }
          if (!world.reflectionsOn) best = null;
          for (const wb of ctx.waterBodies) { const on = wb === best; wb.refl.visible = on; wb.cheap.visible = !on; } } }
      if (ctx.waterBodies) { const amb = 1 - n * 0.88; for (const wb of ctx.waterBodies) if (wb.refl.visible) wb.refl.material.uniforms.uAmb.value.setScalar(amb); }
      lightTimer -= dt;
      if (lightTimer <= 0 && lights.length) {
        lightTimer = 0.6;
        if (n > 0.05) {
          const near = ctx.lamps.map(l => ({ l, d: (l.x - focus.x) ** 2 + (l.z - focus.z) ** 2 })).sort((a, b) => a.d - b.d).slice(0, lights.length);
          lights.forEach((L, i) => { const p = near[i]; if (p) { L.position.set(p.l.x, p.l.y, p.l.z); L.intensity = n * 38; } else L.intensity = 0; });
        } else lights.forEach(L => L.intensity = 0);
      }
    },
  };
  MAP.sdfPix = null; // CPU SDF copy only needed while fitting geometry
  onProgress(0.97, 'Opening the gates…'); await tick();
  return world;
}

const SURF_COL = {
  [SURF.GRASS]: [104, 146, 82], [SURF.ROAD]: [70, 73, 78], [SURF.WALK]: [190, 184, 172], [SURF.BUILDING]: [232, 224, 206], [SURF.SAND]: [236, 218, 172], [SURF.WATER]: [64, 132, 176],
  [SURF.PIER]: [150, 112, 74], [SURF.DIRT]: [168, 136, 96], [SURF.PLAZA]: [205, 196, 178], [SURF.PARKING]: [96, 99, 104], [SURF.SPORT]: [86, 160, 76], [SURF.MEDIAN]: [110, 150, 92],
  [SURF.FARM]: [150, 122, 76], [SURF.FOREST]: [58, 102, 50], [SURF.PLATFORM]: [176, 160, 128], [SURF.POOL]: [63, 195, 224], [SURF.RAIL]: [110, 90, 80], [SURF.URBAN]: [166, 166, 158],
};
function drawMap(col, ctx) {
  const c = TX.canvas(col.w, col.h), x = c.getContext('2d'); const img = x.createImageData(col.w, col.h), d = img.data;
  for (let j = 0; j < col.h; j++) for (let i = 0; i < col.w; i++) {
    const k = j * col.w + i, s = col.surf[k]; const rgb = SURF_COL[s] || [104, 146, 82];
    d[k * 4] = rgb[0]; d[k * 4 + 1] = rgb[1]; d[k * 4 + 2] = rgb[2]; d[k * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  // building outlines + named places tinted
  x.lineWidth = 1;
  for (const b of MAP.meta.buildings) { x.beginPath(); for (let k = 0; k < b.p.length; k += 2) { const px = b.p[k] - col.minX, pz = b.p[k + 1] - col.minZ; if (k) x.lineTo(px, pz); else x.moveTo(px, pz); } x.closePath(); x.strokeStyle = 'rgba(120,108,92,0.9)'; x.stroke(); }
  for (const p of Object.values(ctx.placeObjs)) { if (!p.poly) continue; x.beginPath(); p.poly.forEach(([px, pz], k) => { if (k) x.lineTo(px - col.minX, pz - col.minZ); else x.moveTo(px - col.minX, pz - col.minZ); }); x.closePath(); x.fillStyle = 'rgba(13,107,82,0.55)'; x.fill(); }
  return c;
}
