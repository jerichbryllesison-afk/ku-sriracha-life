// Phone notification centre: iOS-style banners, per-app badges, incoming-call screen with choice-based conversation.
import { esc } from './ui.js';
import { L2 } from './i18n.js';

export class Notifier {
  constructor({ audio, phone }) {
    this.audio = audio; this.phone = phone; this.badges = {}; this.history = []; this.dnd = false; this.call = null;
    this.box = document.createElement('div'); this.box.id = 'notifs'; document.body.appendChild(this.box);
    this.cs = document.createElement('div'); this.cs.id = 'callScreen'; this.cs.className = 'hidden'; document.body.appendChild(this.cs);
  }
  count(app) { return this.badges[app] || 0; }
  total() { return Object.values(this.badges).reduce((a, b) => a + b, 0); }
  clear(app) { if (this.badges[app]) { this.badges[app] = 0; this.onBadge && this.onBadge(); } }
  // n: { app, icon, title, text, actions: [{label, fn, primary}], onTap, sound, ttl, quiet }
  push(n) {
    if (n.app) { this.badges[n.app] = (this.badges[n.app] || 0) + 1; this.onBadge && this.onBadge(); }
    this.history.unshift({ ...n, t: Date.now() }); if (this.history.length > 40) this.history.pop();
    if (this.dnd && !n.urgent) return;
    if (!n.quiet) this.audio.ping(n.sound || 'msg');
    const d = document.createElement('div'); d.className = 'nt';
    d.innerHTML = `<div class="nt-i">${n.icon || '🔔'}</div><div class="nt-b"><div class="nt-h"><b>${esc(n.title || '')}</b><small>${L2('now', 'เมื่อสักครู่')}</small></div><div class="nt-t">${esc(n.text || '')}</div>${n.actions ? `<div class="nt-a">${n.actions.map((a, i) => `<button data-i="${i}" class="${a.primary ? 'p' : ''}">${esc(a.label)}</button>`).join('')}</div>` : ''}</div>`;
    const close = () => { d.classList.add('out'); setTimeout(() => d.remove(), 260); };
    d.onclick = (e) => { const b = e.target.closest('button'); if (b) { e.stopPropagation(); const a = n.actions[+b.dataset.i]; close(); a.fn && a.fn(); return; } close(); if (n.onTap) n.onTap(); else if (n.app && this.phone) this.phone.openPhone(n.app); };
    this.box.prepend(d); while (this.box.children.length > 3) this.box.lastChild.remove();
    setTimeout(close, n.ttl || (n.actions ? 9000 : 5200));
  }
  // incoming call. script: { name, sub, icon, lines: [{ npc, choices: [{ me, reply, fx }] }], onEnd(result), onMissed }
  ring(script) {
    if (this.call) return false; this.call = script; const c = this.cs; c.classList.remove('hidden');
    c.innerHTML = `<div class="cs-top"><div class="cs-av">${script.icon || '👤'}</div><h2>${esc(script.name)}</h2><p>${esc(script.sub || L2('incoming call…', 'สายเรียกเข้า…'))}</p></div>
      <div class="cs-body" id="csBody"></div><div class="cs-btns"><button class="cs-no" id="csNo">✕<small>${L2('Decline', 'ปฏิเสธ')}</small></button><button class="cs-yes" id="csYes">✆<small>${L2('Answer', 'รับสาย')}</small></button></div>`;
    let ringT = 0; const ring = () => { if (this.call === script && !script._live) { this.audio.ping('ring'); ringT = setTimeout(ring, 2600); } }; ring();
    const miss = setTimeout(() => { if (this.call === script && !script._live) { end('missed'); } }, 16000);
    const end = (how) => { clearTimeout(ringT); clearTimeout(miss); c.classList.add('hidden'); this.call = null; if (how === 'missed' && script.onMissed) script.onMissed(); if (script.onEnd) script.onEnd(how, script._picks || []); };
    c.querySelector('#csNo').onclick = () => { this.audio.ping('hang'); end('declined'); };
    c.querySelector('#csYes').onclick = () => {
      script._live = true; clearTimeout(ringT); this.audio.ping('pick'); script._picks = [];
      c.querySelector('.cs-top p').textContent = L2('on the phone', 'กำลังคุย');
      const btns = c.querySelector('.cs-btns'); btns.innerHTML = `<button class="cs-no" id="csEnd">✕<small>${L2('Hang up', 'วางสาย')}</small></button>`;
      btns.querySelector('#csEnd').onclick = () => { this.audio.ping('hang'); end('hung'); };
      const body = c.querySelector('#csBody'); let i = 0;
      const say = (who, text) => { const p = document.createElement('div'); p.className = 'cs-l ' + who; p.textContent = text; body.appendChild(p); body.scrollTop = 1e6; };
      const step = () => {
        const L = script.lines[i]; if (!L) { setTimeout(() => { if (this.call === script) { this.audio.ping('hang'); end('done'); } }, 1600); return; }
        setTimeout(() => {
          if (this.call !== script) return; say('npc', L.npc); this.audio.ping('blip');
          if (!L.choices) { i++; step(); return; }
          const ch = document.createElement('div'); ch.className = 'cs-ch';
          ch.innerHTML = L.choices.map((o, k) => `<button data-k="${k}">${esc(o.me)}</button>`).join(''); body.appendChild(ch); body.scrollTop = 1e6;
          ch.querySelectorAll('button').forEach(b => b.onclick = () => { const o = L.choices[+b.dataset.k]; ch.remove(); say('me', o.me); script._picks.push(o); if (o.fx) o.fx(); if (o.reply) setTimeout(() => { if (this.call === script) { say('npc', o.reply); this.audio.ping('blip'); i++; step(); } }, 900); else { i++; step(); } });
        }, i === 0 ? 500 : 700);
      };
      step();
    };
    return true;
  }
}
