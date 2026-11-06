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
    if (!on || mv() <= 0.001 || document.hidden || mood === 'battle') return;
    const a = ctx(); if (!a) return;
    const sc = SCALE[mood], vol = 0.035 * mv() * 2.2;
    const f = sc[(step * 3 + ((Math.random() * 3) | 0)) % sc.length] * (Math.random() < 0.2 ? 2 : 1);
    tone(f, mood === 'battle' ? 0.5 : 1.6, 'triangle', vol, 0, 0, 'music');
    if (step % 4 === 0) tone(sc[0] / 2, 3.2, 'sine', vol * 0.9, 0, 0, 'music');
    step++;
  }
  // battle music: an mp3 (audio/battle.mp3) that fades in when a fight starts and out when it ends
  let track = null, fade = null, tracking = false;
  const trackVol = () => Math.min(1, mv() * 1.3);
  const trackEl = () => { if (!track) { track = new Audio('audio/battle.mp3'); track.loop = true; track.preload = 'auto'; } return track; };
  function fadeTo(el, target, ms, then) {
    clearInterval(fade); const stepMs = 40, n = Math.max(1, Math.round(ms / stepMs)), v0 = el.volume, d = (target - v0) / n; let i = 0;
    fade = setInterval(() => { i++; el.volume = Math.max(0, Math.min(1, v0 + d * i)); if (i >= n) { clearInterval(fade); if (then) then(); } }, stepMs);
  }
  function battleMusic(start) {
    try {
      if (start) {
        if (!on || mv() <= 0.001) return;
        const el = trackEl(); tracking = true; el.currentTime = 0; el.volume = 0; const p = el.play(); if (p && p.catch) p.catch(() => { tracking = false; });
        fadeTo(el, trackVol(), 900);
      } else if (track && tracking) { tracking = false; fadeTo(track, 0, 700, () => track.pause()); }
    } catch (e) { /* ignore */ }
  }
  function startMusic() { if (musicTimer) return; musicTimer = setInterval(musicTick, 900); }
  return {
    play(n) { try { if (S[n]) S[n](); if (BUZZ[n] && typeof Settings !== 'undefined') Settings.buzz(BUZZ[n]); } catch (e) { /* ignore */ } },
    toggle() { on = !on; if (!on && track) { track.pause(); tracking = false; } try { localStorage.setItem('h3js_snd', on ? '1' : '0'); } catch (e) { /* ignore */ } return on; },
    get on() { return on; },
    mood(m) { const was = mood; mood = m; if (m === 'battle' && was !== 'battle') battleMusic(true); else if (m !== 'battle' && was === 'battle') battleMusic(false); },
    refresh() { if (track && tracking) { if (!on || mv() <= 0.001) { track.pause(); tracking = false; } else track.volume = trackVol(); } },
    startMusic,
  };
})();
// browsers only allow sound after a gesture: start the tune on the first tap or key press
if (typeof document !== 'undefined') { const go = () => { Sfx.startMusic(); document.removeEventListener('pointerdown', go); document.removeEventListener('keydown', go); }; document.addEventListener('pointerdown', go); document.addEventListener('keydown', go); }
