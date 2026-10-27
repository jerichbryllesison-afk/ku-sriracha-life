// Core game state: profile, needs, XP/levels, economy calls (online/offline), quests, events, GPS, collectibles.
import * as THREE from 'three';
import { ITEMS, MAIN_QUESTS, SIDE_QUESTS, DAILY, xpForLevel, levelTitle, gameTime, weatherForDay, MAX_LEVEL, CLOTHES } from '../shared/catalog.js';
import * as ECO from '../shared/economy.js';
import { fmt } from './ui.js';
import { SURF } from './collision.js';
import { edgePoint } from './roadnet.js';

const LS_PROFILE = 'kusl_profile_v1';
const AREAS = [];

export class Game {
  constructor(deps) {
    Object.assign(this, deps); // world, ui, net, audio, scene
    this.profile = null; this.memo = {}; this.saveTimer = 0; this.questTimer = 0; this.flags = {}; this.discovered = new Set();
    this.route = null; this.routeTarget = null; this.routeTimer = 0; this.waypoint = null; this.task = null; // active route task (delivery/taxi/side quest)
    this.rental = false; this.dayCache = -1; this.collectMeshes = []; this.lastPos = null;
    this.markers = new THREE.Group(); this.scene.add(this.markers);
    this.beam = this.makeBeam(); this.markers.add(this.beam); this.beam.visible = false;
    this.trackState = null;
  }
  get p() { return this.profile; }
  time() { const t = gameTime(this.net.now()); const o = window.__hour; if (o != null) { t.hour = o; t.frac = o / 24; } return t; }
  weather() { const t = this.time(); return weatherForDay(t.day, t.frac); }
  // ---------------- profile & saving ----------------
  loadLocal() { try { return JSON.parse(localStorage.getItem(LS_PROFILE) || 'null'); } catch (e) { return null; } }
  saveLocal() { try { localStorage.setItem(LS_PROFILE, JSON.stringify(this.profile)); } catch (e) { } }
  setProfile(p) {
    const base = ECO.newProfile({}); this.profile = { ...base, ...p, stats: { ...base.stats, ...(p.stats || {}) }, skills: { ...base.skills, ...(p.skills || {}) }, counters: { ...base.counters, ...(p.counters || {}) }, quests: { ...base.quests, ...(p.quests || {}) } };
    if (!this.profile.quests.daily) this.profile.quests.daily = { day: -1, prog: {}, done: [] };
    if (!this.profile.quests.side) this.profile.quests.side = {};
  }
  save(force = false) {
    if (!this.profile) return;
    if (this.player) { const q = this.player.pos; this.profile.pos = [Math.round(q.x * 10) / 10, Math.round(q.y * 10) / 10, Math.round(q.z * 10) / 10]; }
    this.profile.vehicleFuel = this.profile.vehicles.map(v => v.fuel);
    this.saveLocal();
    if (this.net.online) { const { money, wardrobe, vehicles, claimed, hairs, txlog, ...rest } = this.profile; this.net.send('save', { ...rest, levelChanged: this._lvChanged }); this._lvChanged = false; }
  }
  applyServer(res) { if (!res) return; if (typeof res.money === 'number') this.profile.money = res.money; if (res.profile) Object.assign(this.profile, res.profile); }
  // economy: online → server authoritative; offline → local rules
  async buy(kind, id, qty = 1, color) {
    let res;
    if (this.net.online) { res = await this.net.rpc('buy', { kind, id, qty, color }); this.applyServer(res); }
    else { res = ECO.applyBuy(this.profile, { kind, id, qty, color }); }
    if (res.ok) { if (res.cost) this.audio.cash(); this.saveLocal(); } else { this.audio.error(); this.ui.toast('❌ ' + (res.err || 'Failed'), 'bad'); }
    return res;
  }
  async earn(job, amount) {
    amount = Math.round(amount); let res;
    if (this.net.online) { res = await this.net.rpc('earn', { job, amount }); this.applyServer(res); }
    else res = ECO.applyEarn(this.profile, { job, amount }, this.memo);
    if (res.ok) { this.audio.cash(); this.ui.toast(`💰 +${fmt(res.amount)} earned`, 'gold'); } else this.ui.toast('❌ ' + (res.err || 'Payment failed'), 'bad');
    this.saveLocal(); return res;
  }
  async claim(type, id) {
    let res; const day = this.time().day;
    if (this.net.online) { res = await this.net.rpc('claim', { type, id, day }); this.applyServer(res); }
    else res = ECO.applyClaim(this.profile, { type, id }, day);
    this.saveLocal(); return res;
  }
  async transfer(to, amount) { const res = await this.net.rpc('transfer', { to, amount }); this.applyServer(res); if (res.ok) { this.audio.cash(); this.ui.toast(`Sent ${fmt(amount)}`); } else this.ui.toast('❌ ' + res.err, 'bad'); return res; }
  async checkAllowance() {
    const day = this.time().day; if (this.profile.lastAllowanceDay === day) return;
    let res; if (this.net.online) { res = await this.net.rpc('allowance', {}); this.applyServer(res); if (res.ok) this.profile.lastAllowanceDay = day; } else res = ECO.applyAllowance(this.profile, day);
    if (res && res.ok) { this.ui.toast(`📩 Allowance from home: +${fmt(res.amount)}`, 'gold'); this.audio.notify(); }
  }
  // ---------------- XP / skills / needs ----------------
  addXP(n, why = '') {
    const p = this.profile; if (p.level >= MAX_LEVEL) return; p.xp += Math.round(n);
    if (why) this.ui.toast(`✨ +${Math.round(n)} XP ${why}`);
    while (p.level < MAX_LEVEL && p.xp >= xpForLevel(p.level)) {
      p.xp -= xpForLevel(p.level); p.level++; this._lvChanged = true;
      this.audio.levelUp(); this.ui.big(`LEVEL ${p.level}!`, levelTitle(p.level));
      this.claim('level', p.level).then(r => { if (r.ok && r.amount) this.ui.toast(`🎁 Level bonus +${fmt(r.amount)}`, 'gold'); });
      if (this.player) this.player.updateLabel?.();
    }
    this.event('level');
  }
  skill(k, n) { const s = this.profile.skills; const before = Math.floor(s[k]); s[k] = Math.min(100, s[k] + n); if (Math.floor(s[k]) > before && Math.floor(s[k]) % 5 === 0) this.ui.toast(`📈 ${({ int: 'Intelligence', fit: 'Fitness', cha: 'Charisma', drv: 'Driving' })[k]} ${Math.floor(s[k])}`); }
  stat(k, n) { const s = this.profile.stats; s[k] = Math.max(0, Math.min(100, s[k] + n)); }
  eat(id, where) {
    const it = ITEMS[id]; if (!it) return;
    for (const [k, v] of Object.entries(it.e || {})) this.stat(k, v);
    if (it.skill) for (const [k, v] of Object.entries(it.skill)) this.skill(k, v);
    if ((it.e && it.e.hunger) > 15) { this.profile.counters.meals++; this.event('eat', where); }
    this.ui.toast(`${it.icon} ${it.th || it.name}`);
    if (!this.flags['ate_' + id]) { this.flags['ate_' + id] = 1; this.addXP(8); }
  }
  useItem(id) { const inv = this.profile.inventory; if (!inv[id]) return; inv[id]--; if (!inv[id]) delete inv[id]; this.eat(id, 'bag'); this.save(); }
  // ---------------- events / quests ----------------
  event(type, data) {
    const p = this.profile; if (!p) return;
    // main quest
    const q = MAIN_QUESTS[p.quests.main];
    if (q) {
      const o = q.obj; let done = false;
      if (o.type === type) {
        if (type === 'eat') done = data === o.target;
        else if (type === 'buy') done = data === o.target;
        else done = true;
      }
      if (done) this.completeMain(q);
    }
    // dailies
    const day = this.time().day; this.ensureDaily(day);
    const d = p.quests.daily;
    for (const dq of this.dailyList(day)) {
      if (d.done.includes(dq.id)) continue;
      let inc = 0;
      if (dq.type === type) inc = typeof data === 'number' && (type === 'distance' || type === 'drive') ? data : 1;
      if (!inc) continue;
      d.prog[dq.id] = (d.prog[dq.id] || 0) + inc;
      if (d.prog[dq.id] >= dq.n) { d.done.push(dq.id); this.claim('daily', dq.id).then(r => { if (r.ok) { this.audio.quest(); this.ui.toast(`✅ Daily: ${dq.title} +${fmt(r.amount)}`, 'gold'); this.addXP(dq.xp); } }); }
    }
  }
  async completeMain(q) {
    const p = this.profile; if (this._completing) return; this._completing = true;
    const r = await this.claim('main', q.id);
    p.quests.main++; this._completing = false;
    this.audio.quest(); this.ui.big('QUEST COMPLETE', q.title);
    this.addXP(q.xp); if (r.ok && r.amount) this.ui.toast(`🎁 +${fmt(r.amount)}`, 'gold');
    this.save(); this.refreshQuestRoute();
  }
  checkPassiveQuests() {
    const p = this.profile; const q = MAIN_QUESTS[p.quests.main]; if (!q) return;
    const o = q.obj; const pos = this.player.pos;
    if (o.type === 'visit') { const t = this.world.pois[o.target]; if (t && Math.hypot(t.x - pos.x, t.z - pos.z) < 14) this.completeMain(q); }
    else if (o.type === 'money' && p.money >= o.target) this.completeMain(q);
    else if (o.type === 'level' && p.level >= o.target) this.completeMain(q);
    else if (o.type === 'buy' && o.target === 'uniform' && (p.wardrobe.includes('uniform_m') || p.wardrobe.includes('uniform_f'))) this.completeMain(q);
    else if (o.type === 'buy' && o.target === 'vehicle' && (p.vehicles.length || this.rental)) this.completeMain(q);
    else if (o.type === 'club' && p.clubs.length) this.completeMain(q);
  }
  ensureDaily(day) { const d = this.profile.quests.daily; if (d.day !== day) { d.day = day; d.prog = {}; d.done = []; } }
  dailyList(day) { const out = []; const a = DAILY.slice(); let s = day * 9301 + 49297; for (let i = 0; i < 3; i++) { s = (s * 233280 + 11) % 1e9; const k = s % a.length; out.push(a.splice(k, 1)[0]); } return out; }
  currentObjective() {
    const p = this.profile;
    if (this.task) return { title: this.task.title, desc: this.task.desc, target: this.task.target };
    const q = MAIN_QUESTS[p.quests.main];
    if (!q) return this.waypoint ? { title: 'GPS', desc: 'Waypoint', target: this.waypoint } : null;
    let target = null; const o = q.obj;
    const placeOf = (kind) => { let best = null, bd = 1e9; for (const pl of Object.values(this.world.places)) if (pl.kind === kind) { const d = Math.hypot(pl._door.x - this.player.pos.x, pl._door.z - this.player.pos.z); if (d < bd) { bd = d; best = pl._door; } } return best; };
    if (o.type === 'visit') target = this.world.pois[o.target];
    else if (o.type === 'buy') target = o.target === 'uniform' ? this.world.pois.COOP : this.world.pois.MOTO;
    else if (o.type === 'eat') target = this.world.pois.B07;
    else if (o.type === 'study') target = this.world.pois.B14;
    else if (o.type === 'class') { const fac = { eng: 'B23', sci: 'B26', ms: 'B22', econ: 'B18', ims: 'B24' }[p.faculty] || 'B06'; target = this.world.pois[fac]; }
    else if (o.type === 'club') target = this.world.pois.B09;
    else if (o.type === 'run') target = this.world.pois.trackStart;
    else if (o.type === 'job') target = placeOf('cafeteria');
    return { title: q.title, desc: q.desc, target: this.waypoint || target };
  }
  // ---------------- GPS routing on the road graph ----------------
  nearestNode(x, z) { let best = null, bd = 1e18; for (const n of this.world.net.nodes) { const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd && n.edges.some(e => e.e.w >= 4)) { bd = d; best = n; } } return best; }
  computeRoute(fx, fz, tx, tz) {
    const a = this.nearestNode(fx, fz), b = this.nearestNode(tx, tz); if (!a || !b) return null;
    if (Math.hypot(fx - tx, fz - tz) < 60) return [[fx, fz], [tx, tz]];
    const open = new Map([[a, 0]]), came = new Map(), g = new Map([[a, 0]]); const h = (n) => Math.hypot(n.x - b.x, n.z - b.z);
    const fScore = new Map([[a, h(a)]]); let guard = 0;
    while (open.size && guard++ < 6000) {
      let cur = null, cf = 1e18; for (const [n] of open) { const f = fScore.get(n); if (f < cf) { cf = f; cur = n; } }
      if (cur === b) break; open.delete(cur);
      for (const { e, end } of cur.edges) {
        if (e.w < 4) continue; const nb = end === 0 ? e.n1 : e.n0; const tg = g.get(cur) + e.len;
        if (tg < (g.get(nb) ?? 1e18)) { came.set(nb, { from: cur, e, rev: end === 1 }); g.set(nb, tg); fScore.set(nb, tg + h(nb)); open.set(nb, 1); }
      }
    }
    if (!came.has(b) && a !== b) return [[fx, fz], [tx, tz]];
    const pts = [[tx, tz]]; let cur = b;
    while (cur !== a) { const c = came.get(cur); const P = c.rev ? c.e.p.slice() : c.e.p.slice().reverse(); for (const q of P) pts.push(q); cur = c.from; }
    pts.push([fx, fz]); return pts.reverse();
  }
  refreshQuestRoute() { this.routeTimer = 0; }
  updateRoute(dt) {
    const obj = this.currentObjective(); const pos = this.player.pos;
    if (!obj || !obj.target) { this.route = null; this.beam.visible = false; this.ui.quest(obj ? obj.title : null, obj ? obj.desc : '', ''); return; }
    const t = obj.target; const d = Math.hypot(t.x - pos.x, t.z - pos.z);
    this.ui.quest(obj.title, obj.desc, `📍 ${d < 1000 ? Math.round(d) + ' m' : (d / 1000).toFixed(1) + ' km'}`);
    this.routeTimer -= dt;
    if (this.routeTimer <= 0 || !this.route || this.routeTarget !== t) { this.routeTimer = 2.5; this.routeTarget = t; this.route = this.computeRoute(pos.x, pos.z, t.x, t.z); }
    this.beam.visible = true; this.beam.position.set(t.x, this.world.heightAt(t.x, t.z), t.z);
    { const u = this.beam.material.uniforms; u.uT.value = performance.now() / 1000; const cp = this.camera ? this.camera.position : pos; u.uNear.value = Math.min(1, Math.max(0, (Math.hypot(t.x - cp.x, t.z - cp.z) - 8) / 30)); }
    if (this.waypoint && d < 15 && !this.task) { this.waypoint = null; this.ui.toast('📍 You have arrived'); }
  }
  makeBeam() {
    const g = new THREE.CylinderGeometry(1.4, 0.9, 80, 20, 1, true); g.translate(0, 40, 0);
    const m = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uNear: { value: 1 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: 'varying float vY; varying float vF; void main(){ vY = uv.y; vec4 wp = modelMatrix * vec4(position,1.0); vec3 n = normalize(mat3(modelMatrix) * normal); vF = abs(dot(n, normalize(cameraPosition - wp.xyz))); gl_Position = projectionMatrix * viewMatrix * wp; }',
      fragmentShader: 'uniform float uT; uniform float uNear; varying float vY; varying float vF; void main(){ float a = pow(vF, 2.5) * (1.0 - vY) * (0.55 + 0.25 * sin(uT * 3.0 - vY * 30.0)) * uNear; gl_FragColor = vec4(vec3(1.0, 0.78, 0.25) * a, a); }',
    });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 5; return mesh;
  }
  // ---------------- collectibles: golden Nonsi flowers ----------------
  setupCollectibles() {
    const col = this.world.col; let s = 777; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const spots = []; const b = this.world.bounds;
    while (spots.length < 25 && s) {
      const campusBias = spots.length < 15;
      const x = campusBias ? -1070 + r() * 600 : b.mapMinX + r() * (b.maxX - b.mapMinX - 40), z = campusBias ? -330 + r() * 950 : b.minZ + 40 + r() * (b.maxZ - b.minZ - 80);
      const sf = col.surfAt(x, z); if (![SURF.GRASS, SURF.PLAZA, SURF.WALK, SURF.URBAN, SURF.FOREST, SURF.SAND].includes(sf)) continue;
      if (col.blocked(x, z, 1)) continue; spots.push([x, z]);
      if (spots.length > 200) break;
    }
    const petal = new THREE.SphereGeometry(0.16, 8, 6); petal.scale(1, 0.35, 1.8);
    const parts = [];
    for (let k = 0; k < 5; k++) { const g = petal.clone(); g.rotateY(k / 5 * 6.283); g.translate(Math.sin(k / 5 * 6.283) * 0.22, 0, Math.cos(k / 5 * 6.283) * 0.22); g.deleteAttribute('uv'); const c = new Float32Array(g.attributes.position.count * 3).fill(1); for (let i = 0; i < c.length; i += 3) { c[i] = 1; c[i + 1] = 0.75; c[i + 2] = 0.1; } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); parts.push(g.toNonIndexed()); }
    const ctr = new THREE.SphereGeometry(0.12, 8, 6); ctr.deleteAttribute('uv'); const cc = new Float32Array(ctr.attributes.position.count * 3); for (let i = 0; i < cc.length; i += 3) { cc[i] = 0.35; cc[i + 1] = 0.15; cc[i + 2] = 0.0; } ctr.setAttribute('color', new THREE.BufferAttribute(cc, 3)); parts.push(ctr.toNonIndexed());
    const pos = [], nor = [], colr = []; for (const g of parts) { pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); colr.push(...g.attributes.color.array); }
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); fg.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0xffa000, emissiveIntensity: 0.55, metalness: 0.5, roughness: 0.3 });
    this.flowerMesh = new THREE.InstancedMesh(fg, mat, spots.length); this.flowerMesh.frustumCulled = false; this.flowerMesh.castShadow = true;
    this.collectMeshes = spots.map(([x, z], i) => ({ x, z, idx: i, alive: !this.profile.collected.includes(i), rot: i }));
    const geo = this.flowerMesh;
    this.collectSpots = spots; this.scene.add(geo);
  }
  updateCollectibles(dt) {
    if (!this.flowerMesh) return; const p = this.player.pos; const t = performance.now() / 1000; const m4 = this._fm || (this._fm = new THREE.Matrix4()); const q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    for (const f of this.collectMeshes) {
      if (f.alive) {
        f.rot += dt * 1.6; const y = this.world.heightAt(f.x, f.z) + 1.0 + Math.sin(t * 2 + f.idx) * 0.15;
        m4.compose(v.set(f.x, y, f.z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), f.rot), sc.set(1, 1, 1));
        if (Math.hypot(f.x - p.x, f.z - p.z) < 1.6 && Math.abs(y - 1 - p.y) < 2.5) {
          f.alive = false; this.profile.collected.push(f.idx);
          this.claim('collect', f.idx).then(r => { this.audio.levelUp(); this.ui.big('🌼 Golden Nonsi Flower', `${this.profile.collected.length} / 25 found${r.ok ? ' · +' + fmt(r.amount) : ''}`); this.addXP(60); this.save(); });
        }
      }
      if (!f.alive) m4.makeScale(0, 0, 0);
      this.flowerMesh.setMatrixAt(f.idx, m4);
    }
    this.flowerMesh.instanceMatrix.needsUpdate = true;
  }
  // ---------------- per-frame logic ----------------
  tick(dt) {
    const p = this.profile; if (!p) return;
    const pl = this.player; const t = this.time();
    // needs (1 game hour = 120 s)
    const running = pl.mode === 'walk' && pl.speed > 4.6; const sprint = pl.mode === 'walk' && pl.speed > 6.2;
    this.stat('hunger', -dt * 0.033 * (running ? 1.6 : 1));
    this.stat('energy', -dt * (0.022 + (running ? 0.07 : 0) + (sprint ? 0.08 : 0) + (pl.mode === 'swim' ? 0.06 : 0)));
    this.stat('mood', -dt * 0.008 + (pl.mode === 'drive' ? dt * 0.004 : 0));
    if (p.stats.hunger < 8 || p.stats.energy < 4) this.stat('health', -dt * 0.06); else if (p.stats.hunger > 40 && p.stats.energy > 30) this.stat('health', dt * 0.012);
    if (p.stats.health <= 0 && !this._fainting) this.faint();
    // distance counters + skill gains
    if (!this.lastPos) this.lastPos = pl.pos.clone();
    const moved = Math.hypot(pl.pos.x - this.lastPos.x, pl.pos.z - this.lastPos.z); this.lastPos.copy(pl.pos);
    if (moved < 30) {
      if (pl.mode === 'walk' && running) { p.counters.run += moved; this.event('distance', moved); this.skill('fit', moved * 0.0012); }
      else if (pl.mode === 'drive' || pl.mode === 'ride') { p.counters.drive += moved; this.event('drive', moved); this.skill('drv', moved * 0.0006); }
      else if (pl.mode === 'swim') this.skill('fit', moved * 0.004);
    }
    // timers
    this.questTimer -= dt;
    if (this.questTimer <= 0) {
      this.questTimer = 0.5; this.checkPassiveQuests(); this.checkDiscovery(); this.checkTrack();
      if (this.dayCache !== t.day) { this.dayCache = t.day; this.checkAllowance(); this.ensureDaily(t.day); }
    }
    this.saveTimer -= dt; if (this.saveTimer <= 0) { this.saveTimer = 10; this.save(); }
    this.updateRoute(dt); this.updateCollectibles(dt); this.tickTask(dt);
  }
  faint() {
    this._fainting = true; this.ui.fade(true); this.ui.big('You fainted…', 'Rest and eat to stay healthy');
    setTimeout(async () => {
      const clinic = this.world.places.CLINIC || this.world.places.B01; const d = clinic._door;
      this.player.teleport(d.x, d.z); const p = this.profile; p.stats.health = 60; p.stats.energy = Math.max(p.stats.energy, 40); p.stats.hunger = Math.max(p.stats.hunger, 40);
      if (p.money >= 300) await this.buy('service', 'clinic'); this.ui.toast('🏥 Treated at the clinic'); this.ui.fade(false); this._fainting = false;
    }, 2200);
  }
  checkDiscovery() {
    const pos = this.player.pos;
    for (const pl of Object.values(this.world.places)) {
      if (this.discovered.has(pl.id)) continue;
      if (Math.hypot(pl._door.x - pos.x, pl._door.z - pos.z) < 16) { this.discovered.add(pl.id); if (!this.flags['disc_' + pl.id]) { this.flags['disc_' + pl.id] = 1; this.ui.toast(`🧭 Discovered: <b>${pl.th || pl.name}</b>`); this.addXP(12); } }
    }
  }
  checkTrack() {
    const cps = this.world.trackCheckpoints; if (!cps || this.player.mode !== 'walk') return; const pos = this.player.pos;
    const ts = this.trackState || (this.trackState = { next: 0, started: 0, count: 0 });
    const [cx, cz] = cps[ts.next % 4];
    if (Math.hypot(cx - pos.x, cz - pos.z) < 9) {
      if (ts.count === 0) ts.started = performance.now();
      ts.count++; ts.next = (ts.next + 1) % 4;
      if (ts.count === 5) { const secs = (performance.now() - ts.started) / 1000; this.ui.big('🏃 Lap complete!', `${secs.toFixed(1)} s`); this.skill('fit', 2); this.addXP(40); this.event('run'); ts.count = 1; ts.started = performance.now(); }
      else if (ts.count > 1) this.ui.toast(`Checkpoint ${ts.count - 1}/4`);
    }
  }
  // ---------------- route tasks (delivery, taxi, side quests) ----------------
  startTask(task) { this.task = task; this.routeTimer = 0; this.ui.toast(`🧭 ${task.title}: ${task.desc}`); this.audio.notify(); }
  cancelTask() { if (this.task && this.task.passenger) this.task.passenger(false); this.task = null; this.ui.toast('Task cancelled'); }
  tickTask(dt) {
    const tk = this.task; if (!tk) return; const pos = this.player.pos;
    if (tk.limit) { tk.time += dt; if (tk.time > tk.limit && !tk.late) { tk.late = true; this.ui.toast('⏰ Running late — tip lost', 'bad'); } }
    const d = Math.hypot(tk.target.x - pos.x, tk.target.z - pos.z);
    if (d < (tk.radius || 7)) { const next = tk.onArrive(this); if (!next) { if (this.task === tk) this.task = null; } }
  }
}
