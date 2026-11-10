# Hero-selection pictures, one per castle

`art/ui/hero_select.webp` (Castle) is the model. The game shows the picture whole and puts the hero list in its dark left panel.

Make one picture for each of the other 8 castles, same size and layout, named:

`hero_select_rampart.webp`, `hero_select_tower.webp`, `hero_select_inferno.webp`, `hero_select_necropolis.webp`,
`hero_select_dungeon.webp`, `hero_select_stronghold.webp`, `hero_select_fortress.webp`, `hero_select_conflux.webp`
(Castle may also be supplied as `hero_select_castle.webp`; otherwise `hero_select.webp` is used.)

* 1920 x 1080, 16:9, WebP or PNG.
* The dark panel (about the left 55% x 88% of the picture, inside the castle's own frame and corner ornaments) must stay calm and dark: the hero list is drawn over it.
* The right 40% is the scene: that castle's heroes (a male and a female, the class costumes), banners in the castle colours, its architecture in the background.
* Keep the picture's own frame; the game does not add one.

Then run `npm run art`. Castles without a picture use their town scene, dimmed, behind the old layout.
