'use strict';
// Trims the studio logo (which already has a transparent background) to its artwork -> brand/melton-logo.png
// If the picture has no transparency (white background), white is turned into transparency instead.
//   node tools/make_logo_alpha.js <source image>
const sharp = require('sharp'), path = require('path');
(async () => {
  const src = process.argv[2], { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  let transparent = 0; for (let i = 0; i < W * H; i += 97) if (data[i * 4 + 3] < 250) transparent++;
  if (transparent < 50) {      // no real alpha: key out the white
    for (let i = 0; i < W * H; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], m = Math.min(r, g, b);
      let a = (255 - m) / 255; a = Math.min(1, Math.max(0, (a - 0.04) / 0.46));
      if (a > 0.02) { data[i * 4] = Math.max(0, Math.min(255, Math.round((r - 255 * (1 - a)) / a))); data[i * 4 + 1] = Math.max(0, Math.min(255, Math.round((g - 255 * (1 - a)) / a))); data[i * 4 + 2] = Math.max(0, Math.min(255, Math.round((b - 255 * (1 - a)) / a))); }
      data[i * 4 + 3] = Math.round(a * 255);
    }
  }
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let i = 0; i < W * H; i++) if (data[i * 4 + 3] > 20) { const x = i % W, y = (i / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const pad = 12, l = Math.max(0, x0 - pad), t = Math.max(0, y0 - pad), box = { left: l, top: t, width: Math.min(W, x1 + pad) - l, height: Math.min(H, y1 + pad) - t };
  await sharp(data, { raw: { width: W, height: H, channels: 4 } }).extract(box).png({ compressionLevel: 9 }).toFile(path.join(__dirname, '..', 'brand', 'melton-logo.png'));
  console.log('brand/melton-logo.png', box, transparent < 50 ? '(white keyed out)' : '(own transparency)');
})();
