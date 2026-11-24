'use strict';
// Google Play graphics:  node tools/make_store_graphics.js   ->  store/feature-graphic-1024x500.png
const sharp = require('sharp'), path = require('path'), fs = require('fs');
const root = path.join(__dirname, '..'), out = path.join(root, 'store');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const W = 1024, H = 500;
  const bg = await sharp(path.join(root, 'art/ui/title.webp')).resize(W, H, { fit: 'cover', position: 'centre' }).modulate({ brightness: 0.62, saturation: 0.95 }).toBuffer();
  const shade = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><radialGradient id="g" cx="50%" cy="46%" r="62%"><stop offset="0" stop-color="#0e0905" stop-opacity=".55"/><stop offset="1" stop-color="#0e0905" stop-opacity=".92"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/><rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="14" fill="none" stroke="#e6bf55" stroke-opacity=".55" stroke-width="2"/></svg>`);
  const logo = await sharp(path.join(root, 'art/ui/logo.png')).resize({ width: 600 }).toBuffer();
  const lm = await sharp(logo).metadata();
  // the Melton Games mark: cropped out of the studio picture, on its dark plate
  const mw = 250, mh = Math.round(mw * 620 / 1110);
  const crop = await sharp(path.join(root, 'brand/melton-logo.webp')).extract({ left: 450, top: 230, width: 1110, height: 620 }).resize(mw, mh).toBuffer();
  const plate = await sharp({ create: { width: mw + 24, height: mh + 16, channels: 4, background: '#100b06' } }).composite([{ input: crop, left: 12, top: 8 }]).png().toBuffer();
  const round = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${mw + 24}" height="${mh + 16}"><rect width="${mw + 24}" height="${mh + 16}" rx="14"/></svg>`);
  const plateR = await sharp(plate).composite([{ input: round, blend: 'dest-in' }]).png().toBuffer();
  await sharp(bg).composite([
    { input: shade, left: 0, top: 0 },
    { input: logo, left: Math.round((W - 600) / 2), top: 40 },
    { input: plateR, left: Math.round((W - mw - 24) / 2), top: H - (mh + 16) - 26 },
  ]).png().toFile(path.join(out, 'feature-graphic-1024x500.png'));
  console.log('store/feature-graphic-1024x500.png', lm.width + 'x' + lm.height);
})();
