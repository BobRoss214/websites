/* The light pages: every extra page carries only the drawings (icon sprite) it uses and loads js/footer-art.js, not the hero engine.
 * tools/pages.py decides what each page gets; this opens every extra page in every season and every language, scrolls it, opens the phone menu and
 * the language list, and checks that every <use href="#..."> and url(#...) that ends up on the page has its drawing on that page.
 * Also: the footer art drawn by js/footer-art.js is exactly the one js/hero.js draws on the home page (same season, same markup), and the extra
 * pages do not download js/hero.js. */
import { run, open, ok, okSoon, until } from './lib.mjs';

const PAGES = ['first-visit', 'pumpkin-patch', 'school-field-trips', 'strawberry-picking', 'wise-pie'];
const SEASON = { spring: '2026-04-25T12:00:00-04:00', summer: '2026-06-25T12:00:00-04:00', fall: '2026-10-02T12:00:00-04:00', winter: '2026-12-10T12:00:00-05:00' };

// every drawing the page points at, now (the ones that are on the page, and the ones that are not)
const drawings = (p) => p.evaluate(() => {
  const have = new Set([...document.querySelectorAll('[id]')].map((e) => e.id));
  const want = new Set();
  document.querySelectorAll('use').forEach((u) => { const h = u.getAttribute('href') || u.getAttribute('xlink:href'); if (h && h[0] === '#') want.add(h.slice(1)); });
  document.querySelectorAll('*').forEach((e) => { for (const a of ['fill', 'stroke', 'filter', 'mask', 'clip-path', 'style']) { const v = e.getAttribute && e.getAttribute(a); if (v) for (const m of v.matchAll(/url\(#([^)]+)\)/g)) want.add(m[1]); } });
  return { count: want.size, missing: [...want].filter((i) => !have.has(i)) };
});

// the page, scrolled to the bottom, with the phone menu and the language list opened once (drawings added later are looked at too)
async function sweep(p) {
  const seen = new Set();
  const note = async () => { const d = await drawings(p); d.missing.forEach((m) => seen.add(m)); return d; };
  await note();
  try { await p.click('#menu-toggle', { timeout: 1500 }); await note(); await p.click('#menu-toggle', { timeout: 1500 }); } catch (e) { /* no phone menu at this width */ }
  try { await p.click('.lang-btn', { timeout: 1500 }); await note(); await p.keyboard.press('Escape'); } catch (e) { /* none */ }
  await p.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
  const h = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 900) { await p.evaluate((y) => window.scrollTo(0, y), y); await p.waitForTimeout(30); }
  const last = await note();
  return { missing: [...seen], count: last.count };
}

await run('sprite', async ({ browser, base, errs }) => {
  // the extra pages in every season (English) and in every language (fall)
  const cases = [];
  for (const pg of PAGES) { for (const s of Object.keys(SEASON)) cases.push([pg, 'en', s]); for (const l of ['es', 'hi', 'zh', 'vi']) cases.push([pg, l, 'fall']); }
  for (const [pg, lang, season] of cases) {
    const asked = [];
    const p = await open(browser, base, pg + '.html', errs, { lang: lang === 'en' ? undefined : lang, time: SEASON[season], viewport: { width: 390, height: 844 }, routes: (page) => { page.on('request', (r) => asked.push(r.url())); } });
    const r = await sweep(p);
    ok(`${pg}, ${lang}, ${season}: every drawing the page shows is on the page (${r.count} used)`, r.missing.length === 0 && r.count > 8, r.missing.join(', '));
    if (lang === 'en' && season === 'fall') {
      ok(`${pg}: loads the footer art, not the hero engine`, asked.some((u) => /js\/footer-art\.js/.test(u)) && !asked.some((u) => /js\/hero\.js/.test(u)), asked.filter((u) => /\/js\//.test(u)).map((u) => u.split('/').pop()).join(' '));
      ok(`${pg}: the footer has its drawing of the season`, await p.evaluate(() => { const f = document.querySelector('#footer-field'); return !!f && f.querySelectorAll('use').length > 3; }));
    }
    await p.context().close();
  }

  // the footer art of the extra pages is the home page's (same code, same season)
  for (const season of Object.keys(SEASON)) {
    // (the class "anim-off" comes and goes with what is on screen: js/main.js pauses drawings that are out of sight, so it is left out of the comparison)
    const art = async (page) => { const p = await open(browser, base, page, errs, { time: SEASON[season] }); const html = await p.evaluate(() => document.querySelector('#footer-field').innerHTML.replace(/\s*\banim-off\b/g, '').replace(/ class=""/g, '')); await p.context().close(); return html; };
    const [home, other] = [await art('index.html'), await art('wise-pie.html')];
    ok(`footer art in ${season}: js/footer-art.js draws exactly what js/hero.js draws (${home.length} characters)`, home.length > 2000 && home === other, `${home.length} vs ${other.length}`);
  }
});
