'use strict';
// Weekly-missions calibration: a bot plays real generated maps (real data, real headless battles) in three styles and records
// the weekly counters that missions are made of.   Usage:  node tools/missions-sim.js [seeds=3] [weeks=6]
const { makeEnv, fight } = require('./sim.js');
const Missions = require('../js/missions.js');

const TIER_HALL = [null, 0, 0, 1, 2, 3, 4, 5];
const MOVE_DAY = 2890, COST_TILE = 120, DETOUR = 1.4;      // hero movement points, average terrain cost, path detours
const NEED = (l) => 150 * l * l;                           // xp for the next level (same as main.js)
const PROFILES = {
  casual:  { name: 'casual',  daysPerWeek: 3, minRatio: 2.2, budget: 0.7 },
  steady:  { name: 'steady',  daysPerWeek: 7, minRatio: 1.4, budget: 1.0 },
  grinder: { name: 'grinder', daysPerWeek: 7, minRatio: 1.05, budget: 1.35 },
};
const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const canAfford = (res, c) => Object.keys(c).every(k => (res[k] || 0) >= c[k]);
const pay = (res, c, n = 1) => { for (const k of Object.keys(c)) res[k] -= c[k] * n; };

async function playOne(env, seed, prof, weeks, rand) {
  const { C, factionTiers, GROWTH, MINE_YIELD, HALL_LEVELS, DWELL_COST, MARKET_COST, SHIPYARD_COST, FORT_LEVELS, MINE_LEVELS, GUILD_COST, upgradeCost, MAX_LV } = env;
  const m = env.genMap('sim' + seed, ['necropolis', 'rampart'], 'normal', { size: 'medium', preset: 'plains', wrap: false, fog: true, build: true });
  const W = m.W, H = m.H, objs = m.objs.map(o => ({ ...o, guard: (o.guard || []).map(g => ({ ...g })) }));
  const D = env.DIFFICULTY.normal;
  const hero = { x: m.P.x, y: m.P.y, lvl: 1, xp: 0 };
  let army = [{ t: 'castle1', n: 15 }, { t: 'castle2', n: 6 }, { t: 'castle3', n: 4 }, null, null, null, null];
  const res = { gold: D.gold, wood: 20, ore: 20, mercury: 5, sulfur: 5, crystal: 5, gems: 5 };
  const town = { hall: 0, b: {}, avail: {}, up: {}, extra: {} };
  const capital = m.objs.find(o => o.t === 'town' && o.owner === 0), payZones = new Set([m.zone[capital.y][capital.x]]);
  const zoneAt = (o) => m.zone[o.y][o.x];
  const seen = new Uint8Array(W * H);
  const reveal = (x, y, r) => { let n = 0; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; if (dx * dx + dy * dy * 0.75 > r * r) continue; const i = yy * W + xx; if (!seen[i]) { seen[i] = 1; n++; } } return n; };
  reveal(hero.x, hero.y, 9);
  const dist = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * 0.866) * DETOUR;
  const travelDays = (a, b) => dist(a, b) * COST_TILE / MOVE_DAY;
  const weeklyOut = [];
  let cnt = null; const newWeekCnt = () => { cnt = { slay: 0, battles: 0, levels: 0, build: 0, recruit: 0, gold: 0, capture: 0, explore: 0, chests: 0 }; };
  newWeekCnt();
  const armyV = () => army.reduce((s, a) => s + (a ? C[a.t].v * a.n : 0), 0);
  const gv = (g) => g.reduce((s, a) => s + (a ? C[a.t].v * a.n : 0), 0);
  const addArmy = (t, n) => { let i = army.findIndex(a => a && a.t === t); if (i < 0) i = army.findIndex(a => !a); if (i < 0) return false; if (army[i]) army[i].n += n; else army[i] = { t, n }; return true; };
  const owned = () => objs.filter(o => (o.t === 'mine' || o.t === 'dwelling') && o.owner === 0);
  const incomeDay = () => { let g = (HALL_LEVELS[town.hall] ? HALL_LEVELS[town.hall].inc : 0); const r = { gold: g }; for (const o of owned()) if (o.t === 'mine' && payZones.has(zoneAt(o))) r[o.kind] = (r[o.kind] || 0) + MINE_YIELD[o.kind] * (D.income || 1); return r; };   // mines pay only inside zones you hold
  const fac = 'castle', tiers = factionTiers(fac);
  const nextBuild = () => {
    for (let t = 1; t <= 7; t++) {
      if (town.b[t]) continue;
      if (town.hall < TIER_HALL[t]) { const hl = HALL_LEVELS[town.hall + 1]; return hl ? { k: 'hall', cost: hl.cost } : null; }
      return { k: 't' + t, t, cost: DWELL_COST[t] };
    }
    const hl = HALL_LEVELS[town.hall + 1]; if (hl) return { k: 'hall', cost: hl.cost };
    return null;
  };
  // everything else a player builds over the weeks: market, shipyard, guild, walls, minefield, creature upgrades
  const nextExtra = () => {
    if (!town.extra.market) return { k: 'x:market', cost: MARKET_COST };
    for (let l = 1; l <= 3; l++) { if ((town.extra.guild || 0) < l) return GUILD_COST[l] ? { k: 'x:guild', cost: GUILD_COST[l] } : null; }
    for (let l = 1; l <= 3; l++) { if ((town.extra.fort || 0) < l) return { k: 'x:fort', cost: FORT_LEVELS[l].cost }; }
    for (let l = 1; l <= 3; l++) { if ((town.extra.minel || 0) < l) return { k: 'x:minel', cost: MINE_LEVELS[l].cost }; }
    for (let L = 2; L <= MAX_LV; L++) for (let tr = 1; tr <= 7; tr++) { if (!town.b[tr] || (town.up[tr] || 1) >= L) continue; const need = ({ 2: 1, 3: 2, 4: 3, 5: 4 })[L]; if (town.hall < need) continue; return { k: 'x:up', tier: tr, L, cost: upgradeCost(tr, L) }; }
    return null;
  };
  const townDay = () => {
    for (let guard = 0; guard < 14; guard++) {
      let nb = nextBuild(); if (!nb || !canAfford(res, nb.cost)) nb = nextExtra(); if (!nb || !canAfford(res, nb.cost)) break;
      pay(res, nb.cost); cnt.build++;
      if (nb.k === 'hall') town.hall++; else if (nb.k === 'x:market') town.extra.market = 1; else if (nb.k === 'x:guild') town.extra.guild = (town.extra.guild || 0) + 1; else if (nb.k === 'x:fort') town.extra.fort = (town.extra.fort || 0) + 1; else if (nb.k === 'x:minel') town.extra.minel = (town.extra.minel || 0) + 1; else if (nb.k === 'x:up') town.up[nb.tier] = nb.L; else { town.b[nb.t] = 1; town.avail[nb.t] = GROWTH[nb.t - 1]; }
    }
    for (let t = 7; t >= 1; t--) {
      if (!town.b[t] || !(town.avail[t] > 0)) continue;
      const c = C[tiers[t - 1]].cost; let n = Math.min(town.avail[t], 99999);
      while (n > 0 && !canAfford(res, Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v * n])))) n = Math.floor(n * 0.7) || 0;
      if (n > 0 && addArmy(tiers[t - 1], n)) { pay(res, c, n); town.avail[t] -= n; cnt.recruit += n; }
    }
    // owned dwellings: recruit what they have in stock
    for (const o of owned()) if (o.t === 'dwelling' && o.avail > 0) {
      const id = o.cid || factionTiers(o.fac)[o.tier - 1], c = C[id].cost; let n = o.avail;
      while (n > 0 && !canAfford(res, Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v * n])))) n = Math.floor(n * 0.7) || 0;
      if (n > 0 && addArmy(id, n)) { pay(res, c, n); o.avail -= n; cnt.recruit += n; }
    }
  };
  const candidates = () => {
    const out = [];
    for (const o of objs) {
      if (o.done || o.owner === 0) continue;
      if (o.t === 'chest') out.push({ o, val: 2 + (o.gold || 0) / 500, risk: 0 });
      else if (o.t === 'pile') out.push({ o, val: 0.8, risk: 0 });
      else if (o.t === 'mine' && (o.owner === null || o.owner === undefined)) out.push({ o, val: 4, risk: gv(o.guard) });
      else if (o.t === 'dwelling' && (o.owner === null || o.owner === undefined)) out.push({ o, val: 4, risk: gv(o.guard) });
      else if (o.t === 'fort' && o.owner == null) out.push({ o, val: 5, risk: gv(o.guard) });
      else if (o.t === 'monster' || o.t === 'art') out.push({ o, val: 1.5, risk: gv(o.guard) });
    }
    return out;
  };
  const doFight = async (o) => {
    const ratio = armyV() / Math.max(1, gv(o.guard));
    const slain = o.guard.reduce((s, g) => s + g.n, 0);
    const heroSt = { att: 2 + hero.lvl, def: 2 + hero.lvl, sp: 1 + (hero.lvl >> 1), mana: 10, spells: [], perks: {}, name: 'Bot', icon: 'B' };
    const r = await fight(env, army.filter(Boolean).concat([]), o.guard, { hero: heroSt, eStats: { att: 0, def: 0 } });
    if (!r.win) { army = [null, null, null, null, null, null, null]; return false; }
    const alive = army.filter(Boolean); const next = [];
    r.survivors.forEach((n, i) => { if (alive[i] && n > 0) next.push({ t: alive[i].t, n }); });
    while (next.length < 7) next.push(null); army = next;
    cnt.slay += slain; cnt.battles++;
    hero.xp += r.xp || 0; while (hero.xp >= NEED(hero.lvl)) { hero.xp -= NEED(hero.lvl); hero.lvl++; cnt.levels++; }
    return true;
  };
  let t = 0, debt = 0; const total = weeks * 7;
  const activeDays = (w) => { const days = [0, 1, 2, 3, 4, 5, 6]; for (let i = days.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [days[i], days[j]] = [days[j], days[i]]; } return new Set(days.slice(0, prof.daysPerWeek)); };
  let active = activeDays(0);
  for (let day = 1; day <= total; day++) {
    const dw = (day - 1) % 7;
    if (dw === 0 && day > 1) {   // a new week: dwellings replenish, the weekly counters close
      weeklyOut.push(cnt); newWeekCnt(); active = activeDays(Math.floor(day / 7));
      for (let k = 1; k <= 7; k++) if (town.b[k]) town.avail[k] += GROWTH[k - 1];
      for (const o of owned()) if (o.t === 'dwelling') o.avail = (o.avail || 0) + (GROWTH[(o.tier || 1) - 1] || 1);
    }
    const inc = incomeDay(); for (const k of Object.keys(inc)) res[k] = (res[k] || 0) + inc[k]; cnt.gold += inc.gold || 0;
    if (!active.has(dw)) continue;
    townDay();
    let budget = prof.budget - Math.max(0, debt); debt = 0;
    for (let guard = 0; guard < 40 && budget > 0.05; guard++) {
      const here = { x: hero.x, y: hero.y };
      const cs = candidates().filter(c => (c.risk === 0 || armyV() / Math.max(1, c.risk) >= prof.minRatio)).map(c => ({ ...c, td: travelDays(here, c.o) })).filter(c => c.td < 3);
      if (!cs.length) break;
      cs.sort((a, b) => (b.val / (b.td + 0.25)) - (a.val / (a.td + 0.25)));
      const c = cs[0], o = c.o;
      cnt.explore += reveal(Math.round((hero.x + o.x) / 2), Math.round((hero.y + o.y) / 2), 6) + reveal(o.x, o.y, 6);
      hero.x = o.x; hero.y = o.y; budget -= c.td; if (budget < 0) debt = -budget;
      if (o.t === 'chest') { cnt.chests++; cnt.gold += o.gold || 0; res.gold += o.gold || 0; o.done = true; }
      else if (o.t === 'pile') { res[o.kind] = (res[o.kind] || 0) + (o.amt || 0); o.done = true; }
      else {
        if (o.guard && o.guard.length) { const ok = await doFight(o); if (!ok) { o.done = false; break; } o.guard = []; }
        if (o.t === 'mine' || o.t === 'dwelling') { o.owner = 0; cnt.capture++; } else if (o.t === 'fort') { o.owner = 0; cnt.capture++; payZones.add(m.zone[o.y][o.x]); } else o.done = true;
      }
    }
  }
  weeklyOut.push(cnt);
  return weeklyOut.slice(0, weeks);
}

const median = (a) => { const s = a.slice().sort((x, y) => x - y); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };
const pct = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };

(async () => {
  const seeds = +process.argv[2] || 3, weeks = +process.argv[3] || 6, env = makeEnv(), results = {};
  const TYPES = Object.keys(Missions.TYPES);
  for (const pname of Object.keys(PROFILES)) {
    results[pname] = [];
    for (let s = 1; s <= seeds; s++) {
      const out = await playOne(env, s * 7 + 3, PROFILES[pname], weeks, rng(s * 101 + pname.length));
      results[pname].push(out);
      process.stderr.write(pname[0]);
    }
  }
  process.stderr.write('\n');
  const line = (label, f) => console.log(label.padEnd(10) + TYPES.map(t => String(Math.round(f(t))).padStart(8)).join(''));
  console.log('weekly values (median across seeds and weeks) - ' + seeds + ' seeds x ' + weeks + ' weeks');
  console.log(''.padEnd(10) + TYPES.map(t => t.padStart(8)).join(''));
  for (const p of Object.keys(PROFILES)) line(p, (t) => median(results[p].flat().map(w => w[t])));
  console.log('\nsteady, by week (median over seeds)');
  for (let w = 0; w < weeks; w++) line('week ' + (w + 1), (t) => median(results.steady.map(r => r[w] ? r[w][t] : 0)));
  console.log('\ngrinder p75 / steady p75 / casual p75 (all weeks)');
  for (const p of ['grinder', 'steady', 'casual']) line(p + ' p75', (t) => pct(results[p].flat().map(w => w[t]), 0.75));
  require('fs').writeFileSync(require('path').join(__dirname, 'missions-sim.json'), JSON.stringify(results));
  process.exit(0);
})();
