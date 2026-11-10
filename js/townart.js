'use strict';
// Painted town art: every building (creature dwellings for 5 upgrade levels, Town Hall 1-5, Mage Guild 1-3, Marketplace,
// Shipyard, fortifications 0-3) is drawn in code in the colours of the castle's faction and grows richer with each level.
const TownArt = (() => {
  const INK = '#140a04';
  const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${Math.max(0, Math.min(100, l))}%,${a})`;
  const mk = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.lineJoin = 'round'; fn(g); return c; };
  const lin = (g, y0, y1, a, b) => { const q = g.createLinearGradient(0, y0, 0, y1); q.addColorStop(0, a); q.addColorStop(1, b); return q; };
  const poly = (g, pts, fill, stroke = INK, lw = 1.3) => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } };
  const rect = (g, x, y, w, h, fill, stroke = INK) => poly(g, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], fill, stroke);
  const dot = (g, x, y, r, c) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = c; g.fill(); };
  const hueOf = (fac) => { const k = Object.keys(FACTIONS), i = k.indexOf(fac); return i < 0 ? 30 : (i * 41 + 8) % 360; };
  const wall = (g, x, y, w, h, hue = 35) => {
    rect(g, x, y, w, h, lin(g, y, y + h, hsl(hue, 14, 74), hsl(hue, 14, 52)));
    g.strokeStyle = 'rgba(40,30,20,.28)'; g.lineWidth = 0.7;
    for (let r = y + 5; r < y + h - 1; r += 5) { g.beginPath(); g.moveTo(x, r); g.lineTo(x + w, r); g.stroke(); for (let c = x + ((((r - y) / 5) | 0) % 2 ? 4 : 8); c < x + w; c += 8) { g.beginPath(); g.moveTo(c, r - 5); g.lineTo(c, r); g.stroke(); } }
  };
  const win = (g, x, y, lit) => { rect(g, x, y, 4, 6, lit ? '#ffe27a' : '#2a2a3a'); if (lit) { g.fillStyle = 'rgba(255,230,120,.35)'; g.fillRect(x - 1, y - 1, 6, 8); } };
  const door = (g, x, y) => { g.beginPath(); g.moveTo(x, y + 9); g.lineTo(x, y + 3); g.arc(x + 4, y + 3, 4, Math.PI, 0); g.lineTo(x + 8, y + 9); g.closePath(); g.fillStyle = '#2a1608'; g.fill(); g.strokeStyle = INK; g.lineWidth = 1; g.stroke(); };
  const flag = (g, x, y, c) => { g.strokeStyle = '#2b2218'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 13); g.stroke(); poly(g, [[x, y - 13], [x + 9, y - 10], [x, y - 7]], c, INK, 1); };
  const crenel = (g, x, y, w) => { for (let i = 0; i < w - 2; i += 5) rect(g, x + i, y - 4, 3.4, 5, hsl(35, 12, 62)); };
  const shadow = (g, w = 24) => { g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(32, 70, w, 3.4, 0, 0, 7); g.fill(); };
  const glow = (g, x, y, r, col) => { const q = g.createRadialGradient(x, y, 1, x, y, r); q.addColorStop(0, col); q.addColorStop(1, 'rgba(255,220,120,0)'); g.fillStyle = q; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
  const gablePath = (x0, x1, yb, ht) => [[x0 - 3, yb], [(x0 + x1) / 2, yb - ht], [x1 + 3, yb]];

  // ---- creature dwelling: shell by tier, ornaments by upgrade level, signboard = the creature itself ----
  function dwelling(g, tier, lv, hue, id) {
    const roofC = hsl(hue, 55, 38), roofD = hsl(hue, 55, 24), gold = '#e3b840';
    shadow(g, 26);
    const wideN = tier <= 2 ? 30 : tier <= 4 ? 36 : 42, floors = tier >= 6 ? 3 : tier >= 4 ? 2 : 1 + (lv >= 3 ? 1 : 0);
    const x0 = 32 - wideN / 2, x1 = 32 + wideN / 2, fh = 15, bodyH = floors * fh + 4, yTop = 68 - bodyH;
    // side turrets for higher levels / tiers
    if (lv >= 3 || tier >= 5) for (const sx of [x0 - 6, x1 - 2]) { wall(g, sx, yTop + 6, 8, bodyH - 6, 40); poly(g, [[sx - 1.5, yTop + 6], [sx + 4, yTop - 6], [sx + 9.5, yTop + 6]], roofC); }
    wall(g, x0, yTop, wideN, bodyH, 38);
    for (let f = 0; f < floors; f++) for (let i = 0; i < (wideN > 34 ? 3 : 2); i++) win(g, x0 + 5 + i * (wideN - 14) / ((wideN > 34 ? 3 : 2) - 1 || 1), yTop + 4 + f * fh, lv >= 4 || f === 0 && i === 1);
    door(g, 28, 59);
    // roof by tier
    if (tier <= 4) { poly(g, gablePath(x0, x1, yTop, tier <= 2 ? 12 : 16), roofC); if (tier >= 3) { rect(g, x1 - 9, yTop - 16, 4, 9, hsl(30, 10, 40)); } }
    else if (tier <= 6) { poly(g, [[x0 - 3, yTop], [x0 + 4, yTop - 6], [x1 - 4, yTop - 6], [x1 + 3, yTop]], roofC); poly(g, [[32 - 9, yTop - 6], [32, yTop - 24], [32 + 9, yTop - 6]], roofD); }
    else { g.beginPath(); g.arc(32, yTop, wideN / 2 + 2, Math.PI, 0); g.closePath(); g.fillStyle = lin(g, yTop - 22, yTop, roofC, roofD); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.3; g.stroke(); poly(g, [[30, yTop - 21], [32, yTop - 32], [34, yTop - 21]], gold); }
    // creature signboard
    const e = Art.portraitCanvas(id, 48), ey = yTop + (tier <= 4 ? 8 : 10), es = tier >= 5 ? 20 : 17;
    g.drawImage(e, 32 - es / 2, ey - es / 2 - 2 + 8, es, es);
    // level ornaments
    if (lv >= 2) { g.strokeStyle = gold; g.lineWidth = 1.8; g.beginPath(); g.moveTo(x0, yTop + 1.5); g.lineTo(x1, yTop + 1.5); g.stroke(); }
    if (lv >= 3) { flag(g, x0 - 2, yTop + 4, hsl(hue, 70, 48)); }
    if (lv >= 4) { flag(g, x1 + 2, yTop + 4, hsl(hue, 70, 48)); for (let i = 0; i < 4; i++) dot(g, x0 + 4 + i * (wideN - 8) / 3, 66, 1.6, gold); }
    if (lv >= 5) { glow(g, 32, yTop - 8, 22, 'rgba(255,230,130,.55)'); for (const [sx, sy] of [[10, 14], [54, 18], [6, 36], [58, 40]]) { poly(g, [[sx, sy - 3.4], [sx + 1, sy - 1], [sx + 3.4, sy], [sx + 1, sy + 1], [sx, sy + 3.4], [sx - 1, sy + 1], [sx - 3.4, sy], [sx - 1, sy - 1]], '#fff3b0', null); } }
  }
  // ---- Town Hall 1..5 ----
  function hall(g, lv, hue) {
    const roofC = hsl(hue, 55, 38), gold = '#e3b840'; shadow(g, 28);
    const w = 28 + lv * 4, x0 = 32 - w / 2, x1 = 32 + w / 2, h = 22 + lv * 4, yTop = 68 - h;
    wall(g, x0, yTop, w, h, 42);
    if (lv >= 2) for (const sx of [x0 - 5, x1 - 3]) { wall(g, sx, yTop + 4, 8, h - 4, 42); poly(g, [[sx - 1.5, yTop + 4], [sx + 4, yTop - 8], [sx + 9.5, yTop + 4]], roofC); }
    if (lv >= 3) { wall(g, 26, yTop - 12, 12, 14, 42); poly(g, [[25, yTop - 12], [32, yTop - 24], [39, yTop - 12]], roofC); dot(g, 32, yTop - 6, 3.4, '#f5efe0'); line(g, 32, yTop - 6, 32, yTop - 8.4); line(g, 32, yTop - 6, 33.6, yTop - 5.4); }
    if (lv === 4) { g.beginPath(); g.arc(32, yTop, 14, Math.PI, 0); g.fillStyle = lin(g, yTop - 14, yTop, '#8ec8ff', '#3a78c0'); g.fill(); g.strokeStyle = INK; g.stroke(); poly(g, [[31, yTop - 14], [32, yTop - 22], [33, yTop - 14]], gold); }
    if (lv >= 5) { g.beginPath(); g.arc(32, yTop, 16, Math.PI, 0); g.fillStyle = lin(g, yTop - 16, yTop, '#fff0a0', '#c8921c'); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.4; g.stroke(); poly(g, [[31, yTop - 16], [32, yTop - 27], [33, yTop - 16]], gold); glow(g, 32, yTop - 10, 26, 'rgba(255,230,130,.5)'); }
    if (lv < 3) poly(g, gablePath(x0, x1, yTop, 12 + lv * 2), roofC);
    for (let i = 0; i < 2 + Math.min(lv, 3); i++) win(g, x0 + 4 + i * ((w - 12) / (1 + Math.min(lv, 3))), yTop + 6, lv >= 2);
    door(g, 28, 59); rect(g, x0 + w / 2 - 8, 56, 16, 3, hsl(hue, 40, 30));
    for (let i = 0; i < lv; i++) flag(g, x0 + 3 + i * (w - 6) / Math.max(1, lv - 1 || 1) * (lv > 1 ? 1 : 0), yTop + (lv === 1 ? 2 : 0), hsl(hue, 70, 48));
    if (lv >= 4) { g.strokeStyle = gold; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, yTop + 2); g.lineTo(x1, yTop + 2); g.stroke(); }
  }
  const line = (g, x1, y1, x2, y2) => { g.strokeStyle = INK; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
  // ---- Mage Guild 1..3 ----
  function guild(g, lv, hue) {
    shadow(g, 20); const roofC = hsl(250 + (hue % 40), 55, 38), h = 30 + lv * 9, yTop = 68 - h, w = 20 + lv * 3;
    wall(g, 32 - w / 2, yTop, w, h, 260); poly(g, [[32 - w / 2 - 3, yTop], [32, yTop - 20 - lv * 3], [32 + w / 2 + 3, yTop]], roofC);
    if (lv >= 2) for (const sx of [32 - w / 2 - 7, 32 + w / 2 - 1]) { wall(g, sx, yTop + 14, 8, h - 14, 260); poly(g, [[sx - 1.5, yTop + 14], [sx + 4, yTop + 2], [sx + 9.5, yTop + 14]], roofC); }
    for (let i = 0; i < lv + 1; i++) win(g, 29.5, yTop + 6 + i * 11, true);
    door(g, 28, 59);
    const orbCols = ['#7ad6ff', '#c58aff', '#ff9a4a']; for (let i = 0; i < lv; i++) { const ox = 32 + (i - (lv - 1) / 2) * 11, oy = yTop - 22 - lv * 3 + (i % 2) * 6; glow(g, ox, oy, 10, 'rgba(160,200,255,.6)'); dot(g, ox, oy, 3.4, orbCols[i]); dot(g, ox - 1, oy - 1, 1.1, '#fff'); }
    g.fillStyle = '#fff3b0'; for (const [sx, sy] of [[14, 20], [52, 14], [50, 34]]) if (lv >= 2) dot(g, sx, sy, 1.3, '#fff3b0');
  }
  function market(g, lv, hue) {
    shadow(g, 26);
    for (let i = 0; i < 3; i++) { const x = 6 + i * 19; rect(g, x, 50, 17, 18, '#8a5a2b'); for (let s = 0; s < 4; s++) poly(g, [[x + s * 4.25, 36], [x + s * 4.25 + 4.25, 36], [x + s * 4.25 + 4.25, 46], [x + s * 4.25, 46]], s % 2 ? '#f5efe0' : hsl((hue + i * 50) % 360, 60, 48)); line(g, x, 46, x + 17, 46); dot(g, x + 5, 56, 2.6, '#e3b840'); dot(g, x + 11, 57, 2.2, '#c0301c'); }
    flag(g, 32, 36, hsl(hue, 70, 48));
  }
  function ship(g, lv, hue) {
    shadow(g, 26); rect(g, 4, 60, 56, 6, '#8a5a2b'); for (let i = 0; i < 6; i++) rect(g, 6 + i * 9, 62, 2, 8, '#5a3a18');
    poly(g, [[10, 46], [54, 46], [48, 60], [16, 60]], lin(g, 46, 60, '#a8743a', '#5e3a14')); line(g, 32, 46, 32, 12); g.strokeStyle = '#4a2d12'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(32, 46); g.lineTo(32, 12); g.stroke();
    poly(g, [[34, 14], [52, 42], [34, 42]], '#f5efe0'); poly(g, [[30, 18], [16, 42], [30, 42]], '#e0d6bc'); flag(g, 32, 14, hsl(hue, 70, 48));
  }
  // ---- fortifications drawn behind the buildings (0 palisade, 1 Citadel, 2 Castle, 3 Fortress) ----
  function drawFort(g, W, y, fort) {
    if (fort <= 0) { g.fillStyle = '#6b4a24'; for (let x = 0; x < W; x += 9) { poly(g, [[x, y + 20], [x, y + 4], [x + 4.5, y - 3], [x + 9, y + 4], [x + 9, y + 20]], '#8a5e30'); } return; }
    const h = 16 + fort * 7;
    for (let x = 0; x < W; x += 1) { /* wall body */ }
    g.fillStyle = lin(g, y - h, y + 22, hsl(35, 12, 66), hsl(35, 12, 44)); g.fillRect(0, y - h + 8, W, h + 14);
    g.strokeStyle = 'rgba(40,30,20,.3)'; g.lineWidth = 0.8; for (let r = y - h + 14; r < y + 22; r += 6) { g.beginPath(); g.moveTo(0, r); g.lineTo(W, r); g.stroke(); }
    for (let x = 0; x < W; x += 12) { g.fillStyle = hsl(35, 12, 66); g.fillRect(x, y - h + 3, 7, 6); g.strokeStyle = INK; g.lineWidth = 0.8; g.strokeRect(x, y - h + 3, 7, 6); }
    const nT = 2 + fort * 2, tw = 16 + fort * 3;
    for (let i = 0; i < nT; i++) { const x = (i + 0.5) * W / nT; g.fillStyle = lin(g, y - h - 14, y + 22, hsl(35, 12, 72), hsl(35, 12, 46)); g.fillRect(x - tw / 2, y - h - 10, tw, h + 32); g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(x - tw / 2, y - h - 10, tw, h + 32); for (let c = 0; c < tw - 3; c += 6) { g.fillStyle = hsl(35, 12, 62); g.fillRect(x - tw / 2 + c, y - h - 14, 4, 5); } g.fillStyle = '#1c1710'; g.fillRect(x - 1.6, y - h + 2, 3.2, 9); if (fort >= 3) { glow(g, x, y - h - 18, 10, 'rgba(255,150,50,.7)'); dot(g, x, y - h - 17, 2.6, '#ff8a2a'); } }
    if (fort >= 2) { g.fillStyle = lin(g, y + 22, y + 34, '#3a78b8', '#1c4a80'); g.fillRect(0, y + 22, W, 10); g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 1; for (let x = 4; x < W; x += 14) { g.beginPath(); g.moveTo(x, y + 27); g.quadraticCurveTo(x + 3, y + 25, x + 6, y + 27); g.stroke(); } }
  }

  function fortKind(g, lv, hue) { shadow(g, 28); drawFort(g, 64, 56, lv); if (lv >= 1) flag(g, 32, 26 - lv * 2, hsl(hue, 70, 48)); }
  function minesKind(g, lv) { g.fillStyle = '#4a6a3a'; g.fillRect(0, 56, 64, 14); for (let i = 0; i < Math.max(1, lv) * 2; i++) { const x = 8 + (i % 4) * 14 + (i > 3 ? 7 : 0), y = i > 3 ? 62 : 54; dot(g, x, y, 5, '#2a2a30'); dot(g, x - 1.6, y - 1.6, 1.4, 'rgba(255,255,255,.5)'); g.strokeStyle = '#f0b040'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x + 2, y - 4); g.quadraticCurveTo(x + 5, y - 9, x + 8, y - 7); g.stroke(); dot(g, x + 8, y - 7, 1.6, '#ff6a20'); } }
  function tavern(g, lv, hue) { shadow(g, 24); wall(g, 10, 36, 44, 32, 28); poly(g, [[6, 36], [32, 14], [58, 36]], hsl(hue, 40, 30)); rect(g, 26, 56, 10, 12, '#2a1608'); win(g, 14, 44, true); win(g, 46, 44, true); line(g, 54, 40, 62, 40); rect(g, 56, 42, 8, 10, '#8a5a2b'); rect(g, 58, 44, 4, 6, '#f0c040'); g.strokeStyle = INK; g.strokeRect(62, 45, 3, 4); }
  function garrison(g, lv, hue) { shadow(g, 18); wall(g, 22, 22, 20, 46, 35); crenel(g, 22, 22, 20); poly(g, [[20, 22], [32, 8], [44, 22]], hsl(hue, 55, 36)); rect(g, 29, 56, 6, 12, '#2a1608'); rect(g, 31, 34, 2.4, 8, '#1c1710'); flag(g, 32, 10, hsl(hue, 70, 48)); }
  const cache = {};
  function smithy(g, lv, hue) {
    shadow(g, 26); wall(g, 8, 38, 42, 30, 34); poly(g, [[4, 40], [29, 22], [54, 40]], hsl(hue, 42, 30));       // low stone workshop under a castle-tinted roof
    rect(g, 40, 8, 8, 30, '#6b6256'); rect(g, 38, 6, 12, 5, '#4c453c');                                          // chimney
    g.fillStyle = 'rgba(210,205,198,.55)'; for (const [x, y, r] of [[44, 3, 4], [47, 0, 3.4], [43, -3, 3]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    poly(g, [[18, 68], [18, 52], [26, 46], [34, 52], [34, 68]], '#1a0f06');                                        // furnace mouth with a hot glow
    { const fg = g.createRadialGradient(26, 62, 1, 26, 60, 10); fg.addColorStop(0, '#fff2b0'); fg.addColorStop(0.5, '#ff9a2a'); fg.addColorStop(1, 'rgba(255,60,10,0)'); g.fillStyle = fg; g.beginPath(); g.arc(26, 60, 10, 0, 7); g.fill(); }
    poly(g, [[44, 66], [58, 66], [56, 62], [60, 58], [42, 58], [46, 62]], '#4a4e58'); rect(g, 46, 66, 10, 4, '#34363e');   // anvil
    rect(g, 52, 50, 2, 9, '#8a5a2b'); rect(g, 49, 48, 8, 4, '#9aa0aa');                                           // hammer
    g.fillStyle = '#ffd24a'; for (const [x, y] of [[49, 56], [56, 54], [53, 52]]) g.fillRect(x, y, 1.4, 1.4);
    flag(g, 29, 22, hsl(hue, 70, 48));
  }
  function sprite(kind, lv, fac, id) {
    const hue = hueOf(fac), key = [kind, lv, hue, id || ''].join('|');
    return cache[key] || (cache[key] = mk(128, 144, (g) => {
      // every building can come in two pictures: <name> (regular) and <name>_up (upgraded: dwellings at level 2+, town hall level 3+, lodge level 2+, walls and minefield level 2+)
      const UPFROM = { hall: 3, guild: 2, fort: 2, mines: 2 };
      const base = String(id).replace(/_\d$/, ''), isUp = kind === 'dwell' ? /_\d$/.test(String(id)) : (UPFROM[kind] !== undefined && lv >= UPFROM[kind]);
      const nm = kind === 'dwell'
        ? (isUp ? ['buildings/' + base + '_up', 'buildings/' + id, 'buildings/' + base] : ['buildings/' + id, 'buildings/' + base])
        : [...(isUp ? ['buildings/' + fac + '_' + kind + '_up', 'buildings/' + kind + '_up'] : []), 'buildings/' + fac + '_' + kind + '_' + lv, 'buildings/' + kind + '_' + lv, 'buildings/' + fac + '_' + kind, 'buildings/' + kind];
      const ai = typeof Assets !== 'undefined' ? Assets.get(...nm) : null;
      if (ai) { const k = Math.min(128 / ai.width, 144 / ai.height); g.drawImage(ai, 64 - ai.width * k / 2, 144 - ai.height * k, ai.width * k, ai.height * k); return; }
      g.scale(2, 2); const f = { dwell: () => dwelling(g, +(String(id).match(/(\d)(?:_\d)?$/) || [0, 1])[1], lv, hue, id), hall: () => hall(g, Math.max(1, lv), hue), guild: () => guild(g, Math.max(1, lv), hue), market: () => market(g, 1, hue), ship: () => ship(g, 1, hue), fort: () => fortKind(g, lv, hue), mines: () => minesKind(g, lv), tavern: () => tavern(g, 1, hue), garrison: () => garrison(g, 1, hue), smithy: () => smithy(g, 1, hue) }[kind]; if (f) f(); }));
  }
  const url = {};
  const pic = (kind, lv, fac, px = 40, id) => { const key = [kind, lv, fac, id || ''].join('|'); return `<img class="pic" style="width:${px}px;height:${Math.round(px * 1.12)}px;object-fit:contain" alt="" src="${url[key] || (url[key] = sprite(kind, lv, fac, id).toDataURL())}">`; };

  // ---- the full town panorama ----
  // A painted sky, hills and meadow with the castle picture standing in the middle and the 11 building plots on a tidy grid:
  // the 7 creature dwellings in a back row, and the Town Hall, Mage Guild, Marketplace, Shipyard, Tavern, Smithy, Garrison, Fortifications and Minefield in a larger front row.
  const SKY = {
    castle: ['#2c5594', '#a9cdeb'], rampart: ['#2c6a58', '#c2e6a4'], tower: ['#2a3a7c', '#b3c0f0'], inferno: ['#3a0c08', '#cf5a22'], necropolis: ['#1e1a34', '#76668c'],
    dungeon: ['#26143c', '#84508f'], stronghold: ['#50401f', '#dca65e'], fortress: ['#2a4c3c', '#92bf9c'], conflux: ['#1c3c70', '#b0d6f4'],
  };
  const MEADOW = {
    castle: ['#6a9a42', '#2e5226'], rampart: ['#5c9a48', '#1f4426'], tower: ['#6c7c8c', '#2c3646'], inferno: ['#5a2012', '#1c0a06'], necropolis: ['#40404c', '#16161e'],
    dungeon: ['#3e3048', '#171020'], stronghold: ['#82703c', '#3a2c16'], fortress: ['#5e8248', '#223c1a'], conflux: ['#6e8cac', '#2a405c'],
  };
  let scn = false;   // a painted scene is showing: its plots sit a little higher in the front row
  const ROW_BACK = 0.62, ROW_FRONT = 0.925, ROW_FRONT_ART = 0.90, SLOT_NAMES = ['hall', 'guild', 'market', 'ship', 'tavern', 'smithy', 'garrison', 'fort', 'mines'], NSLOTS = 16;
  // where slot i stands: x centre, y of the ground under it, picture width/height (the back row is smaller, so it reads as further away)
  function slotBox(i, W, H) {
    const back = i < 7, n = back ? 7 : 9, j = back ? i : i - 7, ws = back ? Math.min(84, W / 12.4) : Math.min(92, W / 11.2);
    return { x: W * (j + 0.5) / n, base: H * (back ? ROW_BACK : scn ? ROW_FRONT_ART : ROW_FRONT), ws, hs: ws * 1.125, back };
  }
  // which slot is under the pointer (canvas units), or -1
  function slotAt(mx, my, W, H) {
    for (let i = NSLOTS - 1; i >= 0; i--) { const b = slotBox(i, W, H); if (Math.abs(mx - b.x) <= b.ws * 0.58 && my >= b.base - b.hs * 0.98 && my <= b.base + 36) return i; }
    return -1;
  }
  const ghosts = new WeakMap();
  // a washed-out grey copy of a building picture: the plot where it will stand once built
  function ghostOf(spr) {
    let c = ghosts.get(spr); if (c) return c;
    c = mk(spr.width, spr.height, (g) => { g.drawImage(spr, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(70,86,128,.5)'; g.fillRect(0, 0, spr.width, spr.height); });
    ghosts.set(spr, c); return c;
  }
  const roundRect = (g, x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };
  function hammerBadge(g, x, y, locked, pulse) {
    g.save(); g.translate(x, y);
    g.beginPath(); g.arc(0, 0, 11, 0, 7); g.fillStyle = locked ? 'rgba(40,36,34,.92)' : 'rgba(30,20,8,.92)'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = locked ? '#8a8478' : `rgba(240,200,90,${0.7 + 0.3 * pulse})`; g.stroke();
    if (locked) { rect(g, -4.5, -1, 9, 7, '#a8a294', '#140a04'); g.strokeStyle = '#a8a294'; g.lineWidth = 1.8; g.beginPath(); g.arc(0, -1, 3.4, Math.PI, 0); g.stroke(); }
    else { g.rotate(-0.6); rect(g, -1.2, -2, 2.4, 10, '#b07a3a', '#140a04'); rect(g, -5.5, -6, 11, 5, '#c4c8d0', '#140a04'); }
    g.restore();
  }
  function scene(g, t, now, anim, info, W, H, hover = -1) {
    const sceneImg = typeof Assets !== 'undefined' ? (innerWidth < 700 && Assets.get('ui/town_scene_' + t.fac + '_s')) || Assets.get('ui/town_scene_' + t.fac) : null; scn = !!sceneImg;
    const hue = hueOf(t.fac), fort = t.fort || 0, sky = SKY[t.fac] || [hsl(hue, 40, 22), hsl(hue, 45, 62)], mea = MEADOW[t.fac] || [hsl(hue, 30, 38), hsl(hue, 34, 16)];
    const hy = H * 0.5;
    if (sceneImg) g.drawImage(sceneImg, 0, 0, W, H); else {
    // sky, a low sun glow, drifting clouds
    g.fillStyle = (() => { const q = g.createLinearGradient(0, 0, 0, hy + 30); q.addColorStop(0, sky[0]); q.addColorStop(1, sky[1]); return q; })(); g.fillRect(0, 0, W, hy + 30);
    { const sg = g.createRadialGradient(W * 0.16, hy - 10, 4, W * 0.16, hy - 10, 190); sg.addColorStop(0, 'rgba(255,236,170,.55)'); sg.addColorStop(1, 'rgba(255,220,140,0)'); g.fillStyle = sg; g.fillRect(0, 0, W, hy + 30); }
    g.fillStyle = 'rgba(255,255,255,.16)'; for (let i = 0; i < 5; i++) { const cx = ((i * 263 + now * 0.004 * (1 + i * 0.2)) % (W + 260)) - 130, cy = 36 + (i * 53) % 110; for (const [dx, dy, r] of [[0, 0, 26], [28, 6, 20], [-26, 8, 18], [8, -10, 18]]) { g.beginPath(); g.ellipse(cx + dx, cy + dy, r * 1.6, r * 0.62, 0, 0, 7); g.fill(); } }
    // two ranges of hills in the distance, tinted by the sky
    for (const [off, amp, col, ph] of [[hy - 24, 26, mea[1], 1.3], [hy - 4, 16, mea[0], 3.1]]) {
      g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 16) g.lineTo(x, off + Math.sin(x * 0.009 + ph) * amp + Math.sin(x * 0.023 + ph * 2) * amp * 0.35); g.lineTo(W, H); g.closePath();
      g.globalAlpha = 0.9; g.fillStyle = col; g.fill(); g.globalAlpha = 1;
    }
    // the meadow
    g.fillStyle = (() => { const q = g.createLinearGradient(0, hy, 0, H); q.addColorStop(0, mea[0]); q.addColorStop(1, mea[1]); return q; })(); g.fillRect(0, hy + 14, W, H - hy - 14);
    g.fillStyle = 'rgba(255,255,255,.05)'; for (let y = hy + 30; y < H; y += 14) g.fillRect(0, y, W, 2);
    // the castle
    const bgi = typeof Assets !== 'undefined' ? Assets.get('ui/town_' + t.fac) : null, cb = H * ROW_BACK;
    { const sh = g.createRadialGradient(W / 2, cb - 4, 10, W / 2, cb - 4, W * 0.28); sh.addColorStop(0, 'rgba(0,0,0,.42)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); g.save(); g.translate(0, cb - 4); g.scale(1, 0.12); g.translate(0, -(cb - 4)); g.fillStyle = sh; g.fillRect(0, cb - 4 - W * 0.3, W, W * 0.6); g.restore(); }
    if (bgi) { const dw = Math.min(W * 0.52, H * 1.12), dh = dw * bgi.height / bgi.width; g.drawImage(bgi, (W - dw) / 2, cb - dh * 0.95, dw, dh); }
    else { const hallLv = (t.b && t.b.hall) || 0, ks = 120 + hallLv * 22; g.drawImage(Art.obj({ t: 'town', owner: 0 }, t.fac), W / 2 - ks / 2, cb - ks - 10, ks, ks); }
    // the walls grow with the fortifications and stand between the castle and the dwellings
    drawFort(g, W, cb - 30, fort);
    }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < NSLOTS; i++) {
      const b = slotBox(i, W, H), x = b.x, base = b.base, ws = b.ws, hs = b.hs, s = info(t, i), an = anim && anim.slot === i ? anim : null, p = an ? Math.min(1, (now - an.t0) / 1500) : 1, hov = hover === i;
      const kind = i < 7 ? 'dwell' : SLOT_NAMES[i - 7], spr = sprite(kind, s.built ? s.lv : Math.max(1, s.lv || 1), t.fac, s.id), lift = hov ? -3 : 0;
      // the stone pad every plot stands on
      if (!sceneImg || hov) { g.beginPath(); g.ellipse(x, base - 1, ws * 0.62, ws * 0.17, 0, 0, 7); g.fillStyle = hov ? 'rgba(255,226,150,.5)' : 'rgba(210,196,160,.38)'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = hov ? 'rgba(255,214,110,.95)' : 'rgba(30,20,8,.55)'; g.stroke(); }
      if (hov) { const gl = g.createRadialGradient(x, base - hs * 0.4, 4, x, base - hs * 0.4, ws * 0.95); gl.addColorStop(0, 'rgba(255,226,140,.34)'); gl.addColorStop(1, 'rgba(255,226,140,0)'); g.fillStyle = gl; g.fillRect(x - ws, base - hs * 1.3, ws * 2, hs * 1.5); }
      // the building (a faint grey ghost while it is not built yet)
      const hgt = an && an.kind === 'build' ? Math.min(1, p * 1.5) : 1;
      let sc = 1; if (an && an.kind === 'upgrade') sc = 1 + 0.18 * Math.sin(p * Math.PI);
      g.save(); g.translate(x, base + 3 + lift); g.scale(sc, sc);
      if (!s.built && !(an && an.kind === 'build')) { g.globalAlpha = 0.72; g.drawImage(ghostOf(spr), -ws / 2, -hs, ws, hs); }
      else { const sy = (1 - hgt) * spr.height; g.drawImage(spr, 0, sy, spr.width, spr.height - sy, -ws / 2, -hs * hgt, ws, hs * hgt); }
      g.restore();
      if (an && an.kind === 'upgrade') { const rg = g.createRadialGradient(x, base - hs * 0.45, 2, x, base - hs * 0.45, 14 + p * 70); rg.addColorStop(0, `rgba(255,240,150,${0.9 * (1 - p)})`); rg.addColorStop(1, 'rgba(255,200,60,0)'); g.fillStyle = rg; g.beginPath(); g.arc(x, base - hs * 0.45, 14 + p * 70, 0, 7); g.fill(); g.fillStyle = '#ffe680'; for (let k = 0; k < 8; k++) { g.globalAlpha = 1 - p; const sx = x + Math.cos(k * 0.8) * 36 * p, sy2 = base - hs * 0.45 - p * 50 + Math.sin(k * 2.3) * 12; poly(g, [[sx, sy2 - 4], [sx + 1.2, sy2 - 1.2], [sx + 4, sy2], [sx + 1.2, sy2 + 1.2], [sx, sy2 + 4], [sx - 1.2, sy2 + 1.2], [sx - 4, sy2], [sx - 1.2, sy2 - 1.2]], '#ffe680', null); } g.globalAlpha = 1; }
      if (an && an.kind === 'build') { const hx = x + ws * 0.42, hy2 = base - hs * 0.6 * hgt - 4 + Math.sin(now / 90) * 5; g.save(); g.translate(hx, hy2); g.rotate(Math.sin(now / 90) * 0.5); rect(g, -1.6, -2, 3.2, 14, '#8a5a2b'); rect(g, -7, -8, 14, 6, '#8a8a94'); g.restore(); g.fillStyle = 'rgba(210,200,180,.5)'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x - ws * 0.4 + k * ws * 0.2, base - 3 - p * 8 * (k % 2 + 1), 3 + p * 5, 0, 7); g.fill(); } }
      // badges: hammer (can be built) or padlock (needs a bigger Town Hall / no coast), ready recruits on built dwellings
      if (!s.built && !(an && an.kind === 'build')) hammerBadge(g, x + ws * 0.36, base - hs * 0.86, !!(s.locked || s.na), 0.5 + 0.5 * Math.sin(now / 420 + i));
      if (s.built && s.av > 0) { const bx = x - ws * 0.36, by = base - hs * 0.86; g.beginPath(); g.arc(bx, by, 10, 0, 7); g.fillStyle = '#d9a52a'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = '#140a04'; g.stroke(); g.fillStyle = '#1c1204'; g.font = 'bold 11px Cinzel, Georgia, serif'; g.fillText(s.av > 99 ? '99+' : s.av, bx, by + 1); }
      // name plate and level stars
      const nm = s.name || '', pw = Math.max(62, nm.length * 6.6 + 16), py = base + 8;
      g.font = 'bold 11px Cinzel, Georgia, serif'; roundRect(g, x - pw / 2, py, pw, 17, 5); g.fillStyle = hov ? 'rgba(48,32,10,.95)' : 'rgba(14,9,5,.84)'; g.fill(); g.lineWidth = 1.2; g.strokeStyle = s.built ? (hov ? '#ffd766' : '#c9a24a') : 'rgba(255,255,255,.28)'; g.stroke();
      g.fillStyle = s.built ? '#f6ebc8' : '#aaa59a'; g.fillText(nm, x, py + 9);
      if (s.max > 1 && s.built) { g.font = 'bold 11px sans-serif'; g.lineWidth = 3; g.strokeStyle = '#000'; g.fillStyle = '#ffd24a'; const st = '★'.repeat(s.lv) + '☆'.repeat(Math.max(0, s.max - s.lv)); g.strokeText(st, x, py + 25); g.fillText(st, x, py + 25); }
    }
    // soft vignette so the panorama sits in its frame
    if (!sceneImg) { const vg = g.createRadialGradient(W / 2, H / 2, H * 0.55, W / 2, H / 2, W * 0.62); vg.addColorStop(0, 'rgba(8,4,0,0)'); vg.addColorStop(1, 'rgba(8,4,0,.38)'); g.fillStyle = vg; g.fillRect(0, 0, W, H); }
  }
  const reload = () => { for (const k in cache) delete cache[k]; for (const k in url) delete url[k]; };
  return { reload, sprite, pic, scene, drawFort, hueOf, slotAt, slotBox, NSLOTS };
})();
