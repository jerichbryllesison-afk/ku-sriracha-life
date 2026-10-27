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
  { q: 'Kasetsart University Sriracha campus is in which province?', o: ['Chonburi', 'Rayong', 'Chachoengsao', 'Bangkok'], a: 0 },
  { q: 'What is the symbolic tree of Kasetsart University?', o: ['Nonsi (นนทรี)', 'Ratchaphruek', 'Rain tree', 'Coconut'], a: 0 },
  { q: 'Which road runs in front of KU Sriracha?', o: ['Sukhumvit Rd', 'Phahonyothin Rd', 'Rama II Rd', 'Mittraphap Rd'], a: 0 },
  { q: 'In Ohm\'s law, V equals?', o: ['I × R', 'I / R', 'R / I', 'I + R'], a: 0 },
  { q: 'Binary 1010 in decimal is?', o: ['10', '12', '8', '5'], a: 0 },
  { q: 'Which sensor measures distance using sound?', o: ['Ultrasonic', 'Thermistor', 'LDR', 'Hall effect'], a: 0 },
  { q: 'PLC stands for?', o: ['Programmable Logic Controller', 'Power Line Circuit', 'Primary Logic Core', 'Process Load Counter'], a: 0 },
  { q: 'Derivative of x² is?', o: ['2x', 'x', 'x³/3', '2'], a: 0 },
  { q: 'Big-O of binary search?', o: ['O(log n)', 'O(n)', 'O(n log n)', 'O(1)'], a: 0 },
  { q: 'Which gas is most abundant in Earth\'s air?', o: ['Nitrogen', 'Oxygen', 'CO₂', 'Argon'], a: 0 },
  { q: 'Supply rises, demand same → price tends to?', o: ['Fall', 'Rise', 'Stay', 'Double'], a: 0 },
  { q: 'GDP stands for?', o: ['Gross Domestic Product', 'General Debt Percentage', 'Gross Demand Price', 'Global Development Plan'], a: 0 },
  { q: 'Port side of a ship is the?', o: ['Left', 'Right', 'Front', 'Back'], a: 0 },
  { q: 'Laem Chabang, near KU Sriracha, is famous for its?', o: ['Deep-sea port', 'Airport', 'Ski resort', 'Desert'], a: 0 },
  { q: 'Accounting equation: Assets = ?', o: ['Liabilities + Equity', 'Revenue − Cost', 'Equity − Liabilities', 'Cash + Profit'], a: 0 },
  { q: 'In logistics, FIFO means?', o: ['First In, First Out', 'Fast In, Fast Out', 'Final Inventory For Order', 'Freight In Freight Out'], a: 0 },
  { q: 'Unit of electrical power?', o: ['Watt', 'Volt', 'Ohm', 'Tesla'], a: 0 },
  { q: 'A PID controller "I" term stands for?', o: ['Integral', 'Inertia', 'Input', 'Index'], a: 0 },
  { q: 'Which language runs natively in web browsers?', o: ['JavaScript', 'C#', 'LabVIEW', 'Fortran'], a: 0 },
  { q: 'Speed of light is about?', o: ['300,000 km/s', '30,000 km/s', '3,000 km/s', '300 km/s'], a: 0 },
  { q: 'Water boils at sea level at?', o: ['100 °C', '90 °C', '80 °C', '120 °C'], a: 0 },
  { q: 'A knot is a unit of?', o: ['Speed', 'Distance', 'Depth', 'Weight'], a: 0 },
  { q: 'Which is a renewable energy source?', o: ['Solar', 'Coal', 'Natural gas', 'Diesel'], a: 0 },
  { q: 'KU was founded in which year (B.E. 2486)?', o: ['1943', '1955', '1917', '1968'], a: 0 },
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
};

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
export const VEHICLES = {
  bicycle: { name: 'City Bicycle', th: 'จักรยาน', type: 'bicycle', price: 3500, top: 9, accel: 3.2, colors: ['#0b6b4f', '#c0392b', '#2c3e50', '#f1c40f'], shop: 'moto', level: 1 },
  wave: { name: 'Wave 110 Scooter', th: 'รถเครื่อง 110', type: 'moto', price: 39000, top: 24, accel: 6.5, colors: ['#c0392b', '#1f3a93', '#111111', '#e6e6e6'], shop: 'moto', level: 2 },
  click: { name: 'Click 125 Scooter', th: 'สกู๊ตเตอร์ 125', type: 'scooter', price: 56000, top: 27, accel: 7.5, colors: ['#e6e6e6', '#111111', '#0b6b4f', '#d35400'], shop: 'moto', level: 4 },
  sport: { name: 'CBR 250 Sport Bike', th: 'บิ๊กไบค์', type: 'sport', price: 145000, top: 40, accel: 11, colors: ['#c0392b', '#111111', '#1f3a93', '#f1c40f'], shop: 'moto', level: 10 },
  hatch: { name: 'City Hatchback', th: 'รถเก๋งเล็ก', type: 'car', price: 420000, top: 36, accel: 7, colors: ['#e6e6e6', '#c0392b', '#2c3e50', '#7f8c8d', '#2980b9'], shop: 'cars', level: 6 },
  pickup: { name: 'Hilander Pickup', th: 'กระบะ', type: 'pickup', price: 690000, top: 38, accel: 7.5, colors: ['#e6e6e6', '#111111', '#7f8c8d', '#8e2b20'], shop: 'cars', level: 12 },
  sedan: { name: 'Executive Sedan', th: 'รถเก๋ง', type: 'sedan', price: 1250000, top: 45, accel: 9, colors: ['#111111', '#e6e6e6', '#34495e', '#7d1f1f'], shop: 'cars', level: 18 },
  supercar: { name: 'GT Supercar', th: 'ซูเปอร์คาร์', type: 'super', price: 6500000, top: 70, accel: 16, colors: ['#f1c40f', '#c0392b', '#111111', '#0b6b4f'], shop: 'cars', level: 30 },
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
  { id: 'q_welcome', title: 'Welcome to KU Sriracha', th: 'ยินดีต้อนรับสู่ มก.ศรีราชา', desc: 'Walk to the main gate sign and take in your new campus.', obj: { type: 'visit', target: 'gateSign' }, xp: 60, money: 100 },
  { id: 'q_register', title: 'Student Registration', th: 'รายงานตัวนิสิตใหม่', desc: 'Go to the Science Service Building (Campus Office) to get your student ID card.', obj: { type: 'visit', target: 'B01' }, xp: 80, money: 200 },
  { id: 'q_uniform', title: 'Dress the Part', th: 'ซื้อชุดนิสิต', desc: 'Buy a student uniform at the KU Co-op Store and wear it.', obj: { type: 'buy', target: 'uniform' }, xp: 90, money: 0 },
  { id: 'q_lunch', title: 'First Lunch', th: 'มื้อแรกที่โรงอาหาร', desc: 'Eat a meal at the Central Cafeteria (โรงอาหารกลาง).', obj: { type: 'eat', target: 'cafeteria' }, xp: 70, money: 50 },
  { id: 'q_library', title: 'Hit the Books', th: 'เข้าห้องสมุด', desc: 'Study once at the 10th Anniversary Memorial Library.', obj: { type: 'study' }, xp: 100, money: 0 },
  { id: 'q_class', title: 'First Lecture', th: 'เข้าเรียนครั้งแรก', desc: 'Attend a class at your faculty building.', obj: { type: 'class' }, xp: 120, money: 0 },
  { id: 'q_job', title: 'Part-time Hustle', th: 'หางานพิเศษ', desc: 'Finish any part-time job. Check the Jobs app on your phone.', obj: { type: 'job' }, xp: 120, money: 100 },
  { id: 'q_club', title: 'Join a Club', th: 'เข้าชมรม', desc: 'Visit the Student Activity Center and join a club.', obj: { type: 'club' }, xp: 100, money: 0 },
  { id: 'q_beach', title: 'Ao Udom Sunset', th: 'ทะเลอ่าวอุดม', desc: 'Walk to the end of Ao Udom pier.', obj: { type: 'visit', target: 'pierEnd' }, xp: 120, money: 0 },
  { id: 'q_wheels', title: 'Get Some Wheels', th: 'มีรถเป็นของตัวเอง', desc: 'Rent or buy a vehicle at the Motorbike Shop on Sukhumvit.', obj: { type: 'buy', target: 'vehicle' }, xp: 150, money: 0 },
  { id: 'q_run', title: 'Stadium Lap', th: 'วิ่งรอบสนาม', desc: 'Run one full lap of the stadium track.', obj: { type: 'run' }, xp: 150, money: 0 },
  { id: 'q_social', title: 'Say Hello', th: 'ทักทายเพื่อนใหม่', desc: 'Talk to a student NPC or send a chat message.', obj: { type: 'talk' }, xp: 80, money: 0 },
  { id: 'q_hill', title: 'Top of the Hill', th: 'ขึ้นเขามองวิว', desc: 'Reach the KU hill viewpoint in the east.', obj: { type: 'visit', target: 'hillTop' }, xp: 200, money: 300 },
  { id: 'q_savings', title: 'Saving Up', th: 'เก็บเงินหมื่น', desc: 'Have 10,000 ฿ in your account.', obj: { type: 'money', target: 10000 }, xp: 300, money: 0 },
  { id: 'q_level10', title: 'Campus Regular', th: 'ชีวิตนิสิตเต็มตัว', desc: 'Reach level 10.', obj: { type: 'level', target: 10 }, xp: 500, money: 2000 },
];

export const SIDE_QUESTS = [
  { id: 's_docs', title: 'Lost Documents', th: 'เอกสารของอาจารย์', giver: 'Ajarn Somchai', desc: 'Deliver lecture notes from the Engineering building to the Science building.', from: 'B23', to: 'B26', xp: 90, money: 150 },
  { id: 's_coffee', title: 'Coffee Run', th: 'ซื้อกาแฟให้รุ่นพี่', giver: 'P\'Mint', desc: 'Bring an iced coffee from the Campus Café to the library.', from: 'CAFE', to: 'B14', xp: 70, money: 120 },
  { id: 's_dorm', title: 'Package for the Dorm', th: 'ส่งพัสดุที่หอพัก', giver: 'Security Guard', desc: 'Take a parcel from Campus Security to Dormitory C.', from: 'B16', to: 'B08C', xp: 80, money: 130 },
  { id: 's_seafood', title: 'Seafood Order', th: 'ซื้อซีฟู้ดให้ป้า', giver: 'Auntie Noi', desc: 'Pick up a seafood order at Ao Udom and deliver it to the Staff Residence.', from: 'SEAFOOD', to: 'B04', xp: 120, money: 220 },
  { id: 's_gym', title: 'Gym Buddy', th: 'เพื่อนเข้ายิม', giver: 'Ton', desc: 'Meet Ton at the PE building, then go to the Fitness Gyms.', from: 'B13', to: 'FITNESS', xp: 100, money: 100 },
  { id: 's_maritime', title: 'Ship Model', th: 'โมเดลเรือ', giver: 'Captain Arthit', desc: 'Carry a ship model from the Maritime faculty to the Convention Hall.', from: 'B24', to: 'B28', xp: 110, money: 180 },
];

export const DAILY = [
  { id: 'd_class', title: 'Attend 2 classes', type: 'class', n: 2, xp: 120, money: 150 },
  { id: 'd_job', title: 'Complete 3 jobs', type: 'job', n: 3, xp: 150, money: 200 },
  { id: 'd_eat', title: 'Eat 3 meals', type: 'eat', n: 3, xp: 60, money: 80 },
  { id: 'd_run', title: 'Run 1 km', type: 'distance', n: 1000, xp: 100, money: 100 },
  { id: 'd_drive', title: 'Drive 3 km', type: 'drive', n: 3000, xp: 100, money: 120 },
  { id: 'd_study', title: 'Study 2 times', type: 'study', n: 2, xp: 100, money: 80 },
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
  if (r < 0.14) return 'rain';
  if (r < 0.38) return 'cloudy';
  return 'clear';
}
