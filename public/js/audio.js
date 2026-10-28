// KU Sriracha Life audio engine (Web Audio API, procedural — no third-party recordings).
// Buses: master → limiter; categories music / ambient / footsteps / vehicles / npc / ui / effects / voice, with a shared
// environment reverb send. Spatial sources use PannerNode (inverse distance model) + per-voice air-absorption /
// occlusion low-pass + a rear-hemisphere high-cut (front/back cue for equal-power panning) + Doppler on pitch.
// Engine voices are pooled (nearest/most important vehicles get them; others fade, never cut); one-shots are
// concurrency-limited per category. See docs/AUDIO_ARCHITECTURE.md.
import * as SX from './sfxsynth.js';

const C_SOUND = 343; // m/s
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// engine profiles: cylinders (firing order), idle / redline rpm, gear speeds (m/s per 1000 rpm), tone filter range
export const ENGINES = {
  car: { cyl: 4, idle: 820, red: 6200, gears: [2.2, 3.9, 5.7, 7.6, 9.6], lp: [420, 2600], level: 0.42, exh: 0.32, ref: 6 },
  hatch: { cyl: 4, idle: 880, red: 6600, gears: [2.1, 3.7, 5.4, 7.2, 9.0], lp: [480, 3000], level: 0.38, exh: 0.3, ref: 5.5 },
  diesel: { cyl: 4, idle: 760, red: 4200, gears: [2.0, 3.6, 5.4, 7.4, 9.4], lp: [330, 1500], level: 0.46, exh: 0.55, ref: 7, rattle: true },
  scooter: { cyl: 1, idle: 1650, red: 8200, cvt: true, lp: [650, 3300], level: 0.36, exh: 0.6, ref: 4.5 },
  sport: { cyl: 2, idle: 1250, red: 10500, gears: [3.0, 4.6, 6.1, 7.6, 9.0, 10.4], lp: [700, 4600], level: 0.52, exh: 0.5, ref: 6 },
  super: { cyl: 8, idle: 950, red: 8400, gears: [3.2, 5.2, 7.4, 9.6, 12, 14.5], lp: [520, 3800], level: 0.55, exh: 0.4, ref: 7 },
  bike: { cyl: 0, ref: 3 }, // bicycle: tyres + freewheel only
  // living-campus line-up: each model has its own character
  click: { cyl: 1, idle: 1700, red: 8600, cvt: true, lp: [760, 3800], level: 0.33, exh: 0.52, ref: 4.5 },              // light 160 cc eSP: buzzy, high idle
  pcx: { cyl: 1, idle: 1550, red: 8400, cvt: true, lp: [620, 3200], level: 0.31, exh: 0.44, ref: 4.5 },                // smoother, quieter 160 cc
  vespa: { cyl: 1, idle: 1300, red: 7400, cvt: true, lp: [480, 2500], level: 0.39, exh: 0.74, ref: 5, putt: true },     // deep single-cylinder putter
  forza: { cyl: 1, idle: 1350, red: 7900, cvt: true, lp: [430, 2700], level: 0.44, exh: 0.66, ref: 5.5 },              // big 330 cc single, bassier
  hybrid: { cyl: 4, idle: 980, red: 5600, cvt: true, ev: true, lp: [380, 2300], level: 0.3, exh: 0.22, ref: 5.5 },     // Camry e-CVT: silent EV pull-away, calm engine
  civic: { cyl: 4, idle: 900, red: 6600, gears: [2.4, 4.0, 5.6, 7.2, 8.8, 10.4, 12, 13.6], ev: true, lp: [540, 3500], level: 0.38, exh: 0.36, ref: 6 }, // e:HEV with stepped "S+ Shift"
  bmw: { cyl: 4, idle: 820, red: 6500, gears: [2.3, 3.9, 5.5, 7.1, 8.8, 10.5, 12.2, 14], ev: true, lp: [400, 2900], level: 0.42, exh: 0.46, ref: 6.5 }, // refined turbo four, plug-in EV start
  amg: { cyl: 8, idle: 900, red: 7200, gears: [2.9, 4.6, 6.4, 8.2, 10, 11.8, 13.6, 15.4, 17.2], lp: [360, 3800], level: 0.62, exh: 0.6, ref: 7.5, crackle: true }, // twin-turbo V8 burble + overrun pops
};
const firing = (p, rpm) => (p.cyl === 1 ? rpm / 120 : p.cyl === 2 ? rpm / 60 : p.cyl === 8 ? rpm / 15 : p.cyl === 6 ? rpm / 20 : rpm / 30);

export class Audio {
  constructor() {
    this.ctx = null; this.vol = 0.55; this.music = 0.3; this.enabled = true; this.engines = new Map(); this.radioOn = false;
    this.cat = { ambient: 0.7, footsteps: 0.72, vehicles: 0.6, npc: 0.75, ui: 0.6, effects: 0.72, voice: 1 }; // balanced medium mix
    this.profile = 'desktop'; this.L = { x: 0, y: 0, z: 0, fx: 0, fz: -1, vx: 0, vz: 0 };
    this.active = { footsteps: 0, npc: 0, effects: 0, vehicles: 0, ambient: 0, ui: 0 };
    this.limits = { footsteps: 10, npc: 6, effects: 10, vehicles: 8, ambient: 8, ui: 8 };
    this.stats = { started: 0, ended: 0, dropped: 0 }; this.buf = {}; this.vstate = new Map(); this.occluder = null; this.envWet = 0.08;
  }
  setProfile(p) { this.profile = p; const m = p === 'mobile'; this.hq = !m; this.limits = m ? { footsteps: 5, npc: 3, effects: 6, vehicles: 5, ambient: 4, ui: 6 } : { footsteps: 10, npc: 6, effects: 10, vehicles: 8, ambient: 8, ui: 8 }; this.nEngine = m ? 4 : 8; }
  init(ctx) {
    if (this.ctx) return; try { this.ctx = ctx || new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' }); } catch (e) { this.enabled = false; return; }
    if (!this.nEngine) this.setProfile(this.profile);
    const c = this.ctx; const sr = c.sampleRate;
    // master chain: master gain → soft limiter (prevents clipping when many sources sum) → output
    this.limiter = c.createDynamicsCompressor(); this.limiter.threshold.value = -10; this.limiter.knee.value = 4; this.limiter.ratio.value = 14; this.limiter.attack.value = 0.003; this.limiter.release.value = 0.25;
    this.master = c.createGain(); this.master.gain.value = this.vol; this.master.connect(this.limiter); this.limiter.connect(c.destination);
    // environment reverb (urban canyon / facades); per-category sends scaled by how enclosed the listener is
    this.verbIn = c.createGain(); this.verbIn.gain.value = 1; this.verb = c.createConvolver();
    const [L, R] = SX.synthIR(sr, this.hq ? 1.3 : 0.55); const ir = c.createBuffer(2, L.length, sr); ir.copyToChannel(L, 0); ir.copyToChannel(R, 1); this.verb.buffer = ir;
    this.verbIn.connect(this.verb); this.verb.connect(this.master);
    this.bus = {}; this.duckG = c.createGain(); this.duckG.connect(this.master); this.send = {};
    for (const k of Object.keys(this.cat)) {
      const g = c.createGain(); g.gain.value = this.cat[k]; this.bus[k] = g;
      g.connect(['ambient', 'vehicles', 'npc', 'footsteps'].includes(k) ? this.duckG : this.master);
      if (['footsteps', 'vehicles', 'npc', 'effects'].includes(k)) { const s = c.createGain(); s.gain.value = 0; g.connect(s); s.connect(this.verbIn); this.send[k] = s; }
    }
    this.sfx = this.bus.ui; this.amb = this.bus.ambient;
    this.musicG = c.createGain(); this.musicG.gain.value = this.music; this.musicG.connect(this.master);
    // shared noise (stereo, decorrelated) for beds / engines
    const len = sr * 3; this.noiseBuf = c.createBuffer(2, len, sr); for (let ch = 0; ch < 2; ch++) { const d = this.noiseBuf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; }
    // soft-clip curve for engine drive
    this.curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; this.curve[i] = Math.tanh(x * 2.2) / Math.tanh(2.2); }
    // ambience beds (2-D, wide): levels driven by the zone analysis in soundworld.js
    const bed = (f, type, q = 0.7) => { const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(this.bus.ambient); s.start(0, Math.random() * 2); return { s, f: fl, g }; };
    this.beds = { wind: bed(380, 'lowpass'), leaves: bed(4200, 'bandpass', 0.5), traffic: bed(160, 'lowpass'), city: bed(420, 'bandpass', 0.4), waves: bed(560, 'lowpass'), rain: bed(3200, 'highpass'), hum: bed(120, 'bandpass', 3) };
    this.wind = this.beds.wind; this.waves = this.beds.waves; this.rainN = this.beds.rain; this.city = this.beds.city;
    // buffers rendered lazily (footsteps per surface on first use; crowd bed after start so loading is not blocked)
    this.buf.clap = [0, 1, 2].map(v => this._mk(SX.synthClap(sr, v))); this.buf.kick = [0, 1].map(v => this._mk(SX.synthKick(sr, v)));
    this.buf.door = { car: [0, 1].map(v => this._mk(SX.synthDoor(sr, 'car', v))), carOpen: [this._mk(SX.synthDoor(sr, 'carOpen', 0))], moto: [0, 1].map(v => this._mk(SX.synthDoor(sr, 'moto', v))) };
    this.buf.sit = [0, 1].map(v => this._mk(SX.synthSit(sr, v))); this.buf.impact = [0, 1, 2].map(v => this._mk(SX.synthImpact(sr, v)));
    this.buf.starter = { moto: this._mk(SX.synthStarter(sr, true)), car: this._mk(SX.synthStarter(sr, false)) };
    this.buf.shoe = {}; for (const k of ['sandal', 'shoe', 'boot', 'sneaker']) this.buf.shoe[k] = [0, 1, 2].map(v => this._mk(SX.synthShoe(sr, k, v)));
    this.buf.clink = [0, 1, 2, 3].map(v => this._mk(SX.synthClink(sr, v))); this.buf.steam = this._mk(SX.synthSteam(sr)); this.buf.whistle = [0, 1].map(v => this._mk(SX.synthWhistle(sr, v))); this.buf.chime = this._mk(SX.synthChime(sr)); this.buf.rattle = [0, 1, 2].map(v => this._mk(SX.synthRattle(sr, v)));
    this.buf.step = {}; this.buf.voice = { m: [], f: [], laughM: [], laughF: [], shoutM: [], shoutF: [] };
    setTimeout(() => this._lazyVoices(), 600);
    // engine voice pool
    this.pool = []; for (let i = 0; i < this.nEngine; i++) this.pool.push(this._engineVoice());
    // lifecycle: suspend in background tabs, resume on return / user gesture (respects autoplay policy)
    if (!ctx) document.addEventListener('visibilitychange', () => { if (!this.ctx) return; if (document.hidden) this.ctx.suspend(); else if (this.unlocked) this.ctx.resume(); });
    const unlock = () => { this.unlocked = true; this.resume(); };
    for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, unlock, { passive: true });
  }
  _mk(data, ch2) { const b = this.ctx.createBuffer(ch2 ? 2 : 1, data.length, this.ctx.sampleRate); b.copyToChannel(data, 0); if (ch2) b.copyToChannel(ch2, 1); return b; }
  _lazyVoices() {
    const sr = this.ctx.sampleRate; const n = this.hq ? 6 : 3; let i = 0;
    const jobs = []; for (let v = 0; v < n; v++) { jobs.push(() => this.buf.voice.m.push(this._mk(SX.synthVoice(sr, false, v)))); jobs.push(() => this.buf.voice.f.push(this._mk(SX.synthVoice(sr, true, v)))); }
    for (let v = 0; v < 2; v++) { jobs.push(() => this.buf.voice.laughM.push(this._mk(SX.synthVoice(sr, false, v, { laugh: true })))); jobs.push(() => this.buf.voice.laughF.push(this._mk(SX.synthVoice(sr, true, v, { laugh: true })))); jobs.push(() => this.buf.voice.shoutM.push(this._mk(SX.synthVoice(sr, false, v, { shout: true })))); jobs.push(() => this.buf.voice.shoutF.push(this._mk(SX.synthVoice(sr, true, v, { shout: true })))); }
    jobs.push(() => { const [L, R] = this._wallaFromBank(this.hq ? 8 : 5); const b = this._mk(L, R); const s = this.ctx.createBufferSource(); s.buffer = b; s.loop = true; const g = this.ctx.createGain(); g.gain.value = 0; s.connect(g); g.connect(this.bus.ambient); s.start(); this.beds.walla = { s, g }; });
    jobs.push(() => { this.buf.sizzle = this._mk(SX.synthSizzle(sr, 3)); });
    const run = () => { const t0 = performance.now(); while (i < jobs.length && performance.now() - t0 < 6) jobs[i++](); if (i < jobs.length) setTimeout(run, 30); };
    run();
  }
  // crowd bed mixed from the already-rendered voice bank (cheap): random offsets, pans, levels, wrapped seamlessly
  _wallaFromBank(seconds) {
    const sr = this.ctx.sampleRate, len = Math.floor(seconds * sr), L = new Float32Array(len), R = new Float32Array(len); const V = [...this.buf.voice.m, ...this.buf.voice.f]; if (!V.length) return [L, R];
    for (let k = 0; k < (this.hq ? 30 : 14); k++) { const d = V[k % V.length].getChannelData(0), off = (Math.random() * len) | 0, pan = Math.random(), g = 0.12 + Math.random() * 0.22, gl = g * Math.cos(pan * Math.PI / 2), gr = g * Math.sin(pan * Math.PI / 2); for (let i = 0; i < d.length; i++) { const j = (off + i) % len; L[j] += d[i] * gl; R[j] += d[i] * gr; } }
    let pk = 1e-6; for (let i = 0; i < len; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); let yl = 0, yr = 0; for (let i = 0; i < len; i++) { yl += (L[i] / pk * 0.5 - yl) * 0.35; yr += (R[i] / pk * 0.5 - yr) * 0.35; L[i] = yl; R[i] = yr; } // normalise + gentle low-pass (distance blur)
    return [L, R];
  }
  stepBufs(surface, run) { const k = surface + (run ? 'R' : 'W'); let a = this.buf.step[k]; if (!a) { const sr = this.ctx.sampleRate; a = this.buf.step[k] = [0, 1, 2, 3].map(v => this._mk(SX.synthStep(sr, surface, run, v))); } return a; }
  resume() { if (this.ctx && this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume(); }
  setVolume(v) { this.vol = v; if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }
  setMusic(v) { this.music = v; if (this.musicG) this.musicG.gain.setTargetAtTime(v * (this.musicScale ?? 1), this.ctx.currentTime, 0.05); }
  setMusicScale(k) { if (this.musicScale === k) return; this.musicScale = k; if (this.musicG) this.musicG.gain.setTargetAtTime(this.music * k, this.ctx.currentTime, 1.5); }
  setCat(k, v) { this.cat[k] = v; if (this.bus && this.bus[k]) this.bus[k].gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }
  duck(on) { if (!this.duckG) return; const t = this.ctx.currentTime; this.duckG.gain.setTargetAtTime(on ? 0.6 : 1, t, on ? 0.15 : 0.4); }
  setEnvWet(w) { this.envWet = w; if (!this.send.footsteps) return; const t = this.ctx.currentTime; for (const [k, s] of Object.entries(this.send)) s.gain.setTargetAtTime(w * (k === 'vehicles' ? 0.7 : 1), t, 0.5); }
  get running() { return !!this.ctx && (this.ctx.state === 'running' || this.forceRun); }

  // ---------------- listener & spatial helpers ----------------
  setListener(x, y, z, fx, fy, fz, vx = 0, vz = 0) {
    const L = this.L; L.x = x; L.y = y; L.z = z; const fl = Math.hypot(fx, fz) || 1; L.fx = fx / fl; L.fz = fz / fl; L.vx = vx; L.vz = vz;
    if (!this.ctx) return; const l = this.ctx.listener;
    if (l.positionX) { l.positionX.value = x; l.positionY.value = y; l.positionZ.value = z; l.forwardX.value = fx; l.forwardY.value = fy; l.forwardZ.value = fz; l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0; }
    else { l.setPosition(x, y, z); l.setOrientation(fx, fy, fz, 0, 1, 0); }
  }
  dist(x, z) { return Math.hypot(x - this.L.x, z - this.L.z); }
  // 0 (in front) … 1 (directly behind): equal-power panning cannot place sounds behind, so rear sources get a gentle high-cut
  behind(x, z) { const dx = x - this.L.x, dz = z - this.L.z, d = Math.hypot(dx, dz) || 1; return Math.max(0, -(dx * this.L.fx + dz * this.L.fz) / d); }
  airCut(d, behind, occ) { return Math.max(500, 19000 / (1 + d / 32)) * (1 - 0.42 * behind) * (1 - 0.72 * occ); }
  // Doppler (moving source and listener, along the line of sight): f' = f (c − v_L·u) / (c − v_S·u), u = source→listener
  doppler(x, z, vx, vz) { const L = this.L, dx = L.x - x, dz = L.z - z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d; return clamp((C_SOUND - (L.vx * ux + L.vz * uz)) / (C_SOUND - (vx * ux + vz * uz)), 0.8, 1.25); }
  _panner(ref, roll = 1, hrtf = false) { const p = this.ctx.createPanner(); p.panningModel = hrtf && this.hq ? 'HRTF' : 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = ref; p.rolloffFactor = roll; p.maxDistance = 10000; return p; }
  _pos(p, x, y, z) { if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z); }
  // one-shot positional buffer. o: { cat, gain, rate, ref, max, delay, occ, prio }
  play3D(buf, x, y, z, o = {}) {
    if (!buf || !this.running) return null; const cat = o.cat || 'effects'; const d = this.dist(x, z); if (d > (o.max || 60)) return null;
    if (this.active[cat] >= this.limits[cat] && !(o.prio > 1)) { this.stats.dropped++; return null; }
    const c = this.ctx, t = c.currentTime + (o.delay || 0);
    const src = c.createBufferSource(); src.buffer = buf; src.playbackRate.value = o.rate || 1;
    const occ = o.occ && this.occluder && d > 5 ? this.occluder(x, y, z) : 0;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = this.airCut(d, this.behind(x, z), occ);
    const g = c.createGain(); g.gain.value = (o.gain ?? 1) * (1 - occ * 0.45);
    const p = this._panner(o.ref || 2, o.roll || 1, o.hrtf); this._pos(p, x, y, z);
    src.connect(f); f.connect(g); g.connect(p); p.connect(this.bus[cat]);
    this.active[cat]++; this.stats.started++;
    src.onended = () => { this.active[cat]--; this.stats.ended++; src.disconnect(); f.disconnect(); g.disconnect(); p.disconnect(); };
    src.start(t); return src;
  }
  play2D(buf, o = {}) {
    if (!buf || !this.running) return null; const cat = o.cat || 'ui'; if (this.active[cat] >= this.limits[cat] + 2) { this.stats.dropped++; return null; }
    const c = this.ctx, src = c.createBufferSource(); src.buffer = buf; src.playbackRate.value = o.rate || 1; const g = c.createGain(); g.gain.value = o.gain ?? 1;
    src.connect(g); g.connect(this.bus[cat]); this.active[cat]++; this.stats.started++;
    src.onended = () => { this.active[cat]--; this.stats.ended++; src.disconnect(); g.disconnect(); }; src.start(c.currentTime + (o.delay || 0)); return src;
  }
  pick(arr, key) { if (!arr || !arr.length) return null; let i = (Math.random() * arr.length) | 0; if (arr.length > 1 && this['_last' + key] === i) i = (i + 1) % arr.length; this['_last' + key] = i; return arr[i]; }

  // ---------------- footsteps / body ----------------
  // surface: asphalt|concrete|tile|grass|leaves|dirt|gravel|sand|wood|rubber|water ; shoe: sneaker|sandal|shoe|boot
  footstep(x, y, z, surface, o = {}) {
    if (!this.running) return; const run = !!o.run; const b = this.pick(this.stepBufs(surface, run), 'st' + surface);
    const rate = (o.rate || 1) * (0.94 + Math.random() * 0.12), gain = (o.gain ?? 1) * (0.82 + Math.random() * 0.3) * (o.wet ? 1.1 : 1);
    const cat = o.npc ? 'npc' : 'footsteps';
    if (o.local) this.play2D(b, { cat: 'footsteps', rate, gain: gain * 0.55 }); else this.play3D(b, x, y, z, { cat: 'footsteps', rate, gain, ref: 1.6, max: o.max || 26, occ: true, prio: o.prio });
    const hardSurf = !['grass', 'sand', 'water', 'leaves'].includes(surface);
    if (o.shoe && o.shoe !== 'sneaker' && (hardSurf || o.shoe === 'sandal')) { const sb = this.pick(this.buf.shoe[o.shoe], 'sh'); const sg = gain * (o.shoe === 'sandal' ? 0.7 : 0.6) * (hardSurf ? 1 : 0.5); if (o.local) this.play2D(sb, { cat: 'footsteps', gain: sg * 0.55, rate }); else this.play3D(sb, x, y, z, { cat: 'footsteps', gain: sg, ref: 1.6, max: 20, rate }); }
    if (o.wet && hardSurf) { const wb = this.pick(this.stepBufs('water', false), 'wet'); if (o.local) this.play2D(wb, { cat: 'footsteps', gain: 0.18 }); else this.play3D(wb, x, y, z, { cat: 'footsteps', gain: 0.3, ref: 1.6, max: 18 }); }
    void cat;
  }
  land(x, y, z, surface, impact, local) { const k = clamp(impact / 9, 0.2, 1.4); const b = this.pick(this.stepBufs(surface, true), 'land'); if (local) { this.play2D(b, { cat: 'footsteps', gain: 0.6 * k, rate: 0.85 }); this.play2D(b, { cat: 'footsteps', gain: 0.4 * k, rate: 0.78, delay: 0.035 }); } else this.play3D(b, x, y, z, { cat: 'footsteps', gain: 0.8 * k, rate: 0.85, ref: 2, max: 30 }); }
  clap(x, y, z, local) { const b = this.pick(this.buf.clap, 'cl'); if (local) this.play2D(b, { cat: 'effects', gain: 0.5, rate: 0.95 + Math.random() * 0.1 }); else this.play3D(b, x, y, z, { cat: 'npc', gain: 0.7, ref: 2.5, max: 35, rate: 0.95 + Math.random() * 0.1 }); }
  kick(x, y, z, power) { this.play3D(this.pick(this.buf.kick, 'k'), x, y, z, { cat: 'npc', gain: clamp(power / 14, 0.3, 1.1), ref: 4, max: 70, occ: true }); }
  sit(x, y, z, local) { const b = this.pick(this.buf.sit, 'sit'); if (local) this.play2D(b, { cat: 'effects', gain: 0.45 }); else this.play3D(b, x, y, z, { cat: 'npc', gain: 0.5, ref: 1.5, max: 15 }); }
  doorAt(x, y, z, kind, local) { const b = this.pick(this.buf.door[kind] || this.buf.door.car, 'door' + kind); if (local) this.play2D(b, { cat: 'vehicles', gain: 0.7 }); else this.play3D(b, x, y, z, { cat: 'vehicles', gain: 0.8, ref: 3, max: 40, occ: true }); }
  starter(x, y, z, moto, local) { const b = moto ? this.buf.starter.moto : this.buf.starter.car; if (local) this.play2D(b, { cat: 'vehicles', gain: 0.5 }); else this.play3D(b, x, y, z, { cat: 'vehicles', gain: 0.6, ref: 4, max: 50 }); }
  impact(x, y, z, k, local) { const b = this.pick(this.buf.impact, 'imp'); if (local) this.play2D(b, { cat: 'effects', gain: 0.35 + k * 0.55, rate: 1.1 - k * 0.25 }); else this.play3D(b, x, y, z, { cat: 'effects', gain: 0.5 + k * 0.6, ref: 6, max: 120, prio: 2 }); }
  // speech-like murmur from a person (non-verbal); kind: talk | laugh | shout
  voice(x, y, z, female, kind = 'talk', o = {}) {
    const V = this.buf.voice; const arr = kind === 'laugh' ? (female ? V.laughF : V.laughM) : kind === 'shout' ? (female ? V.shoutF : V.shoutM) : (female ? V.f : V.m);
    const b = this.pick(arr, 'v' + kind + female); if (!b) return null;
    return this.play3D(b, x, y, z, { cat: 'npc', gain: (o.gain ?? 0.55) * (kind === 'shout' ? 1.3 : 1), rate: o.rate || (0.93 + Math.random() * 0.14), ref: kind === 'shout' ? 5 : 2.2, max: kind === 'shout' ? 60 : 28, occ: true, prio: o.prio });
  }
  // positional horn: car (two-tone), moto (single thin), diesel (low), bike (bell)
  horn3D(x, y, z, kind = 'car', dur = 0.4, local = false) {
    if (!this.running) return; const c = this.ctx, t = c.currentTime;
    const out = c.createGain(); out.gain.value = 0;
    if (kind === 'bike') { for (const [f, a] of [[2380, 0.22], [3150, 0.12], [5100, 0.05]]) for (const k of [0, 0.16]) { const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t + k); g.gain.linearRampToValueAtTime(a, t + k + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + k + 0.45); o.connect(g); g.connect(out); o.start(t + k); o.stop(t + k + 0.5); } out.gain.value = 1; }
    else {
      const fr = kind === 'moto' ? [540] : kind === 'diesel' ? [350, 440] : [415, 520];
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = kind === 'moto' ? 1400 : 1000; bp.Q.value = 0.9; const sh = c.createWaveShaper(); sh.curve = this.curve;
      for (const f of fr) { const o = c.createOscillator(); o.type = 'square'; o.frequency.value = f * (0.99 + Math.random() * 0.02); o.connect(bp); o.start(t); o.stop(t + dur + 0.1); }
      bp.connect(sh); sh.connect(out); out.gain.setValueAtTime(0.0001, t); out.gain.linearRampToValueAtTime(kind === 'moto' ? 0.22 : 0.3, t + 0.015); out.gain.setValueAtTime(kind === 'moto' ? 0.22 : 0.3, t + dur); out.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
    }
    if (local) out.connect(this.bus.vehicles);
    else { const d = this.dist(x, z); if (d > 220) return; const f = c.createBiquadFilter(); f.type = 'lowpass'; const occ = this.occluder && d > 8 ? this.occluder(x, y, z) : 0; f.frequency.value = this.airCut(d, this.behind(x, z), occ); const p = this._panner(8, 1, true); this._pos(p, x, y, z); out.connect(f); f.connect(p); p.connect(this.bus.vehicles); setTimeout(() => { f.disconnect(); p.disconnect(); }, (dur + 1) * 1000); }
    this.stats.started++; setTimeout(() => { out.disconnect(); this.stats.ended++; }, (dur + 1) * 1000);
  }
  // bird calls (common Thai urban birds, stylised): koel two-note rise, bulbul bubbling, sparrow chirps, myna whistle
  bird3D(x, y, z, species) {
    if (!this.running || this.active.ambient >= this.limits.ambient) return; const c = this.ctx, t = c.currentTime + 0.01; const d = this.dist(x, z); if (d > 70) return;
    const out = c.createGain(); out.gain.value = 1; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = this.airCut(d, this.behind(x, z), 0); const p = this._panner(5, 1); this._pos(p, x, y, z); out.connect(f); f.connect(p); p.connect(this.bus.ambient);
    const note = (t0, f0, f1, dur, amp, type = 'sine') => { const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(amp, t0 + dur * 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + dur + 0.02); };
    let end = 0;
    if (species === 'koel') { const n = 3 + ((Math.random() * 3) | 0); const base = 700 + Math.random() * 120; for (let i = 0; i < n; i++) { const k = 1 + i * 0.06; note(t + i * 0.9, base * k, base * k * 1.05, 0.18, 0.12); note(t + i * 0.9 + 0.26, base * k * 1.25, base * k * 1.45, 0.34, 0.14); } end = n * 0.9; }
    else if (species === 'bulbul') { const b = 1500 + Math.random() * 400; [0, 0.11, 0.2, 0.34].forEach((dt, i) => note(t + dt, b * [1, 1.2, 0.9, 1.35][i], b * [1.15, 1.0, 1.1, 1.2][i], 0.1, 0.06)); end = 0.5; }
    else if (species === 'myna') { const b = 1100 + Math.random() * 600; note(t, b, b * 1.8, 0.16, 0.07, 'triangle'); note(t + 0.22, b * 1.6, b * 0.9, 0.2, 0.06, 'triangle'); note(t + 0.5, b * 2.2, b * 2.0, 0.08, 0.05); end = 0.65; }
    else if (species === 'dove') { const b = 420 + Math.random() * 40; note(t, b, b * 0.95, 0.22, 0.09); note(t + 0.3, b * 1.12, b * 1.0, 0.32, 0.1); note(t + 0.75, b * 0.92, b * 0.86, 0.28, 0.08); end = 1.1; } // spotted dove "ku-kroo-ku"
    else if (species === 'oriole') { const b = 900 + Math.random() * 150; note(t, b, b * 1.5, 0.14, 0.08); note(t + 0.16, b * 1.5, b * 1.2, 0.12, 0.07); note(t + 0.3, b * 1.25, b * 1.6, 0.2, 0.08); end = 0.55; } // black-naped oriole fluty whistle
    else if (species === 'tailor') { const b = 2400 + Math.random() * 300; const n = 4 + ((Math.random() * 4) | 0); for (let i = 0; i < n; i++) { note(t + i * 0.16, b, b * 1.35, 0.05, 0.05); note(t + i * 0.16 + 0.06, b * 1.35, b * 1.1, 0.05, 0.045); } end = n * 0.16; } // common tailorbird "chee-yup"
    else if (species === 'crow') { const b = 520 + Math.random() * 80; const n = 2 + ((Math.random() * 2) | 0); for (let i = 0; i < n; i++) note(t + i * 0.42, b * 1.1, b * 0.8, 0.26, 0.06, 'sawtooth'); end = n * 0.42; }
    else { const b = 3600 + Math.random() * 700; const n = 3 + ((Math.random() * 4) | 0); for (let i = 0; i < n; i++) note(t + i * 0.13, b * (1 + Math.random() * 0.1), b * 0.8, 0.05, 0.04); end = n * 0.13; }
    this.active.ambient++; this.stats.started++; setTimeout(() => { out.disconnect(); f.disconnect(); p.disconnect(); this.active.ambient--; this.stats.ended++; }, (end + 0.5) * 1000);
  }
  // looping positional emitter (cicada chorus, food-stall sizzle, AC units…)
  emitter(kind, x, y, z) {
    if (!this.running) return null; const c = this.ctx; const p = this._panner(kind === 'cicada' ? 7 : 3, 1); this._pos(p, x, y, z);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 12000; const g = c.createGain(); g.gain.value = 0; g.connect(f); f.connect(p); p.connect(this.bus.ambient);
    const nodes = [];
    if (kind === 'cicada') { // pulse-train amplitude modulation of band-passed noise (tymbal buckling ≈ 60–90 Hz)
      const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 4800 + Math.random() * 1600; bp.Q.value = 5;
      const am = c.createGain(); am.gain.value = 0.5; const lfo = c.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 60 + Math.random() * 30; const lg = c.createGain(); lg.gain.value = 0.5; lfo.connect(lg); lg.connect(am.gain);
      s.connect(bp); bp.connect(am); am.connect(g); s.start(0, Math.random() * 2); lfo.start(); nodes.push(s, bp, am, lfo, lg);
    } else if (kind === 'sizzle' && this.buf.sizzle) { const s = c.createBufferSource(); s.buffer = this.buf.sizzle; s.loop = true; s.connect(g); s.start(0, Math.random() * 2); nodes.push(s); }
    else if (kind === 'ac') { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 50 + Math.random() * 4; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220; const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.8; const ng = c.createGain(); ng.gain.value = 0.3; o.connect(lp); lp.connect(g); s.connect(bp); bp.connect(ng); ng.connect(g); o.start(); s.start(0, Math.random() * 2); nodes.push(o, lp, s, bp, ng); }
    else return null;
    this.stats.started++;
    return { x, y, z, g, f, p, nodes, kind, set: (gain, tau = 0.8) => g.gain.setTargetAtTime(gain, c.currentTime, tau), stop: () => { g.gain.setTargetAtTime(0, c.currentTime, 0.4); setTimeout(() => { for (const n of nodes) { try { n.stop && n.stop(); } catch (_) { } n.disconnect(); } g.disconnect(); f.disconnect(); p.disconnect(); this.stats.ended++; }, 2000); } };
  }

  // ---------------- vehicle engines (pooled voices) ----------------
  _engineVoice() {
    const c = this.ctx; const v = { src: null, fade: c.createGain(), nodes: [] };
    v.oA = c.createOscillator(); v.oA.type = 'sawtooth'; v.oB = c.createOscillator(); v.oB.type = 'square'; v.lfo = c.createOscillator(); v.lfo.type = 'sine';
    v.mix = c.createGain(); v.mix.gain.value = 0; const gA = c.createGain(); gA.gain.value = 0.5; const gB = c.createGain(); gB.gain.value = 0.22; v.oA.connect(gA); v.oB.connect(gB); gA.connect(v.mix); gB.connect(v.mix);
    // exhaust pulses: band-passed noise amplitude-modulated at the firing frequency
    v.nE = c.createBufferSource(); v.nE.buffer = this.noiseBuf; v.nE.loop = true; v.bpE = c.createBiquadFilter(); v.bpE.type = 'bandpass'; v.bpE.Q.value = 0.9; v.am = c.createGain(); v.am.gain.value = 0.5; v.lfoG = c.createGain(); v.lfoG.gain.value = 0.5; v.lfo.connect(v.lfoG); v.lfoG.connect(v.am.gain);
    v.exh = c.createGain(); v.exh.gain.value = 0; v.nE.connect(v.bpE); v.bpE.connect(v.am); v.am.connect(v.exh); v.exh.connect(v.mix);
    v.drive = c.createGain(); v.drive.gain.value = 1; v.sh = c.createWaveShaper(); v.sh.curve = this.curve; v.lp = c.createBiquadFilter(); v.lp.type = 'lowpass'; v.lp.Q.value = 0.8;
    v.eng = c.createGain(); v.eng.gain.value = 0; v.mix.connect(v.drive); v.drive.connect(v.sh); v.sh.connect(v.lp); v.lp.connect(v.eng);
    // tyres (rolling roar) and skid / brake squeal
    v.nT = c.createBufferSource(); v.nT.buffer = this.noiseBuf; v.nT.loop = true; v.lpT = c.createBiquadFilter(); v.lpT.type = 'lowpass'; v.tire = c.createGain(); v.tire.gain.value = 0; v.nT.connect(v.lpT); v.lpT.connect(v.tire);
    v.nS = c.createBufferSource(); v.nS.buffer = this.noiseBuf; v.nS.loop = true; v.bpS = c.createBiquadFilter(); v.bpS.type = 'bandpass'; v.bpS.Q.value = 6; v.skid = c.createGain(); v.skid.gain.value = 0; v.nS.connect(v.bpS); v.bpS.connect(v.skid);
    v.air = c.createBiquadFilter(); v.air.type = 'lowpass'; v.air.frequency.value = 8000; v.eng.connect(v.air); v.tire.connect(v.air); v.skid.connect(v.air);
    // bicycle drivetrain: freewheel pawl clicks while coasting, chain-on-cog whirr while pedalling (silent for motor vehicles)
    v.fw = c.createOscillator(); v.fw.type = 'square'; v.fwHP = c.createBiquadFilter(); v.fwHP.type = 'highpass'; v.fwHP.frequency.value = 3200; v.fwG = c.createGain(); v.fwG.gain.value = 0; v.fw.connect(v.fwHP); v.fwHP.connect(v.fwG); v.fwG.connect(v.air);
    v.chN = c.createBufferSource(); v.chN.buffer = this.noiseBuf; v.chN.loop = true; v.chBP = c.createBiquadFilter(); v.chBP.type = 'bandpass'; v.chBP.frequency.value = 2300; v.chBP.Q.value = 1.6;
    v.chAM = c.createGain(); v.chAM.gain.value = 0.5; v.chLFO = c.createOscillator(); v.chLFO.type = 'square'; v.chLG = c.createGain(); v.chLG.gain.value = 0.5; v.chLFO.connect(v.chLG); v.chLG.connect(v.chAM.gain);
    v.chG = c.createGain(); v.chG.gain.value = 0; v.chN.connect(v.chBP); v.chBP.connect(v.chAM); v.chAM.connect(v.chG); v.chG.connect(v.air);
    v.fade.gain.value = 0; v.air.connect(v.fade);
    v.pan = this._panner(6, 1, true); v.fade.connect(v.pan); v.pan.connect(this.bus.vehicles);
    v.loc = c.createGain(); v.loc.gain.value = 0; v.air.connect(v.loc); v.loc.connect(this.bus.vehicles); // 2-D path for the player's own vehicle
    const t = c.currentTime; v.fw.start(t); v.chLFO.start(t); v.chN.start(t, Math.random() * 2); v.oA.start(t); v.oB.start(t); v.lfo.start(t); v.nE.start(t, Math.random() * 2); v.nT.start(t, Math.random() * 2); v.nS.start(t, Math.random() * 2);
    v.occ = 0; v.occT = 0; return v;
  }
  // vehicles: [{ id, kind, x, y, z, vx, vz, speed, throttle, drift, brake, on, local, surface, air }]; call every frame
  syncVehicles(list, dt) {
    if (!this.running || !this.pool) return; const now = this.ctx.currentTime;
    // priority: own vehicle first, then perceived loudness ≈ 1/(distance) weighted by kind
    for (const s of list) { const d = this.dist(s.x, s.z); s._d = d; s._pri = s.local ? 1e9 : (s.kind === 'bike' ? 0.4 : 1) * (1 + Math.min(1, s.speed / 12)) / (1 + d); }
    list.sort((a, b) => b._pri - a._pri);
    const want = this._want || (this._want = []); want.length = 0; for (const s of list) { if (want.length >= this.pool.length) break; if (s.local || s._d < (s.kind === 'bike' ? 45 : s.kind === 'scooter' ? 110 : 140)) want.push(s); }
    // keep voices on vehicles that are still wanted; release the rest with a fade; assign free voices
    for (const v of this.pool) { if (v.src && !want.some(s => s.id === v.src.id)) { v.src = null; v.fade.gain.setTargetAtTime(0, now, 0.25); v.loc.gain.setTargetAtTime(0, now, 0.25); v.freeAt = now + 0.9; } }
    for (const s of want) {
      let v = this.pool.find(p => p.src && p.src.id === s.id);
      if (!v) { v = this.pool.find(p => !p.src && (!p.freeAt || now > p.freeAt)); if (!v) continue; v.src = s; v.occT = 0; v.started = now; }
      v.src = s; this._engineUpdate(v, s, dt, now);
    }
    // forget rpm states of vehicles not seen for a while
    if (Math.random() < 0.02) for (const [id, st] of this.vstate) if (now - st.seen > 6) this.vstate.delete(id);
  }
  _engineUpdate(v, s, dt, now) {
    const P0 = ENGINES[s.kind] || ENGINES.car; const P = s.mods && s.mods.exhaust ? { ...P0, exh: P0.exh * 1.4, level: P0.level * 1.22, crackle: P0.cyl >= 4 } : P0; let st = this.vstate.get(s.id); if (!st) { st = { rpm: P.idle || 0, gear: 0, seen: now, shift: 0 }; this.vstate.set(s.id, st); } st.seen = now;
    const sp = Math.abs(s.speed), thr = clamp(s.throttle || 0, 0, 1); let target = P.idle || 0;
    if (P.cyl) {
      if (P.cvt) target = thr > 0.05 ? Math.min(P.red * 0.85, 4300 + thr * 2600 + sp * 55) : (sp > 1 ? 2100 + sp * 95 : P.idle);
      else {
        const G = P.gears; const shiftUp = thr > 0.6 ? P.red * 0.88 : 2300 + thr * 2600;
        let w = sp / G[st.gear] * 1000; if (w > shiftUp && st.gear < G.length - 1) { st.gear++; st.shift = 0.18; w = sp / G[st.gear] * 1000; } else if (w < 1450 && st.gear > 0) { st.gear--; w = sp / G[st.gear] * 1000; }
        target = Math.max(P.idle + (sp < 0.6 ? thr * 1800 : 0), w); if (st.shift > 0) { st.shift -= dt; target *= 0.82; }
      }
    }
    // hybrids: pull away and cruise slowly on the electric motor (engine off), engine starts under load or above ~35 km/h
    const evMode = P.ev && sp < 9.5 && thr < 0.62 && !(st.engOn && sp > 7); st.engOn = P.ev ? !evMode : true;
    if (evMode) target = 0;
    st.rpm += (target - st.rpm) * (1 - Math.exp(-dt * (target > st.rpm ? 7 : 4)));
    // V8 overrun crackle when lifting off at high revs
    if (P.crackle && (st.lastThr || 0) > 0.55 && thr < 0.1 && st.rpm > P.red * 0.5 && now - (st.popAt || 0) > 0.6) { st.popAt = now; this.pops(s); }
    st.lastThr = thr;
    const rpmN = P.cyl ? clamp(st.rpm / P.red, 0, 1) : 0, load = clamp(thr * 0.85 + (s.accel > 0 ? s.accel * 0.05 : 0), 0, 1);
    const dop = s.local ? 1 : this.doppler(s.x, s.z, s.vx || 0, s.vz || 0); const t = now, k = 0.06;
    if (P.ev && evMode) { // electric motor whine + inverter hum, no exhaust
      const wf = (260 + sp * 95) * dop; v.oA.frequency.setTargetAtTime(wf, t, k); v.oB.frequency.setTargetAtTime(wf * 2.01, t, k); v.lfo.frequency.setTargetAtTime(30, t, k);
      v.exh.gain.setTargetAtTime(0, t, 0.15); v.mix.gain.setTargetAtTime(1, t, 0.1); v.drive.gain.setTargetAtTime(0.4, t, k); v.lp.frequency.setTargetAtTime(2600 + sp * 120, t, k);
      v.eng.gain.setTargetAtTime(s.on !== false ? 0.035 + Math.min(0.06, sp * 0.006) + thr * 0.03 : 0, t, 0.2);
    } else if (P.cyl) {
      const f = firing(P, st.rpm) * dop; v.oA.frequency.setTargetAtTime(f, t, k); v.oB.frequency.setTargetAtTime(f * (P.cyl === 1 ? 2 : 0.5), t, k); v.lfo.frequency.setTargetAtTime(f, t, k);
      v.bpE.frequency.setTargetAtTime((P.rattle ? 900 : 260) + st.rpm * 0.09, t, k); v.exh.gain.setTargetAtTime(P.exh * (0.5 + load * 0.6), t, k);
      v.mix.gain.setTargetAtTime(1, t, 0.1); v.drive.gain.setTargetAtTime(0.7 + load * 1.5, t, k);
      v.lp.frequency.setTargetAtTime(P.lp[0] + (P.lp[1] - P.lp[0]) * rpmN * (0.55 + load * 0.45), t, k);
      const on = s.on !== false; v.eng.gain.setTargetAtTime(on ? P.level * (0.42 + rpmN * 0.4 + load * 0.38) : 0, t, on ? 0.12 : 0.35);
    } else { v.eng.gain.setTargetAtTime(0, t, 0.1); }
    if (s.kind === 'bike') {
      // wheel circumference ≈ 2.1 m; 24-tooth freewheel ratchet; 42/16 drive ratio, 42 chainring links per crank turn
      const wheelHz = sp / 2.1, pedal = thr > 0.05 && sp > 0.3, coast = !pedal && sp > 0.7 && !s.brake;
      v.fw.frequency.setTargetAtTime(clamp(wheelHz * 24, 6, 170), t, 0.05); v.fwG.gain.setTargetAtTime(coast ? Math.min(1, sp / 4) * 0.045 : 0, t, 0.06);
      v.chLFO.frequency.setTargetAtTime(Math.max(1, sp / (2.1 * 2.62) * 42), t, 0.05); v.chG.gain.setTargetAtTime(pedal ? 0.035 + 0.05 * Math.min(1, sp / 6) : 0, t, 0.08);
    } else { v.fwG.gain.setTargetAtTime(0, t, 0.05); v.chG.gain.setTargetAtTime(0, t, 0.05); }
    const surfK = s.surface === 'dirt' || s.surface === 'gravel' ? 1.6 : s.surface === 'grass' ? 0.8 : 1;
    const bike = s.kind === 'bike';
    v.lpT.frequency.setTargetAtTime((s.surface === 'gravel' || s.surface === 'dirt' ? 900 : bike ? 520 : 260) + sp * (bike ? 90 : 34), t, 0.1);
    v.tire.gain.setTargetAtTime((bike ? Math.min(1, sp / 9) * 0.16 : Math.min(1, sp / 24) * (s.kind === 'scooter' ? 0.09 : 0.2)) * surfK * (s.air ? 0 : 1), t, 0.1);
    // skid (lateral slip) / brake squeal; bicycles: rim-brake squeal only while braking and moving
    const skid = s.air ? 0 : bike ? (s.brake && sp > 1 ? clamp(sp / 8, 0, 1) * 0.12 : 0) : clamp((s.drift - 2.2) / 6, 0, 1) * 0.32 + (s.brake && sp > 3 ? clamp((sp - 3) / 15, 0, 1) * 0.1 : 0);
    v.bpS.frequency.setTargetAtTime(bike ? 3100 + sp * 30 : 1300 + sp * 22, t, 0.1); v.skid.gain.setTargetAtTime(skid, t, 0.08);
    if (s.local) { v.loc.gain.setTargetAtTime(1, t, 0.15); v.fade.gain.setTargetAtTime(0, t, 0.15); v.air.frequency.setTargetAtTime(16000, t, 0.2); }
    else {
      this._pos(v.pan, s.x, s.y + 0.6, s.z); v.pan.refDistance = P.ref;
      v.occT -= dt; if (v.occT <= 0) { v.occT = 0.3; v.occTarget = this.occluder && s._d > 8 ? this.occluder(s.x, s.y + 1, s.z) : 0; }
      v.occ += ((v.occTarget || 0) - v.occ) * (1 - Math.exp(-dt * 6));
      v.air.frequency.setTargetAtTime(this.airCut(s._d, this.behind(s.x, s.z), v.occ), t, 0.08);
      v.fade.gain.setTargetAtTime(1 - v.occ * 0.45, t, 0.25); v.loc.gain.setTargetAtTime(0, t, 0.15);
    }
  }
  activeEngines() { return this.pool ? this.pool.filter(v => v.src).map(v => v.src.id) : []; }
  setBeds(b) { if (!this.beds) return; const t = this.ctx.currentTime; for (const [k, v] of Object.entries(b)) { const bed = this.beds[k]; if (bed) bed.g.gain.setTargetAtTime(v, t, 1.2); } }

  // ---------------- UI & legacy one-liners (2-D) ----------------
  tone(freq, dur = 0.15, type = 'sine', vol = 0.2, when = 0, slide = 0) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime + when; const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + dur + 0.05); o.onended = () => { o.disconnect(); g.disconnect(); };
  }
  noise(dur = 0.08, freq = 1200, vol = 0.2, type = 'bandpass', when = 0) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime + when; const s = c.createBufferSource(); s.buffer = this.noiseBuf; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; const g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(this.sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05); s.onended = () => { s.disconnect(); f.disconnect(); g.disconnect(); };
  }
  click() { this.tone(900, 0.05, 'triangle', 0.08); }
  open() { this.tone(520, 0.08, 'sine', 0.1); this.tone(780, 0.1, 'sine', 0.08, 0.05); }
  close() { this.tone(600, 0.07, 'sine', 0.08); this.tone(420, 0.09, 'sine', 0.06, 0.04); }
  cash() { this.noise(0.05, 4000, 0.15, 'highpass'); this.tone(1320, 0.12, 'square', 0.06, 0.03); this.tone(1760, 0.25, 'square', 0.05, 0.09); }
  error() { this.tone(220, 0.18, 'square', 0.08); this.tone(180, 0.2, 'square', 0.08, 0.1); }
  levelUp() { [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.12, i * 0.09)); }
  quest() { [660, 880, 990].forEach((f, i) => this.tone(f, 0.22, 'sine', 0.12, i * 0.1)); }
  notify() { this.tone(1046, 0.08, 'sine', 0.1); this.tone(1568, 0.14, 'sine', 0.08, 0.08); }
  // animals: soi-dog bark, cat meow, cat hiss (synthesised, positioned)
  animal3D(x, y, z, kind) {
    if (!this.running || this.active.ambient >= this.limits.ambient) return; const c = this.ctx, t0 = c.currentTime + 0.01; const d = this.dist(x, z); if (d > 60) return;
    const out = c.createGain(); const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = this.airCut(d, this.behind(x, z), 0); const p = this._panner(4, 1.2); this._pos(p, x, y, z); out.connect(f); f.connect(p); p.connect(this.bus.ambient);
    let end = 0.6;
    if (kind === 'bark') {
      const n = 1 + ((Math.random() * 3) | 0); const base = 380 + Math.random() * 180;
      for (let i = 0; i < n; i++) { const t = t0 + i * 0.32; const o = c.createOscillator(), g = c.createGain(), bp = c.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.setValueAtTime(base * 1.25, t); o.frequency.exponentialRampToValueAtTime(base * 0.7, t + 0.13); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 1.6; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.32, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); o.connect(bp); bp.connect(g); g.connect(out); o.start(t); o.stop(t + 0.2); }
      end = n * 0.32 + 0.3;
    } else if (kind === 'meow') {
      const o = c.createOscillator(), g = c.createGain(), bp = c.createBiquadFilter(), v = c.createOscillator(), vg = c.createGain(); o.type = 'triangle'; const b = 520 + Math.random() * 160;
      o.frequency.setValueAtTime(b, t0); o.frequency.linearRampToValueAtTime(b * 1.7, t0 + 0.25); o.frequency.linearRampToValueAtTime(b * 1.1, t0 + 0.6); v.frequency.value = 7; vg.gain.value = 18; v.connect(vg); vg.connect(o.frequency);
      bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 1.2; g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.18, t0 + 0.06); g.gain.setValueAtTime(0.18, t0 + 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.7);
      o.connect(bp); bp.connect(g); g.connect(out); o.start(t0); v.start(t0); o.stop(t0 + 0.75); v.stop(t0 + 0.75); end = 0.9;
    } else { const s = c.createBufferSource(); s.buffer = this.noiseBuf; const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500; const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.12, t0 + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5); s.connect(hp); hp.connect(g); g.connect(out); s.start(t0, Math.random()); s.stop(t0 + 0.55); end = 0.7; }
    this.active.ambient++; setTimeout(() => { out.disconnect(); f.disconnect(); p.disconnect(); this.active.ambient--; }, (end + 0.3) * 1000);
  }
  // distant airliner: broadband roar that follows the plane (very large reference distance)
  jet3D() {
    if (!this.running) return null; const c = this.ctx; const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650; const lp2 = c.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 900;
    const g = c.createGain(); g.gain.value = 0; const p = this._panner(260, 0.9); p.maxDistance = 6000; s.connect(lp); lp.connect(lp2); lp2.connect(g); g.connect(p); p.connect(this.bus.ambient); s.start(); g.gain.setTargetAtTime(0.5, c.currentTime, 3);
    return { update: (x, y, z) => this._pos(p, x, y, z), stop: () => { g.gain.setTargetAtTime(0, c.currentTime, 1.5); setTimeout(() => { try { s.stop(); } catch (e) { } s.disconnect(); lp.disconnect(); lp2.disconnect(); g.disconnect(); p.disconnect(); }, 5000); } };
  }
  // exhaust pops (overrun crackle) at a vehicle's position
  pops(s) {
    if (!this.running) return; const c = this.ctx; const n = 3 + ((Math.random() * 4) | 0);
    for (let i = 0; i < n; i++) {
      const t = c.currentTime + i * (0.05 + Math.random() * 0.09); const src = c.createBufferSource(); src.buffer = this.noiseBuf; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 280 + Math.random() * 500; f.Q.value = 1.4; const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5 + Math.random() * 0.4, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      src.connect(f); f.connect(g);
      if (s.local) g.connect(this.bus.vehicles); else { const p = this._panner(7, 1); this._pos(p, s.x, (s.y || 0) + 0.4, s.z); g.connect(p); p.connect(this.bus.vehicles); setTimeout(() => p.disconnect(), 900); }
      src.start(t, Math.random()); src.stop(t + 0.1); src.onended = () => { src.disconnect(); f.disconnect(); g.disconnect(); };
    }
  }
  // phone sounds: each app has its own short signature so you can tell them apart without looking
  ping(kind) {
    if (!this.ctx) return; const T = (f, d, ty, v, w) => this.tone(f, d, ty, v, w);
    if (kind === 'msg') { T(1318, 0.07, 'sine', 0.09); T(1760, 0.12, 'sine', 0.08, 0.07); }               // chat message
    else if (kind === 'social') { T(988, 0.06, 'triangle', 0.08); T(1480, 0.1, 'triangle', 0.07, 0.06); T(1976, 0.08, 'sine', 0.04, 0.12); } // feed / like
    else if (kind === 'order') { T(784, 0.1, 'square', 0.05); T(1046, 0.1, 'square', 0.05, 0.12); T(1318, 0.18, 'square', 0.05, 0.24); } // new job / order
    else if (kind === 'money') this.cash();
    else if (kind === 'friend') { [659, 880, 1108].forEach((f, i) => T(f, 0.12, 'sine', 0.07, i * 0.08)); }
    else if (kind === 'ring') { for (let r = 0; r < 2; r++) for (let i = 0; i < 8; i++) { T(i % 2 ? 1175 : 1397, 0.05, 'sine', 0.07, r * 0.5 + i * 0.05); } }
    else if (kind === 'pick') { T(880, 0.06, 'sine', 0.07); T(1320, 0.08, 'sine', 0.06, 0.05); }
    else if (kind === 'hang') { T(620, 0.1, 'sine', 0.07); T(440, 0.16, 'sine', 0.06, 0.09); }
    else if (kind === 'blip') T(1700, 0.03, 'sine', 0.03);
    else this.notify();
  }
  step(surface) { this.footstep(0, 0, 0, surface === 'hard' ? 'concrete' : surface, { local: true }); } // legacy
  splash() { const b = this.pick(this.stepBufs('water', true), 'spl'); this.play2D(b, { cat: 'effects', gain: 0.6, rate: 0.8 }); }
  horn(type) { this.horn3D(0, 0, 0, type === 'bicycle' ? 'bike' : ['wave', 'click', 'sport', 'pcx', 'vespa', 'forza'].includes(type) ? 'moto' : type === 'pickup' ? 'diesel' : 'car', 0.45, true); }
  crash(k) { this.impact(0, 0, 0, k, true); }
  thunder() { this.noise(2.2, 120, 0.5, 'lowpass'); this.noise(1.2, 300, 0.25, 'lowpass', 0.15); }
  door() { this.play2D(this.pick(this.buf.door && this.buf.door.car, 'd'), { cat: 'vehicles', gain: 0.6 }); }
  engine() { } stopEngine() { } // superseded by syncVehicles (kept for API compatibility)
  ambience() { }
  // ---------------- background music ----------------
  // Two generative styles, scheduled ahead on the audio clock (no timer drift):
  //  'groove' (default) — "KU Groove": 112 BPM Thai-pop / city-pop energy. Song form intro → verse → chorus → break →
  //            chorus: four-on-the-floor kick in the chorus, claps on 2 & 4, off-beat open hats, syncopated octave bass,
  //            saw chord stabs, a hook melody that repeats with variation, 16th arpeggio pluck, risers and tom fills.
  //  'chill'  — the original 84 BPM campus-afternoon groove (phone radio station 2).
  radio(on) { this.bgm(on); }
  setStyle(st) { if (st !== 'groove' && st !== 'chill') return; if (this.mstyle === st) return; this.mstyle = st; this.mstep = 0; if (this.ctx) this.mnext = this.ctx.currentTime + 0.15; this.makeMotif(); }
  bgm(on) {
    this.radioOn = on; this.bgmOn = on; if (!this.ctx) return;
    const c = this.ctx; if (!this.mstyle) this.mstyle = 'groove';
    if (!this.mbus) {
      this.mbus = c.createGain(); this.mbus.gain.value = 0;
      const warm = c.createBiquadFilter(); warm.type = 'lowpass'; warm.frequency.value = 9000;
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3.5; comp.attack.value = 0.006; comp.release.value = 0.2;
      const makeup = c.createGain(); makeup.gain.value = 1.0; // balanced with sound effects (owner request: medium)
      this.mbus.connect(warm); warm.connect(comp); comp.connect(makeup); makeup.connect(this.musicG);
      // reverb send (synthetic room impulse)
      const len = c.sampleRate * 2.0, ir = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / len, 3.4); }
      this.verb = c.createConvolver(); this.verb.buffer = ir; this.verbSend = c.createGain(); this.verbSend.gain.value = 0.22; this.verbSend.connect(this.verb); this.verb.connect(comp);
      // tempo-synced stereo delay for leads (dotted 8th)
      this.dly = c.createDelay(1.0); this.dly.delayTime.value = (60 / 112) * 0.75; this.dlyFb = c.createGain(); this.dlyFb.gain.value = 0.28; this.dlySend = c.createGain(); this.dlySend.gain.value = 0.18;
      const dlp = c.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 3200; this.dlySend.connect(this.dly); this.dly.connect(dlp); dlp.connect(this.dlyFb); this.dlyFb.connect(this.dly); dlp.connect(comp);
      this.mstep = 0; this.mnext = c.currentTime + 0.2; this.makeMotif();
    }
    const t = c.currentTime; this.mbus.gain.cancelScheduledValues(t); this.mbus.gain.setTargetAtTime(on ? 1 : 0, t, on ? 0.6 : 0.4);
    if (on && !this.mtimer) { this.mnext = Math.max(this.mnext, c.currentTime + 0.1); this.mtimer = setInterval(() => this.schedule(), 40); }
    if (!on && this.mtimer) { setTimeout(() => { if (!this.bgmOn && this.mtimer) { clearInterval(this.mtimer); this.mtimer = null; } }, 1500); }
  }
  makeMotif() {
    const r = Math.random; this.motif = [];
    if (this.mstyle === 'chill') { for (let s = 0; s < 32; s++) this.motif.push(s % 2 === 0 && r() < (s % 8 === 0 ? 0.9 : 0.5) ? [0, 1, 2, 3, 4, 5, 6][(r() * 7) | 0] : -1); return; }
    // hook: 1-bar call + 1-bar answer over A-minor pentatonic; rhythm favours syncopation (positions 0,3,6,8,10,11,14)
    const RH = [0, 3, 6, 8, 10, 11, 14]; let deg = 2;
    for (let half = 0; half < 2; half++) for (let s = 0; s < 16; s++) {
      if (RH.includes(s) && r() < (s === 0 ? 1 : 0.72)) { deg = Math.max(0, Math.min(7, deg + [-2, -1, -1, 1, 1, 2, 0][(r() * 7) | 0])); if (half === 1 && s >= 14) deg = 0; this.motif.push(deg); } else this.motif.push(-1);
    }
    this.motifLen = 1 + (r() < 0.5 ? 1 : 0); // some notes held
  }
  schedule() {
    const c = this.ctx; if (!c) return;
    if (this.mstyle === 'chill') return this.scheduleChill();
    const BPM = 112, spb = 60 / BPM, s16 = spb / 4;
    // song form, in bars (one cycle = 48 bars ≈ 1 min 43 s): intro 4 · verse 8 · pre 4 · chorus 8 · break 4 · verse 8 · chorus 8 · outro 4
    const FORM = [['intro', 4], ['verse', 8], ['pre', 4], ['chorus', 8], ['break', 4], ['verse', 8], ['chorus', 8], ['outro', 4]];
    const CYCLE = FORM.reduce((a, f) => a + f[1], 0);
    // progressions (root, chord tones) — verse Am F C G · chorus F G Em Am · pre Dm Em F G
    const V = [[45, [57, 60, 64, 67]], [41, [57, 60, 65, 69]], [48, [55, 60, 64, 67]], [43, [55, 59, 62, 67]]];
    const C = [[41, [57, 60, 65, 69]], [43, [59, 62, 67, 71]], [40, [55, 59, 64, 67]], [45, [57, 60, 64, 69]]];
    const P = [[38, [57, 62, 65, 69]], [40, [55, 59, 64, 67]], [41, [57, 60, 65, 69]], [43, [59, 62, 67, 71]]];
    const PENT = [57, 60, 62, 64, 67, 69, 72, 74];
    const mtof = (n) => 440 * Math.pow(2, (n - 69) / 12);
    while (this.mnext < c.currentTime + 0.25) {
      const st = this.mstep, barAll = Math.floor(st / 16), pos = st % 16; let bar = barAll % CYCLE, sec = 'intro', inSec = 0, secLen = 4;
      for (const [n, len] of FORM) { if (bar < len) { sec = n; inSec = bar; secLen = len; break; } bar -= len; }
      const prog = sec === 'chorus' ? C : sec === 'pre' ? P : V; const chord = prog[inSec % 4];
      const swing = (pos % 2 === 1) ? s16 * 0.08 : 0; const t = this.mnext + swing;
      const full = sec === 'chorus', lastBar = inSec === secLen - 1;
      // drums
      if (sec !== 'intro' && sec !== 'break') {
        if (full ? pos % 4 === 0 : (pos === 0 || pos === 8 || (pos === 11 && Math.random() < 0.4))) this.kick(t, full ? 0.42 : 0.36);
        if ((pos === 4 || pos === 12) && !(lastBar && pos === 12 && sec !== 'outro')) this.mclap(t, full ? 0.11 : 0.08);
        if (pos % 4 === 2) this.hat(t, full ? 0.05 : 0.035, true); else if (pos % 2 === 0 || full) this.hat(t, pos % 2 ? 0.014 : 0.022);
        if (lastBar && pos >= 12 && sec !== 'outro') this.tom(t, 0.12, [196, 165, 147, 123][pos - 12]); // fill into the next section
      } else if (sec === 'intro' && pos % 4 === 2) this.hat(t, 0.025, true);
      if (sec === 'break' && pos === 0 && inSec === 0) this.kick(t, 0.4);
      // risers before the chorus and after the break
      if ((sec === 'pre' || sec === 'break') && lastBar && pos === 0) this.riser(t, spb * 4);
      // bass: syncopated octave pattern (root, octave), drops out in intro/break
      if (sec !== 'intro' && sec !== 'break') {
        const BP = full ? [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0] : [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0];
        if (BP[pos]) this.bass2(mtof(chord[0] + (pos % 4 === 3 || pos === 14 ? 12 : 0)), t, full ? 0.15 : 0.12, s16 * (pos === 0 ? 2.6 : 1.6));
      }
      // chords: stabs on the off-beats in the chorus, sustained pad in intro / verse / break
      if (full && (pos === 2 || pos === 6 || pos === 10 || pos === 13)) for (const n of chord[1]) this.stab(mtof(n), t, 0.03, s16 * 1.5);
      if (!full && pos === 0) for (const n of chord[1]) this.pad(mtof(n), t, sec === 'intro' ? 0.018 : 0.022, spb * 4);
      if (sec === 'pre' && (pos === 0 || pos === 8)) for (const n of chord[1]) this.ep(mtof(n), t, 0.03, 1.0);
      // hook melody in the chorus (and quietly in the outro); arpeggio pluck in verse 2 and pre
      const mi = this.motif[(inSec % 2) * 16 + pos];
      if ((full || sec === 'outro') && mi >= 0) this.lead(mtof(PENT[mi] + 12), t, sec === 'outro' ? 0.03 : 0.05, s16 * (this.motifLen + 1));
      if ((sec === 'pre' || (sec === 'verse' && barAll % CYCLE > 20)) && pos % 2 === 0) this.pluck(mtof(chord[1][(pos / 2) % 4] + 12), t, 0.028);
      this.mstep++; this.mnext += s16;
      if (this.mstep % (16 * CYCLE) === 0) this.makeMotif();
    }
  }
  scheduleChill() {
    const c = this.ctx;
    const spb = 60 / 84, s16 = spb / 4;
    const PROG = [[48, [52, 55, 59, 62]], [45, [52, 55, 59, 60]], [41, [52, 57, 60, 64]], [43, [50, 55, 59, 64]], [38, [53, 57, 60, 64]], [43, [53, 57, 59, 64]], [40, [50, 55, 59, 62]], [45, [52, 55, 60, 64]]];
    const PENT = [60, 62, 64, 67, 69, 72, 74];
    const mtof = (n) => 440 * Math.pow(2, (n - 69) / 12);
    while (this.mnext < c.currentTime + 0.25) {
      const st = this.mstep, bar = Math.floor(st / 16), pos = st % 16, sec = Math.floor(bar / 8) % 2, chord = PROG[sec * 4 + (bar % 4)];
      const swing = (pos % 2 === 1) ? s16 * 0.18 : 0; const t = this.mnext + swing;
      if (pos === 0 || pos === 6 || (pos === 12 && Math.random() < 0.6)) for (const n of chord[1]) this.ep(mtof(n), t + Math.random() * 0.012, pos === 0 ? 0.05 : 0.035, pos === 0 ? 2.2 : 1.1);
      if (pos === 0) this.bass(mtof(chord[0]), t, 0.13, spb * 1.6);
      if (pos === 10 && Math.random() < 0.7) this.bass(mtof(chord[0] + (Math.random() < 0.5 ? 7 : 12)), t, 0.09, spb * 0.8);
      if (pos === 0 || (pos === 10 && Math.random() < 0.5)) this.kick(t, 0.32);
      if (pos === 4 || pos === 12) this.brush(t, 0.07);
      if (pos % 2 === 0) this.hat(t, pos % 4 === 0 ? 0.03 : 0.018);
      const mi = this.motif[(bar % 2) * 16 + pos]; if (mi >= 0 && bar % 8 !== 7) this.mallet(mtof(PENT[mi] + (sec ? 2 : 0)), t, 0.06);
      this.mstep++; this.mnext += s16;
      if (this.mstep % (16 * 8) === 0) this.makeMotif();
    }
  }
  // --- groove instruments ---
  bass2(f, t, v, d) { const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain(); o.type = 'sawtooth'; o2.type = 'sine'; o.frequency.value = f; o2.frequency.value = f / 2; lp.type = 'lowpass'; lp.Q.value = 4; lp.frequency.setValueAtTime(1400, t); lp.frequency.exponentialRampToValueAtTime(220, t + d); o.connect(lp); o2.connect(g); lp.connect(g); g.connect(this.mbus); this._env(g, t, v, 0.006, d); o.start(t); o2.start(t); o.stop(t + d + 0.1); o2.stop(t + d + 0.1); }
  stab(f, t, v, d) { const c = this.ctx, a = c.createOscillator(), b = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain(); a.type = b.type = 'sawtooth'; a.frequency.value = f; b.frequency.value = f; a.detune.value = -9; b.detune.value = 9; lp.type = 'lowpass'; lp.Q.value = 2; lp.frequency.setValueAtTime(5200, t); lp.frequency.exponentialRampToValueAtTime(700, t + d); a.connect(lp); b.connect(lp); lp.connect(g); g.connect(this.mbus); g.connect(this.verbSend); this._env(g, t, v, 0.004, d); a.start(t); b.start(t); a.stop(t + d + 0.1); b.stop(t + d + 0.1); }
  pad(f, t, v, d) { const c = this.ctx, a = c.createOscillator(), b = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain(); a.type = 'sawtooth'; b.type = 'triangle'; a.frequency.value = f; b.frequency.value = f * 2; a.detune.value = 7; lp.type = 'lowpass'; lp.frequency.value = 1500; a.connect(lp); b.connect(lp); lp.connect(g); g.connect(this.mbus); g.connect(this.verbSend); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + d * 0.3); g.gain.linearRampToValueAtTime(v * 0.7, t + d * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + d * 1.05); a.start(t); b.start(t); a.stop(t + d * 1.1); b.stop(t + d * 1.1); }
  lead(f, t, v, d) { const c = this.ctx, a = c.createOscillator(), b = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain(), vib = c.createOscillator(), vg = c.createGain(); a.type = 'square'; b.type = 'sawtooth'; a.frequency.value = f; b.frequency.value = f; b.detune.value = 6; vib.frequency.value = 5.5; vg.gain.value = f * 0.006; vib.connect(vg); vg.connect(a.frequency); vg.connect(b.frequency); lp.type = 'lowpass'; lp.frequency.value = 3400; a.connect(lp); b.connect(lp); lp.connect(g); g.connect(this.mbus); g.connect(this.dlySend); g.connect(this.verbSend); this._env(g, t, v, 0.01, d + 0.12); a.start(t); b.start(t); vib.start(t); a.stop(t + d + 0.3); b.stop(t + d + 0.3); vib.stop(t + d + 0.3); }
  pluck(f, t, v) { const c = this.ctx, o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.setValueAtTime(4200, t); lp.frequency.exponentialRampToValueAtTime(400, t + 0.18); o.connect(lp); lp.connect(g); g.connect(this.mbus); g.connect(this.dlySend); this._env(g, t, v, 0.003, 0.2); o.start(t); o.stop(t + 0.3); }
  mclap(t, v) { for (let i = 0; i < 3; i++) this._noise(t + i * 0.009, v * (i === 2 ? 1 : 0.6), 1500, 'bandpass', i === 2 ? 0.12 : 0.02, 1.2).connect(this.verbSend); }
  tom(t, v, f) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.18); o.connect(g); g.connect(this.mbus); g.connect(this.verbSend); this._env(g, t, v, 0.003, 0.2); o.start(t); o.stop(t + 0.3); }
  riser(t, d) { const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noiseBuf; s.loop = true; f.type = 'bandpass'; f.Q.value = 3; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(7000, t + d); s.connect(f); f.connect(g); g.connect(this.mbus); g.connect(this.verbSend); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + d * 0.95); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.05); s.start(t); s.stop(t + d + 0.1); }
  _env(g, t, peak, a, d) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  ep(f, t, v, d) { // 2-operator FM electric piano
    const c = this.ctx, car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
    car.frequency.value = f; mod.frequency.value = f; mg.gain.setValueAtTime(f * 1.4, t); mg.gain.exponentialRampToValueAtTime(f * 0.08, t + 0.6);
    mod.connect(mg); mg.connect(car.frequency); car.connect(g); g.connect(this.mbus); g.connect(this.verbSend);
    this._env(g, t, v, 0.006, d); car.start(t); mod.start(t); car.stop(t + d + 0.1); mod.stop(t + d + 0.1);
  }
  bass(f, t, v, d) { const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain(); o.type = 'sine'; o2.type = 'triangle'; o.frequency.value = f; o2.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = 420; o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(this.mbus); this._env(g, t, v, 0.02, d); o.start(t); o2.start(t); o.stop(t + d + 0.1); o2.stop(t + d + 0.1); }
  mallet(f, t, v) { const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), g2 = c.createGain(); o.type = 'sine'; o2.type = 'sine'; o.frequency.value = f; o2.frequency.value = f * 4.0; o.connect(g); o2.connect(g2); g2.connect(g); g.connect(this.mbus); g.connect(this.verbSend); this._env(g, t, v, 0.004, 0.55); g2.gain.setValueAtTime(0.25, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.08); o.start(t); o2.start(t); o.stop(t + 0.7); o2.stop(t + 0.2); }
  kick(t, v) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); o.connect(g); g.connect(this.mbus); this._env(g, t, v, 0.004, 0.22); o.start(t); o.stop(t + 0.3); }
  _noise(t, v, f, type, d, q = 0.8) { const c = this.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noiseBuf; fl.type = type; fl.frequency.value = f; fl.Q.value = q; s.connect(fl); fl.connect(g); g.connect(this.mbus); this._env(g, t, v, 0.003, d); s.start(t, Math.random()); s.stop(t + d + 0.05); return g; }
  hat(t, v, open) { this._noise(t, v, open ? 7000 : 8000, 'highpass', open ? 0.16 : 0.045); }
  brush(t, v) { const g = this._noise(t, v, 2200, 'bandpass', 0.16, 0.6); g.connect(this.verbSend); }
}
