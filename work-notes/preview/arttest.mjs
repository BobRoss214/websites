#!/usr/bin/env node
/* Checks a preview folder made by build-artifact.py, the way the claude.ai viewer shows it.
 *
 *   node work-notes/preview/arttest.mjs [--dir /tmp/preview-out] [--shots DIR] [--quick] [--only static,home,flags,flow,tour,blocked]
 *
 * It reads <dir>/build-info.json to know whether the build has the demo and tour flags (a build made with --no-flags is tested the other way round:
 * nothing demo-related may show). It serves the folder from a pretend address (https://art.local/) and shows every page inside an <iframe> of a
 * pretend viewer (https://viewer.local/): a frame from ANOTHER address, as in the claude.ai viewer (observers ignore rootMargin there, and the frame
 * keeps its own storage). The index page is wrapped the way the Artifact tool wraps it when it publishes it (SKELETON_HEAD below, measured on the
 * published preview on 3 Nov 2026). Only the files in build-info.json are served: a page that asks for any other file (a photo that was not published,
 * a css/ or js/ file that the build should have put inline) is a failed check.
 *
 * Sections (--only picks some; --quick leaves out the long tour walk):
 *   static   sizes and file counts against the Artifact limits; the flags script is the FIRST script; every link and picture points at a published file;
 *            in a build made with --no-flags nothing is switched on
 *   home     the home page and First visit show what they showed before (countdown, week box, signup, map, press, drive times, photos), links between pages work
 *   flags    on every page: the Sign in control and the "Take a tour" pill (flags on), or neither (flags off; the demo pages show only their guard box)
 *   flow     (needs the three demo pages) one browser, several tabs: a request made on account.html shows on farm-desk.html, live (the storage event) and after
 *            a reload; the desk's answer comes back; the kitchen sees the orders; the demo bar's links work; "Start over" empties all of it
 *   tour     (needs the tour) the pill opens the welcome card, the tour walks through every page with Next (also across pages) and asks for no file
 *   blocked  a frame that refuses all storage (the strictest viewer): the pages load without errors and the pretend account still follows the tab from page
 *            to page (the window.name fallback of the build)
 * This opens several tabs: run it as  flock /tmp/wa-heavy.lock node work-notes/preview/arttest.mjs ...  and, in this project, from a background script with a log. */
import fs from 'node:fs';
import path from 'node:path';
import { ok, info, until, okSoon, ms, launch, finish, TODAY } from '../../tests/lib.mjs';
import { findClashes } from './globals-check.mjs';

const argv = process.argv.slice(2);
const arg = (name, dflt = '') => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt; };
const DIR = path.resolve(arg('--dir', '/tmp/preview-out'));
const SHOTS = arg('--shots');
const QUICK = argv.includes('--quick');
const ONLY = arg('--only') ? arg('--only').split(',') : null;
const want = (s) => !ONLY || ONLY.includes(s);

if (!fs.existsSync(path.join(DIR, 'build-info.json'))) {
  console.log('FAIL ' + DIR + '/build-info.json is not there: build the preview first (python3 work-notes/preview/build-artifact.py --out ' + DIR + ')');
  process.exit(1);
}
const INFO = JSON.parse(fs.readFileSync(path.join(DIR, 'build-info.json'), 'utf8'));
const FLAGS = !!INFO.flags;
const PAGES = INFO.pages.map((p) => p.path);
const DEMO_PAGES = ['account.html', 'farm-desk.html', 'kitchen.html'];
const HAVE_DEMO = DEMO_PAGES.every((p) => PAGES.includes(p));
const HAVE_TOUR = INFO.js_inlined.includes('js/tour.js');
const HAVE_HEADER = INFO.js_inlined.includes('js/demo-header.js');
const PUBLISHED = new Set(['index.html', ...INFO.publish.files]);

// What the Artifact tool puts around the index page when it publishes it (the other pages are served as they are). Measured on 3 Nov 2026.
const SKELETON_HEAD = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>\n';
const wrapIndex = (t) => SKELETON_HEAD + t + '\n</body></html>';
const TYPES = { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const SANDBOX = 'allow-scripts allow-same-origin allow-popups allow-forms';      // a frame from another address that keeps its own storage
const SANDBOX_STRICT = 'allow-scripts allow-popups allow-forms';                   // no address of its own: every kind of storage is refused
const NOISE = /fonts\.g|net::ERR|Failed to load resource|favicon/;
const errs = [];
const shot = async (page, name) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + '.png') }).catch(() => {}); };

/* ------------------------------------------------------------------ the pretend viewer and the pretend address ---------------------------------- */
async function world(browser, { sandbox = SANDBOX, viewport = { width: 1440, height: 900 }, label = 'tab' } = {}) {
  const ctx = await browser.newContext({ viewport, locale: 'en-US', timezoneId: 'America/New_York', ignoreHTTPSErrors: true });
  const log = { requests: [], missing: [] };
  // the viewer gives a page window.claude.use('downloads') (the preview declares the "downloads" capability); here it just writes down what it was asked to save
  await ctx.addInitScript(() => {
    window.__saves = [];
    window.claude = { use: (name) => Promise.resolve(name === 'downloads' ? { save: (o) => { window.__saves.push({ filename: o && o.filename, size: o && o.data && o.data.size, type: o && o.data && o.data.type }); return Promise.resolve({ saved: true }); } } : null) };
  });
  await ctx.route('https://art.local/**', (r) => {
    const u = new URL(r.request().url());
    const p = decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'index.html';
    log.requests.push(p);
    const f = path.join(DIR, p);
    if (!PUBLISHED.has(p) || !fs.existsSync(f)) { log.missing.push(p); return r.fulfill({ status: 404, contentType: 'text/plain', body: 'not published' }); }
    const type = TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream';
    if (p === 'index.html') return r.fulfill({ status: 200, contentType: type, body: wrapIndex(fs.readFileSync(f, 'utf8')) });
    return r.fulfill({ status: 200, contentType: type, body: fs.readFileSync(f) });
  });
  await ctx.route('https://viewer.local/**', (r) => {
    const u = new URL(r.request().url());
    const src = u.searchParams.get('src') || 'https://art.local/index.html';
    r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><head><meta charset=utf8><title>viewer</title></head><body style="margin:0"><iframe id="art" title="preview" sandbox="'
      + (u.searchParams.get('sandbox') || SANDBOX) + '" src="' + src.replace(/"/g, '&quot;') + '" style="display:block;width:100vw;height:100vh;border:0"></iframe></body></html>' });
  });
  const w = {
    ctx, log, label, sandbox,
    /** a new tab with the pretend viewer showing page `name` (optionally at a #hash); returns { page, f, name, w }, f being the frame with the site in it */
    async open(name, { hash = '', ready = true, time = null } = {}) {
      const page = await ctx.newPage();
      page.setDefaultTimeout(ms(20000));
      if (time) await page.clock.install({ time: new Date(time) });   // the date the site tests use, for the checks that depend on the day (the pizza countdown, the week box)
      const tag = label + ' ' + name;
      page.on('pageerror', (e) => errs.push(tag + ' pageerror: ' + e.message));
      page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errs.push(tag + ' console: ' + m.text()); });
      await page.goto('https://viewer.local/?sandbox=' + encodeURIComponent(sandbox) + '&src=' + encodeURIComponent('https://art.local/' + name + (hash ? '#' + hash : '')), { waitUntil: 'load', timeout: ms(60000) });
      const f = await (await page.waitForSelector('iframe#art', { timeout: ms(20000) })).contentFrame();
      await f.waitForLoadState('load', { timeout: ms(60000) });
      const tab = { page, f, name, w };
      if (ready) await w.ready(tab);
      if (time && ready) await page.clock.runFor(1200).catch(() => {});
      return tab;
    },
    async ready(tab) {
      const started = await until(tab.f, () => !!(window.WISE_ACRES && window.WISE_ACRES.features), null, 40000);
      if (!started) errs.push(label + ' ' + tab.name + ': the site scripts did not finish starting');
      return started;
    },
    /** click a link in the frame and wait until the frame has arrived at `pageName` and its scripts have started */
    async go(tab, locator, pageName) {
      await locator.click();
      let url = '';
      const t0 = Date.now();
      while (Date.now() - t0 < ms(20000)) { url = tab.f.url(); if (url.split('#')[0].split('?')[0].endsWith('/' + pageName)) break; await new Promise((r) => setTimeout(r, 100)); }
      tab.name = pageName;
      if (!url.split('#')[0].endsWith('/' + pageName)) return false;
      await tab.f.waitForLoadState('load', { timeout: ms(60000) }).catch(() => {});
      return w.ready(tab);
    },
    async close() { await ctx.close(); },
  };
  return w;
}

const header = (f) => f.locator('.site-header');
const signIn = (f) => header(f).getByRole('link', { name: /sign in|my account/i }).or(header(f).getByRole('button', { name: /sign in|my account/i }));
const tourPill = (f) => f.getByRole('button', { name: /take a tour/i });                                                  // the floating pill is a button
const tourAny = (f) => f.getByRole('button', { name: /take a tour/i }).or(f.getByRole('link', { name: /take a tour/i }));   // the pill, or the demo bar's link
const shown = (f, sel) => f.evaluate((q) => [...document.querySelectorAll(q)].filter((e) => e.getClientRects().length > 0).length, sel);   // matches that are on the screen (a screen may keep hidden leftovers)
const store = (f, body, arg) => f.evaluate(new Function('arg', 'const S = window.DemoStore; ' + body), arg);   // runs `body` in the page with S = the page's own DemoStore

/* ------------------------------------------------------------------ static checks (no browser) ----------------------------------------------------- */
function walk(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name), base) : [path.relative(base, path.join(dir, d.name)).split(path.sep).join('/')]));
}
const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
function staticChecks() {
  const MIB = 1024 * 1024, L = INFO.limits;
  const files = walk(DIR).filter((f) => f !== 'build-info.json' && f !== 'publish-files.json');
  const sizes = Object.fromEntries(files.map((f) => [f, fs.statSync(path.join(DIR, f)).size]));
  const total = Object.values(sizes).reduce((a, b) => a + b, 0);
  const mb = (n) => (n / MIB).toFixed(1) + ' MB';
  ok('every file in build-info.json is in the folder, and nothing else is', files.length === PUBLISHED.size && files.every((f) => PUBLISHED.has(f)), 'folder ' + files.length + ' files, list ' + PUBLISHED.size);
  ok('at most ' + L.files_per_publish + ' files in one publish', files.length <= L.files_per_publish, files.length + ' files');
  ok('at most ' + mb(L.bytes_per_publish) + ' in one publish', total <= L.bytes_per_publish, mb(total));
  ok('inside the whole artifact\'s limits (' + L.files_per_version + ' files, ' + mb(L.bytes_per_version) + ') even with the 38 files and 12 MB published on 3 Nov 2026 kept', files.length + 38 <= L.files_per_version && total + 12 * MIB <= L.bytes_per_version);
  const big = files.filter((f) => sizes[f] > (f.endsWith('.html') ? L.page : /\.(webp|jpe?g|png|gif)$/i.test(f) ? L.binary_file : L.text_file));
  ok('no page or file is over its limit (page ' + mb(L.page) + ', picture ' + mb(L.binary_file) + ')', big.length === 0, big.join(', '));
  const biggest = Object.entries(sizes).sort((a, b) => b[1] - a[1])[0];
  info(files.length + ' files, ' + mb(total) + ' in all; the largest is ' + biggest[0] + ' (' + mb(biggest[1]) + ')');
  ok('index.html is a fragment for the Artifact tool to wrap (it does not start with <!doctype> or <html>)', !/^\s*(?:<!--[\s\S]*?-->\s*)*(?:<!doctype|<html)/i.test(fs.readFileSync(path.join(DIR, 'index.html'), 'utf8')));
  for (const n of PAGES.filter((p) => p !== 'index.html')) ok(n + ' is a whole page (starts with <!doctype html>)', /^\s*<!doctype html>/i.test(fs.readFileSync(path.join(DIR, n), 'utf8')));

  const html = Object.fromEntries(PAGES.map((n) => [n, fs.readFileSync(path.join(DIR, n), 'utf8')]));
  const firstScript = (t) => { for (const m of t.matchAll(SCRIPT)) { const type = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(m[1]); if (type && !/^(?:text\/javascript|module)$/i.test(type[1])) continue; return m; } return null; };
  for (const n of PAGES) {
    const first = firstScript(html[n]);
    if (FLAGS) ok(n + ': the FIRST script sets WA_DEMO, WA_TOUR and WA_TOUR_INLINE', !!first && /^\s*window\.WA_DEMO\s*=\s*true;\s*window\.WA_TOUR\s*=\s*true;\s*window\.WA_TOUR_INLINE\s*=\s*true;\s*$/.test(first[2]), first ? first[2].slice(0, 80) : 'no script');
    else ok(n + ': no flag is set anywhere (a build made with --no-flags)', !/\bWA_(?:DEMO|TOUR|TOUR_INLINE)\s*=\s*true\b/.test(html[n]));
  }
  // links and pictures
  const strip = (t) => t.replace(SCRIPT, '').replace(/<style\b[\s\S]*?<\/style>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  const ids = Object.fromEntries(PAGES.map((n) => [n, new Set([...strip(html[n]).matchAll(/\b(?:id|name)\s*=\s*"([^"]+)"/g)].map((m) => m[1]))]));
  const DYNAMIC = /^(?:tour|visits|pizza|family|alerts|year|messages|photos|event)(?:\?.*)?$/;
  const bad = [], badHash = [];
  for (const n of PAGES) {
    const t = strip(html[n]);
    for (const m of t.matchAll(/<(?:a|area)\b[^>]*?\bhref\s*=\s*"([^"]*)"/gi)) {
      const h = m[1].trim();
      if (!h || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(h)) continue;                  // other sites, mailto:, tel:
      const p = h.split('#')[0].split('?')[0], hash = h.includes('#') ? h.slice(h.indexOf('#') + 1) : '';
      const target = p || n;
      if (!PUBLISHED.has(target)) { bad.push(n + ' -> ' + h); continue; }
      if (hash && target.endsWith('.html') && !DEMO_PAGES.includes(target) && !DYNAMIC.test(hash) && !ids[target].has(hash)) badHash.push(n + ' -> ' + h);
    }
    for (const m of t.matchAll(/<(?:img|source)\b[^>]*?\b(?:src|srcset)\s*=\s*"([^"]*)"/gi)) {
      for (const one of m[1].split(',').map((x) => x.trim().split(/\s+/)[0]).filter(Boolean)) {
        if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(one)) continue;
        if (!PUBLISHED.has(one.split('#')[0].split('?')[0])) bad.push(n + ' picture -> ' + one);
      }
    }
  }
  ok('every link and picture of every page points at a published file', bad.length === 0, bad.slice(0, 8).join(' | '));
  const withQuery = [];
  for (const n of PAGES) for (const m of strip(html[n]).matchAll(/<a\b[^>]*?\bhref\s*=\s*"([^"#]*\?[^"]*)"/gi)) if (!/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(m[1])) withQuery.push(n + ' -> ' + m[1]);
  ok('no link between the pages needs a query string (the viewer does not pass one)', withQuery.length === 0, withQuery.slice(0, 5).join(' | '));
  ok('every #place that a link names exists on the page it points at', badHash.length === 0, badHash.slice(0, 8).join(' | '));
  const clashes = PAGES.flatMap((n) => findClashes(html[n]).map((c) => n + ': ' + c.name + ' in ' + c.file + (c.others.length ? ' and ' + c.others.join(', ') : '') + ' (' + c.kind + ')'));
  ok('no two scripts of a page fight over a top-level name (each file is its own script, as on the real site)', clashes.length === 0, clashes.slice(0, 4).join(' | '));
  if (FLAGS && HAVE_TOUR) ok('the tour\'s css is inline (WA_TOUR_INLINE): css/tour.css is among the inlined files', INFO.css_inlined.includes('css/tour.css'), INFO.css_inlined.join(', '));
  if (FLAGS && HAVE_TOUR) info('tour steps inlined: ' + (INFO.js_inlined.filter((j) => /tour-steps/.test(j)).join(', ') || 'none'));
}

/* ------------------------------------------------------------------ the sections ---------------------------------------------------------------- */
const sections = {};

sections.static = async () => { staticChecks(); };

sections.home = async ({ browser }) => {
  const w = await world(browser, { label: 'home' });
  {
    const t = await w.open('index.html', { time: TODAY });
    await t.f.addStyleTag({ content: '.reveal{opacity:1!important;transform:none!important;transition:none!important}' });
    await t.f.evaluate(() => { const m = document.querySelector('#farm-map'); if (m) m.scrollIntoView(); });
    await until(t.f, () => document.querySelectorAll('#farm-map .map-item').length > 0, null, 20000);
    const s = await t.f.evaluate(() => ({ rel: !document.querySelector('[data-rel-box]').hidden, week: !document.querySelector('[data-week]').hidden, demoLabel: !document.querySelector('[data-week-demo]').hidden,
      signup: !document.querySelector('[data-signup]').hidden, map: !document.querySelector('#farm-map').hidden, mapDemo: !!document.querySelector('.map-demo'),
      items: document.querySelectorAll('#farm-map .map-item').length, press: document.querySelectorAll('.press-list a').length, drive: document.querySelectorAll('.drive-list li').length }));
    ok('index: countdown, week box (labelled example), signup demo, real map, press, drive', s.rel && s.week && s.demoLabel && s.signup && s.map && !s.mapDemo && s.items === 25 && s.press === 2 && s.drive === 6, JSON.stringify(s));
    const skin = await t.f.evaluate(() => ({ margin: getComputedStyle(document.body).margin, sticky: getComputedStyle(document.querySelector('.site-header')).position }));
    ok('index: shown inside the Artifact tool\'s own page, and the top bar stays on top (sticky)', skin.margin === '0px' && skin.sticky === 'sticky', JSON.stringify(skin));
    const photos = await t.f.evaluate(async () => { const imgs = [...document.images].filter((i) => /assets\/photos\//.test(i.getAttribute('src') || '')); imgs.forEach((i) => { i.loading = 'eager'; }); await Promise.all(imgs.map((i) => (i.decode ? i.decode().catch(() => {}) : 0))); return { n: imgs.length, bad: imgs.filter((i) => !i.naturalWidth).length }; });
    ok('index: the photos load from the published files (' + photos.n + ' on the page)', photos.n > 0 && photos.bad === 0, JSON.stringify(photos));
    await t.f.locator('#farm-map').scrollIntoViewIfNeeded().catch(() => {});
    await shot(t.page, 'home-map');
    await t.page.close();
  }
  {
    const t = await w.open('first-visit.html', { time: TODAY });
    const s = await t.f.evaluate(() => ({ map: !document.querySelector('#farm-map').hidden, comfort: !!document.querySelector('#comfort'), drive: document.querySelectorAll('.drive-list li').length, driveText: document.querySelector('.dr-time').textContent }));
    ok('first-visit: demo map, comfort, drive times', s.map && s.comfort && s.drive === 6 && /about 10 min/.test(s.driveText), JSON.stringify(s));
    await t.page.close();
  }
  {   // the way a visitor moves around the preview: a link from one page file to another, inside the frame
    const t = await w.open('index.html');
    const l = t.f.locator('a[href="first-visit.html"]').first();
    await l.scrollIntoViewIfNeeded().catch(() => {});
    ok('index: a link to first-visit.html opens that page inside the frame', await w.go(t, l, 'first-visit.html'));
    const back = t.f.locator('.site-header a[href^="index.html"]').first();
    ok('first-visit: the header has a link back to index.html', (await back.count()) > 0);
    if ((await back.count()) > 0) ok('first-visit: that link goes back to the home page inside the frame', await w.go(t, back, 'index.html'));
    await t.page.close();
  }
  ok('home: every file the pages asked for was published', w.log.missing.length === 0, w.log.missing.join(', '));
  await w.close();
};

sections.flags = async ({ browser }) => {
  const w = await world(browser, { label: 'flags' });
  for (const name of PAGES) {
    const t = await w.open(name);
    const s = await t.f.evaluate(() => ({ demo: window.WA_DEMO, tour: window.WA_TOUR, inline: window.WA_TOUR_INLINE,
      demoMode: typeof window.WA_DEMO_MODE === 'function' ? window.WA_DEMO_MODE() : 'none', tourMode: typeof window.WA_TOUR_MODE === 'function' ? window.WA_TOUR_MODE() : 'none' }));
    const nSign = await signIn(t.f).count(), nTour = await tourPill(t.f).count(), nTourAny = await tourAny(t.f).count();
    const pics = await t.f.evaluate(async () => { const list = [...document.images].filter((i) => /^assets\//.test(i.getAttribute('src') || '')); list.forEach((i) => { i.loading = 'eager'; }); await Promise.all(list.map((i) => (i.decode ? i.decode().catch(() => {}) : 0))); return { n: list.length, bad: list.filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src')) }; });
    if (pics.n) ok(name + ': every picture it shows loads from the published files (' + pics.n + ')', pics.bad.length === 0, pics.bad.slice(0, 3).join(', '));
    if (FLAGS) {
      ok(name + ': WA_DEMO, WA_TOUR and WA_TOUR_INLINE are true', s.demo === true && s.tour === true && s.inline === true, JSON.stringify(s));
      if (s.demoMode !== 'none') ok(name + ': demo mode is on', s.demoMode === true, String(s.demoMode));
      if (s.tourMode !== 'none') ok(name + ': tour mode is on', s.tourMode === true, String(s.tourMode));
      if (HAVE_HEADER) ok(name + ': the "Sign in" button is in the top bar and visible', nSign > 0 && await signIn(t.f).first().isVisible(), nSign + ' found');
      else info(name + ': js/demo-header.js is not in the site yet: the Sign in button is not checked');
      if (HAVE_TOUR) ok(name + ': the "Take a tour" pill is visible', nTour > 0 && await tourPill(t.f).first().isVisible(), nTour + ' found');
      if (HAVE_TOUR && HAVE_HEADER && DEMO_PAGES.includes(name)) ok(name + ': the demo bar has its own "Take a tour" link', (await t.f.getByRole('link', { name: /take a tour/i }).count()) > 0);
      else info(name + ': js/tour.js is not in the site yet: the tour button is not checked');
    } else {
      ok(name + ': no WA_DEMO / WA_TOUR flag', s.demo === undefined && s.tour === undefined && s.inline === undefined, JSON.stringify(s));
      if (s.demoMode !== 'none') ok(name + ': demo mode is off', s.demoMode === false, String(s.demoMode));
      if (s.tourMode !== 'none') ok(name + ': tour mode is off', s.tourMode === false, String(s.tourMode));
      ok(name + ': no "Sign in" button and no "Take a tour" button or link anywhere', nSign === 0 && nTourAny === 0, 'sign-in ' + nSign + ', tour ' + nTourAny);
      const extra = await t.f.evaluate(() => ({ bar: !!document.querySelector('.demo-bar,[data-tour="demo-bar"]'), tourBox: !!document.querySelector('.wa-tour,.wa-tour-pill'), mark: document.documentElement.hasAttribute('data-demo') || document.documentElement.classList.contains('wa-demo') }));
      ok(name + ': no demo bar, no tour box, no demo mark on the page', !extra.bar && !extra.tourBox && !extra.mark, JSON.stringify(extra));
      if (DEMO_PAGES.includes(name)) {
        const g = await t.f.evaluate(() => { const gd = document.getElementById('demo-guard'), app = document.querySelector('[data-demo-app]'); const vis = (e) => !!e && e.getClientRects().length > 0; return { guard: vis(gd), text: gd ? gd.textContent.replace(/\s+/g, ' ').trim() : '', app: vis(app) }; });
        ok(name + ': only the polite box shows ("This is a demo page. It is not open to visitors.")', g.guard && !g.app && /not open to visitors/i.test(g.text), JSON.stringify(g));
      }
    }
    await t.page.close();
  }
  ok('flags: every file the pages asked for was published', w.log.missing.length === 0, w.log.missing.join(', '));
  ok('flags: no page asked for a css/ or js/ file (everything is inline)', !w.log.requests.some((p) => /^(?:js|css)\//.test(p)), w.log.requests.filter((p) => /^(?:js|css)\//.test(p)).join(', '));
  await w.close();
};

sections.flow = async ({ browser }) => {
  if (!FLAGS || !HAVE_DEMO) { info('flow: skipped (needs a build with the flags and the three demo pages: ' + DEMO_PAGES.join(', ') + ')'); return; }
  const w = await world(browser, { label: 'flow' });
  const EMAIL = 'preview-test@example.com';
  // tab 1: the family page. Nothing exists yet.
  const fam = await w.open('account.html');
  ok('account.html: starts with no account in this browser', await store(fam.f, 'return S.current() === null'));
  ok('account.html: the page is the family screen (the guard box is hidden)', await fam.f.evaluate(() => { const g = document.getElementById('demo-guard'); return !g || g.getClientRects().length === 0; }));
  await shot(fam.page, 'family-signed-out');
  ok('account.html: an account can be created (the sample family loads)', await store(fam.f, 'return !!S.createAccount({ name: "Preview Test", email: "' + EMAIL + '" })'));
  const visit = await store(fam.f, 'const v = S.list("visits")[0]; return v ? { id: v.id, date: v.date, time: v.time, package: v.package } : null');
  ok('account.html: the sample visit is there', !!visit, JSON.stringify(visit));
  ok('account.html: the top bar button now says "My account"', await okSoon('the button says My account', async () => (await signIn(fam.f).first().getAttribute('aria-label')) || '', (t) => /my account/i.test(t), 8000));
  // tab 2: the desk, opened BEFORE the request exists
  const desk = await w.open('farm-desk.html');
  const cards = () => shown(desk.f, '[data-tour="desk-card"]');
  const before = await cards();
  info('farm-desk.html: ' + before + ' waiting card(s) before the request');
  // the request, made on the family page: with the page's own button when it is there, else through the store
  let made = false;
  const askBtn = fam.f.getByRole('button', { name: /request a different day/i }).first();
  if (await askBtn.count()) {
    await askBtn.click().catch(() => {});
    const send = fam.f.getByRole('button', { name: /^send/i }).first();
    if (await send.count()) {
      const radio = fam.f.locator('[role=dialog] input[type=radio], form input[type=radio]').first();
      if (await radio.count()) await radio.check().catch(() => {});
      await send.click().catch(() => {});
    }
    made = await okSoon('the family page\'s own "Request a different day" form sent a request', () => store(fam.f, 'return S.openRequests("cathy").length'), (n) => n >= 1, 6000);
  } else info('account.html: no "Request a different day" button on the page yet: the request is made through the store');
  if (!made) ok('account.html: a request to Mrs. Cathy can be sent (through the store)', await store(fam.f, 'const v = S.list("visits")[0]; const days = S.openDays(S.today(), v.package || "farm", 3); const d = (days && days[days.length - 1]) || v.date; return !!S.ask({ kind: "visit-change", to: "cathy", target: { coll: "visits", id: v.id }, patch: { date: d }, from: "family", summary: "Move my visit (preview test)" })'));
  const reqId = await store(fam.f, 'const r = S.openRequests("cathy")[0]; return r ? r.id : null');
  ok('account.html: the request is waiting for Mrs. Cathy', !!reqId, String(reqId));
  const famUI = (await fam.f.locator('[data-tour="acct-visit-card"], [data-tour="acct-request-day"], [data-tour="acct-request-status"]').count()) > 0;   // the real My visits screen (not the plain list)
  if (famUI) await okSoon('account.html: the screen says it is waiting for a reply from Mrs. Cathy', () => fam.f.evaluate(() => { const e = document.querySelector('[data-tour="acct-request-status"]'); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; }), (t) => /waiting for a reply from mrs\. cathy/i.test(t), 8000);
  else info('account.html: the My visits screen is only a plain list so far (no visit card): what it says about the request is not checked');
  await shot(fam.page, 'family-waiting');
  // the other tab hears about it by itself (the storage event), no reload
  await okSoon('farm-desk.html (already open in another tab) shows the new request by itself: the storage event reaches it', cards, (n) => n === before + 1, 10000);
  await shot(desk.page, 'desk-waiting');
  const yesButtons = () => shown(desk.f, '[data-tour="desk-yes"]');
  const yesBefore = await yesButtons();
  ok('farm-desk.html: the new request has its Yes button', yesBefore >= 1, String(yesBefore));
  // a fresh load of the desk shows it too
  const desk2 = await w.open('farm-desk.html');
  ok('farm-desk.html opened fresh: the request is on the desk', (await shown(desk2.f, '[data-tour="desk-card"]')) >= 1);
  ok('farm-desk.html: the waiting count is shown', (await desk2.f.locator('[data-tour="desk-waiting"]').count()) > 0);
  await desk2.page.close();
  // the desk answers (the way the tour does: through the store); the family tab changes by itself
  ok('farm-desk.html: Mrs. Cathy can say yes', await store(desk.f, 'return !!S.reply("' + reqId + '", { answer: "yes", note: "See you then (preview test)" })'));
  if (famUI) await okSoon('account.html (open in the first tab) no longer says it is waiting, by itself', () => fam.f.evaluate(() => { const e = document.querySelector('[data-tour="acct-request-status"]'); return e ? e.textContent.replace(/\s+/g, ' ').trim() : 'gone'; }), (t) => !/waiting for a reply/i.test(t), 10000);
  const moved = await store(fam.f, 'const v = S.get("visits", "' + visit.id + '"); return v && v.date');
  ok('account.html: the visit moved to the day she agreed to', !!moved && moved !== visit.date, visit.date + ' -> ' + moved);
  await okSoon('farm-desk.html: the answered request no longer offers Yes / No (the card stays and shows what was sent)', yesButtons, (n) => n === yesBefore - 1, 10000);
  // the demo bar moves between the three pages inside the frame, and the pretend account goes along
  const bar = (f, re) => f.locator('.demo-switch-link, [data-tour="demo-switch"] a').filter({ hasText: re }).first();
  ok('account.html: the demo bar has the links Family, Mrs. Cathy\'s desk and Kitchen', (await bar(fam.f, /family/i).count()) > 0 && (await bar(fam.f, /desk/i).count()) > 0 && (await bar(fam.f, /kitchen/i).count()) > 0);
  ok('account.html: the demo bar link opens the kitchen', await w.go(fam, bar(fam.f, /kitchen/i), 'kitchen.html'));
  ok('kitchen.html: the pretend account came along (the orders of the sample family are here)', await store(fam.f, 'return !!S.current() && S.list("orders").length > 0'));
  await okSoon('kitchen.html: the kitchen queue shows an order', () => shown(fam.f, '[data-tour="kit-card"]'), (n) => n >= 1, 10000);
  await shot(fam.page, 'kitchen');
  ok('kitchen.html: the demo bar link opens the desk', await w.go(fam, bar(fam.f, /desk/i), 'farm-desk.html'));
  ok('farm-desk.html: the signed-in family is still the same one', await store(fam.f, 'const a = S.current(); return !!a && a.email === "' + EMAIL + '"'));
  ok('farm-desk.html: the demo bar link opens the family page', await w.go(fam, bar(fam.f, /family/i), 'account.html'));
  // Start over, from the demo bar: a plain box asks, then everything is empty in every tab
  const reset = fam.f.locator('[data-tour="demo-reset"]').first();
  if (await reset.count()) {
    await reset.click();
    const yes = fam.f.getByRole('button', { name: /yes/i }).first();
    await yes.waitFor({ state: 'visible', timeout: ms(8000) }).catch(() => {});
    ok('account.html: "Start over" asks first, with a box of the page (not confirm())', (await yes.count()) > 0);
    if ((await yes.count()) > 0) {
      await yes.click();
      await okSoon('account.html: after "Start over" there is no account', () => store(fam.f, 'return S.current() === null && S.list("visits").length === 0'), (v) => v === true, 8000);
      await okSoon('farm-desk.html (the other tab): after "Start over" the desk is empty by itself', cards, (n) => n === 0, 10000);
    }
  } else info('account.html: no "Start over" button on the page yet');
  ok('flow: every file the pages asked for was published', w.log.missing.length === 0, w.log.missing.join(', '));
  ok('flow: no page asked for a css/ or js/ file (everything is inline)', !w.log.requests.some((p) => /^(?:js|css)\//.test(p)), w.log.requests.filter((p) => /^(?:js|css)\//.test(p)).join(', '));
  await w.close();
};

sections.tour = async ({ browser }) => {
  if (!FLAGS || !HAVE_TOUR) { info('tour: skipped (needs a build with the flags and js/tour.js)'); return; }
  const w = await world(browser, { label: 'tour' });
  const t = await w.open('index.html');
  const card = () => t.f.locator('.wa-tour-card, [role=dialog]').first();
  await tourPill(t.f).first().click();
  await card().waitFor({ state: 'visible', timeout: ms(15000) }).catch(() => {});
  ok('tour: the pill opens the welcome card (it never starts by itself)', await card().isVisible().catch(() => false));
  const start = t.f.getByRole('button', { name: /^start the tour$/i });
  ok('tour: the welcome card has "Start the tour"', (await start.count()) > 0);
  await shot(t.page, 'tour-welcome');
  const pagesSeen = new Set(), titles = [];
  let steps = 0, finished = false, last = '', stuck = false;
  const look = async () => {                // what the card shows now (null while the frame is moving to another page)
    try {
      return await t.f.evaluate(() => {
        const vis = (e) => e && e.getClientRects().length > 0 && !e.disabled;
        const b = [...document.querySelectorAll('.wa-tour-card button, [role=dialog] button')].filter(vis).map((x) => x.textContent.trim());
        const prog = document.querySelector('.wa-tour-progress'), title = document.querySelector('.wa-tour-title');
        return { buttons: b, progress: prog ? prog.textContent.trim() : '', title: title ? title.textContent.trim() : '', page: location.pathname.split('/').pop() || 'index.html' };
      });
    } catch (e) { return null; }
  };
  const keyOf = (n) => n.page + '|' + n.progress + '|' + n.title;
  const cardWithButton = async () => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms(20000)) { const n = await look(); if (n && (n.buttons.includes('Next') || n.buttons.includes('Finish'))) return n; await new Promise((r) => setTimeout(r, 120)); }
    return null;
  };
  if ((await start.count()) > 0) {
    await start.click();
    let prevKey = '', same = 0;
    for (; steps < 220; steps++) {
      const n = await cardWithButton();
      if (!n) { ok('tour: card ' + (steps + 1) + ' (after: ' + last + ') shows a Next or Finish button', false, 'the card did not come back in 20 s'); break; }
      const key = keyOf(n);
      same = key === prevKey ? same + 1 : 0; prevKey = key;
      if (same >= 3) { stuck = true; break; }
      last = n.progress + ' ' + n.title; pagesSeen.add(n.page); if (!same) titles.push(n.title);
      if (n.buttons.includes('Finish') && !n.buttons.includes('Next')) {
        finished = true;
        await shot(t.page, 'tour-last');
        await t.f.getByRole('button', { name: /^finish$/i }).click();
        break;
      }
      await t.f.getByRole('button', { name: /^next$/i }).first().click().catch(() => {});
      const t0 = Date.now();                // wait until the card is another one (or the frame has moved), so one click is one step
      while (Date.now() - t0 < ms(8000)) { const m = await look(); if (m && keyOf(m) !== key) break; await new Promise((r) => setTimeout(r, 100)); }
    }
  }
  if (stuck) ok('tour: Next always moves on (no card is stuck)', false, 'stuck at: ' + last);
  info('tour: ' + (steps + 1) + ' cards seen, on pages: ' + [...pagesSeen].join(', '));
  ok('tour: Next goes all the way to the last card and Finish closes it', finished, 'stopped at: ' + last);
  ok('tour: more than 20 cards', titles.length > 20 || !finished, String(titles.length));
  const needDemo = HAVE_DEMO && INFO.js_inlined.includes('js/tour-steps-c.js');     // chapter 10 (the account demo) is in js/tour-steps-c.js
  ok('tour: the pages the tour walked through include the home page' + (needDemo ? ' and the three demo pages' : ''), pagesSeen.has('index.html') && (!needDemo || DEMO_PAGES.every((p) => pagesSeen.has(p))), [...pagesSeen].join(', '));
  if (!needDemo) info('tour: js/tour-steps-c.js (the account demo chapter) is not in this build: the trips to the demo pages are not checked');
  ok('tour: every file the pages asked for was published', w.log.missing.length === 0, w.log.missing.join(', '));
  ok('tour: no page asked for a css/ or js/ file (the tour css and steps are inline)', !w.log.requests.some((p) => /^(?:js|css)\//.test(p)), w.log.requests.filter((p) => /^(?:js|css)\//.test(p)).join(', '));
  await w.close();
};

sections.blocked = async ({ browser }) => {
  const w = await world(browser, { label: 'blocked', sandbox: SANDBOX_STRICT });
  const first = await w.open('index.html', { time: TODAY });
  ok('blocked: the frame has no address of its own (window.origin is "null"), so the browser refuses its storage', (await first.f.evaluate(() => window.origin)) === 'null');
  ok('blocked: the build\'s stand-in took over for localStorage and sessionStorage', (await first.f.evaluate(() => window.WA_PREVIEW_STORAGE_FALLBACK)) === 'localStorage,sessionStorage');
  await first.f.evaluate(() => { window.localStorage.setItem('wa-probe-x', '42'); });
  ok('blocked: a bare  localStorage  and  sessionStorage  (not only window.localStorage) work too, and keep what they are given', await first.f.evaluate(() => { localStorage.setItem('a', '1'); sessionStorage.setItem('b', '2'); return localStorage.getItem('a') === '1' && sessionStorage.getItem('b') === '2' && localStorage.getItem('wa-probe-x') === '42' && localStorage.length === 2 && localStorage.key(0) === 'wa-probe-x'; }));
  ok('blocked: the home page works without storage (countdown shows)', await first.f.evaluate(() => !document.querySelector('[data-rel-box]').hidden));
  await first.page.close();
  for (const name of PAGES.filter((p) => p !== 'index.html')) {
    const t = await w.open(name);
    await t.page.close();
  }
  ok('blocked: all ' + PAGES.length + ' pages load in a frame that refuses storage, without a page error (checked at the end)', true);
  if (FLAGS && HAVE_DEMO) {
    const fam = await w.open('account.html');
    ok('blocked: an account can be created', await store(fam.f, 'return !!S.createAccount({ name: "Preview Test", email: "blocked@example.com" })'));
    const bar = (f, re) => f.locator('.demo-switch-link, [data-tour="demo-switch"] a').filter({ hasText: re }).first();
    ok('blocked: the demo bar opens the kitchen in the same frame', await w.go(fam, bar(fam.f, /kitchen/i), 'kitchen.html'));
    ok('blocked: the account came along to the next page (it travels in window.name)', await store(fam.f, 'const a = S.current(); return !!a && a.email === "blocked@example.com" && S.list("orders").length > 0'));
    ok('blocked: the demo bar opens the desk and the account is still there', await w.go(fam, bar(fam.f, /desk/i), 'farm-desk.html') && await store(fam.f, 'return !!S.current()'));
    await fam.page.close();
  }
  ok('blocked: every file the pages asked for was published', w.log.missing.length === 0, w.log.missing.join(', '));
  await w.close();
};

/* ------------------------------------------------------------------ run ------------------------------------------------------------------------- */
let browser = null;
try {
  console.log('preview folder: ' + DIR + '  (' + INFO.commit + '; flags ' + (FLAGS ? 'ON' : 'OFF') + '; pages: ' + PAGES.join(', ') + ')');
  for (const name of Object.keys(sections)) {
    if (!want(name)) continue;
    if (QUICK && name === 'tour') continue;
    console.log('\n== ' + name);
    try {
      if (name !== 'static' && !browser) browser = await launch();
      await sections[name]({ browser });
    } catch (e) { ok(name + ': the section ran to the end', false, String(e && e.stack ? e.stack.split('\n').slice(0, 3).join(' / ') : e)); }
  }
} finally {
  await finish({ browser, errs });
}
