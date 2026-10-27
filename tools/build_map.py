#!/usr/bin/env python3
"""Convert the real KU Sriracha area map (campus_light.glb, generated from map data) into game data.

Outputs (public/data/):
  map.json      bounds, buildings (footprints), water bodies, road graph, rails, campus info
  height.png    16-bit heightmap (5 m grid)  value = (h + 50) * 100
  surface.png   8-bit 1 m surface classes (gameplay: road / walk / building / water / ...)
  landuse.png   RGBA 2 m land-use weights   R grass  G forest  B dirt  A farm  (urban = none)
  sdf.png       RGBA 1 m signed distances   R road  G walkway  B water  A building   (128 = edge, 8 px per metre)
"""
import json, struct, sys, os
import numpy as np, cv2
from scipy.interpolate import griddata
from scipy.ndimage import gaussian_filter, distance_transform_edt
from skimage.morphology import skeletonize

GLB = sys.argv[1]
OUT = sys.argv[2]
S = 14.5          # metres per GLB unit (checked against road widths / house sizes)
V = 0.6           # vertical exaggeration correction
ZBASE = 1.6
MINX, MAXX, MINZ, MAXZ = -1480, 1160, -948, 948
MAP_MINX = -1160  # west edge of the real map; west of it we add the Ao Udom coast
W, H = MAXX - MINX, MAXZ - MINZ

def load(path):
    f = open(path, 'rb').read()
    l = struct.unpack('<I', f[12:16])[0]
    j = json.loads(f[20:20 + l]); off = 20 + l
    bl = struct.unpack('<I', f[off:off + 4])[0]; b = f[off + 8:off + 8 + bl]
    def acc(i):
        a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]
        comp = {5126: np.float32, 5125: np.uint32, 5123: np.uint16}[a['componentType']]
        n = {'SCALAR': 1, 'VEC3': 3}[a['type']]
        arr = np.frombuffer(b, dtype=comp, count=a['count'] * n, offset=bv.get('byteOffset', 0) + a.get('byteOffset', 0))
        return arr.reshape(-1, n) if n > 1 else arr
    out = {}
    for node in j['nodes']:
        p = j['meshes'][node['mesh']]['primitives'][0]
        out[node['name']] = (acc(p['attributes']['POSITION']).astype(np.float64), acc(p['indices']).reshape(-1, 3).astype(np.int64))
    return out

M = load(GLB)
def toW(p):  # GLB (x east, y north, z up) -> world metres (x east, z south)
    return np.stack([p[:, 0] * S, -p[:, 1] * S], 1)
def hW(z): return (z - ZBASE) * S * V

def raster(names, res, value=255, shape=None, img=None):
    w, h = int(W / res), int(H / res)
    if img is None: img = np.zeros((h, w), np.uint8)
    for nm in names:
        p, t = M[nm]; q = toW(p)
        px = np.stack([(q[:, 0] - MINX) / res, (q[:, 1] - MINZ) / res], 1)
        pts = np.round(px * 4).astype(np.int32)  # sub-pixel (shift=2)
        for tri in t:
            cv2.fillConvexPoly(img, pts[tri], value, lineType=cv2.LINE_8, shift=2)
    return img

print('heightmap…')
p, t = M['Land']; q = toW(p); hz = hW(p[:, 2])
STEP = 5
gx = np.arange(MINX, MAXX + 0.01, STEP); gz = np.arange(MINZ, MAXZ + 0.01, STEP)
GX, GZ = np.meshgrid(gx, gz)
Hm = griddata(q, hz, (GX, GZ), method='linear')
near = griddata(q, hz, (GX, GZ), method='nearest')
Hm = np.where(np.isnan(Hm), near, Hm)
# west extension: coastal plain -> beach -> seabed (sea level = 0)
edge = Hm[:, np.searchsorted(gx, MAP_MINX)]
for i, x in enumerate(gx):
    if x >= MAP_MINX: continue
    t_ = (MAP_MINX - x)
    k = min(1, t_ / 70.0); k = k * k * (3 - 2 * k)
    h = edge * (1 - k) + 1.6 * k
    if t_ > 175: h = 1.6 - (t_ - 175) * 0.05
    if t_ > 215: h = 1.6 - 40 * 0.05 - (t_ - 215) * 0.12
    Hm[:, i] = np.maximum(h, -12)
Hm = gaussian_filter(Hm, 1.0)

print('surface raster…')
RES = 1
CL = dict(GRASS=0, ROAD=1, WALK=2, BUILDING=3, SAND=4, WATER=5, PIER=6, DIRT=7, PLAZA=8, PARKING=9, SPORT=10, MEDIAN=11, FARM=12, FOREST=13, PLATFORM=14, POOL=15, RAIL=16, URBAN=17)
surf = np.zeros((H, W), np.uint8)
def paint(names, cls):
    m = raster(names, RES); surf[m > 0] = cls; return m
urban = paint(['Urban / Built-up Land'], CL['URBAN'])
barren = paint(['Terrain Barren Ground'], CL['DIRT'])
forest = paint(['Terrain Forest'], CL['FOREST'])
shrub = paint(['Terrain Shrub'], CL['GRASS'])
agri = paint(['Terrain Agriculture'], CL['FARM'])
parks = paint(['Parks & Grass'], CL['GRASS'])
managed = paint(['Terrain Managed Green'], CL['GRASS'])
water = paint(['Water'], CL['WATER'])
rail = paint(['Railways'], CL['RAIL'])
paths = raster(['Paths & Trails'], RES)
surf[(paths > 0) & (surf == CL['FOREST'])] = CL['DIRT']
surf[(paths > 0) & (surf != CL['DIRT'])] = CL['WALK']
roads = paint(['Roads'], CL['ROAD'])
# procedural Ao Udom coast roads (beach road + connectors continuing the real sois to the coast)
BEACH_X = -1300
def pl(x0, z0, x1, z1, w):
    cv2.line(roads, (int(x0 - MINX), int(z0 - MINZ)), (int(x1 - MINX), int(z1 - MINZ)), 255, int(w))
pl(BEACH_X, MINZ + 4, BEACH_X, MAXZ - 4, 10)
for z, w in [(-879, 9), (-168, 10), (-84, 10), (145, 9), (254, 10), (380, 12), (441, 12)]:
    pl(MAP_MINX + 6, z, BEACH_X, z, w)
surf[roads > 0] = CL['ROAD']
blds = raster(['Buildings'], RES)
# sidewalks: 2.6 m band beside roads outside forests
dist_road = distance_transform_edt(roads == 0)
side = (dist_road > 0) & (dist_road <= 2.6) & np.isin(surf, [CL['URBAN'], CL['GRASS'], CL['DIRT']]) & (blds == 0)
surf[side] = CL['WALK']
surf[blds > 0] = CL['BUILDING']
# coast
xs = np.arange(W) + MINX + 0.5
coastX = MAP_MINX - 175 - 32  # where seabed reaches 0
for i, x in enumerate(xs):
    if x < MAP_MINX - 175 + 6: surf[:, i] = CL['SAND']
    if x < MAP_MINX - 175 - 32: surf[:, i] = CL['WATER']

print('landuse weights…')
R2 = 2
def down(mask): return cv2.resize(mask.astype(np.float32), (W // R2, H // R2), interpolation=cv2.INTER_AREA)
grassM = np.isin(surf, [CL['GRASS'], CL['SPORT']]) | ((surf == CL['WALK']) & (dist_road > 2.7))
lu = np.zeros((H // R2, W // R2, 4), np.float32)
lu[..., 0] = down(grassM | np.isin(surf, [CL['BUILDING']]) & False)
lu[..., 1] = down(surf == CL['FOREST'])
lu[..., 2] = down(np.isin(surf, [CL['DIRT'], CL['RAIL']]))
lu[..., 3] = down(surf == CL['FARM'])
sandW = down(surf == CL['SAND'])
lu = np.stack([cv2.GaussianBlur(lu[..., c], (0, 0), 1.0) for c in range(4)], -1)
# sand goes into "dirt" channel with a flag: store sand in blue too but mark via sdf later; keep simple: grass->0 on beach
img = np.clip(lu * 255, 0, 255).astype(np.uint8)
cv2.imwrite(os.path.join(OUT, 'landuse.png'), cv2.cvtColor(img, cv2.COLOR_RGBA2BGRA))

print('sdf…')
# high-res (0.5 m) masks -> signed distance -> smoothed -> stored at 1 m/px (crisp, straight road edges)
RS = 0.5
def sdf(mask):
    inside = distance_transform_edt(mask) * RS
    outside = distance_transform_edt(~mask) * RS
    return outside - inside  # metres, negative inside
up = lambda m: cv2.resize(m.astype(np.uint8), (int(W / RS), int(H / RS)), interpolation=cv2.INTER_NEAREST) > 0
roadsHi = raster(['Roads'], RS)
for (x0, z0, x1, z1, w) in [(BEACH_X, MINZ + 4, BEACH_X, MAXZ - 4, 10)] + [(MAP_MINX + 6, z, BEACH_X, z, w) for z, w in [(-879, 9), (-168, 10), (-84, 10), (145, 9), (254, 10), (380, 12), (441, 12)]]:
    cv2.line(roadsHi, (int((x0 - MINX) / RS), int((z0 - MINZ) / RS)), (int((x1 - MINX) / RS), int((z1 - MINZ) / RS)), 255, int(w / RS))
bldHi = raster(['Buildings'], RS)
walkM = (surf == CL['WALK'])
blur = lambda d, sig: cv2.GaussianBlur(d.astype(np.float32), (0, 0), sig)
dRoad = blur(sdf(roadsHi > 0), 2.2)
dBld = blur(sdf(bldHi > 0), 0.6)
# sidewalk = clean 2.6 m band parallel to the (smoothed) road edge, only on open urban/grass/dirt land, never inside buildings
allowed = up(np.isin(surf, [CL['URBAN'], CL['GRASS'], CL['DIRT'], CL['WALK'], CL['PLAZA'], CL['PARKING']]))
dAllow = blur(sdf(allowed), 2.0)
band = np.maximum(np.maximum(-dRoad, dRoad - 2.6), np.maximum(dAllow, 0.4 - dBld))
# footpaths away from roads (campus paths, plazas) from the real map, smoothed
dPath = blur(sdf(up(walkM & (dist_road > 2.7))), 3.0)
dWalk = np.minimum(band, dPath)
sd = np.zeros((H, W, 4), np.float32)
for c, d in enumerate([dRoad, dWalk, blur(sdf(up(surf == CL['WATER'])), 2.0), dBld]):
    sd[..., c] = cv2.resize(d, (W, H), interpolation=cv2.INTER_AREA)
enc = np.clip(128 + sd * 8, 0, 255).astype(np.uint8)
cv2.imwrite(os.path.join(OUT, 'sdf.png'), cv2.cvtColor(enc, cv2.COLOR_RGBA2BGRA))

print('buildings…')
RB = 0.5
bm = raster(['Buildings'], RB)
cnts, _ = cv2.findContours(bm, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
buildings = []
for c in cnts:
    area = cv2.contourArea(c) * RB * RB
    if area < 14: continue
    ap = cv2.approxPolyDP(c, 1.3, True).reshape(-1, 2)
    if len(ap) < 3: continue
    pts = ap * RB + np.array([MINX, MINZ])
    (cx, cz), (rw, rh), ang = cv2.minAreaRect((c.reshape(-1, 2) * RB + np.array([MINX, MINZ])).astype(np.float32))
    fill = area / max(1e-6, rw * rh)
    # ensure counter-clockwise when viewed from above (x east, z south): signed area in x/z
    xsP, zsP = pts[:, 0], pts[:, 1]
    sa = 0.5 * np.sum(xsP * np.roll(zsP, -1) - np.roll(xsP, -1) * zsP)
    if sa > 0: pts = pts[::-1]
    buildings.append({'p': [round(float(v), 2) for v in pts.flatten()], 'a': round(area, 1), 'c': [round(cx, 2), round(cz, 2)], 'r': [round(rw, 2), round(rh, 2), round(ang, 2)], 'f': round(fill, 3)})
print(' buildings:', len(buildings))

print('water bodies…')
p, t = M['Water']
wm = raster(['Water'], RB)
cnts, _ = cv2.findContours(wm, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
qW = toW(p)
waters = []
for c in cnts:
    area = cv2.contourArea(c) * RB * RB
    if area < 30: continue
    ap = cv2.approxPolyDP(c, 1.0, True).reshape(-1, 2) * RB + np.array([MINX, MINZ])
    # level: terrain at polygon vertices (min) minus a little
    xi = np.clip(((ap[:, 0] - MINX) / STEP).astype(int), 0, len(gx) - 1); zi = np.clip(((ap[:, 1] - MINZ) / STEP).astype(int), 0, len(gz) - 1)
    level = float(np.min(Hm[zi, xi])) - 0.35
    waters.append({'p': [round(float(v), 2) for v in ap.flatten()], 'a': round(area, 1), 'y': round(level, 2)})
# carve ponds into the heightmap
for wb in waters:
    poly = np.array(wb['p']).reshape(-1, 2)
    msk = np.zeros(Hm.shape, np.uint8)
    cv2.fillPoly(msk, [np.round((poly - [MINX, MINZ]) / STEP).astype(np.int32)], 1)
    dd = distance_transform_edt(msk) * STEP
    depth = np.clip(dd / 6.0, 0, 1) * 2.2
    Hm = np.where(msk > 0, np.minimum(Hm, wb['y'] - 0.4 - depth), Hm)
print(' water bodies:', len(waters))

def trace_graph(mask, min_spur=12, simplify=1.5):
    sk = skeletonize(mask > 0).astype(np.uint8)
    k = np.ones((3, 3), np.uint8); k[1, 1] = 0
    deg = cv2.filter2D(sk, -1, k, borderType=cv2.BORDER_CONSTANT) * sk
    ys, xs_ = np.nonzero(sk)
    pix = set(zip(ys.tolist(), xs_.tolist()))
    nbrs = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
    def neigh(p): return [(p[0] + a, p[1] + b) for a, b in nbrs if (p[0] + a, p[1] + b) in pix]
    nodes = {p for p in pix if deg[p] != 2}
    visited = set(); edges = []
    for n in nodes:
        for nb in neigh(n):
            if (n, nb) in visited: continue
            path = [n, nb]; visited.add((n, nb)); visited.add((nb, n)); prev, cur = n, nb
            while cur not in nodes:
                nxt = [q for q in neigh(cur) if q != prev and (cur, q) not in visited]
                if not nxt: break
                # prefer 4-neighbours to avoid diagonal shortcuts
                nxt.sort(key=lambda q: abs(q[0] - cur[0]) + abs(q[1] - cur[1]))
                q = nxt[0]; visited.add((cur, q)); visited.add((q, cur)); path.append(q); prev, cur = cur, q
            edges.append(path)
    return edges, nodes

print('road graph…')
edges, nodes = trace_graph(roads)
dt_road = distance_transform_edt(roads > 0)
# prune short spurs
from collections import defaultdict
def degree_map(es):
    d = defaultdict(int)
    for e in es: d[e[0]] += 1; d[e[-1]] += 1
    return d
for _ in range(3):
    d = degree_map(edges)
    edges = [e for e in edges if not ((d[e[0]] == 1 or d[e[-1]] == 1) and len(e) < 14)]
# merge chains through degree-2 junctions
def merge(es):
    changed = True
    while changed:
        changed = False; d = degree_map(es); ends = defaultdict(list)
        for i, e in enumerate(es): ends[e[0]].append(i); ends[e[-1]].append(i)
        for nd, ids in ends.items():
            if d[nd] == 2 and len(ids) == 2 and ids[0] != ids[1]:
                a, b = es[ids[0]], es[ids[1]]
                if a[-1] != nd: a = a[::-1]
                if b[0] != nd: b = b[::-1]
                es = [e for k, e in enumerate(es) if k not in ids] + [a + b[1:]]
                changed = True; break
    return es
edges = merge(edges)
road_edges = []
for e in edges:
    arr = np.array([[p[1], p[0]] for p in e], np.int32)
    if len(arr) < 4: continue
    w = float(np.median([dt_road[p] for p in e])) * 2.0
    ap = cv2.approxPolyDP(arr.reshape(-1, 1, 2), 1.5, False).reshape(-1, 2).astype(np.float64)
    ap = ap + 0.5 + np.array([MINX, MINZ])
    road_edges.append({'p': [round(float(v), 1) for v in ap.flatten()], 'w': round(max(3.0, w), 1)})
print(' road edges:', len(road_edges))

print('rails…')
redges, _ = trace_graph(rail, simplify=2.0)
rails = []
for e in redges:
    if len(e) < 30: continue
    arr = np.array([[p[1], p[0]] for p in e], np.int32)
    ap = cv2.approxPolyDP(arr.reshape(-1, 1, 2), 2.0, False).reshape(-1, 2).astype(np.float64) + 0.5 + np.array([MINX, MINZ])
    rails.append([round(float(v), 1) for v in ap.flatten()])

print('writing…')
# heightmap 16-bit
h16 = np.clip((Hm + 50) * 100, 0, 65535).astype(np.uint32)
rgb = np.zeros(Hm.shape + (3,), np.uint8); rgb[..., 2] = (h16 >> 8) & 255; rgb[..., 1] = h16 & 255  # BGR: R=high, G=low
cv2.imwrite(os.path.join(OUT, 'height.png'), rgb)
print('height range', float(Hm.min()), float(Hm.max()))
cv2.imwrite(os.path.join(OUT, 'surface.png'), surf)
meta = {
    'bounds': {'minX': MINX, 'maxX': MAXX, 'minZ': MINZ, 'maxZ': MAXZ, 'mapMinX': MAP_MINX, 'step': STEP, 'nx': len(gx), 'nz': len(gz), 'coastX': MAP_MINX - 175 - 32, 'seaLevel': 0, 'beachX': BEACH_X},
    'scale': S, 'classes': CL,
    'buildings': buildings, 'water': waters, 'roads': road_edges, 'rails': rails,
}
json.dump(meta, open(os.path.join(OUT, 'map.json'), 'w'), separators=(',', ':'))
print('done', os.path.getsize(os.path.join(OUT, 'map.json')) // 1024, 'KB json')
