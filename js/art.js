'use strict';
// Procedural 2D art: every tile, map object and resource icon is painted with canvas vector code (no image files).
// Sprites are rendered once at 64x64 into offscreen canvases and cached; the map just blits them.
const Art = (() => {
  const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
  const mk = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; };
  const poly = (g, pts, fill, stroke) => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.stroke(); } };
  const lin = (g, x0, y0, x1, y1, a, b) => { const q = g.createLinearGradient(x0, y0, x1, y1); q.addColorStop(0, a); q.addColorStop(1, b); return q; };
  const rect = (g, x, y, w, h, fill, stroke) => { if (fill) { g.fillStyle = fill; g.fillRect(x, y, w, h); } if (stroke) { g.strokeStyle = stroke; g.strokeRect(x, y, w, h); } };
  const ell = (g, x, y, rx, ry, fill) => { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fillStyle = fill; g.fill(); };
  const shadow = (g, x, y, rx, ry) => ell(g, x, y, rx, ry, 'rgba(0,0,0,.35)');
  function h2(a, b) { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  const facHue = (f) => { const k = Object.keys(FACTIONS), i = k.indexOf(f); return i < 0 ? null : (i * 41 + 8) % 360; };

  // ---------- resources (64x64 design space) ----------
  const RES_DRAW = {
    food(g) {   // a golden wheat sheaf
      shadow(g, 32, 54, 20, 4);
      for (const [x, a] of [[22, -0.25], [32, 0], [42, 0.25]]) { g.save(); g.translate(x, 52); g.rotate(a); g.strokeStyle = '#b8872a'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -34); g.stroke();
        for (let k = 0; k < 6; k++) { ell(g, -3.2, -34 + k * 4.2, 2.6, 4.2, '#f0c445'); ell(g, 3.2, -31 + k * 4.2, 2.6, 4.2, '#e2a92b'); } ell(g, 0, -40, 2.6, 4.4, '#f6d45e'); g.restore(); }
      rect(g, 17, 38, 30, 6, '#8a5a2b', '#2b1808');
    },
    gold(g) {
      for (let i = 2; i >= 0; i--) {
        const y = 44 - i * 10;
        ell(g, 32, y + 5, 21, 9, '#7a5410'); ell(g, 32, y, 21, 9, lin(g, 11, y - 9, 53, y + 9, '#ffe27a', '#c8921c'));
        ell(g, 32, y, 14, 5.5, 'rgba(120,80,10,.45)'); ell(g, 32, y - .6, 12, 4.4, lin(g, 20, y - 4, 44, y + 4, '#ffd24a', '#e3a722'));
      }
      g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(24, 22, 6, 2);
    },
    wood(g) {
      const log = (x, y) => { rect(g, x, y, 34, 14, lin(g, x, y, x, y + 14, '#a8743a', '#6b431c')); ell(g, x, y + 7, 5, 7, '#d9a566'); ell(g, x, y + 7, 2.5, 4, '#b07a3c'); g.strokeStyle = '#4b2e12'; g.beginPath(); g.moveTo(x + 6, y + 4); g.lineTo(x + 30, y + 4); g.stroke(); };
      shadow(g, 32, 54, 26, 5); log(12, 38); log(18, 24); log(9, 10 + 14);
    },
    ore(g) {
      shadow(g, 32, 54, 24, 5);
      poly(g, [[8, 52], [14, 30], [30, 24], [38, 52]], lin(g, 8, 24, 38, 52, '#b9c0c8', '#6b737d'), '#2b3037');
      poly(g, [[30, 52], [34, 22], [50, 28], [56, 52]], lin(g, 30, 22, 56, 52, '#d3d9df', '#7a828c'), '#2b3037');
      poly(g, [[20, 40], [26, 18], [40, 14], [46, 40]], lin(g, 20, 14, 46, 40, '#e3e8ed', '#8f98a2'), '#2b3037');
      g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(27, 20, 6, 3);
    },
    mercury(g) {
      shadow(g, 32, 56, 20, 4);
      g.beginPath(); g.arc(32, 40, 18, 0, 7); g.fillStyle = 'rgba(190,225,255,.35)'; g.fill(); g.strokeStyle = '#9fb7cf'; g.lineWidth = 2; g.stroke();
      g.save(); g.beginPath(); g.arc(32, 40, 16.5, 0, 7); g.clip(); rect(g, 12, 38, 40, 24, lin(g, 12, 38, 12, 60, '#cfd9e6', '#6c7f96')); g.restore();
      rect(g, 27, 12, 10, 14, 'rgba(190,225,255,.5)', '#9fb7cf'); rect(g, 25, 8, 14, 6, '#8a5a2b', '#4b2e12');
      g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.ellipse(24, 34, 3, 6, .5, 0, 7); g.fill();
    },
    sulfur(g) {
      shadow(g, 32, 56, 24, 4);
      const c = (x, y, w, h, a, b) => poly(g, [[x, y], [x + w / 2, y - h], [x + w, y]], lin(g, x, y - h, x + w, y, a, b), '#7a5a05');
      c(8, 54, 20, 28, '#fff07a', '#d9a90f'); c(24, 56, 24, 40, '#fff9a3', '#e3b61a'); c(40, 54, 18, 24, '#ffe55a', '#c99a0a');
    },
    crystal(g) {
      shadow(g, 32, 56, 22, 4);
      const c = (x, base, w, h, hue) => { poly(g, [[x, base], [x + 2, base - h + 10], [x + w / 2, base - h], [x + w - 2, base - h + 10], [x + w, base]], lin(g, x, base - h, x + w, base, hsl(hue, 80, 78), hsl(hue, 70, 38)), hsl(hue, 70, 22)); g.strokeStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.moveTo(x + w / 2, base - h); g.lineTo(x + w / 2, base); g.stroke(); };
      c(8, 54, 18, 28, 195); c(36, 54, 18, 30, 205); c(20, 56, 22, 46, 190);
    },
    gems(g) {
      shadow(g, 32, 56, 20, 4);
      const hue = 335, P = [[32, 54], [12, 28], [20, 14], [44, 14], [52, 28]];
      poly(g, P, lin(g, 12, 14, 52, 54, hsl(hue, 85, 72), hsl(hue, 80, 36)), hsl(hue, 80, 20));
      poly(g, [[12, 28], [52, 28], [32, 54]], hsl(hue, 80, 45, .55)); poly(g, [[20, 14], [26, 28], [32, 14], [38, 28], [44, 14]], 'rgba(255,255,255,.28)');
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(12, 28); g.lineTo(52, 28); g.moveTo(26, 28); g.lineTo(32, 54); g.moveTo(38, 28); g.lineTo(32, 54); g.stroke();
    },
  };
  const resCache = {};
  function resCanvas(k, size = 48) { const key = k + size; return resCache[key] || (resCache[key] = mk(size, size, (g) => { const ai = typeof Assets !== 'undefined' ? Assets.get('icons/res_' + k) : null; if (ai) { g.drawImage(ai, 0, 0, size, size); return; } g.scale(size / 64, size / 64); g.lineWidth = 1.5; (RES_DRAW[k] || RES_DRAW.gold)(g); })); }
  const resUrl = {};
  function resImg(k) { return `<img class="ri" alt="${k}" src="${resUrl[k] || (resUrl[k] = resCanvas(k).toDataURL())}">`; }

  // ---------- object sprites ----------
  const stone = (g, x, y, w, h) => rect(g, x, y, w, h, lin(g, x, y, x + w, y, '#cfc7b8', '#8a8274'), '#3c372f');
  const crenels = (g, x, y, w) => { for (let i = 0; i < w; i += 6) rect(g, x + i, y - 4, 4, 5, '#9a9284', '#3c372f'); };
  const flag = (g, x, y, col) => { g.strokeStyle = '#2b2218'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 14); g.stroke(); poly(g, [[x, y - 14], [x + 10, y - 11], [x, y - 8]], col); };
  const OBJ = {
    town(g, o, hue) {
      const roof = hue === null ? '#7d776c' : hsl(hue, 62, 42), roof2 = hue === null ? '#5b564d' : hsl(hue, 60, 28);
      shadow(g, 32, 56, 28, 5);
      stone(g, 22, 24, 20, 30); stone(g, 6, 30, 14, 24); stone(g, 44, 30, 14, 24);
      poly(g, [[19, 26], [45, 26], [32, 4]], lin(g, 19, 4, 45, 26, roof, roof2), '#2b2218');
      poly(g, [[3, 32], [23, 32], [13, 14]], lin(g, 3, 14, 23, 32, roof, roof2), '#2b2218');
      poly(g, [[41, 32], [61, 32], [51, 14]], lin(g, 41, 14, 61, 32, roof, roof2), '#2b2218');
      g.beginPath(); g.moveTo(27, 54); g.lineTo(27, 44); g.arc(32, 44, 5, Math.PI, 0); g.lineTo(37, 54); g.closePath(); g.fillStyle = '#2a1a0c'; g.fill();
      for (const [x, y] of [[30, 30], [10, 40], [50, 40], [30, 20]]) rect(g, x, y, 4, 5, '#f4d66a');
      flag(g, 32, 6, hue === null ? '#bbb' : '#e0443a');
    },
    fort(g, o, hue) {
      shadow(g, 32, 56, 28, 5);
      stone(g, 6, 34, 52, 20); crenels(g, 6, 34, 52);
      stone(g, 4, 22, 16, 32); crenels(g, 4, 22, 16); stone(g, 44, 22, 16, 32); crenels(g, 44, 22, 16);
      g.beginPath(); g.moveTo(26, 54); g.lineTo(26, 42); g.arc(32, 42, 6, Math.PI, 0); g.lineTo(38, 54); g.closePath(); g.fillStyle = '#2a1a0c'; g.fill();
      for (let i = 27; i < 38; i += 3) { g.strokeStyle = '#6b5a3a'; g.beginPath(); g.moveTo(i, 40); g.lineTo(i, 54); g.stroke(); }
      for (const x of [10, 50]) rect(g, x, 30, 3, 7, '#1c1710');
      flag(g, 12, 18, '#c9a227');
    },
    dwelling(g, o, hue) {
      const roof = hue === null ? '#8a7a4a' : hsl(hue, 50, 40);
      shadow(g, 32, 56, 24, 5);
      rect(g, 14, 32, 36, 22, lin(g, 14, 32, 14, 54, '#b98a50', '#7a5428'), '#3a2812');
      for (let x = 20; x < 50; x += 8) { g.strokeStyle = 'rgba(60,35,10,.5)'; g.beginPath(); g.moveTo(x, 32); g.lineTo(x, 54); g.stroke(); }
      poly(g, [[8, 36], [56, 36], [32, 10]], lin(g, 8, 10, 56, 36, roof, '#3a2c14'), '#2b2218');
      rect(g, 27, 40, 10, 14, '#2a1a0c'); rect(g, 40, 38, 6, 6, '#f4d66a');
      for (let i = 0; i < (o.tier || 1); i++) ell(g, 32 - (o.tier - 1) * 3.5 + i * 7, 8, 2.6, 2.6, '#ffd24a');
    },
    mine(g, o) {
      shadow(g, 32, 56, 28, 5);
      g.beginPath(); g.moveTo(2, 56); g.quadraticCurveTo(10, 14, 34, 12); g.quadraticCurveTo(58, 14, 62, 56); g.closePath(); g.fillStyle = lin(g, 0, 12, 0, 56, '#8a7e6c', '#4a4338'); g.fill(); g.strokeStyle = '#2b2620'; g.lineWidth = 1.5; g.stroke();
      g.beginPath(); g.moveTo(16, 56); g.lineTo(16, 36); g.quadraticCurveTo(16, 26, 28, 26); g.quadraticCurveTo(40, 26, 40, 36); g.lineTo(40, 56); g.closePath(); g.fillStyle = '#120c06'; g.fill();
      g.strokeStyle = '#8a5a2b'; g.lineWidth = 3; g.beginPath(); g.moveTo(14, 56); g.lineTo(14, 35); g.quadraticCurveTo(14, 24, 28, 24); g.quadraticCurveTo(42, 24, 42, 35); g.lineTo(42, 56); g.stroke();
      g.save(); g.translate(40, 34); g.scale(.55, .55); (RES_DRAW[o.kind] || RES_DRAW.gold)(g); g.restore();
    },
    farm(g, o) {   // a barn, a haystack and a ploughed field
      shadow(g, 32, 56, 28, 5);
      for (let i = 0; i < 4; i++) rect(g, 6 + i * 14, 46, 10, 9, i % 2 ? '#7a5a2a' : '#8d6a32', '#3a2a12');
      rect(g, 14, 26, 30, 22, lin(g, 14, 26, 14, 48, '#b5452f', '#7a2a1c'), '#2b1208');
      poly(g, [[10, 28], [29, 10], [48, 28]], lin(g, 10, 10, 48, 28, '#8a4a2a', '#4a2412'), '#2b1208');
      rect(g, 25, 34, 8, 14, '#2a1a0c'); ell(g, 52, 44, 9, 8, '#e2b83c'); ell(g, 52, 40, 6, 5, '#f4d45e');
    },
    deposit(g, o) {   // a rock outcrop with a glint of the resource inside
      shadow(g, 32, 56, 26, 5);
      poly(g, [[8, 54], [14, 30], [26, 20], [40, 24], [54, 36], [56, 54]], lin(g, 8, 20, 56, 54, '#9a9284', '#4e483e'), '#2a251d');
      poly(g, [[20, 54], [26, 36], [38, 34], [46, 54]], 'rgba(0,0,0,.18)');
      g.save(); g.translate(18, 12); g.scale(.6, .6); (RES_DRAW[o.kind] || RES_DRAW.gold)(g); g.restore();
      for (const [x, y] of [[16, 40], [44, 42], [32, 28]]) ell(g, x, y, 2, 2, 'rgba(255,255,255,.8)');
    },
    site(g, o) {   // a building site: stakes, a plank and a hammer
      shadow(g, 32, 56, 24, 4);
      rect(g, 10, 44, 44, 10, '#8d6a32', '#3a2a12'); for (const x of [12, 26, 40, 52]) rect(g, x, 26, 3, 28, '#6a4a22', '#2b1808');
      poly(g, [[10, 30], [54, 30], [54, 36], [10, 36]], '#b08a48', '#3a2a12');
      g.fillStyle = '#e8d9ac'; g.font = 'bold 18px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🔨', 32, 16);
    },
    pile(g, o) { (RES_DRAW[o.kind] || RES_DRAW.gold)(g); },
    chest(g) {
      shadow(g, 32, 54, 24, 5);
      rect(g, 10, 30, 44, 24, lin(g, 10, 30, 10, 54, '#a8743a', '#5e3a14'), '#2b1808');
      g.beginPath(); g.moveTo(10, 30); g.quadraticCurveTo(32, 8, 54, 30); g.closePath(); g.fillStyle = lin(g, 0, 14, 0, 30, '#c58c46', '#7d5220'); g.fill(); g.strokeStyle = '#2b1808'; g.lineWidth = 1.5; g.stroke();
      rect(g, 28, 22, 8, 32, '#e3b840', '#5c430b'); rect(g, 10, 36, 44, 4, '#e3b840'); rect(g, 29, 34, 6, 8, '#ffe58a', '#5c430b');
    },
    art(g, o) {
      const hue = Math.floor(h2((o.x || 0) + 5, (o.y || 0) + 9) * 360);
      shadow(g, 32, 56, 18, 4); poly(g, [[18, 56], [46, 56], [42, 46], [22, 46]], lin(g, 18, 46, 46, 56, '#9a9284', '#5b564d'), '#2b2620');
      const r = g.createRadialGradient(32, 30, 2, 32, 30, 22); r.addColorStop(0, '#fff'); r.addColorStop(.35, hsl(hue, 90, 65)); r.addColorStop(1, hsl(hue, 90, 50, 0));
      g.fillStyle = r; g.beginPath(); g.arc(32, 30, 22, 0, 7); g.fill();
      g.beginPath(); g.arc(32, 32, 10, 0, 7); g.fillStyle = lin(g, 22, 22, 42, 42, hsl(hue, 90, 80), hsl(hue, 80, 38)); g.fill(); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(28, 28, 3, 0, 7); g.fill();
    },
    lair(g) {
      shadow(g, 32, 57, 29, 5);
      g.beginPath(); g.moveTo(2, 58); g.lineTo(14, 26); g.lineTo(24, 32); g.lineTo(36, 6); g.lineTo(46, 26); g.lineTo(52, 22); g.lineTo(62, 58); g.closePath(); g.fillStyle = lin(g, 0, 6, 0, 58, '#6a5f52', '#2e2923'); g.fill(); g.strokeStyle = '#14100c'; g.lineWidth = 1.6; g.stroke();
      poly(g, [[36, 6], [31, 16], [34, 14], [37, 19], [40, 13], [43, 17]], '#f2f6fb');
      g.beginPath(); g.moveTo(16, 58); g.lineTo(16, 44); g.quadraticCurveTo(32, 26, 48, 44); g.lineTo(48, 58); g.closePath(); g.fillStyle = '#0b0605'; g.fill(); g.strokeStyle = '#3a1a0c'; g.lineWidth = 2; g.stroke();
      for (const x of [26, 38]) { g.beginPath(); g.ellipse(x, 44, 3.2, 2, 0, 0, 7); g.fillStyle = '#ff3a1a'; g.fill(); g.beginPath(); g.ellipse(x, 44, .8, 2, 0, 0, 7); g.fillStyle = '#220'; g.fill(); }
      for (let i = 0; i < 4; i++) { poly(g, [[24 + i * 5, 52], [25.5 + i * 5, 56], [27 + i * 5, 52]], '#f3ecd8'); }
      for (const [x, y, r] of [[8, 56, 5], [13, 54, 4], [5, 53, 3]]) { ell(g, x, y, r, r * .5, '#e3b840'); }
      ell(g, 56, 55, 5, 2.6, '#e3b840'); ell(g, 52, 56, 3, 1.6, '#c8921c');
      poly(g, [[50, 16], [56, 9], [62, 14], [57, 13]], '#c0301c'); poly(g, [[50, 16], [46, 10], [53, 13]], '#8a1c10');
    },
    merchant(g) {
      shadow(g, 32, 56, 26, 5);
      poly(g, [[6, 54], [58, 54], [32, 12]], '#f0e6d2', '#3a2812');
      for (const [a, b, c] of [[6, 20, 54], [20, 32, 54], [32, 44, 54], [44, 58, 54]]) { if (a === 20 || a === 44) continue; }
      poly(g, [[6, 54], [20, 54], [32, 12]], '#b83a2e'); poly(g, [[32, 12], [32, 54], [44, 54]], '#b83a2e');
      g.beginPath(); g.moveTo(26, 54); g.lineTo(32, 36); g.lineTo(38, 54); g.fillStyle = '#2a1a0c'; g.fill();
      flag(g, 32, 14, '#ffd24a'); ell(g, 52, 52, 5, 3, '#e3b840');
    },
    wreck(g) {
      shadow(g, 32, 56, 26, 5);
      poly(g, [[6, 40], [58, 36], [50, 54], [14, 56]], lin(g, 6, 36, 58, 56, '#8a5a2b', '#4a2d12'), '#2b1808');
      for (const x of [16, 26, 36, 46]) { g.strokeStyle = 'rgba(30,15,5,.6)'; g.beginPath(); g.moveTo(x, 40); g.lineTo(x - 2, 55); g.stroke(); }
      g.strokeStyle = '#6b431c'; g.lineWidth = 3; g.beginPath(); g.moveTo(34, 38); g.lineTo(40, 14); g.stroke(); poly(g, [[40, 14], [52, 24], [38, 28]], '#d8d0bc', '#6a6355');
      ell(g, 20, 52, 8, 2.5, 'rgba(255,255,255,.4)');
    },
    spring(g) {
      shadow(g, 32, 56, 24, 5);
      ell(g, 32, 50, 24, 9, '#8a8274'); ell(g, 32, 48, 21, 7, '#4aa0e0'); ell(g, 32, 47, 14, 4, 'rgba(255,255,255,.35)');
      rect(g, 28, 28, 8, 20, lin(g, 28, 0, 36, 0, '#b8b0a2', '#7a7264'), '#3c372f');
      g.strokeStyle = 'rgba(120,200,255,.9)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(32, 28); g.quadraticCurveTo(22, 14, 16, 40); g.moveTo(32, 28); g.quadraticCurveTo(42, 14, 48, 40); g.moveTo(32, 28); g.lineTo(32, 18); g.stroke();
    },
    resobj(g, o) {
      shadow(g, 32, 56, 22, 5);
      if (o.kind === 'windmill') {
        poly(g, [[22, 56], [42, 56], [38, 26], [26, 26]], lin(g, 22, 0, 42, 0, '#e8dcc0', '#a89a78'), '#3c3220'); poly(g, [[20, 28], [44, 28], [32, 14]], '#a0442a', '#2b1808');
        g.strokeStyle = '#6b431c'; g.lineWidth = 3; g.fillStyle = '#f0e8d0';
        for (let i = 0; i < 4; i++) { g.save(); g.translate(32, 26); g.rotate(i * Math.PI / 2 + .5); g.fillRect(-3, -26, 6, 24); g.strokeRect(-3, -26, 6, 24); g.restore(); }
        rect(g, 29, 44, 6, 10, '#2a1a0c');
      } else if (o.kind === 'waterwheel') {
        rect(g, 6, 44, 52, 12, lin(g, 0, 44, 0, 56, '#4aa0e0', '#2a6aa8')); rect(g, 10, 26, 22, 24, '#b98a50', '#3a2812'); poly(g, [[6, 28], [36, 28], [21, 12]], '#a0442a', '#2b1808');
        g.strokeStyle = '#6b431c'; g.lineWidth = 3; g.beginPath(); g.arc(44, 38, 14, 0, 7); g.stroke(); g.lineWidth = 2; for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(44, 38); g.lineTo(44 + Math.cos(i * .785) * 14, 38 + Math.sin(i * .785) * 14); g.stroke(); }
      } else {
        ell(g, 32, 46, 26, 10, '#3f7a35'); for (let i = 0; i < 12; i++) { const x = 10 + h2(i, 3) * 44, y = 30 + h2(i, 7) * 20; g.fillStyle = ['#ffd24a', '#ff7aa8', '#fff', '#c98aff'][i % 4]; g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fill(); g.fillStyle = '#c0501a'; g.beginPath(); g.arc(x, y, 1.1, 0, 7); g.fill(); }
      }
    },
    stone(g) {
      shadow(g, 32, 56, 20, 4); poly(g, [[16, 56], [20, 12], [44, 12], [48, 56]], lin(g, 16, 12, 48, 56, '#a9a396', '#5e584c'), '#2b2620');
      g.strokeStyle = '#7ad6ff'; g.lineWidth = 2; g.beginPath(); g.moveTo(26, 22); g.lineTo(38, 22); g.moveTo(24, 32); g.lineTo(32, 32); g.lineTo(36, 40); g.moveTo(26, 46); g.lineTo(38, 46); g.stroke();
    },
    shrine(g) {
      shadow(g, 32, 56, 24, 5); rect(g, 10, 50, 44, 6, '#9a9284', '#3c372f');
      for (const x of [14, 44]) rect(g, x, 20, 8, 30, lin(g, x, 0, x + 8, 0, '#d8d0bc', '#8a8274'), '#3c372f');
      poly(g, [[8, 22], [56, 22], [32, 6]], '#8a8274', '#3c372f');
      const r = g.createRadialGradient(32, 38, 1, 32, 38, 14); r.addColorStop(0, '#fff'); r.addColorStop(.4, '#c98aff'); r.addColorStop(1, 'rgba(160,80,255,0)'); g.fillStyle = r; g.beginPath(); g.arc(32, 38, 14, 0, 7); g.fill();
    },
    tower(g) {
      shadow(g, 32, 56, 18, 4); poly(g, [[22, 56], [42, 56], [38, 22], [26, 22]], lin(g, 22, 0, 42, 0, '#cfc7b8', '#7a7264'), '#3c372f'); crenels(g, 24, 22, 16);
      poly(g, [[20, 20], [44, 20], [32, 0]], '#4a5a9a', '#232a4a'); rect(g, 29, 32, 6, 8, '#f4d66a'); rect(g, 29, 46, 6, 10, '#2a1a0c'); ell(g, 32, 12, 3, 3, '#7ad6ff');
    },
    bank(g, o) {
      shadow(g, 32, 56, 24, 5);
      if (o.kind === 'crypt') {
        g.beginPath(); g.moveTo(10, 56); g.lineTo(10, 28); g.quadraticCurveTo(32, 2, 54, 28); g.lineTo(54, 56); g.closePath(); g.fillStyle = lin(g, 0, 10, 0, 56, '#7a766c', '#3c3a34'); g.fill(); g.strokeStyle = '#1c1b18'; g.lineWidth = 1.5; g.stroke();
        g.beginPath(); g.moveTo(24, 56); g.lineTo(24, 38); g.arc(32, 38, 8, Math.PI, 0); g.lineTo(40, 56); g.fillStyle = '#0c0a08'; g.fill(); rect(g, 30, 10, 4, 14, '#bfb8a6'); rect(g, 26, 14, 12, 4, '#bfb8a6');
      } else if (o.kind === 'utopia') {
        rect(g, 12, 32, 40, 24, lin(g, 12, 32, 12, 56, '#f0e2a8', '#b09848'), '#5c430b'); g.beginPath(); g.arc(32, 32, 22, Math.PI, 0); g.fillStyle = lin(g, 10, 10, 54, 32, '#ffe27a', '#c8921c'); g.fill(); g.strokeStyle = '#5c430b'; g.stroke();
        rect(g, 27, 40, 10, 16, '#3a2812'); ell(g, 32, 8, 2.5, 3.5, '#ffe27a');
      } else {
        const bx = (x, y, w, h) => rect(g, x, y, w, h, lin(g, x, y, x + w, y + h, '#b98a50', '#7a5428'), '#3a2812');
        bx(8, 40, 22, 16); bx(32, 40, 22, 16); bx(18, 24, 26, 16); g.strokeStyle = '#3a2812'; for (const [x, y, w, h] of [[8, 40, 22, 16], [32, 40, 22, 16], [18, 24, 26, 16]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y + h); g.moveTo(x + w, y); g.lineTo(x, y + h); g.stroke(); }
      }
    },
    mono(g) {
      shadow(g, 32, 56, 22, 5);
      const r = g.createRadialGradient(32, 32, 3, 32, 32, 24); r.addColorStop(0, '#fff'); r.addColorStop(.35, '#b070ff'); r.addColorStop(1, 'rgba(120,40,220,0)'); g.fillStyle = r; g.beginPath(); g.arc(32, 32, 24, 0, 7); g.fill();
      g.strokeStyle = '#8a8274'; g.lineWidth = 7; g.beginPath(); g.ellipse(32, 34, 18, 22, 0, 0, 7); g.stroke(); g.strokeStyle = '#cfc7b8'; g.lineWidth = 2; g.stroke();
    },
    seer(g) {
      shadow(g, 32, 56, 22, 5); rect(g, 16, 34, 32, 22, lin(g, 16, 34, 16, 56, '#b98a50', '#7a5428'), '#3a2812');
      poly(g, [[10, 38], [54, 38], [32, 14]], '#5a3a8a', '#2a1a4a'); rect(g, 28, 44, 8, 12, '#2a1a0c'); ell(g, 32, 24, 4, 4, '#c98aff'); ell(g, 31, 23, 1.5, 1.5, '#fff');
    },
  };
  const spriteCache = {};
  const contain = (g, img, w, h) => { const k = Math.min(w / img.width, h / img.height); g.drawImage(img, w / 2 - img.width * k / 2, h - img.height * k, img.width * k, img.height * k); };
  // map objects without their own picture borrow a close one from the pack (replace by adding art/objects/<type>.webp)
  const OBJ_ALIAS = { obelisk: 'stone', prison: 'tower', questgate: 'fort', keytent: 'merchant', gate: 'mono' };
  function obj(o, fac) {
    if (typeof Assets !== 'undefined') {
      const f2 = fac || o.fac || '', kd = o.kind ? '_' + o.kind : '';
      const names = [...(o.t === 'dwelling' ? ['dwelling_' + (o.cid || (o.fac + o.tier))] : []), o.t + kd + (o.t === 'town' || o.t === 'dwelling' ? '_' + f2 : ''), o.t + kd, o.t, ...(OBJ_ALIAS[o.t] ? [OBJ_ALIAS[o.t]] : [])].map(n => 'objects/' + n);
      const ai = Assets.get(...names);
      if (ai) return spriteCache['A|' + names[0]] || (spriteCache['A|' + names[0]] = mk(128, 128, (g) => contain(g, ai, 128, 128)));
    }
    const draw = OBJ[o.t]; if (!draw) return null;
    const hue = facHue(fac || o.fac);
    const key = [o.t, o.kind || '', hue, o.tier || '', o.t === 'art' ? o.art : ''].join('|');
    return spriteCache[key] || (spriteCache[key] = mk(64, 64, (g) => { g.lineWidth = 1.5; g.lineJoin = 'round'; draw(g, o, hue); }));
  }
  const boatC0 = () => spriteCache.boat || (spriteCache.boat = mk(64, 64, (g) => {
    g.lineJoin = 'round'; g.lineWidth = 1.5; ell(g, 32, 54, 26, 5, 'rgba(255,255,255,.35)');
    poly(g, [[6, 40], [58, 40], [50, 54], [14, 54]], lin(g, 0, 40, 0, 54, '#a8743a', '#5e3a14'), '#2b1808');
    g.strokeStyle = '#4a2d12'; g.lineWidth = 3; g.beginPath(); g.moveTo(32, 42); g.lineTo(32, 6); g.stroke(); g.lineWidth = 1.5;
    poly(g, [[34, 8], [56, 36], [34, 36]], '#f5efe0', '#6a6355'); poly(g, [[30, 12], [12, 36], [30, 36]], '#e5dcc4', '#6a6355'); flag(g, 32, 8, '#e0443a');
  }));

  const boatC = () => { const ai = typeof Assets !== 'undefined' ? Assets.get('objects/boat') : null; return ai ? (spriteCache.boatA || (spriteCache.boatA = mk(64, 64, (g) => contain(g, ai, 64, 64)))) : boatC0(); };
  // ---------- terrain (pointy-top hexes, odd-r offset: odd rows are shifted half a hex to the right) ----------
  const HR = 32 / Math.sqrt(3);
  const hexPt = (cx, cy, R, i) => { const a = (60 * i - 30) * Math.PI / 180; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; };
  function hexPath(g, cx, cy, R) { g.beginPath(); for (let i = 0; i < 6; i++) { const p = hexPt(cx, cy, R, i); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); } g.closePath(); }
  function hexEdge(g, cx, cy, R, i) { const a = hexPt(cx, cy, R, i), b = hexPt(cx, cy, R, (i + 1) % 6); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
  // ---- continuous painted ground ----
  // One big seamless picture per ground kind is laid across the whole map in world coordinates (art/terrain/tex_<kind>), so neighbouring
  // tiles of the same kind join with no seam and nothing is stamped hex by hex. Different kinds blend softly; shores get shallows and foam.
  const GROUND = { grass: ['terrain/tex_grass', 150], forest: ['terrain/tex_forest', 120], mountain: ['terrain/tex_mountain', 160], water: ['terrain/tex_water', 190], sand: ['terrain/tex_sand', 170],
    biome_desert: ['terrain/biome_desert', 130], biome_snow: ['terrain/biome_snow', 130], biome_swamp: ['terrain/biome_swamp', 130], biome_lava: ['terrain/biome_lava', 130] };
  const patCache = {};
  function groundPat(c, key) {
    if (patCache[key]) return patCache[key];
    const spec = GROUND[key], im = spec && Assets.get(spec[0]); if (!im) return null;
    // mirrored 2x2 copies: the repeat can never show a seam, even if the picture is not perfectly tileable
    const w = im.width, h = im.height, m = document.createElement('canvas'); m.width = w * 2; m.height = h * 2; const g = m.getContext('2d');
    g.drawImage(im, 0, 0); g.save(); g.translate(w * 2, 0); g.scale(-1, 1); g.drawImage(im, 0, 0); g.restore();
    g.save(); g.translate(0, h * 2); g.scale(1, -1); g.drawImage(im, 0, 0); g.restore(); g.save(); g.translate(w * 2, h * 2); g.scale(-1, -1); g.drawImage(im, 0, 0); g.restore();
    const pat = c.createPattern(m, 'repeat'); if (pat.setTransform) pat.setTransform(new DOMMatrix().scale(spec[1] * 2 / (w * 2)));
    return (patCache[key] = pat);
  }
  const sstep = (v) => v * v * (3 - 2 * v);
  function vnoise(x, y) { const ix = Math.floor(x), iy = Math.floor(y), fx = sstep(x - ix), fy = sstep(y - iy); const a = h2(ix, iy), b = h2(ix + 1, iy), c2 = h2(ix, iy + 1), d = h2(ix + 1, iy + 1); return (a + (b - a) * fx) * (1 - fy) + (c2 + (d - c2) * fx) * fy; }
  const KIND = { [T.GRASS]: 'grass', [T.FOREST]: 'forest', [T.MOUNT]: 'mountain', [T.WATER]: 'water', [T.SAND]: 'sand', [T.ROAD]: 'grass' };
  function groundKey(G, x, y) {
    const t = G.tiles[y][x], bm = G.biome && G.biome[y] ? G.biome[y][x] : 0;
    if (bm && (t === T.GRASS || t === T.FOREST || t === T.SAND || t === T.ROAD)) { const bn = 'biome_' + ['', 'desert', 'snow', 'swamp', 'lava'][bm]; if (GROUND[bn] && Assets.get(GROUND[bn][0])) return bn; }
    return KIND[t];
  }
  // soft gradient strip along one hex edge: the given picture fading out over `D` world units (made of stacked, growing strips)
  function edgeFade(c, pat, cxp, cyp, i, D, steps, a, fill) {
    const p0 = hexPt(cxp, cyp, HR, i), p1 = hexPt(cxp, cyp, HR, (i + 1) % 6), mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2, nx = cxp - mx, ny = cyp - my, nl = Math.hypot(nx, ny) || 1, ux = nx / nl, uy = ny / nl;
    for (let j = steps; j >= 1; j--) {
      const d = D * j / steps; c.save(); c.beginPath(); c.moveTo(p0[0], p0[1]); c.lineTo(p1[0], p1[1]); c.lineTo(p1[0] + ux * d, p1[1] + uy * d); c.lineTo(p0[0] + ux * d, p0[1] + uy * d); c.closePath(); c.clip();
      c.globalAlpha = a; c.fillStyle = pat || fill; c.fillRect(cxp - HR - 2, cyp - HR - 2, HR * 2 + 4, HR * 2 + 4); c.restore();
    }
  }
  function bigGround(c, gk, t, x, y, cxp, cyp, G) {
    const pat = groundPat(c, gk); if (!pat) return false;
    c.save(); hexPath(c, cxp, cyp, HR + .9); c.clip();
    c.fillStyle = pat; c.fillRect(cxp - HR - 2, cyp - HR - 2, HR * 2 + 4, HR * 2 + 4);
    // slow colour drift across the map, so the repeating picture is never noticed
    const nz = vnoise(x * 0.23 + 7, y * 0.27 + 3) - 0.5;
    c.fillStyle = nz > 0 ? 'rgba(255,246,200,' + (nz * 0.2).toFixed(3) + ')' : 'rgba(6,16,30,' + (-nz * 0.26).toFixed(3) + ')'; c.fillRect(cxp - HR - 2, cyp - HR - 2, HR * 2 + 4, HR * 2 + 4);
    const nb = hexNb(x, y);
    for (let i = 0; i < 6; i++) {
      const p = nb[i]; if (p[0] < 0 || p[1] < 0 || p[0] >= G.W || p[1] >= G.H) continue;
      const nk = groundKey(G, p[0], p[1]); if (!nk || nk === gk) continue;
      if (t === T.WATER) { edgeFade(c, null, cxp, cyp, i, 13, 6, 0.07, '#7fd6d8'); continue; }       // shallows
      if (nk === 'water') continue;
      const np = groundPat(c, nk); if (np) edgeFade(c, np, cxp, cyp, i, 11, 6, 0.085);               // land blends into land
    }
    c.restore();
    if (t === T.WATER) {     // foam along the shore, a little wavy so it follows no hex edge
      c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
      for (let i = 0; i < 6; i++) {
        const p = nb[i]; if (p[0] < 0 || p[1] < 0 || p[0] >= G.W || p[1] >= G.H || G.tiles[p[1]][p[0]] === T.WATER) continue;
        const a = hexPt(cxp, cyp, HR - 0.8, i), b = hexPt(cxp, cyp, HR - 0.8, (i + 1) % 6), ex = b[0] - a[0], ey = b[1] - a[1], el = Math.hypot(ex, ey) || 1, qx = -ey / el, qy = ex / el, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        const pts = []; for (let k = 0; k <= 8; k++) { const f = k / 8, w = (vnoise(mx * 0.3 + f * 2.4, my * 0.3) - 0.5) * 4.2; pts.push([a[0] + ex * f + qx * w, a[1] + ey * f + qy * w]); }
        for (const [lw, col] of [[7, 'rgba(190,232,246,.28)'], [3.2, 'rgba(236,250,255,.62)'], [1.1, 'rgba(255,255,255,.9)']]) { c.lineWidth = lw; c.strokeStyle = col; c.beginPath(); pts.forEach((q, k) => (k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.stroke(); }
      }
      c.restore();
    }
    return true;
  }
  function tile(c, t, x, y, G) {
    const cxp = (x + .5 + (y & 1) * .5) * 32, cyp = y * HR * 1.5 + HR, px = cxp - 16, py = cyp - 16, r = (i) => h2(x * 31 + i * 17, y * 57 + i * 11);
    if (typeof Assets !== 'undefined') {
      const tn0 = { [T.GRASS]: 'grass', [T.FOREST]: 'forest', [T.MOUNT]: 'mountain', [T.WATER]: 'water', [T.ROAD]: 'road', [T.SAND]: 'sand' }[t], tn = (t === T.ROAD && Assets.get('roads/dirt_straight')) ? 'grass' : tn0, bm = G && G.biome && G.biome[y] ? G.biome[y][x] : 0, bn = bm && (t === T.GRASS || t === T.FOREST || t === T.SAND || t === T.ROAD) ? 'biome_' + ['', 'desert', 'snow', 'swamp', 'lava'][bm] : null, ta = bn && !(t === T.ROAD && !Assets.get('roads/dirt_straight')) && Assets.get('terrain/' + bn) ? Assets.get('terrain/' + bn) : Assets.get('terrain/' + tn + '_' + (1 + Math.floor(r(0) * 4)), 'terrain/' + tn);
      if (G && G.tiles && !(t === T.ROAD && !Assets.get('roads/dirt_straight'))) { const gk = groundKey(G, x, y); if (gk && bigGround(c, gk, t, x, y, cxp, cyp, G)) return; }
      if (ta) {
        const sw = Math.min(ta.width, 100), sh = Math.min(ta.height, Math.round(sw * (HR * 2 + 2) / 34)), sx = r(5) * (ta.width - sw), sy = r(6) * (ta.height - sh);
        c.save(); hexPath(c, cxp, cyp, HR + .7); c.clip(); c.drawImage(ta, sx, sy, sw, sh, cxp - 17, cyp - HR - 1, 34, HR * 2 + 2);
        if (t === T.WATER) for (let i = 0; i < 6; i++) { const p = hexNb(x, y)[i]; if (p[0] >= 0 && p[1] >= 0 && p[0] < G.W && p[1] < G.H && G.tiles[p[1]][p[0]] !== T.WATER) { c.strokeStyle = 'rgba(235,248,255,.7)'; c.lineWidth = 4; hexEdge(c, cxp, cyp, HR, i); } }
        c.strokeStyle = 'rgba(0,0,0,.13)'; c.lineWidth = 1; hexPath(c, cxp, cyp, HR - .3); c.stroke(); c.restore(); return;
      }
    }
    const nb = hexNb(x, y), nt = (i) => { const p = nb[i]; return (p[0] < 0 || p[1] < 0 || p[0] >= G.W || p[1] >= G.H) ? t : G.tiles[p[1]][p[0]]; };
    const base = { [T.GRASS]: [82, 134, 62], [T.FOREST]: [48, 96, 44], [T.MOUNT]: [104, 94, 84], [T.WATER]: [36, 88, 146], [T.ROAD]: [170, 140, 94], [T.SAND]: [206, 184, 114] }[t];
    const v = (r(0) - .5) * 14;
    c.save(); hexPath(c, cxp, cyp, HR + .7); c.clip();
    c.fillStyle = `rgb(${base[0] + v | 0},${base[1] + v | 0},${base[2] + v | 0})`; c.fillRect(px - 2, py - 4, 36, 40);
    for (let i = 0; i < 5; i++) { const d = (r(i + 1) - .5) * 22; c.fillStyle = `rgba(${d > 0 ? '255,255,235' : '0,0,0'},${Math.abs(d) / 90})`; c.fillRect(px + (r(i + 8) * 28 | 0), py + (r(i + 14) * 28 | 0), 4, 4); }
    if (t === T.GRASS || t === T.FOREST) {
      c.lineWidth = 1.2; c.strokeStyle = t === T.GRASS ? 'rgba(30,80,30,.55)' : 'rgba(10,40,10,.55)';
      for (let i = 0; i < 4; i++) { const tx = px + 3 + r(i + 20) * 26, ty = py + 6 + r(i + 30) * 22; c.beginPath(); c.moveTo(tx - 2, ty); c.lineTo(tx, ty - 4); c.lineTo(tx + 2, ty); c.stroke(); }
      if (t === T.GRASS && r(40) > .86) { const fx = px + 4 + r(41) * 24, fy = py + 4 + r(42) * 24; c.fillStyle = ['#fff', '#ffd24a', '#ff8fb0', '#c9a0ff'][r(43) * 4 | 0]; c.beginPath(); c.arc(fx, fy, 1.8, 0, 7); c.fill(); }
    }
    if (t === T.WATER) {
      c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 1.3;
      for (let i = 0; i < 2; i++) { const wy = py + 8 + i * 13 + r(70 + i) * 5, wx = px + 4 + r(72 + i) * 10; c.beginPath(); c.moveTo(wx, wy); c.quadraticCurveTo(wx + 5, wy - 3, wx + 10, wy); c.quadraticCurveTo(wx + 15, wy + 3, wx + 20, wy); c.stroke(); }
      for (let i = 0; i < 6; i++) if (nt(i) !== T.WATER) { c.strokeStyle = 'rgba(190,230,250,.5)'; c.lineWidth = 7; hexEdge(c, cxp, cyp, HR, i); c.strokeStyle = 'rgba(245,252,255,.8)'; c.lineWidth = 2.5; hexEdge(c, cxp, cyp, HR, i); }
    }
    if (t === T.ROAD) {
      for (let i = 0; i < 4; i++) ell(c, px + 4 + r(80 + i) * 24, py + 4 + r(84 + i) * 24, 2.2, 1.5, r(88 + i) > .5 ? 'rgba(255,240,200,.35)' : 'rgba(70,45,20,.35)');
      c.strokeStyle = 'rgba(70,45,20,.4)'; c.lineWidth = 4; for (let i = 0; i < 6; i++) if (nt(i) !== T.ROAD) hexEdge(c, cxp, cyp, HR, i);
    }
    if (t === T.SAND) {
      c.strokeStyle = 'rgba(150,120,60,.4)'; c.lineWidth = 1.2;
      for (let i = 0; i < 2; i++) { const wy = py + 9 + i * 12 + r(90 + i) * 4, wx = px + 3 + r(92 + i) * 8; c.beginPath(); c.arc(wx + 8, wy + 6, 8, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
    }
    c.restore();
    if (t === T.FOREST) {
      const tree = (tx, ty, s) => {
        ell(c, tx, ty + 1, 8 * s, 3 * s, 'rgba(0,0,0,.32)'); c.fillStyle = '#5a3a1a'; c.fillRect(tx - 1.5 * s, ty - 4 * s, 3 * s, 6 * s);
        for (let i = 0; i < 3; i++) {
          const w = (9 - i * 2) * s, top = ty - (10 + i * 7) * s, bot = ty - (2 + i * 7) * s;
          poly(c, [[tx - w, bot], [tx, top], [tx + w, bot]], lin(c, tx - w, 0, tx + w, 0, '#2c6a34', '#164a22'));
          poly(c, [[tx, top], [tx + w, bot], [tx + w * .1, bot]], 'rgba(0,0,0,.2)');
        }
      };
      tree(px + 9 + r(50) * 6, py + 22, .9 + r(51) * .2); tree(px + 22 + r(52) * 5, py + 28, 1 + r(53) * .2);
    }
    if (t === T.MOUNT) {
      const peak = (ax, bw, bh) => {
        const bx = ax - bw, by = py + 30, tx = ax + (r(60) - .5) * 4, ty = by - bh;
        ell(c, ax + 3, by, bw, 3, 'rgba(0,0,0,.3)');
        poly(c, [[bx, by], [tx, ty], [ax + bw, by]], lin(c, bx, ty, ax + bw, by, '#8e8678', '#4e483e'), '#2b2822');
        poly(c, [[tx, ty], [ax + bw, by], [ax + 2, by]], 'rgba(0,0,0,.32)');
        const sh = bh * .32; poly(c, [[tx, ty], [tx - bw * .3, ty + sh], [tx - 2, ty + sh - 3], [tx + 1, ty + sh], [tx + bw * .3, ty + sh - 1]], '#f4f7fb');
      };
      peak(px + 11, 11, 26 + r(61) * 6); peak(px + 23, 10, 20 + r(62) * 6);
    }
  }

  // ---------- portraits: framed plates for creatures and medallions for heroes ----------
  const FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  // rarity = castle tier (1-7) for castle creatures, by value for neutrals; lair dragons are Divine. Upgrade level shows as stars + glow.
  const RARITY = [
    { n: 'Common', m: ['#f0b886', '#a8683a', '#4e2c12'] }, { n: 'Uncommon', m: ['#c4f5a8', '#4aa04a', '#1c4a1c'] },
    { n: 'Rare', m: ['#b0d8ff', '#3a7ad0', '#12306a'] }, { n: 'Epic', m: ['#e4c0ff', '#8a4ad0', '#3a146a'] },
    { n: 'Legendary', m: ['#fff3b0', '#d19a1e', '#6b4a08'] }, { n: 'Mythic', m: ['#ffc4a4', '#e0552a', '#6a1a08'] },
    { n: 'Ancient', m: ['#ffffff', '#a8c8e8', '#3a5a8a'] }, { n: 'Divine', m: ['#7af0ff', '#c58aff', '#ff7ac8'] },
  ];
  function rarityIdx(id) {
    const c = C[id] || {}; if (c.lair) return 7;
    const t = String(id).match(/^[a-z]+(\d)/); if (t) return Math.min(6, +t[1] - 1);
    const v = c.v || 0; return v < 120 ? 0 : v < 300 ? 1 : v < 700 ? 2 : v < 1200 ? 3 : v < 2500 ? 4 : v < 5000 ? 5 : 6;
  }
  const rarity = (id) => RARITY[rarityIdx(id)];
  const star = (g, x, y, r) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * .45 : r; g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } g.closePath(); g.fillStyle = '#ffe27a'; g.fill(); g.strokeStyle = '#5c430b'; g.lineWidth = .8; g.stroke(); };
  const portCache = {}, heroCache = {}, urlCache = {};
  function portraitCanvas(id, S = 72, full) {
    const key = id + '|' + S + (full ? 'f' : ''); if (portCache[key]) return portCache[key];
    const c = C[id] || { i: '❓', lv: 1 };
    return portCache[key] = mk(S, S, (g) => {
      const fac = String(id).replace(/\d.*$/, ''), hue = facHue(fac), lv = c.lv || 1, m = RARITY[rarityIdx(id)].m, hh = hue === null ? 28 : hue, sat = hue === null ? 14 : 48;
      rr(g, 1, 1, S - 2, S - 2, S * .17); g.fillStyle = lin(g, 0, 0, S, S, m[0], m[2]); g.fill(); g.strokeStyle = '#140c04'; g.lineWidth = 1.5; g.stroke();
      const i0 = S * .075; rr(g, i0, i0, S - 2 * i0, S - 2 * i0, S * .12);
      const bg = g.createRadialGradient(S * .38, S * .3, 2, S * .5, S * .55, S * .68); bg.addColorStop(0, hsl(hh, sat, 46)); bg.addColorStop(1, hsl(hh, sat + 6, 13)); g.fillStyle = bg; g.fill();
      const isUp = /_\d$/.test(String(id)), baseId = String(id).replace(/_\d$/, ''), pimg = typeof Assets !== 'undefined' ? Assets.get('portraits/' + baseId + (isUp ? '_up' : ''), 'portraits/' + baseId) : null;
      // the creature's BATTLE art (first idle frame, else its idle pose) is its picture everywhere; the old standing figure / portrait is only the fallback
      const battle = typeof Assets !== 'undefined' ? Assets.get('anim/' + id + '/idle_1', 'poses/left/idle/' + baseId + (isUp ? '_up' : ''), 'poses/left/idle/' + baseId) : null;
      const stand = battle || (full && typeof Assets !== 'undefined' ? Assets.get('creatures/' + id, 'creatures/' + baseId) : null);
      if (pimg && !stand) { g.save(); rr(g, i0, i0, S - 2 * i0, S - 2 * i0, S * .12); g.clip(); g.drawImage(pimg, i0, i0, S - 2 * i0, S - 2 * i0); g.restore(); }
      if (!pimg || stand) {
      g.save(); rr(g, i0, i0, S - 2 * i0, S - 2 * i0, S * .12); g.clip();
      g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(S, 0); g.lineTo(0, S * .75); g.fill();
      ell(g, S * .5, S * .8, S * .3, S * .07, 'rgba(0,0,0,.45)');
      if (c.fly) { g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = S * .035; g.beginPath(); g.arc(S * .2, S * .45, S * .22, -1.2, 1.0); g.moveTo(S * .8 + S * .22 * Math.cos(2.1), S * .45); g.arc(S * .8, S * .45, S * .22, Math.PI - 1.0, Math.PI + 1.2); g.stroke(); }
      g.restore();
      const ai = stand || (typeof Assets !== 'undefined' ? Assets.get('creatures/' + id, 'creatures/' + String(id).replace(/_\d$/, '')) : null);
      const fig = ai || (typeof Figures !== 'undefined' ? Figures.sprite(id) : null);
      if (fig) {
        let bb = null; if (stand) { try { const t = document.createElement('canvas'); t.width = fig.width; t.height = fig.height; const tg = t.getContext('2d'); tg.drawImage(fig, 0, 0); const d = tg.getImageData(0, 0, t.width, t.height).data; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (let y = 0; y < t.height; y++) for (let x = 0; x < t.width; x++) if (d[(y * t.width + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } if (x1 >= 0) bb = [x0, y0, x1 - x0 + 1, y1 - y0 + 1]; } catch (e) { /* no pixel access */ } }
        if (bb) { const iw = S - 2 * i0, kk = Math.min(iw * .92 / bb[2], iw * .9 / bb[3]); g.save(); rr(g, i0, i0, iw, iw, S * .12); g.clip(); g.drawImage(fig, bb[0], bb[1], bb[2], bb[3], S * .5 - bb[2] * kk / 2, S * .93 - bb[3] * kk, bb[2] * kk, bb[3] * kk); g.restore(); }
        else { const kk = Math.min(S * .82 / fig.width, S * .82 / fig.height); g.drawImage(fig, S * .5 - fig.width * kk / 2, S * .87 - fig.height * kk, fig.width * kk, fig.height * kk); }
      }
      else { g.font = Math.round(S * .56) + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = 'rgba(0,0,0,.65)'; g.shadowBlur = S * .06; g.shadowOffsetY = S * .03; g.fillStyle = '#fff'; g.fillText(c.i, S * .5, S * .47); g.shadowColor = 'transparent'; }
      }
      for (const [x, y] of [[S * .13, S * .13], [S * .87, S * .13], [S * .13, S * .87], [S * .87, S * .87]]) { g.beginPath(); g.arc(x, y, S * .028, 0, 7); g.fillStyle = m[0]; g.fill(); }
      const n = Math.min(4, lv - 1); for (let k = 0; k < n; k++) star(g, S * .5 + (k - (n - 1) / 2) * S * .15, S * .87, S * .068);
      if (c.shoot) { g.strokeStyle = '#ffe27a'; g.lineWidth = S * .03; g.beginPath(); g.arc(S * .86, S * .5, S * .12, -1.2, 1.2); g.stroke(); }
    });
  }
  function heroCanvas(icon, col = '#3a8aff', S = 72, pid) {
    const key = icon + col + S + (pid || ''); if (heroCache[key]) return heroCache[key];
    return heroCache[key] = mk(S, S, (g) => {
      const c = S / 2; g.beginPath(); g.arc(c, c, c - 1, 0, 7); g.fillStyle = lin(g, 0, 0, S, S, '#fff3b0', '#8a6210'); g.fill(); g.strokeStyle = '#140c04'; g.lineWidth = 1.5; g.stroke();
      g.beginPath(); g.arc(c, c, c * .86, 0, 7); g.fillStyle = col; g.fill();
      const def = pid && typeof HEROES !== 'undefined' ? HEROES[pid] : null, bust = (pid && typeof Assets !== 'undefined' && Assets.get('heroes/' + pid)) || (def && typeof Figures !== 'undefined' && Figures.hero ? Figures.hero(def) : null);
      if (bust) { g.save(); g.beginPath(); g.arc(c, c, c * .74, 0, 7); g.clip(); g.drawImage(bust, c - c * .74, c - c * .74, c * 1.48, c * 1.48); g.restore(); g.beginPath(); g.arc(c, c, c * .74, 0, 7); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1.2; g.stroke(); return; }
      g.beginPath(); g.arc(c, c, c * .74, 0, 7); const bg = g.createRadialGradient(c * .8, c * .7, 2, c, c, c * .85); bg.addColorStop(0, col); bg.addColorStop(1, '#0c1020'); g.fillStyle = bg; g.fill();
      g.font = Math.round(S * .46) + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = S * .06; g.fillStyle = '#fff'; g.fillText(icon, c, c + S * .02);
    });
  }
  const dataUrl = (key, cv) => urlCache[key] || (urlCache[key] = cv.toDataURL());
  // paint pictures at the size they are shown (times the screen density, x2 for sharpness), so they never look blurry
  const qpx = (px) => Math.min(384, Math.max(96, Math.ceil(px * Math.min(2.5, window.devicePixelRatio || 1) * 2)));
  const pic = (id, px = 40) => { const full = px >= 48, S = qpx(px); return `<img class="pic" draggable="false" width="${px}" height="${px}" alt="" src="${dataUrl('c' + id + '|' + S + (full ? 'f' : ''), portraitCanvas(id, S, full))}">`; };
  // heroes with painted art show it in a square frame (like the hero selection screen); the others keep the drawn round badge
  const heroPic = (icon, col, px = 36, pid) => { if (pid && typeof Assets !== 'undefined' && Assets.has('heroes/' + pid)) return `<img class="pic hart" draggable="false" width="${px}" height="${px}" alt="" src="${Assets.src('heroes/' + pid)}">`; const S = qpx(px); return `<img class="pic round" draggable="false" width="${px}" height="${px}" alt="" src="${dataUrl('h' + icon + col + (pid || '') + '|' + S, heroCanvas(icon, col, S, pid))}">`; };

  // swap the emoji resource icons used throughout the HTML UI for painted ones
  const RES_EMOJI = Object.assign({}, RES_ICON);
  for (const k of Object.keys(RES_ICON)) RES_ICON[k] = resImg(k);
  const fmtCostTxt = (c) => Object.keys(c).map(k => RES_EMOJI[k] + c[k]).join(' ');

  // ---------- mouse cursors painted as 32px sprites ----------
  const curCache = {};
  function cursor(name) {
    if (curCache[name]) return curCache[name];
    const c = mk(32, 32, (g) => {
      g.lineJoin = 'round'; g.lineCap = 'round';
      const outline = (fn, fill) => { g.strokeStyle = '#120a02'; g.lineWidth = 3.4; fn(); g.stroke(); g.fillStyle = fill; fn(); g.fill(); };
      if (name === 'horse') {
        const path = () => { g.beginPath(); g.moveTo(5, 29); g.lineTo(7, 19); g.lineTo(12, 13); g.lineTo(10, 8); g.lineTo(15, 3); g.lineTo(17, 7); g.lineTo(21, 3); g.lineTo(22, 10); g.lineTo(27, 17); g.lineTo(27, 29); g.closePath(); };
        outline(path, lin(g, 5, 3, 27, 29, '#ffe58a', '#c8921c')); g.fillStyle = '#120a02'; g.beginPath(); g.arc(17, 12, 1.5, 0, 7); g.fill();
        g.strokeStyle = '#7a5410'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(22, 11); g.lineTo(26, 22); g.moveTo(20, 8); g.lineTo(24, 18); g.stroke();
      } else if (name === 'boat') {
        outline(() => { g.beginPath(); g.moveTo(3, 21); g.lineTo(29, 21); g.lineTo(24, 29); g.lineTo(8, 29); g.closePath(); }, '#b8803c');
        g.strokeStyle = '#120a02'; g.lineWidth = 3; g.beginPath(); g.moveTo(16, 22); g.lineTo(16, 2); g.stroke(); g.strokeStyle = '#6b431c'; g.lineWidth = 1.2; g.stroke();
        outline(() => { g.beginPath(); g.moveTo(18, 4); g.lineTo(28, 19); g.lineTo(18, 19); g.closePath(); }, '#f5efe0'); outline(() => { g.beginPath(); g.moveTo(14, 7); g.lineTo(5, 19); g.lineTo(14, 19); g.closePath(); }, '#e0d6bc');
      } else if (name === 'sword') {
        g.save(); g.translate(16, 16); g.rotate(-Math.PI / 4);
        outline(() => { g.beginPath(); g.moveTo(-2.5, 10); g.lineTo(-2.5, -9); g.lineTo(0, -15); g.lineTo(2.5, -9); g.lineTo(2.5, 10); g.closePath(); }, lin(g, -3, 0, 3, 0, '#f4f7fb', '#8a95a3'));
        outline(() => { g.beginPath(); g.rect(-8, 10, 16, 3.5); }, '#e3b840'); outline(() => { g.beginPath(); g.rect(-1.8, 13.5, 3.6, 6); }, '#7a4a1c'); g.restore();
      } else if (name === 'arrow') {
        g.beginPath(); g.arc(11, 16, 11, -1.15, 1.15); g.strokeStyle = '#120a02'; g.lineWidth = 4.6; g.stroke(); g.strokeStyle = '#e0a860'; g.lineWidth = 2.6; g.stroke();
        g.strokeStyle = '#120a02'; g.lineWidth = 4; g.beginPath(); g.moveTo(5, 16); g.lineTo(26, 16); g.stroke(); g.strokeStyle = '#f4ecd8'; g.lineWidth = 2; g.stroke();
        outline(() => { g.beginPath(); g.moveTo(30, 16); g.lineTo(23, 11.5); g.lineTo(23, 20.5); g.closePath(); }, '#cfd6de'); outline(() => { g.beginPath(); g.moveTo(5, 16); g.lineTo(1, 12); g.lineTo(8, 16); g.lineTo(1, 20); g.closePath(); }, '#e0443a');
      } else if (name === 'wand') {
        g.strokeStyle = '#120a02'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(4, 28); g.lineTo(20, 12); g.stroke(); g.strokeStyle = '#9a6a3a'; g.lineWidth = 2.6; g.stroke();
        outline(() => { g.beginPath(); for (let i = 0; i < 10; i++) { const an = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3.6 : 8.5; g.lineTo(23 + Math.cos(an) * r, 9 + Math.sin(an) * r); } g.closePath(); }, '#ffe27a');
      } else if (name === 'boot') {
        for (const [x, y] of [[10, 22], [21, 11]]) { outline(() => { g.beginPath(); g.ellipse(x, y - 3, 4.6, 6.2, -0.2, 0, 7); }, '#d9a05a'); outline(() => { g.beginPath(); g.ellipse(x + 0.8, y + 5.6, 3, 2.8, -0.2, 0, 7); }, '#c08040'); for (let i = 0; i < 3; i++) { g.fillStyle = '#6a3a14'; g.beginPath(); g.arc(x - 2 + i * 2.2, y - 8.6 + Math.abs(i - 1) * 0.8, 1, 0, 7); g.fill(); } }
      } else if (name === 'no') {
        g.strokeStyle = '#120a02'; g.lineWidth = 6; g.beginPath(); g.arc(16, 16, 10, 0, 7); g.moveTo(9, 23); g.lineTo(23, 9); g.stroke(); g.strokeStyle = '#ff5a48'; g.lineWidth = 3; g.stroke();
      } else {
        outline(() => { g.beginPath(); g.moveTo(8, 4); g.lineTo(8, 24); g.lineTo(13, 19); g.lineTo(17, 28); g.lineTo(20, 26); g.lineTo(16, 18); g.lineTo(23, 18); g.closePath(); }, '#fff');
      }
    });
    const hot = { horse: '16 16', boat: '16 16', sword: '6 6', no: '16 16', arrow: '16 16', wand: '5 5', boot: '16 16' }[name] || '8 4';
    return curCache[name] = 'url(' + c.toDataURL() + ') ' + hot + ', ' + (name === 'no' ? 'not-allowed' : name === 'sword' ? 'crosshair' : 'pointer');
  }

  // trees / mountains from the art pack are drawn on top of the base tiles (second pass, so they overlap the row above)
  function tileOverlay(c, t, x, y, G) {
    if (typeof Assets === 'undefined') return;
    const cxp = (x + .5 + (y & 1) * .5) * 32, cyp = y * HR * 1.5 + HR;
    if (G && G.river && G.river[y] && G.river[y][x] && t !== T.WATER && t !== T.MOUNT) {      // a stream: water-coloured strokes to every neighbour that is also river or sea
      const nb = hexNb(x, y); let any = false;
      // every river tile's centre is nudged by a fixed pseudo-random offset and the banks vary in width, so the stream meanders and is never a regular zigzag;
      // neighbours share the same offsets, so the pieces still meet exactly
      const jit = (px, py) => { const h = Math.sin(px * 127.1 + py * 311.7) * 43758.5453, h2 = Math.sin(px * 269.5 + py * 183.3) * 24634.6345; return [((h - Math.floor(h)) - .5) * 14, ((h2 - Math.floor(h2)) - .5) * 12]; };
      const jw = (px, py) => 0.82 + 0.4 * (Math.abs(Math.sin(px * 12.9 + py * 78.2) * 43758.5453) % 1);
      const j0 = jit(x, y), wv = jw(x, y); const cxj = cxp + j0[0], cyj = cyp + j0[1];
      c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
      for (let i = 0; i < 6; i++) { const p = nb[i]; if (p[0] < 0 || p[1] < 0 || p[0] >= G.W || p[1] >= G.H) continue; const rv = G.river[y][x], isR = rv > 1 ? (rv & (1 << i)) : ((G.river[p[1]] && G.river[p[1]][p[0]]) || G.tiles[p[1]][p[0]] === T.WATER); if (!isR) continue; any = true;      // new maps link only the real stream; old saves (value 1) keep the old look
        const ux = x + [1, y & 1, (y & 1) - 1, -1, (y & 1) - 1, y & 1][i], nx = (ux + .5 + (p[1] & 1) * .5) * 32, ny = p[1] * HR * 1.5 + HR, jn = G.tiles[p[1]][p[0]] === T.WATER ? [0, 0] : jit(p[0], p[1]), mx = (cxj + nx + jn[0]) / 2, my = (cyj + ny + jn[1]) / 2;
        c.beginPath(); c.moveTo(cxj, cyj); c.quadraticCurveTo((cxj + mx) / 2 + (j0[1] * .35), (cyj + my) / 2 - (j0[0] * .35), mx, my); c.lineWidth = 8 * wv; c.strokeStyle = 'rgba(60,48,28,.3)'; c.stroke();                    // muddy bank
        c.lineWidth = 5.8 * wv; c.strokeStyle = groundPat(c, 'water') || '#2f6f9c'; c.stroke(); c.lineWidth = 1.6; c.strokeStyle = 'rgba(190,226,246,.28)'; c.stroke(); }   // water, with a faint glint
      c.beginPath(); c.arc(cxj, cyj, (any ? 3.8 : 4.8) * wv, 0, 7); c.fillStyle = groundPat(c, 'water') || '#2f6f9c'; c.fill(); c.lineWidth = 1.2; c.strokeStyle = 'rgba(60,48,28,.4)'; c.stroke();
      c.restore();
    }
    if (t === T.ROAD) {                                   // road pieces: a half-road from the centre to every connected neighbour plus a hub
      const st = Assets.get('roads/dirt_straight'); if (!st || !G) return;
      const nb = hexNb(x, y), rw = 15, L = 19, ih = st.height, iw = st.width;
      for (let i = 0; i < 6; i++) { const p = nb[i]; if (p[0] < 0 || p[1] < 0 || p[0] >= G.W || p[1] >= G.H || G.tiles[p[1]][p[0]] !== T.ROAD) continue; c.save(); c.translate(cxp, cyp); c.rotate(i * Math.PI / 3 + Math.PI / 2); c.drawImage(st, 0, 0, iw, ih / 2, -rw / 2, -L, rw, L); c.restore(); }
      c.save(); c.beginPath(); c.arc(cxp, cyp, rw / 2 + .5, 0, 7); c.clip(); c.drawImage(st, 0, ih * .25, iw, ih * .5, cxp - rw / 2, cyp - rw / 2 - 1, rw, rw + 2); c.restore();
      return;
    }
    if (t === T.WATER) {                                  // the odd reef or whirlpool far from the shore
      if (!G) return; const nb = hexNb(x, y);
      if (nb.some(p => p[0] < 0 || p[1] < 0 || p[0] >= G.W || p[1] >= G.H || G.tiles[p[1]][p[0]] !== T.WATER)) return;
      const r = h2(x * 13 + 3, y * 7 + 5), k = r < 0.03 ? 'reef' : r < 0.036 ? 'whirlpool' : null; if (!k) return;
      const im = Assets.get('decor/' + k); if (!im) return; const w = 40, h = im.height * w / im.width;
      c.drawImage(im, cxp - w / 2, cyp - h / 2, w, h); return;
    }
    if (t !== T.FOREST && t !== T.MOUNT) return;
    const im = Assets.get(t === T.FOREST ? 'terrain/forest_overlay' : 'terrain/mountain_overlay'); if (!im) return;
    const box = t === T.FOREST ? 40 : 44, k = Math.min(box / im.width, box / im.height), w = im.width * k, h = im.height * k;
    c.save(); c.translate(cxp, cyp + 16); if (h2(x * 7, y * 3) > .5) c.scale(-1, 1); c.drawImage(im, -w / 2, -h, w, h); c.restore();
  }
  // after custom art finishes loading: forget everything painted so far and rebuild the icon strings
  function reload() { for (const o of [resCache, resUrl, spriteCache, portCache, heroCache, urlCache, patCache]) for (const k in o) delete o[k]; for (const k of Object.keys(RES_ICON)) RES_ICON[k] = resImg(k); }
  return { reload, tile, tileOverlay, hexPath, hexPt, HR, cursor, rarity, portraitCanvas, heroCanvas, pic, heroPic, obj, boat: boatC, resImg, resCanvas, RES_EMOJI, fmtCostTxt, facHue };
})();
