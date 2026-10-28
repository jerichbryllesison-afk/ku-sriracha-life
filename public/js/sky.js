// Sky, sun/moon lighting, day-night cycle, clouds, stars, rain + lightning.
import * as THREE from 'three';

// Custom analytic sky dome: deep blue zenith, bright horizon, sun disc + glow, sunset tint.
class Sky extends THREE.Mesh {
  constructor() {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { sunPosition: { value: new THREE.Vector3(0, 1, 0) }, uZenith: { value: new THREE.Color('#2a6fd1') }, uHorizon: { value: new THREE.Color('#cfe4f6') }, uGround: { value: new THREE.Color('#8fa2ad') }, uSunColor: { value: new THREE.Color('#fff4dc') }, uSunset: { value: new THREE.Color('#ff8a3d') }, uGolden: { value: 0 }, uBright: { value: 1 }, turbidity: { value: 0 }, rayleigh: { value: 0 }, mieCoefficient: { value: 0 }, mieDirectionalG: { value: 0 } },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
      fragmentShader: `uniform vec3 sunPosition; uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uGround; uniform vec3 uSunColor; uniform vec3 uSunset; uniform float uGolden; uniform float uBright; varying vec3 vDir;
        void main(){ vec3 d = normalize(vDir); vec3 sd = normalize(sunPosition); float h = d.y;
          float t = pow(clamp(h, 0.0, 1.0), 0.42);
          vec3 col = mix(uHorizon, uZenith, t);
          col = mix(col, uGround, smoothstep(0.0, -0.25, h));
          float cs = dot(d, sd);
          float horizonBand = pow(1.0 - clamp(abs(h), 0.0, 1.0), 5.0);
          col += uSunset * horizonBand * (0.35 + 0.65 * max(cs, 0.0)) * uGolden * 1.4;
          float disc = smoothstep(0.99955, 0.99975, cs) * step(-0.02, h);
          float glow = pow(max(cs, 0.0), 180.0) * 1.6 + pow(max(cs, 0.0), 12.0) * 0.22;
          col += uSunColor * (glow + disc * 40.0);
          gl_FragColor = vec4(col * uBright, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    super(new THREE.SphereGeometry(1, 48, 24), mat);
  }
}

const tmpV = new THREE.Vector3();
const C = (h) => new THREE.Color(h);
const lerpColor = (a, b, t) => a.clone().lerp(b, t);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class SkySystem {
  constructor(renderer, scene, opts) {
    this.renderer = renderer; this.scene = scene; this.opts = opts;
    this.sky = new Sky(); this.sky.scale.setScalar(9000); this.sky.frustumCulled = false;
    scene.add(this.sky);
    // separate scene for env-map generation
    this.envScene = new THREE.Scene(); this.envSky = new Sky(); this.envSky.scale.setScalar(900); this.envScene.add(this.envSky);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envRT = null; this.lastEnvSun = new THREE.Vector3(0, -2, 0); this.lastEnvWeather = '';

    this.sun = new THREE.DirectionalLight(0xffffff, 3); this.sun.position.set(100, 200, 50);
    this.sun.castShadow = opts.shadows > 0;
    if (this.sun.castShadow) {
      const s = opts.shadows; this.sun.shadow.mapSize.set(s, s);
      const ext = opts.shadowExtent || 90; const cam = this.sun.shadow.camera;
      cam.left = -ext; cam.right = ext; cam.top = ext; cam.bottom = -ext; cam.near = 1; cam.far = 600;
      this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.04; this.shadowExt = ext;
    }
    scene.add(this.sun); scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x55503a, 0.6); scene.add(this.hemi);

    // stars
    const N = 1800, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { tmpV.randomDirection(); if (tmpV.y < 0) tmpV.y = -tmpV.y; tmpV.multiplyScalar(4000); pos.set([tmpV.x, tmpV.y, tmpV.z], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
    this.stars = new THREE.Points(sg, this.starMat); this.stars.frustumCulled = false; this.stars.renderOrder = -1; scene.add(this.stars);
    // moon
    const mc = document.createElement('canvas'); mc.width = mc.height = 128; const mx = mc.getContext('2d');
    const gr = mx.createRadialGradient(64, 64, 10, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.45, 'rgba(240,240,225,1)'); gr.addColorStop(0.5, 'rgba(200,210,255,0.35)'); gr.addColorStop(1, 'rgba(200,210,255,0)');
    mx.fillStyle = gr; mx.fillRect(0, 0, 128, 128); mx.fillStyle = 'rgba(180,180,170,0.5)'; [[50, 50, 9], [76, 70, 7], [60, 80, 5]].forEach(([x, y, r]) => { mx.beginPath(); mx.arc(x, y, r, 0, 7); mx.fill(); });
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(mc), transparent: true, depthWrite: false, fog: false }));
    this.moon.scale.setScalar(260); this.moon.renderOrder = -1; scene.add(this.moon);

    // clouds dome (procedural shader)
    this.cloudMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.BackSide, fog: false,
      uniforms: { uTime: { value: 0 }, uCover: { value: 0.45 }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uLight: { value: new THREE.Color(1, 1, 1) }, uShade: { value: new THREE.Color(0.6, 0.65, 0.72) }, uNight: { value: 0 } },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*p; }`,
      fragmentShader: `uniform float uTime; uniform float uCover; uniform vec3 uSunDir; uniform vec3 uLight; uniform vec3 uShade; uniform float uNight; varying vec3 vDir;
        float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
        float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*n(p); p*=2.03; a*=.5; } return v; }
        void main(){ if(vDir.y<0.02) discard; vec2 uv = vDir.xz/(vDir.y+0.18)*1.6; uv += vec2(uTime*0.006, uTime*0.002);
          float d = fbm(uv); float c = smoothstep(1.0-uCover, 1.0-uCover+0.22, d);
          float edge = smoothstep(0.02, 0.25, vDir.y); c *= edge;
          float lit = clamp(dot(normalize(vec3(vDir.x,0.3,vDir.z)), normalize(uSunDir))*0.5+0.5, 0., 1.);
          vec3 col = mix(uShade, uLight, clamp(lit*0.55 + (d - (1.0 - uCover)) * 1.6, 0.0, 1.0));
          col *= mix(1.0, 0.18, uNight);
          gl_FragColor = vec4(col, c*0.92); }`,
    });
    this.clouds = new THREE.Mesh(new THREE.SphereGeometry(3500, 32, 16), this.cloudMat); this.clouds.frustumCulled = false; this.clouds.renderOrder = -1; scene.add(this.clouds);

    // rain
    const RN = opts.rain || 6000; const rp = new Float32Array(RN * 6); this.rainN = RN;
    for (let i = 0; i < RN; i++) { const x = (Math.random() - 0.5) * 80, y = Math.random() * 40, z = (Math.random() - 0.5) * 80; rp.set([x, y, z, x + 0.05, y - 0.7, z], i * 6); }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xaab6c4, transparent: true, opacity: 0.35, depthWrite: false }));
    this.rain.frustumCulled = false; this.rain.visible = false; scene.add(this.rain);
    this.rainAmt = 0; this.flash = 0; this.nextFlash = 10;

    this.night = 0; this.sunDir = new THREE.Vector3(0, 1, 0);
    this.fogDay = C('#b3c6d4'); this.fogSunset = C('#e8a87c'); this.fogNight = C('#1a2638'); this.fogRain = C('#7f8b96');
  }

  skyColors(u, night, golden, overcast) {
    const day = 1 - night;
    u.uZenith.value.copy(lerpColor(lerpColor(C('#2266cc'), C('#3a5c8a'), golden * 0.5), C('#071022'), night)).lerp(C('#8a96a3'), overcast * 0.85);
    u.uHorizon.value.copy(lerpColor(lerpColor(C('#cde3f5'), C('#f4c79a'), golden), C('#1a2a44'), night)).lerp(C('#b8c2cb'), overcast * 0.8);
    u.uGround.value.copy(lerpColor(C('#9fb0bb'), C('#0b1220'), night));
    u.uSunColor.value.copy(lerpColor(C('#fff2d6'), C('#ffb070'), golden)).multiplyScalar(day * (1 - overcast * 0.85));
    u.uGolden.value = golden * day; u.uBright.value = 0.55 + day * 0.75;
  }
  setShadows(size, ext) {
    this.sun.castShadow = size > 0;
    if (size > 0) {
      this.sun.shadow.mapSize.set(size, size); if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
      const cam = this.sun.shadow.camera; cam.left = -ext; cam.right = ext; cam.top = ext; cam.bottom = -ext; cam.updateProjectionMatrix(); this.shadowExt = ext;
    }
  }

  update(dt, hour, weather, focus, camera) {
    const t = (hour - 6) / 12; // 0 sunrise, 1 sunset
    // Art-directed sun path: azimuth sweeps east → west on the southern side; elevation peaks at ~46° instead of the
    // near-zenith tropical noon, so buildings, trees and characters keep readable modelling and shadow length all day
    // (an overhead sun flattens everything — the main reason the midday build looked artificial next to the 07:40 one).
    const arc = Math.sin(t * Math.PI), el = arc * 0.8, ce = Math.cos(el);
    const hx = Math.cos(t * Math.PI), hz = 0.45, hl = Math.hypot(hx, hz);
    const sunDir = this.sunDir.set(hx / hl * ce, Math.sin(el), hz / hl * ce);
    const elev = sunDir.y;
    const night = 1 - sstep(-0.12, 0.08, elev); this.night = night;
    const golden = sstep(0.0, 0.08, elev) * (1 - sstep(0.12, 0.45, elev));
    const wantRain = weather === 'rain' ? 1 : 0, cloudy = weather === 'cloudy' ? 1 : 0;
    this.rainAmt += (wantRain - this.rainAmt) * Math.min(1, dt * 0.25);
    const overcast = Math.max(this.rainAmt, cloudy * 0.55);

    const u = this.sky.material.uniforms;
    const sunPos = tmpV.copy(sunDir).multiplyScalar(1000);
    this.skyColors(u, night, golden, overcast); this.skyColors(this.envSky.material.uniforms, night, golden, overcast);
    u.sunPosition.value.copy(sunPos); u.turbidity.value = 2.2 + overcast * 12; u.rayleigh.value = 3.0 + golden * 0.8 - overcast * 2.0; u.mieCoefficient.value = 0.0025 + overcast * 0.01;
    const eu = this.envSky.material.uniforms; eu.sunPosition.value.copy(sunPos); eu.turbidity.value = u.turbidity.value; eu.rayleigh.value = u.rayleigh.value;
    eu.mieCoefficient.value = 0.003; eu.mieDirectionalG.value = 0.8;

    // moon opposite the sun
    const md = tmpV.set(-sunDir.x, Math.max(0.15, -sunDir.y + 0.15), -sunDir.z * 0.5 - 0.2).normalize();
    this.moon.position.copy(camera.position).addScaledVector(md, 3000); this.moon.material.opacity = night * (1 - overcast * 0.8);
    this.stars.position.copy(camera.position); this.starMat.opacity = night * (1 - overcast);
    this.clouds.position.copy(camera.position); this.sky.position.copy(camera.position);

    // light
    const lightDir = night > 0.5 ? md : sunDir;
    const dayCol = lerpColor(C('#fff0d8'), C('#ffad62'), golden);
    const sunI = (1 - night) * (3.0 + 1.3 * Math.min(1, elev * 1.8)) * (1 - overcast * 0.7);
    const moonI = night * 0.75 * (1 - overcast * 0.5);
    this.sun.color.copy(night > 0.5 ? C('#9fb4ff') : dayCol);
    this.sun.intensity = night > 0.5 ? moonI : sunI;
    if (this.flash > 0) { this.sun.intensity += this.flash * 6; this.sun.color.set('#dfe8ff'); }
    this.hemi.intensity = 0.42 + night * 0.06 + overcast * 0.2; // sky fill: shadows keep structure (were near-black at 0.14)
    this.hemi.color.copy(lerpColor(C('#c2dcff'), C('#5d7099'), night)); this.hemi.groundColor.copy(lerpColor(C('#6b6248'), C('#2a2a30'), night)); // warm ground bounce

    // shadow camera follows focus, snapped to texels
    const fx = focus.x, fz = focus.z;
    if (this.sun.castShadow) {
      const ext = this.shadowExt, texel = (ext * 2) / this.sun.shadow.mapSize.x;
      const sx = Math.round(fx / texel) * texel, sz = Math.round(fz / texel) * texel;
      this.sun.target.position.set(sx, 0, sz); this.sun.position.set(sx + lightDir.x * 250, lightDir.y * 250 + 5, sz + lightDir.z * 250);
    } else { this.sun.target.position.set(fx, 0, fz); this.sun.position.set(fx + lightDir.x * 250, lightDir.y * 250, fz + lightDir.z * 250); }
    this.sun.target.updateMatrixWorld();

    // fog
    const fog = this.scene.fog;
    if (fog) {
      let fc = lerpColor(this.fogDay, this.fogSunset, golden * 0.8);
      fc = fc.lerp(this.fogRain, overcast * 0.8).lerp(this.fogNight, night);
      fog.color.copy(fc);
      // aerial perspective: haze starts close and reaches the fog colour well before the draw distance → depth layering
      fog.near = 70 - this.rainAmt * 50; fog.far = (this.opts.viewDist || 1500) * 0.74 * (1 - this.rainAmt * 0.6);
      this.renderer.setClearColor(fc);
    }
    // clouds
    const cu = this.cloudMat.uniforms; cu.uTime.value += dt; cu.uCover.value = 0.38 + cloudy * 0.25 + this.rainAmt * 0.45; cu.uSunDir.value.copy(sunDir);
    cu.uLight.value.copy(lerpColor(C('#ffffff'), C('#ffd2a8'), golden)).multiplyScalar(1.25); cu.uShade.value.copy(lerpColor(C('#c3cedb'), C('#7a8491'), overcast)); cu.uNight.value = night;
    // exposure
    this.renderer.toneMappingExposure = 0.8 + night * 0.5 + overcast * 0.08;
    // env map refresh when the sun moved noticeably
    if (this.lastEnvSun.distanceTo(sunDir) > 0.05 || this.lastEnvWeather !== weather) {
      this.lastEnvSun.copy(sunDir); this.lastEnvWeather = weather;
      const rt = this.pmrem.fromScene(this.envScene, 0, 1, 1000);
      if (this.envRT) this.envRT.dispose();
      this.envRT = rt; this.scene.environment = rt.texture;
    }
    this.scene.environmentIntensity = 0.42 + (1 - night) * 0.2 + overcast * 0.1;

    // rain
    this.rain.visible = this.rainAmt > 0.05;
    if (this.rain.visible) {
      this.rain.material.opacity = 0.35 * this.rainAmt;
      const p = this.rain.geometry.attributes.position.array;
      const fall = dt * 22;
      for (let i = 0; i < this.rainN; i++) {
        const k = i * 6; p[k + 1] -= fall; p[k + 4] -= fall;
        if (p[k + 1] < -2) { const x = (Math.random() - 0.5) * 80, z = (Math.random() - 0.5) * 80, y = 38 + Math.random() * 4; p[k] = x; p[k + 1] = y; p[k + 2] = z; p[k + 3] = x + 0.05; p[k + 4] = y - 0.7; p[k + 5] = z; }
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
      this.rain.position.set(camera.position.x, camera.position.y - 15, camera.position.z);
      // lightning
      this.nextFlash -= dt;
      if (this.rainAmt > 0.7 && this.nextFlash < 0) { this.flash = 1; this.nextFlash = 8 + Math.random() * 20; if (this.onThunder) this.onThunder(); }
    }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 4);
    return { night, golden, overcast, rain: this.rainAmt };
  }
}
