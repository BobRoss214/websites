#!/usr/bin/env node
/* A slow, old Android phone, simulated in Chromium: a 360 x 640 screen with touch, a processor slowed 4x or 6x, a slow line, a cold or a warm cache.
 * It measures what a visitor feels (first words, layout jumps, long freezes, when the buttons start to answer, files and bytes, memory, how smooth the
 * farm picture stays) and prints tables. It is a measuring tool, not a pass or fail test: seconds depend on the computer that runs it.
 * tests/slow-phone.test.mjs is the small, steady part that does fail. What the numbers were and what they mean: docs/SLOW_PHONE_TEST.md.
 *
 *   node tools/slow_phone.mjs                         the main table: home page, First visit, Pumpkin patch; English and Hindi; cold and warm
 *   node tools/slow_phone.mjs --mode cpu              main-thread CPU time of a page load, and what it would block on a 4x or 6x slower phone (steady, whatever else runs)
 *   node tools/slow_phone.mjs --mode ab --roots A,B   two or more copies of the site, in turns: the same numbers for each (add --cpu 4 for wall time on the slow phone)
 *   node tools/slow_phone.mjs --mode framecost        what one main-thread frame costs with the farm picture on screen, per season
 *                                                     (--calm off,all,auto: as it comes, "Pause animations" pressed, the page's own switch for a struggling phone)
 *   node tools/slow_phone.mjs --mode frames           frame times of a script that asks for a frame every 1/60 s, per season, 4x and 6x (noisy on a busy computer)
 *   node tools/slow_phone.mjs --mode scroll           frame times while a finger swipes the page up
 *   node tools/slow_phone.mjs --mode journey          scroll the whole page a screen at a time: pictures that load, layout shifts, long tasks
 *   node tools/slow_phone.mjs --mode motion           what a page nobody looks at costs: picture on screen, scrolled away, tab hidden, reduced motion (--seasons spring,fall)
 *   node tools/slow_phone.mjs --mode profile          which lines of the scripts cost the time (sampling profiler)
 *   node tools/slow_phone.mjs --mode trace            where the main thread spends its time while a page loads (per kind of work, per script)
 *   options: --root DIR (another copy of the site; default this folder)  --pages index.html,first-visit.html  --langs en,hi  --cpu 4,6  --net slow4g,fast3g
 *            --cache cold,warm  --runs 3  --json out.json  --help
 *
 * Needs Playwright with Chromium (as the tests do, see tests/README). No internet. Port: WA_PORT, or the first free one from 48800. openssl, when it is
 * installed, gives the built-in server HTTP/2 (the real host speaks it; with plain HTTP/1.1 a page of 21 files waits in lines of six): set WA_H1=1 to refuse that.
 *
 * About the numbers. The slow-downs are Chrome's own (Emulation.setCPUThrottlingRate, Network.emulateNetworkConditions). The lines are the ones Lighthouse
 * uses for a slow mobile line (mobileSlow4G in lantern/simulation/Constants.js): "Slow 4G" is 150 ms and 1.6 Mbit/s down, 0.75 up; "Fast 3G" is the same
 * speed counted the way Chrome DevTools counts: 562.5 ms for each request, 90% of the speed (1.47 down, 0.675 up). A computer that is busy with other work
 * makes every time longer and noisy: the table shows the middle of the runs and the best, and "machine" says how much slower than a free core this
 * computer was while it ran (a fixed loop, wall time over CPU time). Work counted in CPU time (cpu, ab, framecost, trace) does not depend on that.
 */
import http from 'node:http';
import http2 from 'node:http2';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { loadPlaywright, ROOT } from '../tests/lib.mjs';

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */
export const PHONE = { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'en-US', timezoneId: 'America/New_York' };
export const NETS = {
  none: { label: 'no limit', latency: 0, down: -1, up: -1 },
  slow4g: { label: 'Slow 4G', latency: 150, down: 204800, up: 93750 },          // 1.6 * 1024 kbit/s, 750 kbit/s, 150 ms
  fast3g: { label: 'Fast 3G', latency: 562.5, down: 184320, up: 84375 },        // x0.9 and x3.75 as Chrome DevTools counts
};

/* ------------------------------------------------------------------ *
 * A web server like the real host: brotli on text, the caching rules of _headers, revalidation for pages
 * ------------------------------------------------------------------ */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml' };
const TEXT = /\.(html|js|css|json|svg|webmanifest|txt|xml)$/;

function cacheRules(root) {
  const rules = [];
  try {
    let cur = null;
    for (const line of fs.readFileSync(path.join(root, '_headers'), 'utf8').split('\n')) {
      if (/^\S/.test(line) && !line.startsWith('#')) cur = { pattern: line.trim().replace(/\*$/, ''), cc: null };
      else if (cur && /^\s+Cache-Control:/i.test(line)) { cur.cc = line.split(/:\s*/).slice(1).join(': ').trim(); rules.push(cur); }
    }
  } catch (e) { /* no _headers */ }
  return rules;
}

/** A throwaway certificate for https://127.0.0.1 (the real host speaks HTTP/2; a plain http server would make a phone with 21 files wait in lines of six). null when openssl is not there. */
function throwawayCert() {
  let dir;
  try {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-slow-'));
    execFileSync('openssl', ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-keyout', path.join(dir, 'k.pem'), '-out', path.join(dir, 'c.pem'), '-days', '2', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'ignore' });
    const cert = fs.readFileSync(path.join(dir, 'c.pem'));
    const spki = crypto.createHash('sha256').update(new crypto.X509Certificate(cert).publicKey.export({ type: 'spki', format: 'der' })).digest('base64');
    return { key: fs.readFileSync(path.join(dir, 'k.pem')), cert, spki };
  } catch (e) { return null; } finally { try { if (dir) fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* ignore */ } }
}

export function startServer(root = ROOT, port = Number(process.env.WA_PORT) || 0, { h2 = process.env.WA_H1 ? false : true } = {}) {
  const rules = cacheRules(root);
  const cache = new Map();
  const log = { requests: 0 };
  const handler = (req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400); res.end(); return; }
    let file = path.join(root, pathname);
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    try { if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html'); } catch (e) { /* 404 below */ }
    let entry = cache.get(file);
    if (!entry) {
      let body;
      try { body = fs.readFileSync(file); } catch (e) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); return; }
      const ext = path.extname(file).toLowerCase();
      const br = TEXT.test(ext) ? zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }) : null;
      const rule = rules.filter((r) => pathname.startsWith(r.pattern)).sort((a, b) => b.pattern.length - a.pattern.length)[0];
      entry = { body, br, type: TYPES[ext] || 'application/octet-stream', etag: '"' + crypto.createHash('md5').update(body).digest('hex').slice(0, 16) + '"', cc: rule ? rule.cc : 'public, max-age=0, must-revalidate' };
      cache.set(file, entry);
    }
    log.requests++;
    const h = { 'Content-Type': entry.type, 'Cache-Control': entry.cc, ETag: entry.etag, Vary: 'Accept-Encoding' };
    if (req.headers['if-none-match'] === entry.etag) { res.writeHead(304, h); res.end(); return; }
    const useBr = entry.br && /\bbr\b/.test(req.headers['accept-encoding'] || '');
    if (useBr) h['Content-Encoding'] = 'br';
    const out = useBr ? entry.br : entry.body;
    h['Content-Length'] = out.length;
    res.writeHead(200, h);
    res.end(req.method === 'HEAD' ? undefined : out);
  };
  const tls = h2 ? throwawayCert() : null;
  const srv = tls ? http2.createSecureServer({ ...tls, allowHTTP1: true }, handler) : http.createServer(handler);
  const sockets = new Set();
  srv.on(tls ? 'session' : 'connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
  if (!tls) { srv.keepAliveTimeout = 120000; srv.headersTimeout = 125000; }
  // WA_PORT, or the first free port from 48800 up (never a port somebody else is using)
  const tryPorts = port ? [port] : Array.from({ length: 100 }, (_, i) => 48800 + i);
  const listen = (i, resolve, reject) => {
    const onError = (e) => { srv.off('listening', onListening); if (e.code === 'EADDRINUSE' && i + 1 < tryPorts.length) listen(i + 1, resolve, reject); else reject(e); };
    const onListening = () => { srv.off('error', onError); done(resolve); };
    srv.once('error', onError); srv.once('listening', onListening);
    srv.listen(tryPorts[i], '127.0.0.1');
  };
  const done = (resolve) => resolve({ url: `${tls ? 'https' : 'http'}://127.0.0.1:${srv.address().port}/`, protocol: tls ? 'h2' : 'http/1.1', spki: tls ? tls.spki : null, log, close: () => new Promise((r) => { sockets.forEach((s) => { try { s.destroy(); } catch (e) { /* closing */ } }); srv.close(() => r()); }) });
  return new Promise((resolve, reject) => listen(0, resolve, reject));
}

/* ------------------------------------------------------------------ *
 * What the page records about itself (runs before the page's own scripts)
 * ------------------------------------------------------------------ */
export const INIT = (lang, autoCalm = false) => `(() => {
  if (${autoCalm}) { try { Object.defineProperty(navigator, 'webdriver', { get: () => false }); } catch (e) {} }   // a browser run by a program never lets the page switch to calm mode by itself; this lets it
  try { if (${JSON.stringify(lang)} !== 'en') localStorage.setItem('wa.lang', ${JSON.stringify(lang)}); } catch (e) {}
  const m = window.__m = { lt: [], cls: 0, shifts: [], lcp: null, fcp: null, fp: null, ev: [], menuOk: null, seasonShown: null, ready: null, hero: null };
  const obs = (type, fn, extra) => { try { new PerformanceObserver((l) => l.getEntries().forEach(fn)).observe(Object.assign({ type, buffered: true }, extra || {})); } catch (e) {} };
  obs('paint', (e) => { if (e.name === 'first-contentful-paint') m.fcp = e.startTime; if (e.name === 'first-paint') m.fp = e.startTime; });
  obs('largest-contentful-paint', (e) => { m.lcp = { t: Math.round(e.startTime), size: e.size, what: e.element ? e.element.tagName.toLowerCase() + (e.element.id ? '#' + e.element.id : '') + (e.element.className && typeof e.element.className === 'string' ? '.' + e.element.className.split(' ')[0] : '') : (e.url || '').slice(-40) }; });
  obs('layout-shift', (e) => { if (!e.hadRecentInput) { m.cls += e.value; m.shifts.push([Math.round(e.startTime), +e.value.toFixed(4), (e.sources || []).map((s) => s.node ? (s.node.nodeName || '').toLowerCase() + (s.node.className && typeof s.node.className === 'string' ? '.' + s.node.className.split(' ')[0] : '') : '?').join(',')]); } });
  obs('longtask', (e) => m.lt.push([Math.round(e.startTime), Math.round(e.duration)]));
  obs('event', (e) => m.ev.push({ n: e.name, t: Math.round(e.startTime), d: e.duration, delay: Math.round(e.processingStart - e.startTime) }), { durationThreshold: 16 });
  try {
    new MutationObserver((recs) => { for (const r of recs) { const t = r.target;
      if (t.id === 'menu-toggle' && t.getAttribute('aria-expanded') === 'true' && m.menuOk == null) m.menuOk = performance.now();
      if (t.id === 'season-switch' && !t.hidden && m.seasonShown == null) m.seasonShown = performance.now(); } })
      .observe(document, { subtree: true, attributes: true, attributeFilter: ['aria-expanded', 'hidden'] });
  } catch (e) {}
  const iv = setInterval(() => { if (m.hero == null) { const f = document.getElementById('field'); if (f && f.firstElementChild) m.hero = performance.now(); } if (window.WISE_ACRES && window.WISE_ACRES.features) { if (m.ready == null) m.ready = performance.now(); if (m.hero != null || performance.now() - m.ready > 3000) clearInterval(iv); } }, 40);
})();`;

/* ------------------------------------------------------------------ *
 * One page load
 * ------------------------------------------------------------------ */
export const sleep = (n) => new Promise((r) => setTimeout(r, n));
export const med = (xs) => { const s = xs.filter((x) => x != null && !Number.isNaN(x)).sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const best = (xs) => { const s = xs.filter((x) => x != null && !Number.isNaN(x)); return s.length ? Math.min(...s) : null; };

export async function metrics(cdp) { return Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value])); }

/** How much slower than a free core this computer is right now: wall time / CPU time of a fixed loop. 1 = free, 3 = busy. */
export async function machineFactor(ctx) {
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p); await cdp.send('Performance.enable');
  const f = [];
  for (let i = 0; i < 3; i++) {
    const a = await metrics(cdp);
    const wall = await p.evaluate(() => { const t = performance.now(); let x = 0; for (let i = 0; i < 2e7; i++) x += i % 7; return performance.now() - t; });
    const c = await metrics(cdp);
    f.push(wall / Math.max(1, (c.ThreadTime - a.ThreadTime) * 1000));
  }
  await p.close();
  return med(f);
}

/** Taps with a finger: pointer events with the touch type, like a phone. */
export async function tap(page, x, y) { await page.touchscreen.tap(x, y); }
/** One flick of a finger, upwards by dy px (the page moves up), the way tests/touch.test.mjs does it: touch start, 16 ms steps, touch end. */
export async function swipe(cdp, dy, steps = 20, x = 180, y0 = 590) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0, id: 1 }] });
  for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 - dy * i / steps, id: 1 }] }); await sleep(16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
export const centre = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width && r.height ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; }, sel);

export async function loadOnce(ctx, base, file, { lang = 'en', cpu = 4, net = 'slow4g', settle = 2500, limit = 120000, interact = true, trace = false, errs = null } = {}) {
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  if (errs) { page.on('pageerror', (e) => errs.push(file + ' pageerror: ' + e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR|Failed to load resource|favicon/.test(m.text())) errs.push(file + ' console: ' + m.text()); }); }
  const reqs = new Map();
  cdp.on('Network.requestWillBeSent', (e) => { if (!/^data:/.test(e.request.url)) reqs.set(e.requestId, { url: e.request.url.replace(base, ''), type: e.type, enc: 0, dec: 0, status: 0, cache: false }); });
  cdp.on('Network.responseReceived', (e) => { const r = reqs.get(e.requestId); if (r) { r.status = e.response.status; r.cache = !!(e.response.fromDiskCache || e.response.fromPrefetchCache); } });
  cdp.on('Network.dataReceived', (e) => { const r = reqs.get(e.requestId); if (r) r.dec += e.dataLength; });
  cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) r.enc = e.encodedDataLength; });
  await cdp.send('Network.enable');
  await cdp.send('Performance.enable');
  await page.addInitScript(INIT(lang));
  const n = NETS[net];
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: n.latency, downloadThroughput: n.down, uploadThroughput: n.up });
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  const events = [];
  if (trace) {
    cdp.on('Tracing.dataCollected', (e) => events.push(...e.value));
    await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline,v8,blink.user_timing,loading' + (process.env.WA_TRACE_EXTRA ? ',' + process.env.WA_TRACE_EXTRA : ''), transferMode: 'ReportEvents' });
  }
  const t0 = Date.now();
  const nav = page.goto(base + file, { waitUntil: 'load', timeout: limit }).catch((e) => ({ error: String(e.message).split('\n')[0] }));
  // While it loads: tap the menu button every 250 ms; the first tap that opens the menu is "the buttons answer"
  let menuTapped = 0, closed = false;
  const end = Date.now() + limit;
  let state = 'loading';
  nav.then(() => { state = 'loaded'; });
  while (Date.now() < end && state === 'loading') {
    await sleep(250);
    try {
      const c = await centre(page, '#menu-toggle');
      const open = await page.evaluate(() => window.__m && window.__m.menuOk != null);
      if (open) break;
      if (c) { await tap(page, c.x, c.y); menuTapped++; }
    } catch (e) { /* the page is being replaced or is busy */ }
  }
  const navRes = await nav;
  if (navRes && navRes.error) { await page.close(); return { error: navRes.error }; }
  // keep tapping until the menu opens (up to 30 s after load), then close it again
  const tEnd = Date.now() + 30000;
  for (;;) {
    let ok = false;
    try { ok = await page.evaluate(() => window.__m.menuOk != null); } catch (e) { /* busy */ }
    if (ok || Date.now() > tEnd) break;
    try { const c = await centre(page, '#menu-toggle'); if (c) { await tap(page, c.x, c.y); menuTapped++; } } catch (e) { /* busy */ }
    await sleep(250);
  }
  try {
    if (await page.evaluate(() => document.querySelector('#menu-toggle') && document.querySelector('#menu-toggle').getAttribute('aria-expanded') === 'true')) {
      const c = await centre(page, '#menu-toggle'); if (c) { await tap(page, c.x, c.y); closed = true; }
    }
  } catch (e) { /* ignore */ }
  // the scripts have all started, then a quiet moment
  await page.waitForFunction(() => window.__m && window.__m.ready != null, null, { timeout: 60000, polling: 100 }).catch(() => {});
  await sleep(settle);
  const nowT = Date.now() - t0;
  const m = await page.evaluate(() => {
    const nv = performance.getEntriesByType('navigation')[0];
    return Object.assign({}, window.__m, { dcl: nv.domContentLoadedEventEnd, load: nv.loadEventEnd, ttfb: nv.responseStart, now: performance.now(), hidden: document.hidden, season: (document.querySelector('#top') || {}).className, fonts: performance.getEntriesByType('resource').filter((e) => /woff2$/.test(e.name)).map((e) => [e.name.split('/').pop(), e.initiatorType, Math.round(e.startTime)]) });
  });
  let tr = null;
  if (trace) {   // the trace covers the load and the quiet time after it, not the memory reading and the taps below
    await new Promise((res) => { cdp.once('Tracing.tracingComplete', res); cdp.send('Tracing.end'); });
    tr = events;
  }
  let heap = null;
  try { await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.collectGarbage'); } catch (e) { /* ignore */ }
  const pm = await metrics(cdp);
  heap = { used: pm.JSHeapUsedSize, total: pm.JSHeapTotalSize, nodes: pm.Nodes, listeners: pm.JSEventListeners, layouts: pm.LayoutCount, recalcs: pm.RecalcStyleCount, script: pm.ScriptDuration, layoutMs: pm.LayoutDuration * 1000, styleMs: pm.RecalcStyleDuration * 1000, task: pm.TaskDuration, cpu: pm.ThreadTime };
  // buttons, once the page is quiet: a tap on the menu and on a season button, measured by the browser's own Event Timing
  let taps = null;
  if (interact) {
    const tI = await page.evaluate(() => performance.now());
    try {
      let c = await centre(page, '#menu-toggle'); if (c) { await tap(page, c.x, c.y); await sleep(700); c = await centre(page, '#menu-toggle'); if (c) { await tap(page, c.x, c.y); await sleep(700); } }
      const s = await page.evaluate(() => { const b = document.querySelector('#season-switch button[data-season="winter"]'); if (!b || b.closest('[hidden]')) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      if (s) { await tap(page, s.x, s.y); await sleep(1500); }
    } catch (e) { /* ignore */ }
    await sleep(300);
    const ev = await page.evaluate((k) => window.__m.ev.filter((e) => e.t >= k), tI);
    taps = { worst: ev.length ? Math.max(...ev.map((e) => e.d)) : 0, delay: ev.length ? Math.max(...ev.map((e) => e.delay)) : 0, n: ev.length };
  }
  await page.close();
  const list = [...reqs.values()].filter((r) => r.status);
  const sum = (f) => list.reduce((a, r) => a + f(r), 0);
  const by = {};
  list.forEach((r) => { const k = r.type; (by[k] = by[k] || { n: 0, enc: 0 }); by[k].n++; by[k].enc += r.enc; });
  const lt = m.lt;
  const fcp = m.fcp == null ? 0 : m.fcp;
  const tbt = lt.filter((x) => x[0] + x[1] > fcp).reduce((a, x) => a + Math.max(0, x[1] - 50), 0);
  return {
    fcp: m.fcp, lcp: m.lcp && m.lcp.t, lcpWhat: m.lcp && m.lcp.what, cls: +m.cls.toFixed(4), shifts: m.shifts, dcl: m.dcl, load: m.load,
    longTasks: lt.length, longMs: lt.reduce((a, x) => a + x[1], 0), tbt, longest: lt.length ? Math.max(...lt.map((x) => x[1])) : 0,
    menuOk: m.menuOk, seasonShown: m.seasonShown, ready: m.ready, hero: m.hero, taps, fonts: m.fonts,
    reqs: list.length, cached: list.filter((r) => r.cache || r.enc === 0).length, enc: sum((r) => r.enc), dec: sum((r) => r.dec), by, files: list.map((r) => [r.url, r.type, r.enc, r.dec, r.status]),
    heapMB: heap.used / 1048576, heapTotalMB: heap.total / 1048576, nodes: heap.nodes, listeners: heap.listeners, layouts: heap.layouts, recalcs: heap.recalcs, scriptMs: heap.script * 1000, layoutMs: heap.layoutMs, styleMs: heap.styleMs,
    wall: nowT, menuTaps: menuTapped, closed, trace: tr,
  };
}

/* ------------------------------------------------------------------ *
 * The table
 * ------------------------------------------------------------------ */
function arg(name, def) { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; }
const fmt = (v, d = 0) => (v == null ? '-' : Number(v).toFixed(d));
const sec = (v) => (v == null ? '-' : (v / 1000).toFixed(1));

async function mainTable() {
  const pages = arg('pages', 'index.html,first-visit.html,pumpkin-patch.html').split(',');
  const langs = arg('langs', 'en,hi').split(',');
  const cpus = arg('cpu', '4,6').split(',').map(Number);
  const nets = arg('net', 'slow4g,fast3g').split(',');
  const caches = arg('cache', 'cold,warm').split(',');
  const runs = +arg('runs', 3);
  const root = path.resolve(arg('root', ROOT));
  const site = await startServer(root);
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ args: site.spki ? ['--ignore-certificate-errors-spki-list=' + site.spki] : [] });   // this one certificate counts as good (with a certificate error Chrome keeps nothing in its cache)
  const rows = [];
  try {
    for (const file of pages) for (const lang of langs) for (const net of nets) for (const cpu of cpus) {
      const cell = { file, lang, net, cpu, cold: [], warm: [] };
      for (let i = 0; i < runs; i++) {
        const ctx = await browser.newContext(PHONE);
        const machine = await machineFactor(ctx);
        const a = await loadOnce(ctx, site.url, file, { lang, cpu, net });
        a.machine = machine;
        cell.cold.push(a);
        if (caches.includes('warm')) { const w = await loadOnce(ctx, site.url, file, { lang, cpu, net }); w.machine = machine; cell.warm.push(w); }
        await ctx.close();
      }
      rows.push(cell);
      const c = cell.cold;
      console.log(`${file.padEnd(22)} ${lang} ${NETS[net].label.padEnd(8)} cpu ${cpu}x  cold: FCP ${sec(med(c.map((x) => x.fcp)))}s (best ${sec(best(c.map((x) => x.fcp)))})  LCP ${sec(med(c.map((x) => x.lcp)))}s  CLS ${fmt(med(c.map((x) => x.cls)), 3)}  TBT ${fmt(med(c.map((x) => x.tbt)))}ms  hero drawn ${sec(med(c.map((x) => x.hero)))}s  menu ${sec(med(c.map((x) => x.menuOk)))}s  files ${med(c.map((x) => x.reqs))}  ${fmt(med(c.map((x) => x.enc)) / 1024)} KB  heap ${fmt(med(c.map((x) => x.heapMB)), 1)} MB  machine x${fmt(med(c.map((x) => x.machine)), 1)}`);
      if (cell.warm.length) { const w = cell.warm; console.log(`${''.padEnd(22)}    ${''.padEnd(8)}         warm: FCP ${sec(med(w.map((x) => x.fcp)))}s (best ${sec(best(w.map((x) => x.fcp)))})  LCP ${sec(med(w.map((x) => x.lcp)))}s  CLS ${fmt(med(w.map((x) => x.cls)), 3)}  TBT ${fmt(med(w.map((x) => x.tbt)))}ms  hero drawn ${sec(med(w.map((x) => x.hero)))}s  menu ${sec(med(w.map((x) => x.menuOk)))}s  files ${med(w.map((x) => x.reqs))}  ${fmt(med(w.map((x) => x.enc)) / 1024)} KB`); }
    }
  } finally { await browser.close(); await site.close(); }
  const out = arg('json');
  if (out) fs.writeFileSync(out, JSON.stringify(rows.map((r) => ({ ...r, cold: r.cold.map(({ trace, ...x }) => x), warm: r.warm.map(({ trace, ...x }) => x) })), null, 1));
}

/* ------------------------------------------------------------------ *
 * How smooth is the farm picture? Frame times of the page's own animation loop, per season.
 * ------------------------------------------------------------------ */
export async function frameStats(page, ms) {
  return page.evaluate((ms) => new Promise((resolve) => {
    const t = []; let last = 0; const t0 = performance.now();
    const f = (now) => { if (last) t.push(now - last); last = now; if (now - t0 < ms) requestAnimationFrame(f); else {
      const s = t.slice().sort((a, b) => a - b); const p = (q) => s[Math.min(s.length - 1, Math.floor(q * s.length))];
      resolve({ n: t.length, fps: t.length / ((now - t0) / 1000), p50: p(0.5), p95: p(0.95), max: s[s.length - 1], over50: t.filter((x) => x > 50).length / Math.max(1, t.length), over100: t.filter((x) => x > 100).length });
    } };
    requestAnimationFrame(f);
  }), ms);
}
export const running = (page) => page.evaluate(() => { let run = 0, paused = 0; document.getAnimations().forEach((a) => { if (a.effect && a.effect.getTiming().iterations === Infinity) { if (a.playState === 'running') run++; else paused++; } }); return { running: run, paused }; });
export async function busy(cdp, ms) {
  const a = await metrics(cdp); await sleep(ms); const c = await metrics(cdp);
  return { task: (c.TaskDuration - a.TaskDuration) / (ms / 1000) * 100, layouts: (c.LayoutCount - a.LayoutCount) / (ms / 1000), recalcs: (c.RecalcStyleCount - a.RecalcStyleCount) / (ms / 1000) };
}

/** Waits until the page has had no long task for `need` ms (the start-up work is over); returns how long it waited. */
export async function quiet(page, need = 2000, limit = 90000) {
  const t0 = Date.now();
  while (Date.now() - t0 < limit) {
    const q = await page.evaluate((n) => { const lt = window.__m.lt; const last = lt.length ? lt[lt.length - 1][0] + lt[lt.length - 1][1] : 0; return performance.now() - last > n; }, need).catch(() => false);
    if (q) break;
    await sleep(400);
  }
  return Date.now() - t0;
}

async function framesMode() {
  const cpus = arg('cpu', '4,6').split(',').map(Number);
  const file = arg('page', 'index.html');
  const lang = arg('lang', 'en');
  const runs = +arg('runs', 2);
  const seasons = arg('seasons', 'spring,summer,fall,winter').split(',');
  const root = path.resolve(arg('root', ROOT));
  const site = await startServer(root);
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ args: site.spki ? ['--ignore-certificate-errors-spki-list=' + site.spki] : [] });   // this one certificate counts as good (with a certificate error Chrome keeps nothing in its cache)
  const out = {};
  try {
    for (const cpu of cpus) for (let run = 0; run < runs; run++) {
      const ctx = await browser.newContext(PHONE);
      const machine = await machineFactor(ctx);
      const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
      await cdp.send('Performance.enable');
      await page.addInitScript(INIT(lang));
      await page.goto(site.url + file, { waitUntil: 'load', timeout: 120000 });
      await page.waitForFunction(() => window.__m && window.__m.ready != null, null, { timeout: 90000, polling: 100 }).catch(() => {});
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
      const startWait = await quiet(page);
      // control: an empty page with the same throttle, to see what this computer itself costs
      const ctl = await ctx.newPage(); const ccdp = await ctx.newCDPSession(ctl); await ccdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
      await ctl.setContent('<!doctype html><title>control</title><body style="margin:0">control</body>');
      const control = await frameStats(ctl, 3000); await ctl.close();
      await page.bringToFront();
      for (const season of seasons) {
        const sel = `#season-switch button[data-season="${season}"]`;
        let swapWait = 0;
        if (await page.evaluate((s) => !!document.querySelector(s), sel)) {
          await page.evaluate(() => scrollTo(0, 0));
          const c = await centre(page, sel);
          if (c) { const t = Date.now(); await tap(page, c.x, c.y); await sleep(800); swapWait = (await quiet(page, 1500)) + 800; }
        }
        const idle = await busy(cdp, 3000);                 // nobody asks for frames: only the page's own timers and the compositor
        const fr = await frameStats(page, 5000);             // something asks for a frame every 1/60 s (scrolling does)
        const an = await running(page);
        const key = `${cpu}x ${season}`;
        (out[key] = out[key] || []).push({ ...fr, idleBusy: idle.task, layouts: idle.layouts, recalcs: idle.recalcs, swapWait, startWait, ...an, control, machine });
      }
      await ctx.close();
    }
  } finally { await browser.close(); await site.close(); }
  for (const [k, v] of Object.entries(out)) {
    const c = v[0].control;
    console.log(`${k.padEnd(10)} frames/s ${fmt(med(v.map((x) => x.fps)), 1)} (best ${fmt(Math.max(...v.map((x) => x.fps)), 1)})  frame p50 ${fmt(med(v.map((x) => x.p50)), 0)} p95 ${fmt(med(v.map((x) => x.p95)), 0)} max ${fmt(med(v.map((x) => x.max)), 0)} ms  over 50 ms ${fmt(med(v.map((x) => x.over50)) * 100, 0)}%  idle main thread ${fmt(med(v.map((x) => x.idleBusy)), 0)}%  after a season change: quiet again in ${sec(med(v.map((x) => x.swapWait)))} s  looping animations running ${med(v.map((x) => x.running))}  | empty page: ${fmt(c.fps, 1)} frames/s, p95 ${fmt(c.p95, 0)} ms; machine x${fmt(med(v.map((x) => x.machine)), 1)}`);
  }
  const jf = arg('json'); if (jf) fs.writeFileSync(jf, JSON.stringify(out, null, 1));
}

/* ------------------------------------------------------------------ *
 * A swipe: frame times while a finger scrolls the page
 * ------------------------------------------------------------------ */
async function scrollMode() {
  const cpus = arg('cpu', '4,6').split(',').map(Number);
  const files = arg('pages', 'index.html').split(',');
  const lang = arg('lang', 'en');
  const runs = +arg('runs', 2);
  const root = path.resolve(arg('root', ROOT));
  const site = await startServer(root);
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ args: site.spki ? ['--ignore-certificate-errors-spki-list=' + site.spki] : [] });   // this one certificate counts as good (with a certificate error Chrome keeps nothing in its cache)
  const out = {};
  try {
    for (const file of files) for (const cpu of cpus) for (let run = 0; run < runs; run++) {
      const ctx = await browser.newContext(PHONE);
      const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
      await page.addInitScript(INIT(lang));
      await page.goto(site.url + file, { waitUntil: 'load', timeout: 120000 });
      await page.waitForFunction(() => window.__m && window.__m.ready != null, null, { timeout: 90000, polling: 100 }).catch(() => {});
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
      await quiet(page);
      await page.evaluate(() => { window.__fr = { t: [], on: true }; let last = 0; const f = (now) => { if (last) window.__fr.t.push(now - last); last = now; if (window.__fr.on) requestAnimationFrame(f); }; requestAnimationFrame(f); window.__lt0 = window.__m.lt.length; window.__y0 = scrollY; });
      const t0 = Date.now();
      for (let k = 0; k < 6; k++) { await swipe(cdp, 480, 20); await sleep(500); }   // six flicks, half a second apart (the page keeps gliding after each)
      const dur = Date.now() - t0;
      await sleep(300);
      const r = await page.evaluate(() => { window.__fr.on = false; const t = window.__fr.t.slice().sort((a, b) => a - b); const p = (q) => t[Math.min(t.length - 1, Math.floor(q * t.length))]; return { n: t.length, p50: p(0.5), p95: p(0.95), max: t[t.length - 1], over50: t.filter((x) => x > 50).length, lt: window.__m.lt.slice(window.__lt0), moved: scrollY - window.__y0 }; });
      (out[`${file} ${cpu}x`] = out[`${file} ${cpu}x`] || []).push({ ...r, dur, longMs: r.lt.reduce((a, x) => a + x[1], 0) });
      await ctx.close();
    }
  } finally { await browser.close(); await site.close(); }
  for (const [k, v] of Object.entries(out)) console.log(`${k.padEnd(24)} swipe of ${fmt(med(v.map((x) => x.moved)))} px took ${fmt(med(v.map((x) => x.dur)) / 1000, 1)} s  frames ${med(v.map((x) => x.n))}  p50 ${fmt(med(v.map((x) => x.p50)), 0)} p95 ${fmt(med(v.map((x) => x.p95)), 0)} max ${fmt(med(v.map((x) => x.max)), 0)} ms  over 50 ms: ${med(v.map((x) => x.over50))} frames  long tasks ${med(v.map((x) => x.lt.length))} (${fmt(med(v.map((x) => x.longMs)))} ms)`);
  const jf = arg('json'); if (jf) fs.writeFileSync(jf, JSON.stringify(out, null, 1));
}

/* ------------------------------------------------------------------ *
 * Animations that nobody sees: do they stop? What does the page cost while it only sits there?
 * ------------------------------------------------------------------ */
async function sitting(ctx, page, cdp, ms) {
  const events = [];
  const on = (e) => events.push(...e.value);
  cdp.on('Tracing.dataCollected', on);
  await cdp.send('Tracing.start', { categories: '__metadata,devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,cc', transferMode: 'ReportEvents' });
  await sleep(ms);
  await new Promise((res) => { cdp.once('Tracing.tracingComplete', res); cdp.send('Tracing.end'); });
  cdp.off('Tracing.dataCollected', on);
  const main = events.filter((e) => e.ph === 'M' && e.name === 'thread_name' && e.args.name === 'CrRendererMain').pop();
  const tasks = main ? events.filter((e) => e.ph === 'X' && e.pid === main.pid && e.tid === main.tid && e.name === 'RunTask') : [];
  const cpu = tasks.reduce((a, t) => a + (t.tdur != null ? t.tdur : t.dur), 0) / 1000;
  const cnt = (n) => events.filter((e) => e.name === n && (e.ph === 'I' || e.ph === 'X' || e.ph === 'R' || e.ph === 'b' || e.ph === 'n')).length;
  const sum = (n) => events.filter((e) => e.ph === 'X' && main && e.pid === main.pid && e.tid === main.tid && e.name === n).reduce((a, t) => a + (t.tdur != null ? t.tdur : t.dur), 0) / 1000;
  const sec = ms / 1000;
  return { cpuPct: cpu / ms * 100, drawFrames: cnt('DrawFrame') / sec, mainFrames: cnt('BeginMainThreadFrame') / sec, layoutMs: sum('Layout') / sec, styleMs: sum('UpdateLayoutTree') / sec, paintMs: (sum('Paint') + sum('PrePaint') + sum('Layerize')) / sec, tasks: tasks.length / sec };
}

async function motionMode() {
  const file = arg('page', 'index.html');
  const cpus = arg('cpu', '1,4').split(',').map(Number);
  const runs = +arg('runs', 2);
  const states = arg('states', 'visible,away,hidden,reduced').split(',');
  const root = path.resolve(arg('root', ROOT));
  const site = await startServer(root);
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ args: site.spki ? ['--ignore-certificate-errors-spki-list=' + site.spki] : [] });   // this one certificate counts as good (with a certificate error Chrome keeps nothing in its cache)
  const out = {};
  try {
    const seasons = arg('seasons', '').split(',').filter(Boolean);
    for (const cpu of cpus) for (const state of states) for (const season of (state === 'visible' && seasons.length ? seasons : [''])) for (let i = 0; i < runs; i++) {
      const ctx = await browser.newContext({ ...PHONE, reducedMotion: state === 'reduced' ? 'reduce' : 'no-preference' });
      const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
      await page.addInitScript(INIT('en'));
      await page.goto(site.url + file, { waitUntil: 'load', timeout: 120000 });
      await page.waitForFunction(() => window.__m && window.__m.ready != null, null, { timeout: 90000, polling: 100 }).catch(() => {});
      await sleep(2500);
      if (season) { const c = await centre(page, `#season-switch button[data-season="${season}"]`); if (c) await tap(page, c.x, c.y); await sleep(5000); await quiet(page, 1500); }
      if (state === 'away') { await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' }); await page.evaluate(() => { const e = document.querySelector('#faq'); if (e) e.scrollIntoView(); }); }
      if (state === 'hidden') await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
      await sleep(3500);   // the page notices (observers fire, the pause classes are set)
      if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
      const an = await running(page);
      const r = await sitting(ctx, page, cdp, 4000);
      const key = `${cpu}x ${state}${season ? ' ' + season : ''}`; (out[key] = out[key] || []).push({ ...an, ...r });
      await ctx.close();
    }
  } finally { await browser.close(); await site.close(); }
  for (const [k, v] of Object.entries(out)) console.log(`${k.padEnd(14)} looping animations running ${med(v.map((x) => x.running))}, paused ${med(v.map((x) => x.paused))}  main thread ${fmt(med(v.map((x) => x.cpuPct)), 1)}% busy  frames drawn/s ${fmt(med(v.map((x) => x.drawFrames)), 1)}  main-thread frames/s ${fmt(med(v.map((x) => x.mainFrames)), 1)}  style ${fmt(med(v.map((x) => x.styleMs)), 0)} layout ${fmt(med(v.map((x) => x.layoutMs)), 0)} paint+layers ${fmt(med(v.map((x) => x.paintMs)), 0)} ms per second`);
  const jf = arg('json'); if (jf) fs.writeFileSync(jf, JSON.stringify(out, null, 1));
}

/* ------------------------------------------------------------------ *
 * Where does the main thread spend its time while the page loads? (from a Chrome trace)
 * ------------------------------------------------------------------ */
export function analyseTrace(events, { top = 14, heroAt = null, readyAt = null } = {}) {
  const main = events.filter((e) => e.ph === 'M' && e.name === 'thread_name' && e.args.name === 'CrRendererMain').pop();
  if (!main) return null;
  const mine = (e) => e.pid === main.pid && e.tid === main.tid;
  const nav = events.find((e) => mine(e) && e.name === 'navigationStart' && e.args.data && e.args.data.documentLoaderURL);   // the page itself (its frames come later)
  const frame = nav && nav.args.frame;
  const loadEnd = events.find((e) => mine(e) && e.name === 'loadEventEnd' && e.args.frame === frame);
  const fcpEv = events.find((e) => mine(e) && e.name === 'firstContentfulPaint' && e.args.frame === frame);
  const T0 = nav ? nav.ts : 0, LOAD = loadEnd ? loadEnd.ts : Infinity;
  const X = events.filter((e) => e.ph === 'X' && mine(e) && e.dur !== undefined && e.ts >= T0).sort((a, b) => a.ts - b.ts || b.dur - a.dur);
  const cpuOf = (e) => (e.tdur != null ? e.tdur : e.dur);
  const SCRIPT = /^(EvaluateScript|FunctionCall|v8\.run|v8\.compile|v8\.callFunction|CompileScript|CacheScript|v8\.produceCache|v8\.newInstance)$/;
  const RENDER = /^(UpdateLayoutTree|Layout|PrePaint|Paint|Layerize|Commit|UpdateLayer|HitTest|IntersectionObserverController::computeIntersections|Animate|StyleRecalc|RasterTask|pushPaintArtifactToCompositor)$/;
  const urlOf = (e) => { const d = (e.args && (e.args.data || e.args.beginData)) || {}; return ((d.url || d.fileName || '').replace(/^https?:\/\/[^/]+\//, '') + (d.functionName ? ' ' + d.functionName : '') + (d.lineNumber && !d.functionName ? ':' + d.lineNumber : '')).trim(); };
  const kind = new Map(), kindLoad = new Map(), scripts = new Map(), forced = new Map(), sync = new Map(), bigStyle = [];
  const add = (m, k, v) => m.set(k, (m.get(k) || 0) + v);
  const stack = []; const tasks = [];
  const finish = (e) => {
    const self = cpuOf(e) - (e._cc || 0);
    const phase = e.ts < LOAD ? kindLoad : null;
    if (e.name !== 'RunTask') { add(kind, e.name, self); if (phase) add(phase, e.name, self); }
    if (SCRIPT.test(e.name) && urlOf(e)) add(scripts, e.name + ' ' + urlOf(e), self);
    if (/^(UpdateLayoutTree|Layout)$/.test(e.name)) {
      const anc = [...stack].reverse().find((x) => /^(FunctionCall|EvaluateScript)$/.test(x.name));
      if (anc) add(forced, e.name + ' inside ' + (urlOf(anc) || anc.name), cpuOf(e));
      if (e.name === 'UpdateLayoutTree' && cpuOf(e) > 8000) bigStyle.push({ at: Math.round((e.ts - T0) / 1000), cpu: +(cpuOf(e) / 1000).toFixed(1), elements: e.args && e.args.elementCount, by: anc ? urlOf(anc) : '' });
    }
    const p = stack[stack.length - 1]; if (p) p._cc = (p._cc || 0) + cpuOf(e);
  };
  const open = [];
  for (const e of X) {
    while (open.length && open[open.length - 1].ts + open[open.length - 1].dur <= e.ts) { const f = open.pop(); stack.pop(); finish(f); }
    open.push(e); stack.push(e);
    if (e.name === 'RunTask') tasks.push(e);
  }
  while (open.length) { const f = open.pop(); stack.pop(); finish(f); }
  const ms = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, top).map(([k, v]) => [k, +(v / 1000).toFixed(1)]);
  const sumM = (m) => [...m.values()].reduce((a, b) => a + b, 0) / 1000;
  const long = tasks.filter((t) => cpuOf(t) >= 12000).map((t) => ({ at: Math.round((t.ts - T0) / 1000), cpu: +(cpuOf(t) / 1000).toFixed(1), wall: +(t.dur / 1000).toFixed(1) })).sort((a, b) => b.cpu - a.cpu).slice(0, 12);
  const cpuTotal = tasks.reduce((a, t) => a + cpuOf(t), 0) / 1000;
  const before = tasks.filter((t) => t.ts < LOAD).reduce((a, t) => a + cpuOf(t), 0) / 1000;
  const inv = new Map();
  events.filter((e) => /^(StyleRecalcInvalidationTracking|StyleInvalidatorInvalidationTracking)$/.test(e.name) && e.args && e.args.data).forEach((e) => { const d = e.args.data; const k = (d.reason || '') + ' | ' + (d.invalidationSet ? '' : '') + (d.changedClass ? 'class ' + d.changedClass : d.changedAttribute ? 'attr ' + d.changedAttribute : d.changedId ? 'id ' + d.changedId : d.extraData || '') + ' | ' + (d.nodeName || ''); inv.set(k, (inv.get(k) || 0) + 1); });
  const FCP = fcpEv ? fcpEv.ts : Infinity;
  const cpuUntil = (ms) => (ms == null ? null : +(tasks.filter((t) => t.ts < T0 + ms * 1000).reduce((a, t) => a + cpuOf(t), 0) / 1000).toFixed(1));   // main-thread CPU used before a moment given in ms since the page started
  const toFcp = tasks.filter((t) => t.ts < FCP).reduce((a, t) => a + cpuOf(t), 0) / 1000;
  // what a phone that is `rate` times slower would see: every task takes rate times its CPU time here; a task over 50 ms is a long task, and what is over 50 ms counts as blocking
  const proj = (rate) => { const after = tasks.filter((t) => t.ts >= FCP && t.ts < LOAD + 3e6).map((t) => cpuOf(t) / 1000 * rate); return { tbt: Math.round(after.reduce((a, d) => a + Math.max(0, d - 50), 0)), longTasks: after.filter((d) => d > 50).length, longest: Math.round(Math.max(0, ...after)) }; };
  return { cpuTotal: +cpuTotal.toFixed(1), cpuToLoad: +before.toFixed(1), cpuToFcp: +toFcp.toFixed(1), cpuToHero: cpuUntil(heroAt), cpuToReady: cpuUntil(readyAt), proj4: proj(4), proj6: proj(6), invalidations: [...inv.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14), loadAt: Math.round((LOAD - T0) / 1000), fcpAt: fcpEv ? Math.round((fcpEv.ts - T0) / 1000) : null, tasks: tasks.length, kind: ms(kind), kindToLoad: ms(kindLoad), scripts: ms(scripts), forced: ms(forced), bigStyle: bigStyle.sort((a, b) => b.cpu - a.cpu).slice(0, 8), long, windowMs: Math.round((X.length ? X[X.length - 1].ts - T0 : 0) / 1000), scriptTotal: +sumM(scripts).toFixed(1) };
}

/* ------------------------------------------------------------------ *
 * Which lines of the page's own scripts cost the time? (V8 sampling profiler; time spent in the browser's own work that a script asks for,
 * for example a style and layout pass forced by getBoundingClientRect, is counted on the line that asked)
 * ------------------------------------------------------------------ */
export function analyseProfile(profile, { top = 18 } = {}) {
  const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
  const parent = new Map(); profile.nodes.forEach((n) => (n.children || []).forEach((c) => parent.set(c, n.id)));
  const self = new Map(); const dts = profile.timeDeltas;
  profile.samples.forEach((id, i) => { const dt = (dts[i + 1] != null ? dts[i + 1] : 0) / 1000; self.set(id, (self.get(id) || 0) + dt); });
  const label = (n) => { const f = n.callFrame; const u = (f.url || '').replace(/^https?:\/\/[^/]+\//, ''); return (f.functionName || '(anonymous)') + ' ' + (u ? u + ':' + (f.lineNumber + 1) : ''); };
  const fn = new Map(), incl = new Map(), lines = new Map(), special = {};
  for (const [id, ms] of self) {
    const n = nodes.get(id); const name = n.callFrame.functionName;
    if (/^\((idle|program|garbage collector|root)\)$/.test(name)) { special[name] = (special[name] || 0) + ms; continue; }
    const k = label(n); fn.set(k, (fn.get(k) || 0) + ms);
    const u = (n.callFrame.url || '').replace(/^https?:\/\/[^/]+\//, '');
    if (n.positionTicks && u) { const tot = n.positionTicks.reduce((a, t) => a + t.ticks, 0) || 1; n.positionTicks.forEach((t) => { const lk = u + ':' + t.line; lines.set(lk, (lines.get(lk) || 0) + ms * t.ticks / tot); }); }
    const seen = new Set(); for (let x = id; x; x = parent.get(x)) { const nn = nodes.get(x); if (/^\((root|program|idle)\)$/.test(nn.callFrame.functionName)) continue; const kk = label(nn); if (seen.has(kk)) continue; seen.add(kk); incl.set(kk, (incl.get(kk) || 0) + ms); }
  }
  const sorted = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, top).map(([k, v]) => [k, +v.toFixed(1)]);
  return { self: sorted(fn), inclusive: sorted(incl).filter(([k]) => /\.js:/.test(k)), lines: sorted(lines), special: Object.fromEntries(Object.entries(special).map(([k, v]) => [k, +v.toFixed(0)])) };
}

async function profileMode() {
  const files = arg('pages', 'index.html').split(',');
  const langs = arg('langs', 'en').split(',');
  const cpu = +arg('cpu', 1);
  const root = path.resolve(arg('root', ROOT));
  const site = await startServer(root);
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ args: site.spki ? ['--ignore-certificate-errors-spki-list=' + site.spki] : [] });   // this one certificate counts as good (with a certificate error Chrome keeps nothing in its cache)
  try {
    for (const file of files) for (const lang of langs) {
      const ctx = await browser.newContext(PHONE);
      const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
      await page.addInitScript(INIT(lang));
      await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
      if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
      await cdp.send('Profiler.start');
      await page.goto(site.url + file, { waitUntil: 'load', timeout: 120000 });
      await page.waitForFunction(() => window.__m && window.__m.ready != null, null, { timeout: 90000, polling: 100 }).catch(() => {});
      await sleep(+arg('settle', 3000));
      const { profile } = await cdp.send('Profiler.stop');
      await ctx.close();
      const a = analyseProfile(profile);
      console.log(`\n== ${file} ${lang} cpu ${cpu}x: where the scripts' time goes (wall ms in the sampling profile; includes browser work that a script line triggers)`);
      console.log('  not in scripts (ms):', JSON.stringify(a.special));
      console.log('  by function, itself:'); a.self.forEach(([k, v]) => console.log('    ' + String(v).padStart(7) + '  ' + k));
      console.log('  by function, with what it calls:'); a.inclusive.forEach(([k, v]) => console.log('    ' + String(v).padStart(7) + '  ' + k));
      console.log('  by line:'); a.lines.forEach(([k, v]) => console.log('    ' + String(v).padStart(7) + '  ' + k));
      const jf = arg('json'); if (jf) fs.writeFileSync(jf.replace(/\.json$/, `-${file.replace(/\.html$/, '')}-${lang}.json`), JSON.stringify(a));
    }
  } finally { await browser.close(); await site.close(); }
}

async function cpuMode() {
  const files = arg('pages', 'index.html,first-visit.html,pumpkin-patch.html').split(',');
  const langs = arg('langs', 'en,hi').split(',');
  const runs = +arg('runs', 3);
  const root = path.resolve(arg('root', ROOT));
  const site = await startServer(root);
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ args: site.spki ? ['--ignore-certificate-errors-spki-list=' + site.spki] : [] });
  const out = {};
  try {
    for (const file of files) for (const lang of langs) for (let i = 0; i < runs; i++) {
      const ctx = await browser.newContext(PHONE);
      const r = await loadOnce(ctx, site.url, file, { lang, cpu: 1, net: 'none', interact: false, trace: true, settle: 4000 });
      await ctx.close();
      const a = analyseTrace(r.trace, { heroAt: r.hero, readyAt: r.ready });
      (out[`${file} ${lang}`] = out[`${file} ${lang}`] || []).push({ ...a, nodes: r.nodes, heapMB: r.heapMB, elements: null });
    }
  } finally { await browser.close(); await site.close(); }
  for (const [k, v] of Object.entries(out)) console.log(`${k.padEnd(26)} main-thread CPU (ms, this computer): to first paint ${fmt(med(v.map((x) => x.cpuToFcp)))}, to load ${fmt(med(v.map((x) => x.cpuToLoad)))}, in all (about ${fmt(med(v.map((x) => x.windowMs)) / 1000, 1)} s) ${fmt(med(v.map((x) => x.cpuTotal)))}  | on a 4x phone: long tasks ${med(v.map((x) => x.proj4.longTasks))}, blocking time ${fmt(med(v.map((x) => x.proj4.tbt)))} ms, longest ${fmt(med(v.map((x) => x.proj4.longest)))} ms  | 6x: long tasks ${med(v.map((x) => x.proj6.longTasks))}, blocking ${fmt(med(v.map((x) => x.proj6.tbt)))} ms, longest ${fmt(med(v.map((x) => x.proj6.longest)))} ms`);
  const jf = arg('json'); if (jf) fs.writeFileSync(jf, JSON.stringify(out, null, 1));
}

/* ------------------------------------------------------------------ *
 * A reader who scrolls the whole page, a screen at a time: pictures load as they come near (lazy), and a picture that arrives
 * without a reserved size would push the text down (layout shift).
 * ------------------------------------------------------------------ */
async function journeyMode() {
  const cpus = arg('cpu', '4').split(',').map(Number);
  const files = arg('pages', 'index.html').split(',');
  const nets = arg('net', 'slow4g').split(',');
  const lang = arg('lang', 'en');
  const runs = +arg('runs', 2);
  const root = path.resolve(arg('root', ROOT));
  const site = await startServer(root);
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ args: site.spki ? ['--ignore-certificate-errors-spki-list=' + site.spki] : [] });
  const out = {};
  try {
    for (const file of files) for (const net of nets) for (const cpu of cpus) for (let run = 0; run < runs; run++) {
      const ctx = await browser.newContext(PHONE);
      const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
      const reqs = new Map();
      cdp.on('Network.requestWillBeSent', (e) => { if (!/^data:/.test(e.request.url)) reqs.set(e.requestId, { url: e.request.url.replace(site.url, ''), type: e.type, enc: 0 }); });
      cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) r.enc = e.encodedDataLength; });
      await cdp.send('Network.enable');
      await page.addInitScript(INIT(lang));
      const n = NETS[net];
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: n.latency, downloadThroughput: n.down, uploadThroughput: n.up });
      if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
      await page.goto(site.url + file, { waitUntil: 'load', timeout: 120000 });
      await page.waitForFunction(() => window.__m && window.__m.ready != null, null, { timeout: 90000, polling: 100 }).catch(() => {});
      await quiet(page, 1500);
      const before = await page.evaluate(() => ({ cls: window.__m.cls, lt: window.__m.lt.length, ev: window.__m.shifts.length }));
      const nReq0 = reqs.size, enc0 = [...reqs.values()].reduce((a, r) => a + r.enc, 0);
      await page.evaluate(() => { window.__fr = { t: [], on: true }; let last = 0; const f = (now) => { if (last) window.__fr.t.push(now - last); last = now; if (window.__fr.on) requestAnimationFrame(f); }; requestAnimationFrame(f); });
      const total = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < total; y += 480) { await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y); await sleep(500); }   // by script: a finger takes minutes on a slow CPU (see --mode scroll)
      await sleep(4000);
      const r = await page.evaluate((b) => { window.__fr.on = false; const t = window.__fr.t.slice().sort((a, c) => a - c); return { cls: window.__m.cls - b.cls, shifts: window.__m.shifts.slice(b.ev), lt: window.__m.lt.slice(b.lt), p95: t[Math.floor(t.length * 0.95)], max: t[t.length - 1], y: scrollY, h: document.documentElement.scrollHeight, imgs: document.querySelectorAll('img').length, loaded: [...document.images].filter((i) => i.complete && i.naturalWidth).length }; }, before);
      const all = [...reqs.values()];
      (out[`${file} ${n.label} ${cpu}x`] = out[`${file} ${n.label} ${cpu}x`] || []).push({ ...r, reqs: all.length - nReq0, enc: all.reduce((a, q) => a + q.enc, 0) - enc0, imgReqs: all.filter((q) => q.type === 'Image').length, imgEnc: all.filter((q) => q.type === 'Image').reduce((a, q) => a + q.enc, 0), longMs: r.lt.reduce((a, x) => a + x[1], 0) });
      await ctx.close();
    }
  } finally { await browser.close(); await site.close(); }
  for (const [k, v] of Object.entries(out)) console.log(`${k.padEnd(28)} scrolled the whole page (${med(v.map((x) => x.h))} px): layout shift ${fmt(med(v.map((x) => x.cls)), 3)}  more files ${med(v.map((x) => x.reqs))} (${fmt(med(v.map((x) => x.enc)) / 1024)} KB, pictures ${fmt(med(v.map((x) => x.imgEnc)) / 1024)} KB)  pictures shown ${med(v.map((x) => x.loaded))}/${med(v.map((x) => x.imgs))}  long tasks ${med(v.map((x) => x.lt.length))} (${fmt(med(v.map((x) => x.longMs)))} ms)  frame p95 ${fmt(med(v.map((x) => x.p95)), 0)} ms max ${fmt(med(v.map((x) => x.max)), 0)} ms`);
  const jf = arg('json'); if (jf) fs.writeFileSync(jf, JSON.stringify(out, null, 1));
}

/* ------------------------------------------------------------------ *
 * What one main-thread frame costs with the farm picture on screen (scrolling, a tap or any script that asks for a frame makes one 60 times a second).
 * CPU time from a trace, so it does not depend on how busy this computer is; a phone that is 4x or 6x slower needs 4x or 6x as long.
 * ------------------------------------------------------------------ */
async function frameCostMode() {
  const seasons = arg('seasons', 'spring,summer,fall,winter').split(',');
  const file = arg('page', 'index.html');
  const runs = +arg('runs', 2);
  const calms = arg('calm', 'off').split(',');                 // off: as it comes; all: the visitor pressed "Pause animations"; auto: the page's own switch for a struggling phone (needs --trigger 6 or 4)
  const stopAt = arg('stop', 'most');                           // for auto: stop slowing the processor at this level (light or most)
  const trigger = +arg('trigger', 6);                           // for auto: the CPU slowdown that makes the page struggle, until it has switched
  const root = path.resolve(arg('root', ROOT));
  const site = await startServer(root);
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ args: site.spki ? ['--ignore-certificate-errors-spki-list=' + site.spki] : [] });
  const out = {};
  try {
    for (const calm of calms) for (const season of seasons) for (let i = 0; i < runs; i++) {
      const ctx = await browser.newContext(PHONE);
      const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
      await page.addInitScript(INIT('en', calm === 'auto'));
      await page.goto(site.url + file, { waitUntil: 'load', timeout: 120000 });
      await page.waitForFunction(() => window.__m && window.__m.ready != null, null, { timeout: 90000, polling: 100 }).catch(() => {});
      await quiet(page);
      const c = await centre(page, `#season-switch button[data-season="${season}"]`); if (c) await tap(page, c.x, c.y);
      await sleep(3000);
      let level = '', switchedAfter = null;
      if (calm === 'all') {
        await page.evaluate(() => { const b = document.querySelector('[data-motion]:not([hidden])'); if (b) b.click(); });   // the visitor's "Pause animations" (the footer one when the hero's is not drawn)
        await sleep(1500);
      } else if (calm === 'auto') {
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: trigger });
        const t0 = Date.now();
        for (let k = 0; k < 80; k++) {                          // the page looks for 2 s at a time; two bad spells in a row make one step
          await sleep(1000);
          level = await page.evaluate(() => (window.WISE_ACRES.motion && window.WISE_ACRES.motion.level) || '').catch(() => '');
          if (level && switchedAfter == null) switchedAfter = (Date.now() - t0) / 1000;
          if (level === stopAt || (stopAt === 'light' && level)) break;
        }
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
        await quiet(page, 1500, 30000);
      }
      await page.evaluate(() => { window.__raf = true; const f = () => { if (window.__raf) requestAnimationFrame(f); }; requestAnimationFrame(f); });
      const events = []; const on = (e) => events.push(...e.value); cdp.on('Tracing.dataCollected', on);
      await cdp.send('Tracing.start', { categories: '__metadata,devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame', transferMode: 'ReportEvents' });
      await sleep(4000);
      await new Promise((res) => { cdp.once('Tracing.tracingComplete', res); cdp.send('Tracing.end'); }); cdp.off('Tracing.dataCollected', on);
      const main = events.filter((e) => e.ph === 'M' && e.name === 'thread_name' && e.args.name === 'CrRendererMain').pop();
      const X = events.filter((e) => e.ph === 'X' && e.pid === main.pid && e.tid === main.tid);
      const frames = events.filter((e) => e.name === 'BeginMainThreadFrame').length || 1;
      const cpu = (n) => X.filter((e) => e.name === n).reduce((a, e) => a + (e.tdur != null ? e.tdur : e.dur), 0) / 1000;
      const total = X.filter((e) => e.name === 'RunTask').reduce((a, e) => a + (e.tdur != null ? e.tdur : e.dur), 0) / 1000;
      const an = await running(page);
      const lv = await page.evaluate(() => document.documentElement.getAttribute('data-calm') || '');
      const key = `${season} calm ${calm}`;
      (out[key] = out[key] || []).push({ perFrame: total / frames, paint: cpu('Paint') / frames, layerize: cpu('Layerize') / frames, style: (cpu('UpdateLayoutTree') + cpu('Layout') + cpu('PrePaint')) / frames, running: an.running, level: lv, switchedAfter });
      await ctx.close();
    }
  } finally { await browser.close(); await site.close(); }
  for (const [k, v] of Object.entries(out)) {
    const pf = med(v.map((x) => x.perFrame));
    console.log(`${k.padEnd(18)} one frame costs ${fmt(pf, 1)} ms of main-thread CPU (paint ${fmt(med(v.map((x) => x.paint)), 1)}, layers ${fmt(med(v.map((x) => x.layerize)), 1)}, style+layout ${fmt(med(v.map((x) => x.style)), 1)})  => about ${fmt(Math.min(60, 1000 / Math.max(1, pf * 4)), 0)} frames/s on a 4x phone, ${fmt(Math.min(60, 1000 / Math.max(1, pf * 6)), 0)} on a 6x phone  (${med(v.map((x) => x.running))} looping animations running; calm level '${v.map((x) => x.level || '-').join("','")}'${v[0].switchedAfter != null ? '; first step after ' + v.map((x) => fmt(x.switchedAfter, 0)).join(', ') + ' s' : ''})`);
  }
  const jf = arg('json'); if (jf) fs.writeFileSync(jf, JSON.stringify(out, null, 1));
}

/** Two or more copies of the site side by side, loaded in turns (so a computer that gets busy and quiet again hurts them all the same). */
async function abMode() {
  const roots = arg('roots', '').split(',').filter(Boolean).map((r) => path.resolve(r));
  if (roots.length < 2) { console.error('--roots dirA,dirB needed'); process.exit(2); }
  const files = arg('pages', 'index.html').split(',');
  const langs = arg('langs', 'en').split(',');
  const runs = +arg('runs', 5);
  const cpu = +arg('cpu', 1);
  const net = arg('net', cpu > 1 ? 'slow4g' : 'none');
  const sites = []; for (const r of roots) sites.push(await startServer(r, 0));
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ args: ['--ignore-certificate-errors-spki-list=' + sites.map((x) => x.spki).filter(Boolean).join(',')] });
  const out = {};
  try {
    for (const file of files) for (const lang of langs) for (let i = 0; i < runs; i++) for (let k = 0; k < roots.length; k++) {
      const ctx = await browser.newContext(PHONE);
      const r = await loadOnce(ctx, sites[k].url, file, { lang, cpu, net, interact: false, trace: cpu === 1, settle: 3500 });
      await ctx.close();
      const a = r.trace ? analyseTrace(r.trace, { heroAt: r.hero, readyAt: r.ready }) : null;
      (out[`${file} ${lang}`] = out[`${file} ${lang}`] || roots.map(() => []))[k].push({ fcp: r.fcp, ready: r.ready, hero: r.hero, menu: r.menuOk, load: r.load, tbt: r.tbt, longest: r.longest, nodes: r.nodes, enc: r.enc, ...(a ? { cpuToFcp: a.cpuToFcp, cpuToHero: a.cpuToHero, cpuToReady: a.cpuToReady, cpuToLoad: a.cpuToLoad, cpuTotal: a.cpuTotal, p4tbt: a.proj4.tbt, p4long: a.proj4.longTasks, p4longest: a.proj4.longest, p6tbt: a.proj6.tbt } : {}) });
    }
  } finally { await browser.close(); for (const x of sites) await x.close(); }
  const wallKeys = ['fcp', 'hero', 'ready', 'menu', 'load', 'tbt', 'longest', 'enc'];
  const keys = cpu === 1 ? ['cpuToFcp', 'cpuToHero', 'cpuToReady', 'cpuToLoad', 'cpuTotal', 'p4tbt', 'p4long', 'p4longest', 'p6tbt', 'nodes', 'enc', ...(net !== 'none' ? wallKeys.filter((k) => k !== 'enc') : [])] : wallKeys;
  for (const [k, v] of Object.entries(out)) {
    console.log(`== ${k} (${cpu === 1 ? 'CPU time on this computer, no network limit' : cpu + 'x CPU, ' + NETS[net].label}), median of ${runs}, in turns`);
    for (const key of keys) console.log('  ' + key.padEnd(10) + roots.map((r, i) => `${path.basename(path.dirname(r)) + '/' + path.basename(r)} ${fmt(med(v[i].map((x) => x[key])))}`.padEnd(30)).join('') + (roots.length === 2 ? `  change ${fmt(med(v[1].map((x) => x[key])) - med(v[0].map((x) => x[key])))}` : ''));
  }
  const jf = arg('json'); if (jf) fs.writeFileSync(jf, JSON.stringify(out, null, 1));
}

async function traceMode() {
  const files = arg('pages', 'index.html').split(',');
  const langs = arg('langs', 'en').split(',');
  const cpu = +arg('cpu', 1);
  const root = path.resolve(arg('root', ROOT));
  const site = await startServer(root);
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ args: site.spki ? ['--ignore-certificate-errors-spki-list=' + site.spki] : [] });   // this one certificate counts as good (with a certificate error Chrome keeps nothing in its cache)
  try {
    for (const file of files) for (const lang of langs) {
      const ctx = await browser.newContext(PHONE);
      const r = await loadOnce(ctx, site.url, file, { lang, cpu, net: 'none', interact: false, trace: true });
      await ctx.close();
      const a = analyseTrace(r.trace);
      console.log(`\n== ${file} ${lang} cpu ${cpu}x: main-thread CPU ${a.cpuTotal} ms in ${a.tasks} tasks over ${a.windowMs} ms; ${a.cpuToLoad} ms of it before the load event (at ${a.loadAt} ms). This computer, no network limit.`);
      console.log('  by kind of work, all (self CPU ms):', a.kind.map(([k, v]) => `${k} ${v}`).join(', '));
      console.log('  by kind of work, before load:      ', a.kindToLoad.map(([k, v]) => `${k} ${v}`).join(', '));
      console.log('  script (self CPU ms):'); a.scripts.forEach(([k, v]) => console.log('    ' + String(v).padStart(7) + '  ' + k));
      console.log('  style/layout done inside a script (forced, CPU ms):'); a.forced.forEach(([k, v]) => console.log('    ' + String(v).padStart(7) + '  ' + k));
      console.log('  biggest style recalculations:', JSON.stringify(a.bigStyle));
      if (a.invalidations.length) { console.log('  why styles were recalculated (count | reason | what changed | element):'); a.invalidations.forEach(([k, v]) => console.log('    ' + String(v).padStart(6) + '  ' + k)); }
      console.log('  longest tasks (at ms: CPU ms):', a.long.map((t) => `${t.at}: ${t.cpu}`).join(', '));
      const jf = arg('json'); if (jf) fs.writeFileSync(jf.replace(/\.json$/, `-${file.replace(/\.html$/, '')}-${lang}.json`), JSON.stringify(r.trace));
    }
  } finally { await browser.close(); await site.close(); }
}

if (import.meta.url === 'file://' + process.argv[1]) {
  if (process.argv.includes('--help')) { console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').match(/\/\*([\s\S]*?)\*\//)[1].replace(/^ \* ?/gm, '')); process.exit(0); }
  const mode = arg('mode', 'table');
  (mode === 'frames' ? framesMode() : mode === 'trace' ? traceMode() : mode === 'motion' ? motionMode() : mode === 'framecost' ? frameCostMode() : mode === 'journey' ? journeyMode() : mode === 'ab' ? abMode() : mode === 'cpu' ? cpuMode() : mode === 'scroll' ? scrollMode() : mode === 'profile' ? profileMode() : mainTable()).catch((e) => { console.error(e); process.exit(1); });
}
