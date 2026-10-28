// Local player controller + third-person camera rig.
import * as THREE from 'three';
import { Character, makeLabel } from './character.js';
import { SURF } from './collision.js';

const MODE_CODE = { walk: 0, drive: 1, ride: 2, swim: 3 };
export class LocalPlayer {
  constructor(scene, world, look) {
    this.world = world; this.scene = scene;
    this.char = new Character(look); scene.add(this.char.root);
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.yaw = 0; this.speed = 0; this.grounded = true; this.mode = 'walk';
    this.vehicle = null; this.emote = null; this.stepAcc = 0; this.sitting = null; this.passenger = null;
  }
  setLook(look) { this.char.setLook(look); if (this.passenger) this.passenger.setLook({ ...look, gender: look.gender === 'm' ? 'f' : 'm', top: 'tee_white', bag: null, hat: 'helmet' }); }
  teleport(x, z, y) { this.exitVehicle(true); this.pos.set(x, y ?? this.world.heightAt(x, z), z); this.vel.set(0, 0, 0); this.sync(); }
  setPassenger(on) {
    if (on && !this.passenger) { this.passenger = new Character({ gender: Math.random() < 0.5 ? 'f' : 'm', top: 'uniform_f', bottom: 'skirt_black', hair: 'ponytail', hat: 'helmet' }); this.scene.add(this.passenger.root); }
    if (!on && this.passenger) { this.passenger.root.removeFromParent(); this.passenger.mesh.geometry.dispose(); this.passenger = null; }
  }
  enterVehicle(v) { this.vehicle = v; v.driver = this; this.mode = v.moto ? 'ride' : 'drive'; this.emote = null; this.sitting = null; }
  exitVehicle(force = false) {
    const v = this.vehicle; if (!v) return false;
    if (!force && Math.abs(v.speed) > 4) return false;
    // find a free spot beside the vehicle (left side first, keep-left country → step out on the left)
    const side = [[1, 0], [-1, 0], [0, -1], [0, 1]]; const hx = Math.cos(v.h), hz = -Math.sin(v.h);
    let px = v.x, pz = v.z;
    for (const [a, b] of side) { const off = v.moto ? 1.0 : 1.8; const fx = Math.sin(v.h), fz = Math.cos(v.h); const x = v.x + hx * a * off + fx * b * 3, z = v.z + hz * a * off + fz * b * 3; if (!this.world.col.blocked(x, z, 0.4)) { px = x; pz = z; break; } }
    this.pos.set(px, this.world.heightAt(px, pz), pz); this.yaw = v.h; v.driver = null; v.speed = 0; v.vx = v.vz = 0; this.vehicle = null; this.mode = 'walk'; this.setPassenger(false);
    return true;
  }
  update(dt, input, rig, others) {
    const W = this.world;
    if (this.vehicle) {
      const v = this.vehicle; const m = input.move();
      v.drive(dt, { throttle: m.y, steer: -m.x, handbrake: input.down('Space') }, W, others);
      // seat the character
      const seat = v.seatWorld(new THREE.Vector3());
      this.pos.set(v.x, v.y, v.z);
      const off = v.moto ? 0.93 : 0.47;
      this.char.root.position.set(seat.x, seat.y - off, seat.z);
      this.char.root.rotation.set(v.pitch, v.h, v.roll, 'YXZ');
      this.speed = Math.abs(v.speed); this.yaw = v.h;
      this.char.animate(dt, { mode: v.type === 'bicycle' ? 'bike' : this.mode === 'ride' ? 'ride' : 'drive', speed: Math.abs(v.speed), steer: v.steer / 0.5, sport: v.type === 'sport' });
      if (this.passenger) {
        const fx = Math.sin(v.h), fz = Math.cos(v.h);
        this.passenger.root.position.set(seat.x - fx * 0.45, seat.y - off + 0.05, seat.z - fz * 0.45); this.passenger.root.rotation.set(v.pitch, v.h, v.roll, 'YXZ');
        this.passenger.animate(dt, { mode: 'ride', speed: 0, steer: 0 });
      }
      return;
    }
    const m = input.move(); const st = rig.game ? rig.game.profile.stats : { energy: 100 };
    if ((m.x || m.y) && this.sitting) { this.sitting = null; this.emote = null; }
    if ((m.x || m.y) && this.emote && this.emote !== 'phone') this.emote = null;
    const f = new THREE.Vector3(Math.sin(rig.yaw), 0, Math.cos(rig.yaw)), r = new THREE.Vector3(-Math.cos(rig.yaw), 0, Math.sin(rig.yaw));
    const wish = f.multiplyScalar(m.y).add(r.multiplyScalar(m.x));
    const surf = W.col.surfAt(this.pos.x, this.pos.z);
    const ground = W.heightAt(this.pos.x, this.pos.z);
    const wl = (surf === SURF.WATER || surf === SURF.POOL) ? W.waterLevel(this.pos.x, this.pos.z) : -100;
    const swimming = wl - ground > 1.25;
    let maxSpd = input.down('ControlLeft') || input.down('KeyC') ? 1.5 : 3.8; // walk 1.5 m/s · jog 3.8 m/s · sprint ~6.8 m/s (human ranges)
    if ((input.down('ShiftLeft') || input.down('ShiftRight') || input.touch.running) && st.energy > 6) maxSpd = 6.8 * (1 + (rig.game ? rig.game.profile.skills.fit : 0) / 400);
    if (st.energy < 10) maxSpd = Math.min(maxSpd, 2.6);
    if (swimming) maxSpd = 2.2 * (input.down('ShiftLeft') ? 1.4 : 1);
    if (this.emote === 'sit' || this.emote === 'sleep' || this.emote === 'pushup' || this.emote === 'work') maxSpd = 0;
    maxSpd *= this.speedMul || 1;
    const accel = this.grounded || swimming ? 7 : 1.5; // first-order response: ~0.4 s to reach target speed on foot, little air control
    this.vel.x += (wish.x * maxSpd - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (wish.z * maxSpd - this.vel.z) * Math.min(1, accel * dt);
    if (wish.lengthSq() > 0.01) { const ty = Math.atan2(wish.x, wish.z); let d = ty - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += d * Math.min(1, dt * 9); }
    // vertical
    if (swimming) { this.mode = 'swim'; const target = wl - 1.2; this.pos.y += (target - this.pos.y) * Math.min(1, dt * 4); this.vel.y = 0; this.grounded = false; }
    else {
      this.mode = 'walk';
      if (this.grounded && input.hit('Space') && !this.sitting) { this.vel.y = 6.0 * (this.jumpMul || 1); this.grounded = false; if (this.onJump) this.onJump(); }
      this.vel.y -= 22 * dt; this.pos.y += this.vel.y * dt;
    }
    // horizontal move + collisions
    const ox = this.pos.x, oz = this.pos.z;
    let nx = ox + this.vel.x * dt, nz = oz + this.vel.z * dt;
    const b = W.bounds; nx = Math.max(b.minX + 3, Math.min(b.maxX - 3, nx)); nz = Math.max(b.minZ + 3, Math.min(b.maxZ - 3, nz));
    const res = W.col.resolve(nx, nz, 0.32, this.pos.y, 1.7);
    // vehicles as obstacles
    let rx = res.x, rz = res.z;
    for (const o of others) for (const [cx, cz, cr] of (o.circles ? o.circles() : [[o.x, o.z, o.r || 1]])) { const dx = rx - cx, dz = rz - cz, d = Math.hypot(dx, dz), mm = cr + 0.3; if (d < mm && d > 1e-4) { rx += dx / d * (mm - d); rz += dz / d * (mm - d); } }
    const ng = W.heightAt(rx, rz);
    if (!swimming && ng - this.pos.y > 1.0 && this.grounded) { rx = ox; rz = oz; this.vel.x = this.vel.z = 0; } // too high a step
    this.pos.x = rx; this.pos.z = rz;
    const g2 = W.heightAt(this.pos.x, this.pos.z);
    if (!swimming) {
      if (this.pos.y <= g2 + 0.02 || (this.grounded && this.pos.y - g2 < 0.5 && this.vel.y <= 0)) { this.pos.y = g2; this.vel.y = 0; this.grounded = true; }
      else this.grounded = false;
    }
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    if (this.sitting) { this.pos.set(this.sitting.x, this.sitting.y - 0.47, this.sitting.z); this.yaw = this.sitting.rot; this.speed = 0; }
    this.sync();
    const accelNow = (this.speed - (this._ps ?? this.speed)) / Math.max(1e-3, dt); this._ps = this.speed; this._acc = (this._acc ?? 0) + (accelNow - (this._acc ?? 0)) * Math.min(1, dt * 6);
    let dy = this.yaw - (this._py ?? this.yaw); dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this._py = this.yaw; this._turn = (this._turn ?? 0) + (dy / Math.max(1e-3, dt) - (this._turn ?? 0)) * Math.min(1, dt * 6);
    this.char.animate(dt, { accel: this._acc, turn: this._turn, mode: swimming ? 'swim' : this.emote === 'sleep' ? 'sleep' : 'walk', speed: this.speed, grounded: this.grounded || swimming, vy: this.vel.y, emote: this.speed < 0.3 ? this.emote : null });
    // footsteps come from the animation's heel strikes (char.sfx); here: landing impact, hard stops
    if (!this.grounded && !swimming) this._fall = Math.min(this._fall || 0, this.vel.y);
    else { if (this._fall < -2.5 && this.onLand) this.onLand(-this._fall); this._fall = 0; }
    if (this.grounded && (this._spPrev || 0) > 4.2 && this.speed < 1.4) { if (this.onStop) this.onStop(); this._spPrev = 0; } else this._spPrev = this.grounded ? Math.max(this.speed, (this._spPrev || 0) * Math.exp(-dt * 5)) : 0;
    if (swimming && this.speed > 0.5 && Math.random() < dt * 1.5 && rig.audio) rig.audio.splash();
  }
  sync() { this.char.root.position.copy(this.pos); this.char.root.rotation.set(0, this.yaw, 0); }
  netState() {
    const v = this.vehicle;
    if (v) return [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2), +v.h.toFixed(3), MODE_CODE[this.mode], +v.speed.toFixed(2), v.type, v.color, +v.steer.toFixed(2), this.passenger ? 'p' : '', 1];
    return [+this.pos.x.toFixed(2), +this.pos.y.toFixed(2), +this.pos.z.toFixed(2), +this.yaw.toFixed(3), MODE_CODE[this.mode] ?? 0, +this.speed.toFixed(2), '', '', 0, this.emote || '', this.grounded ? 1 : 0];
  }
}

export class CameraRig {
  constructor(camera, world) {
    this.cam = camera; this.world = world; this.yaw = Math.PI / 2; this.pitch = 0.32; this.dist = 4.6; this.cur = 4.6; this.sens = 0.0024; this.idle = 0; this.first = false; this.shake = 0;
    this.target = new THREE.Vector3(); this.fov = 62; this.invertY = false;
  }
  update(dt, input, player) {
    const [mx, my] = input.consumeMouse(); const wheel = input.consumeWheel();
    if (mx || my) this.idle = 0; else this.idle += dt;
    this.yaw -= mx * this.sens; this.pitch += my * this.sens * (this.invertY ? -1 : 1); this.pitch = Math.max(-0.75, Math.min(1.3, this.pitch));
    const v = player.vehicle;
    const want = v ? (v.moto ? 5.6 : 7.4) : 4.4;
    if (wheel) this.dist = Math.max(1.6, Math.min(16, this.dist + wheel * 0.8));
    if (this._lastVeh !== !!v) { this.dist = want; this._lastVeh = !!v; }
    if (v && this.idle > 1.0 && Math.abs(v.speed) > 2) { let d = v.h + (v.speed < 0 ? Math.PI : 0) - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += d * (1 - Math.exp(-dt * 2.2)); this.pitch += (0.22 - this.pitch) * (1 - Math.exp(-dt * 1.5)); }
    const tgt = this.target.copy(v ? new THREE.Vector3(v.x, v.y + (v.moto ? 1.5 : 1.7), v.z) : player.pos.clone().add(new THREE.Vector3(0, player.mode === 'swim' ? 1.4 : 1.55, 0)));
    if (this.first && !v) {
      this.cam.position.copy(player.pos).add(new THREE.Vector3(Math.sin(player.yaw) * 0.18, 1.62, Math.cos(player.yaw) * 0.18));
      this.cam.rotation.set(0, 0, 0); this.cam.lookAt(this.cam.position.x + Math.sin(this.yaw) * Math.cos(this.pitch), this.cam.position.y - Math.sin(this.pitch), this.cam.position.z + Math.cos(this.yaw) * Math.cos(this.pitch));
      player.char.root.visible = false;
    } else {
      player.char.root.visible = true;
      const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      const dx = -Math.sin(this.yaw) * cp, dy = sp, dz = -Math.cos(this.yaw) * cp;
      let d = this.dist;
      const hit = this.world.col.raySegment(tgt.x, tgt.y, tgt.z, tgt.x + dx * d, tgt.y + dy * d, tgt.z + dz * d, 0.35);
      if (hit < 1) d = Math.max(0.8, d * hit - 0.25);
      this.cur += (d - this.cur) * (1 - Math.exp(-dt * (d < this.cur ? 18 : 4)));
      const p = this.cam.position.set(tgt.x + dx * this.cur, tgt.y + dy * this.cur, tgt.z + dz * this.cur);
      const gh = this.world.groundHeight(p.x, p.z) + 0.35; if (p.y < gh) p.y = gh;
      if (this.shake > 0) { p.x += (Math.random() - 0.5) * this.shake; p.y += (Math.random() - 0.5) * this.shake; this.shake = Math.max(0, this.shake - dt * 2); }
      this.cam.lookAt(tgt);
    }
    const fovT = 62 + (v ? Math.min(14, Math.abs(v.speed) * 0.35) : 0);
    this.fov += (fovT - this.fov) * (1 - Math.exp(-dt * 3)); if (Math.abs(this.cam.fov - this.fov) > 0.05) { this.cam.fov = this.fov; this.cam.updateProjectionMatrix(); }
  }
}
