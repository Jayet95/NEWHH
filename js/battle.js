'use strict';
const Battle = (() => {
  const BW = 15, BH = 11, HR = 30, HW = Math.sqrt(3) * HR;
  const OX = (960 - HW * (BW + 0.5)) / 2, OY = 66;
  const EVEN = [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
  const ODD = [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]];
  const FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
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
  const stackAt = (c, r) => B.stacks.find(s => !s.dead && s.c === c && s.r === r);
  const COARSE = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : false;
  const sfx = (n) => { if (typeof Sfx !== 'undefined') Sfx.play(n); };
  const perk = (id) => (B.hero && B.hero.perks && B.hero.perks[id]) || 0;
  const speedOf = (s) => Math.max(1, C[s.t].s + (s.haste || 0) - (s.slow || 0));
  const abil = (s, k) => {
    for (const x of (C[s.t].ab || [])) { if (x === k) return true; if (x.startsWith(k + ':')) return parseFloat(x.slice(k.length + 1)); }
    return false;
  };
  const hates = (a, d) => (C[a.t].ab || []).some(x => x.startsWith('hate:') && x.slice(5) === C[d.t].line);
  const adjStacks = (s) => nbrs(s.c, s.r).map(([c, r]) => stackAt(c, r)).filter(Boolean);
  const HERO_POS = [{ x: 38, y: 310 }, { x: 922, y: 310 }];
  const STRUCT = { wall: { hp: 120, n: 'Wall', i: '🧱' }, gate: { hp: 160, n: 'Gate', i: '🚪' }, tower: { hp: 200, n: 'Arrow Tower', i: '🗼' } };
  const blockedGround = (c, r) => B.obs.has(key(c, r)) || (B.siege && (B.walls.has(key(c, r)) || B.moat.has(key(c, r))));
  const structAt = (c, r) => B.siege ? B.walls.get(key(c, r)) : undefined;
  const isAttacker = (s) => B.siege && s.side !== B.siege.dside;
  const bonus = (s) => s.side === 0 ? B.hero : B.eStats;
  const attackOf = (s) => C[s.t].a + bonus(s).att + (s.bloodlust || 0);
  const defenceOf = (s) => C[s.t].d + bonus(s).def + (s.stone || 0) + (s.defb ? 3 : 0);
  const totalHp = (s) => (s.n - 1) * C[s.t].hp + s.hp;
  const adjEnemy = (s) => nbrs(s.c, s.r).some(([c, r]) => { const o = stackAt(c, r); return o && o.side !== s.side; });
  const canShoot = (s) => C[s.t].shoot && s.ammo > 0 && !adjEnemy(s);

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
  function calcDmg(a, d, melee, avg, joust) {
    const c = C[a.t];
    const base = baseDmg(a, avg);
    const A = attackOf(a); let D = defenceOf(d);
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
    B.fx.push({ x: p.x, y: p.y - 20, txt: '-' + dmg, col: '#ffd24a', t0: performance.now() });
    st.flash = performance.now(); sfx(st.hp <= 0 ? 'crash' : 'hit');
    log(`${label} the ${STRUCT[st.k].n}: ${dmg} dmg (${Math.max(0, st.hp)}/${st.max}).`);
    if (st.hp <= 0) { B.walls.delete(key(st.c, st.r)); log(`💥 The ${STRUCT[st.k].n} is destroyed!`); }
  }
  function hit(target, dmg, label) {
    if (target.side === 0) dmg = Math.max(1, Math.floor(dmg * (1 - 0.07 * perk('armorer'))));
    const killed = applyDmg(target, dmg); sfx('hit');
    target.flash = performance.now(); target.hurt = target.flash; if (target.dead) target.deadAt = target.flash;
    if (target.side === 1) B.xp += killed * C[target.t].hp;
    const p = hexPx(target.c, target.r);
    B.fx.push({ x: p.x, y: p.y - 20, txt: '-' + dmg, col: '#ff6a5a', t0: performance.now() });
    log(`${label} ${C[target.t].n}: ${dmg} dmg, ${killed} killed.`);
    return killed;
  }
  function log(t) {
    const el = $('blog'); if (!el) return;
    const d = document.createElement('div'); d.textContent = t; el.appendChild(d); el.scrollTop = el.scrollHeight;
  }

  function computeReach(s) {
    const res = new Map(), spd = speedOf(s);
    const free = (c, r) => !blockedGround(c, r) && !stackAt(c, r);
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
    let best = null;
    for (const [c, r] of nbrs(e.c, e.r)) { const h = reach.get(key(c, r)); if (h && (!best || h.d < best.d)) best = h; }
    return best;
  }
  function pathTo(reach, hex) {
    const p = []; let h = hex;
    while (h) { p.push(h); h = h.prev ? reach.get(h.prev) : null; }
    return p.reverse();
  }

  async function tweenTo(s, x, y, ms) {
    if (typeof document !== 'undefined' && document.hidden) { s.px = x; s.py = y; return; }
    const x0 = s.px, y0 = s.py, t0 = performance.now();
    for (;;) {
      const k = Math.min(1, (performance.now() - t0) / ms);
      s.px = x0 + (x - x0) * k; s.py = y0 + (y - y0) * k;
      if (k >= 1) break;
      await raf();
    }
  }
  async function doMove(s, hex) {
    const fly = C[s.t].fly, path = fly ? [{ c: s.c, r: s.r }, hex] : pathTo(B.reach, hex);
    for (let i = 1; i < path.length; i++) {
      const p = hexPx(path[i].c, path[i].r);
      await tweenTo(s, p.x, p.y, fly ? 280 : 90);
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
  const styleOf = (s) => (typeof Figures !== 'undefined' && Figures.style) ? Figures.style(s.t) : { melee: 'slash', shoot: 'arrow', col: null };
  async function strike(s, t) {
    const a = hexPx(s.c, s.r), p = hexPx(t.c, t.r), now = performance.now();
    s.anim = { kind: 'lunge', t0: now, dur: 300, dx: p.x - a.x, dy: p.y - a.y };
    (B.slashes = B.slashes || []).push({ x: p.x, y: p.y, t0: now + 110, dur: 340, style: styleOf(s).melee, ang: Math.atan2(p.y - a.y, p.x - a.x) });
    await sleep(120);
  }
  async function fireProj(s, tg) {
    const a = hexPx(s.c, s.r), p = hexPx(tg.c, tg.r), now = performance.now(), st = styleOf(s), dur = Math.max(220, Math.min(520, Math.hypot(p.x - a.x, p.y - a.y) * 1.1));
    s.anim = { kind: 'shoot', t0: now, dur: 320, dx: p.x - a.x, dy: p.y - a.y };
    (B.proj = B.proj || []).push({ ax: a.x, ay: a.y - 6, bx: p.x, by: p.y - 6, t0: now + 130, dur, style: st.shoot, col: st.col });
    await sleep(130 + dur);
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
          if (bs && !bs.dead) hit(bs, dmg, '🔥 Breath scorches');
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
    B.siege = { dside, fort: sg.fort || 0, minel: sg.minel || 0 };
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
    const p = hexPx(s.c, s.r); s.px = p.x; s.py = p.y;
    B.fx.push({ x: p.x, y: p.y - 6, txt: '💥', col: '#fff', t0: performance.now() });
    sfx('crash'); hit(s, B.mineDmg, '💣 A mine explodes under');
  }
  function layMine(h) {
    if (!B.siege || B.siege.dside !== 0 || B.mineReserve <= 0 || B.mineUsed) return;
    if (!freeMineHex(h.c, h.r)) return toast('Mines go on free open ground in front of the walls.');
    B.mines.set(key(h.c, h.r), { r: 1 }); B.mineReserve--; B.mineUsed = true; B.spell = null;
    log('💣 A mine is laid.'); sfx('click'); refreshButtons();
  }
  async function doShoot(s, e) {
    s.ammo--; sfx('shoot');
    await fireProj(s, e);
    const shots = abil(s, 'dshot') ? 2 : 1;
    for (let k = 0; k < shots && !e.dead; k++) {
      const dmg = Math.max(1, Math.floor(calcDmg(s, e, false) * luckMul(s)));
      const ex = { c: e.c, r: e.r };
      hit(e, dmg, `${C[s.t].n} shoots`);
      onHitEffects(s, e, dmg);
      if (abil(s, 'splash') || abil(s, 'cloud')) {
        for (const o of nbrs(ex.c, ex.r).map(([c, r]) => stackAt(c, r)).filter(Boolean)) {
          if (o === s || o.dead || (abil(s, 'cloud') && (C[o.t].fac === 'necropolis'))) continue;
          hit(o, Math.max(1, Math.floor(dmg / 2)), abil(s, 'cloud') ? '☠ Death cloud hits' : '🔥 Splash hits');
        }
      }
      if (k + 1 < shots) await sleep(160);
    }
    await sleep(240);
  }

  function checkEnd() {
    if (B.over) return true;
    if (!alive(0).length) { finish(false, false); return true; }
    if (!alive(1).length) { finish(true, false); return true; }
    return false;
  }

  function newRound() {
    B.round++;
    if (B.round > 60) { log('Stalemate — the attackers withdraw.'); finish(false, false); return; }
    for (const s of alive()) { s.ret = true; s.waited = false; }
    B.queue = alive().sort((a, b) => speedOf(b) - speedOf(a) || a.side - b.side);
    B.waitQ = []; B.strikeUsed = false; B.mineUsed = false;
    log(`— Round ${B.round} —`);
    if (B.siege) {
      for (let i = 0; i < 2; i++) {
        const sts = [...B.walls.values()]; if (!sts.length) break;
        const gate = sts.find(w => w.k === 'gate');
        const cat = Math.floor(60 * (B.siege.dside === 1 ? 1 + 0.5 * perk('ballistics') : 1));
        hitStruct(gate && Math.random() < 0.5 ? gate : sts[Math.floor(Math.random() * sts.length)], cat, '🎯 Catapult hits');
      }
      if (B.round > 1) {
        const atk = alive(1 - B.siege.dside);
        for (const st of [...B.walls.values()]) if (st.k === 'tower' && atk.length) {
          const tg = atk.filter(a => !a.dead)[Math.floor(Math.random() * atk.length)];
          if (tg) hit(tg, Math.round((25 + Math.floor(Math.random() * 20)) * (B.towerMul || 1)), '🗼 Arrow Tower hits');
        }
      }
    }
  }
  async function nextTurn() {
    if (B.over) return;
    let s = null;
    if (B.bonus && !B.bonus.dead) { s = B.bonus; B.bonus = null; log(`✨ ${C[s.t].n} acts again (high morale)!`); }
    while (!s) {
      if (!B.queue.length) {
        if (B.waitQ.length) { B.queue = B.waitQ.sort((a, b) => speedOf(a) - speedOf(b)); B.waitQ = []; }
        else { newRound(); B.castUsed = false; if (checkEnd()) return; }
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
    const foes = alive(1 - s.side);
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
      const spot = meleeSpot(s, e, B.reach);
      if (!spot) continue;
      const v = value(e, calcDmg(s, e, true, true)) * (e.ret ? 1 : 1.1) - 0.3 * value(s, calcDmg(e, s, true, true));
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
    const h = mouseHex(ev); if (!h) return;
    if (COARSE) { // touch: first tap previews, second tap on the same hex confirms
      if (!(B.pend && B.pend.c === h.c && B.pend.r === h.r)) { B.pend = h; B.hover = h; if (!B.tapHint) { B.tapHint = true; toast('Tap the same hex again to confirm'); } return; }
      B.pend = null;
    }
    const s = B.cur, t = stackAt(h.c, h.r);
    if (B.spell === '__mine') { layMine(h); return; }
    if (B.spell === '__strike') { heroStrike(t); return; }
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
      const spot = meleeSpot(s, t, B.reach);
      if (spot) return playerAct(() => doMelee(s, t, spot));
      return toast('Too far away.');
    }
    const r = B.reach.get(key(h.c, h.r));
    if (!t && r && r.d > 0) return playerAct(() => doMove(s, r));
  }
  function mouseHex(ev) {
    const rc = cv.getBoundingClientRect();
    return hexAt((ev.clientX - rc.left) * 960 / rc.width, (ev.clientY - rc.top) * 640 / rc.height);
  }
  function onMove(ev) { if (B) B.hover = mouseHex(ev); }
  // spell school rank (0 = untrained) and Wisdom gate: spell level <= 2 + Wisdom rank
  const spellRank = (sp) => perk(SCHOOL_SKILL[sp.school]);
  const spellOk = (sp) => sp.lv <= 2 + perk('wisdom');
  function castSpell(k, t) {
    const sp = SPELLS[k];
    if (!t || (sp.tgt === 'enemy') !== (t.side === 1)) return toast('Invalid target.');
    if (!spellOk(sp)) return toast(`${sp.n} needs Wisdom (rank ${sp.lv - 2}).`);
    if (B.hero.mana < sp.cost) return toast('Not enough mana.');
    B.hero.mana -= sp.cost; B.castUsed = true; B.spell = null; sfx('spell');
    const r = spellRank(sp), P = B.hero.sp;
    const sd = (x) => Math.floor(x * (1 + 0.15 * perk('sorcery')) * (1 + 0.25 * r));
    B.shot = { ax: HERO_POS[0].x, ay: HERO_POS[0].y, b: { c: t.c, r: t.r }, t0: performance.now(), col: sp.tgt === 'enemy' ? '#ff9a4a' : '#8affb0' };
    B.heroFlash = [performance.now(), 0];
    const mark = (tg, txt) => { const p = hexPx(tg.c, tg.r); B.fx.push({ x: p.x, y: p.y - 20, txt, col: '#fff', t0: performance.now() }); };
    const allies = () => (r >= 3 ? alive(0) : [t]), foes = () => (r >= 3 ? alive(1) : [t]);
    const spellHit = (tg, dmg, label, fire) => {
      if (fire && abil(tg, 'fireImm')) { log(`${C[tg.t].n} is immune to fire!`); return; }
      const rs = abil(tg, 'res'); if (rs) dmg = Math.floor(dmg * (1 - rs));
      hit(tg, Math.max(1, dmg), label);
    };
    const area = (rad, fn) => { for (const e of alive(1)) if (e === t || hexDist(e, t) <= rad) fn(e); };
    switch (k) {
      case 'arrow': spellHit(t, sd(10 * P + 10), 'Magic Arrow hits'); break;
      case 'lightning': spellHit(t, sd(25 * P), 'Lightning Bolt hits'); break;
      case 'implosion': spellHit(t, sd(75 * P), 'Implosion crushes'); break;
      case 'fireball': area(r >= 3 ? 2 : 1, (e) => spellHit(e, sd(15 * P + 10), 'Fireball burns', true)); break;
      case 'meteor': area(r >= 3 ? 2 : 1, (e) => spellHit(e, sd(14 * P + 20), 'Meteors strike')); break;
      case 'frostring': area(1, (e) => { spellHit(e, sd(10 * P + 15), 'Frost Ring chills'); if (r >= 2 && !e.dead) e.slow = Math.max(e.slow || 0, 2); }); break;
      case 'armageddon': for (const s of alive()) spellHit(s, sd(18 * P + 20), 'Armageddon burns', true); break;
      case 'chain': {
        const seen = new Set(); let cur = t, dmg = sd(40 * P);
        for (let i = 0; i < (r >= 3 ? 4 : 3) && cur; i++) {
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
      case 'resurrect': { const g = healStack(t, sd(40 * P), t.maxN); mark(t, '+' + Math.round(g)); log(`${sp.n} cast.`); break; }
    }
    B.reach = computeReach(B.cur);
    refreshButtons();
    if (!checkEnd()) { /* spell does not end the turn */ }
  }
  function heroStrike(t) {
    if (!t || t.side !== 1) return toast('Pick an enemy stack.');
    if (B.strikeUsed) return toast('The hero already struck this round.');
    B.strikeUsed = true; B.spell = null;
    const dmg = Math.floor((8 + 4 * B.hero.att) * (1 + 0.1 * perk('offense')));
    B.shot = { ax: HERO_POS[0].x, ay: HERO_POS[0].y, b: { c: t.c, r: t.r }, t0: performance.now(), col: '#ffe9a0' };
    B.heroFlash = [performance.now(), 0];
    hit(t, dmg, `${B.hero.name} strikes`);
    refreshButtons();
  }
  function toast(t) { if (window.toast) window.toast(t); }

  function refreshButtons() {
    const mine = B.cur && B.cur.side === 0 && B.input;
    $('bWait').disabled = !mine || B.cur.waited;
    $('bDef').disabled = !mine;
    $('bSpell').disabled = !mine || B.castUsed || !B.hero.spells.length || B.hero.mana < 5;
    $('bHero').disabled = !mine || B.strikeUsed;
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
      b.textContent = `${sp.i} ${sp.n} · ${SCHOOL_ICON[sp.school]}${rk ? ' ' + RANK_NAMES[rk] : ''} · L${sp.lv} (${sp.cost})`;
      b.title = `${sp.desc}${ok ? '' : `\nNeeds Wisdom rank ${sp.lv - 2}`}`;
      b.disabled = B.hero.mana < sp.cost || !ok;
      b.onclick = () => { B.spell = k; list.classList.add('hide'); toast(sp.n + ': pick a ' + (sp.tgt === 'enemy' ? 'enemy' : 'friendly') + ' stack'); };
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

  function draw() {
    if (!B) return;
    const now = performance.now();
    const g = ctx.createLinearGradient(0, 0, 0, 640);
    g.addColorStop(0, '#2f4a2a'); g.addColorStop(1, '#46663a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 960, 640);
    const hov = B.hover, input = B.input && B.cur && B.cur.side === 0 && !B.busy;
    for (let r = 0; r < BH; r++) for (let c = 0; c < BW; c++) {
      const p = hexPx(c, r), k = key(c, r);
      hexPath(p.x, p.y, HR - 1);
      ctx.fillStyle = (c + r) % 2 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.08)'; ctx.fill();
      if (B.siege) {
        const inside = B.siege.dside === 1 ? c > B.cw : c < B.cw;
        if (inside) { ctx.fillStyle = 'rgba(170,130,80,.30)'; ctx.fill(); }
        if (B.moat.has(k)) { ctx.fillStyle = 'rgba(40,120,200,.65)'; ctx.fill(); }
      }
      if (input && B.reach.has(k) && !B.spell) { ctx.fillStyle = 'rgba(120,255,120,.22)'; ctx.fill(); }
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.stroke();
      if (B.obs.has(k)) { ctx.fillStyle = '#fff'; emoji(B.obs.get(k), p.x, p.y, 30); }
      if (B.siege && B.moat.has(k)) { ctx.fillStyle = 'rgba(255,255,255,.5)'; emoji('≈', p.x, p.y, 20); }
      if (B.siege && B.mines && B.mines.has(k) && B.siege.dside === 0) { ctx.fillStyle = '#fff'; emoji('💣', p.x, p.y + 2, 18); }
      if (B.spell === '__mine' && freeMineHex(c, r)) { hexPath(p.x, p.y, HR - 4); ctx.strokeStyle = 'rgba(255,200,80,.8)'; ctx.lineWidth = 2; ctx.stroke(); }
      const st = structAt(c, r);
      if (st) {
        hexPath(p.x, p.y, HR - 1);
        ctx.fillStyle = now - (st.flash || 0) < 220 ? '#ffcf7a' : '#8b8478'; ctx.fill();
        ctx.strokeStyle = '#2a2520'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#fff'; emoji(STRUCT[st.k].i, p.x, p.y - 2, st.k === 'wall' ? 24 : 28);
        ctx.fillStyle = '#300'; ctx.fillRect(p.x - 16, p.y + 15, 32, 5);
        ctx.fillStyle = st.hp / st.max > 0.5 ? '#5c5' : st.hp / st.max > 0.25 ? '#ec4' : '#e55'; ctx.fillRect(p.x - 16, p.y + 15, 32 * Math.max(0, st.hp) / st.max, 5);
      }
    }
    if (B.cur && !B.cur.dead) {
      const p = hexPx(B.cur.c, B.cur.r);
      hexPath(p.x, p.y, HR - 2); ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 3; ctx.stroke();
    }
    if (hov) {
      const p = hexPx(hov.c, hov.r), t = stackAt(hov.c, hov.r);
      hexPath(p.x, p.y, HR - 2);
      ctx.strokeStyle = t && t.side === 1 ? '#ff5a4a' : '#fff'; ctx.lineWidth = 2; ctx.stroke();
    }
    const heroes = [B.hero, B.eHero];
    heroes.forEach((hh, i) => {
      if (!hh || !hh.icon) return;
      const hp = HERO_POS[i], isPlayer = i === 0, flash = isPlayer && B.heroFlash && now - B.heroFlash[0] < 500;
      ctx.beginPath(); ctx.arc(hp.x, hp.y, 27, 0, 7);
      ctx.fillStyle = isPlayer ? '#2a4f8a' : '#8a2a2a'; ctx.fill();
      ctx.lineWidth = flash ? 5 : 3; ctx.strokeStyle = flash ? '#fff' : '#ffd24a'; ctx.stroke();
      ctx.drawImage(Art.heroCanvas(hh.icon, isPlayer ? '#3a8aff' : '#e04a3a', 72, hh.pid), hp.x - 22, hp.y - 22, 44, 44);
      ctx.fillStyle = '#000b'; ctx.fillRect(hp.x - 36, hp.y + 31, 72, isPlayer ? 41 : 28);
      ctx.fillStyle = '#f3e7bd'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(hh.name, hp.x, hp.y + 40);
      if (isPlayer) {
        ctx.font = '10px sans-serif'; ctx.fillText(`⚔${hh.att} 🛡${hh.def} 🔷${hh.mana}`, hp.x, hp.y + 53);
        ctx.fillStyle = hh.morale < 0 || hh.luck < 0 ? '#ffb3a8' : '#bfe3a8'; ctx.fillText(`😀${hh.morale >= 0 ? '+' : ''}${hh.morale} 🍀${hh.luck >= 0 ? '+' : ''}${hh.luck}`, hp.x, hp.y + 65);
      }
    });
    for (const s of B.stacks) if (s.dead && s.deadAt && now - s.deadAt < 480 && s.px !== undefined) {
      const k = (now - s.deadAt) / 480, sz = HR * 1.28 * (1 - k * 0.25);
      ctx.save(); ctx.globalAlpha = 1 - k; ctx.translate(s.px, s.py + 3 + k * 12); ctx.rotate(k * 0.7 * (s.side === 1 ? -1 : 1)); ctx.drawImage(Art.portraitCanvas(s.t), -sz / 2, -sz / 2, sz, sz); ctx.restore();
    }
    const stacks = alive().sort((a, b) => a.py - b.py);
    for (const s of stacks) {
      const off = animOff(s, now), p = { x: s.px + off.x, y: s.py + off.y }, flash = now - (s.flash || 0) < 220;
      ctx.beginPath(); ctx.arc(p.x, p.y + 4, HR * 0.72, 0, 7);
      ctx.fillStyle = flash ? '#ff8a7a' : (s.side === 0 ? '#2a4f8a' : '#8a2a2a'); ctx.fill();
      ctx.lineWidth = s === B.cur ? 4 : 2; ctx.strokeStyle = s === B.cur ? '#ffd24a' : '#111'; ctx.stroke();
      { const sz = HR * 1.28; ctx.save(); ctx.translate(p.x, p.y + 3); ctx.rotate(off.rot); if (s.side === 1) ctx.scale(-1, 1); ctx.drawImage(Art.portraitCanvas(s.t), -sz / 2, -sz / 2, sz, sz); ctx.restore(); }
      const lab = String(s.n), w = Math.max(24, lab.length * 9 + 8);
      ctx.fillStyle = '#000c'; ctx.fillRect(p.x + 4, p.y + 14, w, 16);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(lab, p.x + 4 + w / 2, p.y + 23);
      let tags = ''; if (s.haste) tags += '💨'; if (s.bless) tags += '✨'; if (s.stone) tags += '🪨'; if (s.defb) tags += '🛡'; if (s.slow) tags += '🐌'; if (s.curse) tags += '☠️'; if (s.bloodlust) tags += '😡'; if (s.shield) tags += '🌀'; if (s.stunned > 0) tags += '🙈';
      if (tags) { ctx.font = '12px ' + FONT; ctx.fillText(tags, p.x, p.y - HR * 0.78); }
    }
    drawProjectiles(now);
    if (B.shot && now - B.shot.t0 < 260) {
      const a = B.shot.ax !== undefined ? { x: B.shot.ax, y: B.shot.ay } : hexPx(B.shot.a.c, B.shot.a.r), b = hexPx(B.shot.b.c, B.shot.b.r), k = (now - B.shot.t0) / 260;
      ctx.strokeStyle = B.shot.col || '#ffe9a0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k); ctx.stroke();
    }
    B.fx = B.fx.filter(f => now - f.t0 < 1000);
    for (const f of B.fx) {
      const k = (now - f.t0) / 1000;
      ctx.globalAlpha = 1 - k; ctx.fillStyle = f.col; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeText(f.txt, f.x, f.y - k * 30); ctx.fillText(f.txt, f.x, f.y - k * 30);
      ctx.globalAlpha = 1;
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
      const ally = B.spell !== '__strike' && SPELLS[B.spell].tgt === 'ally';
      for (const s of alive(ally ? 0 : 1)) { const p = hexPx(s.c, s.r); hexPath(p.x, p.y, HR - 3); ctx.strokeStyle = ally ? 'rgba(120,255,170,.95)' : 'rgba(255,200,80,.95)'; ctx.lineWidth = 3; ctx.stroke(); }
    }
    drawQueue();
    drawTurnPill(now);
    drawInfo(hov);
    requestAnimationFrame(draw);
  }
  function animOff(s, now) {
    const fly = C[s.t].fly;
    let x = 0, y = Math.sin(now / (fly ? 260 : 430) + s.c * 3 + s.r) * (fly ? 2.6 : 1.2) - (fly ? 4 : 0), rot = 0;
    const a = s.anim;
    if (a) {
      const k = (now - a.t0) / a.dur;
      if (k >= 1) s.anim = null;
      else {
        const d = Math.hypot(a.dx, a.dy) || 1, ux = a.dx / d, uy = a.dy / d, sg = Math.sign(ux) || 1;
        if (a.kind === 'lunge') { const pr = k < 0.4 ? k / 0.4 : 1 - (k - 0.4) / 0.6, e = pr * pr * (3 - 2 * pr), m = Math.min(26, d * 0.55); x += ux * e * m; y += uy * e * m; rot = e * 0.28 * sg; }
        else { const pr = k < 0.35 ? k / 0.35 : 1 - (k - 0.35) / 0.65; x -= ux * pr * 5; y -= uy * pr * 5; rot = -pr * 0.16 * sg; }
      }
    }
    if (s.hurt) { const k = (now - s.hurt) / 280; if (k < 1) x += Math.sin(k * 40) * (1 - k) * 4; }
    return { x, y, rot };
  }
  function drawProjectiles(now) {
    B.proj = (B.proj || []).filter(p => {
      const k = (now - p.t0) / p.dur;
      if (k < 0) return true;
      if (k >= 1) { (B.slashes = B.slashes || []).push({ x: p.bx, y: p.by + 6, t0: now, dur: 280, style: 'spark', col: p.col, shoot: p.style }); return false; }
      const arc = p.style === 'arrow' ? 26 : p.style === 'rock' ? 38 : p.style === 'gaze' ? 0 : 12;
      const x = p.ax + (p.bx - p.ax) * k, y = p.ay + (p.by - p.ay) * k - arc * Math.sin(Math.PI * k), vx = p.bx - p.ax, vy = p.by - p.ay - arc * Math.PI * Math.cos(Math.PI * k), ang = Math.atan2(vy, vx);
      ctx.save();
      if (p.style === 'arrow') {
        ctx.translate(x, y); ctx.rotate(ang); ctx.strokeStyle = '#140a04'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(9, 0); ctx.stroke();
        ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#d0d8e0'; ctx.beginPath(); ctx.moveTo(8, -3); ctx.lineTo(14, 0); ctx.lineTo(8, 3); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e0443a'; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-14, -3); ctx.lineTo(-7, 0); ctx.lineTo(-14, 3); ctx.closePath(); ctx.fill();
      } else if (p.style === 'orb' || p.style === 'fire') {
        const col = p.style === 'fire' ? '255,140,40' : (p.col || 'hsl(280,80%,65%)');
        for (let i = 4; i >= 0; i--) { const kk = Math.max(0, k - i * 0.04), tx = p.ax + (p.bx - p.ax) * kk, ty = p.ay + (p.by - p.ay) * kk - arc * Math.sin(Math.PI * kk); ctx.globalAlpha = 0.5 - i * 0.09; ctx.fillStyle = p.style === 'fire' ? '#ff8a2a' : col; ctx.beginPath(); ctx.arc(tx, ty, 7 - i, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 1; const g = ctx.createRadialGradient(x, y, 1, x, y, 10); g.addColorStop(0, '#fff'); g.addColorStop(0.4, p.style === 'fire' ? '#ffb040' : (p.col || '#c070ff')); g.addColorStop(1, 'rgba(255,120,40,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 10, 0, 7); ctx.fill();
      } else if (p.style === 'ball') {
        ctx.fillStyle = '#2a2a30'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(x - 1.5, y - 1.5, 1.5, 0, 7); ctx.fill();
      } else if (p.style === 'rock') {
        ctx.translate(x, y); ctx.rotate(k * 9); ctx.fillStyle = '#8a8478'; ctx.strokeStyle = '#1c1710'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-7, -2); ctx.lineTo(-2, -8); ctx.lineTo(7, -4); ctx.lineTo(6, 6); ctx.lineTo(-4, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
      } else {
        const w = 3 + 4 * Math.sin(k * Math.PI); ctx.strokeStyle = 'rgba(255,60,120,.35)'; ctx.lineWidth = w + 5; ctx.beginPath(); ctx.moveTo(p.ax, p.ay); ctx.lineTo(x, y); ctx.stroke(); ctx.strokeStyle = '#fff0f8'; ctx.lineWidth = w; ctx.stroke();
      }
      ctx.restore();
      return true;
    });
    B.slashes = (B.slashes || []).filter(sl => {
      const k = (now - sl.t0) / sl.dur;
      if (k < 0) return true;
      if (k >= 1) return false;
      const ux = Math.cos(sl.ang || 0), uy = Math.sin(sl.ang || 0), a = 1 - k;
      ctx.save(); ctx.lineCap = 'round';
      if (sl.style === 'slash') {
        const r = 22, a0 = (sl.ang || 0) - 1.25, a1 = a0 + 2.5 * Math.min(1, k * 1.6);
        ctx.shadowColor = '#fff'; ctx.shadowBlur = 10; ctx.strokeStyle = 'rgba(255,255,255,' + a + ')'; ctx.lineWidth = 2 + 6 * a; ctx.beginPath(); ctx.arc(sl.x - ux * 6, sl.y - uy * 6, r, a0, a1); ctx.stroke();
      } else if (sl.style === 'stab') {
        const len = 34 * Math.min(1, k * 2.2); ctx.shadowColor = '#fff'; ctx.shadowBlur = 8; ctx.strokeStyle = 'rgba(255,255,255,' + a + ')'; ctx.lineWidth = 2 + 4 * a; ctx.beginPath(); ctx.moveTo(sl.x - ux * 30, sl.y - uy * 30); ctx.lineTo(sl.x - ux * 30 + ux * len, sl.y - uy * 30 + uy * len); ctx.stroke();
        ctx.fillStyle = 'rgba(255,240,170,' + a + ')'; for (let i = 0; i < 5; i++) { const an = i * 1.26 + 0.3; ctx.beginPath(); ctx.arc(sl.x + Math.cos(an) * (6 + 16 * k), sl.y + Math.sin(an) * (6 + 16 * k), 2.2 * a, 0, 7); ctx.fill(); }
      } else if (sl.style === 'smash') {
        ctx.strokeStyle = 'rgba(255,200,90,' + a + ')'; ctx.lineWidth = 2 + 5 * a; ctx.beginPath(); ctx.arc(sl.x, sl.y + 8, 6 + 28 * k, 0, 7); ctx.stroke();
        ctx.strokeStyle = 'rgba(140,110,70,' + a + ')'; ctx.lineWidth = 3; for (let i = 0; i < 8; i++) { const an = i * 0.785; ctx.beginPath(); ctx.moveTo(sl.x + Math.cos(an) * (10 + 10 * k), sl.y + 8 + Math.sin(an) * (10 + 10 * k)); ctx.lineTo(sl.x + Math.cos(an) * (16 + 16 * k), sl.y + 8 + Math.sin(an) * (16 + 16 * k)); ctx.stroke(); }
      } else if (sl.style === 'claw' || sl.style === 'gaze') {
        ctx.strokeStyle = sl.style === 'gaze' ? 'rgba(255,80,160,' + a + ')' : 'rgba(255,70,60,' + a + ')'; ctx.lineWidth = 3.4 * a + 1; ctx.shadowColor = '#ff3a2a'; ctx.shadowBlur = 6;
        for (let i = 0; i < 3; i++) { const pr = Math.min(1, k * 2 - i * 0.12); if (pr <= 0) continue; const x0 = sl.x - 14 + i * 9, y0 = sl.y - 16; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + 18 * pr, y0 + 30 * pr); ctx.stroke(); }
      } else if (sl.style === 'spark') {
        ctx.strokeStyle = sl.shoot === 'fire' ? 'rgba(255,150,40,' + a + ')' : sl.shoot === 'orb' ? 'rgba(210,140,255,' + a + ')' : 'rgba(255,240,180,' + a + ')'; ctx.lineWidth = 2.2;
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
      ctx.drawImage(Art.portraitCanvas(s.t), x - 15, y - 15, 30, 30);
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
    if (B.cur && B.cur.side === 0 && h && stackAt(h.c, h.r) && stackAt(h.c, h.r).side === 1 && B.input) {
      const e = stackAt(h.c, h.r), a = B.cur;
      const d = calcDmg(a, e, !canShoot(a), true), kills = Math.floor(Math.min(d, totalHp(e)) / C[e.t].hp);
      ctx.fillStyle = '#ffb3a8'; ctx.fillText(`${canShoot(a) ? 'Shoot' : 'Attack'}: ~${d} dmg (~${kills} kills)${canShoot(a) ? rangeNote(a, e) : ''}`, 14, 630);
      if (canShoot(a) && hexDist(a, e) > 10) { const ep = hexPx(e.c, e.r); ctx.font = '22px ' + FONT; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText('💔', ep.x + 18, ep.y - 22); ctx.textAlign = 'left'; ctx.font = '14px sans-serif'; }
    } else {
      const at = abilityText(s.t);
      if (at) { ctx.fillStyle = '#bfe3a8'; ctx.fillText('★ ' + at, 14, 630); }
    }
  }

  // ------- setup / finish -------
  function finish(win, fled) {
    if (B.over) return;
    B.over = true; sfx(win ? 'win' : fled ? 'click' : 'lose');
    const surv = B.armyIn.map((a, i) => { if (!a) return null; const st = B.stacks.find(s => s.side === 0 && s.slot === i); return st && !st.dead ? st.n : 0; });
    const lost = B.armyIn.map((a, i) => a ? a.n - (surv[i] || 0) : 0).reduce((p, v) => p + v, 0);
    const res = { win, fled, survivors: surv, xp: win ? Math.floor(B.xp) : 0, mana: B.hero.mana };
    setTimeout(async () => {
      B.canRetreat = false;
      if (win && typeof Celebrate !== 'undefined') Celebrate.fight();
      const html = fled ? '<h2>🏳️ Retreat</h2><p>Your army fled the field.</p>'
        : win ? `<h2>🏆 Victory!</h2><p>Your forces lost <b>${lost}</b> creatures.</p><p>Experience gained: <b>${res.xp}</b></p>`
          : '<h2>💀 Defeat</h2><p>Your army has been destroyed. The hero retreats to town.</p>';
      if (win) await window.showModal(html, ['Continue']);
      document.body.classList.remove('inbattle');
      B.resolve(res);
      B = null;
    }, 400);
  }

  function run(opts) {
    cv = $('bat'); ctx = cv.getContext('2d'); bind();
    return new Promise(resolve => {
      const hero = { att: opts.hero.att, def: opts.hero.def, sp: opts.hero.sp, mana: opts.hero.mana, spells: opts.hero.spells || [],
        perks: opts.hero.perks || {}, name: opts.hero.name || 'Hero', icon: opts.hero.icon || '🛡️', pid: opts.hero.pid, morale: opts.hero.morale || 0, luck: opts.hero.luck || 0 };
      B = { eHero: opts.eHero || null, heroFlash: null, strikeUsed: false, siege: null, walls: new Map(), moat: new Set(), cw: 0, stacks: [], obs: new Map(), queue: [], waitQ: [], cur: null, round: 0, reach: new Map(), busy: false, input: false, auto: false, over: false,
        spell: null, castUsed: false, hover: null, fx: [], shot: null, xp: 0, hero, eStats: opts.eStats || { att: 0, def: 0 },
        armyIn: opts.army.map(a => a && { ...a }), canRetreat: opts.canRetreat !== false, resolve };
      const mk = (side, list, col) => {
        const items = list.map((a, slot) => a && { a, slot }).filter(Boolean).slice(0, 7);
        items.forEach((it, k) => {
          const r = Math.round((k + 0.5) * BH / items.length - 0.5), c = side === 0 ? 0 : BW - 1;
          const p = hexPx(c, r);
          B.stacks.push({ t: it.a.t, n: it.a.n, hp: C[it.a.t].hp, side, c, r, slot: it.slot, ammo: C[it.a.t].shoot || 0, px: p.x, py: p.y, ret: true, maxN: it.a.n });
        });
      };
      mk(0, opts.army); mk(1, opts.enemy);
      if (opts.siege) setupSiege(opts.siege);
      const icons = ['🪨', '🌲', '🪵'];
      const lo = !opts.siege ? 3 : opts.siege.dside === 1 ? 2 : 8, span = !opts.siege ? 9 : 5, want = opts.siege ? 5 : 11;
      for (let i = 0, tries = 0; i < want && tries < 100; tries++) {
        const c = lo + Math.floor(Math.random() * span), r = Math.floor(Math.random() * BH);
        if (B.obs.has(key(c, r)) || stackAt(c, r)) continue;
        B.obs.set(key(c, r), icons[i % 3]); i++;
      }
      placeMines();
      $('blog').innerHTML = ''; $('btitle').textContent = opts.title || 'Battle';
      document.body.classList.add('inbattle');
      log(opts.siege ? (opts.siege.dside === 1 ? '🏰 Siege! Break the gate, cross the drawbridge, beware the towers.' : '🏰 The castle is under siege — hold the walls!') : 'Battle begins!');
      refreshButtons();
      requestAnimationFrame(draw);
      nextTurn();
    });
  }
  return { run };
})();
