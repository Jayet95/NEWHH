'use strict';
// Painted creature figures (vector, drawn in code). Each creature maps to an archetype + colours/accessories; upgraded
// versions reuse the base figure. Figures.sprite(id) returns a cached 128px canvas that Art.portraitCanvas frames.
const Figures = (() => {
  const INK = '#140a04';
  const K = (c, dl = 0, a = 1) => typeof c === 'string' ? c : `hsla(${c[0]},${c[1]}%,${Math.max(0, Math.min(100, c[2] + dl))}%,${a})`;
  const lin = (g, y0, y1, a, b) => { const q = g.createLinearGradient(0, y0, 0, y1); q.addColorStop(0, a); q.addColorStop(1, b); return q; };
  const fillP = (g, c, y0, y1) => { g.fillStyle = lin(g, y0, y1 + 1, K(c, 13), K(c, -15)); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.3; g.lineJoin = 'round'; g.stroke(); };
  const ellp = (g, x, y, rx, ry, c, rot = 0) => { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, 7); fillP(g, c, y - ry, y + ry); };
  const pl = (g, pts, c) => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); fillP(g, c, Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[1]))); };
  const limb = (g, x1, y1, x2, y2, w, c) => { g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = w + 2.2; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.strokeStyle = K(c); g.lineWidth = w; g.stroke(); };
  const line = (g, pts, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); };
  const dot = (g, x, y, r, col) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = col; g.fill(); };
  const eye = (g, x, y, r, iris = '#111') => { dot(g, x, y, r, '#fff'); dot(g, x + r * .2, y, r * .55, iris); g.strokeStyle = INK; g.lineWidth = .8; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); };
  const ground = (g, w = 16) => { g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(32, 58, w, 3.2, 0, 0, 7); g.fill(); };

  // colours
  const SKIN = [28, 50, 70], GOB = [88, 45, 38], ORC = [100, 38, 38], OGRE = [30, 35, 52], TROLL = [160, 25, 40], STONE = [30, 8, 52], STEEL = [215, 12, 62], LEATH = [28, 45, 32], BONE = [45, 18, 84];
  const WHITE = [45, 20, 93], BLACK = [260, 15, 18], GOLD = [45, 80, 55], RED = [0, 62, 42], BLUE = [215, 55, 42], GREEN = [120, 45, 34], PURP = [275, 45, 38], DEMON = [5, 62, 40];

  // ---------- parts ----------
  function wings(g, type, x, y, span, c, up = 1) {
    for (const s of [-1, 1]) {
      g.save(); g.translate(x, y); g.scale(s, 1);
      if (type === 'feather') {
        pl(g, [[2, 0], [span * .45, -16 * up], [span, -14 * up], [span * .88, -6 * up], [span, 2], [span * .78, 8], [span * .6, 14], [span * .28, 10], [2, 8]], c);
        for (let i = 1; i < 5; i++) line(g, [[4, 2], [span * (.35 + i * .15), -10 + i * 4]], 'rgba(0,0,0,.25)', .8);
      } else if (type === 'bat') {
        pl(g, [[2, 0], [span * .4, -18 * up], [span, -22 * up], [span * .8, -6], [span * .88, 6], [span * .55, 0], [span * .5, 12], [span * .26, 4], [2, 10]], c);
        line(g, [[2, 0], [span, -22 * up]], INK, 1); line(g, [[span * .4, -18 * up], [span * .88, 6]], INK, .9); line(g, [[span * .3, -10], [span * .5, 12]], INK, .9);
      } else if (type === 'butterfly') {
        g.globalAlpha = .85; ellp(g, span * .5, -8 * up, span * .55, 9, c, -.5 * up); ellp(g, span * .4, 6, span * .38, 6, K(c, -8) && [c[0] + 20, c[1], c[2] - 4], .5); g.globalAlpha = 1;
      } else if (type === 'insect') {
        g.globalAlpha = .6; ellp(g, span * .5, -6, span * .5, 4.5, [190, 40, 80], -.35); ellp(g, span * .4, 3, span * .38, 3.6, [190, 40, 80], .2); g.globalAlpha = 1;
      }
      g.restore();
    }
  }
  function flame(g, x, y, w, h, big = 1) {
    const f = (ww, hh, c0, c1) => { g.beginPath(); g.moveTo(x - ww, y); g.quadraticCurveTo(x - ww * 1.1, y - hh * .5, x - ww * .2, y - hh * .7); g.quadraticCurveTo(x, y - hh * .9, x + ww * .1, y - hh); g.quadraticCurveTo(x + ww * .3, y - hh * .6, x + ww, y - hh * .35); g.quadraticCurveTo(x + ww * 1.2, y - hh * .1, x + ww * .6, y); g.closePath(); g.fillStyle = lin(g, y - hh, y, c0, c1); g.fill(); };
    f(w, h, '#ffd24a', '#e8541a'); f(w * .6, h * .65, '#fff6b0', '#ffa83a');
  }
  const wpn = {
    pike(g, x, y) { line(g, [[x - 3, 60], [x + 1, 2]], '#6b431c', 2); pl(g, [[x - 1.5, 6], [x + 1, -3], [x + 3.5, 6]], STEEL); },
    spear(g, x, y) { wpn.pike(g, x, y); },
    lance(g, x, y) { line(g, [[x - 14, 44], [x + 12, 8]], '#8a5a2b', 2); pl(g, [[x + 10, 11], [x + 16, 0], [x + 15, 12]], STEEL); },
    sword(g, x, y) { line(g, [[x, y], [x + 3, y - 20]], INK, 4.2); line(g, [[x, y], [x + 3, y - 20]], '#e6edf5', 2.4); line(g, [[x - 4, y - 3], [x + 4, y - 2]], INK, 4); line(g, [[x - 3.5, y - 3], [x + 3.5, y - 2]], GOLD && K(GOLD), 2); },
    axe(g, x, y) { line(g, [[x, y + 6], [x + 2, y - 18]], '#6b431c', 2.4); pl(g, [[x + 2, y - 18], [x + 11, y - 16], [x + 9, y - 6], [x + 2, y - 9]], STEEL); },
    club(g, x, y) { line(g, [[x, y + 6], [x + 3, y - 14]], INK, 6.5); line(g, [[x, y + 6], [x + 3, y - 14]], '#a8743a', 4.2); ellp(g, x + 3, y - 15, 4.6, 5.4, [28, 45, 38]); },
    mace(g, x, y) { line(g, [[x, y + 6], [x + 2, y - 12]], '#6b431c', 2.2); ellp(g, x + 2, y - 14, 4.4, 4.4, [215, 8, 50]); for (let i = 0; i < 6; i++) { const a = i * 1.05; line(g, [[x + 2 + Math.cos(a) * 4, y - 14 + Math.sin(a) * 4], [x + 2 + Math.cos(a) * 7, y - 14 + Math.sin(a) * 7]], INK, 1.6); } },
    staff(g, x, y, c) { line(g, [[x - 1, 60], [x + 2, 2]], '#6b431c', 2.2); dot(g, x + 2, 3, 4.2, K(c || [190, 80, 62])); dot(g, x + 1, 2, 1.6, '#fff'); },
    trident(g, x, y) { line(g, [[x - 2, 60], [x + 1, 4]], '#6b431c', 2); line(g, [[x - 5, 8], [x + 7, 8]], STEEL && K(STEEL, -10), 1.8); for (const dx of [-5, 1, 7]) pl(g, [[x + dx - 1.4, 8], [x + dx, 0], [x + dx + 1.4, 8]], STEEL); },
    bow(g, x, y) { g.strokeStyle = INK; g.lineWidth = 3.6; g.beginPath(); g.arc(x - 4, y, 14, -1.15, 1.15); g.stroke(); g.strokeStyle = '#a8743a'; g.lineWidth = 2; g.stroke(); line(g, [[x - 4 + Math.cos(-1.15) * 14, y + Math.sin(-1.15) * 14], [x - 4 + Math.cos(1.15) * 14, y + Math.sin(1.15) * 14]], '#f1e8d0', .9); },
    wand(g, x, y, c) { line(g, [[x, y + 4], [x + 5, y - 8]], '#6b431c', 1.8); dot(g, x + 6, y - 10, 3.4, K(c || [20, 90, 58])); },
    whip(g, x, y) { line(g, [[x, y], [x + 8, y - 8], [x + 14, y - 2], [x + 18, y - 12]], '#5a3a1a', 1.8); },
    rock(g, x, y) { pl(g, [[x - 5, y - 4], [x, y - 10], [x + 6, y - 6], [x + 6, y + 1], [x - 2, y + 3]], [30, 8, 48]); },
  };
  function head(g, type, x, y, sk, s) {
    const r = 7;
    if (type === 'block') { pl(g, [[x - 7, y - 7], [x + 7, y - 7], [x + 7, y + 6], [x - 7, y + 6]], sk); line(g, [[x - 4, y - 1], [x + 4, y - 1]], '#fff59a', 2.2); return; }
    if (type === 'skull') { ellp(g, x, y - 1, 6.6, 6.8, BONE); pl(g, [[x - 3.5, y + 4], [x + 3.5, y + 4], [x + 3, y + 8], [x - 3, y + 8]], BONE); dot(g, x - 2.6, y - 1, 1.9, INK); dot(g, x + 2.6, y - 1, 1.9, INK); dot(g, x, y + 2.4, .9, INK); if (s.eyeGlow) { dot(g, x - 2.6, y - 1, 1, s.eyeGlow); dot(g, x + 2.6, y - 1, 1, s.eyeGlow); } return; }
    if (type === 'cyc') { ellp(g, x, y, r + .5, r + .5, sk); eye(g, x, y - .5, 3.6, '#8a2a14'); pl(g, [[x - 4, y + 4], [x + 4, y + 4], [x + 3, y + 7], [x - 3, y + 7]], K(sk, -10) && sk); return; }
    if (type === 'bull') { ellp(g, x, y, r, r - .5, sk); ellp(g, x, y + 3.5, 4.6, 3.8, K(sk, 8) && [sk[0], sk[1], sk[2] + 8]); dot(g, x - 1.6, y + 4, .8, INK); dot(g, x + 1.6, y + 4, .8, INK); line(g, [[x - 6, y - 3], [x - 11, y - 8], [x - 9, y - 12]], '#efe6cf', 2.4); line(g, [[x + 6, y - 3], [x + 11, y - 8], [x + 9, y - 12]], '#efe6cf', 2.4); eye(g, x - 3, y - 1.5, 1.5, '#8a1a10'); eye(g, x + 3, y - 1.5, 1.5, '#8a1a10'); return; }
    if (type === 'wolf') { pl(g, [[x - 6, y - 3], [x - 5, y - 10], [x - 2, y - 5]], sk); pl(g, [[x + 6, y - 3], [x + 5, y - 10], [x + 2, y - 5]], sk); ellp(g, x, y, r, r - 1, sk); ellp(g, x, y + 3.5, 4, 3.4, [sk[0], sk[1], sk[2] + 12]); dot(g, x, y + 2, 1.2, INK); eye(g, x - 3, y - 1.5, 1.4, '#c8921c'); eye(g, x + 3, y - 1.5, 1.4, '#c8921c'); pl(g, [[x - 2.4, y + 6], [x - 1.4, y + 8.4], [x - .4, y + 6]], WHITE); return; }
    if (type === 'lizard') { ellp(g, x, y, 6, 5.6, sk); ellp(g, x, y + 3.6, 4.2, 3.2, [sk[0], sk[1], sk[2] + 10]); eye(g, x - 3.4, y - 2, 1.5, '#c8921c'); eye(g, x + 3.4, y - 2, 1.5, '#c8921c'); line(g, [[x - 3, y + 6], [x + 3, y + 6]], INK, .9); line(g, [[x - 1, y - 7], [x - 1, y - 11]], K(sk, -12), 1.6); line(g, [[x + 2, y - 7], [x + 3, y - 10]], K(sk, -12), 1.6); return; }
    if (type === 'orc') { ellp(g, x, y, r + .5, r, sk); pl(g, [[x - 5, y + 3], [x + 5, y + 3], [x + 4, y + 8], [x - 4, y + 8]], sk); pl(g, [[x - 3.2, y + 3], [x - 2.2, y - .4], [x - 1.2, y + 3]], WHITE); pl(g, [[x + 3.2, y + 3], [x + 2.2, y - .4], [x + 1.2, y + 3]], WHITE); line(g, [[x - 5, y - 3], [x - 1.5, y - 2]], INK, 1.8); line(g, [[x + 5, y - 3], [x + 1.5, y - 2]], INK, 1.8); dot(g, x - 3, y - 1, 1, '#ffd24a'); dot(g, x + 3, y - 1, 1, '#ffd24a'); return; }
    if (type === 'gob') { pl(g, [[x - 5, y - 2], [x - 14, y - 6], [x - 6, y + 3]], sk); pl(g, [[x + 5, y - 2], [x + 14, y - 6], [x + 6, y + 3]], sk); ellp(g, x, y, r, r - .5, sk); eye(g, x - 3, y - 1, 1.8, '#a01010'); eye(g, x + 3, y - 1, 1.8, '#a01010'); pl(g, [[x - 3, y + 3.4], [x + 3, y + 3.4], [x, y + 6]], INK); return; }
    if (type === 'demon') { ellp(g, x, y, r, r, sk); pl(g, [[x - 5, y - 5], [x - 8, y - 14], [x - 2, y - 7]], '#e8dcc0'); pl(g, [[x + 5, y - 5], [x + 8, y - 14], [x + 2, y - 7]], '#e8dcc0'); line(g, [[x - 5, y - 2.4], [x - 1.4, y - .6]], INK, 1.6); line(g, [[x + 5, y - 2.4], [x + 1.4, y - .6]], INK, 1.6); dot(g, x - 3, y, 1.3, '#ffe04a'); dot(g, x + 3, y, 1.3, '#ffe04a'); line(g, [[x - 3, y + 4], [x, y + 5.2], [x + 3, y + 4]], INK, 1.2); return; }
    ellp(g, x, y, r - .6, r, sk);
    dot(g, x - 2.6, y - .6, 1.1, INK); dot(g, x + 2.6, y - .6, 1.1, INK); line(g, [[x - 2, y + 3.2], [x + 2, y + 3.2]], 'rgba(60,20,10,.7)', .9);
    if (s.ears) { pl(g, [[x - 6, y - 1], [x - 12, y - 5], [x - 6, y + 2]], sk); pl(g, [[x + 6, y - 1], [x + 12, y - 5], [x + 6, y + 2]], sk); }
    if (s.fangs) { pl(g, [[x - 2.4, y + 3.2], [x - 1.6, y + 6], [x - .8, y + 3.2]], WHITE); pl(g, [[x + 2.4, y + 3.2], [x + 1.6, y + 6], [x + .8, y + 3.2]], WHITE); }
  }

  // ---------- archetypes ----------
  function humanoid(g, s) {
    const b = s.bulk || 1, sk = s.sk || SKIN, ar = s.ar || BLUE, lg = s.lg || K(K(ar, -12) && ar), by = 43;
    g.save();
    const sz = s.size || 1; g.translate(32, 58); g.scale(sz, sz); g.translate(-32, -58);
    if (s.wings) wings(g, s.wings, 32, 27, 24 * b * .9 + 8, s.wingC || [220, 12, 90]);
    if (s.cape) pl(g, [[24 - b * 2, 22], [40 + b * 2, 22], [45 + b * 2, 52], [19 - b * 2, 52]], s.cape);
    if (s.tailSmoke) { g.globalAlpha = .9; pl(g, [[22, 40], [42, 40], [38, 50], [34, 57], [30, 52], [28, 58], [25, 48]], s.smoke || [200, 50, 60]); g.globalAlpha = 1; }
    else if (s.ghost) { g.globalAlpha = .8; pl(g, [[23 - b, 26], [41 + b, 26], [43 + b, 44], [38, 49], [35, 58], [31, 48], [27, 55], [24, 46], [21, 50]], ar); g.globalAlpha = 1; }
    else if (!s.noLegs) {
      for (const dx of [-5, 5]) { limb(g, 32 + dx * b, 40, 32 + dx * b * 1.15, 54, 6.2 * b, s.skel ? BONE : (s.lgc || K(ar, -14) && [ar[0], ar[1], Math.max(10, ar[2] - 14)])); pl(g, [[32 + dx * b * 1.15 - 4, 56], [32 + dx * b * 1.15 + 5, 56], [32 + dx * b * 1.15 + 4, 52], [32 + dx * b * 1.15 - 3, 52]], s.boot || [25, 40, 22]); }
    }
    if (s.tail) line(g, [[30, 46], [14, 52], [8, 44]], K(sk, -6), 4);
    if (s.robe) pl(g, [[32 - 10 * b, 26], [32 + 10 * b, 26], [32 + 14 * b, 56], [32 - 14 * b, 56]], ar);
    else { pl(g, [[32 - 9 * b, 22], [32 + 9 * b, 22], [32 + 7.5 * b, by], [32 - 7.5 * b, by]], s.skel ? BONE : ar); if (s.belt) line(g, [[32 - 7.5 * b, by - 3], [32 + 7.5 * b, by - 3]], K(s.belt), 2.4); }
    if (s.skel) for (let i = 0; i < 3; i++) line(g, [[32 - 6, 27 + i * 5], [32 + 6, 27 + i * 5]], INK, 1.2);
    if (s.golem) { for (const [x, y, w] of [[26, 28, 8], [38, 33, 7], [30, 38, 6]]) line(g, [[x - w / 2, y], [x + w / 2, y]], 'rgba(0,0,0,.3)', 1); }
    // arms
    const la = s.skel ? BONE : (s.armc || sk);
    limb(g, 32 - 9 * b, 25, 32 - 15 * b, 37, 5 * b, la); limb(g, 32 + 9 * b, 25, 32 + 15 * b, 33, 5 * b, la);
    dot(g, 32 - 15 * b, 37, 3, K(sk)); dot(g, 32 + 15 * b, 33, 3, K(sk));
    if (s.shield) { const sx = 32 - 16 * b, sy = 37; g.beginPath(); g.moveTo(sx - 7, sy - 9); g.lineTo(sx + 7, sy - 9); g.lineTo(sx + 7, sy + 2); g.quadraticCurveTo(sx + 6, sy + 10, sx, sy + 13); g.quadraticCurveTo(sx - 6, sy + 10, sx - 7, sy + 2); g.closePath(); fillP(g, s.shield, sy - 9, sy + 13); line(g, [[sx, sy - 8], [sx, sy + 11]], 'rgba(255,255,255,.35)', 1.4); line(g, [[sx - 6, sy - 2], [sx + 6, sy - 2]], 'rgba(255,255,255,.35)', 1.4); }
    if (s.wp) (wpn[s.wp] || wpn.sword)(g, 32 + 15 * b, 33, s.wpc);
    head(g, s.head || 'human', 32, 15, s.skel && !s.head ? BONE : sk, s);
    if (s.skel && !s.head) { head(g, 'skull', 32, 15, BONE, s); }
    // headgear
    if (s.helm === 'helm') { pl(g, [[24.5, 16], [24.5, 10], [28, 5], [36, 5], [39.5, 10], [39.5, 16], [36, 14], [28, 14]], STEEL); line(g, [[32, 5], [32, 13]], INK, 1.2); }
    if (s.helm === 'great') { pl(g, [[24, 21], [24, 9], [28, 4], [36, 4], [40, 9], [40, 21], [36, 21], [36, 15], [28, 15], [28, 21]], STEEL); line(g, [[28, 14], [36, 14]], INK, 1.4); pl(g, [[30, 4], [34, 4], [35, -2], [29, -2]], K(s.plume || RED) && (s.plume || RED)); }
    if (s.hood) pl(g, [[23.5, 22], [24.5, 9], [32, 3], [39.5, 9], [40.5, 22], [36, 14], [28, 14]], s.hoodC || K(ar) && ar);
    if (s.hat) { pl(g, [[22, 10], [42, 10], [34, 8], [32, -6]], ar); line(g, [[23, 10], [41, 10]], INK, 1.6); }
    if (s.crown) pl(g, [[26, 9], [26, 3], [29, 6], [32, 1], [35, 6], [38, 3], [38, 9]], GOLD);
    if (s.turban) { ellp(g, 32, 8, 9, 5.5, [0, 60, 60]); dot(g, 32, 5, 1.8, '#7ad6ff'); }
    if (s.beard) pl(g, [[26, 17], [38, 17], [36, 29], [32, 33], [28, 29]], [28, 35, 38]);
    if (s.horns) { pl(g, [[26, 11], [22, 2], [29, 8]], '#e8dcc0'); pl(g, [[38, 11], [42, 2], [35, 8]], '#e8dcc0'); }
    if (s.halo) { g.strokeStyle = INK; g.lineWidth = 3.4; g.beginPath(); g.ellipse(32, 3, 8, 2.6, 0, 0, 7); g.stroke(); g.strokeStyle = '#ffe27a'; g.lineWidth = 1.8; g.stroke(); }
    if (s.leaf) { for (const [x, y, r] of [[26, 8, 5], [32, 4, 6], [38, 8, 5], [22, 24, 4], [42, 24, 4]]) dot(g, x, y, r, K([115, 55, 36])); }
    if (s.fire) { flame(g, 32, 22, 10, 22); flame(g, 22, 34, 5, 11); flame(g, 42, 34, 5, 11); }
    g.restore();
  }
  function quad(g, s) {
    const c = s.body || [28, 40, 40], head_ = s.qhead || 'horse';
    ground(g, 20);
    if (s.wings) wings(g, s.wings, 30, 30, 26, s.wingC || [220, 10, 90]);
    line(g, [[15, 36], [6, 38], [4, 48]], K(c, -12), 4.5);                                  // tail
    if (s.stinger) { line(g, [[14, 34], [6, 26], [8, 14], [14, 8]], K(c, -8), 4); pl(g, [[13, 6], [18, 4], [15, 12]], '#e8dcc0'); }
    if (s.fire) { flame(g, 14, 36, 6, 13); }
    for (const [x, y] of [[19, 56], [25, 57]]) limb(g, x + 1, 44, x, y, 5.4, K(c, -12) && [c[0], c[1], c[2] - 10]);
    ellp(g, 29, 38, 17, 9.5, c);
    for (const [x, y] of [[37, 57], [43, 56]]) limb(g, x - 1, 44, x, y, 5.4, c);
    if (s.rider) { g.save(); g.translate(30, 31); g.scale(s.rider.size || .6, s.rider.size || .6); g.translate(-32, -43); humanoid(g, Object.assign({ noLegs: true }, s.rider)); g.restore(); }
    if (s.centaur) { g.save(); g.translate(41, 33); g.scale(.66, .66); g.translate(-32, -43); humanoid(g, Object.assign({ noLegs: true }, s.centaur)); g.restore(); }
    else {
      pl(g, [[38, 34], [44, 18], [51, 22], [45, 40]], c);
      if (s.mane) line(g, [[44, 18], [38, 32]], K(s.mane), 3);
      const hx = 49, hy = 20;
      if (head_ === 'horse') { ellp(g, hx + 3, hy + 1, 8, 4.6, c, .5); pl(g, [[hx - 1, hy - 3], [hx, hy - 9], [hx + 3, hy - 4]], c); dot(g, hx + 2, hy - 1, 1, INK); dot(g, hx + 9, hy + 4, .8, INK); }
      if (head_ === 'wolf') { ellp(g, hx + 2, hy, 6.6, 5.6, c); pl(g, [[hx + 6, hy - 1], [hx + 14, hy + 2], [hx + 6, hy + 5]], c); pl(g, [[hx - 2, hy - 4], [hx - 1, hy - 11], [hx + 3, hy - 5]], c); dot(g, hx + 3, hy - 1.5, 1.2, '#ffd24a'); pl(g, [[hx + 8, hy + 5], [hx + 9, hy + 8], [hx + 10, hy + 5]], WHITE); }
      if (head_ === 'eagle') { ellp(g, hx + 1, hy, 6, 5.6, [40, 25, 90]); pl(g, [[hx + 5, hy - 1], [hx + 13, hy + 3], [hx + 5, hy + 4]], [45, 85, 55]); eye(g, hx + 2, hy - 1.5, 1.6, '#8a4a00'); }
      if (head_ === 'lion') { ellp(g, hx + 1, hy, 9, 9, K(s.mane || [25, 60, 30]) && (s.mane || [25, 60, 30])); ellp(g, hx + 2, hy + 1, 6, 5.6, c); dot(g, hx + 5, hy + 2, 1.4, INK); eye(g, hx + 3, hy - 1.5, 1.3, '#8a4a00'); pl(g, [[hx + 3, hy + 5], [hx + 4, hy + 8], [hx + 5, hy + 5]], WHITE); }
      if (head_ === 'bull') { ellp(g, hx + 2, hy + 1, 7.4, 5.8, c); pl(g, [[hx + 6, hy - 1], [hx + 13, hy + 3], [hx + 5, hy + 6]], c); line(g, [[hx - 1, hy - 4], [hx - 6, hy - 10], [hx - 3, hy - 14]], '#efe6cf', 2.6); line(g, [[hx + 4, hy - 4], [hx + 4, hy - 12]], '#efe6cf', 2.6); eye(g, hx + 2, hy - 1.4, 1.5, '#8a1a10'); }
      if (head_ === 'rhino') { ellp(g, hx + 2, hy + 1, 8, 6.4, c); pl(g, [[hx + 8, hy + 1], [hx + 13, hy + 7], [hx + 5, hy + 7]], c); pl(g, [[hx + 8, hy - 1], [hx + 12, hy - 11], [hx + 11, hy + 1]], '#efe6cf'); pl(g, [[hx - 1, hy - 4], [hx - 3, hy - 10], [hx + 3, hy - 5]], c); dot(g, hx + 3, hy - 1, 1.2, INK); }
      if (head_ === 'lizard') { ellp(g, hx + 3, hy + 1, 9, 4.6, c, .25); pl(g, [[hx - 2, hy - 3], [hx, hy - 8], [hx + 3, hy - 4]], K(c, -10) && [c[0], c[1], c[2] - 10]); eye(g, hx + 3, hy - 1.5, 1.4, '#c8921c'); for (let i = 0; i < 4; i++) pl(g, [[hx + 6 + i * 1.6, hy + 4], [hx + 6.8 + i * 1.6, hy + 6.4], [hx + 7.6 + i * 1.6, hy + 4]], WHITE); }
      if (s.horn) { pl(g, [[hx + 3, hy - 4], [hx + 8, hy - 17], [hx + 6, hy - 3]], [50, 60, 90]); }
    }
  }
  function dragon(g, s) {
    const c = s.col || GREEN; ground(g, 20);
    wings(g, 'bat', 30, 30, 27, s.wingC || K(c, 4) && [c[0], c[1], c[2] + 4], 1);
    line(g, [[14, 40], [6, 46], [4, 38]], K(c, -10), 5); pl(g, [[2, 36], [6, 38], [3, 42]], K(c, -10) && [c[0], c[1], c[2] - 10]);
    if (!s.wyvern) { limb(g, 24, 46, 22, 57, 6.2, [c[0], c[1], c[2] - 8]); }
    limb(g, 36, 46, 38, 57, 6.2, [c[0], c[1], c[2] - 8]);
    ellp(g, 28, 40, 17, 10, c);
    ellp(g, 28, 44, 12, 5.5, [c[0] - 5, c[1] - 15, c[2] + 20]);
    if (s.bone) for (let i = 0; i < 4; i++) line(g, [[22 + i * 4, 33], [22 + i * 4, 46]], INK, 1);
    line(g, [[38, 34], [44, 22], [47, 14]], INK, 8.4); line(g, [[38, 34], [44, 22], [47, 14]], K(c), 6);
    ellp(g, 50, 13, 7.5, 5, c, -.2); pl(g, [[54, 11], [62, 14], [54, 18]], c);
    pl(g, [[46, 9], [44, 1], [50, 7]], '#efe6cf'); pl(g, [[51, 8], [51, 0], [55, 8]], '#efe6cf');
    eye(g, 51, 11, 1.8, s.bone ? '#ff3a2a' : '#c8921c'); for (let i = 0; i < 3; i++) pl(g, [[56 + i * 1.8, 17], [57 + i * 1.8, 19.6], [58 + i * 1.8, 17]], WHITE);
    for (let i = 0; i < 5; i++) pl(g, [[16 + i * 5, 31 - (i === 2 ? 1 : 0)], [18 + i * 5, 26 - (i === 2 ? 2 : 0)], [20 + i * 5, 31]], K(c, -14) && [c[0], c[1], c[2] - 14]);
    if (s.fire) flame(g, 62, 18, 5, 9);
  }
  function serp(g, s) {
    const c = s.col || [170, 50, 36], sk = s.sk || SKIN;
    ground(g, 18);
    g.lineCap = 'round';
    const tail = [[32, 36], [44, 44], [30, 52], [18, 48], [26, 58]];
    for (const [w, col] of [[11, INK], [8.4, K(c)]]) { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(32, 34); g.bezierCurveTo(48, 40, 44, 54, 28, 52); g.bezierCurveTo(14, 50, 14, 42, 26, 44); g.stroke(); }
    g.strokeStyle = K(c, 16, .5); g.lineWidth = 2; g.beginPath(); g.moveTo(32, 36); g.bezierCurveTo(46, 41, 42, 53, 28, 50); g.stroke();
    pl(g, [[32 - 8, 22], [32 + 8, 22], [32 + 6, 38], [32 - 6, 38]], s.top || K(c, 10) && [c[0], c[1], c[2] + 8]);
    limb(g, 24, 25, 17, 35, 4.6, sk); limb(g, 40, 25, 46, 31, 4.6, sk);
    if (s.wp) (wpn[s.wp] || wpn.sword)(g, 47, 31);
    if (s.snakes) { for (const [x, y, a] of [[24, 12, -2.4], [28, 6, -1.9], [36, 6, -1.2], [40, 12, -.7], [22, 18, -2.9], [42, 18, -.2]]) { line(g, [[32, 14], [x, y], [x + Math.cos(a) * 5, y + Math.sin(a) * 5]], INK, 3.6); line(g, [[32, 14], [x, y], [x + Math.cos(a) * 5, y + Math.sin(a) * 5]], K([110, 60, 38]), 2); } }
    head(g, 'human', 32, 15, sk, {});
    if (s.crown) pl(g, [[26, 9], [26, 3], [29, 6], [32, 1], [35, 6], [38, 3], [38, 9]], GOLD);
    if (s.hood) pl(g, [[24, 22], [25, 7], [32, 1], [39, 7], [40, 22], [36, 12], [28, 12]], c);
  }
  function bird(g, s) {
    const c = s.col || [30, 50, 42]; ground(g, 12);
    wings(g, 'feather', 32, 30, 30, s.wingC || K(c, 6) && [c[0], c[1], c[2] + 6], 1);
    for (let i = 0; i < 3; i++) pl(g, [[28 + i * 4, 44], [24 + i * 5, 58], [32 + i * 4, 48]], [c[0], c[1], c[2] - 10]);
    ellp(g, 32, 36, 9, 12, c);
    ellp(g, 32, 40, 5, 8, [c[0], c[1] - 10, c[2] + 20]);
    ellp(g, 32, 19, 6.5, 6.2, c); pl(g, [[27, 20], [32, 31], [37, 20]], [45, 85, 55]);
    pl(g, [[30, 13], [32, 6], [34, 13]], [c[0], c[1], c[2] - 8]); eye(g, 29.5, 18, 1.8, '#8a4a00'); eye(g, 34.5, 18, 1.8, '#8a4a00');
    limb(g, 29, 46, 27, 56, 2.2, [45, 85, 55]); limb(g, 35, 46, 37, 56, 2.2, [45, 85, 55]);
    if (s.fire) { flame(g, 14, 40, 7, 16); flame(g, 50, 40, 7, 16); flame(g, 32, 8, 5, 12); }
  }
  function insect(g, s) {
    const c = s.col || [75, 55, 36]; ground(g, 12);
    wings(g, 'insect', 32, 28, 28, [190, 40, 80], 1);
    ellp(g, 32, 46, 6, 11, c); for (let i = 0; i < 4; i++) line(g, [[27, 40 + i * 4], [37, 40 + i * 4]], INK, 1);
    pl(g, [[30, 56], [32, 63], [34, 56]], '#e8dcc0');
    ellp(g, 32, 31, 7, 7, c); ellp(g, 32, 20, 8, 7, c); ellp(g, 27, 19, 4, 4.6, [10, 70, 45]); ellp(g, 37, 19, 4, 4.6, [10, 70, 45]);
    line(g, [[29, 13], [25, 4]], INK, 1.2); line(g, [[35, 13], [39, 4]], INK, 1.2);
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) line(g, [[32 + side * 5, 30 + i * 3], [32 + side * 13, 34 + i * 6], [32 + side * 14, 44 + i * 4]], INK, 1.4);
  }
  function eyeball(g) {
    ground(g, 16);
    for (const [x, y] of [[16, 18], [24, 10], [32, 7], [40, 10], [48, 18]]) { line(g, [[32, 28], [x, y]], INK, 3.6); line(g, [[32, 28], [x, y]], K([285, 30, 36]), 2); eye(g, x, y - 1, 3, '#a01040'); }
    ellp(g, 32, 38, 18, 17, [285, 35, 38]);
    ellp(g, 32, 36, 11, 10.5, [0, 0, 96]); dot(g, 32, 36, 6.4, '#c8203a'); ellp(g, 32, 36, 1.8, 5.2, '#120408'); dot(g, 29.6, 33.4, 1.5, 'rgba(255,255,255,.85)');
    g.beginPath(); g.moveTo(18, 52); g.quadraticCurveTo(32, 60, 46, 52); g.strokeStyle = INK; g.lineWidth = 2.4; g.stroke(); for (let i = 0; i < 5; i++) pl(g, [[22 + i * 5, 53.6], [23 + i * 5, 57], [24.4 + i * 5, 53.6]], WHITE);
  }
  function kraken(g, s) {
    const c = s.col || [320, 35, 38]; ground(g, 20);
    for (const [x0, x1, y1, w] of [[18, 6, 54, 5], [24, 14, 60, 5], [32, 30, 62, 5], [40, 48, 60, 5], [46, 58, 52, 5], [28, 2, 40, 4], [38, 62, 38, 4]]) { g.lineCap = 'round'; for (const [ww, col] of [[w + 2.4, INK], [w, K(c, -6)]]) { g.strokeStyle = col; g.lineWidth = ww; g.beginPath(); g.moveTo(x0 + 6, 34); g.bezierCurveTo(x0, 46, x1 + 8, y1 - 10, x1, y1); g.stroke(); } }
    ellp(g, 32, 24, 15, 17, c); ellp(g, 32, 18, 8, 6, [c[0], c[1], c[2] + 12]);
    eye(g, 25, 28, 4, '#a01010'); eye(g, 39, 28, 4, '#a01010');
  }
  function shark(g) {
    ground(g, 22);
    pl(g, [[8, 38], [20, 30], [40, 30], [58, 36], [40, 48], [20, 48]], [208, 18, 46]);
    pl(g, [[22, 40], [40, 44], [34, 51]], [208, 12, 82]); pl(g, [[28, 31], [36, 14], [42, 31]], [208, 18, 40]);
    pl(g, [[2, 22], [10, 36], [8, 40], [2, 52], [14, 40]], [208, 18, 40]);
    pl(g, [[46, 40], [52, 56], [38, 46]], [208, 18, 40]);
    eye(g, 49, 35, 1.9); line(g, [[56, 40], [48, 44]], INK, 1.3); for (let i = 0; i < 5; i++) pl(g, [[54 - i * 2.2, 41 + i * .6], [53 - i * 2.2, 44], [52 - i * 2.2, 41.6 + i * .5]], WHITE);
    for (let i = 0; i < 3; i++) line(g, [[44 - i * 2, 38], [42 - i * 2, 43]], INK, .8);
  }
  function hydra(g, s) {
    const c = s.col || [165, 45, 34]; ground(g, 20);
    ellp(g, 32, 48, 20, 11, c);
    for (const [x, ex, ey] of [[22, 12, 12], [32, 32, 6], [42, 52, 12]]) {
      for (const [w, col] of [[8.6, INK], [6.2, K(c)]]) { g.lineCap = 'round'; g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x, 44); g.bezierCurveTo(x - 6, 30, ex + 8, 26, ex, ey + 4); g.stroke(); }
      ellp(g, ex, ey, 5.6, 4.4, c); pl(g, [[ex + 4, ey - 1], [ex + 10, ey + 1], [ex + 4, ey + 4]], c); eye(g, ex, ey - 1.6, 1.3, '#c8921c'); line(g, [[ex + 8, ey + 2.6], [ex + 13, ey + 4]], '#e0443a', 1);
    }
  }
  function elem(g, s) {
    ground(g, 16); const k = s.kind;
    if (k === 'air') { for (const [r, a] of [[18, .5], [13, .75], [8, 1]]) { g.globalAlpha = a; g.strokeStyle = K([200, 30, 88]); g.lineWidth = 5; g.beginPath(); g.arc(32, 34, r, .5, 5.2); g.stroke(); } g.globalAlpha = 1; ellp(g, 32, 34, 9, 9, [200, 30, 92]); eye(g, 28.5, 32, 2.2, '#2a60b0'); eye(g, 35.5, 32, 2.2, '#2a60b0'); line(g, [[10, 52], [20, 56], [34, 52], [46, 57]], 'rgba(255,255,255,.7)', 2.4); }
    if (k === 'water') { g.beginPath(); g.moveTo(32, 4); g.quadraticCurveTo(54, 30, 50, 44); g.quadraticCurveTo(46, 58, 32, 58); g.quadraticCurveTo(18, 58, 14, 44); g.quadraticCurveTo(10, 30, 32, 4); fillP(g, [205, 75, 52], 4, 58); ellp(g, 24, 28, 3, 7, [200, 80, 90], .4); eye(g, 26, 40, 3, '#103a70'); eye(g, 38, 40, 3, '#103a70'); line(g, [[27, 49], [32, 52], [37, 49]], INK, 1.4); }
    if (k === 'fire') { flame(g, 32, 58, 20, 54); flame(g, 14, 50, 6, 20); flame(g, 50, 50, 6, 20); eye(g, 27, 36, 3, '#c8200a'); eye(g, 37, 36, 3, '#c8200a'); line(g, [[27, 46], [32, 49], [37, 46]], INK, 1.5); }
    if (k === 'earth') { for (const [pts, c] of [[[[10, 58], [12, 38], [26, 30], [40, 32], [54, 40], [54, 58]], [28, 30, 38]], [[[18, 34], [24, 14], [38, 10], [46, 26], [40, 38]], [28, 28, 46]], [[[8, 40], [4, 32], [12, 28], [16, 40]], [28, 26, 34]], [[[48, 40], [52, 30], [60, 34], [58, 46]], [28, 26, 34]]]) pl(g, pts, c); eye(g, 29, 24, 2.8, '#ff8a2a'); eye(g, 38, 24, 2.8, '#ff8a2a'); line(g, [[26, 34], [38, 34]], INK, 1.5); }
    if (k === 'psy') { ellp(g, 32, 34, 20, 15, [330, 45, 68]); for (const [x, y, r] of [[22, 28, 8], [34, 24, 9], [44, 32, 7], [28, 40, 8], [40, 42, 7]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.strokeStyle = 'rgba(120,30,70,.5)'; g.lineWidth = 1.4; g.stroke(); } eye(g, 32, 34, 6, '#7a1060'); for (const [x, y] of [[16, 12], [32, 7], [48, 12]]) { line(g, [[32, 22], [x, y]], INK, 2.4); eye(g, x, y, 3, '#7a1060'); } ellp(g, 32, 56, 10, 3, [270, 40, 40]); }
  }
  function sparkle(g, x, y, r, col) { pl(g, [[x, y - r], [x + r * .3, y - r * .3], [x + r, y], [x + r * .3, y + r * .3], [x, y + r], [x - r * .3, y + r * .3], [x - r, y], [x - r * .3, y - r * .3]], col); }

  // ---------- creature table ----------
  const FIG = {
    goblin: { b: 'h', sk: GOB, ar: LEATH, size: .74, head: 'gob', wp: 'club' },
    wolf: { b: 'q', qhead: 'wolf', body: [30, 8, 38], rider: { sk: GOB, ar: LEATH, wp: 'club', head: 'gob', size: .58 } },
    orc: { b: 'h', sk: ORC, ar: LEATH, bulk: 1.12, head: 'orc', wp: 'bow', belt: [25, 40, 25] },
    ogre: { b: 'h', sk: OGRE, ar: [25, 35, 28], bulk: 1.45, size: 1.08, head: 'orc', wp: 'club' },
    troll: { b: 'h', sk: TROLL, ar: [160, 20, 28], bulk: 1.3, size: 1.1, head: 'orc', wp: 'club' },
    golem: { b: 'h', sk: STONE, ar: STONE, bulk: 1.5, size: 1.08, head: 'block', golem: true },
    naga: { b: 's', col: [170, 50, 36], wp: 'sword' },
    dragon: { b: 'd', col: [120, 50, 32] },
    shark: { b: 'sh' }, kraken: { b: 'k' },
    castle1: { b: 'h', ar: STEEL, helm: 'helm', wp: 'pike', shield: BLUE, belt: [28, 40, 30] },
    castle2: { b: 'h', ar: [120, 35, 30], hood: true, hoodC: [120, 35, 24], wp: 'bow' },
    castle3: { b: 'q', qhead: 'eagle', body: [35, 55, 46], wings: 'feather', wingC: [40, 30, 88] },
    castle4: { b: 'h', ar: STEEL, helm: 'great', plume: RED, wp: 'sword', shield: [0, 60, 40], cape: [0, 55, 36] },
    castle5: { b: 'h', ar: WHITE, robe: true, hood: true, hoodC: [45, 20, 85], wp: 'staff', wpc: [190, 80, 62] },
    castle6: { b: 'q', qhead: 'horse', body: [40, 12, 92], mane: [40, 30, 70], rider: { ar: STEEL, helm: 'great', plume: BLUE, wp: 'lance', cape: BLUE, shield: [215, 55, 40] } },
    castle7: { b: 'h', ar: WHITE, robe: true, wings: 'feather', halo: true, wp: 'sword', wingC: [45, 25, 96] },
    rampart1: { b: 'q', qhead: 'horse', body: [28, 45, 36], centaur: { ar: [120, 35, 30], wp: 'bow' } },
    rampart2: { b: 'h', size: .78, bulk: 1.3, ar: [20, 45, 32], helm: 'helm', beard: true, wp: 'axe' },
    rampart3: { b: 'h', ar: GREEN, ears: true, wp: 'bow', hood: false, belt: [28, 40, 28] },
    rampart4: { b: 'q', qhead: 'horse', body: WHITE, wings: 'feather', wingC: [200, 40, 92], mane: [200, 40, 80] },
    rampart5: { b: 'h', sk: [28, 40, 28], ar: [28, 40, 24], bulk: 1.3, size: 1.1, head: 'block', leaf: true },
    rampart6: { b: 'q', qhead: 'horse', body: [0, 0, 96], horn: true, mane: [320, 50, 70] },
    rampart7: { b: 'd', col: [48, 78, 54] },
    tower1: { b: 'h', sk: [200, 30, 48], ar: [200, 25, 30], size: .62, head: 'gob', wp: 'wand' },
    tower2: { b: 'h', sk: STONE, ar: STONE, wings: 'bat', wingC: [30, 8, 40], head: 'gob', size: .92, horns: true },
    tower3: { b: 'h', sk: STEEL, ar: STEEL, bulk: 1.5, size: 1.08, head: 'block', golem: true },
    tower4: { b: 'h', ar: [225, 50, 40], robe: true, hat: true, wp: 'staff', wpc: [280, 80, 62] },
    tower5: { b: 'h', ar: GOLD, sk: [200, 50, 60], tailSmoke: true, smoke: [200, 55, 62], turban: true, wp: 'sword', noLegs: true },
    tower6: { b: 's', col: [250, 40, 40], wp: 'sword', crown: false },
    tower7: { b: 'h', ar: [215, 40, 40], bulk: 1.3, size: 1.12, wp: 'club', belt: GOLD, beard: false },
    inferno1: { b: 'h', sk: DEMON, ar: DEMON, size: .62, head: 'demon', wings: 'bat', wingC: [0, 55, 28] },
    inferno2: { b: 'h', sk: [10, 60, 42], ar: [10, 50, 28], size: .82, head: 'demon', wp: 'wand', wpc: [25, 90, 58] },
    inferno3: { b: 'q', qhead: 'wolf', body: [0, 50, 22], fire: true },
    inferno4: { b: 'h', sk: [0, 55, 38], ar: [0, 40, 24], bulk: 1.2, head: 'demon', wp: 'trident' },
    inferno5: { b: 'h', sk: [355, 55, 32], ar: [355, 45, 22], bulk: 1.35, size: 1.1, head: 'demon', wp: 'sword' },
    inferno6: { b: 'h', sk: [20, 80, 52], ar: [20, 85, 48], noLegs: true, tailSmoke: true, smoke: [18, 90, 50], head: 'demon', fire: true },
    inferno7: { b: 'h', sk: [350, 65, 34], ar: [350, 55, 24], bulk: 1.2, size: 1.1, head: 'demon', wings: 'bat', wingC: [350, 55, 24], wp: 'trident', cape: [350, 50, 20] },
    necropolis1: { b: 'h', skel: true, ar: BONE, wp: 'sword', shield: [30, 20, 34] },
    necropolis2: { b: 'h', sk: [90, 25, 46], ar: [40, 15, 28], head: 'human', armc: [90, 25, 46] },
    necropolis3: { b: 'h', ghost: true, sk: [200, 18, 76], ar: [215, 22, 60], head: 'skull', eyeGlow: '#7af0ff', hood: true, hoodC: [230, 25, 32] },
    necropolis4: { b: 'h', sk: [30, 12, 86], ar: [350, 55, 24], cape: [350, 60, 28], wings: 'bat', wingC: [350, 45, 20], fangs: true, belt: GOLD },
    necropolis5: { b: 'h', skel: true, ar: [270, 40, 28], robe: true, hood: true, hoodC: [270, 40, 20], wp: 'staff', wpc: [280, 90, 62], eyeGlow: '#7af0ff' },
    necropolis6: { b: 'q', qhead: 'horse', body: [260, 12, 18], mane: [0, 0, 8], rider: { ar: BLACK, helm: 'great', plume: [270, 60, 30], wp: 'lance', cape: [270, 50, 16] } },
    necropolis7: { b: 'd', col: BONE, bone: true },
    dungeon1: { b: 'h', sk: [25, 30, 38], ar: [25, 25, 28], size: .82, head: 'lizard', tail: true, belt: [25, 30, 20] },
    dungeon2: { b: 'h', ar: [300, 30, 30], wings: 'feather', wingC: [300, 25, 30], size: .88, ears: false, belt: GOLD },
    dungeon3: { b: 'e' },
    dungeon4: { b: 's', col: [100, 40, 34], snakes: true, wp: 'bow' },
    dungeon5: { b: 'h', sk: [20, 45, 34], ar: [20, 30, 24], bulk: 1.35, size: 1.08, head: 'bull', wp: 'axe' },
    dungeon6: { b: 'q', qhead: 'lion', body: [20, 62, 42], wings: 'bat', wingC: [20, 40, 28], stinger: true, mane: [20, 70, 28] },
    dungeon7: { b: 'd', col: [0, 65, 38] },
    stronghold5: { b: 'bi', col: [35, 40, 38] },
    stronghold6: { b: 'h', sk: [28, 40, 50], ar: [25, 35, 28], bulk: 1.35, size: 1.1, head: 'cyc', wp: 'rock' },
    stronghold7: { b: 'q', qhead: 'rhino', body: [25, 22, 30] },
    fortress1: { b: 'h', sk: [30, 30, 40], ar: LEATH, head: 'wolf', wp: 'mace', belt: [25, 40, 22] },
    fortress2: { b: 'h', sk: [110, 45, 36], ar: [110, 30, 26], head: 'lizard', tail: true, wp: 'bow' },
    fortress3: { b: 'i', col: [75, 55, 36] },
    fortress4: { b: 'q', qhead: 'lizard', body: [50, 50, 36] },
    fortress5: { b: 'q', qhead: 'bull', body: [210, 12, 50], mane: [210, 10, 36] },
    fortress6: { b: 'd', col: [90, 45, 30], wyvern: true },
    fortress7: { b: 'hy' },
    conflux1: { b: 'h', size: .52, ar: [300, 50, 62], wings: 'butterfly', wingC: [300, 55, 66], sk: SKIN },
    conflux2: { b: 'el', kind: 'air' }, conflux3: { b: 'el', kind: 'water' }, conflux4: { b: 'el', kind: 'fire' }, conflux5: { b: 'el', kind: 'earth' }, conflux6: { b: 'el', kind: 'psy' },
    conflux7: { b: 'bi', col: [25, 90, 50], fire: true, wingC: [20, 90, 52] },
  };
  const ALIAS = { stronghold1: 'goblin', stronghold2: 'wolf', stronghold3: 'orc', stronghold4: 'ogre', tower3: 'tower3' };
  const ARCH = { h: humanoid, q: quad, d: dragon, s: serp, bi: bird, i: insect, e: eyeball, k: kraken, sh: shark, hy: hydra, el: elem };
  const cache = {};
  function sprite(id) {
    const base = String(id).replace(/_\d$/, ''), key = base;
    if (cache[key]) return cache[key];
    const spec = FIG[ALIAS[base] || base]; if (!spec) return null;
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'); g.scale(2, 2);
    try { ARCH[spec.b](g, spec); } catch (e) { return cache[key] = null; }
    return cache[key] = cv;
  }
  // how a creature fights: melee = slash | stab | smash | claw | gaze, shoot = arrow | orb | fire | ball | rock | gaze
  const styleCache = {};
  function style(id) {
    const base = String(id).replace(/_\d$/, '');
    if (styleCache[base]) return styleCache[base];
    const sp = FIG[ALIAS[base] || base] || {}, b = sp.b;
    let melee = 'slash', shoot = 'arrow', col = null;
    if (b === 'd') melee = 'claw';
    else if (b === 'q') melee = sp.rider ? 'stab' : (['wolf', 'lizard', 'eagle', 'lion'].includes(sp.qhead) ? 'claw' : 'smash');
    else if (b === 'h') melee = { pike: 'stab', spear: 'stab', lance: 'stab', trident: 'stab', club: 'smash', mace: 'smash', rock: 'smash', axe: 'slash', sword: 'slash' }[sp.wp] || (sp.head === 'wolf' || sp.head === 'lizard' ? 'claw' : sp.golem ? 'smash' : 'slash');
    else if (b === 'bi' || b === 'sh') melee = 'claw';
    else if (b === 'i') melee = 'stab';
    else if (b === 'e') melee = 'gaze';
    else if (b === 'k' || b === 'hy' || b === 'el') melee = 'smash';
    if (sp.wp === 'staff') { shoot = 'orb'; col = sp.wpc ? K(sp.wpc, 8) : 'hsl(280,80%,65%)'; }
    else if (sp.wp === 'wand') { if (sp.wpc && sp.wpc[0] < 40) { shoot = 'fire'; } else { shoot = 'ball'; } }
    else if (sp.wp === 'rock') shoot = 'rock';
    else if (b === 'e') shoot = 'gaze';
    else shoot = 'arrow';
    return styleCache[base] = { melee, shoot, col };
  }
  return { sprite, FIG, style };
})();
