'use strict';
// Original names for every creature and hero. Internal ids (castle1, "Orrin" …) and the art files stay as they are;
// only the names shown to the player change. Loaded right after data.js.
(() => {
  // [base name, upgraded name] for the 7 tiers of each castle, in FD order
  const CREATURES = {
    castle: [['Levyman', 'Pikeward'], ['Longbowman', 'Deadeye'], ['Skyrender', 'Crowned Skyrender'], ['Sworn Blade', 'Oathblade'], ['Cantor', 'High Cantor'], ['Lancer', 'Warlance'], ['Dawnwing', 'Sunwing Herald']],
    rampart: [['Plainsrider', 'Plainsrider Warden'], ['Stonekin', 'Ironkin'], ['Glade Archer', 'Glade Warden'], ['Cloudmare', 'Moonmare'], ['Rootguard', 'Barkguard'], ['Whitehorn', 'Warhorn'], ['Emerald Wyrm', 'Aurum Wyrm']],
    tower: [['Tinker Imp', 'Master Tinker'], ['Stonewing', 'Glasswing'], ['Granite Automaton', 'Iron Automaton'], ['Adept', 'Magister'], ['Lampbound', 'Lampmaster'], ['Coilmaiden', 'Coilqueen'], ['Cloudgiant', 'Skytitan']],
    inferno: [['Cinder Imp', 'Ember Imp'], ['Flamecaster', 'Pyromancer'], ['Ashhound', 'Threefang'], ['Fiend', 'Horned Fiend'], ['Abyss Warden', 'Abyss Overlord'], ['Scorch Djinn', 'Flame Sultan'], ['Infernal', 'Infernal Tyrant']],
    necropolis: [['Bonewalker', 'Bonesworn'], ['Shambler', 'Rotten Shambler'], ['Lurking Shade', 'Dread Shade'], ['Bloodthrall', 'Bloodlord'], ['Grave Mage', 'Gravelord'], ['Blackguard', 'Deathguard'], ['Skeletal Wyrm', 'Spectral Wyrm']],
    dungeon: [['Cave Dweller', 'Deep Dweller'], ['Screecher', 'Shrieking Hag'], ['Gazer', 'Dread Gazer'], ['Serpent Maiden', 'Serpent Queen'], ['Maze Brute', 'Maze Lord'], ['Stingbeast', 'Dire Stingbeast'], ['Crimson Wyrm', 'Night Wyrm']],
    stronghold: [['Skulker', 'Cutthroat'], ['Fangrider', 'Fang Raider'], ['Blackhide', 'Blackhide Chief'], ['Brute', 'Brute Shaman'], ['Great Condor', 'Storm Condor'], ['Rockhurler', 'Rockhurler King'], ['Doomhorn', 'Ancient Doomhorn']],
    fortress: [['Hyenakin', 'Hyena Raider'], ['Scaleman', 'Scale Warrior'], ['Stinger Fly', 'Spitfire Fly'], ['Stonemaw', 'Greater Stonemaw'], ['Bronze Bull', 'Mighty Bronze Bull'], ['Fangwing', 'Fangwing Monarch'], ['Manyjaw', 'Chaos Manyjaw']],
    conflux: [['Mote', 'Wisp'], ['Gale Spirit', 'Storm Spirit'], ['Tide Spirit', 'Frost Spirit'], ['Flame Spirit', 'Spark Spirit'], ['Stone Spirit', 'Magma Spirit'], ['Mind Spirit', 'Arcane Spirit'], ['Sunfeather', 'Sunfeather Reborn']],
  };
  const NEUTRAL = { goblin: 'Skulker', wolf: 'Fangrider', orc: 'Blackhide', ogre: 'Brute', troll: 'Rockjaw', golem: 'Granite Automaton', naga: 'Coilmaiden', dragon: 'Emerald Wyrm', shark: 'Razorfin', kraken: 'Maelstrom Beast', faerie: 'Glimmerdrake', rustd: 'Corrosion Wyrm', crystald: 'Prism Wyrm', azured: 'Sapphire Wyrm' };
  const HERO = {
    // castle
    'Orrin': 'Aldren', 'Valeska': 'Maribel', 'Edric': 'Corwin', 'Sylvia': 'Elowen', 'Lord Haart': 'Lord Brannoch', 'Sorsha': 'Theodora', 'Christian': 'Gareth', 'Tyris': 'Rowena',
    'Rion': 'Anselm', 'Adela': 'Imogen', 'Cuthbert': 'Osric', 'Adelaide': 'Lucinda', 'Ingham': 'Benedek', 'Sanya': 'Seraphine', 'Loynis': 'Leofric', 'Caitlin': 'Cecily',
    // rampart
    'Mephala': 'Sylwen', 'Ufretin': 'Faelan', 'Jenova': 'Linnea', 'Ryland': 'Ryven', 'Thorgrim': 'Durgan', 'Ivor': 'Eskil', 'Clancy': 'Tarran', 'Kyrre': 'Orvald',
    'Coronius': 'Oberic', 'Uland': 'Quillon', 'Elleshar': 'Veyran', 'Gem': 'Rowan', 'Malcom': 'Bramwell', 'Melodia': 'Willowen', 'Alagar': 'Thistlan', 'Aeris': 'Fenna',
    // tower
    'Piquedram': 'Quixley', 'Thane': 'Corvane', 'Josephine': 'Marisol', 'Neela': 'Zafira', 'Torosar': 'Hesperin', 'Fafner': 'Gaspar', 'Rissa': 'Tessaly', 'Iona': 'Ophelia',
    'Astral': 'Meridian', 'Halon': 'Eldrin', 'Serena': 'Vespera', 'Daremyth': 'Aurelian', 'Theodorus': 'Magnus Vael', 'Solmyr': 'Ismael Crane', 'Cyra': 'Cerelia', 'Aine': 'Lorcan',
    // inferno
    'Fiona': 'Kazira', 'Rashka': 'Vexara', 'Marius': 'Malgrim', 'Ignatius': 'Pyrrhus', 'Octavia': 'Morvyn', 'Calh': 'Skarn', 'Pyre': 'Brandir', 'Nymus': 'Zalgoth',
    'Ayden': 'Mordrake', 'Xyron': 'Xanthos', 'Axsis': 'Draxen', 'Olema': 'Lilithra', 'Calid': 'Emberlyn', 'Ash': 'Cindrel', 'Zydar': 'Zorvath', 'Xarfax': 'Kraxus',
    // necropolis
    'Straker': 'Grimwald', 'Vokial': 'Valdrek', 'Moandor': 'Morgrath', 'Charna': 'Nyxara', 'Tamika': 'Tamsyn', 'Isra': 'Ishara', 'Clavius': 'Corvus', 'Galthran': 'Gorrim',
    'Septienna': 'Sibylla', 'Aislinn': 'Ashenne', 'Sandro': 'Sarkon', 'Nimbus': 'Nocturn', 'Thant': 'Tholl', 'Xsi': 'Xerith', 'Vidomina': 'Vedana', 'Nagash': 'Nekhros',
    // dungeon
    'Lorelei': 'Lyssandra', 'Arlach': 'Arkhon', 'Dace': 'Dravik', 'Ajit': 'Azhar', 'Damacon': 'Dorgan', 'Gunnar': 'Gulvar', 'Synca': 'Zyrena', 'Shakti': 'Shaluna',
    'Alamar': 'Ilvar', 'Jaegar': 'Jarrek', 'Malekith': 'Malachar', 'Jeddite': 'Jedrik', 'Geon': 'Gethen', 'Deemer': 'Dymas', 'Sephinroth': 'Sephrion', 'Darkstorm': 'Stormraven',
    // stronghold
    'Yog': 'Grubnar', 'Gurnisson': 'Gurdok', 'Jabarkas': 'Rahzgul', 'Shiva': 'Brakka', 'Gretchin': 'Grethka', 'Krellion': 'Krellok', 'Crag Hack': 'Thrag', 'Tyraxor': 'Tyrokk',
    'Gird': 'Gorrik', 'Vey': 'Vorn', 'Dessa': 'Dazhka', 'Terek': 'Torvak', 'Zubin': 'Zuglar', 'Gundula': 'Gunhild', 'Oris': 'Orvash', 'Saurug': 'Sarghul',
    // fortress
    'Bron': 'Borgan', 'Drakon': 'Draykos', 'Wystan': 'Wynne', 'Tazar': 'Tazrin', 'Alkin': 'Alvar', 'Korbac': 'Korvan', 'Gerwulf': 'Gerrald', 'Broghild': 'Brynja',
    'Mirlanda': 'Mirelda', 'Rosic': 'Rosenna', 'Voy': 'Vaylor', 'Verdish': 'Verdan', 'Merist': 'Merrick', 'Styg': 'Sedge', 'Andra': 'Andraste', 'Tiva': 'Tivola',
    // conflux
    'Pasis': 'Paxis', 'Thunar': 'Thalos', 'Ignissa': 'Ignessa', 'Lacus': 'Lacuna', 'Monere': 'Monelle', 'Erdamon': 'Erdane', 'Fiur': 'Fyrian', 'Kalt': 'Kaldur',
    'Luna': 'Lunara', 'Brissa': 'Brisanne', 'Ciele': 'Cielara', 'Labetha': 'Lavena', 'Inteus': 'Intharo', 'Aenain': 'Aenor', 'Gelare': 'Gelaine', 'Grindan': 'Grindar',
  };
  const BLURB = {
    castle: 'Brave knights, archers and shining winged guardians.', rampart: 'Elves, horned horses and great green dragons of the forest.', tower: 'Wizards, stone giants and clever magic creatures.',
    inferno: 'Fire demons and devils from the burning pit.', necropolis: 'Skeletons, ghosts and bone dragons that never rest.', dungeon: 'Cave monsters, snake women and night dragons.',
    stronghold: 'Big strong brutes, wolf riders and the giant beast.', fortress: 'Swamp lizards, giant bugs and many-headed monsters.', conflux: 'Spirits of air, water, fire and earth, and the fire bird.',
  };
  for (const f in CREATURES) CREATURES[f].forEach(([base, up], i) => {
    const id = f + (i + 1); if (!C[id]) return;
    C[id].n = base; for (let L = 2; L <= MAX_LV; L++) { const o = C[lineType(id, L)]; if (o) o.n = RANK_PREFIX[L - 1] + up; }
  });
  for (const k in NEUTRAL) if (C[k]) C[k].n = NEUTRAL[k];
  for (const k in HERO) if (HEROES[k]) HEROES[k].name = HERO[k];
  for (const f in BLURB) if (FACTIONS[f]) FACTIONS[f].blurb = BLURB[f];

  // ---- spells, skills, artifacts, castles, classes, halls ----
  const SPELL = { arrow: 'Arcane Bolt', haste: 'Quickening', lightning: 'Sky Spear', shield: 'Wind Ward', chain: 'Stormchain', stone: 'Granite Skin', slow: 'Mire', curse: 'Hex', meteor: 'Falling Stars', implosion: 'Collapse', bloodlust: 'Battle Frenzy', blind: 'Dazzle', fireball: 'Flame Orb', armageddon: 'Cataclysm', bless: 'Benediction', heal: 'Mending', frostring: 'Rime Circle', resurrect: 'Recall of Life' };
  const SKILL = { offense: 'Assault', archery: 'Marksmanship', armorer: 'Bulwark', leadership: 'Command', fortune: 'Providence', logistics: 'Forced March', wisdom: 'Insight', sorcery: 'Spellcraft', estates: 'Stewardship', ballistics: 'Siegecraft', airmagic: 'Sky Lore', earthmagic: 'Stone Lore', firemagic: 'Flame Lore', watermagic: 'Tide Lore', necromancy: 'Grave Craft', navigation: 'Seafaring', scouting: 'Far-Sight', mysticism: 'Mana Flow', learning: 'Scholarship', forester: 'Woodcraft', mountaineer: 'Cragwalking', waterwalk: 'Wave Treading', charisma: 'Silver Tongue' };
  const ARTI = { centaur: "Plainsrider's Axe", blackshard: 'Blackshard of the Fallen Knight', flail: "Marauder's Flail", club: "Brute's Club of Havoc", hellfire: 'Blade of Cinders', gladius: "Giant's Gladius", trident: 'Tide Trident', dwarven: 'Shield of the Stone Lords', scale: 'Wyrmscale Shield', yawning: 'Shield of the Restless Dead', buckler: 'Buckler of the Hyena King', targ: 'Targe of the Rampaging Brute', sentinel: "Watchman's Shield", skull: 'Bonecrown Helm', unicorn: 'Helm of the Alabaster Whitehorn', crown: 'Diadem of the High Arcanists', halo: 'Helm of Radiant Insight', orb: 'Orb of Silence', tome: 'Codex of Lore', swiftness: 'Amulet of Fleetness', courage: 'Medal of Valor', compass: "Navigator's Compass", wood: 'Cuirass of Petrified Oak', brimstone: 'Brimstone Mail', cuirass: "Giant's Cuirass", speed: 'Swiftstride Boots', levitation: 'Cloudstep Boots', saint: "Pilgrim's Sandals", velocity: 'Cape of Rushing Wind', undead: 'Shroud of the Bone King', vitality: 'Ring of Vigor', conjuring: 'Ring of Summoning', wayfarer: 'Ring of the Roamer', wizardry: 'Ring of Arcane Might' };
  const FAC = { castle: ['Kingdom', 'Sunrise Keep', 'Lion Fort'], rampart: ['Forest', 'Greenwood', 'Thorn Keep'], tower: ['Wizards', 'Star Tower', 'Crystal Spire'], inferno: ['Hell', 'Fire Pit', 'Black Gate'], necropolis: ['Undead', 'Grave Hill', 'Bone Tower'], dungeon: ['Caves', 'Deep Cave', 'Dark Hold'], stronghold: ['Wild Clans', 'Iron Camp', 'Skull Camp'], fortress: ['Swamp', 'Bog Fort', 'Mud Fort'], conflux: ['Spirits', 'Storm Peak', 'Wind Temple'] };
  const CLS = { Knight: 'Banneret', Cleric: 'Votary', Ranger: 'Wayward', Druid: 'Grovekeeper', Alchemist: 'Transmuter', Wizard: 'Arcanist', Demoniac: 'Hellbound', Heretic: 'Pyremage', 'Death Knight': 'Gravewarden', Necromancer: 'Bonecaller', Overlord: 'Tyrant', Warlock: 'Hexer', Barbarian: 'Marauder', 'Battle Mage': 'Warcaster', Beastmaster: 'Packlord', Witch: 'Hedgewitch', Planeswalker: 'Wayfarer', Elementalist: 'Spiritcaller' };
  for (const k in SPELL) if (SPELLS[k]) SPELLS[k].n = SPELL[k];
  for (const k in SKILL) if (PERKS[k]) PERKS[k].n = SKILL[k];
  for (const k in ARTI) if (ART[k]) ART[k].n = ARTI[k];
  for (const f in FAC) if (FACTIONS[f]) { FACTIONS[f].name = FAC[f][0]; FACTIONS[f].town = FAC[f][1]; FACTIONS[f].enemyTown = FAC[f][2]; }
  ['Moot Hall', 'Guildhall', 'Civic Hall', 'Royal Court', 'Imperial Court'].forEach((x, i) => { HALL_LEVELS[i + 1].n = x; });
  ['No fortifications', 'Palisade', 'Keep', 'Bastion'].forEach((x, i) => { FORT_LEVELS[i].n = x; });
  window.clsLabel = (c) => CLS[c] || c;
})();
