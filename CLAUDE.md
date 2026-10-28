# CLAUDE.md — KU Sriracha Life (Project Ironclad)
Existing game: three.js r180 (WebGL, no build step) + Node/Express/socket.io. Continue it; never rebuild from scratch.

## Permanent rules
- **Graphics are locked** (`ART_DIRECTION.md` → Graphics freeze). New content matches the baseline; render-pipeline / core
  shader changes need the owner's approval first. Run a regression render when touching anything visual.
- **No night**: day runs 06:45–17:36; use `dayPhase()` (morning / midday / afternoon / evening).
- Server is authoritative for money, ownership, inventory, rewards, progression; never trust client amounts.
- **Database standard** (`docs/DATABASE.md`): embedded SQLite created automatically; every economic change goes through
  `runOp` → `store.commit` (one transaction, ledger rows that sum to the change, ack only after COMMIT, failure = nothing
  happened); one-time rewards are `claims` rows; money ops carry an idempotency `rid`. Migrations are append-only —
  never edit an applied one, never DROP / delete-and-recreate. Report storage mode honestly (Render Free = ephemeral).
- Never commit or upload `data/` (database, backups, `admin-key.txt`). The owner trainer key lives only in `ADMIN_KEY`
  or the local key file; trainer UI stays outside `/public`.
- Every feature: check sound (`docs/AUDIO_ENGINEERING_STANDARD.md`), multiplayer, persistence, mobile, performance cost,
  security, UI states, docs. Report only tested results; nothing is "complete" or "production ready" without evidence.
- Preserve `data/` (kusl.db, players.json), map data and coordinates; back up to `_backups/` before risky changes.
- After client changes run `node tools/stamp.js`. Update `DEVELOPMENT_STATUS.md` truthfully.

## Docs map
Vision `PROJECT_VISION.md` · standards `GAME_STUDIO_STANDARDS.md` · engine architecture `ARCHITECTURE.md` ·
graphics standard `ART_DIRECTION.md` · status `DEVELOPMENT_STATUS.md` · `docs/GAMEPLAY_SYSTEMS.md` (milestones) ·
`docs/MULTIPLAYER_ARCHITECTURE.md` · `docs/ECONOMY_SYSTEM.md` · `docs/SOCIAL_SIMULATION.md` · `docs/PERFORMANCE_TARGETS.md` ·
`docs/AUDIO_ENGINEERING_STANDARD.md` · `docs/AUDIO_ARCHITECTURE.md` · `docs/DATABASE.md`.

## Run / test
`npm start` (port 3000) or `start.bat`. Tests `npm run test:db`, `test:life`, `test:world`; tools `node tools/db.js info|verify|backup|list|restore`. URL params `?q=&hour=&w=&gov=0`; hooks on `window.__game`.
Map source `campus_light.glb` → `python3 tools/build_map.py <glb> public/data`.
