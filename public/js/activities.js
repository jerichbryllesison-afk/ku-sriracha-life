// Place interactions, shops, jobs, classes, wardrobe, vehicles, phone apps.
import { TUNING } from '../shared/catalog.js';
import { ITEMS, SHOPS, CLOTHES, VEHICLES, HAIRSTYLES, HAIR_COLORS, JOBS, CLUBS, COURSES, FACULTIES, MAIN_QUESTS, SIDE_QUESTS, levelTitle, xpForLevel, RENTAL, QUIZ } from '../shared/catalog.js';
import { SERVICES, FUEL_PRICE } from '../shared/economy.js';
import { esc, fmt } from './ui.js';
import { runMinigame } from './minigames.js';
import { icon, splitLeadEmoji } from './icons.js';
const menuIcon = (e) => { if (!e) return icon('spark'); const sp = splitLeadEmoji(e); return sp.icon ? icon(sp.icon) : esc(e); };
import { CHATTER } from './npcs.js';
import { tr, L2 } from './i18n.js';

const EAT_NOW = new Set(['cafeteria', 'foodstreet', 'market', 'noodle', 'mookata', 'seafood', 'cafe', 'shabu', 'friedchicken', 'ramen', 'steak', 'finedining', 'bar', 'luxcafe', 'cinema']);
const FAC_BUILDING = { eng: 'B23', sci: 'B26', ms: 'B22', econ: 'B18', ims: 'B24' };

export function installActivities(G) {
  const ui = G.ui, audio = G.audio;
  const P = () => G.profile;
  const menu = (title, sub, options) => {
    ui.modal(`<h2>${esc(tr(title))}</h2><p class="sub">${esc(tr(sub || ''))}</p><div class="grid">${options.map((o, i) => `<button class="item" data-i="${i}" ${o.disabled ? 'disabled' : ''} style="cursor:pointer;text-align:left;${o.disabled ? 'opacity:.45' : ''}"><span class="mi">${menuIcon(o.icon)}</span><b>${esc(tr(o.label))}</b><small>${esc(tr(o.sub || ''))}</small>${o.price != null ? `<span class="price">${o.price ? fmt(o.price) : tr('Free')}</span>` : ''}</button>`).join('')}</div><div class="actions"><button class="btn ghost" id="mClose">${tr('Close')}</button></div>`, (root) => {
      root.querySelector('#mClose').onclick = () => ui.closeModal();
      root.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const o = options[+b.dataset.i]; if (o.disabled) return; audio.click(); if (!o.keep) ui.closeModal(); setTimeout(() => o.fn(), 30); });
    });
  };
  G.menu = menu;
  const jobOption = (id) => {
    const j = JOBS[id]; const p = P(); const req = j.req || {};
    const SK = { int: L2('INT', 'สติปัญญา'), fit: L2('FIT', 'ร่างกาย'), cha: L2('CHA', 'เสน่ห์'), drv: L2('DRV', 'ขับขี่') };
    const lock = p.level < j.level ? L2(`Requires level ${j.level}`, `ต้องเลเวล ${j.level}`) : Object.entries(req).find(([k, v]) => p.skills[k] < v) ? L2('Requires ', 'ต้องมี ') + Object.entries(req).map(([k, v]) => SK[k] + ' ' + v).join(', ') : null;
    return { icon: '💼', label: L2(`Work: ${j.name}`, `ทำงาน: ${j.th}`), sub: lock || L2(`${j.th} · ${fmt(j.pay[0])}–${fmt(j.pay[1])} · ${j.desc}`, `${fmt(j.pay[0])}–${fmt(j.pay[1])} ต่อกะ · ${j.name}`), disabled: !!lock, fn: () => G.doJob(id) };
  };
  // ---------------- place menus ----------------
  G.interactPlace = (pl) => {
    const p = P(); const opts = []; const k = pl.kind; const t = G.time();
    const add = (o) => opts.push(o);
    if (SHOPS[k]) add({ icon: '🛒', label: L2(SHOPS[k].name, SHOPS[k].th || SHOPS[k].name), sub: EAT_NOW.has(k) ? 'Eat here' : 'Buy items for your bag', fn: () => G.shop(k, pl) });
    switch (k) {
      case 'office': add({ icon: '🪪', label: 'Student ID card', sub: 'View your student record', fn: () => G.studentCard() }); add({ icon: '🎓', label: 'Change faculty / program', sub: 'Free, once per day', fn: () => G.changeMajor() }); break;
      case 'library': add({ icon: '📚', label: 'Study session', sub: '+Intelligence, +XP, −energy', fn: () => G.study() }); add(jobOption('library')); break;
      case 'lecture': case 'faculty': case 'lab': add({ icon: '🧑‍🏫', label: 'Attend class', sub: classSub(pl), fn: () => G.attendClass(pl) }); if (pl.id === 'B02') add(jobOption('lab')); if (pl.id === 'B06') add(jobOption('ta')); break;
      case 'cafeteria': add(jobOption('canteen')); break;
      case 'activity': add({ icon: '🎸', label: 'Clubs', sub: p.clubs.length ? 'Member of ' + p.clubs.map(c => CLUBS.find(x => x.id === c)?.name).join(', ') : 'Join a student club', fn: () => G.clubs() }); break;
      case 'hall': add(jobOption('banquet')); add({ icon: '🎤', label: 'Watch an event', sub: '+Mood, +Charisma', fn: () => G.simpleActivity('Campus event', '🎤', 5, { mood: 12 }, { cha: 0.8 }, 20) }); break;
      case 'gym': add({ icon: '🏋️', label: 'Workout', sub: 'Free for KU students · +Fitness', fn: () => G.workout(0) }); add({ icon: '🏀', label: L2('Play basketball', 'เล่นบาสเกตบอล'), sub: L2('Indoor court', 'สนามในร่ม'), fn: () => G.basketball() }); break;
      case 'fitness': add({ icon: '🏋️', label: 'Workout', sub: `Day pass ${fmt(SERVICES.gym)} · +Fitness (bonus)`, fn: () => G.workout(SERVICES.gym) }); break;
      case 'court': add({ icon: '⚽', label: 'Play futsal', sub: '+Fitness, +Charisma, +Mood', fn: () => G.futsal() }); add({ icon: '🏀', label: L2('Play basketball', 'เล่นบาสเกตบอล'), sub: L2('Shoot hoops · +Fitness, +Mood', 'ชู้ตลูก · ร่างกาย อารมณ์ดี'), fn: () => G.basketball() }); break;
      case 'pool': add({ icon: '🏊', label: 'Swim', sub: `Entry ${fmt(SERVICES.pool)} · swim laps in the pool`, fn: () => G.swimEntry(pl) }); add(jobOption('lifeguard')); break;
      case 'dorm': case 'condo': case 'hotel': {
        const h = p.home; const mine = h && h.place === pl.id;
        if (mine) add({ icon: '🛏️', label: L2(`Go to my room ${h.floor}${String(h.room).padStart(2, '0')} · sleep`, `กลับห้อง ${h.floor}${String(h.room).padStart(2, '0')} · นอนพัก`), sub: L2('Free — restores energy & health', 'ฟรี — ฟื้นพลังงานและสุขภาพ'), fn: () => G.sleepHome() });
        else if (k !== 'dorm') add({ icon: '🛏️', label: 'Rent a room & sleep', sub: fmt(SERVICES[k] || 450), fn: () => G.sleep(SERVICES[k] || 450) });
        if (k !== 'hotel' && !mine) add({ icon: '🏠', label: L2('Rooms here · move in', 'ดูห้องว่าง · ย้ายมาอยู่ที่นี่'), sub: L2('Budget, mid-range and luxury homes', 'ที่พักราคาประหยัด กลาง และหรู'), fn: () => G.phone.openPhone('house') });
        add({ icon: '👕', label: 'Wardrobe', sub: 'Change clothes', fn: () => G.wardrobe() }); break;
      }
      case 'garage': add({ icon: '🚲', label: 'Borrow a campus bicycle', sub: 'Free KU bike share', fn: () => G.spawnVehicle({ type: 'bicycle', color: '#f1c40f' }, true) }); break;
      case 'coop': add({ icon: '👔', label: 'KU Co-op clothing', sub: 'Uniforms, KU merch, bags', fn: () => G.clothesShop('coop') }); add({ icon: '📘', label: 'Books & stationery', sub: 'Boost your study', fn: () => G.shop('coopbooks', pl) }); break;
      case 'security': add(jobOption('taxi')); add({ icon: '📦', label: 'Lost & found', sub: 'Ask if anyone needs help', fn: () => G.offerSide('s_dorm') }); break;
      case 'pavilion': add({ icon: '🧘', label: 'Meditate', sub: '+Mood, calm your mind', fn: () => G.simpleActivity('Meditation', '🧘', 6, { mood: 18, energy: 4 }, {}, 15) }); break;
      case 'farm': add(jobOption('farm')); break;
      case 'cafe': add(jobOption('barista')); break;
      case 'mart': add(jobOption('cashier')); break;
      case 'fashion': add({ icon: '👗', label: 'Clothes', sub: 'Tops, jeans, dresses, shoes, hats', fn: () => G.clothesShop('fashion') }); break;
      case 'barber': add({ icon: '💇', label: 'Haircut & color', sub: 'New look', fn: () => G.barber() }); break;
      case 'bank': add({ icon: '🏦', label: 'Banking', sub: 'Balance, history, transfers', fn: () => G.bankApp(true) }); break;
      case 'moto': add({ icon: '🛵', label: 'Buy a bike / scooter', sub: 'Bicycles, scooters, big bikes', fn: () => G.vehicleShop('moto') }); add({ icon: '🔑', label: `Rent a scooter (${fmt(RENTAL.price)})`, sub: 'Use it until you log off', fn: () => G.rentScooter() }); add({ icon: '⛑️', label: 'Helmet', sub: 'Safety first', fn: () => G.clothesShop('moto') }); break;
      case 'cars': add({ icon: '🚗', label: 'Buy a car', sub: 'Hatchbacks to supercars', fn: () => G.vehicleShop('cars') }); break;
      case 'gas': add({ icon: '⛽', label: 'Refuel', sub: `${FUEL_PRICE} ฿/L`, fn: () => G.refuel() }); add(jobOption('fuel')); break;
      case 'clinic': break;
      case 'stadium': add({ icon: '🏃', label: 'Run laps', sub: 'Run the 400 m track — checkpoints count automatically', fn: () => { ui.toast('🏃 Run around the red track!'); G.waypoint = G.world.pois.trackStart; } }); break;
      case 'residence': add({ icon: '🚪', label: 'Knock on the door', sub: 'Staff housing', fn: () => ui.toast('Nobody answers… 🚪') }); break;
      case 'mall':
        add({ icon: '👗', label: L2('Brand fashion', 'แฟชั่นแบรนด์'), sub: 'NOVA · Riva · Mono · Stride · Urban Tide…', fn: () => G.clothesShop('mall') });
        add({ icon: '📱', label: L2('Gadget store', 'ร้านไอที'), sub: L2('Phones, laptops, watches', 'มือถือ โน้ตบุ๊ก นาฬิกา'), fn: () => G.shop('gadget', pl) });
        add({ icon: '💄', label: L2('Beauty store', 'ร้านเครื่องสำอาง'), sub: L2('Skincare, make-up, perfume', 'สกินแคร์ เมคอัพ น้ำหอม'), fn: () => G.shop('beauty', pl) });
        add({ icon: '🛋️', label: L2('Home decor', 'ของแต่งห้อง'), sub: L2('Make your room nicer (+mood when you sleep)', 'แต่งห้องให้น่าอยู่ (นอนแล้วอารมณ์ดีขึ้น)'), fn: () => G.shop('homedeco', pl) });
        add({ icon: '🍗', label: L2('Food court', 'ศูนย์อาหาร'), sub: L2('Fried chicken & burgers', 'ไก่ทอด เบอร์เกอร์'), fn: () => G.shop('friedchicken', pl) });
        add({ icon: '🎬', label: L2('Cinema · watch a movie (฿180)', 'โรงหนัง · ดูหนัง (฿180)'), sub: L2('+Mood, rest your legs', 'อารมณ์ดี พักขา'), fn: async () => { const r = await G.buy('service', 'cinema'); if (r.ok) { G.shop('cinema', pl); G.simpleActivity(L2('Movie', 'ดูหนัง'), '🎬', 8, { mood: 22, energy: 4 }, {}, 20); } } });
        break;
      case 'bar': add({ icon: '🎸', label: L2('Watch the live band', 'ดูดนตรีสด'), sub: L2('+Mood, +Charisma — music all afternoon', 'อารมณ์ดี เสน่ห์เพิ่ม'), fn: () => { audio.init(); audio.resume(); G.liveBand = performance.now(); G.simpleActivity(L2('Live band', 'ดนตรีสด'), '🎸', 7, { mood: 18 }, { cha: 0.8 }, 25); } }); break;
      case 'tuning': add({ icon: '🔧', label: L2('Repair, tuning & paint', 'ซ่อม แต่ง และทำสีรถ'), sub: L2('Bring the vehicle you want to work on', 'นำรถที่ต้องการแต่งมาด้วย'), fn: () => G.garageShop() }); break;
      case 'stadium': add({ icon: '🤸', label: L2('Outdoor workout (free)', 'ออกกำลังกายกลางแจ้ง (ฟรี)'), sub: L2('+Fitness', '+ร่างกาย'), fn: () => G.workout(0) }); break;
    }
    if ((k === 'market' || k === 'seafood') && Object.keys(p.inventory).some(i => ITEMS[i] && ITEMS[i].cat === 'fish')) add({ icon: '🐟', label: L2('Sell your catch', 'ขายปลาที่ตกได้'), sub: L2('Fresh fish for the restaurants', 'ร้านรับซื้อปลาสด'), fn: () => G.sellFish() });
    if (p.biz && p.biz.place === pl.id) add({ icon: '🍳', label: L2(`My shop · cook orders (${(G.bizQueue || []).length})`, `ร้านของฉัน · ทำออเดอร์ (${(G.bizQueue || []).length})`), sub: L2('Cook the next customer order, then deliver it', 'ทำออเดอร์ถัดไปแล้วไปส่งลูกค้า'), fn: () => G.cookOrder() });
    else if (!p.biz && (k === 'foodstreet' || k === 'market')) add({ icon: '🏪', label: L2('Open your own stall here', 'เปิดร้านของตัวเองที่นี่'), sub: L2('Run a food business', 'ทำธุรกิจร้านอาหาร'), fn: () => G.phone.openPhone('biz') });
    // side quests starting/ending here
    for (const sq of SIDE_QUESTS) if (sq.from === pl.id) add({ icon: '❗', label: L2(`Task: ${sq.title}`, `ภารกิจ: ${sq.th}`), sub: `${sq.giver} — ${L2(sq.desc, sq.desc_th)}`, fn: () => G.offerSide(sq.id) });
    menu(`${pl.th || pl.name}`, pl.name + (k === 'lecture' || k === 'faculty' ? L2(' · Class hours 08:00–17:00', ' · เวลาเรียน 08:00–17:00') : ''), opts.length ? opts : [{ icon: '👀', label: 'Look around', sub: 'Nothing to do here yet', fn: () => {} }]);
  };
  const classSub = (pl) => { const t = G.time(); const open = t.hour >= 8 && t.hour < 17; const taken = (G.flags.classDay === t.day ? G.flags.classCount : 0); return open ? (taken >= 3 ? 'No more classes today' : 'Quiz-based lecture · +INT, GPA, XP') : 'Closed — classes run 08:00–17:00'; };
  // ---------------- shopping ----------------
  G.shop = (key, pl) => {
    const sh = SHOPS[key]; const eatNow = EAT_NOW.has(key);
    const render = () => ui.modal(`<h2>${esc(sh.name)}</h2><p class="sub">${L2('Balance', 'ยอดเงิน')} ${fmt(P().money)} · ${eatNow ? L2('Food is served immediately', 'สั่งแล้วกินทันที') : L2('Items go to your bag (phone → Bag)', 'ของจะเข้ากระเป๋า (โทรศัพท์ → กระเป๋า)')}</p><div class="grid">${sh.items.map(id => { const it = ITEMS[id]; const fx = Object.entries(it.e || {}).map(([k, v]) => `${{ hunger: '🍜', energy: '⚡', health: '❤️', mood: '😊' }[k]}${v > 0 ? '+' : ''}${v}`).join(' '); return `<div class="item"><span class="ic">${it.icon}</span><b>${esc(L2(it.name, it.th || it.name))}</b><small>${esc(L2(it.th || '', it.name))} · ${fx}</small><span class="price">${fmt(it.price)}</span><button class="btn" data-id="${id}">${eatNow ? tr('Order') : tr('Buy')}</button></div>`; }).join('')}</div><div class="actions"><button class="btn ghost" id="mClose">${tr('Done')}</button></div>`, (root) => {
      root.querySelector('#mClose').onclick = () => ui.closeModal();
      root.querySelectorAll('[data-id]').forEach(b => b.onclick = async () => {
        const id = b.dataset.id; b.disabled = true; const r = await G.buy('item', id, 1);
        if (r.ok) { if (eatNow) { G.useItem(id); G.event('eat', key); } else ui.toast(`🛍️ ${ITEMS[id].icon} added to bag`); }
        render();
      });
    });
    render();
  };
  G.clothesShop = (shopKey) => {
    const items = Object.entries(CLOTHES).filter(([, c]) => c.shop === shopKey);
    const render = () => ui.modal(`<h2>${shopKey === 'coop' ? 'KU Co-op · สหกรณ์' : shopKey === 'moto' ? 'Helmets' : shopKey === 'mall' ? L2('Brand Fashion · Mall', 'แฟชั่นแบรนด์ · ห้าง') : 'Clothing Store'}</h2><p class="sub">${L2('Balance', 'ยอดเงิน')} ${fmt(P().money)} · ${L2('bought items appear in your Wardrobe', 'ของที่ซื้อจะอยู่ในตู้เสื้อผ้า')}</p><div class="grid">${items.map(([id, c]) => { const own = P().wardrobe.includes(id); const lock = c.level && P().level < c.level; return `<div class="item"><div class="sw" style="background:${c.color}"></div><b>${esc(c.name)}</b><small>${esc(c.th || c.slot)} · ${c.slot}</small><span class="price">${own ? tr('Owned') : fmt(c.price)}</span>${own ? `<button class="btn ghost" data-wear="${id}">${tr('Wear')}</button>` : `<button class="btn" data-id="${id}" ${lock ? 'disabled' : ''}>${lock ? L2('Lv ', 'เลเวล ') + c.level : tr('Buy')}</button>`}</div>`; }).join('')}</div><div class="actions"><button class="btn ghost" id="mWard">${tr('Open wardrobe')}</button><button class="btn ghost" id="mClose">${tr('Done')}</button></div>`, (root) => {
      root.querySelector('#mClose').onclick = () => ui.closeModal(); root.querySelector('#mWard').onclick = () => G.wardrobe();
      root.querySelectorAll('[data-id]').forEach(b => b.onclick = async () => { b.disabled = true; const r = await G.buy('cloth', b.dataset.id); if (r.ok) { ui.toast('👕 Purchased!'); G.wear(b.dataset.id); G.event('buy', b.dataset.id.startsWith('uniform') ? 'uniform' : 'cloth'); } render(); });
      root.querySelectorAll('[data-wear]').forEach(b => b.onclick = () => { G.wear(b.dataset.wear); render(); });
    });
    render();
  };
  G.wear = (id) => { const c = CLOTHES[id]; if (!c) return; const look = { ...P().look }; look[c.slot] = look[c.slot] === id && ['hat', 'glasses', 'bag'].includes(c.slot) ? null : id; P().look = look; G.player.setLook(look); G.save(); audio.click(); };
  G.wardrobe = () => {
    const slots = ['top', 'bottom', 'shoes', 'hat', 'glasses', 'bag'];
    const render = () => { const look = P().look; ui.modal(`<h2>Wardrobe · ตู้เสื้อผ้า</h2><p class="sub">Click to wear · click again to remove accessories</p>${slots.map(s => `<h4 style="margin:10px 0 6px;text-transform:capitalize">${s}</h4><div class="chips">${P().wardrobe.filter(id => CLOTHES[id] && CLOTHES[id].slot === s).map(id => `<button data-id="${id}" class="${look[s] === id ? 'on' : ''}" style="border-left:8px solid ${CLOTHES[id].color}">${esc(CLOTHES[id].name)}</button>`).join('') || '<small style="color:var(--muted)">None owned — visit the Co-op or Sriracha Fashion</small>'}</div>`).join('')}<div class="actions"><button class="btn" id="mClose">Done</button></div>`, (root) => { root.querySelector('#mClose').onclick = () => ui.closeModal(); root.querySelectorAll('[data-id]').forEach(b => b.onclick = () => { G.wear(b.dataset.id); render(); }); }); };
    render();
  };
  G.barber = () => {
    const look = () => P().look;
    const render = () => ui.modal(`<h2>Barber & Salon · ร้านตัดผม</h2><p class="sub">Balance ${fmt(P().money)}</p><h4>Hairstyle</h4><div class="chips">${HAIRSTYLES.map(h => `<button data-h="${h.id}" class="${look().hair === h.id ? 'on' : ''}">${h.name} · ${P().hairs.includes(h.id) ? 'owned' : fmt(h.price)}</button>`).join('')}</div><h4>Color (฿60)</h4><div class="swatches">${HAIR_COLORS.map(c => `<i data-c="${c}" style="background:${c}" class="${look().hairColor === c ? 'on' : ''}"></i>`).join('')}</div><div class="actions"><button class="btn" id="mClose">Done</button></div>`, (root) => {
      root.querySelector('#mClose').onclick = () => ui.closeModal();
      root.querySelectorAll('[data-h]').forEach(b => b.onclick = async () => { const id = b.dataset.h; if (!P().hairs.includes(id)) { const r = await G.buy('hair', id); if (!r.ok) return; } P().look = { ...look(), hair: id }; G.player.setLook(P().look); G.save(); render(); });
      root.querySelectorAll('[data-c]').forEach(b => b.onclick = async () => { const r = await G.buy('service', 'haircolor'); if (!r.ok) return; P().look = { ...look(), hairColor: b.dataset.c }; G.player.setLook(P().look); G.save(); render(); });
    });
    render();
  };
  // tuning / paint / repair shop (server prices and checks that you are at the garage)
  G.garageShop = () => {
    const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
    let sel = 0;
    const render = () => {
      const list = P().vehicles || []; if (!list.length) return ui.modal(`<h2>🔧 ${L2('Auto Garage & Tuning', 'อู่ซ่อมและแต่งรถ')}</h2><p>${L2('You have no vehicle yet.', 'คุณยังไม่มีรถ')}</p><div class="actions"><button class="btn" id="mClose">OK</button></div>`, (r) => r.querySelector('#mClose').onclick = () => ui.closeModal());
      sel = Math.min(sel, list.length - 1); const v = list[sel]; const V = VEHICLES[v.type] || {}; const cls = V.cls || 'car'; const B = TUNING.base[cls] || TUNING.base.car; const md = v.mods || {}; const cond = Math.round((v.condition ?? 1) * 100);
      const parts = Object.entries(TUNING.parts).filter(([k]) => !(cls === 'bike' && k === 'exhaust')).map(([k, [en, th]]) => { const lv = md[k] || 0, mx = TUNING.max[k]; return `<div class="item"><span class="ic">${k === 'engine' ? '⚙️' : k === 'handling' ? '🛞' : k === 'brakes' ? '🛑' : '💨'}</span><span><b>${L2(en, th)}</b> ${'●'.repeat(lv)}${'○'.repeat(mx - lv)}<br><small>${lv >= mx ? L2('Maxed', 'สูงสุดแล้ว') : L2('Next: ', 'ขั้นถัดไป: ') + fmt(B[k] * (lv + 1))}</small></span>${lv < mx ? `<button class="btn gold" data-tune="${k}">${L2('Upgrade', 'อัปเกรด')}</button>` : ''}</div>`; }).join('');
      const pal = [...new Set([...(V.colors || []), ...TUNING.paints])].map(c => `<button class="sw-c ${c === v.color ? 'on' : ''}" data-paint="${c}" style="background:${c}"></button>`).join('');
      ui.modal(`<h2>🔧 ${L2('Auto Garage & Tuning', 'อู่ซ่อมและแต่งรถ')}</h2><p class="sub">${L2('Balance', 'ยอดเงิน')} ${fmt(P().money)}</p>
        <div class="seg" style="flex-wrap:wrap">${list.map((x, i) => `<button data-sel="${i}" class="${i === sel ? 'on' : ''}">${esc(VEHICLES[x.type]?.name || x.type)}</button>`).join('')}</div>
        <div class="card"><b>${esc(V.name || v.type)}</b><p>${L2('Condition', 'สภาพรถ')} <b style="color:${cond < 60 ? 'var(--bad)' : 'var(--ok)'}">${cond}%</b>${cond < 100 ? ` · <button class="btn" data-repair>${L2('Repair', 'ซ่อม')} ${fmt(Math.max(50, Math.round((1 - (v.condition ?? 1)) * B.repair)))}</button>` : ''}</p></div>
        <div class="list">${parts}</div><div class="card"><b>${L2('Paint', 'ทำสี')}</b> · ${fmt(B.paint)}<div class="swatches">${pal}</div></div>
        <div class="actions"><button class="btn ghost" id="mClose">${tr('Close')}</button></div>`, (root) => {
        root.querySelector('#mClose').onclick = () => ui.closeModal();
        root.querySelectorAll('[data-sel]').forEach(b => b.onclick = () => { sel = +b.dataset.sel; render(); });
        const go = async (d) => { const r = await G.net.rpc('garage', { ...d, vid: v.vid, rid: rid() }); G.applyServer(r); if (r.ok) { audio.cash(); audio.ping('order'); ui.toast(`🔧 ${fmt(r.price)}`, 'gold'); } else ui.toast('❌ ' + tr(r.err || 'Failed'), 'bad'); render(); };
        root.querySelectorAll('[data-tune]').forEach(b => b.onclick = () => go({ op: 'tune', part: b.dataset.tune }));
        root.querySelectorAll('[data-paint]').forEach(b => b.onclick = () => go({ op: 'paint', color: b.dataset.paint }));
        const rp = root.querySelector('[data-repair]'); if (rp) rp.onclick = () => go({ op: 'repair' });
      });
    };
    if (!G.net.online) return ui.toast(L2('The garage needs the online server', 'อู่ต้องออนไลน์'), 'bad');
    render();
  };
  G.vehicleShop = (shopKey) => {
    const list = Object.entries(VEHICLES).filter(([, v]) => v.shop === shopKey && !v.retired);
    const sel = {};
    const render = () => ui.modal(`<h2>${shopKey === 'moto' ? 'Motorbike Shop · ร้านมอเตอร์ไซค์' : 'Car Showroom · โชว์รูมรถยนต์'}</h2><p class="sub">${L2('Balance', 'ยอดเงิน')} ${fmt(P().money)} · ${L2('Garage', 'โรงรถ')} ${P().vehicles.length}/6 · ${L2('call your vehicles from the phone Garage app', 'เรียกรถได้จากแอปโรงรถในโทรศัพท์')}</p><div class="grid">${list.map(([id, v]) => { const c = sel[id] || v.colors[0]; const lock = P().level < v.level; return `<div class="item"><span class="ic">${v.type === 'bicycle' ? '🚲' : ['car', 'pickup', 'sedan', 'super'].includes(v.type) ? '🚗' : '🛵'}</span><b>${esc(v.name)}</b><small>${esc(v.th)} · top ${Math.round(v.top * 3.6)} km/h</small><div class="swatches">${v.colors.map(cc => `<i data-v="${id}" data-c="${cc}" style="background:${cc}" class="${cc === c ? 'on' : ''}"></i>`).join('')}</div><span class="price">${fmt(v.price)}</span><button class="btn" data-buy="${id}" ${lock ? 'disabled' : ''}>${lock ? L2('Requires Lv ', 'ต้องเลเวล ') + v.level : tr('Buy')}</button></div>`; }).join('')}</div><div class="actions"><button class="btn ghost" id="mClose">${tr('Close')}</button></div>`, (root) => {
      root.querySelector('#mClose').onclick = () => ui.closeModal();
      root.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { sel[b.dataset.v] = b.dataset.c; render(); });
      root.querySelectorAll('[data-buy]').forEach(b => b.onclick = async () => { const id = b.dataset.buy; const color = sel[id] || VEHICLES[id].colors[0]; b.disabled = true; const r = await G.buy('vehicle', id, 1, color); if (r.ok) { ui.big('NEW RIDE!', VEHICLES[id].name); G.event('buy', 'vehicle'); ui.closeModal(); G.spawnVehicle({ ...P().vehicles[P().vehicles.length - 1], slot: P().vehicles.length - 1 }); G.addXP(60, '', 'srv'); } else render(); });
    });
    render();
  };
  G.rentScooter = async () => { if (G.rental) return ui.toast('You already rented a scooter'); const r = await G.buy('rent', 'wave'); if (r.ok) { G.rental = true; G.spawnVehicle({ type: 'wave', color: '#2c3e50', rental: true }); G.event('buy', 'vehicle'); ui.toast('🔑 Scooter rented — press F to ride'); } };
  G.refuel = async () => {
    const v = G.player.vehicle || G.lastVehicle; if (!v || !v.spec.tank) return ui.toast('Bring your motorbike or car here first');
    const liters = Math.ceil((1 - v.fuel) * v.spec.tank); if (liters <= 0) return ui.toast('Tank is already full ⛽');
    const r = await G.buy('fuel', 'fuel', liters); if (r.ok) { v.fuel = 1; if (v.slot != null && P().vehicles[v.slot]) P().vehicles[v.slot].fuel = 1; ui.toast(`⛽ Filled ${liters} L for ${fmt(r.cost)}`); }
  };
  // ---------------- activities ----------------
  const busy = (why) => { if (P().stats.energy < 8) { ui.toast('😴 Too tired — sleep or have an energy drink', 'bad'); return true; } return false; };
  G.simpleActivity = async (title, icon, secs, stats, skills, xp, cost = 0) => {
    if (cost) { const r = await G.buy('service', title === 'Workout' ? 'gym' : 'pool'); if (!r.ok) return; }
    G.player.emote = 'think'; const s = await runMinigame(ui, audio, 'progress', { title, icon, time: secs }); G.player.emote = null;
    if (s == null) return; for (const [k, v] of Object.entries(stats)) G.stat(k, v); for (const [k, v] of Object.entries(skills)) G.skill(k, v); if (xp) G.addXP(xp, title, 'activity');
  };
  G.study = async () => {
    if (busy()) return; const now = performance.now(); if (now - (G.flags.studyAt || 0) < 25000) return ui.toast('Take a short break before studying again ☕');
    G.flags.studyAt = now; G.player.emote = 'think';
    const s = await runMinigame(ui, audio, 'progress', { title: 'Studying at the library', sub: 'หอสมุดอนุสรณ์ 10 ปี', icon: '📖', time: 6 }); G.player.emote = null;
    if (s == null) return; const lap = Object.keys(P().inventory).filter(i => ITEMS[i] && ITEMS[i].gadget === 'laptop' && P().inventory[i] > 0).reduce((m, i) => Math.max(m, ITEMS[i].study || 1), 1); const bonus = Math.max(P().inventory.textbook ? 1.3 : 1, lap);
    G.skill('int', 1.4 * bonus); G.stat('energy', -6); G.stat('mood', -1); G.addXP(30 * bonus, 'study', 'study'); P().counters.studies++; G.event('study');
  };
  G.attendClass = async (pl) => {
    const t = G.time(); if (t.hour < 8 || t.hour >= 17) return ui.toast('⏰ Classes run 08:00–17:00 (game time)');
    if (G.flags.classDay !== t.day) { G.flags.classDay = t.day; G.flags.classCount = 0; }
    if (G.flags.classCount >= 3) return ui.toast('You attended enough classes today 📚');
    if (busy()) return;
    const fac = P().faculty; const own = FAC_BUILDING[fac] === pl.id;
    const courses = COURSES[fac] || COURSES.eng; const course = courses[(t.day * 3 + G.flags.classCount) % courses.length];
    const s = await runMinigame(ui, audio, 'quiz', { title: L2(`Lecture: ${course}`, `เข้าเรียน: ${course}`), sub: `${pl.th || pl.name}${own ? L2(' · your faculty (+50% XP)', ' · คณะของคุณ (XP +50%)') : ''} · ${L2('answer the professor\'s questions', 'ตอบคำถามของอาจารย์')}`, rounds: 3, time: 12 + P().skills.int / 10 });
    if (s == null) return;
    G.flags.classCount++; const p = P();
    p.classes++; p.credits += 3; p.gradePoints += s * 4; p.gpa = Math.round(p.gradePoints / p.classes * 100) / 100; p.year = Math.min(4, 1 + Math.floor(p.credits / 36));
    G.skill('int', 1 + s * 2); G.stat('energy', -8); G.addXP((50 + s * 50) * (own ? 1.5 : 1), 'class', 'class'); G.event('class');
    ui.big(s >= 0.67 ? 'Great class!' : s > 0 ? 'Class attended' : 'Keep studying…', `Score ${Math.round(s * 100)}% · GPA ${p.gpa.toFixed(2)}`);
  };
  G.workout = async (cost) => {
    if (busy()) return; if (cost) { const r = await G.buy('service', 'gym'); if (!r.ok) return; }
    G.player.emote = 'pushup'; const s = await runMinigame(ui, audio, 'timing', { title: 'Workout 🏋️', sub: 'Lift when the marker hits the green zone', rounds: 6 }); G.player.emote = null;
    if (s == null) return; G.skill('fit', 1 + s * 3 * (cost ? 1.3 : 1)); G.stat('energy', -12); G.stat('mood', 6); G.stat('health', 3); G.addXP(20 + s * 30, 'workout', 'workout');
  };
  G.basketball = async () => {
    if (busy()) return; const s = await runMinigame(ui, audio, 'timing', { title: L2('Basketball 🏀', 'บาสเกตบอล 🏀'), sub: L2('Release when the marker is in the green — swish!', 'ปล่อยลูกตอนเข็มอยู่ช่องเขียว — ลงห่วง!'), rounds: 6 });
    if (s == null) return; G.skill('fit', 1 + s * 2); G.stat('mood', 9); G.stat('energy', -11); G.addXP(25 + s * 35, L2('basketball', 'บาสเกตบอล'), 'futsal');
    ui.big(s >= 0.8 ? L2('On fire! 🔥', 'มือร้อน! 🔥') : s >= 0.5 ? L2('Nice game', 'เกมดี') : L2('Keep practising', 'ฝึกต่อไป'), `${Math.round(s * 6)}/6 ${L2('shots', 'ลูก')}`);
  };
  G.sellFish = async () => { const r = await G.net.rpc('sellfish', { rid: (Math.random() * 1e16).toString(36) + Date.now().toString(36) }); G.applyServer(r); if (r.ok) { audio.cash(); ui.toast(L2(`🐟 Sold ${r.sold} for ${fmt(r.amount)}`, `🐟 ขายได้ ${r.sold} ตัว ${fmt(r.amount)}`), 'gold'); } else ui.toast('❌ ' + tr(r.err || 'Failed'), 'bad'); };
  G.fishing = async () => {
    if (!G.net.online) return ui.toast(L2('Fishing needs the online server', 'ตกปลาต้องออนไลน์'), 'bad');
    if (busy()) return; G.player.emote = 'think';
    const s = await runMinigame(ui, audio, 'timing', { title: L2('Fishing 🎣', 'ตกปลา 🎣'), sub: L2('Strike when the float dips into the green zone', 'กระตุกเบ็ดตอนทุ่นจมลงช่องเขียว'), rounds: 3 }); G.player.emote = null;
    if (s == null) return; const r = await G.net.rpc('fish', { s }); G.applyServer(r); G.stat('energy', -3); G.stat('mood', 4);
    if (!r.ok) return ui.toast('🎣 ' + tr(r.err || 'Nothing'), 'bad');
    if (!r.caught) return ui.toast(L2('🎣 It got away…', '🎣 หลุดไปแล้ว…'));
    const it = ITEMS[r.caught]; audio.ping('order'); ui.big(r.caught === 'boot_old' ? L2('An old boot… 🥾', 'ได้รองเท้าบูทเก่า… 🥾') : L2('Fish on! 🎣', 'ได้ปลา! 🎣'), `${it.icon} ${L2(it.name, it.th)}${it.sell > 1 ? ' · ' + L2('sell', 'ขายได้') + ' ' + fmt(it.sell) : ''}`);
  };
  G.futsal = async () => {
    if (busy()) return; const s = await runMinigame(ui, audio, 'keys', { title: 'Futsal match ⚽', sub: 'Pass the ball — hit the keys in order', rounds: 5 });
    if (s == null) return; G.skill('fit', 1 + s * 2); G.skill('cha', 0.6); G.stat('mood', 10); G.stat('energy', -12); G.addXP(25 + s * 35, 'futsal', 'futsal');
  };
  G.swimEntry = async (pl) => { const r = await G.buy('service', 'pool'); if (!r.ok) return; G.player.teleport(pl.x, pl.z); ui.toast('🏊 Swim around to train Fitness'); };
  G.sleep = async (cost) => {
    if (cost) { const r = await G.buy('service', cost === SERVICES.condo ? 'condo' : 'hotel'); if (!r.ok) return; }
    ui.fade(true); G.player.emote = 'sleep'; audio.close();
    await new Promise(r => setTimeout(r, 2600));
    G.stat('energy', 65); G.stat('health', 15); G.stat('mood', 5); G.player.emote = null; ui.fade(false); ui.big('Good rest 😴', 'Energy restored'); G.save();
  };
  G.clubs = () => {
    const p = P(); const t = G.time();
    menu('Student Activity Center · ศูนย์กิจกรรม', 'Join up to 2 clubs · visit daily for club activities', CLUBS.map(c => {
      const member = p.clubs.includes(c.id);
      return { icon: member ? '⭐' : '🎯', label: L2((member ? 'Club activity: ' : 'Join: ') + c.name, (member ? 'กิจกรรมชมรม: ' : 'สมัคร: ') + c.th), sub: L2(c.th, c.name) + (member ? L2(` · daily +XP & ${c.skill.toUpperCase()}`, ' · ทำได้ทุกวัน +XP') : ''), disabled: !member && p.clubs.length >= 2, fn: () => {
        if (!member) { p.clubs.push(c.id); G.event('club'); audio.quest(); ui.big('Welcome to the club!', c.name); G.addXP(40, '', 'club'); G.save(); return; }
        if (G.flags['club_' + c.id] === t.day) return ui.toast('Come back tomorrow for the next activity');
        G.flags['club_' + c.id] = t.day; G.simpleActivity(c.name, '🎯', 5, { mood: 10 }, { [c.skill]: 2.5 }, 60);
      } };
    }));
  };
  G.changeMajor = () => {
    const t = G.time(); if (G.flags.majorDay === t.day) return ui.toast('You can change program once per game day');
    menu('Change faculty', 'Your classes and faculty building change', FACULTIES.map(f => ({ icon: '🎓', label: L2(f.name, f.th), sub: L2(f.th, f.name), fn: () => { P().faculty = f.id; P().program = f.programs[0]; G.flags.majorDay = t.day; ui.toast('🎓 Faculty changed to ' + f.name); G.save(); } })));
  };
  G.studentCard = () => {
    const p = P(); const f = FACULTIES.find(x => x.id === p.faculty) || FACULTIES[0];
    ui.modal(`<div style="display:flex;gap:16px;align-items:center"><div class="avatar" style="width:84px;height:84px;font-size:30px">${esc(p.name.slice(0, 2).toUpperCase())}</div><div><h2 style="margin:0">${esc(p.name)}</h2><p class="sub" style="margin:2px 0">${esc(f.th)}<br>${esc(f.name)}<br>${esc(p.program || f.programs[0])}</p></div></div>
      <div class="card"><p>Student ID <b>${p.studentId}</b> · Year ${p.year} · ${levelTitle(p.level)}</p><p>GPA <b>${(p.gpa || 0).toFixed(2)}</b> · Credits ${p.credits} · Classes ${p.classes}</p><p>${L2('Playtime', 'เวลาเล่นรวม')} ${(() => { const s = G.playtime ? G.playtime() : 0; return `${Math.floor(s / 3600)}h ${Math.floor(s / 60) % 60}m`; })()}</p><p>Kasetsart University Sriracha Campus · 199 Sukhumvit Rd, Thung Sukhla, Si Racha, Chonburi</p></div><div class="actions"><button class="btn" id="mClose">OK</button></div>`, (r) => r.querySelector('#mClose').onclick = () => ui.closeModal());
  };
  // ---------------- jobs ----------------
  G.doJob = async (id) => {
    const j = JOBS[id]; const p = P();
    if (busy()) return;
    const now = performance.now(); if (now - (G.flags['job_' + id] || 0) < 15000) return ui.toast('Your next shift starts in a few seconds…');
    if (j.game === 'route') { if (id === 'delivery') return G.startDelivery(); if (id === 'taxi') return G.startTaxi(); return G.phone.openPhone(id === 'bizdel' ? 'biz' : 'ride'); }
    const tk = await G.jobStart(id); if (!tk.ok) return; // online: the server issues a single-use shift ticket and computes the wage
    G.flags['job_' + id] = now;
    G.player.emote = 'work';
    const icons = id === 'library' ? ['📕', '📘', '📗', '📒'] : id === 'lab' ? ['🔴', '🔵', '🟢', '🟡'] : undefined;
    const s = await runMinigame(ui, audio, j.game, { title: L2(`${j.name} · ${j.th}`, j.th), sub: L2(j.desc, j.name), rounds: j.game === 'quiz' ? 4 : 5, icons, questions: QUIZ });
    G.player.emote = null;
    if (s == null) { G.jobCancel(tk.jid); return; }
    const skillB = 1 + (p.skills[j.skill] || 0) / 200;
    const pay = Math.round((j.pay[0] + (j.pay[1] - j.pay[0]) * s) * skillB * (s > 0 ? 1 : 0.3)); // offline estimate only
    const r = await G.jobFinish(tk.jid, s, pay, id);
    G.stat('energy', -j.energy); G.skill(j.skill, 0.6 + s); G.addXP(j.xp * (0.4 + s), '', 'srv'); p.counters.jobs++; G.event('job');
    if (s >= 0.8 && r.ok) ui.big('Excellent work!', `${L2(j.name, j.th)} · ${fmt(r.amount ?? pay)}`);
  };
  const restaurantPlaces = () => Object.values(G.world.places).filter(pl => ['cafeteria', 'foodstreet', 'market', 'noodle', 'mookata', 'cafe', 'mart', 'seafood'].includes(pl.kind));
  const destinations = () => { const out = []; for (const pl of Object.values(G.world.places)) out.push({ x: pl._door.x, z: pl._door.z, name: pl.th || pl.name, kind: pl.kind }); for (const b of G.world.deliveryHomes) out.push(b); return out; };
  G.startDelivery = async (opt = {}) => {
    if (G.task) return ui.toast('Finish your current task first (phone → Quests to cancel)');
    const pos = G.player.pos; const rs = restaurantPlaces().sort((a, b) => Math.hypot(a._door.x - pos.x, a._door.z - pos.z) - Math.hypot(b._door.x - pos.x, b._door.z - pos.z));
    const shop = opt.shop || rs[Math.min(rs.length - 1, (Math.random() * 3) | 0)];
    const ds = destinations().filter(d => { const k = Math.hypot(d.x - shop._door.x, d.z - shop._door.z); return k > 250 && k < 2300; });
    const dest = opt.dest || ds[(Math.random() * ds.length) | 0] || destinations()[0];
    const dist = Math.hypot(dest.x - shop._door.x, dest.z - shop._door.z);
    const jt = await G.jobStart('delivery', { a: [shop._door.x, shop._door.z], b: [dest.x, dest.z] }); if (!jt.ok) return;
    G.flags.job_delivery = performance.now();
    G.startTask({ title: 'KU Eats 🛵', desc: L2(`Pick up the order at ${shop.name}`, `ไปรับออเดอร์ที่${shop.th || shop.name}`), target: shop._door, radius: 7, cancel: () => G.jobCancel(jt.jid), onArrive: (g) => {
      audio.notify(); ui.toast(opt.who ? L2(`🥡 Picked up ${opt.who}'s order — “${opt.note}”`, `🥡 รับออเดอร์ของ${opt.who}แล้ว — “${opt.note}”`) : '🥡 Order picked up! Deliver it fast'); G.jobStep(jt.jid);
      g.task = { title: 'KU Eats 🛵', desc: L2(`Deliver to ${dest.name}`, `ไปส่งที่${dest.name}`), target: dest, radius: 8, time: 0, limit: dist / 7 + 50, cancel: () => G.jobCancel(jt.jid), onArrive: async (g2) => {
        const tk = g2.task; g2.task = null; const base = 60 + dist * 0.12; const tip0 = tk.late ? 0 : Math.round(30 + Math.max(0, tk.limit - tk.time) * 1.5);
        const r = await g2.jobFinish(jt.jid, 1, Math.min(JOBS.delivery.pay[1] * 1.5, base + tip0), 'delivery'); if (!r.ok) return false;
        const tip = r.tip ?? tip0;
        g2.addXP(JOBS.delivery.xp, 'delivery', 'srv'); g2.skill('drv', 0.8); g2.profile.counters.jobs++; g2.event('job'); g2.stat('energy', -5);
        ui.big('Delivered! 🥡', tip ? `Tip ฿${tip}` : 'No tip — too slow'); return false;
      } };
      g.routeTimer = 0; return true;
    } });
  };
  G.startTaxi = async () => {
    const v = G.player.vehicle; if (!v || !v.moto || v.type === 'bicycle') return ui.toast('🛵 Ride your own motorbike to the main gate first');
    if (G.task) return ui.toast('Finish your current task first');
    const pos = G.player.pos; const ds = destinations().filter(d => { const k = Math.hypot(d.x - pos.x, d.z - pos.z); return k > 200 && k < 1500; });
    const dest = ds[(Math.random() * ds.length) | 0]; const dist = Math.hypot(dest.x - pos.x, dest.z - pos.z);
    const jt = await G.jobStart('taxi', { b: [dest.x, dest.z] }); if (!jt.ok) return;
    G.flags.job_taxi = performance.now(); G.player.setPassenger(true);
    G.startTask({ title: L2('Motorbike Taxi 🏍️', 'วินมอเตอร์ไซค์ 🏍️'), desc: L2(`Take your passenger to ${dest.name}`, `พาผู้โดยสารไปส่งที่${dest.name}`), target: dest, radius: 9, time: 0, limit: dist / 9 + 40, passenger: (on) => G.player.setPassenger(on), cancel: () => G.jobCancel(jt.jid), onArrive: async (g) => {
      const tk = g.task; g.task = null; g.player.setPassenger(false); const fare0 = Math.round(40 + dist * 0.15 + (tk.late ? 0 : 40));
      const r = await g.jobFinish(jt.jid, 1, Math.min(JOBS.taxi.pay[1] * 1.5, fare0), 'taxi'); if (!r.ok) return false;
      g.addXP(JOBS.taxi.xp, 'taxi', 'srv'); g.skill('drv', 1); g.profile.counters.jobs++; g.event('job'); ui.big('Fare paid 🏍️', fmt(r.amount ?? fare0)); return false;
    } });
  };
  // ---------------- side quests ----------------
  G.offerSide = (id) => {
    const sq = SIDE_QUESTS.find(s => s.id === id); if (!sq) return; const day = G.time().day; const st = P().quests.side[id];
    if (st && st.day === day && st.done) return ui.toast(`${sq.giver}: Thanks again, see you tomorrow!`);
    if (G.task) return ui.toast('Finish your current task first');
    const to = G.world.places[sq.to]; if (!to) return;
    P().quests.side[id] = { day, done: false };
    ui.modal(`<h2>❗ ${esc(L2(sq.title, sq.th))}</h2><p class="sub">${esc(L2(sq.th, sq.title))} · ${L2('from', 'จาก')} ${esc(sq.giver)}</p><div class="card"><p>${esc(L2(sq.desc, sq.desc_th))}</p><p>${L2('Reward', 'รางวัล')}: <b>${fmt(sq.money)}</b> + ${sq.xp} XP</p></div><div class="actions"><button class="btn ghost" id="mNo">${tr('Not now')}</button><button class="btn gold" id="mYes">${tr('Accept')}</button></div>`, (r) => {
      r.querySelector('#mNo').onclick = () => ui.closeModal();
      r.querySelector('#mYes').onclick = () => { ui.closeModal(); G.startTask({ title: L2(sq.title, sq.th), desc: L2(`Bring it to ${to.name}`, `นำไปส่งที่${to.th || to.name}`), target: to._door, radius: 7, onArrive: async (g) => { g.task = null; const res = await g.claim('side', sq.id); P().quests.side[id] = { day, done: true }; g.addXP(sq.xp, '', 'srv'); audio.quest(); ui.big('Task complete!', L2(sq.title, sq.th) + (res.ok ? ` · +${fmt(res.amount)}` : '')); g.save(); return false; } }); };
    });
  };
  // ---------------- NPC talk ----------------
  G.talkTo = (npc) => {
    if (npc.giver) return G.offerSide(npc.giver.id);
    const line = (npc.talkLine && npc.talkLine()) || CHATTER[(Math.random() * CHATTER.length) | 0];
    npc.bubble.userData.show(line); npc.h = Math.atan2(G.player.pos.x - npc.x, G.player.pos.z - npc.z); npc.emote = 'wave'; setTimeout(() => npc.emote = null, 2500);
    G.player.emote = 'wave'; setTimeout(() => { if (G.player.emote === 'wave') G.player.emote = null; }, 1500);
    const t = G.time(); if (G.flags['talk_' + npc.name] !== t.day) { G.flags['talk_' + npc.name] = t.day; G.skill('cha', 0.5); G.stat('mood', 4); G.addXP(10, '', 'talk'); P().counters.talks++; }
    G.event('talk');
  };
}

export function installBank(G) {
  const ui = G.ui;
  G.bankApp = () => {
    const p = G.profile; const players = [...G.remotes.map.values()];
    ui.modal(`<h2>Student Bank Account</h2><p class="sub">Account ${p.studentId.slice(0, 3)}-${p.studentId.slice(3, 7)}-${p.studentId.slice(7)}</p>
      <div class="card"><div class="row"><h4>Balance</h4><b style="font-size:26px;color:#9cf2c2">${fmt(p.money)}</b></div><p>Daily allowance from home arrives every game morning (฿300).</p></div>
      <h4 style="margin:8px 0 4px">Recent transactions</h4>${(p.txlog || []).slice(-10).reverse().map(t => `<div class="card"><div class="row"><span>${esc(t.w)}</span><b style="color:${t.d >= 0 ? '#9cf2c2' : '#ffb3a9'}">${t.d >= 0 ? '+' : ''}${fmt(t.d)}</b></div></div>`).join('') || '<p style="color:var(--muted)">No transactions yet.</p>'}
      <h4 style="margin:8px 0 4px">Transfer to a player ${G.net.online ? '' : '(online only)'}</h4>${players.map(r => `<div class="card"><div class="row"><span>${esc(r.info.name)} · Lv ${r.info.level || 1}</span><span><input type="number" min="1" value="100" data-amt="${r.id}" style="width:90px;padding:6px;border-radius:8px;border:1px solid var(--line);background:rgba(0,0,0,.3);color:#fff"> <button class="btn" data-send="${r.id}">Send</button></span></div></div>`).join('') || '<p style="color:var(--muted)">No other players online.</p>'}
      <div class="actions"><button class="btn ghost" id="mClose">Close</button></div>`, (root) => {
      root.querySelector('#mClose').onclick = () => ui.closeModal();
      root.querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => e.stopPropagation()));
      root.querySelectorAll('[data-send]').forEach(b => b.onclick = async () => { const amt = Math.floor(+root.querySelector(`[data-amt="${b.dataset.send}"]`).value || 0); if (amt > 0) { await G.transfer(b.dataset.send, amt); G.bankApp(); } });
    });
  };
}
