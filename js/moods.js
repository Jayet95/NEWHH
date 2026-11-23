// Morale and luck as icons: no digits on screen. One to three icons show how strong the effect is, the tint and shape show whether it is good or bad.
// Pure functions (also used by tools/moods-test.js); the styles live in style.css (.mood).
const Moods = (() => {
  const clamp = (v) => Math.max(-3, Math.min(3, Math.round(Number(v)) || 0));
  const BASE = { morale: '😀', luck: '🍀' };
  const WORDS = {
    morale: { '-3': 'Despairing', '-2': 'Poor', '-1': 'Low', '0': 'Steady', '1': 'Good', '2': 'High', '3': 'Inspired' },
    luck: { '-3': 'Cursed', '-2': 'Unlucky', '-1': 'Unfortunate', '0': 'Fair', '1': 'Lucky', '2': 'Fortunate', '3': 'Blessed' },
  };
  const cls = (v) => (v > 0 ? 'lv-g' + v : v < 0 ? 'lv-b' + (-v) : 'lv-n0');
  const word = (kind, v) => WORDS[kind][String(clamp(v))];
  const tip = (kind, val) => {
    const v = clamp(val), w = word(kind, v), p = Math.abs(v) * 4;
    if (kind === 'morale') {
      if (!v) return `${w} morale: no bonus and no penalty.`;
      return `${w} morale: about a ${p}% chance that a creature ${v > 0 ? 'gets an extra turn' : 'loses its turn'}. Mixing creatures of different castles lowers it; undead and golems are immune.`;
    }
    if (!v) return `${w} luck: no lucky or unlucky strikes.`;
    return `${w} luck: about a ${p}% chance of ${v > 0 ? 'double damage' : 'half damage'} on an attack.`;
  };
  // markup: the same base icon repeated by strength (at least one); label=true adds the word
  const html = (kind, val, opts = {}) => {
    const v = clamp(val), n = Math.max(1, Math.abs(v)), t = tip(kind, v).replace(/"/g, '&quot;');
    return `<span class="mood k-${kind} ${cls(v)}" data-tip="${t}" title="${t}">${('<i>' + BASE[kind] + '</i>').repeat(n)}${opts.label ? `<em>${word(kind, v)}</em>` : ''}</span>`;
  };
  // plain text for the battle plate (canvas): glyphs differ by shape because a canvas cannot tint an emoji
  const GLYPH = { morale: { good: '😀', bad: '😠', zero: '😐' }, luck: { good: '🍀', bad: '🍂', zero: '☘' } };
  const glyphs = (kind, val) => { const v = clamp(val), g = GLYPH[kind]; return v > 0 ? g.good.repeat(v) : v < 0 ? g.bad.repeat(-v) : g.zero; };
  return { clamp, cls, word, tip, html, glyphs };
})();
if (typeof module !== 'undefined') module.exports = Moods;
