const fs = require('fs');
let s = fs.readFileSync('tools/art_checklist.js', 'utf8');
const a = "sec('Creatures —";
if (!s.includes(a)) throw new Error('missing');
s = s.replace(a, `out.push(\`
## The imported art pack (what is in art/ today)
Produced by \\`node tools/import_assets.js "<path to the pack's src/assets>"\\` (WebP, small sizes). Every file below is optional: anything missing keeps the painted-in-code art.
- \\`portraits/<id>.webp\\` and \\`portraits/<id>_up.webp\\` — square creature paintings used in the frames (base picture and upgraded picture; ids as below)
- \\`poses/<left|right>/<idle|fighting|defending>/<id>[_up].webp\\` — battle sprites (right = your side, left = the enemy); loaded when a fight starts
- \\`heroes/<name>.webp\\` — hero portraits; \\`mounted/<name>_<north|east|south|west>.webp\\` — hero on the adventure map
- \\`objects/…\\`, \\`terrain/…\\`, \\`icons/res_*\\`, \\`flags/<colour>.webp\\` — map objects, ground textures with tree/mountain overlays, resource icons, the eight player flags
- \\`ui/title.webp\\`, \\`ui/castle_select.webp\\`, \\`ui/hero_select.webp\\`, \\`ui/town_<castle>.webp\\` — screen backgrounds and castle pictures
\`);
` + a);
fs.writeFileSync('tools/art_checklist.js', s);
