# Creature dwellings — the full list (9 towns × 7 tiers × 2 levels = 126 buildings)

Goal: the creatures are no longer a picture standing next to a house. Each dwelling is a **building that belongs to that creature's way of life**, and the creature (or a few of them, small) is **part of the scene** — at the door, on the roof, in the yard, on the walls. The upgraded building (level 2) is the same building grown: bigger, richer, more banners/decoration, and the upgraded creature visible.

Technical (same as the current files, `art/buildings/`):
- 256×288 PNG, transparent background, isometric view from the front-left, light from the top-left
- the building stands on ONE oval grass/stone base; the oval touches the left and right edges of the picture (that oval is what the town pad is matched to)
- file names: `<town><tier>.png` for the base building and `<town><tier>_2.png` for the upgrade (e.g. `castle1.png`, `castle1_2.png`)
- the same building must be recognisable in base and upgraded form (same footprint and position of the door)

Format of each line: **Tier — Building (suggested name)** · creature → upgraded creature · what the scene shows

---

## 1. Kingdom (castle) — knights, stone, blue and gold
1. Guard Tower — Spearman → Shield Spearman · palisade tower, spears racked at the door, a guard on the platform
2. Archery Range — Archer → Sharp Archer · open timber range with straw targets, archers on the balcony
3. Griffon Roost — Winged Lion → Royal Winged Lion · stone aerie on a pillar, lion perched on the rim, nest and feathers
4. Barracks — Swordsman → Holy Swordsman · armoured barracks hall, training dummies, swordsmen drilling in the yard
5. Chapel — Priest → High Priest · small chapel with bell tower, priest at the steps with a staff and light
6. Cavalry Stables — Horse Knight → Royal Horse Knight · stables with a jousting yard, knight and horse at the gate
7. Angel Sanctuary — Sun Angel → Great Sun Angel · white marble shrine with a golden dome, angel hovering over the roof

## 2. Forest (rampart) — elves, trees, waterfalls
1. Rider Camp — Plains Rider → Plains Captain · tents and a wooden lodge, rider on horse at the fence
2. Dwarf Cottage — Stone Dwarf → Iron Dwarf · stone-and-turf cottage built into a rock, anvil, dwarf at the door
3. Elf Treehouse — Forest Elf → Great Elf · treehouse with rope bridge, elf archer on the platform
4. Pegasus Meadow — Winged Horse → Silver Winged Horse · open pavilion in a meadow, winged horse grazing, hay and feathers
5. Ent Grove — Tree Guard → Tree Soldier · a hollow giant tree with a door, a treant standing as part of the grove
6. Unicorn Glade — White Unicorn → War Unicorn · glade with a stone arch and moon pool, unicorn drinking
7. Dragon Cave — Green Dragon → Gold Dragon · mossy cliff cave with a hoard, dragon coiled on top

## 3. Wizards (tower) — marble, crystal, arcane
1. Tinker Workshop — Tinker → Master Tinker · cogwheels and pipes, gnome with a crossbow gadget on a gantry
2. Gargoyle Perch — Stone Bat → Black Stone Bat · gothic spire with perches, stone bats on the cornices
3. Golem Forge — Stone Golem → Iron Golem · forge hall with an open giant door, golem emerging, sparks
4. Mage Tower — Mage → Great Mage · slim tower with a glowing crystal and a balcony, mage casting
5. Lamp Pavilion — Lamp Spirit → Lamp Master · domed pavilion with hanging lamps, a spirit rising from a lamp
6. Serpent Temple — Snake Woman → Snake Queen · pillared temple with a snake-carved entrance, serpent woman coiled on the steps
7. Giant Hall — Giant → Storm Giant · tall hall with oversized door and stairs, giant seated on the steps (storm clouds for the upgrade)

## 4. Hell (inferno) — lava, iron, fire
1. Imp Pit — Imp → Fire Imp · rocky hole with a small iron gate, imps peeking out and on spikes
2. Fire Range — Fire Thrower → Fire Master · iron platform with brazier and flame jets, thrower at the rail
3. Hound Kennel — Hell Hound → Big Hell Hound · spiked kennel with chains, hound on the roof growling
4. Demon Gate — Demon → Horned Demon · gate of horned arches, demon guarding the door
5. Pit — Pit Demon → Pit Lord · a wide lava pit with a staircase down, pit demon climbing out
6. Djinn Brazier — Fire Djinn → Fire Sultan · flaming brazier tower with a carpet, djinn rising out of the fire
7. Devil's Throne — Devil → Arch Devil · black iron throne hall with banners, devil hovering above

## 5. Undead (necropolis) — bone, mist, green light
1. Bone Crypt — Skeleton → Skeleton Warrior · crypt of stacked bone, skeletons standing guard at the door
2. Graveyard — Zombie → Rotten Zombie · fenced graveyard with a leaning mausoleum, zombies rising from graves
3. Haunted Chapel — Ghost → Dark Ghost · ruined chapel in fog, ghost floating through the window
4. Vampire Manor — Vampire → Vampire Lord · gothic manor with bat tower, vampire on the balcony
5. Skull Tower — Skull Mage → Great Skull Mage · tower crowned with a skull, mage casting green fire
6. Black Fortress — Black Knight → Death Knight · dark keep with spikes, knight on a skeletal horse at the gate
7. Dragon Bones — Bone Dragon → Ghost Dragon · a giant ribcage of a dragon forming the building, the dragon draped over it

## 6. Caves (dungeon) — stone, crystal, glowing fungus
1. Cave Hut — Cave Man → Cave Chief · stone-and-hide huts in a cave mouth, campfire, caveman with a club
2. Harpy Cliff — Harpy → Old Harpy · cliff ledges with nests, harpies perched
3. Eye Spire — Floating Eye → Evil Eye · stalagmite spire with a giant eye emblem, eye floating by it
4. Medusa Shrine — Stone Witch → Stone Queen · temple with stone statues around, the witch on the steps
5. Labyrinth — Bull Man → Bull King · maze entrance with horned gates, bull man at the gate
6. Manticore Den — Scorpion Lion → Big Scorpion Lion · rocky den with bones, creature curled on top
7. Dragon Lair — Red Dragon → Black Dragon · crystal cavern with glowing hoard, dragon over the entrance

## 7. Wild Clans (stronghold) — hide, bone, red dust
1. Goblin Hut — Goblin → Big Goblin · scrap-wood shack with pennants, goblins around a fire
2. Wolf Pen — Wolf Rider → Wolf Raider · fenced pen with hides, riders and wolves in the yard
3. Orc Tower — Orc → Orc Chief · wooden watchtower with a platform, orc archer on top
4. Ogre Fort — Ogre → Ogre Mage · tusked-gate fort with a huge door, ogre sitting at the gate
5. Thunderbird Nest — Giant Bird → Thunder Bird · totem pole and a huge nest, bird spreading its wings (lightning for the upgrade)
6. Cyclops Cave — One-Eye Giant → One-Eye King · cave entrance with a boulder wall, giant leaning against it
7. Beast Den — Giant Beast → Ancient Beast · bone-gate den with banners, the beast lying across the entrance

## 8. Swamp (fortress) — mud, moss, lanterns
1. Hyena Camp — Hyena Man → Hyena Raider · stilt huts with spears, hyena men by the fire
2. Lizard Hut — Lizard Man → Lizard Warrior · reed hut by the water, lizard man with a blowpipe
3. Fly Nest — Giant Fly → Dragon Fly · hanging hive on a dead tree, flies buzzing around
4. Lizard Rock — Stone Lizard → Great Stone Lizard · mossy stone cairn, stone lizard sunning itself
5. Bull Pen — Iron Bull → Mighty Iron Bull · wooden stockade with iron-plated gate, bull rearing
6. Sting Roost — Sting Dragon → Sting Dragon King · dead-tree tower hung with cocoons, sting dragon above
7. Hydra Pool — Swamp Hydra → Chaos Hydra · broken stone ring in a swamp pool, hydra heads rising

## 9. Spirits (conflux) — storm, floating stone, elemental light
1. Sprite Garden — Light Sprite → Bright Sprite · glowing flower garden with a small arch, sprites floating
2. Air Shrine — Air Spirit → Storm Spirit · floating platform in clouds, whirlwind spirit
3. Water Shrine — Water Spirit → Ice Spirit · stone fountain with a waterspout, water spirit rising (ice crystals for the upgrade)
4. Fire Shrine — Fire Spirit → Energy Spirit · basalt altar with flame, fire spirit
5. Earth Shrine — Earth Spirit → Lava Spirit · rock pillar ring, earth spirit rising (lava veins for the upgrade)
6. Mind Shrine — Mind Spirit → Magic Spirit · crystal obelisk with floating runes, mind spirit hovering
7. Phoenix Pyre — Fire Bird → Phoenix · a great stone pyre in a bowl, the bird spreading its wings in the flames

---

## Also worth redoing in the same style (town buildings, shared by all towns today)
Town Hall, Arcane Lodge, Merchant Row, Shipyard, Tavern, Garrison, Fortifications, Minefield — each could get a per-town version (`<town>_hall.png` etc.), like the forges.
