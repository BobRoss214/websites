/* A big system font (the browser's own "font size" setting: "very large" is 150% and a visitor with low vision may choose 200%): the page must still fit the screen.
 * The browser is told its default font size with Page.setFontSizes (the same setting a person changes in Chrome, Edge or Android), so the em-based media queries follow
 * the font as they do for a real visitor. Home page and First-visit page on a small phone (320 px) at 150% and 200%, and on a phone (390 px) at 200%:
 * the page does not scroll sideways, the three bottom buttons stay on the screen, nothing sticks out past the right edge, and the text is bigger than the normal size
 * (so the test is really looking at a big font). Quick: about 30 seconds. */
import { run, open, ok } from './lib.mjs';

const VIEWS = [{ w: 320, h: 568, px: 24 }, { w: 320, h: 568, px: 32 }, { w: 390, h: 844, px: 32 }];
const PAGES = ['index.html', 'first-visit.html'];

await run('big-font', async ({ browser, base, errs }) => {
  for (const v of VIEWS) {
    for (const pg of PAGES) {
      const p = await open(browser, base, pg, errs, {
        viewport: { width: v.w, height: v.h }, touch: true,
        routes: async (page) => { const cdp = await page.context().newCDPSession(page); await cdp.send('Page.enable'); await cdp.send('Page.setFontSizes', { fontSizes: { standard: v.px, fixed: Math.round(v.px * 13 / 16) } }); },
      });
      await p.waitForTimeout(600);
      const r = await p.evaluate(() => {
        const de = document.documentElement, vw = de.clientWidth;
        const bar = document.querySelector('nav.action-bar');
        const kids = bar && getComputedStyle(bar).display !== 'none' ? Array.from(bar.children).filter((c) => c.checkVisibility()).map((c) => c.getBoundingClientRect()) : [];
        const wide = [];
        for (const e of document.querySelectorAll('body *')) {
          const q = e.getBoundingClientRect();
          if (q.width > 0 && q.right > vw + 1 && e.checkVisibility() && !e.closest('#nav, .lightbox, #sprite')) {
            let clipped = false; for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { if (/(hidden|clip|auto|scroll)/.test(getComputedStyle(a).overflowX)) { clipped = true; break; } }
            if (!clipped) wide.push((e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0]) + ' reaches ' + Math.round(q.right));
          }
        }
        return { vw, sw: de.scrollWidth, font: getComputedStyle(de).fontSize, barOut: kids.filter((q) => q.right > vw + 0.5 || q.left < -0.5).length, bars: kids.length, wide: wide.slice(0, 4) };
      });
      const label = `${pg.replace('.html', '')} at ${v.w}px with a ${Math.round(v.px / 16 * 100)}% font`;
      ok(`${label}: the browser really uses the big font`, r.font === v.px + 'px', r.font);
      ok(`${label}: the page does not scroll sideways`, r.sw <= r.vw, `${r.sw}px wide in a ${r.vw}px window; ${r.wide.join(', ')}`);
      ok(`${label}: the bottom buttons are all on the screen`, r.bars === 0 || r.barOut === 0, `${r.barOut} of ${r.bars} outside`);
      await p.context().close();
    }
  }
});
