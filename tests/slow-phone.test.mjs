// order: 385
// browser: yes
// covers: *.html, pages/*, css/*, js/*, lang/*, assets/fonts/*, _headers, tools/slow_phone.mjs
/* The steady part of "an old, slow Android phone" (docs/SLOW_PHONE_TEST.md): things that are the same whatever else the computer is doing, so the test
 * does not fail just because the machine is busy. A phone-sized screen (360x640, touch) on a "Slow 4G" line, a first visit and then a second one:
 *   - how many files and bytes a first visit downloads (text compressed, like the real host), and that a second visit downloads almost nothing
 *   - how big the page is (the number of nodes the browser has to keep), the biggest single cost on a slow phone
 *   - that nothing jumps while the page loads (layout shift)
 *   - that the menu button answers a tap while the page loads and once it has loaded
 *   - that nothing loops with "reduce motion" switched on
 * It does not measure seconds: how long a slow phone really takes depends on the computer that runs the test. For that, run
 * `node tools/slow_phone.mjs` (see docs/SLOW_PHONE_TEST.md). Needs a browser; about a minute.
 *
 * A number below is a ceiling with some room. If the page really got bigger on purpose (a new picture, a new section), raise it here and
 * say so in docs/SLOW_PHONE_TEST.md; if it got bigger by accident, this test is how you notice. */
import { ok, info, skip, finish, loadPlaywright, ROOT, ms } from './lib.mjs';
import { startServer, PHONE, loadOnce, running, INIT, sleep } from '../tools/slow_phone.mjs';

try { await loadPlaywright(); } catch (e) { skip('Playwright is not installed, so the slow-phone test cannot run (see tests/README.md)'); }

const KB = 1024;
const chk = (name, cond, detail = '') => ok(name, cond, cond ? '' : detail);   // the detail is only shown when a check fails
// first visit, Slow 4G: [files, kilobytes, nodes in the page when it has loaded]
const BUDGET = {
  'index.html': { reqs: 24, kb: 420, nodes: 42000 },
  'first-visit.html': { reqs: 24, kb: 400, nodes: 30000 },
  'pumpkin-patch.html': { reqs: 22, kb: 300, nodes: 12000 },
};
const errs = [];

const { chromium } = await loadPlaywright();
// every page of the test is served like the real host: compressed text, the caching rules of _headers, HTTP/2 when openssl is there
const site = await startServer(ROOT, 0);
const browser = await chromium.launch({ args: site.spki ? ['--ignore-certificate-errors-spki-list=' + site.spki] : [] });
try {
  info('served over ' + site.protocol + ' (text compressed with brotli, caching as in _headers)');
  for (const file of Object.keys(BUDGET)) {
    const b = BUDGET[file];
    const ctx = await browser.newContext(PHONE);
    const first = await loadOnce(ctx, site.url, file, { lang: 'en', cpu: 1, net: 'slow4g', interact: file === 'index.html', settle: 1200, errs, limit: ms(240000) });
    chk(`${file}, first visit: ${first.reqs} files, ${Math.round(first.enc / KB)} KB (limits ${b.reqs} files, ${b.kb} KB)`, !first.error && first.reqs <= b.reqs && first.enc <= b.kb * KB, JSON.stringify({ reqs: first.reqs, kb: Math.round(first.enc / KB), error: first.error, biggest: (first.files || []).sort((x, y) => y[2] - x[2]).slice(0, 3).map((f) => f[0] + ' ' + Math.round(f[2] / KB) + ' KB') }));
    const vi = (first.fonts || []).find((f) => /nunito-vietnamese/.test(f[0]));
    chk(`${file}: the font for the Vietnamese letters is asked for by the page's head, with the other fonts (a preload link), not by a style rule when the footer is built (that came late, and when it arrived the whole page was worked out again)`, !!vi && vi[1] === 'link', JSON.stringify(first.fonts));
    chk(`${file}: the page the browser holds is ${first.nodes} nodes (limit ${b.nodes})`, first.nodes > 0 && first.nodes <= b.nodes, String(first.nodes));
    chk(`${file}: nothing jumps while it loads (layout shift ${first.cls}, limit 0.02)`, first.cls <= 0.02, JSON.stringify(first.shifts.slice(0, 4)));
    if (file === 'index.html') {
      chk('index.html: a tap on the menu button opens the menu while the page is still loading or soon after', first.menuOk != null, 'the menu never opened');
      chk('index.html: the farm picture is drawn and the scripts have started', first.hero != null && first.ready != null, JSON.stringify({ hero: first.hero, ready: first.ready }));
    }
    // a second visit: the same context, so the browser's cache is warm
    const again = await loadOnce(ctx, site.url, file, { lang: 'en', cpu: 1, net: 'slow4g', interact: false, settle: 800, errs, limit: ms(240000) });
    chk(`${file}, second visit: ${Math.round(again.enc)} bytes downloaded for ${again.reqs} files (limit 6 KB: the page itself is asked again, everything else comes from the phone)`, !again.error && again.enc <= 6 * KB, JSON.stringify(again.files.filter((f) => f[2] > 600).slice(0, 4)));
    await ctx.close();
  }

  // Hindi: the words come in one more file, and every text is bigger
  {
    const ctx = await browser.newContext(PHONE);
    const hi = await loadOnce(ctx, site.url, 'index.html', { lang: 'hi', cpu: 1, net: 'slow4g', interact: false, settle: 1200, errs, limit: ms(240000) });
    const b = { reqs: 25, kb: 440, nodes: 75000 };
    chk(`index.html in Hindi: ${hi.reqs} files, ${Math.round(hi.enc / KB)} KB (limits ${b.reqs} files, ${b.kb} KB)`, !hi.error && hi.reqs <= b.reqs && hi.enc <= b.kb * KB, JSON.stringify({ reqs: hi.reqs, kb: Math.round(hi.enc / KB) }));
    chk(`index.html in Hindi: ${hi.nodes} nodes (limit ${b.nodes})`, hi.nodes > 0 && hi.nodes <= b.nodes, String(hi.nodes));
    chk(`index.html in Hindi: nothing jumps while it loads (layout shift ${hi.cls}, limit 0.02)`, hi.cls <= 0.02, JSON.stringify(hi.shifts.slice(0, 4)));
    await ctx.close();
  }

  // "reduce motion": nothing loops (the picture is still, the leaves do not fall)
  {
    const ctx = await browser.newContext({ ...PHONE, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.addInitScript(INIT('en'));
    await page.goto(site.url + 'index.html', { waitUntil: 'load', timeout: ms(60000) });
    await page.waitForFunction(() => window.__m && window.__m.ready != null, null, { timeout: ms(30000), polling: 100 }).catch(() => {});
    await sleep(1500);
    const r = await running(page);
    chk('with "reduce motion" on, no looping animation runs on the home page (' + JSON.stringify(r) + ')', r.running === 0, JSON.stringify(r));
    await ctx.close();
  }
} finally {
  await browser.close(); await site.close();
}
await finish({ errs });
