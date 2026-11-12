'use strict';
// Celebration effects drawn on a full-screen overlay: confetti cannons for a won fight, a coin shower for loot,
// fireworks + "YOU WIN" for winning the whole game. Skipped when the player prefers reduced motion.
const Celebrate = (() => {
  let cv = null, g = null, parts = [], raf = 0, last = 0, text = null, endAt = 0, fwUntil = 0, nextFw = 0;
  const COL = ['#ffd24a', '#ff5a48', '#4aa0ff', '#6fd36f', '#d58aff', '#fff3b0', '#ff9a2a'];
  const R = (a, b) => a + Math.random() * (b - a);
  const reduce = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function ensure() {
    if (!cv) { cv = document.createElement('canvas'); cv.id = 'fxc'; cv.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:70'; document.body.appendChild(cv); g = cv.getContext('2d'); }
    if (cv.width !== window.innerWidth || cv.height !== window.innerHeight) { cv.width = window.innerWidth; cv.height = window.innerHeight; }
  }
  function cannon(x, y, n, spread, speed, dir) {
    for (let i = 0; i < n; i++) {
      const a = (dir === undefined ? -Math.PI / 2 : dir) + R(-spread, spread), v = R(speed * 0.45, speed);
      parts.push({ k: 'rect', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, gy: 520, age: 0, max: R(2.2, 3.6), w: R(5, 10), h: R(3, 6), rot: R(0, 6), vr: R(-9, 9), col: COL[(Math.random() * COL.length) | 0] });
    }
  }
  function coins(n) {
    for (let i = 0; i < n; i++) parts.push({ k: 'coin', x: R(0, cv.width), y: -R(10, cv.height * 0.7), vx: R(-30, 30), vy: R(140, 300), gy: 160, age: 0, max: 5, size: R(7, 12), rot: R(0, 6), vr: R(4, 10) });
  }
  function firework(x, y) {
    const col = COL[(Math.random() * COL.length) | 0], n = 56;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + R(-.05, .05), v = R(70, 260); parts.push({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, gy: 140, age: 0, max: R(0.8, 1.5), size: R(1.8, 3.2), col: Math.random() < .25 ? '#fff' : col }); }
  }
  function begin(seconds) {
    ensure(); endAt = Math.max(endAt, performance.now() + seconds * 1000);
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }
  function say(main, sub, seconds) { text = { main, sub, t0: performance.now(), dur: seconds }; }
  const back = (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    g.clearRect(0, 0, cv.width, cv.height);
    if (fwUntil > now && now > nextFw) { firework(R(cv.width * .15, cv.width * .85), R(cv.height * .12, cv.height * .5)); nextFw = now + R(180, 380); if (Math.random() < .3) cannon(R(0, cv.width), cv.height + 10, 14, .5, cv.height * .9); }
    parts = parts.filter(p => {
      p.age += dt; if (p.age > p.max) return false;
      p.vy += p.gy * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.k !== 'spark') { p.vx *= 0.995; p.rot += (p.vr || 0) * dt; }
      if (p.y > cv.height + 40) return false;
      const a = p.k === 'spark' ? 1 - p.age / p.max : Math.min(1, (p.max - p.age) * 1.5);
      g.globalAlpha = Math.max(0, a);
      if (p.k === 'rect') { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(1, Math.cos(p.rot * 2)); g.fillStyle = p.col; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore(); }
      else if (p.k === 'coin') { const w = Math.abs(Math.cos(p.rot)) * p.size + 1; g.beginPath(); g.ellipse(p.x, p.y, w, p.size, 0, 0, 7); g.fillStyle = '#ffd24a'; g.fill(); g.strokeStyle = '#8a5a08'; g.lineWidth = 1.4; g.stroke(); g.beginPath(); g.ellipse(p.x, p.y, w * .55, p.size * .6, 0, 0, 7); g.strokeStyle = 'rgba(138,90,8,.6)'; g.stroke(); }
      else { g.beginPath(); g.arc(p.x, p.y, p.size * (0.5 + a * .6), 0, 7); g.fillStyle = p.col; g.shadowColor = p.col; g.shadowBlur = 8; g.fill(); g.shadowBlur = 0; }
      g.globalAlpha = 1; return true;
    });
    if (text) {
      const k = (now - text.t0) / 1000;
      if (k > text.dur) text = null;
      else {
        const al = k < 0.15 ? k / 0.15 : k > text.dur - 0.5 ? Math.max(0, (text.dur - k) / 0.5) : 1, sc = 0.55 + 0.45 * back(Math.min(1, k / 0.45)), fs = Math.max(30, Math.min(72, cv.width / 9));
        g.save(); g.globalAlpha = al; g.translate(cv.width / 2, cv.height * 0.28); g.scale(sc, sc); g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold ' + fs + 'px Georgia, serif';
        g.lineWidth = 8; g.strokeStyle = '#140a04'; g.strokeText(text.main, 0, 0); g.shadowColor = '#ffb020'; g.shadowBlur = 26; g.fillStyle = '#ffe27a'; g.fillText(text.main, 0, 0); g.shadowBlur = 0;
        if (text.sub) { g.font = Math.round(fs * 0.34) + 'px Georgia, serif'; g.lineWidth = 4; g.strokeText(text.sub, 0, fs * 0.8); g.fillStyle = '#fff'; g.fillText(text.sub, 0, fs * 0.8); }
        g.restore();
      }
    }
    if (!parts.length && !text && now > endAt && now > fwUntil) { g.clearRect(0, 0, cv.width, cv.height); raf = 0; return; }
    raf = requestAnimationFrame(tick);
  }
  return {
    fight() { if (reduce() || typeof document === 'undefined') return; begin(3.2); const W = cv.width, H = cv.height; cannon(W * 0.08, H + 10, 70, 0.45, H * 1.05, -Math.PI / 2 + 0.35); cannon(W * 0.92, H + 10, 70, 0.45, H * 1.05, -Math.PI / 2 - 0.35); },
    loot() { if (reduce() || typeof document === 'undefined') return; begin(3.5); coins(40); },
    game() { if (reduce() || typeof document === 'undefined') return; begin(8); fwUntil = performance.now() + 7000; nextFw = 0; say('YOU WIN!', 'Every rival has fallen — the realm is yours', 7); cannon(cv.width * 0.1, cv.height + 10, 90, 0.5, cv.height * 1.1, -Math.PI / 2 + 0.3); cannon(cv.width * 0.9, cv.height + 10, 90, 0.5, cv.height * 1.1, -Math.PI / 2 - 0.3); coins(30); },
  };
})();
