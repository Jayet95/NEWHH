// Removes leftover white background pixels trapped between a creature's limbs and body (cut-out artefacts) from art/anim frames.
// Usage: node tools/fix_white_holes.js [--write] [id ...]   (without --write it only reports)
const sharp = require('sharp'), fs = require('fs'), path = require('path');
sharp.cache(false); // Windows: sharp keeps input files open otherwise and writes fail
const root = path.join(__dirname, '..', 'art', 'anim'), write = process.argv.includes('--write');
const ids = process.argv.slice(2).filter((a) => !a.startsWith('--')), MIN = +process.env.MINPX || 10, MAX = 2500;
const pink = (r, g, b) => r > 185 && b > 135 && r - g > 8 && b >= g - 8;            // the light pink/lilac that cut-outs leave between a limb and the body
const white = (r, g, b, a) => a > 40 && ((Math.min(r, g, b) > 185 && Math.max(r, g, b) - Math.min(r, g, b) < 60) || pink(r, g, b));
(async () => {
  let tot = 0;
  for (const id of (ids.length ? ids : fs.readdirSync(root))) {
    const dir = path.join(root, id); if (!fs.existsSync(dir)) continue; let n = 0, files = 0;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.webp'))) {
      const { data, info } = await sharp(path.join(dir, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); const W = info.width, H = info.height, seen = new Uint8Array(W * H); let hit = 0;
      for (let s = 0; s < W * H; s++) {
        if (seen[s] || !white(data[s * 4], data[s * 4 + 1], data[s * 4 + 2], data[s * 4 + 3])) continue;
        const comp = [], st = [s]; seen[s] = 1;
        while (st.length) { const p = st.pop(); comp.push(p); const x = p % W, y = (p / W) | 0; for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) if (q >= 0 && !seen[q] && white(data[q * 4], data[q * 4 + 1], data[q * 4 + 2], data[q * 4 + 3])) { seen[q] = 1; st.push(q); } }
        if (comp.length < MIN || comp.length > MAX) continue;
        hit += comp.length; for (const p of comp) data[p * 4 + 3] = 0;
        // soften the cut: pixels touching the hole that are also pale lose their alpha too
        for (const p of comp) { const x = p % W, y = (p / W) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const q = yy * W + xx, o = q * 4; if (data[o + 3] > 0 && ((Math.min(data[o], data[o + 1], data[o + 2]) > 170 && Math.max(data[o], data[o + 1], data[o + 2]) - Math.min(data[o], data[o + 1], data[o + 2]) < 50) || pink(data[o], data[o + 1], data[o + 2]))) data[o + 3] = 0; } }
      }
      if (hit) { n += hit; files++; if (write) fs.writeFileSync(path.join(dir, f), await sharp(data, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 95, alphaQuality: 100, effort: 4 }).toBuffer()); }
    }
    if (n) { tot += n; console.log(id.padEnd(14), files + ' frames,', n + ' px'); }
  }
  console.log('total', tot, write ? '(written)' : '(report only)');
})();
