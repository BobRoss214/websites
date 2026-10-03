/* A visitor who opens the site in another language must not see English first: the texts are swapped as soon as the page body is in place,
 * while the big scripts are still starting up, not only when the whole page has been read (DOMContentLoaded).
 * Measured by putting a note at the very top of hero.js (the script that runs right after main.js): what did the page look like at that moment? */
import { run, open, ok, okSoon, until } from './lib.mjs';

const CASES = [['es', 'es', 'Visita'], ['hi', 'hi', null], ['zh', 'zh-Hans', null], ['vi', 'vi', null]];

await run('i18n-early', async ({ browser, base, errs }) => {
  for (const [lang, html, nav] of CASES) {
    const p = await open(browser, base, 'index.html', errs, { lang, routes: async (pg) => {
      await pg.route('**/js/hero.js', async (r) => { const res = await r.fetch(); r.fulfill({ response: res, body: "window.__atHero = { lang: document.documentElement.lang, nav: (document.querySelector('.nav li:first-child a') || {}).textContent, title: document.title };\n" + (await res.text()) }); });
    } });
    const m = await p.evaluate(() => ({ at: window.__atHero, nav: document.querySelector('.nav li:first-child a').textContent, title: document.title }));
    ok(`${lang}: the page is already in ${lang} when hero.js starts (html lang, menu text and title)`, m.at && m.at.lang === html && m.at.nav === m.nav && m.at.nav !== 'Visit' && m.at.title === m.title && (!nav || m.at.nav === nav), JSON.stringify(m.at));
    ok(`${lang}: the page is still in ${lang} when it has loaded`, (await p.evaluate(() => document.documentElement.lang)) === html && m.nav !== 'Visit');
    await p.context().close();
  }

  // swapping the texts early must not break what the other scripts attach to the page: it all still works in another language
  const p = await open(browser, base, 'index.html', errs, { lang: 'es' });
  await p.locator('#faq details summary').nth(1).scrollIntoViewIfNeeded();   // (the first question is open from the start: take the second)
  await p.locator('#faq details summary').nth(1).click();
  await okSoon('es: a question in the FAQ opens', () => p.evaluate(() => document.querySelectorAll('#faq details')[1].open), (v) => v === true);
  await p.click('#season-switch button[data-season="winter"]');
  await okSoon('es: the season switcher works', () => p.evaluate(() => document.documentElement.dataset.season), (v) => v === 'winter');
  await p.click('#tab-spring').catch(() => {});
  await okSoon('es: the season tabs work', () => p.getAttribute('#tab-spring', 'aria-selected'), (v) => v === 'true');
  await p.click('.lang-btn');
  ok('es: the language menu opens', await p.isVisible('.lang-list'));
  await p.click('.lang-list [data-lang="en"]');
  await okSoon('es: switching back to English still works', () => p.evaluate(() => ({ lang: document.documentElement.lang, nav: document.querySelector('.nav li:first-child a').textContent })), (v) => v.lang === 'en' && v.nav === 'Visit');
  await p.context().close();
});
