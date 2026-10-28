# Database Engine (Milestone 2 — zero configuration)

Embedded **SQLite**, created automatically on the first `npm start` / `start.bat`. No sign-up, no external service,
no connection string. Driver: Node's built-in `node:sqlite` (Node ≥ 22.13); `start.bat` installs `better-sqlite3`
once if the computer has an older Node. If no driver can be opened the server **refuses to start** (no silent data loss).

## Files
| Path | What |
|---|---|
| `data/kusl.db` (+ `-wal`, `-shm`) | the database (WAL journal, `synchronous=FULL`, foreign keys on) |
| `data/backups/*.db` | verified snapshots: `startup-*` (each start, keep 5), `auto-*` (every 6 h, keep 8), `pre-migrate-*`, `manual-*`, `pre-restore-*` |
| `data/admin-key.txt` | owner trainer key — local machine only, git-ignored, **never upload** |
| `data/players.json` | old save file — imported once by migration 2, left unchanged |
| `server/storage/driver.js` | driver adapter (node:sqlite / better-sqlite3) — the only code that touches a driver |
| `server/storage/migrations.js` | ordered, append-only migrations |
| `server/storage/store.js` | storage layer: the only code that knows the table layout |
| `server/storage/mode.js` | persistent / ephemeral detection |
| `server/rules.js` | server-side game rules (wages, rewards, XP, purchases) — pure, storage-independent |

To move to PostgreSQL / Supabase later: re-implement `store.js` with the same methods (`loadProfile`, `commit`,
`saveData`, `rename`, `session*`, …). `rules.js`, `server.js` handlers and the client do not change.

## Storage modes (reported honestly in `/api/health`, the welcome payload, the phone Settings and the server log)
| Host | Mode | Meaning |
|---|---|---|
| your computer | **persistent** | `data/kusl.db` survives restarts |
| Render Free (and Railway/Fly/Heroku/Cloud Run without a disk) | **ephemeral** | the file is erased on restart, redeploy or sleep (~15 min idle). Players see a warning. Code cannot change this. |
| Render with a paid persistent disk | persistent | set `DATA_DIR=/var/data` (the mount path) and `PERSISTENT_DATA=1`; the server warns if `DATA_DIR` is not a separate filesystem |
Override: `STORAGE_MODE=persistent|ephemeral`.

## Schema (v5)
`accounts` (id, token_hash UNIQUE, created/last login UTC ms, banned, muted_until) · `characters` (display_name, name_key
UNIQUE, faculty, program, student_id, level 1–60, xp ≥ 0, **money CHECK ≥ 0**, main_quest, last_allowance_day,
playtime_s, active_s, data JSON for client-owned cosmetic/needs state) · `inventory` (qty 1–999) · `wardrobe` · `hairs` ·
`vehicles` (stable ids, fuel 0–1) · `housing` · `friends` · `achievements` · `claims` (PRIMARY KEY account+claim_key) ·
`ledger` (every balance change, balance_after CHECK ≥ 0) · `requests` (idempotency keys, 7-day retention) · `sessions`
(UTC start / last seen / end / reason) · `name_history` · `admin_log` · `kv` (world_seed, import record) ·
`businesses` · `posts` / `post_likes` / `post_comments` / `post_reports` / `media` (in-game JPEG photos) · `messages` (DMs) · `orders`
(player food orders, escrow states) · `characters.home` + unique `housing.property_id` (one room = one player) ·
`vehicles.mods` (tuning JSON) + `vehicles.condition` (0–1) · `parcels` (KU Shop orders) · `rides` (player ride
hailing, escrow states) · `schema_migrations`. All timestamps are UTC epoch ms; the admin UI displays Asia/Bangkok.

## Rules (permanent — also in CLAUDE.md)
1. Migrations are append-only. Never edit an applied migration, never `DROP` a table with player data, never
   delete-and-recreate. A pre-migration backup is taken and verified automatically when there is data.
2. Money, XP/level, inventory, wardrobe, vehicles, quest progress and rewards change **only** through
   `runOp` → `store.commit` (one transaction). The reply is sent after COMMIT; on any error the op reports failure and
   nothing is charged or paid.
3. Every balance change has ledger rows that sum exactly to the change (checked inside the transaction).
4. One-time rewards are rows in `claims` (PRIMARY KEY) → a duplicate claim is impossible even under a race.
5. Requests that move money carry a `rid`; a replayed `rid` returns the stored result and is not applied again.
6. The client never sends amounts. Jobs: `job start` → server ticket (single use, min duration, cooldown; route jobs check
   pickup/drop-off against the replicated position and a 45 m/s travel-time floor) → `job finish` → server wage.
7. Client-reported state (`save`) may only change cosmetic / needs / soft-progress fields, bounded and rate-limited
   (skills ≤ +0.25/s; fuel only rises right after a paid refuel). LocalStorage is never evidence of anything online.
8. Accounts: the device token (192-bit) is a bearer secret; only its SHA-256 is stored. Players can copy it as a
   "recovery code" (phone → Settings) to move to another device. Client-sent player ids are never trusted.
9. Rate limits: 8 RPC/s per player (burst 20), 40 connections/min and 10 new characters/hour per IP (in memory, IPs never
   stored), chat 0.9 s, transfers 3 s and only from level 3 or 30 min playtime (anti alt-farming).

## Backups & restore
- Snapshots use `VACUUM INTO` (consistent while the server is writing) and are verified (`integrity_check`, schema, counts).
- `npm run backup` · `node tools/db.js list | verify [file] | info` · `node tools/db.js restore <file>` (refuses while the
  server runs; backs up the current DB first; verifies after).
- Owner trainer → Server → **Download database** streams a fresh verified snapshot. On Render Free this download is the
  only backup that survives a restart.

## Owner trainer (admin)
Key: `ADMIN_KEY` env var (24+ chars) or, locally only, auto-generated `data/admin-key.txt` (printed in the server window).
Unlock: type `/admin <key>` in chat (wrong keys get the same reply as an unknown command; 5 wrong tries → 15 min lockout).
The UI module lives in `server/admin-ui.js`, outside `/public`, and is served once per unlock from a random URL.
Server ops (money, XP, level, items, clothes, vehicles, quest, rename, heal, teleport, kick, mute, ban, announce, backup,
download, integrity, logs) are validated server-side and written to `admin_log`. Local-only tools: god mode, infinite
fuel, speed/jump multipliers, teleport, time-of-day (06:45–17:36 only) and weather preview.
If the GitHub repository is public, the trainer *code* is visible there — the key is what protects it.

## Verification
`npm run test:db` — 70 checks · `npm run test:life` — 51 checks (homes, business, jobs, orders, social) · `npm run test:world` — 39 checks (garage, KU Shop,
fishing, events, player rides, voice relay). Both run real server
processes on a temp folder; your data is never touched.

## Player log (owner only)
`data/logs/sessions-YYYY-MM.csv` gets one line per finished session (player, account, faculty, level, login/logout in
Asia/Bangkok time, minutes, total playtime, end reason). The trainer's Log tab shows the same and downloads a full CSV.
On Render Free the file is erased with the disk — download it from the trainer.
