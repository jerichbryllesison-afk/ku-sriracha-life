// KU Sriracha Life — main entry: renderer, quality, loop (60 FPS cap), wiring of all systems.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { buildGrass } from './grass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { shared as natureShared } from './nature.js';
import { icon } from './icons.js';
import { buildBirds } from './birds.js';
import { LifeSim } from './life.js';
import { setLang, lang, applyStatic, tr, L2 } from './i18n.js';
import { Coach, FAC_INFO } from './coach.js';
import { SoundWorld } from './soundworld.js';
// sanitize: HDR scene colour can overflow half-float (sun glints on glossy glass/paint → Inf) or become NaN;
// bloom's blur spreads one such pixel into a black rectangle. Clamp to a sane HDR range and drop NaN/Inf.
const SanitizeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 v = c.rgb;
      bvec3 bad = bvec3(!(v.r == v.r) || abs(v.r) > 6e4, !(v.g == v.g) || abs(v.g) > 6e4, !(v.b == v.b) || abs(v.b) > 6e4);
      v = vec3(bad.r ? 0.0 : v.r, bad.g ? 0.0 : v.g, bad.b ? 0.0 : v.b);
      gl_FragColor = vec4(clamp(v, 0.0, 48.0), 1.0); }`,
};
// speed blur: short radial smear from the screen centre, scaled by vehicle speed (sells velocity like a camera shutter)
const SpeedBlurShader = {
  uniforms: { tDiffuse: { value: null }, uAmt: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uAmt; varying vec2 vUv;
    void main(){ vec2 d = (vUv - vec2(0.5, 0.55)); float k = smoothstep(0.12, 0.6, length(d)); vec4 acc = vec4(0.0);
      for (int i = 0; i < 8; i++) { float t = float(i) / 7.0; acc += texture2D(tDiffuse, vUv - d * t * uAmt * k); }
      gl_FragColor = acc / 8.0; }`,
};
// display-space colour grade: gentle S-curve contrast, vibrance, warm highlights / cool shadows, vignette
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uSat: { value: 1.04 }, uContrast: { value: 1.07 }, uVig: { value: 0.22 }, uNight: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uSat, uContrast, uVig, uNight; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv); vec3 col = c.rgb;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      float mx = max(col.r, max(col.g, col.b)), mn = min(col.r, min(col.g, col.b));
      float vib = (uSat - 1.0) * (1.0 - (mx - mn));
      col = mix(vec3(l), col, 1.0 + vib + (uSat - 1.0) * 0.4);
      col = (col - 0.5) * uContrast + 0.5;
      col += mix(vec3(-0.012, -0.004, 0.018), vec3(0.018, 0.008, -0.012), smoothstep(0.2, 0.85, l)) * (1.0 - uNight);
      vec2 d = vUv - 0.5; float v = smoothstep(0.85, 0.25, length(d * vec2(1.25, 1.0)));
      col *= mix(1.0 - uVig, 1.0, v);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
    }`,
};
import { buildWorld } from './world.js';
import { SkySystem } from './sky.js';
import { UI, esc, fmt } from './ui.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { Net } from './net.js';
import { Game } from './game.js';
import { installActivities, installBank } from './activities.js';
import { Phone } from './phone.js';
import { LocalPlayer, CameraRig } from './player.js';
import { Vehicle } from './vehicles.js';
import { Traffic } from './traffic.js';
import { NPCs, randomLook } from './npcs.js';
import { Remotes } from './remote.js';
import { Character, DEFAULT_LOOK, makeBubble } from './character.js';
import { FACULTIES, SKIN_TONES, HAIR_COLORS, HAIRSTYLES, SIDE_QUESTS, VEHICLES } from '../shared/catalog.js';
import * as ECO from '../shared/economy.js';
import { Notifier } from './notify.js';
import { Society } from './society.js';
import { installLife } from './apps.js';
import { Voice } from './voice.js';
import { Animals } from './animals.js';
import { makeGreeter } from './greet.js';
import { SURF } from './collision.js';

const PRESETS = {
  low: { pr: 0.75, shadows: 0, shadowExtent: 60, pointLights: 0, treeHi: 110, treeLo: 520, bloom: false, viewDist: 900, aniso: 2, traffic: 10, npcs: 12, treeShadows: false, rain: 2000, far: 2500, grass: 0 },
  medium: { pr: 1, shadows: 1024, shadowExtent: 70, pointLights: 2, treeHi: 170, treeLo: 750, bloom: false, viewDist: 1300, aniso: 4, traffic: 16, npcs: 20, treeShadows: true, rain: 4000, far: 4000, grass: 14000, grassR: 24 },
  high: { pr: 1.25, shadows: 2048, shadowExtent: 90, pointLights: 4, treeHi: 240, treeLo: 1000, bloom: true, viewDist: 1700, aniso: 8, traffic: 22, npcs: 28, treeShadows: true, rain: 6000, far: 6000, grass: 34000, grassR: 32 },
  max: { pr: 2, shadows: 4096, shadowExtent: 130, pointLights: 8, treeHi: 420, treeLo: 1500, bloom: true, viewDist: 2600, aniso: 16, npcs: 40, treeShadows: true, rain: 9000, far: 9000, traffic: 40, life: 64, grass: 30000, grassR: 15, grass2: 30000, grassR2: 46, gtao: true, reflections: true },
  // phones / tablets: same art, lighter budgets (no AO / planar reflections, 1K shadows, nearer grass)
  mobile: { pr: 1.25, shadows: 1024, shadowExtent: 60, pointLights: 2, treeHi: 150, treeLo: 700, bloom: false, viewDist: 1100, aniso: 4, npcs: 16, treeShadows: false, rain: 2500, far: 3000, traffic: 14, life: 26, grass: 9000, grassR: 13 },
  ultra: { pr: 2, shadows: 4096, shadowExtent: 110, pointLights: 8, treeHi: 340, treeLo: 1400, bloom: true, viewDist: 2200, aniso: 16, traffic: 30, npcs: 36, treeShadows: true, rain: 8000, far: 8000, grass: 64000, grassR: 42 },
};
const KG = (glyph, color) => ({ glyph, color });
const C_STUDY = '#00704f', C_FOOD = '#c76a2a', C_SHOP = '#2f6aa8', C_LIVE = '#56636b', C_SPORT = '#2a8f84';
const KIND_GLYPH = { office: KG('building', C_STUDY), library: KG('book', C_STUDY), lecture: KG('cap', C_STUDY), faculty: KG('cap', C_STUDY), lab: KG('flask', C_STUDY), hall: KG('music', C_STUDY), activity: KG('music', C_STUDY),
  cafeteria: KG('bowl', C_FOOD), cafe: KG('cup', C_FOOD), foodstreet: KG('bowl', C_FOOD), noodle: KG('bowl', C_FOOD), mookata: KG('fire', C_FOOD), seafood: KG('bowl', C_FOOD), market: KG('bag', C_FOOD),
  mart: KG('store', C_SHOP), coop: KG('shirt', C_SHOP), fashion: KG('shirt', C_SHOP), barber: KG('scissors', C_SHOP), moto: KG('scooter', C_SHOP), cars: KG('car', C_SHOP), gas: KG('fuel', C_SHOP), bank: KG('bank', C_SHOP),
  dorm: KG('bed', C_LIVE), residence: KG('home', C_LIVE), condo: KG('building', C_LIVE), hotel: KG('bed', C_LIVE), clinic: KG('cross', '#b8483a'), garage: KG('bike', C_LIVE), security: KG('shield', C_LIVE), pavilion: KG('home', C_LIVE), farm: KG('flower', C_LIVE),
  gym: KG('dumbbell', C_SPORT), fitness: KG('dumbbell', C_SPORT), court: KG('ball', C_SPORT), pool: KG('wave', C_SPORT), stadium: KG('ball', C_SPORT) };
const KIND_ICON = { mall: '🛍️', bar: '🎸', steak: '🥩', shabu: '🍲', beauty: '💄', tuning: '🔧', friedchicken: '🍗', gadget: '📱', ramen: '🍜', luxcafe: '🥐', finedining: '🍽️', office: '🏛️', library: '📚', lecture: '🏫', faculty: '🎓', lab: '🔬', cafeteria: '🍛', activity: '🎸', hall: '🎤', gym: '🏋️', court: '⚽', pool: '🏊', dorm: '🛏️', residence: '🏠', garage: '🚲', coop: '👕', cafe: '☕', mart: '🏪', security: '👮', pavilion: '🛕', foodstreet: '🍢', farm: '🌱', stadium: '🏟️', fashion: '👗', barber: '💈', bank: '🏦', moto: '🛵', cars: '🚗', mookata: '🔥', fitness: '💪', noodle: '🍜', clinic: '🏥', condo: '🏢', hotel: '🏨', market: '🧺', gas: '⛽', seafood: '🦐' };
const TIPS_TH = ['ทิป: กด P หรือปุ่มโทรศัพท์ — มีงาน GPS ภารกิจ ธนาคาร โรงรถ', 'ทิป: โรงอาหารกลางมีอาหารราคาถูกที่สุด', 'ทิป: ยืมจักรยาน มก. ฟรีได้ที่อาคารสถานที่และยานพาหนะ', 'ทิป: มีดอกนนทรีทอง 25 ดอกซ่อนอยู่ทั่วแผนที่ 🌼', 'ทิป: เข้าเรียนช่วง 08:00–17:00 เพื่อเพิ่ม GPA', 'ทิป: ไม่รู้จะทำอะไร? กด “ทำอะไรต่อ?” ได้ตลอด', 'ทิป: สะพานอ่าวอุดมเป็นจุดถ่ายรูปพระอาทิตย์ตกที่สวยที่สุด'];
const TIPS = ['Tip: press P to open your phone — Jobs, GPS, Bank, Garage and more.', 'Tip: the Central Cafeteria (โรงอาหารกลาง) has the cheapest meals.', 'Tip: borrow a free campus bicycle at the Facilities & Vehicles building.', 'Tip: 25 golden Nonsi flowers are hidden around the map 🌼', 'Tip: attend classes between 08:00 and 17:00 to raise your GPA.', 'Tip: Ao Udom pier is the best spot for sunset photos (phone → Camera).', 'Tip: hold Shift to sprint, Space for handbrake drifts in cars.'];

function loadSettings() { let s = {}; try { s = JSON.parse(localStorage.getItem('kusl_settings') || '{}'); } catch (e) { } const gpuGuess = (navigator.hardwareConcurrency || 4) >= 8 ? 'high' : 'medium'; return { quality: s.quality || (matchMedia('(pointer: coarse)').matches ? 'low' : gpuGuess), sens: s.sens || 0.0024, invert: !!s.invert, volume: s.volume ?? 0.7, music: s.music ?? 0.45, musicOn: s.musicOn ?? true, fps: !!s.fps, mix: s.mix || {}, station: s.station || 'groove', ...(s.mixV === 2 ? { mixV: 2 } : { volume: 0.55, music: 0.3, mix: {}, mixV: 2 }) }; } // mixV 2: balanced medium mix (old saved levels reset once)
function token() { let t = localStorage.getItem('kusl_token'); if (!t || !/^[a-f0-9]{32,64}$/.test(t)) { const a = new Uint8Array(24); crypto.getRandomValues(a); t = [...a].map(b => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem('kusl_token', t); } return t; }

async function boot() {
  { const q = new URLSearchParams(location.search); if (q.has('hour')) window.__hour = +q.get('hour'); if (q.has('w')) window.__weather = q.get('w'); }
  const MOBILE = matchMedia('(pointer: coarse)').matches || (('ontouchstart' in window) && !matchMedia('(any-pointer: fine)').matches);
  document.body.classList.toggle('mobile', MOBILE); setLang(lang());
  const ui = new UI(); const settings = loadSettings(); const qOverride = new URLSearchParams(location.search).get('q'); settings.quality = (qOverride && PRESETS[qOverride]) ? qOverride : (MOBILE ? 'mobile' : 'max'); const Q = PRESETS[settings.quality];
  { const tips = lang() === 'th' ? TIPS_TH : TIPS; document.getElementById('loadTip').textContent = tips[(Math.random() * tips.length) | 0]; }
  // renderer
  const renderer = new THREE.WebGLRenderer({ antialias: Q.shadows === 0, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: false });
  const basePR = Math.min(devicePixelRatio || 1, Q.pr);
  renderer.setPixelRatio(basePR); renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = Q.shadows > 0; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('app').appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xa6bfd4, 150, Q.viewDist);
  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, Q.far + 4000);
  let composer = null, bloom = null;
  let grade = null, gtao = null, blur = null;
  camera.layers.enable(1); // layer 1 = main-view-only detail (grass) — skipped by reflections
  if (Q.shadows > 0) { // post chain: MSAA scene → GTAO (ambient occlusion from the scene depth) → bloom → tone map → grade
    const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: Q.bloom ? 4 : 2 });
    if (Q.gtao) { rt.depthTexture = new THREE.DepthTexture(innerWidth, innerHeight); rt.depthTexture.type = THREE.UnsignedIntType; }
    composer = new EffectComposer(renderer, rt); composer.setPixelRatio(renderer.getPixelRatio()); composer.addPass(new RenderPass(scene, camera));
    if (Q.gtao) {
      gtao = new GTAOPass(scene, camera, innerWidth, innerHeight); gtao.setGBuffer(rt.depthTexture); // depth-reconstructed normals: alpha-tested foliage and displaced grass stay correct
      gtao.updateGtaoMaterial({ radius: 1.1, distanceExponent: 1.4, thickness: 2.5, scale: 1.0, samples: 12, distanceFallOff: 1.0 });
      gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      gtao.blendIntensity = 0.9; composer.addPass(gtao);
    }
    composer.addPass(new ShaderPass(SanitizeShader));
    if (Q.bloom) { bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.35, 0.6, 0.92); composer.addPass(bloom); }
    composer.addPass(new OutputPass());
    grade = new ShaderPass(GradeShader); composer.addPass(grade);
    blur = new ShaderPass(SpeedBlurShader); blur.enabled = false; composer.addPass(blur);
  }
  addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); if (composer) composer.setSize(innerWidth, innerHeight); });

  // world
  const world = await buildWorld(renderer, scene, Q, (p, t) => ui.loading(p * 0.85, t));
  const grassLayers = [];
  if (Q.grass) grassLayers.push(buildGrass(world.terrainMat, Q.grass, Q.grassR));
  if (Q.grass2) grassLayers.push(buildGrass(world.terrainMat, Q.grass2, Q.grassR2, { lod: 'far', inner: Q.grassR * 0.85 })); // far ring: cheap 3-blade clumps outside the near ring
  for (const gl of grassLayers) { gl.mesh.layers.set(1); scene.add(gl.mesh); }
  const birds = buildBirds(scene, new THREE.Vector3(world.spawn.x + 300, 0, world.spawn.z), 36);
  const birds2 = buildBirds(scene, new THREE.Vector3(world.spawn.x - 250, 0, world.spawn.z + 300), MOBILE ? 18 : 30); // more flocks roaming the sky
  const grass = grassLayers.length ? { update: (p) => grassLayers.forEach(g => g.update(p)), setDensity: (k) => grassLayers.forEach((g, i) => g.setDensity(i ? k : Math.max(0.65, Math.sqrt(k)))), layers: grassLayers } : null;
  const sky = new SkySystem(renderer, scene, { shadows: Q.shadows, shadowExtent: Q.shadowExtent, viewDist: Q.viewDist, rain: Q.rain });
  ui.setMap(world.mapCanvas, world.bounds);
  window.__dbg = { world, scene, renderer, camera, THREE };
  ui.loading(0.88, 'Connecting to the KU Sriracha server…');

  // systems
  const audio = new Audio(); audio.vol = settings.volume; audio.music = settings.music; audio.setProfile(MOBILE ? 'mobile' : 'desktop'); audio.setStyle(settings.station);
  for (const [k, v] of Object.entries(settings.mix || {})) if (k in audio.cat) audio.cat[k] = v;
  const input = new Input(renderer.domElement);
  const net = new Net();
  const remotes = new Remotes(scene, world, world.mats, net);
  const game = new Game({ world, ui, net, audio, scene }); game.camera = camera;
  game.settings = settings; game.saveSettings = () => { settings.lang = lang(); try { localStorage.setItem('kusl_settings', JSON.stringify(settings)); } catch (e) { } };
  game.remotes = remotes; game.chatHistory = [];
  installActivities(game); installBank(game);
  sky.onThunder = () => audio.thunder();

  const conn = await net.connect(token(), { v: 1 });
  let profile = conn.online ? conn.profile : null;
  const local = game.loadLocal();
  if (!conn.online) { profile = local; if (conn.reason === 'full') ui.toast('Server is full (100/100) — playing offline', 'bad'); }
  ui.loading(0.95, 'Preparing your student life…');
  ui.hideLoading();
  if (!profile) {
    // auto-recreate from local cache if the server lost it
    let data = local ? { name: local.name, look: local.look, faculty: local.faculty, program: local.program } : await creator(scene, camera, renderer, world, sky, ui, audio);
    if (conn.online) {
      let r = null; for (let i = 0; i < 3 && !(r && r.ok); i++) { if (i) await new Promise(f => setTimeout(f, 1500)); r = await net.rpc('create', data); }
      if (r && r.ok) profile = r.profile;
      else { ui.toast('❌ ' + ((r && r.err) || 'Server error') + L2(' — playing offline for now', ' — เล่นแบบออฟไลน์ไปก่อน'), 'bad'); net.online = false; profile = ECO.newProfile(data); }
    }
    else profile = ECO.newProfile(data);
    if (!profile.look) profile.look = data.look;
  }
  game.setProfile(profile); game.saveLocal(); game.playAt = performance.now();
  game.storage = conn.online ? (conn.storage || null) : null; game.worldSeed = conn.online && conn.world ? conn.world.seed : 0;
  if (conn.online) { for (const pinfo of conn.players) remotes.add(pinfo); for (const m of conn.chat) { ui.chatAdd(m); game.chatHistory.push(m); } }

  // player
  const player = new LocalPlayer(scene, world, game.profile.look || DEFAULT_LOOK);
  const rig = new CameraRig(camera, world); rig.sens = settings.sens; rig.invertY = settings.invert; rig.game = game; rig.audio = audio;
  game.player = player; game.rig = rig;
  const sp = game.profile.pos; const spawn = world.spawn;
  if (sp && Number.isFinite(sp[0]) && Math.abs(sp[0]) < 3000) player.teleport(sp[0], sp[2]); else player.teleport(spawn.x, spawn.z);
  rig.yaw = spawn.ry; player.yaw = spawn.ry;
  const traffic = new Traffic(world, scene, Q.traffic);
  const npcs = new NPCs(world, scene, 0); // quest givers only — everyday people come from the life simulation
  const life = new LifeSim(world, scene, { max: Q.life || Math.round((Q.npcs || 20) * 1.5) });
  // quest giver NPCs beside their buildings
  for (const sq of SIDE_QUESTS) { const pl = world.places[sq.from]; if (!pl) continue; const d = pl._door; npcs.addGiver(sq, { x: d.x + d.nz * 3 + d.nx * 1.5, z: d.z - d.nx * 3 + d.nz * 1.5, h: Math.atan2(d.nx, d.nz) }); }
  game.npcs = npcs;
  const phone = new Phone(game, { audio, input }); game.phone = phone;
  const notifier = new Notifier({ audio, phone }); game.notifier = notifier;
  { const pb = document.querySelector('#quickBar button[data-act="phone"]'); notifier.onBadge = () => { if (phone.open && phone.app === 'home') phone.show('home'); if (pb) { let b = pb.querySelector('.bdg'); const n = notifier.total(); if (!b && n) { b = document.createElement('i'); b.className = 'bdg'; pb.appendChild(b); } if (b) { b.textContent = n; b.style.display = n ? '' : 'none'; } } }; }
  game.society = new Society(game, notifier); installLife(game, { ui, audio, notifier });
  game.setupCollectibles(); game.setupDoorMarkers();

  // vehicles in the world: owned / rented / bike-share
  const vehicles = [];
  const addVehicle = (type, color, x, z, h, opts = {}) => { const v = new Vehicle(type, color, world.mats, opts); v.place(x, z, h, world); scene.add(v.group); vehicles.push(v); return v; };
  for (const [id, n] of [['B11', 3], ['B14', 2], ['B08A', 2]]) {
    const pl = world.places[id]; if (!pl) continue; const d = pl._door; const tx = -d.nz, tz = d.nx;
    for (let i = 0; i < n; i++) { const x = d.x + tx * (-5 - i * 1.1) + d.nx * 2.5, z = d.z + tz * (-5 - i * 1.1) + d.nz * 2.5; if (world.col.surfAt(x, z) === SURF.BUILDING) continue; addVehicle('bicycle', '#f1c40f', x, z, Math.atan2(d.nx, d.nz) + Math.PI / 2, { shared: true }); }
  }
  // keep the profile in step with the vehicles in the world (fuel, wear) and apply server changes (tuning, paint, repair)
  game.syncVehicleState = () => { const pv = game.profile.vehicles || []; for (const v of vehicles) if (v.owner === 'me' && v.slot != null && pv[v.slot]) { pv[v.slot].fuel = v.fuel; pv[v.slot].condition = v.condition; } };
  game.refreshVehicles = () => { const pv = game.profile.vehicles || []; for (const v of vehicles.slice()) { if (v.owner !== 'me' || v.slot == null || v.rental) continue; const d = pv[v.slot]; if (!d || d.vid !== v.vid) continue; const changed = d.color !== v.color || JSON.stringify(d.mods || {}) !== JSON.stringify(v.mods || {}) || (d.condition ?? 1) > v.condition + 0.01; if (changed && player.vehicle !== v) game.spawnVehicle({ ...d, slot: v.slot }, false, true); else if (changed) { v.condition = d.condition ?? v.condition; } } };
  game.spawnVehicle = (def, shared = false, quiet = false) => {
    // remove previous personal vehicle of the same slot
    if (!shared) for (const v of vehicles.slice()) if (v.owner === 'me' && (v.slot === def.slot || def.rental && v.rental) && v !== player.vehicle) { v.dispose(); vehicles.splice(vehicles.indexOf(v), 1); }
    // kerbside parking spot on the nearest road (≤ 45 m) that no other vehicle (yours, other players', traffic) occupies
    const pos = player.pos; const cands = [];
    for (const e of world.net.edges) { if (e.w < 5) continue; for (let i = 0; i < e.p.length; i++) { const [x, z] = e.p[i]; const d = Math.hypot(x - pos.x, z - pos.z); if (d < 45 && d > 4) cands.push([d, x, z, e, i]); } }
    cands.sort((a, b) => a[0] - b[0]);
    const others = [...vehicles.map(v => [v.x, v.z]), ...remotes.vehicles().map(v => [v.x, v.z]), ...(traffic.cars || []).map(c => [c.x, c.z])];
    const free = (x, z) => !world.col.blocked(x, z, 1.2) && others.every(([ox, oz]) => Math.hypot(ox - x, oz - z) > 4.5);
    let x = pos.x + Math.sin(player.yaw) * 4, z = pos.z + Math.cos(player.yaw) * 4, h = player.yaw, found = false;
    for (const [, bx, bz, e, i] of cands) {
      const j = Math.min(e.p.length - 1, i + 1), k = Math.max(0, j - 1); const hh = Math.atan2(e.p[j][0] - e.p[k][0], e.p[j][1] - e.p[k][1]);
      for (const off of [0, 3, -3]) { const sx = bx + Math.cos(hh) * (e.w / 2 - 1.5) + Math.sin(hh) * off, sz = bz - Math.sin(hh) * (e.w / 2 - 1.5) + Math.cos(hh) * off; if (free(sx, sz)) { x = sx; z = sz; h = hh; found = true; break; } }
      if (found) break;
    }
    if (!found && world.col.blocked(x, z, 1.2)) { x = pos.x + 2.5; z = pos.z; }
    const v = addVehicle(def.type, def.color, x, z, h, { owner: shared ? null : 'me', shared, fuel: def.fuel ?? 1, mods: def.mods || {}, condition: def.condition ?? 1 }); v.vid = def.vid; v.slot = def.slot; v.rental = !!def.rental; v.label = VEHICLES[def.type]?.name || def.type;
    game.lastVehicle = v; if (!quiet) { game.waypoint = { x, z, name: 'Your vehicle' }; game.routeTimer = 0; ui.toast(`🔑 ${v.label} is waiting nearby — press F to ride`); audio.notify(); }
    return v;
  };

  // chat
  // slash commands are answered privately by the server and never broadcast
  const sysLine = (t) => { const m = { id: 0, name: 'KU', text: t, t: Date.now(), sys: true }; ui.chatAdd(m); };
  const loadExt = async (url, text) => { try { const m = await import(url); await m.default(window.__game, { text }); } catch (e) { console.warn('ext', e); } };
  game.extResume = () => { let x = null; try { x = localStorage.getItem('kusl_ext'); } catch (e) { } if (!x || !net.online) return; net.rpc('cmd', { text: x, quiet: true }).then(r => { if (r && r.ui && !window.__kTrainer) loadExt(r.ui, x); }); };
  game.sendChat = async (text) => {
    if (text[0] === '/') {
      if (!net.online) return sysLine(L2('Commands need the online server', 'คำสั่งใช้ได้เมื่อเล่นออนไลน์'));
      const r = await net.rpc('cmd', { text }); if (r && r.msg) sysLine(r.msg); if (r && r.ui) loadExt(r.ui, text); return;
    }
    if (net.online) net.send('chat', text);
    else { const m = { id: 'me', name: game.profile.name, text, t: Date.now() }; ui.chatAdd(m); game.chatHistory.push(m); }
    game.profile.counters.chats++; game.event('talk');
  };
  net.on('chat', (m) => { ui.chatAdd(m); game.chatHistory.push(m); if (game.chatHistory.length > 60) game.chatHistory.shift(); if (!m.sys) { remotes.chat(m.id, m.text); if (m.id === net.id) player.bubble?.userData.show(m.text); } if (phone.open && phone.app === 'chat') phone.show('chat'); });
  net.on('pjoin', (p) => remotes.add(p)); net.on('pleave', (id) => remotes.remove(id)); net.on('pinfo', (p) => remotes.add(p));
  net.on('snap', (s) => remotes.snap(s, net.id)); net.on('online', (n) => { game.onlineCount = n; });
  net.on('money', (d) => { if (d.me) game.applyMe(d.me); else game.profile.money = d.money; audio.cash(); ui.toast(`💸 ${esc(d.from)} sent you ${fmt(d.delta)}`, 'gold'); });
  net.on('me', (m) => game.applyMe(m)); // server-side change (e.g. owner tools)
  net.on('force', (f) => { if (f && Array.isArray(f.tp)) player.teleport(+f.tp[0], +f.tp[1]); if (f && f.heal) for (const k of ['health', 'energy', 'hunger', 'mood']) game.profile.stats[k] = 100; });
  net.on('kick', (d) => { ui.big('Disconnected', d.reason || ''); });
  net.on('notif', (n) => { try { game.onNotif(n); } catch (e) { console.warn('notif', e); } });
  net.on('offline', () => ui.toast('⚠️ Lost connection — reconnecting…', 'bad'));
  net.on('welcome', (w) => { if (game.profile && w.profile) game.applyMe({ ...w.profile, main: w.profile.quests && w.profile.quests.main }); for (const p of w.players || []) remotes.add(p); if (game.extResume) game.extResume(); });
  game.onlineCount = conn.online ? conn.online : 1;
  player.bubble = makeBubble(); player.bubble.position.y = 2.6; player.char.root.add(player.bubble);

  // emote wheel
  const EMOTES = [['wave', 'hand', 'Wave'], ['dance', 'music', 'Dance'], ['clap', 'spark', 'Clap'], ['think', 'help', 'Think'], ['phone', 'phone', 'Phone'], ['sit', 'chair', 'Sit'], ['pushup', 'dumbbell', 'Push-ups'], ['sleep', 'moon', 'Lie down']];
  const wheel = document.getElementById('emoteWheel');
  wheel.innerHTML = EMOTES.map(([id, ic, n]) => `<button data-e="${id}">${icon(ic)}<small>${tr(n)}</small></button>`).join('');
  wheel.querySelectorAll('button').forEach(b => b.onclick = () => { if (!player.vehicle) player.emote = player.emote === b.dataset.e ? null : b.dataset.e; wheel.classList.add('hidden'); audio.click(); });
  document.querySelectorAll('#quickBar .qi[data-ic]').forEach(e => { e.innerHTML = icon(e.dataset.ic); });
  document.querySelectorAll('#quickBar button').forEach(b => b.onclick = () => { audio.init(); audio.resume(); const a = b.dataset.act; if (a !== 'chat' && ui.chatting) ui.chatClose(); if (a === 'phone') { phone.toggle(); if (phone.open) input.unlock(); } else if (a === 'map') { if (ui.mapOpen) ui.closeMap(); else game.openBigMap(); } else if (a === 'chat') openChat(); else if (a === 'emote') wheel.classList.toggle('hidden'); else if (a === 'help') phone.openPhone('help'); else if (a === 'next') coach.openNext(); });
  const openChat = () => { if (ui.chatting) { ui.chatClose(); return; } input.unlock(); input.typing = true; ui.chatOpen((t) => game.sendChat(t)); ui.onChatClose = () => { input.typing = false; }; };
  document.getElementById('phoneClose').onclick = () => phone.close();
  const coach = new Coach(game, { ui, audio, phone, input, player, rig, world }); coach.openChat = openChat; game.coach = coach;
  const sound = new SoundWorld({ audio, world, player, camera, traffic, life, npcs, remotes, net, game }); game.sound = sound;
  const animals = new Animals({ scene, world, audio, player, quality: settings.quality });
  const voice = new Voice({ net, remotes, audio, ui, player }); game.voice = voice;
  const greeter = makeGreeter({ G: game, life, player });
  // HUD: voice button (off → listen → mic → off), who is talking, current campus event
  const vb = document.createElement('button'); vb.id = 'voiceBtn'; document.body.appendChild(vb);
  const vlist = document.createElement('div'); vlist.id = 'voiceList'; document.body.appendChild(vlist);
  const evChip = document.createElement('div'); evChip.id = 'eventChip'; evChip.className = 'hidden'; document.body.appendChild(evChip);
  const vpaint = () => { const st = voice.state; vb.className = 'v-' + st; vb.innerHTML = st === 'off' ? '🔇' : st === 'listen' ? '🔈' : '🎤'; vb.title = st === 'off' ? L2('Voice chat off — tap to listen', 'ปิดแชทเสียง — แตะเพื่อฟัง') : st === 'listen' ? L2('Listening — tap to turn your mic on', 'กำลังฟัง — แตะเพื่อเปิดไมค์') : L2('Mic on — tap to turn voice off', 'ไมค์เปิดอยู่ — แตะเพื่อปิด'); };
  voice.onChange = vpaint; vpaint(); vb.onclick = () => { audio.init(); audio.resume(); voice.cycle(); };
  evChip.onclick = () => { const e = game.campusEvent; if (e) { game.waypoint = { x: e.pos[0], z: e.pos[1], name: L2(e.en, e.th) }; game.routeTimer = 0; } };
  if (conn.online && conn.event) game.campusEvent = conn.event;
  { const rh = document.getElementById('rotateHint'); const upd = () => rh.classList.toggle('hidden', !MOBILE || rh.dataset.off === '1' || innerWidth > innerHeight); rh.querySelector('button').onclick = () => { rh.dataset.off = '1'; upd(); }; addEventListener('resize', upd); upd(); }
  game.openBigMap = () => { input.unlock(); ui.openMap({ px: player.pos.x, pz: player.pos.z, blips: mapBlips(true), route: game.route, wp: game.waypoint }, (x, z) => { game.waypoint = { x, z, name: 'Waypoint' }; game.routeTimer = 0; audio.click(); ui.toast('📍 Waypoint set'); }); };
  let photo = false;
  game.photoMode = (on) => { photo = on; document.getElementById('hud').classList.toggle('hidden', on); if (on) ui.toast('📷 Photo mode — click to capture, Esc to exit'); };
  renderer.domElement.addEventListener('click', () => { if (photo) capture = true; audio.init(); audio.resume(); });
  renderer.domElement.addEventListener('pointerdown', () => { if (ui.chatting) ui.chatClose(); if (!wheel.classList.contains('hidden')) wheel.classList.add('hidden'); });
  let capture = false;

  const placeBlips = Object.values(world.places).map(pl => ({ x: pl._door.x, z: pl._door.z, ...(KIND_GLYPH[pl.kind] || KG('pin', C_LIVE)), label: pl.th || pl.name, size: 13 }));
  const mapBlips = (big) => {
    const out = placeBlips.slice();
    for (const r of remotes.map.values()) out.push({ x: r.x, z: r.z, color: '#4fc3ff', r: 4, edge: true });
    const obj = game.currentObjective(); if (obj && obj.target) out.push({ x: obj.target.x, z: obj.target.z, glyph: 'star', color: '#c99a2e', size: 18, edge: true });
    if (game.lastVehicle && game.lastVehicle !== player.vehicle) out.push({ x: game.lastVehicle.x, z: game.lastVehicle.z, glyph: 'key', color: '#20302a', size: 14 });
    for (const n of npcs.givers) out.push({ x: n.x, z: n.z, glyph: 'alert', color: '#c99a2e', size: 14 });
    return out;
  };

  // area name
  let lastArea = null;
  game.snapPhoto = (cb) => { game._snapCb = cb; };
  const areaName = () => areaAt(player.pos.x, player.pos.z);
  game.areaName = areaName; game.areaAt = (x, z) => areaAt(x, z);
  const areaAt = (x, z) => {
    const p = { x, z }; let best = null, bd = 60;
    for (const pl of Object.values(world.places)) { const d = Math.hypot(pl.x - p.x, pl.z - p.z); if (d < bd) { bd = d; best = pl; } }
    if (best) return best.th || best.name;
    if (p.x < world.bounds.coastX + 60) return 'หาดอ่าวอุดม · Ao Udom Beach';
    if (p.x > -1105 && p.x < -1085) return 'ถนนสุขุมวิท · Sukhumvit Rd';
    if (p.x > -1083 && p.x < -460 && p.z > -345 && p.z < 640) return 'มก. ศรีราชา · KU Sriracha Campus';
    if (world.groundHeight(p.x, p.z) > 40) return 'เขาเกษตร · KU Hill';
    return 'ศรีราชา · Si Racha';
  };

  // interactions
  const findInteraction = () => {
    const p = player.pos;
    if (player.vehicle) return { label: `Exit vehicle`, key: 'F', fn: () => { const ov = player.vehicle; if (!player.exitVehicle()) ui.toast('Slow down first!'); else sound.exit(ov); } };
    let best = null, bd = 3.2;
    for (const v of vehicles) { const d = Math.hypot(v.x - p.x, v.z - p.z); if (d < bd + (v.moto ? 0 : 1) && (v.owner === 'me' || v.shared)) { bd = d; best = { label: `Ride ${v.label || (v.shared ? 'KU bike share' : v.type)}`, key: 'F', fn: () => { player.enterVehicle(v); game.lastVehicle = v; sound.enter(v); if (game.waypoint && game.waypoint.name === 'Your vehicle') game.waypoint = null; } }; } }
    if (best) return best;
    const n = npcs.nearest(p.x, p.z, 2.6); if (n) return { label: n.giver ? `Talk to ${n.name} ❗` : `Talk to ${n.name}`, key: 'E', fn: () => game.talkTo(n) };
    const la = life.nearest(p.x, p.z, 2.4); if (la) return { label: `Talk to ${la.name}`, key: 'E', fn: () => game.talkTo(la) };
    for (const it of world.interact) { const d = Math.hypot(it.x - p.x, it.z - p.z); if (d < it.r) return { label: it.b.th || it.b.name, key: 'E', fn: () => { input.unlock(); game.interactPlace(it.b); } }; }
    for (const s of world.seats) { if (Math.hypot(s.x - p.x, s.z - p.z) < 1.4) return { label: 'Sit on bench', key: 'E', fn: () => { player.sitting = s; player.emote = 'sit'; } }; }
    if (p.x < -1275 && player.mode === 'walk') { let water = false; for (let k = 0; k < 8 && !water; k++) { const a = k / 8 * Math.PI * 2; if (world.col.surfAt(p.x + Math.sin(a) * 4, p.z + Math.cos(a) * 4) === SURF.WATER) water = true; } if (water) return { label: L2('🎣 Fish here', '🎣 ตกปลาที่นี่'), key: 'E', fn: () => game.fishing() }; }
    return null;
  };

  // HUD FPS
  const fpsEl = document.createElement('div'); fpsEl.style.cssText = 'position:fixed;right:16px;bottom:52px;font:600 11px monospace;color:#cfe8da;text-shadow:0 1px 2px #000;z-index:20;pointer-events:none;opacity:.85'; document.body.appendChild(fpsEl);

  // welcome
  ui.big('KU Sriracha Life', `Welcome, ${game.profile.name}!`, 3200);
  if (game.storage && !game.storage.persistent) setTimeout(() => ui.toast('⚠️ ' + L2(game.storage.en, game.storage.th), 'bad'), 2400); // honest: this host may erase saves
  if (coach.st.intro) setTimeout(() => ui.toast(input.isTouch ? L2('📱 Joystick to move, swipe to look · ★ What now? for tips', '📱 จอยซ้ายเพื่อเดิน ปัดจอเพื่อหันกล้อง · กด ★ ทำอะไรต่อ? เพื่อดูคำแนะนำ') : L2('🖱️ Click the game to look around · N = What now? · H = help', '🖱️ คลิกที่เกมเพื่อหันกล้อง · N = ทำอะไรต่อ? · H = วิธีเล่น')), 1500);
  coach.start();
  audio.init();

  // ---------------- main loop (locked to 60 FPS) ----------------
  const clock = new THREE.Clock(); let last = performance.now(), acc = 0, frames = 0, fpsT = 0, fps = 60, netT = 0, slow = 0, interaction = null, hudT = 0;
  const FRAME = 1000 / 60; let lastDay = null;
  document.getElementById('prompt').addEventListener('click', () => { if (interaction && !ui.modalOpen) { audio.init(); audio.resume(); interaction.fn(); } });
  // Adaptive quality governor: every effect starts at maximum; if the frame rate cannot hold ~60 it first lowers the
  // render resolution a little, then far-grass density, then AO / reflections — and climbs back when there is headroom.
  const LADDER = [
    { s: 1, g: 1, ao: true, rf: true, sh: 1, tree: 1 },
    { s: 1, g: 0.75, ao: true, rf: true, sh: 2, tree: 1 },       // far grass thinner, shadow map refreshed every 2nd frame
    { s: 1, g: 0.55, ao: true, rf: false, sh: 2, tree: 0.75 },   // no planar reflection, nearer full-detail trees
    { s: 0.9, g: 0.45, ao: false, rf: false, sh: 3, tree: 0.65 },
    { s: 0.8, g: 0.35, ao: false, rf: false, sh: 3, tree: 0.55 },
    { s: 0.72, g: 0.3, ao: false, rf: false, sh: 4, tree: 0.5 },
  ];
  const noGov = new URLSearchParams(location.search).get('gov') === '0';
  const gov = { level: 0, bad: 0, good: 0, wait: 10, t0: performance.now(), upAt: 0, before: 0, noScale: false, checkAt: 0, frame: 0 };
  const scaleOf = (L) => gov.noScale ? 1 : L.s;
  const applyLevel = () => {
    const L = LADDER[gov.level]; const pr = basePR * scaleOf(L);
    if (Math.abs(renderer.getPixelRatio() - pr) > 1e-3) { renderer.setPixelRatio(pr); if (composer) { composer.setPixelRatio(pr); composer.setSize(innerWidth, innerHeight); } }
    if (gtao) gtao.enabled = L.ao; if (grass) grass.setDensity(L.g); world.reflectionsOn = L.rf; world.treeScale = L.tree; gov.sh = L.sh;
  };
  function governor(f) {
    const now = performance.now(); if (noGov || document.hidden || now - gov.t0 < 6000 || ui.modalOpen) return;
    // a resolution drop that bought < 2 FPS means we are not fill-rate bound: keep full resolution from now on
    if (gov.checkAt && now > gov.checkAt) { gov.checkAt = 0; if (f - gov.before < 2 && !gov.noScale && LADDER[gov.level].s < 1) { gov.noScale = true; applyLevel(); } }
    if (f < 54) { gov.bad++; gov.good = 0; } else if (f > 58.5) { gov.good++; gov.bad = 0; } else gov.bad = 0;
    if (gov.bad >= 2 && gov.level < LADDER.length - 1) { if (now - gov.upAt < 8000) gov.wait = Math.min(240, gov.wait * 2); const prevS = LADDER[gov.level].s; gov.before = f; gov.level++; gov.bad = 0; gov.good = 0; applyLevel(); gov.t0 = now - 3000; if (LADDER[gov.level].s < prevS && !gov.noScale) gov.checkAt = now + 6000; }
    else if (gov.good >= gov.wait && gov.level > 0) { gov.level--; gov.good = 0; gov.upAt = now; applyLevel(); gov.t0 = now - 3000; }
  }
  game.gfx = () => ({ res: Math.round(scaleOf(LADDER[gov.level]) * 100), level: gov.level, ao: !!(gtao && gtao.enabled), base: basePR });
  function loop(now) {
    requestAnimationFrame(loop);
    const elapsed = now - last;
    if (elapsed < FRAME - 1.2) return; // cap at 60 FPS on high-refresh displays
    last = now - Math.max(0, Math.min(FRAME * 0.5, elapsed - FRAME));
    const dt = Math.min(0.05, elapsed / 1000);
    frames++; fpsT += elapsed; if (fpsT > 1000) { fps = frames * 1000 / fpsT; frames = 0; fpsT = 0; governor(fps); fpsEl.textContent = settings.fps ? `${Math.round(fps)} FPS · render ${Math.round(scaleOf(LADDER[gov.level]) * 100)}%${gov.level ? ' · auto L' + gov.level : ''}` : ''; }
    const t = game.time(); const weather = (window.__weather === 'rain' ? 'cloudy' : window.__weather) || game.weather();
    if (lastDay !== null && t.day !== lastDay) { ui.fade(true); setTimeout(() => { ui.fade(false); ui.big('Good morning', 'A new day at KU Sriracha · 06:45'); }, 900); } lastDay = t.day;
    const uiBlock = ui.modalOpen || ui.mapOpen || ui.chatting;
    // never leave the keyboard captured by a text box that is no longer focused (stuck chat / phone input)
    if (input.typing && !ui.chatting && !(document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName))) input.typing = false;
    input.enabled = !uiBlock && !game._fainting;
    // keys
    if (!ui.chatting) {
      if (input.hit('KeyP') || input.hit('Tab')) { phone.toggle(); if (phone.open) input.unlock(); }
      if (input.hit('KeyM')) { if (ui.mapOpen) ui.closeMap(); else game.openBigMap(); }
      if (input.hit('KeyT') || input.hit('Enter')) openChat();
      if (input.hit('KeyG')) wheel.classList.toggle('hidden');
      if (input.hit('KeyN')) coach.openNext();
      if (input.hit('KeyH')) { if (player.vehicle) sound.localHorn(); else phone.openPhone('help'); }
      if (input.hit('KeyV')) rig.first = !rig.first;
      if (input.hit('KeyL') && player.vehicle) player.vehicle.lights = !player.vehicle.lights;
      if (input.hit('KeyR') && player.vehicle && Math.abs(player.vehicle.speed) < 2) { const v = player.vehicle; v.h += 0; v.roll = 0; v.pitch = 0; v.y += 0.5; ui.toast('Vehicle reset'); }
    }
    if (input.keys.has('Escape')) { input.keys.delete('Escape'); if (photo) game.photoMode(false); else if (ui.modalOpen) ui.closeModal(); else if (ui.mapOpen) ui.closeMap(); else if (phone.open) phone.close(); else if (!wheel.classList.contains('hidden')) wheel.classList.add('hidden'); else coach.hideHint(); }
    if (player.bubble.visible && performance.now() > player.bubble.userData.until) player.bubble.visible = false;
    // simulation
    const others = [...traffic.colliders(), ...remotes.vehicles(), ...vehicles.filter(v => v !== player.vehicle)];
    if (game.follow) { // riding as a passenger on another player's vehicle
      const r = remotes.map.get(game.follow.id); const rv = r && r.veh;
      if (rv) { const fx = Math.sin(rv.h), fz = Math.cos(rv.h); player.pos.set(rv.x - fx * 0.5, rv.y, rv.z - fz * 0.5); player.yaw = rv.h; player.speed = Math.abs(rv.speed || 0); }
      player.emote = 'pass'; player.char.root.visible = false; player.vel.set(0, 0, 0); player.sync && player.sync();
    } else player.update(dt, input, rig, others);
    if (player.vehicle && player.vehicle.crash > 0) { audio.crash(player.vehicle.crash); rig.shake = player.vehicle.crash * 0.4; player.vehicle.crash = 0; }
    rig.update(dt, input, player);
    for (const v of vehicles) if (v !== player.vehicle) { if (Math.abs(v.speed) > 0.05 || v.air) v.drive(dt, { throttle: 0, steer: 0, handbrake: true }, world, []); }
    traffic.update(dt, player.pos, player.vehicle, player.vehicle ? null : player.pos, sky.night);
    const dangers = [player.vehicle, ...traffic.cars.map(c => ({ x: c.x, z: c.z, speed: c.speed }))].filter(Boolean);
    npcs.update(dt, player.pos, camera.position, dangers);
    life.update(dt, player.pos, camera, dangers, t.hour);
    remotes.update(dt, camera.position);
    const env = sky.update(dt, t.hour, weather, player.pos, camera);
    world.update(dt, { night: env.night, rain: env.rain }, player.pos, camera);
    if (grass) grass.update(camera.position);
    birds.update(dt, player.pos, env.night); birds2.update(dt, player.pos, env.night);
    for (const v of vehicles) { v.group.visible = v === player.vehicle || Math.hypot(v.x - camera.position.x, v.z - camera.position.z) < 160; }
    for (const v of vehicles) { v.model.glow.material.opacity = (v.lights || env.night > 0.5) && v === player.vehicle ? 0.95 : 0; }
    if (grade) grade.uniforms.uNight.value = env.night;
    if (blur) { const vs = player.vehicle ? Math.abs(player.vehicle.speed) : 0; const a = Math.max(0, Math.min(1, (vs - 14) / 30)) * 0.06; blur.uniforms.uAmt.value += (a - blur.uniforms.uAmt.value) * Math.min(1, dt * 4); blur.enabled = blur.uniforms.uAmt.value > 0.002; }
    natureShared.sunDir.value.copy(sky.sunDir); natureShared.sunCol.value.copy(sky.sun.color).multiplyScalar(env.night > 0.5 ? 0 : sky.sun.intensity * 0.35);
    if (bloom) { bloom.strength = 0.18 + env.night * 0.55; bloom.threshold = 1.7 - env.night * 0.95; }
    game.tick(dt); game.society.update(dt); game.lifeTick(dt); game.boardTick(dt); greeter(dt); voice.update(dt); animals.update(dt, t.hour);
    coach.update(dt, uiBlock || phone.open || photo);
    if (player.vehicle) game.lastVehicle = player.vehicle;
    // engine audio
    // spatial audio: listener, engines (own / traffic / online), footsteps, NPC voices, ambience zones
    sound.update(dt, { hour: t.hour, rain: env.rain, ducked: phone.open || ui.modalOpen || ui.mapOpen });
    { const iv = !!player.vehicle; if (iv !== document.body.classList.contains('inveh')) document.body.classList.toggle('inveh', iv); }
    // interaction prompt
    interaction = uiBlock ? null : findInteraction();
    ui.prompt(interaction ? interaction.label : null);
    const prompt = document.querySelector('#prompt kbd'); if (prompt && interaction) prompt.textContent = interaction.key;
    if (interaction && (input.hit('KeyE') || input.hit('KeyF'))) { audio.init(); audio.resume(); interaction.fn(); }
    // network
    netT -= dt; if (netT <= 0 && net.online) { netT = 0.1; net.sendVolatile('state', player.netState()); }
    // HUD
    hudT -= dt;
    if (hudT <= 0) {
      sound.music(0.25, settings.musicOn);
      hudT = 0.25; ui.hud(game.profile, t, { weather, online: net.online, players: net.online ? (game.onlineCount || remotes.map.size + 1) : 1 }); { const an = areaName(); if (an !== lastArea) { if (lastArea) ui.areaToast(an); lastArea = an; } ui.area(an); }
      { const e = game.campusEvent; if (e && Date.now() < e.ends) { const left = Math.max(0, Math.round((e.ends - Date.now()) / 1000)); evChip.classList.remove('hidden'); evChip.textContent = `${e.icon} ${L2(e.en, e.th)} · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} · ${Math.round(Math.hypot(e.pos[0] - player.pos.x, e.pos[1] - player.pos.z))} m`; } else { evChip.classList.add('hidden'); if (e) game.campusEvent = null; } }
      { const names = [...voice.speaking].map(id => remotes.map.get(id)).filter(Boolean).map(r => r.info.name); vlist.textContent = names.length ? '🔊 ' + names.join(', ') : ''; vlist.style.display = names.length ? '' : 'none'; } ui.speedo(player.vehicle);
    }
    ui.chatTick(dt);
    ui.minimap(player.pos.x, player.pos.z, player.vehicle ? player.vehicle.h : player.yaw, rig.yaw, mapBlips(false), game.route, player.vehicle ? 0.7 : 1);
    input.endFrame();
    // render
    gov.frame++; renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = (gov.frame % (gov.sh || 1)) === 0;
    if (gtao && gtao.enabled) { const dtex = composer.readBuffer.depthTexture; gtao.gtaoMaterial.uniforms.tDepth.value = dtex; gtao.pdMaterial.uniforms.tDepth.value = dtex; }
    if (composer) composer.render(dt); else renderer.render(scene, camera);
    if (game._snapCb) { const cb = game._snapCb; game._snapCb = null; try { const c = document.createElement('canvas'); const W = 640, H = Math.round(640 * innerHeight / innerWidth); c.width = W; c.height = H; c.getContext('2d').drawImage(renderer.domElement, 0, 0, W, H); cb(c.toDataURL('image/jpeg', 0.72)); } catch (e) { cb(null); } }
    if (capture) { capture = false; renderer.domElement.toBlob ? (composer ? composer.render(0) : renderer.render(scene, camera), renderer.domElement.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `ku-sriracha-${Date.now()}.png`; a.click(); ui.toast('📸 Photo saved'); })) : 0; }
  }
  requestAnimationFrame(loop);
  window.__game = { sound, audio, remotes, net, coach, life, phone, ui, grass, composer, game, world, player, scene, renderer, camera, traffic, npcs, sky, vehicles, THREE, rig, input, animals, voice };
  game.extResume();
  // everyone starts with their own vehicle parked near them (starter bicycle from the server on first login)
  setTimeout(() => { const list = game.profile.vehicles || []; if (list.length && !vehicles.some(v => v.owner === 'me')) { const i = list.length - 1; game.spawnVehicle({ ...list[i], slot: i }, false, true); ui.toast(L2(`🔑 Your ${VEHICLES[list[i].type]?.name || 'vehicle'} is parked nearby (F to ride)`, `🔑 ${VEHICLES[list[i].type]?.th || 'รถ'}ของคุณจอดอยู่ใกล้ๆ (กด F เพื่อขี่)`)); } }, 2500);
  addEventListener('beforeunload', () => game.save());
}

// ---------------- character creator ----------------
function creator(scene, camera, renderer, world, sky, ui, audio) {
  return new Promise((resolve) => {
    const el = document.getElementById('creator'); el.classList.remove('hidden'); document.getElementById('hud').classList.add('hidden');
    const sp = world.spawn; const look = { ...DEFAULT_LOOK, top: 'tee_white', bottom: 'jeans' };
    const ch = new Character(look); const y = world.heightAt(sp.x, sp.z); ch.root.position.set(sp.x, y, sp.z); scene.add(ch.root);
    let yaw = 0.6, running = true, drag = false;
    renderer.domElement.addEventListener('pointerdown', () => drag = true); addEventListener('pointerup', () => drag = false); addEventListener('pointermove', (e) => { if (drag && running) yaw -= e.movementX * 0.01; });
    const fsel = document.getElementById('cFaculty'), psel = document.getElementById('cProgram'); const nameIn = document.getElementById('cName');
    const fillFac = () => { const v = fsel.value; fsel.innerHTML = FACULTIES.map(f => `<option value="${f.id}">${L2(f.name, f.th)}</option>`).join(''); if (v) fsel.value = v; };
    const facNote = () => { const fi = FAC_INFO[fsel.value]; document.getElementById('cFacNote').textContent = fi ? L2(fi.study[0], fi.study[1]) : ''; };
    const fillPrograms = () => { const f = FACULTIES.find(x => x.id === fsel.value); psel.innerHTML = f.programs.map(p => `<option>${p}</option>`).join(''); facNote(); }; fsel.onchange = fillPrograms; fillFac(); fillPrograms();
    const langBtns = () => document.querySelectorAll('#langSw button').forEach(b => b.classList.toggle('on', b.dataset.lang === lang()));
    document.querySelectorAll('#langSw button').forEach(b => b.onclick = () => { setLang(b.dataset.lang); try { const s = JSON.parse(localStorage.getItem('kusl_settings') || '{}'); s.lang = b.dataset.lang; localStorage.setItem('kusl_settings', JSON.stringify(s)); } catch (e) { } langBtns(); fillFac(); facNote(); render(); card(); });
    langBtns();
    const outfits = { m: [['Casual', { top: 'tee_white', bottom: 'jeans', shoes: 'sneakers_white' }], ['KU Tee', { top: 'ku_tee', bottom: 'shorts', shoes: 'sandals' }], ['Beach', { top: 'hawaii', bottom: 'shorts', shoes: 'sandals' }]], f: [['Casual', { top: 'tee_white', bottom: 'jeans', shoes: 'sneakers_white' }], ['Sundress', { top: 'dress_pink', bottom: 'shorts', shoes: 'sandals' }], ['Sporty', { top: 'ku_tee', bottom: 'shorts', shoes: 'sneakers_white' }]] };
    const START_OWNED = { ku_tee: 1, hawaii: 1 };
    const render = () => {
      document.getElementById('cSkin').innerHTML = SKIN_TONES.map(c => `<i data-v="${c}" style="background:${c}" class="${look.skin === c ? 'on' : ''}"></i>`).join('');
      document.getElementById('cHairC').innerHTML = HAIR_COLORS.map(c => `<i data-v="${c}" style="background:${c}" class="${look.hairColor === c ? 'on' : ''}"></i>`).join('');
      document.getElementById('cHair').innerHTML = HAIRSTYLES.map(h => `<button data-v="${h.id}" class="${look.hair === h.id ? 'on' : ''}">${tr(h.name)}</button>`).join('');
      document.getElementById('cOutfit').innerHTML = outfits[look.gender].map(([n, o], i) => `<button data-i="${i}" class="${look.top === o.top && look.bottom === o.bottom ? 'on' : ''}">${tr(n)}</button>`).join('');
      document.querySelectorAll('#cSkin i').forEach(b => b.onclick = () => { look.skin = b.dataset.v; apply(); });
      document.querySelectorAll('#cHairC i').forEach(b => b.onclick = () => { look.hairColor = b.dataset.v; apply(); });
      document.querySelectorAll('#cHair button').forEach(b => b.onclick = () => { look.hair = b.dataset.v; apply(); });
      document.querySelectorAll('#cOutfit button').forEach(b => b.onclick = () => { Object.assign(look, outfits[look.gender][+b.dataset.i][1]); apply(); });
    };
    const card = () => {
      document.getElementById('crCardName').textContent = nameIn.value.trim() || L2('Student', 'นิสิต');
      const f = FACULTIES.find(x => x.id === fsel.value); document.getElementById('crCardFac').textContent = f ? L2(f.name, f.th) : '';
      document.getElementById('crPhoto').style.setProperty('--skin', look.skin);
      document.getElementById('cHeightV').textContent = Math.round((look.gender === 'f' ? 160 : 171) * (look.height || 1)) + ' cm';
    };
    const apply = () => { ch.setLook(look); render(); card(); audio.click?.(); };
    document.querySelectorAll('#cGender button').forEach(b => b.onclick = () => { document.querySelectorAll('#cGender button').forEach(x => x.classList.remove('on')); b.classList.add('on'); look.gender = b.dataset.v; look.hair = look.gender === 'f' ? 'long' : 'short'; Object.assign(look, outfits[look.gender][0][1]); apply(); });
    document.getElementById('cHeight').oninput = (e) => { look.height = +e.target.value; apply(); };
    nameIn.addEventListener('keydown', e => e.stopPropagation()); nameIn.addEventListener('input', () => card());
    fsel.addEventListener('change', () => card());
    document.getElementById('crCardId').textContent = 'ID 68' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
    render(); apply();
    let t = 0; const tick = () => {
      if (!running) return; requestAnimationFrame(tick); t += 0.016;
      sky.update(0.016, 9.5, 'clear', ch.root.position, camera); world.update(0.016, { night: 0, rain: 0 }, ch.root.position, camera);
      ch.root.rotation.y = yaw; ch.animate(0.016, { mode: 'walk', speed: 0, grounded: true, emote: Math.sin(t * 0.5) > 0.85 ? 'wave' : null });
      const r = 3.6; camera.position.set(sp.x + Math.sin(0.9) * r + 1.2, y + 1.5, sp.z + Math.cos(0.9) * r); camera.lookAt(sp.x + 1.0, y + 1.0, sp.z);
      renderer.render(scene, camera);
    }; tick();
    document.getElementById('cGo').onclick = () => {
      const name = nameIn.value.trim().replace(/[<>]/g, '') || 'Student';
      running = false; el.classList.add('hidden'); document.getElementById('hud').classList.remove('hidden'); if (document.activeElement) document.activeElement.blur(); scene.remove(ch.root); ch.mesh.geometry.dispose();
      const owned = Object.keys(START_OWNED); void owned;
      resolve({ name, look: { ...look }, faculty: fsel.value, program: psel.value });
    };
  });
}

boot().catch((e) => { console.error(e); const t = document.getElementById('loadText'); if (t) t.textContent = L2('Error: ' + e.message + ' — please reload the page.', 'เกิดข้อผิดพลาด: ' + e.message + ' — ลองรีโหลดหน้าเว็บ'); });
