// The in-game smartphone and its apps.
import { ITEMS, JOBS, MAIN_QUESTS, SIDE_QUESTS, VEHICLES, FACULTIES, levelTitle, xpForLevel } from '../shared/catalog.js';
import { esc, fmt } from './ui.js';
import { icon } from './icons.js';

// [id, icon, label, accent]  accents grouped by purpose: social teal, travel sky, student-life gold, media coral, system grey
const A_SOC = '#6cc2ae', A_NAV = '#7fb2e6', A_LIFE = '#e0bd5c', A_MED = '#e9937a', A_SYS = '#b6c0bb';
const APPS = [
  ['chat', 'chat', 'Chat', A_SOC], ['map', 'map', 'Map', A_NAV], ['jobs', 'briefcase', 'Jobs', A_LIFE], ['quests', 'flag', 'Quests', A_LIFE],
  ['bank', 'bank', 'Bank', A_LIFE], ['profile', 'user', 'Profile', A_LIFE], ['bag', 'bag', 'Bag', A_LIFE], ['wardrobe', 'shirt', 'Wardrobe', A_LIFE],
  ['garage', 'car', 'Garage', A_NAV], ['eats', 'scooter', 'KU Eats', A_NAV], ['camera', 'camera', 'Camera', A_MED], ['radio', 'radio', 'Radio', A_MED],
  ['players', 'users', 'Players', A_SOC], ['flowers', 'flower', 'Nonsi', A_MED], ['settings', 'gear', 'Settings', A_SYS], ['help', 'help', 'Help', A_SYS],
];

export class Phone {
  constructor(game, deps) {
    this.G = game; Object.assign(this, deps); this.open = false; this.app = 'home';
    this.el = document.getElementById('phone'); this.screen = document.getElementById('phoneScreen');
    document.getElementById('phoneHome').onclick = () => this.show('home');
    this.screen.addEventListener('keydown', (e) => e.stopPropagation());
  }
  toggle() { this.open ? this.close() : this.openPhone(); }
  openPhone(app = 'home') { this.open = true; this.el.classList.remove('hidden'); this.G.audio.open(); this.show(app); if (this.G.player && !this.G.player.vehicle) this.G.player.emote = 'phone'; this.G.event('phone'); }
  close() { this.open = false; this.el.classList.add('hidden'); this.G.audio.close(); if (this.G.player && this.G.player.emote === 'phone') this.G.player.emote = null; if (this.input) this.input.typing = false; }
  head(title) { return `<div class="ph-head"><button data-back aria-label="Back">${icon('back')}</button><h3>${esc(title)}</h3></div>`; }
  bind() { this.screen.querySelectorAll('[data-back]').forEach(b => b.onclick = () => this.show('home')); this.screen.querySelectorAll('[data-app]').forEach(b => b.onclick = () => { this.G.audio.click(); this.show(b.dataset.app); }); }
  show(app) {
    this.app = app; const G = this.G, p = G.profile; const t = G.time(); const s = this.screen;
    if (this.input) this.input.typing = false;
    s.classList.toggle('home', app === 'home');
    const hh = String(Math.floor(t.hour)).padStart(2, '0') + ':' + String(Math.floor(t.hour % 1 * 60)).padStart(2, '0');
    if (app === 'home') {
      const w = G.weather(); const wi = w === 'rain' ? ['rain', 'Rain'] : w === 'cloudy' ? ['cloud', 'Cloudy'] : (t.hour > 18.5 || t.hour < 6 ? ['moon', 'Clear night'] : ['sun', 'Sunny']);
      const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const need = xpForLevel(p.level);
      s.innerHTML = `<div class="ph-clock"><b>${hh}</b><small>${DAYS[(t.day + 1) % 7]} · Week ${Math.floor((t.day % 112) / 7) + 1} · ${icon(wi[0])} ${wi[1]}</small></div>
      <div class="ph-widgets"><div class="ph-widget"><small>Wallet</small><b>${fmt(p.money)}</b><span>Student account</span></div><div class="ph-widget"><small>Level ${p.level}</small><b>${esc(levelTitle(p.level))}</b><span>${Math.round(p.xp)} / ${need} XP</span></div></div>
      <div class="apps">${APPS.map(([id, ic, name, c]) => `<button class="app" data-app="${id}"><span class="tile" style="--c:${c}">${icon(ic)}</span>${name}</button>`).join('')}</div>`;
    } else if (app === 'chat') {
      const msgs = (G.chatHistory || []).slice(-30);
      s.innerHTML = this.head(G.net.online ? 'Global chat · KU Sriracha' : 'Chat (offline)') + `<div class="ph-chat" id="phChat">${msgs.map(m => `<div class="m ${m.id === G.net.id ? 'me' : ''}">${m.sys ? '<i>' + esc(m.text) + '</i>' : `<b>${esc(m.name)}</b><br>${esc(m.text)}`}</div>`).join('') || '<p class="ph-empty">No messages yet. Say hi to the campus.</p>'}</div><div class="ph-input"><input id="phMsg" maxlength="140" placeholder="Message…"><button class="btn" id="phSend" aria-label="Send">${icon('send')}</button></div>`;
      const inp = s.querySelector('#phMsg'); inp.onfocus = () => { this.input.typing = true; }; inp.onblur = () => { this.input.typing = false; };
      const send = () => { const v = inp.value.trim(); if (v) { G.sendChat(v); inp.value = ''; setTimeout(() => this.show('chat'), 100); } };
      s.querySelector('#phSend').onclick = send; inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') send(); };
      s.scrollTop = 1e6;
    } else if (app === 'map') {
      s.innerHTML = this.head('Map & GPS') + `<p style="font-size:13px;color:var(--muted)">Open the full map to set a waypoint, or pick a place:</p><button class="btn wide" id="phBig">${icon('map')} Open full map</button><div style="margin-top:10px">${Object.values(G.world.places).sort((a, b) => (a.th || a.name).localeCompare(b.th || b.name)).map(pl => `<div class="card"><div class="row"><span><b>${esc(pl.th || pl.name)}</b><br><small style="color:var(--muted)">${esc(pl.name)}</small></span><button class="btn ghost" data-wp="${pl.id}">GPS</button></div></div>`).join('')}</div>`;
      s.querySelector('#phBig').onclick = () => { this.close(); G.openBigMap(); };
      s.querySelectorAll('[data-wp]').forEach(b => b.onclick = () => { const pl = G.world.places[b.dataset.wp]; G.waypoint = { x: pl._door.x, z: pl._door.z, name: pl.name }; G.ui.toast('📍 GPS set: ' + (pl.th || pl.name)); G.routeTimer = 0; });
    } else if (app === 'jobs') {
      s.innerHTML = this.head('Part-time jobs') + Object.entries(JOBS).map(([id, j]) => {
        const lock = p.level < j.level ? `Lv ${j.level}` : j.req ? Object.entries(j.req).filter(([k, v]) => p.skills[k] < v).map(([k, v]) => k.toUpperCase() + ' ' + v).join(' ') : '';
        const where = j.at === 'phone' ? 'Anywhere (this app)' : (G.world.places[j.at]?.th || j.at);
        return `<div class="card"><div class="row"><h4>${esc(j.name)}</h4>${lock ? `<span class="tag bad">${icon('lock')} ${lock}</span>` : `<span class="tag ok">${fmt(j.pay[0])}–${fmt(j.pay[1])}</span>`}</div><p>${esc(j.th)} · ${esc(j.desc)}</p><p style="color:var(--muted)">${icon('pin')} ${esc(where)}</p>${j.at === 'phone' ? `<button class="btn" data-start="${id}" ${lock ? 'disabled' : ''}>Start now</button>` : `<button class="btn ghost" data-wp="${j.at}">Set GPS</button>`}</div>`;
      }).join('');
      s.querySelectorAll('[data-wp]').forEach(b => b.onclick = () => { const pl = G.world.places[b.dataset.wp]; if (!pl) return; G.waypoint = { x: pl._door.x, z: pl._door.z }; G.routeTimer = 0; G.ui.toast('📍 GPS set'); });
      s.querySelectorAll('[data-start]').forEach(b => b.onclick = () => { this.close(); G.doJob(b.dataset.start); });
    } else if (app === 'quests') {
      const q = MAIN_QUESTS[p.quests.main]; const day = t.day; G.ensureDaily(day);
      s.innerHTML = this.head('Quests') + (G.task ? `<div class="card" style="border-color:var(--gold)"><div class="row"><h4>${esc(G.task.title)}</h4><button class="btn red" id="phCancel">Cancel</button></div><p>${esc(G.task.desc)}</p></div>` : '') +
        `<div class="ph-sec">Main story · ${p.quests.main}/${MAIN_QUESTS.length}</div>` + (q ? `<div class="card"><h4>${esc(q.title)}</h4><p>${esc(q.th)}</p><p>${esc(q.desc)}</p><p><span class="tag gold">+${q.xp} XP</span> ${q.money ? `<span class="tag ok">+${fmt(q.money)}</span>` : ''}</p></div>` : `<div class="card"><p>${icon('cap')} All main quests complete — you are a true KU Sriracha student.</p></div>`) +
        `<div class="ph-sec">Daily · resets every game day</div>` + G.dailyList(day).map(dq => { const pr = Math.min(dq.n, Math.round(p.quests.daily.prog[dq.id] || 0)); const done = p.quests.daily.done.includes(dq.id); return `<div class="card"><div class="row"><span><i class="check ${done ? 'on' : ''}">${done ? icon('check') : ''}</i>${esc(dq.title)}</span><span class="tag">${dq.type === 'distance' || dq.type === 'drive' ? Math.round(pr) + '/' + dq.n + ' m' : pr + '/' + dq.n}</span></div></div>`; }).join('') +
        `<div class="ph-sec">Side tasks</div>` + SIDE_QUESTS.map(sq => { const st = p.quests.side[sq.id]; const done = st && st.day === day && st.done; const from = G.world.places[sq.from]; return `<div class="card"><div class="row"><h4>${done ? '<i class="check on">' + icon('check') + '</i>' : ''}${esc(sq.title)}</h4><button class="btn ghost" data-wp="${sq.from}">GPS</button></div><p>${esc(sq.giver)} @ ${esc(from ? (from.th || from.name) : sq.from)}</p></div>`; }).join('');
      const c = s.querySelector('#phCancel'); if (c) c.onclick = () => { G.cancelTask(); this.show('quests'); };
      s.querySelectorAll('[data-wp]').forEach(b => b.onclick = () => { const pl = G.world.places[b.dataset.wp]; if (pl) { G.waypoint = { x: pl._door.x, z: pl._door.z }; G.routeTimer = 0; G.ui.toast('📍 GPS set'); } });
    } else if (app === 'bank') { this.close(); G.bankApp(); return; }
    else if (app === 'profile') {
      const f = FACULTIES.find(x => x.id === p.faculty) || FACULTIES[0]; const bar = (name, v) => `<div class="statrow"><span>${name}</span><div class="sb"><i style="width:${v}%"></i></div><b>${Math.floor(v)}</b></div>`;
      s.innerHTML = this.head('Profile') + `<div class="card"><h4>${esc(p.name)} · ${levelTitle(p.level)}</h4><p>${esc(f.th)}</p><p>${esc(p.program || f.programs[0])}</p><p>ID ${p.studentId} · Year ${p.year} · GPA <b>${(p.gpa || 0).toFixed(2)}</b></p><p>Level ${p.level} · XP ${Math.round(p.xp)}/${xpForLevel(p.level)}</p></div>
        <div class="card"><h4>Needs</h4>${bar(icon('heart') + 'Health', p.stats.health)}${bar(icon('bolt') + 'Energy', p.stats.energy)}${bar(icon('bowl') + 'Hunger', p.stats.hunger)}${bar(icon('smile') + 'Mood', p.stats.mood)}</div>
        <div class="card"><h4>Skills</h4>${bar(icon('book') + 'Intelligence', p.skills.int)}${bar(icon('dumbbell') + 'Fitness', p.skills.fit)}${bar(icon('users') + 'Charisma', p.skills.cha)}${bar(icon('car') + 'Driving', p.skills.drv)}</div>
        <div class="card"><h4>Life stats</h4><p>Meals ${p.counters.meals} · Jobs ${p.counters.jobs} · Classes ${p.classes} · Study ${p.counters.studies}</p><p>Run ${(p.counters.run / 1000).toFixed(1)} km · Driven ${(p.counters.drive / 1000).toFixed(1)} km · Flowers ${p.collected.length}/25</p><p>Clubs: ${p.clubs.join(', ') || '—'}</p></div>`;
    } else if (app === 'bag') {
      const inv = Object.entries(p.inventory).filter(([, n]) => n > 0);
      s.innerHTML = this.head('Bag') + (inv.length ? inv.map(([id, n]) => `<div class="card"><div class="row"><span>${ITEMS[id].icon} <b>${esc(ITEMS[id].th || ITEMS[id].name)}</b> ×${n}</span><button class="btn" data-use="${id}">Use</button></div></div>`).join('') : '<p class="ph-empty">Empty. Buy snacks at 7-Eleven or a mini-mart.</p>');
      s.querySelectorAll('[data-use]').forEach(b => b.onclick = () => { G.useItem(b.dataset.use); this.show('bag'); });
    } else if (app === 'wardrobe') { this.close(); G.wardrobe(); }
    else if (app === 'garage') {
      s.innerHTML = this.head('Garage') + (p.vehicles.length ? p.vehicles.map((v, i) => `<div class="card"><div class="row"><span><b>${esc(VEHICLES[v.type]?.name || v.type)}</b><br><small>${icon('fuel')} ${Math.round((v.fuel ?? 1) * 100)}%</small></span><span class="sw" style="display:inline-block;width:22px;height:22px;border-radius:50%;background:${v.color}"></span><button class="btn" data-call="${i}">Call</button></div></div>`).join('') : '<p class="ph-empty">No vehicles yet. Buy one at KU Moto or Siam Motors on Sukhumvit, rent a scooter, or borrow a free campus bicycle at the Facilities & Vehicles building.</p>') + (G.rental ? '<div class="card"><p>Rented scooter active</p><button class="btn" data-rent>Call rental</button></div>' : '');
      s.querySelectorAll('[data-call]').forEach(b => b.onclick = () => { this.close(); G.spawnVehicle({ ...p.vehicles[+b.dataset.call], slot: +b.dataset.call }); });
      const rb = s.querySelector('[data-rent]'); if (rb) rb.onclick = () => { this.close(); G.spawnVehicle({ type: 'wave', color: '#2c3e50', rental: true }); };
    } else if (app === 'eats') {
      s.innerHTML = this.head('KU Eats · ไรเดอร์') + `<div class="card"><h4>Delivery rider</h4><p>Pick up food from campus restaurants and deliver it around Sriracha. Faster delivery = bigger tips.</p><p>Tip: use a scooter or bicycle!</p></div><button class="btn big" id="phEat">${G.task ? 'Task in progress…' : 'Go online & accept order'}</button>`;
      s.querySelector('#phEat').onclick = () => { if (G.task) return; this.close(); G.doJob('delivery'); };
    } else if (app === 'camera') { this.close(); G.photoMode(true); }
    else if (app === 'radio') {
      const on = this.audio.radioOn;
      s.innerHTML = this.head('Radio · KU FM 99.5') + `<div class="card" style="text-align:center"><div style="font-size:56px;color:${on ? 'var(--gold-hi)' : 'var(--dim)'};margin:8px 0">${icon(on ? 'music' : 'radio')}</div><p>${on ? 'Now playing: Campus Afternoon · KU FM' : 'Radio off'}</p><button class="btn" id="phRadio">${on ? 'Turn off' : 'Turn on'}</button></div><label class="card" style="display:block">Music volume <input type="range" min="0" max="1" step="0.05" value="${this.audio.music}" id="phMv" style="width:100%"></label>`;
      s.querySelector('#phRadio').onclick = () => { this.audio.init(); this.audio.resume(); this.audio.bgm(!on); G.settings.musicOn = !on; G.saveSettings(); this.show('radio'); };
      s.querySelector('#phMv').oninput = (e) => { this.audio.setMusic(+e.target.value); G.settings.music = +e.target.value; G.saveSettings(); };
    } else if (app === 'players') {
      const list = [...G.remotes.map.values()];
      s.innerHTML = this.head(`Players online · ${list.length + 1}/100`) + `<div class="card"><div class="row"><span><b>${esc(p.name)}</b> <small style="color:var(--muted)">(you)</small></span><span class="tag">Lv ${p.level}</span></div></div>` + list.map(r => `<div class="card"><div class="row"><span><b>${esc(r.info.name)}</b><br><small>${Math.round(Math.hypot(r.x - G.player.pos.x, r.z - G.player.pos.z))} m away</small></span><span class="tag">Lv ${r.info.level || 1}</span></div><div class="row" style="margin-top:6px"><button class="btn ghost" data-gps="${r.id}">GPS</button><button class="btn" data-pay="${r.id}">Send ฿</button></div></div>`).join('') + (G.net.online ? '' : '<p class="ph-empty">Offline mode — start the server (npm start) to play online.</p>');
      s.querySelectorAll('[data-gps]').forEach(b => b.onclick = () => { const r = G.remotes.map.get(b.dataset.gps); if (r) { G.waypoint = { x: r.x, z: r.z }; G.routeTimer = 0; } });
      s.querySelectorAll('[data-pay]').forEach(b => b.onclick = () => { const amt = Math.floor(Number(prompt('Amount to send (฿)?', '100')) || 0); if (amt > 0) G.transfer(b.dataset.pay, amt).then(() => this.show('players')); });
    } else if (app === 'flowers') {
      s.innerHTML = this.head('Golden Nonsi Flowers') + `<div class="card"><p>The Nonsi (นนทรี) is Kasetsart University's symbol tree. 25 golden Nonsi flowers are hidden around the campus and Sriracha. Each one: +฿150 and XP.</p><h4>${p.collected.length} / 25 found</h4></div><div class="card"><p>Hint: ${['look near the stadium', 'try the front pond', 'the beach hides one', 'check behind faculty buildings', 'the hill has secrets', 'walk the dorm area'][t.day % 6]}.</p></div>`;
    } else if (app === 'settings') {
      const st = G.settings;
      const gx = G.gfx ? G.gfx() : { res: 100, level: 0, ao: true };
      s.innerHTML = this.head('Settings') + `<div class="card"><h4>Graphics · Maximum</h4><p>All effects run at maximum: 4K shadow maps, ambient occlusion, water reflections, dense grass and full-detail trees. FPS is capped at 60.</p><p style="color:var(--muted);font-size:12px">If your PC can't hold 60 FPS, the game lowers render resolution a little automatically, then restores it when it can. Current render scale: <b>${gx.res}%</b>${gx.level ? ' (auto-adjusted)' : ''}.</p><label style="display:flex;justify-content:space-between;margin-top:6px">Show FPS <input type="checkbox" id="stFps" ${st.fps ? 'checked' : ''}></label></div>
        <div class="card"><h4>Music</h4><label style="display:flex;justify-content:space-between;align-items:center">Background music <input type="checkbox" id="stMusic" ${st.musicOn ? 'checked' : ''}></label><label>Music volume <input type="range" min="0" max="1" step="0.05" value="${st.music}" id="stMv" style="width:100%"></label></div>
        <div class="card"><h4>Controls</h4><label>Mouse sensitivity <input type="range" min="0.0008" max="0.006" step="0.0002" value="${st.sens}" id="stSens" style="width:100%"></label><label style="display:flex;justify-content:space-between">Invert Y <input type="checkbox" id="stInv" ${st.invert ? 'checked' : ''}></label></div>
        <div class="card"><h4>Audio</h4><label>Volume <input type="range" min="0" max="1" step="0.05" value="${st.volume}" id="stVol" style="width:100%"></label></div>
        <div class="card"><h4>Account</h4><p style="font-size:12px;color:var(--muted)">Your save is linked to this browser.</p><button class="btn red" id="stReset">Reset character</button></div>`;
      s.querySelector('#stMusic').onchange = (e) => { st.musicOn = e.target.checked; this.audio.init(); this.audio.resume(); this.audio.bgm(st.musicOn); G.saveSettings(); };
      s.querySelector('#stMv').oninput = (e) => { st.music = +e.target.value; this.audio.setMusic(st.music); G.saveSettings(); };
      s.querySelector('#stFps').onchange = (e) => { st.fps = e.target.checked; G.saveSettings(); };
      s.querySelector('#stSens').oninput = (e) => { st.sens = +e.target.value; G.rig.sens = st.sens; G.saveSettings(); };
      s.querySelector('#stInv').onchange = (e) => { st.invert = e.target.checked; G.rig.invertY = st.invert; G.saveSettings(); };
      s.querySelector('#stVol').oninput = (e) => { st.volume = +e.target.value; this.audio.setVolume(st.volume); G.saveSettings(); };
      s.querySelector('#stReset').onclick = () => { if (confirm('Delete your character and start over? (online saves are kept on the server for this browser token — this creates a new token)')) { localStorage.removeItem('kusl_profile_v1'); localStorage.removeItem('kusl_token'); location.reload(); } };
    } else if (app === 'help') {
      s.innerHTML = this.head('How to play') + `<div class="card"><h4>Controls</h4><p><kbd>WASD</kbd> move · <kbd>Shift</kbd> sprint · <kbd>C</kbd> walk · <kbd>Space</kbd> jump / handbrake</p><p><kbd>E</kbd> interact · <kbd>F</kbd> enter/exit vehicle · <kbd>H</kbd> horn · <kbd>L</kbd> lights</p><p><kbd>P</kbd> phone · <kbd>M</kbd> map · <kbd>T</kbd> chat · <kbd>G</kbd> emotes · <kbd>V</kbd> camera · mouse wheel zoom</p></div>
      <div class="card"><h4>Student life</h4><p>Keep your needs up: eat at the cafeteria or a 7-Eleven / mini-mart, sleep at the dorm. Attend classes (08:00–17:00) for GPA & Intelligence, work part-time jobs for money, buy clothes, scooters and cars, join clubs and explore the real KU Sriracha map — from Sukhumvit Road to the hill viewpoint and the Ao Udom pier.</p></div>
      <div class="card"><h4>Online</h4><p>One shared world, up to 100 players. Chat with <kbd>T</kbd>, send money from the Players app, ride together and race on Sukhumvit!</p></div>`;
    }
    this.bind();
  }
}
