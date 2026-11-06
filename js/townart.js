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
  function sprite(kind, lv, fac, id) {
    const hue = hueOf(fac), key = [kind, lv, hue, id || ''].join('|');
    return cache[key] || (cache[key] = mk(128, 144, (g) => {
      const nm = kind === 'dwell' ? ['buildings/' + id, 'buildings/' + String(id).replace(/_\d$/, '')] : ['buildings/' + fac + '_' + kind + '_' + lv, 'buildings/' + kind + '_' + lv, 'buildings/' + fac + '_' + kind, 'buildings/' + kind];
      const ai = typeof Assets !== 'undefined' ? Assets.get(...nm) : null;
      if (ai) { const k = Math.min(128 / ai.width, 144 / ai.height); g.drawImage(ai, 64 - ai.width * k / 2, 144 - ai.height * k, ai.width * k, ai.height * k); return; }
      g.scale(2, 2); const f = { dwell: () => dwelling(g, +(String(id).match(/(\d)(?:_\d)?$/) || [0, 1])[1], lv, hue, id), hall: () => hall(g, Math.max(1, lv), hue), guild: () => guild(g, Math.max(1, lv), hue), market: () => market(g, 1, hue), ship: () => ship(g, 1, hue), fort: () => fortKind(g, lv, hue), mines: () => minesKind(g, lv), tavern: () => tavern(g, 1, hue), garrison: () => garrison(g, 1, hue) }[kind]; if (f) f(); }));
  }
  const url = {};
  const pic = (kind, lv, fac, px = 40, id) => { const key = [kind, lv, fac, id || ''].join('|'); return `<img class="pic" style="width:${px}px;height:${Math.round(px * 1.12)}px;object-fit:contain" alt="" src="${url[key] || (url[key] = sprite(kind, lv, fac, id).toDataURL())}">`; };

  // ---- the full town panorama ----
  function scene(g, t, now, anim, info, W, H) {
    const hue = hueOf(t.fac), fort = t.fort || 0, hallLv = (t.b && t.b.hall) || 0;
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#26386a'); sky.addColorStop(0.55, '#b9855a'); sky.addColorStop(1, '#e0a868'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 18; i++) g.fillRect((i * 97) % W, (i * 31) % 50, 1.5, 1.5);
    g.fillStyle = hsl(hue, 18, 26); poly(g, [[0, 120], [60, 60], [120, 100], [200, 50], [290, 105], [380, 66], [470, 108], [560, 58], [650, 100], [720, 70], [780, 112], [780, 130], [0, 130]], g.fillStyle, null);
    g.fillStyle = hsl(hue, 20, 34); poly(g, [[0, 130], [90, 96], [190, 124], [320, 90], [430, 126], [540, 94], [660, 124], [780, 100], [780, 140], [0, 140]], g.fillStyle, null);
    // the keep of the castle: grows with the Town Hall
    const ks = 44 + hallLv * 12; g.drawImage(Art.obj({ t: 'town', owner: 0 }, t.fac), W / 2 - ks / 2, 122 - ks + 8, ks, ks);
    const gy = H - 38;
    drawFort(g, W, gy - 24, fort);
    g.fillStyle = lin(g, gy, H, '#6a9a4a', '#365a28'); g.fillRect(0, gy, W, H - gy);
    g.fillStyle = 'rgba(190,160,110,.55)'; g.fillRect(0, gy + 18, W, 10);
    const base = gy + 30;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < 11; i++) {
      const x = 40 + i * 70, s = info(t, i), an = anim && anim.slot === i ? anim : null, p = an ? Math.min(1, (now - an.t0) / 1500) : 1;
      if (!s.built) { g.setLineDash([4, 4]); g.strokeStyle = 'rgba(255,255,255,.45)'; g.strokeRect(x - 26, base - 44, 52, 44); g.setLineDash([]); g.strokeStyle = '#8a5a2b'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 20, base); g.lineTo(x - 20, base - 24); g.lineTo(x + 20, base - 24); g.lineTo(x + 20, base); g.moveTo(x - 20, base - 12); g.lineTo(x + 20, base - 12); g.stroke(); continue; }
      const kind = i < 7 ? 'dwell' : ['hall', 'guild', 'market', 'ship'][i - 7], spr = sprite(kind, s.lv, t.fac, s.id);
      const hs = 64, ws = 57, hgt = an && an.kind === 'build' ? Math.min(1, p * 1.5) : 1, bob = 0;
      let sc = 1; if (an && an.kind === 'upgrade') sc = 1 + 0.18 * Math.sin(p * Math.PI);
      g.save(); g.beginPath(); g.rect(x - 40, base - hs * 1.4 * hgt - 6, 80, hs * 1.4 * hgt + 14); g.clip();
      g.translate(x, base + 2); g.scale(sc, sc); g.drawImage(spr, -ws / 2, -hs + 0 + bob - 6 + (1 - hgt) * 20, ws, ws * 1.125); g.restore();
      if (an && an.kind === 'upgrade') { const rg = g.createRadialGradient(x, base - 36, 2, x, base - 36, 14 + p * 70); rg.addColorStop(0, `rgba(255,240,150,${0.9 * (1 - p)})`); rg.addColorStop(1, 'rgba(255,200,60,0)'); g.fillStyle = rg; g.beginPath(); g.arc(x, base - 36, 14 + p * 70, 0, 7); g.fill(); g.fillStyle = '#ffe680'; for (let k = 0; k < 8; k++) { g.globalAlpha = 1 - p; const sx = x + Math.cos(k * 0.8) * 36 * p, sy = base - 36 - p * 50 + Math.sin(k * 2.3) * 12; poly(g, [[sx, sy - 4], [sx + 1.2, sy - 1.2], [sx + 4, sy], [sx + 1.2, sy + 1.2], [sx, sy + 4], [sx - 1.2, sy + 1.2], [sx - 4, sy], [sx - 1.2, sy - 1.2]], '#ffe680', null); } g.globalAlpha = 1; }
      if (an && an.kind === 'build') { const hx = x + 28, hy = base - 50 * hgt - 4 + Math.sin(now / 90) * 5; g.save(); g.translate(hx, hy); g.rotate(Math.sin(now / 90) * 0.5); rect(g, -1.6, -2, 3.2, 14, '#8a5a2b'); rect(g, -7, -8, 14, 6, '#8a8a94'); g.restore(); g.fillStyle = 'rgba(210,200,180,.5)'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x - 30 + k * 15, base - 3 - p * 8 * (k % 2 + 1), 3 + p * 5, 0, 7); g.fill(); } }
      if (s.max > 1) { g.font = 'bold 11px sans-serif'; g.fillStyle = '#ffd24a'; g.strokeStyle = '#000'; g.lineWidth = 3; const st = '★'.repeat(s.lv) + '☆'.repeat(s.max - s.lv); g.strokeText(st, x, base + 10); g.fillText(st, x, base + 10); }
    }
    for (let i = 0; i < (t.minel || 0); i++) { const mx = 120 + i * 220; g.fillStyle = '#2a2a30'; g.beginPath(); g.arc(mx, H - 7, 4.2, 0, 7); g.fill(); g.strokeStyle = '#f0b040'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(mx + 2, H - 10); g.lineTo(mx + 5, H - 14); g.stroke(); }
  }
  const reload = () => { for (const k in cache) delete cache[k]; for (const k in url) delete url[k]; };
  return { reload, sprite, pic, scene, drawFort, hueOf };
})();
