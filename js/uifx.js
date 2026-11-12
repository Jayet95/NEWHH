'use strict';
// UI polish only (no game logic): menu screen transitions, soft hover tick, title-screen embers and parallax,
// the loading bar with tips, and flags that switch on the optional frame art in art/ui/. Everything is skipped
// or static when the player prefers reduced motion.
(() => {
  const $ = (id) => document.getElementById(id);
  const reduce = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const sfx = (n) => { try { if (typeof Sfx !== 'undefined') Sfx.play(n); } catch (e) { /* ignore */ } };

  // ---------- 1. screen transitions: the dialog content slides and fades in when the screen changes (not on in-place refreshes) ----------
  const mbox = $('mbox');
  if (mbox) {
    let dir = 'fwd', sig = '', clr = 0;
    // Back buttons slide the other way
    document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('#sBack')) dir = 'back'; }, true);
    const signature = () => { const h = mbox.querySelector('h2'); return h ? h.textContent : (mbox.firstElementChild ? mbox.firstElementChild.className || mbox.firstElementChild.tagName : ''); };
    new MutationObserver(() => {
      const s = signature(), prev = sig, changed = s !== prev; sig = s;
      // the first screen after the dialog opens already pops in by itself; only later screen changes slide
      if (!changed || !prev || reduce() || !mbox.firstChild) { dir = 'fwd'; return; }
      mbox.classList.remove('scr-in', 'scr-back'); void mbox.offsetWidth; mbox.classList.add(dir === 'back' ? 'scr-back' : 'scr-in'); dir = 'fwd';
      clearTimeout(clr); clr = setTimeout(() => mbox.classList.remove('scr-in', 'scr-back'), 700);
    }).observe(mbox, { childList: true });
    // a freshly opened dialog starts from "no screen", so the next one animates in with the dialog's own pop
    const modal = $('modal');
    if (modal) new MutationObserver(() => { if (modal.classList.contains('hide')) sig = ''; }).observe(modal, { attributes: true, attributeFilter: ['class'] });
  }

  // ---------- 2. soft tick when the mouse moves onto a button ----------
  { let last = null, t0 = 0;
    document.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'mouse') return;
      const b = e.target.closest && e.target.closest('button');
      if (!b || b.disabled || b === last || b.closest('#bat')) return;
      last = b; const now = performance.now(); if (now - t0 < 60) return; t0 = now; sfx('tick');
    }, true);
    document.addEventListener('pointerout', (e) => { if (last && !(e.relatedTarget && last.contains(e.relatedTarget))) last = null; }, true);
  }

  // ---------- 3. title screen: drifting art, parallax and floating embers ----------
  const title = $('title');
  if (title) {
    const fx = document.createElement('div'); fx.id = 'title-fx'; fx.setAttribute('aria-hidden', 'true');
    fx.innerHTML = '<div class="tfx-bg"></div><canvas class="tfx-cv"></canvas>';
    title.insertBefore(fx, title.firstChild);
    const bg = fx.querySelector('.tfx-bg'), cv = fx.querySelector('canvas'), g = cv.getContext('2d');
    const setArt = () => { try { const u = typeof Assets !== 'undefined' && Assets.url('ui/title'); if (u) { bg.style.backgroundImage = 'url(' + u + ')'; fx.classList.add('has-art'); } } catch (e) { /* ignore */ } };
    // pointer parallax (desktop)
    if (!reduce()) title.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; const r = title.getBoundingClientRect(); fx.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3)); fx.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3)); });
    // embers and sparkles on a small canvas, only drawn while the title is visible
    let W = 0, H = 0, dpr = 1, parts = [], raf = 0, last = 0;
    const R = (a, b) => a + Math.random() * (b - a);
    const mk = (init) => {
      const ember = Math.random() < 0.7;
      return { ember, x: R(0, W), y: init ? R(0, H) : H + 10, r: ember ? R(0.8, 2.4) : R(0.7, 1.7), vy: ember ? R(14, 46) : R(3, 12), vx: R(-8, 8), ph: R(0, 6.28), sp: R(0.8, 2.6), hue: ember ? R(16, 42) : R(42, 52), a: R(0.35, 0.95) };
    };
    const size = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1); W = title.clientWidth; H = title.clientHeight; if (!W || !H) return;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px';
      const n = Math.round(Math.min(70, Math.max(22, W * H / 26000))); while (parts.length < n) parts.push(mk(true)); parts.length = n;
    };
    const visible = () => !title.classList.contains('hide') && !document.hidden;
    function frame(now) {
      raf = 0; if (!visible()) return;
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i]; p.ph += p.sp * dt; p.y -= p.vy * dt; p.x += (p.vx + Math.sin(p.ph) * 10) * dt;
        if (p.y < -12 || p.x < -12 || p.x > W + 12) { parts[i] = mk(false); parts[i].x = R(0, W); continue; }
        const tw = p.ember ? 0.55 + 0.45 * Math.sin(p.ph * 2.2) : 0.25 + 0.75 * Math.abs(Math.sin(p.ph * 1.7)), fade = Math.min(1, p.y / (H * 0.25) + 0.15), al = p.a * tw * fade;
        g.fillStyle = `hsla(${p.hue},95%,62%,${(al * 0.14).toFixed(3)})`; g.beginPath(); g.arc(p.x, p.y, p.r * 4.2, 0, 6.2832); g.fill();
        g.fillStyle = `hsla(${p.hue},100%,${p.ember ? 70 : 88}%,${al.toFixed(3)})`; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.2832); g.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    const kick = () => { if (reduce()) return; if (!raf && visible()) { size(); last = performance.now(); raf = requestAnimationFrame(frame); } };
    if (reduce()) fx.classList.add('still');
    new MutationObserver(kick).observe(title, { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('visibilitychange', kick);
    window.addEventListener('resize', () => { if (visible() && !reduce()) size(); });
    kick(); setArt();
    document.addEventListener('assets-ready', setArt);
    if (typeof Assets !== 'undefined' && Assets.ready) Assets.ready.then(setArt);
  }

  // ---------- 4. loading bar with rotating tips ----------
  const bar = $('loadbar'), fill = $('loadfill'), tipEl = $('loadtip');
  const TIPS = [
    'Press E to end your turn, T to open your town and K for the kingdom overview.',
    'Night falls when you end your turn: the rival realms march while you sleep.',
    'Recruit troops in your town before you set out. A bigger army makes every fight safer.',
    'Station a garrison in each town so it defends itself when no hero is inside.',
    'Archers lose damage beyond 10 hexes, so keep them close to the target.',
    'Mines give daily income. Capture them early and guard them.',
    'Holding a fort pays gold every day and adds to the zone mine income.',
    'A castle assault is a siege: break the gate or the walls before the defenders wear you down.',
    'Send reinforcements between your castles with caravans from the town screen.',
    'Fog hides the map. Scouts, towers and your heroes reveal it as they pass.',
    'Pick the hero whose skills and spells suit the army you plan to build.',
  ];
  if (bar && fill) {
    const t0 = performance.now(); let finished = false, tipI = Math.floor(Math.random() * TIPS.length), tipTimer = 0;
    const showTip = () => { if (!tipEl) return; tipEl.classList.remove('on'); setTimeout(() => { tipEl.textContent = 'Tip: ' + TIPS[tipI++ % TIPS.length]; tipEl.classList.add('on'); }, reduce() ? 0 : 220); };
    const finish = () => {
      if (finished) return; finished = true; fill.style.width = '100%'; clearInterval(tipTimer);
      const wait = Math.max(0, 750 - (performance.now() - t0));
      setTimeout(() => { bar.classList.add('done'); if (tipEl) tipEl.classList.add('done'); }, wait);
    };
    showTip(); tipTimer = setInterval(showTip, 4200);
    document.addEventListener('assets-progress', (e) => { const d = e.detail; if (!d || finished) return; bar.classList.remove('indet'); fill.style.width = Math.max(4, Math.round(100 * d.done / Math.max(1, d.total))) + '%'; if (d.done >= d.total) finish(); });
    document.addEventListener('assets-ready', finish);
    if (typeof Assets !== 'undefined' && Assets.ready) Assets.ready.then(finish); else finish();
  }

  // ---------- 5. optional frame art: turn on the frames only when the files exist ----------
  const frames = () => {
    if (typeof Assets === 'undefined') return;
    const on = (cls, stem) => document.body.classList.toggle(cls, Assets.has(stem));
    on('fr-progress', 'ui/frame_progress'); on('fr-portrait', 'ui/frame_portrait'); on('fr-town', 'ui/frame_town');
  };
  frames(); document.addEventListener('assets-progress', frames); document.addEventListener('assets-ready', frames);
  if (typeof Assets !== 'undefined' && Assets.ready) Assets.ready.then(frames);
})();
