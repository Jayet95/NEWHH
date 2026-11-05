'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const TS = 32, VW = 960, VH = 640, FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
  const SAVE = 'h3js_save_v2';
  const MOVE_PER_DAY = 1700;
  const cmap = $('map'), cx = cmap.getContext('2d'), mini = $('mini'), mx = mini.getContext('2d');
  let G = null, cam = { x: 0, y: 0 }, hover = null, busy = false, selSlot = -1, terrain = null, running = false;

  // ---------- helpers ----------
  window.toast = (t) => {
    const d = document.createElement('div'); d.textContent = t; $('toast').appendChild(d);
    setTimeout(() => d.remove(), 2800);
  };
  window.showModal = (html, buttons = ['OK']) => new Promise(res => {
    $('mbox').innerHTML = html + '<div class="mb"></div>';
    buttons.forEach((b, i) => {
      const el = document.createElement('button'); el.textContent = b; if (i === 0) el.className = 'primary';
      el.onclick = () => { $('modal').classList.add('hide'); res(i); };
      $('mbox').lastChild.appendChild(el);
    });
    $('modal').classList.remove('hide');
  });
  const town = () => G.objs.find(o => o.t === 'town' && o.owner === 0);
  const eTown = () => G.objs.find(o => o.t === 'town' && o.owner === 1);
  const armyCount = () => G.hero.army.reduce((s, a) => s + (a ? a.n : 0), 0);
  const maxMana = () => G.hero.kn * 10;
  const need = (l) => 150 * l * l;
  const heroAtTown = () => G.hero.x === town().x && G.hero.y === town().y;
  const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

  function addToArmy(t, n) {
    const a = G.hero.army;
    let i = a.findIndex(s => s && s.t === t);
    if (i < 0) i = a.findIndex(s => !s);
    if (i < 0) return false;
    if (a[i]) a[i].n += n; else a[i] = { t, n };
    return true;
  }

  // ---------- new game / save ----------
  function newGame() {
    const seed = Math.floor(Math.random() * 1e9), m = genMap(seed);
    G = { seed, W: m.W, H: m.H, tiles: m.tiles, zone: m.zone, objs: m.objs, day: 1, over: false, path: null,
      res: { gold: 10000, wood: 20, ore: 20, gems: 10 },
      hero: { name: 'Sir Roland', x: m.P.x, y: m.P.y, att: 2, def: 2, sp: 3, kn: 4, lvl: 1, xp: 0, mana: 40, move: MOVE_PER_DAY,
        army: [{ t: 'pikeman', n: 20 }, { t: 'archer', n: 10 }, { t: 'griffin', n: 5 }, null, null, null, null] },
      eh: null, ehTimer: 0, ehWave: 0 };
    const t = town(); t.b = { 1: 1, 2: 1, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, hall: 0 }; t.avail = { 1: 14, 2: 9 };
    reindex(G); buildTerrain(); centerOn(G.hero.x, G.hero.y);
    renderAll(); toast('Capture the Necropolis in the NE to win. Good luck!');
  }
  function save() {
    try { localStorage.setItem(SAVE, JSON.stringify(G, (k, v) => k === 'omap' ? undefined : v)); toast('Game saved.'); } catch (e) { toast('Save failed.'); }
  }
  function load() {
    try {
      const s = localStorage.getItem(SAVE); if (!s) return false;
      G = JSON.parse(s); if (!G.zone) return false; G.path = null; reindex(G); buildTerrain(); centerOn(G.hero.x, G.hero.y); renderAll(); return true;
    } catch (e) { return false; }
  }

  // ---------- terrain rendering ----------
  function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function buildTerrain() {
    terrain = document.createElement('canvas'); terrain.width = G.W * TS; terrain.height = G.H * TS;
    const c = terrain.getContext('2d');
    for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) {
      const t = G.tiles[y][x], h = hash(x, y), px = x * TS, py = y * TS;
      const base = { [T.GRASS]: [74, 124, 58], [T.FOREST]: [52, 98, 46], [T.MOUNT]: [96, 90, 84], [T.WATER]: [40, 92, 146], [T.ROAD]: [168, 138, 90], [T.SAND]: [200, 178, 108] }[t];
      const v = (h - 0.5) * 16;
      c.fillStyle = `rgb(${base[0] + v},${base[1] + v},${base[2] + v})`; c.fillRect(px, py, TS, TS);
      if (t === T.WATER) { c.strokeStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.moveTo(px + 4, py + 10 + h * 8); c.quadraticCurveTo(px + 12, py + 4 + h * 8, px + 20, py + 10 + h * 8); c.stroke(); }
      if (t === T.GRASS && h > 0.8) { c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(px + h * 20, py + h * 24, 2, 2); }
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `26px ${FONT}`;
      if (t === T.FOREST) c.fillText('🌲', px + 16, py + 17);
      if (t === T.MOUNT) c.fillText('⛰️', px + 16, py + 17);
    }
  }
  function centerOn(x, y) {
    cam.x = Math.max(0, Math.min(G.W * TS - VW, x * TS + TS / 2 - VW / 2));
    cam.y = Math.max(0, Math.min(G.H * TS - VH, y * TS + TS / 2 - VH / 2));
  }

  function objIcon(o) {
    switch (o.t) {
      case 'town': return '🏰';
      case 'fort': return '🏯';
      case 'mine': return { gold: '💰', wood: '🪵', ore: '⛏️', gems: '💎' }[o.kind];
      case 'pile': return RES_ICON[o.kind];
      case 'chest': return '🧰';
      case 'art': return ARTIFACTS[o.art].i;
      case 'monster': return C[o.guard[0].t].i;
    }
  }
  function draw() {
    if (!G) return;
    cx.fillStyle = '#000'; cx.fillRect(0, 0, VW, VH);
    cx.drawImage(terrain, cam.x, cam.y, VW, VH, 0, 0, VW, VH);
    const x0 = Math.floor(cam.x / TS), y0 = Math.floor(cam.y / TS);
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    // territory overlay
    const ZC = { 0: 'rgba(60,130,255,.20)', 1: 'rgba(230,60,60,.20)' };
    cx.lineWidth = 2; cx.strokeStyle = 'rgba(255,255,255,.45)';
    const zo = {}; for (const o of G.objs) if (o.t === 'fort' || o.t === 'town') zo[o.zone] = o.owner;
    for (let y = Math.max(0, y0); y < Math.min(G.H, y0 + 22); y++) for (let x = Math.max(0, x0); x < Math.min(G.W, x0 + 31); x++) {
      const z = G.zone[y][x], ow = zo[z], px = x * TS - cam.x, py = y * TS - cam.y;
      if (ow !== null && G.tiles[y][x] !== T.WATER) { cx.fillStyle = ZC[ow]; cx.fillRect(px, py, TS, TS); }
      if (x + 1 < G.W && G.zone[y][x + 1] !== z) { cx.beginPath(); cx.moveTo(px + TS, py); cx.lineTo(px + TS, py + TS); cx.stroke(); }
      if (y + 1 < G.H && G.zone[y + 1][x] !== z) { cx.beginPath(); cx.moveTo(px, py + TS); cx.lineTo(px + TS, py + TS); cx.stroke(); }
    }
    // path preview
    if (G.path) {
      let left = G.hero.move;
      G.path.forEach((s, i) => {
        left -= s.cost; const ok = left >= 0;
        const px = s.x * TS - cam.x + TS / 2, py = s.y * TS - cam.y + TS / 2;
        cx.beginPath(); cx.arc(px, py, i === G.path.length - 1 ? 7 : 4, 0, 7);
        cx.fillStyle = ok ? 'rgba(140,255,140,.9)' : 'rgba(255,110,90,.9)'; cx.fill();
      });
    }
    for (const o of G.objs) {
      if (o.x < x0 - 1 || o.x > x0 + 31 || o.y < y0 - 1 || o.y > y0 + 21) continue;
      const px = o.x * TS - cam.x + TS / 2, py = o.y * TS - cam.y + TS / 2;
      if (o.t === 'monster' || o.t === 'art' || o.t === 'mine') {
        cx.beginPath(); cx.arc(px, py, 15, 0, 7);
        cx.fillStyle = o.t === 'monster' ? 'rgba(90,10,10,.65)' : 'rgba(0,0,0,.45)'; cx.fill();
      }
      cx.font = `${o.t === 'town' ? 40 : o.t === 'fort' ? 34 : 26}px ${FONT}`; cx.fillStyle = '#fff';
      cx.fillText(objIcon(o), px, py + 1);
      if (o.t === 'fort') {
        cx.beginPath(); cx.arc(px + 14, py - 16, 6, 0, 7); cx.fillStyle = o.owner === 0 ? '#3a8aff' : o.owner === 1 ? '#e03a3a' : '#999'; cx.fill(); cx.strokeStyle = '#000'; cx.lineWidth = 1; cx.stroke();
        const gn = o.garrison.reduce((s, a) => s + (a ? a.n : 0), 0);
        if (o.owner === 0 && gn) { cx.font = 'bold 11px sans-serif'; cx.fillStyle = '#000b'; cx.fillRect(px - 14, py + 10, 28, 13); cx.fillStyle = '#fff'; cx.fillText(gn, px, py + 17); }
      }
      if (o.t === 'mine') { cx.beginPath(); cx.arc(px + 12, py - 12, 5, 0, 7); cx.fillStyle = o.owner === 0 ? '#3a8aff' : '#999'; cx.fill(); cx.strokeStyle = '#000'; cx.stroke(); }
      if (o.t === 'town') { cx.beginPath(); cx.arc(px + 16, py - 18, 6, 0, 7); cx.fillStyle = o.owner === 0 ? '#3a8aff' : '#e03a3a'; cx.fill(); cx.strokeStyle = '#000'; cx.stroke(); }
    }
    if (G.eh) {
      const px = G.eh.x * TS - cam.x + TS / 2, py = G.eh.y * TS - cam.y + TS / 2;
      cx.beginPath(); cx.arc(px, py, 15, 0, 7); cx.fillStyle = '#a02020'; cx.fill(); cx.strokeStyle = '#000'; cx.lineWidth = 2; cx.stroke();
      cx.font = `24px ${FONT}`; cx.fillStyle = '#fff'; cx.fillText('🦹', px, py + 1);
    }
    {
      const px = G.hero.x * TS - cam.x + TS / 2, py = G.hero.y * TS - cam.y + TS / 2;
      cx.beginPath(); cx.arc(px, py, 15, 0, 7); cx.fillStyle = '#2a5fb0'; cx.fill(); cx.strokeStyle = '#ffd24a'; cx.lineWidth = 2; cx.stroke();
      cx.font = `24px ${FONT}`; cx.fillStyle = '#fff'; cx.fillText('🏇', px, py + 1);
    }
    if (hover) { cx.strokeStyle = 'rgba(255,255,255,.8)'; cx.lineWidth = 2; cx.strokeRect(hover.x * TS - cam.x + 1, hover.y * TS - cam.y + 1, TS - 2, TS - 2); }
    drawMini();
  }
  const MC = { [T.GRASS]: '#4a7c3a', [T.FOREST]: '#2f5a2a', [T.MOUNT]: '#666', [T.WATER]: '#285c92', [T.ROAD]: '#a88a5a', [T.SAND]: '#c8b26c' };
  function drawMini() {
    const k = 6;
    const zo = {}; for (const o of G.objs) if (o.t === 'fort' || o.t === 'town') zo[o.zone] = o.owner;
    for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) {
      mx.fillStyle = MC[G.tiles[y][x]]; mx.fillRect(x * k, y * k, k, k);
      const ow = zo[G.zone[y][x]];
      if (ow !== null && ow !== undefined) { mx.fillStyle = ow === 0 ? 'rgba(60,130,255,.35)' : 'rgba(230,60,60,.35)'; mx.fillRect(x * k, y * k, k, k); }
    }
    for (const o of G.objs) { mx.fillStyle = o.t === 'fort' ? (o.owner === 0 ? '#9cf' : o.owner === 1 ? '#f88' : '#ffa') : o.t === 'town' ? (o.owner === 0 ? '#4af' : '#f44') : o.t === 'monster' ? '#a33' : o.t === 'mine' ? (o.owner === 0 ? '#4af' : '#ddd') : '#ee6'; mx.fillRect(o.x * k, o.y * k, k, k); }
    if (G.eh) { mx.fillStyle = '#f0f'; mx.fillRect(G.eh.x * k - 1, G.eh.y * k - 1, k + 2, k + 2); }
    mx.fillStyle = '#fff'; mx.fillRect(G.hero.x * k - 1, G.hero.y * k - 1, k + 2, k + 2);
    mx.strokeStyle = '#fff'; mx.lineWidth = 1; mx.strokeRect(cam.x / TS * k, cam.y / TS * k, VW / TS * k, VH / TS * k);
  }
  function loop() { if (G && !document.body.classList.contains('inbattle')) draw(); requestAnimationFrame(loop); }

  // ---------- UI panels ----------
  function renderAll() {
    const r = G.res;
    $('res').innerHTML = RES.map(k => `<span title="${k}">${RES_ICON[k]} ${r[k]}</span>`).join('');
    const d = G.day - 1;
    $('date').textContent = `Month ${Math.floor(d / 28) + 1} · Week ${Math.floor(d % 28 / 7) + 1} · Day ${d % 7 + 1}`;
    const h = G.hero;
    $('hero').innerHTML = `<h3>🏇 ${h.name} — Level ${h.lvl}</h3>
      <div class="stats"><span>⚔️ Attack ${h.att}</span><span>🛡 Defense ${h.def}</span><span>✨ Spell Pow ${h.sp}</span><span>📚 Knowledge ${h.kn}</span></div>
      <div class="small">Movement ${h.move}/${MOVE_PER_DAY}</div><div class="bar mv"><i style="width:${h.move / MOVE_PER_DAY * 100}%"></i></div>
      <div class="small">Mana ${h.mana}/${maxMana()}</div><div class="bar mn"><i style="width:${h.mana / maxMana() * 100}%"></i></div>
      <div class="small">XP ${h.xp}/${need(h.lvl)}</div><div class="bar xp"><i style="width:${Math.min(100, h.xp / need(h.lvl) * 100)}%"></i></div>`;
    const zs = G.objs.filter(o => o.t === 'fort' || o.t === 'town').sort((a, b) => a.zone - b.zone);
    const mineIncome = G.objs.filter(o => o.t === 'mine' && o.owner === 0 && zoneOwner(G, G.zone[o.y][o.x]) === 0).length;
    $('terr').innerHTML = `<h3>🗺 Territory — ${zs.filter(z => z.owner === 0).length}/${zs.length} zones</h3>` +
      zs.map(z => { const gn = z.garrison ? z.garrison.reduce((s, a) => s + (a ? a.n : 0), 0) : 0;
        return `<div class="zrow"><span class="zdot z${z.owner === 0 ? 'p' : z.owner === 1 ? 'e' : 'n'}"></span>${z.name}${z.t === 'fort' && z.owner === 0 ? ` <span class="small">garrison ${gn}</span>` : ''}</div>`; }).join('') +
      `<div class="small">Paying mines: ${mineIncome}</div>`;
    const el = $('army'); el.innerHTML = '';
    h.army.forEach((a, i) => {
      const b = document.createElement('button');
      b.className = 'slot' + (a ? '' : ' empty') + (i === selSlot ? ' sel' : '');
      if (a) { const c = C[a.t]; b.innerHTML = `${c.i}<small>${a.n}</small>`; b.title = `${c.n}\nAtt ${c.a} Def ${c.d} Dmg ${c.lo}-${c.hi} HP ${c.hp} Spd ${c.s}${c.shoot ? '\nShooter' : ''}${c.fly ? '\nFlying' : ''}`; }
      b.onclick = () => slotClick(i);
      el.appendChild(b);
    });
    const sw = document.createElement('div'); sw.className = 'small'; sw.style.gridColumn = '1/-1'; sw.textContent = 'Click two slots to swap / merge.'; el.appendChild(sw);
    $('bTown').disabled = false;
  }
  function slotClick(i) {
    if (busy) return;
    const a = G.hero.army;
    if (selSlot < 0) { if (a[i]) selSlot = i; }
    else {
      if (selSlot !== i) {
        if (a[selSlot] && a[i] && a[selSlot].t === a[i].t) { a[i].n += a[selSlot].n; a[selSlot] = null; }
        else [a[selSlot], a[i]] = [a[i], a[selSlot]];
      }
      selSlot = -1;
    }
    renderAll();
  }

  // ---------- map input ----------
  function tileFromEvent(ev) {
    const r = cmap.getBoundingClientRect();
    const px = (ev.clientX - r.left) * VW / r.width + cam.x, py = (ev.clientY - r.top) * VH / r.height + cam.y;
    const x = Math.floor(px / TS), y = Math.floor(py / TS);
    return x >= 0 && y >= 0 && x < G.W && y < G.H ? { x, y } : null;
  }
  function describe(x, y) {
    if (G.eh && G.eh.x === x && G.eh.y === y) return `<b>${G.eh.name}</b> (enemy hero)<br>${armyList(G.eh.army)}`;
    if (G.hero.x === x && G.hero.y === y) return `<b>${G.hero.name}</b> (you)`;
    const o = objAt(G, x, y);
    if (!o) return ['Grass', 'Forest (impassable)', 'Mountains (impassable)', 'Water (impassable)', 'Road (fast)', 'Sand (slow)'][G.tiles[y][x]];
    const g = o.guard && o.guard.length ? `<br>Guarded by: ${armyList(o.guard, true)}` : '';
    switch (o.t) {
      case 'town': return o.owner === 0 ? `<b>${o.name}</b> — your castle` : `<b>${o.name}</b> — enemy stronghold${g}`;
      case 'mine': {
        const supplied = o.owner === 0 && zoneOwner(G, G.zone[o.y][o.x]) === 0;
        return `<b>${o.kind[0].toUpperCase() + o.kind.slice(1)} mine</b> (${o.owner === 0 ? 'yours' : 'unclaimed'}) +${o.kind === 'gold' ? 1000 : o.kind === 'gems' ? 1 : 2}/day` +
          (o.owner === 0 && !supplied ? '<br>⚠ Pays nothing: you do not hold this zone' : o.owner !== 0 ? '<br>Pays only if you also hold its zone' : '') + g;
      }
      case 'fort': {
        const gn = o.garrison.reduce((s, a) => s + (a ? a.n : 0), 0);
        return `<b>${o.name}</b> — ${o.owner === 0 ? `your fort (garrison ${gn})` : o.owner === 1 ? `held by the enemy${gn ? ' — garrison: ' + armyList(o.garrison, true) : ''}` : 'neutral zone stronghold'}<br>Holding it: +${FORT_INCOME} 🪙/day and zone mine income${o.owner === null ? g : ''}`;
      }
      case 'pile': return `${RES_ICON[o.kind]} ${o.amt} ${o.kind}`;
      case 'chest': return 'Treasure chest';
      case 'art': return `<b>${ARTIFACTS[o.art].n}</b> (+${ARTIFACTS[o.art].v} ${ARTIFACTS[o.art].stat})${g}`;
      case 'monster': return `Monsters: ${armyList(o.guard, true)}`;
    }
  }
  function armyList(arr, vague) { return arr.filter(Boolean).map(a => vague ? `${groupLabel(a.n)} ${C[a.t].n}s` : `${a.n} ${C[a.t].n}`).join(', '); }
  cmap.addEventListener('mousemove', (ev) => {
    if (!G) return;
    hover = tileFromEvent(ev);
    const tip = $('tip');
    if (hover) {
      tip.innerHTML = describe(hover.x, hover.y);
      const r = $('stage').getBoundingClientRect();
      tip.style.left = Math.min(ev.clientX - r.left + 14, r.width - 270) + 'px'; tip.style.top = (ev.clientY - r.top + 14) + 'px';
      tip.classList.remove('hide');
    } else tip.classList.add('hide');
  });
  cmap.addEventListener('mouseleave', () => { hover = null; $('tip').classList.add('hide'); });
  cmap.addEventListener('click', (ev) => {
    if (!G || busy || G.over) return;
    const t = tileFromEvent(ev); if (!t) return;
    if (t.x === G.hero.x && t.y === G.hero.y) {
      const o = objAt(G, t.x, t.y);
      if (heroAtTown()) openTown(); else if (o && o.t === 'fort' && o.owner === 0) openFort(o);
      return;
    }
    const last = G.path && G.path[G.path.length - 1];
    if (last && last.x === t.x && last.y === t.y) return moveHero();
    const p = findPath(G, G.hero.x, G.hero.y, t.x, t.y);
    if (!p || !p.length) { G.path = null; return toast("Can't reach there."); }
    G.path = p;
  });
  mini.addEventListener('click', (ev) => {
    if (!G) return; const r = mini.getBoundingClientRect();
    centerOn((ev.clientX - r.left) / r.width * G.W, (ev.clientY - r.top) / r.height * G.H);
  });
  document.addEventListener('keydown', (e) => {
    if (!G || document.body.classList.contains('inbattle') || !$('modal').classList.contains('hide') || !$('title').classList.contains('hide')) return;
    const k = e.key.toLowerCase(), s = TS * 2;
    if (k === 'arrowleft' || k === 'a') cam.x = Math.max(0, cam.x - s);
    else if (k === 'arrowright' || k === 'd') cam.x = Math.min(G.W * TS - VW, cam.x + s);
    else if (k === 'arrowup' || k === 'w') cam.y = Math.max(0, cam.y - s);
    else if (k === 'arrowdown' || k === 's') cam.y = Math.min(G.H * TS - VH, cam.y + s);
    else if (k === 'e') endTurn();
    else if (k === 't') openTown();
    else if (k === 'h') centerOn(G.hero.x, G.hero.y);
    else if (k === ' ' && G.path) { e.preventDefault(); moveHero(); }
  });

  // ---------- hero movement & interaction ----------
  async function moveHero() {
    if (busy || !G.path) return;
    busy = true;
    const h = G.hero; let path = G.path; G.path = null;
    for (let i = 0; i < path.length; i++) {
      const s = path[i];
      if (s.cost > h.move) { G.path = path.slice(i); toast('Out of movement — end turn to continue.'); break; }
      h.move -= s.cost; h.x = s.x; h.y = s.y; centerOn(h.x, h.y); renderAll();
      await sleep(70);
      const last = i === path.length - 1, o = objAt(G, s.x, s.y);
      if (G.eh && G.eh.x === s.x && G.eh.y === s.y) { await fightEnemyHero(true); break; }
      if (o && (o.t === 'pile' || o.t === 'chest')) { collect(o); continue; }
      if (o && last) { await interact(o); break; }
    }
    busy = false; renderAll();
  }
  function collect(o) {
    if (o.t === 'pile') { G.res[o.kind] += o.amt; toast(`Collected ${o.amt} ${RES_ICON[o.kind]} ${o.kind}.`); }
    else { G.res.gold += o.gold; toast(`The chest holds ${o.gold} 🪙 gold!`); }
    G.objs.splice(G.objs.indexOf(o), 1); reindex(G);
  }
  async function interact(o) {
    if (o.t === 'town') {
      if (o.owner === 0) { G.hero.mana = maxMana(); return openTown(); }
      const win = await fight(o.guard, { att: 6, def: 6 }, `Assault on ${o.name}`);
      if (win) return endGame(true);
      return;
    }
    if (o.t === 'fort') {
      if (o.owner === 0) return openFort(o);
      const army = o.owner === 1 ? o.garrison.filter(Boolean) : o.guard;
      if (army.length && !(await fight(army, { att: o.owner === 1 ? 4 : 0, def: o.owner === 1 ? 4 : 0 }, `Assault on ${o.name}`))) return;
      o.owner = 0; o.guard = []; o.garrison = [null, null, null, null, null, null, null];
      renderAll();
      await showModal(`<h2>🏯 ${o.name} captured!</h2><p>The zone is yours: +${FORT_INCOME} 🪙/day, mine income in the zone, and +${MILITIA} militia per week. Station troops here to defend it from the enemy hero.</p>`);
      return openFort(o);
    }
    if (o.t === 'mine') {
      if (o.owner === 0) return toast('This mine is already yours.');
      if (o.guard && o.guard.length) { if (!(await fight(o.guard, { att: 0, def: 0 }, 'Mine guardians'))) return; o.guard = []; }
      o.owner = 0; return toast(`You now own the ${o.kind} mine!`);
    }
    if (o.t === 'art') {
      if (o.guard && o.guard.length) { if (!(await fight(o.guard, { att: 0, def: 0 }, 'Artifact guardians'))) return; o.guard = []; }
      const a = ARTIFACTS[o.art]; G.hero[a.stat] += a.v;
      G.objs.splice(G.objs.indexOf(o), 1); reindex(G);
      return showModal(`<h2>${a.i} ${a.n}</h2><p>Found! +${a.v} ${a.stat === 'att' ? 'Attack' : a.stat === 'def' ? 'Defense' : a.stat === 'sp' ? 'Spell Power' : 'Knowledge'}.</p>`);
    }
    if (o.t === 'monster') {
      if (await fight(o.guard, { att: 0, def: 0 }, 'Wandering monsters')) { G.objs.splice(G.objs.indexOf(o), 1); reindex(G); }
    }
  }
  async function fight(guard, eStats, title) {
    if (!armyCount()) { toast('Your hero has no army! Recruit in town first.'); return false; }
    const h = G.hero;
    const res = await Battle.run({ hero: h, army: h.army, enemy: guard.map(a => ({ ...a })), eStats, title, canRetreat: true });
    h.mana = res.mana;
    if (res.win) {
      res.survivors.forEach((n, i) => { if (h.army[i]) { if (n > 0) h.army[i].n = n; else h.army[i] = null; } });
      await gainXp(res.xp);
    } else {
      h.army = [null, null, null, null, null, null, null];
      h.x = town().x; h.y = town().y; G.path = null; centerOn(h.x, h.y);
      toast('Your hero returns to the castle with no army. Recruit new troops!');
    }
    renderAll();
    return res.win;
  }
  async function gainXp(xp) {
    const h = G.hero; h.xp += xp; const msgs = [];
    while (h.xp >= need(h.lvl)) {
      h.xp -= need(h.lvl); h.lvl++;
      const r = Math.random(), st = r < .3 ? 'att' : r < .6 ? 'def' : r < .8 ? 'sp' : 'kn';
      h[st]++; msgs.push(`Level ${h.lvl}! +1 ${{ att: 'Attack', def: 'Defense', sp: 'Spell Power', kn: 'Knowledge' }[st]}`);
    }
    if (msgs.length) await showModal(`<h2>⭐ Level Up</h2><p>${msgs.join('<br>')}</p>`);
  }
  async function fightEnemyHero(playerAttacks) {
    const e = G.eh;
    if (!armyCount()) { await endGame(false, 'Your hero had no army to defend the realm.'); return false; }
    const atTown = heroAtTown();
    const win = await fight(e.army, { att: e.att, def: e.def }, `${e.name}'s army`);
    if (win) { G.eh = null; G.ehTimer = 5; toast('Enemy hero defeated! He will return in time...'); return true; }
    if (atTown) { await endGame(false, 'Your castle has fallen to the enemy hero.'); }
    return false;
  }

  // ---------- town ----------
  function openTown() {
    const t = town(), h = G.hero, here = heroAtTown();
    let html = `<h2>🏰 ${t.name}</h2><div class="small">${here ? 'Your hero is in town — recruits join the army.' : '⚠ Your hero is away; return to the castle to recruit.'}</div>`;
    CASTLE_TIERS.forEach((id, i) => {
      const tier = i + 1, c = C[id], built = t.b[tier], av = t.avail[tier] || 0;
      html += `<div class="trow"><div class="ic">${c.i}</div>
        <div><b>${c.n}</b> <span class="small">Att ${c.a} Def ${c.d} Dmg ${c.lo}-${c.hi} HP ${c.hp} Spd ${c.s}${c.shoot ? ' · Shooter' : ''}${c.fly ? ' · Flying' : ''}</span><br>
        <span class="small">${built ? `Available: <b>${av}</b> · ${fmtCost(c.cost)} each · +${c.gr}/week` : `Dwelling not built — ${fmtCost(DWELL_COST[tier])}`}</span></div>
        <div class="acts">${built
          ? `<input type="number" min="1" max="${av}" value="${av}" id="n${tier}"><button data-buy="${tier}">Recruit</button>`
          : `<button data-build="${tier}">Build</button>`}</div></div>`;
    });
    html += `<div class="trow"><div class="ic">🏛️</div><div><b>Town Hall</b><br><span class="small">${t.b.hall ? `Built: +${HALL_INCOME} 🪙/day` : `+${HALL_INCOME} 🪙 daily — ${fmtCost(HALL_COST)}`}</span></div>
      <div class="acts">${t.b.hall ? '' : '<button data-build="hall">Build</button>'}</div></div>
      <div class="small" style="margin-top:8px">${RES.map(k => RES_ICON[k] + ' ' + G.res[k]).join('  ')}</div>
      <div class="mb"><button class="primary" id="tClose">Leave town</button></div>`;
    $('mbox').innerHTML = html; $('modal').classList.remove('hide');
    $('tClose').onclick = () => { $('modal').classList.add('hide'); renderAll(); };
    $('mbox').querySelectorAll('[data-build]').forEach(b => b.onclick = () => {
      const k = b.dataset.build, cost = k === 'hall' ? HALL_COST : DWELL_COST[+k];
      if (!canAfford(G.res, cost)) return toast('Not enough resources.');
      pay(G.res, cost); t.b[k] = 1;
      if (k !== 'hall') t.avail[k] = C[CASTLE_TIERS[+k - 1]].gr;
      openTown(); renderAll();
    });
    $('mbox').querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
      const tier = +b.dataset.buy, c = C[CASTLE_TIERS[tier - 1]];
      if (!here) return toast('Your hero must be in the castle.');
      let n = Math.min(parseInt($('n' + tier).value) || 0, t.avail[tier] || 0);
      while (n > 0 && !canAfford(G.res, Object.fromEntries(Object.entries(c.cost).map(([k, v]) => [k, v * n])))) n--;
      if (n <= 0) return toast('Cannot recruit (resources or availability).');
      if (!addToArmy(CASTLE_TIERS[tier - 1], n)) return toast('No free army slot.');
      pay(G.res, c.cost, n); t.avail[tier] -= n; toast(`Recruited ${n} ${c.n}${n > 1 ? 's' : ''}.`);
      openTown(); renderAll();
    });
  }

  // ---------- forts & garrisons ----------
  function openFort(f) {
    let sel = null;
    const here = G.hero.x === f.x && G.hero.y === f.y;
    const render = () => {
      const row = (arr, rk) => arr.map((a, i) => `<button class="slot${a ? '' : ' empty'}${sel && sel.r === rk && sel.i === i ? ' sel' : ''}" data-r="${rk}" data-i="${i}">${a ? `${C[a.t].i}<small>${a.n}</small>` : ''}</button>`).join('');
      $('mbox').innerHTML = `<h2>🏯 ${f.name}</h2>
        <div class="small">+${FORT_INCOME} 🪙/day · zone mine income · +${MILITIA} militia/week · the garrison fights enemy heroes with +3 Defense</div>
        <h4>Garrison</h4><div class="armyrow">${row(f.garrison, 'g')}</div>
        <h4>Hero army ${here ? '' : '(hero is not here — only garrison shown for reference)'}</h4><div class="armyrow">${row(G.hero.army, 'h')}</div>
        <div class="small">Click a slot, then another: move / merge / swap. ${here ? '' : 'Visit the fort with your hero to transfer troops.'}</div>
        <div class="mb"><button class="primary" id="fClose">Close</button></div>`;
      $('fClose').onclick = () => { $('modal').classList.add('hide'); renderAll(); };
      $('mbox').querySelectorAll('.slot').forEach(b => b.onclick = () => {
        if (!here) return toast('Your hero must be at the fort.');
        const r = b.dataset.r, i = +b.dataset.i, arr = (rr) => rr === 'g' ? f.garrison : G.hero.army;
        if (!sel) { if (arr(r)[i]) sel = { r, i }; }
        else {
          if (!(sel.r === r && sel.i === i)) {
            const A = arr(sel.r), B = arr(r);
            if (A[sel.i] && B[i] && A[sel.i].t === B[i].t) { B[i].n += A[sel.i].n; A[sel.i] = null; }
            else { const tmp = A[sel.i]; A[sel.i] = B[i]; B[i] = tmp; }
          }
          sel = null;
        }
        render();
      });
    };
    render(); $('modal').classList.remove('hide');
  }
  async function defendFort(f) {
    const e = G.eh, gar = f.garrison;
    const res = await Battle.run({ hero: { att: 0, def: 3, sp: 0, mana: 0 }, army: gar, enemy: e.army.map(a => ({ ...a })), eStats: { att: e.att, def: e.def }, title: `Defending ${f.name}`, canRetreat: false });
    res.survivors.forEach((n, i) => { if (gar[i]) { if (n > 0) gar[i].n = n; else gar[i] = null; } });
    if (res.win) { G.eh = null; G.ehTimer = 4; toast(`${f.name} held! The enemy hero is slain.`); return true; }
    f.owner = 1; f.garrison = [{ t: 'skeleton', n: 10 }, null, null, null, null, null, null];
    await showModal(`<h2>🏯 ${f.name} has fallen!</h2><p>The enemy now holds this zone. Retake it by defeating its garrison.</p>`);
    return false;
  }

  // ---------- turn / day ----------
  function spawnEnemyHero() {
    const e = eTown(); G.ehWave++;
    const w = G.ehWave;
    G.eh = { name: 'Lord Malekith', x: e.x - 2, y: e.y + 2, att: 4 + w, def: 4 + w, sp: 2, kn: 2,
      army: [{ t: 'skeleton', n: 10 + w * 10 }, { t: 'zombie', n: 4 + w * 4 }, { t: 'wraith', n: 1 + w * 3 }, w > 1 ? { t: 'vampire', n: w * 2 } : null, w > 2 ? { t: 'lich', n: w * 2 } : null].filter(Boolean) };
    toast('An enemy hero emerges from the Necropolis!');
  }
  async function enemyTurn() {
    const e = eTown();
    const eForts = G.objs.filter(o => o.t === 'fort' && o.owner === 1).length;
    if (G.day >= 8 && !G.eh) { G.ehTimer = Math.max(0, G.ehTimer - 1 - eForts); if (G.ehTimer <= 0) spawnEnemyHero(); return; }
    if (!G.eh) return;
    const eh = G.eh, tw = town();
    let target = tw;
    const mine = G.objs.filter(o => o.t === 'fort' && o.owner === 0);
    if (dist(eh, G.hero) < 12) target = G.hero;
    else if (mine.length) target = mine.reduce((a, b) => dist(eh, a) <= dist(eh, b) ? a : b);
    const path = findPath(G, eh.x, eh.y, target.x, target.y, true);
    if (!path) return;
    let left = 1000;
    for (const s of path) {
      if (s.cost > left) break;
      left -= s.cost; eh.x = s.x; eh.y = s.y; await sleep(45);
      if (s.x === G.hero.x && s.y === G.hero.y) { centerOn(s.x, s.y); toast('The enemy hero attacks!'); await fightEnemyHero(false); return; }
      if (s.x === tw.x && s.y === tw.y) { await endGame(false, 'The enemy hero captured your castle while it stood undefended.'); return; }
      const o = objAt(G, s.x, s.y);
      if (o && o.t === 'fort' && o.owner === 0) {
        centerOn(o.x, o.y);
        if (!o.garrison.some(Boolean)) {
          o.owner = 1; o.garrison = [{ t: 'skeleton', n: 10 }, null, null, null, null, null, null];
          await showModal(`<h2>🏯 ${o.name} has fallen!</h2><p>The enemy hero seized the undefended fort. Garrison your forts to hold your zones.</p>`);
        } else { toast(`The enemy hero assaults ${o.name}!`); await defendFort(o); }
        return;
      }
    }
    toast(`Enemy hero is ${dist(eh, target)} tiles from ${target === G.hero ? 'your hero' : target.name || 'your castle'}.`);
  }
  async function endTurn() {
    if (!G || busy || G.over) return;
    busy = true; G.path = null; selSlot = -1;
    await enemyTurn();
    if (G.over) { busy = false; return; }
    G.day++;
    const h = G.hero, t = town();
    h.move = MOVE_PER_DAY; h.mana = Math.min(maxMana(), h.mana + 4);
    if (heroAtTown()) h.mana = maxMana();
    let inc = t.b.hall ? HALL_INCOME : 0; const gain = { gold: inc, wood: 0, ore: 0, gems: 0 };
    for (const o of G.objs) {
      if (o.t === 'mine' && o.owner === 0 && zoneOwner(G, G.zone[o.y][o.x]) === 0) gain[o.kind] += o.kind === 'gold' ? 1000 : o.kind === 'gems' ? 1 : 2;
      if (o.t === 'fort' && o.owner === 0) gain.gold += FORT_INCOME;
    }
    RES.forEach(k => G.res[k] += gain[k]);
    const parts = RES.filter(k => gain[k]).map(k => `+${gain[k]}${RES_ICON[k]}`);
    if ((G.day - 1) % 7 === 0) {
      CASTLE_TIERS.forEach((id, i) => { if (t.b[i + 1]) t.avail[i + 1] = (t.avail[i + 1] || 0) + C[id].gr; });
      for (const o of G.objs) if (o.t === 'fort' && o.owner === 0) {
        let s = o.garrison.find(a => a && a.t === 'pikeman');
        if (s) s.n += MILITIA; else { const i = o.garrison.findIndex(a => !a); if (i >= 0) o.garrison[i] = { t: 'pikeman', n: MILITIA }; }
      }
      toast('A new week begins — dwellings replenish and forts raise militia!');
      if (G.eh) { const m = 1.15 + 0.1 * G.objs.filter(o => o.t === 'fort' && o.owner === 1).length; G.eh.army.forEach(a => a.n = Math.ceil(a.n * m)); }
    }
    toast(`Day ${G.day}${parts.length ? ' · ' + parts.join(' ') : ''}`);
    busy = false; centerOn(h.x, h.y); renderAll();
    try { localStorage.setItem(SAVE, JSON.stringify(G, (k, v) => k === 'omap' ? undefined : v)); } catch (e) { /* ignore */ }
  }
  async function endGame(win, why) {
    G.over = true;
    try { localStorage.removeItem(SAVE); } catch (e) { /* ignore */ }
    await showModal(win ? `<h2>🏆 Victory!</h2><p>You conquered the Necropolis on day ${G.day}. The realm is saved!</p>` : `<h2>💀 Defeat</h2><p>${why || 'Your hero has fallen.'}</p>`, ['Main menu']);
    $('title').classList.remove('hide'); refreshTitle();
  }

  // ---------- title / help ----------
  const HELP = `<h2>How to Play</h2><p><b>Goal:</b> defeat the Necropolis garrison in the north-east and capture it. Don't let the enemy hero take your castle.</p>
    <p><b>Map:</b> click a tile to preview the path (green = reachable today, red = next turn), click again to walk. Walk onto resources to grab them; mines give daily income; monsters, mines and artifacts are guarded.<br>
    Keys: arrows/WASD scroll · H center hero · Space go · E end turn · T town.</p>
    <p><b>Territory:</b> the map is split into zones, each ruled by a fort. Capture a fort (beat its guards) to own the zone: +${FORT_INCOME} gold/day, your mines there start paying, and +${MILITIA} militia/week. <b>Station troops in forts</b> (stand on the fort, click your hero) — the enemy hero raids undefended forts and takes the zone. When a garrison is attacked you fight the battle yourself, with +3 Defense.</p>
    <p><b>Town:</b> recruit troops (weekly growth), build higher-tier dwellings and the Town Hall. Your hero must be in the castle to recruit.</p>
    <p><b>Battle:</b> click a green hex to move, click an enemy to attack (archers shoot from range, flyers ignore obstacles). Wait / Defend / cast one spell per round. Right-click cancels a spell. Retreat loses your army.</p>`;
  function refreshTitle() { $('tCont').disabled = !localStorage.getItem(SAVE); }
  $('tNew').onclick = () => { $('title').classList.add('hide'); newGame(); };
  $('tCont').onclick = () => { if (load()) $('title').classList.add('hide'); };
  $('tHelp').onclick = () => showModal(HELP);
  $('bHelp').onclick = () => showModal(HELP);
  $('bSave').onclick = () => G && !busy && save();
  $('bEnd').onclick = endTurn;
  $('bTown').onclick = () => G && !busy && openTown();

  refreshTitle();
  requestAnimationFrame(loop);
  window.__G = () => G;
  window.__dbg = { centerOn, interact, renderAll };
})();
