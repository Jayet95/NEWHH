// Compares the size of each creature's walk/fly frames with its idle frame (visible height and width, feet position) and optionally rescales
// the walk frames so the creature does not change size when it starts to move.   node tools/walk_scale_check.js [--fix] [id ...]
const sharp = require('sharp'), fs = require('fs'), path = require('path'); sharp.cache(false);
const root = path.join(__dirname, '..', 'art', 'anim'), fix = process.argv.includes('--fix'), only = process.argv.slice(2).filter(a => !a.startsWith('--'));
async function bbox(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true }), W = info.width, H = info.height; let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x0, x1, y0, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, cx: (x0 + x1) / 2, W, H };
}
(async () => {
  for (const id of (only.length ? only : fs.readdirSync(root))) {
    const dir = path.join(root, id), ALIAS = { goblin: 'stronghold1', wolf: 'stronghold2', orc: 'stronghold3', ogre: 'stronghold4', golem: 'tower3', naga: 'tower6', dragon: 'rampart7' };   // neutral creatures borrow their idle frames from the town creature
    const idleFile = fs.existsSync(path.join(dir, 'idle_1.webp')) ? path.join(dir, 'idle_1.webp') : (ALIAS[id] && fs.existsSync(path.join(root, ALIAS[id], 'idle_1.webp')) ? path.join(root, ALIAS[id], 'idle_1.webp') : null); if (!idleFile) continue;
    const mv = fs.readdirSync(dir).filter(f => /^(walk|fly)_\d+\.webp$/.test(f)).sort(); if (!mv.length) continue;
    const idle = await bbox(idleFile), rs = [];
    for (const f of mv) { const b = await bbox(path.join(dir, f)); rs.push({ f, b, r: Math.max(b.h / idle.h, b.w / idle.w * 0.8) }); }
    const hr = rs.map(x => x.b.h / idle.h), avg = hr.reduce((a, c) => a + c, 0) / hr.length;
    if (fix && Math.abs(avg - 1) > 0.04) {
      const k = idle.h / (rs.reduce((a2, x) => a2 + x.b.h, 0) / rs.length);     // idle height / average walk height
      const meanY1 = rs.reduce((a2, x) => a2 + x.b.y1, 0) / rs.length, meanCx = rs.reduce((a2, x) => a2 + x.b.cx, 0) / rs.length;
      for (const x of rs) {
        const W = x.b.W, H = x.b.H, nw = Math.round(W * k), nh = Math.round(H * k);
        const dx = Math.round(idle.cx - meanCx * k), dy = Math.round(idle.y1 - meanY1 * k);          // the same offset for every frame keeps the walk's own bounce
        const img = await sharp(path.join(dir, x.f)).ensureAlpha().resize(nw, nh, { kernel: 'lanczos3' }).toBuffer();
        const sx = Math.max(0, -dx), sy = Math.max(0, -dy), ox = Math.max(0, dx), oy = Math.max(0, dy), cw = Math.min(nw - sx, W - ox), ch = Math.min(nh - sy, H - oy);
        const part = await sharp(img).extract({ left: sx, top: sy, width: cw, height: ch }).toBuffer();
        const out = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: part, left: ox, top: oy }]).webp({ quality: 92, alphaQuality: 100, effort: 5 }).toBuffer();
        fs.writeFileSync(path.join(dir, x.f), out);
      }
      console.log(id.padEnd(13), 'rescaled walk frames by', k.toFixed(2));
      continue;
    }
    console.log(id.padEnd(13), 'idle h', idle.h, 'w', idle.w, '| walk h ratio avg', avg.toFixed(2), 'min', Math.min(...hr).toFixed(2), 'max', Math.max(...hr).toFixed(2));
  }
})();
