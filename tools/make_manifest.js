'use strict';
// Scans art/ and writes art/manifest.json listing every image the game can use.   node tools/make_manifest.js
const fs = require('fs'), path = require('path');
function make(root) {
  const dir = path.join(root, 'art'); if (!fs.existsSync(dir)) return 0;
  const files = [];
  const walk = (d, rel) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    if (e.isDirectory()) walk(path.join(d, e.name), rel + e.name + '/');
    else if (/\.(png|webp|jpe?g|svg|gif)$/i.test(e.name)) files.push(rel + e.name);
  });
  walk(dir, '');
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ files: files.sort() }, null, 1));
  return files.length;
}
module.exports = make;
if (require.main === module) { const n = make(path.join(__dirname, '..')); console.log(n ? `art/manifest.json written (${n} images)` : 'no art/ folder yet — create it and add images (see ART.md)'); }
