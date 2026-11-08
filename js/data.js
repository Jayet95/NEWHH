'use strict';
const RES = ['gold', 'wood', 'ore', 'mercury', 'sulfur', 'crystal', 'gems'];
const RES_ICON = { gold: '🪙', wood: '🪵', ore: '🪨', mercury: '🧪', sulfur: '🌋', crystal: '💠', gems: '💎' };
const RES_VALUE = { gold: 1, wood: 250, ore: 250, mercury: 500, sulfur: 500, crystal: 500, gems: 500 };
const MINE_YIELD = { gold: 1000, wood: 2, ore: 2, mercury: 1, sulfur: 1, crystal: 1, gems: 1 };
const MINE_ICON = { gold: '💰', wood: '🪵', ore: '⛏️', mercury: '🧪', sulfur: '🌋', crystal: '💠', gems: '💎' };
const MARKET_RATE = 0.8, MERCHANT_RATE = 0.6;
const MARKET_COST = { gold: 1500, wood: 5, ore: 5 };
const HIRE_COST = 2500, MAX_HEROES = 4;

// gold/res: starting resources, neutral/garrison: guard strength, ehDay/ehMul/ehMove/ehGrow: enemy hero, income: your daily income
const DIFFICULTY = {
  easy:   { name: 'Easy',   icon: '🌱', desc: 'Generous start, weak guards, a late and gentle enemy hero.', gold: 15000, res: 1.5, neutral: 0.7, garrison: 0.7, ehDay: 11, ehMul: 0.7, ehMove: 800, ehGrow: 1.1, income: 1.25, aiInc: 0.55 },
  normal: { name: 'Normal', icon: '⚔️', desc: 'The intended challenge.', gold: 10000, res: 1, neutral: 1, garrison: 1, ehDay: 8, ehMul: 1, ehMove: 1000, ehGrow: 1.15, income: 1, aiInc: 0.85 },
  hard:   { name: 'Hard',   icon: '🔥', desc: 'Tougher guards, an earlier and stronger enemy hero, leaner income.', gold: 7500, res: 0.75, neutral: 1.3, garrison: 1.3, ehDay: 6, ehMul: 1.3, ehMove: 1200, ehGrow: 1.2, income: 0.85, aiInc: 1.1 },
  expert: { name: 'Expert', icon: '💀', desc: 'Scarce resources, brutal guards, and the enemy hero marches almost at once.', gold: 5000, res: 0.5, neutral: 1.6, garrison: 1.6, ehDay: 4, ehMul: 1.7, ehMove: 1400, ehGrow: 1.3, income: 0.7, aiInc: 1.5 },
};

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
  shark:   { n: 'Shark',       i: '🦈', a: 10, d: 6,  lo: 4,  hi: 8,  hp: 40,  s: 7,  v: 420 },
  kraken:  { n: 'Kraken',      i: '🦑', a: 15, d: 14, lo: 15, hi: 30, hp: 130, s: 6,  v: 1500 },
};

// ---------- map presets, sizes and boats ----------
const MAPS = {
  plains:   { name: 'Emerald Plains', icon: '🌿', desc: 'Balanced lands, a sheltered bay by your castle.', water: 0.30, mount: 0.72, forest: 0.60, bay: 1, density: 1 },
  highland: { name: 'Highland Frontier', icon: '⛰️', desc: 'Mountains and forests funnel armies through narrow passes.', water: 0.22, mount: 0.60, forest: 0.52, bay: 0.6, density: 1 },
  isles:    { name: 'Sunken Isles', icon: '🏝️', desc: 'Much water and a wide sea: boats and sea treasures matter.', water: 0.42, mount: 0.78, forest: 0.62, bay: 1.5, density: 1 },
  steppe:   { name: 'Wild Steppe', icon: '🌾', desc: 'Open plains with few obstacles and many wandering monsters.', water: 0.18, mount: 0.82, forest: 0.72, bay: 0.6, density: 1.3 },
};
// mv: movement/enemy-march multiplier so big maps stay playable
const SIZES = {
  small: { name: 'Small', w: 32, h: 22, mv: 1 }, medium: { name: 'Medium', w: 40, h: 28, mv: 1 }, large: { name: 'Large', w: 60, h: 42, mv: 1.25 },
  huge: { name: 'Huge', w: 90, h: 64, mv: 1.6 }, giant: { name: 'Giant', w: 128, h: 90, mv: 2 },
};
const SHIPYARD_COST = { gold: 2000, wood: 20 }, BOAT_COST = { gold: 1000, wood: 10 }, MAX_BOATS = 2;

// ---------- the 9 castles: 7 tiers each ----------
// [name, upgraded name, icon, att, def, minDmg, maxDmg, hp, speed, shooterAmmo, flyer, gold, extraRes, extraAmt]
const FD = {
  castle: [
    ['Pikeman', 'Halberdier', '🔱', 4, 5, 1, 3, 10, 4, 0, 0, 60],
    ['Archer', 'Marksman', '🏹', 6, 3, 2, 3, 10, 4, 12, 0, 100],
    ['Griffin', 'Royal Griffin', '🦅', 8, 8, 3, 6, 25, 6, 0, 1, 260],
    ['Swordsman', 'Crusader', '⚔️', 10, 12, 6, 9, 35, 5, 0, 0, 350],
    ['Monk', 'Zealot', '🧙', 12, 7, 10, 12, 30, 5, 12, 0, 400],
    ['Cavalier', 'Champion', '🐎', 15, 15, 15, 25, 100, 7, 0, 0, 1000],
    ['Angel', 'Archangel', '👼', 20, 20, 50, 50, 200, 12, 0, 1, 3000, 'gems', 1]],
  rampart: [
    ['Centaur', 'Centaur Captain', '🐴', 5, 3, 2, 3, 8, 6, 0, 0, 70],
    ['Dwarf', 'Battle Dwarf', '🧔', 6, 7, 2, 4, 20, 3, 0, 0, 120],
    ['Wood Elf', 'Grand Elf', '🧝', 9, 5, 3, 5, 15, 6, 24, 0, 200],
    ['Pegasus', 'Silver Pegasus', '🪶', 9, 8, 5, 9, 30, 8, 0, 1, 250],
    ['Dendroid Guard', 'Dendroid Soldier', '🌳', 9, 12, 10, 14, 55, 3, 0, 0, 450],
    ['Unicorn', 'War Unicorn', '🦄', 15, 14, 18, 22, 90, 7, 0, 0, 940],
    ['Green Dragon', 'Gold Dragon', '🐲', 18, 18, 40, 50, 180, 10, 0, 1, 2400, 'gems', 1]],
  tower: [
    ['Gremlin', 'Master Gremlin', '👾', 3, 3, 1, 2, 4, 4, 8, 0, 40],
    ['Stone Gargoyle', 'Obsidian Gargoyle', '🦇', 6, 6, 2, 3, 16, 6, 0, 1, 110],
    ['Stone Golem', 'Iron Golem', '🤖', 7, 10, 4, 5, 30, 3, 0, 0, 170],
    ['Mage', 'Arch Mage', '🪄', 11, 8, 7, 9, 25, 5, 24, 0, 350],
    ['Genie', 'Master Genie', '🧞', 12, 12, 13, 16, 40, 7, 0, 1, 400],
    ['Naga', 'Naga Queen', '🐍', 16, 13, 20, 20, 110, 5, 0, 0, 1100],
    ['Giant', 'Titan', '🧌', 19, 16, 40, 60, 150, 7, 0, 0, 2000, 'gems', 1]],
  inferno: [
    ['Imp', 'Familiar', '😈', 2, 3, 1, 2, 4, 5, 0, 0, 40],
    ['Gog', 'Magog', '👹', 6, 4, 2, 4, 13, 4, 12, 0, 125],
    ['Hell Hound', 'Cerberus', '🐕', 10, 6, 2, 7, 25, 7, 0, 0, 200],
    ['Demon', 'Horned Demon', '👿', 10, 10, 7, 9, 35, 5, 0, 0, 290],
    ['Pit Fiend', 'Pit Lord', '🔥', 13, 13, 13, 17, 45, 6, 0, 0, 500],
    ['Efreet', 'Efreet Sultan', '☄️', 16, 12, 16, 24, 90, 9, 0, 1, 900],
    ['Devil', 'Arch Devil', '😡', 19, 21, 30, 40, 160, 11, 0, 1, 2300, 'mercury', 1]],
  necropolis: [
    ['Skeleton', 'Skeleton Warrior', '💀', 5, 4, 1, 3, 6, 4, 0, 0, 60],
    ['Walking Dead', 'Zombie', '🧟', 5, 5, 2, 3, 15, 3, 0, 0, 100],
    ['Wight', 'Wraith', '👻', 7, 7, 3, 5, 18, 5, 0, 0, 170],
    ['Vampire', 'Vampire Lord', '🧛', 10, 9, 5, 8, 30, 6, 0, 1, 310],
    ['Lich', 'Power Lich', '🔮', 13, 10, 11, 15, 30, 6, 12, 0, 550],
    ['Black Knight', 'Dread Knight', '🏇', 16, 16, 15, 30, 120, 7, 0, 0, 1200],
    ['Bone Dragon', 'Ghost Dragon', '🦴', 17, 15, 25, 50, 150, 9, 0, 1, 1800]],
  dungeon: [
    ['Troglodyte', 'Infernal Troglodyte', '🦎', 4, 3, 1, 3, 5, 4, 0, 0, 50],
    ['Harpy', 'Harpy Hag', '🐦‍⬛', 6, 5, 1, 4, 14, 6, 0, 1, 110],
    ['Beholder', 'Evil Eye', '👁️', 9, 7, 3, 5, 22, 5, 12, 0, 210],
    ['Medusa', 'Medusa Queen', '🧜', 9, 9, 6, 8, 25, 5, 4, 0, 300],
    ['Minotaur', 'Minotaur King', '🐂', 12, 12, 12, 20, 50, 6, 0, 0, 560],
    ['Manticore', 'Scorpicore', '🦂', 15, 13, 14, 20, 80, 7, 0, 1, 850],
    ['Red Dragon', 'Black Dragon', '🐉', 19, 19, 40, 50, 180, 11, 0, 1, 2500, 'sulfur', 1]],
  stronghold: [
    ['Goblin', 'Hobgoblin', '👺', 4, 2, 1, 2, 5, 5, 0, 0, 40],
    ['Wolf Rider', 'Wolf Raider', '🐺', 7, 5, 2, 4, 10, 6, 0, 0, 100],
    ['Orc', 'Orc Chieftain', '🦍', 8, 4, 2, 5, 15, 4, 12, 0, 150],
    ['Ogre', 'Ogre Mage', '👹', 13, 7, 6, 12, 60, 4, 0, 0, 410],
    ['Roc', 'Thunderbird', '🦜', 13, 11, 11, 15, 60, 7, 0, 1, 600],
    ['Cyclops', 'Cyclops King', '🧿', 15, 12, 16, 20, 70, 6, 16, 0, 880],
    ['Behemoth', 'Ancient Behemoth', '🦏', 17, 17, 30, 50, 160, 6, 0, 0, 1900]],
  fortress: [
    ['Gnoll', 'Gnoll Marauder', '🐕‍🦺', 3, 5, 2, 3, 6, 4, 0, 0, 50],
    ['Lizardman', 'Lizard Warrior', '🦎', 5, 6, 2, 3, 12, 4, 12, 0, 110],
    ['Serpent Fly', 'Dragon Fly', '🪰', 7, 9, 2, 5, 20, 9, 0, 1, 180],
    ['Basilisk', 'Greater Basilisk', '🐊', 11, 11, 6, 10, 35, 5, 0, 0, 400],
    ['Gorgon', 'Mighty Gorgon', '🐃', 10, 14, 12, 16, 70, 5, 0, 0, 590],
    ['Wyvern', 'Wyvern Monarch', '🦖', 14, 14, 18, 22, 70, 7, 0, 1, 800],
    ['Hydra', 'Chaos Hydra', '🐙', 16, 18, 25, 45, 175, 5, 0, 0, 2800]],
  conflux: [
    ['Pixie', 'Sprite', '🧚', 2, 2, 1, 2, 3, 7, 0, 1, 25],
    ['Air Elemental', 'Storm Elemental', '🌪️', 9, 9, 2, 8, 30, 7, 0, 0, 250],
    ['Water Elemental', 'Ice Elemental', '💧', 8, 10, 3, 7, 30, 5, 0, 0, 260],
    ['Fire Elemental', 'Energy Elemental', '🔥', 10, 8, 4, 6, 35, 6, 0, 0, 290],
    ['Earth Elemental', 'Magma Elemental', '⛰️', 10, 10, 4, 8, 40, 4, 0, 0, 310],
    ['Psychic Elemental', 'Magic Elemental', '🧠', 15, 13, 10, 20, 75, 7, 0, 0, 950],
    ['Firebird', 'Phoenix', '☀️', 18, 18, 30, 40, 150, 13, 0, 1, 1750, 'mercury', 1]],
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
  Alchemist: { att: 1, def: 1, sp: 2, kn: 2, i: '⚗️', spells: ['slow'] },
  Elementalist: { att: 1, def: 1, sp: 3, kn: 2, i: '💫', spells: ['lightning'] },
};

const FACTIONS = {
  castle: { name: 'Castle', icon: '🏰', town: 'Castle Dawnwatch', enemyTown: 'Citadel Lionheart', blurb: 'Noble knights, strong archers and mighty Angels.', heroes: [['Orrin', 'Knight', { sk: 'forester' }], ['Valeska', 'Knight', { sk: 'offense', f: 1 }], ['Edric', 'Knight', { sk: 'scouting' }], ['Sylvia', 'Knight', { sk: 'fortune', f: 1 }], ['Lord Haart', 'Knight', { sk: 'ballistics' }], ['Sorsha', 'Knight', { sk: 'forester', f: 1 }], ['Christian', 'Knight', { sk: 'leadership' }], ['Tyris', 'Knight', { sk: 'estates', def: 1, f: 1 }], ['Rion', 'Cleric', { sk: 'firemagic' }], ['Adela', 'Cleric', { sk: 'navigation', f: 1 }], ['Cuthbert', 'Cleric', { sk: 'watermagic' }], ['Adelaide', 'Cleric', { sk: 'airmagic', kn: 1, f: 1 }], ['Ingham', 'Cleric', { sk: 'charisma' }], ['Sanya', 'Cleric', { sk: 'firemagic', f: 1 }], ['Loynis', 'Cleric', { sk: 'earthmagic' }], ['Caitlin', 'Cleric', { sk: 'sorcery', f: 1 }]] },
  rampart: { name: 'Rampart', icon: '🌲', town: 'Rampart Greenhollow', enemyTown: 'Thornwall Keep', blurb: 'Elves, unicorns and dragons of the forest.', heroes: [['Mephala', 'Ranger', { sk: 'fortune', att: 1, f: 1 }], ['Ufretin', 'Ranger', { sk: 'leadership' }], ['Jenova', 'Ranger', { sk: 'scouting', f: 1 }], ['Ryland', 'Ranger', { sk: 'logistics' }], ['Thorgrim', 'Ranger', { sk: 'armorer' }], ['Ivor', 'Ranger', { sk: 'logistics', att: 1 }], ['Clancy', 'Ranger', { sk: 'logistics' }], ['Kyrre', 'Ranger', { sk: 'leadership' }], ['Coronius', 'Druid', { sk: 'sorcery' }], ['Uland', 'Druid', { sk: 'earthmagic', sp: 1 }], ['Elleshar', 'Druid', { sk: 'learning', sp: 1 }], ['Gem', 'Druid', { sk: 'navigation', kn: 1 }], ['Malcom', 'Druid', { sk: 'airmagic', kn: 1 }], ['Melodia', 'Druid', { sk: 'wisdom', kn: 1, f: 1 }], ['Alagar', 'Druid', { sk: 'sorcery' }], ['Aeris', 'Druid', { sk: 'earthmagic', sp: 1, f: 1 }]] },
  tower: { name: 'Tower', icon: '🗼', town: 'Tower Skyspire', enemyTown: 'Spire of Solmyr', blurb: 'Arcane masters: gremlins, golems, nagas and Titans.', heroes: [['Piquedram', 'Alchemist', { sk: 'fortune' }], ['Thane', 'Alchemist', { sk: 'logistics' }], ['Josephine', 'Alchemist', { sk: 'ballistics', def: 1, f: 1 }], ['Neela', 'Alchemist', { sk: 'leadership', def: 1, f: 1 }], ['Torosar', 'Alchemist', { sk: 'archery', att: 1 }], ['Fafner', 'Alchemist', { sk: 'armorer' }], ['Rissa', 'Alchemist', { sk: 'armorer', f: 1 }], ['Iona', 'Alchemist', { sk: 'ballistics', f: 1 }], ['Astral', 'Wizard', { sk: 'wisdom' }], ['Halon', 'Wizard', { sk: 'firemagic' }], ['Serena', 'Wizard', { sk: 'sorcery', f: 1 }], ['Daremyth', 'Wizard', { sk: 'sorcery' }], ['Theodorus', 'Wizard', { sk: 'airmagic', kn: 1 }], ['Solmyr', 'Wizard', { sk: 'sorcery', sp: 1 }], ['Cyra', 'Wizard', { sk: 'watermagic', f: 1 }], ['Aine', 'Wizard', { sk: 'navigation' }]] },
  inferno: { name: 'Inferno', icon: '🔥', town: 'Inferno Emberfall', enemyTown: 'Hellgate Bastion', blurb: 'Demons and devils from the burning pits.', heroes: [['Fiona', 'Demoniac', { sk: 'offense', f: 1 }], ['Rashka', 'Demoniac', { sk: 'fortune', f: 1 }], ['Marius', 'Demoniac', { sk: 'offense', def: 1 }], ['Ignatius', 'Demoniac', { sk: 'fortune' }], ['Octavia', 'Demoniac', { sk: 'scouting', f: 1 }], ['Calh', 'Demoniac', { sk: 'logistics' }], ['Pyre', 'Demoniac', { sk: 'logistics', att: 1 }], ['Nymus', 'Demoniac', { sk: 'fortune' }], ['Ayden', 'Heretic', { sk: 'airmagic', kn: 1 }], ['Xyron', 'Heretic', { sk: 'sorcery' }], ['Axsis', 'Heretic', { sk: 'earthmagic' }], ['Olema', 'Heretic', { sk: 'sorcery', sp: 1, f: 1 }], ['Calid', 'Heretic', { sk: 'airmagic', f: 1 }], ['Ash', 'Heretic', { sk: 'sorcery', sp: 1 }], ['Zydar', 'Heretic', { sk: 'charisma' }], ['Xarfax', 'Heretic', { sk: 'learning' }]] },
  necropolis: { name: 'Necropolis', icon: '💀', town: 'Necropolis Blackspire', enemyTown: 'Necropolis Blackspire', blurb: 'Undead hordes: skeletons, vampires and bone dragons.', heroes: [['Straker', 'Death Knight', { sk: 'necromancy' }], ['Vokial', 'Death Knight', { sk: 'forester' }], ['Moandor', 'Death Knight', { sk: 'archery' }], ['Charna', 'Death Knight', { sk: 'estates', def: 1, f: 1 }], ['Tamika', 'Death Knight', { sk: 'necromancy', f: 1 }], ['Isra', 'Death Knight', { sk: 'estates', f: 1 }], ['Clavius', 'Death Knight', { sk: 'offense', def: 1 }], ['Galthran', 'Death Knight', { sk: 'leadership' }], ['Septienna', 'Necromancer', { sk: 'necromancy', f: 1 }], ['Aislinn', 'Necromancer', { sk: 'charisma', sp: 1, f: 1 }], ['Sandro', 'Necromancer', { sk: 'wisdom' }], ['Nimbus', 'Necromancer', { sk: 'learning', sp: 1 }], ['Thant', 'Necromancer', { sk: 'necromancy' }], ['Xsi', 'Necromancer', { sk: 'firemagic', sp: 1 }], ['Vidomina', 'Necromancer', { sk: 'mysticism', f: 1 }], ['Nagash', 'Necromancer', { sk: 'sorcery' }]] },
  dungeon: { name: 'Dungeon', icon: '🕳️', town: 'Dungeon Deepmaw', enemyTown: 'Underworld Citadel', blurb: 'Beholders, minotaurs and black dragons.', heroes: [['Lorelei', 'Overlord', { sk: 'fortune', f: 1 }], ['Arlach', 'Overlord', { sk: 'ballistics' }], ['Dace', 'Overlord', { sk: 'leadership', def: 1 }], ['Ajit', 'Overlord', { sk: 'forester', att: 1 }], ['Damacon', 'Overlord', { sk: 'leadership' }], ['Gunnar', 'Overlord', { sk: 'estates', def: 1 }], ['Synca', 'Overlord', { sk: 'fortune', f: 1 }], ['Shakti', 'Overlord', { sk: 'fortune', f: 1 }], ['Alamar', 'Warlock', { sk: 'firemagic' }], ['Jaegar', 'Warlock', { sk: 'charisma', sp: 1 }], ['Malekith', 'Warlock', { sk: 'navigation' }], ['Jeddite', 'Warlock', { sk: 'mysticism' }], ['Geon', 'Warlock', { sk: 'wisdom' }], ['Deemer', 'Warlock', { sk: 'sorcery' }], ['Sephinroth', 'Warlock', { sk: 'firemagic' }], ['Darkstorm', 'Warlock', { sk: 'navigation', kn: 1 }]] },
  stronghold: { name: 'Stronghold', icon: '🛖', town: 'Stronghold Ironfang', enemyTown: 'Warlord Fortress', blurb: 'Brutal orcs, ogres, cyclopes and behemoths.', heroes: [['Yog', 'Barbarian', { sk: 'offense' }], ['Gurnisson', 'Barbarian', { sk: 'archery' }], ['Jabarkas', 'Barbarian', { sk: 'scouting' }], ['Shiva', 'Barbarian', { sk: 'scouting', f: 1 }], ['Gretchin', 'Barbarian', { sk: 'logistics', f: 1 }], ['Krellion', 'Barbarian', { sk: 'armorer', att: 1 }], ['Crag Hack', 'Barbarian', { sk: 'logistics', att: 1 }], ['Tyraxor', 'Barbarian', { sk: 'offense', def: 1 }], ['Gird', 'Battle Mage', { sk: 'earthmagic' }], ['Vey', 'Battle Mage', { sk: 'firemagic', sp: 1 }], ['Dessa', 'Battle Mage', { sk: 'learning', f: 1 }], ['Terek', 'Battle Mage', { sk: 'airmagic' }], ['Zubin', 'Battle Mage', { sk: 'earthmagic' }], ['Gundula', 'Battle Mage', { sk: 'earthmagic', f: 1 }], ['Oris', 'Battle Mage', { sk: 'wisdom', kn: 1 }], ['Saurug', 'Battle Mage', { sk: 'watermagic', kn: 1 }]] },
  fortress: { name: 'Fortress', icon: '🐊', town: 'Fortress Mireholm', enemyTown: 'Swamp Fortress', blurb: 'Swamp beasts: basilisks, wyverns and hydras.', heroes: [['Bron', 'Beastmaster', { sk: 'ballistics', def: 1 }], ['Drakon', 'Beastmaster', { sk: 'ballistics', def: 1 }], ['Wystan', 'Beastmaster', { sk: 'armorer', att: 1, f: 1 }], ['Tazar', 'Beastmaster', { sk: 'armorer' }], ['Alkin', 'Beastmaster', { sk: 'leadership' }], ['Korbac', 'Beastmaster', { sk: 'armorer' }], ['Gerwulf', 'Beastmaster', { sk: 'forester' }], ['Broghild', 'Beastmaster', { sk: 'estates', f: 1 }], ['Mirlanda', 'Witch', { sk: 'sorcery', f: 1 }], ['Rosic', 'Witch', { sk: 'charisma', sp: 1, f: 1 }], ['Voy', 'Witch', { sk: 'firemagic' }], ['Verdish', 'Witch', { sk: 'airmagic', kn: 1 }], ['Merist', 'Witch', { sk: 'earthmagic', sp: 1 }], ['Styg', 'Witch', { sk: 'wisdom' }], ['Andra', 'Witch', { sk: 'learning', f: 1 }], ['Tiva', 'Witch', { sk: 'sorcery', sp: 1, f: 1 }]] },
  conflux: { name: 'Conflux', icon: '🌀', town: 'Conflux Stormreach', enemyTown: 'Elemental Nexus', blurb: 'Living elements ending in the mighty Phoenix.', heroes: [['Pasis', 'Planeswalker', { sk: 'forester', att: 1 }], ['Thunar', 'Planeswalker', { sk: 'armorer' }], ['Ignissa', 'Planeswalker', { sk: 'armorer', f: 1 }], ['Lacus', 'Planeswalker', { sk: 'armorer', f: 1 }], ['Monere', 'Planeswalker', { sk: 'armorer', f: 1 }], ['Erdamon', 'Planeswalker', { sk: 'logistics', att: 1 }], ['Fiur', 'Planeswalker', { sk: 'logistics' }], ['Kalt', 'Planeswalker', { sk: 'logistics' }], ['Luna', 'Elementalist', { sk: 'earthmagic', f: 1 }], ['Brissa', 'Elementalist', { sk: 'learning', f: 1 }], ['Ciele', 'Elementalist', { sk: 'charisma', sp: 1, f: 1 }], ['Labetha', 'Elementalist', { sk: 'wisdom', f: 1 }], ['Inteus', 'Elementalist', { sk: 'learning' }], ['Aenain', 'Elementalist', { sk: 'earthmagic' }], ['Gelare', 'Elementalist', { sk: 'learning', sp: 1, f: 1 }], ['Grindan', 'Elementalist', { sk: 'airmagic', kn: 1 }]] },
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

// ---------- creature abilities: [abilities at level 1, abilities added/overridden at upgrade levels 2+] ----------
const ABIL = {
  castle2: [[], ['dshot']], castle3: [['unlimRet'], []], castle4: [[], ['dstrike']], castle5: [[], ['nopen']], castle6: [['joust'], []], castle7: [['hate:inferno7'], []],
  rampart2: [['res:0.2'], ['res:0.4']], rampart3: [['dshot'], []], rampart6: [['stun:20'], []], rampart7: [['res:0.5'], ['res:0.75']],
  tower3: [['mindless', 'res:0.5'], ['res:0.75']], tower4: [[], ['nopen']], tower5: [['hate:inferno6'], []], tower6: [['noRet'], []],
  inferno2: [[], ['splash']], inferno3: [[], ['noRet']], inferno6: [['fireImm', 'hate:tower5'], []], inferno7: [['noRet', 'hate:castle7'], []],
  necropolis1: [['mindless'], []], necropolis2: [['mindless'], []], necropolis3: [['mindless'], []], necropolis4: [['mindless', 'noRet'], ['drain']],
  necropolis5: [['mindless', 'cloud'], []], necropolis6: [['mindless'], []], necropolis7: [['mindless'], []],
  dungeon2: [['return'], []], dungeon4: [['stun:20'], []], dungeon7: [['breath', 'res:0.5'], ['res:0.75']],
  stronghold2: [[], ['dstrike']], stronghold6: [[], ['nopen']], stronghold7: [['pierce:0.4'], ['pierce:0.8']],
  fortress4: [['stun:20'], []], fortress7: [['allAdj', 'noRet'], []],
  conflux2: [['mindless'], []], conflux3: [['mindless'], []], conflux4: [['mindless', 'fireImm'], []], conflux5: [['mindless'], []], conflux7: [['fireImm'], []],
};
(function applyAbilities() {
  const merge = (a, b) => { const m = new Map(); [...a, ...b].forEach(s => m.set(s.split(':')[0], s)); return [...m.values()]; };
  for (const id in C) if (!C[id].ab) C[id].ab = [];
  for (const id in ABIL) { const [b, u] = ABIL[id]; for (let L = 1; L <= MAX_LV; L++) C[lineType(id, L)].ab = L >= 2 ? merge(b, u) : b.slice(); }
  C.troll.ab = ['regen']; C.dragon.ab = ['breath', 'res:0.5']; C.golem.ab = ['mindless', 'res:0.5']; C.naga.ab = ['noRet'];
})();
// ---------- Dragon Lair exclusives: not recruitable in any castle, only at a lair someone has first conquered ----------
for (const id of Object.keys(C)) if (!C[id].cost && C[id].v) C[id].cost = { gold: Math.max(15, Math.round(C[id].v * 0.55)) };
// neutral dwellings found on the map (not part of any castle): creature -> weekly growth
const NEUTRAL_DW = { goblin: 12, wolf: 8, orc: 7, ogre: 4, golem: 5, troll: 3, naga: 2 };
const LAIR = ['faerie', 'rustd', 'crystald', 'azured'];
const LAIR_GROWTH = { faerie: 2, rustd: 2, crystald: 1, azured: 1 };
Object.assign(C, {
  faerie:   { n: 'Faerie Dragon',  i: '🐲', a: 18, d: 18, lo: 20, hi: 30, hp: 170, s: 15, fly: 1, v: 2500,  lair: 1, cost: { gold: 2200, gems: 2 },    ab: ['res:0.5'] },
  rustd:    { n: 'Rust Dragon',    i: '🐲', a: 21, d: 21, lo: 40, hi: 50, hp: 190, s: 10, fly: 1, v: 5200,  lair: 1, cost: { gold: 3400, sulfur: 2 },  ab: ['breath', 'res:0.5'] },
  crystald: { n: 'Crystal Dragon', i: '🐲', a: 22, d: 22, lo: 40, hi: 55, hp: 200, s: 11, fly: 1, v: 6200,  lair: 1, cost: { gold: 4000, crystal: 3 }, ab: ['res:0.75'] },
  azured:   { n: 'Azure Dragon',   i: '🐲', a: 27, d: 27, lo: 70, hi: 80, hp: 300, s: 12, fly: 1, v: 10500, lair: 1, cost: { gold: 8000, gems: 4 },    ab: ['breath', 'res:0.75'] },
});

const ABILITY_INFO = {
  dshot: 'shoots twice', dstrike: 'strikes twice', unlimRet: 'unlimited retaliation', noRet: 'no enemy retaliation', joust: 'jousting: +5% damage per hex moved',
  hate: 'hates a rival creature: double damage', drain: 'life drain', splash: 'splash damage to neighbours', cloud: 'death cloud on living neighbours',
  stun: 'may stun the target', allAdj: 'hits all adjacent enemies', pierce: 'ignores part of defense', breath: 'breath hits the unit behind',
  return: 'returns after attacking', regen: 'regenerates', res: 'spell resistance', fireImm: 'immune to fire', nopen: 'no melee penalty', mindless: 'mindless (no morale)',
};
function abilityText(t) {
  return (C[t].ab || []).map(a => {
    const [k, p] = a.split(':'); let s = ABILITY_INFO[k] || k;
    if (k === 'stun') s += ` ${p}%`; else if (k === 'res' || k === 'pierce') s += ` ${Math.round(parseFloat(p) * 100)}%`;
    return s;
  }).join(', ');
}

// BEGIN TUNED_V (generated by tools/apply_calibration.js)
const TUNED_V = {"castle1":[94,217],"castle2":[114,367],"castle3":[490,774],"castle4":[409,1401],"castle5":[566,1670],"castle6":[1635,3567],"castle7":[3567,9232],"rampart1":[94,204],"rampart2":[182,394],"rampart3":[327,721],"rampart4":[383,892],"rampart5":[701,1602],"rampart6":[1420,3270],"rampart7":[3567,6255],"tower1":[61,136],"tower2":[137,323],"tower3":[265,654],"tower4":[503,1401],"tower5":[409,1570],"tower6":[1670,3567],"tower7":[3040,6851],"inferno1":[48,111],"inferno2":[149,327],"inferno3":[258,654],"inferno4":[460,1090],"inferno5":[755,1721],"inferno6":[1401,2600],"inferno7":[2997,7474],"necropolis1":[74,165],"necropolis2":[136,285],"necropolis3":[204,467],"necropolis4":[394,1420],"necropolis5":[730,1582],"necropolis6":[1860,4316],"necropolis7":[2616,5605],"dungeon1":[65,142],"dungeon2":[133,312],"dungeon3":[276,566],"dungeon4":[414,899],"dungeon5":[866,1868],"dungeon6":[1272,2632],"dungeon7":[3139,8221],"stronghold1":[56,118],"stronghold2":[123,333],"stronghold3":[175,429],"stronghold4":[640,1401],"stronghold5":[791,1899],"stronghold6":[1383,3567],"stronghold7":[2997,7474],"fortress1":[82,169],"fortress2":[132,279],"fortress3":[208,433],"fortress4":[490,1101],"fortress5":[920,2055],"fortress6":[1115,2616],"fortress7":[4905,8261],"conflux1":[40,93],"conflux2":[315,749],"conflux3":[307,701],"conflux4":[336,766],"conflux5":[390,920],"conflux6":[1101,2452],"conflux7":[2651,6278]};
Object.keys(TUNED_V).forEach(id => { const [v1, v5] = TUNED_V[id]; for (let L = 1; L <= MAX_LV; L++) C[lineType(id, L)].v = Math.round(v1 * Math.pow(v5 / v1, (L - 1) / 4)); });
// END TUNED_V

// hero roster: id -> definition
const HEROES = {};
for (const f in FACTIONS) FACTIONS[f].heroes.forEach(([n, cls, ex = {}]) => {
  const b = CLASSES[cls];
  HEROES[n] = { id: n, name: n, cls, fac: f, ...b, att: b.att + (ex.att || 0), def: b.def + (ex.def || 0), sp: b.sp + (ex.sp || 0), kn: b.kn + (ex.kn || 0), sk: ex.sk || null, fem: !!ex.f };
});

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
// Fortifications strengthen walls/gate/towers in sieges; Minefields give defenders hidden mines.
const FORT_LEVELS = [
  { n: 'No fortifications', hp: 1, tower: 1 },
  { n: 'Citadel', hp: 1.5, tower: 1.25, cost: { gold: 1500, ore: 10 } },
  { n: 'Castle', hp: 2, tower: 1.5, cost: { gold: 3000, ore: 20, wood: 10 } },
  { n: 'Fortress', hp: 3, tower: 2, cost: { gold: 6000, ore: 30, crystal: 5 } },
];
const MINE_LEVELS = [
  { n: 'No minefield', stock: 0 },
  { n: 'Minefield I', stock: 3, cost: { gold: 1000, sulfur: 2 } },
  { n: 'Minefield II', stock: 5, cost: { gold: 2000, sulfur: 4 } },
  { n: 'Minefield III', stock: 7, cost: { gold: 3000, sulfur: 6, mercury: 3 } },
];
const FORT_MAX_FORT = 2, FORT_MAX_MINE = 1;   // map forts can reach Castle-level walls and one minefield
const FORT_WALL_COST = [null, { gold: 800, ore: 5 }, { gold: 1800, ore: 10, wood: 5 }];
const FORT_MINE_COST = [null, { gold: 600, sulfur: 1 }];
const EMERGENCY_MINES = 2;                      // a defending player may always lay a couple of mines
const FORT_INCOME = 400;
const MILITIA = 6;
const GUILD_COST = [null, { gold: 2000, wood: 5, ore: 5 }, { gold: 3000, mercury: 4, sulfur: 4 }, { gold: 4000, mercury: 6, sulfur: 6, crystal: 6, gems: 6 }];
const GUILD_SPELLS = [null, ['lightning', 'haste', 'slow', 'heal', 'bloodlust'], ['fireball', 'curse', 'blind', 'frostring', 'shield'], ['chain', 'meteor', 'implosion', 'resurrect', 'armageddon']];
const START_SPELLS = ['arrow', 'bless', 'stone'];

// school: air / earth / fire / water (its skill ranks the spell: Basic, Advanced, Expert); lv: spell level (needs Wisdom: level <= 2 + Wisdom rank)
const SCHOOL_SKILL = { air: 'airmagic', earth: 'earthmagic', fire: 'firemagic', water: 'watermagic' };
const SCHOOL_ICON = { air: '🌬️', earth: '⛰️', fire: '🔥', water: '💧' };
const SPELLS = {
  arrow:     { n: 'Magic Arrow',    i: '🏹', cost: 5,  lv: 1, school: 'air',   tgt: 'enemy', desc: 'Damage 10 x Spell Power + 10 (stronger with Air Magic)' },
  haste:     { n: 'Haste',          i: '💨', cost: 6,  lv: 1, school: 'air',   tgt: 'ally',  desc: '+3 Speed (+1 Advanced); Expert: all allies' },
  lightning: { n: 'Lightning Bolt', i: '⚡', cost: 10, lv: 2, school: 'air',   tgt: 'enemy', desc: 'Damage 25 x Spell Power' },
  shield:    { n: 'Air Shield',     i: '🌀', cost: 12, lv: 3, school: 'air',   tgt: 'ally',  desc: 'Ranged damage taken -30% / -45% / -60%; Expert: all allies' },
  chain:     { n: 'Chain Lightning', i: '🌩️', cost: 20, lv: 4, school: 'air',   tgt: 'enemy', desc: 'Hits 3 enemies (4 at Expert): 40 x SP, then half each jump' },
  stone:     { n: 'Stone Skin',     i: '🪨', cost: 5,  lv: 1, school: 'earth', tgt: 'ally',  desc: '+4 Defense (+6 Advanced, +8 Expert); Expert: all allies' },
  slow:      { n: 'Slow',           i: '🐌', cost: 6,  lv: 1, school: 'earth', tgt: 'enemy', desc: '-3 Speed (-4 / -5); Expert: all enemies' },
  curse:     { n: 'Curse',          i: '☠️', cost: 6,  lv: 2, school: 'earth', tgt: 'enemy', desc: 'Target always deals minimum damage; Expert: all enemies' },
  meteor:    { n: 'Meteor Shower',  i: '☄️', cost: 16, lv: 4, school: 'earth', tgt: 'enemy', desc: 'Area (radius 1, 2 at Expert): 14 x Spell Power + 20' },
  implosion: { n: 'Implosion',      i: '🕳️', cost: 30, lv: 5, school: 'earth', tgt: 'enemy', desc: 'Damage 75 x Spell Power' },
  bloodlust: { n: 'Bloodlust',      i: '😡', cost: 5,  lv: 1, school: 'fire',  tgt: 'ally',  desc: '+3 Attack (+5 / +7); Expert: all allies' },
  blind:     { n: 'Blind',          i: '🙈', cost: 8,  lv: 2, school: 'fire',  tgt: 'enemy', desc: 'Target loses 2 / 3 / 4 turns; Expert: all enemies' },
  fireball:  { n: 'Fireball',       i: '🔥', cost: 15, lv: 3, school: 'fire',  tgt: 'enemy', desc: 'Area (radius 1, 2 at Expert): 15 x Spell Power + 10' },
  armageddon: { n: 'Armageddon',    i: '🌋', cost: 24, lv: 5, school: 'fire',  tgt: 'enemy', desc: 'Burns EVERY stack on the field (yours too): 18 x Spell Power + 20' },
  bless:     { n: 'Bless',          i: '✨', cost: 5,  lv: 1, school: 'water', tgt: 'ally',  desc: 'Always max damage; Expert: all allies' },
  heal:      { n: 'Cure',           i: '💚', cost: 6,  lv: 1, school: 'water', tgt: 'ally',  desc: 'Restore 6 x Spell Power hit points (no revival); Expert: all allies' },
  frostring: { n: 'Frost Ring',     i: '❄️', cost: 12, lv: 3, school: 'water', tgt: 'enemy', desc: 'Area (radius 1): 10 x Spell Power + 15 and -2 Speed (Advanced+)' },
  resurrect: { n: 'Resurrection',   i: '🕊️', cost: 18, lv: 4, school: 'water', tgt: 'ally',  desc: 'Restore 40 x Spell Power hit points, reviving fallen creatures' },
};
const PORTAL_COST = 12;

// level-up perks (each can be taken up to MAX_PERK times)
const MAX_PERK = 3;
const PERKS = {
  offense:    { n: 'Offense',    i: '⚔️', d: '+10% melee damage per rank' },
  archery:    { n: 'Archery',    i: '🏹', d: '+10% ranged damage per rank' },
  armorer:    { n: 'Armorer',    i: '🛡️', d: '-7% damage taken per rank' },
  leadership: { n: 'Leadership', i: '🚩', d: '+1 Morale per rank (extra turns for your creatures)' },
  fortune:    { n: 'Fortune',    i: '🍀', d: '+1 Luck per rank (chance of double damage)' },
  logistics:  { n: 'Logistics',  i: '🥾', d: '+10% daily movement per rank' },
  wisdom:     { n: 'Wisdom',     i: '📚', d: '+15 maximum mana per rank' },
  sorcery:    { n: 'Sorcery',    i: '🔮', d: '+15% spell damage per rank' },
  estates:    { n: 'Estates',    i: '💰', d: '+300 gold per day per rank' },
  ballistics: { n: 'Ballistics', i: '🎯', d: '+50% siege damage (catapult and walls) per rank' },
  airmagic:   { n: 'Air Magic',   i: '🌬️', d: 'Air spells (Magic Arrow, Haste, Lightning, Air Shield, Chain Lightning) are stronger; Expert makes buffs mass' },
  earthmagic: { n: 'Earth Magic', i: '⛰️', d: 'Earth spells (Stone Skin, Slow, Curse, Meteor Shower, Implosion) are stronger; Expert makes them mass' },
  firemagic:  { n: 'Fire Magic',  i: '🔥', d: 'Fire spells (Bloodlust, Blind, Fireball, Armageddon) are stronger; Expert makes them mass / wider' },
  watermagic: { n: 'Water Magic', i: '💧', d: 'Water spells (Bless, Cure, Frost Ring, Resurrection) are stronger; Expert makes them mass' },
  necromancy: { n: 'Necromancy', i: '🦴', d: 'Raise skeletons after battle: 10 / 20 / 30% of the enemy hit points slain' },
  navigation: { n: 'Navigation', i: '⚓', d: 'Sailing costs 10 / 20 / 30% less movement' },
  scouting:   { n: 'Scouting',   i: '🔭', d: 'See 1 / 2 / 3 tiles farther through the fog of war' },
  mysticism:  { n: 'Mysticism',  i: '🌀', d: 'Regain 2 / 4 / 6 extra mana per day' },
  learning:   { n: 'Learning',   i: '🎓', d: '+10% / +20% / +30% experience' },
  forester:   { n: 'Forester',   i: '🌲', d: 'Walk through forests (cost 200 / 150 / 100 per tile)', minLvl: 4 },
  mountaineer: { n: 'Mountaineer', i: '🧗', d: 'Climb mountains (cost 300 / 250 / 200 per tile)', minLvl: 6 },
  waterwalk:  { n: 'Water Walk', i: '🌊', d: 'Walk on water without a boat (cost 160 / 130 / 100 per tile)', minLvl: 8 },
  charisma:   { n: 'Charisma',   i: '🤝', d: 'Much weaker neutral stacks may join you: 50% / 75% / 100% of them, at a lower strength advantage per rank' },
};

// ---------- hero skills: starting skills and level-up odds by class ----------
const RANK_NAMES = ['', 'Basic', 'Advanced', 'Expert'];
const MAX_SKILLS = 8;
const START_SKILLS = {
  Knight: ['leadership', 'armorer'], Cleric: ['wisdom', 'watermagic'], Ranger: ['archery', 'logistics'], Druid: ['wisdom', 'earthmagic'], Wizard: ['wisdom', 'airmagic'],
  Demoniac: ['offense', 'armorer'], Heretic: ['firemagic', 'sorcery'], 'Death Knight': ['necromancy', 'offense'], Necromancer: ['necromancy', 'earthmagic'],
  Overlord: ['offense', 'leadership'], Warlock: ['firemagic', 'wisdom'], Barbarian: ['offense', 'logistics'], 'Battle Mage': ['firemagic', 'leadership'],
  Beastmaster: ['armorer', 'charisma'], Witch: ['watermagic', 'mysticism'], Planeswalker: ['logistics', 'airmagic'], Elementalist: ['firemagic', 'mysticism'],
};
const SKILL_ARCH = {
  might: { airmagic: 1, earthmagic: 1, firemagic: 1, watermagic: 1, offense: 4, armorer: 4, leadership: 3, logistics: 3, ballistics: 3, estates: 2, archery: 2, fortune: 2, navigation: 2, scouting: 2, charisma: 1, forester: 1, mountaineer: 1, waterwalk: 1, learning: 1, mysticism: 1, wisdom: 1, sorcery: 1, necromancy: 1 },
  magic: { airmagic: 3, earthmagic: 3, firemagic: 3, watermagic: 3, wisdom: 4, sorcery: 4, mysticism: 4, learning: 3, fortune: 2, leadership: 2, estates: 2, scouting: 2, charisma: 2, navigation: 2, logistics: 2, offense: 1, armorer: 1, archery: 1, ballistics: 1, forester: 1, mountaineer: 1, waterwalk: 2, necromancy: 1 },
  ranger: { airmagic: 1, earthmagic: 1, firemagic: 1, watermagic: 1, archery: 4, logistics: 4, scouting: 4, forester: 3, mountaineer: 2, fortune: 3, offense: 2, armorer: 2, navigation: 2, waterwalk: 1, leadership: 1, wisdom: 1, sorcery: 1, mysticism: 1, learning: 1, estates: 1, charisma: 1, ballistics: 1, necromancy: 1 },
};
const CLASS_ARCH = { Knight: 'might', Barbarian: 'might', Overlord: 'might', Demoniac: 'might', 'Death Knight': 'might', Beastmaster: 'might', Ranger: 'ranger',
  Cleric: 'magic', Druid: 'magic', Wizard: 'magic', Heretic: 'magic', Necromancer: 'magic', Warlock: 'magic', Witch: 'magic', Planeswalker: 'magic', Elementalist: 'magic', Alchemist: 'magic', 'Battle Mage': 'magic' };
const NECRO_CLASSES = ['Necromancer', 'Death Knight', 'Warlock'];
function skillWeight(cls, id) { const w = SKILL_ARCH[CLASS_ARCH[cls] || 'might'][id] || 1; return id === 'necromancy' && NECRO_CLASSES.includes(cls) ? w + 4 : w; }

// ---------- artifacts: equipment with slots, tiers, set bonuses and special effects ----------
// stats: att def sp kn morale luck | move (% daily movement) mana (flat max mana) | sk (extra skill ranks)
const SLOT_NAMES = { head: '🪖 Head', neck: '📿 Neck', torso: '🦺 Armor', weapon: '🗡️ Weapon', shield: '🛡️ Shield', feet: '🥾 Feet', cape: '🧣 Cape', ring1: '💍 Ring', ring2: '💍 Ring' };
const SLOT_ORDER = ['head', 'neck', 'torso', 'weapon', 'shield', 'feet', 'cape', 'ring1', 'ring2'];
const ART = {
  centaur:   { n: "Centaur's Axe", i: '🪓', slot: 'weapon', tier: 1, att: 2 },
  blackshard: { n: 'Blackshard of the Dead Knight', i: '⚔️', slot: 'weapon', tier: 2, att: 3 },
  flail:     { n: "Greater Gnoll's Flail", i: '🔨', slot: 'weapon', tier: 2, att: 4 },
  club:      { n: "Ogre's Club of Havoc", i: '🏏', slot: 'weapon', tier: 3, att: 5 },
  hellfire:  { n: 'Sword of Hellfire', i: '🗡️', slot: 'weapon', tier: 3, att: 6 },
  gladius:   { n: "Titan's Gladius", i: '⚡', slot: 'weapon', tier: 4, att: 8, set: 'titan' },
  trident:   { n: 'Trident of the Deep', i: '🔱', slot: 'weapon', tier: 2, att: 3, sk: { navigation: 1 } },
  dwarven:   { n: 'Shield of the Dwarven Lords', i: '🛡️', slot: 'shield', tier: 1, def: 2 },
  scale:     { n: 'Dragon Scale Shield', i: '🐲', slot: 'shield', tier: 2, def: 3 },
  yawning:   { n: 'Shield of the Yawning Dead', i: '💀', slot: 'shield', tier: 2, def: 3, luck: 1 },
  buckler:   { n: 'Buckler of the Gnoll King', i: '🛡️', slot: 'shield', tier: 3, def: 4 },
  targ:      { n: 'Targ of the Rampaging Ogre', i: '🛡️', slot: 'shield', tier: 3, def: 5 },
  sentinel:  { n: "Sentinel's Shield", i: '🏰', slot: 'shield', tier: 4, def: 8, set: 'titan' },
  skull:     { n: 'Skull Helmet', i: '🪖', slot: 'head', tier: 1, kn: 1 },
  unicorn:   { n: 'Helm of the Alabaster Unicorn', i: '🦄', slot: 'head', tier: 2, luck: 1, kn: 1 },
  crown:     { n: 'Crown of the Supreme Magi', i: '👑', slot: 'head', tier: 3, kn: 3, sp: 1, set: 'magus' },
  halo:      { n: 'Helm of Heavenly Enlightenment', i: '😇', slot: 'head', tier: 4, att: 2, def: 2, sp: 2, kn: 2 },
  orb:       { n: 'Orb of Inhibition', i: '🔮', slot: 'neck', tier: 1, sp: 2, set: 'magus' },
  tome:      { n: 'Tome of Lore', i: '📖', slot: 'neck', tier: 2, kn: 3 },
  swiftness: { n: 'Necklace of Swiftness', i: '📿', slot: 'neck', tier: 2, move: 10 },
  courage:   { n: 'Pendant of Courage', i: '📿', slot: 'neck', tier: 3, morale: 1, luck: 1, set: 'magus' },
  compass:   { n: "Admiral's Compass", i: '🧭', slot: 'neck', tier: 2, kn: 2, sk: { navigation: 1 } },
  wood:      { n: 'Breastplate of Petrified Wood', i: '🌳', slot: 'torso', tier: 1, def: 2 },
  brimstone: { n: 'Breastplate of Brimstone', i: '🔥', slot: 'torso', tier: 3, def: 5, att: 1 },
  cuirass:   { n: "Titan's Cuirass", i: '🥋', slot: 'torso', tier: 4, def: 8, set: 'titan' },
  speed:     { n: 'Boots of Speed', i: '👢', slot: 'feet', tier: 2, move: 25 },
  levitation: { n: 'Boots of Levitation', i: '🥾', slot: 'feet', tier: 3, sk: { waterwalk: 1 }, set: 'wanderer' },
  saint:     { n: 'Sandals of the Saint', i: '🩴', slot: 'feet', tier: 4, move: 15, morale: 1, def: 2 },
  velocity:  { n: 'Cape of Velocity', i: '🧣', slot: 'cape', tier: 2, move: 15, set: 'wanderer' },
  undead:    { n: 'Cloak of the Undead King', i: '🦇', slot: 'cape', tier: 4, sk: { necromancy: 2 } },
  vitality:  { n: 'Ring of Vitality', i: '💍', slot: 'ring', tier: 1, kn: 1, mana: 5 },
  conjuring: { n: 'Ring of Conjuring', i: '💍', slot: 'ring', tier: 2, sp: 2 },
  wayfarer:  { n: 'Ring of the Wayfarer', i: '💍', slot: 'ring', tier: 2, move: 10, morale: 1, set: 'wanderer' },
  wizardry:  { n: "Ring of the Wizard's Might", i: '💍', slot: 'ring', tier: 3, mana: 15, sp: 1 },
};
for (const id in ART) ART[id].id = id;
const ART_SETS = {
  titan: { n: "Titan's Regalia", parts: ['gladius', 'cuirass', 'sentinel'], att: 6, def: 6 },
  magus: { n: 'Regalia of the Magi', parts: ['crown', 'orb', 'courage'], sp: 3, kn: 3, mana: 10 },
  wanderer: { n: "Wanderer's Kit", parts: ['levitation', 'velocity', 'wayfarer'], move: 30, morale: 1, luck: 1 },
};
const MAX_PACK = 12;
// random artifact id of at most the given tier (rng = () => [0,1))
function randomArt(rng, tierMax) {
  const pool = Object.keys(ART).filter(k => ART[k].tier <= tierMax && ART[k].tier >= Math.max(1, tierMax - 1));
  return pool[Math.floor(rng() * pool.length)];
}
// artifact tier by distance from the player's start (0..1), a little random
function artTierFor(depth, rng) { return Math.max(1, Math.min(4, 1 + Math.floor(depth * 3.4 + rng() * 1.2))); }


const T = { GRASS: 0, FOREST: 1, MOUNT: 2, WATER: 3, ROAD: 4, SAND: 5 };
// ground in the harsher climates slows walking: desert and snow ×1.5, ash/lava ×1.5, swamp ×2 (a road is always 50)
const BIOME_COST = [1, 1.5, 1.5, 2, 1.5], BIOME_NAME = ['', 'Desert', 'Snow', 'Swamp', 'Ash fields'];
const TCOST = { 0: 100, 4: 50, 5: 150 }; // grass 100, road 50 (half the movement), sand 150

function groupLabel(n) {
  if (n < 5) return 'Few'; if (n < 10) return 'Several'; if (n < 20) return 'A pack of';
  if (n < 50) return 'Lots of'; if (n < 100) return 'A horde of'; return 'A throng of';
}
function fmtCost(c) { return Object.keys(c).map(k => RES_ICON[k] + c[k]).join(' '); }
function canAfford(res, c) { return Object.keys(c).every(k => res[k] >= c[k]); }
function pay(res, c, mul = 1) { for (const k in c) res[k] -= c[k] * mul; }
function armyValue(arr) { return arr.reduce((s, a) => s + (a ? C[a.t].v * a.n : 0), 0); }

// ---------- scenarios: ready-made games with a fixed map, rivals and an objective ----------
// goal: conquer = eliminate every rival (default) · survive = still hold a town on day n · gold = hold n gold before day `days` · towns = own n towns before day `days`
const SCENARIOS = [
  { id: 'first', icon: '🌱', name: 'First Steps', blurb: 'A small, friendly valley and a single rival. The best place to learn the game.', diff: 'easy', goal: { type: 'conquer' }, map: { preset: 'plains', size: 'small', seed: 'first-steps', ais: 1, fog: false, biome: 'none' } },
  { id: 'gold', icon: '💰', name: 'Gold Rush', blurb: 'The crown wants a treasury, not a war. Hold 60,000 gold before day 70 — rivals will try to stop you.', diff: 'normal', goal: { type: 'gold', n: 60000, days: 70 }, bonus: { gold: 2000 }, map: { preset: 'plains', size: 'medium', seed: 'gold-rush', ais: 2, teams: ['enemy', 'enemy'], biome: 'mixed' } },
  { id: 'sand', icon: '🏜️', name: 'Sandstorm Crossing', blurb: 'A scorched steppe of dunes and dry wells. Two rival realms march together against you.', diff: 'normal', goal: { type: 'conquer' }, map: { preset: 'steppe', size: 'medium', seed: 'sandstorm', ais: 2, teams: ['bloc', 'bloc'], biome: 'desert' } },
  { id: 'frost', icon: '❄️', name: 'The Frozen Frontier', blurb: 'Snowbound passes and few towns. Claim four of them before day 55 — the cold is not your only enemy.', diff: 'normal', goal: { type: 'towns', n: 4, days: 55 }, map: { preset: 'highland', size: 'large', seed: 'frozen-frontier', ais: 2, biome: 'snow' } },
  { id: 'isles', icon: '🏝️', name: 'Island Kingdom', blurb: 'A sea of islands. One neighbour offers an alliance; the other wants your harbour. Build ships.', diff: 'normal', goal: { type: 'conquer' }, map: { preset: 'isles', size: 'large', seed: 'island-kingdom', ais: 2, teams: ['ally', 'enemy'], biome: 'mixed' } },
  { id: 'fever', icon: '🐸', name: 'Fever Swamp', blurb: 'Mist, mud and undead. Capture three towns before day 40 and escape the swamp.', diff: 'hard', goal: { type: 'towns', n: 3, days: 40 }, map: { preset: 'plains', size: 'medium', seed: 'fever-swamp', ais: 1, biome: 'swamp' } },
  { id: 'embers', icon: '🌋', name: 'Siege of Embers', blurb: 'Ash and lava. Three realms close in; simply outlast them — hold a town on day 45.', diff: 'hard', goal: { type: 'survive', days: 45 }, map: { preset: 'highland', size: 'medium', seed: 'embers', ais: 3, teams: ['bloc', 'bloc', 'bloc'], biome: 'lava' } },
  { id: 'warlords', icon: '👑', name: 'War of the Warlords', blurb: 'A huge realm, three rivals, every one for themselves. Only one crown will remain.', diff: 'expert', goal: { type: 'conquer' }, map: { preset: 'plains', size: 'huge', seed: 'warlords', ais: 3, biome: 'mixed' } },
];
