# Game Studio Standards (Project Ironclad)

The permanent working standard for this project. Summary of the owner's directive — apply to every task.

1. **Existing project, never a blank slate.** Preserve working systems, saves (`data/players.json`), map data and coordinates. No destructive rewrites without a backup and a stated reason.
2. **Workflow:** Inspect → Diagnose → Decide → Implement → Validate → Review → Report. Small tasks may compress it.
3. **Evidence only.** Never claim something is tested, measured or accurate without evidence. State real limitations (e.g. the cloud test machine renders with SwiftShader at ~1 FPS, so FPS must be measured on real hardware).
4. **Anti-generic design.** Glass cards, emoji-as-art, neon gradients, dashboard HUDs, repeated boxes are warning signs. Every visual choice needs a reason. See `ART_DIRECTION.md`.
5. **Geographic truth.** Layout comes from the real map file (`campus_light.glb` → `tools/build_map.py`). Estimated content (e.g. procedural coast, building heights) must be labelled as estimated. No proprietary Google imagery/meshes.
6. **Performance.** 60 FPS cap (16.67 ms full-frame budget). Measure draw calls/triangles before and after rendering changes. Quality presets low/medium/high/ultra must keep working.
7. **Simulation correctness.** Simulation never tied to render FPS (dt is clamped; vehicle/player use dt-based integration). Server is authoritative for money, items, quests rewards.
8. **Architecture.** Respect module boundaries listed in `ARCHITECTURE.md`. Validate at boundaries, clean up resources, no duplicate loops/handlers.
9. **Documentation.** Keep `DEVELOPMENT_STATUS.md` truthful after every change. Never mark untested work complete.

- Audio is part of every feature: follow `docs/AUDIO_ENGINEERING_STANDARD.md` (positional, animation-synced, pooled, mixed, licensed).
