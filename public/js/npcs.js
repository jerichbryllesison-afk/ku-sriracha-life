// Pedestrians, idle student groups and quest-giver NPCs.
import * as THREE from 'three';
import { Character, makeLabel, makeBubble } from './character.js';
import { edgePoint } from './roadnet.js';
import { SURF } from './collision.js';
import { HAIR_COLORS, SKIN_TONES } from '../shared/catalog.js';

const TOPS_M = ['uniform_m', 'uniform_m', 'uniform_m', 'ku_tee', 'tee_white', 'tee_black', 'polo_navy', 'ku_hoodie', 'eng_shop', 'hawaii', 'tee_red'];
const TOPS_F = ['uniform_f', 'uniform_f', 'uniform_f', 'ku_tee', 'tee_white', 'dress_pink', 'dress_navy', 'tee_yellow', 'hoodie_grey'];
const BOT_M = ['slacks_black', 'slacks_black', 'jeans', 'chinos', 'shorts', 'joggers', 'jeans_black'];
const BOT_F = ['skirt_black', 'skirt_black', 'skirt_denim', 'jeans', 'shorts', 'skirt_black'];
const SHOES = ['shoes_black', 'shoes_black', 'sneakers_white', 'sneakers_red', 'sandals'];
const HAIR_M = ['short', 'side', 'spiky', 'buzz', 'curly'];
const HAIR_F = ['long', 'ponytail', 'bob', 'bun', 'long'];
const NAMES_M = ['Somchai', 'Krit', 'Nattapong', 'Thanakorn', 'Pakorn', 'Ton', 'Bank', 'Mos', 'Golf', 'Arm', 'Beam', 'Film', 'Peach'];
const NAMES_F = ['Ploy', 'Mint', 'Fah', 'Praew', 'Ice', 'Nok', 'Ning', 'Jan', 'Pim', 'Fern', 'Bam', 'May', 'Noey'];
export const CHATTER = [
  'Have you tried the krapao at the central cafeteria? 50 baht and huge!', 'The library is open 24 hours during exam week.', 'Sukhumvit is crazy at 5 pm, take the motorbike.',
  'Ao Udom pier is the best place to watch the sunset.', 'Robotics club is building a new AGV this term!', 'Remember the Nonsi tree is our KU symbol 🌼',
  'I need a part-time job… the Jobs app on your phone lists them.', 'Engineering students wear the red shop shirt.', 'The hill behind campus has a great viewpoint.',
  'Don\'t forget to attend class — your GPA matters!', 'Moo kata on Sukhumvit tonight? 🔥', 'Laem Chabang port is just south of here.',
  'Rent a scooter at the motorbike shop if you can\'t afford one yet.', 'Have you seen the stadium track? One lap is 400 metres.', 'The mini-mart near the dorm sells cheap sandwiches.',
  'Wear your student uniform on campus, the security guard notices!', 'The seafood at Krua Ao Udom is so good.', 'Exams are coming… time to hit the books.',
];
export function randomLook(rnd = Math.random) {
  const f = rnd() < 0.5; const pick = (a) => a[(rnd() * a.length) | 0];
  return { gender: f ? 'f' : 'm', skin: pick(SKIN_TONES.slice(0, 5)), hair: pick(f ? HAIR_F : HAIR_M), hairColor: rnd() < 0.8 ? HAIR_COLORS[(rnd() * 3) | 0] : pick(HAIR_COLORS), top: pick(f ? TOPS_F : TOPS_M), bottom: pick(f ? BOT_F : BOT_M), shoes: pick(SHOES), bag: rnd() < 0.55 ? pick(['backpack', 'backpack_ku', 'tote']) : null, glasses: rnd() < 0.18 ? 'glasses' : null, hat: rnd() < 0.1 ? pick(['cap_ku', 'cap_black', 'bucket']) : null, height: 0.94 + rnd() * 0.1 };
}

export class NPCs {
  constructor(world, scene, max = 30) {
    this.world = world; this.scene = scene; this.max = max; this.list = []; this.timer = 0;
    this.edges = world.net.edges.filter(e => e.len > 15 && e.w >= 4);
    this.givers = [];
  }
  makeNPC(look, name) {
    const c = new Character(look); const npc = { c, name, x: 0, z: 0, y: 0, h: 0, speed: 0, mode: 'walk', emote: null, t: Math.random() * 10 };
    const label = makeLabel(name); label.position.y = 2.05; label.visible = false; c.root.add(label); npc.label = label;
    const bub = makeBubble(); bub.position.y = 2.55; c.root.add(bub); npc.bubble = bub;
    this.scene.add(c.root); return npc;
  }
  addGiver(def, pos) {
    const look = randomLook(); if (def.look) Object.assign(look, def.look);
    const npc = this.makeNPC(look, def.giver || def.name); npc.giver = def; npc.static = true; npc.x = pos.x; npc.z = pos.z; npc.h = pos.h || 0; npc.y = this.world.heightAt(pos.x, pos.z);
    const mark = makeLabel('!', '', '#1b1b1b', 'rgba(255,205,40,0.95)'); mark.scale.set(0.5, 0.5, 1); mark.position.y = 2.5; npc.c.root.add(mark); npc.mark = mark;
    npc.label.visible = true; this.givers.push(npc); this.list.push(npc); return npc;
  }
  spawnWalker(px, pz) {
    for (let k = 0; k < 20; k++) {
      const e = this.edges[(Math.random() * this.edges.length) | 0]; const s = Math.random() * e.len; const side = Math.random() < 0.5 ? 1 : -1;
      const lat = side * (e.w / 2 + 1.3 + Math.random() * 0.6); const p = edgePoint(e, s, lat, {});
      const d = Math.hypot(p.x - px, p.z - pz); if (d < 25 || d > 140) continue;
      const sf = this.world.col.surfAt(p.x, p.z); if (sf === SURF.BUILDING || sf === SURF.WATER || sf === SURF.ROAD) continue;
      const look = randomLook(); const name = (look.gender === 'f' ? NAMES_F : NAMES_M)[(Math.random() * 13) | 0];
      const npc = this.makeNPC(look, name);
      Object.assign(npc, { e, s, lat, dir: Math.random() < 0.5 ? 1 : -1, x: p.x, z: p.z, walkSpeed: 1.2 + Math.random() * 0.6 });
      if (Math.random() < 0.15) { npc.static = true; npc.emote = ['phone', 'think', 'phone', 'clap'][(Math.random() * 4) | 0]; }
      this.list.push(npc); return npc;
    }
    return null;
  }
  remove(npc) { npc.c.root.removeFromParent(); npc.c.mesh.geometry.dispose(); }
  nearest(x, z, r = 3) { let best = null, bd = r; for (const n of this.list) { const d = Math.hypot(n.x - x, n.z - z); if (d < bd) { bd = d; best = n; } } return best; }
  update(dt, focus, cam, dangers) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0.4;
      const walkers = this.list.filter(n => !n.giver);
      if (walkers.length < this.max) this.spawnWalker(focus.x, focus.z);
      for (const n of walkers) if (Math.hypot(n.x - focus.x, n.z - focus.z) > 170) { this.remove(n); n.dead = true; }
      this.list = this.list.filter(n => !n.dead);
    }
    const P = {};
    for (const n of this.list) {
      const d2c = Math.hypot(n.x - cam.x, n.z - cam.z);
      const vis = d2c < 150; n.c.root.visible = vis;
      if (!vis) continue;
      // flee from fast vehicles
      let flee = null;
      for (const v of dangers) { const dx = n.x - v.x, dz = n.z - v.z, d = Math.hypot(dx, dz); if (d < 5 && Math.abs(v.speed) > 4) flee = [dx / (d || 1), dz / (d || 1)]; }
      if (flee) { n.x += flee[0] * dt * 5; n.z += flee[1] * dt * 5; n.speed = 5; n.h = Math.atan2(flee[0], flee[1]); n.fleeT = 1.2; if (!n.bubble.visible && Math.random() < 0.02) n.bubble.userData.show(['Whoa! Watch out!', 'ระวังหน่อย!', 'Slow down!!'][(Math.random() * 3) | 0]); }
      else if (n.fleeT > 0) { n.fleeT -= dt; n.speed *= 0.9; }
      else if (!n.static && n.e) {
        const e = n.e; n.s += n.dir * n.walkSpeed * dt;
        if (n.s > e.len || n.s < 0) {
          const node = n.s > e.len ? e.n1 : e.n0; const opts = node.edges.filter(x => x.e !== e && x.e.len > 8 && x.e.w >= 4);
          if (opts.length && Math.random() < 0.85) { const o = opts[(Math.random() * opts.length) | 0]; n.e = o.e; n.dir = o.end === 0 ? 1 : -1; n.s = o.end === 0 ? 0 : o.e.len; n.lat = (Math.random() < 0.5 ? 1 : -1) * (o.e.w / 2 + 1.3 + Math.random() * 0.6); }
          else { n.dir *= -1; n.s = Math.max(0, Math.min(e.len, n.s)); }
        }
        const p = edgePoint(n.e, n.s, n.lat, P);
        const res = this.world.col.resolve(p.x, p.z, 0.3, n.y, 1.7);
        const dx = res.x - n.x, dz = res.z - n.z; const dd = Math.hypot(dx, dz);
        if (dd > 0.001) { const th = Math.atan2(dx, dz); let dh = th - n.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); n.h += dh * Math.min(1, dt * 8); }
        n.speed = dd / Math.max(dt, 1e-3); n.x = res.x; n.z = res.z;
      } else n.speed = 0;
      n.y = this.world.heightAt(n.x, n.z);
      n.c.root.position.set(n.x, n.y, n.z); n.c.root.rotation.y = n.h;
      if (d2c < 70) n.c.animate(dt, { mode: 'walk', speed: Math.min(n.speed, 7), grounded: true, emote: n.speed < 0.2 ? n.emote : null });
      n.label.visible = !!n.giver || d2c < 9;
      if (n.bubble.visible && performance.now() > n.bubble.userData.until) n.bubble.visible = false;
      if (n.mark) n.mark.position.y = 2.5 + Math.sin(performance.now() / 300) * 0.08;
    }
  }
}
