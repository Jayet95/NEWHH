'use strict';
// Music director: plays recorded tracks by place (see MUSIC_MAP.md). Drop mp3 files into audio/music/ named
//   <slot>_<n>.mp3     e.g. map_grass_1.mp3, map_grass_2.mp3, battle_siege_attack_1.mp3, inferno_town_1.mp3 (n may be left out)
// run `npm run art` (it lists audio/music in audio/music/index.json) and the game picks them up. Several files of a slot form a
// shuffled playlist (never the same tune twice in a row) that crossfades from one tune to the next. A place with no files falls back
// to the shorter list (map_sand -> map) and finally to the older tracks in js/sfx.js (audio/map.mp3 and so on), so nothing breaks while
// the set is incomplete. One-shot pieces (victory, defeat, level up...) are "stings": the music ducks while they play.
const Music = (() => {
  const DIR = 'audio/music/', FADE = 2200, MIN_HOLD = 20000, GAIN_DUCK = 0.15;
  const slots = {};                       // slot -> [file, ...]
  let loaded = false, ctxs = { mode: 'menu', terrain: null, castle: null, boat: false, siege: null, boss: false, night: false };
  let want = null, curSlot = null, deck = null, curFile = null, lastSwitch = 0, pend = null, timer = null, sting = null, lastPlace = {}, hist = {};
  const sv = () => (typeof Settings !== 'undefined' ? Settings.musicVol : 0.35), isOn = () => (typeof Sfx === 'undefined' ? true : Sfx.on);
  const vol = () => Math.min(1, sv() * 1.3) * (sting && !sting.paused && !sting.ended ? GAIN_DUCK : 1);

  function index() {
    if (loaded) return; loaded = true;
    try {
      fetch(DIR + 'index.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : [])).then(l => {
        (l || []).forEach(f => { const m = /^(.+?)(?:_(\d+))?\.(mp3|ogg|wav|m4a|webm)$/i.exec(String(f)); if (!m) return; (slots[m[1]] = slots[m[1]] || []).push(f); });
        for (const k in slots) slots[k].sort(); resolve(true);
      }).catch(() => { /* no music folder */ });
    } catch (e) { /* ignore */ }
  }
  const ALIAS = { water: 'sea', desert: 'sand', mount: 'mountain' };
  const has = (s) => !!(slots[s] && slots[s].length);

  // the slots to try for the current place, most specific first
  function candidates() {
    const c = ctxs, t = ALIAS[c.terrain] || c.terrain, out = [];
    switch (c.mode) {
      case 'menu': out.push('menu'); break;
      case 'select': out.push('select', 'menu'); break;
      case 'town': if (c.castle) out.push(c.castle + '_town'); out.push('town'); break;
      case 'battle':
        if (c.boss) out.push('battle_boss');
        if (c.siege) out.push('battle_siege_' + c.siege);
        if (c.castle) out.push(c.castle + '_battle');
        if (t) out.push('battle_' + t); out.push('battle'); break;
      default:   // map
        if (c.boat || t === 'sea') out.push('map_sea');
        if (c.night) out.push('map_night');
        if (t) out.push('map_' + t);
        if (c.castle) out.push(c.castle + '_map');
        out.push('map');
    }
    return out;
  }
  const pick = () => candidates().find(has) || null;

  const fresh = () => { const a = new Audio(); a.preload = 'auto'; a.addEventListener('ended', () => { if (a === deck) next(); }); return a; };
  const fades = new Map();
  function fade(a, to, ms, done) {
    clearInterval(fades.get(a)); const v0 = a.volume, up = to > v0, k = Math.max(1, Math.round(ms / 40)); let i = 0;
    fades.set(a, setInterval(() => { i++; const t = Math.min(1, i / k), f = up ? Math.sin(t * Math.PI / 2) : 1 - Math.cos(t * Math.PI / 2); a.volume = Math.max(0, Math.min(1, v0 + (to - v0) * f)); if (i >= k) { clearInterval(fades.get(a)); fades.delete(a); if (done) done(); } }, 40));
  }
  function choose(slot) {
    const l = slots[slot]; if (!l.length) return null; if (l.length === 1) return l[0];
    const h = hist[slot] || (hist[slot] = []); let p; for (let i = 0; i < 8; i++) { p = l[(Math.random() * l.length) | 0]; if (p !== curFile && !h.includes(p)) break; }
    h.push(p); if (h.length > Math.min(2, l.length - 1)) h.shift(); return p;
  }
  // crossfade to a track of the slot: the old deck fades out on its own element while a new one fades in
  function start(slot, immediate) {
    if (!isOn() || sv() <= 0.001) return;
    const f = choose(slot); if (!f) return;
    const old = deck; if (old) fade(old, 0, immediate ? 600 : FADE, () => { try { old.pause(); } catch (e) { /* ignore */ } });
    if (!curSlot) legacy();
    const a = fresh(); deck = a; a.src = DIR + f; a.volume = 0; curSlot = slot; curFile = f; lastSwitch = performance.now();
    const p = a.play(); if (p && p.catch) p.catch(() => { /* needs a tap first; retried by tick */ });
    fade(a, vol(), immediate ? 800 : FADE);
  }
  function next() { if (curSlot && has(curSlot) && isOn()) start(curSlot, false); }

  function resolve(force) {
    index(); const s = pick();
    if (!s) { pend = null; want = null; if (curSlot) { stop(); legacy(); } return; }   // nothing recorded for this place: the older tracks in js/sfx.js take over
    want = s; if (s === curSlot && deck && !deck.paused) return;
    const now = performance.now();
    // a change of terrain waits at least MIN_HOLD after the last switch; a change of mode (menu/map/town/battle) goes at once
    const modeSwitch = force === 'mode' || !curSlot || curSlot.split('_')[0] !== s.split('_')[0] || /_(town|battle)$/.test(s) !== /_(town|battle)$/.test(curSlot);
    if (!modeSwitch && now - lastSwitch < MIN_HOLD) { pend = s; return; }
    pend = null; start(s, modeSwitch);
  }
  function stop() { curSlot = null; if (deck) { const o = deck; deck = null; fade(o, 0, 1200, () => { try { o.pause(); } catch (e) { /* ignore */ } }); } }

  function tick() {
    if (!has_any()) return;
    if (pend && performance.now() - lastSwitch >= MIN_HOLD) { const s = pick(); pend = null; if (s && s !== curSlot) start(s, false); }
    if (want && deck && deck.paused && !deck.ended && isOn() && sv() > 0.001 && !document.hidden) { const p = deck.play(); if (p && p.catch) p.catch(() => {}); }   // first tap after load
    if (deck && !deck.paused) { const v = vol(); if (Math.abs(deck.volume - v) > 0.02 && !fades.has(deck)) deck.volume = v; }
    const n = document.body.classList.contains('night');
    if (n !== ctxs.night) { ctxs.night = n; resolve(); }
  }
  const legacy = () => { try { if (typeof Sfx !== 'undefined') Sfx.resume(); } catch (e) { /* ignore */ } };
  const has_any = () => Object.keys(slots).length > 0;

  // one-shot pieces: victory, defeat, level up...; returns true when a recording exists for it
  function playSting(slot, minGap) {
    index(); if (!has(slot) || !isOn() || sv() <= 0.001) return false;
    const now = Date.now(); if (minGap && lastPlace[slot] && now - lastPlace[slot] < minGap) return true; lastPlace[slot] = now;
    try {
      if (sting) { sting.pause(); sting = null; }
      const a = new Audio(DIR + choose(slot)); a.volume = Math.min(1, sv() * 1.4); sting = a;
      a.addEventListener('ended', () => { if (sting === a) sting = null; if (deck && !deck.paused) fade(deck, vol(), 1400); });
      a.addEventListener('error', () => { if (sting === a) sting = null; });
      if (deck && !deck.paused) fade(deck, vol(), 400);
      const p = a.play(); if (p && p.catch) p.catch(() => { if (sting === a) sting = null; });
      return true;
    } catch (e) { return false; }
  }
  const PLACE = { mine: 'mine', dwelling: 'dwelling', lair: 'lair', shrine: 'shrine', stone: 'shrine', tower: 'shrine', obelisk: 'shrine', seer: 'shrine', mono: 'shrine', gate: 'shrine', keytent: 'shrine', questgate: 'shrine', prison: 'prison', merchant: 'merchant', market: 'merchant', wreck: 'ruin', chest: 'ruin', pile: 'ruin', deposit: 'ruin', fort: 'fort' };

  document.addEventListener('visibilitychange', () => { if (deck) { if (document.hidden) deck.pause(); else tick(); } });
  timer = setInterval(tick, 1500);
  return {
    // describe where we are; any subset of { mode: menu|select|map|town|battle, terrain, castle, boat, siege: 'attack'|'defend'|null, boss }
    ctx(o) {
      try {
        let modeChanged = false; for (const k in o) { if (k === 'mode' && ctxs.mode !== o[k]) modeChanged = true; ctxs[k] = o[k]; }
        clearTimeout(Music._d); Music._d = setTimeout(() => resolve(modeChanged ? 'mode' : false), modeChanged ? 250 : 0);   // a short settle so quick mode flips (town opens, closes) do not restart the tune
      } catch (e) { /* ignore */ }
    },
    // true while a recorded track of this place is chosen: js/sfx.js then keeps its own tracks quiet
    owns() { index(); return !!pick(); },
    sting(slot, minGap) { try { return playSting(slot, minGap); } catch (e) { return false; } },
    place(kind) { const s = PLACE[kind]; return s ? this.sting('place_' + s, 90000) : false; },
    refresh() { if (deck && !deck.paused) { if (!isOn() || sv() <= 0.001) deck.pause(); else deck.volume = vol(); } else if (deck && isOn() && sv() > 0.001) tick(); else resolve(); },
    pause() { if (deck) deck.pause(); }, resume() { tick(); resolve(); },
    state: () => ({ ctx: { ...ctxs }, slot: curSlot, file: curFile, want, pend, slots: Object.fromEntries(Object.entries(slots).map(([k, v]) => [k, v.length])) }),
  };
})();
