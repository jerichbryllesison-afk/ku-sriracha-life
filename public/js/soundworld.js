// Game ↔ audio integration: listener from the camera, surface-aware footsteps from animation heel strikes (player,
// NPCs, online players), vehicle engine descriptors (own, traffic, remote), horns (player input, traffic AI, network
// events), NPC conversations / laughs / shouts, ball kicks, and zone-based campus ambience (wind, leaves, birds,
// cicadas, traffic bed, crowd murmur, AC hum, waves, rain) with an enclosure-driven reverb send.
import { SURF } from './collision.js';
import { CLOTHES, dayPhase, VEHICLES } from '../shared/catalog.js';

export const SURF_SND = { [SURF.GRASS]: 'grass', [SURF.ROAD]: 'asphalt', [SURF.WALK]: 'concrete', [SURF.BUILDING]: 'concrete', [SURF.SAND]: 'sand', [SURF.WATER]: 'water', [SURF.PIER]: 'wood', [SURF.DIRT]: 'dirt', [SURF.PLAZA]: 'tile', [SURF.PARKING]: 'asphalt', [SURF.SPORT]: 'rubber', [SURF.MEDIAN]: 'grass', [SURF.FARM]: 'dirt', [SURF.FOREST]: 'leaves', [SURF.PLATFORM]: 'wood', [SURF.POOL]: 'tile', [SURF.RAIL]: 'gravel', [SURF.URBAN]: 'concrete' };
const VKIND = { bicycle: 'bike', moto: 'scooter', scooter: 'scooter', sport: 'sport', car: 'hatch', pickup: 'diesel', sedan: 'car', super: 'super' };
// engine profile for a vehicle type: catalog entry first (each model sounds different), then the generic class
const ek = (t) => (VEHICLES[t] && VEHICLES[t].engine) || VKIND[t] || 'car';
const TKIND = ['hatch', 'car', 'diesel', 'diesel', 'car', 'scooter']; // traffic TYPES order
const HORN = { bike: 'bike', scooter: 'moto', sport: 'moto', diesel: 'diesel', car: 'car', hatch: 'car', super: 'car', click: 'moto', pcx: 'moto', vespa: 'moto', forza: 'moto', hybrid: 'car', civic: 'car', bmw: 'car', amg: 'car' };
const TALK = new Set(['talk', 'sitTalk', 'eat', 'listen', 'laugh', 'work']);
const GREEN = new Set([SURF.GRASS, SURF.FOREST, SURF.MEDIAN, SURF.FARM]);
const rr = (a, b) => a + Math.random() * (b - a);

export class SoundWorld {
  constructor(d) {
    Object.assign(this, d); const A = this.audio;
    A.occluder = (x, y, z) => this.occlusion(x, y, z);
    this.desc = new Map(); this.list = []; this.t = 0; this.scanT = 0; this.zoneT = 0; this.chatT = 0; this.gust = 0.5; this.gustV = 0;
    this.prevL = null; this.cicadas = []; this.stalls = new Map(); this.greenPts = []; this.Lv = { x: 0, z: 0 }; this._f = this.camera.position.clone(); this.hornAt = 0;
    const P = this.player;
    P.char.sfx = (k, foot, run, sp) => { if (k === 'step') this.step(P.pos.x, P.pos.y, P.pos.z, run, sp, this.shoeOf(P.char.look), true); else if (k === 'clap') A.clap(0, 0, 0, true); };
    P.onLand = (v) => A.land(P.pos.x, P.pos.y, P.pos.z, this.surfAt(P.pos.x, P.pos.z), v, true);
    P.onJump = () => A.footstep(0, 0, 0, this.surfAt(P.pos.x, P.pos.z), { local: true, run: true, gain: 0.5, rate: 1.1 });
    P.onStop = () => A.footstep(0, 0, 0, this.surfAt(P.pos.x, P.pos.z), { local: true, run: true, gain: 0.7, rate: 0.9 });
    if (this.life) { this.life.onSay = (a, kind) => { if (a.dist < 30) A.voice(a.x, (a.y || 0) + 1.55, a.z, this.female(a.c), kind === 'sport' || kind === 'takraw' ? 'shout' : 'talk', { prio: 2 }); }; this.life.onKick = (x, y, z, p) => A.kick(x, y, z, p); }
    if (this.traffic) this.traffic.onHonk = (car, style) => { const k = HORN[TKIND[car.ti] || 'car']; const y = this.world.heightAt(car.x, car.z) + 1; A.horn3D(car.x, y, car.z, k, style === 'annoyed' ? 0.22 : 0.38); if (style === 'annoyed') setTimeout(() => A.horn3D(car.x, y, car.z, k, 0.5), 300); };
    if (this.net) this.net.on('sfx', (m) => { if (!m || m.k !== 'horn') return; const r = this.remotes.map.get(m.id); if (!r) return; A.horn3D(r.x, r.y + 1, r.z, HORN[r.veh ? ek(r.veh.type) : 'car'] || 'car', 0.42); });
    // place groups for location ambience (door anchors): food courts, cafés, sports grounds
    const by = (kinds) => Object.values(this.world.places || {}).filter(p => kinds.includes(p.kind) && p._door).map(p => p._door);
    this.foodDoors = by(['cafeteria', 'foodstreet', 'market', 'noodle', 'mookata', 'seafood']); this.cafeDoors = by(['cafe']); this.sportDoors = by(['stadium', 'court']);
    this.mT = rr(120, 200); this.mOn = true; // first music set starts with the session
    if (this.game && this.game.interactPlace) { const oi = this.game.interactPlace; this.game.interactPlace = (pl) => { if (pl && ['mart', 'coop', 'fashion', 'cafe', 'bank', 'barber', 'moto', 'cars'].includes(pl.kind) && A.buf.chime) A.play2D(A.buf.chime, { cat: 'effects', gain: 0.35 }); return oi(pl); }; }
    if (this.game && this.game.talkTo) { const orig = this.game.talkTo; this.game.talkTo = (npc) => { const r = orig(npc); if (npc && npc.x !== undefined) setTimeout(() => A.voice(npc.x, (npc.y || this.world.heightAt(npc.x, npc.z)) + 1.55, npc.z, this.female(npc.c), 'talk', { prio: 2, gain: 0.65 }), 250); return r; }; }
  }
  female(c) { return !!(c && c.look && c.look.gender === 'f'); }
  shoeOf(look) { const c = look && CLOTHES[look.shoes]; return c ? (c.style === 'sandal' ? 'sandal' : c.style === 'shoe' ? 'shoe' : c.style === 'boot' ? 'boot' : 'sneaker') : 'sneaker'; }
  surfAt(x, z) { return SURF_SND[this.world.col.surfAt(x, z)] || 'concrete'; }
  occlusion(x, y, z) { const L = this.audio.L; const f = this.world.col.raySegment(L.x, L.y, L.z, x, y, z, 0.05); return f < 0.97 ? 1 : 0; }
  step(x, y, z, run, sp, shoe, local, npc) { this.audio.footstep(x, y, z, this.surfAt(x, z), { run, shoe, local, npc, wet: this.wet, gain: local ? (run ? 1 : 0.78) : npc ? 0.7 : 1, prio: npc ? 0 : 2, max: npc ? 22 : 30 }); }

  // ---------------- per frame ----------------
  update(dt, s) {
    const A = this.audio; if (!A.ctx) return; this.t += dt; const cam = this.camera, P = this.player;
    // listener: camera orientation, positioned 60 % of the way from the camera to the player's head (third-person convention)
    const v = P.vehicle; const hx = v ? v.x : P.pos.x, hy = (v ? v.y : P.pos.y) + 1.5, hz = v ? v.z : P.pos.z;
    const lx = cam.position.x + (hx - cam.position.x) * 0.6, ly = cam.position.y + (hy - cam.position.y) * 0.6, lz = cam.position.z + (hz - cam.position.z) * 0.6;
    cam.getWorldDirection(this._f);
    if (this.prevL && dt > 0) { const k = 1 - Math.exp(-dt * 8); this.Lv.x += ((lx - this.prevL.x) / dt - this.Lv.x) * k; this.Lv.z += ((lz - this.prevL.z) / dt - this.Lv.z) * k; if (Math.hypot(lx - this.prevL.x, lz - this.prevL.z) > 30) { this.Lv.x = this.Lv.z = 0; } }
    this.prevL = this.prevL || {}; this.prevL.x = lx; this.prevL.z = lz;
    A.setListener(lx, ly, lz, this._f.x, this._f.y, this._f.z, this.Lv.x, this.Lv.z);
    this.wet = (s.rain || 0) > 0.3;
    A.duck(!!s.ducked);
    this.vehicles(dt, s);
    this.scanT -= dt; if (this.scanT <= 0) { this.scanT = 0.5; this.scan(); }
    this.zoneT -= dt; if (this.zoneT <= 0) { this.zoneT = 0.5; this.zones(s); }
    this.chatT -= dt; if (this.chatT <= 0) { this.chatT = 0.35; this.chatter(); }
    // sitting down (player)
    if (P.sitting && !this._sat) A.sit(0, 0, 0, true); this._sat = !!P.sitting;
  }
  _d(id) { let o = this.desc.get(id); if (!o) { o = { id, kind: 'car', x: 0, y: 0, z: 0, vx: 0, vz: 0, speed: 0, throttle: 0, drift: 0, brake: false, on: true, local: false, surface: 'asphalt', air: false, accel: 0, seen: 0 }; this.desc.set(id, o); } o.seen = this.t; return o; }
  vehicles(dt, s) {
    const L = this.list; L.length = 0; const P = this.player, v = P.vehicle, A = this.audio;
    if (v) {
      const o = this._d('me:' + v.id); o.kind = ek(v.type); o.mods = v.mods; o.x = v.x; o.y = v.y; o.z = v.z; o.vx = v.vx || 0; o.vz = v.vz || 0; o.speed = v.speed; o.throttle = Math.max(0, v.thr || 0); o.brake = !!v.brk; o.drift = v.drift || 0; o.air = !!v.air; o.local = true; o.surface = this.surfAt(v.x, v.z);
      o.on = this.t > (this.startAt || 0) && (!v.spec.tank || v.fuel > 0); L.push(o);
      if (this._vAir && !v.air && Math.abs(v.speed) > 3) { if (v.type === 'bicycle') A.play2D(A.pick(A.buf.rattle, 'rt'), { cat: 'vehicles', gain: 0.6 }); else A.impact(0, 0, 0, 0.12, true); } // suspension bump on landing
      this._vAir = !!v.air;
      // bicycle on rough ground: small fender / bell rattles at a rate that grows with speed
      if (v.type === 'bicycle' && Math.abs(v.speed) > 2 && ['dirt', 'gravel', 'grass', 'leaves'].includes(o.surface) && Math.random() < dt * Math.abs(v.speed) * 0.12) A.play2D(A.pick(A.buf.rattle, 'rt'), { cat: 'vehicles', gain: 0.25 + Math.random() * 0.2, rate: 0.9 + Math.random() * 0.2 });
    }
    if (this.shut && this.t < this.shut.until) { const sv = this.shut.v, o = this._d('me:' + sv.id); o.kind = ek(sv.type); o.x = sv.x; o.y = sv.y; o.z = sv.z; o.speed = 0; o.throttle = 0; o.on = false; o.local = false; L.push(o); }
    if (this.traffic) for (const car of this.traffic.cars) {
      if (car._sid === undefined) car._sid = 't' + (SoundWorld._n = (SoundWorld._n || 0) + 1);
      const dx = car.x - A.L.x, dz = car.z - A.L.z; if (dx * dx + dz * dz > 160 * 160) continue;
      const o = this._d(car._sid); o.kind = TKIND[car.ti] || 'car'; o.x = car.x; o.y = this.world.heightAt(car.x, car.z); o.z = car.z; o.speed = car.speed; o.vx = Math.sin(car.h) * car.speed; o.vz = Math.cos(car.h) * car.speed;
      o.throttle = Math.max(0, car.acc) / (car.moto ? 2.6 : 1.8); o.accel = car.acc; o.brake = car.acc < -1.5; o.drift = 0; o.air = false; o.local = false; o.on = true; o.surface = 'asphalt'; L.push(o);
    }
    if (this.remotes) for (const r of this.remotes.map.values()) {
      if (!r.veh) continue; const o = this._d('r:' + r.id); const px = o.x, pz = o.z, ps = o.speed;
      o.kind = ek(r.veh.type); o.x = r.veh.x; o.y = r.veh.y; o.z = r.veh.z; o.speed = r.veh.speed;
      if (dt > 0 && o.seen > 0) { const k = 1 - Math.exp(-dt * 5); o.vx += ((o.x - px) / dt - o.vx) * k; o.vz += ((o.z - pz) / dt - o.vz) * k; const acc = (Math.abs(o.speed) - Math.abs(ps)) / dt; o.throttle += (Math.max(0, Math.min(1, acc / 2.5 + (Math.abs(o.speed) > 1 ? 0.15 : 0))) - o.throttle) * k; o.brake = acc < -4; }
      if (Math.hypot(o.vx, o.vz) > 60) { o.vx = o.vz = 0; }
      o.local = false; o.on = true; o.drift = 0; o.air = false; o.surface = 'asphalt'; L.push(o);
    }
    A.syncVehicles(L, dt);
    if (Math.random() < 0.01) for (const [id, o] of this.desc) if (this.t - o.seen > 8) this.desc.delete(id);
  }
  // footstep hooks for NPCs / online players near the listener; vehicle enter/exit sounds for online players
  scan() {
    const A = this.audio, L = A.L;
    if (this.life) for (const a of this.life.agents) {
      const near = Math.abs(a.x - L.x) < 30 && Math.abs(a.z - L.z) < 30;
      if (near && !a.c.sfx) a.c.sfx = (k, foot, run) => { if (k === 'step') this.step(a.x, a.y || 0, a.z, run, 0, this.shoeOf(a.c.look), false, true); else if (k === 'clap') A.clap(a.x, (a.y || 0) + 1.2, a.z, false); };
      else if (!near && a.c.sfx) a.c.sfx = null;
    }
    if (this.npcs) for (const n of this.npcs.givers || []) if (n.c && !n.c.sfx) n.c.sfx = (k, foot, run) => { if (k === 'step') this.step(n.x, n.y || this.world.heightAt(n.x, n.z), n.z, run, 0, this.shoeOf(n.c.look), false, true); };
    if (this.remotes) for (const r of this.remotes.map.values()) {
      if (!r.c.sfx) r.c.sfx = (k, foot, run) => { if (r.veh) return; if (k === 'step') this.step(r.x, r.y, r.z, run, 0, this.shoeOf(r.c.look), false, false); else if (k === 'clap') A.clap(r.x, r.y + 1.2, r.z, false); };
      const has = !!r.veh; if (r._hadVeh !== undefined && has !== r._hadVeh && A.dist(r.x, r.z) < 40) { const moto = has ? r.veh.moto : r._moto; A.doorAt(r.x, r.y + 0.8, r.z, moto ? 'moto' : 'car', false); if (has && r.veh.type !== 'bicycle') setTimeout(() => A.starter(r.x, r.y + 0.6, r.z, moto, false), 350); }
      r._hadVeh = has; if (has) r._moto = r.veh.moto;
    }
  }
  // background music: plays in sets (≈2.5–4 min) with ambience-only gaps (≈1.5–3.5 min); lower in the world than in menus.
  // The phone radio forces continuous play. Respects the player's music on/off setting.
  music(dt, on) {
    const A = this.audio; if (!A.ctx) return;
    if (A.radioForced) { if (!A.bgmOn) A.bgm(true); A.setMusicScale(0.75); return; }
    // live band: music near the bars in the afternoon / evening (or after you sat down to watch)
    const bars = this._bars || (this._bars = Object.values(this.world.places || {}).filter(p => p.kind === 'bar' && p._door).map(p => p._door)); const P = this.player.pos;
    if (bars.some(b => Math.hypot(b.x - P.x, b.z - P.z) < 45) && ((this.game && this.game.time().hour > 14.5) || (this.game && this.game.liveBand && performance.now() - this.game.liveBand < 300000))) { if (!A.bgmOn) A.bgm(true); A.setMusicScale(1.0); return; }
    if (!on) { if (A.bgmOn) A.bgm(false); return; }
    A.setMusicScale(this.player.vehicle ? 0.72 : 0.6); // music sits under engines and effects
    this.mT -= dt; if (this.mT <= 0) { this.mOn = !this.mOn; this.mT = this.mOn ? rr(200, 320) : rr(40, 90); }
    if (A.running && this.mOn !== !!A.bgmOn) A.bgm(this.mOn);
  }
  // local player gets on / off a vehicle
  enter(v) {
    const A = this.audio; const moto = v.moto; this.shut = null;
    if (v.type === 'bicycle') { A.doorAt(0, 0, 0, 'moto', true); this.startAt = 0; return; }
    if (moto) { A.doorAt(0, 0, 0, 'moto', true); setTimeout(() => A.starter(0, 0, 0, true, true), 250); this.startAt = this.t + 0.75; }
    else { A.doorAt(0, 0, 0, 'carOpen', true); setTimeout(() => A.doorAt(0, 0, 0, 'car', true), 650); setTimeout(() => A.starter(0, 0, 0, false, true), 1000); this.startAt = this.t + 1.75; }
  }
  exit(v) {
    const A = this.audio; if (!v) return; this.shut = { v, until: this.t + 1.6 };
    if (v.moto || v.type === 'bicycle') A.doorAt(v.x, v.y + 0.6, v.z, 'moto', true);
    else { A.doorAt(0, 0, 0, 'carOpen', true); setTimeout(() => A.doorAt(v.x, v.y + 0.8, v.z, 'car', false), 550); }
  }
  localHorn() { const v = this.player.vehicle; if (!v) return; const now = performance.now(); if (now - this.hornAt < 300) return; this.hornAt = now; this.audio.horn(v.type); if (this.net) this.net.send('sfx', 'horn'); }

  // ---------------- conversations (turn-taking, cooldowns, laughs) ----------------
  chatter() {
    if (!this.life) return; const A = this.audio, L = A.L, now = this.t; const near = this._near || (this._near = []); near.length = 0;
    for (const a of this.life.agents) { if (a.act !== 'pose' || !TALK.has(a.pose)) continue; const d = Math.hypot(a.x - L.x, a.z - L.z); if (d < 22) near.push(a); }
    for (const a of near) {
      if (a._talkNext === undefined) a._talkNext = now + rr(0.5, 5);
      if (now < a._talkNext || (a._spk || 0) > now) continue;
      let busy = false; for (const b of near) if (b !== a && (b._spk || 0) > now && Math.abs(b.x - a.x) < 3 && Math.abs(b.z - a.z) < 3) { busy = true; break; }
      if (busy) { a._talkNext = now + rr(0.4, 1.2); continue; }
      const kind = a.pose === 'laugh' || Math.random() < 0.06 ? 'laugh' : a.pose === 'work' && Math.random() < 0.5 ? 'shout' : 'talk';
      const src = A.voice(a.x, (a.y || 0) + (a.pose === 'sitTalk' || a.pose === 'eat' ? 1.1 : 1.55), a.z, this.female(a.c), kind, { gain: kind === 'shout' ? 0.4 : 0.5 });
      const dur = src && src.buffer ? src.buffer.duration / src.playbackRate.value : 1.2;
      a._spk = now + dur; a._talkNext = now + dur + rr(1.5, 4.5) * (a.pose === 'eat' || a.pose === 'work' ? 2.5 : a.pose === 'listen' ? 1.8 : 1);
      // the partner answers after a short gap (turn-taking)
      for (const b of near) if (b !== a && Math.abs(b.x - a.x) < 3 && Math.abs(b.z - a.z) < 3) b._talkNext = Math.max(b._talkNext || 0, now + dur + rr(0.15, 0.8));
    }
  }

  // ---------------- ambience zones ----------------
  zones(s) {
    const A = this.audio, L = A.L, col = this.world.col; let bld6 = 0, bld14 = 0, road = 0, green = 0, n6 = 0, n14 = 0; const gp = this.greenPts; gp.length = 0;
    for (const [r, n] of [[6, 10], [14, 12], [28, 12]]) for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + r, x = L.x + Math.cos(a) * r, z = L.z + Math.sin(a) * r, k = col.surfAt(x, z);
      if (r === 6) { n6++; if (k === SURF.BUILDING) bld6++; } else if (r === 14) { n14++; if (k === SURF.BUILDING) bld14++; }
      if (k === SURF.ROAD || k === SURF.PARKING) road++; if (GREEN.has(k)) { green++; if (r > 6) gp.push(x, z); }
    }
    const tot = 34, encl = Math.min(1, (bld6 / n6) * 0.6 + (bld14 / n14) * 0.6), gr = green / tot, rd = road / tot;
    A.setEnvWet(0.04 + encl * 0.38);
    this.gustV += (Math.random() - 0.5) * 0.35; this.gustV *= 0.85; this.gust = Math.max(0, Math.min(1, this.gust + this.gustV * 0.5));
    const hour = s.hour || 12, height = Math.max(0, L.y), phase = dayPhase(hour);
    const rush = (hour > 7.3 && hour < 8.8) || hour > 16.3 ? 1.5 : phase === 'midday' ? 1.1 : 1; // commuter peaks (morning arrival, evening departure)
    const lunch = hour > 11.4 && hour < 13.1 ? 1.6 : 1; const seaBreeze = hour > 13 && this.world.bounds && Math.abs(L.x - this.world.bounds.coastX) < 700 ? 0.015 : 0;
    let far = 0; if (this.traffic) for (const c of this.traffic.cars) { const d = Math.hypot(c.x - L.x, c.z - L.z); if (d > 60 && d < 420) far += 1 / (1 + d / 40); }
    let crowd = 0; if (this.life) for (const a of this.life.agents) { const d = Math.abs(a.x - L.x) + Math.abs(a.z - L.z); if (d < 32) crowd += a.act === 'pose' && TALK.has(a.pose) ? 1 : 0.3; }
    const caf = this.world.places && this.world.places.B07 && this.world.places.B07._door; const nearCaf = caf ? Math.max(0, 1 - Math.hypot(caf.x - L.x, caf.z - L.z) / 45) : 0;
    const coast = this.world.bounds ? Math.abs(L.x - this.world.bounds.coastX) : 999, suk = Math.max(0, 1 - Math.abs(L.x + 1095) / 320);
    const wind = (0.022 + height * 0.0009 + (1 - encl) * 0.02 + seaBreeze) * (0.6 + this.gust * 0.8);
    A.setBeds({
      wind, leaves: gr * 0.05 * (0.4 + this.gust + seaBreeze * 10), traffic: Math.min(0.1, (0.012 * far + rd * 0.02) * rush), city: (suk * 0.05 + 0.006) * rush,
      waves: Math.max(0, 1 - coast / 130) * 0.22, rain: (s.rain || 0) * 0.24, hum: (bld6 / n6) * 0.035 * (phase === 'midday' || phase === 'afternoon' ? 1.2 : 0.9), walla: Math.min(0.2, crowd * 0.024 + nearCaf * 0.08 * lunch + 0.006),
    });
    // birds: dawn chorus in the morning, fewer at midday; positioned in nearby greenery
    if (gp.length && A.running) {
      // morning chorus; quiet heat of midday; mynas gathering noisily in big trees before evening
      const rate = Math.min(1.6, (gr + 0.08) * 1.6 * (hour < 9 ? 0.75 : phase === 'morning' ? 0.45 : phase === 'midday' ? 0.22 : phase === 'afternoon' ? 0.32 : 0.6)); if (Math.random() < rate * 0.5) {
        const i = ((Math.random() * gp.length / 2) | 0) * 2, x = gp[i], z = gp[i + 1]; const r = Math.random();
        const sp = hour < 9 ? (r < 0.22 ? 'koel' : r < 0.4 ? 'myna' : r < 0.58 ? 'bulbul' : r < 0.7 ? 'oriole' : r < 0.82 ? 'dove' : r < 0.92 ? 'tailor' : 'sparrow') : phase === 'evening' ? (r < 0.45 ? 'myna' : r < 0.6 ? 'sparrow' : r < 0.75 ? 'bulbul' : r < 0.85 ? 'crow' : r < 0.95 ? 'dove' : 'koel') : (r < 0.06 ? 'koel' : r < 0.3 ? 'myna' : r < 0.5 ? 'bulbul' : r < 0.62 ? 'tailor' : r < 0.74 ? 'dove' : r < 0.82 ? 'oriole' : r < 0.88 ? 'crow' : 'sparrow');
        A.bird3D(x, this.world.heightAt(x, z) + rr(5, 11), z, sp);
      }
    }
    // cicadas: Thai midday chorus in trees, swelling and fading in cycles
    const wantC = hour > 9.5 && hour < 16.5 && gr > 0.22 ? (A.hq ? 2 : 1) : 0;
    for (const c of this.cicadas) {
      c.t -= 0.5;
      if (c.state === 'rest' && c.t <= 0 && wantC && gp.length) { const i = ((Math.random() * gp.length / 2) | 0) * 2; c.em = A.emitter('cicada', gp[i], this.world.heightAt(gp[i], gp[i + 1]) + 6, gp[i + 1]); if (c.em) { c.em.set(0.05, 1.2); c.state = 'on'; c.t = rr(6, 12); } }
      else if (c.state === 'on' && (c.t <= 0 || !wantC)) { if (c.em) c.em.stop(); c.em = null; c.state = 'rest'; c.t = rr(8, 25); }
    }
    while (this.cicadas.length < wantC) this.cicadas.push({ state: 'rest', t: rr(1, 6), em: null });
    // place life: cutlery & plates at food courts (busiest at lunch), espresso steam at cafés, referee whistles at active pitches
    if (A.running) {
      const nearest = (arr) => { let b = null, bd = 1e9; for (const d of arr) { const k = Math.hypot(d.x - L.x, d.z - L.z); if (k < bd) { bd = k; b = d; } } return [b, bd]; };
      const [fd, fdd] = nearest(this.foodDoors); if (fd && fdd < 40 && Math.random() < (phase === 'midday' ? 0.5 : 0.25) * lunch * 0.5) { const x = fd.x + rr(-8, 8), z = fd.z + rr(-8, 8); A.play3D(A.pick(A.buf.clink, 'ck'), x, this.world.heightAt(x, z) + 0.9, z, { cat: 'ambient', gain: rr(0.2, 0.45), rate: rr(0.9, 1.15), ref: 2, max: 40, occ: true }); }
      const [cd, cdd] = nearest(this.cafeDoors); if (cd && cdd < 22) { if (Math.random() < 0.04) A.play3D(A.buf.steam, cd.x, this.world.heightAt(cd.x, cd.z) + 1.1, cd.z, { cat: 'ambient', gain: 0.3, ref: 2, max: 25, occ: true }); if (Math.random() < 0.12) A.play3D(A.pick(A.buf.clink, 'cc'), cd.x + rr(-3, 3), this.world.heightAt(cd.x, cd.z) + 1, cd.z + rr(-3, 3), { cat: 'ambient', gain: 0.25, rate: rr(1.1, 1.4), ref: 2, max: 25 }); }
      const pitch = this.life && this.life.pitch; if (pitch && pitch.players && pitch.players.length >= 4 && Math.hypot(pitch.x - L.x, pitch.z - L.z) < 140 && Math.random() < 0.025) A.play3D(A.pick(A.buf.whistle, 'wh'), pitch.x, this.world.heightAt(pitch.x, pitch.z) + 1.6, pitch.z, { cat: 'npc', gain: 0.5, ref: 8, max: 160 });
    }
    // food-stall sizzle at carts with a vendor
    if (this.life && this.life.carts) {
      for (const k of this.life.carts) { const d = Math.hypot(k.x - L.x, k.z - L.z); const has = this.stalls.get(k);
        if (!has && d < 20 && k.vendor && this.stalls.size < 2 && A.buf.sizzle) { const e = A.emitter('sizzle', k.x, this.world.heightAt(k.x, k.z) + 1, k.z); if (e) { e.set(0.16); this.stalls.set(k, e); } }
        else if (has && (d > 28 || !k.vendor)) { has.stop(); this.stalls.delete(k); } }
    }
  }
}
