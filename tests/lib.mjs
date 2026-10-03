/* Shared helpers for the site tests (see tests/README).
 *
 *   - a small static web server on a free port (no fixed port, nothing to start by hand)
 *   - Playwright (and axe-core) found in the project, or in the global npm folder
 *   - PASS / FAIL lines, "wait until" helpers (tests wait for conditions, never for a fixed time), a summary
 *
 * Environment variables (all optional):
 *   WA_URL     test a site that is already running, e.g. WA_URL=http://localhost:8000/  (no server is started)
 *   WA_PORT    port for the built-in server (default: any free port)
 *   WA_CHROME  path to a Chrome/Chromium program (default: the one Playwright installed)
 *   WA_SLOW    multiplier for every time limit, e.g. WA_SLOW=3 on a very busy computer (default 1)
 *   WA_DATE    the moment every page believes it is "now", e.g. WA_DATE=2026-12-15T12:00:00-05:00 (default: TODAY below)
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const SLOW = Math.max(1, Number(process.env.WA_SLOW) || 1);
export const ms = (n) => Math.round(n * SLOW);   // a time limit, scaled by WA_SLOW

/* ------------------------------------------------------------------ *
 * Static server
 * ------------------------------------------------------------------ */
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

/** Serves the site folder on 127.0.0.1. Returns { url, port, close() }. */
export function startServer({ root = ROOT, port = Number(process.env.WA_PORT) || 0 } = {}) {
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      let pathname;
      try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400); res.end('Bad request'); return; }
      let file = path.join(root, pathname);
      if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end('Forbidden'); return; }
      try { if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html'); } catch (e) { /* not found, below */ }
      fs.readFile(file, (err, body) => {
        if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(req.method === 'HEAD' ? undefined : body);
      });
    });
    srv.keepAliveTimeout = 120000; srv.headersTimeout = 125000;   // never close an idle connection just as the browser reuses it (a "socket hang up" on a busy computer)
    srv.on('error', (e) => reject(new Error('Could not start the test server' + (port ? ' on port ' + port : '') + ': ' + e.message)));
    srv.listen(port, '127.0.0.1', () => {
      const p = srv.address().port;
      resolve({ url: `http://127.0.0.1:${p}/`, port: p, close: () => new Promise((r) => { srv.closeAllConnections && srv.closeAllConnections(); srv.close(() => r()); }) });
    });
  });
}

/** The address of the site under test: WA_URL, or a fresh built-in server. */
export async function startSite() {
  if (process.env.WA_URL) return { url: process.env.WA_URL.replace(/\/?$/, '/'), close: async () => {} };
  return startServer();
}

/* ------------------------------------------------------------------ *
 * Finding Playwright and axe-core
 * ------------------------------------------------------------------ */
function globalRoot() {
  try { return execFileSync('npm', ['root', '-g'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (e) { return ''; }
}

export async function loadPlaywright() {
  try { return await import('playwright'); } catch (e) { /* not in the project: try the global folder */ }
  const g = globalRoot();
  for (const dir of [process.env.PLAYWRIGHT_PATH, g && path.join(g, 'playwright')].filter(Boolean)) {
    try { return await import(pathToFileURL(path.join(dir, 'index.mjs')).href); } catch (e) { /* next */ }
  }
  throw new Error('Playwright is not installed. In the tests folder run:  npm install   and then   npx playwright install chromium   (see tests/README)');
}

/** The text of axe.min.js (for the accessibility test), or null when axe-core is not installed. */
export function axeSource() {
  const tries = [() => require.resolve('axe-core/axe.min.js')];
  const g = globalRoot();
  if (g) tries.push(() => path.join(g, 'axe-core', 'axe.min.js'));
  if (process.env.AXE_PATH) tries.push(() => process.env.AXE_PATH);
  for (const t of tries) { try { const f = t(); if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8'); } catch (e) { /* next */ } }
  return null;
}

export async function launch() {
  const { chromium } = await loadPlaywright();
  const exe = process.env.WA_CHROME || undefined;
  try { return await chromium.launch({ executablePath: exe }); } catch (e) {
    throw new Error('Could not start Chromium (' + String(e.message).split('\n')[0] + '). Run  npx playwright install chromium  or set WA_CHROME to a Chrome program.');
  }
}

/* ------------------------------------------------------------------ *
 * Results
 * ------------------------------------------------------------------ */
let fails = 0, passes = 0;
export const stats = () => ({ fails, passes });

/* An error nobody caught (a Playwright call that failed inside an event handler) is reported as a failed check, so the run still ends with a summary. */
process.on('unhandledRejection', (e) => { fails++; console.log('FAIL unexpected error in the test  ' + String((e && e.message) || e).split('\n')[0]); });

/** Records one check. */
export function ok(name, condition, detail = '') {
  if (condition) passes++; else fails++;
  console.log((condition ? 'PASS ' : 'FAIL ') + name + (detail !== '' && detail != null ? '  ' + detail : ''));
  return !!condition;
}
export const info = (text) => console.log('     ' + text);

/** The test cannot run here (a tool is missing). Prints SKIP and ends with exit code 0; tests/run-all.mjs shows it as "skipped". */
export function skip(reason) {
  console.log('SKIP ' + reason);
  console.log('\n0 passed, 0 failed (skipped)');
  process.exit(0);
}

/** Waits (up to `limit` ms, scaled by WA_SLOW) until fn() in the page returns something truthy; returns that value, or false on time-out. */
export async function until(page, fn, arg, limit = 15000) {
  try { return await (await page.waitForFunction(fn, arg, { timeout: ms(limit), polling: 50 })).jsonValue(); } catch (e) { return false; }
}

/** Like ok(), but keeps asking `get()` (in Node) until `test(value)` is true or the time is up; the last value is shown when it fails. */
export async function okSoon(name, get, test, limit = 15000) {
  const end = Date.now() + ms(limit);
  let v, good = false;
  for (;;) {
    try { v = await get(); good = !!test(v); } catch (e) { v = 'error: ' + e.message; good = false; }
    if (good || Date.now() > end) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  return ok(name, good, good ? '' : (typeof v === 'string' ? v : JSON.stringify(v)));
}

/** Text of the first match, trimmed and with white space collapsed (null when there is none). */
export const txt = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent.trim().replace(/\s+/g, ' ') : null; }, sel);

/* ------------------------------------------------------------------ *
 * Pages
 * ------------------------------------------------------------------ */
// The moment every page believes it is "now" unless a test picks another one (time: '2026-11-04T10:00:00-05:00'; time: false = the real clock):
// Friday Oct 2 2026, noon in New York: fall, the farm's "Open now" line is still true. Pinned so that a test result does not depend on the day
// it is run on (seasons change, dated lines hide themselves, the yellow "Site check" box appears when something has expired).
export const TODAY = process.env.WA_DATE || '2026-10-02T12:00:00-04:00';
const NOISE = /fonts\.g|net::ERR|Failed to load resource|favicon/;

/**
 * Opens a page and waits until the site's scripts have finished starting (window.WISE_ACRES.features exists).
 *   base      address of the site (from startSite())
 *   errs      array that collects page errors
 *   opts: viewport, touch (true: a phone or tablet with a touch screen and no mouse: tap with page.touchscreen), locale, timezoneId, lang, time (a date string: the page clock starts there; default TODAY; false = the real clock), extra (JavaScript text appended to js/content.js),
 *         routes (async (page) => ... for extra page.route calls), query, ready (false: do not wait for the scripts)
 */
export async function open(browser, base, url, errs, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1440, height: 900 }, locale: opts.locale || 'en-US', timezoneId: opts.timezoneId || 'America/New_York', acceptDownloads: true, deviceScaleFactor: opts.deviceScaleFactor || 1, reducedMotion: opts.reducedMotion || 'no-preference', forcedColors: opts.forcedColors || 'none', hasTouch: !!opts.touch, isMobile: !!opts.touch });
  const p = await ctx.newPage();
  p.setDefaultTimeout(ms(20000));
  p.on('pageerror', (e) => errs.push(url + ' pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errs.push(url + ' console: ' + m.text()); });
  if (opts.extra) await p.route('**/js/content.js', async (r) => {
    try { const res = await fetchRetry(r); await r.fulfill({ response: res, body: (await res.text()) + '\n' + opts.extra }); }
    catch (e) { errs.push('could not read js/content.js to add the test settings: ' + String(e.message).split('\n')[0]); r.continue().catch(() => {}); }
  });
  if (opts.routes) await opts.routes(p);
  const when = opts.time === undefined ? TODAY : opts.time;
  if (when) await p.clock.install({ time: new Date(when) });
  const q = [opts.lang ? 'lang=' + opts.lang : '', opts.query || ''].filter(Boolean).join('&');
  await p.goto(base + url.replace(/^\//, '') + (q ? (url.includes('?') ? '&' : '?') + q : ''), { waitUntil: 'load', timeout: ms(60000) });
  if (opts.ready !== false) {
    const started = await until(p, () => !!(window.WISE_ACRES && window.WISE_ACRES.features), null, 30000);
    if (!started) errs.push(url + ': the site scripts did not finish starting (window.WISE_ACRES.features is missing)');
  }
  if (when && opts.ready !== false) await p.clock.runFor(1200);
  return p;
}

/** route.fetch() (the page's own request, sent by Playwright) with a second and third try: one dropped connection must not end the test. */
export async function fetchRetry(route, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await route.fetch(); } catch (e) { last = e; await new Promise((r) => setTimeout(r, 300 * (i + 1))); }
  }
  throw last;
}

/** Closes the browser and the server, prints the summary line and sets the exit code. */
export async function finish({ browser, site, errs = [] } = {}) {
  ok('no page errors', errs.length === 0, errs.slice(0, 5).join(' | '));
  try { if (browser) await browser.close(); } catch (e) { /* closing */ }
  try { if (site) await site.close(); } catch (e) { /* closing */ }
  console.log(`\n${passes} passed, ${fails} failed`);
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exitCode = fails ? 1 : 0;
}

/** Runs a test body; a thrown error is reported as one FAIL line (instead of a crash with no summary). */
export async function run(name, body) {
  let site, browser;
  const errs = [];
  try {
    site = await startSite();
    browser = await launch();
    await body({ browser, base: site.url, errs });
  } catch (e) {
    ok(name + ': the test ran to the end', false, String(e && e.stack ? e.stack.split('\n').slice(0, 3).join(' / ') : e));
  }
  await finish({ browser, site, errs });
}
