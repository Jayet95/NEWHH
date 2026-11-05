# Heroes-3 style game (JS) — design plan

Stack: plain HTML + Canvas + vanilla JS, no build step. Run: `python -m http.server` then open index.html.

## Core loop
Adventure map (turn/day based) -> fight neutral stacks / enemy hero (hex tactical battle) -> grow army in town -> capture the enemy castle to win.

## Systems
1. **Data** (`js/data.js`): 7 Castle tiers + neutral + undead creatures, 5 spells, terrain costs.
2. **Map** (`js/map.js`): seeded 40x28 map (grass/forest/mountain/water/sand/road), road carved player->enemy, objects: mines, resource piles, chests, artifacts, guarded monsters, towns. A* pathfinding with terrain costs (H3-style: click to preview path, click again to walk).
3. **Hero**: attack/defense/spell power/knowledge, 7 army slots, movement points per day, XP + level-ups, mana.
4. **Town**: recruit creatures (weekly growth), build dwellings tiers 3-7 and Town Hall (+gold/day).
5. **Battle** (`js/battle.js`): 15x11 hex grid, speed-ordered initiative, move/melee/shoot/wait/defend, retaliation, flyers, shooters with ammo, obstacles, H3 damage formula, hero spellbook (Magic Arrow, Lightning Bolt, Haste, Bless, Stone Skin), enemy AI, auto-battle, retreat.
6. **Enemy**: AI hero that marches on your hero/town after day 3, re-spawns, army grows weekly; losing your town = defeat. Capturing enemy castle = victory.
7. **Economy**: daily income from town and flagged mines, weekly creature growth, save/load (localStorage).

## Milestones
data+map -> battle -> adventure UI/town -> polish/test -> push to GitHub (master).
