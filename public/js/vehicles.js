// Drivable vehicles: arcade physics with drift, terrain following, collisions, wheels, lights.
import * as THREE from 'three';
import { buildVehicleModel } from './vehicle-models.js';
import { VEHICLES } from '../shared/catalog.js';
import { SURF } from './collision.js';

const SPEC = {
  bicycle: { top: 9, accel: 3.2, brake: 7, steer: 0.62, wb: 1.05, r: 0.45, tank: 0 },
  wave: { top: 24, accel: 6.5, brake: 10, steer: 0.55, wb: 1.25, r: 0.5, tank: 4 },
  click: { top: 27, accel: 7.5, brake: 10, steer: 0.55, wb: 1.25, r: 0.5, tank: 5 },
  sport: { top: 40, accel: 11, brake: 13, steer: 0.5, wb: 1.4, r: 0.55, tank: 12 },
  hatch: { top: 36, accel: 7, brake: 11, steer: 0.55, wb: 2.5, r: 0.95, tank: 35 },
  sedan: { top: 45, accel: 9, brake: 12, steer: 0.5, wb: 2.8, r: 1.0, tank: 45 },
  pickup: { top: 38, accel: 7.5, brake: 11, steer: 0.48, wb: 3.1, r: 1.0, tank: 55 },
  super: { top: 70, accel: 16, brake: 18, steer: 0.45, wb: 2.6, r: 1.05, tank: 60 },
  songthaew: { top: 26, accel: 5, brake: 9, steer: 0.45, wb: 3.1, r: 1.0, tank: 50 },
};
export const isBike = (t) => ['bicycle', 'wave', 'click', 'sport'].includes(t);

export class Vehicle {
  constructor(type, color, mats, opts = {}) {
    this.type = type; this.color = color; this.spec = SPEC[type] || SPEC.hatch;
    const cat = VEHICLES[type]; if (cat) { this.spec = { ...this.spec, top: cat.top, accel: cat.accel }; }
    this.model = buildVehicleModel(type, color, mats);
    this.group = this.model.group; this.group.rotation.order = 'YXZ';
    this.x = 0; this.z = 0; this.y = 0; this.h = 0; this.speed = 0; this.vx = 0; this.vz = 0; this.vy = 0; this.steer = 0; this.pitch = 0; this.roll = 0;
    this.fuel = opts.fuel ?? 1; this.owner = opts.owner || null; this.shared = !!opts.shared; this.driver = null; this.wheelRot = 0;
    this.moto = this.model.moto; this.horn = 0; this.lights = false; this.odo = 0; this.crash = 0; this.sunk = false;
    this.id = opts.id || Math.random().toString(36).slice(2, 9);
  }
  place(x, z, h, world) { this.x = x; this.z = z; this.h = h; this.y = world ? world.heightAt(x, z) : 0; this.speed = 0; this.vx = this.vz = 0; this.vy = 0; this.sunk = false; this.sync(0); }
  get radius() { return this.spec.r; }
  circles() { // collision circles in world space
    if (this.moto) return [[this.x, this.z, 0.45]];
    const f = this.spec.wb * 0.55, s = Math.sin(this.h), c = Math.cos(this.h);
    return [[this.x + s * f, this.z + c * f, this.spec.r], [this.x - s * f, this.z - c * f, this.spec.r]];
  }
  // input: { throttle (-1..1), steer (-1..1, + = left), handbrake, boost }
  drive(dt, inp, world, others = []) {
    const S = this.spec; const fwdX = Math.sin(this.h), fwdZ = Math.cos(this.h);
    let thr = inp.throttle;
    if (S.tank && this.fuel <= 0) thr = Math.min(thr, 0) * 0.3;
    if (this.sunk) thr = 0;
    // longitudinal
    if (thr > 0) { if (this.speed < -0.3) this.speed += S.brake * dt * thr; else this.speed += S.accel * thr * dt * Math.max(0.05, 1 - this.speed / S.top); }
    else if (thr < 0) { if (this.speed > 0.3) this.speed -= S.brake * dt * -thr; else this.speed -= S.accel * 0.6 * dt * -thr * (this.speed > -S.top * 0.3 ? 1 : 0); }
    const drag = 0.12 * this.speed * Math.abs(this.speed) / S.top + Math.sign(this.speed) * (thr === 0 ? 1.4 : 0.3);
    if (Math.abs(this.speed) < Math.abs(drag * dt)) this.speed = 0; else this.speed -= drag * dt;
    if (inp.handbrake) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), (this.moto ? 8 : 5) * dt);
    // steering
    const steerMax = S.steer / (1 + Math.abs(this.speed) * (this.moto ? 0.045 : 0.035));
    this.steer += (inp.steer * steerMax - this.steer) * Math.min(1, dt * 7);
    const yawRate = this.speed / S.wb * Math.tan(this.steer) * (inp.handbrake && !this.moto ? 1.35 : 1);
    this.h += yawRate * dt;
    // velocity with lateral grip (drift)
    const grip = inp.handbrake && !this.moto && Math.abs(this.speed) > 6 ? 1.6 : (this.moto ? 14 : 9);
    const tx = Math.sin(this.h) * this.speed, tz = Math.cos(this.h) * this.speed;
    const k = Math.min(1, grip * dt); this.vx += (tx - this.vx) * k; this.vz += (tz - this.vz) * k;
    this.drift = Math.abs(this.vx * Math.cos(this.h) - this.vz * Math.sin(this.h));
    let nx = this.x + this.vx * dt, nz = this.z + this.vz * dt;
    // world bounds
    const b = world.bounds; nx = Math.max(b.minX + 4, Math.min(b.maxX - 4, nx)); nz = Math.max(b.minZ + 4, Math.min(b.maxZ - 4, nz));
    // collisions
    this.x = nx; this.z = nz; let hitN = null;
    for (let it = 0; it < 2; it++) {
      for (const [cx, cz, r] of this.circles()) {
        const res = world.col.resolve(cx, cz, r, this.y + 0.3, 1.3);
        if (res.hit) { this.x += res.x - cx; this.z += res.z - cz; hitN = [res.nx, res.nz]; }
      }
      for (const o of others) {
        if (o === this) continue;
        for (const [ax, az, ar] of this.circles()) for (const [bx, bz, br] of (o.circles ? o.circles() : [[o.x, o.z, o.r || 1]])) {
          const dx = ax - bx, dz = az - bz, d = Math.hypot(dx, dz), m = ar + br;
          if (d < m && d > 1e-4) { const p = (m - d) * 0.6; this.x += dx / d * p; this.z += dz / d * p; hitN = [dx / d, dz / d]; if (o.bump) o.bump(-dx / d * p, -dz / d * p, this); }
        }
      }
    }
    if (hitN) {
      const vn = this.vx * hitN[0] + this.vz * hitN[1];
      if (vn < 0) { this.vx -= hitN[0] * vn * 1.25; this.vz -= hitN[1] * vn * 1.25; const impact = -vn; if (impact > 3) { this.crash = Math.min(1, impact / 15); } this.speed *= impact > 6 ? 0.35 : 0.8; }
    }
    // terrain following
    const L = this.moto ? 0.65 : this.spec.wb * 0.55, W = this.moto ? 0 : 0.8;
    const sF = world.heightAt(this.x + fwdX * L, this.z + fwdZ * L), sB = world.heightAt(this.x - fwdX * L, this.z - fwdZ * L);
    let ground = (sF + sB) / 2;
    let rollT = 0;
    if (W) { const rx = Math.cos(this.h), rz = -Math.sin(this.h); const sL = world.heightAt(this.x + rx * W, this.z + rz * W), sR = world.heightAt(this.x - rx * W, this.z - rz * W); ground = (sF + sB + sL + sR) / 4; rollT = Math.atan2(sL - sR, 2 * W); }
    const pitchT = Math.atan2(sB - sF, 2 * L);
    if (this.y > ground + 0.35) { this.vy -= 22 * dt; this.y += this.vy * dt; if (this.y <= ground) { this.y = ground; this.vy = 0; } this.air = true; }
    else { const prev = this.y; this.y += (ground - this.y) * Math.min(1, dt * 18); this.vy = (this.y - prev) / Math.max(dt, 1e-3); if (this.vy < 0) this.vy = 0; this.air = false; }
    this.pitch += (pitchT - this.pitch) * Math.min(1, dt * 10);
    const leanT = this.moto ? -this.steer * Math.min(1, Math.abs(this.speed) / 7) * 0.9 * Math.sign(this.speed || 1) : rollT - this.steer * Math.min(1, Math.abs(this.speed) / 20) * 0.05;
    this.roll += (leanT - this.roll) * Math.min(1, dt * 6);
    // water: sink
    const s = world.col.surfAt(this.x, this.z);
    if (s === SURF.WATER && world.waterLevel(this.x, this.z) - ground > 1.0) { this.sunk = true; this.speed *= 0.9; this.y = Math.max(ground, world.waterLevel(this.x, this.z) - 1.2); }
    // fuel + odometer
    const dist = Math.hypot(this.vx, this.vz) * dt; this.odo += dist;
    if (S.tank) this.fuel = Math.max(0, this.fuel - dist / (this.moto ? 14000 : 9000));
    this.sync(dt);
  }
  bump(dx, dz) { this.x += dx; this.z += dz; this.vx += dx * 3; this.vz += dz * 3; }
  sync(dt) {
    this.group.position.set(this.x, this.y, this.z);
    this.group.rotation.set(this.pitch, this.h, this.roll);
    const spd = this.speed;
    this.wheelRot += spd * dt;
    for (const w of this.model.wheels) { w.mesh.rotation.x = this.wheelRot / w.r; if (w.front) w.pivot.rotation.y = this.steer; }
  }
  // remote/net driven
  setNet(x, y, z, h, speed, steer, dt) { this.x = x; this.y = y; this.z = z; this.h = h; this.speed = speed; this.steer = steer; this.pitch *= 0.9; this.roll = this.moto ? -steer * Math.min(1, Math.abs(speed) / 7) * 0.9 : 0; this.sync(dt); }
  seatWorld(out = new THREE.Vector3()) { const s = this.model.seat; out.set(s.x, s.y, s.z); return this.group.localToWorld(out); }
  dispose() { this.group.removeFromParent(); this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
}
