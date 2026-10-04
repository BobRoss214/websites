// order: 390
// browser: yes
// quick: yes
// covers: css/*
/* Windows High Contrast (forced colours): backgrounds, shadows and gradients are dropped, so a "chosen" tab, filter, season, language or drive
 * choice must still look different from the ones that are not chosen. Checked for both system palettes (light and dark). */
import { run, open, ok, settled } from './lib.mjs';

await run('forced-colors', async ({ browser, base, errs }) => {
  for (const scheme of ['light', 'dark']) {
    const p = await open(browser, base, 'index.html', errs, { reducedMotion: 'reduce', forcedColors: 'active' });
    await p.emulateMedia({ colorScheme: scheme });
    ok(`${scheme}: forced colours are on`, await p.evaluate(() => matchMedia('(forced-colors: active)').matches));
    // what a person can see of an element: text colour, fill, border, outline, underline, weight, and the little round or square mark in front of it
    const look = (p, sel, which) => p.evaluate(({ sel, which }) => {
      const list = [...document.querySelectorAll(sel)]; const e = which === 'on' ? list.find((x) => x.matches('[aria-selected="true"],[aria-pressed="true"],[aria-checked="true"],[aria-current],:checked+span,:has(input:checked)')) : list.find((x) => !x.matches('[aria-selected="true"],[aria-pressed="true"],[aria-checked="true"],[aria-current],:has(input:checked)'));
      if (!e) return null;
      const t = e.matches('.drive-opt') ? e.querySelector('span') : e; const c = getComputedStyle(t), q = getComputedStyle(t, '::before');
      return [c.color, c.backgroundColor, c.borderTopColor, c.borderTopWidth, c.outlineStyle, c.outlineWidth, c.textDecorationLine, c.fontWeight, q.backgroundColor, q.backgroundImage === 'none' ? '' : 'img'].join('|');
    }, { sel, which });
    const groups = [['the season tabs', '#season-tabs .season-tab'], ['the group tabs', '#group-tabs .group-tab'], ['the variety filters', '#variety-filters .filter-btn'], ['the gallery filters', '#gallery-filters .filter-btn'],
      ['the hero season buttons', '#season-switch button[role=radio]'], ['the drive choices', '.drive-opt'], ['the farm-season buttons', '.fs-btn']];
    for (const [name, sel] of groups) {
      const on = await look(p, sel, 'on'), off = await look(p, sel, 'off');
      ok(`${scheme}: in ${name} the chosen one looks different from the others`, !!on && !!off && on !== off, on === off ? 'identical: ' + on : '');
    }
    await p.context().close();
  }

  // The "Pause animations" button of the hero card has a fill of its own when it is pressed: its icon must still be told apart from that fill.
  // (No reduced motion here: with it the buttons are hidden, as the page itself decides.)
  const lum = (s) => { const [r, g, b] = s.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  for (const scheme of ['light', 'dark']) {
    const p = await open(browser, base, 'index.html', errs, { forcedColors: 'active' });
    await p.emulateMedia({ colorScheme: scheme });
    const there = await p.evaluate(() => { const b = document.querySelector('.picker [data-motion]'); return !!b && !b.hidden; });
    ok(`${scheme}: the "Pause animations" button is in the hero card`, there);
    if (there) {
      await p.click('.picker [data-motion]');
      await settled(p);   // the fill and the text colour change over a fraction of a second
      const c = await p.evaluate(() => { const b = document.querySelector('.picker [data-motion]'), cs = getComputedStyle(b); return { pressed: b.getAttribute('aria-pressed'), fg: cs.color, bg: cs.backgroundColor }; });
      ok(`${scheme}: pressed, the icon of the "Pause animations" button is told apart from its fill (contrast 3 or more)`, c.pressed === 'true' && contrast(c.fg, c.bg) >= 3, `${c.fg} on ${c.bg}: ${contrast(c.fg, c.bg).toFixed(1)}`);
    }
    await p.context().close();
  }
});
