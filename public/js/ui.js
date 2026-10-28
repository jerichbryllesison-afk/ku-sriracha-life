// DOM user interface: HUD, toasts, modal, chat, minimap, big map, creator, emote wheel.
import { xpForLevel } from '../shared/catalog.js';
import { icon, drawIcon, splitLeadEmoji } from './icons.js';
import { tr, L2 } from './i18n.js';

const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmt = (n) => '฿' + Math.round(n).toLocaleString('en-US');
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_TH = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

export class UI {
  constructor() {
    this.toastsEl = $('toasts'); this.modalOpen = false; this.phoneOpen = false; this.mapOpen = false; this.chatting = false;
    this.mm = $('minimap').getContext('2d'); this.mapImg = null; this.chatHideT = 0;
    this.onModalClose = null;
    $('modal').addEventListener('mousedown', (e) => { if (e.target.id === 'modal') this.closeModal(); });
  }
  loading(p, text) { $('loadBar').style.width = Math.round(p * 100) + '%'; if (text) $('loadText').textContent = tr(text); }
  hideLoading() { $('loading').classList.add('hidden'); $('hud').classList.remove('hidden'); }
  toast(text, type = '') { const d = document.createElement('div'); d.className = 'toast ' + type; const sp = splitLeadEmoji(tr(text)); d.innerHTML = `<span class="ti">${icon(sp.icon || (type === 'bad' ? 'alert' : type === 'gold' ? 'star' : 'info'))}</span><span>${sp.text}</span>`; this.toastsEl.appendChild(d); setTimeout(() => { d.style.transition = 'opacity .4s'; d.style.opacity = '0'; setTimeout(() => d.remove(), 400); }, 3800); while (this.toastsEl.children.length > (document.body.classList.contains('mobile') ? 3 : 5)) this.toastsEl.firstChild.remove(); }
  big(title, sub = '', ms = 2600) { const b = $('bigMsg'); b.innerHTML = `<h1>${esc(tr(title))}</h1><p>${esc(tr(sub))}</p>`; b.classList.remove('hidden'); clearTimeout(this._bigT); this._bigT = setTimeout(() => b.classList.add('hidden'), ms); }
  prompt(text) { const p = $('prompt'); if (!text) { p.classList.add('hidden'); return; } p.classList.remove('hidden'); if (this._pt !== text) { $('promptText').textContent = tr(text); this._pt = text; } }
  fade(on) { $('fade').style.opacity = on ? '1' : '0'; }
  hud(p, t, extra) {
    const need = xpForLevel(p.level); const pct = Math.min(100, p.xp / need * 100);
    $('hudName').textContent = p.name; $('hudLevel').textContent = p.level; $('hudXP').style.width = pct + '%'; $('hudMoney').textContent = fmt(p.money);
    $('hudAvatar').textContent = String(p.faculty || 'KU').toUpperCase();
    const hh = Math.floor(t.hour), mm = Math.floor((t.hour % 1) * 60); const clock = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    $('hudClock').textContent = clock; $('phTime').textContent = clock; { const wk = Math.floor((t.day % 112) / 7) + 1, dd = (t.day + 1) % 7; $('hudDay').textContent = L2(`Week ${wk} · ${DAYS[dd]}`, `สัปดาห์ ${wk} · ${DAYS_TH[dd]}`); }
    const wk = extra.weather === 'rain' ? 'rain' : extra.weather === 'cloudy' ? 'cloud' : (t.hour > 18.5 || t.hour < 6 ? 'moon' : 'sun');
    if (this._wk !== wk) { $('hudWeather').innerHTML = icon(wk); this._wk = wk; }
    const on = extra.online ? `<span class="dot"></span>${L2(extra.players + '/100 online', 'ออนไลน์ ' + extra.players + '/100')}` : `<span class="dot off"></span>${L2('Offline', 'ออฟไลน์')}`;
    if (this._on !== on) { $('hudOnline').innerHTML = on; this._on = on; }
    const bar = (id, v) => { const e = $(id); e.style.width = v + '%'; e.style.background = v < 20 ? 'var(--bad)' : v < 45 ? 'var(--warn)' : 'var(--ok)'; e.parentElement.parentElement.classList.toggle('low', v < 20); };
    if (!this._needIcons) { document.querySelectorAll('#needs [data-icon]').forEach(i => { i.innerHTML = icon(i.dataset.icon); }); this._needIcons = true; }
    bar('nHealth', p.stats.health); bar('nEnergy', p.stats.energy); bar('nHunger', p.stats.hunger); bar('nMood', p.stats.mood);
  }
  area(name) { if (this._area !== name) { $('areaName').textContent = name; this._area = name; } }
  areaToast(name) { let e = $('areaToast'); if (!e) { e = document.createElement('div'); e.id = 'areaToast'; document.body.appendChild(e); } e.textContent = '📍 ' + name; e.classList.remove('show'); void e.offsetWidth; e.classList.add('show'); }
  speedo(v) { const s = $('speedo'); if (!v) { s.classList.add('hidden'); return; } s.classList.remove('hidden'); $('spdVal').textContent = Math.round(Math.abs(v.speed) * 3.6); $('fuelFill').style.width = (v.spec.tank ? v.fuel * 100 : 100) + '%'; $('fuelBar').style.visibility = v.spec.tank ? 'visible' : 'hidden'; $('vehName').textContent = v.label || v.type; }
  quest(title, desc, dist, label) { const q = $('questTrack'); if (!title) { q.classList.add('hidden'); return; } q.classList.remove('hidden'); const lb = label || tr('Objective'); if (this._ql !== lb) { q.querySelector('.qt-label').textContent = lb; this._ql = lb; } $('qtTitle').textContent = title; $('qtDesc').textContent = desc; $('qtDist').innerHTML = dist ? icon('pin') + esc(String(dist).replace(/^\S*📍\s*/u, '')) : ''; }
  // chat
  chatAdd(m) {
    const log = $('chatLog'); const d = document.createElement('div'); d.className = 'm' + (m.sys ? ' sys' : '');
    d.innerHTML = m.sys ? esc(tr(m.text)) : `<b>${esc(m.name)}:</b> ${esc(m.text)}`; log.appendChild(d); while (log.children.length > 9) log.firstChild.remove();
    log.classList.remove('dim'); this.chatHideT = 12;
  }
  chatTick(dt) { if (this.chatting) return; this.chatHideT -= dt; if (this.chatHideT < 0) $('chatLog').classList.add('dim'); }
  chatOpen(onSend) {
    if (this.chatting) { this.chatClose(); return; }
    this.chatting = true; const w = $('chatInputWrap'), inp = $('chatInput'); w.classList.remove('hidden'); $('chatLog').classList.remove('dim'); inp.value = ''; setTimeout(() => inp.focus(), 0);
    const done = (send) => {
      if (!this.chatting) return; this.chatting = false; this._chatDone = null; inp.onkeydown = null; inp.onblur = null; w.classList.add('hidden');
      const v = inp.value.trim(); inp.blur(); if (send && v) onSend(v); this.chatHideT = 8; this.onChatClose && this.onChatClose();
    };
    this._chatDone = done;
    inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') done(true); else if (e.key === 'Escape') done(false); };
    // clicking / tapping anywhere else (or closing the phone keyboard) closes the chat — it can never get stuck open
    inp.onblur = () => setTimeout(() => { if (this.chatting && document.activeElement !== inp) done(false); }, 120);
    const btn = (id, send) => { const b = $(id); if (b) b.onpointerdown = (e) => { e.preventDefault(); done(send); }; };
    btn('chatSend', true); btn('chatClose', false);
  }
  chatClose() { if (this._chatDone) this._chatDone(false); }
  // modal
  modal(html, onMount, onClose) { const m = $('modal'); $('modalCard').innerHTML = html; m.classList.remove('hidden'); this.modalOpen = true; this.onModalClose = onClose || null; if (onMount) onMount($('modalCard')); }
  closeModal() { if (!this.modalOpen) return; $('modal').classList.add('hidden'); this.modalOpen = false; const f = this.onModalClose; this.onModalClose = null; if (f) f(); }
  // minimap
  setMap(canvas, bounds) { this.mapImg = canvas; this.mapB = bounds; }
  minimap(px, pz, heading, camYaw, blips, route, zoom = 1) {
    const c = this.mm, S = 220, half = S / 2; const scale = 1.25 * zoom; // px per metre
    c.save(); c.clearRect(0, 0, S, S); c.beginPath(); c.arc(half, half, half, 0, Math.PI * 2); c.clip();
    c.fillStyle = '#2b4a3a'; c.fillRect(0, 0, S, S);
    c.translate(half, half); c.rotate(camYaw - Math.PI); // rotate so camera forward is up
    if (this.mapImg) { const sx = px - this.mapB.minX, sz = pz - this.mapB.minZ; c.imageSmoothingEnabled = true; c.drawImage(this.mapImg, sx - half / scale * 1.5, sz - half / scale * 1.5, S / scale * 1.5, S / scale * 1.5, -half * 1.5, -half * 1.5, S * 1.5, S * 1.5); }
    if (route && route.length > 1) { c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 6; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); route.forEach((p, i) => { const x = (p[0] - px) * scale, y = (p[1] - pz) * scale; if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.stroke(); c.strokeStyle = '#f0d27c'; c.lineWidth = 3.5; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); route.forEach((p, i) => { const x = (p[0] - px) * scale, y = (p[1] - pz) * scale; if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.stroke(); }
    for (const b of blips) {
      let x = (b.x - px) * scale, y = (b.z - pz) * scale; const d = Math.hypot(x, y); const edge = half - 10;
      if (d > edge) { if (!b.edge) continue; x = x / d * edge; y = y / d * edge; }
      c.save(); c.translate(x, y); c.rotate(-(camYaw - Math.PI));
      if (b.glyph) { const r = (b.size || 14) * 0.62; c.fillStyle = b.color || '#33443d'; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill(); c.strokeStyle = 'rgba(242,237,225,.9)'; c.lineWidth = 1.2; c.stroke(); drawIcon(c, b.glyph, 0, 0, r * 1.25, '#fff', 1.6); }
      else if (b.icon) { c.font = `${b.size || 14}px 'Segoe UI Emoji','Apple Color Emoji',sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(b.icon, 0, 0); }
      else { c.fillStyle = b.color || '#fff'; c.beginPath(); c.arc(0, 0, b.r || 3.5, 0, Math.PI * 2); c.fill(); c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 1; c.stroke(); }
      c.restore();
    }
    // player arrow
    c.rotate(-heading); c.fillStyle = '#f2ede1'; c.strokeStyle = '#00704f'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 9); c.lineTo(6.5, -6); c.lineTo(0, -3); c.lineTo(-6.5, -6); c.closePath(); c.fill(); c.stroke();
    c.restore();
    $('compassN').style.transform = `translate(-50%,0) rotate(${((camYaw - Math.PI)) * 180 / Math.PI}deg)`;
  }
  // big map
  openMap(state, onPick) {
    this.mapOpen = true; const el = $('bigmap'); el.classList.remove('hidden'); const cv = $('bigmapCanvas'); const cx = cv.getContext('2d');
    const view = this._view || (this._view = { x: state.px, z: state.pz, s: 0.6 });
    view.x = state.px; view.z = state.pz;
    const draw = () => {
      if (!this.mapOpen) return; cv.width = innerWidth; cv.height = innerHeight; const W = cv.width, H = cv.height; cx.fillStyle = '#123327'; cx.fillRect(0, 0, W, H);
      const s = view.s; const ox = W / 2 - (view.x - this.mapB.minX) * s, oz = H / 2 - (view.z - this.mapB.minZ) * s;
      cx.imageSmoothingEnabled = s < 1.5; cx.drawImage(this.mapImg, ox, oz, this.mapImg.width * s, this.mapImg.height * s);
      const P = (x, z) => [ox + (x - this.mapB.minX) * s, oz + (z - this.mapB.minZ) * s];
      if (state.route && state.route.length > 1) { cx.strokeStyle = '#f0d27c'; cx.lineWidth = 4; cx.beginPath(); state.route.forEach((p, i) => { const [x, y] = P(p[0], p[1]); if (i) cx.lineTo(x, y); else cx.moveTo(x, y); }); cx.stroke(); }
      cx.textAlign = 'center'; cx.textBaseline = 'middle';
      for (const b of state.blips) { const [x, y] = P(b.x, b.z); if (b.glyph || b.icon) { if (b.glyph) { cx.fillStyle = b.color || '#33443d'; cx.beginPath(); cx.arc(x, y, 10, 0, 7); cx.fill(); cx.strokeStyle = '#f2ede1'; cx.lineWidth = 1.5; cx.stroke(); drawIcon(cx, b.glyph, x, y, 13, '#fff', 1.7); } else { cx.font = "18px 'Segoe UI Emoji',sans-serif"; cx.fillText(b.icon, x, y); } if (b.label && s > 0.9) { cx.font = "600 12px 'Sarabun'"; cx.fillStyle = '#fff'; cx.strokeStyle = 'rgba(0,0,0,.7)'; cx.lineWidth = 3; cx.strokeText(b.label, x, y + 16); cx.fillText(b.label, x, y + 16); } } else { cx.fillStyle = b.color || '#fff'; cx.beginPath(); cx.arc(x, y, 5, 0, 7); cx.fill(); } }
      const [px, py] = P(state.px, state.pz); cx.fillStyle = '#f2ede1'; cx.strokeStyle = '#00704f'; cx.lineWidth = 3; cx.beginPath(); cx.arc(px, py, 8, 0, 7); cx.fill(); cx.stroke();
      if (state.wp) { const [wx, wy] = P(state.wp.x, state.wp.z); cx.fillStyle = '#d8b04a'; cx.beginPath(); cx.arc(wx, wy - 14, 11, 0, 7); cx.fill(); drawIcon(cx, 'pin', wx, wy - 14, 15, '#1d1a0e', 2); }
      requestAnimationFrame(draw);
    };
    let drag = null, moved = false;
    cv.onmousedown = (e) => { drag = [e.clientX, e.clientY]; moved = false; };
    cv.onmousemove = (e) => { if (!drag) return; const dx = e.clientX - drag[0], dy = e.clientY - drag[1]; if (Math.abs(dx) + Math.abs(dy) > 3) moved = true; view.x -= dx / view.s; view.z -= dy / view.s; drag = [e.clientX, e.clientY]; };
    cv.onmouseup = (e) => { if (!moved) { const W = cv.width, H = cv.height; const x = view.x + (e.clientX - W / 2) / view.s, z = view.z + (e.clientY - H / 2) / view.s; onPick(x, z); } drag = null; };
    cv.onwheel = (e) => { view.s = Math.max(0.25, Math.min(4, view.s * (e.deltaY > 0 ? 0.85 : 1.18))); e.preventDefault(); };
    let pinch = null;
    cv.ontouchstart = (e) => { if (e.touches.length === 2) { pinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); moved = true; return; } const t = e.touches[0]; drag = [t.clientX, t.clientY]; moved = false; };
    cv.ontouchmove = (e) => { e.preventDefault(); if (e.touches.length === 2 && pinch) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); view.s = Math.max(0.25, Math.min(4, view.s * d / pinch)); pinch = d; return; } const t = e.touches[0]; cv.onmousemove({ clientX: t.clientX, clientY: t.clientY }); };
    cv.ontouchend = (e) => { if (pinch) { if (!e.touches.length) { pinch = null; drag = null; } return; } const t = e.changedTouches[0]; cv.onmouseup({ clientX: t.clientX, clientY: t.clientY }); };
    const zb = (id, k) => { const b = $(id); if (b) b.onclick = (e) => { e.stopPropagation(); view.s = Math.max(0.25, Math.min(4, view.s * k)); }; };
    zb('bmIn', 1.3); zb('bmOut', 1 / 1.3); { const c = $('bmClose'); if (c) c.onclick = (e) => { e.stopPropagation(); this.closeMap(); }; }
    draw();
  }
  closeMap() { this.mapOpen = false; $('bigmap').classList.add('hidden'); }
}
