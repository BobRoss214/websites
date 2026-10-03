/* Windows High Contrast (forced colours): backgrounds, shadows and gradients are dropped, so a "chosen" tab, filter, season, language or drive
 * choice must still look different from the ones that are not chosen. Checked for both system palettes (light and dark). */
import { run, open, ok } from './lib.mjs';

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
});
