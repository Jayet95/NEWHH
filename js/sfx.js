'use strict';
// Tiny WebAudio synth: no audio files needed. Effects + a soft generative background tune (volumes come from Settings).
const Sfx = (() => {
  let ac = null, on = true, master = null, musicGain = null, mood = 'map', musicTimer = null, step = 0;
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
    const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain(), v = vol * (bus === 'music' ? 1 : sv() * 1.25);
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
    const v = vol * (bus === 'music' ? 1 : sv() * 1.25); if (v <= 0.0002) return;
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
  const BUZZ = { hit: 14, crash: 40, win: [30, 40, 30], level: [20, 30, 20], build: 18, ach: [25, 40, 25] };
  // gentle generative tune: slow minor-pentatonic notes over a low drone; faster and edgier in battle
  const SCALE = { map: [220, 261.6, 293.7, 329.6, 392, 440, 523.3], battle: [196, 233.1, 261.6, 293.7, 349.2, 392, 466.2] };
  function musicTick() {
    if (!on || mv() <= 0.001 || document.hidden || mood !== 'map' || (els.map && !els.map.paused) || !TRACKS.map) return;
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
  const trackVol = () => Math.min(1, mv() * 1.3);
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
      fadeTo(n, trackVol(), 1500);
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
  function ambStart(fac) {
    if (amb && amb.fac === fac) return;
    ambStop(); if (!fac || !on || mv() <= 0.001) return;
    const a = ctx(); if (!a) return;
    const def = AMBS[fac] || AMBS.castle, src = a.createBufferSource(), flt = a.createBiquadFilter(), g = a.createGain();
    src.buffer = noiseBuf(a); src.loop = true; flt.type = def.bed[0]; flt.frequency.value = def.bed[1]; flt.Q.value = def.bed[2]; g.gain.value = 0.0001;
    src.connect(flt); flt.connect(g); g.connect(musicGain); src.start();
    amb = { fac, def, src, g, timer: setInterval(ambTick, 2300) }; ambLevel();
  }
  function applyMood(fromStart) { for (const n in TRACKS) if (n !== mood) stopTrack(n); if (TRACKS[mood]) playTrack(mood, fromStart); }
  function startMusic() { if (musicTimer) return; musicTimer = setInterval(musicTick, 900); }
  return {
    play(n) { try { if (S[n]) S[n](); if (BUZZ[n] && typeof Settings !== 'undefined') Settings.buzz(BUZZ[n]); } catch (e) { /* ignore */ } },
    ambience(fac) { try { ambStart(fac); } catch (e) { /* ignore */ } },
    unlock() { gest = true; },
    toggle() { on = !on; if (!on) { for (const n in els) els[n].pause(); ambStop(); } else applyMood(false); try { localStorage.setItem('h3js_snd', on ? '1' : '0'); } catch (e) { /* ignore */ } return on; },
    get on() { return on; },
    mood(m) { if (m === mood) return; mood = m; applyMood(m !== 'map'); },
    refresh() { ambLevel(); for (const n in els) { if (els[n].paused) continue; if (!on || mv() <= 0.001) els[n].pause(); else if (n === mood) els[n].volume = trackVol(); } if (TRACKS[mood] && on && mv() > 0.001 && els[mood] && els[mood].paused) playTrack(mood, false); },
    resume() { applyMood(false); },
    startMusic,
  };
})();
// browsers only allow sound after a gesture: start the tune on the first tap or key press
if (typeof document !== 'undefined') { const go = () => { Sfx.unlock(); Sfx.startMusic(); Sfx.resume(); document.removeEventListener('pointerdown', go); document.removeEventListener('keydown', go); }; document.addEventListener('pointerdown', go); document.addEventListener('keydown', go); }
