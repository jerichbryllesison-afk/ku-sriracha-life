// Unified line-icon set (24×24 grid, 1.75 stroke, round caps/joins). Used by the HUD, phone, toasts and
// map canvases (via Path2D) so every surface shares one icon geometry instead of mixed emoji.
const C = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`;
export const ICONS = {
  chat: 'M4 5h16v11H9l-5 4z',
  map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14',
  briefcase: 'M3 8h18v11H3zM8 8V5h8v3M3 13h18',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  bank: 'M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18',
  user: C(12, 8, 4) + 'M4 21c1-4 4.5-6 8-6s7 2 8 6',
  bag: 'M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2',
  shirt: 'M8 3L3 6l2 4 3-1v12h8V9l3 1 2-4-5-3c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3z',
  car: 'M3 16v-4l2-5h14l2 5v4zM3 16v2h3v-2M18 16v2h3v-2M5 12h14',
  scooter: C(5, 17, 2) + C(19, 17, 2) + 'M7 17h8l3-8h-4M14 9V6h-3M11 13H4',
  camera: 'M3 8h4l2-3h6l2 3h4v11H3z' + C(12, 13, 3),
  radio: 'M4 9h16v11H4zM7 9l10-5' + C(10, 14.5, 2) + 'M15 13h2M15 16h2',
  users: C(9, 7.5, 3.5) + 'M2 20c.8-3.5 3.6-5 7-5s6.2 1.5 7 5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 15c2 .6 3.4 2.2 4 5',
  flower: C(12, 6.8, 2.8) + C(17.2, 12, 2.8) + C(12, 17.2, 2.8) + C(6.8, 12, 2.8) + C(12, 12, 1.6),
  gear: C(12, 12, 3) + 'M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
  help: C(12, 12, 9) + 'M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6z',
  bowl: 'M3 11h18a9 9 0 0 1-18 0zM8 7.5c0-1.2 1-1.6 1-3M12 7.5c0-1.2 1-1.6 1-3M16 7.5c0-1.2 1-1.6 1-3',
  smile: C(12, 12, 9) + 'M8.5 14c1 1.3 2.2 2 3.5 2s2.5-.7 3.5-2M9 9.5h.01M15 9.5h.01',
  sun: C(12, 12, 4) + 'M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  cloud: 'M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 18z',
  rain: 'M7 14h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 14zM8 17l-1 3M12 17l-1 3M16 17l-1 3',
  pin: 'M12 21s-6-6.2-6-11a6 6 0 0 1 12 0c0 4.8-6 11-6 11z' + C(12, 10, 2),
  coin: C(12, 12, 9) + 'M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v2M12 16v2',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  check: 'M5 12.5l4.5 4.5L19 7',
  x: 'M6 6l12 12M18 6L6 18',
  back: 'M15 5l-7 7 7 7',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  key: C(7.5, 14.5, 3.5) + 'M10 12l9-9M16 6l3 3M14 8l2 2',
  alert: 'M12 4l9 16H3zM12 10v4M12 17h.01',
  cap: 'M2 9l10-5 10 5-10 5zM6 11v5c2 2 10 2 12 0v-5M22 9v6',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h7',
  flask: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3M7.5 15h9',
  cup: 'M4 8h13v5a6 6 0 0 1-12 0zM17 9h1.5a2.5 2.5 0 0 1 0 5H17M7 3v2M11 3v2',
  bed: 'M3 19V6M3 13h18v6M21 13a3 3 0 0 0-3-3h-7v3' + C(7, 10.5, 1.5),
  home: 'M4 11l8-7 8 7M6 9.5V20h12V9.5M10 20v-5h4v5',
  dumbbell: 'M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12',
  ball: C(12, 12, 9) + 'M12 7l4 3-1.5 4.5h-5L8 10zM12 3v4M21 10.5l-5-.5M18 19l-3.5-4.5M6 19l3.5-4.5M3 10.5l5-.5',
  cross: 'M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z',
  fuel: 'M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h14M5 10h10M15 8l3 2v7a1.5 1.5 0 0 0 3 0V9l-3-3',
  scissors: 'M8.5 8.5L20 20M8.5 15.5L20 4' + C(6, 6, 3) + C(6, 18, 3),
  store: 'M3 9l2-5h14l2 5M4 9v11h16V9M3 9h18M9 20v-6h6v6',
  building: 'M5 21V4h10v17M15 9h4v12M3 21h18M8 8h4M8 12h4M8 16h4',
  music: 'M9 18V5l11-2v13' + C(6, 18, 3) + C(17, 16, 3),
  fire: 'M12 21c-4 0-6.5-2.6-6.5-6 0-4 3.5-5.5 4-10 3 2 5 4.5 5 7.5 1-1 1.5-2 1.5-3.5 1.5 1.5 2.5 3.5 2.5 6 0 3.4-2.5 6-6.5 6z',
  hand: 'M8 13V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v7c0 4-2.5 8-7 8-3 0-4.5-2-6-5l-1.5-3a1.5 1.5 0 0 1 2.6-1.5L8 13',
  phone: 'M7 2h10v20H7zM11 18h2',
  chair: 'M6 3v18M6 13h12v8M18 13V9M6 9h12',
  send: 'M4 12l16-8-6 16-3-6z',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H4c0 3 2 4 4 4M16 6h4c0 3-2 4-4 4M12 13v4M8 21h8M9 17h6v4',
  gift: 'M4 10h16v11H4zM2 7h20v3H2zM12 7v14M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0',
  clock: C(12, 12, 9) + 'M12 7v5l3 2',
  info: C(12, 12, 9) + 'M12 11v6M12 7.5h.01',
  bike: C(5.5, 16.5, 3.5) + C(18.5, 16.5, 3.5) + 'M5.5 16.5L9 9h6l3.5 7.5M9 9l3 7.5L15 9M8 6h3',
  shield: 'M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z',
  wave: 'M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0',
  spark: 'M12 3v6M12 15v6M3 12h6M15 12h6',
};

export function icon(name, cls = '') {
  const d = ICONS[name] || ICONS.info;
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
}

// Canvas drawing with the same geometry
const p2d = new Map();
export function drawIcon(ctx, name, x, y, size, color = '#fff', width = 2) {
  let p = p2d.get(name); if (!p) { p = new Path2D(ICONS[name] || ICONS.info); p2d.set(name, p); }
  ctx.save(); ctx.translate(x - size / 2, y - size / 2); ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color; ctx.lineWidth = width * 24 / size; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(p); ctx.restore();
}

// Map an emoji at the start of legacy message strings to an icon (keeps all existing call sites working)
const EMOJI = {
  '📍': 'pin', '💰': 'coin', '💵': 'coin', '💸': 'coin', '⭐': 'star', '🌟': 'star', '🎉': 'trophy', '🏆': 'trophy', '⬆️': 'trophy', '📸': 'camera', '📷': 'camera',
  '🔑': 'key', '✅': 'check', '❌': 'x', '⚠️': 'alert', '😴': 'moon', '💤': 'moon', '🍜': 'bowl', '🍛': 'bowl', '🍽️': 'bowl', '☕': 'cup', '🛵': 'scooter', '🚗': 'car', '🚕': 'car',
  '🎓': 'cap', '📚': 'book', '📖': 'book', '💪': 'dumbbell', '🏋️': 'dumbbell', '🏊': 'wave', '🌼': 'flower', '💬': 'chat', '📱': 'phone', '🖱️': 'info', '⛽': 'fuel', '🏦': 'bank',
  '👕': 'shirt', '👗': 'shirt', '💈': 'scissors', '🎁': 'gift', '🚲': 'bike', '🏥': 'cross', '❤️': 'heart', '⚡': 'bolt', '😊': 'smile', '🎵': 'music', '🎶': 'music', '📻': 'radio',
  '🧪': 'flask', '🔬': 'flask', '🏠': 'home', '🛏️': 'bed', '⚽': 'ball', '🔒': 'lock', '🌧️': 'rain', '☀️': 'sun', '🌙': 'moon', '❗': 'alert', '👋': 'hand', '🏪': 'store', '🧾': 'info', '🛒': 'store', '🪪': 'user', '🧑‍🏫': 'cap', '🎸': 'music', '🎤': 'music', '🍢': 'bowl', '🥤': 'cup', '🧺': 'bag', '🔧': 'gear', '🛠️': 'gear', '🚿': 'wave', '🧴': 'bag', '📝': 'book', '💼': 'briefcase', '🤝': 'users', '🎫': 'key', '🏨': 'bed', '🏢': 'building', '🛕': 'home', '🚌': 'car', '🏁': 'flag', '🗺️': 'map', '🎮': 'smile', '💇': 'scissors', '🦐': 'bowl', '🔥': 'fire', '🏟️': 'ball', '🌱': 'flower', '🧑‍🍳': 'bowl', '👮': 'shield', '🍺': 'cup', '🍹': 'cup', '🏖️': 'sun', '🎒': 'bag', '🌊': 'wave',
};
const LEAD = /^\s*(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}️?)*)\s*/u;
export function splitLeadEmoji(text) {
  const m = String(text).match(LEAD); if (!m) return { icon: null, text };
  return { icon: EMOJI[m[1]] || EMOJI[m[1].replace(/️/g, '')] || 'info', text: String(text).slice(m[0].length) };
}
