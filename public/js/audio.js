// Procedural audio (no files): UI, footsteps, engines, horn, ambience, rain, thunder, simple lo-fi radio.
export class Audio {
  constructor() { this.ctx = null; this.vol = 0.7; this.music = 0.35; this.enabled = true; this.engines = new Map(); this.radioOn = false; }
  init() {
    if (this.ctx) return; try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.enabled = false; return; }
    const c = this.ctx; this.master = c.createGain(); this.master.gain.value = this.vol; this.master.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.connect(this.master); this.amb = c.createGain(); this.amb.gain.value = 0.5; this.amb.connect(this.master);
    this.musicG = c.createGain(); this.musicG.gain.value = this.music; this.musicG.connect(this.master);
    const len = c.sampleRate * 2; this.noiseBuf = c.createBuffer(1, len, c.sampleRate); const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // ambience loops: wind + waves + rain
    this.wind = this.loopNoise(400, 0.0); this.waves = this.loopNoise(600, 0.0, 'lowpass'); this.rainN = this.loopNoise(3000, 0.0, 'highpass'); this.city = this.loopNoise(180, 0.0, 'lowpass');
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = v; }
  setMusic(v) { this.music = v; if (this.musicG) this.musicG.gain.value = v; }
  loopNoise(freq, gain, type = 'bandpass') { const c = this.ctx; const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; const g = c.createGain(); g.gain.value = gain; s.connect(f); f.connect(g); g.connect(this.amb); s.start(); return { g, f }; }
  tone(freq, dur = 0.15, type = 'sine', vol = 0.2, when = 0, slide = 0) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime + when; const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur = 0.08, freq = 1200, vol = 0.2, type = 'bandpass', when = 0) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime + when; const s = c.createBufferSource(); s.buffer = this.noiseBuf; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; const g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(this.sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  click() { this.tone(900, 0.05, 'triangle', 0.08); }
  open() { this.tone(520, 0.08, 'sine', 0.1); this.tone(780, 0.1, 'sine', 0.08, 0.05); }
  close() { this.tone(600, 0.07, 'sine', 0.08); this.tone(420, 0.09, 'sine', 0.06, 0.04); }
  cash() { this.noise(0.05, 4000, 0.15, 'highpass'); this.tone(1320, 0.12, 'square', 0.06, 0.03); this.tone(1760, 0.25, 'square', 0.05, 0.09); }
  error() { this.tone(220, 0.18, 'square', 0.08); this.tone(180, 0.2, 'square', 0.08, 0.1); }
  levelUp() { [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.12, i * 0.09)); }
  quest() { [660, 880, 990].forEach((f, i) => this.tone(f, 0.22, 'sine', 0.12, i * 0.1)); }
  notify() { this.tone(1046, 0.08, 'sine', 0.1); this.tone(1568, 0.14, 'sine', 0.08, 0.08); }
  step(surface) { const f = surface === 'grass' ? 500 : surface === 'wood' ? 700 : surface === 'sand' ? 350 : 1400; this.noise(0.05, f + Math.random() * 300, surface === 'grass' || surface === 'sand' ? 0.05 : 0.07); }
  splash() { this.noise(0.3, 800, 0.12, 'lowpass'); }
  horn(type) { const car = !['bicycle', 'wave', 'click', 'sport'].includes(type); if (type === 'bicycle') { this.tone(1800, 0.08, 'sine', 0.1); this.tone(1800, 0.08, 'sine', 0.1, 0.12); return; } this.tone(car ? 392 : 523, 0.45, 'square', 0.09); this.tone(car ? 494 : 659, 0.45, 'square', 0.07); }
  crash(k) { this.noise(0.4, 300, 0.3 * k + 0.1, 'lowpass'); this.noise(0.2, 2500, 0.15 * k, 'highpass', 0.02); }
  thunder() { this.noise(2.2, 120, 0.5, 'lowpass'); this.noise(1.2, 300, 0.25, 'lowpass', 0.15); }
  door() { this.noise(0.08, 300, 0.2, 'lowpass'); }
  engineFor(id, type) {
    if (!this.ctx || type === 'bicycle') return null; let e = this.engines.get(id); if (e) return e;
    const c = this.ctx; const o = c.createOscillator(); o.type = 'sawtooth'; const o2 = c.createOscillator(); o2.type = 'square';
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; const g = c.createGain(); g.gain.value = 0;
    o.connect(f); o2.connect(f); f.connect(g); g.connect(this.sfx); o.start(); o2.start();
    e = { o, o2, f, g, type }; this.engines.set(id, e); return e;
  }
  engine(id, type, speed, top, throttle, on = true, dist = 0) {
    const e = this.engineFor(id, type); if (!e) return; const t = this.ctx.currentTime;
    const moto = ['wave', 'click', 'sport'].includes(type); const r = Math.min(1, Math.abs(speed) / top);
    const gear = moto ? r : (r * 4) % 1 * 0.6 + r * 0.4;
    const base = moto ? (type === 'sport' ? 70 : 45) : (type === 'super' ? 55 : 32);
    const fr = base + gear * base * 3 + throttle * 12;
    e.o.frequency.setTargetAtTime(fr, t, 0.05); e.o2.frequency.setTargetAtTime(fr * (moto ? 2 : 0.5), t, 0.05); e.f.frequency.setTargetAtTime(400 + r * 1600 + throttle * 400, t, 0.08);
    const att = Math.max(0, 1 - dist / 40);
    e.g.gain.setTargetAtTime(on ? (0.045 + throttle * 0.03 + r * 0.03) * att : 0, t, 0.1);
  }
  stopEngine(id) { const e = this.engines.get(id); if (!e) return; e.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1); setTimeout(() => { try { e.o.stop(); e.o2.stop(); } catch (_) { } }, 400); this.engines.delete(id); }
  ambience(env) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.wind.g.gain.setTargetAtTime(0.03 + (env.height || 0) * 0.001, t, 1);
    this.waves.g.gain.setTargetAtTime(Math.max(0, 1 - (env.coastDist || 999) / 120) * 0.25, t, 1);
    this.rainN.g.gain.setTargetAtTime((env.rain || 0) * 0.25, t, 1);
    this.city.g.gain.setTargetAtTime(Math.max(0, 1 - (env.roadDist || 99) / 40) * 0.08, t, 1);
    if (!env.night && Math.random() < 0.004 && (env.green || 0) > 0.2) this.bird();
    if (env.night && Math.random() < 0.006) this.cricket();
  }
  bird() { const f = 2200 + Math.random() * 1500; for (let i = 0; i < 3; i++) this.tone(f + Math.random() * 400, 0.07, 'sine', 0.025, i * 0.09, 1.3); }
  cricket() { for (let i = 0; i < 6; i++) this.tone(4200, 0.03, 'square', 0.008, i * 0.06); }
  // ---------------- background music: generative "campus afternoon" (calm, warm, light groove) ----------------
  // 84 BPM, C major / A minor colour, electric-piano comping (2-op FM), soft sub bass, marimba motif that repeats
  // with variation, brushed hats and a gentle kick. Scheduled ahead on the audio clock (no timer drift).
  radio(on) { this.bgm(on); }
  bgm(on) {
    this.radioOn = on; this.bgmOn = on; if (!this.ctx) return;
    const c = this.ctx;
    if (!this.mbus) {
      this.mbus = c.createGain(); this.mbus.gain.value = 0;
      const warm = c.createBiquadFilter(); warm.type = 'lowpass'; warm.frequency.value = 6500;
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
      this.mbus.connect(warm); warm.connect(comp); comp.connect(this.musicG);
      // reverb send (synthetic room impulse)
      const len = c.sampleRate * 2.4, ir = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / len, 3.2); }
      this.verb = c.createConvolver(); this.verb.buffer = ir; this.verbSend = c.createGain(); this.verbSend.gain.value = 0.28; this.verbSend.connect(this.verb); this.verb.connect(comp);
      this.mstep = 0; this.mnext = c.currentTime + 0.2; this.msec = 0; this.makeMotif();
    }
    const t = c.currentTime; this.mbus.gain.cancelScheduledValues(t); this.mbus.gain.setTargetAtTime(on ? 1 : 0, t, on ? 0.8 : 0.4);
    if (on && !this.mtimer) { this.mnext = Math.max(this.mnext, c.currentTime + 0.1); this.mtimer = setInterval(() => this.schedule(), 40); }
    if (!on && this.mtimer) { setTimeout(() => { if (!this.bgmOn && this.mtimer) { clearInterval(this.mtimer); this.mtimer = null; } }, 1500); }
  }
  makeMotif() { // 2-bar marimba phrase over C-major pentatonic (degree indices), with rests
    const r = Math.random; this.motif = [];
    for (let s = 0; s < 32; s++) this.motif.push(s % 2 === 0 && r() < (s % 8 === 0 ? 0.9 : 0.5) ? [0, 1, 2, 3, 4, 5, 6][(r() * 7) | 0] : -1);
  }
  schedule() {
    const c = this.ctx; if (!c) return;
    const spb = 60 / 84, s16 = spb / 4;
    // progression (one chord per bar): A section Cmaj9 Am9 Fmaj9 G6 · B section Dm9 G13 Em7 Am9
    const PROG = [[48, [52, 55, 59, 62]], [45, [52, 55, 59, 60]], [41, [52, 57, 60, 64]], [43, [50, 55, 59, 64]], [38, [53, 57, 60, 64]], [43, [53, 57, 59, 64]], [40, [50, 55, 59, 62]], [45, [52, 55, 60, 64]]];
    const PENT = [60, 62, 64, 67, 69, 72, 74];
    const mtof = (n) => 440 * Math.pow(2, (n - 69) / 12);
    while (this.mnext < c.currentTime + 0.25) {
      const st = this.mstep, bar = Math.floor(st / 16), pos = st % 16, sec = Math.floor(bar / 8) % 2, chord = PROG[sec * 4 + (bar % 4)];
      const swing = (pos % 2 === 1) ? s16 * 0.18 : 0; const t = this.mnext + swing;
      // electric piano comp: bar start, the "and" of 2, and beat 4 (sometimes)
      if (pos === 0 || pos === 6 || (pos === 12 && Math.random() < 0.6)) for (const n of chord[1]) this.ep(mtof(n), t + Math.random() * 0.012, pos === 0 ? 0.05 : 0.035, pos === 0 ? 2.2 : 1.1);
      // bass: root on 1, fifth/octave walk
      if (pos === 0) this.bass(mtof(chord[0]), t, 0.13, spb * 1.6);
      if (pos === 10 && Math.random() < 0.7) this.bass(mtof(chord[0] + (Math.random() < 0.5 ? 7 : 12)), t, 0.09, spb * 0.8);
      // drums
      if (pos === 0 || (pos === 10 && Math.random() < 0.5)) this.kick(t, 0.32);
      if (pos === 4 || pos === 12) this.brush(t, 0.07);
      if (pos % 2 === 0) this.hat(t, pos % 4 === 0 ? 0.03 : 0.018);
      // marimba motif (varies every 8 bars)
      const mi = this.motif[(bar % 2) * 16 + pos]; if (mi >= 0 && bar % 8 !== 7) this.mallet(mtof(PENT[mi] + (sec ? 2 : 0)), t, 0.06);
      this.mstep++; this.mnext += s16;
      if (this.mstep % (16 * 8) === 0) this.makeMotif();
    }
  }
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
  hat(t, v) { this._noise(t, v, 8000, 'highpass', 0.045); }
  brush(t, v) { const g = this._noise(t, v, 2200, 'bandpass', 0.16, 0.6); g.connect(this.verbSend); }
}
