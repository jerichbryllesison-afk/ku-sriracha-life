// Proximity voice chat (opt-in). WebRTC peer-to-peer audio between players within ~40 m; the server only relays signalling
// between nearby players who switched voice on. Your microphone is never opened unless you turn it on yourself.
// Voice comes out of the other player's position (3-D panner + distance fade). Needs HTTPS or localhost for the mic.
// Limits: no TURN relay server, so some strict networks (some mobile carriers / company Wi-Fi) cannot connect directly.
import { L2 } from './i18n.js';

const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
const NEAR = 40, FAR = 55, MAX_PEERS = 6;

export class Voice {
  constructor({ net, remotes, audio, ui, player }) {
    Object.assign(this, { net, remotes, audio, ui, player });
    this.on = false; this.mic = false; this.stream = null; this.peers = new Map(); this.t = 0; this.speaking = new Set();
    net.on('rtc', (m) => this.signal(m).catch(e => console.warn('rtc', e)));
    net.on('pleave', (id) => this.close(id, true));
    net.on('pinfo', (p) => { if (p && !p.voice && this.peers.has(p.id)) this.close(p.id, true); }); // they switched voice off
    net.on('offline', () => { for (const id of [...this.peers.keys()]) this.close(id, true); });
    net.on('welcome', () => { if (this.on) this.net.send('voice', true); });
  }
  get state() { return !this.on ? 'off' : this.mic ? 'mic' : 'listen'; }
  async cycle() { if (!this.on) return this.enable(); if (!this.mic) return this.setMic(true); this.disable(); }
  enable() { if (!this.net.online) { this.ui.toast(L2('Voice chat needs the online server', 'แชทเสียงต้องออนไลน์'), 'bad'); return; } this.audio.init(); this.audio.resume(); this.on = true; this.net.send('voice', true); this.ui.toast(L2('🔈 Voice on — you can hear players near you (tap again to talk)', '🔈 เปิดเสียงแล้ว — ได้ยินผู้เล่นที่อยู่ใกล้ (แตะอีกครั้งเพื่อเปิดไมค์)')); this.onChange && this.onChange(); }
  disable() { this.setMic(false, true); for (const id of [...this.peers.keys()]) this.close(id); this.on = false; this.net.send('voice', false); /* bye first, while the server still relays for us */ this.ui.toast(L2('🔇 Voice chat off', '🔇 ปิดแชทเสียงแล้ว')); this.onChange && this.onChange(); }
  async setMic(on, quiet) {
    if (on) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { this.ui.toast(L2('This browser cannot use a microphone here (needs HTTPS)', 'เบราว์เซอร์นี้ใช้ไมค์ไม่ได้ (ต้องเป็น HTTPS)'), 'bad'); return false; }
      try { this.stream = this.stream || await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
      catch (e) { this.ui.toast(L2('Microphone permission was not given', 'ไม่ได้รับอนุญาตให้ใช้ไมค์'), 'bad'); return false; }
      const tr = this.stream.getAudioTracks()[0]; for (const p of this.peers.values()) if (p.sender) p.sender.replaceTrack(tr).catch(() => { });
      this.mic = true; if (!this.on) this.enable(); else if (!quiet) this.ui.toast(L2('🎤 Mic on — people near you can hear you', '🎤 เปิดไมค์แล้ว — คนที่อยู่ใกล้ได้ยินคุณ'));
    } else {
      for (const p of this.peers.values()) if (p.sender) p.sender.replaceTrack(null).catch(() => { });
      if (this.stream) { for (const t of this.stream.getTracks()) t.stop(); this.stream = null; }
      this.mic = false;
    }
    this.onChange && this.onChange(); return true;
  }
  peer(id, initiator) {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    // the caller adds the audio line; the answerer reuses the one that arrives with the offer (see signal) so audio flows both ways
    const tr = initiator ? pc.addTransceiver('audio', { direction: 'sendrecv' }) : null;
    const P = { id, pc, sender: tr ? tr.sender : null, out: null, level: 0, made: performance.now(), init: initiator }; this.peers.set(id, P);
    if (tr && this.mic && this.stream) tr.sender.replaceTrack(this.stream.getAudioTracks()[0]).catch(() => { });
    pc.onicecandidate = (e) => { if (e.candidate) this.net.send('rtc', { to: id, t: 'ice', d: e.candidate.toJSON() }); };
    pc.ontrack = (e) => this.attach(P, e.streams[0] || new MediaStream([e.track]));
    pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) this.close(id); };
    if (initiator) (async () => { const o = await pc.createOffer(); await pc.setLocalDescription(o); this.net.send('rtc', { to: id, t: 'offer', d: { type: o.type, sdp: o.sdp } }); })().catch(e => console.warn('offer', e));
    return P;
  }
  attach(P, stream) {
    const A = this.audio, c = A.ctx; if (!c) return;
    const el = new window.Audio(); el.srcObject = stream; el.muted = true; el.play().catch(() => { }); // Chrome only feeds WebRTC audio into Web Audio while an element plays it
    const src = c.createMediaStreamSource(stream), g = c.createGain(), an = c.createAnalyser(); an.fftSize = 256;
    const pan = A._panner(3, 1.4); src.connect(an); src.connect(g); g.connect(pan); pan.connect(A.bus.voice || A.bus.npc);
    P.out = { el, src, g, pan, an, buf: new Uint8Array(an.fftSize) };
  }
  async signal(m) {
    if (!this.on || !m || !m.from) return; let P = this.peers.get(m.from);
    if (m.t === 'offer') {
      if (P && P.pc.signalingState !== 'stable') { this.close(m.from, true); P = null; }
      if (!P) { if (this.peers.size >= MAX_PEERS) return; P = this.peer(m.from, false); }
      await P.pc.setRemoteDescription(m.d);
      const t = P.pc.getTransceivers()[0]; if (t) { t.direction = 'sendrecv'; P.sender = t.sender; if (this.mic && this.stream) await t.sender.replaceTrack(this.stream.getAudioTracks()[0]).catch(() => { }); }
      const a = await P.pc.createAnswer(); await P.pc.setLocalDescription(a); this.net.send('rtc', { to: m.from, t: 'answer', d: { type: a.type, sdp: a.sdp } });
    } else if (m.t === 'answer' && P) await P.pc.setRemoteDescription(m.d);
    else if (m.t === 'ice' && P) { try { await P.pc.addIceCandidate(m.d); } catch (e) { } }
    else if (m.t === 'bye') this.close(m.from, true);
  }
  close(id, quiet) {
    const P = this.peers.get(id); if (!P) return; this.peers.delete(id); this.speaking.delete(id);
    if (!quiet && this.net.online) this.net.send('rtc', { to: id, t: 'bye' });
    try { P.pc.close(); } catch (e) { } if (P.out) { try { P.out.src.disconnect(); P.out.g.disconnect(); P.out.pan.disconnect(); P.out.el.srcObject = null; } catch (e) { } }
  }
  update(dt) {
    if (!this.on) return; const me = this.player.pos; this.t -= dt;
    if (this.t <= 0) {
      this.t = 1;
      const near = [...this.remotes.map.values()].filter(r => r.info && r.info.voice).map(r => ({ r, d: Math.hypot(r.x - me.x, r.z - me.z) })).sort((a, b) => a.d - b.d);
      for (const { r, d } of near) if (d < NEAR && !this.peers.has(r.id) && this.peers.size < MAX_PEERS && String(this.net.id) < String(r.id)) this.peer(r.id, true);
      for (const id of [...this.peers.keys()]) { const r = this.remotes.map.get(id); const d = r ? Math.hypot(r.x - me.x, r.z - me.z) : 1e9; if (!r || !r.info.voice || d > FAR) this.close(id); else { const P = this.peers.get(id); const age = P ? performance.now() - P.made : 0; if (P && P.init && P.pc.signalingState === 'have-local-offer' && age > 5000) this.close(id, true); /* offer sent before they switched voice on — try again */ else if (P && !P.out && age > 20000) this.close(id); } }
    }
    for (const [id, P] of this.peers) {
      const r = this.remotes.map.get(id); if (!r || !P.out) continue; const d = Math.hypot(r.x - me.x, r.z - me.z);
      this.audio._pos(P.out.pan, r.x, (r.y || 0) + 1.6, r.z); P.out.g.gain.setTargetAtTime(d > NEAR ? Math.max(0, 1 - (d - NEAR) / (FAR - NEAR)) : 1, this.audio.ctx.currentTime, 0.2);
      P.out.an.getByteTimeDomainData(P.out.buf); let pk = 0; for (const v of P.out.buf) pk = Math.max(pk, Math.abs(v - 128)); P.level = pk / 128;
      if (P.level > 0.06) this.speaking.add(id); else this.speaking.delete(id);
    }
  }
}
