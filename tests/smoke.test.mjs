// order: 82
// browser: yes
// quick: yes
// covers: css/*, js/main.js, js/hero.js, index.html
/* A visitor's first minute, in one short browser test (about 20 seconds on a quiet computer): the home page at a computer width, a phone width and the smallest
 * phone. The things that would be seen at once if they broke: the red Reserve buttons are on show and big enough to press (a CSS rule that hides them is found
 * here), the headline and the text can be read (colour against its background, 3:1 and 4.5:1), the second question in the FAQ opens and shows its answer, Tab shows a focus
 * ring (not removed by a style), nothing makes the page scroll sideways at 390 and 320 px, and the menu button on a phone has a name, opens the menu and the menu has
 * its links. Only plain facts (shown / not shown, sizes, colours), no waiting for animations, so it does not fail on a busy computer. The deeper tests (hero, keyboard,
 * layout-sweep, auto-dark, axe) look at the same things in detail; this one runs in --quick and says "something obvious is broken" first. */
import { run, open, ok, okSoon, until } from './lib.mjs';

const lum = (rgb) => { const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// The colour of an element's text and what it sits on (the first background up the tree that is not see-through), measured in the page.
const colours = (p, sel) => p.evaluate((s) => {
  const el = [...document.querySelectorAll(s)].find((e) => e.getClientRects().length && e.textContent.trim().length > 20);
  if (!el) return null;
  const num = (c) => (c.match(/[\d.]+/g) || []).map(Number);
  const fg = num(getComputedStyle(el).color);
  let bg = null; for (let n = el; n && !bg; n = n.parentElement) { const c = num(getComputedStyle(n).backgroundColor); if (c.length >= 3 && (c.length === 3 || c[3] > 0.95)) bg = c.slice(0, 3); }
  return { fg: fg.slice(0, 3), bg: bg || [255, 255, 255], text: el.textContent.trim().slice(0, 30) };
}, sel);

await run('smoke', async ({ browser, base, errs }) => {
  /* ---------------------------------------------------- a computer */
  let p = await open(browser, base, 'index.html', errs, { viewport: { width: 1280, height: 800 } });
  const shown = (sel) => p.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width >= 40 && r.height >= 24 && c.visibility !== 'hidden' && c.display !== 'none' && +c.opacity > 0.1; }).length, sel);
  ok('the red Reserve button in the top bar is on show and big enough to press', (await shown('.nav-cta')) >= 1);
  ok('a red Reserve button in the first screen (hero) is on show', (await shown('.hero-cta .btn-red')) >= 1);
  const h1 = await colours(p, 'h1'), body = await colours(p, 'main p');
  ok('the headline can be read: its colour against its background is at least 3:1', !!h1 && ratio(h1.fg, h1.bg) >= 3, JSON.stringify(h1));
  ok('the text of a paragraph can be read: at least 4.5:1', !!body && ratio(body.fg, body.bg) >= 4.5, JSON.stringify(body));
  const q = p.locator('#faq .faq-list summary').nth(1);   // the first question is open when the page loads (one open at a time), so open the second
  await q.scrollIntoViewIfNeeded(); await q.click();
  await okSoon('the second question in the FAQ opens and its answer is on show', () => p.evaluate(() => { const d = [...document.querySelectorAll('#faq .faq-list details')][1]; if (!d || !d.open) return 0; const a = [...d.children].find((c) => c.tagName !== 'SUMMARY'); return a ? a.getBoundingClientRect().height : 0; }), (h) => h > 10);
  await p.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
  await p.keyboard.press('Tab');
  const ring = await p.evaluate(() => { const e = document.activeElement, c = getComputedStyle(e); return { tag: e.tagName + '.' + String(e.className).slice(0, 20), outline: c.outlineStyle + ' ' + c.outlineWidth, shadow: c.boxShadow }; });
  ok('Tab goes to something and it shows a focus ring (an outline or a shadow, not removed)', ring.tag !== 'BODY.' && ((!/^none/.test(ring.outline) && parseFloat(ring.outline.split(' ')[1]) >= 2) || ring.shadow !== 'none'), JSON.stringify(ring));
  await p.context().close();

  /* ---------------------------------------------------- phones */
  for (const [w, h] of [[390, 844], [320, 568]]) {
    p = await open(browser, base, 'index.html', errs, { viewport: { width: w, height: h } });
    const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(`${w} px: the page does not scroll sideways`, over <= 1, over + ' px too wide');
    if (w === 390) {
      const btn = await p.evaluate(() => { const b = document.querySelector('#menu-toggle'); return b ? { name: (b.getAttribute('aria-label') || b.textContent || '').trim(), shown: b.getBoundingClientRect().width > 20 } : null; });
      ok('390 px: the menu button is there, has a name and is on show', !!btn && btn.shown && btn.name.length > 1, JSON.stringify(btn));
      await p.click('#menu-toggle');
      await okSoon('390 px: the menu opens and shows at least 5 links', () => p.evaluate(() => [...document.querySelectorAll('#nav a')].filter((a) => a.getBoundingClientRect().height > 10 && getComputedStyle(a).visibility !== 'hidden').length), (n) => n >= 5);
    }
    await p.context().close();
  }
});
