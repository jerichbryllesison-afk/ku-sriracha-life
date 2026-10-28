# Development Status

_Last updated: 2026-10-28 (Living campus — rounds 2 + 3)_

## Audio mix — balanced medium (2026-10-28)
Owner request: music and effects were clashing and too loud. Master 0.7→0.55, music 0.45→0.30, music make-up 1.3→1.0,
music scale on foot 0.72→0.60 / vehicle 0.85→0.72, category buses lowered (vehicles 0.6, effects/footsteps 0.72, UI 0.6),
limiter threshold −7→−10 dB. Old saved volume levels are reset once (settings `mixV: 2`). Measured in headless Chrome:
walking output peak 0.08, AMG GT full throttle peak 0.16 (no clipping), no page errors. Players can still change it in
phone Settings.

## Fix: phone stuck on "My home" (2026-10-28)
The housing app used the id `home`, the same as the phone's home screen, so Back/Home reopened it. Renamed to `house`.
Verified in browser: every app's Back returns to the home screen, Home button and close work, no page errors.

## No rain (2026-10-28)
Owner request: rain removed. `weatherForDay` returns only clear (≈76 %) or cloudy (≈24 %); trainer weather buttons and
`?w=rain` no longer force rain. Verified: 100k weather samples contain no rain; page loads with `?w=rain` → rain hidden,
no errors; `test:world` 39/39.

## Living campus — rounds 2 + 3 (2026-10-28)
Render/shader/world/sky files unchanged; `vehicle-models.js` and `places.js` only gained content (old models identical).
- Vehicles: Honda Click 160, Honda PCX, Vespa Primavera 150, Honda Forza, Honda Civic e:HEV RS 2026, Toyota Camry 2.5 HEV
  2026 (it is a hybrid, not an EV — Thailand sells it hybrid-only), BMW 330e M Sport, Mercedes-AMG GT 63 Coupé. Original
  look-alike low-poly bodies (extruded side profiles, alloy wheels), no logos. Prices approximate Thai list prices, level-gated.
  Each has its own engine sound profile (scooter CVT, Vespa single, Forza 330, hybrid/EV hum, BMW I4 + e-drive, AMG V8 with
  crackle). Old hatch/pickup/sedan/supercar stay for owners but are no longer sold.
- Tuning garage (`server/life2.js`, place TUNING): engine / handling / brakes / exhaust levels, paint, repair; all
  server-priced within 70 m of the garage. Wear drops on crashes (client can only report lower condition).
- KU Shop app (Shopee/Lazada-style, own name): gadgets, beauty, fashion, home deco, snacks; cart → server order → parcel
  delivered after 40–100 s (free shipping ≥ ฿1,000). Items now 96 (phones, laptops, cosmetics, luxury food, deco), clothes 68.
- Places: mall, bar hall + bar with live band (afternoons/events), steak house, shabu, fried chicken, ramen, luxury café,
  fine dining, beauty, gadget store, tuning garage — generic names (real chain branches are not placed).
- Fishing at the west shore (server-rolled catch, cooldown, daily cap, sell at the market/seafood), basketball, gym.
- Campus events every 5–10 min (football, basketball, beach clean-up, food fair, live music, study group, fun run, mall
  sale): be there 60 s → ฿150 + 80 XP once per event (server `claims`). Owner can start one from the trainer.
- Player-to-player ride hailing: request (escrow fare) → driver on a motorbike/car accepts → board within 12 m → the
  passenger rides along → driver paid at the destination (anti-teleport time floor; cancel/expiry refunds).
- Proximity voice chat (button bottom-left: off → listen → mic): WebRTC peer-to-peer, ≤ 6 peers, 40 m with fade to 55 m,
  3-D positioned; server only relays signalling between nearby players who switched voice on.
- World life: dogs and cats (instanced, wander near dorms/markets/canteens, barks/meows), airliner fly-overs with jet
  sound, second bird flock, NPC students walk up and greet you with time-of-day lines.
- Tests: `npm run test:db` 70/70 · `test:life` 51/51 · `test:world` 39/39 (garage, KU Shop + parcels, fishing, events,
  P2P rides incl. refunds, voice relay rules) · browser E2E 12/12 (8 vehicles build/drive/render, new places, KU Shop UI
  checkout, garage UI upgrade, fishing prompt, event chip, animals + plane, two-player voice both ways with fake mics,
  P2P ride → passenger follows driver, no page errors) · schema v4 → v5 upgrade keeps data (verified backup first).
- Fixed during testing: voice signalling was not forwarded to the game (net event list) and the answering side added a
  second audio line (one-way audio) — both fixed and re-tested.
- Honest limits: voice needs HTTPS (Render is HTTPS) and has no TURN relay, so some strict mobile/office networks cannot
  connect. Not tested on a real phone, iPad or the owner's PC; headless tests use SwiftShader. Render Free storage is still
  ephemeral.

## Living campus — round 1 of 3 (2026-10-28)
Graphics untouched (render/shader files byte-identical); only new content: gold door rings at 56 entrances.
- Music: new generative "KU Groove" (112 BPM, song form, four-on-the-floor chorus, hook melody, risers) as default, original
  calm track kept as radio station "KU Chill"; music ~30 % louder and on more of the time (sets 200–320 s, gaps 40–90 s).
  Birds ×1.6 with 4 new Thai species (spotted dove, black-naped oriole, tailorbird, crow); slightly denser crowd bed.
- Phone: iOS-style notifications with per-app sounds and badges; incoming-call screen with answer/decline and reply choices.
- Personal social circle per player (`society.js`): mom, dad, sibling + 6 friends (classmate, dorm neighbour, faculty senior,
  club, work buddy, high-school best friend) generated from the player's own seed — different for every player — each with
  a role, faculty/job, personality. 30 hand-written message situations + 3 call scripts (Thai + English) driven by time of
  day, weather, money, hunger, energy, level-ups, jobs; replies change closeness; invites set GPS and "meet up" rewards.
- Server social layer (`server/social.js`): online list with public profiles (faculty, program, level, home tier, playtime),
  friends (request/accept/remove/block), direct messages, activity invites with location, shared KU Feed (text + in-game
  photo, likes, comments, report → auto-hide at 3, owner can hide), notifications to everyone online.
- Side work (`server/life.js` + `apps.js`): KU Ride rider mode (NPC passengers anywhere on the map, food deliveries to every
  place and house, GPS), own business (fried-snack stall / rice kitchen: NPC customer orders → cook minigame → deliver,
  server writes the order and pays margin + tip), player-to-player food orders with escrow (another player delivers for the
  fee; if nobody accepts in 40 s a shop rider delivers; cancel/expiry refunds), NPC ride hailing (server-charged fare).
- Homes: every player gets a unique free dorm room (unique DB index); move to mid (PT House, AA Residence) or luxury
  (Kensington, Notting Hill, Laemchabang Tower) — server-charged lease, better sleep/mood. Starter bicycle for everyone,
  auto-parked at a free kerbside spot near the player. Area banner when entering a new place.
- Owner: player log file `data/logs/sessions-YYYY-MM.csv` (Bangkok time) + trainer "Log" tab + CSV download (all players,
  every login/logout, minutes).
- Tests: `npm run test:db` 70/70 · `npm run test:life` 51/51 (homes, business, ride, hail, P2P orders incl. NPC fallback &
  refund, friends, DMs, feed, photos, player log) · browser E2E 14/14 (all apps render, starter room + bike, photo capture,
  NPC message + reply, call flow, rider requests + GPS task, two players: feed/people/friend/DM banners, music level, no page
  errors) · schema v3 → v4 upgrade keeps data (verified backup first).
- Not done yet (rounds 2–3): 8 requested car/motorbike models + per-model engine sounds + tuning/repair shop, 50+ branded
  items, restaurants/bars/mall, online shopping app, proximity voice chat, dogs/cats/planes, fishing/basketball, NPCs walking
  up to greet, P2P ride-hailing between players. Not tested on a real phone or the owner's PC.

## Milestone 2 — zero-configuration database, server economy, sessions, owner trainer (2026-10-28)
Backup `_backups/build-2026-10-28-pre-m2.tgz`. Standard: `docs/DATABASE.md` (rules also in `CLAUDE.md`).
- Embedded SQLite auto-created at `data/kusl.db` (node:sqlite; start.bat adds better-sqlite3 for Node < 22.13), 3 append-only
  migrations, one-time import of `data/players.json` (file left unchanged), verified backups (startup / 6 h / pre-migration /
  manual / download), `tools/db.js` info · verify · backup · list · restore.
- Server-authoritative: wages (single-use shift tickets), XP/levels/level bonus, rewards (claims table), purchases, item use,
  transfers (both sides in one transaction), main-quest index; ledger + idempotency keys; client `save` limited to
  cosmetic/needs fields. Sessions (UTC), playtime/active time, crash recovery. Display-name change (unique, 24 h).
  Recovery code (phone → Settings). Storage mode detection (Render Free = ephemeral → players warned).
- Owner trainer: `/admin <key>` in chat → private panel (F8). Key: `ADMIN_KEY` env or local `data/admin-key.txt`.
- Files: new `server/` (storage/driver, migrations, mode, store; rules; admin; admin-ui), `tools/db.js`, `tools/test-db.js`,
  `tools/check-driver.js`; changed `server.js`, `game.js`, `activities.js`, `main.js`, `net.js`, `phone.js`, `coach.js`,
  `player.js` (speed/jump multiplier hooks, default 1), `start.bat`, `package.json`, `render.yaml`, `.gitignore`.
  Render, shader, audio and map files are byte-identical to the pre-M2 backup (graphics + audio unchanged).
- Tests: `npm run test:db` → **70/70** on real server processes (exploits, duplicate/concurrent claims, replay, negative
  balance, two players, restart persistence, kill -9 recovery, migrations, Render-mode detection, admin security, backup
  download). Browser E2E (headless Chromium, real UI): **14/14** — character creation, server wage in HUD, buy/use,
  XP, private /help, trainer unlock (+1M), two players see each other, normal player has no trainer, reload keeps money and
  resumes trainer, Render-mode warning toast + settings card, no page errors.
- Known limits: Render Free still erases the database on restart/redeploy/sleep (only a persistent disk or external DB fixes
  that — code cannot); minigame scores and visit/eat/study objectives are client-reported (bounded); NPC/traffic still local
  per client (seed + design laid down in `docs/MULTIPLAYER_ARCHITECTURE.md`); not tested on the owner's own Windows PC yet.

## Milestone 0 + 1 — protection, audit, audio fixes (2026-10-28)
M0: backup `_backups/build-2026-10-28-pre-m1.tgz`; audit recorded in `docs/MULTIPLAYER_ARCHITECTURE.md` (critical: Render
free disk is ephemeral → player data can be lost on restart; `earn` trusts client amounts; NPC/traffic are client-local);
graphics lock written into `ART_DIRECTION.md` and `CLAUDE.md`; new docs: GAMEPLAY_SYSTEMS (milestones + dependencies),
MULTIPLAYER_ARCHITECTURE, ECONOMY_SYSTEM, SOCIAL_SIMULATION, PERFORMANCE_TARGETS. Existing root docs kept (no duplicates).
M1 changes: `audio.js` (bicycle drivetrain layers, music scale), `sfxsynth.js` (clink, steam, whistle, chime, rattle),
`soundworld.js` (bike bumps, day-phase ambience, place sounds, shop chime, music sets), `catalog.js` (`dayPhase`),
`phone.js` (radio = continuous music), `main.js` (music director call).
Verified:
- Bicycle offline: silent when stationary (−120 dB), pedalling chain 0.04→0.085 + tyre 0.015→0.106, coasting freewheel
  click rate 69→48 Hz tracking speed, brake squeal while braking, engine layer always 0, silent again after stopping.
  In game on the player's bicycle: parked 0 · pedalling chain 0.085 / tyre 0.107 · coasting freewheel 0.028.
- Ambience (green area): 07:12 13 bird calls in 14 s incl. koel; 12:12 3; 14:30 2 + cicada chorus; 17:00 11 (mynas);
  traffic bed 0.020 (12:12) → 0.032 (17:00 rush). Cafeteria at lunch: crowd bed at max, clinks present (rate reduced after test).
  Stadium whistle not observed: no football match was running during the test.
- Regression: offline scooter pass-by unchanged (−45 → −18.5 dB, L/R +4.2 → −4.5 dB, Doppler 1.042 / 0.961);
  two clients: remote steps 28, remote engine voice, replicated horn 1, cleanup after disconnect (started = ended);
  mobile profile: 4 engine voices, footsteps on grass/concrete/asphalt/leaves.
- Graphics regression: 12 rendering modules byte-identical (SHA-1) and render setup in `main.js` unchanged; baseline vs
  current render PSNR 55.3 dB, 0.047 % of pixels differ by > 8/255 (birds / sub-pixel motion).
Limits: whistle path untested in a live match; real-device mobile audio not measured; all sounds procedural.

## Immersive audio foundation (2026-10-28)
Audit: the previous audio was 2-D only (no PannerNode), one oscillator engine for the player's own vehicle, timer-based
footsteps, global noise ambience. Replaced with a spatial engine + game integration (see `docs/AUDIO_ARCHITECTURE.md`):
- `audio.js` engine: category buses + limiter + ducking (phone/menus/map) + enclosure-driven reverb; PannerNode (inverse
  distance), air absorption, rear high-cut, occlusion by building raycast, Doppler; pooled engine voices (desktop 8 /
  mobile 4) with fades; one-shot concurrency limits; lifecycle (gesture unlock, suspend in background tab).
- `sfxsynth.js`: original procedural sounds — footsteps for 11 surfaces × walk/run × 4 variants, footwear layers (sandal
  slap, leather heel, boot), non-verbal speech with Thai tone contours, laughs, shouts, claps, kick, doors, starter, impact, sizzle.
- `soundworld.js`: footsteps from animation heel strikes (player, NPCs, online players); landing / jump / hard-stop sounds;
  vehicles (own, traffic, online) with rpm/gear/CVT model, tyres, skid, brake, suspension bump, starter, doors, run-down;
  traffic horn AI (time-to-collision, blocked, cut-in, jam; probability + cooldowns); NPC conversations with turn-taking;
  ball kicks; zone ambience (wind gusts, leaves, birds with morning chorus, midday cicadas, traffic bed, Sukhumvit city bed,
  crowd murmur, AC hum, waves, rain, food-stall sizzle). Online horn replicated via a whitelisted, rate-limited,
  distance-filtered `sfx` server event. Settings: master + 6 category sliders (saved). Horn touch button while driving.
Verified (headless Chromium):
- Offline pass-by (scooter 14 m/s, 6 m lateral): level −45 dB at 67 m → −18.6 dB at closest → −39 dB; L/R balance
  +4.2 dB → −4.5 dB; engine pitch 55.3 Hz → 51.0 Hz (ratio 1.084 = (343+14)/(343−14)); air cutoff 6.3 → 15.9 kHz.
  Rear cue: same 20 m source 11.7 kHz in front vs 6.8 kHz behind; occluded 3.3 kHz. All synthesized buffers finite, peaks ≤ 0.8.
- In game (rendering stubbed so the simulation runs in real time): 30 heel-strike footsteps over 34 m, 0 after stopping;
  surface changes asphalt → concrete → grass → leaves while crossing; traffic engine voices assigned near Sukhumvit;
  a traffic car honked when the player stood in its lane; 9 conversation utterances in 12 s at a sitting pair;
  own scooter: starter/door one-shots, rpm 4231 at 16.5 m/s, voice released after exit; one-shots started = ended (no leak);
  sound layer main-thread cost ≈ 0.1 ms/frame. Mobile profile: 4 engine voices.
- Two real clients: A heard B's footsteps (19–29), assigned an engine voice to B's scooter, received B's replicated horn (1 event),
  and dropped B's voice after B disconnected (started = ended).
Not implemented / limits: proximity voice chat (requirements in `docs/AUDIO_ARCHITECTURE.md`: WebRTC + TURN), building
interiors/stairs (none exist; reverb uses listener enclosure instead), real Thai speech (non-verbal synthesis only), recorded
samples (all sounds are procedural and stylised), door sounds for buildings, NPC-traffic collisions. Audio-thread cost on
real phones not measured. Night audio intentionally absent (no night).

## Graphics pass 3 — lighting, grass, tree culling (2026-10-28)
Finding: the two builds in the user's comparison (Render = left, local = right) have **identical graphics code**
(`world/nature/grass/foliage/sky/textures` byte-identical; only UI/onboarding files differ). The differences were
time of day (07:39 low sun vs 13:11 near-overhead sun), location (road vs open lawn), and the right window running at
governor level 5 while a second copy of the game ran in the left window on the same PC (so its 34 FPS is not a clean measurement).
Changes:
- `sky.js`: art-directed sun path (elevation peak ≈46°, east→west over the south) so midday keeps the long-shadow
  morning look; wider golden window; sun 4.3 max; sky fill hemi 0.14→0.42 with warm ground bounce, env 0.42→0.62
  (shadows had near-black areas); haze from 70 m to 74 % of view distance; fog colour #b3c6d4.
- `main.js` grade: saturation 1.14→1.04, contrast 1.12→1.07, vignette 0.3→0.22. Grass budgets 30k near + 30k far (was 34k + 56k).
  FPS readout moved to bottom-right (it overlapped the tutorial card).
- `grass.js`: far ring = 3 single-triangle blades drawn only outside the near ring; blade-oriented normals; per-clump
  hue/value variation, straw dry patches, darker base; mowed-lawn heights (was up to ~0.9 m everywhere).
- `textures.js`: olive / yellow-green lawn palette (was saturated green).
- `nature.js`/`world.js`: per-instance tree LOD + horizontal view-cone culling (+28° margin, all trees within 60 m kept
  for shadows), far band thinned to 28 % at the edge; max `treeLo` 1800→1500 m.
- `player.js`: camera smoothing now frame-rate independent (`1 − e^(−k·dt)` instead of `min(1, k·dt)`).
- `coach.js` / `style.css`: tutorial card shows only the step title when the objective box already shows the details; softer HUD scrims.
Measured (headless Chromium, SwiftShader software GL, main gate, max preset, governor off, `renderer.info`):
- per frame **484 → 449 draw calls, 4.75 M → 3.00 M triangles (−37 %)**; grass 1.62 M → 0.63 M; shadow pass ≈0.47 M.
- JS per frame (all game systems except render submit) ≈1.5 ms on the sandbox CPU — the CPU side is not the bottleneck.
- Real GPU frame time / FPS on the user's PC is **not measured** (no GPU here; SwiftShader timings are not representative).
Not done in this pass (next passes): night lighting (night is disabled by the user's earlier request), building geometry
(still procedural boxes + facades — needs authored models, e.g. Blender), road furniture/drainage, character model/materials,
full HUD redesign. No new third-party assets were added (all textures/geometry remain procedural, original).
Backup of the previous build: `_backups/build-2026-10-28-pre-gfx3.tgz`.

## Onboarding, Thai language, phone layout (2026-10-27)
Player feedback: nobody understood what the game is, how to play, or what to do next; phones were cramped; chat could not be closed.
- **Thai by default** (`js/i18n.js`): `tr()` dictionary + patterns for existing messages, `L2(en, th)` for new text; TH/EN switch in the creator and phone → Settings (saved in `kusl_settings.lang`). Thai story/daily/side-quest text and Thai quiz questions added to `shared/catalog.js` (additive fields `desc_th`, `th`, `qt`, `ot`).
- **Intro** (`js/coach.js`, first play per character): what the game is · the goal · controls (PC or touch) · your faculty (what it studies, building, starter job → next job).
- **Faculty tutorial** (6 steps): walk → look → open phone → go to faculty building → attend first class → first faculty-fit job (eng fuel→lab, sci farm→lab, ms cashier→barista, econ cashier→banquet, ims canteen→lifeguard). Drives the objective tracker; skippable; veterans (story ≥5 or Lv ≥4) skip it automatically.
- **Smart advisor**: one hint at a time (hunger / energy / health / mood / class time / low money / idle) with a one-tap GPS button, per-kind cooldowns, never during menus or tasks. **“What now?”** button (N key, ★ on phones) lists ranked suggestions.
- **Phones**: auto `mobile` preset (no AO / planar reflection, 1K shadows, near grass only, fewer agents), compact HUD (minimap + needs top-right, buttons bottom-centre with labels), full-screen phone with ✕, tap-the-prompt to interact, big-map close / zoom buttons + pinch zoom, rotate-to-landscape hint.
- **Chat fix**: closes on Esc, ✕, tapping/clicking the game, or keyboard dismiss; Send button; stuck keyboard capture is cleared every frame.
- Verified headless (Swiftshader, `?q=low`): creator in Thai, 4 intro pages, tutorial advancing 1→4, hunger hint, What-now panel, chat closes on outside tap, all 14 phone apps render without errors, TH↔EN switch, desktop 1280×720 and phone 844×390 layouts. Not verified on a real phone GPU (FPS unknown).

## Campus life + daytime-only (2026-10-27)
- **No night**: shared `gameTime` maps each 48-min game day to 06:45–17:35; at the wrap the screen fades to "Good morning".
- **Life simulation** (`life.js`): named people with roles (students in KU uniform, athletes, vendors, motorbike-taxi riders in
  orange vests, a security guard, townspeople) driven by a time-of-day director: class-change walkers go door-to-door via A* on the
  sidewalk graph (keep-left) and enter buildings; lunch/breakfast/dinner fill food courts (stainless tables + red stools) at the
  cafeteria, food street, market, cafés; chat groups with turn-taking speaker/listener poses and Thai/English bubbles; bench pairs;
  joggers on the stadium track; 5-a-side football with ball physics (gravity, bounce, rolling friction, passes/shots, goals);
  takraw circles near dorms; food carts with vendors and queues; win stand at the gate; 7-Eleven customers on Sukhumvit.
  Animation LOD (every 1/3/6 frames by distance), ≤64 people, despawn > 200 m. New poses: eat, talk, listen, laugh, kick, juggle,
  guard, sit-ride, sit-talk. Talking to anyone gives a line that fits what they are doing.
- **Traffic**: Intelligent Driver Model car-following (smooth accel/brake, safe gaps), next road chosen ~50 m early with
  curve-speed anticipation v=√(v_turn²+2bd), body squat/dive, ~45 % motorbikes riding the left edge with visible riders.
- Verified (headless): lunch at the cafeteria → 30 eating + chat groups; 16:30 at the stadium → 10 footballers + 7 joggers;
  08:00 at the gate → guard, 5 win riders, vendors. No page errors; all 56 place menus still open.

## Fix: black screen when turning the camera (2026-10-27)
- Cause: very glossy surfaces (glass roughness 0.03, clear-coat 0.08, cheap water 0.03–0.07) produced sun-glint specular values above
  the half-float limit (Inf/NaN); UnrealBloom's blur spread that pixel into a black rectangle. Fix: sanitize pass (drop NaN/Inf, clamp HDR
  to 48) after GTAO and before bloom; minimum roughness raised (glass 0.14, clear-coat 0.14, water ≥ 0.12). Verified: 36-angle sun sweep
  at 16:48 shows no black frames.
- Governor reworked: cheap levers first (far grass, shadow refresh every 2nd–4th frame, reflections, tree detail distance), resolution
  last, and a resolution drop that buys < 2 FPS is reverted (owner's PC sat at 52 FPS even at 60 % → not fill-rate bound).

## Graphics pass 2
- One graphics mode: **Maximum** (quality selector removed). Adaptive governor keeps effects maxed and, only if FPS < ~54,
  steps render scale 100→90→82%, then far-grass density, then AO/reflections; climbs back after sustained 60 FPS. `?gov=0` disables (testing).
- Trees rebuilt with alpha-tested leaf-cluster cards (`foliage.js`, one 1024² atlas: bark, broadleaf, fine leaflets, nonsi blossoms,
  palm fronds, shrubs, bougainvillea, leaf litter), volume normals, sun translucency, leaf-shaped shadows; canopy occlusion mask darkens
  and adds litter under crowns. Grass: 2 layers (dense near 15 m, wide 46 m), dry patches, shade-aware density, translucency.
- GTAO ambient occlusion from the scene depth buffer (`vendor/.../GTAOPass.js`); planar water reflections on the nearest water body
  (`Reflector`, custom rippled/fresnel shader); facade relief normal maps; reflective glass; clear-coat traffic paint.
- Raised 15 cm concrete curbs fitted to the road SDF; speed blur when driving fast; brighter, warmer sun with lower ambient; birds.
- Gait: stride-locked walk/jog/sprint (1.5 / 3.8 / ~6.8 m/s), arm counter-swing, pelvis/chest counter-rotation, head stabilisation,
  acceleration lean and turn banking. ~0.4 s on-foot acceleration.
- Background music: generative "Campus Afternoon" (WebAudio) with on/off + volume in Settings (Radio app controls the same stream).
- Cache fix: server sends `no-cache` (ETag) for game files; `node tools/stamp.js` versions every module URL — an old browser cache
  previously mixed old CSS/JS with new HTML (the "LVLv 3" HUD in the owner's screenshot).
- Real places (names verified via renthub / propertyhub / fazwaz listings; **positions estimated** from published distances):
  7-Eleven opposite KU, Laemchabang Tower, Laem Chabang Hospital, AA Residence Sriracha, Kensington Laemchabang-Sriracha,
  Notting Hill Laemchabang-Sriracha, PT House (Ao Udom 5), Ao Udom Night Market. Invented brand names replaced by generic names.

### Measured (headless SwiftShader, max preset, full frame incl. shadow + reflection + post)
- Draw calls 474 / 766 / 677 and 5.1 M / 7.7 M / 8.2 M triangles (street / aerial / pond views). Heavy: real-GPU FPS still unmeasured.

### Honest limits
- No authored photoreal assets (characters, cars, buildings are procedural). Faces/clothing are far from GTA V quality; matching the
  reference screenshots exactly is not achievable with procedural geometry — this pass targets lighting, vegetation, materials and motion.


## Implemented (verified as noted)
- Online server: 100-player cap, chat, transfers, buy/earn caps, allowance once/day — **verified** with scripted socket clients.
- All 52 place menus open; 85 sub-options clicked without errors; all phone apps open — **verified** (headless browser).
- Vehicle physics for all 8 types move/accelerate/collide — **verified** by stepping `Vehicle.drive` directly.
- Real map at true scale; roads/sidewalks from smoothed 1 m SDF (clean edges); GPU grass (medium+); colour grade pass;
  softer quest beam; roof variety + solar panels; lawn/concrete ground blending.
- UI pass 1 (Ironclad): new HUD (edge scrims, level shield, objective rule, clock), unified SVG icon system,
  redesigned phone (status bar, widgets, icon tiles), student-registration creator with live ID card,
  restyled modals/menus/minigames, vector map blips.

## Measured
- Draw calls (high preset, excl. shadow pass): street 208 / 2.05 M tris; aerial 366 / 3.67 M tris.
- **Not measured:** real FPS. Cloud test GPU is SwiftShader (~1 FPS). Needs measurement on the owner's PC.

## Known issues / next priorities
0. Measure FPS on the owner's GPU; tune governor thresholds and tree/shadow triangle budget.
1. Measure FPS on real hardware per preset; add adaptive quality if <60.
2. Night readability (street-lamp light pools on ground, slightly brighter moon ambient).
3. Building architecture: facades still share a few patterns; landmark buildings need distinct silhouettes/entrances.
4. Trees: species silhouettes and clustering; shadows under canopies.
5. Character model detail and animation polish.
6. Remaining emoji content: shop item icons (catalog `ITEMS.icon`), some menu sub-labels.
7. Big map: label density/landmark readability.
