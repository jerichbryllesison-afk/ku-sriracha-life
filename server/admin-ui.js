// KU Sriracha Life — owner trainer UI. Served by the server ONLY to a session unlocked with the admin key
// (one-time URL). It is not part of /public and is never sent to normal players.
// Every server-side action here is validated again on the server and written to admin_log.
export default async function mount(G, opts = {}) {
  if (window.__kTrainer) { window.__kTrainer.show(); return; }
  const cat = await import('/shared/catalog.js');
  const { game, player, net, ui, world } = G;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => '฿' + Math.round(n).toLocaleString('en-US');
  const toast = (t, k) => ui.toast(t, k);
  const rpc = async (op, d = {}) => { const r = await net.rpc('adm', { op, ...d }, 15000); if (!r.ok && r.err) toast('🛠 ' + r.err, 'bad'); return r; };
  if (opts.text && opts.remember !== false) { try { localStorage.setItem('kusl_ext', opts.text); } catch (e) { } }

  // ---------- local (this device only) cheats ----------
  const st = { god: false, fuel: false, speed: 1, jump: 1, coords: false, hour: null, weather: '' };
  const tick = setInterval(() => {
    const p = game.profile; if (!p) return;
    if (st.god) for (const k of ['health', 'energy', 'hunger', 'mood']) p.stats[k] = 100;
    if (st.fuel) { const v = player.vehicle; if (v) v.fuel = 1; for (const pv of p.vehicles) pv.fuel = 1; }
    player.speedMul = st.speed; player.jumpMul = st.jump;
    const v = player.vehicle;
    if (v && v.spec) { if (!v._kBase) v._kBase = { top: v.spec.top, accel: v.spec.accel }; v.spec.top = v._kBase.top * st.speed; v.spec.accel = v._kBase.accel * Math.min(3, st.speed); }
    if (st.coords) coordsEl.textContent = `x ${player.pos.x.toFixed(1)} · z ${player.pos.z.toFixed(1)} · y ${player.pos.y.toFixed(1)}`;
  }, 250);

  // ---------- panel ----------
  const css = document.createElement('style');
  css.textContent = `#kT{position:fixed;top:64px;right:12px;width:min(380px,92vw);max-height:78vh;display:flex;flex-direction:column;background:rgba(14,18,26,.94);color:#e8eef6;border:1px solid #f5b94255;border-radius:14px;font:13px/1.35 system-ui,sans-serif;z-index:99990;box-shadow:0 10px 40px #0008;backdrop-filter:blur(8px)}
#kT.min{max-height:none}#kT.min .kb{display:none}#kT header{display:flex;align-items:center;gap:8px;padding:9px 12px;cursor:move;border-bottom:1px solid #ffffff18;user-select:none}
#kT header b{flex:1;color:#f5b942}#kT header button{background:none;border:0;color:#fff;font-size:16px;cursor:pointer;padding:2px 6px}
#kT nav{display:flex;gap:4px;padding:6px 8px;border-bottom:1px solid #ffffff12}#kT nav button{flex:1;background:#ffffff10;border:0;color:#cfd8e3;border-radius:8px;padding:6px 4px;cursor:pointer}
#kT nav button.on{background:#f5b942;color:#1a1a1a;font-weight:600}.kb{overflow:auto;padding:8px 10px 12px}.kc{background:#ffffff0b;border-radius:10px;padding:8px;margin:6px 0}
.kc h5{margin:0 0 6px;font-size:12px;color:#9fb0c4;text-transform:uppercase;letter-spacing:.04em}.kr{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:4px 0}
#kT .b{background:#2b3a52;border:0;color:#fff;border-radius:8px;padding:6px 9px;cursor:pointer;font-size:12px}#kT .b:hover{background:#3b5072}#kT .b.g{background:#b8860b}#kT .b.r{background:#8e2b2b}
#kT .b.on{background:#2e8b57}#kT input,#kT select{background:#0c1118;color:#fff;border:1px solid #ffffff26;border-radius:8px;padding:5px 7px;font-size:12px;min-width:0}
#kT .pl{display:flex;justify-content:space-between;gap:6px;align-items:center;padding:6px 0;border-bottom:1px solid #ffffff10}#kT small{color:#8a9bb0}
#kTc{position:fixed;left:50%;top:8px;transform:translateX(-50%);background:#000a;color:#fff;font:12px monospace;padding:3px 8px;border-radius:6px;z-index:99989;pointer-events:none}
#kTb{position:fixed;right:12px;top:64px;width:38px;height:38px;border-radius:50%;border:1px solid #f5b94288;background:#141a24e6;color:#f5b942;font-size:18px;z-index:99990;cursor:pointer;display:none}`;
  document.head.appendChild(css);
  const coordsEl = document.createElement('div'); coordsEl.id = 'kTc'; coordsEl.style.display = 'none'; document.body.appendChild(coordsEl);
  const el = document.createElement('div'); el.id = 'kT';
  el.innerHTML = `<header><b>🛠 Owner Trainer</b><button data-a="min" title="minimise">–</button><button data-a="close" title="hide (F8)">×</button></header>
  <nav><button data-t="me" class="on">ตัวเอง</button><button data-t="world">โลก</button><button data-t="players">ผู้เล่น</button><button data-t="log">Log</button><button data-t="server">เซิร์ฟเวอร์</button></nav><div class="kb"></div>`;
  document.body.appendChild(el);
  const fab = document.createElement('button'); fab.id = 'kTb'; fab.textContent = '🛠'; document.body.appendChild(fab);
  const body = el.querySelector('.kb'); let tab = 'me';
  const show = () => { el.style.display = ''; fab.style.display = 'none'; render(); };
  const hide = () => { el.style.display = 'none'; fab.style.display = 'block'; };
  fab.onclick = show;
  el.querySelector('[data-a=close]').onclick = hide; el.querySelector('[data-a=min]').onclick = () => el.classList.toggle('min');
  el.querySelectorAll('nav button').forEach(b => b.onclick = () => { tab = b.dataset.t; el.querySelectorAll('nav button').forEach(x => x.classList.toggle('on', x === b)); render(); });
  addEventListener('keydown', (e) => { if (e.code === 'F8') { e.preventDefault(); el.style.display === 'none' ? show() : hide(); } });
  // stop game input while typing in the panel
  el.addEventListener('keydown', (e) => e.stopPropagation()); el.addEventListener('focusin', () => { if (G.input) G.input.typing = true; }); el.addEventListener('focusout', () => { if (G.input) G.input.typing = false; });
  { let drag = null; const h = el.querySelector('header'); h.addEventListener('pointerdown', (e) => { if (e.target.tagName === 'BUTTON') return; drag = [e.clientX - el.offsetLeft, e.clientY - el.offsetTop]; h.setPointerCapture(e.pointerId); }); h.addEventListener('pointermove', (e) => { if (!drag) return; el.style.left = Math.max(0, e.clientX - drag[0]) + 'px'; el.style.top = Math.max(0, e.clientY - drag[1]) + 'px'; el.style.right = 'auto'; }); h.addEventListener('pointerup', () => { drag = null; }); }

  const opt = (list, sel) => list.map(([v, l]) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(l)}</option>`).join('');
  const items = Object.entries(cat.ITEMS).map(([id, it]) => [id, `${it.icon || ''} ${it.th || it.name}`]);
  const vehs = Object.entries(cat.VEHICLES).map(([id, v]) => [id, `${v.name} (${fmt(v.price)})`]);
  const places = Object.values(world.places || {}).filter(p => p._door).map(p => [p.id, p.th ? `${p.th} · ${p.name}` : p.name]).sort((a, b) => a[1].localeCompare(b[1]));
  const $ = (s) => body.querySelector(s);
  const on = (s, fn) => { const n = body.querySelector(s); if (n) n.onclick = fn; };

  async function render() {
    const p = game.profile;
    if (tab === 'me') {
      body.innerHTML = `
      <div class="kc"><h5>เงิน · Money</h5><div class="kr"><b>${fmt(p.money)}</b></div>
        <div class="kr"><button class="b g" data-m="10000">+10K</button><button class="b g" data-m="100000">+100K</button><button class="b g" data-m="1000000">+1M</button><button class="b g" data-m="10000000">+10M</button></div>
        <div class="kr"><input id="kMv" type="number" min="0" placeholder="จำนวน" style="width:120px"><button class="b" id="kMset">ตั้งค่า (set)</button><button class="b" id="kMadd">เพิ่ม</button><button class="b r" id="kMtake">ลด</button></div></div>
      <div class="kc"><h5>เลเวล · XP</h5><div class="kr">Lv <b>${p.level}</b> · XP ${p.xp}</div>
        <div class="kr"><button class="b" data-x="500">+500 XP</button><button class="b" data-x="5000">+5,000 XP</button><input id="kLv" type="number" min="1" max="60" value="${p.level}" style="width:64px"><button class="b" id="kLvSet">ตั้งเลเวล</button></div></div>
      <div class="kc"><h5>โกงในเครื่องนี้ · Local</h5>
        <div class="kr"><button class="b ${st.god ? 'on' : ''}" id="kGod">อมตะ (God)</button><button class="b ${st.fuel ? 'on' : ''}" id="kFuel">น้ำมันไม่จำกัด</button><button class="b ${st.coords ? 'on' : ''}" id="kCo">พิกัด</button><button class="b" id="kHeal">ฟื้นพลัง</button></div>
        <div class="kr">ความเร็ว <select id="kSpd">${opt([[1, '×1'], [1.5, '×1.5'], [2, '×2'], [3, '×3'], [5, '×5']].map(([a, b]) => [String(a), b]), String(st.speed))}</select> กระโดด <select id="kJmp">${opt([[1, '×1'], [1.6, '×1.6'], [2.5, '×2.5'], [4, '×4']].map(([a, b]) => [String(a), b]), String(st.jump))}</select></div></div>
      <div class="kc"><h5>ของ · Items & unlocks</h5>
        <div class="kr"><select id="kIt" style="flex:1">${opt(items)}</select><input id="kItQ" type="number" value="5" min="1" max="999" style="width:56px"><button class="b" id="kItG">ให้</button></div>
        <div class="kr"><select id="kVe" style="flex:1">${opt(vehs)}</select><button class="b" id="kVeG">รับรถ (เป็นเจ้าของ)</button><button class="b" id="kVeS">เรียกรถชั่วคราว</button></div>
        <div class="kr"><button class="b" id="kUnl">ปลดล็อกเสื้อผ้า + ทรงผมทั้งหมด</button></div></div>
      <div class="kc"><h5>ภารกิจ · Quests</h5><div class="kr">เควสหลัก #${p.quests.main + 1}<button class="b" id="kQn">ข้ามเควสนี้</button><button class="b" id="kQr">เริ่มเควสใหม่</button></div></div>
      <div class="kc"><h5>ชื่อ · Name</h5><div class="kr"><input id="kNm" value="${esc(p.name)}" maxlength="18" style="flex:1"><button class="b" id="kNmS">เปลี่ยนทันที</button></div></div>`;
      body.querySelectorAll('[data-m]').forEach(b => b.onclick = async () => { await rpc('money', { t: 'me', mode: 'add', amount: +b.dataset.m }); setTimeout(render, 150); });
      const mv = () => Math.max(0, Math.floor(+$('#kMv').value || 0));
      on('#kMset', async () => { await rpc('money', { t: 'me', mode: 'set', amount: mv() }); setTimeout(render, 150); });
      on('#kMadd', async () => { await rpc('money', { t: 'me', mode: 'add', amount: mv() }); setTimeout(render, 150); });
      on('#kMtake', async () => { await rpc('money', { t: 'me', mode: 'take', amount: mv() }); setTimeout(render, 150); });
      body.querySelectorAll('[data-x]').forEach(b => b.onclick = async () => { await rpc('xp', { t: 'me', n: +b.dataset.x }); setTimeout(render, 150); });
      on('#kLvSet', async () => { await rpc('level', { t: 'me', level: +$('#kLv').value }); setTimeout(render, 150); });
      on('#kGod', () => { st.god = !st.god; render(); }); on('#kFuel', () => { st.fuel = !st.fuel; render(); });
      on('#kCo', () => { st.coords = !st.coords; coordsEl.style.display = st.coords ? '' : 'none'; render(); });
      on('#kHeal', () => { for (const k of ['health', 'energy', 'hunger', 'mood']) p.stats[k] = 100; toast('💚 100%'); });
      $('#kSpd').onchange = (e) => { st.speed = +e.target.value; const v = player.vehicle; if (v && v._kBase) { v.spec.top = v._kBase.top; v.spec.accel = v._kBase.accel; } };
      $('#kJmp').onchange = (e) => { st.jump = +e.target.value; };
      on('#kItG', async () => { await rpc('give', { t: 'me', kind: 'item', id: $('#kIt').value, qty: +$('#kItQ').value || 1 }); });
      on('#kVeG', async () => { const id = $('#kVe').value; const r = await rpc('give', { t: 'me', kind: 'vehicle', id }); if (r.ok) setTimeout(() => { const list = game.profile.vehicles; const def = list[list.length - 1]; if (def) game.spawnVehicle({ ...def, slot: list.length - 1 }); }, 300); });
      on('#kVeS', () => { const id = $('#kVe').value; game.spawnVehicle({ type: id, color: cat.VEHICLES[id].colors[0], fuel: 1, temp: true }, true); });
      on('#kUnl', async () => { const r = await rpc('unlock', { t: 'me' }); if (r.ok) toast('👕 Unlocked'); });
      on('#kQn', async () => { await rpc('quest', { t: 'me', main: p.quests.main + 1 }); setTimeout(render, 150); });
      on('#kQr', async () => { await rpc('quest', { t: 'me', main: 0 }); setTimeout(render, 150); });
      on('#kNmS', async () => { const r = await rpc('rename', { t: 'me', name: $('#kNm').value }); if (r.ok) toast('✏️ ' + r.name); });
    } else if (tab === 'world') {
      body.innerHTML = `
      <div class="kc"><h5>วาร์ป · Teleport</h5>
        <div class="kr"><select id="kPl" style="flex:1">${opt(places)}</select><button class="b g" id="kPlG">ไป</button></div>
        <div class="kr"><button class="b" id="kWp">ไปจุด GPS / เป้าหมาย</button><button class="b" id="kSp">จุดเกิด</button></div>
        <div class="kr">x <input id="kX" type="number" style="width:80px" value="${Math.round(player.pos.x)}"> z <input id="kZ" type="number" style="width:80px" value="${Math.round(player.pos.z)}"><button class="b" id="kXZ">ไป</button></div></div>
      <div class="kc"><h5>เวลา · Time (เฉพาะเครื่องนี้)</h5><div class="kr"><input id="kH" type="range" min="6.75" max="17.6" step="0.05" value="${st.hour ?? game.time().hour}" style="flex:1"><b id="kHv">${st.hour == null ? 'auto' : st.hour.toFixed(2)}</b><button class="b" id="kHa">อัตโนมัติ</button></div>
        <div class="kr"><button class="b" data-h="7">07:00</button><button class="b" data-h="9.5">09:30</button><button class="b" data-h="12">12:00</button><button class="b" data-h="15">15:00</button><button class="b" data-h="17.2">17:12</button></div></div>
      <div class="kc"><h5>อากาศ · Weather (เฉพาะเครื่องนี้)</h5><div class="kr">${['', 'clear', 'cloudy'].map(w => `<button class="b ${st.weather === w ? 'on' : ''}" data-w="${w}">${w || 'auto'}</button>`).join('')}</div></div>`;
      on('#kPlG', () => { const pl = world.places[$('#kPl').value]; if (pl) { player.teleport(pl._door.x + pl._door.nx * 3, pl._door.z + pl._door.nz * 3); toast('🌀 ' + (pl.th || pl.name)); } });
      on('#kWp', () => { const o = game.currentObjective && game.currentObjective(); const t = game.waypoint || (o && o.target); if (!t) return toast('No waypoint'); player.teleport(t.x + 2, t.z + 2); });
      on('#kSp', () => player.teleport(world.spawn.x, world.spawn.z));
      on('#kXZ', () => { const x = +$('#kX').value, z = +$('#kZ').value; if (Number.isFinite(x) && Number.isFinite(z)) player.teleport(x, z); });
      const setH = (h) => { st.hour = h; if (h == null) delete window.__hour; else window.__hour = h; render(); };
      $('#kH').oninput = (e) => { st.hour = +e.target.value; window.__hour = st.hour; $('#kHv').textContent = st.hour.toFixed(2); };
      on('#kHa', () => setH(null)); body.querySelectorAll('[data-h]').forEach(b => b.onclick = () => setH(+b.dataset.h));
      body.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { st.weather = b.dataset.w; window.__weather = st.weather || undefined; render(); });
    } else if (tab === 'players') {
      body.innerHTML = `<div class="kc"><h5>ออนไลน์ · Online</h5><div id="kPL"><small>loading…</small></div></div>
      <div class="kc"><h5>ค้นหาบัญชี (รวมออฟไลน์)</h5><div class="kr"><input id="kQ" placeholder="ชื่อ" style="flex:1"><button class="b" id="kQs">ค้นหา</button></div><div id="kQL"></div></div>
      <div class="kc" id="kIn" style="display:none"></div>`;
      const r = await rpc('players'); if (!r.ok || tab !== 'players') return;
      const row = (x, online) => `<div class="pl"><span><b>${esc(x.name)}</b> <small>Lv ${x.level} · ${fmt(x.money)}${x.pos ? ` · ${x.pos[0]},${x.pos[1]}` : ''}${x.admin ? ' · 🛠' : ''}${x.banned ? ' · BANNED' : ''}</small></span><span class="kr">
        <button class="b" data-i="${x.acc || x.id}">ดู</button>${online && x.pos ? `<button class="b" data-go="${x.pos}">ไปหา</button><button class="b" data-br="${x.acc}">ดึงมา</button>` : ''}</span></div>`;
      $('#kPL').innerHTML = r.list.map(x => row(x, true)).join('') || '<small>—</small>';
      const wire = () => {
        body.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { const [x, z] = b.dataset.go.split(',').map(Number); player.teleport(x + 2, z + 2); });
        body.querySelectorAll('[data-br]').forEach(b => b.onclick = () => rpc('bring', { t: b.dataset.br }));
        body.querySelectorAll('[data-i]').forEach(b => b.onclick = () => inspect(b.dataset.i));
      };
      wire();
      on('#kQs', async () => { const q = await rpc('find', { q: $('#kQ').value }); if (q.ok) { $('#kQL').innerHTML = q.list.map(x => row({ ...x, acc: x.id }, false)).join('') || '<small>ไม่พบ</small>'; wire(); } });
    } else if (tab === 'log') {
      body.innerHTML = `<div class="kc"><h5>Player log (เวลาไทย)</h5><div class="kr"><button class="b g" id="kLogDl">⬇️ ดาวน์โหลด Player Log (CSV / Excel)</button></div><small>ไฟล์รายวันเดือนนี้ก็ถูกเขียนไว้ที่ data/logs/ บนเครื่องเซิร์ฟเวอร์ด้วย</small></div><div class="kc"><h5>ผู้เล่นทั้งหมด</h5><div id="kPS"><small>…</small></div></div><div class="kc"><h5>เข้า–ออกล่าสุด</h5><div id="kSS"><small>…</small></div></div>`;
      on('#kLogDl', async () => { const t = await rpc('logticket'); if (t.ok) { const a = document.createElement('a'); a.href = t.url; a.download = ''; document.body.appendChild(a); a.click(); a.remove(); toast('⬇️ กำลังดาวน์โหลด log'); } });
      const r = await rpc('playerlog'); if (!r.ok || tab !== 'log') return;
      const bkk = (ms) => ms ? new Date(ms).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'short' }) : '—';
      $('#kPS').innerHTML = r.players.map(x => `<div class="pl"><span><b>${esc(x.name)}</b> <small>Lv ${x.level} · ${fmt(x.money)} · เล่นรวม ${Math.round(x.play / 60)} นาที · ${x.sessions} ครั้ง</small></span><small>${bkk(x.last)}</small></div>`).join('') || '<small>—</small>';
      $('#kSS').innerHTML = r.sessions.slice(0, 60).map(x => { const end = x.ended_at || x.last_seen_at; return `<div class="pl"><span><b>${esc(x.name || '?')}</b> <small>${bkk(x.started_at)} → ${x.ended_at ? bkk(x.ended_at) : '🟢 ออนไลน์'} · ${((end - x.started_at) / 60000).toFixed(1)} นาที</small></span><small>${esc(x.end_reason || '')}</small></div>`; }).join('') || '<small>—</small>';
    } else if (tab === 'server') {
      const r = await rpc('server'); if (!r.ok || tab !== 'server') return;
      const eph = !r.storage.persistent;
      body.innerHTML = `
      <div class="kc"><h5>สถานะ · Status</h5><div>Storage: <b style="color:${eph ? '#ff8a65' : '#7bd88f'}">${r.storage.mode.toUpperCase()}</b> (${esc(r.storage.host)}) · ${esc(r.engine)} ${esc(r.sqlite)}</div>
        <div><small>DB ${(r.dbBytes / 1024).toFixed(0)} KB · ${r.counts.characters} characters · ${r.counts.ledger} ledger rows · uptime ${Math.round(r.uptime / 60)} min · RAM ${r.mem} MB · ${r.players} online</small></div>
        ${eph ? `<div style="color:#ffb199;margin-top:6px">⚠️ ${esc(r.storage.warnings[0] || '')}</div>` : ''}</div>
      <div class="kc"><h5>สำรองข้อมูล · Backup</h5><div class="kr"><button class="b g" id="kDl">⬇️ ดาวน์โหลดไฟล์ฐานข้อมูล</button><button class="b" id="kBk">สำรองบนเซิร์ฟเวอร์</button><button class="b" id="kIc">ตรวจความถูกต้อง</button></div><div id="kBl"><small>…</small></div></div>
      <div class="kc"><h5>ประกาศ · Announce</h5><div class="kr"><input id="kAn" style="flex:1" maxlength="160" placeholder="ข้อความถึงทุกคน"><button class="b" id="kAs">ส่ง</button></div></div>
      <div class="kc"><h5>บันทึกแอดมิน · Admin log</h5><div id="kLg"><small>…</small></div></div>
      <div class="kc"><div class="kr"><button class="b r" id="kForget">ลืมคีย์บนอุปกรณ์นี้</button></div></div>`;
      const bl = await rpc('backups'); if (bl.ok && $('#kBl')) $('#kBl').innerHTML = bl.list.slice(0, 6).map(b => `<div><small>${esc(b.file)} · ${(b.bytes / 1024).toFixed(0)} KB</small></div>`).join('') || '<small>ยังไม่มี</small>';
      const lg = await rpc('log'); if (lg.ok && $('#kLg')) $('#kLg').innerHTML = lg.list.slice(0, 25).map(x => `<div><small>${new Date(x.at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })} · <b>${esc(x.action)}</b> ${esc(x.target || '')} ${esc((x.detail || '').slice(0, 80))}</small></div>`).join('');
      on('#kDl', async () => { const t = await rpc('ticket'); if (t.ok) { const a = document.createElement('a'); a.href = t.url; a.download = ''; document.body.appendChild(a); a.click(); a.remove(); toast('⬇️ กำลังดาวน์โหลด'); } });
      on('#kBk', async () => { const b = await rpc('backup'); if (b.ok) toast(`💾 ${b.backup.file} · verified`); if (b.warning) toast('⚠️ ' + b.warning, 'bad'); render(); });
      on('#kIc', async () => { const b = await rpc('integrity'); if (b.ok) toast(b.integrity ? '✅ integrity ok' : '❌ integrity FAILED', b.integrity ? '' : 'bad'); });
      on('#kAs', async () => { const t = $('#kAn').value.trim(); if (t) { await rpc('announce', { text: t }); $('#kAn').value = ''; } });
      on('#kForget', () => { try { localStorage.removeItem('kusl_ext'); } catch (e) { } toast('ลืมคีย์แล้ว — ต้องพิมพ์ /admin ใหม่ครั้งหน้า'); });
    }
  }
  async function inspect(t) {
    const r = await rpc('inspect', { t }); if (!r.ok) return; const box = $('#kIn'); if (!box) return; box.style.display = '';
    const pr = r.profile;
    box.innerHTML = `<h5>${esc(pr.name)} ${r.online ? '🟢' : '⚪'}</h5><div><small>${esc(t)} · Lv ${pr.level} · ${fmt(pr.money)} · playtime ${Math.round(r.playtime.total / 60)} min (active ${Math.round(r.playtime.active / 60)})</small></div>
      <div class="kr"><input id="kTm" type="number" placeholder="฿" style="width:100px"><button class="b g" id="kTa">เพิ่มเงิน</button><button class="b" id="kTs">ตั้งเงิน</button><button class="b" id="kTh">ฟื้นพลัง</button>${r.online ? '<button class="b r" id="kTk">เตะ</button>' : ''}<button class="b r" id="kTmu">ปิดแชท 10 นาที</button><button class="b r" id="kTb">${r.account && r.account.banned ? 'ปลดแบน' : 'แบน'}</button></div>
      <div><small>ล่าสุด: ${r.ledger.slice(0, 8).map(l => `${l.delta > 0 ? '+' : ''}${l.delta} ${esc(l.kind)}`).join(' · ')}</small></div>
      <div><small>เซสชัน: ${r.sessions.slice(0, 4).map(s => `${new Date(s.started_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}→${s.ended_at ? Math.round((s.ended_at - s.started_at) / 60000) + 'm ' + esc(s.end_reason) : 'online'}`).join(' · ')}</small></div>`;
    const amt = () => Math.max(0, Math.floor(+box.querySelector('#kTm').value || 0));
    box.querySelector('#kTa').onclick = () => rpc('money', { t, mode: 'add', amount: amt() }).then(() => inspect(t));
    box.querySelector('#kTs').onclick = () => rpc('money', { t, mode: 'set', amount: amt() }).then(() => inspect(t));
    box.querySelector('#kTh').onclick = () => rpc('heal', { t });
    const k = box.querySelector('#kTk'); if (k) k.onclick = () => rpc('kick', { t, reason: 'Kicked by admin' }).then(() => render());
    box.querySelector('#kTmu').onclick = () => rpc('mute', { t, minutes: 10 });
    box.querySelector('#kTb').onclick = () => rpc('ban', { t, on: !(r.account && r.account.banned), reason: 'admin' }).then(() => inspect(t));
  }
  window.__kTrainer = { show, hide, state: st, unmount() { clearInterval(tick); el.remove(); fab.remove(); coordsEl.remove(); css.remove(); player.speedMul = 1; player.jumpMul = 1; delete window.__kTrainer; } };
  render();
  toast('🛠 Owner trainer · F8');
}
