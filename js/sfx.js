'use strict';
// Tiny WebAudio synth: no audio files needed. Effects + a soft generative background tune (volumes come from Settings).
const Sfx = (() => {
  let qmul = 1, ac = null, on = true, master = null, musicGain = null, mood = 'map', musicTimer = null, step = 0;
  try { on = localStorage.getItem('h3js_snd') !== '0'; } catch (e) { /* ignore */ }
  const sv = () => (typeof Settings !== 'undefined' ? Settings.sfxVol : 0.8), mv = () => (typeof Settings !== 'undefined' ? Settings.musicVol : 0.35);
  // browsers only let sound start after a tap or key press; before that stay silent instead of spamming console warnings
  let gest = false;
  const unlocked = () => (typeof navigator !== 'undefined' && navigator.userActivation ? navigator.userActivation.hasBeenActive : gest);
  const ctx = () => {
    if (!ac) {
      if (!unlocked()) return null;
      const A = window.AudioContext || window.webkitAudioContext;
      if (A) { ac = new A(); master = ac.createGain(); master.connect(ac.destination); musicGain = ac.createGain(); musicGain.connect(ac.destination); }
    }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  };
  function tone(f, d = 0.1, type = 'square', vol = 0.05, slide = 0, delay = 0, bus) {
    if (!on) return;
    const a = ctx(); if (!a) return;
    const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain(), v = vol * (bus === 'music' ? 1 : sv() * 1.25 * qmul);
    if (v <= 0.0002) return;
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(bus === 'music' ? musicGain : master); o.start(t); o.stop(t + d + 0.02);
  }
  const seq = (notes, d, type, vol, gap) => notes.forEach((f, i) => tone(f, d, type, vol, 0, i * gap));
  // filtered noise burst: whooshes, thuds, rustle. f = filter centre, sweep = how far it glides, bus 'music' skips the effects volume
  let nbuf = null;
  const noiseBuf = (a) => nbuf || (nbuf = (() => { const b = a.createBuffer(1, a.sampleRate * 2, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; })());
  function noise(d = 0.1, vol = 0.05, f = 1200, q = 0.7, type = 'bandpass', delay = 0, sweep = 0, bus) {
    if (!on) return;
    const a = ctx(); if (!a) return;
    const v = vol * (bus === 'music' ? 1 : sv() * 1.25 * qmul); if (v <= 0.0002) return;
    const t = a.currentTime + delay, s = a.createBufferSource(), flt = a.createBiquadFilter(), g = a.createGain();
    s.buffer = noiseBuf(a); s.loop = true; flt.type = type; flt.Q.value = q; flt.frequency.setValueAtTime(f, t);
    if (sweep) flt.frequency.exponentialRampToValueAtTime(Math.max(60, f + sweep), t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + Math.min(0.012, d / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(flt); flt.connect(g); g.connect(bus === 'music' ? musicGain : master); s.start(t, Math.random()); s.stop(t + d + 0.02);
  }
  let foot = 0;
  const footstep = () => { foot ^= 1; noise(0.06, 0.05, foot ? 240 : 300, 1.1, 'lowpass'); tone(foot ? 150 : 170, 0.05, 'sine', 0.03, -40); };
  const S = {
    click: () => tone(520, 0.05, 'triangle', 0.04),
    tick: () => { tone(1900, 0.02, 'sine', 0.01); noise(0.015, 0.01, 5000, 1, 'highpass'); },
    step: footstep,
    foot: footstep,
    hit: () => { noise(0.1, 0.09, 1500, 0.8, 'bandpass', 0, -1000); tone(160, 0.12, 'sawtooth', 0.06, -80); tone(90, 0.1, 'square', 0.045, -30, 0.02); },
    shoot: () => { noise(0.18, 0.05, 1900, 1.4, 'bandpass', 0, -1300); tone(700, 0.1, 'triangle', 0.04, -400); },
    spell: () => { tone(400, 0.25, 'sine', 0.06, 500); tone(600, 0.25, 'sine', 0.04, 500, 0.05); noise(0.4, 0.035, 2200, 3, 'bandpass', 0, 2600); [1300, 1700, 2200].forEach((f, i) => tone(f, 0.12, 'sine', 0.018, 0, 0.12 + i * 0.07)); },
    crash: () => { tone(110, 0.3, 'sawtooth', 0.08, -60); tone(70, 0.35, 'square', 0.06, -20, 0.05); noise(0.4, 0.07, 900, 0.7, 'lowpass', 0, -700); },
    death: () => { tone(230, 0.55, 'sawtooth', 0.045, -150); tone(110, 0.65, 'sine', 0.06, -55, 0.05); noise(0.5, 0.05, 700, 0.8, 'lowpass', 0.02, -520); },
    coin: () => { tone(880, 0.07, 'square', 0.04); tone(1320, 0.12, 'square', 0.04, 0, 0.07); },
    build: () => seq([220, 330, 440], 0.1, 'square', 0.05, 0.09),
    level: () => seq([523, 659, 784, 988, 1319], 0.14, 'triangle', 0.06, 0.09),
    fanfare: () => seq([523, 659, 784, 1047, 784, 1047, 1319, 1568], 0.2, 'triangle', 0.06, 0.15),
    win: () => seq([523, 659, 784, 1047], 0.18, 'triangle', 0.06, 0.14),
    lose: () => seq([392, 330, 262, 196], 0.22, 'sawtooth', 0.05, 0.18),
    turn: () => tone(330, 0.1, 'sine', 0.04),
    day: () => seq([392, 523], 0.12, 'sine', 0.05, 0.1),
    ach: () => seq([659, 880, 1175, 1568], 0.16, 'triangle', 0.06, 0.1),
  };
  // ---- creature voices ----
  // Each creature has its own attack, defend (hurt), death and (for shooters) shot sound. A recording audio/sfx/<creature id>_<kind>.mp3
  // (kind: attack, defend, death, shoot; listed in audio/sfx/index.json by `npm run art`) is used when it exists; otherwise a voice is
  // synthesised from the creature's kind (bellow, hiss, screech, rattle ...) and a pitch that is different for every creature.
  const VOICE = {
    goblin: 'grunt', stronghold1: 'grunt', wolf: 'growl', stronghold2: 'growl', orc: 'grunt', stronghold3: 'grunt', ogre: 'bellow', stronghold4: 'bellow', troll: 'bellow', golem: 'stone', tower3: 'stone',
    naga: 'hiss', tower6: 'hiss', dragon: 'roar', rampart7: 'roar', shark: 'growl', kraken: 'wet',
    castle1: 'human', castle2: 'human', castle3: 'screech', castle4: 'human', castle5: 'chant', castle6: 'human', castle7: 'chant',
    rampart1: 'human', rampart2: 'grunt', rampart3: 'elf', rampart4: 'screech', rampart5: 'wood', rampart6: 'chant',
    tower1: 'imp', tower2: 'stone', tower4: 'chant', tower5: 'chant', tower7: 'bellow',
    inferno1: 'imp', inferno2: 'imp', inferno3: 'growl', inferno4: 'bellow', inferno5: 'bellow', inferno6: 'fire', inferno7: 'roar',
    necropolis1: 'bone', necropolis2: 'rasp', necropolis3: 'rasp', necropolis4: 'rasp', necropolis5: 'rasp', necropolis6: 'rasp', necropolis7: 'roar',
    dungeon1: 'grunt', dungeon2: 'screech', dungeon3: 'eye', dungeon4: 'hiss', dungeon5: 'bellow', dungeon6: 'growl', dungeon7: 'roar',
    stronghold5: 'screech', stronghold6: 'bellow', stronghold7: 'roar',
    fortress1: 'grunt', fortress2: 'hiss', fortress3: 'buzz', fortress4: 'hiss', fortress5: 'bellow', fortress6: 'screech', fortress7: 'hiss',
    conflux1: 'chant', conflux2: 'air', conflux3: 'water', conflux4: 'fire', conflux5: 'stone', conflux6: 'eye', conflux7: 'fire',
    faerie: 'chant', rustd: 'roar', crystald: 'roar', azured: 'roar',
  };
  // kind -> [oscillator, base Hz, length, pitch slide, noise centre Hz, noise Q, noise filter]
  const VP = {
    grunt: ['sawtooth', 150, 0.14, -60, 700, 1.2, 'bandpass'], growl: ['sawtooth', 95, 0.26, -30, 400, 0.9, 'lowpass'], bellow: ['sawtooth', 80, 0.3, -20, 300, 0.8, 'lowpass'], roar: ['sawtooth', 70, 0.5, -25, 600, 0.9, 'bandpass'],
    screech: ['sawtooth', 900, 0.22, 500, 3000, 1.5, 'bandpass'], hiss: ['sine', 420, 0.3, -60, 5000, 0.8, 'highpass'], rasp: ['square', 130, 0.2, -40, 1200, 2, 'bandpass'], bone: ['square', 420, 0.06, -100, 2600, 3, 'bandpass'],
    stone: ['square', 90, 0.3, -20, 420, 0.8, 'lowpass'], human: ['triangle', 260, 0.12, -60, 1800, 1.5, 'bandpass'], chant: ['sine', 520, 0.25, 120, 2600, 2.5, 'bandpass'], elf: ['triangle', 700, 0.1, -200, 3200, 1.2, 'highpass'],
    imp: ['square', 420, 0.1, -150, 2200, 1.4, 'bandpass'], wood: ['sawtooth', 120, 0.25, -30, 500, 0.9, 'lowpass'], eye: ['sine', 300, 0.35, 300, 2000, 2, 'bandpass'], buzz: ['sawtooth', 220, 0.25, 6, 2800, 1, 'bandpass'],
    air: ['sine', 600, 0.35, 300, 1500, 0.9, 'bandpass'], water: ['sine', 300, 0.3, -100, 800, 0.8, 'lowpass'], fire: ['sawtooth', 140, 0.3, -30, 2500, 0.8, 'highpass'], wet: ['sine', 110, 0.18, -60, 600, 0.8, 'lowpass'],
  };
  function voice(kind, which, p) {
    const [type, f, d, sl, nf, nq, nt] = VP[kind] || VP.grunt;
    if (which === 'attack') {
      tone(f * p, d, type, 0.05, sl * p); noise(d * 0.9, 0.045, nf * p, nq, nt, 0, nt === 'highpass' ? 0 : -nf * 0.4);
      if (kind === 'bone' || kind === 'imp') { tone(f * p * 1.2, d, type, 0.04, sl, d * 0.9); tone(f * p * 0.9, d, type, 0.035, sl, d * 1.8); }
    } else if (which === 'defend') { tone(f * p * 1.3, d * 0.8, type, 0.04, -Math.abs(sl) * p - 40); noise(d * 0.7, 0.03, nf * p * 1.2, nq, nt); }
    else { tone(f * p * 0.9, d * 3, type, 0.05, -f * p * 0.5); noise(d * 3, 0.04, nf * p * 0.6, nq, nt === 'highpass' ? 'bandpass' : nt, 0.02, -nf * 0.3); }
  }
  // the sound of each kind of shot leaving the shooter
  const SHOT = {
    bolt: () => { noise(0.08, 0.06, 500, 1, 'lowpass'); tone(200, 0.1, 'square', 0.05, -90); },
    twin: () => { S.shoot(); tone(900, 0.06, 'triangle', 0.025, -300, 0.07); },
    glow: () => { noise(0.14, 0.04, 3400, 1.2, 'highpass', 0, -1500); tone(1100, 0.12, 'sine', 0.03, -500); },
    javelin: () => noise(0.3, 0.06, 700, 1.2, 'bandpass', 0, 1200),
    zap: () => { noise(0.22, 0.06, 4200, 1, 'highpass'); tone(1400, 0.2, 'sawtooth', 0.035, -1000); },
    fire: () => { noise(0.35, 0.07, 800, 0.8, 'bandpass', 0, 900); tone(120, 0.3, 'sawtooth', 0.04, 80); },
    holy: () => { tone(880, 0.3, 'sine', 0.045, 0); tone(1320, 0.35, 'sine', 0.03, 0, 0.05); tone(1760, 0.3, 'sine', 0.02, 0, 0.1); },
    death: () => { tone(180, 0.5, 'sine', 0.06, -70); noise(0.45, 0.04, 600, 1, 'lowpass', 0, -300); },
    venom: () => { noise(0.1, 0.05, 1800, 1.4, 'bandpass', 0, -900); tone(500, 0.1, 'sine', 0.04, -200); },
    rock: () => { tone(100, 0.25, 'square', 0.06, -40); noise(0.3, 0.06, 350, 0.8, 'lowpass'); },
    ball: () => { tone(90, 0.3, 'sawtooth', 0.07, -40); noise(0.35, 0.06, 600, 0.8, 'lowpass', 0, -300); },
    gaze: () => tone(900, 0.4, 'sine', 0.045, -500),
    orb: () => { tone(400, 0.3, 'sine', 0.05, 300); noise(0.3, 0.03, 1800, 2, 'bandpass', 0, 1200); },
  };
  let vidx = null, vlast = 0;
  function loadVoiceIndex() {
    if (vidx) return; vidx = {};
    try { fetch('audio/sfx/index.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : [])).then(l => { (l || []).forEach(f => { vidx[String(f).replace(/\.[a-z0-9]+$/i, '')] = f; }); }).catch(() => { /* none */ }); } catch (e) { /* ignore */ }
  }
  function playVoiceFile(name) {
    const f = vidx && vidx[name]; if (!f || !on || !ctx()) return false;
    const el = new Audio('audio/sfx/' + f); el.volume = Math.min(1, sv() * 0.45); const p = el.play(); if (p && p.catch) p.catch(() => { /* needs a tap first */ }); return true;
  }
  function creatureVoice(id, kind, shot) {
    const now = performance.now(); if (now - vlast < 45) return; vlast = now;   // a splash hitting several stacks must not turn into noise
    loadVoiceIndex(); const base = String(id).replace(/_\d$/, '');
    if (playVoiceFile(id + '_' + kind) || playVoiceFile(base + '_' + kind)) return;
    if (!on) return;
    if (kind === 'shoot') { qmul = 0.5; try { (SHOT[shot] || S.shoot)(); } finally { qmul = 1; } return; }
    let h = 7; for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) % 997;
    qmul = 0.45;     // creature voices sit quietly under the music and the main hit sounds
    try { voice(VOICE[base] || 'grunt', kind, 0.86 + (h % 40) / 100); } finally { qmul = 1; }
  }
  const BUZZ = { hit: 14, crash: 40, win: [30, 40, 30], level: [20, 30, 20], build: 18, ach: [25, 40, 25] };
  // gentle generative tune: slow minor-pentatonic notes over a low drone; faster and edgier in battle
  const SCALE = { map: [220, 261.6, 293.7, 329.6, 392, 440, 523.3], battle: [196, 233.1, 261.6, 293.7, 349.2, 392, 466.2] };
  function musicTick() {
    if (!on || mv() <= 0.001 || document.hidden || mood !== 'map' || (els[wanted('map')] && !els[wanted('map')].paused) || !TRACKS[wanted('map')]) return;
    const a = ctx(); if (!a) return;
    const sc = SCALE[mood], vol = 0.035 * mv() * 2.2;
    const f = sc[(step * 3 + ((Math.random() * 3) | 0)) % sc.length] * (Math.random() < 0.2 ? 2 : 1);
    tone(f, mood === 'battle' ? 0.5 : 1.6, 'triangle', vol, 0, 0, 'music');
    if (step % 4 === 0) tone(sc[0] / 2, 3.2, 'sine', vol * 0.9, 0, 0, 'music');
    step++;
  }
  // recorded music: audio/menu.mp3 on the title screen, audio/map.mp3 on the adventure map, audio/battle.mp3 in fights
  const TRACKS = { menu: 'audio/menu.mp3', map: 'audio/map.mp3', battle: 'audio/battle.mp3' };
  const els = {}; let cur = null, fade = {};
  let fac = null, prevMood = 'map', midx = null;
  // castle themes: audio/music/<castle>_<town|battle|map>.mp3 (listed in audio/music/index.json by `npm run art`) replace the general track
  // for that mood while that castle is yours; they play quietly (CASTLE_VOL of the normal music volume)
  const CASTLE_VOL = 0.5;
  function loadMusicIndex() {
    if (midx) return; midx = {};
    try { fetch('audio/music/index.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : [])).then(l => { (l || []).forEach(f => { const q = String(f).replace(/\.[a-z0-9]+$/i, '').split('_'); if (q.length === 2) TRACKS[q[1] + ':' + q[0]] = 'audio/music/' + f; }); if (fac) applyMood(false); }).catch(() => { /* none */ }); } catch (e) { /* ignore */ }
  }
  const wanted = (m) => (fac && TRACKS[(m || mood) + ':' + fac]) ? (m || mood) + ':' + fac : (m || mood);
  // the winning song (audio/victory.mp3) plays once and holds the other music down while it does
  let vic = null; const duck = () => (vic && !vic.paused && !vic.ended ? 0.15 : 1);
  const trackVol = (n) => Math.min(1, mv() * 1.3) * (String(n || wanted()).indexOf(':') > 0 ? CASTLE_VOL : 1) * duck();
  function victory() {
    if (!on || mv() <= 0.001 || !ctx()) return false;
    try {
      if (!vic) { vic = new Audio('audio/victory.mp3'); vic.preload = 'auto'; vic.addEventListener('ended', () => { for (const n in els) if (!els[n].paused) fadeTo(n, trackVol(n), 1400); }); vic.addEventListener('error', () => { vic = null; }); }
      vic.currentTime = 0; vic.volume = Math.min(1, mv() * 1.4);
      for (const n in els) if (!els[n].paused) fadeTo(n, trackVol(n) * 0.15, 500);
      const p = vic.play(); if (p && p.catch) p.catch(() => { vic = null; }); return true;
    } catch (e) { return false; }
  }
  const trackEl = (n) => { if (!els[n]) { els[n] = new Audio(TRACKS[n]); els[n].loop = true; els[n].preload = 'auto'; } return els[n]; };
  function fadeTo(n, target, ms, then) {
    // equal-power curves (sine in, cosine out) so a mood change is a smooth crossfade with no dip in loudness
    const el = trackEl(n); clearInterval(fade[n]); const stepMs = 40, k = Math.max(1, Math.round(ms / stepMs)), v0 = el.volume, up = target > v0; let i = 0;
    fade[n] = setInterval(() => { i++; const t = Math.min(1, i / k), f = up ? Math.sin(t * Math.PI / 2) : 1 - Math.cos(t * Math.PI / 2); el.volume = Math.max(0, Math.min(1, v0 + (target - v0) * f)); if (i >= k) { clearInterval(fade[n]); if (then) then(); } }, stepMs);
  }
  function stopTrack(n) { if (!els[n] || els[n].paused) return; fadeTo(n, 0, 1400, () => els[n].pause()); }
  function playTrack(n, fromStart) {
    try {
      if (!TRACKS[n] || !on || mv() <= 0.001) return;
      const el = trackEl(n); if (fromStart) el.currentTime = 0; if (el.paused) { el.volume = 0; const p = el.play(); if (p && p.catch) p.catch(() => { /* needs a tap first; retried on the first gesture */ }); }
      fadeTo(n, trackVol(n), 1500);
    } catch (e) { /* ignore */ }
  }
  // ---- quiet, synthesised ambience for the town screen: a filtered noise bed plus a few random sounds per castle ----
  let amb = null;
  const ambK = () => Math.min(1.2, mv() * 2.2);
  const rr = (a, b) => a + Math.random() * (b - a);
  const AMBS = {
    castle: { bed: ['lowpass', 380, 0.4, 0.5], ev: (k) => { const f = [523, 659, 784][(Math.random() * 3) | 0]; tone(f, 2.6, 'sine', 0.012 * k, 0, 0, 'music'); tone(f * 2.01, 1.8, 'sine', 0.005 * k, 0, 0.02, 'music'); } },
    rampart: { bed: ['bandpass', 900, 0.6, 0.45], ev: (k) => { for (let i = 0; i < 3; i++) tone(rr(2400, 3300), 0.07, 'sine', 0.01 * k, 900, i * 0.11, 'music'); } },
    tower: { bed: ['lowpass', 260, 0.7, 0.3], ev: (k) => { const b = 660 * Math.pow(1.5, (Math.random() * 3) | 0); [0, 1, 2].forEach(i => tone(b * (1 + i * 0.5), 1.4, 'sine', 0.008 * k, 0, i * 0.18, 'music')); } },
    inferno: { bed: ['lowpass', 150, 0.8, 0.8], ev: (k) => { for (let i = 0; i < 4; i++) noise(0.04, 0.02 * k, rr(2500, 4500), 2, 'bandpass', i * 0.07 + Math.random() * 0.05, 0, 'music'); } },
    necropolis: { bed: ['bandpass', 500, 2.5, 0.5], ev: (k) => { tone(98, 3.2, 'sine', 0.018 * k, -10, 0, 'music'); noise(2.4, 0.012 * k, 700, 3, 'bandpass', 0, 400, 'music'); } },
    dungeon: { bed: ['lowpass', 220, 0.6, 0.55], ev: (k) => { const f = rr(900, 1400); tone(f, 0.09, 'sine', 0.02 * k, -250, 0, 'music'); tone(f * 0.98, 0.14, 'sine', 0.008 * k, -250, 0.18, 'music'); } },
    stronghold: { bed: ['lowpass', 300, 0.5, 0.4], ev: (k) => { tone(70, 0.28, 'sine', 0.04 * k, -25, 0, 'music'); tone(70, 0.28, 'sine', 0.03 * k, -25, 0.34, 'music'); } },
    fortress: { bed: ['bandpass', 700, 1.2, 0.4], ev: (k) => { tone(rr(140, 230), 0.16, 'sine', 0.02 * k, 160, 0, 'music'); noise(0.5, 0.008 * k, 6500, 6, 'bandpass', 0.2, 0, 'music'); } },
    conflux: { bed: ['bandpass', 1100, 0.8, 0.35], ev: (k) => { const f = rr(880, 1760); tone(f, 1.8, 'triangle', 0.007 * k, f * 0.5, 0, 'music'); noise(1.4, 0.01 * k, 1200, 1.5, 'bandpass', 0, 2400, 'music'); } },
  };
  const townOpen = () => { const m = document.getElementById('modal'); return !!(m && !m.classList.contains('hide') && document.getElementById('tcv')); };
  function ambStop() {
    if (mood === 'town') { mood = prevMood; applyMood(false); }
    if (!amb) return; const o = amb; amb = null; clearInterval(o.timer);
    try { const t = ac.currentTime; o.g.gain.cancelScheduledValues(t); o.g.gain.setTargetAtTime(0.0001, t, 0.5); o.src.stop(t + 2.5); } catch (e) { /* ignore */ }
  }
  function ambLevel() { if (amb && ac) amb.g.gain.setTargetAtTime(!on || mv() <= 0.001 ? 0.0001 : 0.02 * amb.def.bed[3] * ambK(), ac.currentTime, 0.4); }
  function ambTick() {
    if (!amb) return;
    if (!townOpen()) { ambStop(); return; }
    if (!on || mv() <= 0.001 || document.hidden || Math.random() < 0.3) return;
    amb.def.ev(ambK());
  }
  function ambStart(f) {
    if (amb && amb.fac === f) return;
    ambStop(); if (!f || !on || mv() <= 0.001) return;
    fac = f; if (TRACKS['town:' + f]) { prevMood = mood === 'town' ? 'map' : mood; mood = 'town'; applyMood(false); }
    const a = ctx(); if (!a) return;
    const def = AMBS[f] || AMBS.castle, src = a.createBufferSource(), flt = a.createBiquadFilter(), g = a.createGain();
    src.buffer = noiseBuf(a); src.loop = true; flt.type = def.bed[0]; flt.frequency.value = def.bed[1]; flt.Q.value = def.bed[2]; g.gain.value = 0.0001;
    src.connect(flt); flt.connect(g); g.connect(musicGain); src.start();
    amb = { fac: f, def, src, g, timer: setInterval(ambTick, 2300) }; ambLevel();
  }
  function applyMood(fromStart) { if (vic && !vic.paused && mood === 'battle') vic.pause(); loadMusicIndex(); const w = wanted(); for (const n in TRACKS) if (n !== w) stopTrack(n); if (TRACKS[w]) playTrack(w, fromStart); }
  function startMusic() { if (musicTimer) return; musicTimer = setInterval(musicTick, 900); }
  return {
    play(n) { try { if (S[n]) S[n](); if (BUZZ[n] && typeof Settings !== 'undefined') Settings.buzz(BUZZ[n]); } catch (e) { /* ignore */ } },
    ambience(fac) { try { ambStart(fac); } catch (e) { /* ignore */ } },
    victory() { try { return victory(); } catch (e) { return false; } },
    setFaction(f) { if (f === fac) return; fac = f; applyMood(false); },
    creature(id, kind, shot) { try { creatureVoice(id, kind, shot); } catch (e) { /* ignore */ } },
    unlock() { gest = true; },
    toggle() { on = !on; if (!on) { for (const n in els) els[n].pause(); ambStop(); } else applyMood(false); try { localStorage.setItem('h3js_snd', on ? '1' : '0'); } catch (e) { /* ignore */ } return on; },
    get on() { return on; },
    mood(m) { if (m === mood) return; mood = m; applyMood(m !== 'map'); },
    refresh() { ambLevel(); for (const n in els) { if (els[n].paused) continue; if (!on || mv() <= 0.001) els[n].pause(); else if (n === wanted()) els[n].volume = trackVol(n); } if (TRACKS[wanted()] && on && mv() > 0.001 && els[wanted()] && els[wanted()].paused) playTrack(wanted(), false); },
    resume() { applyMood(false); },
    startMusic,
  };
})();
// browsers only allow sound after a gesture: start the tune on the first tap or key press
if (typeof document !== 'undefined') { const go = () => { Sfx.unlock(); Sfx.startMusic(); Sfx.resume(); document.removeEventListener('pointerdown', go); document.removeEventListener('keydown', go); }; document.addEventListener('pointerdown', go); document.addEventListener('keydown', go); }
