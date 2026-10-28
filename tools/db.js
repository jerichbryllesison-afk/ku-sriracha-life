#!/usr/bin/env node
// Database maintenance (run from the game folder):
//   node tools/db.js info                 → storage mode, engine, schema version, row counts
//   node tools/db.js verify [file]        → integrity check of the live DB or a backup file
//   node tools/db.js backup [dest.db]     → consistent snapshot (safe while the server runs) + verification
//   node tools/db.js list                 → backups in data/backups
//   node tools/db.js restore <file.db>    → restore a backup (server must be STOPPED; current DB is backed up first)
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const DB = path.join(DATA_DIR, 'kusl.db');
const { verifyFile } = require('../server/storage/store');
const driver = require('../server/storage/driver');
const { detect } = require('../server/storage/mode');

const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
const fail = (m) => { console.error('✖ ' + m); process.exit(1); };
function serverRunning() {
  try { const pid = Number(fs.readFileSync(path.join(DATA_DIR, 'server.pid'), 'utf8')); if (!pid) return false; process.kill(pid, 0); return pid; } catch (e) { return e.code === 'EPERM'; }
}
function snapshot(dest) {
  if (!fs.existsSync(DB)) fail('No database yet at ' + DB + ' (start the server once).');
  fs.mkdirSync(path.dirname(dest), { recursive: true }); if (fs.existsSync(dest)) fs.unlinkSync(dest);
  const d = driver.open(DB); try { d.exec('PRAGMA busy_timeout = 5000'); d.run('VACUUM INTO ?', dest); } finally { d.close(); }
  return verifyFile(dest);
}
const show = (v) => console.log(`${v.ok ? '✔' : '✖'} ${v.file}\n  ${(v.bytes / 1024).toFixed(0)} KB · schema v${v.schema} · ${v.accounts} account(s) · ${v.characters} character(s)${v.error ? ' · ' + v.error : ''}`);

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'info' || !cmd) {
  const s = detect(process.env, DATA_DIR, ROOT);
  console.log(`storage mode : ${s.mode.toUpperCase()} (host ${s.host})${s.warnings.length ? '\n  ⚠ ' + s.warnings.join('\n  ⚠ ') : ''}`);
  console.log(`database     : ${DB}${fs.existsSync(DB) ? '' : ' (not created yet)'}`);
  if (fs.existsSync(DB)) { const d = driver.open(DB); try { console.log(`engine       : ${d.engine} · SQLite ${d.sqliteVersion()}`); const mig = d.all('SELECT id, name, applied_at FROM schema_migrations ORDER BY id'); console.log('migrations   : ' + mig.map(m => m.id + ':' + m.name).join(', ')); for (const t of ['accounts', 'characters', 'ledger', 'sessions', 'vehicles', 'inventory', 'claims']) console.log(`  ${t.padEnd(11)} ${d.get(`SELECT count(*) n FROM ${t}`).n}`); } finally { d.close(); } }
  console.log(`server       : ${serverRunning() ? 'running' : 'stopped'}`);
} else if (cmd === 'verify') {
  const v = verifyFile(arg ? path.resolve(arg) : DB); show(v); process.exit(v.ok ? 0 : 1);
} else if (cmd === 'backup') {
  const v = snapshot(arg ? path.resolve(arg) : path.join(DATA_DIR, 'backups', `manual-${stamp()}.db`)); show(v); process.exit(v.ok ? 0 : 1);
} else if (cmd === 'list') {
  const dir = path.join(DATA_DIR, 'backups'); const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.db')).sort().reverse() : [];
  if (!files.length) console.log('No backups yet.'); for (const f of files) console.log(`${f}  ${(fs.statSync(path.join(dir, f)).size / 1024).toFixed(0)} KB`);
} else if (cmd === 'restore') {
  if (!arg) fail('Usage: node tools/db.js restore <backup.db>');
  if (serverRunning()) fail('The server is running — stop it first (close the server window / Ctrl+C), then restore.');
  const src = path.resolve(arg); const v = verifyFile(src); show(v); if (!v.ok) fail('Backup failed verification — nothing was changed.');
  if (fs.existsSync(DB)) { const safety = snapshot(path.join(DATA_DIR, 'backups', `pre-restore-${stamp()}.db`)); if (!safety.ok) fail('Could not back up the current database — nothing was changed.'); console.log('✔ current database saved as ' + path.basename(safety.file)); }
  const tmp = DB + '.restore-tmp'; fs.copyFileSync(src, tmp);
  for (const ext of ['-wal', '-shm']) { try { fs.unlinkSync(DB + ext); } catch (e) { } }
  fs.renameSync(tmp, DB);
  const after = verifyFile(DB); show(after); if (!after.ok) fail('Restored file failed verification — use the pre-restore backup.');
  console.log('✔ restored. Start the server normally.');
} else fail('Unknown command. Use: info | verify [file] | backup [dest] | list | restore <file>');
