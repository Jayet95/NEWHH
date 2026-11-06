'use strict';
// Headless battle simulator for balance work. Usage:
//   node tools/sim.js calibrate        -> measure creature strength, print suggested AI values
//   node tools/sim.js siege            -> attacker win rate vs castle defenders at several strength ratios
//   node tools/sim.js duel a b na nb   -> quick duel between two creature ids
const vm = require('vm'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');

function makeEnv() {
  let vt = 0;
  const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ctx), set: (t, k, v) => { t[k] = v; return true; } });
  const els = {};
  const mkEl = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, style: {}, innerHTML: '', textContent: '', disabled: false,
    appendChild() {}, querySelector() { return mkEl(); }, querySelectorAll() { return []; }, addEventListener() {}, getContext() { return ctx; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 960, height: 640 }; }, scrollTop: 0, scrollHeight: 0 });
  const sb = {
    console, Math, Promise, Set, Map, Array, Object, JSON, String, Number, Infinity, isNaN, parseInt,
    performance: { now: () => (vt += 40) },
    setTimeout: (f) => { setImmediate(f); },
    requestAnimationFrame: (cb) => { if (cb.name === 'draw') return; setImmediate(() => cb(vt)); },
    document: { getElementById: (id) => els[id] || (els[id] = mkEl()), createElement: () => mkEl(), addEventListener() {}, body: { classList: { add() {}, remove() {} } } },
  };
  sb.window = sb; sb.showModal = () => Promise.resolve(0); sb.toast = () => {};
  vm.createContext(sb);
  const src = ['data.js', 'map.js', 'battle.js'].map(f => fs.readFileSync(path.join(root, 'js', f), 'utf8')).join('\n');
  vm.runInContext(src, sb);
  const api = vm.runInContext('({ C, Battle, FACTIONS, factionTiers, lineType, armyValue, GROWTH })', sb);
  api.els = els;
  return api;
}

async function fight(env, a, b, opts = {}) {
  const army = a.map(x => ({ ...x })); while (army.length < 7) army.push(null);
  const p = env.Battle.run({ hero: Object.assign({ att: 0, def: 0, sp: 0, mana: 0, spells: [], perks: {}, name: 'A', icon: 'A' }, opts.hero || {}),
    army, enemy: b.map(x => ({ ...x })), eStats: Object.assign({ att: 0, def: 0 }, opts.eStats || {}), title: 'sim', siege: opts.siege || null, canRetreat: false });
  for (let i = 0; i < 5; i++) await new Promise(r => setImmediate(r));   // Battle.run first awaits its art preload, then binds and starts
  env.els.bAuto.onclick();
  return p;
}

async function winRate(env, a, b, runs, opts) {
  let w = 0;
  for (let i = 0; i < runs; i++) { const r = await fight(env, a, b, opts); if (r.win) w++; }
  return w / runs;
}

async function calibrate() {
  const env = makeEnv(), C = env.C;
  const REF = [{ t: 'castle1', n: 20 }, { t: 'castle2', n: 10 }, { t: 'castle3', n: 6 }, { t: 'castle4', n: 4 }];
  const VREF = 6746;
  const findN = async (t) => {
    for (const mult of [1, 4, 16, 64]) {
      const R = REF.map(r => ({ t: r.t, n: r.n * mult }));
      let lo = 0, hi = 1;
      while ((await winRate(env, [{ t, n: hi }], R, 6)) < 0.5 && hi < 20000) { lo = hi; hi *= 2; }
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if ((await winRate(env, [{ t, n: mid }], R, 6)) >= 0.5) hi = mid; else lo = mid; }
      const wl = lo ? await winRate(env, [{ t, n: lo }], R, 12) : 0, wh = await winRate(env, [{ t, n: hi }], R, 12);
      const n = wh > wl ? lo + (0.5 - wl) / (wh - wl) : hi;
      if (n >= 3 || mult === 64) return n / mult;
    }
  };
  const rows = [];
  for (const f of Object.keys(env.FACTIONS)) for (let i = 1; i <= 7; i++) {
    const id = f + i, n1 = await findN(id), n5 = await findN(env.lineType(id, 5));
    rows.push({ id, name: C[id].n, gold: C[id].cost.gold, oldV: C[id].v, v1: VREF / n1, v5: VREF / n5 });
    process.stderr.write('.');
  }
  process.stderr.write('\n');
  const kappa = rows.reduce((s, r) => s + r.oldV / r.v1, 0) / rows.length;
  const out = {};
  for (const r of rows) out[r.id] = [Math.round(r.v1 * kappa), Math.round(r.v5 * kappa)];
  console.log('kappa', kappa.toFixed(3));
  for (const r of rows) console.log(r.id.padEnd(12), r.name.padEnd(18), 'gold', String(r.gold).padStart(5), 'oldV', String(r.oldV).padStart(5), 'newV', String(out[r.id][0]).padStart(5), 'lv5', String(out[r.id][1]).padStart(6), 'v/gold', (out[r.id][0] / r.gold).toFixed(2));
  fs.writeFileSync(path.join(__dirname, 'values.json'), JSON.stringify(out));
}

async function siege() {
  const env = makeEnv(), C = env.C;
  const mix = (f, budget) => { const t = env.factionTiers(f); const per = budget / 5; return [0, 1, 2, 3, 4].map(i => ({ t: t[i], n: Math.max(1, Math.round(per / C[t[i]].v)) })); };
  for (const ratio of [0.6, 0.8, 1, 1.25, 1.5, 2, 3]) {
    const A = mix('castle', 20000 * ratio), D = mix(process.argv[3] || 'castle', 20000);
    const open = await winRate(env, A, D, 60), sg = await winRate(env, A, D, 60, { siege: { dside: 1 } });
    const defS = await winRate(env, D, A, 60, { siege: { dside: 0 } });
    console.log(`ratio ${ratio}: open ${(open * 100).toFixed(0)}%  siege-attacker ${(sg * 100).toFixed(0)}%  (defender-as-p0 vs attacker ratio ${ratio}: ${(defS * 100).toFixed(0)}%)`);
  }
}

module.exports = { makeEnv, fight, winRate };
if (require.main === module) (async () => {
  const cmd = process.argv[2];
  if (cmd === 'calibrate') await calibrate();
  else if (cmd === 'siege') await siege();
  else if (cmd === 'duel') {
    const env = makeEnv(), [a, b, na, nb] = process.argv.slice(3);
    console.log('win rate A:', await winRate(env, [{ t: a, n: +na }], [{ t: b, n: +nb }], 40));
  } else console.log('usage: node tools/sim.js calibrate|siege|duel a b na nb');
  process.exit(0);
})();
