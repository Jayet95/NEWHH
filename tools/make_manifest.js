'use strict';
// Scans art/ and writes art/manifest.json listing every image the game can use, and scans audio/sfx/ and writes
// audio/sfx/index.json listing the creature sound files (<creature id>_<attack|defend|death|shoot>.mp3) and audio/music/ for castle themes (<castle>_<town|battle|map>.mp3).   node tools/make_manifest.js
const fs = require('fs'), path = require('path');
function make(root) {
  const sfx = path.join(root, 'audio', 'sfx');
  fs.mkdirSync(sfx, { recursive: true });
  const sounds = fs.readdirSync(sfx).filter(f => /\.(mp3|ogg|wav|m4a|webm)$/i.test(f)).sort();
  fs.writeFileSync(path.join(sfx, 'index.json'), JSON.stringify(sounds, null, 1));
  const mus = path.join(root, 'audio', 'music');
  fs.mkdirSync(mus, { recursive: true });
  fs.writeFileSync(path.join(mus, 'index.json'), JSON.stringify(fs.readdirSync(mus).filter(f => /\.(mp3|ogg|wav|m4a|webm)$/i.test(f)).sort(), null, 1));
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
