// order: 260
// browser: yes
// covers: js/i18n.js, lang/*, tools/i18n.py, index.html
/* Language switcher: ?lang=, the globe menu, remembering the choice, the "Would you like this in Spanish?" offer.
 *
 * Why this test does not use Playwright's waitUntil: 'networkidle': on a busy computer the network can go quiet while the page is
 * still being built (document.readyState is still "loading"), and the language is only applied when the page has been read to the
 * end (DOMContentLoaded). open() waits for the "load" event instead, and later checks wait for the thing they check. */
import { run, open, ok, okSoon, until, txt } from './lib.mjs';

const nav = (p) => txt(p, '.nav li:first-child a');
const htmlLang = (p) => p.evaluate(() => document.documentElement.lang);

await run('i18n', async ({ browser, base, errs }) => {
  const p = await open(browser, base, 'index.html', errs, { lang: 'es' });
  ok('html lang = es', (await htmlLang(p)) === 'es', await htmlLang(p));
  ok('nav is translated once the page has loaded', (await nav(p)) === 'Visita', await nav(p));
  ok('h1 translated', ((await txt(p, 'h1')) || '').includes('Diversión orgánica'), await txt(p, 'h1'));
  ok('?lang= does not save the choice', (await p.evaluate(() => localStorage.getItem('wa.lang'))) === null);

  await p.click('.lang-btn');
  ok('menu opens', await p.isVisible('.lang-list'));
  await p.click('.lang-list [data-lang="en"]');
  await okSoon('back to English (text and html lang)', async () => ({ nav: await nav(p), lang: await htmlLang(p) }), (v) => v.nav === 'Visit' && v.lang === 'en');
  await p.click('.lang-btn'); await p.click('.lang-list [data-lang="es"]');
  await okSoon('switch to Spanish live', () => nav(p), (v) => v === 'Visita');
  ok('svg icons survive the swap', await p.evaluate(() => document.querySelectorAll('.hero-cta svg').length >= 1));
  await okSoon('dynamic text is translated (Open now badges)', () => p.evaluate(() => { WISE_ACRES.live.refresh(); return document.querySelector('[data-live=greenhouse]').textContent; }), (v) => /Cerrado|Abierto|Abre/.test(v));
  await okSoon('choice is stored after a click', () => p.evaluate(() => localStorage.getItem('wa.lang')), (v) => v === 'es');
  await p.reload({ waitUntil: 'load' });
  await okSoon('remembered on reload', async () => ({ nav: await nav(p), lang: await htmlLang(p) }), (v) => v.nav === 'Visita' && v.lang === 'es');
  await p.context().close();

  // a slow language file must not undo a later choice: Spanish is asked for, the file is slow, the visitor changes their mind (English, or Hindi)
  // before it arrives. The page has to stay in the language asked for last, and that is what is remembered.
  {
    const slowEs = async (pg) => { await pg.route('**/lang/es.js', async (r) => { await new Promise((x) => setTimeout(x, 2500)); r.continue().catch(() => {}); }); };
    for (const later of ['en', 'hi']) {
      const q = await open(browser, base, 'index.html', errs, { routes: slowEs });
      await q.evaluate(() => { WISE_ACRES.setLang('es'); });
      await q.evaluate((c) => { WISE_ACRES.setLang(c); }, later);
      await until(q, (c) => WISE_ACRES.lang === c && document.documentElement.lang === c, later, 8000);
      ok(`asked for Spanish, then ${later}: the page is in ${later} before the slow Spanish file arrives`, (await htmlLang(q)) === later, await htmlLang(q));
      await until(q, () => !!(WISE_ACRES.dict && WISE_ACRES.dict.es), null, 15000);   // the Spanish file has arrived now
      await q.evaluate(() => new Promise((r) => setTimeout(r, 300)));                    // and its load event has run
      const after = await q.evaluate(() => ({ lang: WISE_ACRES.lang, html: document.documentElement.lang, stored: localStorage.getItem('wa.lang') }));
      ok(`...and stays in ${later} after it arrives (the late Spanish file does not flip it back), ${later} is what is remembered`, after.lang === later && after.html === later && after.stored === later, JSON.stringify(after));
      await q.context().close();
    }
  }

  // each language sets the right html lang
  for (const [code, html] of [['hi', 'hi'], ['zh', 'zh-Hans'], ['vi', 'vi']]) {
    const q = await open(browser, base, 'index.html', errs, { lang: code });
    ok(code + ': html lang = ' + html, (await htmlLang(q)) === html, await htmlLang(q));
    await q.context().close();
  }

  // a Spanish browser with nothing stored is asked once, in Spanish
  const p2 = await open(browser, base, 'index.html', errs, { locale: 'es-MX' });
  ok('offers Spanish to an es browser', await p2.isVisible('.lang-offer'), (await txt(p2, '.lang-offer p')) || '');
  await p2.click('.lang-offer [data-y]');
  await okSoon('accepting switches the page', () => nav(p2), (v) => v === 'Visita');
  await p2.context().close();

  // the Spanish file cannot be loaded (offline, blocked): "Yes" must not make the offer vanish with nothing happening. The page stays English, the offer stays
  // open (so the visitor can try again, or say no), and nothing is remembered; once the file arrives, "Yes" works and the offer goes.
  {
    let reachable = false;
    const p5 = await open(browser, base, 'index.html', errs, { locale: 'es-MX', routes: async (pg) => { await pg.route('**/lang/es.js', (r) => (reachable ? r.continue().catch(() => {}) : r.abort().catch(() => {}))); } });
    ok('offline Spanish file: the offer is shown', await p5.isVisible('.lang-offer'));
    await p5.click('.lang-offer [data-y]');
    await until(p5, () => !document.querySelector('script[src="lang/es.js"]'), null, 15000);                      // the failed script has been taken out again: the try is over
    await p5.evaluate(() => new Promise((r) => setTimeout(r, 300)));
    const stuck = await p5.evaluate(() => ({ offer: document.querySelectorAll('.lang-offer').length, nav: (document.querySelector('.nav li:first-child a') || {}).textContent, html: document.documentElement.lang, stored: localStorage.getItem('wa.lang'), no: localStorage.getItem('wa.offer') }));
    ok('"Yes" when the Spanish file does not arrive: the offer is still there (not gone with nothing happening)', stuck.offer === 1, JSON.stringify(stuck));
    ok('...the page stays English, and nothing is remembered (not the language, not a "no")', stuck.nav === 'Visit' && stuck.html === 'en' && stuck.stored === null && stuck.no === null, JSON.stringify(stuck));
    reachable = true;
    await p5.click('.lang-offer [data-y]');
    await okSoon('...pressing "Yes" again, with the file reachable: the page is Spanish and the offer closes', () => p5.evaluate(() => ({ nav: (document.querySelector('.nav li:first-child a') || {}).textContent, offer: document.querySelectorAll('.lang-offer').length })), (v) => v.nav === 'Visita' && v.offer === 0);
    await p5.context().close();
  }

  // "No, thanks" is remembered
  const p4 = await open(browser, base, 'index.html', errs, { locale: 'es-MX' });
  await p4.click('.lang-offer [data-n]');
  await p4.reload({ waitUntil: 'load' });
  ok('"No, thanks" is remembered (no second offer)', (await p4.locator('.lang-offer').count()) === 0 && (await nav(p4)) === 'Visit');
  await p4.context().close();

  // an English browser gets no offer, and the switcher fits a phone
  const p3 = await open(browser, base, 'index.html', errs, { viewport: { width: 390, height: 844 } });
  ok('phone: no sideways scroll with the switcher', await p3.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  ok('no offer for English browsers', (await p3.locator('.lang-offer').count()) === 0);
  await p3.context().close();
  // changing language keeps the reader's place: the text block at the top of the screen stays where it was (the texts change height)
  const m = await open(browser, base, 'index.html', errs);
  await m.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
  await m.evaluate(() => document.querySelector('#faq').scrollIntoView());
  await until(m, () => window.scrollY > 1000);
  const mark = await m.evaluate(() => {
    const edge = document.querySelector('.site-header').getBoundingClientRect().bottom + 4;
    for (const el of document.querySelectorAll('[data-t]')) {
      if (el.closest('header, nav, #action-bar, [aria-hidden="true"]')) continue;
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.bottom > edge + 6 && r.top < innerHeight) { window.__mark = el; return { top: r.top }; }
    }
    return null;
  });
  ok('scrolled down to the FAQ: there is a text block at the top of the screen', !!mark);
  // real mouse clicks at the buttons' places: Playwright's own click() (and focus()) scroll a button in the sticky header "into view" first, which would move the page by itself
  const tap = async (sel) => { const b = await m.locator(sel).boundingBox(); await m.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };
  await tap('.lang-btn'); await tap('.lang-list [data-lang="es"]');
  await okSoon('changing language keeps the reader\'s place (the block at the top stays within 30 px; without this it is moved by hundreds)', () => m.evaluate(() => ({ lang: document.documentElement.lang, top: window.__mark.getBoundingClientRect().top })), (v) => !!mark && v.lang === 'es' && Math.abs(v.top - mark.top) <= 30, 10000);
  await m.context().close();
});
