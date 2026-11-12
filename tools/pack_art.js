'use strict';
// Bundles art/ into a few big pack files so a phone makes a handful of requests instead of thousands.
//   node tools/pack_art.js [outDir]      (default art/packs; tools/build.js writes dist/art/packs)
// packs/index.json: { packs: [{ f, n, core }], files: { "<stem>": [pack, offset, length, "webp|png|..."] } }
// The game falls back to the single files when the packs are not there (for example the python dev server).
const fs = require('fs'), path = require('path');
const LATER = /^(poses|mounted|anim|buildings)\/|^ui\/(castle_select|hero_select|adventure|town_)/;
function pack(root, outDir) {
  const art = path.join(root, 'art'), list = JSON.parse(fs.readFileSync(path.join(art, 'manifest.json'), 'utf8')).files;
  outDir = outDir || path.join(art, 'packs'); fs.rmSync(outDir, { recursive: true, force: true }); fs.mkdirSync(outDir, { recursive: true });
  const stem = (f) => f.replace(/\.(png|webp|jpe?g|svg|gif)$/i, '');
  const groups = []; const add = (name, core, files) => { if (files.length) groups.push({ name, core, files }); };
  add('core', true, list.filter(f => !LATER.test(stem(f))));
  add('buildings', false, list.filter(f => /^buildings\//.test(f)));
  add('ui', false, list.filter(f => /^ui\/(castle_select|hero_select|adventure|town_)/.test(stem(f))));
  add('poses', false, list.filter(f => /^(poses|mounted)\//.test(f)));
  // animation frames: whole creature folders together, about 10 MB per pack
  const anim = list.filter(f => /^anim\//.test(f)), byDir = {}; anim.forEach(f => { (byDir[f.split('/')[1]] = byDir[f.split('/')[1]] || []).push(f); });
  let cur = [], sz = 0, k = 0;
  for (const d of Object.keys(byDir).sort()) { const s = byDir[d].reduce((a, f) => a + fs.statSync(path.join(art, f)).size, 0); if (cur.length && sz + s > 10e6) { add('anim' + (++k), false, cur); cur = []; sz = 0; } cur.push(...byDir[d]); sz += s; }
  add('anim' + (++k), false, cur);
  const index = { packs: [], files: {} };
  groups.forEach((g, gi) => {
    const bufs = []; let off = 0;
    g.files.forEach(f => { const b = fs.readFileSync(path.join(art, f)); index.files[stem(f)] = [gi, off, b.length, path.extname(f).slice(1).toLowerCase()]; bufs.push(b); off += b.length; });
    fs.writeFileSync(path.join(outDir, g.name + '.bin'), Buffer.concat(bufs));
    index.packs.push({ f: g.name + '.bin', n: off, core: g.core });
  });
  fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(index));
  return index.packs;
}
module.exports = pack;
if (require.main === module) { const p = pack(path.join(__dirname, '..'), process.argv[2]); console.log(p.map(x => x.f + ' ' + (x.n / 1e6).toFixed(1) + 'MB' + (x.core ? ' (core)' : '')).join('\n')); }
