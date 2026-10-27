// Job / activity mini-games. Each returns a Promise resolving to a score 0..1 (or null if cancelled).
import { QUIZ } from '../shared/catalog.js';
import { esc } from './ui.js';

const KEYS = ['W', 'A', 'S', 'D', 'Q', 'E', 'R', 'F'];
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

export function runMinigame(ui, audio, kind, opts = {}) {
  return new Promise((resolve) => {
    let finished = false; let cleanup = () => {};
    const finish = (score) => { if (finished) return; finished = true; cleanup(); ui.closeModal(); resolve(score); };
    const title = opts.title || 'Work'; const sub = opts.sub || '';
    const head = `<h2>${esc(title)}</h2><p class="sub">${esc(sub)}</p>`;
    if (kind === 'keys') {
      const rounds = opts.rounds || 5; let round = 0, good = 0, seq = [], idx = 0, t0 = 0; const limit = opts.time || 3.2;
      ui.modal(`<div class="mg">${head}<div id="mgInfo">Round 1/${rounds}</div><div class="keys" id="mgKeys"></div><div class="timer"><i id="mgT"></i></div><div class="actions"><button class="btn ghost" id="mgQuit">Stop</button></div></div>`, (root) => {
        const keysEl = root.querySelector('#mgKeys'), tEl = root.querySelector('#mgT');
        const next = () => { if (round >= rounds) return finish(good / rounds); round++; root.querySelector('#mgInfo').textContent = `Round ${round}/${rounds}`; seq = Array.from({ length: 3 + Math.min(3, round >> 1) }, () => KEYS[(Math.random() * KEYS.length) | 0]); idx = 0; t0 = performance.now(); draw(); };
        const draw = () => { keysEl.innerHTML = seq.map((k, i) => `<span class="${i < idx ? 'done' : i === idx ? 'cur' : ''}">${k}</span>`).join(''); };
        const onKey = (e) => { const k = e.key.toUpperCase(); if (!KEYS.includes(k)) return; e.preventDefault(); e.stopPropagation(); if (k === seq[idx]) { idx++; audio.click(); if (idx >= seq.length) { good++; audio.cash(); next(); } else draw(); } else { audio.error(); next(); } };
        addEventListener('keydown', onKey, true);
        // touch support: tap the highlighted key
        keysEl.addEventListener('click', () => onKey({ key: seq[idx], preventDefault() {}, stopPropagation() {} }));
        let raf; const loop = () => { const el = (performance.now() - t0) / 1000; tEl.style.width = Math.max(0, 100 - el / limit * 100) + '%'; if (el > limit) { audio.error(); next(); } raf = requestAnimationFrame(loop); };
        cleanup = () => { removeEventListener('keydown', onKey, true); cancelAnimationFrame(raf); };
        root.querySelector('#mgQuit').onclick = () => finish(round > 1 ? good / rounds * 0.5 : null);
        next(); loop();
      }, () => finish(null));
    } else if (kind === 'timing') {
      const rounds = opts.rounds || 5; let round = 0, score = 0, pos = 0, dir = 1, zone = [0.4, 0.6], speed = 0.9;
      ui.modal(`<div class="mg">${head}<div id="mgInfo">Press <kbd>Space</kbd> / tap when the marker is in the green zone</div><div class="timing" id="mgBar"><div class="zone" id="mgZone"></div><div class="needle" id="mgNeedle"></div></div><div id="mgScore">0 / ${rounds}</div><div class="actions"><button class="btn ghost" id="mgQuit">Stop</button></div></div>`, (root) => {
        const z = root.querySelector('#mgZone'), n = root.querySelector('#mgNeedle'), sc = root.querySelector('#mgScore');
        const newZone = () => { const w = Math.max(0.08, 0.22 - round * 0.025); const s = 0.1 + Math.random() * (0.8 - w); zone = [s, s + w]; z.style.left = s * 100 + '%'; z.style.width = w * 100 + '%'; speed = 0.8 + round * 0.18; };
        const hit = () => { const ok = pos >= zone[0] && pos <= zone[1]; if (ok) { score++; audio.cash(); } else audio.error(); round++; sc.textContent = `${score} / ${rounds}`; if (round >= rounds) finish(score / rounds); else newZone(); };
        const onKey = (e) => { if (e.code === 'Space' || e.code === 'KeyE') { e.preventDefault(); e.stopPropagation(); hit(); } };
        addEventListener('keydown', onKey, true); root.querySelector('#mgBar').addEventListener('pointerdown', hit);
        let last = performance.now(), raf; const loop = (t) => { const dt = (t - last) / 1000; last = t; pos += dir * speed * dt; if (pos > 1) { pos = 1; dir = -1; } if (pos < 0) { pos = 0; dir = 1; } n.style.left = `calc(${pos * 100}% - 3px)`; raf = requestAnimationFrame(loop); };
        cleanup = () => { removeEventListener('keydown', onKey, true); cancelAnimationFrame(raf); };
        root.querySelector('#mgQuit').onclick = () => finish(round ? score / rounds * 0.5 : null);
        newZone(); raf = requestAnimationFrame(loop);
      }, () => finish(null));
    } else if (kind === 'memory') {
      const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f']; const icons = opts.icons || ['📕', '📘', '📗', '📒'];
      let level = 0, seq = [], inputIdx = 0, showing = false; const maxLevel = opts.rounds || 5; let best = 0;
      ui.modal(`<div class="mg">${head}<div id="mgInfo">Watch the sequence…</div><div class="pads">${colors.map((c, i) => `<button data-i="${i}" style="background:${c}">${icons[i]}</button>`).join('')}</div><div class="actions"><button class="btn ghost" id="mgQuit">Stop</button></div></div>`, (root) => {
        const pads = [...root.querySelectorAll('.pads button')]; const info = root.querySelector('#mgInfo');
        const flash = (i, ms = 380) => new Promise(r => { pads[i].classList.add('lit'); audio.tone(330 + i * 110, ms / 1000, 'triangle', 0.1); setTimeout(() => { pads[i].classList.remove('lit'); setTimeout(r, 120); }, ms); });
        const play = async () => { showing = true; info.textContent = 'Watch…'; await new Promise(r => setTimeout(r, 500)); for (const i of seq) { if (finished) return; await flash(i, Math.max(220, 420 - level * 30)); } showing = false; inputIdx = 0; info.textContent = `Repeat it! (${seq.length})`; };
        const nextLevel = () => { level++; if (level > maxLevel) return finish(1); seq.push((Math.random() * 4) | 0); play(); };
        pads.forEach(p => p.addEventListener('click', async () => { if (showing || finished) return; const i = +p.dataset.i; flash(i, 160); if (i === seq[inputIdx]) { inputIdx++; if (inputIdx >= seq.length) { best = level; audio.cash(); setTimeout(nextLevel, 400); } } else { audio.error(); info.textContent = 'Oops!'; setTimeout(() => finish(best / maxLevel), 700); } }));
        const onKey = (e) => { const m = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, KeyW: 0, KeyA: 1, KeyS: 2, KeyD: 3 }[e.code]; if (m !== undefined) { e.preventDefault(); e.stopPropagation(); pads[m].click(); } };
        addEventListener('keydown', onKey, true); cleanup = () => removeEventListener('keydown', onKey, true);
        root.querySelector('#mgQuit').onclick = () => finish(best / maxLevel * 0.5);
        seq = [(Math.random() * 4) | 0]; level = 1; play();
      }, () => finish(null));
    } else if (kind === 'quiz') {
      const qs = shuffle(opts.questions || QUIZ).slice(0, opts.rounds || 3); let i = 0, right = 0; const time = opts.time || 15;
      ui.modal(`<div class="mg">${head}<div id="mgQ"></div><div class="timer"><i id="mgT"></i></div><div class="quiz" id="mgA"></div></div>`, (root) => {
        let t0 = 0, raf, locked = false;
        const show = () => {
          if (i >= qs.length) return finish(right / qs.length);
          const q = qs[i]; const order = shuffle(q.o.map((o, k) => ({ o, k }))); locked = false; t0 = performance.now();
          root.querySelector('#mgQ').innerHTML = `<p style="font-size:13px;color:var(--muted)">Question ${i + 1}/${qs.length}</p><h3 style="margin:4px 0 10px">${esc(q.q)}</h3>`;
          const box = root.querySelector('#mgA'); box.innerHTML = order.map(x => `<button data-k="${x.k}">${esc(x.o)}</button>`).join('');
          box.querySelectorAll('button').forEach(b => b.onclick = () => { if (locked) return; locked = true; const ok = +b.dataset.k === q.a; if (ok) { right++; audio.cash(); b.classList.add('right'); } else { audio.error(); b.classList.add('wrong'); box.querySelector(`[data-k="${q.a}"]`).classList.add('right'); } setTimeout(() => { i++; show(); }, 900); });
        };
        const loop = () => { const el = (performance.now() - t0) / 1000; root.querySelector('#mgT').style.width = Math.max(0, 100 - el / time * 100) + '%'; if (el > time && !locked) { locked = true; audio.error(); setTimeout(() => { i++; show(); }, 400); } raf = requestAnimationFrame(loop); };
        cleanup = () => cancelAnimationFrame(raf);
        show(); loop();
      }, () => finish(null));
    } else if (kind === 'progress') {
      const dur = opts.time || 5;
      ui.modal(`<div class="mg">${head}<div class="big">${opts.icon || '📚'}</div><div class="timer" style="height:12px"><i id="mgT" style="width:0"></i></div><p id="mgP">0%</p></div>`, (root) => {
        const t0 = performance.now(); let raf; const loop = () => { const k = Math.min(1, (performance.now() - t0) / 1000 / dur); root.querySelector('#mgT').style.width = k * 100 + '%'; root.querySelector('#mgP').textContent = Math.round(k * 100) + '%'; if (k >= 1) return finish(1); raf = requestAnimationFrame(loop); };
        cleanup = () => cancelAnimationFrame(raf); loop();
      }, () => finish(null));
    }
  });
}
