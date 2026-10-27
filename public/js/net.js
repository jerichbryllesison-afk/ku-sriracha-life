// Multiplayer client (socket.io). Falls back to offline single-player when no server is reachable.
export class Net {
  constructor() {
    this.online = false; this.socket = null; this.id = null; this.handlers = {}; this.timeOffset = 0; this.ping = 0;
  }
  on(ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); }
  emitLocal(ev, d) { for (const fn of this.handlers[ev] || []) fn(d); }
  now() { return Date.now() + this.timeOffset; }
  connect(token, hello) {
    return new Promise((resolve) => {
      if (typeof window.io !== 'function') { resolve({ online: false, reason: 'no-server' }); return; }
      let done = false; const finish = (r) => { if (!done) { done = true; resolve(r); } };
      const s = window.io({ auth: { token }, transports: ['websocket', 'polling'], reconnectionDelay: 1500, timeout: 6000 });
      this.socket = s;
      const timer = setTimeout(() => finish({ online: false, reason: 'timeout' }), 7000);
      s.on('connect', () => { s.emit('hello', hello); });
      s.on('welcome', (w) => { clearTimeout(timer); this.online = true; this.id = w.id; this.timeOffset = w.serverTime - Date.now(); finish({ online: true, ...w }); this.emitLocal('welcome', w); });
      s.on('full', (d) => { clearTimeout(timer); finish({ online: false, reason: 'full', ...d }); s.disconnect(); });
      s.on('connect_error', () => { /* keep trying silently until timeout */ });
      s.on('disconnect', () => { this.online = false; this.emitLocal('offline'); });
      s.io.on('reconnect', () => { s.emit('hello', hello); });
      for (const ev of ['pjoin', 'pleave', 'pinfo', 'snap', 'chat', 'money', 'online', 'kick', 'sys']) s.on(ev, (d) => this.emitLocal(ev, d));
      setInterval(() => { if (!this.online) return; const t0 = performance.now(); s.timeout(4000).emit('ping', 0, (err) => { if (!err) this.ping = Math.round(performance.now() - t0); }); }, 5000);
    });
  }
  send(ev, d) { if (this.online && this.socket) this.socket.emit(ev, d); }
  sendVolatile(ev, d) { if (this.online && this.socket) this.socket.volatile.emit(ev, d); }
  rpc(ev, d, ms = 6000) {
    return new Promise((resolve) => {
      if (!this.online || !this.socket) return resolve({ ok: false, err: 'Offline' });
      this.socket.timeout(ms).emit(ev, d, (err, res) => resolve(err ? { ok: false, err: 'Server timeout' } : res));
    });
  }
}
