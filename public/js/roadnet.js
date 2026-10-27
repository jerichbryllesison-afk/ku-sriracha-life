// Road network from the real map skeleton: markings, traffic lanes, pedestrian paths, lamp/pole spots.
import * as THREE from 'three';
import { MAP, groundHeight, sdfAt } from './mapdata.js';
import { SURF } from './collision.js';
import { inPoly, CAMPUS_POLY } from './polybuild.js';

const WHITE = [0.95, 0.95, 0.93], YELLOW = [0.98, 0.76, 0.16];

export function buildRoadNet() {
  const nodes = new Map(); const edges = [];
  const key = (x, z) => x.toFixed(1) + ',' + z.toFixed(1);
  for (const r of MAP.meta.roads) {
    const p = []; for (let i = 0; i < r.p.length; i += 2) p.push([r.p[i], r.p[i + 1]]);
    if (p.length < 2) continue;
    const cum = [0]; for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
    const len = cum[cum.length - 1]; if (len < 3) continue;
    const e = { id: edges.length, p, cum, len, w: r.w };
    const k0 = key(...p[0]), k1 = key(...p[p.length - 1]);
    for (const [k, end, pt] of [[k0, 0, p[0]], [k1, 1, p[p.length - 1]]]) {
      let nd = nodes.get(k); if (!nd) { nd = { id: nodes.size, x: pt[0], z: pt[1], edges: [], maxW: 0 }; nodes.set(k, nd); }
      nd.edges.push({ e, end }); nd.maxW = Math.max(nd.maxW, r.w);
      if (end === 0) e.n0 = nd; else e.n1 = nd;
    }
    e.campus = inPoly((p[0][0] + p[p.length - 1][0]) / 2, (p[0][1] + p[p.length - 1][1]) / 2, CAMPUS_POLY);
    e.perDir = r.w < 11 ? 1 : r.w < 18 ? 2 : r.w < 30 ? 2 : 3;
    e.median = r.w >= 30 ? 3 : 0;
    e.laneW = Math.max(2.4, (r.w / 2 - e.median / 2 - 0.5) / e.perDir);
    edges.push(e);
  }
  for (const e of edges) {
    e.trim0 = e.n0.edges.length >= 3 ? e.n0.maxW / 2 + 2.5 : (e.n0.edges.length === 2 ? 0 : 1);
    e.trim1 = e.n1.edges.length >= 3 ? e.n1.maxW / 2 + 2.5 : (e.n1.edges.length === 2 ? 0 : 1);
  }
  return { edges, nodes: [...nodes.values()] };
}

// position + tangent along an edge at distance s, with lateral offset lat (left of forward tangent)
export function edgePoint(e, s, lat = 0, out = {}) {
  s = Math.max(0, Math.min(e.len, s));
  let i = 1; while (i < e.cum.length - 1 && e.cum[i] < s) i++;
  const a = e.p[i - 1], b = e.p[i]; const seg = e.cum[i] - e.cum[i - 1] || 1; const t = (s - e.cum[i - 1]) / seg;
  const tx = (b[0] - a[0]) / seg, tz = (b[1] - a[1]) / seg;
  out.x = a[0] + (b[0] - a[0]) * t + tz * lat; out.z = a[1] + (b[1] - a[1]) * t - tx * lat; out.tx = tx; out.tz = tz;
  return out;
}

export function buildMarkings(net, col, mats, group) {
  const pos = [], colr = [], idx = []; let n = 0;
  const P = {};
  const quad = (a, b, c, d, cl) => { pos.push(...a, ...b, ...c, ...d); for (let k = 0; k < 4; k++) colr.push(...cl); idx.push(n, n + 1, n + 2, n, n + 2, n + 3); n += 4; };
  const strip = (e, lat, wd, s0, s1, cl, dash = 0, gap = 0) => {
    if (s1 - s0 < 0.5) return;
    const step = 2.5;
    const emit = (a0, a1) => {
      let s = a0; let prevL = null, prevR = null, ptx = 0, ptz = 0;
      while (s < a1 + 1e-3) {
        const q = edgePoint(e, Math.min(s, a1), lat, P); const nx = q.tz, nz = -q.tx;
        const L = [q.x + nx * wd / 2, 0, q.z + nz * wd / 2], R = [q.x - nx * wd / 2, 0, q.z - nz * wd / 2];
        L[1] = groundHeight(L[0], L[2]) + 0.07; R[1] = groundHeight(R[0], R[2]) + 0.07;
        const smooth = prevL && (ptx * q.tx + ptz * q.tz) > 0.94 && Math.hypot(L[0] - prevL[0], L[2] - prevL[2]) < step * 1.8;
        if (smooth) quad(prevR, R, L, prevL, cl);
        prevL = L; prevR = R; ptx = q.tx; ptz = q.tz; if (s >= a1) break; s = Math.min(a1, s + step);
      }
    };
    if (dash > 0) { for (let s = s0; s < s1; s += dash + gap) emit(s, Math.min(s1, s + dash)); }
    else emit(s0, s1);
  };
  for (const e of net.edges) {
    const w = e.w; if (w < 5.5) continue;
    const s0 = e.trim0, s1 = e.len - e.trim1; if (s1 - s0 < 2) continue;
    const half = w / 2;
    if (w >= 30) {
      for (let k = 1; k < e.perDir; k++) { const o = e.median / 2 + k * e.laneW; strip(e, o, 0.14, s0, s1, WHITE, 3, 6); strip(e, -o, 0.14, s0, s1, WHITE, 3, 6); }
      strip(e, e.median / 2 + 0.25, 0.14, s0, s1, YELLOW); strip(e, -e.median / 2 - 0.25, 0.14, s0, s1, YELLOW);
      strip(e, half - 0.6, 0.16, s0, s1, WHITE); strip(e, -half + 0.6, 0.16, s0, s1, WHITE);
    } else if (w >= 11) {
      strip(e, 0.16, 0.12, s0, s1, YELLOW); strip(e, -0.16, 0.12, s0, s1, YELLOW);
      for (let k = 1; k < e.perDir; k++) { const o = k * e.laneW; strip(e, o, 0.12, s0, s1, WHITE, 3, 5); strip(e, -o, 0.12, s0, s1, WHITE, 3, 5); }
      strip(e, half - 0.45, 0.14, s0, s1, WHITE); strip(e, -half + 0.45, 0.14, s0, s1, WHITE);
    } else {
      strip(e, 0, 0.12, s0, s1, e.campus ? WHITE : (w >= 8 ? YELLOW : WHITE), 3, 4);
      if (w >= 7) { strip(e, half - 0.4, 0.12, s0, s1, WHITE); strip(e, -half + 0.4, 0.12, s0, s1, WHITE); }
    }
    // zebra crossings at busy junction approaches
    if (w >= 7) for (const [nd, at, trim] of [[e.n0, 0, e.trim0], [e.n1, 1, e.trim1]]) {
      if (nd.edges.length < 3 || trim < 3 || e.len < trim * 2 + 6) continue;
      const sc = at ? e.len - trim + 1.2 : trim - 1.2;
      for (let o = -half + 0.9; o < half - 0.6; o += 1.0) strip(e, o + 0.25, 0.5, sc - 1.5, sc + 1.5, WHITE);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  const nrm = new Float32Array(pos.length); for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1; g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1)); g.computeBoundingSphere();
  const m = new THREE.Mesh(g, mats.mark); m.receiveShadow = true; m.matrixAutoUpdate = false; group.add(m);
  // Sukhumvit raised median with shrubs
  const medians = [];
  for (const e of net.edges) {
    if (e.w < 30) continue;
    for (let s = e.trim0 + 2; s < e.len - e.trim1 - 2; s += 3) { const q = edgePoint(e, s, 0, {}); medians.push({ x: q.x, z: q.z, r: Math.atan2(q.tx, q.tz) }); col.addBox(q.x, q.z, 1.4, 1.6, Math.atan2(q.tx, q.tz), groundHeight(q.x, q.z) + 0.3); }
  }
  return { medians };
}

// lamp / pole / tree-avenue spots
export function roadsideSpots(net, col) {
  const lamps = [], poles = [], avenue = [];
  const P = {};
  for (const e of net.edges) {
    const w = e.w; if (w < 6) continue;
    const s0 = e.trim0 + 4, s1 = e.len - e.trim1 - 4; if (s1 <= s0) continue;
    const spacing = e.campus ? 30 : 36; let i = 0;
    for (let s = s0; s <= s1; s += spacing, i++) {
      if (w >= 30) { const q = edgePoint(e, s, 0, P); lamps.push({ x: q.x, z: q.z, rot: Math.atan2(q.tz, -q.tx), dbl: true, h: 10 }); continue; }
      const side = i % 2 ? 1 : -1; const q = edgePoint(e, s, side * (w / 2 + 1.1), P);
      const sf = col.surfAt(q.x, q.z); if (sf === SURF.BUILDING || sf === SURF.WATER || sf === SURF.ROAD) continue;
      // arm points back towards the road centre
      const ax = -side * q.tz, az = side * q.tx; // vector to centre
      lamps.push({ x: q.x, z: q.z, rot: Math.atan2(ax, az), dbl: false, h: e.campus ? 6.5 : 7.5 });
    }
    if (!e.campus && w < 16) {
      let prev = null;
      for (let s = s0; s <= s1; s += 40) { const q = edgePoint(e, s, -(w / 2 + 0.7), P); const sf = col.surfAt(q.x, q.z); if (sf === SURF.BUILDING || sf === SURF.WATER || sf === SURF.ROAD) { prev = null; continue; } const pp = { x: q.x, z: q.z, line: prev ? prev.line : e.id + '_' + s, rot: Math.atan2(q.tx, q.tz) }; poles.push(pp); prev = pp; }
    }
    if (e.campus || w >= 14) for (let s = s0 + 6; s <= s1; s += 13) for (const side of [-1, 1]) { const q = edgePoint(e, s + (side > 0 ? 6 : 0), side * (w / 2 + 4.2), P); avenue.push({ x: q.x, z: q.z, campus: e.campus }); }
  }
  return { lamps, poles, avenue };
}

// Raised concrete curbs (15 cm) along every road edge that borders a sidewalk. The curb line is fitted to the smoothed
// road SDF (zero crossing searched along the road normal), so it sits exactly on the painted road edge.
export function buildCurbs(net, B) {
  const P = {}; const H = 0.15, TW = 0.28; let count = 0;
  for (const e of net.edges) {
    if (e.w < 5.5) continue;
    const s0 = e.trim0 + 1, s1 = e.len - e.trim1 - 1; if (s1 - s0 < 3) continue;
    for (const side of [-1, 1]) {
      let prev = null;
      for (let s = s0; s <= s1 + 1e-3; s += 2) {
        const q = edgePoint(e, Math.min(s, s1), 0, P); const nx = q.tz * side, nz = -q.tx * side; // outward normal
        // find the road edge (sdf road = 0) along the normal
        let lo = e.w / 2 - 2.5, hi = e.w / 2 + 2.5, found = false;
        if (sdfAt(q.x + nx * lo, q.z + nz * lo) < 0 && sdfAt(q.x + nx * hi, q.z + nz * hi) > 0) { for (let k = 0; k < 14; k++) { const mid = (lo + hi) / 2; if (sdfAt(q.x + nx * mid, q.z + nz * mid) < 0) lo = mid; else hi = mid; } found = true; }
        const off = (lo + hi) / 2; const ex = q.x + nx * off, ez = q.z + nz * off;
        const walk = found && sdfAt(ex + nx * 1.0, ez + nz * 1.0, 1) < 0; // a sidewalk lies just outside
        if (!walk) { prev = null; continue; }
        const g0 = groundHeight(ex, ez), g1 = groundHeight(ex + nx * TW, ez + nz * TW);
        const cur = { a: [ex, g0 - 0.05, ez], b: [ex, g0 + H, ez], c: [ex + nx * TW, g1 + H, ez + nz * TW], nx, nz, s };
        if (prev && Math.hypot(cur.a[0] - prev.a[0], cur.a[2] - prev.a[2]) < 3.2) {
          const g = B.get('curb', ex, ez); const L = Math.hypot(cur.a[0] - prev.a[0], cur.a[2] - prev.a[2]);
          // face towards the road, then the top
          if (side > 0) { g.quad(prev.a, cur.a, cur.b, prev.b, [[0, 0], [L, 0], [L, H], [0, H]], [0.92, 0.92, 0.9]); g.quad(prev.b, cur.b, cur.c, prev.c, [[0, 0], [L, 0], [L, TW], [0, TW]], [1, 1, 1]); }
          else { g.quad(cur.a, prev.a, prev.b, cur.b, [[0, 0], [L, 0], [L, H], [0, H]], [0.92, 0.92, 0.9]); g.quad(cur.b, prev.b, prev.c, cur.c, [[0, 0], [L, 0], [L, TW], [0, TW]], [1, 1, 1]); }
          count++;
        }
        prev = cur;
      }
    }
  }
  return count;
}
