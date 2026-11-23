// Weekly missions: three small goals every week (one war, one economy, one map mission), reset every Monday.
// Pure logic - no DOM, no game state - so it can be unit-tested and simulated headlessly (see tools/missions-sim.js).
const Missions = (() => {
  const TYPES = {
    slay:    { cat: 'war', icon: '⚔️', text: (n) => `Slay ${n} creatures` },
    battles: { cat: 'war', icon: '🛡️', text: (n) => `Win ${n} battle${n > 1 ? 's' : ''}` },
    levels:  { cat: 'war', icon: '⭐', text: (n) => `Gain ${n} hero level${n > 1 ? 's' : ''}` },
    build:   { cat: 'eco', icon: '🔨', text: (n) => `Build ${n} building${n > 1 ? 's' : ''}` },
    recruit: { cat: 'eco', icon: '🏰', text: (n) => `Recruit ${n} troops` },
    gold:    { cat: 'eco', icon: '🪙', text: (n) => `Earn ${n} gold` },
    capture: { cat: 'map', icon: '🚩', text: (n) => `Capture ${n} mine${n > 1 ? 's' : ''} or dwelling${n > 1 ? 's' : ''}` },
    explore: { cat: 'map', icon: '🧭', text: (n) => `Uncover ${n} map tiles` },
    chests:  { cat: 'map', icon: '🎁', text: (n) => `Open ${n} treasure chest${n > 1 ? 's' : ''}` },
  };
  const CATS = ['war', 'eco', 'map'];
  // what a steady player does in a week (week 1, normal difficulty); measured with tools/missions-sim.js and the in-game bot, then rounded
  const PACE = { slay: 60, battles: 4, levels: 1, build: 3, recruit: 40, gold: 3500, capture: 2, explore: 150, chests: 2 };
  const TIERS = [
    { k: 'easy', name: 'Easy', mul: 0.55, rew: 1 },
    { k: 'normal', name: 'Normal', mul: 1, rew: 2 },
    { k: 'hard', name: 'Hard', mul: 1.7, rew: 3.6 },
  ];
  const DIFF_MUL = { easy: 0.8, normal: 1, hard: 1.15, expert: 1.3 };
  const RARES = ['mercury', 'sulfur', 'crystal', 'gems'];

  const weekOf = (day) => Math.floor((day - 1) / 7);
  const daysLeft = (day) => 7 - ((day - 1) % 7);
  const weekScale = (week) => Math.min(2.5, 1 + 0.12 * week);
  const nice = (v) => { v = Math.max(1, v); if (v >= 1000) return Math.round(v / 100) * 100; if (v >= 100) return Math.round(v / 10) * 10; if (v >= 20) return Math.round(v / 5) * 5; return Math.max(1, Math.round(v)); };
  const target = (type, tier, week, diff) => nice(PACE[type] * TIERS[tier].mul * weekScale(week) * (DIFF_MUL[diff] || 1));
  const reward = (tier, week, rng = Math.random) => {
    const t = TIERS[tier], gold = Math.round(250 * t.rew * (1 + 0.2 * week) / 50) * 50;
    return { gold, rare: RARES[Math.floor(rng() * RARES.length)], n: Math.round(2 * t.rew) };
  };
  const bonus = (week) => ({ gold: Math.round(1500 * (1 + 0.2 * week) / 100) * 100, xp: 0 });

  const shuffle = (a, rng) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // one mission per category, tiers shuffled across them; avoid last week's types where possible
  function roll(day, diff, prevTypes = [], rng = Math.random) {
    const week = weekOf(day), tiers = shuffle([0, 1, 2], rng), list = [];
    CATS.forEach((cat, i) => {
      const pool = Object.keys(TYPES).filter(t => TYPES[t].cat === cat), fresh = pool.filter(t => !prevTypes.includes(t)), from = fresh.length ? fresh : pool;
      const type = from[Math.floor(rng() * from.length)], tier = tiers[i];
      list.push({ type, tier, target: target(type, tier, week, diff), reward: reward(tier, week, rng), done: false });
    });
    return list.sort((a, b) => a.tier - b.tier);
  }
  const fresh = (day, diff, prev, rng) => ({ week: weekOf(day), cnt: {}, list: roll(day, diff, prev && prev.list ? prev.list.map(m => m.type) : [], rng), bonus: bonus(weekOf(day)), bonusPaid: false, streak: (prev && prev.list && prev.list.every(m => m.done)) ? ((prev.streak || 0) + 1) : 0 });
  // count progress; returns the missions this call completed (and flags the weekly bonus when all three are done)
  function add(ms, type, n = 1) {
    const out = [];
    if (!ms || !(n > 0) || !TYPES[type]) return out;
    ms.cnt[type] = (ms.cnt[type] || 0) + n;
    for (const m of ms.list) if (!m.done && m.type === type && ms.cnt[type] >= m.target) { m.done = true; out.push(m); }
    return out;
  }
  const doneCount = (ms) => ms ? ms.list.filter(m => m.done).length : 0;
  const allDone = (ms) => !!ms && ms.list.length > 0 && ms.list.every(m => m.done);
  const progress = (ms, m) => Math.min(1, ((ms.cnt[m.type] || 0) / m.target));
  return { TYPES, CATS, PACE, TIERS, DIFF_MUL, weekOf, daysLeft, weekScale, target, reward, bonus, roll, fresh, add, doneCount, allDone, progress };
})();
if (typeof module !== 'undefined') module.exports = Missions;
