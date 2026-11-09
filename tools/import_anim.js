'use strict';
// Installs creature animation frames into art/anim for the web: each frame is scaled to half size (a 640x512 painting becomes 320x256,
// still twice as big as the creature is ever shown) and saved as near-lossless WebP. All frames of a creature keep the same size and
// the same feet position, so the game's anchoring is unchanged.
//   node tools/import_anim.js <folder that contains the creature folders, e.g. the unzipped art/anim> [scale=0.5]
const fs = require('fs'), path = require('path'), sharp = require('sharp');
const src = process.argv[2], scale = parseFloat(process.argv[3] || '0.5'), out = path.join(__dirname, '..', 'art', 'anim');
if (!src || !fs.existsSync(src)) { console.log('usage: node tools/import_anim.js <folder with creature folders> [scale]'); process.exit(1); }
(async () => {
  let n = 0, bytes = 0;
  for (const id of fs.readdirSync(src, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort()) {
    const dst = path.join(out, id); fs.mkdirSync(dst, { recursive: true });
    for (const f of fs.readdirSync(path.join(src, id)).filter(f => /\.(webp|png)$/i.test(f)).sort()) {
      const img = sharp(path.join(src, id, f)), m = await img.metadata(), file = path.join(dst, f.replace(/\.[a-z]+$/i, '.webp'));
      await img.resize(Math.round(m.width * scale), Math.round(m.height * scale), { kernel: 'lanczos3' }).webp({ quality: 92, alphaQuality: 100, effort: 5 }).toFile(file);
      n++; bytes += fs.statSync(file).size;
    }
  }
  console.log(`imported ${n} frames, ${(bytes / 1048576).toFixed(1)} MB`);
  require('./make_manifest')(path.join(__dirname, '..'));
})();
