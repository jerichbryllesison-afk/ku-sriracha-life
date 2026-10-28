// exit 0 if a SQLite driver is available (built-in node:sqlite or better-sqlite3), else 3 — used by start.bat
const orig = process.emitWarning; process.emitWarning = () => { };
try { require('node:sqlite'); process.exit(0); } catch (e) { }
try { require('better-sqlite3'); process.exit(0); } catch (e) { }
process.emitWarning = orig; process.exit(3);
