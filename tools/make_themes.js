'use strict';
// Recolours the interface frames for every castle: themes/<castle>/<name>.webp   node tools/make_themes.js
// Source frames live in art/ui; edit the PALETTE below to change a castle's colours, then rerun.
const fs = require('fs'), path = require('path'), sharp = require('sharp');
const ROOT = path.join(__dirname, '..'), SRC = path.join(ROOT, 'art', 'ui'), OUT = path.join(ROOT, 'themes');
// tint = main colour, hi = colour for the bright metal corners, b = brightness, s = saturation of the stone
const PALETTE = {
  castle:     { tint: '#3d63ad', hi: '#ffd766', b: 1.15, s: 0.55 },
  rampart:    { tint: '#2f8a46', hi: '#f1dc7c', b: 1.05, s: 0.6 },
  tower:      { tint: '#3a8fc4', hi: '#c9f0ff', b: 1.1, s: 0.55 },
  inferno:    { tint: '#ff3a0a', hi: '#ff8a1e', b: 0.5, s: 0.9, k: 0.34, day: 0.85 },
  necropolis: { tint: '#2fb070', hi: '#a9f0b8', b: 0.5, s: 0.7, k: 0.3, day: 0.85 },
  dungeon:    { tint: '#8a3ee0', hi: '#e0a8ff', b: 0.5, s: 0.8, k: 0.36, day: 0.85 },
  stronghold: { tint: '#a0662a', hi: '#ffb04a', b: 0.9, s: 0.7 },
  fortress:   { tint: '#6f8a2e', hi: '#dcdc6a', b: 0.85, s: 0.7 },
  conflux:    { tint: '#4aa8d8', hi: '#ffffff', b: 1.12, s: 0.6 },
};
const FILES = { btn_normal: 'btn_normal', btn_pressed: 'btn_pressed', btn_disabled: 'btn_disabled', frame_command: 'frame_command', frame_scroll: 'frame_scroll', frame_toolbar: 'frame_toolbar', topbar_day: 'topbar_day', topbar_night: 'topbar_night' };
const hex = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
(async () => {
  for (const fac in PALETTE) {
    const P = PALETTE[fac]; fs.mkdirSync(path.join(OUT, fac), { recursive: true });
    for (const name in FILES) {
      let file = path.join(SRC, FILES[name] + '.png'); if (!fs.existsSync(file)) file = path.join(SRC, FILES[name] + '.webp'); if (!fs.existsSync(file)) continue;
      // the supplied interface art is used as it is for every castle; set TINT=1 to recolour it per castle instead
      if (!process.env.TINT) { await sharp(file).webp({ lossless: true }).toFile(path.join(OUT, fac, name + '.webp')); continue; }
      const night = name === 'topbar_night', day = name === 'topbar_day';
      const bright = night ? P.b * 0.7 : day ? P.b * (P.day || 1.25) : P.b;
      const K = P.k === undefined ? 0.55 : P.k;
      // the source stone is grey with gold corners: tint everything with the main colour, then lift the gold back toward the castle's metal colour
      const base = sharp(file).ensureAlpha();
      const { data, info } = await base.clone().raw().toBuffer({ resolveWithObject: true });
      const [tr, tg, tb] = hex(P.tint), [hr, hg, hb] = hex(P.hi);
      const out = Buffer.alloc(data.length);
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        const l = (r * 0.3 + g * 0.59 + b * 0.11) / 255, sat = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
        const gold = Math.min(1, Math.max(0, (sat - 0.18) * 3.2) * (r > b ? 1 : 0));      // how "metal" this pixel is
        // stone: grayscale value coloured by the tint (kept subtle), metal: recoloured by hi, keeping its shading
        const sr = l * ((1 - K) + K * tr / 255) * 255, sg = l * ((1 - K) + K * tg / 255) * 255, sb = l * ((1 - K) + K * tb / 255) * 255;
        const mr = l * hr * 1.15, mg = l * hg * 1.15, mb = l * hb * 1.15;
        let R = sr * (1 - gold) + mr * gold, G = sg * (1 - gold) + mg * gold, B = sb * (1 - gold) + mb * gold;
        R = Math.min(255, R * bright); G = Math.min(255, G * bright); B = Math.min(255, B * bright);
        out[i] = R; out[i + 1] = G; out[i + 2] = B; out[i + 3] = a;
      }
      await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).webp({ quality: 82 }).toFile(path.join(OUT, fac, name + '.webp'));
    }
    console.log(fac, 'done');
  }
})();
