# Architecture

Browser game: **three.js r180** (vendored in `public/vendor/three`, ES modules + importmap, no build step).
Server: **Node + Express 5 + socket.io 4** (`server.js`). Launch: `start.bat` → http://localhost:3000.

## Server (`server.js`)
One world, `MAX_PLAYERS = 100`. Token auth (hex token in localStorage → sha256 key). Authoritative economy via
`public/shared/economy.js` (buy/earn/claim/allowance/transfer with validation + caps). Saves `data/players.json`
(atomic tmp+rename every 5 s). 10 Hz state snapshots; chat rate-limited (900 ms, 140 chars).

## Shared (`public/shared/`)
`catalog.js` (faculties, items, shops, clothes, vehicles, jobs, quests, time/weather), `economy.js` (profile + rules).

## Map pipeline
`tools/build_map.py campus_light.glb public/data` → `map.json` (roads graph, building footprints, water),
`height.png` (5 m), `surface.png` (1 m gameplay classes), `landuse.png` (2 m weights), `sdf.png` (1 m signed distances:
road / walk / water / building). The GLB is the real-map source (kept in `_old_version/public/campus_light.glb`).

## Client modules (`public/js/`)
| Area | Files |
|---|---|
| Boot, loop (60 FPS cap), presets, post FX | `main.js` |
| World build | `foliage.js` (leaf-card trees + atlas), `birds.js`, `world.js`, `mapdata.js`, `nature.js` (terrain shader, water, trees), `grass.js`, `polybuild.js`, `buildings.js`, `roadnet.js`, `props2.js`, `places.js`, `geo.js`, `textures.js` |
| Sky / time / weather | `sky.js` |
| Collision | `collision.js` (2.5D boxes/circles/walls + 1 m surface raster) |
| Player & camera | `player.js`, `character.js`, `input.js` |
| Vehicles & traffic | `vehicles.js`, `vehicle-models.js`, `traffic.js` |
| NPCs / life | `life.js` (population director, schedules, activities, sports), `npcs.js` (quest givers, looks) |
| Gameplay | `game.js` (profile, quests, GPS A*, needs), `activities.js` (places, shops, jobs), `minigames.js` |
| UI | `ui.js` (HUD, toasts, modal, minimap, big map), `phone.js`, `icons.js`, `css/style.css`, `index.html` |
| Network | `net.js` (socket + offline fallback), `remote.js` (interpolated remote players) |
| Audio | `audio.js` (procedural WebAudio) |

Cache busting: run `node tools/stamp.js` after client changes (rewrites the import map with `?v=` stamps).
Test hooks: `window.__game` (game, world, player, phone, ui, composer, grass …), URL `?q=low|medium|high|ultra|max` (testing only; default max) `&gov=0&hour=&w=clear|cloudy|rain`.

## Rendering budget mechanisms (graphics pass 3)
- **Trees** (`nature.js buildTreeLOD`): per-instance LOD + view culling. Each tree InstancedMesh keeps its full source
  matrices; `update()` (called every frame, re-compacts only when the camera moved > 6 m, turned > ~10° or every 0.7 s)
  draws only instances in the right distance band **and** inside the horizontal view cone (+28° margin) or within 60 m
  (shadow casters). The far band (420–1500 m on max) keeps a stable random subset that thins to 28 % at the far edge.
- **Grass** (`grass.js`): two rings. Near ring = 6-blade, 2-segment clumps (30 verts); far ring = 3 single-triangle blades
  (9 verts) drawn only outside the near ring (`opts.inner`). Governor scales both rings.
- **Measure** with `renderer.info` (`autoReset = false`) around `composer.render`; per-object attribution via `onBeforeRender`.
