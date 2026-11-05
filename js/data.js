'use strict';
const RES = ['gold', 'wood', 'ore', 'gems'];
const RES_ICON = { gold: '🪙', wood: '🪵', ore: '🪨', gems: '💎' };

// a=attack d=defense lo/hi=damage hp s=speed shoot=ammo fly=flyer v=AI value gr=weekly growth
const C = {
  pikeman:   { n: 'Pikeman',   i: '🔱', a: 4,  d: 5,  lo: 1,  hi: 3,  hp: 10,  s: 4,  cost: { gold: 60 },               gr: 14, v: 80 },
  archer:    { n: 'Archer',    i: '🏹', a: 6,  d: 3,  lo: 2,  hi: 3,  hp: 10,  s: 4,  shoot: 12, cost: { gold: 100 },    gr: 9,  v: 126 },
  griffin:   { n: 'Griffin',   i: '🦅', a: 8,  d: 8,  lo: 3,  hi: 6,  hp: 25,  s: 6,  fly: 1, cost: { gold: 200 },      gr: 7,  v: 351 },
  swordsman: { n: 'Swordsman', i: '⚔️', a: 10, d: 12, lo: 6,  hi: 9,  hp: 35,  s: 5,  cost: { gold: 300 },              gr: 4,  v: 445 },
  monk:      { n: 'Monk',      i: '🧙', a: 12, d: 7,  lo: 10, hi: 12, hp: 30,  s: 5,  shoot: 12, cost: { gold: 400 },    gr: 3,  v: 582 },
  cavalier:  { n: 'Cavalier',  i: '🐎', a: 15, d: 15, lo: 15, hi: 25, hp: 100, s: 7,  cost: { gold: 1000 },             gr: 2,  v: 1946 },
  angel:     { n: 'Angel',     i: '👼', a: 20, d: 20, lo: 50, hi: 50, hp: 200, s: 12, fly: 1, cost: { gold: 3000, gems: 1 }, gr: 1, v: 5019 },
  // neutrals
  goblin:    { n: 'Goblin',    i: '👺', a: 4,  d: 2,  lo: 1,  hi: 2,  hp: 5,   s: 5,  v: 50 },
  wolf:      { n: 'Wolf Rider', i: '🐺', a: 8, d: 5,  lo: 2,  hi: 5,  hp: 25,  s: 8,  v: 200 },
  orc:       { n: 'Orc',       i: '🦍', a: 8,  d: 4,  lo: 2,  hi: 5,  hp: 15,  s: 4,  shoot: 12, v: 192 },
  ogre:      { n: 'Ogre',      i: '👹', a: 13, d: 7,  lo: 6,  hi: 12, hp: 60,  s: 4,  v: 416 },
  troll:     { n: 'Troll',     i: '🦖', a: 14, d: 7,  lo: 10, hi: 15, hp: 70,  s: 7,  v: 1024 },
  golem:     { n: 'Stone Golem', i: '🗿', a: 9, d: 10, lo: 4, hi: 8,  hp: 60,  s: 3,  v: 400 },
  naga:      { n: 'Naga',      i: '🐍', a: 16, d: 13, lo: 20, hi: 20, hp: 110, s: 5,  v: 1100 },
  dragon:    { n: 'Green Dragon', i: '🐉', a: 18, d: 18, lo: 40, hi: 50, hp: 180, s: 10, fly: 1, v: 3800 },
  // enemy (undead) faction
  skeleton:  { n: 'Skeleton',  i: '💀', a: 5,  d: 4,  lo: 1,  hi: 3,  hp: 6,   s: 4,  v: 60 },
  zombie:    { n: 'Zombie',    i: '🧟', a: 5,  d: 5,  lo: 2,  hi: 3,  hp: 20,  s: 3,  v: 100 },
  wraith:    { n: 'Wraith',    i: '👻', a: 7,  d: 7,  lo: 3,  hi: 5,  hp: 18,  s: 7,  fly: 1, v: 250 },
  vampire:   { n: 'Vampire',   i: '🧛', a: 10, d: 9,  lo: 5,  hi: 8,  hp: 30,  s: 6,  fly: 1, v: 500 },
  lich:      { n: 'Lich',      i: '🔮', a: 13, d: 10, lo: 11, hi: 15, hp: 30,  s: 6,  shoot: 12, v: 900 },
  bknight:   { n: 'Black Knight', i: '🏇', a: 16, d: 16, lo: 15, hi: 30, hp: 120, s: 7, v: 2200 },
};

const CASTLE_TIERS = ['pikeman', 'archer', 'griffin', 'swordsman', 'monk', 'cavalier', 'angel'];
// build costs for dwelling tier 1..7 (tiers 1-2 exist at start)
const DWELL_COST = [
  null,
  { gold: 200 }, { gold: 1000 }, { gold: 1000, wood: 5 }, { gold: 1500, ore: 5 },
  { gold: 2000, gems: 3 }, { gold: 3000, ore: 10, gems: 3 }, { gold: 5000, wood: 10, ore: 10, gems: 10 },
];
const HALL_COST = { gold: 2500, wood: 5, ore: 5 };
const HALL_INCOME = 500;

const SPELLS = {
  arrow:     { n: 'Magic Arrow',    i: '🏹', cost: 5,  tgt: 'enemy', desc: 'Damage 10 x Spell Power + 10' },
  lightning: { n: 'Lightning Bolt', i: '⚡', cost: 10, tgt: 'enemy', desc: 'Damage 25 x Spell Power' },
  haste:     { n: 'Haste',          i: '💨', cost: 6,  tgt: 'ally',  desc: '+3 Speed for the battle' },
  bless:     { n: 'Bless',          i: '✨', cost: 5,  tgt: 'ally',  desc: 'Always max damage' },
  stone:     { n: 'Stone Skin',     i: '🪨', cost: 5,  tgt: 'ally',  desc: '+4 Defense' },
};

const ARTIFACTS = [
  { n: "Centaur's Axe", i: '🪓', stat: 'att', v: 2 },
  { n: 'Dragon Scale Shield', i: '🛡️', stat: 'def', v: 3 },
  { n: 'Orb of Inhibition', i: '🔮', stat: 'sp', v: 2 },
  { n: 'Tome of Lore', i: '📖', stat: 'kn', v: 3 },
];

const T = { GRASS: 0, FOREST: 1, MOUNT: 2, WATER: 3, ROAD: 4, SAND: 5 };
const TCOST = { 0: 100, 4: 70, 5: 150 };

function groupLabel(n) {
  if (n < 5) return 'Few'; if (n < 10) return 'Several'; if (n < 20) return 'A pack of';
  if (n < 50) return 'Lots of'; if (n < 100) return 'A horde of'; return 'A throng of';
}
function fmtCost(c) { return Object.keys(c).map(k => RES_ICON[k] + c[k]).join(' '); }
function canAfford(res, c) { return Object.keys(c).every(k => res[k] >= c[k]); }
function pay(res, c, mul = 1) { for (const k in c) res[k] -= c[k] * mul; }
function armyValue(arr) { return arr.reduce((s, a) => s + (a ? C[a.t].v * a.n : 0), 0); }
