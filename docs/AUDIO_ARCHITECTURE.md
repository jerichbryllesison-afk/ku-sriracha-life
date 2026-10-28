# Audio Architecture

## Files
- `public/js/audio.js` — engine: context lifecycle, buses, limiter, reverb, listener, spatial one-shots, pooled engine
  voices, horns, birds, looping emitters, ambience beds, UI sounds, generative background music.
- `public/js/sfxsynth.js` — offline procedural synthesis into buffers: footsteps (11 surfaces × walk/run × 4 variants,
  lazily per surface), footwear layers (sandal slap, leather heel, boot, sneaker), non-verbal speech (formant synthesis with
  the five Thai tone contours), laughs, shouts, claps, ball kick, car/moto door, sit, starter motor, impact, sizzle, IR.
- `public/js/soundworld.js` — game integration (listener, footsteps from animation, vehicles, horns, NPC chatter, zones).
- Hooks in game code: `Character.sfx(kind)` (heel strike / clap beat), `LocalPlayer.onLand/onJump/onStop`,
  `Vehicle.thr/brk/drift/air`, `Traffic.onHonk(car, style)`, `LifeSim.onSay/onKick`, server/net `sfx` event.

## Signal flow
source → air/occlusion low-pass → gain → PannerNode → category bus → (duck: ambient/vehicles/npc/footsteps) → master → limiter → out
category bus → reverb send (footsteps/vehicles/npc/effects, level = listener enclosure) → convolver → master

## Spatial model
- Distance: `inverse` model, per-sound refDistance (footstep 1.6 m, voice 2.2 m, scooter 4.5 m, car 6 m, horn 8 m).
- Air absorption: cutoff = 19 kHz / (1 + d/32); rear sources × (1 − 0.42·behind); occluded × 0.28 and −45 % gain.
- Occlusion: `world.col.raySegment(listener → source)` against building boxes; engine voices every 0.3 s, one-shots at start.
- Doppler: f' = f·(c − v_L·u)/(c − v_S·u), c = 343 m/s, clamped 0.8–1.25, applied to engine oscillator frequencies.
- Listener: camera orientation, positioned 60 % from camera to the player's head; velocity from smoothed position delta.

## Vehicles
Engine voice = sawtooth + square (firing frequency from rpm and cylinder count) + noise exhaust pulses AM'd at the firing
frequency → soft-clip drive (load) → low-pass (rpm/load) ; tyre roll noise (speed, surface) ; skid band-noise (lateral slip,
hard braking). rpm from gear model with shift hysteresis or CVT (scooters). Profiles: car, hatch, diesel (pickup/songthaew),
scooter, sport bike, supercar, bicycle (tyres only). Starter + door/seat sounds on enter, engine run-down on exit.

## Bicycles (Milestone 1)
No engine. Layers driven by real riding state: tyre roll (speed, surface), chain-on-cog whirr while pedalling
(AM at chain-link rate = speed / (2.1 m × 2.62) × 42), freewheel pawl clicks while coasting (24 clicks per wheel turn),
rim-brake squeal while braking, fender/bell rattles on rough ground and landings, bell on the horn key. Stationary → silent.

## Time-of-day ambience & places (Milestone 1)
`dayPhase()` drives: morning chorus (koel, bulbul, sparrow, myna) → quiet midday + cicadas (09:30–16:30) → afternoon sea
breeze near the coast → evening myna gathering; commuter peaks raise the traffic beds (07:20–08:50, after 16:20); lunch
(11:25–13:05) raises the food-court murmur. Places: cutlery/plate clinks at food courts, espresso steam + cups at cafés,
referee whistle at an active football pitch, door chime when opening shop menus, sizzle at food carts.
Background music plays in sets (≈2.5–4 min) separated by ambience-only gaps (≈1.5–3.5 min), quieter in the world;
the phone radio switches to continuous play.

## Traffic horns
Per car: time-to-collision with the player / player vehicle < 2.2 s, being blocked by the player > 3.5 s, sudden cut-in
(gap < 5 m closing > 3 m/s) or a long jam; probability, 6–12 s per-car cooldown, 1.2 s global gap; single vs double tap.

## Multiplayer
Remote footsteps and engines are synthesised locally from replicated state (position, speed, animation) — no audio data
on the wire. Discrete events (horn) use `sfx`: whitelisted, ≥250 ms per player, relayed only to players within 220 m.
Disconnected players: remote removed → its descriptors expire and pooled voices fade out.

## Proximity voice chat (not implemented — requirements)
Needs WebRTC (peer-to-peer mesh or an SFU), signalling over socket.io, STUN and a TURN relay for players behind strict NAT.
Render's free tier cannot host TURN (UDP); a hosted TURN service or VPS would be required. Privacy: explicit mic consent
dialog, push-to-talk default, mute/block per player, per-player volume, visible mic indicator, no recording. Spatial playback
would route each remote MediaStream through the same PannerNode chain. Must be tested with ≥2 real clients before release.

## Assets & licences
All sounds are original procedural synthesis generated at runtime (no files, no third-party licences). They are
stylised; recorded, licensed samples (e.g. CC0 field recordings of Thai campuses, scooters) would raise realism and can be
dropped in by replacing buffers in `audio.js` (`this.buf.*`) — record source and licence here when added.

## Music (round 1)
`audio.bgm()` has two generative styles: `groove` (default, 112 BPM, intro/verse/pre/chorus/break form, kick/clap/open-hat,
syncopated saw bass, chord stabs, hook lead with tempo delay, 16th pluck, risers, tom fills) and `chill` (original 84 BPM).
Phone radio switches stations (saved in settings). Music bus has +2.3 dB make-up gain; world music scale 0.72 on foot /
0.85 in vehicles. Phone sounds: `audio.ping(kind)` — msg, social, order, money, friend, ring, pick, hang, blip.

## Vehicles, animals, aircraft, voice (rounds 2–3)
Engine profiles per catalog `engine` key: `scooter` (Click/PCX CVT whine), `vespa` (single-cylinder thump), `maxi` (Forza),
`hybrid` (Civic/Camry: EV hum at low speed, engine joins above ~35 km/h or hard throttle), `i4e` (BMW 330e), `v8` (AMG:
6-cylinder-firing layer + overrun crackle `pops()`), per-model horns. Exhaust tuning raises loudness/crackle. Dogs/cats use
`animal3D` (bark/meow, positional, NPC bus); airliners `jet3D` (low rumble + whine, Doppler-like fade). Live band near the
bar in the afternoon or during a live-music event. Proximity voice: WebRTC stream → MediaStreamSource → gain (fade 40–55 m)
→ panner → voice/NPC bus (a muted <audio> element keeps Chrome feeding the stream).
