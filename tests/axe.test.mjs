/* Accessibility: runs axe-core (WCAG 2.0/2.1 A and AA plus best practices) on the home page and the First-visit page, on a desktop and a
 * phone, in English and Chinese, with every optional box filled in (this week, signup, photo wall, entrance photo, farm map). The test
 * fails when axe finds a violation. Needs axe-core:  npm i -D axe-core */
import { run, open, ok, info, axeSource, skip, until } from './lib.mjs';

const axe = axeSource();
if (!axe) skip('axe-core is not installed (npm i -D axe-core)');

const EXTRA = `WISE_ACRES.week = { updated: '2026-10-01', note: 'Tomatoes are at their best. Bring a bucket!', crops: { tomatoes: 'peak', pumpkins: 'starting' },
  days: [ { date: '2026-10-02', farm: 'few', pizza: 'open', note: 'Rain possible' }, { date: '2026-10-03', farm: 'full', pizza: 'full' }, { date: '2026-10-04', farm: 'closed', pizza: 'none' } ], demo: true };
WISE_ACRES.signup.demo = true; WISE_ACRES.reviewUrl = 'https://g.page/r/example/review';
WISE_ACRES.community = [ { src: 'assets/photos/goat-with-pumpkins.webp', alt: 'A baby goat sniffing small pumpkins', by: '@someone on Instagram', url: 'https://www.instagram.com/p/xyz/' }, { src: 'assets/photos/mums-and-red-shed.webp', alt: 'Mums by a shed', by: 'A visitor' } ];
WISE_ACRES.entrancePhoto = { src: 'assets/photos/mums-and-red-shed.webp', alt: 'The farm gate on Hartis Road', caption: 'Look for this gate.' };`;
const RULES = { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] } };
const STILL = '.reveal{opacity:1!important;transform:none!important}*{animation:none!important;transition:none!important}.crop{transform:scale(1)!important}';

await run('axe', async ({ browser, base, errs }) => {
  const found = {};
  for (const [page, width, lang] of [['index.html', 1440, 'en'], ['index.html', 390, 'en'], ['index.html', 1440, 'zh'], ['first-visit.html', 1440, 'en'], ['first-visit.html', 390, 'zh']]) {
    const p = await open(browser, base, page, errs, { viewport: { width, height: 900 }, lang, extra: EXTRA });
    await p.addStyleTag({ content: STILL });
    await until(p, () => document.readyState === 'complete');
    await p.evaluate(axe);
    const res = await p.evaluate(async (rules) => (await window.axe.run(document, rules)).violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n')[1]) })), RULES);
    ok(`axe: ${page} @${width}px (${lang}) has no violations`, res.length === 0, res.map((v) => `[${v.impact}] ${v.id}`).join(', '));
    if (!found.__checked) {   // prove once that axe really reports a mistake (a picture without a text alternative)
      found.__checked = true;
      const bad = await p.evaluate(async (rules) => { document.body.insertAdjacentHTML('beforeend', '<img id="axe-self-test" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">'); const r = (await window.axe.run(document, rules)).violations.map((v) => v.id); document.getElementById('axe-self-test').remove(); return r; }, RULES);
      ok('axe really runs: it reports a deliberate mistake (image without alt)', bad.includes('image-alt'), bad.join(','));
    }
    for (const v of res) { found[v.id] = found[v.id] || v; }
    await p.context().close();
  }
  for (const v of Object.values(found).filter((x) => x.id)) { info(`${v.id}: ${v.help}`); v.nodes.forEach((n) => info('  - ' + n)); }

  // the "What's on the farm" season tabs, one season at a time (the cards change with the tab)
  const p = await open(browser, base, 'index.html', errs, { viewport: { width: 390, height: 900 }, lang: 'hi' });
  await p.addStyleTag({ content: STILL });
  await p.evaluate(axe);
  for (const s of ['spring', 'summer', 'fall', 'winter']) {
    await p.click(`#farm-seasons [data-fs="${s}"]`);
    await until(p, (x) => document.querySelector('#farm-cards').dataset.season === x, s);
    const res = await p.evaluate(async (rules) => (await window.axe.run(document.getElementById('farm').parentElement, rules)).violations.map((v) => v.id + ' [' + v.impact + ']'), RULES);
    ok(`axe: "What's on the farm" in ${s} (phone, Hindi) has no violations`, res.length === 0, res.join(', '));
  }
  await p.context().close();
});
