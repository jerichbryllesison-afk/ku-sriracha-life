# Performance Targets

- Frame cap 60 FPS (16.67 ms). Adaptive governor (`main.js` LADDER) lowers resolution / far grass / AO / reflections when
  FPS < 54 and restores when > 58.5. Mobile preset on touch devices.
- Measured (headless Chromium + SwiftShader, main gate, max preset — triangles/draw calls are hardware-independent):
  484 → 449 draw calls and 4.75 M → 3.00 M triangles per frame after graphics pass 3; grass ≤ 0.63 M; shadow pass ≈ 0.47 M.
- Main-thread JS (game systems except render submit) ≈ 1.5 ms/frame; sound layer ≈ 0.1 ms/frame.
- Real GPU frame time on players' devices is not measured yet (no GPU in the build environment) → collect with the in-game
  FPS readout (Settings → Show FPS) on target devices.

## Budgets & rules (every feature is costed before it ships)
- Grass ≤ 0.7 M tris; trees culled per instance; new props instanced; no per-frame allocations in update loops.
- NPC agents ≤ 64 (desktop) / 26 (mobile), animation LOD 1/3/6 frames; far NPCs simulated coarsely.
- Audio: engine voices 8 / 4 (mobile), one-shot limits per category, occlusion rays ≤ ~30/s.
- Network: state 10 Hz; snapshots must move to interest-filtered delivery before player count grows.
- Graphics are locked (see `ART_DIRECTION.md` → Graphics freeze); new content must match the baseline, and a regression
  render (`tools`-style headless capture, PSNR vs baseline) is part of QA for any change near rendering.
