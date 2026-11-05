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
  const speedOf = (s) => C[s.t].s + (s.haste ? 3 : 0);
  const bonus = (s) => s.side === 0 ? B.hero : B.eStats;
  const attackOf = (s) => C[s.t].a + bonus(s).att;
  const defenceOf = (s) => C[s.t].d + bonus(s).def + (s.stone ? 4 : 0) + (s.defb ? 3 : 0);
  const totalHp = (s) => (s.n - 1) * C[s.t].hp + s.hp;
  const adjEnemy = (s) => nbrs(s.c, s.r).some(([c, r]) => { const o = stackAt(c, r); return o && o.side !== s.side; });
  const canShoot = (s) => C[s.t].shoot && s.ammo > 0 && !adjEnemy(s);

  function calcDmg(a, d, melee, avg) {
    const c = C[a.t];
    let base;
    if (a.bless) base = a.n * c.hi;
    else if (avg) base = a.n * (c.lo + c.hi) / 2;
    else { const k = Math.min(a.n, 12); let sum = 0; for (let i = 0; i < k; i++) sum += c.lo + Math.floor(Math.random() * (c.hi - c.lo + 1)); base = sum * a.n / k; }
    const A = attackOf(a), D = defenceOf(d);
    let m = A >= D ? 1 + 0.05 * Math.min(A - D, 60) : 1 - 0.025 * Math.min(D - A, 28);
    if (melee && c.shoot) m *= 0.5;
    return Math.max(1, Math.floor(base * m));
  }
  function applyDmg(s, dmg) {
    const c = C[s.t], before = s.n;
    let total = totalHp(s) - dmg;
    if (total <= 0) { s.n = 0; s.dead = true; return before; }
    s.n = Math.ceil(total / c.hp); s.hp = total - (s.n - 1) * c.hp;
    return before - s.n;
  }
  function hit(target, dmg, label) {
    const killed = applyDmg(target, dmg);
    target.flash = performance.now();
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
    const free = (c, r) => !B.obs.has(key(c, r)) && !stackAt(c, r);
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
    const x0 = s.px, y0 = s.py, t0 = performance.now();
    for (;;) {
      const k = Math.min(1, (performance.now() - t0) / ms);
      s.px = x0 + (x - x0) * k; s.py = y0 + (y - y0) * k;
      if (k >= 1) break;
      await raf();
    }
  }
  async function doMove(s, hex) {
    const path = C[s.t].fly ? [{ c: s.c, r: s.r }, hex] : pathTo(B.reach, hex);
    for (let i = 1; i < path.length; i++) {
      const p = hexPx(path[i].c, path[i].r);
      await tweenTo(s, p.x, p.y, C[s.t].fly ? 280 : 90);
    }
    s.c = hex.c; s.r = hex.r;
    const p = hexPx(s.c, s.r); s.px = p.x; s.py = p.y;
  }
  async function doMelee(s, e, spot) {
    if (spot.c !== s.c || spot.r !== s.r) await doMove(s, spot);
    hit(e, calcDmg(s, e, true), `${C[s.t].n} attacks`);
    await sleep(260);
    if (!e.dead && e.ret) {
      e.ret = false;
      hit(s, calcDmg(e, s, true), `${C[e.t].n} retaliates vs`);
      await sleep(260);
    }
  }
  async function doShoot(s, e) {
    s.ammo--;
    B.shot = { a: { c: s.c, r: s.r }, b: { c: e.c, r: e.r }, t0: performance.now() };
    await sleep(240);
    hit(e, calcDmg(s, e, false), `${C[s.t].n} shoots`);
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
    for (const s of alive()) { s.ret = true; s.waited = false; }
    B.queue = alive().sort((a, b) => speedOf(b) - speedOf(a) || a.side - b.side);
    B.waitQ = [];
    log(`— Round ${B.round} —`);
  }
  async function nextTurn() {
    if (B.over) return;
    let s = null;
    while (!s) {
      if (!B.queue.length) {
        if (B.waitQ.length) { B.queue = B.waitQ.sort((a, b) => speedOf(a) - speedOf(b)); B.waitQ = []; }
        else { newRound(); B.castUsed = false; }
      }
      const c = B.queue.shift();
      if (c && !c.dead) s = c;
    }
    B.cur = s; s.defb = false; B.spell = null;
    B.reach = computeReach(s);
    refreshButtons();
    if (s.side === 1 || B.auto) { B.input = false; await runAI(s); }
    else B.input = true;
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
    const s = B.cur, t = stackAt(h.c, h.r);
    if (B.spell) { castSpell(B.spell, t); return; }
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
  function castSpell(k, t) {
    const sp = SPELLS[k];
    if (!t || (sp.tgt === 'enemy') !== (t.side === 1)) return toast('Invalid target.');
    if (B.hero.mana < sp.cost) return toast('Not enough mana.');
    B.hero.mana -= sp.cost; B.castUsed = true; B.spell = null;
    const p = hexPx(t.c, t.r);
    if (k === 'arrow') hit(t, 10 * B.hero.sp + 10, 'Magic Arrow hits');
    else if (k === 'lightning') hit(t, 25 * B.hero.sp, 'Lightning Bolt hits');
    else {
      if (k === 'haste') t.haste = true; if (k === 'bless') t.bless = true; if (k === 'stone') t.stone = true;
      B.fx.push({ x: p.x, y: p.y - 20, txt: sp.i, col: '#fff', t0: performance.now() });
      log(`${sp.n} cast on ${C[t.t].n}.`);
    }
    if (k === 'haste') B.reach = computeReach(B.cur);
    refreshButtons();
    if (!checkEnd()) { /* spell does not end the turn */ }
  }
  function toast(t) { if (window.toast) window.toast(t); }

  function refreshButtons() {
    const mine = B.cur && B.cur.side === 0 && B.input;
    $('bWait').disabled = !mine || B.cur.waited;
    $('bDef').disabled = !mine;
    $('bSpell').disabled = !mine || B.castUsed || B.hero.mana < 5;
    $('bFlee').disabled = !B.canRetreat;
    $('bAuto').textContent = B.auto ? '⏸ Manual' : '⏩ Auto';
    $('bManaB').textContent = `🔷 ${B.hero.mana}${B.castUsed ? ' (cast used)' : ''}`;
    const list = $('spells'); list.classList.add('hide');
  }
  function openSpells() {
    const list = $('spells');
    list.innerHTML = '';
    for (const k in SPELLS) {
      const sp = SPELLS[k], b = document.createElement('button');
      b.textContent = `${sp.i} ${sp.n} (${sp.cost})`; b.title = sp.desc; b.disabled = B.hero.mana < sp.cost;
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
    $('bWait').onclick = () => B && B.cur && !B.cur.waited && playerAct(async () => { B.cur.waited = true; B.waitQ.push(B.cur); log(`${C[B.cur.t].n} waits.`); });
    $('bDef').onclick = () => B && playerAct(async () => { B.cur.defb = true; log(`${C[B.cur.t].n} defends.`); });
    $('bSpell').onclick = () => B && B.input && openSpells();
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
      if (input && B.reach.has(k) && !B.spell) { ctx.fillStyle = 'rgba(120,255,120,.22)'; ctx.fill(); }
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.stroke();
      if (B.obs.has(k)) { ctx.fillStyle = '#fff'; emoji(B.obs.get(k), p.x, p.y, 30); }
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
    const stacks = alive().sort((a, b) => a.py - b.py);
    for (const s of stacks) {
      const p = { x: s.px, y: s.py }, flash = now - (s.flash || 0) < 220;
      ctx.beginPath(); ctx.arc(p.x, p.y + 4, HR * 0.72, 0, 7);
      ctx.fillStyle = flash ? '#ff8a7a' : (s.side === 0 ? '#2a4f8a' : '#8a2a2a'); ctx.fill();
      ctx.lineWidth = s === B.cur ? 4 : 2; ctx.strokeStyle = s === B.cur ? '#ffd24a' : '#111'; ctx.stroke();
      ctx.fillStyle = '#fff'; emoji(C[s.t].i, p.x, p.y + 2, 30);
      const lab = String(s.n), w = Math.max(24, lab.length * 9 + 8);
      ctx.fillStyle = '#000c'; ctx.fillRect(p.x + 4, p.y + 14, w, 16);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(lab, p.x + 4 + w / 2, p.y + 23);
      let tags = ''; if (s.haste) tags += '💨'; if (s.bless) tags += '✨'; if (s.stone) tags += '🪨'; if (s.defb) tags += '🛡';
      if (tags) { ctx.font = '12px ' + FONT; ctx.fillText(tags, p.x, p.y - HR * 0.78); }
    }
    if (B.shot && now - B.shot.t0 < 260) {
      const a = hexPx(B.shot.a.c, B.shot.a.r), b = hexPx(B.shot.b.c, B.shot.b.r), k = (now - B.shot.t0) / 260;
      ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k); ctx.stroke();
    }
    B.fx = B.fx.filter(f => now - f.t0 < 1000);
    for (const f of B.fx) {
      const k = (now - f.t0) / 1000;
      ctx.globalAlpha = 1 - k; ctx.fillStyle = f.col; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeText(f.txt, f.x, f.y - k * 30); ctx.fillText(f.txt, f.x, f.y - k * 30);
      ctx.globalAlpha = 1;
    }
    drawQueue();
    drawInfo(hov);
    requestAnimationFrame(draw);
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
      ctx.fillStyle = '#fff'; emoji(C[s.t].i, x, y + 1, 20);
    });
  }
  function drawInfo(h) {
    const s = h && stackAt(h.c, h.r) || B.cur;
    ctx.fillStyle = '#000b'; ctx.fillRect(0, 596, 960, 44);
    if (!s || s.dead) return;
    const c = C[s.t];
    ctx.fillStyle = '#f3e7bd'; ctx.font = '14px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`${c.i} ${s.n} ${c.n}   Att ${attackOf(s)}  Def ${defenceOf(s)}  Dmg ${c.lo}-${c.hi}  HP ${s.hp}/${c.hp}  Spd ${speedOf(s)}${c.shoot ? `  Ammo ${s.ammo}` : ''}${c.fly ? '  Flying' : ''}`, 14, 612);
    if (B.cur && B.cur.side === 0 && h && stackAt(h.c, h.r) && stackAt(h.c, h.r).side === 1 && B.input) {
      const e = stackAt(h.c, h.r), a = B.cur;
      const d = calcDmg(a, e, !canShoot(a), true), kills = Math.floor(Math.min(d, totalHp(e)) / C[e.t].hp);
      ctx.fillStyle = '#ffb3a8'; ctx.fillText(`${canShoot(a) ? 'Shoot' : 'Attack'}: ~${d} dmg (~${kills} kills)`, 14, 630);
    }
  }

  // ------- setup / finish -------
  function finish(win, fled) {
    if (B.over) return;
    B.over = true;
    const surv = B.armyIn.map((a, i) => { if (!a) return null; const st = B.stacks.find(s => s.side === 0 && s.slot === i); return st && !st.dead ? st.n : 0; });
    const lost = B.armyIn.map((a, i) => a ? a.n - (surv[i] || 0) : 0).reduce((p, v) => p + v, 0);
    const res = { win, fled, survivors: surv, xp: win ? Math.floor(B.xp) : 0, mana: B.hero.mana };
    setTimeout(async () => {
      B.canRetreat = false;
      const html = fled ? '<h2>🏳️ Retreat</h2><p>Your army fled the field.</p>'
        : win ? `<h2>🏆 Victory!</h2><p>Your forces lost <b>${lost}</b> creatures.</p><p>Experience gained: <b>${res.xp}</b></p>`
          : '<h2>💀 Defeat</h2><p>Your army has been destroyed. The hero retreats to town.</p>';
      await window.showModal(html, ['Continue']);
      document.body.classList.remove('inbattle');
      B.resolve(res);
      B = null;
    }, 400);
  }

  function run(opts) {
    cv = $('bat'); ctx = cv.getContext('2d'); bind();
    return new Promise(resolve => {
      const hero = { att: opts.hero.att, def: opts.hero.def, sp: opts.hero.sp, mana: opts.hero.mana };
      B = { stacks: [], obs: new Map(), queue: [], waitQ: [], cur: null, round: 0, reach: new Map(), busy: false, input: false, auto: false, over: false,
        spell: null, castUsed: false, hover: null, fx: [], shot: null, xp: 0, hero, eStats: opts.eStats || { att: 0, def: 0 },
        armyIn: opts.army.map(a => a && { ...a }), canRetreat: opts.canRetreat !== false, resolve };
      const mk = (side, list, col) => {
        const items = list.map((a, slot) => a && { a, slot }).filter(Boolean).slice(0, 7);
        items.forEach((it, k) => {
          const r = Math.round((k + 0.5) * BH / items.length - 0.5), c = side === 0 ? 0 : BW - 1;
          const p = hexPx(c, r);
          B.stacks.push({ t: it.a.t, n: it.a.n, hp: C[it.a.t].hp, side, c, r, slot: it.slot, ammo: C[it.a.t].shoot || 0, px: p.x, py: p.y, ret: true });
        });
      };
      mk(0, opts.army); mk(1, opts.enemy);
      const icons = ['🪨', '🌲', '🪵'];
      for (let i = 0, tries = 0; i < 11 && tries < 100; tries++) {
        const c = 3 + Math.floor(Math.random() * 9), r = Math.floor(Math.random() * BH);
        if (B.obs.has(key(c, r)) || stackAt(c, r)) continue;
        B.obs.set(key(c, r), icons[i % 3]); i++;
      }
      $('blog').innerHTML = ''; $('btitle').textContent = opts.title || 'Battle';
      document.body.classList.add('inbattle');
      log('Battle begins!');
      refreshButtons();
      requestAnimationFrame(draw);
      nextTurn();
    });
  }
  return { run };
})();
