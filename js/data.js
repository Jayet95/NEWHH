'use strict';
const RES = ['gold', 'wood', 'ore', 'mercury', 'sulfur', 'crystal', 'gems'];
const RES_ICON = { gold: '🪙', wood: '🪵', ore: '🪨', mercury: '🧪', sulfur: '🌋', crystal: '💠', gems: '💎' };
const RES_VALUE = { gold: 1, wood: 250, ore: 250, mercury: 500, sulfur: 500, crystal: 500, gems: 500 };
const MINE_YIELD = { gold: 1000, wood: 2, ore: 2, mercury: 1, sulfur: 1, crystal: 1, gems: 1 };
const MINE_ICON = { gold: '💰', wood: '🪵', ore: '⛏️', mercury: '🧪', sulfur: '🌋', crystal: '💠', gems: '💎' };
const MARKET_RATE = 0.8, MERCHANT_RATE = 0.6;
const MARKET_COST = { gold: 1500, wood: 5, ore: 5 };
const HIRE_COST = 2500, MAX_HEROES = 4;

// a=attack d=defense lo/hi=damage hp s=speed shoot=ammo fly=flyer v=AI value gr=weekly growth
// Neutral roaming monsters (not recruitable)
const C = {
  goblin:  { n: 'Goblin',      i: '👺', a: 4,  d: 2,  lo: 1,  hi: 2,  hp: 5,   s: 5,  v: 50 },
  wolf:    { n: 'Wolf Rider',  i: '🐺', a: 8,  d: 5,  lo: 2,  hi: 5,  hp: 25,  s: 8,  v: 200 },
  orc:     { n: 'Orc',         i: '🦍', a: 8,  d: 4,  lo: 2,  hi: 5,  hp: 15,  s: 4,  shoot: 12, v: 192 },
  ogre:    { n: 'Ogre',        i: '👹', a: 13, d: 7,  lo: 6,  hi: 12, hp: 60,  s: 4,  v: 416 },
  troll:   { n: 'Troll',       i: '🦖', a: 14, d: 7,  lo: 10, hi: 15, hp: 70,  s: 7,  v: 1024 },
  golem:   { n: 'Stone Golem', i: '🗿', a: 9,  d: 10, lo: 4,  hi: 8,  hp: 60,  s: 3,  v: 400 },
  naga:    { n: 'Naga',        i: '🐍', a: 16, d: 13, lo: 20, hi: 20, hp: 110, s: 5,  v: 1100 },
  dragon:  { n: 'Green Dragon', i: '🐉', a: 18, d: 18, lo: 40, hi: 50, hp: 180, s: 10, fly: 1, v: 3800 },
};

// ---------- the 9 castles: 7 tiers each ----------
// [name, upgraded name, icon, att, def, minDmg, maxDmg, hp, speed, shooterAmmo, flyer, gold, extraRes, extraAmt]
const FD = {
  castle: [
    ['Pikeman', 'Halberdier', '🔱', 4, 5, 1, 3, 10, 4, 0, 0, 60],
    ['Archer', 'Marksman', '🏹', 6, 3, 2, 3, 10, 4, 12, 0, 100],
    ['Griffin', 'Royal Griffin', '🦅', 8, 8, 3, 6, 25, 6, 0, 1, 200],
    ['Swordsman', 'Crusader', '⚔️', 10, 12, 6, 9, 35, 5, 0, 0, 300],
    ['Monk', 'Zealot', '🧙', 12, 7, 10, 12, 30, 5, 12, 0, 400],
    ['Cavalier', 'Champion', '🐎', 15, 15, 15, 25, 100, 7, 0, 0, 1000],
    ['Angel', 'Archangel', '👼', 20, 20, 50, 50, 200, 12, 0, 1, 3000, 'gems', 1]],
  rampart: [
    ['Centaur', 'Centaur Captain', '🐴', 5, 3, 2, 3, 8, 6, 0, 0, 70],
    ['Dwarf', 'Battle Dwarf', '🧔', 6, 7, 2, 4, 20, 3, 0, 0, 120],
    ['Wood Elf', 'Grand Elf', '🧝', 9, 5, 3, 5, 15, 6, 24, 0, 200],
    ['Pegasus', 'Silver Pegasus', '🪶', 9, 8, 5, 9, 30, 8, 0, 1, 250],
    ['Dendroid Guard', 'Dendroid Soldier', '🌳', 9, 12, 10, 14, 55, 3, 0, 0, 350],
    ['Unicorn', 'War Unicorn', '🦄', 15, 14, 18, 22, 90, 7, 0, 0, 850],
    ['Green Dragon', 'Gold Dragon', '🐲', 18, 18, 40, 50, 180, 10, 0, 1, 2400, 'gems', 1]],
  tower: [
    ['Gremlin', 'Master Gremlin', '👾', 3, 3, 1, 2, 4, 4, 8, 0, 30],
    ['Stone Gargoyle', 'Obsidian Gargoyle', '🦇', 6, 6, 2, 3, 16, 6, 0, 1, 130],
    ['Stone Golem', 'Iron Golem', '🤖', 7, 10, 4, 5, 30, 3, 0, 0, 150],
    ['Mage', 'Arch Mage', '🪄', 11, 8, 7, 9, 25, 5, 24, 0, 350],
    ['Genie', 'Master Genie', '🧞', 12, 12, 13, 16, 40, 7, 0, 1, 550],
    ['Naga', 'Naga Queen', '🐍', 16, 13, 20, 20, 110, 5, 0, 0, 1100],
    ['Giant', 'Titan', '🧌', 19, 16, 40, 60, 150, 7, 0, 0, 2000, 'gems', 1]],
  inferno: [
    ['Imp', 'Familiar', '😈', 2, 3, 1, 2, 4, 5, 0, 0, 50],
    ['Gog', 'Magog', '👹', 6, 4, 2, 4, 13, 4, 12, 0, 125],
    ['Hell Hound', 'Cerberus', '🐕', 10, 6, 2, 7, 25, 7, 0, 0, 200],
    ['Demon', 'Horned Demon', '👿', 10, 10, 7, 9, 35, 5, 0, 0, 250],
    ['Pit Fiend', 'Pit Lord', '🔥', 13, 13, 13, 17, 45, 6, 0, 0, 500],
    ['Efreet', 'Efreet Sultan', '☄️', 16, 12, 16, 24, 90, 9, 0, 1, 900],
    ['Devil', 'Arch Devil', '😡', 19, 21, 30, 40, 160, 11, 0, 1, 2700, 'mercury', 1]],
  necropolis: [
    ['Skeleton', 'Skeleton Warrior', '💀', 5, 4, 1, 3, 6, 4, 0, 0, 60],
    ['Walking Dead', 'Zombie', '🧟', 5, 5, 2, 3, 15, 3, 0, 0, 100],
    ['Wight', 'Wraith', '👻', 7, 7, 3, 5, 18, 5, 0, 0, 170],
    ['Vampire', 'Vampire Lord', '🧛', 10, 9, 5, 8, 30, 6, 0, 1, 360],
    ['Lich', 'Power Lich', '🔮', 13, 10, 11, 15, 30, 6, 12, 0, 550],
    ['Black Knight', 'Dread Knight', '🏇', 16, 16, 15, 30, 120, 7, 0, 0, 1200],
    ['Bone Dragon', 'Ghost Dragon', '🦴', 17, 15, 25, 50, 150, 9, 0, 1, 1800]],
  dungeon: [
    ['Troglodyte', 'Infernal Troglodyte', '🦎', 4, 3, 1, 3, 5, 4, 0, 0, 50],
    ['Harpy', 'Harpy Hag', '🐦‍⬛', 6, 5, 1, 4, 14, 6, 0, 1, 130],
    ['Beholder', 'Evil Eye', '👁️', 9, 7, 3, 5, 22, 5, 12, 0, 250],
    ['Medusa', 'Medusa Queen', '🧜', 9, 9, 6, 8, 25, 5, 4, 0, 300],
    ['Minotaur', 'Minotaur King', '🐂', 12, 12, 12, 20, 50, 6, 0, 0, 500],
    ['Manticore', 'Scorpicore', '🦂', 15, 13, 14, 20, 80, 7, 0, 1, 850],
    ['Red Dragon', 'Black Dragon', '🐉', 19, 19, 40, 50, 180, 11, 0, 1, 2500, 'sulfur', 1]],
  stronghold: [
    ['Goblin', 'Hobgoblin', '👺', 4, 2, 1, 2, 5, 5, 0, 0, 40],
    ['Wolf Rider', 'Wolf Raider', '🐺', 7, 5, 2, 4, 10, 6, 0, 0, 100],
    ['Orc', 'Orc Chieftain', '🦍', 8, 4, 2, 5, 15, 4, 12, 0, 150],
    ['Ogre', 'Ogre Mage', '👹', 13, 7, 6, 12, 60, 4, 0, 0, 300],
    ['Roc', 'Thunderbird', '🦜', 13, 11, 11, 15, 60, 7, 0, 1, 600],
    ['Cyclops', 'Cyclops King', '🧿', 15, 12, 16, 20, 70, 6, 16, 0, 750],
    ['Behemoth', 'Ancient Behemoth', '🦏', 17, 17, 30, 50, 160, 6, 0, 0, 1500]],
  fortress: [
    ['Gnoll', 'Gnoll Marauder', '🐕‍🦺', 3, 5, 2, 3, 6, 4, 0, 0, 50],
    ['Lizardman', 'Lizard Warrior', '🦎', 5, 6, 2, 3, 12, 4, 12, 0, 110],
    ['Serpent Fly', 'Dragon Fly', '🪰', 7, 9, 2, 5, 20, 9, 0, 1, 220],
    ['Basilisk', 'Greater Basilisk', '🐊', 11, 11, 6, 10, 35, 5, 0, 0, 400],
    ['Gorgon', 'Mighty Gorgon', '🐃', 10, 14, 12, 16, 70, 5, 0, 0, 525],
    ['Wyvern', 'Wyvern Monarch', '🦖', 14, 14, 18, 22, 70, 7, 0, 1, 800],
    ['Hydra', 'Chaos Hydra', '🐙', 16, 18, 25, 45, 175, 5, 0, 0, 2200]],
  conflux: [
    ['Pixie', 'Sprite', '🧚', 2, 2, 1, 2, 3, 7, 0, 1, 25],
    ['Air Elemental', 'Storm Elemental', '🌪️', 9, 9, 2, 8, 30, 7, 0, 0, 250],
    ['Water Elemental', 'Ice Elemental', '💧', 8, 10, 3, 7, 30, 5, 0, 0, 300],
    ['Fire Elemental', 'Energy Elemental', '🔥', 10, 8, 4, 6, 35, 6, 0, 0, 350],
    ['Earth Elemental', 'Magma Elemental', '⛰️', 10, 10, 4, 8, 40, 4, 0, 0, 400],
    ['Psychic Elemental', 'Magic Elemental', '🧠', 15, 13, 10, 20, 75, 7, 0, 0, 950],
    ['Firebird', 'Phoenix', '☀️', 18, 18, 30, 40, 150, 13, 0, 1, 1500, 'mercury', 1]],
};
const GROWTH = [14, 9, 7, 4, 3, 2, 1];
const MAX_LV = 5;
const RANK_PREFIX = ['', '', 'Veteran ', 'Elite ', 'Grand '];

// class templates for heroes
const CLASSES = {
  Knight: { att: 3, def: 2, sp: 1, kn: 1, i: '🛡️', spells: [] },
  Cleric: { att: 1, def: 2, sp: 2, kn: 2, i: '⚕️', spells: ['heal'] },
  Ranger: { att: 2, def: 3, sp: 1, kn: 1, i: '🏹', spells: [] },
  Druid: { att: 1, def: 1, sp: 2, kn: 3, i: '🌿', spells: ['slow'] },
  Wizard: { att: 1, def: 1, sp: 2, kn: 3, i: '🧙', spells: ['lightning'] },
  Demoniac: { att: 3, def: 2, sp: 1, kn: 1, i: '😈', spells: [] },
  Heretic: { att: 1, def: 1, sp: 3, kn: 2, i: '🔥', spells: ['lightning'] },
  'Death Knight': { att: 3, def: 2, sp: 1, kn: 1, i: '💀', spells: [] },
  Necromancer: { att: 1, def: 1, sp: 2, kn: 3, i: '☠️', spells: ['curse'] },
  Overlord: { att: 3, def: 2, sp: 1, kn: 1, i: '👑', spells: [] },
  Warlock: { att: 1, def: 1, sp: 3, kn: 2, i: '🔮', spells: ['lightning'] },
  Barbarian: { att: 4, def: 1, sp: 1, kn: 1, i: '🪓', spells: [] },
  'Battle Mage': { att: 2, def: 1, sp: 2, kn: 2, i: '⚡', spells: ['haste'] },
  Beastmaster: { att: 3, def: 2, sp: 1, kn: 1, i: '🐾', spells: [] },
  Witch: { att: 1, def: 1, sp: 2, kn: 3, i: '🧹', spells: ['slow'] },
  Planeswalker: { att: 2, def: 2, sp: 2, kn: 1, i: '🌀', spells: ['haste'] },
  Elementalist: { att: 1, def: 1, sp: 3, kn: 2, i: '💫', spells: ['lightning'] },
};

const FACTIONS = {
  castle: { name: 'Castle', icon: '🏰', town: 'Castle Dawnwatch', enemyTown: 'Citadel Lionheart', blurb: 'Noble knights, strong archers and mighty Angels.', heroes: [['Orrin', 'Knight'], ['Rion', 'Cleric']] },
  rampart: { name: 'Rampart', icon: '🌲', town: 'Rampart Greenhollow', enemyTown: 'Thornwall Keep', blurb: 'Elves, unicorns and dragons of the forest.', heroes: [['Mephala', 'Ranger'], ['Ufretin', 'Druid']] },
  tower: { name: 'Tower', icon: '🗼', town: 'Tower Skyspire', enemyTown: 'Spire of Solmyr', blurb: 'Arcane masters: gremlins, golems, nagas and Titans.', heroes: [['Solmyr', 'Wizard'], ['Cyra', 'Wizard']] },
  inferno: { name: 'Inferno', icon: '🔥', town: 'Inferno Emberfall', enemyTown: 'Hellgate Bastion', blurb: 'Demons and devils from the burning pits.', heroes: [['Xeron', 'Demoniac'], ['Calh', 'Heretic']] },
  necropolis: { name: 'Necropolis', icon: '💀', town: 'Necropolis Blackspire', enemyTown: 'Necropolis Blackspire', blurb: 'Undead hordes: skeletons, vampires and bone dragons.', heroes: [['Sandro', 'Necromancer'], ['Straker', 'Death Knight']] },
  dungeon: { name: 'Dungeon', icon: '🕳️', town: 'Dungeon Deepmaw', enemyTown: 'Underworld Citadel', blurb: 'Beholders, minotaurs and black dragons.', heroes: [['Mutare', 'Overlord'], ['Sephinroth', 'Warlock']] },
  stronghold: { name: 'Stronghold', icon: '🛖', town: 'Stronghold Ironfang', enemyTown: 'Warlord Fortress', blurb: 'Brutal orcs, ogres, cyclopes and behemoths.', heroes: [['Crag Hack', 'Barbarian'], ['Gretchin', 'Battle Mage']] },
  fortress: { name: 'Fortress', icon: '🐊', town: 'Fortress Mireholm', enemyTown: 'Swamp Fortress', blurb: 'Swamp beasts: basilisks, wyverns and hydras.', heroes: [['Tazar', 'Beastmaster'], ['Wystan', 'Witch']] },
  conflux: { name: 'Conflux', icon: '🌀', town: 'Conflux Stormreach', enemyTown: 'Elemental Nexus', blurb: 'Living elements ending in the mighty Phoenix.', heroes: [['Pasis', 'Planeswalker'], ['Thane', 'Elementalist']] },
};

const CASTLE_TIERS = []; // creature base ids of the player's faction (mutated by setFaction)
function lineType(id, lv) { return lv > 1 ? id + '_' + lv : id; }
function factionTiers(f) { return [1, 2, 3, 4, 5, 6, 7].map(i => f + i); }
function setFaction(f) { CASTLE_TIERS.length = 0; CASTLE_TIERS.push(...factionTiers(f)); }

(function buildCreatures() {
  for (const f in FD) {
    FD[f].forEach((r, idx) => {
      const [name, up, icon, a, d, lo, hi, hp, s, ammo, fly, gold, xr, xa] = r, id = f + (idx + 1);
      const cost = { gold }; if (xr) cost[xr] = xa;
      const base = { n: name, i: icon, a, d, lo, hi, hp, s, cost, gr: GROWTH[idx], v: Math.round(gold * 1.35), lv: 1, line: id, fac: f, tier: idx + 1 };
      if (ammo) base.shoot = ammo; if (fly) base.fly = 1;
      C[id] = base;
      for (let L = 2; L <= MAX_LV; L++) {
        const k = L - 1, c2 = {};
        for (const rr in cost) c2[rr] = rr === 'gold' ? Math.round(cost[rr] * (1 + 0.3 * k)) : cost[rr];
        const o = { ...base, n: RANK_PREFIX[L - 1] + up, lv: L, cost: c2,
          a: a + Math.round(1.5 * k), d: d + Math.round(1.5 * k),
          lo: Math.round(lo * (1 + 0.18 * k)), hi: Math.round(hi * (1 + 0.18 * k)),
          hp: Math.round(hp * (1 + 0.22 * k)), s: s + (L >= 3 ? 1 : 0) + (L >= 5 ? 1 : 0),
          v: Math.round(base.v * (1 + 0.35 * k)) };
        if (ammo) o.shoot = ammo + 2 * k; else delete o.shoot;
        if (!fly) delete o.fly;
        C[lineType(id, L)] = o;
      }
      C[id].n = name;
    });
  }
})();

// hero roster: id -> definition
const HEROES = {};
for (const f in FACTIONS) FACTIONS[f].heroes.forEach(([n, cls]) => { HEROES[n] = { id: n, name: n, cls, fac: f, ...CLASSES[cls] }; });

// ---------- dwellings, upgrades, hall, guild ----------
const DWELL_COST = [
  null,
  { gold: 200 }, { gold: 1000 }, { gold: 1000, wood: 5 }, { gold: 1500, ore: 5 },
  { gold: 2000, crystal: 3 }, { gold: 3000, ore: 10, sulfur: 3 }, { gold: 5000, wood: 10, ore: 10, mercury: 5, gems: 10 },
];
function upgradeCost(tier, L) {
  const c = { gold: 400 * tier * (L - 1) };
  if (L === 2) c.wood = tier + 1;
  if (L === 3) { c.ore = 2 * tier; c.mercury = tier; }
  if (L === 4) { c.sulfur = 2 * tier; c.crystal = tier; }
  if (L === 5) { c.gems = 2 * tier; c.crystal = 2 * tier; c.mercury = tier; }
  return c;
}
// Town Hall: 5 levels
const HALL_LEVELS = [
  null,
  { n: 'Village Hall', inc: 250, cost: { gold: 1500 } },
  { n: 'Town Hall', inc: 500, cost: { gold: 3000, wood: 5, ore: 5 } },
  { n: 'City Hall', inc: 1000, cost: { gold: 5000, wood: 10, ore: 10, mercury: 3 } },
  { n: 'Capitol', inc: 2000, cost: { gold: 8000, mercury: 5, sulfur: 5, crystal: 5, gems: 5 } },
  { n: 'Grand Capitol', inc: 3500, cost: { gold: 12000, mercury: 10, sulfur: 10, crystal: 10, gems: 10 } },
];
const FORT_INCOME = 400;
const MILITIA = 6;
const GUILD_COST = [null, { gold: 2000, wood: 5, ore: 5 }, { gold: 3000, mercury: 4, sulfur: 4 }, { gold: 4000, mercury: 6, sulfur: 6, crystal: 6, gems: 6 }];
const GUILD_SPELLS = [null, ['lightning', 'haste', 'slow', 'heal'], ['fireball', 'curse', 'resurrect'], ['chain', 'implosion']];
const START_SPELLS = ['arrow', 'bless', 'stone'];

const SPELLS = {
  arrow:     { n: 'Magic Arrow',    i: '🏹', cost: 5,  tgt: 'enemy', desc: 'Damage 10 x Spell Power + 10' },
  lightning: { n: 'Lightning Bolt', i: '⚡', cost: 10, tgt: 'enemy', desc: 'Damage 25 x Spell Power' },
  fireball:  { n: 'Fireball',       i: '🔥', cost: 15, tgt: 'enemy', desc: 'Area: 15 x Spell Power + 10 to the target and adjacent enemies' },
  chain:     { n: 'Chain Lightning', i: '🌩️', cost: 20, tgt: 'enemy', desc: 'Hits 3 enemies: 40 x SP, then half, then half again' },
  implosion: { n: 'Implosion',      i: '🕳️', cost: 30, tgt: 'enemy', desc: 'Damage 75 x Spell Power' },
  slow:      { n: 'Slow',           i: '🐌', cost: 6,  tgt: 'enemy', desc: '-3 Speed for the battle' },
  curse:     { n: 'Curse',          i: '☠️', cost: 6,  tgt: 'enemy', desc: 'Target always deals minimum damage' },
  haste:     { n: 'Haste',          i: '💨', cost: 6,  tgt: 'ally',  desc: '+3 Speed for the battle' },
  bless:     { n: 'Bless',          i: '✨', cost: 5,  tgt: 'ally',  desc: 'Always max damage' },
  stone:     { n: 'Stone Skin',     i: '🪨', cost: 5,  tgt: 'ally',  desc: '+4 Defense' },
  heal:      { n: 'Heal',           i: '💚', cost: 6,  tgt: 'ally',  desc: 'Restore 6 x Spell Power hit points (no revival)' },
  resurrect: { n: 'Resurrection',   i: '🕊️', cost: 18, tgt: 'ally',  desc: 'Restore 40 x Spell Power hit points, reviving fallen creatures' },
};
const PORTAL_COST = 12;

// level-up perks (each can be taken up to MAX_PERK times)
const MAX_PERK = 3;
const PERKS = {
  offense:    { n: 'Offense',    i: '⚔️', d: '+10% melee damage per rank' },
  archery:    { n: 'Archery',    i: '🏹', d: '+10% ranged damage per rank' },
  armorer:    { n: 'Armorer',    i: '🛡️', d: '-7% damage taken per rank' },
  leadership: { n: 'Leadership', i: '🚩', d: '+1 speed to all your creatures per rank' },
  logistics:  { n: 'Logistics',  i: '🥾', d: '+10% daily movement per rank' },
  wisdom:     { n: 'Wisdom',     i: '📚', d: '+15 maximum mana per rank' },
  sorcery:    { n: 'Sorcery',    i: '🔮', d: '+15% spell damage per rank' },
  estates:    { n: 'Estates',    i: '💰', d: '+300 gold per day per rank' },
  ballistics: { n: 'Ballistics', i: '🎯', d: '+50% siege damage (catapult and walls) per rank' },
  charisma:   { n: 'Charisma',   i: '🤝', d: 'Much weaker neutral stacks may join you: 50% / 75% / 100% of them, at a lower strength advantage per rank' },
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
