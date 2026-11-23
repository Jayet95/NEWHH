'use strict';
// Checks for the morale / luck icon helper:  node tools/moods-test.js
const Moods = require('../js/moods.js');
let fails = 0;
const ok = (c, m) => { if (!c) { console.log('FAIL ' + m); fails++; } else console.log('ok   ' + m); };
const visible = (h) => h.replace(/<[^>]*>/g, '');           // what a player sees: no tags, no attributes (those hold the tooltip)

ok(Moods.clamp(7) === 3 && Moods.clamp(-9) === -3 && Moods.clamp(NaN) === 0 && Moods.clamp('2') === 2 && Moods.clamp(1.6) === 2, 'values are clamped to -3..+3 and sanitised');
for (const kind of ['morale', 'luck']) {
  for (let v = -3; v <= 3; v++) {
    const h = Moods.html(kind, v), icons = (h.match(/<i>/g) || []).length;
    ok(icons === Math.max(1, Math.abs(v)), `${kind} ${v}: ${Math.max(1, Math.abs(v))} icon(s)`);
    ok(!/\d/.test(visible(h)), `${kind} ${v}: no digit is visible`);
    ok(h.includes(Moods.cls(v)), `${kind} ${v}: state class ${Moods.cls(v)}`);
  }
  ok(new Set([-3, -2, -1, 0, 1, 2, 3].map(v => Moods.word(kind, v))).size === 7, `${kind}: seven different words`);
  ok(/lv-g1/.test(Moods.html(kind, 1)) && /lv-b1/.test(Moods.html(kind, -1)) && /lv-n0/.test(Moods.html(kind, 0)), `${kind}: good, bad and neutral differ`);
  ok(Moods.html(kind, 2, { label: true }).includes('<em>' + Moods.word(kind, 2) + '</em>'), `${kind}: optional word label`);
}
ok(/4%/.test(Moods.tip('morale', 1)) && /12%/.test(Moods.tip('luck', -3)), 'tooltips explain the strength');
ok(Moods.glyphs('morale', 3) === '😀😀😀' && Moods.glyphs('luck', -2) === '🍂🍂' && Moods.glyphs('morale', 0) === '😐', 'canvas glyphs follow strength and sign');
console.log(fails ? fails + ' failed' : 'all passed');
process.exit(fails ? 1 : 0);
