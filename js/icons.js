'use strict';
// Painted medallion icons for spells, hero skills and artifacts (replaces the emoji in the interface).
const Icons = (() => {
  const INK = '#2a1608', FILL = '#fff7d6';
  const hsl = (h, s, l) => `hsl(${h},${s}%,${l}%)`;
  const cache = {}, urls = {};
  const path = (g, pts, close = true) => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); if (close) g.closePath(); };
  const fillStroke = (g, f = FILL) => { g.fillStyle = f; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.4; g.lineJoin = 'round'; g.stroke(); };
  const poly = (g, pts, f) => { path(g, pts); fillStroke(g, f); };
  const circ = (g, x, y, r, f) => { g.beginPath(); g.arc(x, y, r, 0, 7); fillStroke(g, f); };
  const ln = (g, pts, w = 2.2, col = FILL) => { g.lineCap = 'round'; g.lineJoin = 'round'; path(g, pts, false); g.strokeStyle = INK; g.lineWidth = w + 2; g.stroke(); g.strokeStyle = col; g.lineWidth = w; g.stroke(); };
  const star = (g, x, y, r, n = 8, f = FILL) => { const pts = []; for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? r * 0.42 : r; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); } poly(g, pts, f); };
  const GL = {
    sword(g) { poly(g, [[16, 3], [19, 17], [16, 20], [13, 17]]); ln(g, [[10, 19], [22, 19]], 2.6, '#f0c040'); ln(g, [[16, 20], [16, 27]], 3, '#c89040'); },
    bow(g) { g.beginPath(); g.arc(12, 16, 11, -1.2, 1.2); g.strokeStyle = INK; g.lineWidth = 4.4; g.stroke(); g.strokeStyle = '#e0a860'; g.lineWidth = 2.4; g.stroke(); ln(g, [[12 + Math.cos(-1.2) * 11, 16 + Math.sin(-1.2) * 11], [12 + Math.cos(1.2) * 11, 16 + Math.sin(1.2) * 11]], 1, '#fff'); ln(g, [[8, 16], [27, 16]], 1.8); poly(g, [[27, 16], [22, 13], [22, 19]]); },
    arrow(g) { ln(g, [[6, 26], [24, 8]], 2.4); poly(g, [[26, 6], [27, 14], [18, 7]]); ln(g, [[6, 26], [9, 21]], 2.4, '#ff8a70'); ln(g, [[6, 26], [11, 24]], 2.4, '#ff8a70'); },
    shield(g) { poly(g, [[7, 5], [25, 5], [25, 16], [16, 28], [7, 16]]); ln(g, [[16, 6], [16, 25]], 1.6, '#c89040'); ln(g, [[8, 13], [24, 13]], 1.6, '#c89040'); },
    bolt(g) { poly(g, [[19, 2], [8, 17], [15, 17], [11, 30], [25, 12], [17, 12]], '#ffe060'); },
    chain(g) { poly(g, [[16, 2], [8, 13], [13, 13], [10, 24], [20, 10], [15, 10]], '#ffe060'); circ(g, 24, 22, 4); circ(g, 27, 12, 3); circ(g, 6, 25, 3); },
    flame(g) { path(g, [[16, 2]]); g.beginPath(); g.moveTo(16, 3); g.quadraticCurveTo(26, 12, 23, 22); g.quadraticCurveTo(21, 29, 16, 29); g.quadraticCurveTo(8, 29, 8, 20); g.quadraticCurveTo(8, 14, 12, 11); g.quadraticCurveTo(12, 16, 15, 16); g.quadraticCurveTo(13, 9, 16, 3); fillStroke(g, '#ffb040'); g.beginPath(); g.ellipse(16, 22, 4, 5.5, 0, 0, 7); g.fillStyle = '#fff3b0'; g.fill(); },
    flames(g) { GL.flame(g); ln(g, [[5, 27], [27, 27]], 2, '#ff6030'); },
    drop(g) { g.beginPath(); g.moveTo(16, 3); g.quadraticCurveTo(26, 16, 24, 21); g.quadraticCurveTo(22, 29, 16, 29); g.quadraticCurveTo(10, 29, 8, 21); g.quadraticCurveTo(6, 16, 16, 3); fillStroke(g, '#8ad0ff'); ln(g, [[12, 20], [13, 24]], 1.6, '#fff'); },
    blood(g) { GL.drop(g); g.beginPath(); g.moveTo(16, 3); g.quadraticCurveTo(26, 16, 24, 21); g.quadraticCurveTo(22, 29, 16, 29); g.quadraticCurveTo(10, 29, 8, 21); g.quadraticCurveTo(6, 16, 16, 3); fillStroke(g, '#e04a40'); },
    rock(g) { poly(g, [[4, 27], [11, 11], [16, 17], [21, 6], [29, 27]], '#c8c0b0'); ln(g, [[21, 6], [18, 14]], 1.4, '#fff'); },
    peak(g) { GL.rock(g); poly(g, [[21, 6], [18, 12], [20, 11], [22, 13], [24, 10]], '#fff'); },
    hourglass(g) { poly(g, [[8, 4], [24, 4], [17, 16], [24, 28], [8, 28], [15, 16]], '#ffe8a0'); poly(g, [[12, 24], [20, 24], [16, 19]], '#c89040'); },
    skull(g) { circ(g, 16, 14, 9, '#f4ecd8'); poly(g, [[11, 21], [21, 21], [20, 27], [12, 27]], '#f4ecd8'); circ(g, 12.5, 14, 2.6, INK); circ(g, 19.5, 14, 2.6, INK); poly(g, [[16, 17.5], [14.8, 20], [17.2, 20]], INK); },
    meteor(g) { ln(g, [[4, 6], [16, 18]], 5, '#ff9a40'); ln(g, [[3, 12], [12, 20]], 3, '#ffd24a'); circ(g, 20, 21, 7, '#e8c070'); circ(g, 18, 19, 2, '#b08040'); },
    spiral(g) { g.beginPath(); for (let i = 0; i < 40; i++) { const a = i * 0.4, r = 1 + i * 0.32; const x = 16 + Math.cos(a) * r, y = 16 + Math.sin(a) * r; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.strokeStyle = INK; g.lineWidth = 5; g.stroke(); g.strokeStyle = '#d58aff'; g.lineWidth = 2.6; g.stroke(); },
    eye(g) { g.beginPath(); g.moveTo(3, 16); g.quadraticCurveTo(16, 3, 29, 16); g.quadraticCurveTo(16, 29, 3, 16); fillStroke(g); circ(g, 16, 16, 5, '#4a90e0'); circ(g, 16, 16, 2.2, INK); },
    blind(g) { GL.eye(g); ln(g, [[5, 27], [27, 5]], 3, '#ff5a48'); },
    sun(g) { for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ln(g, [[16 + Math.cos(a) * 9, 16 + Math.sin(a) * 9], [16 + Math.cos(a) * 14, 16 + Math.sin(a) * 14]], 2.4, '#ffd24a'); } circ(g, 16, 16, 7, '#ffe27a'); },
    plus(g) { poly(g, [[12, 4], [20, 4], [20, 12], [28, 12], [28, 20], [20, 20], [20, 28], [12, 28], [12, 20], [4, 20], [4, 12], [12, 12]], '#ff8a90'); },
    flake(g) { for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; ln(g, [[16 + Math.cos(a) * 13, 16 + Math.sin(a) * 13], [16 - Math.cos(a) * 13, 16 - Math.sin(a) * 13]], 2.4, '#d8f4ff'); } circ(g, 16, 16, 3, '#fff'); },
    ankh(g) { g.beginPath(); g.ellipse(16, 9, 5.5, 6.5, 0, 0, 7); g.strokeStyle = INK; g.lineWidth = 5.4; g.stroke(); g.strokeStyle = '#ffe27a'; g.lineWidth = 3; g.stroke(); ln(g, [[16, 15], [16, 29]], 3, '#ffe27a'); ln(g, [[8, 19], [24, 19]], 3, '#ffe27a'); },
    wind(g) { for (const [y, w] of [[10, 18], [16, 22], [22, 16]]) { g.beginPath(); g.moveTo(5, y); g.lineTo(5 + w, y); g.arc(5 + w, y - 3, 3, Math.PI / 2, -Math.PI, true); g.strokeStyle = INK; g.lineWidth = 4.4; g.stroke(); g.strokeStyle = '#e8f6ff'; g.lineWidth = 2.2; g.stroke(); } },
    chevrons(g) { for (const x of [5, 12, 19]) ln(g, [[x, 7], [x + 7, 16], [x, 25]], 3, '#e8f6ff'); },
    flag(g) { ln(g, [[8, 4], [8, 28]], 2.6, '#c89040'); poly(g, [[9, 5], [26, 9], [9, 15]], '#e0443a'); },
    clover(g) { for (const [x, y] of [[11, 11], [21, 11], [11, 21], [21, 21]]) circ(g, x, y, 6, '#7ad07a'); ln(g, [[16, 18], [18, 29]], 2.4, '#4a9a4a'); },
    road(g) { poly(g, [[10, 29], [22, 29], [19, 3], [13, 3]], '#d0c0a0'); ln(g, [[16, 6], [16, 11]], 2, '#8a7050'); ln(g, [[16, 15], [16, 20]], 2, '#8a7050'); ln(g, [[16, 24], [16, 28]], 2, '#8a7050'); },
    book(g) { poly(g, [[4, 6], [15, 8], [15, 27], [4, 25]], '#b08040'); poly(g, [[28, 6], [17, 8], [17, 27], [28, 25]], '#d0a060'); ln(g, [[7, 12], [12, 13]], 1.4, '#fff'); ln(g, [[20, 13], [25, 12]], 1.4, '#fff'); },
    wand(g) { ln(g, [[6, 26], [21, 11]], 3, '#a07040'); star(g, 23, 9, 6, 6, '#ffe27a'); },
    house(g) { poly(g, [[4, 15], [16, 4], [28, 15]], '#e07060'); poly(g, [[7, 15], [25, 15], [25, 28], [7, 28]], '#f0e0b0'); poly(g, [[13, 28], [13, 20], [19, 20], [19, 28]], '#8a5a2b'); },
    cannon(g) { circ(g, 16, 16, 9, '#7a7a84'); ln(g, [[24, 8], [30, 3]], 3, '#ff9a40'); circ(g, 13, 13, 2, '#bbb'); },
    cloud(g) { circ(g, 11, 18, 6, '#e8f0f8'); circ(g, 18, 14, 7, '#e8f0f8'); circ(g, 24, 19, 5, '#e8f0f8'); poly(g, [[8, 24], [27, 24], [27, 20], [8, 20]], '#e8f0f8'); },
    tree(g) { poly(g, [[16, 3], [26, 17], [6, 17]], '#5ab05a'); poly(g, [[16, 10], [27, 24], [5, 24]], '#4a9a4a'); poly(g, [[14, 24], [18, 24], [18, 29], [14, 29]], '#8a5a2b'); },
    waves(g) { for (const y of [10, 17, 24]) { g.beginPath(); g.moveTo(4, y); g.quadraticCurveTo(10, y - 6, 16, y); g.quadraticCurveTo(22, y + 6, 28, y); g.strokeStyle = INK; g.lineWidth = 4.4; g.stroke(); g.strokeStyle = '#bfe8ff'; g.lineWidth = 2.2; g.stroke(); } },
    anchor(g) { ln(g, [[16, 6], [16, 26]], 3); ln(g, [[10, 11], [22, 11]], 2.6); g.beginPath(); g.arc(16, 20, 9, 0.2, Math.PI - 0.2); g.strokeStyle = INK; g.lineWidth = 5.2; g.stroke(); g.strokeStyle = FILL; g.lineWidth = 2.8; g.stroke(); circ(g, 16, 5, 2.6, FILL); },
    scope(g) { poly(g, [[4, 20], [22, 9], [25, 15], [7, 26]], '#c89040'); circ(g, 26, 9, 4, '#8ad0ff'); },
    orb(g) { circ(g, 16, 14, 9, '#b0a0ff'); circ(g, 13, 11, 2.6, '#fff'); poly(g, [[9, 24], [23, 24], [20, 29], [12, 29]], '#c89040'); },
    scroll(g) { poly(g, [[7, 6], [25, 6], [25, 26], [7, 26]], '#f4ecd8'); circ(g, 7, 6, 3, '#d0b080'); circ(g, 25, 26, 3, '#d0b080'); ln(g, [[11, 12], [21, 12]], 1.4, '#8a6a40'); ln(g, [[11, 17], [21, 17]], 1.4, '#8a6a40'); ln(g, [[11, 22], [18, 22]], 1.4, '#8a6a40'); },
    heart(g) { g.beginPath(); g.moveTo(16, 28); g.bezierCurveTo(2, 18, 5, 5, 16, 11); g.bezierCurveTo(27, 5, 30, 18, 16, 28); fillStroke(g, '#ff7a8a'); },
    foot(g) { circ(g, 16, 20, 7, FILL); for (const x of [8, 12, 17, 22]) circ(g, x + 1, 9 + Math.abs(x - 15) * 0.4, 2.2, FILL); },
    helm(g) { g.beginPath(); g.arc(16, 15, 11, Math.PI, 0); g.lineTo(27, 24); g.lineTo(5, 24); g.closePath(); fillStroke(g, '#c8d0dc'); ln(g, [[9, 17], [23, 17]], 2.4, '#2a3040'); poly(g, [[14, 4], [18, 4], [19, -2], [13, -2]], '#e0443a'); },
    crown(g) { poly(g, [[5, 24], [5, 10], [11, 16], [16, 6], [21, 16], [27, 10], [27, 24]], '#ffd24a'); circ(g, 16, 18, 2.2, '#ff5a8a'); },
    halo(g) { g.beginPath(); g.ellipse(16, 12, 11, 4.5, 0, 0, 7); g.strokeStyle = INK; g.lineWidth = 5.6; g.stroke(); g.strokeStyle = '#ffe27a'; g.lineWidth = 3; g.stroke(); circ(g, 16, 22, 5, FILL); },
    amulet(g) { g.beginPath(); g.arc(16, 12, 10, 0.5, Math.PI - 0.5, true); g.strokeStyle = INK; g.lineWidth = 3.6; g.stroke(); g.strokeStyle = '#d0a060'; g.lineWidth = 1.6; g.stroke(); circ(g, 16, 21, 6, '#7ad6ff'); circ(g, 14, 19, 1.6, '#fff'); },
    armor(g) { poly(g, [[8, 4], [24, 4], [29, 10], [25, 15], [24, 28], [8, 28], [7, 15], [3, 10]], '#c8d0dc'); ln(g, [[16, 6], [16, 26]], 1.6, '#8a94a4'); },
    boot(g) { poly(g, [[10, 4], [19, 4], [19, 18], [28, 22], [28, 28], [8, 28]], '#c89040'); },
    cape(g) { poly(g, [[9, 4], [23, 4], [28, 28], [4, 28]], '#c0402a'); circ(g, 16, 6, 2.6, '#ffd24a'); },
    ring(g) { g.beginPath(); g.arc(16, 18, 9, 0, 7); g.strokeStyle = INK; g.lineWidth = 6; g.stroke(); g.strokeStyle = '#ffd24a'; g.lineWidth = 3.6; g.stroke(); circ(g, 16, 8, 4.2, '#ff5a8a'); },
    gem(g) { poly(g, [[16, 29], [4, 13], [10, 5], [22, 5], [28, 13]], '#ff8ac0'); ln(g, [[4, 13], [28, 13]], 1.2, '#fff'); },
  };
  const SPELL_G = { arrow: 'arrow', haste: 'chevrons', lightning: 'bolt', shield: 'shield', chain: 'chain', stone: 'rock', slow: 'hourglass', curse: 'skull', meteor: 'meteor', implosion: 'spiral', bloodlust: 'blood', blind: 'blind', fireball: 'flame', armageddon: 'flames', bless: 'sun', heal: 'plus', frostring: 'flake', resurrect: 'ankh', dispel: 'star', icebolt: 'flake', weakness: 'skull', disrupt: 'chain', forget: 'blind', destroyundead: 'sun', deathripple: 'skull', prayer: 'sun', berserk: 'blood', hypnotize: 'spiral', summon_fire: 'flame', summon_water: 'flake', summon_air: 'chevrons', summon_earth: 'rock' };
  const SCHOOL_H = { air: 205, earth: 28, fire: 8, water: 190 };
  const PERK_G = { offense: ['sword', 5], archery: ['bow', 100], armorer: ['shield', 215], leadership: ['flag', 350], fortune: ['clover', 120], logistics: ['road', 35], wisdom: ['book', 265], sorcery: ['wand', 285], estates: ['house', 45], ballistics: ['cannon', 15], airmagic: ['cloud', 205], earthmagic: ['peak', 28], firemagic: ['flame', 8], watermagic: ['drop', 190], necromancy: ['skull', 270], navigation: ['anchor', 210], scouting: ['scope', 40], mysticism: ['orb', 260], learning: ['scroll', 50], forester: ['tree', 120], mountaineer: ['peak', 30], waterwalk: ['waves', 195], charisma: ['heart', 340] };
  const SLOT_G = { weapon: 'sword', shield: 'shield', head: 'helm', neck: 'amulet', torso: 'armor', feet: 'boot', cape: 'cape', ring: 'ring' };
  const TIER_COL = { 1: [28, 55, 38], 2: [215, 12, 46], 3: [220, 60, 44], 4: [45, 80, 46] };
  function medallion(g, h, s, l) {
    const q = g.createRadialGradient(11, 9, 1, 16, 16, 17); q.addColorStop(0, hsl(h, s, l + 22)); q.addColorStop(1, hsl(h, s, l - 14));
    g.beginPath(); g.arc(16, 16, 15, 0, 7); g.fillStyle = q; g.fill(); g.lineWidth = 1.6; g.strokeStyle = '#140a04'; g.stroke();
    g.beginPath(); g.arc(16, 16, 13.2, 0, 7); g.strokeStyle = 'rgba(255,240,190,.55)'; g.lineWidth = 1; g.stroke();
  }
  function canvas(kind, key) {
    const k = kind + ':' + key; if (cache[k]) return cache[k];
    const custom = typeof Assets !== 'undefined' ? Assets.get('icons/' + kind + '_' + key) : null;
    if (custom) { const cc = document.createElement('canvas'); cc.width = cc.height = 64; cc.getContext('2d').drawImage(custom, 0, 0, 64, 64); return cache[k] = cc; }
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.scale(2, 2);
    let h = 30, s = 40, l = 36, glyph = 'gem', tier = 0;
    if (kind === 'spell') { const sp = SPELLS[key]; h = SCHOOL_H[sp.school]; s = 62; l = 40; glyph = SPELL_G[key] || 'star'; }
    else if (kind === 'perk') { const p = PERK_G[key] || ['gem', 30]; glyph = p[0]; h = p[1]; s = 55; l = 38; }
    else { const a = ART[key], t = TIER_COL[a.tier] || TIER_COL[1]; h = t[0]; s = t[1]; l = t[2]; glyph = SLOT_G[a.slot] || 'gem'; tier = a.tier; }
    medallion(g, h, s, l);
    g.save(); g.translate(16, 16); g.scale(0.62, 0.62); g.translate(-16, -16); (GL[glyph] || GL.gem)(g); g.restore();
    if (kind === 'art' && ART[key].set) { star(g, 25, 7, 5, 5, '#ffd24a'); }
    return cache[k] = c;
  }
  const html = (kind, key, px = 18) => { const k = kind + ':' + key; return `<img class="ico" draggable="false" width="${px}" height="${px}" alt="" src="${urls[k] || (urls[k] = canvas(kind, key).toDataURL())}">`; };
  // swap the emoji used throughout the UI for the painted medallions (the emoji stay available as iE)
  for (const k in SPELLS) { SPELLS[k].iE = SPELLS[k].i; SPELLS[k].i = html('spell', k); }
  for (const k in PERKS) { PERKS[k].iE = PERKS[k].i; PERKS[k].i = html('perk', k); }
  for (const k in ART) { ART[k].iE = ART[k].i; ART[k].i = html('art', k); }
  // free-standing glyph medallion (achievements): any glyph name, any hue
  const glyphHtml = (glyph, hue = 45, px = 44) => {
    const k = 'g:' + glyph + hue; if (!cache[k]) {
      const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d'); g.scale(3, 3);
      medallion(g, hue, 58, 40); g.beginPath(); g.arc(16, 16, 10.6, 0, 7); g.fillStyle = 'rgba(0,0,0,.18)'; g.fill();
      g.save(); g.translate(16, 16); g.scale(0.58, 0.58); g.translate(-16, -16); (GL[glyph] || (glyph === 'star' ? ((gg) => star(gg, 16, 16, 14, 5, '#ffe27a')) : GL.gem))(g); g.restore(); cache[k] = c;
    }
    return `<img class="ico" draggable="false" width="${px}" height="${px}" alt="" src="${urls[k] || (urls[k] = cache[k].toDataURL())}">`;
  };
  const lockedHtml = (px = 44) => `<span class="ico lockedico" style="width:${px}px;height:${px}px">🔒</span>`;
  const reload = () => { for (const k in cache) delete cache[k]; for (const k in urls) delete urls[k]; for (const k in SPELLS) SPELLS[k].i = html('spell', k); for (const k in PERKS) PERKS[k].i = html('perk', k); for (const k in ART) ART[k].i = html('art', k); };
  return { reload, canvas, html, glyphHtml, lockedHtml };
})();
