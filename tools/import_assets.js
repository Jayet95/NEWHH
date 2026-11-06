'use strict';
// Converts the supplied art pack (src/assets with h3 / h3-map / h3-poses) into small WebP files in art/ named the way the game expects.
//   node tools/import_assets.js "<path to src/assets>"            (uses sharp; takes a few minutes)
const fs = require('fs'), path = require('path'), vm = require('vm');
const sharp = require('sharp');
const SRC = process.argv[2];
if (!SRC || !fs.existsSync(path.join(SRC, 'h3'))) { console.error('usage: node tools/import_assets.js "<path to src/assets>"'); process.exit(1); }
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'art');

const ctx = { console, Math }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/data.js'), 'utf8') + '\nthis.D = { C, FD, HEROES };', ctx);
const { FD, HEROES } = ctx.D;
const kebab = (s) => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const ALIAS = { efreet: 'efreeti' };
const cat = JSON.parse(fs.readFileSync(path.join(SRC, 'h3-map/catalog.json'), 'utf8'));
const mcat = JSON.parse(fs.readFileSync(path.join(SRC, 'h3-map/mounted-catalog.json'), 'utf8'));
const find = (group, name) => { const e = cat.find(x => x.group === group && x.name === name); if (!e) throw new Error('catalog: ' + group + '/' + name); return path.join(SRC, 'h3-map', e.file); };

const jobs = [];   // { from, to, w, h, fit, q, fmt }
const job = (from, to, opt) => { if (!fs.existsSync(from)) { console.warn('missing source', from); return; } jobs.push(Object.assign({ from, to }, opt)); };

// ---- creature portraits (square paintings) + battle poses ----
const bases = {};   // id -> asset name
for (const f in FD) FD[f].forEach((row, i) => { bases[f + (i + 1)] = [kebab(row[0]), kebab(row[1])]; });
Object.assign(bases, { goblin: ['goblin'], wolf: ['wolf-rider'], orc: ['orc'], ogre: ['ogre'], golem: ['stone-golem'], naga: ['naga'], dragon: ['green-dragon'] });
for (const id in bases) {
  bases[id].forEach((name, k) => {
    name = ALIAS[name] || name; const sfx = k === 1 ? '_up' : '';
    job(path.join(SRC, 'h3', name + '.jpg'), path.join(OUT, 'portraits', id + sfx + '.webp'), { w: 160, h: 160, q: 74 });
    for (const side of ['left', 'right']) for (const st of ['idle', 'fighting', 'defending'])
      job(path.join(SRC, 'h3-poses', side, st, name + '.png'), path.join(OUT, 'poses', side, st, id + sfx + '.webp'), { w: 150, h: 150, fit: 'inside', trim: true, q: 70 });
  });
}
// ---- heroes: portraits + mounted map sprites ----
for (const id in HEROES) job(path.join(SRC, 'h3', kebab(id) + '.jpg'), path.join(OUT, 'heroes', id + '.webp'), { w: 160, h: 160, q: 74 });
for (const e of mcat) job(path.join(SRC, 'h3-map', e.file), path.join(OUT, 'mounted', e.hero + '_' + e.direction + '.webp'), { w: 110, h: 110, fit: 'inside', trim: true, q: 72 });
// ---- map objects ----
const OBJ = {
  town_castle: ['towns-good', 'Castle'], town_rampart: ['towns-good', 'Rampart'], town_tower: ['towns-good', 'Tower'], town_inferno: ['towns-dark', 'Inferno'], town_necropolis: ['towns-dark', 'Necropolis'], town_dungeon: ['towns-dark', 'Dungeon'],
  town_stronghold: ['towns-wild', 'Stronghold'], town_fortress: ['towns-wild', 'Fortress'], town_conflux: ['towns-wild', 'Conflux'],
  mine_wood: ['mines', 'Sawmill'], mine_ore: ['mines', 'Ore Pit'], mine_mercury: ['mines', 'Mercury Lab'], mine_sulfur: ['mines', 'Sulfur Mine'], mine_crystal: ['mines', 'Crystal Cavern'], mine_gems: ['mines', 'Gem Mine'], mine_gold: ['mines', 'Gold Mine'],
  resobj_windmill: ['mines', 'Windmill'], resobj_waterwheel: ['locations', 'Water Wheel'], resobj_garden: ['magic', 'Mystical Garden'],
  stone: ['waypoints', 'Learning Stone'], shrine: ['magic', 'Shrine'], tower: ['locations', 'Lookout Tower'], seer: ['waypoints', 'Seer Hut'], mono: ['magic', 'Monolith Portal'], spring: ['magic', 'Magic Well'],
  bank_utopia: ['encounters', 'Dragon Utopia'], lair: ['encounters', 'Dragon Utopia'], bank_crypt: ['encounters', 'Crypt'], bank_stockpile: ['encounters', 'Dwarven Treasury'], wreck: ['encounters', 'Shipwreck'], chest: ['encounters', 'Treasure Chest'],
  merchant: ['locations', 'Trading Post'], boat: ['locations', 'Sailing Boat'], fort: ['waypoints', 'Hill Fort'], art: ['resources', 'Sword Artifact'],
  pile_wood: ['resources', 'Wood'], pile_ore: ['resources', 'Ore'], pile_mercury: ['resources', 'Mercury'], pile_sulfur: ['resources', 'Sulfur'], pile_crystal: ['resources', 'Crystals'], pile_gems: ['resources', 'Gems'], pile_gold: ['resources', 'Gold'],
};
for (const k in OBJ) job(find(...OBJ[k]), path.join(OUT, 'objects', k + '.webp'), { w: 150, h: 150, fit: 'inside', trim: true, q: 78 });
// resource icons (small) come from the same pictures
for (const [k, n] of [['wood', 'Wood'], ['ore', 'Ore'], ['mercury', 'Mercury'], ['sulfur', 'Sulfur'], ['crystal', 'Crystals'], ['gems', 'Gems'], ['gold', 'Gold']]) job(find('resources', n), path.join(OUT, 'icons', 'res_' + k + '.webp'), { w: 64, h: 64, fit: 'inside', trim: true, q: 80 });
// ---- terrain textures + overlays ----
const TER = { grass: ['land', 'Grass'], road: ['land', 'Dirt'], sand: ['land', 'Sand'], water: ['land', 'Ocean'], mountain: ['land', 'Rough'], forest: ['land', 'Grass'] };
for (const k in TER) job(find(...TER[k]), path.join(OUT, 'terrain', k + '.webp'), { w: 256, h: 256, q: 70 });
job(find('nature', 'Pine Trees'), path.join(OUT, 'terrain', 'forest_overlay.webp'), { w: 96, h: 96, fit: 'inside', trim: true, q: 78 });
job(find('nature', 'Mountain'), path.join(OUT, 'terrain', 'mountain_overlay.webp'), { w: 110, h: 110, fit: 'inside', trim: true, q: 78 });
// ---- flags, screens, icon ----
for (const c of ['Red', 'Blue', 'Tan', 'Green', 'Orange', 'Purple', 'Teal', 'Pink']) job(find('player-flags', c + ' Player Flag'), path.join(OUT, 'flags', c.toLowerCase() + '.webp'), { w: 64, h: 64, fit: 'inside', trim: true, q: 80 });
job(find('interface', 'Main Menu Background'), path.join(OUT, 'ui', 'title.webp'), { w: 1280, h: 726, q: 66 });
job(find('interface', 'Castle Selection Background'), path.join(OUT, 'ui', 'castle_select.webp'), { w: 1280, h: 726, q: 62 });
job(find('interface', 'Hero Selection Background'), path.join(OUT, 'ui', 'hero_select.webp'), { w: 1280, h: 726, q: 62 });
job(find('interface', 'Adventure Screen Concept'), path.join(OUT, 'ui', 'adventure.webp'), { w: 1280, h: 726, q: 62 });
for (const f of fs.readdirSync(path.join(SRC, 'h3'))) { const b = f.replace(/\.jpg$/, ''); if (['castle', 'rampart', 'tower', 'inferno', 'necropolis', 'dungeon', 'stronghold', 'fortress', 'conflux'].includes(b)) job(path.join(SRC, 'h3', f), path.join(OUT, 'ui', 'town_' + b + '.webp'), { w: 480, h: 480, q: 70 }); }
job(find('game-icons', 'Android Game Icon'), path.join(ROOT, 'assets', 'icon-source.png'), { w: 1024, h: 1024, fmt: 'png' });

(async () => {
  console.log(jobs.length + ' images to convert');
  let done = 0, fail = 0; const t0 = Date.now(); const queue = jobs.slice();
  const worker = async () => {
    for (let j = queue.shift(); j; j = queue.shift()) {
      try {
        fs.mkdirSync(path.dirname(j.to), { recursive: true });
        let img = sharp(j.from); if (j.trim) img = img.trim({ threshold: 8 });
        img = img.resize(j.w, j.h, { fit: j.fit || 'cover', withoutEnlargement: true, background: { r: 0, g: 0, b: 0, alpha: 0 } });
        await (j.fmt === 'png' ? img.png() : img.webp({ quality: j.q || 72, alphaQuality: 80, effort: 4 })).toFile(j.to);
      } catch (e) { fail++; console.warn('FAIL', path.basename(j.from), e.message); }
      if (++done % 200 === 0) console.log(done + '/' + jobs.length + ' (' + Math.round((Date.now() - t0) / 1000) + 's)');
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  console.log('done: ' + (done - fail) + ' ok, ' + fail + ' failed');
  require('./make_manifest')(ROOT);
  let bytes = 0; const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach(e => { const p = path.join(d, e.name); e.isDirectory() ? walk(p) : (bytes += fs.statSync(p).size); }); walk(OUT);
  console.log('art/ size: ' + (bytes / 1048576).toFixed(1) + ' MB');
})();
