// Social layer: who is online, public profiles, friends, direct messages, invites, shared feed (posts, photos, likes,
// comments, reports). Player identity = account id (random, not secret); tokens never leave the server.
'use strict';

function makeSocial(ctx) {
  const { store, players, io, log } = ctx;
  const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
  const online = (acc) => { for (const p of players.values()) if (p.accountId === acc && p.profile) return p; return null; };
  const isAcc = (s) => typeof s === 'string' && /^a[0-9a-f]{16}$/.test(s);
  const gap = (me, k, ms, now) => { me.mem.soc = me.mem.soc || {}; if (now - (me.mem.soc[k] || 0) < ms) return false; me.mem.soc[k] = now; return true; };
  const notif = (acc, n) => { const p = online(acc); if (p) io.to(p.sid).emit('notif', n); };
  const blockedEither = (a, b) => { const s = store.friendState(a, b); return s.mine === 'blocked' || s.theirs === 'blocked'; };

  function onlineList(me) {
    const out = [];
    for (const p of players.values()) {
      if (!p.profile || p === me) continue; const st = store.friendState(me.accountId, p.accountId);
      out.push({ uid: p.accountId, id: p.id, name: p.profile.name, faculty: p.profile.faculty, program: p.profile.program, level: p.profile.level, homeTier: p.profile.home ? (ctx.cat.HOUSING[p.profile.home.type] || {}).tier : null, friend: st.mine === 'accepted' ? 'friends' : st.mine === 'pending' ? 'requested' : st.theirs === 'pending' ? 'incoming' : null });
    }
    return out.sort((a, b) => (b.friend === 'friends') - (a.friend === 'friends') || b.level - a.level);
  }
  // JPEG photo from the in-game camera: data URL, ≤ 260 KB, must start with SOI and end with EOI
  function photoFrom(dataUrl) {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/jpeg;base64,') || dataUrl.length > 360000) return null;
    const buf = Buffer.from(dataUrl.slice(23), 'base64');
    if (buf.length < 500 || buf.length > 260000 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[buf.length - 2] !== 0xff || buf[buf.length - 1] !== 0xd9) return null;
    return buf;
  }

  function handle(me, d, now = Date.now()) {
    const op = String(d.op || ''); const A = me.accountId;
    switch (op) {
      case 'online': return { ok: true, list: onlineList(me) };
      case 'profile': { if (!isAcc(d.uid)) return { ok: false, err: 'Unknown player' }; const pr = store.publicProfile(d.uid); if (!pr) return { ok: false, err: 'Unknown player' }; const st = store.friendState(A, d.uid); return { ok: true, profile: { ...pr, online: !!online(d.uid), me: d.uid === A, friend: st.mine === 'accepted' ? 'friends' : st.mine === 'pending' ? 'requested' : st.theirs === 'pending' ? 'incoming' : st.mine === 'blocked' ? 'blocked' : null } }; }
      case 'friend': {
        if (!isAcc(d.uid) || d.uid === A || !store.publicProfile(d.uid)) return { ok: false, err: 'Unknown player' };
        if (d.act === 'remove') { store.friendRemove(A, d.uid); return { ok: true, state: null }; }
        if (d.act === 'block') { store.friendBlock(A, d.uid); return { ok: true, state: 'blocked' }; }
        if (!gap(me, 'friend', 1500, now)) return { ok: false, err: 'Too fast' };
        const st = store.friendRequest(A, d.uid); if (st === 'blocked') return { ok: false, err: 'Not possible' };
        notif(d.uid, { type: st === 'friends' ? 'friend_accept' : 'friend_request', uid: A, name: me.profile.name, faculty: me.profile.faculty, level: me.profile.level });
        return { ok: true, state: st };
      }
      case 'friends': { const f = store.friendsOf(A); for (const x of f.friends) x.online = !!online(x.id); return { ok: true, ...f }; }
      case 'dm': {
        if (!isAcc(d.uid) || d.uid === A || !store.publicProfile(d.uid)) return { ok: false, err: 'Unknown player' };
        const text = clean(d.text, 300); if (!text) return { ok: false, err: 'Empty message' };
        if (!gap(me, 'dm', 800, now)) return { ok: false, err: 'Too fast' };
        if (blockedEither(A, d.uid)) return { ok: false, err: 'Not possible' };
        if (me.mutedUntil && now < me.mutedUntil) return { ok: false, err: 'You are muted' };
        const id = store.dmSend(A, d.uid, text); notif(d.uid, { type: 'dm', uid: A, name: me.profile.name, text, id, t: now });
        return { ok: true, id };
      }
      case 'thread': { if (!isAcc(d.uid)) return { ok: false, err: 'Unknown player' }; return { ok: true, list: store.dmThread(A, d.uid), name: store.nameOf(d.uid), online: !!online(d.uid) }; }
      case 'inbox': return { ok: true, list: store.dmInbox(A).map(x => ({ ...x, online: !!online(x.id) })) };
      case 'invite': {
        if (!isAcc(d.uid) || d.uid === A) return { ok: false, err: 'Unknown player' }; const to = online(d.uid); if (!to) return { ok: false, err: 'Player offline' };
        if (!gap(me, 'inv:' + d.uid, 8000, now)) return { ok: false, err: 'Wait a moment before inviting again' };
        if (blockedEither(A, d.uid)) return { ok: false, err: 'Not possible' };
        const act = clean(d.act, 40) || 'hang out'; const pos = me.st ? [Math.round(me.st[0]), Math.round(me.st[2])] : null;
        notif(d.uid, { type: 'invite', uid: A, name: me.profile.name, act, place: clean(d.place, 60), pos });
        return { ok: true };
      }
      case 'invite_reply': { if (!isAcc(d.uid)) return { ok: false }; notif(d.uid, { type: 'invite_reply', uid: A, name: me.profile.name, yes: !!d.yes }); return { ok: true }; }
      case 'post': {
        const text = clean(d.text, 400); const photo = d.photo ? photoFrom(d.photo) : null;
        if (d.photo && !photo) return { ok: false, err: 'Photo not accepted (in-game camera JPEG up to 250 KB)' };
        if (!text && !photo) return { ok: false, err: 'Write something first' };
        if (!gap(me, 'post', 20000, now)) return { ok: false, err: 'You can post again in a few seconds' };
        if (me.mutedUntil && now < me.mutedUntil) return { ok: false, err: 'You are muted' };
        const mid = photo ? store.mediaPut(A, 'image/jpeg', photo) : null; const id = store.postCreate(A, text, clean(d.place, 60), mid);
        const item = store.feed(A, { before: id + 1, limit: 1 })[0];
        for (const p of players.values()) if (p.profile && p !== me) io.to(p.sid).emit('notif', { type: 'post', post: { ...item, liked: false } });
        return { ok: true, post: item };
      }
      case 'feed': return { ok: true, list: store.feed(A, { before: Number(d.before) || 0, limit: 25, author: isAcc(d.author) ? d.author : null }) };
      case 'like': {
        const p = store.postGet(Number(d.id)); if (!p || p.hidden) return { ok: false, err: 'Post not found' };
        if (!gap(me, 'like', 250, now)) return { ok: false, err: 'Too fast' };
        const r = store.likeToggle(A, p.id); if (r.liked && p.author !== A) notif(p.author, { type: 'like', id: p.id, uid: A, name: me.profile.name, text: String(p.text).slice(0, 60) });
        return { ok: true, ...r };
      }
      case 'comment': {
        const p = store.postGet(Number(d.id)); if (!p || p.hidden) return { ok: false, err: 'Post not found' };
        const text = clean(d.text, 240); if (!text) return { ok: false, err: 'Empty comment' };
        if (!gap(me, 'comment', 2500, now)) return { ok: false, err: 'Too fast' };
        if (me.mutedUntil && now < me.mutedUntil) return { ok: false, err: 'You are muted' };
        const id = store.comment(A, p.id, text); if (p.author !== A) notif(p.author, { type: 'comment', id: p.id, uid: A, name: me.profile.name, text });
        return { ok: true, id, list: store.comments(p.id) };
      }
      case 'comments': return { ok: true, list: store.comments(Number(d.id)) };
      case 'report': { const p = store.postGet(Number(d.id)); if (!p) return { ok: false }; const r = store.report(A, p.id); if (r) store.adminLog('post_report', p.author, { post: p.id, by: A }); return { ok: true }; }
      case 'delete': return { ok: store.postDelete(A, Number(d.id)) };
      default: return { ok: false, err: 'Unknown op' };
    }
  }
  function routes(app) {
    app.get('/media/:file', (req, res) => {
      const m = /^(\d{1,10})\.jpg$/.exec(req.params.file || ''); if (!m) return res.status(404).end();
      let row = null; try { row = store.mediaGet(Number(m[1])); } catch (e) { log('[media]', e.message); }
      if (!row) return res.status(404).end();
      res.setHeader('Content-Type', 'image/jpeg'); res.setHeader('Cache-Control', 'private, max-age=86400'); res.setHeader('Content-Security-Policy', "default-src 'none'");
      res.end(Buffer.from(row.bytes));
    });
  }
  return { handle, routes, onlineList };
}

module.exports = { makeSocial };
