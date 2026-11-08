'use strict';
// Achievements: lifetime stats are kept in the browser (across games); unlocking shows a pop-up and a medal in the Achievements screen.
const Ach = (() => {
  const KEY = 'h3js_profile_v1';
  let P = { stats: {}, unlocked: {} };
  try { const raw = JSON.parse(localStorage.getItem(KEY) || 'null'); if (raw && raw.stats) P = raw; } catch (e) { /* ignore */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) { /* ignore */ } };
  const st = (k) => P.stats[k] || 0;
  const inc = (k, n = 1) => { P.stats[k] = st(k) + n; };
  const setMax = (k, v) => { if (v > st(k)) P.stats[k] = v; };
  // [id, category, name, description, stat, target, glyph, hue]
  const DEFS = [
    ['first_blood', 'War', 'First Blood', 'Win your first battle.', 'battlesWon', 1, 'sword', 8],
    ['veteran', 'War', 'Veteran', 'Win 25 battles.', 'battlesWon', 25, 'sword', 28],
    ['warlord', 'War', 'Warlord', 'Win 100 battles.', 'battlesWon', 100, 'crown', 45],
    ['slayer', 'War', 'Slayer', 'Slay 1,000 creatures.', 'slain', 1000, 'skull', 0],
    ['exterminator', 'War', 'Exterminator', 'Slay 10,000 creatures.', 'slain', 10000, 'skull', 350],
    ['underdog', 'War', 'Underdog', 'Win a battle that looked Deadly.', 'deadlyWins', 1, 'shield', 215],
    ['flawless', 'War', 'Flawless', 'Win a fair fight without losing a single creature.', 'flawless', 1, 'helm', 200],
    ['duelist', 'War', 'Duelist', 'Defeat 10 rival heroes.', 'heroKills', 10, 'sword', 280],
    ['dethroner', 'War', 'Dethroner', 'Eliminate a rival realm.', 'elims', 1, 'crown', 300],
    ['conqueror', 'Realm', 'Conqueror', 'Capture a town.', 'townsCaptured', 1, 'house', 35],
    ['empire', 'Realm', 'Empire', 'Hold 4 towns at once.', 'maxTowns', 4, 'crown', 45],
    ['great_empire', 'Realm', 'Great Empire', 'Hold 6 towns at once.', 'maxTowns', 6, 'crown', 280],
    ['land_baron', 'Realm', 'Land Baron', 'Hold 5 mines at once.', 'maxMines', 5, 'rock', 28],
    ['tycoon', 'Realm', 'Tycoon', 'Earn 100,000 gold from income.', 'gold', 100000, 'gem', 50],
    ['builder', 'Realm', 'Master Builder', 'Build a Capitol.', 'maxHall', 4, 'house', 25],
    ['stronghold', 'Realm', 'Unbreakable', 'Build the Fortress upgrade of a castle.', 'maxFort', 3, 'shield', 215],
    ['archmage', 'Realm', 'Archmage', 'Build the third Arcane Lodge level.', 'maxGuild', 3, 'book', 265],
    ['dragon_tamer', 'Dragons', 'Dragon Tamer', 'Conquer a Dragon Lair.', 'lairs', 1, 'flame', 8],
    ['dragon_master', 'Dragons', 'Dragon Master', 'Recruit 10 dragons from a lair.', 'lairDragons', 10, 'flames', 20],
    ['azure_rider', 'Dragons', 'Blue Rider', 'Command a Blue Dragon.', 'azure', 1, 'drop', 200],
    ['collector', 'Heroes', 'Collector', 'Find 10 artifacts.', 'arts', 10, 'gem', 300],
    ['armed', 'Heroes', 'Armed to the Teeth', 'Equip 8 artifacts on one hero.', 'maxEquip', 8, 'armor', 215],
    ['veteran_hero', 'Heroes', 'Seasoned Hero', 'Reach hero level 10.', 'maxLevel', 10, 'star', 45],
    ['legend', 'Heroes', 'Living Legend', 'Reach hero level 20.', 'maxLevel', 20, 'star', 280],
    ['full_roster', 'Heroes', 'Full Roster', 'Command 4 heroes at once.', 'maxHeroes', 4, 'flag', 350],
    ['diplomat', 'Diplomacy', 'Diplomat', 'Accept tribute or a surrender 3 times.', 'tributes', 3, 'heart', 340],
    ['mercy', 'Diplomacy', 'Mercy', 'Let 5 monster stacks go.', 'spared', 5, 'heart', 120],
    ['pragmatist', 'Diplomacy', 'Pragmatist', 'Pay a ransom to save your army.', 'ransoms', 1, 'scroll', 40],
    ['logistician', 'Logistics', 'Logistician', 'Send a reinforcement caravan.', 'caravans', 1, 'road', 35],
    ['seafarer', 'Logistics', 'Seafarer', 'Set sail in a boat.', 'sails', 1, 'anchor', 210],
    ['treasure_hunter', 'Logistics', 'Treasure Hunter', 'Open 5 treasure chests.', 'chests', 5, 'gem', 50],
    ['veteran_days', 'Logistics', 'Long Reign', 'Survive to day 100 in one game.', 'maxDay', 100, 'hourglass', 30],
    ['victor', 'Victory', 'Victor', 'Win a game.', 'wins', 1, 'crown', 45],
    ['hard_victor', 'Victory', 'Iron Will', 'Win a game on Hard or Expert.', 'hardWins', 1, 'skull', 0],
    ['giant_victor', 'Victory', 'World Conqueror', 'Win on a Giant map.', 'giantWins', 1, 'peak', 120],
    ['blitz', 'Victory', 'Blitzkrieg', 'Win a game by day 60.', 'fastWins', 1, 'bolt', 55],
  ].map(([id, cat, name, desc, stat, target, g, hue]) => ({ id, cat, name, desc, stat, target, g, hue }));
  const H = {
    fightWon(p) { inc('battlesWon'); inc('slain', p.slain || 0); if (p.hero) inc('heroKills'); if (p.ratio !== undefined && p.ratio < 0.45) inc('deadlyWins'); if (p.lossPct === 0 && p.ratio !== undefined && p.ratio < 1.6) inc('flawless'); },
    town(p) { setMax('maxTowns', p.count); inc('townsCaptured'); }, mine(p) { setMax('maxMines', p.count); },
    lair() { inc('lairs'); }, art(p) { inc('arts'); setMax('maxEquip', p.equipped); }, level(p) { setMax('maxLevel', p.lvl); },
    day(p) { setMax('maxDay', p.day); inc('gold', p.gold || 0); if (p.azure) P.stats.azure = 1; setMax('maxTowns', p.towns || 0); setMax('maxMines', p.mines || 0); },
    win(p) { inc('wins'); if (p.diff === 'hard' || p.diff === 'expert') inc('hardWins'); if (p.size === 'giant') inc('giantWins'); if (p.day <= 60) inc('fastWins'); },
    tribute() { inc('tributes'); }, ransom() { inc('ransoms'); }, spare() { inc('spared'); }, caravan() { inc('caravans'); },
    lairBuy(p) { inc('lairDragons', p.n || 1); if (p.id === 'azured') P.stats.azure = 1; }, sail() { inc('sails'); }, chest() { inc('chests'); },
    hire(p) { setMax('maxHeroes', p.count); }, hall(p) { setMax('maxHall', p.lv); }, fort(p) { setMax('maxFort', p.lv); }, guild(p) { setMax('maxGuild', p.lv); }, elim() { inc('elims'); },
  };
  const queue = []; let showing = false;
  function popup(def) {
    queue.push(def); if (showing) return; showing = true;
    const next = () => {
      const d = queue.shift(); if (!d) { showing = false; return; }
      const el = document.createElement('div'); el.className = 'achpop';
      el.innerHTML = `${typeof Icons !== 'undefined' ? Icons.glyphHtml(d.g, d.hue, 44) : '🏆'}<div><div class="small">🏆 Achievement unlocked</div><b>${d.name}</b><div class="small">${d.desc}</div></div>`;
      document.body.appendChild(el);
      try { if (typeof sfx === 'function') sfx('ach'); else if (typeof Sfx !== 'undefined') Sfx.play('ach'); } catch (e) { /* ignore */ }
      try { if (typeof Celebrate !== 'undefined') Celebrate.loot(); } catch (e) { /* ignore */ }
      setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); next(); }, 400); }, 3600);
    };
    next();
  }
  function check() {
    let changed = false;
    for (const d of DEFS) if (!P.unlocked[d.id] && st(d.stat) >= d.target) { P.unlocked[d.id] = Date.now(); changed = true; popup(d); }
    if (changed) save();
  }
  return {
    DEFS, st, get unlocked() { return P.unlocked; },
    event(name, p = {}) { try { if (H[name]) { H[name](p); save(); check(); } } catch (e) { /* ignore */ } },
    progress: (d) => Math.min(d.target, st(d.stat)),
    reset() { P = { stats: {}, unlocked: {} }; save(); },
  };
})();
