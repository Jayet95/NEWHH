'use strict';
// Battle backdrops supplied as six 16:9 paintings -> art/battle/bg_<name>.webp   node tools/import_battle_bg.js "<folder with the six images in this order>"
const fs = require('fs'), path = require('path'), sharp = require('sharp');
const SRC = process.argv[2], names = ['desert', 'grass', 'ship', 'snow', 'swamp', 'lava'], files = process.argv.slice(3);
if (!SRC || files.length !== 6) { console.error('usage: node tools/import_battle_bg.js <folder> f1 f2 f3 f4 f5 f6   (desert grass ship snow swamp lava)'); process.exit(1); }
(async () => {
  for (let i = 0; i < 6; i++) { const to = path.join(__dirname, '..', 'art', 'battle', 'bg_' + names[i] + '.webp'); const info = await sharp(path.join(SRC, files[i])).resize(1280, 726, { fit: 'cover' }).webp({ quality: 74, effort: 4 }).toFile(to); console.log(names[i], Math.round(info.size / 1024) + ' KB'); }
  require('./make_manifest')(path.join(__dirname, '..'));
})();
