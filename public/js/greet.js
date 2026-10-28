// Every so often someone walking nearby comes over to say hi (hand-written lines that fit the time of day), then goes on
// with their day. Press E to keep talking to them (the normal NPC talk).
import { L2 } from './i18n.js';

const rr = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const LINES = {
  morning: [['อรุณสวัสดิ์ ไปเรียนเหรอ', 'Morning! Off to class?'], ['เช้านี้อากาศดีนะ', 'Nice weather this morning'], ['กินข้าวเช้ายัง ร้านโจ๊กหน้าหอเปิดแล้วนะ', 'Had breakfast? The congee stall by the dorm is open'], ['ตื่นสายเหมือนกันเลย 555', 'Overslept too? 555']],
  midday: [['ไปกินข้าวไหน โรงอาหารคนเยอะมาก', 'Where are you eating? The cafeteria is packed'], ['ร้อนมากวันนี้ ☀️', 'So hot today ☀️'], ['ว่างคาบบ่ายไหม', 'Free this afternoon?'], ['เห็นเดินผ่านบ่อยนะ อยู่คณะไหนอะ', 'I see you around a lot — which faculty?']],
  afternoon: [['เลิกเรียนแล้วไปไหนต่อ', 'Where to after class?'], ['ไปเตะบอลกันไหม สนามว่าง', 'Football? The pitch is free'], ['ชานมไข่มุกร้านใหม่อร่อยนะ ลองยัง', 'Tried the new bubble tea place?'], ['เหนื่อยจัง อยากนอนแล้ว', 'So tired, I want a nap']],
  evening: [['ไปดูพระอาทิตย์ตกที่อ่าวอุดมไหม', 'Sunset at Ao Udom?'], ['กลับหอยัง', 'Heading back to the dorm?'], ['เย็นนี้มีตลาดนัดนะ', 'There\'s a market this evening'], ['เดินกลับดีๆ นะ', 'Get home safe']],
  any: [['สวัสดี 👋', 'Hi 👋'], ['ทักทายจ้า', 'Hey there'], ['เสื้อสวยดีนะ', 'Nice shirt'], ['ได้ข่าวว่ามีกิจกรรมที่ศูนย์กิจกรรม', 'Heard there\'s something on at the activity centre']],
};

export function makeGreeter({ G, life, player }) {
  let t = rr(40, 70), busy = null;
  return (dt) => {
    if (busy) return; t -= dt; if (t > 0) return; t = rr(65, 130);
    if (player.vehicle || G._fainting || (G.phone && G.phone.open) || player.speed > 4) return;
    const p = player.pos; const cand = life.agents.filter(a => !a.dead && !a.greeted && (a.act === 'walk' || a.act === 'idle') && ['student', 'local', 'athlete'].includes(a.role) && Math.hypot(a.x - p.x, a.z - p.z) < 26 && Math.hypot(a.x - p.x, a.z - p.z) > 4);
    if (!cand.length) return; const a = pick(cand); a.greeted = true; busy = a;
    const saved = { wp: a.wp, wpi: a.wpi, then: a.then, act: a.act };
    const ang = Math.atan2(a.x - p.x, a.z - p.z); const tx = p.x + Math.sin(ang) * 1.6, tz = p.z + Math.cos(ang) * 1.6;
    const giveUp = setTimeout(() => { if (busy === a) { busy = null; restore(); } }, 14000);
    const restore = () => { a.emote = null; if (a.dead) return; if (saved.wp && saved.wp.length) { a.wp = saved.wp; a.wpi = saved.wpi; a.then = saved.then; a.act = 'walk'; } else { a.act = 'idle'; } };
    life.goto(a, tx, tz, () => {
      clearTimeout(giveUp); if (a.dead) { busy = null; return; }
      a.h = Math.atan2(player.pos.x - a.x, player.pos.z - a.z); a.emote = 'wave'; a.speed = 0; a.act = 'pose'; a.life = 6; a.after = () => { busy = null; restore(); };
      const h = G.time().hour; const phase = h < 10.5 ? 'morning' : h < 13.5 ? 'midday' : h < 16 ? 'afternoon' : 'evening';
      const l = pick(Math.random() < 0.7 ? LINES[phase] : LINES.any); a.bubble.userData.show(L2(l[1], l[0])); a.bubble.userData.until = performance.now() + 4500;
      if (life.onSay) life.onSay(a, a.topic || 'walk');
      setTimeout(() => { if (a.emote === 'wave') a.emote = null; }, 2500);
    });
  };
}
