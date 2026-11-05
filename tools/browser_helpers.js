// Dev helpers for driving the game from the browser console / automation:
//   await __startGame({ diff, size, ais, faction, hero, preset })
//   await __run(days, maxMs)   -> presses End Turn repeatedly, auto-resolving battles and modals
//   __stat()                   -> summary of towns/heroes/gold per side
(() => {
  window.__toasts = [];
  new MutationObserver((ms) => ms.forEach(m => m.addedNodes.forEach(n => n.textContent && window.__toasts.push(n.textContent)))).observe(document.getElementById('toast'), { childList: true });
  const w = (ms) => new Promise(r => setTimeout(r, ms)), $ = (id) => document.getElementById(id);
  window.__startGame = async (o = {}) => {
    $('tNew').click(); await w(150);
    document.querySelector(`#mbox .card[data-d="${o.diff || 'normal'}"]`).click(); await w(150);
    if (o.preset) { document.querySelector(`#mbox [data-m="${o.preset}"]`).click(); await w(80); }
    if (o.size) { document.querySelector(`#mbox [data-s="${o.size}"]`).click(); await w(80); }
    if (o.ais) { document.querySelector(`#mbox [data-a="${o.ais}"]`).click(); await w(80); }
    $('sNext').click(); await w(150);
    document.querySelector(`#mbox .card[data-f="${o.faction || 'castle'}"]`).click(); await w(150);
    document.querySelector(`#mbox .card[data-hid="${o.hero || 'Orrin'}"]`).click(); await w(1200);
    return window.__G();
  };
  window.__stat = () => {
    const G = window.__G(), own = (id) => G.objs.filter(o => o.owner === id);
    return { day: G.day, over: G.over,
      me: { towns: own(0).filter(o => o.t === 'town').length, forts: own(0).filter(o => o.t === 'fort').length, mines: own(0).filter(o => o.t === 'mine').length, heroes: G.heroes.map(h => h.army.filter(Boolean).reduce((s, a) => s + a.n, 0)) },
      ais: G.ais.map(a => ({ id: a.id, fac: a.fac.slice(0, 5), alive: a.alive, gold: a.gold, towns: own(a.id).filter(o => o.t === 'town').length, forts: own(a.id).filter(o => o.t === 'fort').length,
        mines: own(a.id).filter(o => o.t === 'mine').length, heroes: a.heroes.map(h => h.army.filter(Boolean).reduce((s, x) => s + x.n, 0)) })) };
  };
  window.__run = async (days, maxMs = 38000) => {
    const G = window.__G(), t0 = Date.now(), log = []; let auto = false;
    for (let d = 0; d < days; d++) {
      if (Date.now() - t0 > maxMs) break;
      const d0 = G.day; $('bEnd').click();
      for (let i = 0; i < 900; i++) {
        await w(30);
        const inb = document.body.classList.contains('inbattle');
        if (inb && !auto) { $('bAuto').click(); auto = true; log.push('battle:' + $('btitle').textContent.slice(0, 30)); }
        if (!inb) auto = false;
        if (!$('modal').classList.contains('hide')) {
          const t = $('mbox').innerText.slice(0, 50).replace(/\n/g, ' ');
          if (/captured|fallen|Defeat|Victory/.test(t)) log.push('modal:' + t);
          const bs = [...$('mbox').querySelectorAll('button')];
          const pk = bs.find(x => /Offense|Archery|Armorer|Leadership|Logistics|Wisdom|Sorcery|Estates|Ballistics|Charisma|Fortune/.test(x.textContent));
          (pk || bs[0]).click(); await w(40);
        }
        if (G.day > d0 || G.over) break;
      }
      if (G.over) { log.push('GAME OVER'); break; }
    }
    return log;
  };
})();
