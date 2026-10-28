// Keyboard / mouse / touch input
export class Input {
  constructor(canvas) {
    this.keys = new Set(); this.pressed = new Set(); this.canvas = canvas;
    this.mdx = 0; this.mdy = 0; this.wheel = 0; this.locked = false; this.enabled = true; this.typing = false;
    this.touch = { active: false, mx: 0, my: 0, look: null, joyId: null, lookId: null, buttons: new Set() };
    // touch UI only when touch is the primary input (a touchscreen laptop with a mouse keeps mouse-look + pointer lock)
    this.isTouch = matchMedia('(pointer: coarse)').matches || (('ontouchstart' in window) && !matchMedia('(any-pointer: fine)').matches);
    addEventListener('keydown', (e) => {
      if (this.typing) return;
      const k = e.code;
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F1', 'F2', 'F3'].includes(k)) e.preventDefault();
      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('mousedown', (e) => { if (!this.isTouch && this.enabled && !this.locked && e.button === 0) this.requestLock(); });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; });
    addEventListener('mousemove', (e) => { if (this.locked) { this.mdx += e.movementX; this.mdy += e.movementY; } else if (this.drag) { this.mdx += e.movementX; this.mdy += e.movementY; } });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousedown', (e) => { if (e.button === 2) this.drag = true; });
    addEventListener('mouseup', (e) => { if (e.button === 2) this.drag = false; });
    canvas.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    if (this.isTouch) this.setupTouch();
  }
  requestLock() { try { const p = this.canvas.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch(() => this.canvas.requestPointerLock()); } catch (e) { try { this.canvas.requestPointerLock(); } catch (_) { } } }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
  down(k) { return this.enabled && !this.typing && (this.keys.has(k) || this.touch.buttons.has(k)); }
  hit(k) { if (!this.enabled || this.typing) return false; if (this.pressed.has(k)) { this.pressed.delete(k); return true; } return false; }
  consumeMouse() { const r = [this.mdx, this.mdy]; this.mdx = 0; this.mdy = 0; return r; }
  consumeWheel() { const w = this.wheel; this.wheel = 0; return w; }
  endFrame() { this.pressed.clear(); }
  move() { // returns {x (right), y (forward)}
    let x = 0, y = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1; if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1; if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.touch.active) { x += this.touch.mx; y += this.touch.my; }
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }
  setupTouch() {
    const root = document.getElementById('touch'); if (!root) return; root.classList.remove('hidden');
    const joy = document.getElementById('joy'), knob = document.getElementById('joyKnob');
    const t = this.touch;
    const joyStart = (e) => { const tt = e.changedTouches[0]; t.joyId = tt.identifier; const r = joy.getBoundingClientRect(); t.cx = r.left + r.width / 2; t.cy = r.top + r.height / 2; t.active = true; joyMove(e); e.preventDefault(); };
    const joyMove = (e) => { for (const tt of e.changedTouches) if (tt.identifier === t.joyId) { let dx = (tt.clientX - t.cx) / 50, dy = (tt.clientY - t.cy) / 50; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } t.mx = dx; t.my = -dy; knob.style.transform = `translate(${dx * 40}px,${dy * 40}px)`; t.running = l > 0.92; } e.preventDefault(); };
    const joyEnd = (e) => { for (const tt of e.changedTouches) if (tt.identifier === t.joyId) { t.active = false; t.mx = t.my = 0; t.joyId = null; knob.style.transform = ''; t.running = false; } };
    joy.addEventListener('touchstart', joyStart, { passive: false }); joy.addEventListener('touchmove', joyMove, { passive: false }); joy.addEventListener('touchend', joyEnd); joy.addEventListener('touchcancel', joyEnd);
    this.canvas.addEventListener('touchstart', (e) => { for (const tt of e.changedTouches) if (t.lookId === null) { t.lookId = tt.identifier; t.lx = tt.clientX; t.ly = tt.clientY; } }, { passive: true });
    this.canvas.addEventListener('touchmove', (e) => { for (const tt of e.changedTouches) if (tt.identifier === t.lookId) { this.mdx += (tt.clientX - t.lx) * 1.6; this.mdy += (tt.clientY - t.ly) * 1.6; t.lx = tt.clientX; t.ly = tt.clientY; } }, { passive: true });
    const lookEnd = (e) => { for (const tt of e.changedTouches) if (tt.identifier === t.lookId) t.lookId = null; };
    this.canvas.addEventListener('touchend', lookEnd); this.canvas.addEventListener('touchcancel', lookEnd);
    root.querySelectorAll('[data-key]').forEach(btn => {
      const k = btn.dataset.key;
      btn.addEventListener('touchstart', (e) => { t.buttons.add(k); this.pressed.add(k); e.preventDefault(); }, { passive: false });
      btn.addEventListener('touchend', () => t.buttons.delete(k)); btn.addEventListener('touchcancel', () => t.buttons.delete(k));
    });
  }
}
