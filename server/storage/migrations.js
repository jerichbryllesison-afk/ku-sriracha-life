// Ordered, append-only schema migrations. RULES: never edit or reorder an applied migration, never DROP a table
// holding player data, never "delete and recreate" — add a new migration that ALTERs / copies forward instead.
// Each migration runs inside one transaction together with its schema_migrations row, so it applies fully or not at all.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MIGRATIONS = [
  {
    id: 1, name: 'core_schema', up(db) {
      db.exec(`
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER,
  banned INTEGER NOT NULL DEFAULT 0 CHECK (banned IN (0,1)),
  ban_reason TEXT,
  muted_until INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS characters (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 24),
  name_key TEXT NOT NULL UNIQUE,
  name_changed_at INTEGER NOT NULL DEFAULT 0,
  faculty TEXT NOT NULL DEFAULT 'eng',
  program TEXT NOT NULL DEFAULT '',
  student_id TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 60),
  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  money INTEGER NOT NULL DEFAULT 0 CHECK (money >= 0),
  main_quest INTEGER NOT NULL DEFAULT 0 CHECK (main_quest >= 0),
  last_allowance_day INTEGER NOT NULL DEFAULT -1,
  playtime_s INTEGER NOT NULL DEFAULT 0 CHECK (playtime_s >= 0),
  active_s INTEGER NOT NULL DEFAULT 0 CHECK (active_s >= 0),
  data TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS inventory (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0 AND qty <= 999),
  PRIMARY KEY (account_id, item_id)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS wardrobe (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  acquired_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, item_id)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS hairs (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  hair_id TEXT NOT NULL,
  acquired_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, hair_id)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  color TEXT NOT NULL,
  fuel REAL NOT NULL DEFAULT 1 CHECK (fuel >= 0 AND fuel <= 1),
  acquired_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS vehicles_owner ON vehicles(account_id);
CREATE TABLE IF NOT EXISTS housing (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL,
  tier TEXT NOT NULL,
  acquired_at INTEGER NOT NULL,
  expires_at INTEGER,
  PRIMARY KEY (account_id, property_id)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS friends (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  friend_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending','accepted','blocked')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, friend_id),
  CHECK (account_id <> friend_id)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS achievements (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  unlocked_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, achievement_id)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS claims (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  claim_key TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, claim_key)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  kind TEXT NOT NULL,
  ref TEXT,
  counterparty TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ledger_account ON ledger(account_id, id);
CREATE TABLE IF NOT EXISTS requests (
  account_id TEXT NOT NULL,
  rid TEXT NOT NULL,
  op TEXT NOT NULL,
  result TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, rid)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS requests_age ON requests(created_at);
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  started_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  ended_at INTEGER,
  end_reason TEXT,
  client TEXT
);
CREATE INDEX IF NOT EXISTS sessions_account ON sessions(account_id, started_at);
CREATE INDEX IF NOT EXISTS sessions_open ON sessions(ended_at) WHERE ended_at IS NULL;
CREATE TABLE IF NOT EXISTS name_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  old_name TEXT, new_name TEXT NOT NULL, changed_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL, action TEXT NOT NULL, target TEXT, detail TEXT
);
CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL) WITHOUT ROWID;
`);
    },
  },
  {
    // One-time import of the pre-database save file. The JSON file itself is left untouched on disk.
    id: 2, name: 'import_players_json', up(db, ctx) {
      const file = path.join(ctx.dataDir, 'players.json');
      let src = null; try { src = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { src = null; }
      const now = Date.now(); let n = 0, skipped = 0;
      if (src && typeof src === 'object') {
        for (const [key, p] of Object.entries(src)) {
          if (!/^[a-f0-9]{32}$/.test(key) || !p || typeof p !== 'object') { skipped++; continue; }
          if (db.get('SELECT 1 FROM accounts WHERE token_hash = ?', key)) { skipped++; continue; }
          ctx.importProfile(db, key, p, now); n++;
        }
      }
      db.run('INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)', 'json_import', JSON.stringify({ at: now, file: src ? 'players.json' : null, imported: n, skipped }));
      ctx.log(`[db] players.json import: ${src ? `${n} profile(s) imported, ${skipped} skipped (file kept unchanged)` : 'no players.json found — nothing to import'}`);
    },
  },
  {
    id: 3, name: 'world_seed', up(db) {
      if (!db.get("SELECT 1 FROM kv WHERE k = 'world_seed'")) db.run('INSERT INTO kv (k, v) VALUES (?, ?)', 'world_seed', String(crypto.randomBytes(4).readUInt32BE(0)));
    },
  },
  {
    // living-campus update: homes, own business, social feed, direct messages, player-to-player food orders
    id: 4, name: 'social_life', up(db) {
      db.exec(`
ALTER TABLE characters ADD COLUMN home TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS housing_property_unique ON housing(property_id);
CREATE TABLE IF NOT EXISTS businesses (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, place_id TEXT NOT NULL, level INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 10),
  sales INTEGER NOT NULL DEFAULT 0 CHECK (sales >= 0), opened_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  mime TEXT NOT NULL, bytes BLOB NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  text TEXT NOT NULL, place TEXT, media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL, hidden INTEGER NOT NULL DEFAULT 0, reports INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS posts_author ON posts(account_id, id);
CREATE TABLE IF NOT EXISTS post_likes (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL, PRIMARY KEY (post_id, account_id)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS post_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, text TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS post_comments_post ON post_comments(post_id, id);
CREATE TABLE IF NOT EXISTS post_reports (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE, account_id TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (post_id, account_id)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT, from_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  to_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, text TEXT NOT NULL, created_at INTEGER NOT NULL, read_at INTEGER
);
CREATE INDEX IF NOT EXISTS messages_to ON messages(to_id, id);
CREATE INDEX IF NOT EXISTS messages_from ON messages(from_id, id);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT, buyer_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, rider_id TEXT,
  shop TEXT NOT NULL, items TEXT NOT NULL, food_cost INTEGER NOT NULL CHECK (food_cost > 0), fee INTEGER NOT NULL CHECK (fee >= 0),
  dest TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('open','accepted','picked','delivered','npc','cancelled','expired')),
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_status ON orders(status, id);
`);
    },
  },
  {
    // vehicle tuning + wear, online-shop parcels, player ride requests
    id: 5, name: 'garage_shop_rides', up(db) {
      db.exec(`
ALTER TABLE vehicles ADD COLUMN mods TEXT NOT NULL DEFAULT '{}';
ALTER TABLE vehicles ADD COLUMN condition REAL NOT NULL DEFAULT 1 CHECK (condition >= 0 AND condition <= 1);
CREATE TABLE IF NOT EXISTS parcels (
  id INTEGER PRIMARY KEY AUTOINCREMENT, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  items TEXT NOT NULL, total INTEGER NOT NULL CHECK (total >= 0), status TEXT NOT NULL CHECK (status IN ('shipping','delivered')),
  eta INTEGER NOT NULL, created_at INTEGER NOT NULL, delivered_at INTEGER
);
CREATE INDEX IF NOT EXISTS parcels_status ON parcels(status, eta);
CREATE TABLE IF NOT EXISTS rides (
  id INTEGER PRIMARY KEY AUTOINCREMENT, passenger_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, driver_id TEXT,
  pickup TEXT NOT NULL, dest TEXT NOT NULL, fare INTEGER NOT NULL CHECK (fare > 0),
  status TEXT NOT NULL CHECK (status IN ('open','accepted','boarded','done','cancelled','expired')), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS rides_status ON rides(status, id);
`);
    },
  },
];

function pending(db) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL)');
  const done = new Set(db.all('SELECT id FROM schema_migrations').map(r => Number(r.id)));
  return MIGRATIONS.filter(m => !done.has(m.id));
}

function migrate(db, ctx) {
  const todo = pending(db); const applied = [];
  for (const m of todo) {
    db.tx(() => { m.up(db, ctx); db.run('INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)', m.id, m.name, Date.now()); });
    applied.push(m.id + ':' + m.name);
  }
  return applied;
}

module.exports = { MIGRATIONS, migrate, pending, latest: MIGRATIONS[MIGRATIONS.length - 1].id };
