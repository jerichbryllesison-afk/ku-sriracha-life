// Storage-mode detection. Decides — and reports honestly — whether the database file will survive restarts.
// local machine            → persistent (file on your disk)
// Render / Railway / Fly / Heroku / Cloud Run without a declared disk → EPHEMERAL (file is wiped on restart, redeploy or sleep)
// Override: STORAGE_MODE=persistent|ephemeral, or PERSISTENT_DATA=1 together with DATA_DIR=<mounted disk path>.
'use strict';
const fs = require('fs');
const path = require('path');

function hostOf(env) {
  if (env.RENDER) return 'render';
  if (env.RAILWAY_ENVIRONMENT || env.RAILWAY_PROJECT_ID) return 'railway';
  if (env.FLY_APP_NAME) return 'fly';
  if (env.DYNO) return 'heroku';
  if (env.K_SERVICE) return 'cloudrun';
  if (env.VERCEL) return 'vercel';
  if (env.CODESPACES || env.REPL_ID) return 'cloud-ide';
  return 'local';
}

function detect(env, dataDir, appDir) {
  const host = hostOf(env);
  const forced = String(env.STORAGE_MODE || '').toLowerCase();
  const declared = env.PERSISTENT_DATA === '1' || forced === 'persistent';
  let mode = forced === 'ephemeral' ? 'ephemeral' : declared ? 'persistent' : host === 'local' ? 'persistent' : 'ephemeral';
  const warnings = [];
  // A declared persistent disk on a cloud host should be a different filesystem than the app itself.
  if (mode === 'persistent' && host !== 'local') {
    try { if (fs.statSync(dataDir).dev === fs.statSync(appDir).dev) warnings.push('PERSISTENT_DATA is set but DATA_DIR is on the same filesystem as the app — this is probably NOT a mounted persistent disk.'); } catch (e) { }
  }
  if (mode === 'ephemeral') warnings.push(host === 'render'
    ? 'Render Free has an ephemeral filesystem: the database is erased on every restart, redeploy or sleep (about 15 min idle). Download backups from the admin panel, or attach a persistent disk / external database later.'
    : 'This host does not guarantee a persistent filesystem: the database may be erased on restart or redeploy.');
  return {
    mode, host, persistent: mode === 'persistent', declared, dataDir: path.resolve(dataDir), warnings,
    note_en: mode === 'persistent' ? 'Progress is saved on this server.' : 'Test server: progress is stored temporarily and may be lost when the server restarts, updates or sleeps.',
    note_th: mode === 'persistent' ? 'ความคืบหน้าบันทึกไว้บนเซิร์ฟเวอร์นี้' : 'เซิร์ฟเวอร์ทดลอง: ข้อมูลเก็บแบบชั่วคราว อาจหายเมื่อเซิร์ฟเวอร์รีสตาร์ท อัปเดต หรือหลับ',
  };
}

module.exports = { detect, hostOf };
