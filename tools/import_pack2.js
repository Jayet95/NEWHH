'use strict';
// Second art pack: creature dwellings (9 castles x 7) and the neutral creatures missing from the first pack.
//   node tools/import_pack2.js "<folder containing dwellings-* and neutral-creatures>"
const fs = require('fs'), path = require('path'), vm = require('vm');
const sharp = require('sharp');
const SRC = process.argv[2];
if (!SRC || !fs.existsSync(path.join(SRC, 'neutral-creatures'))) { console.error('usage: node tools/import_pack2.js "<pack folder>"'); process.exit(1); }
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'art');
const ctx = { console, Math }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/data.js'), 'utf8') + '\nthis.D = { FD };', ctx);
const { FD } = ctx.D;
const kebab = (s) => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const jobs = [];
const job = (from, to, opt) => jobs.push(Object.assign({ from, to }, opt));

// dwellings: file "<creature>-<building>.png" in dwellings-<castle>/ -> buildings/<castle><tier> and objects/dwelling_<castle><tier>
for (const f of Object.keys(FD)) {
  const dir = path.join(SRC, 'dwellings-' + f); if (!fs.existsSync(dir)) { console.warn('no folder for', f); continue; }
  const files = fs.readdirSync(dir).filter(n => /\.png$/i.test(n));
  FD[f].forEach((row, i) => {
    const k0 = kebab(row[0]), parts = k0.split('-'), names = [k0, kebab(row[1]), k0.replace(/t$/, 'ti'), parts[0], parts[parts.length - 1]];   // e.g. Efreet / Efreeti
    let best = null; for (const n of names) for (const file of files) if (file.startsWith(n + '-') && (!best || n.length > best.n.length)) best = { file, n };
    if (!best) { console.warn('no dwelling file for', f, row[0], files.join(',')); return; }
    const id = f + (i + 1), from = path.join(dir, best.file);
    job(from, path.join(OUT, 'buildings', id + '.webp'), { w: 256, h: 288, fit: 'inside', trim: true, q: 78 });
    job(from, path.join(OUT, 'objects', 'dwelling_' + id + '.webp'), { w: 150, h: 150, fit: 'inside', trim: true, q: 78 });
  });
}
// neutral dwellings reuse the matching castle dwelling picture
const NDW = { goblin: 'stronghold1', wolf: 'stronghold2', orc: 'stronghold3', ogre: 'stronghold4', golem: 'tower3', naga: 'tower6', troll: 'stronghold5' };
for (const k in NDW) for (const d of ['buildings', 'objects']) { const a = path.join(OUT, d, (d === 'objects' ? 'dwelling_' : '') + NDW[k] + '.webp'); if (fs.existsSync(a)) fs.copyFileSync(a, path.join(OUT, d, (d === 'objects' ? 'dwelling_' : '') + k + '.webp')); }
// neutral creatures: one picture each -> portrait + the same picture as every battle pose (mirrored for the enemy side)
const NEUT = { 'azure-dragon': 'azured', 'crystal-dragon': 'crystald', 'faerie-dragon': 'faerie', 'rust-dragon': 'rustd', kraken: 'kraken', shark: 'shark', troll: 'troll' };
for (const k in NEUT) {
  const from = path.join(SRC, 'neutral-creatures', k + '.png'), id = NEUT[k];
  job(from, path.join(OUT, 'portraits', id + '.webp'), { w: 160, h: 160, fit: 'inside', trim: true, q: 76 });
  for (const st of ['idle', 'fighting', 'defending']) {
    job(from, path.join(OUT, 'poses', 'right', st, id + '.webp'), { w: 150, h: 150, fit: 'inside', trim: true, q: 72 });
    job(from, path.join(OUT, 'poses', 'left', st, id + '.webp'), { w: 150, h: 150, fit: 'inside', trim: true, q: 72, flop: true });
  }
}
(async () => {
  console.log(jobs.length + ' images');
  let ok = 0;
  for (const j of jobs) {
    try {
      fs.mkdirSync(path.dirname(j.to), { recursive: true });
      let img = sharp(j.from); if (j.trim) img = img.trim({ threshold: 8 }); if (j.flop) img = img.flop();
      await img.resize(j.w, j.h, { fit: j.fit || 'cover', withoutEnlargement: true, background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: j.q, alphaQuality: 80, effort: 4 }).toFile(j.to); ok++;
    } catch (e) { console.warn('FAIL', path.basename(j.from), e.message); }
  }
  console.log(ok + ' written');
  require('./make_manifest')(ROOT);
})();
