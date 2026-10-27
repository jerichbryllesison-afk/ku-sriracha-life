// KU Sriracha Life — world layout (1 unit = 1 metre).
// +X = east, +Z = south (three.js: -Z is north). Sea (Ao Udom bay) is to the west,
// Sukhumvit Road runs north–south between the town strip and the campus.

export const WORLD = {
  minX: -760, maxX: 700, minZ: -600, maxZ: 600,
  waterLevel: -0.8,
  playMinX: -700, playMaxX: 660, playMinZ: -580, playMaxZ: 580,
};

// Roads: axis 'z' = runs north–south at x = at ; axis 'x' = runs east–west at z = at
export const ROADS = [
  { id: 'beach', name: 'Ao Udom Beach Rd', th: 'ถนนเลียบหาดอ่าวอุดม', axis: 'z', at: -490, from: -580, to: 580, width: 10, lanes: 2, walk: 3 },
  { id: 'sukhumvit', name: 'Sukhumvit Rd', th: 'ถนนสุขุมวิท', axis: 'z', at: -310, from: -600, to: 600, width: 26, lanes: 6, median: 2.4, walk: 4, highway: true },
  { id: 'town1', name: 'Soi Thung Sukhla 1', th: 'ซอยทุ่งสุขลา 1', axis: 'x', at: -380, from: -490, to: -310, width: 9, lanes: 2, walk: 2.5 },
  { id: 'town2', name: 'Soi Thung Sukhla 2', th: 'ซอยทุ่งสุขลา 2', axis: 'x', at: -150, from: -490, to: -310, width: 9, lanes: 2, walk: 2.5 },
  { id: 'aoudom', name: 'Soi Ao Udom', th: 'ซอยอ่าวอุดม', axis: 'x', at: 0, from: -490, to: -310, width: 10, lanes: 2, walk: 3 },
  { id: 'town3', name: 'Soi Thung Sukhla 3', th: 'ซอยทุ่งสุขลา 3', axis: 'x', at: 150, from: -490, to: -310, width: 9, lanes: 2, walk: 2.5 },
  { id: 'town4', name: 'Soi Thung Sukhla 4', th: 'ซอยทุ่งสุขลา 4', axis: 'x', at: 380, from: -490, to: -310, width: 9, lanes: 2, walk: 2.5 },
  // Campus
  { id: 'kumain', name: 'Kasetsart Avenue', th: 'ถนนเกษตรศาสตร์', axis: 'x', at: 0, from: -310, to: 470, width: 16, lanes: 4, median: 3, walk: 3.5, campus: true },
  { id: 'kuwest', name: 'Nonsi Rd West', th: 'ถนนนนทรีตะวันตก', axis: 'z', at: -180, from: -330, to: 330, width: 9, lanes: 2, walk: 3, campus: true },
  { id: 'kucentral', name: 'Central Rd', th: 'ถนนกลาง', axis: 'z', at: 40, from: -330, to: 330, width: 9, lanes: 2, walk: 3, campus: true },
  { id: 'kueast', name: 'Nonsi Rd East', th: 'ถนนนนทรีตะวันออก', axis: 'z', at: 260, from: -330, to: 330, width: 9, lanes: 2, walk: 3, campus: true },
  { id: 'kunorth', name: 'Dormitory Rd', th: 'ถนนหอพัก', axis: 'x', at: -330, from: -310, to: 260, width: 9, lanes: 2, walk: 3, campus: true },
  { id: 'kusouth', name: 'Faculty Rd', th: 'ถนนคณะ', axis: 'x', at: 330, from: -310, to: 260, width: 9, lanes: 2, walk: 3, campus: true },
  { id: 'kumidn', name: 'Library Rd', th: 'ถนนหอสมุด', axis: 'x', at: -160, from: -180, to: 260, width: 9, lanes: 2, walk: 3, campus: true },
  { id: 'kumids', name: 'Lake Rd', th: 'ถนนริมสระ', axis: 'x', at: 170, from: -180, to: 260, width: 9, lanes: 2, walk: 3, campus: true },
  // residential sois outside the campus fence
  { id: 'resn', name: 'Soi Ban Nong Kho', th: 'ซอยบ้านหนองค้อ', axis: 'x', at: -515, from: -310, to: 460, width: 8, lanes: 2, walk: 2 },
  { id: 'ress', name: 'Soi Ban Suan', th: 'ซอยบ้านสวน', axis: 'x', at: 515, from: -310, to: 460, width: 8, lanes: 2, walk: 2 },
];

// Building styles: ku, kuglass, brick, concrete, dorm, shop, glass, hall, canteen, hangar, thai, gas, market, stall
// door: side facing the entrance (n,s,e,w).  kind: functional tag used by gameplay.
export const BUILDINGS = [
  // ---- Campus (official building names from the KU Sriracha campus map) ----
  { id: 'B16', name: 'Campus Security', th: 'รักษาความปลอดภัย', x: -268, z: -22, w: 10, d: 7, floors: 1, style: 'ku', door: 's', kind: 'security' },
  { id: 'B01', name: 'Science Service Bldg (Campus Office)', th: 'อาคารบริการวิทยาการ', x: -238, z: -82, w: 56, d: 30, floors: 4, style: 'ku', door: 's', kind: 'office' },
  { id: 'B04', name: 'Staff Residence', th: 'พักอาศัยบุคลากร', x: -240, z: -210, w: 44, d: 16, floors: 4, style: 'dorm', door: 's', kind: 'residence' },
  { id: 'B19', name: 'Staff Residence 2', th: 'พักอาศัยบุคลากร 2', x: -240, z: -282, w: 44, d: 16, floors: 4, style: 'dorm', door: 's', kind: 'residence' },
  { id: 'B28', name: 'Multipurpose & Convention Hall', th: 'อาคารอเนกประสงค์และการประชุม', x: -240, z: 82, w: 62, d: 46, floors: 3, fh: 5.2, style: 'hall', door: 'n', kind: 'hall' },
  { id: 'COOP', name: 'KU Co-op Store', th: 'สหกรณ์ร้านค้า มก.', x: -240, z: 175, w: 34, d: 18, floors: 2, style: 'kuglass', door: 'n', kind: 'coop' },
  { id: 'B14', name: '10th Anniversary Memorial Library', th: 'หอสมุดอนุสรณ์ 10 ปี', x: -115, z: -82, w: 44, d: 30, floors: 4, style: 'kuglass', door: 's', kind: 'library' },
  { id: 'B06', name: 'Lecture Center 1', th: 'ศูนย์เรียนรวม', x: -12, z: -86, w: 54, d: 32, floors: 5, style: 'ku', door: 's', kind: 'lecture' },
  { id: 'CAFE', name: 'Cafe Nonsi', th: 'คาเฟ่นนทรี', x: -62, z: -30, w: 14, d: 10, floors: 1, style: 'glass', door: 's', kind: 'cafe' },
  { id: 'B07', name: 'Central Cafeteria', th: 'โรงอาหารกลาง', x: -110, z: 76, w: 56, d: 36, floors: 2, fh: 4.6, style: 'canteen', door: 'n', kind: 'cafeteria' },
  { id: 'MART1', name: '24 Mart (Campus)', th: 'ร้านสะดวกซื้อ 24 ชม.', x: -52, z: 30, w: 14, d: 10, floors: 1, style: 'mart', door: 'n', kind: 'mart' },
  { id: 'B09', name: 'Student Activity Center', th: 'ศูนย์กิจกรรม', x: -12, z: 100, w: 38, d: 32, floors: 3, style: 'brick', door: 'w', kind: 'activity' },
  { id: 'B10', name: 'Lecture Center 2', th: 'ศูนย์เรียนรวม 2', x: 100, z: -86, w: 54, d: 32, floors: 6, style: 'concrete', door: 's', kind: 'lecture' },
  { id: 'B17', name: 'Lecture Center 3', th: 'ศูนย์เรียนรวม 3', x: 200, z: -86, w: 50, d: 30, floors: 6, style: 'kuglass', door: 's', kind: 'lecture' },
  { id: 'B12', name: 'Sri Dhamma Kaset Pavilion', th: 'ศรีธรรมเกษตร', x: 82, z: 40, w: 14, d: 14, floors: 1, fh: 4.5, style: 'thai', door: 's', kind: 'pavilion' },
  { id: 'B23', name: 'Faculty of Engineering at Sriracha', th: 'อาคารคณะวิศวกรรมศาสตร์ศรีราชา', x: -105, z: 226, w: 68, d: 28, floors: 8, style: 'kuglass', door: 'n', kind: 'faculty', faculty: 'eng' },
  { id: 'B02', name: 'Engineering Laboratory', th: 'ปฏิบัติการวิศวกรรมศาสตร์', x: -6, z: 216, w: 40, d: 26, floors: 3, style: 'concrete', door: 'w', kind: 'lab' },
  { id: 'B03', name: 'Aerospace Engineering Lab', th: 'ปฏิบัติการวิศวกรรมการบินและอวกาศยาน', x: -122, z: 292, w: 44, d: 24, floors: 2, fh: 5, style: 'hangar', door: 'n', kind: 'lab' },
  { id: 'B29', name: 'High Voltage Laboratory', th: 'อาคารปฏิบัติการไฟฟ้าแรงสูง', x: -14, z: 294, w: 34, d: 22, floors: 2, fh: 5, style: 'brick', door: 'n', kind: 'lab' },
  { id: 'B26', name: 'Faculty of Science at Sriracha', th: 'อาคารคณะวิทยาศาสตร์ ศรีราชา', x: 102, z: 222, w: 58, d: 28, floors: 6, style: 'ku', door: 'n', kind: 'faculty', faculty: 'sci' },
  { id: 'B15', name: 'Science & Technology Lab', th: 'ปฏิบัติการวิทยาศาสตร์และเทคโนโลยี', x: 206, z: 216, w: 38, d: 26, floors: 4, style: 'brick', door: 'n', kind: 'lab' },
  { id: 'B25', name: 'Computer Technology Bldg', th: 'เทคโนโลยีทางด้านคอมพิวเตอร์', x: 96, z: 294, w: 44, d: 22, floors: 4, style: 'glass', door: 'n', kind: 'lab' },
  { id: 'B27', name: 'Basic Science & Tech Bldg', th: 'อาคารเรียนและปฏิบัติการพื้นฐานและเทคโนโลยี', x: 202, z: 294, w: 44, d: 24, floors: 4, style: 'concrete', door: 'n', kind: 'lecture' },
  { id: 'B22', name: 'Business Education Bldg (Management Sciences)', th: 'อาคารธุรกิจศึกษา คณะวิทยาการจัดการ', x: -110, z: -246, w: 60, d: 28, floors: 7, style: 'glass', door: 's', kind: 'faculty', faculty: 'ms' },
  { id: 'B18', name: 'Faculty of Economics at Sriracha', th: 'เศรษฐศาสตร์ศรีราชา', x: -6, z: -226, w: 40, d: 26, floors: 5, style: 'ku', door: 's', kind: 'faculty', faculty: 'econ' },
  { id: 'B05', name: 'Economics Academic Center', th: 'ศูนย์วิชาการเศรษฐศาสตร์', x: -6, z: -292, w: 34, d: 20, floors: 3, style: 'brick', door: 'w', kind: 'lecture' },
  { id: 'B24', name: 'Faculty of International Maritime Studies', th: 'อาคารคณะพาณิชยนาวีนานาชาติ', x: 110, z: -246, w: 60, d: 28, floors: 6, style: 'kuglass', door: 's', kind: 'faculty', faculty: 'ims' },
  { id: 'B11', name: 'Facilities & Vehicles', th: 'สถานที่และยานพาหนะ', x: 206, z: -292, w: 40, d: 24, floors: 2, fh: 4.5, style: 'concrete', door: 'n', kind: 'garage' },
  { id: 'B08A', name: 'Student Dormitory A', th: 'หอพักนิสิต A', x: -240, z: -390, w: 56, d: 18, floors: 6, style: 'dorm', door: 's', kind: 'dorm' },
  { id: 'B08B', name: 'Student Dormitory B', th: 'หอพักนิสิต B', x: -150, z: -390, w: 56, d: 18, floors: 6, style: 'dorm', door: 's', kind: 'dorm' },
  { id: 'B08C', name: 'Student Dormitory C', th: 'หอพักนิสิต C', x: -60, z: -390, w: 56, d: 18, floors: 6, style: 'dorm', door: 's', kind: 'dorm' },
  { id: 'B08D', name: 'Student Dormitory D', th: 'หอพักนิสิต D', x: 30, z: -390, w: 56, d: 18, floors: 6, style: 'dorm', door: 's', kind: 'dorm' },
  { id: 'MART2', name: '24 Mart (Dorm)', th: 'ร้านสะดวกซื้อ หอพัก', x: 120, z: -392, w: 16, d: 12, floors: 1, style: 'mart', door: 's', kind: 'mart' },
  { id: 'B13', name: 'Physical Education Bldg (Gym)', th: 'อาคารพลศึกษา', x: 330, z: 46, w: 46, d: 34, floors: 2, fh: 6, style: 'hall', door: 'w', kind: 'gym' },
  { id: 'B20', name: 'Swimming Pool', th: 'สระว่ายน้ำ', x: 425, z: 46, w: 66, d: 36, floors: 0, style: 'pool', door: 'w', kind: 'pool' },
  { id: 'B21', name: 'Futsal Courts', th: 'สนามฟุตซอล', x: 322, z: 160, w: 42, d: 28, floors: 1, fh: 8, style: 'court', door: 'w', kind: 'court' },
  { id: 'STAND', name: 'Stadium Grandstand', th: 'อัฒจันทร์สนามกีฬา', x: 322, z: -180, w: 14, d: 80, floors: 1, fh: 7, style: 'stand', door: 'e', kind: 'stadium' },
  { id: 'FOODST', name: 'KU Food Street', th: 'ถนนอาหาร มก.ศรีราชา', x: -60, z: 375, w: 80, d: 14, floors: 1, fh: 3.4, style: 'market', door: 'n', kind: 'foodstreet' },
  { id: 'GREEN', name: 'Agricultural Research Greenhouse', th: 'โรงเรือนวิจัยเกษตร', x: 400, z: 300, w: 40, d: 18, floors: 1, fh: 5, style: 'greenhouse', door: 'w', kind: 'farm' },
  // ---- Town strip (between Ao Udom beach and Sukhumvit) ----
  { id: 'CONDO', name: 'Sriracha Bay Condo', th: 'ศรีราชา เบย์ คอนโด', x: -400, z: -470, w: 40, d: 30, floors: 16, style: 'glass', door: 'e', kind: 'condo' },
  { id: 'PDORM', name: 'Baan Nonsi Apartment', th: 'บ้านนนทรี อพาร์ทเม้นท์', x: -455, z: -425, w: 30, d: 18, floors: 6, style: 'dorm', door: 'w', kind: 'residence' },
  { id: 'MARKET', name: 'Thung Sukhla Market', th: 'ตลาดทุ่งสุขลา', x: -410, z: -300, w: 64, d: 44, floors: 1, fh: 4, style: 'market', door: 'e', kind: 'market' },
  { id: 'FASHION', name: 'Sriracha Fashion', th: 'ศรีราชา แฟชั่น', x: -345, z: -205, w: 20, d: 16, floors: 3, style: 'shop', door: 'e', kind: 'fashion' },
  { id: 'BARBER', name: 'Barber & Salon', th: 'ร้านตัดผม', x: -345, z: -238, w: 12, d: 12, floors: 2, style: 'shop', door: 'e', kind: 'barber' },
  { id: 'GAS', name: 'Siam Fuel Station', th: 'ปั๊มน้ำมันสยาม', x: -352, z: -82, w: 32, d: 22, floors: 1, fh: 6, style: 'gas', door: 'e', kind: 'gas' },
  { id: 'MART3', name: '24 Mart (Sukhumvit)', th: 'ร้านสะดวกซื้อ สุขุมวิท', x: -350, z: -34, w: 18, d: 12, floors: 1, style: 'mart', door: 'e', kind: 'mart' },
  { id: 'BREW', name: 'Bay Brew Cafe', th: 'เบย์ บรูว์ คาเฟ่', x: -462, z: -40, w: 16, d: 12, floors: 2, style: 'glass', door: 'w', kind: 'cafe' },
  { id: 'MOTO', name: 'KU Moto Dealer', th: 'ร้านมอเตอร์ไซค์', x: -350, z: 40, w: 24, d: 18, floors: 2, style: 'showroom', door: 'e', kind: 'moto' },
  { id: 'CARS', name: 'Siam Motors', th: 'สยาม มอเตอร์ส', x: -352, z: 100, w: 30, d: 24, floors: 2, style: 'showroom', door: 'e', kind: 'cars' },
  { id: 'BANK', name: 'Siam Bank', th: 'ธนาคารสยาม', x: -455, z: 40, w: 18, d: 14, floors: 2, style: 'glass', door: 'w', kind: 'bank' },
  { id: 'MOOKATA', name: 'Sriracha Moo Kata', th: 'หมูกระทะศรีราชา', x: -350, z: 205, w: 24, d: 16, floors: 1, fh: 4, style: 'canteen', door: 'e', kind: 'mookata' },
  { id: 'FITNESS', name: 'Iron Fitness', th: 'ไอรอน ฟิตเนส', x: -350, z: 265, w: 24, d: 18, floors: 2, style: 'glass', door: 'e', kind: 'fitness' },
  { id: 'NOODLE', name: 'Boat Noodle Shop', th: 'ก๋วยเตี๋ยวเรือ', x: -458, z: 205, w: 16, d: 12, floors: 2, style: 'shop', door: 'w', kind: 'noodle' },
  { id: 'CLINIC', name: 'Sriracha Clinic', th: 'คลินิกศรีราชา', x: -455, z: 300, w: 20, d: 14, floors: 3, style: 'ku', door: 'w', kind: 'clinic' },
  { id: 'HOTEL', name: 'Ao Udom Hotel', th: 'โรงแรมอ่าวอุดม', x: -410, z: 465, w: 50, d: 30, floors: 10, style: 'kuglass', door: 'e', kind: 'hotel' },
  { id: 'SEAFOOD', name: 'Krua Ao Udom Seafood', th: 'ครัวอ่าวอุดม ซีฟู้ด', x: -522, z: 62, w: 20, d: 14, floors: 1, fh: 4, style: 'thai', door: 'e', kind: 'seafood' },
];

// Special zones
export const LAKE = { x: 158, z: 88, rx: 66, rz: 44, depth: 2.6 };
export const TRACK = { x: 390, z: -180, w: 92, d: 176 }; // outer running track (long axis N–S)
export const HILL = { x0: 470, peakX: 610, height: 46 };
export const PIER = { x0: -505, x1: -650, z: 0, w: 6, h: 1.1 };
export const FARM = { x0: 300, x1: 470, z0: 240, z1: 420 };
export const CAMPUS = { x0: -292, x1: 520, z0: -432, z1: 432 };
export const GATES = [
  { id: 'main', x: -292, z: 0, w: 22, name: 'KU Sriracha Main Gate' },
  { id: 'north', x: -292, z: -330, w: 14, name: 'North Gate' },
  { id: 'south', x: -292, z: 330, w: 14, name: 'South Gate' },
];

// Named points of interest (for GPS / quests)
export const POIS = {
  gateSign: { x: -270, z: 16, name: 'KU Main Gate Sign' },
  pierEnd: { x: -640, z: 0, name: 'Ao Udom Pier' },
  beach: { x: -515, z: -60, name: 'Ao Udom Beach' },
  trackStart: { x: 344, z: -180, name: 'Stadium Track' },
  hillTop: { x: 600, z: 0, name: 'KU Hill Viewpoint' },
  lake: { x: 158, z: 40, name: 'Campus Lake' },
  plaza: { x: -62, z: -18, name: 'Library Plaza' },
  dormSquare: { x: -105, z: -360, name: 'Dorm Square' },
  busStop: { x: -282, z: 22, name: 'Sukhumvit Bus Stop' },
};

export const SPAWNS = [
  { x: -262, z: 10, ry: Math.PI / 2 },
  { x: -258, z: 14, ry: Math.PI / 2 },
  { x: -264, z: -8, ry: Math.PI / 2 },
  { x: -250, z: 8, ry: Math.PI / 2 },
];

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function hash2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, z) { return vnoise(x, z) * 0.5 + vnoise(x * 2.1, z * 2.1) * 0.25 + vnoise(x * 4.3, z * 4.3) * 0.125; }

// Terrain height (roads / building plots are kept at 0 so everything sits flush)
export function groundHeight(x, z) {
  let h = 0;
  // beach + seabed
  if (x < -500) {
    const t = -500 - x;
    h = -t * 0.032 - Math.max(0, t - 45) * 0.11;
    if (h < -12) h = -12;
    // pier pilings area keeps same profile
  }
  // eastern forest hill
  if (x > HILL.x0) {
    const t = sstep(HILL.x0, HILL.peakX, x);
    const ridge = 0.75 + 0.25 * Math.cos(z / 160);
    h += t * HILL.height * ridge + t * (fbm(x / 40, z / 40) - 0.45) * 10;
  }
  // gentle south-east farm undulation
  if (x > FARM.x0 && z > FARM.z0 - 20 && x < HILL.x0 + 10) {
    const fx = sstep(FARM.x0, FARM.x0 + 30, x) * sstep(FARM.z0 - 20, FARM.z0 + 20, z);
    h += fx * (fbm(x / 35, z / 35) - 0.4) * 2.2;
  }
  // campus lake bowl
  const lx = (x - LAKE.x) / LAKE.rx, lz = (z - LAKE.z) / LAKE.rz;
  const r2 = lx * lx + lz * lz;
  if (r2 < 1.35) {
    const k = 1 - sstep(0.75, 1.3, r2);
    h -= k * LAKE.depth;
  }
  return h;
}

export function inLake(x, z) {
  const lx = (x - LAKE.x) / LAKE.rx, lz = (z - LAKE.z) / LAKE.rz;
  return lx * lx + lz * lz < 1.0;
}
