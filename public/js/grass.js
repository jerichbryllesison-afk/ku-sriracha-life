// GPU grass: instanced blade clumps that wrap around the camera (toroidal), placed on lawns from the
// real land-use map, sitting on the heightmap, coloured from the terrain grass texture and swaying in the wind.
import * as THREE from 'three';
import { MAP } from './mapdata.js';
import { shared } from './nature.js';

export function buildGrass(terrainMat, count = 40000, radius = 34, opts = {}) {
  const far = opts.lod === 'far', inner = opts.inner || 0;
  const b = MAP.b;
  // heightmap as a filterable half-float texture (built after all flattening)
  const hd = new Uint16Array(MAP.nx * MAP.nz);
  for (let i = 0; i < hd.length; i++) hd[i] = THREE.DataUtils.toHalfFloat(MAP.heights[i]);
  const hTex = new THREE.DataTexture(hd, MAP.nx, MAP.nz, THREE.RedFormat, THREE.HalfFloatType);
  hTex.magFilter = hTex.minFilter = THREE.LinearFilter; hTex.needsUpdate = true;

  // near clump: 6 tapered blades × 2 segments (30 verts); far clump: 3 single-triangle blades (9 verts) — the far ring
  // only covers what the near ring does not, and costs ~10× fewer vertices per clump.
  const pos = [], tip = [], nrm = [], idx = []; let n = 0;
  const NB = far ? 3 : 6;
  for (let k = 0; k < NB; k++) {
    const a = k * 2.39996 + 0.3, ca = Math.cos(a), sa = Math.sin(a), w = (far ? 0.05 : 0.022) + (k % 3) * 0.006;
    const rr = 0.04 + (k / NB) * (far ? 0.3 : 0.16), ox = Math.cos(a * 1.31) * rr, oz = Math.sin(a * 1.31) * rr;
    const lean = 0.1 + (k % 4) * 0.06, hk = 0.7 + ((k * 7) % 5) * 0.09;
    const v = far ? [[-w, 0, 0], [w, 0, 0], [0, hk, lean]] : [[-w, 0, 0], [w, 0, 0], [-w * 0.7, 0.5 * hk, lean * 0.35], [w * 0.7, 0.5 * hk, lean * 0.35], [0, hk, lean]];
    for (const [x, y, z] of v) { pos.push(ox + x * ca - z * sa, y, oz + x * sa + z * ca); tip.push(y / hk); nrm.push(-sa, ca); } // blade face normal (horizontal part)
    if (far) idx.push(n, n + 1, n + 2); else idx.push(n, n + 1, n + 3, n, n + 3, n + 2, n + 2, n + 3, n + 4);
    n += v.length;
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aTip', new THREE.Float32BufferAttribute(tip, 1)); g.setAttribute('aN', new THREE.Float32BufferAttribute(nrm, 2));
  g.setIndex(idx);
  const off = new Float32Array(count * 3); let s = 12345;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < count; i++) { off[i * 3] = (rnd() * 2 - 1) * radius; off[i * 3 + 1] = (rnd() * 2 - 1) * radius; off[i * 3 + 2] = rnd(); }
  g.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 3));
  g.instanceCount = count;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

  const U = {
    uCam: { value: new THREE.Vector2() }, uR: { value: radius }, uH: { value: hTex }, uLand: { value: MAP.landTex }, uSdf: { value: MAP.sdfTex },
    uMin: { value: new THREE.Vector2(b.minX, b.minZ) }, uSize: { value: new THREE.Vector2(b.maxX - b.minX, b.maxZ - b.minZ) },
    uHMin: { value: new THREE.Vector2(b.minX, b.minZ) }, uHSize: { value: new THREE.Vector2((MAP.nx - 1) * MAP.step, (MAP.nz - 1) * MAP.step) }, uHN: { value: new THREE.Vector2(MAP.nx, MAP.nz) },
    uGrass: { value: terrainMat.map }, uTime: shared.time, uCoast: { value: b.coastX }, uCanopy: { value: MAP.canopyTex || MAP.landTex }, uSunDir: shared.sunDir, uSunCol: shared.sunCol, uInner: { value: inner },
  };
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      attribute vec3 aOff; attribute float aTip; attribute vec2 aN; varying vec3 vGC; varying float vTip; varying vec3 vWP; varying float vDry; varying float vVar; uniform float uInner;
      uniform vec2 uCam; uniform float uR; uniform sampler2D uH; uniform sampler2D uLand; uniform sampler2D uSdf; uniform sampler2D uGrass; uniform sampler2D uCanopy;
      uniform vec2 uMin, uSize, uHMin, uHSize, uHN; uniform float uTime, uCoast;`)
      .replace('#include <beginnormal_vertex>', 'float rot0 = aOff.z * 6.2831; vec2 bn = vec2(aN.x * cos(rot0) - aN.y * sin(rot0), aN.x * sin(rot0) + aN.y * cos(rot0)); vec3 objectNormal = normalize(vec3(bn.x * 0.3, 0.9, bn.y * 0.3));')
      .replace('#include <begin_vertex>', `
        vec2 wp = uCam + mod(aOff.xy - uCam + uR, 2.0 * uR) - uR;
        vec2 luv = (wp - uMin) / uSize;
        vec4 lu = texture2D(uLand, luv);
        vec4 sd = (texture2D(uSdf, luv) * 255.0 - 128.0) / 8.0;
        float urban = clamp(1.0 - (lu.r + lu.g + lu.b + lu.a), 0.0, 1.0);
        float dens = lu.r + lu.g * 0.55 + urban * 0.85 * smoothstep(3.0, 7.0, sd.a);
        dens *= smoothstep(0.6, 1.4, sd.r) * smoothstep(0.25, 0.8, sd.g) * smoothstep(0.4, 1.2, sd.a) * smoothstep(0.5, 2.0, sd.b);
        dens *= smoothstep(uCoast + 50.0, uCoast + 62.0, wp.x);
        float cn = texture2D(uCanopy, luv).r; dens *= 1.0 - cn * 0.6;
        float patchH = texture2D(uGrass, wp * 0.021 + 0.17).g;
        vDry = smoothstep(0.5, 0.78, texture2D(uGrass, wp * 0.0131 + 0.31).g) * (1.0 - cn);
        float dist = length(wp - uCam);
        float fade = smoothstep(uR, uR * 0.55, dist) * (uInner > 0.0 ? smoothstep(uInner * 0.8, uInner, dist) : 1.0);
        float keep = step(aOff.z, dens);
        // mowed campus lawns stay short; unkempt / forest-edge grass grows taller and patchier
        float hgt = (0.15 + aOff.z * 0.2 + lu.g * 0.34) * (0.72 + patchH * 0.6) * fade * keep;
        float wid = hgt > 0.02 ? 0.8 + hgt * 0.5 : 0.0;
        vVar = fract(aOff.z * 91.7 + aOff.x * 0.137);
        vec2 huv = (wp - uHMin) / uHSize * (uHN - 1.0) / uHN + 0.5 / uHN;
        float gy = texture2D(uH, huv).r;
        float sw = sin(uTime * 1.7 + wp.x * 0.35 + wp.y * 0.21) * 0.6 + sin(uTime * 3.1 + wp.x * 1.3) * 0.25;
        float rot = aOff.z * 6.2831;
        float cr = cos(rot), sr = sin(rot);
        vec3 lp = vec3(position.x * cr - position.z * sr, position.y, position.x * sr + position.z * cr);
        vec3 transformed = vec3(wp.x + lp.x * wid, gy - 0.04 + lp.y * hgt, wp.y + lp.z * wid);
        transformed.xz += vec2(0.12, 0.06) * sw * aTip * aTip * hgt * 1.6;
        vec2 tuv = wp / 6.5; float macro = texture2D(uGrass, wp * 0.0093).g;
        vGC = texture2D(uGrass, tuv).rgb * (0.7 + macro * 0.7); vTip = aTip; vWP = transformed;`)
      .replace('#include <project_vertex>', `vec4 mvPosition = viewMatrix * vec4(transformed, 1.0); gl_Position = projectionMatrix * mvPosition;`)
      .replace('#include <worldpos_vertex>', `vec4 worldPosition = vec4(transformed, 1.0);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGC; varying float vTip; varying vec3 vWP; varying float vDry; uniform vec3 uSunDir; uniform vec3 uSunCol; varying float vVar;')
      .replace('#include <map_fragment>', `// per-clump hue / value variation, straw-coloured dry patches, darker self-shadowed base (no uniform neon green)
        vec3 tipC = vGC * mix(vec3(0.92, 0.96, 0.8), vec3(1.08, 1.02, 0.78), vVar);
        tipC = mix(tipC, vec3(0.46, 0.41, 0.22), clamp(vDry * 0.85 + step(0.9, vVar) * 0.35, 0.0, 1.0));
        tipC = mix(tipC, vec3(dot(tipC, vec3(0.3, 0.59, 0.11))), 0.15);
        diffuseColor.rgb *= mix(vGC * 0.66, tipC * (1.08 + vVar * 0.18), smoothstep(0.0, 1.0, vTip));`)
      .replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''))
      .replace('#include <opaque_fragment>', `{ vec3 Vd = normalize(vWP - cameraPosition); float bl = pow(max(dot(Vd, uSunDir), 0.0), 3.0); outgoingLight += diffuseColor.rgb * uSunCol * (0.03 + bl * 0.35) * vTip; }
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'grass3';
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false; mesh.matrixAutoUpdate = false; mesh.castShadow = false; mesh.receiveShadow = true;
  return { mesh, count, setDensity(k) { g.instanceCount = Math.max(1, Math.floor(count * k)); }, update(cam) { U.uCam.value.set(cam.x, cam.z); } };
}
