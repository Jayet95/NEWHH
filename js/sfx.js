'use strict';
// Tiny WebAudio synth: no audio files needed.
const Sfx = (() => {
  let ac = null, on = true;
  try { on = localStorage.getItem('h3js_snd') !== '0'; } catch (e) { /* ignore */ }
  const ctx = () => {
    if (!ac) { const A = window.AudioContext || window.webkitAudioContext; if (A) ac = new A(); }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  };
  function tone(f, d = 0.1, type = 'square', vol = 0.05, slide = 0, delay = 0) {
    if (!on) return;
    const a = ctx(); if (!a) return;
    const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + d);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + 0.02);
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
  };
  return {
    play(n) { try { if (S[n]) S[n](); } catch (e) { /* ignore */ } },
    toggle() { on = !on; try { localStorage.setItem('h3js_snd', on ? '1' : '0'); } catch (e) { /* ignore */ } return on; },
    get on() { return on; },
  };
})();
