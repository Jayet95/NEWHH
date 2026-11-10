// Removes light halos from the soft edge of cut-out animation frames: every semi-transparent edge pixel takes the colour of the nearest solid pixels
// (so white background colour no longer bleeds in) and nearly-transparent near-white specks are dropped.  Usage: node tools/defringe.js [--write] id ...
const sharp = require('sharp'), fs = require('fs'), path = require('path'); sharp.cache(false);
const root = path.join(__dirname, '..', 'art', 'anim'), write = process.argv.includes('--write'), ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));
(async () => {
  for (const id of ids) {
    const dir = path.join(root, id); let changed = 0;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.webp'))) {
      const { data, info } = await sharp(path.join(dir, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }), W = info.width, H = info.height, out = Buffer.from(data);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const o = (y * W + x) * 4, a = data[o + 3]; if (a === 0 || a >= 235) continue;
        const light = Math.min(data[o], data[o + 1], data[o + 2]) > 140;
        if (a < 70 && light) { out[o + 3] = 0; changed++; continue; }
        let r = 0, g = 0, b = 0, n = 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const q = (yy * W + xx) * 4; if (data[q + 3] >= 235) { r += data[q]; g += data[q + 1]; b += data[q + 2]; n++; } }
        if (n && light) { out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; changed++; }
      }
      if (write) fs.writeFileSync(path.join(dir, f), await sharp(out, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 95, alphaQuality: 100, effort: 4 }).toBuffer());
    }
    console.log(id, changed + ' edge pixels', write ? '(written)' : '(report)');
  }
})();
