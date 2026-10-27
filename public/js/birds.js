// Ambient birds: small flocks gliding and flapping over the campus. Each flock follows a smooth wandering loop;
// members keep cohesive offsets with their own wobble, and wing flaps alternate with glides (flap cadence ~4 Hz).
import * as THREE from 'three';

export function buildBirds(scene, center, count = 36) {
  // one bird = body + two wings (wings hinge at the body; vertex shader folds them)
  const pos = [
    // body (thin diamond)
    0, 0, 0.18, 0.03, 0, -0.12, -0.03, 0, -0.12,
    // left wing (x<0)
    -0.02, 0, 0.05, -0.36, 0.02, -0.02, -0.02, 0, -0.07,
    // right wing
    0.02, 0, 0.05, 0.02, 0, -0.07, 0.36, 0.02, -0.02,
  ];
  const wing = [0, 0, 0, 0, 1, 0, 0, 1, 0]; // per-vertex: 1 = wing tip moves
  const side = [0, 0, 0, -1, -1, -1, 1, 1, 1];
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aWing', new THREE.Float32BufferAttribute(wing, 1)); g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
  const ph = new Float32Array(count); for (let i = 0; i < count; i++) ph[i] = Math.random() * 100;
  g.setAttribute('aPh', new THREE.InstancedBufferAttribute(ph, 1));
  g.instanceCount = count;
  const mat = new THREE.MeshBasicMaterial({ color: 0x1b1d1f, side: THREE.DoubleSide });
  const U = { uTime: { value: 0 } };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aWing; attribute float aSide; attribute float aPh; uniform float uTime;')
      .replace('#include <begin_vertex>', `vec3 transformed = position;
        float cyc = mod(uTime * 0.35 + aPh, 6.0); float flapping = step(cyc, 3.5); // flap bursts, then glide
        float a = (sin(uTime * 24.0 + aPh * 7.0) * 0.75 * flapping + 0.12) * aWing;
        transformed.y += abs(transformed.x) * sin(a) * 1.2; transformed.x *= mix(1.0, cos(a), aWing);`);
  };
  const mesh = new THREE.InstancedMesh(g, mat, count); mesh.frustumCulled = false; mesh.castShadow = false;
  scene.add(mesh);
  const flocks = []; const nf = 4; const per = Math.ceil(count / nf);
  for (let f = 0; f < nf; f++) flocks.push({ cx: center.x + (Math.random() - 0.5) * 700, cz: center.z + (Math.random() - 0.5) * 700, r: 60 + Math.random() * 120, h: 28 + Math.random() * 30, sp: 0.06 + Math.random() * 0.05, a: Math.random() * 6.28, dir: Math.random() < 0.5 ? 1 : -1 });
  const off = []; for (let i = 0; i < count; i++) off.push([(Math.random() - 0.5) * 14, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 14, Math.random() * 6.28]);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1.4, 1.4, 1.4), p = new THREE.Vector3(), e = new THREE.Euler();
  let t = 0;
  return {
    mesh,
    update(dt, focus, night) {
      t += dt; U.uTime.value = t; mesh.visible = night < 0.6;
      if (!mesh.visible) return;
      for (const fl of flocks) {
        fl.a += fl.sp * dt * fl.dir;
        // drift the loop centre slowly so flocks roam; keep them within ~900 m of the player
        fl.cx += Math.sin(t * 0.03 + fl.r) * dt * 2; fl.cz += Math.cos(t * 0.027 + fl.h) * dt * 2;
        const dx = fl.cx - focus.x, dz = fl.cz - focus.z; if (dx * dx + dz * dz > 900 * 900) { fl.cx = focus.x - dx * 0.5; fl.cz = focus.z - dz * 0.5; }
      }
      for (let i = 0; i < count; i++) {
        const fl = flocks[Math.min(nf - 1, (i / per) | 0)]; const o = off[i];
        const a = fl.a + o[0] * 0.004;
        const x = fl.cx + Math.cos(a) * fl.r + o[0] + Math.sin(t * 0.7 + o[3]) * 2, z = fl.cz + Math.sin(a) * fl.r + o[2] + Math.cos(t * 0.6 + o[3]) * 2, y = fl.h + o[1] + Math.sin(t * 0.5 + o[3]) * 1.5;
        const hx = -Math.sin(a) * fl.dir, hz = Math.cos(a) * fl.dir; // tangent heading
        p.set(x, y, z); e.set(0, Math.atan2(hx, hz), -fl.dir * 0.25); q.setFromEuler(e); m4.compose(p, q, s); mesh.setMatrixAt(i, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
