// Terrain, water, vegetation (instanced, wind-animated).
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MAP, groundHeight } from './mapdata.js';
import { SURF } from './collision.js';

export const shared = { time: { value: 0 }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(0, 0, 0) } };

// ---------------- terrain ----------------
export function buildTerrain(tex) {
  const b = MAP.b, nx = MAP.nx, nz = MAP.nz, step = MAP.step;
  const pos = new Float32Array(nx * nz * 3);
  let p = 0;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { pos[p++] = b.minX + i * step; pos[p++] = MAP.heights[j * nx + i]; pos[p++] = b.minZ + j * step; }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6); let k = 0;
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a0 = j * nx + i, b0 = a0 + 1, c0 = a0 + nx, d0 = c0 + 1;
    idx[k++] = a0; idx[k++] = c0; idx[k++] = b0; idx[k++] = b0; idx[k++] = c0; idx[k++] = d0;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(nx * nz * 2), 2));
  const mat = new THREE.MeshStandardMaterial({ map: tex.grass.map, normalMap: tex.grass.normalMap, normalScale: new THREE.Vector2(0.7, 0.7), roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 3 });
  const U = {
    uLand: { value: MAP.landTex }, uSdf: { value: MAP.sdfTex }, uMin: { value: new THREE.Vector2(b.minX, b.minZ) }, uSize: { value: new THREE.Vector2(b.maxX - b.minX, b.maxZ - b.minZ) },
    uSand: { value: tex.sand.map }, uDirt: { value: tex.dirt.map }, uAsphalt: { value: tex.asphalt.map }, uAsphaltN: { value: tex.asphalt.normalMap }, uPaver: { value: tex.paver.map }, uConcrete: { value: tex.concrete.map }, uFarm: { value: tex.farm },
    uCoast: { value: b.coastX }, uWet: { value: 0 }, uCanopy: { value: new THREE.DataTexture(new Uint8Array([0]), 1, 1, THREE.RedFormat) },
  };
  mat.userData.uniforms = U;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = (modelMatrix * vec4(position, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec2 vW; uniform sampler2D uLand; uniform sampler2D uSdf; uniform vec2 uMin; uniform vec2 uSize;
      uniform sampler2D uSand; uniform sampler2D uDirt; uniform sampler2D uAsphalt; uniform sampler2D uAsphaltN; uniform sampler2D uPaver; uniform sampler2D uConcrete; uniform sampler2D uFarm;
      uniform float uCoast; uniform float uWet; uniform sampler2D uCanopy;
      float gRoad; float gWalk;`)
      .replace('#include <map_fragment>', `
        vec2 luv = (vW - uMin) / uSize;
        vec4 lu = texture2D(uLand, luv);
        vec4 sd = (texture2D(uSdf, luv) * 255.0 - 128.0) / 8.0;
        vec2 tuv = vW / 6.5;
        float macro = texture2D(map, vW * 0.0093).g;
        vec3 grassC = texture2D(map, tuv).rgb * (0.7 + macro * 0.7);
        grassC = mix(grassC, texture2D(map, tuv * 4.3).rgb * (0.7 + macro * 0.7), 0.45);
        vec3 forestC = grassC * vec3(0.55, 0.66, 0.46) + texture2D(uDirt, tuv * 0.9).rgb * 0.12;
        vec3 dirtC = texture2D(uDirt, tuv * 1.1).rgb;
        vec3 farmC = texture2D(uFarm, vW / 14.0).rgb;
        vec3 urbanC = mix(grassC * vec3(1.02, 1.06, 0.9), dirtC * 0.95, 0.06 + smoothstep(0.55, 0.8, texture2D(map, vW * 0.017 + 0.61).g) * 0.35);
        float urban = clamp(1.0 - (lu.r + lu.g + lu.b + lu.a), 0.0, 1.0);
        urbanC = mix(texture2D(uConcrete, tuv * 0.8).rgb * vec3(0.9, 0.88, 0.84), urbanC, smoothstep(1.5, 6.0, sd.a)); // concrete aprons around buildings
        vec3 col = grassC * lu.r + forestC * lu.g + dirtC * lu.b + farmC * lu.a + urbanC * urban;
        float sand = smoothstep(uCoast + 48.0, uCoast + 36.0, vW.x);
        col = mix(col, texture2D(uSand, tuv * 1.3).rgb, sand);
        // canopy: leaf litter + soft occlusion under tree crowns
        float cn = texture2D(uCanopy, luv).r;
        col = mix(col, mix(col, dirtC * vec3(0.78, 0.66, 0.5), 0.55) * 0.66, cn);
        // building contact shadow (cheap AO)
        col *= mix(0.62, 1.0, smoothstep(0.0, 3.5, sd.a));
        // pond banks
        col = mix(col, dirtC * 0.8, (1.0 - smoothstep(0.0, 2.5, sd.b)) * 0.6);
        float aw = max(fwidth(sd.g), 0.04), ar = max(fwidth(sd.r), 0.04);
        gWalk = 1.0 - smoothstep(-aw, aw, sd.g);
        gRoad = 1.0 - smoothstep(-ar, ar, sd.r);
        vec3 pav = texture2D(uPaver, vW / 2.6).rgb * vec3(0.98, 0.95, 0.9);
        col = mix(col, pav, gWalk);
        float macro2 = texture2D(map, vW * 0.021 + 0.37).g;
        vec3 asp = texture2D(uAsphalt, vW / 7.0).rgb * (1.2 + macro * 0.3 + macro2 * 0.22);
        asp = mix(asp, asp * vec3(1.18, 1.14, 1.06) + 0.02, smoothstep(-1.6, 0.0, sd.r) * 0.55); // dusty road edges
        col = mix(col, dirtC * 0.9, (1.0 - smoothstep(0.0, 0.9, sd.g)) * smoothstep(-0.2, 0.2, sd.g) * 0.35 * (1.0 - gRoad)); // worn grass edge
        // concrete curb strip on the sidewalk side of the road edge
        float curb = (1.0 - smoothstep(0.22 - ar, 0.22 + ar, sd.r)) * gWalk;
        col = mix(col, vec3(0.55, 0.54, 0.52), curb * 0.85);
        col = mix(col, asp, gRoad);
        diffuseColor.rgb *= col;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.88 - uWet * 0.6, gRoad); roughnessFactor = mix(roughnessFactor, 0.85 - uWet * 0.45, gWalk * (1.0 - gRoad));')
      .replace('#include <normal_fragment_maps>', `
        vec3 nG = texture2D(normalMap, vW / 6.5).xyz * 2.0 - 1.0;
        vec3 nA = texture2D(uAsphaltN, vW / 7.0).xyz * 2.0 - 1.0;
        vec3 mapN = normalize(mix(nG, nA, gRoad)); mapN.xy *= normalScale;
        normal = normalize(tbn * mapN);`);
  };
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix();
  // far land ring outside the play area (fog hides the edge)
  const ring = new THREE.Mesh(new THREE.RingGeometry(1700, 9000, 64, 1), new THREE.MeshStandardMaterial({ color: 0x55703f, roughness: 1 }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(0, 2, 0); ring.matrixAutoUpdate = false; ring.updateMatrix();
  return { terrain: m, ring, mat };
}

// ---------------- water ----------------
export function waterMaterial(normalTex, color, opacity = 0.9, scale = 0.04, rough = 0.06) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: Math.max(0.12, rough), metalness: 0.05, transparent: true, opacity, normalMap: normalTex, normalScale: new THREE.Vector2(0.45, 0.45), depthWrite: false });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.time; sh.uniforms.uScale = { value: scale };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uScale; varying vec3 vWPos;')
      .replace('#include <normal_fragment_maps>', `
        vec2 wuv = vWPos.xz * uScale;
        vec3 n1 = texture2D(normalMap, wuv + vec2(uTime*0.018, uTime*0.011)).xyz * 2.0 - 1.0;
        vec3 n2 = texture2D(normalMap, wuv * 1.9 + vec2(-uTime*0.013, uTime*0.02)).xyz * 2.0 - 1.0;
        vec3 n3 = texture2D(normalMap, wuv * 0.31 + vec2(uTime*0.006, -uTime*0.004)).xyz * 2.0 - 1.0;
        vec3 mapN = normalize(vec3((n1.xy + n2.xy + n3.xy * 1.5) * normalScale, 1.0));
        normal = normalize( tbn * mapN );`);
  };
  return mat;
}

// Planar-reflection water shader (used through Reflector): rippled reflection + fresnel + absorption + sun glint
const ReflectWaterShader = {
  name: 'ReflectWater',
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
    tNormal: { value: null }, uTime: { value: 0 }, uScale: { value: 0.05 }, uDistort: { value: 0.045 },
    uDeep: { value: new THREE.Color(0x0b2f36) }, uShallow: { value: new THREE.Color(0x1f5a55) }, uAmb: { value: new THREE.Color(1, 1, 1) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(0, 0, 0) }, uRefl: { value: 1.0 },
  }]),
  vertexShader: `uniform mat4 textureMatrix; varying vec4 vUvR; varying vec3 vWP;
    #include <common>
    #include <fog_pars_vertex>
    void main() { vUvR = textureMatrix * vec4(position, 1.0); vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform sampler2D tNormal; uniform float uTime, uScale, uDistort, uRefl; uniform vec3 uDeep, uShallow, uAmb, uSunDir, uSunCol; varying vec4 vUvR; varying vec3 vWP;
    #include <common>
    #include <fog_pars_fragment>
    void main() {
      vec2 w = vWP.xz * uScale;
      vec3 n1 = texture2D(tNormal, w + vec2(uTime * 0.018, uTime * 0.011)).xyz * 2.0 - 1.0;
      vec3 n2 = texture2D(tNormal, w * 2.3 + vec2(-uTime * 0.013, uTime * 0.021)).xyz * 2.0 - 1.0;
      vec3 n3 = texture2D(tNormal, w * 0.27 + vec2(uTime * 0.005, -uTime * 0.004)).xyz * 2.0 - 1.0;
      vec2 nxy = (n1.xy + n2.xy * 0.6 + n3.xy * 0.8) * 0.45;
      vec3 N = normalize(vec3(nxy.x, 1.0, nxy.y));
      vec3 V = normalize(cameraPosition - vWP); float dist = length(cameraPosition - vWP);
      float ndv = max(dot(N, V), 0.0);
      float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
      vec2 ruv = vUvR.xy / vUvR.w + nxy * uDistort * (1.0 / (1.0 + dist * 0.01));
      vec3 refl = texture2D(tDiffuse, ruv).rgb;
      vec3 body = mix(uShallow, uDeep, smoothstep(0.0, 0.9, 1.0 - ndv * 0.6)) * uAmb;
      vec3 col = mix(body, refl * 0.82, clamp(fres * 1.25 + 0.14, 0.0, 0.8) * uRefl);
      vec3 H = normalize(uSunDir + V); float sp = pow(max(dot(N, H), 0.0), 420.0) * 6.0 + pow(max(dot(N, H), 0.0), 60.0) * 0.12;
      col += uSunCol * sp;
      gl_FragColor = vec4(col, 1.0);
      #include <fog_fragment>
    }`,
};

export function buildWater(tex, ctx) {
  const out = [];
  const b = MAP.b;
  const seaMat = waterMaterial(tex.waterN, 0x15586c, 0.93, 0.03, 0.05);
  const seaGeo = new THREE.PlaneGeometry(9000, 12000);
  const sea = new THREE.Mesh(seaGeo, seaMat);
  sea.rotation.x = -Math.PI / 2; sea.position.set(b.coastX + 30 - 4500, 0, 0); sea.renderOrder = 1; out.push(sea);
  // shoreline foam
  const foamC = document.createElement('canvas'); foamC.width = 64; foamC.height = 256; const fx = foamC.getContext('2d');
  for (let i = 0; i < 400; i++) { fx.fillStyle = `rgba(255,255,255,${Math.random() * 0.5})`; fx.beginPath(); fx.arc(Math.random() * 64, Math.random() * 256, 1 + Math.random() * 3, 0, 7); fx.fill(); }
  const foamT = new THREE.CanvasTexture(foamC); foamT.wrapS = foamT.wrapT = THREE.RepeatWrapping; foamT.repeat.set(1, 80);
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(4, b.maxZ - b.minZ), new THREE.MeshBasicMaterial({ map: foamT, transparent: true, opacity: 0.55, depthWrite: false }));
  foam.rotation.x = -Math.PI / 2; foam.position.set(b.coastX + 1, 0.04, 0); foam.renderOrder = 2; out.push(foam); ctx.foamTex = foamT;
  // ponds / lakes from the real map (geometry kept in the XY plane so Reflector sees a +Z plane normal)
  const pondMat = waterMaterial(tex.waterN, 0x2a5b4a, 0.88, 0.08, 0.07);
  const bodies = [{ cheap: sea, geo: seaGeo, x: null, z: 0, y: 0, sea: true, deep: 0x0a2f3c, shallow: 0x1b5866, scale: 0.03 }];
  for (const w of MAP.meta.water) {
    const pts = []; let cx = 0, cz = 0, rr = 0; for (let i = 0; i < w.p.length; i += 2) { pts.push(new THREE.Vector2(w.p[i], -w.p[i + 1])); cx += w.p[i]; cz += w.p[i + 1]; } cx /= pts.length; cz /= pts.length;
    for (const p of pts) rr = Math.max(rr, Math.hypot(p.x - cx, -p.y - cz));
    const sg = new THREE.ShapeGeometry(new THREE.Shape(pts), 1);
    const m = new THREE.Mesh(sg, pondMat); m.rotation.x = -Math.PI / 2; m.position.y = w.y; m.renderOrder = 1; out.push(m);
    bodies.push({ cheap: m, geo: sg, x: cx, z: cz, r: rr, y: w.y, deep: 0x10302a, shallow: 0x2a5246, scale: 0.08 });
  }
  const poolMat = waterMaterial(tex.waterN, 0x3fc3e0, 0.72, 0.2, 0.03);
  for (const pl of ctx.pools) { const m = new THREE.Mesh(new THREE.PlaneGeometry(pl.w, pl.d), poolMat); m.rotation.x = -Math.PI / 2; m.position.set(pl.x, pl.y, pl.z); m.renderOrder = 1; out.push(m); }
  for (const m of out) { m.matrixAutoUpdate = false; m.updateMatrix(); m.receiveShadow = true; }
  // one shared planar reflection, attached to the nearest water body only (keeps the cost to one extra render)
  if (ctx.reflections) {
    for (const bd of bodies) {
      const rf = new Reflector(bd.geo, { textureWidth: 1024, textureHeight: 576, clipBias: 0.003, multisample: 0, shader: ReflectWaterShader });
      rf.rotation.copy(bd.cheap.rotation); rf.position.copy(bd.cheap.position); rf.updateMatrix(); rf.matrixAutoUpdate = false; rf.visible = false; rf.renderOrder = 1;
      const u = rf.material.uniforms; u.tNormal.value = tex.waterN; u.uScale.value = bd.scale; u.uDeep.value.set(bd.deep); u.uShallow.value.set(bd.shallow);
      rf.material.fog = true; u.uTime = shared.time; u.uSunDir = shared.sunDir; u.uSunCol = shared.sunCol;
      bd.refl = rf; out.push(rf);
    }
    ctx.waterBodies = bodies;
  }
  return out;
}

// ---------------- trees ----------------
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function colorize(g, fn) {
  const p = g.attributes.position; const c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const [r, gg, b] = fn(p.getX(i), p.getY(i), p.getZ(i), i); c[i * 3] = Math.pow(r, 2.2); c[i * 3 + 1] = Math.pow(gg, 2.2); c[i * 3 + 2] = Math.pow(b, 2.2); }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
}
function clean(g) { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k); return g; }
function blob(r, detail, jitter, rand) {
  const g = new THREE.IcosahedronGeometry(r, detail); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 + (Math.sin(x * 3.1 + y * 2.3) * 0.5 + Math.sin(z * 2.7 - x * 1.9) * 0.5) * jitter + (rand() - 0.5) * jitter * 0.6; p.setXYZ(i, x * k, y * k, z * k); }
  g.computeVertexNormals(); return g;
}
function crown(blobs, base, top, flowers, rand) {
  const parts = [];
  for (const [x, y, z, r, sy] of blobs) {
    const g = blob(r, 0, 0.22, rand); g.scale(1, sy || 1, 1); g.translate(x, y, z);
    colorize(g, (px, py, pz) => { const t = Math.min(1, Math.max(0, (py - (y - r)) / (2 * r))); const v = 0.85 + rand() * 0.2; return [(base[0] + (top[0] - base[0]) * t) * v, (base[1] + (top[1] - base[1]) * t) * v, (base[2] + (top[2] - base[2]) * t) * v]; });
    const cg = clean(g); sphereNormals(cg, x, y, z, sy || 1); parts.push(cg);
  }
  if (flowers) for (let i = 0; i < flowers.n; i++) {
    const [x, y, z, r] = blobs[(rand() * blobs.length) | 0]; const d = new THREE.Vector3().randomDirection(); if (d.y < -0.2) d.y = -d.y;
    const g = new THREE.OctahedronGeometry(0.4 + rand() * 0.25, 0); g.translate(x + d.x * r * 0.95, y + d.y * r * 0.8, z + d.z * r * 0.95);
    colorize(g, () => flowers.c); parts.push(clean(g));
  }
  return parts;
}
// soft canopy shading: normals point away from the blob centre (like a leafy volume)
function sphereNormals(g, cx, cy, cz, sy) {
  const p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) { let x = p.getX(i) - cx, y = (p.getY(i) - cy) / sy, z = p.getZ(i) - cz; const l = Math.hypot(x, y, z) || 1; const fx = n.getX(i), fy = n.getY(i), fz = n.getZ(i); n.setXYZ(i, x / l * 0.75 + fx * 0.25, y / l * 0.75 + fy * 0.25 + 0.15, z / l * 0.75 + fz * 0.25); }
  n.needsUpdate = true; g.normalizeNormals?.();
}
function trunk(h, r0, r1, col, bend = 0) {
  const g = new THREE.CylinderGeometry(r1, r0, h, 6, bend ? 3 : 1, true); g.translate(0, h / 2, 0);
  if (bend) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + Math.pow(y / h, 2) * bend); } g.computeVertexNormals(); }
  return clean(colorize(g, () => col));
}
function frond(len, droop, rot, tilt, y0, col) {
  const seg = 6, pos = [], cl = [];
  for (let i = 0; i < seg; i++) {
    const t0 = i / seg, t1 = (i + 1) / seg;
    const w0 = Math.sin(t0 * Math.PI) * 0.9 + 0.1, w1 = Math.sin(t1 * Math.PI) * 0.9 + 0.1;
    const p = (t, w) => { const x = t * len * Math.cos(tilt), y = y0 + t * len * Math.sin(tilt) - t * t * droop; return [x, y, w]; };
    const a = p(t0, w0), b = p(t1, w1);
    const quad = [[a[0], a[1], -a[2]], [b[0], b[1], -b[2]], [b[0], b[1] + 0.05, b[2]], [a[0], a[1] + 0.05, a[2]]];
    for (const tri of [[0, 1, 2], [0, 2, 3]]) for (const k of tri) { pos.push(...quad[k]); cl.push(Math.pow(col[0], 2.2), Math.pow(col[1], 2.2), Math.pow(col[2], 2.2)); }
    // mid rib lift
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
  g.rotateY(rot); g.computeVertexNormals(); return g;
}

export function treeGeometries() {
  const R = rng(42); const G = {};
  const bark = [0.33, 0.25, 0.18], palmBark = [0.52, 0.45, 0.36];
  // rain tree (ก้ามปู) – wide umbrella
  {
    const parts = [trunk(3.6, 0.42, 0.3, bark, 0.3)];
    const br = trunk(3, 0.18, 0.1, bark); br.rotateZ(0.8); br.translate(0, 3, 0); parts.push(br);
    const br2 = trunk(3, 0.18, 0.1, bark); br2.rotateZ(-0.7); br2.rotateY(1.2); br2.translate(0, 3.1, 0); parts.push(br2);
    const bl = []; for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, rr = i === 0 ? 0 : 3.6; bl.push([Math.cos(a) * rr, 5.6 + R() * 0.8, Math.sin(a) * rr, 2.6 + R() * 0.6, 0.55]); }
    parts.push(...crown(bl, [0.16, 0.3, 0.1], [0.36, 0.55, 0.2], null, R));
    G.rain = mergeGeometries(parts);
  }
  // nonsi (นนทรี) – KU symbol tree with yellow blossoms
  {
    const parts = [trunk(3.0, 0.24, 0.17, bark, 0.15)];
    const bl = [[0, 4.6, 0, 1.9, 0.9], [1.3, 4.1, 0.4, 1.4, 0.8], [-1.2, 4.2, -0.5, 1.4, 0.8], [0.3, 5.4, -0.9, 1.3, 0.8], [-0.4, 4.0, 1.2, 1.3, 0.8]];
    parts.push(...crown(bl, [0.18, 0.34, 0.12], [0.4, 0.58, 0.2], { n: 14, c: [0.98, 0.78, 0.12] }, R));
    G.nonsi = mergeGeometries(parts);
  }
  // generic forest tree
  {
    const parts = [trunk(4, 0.3, 0.2, bark)];
    parts.push(...crown([[0, 5.4, 0, 2.4, 1.1], [0.9, 4.6, 0.6, 1.8], [-0.9, 4.8, -0.4, 1.8], [0, 6.8, 0, 1.6]], [0.1, 0.22, 0.08], [0.24, 0.42, 0.14], null, R));
    G.forest = mergeGeometries(parts);
  }
  // mango / round tree
  {
    const parts = [trunk(2.4, 0.3, 0.22, bark)];
    parts.push(...crown([[0, 3.8, 0, 2.2, 0.85], [1, 3.4, 0.5, 1.5], [-1, 3.5, -0.4, 1.5]], [0.12, 0.26, 0.08], [0.26, 0.46, 0.15], null, R));
    G.round = mergeGeometries(parts);
  }
  // coconut palm
  {
    const parts = [trunk(8.5, 0.24, 0.17, palmBark, 1.2)];
    for (let i = 0; i < 11; i++) parts.push(frond(4.2 + R() * 0.8, 2.2, i / 11 * Math.PI * 2 + R() * 0.3, 0.35 + R() * 0.3, 8.4, [0.25 + R() * 0.08, 0.45 + R() * 0.1, 0.14]));
    for (let i = 0; i < 4; i++) { const c = new THREE.IcosahedronGeometry(0.22, 0); c.translate(1.2 + Math.cos(i * 1.6) * 0.3, 8.1, Math.sin(i * 1.6) * 0.3); parts.push(clean(colorize(c, () => [0.42, 0.36, 0.14]))); }
    G.palm = mergeGeometries(parts.map(p => { if (!p.attributes.normal) p.computeVertexNormals(); return p.index ? p.toNonIndexed() : p; }));
  }
  // royal (bottle) palm
  {
    const g = new THREE.CylinderGeometry(0.22, 0.32, 9, 8, 6); g.translate(0, 4.5, 0);
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); const k = 1 + Math.sin(y / 9 * Math.PI) * 0.25; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } g.computeVertexNormals();
    const parts = [clean(colorize(g, (x, y) => y > 8 ? [0.35, 0.5, 0.25] : [0.72, 0.7, 0.66]))];
    for (let i = 0; i < 12; i++) parts.push(frond(3.6, 1.8, i / 12 * Math.PI * 2, 0.6 + R() * 0.3, 9.2, [0.22, 0.44, 0.14]));
    G.royal = mergeGeometries(parts.map(q => q.index ? q.toNonIndexed() : q));
  }
  // bush
  {
    const parts = crown([[0, 0.6, 0, 0.9, 0.75], [0.7, 0.5, 0.2, 0.7, 0.7], [-0.6, 0.5, -0.3, 0.7, 0.7]], [0.14, 0.3, 0.1], [0.3, 0.52, 0.18], null, R);
    G.bush = mergeGeometries(parts);
  }
  // flowering bush (bougainvillea)
  {
    const parts = crown([[0, 0.7, 0, 1.0, 0.8], [0.8, 0.6, 0.2, 0.7]], [0.16, 0.32, 0.1], [0.3, 0.5, 0.16], { n: 10, c: [0.88, 0.2, 0.55] }, R);
    G.flower = mergeGeometries(parts);
  }
  // rock
  { const g = blob(1, 0, 0.35, R); g.scale(1, 0.6, 1); G.rock = clean(colorize(g, () => [0.5, 0.49, 0.46])); }
  return G;
}

export function foliageMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.time;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #else
          vec3 ip = vec3(0.0);
        #endif
        float sway = max(0.0, position.y - 1.8) * 0.045;
        transformed.x += sin(uTime * 1.3 + ip.x * 0.11 + ip.z * 0.07 + position.y * 0.3) * sway;
        transformed.z += cos(uTime * 1.1 + ip.z * 0.09 + position.x * 0.2) * sway * 0.7;`);
  };
  return m;
}

// Instanced scatter, chunked for culling. items: [{type, x, z, s, r, c}]
export function buildTreeInstances(items, geos, mat, castShadow) {
  const groups = new Map();
  for (const it of items) { const k = it.type + '|' + Math.floor(it.x / 220) + '|' + Math.floor(it.z / 220); let a = groups.get(k); if (!a) { a = []; groups.set(k, a); } a.push(it); }
  const out = []; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler(), c = new THREE.Color();
  for (const [k, arr] of groups) {
    const type = k.split('|')[0];
    const im = new THREE.InstancedMesh(geos[type], mat, arr.length);
    arr.forEach((it, i) => {
      p.set(it.x, it.y, it.z); e.set(it.tx || 0, it.r, it.tz || 0); q.setFromEuler(e); s.set(it.s, it.s * (it.sy || 1), it.s);
      m4.compose(p, q, s); im.setMatrixAt(i, m4);
      c.setRGB(it.c[0], it.c[1], it.c[2]); im.setColorAt(i, c);
    });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere(); im.castShadow = castShadow && type !== 'rock'; im.receiveShadow = true;
    out.push(im);
  }
  return out;
}

// ---------------- low-detail trees + LOD manager ----------------
export function treeGeometriesLo() {
  const R = rng(7); const G = {};
  const mk = (h, r0, cr, cy, sy, base, top, bark = [0.33, 0.25, 0.18]) => {
    const t = new THREE.CylinderGeometry(r0 * 0.7, r0, h, 4, 1, true); t.translate(0, h / 2, 0); colorize(t, () => bark);
    const c = blob(cr, 1, 0.18, R); c.scale(1, sy, 1); c.translate(0, cy, 0); colorize(c, (x, y) => { const k = Math.min(1, Math.max(0, (y - cy + cr) / (2 * cr))); return [base[0] + (top[0] - base[0]) * k, base[1] + (top[1] - base[1]) * k, base[2] + (top[2] - base[2]) * k]; });
    const cc = clean(c); sphereNormals(cc, 0, cy, 0, sy); return mergeGeometries([clean(t), cc]);
  };
  G.rain = mk(3.8, 0.4, 5.6, 6.0, 0.45, [0.16, 0.3, 0.1], [0.36, 0.55, 0.2]);
  G.nonsi = mk(3.0, 0.24, 2.6, 4.6, 0.85, [0.2, 0.34, 0.12], [0.5, 0.56, 0.18]);
  G.forest = mk(4, 0.3, 2.6, 5.6, 1.15, [0.1, 0.22, 0.08], [0.24, 0.42, 0.14]);
  G.round = mk(2.4, 0.3, 2.3, 3.7, 0.85, [0.12, 0.26, 0.08], [0.26, 0.46, 0.15]);
  G.palm = mk(8.5, 0.22, 2.4, 8.6, 0.35, [0.22, 0.4, 0.12], [0.3, 0.5, 0.16], [0.52, 0.45, 0.36]);
  G.royal = mk(9, 0.3, 2.2, 9.4, 0.4, [0.2, 0.4, 0.12], [0.28, 0.48, 0.16], [0.72, 0.7, 0.66]);
  G.bush = mk(0.2, 0.05, 1.0, 0.6, 0.7, [0.14, 0.3, 0.1], [0.3, 0.52, 0.18]);
  G.flower = G.bush; G.rock = null;
  G.generic = mk(4.2, 0.3, 2.5, 5.2, 0.95, [0.13, 0.27, 0.09], [0.3, 0.48, 0.17]);
  return G;
}

export function buildTreeLOD(items, geos, geosLo, mat, castShadow) {
  const CH = 300; const groups = new Map();
  const LOS = { rain: [1.95, 1.0, 1.95], nonsi: [1.0, 0.92, 1.0], forest: [1.05, 1.12, 1.05], round: [0.95, 0.72, 0.95], palm: [0.6, 1.65, 0.6], royal: [0.6, 1.8, 0.6], bush: [0.38, 0.2, 0.38], flower: [0.38, 0.2, 0.38] };
  for (const it of items) { const k = Math.floor(it.x / CH) + '|' + Math.floor(it.z / CH); let a = groups.get(k); if (!a) { a = []; groups.set(k, a); } a.push(it); }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler(), c = new THREE.Color();
  const chunks = []; const root = new THREE.Group();
  for (const [k, arr] of groups) {
    const [ix, iz] = k.split('|').map(Number);
    const byType = {}; for (const it of arr) (byType[it.type] = byType[it.type] || []).push(it);
    const ch = { cx: (ix + 0.5) * CH, cz: (iz + 0.5) * CH, hi: [], lo: [], state: -1 };
    for (const [type, list] of Object.entries(byType)) {
      const geo = geos[type]; if (!geo) continue;
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((it, i) => { p.set(it.x, it.y, it.z); e.set(0, it.r, 0); q.setFromEuler(e); s.set(it.s, it.s * (it.sy || 1), it.s); m4.compose(p, q, s); im.setMatrixAt(i, m4); c.setRGB(it.c[0], it.c[1], it.c[2]); im.setColorAt(i, c); });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere(); im.receiveShadow = true; im.castShadow = castShadow && type !== 'rock'; im.visible = false; im.matrixAutoUpdate = false;
      ch.hi.push(im); root.add(im);
    }
    // far LOD: one generic tree mesh per chunk, shaped per species by non-uniform scale
    const loList = arr.filter(it => LOS[it.type]);
    if (loList.length && geosLo.generic) {
      const im = new THREE.InstancedMesh(geosLo.generic, mat, loList.length);
      loList.forEach((it, i) => { const k = LOS[it.type]; p.set(it.x, it.y, it.z); e.set(0, it.r, 0); q.setFromEuler(e); s.set(it.s * k[0], it.s * k[1], it.s * k[2]); m4.compose(p, q, s); im.setMatrixAt(i, m4); const pc = it.type === 'palm' || it.type === 'royal' ? 1.15 : it.type === 'nonsi' ? 1.08 : 1; c.setRGB(it.c[0] * pc, it.c[1] * pc, it.c[2]); im.setColorAt(i, c); });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere(); im.receiveShadow = false; im.castShadow = false; im.visible = false; im.matrixAutoUpdate = false;
      ch.lo.push(im); root.add(im);
    }
    chunks.push(ch);
  }
  // Per-instance LOD + view culling. Each InstancedMesh keeps its full source matrices/colours; on update we compact the
  // instances that are (a) inside the right distance band and (b) inside the camera's horizontal view cone (+margin) or
  // close to the camera (shadow casters around the player), and draw only those. Trees behind the camera were the single
  // largest triangle cost after grass (≈1.1 M of 3.2 M main-view triangles at the main gate, measured with renderer.info).
  const all = [];
  for (const ch of chunks) for (const [list, band] of [[ch.hi, 0], [ch.lo, 1]]) for (const im of list) {
    const n = im.count; const src = im.instanceMatrix.array.slice(0, n * 16); const col = im.instanceColor ? im.instanceColor.array.slice(0, n * 3) : null;
    const px = new Float32Array(n), pz = new Float32Array(n), rk = new Float32Array(n); for (let i = 0; i < n; i++) { px[i] = src[i * 16 + 12]; pz[i] = src[i * 16 + 14]; rk[i] = ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1; }
    all.push({ im, band, n, src, col, px, pz, rk });
  }
  const last = { x: 1e9, z: 1e9, fx: 0, fz: 0, hi: 0, lo: 0, t: 0 };
  return {
    root, chunks,
    update(x, z, hiDist, loDist, fwd, cosLim = 0.3) {
      const fx = fwd ? fwd.x : 0, fz = fwd ? fwd.z : 0, fl = Math.hypot(fx, fz) || 1, ux = fx / fl, uz = fz / fl;
      const now = performance.now();
      const moved = Math.hypot(x - last.x, z - last.z) > 6 || ux * last.fx + uz * last.fz < 0.985 || hiDist !== last.hi || now - last.t > 700;
      if (!moved) return; Object.assign(last, { x, z, fx: ux, fz: uz, hi: hiDist, lo: loDist, t: now });
      const hi2 = hiDist * hiDist, lo2 = loDist * loDist, NEAR2 = 60 * 60; // all trees within 60 m stay (their shadows can fall into view)
      for (const e of all) {
        const { im, band, n, src, col, px, pz, rk } = e; const dst = im.instanceMatrix.array, dc = im.instanceColor ? im.instanceColor.array : null; let k = 0;
        for (let i = 0; i < n; i++) {
          const dx = px[i] - x, dz = pz[i] - z, d2 = dx * dx + dz * dz;
          if (band === 0 ? d2 >= hi2 : (d2 < hi2 || d2 >= lo2)) continue;
          if (d2 > NEAR2 && fwd) { const d = Math.sqrt(d2); if ((dx * ux + dz * uz) / d < cosLim) continue;
            // far band thinning: beyond ~650 m each tree is a few pixels inside haze — keep a stable random subset (100 % → 28 %)
            if (band === 1 && d > 650 && rk[i] > 1 - 0.72 * Math.min(1, (d - 650) / Math.max(1, loDist - 650))) continue; }
          dst.set(src.subarray(i * 16, i * 16 + 16), k * 16); if (dc) dc.set(col.subarray(i * 3, i * 3 + 3), k * 3);
          k++;
        }
        im.count = k; im.visible = k > 0;
        if (k) { im.instanceMatrix.clearUpdateRanges(); im.instanceMatrix.addUpdateRange(0, k * 16); im.instanceMatrix.needsUpdate = true; if (im.instanceColor) { im.instanceColor.clearUpdateRanges(); im.instanceColor.addUpdateRange(0, k * 3); im.instanceColor.needsUpdate = true; } }
      }
    },
  };
}
