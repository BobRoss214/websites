// order: 190
// browser: yes
// covers: *.html, js/*.js, lang/hi.js, pages/*
/* The site when things go wrong: JavaScript off, pictures that do not load, one file lost on the way, a slow connection.
 * A visitor on bad hotel or farm wifi gets exactly these. Four parts:
 *   1. JavaScript off (6 pages; English and ?lang=hi; 390 and 1280 wide): prices, hours, address, booking and e-mail links, the questions (details/summary), the menu
 *      and the season dates can all be read and used; nothing waits invisible for a script; no "Open now" badge; a Hindi link shows English, with no empty holes.
 *   2. Scripts on, pictures blocked: every picture that did not come has its alt text, no huge empty frame, no sideways scrolling.
 *   3. Scripts on, ONE file missing (each js/*.js, each css/*.css, and lang/hi.js on a Hindi link): the page is never blank, the menu can still be reached, the
 *      mistake does not spread to other files (see the comment at the top of js/main.js, "each part starts on its own").
 *   4. A slow connection (about 3G: 500 kbit/s and 400 ms to the server, as in Chrome's "Slow 3G"): the first thing painted is already in the right language
 *      and the right season (no English first, no summer before fall). The times are printed, not judged: they depend on the computer.
 * There is no <noscript> note on purpose: every part that needs a script is hidden without it (part 1 checks that), so nothing is left empty. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { run, ok, info, until, ms, ROOT } from './lib.mjs';

const PAGES = ['index', 'first-visit', 'pumpkin-patch', 'strawberry-picking', 'school-field-trips', 'wise-pie'];
const HOURS = ['index', 'first-visit', 'pumpkin-patch', 'wise-pie'], PRICES = ['index', 'pumpkin-patch', 'school-field-trips'];   // where the page itself says it (the others link to the home page)
const LANES = 3;   // pages loaded at the same time in parts 2 to 4
const NOW = '2026-10-02T12:00:00-04:00';   // a Friday in fall: the farm is open
const BOOKEO = 'https://bookeo.com/wiseacres';
const phone = (w) => w < 500;
const ctxOpts = (w) => ({ viewport: { width: w, height: phone(w) ? 844 : 900 }, isMobile: phone(w), hasTouch: phone(w), locale: 'en-US', timezoneId: 'America/New_York' });

/* ---- what the page shows (runs inside the page; also works with JavaScript switched off) ---- */
function facts() {
  try { document.getAnimations().forEach((a) => { try { a.finish(); } catch (e) { /* an endless animation */ } }); } catch (e) { /* old browser */ }
  const root = document.documentElement;
  const shown = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const text = document.body.innerText;
  const faded = [];   // visible-looking text that is transparent or hidden by visibility (not by display:none, which is a deliberate hide)
  for (const e of document.body.querySelectorAll('*')) {
    if (e.children.length || (e.textContent || '').trim().length < 8) continue;
    if (e.closest('svg,script,style,noscript,template,dialog,.sr-only,[aria-hidden="true"],details:not([open]) > :not(summary)')) continue;
    for (let x = e; x && x !== document.body; x = x.parentElement) {
      const c = getComputedStyle(x);
      if (c.display === 'none') break;
      if (c.visibility === 'hidden' || parseFloat(c.opacity) === 0) { faded.push((x.className || x.tagName) + ': ' + e.textContent.trim().slice(0, 30)); break; }
    }
  }
  let devanagari = false;   // Hindi words on show (the names of the languages in the language list do not count: they are always written in their own script)
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = walk.nextNode());) if (/[\u0900-\u097F]/.test(n.nodeValue) && n.parentElement.getClientRects().length && !n.parentElement.closest('.lang-link,.lang-list,[data-lang-menu]')) { devanagari = true; break; }
  const toggle = document.getElementById('menu-toggle');
  const first = (q) => [...document.querySelectorAll(q)].filter(shown);
  return {
    cls: root.className, lang: root.lang, wLang: window.WISE_ACRES && window.WISE_ACRES.lang, chars: text.length,
    h1: (document.querySelector('h1') || { innerText: '' }).innerText.trim(),
    faded: faded.slice(0, 3), fadedN: faded.length,
    noSrc: [...document.images].filter((i) => !i.closest('dialog') && i.getClientRects().length && !i.getAttribute('src') && !i.getAttribute('srcset')).length,
    book: first('a[href^="https://bookeo.com/wiseacres"]').length, mail: first('a[href^="mailto:"]').length,
    address: /4701 Hartis/.test(text), clock: /\d\s?(am|pm)\b/i.test(text), price: /\$\d/.test(text),
    navLinks: first('#nav a').length, toggle: !!toggle && shown(toggle),
    sbw: root.scrollWidth - root.clientWidth,
    live: first('.live').map((e) => e.textContent.trim()).filter(Boolean),
    holes: first('[data-t]').filter((e) => e.textContent.trim() === '' && !e.querySelector('img,svg,input')).length,
    braces: /\{\w+\}|undefined|\[object|NaN/.test(text), devanagari,
    panels: first('.season-panel,.group-panel').length, panelsInPage: document.querySelectorAll('.season-panel,.group-panel').length, tabs: first('.season-tabs,.group-tabs').length,
    heroSub: first('.hero-sub').map((e) => e.dataset.only), heroTitle: first('#hero-h > [data-only]').map((e) => e.dataset.only),
    dated: first('[data-until]').length, picker: first('#picker').length, seasonSwitch: first('#season-switch').length, mapShown: first('#farm-map').length,
  };
}

/* The menu can be reached: either its button works, or there is no button and the links are simply there. */
async function menuReachable(p) {
  const links = () => p.evaluate(() => [...document.querySelectorAll('#nav a')].filter((e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden').length);
  let n = await links();
  const btn = p.locator('#menu-toggle');
  if (n < 5 && await btn.isVisible()) {
    try { await btn.click({ timeout: ms(15000) }); } catch (e) { /* the button cannot be pressed: the count below says so */ }
    for (const end = Date.now() + ms(5000); n < 5 && Date.now() < end;) { await p.waitForTimeout(250); n = await links(); }   // the menu slides in
  }
  return n;
}

/* A small web server for part 4 that compresses like a real host does (the built-in one does not), so the numbers are those of a real visit. */
function gzipServer() {
  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
  const cache = new Map();
  const srv = http.createServer((req, res) => {
    let file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    try { if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html'); } catch (e) { /* 404 below */ }
    fs.readFile(file, (err, body) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      const ext = path.extname(file), h = { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' };
      if (/^\.(html|js|css|json|svg|webmanifest)$/.test(ext) && /gzip/.test(req.headers['accept-encoding'] || '')) {
        if (!cache.has(file)) cache.set(file, zlib.gzipSync(body));
        body = cache.get(file); h['Content-Encoding'] = 'gzip';
      }
      h['Content-Length'] = body.length; res.writeHead(200, h); res.end(body);
    });
  });
  srv.keepAliveTimeout = 120000;
  return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${srv.address().port}/`, close: () => new Promise((r) => { srv.closeAllConnections && srv.closeAllConnections(); srv.close(() => r()); }) })));
}

await run('no-js', async ({ browser, base, errs }) => {
  const t0 = Date.now(), lap = (what) => info(`(${what}: ${Math.round((Date.now() - t0) / 1000)} s so far)`);
  /* ================= 1. JavaScript off ================= */
  for (const [w, q] of [[390, ''], [1280, ''], [390, '?lang=hi']]) {
    const ctx = await browser.newContext({ ...ctxOpts(w), javaScriptEnabled: false });
    for (const pg of PAGES) {
      const label = `JS off, ${pg}, ${w} px${q ? ', ?lang=hi' : ''}`;
      const p = await ctx.newPage();
      await p.goto(base + pg + '.html' + q, { waitUntil: 'load', timeout: ms(60000) });
      const f = await p.evaluate(facts);
      ok(label + ': the page is the plain English page (html lang en, .no-js still on)', f.lang === 'en' && /\bno-js\b/.test(f.cls) && !f.devanagari, `${f.lang} ${f.cls} devanagari:${f.devanagari}`);
      ok(label + ': nothing is invisible waiting for a script (no transparent or visibility:hidden text)', f.fadedN === 0, f.faded.join(' | '));
      ok(label + ': no picture without a source is on show', f.noSrc === 0, String(f.noSrc));
      ok(label + ': no empty holes where a translation would go, no {placeholders} / undefined', f.holes === 0 && !f.braces, `holes ${f.holes}, braces ${f.braces}`);
      ok(label + ': the booking link, the e-mail link and the address are there', f.book > 0 && f.mail > 0 && f.address, `book ${f.book}, mail ${f.mail}, address ${f.address}`);
      if (HOURS.includes(pg)) ok(label + ': the opening hours are written out (a clock time)', f.clock);
      if (PRICES.includes(pg)) ok(label + ': the prices are written out', f.price);
      ok(label + ': no "Open now" style badge (they are drawn by a script, so none can be out of date)', f.live.length === 0, f.live.join(' | '));
      ok(label + ': the menu links are all on show (no button that cannot open)', !f.toggle && f.navLinks >= 5, `toggle ${f.toggle}, links ${f.navLinks}`);
      ok(label + ': no sideways scrolling', f.sbw <= 1, String(f.sbw));
      if (f.panelsInPage) ok(label + ': every season / group panel is on show and the tab bars (which need a script) are not', f.panels === f.panelsInPage && f.tabs === 0, `panels ${f.panels}/${f.panelsInPage}, tab bars ${f.tabs}`);
      if (pg === 'index') {
        ok(label + ': the hero shows the all-year title and text, not one season\'s', f.heroTitle.join() === 'spring summer fall' && f.heroSub.join() === 'no-js', `title ${f.heroTitle}, text ${f.heroSub}`);
        ok(label + ': the parts that exist only with a script (season switcher, picking game, farm map) are hidden, not empty', f.seasonSwitch === 0 && f.picker === 0 && f.mapShown === 0, `switcher ${f.seasonSwitch}, game ${f.picker}, map ${f.mapShown}`);
        if (w === 390 && !q) info(`${f.dated} dated lines (data-until) stay on show without a script: they cannot hide themselves after their day (README: "Visitors without JavaScript still see it")`);
      }
      // the questions open and close with the browser's own behavior
      let opened = false, why = '';
      try {
        const sum = await p.locator('details:not([open]) > summary:visible').first().elementHandle({ timeout: ms(5000) });   // a handle: after the click a locator would point at the next closed question
        await sum.click({ timeout: ms(10000) });
        opened = await sum.evaluate((s) => s.parentElement.open && [...s.parentElement.children].some((c) => c !== s && c.getClientRects().length > 0));
      } catch (e) { why = String(e.message).split('\n')[0]; }
      ok(label + ': a question opens without JavaScript and shows its answer', opened, why);
      await p.close();
    }
    await ctx.close();
  }

  lap('part 1, JavaScript off done');

  /* ================= 2. Pictures blocked ================= */
  const noPictures = async (p) => { await p.route('**/*', (r) => (r.request().resourceType() === 'image' ? r.abort() : r.continue())); };
  const unpictured = await inLanes([['index', 390], ['index', 1280], ['first-visit', 390], ['pumpkin-patch', 390], ['strawberry-picking', 390], ['school-field-trips', 390], ['wise-pie', 390]], LANES, async ([pg, w]) => {
    const label = `pictures blocked, ${pg}, ${w} px`, checks = [];
    const p = await open_(browser, base, pg + '.html', errs, w, { routes: noPictures });
    await p.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach((i) => { i.loading = 'eager'; }));
    await until(p, () => [...document.images].every((i) => i.complete), null, 8000);
    const r = await p.evaluate(() => {
      const bad = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.getClientRects().length && getComputedStyle(i).visibility !== 'hidden');
      return { n: document.images.length, bad: bad.length, noAlt: bad.filter((i) => !(i.alt || '').trim() && !i.closest('[aria-hidden="true"]')).map((i) => i.getAttribute('src')),
        tallest: Math.round(Math.max(0, ...bad.map((i) => i.getBoundingClientRect().height))), sbw: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        chars: document.body.innerText.length, h1: (document.querySelector('h1') || { innerText: '' }).innerText.trim() };
    });
    checks.push([label + ': the page still reads (headline and text are there)', r.h1.length > 3 && r.chars > 2000, `h1 "${r.h1}", ${r.chars} characters`]);
    checks.push([label + ': ' + r.bad + ' of ' + r.n + ' pictures did not come and every one of them has alt text', r.noAlt.length === 0, r.noAlt.join(' | ')]);
    checks.push([label + ': no giant empty frame (the tallest missing picture is ' + r.tallest + ' px) and no sideways scrolling', r.tallest <= 450 && r.sbw <= 1, `tallest ${r.tallest}, sideways ${r.sbw}`]);
    await p.context().close();
    return { checks, infos: [] };
  });
  report(unpictured);
  lap('part 2, pictures blocked done');

  /* ================= 3. One file missing ================= */
  // The files to lose are read from the home page itself, so a script or style sheet added later (js/guard.js, ...) is in the list without anyone remembering to add it.
  const homeHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const SCRIPTS = [...homeHtml.matchAll(/<script[^>]*\ssrc="(js\/[^"]+)"/g)].map((m) => m[1]);
  const STYLES = [...homeHtml.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="(css\/[^"]+)"/g)].map((m) => m[1]);
  const unlisted = [...fs.readdirSync(path.join(ROOT, 'js')).map((f) => 'js/' + f), ...fs.readdirSync(path.join(ROOT, 'css')).map((f) => 'css/' + f)].filter((f) => f !== 'js/footer-art.js' && !SCRIPTS.includes(f) && !STYLES.includes(f));   // js/footer-art.js is the footer drawing the five extra pages load instead of js/hero.js (tools/pages.py makes it; tests/sprite.test.mjs checks it)
  ok(`every file in js/ and css/ is loaded by the home page, so all ${SCRIPTS.length} scripts and ${STYLES.length} style sheets are tried below`, SCRIPTS.length >= 10 && STYLES.length >= 5 && unlisted.length === 0, unlisted.join(', '));
  // Opens a page as a phone with one file refused (the connection drops). Returns the page and the errors it raised.
  async function without(file, pg, q = '') {
    const raised = [];
    const ctx = await browser.newContext(ctxOpts(390));
    const p = await ctx.newPage();
    p.setDefaultTimeout(ms(20000));
    p.on('pageerror', (e) => raised.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) raised.push(m.text()); });
    if (file) await p.route((u) => u.pathname.endsWith('/' + file), (r) => r.abort());
    await p.clock.install({ time: new Date(NOW) });
    await p.goto(base + pg + '.html' + q, { waitUntil: 'load', timeout: ms(60000) });
    await p.clock.runFor(1500);
    return { p, raised };
  }
  const base0 = await without('', 'index');
  const baseline = await base0.p.evaluate(facts);
  ok('nothing missing (the reference for the rest): no errors, the page is built', base0.raised.length === 0 && baseline.chars > 20000, `${baseline.chars} characters, ${base0.raised.join(' | ')}`);
  await base0.p.context().close();

  const cases = [...SCRIPTS, ...STYLES].map((f) => [f, 'index', '']).concat([['lang/hi.js', 'index', '?lang=hi']]);
  for (const pg of ['first-visit', 'wise-pie']) for (const f of ['js/main.js', 'js/season.js']) cases.push([f, pg, '']);
  for (const f of NOT_ON_HOME) cases.push([f, 'wise-pie', '']);   // a script only the light pages load is lost on one of them
  const missing = await inLanes(cases, LANES, async ([file, pg, q]) => {
    const label = `${file} missing, ${pg}${q ? ' ' + q : ''}`, checks = [], infos = [];
    const { p, raised } = await without(file, pg, q);
    const f = await p.evaluate(facts);
    checks.push([label + ': not a blank page (headline, text, the booking link)', f.chars > (pg === 'index' ? baseline.chars * 0.6 : 1500) && f.h1.length > 3 && f.book > 0, `${f.chars} characters (home page, nothing missing: ${baseline.chars}), h1 "${f.h1}", book links ${f.book}`]);
    // season.js: main.js stops on its first use of the season data: a reported error for each part that needs it, and nothing from the other files
    const unexpected = raised.filter((e) => !(file === 'js/season.js' && /Cannot read properties of undefined \(reading '(live|farmDay|current|list|inWindow|daysUntilStart)'\)/.test(e)));
    checks.push([label + ': the missing file does not make other files fail', unexpected.length === 0, unexpected.slice(0, 3).join(' | ')]);
    if (file === 'js/main.js') {
      checks.push([label + ': the page is shown as without scripts: seasons and groups stacked, no dead tabs, no dead toys', f.panels === f.panelsInPage && f.tabs === 0 && /\bjs-failed\b/.test(f.cls), `${f.cls}; panels ${f.panels}/${f.panelsInPage}, tab bars ${f.tabs}`]);
      checks.push([label + ': the buttons that only main.js drives are gone (menu button, farm-year tabs, toys)', await p.evaluate(() => ['.menu-toggle', '.fs-tabs', '.goat-nook', '.bouquet', '.filter-row'].every((s) => [...document.querySelectorAll(s)].every((e) => e.getClientRects().length === 0))), '']);
    }
    if (file === 'js/season.js' && pg === 'index') {
      await p.click('#tab-summer');
      checks.push([label + ': the season tabs still work (they show the first season until picked)', await p.evaluate(() => !document.getElementById('panel-summer').hidden && document.getElementById('panel-spring').hidden), '']);
    }
    if (file === 'js/guard.js') checks.push([label + ': changes nothing for the visitor (same text, same state as with every file there)', Math.abs(f.chars - baseline.chars) <= baseline.chars * 0.02 && f.cls === baseline.cls && f.lang === baseline.lang, `${f.chars} vs ${baseline.chars} characters, "${f.cls}" vs "${baseline.cls}"`]);
    if (file === 'js/hero.js') checks.push([label + ': no dead picking game or season switcher is left', f.picker === 0 && f.seasonSwitch === 0, `game ${f.picker}, switcher ${f.seasonSwitch}`]);
    if (file === 'js/live.js' || file === 'js/content.js') checks.push([label + ': no "Open now" claim is made without the hours', f.live.length === 0, f.live.join(' | ')]);
    if (file === 'js/i18n.js' || file === 'lang/hi.js') checks.push([label + ': the page is whole English (nothing half translated, no holes), html lang en', f.lang === 'en' && !f.devanagari && f.holes === 0 && (file === 'js/i18n.js' || f.wLang === 'en'), `lang ${f.lang}, W.lang ${f.wLang}, devanagari ${f.devanagari}, holes ${f.holes}`]);
    if (file.startsWith('css/')) infos.push(`${file} missing: ${f.chars} characters of text, sideways scroll ${f.sbw} px`);
    const links = await menuReachable(p);   // last: an open menu covers the page
    // Without the base style sheets nothing is laid out (the menu button is not even a button any more): that is only reported.
    if (/^css\/(styles|sections)\.css$/.test(file)) infos.push(`${file} missing: ${links} menu links can be reached`);
    else checks.push([label + ': the menu can still be reached (its links are on show, or its button opens them)', links >= 5, `${links} links on show`]);
    await p.context().close();
    return { checks, infos };
  });
  report(missing);
  lap('part 3, files missing done');

  /* ================= 4. Slow connection ================= */
  const gz = await gzipServer();
  try {
    const slow = await inLanes([['index', 'hi'], ['pumpkin-patch', 'en'], ['wise-pie', 'hi']], LANES, async ([pg, lang]) => {
      const label = `slow 3G, ${pg}${lang === 'hi' ? ' ?lang=hi' : ''}`, checks = [];
      const ctx = await browser.newContext(ctxOpts(390));
      const p = await ctx.newPage();
      p.on('pageerror', (e) => errs.push(label + ' pageerror: ' + e.message));
      await p.addInitScript((day) => {   // the page's date (only Date; the timers keep running for real) and a log of what each painted frame shows
        const RD = Date, off = new RD(day).getTime() - RD.now();
        window.Date = class extends RD { constructor(...a) { if (a.length) super(...a); else super(RD.now() + off); } static now() { return RD.now() + off; } };
        const log = (window.__frames = []), paint = (window.__paint = {}); let last = '';
        try { new PerformanceObserver((l) => l.getEntries().forEach((e) => { paint[e.name] = Math.round(e.startTime); })).observe({ type: 'paint', buffered: true }); } catch (e) { /* no paint timing */ }
        const tick = () => {
          const H = document.documentElement, b = document.body;
          const h1 = b && document.querySelector('h1'), sub = b && [...document.querySelectorAll('.hero-sub')].find((x) => x.getClientRects().length);
          const s = JSON.stringify([H.lang, H.getAttribute('data-season') || '', h1 ? h1.innerText.replace(/\s+/g, ' ').slice(0, 30) : '', sub ? sub.innerText.replace(/\s+/g, ' ').slice(0, 24) : '', b && b.innerText.length > 0 ? 'text' : 'empty']);
          if (s !== last) { last = s; log.push([Math.round(performance.now()), JSON.parse(s)]); }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }, NOW);
      const cdp = await ctx.newCDPSession(p);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: (500 * 1024) / 8, uploadThroughput: (500 * 1024) / 8 });
      const t0 = Date.now();
      await p.goto(gz.url + pg + '.html' + (lang === 'hi' ? '?lang=hi' : ''), { waitUntil: 'load', timeout: ms(170000) });
      const loadMs = Date.now() - t0;
      await until(p, () => window.__paint && window.__paint['first-contentful-paint'] && window.__frames.some(([, s]) => s[4] === 'text'), null, 20000);   // the first paint has been seen (a fixed 1.5 s was not always enough on a busy computer)
      await p.waitForTimeout(ms(1500));   // and a little longer, so that a late change of language or season would be seen too
      const r = await p.evaluate(() => ({ paint: window.__paint, frames: window.__frames, lang: document.documentElement.lang }));
      const withText = r.frames.filter(([, s]) => s[4] === 'text').map(([, s]) => s);
      const distinct = (i) => [...new Set(withText.map((s) => s[i]).filter(Boolean))];
      checks.push([label + ': text appears (first contentful paint ' + (r.paint['first-contentful-paint'] || '?') + ' ms, page loaded after ' + loadMs + ' ms)', withText.length > 0 && !!r.paint['first-contentful-paint'], '']);
      checks.push([label + ': every frame shows ' + (lang === 'hi' ? 'Hindi' : 'English') + ' only (no flash of the other language)', withText.length > 0 && distinct(0).join() === lang, `languages seen: ${distinct(0)}`]);
      checks.push([label + ': every frame shows fall only (no other season first), one headline, one hero line', distinct(1).join() === 'fall' && distinct(2).length <= 1 && distinct(3).length <= 1, `seasons ${distinct(1)}, headlines ${distinct(2).length}, hero lines ${distinct(3).length}`]);
      checks.push([label + ': the page ends in the language asked for', r.lang === lang, r.lang]);
      await ctx.close();
      return { checks, infos: [] };
    });
    report(slow);
  } finally { await gz.close(); }
  lap('part 4, slow connection done');
});

/* Runs worker(item) for every item, `lanes` at a time (the browser can load several pages at once); the results come back in the order of the items. */
async function inLanes(items, lanes, worker) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(lanes, items.length) }, async () => {
    for (;;) { const i = next++; if (i >= items.length) return; out[i] = await worker(items[i]); }
  }));
  return out;
}
function report(results) { results.forEach(({ checks, infos }) => { infos.forEach(info); checks.forEach(([name, cond, detail]) => ok(name, cond, detail)); }); }

// open() from tests/lib.mjs, but at a chosen width and without waiting for features.js (a part of the page may be missing on purpose).
async function open_(browser, base, url, errs, w, opts = {}) {
  const ctx = await browser.newContext(ctxOpts(w));
  const p = await ctx.newPage();
  p.setDefaultTimeout(ms(20000));
  p.on('pageerror', (e) => errs.push(url + ' pageerror: ' + e.message));
  if (opts.routes) await opts.routes(p);
  await p.clock.install({ time: new Date(NOW) });
  await p.goto(base + url, { waitUntil: 'load', timeout: ms(60000) });
  await p.clock.runFor(1500);
  return p;
}
