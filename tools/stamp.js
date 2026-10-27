// Cache-busting build stamp: rewrites the import map in public/index.html so every game module URL carries ?v=<stamp>.
// Run after changing client files:  node tools/stamp.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', 'public'); const v = Date.now().toString(36);
const imports = { three: './vendor/three/build/three.module.min.js', 'three/addons/': './vendor/three/addons/' };
for (const dir of ['js', 'shared']) for (const f of fs.readdirSync(path.join(root, dir))) if (f.endsWith('.js')) imports[`./${dir}/${f}`] = `./${dir}/${f}?v=${v}`;
const file = path.join(root, 'index.html'); let html = fs.readFileSync(file, 'utf8');
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>/, `<script type="importmap">${JSON.stringify({ imports })}</script>`);
html = html.replace(/css\/style\.css(\?v=[a-z0-9]+)?/, `css/style.css?v=${v}`).replace(/js\/main\.js(\?v=[a-z0-9]+)?"/, `js/main.js?v=${v}"`);
fs.writeFileSync(file, html); console.log('stamped', v, Object.keys(imports).length, 'entries');
