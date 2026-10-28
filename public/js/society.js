// Personal social circle for every player: a family and a group of friends generated from the player's own seed, so
// nobody shares the same parents, sibling or friends. They text, call, invite you out and post on KU Feed according to
// the time of day, the weather, what you are doing and how close you are to them. All lines are hand-written.
import { L2 } from './i18n.js';
import { FACULTIES } from '../shared/catalog.js';

const rng = (seed) => { let s = (seed >>> 0) || 7; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
const pickR = (r, a) => a[Math.floor(r() * a.length)];
const hash = (str) => { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rr = (a, b) => a + Math.random() * (b - a);

const M_NICK = ['บาส', 'เจมส์', 'ฟอร์ด', 'ต้น', 'ปั้น', 'ต่อ', 'แบงค์', 'เก่ง', 'ภูมิ', 'กัน', 'บอส', 'ปอนด์', 'นนท์', 'อาร์ม', 'เต้', 'กอล์ฟ', 'โอ๊ต', 'ทอย'];
const F_NICK = ['มิว', 'แพม', 'ฝน', 'ออม', 'เฟิร์น', 'จูน', 'บีม', 'ใบเตย', 'ตาล', 'น้ำหวาน', 'แพรว', 'มายด์', 'ฟ้า', 'ปาล์ม', 'ไอซ์', 'เมย์', 'ขิม', 'พลอย'];
const DAD_N = ['สมชาย', 'ประเสริฐ', 'วิชัย', 'สุรชัย', 'อนุชา', 'ธนพล', 'ชัยวัฒน์', 'บุญเลิศ', 'เกียรติศักดิ์', 'ไพโรจน์', 'สมศักดิ์', 'ณรงค์'];
const MOM_N = ['สมศรี', 'มาลี', 'วันเพ็ญ', 'จันทร์เพ็ญ', 'สุดารัตน์', 'กาญจนา', 'นงลักษณ์', 'รัตนา', 'พรทิพย์', 'อรุณี', 'บุษบา', 'ปราณี'];
const PROV = [['ขอนแก่น', 'Khon Kaen'], ['นครศรีธรรมราช', 'Nakhon Si Thammarat'], ['เชียงใหม่', 'Chiang Mai'], ['ระยอง', 'Rayong'], ['อุบลราชธานี', 'Ubon Ratchathani'], ['สุราษฎร์ธานี', 'Surat Thani'], ['นครราชสีมา', 'Nakhon Ratchasima'], ['ลำปาง', 'Lampang'], ['สกลนคร', 'Sakon Nakhon'], ['กาญจนบุรี', 'Kanchanaburi'], ['ตรัง', 'Trang'], ['จันทบุรี', 'Chanthaburi'], ['พิษณุโลก', 'Phitsanulok'], ['สระบุรี', 'Saraburi']];
const DAD_J = [['ทำสวนยาง', 'runs a rubber plantation'], ['เป็นครู', 'is a teacher'], ['ขับรถบรรทุก', 'drives a truck'], ['เปิดร้านขายของชำ', 'runs a grocery shop'], ['เป็นช่างซ่อมรถ', 'is a car mechanic'], ['ทำงานโรงงาน', 'works at a factory'], ['ทำนา', 'is a rice farmer'], ['เป็นตำรวจ', 'is a police officer'], ['เป็นวิศวกรโรงงาน', 'is a plant engineer'], ['ขายประกัน', 'sells insurance']];
const MOM_J = [['ขายข้าวแกงหน้าตลาด', 'sells curry rice at the market'], ['เป็นพยาบาล', 'is a nurse'], ['เป็นแม่บ้าน', 'runs the household'], ['ขายของออนไลน์', 'sells things online'], ['เป็นครูประถม', 'teaches primary school'], ['ทำสวนผลไม้', 'grows fruit'], ['เปิดร้านทำผม', 'runs a hair salon'], ['ทำงานธนาคาร', 'works at a bank']];
const SIB_ST = [['เรียน ม.5 อยู่ที่บ้าน', 'is in grade 11 back home'], ['ทำงานบริษัทที่กรุงเทพ', 'works at a company in Bangkok'], ['เรียนปี 2 ที่เชียงใหม่', 'is a 2nd-year student in Chiang Mai'], ['เพิ่งได้งานแรก', 'just got a first job'], ['เรียน ม.3 กำลังจะสอบเข้า', 'is in grade 9, about to take entrance exams']];
const SIDE = [['ขายเสื้อผ้ามือสองออนไลน์', 'sells second-hand clothes online'], ['เป็นไรเดอร์ส่งอาหารตอนเย็น', 'rides food delivery after class'], ['เล่นดนตรีที่ร้านแถวอ่าวอุดม', 'plays music at a bar near Ao Udom'], ['รับสอนพิเศษเด็กมัธยม', 'tutors high-school kids'], ['ช่วยร้านกาแฟหน้ามอ', 'helps at a café near campus'], ['เป็นนักกีฬาฟุตซอลคณะ', 'plays futsal for the faculty'], ['เป็นสต๊าฟกิจกรรมนิสิต', 'is a student-activity staffer'], ['ถ่ายรูปรับปริญญา', 'shoots graduation photos'], ['ขายขนมในไลน์กลุ่มหอ', 'sells snacks in the dorm group chat']];
const PERS = ['cheer', 'tease', 'nerd', 'shy', 'foodie', 'social'];
const PERS_T = { cheer: ['ร่าเริง', 'cheerful'], tease: ['ขี้แกล้ง', 'a tease'], nerd: ['เรียนเก่ง จริงจัง', 'studious'], shy: ['ขี้อาย', 'shy'], foodie: ['สายกิน', 'a foodie'], social: ['สายเที่ยว', 'loves going out'] };
const ROLE_T = { mom: ['แม่', 'Mom'], dad: ['พ่อ', 'Dad'], sib: ['', ''], classmate: ['เพื่อนร่วมคณะ', 'Classmate'], roommate: ['เพื่อนห้องข้างๆ ที่หอ', 'Dorm neighbour'], senior: ['พี่รหัส', 'Faculty senior'], club: ['เพื่อนชมรม', 'Club friend'], work: ['เพื่อนที่ทำงาน', 'Work buddy'], bestie: ['เพื่อนสนิทสมัยมัธยม', 'High-school best friend'] };

// ---------------------------------------------------------------------------------------------------------------
export function buildCircle(seedStr, myFaculty) {
  const r = rng(hash(seedStr)); const usedN = new Set();
  const nick = (g) => { const pool = g === 'f' ? F_NICK : M_NICK; for (let i = 0; i < 30; i++) { const n = pickR(r, pool); if (!usedN.has(n)) { usedN.add(n); return n; } } return pickR(r, pool); };
  const prov = pickR(r, PROV); const fac = FACULTIES.find(f => f.id === myFaculty) || FACULTIES[0]; const otherFac = () => pickR(r, FACULTIES);
  const C = [];
  const dadJ = pickR(r, DAD_J), momJ = pickR(r, MOM_J); const momP = pickR(r, ['worry', 'strict', 'chill']); const dadP = pickR(r, ['quiet', 'jokey', 'proud']);
  C.push({ id: 'mom', kind: 'family', role: 'mom', g: 'f', name: 'แม่', en: 'Mom', real: pickR(r, MOM_N), pers: momP, icon: '👩', job: momJ, prov });
  C.push({ id: 'dad', kind: 'family', role: 'dad', g: 'm', name: 'พ่อ', en: 'Dad', real: pickR(r, DAD_N), pers: dadP, icon: '👨', job: dadJ, prov });
  const older = r() < 0.5, sg = r() < 0.5 ? 'f' : 'm'; const sn = nick(sg);
  C.push({ id: 'sib', kind: 'family', role: 'sib', g: sg, older, name: (older ? 'พี่' : 'น้อง') + sn, en: (older ? (sg === 'f' ? 'Big sis ' : 'Big bro ') : (sg === 'f' ? 'Little sis ' : 'Little bro ')) + sn, nick: sn, icon: older ? '🧑' : '🧒', job: pickR(r, older ? SIB_ST.slice(1, 4) : [SIB_ST[0], SIB_ST[4]]), prov });
  for (const role of ['classmate', 'roommate', 'senior', 'club', 'work', 'bestie']) {
    const g = r() < 0.5 ? 'f' : 'm'; const n = nick(g); const f = role === 'classmate' || role === 'senior' ? fac : otherFac();
    C.push({ id: role, kind: 'friend', role, g, name: (role === 'senior' ? 'พี่' : '') + n, nick: n, fac: f.id, facTh: f.th, facEn: f.name, year: role === 'senior' ? 3 + ((r() * 2) | 0) : role === 'classmate' ? 1 : 1 + ((r() * 3) | 0), pers: pickR(r, PERS), side: pickR(r, SIDE), icon: g === 'f' ? pickR(r, ['👩🏻', '👧🏻', '👩🏽']) : pickR(r, ['👨🏻', '🧑🏻', '👦🏽']), home: role === 'bestie' ? prov : null });
  }
  return C;
}
export function aboutOf(c) {
  if (c.role === 'mom' || c.role === 'dad') return L2(`${ROLE_T[c.role][1]} · ${c.job[1]} in ${c.prov[1]}`, `${ROLE_T[c.role][0]} (${c.real}) · ${c.job[0]} อยู่${c.prov[0]}`);
  if (c.role === 'sib') return L2(`${c.older ? 'Older' : 'Younger'} ${c.g === 'f' ? 'sister' : 'brother'} · ${c.job[1]}`, `${c.older ? (c.g === 'f' ? 'พี่สาว' : 'พี่ชาย') : (c.g === 'f' ? 'น้องสาว' : 'น้องชาย')} · ${c.job[0]}`);
  const P = PERS_T[c.pers] || ['', ''];
  if (c.role === 'bestie') return L2(`${ROLE_T.bestie[1]} · studies in ${c.home[1]} · ${P[1]}`, `${ROLE_T.bestie[0]} · เรียนอยู่${c.home[0]} · ${P[0]}`);
  return L2(`${ROLE_T[c.role][1]} · ${c.facEn}, year ${c.year} · ${c.side[1]} · ${P[1]}`, `${ROLE_T[c.role][0]} · ${c.facTh} ปี ${c.year} · ${c.side[0]} · ${P[0]}`);
}

// ---------------------------------------------------------------------------------------------------------------
// message events. make(c, x) → { th, en, choices: [{ th, en, rth, ren, rel, mood, act }] }
// x: { me (player nickname), pol (ครับ/ค่ะ), hour, phase, rain, money, hunger, energy, lv, facB (faculty building name), facBId, gpa, job }
const E = (c) => c.g === 'f' ? 'นะ' : 'นะ';
const EVENTS = [
  // ---- mom ----
  { id: 'mom_wake', who: ['mom'], when: x => x.hour < 9, w: 4, make: (c, x) => ({ th: c.pers === 'strict' ? 'ตื่นยัง วันนี้มีเรียนเช้าใช่ไหม อย่าโดดเรียนนะ' : 'ตื่นยังลูก วันนี้มีเรียนเช้าไหม กินข้าวก่อนออกจากหอนะ', en: c.pers === 'strict' ? 'Up yet? You have a morning class, right? Don\'t skip it.' : 'Are you up? Morning class today? Eat something before you leave.', choices: [
    { th: `ตื่นแล้ว${x.pol}แม่ กำลังจะไปเรียน`, en: 'I\'m up, going to class now', rth: 'ดีแล้วลูก ตั้งใจเรียนนะ', ren: 'Good. Study hard.', rel: 2, mood: 3 },
    { th: 'ยังเลย ง่วงมาก 😴', en: 'Not yet… so sleepy 😴', rth: c.pers === 'strict' ? 'ลุกเดี๋ยวนี้เลย! เดี๋ยวก็สาย' : 'ลุกได้แล้วลูก เดี๋ยวสายนะ แม่เป็นห่วง', ren: 'Get up, you\'ll be late!', rel: 1 }] }) },
  { id: 'mom_lunch', who: ['mom'], when: x => x.phase === 'midday', w: 3, make: (c, x) => ({ th: 'กินข้าวเที่ยงยังลูก อย่ากินแต่มาม่านะ', en: 'Had lunch yet? Don\'t live on instant noodles.', choices: [
    { th: 'กินแล้ว ข้าวมันไก่ที่โรงอาหาร', en: 'Yes, chicken rice at the cafeteria', rth: 'ดีจ้ะ ที่นั่นจานละเท่าไหร่ ถูกไหม', ren: 'Good. Is it cheap there?', rel: 2, mood: 2 },
    { th: 'ยังเลย เดี๋ยวไปกิน', en: 'Not yet, going soon', rth: 'รีบไปกินนะ เดี๋ยวปวดท้อง', ren: 'Go eat now or your stomach will hurt.', rel: 1, act: { go: 'B07' } }] }) },
  { id: 'mom_money', who: ['mom'], when: x => x.money < 600, w: 5, make: (c, x) => ({ th: 'เงินพอใช้ไหมลูก ถ้าไม่พอบอกแม่นะ แต่ใช้ประหยัดๆ หน่อย', en: 'Do you have enough money? Tell me if not — but spend carefully.', choices: [
    { th: `พอ${x.pol} ทำงานพิเศษอยู่`, en: 'It\'s fine, I have a part-time job', rth: 'เก่งมากลูก แต่อย่าหักโหมจนเสียการเรียนนะ', ren: 'Proud of you. Don\'t let it hurt your studies.', rel: 3, mood: 4 },
    { th: 'ใกล้หมดแล้ว 😅', en: 'Almost out 😅', rth: 'เดี๋ยวเช้าพรุ่งนี้แม่โอนค่าขนมให้ ใช้ให้ดีๆ นะ', ren: 'I\'ll send your allowance tomorrow morning. Use it well.', rel: 1, mood: 2 }] }) },
  { id: 'mom_home', who: ['mom'], when: x => x.phase !== 'morning', w: 2, make: (c, x) => ({ th: `วันนี้พ่อไปตลาดซื้อปลามาทำแกงส้ม คิดถึงลูกเลย กลับบ้านที่${c.prov[0]}เมื่อไหร่`, en: `Your dad bought fish for sour curry today. We miss you — when are you coming home to ${c.prov[1]}?`, choices: [
    { th: 'คิดถึงเหมือนกัน ปิดเทอมกลับแน่นอน', en: 'Miss you too, I\'ll be home for the break', rth: 'รอนะลูก แม่จะทำของโปรดไว้ให้', ren: 'We\'ll wait. I\'ll cook your favourite.', rel: 4, mood: 5 },
    { th: 'ช่วงนี้งานเยอะ ยังไม่รู้เลย', en: 'Lots of work lately, not sure yet', rth: 'ไม่เป็นไร เรียนให้เต็มที่ ว่างเมื่อไหร่ค่อยกลับ', ren: 'That\'s okay. Come when you can.', rel: 1 }] }) },
  { id: 'mom_rain', who: ['mom', 'dad'], when: x => x.rain, w: 6, make: (c, x) => ({ th: c.role === 'dad' ? 'ดูข่าวว่าศรีราชาฝนตก ขับรถช้าๆ นะ ถนนลื่น' : 'ฝนตกไหมทางนั้น พกร่มด้วยนะลูก อย่าตากฝน', en: c.role === 'dad' ? 'News says it\'s raining in Si Racha. Ride slowly, roads are slippery.' : 'Is it raining there? Take an umbrella, don\'t get soaked.', choices: [
    { th: 'ระวังอยู่แล้ว ไม่ต้องห่วง', en: 'I\'m careful, don\'t worry', rth: 'ห่วงสิ ลูกคนเดียวนี่นา', ren: 'Of course I worry.', rel: 2, mood: 2 },
    { th: 'เปียกไปแล้ว 555', en: 'Already soaked 555', rth: 'อาบน้ำอุ่นด้วยนะ เดี๋ยวไม่สบาย', ren: 'Take a warm shower or you\'ll get sick.', rel: 1 }] }) },
  // ---- dad ----
  { id: 'dad_grade', who: ['dad'], when: x => x.gpa > 0, w: 2, make: (c, x) => ({ th: c.pers === 'jokey' ? 'เกรดเป็นไงบ้างลูก ได้ A ซักตัวไหม 555' : 'การเรียนเป็นไงบ้าง เกรดออกยัง', en: 'How are your grades?', choices: [
    { th: `GPA ${x.gpa.toFixed(2)} ${x.pol}`, en: `GPA ${x.gpa.toFixed(2)}`, rth: x.gpa >= 3 ? 'เก่งมาก พ่อภูมิใจในตัวลูกนะ' : 'ไม่เป็นไร เทอมหน้าเอาใหม่ พ่อเชื่อว่าลูกทำได้', ren: x.gpa >= 3 ? 'Excellent — I\'m proud of you.' : 'It\'s fine, you\'ll do better next term.', rel: 3, mood: x.gpa >= 3 ? 5 : 2 },
    { th: 'ยังไม่ออกเลย', en: 'Not out yet', rth: 'ออกแล้วบอกพ่อด้วยนะ', ren: 'Tell me when they are.', rel: 1 }] }) },
  { id: 'dad_work', who: ['dad'], when: x => x.phase === 'evening' || x.phase === 'afternoon', w: 2, make: (c, x) => ({ th: `วันนี้พ่อ${c.job[0]}เหนื่อยหน่อย แต่ไม่เป็นไร ลูกเรียนให้จบก็พอ`, en: `Tiring day for me (${c.job[1]}), but it's fine. You just finish your degree.`, choices: [
    { th: 'พักผ่อนเยอะๆ นะพ่อ', en: 'Get some rest, Dad', rth: 'จ้า พ่อไม่เป็นไรหรอก', ren: 'Sure, I\'m okay.', rel: 3, mood: 3 },
    { th: 'จบแล้วจะดูแลพ่อเอง', en: 'I\'ll take care of you after I graduate', rth: 'พ่อรอนะ 😊', ren: 'I\'ll hold you to that 😊', rel: 4, mood: 5 }] }) },
  { id: 'dad_vehicle', who: ['dad'], when: x => x.inVehicle, w: 3, make: (c, x) => ({ th: c.pers === 'jokey' ? 'ได้ข่าวว่ามีรถขี่แล้ว ใส่หมวกกันน็อกด้วย ไม่งั้นพ่อยึด 555' : 'ขับรถระวังนะลูก ใส่หมวกกันน็อกทุกครั้ง', en: 'Ride carefully and always wear a helmet.', choices: [
    { th: 'ใส่ตลอด', en: 'Always do', rth: 'ดี', ren: 'Good.', rel: 2 },
    { th: 'ขับช้าๆ อยู่แล้ว', en: 'I ride slowly anyway', rth: 'จ้า เชื่อก็ได้ 555', ren: 'If you say so 555', rel: 1, mood: 2 }] }) },
  // ---- sibling ----
  { id: 'sib_shirt', who: ['sib'], when: x => !x.older, w: 3, make: (c, x) => ({ th: 'พี่ๆ ซื้อเสื้อมอ มก. มาฝากหน่อยดิ เพื่อนอยากได้ด้วย 🙏', en: 'Can you bring me a KU shirt? My friends want one too 🙏', choices: [
    { th: 'ได้ เดี๋ยวไปดูที่สหกรณ์', en: 'Sure, I\'ll check the co-op', rth: 'เย้ รักพี่ที่สุด', ren: 'Yay, best sibling ever', rel: 4, mood: 3, act: { go: 'COOP' } },
    { th: 'ไม่มีตังค์ 555', en: 'No money 555', rth: 'งกอะ 😤', ren: 'Stingy 😤', rel: -1 }] }) },
  { id: 'sib_exam', who: ['sib'], when: x => !x.older, w: 2, make: (c, x) => ({ th: 'พี่ สอบเข้ามหาลัยยากไหม หนูเครียดมากเลย', en: 'Is the university entrance exam hard? I\'m so stressed.', choices: [
    { th: 'ไม่ยากหรอก ทำข้อสอบเก่าเยอะๆ', en: 'Not that hard — do lots of past papers', rth: 'โอเค จะลองดู ขอบคุณนะพี่', ren: 'Okay, I\'ll try. Thanks.', rel: 3, mood: 3 },
    { th: 'มาเรียนที่ศรีราชาด้วยกันสิ', en: 'Come study in Si Racha with me', rth: 'น่าสนใจ ทะเลสวยด้วย 555', ren: 'Tempting, the sea is nice 555', rel: 4, mood: 4 }] }) },
  { id: 'sib_older', who: ['sib'], when: x => x.older, w: 3, make: (c, x) => ({ th: 'เป็นไงน้อง ปีนี้เรียนไหวไหม มีอะไรปรึกษาพี่ได้นะ', en: 'How\'s it going? Coping with uni? You can always ask me.', choices: [
    { th: 'ไหวอยู่ แต่เหนื่อยหน่อย', en: 'Managing, a bit tired', rth: 'ปกติแหละ ปีแรกๆ หนักสุด เดี๋ยวก็ชิน', ren: 'Normal. The first years are the hardest.', rel: 3, mood: 3 },
    { th: 'โอนตังค์มาหน่อย 555', en: 'Send me money 555', rth: 'ทำงานพิเศษไปน้อง 555', ren: 'Get a part-time job 555', rel: 1, mood: 2 }] }) },
  // ---- classmate ----
  { id: 'cm_class', who: ['classmate'], when: x => x.hour >= 7.2 && x.hour < 10.5, w: 5, make: (c, x) => ({ th: `${x.me} เข้าคาบเช้าป่ะ อาจารย์เช็คชื่อ${E(c)}`, en: `${x.me}, coming to the morning class? The lecturer takes attendance.`, choices: [
    { th: `ไป เจอกันที่${x.facB}`, en: `Yes, see you at ${x.facB}`, rth: 'โอเค จองที่นั่งไว้ให้แถวหลัง', ren: 'Okay, I\'ll save you a seat at the back.', rel: 2, act: { meet: x.facBId } },
    { th: 'ฝากเซ็นชื่อได้ป่ะ 555', en: 'Sign me in? 555', rth: 'ไม่ได้ๆ เดี๋ยวโดนทั้งคู่ 555', ren: 'No way, we\'d both get caught 555', rel: 0, mood: 1 }] }) },
  { id: 'cm_group', who: ['classmate'], when: x => x.phase === 'afternoon', w: 4, make: (c, x) => ({ th: 'งานกลุ่มส่งวันศุกร์นะ ไปนั่งทำที่หอสมุดกันไหม แอร์เย็นด้วย', en: 'Group work is due Friday. Want to work at the library? The air-con is nice.', choices: [
    { th: 'ไป เดี๋ยวตามไป', en: 'Sure, on my way', rth: 'ชั้น 2 โต๊ะริมหน้าต่างนะ', ren: '2nd floor, the table by the window.', rel: 3, act: { meet: 'B14' } },
    { th: 'พรุ่งนี้ได้ไหม วันนี้ไม่ไหว', en: 'Tomorrow? Can\'t today', rth: 'ได้ แต่พรุ่งนี้ห้ามเท 😑', ren: 'Fine, but don\'t bail tomorrow 😑', rel: -1 }] }) },
  { id: 'cm_quiz', who: ['classmate'], w: 2, make: (c, x) => ({ th: 'พรุ่งนี้มีควิซป่ะ ทำไมไม่มีใครบอกเลย 😭', en: 'Is there a quiz tomorrow?? Why did nobody tell me 😭', choices: [
    { th: 'มี บทที่ 3 ทั้งบท', en: 'Yes, all of chapter 3', rth: 'จบเห่ คืนนี้ไม่ได้นอนแน่', ren: 'I\'m done for. No sleep tonight.', rel: 2, mood: 1 },
    { th: 'ไม่มีหรอก อำเล่น 555', en: 'No, just kidding 555', rth: 'ใจหายหมดเลย 555', ren: 'You scared me 555', rel: 1, mood: 2 }] }) },
  // ---- dorm neighbour ----
  { id: 'rm_errand', who: ['roommate'], w: 3, make: (c, x) => ({ th: 'อยู่ข้างนอกป่ะ ฝากซื้อน้ำกับมาม่าที่เซเว่นหน่อย เดี๋ยวโอนคืน', en: 'Are you out? Grab me water and instant noodles at 7-Eleven? I\'ll pay you back.', choices: [
    { th: 'ได้ เดี๋ยวซื้อให้', en: 'Sure', rth: 'ขอบคุณมาก ไว้เลี้ยงชานมคืน', ren: 'Thanks, bubble tea is on me next time.', rel: 4, act: { go: 'MART2' } },
    { th: 'ไม่ได้ออกไปเลย ขอโทษนะ', en: 'I\'m not going out, sorry', rth: 'ไม่เป็นไร เดินไปเองก็ได้', ren: 'No worries, I\'ll walk.', rel: 0 }] }) },
  { id: 'rm_noise', who: ['roommate'], when: x => x.phase !== 'morning', w: 2, make: (c, x) => ({ th: 'ห้องข้างๆ เปิดเพลงดังมาก นอนกลางวันไม่ได้เลย 555', en: 'Next door is blasting music, I can\'t nap at all 555', choices: [
    { th: 'ไปนั่งร้านกาแฟกันไหม', en: 'Want to go sit at a café?', rth: 'ไป! ร้านกาแฟในมอนะ', ren: 'Yes! The campus café.', rel: 3, act: { meet: 'CAFE' } },
    { th: 'ใส่หูฟังสิ', en: 'Use earphones', rth: 'ใส่แล้ว ยังได้ยินเบส 😂', ren: 'I am, I can still hear the bass 😂', rel: 1, mood: 1 }] }) },
  { id: 'rm_tired', who: ['roommate'], when: x => x.energy < 30, w: 6, make: (c, x) => ({ th: 'เห็นหน้าเหนื่อยๆ ตอนเดินผ่าน กลับไปนอนพักบ้างนะ', en: 'You looked exhausted when you walked past. Go get some rest.', choices: [
    { th: 'ใช่ เดี๋ยวกลับหอ', en: 'Yeah, heading back', rth: 'ดี ชาร์จแบตก่อน', ren: 'Good, recharge first.', rel: 2, act: { home: true } },
    { th: 'ยังไหว อีกนิดเดียว', en: 'Still okay, almost done', rth: 'อย่าฝืนนะ', ren: 'Don\'t push it.', rel: 1 }] }) },
  // ---- senior ----
  { id: 'sn_check', who: ['senior'], w: 3, make: (c, x) => ({ th: `น้อง${x.me} ช่วงนี้เป็นไงบ้าง วิชาไหนยากบอกพี่ได้นะ พี่มีชีทเก่าให้`, en: `Hey ${x.me}, how are things? If a subject is hard tell me, I have old notes.`, choices: [
    { th: `ขอชีทแคลคูลัสหน่อย${x.pol}พี่`, en: 'Could I get your calculus notes?', rth: 'ได้เลย เดี๋ยวส่งไฟล์ให้ในไลน์', ren: 'Sure, sending the file now.', rel: 3, mood: 3 },
    { th: `สบายดี${x.pol} ขอบคุณที่ถามนะพี่`, en: 'All good, thanks for asking', rth: 'ดีแล้ว มีอะไรทักมานะ', ren: 'Great, message me anytime.', rel: 2 }] }) },
  { id: 'sn_mookata', who: ['senior'], when: x => x.phase === 'afternoon' || x.phase === 'evening', w: 3, make: (c, x) => ({ th: 'เย็นนี้ว่างไหม ไปกินหมูกระทะกัน พี่เลี้ยงเอง 🔥', en: 'Free this evening? Let\'s get moo kata — my treat 🔥', choices: [
    { th: `ไป${x.pol}พี่!`, en: 'I\'m in!', rth: 'เจอกันที่ร้านหมูกระทะนะ', ren: 'See you at the moo kata place.', rel: 4, act: { meet: 'MOOKATA' } },
    { th: 'วันนี้ไม่ว่าง ไว้รอบหน้านะพี่', en: 'Busy today, next time?', rth: 'ได้ๆ ไว้นัดใหม่', ren: 'Sure, another time.', rel: 0 }] }) },
  { id: 'sn_job', who: ['senior'], when: x => x.money < 1500, w: 3, make: (c, x) => ({ th: 'ถ้าหางานพิเศษ หอสมุดรับผู้ช่วยอยู่นะ งานไม่หนัก ได้นั่งแอร์ด้วย', en: 'If you need a part-time job, the library is hiring assistants. Easy work, air-con too.', choices: [
    { th: 'สนใจ เดี๋ยวไปถาม', en: 'Interested, I\'ll ask', rth: 'บอกเขาว่าพี่แนะนำมา', ren: 'Tell them I sent you.', rel: 2, act: { go: 'B14' } },
    { th: 'ทำอย่างอื่นอยู่แล้ว', en: 'I already have a job', rth: 'โอเค ขยันดี', ren: 'Nice, hard worker.', rel: 1 }] }) },
  // ---- club ----
  { id: 'cl_futsal', who: ['club'], when: x => x.phase !== 'morning', w: 4, make: (c, x) => ({ th: 'ขาดคนเตะฟุตซอลหนึ่งคน มาด้วยกันป่ะ สนามในร่ม', en: 'We\'re one short for futsal, want to join? Indoor court.', choices: [
    { th: 'ไป รอแป๊บ', en: 'Coming, wait for me', rth: 'เร็วๆ นะ จะเริ่มแล้ว ⚽', ren: 'Hurry, we\'re starting ⚽', rel: 3, act: { meet: 'B21' } },
    { th: 'ขาเจ็บอยู่ ขอผ่าน', en: 'My leg hurts, I\'ll pass', rth: 'หายไวๆ นะ', ren: 'Get well soon.', rel: 0 }] }) },
  { id: 'cl_practice', who: ['club'], w: 2, make: (c, x) => ({ th: 'เย็นนี้มีประชุมชมรมที่ศูนย์กิจกรรมนะ มีขนมด้วย 555', en: 'Club meeting at the activity centre this evening — there are snacks 555', choices: [
    { th: 'ไปแน่นอน (เพราะขนม)', en: 'Definitely (for the snacks)', rth: 'รู้อยู่แล้ว 555', ren: 'Knew it 555', rel: 3, act: { meet: 'B09' } },
    { th: 'ฝากลงชื่อด้วย', en: 'Put my name down', rth: 'ได้ แต่รอบหน้ามาด้วยนะ', ren: 'Okay, but come next time.', rel: 0 }] }) },
  // ---- work buddy ----
  { id: 'wk_shift', who: ['work'], when: x => x.phase === 'midday' || x.phase === 'afternoon', w: 3, make: (c, x) => ({ th: 'วันนี้ร้านคนเยอะมาก มาช่วยกะบ่ายได้ไหม ได้ตังค์เพิ่มนะ', en: 'The shop is packed today, can you help with the afternoon shift? Extra pay.', choices: [
    { th: 'ได้ เดี๋ยวไป', en: 'Sure, on my way', rth: 'เซฟชีวิตมาก ขอบคุณนะ', ren: 'Life saver, thanks.', rel: 3, act: { go: 'CAFE' } },
    { th: 'วันนี้มีเรียน', en: 'I have class today', rth: 'โอเค ไม่เป็นไร', ren: 'Okay, no problem.', rel: 0 }] }) },
  { id: 'wk_after', who: ['work'], when: x => x.justWorked, w: 8, make: (c, x) => ({ th: 'เหนื่อยไหมวันนี้ เห็นวิ่งทั้งวันเลย', en: 'Tired? Saw you running around all day.', choices: [
    { th: 'เหนื่อย แต่ได้ตังค์ 💰', en: 'Tired, but paid 💰', rth: 'นั่นแหละความสุข 555', ren: 'That\'s the joy 555', rel: 2, mood: 3 },
    { th: 'ขาลากเลย', en: 'My legs are dead', rth: 'กลับไปแช่น้ำอุ่นซะ', ren: 'Go soak in warm water.', rel: 2, mood: 1 }] }) },
  // ---- bestie ----
  { id: 'bf_sea', who: ['bestie'], w: 3, make: (c, x) => ({ th: 'ที่ศรีราชาเป็นไงบ้าง ทะเลสวยไหม ส่งรูปมาดูหน่อยดิ', en: 'How\'s Si Racha? Is the sea pretty? Send me a picture.', choices: [
    { th: 'สวย เดี๋ยวไปถ่ายที่อ่าวอุดมให้', en: 'Beautiful, I\'ll take one at Ao Udom', rth: 'รอนะ อิจฉาเลย', ren: 'Waiting, so jealous.', rel: 3, act: { go: 'MARKET' } },
    { th: 'เรียนจนไม่ได้ไปทะเลเลย 555', en: 'Too busy studying to see the sea 555', rth: 'อะไรเนี่ย อยู่ติดทะเลแท้ๆ 555', ren: 'You live next to it 555', rel: 1, mood: 2 }] }) },
  { id: 'bf_bored', who: ['bestie'], w: 2, make: (c, x) => ({ th: 'เบื่อเรียนว่ะ อยากกลับไปนั่งกินส้มตำหน้าโรงเรียนเหมือนเดิม 555', en: 'Bored of uni. I miss eating papaya salad in front of our old school 555', choices: [
    { th: 'เหมือนกัน คิดถึงช่วงนั้นมาก', en: 'Same, I miss those days', rth: 'ปิดเทอมกลับมาเจอกันนะ', ren: 'Let\'s meet up during the break.', rel: 4, mood: 4 },
    { th: 'อดทนอีกไม่กี่ปี', en: 'Hang in there, few more years', rth: 'จ้าาา คุณแม่ 555', ren: 'Yes, Mom 555', rel: 2, mood: 2 }] }) },
  // ---- anyone (friends) ----
  { id: 'any_hungry', who: ['classmate', 'roommate', 'club', 'bestie', 'work'], when: x => x.hunger < 35 && x.phase !== 'morning', w: 5, make: (c, x) => ({ th: c.pers === 'foodie' ? 'หิวยัง ไปถนนอาหารกันป่ะ หมูปิ้งร้านประจำเปิดแล้ว' : 'กินข้าวยัง ไปกินด้วยกันไหม', en: c.pers === 'foodie' ? 'Hungry? Food street? Our pork skewer stall is open.' : 'Eaten yet? Want to grab food together?', choices: [
    { th: 'ไป หิวมาก', en: 'Yes, starving', rth: c.pers === 'foodie' ? 'เจอกันที่ถนนอาหาร' : 'เจอกันที่โรงอาหารกลางนะ', ren: 'See you there.', rel: 3, act: { meet: c.pers === 'foodie' ? 'FOODST' : 'B07' } },
    { th: 'เพิ่งกินไป', en: 'Just ate', rth: 'อ้าว ไว้มื้อหน้า', ren: 'Oh, next time then.', rel: 0 }] }) },
  { id: 'any_lvl', who: ['classmate', 'club', 'roommate', 'senior'], when: x => x.justLevel, w: 9, make: (c, x) => ({ th: `ได้ข่าวว่าเลเวล ${x.lv} แล้วหรอ ไวมาก 😂`, en: `Level ${x.lv} already? That was fast 😂`, choices: [
    { th: 'ขยันไง 😎', en: 'Hard work 😎', rth: 'สอนบ้างดิ', ren: 'Teach me your ways.', rel: 2, mood: 4 },
    { th: 'ฟลุ๊คๆ', en: 'Pure luck', rth: 'ถ่อมตัวจัง 555', ren: 'So modest 555', rel: 2, mood: 3 }] }) },
  { id: 'any_beach', who: ['club', 'roommate', 'bestie', 'classmate'], when: x => x.phase === 'evening', w: 3, make: (c, x) => ({ th: 'ไปนั่งดูพระอาทิตย์ตกที่อ่าวอุดมกันไหม วันนี้ฟ้าสวย', en: 'Want to watch the sunset at Ao Udom? The sky looks great today.', choices: [
    { th: 'ไป เจอกันที่ตลาด', en: 'Yes, meet at the market', rth: 'ไปก่อนนะ จะจองโต๊ะริมทะเล', ren: 'I\'ll grab a table by the sea.', rel: 3, act: { meet: 'MARKET' } },
    { th: 'ขี้เกียจออกไปไกล', en: 'Too lazy to go that far', rth: 'งั้นส่งรูปให้ดูแทน', ren: 'I\'ll send you photos then.', rel: 0 }] }) },
  { id: 'any_meme', who: ['classmate', 'roommate', 'club', 'work', 'bestie'], w: 2, make: (c, x) => ({ th: c.pers === 'tease' ? 'เมื่อกี้เห็นเดินเหม่อตรงหน้าตึก เกือบเดินชนเสา 555' : 'เห็นคลิปแมวในกลุ่มคณะยัง ขำมาก 555', en: c.pers === 'tease' ? 'Saw you daydreaming by the building earlier, nearly walked into a pole 555' : 'Saw the cat video in the faculty group? So funny 555', choices: [
    { th: 'ไม่จริง!', en: 'Not true!', rth: 'มีพยานนะ 555', ren: 'I have witnesses 555', rel: 1, mood: 3 },
    { th: '555 ส่งมาอีก', en: '555 send more', rth: 'ได้ๆ เดี๋ยวส่งเพิ่ม', ren: 'Sure, sending more.', rel: 2, mood: 3 }] }) },
];

// friend calls (choice conversations)
const CALLS = [
  { id: 'call_mom', who: 'mom', w: 3, make: (c, x) => [
    { npc: 'ฮัลโหลลูก เป็นไงบ้าง กินข้าวยัง', choices: [{ me: `กินแล้ว${x.pol}แม่`, reply: 'ดีจ้ะ', fx: { rel: 2 } }, { me: 'ยังเลย กำลังจะไปกิน', reply: 'รีบไปนะลูก', fx: { rel: 1, act: { go: 'B07' } } }] },
    { npc: 'ช่วงนี้เรียนหนักไหม', choices: [{ me: 'หนักนิดหน่อย แต่ไหวอยู่', reply: 'สู้ๆ นะลูก แม่เชื่อว่าลูกทำได้', fx: { rel: 3, mood: 6 } }, { me: 'เหนื่อยมากเลยแม่', reply: 'พักผ่อนบ้างนะ อย่าหักโหม แม่เป็นห่วง', fx: { rel: 3, mood: 8 } }] },
    { npc: 'แค่นี้ก่อนนะ รักลูกนะ ดูแลตัวเองด้วย' }] },
  { id: 'call_dad', who: 'dad', w: 2, make: (c, x) => [
    { npc: c.pers === 'jokey' ? 'ไง ไอ้หนู ยังมีชีวิตอยู่ไหม 555' : 'ฮัลโหล เป็นไงบ้างลูก', choices: [{ me: `สบายดี${x.pol}พ่อ`, reply: 'ดีแล้ว', fx: { rel: 2 } }, { me: 'งานเยอะมาก', reply: 'ค่อยๆ ทำไป อย่าเครียด', fx: { rel: 2, mood: 3 } }] },
    { npc: `ที่บ้านทุกคนสบายดี ${c.prov[0]}ฝนตกทุกวันเลย`, choices: [{ me: 'ฝากสวัสดีทุกคนด้วยนะ', reply: 'จ้ะ เดี๋ยวบอกให้', fx: { rel: 3, mood: 3 } }] },
    { npc: 'มีอะไรโทรหาพ่อได้ตลอดนะ' }] },
  { id: 'call_friend', who: ['classmate', 'club', 'roommate', 'senior', 'bestie'], w: 3, make: (c, x) => { const place = pick([['B07', 'โรงอาหารกลาง'], ['FOODST', 'ถนนอาหาร'], ['CAFE', 'ร้านกาแฟในมอ'], ['B21', 'สนามฟุตซอล'], ['MARKET', 'ตลาดอ่าวอุดม']]); return [
    { npc: `เห้ย ${x.me} ว่างป่ะ`, choices: [{ me: 'ว่าง มีอะไร', reply: `ไป${place[1]}กันไหม พวกเราอยู่กันครบแล้ว`, fx: { rel: 1 } }, { me: 'ไม่ค่อยว่าง ทำไมอะ', reply: `จะชวนไป${place[1]}อะ`, fx: {} }] },
    { npc: 'มาไหม', choices: [{ me: 'ไป เดี๋ยวตามไป', reply: 'โอเค รอนะ', fx: { rel: 3, act: { meet: place[0] } } }, { me: 'วันนี้ขอผ่าน', reply: 'โอเค ไว้วันหลัง', fx: { rel: -1 } }] },
    { npc: c.g === 'f' ? 'แค่นี้นะ บาย' : 'แค่นี้แหละ บาย' }]; } },
];

// NPC status posts on KU Feed (by role / personality)
const POSTS = {
  classmate: ['ควิซวันนี้ยากมาก ใครทำได้บ้าง 😭', 'นั่งเรียนคาบเช้าแล้วง่วงสุดๆ', 'ใครมีชีทวิชานี้บ้าง ขอยืมหน่อย', 'แอร์ห้องเรียนรวมหนาวมาก พกเสื้อกันหนาวด้วยนะทุกคน'],
  roommate: ['ไฟที่หอดับอีกแล้ว 🥲', 'ใครอยู่หอ B บ้าง มีคนทำกุญแจตกไว้หน้าลิฟต์', 'วันนี้ซักผ้าแล้วฝนตก ชีวิต', 'รับหิ้วชานมไข่มุกจากถนนอาหาร ใครเอาบ้าง 🧋'],
  senior: ['น้องปี 1 คนไหนอยากได้ชีทเก่า ทักมาได้นะ', 'อีกเทอมเดียวจบแล้ว ใจหาย', 'ฝึกงานที่นิคมแหลมฉบังเหนื่อยแต่สนุก'],
  club: ['ซ้อมเสร็จแล้ว เหนื่อยแต่สนุก ⚽', 'ชมรมรับสมาชิกเพิ่มนะ มาสมัครที่ศูนย์กิจกรรม', 'ใครว่างเย็นนี้ ขาดคนเตะบอลหนึ่ง'],
  work: ['วันนี้วิ่งส่งของไป 12 รอบ ขาลาก', 'ลูกค้าวันนี้ใจดีมาก ให้ทิปด้วย 🥹', 'เปิดร้านแล้วนะ แวะมาอุดหนุนได้'],
  bestie: ['คิดถึงเพื่อนมัธยมจัง', 'ที่มอเราฝนตกทั้งวันเลย', 'ใครกลับบ้านช่วงปิดเทอมบ้าง นัดเจอกัน'],
};
export function npcPost(c) { const list = POSTS[c.role]; return list ? pick(list) : null; }

// ---------------------------------------------------------------------------------------------------------------
// customers and passengers (KU Ride / own shop): short, natural requests from people around Si Racha
const CUST_M = ['ลุงชัย', 'พี่โอ๊ต', 'น้องกัน ปี 1', 'พี่ยามหอ B', 'อาจารย์สมพงษ์', 'พี่เอก วินหน้ามอ', 'น้องบอส', 'พี่หนุ่ม'];
const CUST_F = ['ป้าแดง', 'น้องมุก ปี 1', 'พี่แอน', 'อาจารย์วิภา', 'พี่เจี๊ยบ', 'น้องฝ้าย', 'คุณนิด', 'พี่ปู'];
export function personName() { return Math.random() < 0.5 ? pick(CUST_M) : pick(CUST_F); }
const RIDE_WHY = {
  lecture: ['เรียนสาย 😭 รีบหน่อยนะ', 'มีสอบเก้าโมง ช่วยด้วย', 'เรียนคาบบ่าย ไปส่งหน้าตึกที'], faculty: ['ไปส่งหน้าคณะหน่อย มีพรีเซนต์', 'ลืมงานไว้ที่คณะ ต้องรีบไปเอา'],
  condo: ['กลับคอนโด ขนของเยอะหน่อยนะ', 'ไปส่งคอนโดที เหนื่อยมาก'], dorm: ['กลับหอ ขี้เกียจเดินแล้ว 555', 'ไปส่งหน้าหอหน่อย ฝนจะตก'],
  market: ['ไปตลาดอ่าวอุดม จะไปหาของกิน', 'ไปตลาดหน่อย นัดเพื่อนไว้'], clinic: ['ไปโรงพยาบาลหน่อย มีนัดหมอ', 'ไม่ค่อยสบาย ไปส่งโรงพยาบาลที'],
  hotel: ['ไปโรงแรมริมทะเล มีแขกมารอ', 'ไปส่งที่โรงแรมหน่อย'], cafe: ['ไปร้านกาแฟ นัดคุยงานไว้', 'ไปนั่งอ่านหนังสือที่ร้านกาแฟ'], gas: ['ไปปั๊มหน่อย รถเพื่อนน้ำมันหมด 555'],
  default: ['ไปส่งหน่อยนะ', 'รีบนิดนึงนะ ขอบคุณมาก', 'ไปส่งตรงนี้ที'],
};
export function rideLine(destKind) { return pick(RIDE_WHY[destKind] || RIDE_WHY.default); }
const FOOD_NOTE = ['ไม่เผ็ดนะคะ', 'ขอน้ำจิ้มเยอะๆ', 'ส่งหน้าหอ ไม่ต้องขึ้นมา', 'ขอช้อนส้อมด้วยนะ', 'รีบหน่อย หิวมาก 😭', 'โทรมาตอนถึงนะ', 'ฝากไว้กับยามได้เลย'];
export function foodNote() { return pick(FOOD_NOTE); }

// ---------------------------------------------------------------------------------------------------------------
export class Society {
  constructor(G, notifier) {
    this.G = G; this.N = notifier; this.t = 0; this.next = rr(25, 45); this.ctxFlags = {};
    const p = G.profile; p.social = p.social || {};
    const S = p.social; if (!S.seed) S.seed = (p.studentId || '') + ':' + (p.created || '') + ':' + p.name;
    S.rel = S.rel || {}; S.th = S.th || {}; S.pend = S.pend || {}; S.cd = S.cd || {}; S.unread = S.unread || {}; S.feed = S.feed || []; S.lastCall = S.lastCall || 0;
    this.S = S; this.contacts = buildCircle(S.seed, p.faculty);
    for (const c of this.contacts) if (S.rel[c.id] == null) S.rel[c.id] = c.kind === 'family' ? 70 : 45 + Math.floor(Math.random() * 15);
    this.byId = Object.fromEntries(this.contacts.map(c => [c.id, c]));
  }
  ctx() {
    const G = this.G, p = G.profile, t = G.time(); const fac = { eng: 'B23', sci: 'B26', ms: 'B22', econ: 'B18', ims: 'B24' }[p.faculty] || 'B06'; const fp = G.world.places[fac];
    const nickname = String(p.name || '').split(' ')[0];
    return { me: nickname, pol: (p.look && p.look.gender === 'f') ? 'ค่ะ' : 'ครับ', hour: t.hour, phase: t.hour < 10.5 ? 'morning' : t.hour < 13.5 ? 'midday' : t.hour < 16 ? 'afternoon' : 'evening',
      rain: G.weather() === 'rain', money: p.money, hunger: p.stats.hunger, energy: p.stats.energy, lv: p.level, gpa: p.gpa || 0, facB: fp ? (fp.th || fp.name) : 'ตึกเรียน', facBId: fac,
      inVehicle: !!(G.player && G.player.vehicle), justLevel: this.ctxFlags.level, justWorked: this.ctxFlags.job, older: false };
  }
  flag(k) { this.ctxFlags[k] = true; this.next = Math.min(this.next, rr(6, 14)); }
  // ---------- threads ----------
  thread(id) { return this.S.th[id] || (this.S.th[id] = []); }
  add(id, me, th, en) { const T = this.thread(id); T.push({ t: Date.now(), me, th, en }); while (T.length > 12) T.shift(); }
  text(m) { return L2(m.en || m.th, m.th || m.en); }
  unread(id) { return this.S.unread[id] || 0; }
  markRead(id) { if (this.S.unread[id]) { this.S.unread[id] = 0; this.N.clear('msg'); } }
  // ---------- scheduler ----------
  update(dt) {
    const G = this.G; if (!G.profile || G._fainting) return;
    this.t += dt; this.next -= dt;
    if (this.meet) this.checkMeet();
    if (this.next > 0) return;
    this.next = rr(70, 140); const x = this.ctx();
    // occasional NPC post on the feed
    if (Math.random() < 0.3) { const c = pick(this.contacts.filter(c => c.kind === 'friend')); const txt = npcPost(c); if (txt) { this.S.feed.unshift({ id: 'n' + Date.now(), who: c.id, text: txt, t: Date.now(), likes: Math.floor(rr(1, 40)), liked: false }); this.S.feed.length = Math.min(this.S.feed.length, 15); } }
    const now = Date.now();
    if (now - this.S.lastCall > 6 * 60e3 && Math.random() < 0.18 && !this.N.call && !G.task) { if (this.callSomeone(x)) return; }
    const evs = EVENTS.filter(e => e.who.some(w => this.byId[w]) && (!e.when || e.when({ ...x, older: this.byId.sib && this.byId.sib.older })) && now - (this.S.cd[e.id] || 0) > 25 * 60e3);
    if (!evs.length) return;
    let tot = evs.reduce((s, e) => s + e.w, 0), r = Math.random() * tot, ev = evs[0];
    for (const e of evs) { r -= e.w; if (r <= 0) { ev = e; break; } }
    const whoIds = ev.who.filter(w => this.byId[w] && !this.S.pend[w] && now - (this.S.cd['c:' + w] || 0) > 4 * 60e3); if (!whoIds.length) return;
    const c = this.byId[pick(whoIds)]; const m = ev.make(c, { ...x, older: c.older });
    this.S.cd[ev.id] = now; this.S.cd['c:' + c.id] = now; this.ctxFlags = {};
    this.deliver(c, m);
  }
  deliver(c, m) {
    this.add(c.id, false, m.th, m.en); this.S.pend[c.id] = m.choices || null; this.S.unread[c.id] = (this.S.unread[c.id] || 0) + 1;
    const open = this.G.phone && this.G.phone.open && this.G.phone.app === 'msg:' + c.id;
    this.N.push({ app: open ? null : 'msg', icon: c.icon, title: c.name, text: L2(m.en, m.th), sound: 'msg', quiet: open, onTap: () => this.G.phone.openPhone('msg:' + c.id) });
    if (open) this.G.phone.show('msg:' + c.id);
  }
  // player picked a reply in the Messages app
  reply(id, k) {
    const c = this.byId[id]; const ch = this.S.pend[id] && this.S.pend[id][k]; if (!c || !ch) return;
    this.S.pend[id] = null; this.add(id, true, ch.th, ch.en); this.apply(c, ch);
    setTimeout(() => { if (ch.rth) { this.add(id, false, ch.rth, ch.ren); const open = this.G.phone.open && this.G.phone.app === 'msg:' + id; if (open) { this.G.phone.show('msg:' + id); this.G.audio.ping('blip'); } else { this.S.unread[id] = (this.S.unread[id] || 0) + 1; this.N.push({ app: 'msg', icon: c.icon, title: c.name, text: L2(ch.ren, ch.rth), sound: 'msg' }); } } this.G.save(); }, rr(1200, 3200));
  }
  apply(c, fx) {
    const G = this.G; if (fx.rel) this.S.rel[c.id] = Math.max(0, Math.min(100, (this.S.rel[c.id] || 50) + fx.rel));
    if (fx.mood) G.stat('mood', fx.mood); G.addXP(4, '', 'talk'); G.skill('cha', 0.15); G.profile.counters.chats++;
    const a = fx.act; if (!a) return;
    const goTo = (pid) => { const pl = G.world.places[pid]; if (pl) { G.waypoint = { x: pl._door.x, z: pl._door.z, name: pl.th || pl.name }; G.routeTimer = 0; return pl; } return null; };
    if (a.go) { const pl = goTo(a.go); if (pl) G.ui.toast('📍 ' + L2('GPS set: ', 'ตั้ง GPS ไปที่ ') + (pl.th || pl.name)); }
    if (a.meet) { const pl = goTo(a.meet); if (pl) { this.meet = { who: c.id, pid: a.meet, until: Date.now() + 9 * 60e3 }; G.ui.toast('🤝 ' + L2(`Meet ${c.name} at ${pl.name}`, `ไปเจอ${c.name}ที่${pl.th || pl.name}`)); } }
    if (a.home && G.homeDoor) { const h = G.homeDoor(); if (h) { G.waypoint = h; G.routeTimer = 0; } }
  }
  checkMeet() {
    const m = this.meet, G = this.G; if (Date.now() > m.until) { this.meet = null; return; }
    const pl = G.world.places[m.pid]; if (!pl) { this.meet = null; return; }
    if (Math.hypot(pl._door.x - G.player.pos.x, pl._door.z - G.player.pos.z) < 22) {
      const c = this.byId[m.who]; this.meet = null; G.waypoint = null;
      const lines = [['มาแล้ว! นั่งตรงนี้เลย', 'There you are! Sit here.'], ['ช้าจัง 555 มาๆ', 'You\'re late 555 come on'], ['เย้ มาจนได้', 'Yay, you made it'], ['มาพอดีเลย กำลังจะเริ่ม', 'Perfect timing, we\'re starting']];
      const l = pick(lines); this.add(c.id, false, l[0], l[1]);
      this.S.rel[c.id] = Math.min(100, (this.S.rel[c.id] || 50) + 4); G.stat('mood', 10); G.addXP(20, L2(`with ${c.name}`, `กับ${c.name}`), 'activity');
      G.audio.ping('friend'); G.ui.big(L2('Hanging out', 'ใช้เวลากับเพื่อน'), `${c.icon} ${c.name} · ${L2(l[1], l[0])}`, 3200);
    }
  }
  callSomeone(x) {
    const opts = CALLS.flatMap(cl => (Array.isArray(cl.who) ? cl.who : [cl.who]).filter(w => this.byId[w]).map(w => ({ cl, c: this.byId[w] })));
    if (!opts.length) return false; const o = pick(opts); const lines = o.cl.make(o.c, { ...x, older: o.c.older });
    const fxWrap = lines.map(L => ({ npc: L.npc, choices: L.choices && L.choices.map(ch => ({ me: ch.me, reply: ch.reply, fx: () => this.apply(o.c, ch.fx || {}) })) }));
    const ok = this.N.ring({ name: o.c.name, sub: aboutOf(o.c), icon: o.c.icon, lines: fxWrap,
      onMissed: () => { this.add(o.c.id, false, 'โทรไปไม่รับเลย 🥲 ว่างแล้วโทรกลับนะ', 'You didn\'t pick up 🥲 call me back when you\'re free'); this.S.unread[o.c.id] = (this.S.unread[o.c.id] || 0) + 1; this.N.push({ app: 'msg', icon: '📞', title: L2('Missed call', 'สายที่ไม่ได้รับ'), text: o.c.name, sound: 'msg' }); },
      onEnd: (how) => { if (how === 'done' || how === 'hung') { this.S.rel[o.c.id] = Math.min(100, (this.S.rel[o.c.id] || 50) + 2); this.G.save(); } } });
    if (ok) this.S.lastCall = Date.now();
    return ok;
  }
  // a customer / passenger call during a job (no choices that change the economy)
  customerCall(name, line, onEnd) {
    const pol = this.ctx().pol;
    return this.N.ring({ name, sub: L2('customer', 'ลูกค้า'), icon: '📦', lines: [{ npc: line, choices: [{ me: `ได้${pol} กำลังไป${pol}`, reply: 'ขอบคุณมากนะ' }, { me: 'อีกแป๊บเดียวถึงแล้ว', reply: 'โอเค รออยู่นะ' }] }], onEnd });
  }
}
