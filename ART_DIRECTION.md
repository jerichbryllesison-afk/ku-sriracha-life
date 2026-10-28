# Art Direction

**Target:** realistic-stylized campus. Real proportions and materials, simplified geometry, clean readable shapes.
Not photoreal, not toy-like.

## Colour
| Token | Hex | Use |
|---|---|---|
| KU green | `#00704f` (hi `#12936a`, lo `#004d37`) | brand, primary actions, selected state |
| Nonsi gold | `#d8b04a` (hi `#f0d27c`) | objectives, accents, level badge, primary CTA |
| Paper | `#f2ede1` | key caps, ID card, map rings, text on dark |
| Surfaces | `#111b17 / #17241f / #20302a`, line `#2b3b35` | panels, cards |
| Status | ok `#4cbf86`, warn `#e8a33b`, bad `#e2563f` | needs bars, toasts |
Map/blip categories: study green, food `#c76a2a`, shops `#2f6aa8`, living `#56636b`, sport `#2a8f84`.

## Type
- **Chakra Petch** (Thai-designed, technical) — numerals, clock, money, labels, eyebrows (uppercase, tracked).
- **Sarabun** — body text and all Thai text.

## UI rules
- World first: HUD uses **edge scrims** (gradient from screen edge), not floating cards. No backdrop blur.
- Solid panels for modal surfaces; radii 2/4/8 px; gold 3 px top/left rule marks focus surfaces (modal, objective, prompt).
- One icon family: `public/js/icons.js` (24 px grid, 1.75 stroke, round caps), used in DOM (SVG) and canvases (Path2D).
  Emoji are legacy content only; leading emoji in toasts/menus are auto-mapped to icons.
- Spacing scale 4/8/12/16/24. Motion 120/220 ms; respects `prefers-reduced-motion`.

## World rules
- Scale: 1 world unit = 1 m; map scale 14.5 m per GLB unit (verified against road widths and house sizes).
- Roads/sidewalks from smoothed signed-distance fields (1 m/px); sidewalks are a 2.6 m band parallel to the road edge.
- Ground: lawns on campus/urban open land, concrete aprons within ~6 m of buildings, dusty asphalt edges.
- Lighting: ACES tone mapping, sun arc tilted for readable shadows, display-space grade (vibrance, gentle contrast, vignette).

## Rendering targets (graphics pass 3, 2026-10-28)
Direction: believable, richly detailed realistic-stylised Thai campus. References (GTA V/IV mods, driving games) set the *quality bar*
— coherence, light, materials, depth — never content to copy. Saturation, bloom, sharpening or crushed shadows are not "quality".
- **Sun**: art-directed path, azimuth east → west on the southern side, elevation peaks ≈46° (not tropical zenith) so every
  hour keeps modelling and readable shadow length. Golden light below ~25°.
- **Haze**: linear fog starts ≈70 m and saturates at 74 % of draw distance (aerial perspective layers the treeline / town).
- **Grade**: saturation ≤1.05, contrast ≤1.08, light vignette. Never push greens.
- **Grass**: olive / yellow-green palette, per-clump hue & value variation, straw dry patches, dark self-shadowed base,
  blade-oriented normals (not ground-plane normals). Mowed lawns ≤0.35 m; taller grass only on unkempt land.
- **Budgets** (max preset, measured with `renderer.info`): grass ≤0.7 M triangles / ≤1.2 M vertices per frame.
- Night is currently disabled by design decision (daytime-only clock); its lighting is a separate pass.

## Graphics freeze (2026-10-28 — owner decision, permanent until lifted)
The current look is the **visual quality baseline**. Do not change lighting, tone mapping, colour grading, sky, shaders,
trees/grass appearance, road/building materials, camera system or overall style, and do not lower existing detail.
New content (vehicles, buildings, shops, NPCs, animals, items) must match this baseline. Any change to the render pipeline or
a core shader is a separate proposal that needs the owner's approval first. Verify with a regression render (same camera,
hour, weather; dynamic actors hidden; animated uniforms frozen) — Milestone 1 result: PSNR 55.3 dB, 0.047 % pixels changed.
No claims of DLSS / neural rendering: none is used.
