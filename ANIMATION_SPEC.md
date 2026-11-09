# Animation production sheet

What the game needs from you to animate every creature and hero. Creature animations already work in battle the moment the files are in `art/anim/` (run `npm run art` after adding files); creatures without frames keep their still picture with a different code-made motion for each. Hero frames need a small code change that I make when the first samples arrive.

## 1. Creatures — 77 creatures (63 also have an upgraded form)

Four animations per creature, as numbered frames:

| Animation | Frames | What it shows | File names |
|---|---|---|---|
| Idle | 6 (loops) | breathing, shifting weight, wings beating for flyers | `anim/<id>/idle_1.webp` … `idle_6.webp` |
| Attack | 5 | wind-up, strike (the hit lands on frame 3), follow-through. Shooters: draw and release; the arrow, bolt or spell itself is drawn by the game | `anim/<id>/attack_1.webp` … `attack_5.webp` |
| Defend | 3 | flinch or guard when hit | `anim/<id>/defend_1.webp` … `defend_3.webp` |
| Death | 4 | falling or collapsing; the last frame fades out | `anim/<id>/death_1.webp` … `death_4.webp` |

That is 18 images per creature, **1386** for all 77. Minimum that still looks good: idle 4, attack 4, defend 2, death 3 (13 per creature, 1001 in all).

Rules for every frame:

- Transparent background, figure **facing right**. The game mirrors it for the enemy side.
- **All frames of one creature have the same canvas size** (any size; 512 px tall is plenty, the creature is shown about 66 px tall, doubled on sharp screens).
- Feet on the **same spot in every frame**. Frame 1 of idle is the reference pose: the game anchors every other frame to the bottom centre of that figure, and scales them all alike, so the creature never jumps or resizes.
- Leave room on the right for lunges and on top for rearing; do not crop tight to one frame.
- **No ground, no shadow, no weapon trail effects**: shadows, sparks and slash/shot effects are drawn by the game.
- Idle must loop (frame 6 flows back into frame 1).
- Upgraded forms: name the folder `<id>_2` (for example `castle2_2`) only when it looks different; otherwise the base creature id is used for both.

Suggested order: **idle** for everything first (the most visible, 462 images), then attack (385), defend (231), death (308).

| Creature id | Name | Notes |
|---|---|---|
| `goblin` | Goblin |  |
| `wolf` | Wolf Rider |  |
| `orc` | Orc | shooter |
| `ogre` | Ogre |  |
| `troll` | Troll |  |
| `golem` | Stone Golem | large |
| `naga` | Naga |  |
| `dragon` | Green Dragon | flies, large |
| `shark` | Shark | large |
| `kraken` | Kraken | large |
| `castle1` | Pikeman |  |
| `castle2` | Archer | shooter |
| `castle3` | Griffin | flies |
| `castle4` | Swordsman |  |
| `castle5` | Monk | shooter |
| `castle6` | Cavalier |  |
| `castle7` | Angel | flies |
| `rampart1` | Centaur |  |
| `rampart2` | Dwarf |  |
| `rampart3` | Wood Elf | shooter |
| `rampart4` | Pegasus | flies |
| `rampart5` | Dendroid Guard |  |
| `rampart6` | Unicorn |  |
| `rampart7` | Green Dragon | flies, large |
| `tower1` | Gremlin | shooter |
| `tower2` | Stone Gargoyle | flies |
| `tower3` | Stone Golem | large |
| `tower4` | Mage | shooter |
| `tower5` | Genie | flies |
| `tower6` | Naga |  |
| `tower7` | Giant | large |
| `inferno1` | Imp |  |
| `inferno2` | Gog | shooter |
| `inferno3` | Hell Hound |  |
| `inferno4` | Demon |  |
| `inferno5` | Pit Fiend |  |
| `inferno6` | Efreet | flies |
| `inferno7` | Devil | flies |
| `necropolis1` | Skeleton |  |
| `necropolis2` | Walking Dead |  |
| `necropolis3` | Wight |  |
| `necropolis4` | Vampire | flies |
| `necropolis5` | Lich | shooter |
| `necropolis6` | Black Knight |  |
| `necropolis7` | Bone Dragon | flies, large |
| `dungeon1` | Troglodyte |  |
| `dungeon2` | Harpy | flies |
| `dungeon3` | Beholder | shooter |
| `dungeon4` | Medusa | shooter |
| `dungeon5` | Minotaur |  |
| `dungeon6` | Manticore | flies |
| `dungeon7` | Red Dragon | flies, large |
| `stronghold1` | Goblin |  |
| `stronghold2` | Wolf Rider |  |
| `stronghold3` | Orc | shooter |
| `stronghold4` | Ogre |  |
| `stronghold5` | Roc | flies, large |
| `stronghold6` | Cyclops | shooter |
| `stronghold7` | Behemoth | large |
| `fortress1` | Gnoll |  |
| `fortress2` | Lizardman | shooter |
| `fortress3` | Serpent Fly | flies |
| `fortress4` | Basilisk |  |
| `fortress5` | Gorgon |  |
| `fortress6` | Wyvern | flies |
| `fortress7` | Hydra | large |
| `conflux1` | Pixie | flies |
| `conflux2` | Air Elemental |  |
| `conflux3` | Water Elemental |  |
| `conflux4` | Fire Elemental |  |
| `conflux5` | Earth Elemental |  |
| `conflux6` | Psychic Elemental |  |
| `conflux7` | Firebird | flies, large |
| `faerie` | Faerie Dragon | flies, large |
| `rustd` | Rust Dragon | flies, large |
| `crystald` | Crystal Dragon | flies, large |
| `azured` | Azure Dragon | flies, large |

## 2. Heroes — 144 heroes in 18 classes (8 heroes each)

Today a hero is one still painting per direction (`mounted/<name>_<north|east|south|west>.webp`); the game adds a small breath and a glow when casting. Two sets of animation would improve it:

### A. Walking on the map (the hero is on screen all game, so this matters most)

- `mounted/<name>_<dir>_walk_1.webp` … `_walk_4.webp` for `north`, `east`, `south`, `west`: **16 images per hero**. Same canvas size and feet position as the existing still of that hero. Frame 1 should match the still, so a standing hero is unchanged.
- All 144 heroes: **2304** images. If that is too much, do the player-choosable heroes first, or give one walk cycle per class and tell me which heroes share it.

### B. Fighting in battle (beside the field)

| Animation | Frames | What it shows | File names |
|---|---|---|---|
| Idle | 4 (loops) | breathing, banner moving, horse shifting | `anim/hero/<name>/idle_1.webp` … `idle_4.webp` |
| Cast | 5 | raising a hand or staff and releasing a spell | `cast_1.webp` … `cast_5.webp` |
| Strike | 5 | the Hero Strike: rearing and swinging | `strike_1.webp` … `strike_5.webp` |
| Hit | 3 | flinching when the enemy hero is hit | `hit_1.webp` … `hit_3.webp` |

Facing right (the enemy hero is mirrored); same rules as creatures. 16 per hero. Options: all heroes (2304 images), or **one set per class** (288 images) used by all 8 heroes of that class while each keeps his own portrait and map figure; I recommend per class for battle.

### Classes and heroes

| Class | Heroes |
|---|---|
| Knight | Orrin, Valeska, Edric, Sylvia, Lord Haart, Sorsha, Christian, Tyris |
| Cleric | Rion, Adela, Cuthbert, Adelaide, Ingham, Sanya, Loynis, Caitlin |
| Ranger | Mephala, Ufretin, Jenova, Ryland, Thorgrim, Ivor, Clancy, Kyrre |
| Druid | Coronius, Uland, Elleshar, Gem, Malcom, Melodia, Alagar, Aeris |
| Alchemist | Piquedram, Thane, Josephine, Neela, Torosar, Fafner, Rissa, Iona |
| Wizard | Astral, Halon, Serena, Daremyth, Theodorus, Solmyr, Cyra, Aine |
| Demoniac | Fiona, Rashka, Marius, Ignatius, Octavia, Calh, Pyre, Nymus |
| Heretic | Ayden, Xyron, Axsis, Olema, Calid, Ash, Zydar, Xarfax |
| Death Knight | Straker, Vokial, Moandor, Charna, Tamika, Isra, Clavius, Galthran |
| Necromancer | Septienna, Aislinn, Sandro, Nimbus, Thant, Xsi, Vidomina, Nagash |
| Overlord | Lorelei, Arlach, Dace, Ajit, Damacon, Gunnar, Synca, Shakti |
| Warlock | Alamar, Jaegar, Malekith, Jeddite, Geon, Deemer, Sephinroth, Darkstorm |
| Barbarian | Yog, Gurnisson, Jabarkas, Shiva, Gretchin, Krellion, Crag Hack, Tyraxor |
| Battle Mage | Gird, Vey, Dessa, Terek, Zubin, Gundula, Oris, Saurug |
| Beastmaster | Bron, Drakon, Wystan, Tazar, Alkin, Korbac, Gerwulf, Broghild |
| Witch | Mirlanda, Rosic, Voy, Verdish, Merist, Styg, Andra, Tiva |
| Planeswalker | Pasis, Thunar, Ignissa, Lacus, Monere, Erdamon, Fiur, Kalt |
| Elementalist | Luna, Brissa, Ciele, Labetha, Inteus, Aenain, Gelare, Grindan |
