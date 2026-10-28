// Other online players: interpolated characters, vehicles, name tags, chat bubbles.
import * as THREE from 'three';
import { Character, makeLabel, makeBubble } from './character.js';
import { Vehicle } from './vehicles.js';

const MODES = ['walk', 'drive', 'ride', 'swim'];
export class Remotes {
  constructor(scene, world, mats, net) { this.scene = scene; this.world = world; this.mats = mats; this.net = net; this.map = new Map(); }
  add(info) {
    let r = this.map.get(info.id);
    if (!r) {
      const c = new Character(info.look || {}); this.scene.add(c.root);
      const label = makeLabel(info.name || 'Player', `Lv ${info.level || 1}`); label.position.y = 2.1; c.root.add(label);
      const bubble = makeBubble(); bubble.position.y = 2.65; c.root.add(bubble);
      r = { id: info.id, c, label, bubble, buf: [], veh: null, vkey: '', info: {}, x: 0, z: 0, y: 0, passenger: null };
      this.map.set(info.id, r);
    }
    const lookChanged = JSON.stringify(r.info.look) !== JSON.stringify(info.look);
    r.info = { ...r.info, ...info };
    if (lookChanged && info.look) r.c.setLook(info.look);
    r.label.userData.update(r.info.name || 'Player', `Lv ${r.info.level || 1}`);
    return r;
  }
  remove(id) { const r = this.map.get(id); if (!r) return; r.c.root.removeFromParent(); r.c.mesh.geometry.dispose(); if (r.veh) r.veh.dispose(); if (r.passenger) r.passenger.root.removeFromParent(); this.map.delete(id); }
  snap(s, myId) {
    for (const e of s.p) {
      const [id, ...st] = e; if (id === myId) continue; const r = this.map.get(id); if (!r) continue;
      r.buf.push({ t: s.t, st }); if (r.buf.length > 30) r.buf.shift();
    }
  }
  chat(id, text) { const r = this.map.get(id); if (r) r.bubble.userData.show(text); }
  vehicles() { const out = []; for (const r of this.map.values()) if (r.veh) out.push(r.veh); return out; }
  bodies() { const out = []; for (const r of this.map.values()) if (!r.veh) out.push({ x: r.x, z: r.z, r: 0.35 }); return out; }
  update(dt, cam) {
    const rt = this.net.now() - 160;
    for (const r of this.map.values()) {
      const b = r.buf; if (!b.length) { r.c.root.visible = false; continue; }
      let a = b[0], c = b[b.length - 1];
      for (let i = 0; i < b.length - 1; i++) if (b[i].t <= rt && b[i + 1].t >= rt) { a = b[i]; c = b[i + 1]; break; }
      const span = c.t - a.t; const k = span > 0 ? Math.max(0, Math.min(1.2, (rt - a.t) / span)) : 1;
      const A = a.st, C = c.st; const L = (i) => A[i] + (C[i] - A[i]) * k;
      let dh = C[3] - A[3]; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      const x = L(0), y = L(1), z = L(2), h = A[3] + dh * k, mode = MODES[C[4]] || 'walk', speed = L(5), vtype = C[6], vcolor = C[7], steer = C[8] || 0, emote = C[9] || null, grounded = C[10];
      r.x = x; r.z = z; r.y = y;
      const dist = Math.hypot(x - cam.x, z - cam.z); r.c.root.visible = dist < 400;
      const key = vtype ? vtype + '|' + vcolor : '';
      if (key !== r.vkey) { if (r.veh) { r.veh.dispose(); r.veh = null; } if (vtype) { try { r.veh = new Vehicle(vtype, vcolor || '#cccccc', this.mats); this.scene.add(r.veh.group); } catch (e) { r.veh = null; } } r.vkey = key; }
      if (r.veh) {
        r.veh.group.visible = dist < 400; r.veh.setNet(x, y, z, h, speed, steer, dt);
        const seat = r.veh.seatWorld(new THREE.Vector3()); const off = r.veh.moto ? 0.93 : 0.47;
        r.c.root.position.set(seat.x, seat.y - off, seat.z); r.c.root.rotation.set(r.veh.pitch, h, r.veh.roll, 'YXZ');
        if (dist < 90) r.c.animate(dt, { mode: vtype === 'bicycle' ? 'bike' : mode === 'ride' ? 'ride' : 'drive', speed: Math.abs(speed), steer: steer / 0.5, sport: vtype === 'sport' });
        if (emote === 'p' && !r.passenger) { r.passenger = new Character({ gender: 'f', top: 'uniform_f', bottom: 'skirt_black', hair: 'ponytail', hat: 'helmet' }); this.scene.add(r.passenger.root); }
        if (emote !== 'p' && r.passenger) { r.passenger.root.removeFromParent(); r.passenger = null; }
        if (r.passenger) { const fx = Math.sin(h), fz = Math.cos(h); r.passenger.root.position.set(seat.x - fx * 0.45, seat.y - off + 0.05, seat.z - fz * 0.45); r.passenger.root.rotation.set(0, h, r.veh.roll, 'YXZ'); r.passenger.animate(dt, { mode: 'ride', speed: 0 }); }
      } else {
        r.c.root.position.set(x, y, z); r.c.root.rotation.set(0, h, 0); r.c.root.visible = emote !== 'pass'; // riding as a passenger: hidden (shown on the driver's seat)
        if (dist < 90) r.c.animate(dt, { mode: mode === 'swim' ? 'swim' : emote === 'sleep' ? 'sleep' : 'walk', speed, grounded: !!grounded || mode === 'swim', vy: 0, emote: speed < 0.3 ? emote : null });
      }
      r.label.visible = dist < 60;
      if (r.bubble.visible && performance.now() > r.bubble.userData.until) r.bubble.visible = false;
    }
  }
}
