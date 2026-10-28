// KU Sriracha Life — game catalog shared by client and server (prices in Thai Baht ฿)

export const FACULTIES = [
  { id: 'eng', name: 'Faculty of Engineering at Sriracha', th: 'คณะวิศวกรรมศาสตร์ ศรีราชา', building: 'B23', color: '#8B1E1E',
    programs: ['Robotics and Automation System Engineering', 'Computer Engineering and Informatics', 'Civil Engineering', 'Mechanical and Design Engineering', 'Electrical and Electronics Engineering', 'Industrial and Systems Engineering', 'Automotive Engineering', 'Digital Manufacturing System Engineering', 'Digital and Smart Electronics Engineering'] },
  { id: 'sci', name: 'Faculty of Science at Sriracha', th: 'คณะวิทยาศาสตร์ ศรีราชา', building: 'B26', color: '#E0A100',
    programs: ['Computer Science', 'Data Analytics and Actuarial Science', 'Applied Chemical Science and Technology', 'Physics', 'Environmental Science and Technology', 'Digital Science and Technology'] },
  { id: 'ms', name: 'Faculty of Management Sciences', th: 'คณะวิทยาการจัดการ', building: 'B22', color: '#1F4E9C',
    programs: ['Management', 'International Business', 'Logistics Management', 'Finance and Investment', 'Hotel Management and Entrepreneurship', 'Tourism Management and Entrepreneurship', 'Accounting', 'Digital Marketing and Branding'] },
  { id: 'econ', name: 'Faculty of Economics at Sriracha', th: 'คณะเศรษฐศาสตร์ ศรีราชา', building: 'B18', color: '#C25B00',
    programs: ['Economics'] },
  { id: 'ims', name: 'Faculty of International Maritime Studies', th: 'คณะพาณิชยนาวีนานาชาติ', building: 'B24', color: '#0B3C6E',
    programs: ['Nautical Science', 'Maritime Transportation', 'Naval Architecture and Ocean Engineering', 'Marine Engineering'] },
];

// Course names per faculty (RASE list from the 2567 curriculum)
export const COURSES = {
  eng: ['03607151 Robotics Exploration', '03607131 Computer Programming for Robotic Applications', '03607231 Microcontroller for Robotics', '03607312 Fundamentals of Robotics', '03607331 Machine Vision and Applications', '03607341 Control Engineering for Robotics', '03607342 Industrial Control and SCADA', '01417167 Engineering Mathematics I', '01420111 General Physics I', '03607451 Autonomous Mobile Robots'],
  sci: ['Programming Fundamentals', 'Data Structures', 'Calculus I', 'General Chemistry', 'Statistics for Data Analytics', 'Environmental Science', 'Database Systems', 'Physics Laboratory'],
  ms: ['Principles of Management', 'Logistics & Supply Chain', 'Financial Accounting', 'Marketing Principles', 'Hotel Operations', 'Business English', 'Logistics Analytics', 'Digital Branding'],
  econ: ['Microeconomics', 'Macroeconomics', 'Econometrics', 'Economics of Development', 'Money and Banking', 'International Economics'],
  ims: ['Navigation I', 'Ship Stability', 'Maritime Law', 'Marine Engines', 'Port Management', 'Meteorology for Mariners'],
};

// Quiz questions used by lectures / TA job (answer index = a)
export const QUIZ = [
  { q: 'Kasetsart University Sriracha campus is in which province?', o: ['Chonburi', 'Rayong', 'Chachoengsao', 'Bangkok'], a: 0, qt: 'มก. วิทยาเขตศรีราชา อยู่จังหวัดอะไร?', ot: ['ชลบุรี', 'ระยอง', 'ฉะเชิงเทรา', 'กรุงเทพฯ'] },
  { q: 'What is the symbolic tree of Kasetsart University?', o: ['Nonsi (นนทรี)', 'Ratchaphruek', 'Rain tree', 'Coconut'], a: 0, qt: 'ต้นไม้สัญลักษณ์ของ มก. คือต้นอะไร?', ot: ['นนทรี', 'ราชพฤกษ์', 'จามจุรี', 'มะพร้าว'] },
  { q: 'Which road runs in front of KU Sriracha?', o: ['Sukhumvit Rd', 'Phahonyothin Rd', 'Rama II Rd', 'Mittraphap Rd'], a: 0, qt: 'ถนนเส้นใดอยู่หน้า มก.ศรีราชา?', ot: ['ถ.สุขุมวิท', 'ถ.พหลโยธิน', 'ถ.พระราม 2', 'ถ.มิตรภาพ'] },
  { q: 'In Ohm\'s law, V equals?', o: ['I × R', 'I / R', 'R / I', 'I + R'], a: 0, qt: 'ตามกฎของโอห์ม V เท่ากับ?' },
  { q: 'Binary 1010 in decimal is?', o: ['10', '12', '8', '5'], a: 0, qt: 'เลขฐานสอง 1010 เท่ากับฐานสิบเท่าไร?' },
  { q: 'Which sensor measures distance using sound?', o: ['Ultrasonic', 'Thermistor', 'LDR', 'Hall effect'], a: 0, qt: 'เซนเซอร์ใดวัดระยะทางด้วยเสียง?', ot: ['อัลตราโซนิก', 'เทอร์มิสเตอร์', 'LDR', 'ฮอลล์เอฟเฟกต์'] },
  { q: 'PLC stands for?', o: ['Programmable Logic Controller', 'Power Line Circuit', 'Primary Logic Core', 'Process Load Counter'], a: 0, qt: 'PLC ย่อมาจาก?' },
  { q: 'Derivative of x² is?', o: ['2x', 'x', 'x³/3', '2'], a: 0, qt: 'อนุพันธ์ของ x² คือ?' },
  { q: 'Big-O of binary search?', o: ['O(log n)', 'O(n)', 'O(n log n)', 'O(1)'], a: 0, qt: 'Big-O ของการค้นหาแบบทวิภาค (binary search)?' },
  { q: 'Which gas is most abundant in Earth\'s air?', o: ['Nitrogen', 'Oxygen', 'CO₂', 'Argon'], a: 0, qt: 'แก๊สใดมีมากที่สุดในอากาศ?', ot: ['ไนโตรเจน', 'ออกซิเจน', 'CO₂', 'อาร์กอน'] },
  { q: 'Supply rises, demand same → price tends to?', o: ['Fall', 'Rise', 'Stay', 'Double'], a: 0, qt: 'อุปทานเพิ่ม อุปสงค์เท่าเดิม → ราคามักจะ?', ot: ['ลดลง', 'เพิ่มขึ้น', 'คงที่', 'เพิ่มสองเท่า'] },
  { q: 'GDP stands for?', o: ['Gross Domestic Product', 'General Debt Percentage', 'Gross Demand Price', 'Global Development Plan'], a: 0, qt: 'GDP ย่อมาจาก?' },
  { q: 'Port side of a ship is the?', o: ['Left', 'Right', 'Front', 'Back'], a: 0, qt: 'กราบซ้าย (Port) ของเรือคือด้านใด?', ot: ['ซ้าย', 'ขวา', 'หน้า', 'หลัง'] },
  { q: 'Laem Chabang, near KU Sriracha, is famous for its?', o: ['Deep-sea port', 'Airport', 'Ski resort', 'Desert'], a: 0, qt: 'แหลมฉบัง ใกล้ มก.ศรีราชา มีชื่อเสียงเรื่องอะไร?', ot: ['ท่าเรือน้ำลึก', 'สนามบิน', 'ลานสกี', 'ทะเลทราย'] },
  { q: 'Accounting equation: Assets = ?', o: ['Liabilities + Equity', 'Revenue − Cost', 'Equity − Liabilities', 'Cash + Profit'], a: 0, qt: 'สมการบัญชี: สินทรัพย์ = ?', ot: ['หนี้สิน + ส่วนของเจ้าของ', 'รายได้ − ต้นทุน', 'ส่วนของเจ้าของ − หนี้สิน', 'เงินสด + กำไร'] },
  { q: 'In logistics, FIFO means?', o: ['First In, First Out', 'Fast In, Fast Out', 'Final Inventory For Order', 'Freight In Freight Out'], a: 0, qt: 'ในโลจิสติกส์ FIFO หมายถึง?', ot: ['เข้าก่อน ออกก่อน', 'เข้าเร็ว ออกเร็ว', 'สินค้าคงคลังสุดท้าย', 'ค่าขนส่งเข้า-ออก'] },
  { q: 'Unit of electrical power?', o: ['Watt', 'Volt', 'Ohm', 'Tesla'], a: 0, qt: 'หน่วยของกำลังไฟฟ้าคือ?', ot: ['วัตต์', 'โวลต์', 'โอห์ม', 'เทสลา'] },
  { q: 'A PID controller "I" term stands for?', o: ['Integral', 'Inertia', 'Input', 'Index'], a: 0, qt: 'ตัว "I" ในตัวควบคุม PID คือ?', ot: ['อินทิกรัล (Integral)', 'ความเฉื่อย', 'อินพุต', 'ดัชนี'] },
  { q: 'Which language runs natively in web browsers?', o: ['JavaScript', 'C#', 'LabVIEW', 'Fortran'], a: 0, qt: 'ภาษาใดทำงานในเว็บเบราว์เซอร์ได้โดยตรง?' },
  { q: 'Speed of light is about?', o: ['300,000 km/s', '30,000 km/s', '3,000 km/s', '300 km/s'], a: 0, qt: 'ความเร็วแสงประมาณเท่าไร?', ot: ['300,000 กม./วินาที', '30,000 กม./วินาที', '3,000 กม./วินาที', '300 กม./วินาที'] },
  { q: 'Water boils at sea level at?', o: ['100 °C', '90 °C', '80 °C', '120 °C'], a: 0, qt: 'น้ำเดือดที่ระดับน้ำทะเลที่อุณหภูมิ?' },
  { q: 'A knot is a unit of?', o: ['Speed', 'Distance', 'Depth', 'Weight'], a: 0, qt: 'นอต (knot) เป็นหน่วยของอะไร?', ot: ['ความเร็ว', 'ระยะทาง', 'ความลึก', 'น้ำหนัก'] },
  { q: 'Which is a renewable energy source?', o: ['Solar', 'Coal', 'Natural gas', 'Diesel'], a: 0, qt: 'ข้อใดเป็นพลังงานหมุนเวียน?', ot: ['แสงอาทิตย์', 'ถ่านหิน', 'ก๊าซธรรมชาติ', 'ดีเซล'] },
  { q: 'KU was founded in which year (B.E. 2486)?', o: ['1943', '1955', '1917', '1968'], a: 0, qt: 'มก. ก่อตั้งปีใด (พ.ศ. 2486)?' },
];

// ---------------- Food & items ----------------
// e: effects { hunger, energy, health, mood }  (0–100 stats)
export const ITEMS = {
  water: { name: 'Drinking Water', th: 'น้ำเปล่า', price: 7, e: { hunger: 2, energy: 2, health: 1 }, icon: '💧' },
  thaitea: { name: 'Thai Milk Tea', th: 'ชาไทย', price: 25, e: { hunger: 6, energy: 10, mood: 6 }, icon: '🧋' },
  energydrink: { name: 'Energy Drink', th: 'เครื่องดื่มชูกำลัง', price: 12, e: { energy: 25, health: -2 }, icon: '⚡' },
  sandwich: { name: 'Toasted Sandwich', th: 'แซนด์วิชอบ', price: 30, e: { hunger: 22, energy: 4 }, icon: '🥪' },
  onigiri: { name: 'Rice Ball', th: 'ข้าวปั้น', price: 20, e: { hunger: 16 }, icon: '🍙' },
  noodlecup: { name: 'Instant Noodles', th: 'มาม่า', price: 15, e: { hunger: 20, health: -1, mood: 3 }, icon: '🍜' },
  icecream: { name: 'Ice Cream', th: 'ไอศกรีม', price: 20, e: { hunger: 5, mood: 10 }, icon: '🍦' },
  krapao: { name: 'Stir-fried Basil Chicken + Egg', th: 'กะเพราไก่ไข่ดาว', price: 50, e: { hunger: 45, energy: 10, mood: 6 }, icon: '🍛' },
  khaomankai: { name: 'Hainanese Chicken Rice', th: 'ข้าวมันไก่', price: 45, e: { hunger: 42, energy: 8, mood: 4 }, icon: '🍗' },
  kuayteow: { name: 'Noodle Soup', th: 'ก๋วยเตี๋ยว', price: 45, e: { hunger: 38, energy: 8, mood: 5 }, icon: '🍲' },
  somtam: { name: 'Papaya Salad + Sticky Rice', th: 'ส้มตำ + ข้าวเหนียว', price: 50, e: { hunger: 36, health: 3, mood: 7 }, icon: '🥗' },
  khaopad: { name: 'Fried Rice', th: 'ข้าวผัด', price: 45, e: { hunger: 42, energy: 6 }, icon: '🍚' },
  fruit: { name: 'Fresh Fruit Cup', th: 'ผลไม้สด', price: 25, e: { hunger: 12, health: 5, mood: 3 }, icon: '🍉' },
  americano: { name: 'Iced Americano', th: 'อเมริกาโน่เย็น', price: 50, e: { energy: 28, mood: 5 }, icon: '☕' },
  latte: { name: 'Iced Latte', th: 'ลาเต้เย็น', price: 55, e: { energy: 22, hunger: 6, mood: 8 }, icon: '🥤' },
  cake: { name: 'Coconut Cake', th: 'เค้กมะพร้าว', price: 65, e: { hunger: 18, mood: 12 }, icon: '🍰' },
  moopings: { name: 'Grilled Pork Skewers ×3', th: 'หมูปิ้ง 3 ไม้', price: 30, e: { hunger: 24, mood: 5 }, icon: '🍢' },
  kaitod: { name: 'Fried Chicken', th: 'ไก่ทอด', price: 40, e: { hunger: 28, mood: 6, health: -1 }, icon: '🍗' },
  bubbletea: { name: 'Bubble Milk Tea', th: 'ชานมไข่มุก', price: 35, e: { hunger: 8, energy: 8, mood: 9 }, icon: '🧋' },
  mangosticky: { name: 'Mango Sticky Rice', th: 'ข้าวเหนียวมะม่วง', price: 60, e: { hunger: 26, mood: 12 }, icon: '🥭' },
  boatnoodle: { name: 'Boat Noodles', th: 'ก๋วยเตี๋ยวเรือ', price: 20, e: { hunger: 18, mood: 5 }, icon: '🍜' },
  mookata: { name: 'Moo Kata Buffet', th: 'หมูกระทะบุฟเฟ่ต์', price: 199, e: { hunger: 100, energy: 15, mood: 25 }, icon: '🔥' },
  grilledprawn: { name: 'Grilled River Prawns', th: 'กุ้งเผา', price: 250, e: { hunger: 60, mood: 22, health: 4 }, icon: '🦐' },
  steamedcrab: { name: 'Steamed Crab', th: 'ปูนึ่ง', price: 320, e: { hunger: 65, mood: 26, health: 4 }, icon: '🦀' },
  oysters: { name: 'Sriracha Oysters', th: 'หอยนางรมศรีราชา', price: 180, e: { hunger: 35, mood: 18 }, icon: '🦪' },
  medkit: { name: 'First-aid Kit', th: 'ชุดปฐมพยาบาล', price: 120, e: { health: 40 }, icon: '🩹' },
  checkup: { name: 'Doctor Check-up', th: 'ตรวจสุขภาพ', price: 300, e: { health: 100, mood: 4 }, icon: '🩺' },
  vitamin: { name: 'Vitamin C', th: 'วิตามินซี', price: 90, e: { health: 15, energy: 5 }, icon: '💊' },
  topup: { name: 'Phone Top-up 100฿', th: 'เติมเงินมือถือ', price: 100, e: { mood: 2 }, icon: '📶' },
  textbook: { name: 'Textbook', th: 'ตำราเรียน', price: 350, e: { mood: 1 }, icon: '📘', skill: { int: 2 } },
  calculator: { name: 'Scientific Calculator', th: 'เครื่องคิดเลข', price: 590, e: {}, icon: '🧮', skill: { int: 3 } },
  fuel: { name: 'Fuel Refill', th: 'เติมน้ำมัน', price: 0, e: {}, icon: '⛽' },
  gymday: { name: 'Gym Day Pass', th: 'บัตรฟิตเนสรายวัน', price: 80, e: {}, icon: '🏋️' },
  poolpass: { name: 'Pool Entry', th: 'ค่าเข้าสระว่ายน้ำ', price: 30, e: {}, icon: '🏊' },
  // ---- restaurants around campus (generic names) ----
  shabu_set: { name: 'Pork Shabu Set', th: 'ชาบูชุดหมู', price: 299, e: { hunger: 70, mood: 18, energy: 8 }, icon: '🍲', cat: 'food' },
  shabu_premium: { name: 'Premium Beef Shabu', th: 'ชาบูเนื้อพรีเมียม', price: 599, e: { hunger: 85, mood: 25, energy: 10 }, icon: '🥩', cat: 'food' },
  chicken_bucket: { name: 'Fried Chicken Bucket (8 pcs)', th: 'ไก่ทอดถัง 8 ชิ้น', price: 359, e: { hunger: 80, mood: 16, health: -3 }, icon: '🍗', cat: 'food' },
  chicken_burger: { name: 'Crispy Chicken Burger', th: 'เบอร์เกอร์ไก่กรอบ', price: 129, e: { hunger: 35, mood: 8 }, icon: '🍔', cat: 'food' },
  chicken_wings: { name: 'Spicy Wings ×6', th: 'ปีกไก่ทอดซอสเผ็ด 6 ชิ้น', price: 99, e: { hunger: 24, mood: 8 }, icon: '🍗', cat: 'food' },
  fries: { name: 'French Fries', th: 'เฟรนช์ฟรายส์', price: 59, e: { hunger: 15, mood: 6, health: -1 }, icon: '🍟', cat: 'food' },
  ramen_tonkotsu: { name: 'Tonkotsu Ramen', th: 'ราเมนทงคตสึ', price: 239, e: { hunger: 55, mood: 14, energy: 6 }, icon: '🍜', cat: 'food' },
  gyoza: { name: 'Gyoza ×6', th: 'เกี๊ยวซ่า 6 ชิ้น', price: 89, e: { hunger: 20, mood: 6 }, icon: '🥟', cat: 'food' },
  katsu_don: { name: 'Katsu Don', th: 'ข้าวหน้าหมูทอดทงคัตสึ', price: 189, e: { hunger: 55, mood: 10, energy: 6 }, icon: '🍱', cat: 'food' },
  steak_ribeye: { name: 'Ribeye Steak', th: 'สเต๊กริบอาย', price: 890, e: { hunger: 75, mood: 28, energy: 12 }, icon: '🥩', cat: 'food' },
  wagyu_a5: { name: 'Wagyu A5 Set', th: 'เซ็ตวากิว A5', price: 3900, e: { hunger: 80, mood: 45, health: 5 }, icon: '🥩', cat: 'lux' },
  lobster: { name: 'Grilled Lobster', th: 'ล็อบสเตอร์ย่างเนย', price: 2400, e: { hunger: 70, mood: 38, health: 5 }, icon: '🦞', cat: 'lux' },
  truffle_pasta: { name: 'Truffle Pasta', th: 'พาสต้าเห็ดทรัฟเฟิล', price: 690, e: { hunger: 55, mood: 22 }, icon: '🍝', cat: 'food' },
  omakase: { name: 'Omakase (12 courses)', th: 'โอมากาเสะ 12 คอร์ส', price: 4500, e: { hunger: 85, mood: 50, health: 6 }, icon: '🍣', cat: 'lux' },
  afternoon_tea: { name: 'Afternoon Tea Set', th: 'ชุดน้ำชายามบ่าย', price: 1200, e: { hunger: 30, mood: 30, energy: 10 }, icon: '🫖', cat: 'lux' },
  mocktail_mojito: { name: 'Virgin Mojito', th: 'ม็อกเทลโมฮิโต้', price: 160, e: { mood: 12, energy: 4 }, icon: '🍹', cat: 'drink' },
  italian_soda: { name: 'Italian Soda', th: 'อิตาเลียนโซดา', price: 90, e: { mood: 8, energy: 3 }, icon: '🥤', cat: 'drink' },
  craft_cola: { name: 'Craft Cola', th: 'โคล่าคราฟต์', price: 120, e: { mood: 9, energy: 6 }, icon: '🥤', cat: 'drink' },
  coconut_cooler: { name: 'Coconut Smoothie', th: 'มะพร้าวปั่น', price: 110, e: { hunger: 8, mood: 10, health: 2 }, icon: '🥥', cat: 'drink' },
  bar_nachos: { name: 'Loaded Nachos', th: 'นาโชส์ชีส', price: 180, e: { hunger: 25, mood: 10 }, icon: '🧀', cat: 'food' },
  matcha_premium: { name: 'Ceremonial Matcha Latte', th: 'มัทฉะลาเต้พรีเมียม', price: 165, e: { energy: 18, mood: 10 }, icon: '🍵', cat: 'drink' },
  croissant: { name: 'Butter Croissant', th: 'ครัวซองต์เนยสด', price: 95, e: { hunger: 18, mood: 8 }, icon: '🥐', cat: 'food' },
  popcorn: { name: 'Cinema Popcorn', th: 'ป๊อปคอร์น', price: 120, e: { hunger: 10, mood: 8 }, icon: '🍿', cat: 'food' },
  // ---- gadgets (kept, not consumed; equip from the bag) — fictional brands ----
  phone_lumen17: { name: 'Lumen 17 Pro', th: 'ลูเมน 17 โปร', brand: 'Lumen', price: 46900, e: {}, icon: '📱', gadget: 'phone', tier: 3, cat: 'gadget' },
  phone_nova26: { name: 'Nova S26 Ultra', th: 'โนวา S26 อัลตร้า', brand: 'Nova', price: 41900, e: {}, icon: '📱', gadget: 'phone', tier: 3, cat: 'gadget' },
  phone_orbitfold: { name: 'Orbit Fold 6', th: 'ออร์บิท โฟลด์ 6', brand: 'Orbit', price: 59900, e: {}, icon: '📱', gadget: 'phone', tier: 3, cat: 'gadget' },
  phone_kite12: { name: 'Kite 12', th: 'ไคต์ 12', brand: 'Kite', price: 12990, e: {}, icon: '📱', gadget: 'phone', tier: 2, cat: 'gadget' },
  phone_tara: { name: 'Tara A56', th: 'ทารา A56', brand: 'Tara', price: 8990, e: {}, icon: '📱', gadget: 'phone', tier: 1, cat: 'gadget' },
  laptop_lumenair: { name: 'Lumen Book Air 13', th: 'ลูเมน บุ๊ก แอร์ 13', brand: 'Lumen', price: 39900, e: {}, icon: '💻', gadget: 'laptop', study: 1.3, cat: 'gadget' },
  laptop_zenix: { name: 'Zenix Pro 14', th: 'ซีนิกซ์ โปร 14', brand: 'Zenix', price: 32900, e: {}, icon: '💻', gadget: 'laptop', study: 1.25, cat: 'gadget' },
  laptop_raptor: { name: 'Raptor G16 Gaming', th: 'แร็พเตอร์ G16 เกมมิ่ง', brand: 'Raptor', price: 54900, e: {}, icon: '💻', gadget: 'laptop', study: 1.2, cat: 'gadget' },
  laptop_nimbus: { name: 'Nimbus 14', th: 'นิมบัส 14', brand: 'Nimbus', price: 18900, e: {}, icon: '💻', gadget: 'laptop', study: 1.15, cat: 'gadget' },
  watch_pulse: { name: 'Pulse Watch 9', th: 'พัลส์ วอทช์ 9', brand: 'Pulse', price: 13900, e: {}, icon: '⌚', gadget: 'watch', cat: 'gadget' },
  earbuds_aero: { name: 'Aero Buds Pro', th: 'แอโร่ บัดส์ โปร', brand: 'Aero', price: 7990, e: {}, icon: '🎧', gadget: 'earbuds', cat: 'gadget' },
  camera_shutter: { name: 'Shutter Z30 Camera', th: 'กล้อง ชัตเตอร์ Z30', brand: 'Shutter', price: 24900, e: {}, icon: '📷', gadget: 'camera', cat: 'gadget' },
  // ---- beauty (consumable: mood + charisma) ----
  serum_sakura: { name: 'Sakura Glow Serum', th: 'เซรั่มซากุระโกลว์', brand: 'Sakura Lab', price: 890, e: { mood: 10 }, skill: { cha: 1 }, icon: '🧴', cat: 'beauty' },
  sunscreen_mira: { name: 'Mira UV Sunscreen SPF50+', th: 'กันแดดมิร่า SPF50+', brand: 'Mira', price: 390, e: { mood: 4, health: 2 }, skill: { cha: 0.4 }, icon: '🧴', cat: 'beauty' },
  liptint_velvet: { name: 'Velvet Lip Tint', th: 'ลิปทินท์เวลเวท', brand: 'Velvet', price: 290, e: { mood: 6 }, skill: { cha: 0.6 }, icon: '💄', cat: 'beauty' },
  cushion_bloom: { name: 'Bloom Cushion Foundation', th: 'คุชชั่นบลูม', brand: 'Bloom', price: 1290, e: { mood: 10 }, skill: { cha: 1.2 }, icon: '🪞', cat: 'beauty' },
  perfume_noir: { name: 'Noir Eau de Parfum', th: 'น้ำหอมนัวร์', brand: 'Maison Noir', price: 3900, e: { mood: 15 }, skill: { cha: 2 }, icon: '🌸', cat: 'beauty' },
  cleanser_aqua: { name: 'Aqua Gentle Cleanser', th: 'โฟมล้างหน้าอควา', brand: 'Aqua', price: 250, e: { mood: 4, health: 1 }, skill: { cha: 0.3 }, icon: '🫧', cat: 'beauty' },
  hair_wax: { name: 'Mono Matte Hair Wax', th: 'แว็กซ์จัดแต่งทรงผมโมโน', brand: 'Mono', price: 220, e: { mood: 5 }, skill: { cha: 0.5 }, icon: '💈', cat: 'beauty' },
  mask_pack: { name: 'Hydra Sheet Masks ×5', th: 'มาสก์หน้าไฮดรา 5 แผ่น', brand: 'Hydra', price: 199, e: { mood: 8, energy: 4 }, skill: { cha: 0.4 }, icon: '😷', cat: 'beauty' },
  // ---- home decor (kept; each different piece makes your room nicer: +mood when you sleep at home) ----
  deco_plant: { name: 'Monstera Plant', th: 'ต้นมอนสเตอร่า', price: 590, e: {}, icon: '🪴', deco: 1, cat: 'deco' },
  deco_lamp: { name: 'Warm LED Lamp', th: 'โคมไฟ LED แสงวอร์ม', price: 890, e: {}, icon: '💡', deco: 1, cat: 'deco' },
  deco_poster: { name: 'Sunset Poster', th: 'โปสเตอร์พระอาทิตย์ตก', price: 250, e: {}, icon: '🖼️', deco: 1, cat: 'deco' },
  deco_rug: { name: 'Soft Rug', th: 'พรมขนนุ่ม', price: 1490, e: {}, icon: '🧶', deco: 1, cat: 'deco' },
  deco_speaker: { name: 'Bluetooth Speaker', th: 'ลำโพงบลูทูธ', price: 1990, e: {}, icon: '🔊', deco: 2, cat: 'deco' },
  deco_chair: { name: 'Gaming Chair', th: 'เก้าอี้เกมมิ่ง', price: 4990, e: {}, icon: '🪑', deco: 2, cat: 'deco' },
  deco_tv: { name: '43" Smart TV', th: 'สมาร์ททีวี 43 นิ้ว', price: 9990, e: {}, icon: '📺', deco: 3, cat: 'deco' },
  deco_lights: { name: 'Fairy Lights', th: 'ไฟประดับ', price: 190, e: {}, icon: '✨', deco: 1, cat: 'deco' },
  // ---- snacks for the online shop ----
  snack_seaweed: { name: 'Crispy Seaweed', th: 'สาหร่ายทอดกรอบ', price: 35, e: { hunger: 6, mood: 5 }, icon: '🟩', cat: 'snack' },
  snack_chips: { name: 'Potato Chips', th: 'มันฝรั่งทอด', price: 30, e: { hunger: 8, mood: 5 }, icon: '🥔', cat: 'snack' },
  drink_greentea: { name: 'Bottled Green Tea', th: 'ชาเขียวขวด', price: 20, e: { hunger: 2, energy: 6, mood: 3 }, icon: '🍵', cat: 'snack' },
  protein_bar: { name: 'Protein Bar', th: 'โปรตีนบาร์', price: 59, e: { hunger: 14, energy: 8, health: 1 }, icon: '🍫', cat: 'snack' },
  coffee_beans: { name: 'Coffee Beans 250 g', th: 'เมล็ดกาแฟ 250 กรัม', price: 320, e: { energy: 20, mood: 6 }, icon: '☕', cat: 'snack' },
  // ---- fishing catch (eat grilled, or sell at the market) ----
  fish_tilapia: { name: 'Tilapia', th: 'ปลานิล', price: 0, sell: 45, e: { hunger: 22, health: 2 }, icon: '🐟', cat: 'fish' },
  fish_snapper: { name: 'Red Snapper', th: 'ปลากะพงแดง', price: 0, sell: 120, e: { hunger: 30, mood: 6, health: 3 }, icon: '🐠', cat: 'fish' },
  fish_mackerel: { name: 'Mackerel', th: 'ปลาทู', price: 0, sell: 35, e: { hunger: 18, health: 2 }, icon: '🐟', cat: 'fish' },
  fish_squid: { name: 'Squid', th: 'ปลาหมึก', price: 0, sell: 80, e: { hunger: 20, mood: 4 }, icon: '🦑', cat: 'fish' },
  fish_crab: { name: 'Blue Crab', th: 'ปูม้า', price: 0, sell: 150, e: { hunger: 24, mood: 8 }, icon: '🦀', cat: 'fish' },
  boot_old: { name: 'Old Boot', th: 'รองเท้าบูทเก่า', price: 0, sell: 1, e: { mood: -1 }, icon: '🥾', cat: 'fish' },
};

// Shops: kind -> list of ids (food/items), plus clothing/vehicle shops
export const SHOPS = {
  mart: { name: 'Convenience Store', items: ['water', 'thaitea', 'energydrink', 'sandwich', 'onigiri', 'noodlecup', 'icecream', 'medkit', 'vitamin', 'topup'] },
  cafeteria: { name: 'Central Cafeteria โรงอาหารกลาง', items: ['krapao', 'khaomankai', 'kuayteow', 'somtam', 'khaopad', 'fruit', 'thaitea', 'water'] },
  cafe: { name: 'Café', items: ['americano', 'latte', 'cake', 'thaitea', 'water'] },
  foodstreet: { name: 'KU Food Street', items: ['moopings', 'kaitod', 'bubbletea', 'mangosticky', 'fruit', 'water'] },
  market: { name: 'Thung Sukhla Market ตลาดทุ่งสุขลา', items: ['moopings', 'kaitod', 'somtam', 'mangosticky', 'fruit', 'bubbletea'] },
  noodle: { name: 'Boat Noodles ก๋วยเตี๋ยวเรือ', items: ['boatnoodle', 'thaitea', 'water'] },
  mookata: { name: 'Moo Kata หมูกระทะ', items: ['mookata', 'thaitea', 'water'] },
  seafood: { name: 'Krua Ao Udom Seafood', items: ['grilledprawn', 'steamedcrab', 'oysters', 'water'] },
  clinic: { name: 'Sriracha Clinic', items: ['checkup', 'medkit', 'vitamin'] },
  coopbooks: { name: 'KU Co-op (books)', items: ['textbook', 'calculator', 'water', 'thaitea'] },
  shabu: { name: 'Shabu Buffet', th: 'ชาบูบุฟเฟต์', items: ['shabu_set', 'shabu_premium', 'italian_soda', 'water'] },
  friedchicken: { name: 'Fried Chicken', th: 'ร้านไก่ทอด', items: ['chicken_bucket', 'chicken_burger', 'chicken_wings', 'fries', 'craft_cola'] },
  ramen: { name: 'Ramen Bar', th: 'ร้านราเมน', items: ['ramen_tonkotsu', 'katsu_don', 'gyoza', 'drink_greentea'] },
  steak: { name: 'Steakhouse', th: 'สเต๊กเฮาส์', items: ['steak_ribeye', 'wagyu_a5', 'truffle_pasta', 'lobster', 'mocktail_mojito'] },
  finedining: { name: 'Sea-view Fine Dining', th: 'ร้านอาหารหรูริมทะเล', items: ['omakase', 'lobster', 'wagyu_a5', 'afternoon_tea', 'mocktail_mojito'] },
  bar: { name: 'Live Music Bar', th: 'บาร์ดนตรีสด', items: ['mocktail_mojito', 'italian_soda', 'craft_cola', 'coconut_cooler', 'bar_nachos'] },
  luxcafe: { name: 'Specialty Café', th: 'คาเฟ่พรีเมียม', items: ['matcha_premium', 'croissant', 'latte', 'cake', 'afternoon_tea'] },
  gadget: { name: 'Gadget Store', th: 'ร้านไอที', items: ['phone_tara', 'phone_kite12', 'phone_nova26', 'phone_lumen17', 'phone_orbitfold', 'laptop_nimbus', 'laptop_zenix', 'laptop_lumenair', 'laptop_raptor', 'watch_pulse', 'earbuds_aero', 'camera_shutter'] },
  beauty: { name: 'Beauty Store', th: 'ร้านเครื่องสำอาง', items: ['cleanser_aqua', 'sunscreen_mira', 'liptint_velvet', 'mask_pack', 'hair_wax', 'serum_sakura', 'cushion_bloom', 'perfume_noir'] },
  homedeco: { name: 'Home Decor', th: 'ร้านของแต่งบ้าน', items: ['deco_lights', 'deco_poster', 'deco_plant', 'deco_lamp', 'deco_rug', 'deco_speaker', 'deco_chair', 'deco_tv'] },
  cinema: { name: 'Cinema Snacks', th: 'โรงหนัง · ขนม', items: ['popcorn', 'craft_cola', 'italian_soda'] },
};
// KU Shop (online): everything here can be ordered from the phone and arrives as a parcel
export const ONLINE_SHOP = { gadget: SHOPS.gadget.items, beauty: SHOPS.beauty.items, deco: SHOPS.homedeco.items, snack: ['snack_seaweed', 'snack_chips', 'drink_greentea', 'protein_bar', 'coffee_beans', 'noodlecup', 'energydrink'] };

// ---------------- Clothing ----------------
// slot: top | bottom | shoes | hat | glasses | bag | hair
// style keys interpreted by the avatar builder
export const CLOTHES = {
  // NPC work clothes (not sold): motorbike-taxi vest, security shirt, vendor apron-tee, sports jerseys
  vest_win: { name: 'Motorbike-taxi Vest', slot: 'top', style: 'jacket', color: '#ef6a1a', price: 0, shop: null, npc: true },
  guard_shirt: { name: 'Security Shirt', slot: 'top', style: 'shirt', color: '#34465c', price: 0, shop: null, npc: true },
  vendor_tee: { name: 'Vendor Tee', slot: 'top', style: 'tee', color: '#c9b79a', price: 0, shop: null, npc: true },
  jersey_blue: { name: 'Football Jersey (blue)', slot: 'top', style: 'tee', color: '#1f5fbf', price: 0, shop: null, npc: true },
  jersey_red: { name: 'Football Jersey (red)', slot: 'top', style: 'tee', color: '#c4262e', price: 0, shop: null, npc: true },
  // tops
  uniform_m: { name: 'KU Student Shirt (white)', th: 'เสื้อนิสิต', slot: 'top', style: 'shirt', color: '#f4f4f0', price: 250, shop: 'coop' },
  uniform_f: { name: 'KU Student Blouse (white)', th: 'เสื้อนิสิตหญิง', slot: 'top', style: 'blouse', color: '#f6f6f2', price: 250, shop: 'coop' },
  ku_tee: { name: 'KU Green Tee', th: 'เสื้อยืด KU', slot: 'top', style: 'tee', color: '#0b6b4f', price: 290, shop: 'coop', print: 'KU' },
  ku_hoodie: { name: 'KU Sriracha Hoodie', th: 'ฮู้ด KU ศรีราชา', slot: 'top', style: 'hoodie', color: '#0f5b45', price: 690, shop: 'coop', print: 'KU' },
  eng_shop: { name: 'Engineering Shop Shirt', th: 'เสื้อช็อปวิศวะ', slot: 'top', style: 'jacket', color: '#7a1414', price: 450, shop: 'coop', print: 'ENG' },
  tee_white: { name: 'White Tee', slot: 'top', style: 'tee', color: '#ececec', price: 159, shop: 'fashion' },
  tee_black: { name: 'Black Tee', slot: 'top', style: 'tee', color: '#1d1d22', price: 159, shop: 'fashion' },
  tee_red: { name: 'Red Tee', slot: 'top', style: 'tee', color: '#b8262f', price: 179, shop: 'fashion' },
  tee_yellow: { name: 'Sunny Yellow Tee', slot: 'top', style: 'tee', color: '#f2c230', price: 179, shop: 'fashion' },
  polo_navy: { name: 'Navy Polo', slot: 'top', style: 'shirt', color: '#1e2c4f', price: 390, shop: 'fashion' },
  hawaii: { name: 'Beach Shirt', slot: 'top', style: 'shirt', color: '#1aa6b7', price: 450, shop: 'fashion', print: 'FLOWER' },
  hoodie_grey: { name: 'Grey Hoodie', slot: 'top', style: 'hoodie', color: '#8a8f98', price: 590, shop: 'fashion' },
  denim_jacket: { name: 'Denim Jacket', slot: 'top', style: 'jacket', color: '#3d5a86', price: 990, shop: 'fashion' },
  leather_jacket: { name: 'Biker Leather Jacket', slot: 'top', style: 'jacket', color: '#1b1b1b', price: 2490, shop: 'fashion', level: 8 },
  dress_pink: { name: 'Pink Sundress', slot: 'top', style: 'dress', color: '#e98fb0', price: 790, shop: 'fashion' },
  dress_navy: { name: 'Navy Dress', slot: 'top', style: 'dress', color: '#26355e', price: 890, shop: 'fashion' },
  suit: { name: 'Formal Suit Jacket', slot: 'top', style: 'jacket', color: '#2a2e36', price: 3500, shop: 'fashion', level: 10 },
  // bottoms
  slacks_black: { name: 'Black Slacks (uniform)', th: 'กางเกงดำ', slot: 'bottom', style: 'pants', color: '#16171b', price: 350, shop: 'coop' },
  skirt_black: { name: 'Black Pleated Skirt (uniform)', th: 'กระโปรงนิสิต', slot: 'bottom', style: 'skirt', color: '#17181c', price: 320, shop: 'coop' },
  jeans: { name: 'Blue Jeans', slot: 'bottom', style: 'pants', color: '#2f4d7a', price: 690, shop: 'fashion' },
  jeans_black: { name: 'Black Jeans', slot: 'bottom', style: 'pants', color: '#222429', price: 690, shop: 'fashion' },
  chinos: { name: 'Beige Chinos', slot: 'bottom', style: 'pants', color: '#b9a37e', price: 590, shop: 'fashion' },
  shorts: { name: 'Khaki Shorts', slot: 'bottom', style: 'shorts', color: '#a68d62', price: 290, shop: 'fashion' },
  shorts_sport: { name: 'Sport Shorts', slot: 'bottom', style: 'shorts', color: '#1d3f8f', price: 250, shop: 'fashion' },
  skirt_denim: { name: 'Denim Skirt', slot: 'bottom', style: 'skirt', color: '#4a6a9a', price: 490, shop: 'fashion' },
  joggers: { name: 'Grey Joggers', slot: 'bottom', style: 'pants', color: '#6c7079', price: 450, shop: 'fashion' },
  // shoes
  shoes_black: { name: 'Black Leather Shoes', th: 'รองเท้าหนังดำ', slot: 'shoes', style: 'shoe', color: '#111111', price: 590, shop: 'coop' },
  sneakers_white: { name: 'White Sneakers', slot: 'shoes', style: 'sneaker', color: '#f2f2f2', price: 1290, shop: 'fashion' },
  sneakers_red: { name: 'Red Runners', slot: 'shoes', style: 'sneaker', color: '#d23b33', price: 1590, shop: 'fashion' },
  sandals: { name: 'Flip-flops', th: 'รองเท้าแตะ', slot: 'shoes', style: 'sandal', color: '#2f6fd0', price: 99, shop: 'fashion' },
  boots: { name: 'Work Boots', slot: 'shoes', style: 'boot', color: '#5a3b22', price: 1890, shop: 'fashion' },
  // hats
  cap_ku: { name: 'KU Green Cap', slot: 'hat', style: 'cap', color: '#0b6b4f', price: 250, shop: 'coop' },
  cap_black: { name: 'Black Cap', slot: 'hat', style: 'cap', color: '#191919', price: 250, shop: 'fashion' },
  bucket: { name: 'Bucket Hat', slot: 'hat', style: 'bucket', color: '#d9c9a3', price: 350, shop: 'fashion' },
  beanie: { name: 'Beanie', slot: 'hat', style: 'beanie', color: '#7a2a3a', price: 290, shop: 'fashion' },
  helmet: { name: 'Motorbike Helmet', th: 'หมวกกันน็อก', slot: 'hat', style: 'helmet', color: '#e8e8e8', price: 890, shop: 'moto' },
  // glasses
  glasses: { name: 'Round Glasses', slot: 'glasses', style: 'glasses', color: '#222222', price: 490, shop: 'fashion' },
  sunglasses: { name: 'Sunglasses', slot: 'glasses', style: 'sunglasses', color: '#111111', price: 350, shop: 'fashion' },
  // bags
  backpack: { name: 'Backpack', slot: 'bag', style: 'backpack', color: '#2b3a55', price: 690, shop: 'coop' },
  backpack_ku: { name: 'KU Green Backpack', slot: 'bag', style: 'backpack', color: '#0b6b4f', price: 890, shop: 'coop' },
  tote: { name: 'Canvas Tote', slot: 'bag', style: 'tote', color: '#e7dcc4', price: 190, shop: 'fashion' },
  // brand collection (mall + KU Shop) — fictional labels
  nova_tee: { name: 'NOVA Logo Tee', th: 'เสื้อยืด NOVA', brand: 'NOVA', slot: 'top', style: 'tee', color: '#f0efe9', price: 890, shop: 'mall' },
  nova_hoodie: { name: 'NOVA Oversized Hoodie', th: 'ฮู้ด NOVA โอเวอร์ไซซ์', brand: 'NOVA', slot: 'top', style: 'hoodie', color: '#222327', price: 2490, shop: 'mall' },
  siam_shirt: { name: 'Siam Street Linen Shirt', th: 'เชิ้ตลินิน Siam Street', brand: 'Siam Street', slot: 'top', style: 'shirt', color: '#d9cdb4', price: 1590, shop: 'mall' },
  tide_polo: { name: 'Urban Tide Polo', th: 'โปโล Urban Tide', brand: 'Urban Tide', slot: 'top', style: 'shirt', color: '#14506e', price: 1290, shop: 'mall' },
  surf_tee: { name: 'Bangsaen Surf Tee', th: 'เสื้อยืด Bangsaen Surf', brand: 'Bangsaen Surf', slot: 'top', style: 'tee', color: '#2aa7b8', price: 690, shop: 'mall' },
  lanna_jacket: { name: 'Lanna Craft Jacket', th: 'แจ็กเก็ต Lanna Craft', brand: 'Lanna Craft', slot: 'top', style: 'jacket', color: '#6b3b2a', price: 3290, shop: 'mall', level: 5 },
  riva_dress: { name: 'Riva Satin Dress', th: 'เดรสซาติน Riva', brand: 'Riva', slot: 'top', style: 'dress', color: '#b2264b', price: 2890, shop: 'mall' },
  riva_blouse: { name: 'Riva Silk Blouse', th: 'เบลาส์ไหม Riva', brand: 'Riva', slot: 'top', style: 'blouse', color: '#efe1d1', price: 1990, shop: 'mall' },
  mono_blazer: { name: 'Mono Tailored Blazer', th: 'เบลเซอร์ Mono', brand: 'Mono', slot: 'top', style: 'jacket', color: '#3b3d42', price: 4590, shop: 'mall', level: 8 },
  club_varsity: { name: 'Kaset Club Varsity Jacket', th: 'แจ็กเก็ตวาร์ซิตี้ Kaset Club', brand: 'Kaset Club', slot: 'top', style: 'jacket', color: '#0e5a43', price: 2690, shop: 'mall' },
  nova_cargo: { name: 'NOVA Cargo Pants', th: 'กางเกงคาร์โก้ NOVA', brand: 'NOVA', slot: 'bottom', style: 'pants', color: '#59604a', price: 1690, shop: 'mall' },
  tide_shorts: { name: 'Urban Tide Board Shorts', th: 'กางเกงขาสั้น Urban Tide', brand: 'Urban Tide', slot: 'bottom', style: 'shorts', color: '#e07a2f', price: 990, shop: 'mall' },
  riva_skirt: { name: 'Riva Pleated Midi Skirt', th: 'กระโปรงพลีท Riva', brand: 'Riva', slot: 'bottom', style: 'skirt', color: '#c9b8a3', price: 1490, shop: 'mall' },
  mono_slacks: { name: 'Mono Wide Slacks', th: 'กางเกงสแล็คขากว้าง Mono', brand: 'Mono', slot: 'bottom', style: 'pants', color: '#2b2d31', price: 1890, shop: 'mall' },
  stride_runner: { name: 'Stride Air Runner', th: 'รองเท้าวิ่ง Stride Air', brand: 'Stride', slot: 'shoes', style: 'sneaker', color: '#e9eef2', price: 3990, shop: 'mall' },
  stride_court: { name: 'Stride Court Classic', th: 'รองเท้า Stride Court', brand: 'Stride', slot: 'shoes', style: 'sneaker', color: '#1c1d22', price: 3290, shop: 'mall' },
  mono_loafer: { name: 'Mono Leather Loafers', th: 'โลฟเฟอร์หนัง Mono', brand: 'Mono', slot: 'shoes', style: 'shoe', color: '#4a2c1d', price: 2990, shop: 'mall' },
  nova_cap: { name: 'NOVA Dad Cap', th: 'หมวกแก๊ป NOVA', brand: 'NOVA', slot: 'hat', style: 'cap', color: '#d8d2c4', price: 790, shop: 'mall' },
  surf_bucket: { name: 'Bangsaen Surf Bucket Hat', th: 'หมวกบักเก็ต Bangsaen Surf', brand: 'Bangsaen Surf', slot: 'hat', style: 'bucket', color: '#264653', price: 590, shop: 'mall' },
  aviator_gold: { name: 'Aero Gold Aviators', th: 'แว่นกันแดด Aero ทรงนักบิน', brand: 'Aero', slot: 'glasses', style: 'sunglasses', color: '#2a1f12', price: 2490, shop: 'mall' },
  riva_tote: { name: 'Riva Leather Tote', th: 'กระเป๋าหนัง Riva', brand: 'Riva', slot: 'bag', style: 'tote', color: '#7a4a2d', price: 4990, shop: 'mall', level: 6 },
  nova_pack: { name: 'NOVA Tech Backpack', th: 'เป้ NOVA Tech', brand: 'NOVA', slot: 'bag', style: 'backpack', color: '#1b1c20', price: 2190, shop: 'mall' },
};

export const HAIRSTYLES = [
  { id: 'short', name: 'Short', price: 120 },
  { id: 'buzz', name: 'Buzz Cut', price: 80 },
  { id: 'side', name: 'Side Part', price: 150 },
  { id: 'spiky', name: 'Spiky', price: 180 },
  { id: 'bob', name: 'Bob', price: 200 },
  { id: 'long', name: 'Long', price: 250 },
  { id: 'ponytail', name: 'Ponytail', price: 200 },
  { id: 'bun', name: 'Bun', price: 220 },
  { id: 'curly', name: 'Curly', price: 260 },
];
export const HAIR_COLORS = ['#1a1410', '#3b2414', '#6b4423', '#a9763f', '#d8b36a', '#8a1c1c', '#2e4a8a', '#e6e6e6', '#d36fa5', '#2f7d5a'];
export const SKIN_TONES = ['#f3d2b3', '#e8b991', '#d49b6c', '#b97b4e', '#8d5634', '#5e3a22'];

// ---------------- Vehicles ----------------
// model = body shape (vehicle-models.js) · engine = sound profile (audio.js ENGINES) · retired = owned vehicles keep working, no longer sold.
// Real model names are used for recognisability only; the 3D models are original low-poly look-alikes (no logos) and the
// prices are rounded approximations of Thai list prices for game balance — no affiliation with the manufacturers.
export const VEHICLES = {
  bicycle: { name: 'City Bicycle', th: 'จักรยาน', type: 'bicycle', model: 'bicycle', engine: 'bike', price: 3500, top: 9, accel: 3.2, colors: ['#0b6b4f', '#c0392b', '#2c3e50', '#f1c40f'], shop: 'moto', level: 1, cls: 'bike' },
  wave: { name: 'Wave 110 Scooter', th: 'รถเครื่อง 110', type: 'moto', model: 'wave', engine: 'scooter', price: 39000, top: 24, accel: 6.5, colors: ['#c0392b', '#1f3a93', '#111111', '#e6e6e6'], shop: 'moto', level: 2, cls: 'moto' },
  click: { name: 'Honda Click 160', th: 'ฮอนด้า คลิก 160', type: 'scooter', model: 'click160', engine: 'click', price: 62000, top: 30, accel: 8, colors: ['#d8dde3', '#16181c', '#a3121c', '#1f4e8c'], shop: 'moto', level: 3, cls: 'moto' },
  pcx: { name: 'Honda PCX 160', th: 'ฮอนด้า พีซีเอ็กซ์ 160', type: 'scooter', model: 'pcx', engine: 'pcx', price: 95000, top: 32, accel: 8.5, colors: ['#1a1c20', '#e9e9e6', '#6b1f26', '#3b4652'], shop: 'moto', level: 4, cls: 'moto' },
  vespa: { name: 'Vespa Primavera 150', th: 'เวสป้า พรีมาเวร่า 150', type: 'scooter', model: 'vespa', engine: 'vespa', price: 125000, top: 29, accel: 7.8, colors: ['#9fd3c7', '#f2e6c9', '#c8102e', '#1f3d7a', '#111111'], shop: 'moto', level: 5, cls: 'moto' },
  forza: { name: 'Honda Forza 350', th: 'ฮอนด้า ฟอร์ซา 350', type: 'scooter', model: 'forza', engine: 'forza', price: 189000, top: 40, accel: 10.5, colors: ['#2b2f36', '#e8e8e8', '#7a0f14', '#1e3a5f'], shop: 'moto', level: 7, cls: 'moto' },
  sport: { name: 'Sport 250 Bike', th: 'บิ๊กไบค์ 250', type: 'sport', model: 'sport', engine: 'sport', price: 145000, top: 40, accel: 11, colors: ['#c0392b', '#111111', '#1f3a93', '#f1c40f'], shop: 'moto', level: 10, cls: 'moto' },
  civic: { name: 'Honda Civic e:HEV RS (2026)', th: 'ฮอนด้า ซีวิค e:HEV RS 2026', type: 'car', model: 'civic', engine: 'civic', price: 1190000, top: 52, accel: 10, colors: ['#e9e9ea', '#111214', '#9c1b22', '#2c4f8a', '#7c8287'], shop: 'cars', level: 10, cls: 'car' },
  camry: { name: 'Toyota Camry 2.5 HEV (2026)', th: 'โตโยต้า คัมรี่ 2.5 ไฮบริด 2026', type: 'car', model: 'camry', engine: 'hybrid', price: 1550000, top: 50, accel: 9.5, colors: ['#f2f2f0', '#18191b', '#4a4f55', '#5a1a20', '#2b3550'], shop: 'cars', level: 12, cls: 'car' },
  bmw3: { name: 'BMW 330e M Sport', th: 'บีเอ็มดับเบิลยู 330e เอ็ม สปอร์ต', type: 'car', model: 'bmw3', engine: 'bmw', price: 2990000, top: 58, accel: 12, colors: ['#1c3f8f', '#f4f4f2', '#111214', '#6d7378', '#7a1b1f'], shop: 'cars', level: 18, cls: 'car' },
  amggt: { name: 'Mercedes-AMG GT 63 Coupé', th: 'เมอร์เซเดส-เอเอ็มจี จีที 63 คูเป้', type: 'super', model: 'amggt', engine: 'amg', price: 15900000, top: 85, accel: 18, colors: ['#d7dbe0', '#0f1012', '#b3b8bd', '#c9a227', '#8b0e18'], shop: 'cars', level: 30, cls: 'super' },
  // retired generic models (kept for players who already own them)
  hatch: { name: 'City Hatchback', th: 'รถเก๋งเล็ก', type: 'car', model: 'hatch', engine: 'hatch', price: 420000, top: 36, accel: 7, colors: ['#e6e6e6', '#c0392b', '#2c3e50', '#7f8c8d', '#2980b9'], shop: 'cars', level: 6, cls: 'car', retired: true },
  pickup: { name: 'Hilander Pickup', th: 'กระบะ', type: 'pickup', model: 'pickup', engine: 'diesel', price: 690000, top: 38, accel: 7.5, colors: ['#e6e6e6', '#111111', '#7f8c8d', '#8e2b20'], shop: 'cars', level: 12, cls: 'car', retired: true },
  sedan: { name: 'Executive Sedan', th: 'รถเก๋ง', type: 'sedan', model: 'sedan', engine: 'car', price: 1250000, top: 45, accel: 9, colors: ['#111111', '#e6e6e6', '#34495e', '#7d1f1f'], shop: 'cars', level: 18, cls: 'car', retired: true },
  supercar: { name: 'GT Supercar', th: 'ซูเปอร์คาร์', type: 'super', model: 'super', engine: 'super', price: 6500000, top: 70, accel: 16, colors: ['#f1c40f', '#c0392b', '#111111', '#0b6b4f'], shop: 'cars', level: 30, cls: 'super', retired: true },
};
// tuning shop: price per level = base × level (level 1–3); paint = flat; repair = (1 − condition) × repair
export const TUNING = {
  parts: { engine: ['Engine tune', 'จูนเครื่องยนต์'], handling: ['Suspension & tyres', 'ช่วงล่างและยาง'], brakes: ['Brakes', 'ระบบเบรก'], exhaust: ['Sport exhaust', 'ท่อสปอร์ต'] },
  max: { engine: 3, handling: 3, brakes: 3, exhaust: 1 },
  base: { bike: { engine: 900, handling: 600, brakes: 500, exhaust: 0, paint: 300, repair: 400 }, moto: { engine: 4500, handling: 3000, brakes: 2500, exhaust: 3500, paint: 1500, repair: 2500 }, car: { engine: 45000, handling: 30000, brakes: 22000, exhaust: 28000, paint: 12000, repair: 18000 }, super: { engine: 380000, handling: 240000, brakes: 160000, exhaust: 220000, paint: 90000, repair: 150000 } },
  paints: ['#f2f2f0', '#111214', '#9c1b22', '#1c3f8f', '#2c4f8a', '#0b6b4f', '#c9a227', '#ff7a00', '#6a1b9a', '#d81b60', '#00a3a3', '#7c8287'],
};
export const RENTAL = { id: 'wave', price: 150 }; // rent a scooter for the session

// ---------------- Jobs ----------------
// game: keys | timing | memory | quiz | route
export const JOBS = {
  canteen: { name: 'Cafeteria Helper', th: 'ผู้ช่วยร้านโรงอาหาร', at: 'B07', game: 'keys', pay: [60, 110], xp: 30, energy: 8, level: 1, skill: 'cha', desc: 'Serve orders fast during the lunch rush.' },
  cashier: { name: 'Convenience Store Cashier', th: 'พนักงานแคชเชียร์', at: 'MART3', alt: ['MART1', 'MART2'], game: 'keys', pay: [70, 120], xp: 30, energy: 7, level: 1, skill: 'cha', desc: 'Scan items quickly and keep the queue moving.' },
  library: { name: 'Library Assistant', th: 'ผู้ช่วยบรรณารักษ์', at: 'B14', game: 'memory', pay: [80, 140], xp: 35, energy: 6, level: 1, skill: 'int', desc: 'Remember the shelf order and re-shelve books.' },
  banquet: { name: 'Banquet Staff', th: 'พนักงานจัดเลี้ยง', at: 'B28', game: 'timing', pay: [120, 220], xp: 45, energy: 12, level: 2, skill: 'fit', desc: 'Carry trays at the convention hall without spilling.' },
  delivery: { name: 'KU Eats Rider', th: 'ไรเดอร์ส่งอาหาร', at: 'phone', game: 'route', pay: [90, 260], xp: 50, energy: 8, level: 2, skill: 'drv', desc: 'Pick up food and deliver it around campus. Faster = bigger tip.' },
  taxi: { name: 'Motorbike Taxi', th: 'วินมอเตอร์ไซค์', at: 'B16', game: 'route', pay: [120, 300], xp: 55, energy: 8, level: 3, skill: 'drv', needVehicle: true, desc: 'Carry passengers from the main gate. Need your own bike.' },
  fuel: { name: 'Fuel Attendant', th: 'พนักงานปั๊มน้ำมัน', at: 'GAS', game: 'timing', pay: [80, 150], xp: 32, energy: 7, level: 1, skill: 'fit', desc: 'Fill tanks to the exact amount.' },
  lab: { name: 'Lab Assistant', th: 'ผู้ช่วยแล็บ', at: 'B02', game: 'memory', pay: [160, 280], xp: 60, energy: 8, level: 4, skill: 'int', req: { int: 15 }, desc: 'Repeat the wiring sequence correctly.' },
  ta: { name: 'Teaching Assistant', th: 'ผู้ช่วยสอน (TA)', at: 'B06', game: 'quiz', pay: [220, 400], xp: 80, energy: 9, level: 6, skill: 'int', req: { int: 30 }, desc: 'Help students — answer their questions correctly.' },
  lifeguard: { name: 'Lifeguard', th: 'ไลฟ์การ์ด', at: 'B20', game: 'timing', pay: [140, 240], xp: 50, energy: 10, level: 3, skill: 'fit', req: { fit: 15 }, desc: 'React fast when a swimmer needs help.' },
  farm: { name: 'Research Farm Helper', th: 'ผู้ช่วยแปลงเกษตร', at: 'GREEN', game: 'keys', pay: [90, 160], xp: 40, energy: 12, level: 1, skill: 'fit', desc: 'Help the agricultural research station harvest.' },
  barista: { name: 'Barista', th: 'บาริสต้า', at: 'CAFE', alt: ['BREW'], game: 'keys', pay: [90, 150], xp: 38, energy: 7, level: 2, skill: 'cha', desc: 'Make drinks in the right order.' },
};
export const JOB_COOLDOWN_MS = 15000;
// side-line work added in the "living campus" update (wages are computed by the server)
JOBS.ride = { name: 'Ride Driver (KU Ride)', th: 'ไรเดอร์รับส่งคน', at: 'phone', game: 'route', pay: [60, 420], xp: 50, energy: 6, level: 1, skill: 'drv', needVehicle: true, desc: 'Pick up passengers anywhere on the map and drop them at class, dorms, condos or the market.' };
JOBS.bizdel = { name: 'My Shop Delivery', th: 'ส่งของร้านตัวเอง', at: 'phone', game: 'route', pay: [40, 520], xp: 40, energy: 6, level: 1, skill: 'cha', desc: 'Cook your customers\' orders at your stall, then deliver them yourself.' };
JOBS.p2p = { name: 'Player Order Delivery', th: 'ส่งอาหารให้ผู้เล่น', at: 'phone', game: 'route', pay: [25, 200], xp: 45, energy: 5, level: 1, skill: 'drv', desc: 'Another player ordered food — pick it up at the shop and bring it to them.' };

// ---------------- Housing ----------------
// Everyone starts in a free fan room in a campus dorm (unique room). Moving costs a one-time lease (server-charged).
export const HOUSING = {
  dorm: { tier: 'cheap', en: 'Student dorm · fan room', th: 'หอพักนิสิต · ห้องพัดลม', places: ['B08A', 'B08B', 'B08C', 'B08D'], price: 0, floors: [2, 6], rooms: 24, energy: 55, mood: 2, health: 4, perks: ['Shared bathroom', 'Walk to class'], perks_th: ['ห้องน้ำรวม', 'เดินไปเรียนได้'] },
  pthouse: { tier: 'mid', en: 'PT House · air-con studio', th: 'พีที เฮ้าส์ · ห้องแอร์', places: ['PTHOUSE'], price: 18000, level: 3, floors: [2, 6], rooms: 18, energy: 75, mood: 6, health: 8, perks: ['Air-con', 'Private bathroom', 'Near Ao Udom'], perks_th: ['ห้องแอร์', 'ห้องน้ำในตัว', 'ใกล้อ่าวอุดม'] },
  aares: { tier: 'mid', en: 'AA Residence · studio', th: 'เอเอ เรสซิเด้นซ์ · ห้องสตูดิโอ', places: ['AARES'], price: 26000, level: 4, floors: [2, 8], rooms: 20, energy: 80, mood: 8, health: 8, perks: ['Air-con', 'Wi-Fi', 'Keycard'], perks_th: ['ห้องแอร์', 'Wi-Fi', 'คีย์การ์ด'] },
  kens: { tier: 'lux', en: 'Kensington · 1-bedroom', th: 'เคนซิงตัน · 1 ห้องนอน', places: ['KENS'], price: 95000, level: 7, floors: [3, 12], rooms: 12, energy: 95, mood: 12, health: 12, perks: ['Pool & gym', 'Security 24 h', 'Sea view'], perks_th: ['สระว่ายน้ำและฟิตเนส', 'รปภ. 24 ชม.', 'วิวทะเล'] },
  nott: { tier: 'lux', en: 'Notting Hill · 1-bedroom plus', th: 'น็อตติ้งฮิลล์ · 1 ห้องนอนพลัส', places: ['NOTT'], price: 120000, level: 9, floors: [3, 12], rooms: 12, energy: 100, mood: 14, health: 14, perks: ['Pool & gym', 'Co-working', 'Parking'], perks_th: ['สระว่ายน้ำและฟิตเนส', 'Co-working', 'ที่จอดรถ'] },
  tower: { tier: 'lux', en: 'Laemchabang Tower · penthouse', th: 'แหลมฉบัง ทาวเวอร์ · เพนท์เฮาส์', places: ['CONDO'], price: 280000, level: 12, floors: [12, 14], rooms: 4, energy: 100, mood: 20, health: 15, perks: ['Top floor', 'Panorama', 'Private lift'], perks_th: ['ชั้นบนสุด', 'วิวพาโนรามา', 'ลิฟต์ส่วนตัว'] },
};
export const HOUSING_TIER = { cheap: ['Budget', 'ราคาประหยัด'], mid: ['Mid-range', 'ราคากลาง'], lux: ['Luxury', 'ระดับหรู'] };

// ---------------- Own business ----------------
export const BUSINESSES = {
  friedstall: { en: 'Fried snack stall', th: 'ร้านของทอด', place: 'FOODST', price: 15000, level: 2, menu: { kaitod: 40, moopings: 30, friedtofu: 25, friedfish: 45, friedbanana: 20, sausage: 25 }, margin: 0.55 },
  riceshop: { en: 'Rice & curry delivery kitchen', th: 'ร้านข้าวแกงส่งตามหอ', place: 'MARKET', price: 32000, level: 4, menu: { krapao: 50, khaopad: 45, khaomankai: 45, greencurry: 55, omelette: 40, padthai: 55 }, margin: 0.5 },
};
export const MENU_NAMES = { kaitod: ['Fried chicken', 'ไก่ทอด'], moopings: ['Pork skewers', 'หมูปิ้ง'], friedtofu: ['Fried tofu', 'เต้าหู้ทอด'], friedfish: ['Fried fish balls', 'ลูกชิ้นปลาทอด'], friedbanana: ['Fried banana', 'กล้วยทอด'], sausage: ['Fried sausage', 'ไส้กรอกทอด'], krapao: ['Basil chicken rice', 'ข้าวกะเพราไก่'], khaopad: ['Fried rice', 'ข้าวผัด'], khaomankai: ['Chicken rice', 'ข้าวมันไก่'], greencurry: ['Green curry rice', 'ข้าวแกงเขียวหวาน'], omelette: ['Omelette rice', 'ข้าวไข่เจียว'], padthai: ['Pad thai', 'ผัดไทย'] };
// player-to-player food orders: these restaurant kinds can be ordered from (items from SHOPS[kind])
export const ORDER_KINDS = ['cafeteria', 'cafe', 'foodstreet', 'market', 'noodle', 'mookata', 'seafood', 'mart', 'shabu', 'friedchicken', 'ramen', 'steak', 'luxcafe'];

// ---------------- Levels ----------------
export const MAX_LEVEL = 60;
export function xpForLevel(l) { return Math.round(120 * Math.pow(l, 1.55)); }
export function levelTitle(l) {
  if (l < 5) return 'Freshman';
  if (l < 12) return 'Sophomore';
  if (l < 20) return 'Junior';
  if (l < 30) return 'Senior';
  if (l < 45) return 'Graduate';
  return 'KU Legend';
}

// ---------------- Quests ----------------
// type: visit (target building id or POI key), shop (any purchase in kind), eat, study, class, job, buy (item id or 'vehicle'),
//       talk, chat, money, run (track lap), club, photo
export const MAIN_QUESTS = [
  { id: 'q_welcome', title: 'Welcome to KU Sriracha', th: 'ยินดีต้อนรับสู่ มก.ศรีราชา', desc: 'Walk to the main gate sign and take in your new campus.', desc_th: 'เดินไปที่ป้ายประตูหลักของมหาวิทยาลัย แล้วดูรอบ ๆ วิทยาเขตใหม่ของคุณ', obj: { type: 'visit', target: 'gateSign' }, xp: 60, money: 100 },
  { id: 'q_register', title: 'Student Registration', th: 'รายงานตัวนิสิตใหม่', desc: 'Go to the Science Service Building (Campus Office) to get your student ID card.', desc_th: 'ไปที่อาคารบริการวิทยาศาสตร์ (สำนักงานวิทยาเขต) เพื่อรับบัตรนิสิต', obj: { type: 'visit', target: 'B01' }, xp: 80, money: 200 },
  { id: 'q_uniform', title: 'Dress the Part', th: 'ซื้อชุดนิสิต', desc: 'Buy a student uniform at the KU Co-op Store and wear it.', desc_th: 'ซื้อชุดนิสิตที่ร้านสหกรณ์ มก. แล้วสวมใส่', obj: { type: 'buy', target: 'uniform' }, xp: 90, money: 0 },
  { id: 'q_lunch', title: 'First Lunch', th: 'มื้อแรกที่โรงอาหาร', desc: 'Eat a meal at the Central Cafeteria (โรงอาหารกลาง).', desc_th: 'กินข้าวที่โรงอาหารกลาง', obj: { type: 'eat', target: 'cafeteria' }, xp: 70, money: 50 },
  { id: 'q_library', title: 'Hit the Books', th: 'เข้าห้องสมุด', desc: 'Study once at the 10th Anniversary Memorial Library.', desc_th: 'อ่านหนังสือ 1 ครั้งที่หอสมุดอนุสรณ์ 10 ปี', obj: { type: 'study' }, xp: 100, money: 0 },
  { id: 'q_class', title: 'First Lecture', th: 'เข้าเรียนครั้งแรก', desc: 'Attend a class at your faculty building.', desc_th: 'เข้าเรียน 1 คาบที่ตึกคณะของคุณ (กด E ที่ประตูตึก)', obj: { type: 'class' }, xp: 120, money: 0 },
  { id: 'q_job', title: 'Part-time Hustle', th: 'หางานพิเศษ', desc: 'Finish any part-time job. Check the Jobs app on your phone.', desc_th: 'ทำงานพิเศษให้สำเร็จ 1 งาน — ดูแอป "งาน" ในโทรศัพท์', obj: { type: 'job' }, xp: 120, money: 100 },
  { id: 'q_club', title: 'Join a Club', th: 'เข้าชมรม', desc: 'Visit the Student Activity Center and join a club.', desc_th: 'ไปศูนย์กิจกรรมนิสิตแล้วสมัครชมรม', obj: { type: 'club' }, xp: 100, money: 0 },
  { id: 'q_beach', title: 'Ao Udom Sunset', th: 'ทะเลอ่าวอุดม', desc: 'Walk to the end of Ao Udom pier.', desc_th: 'เดินไปสุดสะพานท่าเรืออ่าวอุดม', obj: { type: 'visit', target: 'pierEnd' }, xp: 120, money: 0 },
  { id: 'q_wheels', title: 'Get Some Wheels', th: 'มีรถเป็นของตัวเอง', desc: 'Rent or buy a vehicle at the Motorbike Shop on Sukhumvit.', desc_th: 'เช่าหรือซื้อรถที่ร้านมอเตอร์ไซค์ ถนนสุขุมวิท', obj: { type: 'buy', target: 'vehicle' }, xp: 150, money: 0 },
  { id: 'q_run', title: 'Stadium Lap', th: 'วิ่งรอบสนาม', desc: 'Run one full lap of the stadium track.', desc_th: 'วิ่งให้ครบ 1 รอบลู่วิ่งสนามกีฬา', obj: { type: 'run' }, xp: 150, money: 0 },
  { id: 'q_social', title: 'Say Hello', th: 'ทักทายเพื่อนใหม่', desc: 'Talk to a student NPC or send a chat message.', desc_th: 'คุยกับนิสิต NPC (กด E ใกล้ ๆ) หรือส่งข้อความแชท', obj: { type: 'talk' }, xp: 80, money: 0 },
  { id: 'q_hill', title: 'Top of the Hill', th: 'ขึ้นเขามองวิว', desc: 'Reach the KU hill viewpoint in the east.', desc_th: 'ขึ้นไปจุดชมวิวบนเขา มก. ทางทิศตะวันออก', obj: { type: 'visit', target: 'hillTop' }, xp: 200, money: 300 },
  { id: 'q_savings', title: 'Saving Up', th: 'เก็บเงินหมื่น', desc: 'Have 10,000 ฿ in your account.', desc_th: 'มีเงินในบัญชี 10,000 ฿', obj: { type: 'money', target: 10000 }, xp: 300, money: 0 },
  { id: 'q_level10', title: 'Campus Regular', th: 'ชีวิตนิสิตเต็มตัว', desc: 'Reach level 10.', desc_th: 'เลเวลถึง 10', obj: { type: 'level', target: 10 }, xp: 500, money: 2000 },
];

export const SIDE_QUESTS = [
  { id: 's_docs', title: 'Lost Documents', th: 'เอกสารของอาจารย์', giver: 'Ajarn Somchai', desc: 'Deliver lecture notes from the Engineering building to the Science building.', desc_th: 'ส่งเอกสารการสอนจากตึกวิศวะไปตึกวิทยาศาสตร์', from: 'B23', to: 'B26', xp: 90, money: 150 },
  { id: 's_coffee', title: 'Coffee Run', th: 'ซื้อกาแฟให้รุ่นพี่', giver: 'P\'Mint', desc: 'Bring an iced coffee from the Campus Café to the library.', desc_th: 'ซื้อกาแฟเย็นจากคาเฟ่ไปให้ที่ห้องสมุด', from: 'CAFE', to: 'B14', xp: 70, money: 120 },
  { id: 's_dorm', title: 'Package for the Dorm', th: 'ส่งพัสดุที่หอพัก', giver: 'Security Guard', desc: 'Take a parcel from Campus Security to Dormitory C.', desc_th: 'นำพัสดุจาก รปภ. ไปส่งที่หอพัก C', from: 'B16', to: 'B08C', xp: 80, money: 130 },
  { id: 's_seafood', title: 'Seafood Order', th: 'ซื้อซีฟู้ดให้ป้า', giver: 'Auntie Noi', desc: 'Pick up a seafood order at Ao Udom and deliver it to the Staff Residence.', desc_th: 'รับซีฟู้ดที่อ่าวอุดมไปส่งบ้านพักบุคลากร', from: 'SEAFOOD', to: 'B04', xp: 120, money: 220 },
  { id: 's_gym', title: 'Gym Buddy', th: 'เพื่อนเข้ายิม', giver: 'Ton', desc: 'Meet Ton at the PE building, then go to the Fitness Gyms.', desc_th: 'เจอต้นที่ตึกพลศึกษา แล้วไปฟิตเนสด้วยกัน', from: 'B13', to: 'FITNESS', xp: 100, money: 100 },
  { id: 's_maritime', title: 'Ship Model', th: 'โมเดลเรือ', giver: 'Captain Arthit', desc: 'Carry a ship model from the Maritime faculty to the Convention Hall.', desc_th: 'ถือโมเดลเรือจากคณะพาณิชยนาวีไปหอประชุม', from: 'B24', to: 'B28', xp: 110, money: 180 },
];

export const DAILY = [
  { id: 'd_class', title: 'Attend 2 classes', th: 'เข้าเรียน 2 คาบ', type: 'class', n: 2, xp: 120, money: 150 },
  { id: 'd_job', title: 'Complete 3 jobs', th: 'ทำงาน 3 ครั้ง', type: 'job', n: 3, xp: 150, money: 200 },
  { id: 'd_eat', title: 'Eat 3 meals', th: 'กินข้าว 3 มื้อ', type: 'eat', n: 3, xp: 60, money: 80 },
  { id: 'd_run', title: 'Run 1 km', th: 'วิ่ง 1 กม.', type: 'distance', n: 1000, xp: 100, money: 100 },
  { id: 'd_drive', title: 'Drive 3 km', th: 'ขับรถ 3 กม.', type: 'drive', n: 3000, xp: 100, money: 120 },
  { id: 'd_study', title: 'Study 2 times', th: 'อ่านหนังสือ 2 ครั้ง', type: 'study', n: 2, xp: 100, money: 80 },
];

export const CLUBS = [
  { id: 'robotics', name: 'Robotics Club', th: 'ชมรมหุ่นยนต์', skill: 'int' },
  { id: 'sports', name: 'Sports Club', th: 'ชมรมกีฬา', skill: 'fit' },
  { id: 'music', name: 'Music Club', th: 'ชมรมดนตรี', skill: 'cha' },
  { id: 'photo', name: 'Photography Club', th: 'ชมรมถ่ายภาพ', skill: 'cha' },
  { id: 'volunteer', name: 'Volunteer Club', th: 'ชมรมอาสา', skill: 'cha' },
  { id: 'esports', name: 'E-sports Club', th: 'ชมรมอีสปอร์ต', skill: 'int' },
  { id: 'sailing', name: 'Sailing Club', th: 'ชมรมเรือใบ', skill: 'fit' },
  { id: 'entre', name: 'Entrepreneurship Club', th: 'ชมรมผู้ประกอบการ', skill: 'int' },
];

export const START_MONEY = 2000;
export const DAILY_ALLOWANCE = 300;
export const MAX_PLAYERS = 100;
// Game clock: 1 in-game day = 48 real minutes (1 game hour = 2 real minutes)
export const DAY_LENGTH_MS = 48 * 60 * 1000;
export const DAY_START_OFFSET = 0.33; // shift so the server clock starts mid-morning-ish

// Daytime-only world clock: each game day runs 06:45 → 17:35 (no night), then a new day starts.
export const DAY_HOURS = [6.75, 17.6];
// day phases used by NPC behaviour, ambience and activities (no night by design)
export function dayPhase(hour) { return hour < 10.5 ? 'morning' : hour < 13.5 ? 'midday' : hour < 16 ? 'afternoon' : 'evening'; }
export function gameTime(nowMs) {
  const t = nowMs / DAY_LENGTH_MS + DAY_START_OFFSET;
  const day = Math.floor(t);
  const k = t - day;
  const hour = DAY_HOURS[0] + k * (DAY_HOURS[1] - DAY_HOURS[0]);
  return { day, frac: hour / 24, hour, k };
}
export function weatherForDay(day, frac) {
  // deterministic weather so every client agrees without extra traffic
  const seg = Math.floor(day * 4 + frac * 4);
  const r = Math.abs(Math.sin(seg * 12.9898) * 43758.5453) % 1;
  if (r < 0.14) return 'clear'; // no rain in this game (owner request) — the old rain slots are clear days
  if (r < 0.38) return 'cloudy';
  return 'clear';
}

// ---------------- Fishing ----------------
// weighted catch table (server rolls it); boots are part of fishing
export const FISH_TABLE = [['fish_mackerel', 30], ['fish_tilapia', 26], ['fish_squid', 16], ['fish_snapper', 10], ['fish_crab', 8], ['boot_old', 10]];
// ---------------- Campus events (server-scheduled; join by being there) ----------------
export const CAMPUS_EVENTS = {
  football: { th: 'ฟุตบอลกระชับมิตรที่สนามกีฬา', en: 'Friendly football match at the stadium', place: 'STAND', icon: '⚽' },
  basketball: { th: 'บาส 3x3 ที่สนามในร่ม', en: '3x3 basketball at the indoor courts', place: 'B21', icon: '🏀' },
  beach: { th: 'เก็บขยะชายหาดอ่าวอุดม', en: 'Beach clean-up at Ao Udom', place: 'MARKET', icon: '🏖️' },
  foodfair: { th: 'งานเทศกาลอาหารที่ถนนอาหาร', en: 'Food fair on KU Food Street', place: 'FOODST', icon: '🍢' },
  livemusic: { th: 'ดนตรีสดที่บาร์ริมหาด', en: 'Live band at the beach bar', place: 'BAR', icon: '🎸' },
  study: { th: 'ติวรวมก่อนสอบที่หอสมุด', en: 'Exam tutoring session at the library', place: 'B14', icon: '📚' },
  run: { th: 'วิ่งเพื่อสุขภาพรอบสนาม', en: 'Group run around the track', place: 'STAND', icon: '🏃' },
  sale: { th: 'มิดเยียร์เซลที่ห้าง', en: 'Mid-year sale at the mall', place: 'MALL', icon: '🛍️' },
};
