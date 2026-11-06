'use strict';
// Tiny WebAudio synth: no audio files needed. Effects + a soft generative background tune (volumes come from Settings).
const Sfx = (() => {
  let ac = null, on = true, master = null, musicGain = null, mood = 'map', musicTimer = null, step = 0;
  try { on = localStorage.getItem('h3js_snd') !== '0'; } catch (e) { /* ignore */ }
  const sv = () => (typeof Settings !== 'undefined' ? Settings.sfxVol : 0.8), mv = () => (typeof Settings !== 'undefined' ? Settings.musicVol : 0.35);
  const ctx = () => {
    if (!ac) {
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
  const S = {
    click: () => tone(520, 0.05, 'triangle', 0.04),
    step: () => tone(180, 0.04, 'triangle', 0.03),
    hit: () => { tone(160, 0.12, 'sawtooth', 0.07, -80); tone(90, 0.1, 'square', 0.05, -30, 0.02); },
    shoot: () => tone(700, 0.1, 'triangle', 0.05, -400),
    spell: () => { tone(400, 0.25, 'sine', 0.06, 500); tone(600, 0.25, 'sine', 0.04, 500, 0.05); },
    crash: () => { tone(110, 0.3, 'sawtooth', 0.08, -60); tone(70, 0.35, 'square', 0.06, -20, 0.05); },
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
    if (!on || mv() <= 0.001 || document.hidden || mood !== 'map') return;
    const a = ctx(); if (!a) return;
    const sc = SCALE[mood], vol = 0.035 * mv() * 2.2;
    const f = sc[(step * 3 + ((Math.random() * 3) | 0)) % sc.length] * (Math.random() < 0.2 ? 2 : 1);
    tone(f, mood === 'battle' ? 0.5 : 1.6, 'triangle', vol, 0, 0, 'music');
    if (step % 4 === 0) tone(sc[0] / 2, 3.2, 'sine', vol * 0.9, 0, 0, 'music');
    step++;
  }
  // recorded music: audio/menu.mp3 on the title screen, audio/battle.mp3 in fights; the generated tune covers the map
  const TRACKS = { menu: 'audio/menu.mp3', battle: 'audio/battle.mp3' };
  const els = {}; let cur = null, fade = {};
  const trackVol = () => Math.min(1, mv() * 1.3);
  const trackEl = (n) => { if (!els[n]) { els[n] = new Audio(TRACKS[n]); els[n].loop = true; els[n].preload = 'auto'; } return els[n]; };
  function fadeTo(n, target, ms, then) {
    const el = trackEl(n); clearInterval(fade[n]); const stepMs = 40, k = Math.max(1, Math.round(ms / stepMs)), v0 = el.volume, d = (target - v0) / k; let i = 0;
    fade[n] = setInterval(() => { i++; el.volume = Math.max(0, Math.min(1, v0 + d * i)); if (i >= k) { clearInterval(fade[n]); if (then) then(); } }, stepMs);
  }
  function stopTrack(n) { if (!els[n] || els[n].paused) return; fadeTo(n, 0, 700, () => els[n].pause()); }
  function playTrack(n, fromStart) {
    try {
      if (!TRACKS[n] || !on || mv() <= 0.001) return;
      const el = trackEl(n); if (fromStart) el.currentTime = 0; if (el.paused) { el.volume = 0; const p = el.play(); if (p && p.catch) p.catch(() => { /* needs a tap first; retried on the first gesture */ }); }
      fadeTo(n, trackVol(), 900);
    } catch (e) { /* ignore */ }
  }
  function applyMood(fromStart) { for (const n in TRACKS) if (n !== mood) stopTrack(n); if (TRACKS[mood]) playTrack(mood, fromStart); }
  function startMusic() { if (musicTimer) return; musicTimer = setInterval(musicTick, 900); }
  return {
    play(n) { try { if (S[n]) S[n](); if (BUZZ[n] && typeof Settings !== 'undefined') Settings.buzz(BUZZ[n]); } catch (e) { /* ignore */ } },
    toggle() { on = !on; if (!on) { for (const n in els) els[n].pause(); } else applyMood(false); try { localStorage.setItem('h3js_snd', on ? '1' : '0'); } catch (e) { /* ignore */ } return on; },
    get on() { return on; },
    mood(m) { if (m === mood) return; mood = m; applyMood(true); },
    refresh() { for (const n in els) { if (els[n].paused) continue; if (!on || mv() <= 0.001) els[n].pause(); else if (n === mood) els[n].volume = trackVol(); } if (TRACKS[mood] && on && mv() > 0.001 && els[mood] && els[mood].paused) playTrack(mood, false); },
    resume() { applyMood(false); },
    startMusic,
  };
})();
// browsers only allow sound after a gesture: start the tune on the first tap or key press
if (typeof document !== 'undefined') { const go = () => { Sfx.startMusic(); Sfx.resume(); document.removeEventListener('pointerdown', go); document.removeEventListener('keydown', go); }; document.addEventListener('pointerdown', go); document.addEventListener('keydown', go); }
