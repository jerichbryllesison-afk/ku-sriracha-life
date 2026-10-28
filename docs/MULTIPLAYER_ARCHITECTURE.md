# Multiplayer Architecture

## Current (Milestone 2, tested 2026-10-28)
- One Node process: Express 5 static + socket.io 4 (`server.js`), max 100 players, deployed on Render free tier.
- Identity: anonymous device token (192-bit, `localStorage.kusl_token`); the server stores only its SHA-256 in
  `accounts`. Players can copy it as a recovery code (phone → Settings) to continue on another device. One session per
  account (older tab closed, session ended as `replaced`). Banned accounts are refused at `hello`.
- Persistence: embedded SQLite (`docs/DATABASE.md`). Local = persistent. **Render Free = ephemeral** — detected and shown
  to players; the admin can download a verified backup.
- Authority: money, XP/level (incl. level bonuses), inventory, wardrobe, hairs, vehicles, main-quest index, one-time
  rewards, wages and transfers are computed and committed server-side. Client `save` carries only cosmetic / needs /
  soft-progress fields (bounded, rate-limited). Every RPC: authenticated by socket account, rate-limited, validated.
- Jobs: server-issued single-use shift tickets (`job start/step/finish`), minimum durations, cooldowns, route checks
  against replicated positions, 45 m/s travel-time floor. Minigame score is still client-reported (clamped 0–1) — a
  server-seeded verifiable minigame is a later improvement.
- Sessions: UTC start / heartbeat (60 s) / end + reason; playtime and active time accumulated server-side; sessions left
  open by a crash are closed as `server_restart` at the next start.
- Replication: clients send `state` (≤12 values) at 10 Hz; server broadcasts a 10 Hz `snap` of all players (no interest
  management yet); clients interpolate 160 ms behind. Chat global, 0.9 s limit; `/commands` are private and never broadcast.
- NPCs, traffic and the life simulation still run **locally on each client** (see foundation below).
- Sound events: `sfx` (horn) whitelisted, 250 ms rate limit, relayed only within 220 m.

## Shared-world foundation (laid in M2, non-breaking)
- `kv.world_seed` (persistent, created by migration 3) is sent in `welcome.world.seed`; clients store it as
  `game.worldSeed` (not yet used, so nothing visible changed).
- Plan for server-authoritative NPC / traffic sync (Milestone 8): the server owns entity ids (`n<seed-index>` for NPCs,
  `t<index>` for traffic) and a deterministic schedule derived from `world_seed` + the shared game clock, so every client
  can simulate the same population locally; the server only replicates *divergence* (an NPC talking to a player, a car a
  player crashed into) as events keyed by entity id, inside a 150 m interest grid. Player-owned parked vehicles become
  server entities (`vehicles.id`) with position written on exit. Nothing here may raise client CPU beyond the budgets in
  `docs/PERFORMANCE_TARGETS.md`.

## Target (Milestones 2–6, 10, 11)
1. ✅ M2: embedded SQLite (no external service). Later option: managed Postgres via a new `store.js` implementation
   (connection string as a Render environment variable, never committed). Tables/collections: accounts, characters, sessions, inventory, vehicles, housing, orders,
   transactions (ledger with idempotency keys), friends, messages, posts, npc_relationships, quest_progress, achievements.
2. Optional account linking (email or OAuth) on top of the device token so a character survives browser resets / devices.
3. ✅ M2: session tracking (UTC, heartbeat, playtime, crash recovery).
4. Interest management: spatial grid (e.g. 150 m cells) → snapshots only include players within ~300 m; far players at 1–2 Hz.
5. ✅ M2: server-issued job tickets with server-computed pay (see above).
6. Shared world entities that matter to several players (orders, shops, vehicles parked in the world) owned by the server.
7. ✅ Proximity voice (rounds 2–3): WebRTC P2P, STUN only; server relays `rtc` offer/answer/ice/bye only between players
   within 90 m who both enabled voice (rate-limited, ≤ 16 KB). A TURN relay (paid provider/VPS) is still needed for strict NATs.
8. ✅ Player ride hailing: `rides` table state machine open → accepted → boarded → done/cancelled/expired with escrow.
