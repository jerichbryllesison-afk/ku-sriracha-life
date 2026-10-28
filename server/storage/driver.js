// SQLite driver adapter. Primary: Node's built-in `node:sqlite` (Node >= 22.13, no install).
// Fallback: `better-sqlite3` (optional dependency) for older Node versions.
// Exposes one small synchronous interface so the rest of the server never touches a driver directly:
//   exec(sql) · get(sql, ...p) · all(sql, ...p) · run(sql, ...p) → { changes, lastId } · tx(fn) · close()
'use strict';

function loadNodeSqlite() {
  // node:sqlite prints an ExperimentalWarning on load; silence only that one message.
  const orig = process.emitWarning;
  process.emitWarning = function (w, ...a) { if (String(w && w.message || w).includes('SQLite')) return; return orig.call(process, w, ...a); };
  try { return require('node:sqlite'); } catch (e) { return null; } finally { process.emitWarning = orig; }
}
function loadBetter() { try { return require('better-sqlite3'); } catch (e) { return null; } }

function open(file) {
  const ns = loadNodeSqlite();
  let raw, engine, prep;
  if (ns && ns.DatabaseSync) {
    raw = new ns.DatabaseSync(file); engine = 'node:sqlite';
    const cache = new Map();
    prep = (sql) => { let s = cache.get(sql); if (!s) { s = raw.prepare(sql); cache.set(sql, s); } return s; };
  } else {
    const B = loadBetter();
    if (!B) throw new Error('No SQLite driver: use Node.js 22.13 or newer (built-in node:sqlite) or run `npm install better-sqlite3`.');
    raw = new B(file); engine = 'better-sqlite3';
    const cache = new Map();
    prep = (sql) => { let s = cache.get(sql); if (!s) { s = raw.prepare(sql); cache.set(sql, s); } return s; };
  }
  const norm = (p) => p.map(v => v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v);
  let depth = 0, spN = 0;
  const db = {
    engine, file,
    exec(sql) { raw.exec(sql); },
    get(sql, ...p) { return prep(sql).get(...norm(p)); },
    all(sql, ...p) { return prep(sql).all(...norm(p)); },
    run(sql, ...p) { const r = prep(sql).run(...norm(p)); return { changes: Number(r.changes), lastId: Number(r.lastInsertRowid) }; },
    // Atomic transaction. Nested calls use savepoints. Any throw rolls back everything inside and re-throws.
    tx(fn) {
      if (depth === 0) {
        raw.exec('BEGIN IMMEDIATE'); depth++;
        try { const out = fn(); raw.exec('COMMIT'); return out; } catch (e) { try { raw.exec('ROLLBACK'); } catch (_) { } throw e; } finally { depth--; }
      }
      const sp = 'sp' + (++spN); raw.exec('SAVEPOINT ' + sp); depth++;
      try { const out = fn(); raw.exec('RELEASE ' + sp); return out; } catch (e) { try { raw.exec('ROLLBACK TO ' + sp); raw.exec('RELEASE ' + sp); } catch (_) { } throw e; } finally { depth--; }
    },
    get inTx() { return depth > 0; },
    close() { try { raw.close(); } catch (e) { } },
    sqliteVersion() { try { return db.get('select sqlite_version() v').v; } catch (e) { return '?'; } },
  };
  return db;
}

module.exports = { open };
