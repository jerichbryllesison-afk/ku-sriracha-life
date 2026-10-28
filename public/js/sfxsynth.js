// Procedural, original sound synthesis (no third-party recordings): footsteps per surface, footwear layers, speech-like
// NPC voices (non-verbal "walla" with Thai-style tone contours), laughs, claps, impacts, food-stall sizzle and a small
// room / urban-canyon impulse response. Everything renders once into Float32Arrays and is cached as AudioBuffers.
let S = 1;
const rnd = () => (S = (S * 16807) % 2147483647) / 2147483647;
const rr = (a, b) => a + rnd() * (b - a);

// RBJ biquad (direct form I) — offline only
function biq(type, f, q, sr) {
  const w = 2 * Math.PI * Math.min(f, sr * 0.45) / sr, cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * q);
  let b0, b1, b2; const a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
  if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2; }
  else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; }
  else { b0 = al; b1 = 0; b2 = -al; } // band-pass (0 dB peak)
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}
function filter(x, c, from = 0, to = x.length) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0; const [b0, b1, b2, a1, a2] = c;
  for (let i = from; i < to; i++) { const v = x[i]; const y = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = y; x[i] = y; }
}
// filtered noise burst with exponential decay, added into out
function burst(out, sr, t0, dur, amp, type, f, q, attack = 0.001) {
  const n = Math.floor(dur * sr * 3), s = Math.floor(t0 * sr); if (s >= out.length) return;
  const tmp = new Float32Array(Math.min(n, out.length - s)); const k = 1 / (dur * sr), at = Math.max(1, attack * sr);
  for (let i = 0; i < tmp.length; i++) tmp[i] = (rnd() * 2 - 1) * Math.exp(-i * k) * Math.min(1, i / at);
  filter(tmp, biq(type, f, q, sr)); for (let i = 0; i < tmp.length; i++) out[s + i] += tmp[i] * amp;
}
function sine(out, sr, t0, f, dur, amp, f2 = f) {
  const s = Math.floor(t0 * sr), n = Math.min(out.length - s, Math.floor(dur * 4 * sr)); let ph = 0;
  for (let i = 0; i < n; i++) { const u = i / (dur * 4 * sr); ph += 2 * Math.PI * (f + (f2 - f) * Math.min(1, u * 4)) / sr; out[s + i] += Math.sin(ph) * amp * Math.exp(-i / (dur * sr)) * Math.min(1, i / (0.002 * sr)); }
}
function normalize(x, peak) { let m = 1e-9; for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i])); const k = peak / m; for (let i = 0; i < x.length; i++) x[i] *= k; return x; }

// ---------- footsteps ----------
// recipe per surface: heel transient (band, amp), body thump (Hz, amp, decay), texture grains (band, count, spread), toe roll
const STEP = {
  asphalt: { heel: [2400, 0.8, 0.55, 0.010], thump: [80, 0.5, 0.032], grit: [3800, 1.2, 12, 0.11, 0.05], peak: 0.55 },
  concrete: { heel: [2900, 0.8, 0.6, 0.009], thump: [95, 0.42, 0.028], grit: [4200, 1.4, 6, 0.08, 0.04], peak: 0.55 },
  tile: { heel: [3600, 1.0, 0.7, 0.007], thump: [130, 0.3, 0.02], ring: [1900, 0.05, 0.035], grit: [5000, 2, 3, 0.05, 0.02], peak: 0.55 },
  grass: { heel: [1400, 0.6, 0.12, 0.012], thump: [60, 0.28, 0.05], swish: [4800, 0.6, 0.26, 0.13, 28], peak: 0.36 },
  leaves: { heel: [1600, 0.6, 0.15, 0.01], thump: [65, 0.3, 0.045], grit: [3200, 1.6, 38, 0.24, 0.14], peak: 0.42 },
  dirt: { heel: [1000, 0.7, 0.3, 0.012], thump: [70, 0.45, 0.05], grit: [1500, 1.1, 18, 0.14, 0.08], peak: 0.45 },
  gravel: { heel: [1900, 0.8, 0.32, 0.01], thump: [75, 0.36, 0.04], grit: [2700, 1.5, 46, 0.3, 0.12], peak: 0.5 },
  sand: { heel: [700, 0.6, 0.1, 0.02], thump: [55, 0.3, 0.07], swish: [1100, 0.7, 0.26, 0.16, 26], peak: 0.36 },
  wood: { heel: [1700, 0.9, 0.45, 0.008], thump: [150, 0.6, 0.085], ring: [340, 0.25, 0.05], peak: 0.6 },
  rubber: { heel: [1300, 0.7, 0.22, 0.012], thump: [95, 0.45, 0.03], peak: 0.45 },
  water: { splash: true, peak: 0.45 },
};
export const STEP_SURFACES = Object.keys(STEP);
export function synthStep(sr, surface, run, variant) {
  S = 1009 + variant * 7919 + (run ? 31337 : 0) + surface.length * 97;
  const R = STEP[surface] || STEP.concrete; const len = Math.floor(sr * 0.42); const x = new Float32Array(len);
  const A = run ? 1.45 : 1, toe = run ? rr(0.035, 0.05) : rr(0.075, 0.11);
  if (R.splash) {
    burst(x, sr, 0, 0.09, 0.6 * A, 'bp', rr(700, 1000), 0.6, 0.004); burst(x, sr, 0.02, 0.16, 0.35 * A, 'bp', 2600, 0.8, 0.01);
    for (let i = 0; i < 5; i++) { const f = rr(500, 1400); sine(x, sr, rr(0.03, 0.2), f, 0.012, 0.12, f * 1.6); }
    return normalize(x, R.peak * (run ? 1 : 0.8));
  }
  const [hf, hq, ha, hd] = R.heel; burst(x, sr, 0, hd, ha * A * rr(0.85, 1.15), 'bp', hf * rr(0.9, 1.1), hq, 0.0006);
  const [tf, ta, td] = R.thump; sine(x, sr, 0.001, tf * rr(0.9, 1.1), td, ta * A, tf * 0.7);
  if (R.ring) sine(x, sr, 0.002, R.ring[0] * rr(0.95, 1.05), R.ring[2], R.ring[1] * A);
  if (R.grit) { const [gf, gq, gn, ga, gs] = R.grit; for (let i = 0; i < gn * (run ? 1.3 : 1); i++) burst(x, sr, rr(0, gs + toe), rr(0.002, 0.006), ga * A * rr(0.3, 1), 'bp', gf * rr(0.7, 1.4), gq, 0.0004); }
  if (R.swish) { const [sf, sq, sa, sd, sn] = R.swish; for (let i = 0; i < sn; i++) burst(x, sr, rr(0, sd), rr(0.01, 0.03), sa * A * rr(0.3, 1), 'bp', sf * rr(0.7, 1.3), sq, 0.006); }
  // toe / roll-off: softer second contact
  burst(x, sr, toe, hd * 0.8, ha * 0.45 * A, 'bp', hf * 0.8, hq, 0.002); sine(x, sr, toe, tf * 1.1, td * 0.6, ta * 0.35 * A);
  if (run) burst(x, sr, toe + 0.01, 0.03, 0.08, 'bp', 3000, 0.6, 0.005); // scuff
  return normalize(x, R.peak * (run ? 1 : 0.78));
}
// footwear layers mixed on top of the surface step
export function synthShoe(sr, kind, variant) {
  S = 555 + variant * 1777 + kind.length * 13; const x = new Float32Array(Math.floor(sr * 0.2));
  if (kind === 'sandal') { burst(x, sr, rr(0.045, 0.07), 0.006, 0.8, 'bp', rr(1300, 1800), 0.9, 0.0008); burst(x, sr, rr(0.0, 0.01), 0.004, 0.35, 'bp', 2200, 1, 0.0005); } // flip-flop slap
  else if (kind === 'shoe') { burst(x, sr, 0, 0.004, 0.9, 'bp', rr(3200, 4200), 1.4, 0.0003); sine(x, sr, 0, rr(1800, 2300), 0.012, 0.18); } // leather heel click
  else if (kind === 'boot') { sine(x, sr, 0, 70, 0.05, 0.9); burst(x, sr, 0, 0.01, 0.4, 'bp', 1200, 0.8); }
  else { burst(x, sr, 0, 0.006, 0.3, 'bp', rr(1500, 2000), 0.9, 0.001); } // sneaker squeak-free soft rubber
  return normalize(x, kind === 'sneaker' ? 0.15 : 0.32);
}

// ---------- speech-like voices (non-verbal, no real words; avoids imitating any real person) ----------
const VOWELS = [[800, 1200, 2500], [400, 2000, 2550], [300, 2300, 2900], [450, 800, 2830], [325, 700, 2530], [550, 1700, 2500], [650, 1100, 2400]];
// Thai has five lexical tones — use their contour shapes so the murmur has a Thai-like melody: mid, low, falling, high, rising
const TONES = [[1, 1], [0.92, 0.86], [1.12, 0.84], [1.08, 1.16], [0.9, 1.14]];
export function synthVoice(sr, female, variant, opts = {}) {
  S = 4242 + variant * 3331 + (female ? 7 : 0) + (opts.laugh ? 99 : 0) + (opts.shout ? 555 : 0);
  const f0 = (female ? rr(195, 240) : rr(105, 135)) * (opts.shout ? 1.25 : 1);
  const nSyl = opts.laugh ? Math.floor(rr(4, 7)) : opts.shout ? Math.floor(rr(1, 3)) : Math.floor(rr(3, 10));
  const sylDur = opts.laugh ? 0.17 : opts.shout ? 0.32 : rr(0.13, 0.21);
  const total = nSyl * sylDur + 0.25; const len = Math.floor(total * sr); const src = new Float32Array(len), noi = new Float32Array(len);
  // per-syllable pitch contour + vowel; glottal source = band-limited pulse train (sum of harmonics)
  let ph = 0, lp1 = 0; const env = new Float32Array(len), fsel = new Int8Array(len);
  for (let s = 0; s < nSyl; s++) {
    const t0 = s * sylDur + rr(-0.01, 0.02), dur = sylDur * rr(0.75, 1.05), tone = TONES[(rnd() * 5) | 0], v = (rnd() * VOWELS.length) | 0;
    const i0 = Math.max(0, Math.floor(t0 * sr)), i1 = Math.min(len, Math.floor((t0 + dur) * sr));
    const decl = 1 - s / nSyl * 0.12; // declination across the phrase
    for (let i = i0; i < i1; i++) {
      const u = (i - i0) / (i1 - i0); const pitch = f0 * decl * (tone[0] + (tone[1] - tone[0]) * u) * (opts.laugh ? 1.25 - s * 0.05 : 1);
      ph += pitch / sr; const p = ph % 1; lp1 += ((1 - 2 * p) - lp1) * 0.35; const g = lp1; // softened sawtooth glottal source (cheap; formants follow)
      const e = Math.sin(Math.PI * Math.min(1, u * 1.15)) ** 0.7; env[i] = Math.max(env[i], e); src[i] = g * e * (opts.laugh ? 0.5 : 1); fsel[i] = v;
    }
    // consonant onset: short noise burst (s/t/k/ch-like)
    if (rnd() < 0.7) for (let i = i0; i < Math.min(len, i0 + Math.floor(rr(0.015, 0.04) * sr)); i++) noi[i] += (rnd() * 2 - 1) * 0.35;
    if (opts.laugh) for (let i = i0; i < i1; i++) noi[i] += (rnd() * 2 - 1) * env[i] * 0.45; // breathy "ha"
  }
  // formant filter bank, switching vowel per syllable (filter states persist → smooth formant transitions)
  const out = new Float32Array(len); let cur = -1, C = null; const st = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]; const amps = [1, 0.55, 0.25];
  for (let i = 0; i < len; i++) {
    if (fsel[i] !== cur) { cur = fsel[i]; const V = VOWELS[cur] || VOWELS[0]; const sc = female ? 1.15 : 1; C = V.map(f => biq('bp', f * sc, 5, sr)); }
    const x = src[i] * 0.3 + noi[i] * 0.4; let y = 0;
    for (let k = 0; k < 3; k++) { const c = C[k], s2 = st[k]; const v = c[0] * x + c[1] * s2[0] + c[2] * s2[1] - c[3] * s2[2] - c[4] * s2[3]; s2[1] = s2[0]; s2[0] = x; s2[3] = s2[2]; s2[2] = v; y += v * amps[k]; }
    out[i] = y;
  }
  filter(out, biq('lp', female ? 5200 : 4200, 0.7, sr));
  return normalize(out, opts.shout ? 0.7 : 0.5);
}
// seamless stereo crowd murmur bed: many overlapping talkers, equal-power wrapped loop
export function synthWalla(sr, seconds = 8, talkers = 12) {
  const len = Math.floor(seconds * sr); const L = new Float32Array(len), Rr = new Float32Array(len);
  for (let k = 0; k < talkers * 3; k++) {
    const v = synthVoice(sr, k % 2 === 0, 100 + k); const off = Math.floor(rnd() * len); const pan = rnd(); const g = rr(0.15, 0.4);
    for (let i = 0; i < v.length; i++) { const j = (off + i) % len; L[j] += v[i] * g * Math.cos(pan * Math.PI / 2); Rr[j] += v[i] * g * Math.sin(pan * Math.PI / 2); }
  }
  for (const ch of [L, Rr]) { filter(ch, biq('lp', 3200, 0.7, sr)); normalize(ch, 0.5); }
  return [L, Rr];
}

// ---------- misc one-shots ----------
export function synthClap(sr, variant) { S = 77 + variant * 911; const x = new Float32Array(Math.floor(sr * 0.25)); for (let k = 0; k < 3; k++) burst(x, sr, k * 0.004, 0.006, 0.6, 'bp', rr(1100, 1700), 0.7, 0.0003); burst(x, sr, 0.01, 0.06, 0.12, 'bp', 1400, 0.5); return normalize(x, 0.55); }
export function synthKick(sr, variant) { S = 99 + variant * 313; const x = new Float32Array(Math.floor(sr * 0.25)); sine(x, sr, 0, 120, 0.03, 0.9, 60); burst(x, sr, 0, 0.008, 0.6, 'bp', 900, 0.8, 0.0003); return normalize(x, 0.6); }
export function synthDoor(sr, kind, variant) { // car door: latch click + panel thunk; moto: seat/kickstand
  S = 1234 + variant * 57 + kind.length; const x = new Float32Array(Math.floor(sr * 0.45));
  if (kind === 'car') { sine(x, sr, 0, 75, 0.09, 0.9, 60); sine(x, sr, 0, 290, 0.05, 0.25); burst(x, sr, 0, 0.01, 0.5, 'bp', 2800, 1.2, 0.0003); burst(x, sr, 0.004, 0.05, 0.2, 'lp', 600, 0.7); }
  else if (kind === 'carOpen') { burst(x, sr, 0, 0.006, 0.5, 'bp', 3200, 1.5, 0.0003); sine(x, sr, 0.03, 120, 0.04, 0.3); }
  else { sine(x, sr, 0, 95, 0.05, 0.6, 70); burst(x, sr, 0.03, 0.012, 0.35, 'bp', 2200, 2, 0.0003); sine(x, sr, 0.03, 1900, 0.03, 0.12); } // seat thump + stand clack
  return normalize(x, 0.6);
}
export function synthSit(sr, variant) { S = 4321 + variant; const x = new Float32Array(Math.floor(sr * 0.5)); for (let i = 0; i < 18; i++) burst(x, sr, rr(0, 0.25), rr(0.01, 0.04), rr(0.1, 0.3), 'bp', rr(2500, 5500), 0.8, 0.005); sine(x, sr, 0.05, 70, 0.06, 0.4); return normalize(x, 0.3); }
export function synthSizzle(sr, seconds = 3) { S = 2024; const len = Math.floor(seconds * sr), x = new Float32Array(len); for (let i = 0; i < len; i++) x[i] = (rnd() * 2 - 1) * 0.12; filter(x, biq('hp', 3000, 0.7, sr)); for (let k = 0; k < seconds * 90; k++) burst(x, sr, rr(0, seconds - 0.05), rr(0.001, 0.004), rr(0.2, 0.7), 'bp', rr(3000, 8000), 1, 0.0002); for (let i = 0; i < 2000; i++) { const a = i / 2000; x[i] = x[i] * a + x[len - 2000 + i] * (1 - a); } return normalize(x.subarray(0, len - 2000), 0.4); }
export function synthStarter(sr, moto) { // electric starter whirr, then the engine catches (engine voice takes over)
  S = moto ? 61 : 62; const dur = moto ? 0.55 : 0.85, x = new Float32Array(Math.floor(sr * dur)); let ph = 0, ph2 = 0;
  for (let i = 0; i < x.length; i++) { const u = i / x.length; const f = (moto ? 28 : 18) + u * (moto ? 22 : 16); ph += f / sr; ph2 += (moto ? 900 : 620) * (1 + u * 0.3) / sr; const p = ph % 1; x[i] = ((p < 0.25 ? 1 : -0.3) * 0.6 + Math.sin(2 * Math.PI * ph2) * 0.25 + (rnd() - 0.5) * 0.3) * Math.min(1, i / (0.02 * sr)) * Math.min(1, (x.length - i) / (0.05 * sr)); }
  filter(x, biq('lp', 2500, 0.7, sr)); return normalize(x, 0.45);
}
export function synthImpact(sr, variant) { // vehicle collision: low crunch + metallic inharmonic partials
  S = 909 + variant * 17; const x = new Float32Array(Math.floor(sr * 1.2)); sine(x, sr, 0, 60, 0.12, 1, 40); burst(x, sr, 0, 0.12, 0.8, 'lp', 700, 0.7, 0.001);
  for (const f of [520, 1240, 2310, 3170]) sine(x, sr, rr(0, 0.01), f * rr(0.9, 1.1), rr(0.08, 0.25), 0.18); for (let i = 0; i < 20; i++) burst(x, sr, rr(0.02, 0.4), 0.01, rr(0.05, 0.2), 'bp', rr(2000, 6000), 2, 0.0003);
  return normalize(x, 0.8);
}
// stereo impulse response: early reflections (building facades) + diffuse tail
export function synthIR(sr, seconds, early = true) {
  S = 31; const len = Math.floor(seconds * sr); const L = new Float32Array(len), R = new Float32Array(len);
  if (early) for (let k = 0; k < 10; k++) { const t = Math.floor(rr(0.008, 0.07) * sr); const g = rr(0.2, 0.55) * (1 - k / 12); L[t] += g * (rnd() < 0.5 ? 1 : -1); R[Math.min(len - 1, t + Math.floor(rr(0, 0.004) * sr))] += g * (rnd() < 0.5 ? 1 : -1); }
  for (let i = Math.floor(0.02 * sr); i < len; i++) { const e = Math.pow(1 - i / len, 3.5) * 0.35; L[i] += (rnd() * 2 - 1) * e; R[i] += (rnd() * 2 - 1) * e; }
  filter(L, biq('lp', 5000, 0.7, sr)); filter(R, biq('lp', 5000, 0.7, sr)); return [L, R];
}

// ---------- campus place one-shots ----------
export function synthClink(sr, variant) { // spoon / plate / glass: short inharmonic ring
  S = 300 + variant * 41; const x = new Float32Array(Math.floor(sr * 0.35)); const base = rr(1800, 3400);
  for (const k of [1, 2.76, 5.4]) sine(x, sr, 0, base * k * rr(0.98, 1.02), rr(0.03, 0.09) / k, 0.4 / k);
  burst(x, sr, 0, 0.002, 0.3, 'hp', 4000, 0.7, 0.0002); return normalize(x, 0.4);
}
export function synthSteam(sr) { S = 808; const x = new Float32Array(Math.floor(sr * 1.6)); for (let i = 0; i < x.length; i++) { const u = i / x.length; x[i] = (rnd() * 2 - 1) * Math.min(1, u * 8) * Math.pow(1 - u, 1.5); } filter(x, biq('hp', 2500, 0.7, sr)); filter(x, biq('lp', 9000, 0.7, sr)); return normalize(x, 0.35); }
export function synthWhistle(sr, variant) { // referee pea whistle: ~2.9 kHz tone with fast pea trill
  S = 707 + variant; const dur = variant ? 0.9 : 0.35, x = new Float32Array(Math.floor(sr * (dur + 0.1))); let ph = 0;
  for (let i = 0; i < x.length; i++) { const t = i / sr; const f = 2850 + Math.sin(2 * Math.PI * 28 * t) * 110; ph += f / sr; const e = Math.min(1, t / 0.015) * (t < dur ? 1 : Math.max(0, 1 - (t - dur) / 0.05)); x[i] = (Math.sin(2 * Math.PI * ph) * 0.8 + (rnd() - 0.5) * 0.15) * e * (0.75 + 0.25 * Math.sin(2 * Math.PI * 28 * t)); }
  return normalize(x, 0.5);
}
export function synthChime(sr) { S = 909; const x = new Float32Array(Math.floor(sr * 1.2)); sine(x, sr, 0, 1318, 0.28, 0.5); sine(x, sr, 0.32, 1046, 0.4, 0.5); sine(x, sr, 0, 2636, 0.1, 0.08); return normalize(x, 0.35); } // generic shop door chime (two notes)
export function synthRattle(sr, variant) { S = 1300 + variant * 7; const x = new Float32Array(Math.floor(sr * 0.25)); for (let i = 0; i < 6; i++) burst(x, sr, rr(0, 0.08), 0.004, rr(0.3, 0.8), 'bp', rr(2500, 5000), 3, 0.0002); sine(x, sr, 0, 90, 0.03, 0.4); return normalize(x, 0.35); } // bicycle fender / bell rattle on bumps
