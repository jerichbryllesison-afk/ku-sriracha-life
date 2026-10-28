// Guidance layer for new players: a first-play intro (what the game is, the goal, the controls, your faculty), a short
// faculty tutorial that drives the objective tracker, a "smart advisor" that watches needs / class time / money / idling
// and suggests the single most useful next action (with one-tap GPS), and the "What now?" panel listing every option.
import { FACULTIES, JOBS, MAIN_QUESTS, levelTitle } from '../shared/catalog.js';
import { esc, fmt } from './ui.js';
import { icon } from './icons.js';
import { L2, tr } from './i18n.js';

const T = (a) => (Array.isArray(a) ? L2(a[0], a[1]) : a);

// what each faculty studies, its building, and a starter → next job path that fits it
export const FAC_INFO = {
  eng: { b: 'B23', ic: 'gear', job: 'fuel', job2: 'lab', study: ['Robotics, computer, civil, mechanical, electrical and automotive engineering — you design and build things with technology.', 'หุ่นยนต์ คอมพิวเตอร์ โยธา เครื่องกล ไฟฟ้า ยานยนต์ — เรียนออกแบบและสร้างสิ่งต่าง ๆ ด้วยเทคโนโลยี'], perk: ['Engineers grow Intelligence fast: it unlocks the well-paid Lab Assistant job (Lv 4).', 'สายวิศวะเน้นสติปัญญา — ปลดล็อกงานผู้ช่วยแล็บรายได้ดี (เลเวล 4)'] },
  sci: { b: 'B26', ic: 'flask', job: 'farm', job2: 'lab', study: ['Computer science, data & actuarial science, chemistry, physics and environmental science.', 'วิทยาการคอมพิวเตอร์ วิทยาการข้อมูลและประกันภัย เคมี ฟิสิกส์ และวิทยาศาสตร์สิ่งแวดล้อม'], perk: ['Start at the research greenhouse, then move up to Lab Assistant (Lv 4).', 'เริ่มจากผู้ช่วยแปลงเกษตรที่โรงเรือนวิจัย แล้วขยับไปเป็นผู้ช่วยแล็บ (เลเวล 4)'] },
  ms: { b: 'B22', ic: 'briefcase', job: 'cashier', job2: 'barista', study: ['Management, international business, logistics, finance, hotel & tourism, accounting and digital marketing.', 'การจัดการ ธุรกิจระหว่างประเทศ โลจิสติกส์ การเงิน การโรงแรมและท่องเที่ยว การบัญชี การตลาดดิจิทัล'], perk: ['Service jobs build Charisma — cashier first, then barista at the café (Lv 2).', 'งานบริการช่วยเพิ่มเสน่ห์ — เริ่มเป็นแคชเชียร์ แล้วเป็นบาริสต้าที่คาเฟ่ (เลเวล 2)'] },
  econ: { b: 'B18', ic: 'coin', job: 'cashier', job2: 'banquet', study: ['Economics — how money, markets and people\'s decisions work.', 'เศรษฐศาสตร์ — เรียนรู้เรื่องเงิน ตลาด และการตัดสินใจของคน'], perk: ['Save smart: the story asks you to reach ฿10,000 — banquet shifts (Lv 2) pay well.', 'ออมเงินเก่ง ๆ — เนื้อเรื่องให้เก็บเงินถึง ฿10,000 งานจัดเลี้ยง (เลเวล 2) ได้เงินดี'] },
  ims: { b: 'B24', ic: 'wave', job: 'canteen', job2: 'lifeguard', study: ['Nautical science, maritime transport, naval architecture and marine engineering — right by the Sriracha sea.', 'วิทยาการเดินเรือ การขนส่งทางทะเล สถาปัตยกรรมเรือ และวิศวกรรมเรือ — ติดทะเลศรีราชา'], perk: ['Train Fitness to become a Lifeguard (Lv 3). Captain Arthit at your faculty has a side task.', 'ฝึกร่างกายเพื่อเป็นไลฟ์การ์ด (เลเวล 3) และกัปตันอาทิตย์ที่คณะมีภารกิจเสริมให้'] },
};

const FOOD = ['cafeteria', 'foodstreet', 'noodle', 'market', 'cafe', 'mart', 'seafood', 'mookata'];

export class Coach {
  constructor(G, deps) {
    this.G = G; Object.assign(this, deps); // ui, audio, phone, input, player, rig, world
    this.cardEl = document.getElementById('coach'); this.hintEl = document.getElementById('hint');
    this.key = 'kusl_coach_' + (G.profile.studentId || 'x');
    try { this.st = JSON.parse(localStorage.getItem(this.key) || 'null'); } catch (e) { this.st = null; }
    const p = G.profile; const veteran = p.quests.main >= 5 || p.level >= 4;
    if (!this.st) this.st = { intro: 0, step: veteran ? 99 : 0 };
    this.c = { moved: 0, turned: 0, phone: false, atFac: false, classed: false, jobbed: false };
    this.cool = {}; this.hintT = 0; this.evalT = 3; this.t = 0; this.idleT = 0; this.last = null; this.lastYaw = null; this.flash = 0;
    G.onEvent = (type) => this.onEvent(type);
    G.coachObj = () => this.objective();
    this.fac = FACULTIES.find(f => f.id === p.faculty) || FACULTIES[0];
  }
  save() { try { localStorage.setItem(this.key, JSON.stringify(this.st)); } catch (e) { } }
  get active() { return this.st.step < this.steps().length; }
  info() { return FAC_INFO[this.G.profile.faculty] || FAC_INFO.eng; }
  place(id) { const pl = this.G.world.places[id]; return pl ? { x: pl._door.x, z: pl._door.z, name: pl.th || pl.name, en: pl.name, th: pl.th || pl.name, id } : null; }
  facPlace() { return this.place(this.info().b); }
  job(which = 'job') { const id = this.info()[which]; const j = JOBS[id]; const pl = j && this.place(j.at); return j && pl ? { id, j, pl } : { id: 'canteen', j: JOBS.canteen, pl: this.place('B07') }; }
  touch() { return !!(this.input && this.input.isTouch); }

  // ---------- tutorial ----------
  steps() {
    const f = this.facPlace(), jb = this.job();
    return [
      { ic: 'hand', title: ['Walk around', 'ลองเดินดู'], text: this.touch() ? ['Drag the joystick (bottom-left) to walk · push it all the way to run', 'ลากจอยสติ๊กซ้ายล่างเพื่อเดิน · ดันสุดเพื่อวิ่ง'] : ['Use W A S D to walk · hold Shift to run', 'กด W A S D เพื่อเดิน · กด Shift ค้างเพื่อวิ่ง'], done: (c) => c.moved > 8 },
      { ic: 'camera', title: ['Look around', 'หันกล้องดูรอบ ๆ'], text: this.touch() ? ['Swipe on the right side of the screen to turn the camera', 'ปัดนิ้วบนจอด้านขวาเพื่อหันกล้อง'] : ['Click the game, then move the mouse to turn the camera', 'คลิกที่เกม แล้วขยับเมาส์เพื่อหันกล้อง'], done: (c) => c.turned > 1.4 },
      { ic: 'phone', title: ['Open your phone', 'เปิดโทรศัพท์'], text: this.touch() ? ['Tap “Phone” at the bottom: jobs, GPS, quests, bank and settings are all there', 'แตะปุ่ม “โทรศัพท์” ด้านล่าง — มีแอปงาน GPS ภารกิจ ธนาคาร และตั้งค่า'] : ['Press P: jobs, GPS, quests, bank and settings are all there', 'กด P — มีแอปงาน GPS ภารกิจ ธนาคาร และตั้งค่า'], done: (c) => c.phone },
      { ic: 'cap', title: ['Go to your faculty', 'ไปตึกคณะของคุณ'], text: [`Follow the golden line (ground + minimap) to ${f ? f.en : 'your faculty'}`, `เดินตามเส้นสีทอง (บนพื้นและแผนที่เล็ก) ไปที่${f ? f.th : 'ตึกคณะ'}`], target: f, done: (c) => c.atFac },
      { ic: 'book', title: ['Attend your first class', 'เข้าเรียนคาบแรก'], text: this.G.time().hour < 8 ? ['Classes start at 08:00 (a few minutes). Wait here, or tap “Skip step” and work first.', 'คาบเรียนเริ่ม 08:00 (อีกไม่กี่นาที) รอตรงนี้ หรือกด “ข้ามขั้นนี้” ไปทำงานก่อน'] : this.touch() ? ['At the door tap E (or the prompt) → “Attend class”. Your own faculty gives +50% XP', 'ที่ประตูตึกแตะ E (หรือแตะกล่องคำสั่ง) → “เข้าเรียน” · เรียนที่คณะตัวเองได้ XP +50%'] : ['At the door press E → “Attend class”. Your own faculty gives +50% XP', 'ที่ประตูตึกกด E → “เข้าเรียน” · เรียนที่คณะตัวเองได้ XP +50%'], target: f, done: (c) => c.classed, skipIf: () => this.G.time().hour >= 17 },
      { ic: 'briefcase', title: ['Earn your first money', 'หาเงินก้อนแรก'], text: [`Work as ${jb.j.name} at ${jb.pl.en} (press E there) — a good fit for your faculty`, `ทำงาน “${jb.j.th}” ที่${jb.pl.th} (กด E ที่นั่น) — เหมาะกับคณะของคุณ`], target: jb.pl, done: (c) => c.jobbed },
    ];
  }
  objective() {
    if (!this.active) return null; const s = this.steps()[this.st.step]; if (!s.target) return null;
    return { title: T(s.title), desc: T(s.text), target: s.target, label: L2('Tutorial', 'บทเรียน') + ` ${this.st.step + 1}/${this.steps().length}` };
  }
  onEvent(type) {
    if (type === 'phone') this.c.phone = true; else if (type === 'class') this.c.classed = true; else if (type === 'job') this.c.jobbed = true;
  }
  renderCard() {
    if (!this.active || this.hidden) { this.cardEl.classList.add('hidden'); this._ck = null; return; }
    const steps = this.steps(), i = this.st.step, s = steps[i];
    const key = this.st.step + '|' + document.documentElement.lang + '|' + (this.flash > 0) + '|' + (this.G.time().hour < 8);
    if (this._ck === key) return; this._ck = key;
    this.cardEl.classList.remove('hidden'); this.cardEl.classList.toggle('ok', this.flash > 0);
    this.cardEl.innerHTML = `<div class="co-top"><span>${L2('Tutorial', 'บทเรียน')} ${i + 1}/${steps.length}</span><button class="co-skip" id="coSkipStep">${L2('Skip step', 'ข้ามขั้นนี้')}</button><button class="co-skip" id="coSkipAll">${L2('Skip tutorial', 'ข้ามทั้งหมด')}</button></div>
      <div class="co-main"><span class="co-ic">${icon(this.flash > 0 ? 'check' : s.ic)}</span><div><b>${esc(T(s.title))}</b>${s.target ? '' : `<p>${esc(T(s.text))}</p>`}</div></div>
      <div class="co-bar"><i style="width:${(i / steps.length) * 100}%"></i></div>`;
    this.cardEl.querySelector('#coSkipStep').onclick = () => this.advance(true);
    this.cardEl.querySelector('#coSkipAll').onclick = () => { this.st.step = 99; this.save(); this.renderCard(); this.G.routeTimer = 0; this.ui.toast(L2('Tutorial skipped — press “What now?” any time', 'ข้ามบทเรียนแล้ว — กด “ทำอะไรต่อ?” ได้ทุกเมื่อ')); };
  }
  advance(skipped) {
    const steps = this.steps(); this.st.step++; this.save(); this.G.routeTimer = 0; this._ck = null;
    if (!skipped) this.audio.notify();
    if (this.st.step >= steps.length) this.finish();
    else if (this.st.step === 3) { const f = this.facPlace(); if (f) this.ui.toast(L2('📍 GPS set: ', '📍 นำทางไป: ') + f.name); }
  }
  finish() {
    this.audio.quest(); this.G.addXP(50, '', 'tutorial'); this.st.step = 99; this.save(); this.renderCard();
    const q = this.G.mainObjective();
    this.ui.modal(`<div class="intro"><div class="in-hero">${icon('trophy')}</div><h2>${L2('Tutorial complete!', 'จบบทเรียนแล้ว!')}</h2>
      <p class="sub">${L2('You know the basics. From now on:', 'คุณรู้พื้นฐานแล้ว ต่อจากนี้:')}</p>
      <ul class="in-list"><li>${icon('star')}<span>${L2('Follow the golden <b>Objective</b> box (top-left) — the main story levels you up.', 'ทำตามกรอบ <b>ภารกิจ</b> สีทอง (ซ้ายบน) — เนื้อเรื่องหลักช่วยให้เลเวลขึ้นเร็ว')}</span></li>
      <li>${icon('heart')}<span>${L2('Keep the 4 need bars up: eat, sleep, have fun.', 'ดูแลแถบ 4 ค่าชีวิตให้สูงไว้ — กิน นอน พักผ่อน')}</span></li>
      <li>${icon('info')}<span>${L2('Not sure what to do? Press <b>What now?</b> — it shows the best next steps for you.', 'ไม่แน่ใจว่าจะทำอะไร? กด <b>ทำอะไรต่อ?</b> — จะบอกสิ่งที่ควรทำตอนนี้')}</span></li></ul>
      ${q ? `<div class="card"><small>${L2('Next', 'ต่อไป')}</small><h4>${esc(q.title)}</h4><p>${esc(q.desc)}</p></div>` : ''}
      <div class="actions"><button class="btn primary" id="mClose">${L2('Let’s go', 'ไปกันเลย')}</button></div></div>`, (r) => r.querySelector('#mClose').onclick = () => this.ui.closeModal());
  }

  // ---------- intro (what the game is / goal / controls / your faculty) ----------
  intro(page = 0) {
    this.input.unlock(); const f = this.fac = FACULTIES.find(x => x.id === this.G.profile.faculty) || FACULTIES[0]; const fi = this.info();
    const fp = this.facPlace(), jb = this.job(), jb2 = this.job('job2');
    const touch = this.touch();
    const K = (k, a, b) => `<div class="kb"><kbd>${k}</kbd><span>${L2(a, b)}</span></div>`;
    const pages = [
      () => `<p class="eyebrow">KU Sriracha Life</p><h2>${L2('What is this game?', 'เกมนี้คืออะไร?')}</h2>
        <p class="sub">${L2('An online open-world student life on the real map of Kasetsart University, Sriracha Campus. Up to 100 players share one campus.', 'เกมใช้ชีวิตนิสิตแบบโอเพ่นเวิลด์ บนแผนที่จริงของ มหาวิทยาลัยเกษตรศาสตร์ วิทยาเขตศรีราชา เล่นออนไลน์ร่วมกันได้สูงสุด 100 คน')}</p>
        <div class="in-tiles">${[['cap', 'Study', 'เรียน', 'Attend classes, read at the library, raise your GPA', 'เข้าเรียน อ่านหนังสือ เพิ่ม GPA'], ['briefcase', 'Work', 'ทำงาน', '11 part-time jobs: cashier, rider, barista…', 'งานพิเศษ 11 แบบ: แคชเชียร์ ไรเดอร์ บาริสต้า…'], ['car', 'Live', 'ใช้ชีวิต', 'Eat, sleep, shop, ride scooters, visit the beach', 'กิน นอน ช้อปปิ้ง ขี่มอเตอร์ไซค์ เที่ยวทะเล'], ['users', 'Friends', 'เพื่อน', 'Chat, send money and ride together', 'แชท โอนเงิน และขับรถไปด้วยกัน']].map(([ic, a, b, c, d]) => `<div class="in-tile">${icon(ic)}<b>${L2(a, b)}</b><small>${L2(c, d)}</small></div>`).join('')}</div>`,
      () => `<p class="eyebrow">${L2('Goal', 'เป้าหมาย')}</p><h2>${L2('Grow from freshman to KU Legend', 'เติบโตจากน้องใหม่ สู่ตำนาน มก.')}</h2>
        <ul class="in-list">
        <li>${icon('star')}<span>${L2(`Complete the <b>${MAIN_QUESTS.length} story quests</b> — shown in the golden Objective box (top-left). Follow the golden line.`, `ทำ <b>ภารกิจหลัก ${MAIN_QUESTS.length} ภารกิจ</b> — แสดงในกรอบ “ภารกิจ” สีทองซ้ายบน แล้วเดินตามเส้นสีทอง`)}</span></li>
        <li>${icon('cap')}<span>${L2('Attend classes (08:00–17:00) for GPA and Intelligence — your own faculty gives +50% XP.', 'เข้าเรียน (08:00–17:00) เพื่อ GPA และสติปัญญา — เรียนที่คณะตัวเองได้ XP +50%')}</span></li>
        <li>${icon('coin')}<span>${L2('Work part-time to buy clothes, scooters and cars.', 'ทำงานพิเศษ เก็บเงินซื้อเสื้อผ้า มอเตอร์ไซค์ และรถยนต์')}</span></li>
        <li>${icon('heart')}<span>${touch ? L2('Look after 4 needs (the bars next to the minimap): Health, Energy, Hunger, Mood. If they run out you faint.', 'ดูแล 4 ค่าชีวิต (แถบข้างแผนที่เล็ก): สุขภาพ พลังงาน ความอิ่ม อารมณ์ — ถ้าหมดจะเป็นลม') : L2('Look after 4 needs (bottom-left): Health, Energy, Hunger, Mood. If they run out you faint.', 'ดูแล 4 ค่าชีวิต (ซ้ายล่าง): สุขภาพ พลังงาน ความอิ่ม อารมณ์ — ถ้าหมดจะเป็นลม')}</span></li>
        <li>${icon('flower')}<span>${L2('Find 25 hidden golden Nonsi flowers (+฿150 each).', 'ตามหาดอกนนทรีทอง 25 ดอกที่ซ่อนอยู่ (ดอกละ +฿150)')}</span></li></ul>`,
      () => `<p class="eyebrow">${L2('Controls', 'การควบคุม')}</p><h2>${touch ? L2('Playing on a phone', 'เล่นบนโทรศัพท์') : L2('Keyboard & mouse', 'คีย์บอร์ดและเมาส์')}</h2>
        <div class="kbs">${touch ? [K('◎', 'Left joystick: walk (push fully = run)', 'จอยซ้าย: เดิน (ดันสุด = วิ่ง)'), K('☝', 'Swipe right side: turn camera', 'ปัดจอด้านขวา: หันกล้อง'), K('E', 'Use / talk / enter — or tap the prompt', 'ใช้ / คุย / เข้าตึก — หรือแตะกล่องคำสั่ง'), K('F', 'Get on / off a vehicle', 'ขึ้น / ลงรถ'), K('★', 'Bottom buttons: What now?, phone, map, chat', 'ปุ่มด้านล่าง: ทำอะไรต่อ? โทรศัพท์ แผนที่ แชท')].join('')
          : [K('WASD', 'Walk · Shift run · Space jump', 'เดิน · Shift วิ่ง · Space กระโดด'), K('Mouse', 'Click the game, then move to look', 'คลิกที่เกมแล้วขยับเมาส์เพื่อหันกล้อง'), K('E', 'Use / talk / enter buildings', 'ใช้ / คุย / เข้าตึก'), K('F', 'Get on / off a vehicle', 'ขึ้น / ลงรถ'), K('P', 'Phone (jobs, GPS, quests, bank)', 'โทรศัพท์ (งาน GPS ภารกิจ ธนาคาร)'), K('M', 'Big map — click to set GPS', 'แผนที่ใหญ่ — คลิกเพื่อปักหมุด'), K('T', 'Chat · Esc closes', 'แชท · Esc ปิด'), K('N', 'What now? — smart suggestions', 'ทำอะไรต่อ? — คำแนะนำอัจฉริยะ'), K('Esc', 'Close windows / free the mouse', 'ปิดหน้าต่าง / ปลดเมาส์')].join('')}</div>`,
      () => `<p class="eyebrow">${L2('Your faculty', 'คณะของคุณ')}</p><h2 style="border-left:4px solid ${f.color};padding-left:10px">${esc(L2(f.name, f.th))}</h2>
        <p class="sub">${esc(T(fi.study))}</p>
        <div class="card"><small>${L2('Your path', 'เส้นทางแนะนำ')}</small>
        <ol class="in-path"><li>${L2('Go to your faculty building', 'ไปตึกคณะ')}: <b>${esc(fp ? fp.name : '')}</b></li>
        <li>${L2('Attend your first class (+50% XP here)', 'เข้าเรียนคาบแรก (ที่นี่ได้ XP +50%)')}</li>
        <li>${L2('First job', 'งานแรก')}: <b>${esc(L2(jb.j.name, jb.j.th))}</b> · ${esc(jb.pl.name)} · ${fmt(jb.j.pay[0])}–${fmt(jb.j.pay[1])}</li>
        <li>${L2('Next job', 'งานถัดไป')}: <b>${esc(L2(jb2.j.name, jb2.j.th))}</b> (${L2('Level', 'เลเวล')} ${jb2.j.level})</li></ol>
        <p>${icon('info')} ${esc(T(fi.perk))}</p></div>`,
    ];
    const last = pages.length - 1;
    const render = () => this.ui.modal(`<div class="intro">${pages[page]()}<div class="in-foot"><div class="dots">${pages.map((_, i) => `<i class="${i === page ? 'on' : ''}"></i>`).join('')}</div><div class="actions">${page > 0 ? `<button class="btn ghost" id="inBack">${L2('Back', 'ย้อนกลับ')}</button>` : `<button class="btn ghost" id="inSkip">${L2('Skip', 'ข้าม')}</button>`}<button class="btn primary" id="inNext">${page < last ? L2('Next', 'ถัดไป') : (this.active ? L2('Start tutorial', 'เริ่มบทเรียน') : L2('Got it', 'เข้าใจแล้ว'))}</button></div></div></div>`, (r) => {
      const b = r.querySelector('#inBack'); if (b) b.onclick = () => { page--; render(); };
      const sk = r.querySelector('#inSkip'); if (sk) sk.onclick = () => this.ui.closeModal();
      r.querySelector('#inNext').onclick = () => { this.audio.click(); if (page < last) { page++; render(); } else this.ui.closeModal(); };
    }, () => { this.st.intro = 1; this.save(); this._ck = null; });
    render();
  }

  // ---------- advisor ----------
  nearest(kinds, pos) { let best = null, bd = 1e9; for (const pl of Object.values(this.G.world.places)) if (kinds.includes(pl.kind)) { const d = Math.hypot(pl._door.x - pos.x, pl._door.z - pos.z); if (d < bd) { bd = d; best = pl; } } return best ? { x: best._door.x, z: best._door.z, name: best.th || best.name, en: best.name, th: best.th || best.name, d: bd } : null; }
  dist(t) { const p = this.player.pos; const d = Math.hypot(t.x - p.x, t.z - p.z); return d < 1000 ? Math.round(d) + ' m' : (d / 1000).toFixed(1) + ' km'; }
  suggestions() {
    const G = this.G, p = G.profile, s = p.stats, pos = this.player.pos, t = G.time(); const out = [];
    const add = (o) => out.push(o);
    if (G.task) add({ id: 'task', pri: 100, ic: 'flag', title: L2('Current task', 'งานที่กำลังทำ') + ': ' + G.task.title, text: G.task.desc, target: G.task.target });
    if (s.health < 30) { const d = this.homeOrDorm(pos); add({ id: 'health', pri: 96, ic: 'heart', urgent: true, title: L2('Health is low', 'สุขภาพต่ำ!'), text: L2(`Sleep at ${d.en} and eat a proper meal, or you will faint.`, `ไปนอนพักที่${d.th} และกินข้าวให้อิ่ม ไม่งั้นจะเป็นลม`), target: d }); }
    if (s.energy < 25) { const d = this.homeOrDorm(pos); add({ id: 'energy', pri: 92, ic: 'bed', urgent: true, title: L2('You are tired', 'เหนื่อยแล้ว'), text: L2(`Sleep at ${d.en} (press E at the door → Sleep) or buy an energy drink.`, `ไปนอนที่${d.th} (กด E ที่ประตู → นอนพัก) หรือซื้อเครื่องดื่มชูกำลัง`), target: d }); }
    if (s.hunger < 30) { const d = this.nearest(FOOD, pos); if (d) add({ id: 'hunger', pri: 90, ic: 'bowl', urgent: true, title: L2('You are hungry', 'หิวแล้ว'), text: L2(`Eat at ${d.en} — ${this.dist(d)} away.`, `ไปกินที่${d.th} — ห่าง ${this.dist(d)}`), target: d }); }
    if (s.mood < 28) { const d = this.nearest(['court', 'hall', 'pavilion', 'activity', 'stadium'], pos); add({ id: 'mood', pri: 74, ic: 'smile', urgent: true, title: L2('Feeling down', 'อารมณ์ไม่ค่อยดี'), text: L2('Play futsal, watch an event, meditate or chat with students (E near an NPC).', 'เล่นฟุตซอล ดูกิจกรรม นั่งสมาธิ หรือคุยกับนิสิต (กด E ใกล้ NPC)'), target: d }); }
    if (this.active) { const st = this.steps()[this.st.step]; add({ id: 'tut', pri: 85, ic: st.ic, title: L2('Tutorial', 'บทเรียน') + ': ' + T(st.title), text: T(st.text), target: st.target }); }
    const taken = G.flags.classDay === t.day ? G.flags.classCount : 0; const fp = this.facPlace();
    if (t.hour >= 8 && t.hour < 16.6 && taken < 3 && fp) add({ id: 'class', pri: taken === 0 ? 78 : 40, ic: 'book', urgent: taken === 0, title: L2('Class time', 'ได้เวลาเรียน'), text: L2(`Attend a class at ${fp.en}: GPA, Intelligence and +50% XP (${taken}/3 today).`, `เข้าเรียนที่${fp.th}: ได้ GPA สติปัญญา และ XP +50% (วันนี้ ${taken}/3 คาบ)`), target: fp });
    const jb = this.bestJob();
    if (p.money < 150 && jb) add({ id: 'money', pri: 76, ic: 'coin', urgent: true, title: L2('Money is running low', 'เงินใกล้หมด'), text: L2(`Work as ${jb.j.name} at ${jb.pl.en}: ${fmt(jb.j.pay[0])}–${fmt(jb.j.pay[1])} per shift.`, `ทำงาน${jb.j.th} ที่${jb.pl.th}: ได้ ${fmt(jb.j.pay[0])}–${fmt(jb.j.pay[1])} ต่อกะ`), target: jb.pl });
    const mq = G.mainObjective(); if (mq) add({ id: 'main', pri: 62, ic: 'star', title: L2('Story', 'ภารกิจหลัก') + ': ' + mq.title, text: mq.desc, target: mq.target });
    G.ensureDaily(t.day); const dd = p.quests.daily;
    for (const dq of G.dailyList(t.day)) if (!dd.done.includes(dq.id)) { const pr = Math.round(dd.prog[dq.id] || 0); add({ id: 'daily_' + dq.id, pri: 50, ic: 'check', title: L2('Daily', 'รายวัน') + ': ' + L2(dq.title, dq.th), text: L2(`Progress ${pr}/${dq.n} · +${fmt(dq.money)} & ${dq.xp} XP`, `ความคืบหน้า ${pr}/${dq.n} · +${fmt(dq.money)} และ ${dq.xp} XP`), target: this.dailyTarget(dq.type) }); }
    if (jb && p.money >= 150) add({ id: 'job', pri: 44, ic: 'briefcase', title: L2('Earn money', 'หาเงิน') + ': ' + L2(jb.j.name, jb.j.th), text: L2(`${jb.pl.en} · ${fmt(jb.j.pay[0])}–${fmt(jb.j.pay[1])} · fits your faculty`, `${jb.pl.th} · ${fmt(jb.j.pay[0])}–${fmt(jb.j.pay[1])} · เหมาะกับคณะของคุณ`), target: jb.pl });
    if (!p.vehicles.length && !G.rental) { const g = this.place('B11'); if (g) add({ id: 'bike', pri: 30, ic: 'bike', title: L2('Get around faster', 'เดินทางให้เร็วขึ้น'), text: L2('Borrow a free KU bicycle at Facilities & Vehicles, or rent a scooter on Sukhumvit.', 'ยืมจักรยาน มก. ฟรีที่อาคารสถานที่และยานพาหนะ หรือเช่าสกู๊ตเตอร์ที่ถนนสุขุมวิท'), target: g }); }
    add({ id: 'social', pri: 24, ic: 'users', title: L2('Make friends', 'หาเพื่อน'), text: L2('Press E next to a student to chat, or press T to talk to other players.', 'กด E ข้างนิสิตเพื่อคุย หรือกด T เพื่อแชทกับผู้เล่นคนอื่น'), act: 'chat' });
    if (p.collected.length < 25) add({ id: 'flowers', pri: 18, ic: 'flower', title: L2('Treasure hunt', 'ล่าสมบัติ'), text: L2(`Golden Nonsi flowers found: ${p.collected.length}/25 — each gives ฿150. Hints in the phone (Nonsi app).`, `เก็บดอกนนทรีทองได้ ${p.collected.length}/25 ดอก — ดอกละ ฿150 ดูคำใบ้ในแอป “ดอกนนทรี”`), act: 'flowers' });
    return out.sort((a, b) => b.pri - a.pri);
  }
  homeOrDorm(pos) { const h = this.G.homeDoor && this.G.homeDoor(); if (h) return { x: h.x, z: h.z, name: L2('Home', 'บ้าน'), en: 'your home', th: 'บ้านของคุณ' }; return this.nearest(['dorm'], pos) || this.nearest(['condo', 'hotel'], pos); }
  bestJob() {
    const p = this.G.profile; const ok = (id) => { const j = JOBS[id]; if (!j || p.level < j.level) return false; return !j.req || Object.entries(j.req).every(([k, v]) => p.skills[k] >= v); };
    const a = this.job('job2'); if (ok(a.id)) return a; const b = this.job(); if (ok(b.id)) return b; return { id: 'canteen', j: JOBS.canteen, pl: this.place('B07') };
  }
  dailyTarget(type) { const pos = this.player.pos; if (type === 'class') return this.facPlace(); if (type === 'eat') return this.nearest(FOOD, pos); if (type === 'study') return this.place('B14'); if (type === 'job') { const j = this.bestJob(); return j && j.pl; } if (type === 'distance') return this.G.world.pois.trackStart ? { ...this.G.world.pois.trackStart, name: L2('Stadium track', 'ลู่วิ่งสนามกีฬา') } : null; return null; }
  go(sg) {
    if (sg.act === 'chat') { this.ui.closeModal(); this.openChat && this.openChat(); return; }
    if (sg.act === 'flowers') { this.ui.closeModal(); this.phone.openPhone('flowers'); return; }
    const t = sg.target; if (!t) return; this.G.waypoint = { x: t.x, z: t.z, name: t.name || '' }; this.G.routeTimer = 0; this.audio.click();
    this.ui.toast(L2('📍 GPS set: ', '📍 นำทางไป: ') + (t.name || T(sg.title)));
  }
  openNext() {
    this.input.unlock(); const list = this.suggestions().slice(0, 6); const t = this.G.time(); const p = this.G.profile;
    const hh = String(Math.floor(t.hour)).padStart(2, '0') + ':' + String(Math.floor(t.hour % 1 * 60)).padStart(2, '0');
    this.ui.modal(`<h2>${L2('What should I do now?', 'ตอนนี้ควรทำอะไรดี?')}</h2><p class="sub">${L2('Suggestions based on your needs, the time and your progress', 'คำแนะนำจากค่าชีวิต เวลา และความคืบหน้าของคุณ')} · ${hh} · ${L2('Level', 'เลเวล')} ${p.level} ${esc(tr(levelTitle(p.level)))}</p>
      <div class="wn-list">${list.map((sg, i) => `<div class="wn ${sg.urgent ? 'urgent' : ''}"><span class="mi">${icon(sg.ic)}</span><div><b>${esc(sg.title)}</b><small>${esc(sg.text)}</small></div>${sg.target || sg.act ? `<button class="btn ${i === 0 ? 'primary' : 'ghost'}" data-go="${i}">${sg.act ? L2('Open', 'เปิด') : L2('Go', 'นำทาง')}</button>` : ''}</div>`).join('')}</div>
      <div class="actions"><button class="btn ghost" id="wnIntro">${L2('What is this game?', 'เกมนี้คืออะไร?')}</button>${this.active ? '' : `<button class="btn ghost" id="wnTut">${L2('Replay tutorial', 'เล่นบทเรียนอีกครั้ง')}</button>`}<button class="btn" id="mClose">${L2('Close', 'ปิด')}</button></div>`, (r) => {
      r.querySelector('#mClose').onclick = () => this.ui.closeModal();
      r.querySelector('#wnIntro').onclick = () => this.intro(0);
      const tb = r.querySelector('#wnTut'); if (tb) tb.onclick = () => this.restart();
      r.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { const sg = list[+b.dataset.go]; this.ui.closeModal(); this.go(sg); });
    });
  }
  restart() { this.st.step = 0; this.c = { moved: 0, turned: 0, phone: false, atFac: false, classed: false, jobbed: false }; this.save(); this._ck = null; this.ui.closeModal(); this.renderCard(); this.G.routeTimer = 0; }
  showHint(sg) {
    this.hintSg = sg; this.hintT = 11; this.audio.notify();
    this.hintEl.innerHTML = `<span class="hi-ic">${icon(sg.ic)}</span><div><b>${esc(sg.title)}</b><p>${esc(sg.text)}</p></div>${sg.target || sg.act ? `<button class="btn primary" id="hiGo">${sg.act === 'next' ? L2('Show', 'ดู') : L2('Go', 'นำทาง')}</button>` : ''}<button class="hi-x" id="hiX" aria-label="Close">✕</button>`;
    this.hintEl.classList.remove('hidden');
    const go = this.hintEl.querySelector('#hiGo'); if (go) go.onclick = () => { this.hideHint(); if (sg.act === 'next') this.openNext(); else this.go(sg); };
    this.hintEl.querySelector('#hiX').onclick = () => this.hideHint();
  }
  hideHint() { this.hintEl.classList.add('hidden'); this.hintT = 0; this.hintSg = null; }

  // ---------- per-frame ----------
  update(_dt, blocked) {
    // wall-clock step (timers stay correct even when a slow device renders at low FPS)
    const nowS = performance.now() / 1000; const dt = this._lt ? Math.min(1, nowS - this._lt) : 0; this._lt = nowS;
    const G = this.G, pos = this.player.pos; this.t += dt;
    // tutorial progress signals
    if (this.last) { const d = Math.hypot(pos.x - this.last.x, pos.z - this.last.z); if (d < 5) { this.c.moved += d; this.idleT = d > 0.02 ? 0 : this.idleT + dt; } }
    this.last = { x: pos.x, z: pos.z };
    const yaw = this.rig.yaw; if (this.lastYaw != null) this.c.turned += Math.min(0.5, Math.abs(yaw - this.lastYaw)); this.lastYaw = yaw;
    if (this.active) {
      const steps = this.steps(); const s = steps[this.st.step];
      if (this.st.step === 3) { const f = this.facPlace(); if (f && Math.hypot(f.x - pos.x, f.z - pos.z) < 20) this.c.atFac = true; }
      if (this.flash > 0) { if (performance.now() > this.flash) { this.flash = 0; this.advance(false); } }
      else if (s.done(this.c)) { this.flash = performance.now() + 900; this.ui.toast(L2('✅ Nice! ', '✅ เยี่ยม! ') + T(s.title)); }
      else if (s.skipIf && s.skipIf()) { this.ui.toast(L2('⏰ Classes are closed now — we will come back to it later', '⏰ ตอนนี้นอกเวลาเรียน — ไว้เข้าเรียนทีหลังได้')); this.advance(true); }
    }
    this.hidden = blocked && this.ui.modalOpen;
    this.renderCard();
    // hint lifetime
    if (this.hintT > 0) { this.hintT -= dt; if (this.hintT <= 0 || blocked) this.hideHint(); }
    // advisor: one useful nudge at a time, each kind on its own cooldown, never during menus / minigames / chat
    this.evalT -= dt; if (this.evalT > 0) return; this.evalT = 3;
    if (blocked || this.hintT > 0 || this.t < 25 || G.task || G._fainting) return;
    const now = performance.now(); const day = G.time().day;
    const ready = (id, ms) => !this.cool[id] || now - this.cool[id] > ms;
    const sg = this.suggestions().find(x => x.urgent && ready(x.id, x.id === 'class' ? 1e12 : 150000) && !(x.id === 'class' && this.cool.classDay === day) && (x.id !== 'class' || !this.active));
    if (sg) { this.cool[sg.id] = now; if (sg.id === 'class') { this.cool.classDay = day; delete this.cool.class; } this.showHint(sg); return; }
    if (this.idleT > 40 && ready('idle', 180000) && !this.active) { this.cool.idle = now; this.idleT = 0; this.showHint({ id: 'idle', ic: 'help', title: L2('Not sure what to do?', 'ไม่รู้จะทำอะไรต่อ?'), text: L2('Open “What now?” for the best next steps.', 'เปิด “ทำอะไรต่อ?” เพื่อดูสิ่งที่ควรทำตอนนี้'), act: 'next' }); }
  }
  start() { if (!this.st.intro) setTimeout(() => { if (!this.ui.modalOpen) this.intro(0); else { this.st.intro = 1; this.save(); } }, 900); }
}
