'use strict';
// Remaining pieces of the first art pack: movement markers, road pieces, water decorations, battle scenery and interface frames.
//   node tools/import_pack3.js "<path to src/assets>"
const fs = require('fs'), path = require('path');
const sharp = require('sharp');
const SRC = process.argv[2];
if (!SRC || !fs.existsSync(path.join(SRC, 'h3-map'))) { console.error('usage: node tools/import_pack3.js "<path to src/assets>"'); process.exit(1); }
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'art');
const cat = JSON.parse(fs.readFileSync(path.join(SRC, 'h3-map/catalog.json'), 'utf8'));
const find = (g, n) => path.join(SRC, 'h3-map', cat.find(x => x.group === g && x.name === n).file);
const jobs = [];
const job = (from, to, o) => jobs.push(Object.assign({ from, to }, o));
const M = { footprints: 'Movement Footprints', arrow: 'Movement Path Arrow', flag: 'Destination Flag', anchor: 'Board Ship Marker', attack: 'Attack Destination', hourglass: 'Next Turn Destination', selected: 'Selected Destination', reachable: 'Reachable Destination', blocked: 'Blocked Destination' };
for (const k in M) job(find('movement-markers', M[k]), path.join(OUT, 'markers', k + '.webp'), { w: 96, h: 96, fit: 'inside', trim: true, q: 80 });
for (const [style, nm] of [['dirt', 'Dirt'], ['gravel', 'Gravel'], ['cobble', 'Cobblestone']]) for (const p of ['Straight', 'Corner', 'Junction']) job(find('roads', nm + ' ' + p), path.join(OUT, 'roads', style + '_' + p.toLowerCase() + '.webp'), { w: 128, h: 128, fit: 'inside', trim: true, q: 78 });
for (const [k, n] of [['reef', 'Reef'], ['whirlpool', 'Whirlpool'], ['pond', 'Pond'], ['waterfall', 'Waterfall']]) job(find('water', n), path.join(OUT, 'decor', k + '.webp'), { w: 120, h: 120, fit: 'inside', trim: true, q: 78 });
const B = { wall_intact: 'Intact Battle Wall', wall_damaged: 'Damaged Battle Wall', wall_breached: 'Breached Battle Wall', gate_closed: 'Closed Siege Gate', gate_open: 'Open Siege Gate', tower: 'Defense Tower', tower_damaged: 'Damaged Defense Tower', mine_dormant: 'Dormant Landmine', mine_armed: 'Armed Landmine' };
for (const k in B) job(find('battle-siege', B[k]), path.join(OUT, 'battle', k + '.webp'), { w: 200, h: 200, fit: 'inside', trim: true, q: 78 });
for (const [k, n] of [['trench_straight', 'Straight Water Trench'], ['trench_corner', 'Corner Water Trench'], ['trench_bridge', 'Trench Bridge'], ['grass', 'Battle Grass Tile'], ['dirt', 'Battle Dirt Tile']]) job(find('battle-terrain', n), path.join(OUT, 'battle', k + '.webp'), { w: 256, h: 256, fit: 'inside', trim: true, q: 72 });
const UI = { btn_normal: 'Button Normal', btn_pressed: 'Button Pressed', btn_disabled: 'Button Disabled', frame_portrait: 'Portrait Frame', frame_town: 'Town Selection Frame', frame_toolbar: 'Resource Toolbar Frame', frame_command: 'Command Button', frame_scroll: 'Scroll Panel Frame', frame_progress: 'Progress Bar Frame' };
for (const k in UI) job(find('interface-parts', UI[k]), path.join(OUT, 'ui', k + '.webp'), { w: 420, h: 420, fit: 'inside', trim: true, q: 82 });
(async () => {
  for (const j of jobs) {
    fs.mkdirSync(path.dirname(j.to), { recursive: true });
    let img = sharp(j.from); if (j.trim) img = img.trim({ threshold: 8 });
    const info = await img.resize(j.w, j.h, { fit: j.fit, withoutEnlargement: true }).webp({ quality: j.q, alphaQuality: 85, effort: 4 }).toFile(j.to);
    if (/ui[\\/]/.test(j.to)) console.log(path.basename(j.to), info.width + 'x' + info.height);
  }
  console.log(jobs.length + ' written');
  require('./make_manifest')(ROOT);
})();
