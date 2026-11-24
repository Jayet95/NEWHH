'use strict';
const Battle = (() => {
  const BW = 15, BH = 11, HR = 30, HW = Math.sqrt(3) * HR;
  const OX = (960 - HW * (BW + 0.5)) / 2, OY = 66;
  const EVEN = [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
  const ODD = [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]];
  const FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
  const spd = () => (typeof Settings !== 'undefined' ? Settings.animSpeed : 1);
  const sleep = (ms) => new Promise(r => setTimeout(r, ms / spd()));
  const raf = () => new Promise(r => requestAnimationFrame(r));
  const $ = (id) => document.getElementById(id);

  let B = null, cv, ctx;

  const key = (c, r) => c + ',' + r;
  const hexPx = (c, r) => ({ x: OX + HW * (c + 0.5 * (r & 1)) + HW / 2, y: OY + HR * 1.5 * r + HR });
  const inB = (c, r) => c >= 0 && r >= 0 && c < BW && r < BH;
  const nbrs = (c, r) => (r & 1 ? ODD : EVEN).map(d => [c + d[0], r + d[1]]).filter(p => inB(p[0], p[1]));
  function cube(c, r) { const x = c - (r - (r & 1)) / 2; return { x, z: r, y: -x - r }; }
  function hexDist(a, b) { const p = cube(a.c, a.r), q = cube(b.c, b.r); return Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y), Math.abs(p.z - q.z)); }
  function hexAt(px, py) {
    let best = null, bd = HR * 0.93;
    for (let r = 0; r < BH; r++) for (let c = 0; c < BW; c++) {
      const h = hexPx(c, r), d = Math.hypot(h.x - px, h.y - py);
      if (d < bd) { bd = d; best = { c, r }; }
    }
    return best;
  }

  const alive = (side) => B.stacks.filter(s => !s.dead && (side === undefined || s.side === side));
  // phone landscape: "crop to action" - zoom so every living stack is in view (never below the full-field fit, never huge) and centre on them
  function frameAction(cur, smooth) {
    try {
      const st = document.getElementById('stage'), c = document.getElementById('bat');
      if (!st || !c || document.body.classList.contains('bzfit') || !matchMedia('(orientation: landscape) and (max-height: 540px)').matches) return false;
      const us = alive(); if (cur && !us.includes(cur)) us.push(cur);
      if (!us.length) return false;
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const u of us) { x0 = Math.min(x0, u.px); x1 = Math.max(x1, u.px); y0 = Math.min(y0, u.py); y1 = Math.max(y1, u.py); }
      x0 -= 80; x1 += 80; y0 = 0; y1 = Math.min(640, y1 + 70);   // a hex around the outermost stacks; the turn-order strip on top always stays in view
      const bw = Math.max(240, x1 - x0), bh = Math.max(200, y1 - y0);
      const Hs = st.clientHeight, Ws = st.clientWidth;
      const H = Math.min(Ws * 640 / bw, Hs * 640 / bh);
      const cover = 0.85 * Ws / (1.5 * Hs);   // nearly fill the width: only thin grass margins at the sides
      const k = Math.min(2.4, Math.max(1, cover, Math.min(1.9, H / Hs)));
      st.style.setProperty('--bk', k.toFixed(3));
      const cw = c.clientWidth, ch = c.clientHeight;   // forces layout with the new zoom
      let top = Math.max(0, ((y0 + y1) / 2 / 640) * ch - Hs / 2); const maxTop = Math.max(0, ch - Hs);
      top = Math.min(top, maxTop);
      if (cur && (y1 - y0) / 640 * ch > Hs) top = Math.max(0, Math.min(maxTop, (cur.py / 640) * ch - Hs * 0.5));   // the whole action does not fit: keep the unit whose turn it is in view
      st.scrollTo({ left: Math.max(0, ((x0 + x1) / 2 / 960) * cw - Ws / 2), top, behavior: smooth ? 'smooth' : 'auto' });
      return true;
    } catch (e) { return false; }
  }
  // double-width creatures: head hex (c, r) plus a tail hex one column behind (to the left for your side, to the right for the enemy)
  const isWide = (s) => !!(C[s.t].wide && B && !B.siege);
  const tailAt = (s, c = s.c, r = s.r) => { if (!isWide(s)) return null; const tc = c + (s.side === 0 ? -1 : 1); return inB(tc, r) ? [tc, r] : null; };
  const occHexes = (s, c = s.c, r = s.r) => { const t = tailAt(s, c, r); return t ? [[c, r], t] : [[c, r]]; };
  const stackAt = (c, r) => B.stacks.find(s => { if (s.dead) return false; if (s.c === c && s.r === r) return true; const t = tailAt(s); return !!t && t[0] === c && t[1] === r; });
  const COARSE = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : false;
  const sfx = (n) => { if (typeof Sfx !== 'undefined') Sfx.play(n); };
  // a creature's own voice: kind = attack | defend | death | shoot (shot = the shot style, for shooters)
  const csfx = (t, kind, shot) => { if (typeof Sfx !== 'undefined' && Sfx.creature) Sfx.creature(t, kind, shot); };
  // the crest, ribbon and subtitle at the top of the victory / defeat cards (also used by the end-of-game victory screen)
  window.vicBanner = (title, sub, kind = 'win') => `<div class="vic ${kind}"><div class="vic-rays"></div><div class="vic-crest">${kind === 'win' ? '👑' : '💀'}</div><div class="vic-ribbon"><span>${title}</span></div>${sub ? `<p class="vic-sub">${sub}</p>` : ''}</div>`;
  const perk = (id) => (B.hero && B.hero.perks && B.hero.perks[id]) || 0;
  const speedOf = (s) => Math.max(1, C[s.t].s + (s.haste || 0) - (s.slow || 0));
  const abil = (s, k) => {
    for (const x of (C[s.t].ab || [])) { if (x === k) return true; if (x.startsWith(k + ':')) return parseFloat(x.slice(k.length + 1)); }
    return false;
  };
  const hates = (a, d) => (C[a.t].ab || []).some(x => x.startsWith('hate:') && x.slice(5) === C[d.t].line);
  const adjStacks = (s) => [...new Set(occHexes(s).flatMap(([c0, r0]) => nbrs(c0, r0).map(([c, r]) => stackAt(c, r)).filter(o => o && o !== s)))];
  const HERO_POS = [{ x: 38, y: 310 }, { x: 922, y: 310 }];
  const STRUCT = { wall: { hp: 120, n: 'Wall', i: '🧱' }, gate: { hp: 160, n: 'Gate', i: '🚪' }, tower: { hp: 200, n: 'Arrow Tower', i: '🗼' } };
  const blockedGround = (c, r) => B.obs.has(key(c, r)) || (B.siege && (B.walls.has(key(c, r)) || B.moat.has(key(c, r))));
  const structAt = (c, r) => B.siege ? B.walls.get(key(c, r)) : undefined;
  const isAttacker = (s) => B.siege && s.side !== B.siege.dside;
  const bonus = (s) => s.side === 0 ? B.hero : B.eStats;
  const attackOf = (s) => Math.max(0, C[s.t].a + bonus(s).att + (s.bloodlust || 0) - (s.weak > 0 ? 3 : 0));
  const defenceOf = (s) => Math.max(0, C[s.t].d + bonus(s).def + (s.stone || 0) + (s.defb ? 3 : 0) - (s.disr > 0 ? 3 : 0));
  const totalHp = (s) => (s.n - 1) * C[s.t].hp + s.hp;
  const adjEnemy = (s) => occHexes(s).some(([c0, r0]) => nbrs(c0, r0).some(([c, r]) => { const o = stackAt(c, r); return o && o.side !== s.side; }));
  const canShoot = (s) => C[s.t].shoot && s.ammo > 0 && !(s.noshoot > 0) && !adjEnemy(s);

  // shooters: stronger point blank, weaker far away, half damage beyond 10 hexes ("broken arrow")
  function rangeMul(a, d) {
    const dd = hexDist(a, d);
    if (dd > 10) return 0.5;
    return Math.max(0.85, 1.25 - 0.05 * Math.max(0, dd - 2));
  }
  function rangeNote(a, d) {
    const dd = hexDist(a, d), m = rangeMul(a, d);
    return dd > 10 ? `  💔 Broken arrow: ${dd} hexes — half damage` : m >= 1.1 ? `  🎯 Close range (+${Math.round((m - 1) * 100)}%)` : m < 0.95 ? `  ↘ Long range (${Math.round((m - 1) * 100)}%)` : '';
  }
  function baseDmg(a, avg) {
    const c = C[a.t];
    if (a.bless) return a.n * c.hi;
    if (a.curse) return a.n * c.lo;
    if (avg) return a.n * (c.lo + c.hi) / 2;
    const k = Math.min(a.n, 12); let sum = 0;
    for (let i = 0; i < k; i++) sum += c.lo + Math.floor(Math.random() * (c.hi - c.lo + 1));
    return sum * a.n / k;
  }
  // striking a creature from behind (from the hexes on the side opposite to the way it faces) is worth extra attack points
  const REAR_BONUS = 3;
  function isRear(a, d, from) {
    const p = hexPx(from ? from.c : a.c, from ? from.r : a.r), q = hexPx(d.c, d.r), face = d.side === 0 ? 1 : -1;
    return (p.x - q.x) * face < -1;
  }
  function calcDmg(a, d, melee, avg, joust, from) {
    const c = C[a.t];
    const base = baseDmg(a, avg);
    const A = attackOf(a) + (melee && isRear(a, d, from) ? REAR_BONUS : 0); let D = defenceOf(d);
    const pr = abil(a, 'pierce'); if (pr) D = Math.floor(D * (1 - pr));
    let m = A >= D ? 1 + 0.05 * Math.min(A - D, 60) : 1 - 0.025 * Math.min(D - A, 28);
    if (melee && c.shoot && !abil(a, 'nopen')) m *= 0.5;
    if (hates(a, d)) m *= 2;
    if (!melee && d.shield) m *= 1 - d.shield;
    if (!melee && c.shoot) m *= rangeMul(a, d);
    if (melee && joust) m *= 1 + 0.05 * joust;
    if (a.side === 0) m *= 1 + 0.1 * perk(melee ? 'offense' : 'archery');
    return Math.max(1, Math.floor(base * m));
  }
  function applyDmg(s, dmg) {
    const c = C[s.t], before = s.n;
    let total = totalHp(s) - dmg;
    if (total <= 0) { s.n = 0; s.dead = true; return before; }
    s.n = Math.ceil(total / c.hp); s.hp = total - (s.n - 1) * c.hp;
    return before - s.n;
  }
  function healStack(s, amt, cap) {
    const c = C[s.t], before = totalHp(s), total = Math.min(before + amt, cap * c.hp);
    s.n = Math.ceil(total / c.hp); s.hp = total - (s.n - 1) * c.hp;
    return total - before;
  }
  function hitStruct(st, dmg, label) {
    st.hp -= dmg;
    const p = hexPx(st.c, st.r);
    B.fx.push({ x: p.x, y: p.y - 20, txt: '-' + dmg, col: '#ffd24a', t0: performance.now(), kind: 'struct' });
    st.flash = performance.now(); sfx(st.hp <= 0 ? 'crash' : 'hit');
    fxStruct(st, dmg);
    log(`${label} the ${STRUCT[st.k].n}: ${dmg} dmg (${Math.max(0, st.hp)}/${st.max}).`);
    if (st.hp <= 0) { B.walls.delete(key(st.c, st.r)); log(`💥 The ${STRUCT[st.k].n} is destroyed!`); fxCollapse(st); }
  }
  // kind: 'melee' (default), 'ranged', 'spell', 'strike' (hero strike), 'breath', 'mine' - only changes how the hit looks
  function hit(target, dmg, label, kind) {
    if (target.side === 0) dmg = Math.max(1, Math.floor(dmg * (1 - 0.07 * perk('armorer'))));
    kind = kind || 'melee';
    const pool = totalHp(target), now = performance.now(), dn = kind === 'spell' && B.fxDelays ? (B.fxDelays.get(target) || 0) : 0, dl = dn / spd();
    const killed = applyDmg(target, dmg); sfx('hit'); csfx(target.t, target.dead ? 'death' : 'defend');
    target.flash = now + dl; target.hurt = target.flash; if (target.dead) target.deadAt = target.flash;
    if (target.side === 1) B.xp += killed * C[target.t].hp;
    const p = hexPx(target.c, target.r);
    B.fx.push({ x: p.x, y: p.y - 20, txt: '-' + dmg, col: '#ff6a5a', t0: now + dl, kind, big: dmg >= pool * 0.3, sub: killed > 0 ? '☠ ' + killed : '' });
    if (target.dead) later(dl * spd() + 80, () => deathFx(target, p));
    fxHit(target, dmg, pool, kind, dn);
    log(`${label} ${C[target.t].n}: ${dmg} dmg, ${killed} killed.`);
    return killed;
  }
  function log(t) {
    const el = $('blog'); if (!el) return;
    const d = document.createElement('div'); d.textContent = t; el.appendChild(d); el.scrollTop = el.scrollHeight;
  }

  // ======================================================================================================
  // Cosmetic effects: particles, bolts, auras, rings, screen shake and a gentle camera push.
  // Nothing in here reads or changes game results. With "reduce motion" the shake, camera push and flashes
  // are skipped and particle counts are cut down. Particles are capped so big fights stay smooth.
  // ======================================================================================================
  let DPR = 1;
  const reduced = () => { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } };
  const R = (a, b) => a + Math.random() * (b - a);
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; };
  const pickCol = (c) => (Array.isArray(c) ? c[(Math.random() * c.length) | 0] : c);
  // run fn after ms of battle time (scaled by the animation speed); does nothing if the battle has ended meanwhile
  const later = (ms, fn) => { const bb = B; setTimeout(() => { if (B && B === bb) fn(); }, ms / spd()); };
  const hexC = (c, r) => { const p = hexPx(c, r); return { x: p.x, y: p.y }; };
  const PAL = {
    fire: ['#fff3b0', '#ffb040', '#ff7a1a', '#e0431a'], ice: ['#ffffff', '#bfefff', '#7fd4ff', '#4aa8ff'], arc: ['#ffffff', '#c9e6ff', '#7fb8ff'],
    dark: ['#c58cff', '#8a3ad8', '#4a1a7a'], heal: ['#ffffff', '#b8ffcc', '#6dff9a'], gold: ['#ffffff', '#fff1a8', '#ffd24a'], dust: ['#b9a98a', '#8a7a5c', '#a89878'], rock: ['#a49a88', '#7a7262', '#5a5244'],
  };
  const SC = { arrow: '#9fd0ff', lightning: '#9fc8ff', chain: '#9fc8ff', implosion: '#b06cff', fireball: '#ff9a3a', meteor: '#ff7a2a', frostring: '#8fdcff', armageddon: '#ff6a2a', icebolt: '#9fe6ff', slow: '#7fb0d8', curse: '#9a4ad8', blind: '#fff1b0', haste: '#8fe8ff', bless: '#ffe27a', stone: '#b7aa90', bloodlust: '#ff5a4a', shield: '#7fb8ff', heal: '#7dff9a', dispel: '#ffffff', weakness: '#9ab86a', disrupt: '#ffd24a', forget: '#b8a8d8', destroyundead: '#fff1a8', deathripple: '#7ad88a', prayer: '#ffe9a0', berserk: '#ff4a3a', hypnotize: '#ff8ad8', resurrect: '#fff1a8' };
  const MAXP = 420;
  function emit(p) { if (!B || B.parts.length >= MAXP) return; B.parts.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 1.5, life: 500, size: 3, col: '#ffffff', kind: 'dot', add: true, grow: 0, rot: R(0, 6.28), vr: R(-5, 5), t0: performance.now() }, p)); }
  function burst(x, y, n, o) {
    if (!B) return;
    n = Math.max(1, Math.round(n * (reduced() ? 0.3 : 1)));
    for (let i = 0; i < n; i++) {
      const a = o.dir !== undefined ? o.dir + R(-(o.spread || 0.4), o.spread || 0.4) : R(0, 6.2832), v = R(o.v0 === undefined ? 40 : o.v0, o.v1 === undefined ? 160 : o.v1), j = o.jit || 0;
      emit({ x: x + R(-j, j), y: y + R(-j, j), vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.up || 0), g: o.g || 0, drag: o.drag === undefined ? 1.8 : o.drag, life: R(o.l0 || 350, o.l1 || 700) / spd(), size: R(o.s0 || 1.5, o.s1 || 3.5), col: pickCol(o.col || '#ffffff'), kind: o.kind || 'dot', add: o.add !== false && o.kind !== 'smoke', grow: o.grow || 0 });
    }
  }
  function addFx(o) {
    if (!B) return;
    B.efx.push(Object.assign({ k: 'ring' }, o, { t0: performance.now() + (o.delay || 0) / spd(), dur: (o.dur || 500) / spd() }));
    if (B.efx.length > 90) B.efx.shift();
  }
  const ring = (x, y, r1, col, o) => addFx(Object.assign({ k: 'ring', x, y, r0: 6, r1, col, w: 4, dur: 520, flat: 0.6 }, o));
  const flash = (col, a, dur, delay) => { if (!reduced()) addFx({ k: 'flash', col, a, dur, delay }); };
  const missile = (x1, y1, x2, y2, col, dur, o) => addFx(Object.assign({ k: 'missile', x1, y1, x2, y2, col, dur, arc: 18, size: 6 }, o));
  function boltPts(x1, y1, x2, y2, jag) {
    const n = 9, pts = [[x1, y1]], dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    for (let i = 1; i < n; i++) { const t = i / n, j = (Math.random() - 0.5) * 2 * jag * Math.sin(Math.PI * t); pts.push([x1 + dx * t + nx * j, y1 + dy * t + ny * j]); }
    pts.push([x2, y2]); return pts;
  }
  function bolt(x1, y1, x2, y2, col, o) {
    const main = boltPts(x1, y1, x2, y2, 18), br = [];
    for (let b = 0; b < 2; b++) { const q = main[2 + ((Math.random() * 5) | 0)]; br.push(boltPts(q[0], q[1], q[0] + R(-60, 60), q[1] + R(10, 60), 10)); }
    addFx(Object.assign({ k: 'bolt', pts: main, br, col, w: 3, dur: 380 }, o));
  }
  // The battlefield never moves: no screen shake and no camera push (they made some players feel sick). Set to true to bring them back.
  const CAMERA_FX = false;
  function shake(amp, dur) {
    if (!CAMERA_FX) return;
    if (!B || reduced() || !amp) return;
    const now = performance.now(), s = B.shake;
    if (s && s.amp * Math.max(0, 1 - (now - s.t0) / s.dur) > amp) return;
    B.shake = { t0: now, dur: (dur || 260) / spd(), amp: Math.min(7, amp) };
  }
  // a brief, small zoom toward a point of interest; only used while the player cannot click (so aiming is never off)
  function push(x, y, amt, dur) { if (!CAMERA_FX || !B || reduced() || x === undefined) return; B.cam = { t0: performance.now(), dur: (dur || 520) / spd(), x, y, amt }; }
  function shakeOff(now) {
    const s = B.shake; if (!s) return null;
    const k = (now - s.t0) / s.dur; if (k >= 1) { B.shake = null; return null; }
    const a = s.amp * (1 - k) * (1 - k); return { x: Math.sin(now / 17) * a, y: Math.cos(now / 23) * a * 0.8 };
  }
  function camNow(now) {
    const c = B.cam; if (!c) return null;
    const k = (now - c.t0) / c.dur; if (k >= 1) { B.cam = null; return null; }
    const e = Math.sin(Math.PI * k); return { z: 1 + c.amt * e * e, x: c.x, y: c.y };
  }
  // ---- named bursts ----
  function fireBurst(x, y, big) {
    burst(x, y, big ? 30 : 18, { kind: 'dot', col: PAL.fire, v0: 40, v1: big ? 230 : 160, l0: 260, l1: 560, s0: 2.5, s1: 5, drag: 3 });
    burst(x, y, big ? 14 : 8, { kind: 'ember', col: PAL.fire, v0: 20, v1: 110, up: 80, g: 70, l0: 500, l1: 1000, s0: 1.8, s1: 3.2, drag: 1.2 });
    burst(x, y - 6, big ? 8 : 5, { kind: 'smoke', col: ['#3a3530', '#554a40'], v0: 8, v1: 40, up: 28, l0: 600, l1: 1100, s0: 6, s1: 11, grow: 1.4 });
  }
  function fxDeath(s) {
    const p = hexPx(s.c, s.r);
    burst(p.x, p.y + 20, 12, { kind: 'smoke', col: PAL.dust, v0: 10, v1: 70, up: 16, l0: 520, l1: 980, s0: 5, s1: 10, grow: 1.2 });
    burst(p.x, p.y + 14, 7, { kind: 'spark', col: ['#d8c8a0', '#ffffff'], v0: 40, v1: 150, l0: 200, l1: 420, s0: 1.2, s1: 2, drag: 3 });
  }
  function fxHit(target, dmg, pool, kind, dn) {
    const p = hexPx(target.c, target.r), big = dmg / Math.max(1, pool), dead = target.dead;
    const run = () => {
      const pal = kind === 'spell' || kind === 'strike' ? (B.fxPal || PAL.arc) : kind === 'ranged' ? ['#fff6d0', '#ffd98a', '#ffb04a'] : kind === 'mine' || kind === 'breath' ? PAL.fire : ['#ffffff', '#fff1b0', '#ffd24a'];
      burst(p.x, p.y - 4, Math.round(6 + Math.min(14, big * 30)), { kind: 'spark', col: pal, v0: 90, v1: 260, l0: 180, l1: 380, s0: 1.2, s1: 2.4, drag: 3 });
      if (dead) { fxDeath(target); shake(5.5, 340); } else if (big > 0.35) shake(3.8, 260); else if (big > 0.15) shake(2, 200);
    };
    if (dn > 0) later(dn, run); else run();
  }
  function fxStruct(st, dmg) {
    const p = hexPx(st.c, st.r);
    burst(p.x, p.y, 8, { kind: 'spark', col: ['#ffe9b0', '#d8c8a0'], v0: 70, v1: 200, l0: 200, l1: 420, s0: 1.2, s1: 2.2, drag: 3 });
    burst(p.x, p.y + 6, 5, { kind: 'smoke', col: PAL.dust, v0: 8, v1: 40, up: 14, l0: 500, l1: 900, s0: 5, s1: 9, grow: 1.1 });
    if (dmg > st.max * 0.12) shake(2.2, 220);
  }
  function fxCollapse(st) {
    const p = hexPx(st.c, st.r);
    burst(p.x, p.y + 4, 16, { kind: 'smoke', col: PAL.dust, v0: 14, v1: 90, up: 22, l0: 700, l1: 1300, s0: 7, s1: 14, grow: 1.5 });
    burst(p.x, p.y, 14, { kind: 'shard', col: PAL.rock, v0: 60, v1: 220, up: 90, g: 380, l0: 500, l1: 900, s0: 2, s1: 4, drag: 0.6 });
    ring(p.x, p.y + 10, 66, '#d8c8a0', { dur: 520 });
    shake(5, 380);
  }
  function fxMine(p) {
    fireBurst(p.x, p.y, true); ring(p.x, p.y + 8, 70, '#ffb050', { dur: 520 }); flash('#ff9a3a', 0.16, 220); shake(4, 300);
    burst(p.x, p.y, 12, { kind: 'shard', col: PAL.rock, v0: 60, v1: 220, up: 90, g: 380, l0: 500, l1: 900, s0: 2, s1: 4, drag: 0.6 });
  }
  const sparkleUp = (s, c, n) => { const p = hexC(s.c, s.r); burst(p.x, p.y + 10, n || 12, { kind: 'sparkle', col: c, dir: -Math.PI / 2, spread: 1, v0: 25, v1: 80, jit: 14, l0: 500, l1: 900, s0: 2, s1: 4, drag: 1.2 }); };
  const aura = (s, c, shape, ms) => addFx({ k: 'aura', s, col: c, shape, dur: ms || 900 });
  function fxHeal(s) { sparkleUp(s, PAL.heal, 14); const p = hexC(s.c, s.r); ring(p.x, p.y + 12, 40, '#7dff9a', { dur: 520 }); aura(s, '#7dff9a', 'glow', 800); }
  function fxSummon(p) {
    addFx({ k: 'beam', x: p.x, y: p.y, col: '#9fe8ff', w: 22, dur: 700 }); ring(p.x, p.y + 10, 56, '#9fe8ff', { dur: 600 }); flash('#bfefff', 0.14, 260);
    burst(p.x, p.y, 16, { kind: 'sparkle', col: PAL.ice, dir: -Math.PI / 2, spread: 1.2, v0: 30, v1: 110, jit: 16, l0: 500, l1: 1000, s0: 2, s1: 4, drag: 1.2 });
  }
  // chain lightning hop: an arc from the previous target (or the hero) to this one, timed with its damage number
  function chainFx(a, s, i) {
    const dn = 70 + i * 130, b = hexC(s.c, s.r);
    if (B.fxDelays) B.fxDelays.set(s, dn);
    later(Math.max(0, dn - 60), () => { bolt(a.x, a.y, b.x, b.y, '#9fc8ff', { dur: 300 }); burst(b.x, b.y, 12, { kind: 'spark', col: PAL.arc, v0: 80, v1: 240, l0: 200, l1: 420, s0: 1.2, s1: 2.4, drag: 3 }); ring(b.x, b.y + 8, 40, '#9fc8ff', { dur: 400 }); });
  }
  // the visual for each spell; runs just before the spell's effects are applied
  function spellFx(k, t, r) {
    if (!B) return;
    const col = SC[k] || '#c9b6ff', H = HERO_POS[0], hp = { x: H.x + 18, y: H.y - 8 }, tp = hexC(t.c, t.r);
    B.fxDelays = new Map(); B.fxPal = ['#ffffff', col, col]; if (B.shot) B.shot.quiet = true;
    const dl = (s, ms) => B.fxDelays.set(s, ms);
    const foes = r >= 3 ? alive(1) : [t], allies = r >= 3 ? alive(0) : [t], area = (rad) => alive(1).filter(e => e === t || hexDist(e, t) <= rad);
    burst(hp.x, hp.y, 12, { kind: 'sparkle', col: ['#ffffff', col], v0: 20, v1: 90, l0: 300, l1: 620, s0: 2, s1: 4, drag: 2.5 });
    addFx({ k: 'ring', x: H.x, y: H.y, r0: 12, r1: 56, col, w: 3, dur: 460, flat: 1 });
    push(tp.x, tp.y, 0.03, 650);
    switch (k) {
      case 'arrow': missile(hp.x, hp.y, tp.x, tp.y, col, 240, { arc: 10 }); dl(t, 240); later(240, () => burst(tp.x, tp.y, 10, { kind: 'spark', col: PAL.arc, v0: 70, v1: 200, l0: 200, l1: 400, s0: 1.2, s1: 2.2, drag: 3 })); break;
      case 'lightning': bolt(tp.x + R(-24, 24), -10, tp.x, tp.y, col, { dur: 420 }); flash('#cfe4ff', 0.22, 260); dl(t, 60); later(60, () => { burst(tp.x, tp.y, 16, { kind: 'spark', col: PAL.arc, v0: 80, v1: 260, l0: 220, l1: 450, s0: 1.2, s1: 2.6, drag: 3 }); ring(tp.x, tp.y + 10, 46, col, { dur: 420 }); shake(2.5, 220); }); break;
      case 'chain': flash('#cfe4ff', 0.16, 300); break;
      case 'implosion': {
        addFx({ k: 'ring', x: tp.x, y: tp.y, r0: 70, r1: 2, col, w: 5, dur: 420, flat: 0.8 });
        for (let i = 0; i < 18; i++) { const a = R(0, 6.28), d = R(50, 80); emit({ x: tp.x + Math.cos(a) * d, y: tp.y + Math.sin(a) * d, vx: -Math.cos(a) * d / 0.4, vy: -Math.sin(a) * d / 0.4, drag: 0, life: 400 / spd(), size: R(2, 4), col: pickCol(PAL.dark), kind: 'dot' }); }
        dl(t, 420); later(420, () => { burst(tp.x, tp.y, 24, { kind: 'dot', col: PAL.dark, v0: 60, v1: 220, l0: 300, l1: 600, s0: 2, s1: 4.5, drag: 3 }); ring(tp.x, tp.y, 74, '#ffffff', { dur: 380, flat: 0.8 }); shake(5, 360); flash('#e8d0ff', 0.28, 300); }); break;
      }
      case 'fireball': {
        const vs = area(r >= 3 ? 2 : 1); missile(hp.x, hp.y, tp.x, tp.y, '#ff9a3a', 300, { arc: 40, size: 9 }); vs.forEach(e => dl(e, 300));
        later(300, () => { vs.forEach(e => { const p = hexC(e.c, e.r); fireBurst(p.x, p.y, e === t); }); ring(tp.x, tp.y + 6, r >= 3 ? 150 : 96, '#ffb050', { dur: 560 }); flash('#ff9a3a', 0.2, 280); shake(3, 300); }); break;
      }
      case 'meteor': {
        area(r >= 3 ? 2 : 1).forEach((e, i) => {
          const p = hexC(e.c, e.r), d0 = i * 70, d = 330; dl(e, d0 + d);
          missile(p.x + 160, p.y - 380, p.x, p.y, '#ff7a2a', d, { arc: 0, delay: d0, size: 7 });
          later(d0 + d, () => { fireBurst(p.x, p.y, true); burst(p.x, p.y, 8, { kind: 'shard', col: PAL.rock, v0: 60, v1: 200, up: 80, g: 340, l0: 400, l1: 800, s0: 2, s1: 3.6, drag: 0.8 }); ring(p.x, p.y + 8, 58, '#ffb050', { dur: 480 }); shake(3, 240); });
        }); break;
      }
      case 'frostring': {
        const vs = area(1); ring(tp.x, tp.y + 6, HW * 1.7, '#8fdcff', { dur: 600, w: 6, fill: 1 });
        burst(tp.x, tp.y, 26, { kind: 'shard', col: PAL.ice, v0: 70, v1: 210, l0: 400, l1: 800, s0: 2, s1: 3.6, drag: 1.6 });
        burst(tp.x, tp.y, 8, { kind: 'smoke', col: ['#dff6ff', '#bfe8ff'], v0: 10, v1: 50, up: 10, l0: 600, l1: 1000, s0: 7, s1: 12, grow: 1.3 }); flash('#bfe8ff', 0.15, 300);
        vs.forEach(e => { dl(e, 120); const p = hexC(e.c, e.r); later(120, () => burst(p.x, p.y, 10, { kind: 'sparkle', col: PAL.ice, v0: 20, v1: 80, l0: 400, l1: 800, s0: 2, s1: 3.6, drag: 1.5 })); }); break;
      }
      case 'icebolt':
        missile(hp.x, hp.y, tp.x, tp.y, '#9fe6ff', 260, { arc: 14 }); dl(t, 260);
        later(260, () => { burst(tp.x, tp.y, 16, { kind: 'shard', col: PAL.ice, v0: 70, v1: 200, l0: 350, l1: 700, s0: 2, s1: 3.4, drag: 1.6 }); ring(tp.x, tp.y + 8, 50, '#9fe6ff', { dur: 460 }); }); break;
      case 'armageddon': {
        flash('#ff6a2a', 0.28, 700); shake(5, 700);
        for (let i = 0; i < 26; i++) later(i * 24, () => emit({ x: R(40, 920), y: -10, vx: R(-60, -20), vy: R(260, 420), life: 900 / spd(), size: R(2.5, 5), col: pickCol(PAL.fire), kind: 'ember', drag: 0 }));
        alive().forEach((e, i) => { const p = hexC(e.c, e.r), d = 220 + (i % 5) * 50; dl(e, d); later(d, () => fireBurst(p.x, p.y, false)); }); break;
      }
      case 'slow': foes.forEach(e => { aura(e, col, 'swirl', 1000); const p = hexC(e.c, e.r); burst(p.x, p.y, 6, { kind: 'smoke', col: ['#9ab8d0', '#7a98b0'], v0: 6, v1: 30, l0: 600, l1: 1000, s0: 5, s1: 9, grow: 1 }); }); break;
      case 'curse': foes.forEach(e => { aura(e, col, 'swirl', 1000); const p = hexC(e.c, e.r); burst(p.x, p.y - 20, 12, { kind: 'dot', col: PAL.dark, dir: Math.PI / 2, spread: 0.7, v0: 10, v1: 50, g: 140, jit: 16, l0: 500, l1: 900, s0: 1.6, s1: 3, drag: 0.8 }); }); break;
      case 'blind': foes.forEach(e => { const p = hexC(e.c, e.r); ring(p.x, p.y - 6, 44, '#ffffff', { dur: 420, flat: 1 }); burst(p.x, p.y - 6, 14, { kind: 'sparkle', col: ['#ffffff', '#fff1b0'], v0: 30, v1: 120, l0: 300, l1: 600, s0: 2, s1: 4, drag: 2 }); aura(e, '#fff1b0', 'glow', 500); }); break;
      case 'weakness': foes.forEach(e => { aura(e, col, 'swirl', 900); const p = hexC(e.c, e.r); burst(p.x, p.y - 22, 10, { kind: 'dot', col: ['#9ab86a', '#6a8a40'], dir: Math.PI / 2, spread: 0.6, v0: 20, v1: 60, g: 220, jit: 14, l0: 500, l1: 900, s0: 1.8, s1: 3.2, drag: 0.6 }); }); break;
      case 'forget': foes.forEach(e => { aura(e, col, 'swirl', 900); const p = hexC(e.c, e.r); burst(p.x, p.y - 8, 8, { kind: 'smoke', col: ['#b8a8d8', '#8a7aa8'], v0: 8, v1: 36, up: 14, l0: 600, l1: 1000, s0: 6, s1: 11, grow: 1.2 }); }); break;
      case 'disrupt': foes.forEach(e => { const p = hexC(e.c, e.r); burst(p.x, p.y, 16, { kind: 'spark', col: ['#ffffff', '#ffd24a'], v0: 90, v1: 240, l0: 200, l1: 420, s0: 1.4, s1: 2.6, drag: 3 }); ring(p.x, p.y + 8, 42, '#ffd24a', { dur: 420 }); }); shake(2, 220); break;
      case 'haste': allies.forEach(a => { aura(a, col, 'haste', 1000); const p = hexC(a.c, a.r); burst(p.x, p.y, 8, { kind: 'streak', col: ['#8fe8ff', '#ffffff'], dir: Math.PI, spread: 0.15, v0: 80, v1: 160, jit: 14, l0: 250, l1: 450, s0: 3, s1: 6, drag: 1.5 }); }); break;
      case 'bless': allies.forEach(a => { aura(a, col, 'glow', 1000); sparkleUp(a, PAL.gold, 12); }); break;
      case 'stone': allies.forEach(a => { aura(a, col, 'rock', 1000); const p = hexC(a.c, a.r); burst(p.x, p.y - 20, 8, { kind: 'shard', col: PAL.rock, dir: Math.PI / 2, spread: 0.8, v0: 10, v1: 60, g: 240, jit: 16, l0: 400, l1: 800, s0: 1.8, s1: 3.2, drag: 0.6 }); }); break;
      case 'bloodlust': allies.forEach(a => { aura(a, col, 'glow', 1000); const p = hexC(a.c, a.r); burst(p.x, p.y, 10, { kind: 'ember', col: ['#ff8a5a', '#ff3a2a'], dir: -Math.PI / 2, spread: 0.9, v0: 30, v1: 90, jit: 14, l0: 500, l1: 900, s0: 1.8, s1: 3, drag: 1 }); }); break;
      case 'shield': allies.forEach(a => aura(a, col, 'bubble', 1100)); break;
      case 'prayer': flash('#ffe9a0', 0.14, 400); alive(0).forEach(a => { aura(a, col, 'glow', 1100); sparkleUp(a, PAL.gold, 8); }); break;
      case 'heal': allies.forEach(a => fxHeal(a)); break;
      case 'resurrect': addFx({ k: 'beam', x: tp.x, y: tp.y, col: '#fff1a8', w: 24, dur: 800 }); sparkleUp(t, PAL.gold, 18); ring(tp.x, tp.y + 12, 52, '#fff1a8', { dur: 640 }); aura(t, '#fff1a8', 'glow', 900); break;
      case 'dispel': ring(tp.x, tp.y + 8, 52, '#ffffff', { dur: 480 }); burst(tp.x, tp.y, 16, { kind: 'sparkle', col: ['#ffffff', '#cfe8ff'], v0: 30, v1: 120, l0: 400, l1: 800, s0: 2, s1: 4, drag: 1.8 }); aura(t, '#ffffff', 'glow', 600); break;
      case 'destroyundead':
        flash('#fff1a8', 0.2, 340);
        alive().filter(s2 => C[s2.t].fac === 'necropolis').forEach(s2 => { const p = hexC(s2.c, s2.r); dl(s2, 120); addFx({ k: 'beam', x: p.x, y: p.y, col: '#fff1a8', w: 20, dur: 600 }); later(120, () => burst(p.x, p.y, 12, { kind: 'sparkle', col: PAL.gold, v0: 40, v1: 130, l0: 300, l1: 700, s0: 2, s1: 4, drag: 1.8 })); }); break;
      case 'deathripple': {
        addFx({ k: 'ring', x: 480, y: 320, r0: 10, r1: 900, col: '#7ad88a', w: 8, dur: 900, flat: 0.6 });
        alive().filter(s2 => C[s2.t].fac !== 'necropolis' && !abil(s2, 'mindless')).forEach(s2 => { const p = hexC(s2.c, s2.r), d = Math.min(850, Math.hypot(p.x - 480, (p.y - 320) / 0.6) * 0.95); dl(s2, d); later(d, () => burst(p.x, p.y, 10, { kind: 'smoke', col: ['#7ad88a', '#3a8a4a'], v0: 10, v1: 60, up: 20, l0: 500, l1: 900, s0: 5, s1: 9, grow: 1.1 })); }); break;
      }
      case 'berserk': aura(t, col, 'swirl', 1000); burst(tp.x, tp.y, 12, { kind: 'ember', col: ['#ff8a5a', '#ff3a2a'], dir: -Math.PI / 2, spread: 1, v0: 30, v1: 100, jit: 14, l0: 500, l1: 900, s0: 1.8, s1: 3, drag: 1 }); break;
      case 'hypnotize': aura(t, col, 'swirl', 1100); ring(tp.x, tp.y - 6, 44, col, { dur: 520, flat: 1 }); burst(tp.x, tp.y - 6, 12, { kind: 'sparkle', col: ['#ffffff', '#ff8ad8'], v0: 20, v1: 80, l0: 400, l1: 800, s0: 2, s1: 4, drag: 1.6 }); break;
      default: ring(tp.x, tp.y + 8, 48, col, { dur: 460 }); burst(tp.x, tp.y, 12, { kind: 'sparkle', col: ['#ffffff', col], v0: 30, v1: 110, l0: 300, l1: 650, s0: 2, s1: 4, drag: 1.8 });
    }
  }
  function glow(x, y, r, col, a) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
  // draws and advances every particle and effect (called once per frame, inside the shaken world transform)
  function drawFx(now) {
    const parts = B.parts, dt = Math.min(0.05, Math.max(0, (now - (B._pt || now)) / 1000)) * spd(); B._pt = now;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i], age = now - p.t0;
      if (age >= p.life) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
      const damp = Math.max(0, 1 - p.drag * dt);
      p.vx *= damp; p.vy = p.vy * damp + p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const k = age / p.life, a = 1 - k;
      ctx.globalCompositeOperation = p.add ? 'lighter' : 'source-over'; ctx.fillStyle = p.col; ctx.strokeStyle = p.col;
      switch (p.kind) {
        case 'spark': ctx.globalAlpha = a; ctx.lineWidth = p.size; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke(); break;
        case 'smoke': ctx.globalAlpha = 0.34 * a; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + p.grow * k), 0, 7); ctx.fill(); break;
        case 'shard': { ctx.globalAlpha = a; const s = p.size; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot + p.vr * age / 1000); ctx.beginPath(); ctx.moveTo(0, -s * 1.7); ctx.lineTo(s * 0.7, 0); ctx.lineTo(0, s * 1.7); ctx.lineTo(-s * 0.7, 0); ctx.closePath(); ctx.fill(); ctx.restore(); break; }
        case 'sparkle': { ctx.globalAlpha = a * (0.6 + 0.4 * Math.sin(age / 60 + p.rot)); const s = p.size * (1 + 0.5 * a); ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(p.x - s, p.y); ctx.lineTo(p.x + s, p.y); ctx.moveTo(p.x, p.y - s * 1.3); ctx.lineTo(p.x, p.y + s * 1.3); ctx.stroke(); ctx.beginPath(); ctx.arc(p.x, p.y, s * 0.35, 0, 7); ctx.fill(); break; }
        case 'streak': ctx.globalAlpha = a; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.size * 5, p.y); ctx.stroke(); break;
        case 'ember': ctx.globalAlpha = a * (0.65 + 0.35 * Math.sin(age / 45 + p.rot)); ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + 0.5 * a), 0, 7); ctx.fill(); break;
        default: ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + p.grow * k) * (1 - 0.4 * k), 0, 7); ctx.fill();
      }
    }
    for (const e of B.efx) {
      const k = (now - e.t0) / e.dur; if (k < 0) continue; if (k >= 1) { e.done = true; continue; }
      const a = 1 - k, ease = 1 - a * a;
      ctx.globalCompositeOperation = e.k === 'flash' ? 'source-over' : 'lighter';
      switch (e.k) {
        case 'ring': {
          const rr = Math.max(0.5, e.r0 + (e.r1 - e.r0) * ease), ry = Math.max(0.5, rr * (e.flat === undefined ? 0.6 : e.flat));
          ctx.globalAlpha = a; ctx.strokeStyle = e.col; ctx.lineWidth = Math.max(0.6, e.w * (1 - 0.7 * k)); ctx.beginPath(); ctx.ellipse(e.x, e.y, rr, ry, 0, 0, 7); ctx.stroke();
          if (e.fill) { ctx.globalAlpha = a * 0.22; ctx.fillStyle = e.col; ctx.fill(); }
          break;
        }
        case 'bolt': {
          const f = k < 0.12 ? 1 : Math.max(0, 1 - (k - 0.12) / 0.88), fl = f * (0.65 + 0.35 * Math.random());
          const line = (pts, w) => { ctx.beginPath(); for (let i = 0; i < pts.length; i++) i ? ctx.lineTo(pts[i][0], pts[i][1]) : ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineWidth = w; ctx.stroke(); };
          ctx.strokeStyle = e.col; ctx.globalAlpha = fl * 0.5; line(e.pts, e.w * 4.5); e.br.forEach(b => line(b, e.w * 2.2));
          ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = fl; line(e.pts, e.w); e.br.forEach(b => line(b, e.w * 0.6));
          break;
        }
        case 'missile': {
          const kk = Math.max(0, k - 0.18), x = e.x1 + (e.x2 - e.x1) * k, y = e.y1 + (e.y2 - e.y1) * k - e.arc * Math.sin(Math.PI * k), x0 = e.x1 + (e.x2 - e.x1) * kk, y0 = e.y1 + (e.y2 - e.y1) * kk - e.arc * Math.sin(Math.PI * kk);
          ctx.globalAlpha = 0.6; ctx.strokeStyle = e.col; ctx.lineWidth = e.size * 1.1; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x, y); ctx.stroke();
          ctx.globalAlpha = 1; glow(x, y, e.size * 2.6, e.col, 0.9); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, e.size * 0.5, 0, 7); ctx.fill();
          if (Math.random() < 0.8) emit({ x, y, vx: R(-25, 25), vy: R(-25, 25), life: R(200, 380) / spd(), size: R(1.5, 3), col: e.col, kind: 'ember', drag: 2 });
          break;
        }
        case 'aura': {
          const s = e.s; if (!s || s.dead || s.px === undefined) break;
          const x = s.px, y = s.py + 6, pul = Math.sin(Math.PI * k);
          if (e.shape === 'glow') { ctx.globalAlpha = 1; glow(x, y - 4, 40, e.col, 0.55 * pul); ctx.globalAlpha = a; ctx.strokeStyle = e.col; ctx.lineWidth = 2.5; for (let q = 0; q < 2; q++) { const ang = k * 6 + q * Math.PI; ctx.beginPath(); ctx.ellipse(x, y + 12, 26 + 8 * k, 9 + 3 * k, 0, ang, ang + 2.2); ctx.stroke(); } }
          else if (e.shape === 'bubble') { ctx.globalAlpha = 0.5 * pul; const g = ctx.createRadialGradient(x - 8, y - 14, 3, x, y - 4, 34); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(0.7, rgba(e.col, 0.18)); g.addColorStop(1, rgba(e.col, 0.55)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 4, 32, 0, 7); ctx.fill(); ctx.globalAlpha = 0.9 * pul; ctx.strokeStyle = e.col; ctx.lineWidth = 2; ctx.stroke(); }
          else if (e.shape === 'rock') { ctx.globalAlpha = 0.9 * pul; ctx.strokeStyle = e.col; ctx.lineWidth = 3; ctx.setLineDash([7, 5]); ctx.beginPath(); ctx.ellipse(x, y + 12, 28, 10, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; glow(x, y, 34, e.col, 0.25 * pul); }
          else if (e.shape === 'haste') { ctx.globalAlpha = pul; ctx.strokeStyle = e.col; ctx.lineWidth = 2; for (let q = 0; q < 5; q++) { const yy = y - 18 + q * 9, off = ((k * 3 + q * 0.31) % 1) * 36; ctx.beginPath(); ctx.moveTo(x - 10 - off, yy); ctx.lineTo(x - 30 - off, yy); ctx.stroke(); } ctx.globalAlpha = 1; glow(x, y, 36, e.col, 0.22 * pul); }
          else { ctx.fillStyle = e.col; for (let q = 0; q < 9; q++) { const ang = k * 9 + q * 0.7, rad = 30 - q * 1.2 - 10 * k, yy = y - 4 + Math.sin(ang) * rad * 0.45 + (q - 4) * 2, xx = x + Math.cos(ang) * rad; ctx.globalAlpha = pul * (0.35 + q / 14); ctx.beginPath(); ctx.arc(xx, yy, 2.6 - q * 0.12, 0, 7); ctx.fill(); } }
          break;
        }
        case 'beam': {
          const wd = e.w * Math.sin(Math.PI * Math.min(1, k * 1.2)), g = ctx.createLinearGradient(e.x - wd - 1, 0, e.x + wd + 1, 0);
          g.addColorStop(0, rgba(e.col, 0)); g.addColorStop(0.5, 'rgba(255,255,255,.85)'); g.addColorStop(1, rgba(e.col, 0));
          ctx.globalAlpha = 0.25 + 0.75 * a; ctx.fillStyle = g; ctx.fillRect(e.x - wd, 0, wd * 2, e.y + 6); ctx.globalAlpha = 1; glow(e.x, e.y + 4, 40 * a + 10, e.col, 0.7);
          break;
        }
        case 'flash': ctx.globalAlpha = e.a * a * Math.sqrt(a); ctx.fillStyle = e.col; ctx.fillRect(-30, -30, 1020, 700); break;
      }
    }
    ctx.restore();
    B.efx = B.efx.filter(e => !e.done);
  }

  function computeReach(s) {
    const res = new Map(), spd = speedOf(s);
    const own = (c, r) => { const o = stackAt(c, r); return !o || o === s; };
    const free = (c, r) => { if (blockedGround(c, r) || !own(c, r)) return false; const t = tailAt(s, c, r); if (isWide(s) && !t) return false; return !t || (!blockedGround(t[0], t[1]) && own(t[0], t[1])); };
    res.set(key(s.c, s.r), { c: s.c, r: s.r, d: 0, prev: null });
    if (C[s.t].fly) {
      for (let r = 0; r < BH; r++) for (let c = 0; c < BW; c++) {
        const d = hexDist(s, { c, r });
        if (d > 0 && d <= spd && free(c, r)) res.set(key(c, r), { c, r, d, prev: key(s.c, s.r) });
      }
      return res;
    }
    let frontier = [[s.c, s.r]];
    for (let d = 1; d <= spd; d++) {
      const next = [];
      for (const [c0, r0] of frontier) for (const [c, r] of nbrs(c0, r0)) {
        if (res.has(key(c, r)) || !free(c, r)) continue;
        res.set(key(c, r), { c, r, d, prev: key(c0, r0) }); next.push([c, r]);
      }
      frontier = next;
    }
    return res;
  }
  function meleeSpot(s, e, reach) {
    let best = null; const eh = occHexes(e);
    for (const h of reach.values()) {
      if (best && h.d >= best.d) continue;
      if (occHexes(s, h.c, h.r).some(([c, r]) => eh.some(([ec, er]) => hexDist({ c, r }, { c: ec, r: er }) === 1))) best = h;
    }
    return best;
  }
  // every hex from which e can be struck, nearest first; the player chooses by pointing at the side of the target he wants to strike from
  function meleeSpots(s, e, reach) {
    const eh = occHexes(e), out = [];
    for (const h of reach.values()) if (occHexes(s, h.c, h.r).some(([c, r]) => eh.some(([ec, er]) => hexDist({ c, r }, { c: ec, r: er }) === 1))) out.push(h);
    return out;
  }
  function pickSpot(s, e, reach, pt) {
    const sp = meleeSpots(s, e, reach); if (!sp.length) return null;
    if (!pt) return meleeSpot(s, e, reach);
    let best = null, bd = 1e9; for (const h of sp) { const q = hexPx(h.c, h.r), d = Math.hypot(q.x - pt.x, q.y - pt.y); if (d < bd) { bd = d; best = h; } }
    return best;
  }
  function aiSpot(s, e, reach) {       // the computer also likes to strike from behind when it costs little extra movement
    let best = null, bv = 1e9; for (const h of meleeSpots(s, e, reach)) { const v = h.d - (isRear(s, e, h) ? 2 : 0); if (v < bv) { bv = v; best = h; } }
    return best;
  }
  // an enemy standing next to the hex (c, r), as seen by a creature that would stand there: clicking such an empty hex walks there and strikes
  function foeBeside(s, c, r) {
    if (!B || canShoot(s)) return null;
    const mine = occHexes(s, c, r);
    return B.stacks.find(o => !o.dead && o.side !== s.side && occHexes(o).some(([ec, er]) => mine.some(([mc, mr]) => hexDist({ c: mc, r: mr }, { c: ec, r: er }) === 1))) || null;
  }
  function pathTo(reach, hex) {
    const p = []; let h = hex;
    while (h) { p.push(h); h = h.prev ? reach.get(h.prev) : null; }
    return p.reverse();
  }

  async function tweenTo(s, x, y, ms, mode) {
    if (typeof document !== 'undefined' && document.hidden) { s.px = x; s.py = y; return; }
    ms /= spd(); s.walkMs = Math.max(55, Math.min(130, ms * 0.5)); faceTo(s, x, ms + 350); if (!s.walkUntil || performance.now() > s.walkUntil) s.walkT0 = performance.now(); s.walkUntil = performance.now() + ms + 40;      // face the way it walks
    const x0 = s.px, y0 = s.py, t0 = performance.now();
    for (;;) {
      const k0 = Math.min(1, (performance.now() - t0) / ms), k = mode === 'both' ? k0 * k0 * (3 - 2 * k0) : mode === 'in' ? k0 * k0 * (2 - k0) : mode === 'out' ? 1 - (1 - k0) * (1 - k0) * (1 + k0) : k0;
      s.px = x0 + (x - x0) * k; s.py = y0 + (y - y0) * k;
      if (k0 >= 1) { if (mode && !(B && C[s.t].fly)) burst(x, y + 16, 3, { kind: 'smoke', col: PAL.dust, v0: 8, v1: 34, l0: 240, l1: 460, s0: 2, s1: 3.6, drag: 2.6, grow: 1.2, jit: 5 }); break; }
      await raf();
    }
  }
  // how long one hex takes: slow creatures (speed 3-4) trudge, fast ones (9+) race; heavy units never hurry. Flyers cover a whole straight line in one smooth glide.
  const pace = (t) => { const sp = C[t].s || 5; return sp <= 3 ? 300 : sp >= 12 ? 130 : Math.round(300 - (sp - 3) * 19); };
  async function doMove(s, hex) {
    const fly = C[s.t].fly, path = fly ? [{ c: s.c, r: s.r }, hex] : pathTo(B.reach, hex);
    for (let i = 1; i < path.length; i++) {
      const p = hexPx(path[i].c, path[i].r);
      await tweenTo(s, p.x, p.y, fly ? Math.max(320, Math.min(760, hexDist({ c: s.c, r: s.r }, hex) * pace(s.t) * 0.6)) : pace(s.t), path.length === 2 ? 'both' : i === 1 ? 'in' : i === path.length - 1 ? 'out' : null);
      if (!fly && B.mines && B.mines.has(key(path[i].c, path[i].r))) { s.c = path[i].c; s.r = path[i].r; detonate(s); return; }
    }
    s.c = hex.c; s.r = hex.r;
    const p = hexPx(s.c, s.r); s.px = p.x; s.py = p.y;
    if (fly && B.mines && B.mines.has(key(s.c, s.r))) detonate(s);
  }
  // luck: each point = 4% chance of a lucky (double) or unlucky (half) strike
  function luckMul(s) {
    const luck = s.side === 0 ? (B.hero.luck || 0) : 0;
    if (!luck || Math.random() >= 0.04 * Math.min(3, Math.abs(luck))) return 1;
    log(luck > 0 ? '🍀 Lucky strike — double damage!' : '☁ Bad luck — half damage.');
    return luck > 0 ? 2 : 0.5;
  }
  function onHitEffects(s, tgt, dmg) {
    if (abil(s, 'drain') && !s.dead) { const g = healStack(s, dmg, s.maxN); if (g > 0) log(`${C[s.t].n} drains life (+${Math.round(g)} HP).`); }
    const st = abil(s, 'stun');
    if (st && !tgt.dead && Math.random() < st / 100) { tgt.stunned = 1; log(`${C[tgt.t].n} is stunned!`); B.fx.push({ x: hexPx(tgt.c, tgt.r).x, y: hexPx(tgt.c, tgt.r).y - 20, txt: '💫', col: '#fff', t0: performance.now() }); }
  }
  // the hex directly behind the target as seen from the attacker (dragon breath)
  function hexBehind(a, t) {
    const pa = hexPx(a.c, a.r), pt = hexPx(t.c, t.r), tx = pt.x + (pt.x - pa.x), ty = pt.y + (pt.y - pa.y);
    let best = null, bd = HR * 0.9;
    for (const [c, r] of nbrs(t.c, t.r)) { const p = hexPx(c, r), d = Math.hypot(p.x - tx, p.y - ty); if (d < bd) { bd = d; best = { c, r }; } }
    return best;
  }
  // ---- unit animations: melee lunge + weapon effect, ranged recoil + flying projectile, hurt shake, death fade ----
  // Each creature's own attack look: m = melee effect, mc = its colour (r,g,b), s = shot, pc = shot colour. Anything not listed
  // falls back to the picture-based default (Figures.style).
  const CFX = {
    goblin: { m: 'stab', mc: '215,200,150' }, stronghold1: { m: 'stab', mc: '215,200,150' }, wolf: { m: 'bite', mc: '240,230,210' }, stronghold2: { m: 'bite', mc: '240,230,210' },
    orc: { m: 'slash', mc: '235,130,90', s: 'bolt', pc: '#8a3a2a' }, stronghold3: { m: 'slash', mc: '235,130,90', s: 'bolt', pc: '#8a3a2a' },
    ogre: { m: 'smash', mc: '255,190,90' }, stronghold4: { m: 'smash', mc: '255,190,90' }, troll: { m: 'smash', mc: '140,210,110' }, golem: { m: 'smash', mc: '200,200,215' }, tower3: { m: 'smash', mc: '200,200,215' },
    naga: { m: 'tentacle', mc: '120,210,255' }, tower6: { m: 'tentacle', mc: '120,210,255' }, dragon: { m: 'claw', mc: '150,235,120' }, rampart7: { m: 'claw', mc: '150,235,120' },
    shark: { m: 'bite', mc: '200,230,255' }, kraken: { m: 'tentacle', mc: '90,200,190' },
    castle1: { m: 'stab', mc: '255,255,255' }, castle2: { s: 'arrow', pc: '#e0443a' }, castle3: { m: 'claw', mc: '255,232,150' }, castle4: { m: 'slash', mc: '255,255,255' },
    castle5: { m: 'holy', mc: '255,240,170', s: 'holy', pc: '#ffe27a' }, castle6: { m: 'stab', mc: '255,250,220' }, castle7: { m: 'holy', mc: '255,248,200' },
    rampart1: { m: 'stab', mc: '230,210,160' }, rampart2: { m: 'smash', mc: '255,200,90' }, rampart3: { m: 'slash', mc: '170,240,130', s: 'glow', pc: '#7ddc5a' }, rampart4: { m: 'stab', mc: '255,255,255' },
    rampart5: { m: 'smash', mc: '130,210,90' }, rampart6: { m: 'holy', mc: '255,255,255' },
    tower1: { m: 'claw', mc: '190,190,200', s: 'ball' }, tower2: { m: 'claw', mc: '180,180,195' }, tower4: { m: 'zap', mc: '170,215,255', s: 'zap', pc: '#aee0ff' }, tower5: { m: 'zap', mc: '255,225,140' }, tower7: { m: 'zap', mc: '190,225,255' },
    inferno1: { m: 'claw', mc: '255,110,80' }, inferno2: { m: 'slash', mc: '255,150,70', s: 'fire' }, inferno3: { m: 'fire', mc: '255,150,60' }, inferno4: { m: 'cleave', mc: '255,100,80' }, inferno5: { m: 'cleave', mc: '255,160,70' },
    inferno6: { m: 'fire', mc: '255,170,60' }, inferno7: { m: 'fire', mc: '255,90,60' },
    necropolis1: { m: 'slash', mc: '235,230,205' }, necropolis2: { m: 'claw', mc: '190,210,170' }, necropolis3: { m: 'drain', mc: '170,255,200' }, necropolis4: { m: 'drain', mc: '210,40,70' },
    necropolis5: { m: 'drain', mc: '190,120,255', s: 'death', pc: '#7dffa6' }, necropolis6: { m: 'cleave', mc: '150,90,210' }, necropolis7: { m: 'bite', mc: '200,235,225' },
    dungeon1: { m: 'stab', mc: '210,190,150' }, dungeon2: { m: 'claw', mc: '230,160,200' }, dungeon3: { s: 'gaze' }, dungeon4: { m: 'stab', mc: '160,230,110', s: 'venom', pc: '#8fe04a' }, dungeon5: { m: 'cleave', mc: '255,120,90' },
    dungeon6: { m: 'sting', mc: '255,170,70' }, dungeon7: { m: 'fire', mc: '255,110,50' },
    stronghold5: { m: 'zap', mc: '255,235,150' }, stronghold6: { m: 'smash', mc: '255,200,120', s: 'rock' }, stronghold7: { m: 'cleave', mc: '230,150,110' },
    fortress1: { m: 'stab', mc: '215,195,150' }, fortress2: { m: 'stab', mc: '170,230,130', s: 'javelin', pc: '#c9b27a' }, fortress3: { m: 'sting', mc: '160,230,90' }, fortress4: { m: 'bite', mc: '160,230,110' },
    fortress5: { m: 'smash', mc: '210,170,110' }, fortress6: { m: 'sting', mc: '120,230,110' }, fortress7: { m: 'bite', mc: '110,210,160' },
    conflux1: { m: 'zap', mc: '255,170,230' }, conflux2: { m: 'zap', mc: '210,235,255' }, conflux3: { m: 'frost', mc: '140,200,255' }, conflux4: { m: 'fire', mc: '255,140,50' }, conflux5: { m: 'smash', mc: '180,145,95' },
    conflux6: { m: 'gaze', mc: '255,120,230' }, conflux7: { m: 'fire', mc: '255,160,60' },
    faerie: { m: 'zap', mc: '225,170,255' }, rustd: { m: 'poison', mc: '210,150,70' }, crystald: { m: 'frost', mc: '200,240,255' }, azured: { m: 'zap', mc: '140,200,255' },
  };
  const styleOf = (s) => {
    const base = (typeof Figures !== 'undefined' && Figures.style) ? Figures.style(s.t) : { melee: 'slash', shoot: 'arrow', col: null }, f = CFX[String(s.t).replace(/_\d$/, '')];
    return f ? { melee: f.m || base.melee, shoot: f.s || base.shoot, col: f.pc || base.col, mc: f.mc || null } : base;
  };
  async function strike(s, t) {
    const a = hexPx(s.c, s.r), p = hexPx(t.c, t.r), now = performance.now();
    const pfa = profOf(s.t), atkMs = pfa.atk || 380, ad = animDur(s.t, 'attack'), hitAt = ad ? (2.5 - atkSkip(s.t)) * ANIM_MS.attack : 0.4 * atkMs;      // (sleep() divides by the animation speed itself)    // with its own frames the blow lands on the impact frame
    s.anim = { kind: 'lunge', t0: now, dur: ad || atkMs / spd(), dx: p.x - a.x, dy: p.y - a.y }; sfx('swing'); csfx(s.t, 'attack'); faceTo(s, p.x, (ad || atkMs) + 400);
    if (pfa.slam) later(ad ? (2.5 - atkSkip(s.t)) * ANIM_MS.attack : 0.4 * atkMs, () => { ring(p.x, p.y + 12, 34, '#b9a98a', { w: 4, dur: 420, flat: 0.4 }); burst(p.x, p.y + 12, 7, { kind: 'smoke', col: PAL.dust, v0: 20, v1: 90, l0: 320, l1: 640, s0: 3, s1: 5.5, drag: 2.4, grow: 1.3 }); });      // heavy blows shake the ground
    { const dd = Math.hypot(p.x - a.x, p.y - a.y) || 1; t.knock = { ux: (p.x - a.x) / dd, uy: (p.y - a.y) / dd, amp: 8 }; }      // the target is pushed back along the blow
    push((a.x + p.x) / 2, (a.y + p.y) / 2, 0.026, 560);
    (B.slashes = B.slashes || []).push({ x: p.x, y: p.y, t0: now + (ad ? (2 - atkSkip(s.t)) * ANIM_MS.attack : 0.38 * atkMs) / spd(), dur: 340 / spd(), style: styleOf(s).melee, mc: styleOf(s).mc, ang: Math.atan2(p.y - a.y, p.x - a.x) });
    await sleep(hitAt);
  }
  // quick = the second arrow of a double shot: a shorter draw and flight, so the pair reads as one quick volley
  async function fireProj(s, tg, quick) {
    const a = hexPx(s.c, s.r), p = hexPx(tg.c, tg.r), now = performance.now(), st = styleOf(s), dur = Math.max(220, Math.min(520, Math.hypot(p.x - a.x, p.y - a.y) * 1.1)) * (quick ? 0.85 : 1) / spd(), ad = animDur(s.t, 'attack'), lead = ad ? (quick ? 0.9 : 2.2 - atkSkip(s.t)) * ANIM_MS.attack : quick ? 40 : 130;
    s.anim = { kind: 'shoot', t0: now, dur: ad || (quick ? 240 : 320) / spd(), dx: p.x - a.x, dy: p.y - a.y }; faceTo(s, p.x, (ad || 320) + lead + 500);
    { const dd = Math.hypot(p.x - a.x, p.y - a.y) || 1; tg.knock = { ux: (p.x - a.x) / dd, uy: (p.y - a.y) / dd, amp: 4.5 }; }
    push((a.x + p.x) / 2, (a.y + p.y) / 2, 0.02, Math.min(900, 520 + dur * spd()));
    (B.proj = B.proj || []).push({ ax: a.x, ay: a.y - 6, bx: p.x, by: p.y - 6, t0: now + lead / spd(), dur, style: st.shoot, col: st.col });
    await sleep(lead + dur * spd());
  }
  async function doMelee(s, e, spot) {
    const origin = { c: s.c, r: s.r }, moved = hexDist(s, spot);
    if (spot.c !== s.c || spot.r !== s.r) await doMove(s, spot);
    if (s.dead || s.c !== spot.c || s.r !== spot.r) return;
    const targets = abil(s, 'allAdj') ? adjStacks(s).filter(o => o.side !== s.side) : [e];
    const strikes = abil(s, 'dstrike') ? 2 : 1, joust = abil(s, 'joust') ? moved : 0;
    for (const tgt of targets) {
      for (let k = 0; k < strikes && !tgt.dead; k++) {
        const dmg = Math.max(1, Math.floor(calcDmg(s, tgt, true, false, joust) * luckMul(s)));
        await strike(s, tgt);
        hit(tgt, dmg, `${C[s.t].n} attacks`);
        onHitEffects(s, tgt, dmg);
        if (abil(s, 'breath')) {
          const bh = hexBehind(s, tgt), bs = bh && stackAt(bh.c, bh.r);
          if (bs && !bs.dead) hit(bs, dmg, '🔥 Breath scorches', 'breath');
        }
        await sleep(260);
      }
    }
    if (!abil(s, 'noRet')) {
      for (const tgt of targets) {
        if (tgt.dead || s.dead) continue;
        if (abil(tgt, 'unlimRet') || tgt.ret) {
          if (!abil(tgt, 'unlimRet')) tgt.ret = false;
          await strike(tgt, s);
          hit(s, calcDmg(tgt, s, true), `${C[tgt.t].n} retaliates vs`);
          await sleep(260);
        }
      }
    }
    if (abil(s, 'return') && !s.dead && (s.c !== origin.c || s.r !== origin.r) && !stackAt(origin.c, origin.r) && !blockedGround(origin.c, origin.r)) {
      const p = hexPx(origin.c, origin.r); await tweenTo(s, p.x, p.y, 120); s.c = origin.c; s.r = origin.r;
    }
  }
  function spotNear(s, c, r, reach) {
    let best = null;
    for (const [nc, nr] of nbrs(c, r)) { const h = reach.get(key(nc, nr)); if (h && (!best || h.d < best.d)) best = h; }
    return best;
  }
  const structDmg = (a, ranged) => Math.max(1, Math.floor(baseDmg(a, true) * (ranged ? 0.5 : 0.8) * (a.side === 0 ? 1 + 0.5 * perk('ballistics') : 1)));
  async function doStructMelee(s, st, spot) {
    if (spot.c !== s.c || spot.r !== s.r) await doMove(s, spot);
    if (s.dead || s.c !== spot.c || s.r !== spot.r) return;
    hitStruct(st, structDmg(s, false), `${C[s.t].n} batters`);
    await sleep(300);
  }
  async function doStructShoot(s, st) {
    s.ammo--; sfx('shoot');
    await fireProj(s, st);
    hitStruct(st, structDmg(s, true), `${C[s.t].n} shoots`);
    await sleep(240);
  }
  function setupSiege(sg) {
    const dside = sg.dside, fl = FORT_LEVELS[Math.max(0, Math.min(3, sg.fort || 0))];
    B.siege = { dside, fort: sg.fort || 0, minel: sg.minel || 0, fac: sg.fac };
    B.towerMul = fl.tower;
    const cw = dside === 1 ? 9 : 5, mc = dside === 1 ? 8 : 6;
    ['wall', 'wall', 'tower', 'wall', 'wall', 'gate', 'wall', 'wall', 'tower', 'wall', 'wall'].forEach((k, r) => {
      const hp = Math.round(STRUCT[k].hp * fl.hp);
      B.walls.set(key(cw, r), { k, hp, max: hp, c: cw, r });
    });
    for (let r = 0; r < BH; r++) if (r < 4 || r > 6) B.moat.add(key(mc, r));
    B.cw = cw;
    B.mines = new Map(); B.mineStock = sg.mines || 0; B.mineReserve = 0; B.mineDmg = 60 + 20 * (sg.minel || 0);
  }
  // mines lie on open ground in front of the walls
  const inMineZone = (c) => B.siege.dside === 1 ? (c >= 2 && c <= B.cw - 2) : (c >= B.cw + 2 && c <= 12);
  const freeMineHex = (c, r) => B.siege && inMineZone(c) && !blockedGround(c, r) && !stackAt(c, r) && !B.mines.has(key(c, r));
  function placeMines() {
    if (!B.siege) return;
    const playerDef = B.siege.dside === 0, stock = B.mineStock, auto = playerDef ? Math.ceil(stock / 2) : stock;
    B.mineReserve = playerDef ? Math.floor(stock / 2) + (stock ? 0 : EMERGENCY_MINES) : 0;
    for (let i = 0, tries = 0; i < auto && tries < 300; tries++) {
      const c = B.siege.dside === 1 ? 2 + Math.floor(Math.random() * (B.cw - 3)) : B.cw + 2 + Math.floor(Math.random() * (12 - B.cw - 1)), r = Math.floor(Math.random() * BH);
      if (freeMineHex(c, r)) { B.mines.set(key(c, r), { r: 1 }); i++; }
    }
  }
  function detonate(s) {
    const k = key(s.c, s.r); B.mines.delete(k);
    const p = hexPx(s.c, s.r); s.px = p.x; s.py = p.y; (B.mineFx = B.mineFx || []).push({ x: p.x, y: p.y, t0: performance.now() });
    B.fx.push({ x: p.x, y: p.y - 6, txt: '💥', col: '#fff', t0: performance.now() });
    sfx('crash'); fxMine(p); hit(s, B.mineDmg, '💣 A mine explodes under', 'mine');
  }
  function layMine(h) {
    if (!B.siege || B.siege.dside !== 0 || B.mineReserve <= 0 || B.mineUsed) return;
    if (!freeMineHex(h.c, h.r)) return toast('Mines go on free open ground in front of the walls.');
    B.mines.set(key(h.c, h.r), { r: 1 }); B.mineReserve--; B.mineUsed = true; B.spell = null;
    log('💣 A mine is laid.'); sfx('click'); refreshButtons();
  }
  async function doShoot(s, e) {
    s.ammo--;
    const shots = abil(s, 'dshot') ? 2 : 1;      // Marksmen (upgraded Archers), Wood Elves and their upgrades shoot twice: two arrows, two hits
    for (let k = 0; k < shots && !e.dead; k++) {
      csfx(s.t, 'shoot', styleOf(s).shoot); await fireProj(s, e, k > 0);
      const dmg = Math.max(1, Math.floor(calcDmg(s, e, false) * luckMul(s)));
      const ex = { c: e.c, r: e.r };
      hit(e, dmg, `${C[s.t].n} shoots`, 'ranged');
      onHitEffects(s, e, dmg);
      if (abil(s, 'splash') || abil(s, 'cloud')) {
        for (const o of nbrs(ex.c, ex.r).map(([c, r]) => stackAt(c, r)).filter(Boolean)) {
          if (o === s || o.dead || (abil(s, 'cloud') && (C[o.t].fac === 'necropolis'))) continue;
          hit(o, Math.max(1, Math.floor(dmg / 2)), abil(s, 'cloud') ? '☠ Death cloud hits' : '🔥 Splash hits', 'ranged');
        }
      }
      if (k + 1 < shots) await sleep(70);
    }
    await sleep(240);
  }

  function checkEnd() {
    if (B.over) return true;
    if (!alive(0).length) { finish(false, false); return true; }
    if (!alive(1).length) { finish(true, false); return true; }
    return false;
  }


  // ---- siege: the attackers' catapult and the defenders' arrow towers act in the open instead of damaging the walls out of sight ----
  const catPos = () => { const side = 1 - B.siege.dside, p = hexPx(side === 0 ? 0 : BW - 1, BH - 1); return { x: p.x + (side === 0 ? -4 : 4), y: p.y + 4, dir: side === 0 ? 1 : -1 }; };
  function drawCatapult(now) {
    const cp = catPos(), t = B.catT0 ? now - B.catT0 : 99999, rel = 260 / spd(), back = 1300 / spd(), idle = machImg('catapult_cocked_basic');
    if (idle) {
      let f = 'cocked'; if (t < rel * 0.5) f = 'throw1'; else if (t < rel) f = 'throw2'; else if (t < rel + 200) f = 'released'; else if (t < rel + 200 + back) f = 'winch' + (1 + Math.min(2, Math.floor((t - rel - 200) / back * 3)));
      machDraw(machImg('catapult_' + f + '_basic') || idle, idle, cp.x, cp.y + 14, 84, cp.dir < 0); return;
    }
    drawCatapultCode(now);
  }
  function drawCatapultCode(now) {
    const cp = catPos(), t = B.catT0 ? now - B.catT0 : 99999, rel = 260 / spd(), back = 1300 / spd(), sm = (u) => u * u * (3 - 2 * u);
    // arm angle: cocked back, a fast throw forward, then winched slowly back
    let a = -2.55; if (t < rel) a = -2.55 + 2.4 * sm(t / rel); else if (t < rel + 200) a = -0.15; else if (t < rel + 200 + back) a = -0.15 - 2.4 * sm((t - rel - 200) / back);
    const loaded = !(t >= rel && t < rel + 200 + back * 0.85);
    ctx.save(); ctx.translate(cp.x, cp.y); ctx.scale(cp.dir, 1);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 10, 28, 6, 0, 0, 7); ctx.fill();
    // wheels and frame
    for (const wx of [-15, 15]) { ctx.fillStyle = '#4a2f18'; ctx.strokeStyle = '#1c1008'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(wx, 4, 8, 0, 7); ctx.fill(); ctx.stroke(); ctx.strokeStyle = '#8a5a30'; ctx.lineWidth = 1.2; for (let i = 0; i < 4; i++) { const an = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(wx - Math.cos(an) * 7, 4 - Math.sin(an) * 7); ctx.lineTo(wx + Math.cos(an) * 7, 4 + Math.sin(an) * 7); ctx.stroke(); } }
    ctx.fillStyle = '#7a4e26'; ctx.strokeStyle = '#1c1008'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(24, 0); ctx.lineTo(18, -9); ctx.lineTo(-16, -9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6, -9); ctx.lineTo(0, -22); ctx.lineTo(6, -9); ctx.closePath(); ctx.fillStyle = '#5e3a1c'; ctx.fill(); ctx.stroke();
    // arm with its bucket
    ctx.save(); ctx.translate(0, -20); ctx.rotate(a); ctx.strokeStyle = '#1c1008'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(32, 0); ctx.stroke(); ctx.strokeStyle = '#a87442'; ctx.lineWidth = 3.6; ctx.stroke();
    ctx.fillStyle = '#5e3a1c'; ctx.strokeStyle = '#1c1008'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(32, 0, 6, 0, 7); ctx.fill(); ctx.stroke();
    if (loaded) { ctx.fillStyle = '#8a8478'; ctx.beginPath(); ctx.arc(32, -3, 5, 0, 7); ctx.fill(); ctx.strokeStyle = '#1c1710'; ctx.lineWidth = 1; ctx.stroke(); }
    ctx.restore(); ctx.restore();
  }
  async function catapultShot(st, dmg) {
    const bb = B, p = hexPx(st.c, st.r), cp = catPos();
    B.catT0 = performance.now(); sfx('swing');
    await sleep(260); if (B !== bb || B.over) return;
    const lx = cp.x + cp.dir * 18, ly = cp.y - 44, dist = Math.hypot(p.x - lx, p.y - ly), fl = Math.max(520, Math.min(900, dist * 1.05)) / spd();
    burst(lx, ly + 6, 5, { kind: 'smoke', col: PAL.dust, v0: 10, v1: 50, l0: 250, l1: 500, s0: 3, s1: 5, drag: 2.4, grow: 1.3 });
    (B.proj = B.proj || []).push({ ax: lx, ay: ly, bx: p.x, by: p.y - 6, t0: performance.now(), dur: fl, style: 'rock', arc: 96, col: null });
    await sleep(fl * spd() + 30); if (B !== bb || B.over) return;
    hitStruct(st, dmg, '🎯 Catapult hits');
    await sleep(280);
  }
  async function towerVolley(st, tg) {
    const bb = B, a = hexPx(st.c, st.r), p = hexPx(tg.c, tg.r), lvl = Math.min(3, (B.siege && B.siege.fort) || 0), n = 1 + lvl, dur = Math.max(260, Math.min(520, Math.hypot(p.x - a.x, p.y - a.y))) / spd();
    st.shotAt = performance.now(); sfx('shoot');
    for (let i = 0; i < n; i++) (B.proj = B.proj || []).push({ ax: a.x, ay: a.y - 30, bx: p.x + (Math.random() - 0.5) * 12, by: p.y - 6 + (Math.random() - 0.5) * 8, t0: performance.now() + i * 95 / spd(), dur, style: 'arrow', col: '#c8a24a' });
    await sleep(95 * (n - 1) + dur * spd() + 20); if (B !== bb || B.over || tg.dead) return;
    hit(tg, Math.round((25 + Math.floor(Math.random() * 20)) * (B.towerMul || 1)), '🗼 Arrow Tower hits', 'ranged');
    await sleep(200);
  }
  async function siegeRound() {
    const bb = B;
    for (let i = 0; i < 2; i++) {
      const sts = [...B.walls.values()]; if (!sts.length) break;
      const gate = sts.find(w => w.k === 'gate'), st = gate && Math.random() < 0.5 ? gate : sts[Math.floor(Math.random() * sts.length)];
      await catapultShot(st, Math.floor(60 * (B.siege.dside === 1 ? 1 + 0.5 * perk('ballistics') : 1))); if (B !== bb || B.over) return;
    }
    if (B.round > 1) {
      for (const st of [...B.walls.values()]) if (st.k === 'tower') {
        const atk = alive(1 - B.siege.dside).filter(a => !a.dead); if (!atk.length) break;
        await towerVolley(st, atk[Math.floor(Math.random() * atk.length)]); if (B !== bb || B.over) return;
      }
    }
  }
  // what fortifications look like: pennants on every tower, torches from a Citadel up, braziers on the walls from a Castle up, golden trim on a Fortress
  function siegeDeco(st, p, now) {
    const lvl = Math.min(3, (B.siege && B.siege.fort) || 0), dcol = B.siege.dside === 0 ? '#3a6fc4' : '#c4473f', fl = Math.sin(now / 230 + st.r * 1.3), fl2 = Math.sin(now / 90 + st.r * 2.1);
    if (siegeImg('tower_round', 'intact')) { if (st.k === 'tower' && st.shotAt && now - st.shotAt < 220) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,230,160,' + (0.8 * (1 - (now - st.shotAt) / 220)).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(p.x + (B.siege.dside === 1 ? -14 : 14), p.y - 40, 9, 0, 7); ctx.fill(); ctx.restore(); } return; }
    ctx.save();
    if (st.k === 'tower') {
      const fx = p.x + 3, fy = p.y - 36;
      ctx.strokeStyle = '#2a1604'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(fx, fy + 12); ctx.lineTo(fx, fy - 7); ctx.stroke();
      const pen = (ox) => { ctx.fillStyle = dcol; ctx.beginPath(); ctx.moveTo(fx + ox, fy - 7); ctx.quadraticCurveTo(fx + ox + 8 + fl * 2, fy - 6 + fl, fx + ox + 15 + fl * 3, fy - 3 + fl * 1.5); ctx.quadraticCurveTo(fx + ox + 8 + fl * 2, fy - 2 + fl, fx + ox, fy + 2); ctx.closePath(); ctx.fill(); ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(20,10,4,.8)'; ctx.stroke(); };
      pen(0); if (lvl >= 3) { ctx.beginPath(); ctx.moveTo(fx - 8, fy + 14); ctx.lineTo(fx - 8, fy - 2); ctx.strokeStyle = '#2a1604'; ctx.lineWidth = 1.4; ctx.stroke(); ctx.save(); ctx.translate(-8, 4); pen(0); ctx.restore(); }
      if (lvl >= 1) for (const tx of [-17, 19]) { ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(p.x + tx, p.y - 14, 1, p.x + tx, p.y - 14, 12 + fl2); g.addColorStop(0, 'rgba(255,220,120,.85)'); g.addColorStop(1, 'rgba(255,120,30,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x + tx, p.y - 14, 12 + fl2, 0, 7); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#4a2f18'; ctx.fillRect(p.x + tx - 1, p.y - 11, 2, 6); }
      if (st.shotAt && now - st.shotAt < 220) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,230,160,' + (0.8 * (1 - (now - st.shotAt) / 220)).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(p.x + (B.siege.dside === 1 ? -14 : 14), p.y - 30, 9, 0, 7); ctx.fill(); }
    } else if (lvl >= 2 && st.k !== 'gate' && st.r % 2 === 0) {      // braziers along the wall
      ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(p.x, p.y - 18, 1, p.x, p.y - 18, 14 + fl2 * 1.5); g.addColorStop(0, 'rgba(255,210,110,.8)'); g.addColorStop(1, 'rgba(255,110,30,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y - 18, 14 + fl2 * 1.5, 0, 7); ctx.fill();
    }
    if (lvl >= 3 && st.k === 'gate') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45 + 0.15 * fl; const g = ctx.createRadialGradient(p.x, p.y - 4, 4, p.x, p.y - 4, 44); g.addColorStop(0, 'rgba(255,214,100,.75)'); g.addColorStop(1, 'rgba(255,214,100,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y - 4, 44, 0, 7); ctx.fill(); }
    ctx.restore();
    // a hurt tower smokes and then burns; a cracked wall sifts dust
    const fr = st.hp / st.max;
    if (st.k === 'tower' && fr < 0.5 && Math.random() < (fr < 0.25 ? 0.5 : 0.22)) emit({ x: p.x + (Math.random() - 0.5) * 18, y: p.y - 30, vx: (Math.random() - 0.5) * 12, vy: -22, life: 700 / spd(), size: 4, col: fr < 0.25 ? '#ff8a2a' : '#4a4540', kind: fr < 0.25 ? 'ember' : 'smoke', add: fr < 0.25, grow: 1.6, drag: 0.6 });
    else if (st.k === 'wall' && fr < 0.6 && Math.random() < 0.05) emit({ x: p.x + (Math.random() - 0.5) * 30, y: p.y - 6, vx: 0, vy: 10, life: 500 / spd(), size: 2.4, col: '#b9a98a', kind: 'smoke', add: false, grow: 1, drag: 1 });
  }
  async function newRound() {
    B.round++;
    if (B.round > 60) { log('Stalemate — the attackers withdraw.'); finish(false, false); return; }
    for (const s of alive()) { s.ret = true; s.waited = false; }
    B.queue = alive().sort((a, b) => speedOf(b) - speedOf(a) || a.side - b.side);
    if (B.mach && B.mach.cart) { B.cartT0 = performance.now(); for (const s of alive(0)) if (C[s.t].shoot && s.ammo < s.ammoMax) s.ammo++; }
    for (const s of alive()) { for (const f of ['weak', 'disr', 'noshoot', 'berserk']) if (s[f] > 0) s[f]--; if (s.hyp > 0 && --s.hyp === 0) { s.side = s.origSide; log(C[s.t].n + ' shakes off the mind grip.'); } }
    B.queue = alive().sort((a, c) => speedOf(c) - speedOf(a) || a.side - c.side);
    B.waitQ = []; B.strikeUsed = false; B.mineUsed = false; B.balUsed = false; B.tentUsed = false;
    log(`— Round ${B.round} —`);
    if (B.siege) await siegeRound();
  }
  async function nextTurn() {
    if (B.over) return;
    let s = null;
    if (B.bonus && !B.bonus.dead) { s = B.bonus; B.bonus = null; log(`✨ ${C[s.t].n} acts again (high morale)!`); }
    while (!s) {
      if (!B.queue.length) {
        if (B.waitQ.length) { B.queue = B.waitQ.sort((a, b) => speedOf(a) - speedOf(b)); B.waitQ = []; }
        else { await newRound(); if (!B || B.over) return; B.castUsed = false; if (checkEnd()) return; }
      }
      const c = B.queue.shift();
      if (!c || c.dead) continue;
      if (c.stunned > 0) { c.stunned--; log(`💫 ${C[c.t].n} cannot act and loses its turn.`); continue; }
      const mor = c.side === 0 ? (B.hero.morale || 0) : 0;
      if (mor && !abil(c, 'mindless') && Math.random() < 0.04 * Math.min(3, Math.abs(mor))) {
        if (mor > 0) B.bonus = c;
        else { log(`😟 ${C[c.t].n} is demoralized and skips its turn.`); continue; }
      }
      s = c;
    }
    if (abil(s, 'regen') && s.hp < C[s.t].hp) { s.hp = C[s.t].hp; log(`${C[s.t].n} regenerates.`); }
    B.cur = s; s.defb = false; B.spell = null;
    if (s.side === 1 || B.auto) push(s.px, s.py, 0.016, 700); // a soft look toward the enemy's acting stack (never on your own turn, so aiming stays exact)
    // narrow screens scroll the board sideways: keep the acting stack in view
    if (!frameAction(s, true)) try { const st = document.getElementById('stage'), c = document.getElementById('bat'); if (st && c && (st.scrollWidth > st.clientWidth + 4 || st.scrollHeight > st.clientHeight + 4)) st.scrollTo({ left: Math.max(0, (s.px / 960) * c.clientWidth - st.clientWidth / 2), top: Math.max(0, (s.py / 640) * c.clientHeight - st.clientHeight / 2), behavior: 'smooth' }); } catch (e) { /* ignore */ }
    B.reach = computeReach(s);
    const ai = s.side === 1 || B.auto;
    B.input = !ai;
    if (!ai) sfx('turn');
    refreshButtons();
    if (ai) await runAI(s);
  }
  async function runAI(s) {
    B.busy = true; B.input = false;
    await sleep(380);
    await aiAct(s);
    B.busy = false;
    if (!checkEnd()) nextTurn();
  }
  async function aiAct(s) {
    const foes = s.berserk > 0 ? alive().filter(e => e !== s).sort((a, c) => hexDist(a, s) - hexDist(c, s)).slice(0, 1) : alive(1 - s.side);
    if (!foes.length) return;
    const value = (e, dmg) => Math.min(dmg, totalHp(e)) / C[e.t].hp * C[e.t].v;
    const gate = B.siege && [...B.walls.values()].find(w => w.k === 'gate');
    if (isAttacker(s) && gate && C[s.t].shoot && s.ammo > 0 && Math.random() < 0.5) { await doStructShoot(s, gate); return; }
    if (canShoot(s)) {
      let best = null;
      for (const e of foes) { const v = value(e, calcDmg(s, e, false, true)); if (!best || v > best.v) best = { e, v }; }
      await doShoot(s, best.e); return;
    }
    let best = null;
    for (const e of foes) {
      const spot = aiSpot(s, e, B.reach);
      if (!spot) continue;
      const v = value(e, calcDmg(s, e, true, true, 0, spot)) * (e.ret ? 1 : 1.1) - 0.3 * value(s, calcDmg(e, s, true, true));
      if (!best || v > best.v) best = { e, spot, v };
    }
    if (best) { await doMelee(s, best.e, best.spot); return; }
    if (B.siege) {
      if (!isAttacker(s)) return;
      const sts = [...B.walls.values()];
      if (sts.length) {
        if (C[s.t].shoot && s.ammo > 0) { await doStructShoot(s, sts.find(w => w.k === 'gate') || sts[Math.floor(Math.random() * sts.length)]); return; }
        const opts = sts.map(st => ({ st, spot: spotNear(s, st.c, st.r, B.reach) })).filter(o => o.spot);
        if (opts.length) { const o = opts.find(x => x.st.k === 'gate') || opts[0]; await doStructMelee(s, o.st, o.spot); return; }
        const gt = sts.find(w => w.k === 'gate');
        if (gt) {
          let dest = null;
          for (const h of B.reach.values()) { const dd = hexDist(h, gt); if (!dest || dd < dest.dd) dest = { h, dd }; }
          if (dest && (dest.h.c !== s.c || dest.h.r !== s.r)) await doMove(s, dest.h);
          return;
        }
      }
    }
    let near = foes[0];
    for (const e of foes) if (hexDist(s, e) < hexDist(s, near)) near = e;
    let dest = null;
    for (const h of B.reach.values()) {
      const dd = hexDist(h, near);
      if (!dest || dd < dest.dd || (dd === dest.dd && h.d > dest.h.d)) dest = { h, dd };
    }
    if (dest && (dest.h.c !== s.c || dest.h.r !== s.r)) await doMove(s, dest.h);
  }

  // ------- player input -------
  async function playerAct(fn) {
    if (!B.input || B.busy || B.over) return;
    B.busy = true; B.input = false; B.spell = null;
    await fn();
    B.busy = false;
    if (!checkEnd()) nextTurn();
  }
  function onClick(ev) {
    if (!B || B.over || !B.input || B.busy) return;
    const h = mouseHex(ev); if (!h) return; B.hoverPt = mousePt(ev);
    if (COARSE) { // touch: first tap previews, second tap on the same hex confirms
      if (!(B.pend && B.pend.c === h.c && B.pend.r === h.r)) { B.pend = h; B.hover = h; if (!B.tapHint) { B.tapHint = true; toast('Tap the same hex again to confirm'); } return; }
      B.pend = null;
    }
    const s = B.cur, t = stackAt(h.c, h.r);
    if (B.spell === '__mine') { layMine(h); return; }
    if (B.spell === '__strike') { heroStrike(t); return; }
    if (B.spell === '__ballista') { fireBallista(t); return; }
    if (B.spell === '__tent') { firstAid(t); return; }
    if (B.spell && SPELLS[B.spell] && SPELLS[B.spell].tgt === 'ground') { castGround(B.spell, h); return; }
    if (B.spell) { castSpell(B.spell, t); return; }
    const st = structAt(h.c, h.r);
    if (st && isAttacker(s)) {
      if (C[s.t].shoot && s.ammo > 0) return playerAct(() => doStructShoot(s, st));
      const spot = spotNear(s, h.c, h.r, B.reach);
      if (spot) return playerAct(() => doStructMelee(s, st, spot));
      return toast('Cannot reach that structure — the moat blocks the way.');
    }
    if (t && t.side !== s.side) {
      if (canShoot(s)) return playerAct(() => doShoot(s, t));
      const spot = pickSpot(s, t, B.reach, B.hoverPt);
      if (spot) return playerAct(() => doMelee(s, t, spot));
      return toast('Too far away.');
    }
    const r = B.reach.get(key(h.c, h.r));
    if (!t && r && r.d > 0) { const fe = ev && ev.shiftKey ? null : foeBeside(s, r.c, r.r); return playerAct(() => fe ? doMelee(s, fe, r) : doMove(s, r)); }      // walk next to an enemy and strike (Shift = just walk)
  }
  function mousePt(ev) {
    const rc = cv.getBoundingClientRect();
    let x = (ev.clientX - rc.left) * 960 / rc.width, y = (ev.clientY - rc.top) * 640 / rc.height;
    const cm = B && camNow(performance.now()); if (cm) { x = cm.x + (x - cm.x) / cm.z; y = cm.y + (y - cm.y) / cm.z; } // undo the brief camera push so clicks land on the hex you see
    return { x, y };
  }
  function mouseHex(ev) { const q = mousePt(ev); return hexAt(q.x, q.y); }
  // mouse pointer in battle: bow when you can shoot, sword when you can strike, wand for spells, boots to move, a red sign otherwise
  function battleCursor(h) {
    if (!B || B.over || !B.input || B.busy || !B.cur || B.cur.side !== 0 || !h || typeof Art === 'undefined' || !Art.cursor) return '';
    const s = B.cur, t = stackAt(h.c, h.r);
    if (B.spell === '__mine') return Art.cursor('boot');
    if (B.spell === '__strike' || B.spell === '__ballista') return t && t.side === 1 ? Art.cursor(B.spell === '__ballista' ? 'arrow' : 'sword') : Art.cursor('no');
    if (B.spell === '__tent') return t && t.side === 0 ? Art.cursor('wand') : Art.cursor('no');
    if (B.spell) return t && (SPELLS[B.spell].tgt === 'enemy') === (t.side === 1) ? Art.cursor('wand') : Art.cursor('no');
    const st = structAt(h.c, h.r);
    if (st && isAttacker(s)) return C[s.t].shoot && s.ammo > 0 ? Art.cursor('arrow') : spotNear(s, h.c, h.r, B.reach) ? Art.cursor('sword') : Art.cursor('no');
    if (t && t.side !== s.side) return canShoot(s) ? Art.cursor('arrow') : meleeSpot(s, t, B.reach) ? Art.cursor('sword') : Art.cursor('no');
    if (t) return Art.cursor('no');
    const r = B.reach.get(key(h.c, h.r));
    return r && r.d > 0 ? (foeBeside(s, r.c, r.r) ? Art.cursor('sword') : Art.cursor('boot')) : Art.cursor('no');
  }
  function onMove(ev) { if (!B) return; B.hoverPt = mousePt(ev); B.hover = mouseHex(ev); if (!COARSE) { try { cv.style.cursor = battleCursor(B.hover) || ''; } catch (e) { /* ignore */ } } }
  // spell school rank (0 = untrained) and Insight gate: spell level <= 2 + Insight rank
  const spellRank = (sp) => perk(SCHOOL_SKILL[sp.school]);
  const spellOk = (sp) => sp.lv <= 2 + perk('wisdom');
  function castSpell(k, t) {
    const sp = SPELLS[k];
    if (!t || (sp.tgt !== 'any' && (sp.tgt === 'enemy') !== (t.side === 1))) return toast('Invalid target.');
    if (!spellOk(sp)) return toast(`${sp.n} needs Insight (rank ${sp.lv - 2}).`);
    if (B.hero.mana < sp.cost) return toast('Not enough mana.');
    B.hero.mana -= sp.cost; B.castUsed = true; B.spell = null; sfx('spell');
    const r = spellRank(sp), P = B.hero.sp;
    const sd = (x) => Math.floor(x * (1 + 0.15 * perk('sorcery')) * (1 + 0.25 * r));
    B.shot = { ax: HERO_POS[0].x, ay: HERO_POS[0].y, b: { c: t.c, r: t.r }, t0: performance.now(), col: sp.tgt === 'enemy' ? '#ff9a4a' : '#8affb0' };
    B.heroFlash = [performance.now(), 0];
    const mark = (tg, txt) => { const p = hexPx(tg.c, tg.r); B.fx.push({ x: p.x, y: p.y - 20, txt, col: '#fff', t0: performance.now(), kind: String(txt).charAt(0) === '+' ? 'heal' : undefined }); };
    const allies = () => (r >= 3 ? alive(0) : [t]), foes = () => (r >= 3 ? alive(1) : [t]);
    const spellHit = (tg, dmg, label, fire) => {
      if (fire && abil(tg, 'fireImm')) { log(`${C[tg.t].n} is immune to fire!`); return; }
      const rs = abil(tg, 'res'); if (rs) dmg = Math.floor(dmg * (1 - rs));
      hit(tg, Math.max(1, dmg), label, 'spell');
    };
    const area = (rad, fn) => { for (const e of alive(1)) if (e === t || hexDist(e, t) <= rad) fn(e); };
    spellFx(k, t, r);
    switch (k) {
      case 'arrow': spellHit(t, sd(10 * P + 10), 'Magic Arrow hits'); break;
      case 'lightning': spellHit(t, sd(25 * P), 'Lightning Bolt hits'); break;
      case 'implosion': spellHit(t, sd(75 * P), 'Implosion crushes'); break;
      case 'fireball': area(r >= 3 ? 2 : 1, (e) => spellHit(e, sd(15 * P + 10), 'Fireball burns', true)); break;
      case 'meteor': area(r >= 3 ? 2 : 1, (e) => spellHit(e, sd(14 * P + 20), 'Meteors strike')); break;
      case 'frostring': area(1, (e) => { spellHit(e, sd(10 * P + 15), 'Frost Ring chills'); if (r >= 2 && !e.dead) e.slow = Math.max(e.slow || 0, 2); }); break;
      case 'armageddon': for (const s of alive()) spellHit(s, sd(18 * P + 20), 'Armageddon burns', true); break;
      case 'chain': {
        const seen = new Set(); let cur = t, dmg = sd(40 * P), prevPos = { x: HERO_POS[0].x + 18, y: HERO_POS[0].y - 8 };
        for (let i = 0; i < (r >= 3 ? 4 : 3) && cur; i++) {
          chainFx(prevPos, cur, i); prevPos = hexC(cur.c, cur.r);
          spellHit(cur, Math.floor(dmg), 'Chain Lightning arcs to'); seen.add(cur); dmg /= 2;
          const from = cur;
          cur = alive(1).filter(e => !seen.has(e)).sort((a, b) => hexDist(a, from) - hexDist(b, from))[0];
        }
        break;
      }
      case 'slow': foes().forEach(e => { e.slow = 3 + Math.max(0, r - 1); mark(e, '🐌'); }); log(`${sp.n} cast.`); break;
      case 'curse': foes().forEach(e => { e.curse = true; mark(e, '☠️'); }); log(`${sp.n} cast.`); break;
      case 'blind': foes().forEach(e => { e.stunned = 1 + Math.max(1, r); mark(e, '🙈'); }); log(`${sp.n} cast: the target loses its next turns.`); break;
      case 'haste': allies().forEach(a => { a.haste = 3 + (r >= 2 ? 1 : 0) + (r >= 3 ? 1 : 0); mark(a, '💨'); }); log(`${sp.n} cast.`); break;
      case 'bless': allies().forEach(a => { a.bless = true; mark(a, '✨'); }); log(`${sp.n} cast.`); break;
      case 'stone': allies().forEach(a => { a.stone = 4 + 2 * Math.max(0, r - 1); mark(a, '🪨'); }); log(`${sp.n} cast.`); break;
      case 'bloodlust': allies().forEach(a => { a.bloodlust = 3 + 2 * Math.max(0, r - 1); mark(a, '😡'); }); log(`${sp.n} cast.`); break;
      case 'shield': allies().forEach(a => { a.shield = [0.3, 0.3, 0.45, 0.6][Math.min(3, r)]; mark(a, '🌀'); }); log(`${sp.n} cast.`); break;
      case 'heal': allies().forEach(a => { const g = healStack(a, sd(6 * P), a.n); mark(a, '+' + Math.round(g)); }); log(`${sp.n} cast.`); break;
      case 'dispel': for (const f of ['slow', 'haste', 'bless', 'curse', 'stone', 'bloodlust', 'shield', 'stunned', 'weak', 'disr', 'noshoot', 'berserk']) delete t[f]; mark(t, '✔'); log(sp.n + ' cleanses ' + C[t.t].n + '.'); break;
      case 'icebolt': spellHit(t, sd(20 * P + 10), 'Ice Lance pierces'); break;
      case 'weakness': foes().forEach(e => { e.weak = 3; mark(e, '🥀'); }); log(sp.n + ' cast.'); break;
      case 'disrupt': foes().forEach(e => { e.disr = 3; mark(e, '💥'); }); log(sp.n + ' cast.'); break;
      case 'forget': foes().forEach(e => { e.noshoot = 3; mark(e, '🌫️'); }); log(sp.n + ' cast.'); break;
      case 'destroyundead': for (const s2 of alive()) if (C[s2.t].fac === 'necropolis') spellHit(s2, sd(15 * P), 'Holy Light scorches'); break;
      case 'deathripple': for (const s2 of alive()) if (C[s2.t].fac !== 'necropolis' && !abil(s2, 'mindless')) spellHit(s2, sd(8 * P + 10), 'The grave wave drains'); break;
      case 'prayer': alive(0).forEach(a => { a.bloodlust = Math.max(a.bloodlust || 0, 2); a.stone = Math.max(a.stone || 0, 2); a.haste = Math.max(a.haste || 0, 2); mark(a, '🙏'); }); log(sp.n + ' lifts every banner.'); break;
      case 'berserk': t.berserk = 2; mark(t, '😤'); log(C[t.t].n + ' goes into a frenzy!'); break;
      case 'hypnotize': {
        if (totalHp(t) > 40 * P * (1 + r)) { log('The mind of ' + C[t.t].n + ' is too strong.'); break; }
        t.origSide = 1; t.hyp = 2; t.side = 0; mark(t, '🌀'); log(C[t.t].n + ' now fights for you!'); B.queue = B.queue.filter(x => x !== t); break;
      }
      case 'resurrect': { const g = healStack(t, sd(40 * P), t.maxN); mark(t, '+' + Math.round(g)); log(`${sp.n} cast.`); break; }
    }
    B.reach = computeReach(B.cur);
    refreshButtons();
    if (!checkEnd()) { /* spell does not end the turn */ }
  }
  // summon spells: elemental spirits appear on a free hex of your side (one stack of each kind per battle)
  const SUMMON = { summon_fire: 'conflux4', summon_water: 'conflux3', summon_air: 'conflux2', summon_earth: 'conflux5' };
  function castGround(k, h) {
    const sp = SPELLS[k], id = SUMMON[k];
    if (!spellOk(sp)) return toast(sp.n + ' needs Insight (rank ' + (sp.lv - 2) + ').');
    if (B.hero.mana < sp.cost) return toast('Not enough mana.');
    if (stackAt(h.c, h.r) || B.obs.has(key(h.c, h.r)) || structAt(h.c, h.r) || h.c > BW / 2) return toast('Pick a free hex on your half of the field.');
    if (B.stacks.some(s => !s.dead && s.summoned === k)) return toast('Those spirits are already here.');
    B.hero.mana -= sp.cost; B.castUsed = true; B.spell = null; sfx('spell');
    const n = Math.max(2, Math.round(B.hero.sp * (2 + spellRank(sp)))), p = hexPx(h.c, h.r);
    B.stacks.push({ t: id, n, hp: C[id].hp, side: 0, c: h.c, r: h.r, slot: -1, ammo: 0, ammoMax: 0, px: p.x, py: p.y, ret: true, maxN: n, summoned: k, waited: true });
    log(sp.n + ': ' + n + ' ' + C[id].n + ' answer the call.');
    B.fx.push({ x: p.x, y: p.y - 20, txt: '✨ ' + n, col: '#9fe8ff', t0: performance.now() });
    fxSummon(p);
    B.reach = computeReach(B.cur); refreshButtons();
  }
  // war machines (bought in the town smithy): the ballista shoots once a round, the first aid tent heals one stack a round, the ammo cart gives archers 50% more arrows
  function fireBallista(t) {
    if (!t || t.side !== 1) return toast('Pick an enemy stack.');
    if (B.balUsed) return toast('The ballista already fired this round.');
    B.balUsed = true; B.spell = null; B.balT0 = performance.now();
    const dmg = Math.floor((10 + 3 * B.hero.att) * (1 + 0.2 * perk('ballistics')));
    B.shot = { ax: HERO_POS[0].x + 14, ay: HERO_POS[0].y + 30, b: { c: t.c, r: t.r }, t0: performance.now(), col: '#d9c07a' };
    hit(t, dmg, 'The ballista fires', 'ranged');
    refreshButtons();
  }
  function firstAid(t) {
    if (!t || t.side !== 0) return toast('Pick one of your own stacks.');
    if (B.tentUsed) return toast('The first aid tent already worked this round.');
    const g = healStack(t, 40 + 12 * B.hero.sp, t.maxN);
    if (g <= 0) return toast('That stack is unhurt.');
    B.tentUsed = true; B.tentT0 = performance.now(); B.spell = null; { const p = hexPx(t.c, t.r); B.fx.push({ x: p.x, y: p.y - 20, txt: '+' + Math.round(g), col: '#7dff9a', t0: performance.now(), kind: 'heal' }); fxHeal(t); } log('The first aid tent patches up ' + C[t.t].n + '.');
    refreshButtons();
  }
  function heroStrike(t) {
    if (!t || t.side !== 1) return toast('Pick an enemy stack.');
    if (B.strikeUsed) return toast('The hero already struck this round.');
    B.strikeUsed = true; B.spell = null;
    const dmg = Math.floor((8 + 4 * B.hero.att) * (1 + 0.1 * perk('offense')));
    B.shot = { ax: HERO_POS[0].x, ay: HERO_POS[0].y, b: { c: t.c, r: t.r }, t0: performance.now(), col: '#ffe9a0' };
    B.heroFlash = [performance.now(), 0];
    hit(t, dmg, `${B.hero.name} strikes`, 'strike');
    refreshButtons();
  }
  function toast(t) { if (window.toast) window.toast(t); }

  function refreshButtons() {
    const mine = B.cur && B.cur.side === 0 && B.input;
    $('bWait').disabled = !mine || B.cur.waited;
    $('bDef').disabled = !mine;
    $('bSpell').disabled = !mine || B.castUsed || !B.hero.spells.length || B.hero.mana < 5;
    $('bHero').disabled = !mine || B.strikeUsed;
    const mc = (B.hero && B.hero.mach) || {};
    $('bBal').classList.toggle('hide', !mc.ballista); $('bBal').disabled = !mine || B.balUsed;
    $('bTent').classList.toggle('hide', !mc.tent); $('bTent').disabled = !mine || B.tentUsed;
    const canMine = !!B.siege && B.siege.dside === 0 && B.mineReserve > 0;
    $('bMine').classList.toggle('hide', !canMine); $('bMine').disabled = !mine || B.mineUsed; $('bMine').textContent = `💣 Lay mine (${B.mineReserve || 0})`;
    $('bFlee').disabled = !B.canRetreat;
    $('bAuto').textContent = B.auto ? '⏸ Manual' : '⏩ Auto';
    $('bManaB').textContent = `🔷 ${B.hero.mana}${B.castUsed ? ' (cast used)' : ''}`;
    const list = $('spells'); list.classList.add('hide');
  }
  function openSpells() {
    const list = $('spells');
    list.innerHTML = '';
    const order = { air: 0, earth: 1, fire: 2, water: 3 };
    const ks = [...B.hero.spells].sort((a, b) => order[SPELLS[a].school] - order[SPELLS[b].school] || SPELLS[a].lv - SPELLS[b].lv);
    for (const k of ks) {
      const sp = SPELLS[k], b = document.createElement('button'), rk = spellRank(sp), ok = spellOk(sp);
      b.innerHTML = `${sp.i} ${sp.n} · ${SCHOOL_ICON[sp.school]}${rk ? ' ' + RANK_NAMES[rk] : ''} · L${sp.lv} (${sp.cost})`;
      b.title = `${sp.desc}${ok ? '' : `\nNeeds Insight rank ${sp.lv - 2}`}`;
      b.disabled = B.hero.mana < sp.cost || !ok;
      b.onclick = () => { B.spell = k; list.classList.add('hide'); toast(sp.n + ': ' + (sp.tgt === 'ground' ? 'pick a free hex on your side' : sp.tgt === 'any' ? 'pick a stack' : 'pick a ' + (sp.tgt === 'enemy' ? 'enemy' : 'friendly') + ' stack')); };
      list.appendChild(b);
    }
    list.classList.toggle('hide');
  }
  function bind() {
    if (bind.done) return; bind.done = true;
    cv.addEventListener('click', onClick);
    cv.addEventListener('mousemove', onMove);
    cv.addEventListener('contextmenu', (e) => { e.preventDefault(); if (B) B.spell = null; });
    document.addEventListener('keydown', (e) => {
      if (!B || B.over || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase(), map = { w: 'bWait', d: 'bDef', s: 'bSpell', h: 'bHero', a: 'bAuto', m: 'bMine' };
      if (k === 'escape') { B.spell = null; $('spells').classList.add('hide'); return; }
      if (map[k] && !$(map[k]).disabled) { e.preventDefault(); $(map[k]).onclick(); }
    });
    $('bWait').onclick = () => B && B.cur && !B.cur.waited && playerAct(async () => { B.cur.waited = true; B.waitQ.push(B.cur); log(`${C[B.cur.t].n} waits.`); });
    $('bDef').onclick = () => B && playerAct(async () => { B.cur.defb = true; log(`${C[B.cur.t].n} defends.`); });
    $('bSpell').onclick = () => B && B.input && openSpells();
    if ($('bZoom')) $('bZoom').onclick = () => { document.body.classList.toggle('bzfit'); try { localStorage.setItem('h3-bzoom', document.body.classList.contains('bzfit') ? '0' : '1'); } catch (e) { /* ignore */ } const st = $('stage'), c = $('bat'); if (B && B.cur && st && c && !document.body.classList.contains('bzfit') && frameAction(B.cur, false)) return; if (B && B.cur && st && c) setTimeout(() => st.scrollTo({ left: Math.max(0, (B.cur.px / 960) * c.clientWidth - st.clientWidth / 2), top: Math.max(0, (B.cur.py / 640) * c.clientHeight - st.clientHeight / 2) }), 60); };
    $('bBal').onclick = () => { if (B && B.input && !B.balUsed) { B.spell = '__ballista'; toast('Ballista: pick an enemy stack'); } };
    $('bTent').onclick = () => { if (B && B.input && !B.tentUsed) { B.spell = '__tent'; toast('First aid: pick one of your stacks'); } };
    $('bHero').onclick = () => { if (B && B.input && !B.strikeUsed) { B.spell = '__strike'; toast('Hero Strike: pick an enemy stack'); } };
    $('bMine').onclick = () => { if (B && B.input && B.siege && B.mineReserve > 0 && !B.mineUsed) { B.spell = '__mine'; toast('Lay a mine: pick free ground in front of the walls'); } };
    $('bAuto').onclick = () => {
      if (!B) return; B.auto = !B.auto; refreshButtons();
      if (B.auto && B.input && !B.busy) runAI(B.cur);
    };
    $('bFlee').onclick = async () => {
      if (!B || !B.canRetreat || B.over || B.busy) return;
      const i = await window.showModal('<h2>Retreat?</h2><p>Your army will be lost, but the hero survives and returns to town.</p>', ['Retreat', 'Keep fighting']);
      if (i === 0 && !B.over) finish(false, true);
    };
  }

  // ------- rendering -------
  function hexPath(x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = Math.PI / 180 * (60 * i - 30); const px = x + r * Math.cos(a), py = y + r * Math.sin(a); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.closePath();
  }
  function emoji(t, x, y, size) { ctx.font = size + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); }

  // ---- battlefield pictures from the art pack: textured ground (grass, dirt inside castle walls, water in the moat), walls, gate, towers, mines ----
  const SIEGE_LAYOUT = ['wall', 'wall', 'tower', 'wall', 'wall', 'gate', 'wall', 'wall', 'tower', 'wall', 'wall'];
  const texCache = {};
  function flatTex(name, crop) {
    const k = name + crop.join(','); if (texCache[k] !== undefined) return texCache[k];
    const im = typeof Assets !== 'undefined' ? Assets.get(name) : null; if (!im) return texCache[k] = null;
    const c = document.createElement('canvas'); c.width = c.height = 256; c.getContext('2d').drawImage(im, im.width * crop[0], im.height * crop[1], im.width * crop[2], im.height * crop[3], 0, 0, 256, 256); return texCache[k] = c;
  }
  // painted battlefield backdrop chosen by where the fight happens (terrain) or who defends (inferno = lava, undead/dungeon = swamp)
  function bgName() { const t = (B.opts || {}).terrain; return { water: 'ship', sand: 'desert', desert: 'desert', snow: 'snow', swamp: 'swamp', lava: 'lava' }[t] || 'grass'; }
  // phones: the battlefield is a landscape board, so ask the player to turn the phone (and lock landscape where the browser allows it)
  function rotateHint(on) {
    if (typeof matchMedia === 'undefined') return;
    const el = document.getElementById('rotate'); if (!el || !el.classList) return;
    const phone = window.innerWidth < 900 && (matchMedia('(pointer: coarse)').matches || window.innerWidth < 760);
    const upd = () => { const portrait = innerHeight > innerWidth; el.classList.toggle('hide', !(on && phone && portrait && !el.dataset.skip)); };
    if (on) { delete el.dataset.skip; try { if (phone && screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* ignore */ } }
    else { try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { /* ignore */ } }
    rotateHint.upd = on ? upd : null; upd();
    const skip = document.getElementById('rotateSkip'); if (skip) skip.onclick = () => { el.dataset.skip = '1'; upd(); };
  }
  if (typeof window.addEventListener === 'function') { window.addEventListener('resize', () => { if (rotateHint.upd) rotateHint.upd(); }); window.addEventListener('orientationchange', () => setTimeout(() => { if (rotateHint.upd) rotateHint.upd(); }, 200)); }
  function buildBoard() {
    const bgi = typeof Assets !== 'undefined' ? Assets.get('battle/bg_' + bgName(), 'battle/bg_grass') : null;
    if (bgi) { const c = document.createElement('canvas'); c.width = 960 * DPR; c.height = 640 * DPR; const g = c.getContext('2d'), k = Math.max(960 / bgi.width, 640 / bgi.height), w = bgi.width * k, h = bgi.height * k; g.scale(DPR, DPR); g.imageSmoothingQuality = 'high'; g.drawImage(bgi, (960 - w) / 2, (640 - h) / 2, w, h); B._bg = true; return c; }
    const grass = flatTex('battle/grass', [0.3, 0.26, 0.4, 0.2]), dirt = flatTex('battle/dirt', [0.3, 0.26, 0.4, 0.2]), water = flatTex('terrain/water', [0, 0, 1, 1]);
    if (!grass) return null;
    const c = document.createElement('canvas'); c.width = 960 * DPR; c.height = 640 * DPR; const g = c.getContext('2d');
    g.scale(DPR, DPR); g.imageSmoothingQuality = 'high';
    g.fillStyle = '#33502b'; g.fillRect(0, 0, 960, 640);
    for (let r = 0; r < BH; r++) for (let col = 0; col < BW; col++) {
      const p = hexPx(col, r), inside = B.siege && (B.siege.dside === 1 ? col > B.cw : col < B.cw), moat = B.siege && B.moat.has(key(col, r));
      const tex = moat && water ? water : (inside || (!B.siege && ((col * 7 + r * 3) % 11 === 0))) && dirt ? dirt : grass;
      const sw = 96, sx = ((col * 37 + r * 91) % 7) / 7 * (256 - sw), sy = ((col * 53 + r * 29) % 7) / 7 * (256 - sw);
      g.save(); hexPath2(g, p.x, p.y, HR + 0.6); g.clip(); g.drawImage(tex, sx, sy, sw, sw, p.x - HW / 2 - 1, p.y - HR - 1, HW + 2, HR * 2 + 2); g.restore();
    }
    return c;
  }
  function hexPath2(g, x, y, r) { g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 180 * (60 * i - 30); i ? g.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)) : g.moveTo(x + r * Math.cos(a), y + r * Math.sin(a)); } g.closePath(); }
  // ---- battlefield obstacles: painted from the map's terrain textures (forest clumps, rock outcrops, a fallen log), cached per hex ----
  function obsBlob(g, cx, cy, rx, ry, seed, n = 14) {
    const pts = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, w = 0.86 + 0.28 * rnd(seed + i, 1.7); pts.push([cx + Math.cos(a) * rx * w, cy + Math.sin(a) * ry * w]); }
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], m0 = mid(pts[n - 1], pts[0]);
    g.beginPath(); g.moveTo(m0[0], m0[1]); for (let i = 0; i < n; i++) { const q = mid(pts[i], pts[(i + 1) % n]); g.quadraticCurveTo(pts[i][0], pts[i][1], q[0], q[1]); } g.closePath();
  }
  function obsTex(g, name, scale, ox, oy) {
    const im = typeof Assets !== 'undefined' ? Assets.get('terrain/' + name) : null; if (!im) return null;
    const pat = g.createPattern(im, 'repeat'); if (pat.setTransform) pat.setTransform(new DOMMatrix().translate(ox, oy).scale(scale / im.width)); return pat;
  }
  function obsSmooth(g, P) { g.beginPath(); g.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length - 1; i++) { const m = [(P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2]; g.quadraticCurveTo(P[i][0], P[i][1], m[0], m[1]); } g.lineTo(P[P.length - 1][0], P[P.length - 1][1]); g.closePath(); }
  function obsShadow(g, x, y, rx, ry) { g.save(); g.translate(x, y); g.scale(1, ry / rx); const rg = g.createRadialGradient(0, 0, 2, 0, 0, rx); rg.addColorStop(0, 'rgba(0,0,0,.5)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.beginPath(); g.arc(0, 0, rx, 0, 7); g.fill(); g.restore(); }

  // ---- new obstacle art: pines, oaks, bushes, faceted boulders, ruined walls, stumps and hay, all painted from the map textures with light from the top left ----
  const OB_LIT = (g, x0, y0, w, h, lo, hi) => { const lg = g.createLinearGradient(x0, y0, x0 + w, y0 + h * 0.6); lg.addColorStop(0, hi); lg.addColorStop(0.5, 'rgba(0,0,0,0)'); lg.addColorStop(1, lo); g.fillStyle = lg; g.fillRect(x0, y0, w, h); };
  function obPine(g, x, by, h, seed, fp) {
    g.fillStyle = '#4a2f18'; g.beginPath(); g.moveTo(x - 3, by); g.lineTo(x - 2, by - 10); g.lineTo(x + 2, by - 10); g.lineTo(x + 3, by); g.closePath(); g.fill();
    const tiers = 4;
    for (let i = 0; i < tiers; i++) {
      const bot = by - 6 - i * h * 0.19, top = bot - h * 0.36 + i * 1.5, w = h * 0.3 * (1 - i * 0.2), sc = 3 + rnd(seed + i, 2.3) * 2;
      const path = () => { g.beginPath(); g.moveTo(x, top); g.quadraticCurveTo(x + w * 0.7, bot - h * 0.12, x + w, bot); for (let k = 1; k <= 3; k++) g.quadraticCurveTo(x + w - (k - 0.5) * w * 2 / 3, bot + sc, x + w - k * w * 2 / 3, bot - 1); g.quadraticCurveTo(x - w * 0.7, bot - h * 0.12, x, top); g.closePath(); };
      path(); g.save(); g.clip(); if (fp) { g.fillStyle = fp; g.fillRect(x - w - 2, top, w * 2 + 4, bot - top + 6); } else { g.fillStyle = '#2f6a2a'; g.fillRect(x - w - 2, top, w * 2 + 4, bot - top + 6); }
      g.fillStyle = 'rgba(70,130,50,.28)'; g.fillRect(x - w - 2, top, w * 2 + 4, bot - top + 6);
      OB_LIT(g, x - w, top, w * 2, bot - top, 'rgba(0,16,6,.55)', 'rgba(220,255,150,.42)');
      const sg = g.createLinearGradient(0, bot - 7, 0, bot + 4); sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,10,4,.5)'); g.fillStyle = sg; g.fillRect(x - w - 2, bot - 7, w * 2 + 4, 12);
      g.restore(); path(); g.lineWidth = 1.1; g.lineJoin = 'round'; g.strokeStyle = 'rgba(4,24,10,.75)'; g.stroke();
    }
  }
  function obOak(g, x, by, sc, seed, fp) {
    // trunk with flared roots
    const tg = g.createLinearGradient(x - 6, 0, x + 6, 0); tg.addColorStop(0, '#8a5a30'); tg.addColorStop(0.5, '#5e3a1c'); tg.addColorStop(1, '#33200f');
    g.fillStyle = tg; g.beginPath(); g.moveTo(x - 9 * sc, by + 1); g.quadraticCurveTo(x - 3 * sc, by - 4 * sc, x - 3.2 * sc, by - 16 * sc); g.lineTo(x + 3.2 * sc, by - 16 * sc); g.quadraticCurveTo(x + 3 * sc, by - 4 * sc, x + 9 * sc, by + 1); g.closePath(); g.fill(); g.lineWidth = 1; g.strokeStyle = 'rgba(20,10,4,.8)'; g.stroke();
    const blobs = [[-11, -27, 11, 9], [11, -27, 11, 9], [0, -22, 13, 10], [-8, -36, 11, 9], [9, -35, 10, 8], [0, -43, 10, 8]];
    const shade = ['rgba(0,18,6,.5)', 'rgba(0,18,6,.32)', 'rgba(0,0,0,0)'];
    blobs.forEach(([dx, dy, rx, ry], i) => {
      const bx = x + dx * sc, byy = by + dy * sc, brx = rx * sc, bry = ry * sc;
      obsBlob(g, bx, byy, brx, bry, seed * 5 + i * 7); g.save(); g.clip();
      if (fp) { g.fillStyle = fp; g.fillRect(bx - brx - 3, byy - bry - 3, brx * 2 + 6, bry * 2 + 6); }
      g.fillStyle = 'rgba(110,180,60,.30)'; g.fillRect(bx - brx - 3, byy - bry - 3, brx * 2 + 6, bry * 2 + 6);
      OB_LIT(g, bx - brx, byy - bry, brx * 2, bry * 2, shade[Math.min(2, Math.floor(i / 2))] === 'rgba(0,0,0,0)' ? 'rgba(0,16,6,.4)' : shade[Math.floor(i / 2)], 'rgba(235,255,150,.5)');
      g.fillStyle = 'rgba(255,255,190,.22)'; for (let q = 0; q < 6; q++) { g.beginPath(); g.ellipse(bx - brx * 0.4 + rnd(seed + q + i, 1.3) * brx * 0.9, byy - bry * 0.5 + rnd(seed + q + i, 2.3) * bry * 0.6, 2.4, 1.5, 0.5, 0, 7); g.fill(); }
      g.restore(); obsBlob(g, bx, byy, brx, bry, seed * 5 + i * 7); g.lineWidth = 1.2; g.strokeStyle = 'rgba(6,28,10,.75)'; g.stroke();
    });
  }
  function obBush(g, x, by, sc, seed, fp, flowers) {
    [[-8, -5, 9, 7], [8, -5, 9, 7], [0, -9, 10, 8]].forEach(([dx, dy, rx, ry], i) => {
      const bx = x + dx * sc, byy = by + dy * sc, brx = rx * sc, bry = ry * sc; obsBlob(g, bx, byy, brx, bry, seed + i * 9, 11); g.save(); g.clip();
      if (fp) { g.fillStyle = fp; g.fillRect(bx - brx - 2, byy - bry - 2, brx * 2 + 4, bry * 2 + 4); } g.fillStyle = 'rgba(120,190,60,.28)'; g.fillRect(bx - brx - 2, byy - bry - 2, brx * 2 + 4, bry * 2 + 4);
      OB_LIT(g, bx - brx, byy - bry, brx * 2, bry * 2, 'rgba(0,16,6,.5)', 'rgba(235,255,150,.45)'); g.restore();
      obsBlob(g, bx, byy, brx, bry, seed + i * 9, 11); g.lineWidth = 1.1; g.strokeStyle = 'rgba(6,28,10,.75)'; g.stroke();
    });
    const cols = flowers ? ['#fff3b0', '#ffffff', '#ffb0c8'] : ['#d8362a', '#b02a20']; for (let i = 0; i < 9; i++) { g.fillStyle = cols[i % cols.length]; g.beginPath(); g.arc(x + (rnd(seed + i, 3.1) - 0.5) * 30 * sc, by - 4 * sc - rnd(seed + i, 4.1) * 11 * sc, 1.5 * sc, 0, 7); g.fill(); }
  }
  function obBoulder(g, x, y, rw, rh, seed, rp) {
    const n = 9, P = []; for (let i = 0; i < n; i++) { const a = Math.PI + (i / (n - 1)) * Math.PI, w = 0.86 + 0.2 * rnd(seed + i, 7.7); P.push([x + Math.cos(a) * rw * w, y + Math.sin(a) * rh * w * 1.5 * (i % 2 ? 0.95 : 1.05) * 0.8]); }
    const poly = () => { g.beginPath(); g.moveTo(x - rw, y + 1); P.forEach(q => g.lineTo(q[0], q[1])); g.lineTo(x + rw, y + 1); g.closePath(); };
    poly(); g.save(); g.clip();
    if (rp) { g.fillStyle = rp; g.fillRect(x - rw - 2, y - rh * 1.6, rw * 2 + 4, rh * 1.9); } else { g.fillStyle = '#8a8478'; g.fillRect(x - rw - 2, y - rh * 1.6, rw * 2 + 4, rh * 1.9); }
    g.fillStyle = 'rgba(190,180,160,.22)'; g.fillRect(x - rw - 2, y - rh * 1.6, rw * 2 + 4, rh * 1.9);
    // planes: lit top, mid left, shaded right
    g.fillStyle = 'rgba(255,255,255,.26)'; g.beginPath(); g.moveTo(x - rw, y - rh * 0.3); g.lineTo(P[2][0], P[2][1]); g.lineTo(P[4][0], P[4][1]); g.lineTo(P[5][0], P[5][1]); g.lineTo(x, y - rh * 0.45); g.closePath(); g.fill();
    g.fillStyle = 'rgba(12,8,30,.34)'; g.beginPath(); g.moveTo(x + rw * 0.15, y - rh * 0.45); g.lineTo(P[5][0], P[5][1]); g.lineTo(P[7][0], P[7][1]); g.lineTo(x + rw, y + 1); g.lineTo(x + rw * 0.3, y + 1); g.closePath(); g.fill();
    OB_LIT(g, x - rw, y - rh * 1.6, rw * 2, rh * 1.9, 'rgba(6,4,20,.5)', 'rgba(255,255,255,.1)');
    g.strokeStyle = 'rgba(20,14,10,.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - rw * 0.2, y - rh * 0.5); g.lineTo(x - rw * 0.05, y - rh * 0.05); g.lineTo(x - rw * 0.25, y + 1); g.moveTo(x + rw * 0.35, y - rh * 0.2); g.lineTo(x + rw * 0.5, y + 1); g.stroke();
    g.fillStyle = 'rgba(112,156,60,.85)'; obsBlob(g, x - rw * 0.35, y - rh * 0.85, rw * 0.42, rh * 0.16, seed + 3, 8); g.fill(); obsBlob(g, x + rw * 0.2, y - rh * 0.75, rw * 0.26, rh * 0.1, seed + 5, 8); g.fill();
    g.restore(); poly(); g.lineJoin = 'round'; g.lineWidth = 1.4; g.strokeStyle = 'rgba(24,18,14,.8)'; g.stroke();
  }
  function obTufts(g, x, y, w, seed) { g.strokeStyle = 'rgba(70,120,40,.9)'; g.lineWidth = 1.3; g.lineCap = 'round'; for (let i = 0; i < 6; i++) { const tx = x + (rnd(seed + i, 5.1) - 0.5) * w; g.beginPath(); g.moveTo(tx, y); g.lineTo(tx - 2, y - 5); g.moveTo(tx, y); g.lineTo(tx + 2, y - 4); g.stroke(); } }
  function obRuin(g, x, by, seed, rp) {
    const cols = 4, bw = 14, rowsH = [34, 24, 40, 18];
    for (let i = 0; i < cols; i++) {
      const bx = x - 28 + i * bw, h = rowsH[(i + seed) % 4];
      for (let rI = 0; rI * 7 < h; rI++) {
        const yy = by - (rI + 1) * 7, off = rI % 2 ? 4 : 0;
        g.beginPath(); if (g.roundRect) g.roundRect(bx - off, yy, bw - 1, 6.5, 1.2); else g.rect(bx - off, yy, bw - 1, 6.5); g.save(); g.clip();
        g.fillStyle = rp || '#8a8478'; g.fillRect(bx - 6, yy, bw + 8, 7); g.fillStyle = 'rgba(210,200,180,' + (0.12 + rnd(seed + i * 7 + rI, 1.9) * 0.2) + ')'; g.fillRect(bx - 6, yy, bw + 8, 7);
        OB_LIT(g, bx - 4, yy, bw, 7, 'rgba(6,4,20,.5)', 'rgba(255,255,255,.22)'); g.restore(); g.lineWidth = 0.9; g.strokeStyle = 'rgba(28,22,16,.75)'; g.beginPath(); if (g.roundRect) g.roundRect(bx - off, yy, bw - 1, 6.5, 1.2); else g.rect(bx - off, yy, bw - 1, 6.5); g.stroke();
      }
    }
    g.fillStyle = 'rgba(86,130,50,.8)'; for (let i = 0; i < 5; i++) { obsBlob(g, x - 24 + i * 12 + rnd(seed + i, 1.1) * 4, by - 20 - rnd(seed + i, 2.2) * 14, 5, 3, seed + i, 8); g.fill(); }
    obTufts(g, x, by + 1, 62, seed);
  }
  function obStump(g, x, by, seed) {
    const bg = g.createLinearGradient(x - 10, 0, x + 10, 0); bg.addColorStop(0, '#a87442'); bg.addColorStop(0.5, '#74502a'); bg.addColorStop(1, '#3a2612');
    g.fillStyle = bg; g.beginPath(); g.moveTo(x - 13, by + 1); g.quadraticCurveTo(x - 8, by - 4, x - 9, by - 14); g.lineTo(x + 9, by - 14); g.quadraticCurveTo(x + 8, by - 4, x + 13, by + 1); g.closePath(); g.fill(); g.lineWidth = 1.1; g.strokeStyle = 'rgba(20,10,4,.85)'; g.stroke();
    const tg = g.createRadialGradient(x - 2, by - 17, 1, x, by - 15, 11); tg.addColorStop(0, '#ecd29a'); tg.addColorStop(1, '#b8884e'); g.fillStyle = tg; g.beginPath(); g.ellipse(x, by - 14, 9, 4.4, 0, 0, 7); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(110,70,30,.6)'; g.lineWidth = 0.7; for (const k of [0.65, 0.35]) { g.beginPath(); g.ellipse(x, by - 14, 9 * k, 4.4 * k, 0, 0, 7); g.stroke(); }
    for (const [mx, my, sc] of [[x + 13, by - 1, 1], [x + 18, by + 2, 0.7]]) { g.fillStyle = '#efe4c8'; g.fillRect(mx - 1, my - 3, 2, 4); g.fillStyle = '#d8362a'; g.beginPath(); g.ellipse(mx, my - 4, 4 * sc, 2.6 * sc, 0, Math.PI, 0); g.fill(); g.fillStyle = '#fff'; g.fillRect(mx - 1, my - 5.5, 1, 1); }
    obTufts(g, x - 14, by + 2, 14, seed);
  }
  function obHay(g, x, by, seed) {
    g.fillStyle = '#c8a24a'; g.beginPath(); g.ellipse(x, by - 8, 15, 11, 0, 0, 7); g.fill(); g.lineWidth = 1.2; g.strokeStyle = 'rgba(70,44,10,.85)'; g.stroke();
    const sg = g.createLinearGradient(x - 15, by - 18, x + 15, by + 3); sg.addColorStop(0, 'rgba(255,240,170,.5)'); sg.addColorStop(0.55, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(60,30,0,.5)'); g.fillStyle = sg; g.fill();
    g.strokeStyle = 'rgba(120,84,20,.55)'; g.lineWidth = 0.8; for (let i = 0; i < 9; i++) { const a = rnd(seed + i, 3.9) * 6.28, r1 = rnd(seed + i, 4.9) * 9; g.beginPath(); g.moveTo(x + Math.cos(a) * r1 * 0.6, by - 8 + Math.sin(a) * r1 * 0.5); g.lineTo(x + Math.cos(a) * (r1 + 5) * 0.8, by - 8 + Math.sin(a) * (r1 + 5) * 0.65); g.stroke(); }
    g.strokeStyle = '#7a4a22'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, by - 8, 15, 11, 0, 0.4, 2.7); g.stroke();
    g.strokeStyle = 'rgba(226,190,90,.9)'; g.lineWidth = 1; for (let i = 0; i < 6; i++) { const sx = x + (rnd(seed + i, 6.1) - 0.5) * 44; g.beginPath(); g.moveTo(sx, by + 2); g.lineTo(sx + (rnd(seed + i, 7.1) - 0.5) * 6, by - 2); g.stroke(); }
  }
  function buildObstacle(oe, seed) {
    const S = Math.max(2, DPR), W = 96, H = 96, cx = 48, cy = 62, cv = document.createElement('canvas'); cv.width = W * S; cv.height = H * S; const g = cv.getContext('2d'); g.scale(S, S);
    const base = cy + 15, fp = () => obsTex(g, 'tex_forest', 96, -rnd(seed, 3.3) * 260, -rnd(seed, 4.4) * 260), rp = () => obsTex(g, 'tex_mountain', 120, -rnd(seed, 5.5) * 300, -rnd(seed, 6.6) * 300);
    const out = { cv, ox: cx, oy: cy, w: W, h: H };
    if (oe === '🌲') { const f = fp(); if (!f) return null; obsShadow(g, cx + 2, base, 33, 10); obPine(g, cx + 13, base - 4, 38, seed + 2, f); obPine(g, cx - 14, base - 2, 44, seed, f); obPine(g, cx + 1, base + 2, 52, seed + 5, f); return out; }
    if (oe === '🌳') { const f = fp(); if (!f) return null; obsShadow(g, cx, base, 30, 9); obOak(g, cx, base, 0.95, seed, f); return out; }
    if (oe === '🌿') { const f = fp(); if (!f) return null; obsShadow(g, cx, base, 28, 8); obBush(g, cx - 6, base - 2, 1.05, seed, f, seed % 2 === 0); obBush(g, cx + 14, base + 1, 0.7, seed + 4, f, seed % 2 === 0); return out; }
    if (oe === '🪨' || oe === '⛰️') {
      const r = rp(); if (!r) return null; obsShadow(g, cx + 2, base, 36, 10); const big = oe === '⛰️';
      obBoulder(g, cx - 14, base - 1, big ? 22 : 17, big ? 20 : 15, seed, r); obBoulder(g, cx + 14, base + 1, big ? 19 : 12, big ? 17 : 11, seed + 3, r); if (!big) obBoulder(g, cx + 1, base + 4, 10, 8, seed + 6, r); else obBoulder(g, cx + 3, base + 3, 14, 11, seed + 6, r);
      obTufts(g, cx - 6, base + 4, 56, seed); return out;
    }
    if (oe === '🏚️') { const r = rp(); if (!r) return null; obsShadow(g, cx, base, 34, 9); obRuin(g, cx, base, seed, r); return out; }
    if (oe === '🍄') { obsShadow(g, cx, base, 24, 7); obStump(g, cx, base, seed); return out; }
    if (oe === '🌾') { obsShadow(g, cx, base, 24, 7); obHay(g, cx - 6, base, seed); obHay(g, cx + 14, base + 2, seed + 4); return out; }
    {
    // (the older versions below are only reached by a key the new art does not know)
    }
    const cx0 = 0; if (cx0) {
    if (oe === '🌲') {
      const fp = obsTex(g, 'tex_forest', 96, -rnd(seed, 3.3) * 260, -rnd(seed, 4.4) * 260); if (!fp) return null;
      obsShadow(g, cx + 2, cy + 15, 31, 11);
      const cl = [[-13, 5, 15, 16], [12, 6, 14, 15], [-1, 8, 16, 15], [-9, -7, 14, 15], [10, -6, 13, 14], [0, -17, 13, 14]];
      cl.forEach(([dx, dy, rx, ry], i) => {
        const x = cx + dx, y = cy + dy; obsBlob(g, x, y, rx, ry, seed * 7 + i * 5);
        g.save(); g.clip(); g.fillStyle = fp; g.fillRect(x - rx - 4, y - ry - 4, rx * 2 + 8, ry * 2 + 8); g.fillStyle = 'rgba(132,190,70,.2)'; g.fillRect(x - rx - 4, y - ry - 4, rx * 2 + 8, ry * 2 + 8);
        const lg = g.createLinearGradient(x - rx * 0.6, y - ry, x + rx * 0.6, y + ry); lg.addColorStop(0, 'rgba(255,255,170,.4)'); lg.addColorStop(0.55, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(0,12,4,.36)'); g.fillStyle = lg; g.fillRect(x - rx - 4, y - ry - 4, rx * 2 + 8, ry * 2 + 8); g.restore();
        obsBlob(g, x, y, rx, ry, seed * 7 + i * 5); g.lineWidth = 1.3; g.strokeStyle = 'rgba(6,26,10,.7)'; g.stroke();
      });
      return { cv, ox: cx, oy: cy, w: W, h: H };
    }
    if (oe === '🪨' || oe === '⛰️') {
      const rp = obsTex(g, 'tex_mountain', 120, -rnd(seed, 5.5) * 300, -rnd(seed, 6.6) * 300); if (!rp) return null;
      obsShadow(g, cx + 3, cy + 15, 34, 10);
      const n = 7, base = cy + 15, pts = []; for (let i = 0; i < n; i++) { const t = i / (n - 1), x = cx - 29 + 58 * t, bell = 1 - Math.pow((t - 0.5) * 2, 2) * 0.72, h = (i % 2 === 0 ? 27 + 15 * rnd(seed + i, 2.2) : 12 + 6 * rnd(seed + i, 2.9)) * (0.66 + bell * 0.6); pts.push([x, base - 2 - h]); }
      obsSmooth(g, [[cx - 31, base + 1], ...pts, [cx + 31, base + 1]]);
      g.save(); g.clip(); g.fillStyle = rp; g.fillRect(cx - 34, cy - 40, 68, 60); g.fillStyle = 'rgba(205,194,172,.2)'; g.fillRect(cx - 34, cy - 40, 68, 60);
      const lg = g.createLinearGradient(cx - 30, cy - 36, cx + 30, cy + 16); lg.addColorStop(0, 'rgba(255,255,255,.30)'); lg.addColorStop(0.5, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(8,6,22,.55)'); g.fillStyle = lg; g.fillRect(cx - 34, cy - 40, 68, 60);
      for (let i = 0; i < n; i += 2) { const pk = pts[i], r2 = pts[Math.min(n - 1, i + 1)]; g.beginPath(); g.moveTo(pk[0], pk[1]); g.lineTo(r2[0] + 3, r2[1]); g.lineTo(pk[0] + 7, base + 1); g.lineTo(pk[0], base + 1); g.closePath(); g.fillStyle = 'rgba(0,0,0,.2)'; g.fill(); }
      const top = pts.filter((q, i) => i % 2 === 0).sort((a, b) => a[1] - b[1]).slice(0, 2);
      for (const q of top) { const sg = g.createLinearGradient(0, q[1], 0, q[1] + 12); sg.addColorStop(0, 'rgba(255,255,255,.95)'); sg.addColorStop(1, 'rgba(235,242,255,0)'); g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(q[0] + 7, q[1] + 11); g.lineTo(q[0] + 2, q[1] + 8); g.lineTo(q[0] - 2, q[1] + 12); g.lineTo(q[0] - 7, q[1] + 9); g.closePath(); g.fillStyle = sg; g.fill(); }
      g.restore();
      obsSmooth(g, [[cx - 31, base + 1], ...pts, [cx + 31, base + 1]]); g.lineJoin = 'round'; g.lineWidth = 1.4; g.strokeStyle = 'rgba(24,18,14,.75)'; g.stroke();
      return { cv, ox: cx, oy: cy, w: W, h: H };
    }
    if (oe === '🪵') {
      obsShadow(g, cx, cy + 13, 27, 7);
      g.save(); g.translate(cx, cy + 5); g.rotate(-0.1 + rnd(seed, 8.8) * 0.2);
      const bg = g.createLinearGradient(0, -8, 0, 8); bg.addColorStop(0, '#d2a86a'); bg.addColorStop(0.35, '#a87a44'); bg.addColorStop(1, '#4a2f16');
      g.beginPath(); if (g.roundRect) g.roundRect(-24, -8, 48, 16, 7); else g.rect(-24, -8, 48, 16); g.fillStyle = bg; g.fill(); g.lineWidth = 1.2; g.strokeStyle = 'rgba(30,18,8,.85)'; g.stroke();
      g.strokeStyle = 'rgba(40,24,10,.5)'; g.lineWidth = 0.9; for (let i = 0; i < 7; i++) { const y = -6 + i * 2.1, x0 = -20 + rnd(seed + i, 1.1) * 14, x1 = x0 + 10 + rnd(seed + i, 2.1) * 18; g.beginPath(); g.moveTo(x0, y); g.lineTo(Math.min(22, x1), y + (rnd(seed + i, 3.1) - 0.5) * 1.2); g.stroke(); }
      g.fillStyle = 'rgba(30,16,6,.55)'; for (const [kx, ky] of [[6, -2], [-8, 3]]) { g.beginPath(); g.ellipse(kx, ky, 2.4, 1.6, 0, 0, 7); g.fill(); }
      const ec = g.createRadialGradient(-24, 0, 1, -24, 0, 8); ec.addColorStop(0, '#e8cc92'); ec.addColorStop(1, '#b88c52'); g.beginPath(); g.ellipse(-24, 0, 5.5, 8, 0, 0, 7); g.fillStyle = ec; g.fill(); g.strokeStyle = 'rgba(70,40,14,.8)'; g.lineWidth = 1; g.stroke();
      g.strokeStyle = 'rgba(110,70,30,.55)'; g.lineWidth = 0.7; for (const k of [0.62, 0.34]) { g.beginPath(); g.ellipse(-24, 0, 5.5 * k, 8 * k, 0, 0, 7); g.stroke(); }
      g.fillStyle = 'rgba(96,140,56,.85)'; for (let i = 0; i < 4; i++) { obsBlob(g, -8 + i * 8 + rnd(seed + i, 4.1) * 3, -7.2, 4.5, 2.2, seed + i * 3, 8); g.fill(); }
      g.restore();
      g.strokeStyle = 'rgba(60,110,40,.85)'; g.lineWidth = 1.2; g.lineCap = 'round'; for (const [tx, ty] of [[-28, 14], [-25, 15], [26, 15], [29, 14]]) { g.beginPath(); g.moveTo(cx + tx, cy + ty); g.lineTo(cx + tx + (tx < 0 ? -2 : 2), cy + ty - 5); g.stroke(); }
      return { cv, ox: cx, oy: cy, w: W, h: H };
    }
    }
    return null;
  }
  const OBK = 1.32;      // obstacles are drawn a third larger than they are painted: they fill their hex and read clearly on a phone
  function obstacleSprite(oe, c, r) {
    const cache = B._obsSpr || (B._obsSpr = new Map()), k = oe + c + ',' + r; if (cache.has(k)) return cache.get(k);
    const spr = buildObstacle(oe, c * 17 + r * 31 + 3); if (spr) cache.set(k, spr); return spr;
  }
  // ---- unit bases and target marks: soft ground discs and glows instead of flat hex outlines ----
  function hexGlow(x, y, rgb, a) { const g = ctx.createRadialGradient(x, y, 2, x, y, HR); g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)'); hexPath(x, y, HR - 1); ctx.fillStyle = g; ctx.fill(); }
  function reticle(x, y, rx, ry, now) {
    const pulse = 0.5 + 0.5 * Math.sin(now / 240);
    ctx.save(); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(x, y, rx + 3 * pulse, ry + 1.2 * pulse, 0, 0, 7); ctx.strokeStyle = 'rgba(255,90,70,' + (0.7 + 0.25 * pulse).toFixed(2) + ')'; ctx.lineWidth = 2.2; ctx.shadowColor = 'rgba(255,60,40,.8)'; ctx.shadowBlur = 8; ctx.stroke();
    ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,235,220,.9)'; ctx.lineWidth = 1.4;
    for (let k = 0; k < 4; k++) { const a = now / 1100 + k * Math.PI / 2; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * (rx + 3), y + Math.sin(a) * (ry + 1.2)); ctx.lineTo(x + Math.cos(a) * (rx + 9), y + Math.sin(a) * (ry + 3.5)); ctx.stroke(); }
    ctx.restore();
  }
  // whose turn it is: a bobbing arrow above the creature (gold for yours, red for the enemy's)
  function turnMarker(x, y, mine, now) {
    const b = reduced() ? 0 : Math.sin(now / 240) * 3, c0 = mine ? '#fff2b0' : '#ffd0c0', c1 = mine ? '#e6a82a' : '#e0503a';
    ctx.save(); ctx.translate(x, y + b); ctx.scale(1.5, 1.5); ctx.beginPath(); ctx.moveTo(-9, -8); ctx.lineTo(9, -8); ctx.lineTo(0, 6); ctx.closePath();
    const g = ctx.createLinearGradient(0, -8, 0, 6); g.addColorStop(0, c0); g.addColorStop(1, c1);
    ctx.shadowColor = 'rgba(0,0,0,.65)'; ctx.shadowBlur = 5; ctx.fillStyle = g; ctx.fill(); ctx.shadowBlur = 0; ctx.lineJoin = 'round'; ctx.lineWidth = 1.8; ctx.strokeStyle = '#2a1604'; ctx.stroke();
    ctx.restore();
  }
  function unitBase(x, y, rx, ry, side, cur, flash, now) {
    const tc = side === 0 ? '96,156,255' : '238,90,74';
    ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, rx * 1.15); g.addColorStop(0, flash ? 'rgba(255,110,90,.65)' : 'rgba(0,0,0,.5)'); g.addColorStop(0.62, 'rgba(0,0,0,.26)'); g.addColorStop(1, 'rgba(' + tc + ',.16)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx * 1.1, 0, 7); ctx.fill(); ctx.restore();
    const pulse = 0.5 + 0.5 * Math.sin(now / 260);
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.lineWidth = cur ? 2.6 : 1.7; ctx.strokeStyle = cur ? 'rgba(255,214,90,' + (0.8 + 0.2 * pulse).toFixed(2) + ')' : 'rgba(' + tc + ',.85)'; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, y, rx - 2.2, ry - 0.9, 0, 0, 7); ctx.lineWidth = 0.7; ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.stroke();
  }
  const sprite = (img, x, y, w) => { const h = img.height * w / img.width; ctx.drawImage(img, x - w / 2, y - h + 24, w, h); };
  // resolution for the small painted portraits: enough pixels for sharp edges on dense screens
  const PS = () => (DPR > 1 ? 144 : 96);
  // the battle picture of a stack in a given state (idle / fighting / defending), or null while it has none
  const poseOf = (s, pst) => {
    if (typeof Assets === 'undefined') return null;
    const pb = String(s.t).replace(/_\d$/, ''), pu = /_\d$/.test(String(s.t)) ? '_up' : '', pd = s.side === 0 ? 'right' : 'left';
    return Assets.get('poses/' + pd + '/' + pst + '/' + pb + pu, 'poses/' + pd + '/idle/' + pb + pu, 'poses/' + pd + '/idle/' + pb);
  };
  // ---- creature animation ----
  // Frame sequences from art/anim/<creature id>/<state>_<n>.webp (n = 1, 2, 3 …; states: idle, attack, defend (or hurt), death).
  // Frames face right; the enemy side is mirrored. Any state without frames keeps the still picture, moved by a motion style that is
  // different for each creature (see profOf), so every creature already animates before its frames exist.
  const ANIM_STATES = ['idle', 'walk', 'attack', 'defend', 'death'], seqCache = {};
  // neutral creatures that are the same creature as a town one share its animation (until they get their own folder)
  const ANIM_ALIAS = { goblin: 'stronghold1', wolf: 'stronghold2', orc: 'stronghold3', ogre: 'stronghold4', golem: 'tower3', naga: 'tower6', dragon: 'rampart7' };
  const ANIM_MS = { walk: 100, idle: 300, attack: 110, defend: 120, death: 180 };    // milliseconds per frame; the blow lands on attack frame 3
  const skipCache = {};
  function atkSkip(t) {     // 1 when attack_1 is just the idle pose again (then the attack starts on frame 2)
    const key = String(t); if (key in skipCache) return skipCache[key];
    const a = seqOf(t, 'attack'), i = seqOf(t, 'idle'), A = a && Assets.get(a[0]), I = i && Assets.get(i[0]); if (!A || !I) return 0;
    const px = (im) => { const c = document.createElement('canvas'); c.width = 32; c.height = 24; const g = c.getContext('2d'); g.drawImage(im, 0, 0, 32, 24); return g.getImageData(0, 0, 32, 24).data; };
    const da = px(A), di = px(I); let d = 0; for (let k = 0; k < da.length; k++) d += Math.abs(da[k] - di[k]);
    return (skipCache[key] = d / da.length < 2.5 && a.length >= 4 ? 1 : 0);
  }
  const idleMs = (t) => (C[t] && C[t].fly ? 330 : ANIM_MS.idle);      // wings beat far faster than a creature breathes
  const atkFrames = (t) => { const q = seqOf(t, 'attack'); return q ? q.slice(atkSkip(t)) : null; };
  const animDur = (t, state) => { const q = state === 'attack' ? atkFrames(t) : seqOf(t, state); return q && q.length ? q.length * ANIM_MS[state] / spd() : 0; };
  // ---- facing: a creature turns toward what it attacks and the way it walks (a quick flip), then turns back to face the enemy side ----
  const defFace = (s) => (s.side === 0 ? 1 : -1);
  function faceTo(s, x, hold) {
    const sx = s.px !== undefined ? s.px : hexPx(s.c, s.r).x; if (Math.abs(x - sx) > 6) s.faceT = x > sx ? 1 : -1;
    s.faceUntil = performance.now() + (hold || 0);
  }
  function faceStep(s, now) {
    if (s.fx === undefined) { s.fx = defFace(s); s.faceT = s.fx; }
    if (s.faceUntil !== undefined && now > s.faceUntil && !s.anim && s.faceT !== defFace(s)) s.faceT = defFace(s);
    const dt = Math.min(60, now - (s._ft || now)), d = s.faceT - s.fx, st = dt / 150 * 2; s._ft = now;
    s.fx = Math.abs(d) <= st ? s.faceT : s.fx + Math.sign(d) * st; return s.fx;
  }
  function seqOf(t, state) {
    const key = t + '|' + state; if (key in seqCache) return seqCache[key];
    let out = null;
    const base0 = String(t).replace(/_\d$/, '');
    if (typeof Assets !== 'undefined') for (const id of [String(t), base0, ANIM_ALIAS[base0]]) for (const nm of (state === 'defend' ? ['defend', 'hurt'] : state === 'walk' ? ['walk', 'fly'] : [state])) {
      if (!id) continue;
      if (out) break;
      const list = []; for (let n = 1; n <= 24 && Assets.has('anim/' + id + '/' + nm + '_' + n); n++) list.push('anim/' + id + '/' + nm + '_' + n);
      if (list.length) out = list;
    }
    return (seqCache[key] = out);
  }
  // the frame to show now, or null when this creature has no frames for the state (or they have not loaded)
  function frameOf(s, state, now, t0, dur) {
    const seq = state === 'attack' ? atkFrames(s.t) : state === 'walk' ? (seqOf(s.t, 'walk') || seqOf(s.t, 'idle')) : seqOf(s.t, state); if (!seq || !seq.length) return null;
    const n = seq.length, i = state === 'walk' ? Math.floor((now - (s.walkT0 || 0)) / (s.walkMs || ANIM_MS.walk)) % n : state === 'idle' ? Math.floor((now - (s.idleT0 || 0)) / idleMs(s.t) + (s.idleT0 ? 0 : s.c * 3 + s.r * 5)) % n : Math.min(n - 1, Math.max(0, Math.floor((now - t0) / dur * n)));
    return Assets.get(seq[i]) || null;
  }
  // idle and walk frames are cross-faded: the next picture fades in over the whole length of the current one, so the creature flows from pose to pose instead of flipping between a few photos
  function frameBlend(s, state, now) {
    const seq = state === 'walk' ? (seqOf(s.t, 'walk') || seqOf(s.t, 'idle')) : seqOf(s.t, 'idle'); if (!seq || seq.length < 2) return null;
    const n = seq.length, raw = state === 'walk' ? (now - (s.walkT0 || 0)) / (s.walkMs || ANIM_MS.walk) : (now - (s.idleT0 || 0)) / idleMs(s.t) + (s.idleT0 ? 0 : s.c * 3 + s.r * 5);
    const i = Math.floor(raw), f = raw - i, nx = Assets.get(seq[(i + 1) % n]); if (!nx) return null;
    return { next: nx, k: f * f * (3 - 2 * f) };
  }
  // Animation frames of one creature may have any canvas size as long as they are all the same: the figure's feet (bottom centre of the
  // first idle frame's visible pixels) are the anchor and one scale fits the creature to the field, so nothing jumps between frames.
  const fitCache = {};
  function animFit(t) {
    const key = String(t); if (key in fitCache) return fitCache[key];
    const seq = seqOf(t, 'idle'), im = seq && Assets.get(seq[0]); if (!im) return null;       // not cached while the frames are still loading
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data; let x0 = c.width, x1 = -1, y0 = c.height, y1 = -1;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return (fitCache[key] = null);
    return (fitCache[key] = { k: Math.min(66 / (y1 - y0 + 1), 72 / (x1 - x0 + 1)), cx: (x0 + x1) / 2, by: y1 + 1, ty: y0, bw: x1 - x0 + 1, bh: y1 - y0 + 1 });
  }
  const PROF = {};

  // ---------- how each creature moves and fights ----------
  // atk = length of an attack in ms, wu = wind-up depth (how far it draws back first), lm = lunge length, kn = how far a blow pushes it,
  // walk = the way it travels, die = how it goes down, slam = heavy blows kick up a dust ring, dc = colours of its death sparkles
  const ARCH = {
    imp:      { style: 'lunge', atk: 300, wu: 0.42, lm: 1.25, kn: 1.8, walk: 'hop', die: 'fall' },
    foot:     { style: 'lunge', atk: 380, wu: 0.30, lm: 1.0, kn: 1.0, walk: 'march', die: 'fall' },
    knight:   { style: 'lunge', atk: 410, wu: 0.36, lm: 1.1, kn: 0.8, walk: 'march', die: 'fall' },
    rider:    { style: 'lunge', atk: 360, wu: 0.40, lm: 1.5, kn: 0.8, walk: 'bound', die: 'fall' },
    beast:    { style: 'lunge', atk: 330, wu: 0.45, lm: 1.5, kn: 1.1, walk: 'bound', die: 'fall' },
    brute:    { style: 'rear', atk: 480, wu: 0.55, lm: 0.9, kn: 0.5, walk: 'stomp', die: 'fall', slam: 1 },
    colossus: { style: 'stomp', atk: 540, wu: 0.45, lm: 0.8, kn: 0.25, walk: 'stomp', die: 'shatter', slam: 1 },
    giant:    { style: 'stomp', atk: 520, wu: 0.5, lm: 0.85, kn: 0.3, walk: 'stomp', die: 'fall', slam: 1 },
    raptor:   { style: 'swoop', atk: 380, wu: 0.3, lm: 1.2, kn: 1.0, walk: 'glide', die: 'plunge' },
    dragon:   { style: 'rear', atk: 520, wu: 0.5, lm: 1.0, kn: 0.3, walk: 'glide', die: 'plunge', slam: 1 },
    serpent:  { style: 'lunge', atk: 380, wu: 0.5, lm: 1.3, kn: 0.7, walk: 'slither', die: 'flop' },
    caster:   { style: 'lunge', atk: 400, wu: 0.25, lm: 0.9, kn: 1.0, walk: 'march', die: 'fall' },
    undead:   { style: 'lunge', atk: 400, wu: 0.3, lm: 1.0, kn: 1.2, walk: 'sway', die: 'collapse', dc: ['#e8e0c8', '#c8c0a0'] },
    ghost:    { style: 'swoop', atk: 380, wu: 0.3, lm: 1.0, kn: 1.4, walk: 'glide', die: 'dissolve', dc: ['#ffffff', '#cfe6ff'] },
    fiend:    { style: 'rear', atk: 430, wu: 0.45, lm: 1.0, kn: 0.7, walk: 'march', die: 'burn' },
    flame:    { style: 'swoop', atk: 380, wu: 0.3, lm: 1.1, kn: 1.0, walk: 'glide', die: 'burn' },
    plant:    { style: 'stomp', atk: 520, wu: 0.5, lm: 0.8, kn: 0.4, walk: 'stomp', die: 'collapse', dc: ['#8ad05a', '#5aa83a', '#b8e07a'] },
    angel:    { style: 'swoop', atk: 400, wu: 0.3, lm: 1.1, kn: 0.7, walk: 'glide', die: 'dissolve', dc: ['#ffffff', '#fff1a8', '#ffd24a'] },
  };
  const ARCH_OF = {
    goblin: 'imp', wolf: 'rider', orc: 'foot', ogre: 'brute', troll: 'brute', golem: 'colossus', naga: 'serpent', dragon: 'dragon', shark: 'serpent', kraken: ['serpent', { atk: 520, kn: 0.3 }],
    castle1: 'foot', castle2: 'caster', castle3: 'raptor', castle4: 'knight', castle5: 'caster', castle6: 'rider', castle7: 'angel',
    rampart1: 'rider', rampart2: ['foot', { kn: 0.6 }], rampart3: 'caster', rampart4: 'raptor', rampart5: 'plant', rampart6: 'beast', rampart7: 'dragon',
    tower1: 'imp', tower2: ['raptor', { die: 'shatter', dc: ['#a49a88', '#7a7262'] }], tower3: 'colossus', tower4: 'caster', tower5: ['ghost', { dc: ['#ffe9a0', '#9fe6ff'] }], tower6: 'serpent', tower7: 'giant',
    inferno1: ['imp', { die: 'burn' }], inferno2: ['caster', { die: 'burn' }], inferno3: ['beast', { die: 'burn' }], inferno4: 'fiend', inferno5: 'fiend', inferno6: 'flame', inferno7: ['fiend', { style: 'swoop', walk: 'glide' }],
    necropolis1: 'undead', necropolis2: ['undead', { atk: 450, kn: 0.8 }], necropolis3: ['ghost', { dc: ['#bfffd0', '#7ad88a'] }], necropolis4: ['raptor', { die: 'dissolve', dc: ['#ff8a9a', '#c0304a'] }], necropolis5: ['caster', { die: 'collapse', dc: ['#e8e0c8', '#c8c0a0'] }], necropolis6: ['knight', { die: 'collapse', dc: ['#9a8ab8', '#6a5a88'] }], necropolis7: ['dragon', { die: 'collapse', dc: ['#e8e0c8', '#c8c0a0'] }],
    dungeon1: 'imp', dungeon2: 'raptor', dungeon3: ['caster', { walk: 'glide', die: 'dissolve', dc: ['#ffb0e8', '#ffffff'] }], dungeon4: ['serpent', { atk: 400 }], dungeon5: 'brute', dungeon6: ['dragon', { atk: 440, lm: 1.2 }], dungeon7: 'dragon',
    stronghold1: 'imp', stronghold2: 'rider', stronghold3: 'foot', stronghold4: 'brute', stronghold5: ['raptor', { atk: 450, kn: 0.5 }], stronghold6: 'brute', stronghold7: 'giant',
    fortress1: 'foot', fortress2: ['foot', { lm: 1.2 }], fortress3: 'raptor', fortress4: 'serpent', fortress5: 'brute', fortress6: ['raptor', { style: 'rear', atk: 440 }], fortress7: ['serpent', { atk: 520, kn: 0.3 }],
    conflux1: ['ghost', { atk: 300, dc: ['#ffffff', '#ffb8f0', '#c8ffb8'] }], conflux2: 'ghost', conflux3: ['ghost', { walk: 'slither', dc: ['#bfefff', '#7fd4ff'] }], conflux4: 'flame', conflux5: 'colossus', conflux6: ['ghost', { dc: ['#ff9ae8', '#ffffff'] }], conflux7: ['flame', { atk: 440 }],
    faerie: ['ghost', { atk: 320, dc: ['#ffffff', '#ffb8f0', '#c8ffb8'] }], rustd: 'dragon', crystald: ['dragon', { die: 'shatter', dc: ['#c8f0ff', '#ffffff'] }], azured: ['dragon', { die: 'dissolve', dc: ['#9fd0ff', '#ffffff'] }],
  };
  // how each way of going down looks: offsets, spin, squash and fade over its fall (e = eased 0..1, k = raw 0..1, dir = which way it topples)
  const DEATH = {
    fall:     (e, k, dir) => ({ dy: e * 6, rot: dir * e * 0.85, sx: 1 + e * 0.1, sy: 1 - e * 0.5, a: Math.max(0, 1 - Math.pow(k, 1.5)) }),
    collapse: (e, k, dir) => ({ dy: e * 10, rot: dir * e * 0.12, sx: 1 + e * 0.25, sy: 1 - e * 0.82, a: Math.max(0, 1 - k * k) }),
    dissolve: (e, k) => ({ dy: -e * 16, rot: 0, sx: 1 + e * 0.12, sy: 1 + e * 0.1, a: Math.pow(Math.max(0, 1 - k), 1.4) }),
    burn:     (e, k, dir) => ({ dy: e * 4, rot: dir * e * 0.3, sx: 1 - e * 0.2, sy: 1 - e * 0.6, a: Math.max(0, 1 - Math.pow(k, 0.8)) }),
    shatter:  (e, k, dir) => ({ dy: e * 2, rot: dir * e * 0.05, sx: 1 + e * 0.15, sy: 1 - e * 0.3, a: Math.max(0, 1 - k * 2.2) }),
    plunge:   (e, k, dir) => ({ dy: 34 * k * k, rot: dir * e * 1.6, sx: 1, sy: 1 - e * 0.2, a: Math.max(0, 1 - k * k) }),
    flop:     (e, k, dir) => ({ dy: e * 8, rot: dir * e * 1.4, sx: 1 + e * 0.1, sy: 1 - e * 0.5, a: Math.max(0, 1 - Math.pow(k, 1.5)) }),
  };
  // what flies off a creature as it dies
  function deathFx(t, p) {
    const pf = profOf(t.t), x = p.x, y = p.y + 16;
    switch (pf.die) {
      case 'collapse': burst(x, y - 6, 12, { kind: 'shard', col: pf.dc, v0: 30, v1: 120, up: 70, g: 520, drag: 1.2, l0: 420, l1: 800, s0: 1.4, s1: 2.8, add: false }); burst(x, y, 5, { kind: 'smoke', col: PAL.dust, v0: 10, v1: 50, l0: 300, l1: 600, s0: 3, s1: 5, drag: 2.4, grow: 1.2 }); break;
      case 'dissolve': burst(x, y - 14, 16, { kind: 'sparkle', col: pf.dc || PAL.gold, v0: 8, v1: 50, up: 50, g: -70, drag: 1.6, l0: 600, l1: 1100, s0: 2, s1: 3.4 }); break;
      case 'burn': burst(x, y - 8, 14, { kind: 'ember', col: PAL.fire, v0: 20, v1: 90, up: 60, g: -50, drag: 1.4, l0: 500, l1: 1000, s0: 2, s1: 4 }); burst(x, y - 4, 6, { kind: 'smoke', col: ['#3a3430'], v0: 8, v1: 40, up: 20, g: -30, l0: 500, l1: 900, s0: 3, s1: 6, drag: 2, grow: 1.6, add: false }); break;
      case 'shatter': burst(x, y - 8, 16, { kind: 'shard', col: pf.dc || PAL.rock, v0: 60, v1: 200, up: 90, g: 560, drag: 1.1, l0: 420, l1: 820, s0: 1.8, s1: 3.2, add: false }); burst(x, y, 8, { kind: 'smoke', col: PAL.dust, v0: 14, v1: 70, l0: 380, l1: 760, s0: 3, s1: 6, drag: 2.4, grow: 1.4 }); break;
      case 'plunge': burst(x, y + 6, 9, { kind: 'smoke', col: PAL.dust, v0: 14, v1: 80, l0: 380, l1: 720, s0: 3, s1: 5.5, drag: 2.4, grow: 1.3 }); burst(x, y - 20, 6, { kind: 'shard', col: ['#f4efe4', '#d8d0c0'], v0: 20, v1: 70, up: 20, g: 90, drag: 1.4, l0: 500, l1: 900, s0: 1.2, s1: 2, add: false }); break;
      default: burst(x, y, 9, { kind: 'smoke', col: PAL.dust, v0: 14, v1: 70, l0: 380, l1: 760, s0: 3, s1: 6, drag: 2.4, grow: 1.4 });
    }
  }
  function profOf(t) {
    const id = String(t).replace(/_\d$/, ''); if (PROF[id]) return PROF[id];
    let h = 2166136261; for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
    const r = (n) => ((h >>> (n * 5)) & 31) / 31, c = C[t] || {};
    const base = { fly: !!c.fly, shoot: !!c.shoot, spd: 480 + r(1) * 220, amp: 0.014 + r(2) * 0.014, lunge: 20 + r(3) * 10, ph: r(4) * 6.28, style: c.fly ? 'swoop' : c.shoot ? 'recoil' : r(0) > 0.62 ? 'rear' : r(0) > 0.3 ? 'lunge' : 'stomp' };
    const ao = ARCH_OF[id], an = Array.isArray(ao) ? ao[0] : ao, ar = Object.assign({}, ARCH[an || 'foot'], Array.isArray(ao) ? ao[1] : null);
    return (PROF[id] = Object.assign(base, ar, { lunge: base.lunge * ar.lm, arch: an || 'foot' }));
  }
  // ---- painted battle art (art/battle/obs, mach, siege): trimmed to its visible box so every picture sits on the ground the same way ----
  const _trim = new WeakMap();
  function trimOf(img) {
    let t = _trim.get(img); if (t) return t;
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) if (d[(y * c.width + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    t = x1 < 0 ? { x: 0, y: 0, w: img.width, h: img.height } : { x: x0, y: y0, w: x1 - x0 + 2, h: y1 - y0 + 2 }; _trim.set(img, t); return t;
  }
  const biome = () => { const n = bgName(); return n === 'ship' || n === 'grass' ? '' : n; };
  function obsArt(oe, c, r) {
    if (typeof Assets === 'undefined') return null;
    const seed = c * 17 + r * 31 + 3, n = 1 + seed % 3, b = biome(), sx = b ? '_' + b : '';
    const nm = { '🪨': 'boulders' + sx + '_' + n, '⛰️': 'outcrop' + sx + '_' + n, '🌲': 'pine' + sx + '_' + n, '🌳': b ? 'tree_' + b + '_' + n : 'oak_' + n,
      '🌿': b ? 'bush_' + b + '_' + n : ['bush_berries_1', 'bush_flowers_1', 'bush_yellow_1'][seed % 3], '🪵': 'log_' + n, '🌾': 'haystack_' + n, '🏚️': 'ruinwall_' + n, '🍄': 'stump_' + n,
      '🪦': 'graves_' + n, '🚧': 'fence_' + n, '💧': 'pond_' + n }[oe];
    return nm ? Assets.get('battle/obs/obstacle_' + nm) : null;
  }
  function drawObsArt(im, oe, p, c, r) {
    const t = trimOf(im), k = Math.min(HW * 1.1 / t.w, 84 / t.h), w = t.w * k, h = t.h * k, plant = oe === '🌲' || oe === '🌳' || oe === '🌿' || oe === '🌾';
    const sw = plant && !reduced() ? Math.sin(performance.now() / (oe === '🌿' ? 700 : 1100) + c * 1.7 + r * 0.9) * (oe === '🌿' ? 0.03 : 0.018) : 0;
    ctx.save(); ctx.translate(p.x, p.y + 19); if (sw) ctx.transform(1, 0, sw, 1, 0, 0); ctx.drawImage(im, t.x, t.y, t.w, t.h, -w / 2, -h, w, h); ctx.restore();
  }
  const FORT_NAME = ['palisade', 'citadel', 'castle', 'fortress'];
  // castle and fortress walls are painted per faction; palisade and citadel are generic. Pictures face a castle on the right; a castle on the left is the same picture flipped.
  const FAC_ART = { castle: 'kingdom', rampart: 'forest', tower: 'wizards', inferno: 'hell', necropolis: 'undead', dungeon: 'caves', stronghold: 'wild_clans', fortress: 'swamp', conflux: 'spirits' };
  const siegeKey = (part, state, lvlOpt) => { const lv = Math.max(0, Math.min(3, lvlOpt === undefined ? (B.siege.fort || 0) : lvlOpt)); return 'battle/siege/siege_' + part + (state ? '_' + state : '') + '_' + FORT_NAME[lv] + (lv >= 2 ? '_' + (FAC_ART[B.siege.fac] || 'kingdom') : ''); };
  const siegeImg = (part, state, lvlOpt) => typeof Assets === 'undefined' || !B.siege ? null : Assets.get(siegeKey(part, state, lvlOpt));
  function siegeTile(img, p, w, h) { w = w || 80; h = h || 120; if (B.siege && B.siege.dside === 0) { ctx.save(); ctx.translate(p.x, p.y - 80.7); ctx.scale(-1, 1); ctx.drawImage(img, -w / 2, 0, w, h); ctx.restore(); } else ctx.drawImage(img, p.x - w / 2, p.y - 80.7, w, h); }
  // tiles are 240x360 with the hex centred at (120,242) and a hex radius of 90 (our 30 is a third)
  const machImg = (n) => typeof Assets === 'undefined' ? null : Assets.get('battle/mach/machine_' + n);
  // draws a machine picture at a fixed scale taken from its resting picture, so animation frames never jump
  function machDraw(img, ref, x, y, maxW, flip) {
    if (!img || !ref) return false; const t = trimOf(ref), k = Math.min(maxW / t.w, 96 / t.h), cx = t.x + t.w / 2, by = t.y + t.h;
    ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1); ctx.drawImage(img, -cx * k, -by * k, img.width * k, img.height * k); ctx.restore(); return true;
  }
  const MACH_POS = { ballista: { x: 40, y: 176, w: 68 }, tent: { x: 40, y: 256, w: 64 }, cart: { x: 40, y: 470, w: 64 } };
  function drawMachines(now) {
    const mc = (B.hero && B.hero.mach) || {}; if (!mc.ballista && !mc.tent && !mc.cart) return;
    const seq = (t0, fr, ms) => { if (!t0) return null; const e = (now - t0) * spd() / ms, i = Math.floor(e); return i >= 0 && i < fr.length ? fr[i] : null; };
    if (mc.ballista) {
      const P = MACH_POS.ballista; let f = 'idle';
      if (B.spell === '__ballista' && B.hover) f = B.hover.r < 4 ? 'aim1' : B.hover.r > 6 ? 'aim3' : 'aim2'; else if (B.spell === '__ballista') f = 'aim2';
      const s = seq(B.balT0, ['fire1', 'fire2', 'fire2', 'reload1', 'reload2', 'reload3'], 150); if (s) f = s;
      machDraw(machImg('ballista_' + f + '_basic') || machImg('ballista_idle_basic'), machImg('ballista_idle_basic'), P.x, P.y, P.w);
    }
    if (mc.tent) {
      const P = MACH_POS.tent, s = seq(B.tentT0, ['heal1', 'heal2', 'heal3', 'heal1', 'heal2', 'heal3', 'heal1', 'heal2', 'heal3'], 170);
      machDraw(machImg('tent_' + (s || 'idle') + '_basic') || machImg('tent_idle_basic'), machImg('tent_idle_basic'), P.x, P.y, P.w);
    }
    if (mc.cart) {
      const P = MACH_POS.cart, s = seq(B.cartT0, ['resupply1', 'resupply2', 'resupply1', 'resupply2'], 200);
      machDraw(machImg('cart_' + (s || 'idle') + '_basic') || machImg('cart_idle_basic'), machImg('cart_idle_basic'), P.x, P.y, P.w);
    }
  }
  function drawMineBlasts(now) {
    B.mineFx = (B.mineFx || []).filter(m => {
      const i = Math.floor((now - m.t0) * spd() / 85); if (i < 0) return true; if (i > 5) return false;
      const im = machImg('mine_detonate' + (i + 1) + '_all'); if (!im) return false; const k = 0.5; ctx.drawImage(im, m.x - 128 * k, m.y + 8 - 150 * k, 256 * k, 256 * k); return true;
    });
  }
  function structSprite(st, p) {
    if (typeof Assets === 'undefined') return false;
    { const fr = st.hp / st.max, im = st.k === 'tower' ? siegeImg('tower_round', fr > 0.5 ? 'intact' : 'damaged') : st.k === 'gate' ? siegeImg('gate_closed', fr > 0.5 ? 'intact' : 'damaged')
        : siegeImg(st.r === 0 ? 'wall_corner_top' : st.r === 10 ? 'wall_corner_bottom' : 'wall_straight', fr > 0.6 ? 'intact' : 'damaged');
      if (im) { siegeTile(im, p); return true; } }
    const frac = st.hp / st.max;
    const img = st.k === 'wall' ? Assets.get(frac > 0.6 ? 'battle/wall_intact' : 'battle/wall_damaged') : st.k === 'gate' ? Assets.get('battle/gate_closed') : Assets.get(frac > 0.5 ? 'battle/tower' : 'battle/tower_damaged');
    if (!img) return false;
    sprite(img, p.x, p.y, st.k === 'tower' ? 52 : 70); return true;
  }
  function draw() {
    if (!B) return;
    const now = performance.now();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    if (B._board === undefined && typeof Assets !== 'undefined') B._board = buildBoard();
    const drawGround = () => {
      if (B._board) ctx.drawImage(B._board, 0, 0, 960, 640);
      else { const g = ctx.createLinearGradient(0, 0, 0, 640); g.addColorStop(0, '#2f4a2a'); g.addColorStop(1, '#46663a'); ctx.fillStyle = g; ctx.fillRect(0, 0, 960, 640); }
    };
    // the whole field can shake (big hits) or push in slightly toward the action; the ground is drawn once unmoved underneath so no edge ever shows
    const shk = shakeOff(now), cam = camNow(now);
    if (shk || cam) drawGround();
    ctx.save();
    if (shk) ctx.translate(shk.x, shk.y);
    if (cam) { ctx.translate(cam.x, cam.y); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y); }
    drawGround();
    const hov = B.hover, input = B.input && B.cur && B.cur.side === 0 && !B.busy;
    for (let r = 0; r < BH; r++) for (let c = 0; c < BW; c++) {
      const p = hexPx(c, r), k = key(c, r);
      hexPath(p.x, p.y, HR - 1);
      ctx.fillStyle = (c + r) % 2 ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.05)'; ctx.fill();
      if (B.siege && (!B._board || B._bg)) {
        const inside = B.siege.dside === 1 ? c > B.cw : c < B.cw;
        if (inside) { ctx.fillStyle = 'rgba(170,130,80,.30)'; ctx.fill(); }
        if (B.moat.has(k) && !siegeImg('moat_water_frame1', '')) { ctx.fillStyle = 'rgba(40,120,200,.65)'; ctx.fill(); }
      }
      const walk = input && B.reach.has(k) && !B.spell && B.reach.get(k).d > 0;
      if (walk) { ctx.fillStyle = 'rgba(255, 236, 150, .30)'; ctx.fill(); }
      ctx.strokeStyle = walk ? 'rgba(255, 224, 110, .95)' : B._board ? 'rgba(0,0,0,.16)' : 'rgba(0,0,0,.26)'; ctx.lineWidth = walk ? 2 : 1; ctx.stroke();
      if (B.obs.has(k)) { const oe = B.obs.get(k), oa = obsArt(oe, c, r), ob = oa ? null : obstacleSprite(oe, c, r); if (oa) drawObsArt(oa, oe, p, c, r); else if (ob) { const plant = oe === '🌲' || oe === '🌳' || oe === '🌿' || oe === '🌾', sw = plant && !reduced() ? Math.sin(performance.now() / (oe === '🌿' ? 700 : 1100) + c * 1.7 + r * 0.9) * (oe === '🌿' ? 0.03 : 0.018) : 0; if (sw) { ctx.save(); ctx.translate(p.x, p.y + 15 * OBK); ctx.transform(1, 0, sw, 1, 0, 0); ctx.drawImage(ob.cv, -ob.ox * OBK, -ob.oy * OBK - 15 * OBK, ob.w * OBK, ob.h * OBK); ctx.restore(); } else ctx.drawImage(ob.cv, p.x - ob.ox * OBK, p.y - ob.oy * OBK, ob.w * OBK, ob.h * OBK); } else { const oi = typeof Assets !== 'undefined' ? Assets.get(oe === '🌲' ? 'terrain/forest_overlay' : (oe === '🪨' || oe === '⛰️') ? 'terrain/mountain_overlay' : '') : null; if (oi) sprite(oi, p.x, p.y, oe === '🌲' ? 44 : 40); else { ctx.fillStyle = '#fff'; emoji(oe, p.x, p.y, 30); } } }
      if (B.siege && B.moat.has(k)) { const mf = siegeImg('moat_water_frame' + (1 + Math.floor(now / 320 + r * 0.5 + c) % 4), ''); if (mf) { ctx.save(); hexPath(p.x, p.y, HR - 0.5); ctx.clip(); siegeTile(mf, p); ctx.restore(); } }
      if (B.siege && B.moat.has(k) && (!B._board || B._bg) && !siegeImg('moat_water_frame1', '')) {      // the moat: slow ripples and glints
        ctx.save(); hexPath(p.x, p.y, HR - 2); ctx.clip(); ctx.lineCap = 'round'; ctx.lineWidth = 1.4;
        for (let q = 0; q < 3; q++) { const ph = now / 1400 + q * 0.33 + (c * 0.37 + r * 0.21), f = ph - Math.floor(ph), yy = p.y - 16 + q * 14 + Math.sin(ph * 6) * 2; ctx.strokeStyle = 'rgba(210,240,255,' + (0.4 * Math.sin(f * Math.PI)).toFixed(2) + ')'; ctx.beginPath(); ctx.moveTo(p.x - 16 + f * 8, yy); ctx.quadraticCurveTo(p.x - 6 + f * 8, yy - 3, p.x + 4 + f * 8, yy); ctx.quadraticCurveTo(p.x + 10 + f * 8, yy + 2, p.x + 16, yy); ctx.stroke(); }
        ctx.restore();
      }
      if (B.siege && B.mines && B.mines.has(k) && B.siege.dside === 0) { const mn = machImg('mine_dormant_all'); if (mn) { const t = trimOf(mn), w = HW * 0.78, h = t.h * w / t.w; ctx.drawImage(mn, t.x, t.y, t.w, t.h, p.x - w / 2, p.y + 14 - h, w, h); } else { const mi = typeof Assets !== 'undefined' ? Assets.get('battle/mine_dormant') : null; if (mi) sprite(mi, p.x, p.y + 6, 34); else { ctx.fillStyle = '#fff'; emoji('💣', p.x, p.y + 2, 18); } } }
      if (B.siege && c === B.cw && !structAt(c, r) && typeof Assets !== 'undefined') { const kk = SIEGE_LAYOUT[r], ni = siegeImg(kk === 'tower' ? 'tower_round' : kk === 'gate' ? 'gate_closed' : r === 0 ? 'wall_corner_top' : r === 10 ? 'wall_corner_bottom' : 'wall_straight', 'destroyed'); if (ni) siegeTile(ni, p); else { const di = Assets.get(kk === 'gate' ? 'battle/gate_open' : kk === 'tower' ? 'battle/tower_damaged' : 'battle/wall_breached'); if (di) sprite(di, p.x, p.y, kk === 'tower' ? 52 : 70); } }
      if (B.spell === '__mine' && freeMineHex(c, r)) { hexPath(p.x, p.y, HR - 4); ctx.strokeStyle = 'rgba(255,200,80,.8)'; ctx.lineWidth = 2; ctx.stroke(); }
      const st = structAt(c, r);
      if (st) {
        if (!structSprite(st, p)) {
        hexPath(p.x, p.y, HR - 1);
        ctx.fillStyle = now - (st.flash || 0) < 220 ? '#ffcf7a' : '#8b8478'; ctx.fill();
        ctx.strokeStyle = '#2a2520'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#fff'; emoji(STRUCT[st.k].i, p.x, p.y - 2, st.k === 'wall' ? 24 : 28);
        } else { if (now - (st.flash || 0) < 220) { hexPath(p.x, p.y, HR - 1); ctx.fillStyle = 'rgba(255,210,120,.45)'; ctx.fill(); } siegeDeco(st, p, now); }
        ctx.fillStyle = '#300'; ctx.fillRect(p.x - 16, p.y + 15, 32, 5);
        ctx.fillStyle = st.hp / st.max > 0.5 ? '#5c5' : st.hp / st.max > 0.25 ? '#ec4' : '#e55'; ctx.fillRect(p.x - 16, p.y + 15, 32 * Math.max(0, st.hp) / st.max, 5);
      }
    }
    if (B.siege) drawCatapult(now);
    drawMachines(now); drawMineBlasts(now);
    if (B.cur && !B.cur.dead) { const p = hexPx(B.cur.c, B.cur.r); hexGlow(p.x, p.y, '255,206,80', 0.2 + 0.07 * Math.sin(now / 300)); }
    if (hov) {
      const p = hexPx(hov.c, hov.r), t = stackAt(hov.c, hov.r);
      if (t && t.side === 1) { const wt = isWide(t); hexGlow(p.x, p.y, '255,70,50', 0.26); reticle(p.x + (wt ? HW * 0.5 : 0), p.y + 22, wt ? 38 : 25, wt ? 10 : 9, now); }
      else hexGlow(p.x, p.y, '255,255,255', 0.14);
    }
    const heroes = [B.hero, B.eHero];
    heroes.forEach((hh, i) => {
      if (!hh || !hh.icon) return;
      const hp = HERO_POS[i], isPlayer = i === 0, flash = isPlayer && B.heroFlash && now - B.heroFlash[0] < 500;
      const him = typeof Assets !== 'undefined' && hh.pid ? Assets.get('mounted/' + hh.pid + '_' + (isPlayer ? 'east' : 'west')) : null;
      let plateY = hp.y + 31;
      if (him) {
        // the hero himself stands beside the field (taller than any creature): shadow, a slow breath, a surge of light when he casts or strikes
        const k = Math.min(90 / him.height, 98 / him.width), w = him.width * k, h = him.height * k, fy = hp.y + 40, cast = isPlayer && B.heroFlash && now - B.heroFlash[0] < 600 ? 1 - (now - B.heroFlash[0]) / 600 : 0, br = reduced() ? 0 : Math.sin(now / 520 + i * 2);
        ctx.beginPath(); ctx.ellipse(hp.x + 4, fy + 1, w * 0.4, 8, 0, 0, 7); ctx.fillStyle = 'rgba(0,0,0,.42)'; ctx.fill();
        if (cast > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(hp.x + 4, fy - h * 0.5, 54, '#9fd0ff', 0.6 * cast); ctx.restore(); }
        ctx.save(); ctx.translate(hp.x + 4 + (isPlayer ? 1 : -1) * cast * 6, fy); ctx.scale(1 - cast * 0.02, 1 + 0.012 * br + cast * 0.05);
        ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2; ctx.drawImage(him, -w / 2, -h, w, h); ctx.restore();
        plateY = fy + 5;
      } else {
        ctx.beginPath(); ctx.arc(hp.x, hp.y, 27, 0, 7);
        ctx.fillStyle = isPlayer ? '#2a4f8a' : '#8a2a2a'; ctx.fill();
        ctx.lineWidth = flash ? 5 : 3; ctx.strokeStyle = flash ? '#fff' : '#ffd24a'; ctx.stroke();
        ctx.drawImage(Art.heroCanvas(hh.icon, isPlayer ? '#3a8aff' : '#e04a3a', PS(), hh.pid), hp.x - 22, hp.y - 22, 44, 44);
      }
      const plH = isPlayer ? 41 : 28; ctx.fillStyle = 'rgba(12,7,3,.84)'; ctx.fillRect(hp.x - 36, plateY, 72, plH); ctx.strokeStyle = '#8a6a2a'; ctx.lineWidth = 1; ctx.strokeRect(hp.x - 35.5, plateY + 0.5, 71, plH - 1);
      ctx.fillStyle = '#f3e7bd'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(hh.name, hp.x, plateY + 9);
      if (isPlayer) {
        ctx.font = '10px sans-serif'; ctx.fillText(`⚔${hh.att} 🛡${hh.def} 🔷${hh.mana}`, hp.x, plateY + 22);
        ctx.fillStyle = hh.morale < 0 || hh.luck < 0 ? '#ffb3a8' : '#bfe3a8'; ctx.fillText(Moods.glyphs('morale', hh.morale) + ' ' + Moods.glyphs('luck', hh.luck), hp.x, plateY + 34);
      }
    });
    // a fallen stack slumps, shrinks and fades (a stack killed by a delayed spell stays whole until the effect lands)
    for (const s of B.stacks) if (s.dead && s.deadAt && now - s.deadAt < Math.max(700, animDur(s.t, 'death') + 40) && s.px !== undefined) {
      const k = Math.max(0, (now - s.deadAt) / 700), dfr = frameOf(s, 'death', now, s.deadAt, animDur(s.t, 'death') || 600), e = k * k * (3 - 2 * k), dir = s.side === 1 ? -1 : 1, pose = dfr || poseOf(s, 'defending');
      const dkp = (DEATH[profOf(s.t).die] || DEATH.fall)(e, k, dir);
      ctx.save(); ctx.globalAlpha = dfr ? Math.min(1, Math.max(0, (1 - k) * 4)) : dkp.a;
      if (dfr) {
        const wd = isWide(s), fit = animFit(s.t), kk = fit ? fit.k * (wd ? 1.25 : 1) : Math.min(66 / pose.height, 72 / pose.width) * (wd ? 1.25 : 1), pw = pose.width * kk, ph = pose.height * kk;
        ctx.translate(s.px + (wd ? (s.side === 0 ? -1 : 1) * HW * 0.5 : 0), s.py + 22); ctx.scale(s.fx !== undefined ? s.fx : defFace(s), 1); if (fit) ctx.drawImage(pose, -fit.cx * kk, -fit.by * kk, pw, ph); else ctx.drawImage(pose, -pw / 2, -ph, pw, ph);
      } else if (pose) {
        const wd = isWide(s), kk = Math.min(66 / pose.height, 72 / pose.width) * (wd ? 1.25 : 1), pw = pose.width * kk, ph = pose.height * kk;
        ctx.translate(s.px + (wd ? (s.side === 0 ? -1 : 1) * HW * 0.5 : 0), s.py + 22 + dkp.dy); ctx.rotate(dkp.rot); ctx.scale(dkp.sx, dkp.sy); if (s.fx !== undefined && s.fx !== defFace(s)) ctx.scale(-1, 1); ctx.drawImage(pose, -pw / 2, -ph, pw, ph);
      } else {
        const sz = HR * 1.28; ctx.translate(s.px, s.py + 3 + e * 14); ctx.rotate(dir * e * 0.85); ctx.scale(1 + e * 0.1, 1 - e * 0.45); ctx.drawImage(Art.portraitCanvas(s.t, PS()), -sz / 2, -sz / 2, sz, sz);
      }
      ctx.restore();
    }
    const stacks = alive().sort((a, b) => a.py - b.py);
    for (const s of stacks) {
      const hd = s.hurt ? now - s.hurt : -1, fa = now - (s.flash || 0);
      const fighting = !!(s.anim && now - s.anim.t0 < s.anim.dur), defending = hd >= 0 && hd < (animDur(s.t, 'defend') || 320);
      const off = animOff(s, now), p = { x: s.px + off.x, y: s.py + off.y }, flash = fa >= 0 && fa < 220;
      const walking = !fighting && !defending && s.walkUntil && now < s.walkUntil, pst = fighting ? 'fighting' : defending ? 'defending' : walking ? 'walking' : 'idle';
      // a change of state starts a short cross-fade from the last picture, and the idle cycle restarts at its first frame (it matches the rest pose)
      if (s._fst !== pst) { if (s._fimg) s._xf = { img: s._fimg, t0: now }; if (pst === 'idle') s.idleT0 = now; s._fst = pst; }
      const fxv = faceStep(s, now);
      // a winged creature stands on the ground and only moves when it is its turn or the pointer is over it
      const stillFly = pst === 'idle' && C[s.t].fly && !(s === B.cur && !B.over) && !(B.hover && stackAt(B.hover.c, B.hover.r) === s);
      const fr = fighting ? frameOf(s, 'attack', now, s.anim.t0, s.anim.dur) : defending ? frameOf(s, 'defend', now, s.hurt, animDur(s.t, 'defend') || 320) : walking ? frameOf(s, 'walk', now) : (stillFly ? (() => { const q = seqOf(s.t, 'idle'); return q ? Assets.get(q[0]) : null; })() : frameOf(s, 'idle', now)), fsx = fr ? fxv : fxv * (s.side === 0 ? 1 : -1);
      const pose = fr || poseOf(s, pst), pf = profOf(s.t); s._fimg = fr || null;
      let nxImg = null, nxK = 0; if (fr && !stillFly && (pst === 'idle' || pst === 'walking')) { const bl = frameBlend(s, pst === 'walking' ? 'walk' : 'idle', now); if (bl && bl.next.width === fr.width && bl.next.height === fr.height) { nxImg = bl.next; nxK = bl.k; } }
      // idle breathing: a tiny squash and stretch about the feet (own speed per creature, out of step between stacks); flyers also flap
      const bph = now / (pf.fly ? 900 : pf.spd) + pf.ph + s.c * 1.7 + s.r * 0.9, breathing = !fighting && !defending && !reduced() && !stillFly;
      const ba = pf.amp * (fr ? 0.6 : 1); let bry = breathing ? 1 + ba * Math.sin(bph) : 1, brx = breathing ? 1 - ba * 0.55 * Math.sin(bph) : 1;   // a creature with its own frames only gets a gentle extra breath
      if (breathing && pf.fly && !fr) { const fl = Math.sin(now / 110 + pf.ph); brx *= 1 + 0.045 * fl; bry *= 1 - 0.03 * fl; }
      brx *= off.sx; bry *= off.sy;
      if (s === B.cur && !B.over) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55 + 0.25 * Math.sin(now / 260); glow(p.x + (pose && isWide(s) ? (s.side === 0 ? -1 : 1) * HW * 0.5 : 0), p.y + 20, 34, '#ffd24a', 0.5); ctx.restore(); }
      if (pose) {
        const wd = isWide(s), fit = fr ? animFit(s.t) : null, kk = fit ? fit.k * (wd ? 1.25 : 1) : Math.min(66 / pose.height, 72 / pose.width) * (wd ? 1.25 : 1), pw = pose.width * kk, ph = pose.height * kk, fy = p.y + 22;
        if (wd) p.x += (s.side === 0 ? -1 : 1) * HW * 0.5;
        { const hov = fr && pf.fly ? Math.max(0, -off.y) : 0; unitBase(p.x, pf.fly && fr ? fy - off.y : fy, (wd ? 36 : 21) * (1 - Math.min(0.35, hov / 60)), (wd ? 9 : 7.5) * (1 - Math.min(0.35, hov / 60)), s.side, s === B.cur, flash, now); }
        ctx.save(); ctx.translate(p.x, fy); ctx.rotate(off.rot * 0.4); ctx.scale(brx, bry); if (fsx !== 1) ctx.scale(fsx, 1); if (flash) ctx.globalAlpha = 0.88;
        if (flash && fa < 170 && !reduced() && 'filter' in ctx) ctx.filter = 'brightness(' + (1 + 1.15 * (1 - fa / 170)).toFixed(2) + ')';      // a quick white-hot flash on impact
        if (s._xf && fit) { const xk = (now - s._xf.t0) / 90; if (xk < 1) { ctx.save(); ctx.globalAlpha *= 1 - xk; ctx.drawImage(s._xf.img, -fit.cx * kk, -fit.by * kk, s._xf.img.width * kk, s._xf.img.height * kk); ctx.restore(); } else s._xf = null; }
        if (s === B.cur && !B.over) { ctx.shadowColor = s.side === 0 ? 'rgba(255,214,90,.95)' : 'rgba(255,120,90,.95)'; ctx.shadowBlur = 16 + (reduced() ? 0 : 5 * Math.sin(now / 260)); }
        const a0 = ctx.globalAlpha, dis = nxImg && !reduced();      // the old picture stays solid for half the fade, then dissolves, so the last of it never lingers and snaps away
        if (dis) {      // the shadow / selection glow is cast once, from a copy drawn off-canvas, so it never fades or pulses while the pictures dissolve
          if (ctx.shadowBlur > 0) { const Tm = ctx.getTransform(), D = 4000, soy = ctx.shadowOffsetY; ctx.shadowOffsetX = -D * Tm.a; ctx.shadowOffsetY = soy - D * Tm.b; if (fit) ctx.drawImage(pose, -fit.cx * kk + D, -fit.by * kk, pw, ph); else ctx.drawImage(pose, -pw / 2 + D, -ph, pw, ph); ctx.shadowOffsetX = 0; ctx.shadowOffsetY = soy; }
          ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; ctx.globalAlpha = a0 * Math.min(1, 2 * (1 - nxK));
        }
        if (fit) ctx.drawImage(pose, -fit.cx * kk, -fit.by * kk, pw, ph); else ctx.drawImage(pose, -pw / 2, -ph, pw, ph);
        if (nxImg && !reduced()) { ctx.shadowBlur = 0; ctx.globalAlpha = a0 * nxK; if (fit) ctx.drawImage(nxImg, -fit.cx * kk, -fit.by * kk, pw, ph); else ctx.drawImage(nxImg, -pw / 2, -ph, pw, ph); }
        ctx.restore();
        if (s === B.cur && !B.over) turnMarker(p.x, fy - (fit ? (fit.by - fit.ty) * kk : ph) - 12, s.side === 0, now);
      } else {
      ctx.beginPath(); ctx.arc(p.x, p.y + 4, HR * 0.72, 0, 7);
      ctx.fillStyle = flash ? '#ff8a7a' : (s.side === 0 ? '#2a4f8a' : '#8a2a2a'); ctx.fill();
      ctx.lineWidth = s === B.cur ? 4 : 2; ctx.strokeStyle = s === B.cur ? '#ffd24a' : '#111'; ctx.stroke();
      { const sz = HR * 1.28; ctx.save(); ctx.translate(p.x, p.y + 3); ctx.rotate(off.rot); ctx.scale(brx, bry); ctx.scale(fxv, 1); ctx.drawImage(Art.portraitCanvas(s.t, PS()), -sz / 2, -sz / 2, sz, sz); ctx.restore(); }
      }
      { // stack-size plate: rounded, team-coloured, bold outlined numerals
        const n = s.n, lab = n >= 100000 ? Math.round(n / 1000) + 'k' : n >= 10000 ? (n / 1000).toFixed(1).replace(/.0$/, '') + 'k' : String(n);
        ctx.font = 'bold 15px Georgia, serif'; const w = Math.max(28, ctx.measureText(lab).width + 14), h = 20, bx = p.x + 2, by = p.y + 12;
        const g = ctx.createLinearGradient(0, by, 0, by + h); g.addColorStop(0, s.side === 0 ? '#3b6fc4' : '#c4473f'); g.addColorStop(1, s.side === 0 ? '#16305e' : '#5e1a16');
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx, by, w, h, 6) : ctx.rect(bx, by, w, h);
        ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#f3d27a'; ctx.stroke(); ctx.lineWidth = 1; ctx.strokeStyle = '#140a04'; ctx.stroke();
        if (C[s.t].shoot) { const lowA = s.ammo <= 3; ctx.font = 'bold 11px Cinzel, Georgia, serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; const at = '➶ ' + s.ammo; ctx.lineWidth = 3; ctx.strokeStyle = '#140a04'; ctx.strokeText(at, bx + 2, by + h + 8); ctx.fillStyle = s.ammo === 0 ? '#ff6a5a' : lowA ? '#ffd24a' : '#e8e0c0'; ctx.fillText(at, bx + 2, by + h + 8); ctx.font = 'bold 15px Georgia, serif'; }
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = '#140a04'; ctx.strokeText(lab, bx + w / 2, by + h / 2 + 1);
        ctx.fillStyle = '#fff'; ctx.fillText(lab, bx + w / 2, by + h / 2 + 1); ctx.textBaseline = 'alphabetic';
      }
      let tags = ''; if (s.weak > 0) tags += '🥀'; if (s.disr > 0) tags += '💥'; if (s.noshoot > 0) tags += '🌫️'; if (s.berserk > 0) tags += '😤'; if (s.hyp > 0) tags += '🌀'; if (s.haste) tags += '💨'; if (s.bless) tags += '✨'; if (s.stone) tags += '🪨'; if (s.defb) tags += '🛡'; if (s.slow) tags += '🐌'; if (s.curse) tags += '☠️'; if (s.bloodlust) tags += '😡'; if (s.shield) tags += '🌀'; if (s.stunned > 0) tags += '🙈';
      if (tags) { if (typeof GI !== 'undefined') GI.text(ctx, tags, p.x, p.y - HR * 0.78, 14, { fill: '#fff', font: '12px ' + FONT }); else { ctx.font = '12px ' + FONT; ctx.fillText(tags, p.x, p.y - HR * 0.78); } }
    }
    drawProjectiles(now);
    drawFx(now);
    if (B.shot && now - B.shot.t0 < 260) {
      const a = B.shot.ax !== undefined ? { x: B.shot.ax, y: B.shot.ay } : hexPx(B.shot.a.c, B.shot.a.r), b = hexPx(B.shot.b.c, B.shot.b.r), k = (now - B.shot.t0) / 260;
      ctx.globalAlpha = B.shot.quiet ? 0.22 : 1; ctx.strokeStyle = B.shot.col || '#ffe9a0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k); ctx.stroke(); ctx.globalAlpha = 1;
    }
    // floating numbers: each kind of hit has its own look (melee red, ranged amber, spell violet with a glow, heal green and slow)
    B.fx = B.fx.filter(f => now - f.t0 < 1000);
    for (const f of B.fx) {
      const age = now - f.t0; if (age < 0) continue;
      const k = age / 1000, kd = f.kind, magic = kd === 'spell' || kd === 'strike', pop = Math.max(0, 1 - age / 140), sc = (f.big ? 1.3 : 1) * (1 + 0.5 * pop * pop);
      const col = kd === 'melee' ? '#ff6a5a' : kd === 'ranged' ? '#ffb04a' : kd === 'breath' || kd === 'mine' ? '#ff8a3a' : magic ? '#d6a8ff' : kd === 'heal' ? '#7dff9a' : f.col;
      const rise = kd === 'heal' ? 44 : magic ? 36 : 30, size = Math.round((kd === 'ranged' ? 18 : 20) * sc), fy = f.y - (1 - Math.pow(1 - k, 2)) * rise;
      const fx0 = f.x + (f.big ? Math.sin(age / 38) * 2 * pop : 0);
      ctx.save(); ctx.globalAlpha = Math.min(1, (1 - k) * 1.7); ctx.fillStyle = col; ctx.font = 'bold ' + size + 'px sans-serif'; ctx.textAlign = 'center';
      if (magic || kd === 'heal') { ctx.shadowColor = col; ctx.shadowBlur = 9; }
      if (typeof GI !== 'undefined') GI.text(ctx, f.txt, fx0, fy, size, { fill: col, stroke: '#000' }); else { ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeText(f.txt, fx0, fy); ctx.fillText(f.txt, fx0, fy); }
      if (f.sub) { ctx.font = 'bold ' + Math.max(11, Math.round(size * 0.62)) + 'px sans-serif'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.fillStyle = '#ffe9c8'; ctx.strokeText(f.sub, fx0, fy + size * 0.85); ctx.fillText(f.sub, fx0, fy + size * 0.85); }
      ctx.restore();
    }
    // highlight enemies the active stack can reach / shoot
    if (input && B.cur && !B.spell) {
      for (const e of alive(1)) {
        if (!(canShoot(B.cur) || meleeSpot(B.cur, e, B.reach))) continue;
        const p = hexPx(e.c, e.r);
        ctx.setLineDash([5, 4]); hexPath(p.x, p.y, HR - 3); ctx.strokeStyle = 'rgba(255,110,90,.95)'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
      }
    }
    // spell / strike targeting hint
    if (B.spell && B.spell !== '__mine') {
      const ally = B.spell === '__tent' || (B.spell !== '__strike' && B.spell !== '__ballista' && SPELLS[B.spell].tgt === 'ally');
      for (const s of alive(ally ? 0 : 1)) { const p = hexPx(s.c, s.r); hexPath(p.x, p.y, HR - 3); ctx.strokeStyle = ally ? 'rgba(120,255,170,.95)' : 'rgba(255,200,80,.95)'; ctx.lineWidth = 3; ctx.stroke(); }
    }
    ctx.restore(); // end of the shaken field; the bars below stay still
    drawQueue();
    drawTurnPill(now);
    drawInfo(hov);
    requestAnimationFrame(draw);
  }
  function animOff(s, now) {
    const pf = profOf(s.t), fly = pf.fly, style = isWide(s) ? 'rear' : pf.style, hasFr = !!seqOf(s.t, 'idle');
    // a creature with its own frames animates itself, so the code motion stays small for it
    let x = 0, y = hasFr ? 0 : Math.sin(now / (fly ? 260 : pf.spd * 0.77) + s.c * 3 + s.r) * (fly ? 2.6 : 1.2) - (fly ? 4 : 0), rot = 0, sx = 1, sy = 1;
    if (false && fly && hasFr && !reduced()) {      // (flyers no longer hover off the ground) hovering: a slow rise and fall, a drifting side to side, a bank into the drift and an occasional strong beat
      const ph = pf.ph + s.c * 2.1 + s.r * 1.3, gust = Math.pow(Math.max(0, Math.sin(now / 2300 + ph * 1.7)), 6);
      y = -9 + Math.sin(now / (pf.spd * 1.8) + ph) * 3.4 - gust * 3.5; x = Math.sin(now / (pf.spd * 3.2) + ph * 0.6) * 2.4; rot = Math.cos(now / (pf.spd * 3.2) + ph * 0.6) * 0.05; sy *= 1 + gust * 0.02; }
    const a = s.anim, own = !!seqOf(s.t, 'attack');
    if (a) {
      const k = (now - a.t0) / a.dur;
      if (k >= 1) s.anim = null;
      else {
        const d = Math.hypot(a.dx, a.dy) || 1, ux = a.dx / d, uy = a.dy / d, sg = Math.sign(ux) || 1, f = own ? 0.4 : 1;
        if (a.kind === 'lunge') {
          const sm = (t) => t * t * (3 - 2 * t);
          // frames of their own keep the old, gentler curve; the code-made motion gets a real wind-up (draw back), a fast strike, a short hold on impact and a soft settle
          let e;
          if (own) { const pr = k < 0.4 ? k / 0.4 : 1 - (k - 0.4) / 0.6; e = sm(pr); }
          else if (k < 0.22) e = -(pf.wu || 0.3) * Math.sin(k / 0.22 * Math.PI / 2);
          else if (k < 0.4) { const t = (k - 0.22) / 0.18, w0 = pf.wu || 0.3; e = -w0 + (1 + w0) * t * t; }
          else if (k < 0.52) e = 1 + 0.04 * Math.sin((k - 0.4) / 0.12 * Math.PI);
          else { const t = (k - 0.52) / 0.48; e = 1 - sm(t) * 1.03 + 0.03 * Math.sin(t * Math.PI); }
          const m = Math.min(pf.lunge * (own ? 0.8 : 1.3), d * 0.6);
          x += ux * e * m * f; y += uy * e * m * f; rot = e * 0.28 * sg * f;
          if (!own) {
            if (style === 'swoop') { y -= Math.sin(k * Math.PI) * 16; rot = e * 0.4 * sg; }                                   // flyers dive in along an arc
            else if (style === 'rear') { const rr = k < 0.35 ? Math.sin(k / 0.35 * Math.PI / 2) : Math.max(0, 1 - (k - 0.35) / 0.65); sy = 1 + 0.12 * rr; sx = 1 - 0.05 * rr; y -= rr * 6; rot = e * 0.12 * sg; }   // big ones rear up and slam
            else if (style === 'stomp') { sx = 1 + 0.07 * e; sy = 1 - 0.07 * e; y += e * 2; rot = e * 0.1 * sg; }               // heavy ones squash into the blow
          }
        } else if (own) { const pr = k < 0.35 ? k / 0.35 : 1 - (k - 0.35) / 0.65; x -= ux * pr * 5 * f; y -= uy * pr * 5 * f; rot = -pr * 0.16 * sg * f; }
        else {      // draw back slowly, then release with a kick and settle
          const smx = (t) => t * t * (3 - 2 * t);
          let e; if (k < 0.45) e = -smx(k / 0.45); else if (k < 0.58) e = -1 + 1.55 * smx((k - 0.45) / 0.13); else e = 0.55 * (1 - smx((k - 0.58) / 0.42));
          x += ux * e * 6; y += uy * e * 6; rot = e * 0.2 * sg; sx = 1 - 0.035 * Math.max(0, -e) + 0.03 * Math.max(0, e); sy = 1 + 0.03 * Math.max(0, -e) - 0.02 * Math.max(0, e);
        }
      }
    }
    if (s.walkUntil && now < s.walkUntil && !a && !seqOf(s.t, 'walk')) {      // real walk frames carry their own motion; the stepping bob is only for the idle-frame stand-in
      const wk = pf.walk || 'march';
      if (wk === 'hop') { const st = Math.sin(now / 70); y -= Math.abs(st) * 6; rot += st * 0.05; }
      else if (wk === 'bound') { const st = Math.sin(now / 80); y -= Math.abs(st) * 4.5; rot += st * 0.025; sx *= 1 + 0.03 * Math.sin(now / 80 + 1); }
      else if (wk === 'stomp') { const st = Math.sin(now / 140); y -= Math.max(0, st) * 3; sy *= 1 - 0.045 * Math.max(0, -st); sx *= 1 + 0.03 * Math.max(0, -st); rot += st * 0.025; }
      else if (wk === 'slither') { x += Math.sin(now / 110) * 2.4; y -= Math.abs(Math.sin(now / 150)) * 0.8; rot += Math.sin(now / 110) * 0.05; }
      else if (wk === 'glide') { y += Math.sin(now / 200) * 1.8 - 2; rot += Math.sin(now / 260) * 0.03; }
      else if (wk === 'sway') { const st = Math.sin(now / 130); rot += st * 0.06; y -= Math.abs(st) * 1.4; }
      else { const st = Math.sin(now / 95); y -= Math.abs(st) * (fly ? 1.5 : 3); rot += st * 0.035; } }
    if (s.hurt) { const k = (now - s.hurt) / 320; if (k >= 0 && k < 1) {
      if (s.knock) { const kb = k < 0.22 ? Math.sin(k / 0.22 * Math.PI / 2) : 1 - (() => { const t = (k - 0.22) / 0.78; return t * t * (3 - 2 * t); })(); x += s.knock.ux * kb * s.knock.amp * (pf.kn || 1); y += s.knock.uy * kb * s.knock.amp * 0.6 * (pf.kn || 1); x += Math.sin(k * 34) * (1 - k) * 1.6; }
      else x += Math.sin(k * 40) * (1 - k) * 4; if (!seqOf(s.t, 'defend')) { sy *= 1 - 0.06 * Math.sin(k * Math.PI); sx *= 1 + 0.04 * Math.sin(k * Math.PI); } } }
    return { x, y, rot, sx, sy };
  }
  // landing sparks per shot style (colour lists for burst, r,g,b for the spark star)
  const IMP = { twin: ['#e8ffd0', '#7ddc5a'], glow: ['#e8ffd0', '#7ddc5a'], bolt: ['#fff6d0', '#ffb04a'], javelin: ['#fff6d0', '#d8c28a'], zap: ['#ffffff', '#8cc8ff'], holy: ['#ffffff', '#ffe27a'], death: ['#bfffd0', '#4aff9a'], venom: ['#d8ff90', '#6ad02a'] };
  const IMPC = { twin: '140,230,100', glow: '140,230,100', bolt: '255,176,74', javelin: '230,205,140', zap: '160,210,255', holy: '255,226,122', death: '90,255,160', venom: '120,220,50' };
  const rnd = (i, t) => { const v = Math.sin(i * 12.9898 + t * 78.233) * 43758.5453; return v - Math.floor(v); };
  function impactExtra(p, now) {
    const arc = { arrow: 26, twin: 26, glow: 26, javelin: 30, bolt: 14 }[p.style];
    if (arc !== undefined) (B.stuck = B.stuck || []).push({ x: p.bx, y: p.by + 4, ang: Math.atan2(p.by - p.ay + arc * Math.PI, p.bx - p.ax), t0: now, dur: 1100, style: p.style, col: p.col });
    const ringOf = { fire: ['#ff9a3a', 30, true], venom: ['#8fe04a', 22, true], holy: ['#ffe27a', 30, false], death: ['#4aff9a', 26, true], zap: ['#8cc8ff', 24, false], orb: ['#c070ff', 26, true], gaze: ['#ff5aa8', 26, true], twin: ['#8be05a', 18, false], glow: ['#8be05a', 18, false] }[p.style];
    if (ringOf) ring(p.bx, p.by + 8, ringOf[1], ringOf[0], { w: 3, dur: 420, fill: ringOf[2] });
    if (p.style === 'rock' || p.style === 'ball') {
      ring(p.bx, p.by + 10, 30, p.style === 'rock' ? '#a89878' : '#8a8a90', { w: 4, dur: 460, flat: 0.45 });
      burst(p.bx, p.by + 6, 7, { kind: 'shard', col: p.style === 'rock' ? PAL.rock : ['#6a6a72', '#4a4a52'], v0: 60, v1: 190, up: 80, g: 520, drag: 1.2, l0: 380, l1: 720, s0: 1.4, s1: 2.6, add: false });
    }
    if (p.style === 'fire') burst(p.bx, p.by, 10, { kind: 'ember', col: PAL.fire, v0: 30, v1: 120, up: 50, g: -40, l0: 400, l1: 800, s0: 2, s1: 4 });
  }
  function drawProjectiles(now) {
    B.stuck = (B.stuck || []).filter(st => {
      const k = (now - st.t0) / st.dur; if (k >= 1) return false; if (k < 0) return true;
      ctx.save(); ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3; ctx.translate(st.x, st.y); ctx.rotate(st.ang + Math.sin(k * 40) * (1 - k) * 0.12 * (k < 0.25 ? 1 : 0));
      ctx.strokeStyle = '#140a04'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-3, 0); ctx.stroke(); ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.fillStyle = st.col || '#e0443a'; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-18, -3); ctx.lineTo(-11, 0); ctx.lineTo(-18, 3); ctx.closePath(); ctx.fill(); ctx.restore(); return true;      // the shaft stays in the target for a moment
    });
    B.proj = (B.proj || []).filter(p => {
      const k = (now - p.t0) / p.dur;
      if (k < 0) return true;
      if (k >= 1) {
        (B.slashes = B.slashes || []).push({ x: p.bx, y: p.by + 6, t0: now, dur: 280, style: 'spark', col: p.col, shoot: p.style });
        burst(p.bx, p.by + 6, p.style === 'fire' ? 12 : 7, { kind: p.style === 'ball' || p.style === 'rock' ? 'smoke' : 'spark', col: IMP[p.style] || (p.style === 'fire' ? PAL.fire : p.style === 'orb' ? PAL.dark : p.style === 'ball' || p.style === 'rock' ? PAL.dust : ['#fff6d0', '#ffd98a']), v0: 40, v1: 170, l0: 200, l1: 420, s0: p.style === 'ball' || p.style === 'rock' ? 5 : 1.2, s1: p.style === 'ball' || p.style === 'rock' ? 8 : 2.2, drag: 3, grow: 1 });
        impactExtra(p, now);
        return false;
      }
      const arc = p.arc !== undefined ? p.arc : ({ arrow: 26, twin: 26, glow: 26, javelin: 30, bolt: 14, rock: 38, venom: 20, gaze: 0, zap: 0 }[p.style] ?? 12);
      const x = p.ax + (p.bx - p.ax) * k, y = p.ay + (p.by - p.ay) * k - arc * Math.sin(Math.PI * k), vx = p.bx - p.ax, vy = p.by - p.ay - arc * Math.PI * Math.cos(Math.PI * k), ang = Math.atan2(vy, vx);
      ctx.save();
      if (p.style === 'arrow') {
        // a faint streak behind the shaft (the arrow's own path a moment earlier)
        { const k0 = Math.max(0, k - 0.16), tx = p.ax + (p.bx - p.ax) * k0, ty = p.ay + (p.by - p.ay) * k0 - arc * Math.sin(Math.PI * k0); const tg = ctx.createLinearGradient(tx, ty, x, y); tg.addColorStop(0, 'rgba(255,245,210,0)'); tg.addColorStop(1, 'rgba(255,245,210,.55)'); ctx.strokeStyle = tg; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke(); }
        ctx.translate(x, y); ctx.rotate(ang); ctx.strokeStyle = '#140a04'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(9, 0); ctx.stroke();
        ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#d0d8e0'; ctx.beginPath(); ctx.moveTo(8, -3); ctx.lineTo(14, 0); ctx.lineTo(8, 3); ctx.closePath(); ctx.fill();
        ctx.fillStyle = p.col || '#e0443a'; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-14, -3); ctx.lineTo(-7, 0); ctx.lineTo(-14, 3); ctx.closePath(); ctx.fill();
      } else if (p.style === 'twin' || p.style === 'glow' || p.style === 'bolt' || p.style === 'javelin') {
        const col = p.col || '#e0443a', n = p.style === 'twin' ? 2 : 1, k0 = Math.max(0, k - 0.18), tx = p.ax + (p.bx - p.ax) * k0, ty = p.ay + (p.by - p.ay) * k0 - arc * Math.sin(Math.PI * k0);
        const tg = ctx.createLinearGradient(tx, ty, x, y); tg.addColorStop(0, 'rgba(255,255,255,0)'); tg.addColorStop(1, p.style === 'twin' || p.style === 'glow' ? 'rgba(160,255,120,.6)' : 'rgba(255,245,210,.5)'); ctx.strokeStyle = tg; ctx.lineWidth = p.style === 'bolt' ? 3.4 : 2.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
        ctx.translate(x, y); ctx.rotate(ang);
        for (let i = 0; i < n; i++) {
          ctx.save(); ctx.translate(n === 2 && i ? -5 : 0, n === 2 ? (i ? 5 : -5) : 0);
          if (p.style === 'bolt') {          // a short, heavy crossbow-style bolt
            ctx.strokeStyle = '#140a04'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 3.4; ctx.stroke();
            ctx.fillStyle = '#c8ccd2'; ctx.strokeStyle = '#140a04'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(6, -4.5); ctx.lineTo(13, 0); ctx.lineTo(6, 4.5); ctx.closePath(); ctx.fill(); ctx.stroke();
          } else if (p.style === 'javelin') { // a long spear that wobbles in flight
            ctx.rotate(Math.sin(k * 26) * 0.1); ctx.strokeStyle = '#140a04'; ctx.lineWidth = 4.4; ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(11, 0); ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.stroke();
            ctx.fillStyle = '#dfe6ea'; ctx.strokeStyle = '#140a04'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(15, -3.4); ctx.lineTo(21, 0); ctx.lineTo(15, 3.4); ctx.closePath(); ctx.fill(); ctx.stroke();
          } else {                           // wood-elf arrows: slim, glowing, in a pair
            ctx.shadowColor = col; ctx.shadowBlur = 9; ctx.strokeStyle = '#140a04'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(9, 0); ctx.stroke(); ctx.strokeStyle = '#eaffd8'; ctx.lineWidth = 1.6; ctx.stroke();
            ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(8, -3); ctx.lineTo(14, 0); ctx.lineTo(8, 3); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(-15, -3); ctx.lineTo(-8, 0); ctx.lineTo(-15, 3); ctx.closePath(); ctx.fill();
          }
          ctx.restore();
        }
      } else if (p.style === 'zap') {       // a jagged lightning bolt from the shooter to the head of the shot
        const sx = p.ax, sy = p.ay, tn = Math.floor(now / 45), segs = 8, dx = x - sx, dy = y - sy, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.shadowColor = '#8cc8ff'; ctx.shadowBlur = 12;
        for (const [w, c] of [[6, 'rgba(120,180,255,.35)'], [2.2, '#eaf6ff']]) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(sx, sy); for (let i = 1; i <= segs; i++) { const t = i / segs, j = i < segs ? (rnd(i, tn) - 0.5) * 16 : 0; ctx.lineTo(sx + dx * t + nx * j, sy + dy * t + ny * j); } ctx.stroke(); }
      } else if (p.style === 'holy') {      // a golden orb with a turning four-point flare
        for (let i = 3; i >= 1; i--) { const kk = Math.max(0, k - i * 0.05); ctx.globalAlpha = 0.35 - i * 0.08; ctx.fillStyle = '#ffe9a0'; ctx.beginPath(); ctx.arc(p.ax + (p.bx - p.ax) * kk, p.ay + (p.by - p.ay) * kk - arc * Math.sin(Math.PI * kk), 6 - i, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 1; const g = ctx.createRadialGradient(x, y, 1, x, y, 12); g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#ffe27a'); g.addColorStop(1, 'rgba(255,210,90,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.fill();
        ctx.translate(x, y); ctx.rotate(now / 160); ctx.strokeStyle = 'rgba(255,255,230,.9)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(11, 0); ctx.moveTo(0, -11); ctx.lineTo(0, 11); ctx.stroke();
      } else if (p.style === 'death') {     // a dark green orb with wisps circling it
        for (let i = 4; i >= 1; i--) { const kk = Math.max(0, k - i * 0.05); ctx.globalAlpha = 0.4 - i * 0.07; ctx.fillStyle = '#2a8a56'; ctx.beginPath(); ctx.arc(p.ax + (p.bx - p.ax) * kk, p.ay + (p.by - p.ay) * kk - arc * Math.sin(Math.PI * kk), 7 - i, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 1; const g = ctx.createRadialGradient(x, y, 1, x, y, 13); g.addColorStop(0, '#0a1a10'); g.addColorStop(0.55, 'rgba(60,200,120,.75)'); g.addColorStop(1, 'rgba(60,200,120,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 13, 0, 7); ctx.fill();
        ctx.fillStyle = '#9dffc4'; for (let i = 0; i < 3; i++) { const a2 = now / 120 + i * 2.1; ctx.beginPath(); ctx.arc(x + Math.cos(a2) * 9, y + Math.sin(a2) * 7, 1.8, 0, 7); ctx.fill(); }
      } else if (p.style === 'venom') {     // a glob of green venom shedding drops
        for (let i = 4; i >= 1; i--) { const kk = Math.max(0, k - i * 0.06); ctx.globalAlpha = 0.45 - i * 0.09; ctx.fillStyle = '#6ad02a'; ctx.beginPath(); ctx.arc(p.ax + (p.bx - p.ax) * kk, p.ay + (p.by - p.ay) * kk - arc * Math.sin(Math.PI * kk) + i * 1.2, 4.2 - i * 0.5, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 1; const g = ctx.createRadialGradient(x - 1, y - 1, 1, x, y, 7); g.addColorStop(0, '#e8ffb0'); g.addColorStop(0.5, '#8fe04a'); g.addColorStop(1, '#3a8a1a'); ctx.fillStyle = g; ctx.strokeStyle = '#1a3a0a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill(); ctx.stroke();
      } else if (p.style === 'orb' || p.style === 'fire') {
        const col = p.style === 'fire' ? '255,140,40' : (p.col || 'hsl(280,80%,65%)');
        for (let i = 4; i >= 0; i--) { const kk = Math.max(0, k - i * 0.04), tx = p.ax + (p.bx - p.ax) * kk, ty = p.ay + (p.by - p.ay) * kk - arc * Math.sin(Math.PI * kk); ctx.globalAlpha = 0.5 - i * 0.09; ctx.fillStyle = p.style === 'fire' ? '#ff8a2a' : col; ctx.beginPath(); ctx.arc(tx, ty, 7 - i, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 1; const g = ctx.createRadialGradient(x, y, 1, x, y, 10); g.addColorStop(0, '#fff'); g.addColorStop(0.4, p.style === 'fire' ? '#ffb040' : (p.col || '#c070ff')); g.addColorStop(1, 'rgba(255,120,40,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 10, 0, 7); ctx.fill();
      } else if (p.style === 'ball') {
        if (k < 0.06) burst(p.ax, p.ay, 2, { kind: 'smoke', col: ['#8a8680'], v0: 10, v1: 40, l0: 300, l1: 520, s0: 3, s1: 5, drag: 2.5, grow: 1.4, add: false });
        if (Math.random() < 0.7) emit({ x, y, vx: R(-12, 12), vy: R(-12, 6), life: R(250, 450) / spd(), size: R(2.5, 4), col: '#6a6560', kind: 'smoke', add: false, grow: 1.2, drag: 2 });
        ctx.fillStyle = '#2a2a30'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(x - 1.5, y - 1.5, 1.5, 0, 7); ctx.fill();
      } else if (p.style === 'rock') {
        { const gx = p.ax + (p.bx - p.ax) * k, gy = p.ay + (p.by - p.ay) * k + 14, h = Math.sin(Math.PI * k); ctx.save(); ctx.globalAlpha = 0.34 - 0.18 * h; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(gx, gy, 9 - 3 * h, 3.4 - 1.2 * h, 0, 0, 7); ctx.fill(); ctx.restore(); }
        if (Math.random() < 0.5) emit({ x, y, vx: R(-14, 14), vy: R(-6, 12), life: R(250, 450) / spd(), size: R(2, 3.5), col: '#a89878', kind: 'smoke', add: false, grow: 1, drag: 2 });
        ctx.translate(x, y); ctx.rotate(k * 9); ctx.fillStyle = '#8a8478'; ctx.strokeStyle = '#1c1710'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-7, -2); ctx.lineTo(-2, -8); ctx.lineTo(7, -4); ctx.lineTo(6, 6); ctx.lineTo(-4, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
      } else {
        const w = 2 + 3.5 * Math.sin(k * Math.PI), dxg = x - p.ax, dyg = y - p.ay, lg = Math.hypot(dxg, dyg) || 1, nxg = -dyg / lg, nyg = dxg / lg;
        ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        for (const [ph, col, wd] of [[0, 'rgba(255,70,150,.55)', w + 4], [2.1, 'rgba(255,170,230,.5)', w + 1], [4.2, 'rgba(255,240,250,.9)', Math.max(1, w - 1)]]) {
          ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.beginPath();
          for (let i = 0; i <= 14; i++) { const t = i / 14, wob = Math.sin(t * 9 - now / 70 + ph) * 5 * Math.sin(Math.PI * t); const px = p.ax + dxg * t + nxg * wob, py = p.ay + dyg * t + nyg * wob; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
          ctx.stroke();
        }
        glow(x, y, 16, '#ff5aa8', 0.8); if (Math.random() < 0.7) emit({ x, y, vx: R(-30, 30), vy: R(-30, 30), life: R(220, 400) / spd(), size: R(1.4, 2.6), col: '#ffc0e8', kind: 'sparkle', drag: 2 });
      }
      ctx.restore();
      return true;
    });
    B.slashes = (B.slashes || []).filter(sl => {
      const k = (now - sl.t0) / sl.dur;
      if (k < 0) return true;
      if (k >= 1) return false;
      const ux = Math.cos(sl.ang || 0), uy = Math.sin(sl.ang || 0), a = 1 - k, mc = sl.mc || '255,255,255';
      ctx.save(); ctx.lineCap = 'round';
      if (sl.style === 'slash') {
        const r = 22, a0 = (sl.ang || 0) - 1.25, a1 = a0 + 2.5 * Math.min(1, k * 1.6);
        ctx.shadowColor = 'rgb(' + mc + ')'; ctx.shadowBlur = 10; ctx.strokeStyle = 'rgba(' + mc + ',' + a + ')'; ctx.lineWidth = 2 + 6 * a; ctx.beginPath(); ctx.arc(sl.x - ux * 6, sl.y - uy * 6, r, a0, a1); ctx.stroke();
      } else if (sl.style === 'stab') {
        const len = 34 * Math.min(1, k * 2.2); ctx.shadowColor = 'rgb(' + mc + ')'; ctx.shadowBlur = 8; ctx.strokeStyle = 'rgba(' + mc + ',' + a + ')'; ctx.lineWidth = 2 + 4 * a; ctx.beginPath(); ctx.moveTo(sl.x - ux * 30, sl.y - uy * 30); ctx.lineTo(sl.x - ux * 30 + ux * len, sl.y - uy * 30 + uy * len); ctx.stroke();
        ctx.fillStyle = 'rgba(255,240,170,' + a + ')'; for (let i = 0; i < 5; i++) { const an = i * 1.26 + 0.3; ctx.beginPath(); ctx.arc(sl.x + Math.cos(an) * (6 + 16 * k), sl.y + Math.sin(an) * (6 + 16 * k), 2.2 * a, 0, 7); ctx.fill(); }
      } else if (sl.style === 'smash') {
        ctx.strokeStyle = 'rgba(' + (sl.mc || '255,200,90') + ',' + a + ')'; ctx.lineWidth = 2 + 5 * a; ctx.beginPath(); ctx.arc(sl.x, sl.y + 8, 6 + 28 * k, 0, 7); ctx.stroke();
        ctx.strokeStyle = 'rgba(140,110,70,' + a + ')'; ctx.lineWidth = 3; for (let i = 0; i < 8; i++) { const an = i * 0.785; ctx.beginPath(); ctx.moveTo(sl.x + Math.cos(an) * (10 + 10 * k), sl.y + 8 + Math.sin(an) * (10 + 10 * k)); ctx.lineTo(sl.x + Math.cos(an) * (16 + 16 * k), sl.y + 8 + Math.sin(an) * (16 + 16 * k)); ctx.stroke(); }
      } else if (sl.style === 'claw' || sl.style === 'gaze') {
        ctx.strokeStyle = sl.mc ? 'rgba(' + sl.mc + ',' + a + ')' : sl.style === 'gaze' ? 'rgba(255,80,160,' + a + ')' : 'rgba(255,70,60,' + a + ')'; ctx.lineWidth = 3.4 * a + 1; ctx.shadowColor = '#ff3a2a'; ctx.shadowBlur = 6;
        for (let i = 0; i < 3; i++) { const pr = Math.min(1, k * 2 - i * 0.12); if (pr <= 0) continue; const x0 = sl.x - 14 + i * 9, y0 = sl.y - 16; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + 18 * pr, y0 + 30 * pr); ctx.stroke(); }
      } else if (sl.style === 'bite') {       // jaws snap shut on the target
        const gap = 15 * (1 - Math.min(1, k * 2.6)) + 1.5; ctx.translate(sl.x, sl.y); ctx.rotate((sl.ang || 0) + Math.PI / 2); ctx.fillStyle = 'rgba(' + mc + ',' + a + ')'; ctx.strokeStyle = 'rgba(40,12,12,' + a + ')'; ctx.lineWidth = 1.1;
        for (const sg of [-1, 1]) for (let i = -2; i <= 2; i++) { const bx = i * 6, base = sg * (gap + 9), tip = sg * gap; ctx.beginPath(); ctx.moveTo(bx - 3.2, base); ctx.lineTo(bx, tip); ctx.lineTo(bx + 3.2, base); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      } else if (sl.style === 'fire') {        // a gout of flame
        ctx.globalCompositeOperation = 'lighter'; const r = 8 + 26 * k, g = ctx.createRadialGradient(sl.x, sl.y, 2, sl.x, sl.y, r); g.addColorStop(0, 'rgba(255,240,170,' + a + ')'); g.addColorStop(0.5, 'rgba(' + mc + ',' + (a * 0.8) + ')'); g.addColorStop(1, 'rgba(255,60,20,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sl.x, sl.y, r, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(255,170,60,' + a + ')'; ctx.lineWidth = 3; for (let i = 0; i < 6; i++) { const fx = sl.x + (i - 2.5) * 6, h = (10 + 12 * rnd(i, 3)) * (0.4 + k); ctx.beginPath(); ctx.moveTo(fx, sl.y + 8); ctx.quadraticCurveTo(fx + (rnd(i, 7) - 0.5) * 8, sl.y - h * 0.5, fx + (rnd(i, 9) - 0.5) * 6, sl.y - h); ctx.stroke(); }
      } else if (sl.style === 'cleave') {      // a heavy double sweep
        const an = sl.ang || 0, sweep = 2.8 * Math.min(1, k * 1.5);
        for (const [off, w, c] of [[0, 11, 'rgba(' + mc + ',' + a + ')'], [0.22, 5, 'rgba(255,255,255,' + a + ')']]) { ctx.shadowColor = 'rgb(' + mc + ')'; ctx.shadowBlur = 12; ctx.strokeStyle = c; ctx.lineWidth = w * a + 1; ctx.beginPath(); ctx.arc(sl.x - ux * 8, sl.y - uy * 8, 27, an - 1.4 + off, an - 1.4 + off + sweep); ctx.stroke(); }
      } else if (sl.style === 'drain') {       // wisps of life pulled from the target back toward the attacker
        ctx.fillStyle = 'rgba(' + mc + ',' + a + ')'; for (let i = 0; i < 6; i++) { const d = Math.max(0, k * 44 - i * 6); ctx.beginPath(); ctx.arc(sl.x - ux * d - uy * Math.sin(d * 0.3 + i) * 6, sl.y - uy * d + ux * Math.sin(d * 0.3 + i) * 6, 3.4 - i * 0.4, 0, 7); ctx.fill(); }
        ctx.strokeStyle = 'rgba(' + mc + ',' + a * 0.7 + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sl.x, sl.y, 6 + 14 * k, 0, 7); ctx.stroke();
      } else if (sl.style === 'frost') {       // ice shards burst out
        ctx.strokeStyle = 'rgba(' + mc + ',' + a + ')'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(sl.x, sl.y, 6 + 24 * k, 0, 7); ctx.stroke();
        ctx.strokeStyle = 'rgba(235,250,255,' + a + ')'; ctx.lineWidth = 2; for (let i = 0; i < 8; i++) { const an = i * 0.785 + 0.2, r0 = 7 + 14 * k; ctx.beginPath(); ctx.moveTo(sl.x + Math.cos(an) * r0, sl.y + Math.sin(an) * r0); ctx.lineTo(sl.x + Math.cos(an) * (r0 + 9), sl.y + Math.sin(an) * (r0 + 9)); ctx.stroke(); }
      } else if (sl.style === 'holy') {        // a flare of light
        ctx.globalCompositeOperation = 'lighter'; const r = 10 + 20 * k, g = ctx.createRadialGradient(sl.x, sl.y, 1, sl.x, sl.y, r); g.addColorStop(0, 'rgba(255,255,255,' + a + ')'); g.addColorStop(0.5, 'rgba(' + mc + ',' + a * 0.6 + ')'); g.addColorStop(1, 'rgba(' + mc + ',0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sl.x, sl.y, r, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,235,' + a + ')'; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { const an = i * 1.5708 + k * 1.2; ctx.beginPath(); ctx.moveTo(sl.x + Math.cos(an) * 6, sl.y + Math.sin(an) * 6); ctx.lineTo(sl.x + Math.cos(an) * (16 + 14 * k), sl.y + Math.sin(an) * (16 + 14 * k)); ctx.stroke(); }
      } else if (sl.style === 'sting') {       // a quick needle strike with a bead of venom
        const len = 32 * Math.min(1, k * 3); ctx.strokeStyle = 'rgba(' + mc + ',' + a + ')'; ctx.lineWidth = 2 + 2.5 * a; ctx.shadowColor = 'rgb(' + mc + ')'; ctx.shadowBlur = 6; ctx.beginPath(); ctx.moveTo(sl.x - ux * 30, sl.y - uy * 30); ctx.lineTo(sl.x - ux * 30 + ux * len, sl.y - uy * 30 + uy * len); ctx.stroke();
        ctx.fillStyle = 'rgba(160,235,90,' + a + ')'; ctx.beginPath(); ctx.arc(sl.x + ux * 2, sl.y + uy * 2 + 8 * k, 3 * a + 1, 0, 7); ctx.fill();
      } else if (sl.style === 'zap') {         // a crack of lightning at the target
        const tn = Math.floor(performance.now() / 50); ctx.shadowColor = 'rgb(' + mc + ')'; ctx.shadowBlur = 10; ctx.lineJoin = 'round';
        for (const [w, c] of [[5, 'rgba(' + mc + ',' + a * 0.4 + ')'], [2, 'rgba(255,255,255,' + a + ')']]) { ctx.strokeStyle = c; ctx.lineWidth = w; for (let b = 0; b < 2; b++) { ctx.beginPath(); ctx.moveTo(sl.x - ux * 28 + (b ? 6 : -6), sl.y - uy * 28 - 12 + b * 10); for (let i = 1; i <= 6; i++) { const t = i / 6; ctx.lineTo(sl.x - ux * 28 * (1 - t) + (rnd(i + b * 9, tn) - 0.5) * 12, sl.y - uy * 28 * (1 - t) + (rnd(i + 3 + b * 9, tn) - 0.5) * 12 - 12 * (1 - t)); } ctx.stroke(); } }
      } else if (sl.style === 'poison') {      // a spreading cloud
        for (let i = 0; i < 5; i++) { const an = i * 1.26, r = 4 + 12 * k; ctx.fillStyle = 'rgba(' + mc + ',' + a * 0.45 + ')'; ctx.beginPath(); ctx.arc(sl.x + Math.cos(an) * 9 * k, sl.y + Math.sin(an) * 7 * k - 4 * k, r, 0, 7); ctx.fill(); }
      } else if (sl.style === 'tentacle') {    // a sweeping tentacle lash
        const sw = Math.sin(Math.min(1, k * 1.4) * Math.PI); for (const [w, c] of [[7, 'rgba(' + mc + ',' + a + ')'], [2.4, 'rgba(255,255,255,' + a * 0.6 + ')']]) { ctx.strokeStyle = c; ctx.lineWidth = w * a + 1; ctx.beginPath(); ctx.moveTo(sl.x - ux * 36, sl.y - uy * 36 + 10); ctx.quadraticCurveTo(sl.x - ux * 10 - uy * 22 * sw, sl.y - uy * 10 + ux * 22 * sw, sl.x + ux * 8 * Math.min(1, k * 2), sl.y + uy * 8 * Math.min(1, k * 2)); ctx.stroke(); }
      } else if (sl.style === 'spark') {
        ctx.strokeStyle = IMPC[sl.shoot] ? 'rgba(' + IMPC[sl.shoot] + ',' + a + ')' : sl.shoot === 'fire' ? 'rgba(255,150,40,' + a + ')' : sl.shoot === 'orb' ? 'rgba(210,140,255,' + a + ')' : 'rgba(255,240,180,' + a + ')'; ctx.lineWidth = 2.2;
        for (let i = 0; i < 7; i++) { const an = i * 0.9 + 0.2; ctx.beginPath(); ctx.moveTo(sl.x + Math.cos(an) * (3 + 6 * k), sl.y + Math.sin(an) * (3 + 6 * k)); ctx.lineTo(sl.x + Math.cos(an) * (8 + 14 * k), sl.y + Math.sin(an) * (8 + 14 * k)); ctx.stroke(); }
      }
      ctx.restore();
      return true;
    });
  }
  function drawTurnPill(now) {
    if (!B.cur) return;
    const mine = B.cur.side === 0, auto = B.auto, txt = auto ? '⏩ AUTO' : mine ? '⚔ YOUR TURN' : '… ENEMY TURN';
    const w = 130, x = 960 - w - 12, y = 12, pulse = mine && B.input ? 0.75 + 0.25 * Math.sin(now / 250) : 1;
    ctx.globalAlpha = pulse; ctx.fillStyle = mine ? '#2a5a2a' : '#6a2a2a'; ctx.fillRect(x, y, w, 28);
    ctx.strokeStyle = mine ? '#8aff8a' : '#ff9a8a'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, 28);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, x + w / 2, y + 15);
    ctx.globalAlpha = 1;
  }
  function drawQueue() {
    const order = [];
    if (B.cur && !B.cur.dead) order.push(B.cur);
    B.queue.forEach(s => !s.dead && order.push(s));
    B.waitQ.slice().sort((a, b) => speedOf(a) - speedOf(b)).forEach(s => !s.dead && order.push(s));
    alive().sort((a, b) => speedOf(b) - speedOf(a) || a.side - b.side).forEach(s => { if (order.length < 14) order.push(s); });
    ctx.fillStyle = '#000a'; ctx.fillRect(0, 0, 960, 52);
    ctx.fillStyle = '#e8d9a8'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(`Round ${B.round}`, 12, 16);
    order.slice(0, 14).forEach((s, i) => {
      const x = 90 + i * 50, y = 26;
      ctx.beginPath(); ctx.arc(x, y, 19, 0, 7); ctx.fillStyle = s.side === 0 ? '#2a4f8a' : '#8a2a2a'; ctx.fill();
      ctx.lineWidth = i === 0 ? 3 : 1.5; ctx.strokeStyle = i === 0 ? '#ffd24a' : '#000'; ctx.stroke();
      ctx.drawImage(Art.portraitCanvas(s.t, PS()), x - 15, y - 15, 30, 30);
    });
  }
  function drawInfo(h) {
    const s = h && stackAt(h.c, h.r) || B.cur;
    ctx.fillStyle = '#000b'; ctx.fillRect(0, 596, 960, 44);
    const hs = h && structAt(h.c, h.r);
    if (hs) {
      ctx.fillStyle = '#f3e7bd'; ctx.font = '14px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(`${STRUCT[hs.k].i} ${STRUCT[hs.k].n}  HP ${Math.max(0, hs.hp)}/${hs.max}${hs.k === 'tower' ? '  — shoots attackers every round' : hs.k === 'gate' ? '  — break it to storm the castle' : ''}`, 14, 612);
      return;
    }
    if (!s || s.dead) return;
    const c = C[s.t];
    ctx.fillStyle = '#f3e7bd'; ctx.font = '14px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`${c.i} ${s.n} ${c.n}${'★'.repeat((c.lv || 1) - 1)}   Att ${attackOf(s)}  Def ${defenceOf(s)}  Dmg ${c.lo}-${c.hi}  HP ${s.hp}/${c.hp}  Spd ${speedOf(s)}${c.shoot ? `  Archer · Ammo ${s.ammo}` : ''}${c.fly ? '  Flying' : ''}`, 14, 612);
    const hr0 = h && !stackAt(h.c, h.r) && B.reach && B.reach.get(key(h.c, h.r)), hfoe = hr0 && hr0.d > 0 && B.cur && B.cur.side === 0 ? foeBeside(B.cur, h.c, h.r) : null;      // hovering an empty hex beside an enemy previews the strike from there
    if (B.cur && B.cur.side === 0 && h && ((stackAt(h.c, h.r) && stackAt(h.c, h.r).side === 1) || hfoe) && B.input) {
      const e = hfoe || stackAt(h.c, h.r), a = B.cur;
      const shoot = canShoot(a), spot = !shoot ? (hfoe ? hr0 : pickSpot(a, e, B.reach, B.hoverPt)) : null, rear = !!spot && isRear(a, e, spot), d = calcDmg(a, e, !shoot, true, 0, spot || undefined) * (abil(a, 'dstrike') && !shoot ? 2 : 1), th = totalHp(e), kills = d >= th ? e.n : Math.max(0, e.n - Math.ceil((th - d) / C[e.t].hp));
      let ret = 0; if (!shoot && d < th && !abil(a, 'noRet') && (abil(e, 'unlimRet') || e.ret)) ret = calcDmg(e, a, true, true);
      const rk = ret ? Math.min(a.n, Math.floor(ret / C[a.t].hp)) : 0;
      ctx.fillStyle = '#ffb3a8'; ctx.fillText(`${shoot ? 'Shoot' : 'Attack'}${rear ? ' from behind (+' + REAR_BONUS + ' Att)' : ''}: ~${d} dmg (~${kills} kills)${ret ? `   ↩ retaliation ~${ret} (~${rk} lost)` : ''}${shoot ? rangeNote(a, e) : ''}`, 14, 630);
      { const bp = hexPx(e.c, e.r), txt = `-${d}  ☠${kills}${ret ? '  ↩' + rk : ''}`; ctx.font = 'bold 13px sans-serif'; const tw = ctx.measureText(txt).width + 14; ctx.fillStyle = 'rgba(20,8,4,.88)'; ctx.fillRect(bp.x - tw / 2, bp.y - 52, tw, 20); ctx.strokeStyle = kills >= e.n ? '#6fd36f' : '#ffb3a8'; ctx.lineWidth = 1.5; ctx.strokeRect(bp.x - tw / 2, bp.y - 52, tw, 20); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(txt, bp.x, bp.y - 41); ctx.textAlign = 'left'; ctx.font = '14px sans-serif'; }
      if (spot && (spot.c !== a.c || spot.r !== a.r)) { const sp0 = hexPx(spot.c, spot.r), ep0 = hexPx(e.c, e.r); ctx.save(); ctx.strokeStyle = rear ? '#ffd86a' : '#ffffff'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.arc(sp0.x, sp0.y, 13, 0, 7); ctx.moveTo(sp0.x, sp0.y); ctx.lineTo(ep0.x, ep0.y); ctx.stroke(); ctx.restore(); }      // where he will stand to strike
      if (canShoot(a) && hexDist(a, e) > 10) { const ep = hexPx(e.c, e.r); ctx.font = '22px ' + FONT; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText('💔', ep.x + 18, ep.y - 22); ctx.textAlign = 'left'; ctx.font = '14px sans-serif'; }
    } else {
      const at = abilityText(s.t);
      if (at) { ctx.fillStyle = '#bfe3a8'; ctx.fillText('★ ' + at, 14, 630); }
    }
  }

  // ------- setup / finish -------
  function finish(win, fled) {
    if (B.over) return;
    B.over = true; if (win) { if (!(typeof Sfx !== 'undefined' && Sfx.victory && Sfx.victory())) sfx('win'); } else sfx(fled ? 'click' : 'lose'); if (typeof Sfx !== 'undefined') Sfx.mood('map');
    const surv = B.armyIn.map((a, i) => { if (!a) return null; const st = B.stacks.find(s => s.side === 0 && s.slot === i); return st && !st.dead ? st.n : 0; });
    const lost = B.armyIn.map((a, i) => a ? a.n - (surv[i] || 0) : 0).reduce((p, v) => p + v, 0);
    const res = { win, fled, survivors: surv, xp: win ? Math.floor(B.xp) : 0, mana: B.hero.mana };
    setTimeout(async () => {
      B.canRetreat = false;
      if (win && typeof Celebrate !== 'undefined') Celebrate.fight();
      const html = fled ? '<h2>🏳️ Retreat</h2><p>Your army fled the field.</p>'
        : win ? (() => {
          const army = B.armyIn.map((a, i) => a ? { t: a.t, n0: a.n, n1: surv[i] || 0 } : null).filter(Boolean);
          const slain = B.stacks.filter(s => s.side === 1 && !s.summoned).reduce((p, s) => p + Math.max(0, (s.maxN || 0) - Math.max(0, s.n)), 0);
          const hero = B.hero || {};
          return `${window.vicBanner('Victory', 'The field is yours.')}
            <div class="vic-hero">${Art.heroPic(hero.icon || '🛡️', '#2a5fb0', 56, hero.pid)}<div><b>${hero.name || 'Your hero'}</b><small>leads the army to victory</small></div></div>
            <div class="vic-stats"><div><b>${slain}</b><span>Enemies slain</span></div><div><b class="${lost ? 'bad' : 'good'}">${lost}</b><span>Your losses</span></div><div><b>+${res.xp}</b><span>Experience</span></div></div>
            <h4>Your army</h4><div class="vic-army">${army.map(u => `<div class="vic-unit${u.n1 ? '' : ' fallen'}">${Art.pic(u.t, 56)}<b>${u.n1}</b>${u.n0 - u.n1 ? `<small>−${u.n0 - u.n1}</small>` : ''}<span>${C[u.t].n}</span></div>`).join('')}</div>`;
        })()
          : '<h2>💀 Defeat</h2><p>Your army has been destroyed. The hero retreats to town.</p>';
      if (win) await window.showModal(html, ['Continue']);
      document.body.classList.remove('inbattle'); rotateHint(false);
      B.resolve(res);
      B = null;
    }, 400);
  }

  // battle poses are loaded on demand before the fight starts (6 small images per creature type)
  async function preloadPoses(opts) {
    if (typeof Assets === 'undefined') return;
    const ids = new Set(); [...(opts.army || []), ...(opts.enemy || [])].forEach(x => { if (x) ids.add(String(x.t)); });
    const list = []; ids.forEach(t => { const bb = t.replace(/_\d$/, ''), u = /_\d$/.test(t) ? '_up' : ''; for (const d of ['left', 'right']) for (const st of ['idle', 'fighting', 'defending']) list.push('poses/' + d + '/' + st + '/' + bb + u); ANIM_STATES.forEach(st => { const q = seqOf(t, st); if (q) list.push(...q); }); });
    [opts.hero, opts.eHero].forEach(h => { if (h && h.pid) list.push('mounted/' + h.pid + '_east', 'mounted/' + h.pid + '_west'); });
    list.push(...Assets.list('battle/obs/'), ...Assets.list('battle/mach/').filter(s => /_basic$|_all$/.test(s)));
    if (opts.siege) { const L = Math.max(0, Math.min(3, opts.siege.fort || 0)), sfx = FORT_NAME[L] + (L >= 2 ? '_' + (FAC_ART[opts.siege.fac] || 'kingdom') : ''); list.push(...Assets.list('battle/siege/').filter(s => s.endsWith('_' + sfx))); }
    await Promise.race([Assets.need(list), new Promise(r => setTimeout(r, 5000))]);
  }
  async function run(opts) {
    try { await preloadPoses(opts); } catch (e) { /* ignore */ }
    return run0(opts);
  }
  function run0(opts) {
    cv = $('bat'); ctx = cv.getContext('2d'); bind(); if (typeof Sfx !== 'undefined') Sfx.mood('battle');
    // sharp on dense screens: the canvas holds up to 2x the pixels while everything is still drawn in 960x640 units
    DPR = Math.max(1, Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1));
    if (cv.width !== Math.round(960 * DPR) || cv.height !== Math.round(640 * DPR)) { cv.width = Math.round(960 * DPR); cv.height = Math.round(640 * DPR); }
    return new Promise(resolve => {
      const hero = { att: opts.hero.att, def: opts.hero.def, sp: opts.hero.sp, mana: opts.hero.mana, spells: opts.hero.spells || [],
        perks: opts.hero.perks || {}, mach: opts.hero.mach || {}, name: opts.hero.name || 'Hero', icon: opts.hero.icon || '🛡️', pid: opts.hero.pid, morale: opts.hero.morale || 0, luck: opts.hero.luck || 0 };
      B = { eHero: opts.eHero || null, heroFlash: null, strikeUsed: false, siege: null, walls: new Map(), moat: new Set(), cw: 0, stacks: [], obs: new Map(), queue: [], waitQ: [], cur: null, round: 0, reach: new Map(), busy: false, input: false, auto: false, over: false,
        spell: null, castUsed: false, hover: null, fx: [], parts: [], efx: [], shake: null, cam: null, fxDelays: null, fxPal: null, shot: null, xp: 0, hero, eStats: opts.eStats || { att: 0, def: 0 },
        opts, armyIn: opts.army.map(a => a && { ...a }), canRetreat: opts.canRetreat !== false, resolve };
      const mk = (side, list, col) => {
        const items = list.map((a, slot) => a && { a, slot }).filter(Boolean).slice(0, 7);
        items.forEach((it, k) => {
          const r = Math.round((k + 0.5) * BH / items.length - 0.5), wd = !opts.siege && C[it.a.t].wide, c = side === 0 ? (wd ? 1 : 0) : (wd ? BW - 2 : BW - 1);
          const p = hexPx(c, r);
          B.stacks.push({ t: it.a.t, n: it.a.n, hp: C[it.a.t].hp, side, c, r, slot: it.slot, ammo: Math.ceil((C[it.a.t].shoot || 0) * (side === 0 && opts.hero.mach && opts.hero.mach.cart ? 1.5 : 1)), ammoMax: Math.ceil((C[it.a.t].shoot || 0) * (side === 0 && opts.hero.mach && opts.hero.mach.cart ? 1.5 : 1)), px: p.x, py: p.y, ret: true, maxN: it.a.n });
        });
      };
      mk(0, opts.army); mk(1, opts.enemy);
      if (opts.siege) setupSiege(opts.siege);
      const icons = ['🪨', '🌲', '🌳', '🌿', '🪵', '⛰️', '🌳', '🌾', '🏚️', '🌲', '🌿', '🌳', '🍄', '🪦', '🚧', '💧'];
      let lastIc = '';
      const lo = !opts.siege ? 3 : opts.siege.dside === 1 ? 2 : 8, span = !opts.siege ? 9 : 5, want = opts.siege ? 5 : 11;
      for (let i = 0, tries = 0; i < want && tries < 100; tries++) {
        const c = lo + Math.floor(Math.random() * span), r = Math.floor(Math.random() * BH);
        if (B.obs.has(key(c, r)) || stackAt(c, r)) continue;
        let ic; do ic = icons[Math.floor(Math.random() * icons.length)]; while (ic === lastIc); lastIc = ic; B.obs.set(key(c, r), ic); i++;
      }
      placeMines();
      $('blog').innerHTML = ''; $('btitle').textContent = opts.title || 'Battle';
      document.body.classList.add('inbattle'); rotateHint(true);
      try { if (matchMedia('(orientation: landscape) and (max-height: 540px)').matches) document.body.classList.toggle('bzfit', localStorage.getItem('h3-bzoom') === '0'); } catch (e) { /* ignore */ }   // phones in landscape: the whole field fits at once; the zoom button still follows the active unit
      log(opts.siege ? (opts.siege.dside === 1 ? '🏰 Siege! Break the gate, cross the drawbridge, beware the towers.' : '🏰 The castle is under siege — hold the walls!') : 'Battle begins!');
      refreshButtons();
      requestAnimationFrame(draw);
      nextTurn();
    });
  }
  // an idle frame for a creature standing on the adventure map (null until its frames have loaded, or when it has none): { img, cx, by, bw, bh }
  const mapNeed = {};
  function mapIdle(t, now, seed, still) {
    const seq = seqOf(t, 'idle'); if (!seq || typeof Assets === 'undefined') return null;
    if (!mapNeed[t]) { mapNeed[t] = 1; Assets.need(seq); }
    const fit = animFit(t); if (!fit) return null;
    // every creature keeps its own pace and starting point, and its frames dissolve into each other, so a crowd on the map never moves in step
    const n = seq.length, h1 = rnd(seed, 1.3), h2 = rnd(seed, 7.7), raw = still ? 0 : now / (idleMs(t) * (0.8 + 0.45 * h2)) + h1 * n * 7, i = Math.floor(raw), f = raw - i;
    const img = Assets.get(seq[((i % n) + n) % n]); if (!img) return null;
    const nx = !still && n > 1 ? Assets.get(seq[(((i + 1) % n) + n) % n]) : null;
    return { img, next: nx && nx.width === img.width && nx.height === img.height ? nx : null, k: f * f * (3 - 2 * f), br: still ? 0 : Math.sin(now / (520 + 260 * h2) + h1 * 6.28), cx: fit.cx, by: fit.by, bw: fit.bw, bh: fit.bh };
  }
  return { run, mapIdle };
})();
