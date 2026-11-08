'use strict';
// Player preferences (stored in the browser): animation speed, volumes, UI size, left-handed layout, haptics, hints.
const Settings = (() => {
  const KEY = 'h3js_settings_v1';
  const def = { animSpeed: 1, sfxVol: 0.8, musicVol: 0.35, uiScale: 1, leftHand: false, haptics: true, confirmEnd: true, confirmDanger: true, showReach: true, hints: true, hintsSeen: {} };
  let s = Object.assign({}, def);
  try { Object.assign(s, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* ignore */ }
  const S = {
    get animSpeed() { return s.animSpeed; }, get sfxVol() { return s.sfxVol; }, get musicVol() { return s.musicVol; },
    get uiScale() { return s.uiScale; }, get leftHand() { return s.leftHand; }, get haptics() { return s.haptics; },
    get confirmEnd() { return s.confirmEnd; }, get confirmDanger() { return s.confirmDanger; }, get showReach() { return s.showReach; }, get hints() { return s.hints; }, get hintsSeen() { return s.hintsSeen; },
    all: () => Object.assign({}, s),
    set(k, v) { s[k] = v; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ } S.apply(); },
    seen(id) { if (!s.hintsSeen[id]) { s.hintsSeen[id] = 1; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ } } },
    resetHints() { s.hintsSeen = {}; s.hints = true; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ } },
    buzz(ms) { if (s.haptics && navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } } },
    apply() {
      if (typeof document === 'undefined' || !document.body) return;
      document.body.classList.toggle('lefty', !!s.leftHand);
      document.documentElement.style.setProperty('--ui', String(s.uiScale));
      if (typeof Sfx !== 'undefined' && Sfx.refresh) Sfx.refresh();
    },
  };
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => S.apply());
  return S;
})();
