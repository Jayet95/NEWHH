'use strict';
// Game icons: hand-drawn gold-and-ink glyphs that replace emoji everywhere in the interface (DOM text and canvas drawing).
// Anything not listed in MAP keeps its emoji. Each icon is a function returning SVG shapes for a 32x32 box.
const GI = (() => {
  const INK = '#2a1604';
  const g = (d, o = '') => `<path d="${d}" fill="url(#gG)" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round" ${o}/>`;
  const f = (d, fill, o = '') => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round" ${o}/>`;
  const k = (d, w = 1.6) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const c = (x, y, r, fill = 'url(#gG)', o = '') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${INK}" stroke-width="1.5" ${o}/>`;
  const RED = 'url(#gR)', BLUE = 'url(#gB)', GREEN = 'url(#gN)', SILV = 'url(#gS)', DARK = '#1a0f05';
  const cog = (() => { let d = ''; for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, r = i % 2 ? 9 : 13; d += (i ? 'L' : 'M') + (16 + r * Math.cos(a)).toFixed(1) + ' ' + (16 + r * Math.sin(a)).toFixed(1); } return d + 'Z'; })();
  const star = (n, R, r, cx = 16, cy = 16) => { let d = ''; for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, q = i % 2 ? r : R; d += (i ? 'L' : 'M') + (cx + q * Math.cos(a)).toFixed(1) + ' ' + (cy + q * Math.sin(a)).toFixed(1); } return d + 'Z'; };
  const ICONS = {
    swords: () => g('M5 4h5l17 17-3 3L5 7z') + g('M27 4h-5L5 21l3 3L27 7z') + k('M22 20l6 6M10 20l-6 6M20 24l4-4M12 24L8 20'),
    sword: () => g('M24 3l5 1 1 5-14 14-6-6z') + f('M7 18l7 7-3 3-3-1-1-3-3-3z', SILV) + k('M10 22l-6 6'),
    town: () => g('M3 28V12h4v-3h3v3h3V6h-1V3h8v3h-1v6h3V9h3v3h4v16z') + f('M13 28v-7a3 3 0 016 0v7z', DARK) + f('M16 3V1', 'none') + f('M16 1l5 1.5-5 1.5z', RED),
    shield: () => g('M16 3l11 4v9c0 6-5 10-11 13C10 26 5 22 5 16V7z') + k('M16 7v18M9 14h14', 2.2) + c(16, 14, 2.6, RED),
    flame: () => f('M16 2c2 6 9 9 9 17a9 9 0 01-18 0c0-5 3-7 5-10 0 3 1 5 3 5 0-6-2-8 1-12z', RED) + f('M16 15c1 3 5 4 5 8a5 5 0 01-10 0c0-3 3-4 3-6 1 1 2 1 2-2z', 'url(#gG)'),
    dragon: () => g('M3 24c1-9 8-16 19-17l6-4-2 7 3 4-6 2c-1 6-8 11-15 11-3 0-5-1-5-3z') + c(21, 12, 1.7, DARK) + k('M8 22c4 0 8-3 10-7M25 6l-2 4'),
    skull: () => g('M16 3c6 0 11 4 11 11 0 3-1 5-3 7v5h-4v-3h-2v3h-4v-3h-2v3H8v-5c-2-2-3-4-3-7C5 7 10 3 16 3z') + c(11.5, 14, 3, DARK) + c(20.5, 14, 3, DARK) + f('M16 17l-2 4h4z', DARK),
    spiral: () => k('M16 16a2 2 0 014 0 5 5 0 01-10 0 8 8 0 0116 0 11 11 0 01-22 0', 3.2) + k('M16 16a2 2 0 014 0 5 5 0 01-10 0 8 8 0 0116 0 11 11 0 01-22 0', 1.4).replace(INK, '#f6d070'),
    coin: () => c(16, 16, 12) + c(16, 16, 8, 'none') + k('M16 11v10M13 14c0-2 6-2 6 0s-6 2-6 4 6 2 6 0', 1.5),
    sack: () => g('M12 3h8l-2 6c5 2 8 7 8 12 0 5-4 8-10 8S6 26 6 21c0-5 3-10 8-12z') + k('M12 9h8') + k('M16 14v10M13.5 17c0-2 5-2 5 0s-5 2-5 4 5 2 5 0', 1.5),
    trophy: () => g('M9 4h14v7c0 5-3 8-7 9-4-1-7-4-7-9z') + k('M9 7H5c0 5 2 8 5 9M23 7h4c0 5-2 8-5 9') + g('M14 20h4v4h5v4H9v-4h5z'),
    clasp: () => g('M2 14l8-6 6 3 6-3 8 6-5 7-5-2-4 4-4-1-2 2-6-5z') + k('M10 8l-2 9M22 8l2 9M14 18l3 3'),
    fort: () => g('M7 28V14h18v14z') + g('M5 14L16 4l11 10z') + f('M13 28v-6a3 3 0 016 0v6z', DARK) + f('M16 4V1', 'none') + f('M16 1l5 1.5-5 1.5z', RED),
    cart: () => g('M2 8h18v13H2z') + g('M20 12h6l4 5v4H20z') + c(8, 24, 3.5, SILV) + c(24, 24, 3.5, SILV),
    sparkle: () => g(star(4, 14, 4)) + g(star(4, 5, 1.6, 25, 7)),
    mountain: () => g('M1 28L12 7l6 10 4-6 9 17z') + f('M12 7l-4 7 3-2 2 3 2-3z', 'url(#gS)'),
    warn: () => f('M16 3l14 25H2z', 'url(#gG)') + k('M16 11v8', 2.6) + c(16, 23.5, 1.6, DARK, 'stroke="none"'),
    save: () => g('M4 4h20l4 4v20H4z') + f('M9 4h12v8H9z', SILV) + f('M9 19h14v9H9z', DARK) + k('M17 6v4'),
    target: () => c(16, 16, 13, RED) + c(16, 16, 9, '#f3ead0') + c(16, 16, 5.5, RED) + c(16, 16, 2, '#f3ead0'),
    book: () => g('M3 6c5-2 9-1 13 2 4-3 8-4 13-2v19c-5-2-9-1-13 2-4-3-8-4-13-2z') + k('M16 8v19M7 11c3-1 6 0 7 1M25 11c-3-1-6 0-7 1M7 16c3-1 6 0 7 1M25 16c-3-1-6 0-7 1', 1.2),
    tent: () => g('M2 28L16 4l14 24z') + f('M12 28l4-10 4 10z', DARK) + k('M16 4V1'),
    bomb: () => c(14, 19, 10, '#4a4a52') + k('M20 11l4-5') + f(star(5, 5, 2, 26, 4), 'url(#gG)') + c(10, 15, 2.4, '#9aa0aa', 'stroke="none"'),
    door: () => g('M7 29V13a9 9 0 0118 0v16z') + k('M16 5v24M7 18h18M7 24h18', 1.2) + c(21, 19, 1.4, DARK),
    burst: () => f(star(9, 15, 8), RED) + f(star(9, 9, 4), 'url(#gG)'),
    clover: () => c(11, 11, 6, GREEN) + c(21, 11, 6, GREEN) + c(11, 21, 6, GREEN) + c(21, 21, 6, GREEN) + k('M16 16c2 6 6 10 10 13', 2),
    rock: () => f('M4 24l3-10 7-6 8 3 6 8-2 6-10 2z', SILV) + k('M10 14l5 3 7-4M15 17l-1 7', 1.1),
    wind: () => { const p = ['M3 11h17a4 4 0 10-4-4', 'M3 17h22a4 4 0 11-4 4', 'M3 23h11']; return p.map(d => k(d, 4).replace(INK, '#cfe8ff') + k(d, 1.2)).join(''); },
    books: () => g('M4 22h24v6H4z') + g('M6 15h22v6H6z') + g('M3 8h22v6H3z') + k('M8 8v6M13 15v6M10 22v6', 1.2),
    ring: () => k('M16 28a9 9 0 110-18 9 9 0 010 18z', 4.2).replace(INK, '#f0c050') + k('M16 28a9 9 0 110-18 9 9 0 010 18z', 1.2) + f('M16 3l5 5-5 5-5-5z', BLUE),
    speaker: () => g('M3 12h6l8-7v22l-8-7H3z') + k('M21 11c3 3 3 7 0 10M24 7c6 5 6 13 0 18', 2),
    mute: () => g('M3 12h6l8-7v22l-8-7H3z') + k('M22 11l7 10M29 11l-7 10', 2.4),
    cogwheel: () => g(cog) + c(16, 16, 5, DARK),
    bow: () => k('M8 3c10 4 10 22 0 26', 4.4).replace(INK, '#d8a040') + k('M8 3c10 4 10 22 0 26', 1.2) + k('M8 3v26', 1.2).replace(INK, '#f3ead0') + k('M6 16h22', 3).replace(INK, '#cfd6e0') + f('M29 16l-6-3.6v7.2z', SILV),
    pine: () => f('M16 3l9 11h-4l7 9H4l7-9H7z', GREEN) + f('M14 23h4v6h-4z', '#6a4020'),
    orb: () => c(16, 16, 12, BLUE) + c(12, 11, 3.5, '#d8f0ff', 'stroke="none"'),
    drop: () => f('M16 3C10 12 6 16 6 21a10 10 0 0020 0c0-5-4-9-10-18z', BLUE) + c(12, 20, 2, '#d8f0ff', 'stroke="none"'),
    shrine: () => g('M3 8c8 2 18 2 26 0v4H3z') + g('M6 12h20v3H6z') + g('M8 15h4v14H8zM20 15h4v14h-4z'),
    chains: () => k('M12 8a5 5 0 017 0l3 3a5 5 0 01-7 7', 3.4).replace(INK, '#c8c8d0') + k('M20 24a5 5 0 01-7 0l-3-3a5 5 0 017-7', 3.4).replace(INK, '#a0a0aa') + k('M12 8a5 5 0 017 0l3 3a5 5 0 01-7 7M20 24a5 5 0 01-7 0l-3-3a5 5 0 017-7', 1),
    skip: () => g('M5 5l16 11L5 27z') + g('M23 5h4v22h-4z'),
    fast: () => g('M3 5l13 11L3 27z') + g('M16 5l13 11-13 11z'),
    scroll: () => g('M7 4h19a3 3 0 013 3v2H10v16a3 3 0 01-6 0V7a3 3 0 013-3z') + g('M10 9h19v18H10z') + k('M14 14h11M14 18h11M14 22h8', 1.3),
    fury: () => c(16, 16, 13, RED) + k('M7 10l8 4M25 10l-8 4', 2.6) + c(11, 17, 2, DARK) + c(21, 17, 2, DARK) + k('M10 24c4-3 8-3 12 0', 2),
    back: () => k('M10 8H5l5-5M5 8h14a8 8 0 010 16H9', 3).replace(INK, '#f0c050') + k('M10 8H5l5-5M5 8h14a8 8 0 010 16H9', 1),
    volcano: () => g('M2 29L11 12h10l9 17z') + f('M11 12c1-3 3-4 5-4s4 1 5 4z', RED) + f('M14 6c0-3 3-3 3-5 3 3 2 5 1 6z', RED),
    scope: () => g('M3 22l16-13 5 6L8 28z') + g('M20 7l4-4 5 5-4 4z') + k('M10 25l-3 5M14 22l7 8', 2),
    obelisk: () => g('M11 29L13 8l3-5 3 5 2 21z') + k('M13 13h6M12.5 18h7M12 23h8', 1),
    ship: () => g('M3 22h26l-4 7H7z') + f('M16 3v18', 'none') + k('M16 3v19') + f('M17 4c6 4 9 9 9 15H17z', '#f3ead0') + f('M15 8c-4 3-7 7-7 11h7z', '#e0d4b0'),
    trash: () => g('M7 9h18l-2 20H9z') + g('M5 6h22v3H5zM12 3h8v3h-8z') + k('M13 13v12M19 13v12', 1.3),
    up: () => g('M16 3l12 14h-7v12H11V17H4z'),
    pick: () => k('M6 28L22 12', 3.2).replace(INK, '#9a6a30') + g('M3 14c4-9 14-12 24-9-3 1-5 3-6 6-4-2-10-2-18 3z'),
    chart: () => g('M4 18h6v10H4z') + g('M13 10h6v18h-6z') + g('M22 4h6v24h-6z'),
    chartup: () => k('M3 26l8-9 6 5 12-14', 3).replace(INK, '#7fe07f') + k('M3 26l8-9 6 5 12-14', 1) + f('M29 8l-8 1 6 6z', GREEN),
    heartbreak: () => f('M16 28C4 19 2 12 6 7c4-4 9-2 10 2z', RED) + f('M17 10c2-5 7-6 10-2 3 5 1 11-11 20l3-9-4-4z', RED) + k('M16 9l-3 6 4 4-2 6'),
    dizzy: () => g(star(5, 7, 3, 9, 10)) + g(star(5, 7, 3, 23, 9)) + g(star(5, 7, 3, 16, 23)),
    snail: () => g('M3 26h22c3 0 4-3 3-5l-3-6') + c(14, 15, 9, 'url(#gG)') + k('M14 15m-5 0a5 5 0 1010 0 3 3 0 10-6 0') + k('M26 15c1-4 0-7-2-9M28 15c2-3 2-6 1-8', 1.4),
    eyeslash: () => f('M2 16c5-8 23-8 28 0-5 8-23 8-28 0z', '#f3ead0') + c(16, 16, 5, BLUE) + c(16, 16, 2, DARK) + k('M4 28L28 4', 3),
    dash: () => k('M4 9h16M2 16h24M6 23h14', 3).replace(INK, '#cfe8ff') + k('M4 9h16M2 16h24M6 23h14', 1),
    check: () => k('M4 17l8 8L28 6', 5).replace(INK, '#2f8a3a') + k('M4 17l8 8L28 6', 2).replace(INK, '#9ff09f'),
    wilt: () => k('M16 14v15M16 22c-4 0-6-2-7-5', 2) + f('M9 5c-4 2-6 6-4 9 2 2 6 1 8-1 2 2 6 2 8-1 2-3 0-7-4-9-2-1-5 0-6 2-1-2-1-2-2 0z', RED),
    fog: () => k('M5 10h16M3 16h26M8 22h18', 3.4).replace(INK, '#cfd6e0') + k('M5 10h16M3 16h26M8 22h18', 1),
    gemblue: () => f('M16 2l11 9-11 19L5 11z', BLUE) + k('M5 11h22M11 11l5-9 5 9M11 11l5 19 5-19', 1.1),
    flagw: () => k('M7 3v26', 2.6) + f('M8 5c6-3 10 3 16 0v13c-6 3-10-3-16 0z', '#f3ead0'),
    log: () => f('M5 10h20v14H5z', '#a4682c') + c(25, 17, 7, '#c88a44') + c(25, 17, 3.6, '#a4682c') + k('M9 14h12M9 19h12', 1),
    wolf: () => g('M3 26l2-12 4 3 3-8 3 3h6l3-3 3 8 2 3-3 8z') + c(12, 17, 1.8, DARK) + c(22, 17, 1.8, DARK) + f('M15 22l2 3 2-3z', DARK),
    ogre: () => c(16, 17, 12, RED) + f('M6 9L3 2l8 4zM26 9l3-7-8 4z', 'url(#gG)') + c(11.5, 16, 2.4, '#f3ead0') + c(20.5, 16, 2.4, '#f3ead0') + k('M10 23c4 3 8 3 12 0M13 22v3M19 22v3', 1.4),
    mage: () => f('M16 2l8 17H8z', BLUE) + g('M4 19h24l-3 4H7z') + c(16, 26, 4.5, '#f0c8a0') + f(star(5, 3, 1.2, 14, 9), 'url(#gG)', 'stroke="none"'),
    horse: () => g('M5 28c0-9 3-13 7-16l-2-7 5 3c5 0 9 3 10 9l-4 1-3-2c0 4 2 6 2 12z') + c(17, 11, 1.4, DARK) + k('M10 6l-3-3'),
    crown: () => g('M3 24L2 8l8 7 6-10 6 10 8-7-1 16z') + g('M3 24h26v4H3z') + c(16, 17, 2, RED),
    bolt: () => g('M18 2L6 18h8l-3 12 15-18h-9z'),
    boot: () => g('M9 3h9v12l9 5v8H5V14z') + k('M9 9h9M5 24h22', 1.2),
    helm: () => g('M5 20v-5C5 8 10 4 16 4s11 4 11 11v5l-3 8H8z') + f('M10 15h12v4h-5v4h-2v-4h-5z', DARK) + k('M16 4v6'),
    beads: () => k('M5 6c0 14 22 14 22 0', 2.4).replace(INK, '#c0a060') + c(9, 12, 2.2) + c(13, 16, 2.2) + c(19, 16, 2.2) + c(23, 12, 2.2) + f('M16 20l4 4-4 5-4-5z', RED),
    lock: () => k('M9 14V10a7 7 0 0114 0v4', 3.2).replace(INK, '#c8c8d0') + g('M6 14h20v14H6z') + c(16, 20, 2.4, DARK) + k('M16 21v4', 2),
    pack: () => g('M7 12c0-6 18-6 18 0v16H7z') + g('M10 18h12v8H10z') + k('M12 12c0-5 8-5 8 0M16 18v4'),
    hut: () => g('M5 28V15l11-10 11 10v13z') + f('M13 28v-7h6v7z', DARK) + g('M2 16L16 3l14 13'),
    zzz: () => k('M5 8h9l-9 9h9M16 18h7l-7 7h7', 3).replace(INK, '#cfe8ff') + k('M5 8h9l-9 9h9M16 18h7l-7 7h7', 1),
    pillars: () => g('M2 10L16 3l14 7z') + g('M5 11h4v14H5zM14 11h4v14h-4zM23 11h4v14h-4z') + g('M2 25h28v4H2z'),
    pin: () => f('M16 30C9 20 5 15 5 11a11 11 0 0122 0c0 4-4 9-11 19z', RED) + c(16, 11, 4, '#f3ead0'),
    sun: () => g(star(12, 14, 9)) + c(16, 16, 7),
    moon: () => g('M22 3a13 13 0 100 26c-9 0-14-6-14-13S13 3 22 3z'),
    qmark: () => c(16, 16, 13) + k('M11 12c0-6 10-6 10 0 0 4-5 4-5 9', 3) + c(16, 25, 1.7, INK),
    hands: () => g('M16 28c-6-4-9-9-9-15l4-8 5 8 5-8 4 8c0 6-3 11-9 15z') + k('M16 13v13'),
    smile: () => c(16, 16, 13) + c(11.5, 13, 1.8, DARK) + c(20.5, 13, 1.8, DARK) + k('M9 19c4 6 10 6 14 0', 2.2),
    frown: () => c(16, 16, 13) + c(11.5, 13, 1.8, DARK) + c(20.5, 13, 1.8, DARK) + k('M9 24c4-5 10-5 14 0', 2.2),
    flask: () => f('M12 3h8v8l8 15c1 2 0 3-2 3H6c-2 0-3-1-2-3l8-15z', 'url(#gG)') + f('M9 21h14l3 6c0 1-1 2-2 2H8c-1 0-2-1-2-2z', GREEN),
    leaf: () => f('M5 27C3 12 12 4 28 4c0 14-8 22-20 22', GREEN) + k('M5 27C12 18 17 13 23 9'),
    sprout: () => k('M16 29V15', 2.2) + f('M16 16C8 16 5 11 5 6c6 0 10 3 11 10z', GREEN) + f('M16 20c7 0 10-4 11-9-6 0-10 3-11 9z', GREEN),
    palm: () => k('M16 29c-1-8 0-14 2-19', 3).replace(INK, '#8a5a2a') + f('M18 10c-6-6-12-4-15 1 5-2 9-1 15-1zM18 10c6-6 12-4 14 1-5-2-9-1-14-1zM18 10c-2-6 0-9 4-10-1 4-1 7-4 10z', GREEN),
    tree: () => c(16, 12, 10, GREEN) + c(9, 15, 7, GREEN) + c(23, 15, 7, GREEN) + f('M14 20h4v9h-4z', '#6a4020'),
    flake: () => k('M16 3v26M5 9.5l22 13M27 9.5l-22 13M12 5l4 4 4-4M12 27l4-4 4 4', 2.6).replace(INK, '#cfeaff') + k('M16 3v26M5 9.5l22 13M27 9.5l-22 13', 1),
    anchor: () => k('M16 6v22M9 14h14M5 20c1 6 6 9 11 9s10-3 11-9', 3).replace(INK, '#9aa0aa') + c(16, 6, 3, 'none') + k('M16 6v22M9 14h14M5 20c1 6 6 9 11 9s10-3 11-9', 1),
    cross: () => k('M6 6l20 20M26 6L6 26', 4.4).replace(INK, '#c04030') + k('M6 6l20 20M26 6L6 26', 1.4),
    hourglass: () => g('M6 3h20v3c0 6-6 8-6 10s6 4 6 10v3H6v-3c0-6 6-8 6-10S6 9 6 6z') + f('M10 24c2-3 10-3 12 0z', '#f0d890'),
    diamond: () => f('M16 2l12 14-12 14L4 16z', BLUE),
    gold: () => c(16, 16, 12) + c(16, 16, 8, 'none'),
    house: () => g('M4 15L16 4l12 11v13H4z') + f('M13 28v-9h6v9z', DARK),
    globe: () => c(16, 16, 12, BLUE) + f('M8 9c4-2 7 0 7 4s-4 4-3 8-5 1-6-3z', GREEN) + f('M19 8c4 0 7 4 6 8s-5 2-5-1z', GREEN),
    phone: () => g('M10 3h12a2 2 0 012 2v22a2 2 0 01-2 2H10a2 2 0 01-2-2V5a2 2 0 012-2z') + f('M11 7h10v15H11z', DARK),
    gift: () => g('M4 12h24v6H4z') + g('M6 18h20v11H6z') + k('M16 12v17M16 12c-6-8-11-1-4 0M16 12c6-8 11-1 4 0', 2),
    chest: () => g('M3 14c0-6 5-9 13-9s13 3 13 9z') + g('M3 14h26v14H3z') + c(16, 19, 2.5, DARK) + k('M3 17h26', 1.2),
    hammer: () => g('M4 6h16l4 4v5H8l-4-4z') + k('M16 15v14', 4.4).replace(INK, '#8a5a2a') + k('M16 15v14', 1.2),
    bed: () => g('M3 14h26v10H3z') + g('M3 8h5v16H3z') + f('M10 10h9v4h-9z', '#f3ead0') + k('M3 24v4M29 24v4', 2.4),
    beer: () => g('M7 6h14v20a2 2 0 01-2 2H9a2 2 0 01-2-2z') + k('M21 10h4a2 2 0 012 2v6a2 2 0 01-2 2h-4', 2.4) + f('M7 6c0-3 14-3 14 0z', '#f3ead0'),
    scale: () => k('M16 4v24M6 28h20M7 8h18', 2.4) + g('M3 16l4-8 4 8c-2 3-6 3-8 0z') + g('M21 16l4-8 4 8c-2 3-6 3-8 0z'),
    camp: () => g('M2 28L16 5l14 23z') + f('M10 28l6-14 6 14z', DARK) + f('M12 26c0-4 3-4 4-8 1 4 4 4 4 8z', RED),
    flagred: () => k('M7 3v26', 2.6) + f('M8 5c6-3 10 3 16 0v13c-6 3-10-3-16 0z', RED),
    bubble: () => g('M4 6h24v16H15l-6 6v-6H4z'),
    virus: () => c(16, 16, 9, GREEN) + k('M16 3v6M16 23v6M3 16h6M23 16h6M7 7l4 4M21 21l4 4M25 7l-4 4M11 21l-4 4', 2.4) + c(13, 14, 1.4, DARK),
    cloud: () => f('M8 24a6 6 0 010-12 8 8 0 0115-2 6 6 0 012 14z', '#d8dee8'),
    lightning: () => f('M18 2L7 17h7l-3 13 14-17h-8z', 'url(#gG)') + k('M18 2L7 17'),
    horn: () => g('M3 14l20-7v18L3 18z') + g('M23 9c4 1 6 4 6 7s-2 6-6 7z'),
    arrowdr: () => g('M6 6l18 18M24 24v-9M24 24h-9'),
    armor: () => g('M9 4L2 10l4 7 3-2v14h14V15l3 2 4-7-7-6-3 3h-6z') + k('M13 7l3 4 3-4M16 11v16', 1.2),
    cape: () => g('M10 4h12l7 24H3z') + k('M10 4c2 5 10 5 12 0M16 10v16', 1.3) + c(16, 8, 1.8, RED),
    footprints: () => f('M9 4c3 0 4 3 3 7s-3 6-5 5-2-4-1-8 1-4 3-4z M9 19c3 0 3 3 2 6-1 3-4 4-5 2s0-8 3-8z', 'url(#gG)') + f('M21 8c3 0 4 3 3 7s-3 6-5 5-2-4-1-8 1-4 3-4z M21 23c3 0 3 3 2 6-1 3-4 4-5 2s0-8 3-8z', 'url(#gG)'),
  };
  // emoji -> icon id (without variation selectors)
  const MAP = {
    '⚔': 'swords', '🗡': 'sword', '🏰': 'town', '🛡': 'shield', '🔥': 'flame', '🐲': 'dragon', '💀': 'skull', '☠': 'skull', '🌀': 'spiral', '🪙': 'coin', '💰': 'sack', '🏆': 'trophy', '🤝': 'clasp', '🏯': 'fort', '🚚': 'cart', '✨': 'sparkle', '⛰': 'mountain', '⚠': 'warn', '💾': 'save', '🎯': 'target', '📖': 'book', '⛺': 'tent', '💣': 'bomb', '🚪': 'door', '💥': 'burst', '🍀': 'clover', '🪨': 'rock', '🌬': 'wind', '📚': 'books', '💍': 'ring', '🔊': 'speaker', '🔇': 'mute', '⚙': 'cogwheel', '🏹': 'bow', '🌲': 'pine', '🔮': 'orb', '💧': 'drop', '⛩': 'shrine', '⛓': 'chains', '⏭': 'skip', '⏩': 'fast', '📋': 'scroll', '📜': 'scroll', '😡': 'fury', '😤': 'fury', '↩': 'back', '🌋': 'volcano', '🔭': 'scope', '🔺': 'obelisk', '🔹': 'obelisk', '⛵': 'ship', '🚢': 'ship', '🗑': 'trash', '⬆': 'up', '⛏': 'pick', '📊': 'chart', '📈': 'chartup', '💔': 'heartbreak', '💫': 'dizzy', '🐌': 'snail', '🙈': 'eyeslash', '💨': 'dash', '✔': 'check', '🥀': 'wilt', '🌫': 'fog', '🔷': 'diamond', '🏳': 'flagw', '🪵': 'log', '🐺': 'wolf', '👹': 'ogre', '🧙': 'mage', '🏇': 'horse', '👑': 'crown', '⚡': 'bolt', '🥾': 'boot', '🪖': 'helm', '📿': 'beads', '🔒': 'lock', '🎒': 'pack', '🏚': 'hut', '💤': 'zzz', '🏛': 'pillars', '📍': 'pin', '☀': 'sun', '🌙': 'moon', '❓': 'qmark', '🙏': 'hands', '😀': 'smile', '😟': 'frown', '😰': 'frown', '😨': 'frown', '🤒': 'frown', '😇': 'smile', '🧪': 'flask', '💠': 'gemblue', '💎': 'gemblue', '🌱': 'sprout', '🌿': 'leaf', '🌴': 'palm', '🌳': 'tree', '❄': 'flake', '⚓': 'anchor', '✖': 'cross', '⏳': 'hourglass', '⏰': 'hourglass', '🏠': 'house', '🌍': 'globe', '📱': 'phone', '🎁': 'gift', '🧰': 'chest', '🔨': 'hammer', '🍺': 'beer', '⚖': 'scale', '🏕': 'camp', '🚩': 'flagred', '🦠': 'virus', '☁': 'cloud', '🌩': 'lightning', '⛈': 'lightning', '📯': 'horn', '↘': 'arrowdr', '🗺': 'book', '🌌': 'spiral', '⭐': 'sparkle', '☰': 'menu', '🏗': 'hammer', '⚒': 'hammer', '🛖': 'hut', '🏋': 'swords', '🌪': 'wind', '👆': 'up', '🟢': 'check', '🔴': 'cross', '💡': 'sparkle', '🔍': 'scope', '🏝': 'palm', '🧱': 'rock', '🐪': 'horse', '🛏': 'bed', '⏸': 'skip', '🌊': 'drop', '⚰': 'chest', '⛲': 'drop', '🎡': 'cogwheel', '🌻': 'sprout', '😨x': 'frown', '🧭': 'target', '⚕': 'flask', '⚗': 'flask', '🧹': 'wilt', '🧞': 'mage', '🧚': 'sparkle', '🧿': 'orb', '🪄': 'sparkle', '🦺': 'armor', '🧣': 'cape', '👢': 'boot', '🩴': 'boot',
  };
  ICONS.menu = () => g('M4 6h24v5H4z') + g('M4 13.5h24v5H4z') + g('M4 21h24v5H4z');
  const DEFS = `<linearGradient id="gG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--ic-hi,#fff0b0)"/><stop offset=".55" style="stop-color:var(--ic-mid,#e0b040)"/><stop offset="1" style="stop-color:var(--ic-lo,#8a5f14)"/></linearGradient>
    <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9a6a"/><stop offset=".6" stop-color="#d8301a"/><stop offset="1" stop-color="#7a1008"/></linearGradient>
    <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a8dcff"/><stop offset=".6" stop-color="#3a86d8"/><stop offset="1" stop-color="#16408a"/></linearGradient>
    <linearGradient id="gN" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ee08a"/><stop offset=".6" stop-color="#3aa04a"/><stop offset="1" stop-color="#145a24"/></linearGradient>
    <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6fa"/><stop offset=".6" stop-color="#a8b0bc"/><stop offset="1" stop-color="#5a6270"/></linearGradient>`;
  const norm = (s) => s.replace(/️/g, '');
  const keys = Object.keys(MAP).filter(x => !/x$/.test(x)).sort((a, b) => b.length - a.length);
  const esc = (x) => Array.from(x).map(ch => '.*+?^${}()|[]\\'.includes(ch) ? '\\' + ch : ch).join('');
  const SRC = '(' + keys.map(esc).join('|') + ')\\uFE0F?', RE = new RegExp(SRC, 'g'), RT = new RegExp(SRC);
  const symbols = Object.keys(ICONS).map(id => `<symbol id="gi-${id}" viewBox="0 0 32 32">${ICONS[id]()}</symbol>`).join('');
  // a painted picture art/icons/ui_<id> replaces the drawn icon when it exists
  const custom = (id) => (typeof Assets !== 'undefined' && Assets.has('icons/ui_' + id)) ? Assets.url('icons/ui_' + id) : null;
  const inner = (id) => { const u = custom(id); return u ? `<img src="${u}" alt="" draggable="false">` : `<svg viewBox="0 0 32 32" aria-hidden="true"><use href="#gi-${id}"/></svg>`; };
  const html = (id, cls = '') => `<span class="gi ${cls}" data-g="${id}">${inner(id)}</span>`;
  // the art list loads after the first screen is drawn: swap icons already on the page, and drop the cached canvas pictures
  if (typeof document !== 'undefined') document.addEventListener('assets-ready', () => {
    for (const k in cache) delete cache[k];
    document.querySelectorAll('.gi[data-g]').forEach(el => { if (!el.querySelector('img') && custom(el.dataset.g)) el.innerHTML = inner(el.dataset.g); });
  });
  const idOf = (ch) => MAP[norm(ch)] || null;
  // ---- DOM replacement ----
  const SKIP = /^(SCRIPT|STYLE|TEXTAREA|OPTION|TITLE|CANVAS|SVG|INPUT)$/;
  function walk(root) {
    if (!root || !root.nodeType) return;
    if (root.nodeType === 3) return fix(root);
    if (root.nodeType !== 1 || SKIP.test(root.tagName) || (root.closest && root.closest('.gi'))) return;
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentNode && !SKIP.test(n.parentNode.tagName) && !(n.parentNode.closest && n.parentNode.closest('.gi')) && RT.test(n.nodeValue)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
    const list = []; while (tw.nextNode()) list.push(tw.currentNode);
    list.forEach(fix);
  }
  function fix(n) {
    if (!n.parentNode || !RT.test(n.nodeValue)) return; RE.lastIndex = 0;
    const frag = document.createDocumentFragment(); let last = 0, m; const s = n.nodeValue;
    while ((m = RE.exec(s))) { if (m.index > last) frag.appendChild(document.createTextNode(s.slice(last, m.index))); const t = document.createElement('span'); t.innerHTML = html(idOf(m[1])); frag.appendChild(t.firstChild); last = m.index + m[0].length; }
    if (last < s.length) frag.appendChild(document.createTextNode(s.slice(last)));
    n.parentNode.replaceChild(frag, n);
  }
  // ---- canvas: icons as images ----
  const cache = {};
  function img(id) {
    if (cache[id]) return cache[id];
    const pic = typeof Assets !== 'undefined' ? Assets.get('icons/ui_' + id) : null; if (pic) return (cache[id] = pic);
    const st = getComputedStyle(document.body), v = (n, d) => st.getPropertyValue(n).trim() || d;
    const defs = DEFS.replace('var(--ic-hi,#fff0b0)', v('--ic-hi', '#fff0b0')).replace('var(--ic-mid,#e0b040)', v('--ic-mid', '#e0b040')).replace('var(--ic-lo,#8a5f14)', v('--ic-lo', '#8a5f14'));
    const i = new Image(); i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="64" height="64"><defs>${defs}</defs>${ICONS[id]()}</svg>`);
    return (cache[id] = i);
  }
  // draws a short text (emoji become icons) centred on x, baseline-ish y; size in px
  function text(ctx, txt, x, y, size, o = {}) {
    const parts = []; let last = 0, m; RE.lastIndex = 0; const s = String(txt);
    while ((m = RE.exec(s))) { if (m.index > last) parts.push({ t: s.slice(last, m.index) }); parts.push({ g: idOf(m[1]) }); last = m.index + m[0].length; }
    if (last < s.length) parts.push({ t: s.slice(last) });
    ctx.save(); ctx.font = (o.font || `bold ${size}px sans-serif`); ctx.textBaseline = 'middle';
    const wd = parts.map(p => p.g ? size : ctx.measureText(p.t).width), total = wd.reduce((a, b) => a + b, 0); let cx = x - total / 2;
    parts.forEach((p, i) => {
      if (p.g) { const im = img(p.g); if (im.complete) ctx.drawImage(im, cx, y - size / 2, size, size); }
      else { if (o.stroke) { ctx.lineWidth = o.lw || 3; ctx.strokeStyle = o.stroke; ctx.strokeText(p.t, cx, y); } ctx.fillStyle = o.fill || '#fff'; ctx.fillText(p.t, cx, y); }
      cx += wd[i];
    });
    ctx.restore();
  }
  function init() {
    const d = document.createElement('div'); d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden'; d.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"><defs>${DEFS}</defs>${symbols}</svg>`; document.body.prepend(d);
    walk(document.body);
    let pend = new Set(), sched = false;
    new MutationObserver((ms) => { for (const m of ms) { if (m.type === 'characterData') pend.add(m.target); else m.addedNodes.forEach(n => pend.add(n)); } if (!sched) { sched = true; requestAnimationFrame(() => { sched = false; const p = pend; pend = new Set(); p.forEach(n => { if (n.isConnected) walk(n); }); }); } }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (typeof document !== 'undefined') { if (document.body) init(); else document.addEventListener('DOMContentLoaded', init); }
  return { html, img, text, idOf, MAP, walk };
})();
