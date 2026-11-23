'use strict';
// Quick checks for the weekly-missions engine:  node tools/missions-test.js
const M = require('../js/missions.js');
let fails = 0;
const ok = (cond, msg) => { if (!cond) { console.log('FAIL ' + msg); fails++; } else console.log('ok   ' + msg); };
let seed = 7; const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

const ms = M.fresh(1, 'normal', null, rng);
ok(ms.list.length === 3 && new Set(ms.list.map(m => M.TYPES[m.type].cat)).size === 3, 'three missions, one per category');
ok(ms.list.map(m => m.tier).sort().join() === '0,1,2', 'tiers easy/normal/hard are all used');
ok(ms.list.every(m => m.target >= 1 && m.reward.gold > 0), 'targets and rewards are positive');
ok(M.weekOf(1) === 0 && M.weekOf(7) === 0 && M.weekOf(8) === 1, 'week index changes on day 8');
ok(M.daysLeft(1) === 7 && M.daysLeft(7) === 1 && M.daysLeft(8) === 7, 'days left in the week');

const first = ms.list[0], done = M.add(ms, first.type, first.target - 1);
ok(done.length === 0 && !first.done, 'one short of the target does not complete');
ok(M.add(ms, first.type, 1).length === 1 && first.done, 'reaching the target completes it exactly once');
ok(M.add(ms, first.type, 50).length === 0, 'a finished mission is not completed again');
ok(M.add(ms, 'nonsense', 5).length === 0, 'unknown counter types are ignored');
ms.list.forEach(m => { m.done = true; });
ok(M.allDone(ms), 'all three done');
const next = M.fresh(8, 'normal', ms, rng);
ok(next.week === 1 && Object.keys(next.cnt).length === 0 && !next.bonusPaid && next.streak === 1, 'next week resets counters and keeps a streak');
const overlap = next.list.filter(m => ms.list.some(p => p.type === m.type)).length;
ok(overlap < 3, 'types change from one week to the next');

const poor = M.roll(36, 'normal', [], rng, { income: 6000, cap: { explore: 60, chests: 0, capture: 1, build: 2, slay: 900, battles: 100 } });
ok(!poor.some(m => m.type === 'chests'), 'a type with nothing left is not offered');
ok(poor.every(m => !M.TYPES[m.type] || m.target <= (({ explore: 60, capture: 1, build: 2 })[m.type] || 1e9)), 'targets never exceed what the map still offers');
for (const d of ['easy', 'normal', 'hard', 'expert']) ok(M.target('slay', 1, 0, d) >= 1, 'difficulty ' + d + ' gives a target');
ok(M.target('slay', 0, 0, 'normal') < M.target('slay', 1, 0, 'normal') && M.target('slay', 1, 0, 'normal') < M.target('slay', 2, 0, 'normal'), 'easy < normal < hard');
ok(M.target('slay', 1, 5, 'normal') > M.target('slay', 1, 0, 'normal'), 'war targets grow over the weeks');
ok(M.target('levels', 1, 5, 'normal') === M.target('levels', 1, 0, 'normal'), 'level targets do not grow');
ok(M.target('gold', 1, 0, 'normal', { income: 2000 }) > M.target('gold', 1, 0, 'normal', { income: 500 }), 'gold target follows income');
console.log(fails ? fails + ' failed' : 'all passed');
process.exit(fails ? 1 : 0);
