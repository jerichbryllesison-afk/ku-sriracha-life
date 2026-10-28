// Language layer (Thai default, English optional). UI code calls tr('English text'); existing messages are matched by
// exact strings first, then by patterns for messages with numbers/names. Untranslated text falls back to English.
let LANG = 'th';
try { const s = JSON.parse(localStorage.getItem('kusl_settings') || '{}'); if (s.lang === 'en' || s.lang === 'th') LANG = s.lang; } catch (e) { }
export const lang = () => LANG;
export function setLang(l) { LANG = l === 'en' ? 'en' : 'th'; document.documentElement.lang = LANG; applyStatic(); }
export const isTH = () => LANG === 'th';
// pick between explicit variants
export const L2 = (en, th) => (LANG === 'th' && th ? th : en);

const D = {
  // HUD / static
  'Objective': 'ภารกิจ', 'Phone': 'โทรศัพท์', 'Map': 'แผนที่', 'Chat': 'แชท', 'Emote': 'ท่าทาง', 'Help': 'ช่วยเหลือ', 'What now?': 'ทำอะไรต่อ?',
  'online': 'ออนไลน์', 'Offline': 'ออฟไลน์', 'Say something…  Enter to send · Esc to cancel': 'พิมพ์ข้อความ…  Enter ส่ง · Esc ปิด',
  'Send': 'ส่ง', 'Close': 'ปิด', 'Campus map': 'แผนที่วิทยาเขต', 'Click to set GPS waypoint': 'คลิกเพื่อตั้งจุดหมาย GPS', 'Scroll to zoom · Drag to pan': 'เลื่อนเพื่อซูม · ลากเพื่อเลื่อน',
  // loading / creator
  'Starting…': 'กำลังเริ่ม…', 'Student Registration': 'ลงทะเบียนนิสิตใหม่', 'Identity': 'ข้อมูลนิสิต', 'Appearance': 'รูปลักษณ์', 'First-day outfit': 'ชุดวันแรก',
  'Name': 'ชื่อ', 'Faculty': 'คณะ', 'Program': 'สาขา', 'Body': 'เพศ', 'Male': 'ชาย', 'Female': 'หญิง', 'Height': 'ส่วนสูง', 'Skin tone': 'สีผิว', 'Hair style': 'ทรงผม', 'Hair colour': 'สีผม',
  'Register & enter campus': 'ลงทะเบียนและเข้ามหาวิทยาลัย', 'Progress is saved to the campus server.': 'ความคืบหน้าบันทึกไว้บนเซิร์ฟเวอร์', 'Drag the character to rotate': 'ลากเพื่อหมุนตัวละคร',
  'Your name': 'ชื่อของคุณ', 'STUDENT ID CARD': 'บัตรประจำตัวนิสิต', 'Language': 'ภาษา',
  // phone apps
  'Messages': 'ข้อความ', 'People': 'เพื่อน', 'Home': 'ที่พัก', 'My shop': 'ร้านของฉัน', 'Nearby': 'คนใกล้ๆ', 'Missed call': 'สายที่ไม่ได้รับ',
  'Chat app': 'แชท', 'Jobs': 'งาน', 'Quests': 'ภารกิจ', 'Bank': 'ธนาคาร', 'Profile': 'โปรไฟล์', 'Bag': 'กระเป๋า', 'Wardrobe': 'ตู้เสื้อผ้า', 'Garage': 'โรงรถ', 'KU Eats': 'KU Eats',
  'Camera': 'กล้อง', 'Radio': 'วิทยุ', 'Players': 'ผู้เล่น', 'Nonsi': 'ดอกนนทรี', 'Settings': 'ตั้งค่า', 'Wallet': 'กระเป๋าเงิน', 'Student account': 'บัญชีนิสิต',
  'Map & GPS': 'แผนที่ & GPS', 'Open full map': 'เปิดแผนที่ใหญ่', 'Part-time jobs': 'งานพิเศษ', 'Start now': 'เริ่มเลย', 'Set GPS': 'นำทาง', 'GPS': 'นำทาง',
  'Main story': 'เนื้อเรื่องหลัก', 'Daily · resets every game day': 'ภารกิจรายวัน · รีเซ็ตทุกวัน', 'Side tasks': 'ภารกิจเสริม', 'Cancel': 'ยกเลิก', 'Needs': 'ความต้องการ', 'Skills': 'ทักษะ',
  'Life stats': 'สถิติชีวิต', 'Health': 'สุขภาพ', 'Energy': 'พลังงาน', 'Hunger': 'ความอิ่ม', 'Mood': 'อารมณ์', 'Intelligence': 'สติปัญญา', 'Fitness': 'ร่างกาย', 'Charisma': 'เสน่ห์', 'Driving': 'การขับขี่',
  'Use': 'ใช้', 'Call': 'เรียกรถ', 'Players online': 'ผู้เล่นออนไลน์', 'Send ฿': 'โอนเงิน', 'Music': 'เพลง', 'Background music': 'เพลงประกอบ', 'Music volume': 'ระดับเสียงเพลง',
  'Show FPS': 'แสดง FPS', 'Controls': 'การควบคุม', 'Mouse sensitivity': 'ความไวเมาส์', 'Invert Y': 'กลับแกน Y', 'Audio': 'เสียง', 'Volume': 'ระดับเสียง', 'Account': 'บัญชี',
  'Reset character': 'สร้างตัวละครใหม่', 'Your save is linked to this browser.': 'เซฟของคุณผูกกับเบราว์เซอร์นี้', 'How to play': 'วิธีเล่น', 'Graphics · Maximum': 'กราฟิก · สูงสุด',
  'Turn on': 'เปิด', 'Turn off': 'ปิด', 'Radio off': 'ปิดวิทยุอยู่', 'Delivery rider': 'ไรเดอร์ส่งอาหาร', 'Go online & accept order': 'ออนไลน์ & รับออเดอร์', 'Task in progress…': 'กำลังทำงานอยู่…',
  'Golden Nonsi Flowers': 'ดอกนนทรีสีทอง',
  // menus
  'Attend class': 'เข้าเรียน', 'Banking': 'ธุรกรรมธนาคาร', 'Books & stationery': 'หนังสือ & เครื่องเขียน', 'Borrow a campus bicycle': 'ยืมจักรยานมหาวิทยาลัย', 'Buy a bike / scooter': 'ซื้อจักรยาน / มอเตอร์ไซค์',
  'Buy a car': 'ซื้อรถยนต์', 'Change faculty / program': 'เปลี่ยนคณะ / สาขา', 'Clothes': 'เสื้อผ้า', 'Clubs': 'ชมรม', 'Haircut & color': 'ตัดผม & ทำสีผม', 'Helmet': 'หมวกกันน็อก',
  'KU Co-op clothing': 'เสื้อผ้าสหกรณ์ มก.', 'Knock on the door': 'เคาะประตู', 'Look around': 'เดินดูรอบ ๆ', 'Lost & found': 'ของหาย', 'Meditate': 'นั่งสมาธิ', 'Play futsal': 'เล่นฟุตซอล',
  'Refuel': 'เติมน้ำมัน', 'Rent a room & sleep': 'เช่าห้องและนอนพัก', 'Run laps': 'วิ่งรอบสนาม', 'Set as home': 'ตั้งเป็นบ้าน', 'Sit on bench': 'นั่งม้านั่ง', 'Sleep': 'นอนพัก', 'Student ID card': 'บัตรนิสิต',
  'Study session': 'อ่านหนังสือ', 'Swim': 'ว่ายน้ำ', 'Watch an event': 'ชมกิจกรรม', 'Workout': 'ออกกำลังกาย', 'Exit vehicle': 'ลงจากรถ', 'Eat here': 'กินที่นี่', 'Buy items for your bag': 'ซื้อของใส่กระเป๋า',
  'Restore energy & health': 'ฟื้นพลังงานและสุขภาพ', 'Change clothes': 'เปลี่ยนชุด', 'Free': 'ฟรี', 'Free, once per day': 'ฟรี วันละครั้ง', 'View your student record': 'ดูข้อมูลนิสิต',
  '+Intelligence, +XP, −energy': '+สติปัญญา, +XP, −พลังงาน', 'Join a student club': 'สมัครชมรม', '+Mood, +Charisma': '+อารมณ์, +เสน่ห์', '+Fitness, +Charisma, +Mood': '+ร่างกาย, +เสน่ห์, +อารมณ์',
  // toasts / big messages (exact)
  'Bring your motorbike or car here first': 'นำมอเตอร์ไซค์หรือรถยนต์มาที่นี่ก่อน', 'Come back tomorrow for the next activity': 'พรุ่งนี้กลับมาทำกิจกรรมต่อนะ',
  'Finish your current task first (phone → Quests to cancel)': 'ทำงานปัจจุบันให้เสร็จก่อน (โทรศัพท์ → ภารกิจ เพื่อยกเลิก)', 'Finish your current task first': 'ทำงานปัจจุบันให้เสร็จก่อน',
  'Nobody answers… 🚪': 'ไม่มีใครตอบ… 🚪', 'Server is full (100/100) — playing offline': 'เซิร์ฟเวอร์เต็ม (100/100) — เล่นแบบออฟไลน์', 'Slow down first!': 'ชะลอความเร็วก่อน!',
  'Take a short break before studying again ☕': 'พักสักครู่ก่อนอ่านหนังสือต่อ ☕', 'Tank is already full ⛽': 'น้ำมันเต็มถังแล้ว ⛽', 'Task cancelled': 'ยกเลิกงานแล้ว', 'Vehicle reset': 'รีเซ็ตรถแล้ว',
  'You already rented a scooter': 'คุณเช่าสกู๊ตเตอร์แล้ว', 'You attended enough classes today 📚': 'วันนี้เรียนครบแล้ว 📚', 'You can change program once per game day': 'เปลี่ยนสาขาได้วันละครั้ง',
  'Your next shift starts in a few seconds…': 'กะต่อไปเริ่มในอีกไม่กี่วินาที…', '⏰ Classes run 08:00–17:00 (game time)': '⏰ เวลาเรียน 08:00–17:00 (เวลาในเกม)', '⏰ Running late — tip lost': '⏰ ส่งช้า — ไม่ได้ทิป',
  '⚠️ Lost connection — reconnecting…': '⚠️ การเชื่อมต่อหลุด — กำลังเชื่อมต่อใหม่…', '🏃 Run around the red track!': '🏃 วิ่งรอบลู่วิ่งสีแดง!', '🏊 Swim around to train Fitness': '🏊 ว่ายน้ำเพื่อฝึกร่างกาย',
  '🏠 Home set': '🏠 ตั้งบ้านแล้ว', '🏥 Treated at the clinic': '🏥 รักษาที่โรงพยาบาลแล้ว', '👕 Purchased!': '👕 ซื้อแล้ว!', '📍 GPS set': '📍 ตั้งนำทางแล้ว', '📍 Waypoint set': '📍 ตั้งจุดหมายแล้ว',
  '📍 You have arrived': '📍 ถึงที่หมายแล้ว', '📷 Photo mode — click to capture, Esc to exit': '📷 โหมดถ่ายรูป — คลิกเพื่อถ่าย, Esc เพื่อออก', '📸 Photo saved': '📸 บันทึกรูปแล้ว',
  '🔑 Scooter rented — press F to ride': '🔑 เช่าสกู๊ตเตอร์แล้ว — กด F เพื่อขี่', '😴 Too tired — sleep or have an energy drink': '😴 เหนื่อยเกินไป — ไปนอนหรือดื่มเครื่องดื่มชูกำลัง',
  '🛵 Ride your own motorbike to the main gate first': '🛵 ขี่มอเตอร์ไซค์ของคุณมาที่ประตูหลักก่อน', '🥡 Order picked up! Deliver it fast': '🥡 รับออเดอร์แล้ว! รีบไปส่งเลย',
  'QUEST COMPLETE': 'ภารกิจสำเร็จ', 'Good rest 😴': 'พักผ่อนเต็มที่ 😴', 'Energy restored': 'พลังงานกลับมาแล้ว', 'Welcome to the club!': 'ยินดีต้อนรับสู่ชมรม!', 'Excellent work!': 'ทำงานได้ยอดเยี่ยม!',
  'Great class!': 'เรียนได้ดีมาก!', 'Class attended': 'เข้าเรียนแล้ว', 'Keep studying…': 'ตั้งใจเรียนต่อไป…', 'Task complete!': 'ทำงานสำเร็จ!', 'You fainted…': 'คุณเป็นลม…', 'Rest and eat to stay healthy': 'พักผ่อนและกินข้าวเพื่อสุขภาพ',
  'Disconnected': 'หลุดการเชื่อมต่อ', 'Good morning': 'อรุณสวัสดิ์', 'A new day at KU Sriracha · 06:45': 'วันใหม่ที่ มก.ศรีราชา · 06:45', 'NEW RIDE!': 'รถคันใหม่!', 'Delivered! 🥡': 'ส่งสำเร็จ! 🥡', 'Fare paid 🏍️': 'ได้ค่าโดยสาร 🏍️',
  'No tip — too slow': 'ไม่ได้ทิป — ช้าเกินไป', '🏃 Lap complete!': '🏃 ครบรอบแล้ว!', '🌼 Golden Nonsi Flower': '🌼 ดอกนนทรีสีทอง', 'Performance is low — try a lower graphics setting in phone → Settings': 'เครื่องทำงานหนัก',
};
const P = [ // pattern rules for dynamic messages
  [/^📍 GPS set: (.+)$/, '📍 นำทางไป: $1'], [/^Talk to (.+?)( ❗)?$/, 'คุยกับ $1$2'], [/^Ride (.+)$/, 'ขี่ $1'], [/^Work: (.+)$/, 'ทำงาน: $1'], [/^Task: (.+)$/, 'งาน: $1'],
  [/^Rent a scooter \((.+)\)$/, 'เช่าสกู๊ตเตอร์ ($1)'], [/^Welcome, (.+)!$/, 'ยินดีต้อนรับ $1!'], [/^LEVEL (\d+)!$/, 'เลเวล $1!'], [/^Checkpoint (.+)$/, 'จุดเช็คพอยต์ $1'], [/^Sent (.+)$/, 'โอนแล้ว $1'],
  [/^⛽ Filled (.+) L for (.+)$/, '⛽ เติม $1 ลิตร ราคา $2'], [/^✅ Daily: (.+)$/, '✅ รายวัน: $1'], [/^🎁 Level bonus (.+)$/, '🎁 โบนัสเลเวล $1'], [/^💰 (.+) earned$/, '💰 ได้รับ $1'],
  [/^💸 (.+) sent you (.+)$/, '💸 $1 โอนให้คุณ $2'], [/^📩 Allowance from home: (.+)$/, '📩 เงินจากที่บ้าน: $1'], [/^🔑 (.+) is waiting nearby — press F to ride$/, '🔑 $1 จอดอยู่ใกล้ ๆ — กด F เพื่อขี่'],
  [/^🛍️ (.+) added to bag$/, '🛍️ $1 ใส่กระเป๋าแล้ว'], [/^🧭 Discovered: (.+)$/, '🧭 ค้นพบ: $1'], [/^❌ (.+)$/, '❌ $1'], [/^🎓 Faculty changed to (.+)$/, '🎓 เปลี่ยนคณะเป็น $1'],
  [/^(.+): Thanks again, see you tomorrow!$/, '$1: ขอบคุณอีกครั้ง พรุ่งนี้เจอกัน!'], [/^Score (\d+)%(.*)$/, 'คะแนน $1%$2'], [/^Tip ฿(\d+)$/, 'ทิป ฿$1'],
  [/^(\d+) \/ 25 found(.*)$/, 'พบแล้ว $1 / 25$2'], [/^Not enough money$/, 'เงินไม่พอ'], [/^Requires level (\d+)$/, 'ต้องเลเวล $1'], [/^Already own(ed)?$/, 'มีอยู่แล้ว'],
];

Object.assign(D, {
  'Freshman': 'น้องใหม่ ปี 1', 'Sophomore': 'ปี 2', 'Junior': 'ปี 3', 'Senior': 'ปี 4', 'Graduate': 'บัณฑิต', 'KU Legend': 'ตำนาน มก.',
  'Sunny': 'แดดดี', 'Cloudy': 'มีเมฆ', 'Rain': 'ฝนตก', 'Clear night': 'ฟ้าใส', 'Waypoint': 'จุดหมาย', 'Your vehicle': 'รถของคุณ',
  'Phone': 'โทรศัพท์', 'Emotes': 'ท่าทาง', 'Wave': 'โบกมือ', 'Dance': 'เต้น', 'Clap': 'ปรบมือ', 'Think': 'คิด', 'Sit': 'นั่ง', 'Push-ups': 'วิดพื้น', 'Lie down': 'นอน',
  'Nothing to do here yet': 'ยังไม่มีอะไรให้ทำที่นี่', 'Spawn here next time': 'เกิดที่นี่ครั้งต่อไป', 'Free KU bike share': 'จักรยาน มก. ใช้ฟรี', 'Uniforms, KU merch, bags': 'ชุดนิสิต ของที่ระลึก กระเป๋า',
  'Boost your study': 'ช่วยให้อ่านหนังสือได้ดีขึ้น', 'Ask if anyone needs help': 'ถามว่ามีใครต้องการความช่วยเหลือ', '+Mood, calm your mind': '+อารมณ์ ใจสงบ', 'Tops, jeans, dresses, shoes, hats': 'เสื้อ กางเกง ชุดเดรส รองเท้า หมวก',
  'New look': 'ลุคใหม่', 'Balance, history, transfers': 'ยอดเงิน ประวัติ โอนเงิน', 'Bicycles, scooters, big bikes': 'จักรยาน สกู๊ตเตอร์ บิ๊กไบค์', 'Use it until you log off': 'ใช้ได้จนออกจากเกม', 'Safety first': 'ปลอดภัยไว้ก่อน',
  'Hatchbacks to supercars': 'ตั้งแต่รถเล็กถึงซูเปอร์คาร์', 'Run the 400 m track — checkpoints count automatically': 'วิ่งลู่ 400 ม. — นับจุดเช็คพอยต์อัตโนมัติ', 'Staff housing': 'บ้านพักบุคลากร',
  'Free for KU students · +Fitness': 'ฟรีสำหรับนิสิต · +ร่างกาย', 'No more classes today': 'วันนี้ไม่มีคาบเรียนแล้ว', 'Quiz-based lecture · +INT, GPA, XP': 'เรียนแบบตอบคำถาม · +สติปัญญา GPA XP',
  'Closed — classes run 08:00–17:00': 'ปิด — เวลาเรียน 08:00–17:00', 'Join a student club': 'สมัครชมรม', 'Change faculty': 'เปลี่ยนคณะ', 'Your classes and faculty building change': 'คาบเรียนและตึกคณะจะเปลี่ยนตาม',
  'Round': 'รอบ', 'Stop': 'หยุด', 'Watch the sequence…': 'จำลำดับให้ดี…', 'Watch…': 'ดูให้ดี…', 'Oops!': 'ผิด!', 'Work': 'ทำงาน', 'OK': 'ตกลง', 'Done': 'เสร็จ', 'Buy': 'ซื้อ', 'Order': 'สั่ง', 'Owned': 'มีแล้ว', 'Wear': 'ใส่',
  'Not now': 'ไว้ก่อน', 'Accept': 'รับงาน', 'Open wardrobe': 'เปิดตู้เสื้อผ้า', 'Failed': 'ไม่สำเร็จ', 'Payment failed': 'ชำระเงินไม่สำเร็จ',
  'Studying at the library': 'อ่านหนังสือที่ห้องสมุด', 'Workout 🏋️': 'ออกกำลังกาย 🏋️', 'Lift when the marker hits the green zone': 'ยกเมื่อเข็มอยู่ในโซนสีเขียว', 'Futsal match ⚽': 'แข่งฟุตซอล ⚽',
  'Pass the ball — hit the keys in order': 'ส่งบอล — กดปุ่มตามลำดับ', 'Campus event': 'กิจกรรมในมหาวิทยาลัย', 'Meditation': 'นั่งสมาธิ', 'Student Activity Center · ศูนย์กิจกรรม': 'ศูนย์กิจกรรมนิสิต',
  'Join up to 2 clubs · visit daily for club activities': 'สมัครได้ 2 ชมรม · มาทำกิจกรรมได้ทุกวัน',
});
P.push(
  [/^(.+) joined KU Sriracha$/, '$1 เข้าร่วม มก.ศรีราชา'], [/^(.+) left$/, '$1 ออกจากเกม'], [/^(.+) left KU Sriracha$/, '$1 ออกจากเกม'],
  [/^✨ \+(\d+) XP.*$/, '✨ +$1 XP'], [/^📈 Intelligence (\d+)$/, '📈 สติปัญญา $1'], [/^📈 Fitness (\d+)$/, '📈 ร่างกาย $1'], [/^📈 Charisma (\d+)$/, '📈 เสน่ห์ $1'], [/^📈 Driving (\d+)$/, '📈 การขับขี่ $1'],
  [/^🎁 \+(.+)$/, '🎁 +$1'], [/^🧭 (.+?): (.+)$/, '🧭 $1: $2'], [/^Round (\d+)\/(\d+)$/, 'รอบ $1/$2'], [/^Repeat it! \((\d+)\)$/, 'กดซ้ำตามลำดับ! ($1)'], [/^Lecture: (.+)$/, 'เข้าเรียน: $1'],
  [/^Score (\d+)% · GPA (.+)$/, 'คะแนน $1% · GPA $2'], [/^Requires (.+)$/, 'ต้องมี $1'], [/^Member of (.+)$/, 'สมาชิก $1'], [/^Join: (.+)$/, 'สมัคร: $1'], [/^Club activity: (.+)$/, 'กิจกรรมชมรม: $1'],
  [/^Day pass (.+) · \+Fitness \(bonus\)$/, 'บัตรรายวัน $1 · +ร่างกาย (โบนัส)'], [/^Entry (.+) · swim laps in the pool$/, 'ค่าเข้า $1 · ว่ายน้ำในสระ'], [/^(.+) \/L$/, '$1 /ลิตร'],
);

Object.assign(D, {
  'Kasetsart University · Sriracha Campus': 'มหาวิทยาลัยเกษตรศาสตร์ · วิทยาเขตศรีราชา', 'Kasetsart University · Sriracha': 'มหาวิทยาลัยเกษตรศาสตร์ · ศรีราชา',
  'Start your life as a KU Sriracha student': 'เริ่มชีวิตนิสิต มก.ศรีราชา ของคุณ', 'Use': 'ใช้', 'Ride': 'ขึ้นรถ', 'Jump': 'กระโดด', 'Run': 'วิ่ง',
  'Rotate your phone sideways for the best view': 'หมุนโทรศัพท์เป็นแนวนอนเพื่อเล่นได้สะดวกที่สุด', 'Click to set GPS waypoint': 'แตะ/คลิกเพื่อปักหมุดนำทาง',
  'Connecting to the KU Sriracha server…': 'กำลังเชื่อมต่อเซิร์ฟเวอร์ มก.ศรีราชา…', 'Preparing your student life…': 'กำลังเตรียมชีวิตนิสิตของคุณ…',
});

Object.assign(D, {
  'Loading the KU Sriracha map…': 'กำลังโหลดแผนที่ มก.ศรีราชา…', 'Painting textures…': 'กำลังสร้างพื้นผิว…', 'Drawing building facades…': 'กำลังวาดหน้าตึก…', 'Mixing materials…': 'กำลังเตรียมวัสดุ…',
  'Placing special structures…': 'กำลังวางสิ่งก่อสร้าง…', 'Sculpting terrain…': 'กำลังปั้นภูมิประเทศ…', 'Raising buildings…': 'กำลังสร้างอาคาร…', 'Painting road markings…': 'กำลังทาสีถนน…',
  'Gates, stadium, beach and pier…': 'ประตู สนามกีฬา ชายหาด และท่าเรือ…', 'Filling the sea and ponds…': 'กำลังเติมน้ำทะเลและสระ…', 'Growing trees…': 'กำลังปลูกต้นไม้…', 'Merging geometry…': 'กำลังรวมโมเดล…',
  'Drawing the map…': 'กำลังวาดแผนที่…', 'Opening the gates…': 'กำลังเปิดประตูมหาวิทยาลัย…',
});
Object.assign(D, { 'Horn': 'แตร' });
export function tr(s) {
  if (LANG !== 'th' || s == null) return s; const str = String(s);
  if (D[str]) return D[str];
  for (const [re, rep] of P) if (re.test(str)) return str.replace(re, rep);
  return str;
}
// translate [data-i18n] static nodes (original English kept in data-en)
export function applyStatic(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => { if (!el.dataset.en) el.dataset.en = el.textContent; el.textContent = tr(el.dataset.en); });
  root.querySelectorAll('[data-i18n-ph]').forEach(el => { if (!el.dataset.enPh) el.dataset.enPh = el.placeholder; el.placeholder = tr(el.dataset.enPh); });
}
