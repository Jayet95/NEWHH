# Music map — every place that needs music

Today the game has only 4 recorded tracks (`menu`, `map`, `battle`, `victory`) plus one castle theme (`inferno_town`). Everything else is silent or synthesised. Target: 2–4 variations per slot, played in a shuffled playlist with a crossfade, so a place never loops one tune (like the original).

Naming: `audio/music/<slot>_<n>.mp3` (n = 1…). Loops of 2–3 min, seamless ends, loudness about -16 LUFS, 128 kbps stereo.

## 1. Menus and meta (4 slots, 7 tracks)
| Slot | Where | Tracks | Mood |
|---|---|---|---|
| `menu` | title screen, new game, scenarios, settings | 2 | epic, welcoming, main theme |
| `select` | difficulty / map / castle / hero pick | 1 | calm, anticipating |
| `victory` | battle won (one-shot, 20–40 s) | 2 | triumphant fanfare |
| `defeat` | battle lost, hero lost (one-shot) | 1 | sombre |
| `realmlost` | Realm Lost / game over screen | 1 | tragic, slow |
| `win_game` | scenario won / campaign end | 1 | grand finale |

## 2. Adventure map — per terrain under the hero (the big one)
Music follows the tile type and biome the active hero stands on, crossfading when it changes (not more often than every ~20 s). 3 tracks each.

| Slot | Tile / biome | Tracks | Mood |
|---|---|---|---|
| `map_grass` | grass, road (default) | 4 | pastoral, adventurous |
| `map_forest` | forest tiles | 3 | mysterious, woodwinds |
| `map_mountain` | mountain / rough | 3 | wide, horns, wind |
| `map_sand` | sand and desert biome | 3 | arabic strings, drums, sparse |
| `map_snow` | snow biome | 3 | cold, bells, choir pad |
| `map_swamp` | swamp biome | 3 | murky, low drones, croaks |
| `map_lava` | lava / volcanic biome | 3 | dark brass, pounding drums |
| `map_sea` | hero on a boat / water | 3 | waves, sails, shanty strings |
| `map_night` | night phase (any terrain, optional) | 2 | quiet, moonlit |
| `map_fog` | exploring unexplored fog (optional) | 1 | curious, soft |

Total: about 28 tracks. If that is too many to start, begin with grass, forest, sand, snow, swamp, sea and share the rest.

## 3. Map places and events (short stingers or loops while a window is open)
| Slot | Where | Tracks |
|---|---|---|
| `place_mine` | mine / lumber camp visited | 1 sting |
| `place_dwelling` | neutral / faction dwelling, recruit window | 2 (one per mood: friendly, grim) |
| `place_lair` | dragon lair / monster den | 1 ominous |
| `place_shrine` | shrine, obelisk, seer hut, watchtower | 1 mystical |
| `place_prison` | prison, hero rescue | 1 hopeful |
| `place_merchant` | market, merchant | 1 lively |
| `place_ruin` | wreck, chest, treasure pickup | 1 sting |
| `place_fort` | fort / outpost | 1 sturdy |
| `levelup` | hero level up (sting) | 1 |
| `artifact` | artifact found (sting) | 1 |
| `quest_done` | mission complete (sting) | 1 |
| `new_day` / `new_week` | turn start, week change (stings) | 2 |
| `diplomacy` | treaty window | 1 courtly |

## 4. Towns — one set per castle (9 castles × 3 slots)
Current: only `inferno_town` exists.

| Slot | Where | Tracks per castle |
|---|---|---|
| `<castle>_town` | town screen (castle, rampart, tower, inferno, necropolis, dungeon, stronghold, fortress, conflux) | 2–3 |
| `<castle>_build` | build / hire window (optional, can reuse town) | 0–1 |
| `<castle>_map` | map music while that castle is your faction (optional: mixes into grass playlist) | 1 |

Style per castle: Castle — heroic orchestral; Rampart — elven strings, flutes; Tower — arcane chimes, choir; Inferno — brass, drums, choirs (exists); Necropolis — organ, whispering choir; Dungeon — dark cello, dripping percussion; Stronghold — tribal drums, horns; Fortress — swamp bass, banjo-like plucks; Conflux — shimmering, elemental pads.
Total: about 27.

## 5. Battle (per terrain, per type, per castle)
| Slot | Where | Tracks |
|---|---|---|
| `battle_grass` | field battle on grass | 3 |
| `battle_sand` | desert / sand | 3 |
| `battle_snow` | snow | 3 |
| `battle_swamp` | swamp | 3 |
| `battle_lava` | lava | 3 |
| `battle_sea` | ship / water battle | 3 |
| `battle_siege_attack` | you besiege a castle | 3 |
| `battle_siege_defend` | you defend your castle | 3 |
| `battle_boss` | dragon lair, hero duel, big neutral guards | 2 |
| `<castle>_battle` | optional: battle of that castle's own army or siege of its town | 1 |
| `battle_low` | optional: layer when you are losing (<25% of your army) | 1 |
Total: about 28 (+9 optional).

## 6. Ambience (not music; loops under the music, separate from tracks)
Grass wind and birds, forest, sand wind, snow wind, swamp frogs, sea waves and gulls, night crickets, rain (if added), battle crowd noise, siege crowd and catapults. Town ambience for each of the 9 castles already exists (synthesised in `js/sfx.js`); recorded versions are optional.

## Totals
- Must have (first release): menu 2, select 1, victory 2, defeat 1, realmlost 1, map grass/forest/sand/snow/swamp/sea 3 each, 9 castle towns × 2, battle grass/sand/snow/swamp/sea + siege attack/defend 2 each → about 62 tracks.
- Full set as listed: about 110 tracks.

## How the game would use them (code to write once tracks exist)
- `js/sfx.js` already crossfades per mood and per castle. It needs: a slot → playlist lookup from `audio/music/index.json` (files `<slot>_<n>.mp3`), shuffle without immediate repeat, and mood changes driven by the hero's tile/biome (map), the battle terrain/siege flag (battle) and window events (stingers).
- Packs: music is too big for the art packs; load a slot's tracks on demand, and keep the first track of each slot small (or stream) so phones do not download all of it.
- For Android, keep the whole set under about 150 MB (128 kbps, ~2.5 min tracks, about 2.4 MB each).

## Status: the code is written (js/music.js)
Drop files into `audio/music/`, run `npm run art`, done. Names are exactly the slots above plus `_<n>` (n optional): `map_grass_1.mp3`, `map_sand_2.mp3`, `battle_siege_defend_1.mp3`, `inferno_town_1.mp3`, `victory_1.mp3`, `levelup_1.mp3`…
- **Map** (follows the active hero every 1.5 s): `map_sea` (boat/water) → `map_night` (night phase) → `map_<terrain>` (grass, forest, mountain, sand, snow, swamp, lava) → `<castle>_map` → `map`. A change of terrain waits at least 20 s after the last change; the tune ends, then the next one of the same slot is picked (shuffled, no immediate repeat) and crossfaded.
- **Town:** `<castle>_town` → `town`.
- **Battle:** `battle_boss` (a tier-7 creature on the enemy side) → `battle_siege_attack` / `battle_siege_defend` → `battle_<terrain>` (grass, sand, snow, swamp, lava, sea) → `battle`.
- **Menus:** `menu` (the `select` slot name is accepted by the code but not yet called).
- **Stings** (one-shot, music ducks): `victory`, `defeat`, `realmlost`, `win_game`, `levelup`, `new_day`, `new_week`, `quest_done`, `diplomacy`, and `place_mine|dwelling|lair|shrine|prison|merchant|ruin|fort` when you visit such an object (at most once a minute and a half per kind).
- Anything missing falls back to the shorter slot and finally to the old `audio/menu|map|battle|victory.mp3` and the synthesised tune, so a half-finished set works.
- Debug in the browser console: `Music.state()` shows the chosen slot, file, pending change and the slots found.
