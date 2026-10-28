// Phone apps for the living-campus update (Messages, KU Feed, People, KU Ride, Home, My Shop) and the gameplay flows
// behind them (ride driving, deliveries anywhere on the map, own stall, player food orders, hailing a ride, homes).
// Money, wages, orders and ownership are always decided by the server (see server/life.js, server/social.js).
import { ITEMS, SHOPS, HOUSING, HOUSING_TIER, BUSINESSES, MENU_NAMES, ORDER_KINDS, FACULTIES, JOBS, levelTitle, ONLINE_SHOP, CLOTHES, VEHICLES, CAMPUS_EVENTS } from '../shared/catalog.js';
import { esc, fmt } from './ui.js';
import { L2, tr } from './i18n.js';
import { rid } from './net.js';
import { aboutOf, rideLine, foodNote, personName } from './society.js';
import { runMinigame } from './minigames.js';

export const EXT_APPS = new Set(['msg', 'feed', 'people', 'ride', 'house', 'biz', 'shop']);
const ago = (t) => { const s = Math.max(1, Math.round((Date.now() - t) / 1000)); return s < 60 ? L2(`${s}s`, `${s} วิ`) : s < 3600 ? L2(`${Math.round(s / 60)}m`, `${Math.round(s / 60)} นาที`) : s < 86400 ? L2(`${Math.round(s / 3600)}h`, `${Math.round(s / 3600)} ชม.`) : L2(`${Math.round(s / 86400)}d`, `${Math.round(s / 86400)} วัน`); };
const facName = (id) => { const f = FACULTIES.find(x => x.id === id); return f ? L2(f.name, f.th) : id; };
const cname = (c) => c.en ? L2(c.en, c.name) : c.name;
const TIER_T = (t) => t ? L2(HOUSING_TIER[t][0], HOUSING_TIER[t][1]) : '';
const pname = (G, id) => { const p = G.world.places[id]; return p ? (p.th ? L2(p.name, p.th) : p.name) : id; };

// ---------------------------------------------------------------------------------------------------------------
export function renderApp(ph, app) {
  const G = ph.G, s = ph.screen, p = G.profile; const [base, arg] = app.split(':');
  const on = (sel, fn) => { const n = s.querySelector(sel); if (n) n.onclick = fn; };
  const all = (sel, fn) => s.querySelectorAll(sel).forEach(b => b.onclick = () => fn(b));
  const online = G.net.online;
  const offlineCard = `<p class="ph-empty">${L2('Needs the online server.', 'ต้องเชื่อมต่อเซิร์ฟเวอร์ออนไลน์')}</p>`;

  // ---------------- Messages ----------------
  if (base === 'msg') {
    const SO = G.society;
    if (arg && arg.startsWith('u_')) { // player DM thread
      const uid = arg.slice(2); s.innerHTML = ph.head(L2('Chat', 'แชท')) + `<div class="ph-chat" id="dmT"><p class="ph-empty">…</p></div><div class="ph-input"><input id="dmIn" maxlength="300" placeholder="${L2('Message…', 'พิมพ์ข้อความ…')}"><button class="btn" id="dmSend">${L2('Send', 'ส่ง')}</button></div>`;
      const load = async () => { const r = await G.net.rpc('soc', { op: 'thread', uid }); if (ph.app !== app) return; s.querySelector('.ph-head h3').textContent = (r.name || '') + (r.online ? ' · 🟢' : ''); s.querySelector('#dmT').innerHTML = (r.list || []).map(m => `<div class="m ${m.mine ? 'me' : ''}"><span>${esc(m.text)}</span><small>${ago(m.t)}</small></div>`).join('') || `<p class="ph-empty">${L2('Say hello 👋', 'ทักทายกันหน่อย 👋')}</p>`; s.querySelector('#dmT').scrollTop = 1e6; G.notifier.clear('msg'); };
      load(); ph.reloadDM = (u) => { if (u === uid && ph.app === app) load(); };
      const inp = s.querySelector('#dmIn'); inp.onfocus = () => { if (ph.input) ph.input.typing = true; }; inp.onblur = () => { if (ph.input) ph.input.typing = false; };
      const send = async () => { const v = inp.value.trim(); if (!v) return; inp.value = ''; const r = await G.net.rpc('soc', { op: 'dm', uid, text: v }); if (!r.ok) G.ui.toast('❌ ' + tr(r.err || 'Failed'), 'bad'); load(); };
      on('#dmSend', send); inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') send(); };
      return;
    }
    if (arg && SO.byId[arg]) { // NPC thread
      const c = SO.byId[arg]; SO.markRead(arg); const T = SO.thread(arg); const pend = SO.S.pend[arg];
      s.innerHTML = ph.head(cname(c)) + `<div class="card ct"><div class="ct-av">${c.icon}</div><div><b>${esc(cname(c))}</b><p>${esc(aboutOf(c))}</p><small>${L2('Closeness', 'ความสนิท')} ${'❤'.repeat(Math.max(1, Math.round((SO.S.rel[arg] || 50) / 20)))}</small></div></div>
        <div class="ph-chat">${T.map(m => `<div class="m ${m.me ? 'me' : ''}"><span>${esc(SO.text(m))}</span><small>${ago(m.t)}</small></div>`).join('') || `<p class="ph-empty">${L2('No messages yet', 'ยังไม่มีข้อความ')}</p>`}</div>
        ${pend ? `<div class="ph-choices">${pend.map((o, k) => `<button class="btn ghost" data-k="${k}">${esc(L2(o.en, o.th))}</button>`).join('')}</div>` : ''}`;
      all('[data-k]', (b) => { SO.reply(arg, +b.dataset.k); ph.show(app); });
      const ch = s.querySelector('.ph-chat'); if (ch) ch.scrollTop = 1e6; return;
    }
    s.innerHTML = ph.head(L2('Messages', 'ข้อความ')) + `<div class="ph-sec">${L2('Family & friends', 'ครอบครัวและเพื่อน')}</div>` + SO.contacts.map(c => { const T = SO.thread(c.id), last = T[T.length - 1]; const u = SO.unread(c.id);
      return `<button class="card row lst" data-c="${c.id}"><span class="av">${c.icon}</span><span class="lm"><b>${esc(cname(c))}</b><small>${last ? esc(SO.text(last)).slice(0, 46) : esc(aboutOf(c)).slice(0, 46)}</small></span>${u ? `<i class="bdg">${u}</i>` : ''}</button>`; }).join('')
      + `<div class="ph-sec">${L2('Players', 'ผู้เล่น')}</div><div id="inb">${online ? '…' : offlineCard}</div>`;
    all('[data-c]', (b) => ph.show('msg:' + b.dataset.c));
    if (online) G.net.rpc('soc', { op: 'inbox' }).then(r => { if (ph.app !== 'msg') return; const box = s.querySelector('#inb'); box.innerHTML = (r.list || []).map(x => `<button class="card row lst" data-u="${x.id}"><span class="av">💬</span><span class="lm"><b>${esc(x.name)}${x.online ? ' 🟢' : ''}</b><small>${esc(x.last || '').slice(0, 46)}</small></span>${x.unread ? `<i class="bdg">${x.unread}</i>` : ''}</button>`).join('') || `<p class="ph-empty">${L2('Add friends in People to chat with other players.', 'เพิ่มเพื่อนในแอปเพื่อน เพื่อแชทกับผู้เล่นคนอื่น')}</p>`; box.querySelectorAll('[data-u]').forEach(b => b.onclick = () => ph.show('msg:u_' + b.dataset.u)); });
    G.notifier.clear('msg'); return;
  }

  // ---------------- KU Feed ----------------
  if (base === 'feed') {
    const tab = arg || 'players';
    s.innerHTML = ph.head('KU Feed') + `<div class="seg" id="fdTab"><button data-t="players" class="${tab === 'players' ? 'on' : ''}">${L2('Players', 'ผู้เล่น')}</button><button data-t="npc" class="${tab === 'npc' ? 'on' : ''}">${L2('Friends (NPC)', 'เพื่อนในเกม')}</button></div>`
      + (tab === 'players' ? (online ? `<div class="card"><textarea id="fdTxt" maxlength="400" rows="2" placeholder="${L2('What\'s happening on campus?', 'วันนี้เป็นไงบ้าง?')}"></textarea>${G._postPhoto ? `<img class="fd-prev" src="${G._postPhoto}">` : ''}<div class="row" style="margin-top:6px"><button class="btn ghost" id="fdCam">📷 ${G._postPhoto ? L2('Retake', 'ถ่ายใหม่') : L2('Photo', 'ถ่ายรูป')}</button><button class="btn ghost" id="fdLoc">📍 ${L2('Check in', 'เช็คอิน')}</button><button class="btn gold" id="fdPost">${L2('Post', 'โพสต์')}</button></div></div><div id="fdList"><p class="ph-empty">…</p></div>` : offlineCard)
      : G.society.S.feed.map(f => { const c = G.society.byId[f.who]; return c ? `<div class="card post"><div class="ph"><span class="av">${c.icon}</span><span><b>${esc(cname(c))}</b><small>${ago(f.t)} · NPC</small></span></div><p>${esc(f.text)}</p><button class="lk ${f.liked ? 'on' : ''}" data-nl="${f.id}">♥ ${f.likes + (f.liked ? 1 : 0)}</button></div>` : ''; }).join('') || `<p class="ph-empty">${L2('Your friends haven\'t posted yet.', 'เพื่อนยังไม่ได้โพสต์อะไร')}</p>`);
    all('#fdTab button', (b) => ph.show('feed:' + b.dataset.t));
    all('[data-nl]', (b) => { const f = G.society.S.feed.find(x => x.id === b.dataset.nl); if (f) { f.liked = !f.liked; G.audio.ping('social'); ph.show('feed:npc'); } });
    if (tab !== 'players' || !online) { G.notifier.clear('feed'); return; }
    const ta = s.querySelector('#fdTxt'); ta.onfocus = () => { if (ph.input) ph.input.typing = true; }; ta.onblur = () => { if (ph.input) ph.input.typing = false; }; ta.onkeydown = (e) => e.stopPropagation();
    if (G._postDraft) ta.value = G._postDraft; ta.oninput = () => { G._postDraft = ta.value; };
    on('#fdCam', () => { ph.close(); G.ui.toast(L2('📷 Smile! Taking a photo…', '📷 ยิ้ม! กำลังถ่ายรูป…')); setTimeout(() => G.snapPhoto((url) => { G._postPhoto = url; G.audio.ping('pick'); ph.openPhone('feed:players'); }), 900); });
    on('#fdLoc', () => { const a = G.areaName ? G.areaName() : ''; ta.value = (ta.value ? ta.value + ' ' : '') + '📍 ' + a; G._postDraft = ta.value; });
    on('#fdPost', async () => { const r = await G.net.rpc('soc', { op: 'post', text: ta.value, place: G.areaName ? G.areaName() : '', photo: G._postPhoto || undefined }, 15000); if (r.ok) { G._postDraft = ''; G._postPhoto = null; G.audio.ping('social'); G.event('talk'); ph.show('feed:players'); } else G.ui.toast('❌ ' + tr(r.err || 'Failed'), 'bad'); });
    const draw = (list) => {
      const box = s.querySelector('#fdList'); if (!box) return;
      box.innerHTML = list.map(x => `<div class="card post" data-p="${x.id}"><div class="ph"><span class="av">🎓</span><span><b>${esc(x.name)}</b><small>${esc(facName(x.faculty))} · Lv ${x.level} · ${ago(x.t)}${x.place ? ' · ' + esc(x.place) : ''}</small></span>${x.author === G.myUid ? `<button class="x" data-del="${x.id}">✕</button>` : `<button class="x" data-rep="${x.id}" title="${L2('Report', 'รายงาน')}">⚑</button>`}</div>
        ${x.text ? `<p>${esc(x.text)}</p>` : ''}${x.media ? `<img class="fd-img" loading="lazy" src="/media/${x.media}.jpg">` : ''}
        <div class="row"><button class="lk ${x.liked ? 'on' : ''}" data-like="${x.id}">♥ ${x.likes}</button><button class="lk" data-cm="${x.id}">💬 ${x.comments}</button></div><div class="cms" id="cm${x.id}"></div></div>`).join('') || `<p class="ph-empty">${L2('No posts yet — be the first!', 'ยังไม่มีโพสต์ — โพสต์เป็นคนแรกเลย!')}</p>`;
      box.querySelectorAll('[data-like]').forEach(b => b.onclick = async () => { const r = await G.net.rpc('soc', { op: 'like', id: +b.dataset.like }); if (r.ok) { b.classList.toggle('on', r.liked); b.textContent = '♥ ' + r.likes; G.audio.ping('social'); } });
      box.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (!confirm(L2('Delete this post?', 'ลบโพสต์นี้?'))) return; await G.net.rpc('soc', { op: 'delete', id: +b.dataset.del }); ph.show('feed:players'); });
      box.querySelectorAll('[data-rep]').forEach(b => b.onclick = async () => { if (!confirm(L2('Report this post as inappropriate?', 'รายงานโพสต์นี้ว่าไม่เหมาะสม?'))) return; await G.net.rpc('soc', { op: 'report', id: +b.dataset.rep }); G.ui.toast(L2('Thanks — reported', 'ขอบคุณ — รายงานแล้ว')); });
      box.querySelectorAll('[data-cm]').forEach(b => b.onclick = async () => {
        const id = +b.dataset.cm; const el = box.querySelector('#cm' + id); const r = await G.net.rpc('soc', { op: 'comments', id });
        const paint = (list) => { el.innerHTML = list.map(k => `<div class="cm"><b>${esc(k.name)}</b> ${esc(k.text)}</div>`).join('') + `<div class="ph-input"><input maxlength="240" placeholder="${L2('Comment…', 'แสดงความคิดเห็น…')}"><button class="btn">${L2('Send', 'ส่ง')}</button></div>`;
          const inp = el.querySelector('input'); inp.onfocus = () => { if (ph.input) ph.input.typing = true; }; inp.onblur = () => { if (ph.input) ph.input.typing = false; }; inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') go(); };
          const go = async () => { const v = inp.value.trim(); if (!v) return; const q = await G.net.rpc('soc', { op: 'comment', id, text: v }); if (q.ok) { paint(q.list); b.textContent = '💬 ' + q.list.length; } else G.ui.toast('❌ ' + tr(q.err || 'Failed'), 'bad'); };
          el.querySelector('button').onclick = go; };
        paint(r.list || []);
      });
    };
    G.net.rpc('soc', { op: 'feed' }).then(r => { if (ph.app === app || ph.app === 'feed') draw(r.list || []); });
    G.notifier.clear('feed'); return;
  }

  // ---------------- People (online players, friends, profiles) ----------------
  if (base === 'people') {
    if (!online) { s.innerHTML = ph.head(L2('People', 'เพื่อน')) + offlineCard; return; }
    if (arg && arg.startsWith('a')) { // profile
      s.innerHTML = ph.head(L2('Profile', 'โปรไฟล์')) + '<p class="ph-empty">…</p>';
      G.net.rpc('soc', { op: 'profile', uid: arg }).then(r => {
        if (ph.app !== app) return; if (!r.ok) { s.innerHTML = ph.head(L2('Profile', 'โปรไฟล์')) + `<p class="ph-empty">${esc(tr(r.err || ''))}</p>`; ph.bind(); return; }
        const x = r.profile; const rm = [...G.remotes.map.values()].find(q => q.info && q.info.name === x.name);
        const where = rm && G.areaAt ? G.areaAt(rm.x, rm.z) : '';
        s.innerHTML = ph.head(L2('Profile', 'โปรไฟล์')) + `<div class="card prof"><div class="ct-av">🎓</div><h3>${esc(x.name)} ${x.online ? '🟢' : '⚪'}</h3><p>${esc(facName(x.faculty))}${x.program ? ' · ' + esc(x.program) : ''}</p>
          <p><span class="tag gold">Lv ${x.level} · ${esc(tr(levelTitle(x.level)))}</span> ${x.homeTier ? `<span class="tag">🏠 ${esc(TIER_T(x.homeTier))}</span>` : ''}</p>
          <p style="font-size:12px;color:var(--muted)">${L2('Played', 'เล่นมาแล้ว')} ${Math.floor(x.playtime / 3600)}h ${Math.floor(x.playtime / 60) % 60}m · ${L2('Friends', 'เพื่อน')} ${x.friends} · ${L2('Posts', 'โพสต์')} ${x.posts}${where ? ' · 📍 ' + esc(where) : ''}</p></div>
          ${x.me ? '' : `<div class="row" style="flex-wrap:wrap;gap:6px;justify-content:flex-start">${x.friend === 'friends' ? `<button class="btn ghost" id="pfRm">${L2('Unfriend', 'ลบเพื่อน')}</button>` : x.friend === 'requested' ? `<button class="btn ghost" disabled>${L2('Request sent', 'ส่งคำขอแล้ว')}</button>` : `<button class="btn gold" id="pfAdd">${x.friend === 'incoming' ? L2('Accept friend', 'ยอมรับเป็นเพื่อน') : L2('Add friend', 'เพิ่มเพื่อน')}</button>`}
            <button class="btn" id="pfMsg">💬 ${L2('Message', 'ทักแชท')}</button>${x.online ? `<button class="btn" id="pfInv">🎯 ${L2('Invite', 'ชวนทำกิจกรรม')}</button>` : ''}${rm ? `<button class="btn ghost" id="pfGps">📍 GPS</button>` : ''}<button class="btn ghost" id="pfFeed">📰 ${L2('Posts', 'โพสต์')}</button><button class="btn ghost red" id="pfBlk">${L2('Block', 'บล็อก')}</button></div>`}`;
        ph.bind();
        on('#pfAdd', async () => { const q = await G.net.rpc('soc', { op: 'friend', uid: arg }); if (q.ok) { G.audio.ping('friend'); G.ui.toast(q.state === 'friends' ? L2('🤝 You are now friends', '🤝 เป็นเพื่อนกันแล้ว') : L2('Friend request sent', 'ส่งคำขอเป็นเพื่อนแล้ว')); } ph.show(app); });
        on('#pfRm', async () => { await G.net.rpc('soc', { op: 'friend', uid: arg, act: 'remove' }); ph.show(app); });
        on('#pfBlk', async () => { if (!confirm(L2('Block this player? They cannot message or invite you.', 'บล็อกผู้เล่นนี้? เขาจะส่งข้อความหรือชวนคุณไม่ได้'))) return; await G.net.rpc('soc', { op: 'friend', uid: arg, act: 'block' }); ph.show('people'); });
        on('#pfMsg', () => ph.show('msg:u_' + arg));
        on('#pfGps', () => { G.waypoint = { x: rm.x, z: rm.z, name: x.name }; G.routeTimer = 0; G.ui.toast('📍 GPS → ' + x.name); });
        on('#pfFeed', () => ph.show('feed:players'));
        on('#pfInv', () => inviteMenu(G, ph, arg, x.name));
      });
      return;
    }
    s.innerHTML = ph.head(L2('People', 'เพื่อน')) + `<div class="ph-sec">${L2('Requests', 'คำขอเป็นเพื่อน')}</div><div id="pReq">…</div><div class="ph-sec">${L2('Friends', 'เพื่อน')}</div><div id="pFr">…</div><div class="ph-sec">${L2('Online now', 'ออนไลน์ตอนนี้')} <small id="pCnt"></small></div><div id="pOn">…</div>`;
    const row = (x, extra = '') => `<button class="card row lst" data-pf="${x.uid || x.id}"><span class="av">🎓</span><span class="lm"><b>${esc(x.name)}${x.online ? ' 🟢' : ''}</b><small>${esc(facName(x.faculty))}${x.level != null ? ' · Lv ' + x.level : ''}${x.homeTier ? ' · 🏠 ' + esc(TIER_T(x.homeTier)) : ''}</small></span>${extra}</button>`;
    G.net.rpc('soc', { op: 'friends' }).then(r => { if (ph.app !== 'people') return; s.querySelector('#pReq').innerHTML = (r.incoming || []).map(x => row(x, '<i class="bdg">!</i>')).join('') || `<p class="ph-empty">${L2('None', 'ไม่มี')}</p>`; s.querySelector('#pFr').innerHTML = (r.friends || []).map(x => row(x)).join('') || `<p class="ph-empty">${L2('No friends yet — add people from the list below.', 'ยังไม่มีเพื่อน — เพิ่มจากรายชื่อด้านล่างได้เลย')}</p>`; s.querySelectorAll('#pReq [data-pf], #pFr [data-pf]').forEach(b => b.onclick = () => ph.show('people:' + b.dataset.pf)); });
    G.net.rpc('soc', { op: 'online' }).then(r => { if (ph.app !== 'people') return; s.querySelector('#pCnt').textContent = `${(r.list || []).length + 1}/100`; s.querySelector('#pOn').innerHTML = (r.list || []).map(x => row({ ...x, online: true }, x.friend === 'friends' ? '<i class="tag">🤝</i>' : '')).join('') || `<p class="ph-empty">${L2('Nobody else is online right now.', 'ยังไม่มีผู้เล่นคนอื่นออนไลน์')}</p>`; s.querySelectorAll('#pOn [data-pf]').forEach(b => b.onclick = () => ph.show('people:' + b.dataset.pf)); });
    G.notifier.clear('people'); return;
  }

  // ---------------- KU Ride ----------------
  if (base === 'ride') {
    const tab = arg || 'work';
    const tabs = `<div class="seg" id="rdTab">${[['work', L2('Work', 'รับงาน')], ['orders', L2('Player orders', 'ออเดอร์ผู้เล่น')], ['food', L2('Order food', 'สั่งอาหาร')], ['go', L2('Get a ride', 'เรียกรถ')]].map(([k, l]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    let body = '';
    if (tab === 'work') body = `<div class="card"><div class="row"><h4>🛵 ${L2('Rider mode', 'โหมดไรเดอร์')}</h4><label class="sw"><input type="checkbox" id="rdOn" ${G.riderMode ? 'checked' : ''}><i></i></label></div><p>${L2('While on, people around Si Racha send you ride and food-delivery requests. Accept the ones you like — the app sets the GPS for you.', 'เปิดไว้แล้วจะมีคนแถวศรีราชาส่งงานรับส่งคนและส่งอาหารเข้ามา เลือกรับงานที่อยากทำ แอปจะตั้ง GPS ให้')}</p><p style="font-size:12px;color:var(--muted)">${L2('Rides need a motorbike or car. Deliveries work with any vehicle.', 'รับส่งคนต้องใช้มอเตอร์ไซค์หรือรถยนต์ ส่งอาหารใช้รถอะไรก็ได้')}</p></div>`
      + (G.task ? `<div class="card" style="border-color:var(--gold)"><h4>${esc(G.task.title)}</h4><p>${esc(G.task.desc)}</p><button class="btn red" id="rdCancel">${tr('Cancel')}</button></div>` : '')
      + `<div class="ph-sec">${L2('Requests', 'งานที่เข้ามา')}</div>` + ((G.rideReqs || []).map((q, i) => `<div class="card"><div class="row"><span><b>${q.kind === 'ride' ? '🧍' : '🥡'} ${esc(q.who)}</b><br><small>${esc(q.fromName)} → ${esc(q.toName)} · ${Math.round(q.dist)} m</small></span><span class="tag ok">~${fmt(q.est)}</span></div><p style="font-size:12px">“${esc(q.line)}”</p><div class="row"><button class="btn gold" data-acc="${i}">${L2('Accept', 'รับงาน')}</button><button class="btn ghost" data-skip="${i}">${L2('Skip', 'ข้าม')}</button></div></div>`).join('') || `<p class="ph-empty">${G.riderMode ? L2('Waiting for requests…', 'กำลังรองาน…') : L2('Turn on rider mode to receive work.', 'เปิดโหมดไรเดอร์เพื่อรับงาน')}</p>`);
    else if (tab === 'orders') body = online ? `<p style="font-size:12px;color:var(--muted)">${L2('Food other players ordered. Pick it up at the restaurant and bring it to them — you get the delivery fee.', 'อาหารที่ผู้เล่นคนอื่นสั่ง ไปรับที่ร้านแล้วนำไปส่ง — ได้ค่าส่ง')}</p><div id="rdOrd">…</div>` : offlineCard;
    else if (tab === 'food') body = online ? orderFoodHTML(G, arg) : offlineCard;
    else body = `<p style="font-size:12px;color:var(--muted)">${L2('A driver picks you up and drops you at the door. Fare is charged when you book.', 'คนขับมารับแล้วไปส่งถึงหน้าประตู จ่ายค่าโดยสารตอนจอง')}</p>` + destGroups(G).map(([g, list]) => `<div class="ph-sec">${g}</div>` + list.map(pl => { const d = Math.hypot(pl._door.x - G.player.pos.x, pl._door.z - G.player.pos.z); return `<div class="card row"><span class="lm"><b>${esc(pl.th ? L2(pl.name, pl.th) : pl.name)}</b><small>${Math.round(d)} m</small></span><span class="row" style="gap:4px"><button class="btn ghost" data-go="${pl.id}" title="${L2('Driver (instant)', 'คนขับ NPC (ทันที)')}">🚕 ${fmt(Math.min(450, Math.round(30 + d * 0.11)))}</button>${d >= 120 ? `<button class="btn ghost" data-pr="${pl.id}" title="${L2('Ask a player to drive you', 'ให้ผู้เล่นมารับ')}">👥 ${fmt(Math.max(40, Math.min(600, Math.round(35 + d * 0.16))))}</button>` : ''}</span></div>`; }).join('')).join('');
    s.innerHTML = ph.head('KU Ride') + tabs + body;
    all('#rdTab button', (b) => ph.show('ride:' + b.dataset.t));
    const sw = s.querySelector('#rdOn'); if (sw) sw.onchange = () => { G.riderMode = sw.checked; G.audio.click(); if (G.riderMode) { G.rideT = 6; G.ui.toast(L2('🛵 Rider mode on', '🛵 เปิดโหมดไรเดอร์แล้ว')); } ph.show('ride:work'); };
    on('#rdCancel', () => { G.cancelTask(); ph.show('ride:work'); });
    all('[data-acc]', (b) => { const q = G.rideReqs.splice(+b.dataset.acc, 1)[0]; ph.close(); G.acceptRequest(q); });
    all('[data-skip]', (b) => { G.rideReqs.splice(+b.dataset.skip, 1); ph.show('ride:work'); });
    all('[data-go]', (b) => { ph.close(); G.hailRide(b.dataset.go); });
    all('[data-pr]', async (b) => { const r = await G.net.rpc('ride', { op: 'request', to: b.dataset.pr, fromName: G.areaName ? G.areaName() : '', rid: rid() }); G.applyServer(r); if (r.ok) { G.myRide = r.ride; G.audio.ping('order'); G.ui.toast(L2(`👥 Ride requested — fare ${fmt(r.fare)} held until you arrive`, `👥 ขอรถแล้ว — ค่าโดยสาร ${fmt(r.fare)} จะจ่ายเมื่อถึงที่หมาย`), 'gold'); ph.close(); } else G.ui.toast('❌ ' + tr(r.err || 'Failed'), 'bad'); });
    if (tab === 'orders' && online) G.net.rpc('order', { op: 'list' }).then(r => { const box = s.querySelector('#rdOrd'); if (!box || ph.app !== app) return; const list = r.list || []; box.innerHTML = list.map(o => `<div class="card"><div class="row"><span><b>${o.mine ? L2('Your order', 'ออเดอร์ของคุณ') : esc(o.buyerName)}</b><br><small>${esc(o.shopName)} → ${esc(o.dest.name)}</small></span><span class="tag ${o.mine ? '' : 'ok'}">${o.mine ? esc(statusT(o.status)) : '+' + fmt(o.fee)}</span></div><p style="font-size:12px">${Object.entries(o.items).map(([id, q]) => `${ITEMS[id] ? ITEMS[id].icon + ' ' + L2(ITEMS[id].name, ITEMS[id].th) : id} ×${q}`).join(' · ')}</p>${o.mine ? (o.status === 'open' ? `<button class="btn ghost" data-oc="${o.id}">${L2('Cancel order', 'ยกเลิกออเดอร์')}</button>` : '') : o.status === 'open' ? `<button class="btn gold" data-oa="${o.id}">${L2('Deliver it', 'รับส่งออเดอร์นี้')}</button>` : o.riding ? `<span class="tag gold">${L2('You are delivering', 'คุณกำลังส่ง')}</span>` : ''}</div>`).join('') || `<p class="ph-empty">${L2('No player orders right now.', 'ตอนนี้ยังไม่มีออเดอร์จากผู้เล่น')}</p>`;
      box.querySelectorAll('[data-oa]').forEach(b => b.onclick = async () => { const q = await G.net.rpc('order', { op: 'accept', id: +b.dataset.oa }); if (!q.ok) return G.ui.toast('❌ ' + tr(q.err || 'Failed'), 'bad'); ph.close(); G.deliverPlayerOrder(q); });
      box.querySelectorAll('[data-oc]').forEach(b => b.onclick = async () => { const q = await G.net.rpc('order', { op: 'cancel', id: +b.dataset.oc }); G.applyServer(q); if (q.ok) G.ui.toast(L2('Order cancelled — refunded', 'ยกเลิกแล้ว — คืนเงินเรียบร้อย')); ph.show(app); }); });
    if (tab === 'food') wireOrderFood(G, ph, app, arg);
    G.notifier.clear('ride'); return;
  }

  // ---------------- Home ----------------
  if (base === 'house') {
    const h = p.home; const H = h ? HOUSING[h.type] : null;
    s.innerHTML = ph.head(L2('My home', 'ที่พักของฉัน')) + (h ? `<div class="card home"><h4>🏠 ${esc(pname(G, h.place))}</h4><p>${esc(L2(H.en, H.th))} · <span class="tag">${esc(TIER_T(H.tier))}</span></p><p>${L2('Floor', 'ชั้น')} ${h.floor} · ${L2('Room', 'ห้อง')} ${h.floor}${String(h.room).padStart(2, '0')}</p><p style="font-size:12px;color:var(--muted)">${(L2(H.perks.join(' · '), H.perks_th.join(' · ')))} · ${L2('Sleep restores', 'นอนพักฟื้นพลัง')} ${H.energy}%</p><div class="row" style="justify-content:flex-start;gap:6px"><button class="btn" id="hmGps">📍 ${L2('Go home', 'กลับห้อง')}</button><button class="btn ghost" id="hmRide">🚕 ${L2('Ride home', 'เรียกรถกลับ')}</button></div></div>` : `<p class="ph-empty">${L2('Your room is being assigned…', 'กำลังจัดห้องให้…')}</p>`)
      + `<div class="ph-sec">${L2('Move to a better place', 'ย้ายไปที่พักที่ดีกว่า')}</div>` + Object.entries(HOUSING).map(([k, X]) => { const lock = X.level && p.level < X.level; const mine = h && h.type === k;
        return `<div class="card"><div class="row"><span><b>${esc(L2(X.en, X.th))}</b><br><small>${esc(pname(G, X.places[0]))} · ${esc(TIER_T(X.tier))}</small></span><span class="tag ${mine ? 'gold' : lock ? 'bad' : 'ok'}">${mine ? L2('Your home', 'ที่พักปัจจุบัน') : X.price ? fmt(X.price) : L2('Free', 'ฟรี')}</span></div><p style="font-size:12px">${esc(L2(X.perks.join(' · '), X.perks_th.join(' · ')))} · ${L2('energy', 'พลังงาน')} +${X.energy}% · ${L2('mood', 'อารมณ์')} +${X.mood}</p>${mine ? '' : `<div class="row" style="justify-content:flex-start;gap:6px"><button class="btn ghost" data-see="${X.places[0]}">📍 ${L2('See', 'ไปดู')}</button><button class="btn ${lock ? '' : 'gold'}" data-mv="${k}" ${lock ? 'disabled' : ''}>${lock ? L2(`Level ${X.level}`, `เลเวล ${X.level}`) : L2('Move in', 'ย้ายเข้า')}</button></div>`}</div>`; }).join('');
    on('#hmGps', () => { const d = G.homeDoor(); if (d) { G.waypoint = d; G.routeTimer = 0; ph.close(); G.ui.toast('📍 ' + d.name); } });
    on('#hmRide', () => { ph.close(); G.hailRide(h.place); });
    all('[data-see]', (b) => { const pl = G.world.places[b.dataset.see]; if (pl) { G.waypoint = { x: pl._door.x, z: pl._door.z, name: pl.th || pl.name }; G.routeTimer = 0; G.ui.toast('📍 ' + (pl.th || pl.name)); } });
    all('[data-mv]', async (b) => { const X = HOUSING[b.dataset.mv]; if (!online) return G.ui.toast(L2('Needs the online server', 'ต้องออนไลน์'), 'bad'); if (!confirm(L2(`Move to ${X.en} for ${fmt(X.price)}? Your current room is given back.`, `ย้ายไป${X.th} ราคา ${fmt(X.price)}? ห้องเดิมจะถูกคืน`))) return; const r = await G.net.rpc('home', { op: 'move', type: b.dataset.mv, rid: rid() }); G.applyServer(r); if (r.ok) { G.audio.cash(); G.ui.big(L2('New home!', 'ย้ายบ้านใหม่!'), `${pname(G, r.home.place)} · ${L2('Room', 'ห้อง')} ${r.home.floor}${String(r.home.room).padStart(2, '0')}`); G.society && G.society.flag('home'); } else G.ui.toast('❌ ' + tr(r.err || 'Failed'), 'bad'); ph.show('house'); });
    return;
  }

  // ---------------- KU Shop (online shopping, delivered as parcels) ----------------
  if (base === 'shop') {
    if (!online) { s.innerHTML = ph.head('KU Shop') + offlineCard; return; }
    const tab = arg || 'gadget'; const cart = G._shopCart || (G._shopCart = { items: {}, clothes: [] });
    const TABS = [['gadget', L2('Gadgets', 'ไอที')], ['beauty', L2('Beauty', 'ความงาม')], ['fashion', L2('Fashion', 'แฟชั่น')], ['deco', L2('Home', 'แต่งห้อง')], ['snack', L2('Snacks', 'ขนม')], ['orders', L2('Orders', 'พัสดุ')]];
    const sub = Object.entries(cart.items).reduce((a, [i, q]) => a + ITEMS[i].price * q, 0) + cart.clothes.reduce((a, c) => a + CLOTHES[c].price, 0);
    const n = Object.values(cart.items).reduce((a, q) => a + q, 0) + cart.clothes.length;
    let body = '';
    if (tab === 'orders') body = '<div id="shOrd"><p class="ph-empty">…</p></div>';
    else if (tab === 'fashion') body = Object.entries(CLOTHES).filter(([, c]) => c.shop === 'mall').map(([id, c]) => { const own = p.wardrobe.includes(id), inC = cart.clothes.includes(id), lock = c.level && p.level < c.level; return `<div class="card row"><span class="lm"><b><i class="dot" style="background:${c.color}"></i> ${esc(L2(c.name, c.th || c.name))}</b><small>${esc(c.brand || '')} · ${fmt(c.price)}${lock ? ' · ' + L2('Lv ', 'เลเวล ') + c.level : ''}</small></span>${own ? `<span class="tag">${L2('Owned', 'มีแล้ว')}</span>` : `<button class="btn ${inC ? '' : 'ghost'}" data-cl="${id}" ${lock ? 'disabled' : ''}>${inC ? '✓' : '+'}</button>`}</div>`; }).join('');
    else body = (ONLINE_SHOP[tab] || []).filter(i => ITEMS[i]).map(i => { const it = ITEMS[i]; const q = cart.items[i] || 0; return `<div class="card row"><span class="lm"><b>${it.icon} ${esc(L2(it.name, it.th))}</b><small>${it.brand ? esc(it.brand) + ' · ' : ''}${fmt(it.price)}${it.gadget === 'laptop' ? L2(' · study bonus', ' · เรียนได้ XP เพิ่ม') : it.deco ? L2(' · room +mood', ' · ห้องน่าอยู่ขึ้น') : ''}</small></span><span class="qty"><button class="btn ghost" data-it="${i}" data-d="-1">−</button><b>${q}</b><button class="btn ghost" data-it="${i}" data-d="1">+</button></span></div>`; }).join('');
    s.innerHTML = ph.head('KU Shop') + `<div class="seg" id="shTab" style="flex-wrap:wrap">${TABS.map(([k, l]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>` + body
      + (n ? `<div class="card cart"><div class="row"><span>🛒 ${n} ${L2('items', 'ชิ้น')} · <b>${fmt(sub)}</b>${sub >= 1000 ? L2(' · free shipping', ' · ส่งฟรี') : L2(' + ฿40 shipping', ' + ค่าส่ง ฿40')}</span><button class="btn ghost" id="shClr">✕</button></div><button class="btn gold" id="shBuy" style="width:100%;margin-top:6px">${L2('Checkout', 'สั่งซื้อ')} ${fmt(sub + (sub >= 1000 ? 0 : 40))}</button></div>` : '');
    all('#shTab button', (b) => ph.show('shop:' + b.dataset.t));
    all('[data-it]', (b) => { const tot = n; const d = +b.dataset.d; if (d > 0 && tot >= 12) return; const i = b.dataset.it; cart.items[i] = Math.max(0, (cart.items[i] || 0) + d); if (!cart.items[i]) delete cart.items[i]; ph.show(app); });
    all('[data-cl]', (b) => { const c = b.dataset.cl; const k = cart.clothes.indexOf(c); if (k >= 0) cart.clothes.splice(k, 1); else if (n < 12) cart.clothes.push(c); ph.show(app); });
    on('#shClr', () => { G._shopCart = null; ph.show(app); });
    on('#shBuy', async () => { const r = await G.net.rpc('shop', { op: 'buy', items: cart.items, clothes: cart.clothes, rid: rid() }); G.applyServer(r); if (r.ok) { G._shopCart = null; G.audio.cash(); G.ui.toast(L2(`📦 Ordered — arriving in about ${Math.round((r.parcel.eta - Date.now()) / 1000)} s`, `📦 สั่งแล้ว — จะมาส่งในอีกประมาณ ${Math.round((r.parcel.eta - Date.now()) / 1000)} วินาที`), 'gold'); ph.show('shop:orders'); } else G.ui.toast('❌ ' + tr(r.err || 'Failed'), 'bad'); });
    if (tab === 'orders') G.net.rpc('shop', { op: 'list' }).then(r => { const box = s.querySelector('#shOrd'); if (!box || ph.app !== app) return; box.innerHTML = (r.list || []).map(o => `<div class="card"><div class="row"><b>📦 #${o.id}</b><span class="tag ${o.status === 'delivered' ? 'ok' : 'gold'}">${o.status === 'delivered' ? L2('Delivered', 'ส่งแล้ว') : L2(`Arriving ~${Math.max(0, Math.round((o.eta - Date.now()) / 1000))} s`, `อีก ~${Math.max(0, Math.round((o.eta - Date.now()) / 1000))} วิ`)}</span></div><p style="font-size:12px">${[...Object.entries(o.items.items || {}).map(([i, q]) => `${ITEMS[i] ? ITEMS[i].icon + ' ' + L2(ITEMS[i].name, ITEMS[i].th) : i} ×${q}`), ...(o.items.clothes || []).map(c => '👕 ' + (CLOTHES[c] ? L2(CLOTHES[c].name, CLOTHES[c].th || CLOTHES[c].name) : c))].join(' · ')} · ${fmt(o.total)}</p></div>`).join('') || `<p class="ph-empty">${L2('No orders yet', 'ยังไม่มีคำสั่งซื้อ')}</p>`; });
    G.notifier.clear('shop'); return;
  }

  // ---------------- My shop ----------------
  if (base === 'biz') {
    const b = p.biz;
    if (!b) {
      s.innerHTML = ph.head(L2('My shop', 'ร้านของฉัน')) + `<p style="font-size:12px;color:var(--muted)">${L2('Open your own food business. Customers order through your phone; you cook at your stall and deliver.', 'เปิดร้านอาหารของตัวเอง ลูกค้าสั่งผ่านโทรศัพท์ คุณทำอาหารที่ร้านแล้วไปส่งเอง')}</p>` + Object.entries(BUSINESSES).map(([k, B]) => { const lock = p.level < (B.level || 1);
        return `<div class="card"><div class="row"><span><b>${esc(L2(B.en, B.th))}</b><br><small>${esc(pname(G, B.place))}</small></span><span class="tag ${lock ? 'bad' : 'ok'}">${fmt(B.price)}</span></div><p style="font-size:12px">${Object.keys(B.menu).map(m => L2(MENU_NAMES[m][0], MENU_NAMES[m][1])).join(' · ')}</p><button class="btn ${lock ? '' : 'gold'}" data-buy="${k}" ${lock ? 'disabled' : ''}>${lock ? L2(`Level ${B.level}`, `เลเวล ${B.level}`) : L2('Open this shop', 'เปิดร้านนี้')}</button></div>`; }).join('');
      all('[data-buy]', async (x) => { if (!online) return G.ui.toast(L2('Needs the online server', 'ต้องออนไลน์'), 'bad'); const B = BUSINESSES[x.dataset.buy]; if (!confirm(L2(`Open ${B.en} for ${fmt(B.price)}?`, `เปิด${B.th} ราคา ${fmt(B.price)}?`))) return; const r = await G.net.rpc('biz', { op: 'buy', kind: x.dataset.buy, rid: rid() }); G.applyServer(r); if (r.ok) { G.audio.cash(); G.ui.big(L2('Your own shop!', 'เปิดร้านของตัวเองแล้ว!'), L2(B.en, B.th)); } else G.ui.toast('❌ ' + tr(r.err || 'Failed'), 'bad'); ph.show('biz'); });
      return;
    }
    const B = BUSINESSES[b.kind];
    s.innerHTML = ph.head(L2(B.en, B.th)) + `<div class="card"><div class="row"><h4>${L2('Open for orders', 'เปิดรับออเดอร์')}</h4><label class="sw"><input type="checkbox" id="bzOn" ${G.bizOpen ? 'checked' : ''}><i></i></label></div><p>${L2('Customers message you with orders. Accept, cook at your stall (E at the stall), then deliver.', 'ลูกค้าจะส่งออเดอร์มา รับออเดอร์ แล้วไปทำที่ร้าน (กด E ที่ร้าน) จากนั้นไปส่ง')}</p><p style="font-size:12px;color:var(--muted)">${L2('Total sales', 'ยอดขายรวม')} <b>${fmt(b.sales)}</b> · 📍 ${esc(pname(G, b.place))}</p><button class="btn ghost" id="bzGps">📍 ${L2('Go to my stall', 'ไปที่ร้าน')}</button></div>
      <div class="ph-sec">${L2('Orders waiting', 'ออเดอร์ที่รอทำ')} (${(G.bizQueue || []).length}/3)</div>` + ((G.bizQueue || []).map((o, i) => `<div class="card"><b>${esc(o.who)}</b><br><small>→ ${esc(o.toName)} · ${Math.round(o.dist)} m</small><p style="font-size:12px">“${esc(o.note)}”</p><button class="btn ghost" data-drop="${i}">${L2('Refuse', 'ปฏิเสธ')}</button></div>`).join('') || `<p class="ph-empty">${G.bizOpen ? L2('Waiting for customers…', 'กำลังรอลูกค้า…') : L2('Open the shop to get orders.', 'เปิดร้านเพื่อรับออเดอร์')}</p>`)
      + `<div class="ph-sec">${L2('Menu', 'เมนู')}</div><div class="card"><p style="font-size:12px">${Object.entries(B.menu).map(([m, pr]) => `${L2(MENU_NAMES[m][0], MENU_NAMES[m][1])} ${fmt(pr)}`).join(' · ')}</p></div>`;
    const sw = s.querySelector('#bzOn'); sw.onchange = () => { G.bizOpen = sw.checked; G.bizT = 8; G.audio.click(); ph.show('biz'); };
    on('#bzGps', () => { const pl = G.world.places[b.place]; if (pl) { G.waypoint = { x: pl._door.x, z: pl._door.z, name: pl.th || pl.name }; G.routeTimer = 0; ph.close(); } });
    all('[data-drop]', (x) => { G.bizQueue.splice(+x.dataset.drop, 1); ph.show('biz'); });
    return;
  }
}
const statusT = (s) => ({ open: L2('Waiting for a rider', 'รอไรเดอร์'), accepted: L2('Rider on the way', 'ไรเดอร์รับงานแล้ว'), picked: L2('Food picked up', 'รับอาหารแล้ว'), npc: L2('Shop rider delivering', 'ไรเดอร์ร้านกำลังส่ง'), delivered: L2('Delivered', 'ส่งแล้ว') })[s] || s;

function destGroups(G) {
  const P = Object.values(G.world.places); const g = (kinds) => P.filter(p => kinds.includes(p.kind)).sort((a, b) => Math.hypot(a._door.x - G.player.pos.x, a._door.z - G.player.pos.z) - Math.hypot(b._door.x - G.player.pos.x, b._door.z - G.player.pos.z));
  return [[L2('Classes & campus', 'ที่เรียนและในมหาลัย'), g(['lecture', 'faculty', 'library', 'lab', 'office', 'activity', 'hall', 'gym', 'court', 'pool', 'stadium'])], [L2('Dorms, condos & hotel', 'หอพัก คอนโด โรงแรม'), g(['dorm', 'condo', 'hotel', 'residence'])], [L2('Food & cafés', 'ร้านอาหาร คาเฟ่'), g(['cafeteria', 'foodstreet', 'market', 'noodle', 'mookata', 'seafood', 'cafe'])], [L2('Shops & services', 'ร้านค้าและบริการ'), g(['mart', 'coop', 'fashion', 'barber', 'bank', 'moto', 'cars', 'gas', 'clinic', 'fitness'])]];
}
function orderFoodHTML(G, arg) {
  const P = Object.values(G.world.places).filter(p => ORDER_KINDS.includes(p.kind) && SHOPS[p.kind]);
  const sel = G._ordShop && G.world.places[G._ordShop] ? G.world.places[G._ordShop] : null;
  if (!sel) return `<p style="font-size:12px;color:var(--muted)">${L2('Pick a restaurant. Another player (or the shop\'s own rider) brings it to where you are now.', 'เลือกร้าน ผู้เล่นคนอื่น (หรือไรเดอร์ของร้าน) จะนำมาส่งถึงที่คุณอยู่ตอนนี้')}</p>` + P.map(pl => `<button class="card row lst" data-shop="${pl.id}"><span class="lm"><b>${esc(pl.th ? L2(pl.name, pl.th) : pl.name)}</b><small>${SHOPS[pl.kind].items.slice(0, 4).map(i => ITEMS[i] ? ITEMS[i].icon : '').join(' ')}</small></span><span>›</span></button>`).join('');
  const cart = G._cart || {}; const items = SHOPS[sel.kind].items.filter(i => ITEMS[i] && ITEMS[i].price > 0);
  const food = Object.entries(cart).reduce((s, [i, q]) => s + ITEMS[i].price * q, 0); const d = Math.hypot(sel._door.x - G.player.pos.x, sel._door.z - G.player.pos.z); const fee = Math.max(20, Math.min(180, Math.round(20 + d * 0.06)));
  return `<div class="card"><div class="row"><h4>${esc(sel.th ? L2(sel.name, sel.th) : sel.name)}</h4><button class="btn ghost" id="ofBack">${L2('Change', 'เปลี่ยนร้าน')}</button></div></div>` + items.map(i => `<div class="card row"><span>${ITEMS[i].icon} ${esc(L2(ITEMS[i].name, ITEMS[i].th))}<br><small>${fmt(ITEMS[i].price)}</small></span><span class="qty"><button class="btn ghost" data-q="${i}" data-d="-1">−</button><b>${cart[i] || 0}</b><button class="btn ghost" data-q="${i}" data-d="1">+</button></span></div>`).join('')
    + `<div class="card"><p>${L2('Food', 'ค่าอาหาร')} ${fmt(food)} · ${L2('Delivery', 'ค่าส่ง')} ${fmt(fee)} · <b>${L2('Total', 'รวม')} ${fmt(food + fee)}</b></p><p style="font-size:12px;color:var(--muted)">📍 ${L2('Deliver to', 'ส่งที่')}: ${esc(G.areaName ? G.areaName() : '')}</p><button class="btn gold" id="ofGo" ${food ? '' : 'disabled'}>${L2('Place order', 'สั่งเลย')}</button></div>`;
}
function wireOrderFood(G, ph, app) {
  const s = ph.screen;
  s.querySelectorAll('[data-shop]').forEach(b => b.onclick = () => { G._ordShop = b.dataset.shop; G._cart = {}; ph.show('ride:food'); });
  const back = s.querySelector('#ofBack'); if (back) back.onclick = () => { G._ordShop = null; ph.show('ride:food'); };
  s.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { const c = G._cart || (G._cart = {}); const tot = Object.values(c).reduce((a, x) => a + x, 0); const d = +b.dataset.d; if (d > 0 && tot >= 6) return; c[b.dataset.q] = Math.max(0, (c[b.dataset.q] || 0) + d); if (!c[b.dataset.q]) delete c[b.dataset.q]; ph.show('ride:food'); });
  const go = s.querySelector('#ofGo'); if (go) go.onclick = async () => { const pos = G.player.pos; const r = await G.net.rpc('order', { op: 'create', shop: G._ordShop, items: G._cart, dest: { x: Math.round(pos.x * 10) / 10, z: Math.round(pos.z * 10) / 10, name: G.profile.name + ' · ' + (G.areaName ? G.areaName() : '') }, rid: rid() }); G.applyServer(r); if (r.ok) { G.audio.cash(); G.ui.toast(L2('🥡 Order placed — waiting for a rider', '🥡 สั่งแล้ว — รอไรเดอร์รับงาน'), 'gold'); G._cart = {}; G._ordShop = null; G.myOrderAt = { x: pos.x, z: pos.z }; ph.show('ride:orders'); } else G.ui.toast('❌ ' + tr(r.err || 'Failed'), 'bad'); };
}
function inviteMenu(G, ph, uid, name) {
  const acts = [['eat', L2('Eat together', 'ไปกินข้าว'), '🍛'], ['study', L2('Study at the library', 'อ่านหนังสือที่หอสมุด'), '📚'], ['futsal', L2('Futsal / basketball', 'เตะบอล / เล่นบาส'), '⚽'], ['gym', L2('Work out', 'ออกกำลังกาย'), '🏋️'], ['beach', L2('Sunset at Ao Udom', 'ดูพระอาทิตย์ตกที่อ่าวอุดม'), '🌅'], ['ride', L2('Ride around', 'ขี่รถเล่น'), '🛵'], ['shop', L2('Go shopping', 'ไปช้อปปิ้ง'), '🛍️']];
  G.ui.modal(`<h2>🎯 ${L2('Invite', 'ชวน')} ${esc(name)}</h2><div class="list">${acts.map(([k, l, ic]) => `<button class="item" data-a="${k}"><span class="ic">${ic}</span><span>${l}</span></button>`).join('')}</div><div class="actions"><button class="btn ghost" id="mX">${tr('Cancel')}</button></div>`, (r) => {
    r.querySelector('#mX').onclick = () => G.ui.closeModal();
    r.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => { G.ui.closeModal(); const a = acts.find(x => x[0] === b.dataset.a); const q = await G.net.rpc('soc', { op: 'invite', uid, act: a[0], place: G.areaName ? G.areaName() : '' }); G.ui.toast(q.ok ? L2(`Invite sent to ${name}`, `ส่งคำชวนถึง${name}แล้ว`) : '❌ ' + tr(q.err || 'Failed'), q.ok ? '' : 'bad'); });
  });
}

// ---------------------------------------------------------------------------------------------------------------
// gameplay flows
export function installLife(G, { ui, audio, notifier }) {
  G.riderMode = false; G.rideReqs = []; G.rideT = 20; G.bizOpen = false; G.bizQueue = []; G.bizT = 20;
  const places = () => Object.values(G.world.places);
  const near = (x, z, a, b) => { const out = []; for (const pl of places()) { const d = Math.hypot(pl._door.x - x, pl._door.z - z); if (d >= a && d <= b) out.push(pl); } return out; };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const destAll = () => { const out = places().map(pl => ({ x: pl._door.x, z: pl._door.z, name: pl.th ? L2(pl.name, pl.th) : pl.name, kind: pl.kind })); for (const b of G.world.deliveryHomes || []) out.push({ ...b, kind: 'house' }); return out; };
  G.homeDoor = () => { const h = G.profile.home; if (!h) return null; const pl = G.world.places[h.place]; return pl ? { x: pl._door.x, z: pl._door.z, name: L2('Home · ', 'ห้องของฉัน · ') + (pl.th ? L2(pl.name, pl.th) : pl.name) + ` ${h.floor}${String(h.room).padStart(2, '0')}` } : null; };

  // ---- requests generator (rider mode, own shop) ----
  G.lifeTick = (dt) => {
    if (G.riderMode) { G.rideT -= dt; if (G.rideT <= 0) { G.rideT = 35 + Math.random() * 45; if (G.rideReqs.length < 4) newRequest(); } }
    if (G.bizOpen && G.profile.biz) { G.bizT -= dt; if (G.bizT <= 0) { G.bizT = 45 + Math.random() * 55; if (G.bizQueue.length < 3) newCustomer(); } }
  };
  function newRequest() {
    const pos = G.player.pos; const hasMotor = (G.profile.vehicles || []).some(v => v.type !== 'bicycle') || G.rental;
    const canFood = G.profile.level >= (JOBS.delivery.level || 1);
    if (!hasMotor && !canFood) { if (!G._riderHint) { G._riderHint = true; ui.toast(L2(`Food delivery unlocks at level ${JOBS.delivery.level}; rides need a motorbike or car (rent one at the motorbike shop)`, `ส่งอาหารปลดล็อกที่เลเวล ${JOBS.delivery.level} · รับส่งคนต้องมีมอเตอร์ไซค์หรือรถยนต์ (เช่าได้ที่ร้านมอเตอร์ไซค์)`)); } return; }
    const kind = hasMotor && (!canFood || Math.random() < 0.55) ? 'ride' : 'food';
    if (kind === 'ride') {
      const from = pick(near(pos.x, pos.z, 40, 700)); if (!from) return; const to = pick(near(from._door.x, from._door.z, 250, 2400)); if (!to) return;
      const d = Math.hypot(to._door.x - from._door.x, to._door.z - from._door.z);
      const q = { kind: 'ride', who: personName(), from, to, a: [from._door.x, from._door.z], b: [to._door.x, to._door.z], fromName: from.th ? L2(from.name, from.th) : from.name, toName: to.th ? L2(to.name, to.th) : to.name, dist: d, est: Math.round(35 + d * 0.17), line: rideLine(to.kind) };
      pushReq(q);
    } else {
      const rs = places().filter(p => ['cafeteria', 'foodstreet', 'market', 'noodle', 'mookata', 'cafe', 'mart', 'seafood'].includes(p.kind)); const shop = rs.sort((a, b) => Math.hypot(a._door.x - pos.x, a._door.z - pos.z) - Math.hypot(b._door.x - pos.x, b._door.z - pos.z))[Math.floor(Math.random() * 3)];
      if (!shop) return; const ds = destAll().filter(d => { const k = Math.hypot(d.x - shop._door.x, d.z - shop._door.z); return k > 200 && k < 2300; }); const dest = pick(ds); if (!dest) return;
      const d = Math.hypot(dest.x - shop._door.x, dest.z - shop._door.z);
      pushReq({ kind: 'food', who: personName(), shop, dest, fromName: shop.th ? L2(shop.name, shop.th) : shop.name, toName: dest.name, dist: d, est: Math.round(60 + d * 0.12 + 30), line: foodNote() });
    }
  }
  function pushReq(q) {
    G.rideReqs.push(q);
    notifier.push({ app: 'ride', icon: q.kind === 'ride' ? '🧍' : '🥡', title: `KU Ride · ${q.who}`, text: `${q.fromName} → ${q.toName} · ~${fmt(q.est)} · “${q.line}”`, sound: 'order', actions: [{ label: L2('Accept', 'รับงาน'), primary: true, fn: () => { const i = G.rideReqs.indexOf(q); if (i >= 0) G.rideReqs.splice(i, 1); G.acceptRequest(q); } }, { label: L2('Later', 'ไว้ก่อน'), fn: () => { } }] });
  }
  G.acceptRequest = async (q) => {
    if (G.task) return ui.toast(L2('Finish your current task first', 'ทำงานปัจจุบันให้เสร็จก่อน'), 'bad');
    if (q.kind === 'food') return G.startDelivery({ shop: q.shop, dest: q.dest, who: q.who, note: q.line });
    const v = G.player.vehicle; if (!v || v.type === 'bicycle') ui.toast(L2('🛵 Get on your motorbike or car first', '🛵 ขึ้นมอเตอร์ไซค์หรือรถยนต์ก่อนนะ'));
    const jt = await G.jobStart('ride', { a: q.a, b: q.b }); if (!jt.ok) return;
    audio.notify(); let called = false; const t0 = performance.now();
    G.startTask({ title: L2('KU Ride · pick up', 'KU Ride · ไปรับ') + ' ' + q.who, desc: L2(`Pick up ${q.who} at ${q.fromName}`, `ไปรับ${q.who}ที่${q.fromName}`), target: q.from._door, radius: 9, cancel: () => G.jobCancel(jt.jid),
      tick: () => { if (!called && performance.now() - t0 > 70000 && G.society) { called = true; G.society.customerCall(q.who, 'ฮัลโหล ไรเดอร์ใช่ไหม อยู่ใกล้ยัง รออยู่หน้าตึกนะ'); } },
      onArrive: (g) => {
        g.jobStep(jt.jid).then(r => { if (!r.ok) ui.toast('❌ ' + tr(r.err || 'Pickup failed'), 'bad'); });
        if (G.player.vehicle && G.player.vehicle.moto) G.player.setPassenger(true);
        audio.ping('pick'); ui.toast(`🧍 ${q.who}: “${q.line}”`);
        g.task = { title: L2('KU Ride · drop off', 'KU Ride · ไปส่ง'), desc: L2(`Take ${q.who} to ${q.toName}`, `พา${q.who}ไปส่งที่${q.toName}`), target: q.to._door, radius: 9, time: 0, limit: q.dist / 9 + 40, passenger: (on) => G.player.setPassenger(on), cancel: () => G.jobCancel(jt.jid), onArrive: async (g2) => {
          g2.task = null; G.player.setPassenger(false);
          const r = await g2.jobFinish(jt.jid, 1, q.est, 'ride'); if (!r.ok) return false;
          g2.skill('drv', 0.8); g2.profile.counters.jobs++; g2.event('job'); G.society && G.society.flag('job');
          ui.big(L2('Fare paid', 'ได้ค่าโดยสาร') + ' 🛵', `${q.who} · ${fmt(r.amount)}`); return false;
        } };
        g.routeTimer = 0; return true;
      } });
  };

  // ---- own shop ----
  function newCustomer() {
    const b = G.profile.biz; const B = BUSINESSES[b.kind]; const stall = G.world.places[b.place]; if (!stall) return;
    const ds = destAll().filter(d => { const k = Math.hypot(d.x - stall._door.x, d.z - stall._door.z); return k > 120 && k < 1800; }); const dest = pick(ds); if (!dest) return;
    const o = { who: personName(), dest, toName: dest.name, dist: Math.hypot(dest.x - stall._door.x, dest.z - stall._door.z), note: foodNote() };
    notifier.push({ app: 'biz', icon: '🍗', title: `${L2(B.en, B.th)} · ${o.who}`, text: `${L2('New order → ', 'ออเดอร์ใหม่ → ')}${o.toName} · “${o.note}”`, sound: 'order', actions: [{ label: L2('Accept', 'รับออเดอร์'), primary: true, fn: () => { G.bizQueue.push(o); ui.toast(L2('Order accepted — cook it at your stall (E)', 'รับออเดอร์แล้ว — ไปทำที่ร้าน (กด E)')); if (!G.task) { G.waypoint = { x: stall._door.x, z: stall._door.z, name: stall.th || stall.name }; G.routeTimer = 0; } } }, { label: L2('Refuse', 'ปฏิเสธ'), fn: () => { } }] });
  }
  G.cookOrder = async () => {
    const o = G.bizQueue[0]; if (!o) return ui.toast(L2('No orders waiting — open the shop in the phone', 'ยังไม่มีออเดอร์ — เปิดร้านในโทรศัพท์'));
    if (G.task) return ui.toast(L2('Finish your current task first', 'ทำงานปัจจุบันให้เสร็จก่อน'), 'bad');
    const B = BUSINESSES[G.profile.biz.kind];
    G.player.emote = 'work'; const s = await runMinigame(ui, audio, 'timing', { title: L2('Cooking · ', 'ทำอาหาร · ') + L2(B.en, B.th), sub: L2('Tap when the marker hits the green zone — not too raw, not burnt!', 'กดตอนที่เข็มอยู่ช่องเขียว — ไม่ดิบ ไม่ไหม้!'), rounds: 4 }); G.player.emote = null;
    if (s == null) return;
    const jt = await G.jobStart('bizdel', { b: [o.dest.x, o.dest.z], s }); if (!jt.ok) return;
    G.bizQueue.shift(); audio.sizzle ? audio.sizzle() : audio.notify();
    const list = Object.entries(jt.order.items).map(([m, q]) => `${L2(MENU_NAMES[m][0], MENU_NAMES[m][1])} ×${q}`).join(', ');
    ui.toast(`🥡 ${list} · ${fmt(jt.order.value)}`);
    G.startTask({ title: L2('Deliver your order', 'ส่งออเดอร์ร้านของฉัน'), desc: `${o.who} · ${o.toName}`, target: o.dest, radius: 8, time: 0, limit: o.dist / 7 + 60, cancel: () => G.jobCancel(jt.jid), onArrive: async (g) => {
      g.task = null; const r = await g.jobFinish(jt.jid, 1, Math.round(jt.order.value * B.margin), 'bizdel'); if (!r.ok) return false;
      g.profile.counters.jobs++; g.event('job'); ui.big(L2('Delivered', 'ส่งถึงแล้ว') + ' 🍗', `${o.who} · +${fmt(r.amount)}${r.tip ? L2(` (tip ${fmt(r.tip)})`, ` (ทิป ${fmt(r.tip)})`) : ''}`); return false;
    } });
  };

  // ---- player-to-player order (rider side) ----
  G.deliverPlayerOrder = (q) => {
    const o = q.order; const shop = G.world.places[o.shop]; if (!shop) return;
    audio.notify();
    G.startTask({ title: L2('Player order · pick up', 'ออเดอร์ผู้เล่น · ไปรับอาหาร'), desc: `${o.shopName} → ${o.buyerName}`, target: shop._door, radius: 10, cancel: () => G.net.rpc('order', { op: 'cancel', id: o.id }), onArrive: (g) => {
      G.jobStep(q.jid).then(r => { if (!r.ok) ui.toast('❌ ' + tr(r.err || 'Pickup failed'), 'bad'); else audio.ping('pick'); });
      ui.toast(L2('🥡 Food picked up — deliver it to ', '🥡 รับอาหารแล้ว — ไปส่งให้ ') + o.buyerName);
      g.task = { title: L2('Player order · deliver', 'ออเดอร์ผู้เล่น · ไปส่ง'), desc: `${o.buyerName} · ${o.dest.name}`, target: { x: o.dest.x, z: o.dest.z }, radius: 8, cancel: () => G.net.rpc('order', { op: 'cancel', id: o.id }), onArrive: async (g2) => {
        g2.task = null; const r = await g2.jobFinish(q.jid, 1, o.fee, 'p2p'); if (!r.ok) return false;
        g2.profile.counters.jobs++; g2.event('job'); ui.big(L2('Order delivered', 'ส่งออเดอร์แล้ว') + ' 🥡', `${o.buyerName} · +${fmt(r.amount)}`); return false;
      } };
      g.routeTimer = 0; return true;
    } });
  };

  // ---- hail a ride (NPC driver, fast travel) ----
  G.hailRide = async (placeId) => {
    if (!G.net.online) return ui.toast(L2('Needs the online server', 'ต้องออนไลน์'), 'bad');
    if (G.player.vehicle) return ui.toast(L2('Get off your vehicle first', 'ลงจากรถก่อน'), 'bad');
    const pl = G.world.places[placeId]; if (!pl) return;
    const r = await G.net.rpc('hail', { to: placeId, rid: rid() }); G.applyServer(r); if (!r.ok) return ui.toast('❌ ' + tr(r.err || 'Failed'), 'bad');
    const driver = personName(); audio.cash(); ui.toast(`🚕 ${driver} ${L2('is coming', 'กำลังมารับ')} · ${r.eta}s · ${fmt(r.fare)}`);
    setTimeout(() => { audio.ping('order'); ui.fade(true); setTimeout(() => { G.player.teleport(pl._door.x + (pl._door.nx || 0) * 3, pl._door.z + (pl._door.nz || 0) * 3); ui.fade(false); ui.toast(`📍 ${L2('Arrived at', 'ถึงแล้ว')} ${pl.th ? L2(pl.name, pl.th) : pl.name} · ${L2('thanks for riding with', 'ขอบคุณที่ใช้บริการ')} ${driver}`); G.event('drive', 0); }, 1300); }, r.eta * 1000);
  };

  // ---- player ride hailing: driver side ----
  G.acceptPlayerRide = async (r) => {
    if (G.task) return ui.toast(L2('Finish your current task first', 'ทำงานปัจจุบันให้เสร็จก่อน'), 'bad');
    const q = await G.net.rpc('ride', { op: 'accept', id: r.id }); if (!q.ok) return ui.toast('❌ ' + tr(q.err || 'Failed'), 'bad');
    audio.notify(); const pk = r.pickup;
    G.startTask({ ride: r.id, title: L2('Pick up player', 'ไปรับผู้เล่น') + ' · ' + r.paxName, desc: pk.name || L2('Passenger location', 'จุดที่ผู้โดยสารรอ'), target: { x: pk.x, z: pk.z }, radius: 9, cancel: () => G.net.rpc('ride', { op: 'cancel', id: r.id }),
      onArrive: (g) => { G.net.rpc('ride', { op: 'board', id: r.id }); g.task = { ride: r.id, title: L2('Waiting for the passenger…', 'รอผู้โดยสารขึ้นรถ…'), desc: r.paxName, target: { x: pk.x, z: pk.z }, radius: 0.01, cancel: () => G.net.rpc('ride', { op: 'cancel', id: r.id }), onArrive: () => true, tick: () => { if (!g._bt || performance.now() - g._bt > 2000) { g._bt = performance.now(); G.net.rpc('ride', { op: 'board', id: r.id }); } } }; return true; } });
  };
  G.driveToDest = (n) => {
    const d = n.dest; G.startTask({ ride: n.id, title: L2('Drive to', 'ไปส่งที่') + ' ' + d.name, desc: n.pax, target: { x: d.x, z: d.z }, radius: 14, onArrive: async (g) => {
      g.task = null; const r = await G.net.rpc('ride', { op: 'finish', id: n.id }); G.applyServer(r); G.player.setPassenger(false);
      if (r.ok) { audio.cash(); ui.big(L2('Fare paid', 'ได้ค่าโดยสาร') + ' 👥', `${n.pax} · +${fmt(r.amount)}`); g.event('job'); } else { ui.toast('❌ ' + tr(r.err || 'Failed'), 'bad'); G.driveToDest(n); }
      return false; } });
  };
  // ---- passenger side: ride along on the driver's vehicle ----
  G.boardTick = (dt) => { if (!G.waitBoard) return; G._bw = (G._bw || 0) - dt; if (G._bw > 0) return; G._bw = 2; G.net.rpc('ride', { op: 'board', id: G.waitBoard }); };
  G.startFollow = (driverId, n) => { G.follow = { id: driverId, dest: n.dest }; ui.toast(L2(`🛵 On board — ${n.driver} is taking you to ${n.dest.name}`, `🛵 ขึ้นรถแล้ว — ${n.driver} กำลังพาไป ${n.dest.name}`)); audio.ping('pick'); };
  G.stopFollow = (dest) => { if (!G.follow) return; const f = G.follow; G.follow = null; G.player.emote = null; G.player.char.root.visible = true; const p = G.player.pos; G.player.teleport(dest ? dest.x + 2 : p.x + 1.5, dest ? dest.z + 2 : p.z); };
  // ---- sleep at home ----
  G.sleepHome = async () => {
    const h = G.profile.home; const H = h && HOUSING[h.type]; if (!H) return;
    ui.fade(true); G.player.emote = 'sleep'; audio.close(); await new Promise(r => setTimeout(r, 2600));
    const deco = Math.min(12, Object.keys(G.profile.inventory).reduce((s, i) => s + (ITEMS[i] && ITEMS[i].deco && G.profile.inventory[i] > 0 ? ITEMS[i].deco * 2 : 0), 0));
    G.stat('energy', H.energy); G.stat('health', H.health); G.stat('mood', H.mood + deco); G.player.emote = null; ui.fade(false);
    ui.big(L2('Good rest', 'นอนหลับสบาย') + ' 😴', L2(`${H.en} · energy +${H.energy}%`, `${H.th} · พลังงาน +${H.energy}%`)); G.save();
  };

  // ---- server notifications (players) ----
  G.onNotif = (n) => {
    const P = G.phone;
    if (n.type === 'dm') { if (P.open && P.app === 'msg:u_' + n.uid) { P.reloadDM && P.reloadDM(n.uid); audio.ping('blip'); return; } notifier.push({ app: 'msg', icon: '💬', title: n.name, text: n.text, sound: 'msg', onTap: () => P.openPhone('msg:u_' + n.uid) }); }
    else if (n.type === 'friend_request') notifier.push({ app: 'people', icon: '🤝', title: L2('Friend request', 'คำขอเป็นเพื่อน'), text: `${n.name} · ${facName(n.faculty)} · Lv ${n.level}`, sound: 'friend', actions: [{ label: L2('Accept', 'ยอมรับ'), primary: true, fn: async () => { const r = await G.net.rpc('soc', { op: 'friend', uid: n.uid }); if (r.ok) ui.toast(L2('🤝 You are now friends with ', '🤝 เป็นเพื่อนกับ') + n.name); } }, { label: L2('Profile', 'ดูโปรไฟล์'), fn: () => P.openPhone('people:' + n.uid) }] });
    else if (n.type === 'friend_accept') notifier.push({ app: 'people', icon: '🤝', title: n.name, text: L2('accepted your friend request', 'ยอมรับคำขอเป็นเพื่อนแล้ว'), sound: 'friend' });
    else if (n.type === 'invite') { const ACT = { eat: L2('eat together', 'ไปกินข้าว'), study: L2('study', 'อ่านหนังสือ'), futsal: L2('play futsal / basketball', 'เตะบอล / เล่นบาส'), gym: L2('work out', 'ออกกำลังกาย'), beach: L2('watch the sunset', 'ดูพระอาทิตย์ตก'), ride: L2('ride around', 'ขี่รถเล่น'), shop: L2('go shopping', 'ไปช้อปปิ้ง') }; notifier.push({ app: 'people', icon: '🎯', title: n.name, text: L2(`invites you to ${ACT[n.act] || n.act}`, `ชวนคุณ${ACT[n.act] || n.act}`) + (n.place ? ` · 📍 ${n.place}` : ''), sound: 'friend', ttl: 14000, actions: [{ label: L2('Go', 'ไป'), primary: true, fn: () => { if (n.pos) { G.waypoint = { x: n.pos[0], z: n.pos[1], name: n.name }; G.routeTimer = 0; } G.net.rpc('soc', { op: 'invite_reply', uid: n.uid, yes: true }); } }, { label: L2('Not now', 'ไม่ว่าง'), fn: () => G.net.rpc('soc', { op: 'invite_reply', uid: n.uid, yes: false }) }] }); }
    else if (n.type === 'invite_reply') notifier.push({ icon: n.yes ? '👍' : '🙏', title: n.name, text: n.yes ? L2('is on the way!', 'กำลังไปหา!') : L2('can\'t come right now', 'ไม่ว่างตอนนี้'), sound: 'msg' });
    else if (n.type === 'post') notifier.push({ app: 'feed', icon: n.post.media ? '📸' : '📰', title: `${n.post.name} · KU Feed`, text: n.post.text || L2('posted a photo', 'โพสต์รูป'), sound: 'social', quiet: P.open && P.app.startsWith('feed') });
    else if (n.type === 'like') notifier.push({ app: 'feed', icon: '♥', title: n.name, text: L2('liked your post', 'ถูกใจโพสต์ของคุณ') + (n.text ? `: ${n.text}` : ''), sound: 'social' });
    else if (n.type === 'comment') notifier.push({ app: 'feed', icon: '💬', title: n.name, text: L2('commented: ', 'แสดงความคิดเห็น: ') + n.text, sound: 'social' });
    else if (n.type === 'order_new') { if (G.riderMode) notifier.push({ app: 'ride', icon: '🥡', title: L2('Player order · ', 'ออเดอร์ผู้เล่น · ') + n.order.buyerName, text: `${n.order.shopName} → ${n.order.dest.name} · +${fmt(n.order.fee)}`, sound: 'order', actions: [{ label: L2('Deliver it', 'รับส่ง'), primary: true, fn: async () => { const q = await G.net.rpc('order', { op: 'accept', id: n.order.id }); if (!q.ok) return ui.toast('❌ ' + tr(q.err || 'Failed'), 'bad'); G.deliverPlayerOrder(q); } }, { label: L2('Skip', 'ข้าม'), fn: () => { } }] }); }
    else if (n.type === 'order_accepted') notifier.push({ app: 'ride', icon: '🛵', title: L2('Order accepted', 'มีไรเดอร์รับออเดอร์'), text: `${n.rider} ${L2('is getting your food', 'กำลังไปรับอาหารให้คุณ')}`, sound: 'order' });
    else if (n.type === 'order_picked') notifier.push({ app: 'ride', icon: '🛵', title: L2('On the way', 'กำลังไปส่ง'), text: `${n.rider} ${L2('picked up your food', 'รับอาหารแล้ว กำลังไปหาคุณ')}`, sound: 'order' });
    else if (n.type === 'order_npc') notifier.push({ app: 'ride', icon: '🛵', title: L2('Shop rider assigned', 'ร้านส่งไรเดอร์ให้แล้ว'), text: L2('No player took it — the restaurant\'s rider is bringing it.', 'ไม่มีผู้เล่นรับงาน — ไรเดอร์ของร้านกำลังนำมาส่ง'), sound: 'order' });
    else if (n.type === 'order_delivered') { audio.ping('money'); notifier.push({ app: 'ride', icon: '🥡', title: L2('Food delivered!', 'อาหารมาส่งแล้ว!'), text: Object.entries(n.items || {}).map(([id, q]) => `${ITEMS[id] ? ITEMS[id].icon + ' ' + L2(ITEMS[id].name, ITEMS[id].th) : id} ×${q}`).join(' · ') + L2(' — in your bag', ' — อยู่ในกระเป๋าแล้ว'), sound: 'order', actions: [{ label: L2('Open bag', 'เปิดกระเป๋า'), primary: true, fn: () => P.openPhone('bag') }] }); }
    else if (n.type === 'order_refunded') notifier.push({ icon: '↩️', title: L2('Order refunded', 'คืนเงินออเดอร์'), text: fmt(n.amount), sound: 'money' });
    else if (n.type === 'parcel') { audio.ping('money'); notifier.push({ app: 'shop', icon: '📦', title: L2('Parcel delivered', 'พัสดุมาส่งแล้ว'), text: [...Object.entries((n.items || {}).items || {}).map(([i, q]) => `${ITEMS[i] ? ITEMS[i].icon + ' ' + L2(ITEMS[i].name, ITEMS[i].th) : i} ×${q}`), ...((n.items || {}).clothes || []).map(c => '👕 ' + (CLOTHES[c] ? L2(CLOTHES[c].name, CLOTHES[c].th || CLOTHES[c].name) : c))].join(' · '), sound: 'order', actions: [{ label: L2('Open bag', 'เปิดกระเป๋า'), primary: true, fn: () => P.openPhone('bag') }] }); }
    else if (n.type === 'event_start') { G.campusEvent = n.event; const e = n.event; notifier.push({ icon: e.icon, title: L2('Campus event', 'กิจกรรมในมหาลัย'), text: L2(e.en, e.th) + L2(' — be there for a minute to get ฿150 + XP', ' — ไปร่วมสัก 1 นาที รับ ฿150 + XP'), sound: 'friend', ttl: 12000, urgent: true, actions: [{ label: L2('Go', 'ไปร่วม'), primary: true, fn: () => { G.waypoint = { x: e.pos[0], z: e.pos[1], name: L2(e.en, e.th) }; G.routeTimer = 0; } }, { label: L2('Later', 'ไว้ก่อน'), fn: () => { } }] }); }
    else if (n.type === 'event_end') { if (G.campusEvent && G.campusEvent.id === n.id) G.campusEvent = null; }
    else if (n.type === 'event_reward') { audio.levelUp(); ui.big(L2('Event reward!', 'ได้รางวัลกิจกรรม!'), `+${fmt(n.amount)} · +${n.xp} XP`); G.campusEvent = null; }
    else if (n.type === 'ride_new') { const r = n.ride; const v = G.player.vehicle; if ((v && v.type !== 'bicycle') || G.riderMode) notifier.push({ app: 'ride', icon: '👥', title: L2('Player needs a ride · ', 'ผู้เล่นเรียกรถ · ') + r.paxName, text: `${r.pickup.name || ''} → ${r.dest.name} · +${fmt(r.fare)}`, sound: 'order', actions: [{ label: L2('Pick up', 'ไปรับ'), primary: true, fn: () => G.acceptPlayerRide(r) }, { label: L2('Skip', 'ข้าม'), fn: () => { } }] }); }
    else if (n.type === 'ride_accepted') { notifier.push({ app: 'ride', icon: '🚗', title: L2('Driver on the way', 'คนขับกำลังมารับ'), text: `${n.driver} ${L2('accepted your ride — wait where you are', 'รับงานแล้ว — รอที่เดิมนะ')}`, sound: 'order' }); G.waitBoard = n.id; }
    else if (n.type === 'ride_boarded') { if (n.role === 'pax') { G.waitBoard = null; G.startFollow(n.driverId, n); } else { G.player.setPassenger(true); G.driveToDest(n); } }
    else if (n.type === 'ride_done') { G.stopFollow(n.dest); audio.ping('money'); ui.big(L2('Arrived!', 'ถึงแล้ว!'), `${n.dest.name} · ${L2('thanks', 'ขอบคุณ')} ${n.driver}`); G.myRide = null; }
    else if (n.type === 'ride_refunded') { G.stopFollow(); G.waitBoard = null; G.myRide = null; notifier.push({ icon: '↩️', title: L2('Ride refunded', 'คืนค่าโดยสาร'), text: fmt(n.amount), sound: 'money' }); }
    else if (n.type === 'ride_cancelled') { if (G.task && G.task.ride === n.id) G.task = null; G.player.setPassenger(false); notifier.push({ icon: '✋', title: L2('Ride cancelled', 'ยกเลิกการรับส่ง'), text: L2('The passenger cancelled.', 'ผู้โดยสารยกเลิกแล้ว'), sound: 'msg' }); }
    else if (n.type === 'ride_reopened') { G.waitBoard = null; notifier.push({ icon: '🔁', title: L2('Looking for another driver', 'กำลังหาคนขับใหม่'), text: L2('Your driver cancelled.', 'คนขับยกเลิก'), sound: 'msg' }); }
    else if (n.type === 'order_reopened') notifier.push({ app: 'ride', icon: '🔁', title: L2('Rider cancelled', 'ไรเดอร์ยกเลิก'), text: L2('Your order is waiting for another rider.', 'ออเดอร์ของคุณกำลังรอไรเดอร์คนใหม่'), sound: 'msg' });
  };
}
