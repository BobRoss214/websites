// Run with:  node --test givespin/tests/pwa.test.js
// The installable app: the manifest and its icons, the service worker's file list (it must match index.html, so it cannot go stale), what the worker does with
// each kind of request (run against stand-ins for the browser's cache and fetch), the offline page, and the pure rules in js/appkit.js (when the worker may be
// registered, the iOS hint, the reminder schedule against the real live-table events).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const INDEX = read('index.html');
const MANIFEST = JSON.parse(read('manifest.webmanifest'));
const SW = require('../sw.js');
const K = require('../js/appkit.js');

/** The width and height written in a PNG file's header. */
function pngSize(file) {
  const b = fs.readFileSync(path.join(ROOT, file));
  assert.equal(b.slice(1, 4).toString('latin1'), 'PNG', file + ' is a PNG');
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), bytes: b.length };
}

/** Every local file index.html loads: style sheets, scripts, the icon, the manifest and the Apple icon. */
function indexFiles() {
  const hrefs = [...INDEX.matchAll(/<link\b[^>]*\bhref="([^"]+)"/g)].map((m) => m[1]);
  const srcs = [...INDEX.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
  return { hrefs, srcs };
}

test('the manifest has the fields an installable app needs, and its colours are the site\'s own', () => {
  assert.equal(MANIFEST.name, 'GiveSpin Arcade');
  assert.ok(MANIFEST.short_name && MANIFEST.short_name.length <= 12, 'a short name that fits under an icon');
  assert.equal(MANIFEST.start_url, './');
  assert.equal(MANIFEST.scope, './');
  assert.equal(MANIFEST.display, 'standalone');
  assert.ok(MANIFEST.description && MANIFEST.description.length > 20);
  // the colours: the page's theme colour and the dark background in css/base.css
  const base = read('css/base.css');
  const bg = (/--bg:\s*(#[0-9a-f]{6})/i.exec(base) || [])[1];
  const meta = (/<meta name="theme-color" content="(#[0-9a-f]{6})"/i.exec(INDEX) || [])[1];
  assert.ok(bg && meta);
  assert.equal(MANIFEST.background_color.toLowerCase(), bg.toLowerCase(), 'background_color is --bg');
  assert.equal(MANIFEST.theme_color.toLowerCase(), meta.toLowerCase(), 'theme_color is the page\'s theme-color meta');
  // the description does not promise anything real
  assert.ok(/demo|play-money|pretend/i.test(MANIFEST.description) && !/real money/i.test(MANIFEST.description.replace(/no real money/i, '')), MANIFEST.description);
});

test('the icons: 192 and 512 for any use, a 512 maskable one, every file there, the right size and small', () => {
  const by = (size, purpose) => MANIFEST.icons.filter((i) => i.sizes === size && (i.purpose || 'any') === purpose);
  assert.equal(by('192x192', 'any').length, 1);
  assert.equal(by('512x512', 'any').length, 1);
  assert.equal(by('512x512', 'maskable').length, 1);
  MANIFEST.icons.forEach((i) => {
    assert.equal(i.type, 'image/png');
    assert.ok(exists(i.src), i.src + ' exists');
    const s = pngSize(i.src);
    assert.equal(s.w + 'x' + s.h, i.sizes, i.src + ' is really ' + i.sizes);
    assert.ok(s.bytes < 20000, i.src + ' is ' + s.bytes + ' bytes (keep icons small)');
  });
  const apple = (/<link rel="apple-touch-icon" href="([^"]+)"/.exec(INDEX) || [])[1];
  assert.ok(apple && exists(apple), 'index.html has an apple-touch-icon that exists');
  const a = pngSize(apple);
  assert.equal(a.w, 180); assert.equal(a.h, 180);
  const badge = pngSize('assets/icons/badge-96.png');
  assert.equal(badge.w, 96);
  assert.ok(MANIFEST.shortcuts.every((s) => s.url.startsWith('./') && s.icons.every((i) => exists(i.src))));
});

test('index.html links the manifest, the Apple icon and the install script, and the script loads after the files it needs', () => {
  assert.ok(/<link rel="manifest" href="manifest\.webmanifest">/.test(INDEX));
  const { srcs } = indexFiles();
  const at = (f) => srcs.indexOf(f);
  ['js/appkit.js', 'js/ui/install.js', 'js/ui/makereal.js', 'js/transport.js', 'js/local.js'].forEach((f) => assert.ok(at(f) >= 0, f + ' is loaded'));
  assert.ok(at('js/appkit.js') < at('js/ui/install.js') && at('js/local.js') < at('js/ui/install.js') && at('js/ui/makereal.js') < at('js/ui/install.js'), 'install.js loads after appkit, local and makereal');
  assert.ok(at('js/transport.js') < at('js/ui/makereal.js'), 'the waitlist rules load before the page that uses them');
  assert.ok(at('js/ui/install.js') < at('js/app.js'));
});

test('the service worker\'s file list is exactly what index.html loads (plus the offline page, the manifest, the icons and the fonts), and every file exists', () => {
  const { hrefs, srcs } = indexFiles();
  const cssFiles = hrefs.filter((h) => /\.css$/.test(h));
  const fonts = [];
  cssFiles.forEach((css) => {
    for (const m of read(css).matchAll(/url\(\s*["']?([^)"']+)["']?\s*\)/g)) {
      if (!/^(?:data:|https?:|#)/.test(m[1])) { fonts.push(path.posix.normalize(path.posix.join(path.posix.dirname(css), m[1]))); }
    }
  });
  const expected = new Set(['index.html', 'offline.html', 'manifest.webmanifest', 'assets/icons/badge-96.png'].concat(hrefs, srcs, MANIFEST.icons.map((i) => i.src), fonts));
  const have = new Set(SW.PRECACHE);
  assert.equal(have.size, SW.PRECACHE.length, 'no file is listed twice');
  const missingFromWorker = [...expected].filter((f) => !have.has(f));
  const extraInWorker = [...have].filter((f) => !expected.has(f));
  assert.deepEqual(missingFromWorker, [], 'index.html loads these but sw.js does not save them. Run `node tools/make-precache.mjs` (or paste this list into PRECACHE in sw.js):\n' + [...expected].map((f) => "  '" + f + "'").join(',\n'));
  assert.deepEqual(extraInWorker, [], 'sw.js saves these but index.html no longer loads them');
  const gone = SW.PRECACHE.filter((f) => !exists(f));
  assert.deepEqual(gone, [], 'sw.js lists files that do not exist (the install would fail and nothing would be saved)');
  assert.ok(srcs.length > 50 && cssFiles.length > 15, 'the test really found the scripts and style sheets');
  assert.ok(SW.PRECACHE.every((f) => !/^(?:https?:)?\/\//.test(f) && !f.startsWith('/')), 'every entry is a relative path of ours');
  assert.ok(/^v\d+/.test(SW.VERSION) && SW.CACHE === 'givespin-' + SW.VERSION);
});

test('classify: another site, a non-GET and a range request are left to the browser; opening the site is a page; code and pictures are told apart', () => {
  const O = 'https://give.example';
  const req = (url, extra) => Object.assign({ url, method: 'GET', mode: 'no-cors', headers: { get: () => null } }, extra);
  assert.equal(SW.classify(req('https://fonts.googleapis.com/css'), O), 'skip', 'another site is never touched');
  assert.equal(SW.classify(req('http://give.example/x.js'), O), 'skip', 'another origin (the scheme differs)');
  assert.equal(SW.classify(req('https://give.example.evil.test/x.js'), O), 'skip');
  assert.equal(SW.classify(req('https://give.example/js/app.js', { method: 'POST' }), O), 'skip');
  assert.equal(SW.classify(req('https://give.example/a.png', { headers: { get: (h) => (h === 'range' ? 'bytes=0-9' : null) } }), O), 'skip');
  assert.equal(SW.classify(req('chrome-extension://abc/x.js'), O), 'skip');
  assert.equal(SW.classify(req('not a url'), O), 'skip');
  assert.equal(SW.classify(req('https://give.example/', { mode: 'navigate' }), O), 'page');
  assert.equal(SW.classify(req('https://give.example/index.html?fast=1', { mode: 'navigate' }), O), 'page');
  ['js/app.js', 'css/base.css', 'sw.js', 'manifest.webmanifest', 'index.html', 'docs/x.json'].forEach((f) => assert.equal(SW.classify(req('https://give.example/' + f), O), 'code', f));
  ['assets/logos/a.png', 'assets/favicon.svg', 'assets/fonts/x.woff2', 'assets/icons/icon-192.png'].forEach((f) => assert.equal(SW.classify(req('https://give.example/' + f), O), 'asset', f));
});

test('pageKey: the app\'s own page is one saved copy however it is opened; any other page is not kept', () => {
  const scope = 'https://give.example/play/';
  const k = (p) => SW.pageKey(new URL('https://give.example' + p), scope);
  assert.equal(k('/play/'), 'index.html');
  assert.equal(k('/play/index.html'), 'index.html');
  assert.equal(k('/play/?fast=1'), 'index.html', 'the query is not part of the path');
  assert.equal(k('/play/docs/'), '');
  assert.equal(k('/'), '');
  assert.equal(k('/other/index.html'), '');
  assert.equal(SW.pageKey(new URL('https://evil.test/play/'), scope), '', 'another origin');
  assert.equal(SW.pageKey(new URL('https://give.example/'), 'https://give.example/'), 'index.html', 'a site at the root');
  assert.equal(SW.canKeep({ status: 200, type: 'basic', redirected: false }), true);
  assert.equal(SW.canKeep({ status: 206, type: 'basic' }), false, 'a partial answer');
  assert.equal(SW.canKeep({ status: 404, type: 'basic' }), false);
  assert.equal(SW.canKeep({ status: 200, type: 'opaque' }), false, 'nothing from another site');
  assert.equal(SW.canKeep({ status: 200, type: 'basic', redirected: true }), false);
  assert.equal(SW.canKeep(null), false);
});

/**
 * sw.js loaded as the browser would load it, with stand-ins for the worker's globals: a cache that remembers what is put in it, a network that can be cut,
 * and a log of every address asked for. Returns what the tests need to drive its events.
 */
function worker() {
  const caches = new Map();                 // name -> Map(url -> response)
  const origin = 'https://give.example';
  const scope = origin + '/';
  const net = { up: true, log: [], files: {}, status: {} };
  const handlers = {};
  const abs = (u) => new URL(typeof u === 'string' ? u : u.url, scope).href;
  class FakeRequest { constructor(u, init) { this.url = abs(u); this.method = (init && init.method) || 'GET'; this.mode = (init && init.mode) || 'no-cors'; this.headers = { get: () => null }; this.cache = init && init.cache; } }
  class FakeResponse {
    constructor(body, init) { init = init || {}; this.body = body; this.status = init.status === undefined ? 200 : init.status; this.type = init.type || 'basic'; this.redirected = !!init.redirected; this.ok = this.status >= 200 && this.status < 300; }
    clone() { return new FakeResponse(this.body, this); }
    static error() { const r = new FakeResponse('', { status: 0, type: 'error' }); r.isError = true; return r; }
  }
  const strip = (u, ignoreSearch) => { const x = new URL(u); if (ignoreSearch) { x.search = ''; } return x.href; };
  const makeCache = (name) => {
    const store = caches.get(name);
    return {
      put: (k, res) => { store.set(abs(k), res); return Promise.resolve(); },
      addAll: (reqs) => Promise.all(reqs.map((r) => fakeFetch(r).then((res) => { if (!res.ok) { throw new Error('addAll failed for ' + r.url); } store.set(abs(r), res); }))).then(() => undefined),
      match: (k, o) => { const want = strip(abs(k), o && o.ignoreSearch); for (const [u, r] of store) { if (strip(u, o && o.ignoreSearch) === want) { return Promise.resolve(r); } } return Promise.resolve(undefined); }
    };
  };
  const fakeFetch = (r) => {
    const url = abs(r);
    net.log.push(url);
    if (!net.up) { return Promise.reject(new TypeError('offline')); }
    const key = new URL(url).pathname.replace(/^\//, '') || 'index.html';
    if (net.status[key]) { return Promise.resolve(new FakeResponse('x', { status: net.status[key] })); }
    return Promise.resolve(new FakeResponse(net.files[key] !== undefined ? net.files[key] : 'file:' + key));
  };
  const sandbox = {
    console, URL, Promise, Map, Set, TypeError, Request: FakeRequest, Response: FakeResponse, fetch: fakeFetch,
    caches: {
      open: (n) => { if (!caches.has(n)) { caches.set(n, new Map()); } return Promise.resolve(makeCache(n)); },
      keys: () => Promise.resolve([...caches.keys()]),
      delete: (n) => Promise.resolve(caches.delete(n)),
      match: (k, o) => { const names = [...caches.keys()]; return names.reduce((p, n) => p.then((hit) => hit || makeCache(n).match(k, o)), Promise.resolve(undefined)); }
    }
  };
  const claimed = [];
  let skipped = 0;
  sandbox.self = {
    location: new URL(scope + 'sw.js'), registration: { scope, showNotification() {} },
    addEventListener: (t, fn) => { handlers[t] = fn; },
    skipWaiting: () => { skipped += 1; return Promise.resolve(); },
    clients: { claim: () => { claimed.push(1); return Promise.resolve(); }, matchAll: () => Promise.resolve([]), openWindow: () => Promise.resolve() }
  };
  vm.createContext(sandbox);
  vm.runInContext(read('sw.js'), sandbox, { filename: 'sw.js' });
  const run = (type, event) => { event = event || {}; let p; event.waitUntil = (x) => { p = x; }; handlers[type](event); return p; };
  /** Fires a fetch event; resolves to { handled, response }. */
  const fetchEvent = (url, mode) => {
    const req = new FakeRequest(url, { mode });
    let got; const e = { request: req, respondWith: (p) => { got = p; } };
    handlers.fetch(e);
    return got ? Promise.resolve(got).then((response) => ({ handled: true, response })) : Promise.resolve({ handled: false });
  };
  return { caches, net, handlers, run, fetchEvent, claimed, skipped: () => skipped, scope, sandbox };
}

test('install saves every listed file in one go and then takes over; if one file cannot be fetched, nothing is saved', async () => {
  const w = worker();
  await w.run('install');
  const saved = w.caches.get(SW.CACHE);
  assert.equal(saved.size, SW.PRECACHE.length);
  assert.ok([...saved.keys()].every((u) => u.startsWith('https://give.example/')), 'all from our own site');
  assert.equal(w.skipped(), 1);
  assert.ok(w.net.log.every((u) => u.startsWith('https://give.example/')), 'every request the worker made was to this site');
  const bad = worker();
  bad.net.status['css/base.css'] = 404;
  await assert.rejects(bad.run('install'), /addAll failed/);
  assert.equal(bad.skipped(), 0, 'a half-saved site does not take over');
});

test('activate removes the saved copies of older versions (only ours) and claims the open pages', async () => {
  const w = worker();
  w.caches.set('givespin-v0', new Map([['x', 1]]));
  w.caches.set(SW.CACHE, new Map());
  w.caches.set('someone-elses', new Map());
  await w.run('activate');
  assert.deepEqual([...w.caches.keys()].sort(), [SW.CACHE, 'someone-elses'].sort());
  assert.equal(w.claimed.length, 1);
});

test('a page opens from the network, is saved, and when the network is cut the saved copy opens instead; with no saved copy the offline page does', async () => {
  const w = worker();
  w.net.files['index.html'] = 'THE APP v1';
  // not saved yet, network cut: the offline page, which is saved at install
  await w.run('install');
  w.caches.get(SW.CACHE).delete('https://give.example/index.html');
  w.net.up = false;
  let r = await w.fetchEvent('https://give.example/index.html', 'navigate');
  assert.ok(r.handled && r.response.body === 'file:offline.html', 'the offline page: ' + JSON.stringify(r.response.body));
  // online: the live copy, and it is kept
  w.net.up = true; w.net.files['index.html'] = 'THE APP v2';
  r = await w.fetchEvent('https://give.example/?fast=1', 'navigate');
  assert.equal(r.response.body, 'THE APP v2');
  await new Promise((res) => setImmediate(res));
  assert.equal(w.caches.get(SW.CACHE).get('https://give.example/index.html').body, 'THE APP v2', 'saved under the one app key, whatever the address or query');
  // cut again: the saved copy of the app, for any way of opening it
  w.net.up = false;
  for (const u of ['https://give.example/', 'https://give.example/index.html', 'https://give.example/?fast=1#live']) {
    r = await w.fetchEvent(u, 'navigate');
    assert.equal(r.response.body, 'THE APP v2', u);
  }
  // a page that is not the app (a folder of ours) is not kept, and offline it gets the offline page
  w.net.up = true; w.net.files['docs/'] = 'A DOCS PAGE';
  await w.fetchEvent('https://give.example/docs/', 'navigate');
  await new Promise((res) => setImmediate(res));
  assert.ok(![...w.caches.get(SW.CACHE).keys()].some((k) => /\/docs\//.test(k)), 'other pages are not kept');
});

test('code is network first (a new deploy is never hidden behind an old copy); pictures are saved copy first; another site is never touched', async () => {
  const w = worker();
  await w.run('install');
  w.net.files['js/app.js'] = 'NEW CODE';
  let r = await w.fetchEvent('https://give.example/js/app.js', 'no-cors');
  assert.equal(r.response.body, 'NEW CODE', 'the saved copy (from install) did not win over the network');
  await new Promise((res) => setImmediate(res));
  w.net.up = false;
  r = await w.fetchEvent('https://give.example/js/app.js?v=3', 'no-cors');
  assert.equal(r.response.body, 'NEW CODE', 'offline: the last copy that was fetched');
  r = await w.fetchEvent('https://give.example/js/never-saved.js', 'no-cors');
  assert.ok(r.response.isError, 'offline and not saved: an error, not a made-up file');
  // pictures: the saved copy first, no network needed
  w.net.up = true;
  const before = w.net.log.length;
  r = await w.fetchEvent('https://give.example/assets/favicon.svg', 'no-cors');
  assert.equal(r.response.body, 'file:assets/favicon.svg');
  assert.equal(w.net.log.length, before, 'served from the saved copy: no request');
  // a picture not saved yet: fetched once, then kept
  r = await w.fetchEvent('https://give.example/assets/logos/aa.png', 'no-cors');
  await new Promise((res) => setImmediate(res));
  w.net.up = false;
  r = await w.fetchEvent('https://give.example/assets/logos/aa.png', 'no-cors');
  assert.equal(r.response.body, 'file:assets/logos/aa.png');
  // another site, a POST: the worker does not answer them at all
  for (const [u, mode] of [['https://fonts.gstatic.com/x.woff2', 'cors'], ['https://give.example.other/x.js', 'no-cors']]) {
    const e = await w.fetchEvent(u, mode);
    assert.equal(e.handled, false, u);
  }
  assert.ok(![...w.caches.get(SW.CACHE).keys()].some((k) => !k.startsWith('https://give.example/')), 'nothing from another site is ever saved');
  // an error answer is not saved over a good copy
  w.net.up = true; w.net.status['js/app.js'] = 500;
  await w.fetchEvent('https://give.example/js/app.js', 'no-cors');
  await new Promise((res) => setImmediate(res));
  assert.equal(w.caches.get(SW.CACHE).get('https://give.example/js/app.js').body, 'NEW CODE');
});

test('the offline page is friendly, in voice, and stands on its own (no other file, no other site)', () => {
  const off = read('offline.html');
  assert.ok(/<html lang="en">/.test(off) && /name="viewport"/.test(off) && /<title>[^<]+<\/title>/.test(off));
  assert.ok(off.includes('You are offline.') && off.includes('The house is still a charity.'));
  assert.ok(/<h1>[^<]+<\/h1>/.test(off) && (off.match(/<h1>/g) || []).length === 1);
  const refs = [...off.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(refs.every((r) => !/^(?:https?:)?\/\//.test(r)), 'no other site: ' + refs.join(' '));
  assert.ok(!/<script/i.test(off), 'no script');
  assert.ok(/nothing was charged/i.test(off));
});

test('no network code in the worker or the install file beyond the saved-copy logic: no sockets, beacons or other sites', () => {
  ['sw.js', 'js/ui/install.js', 'js/appkit.js', 'js/transport.js', 'js/ui/makereal.js'].forEach((f) => {
    const src = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
    assert.ok(!/XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts|\.postMessage/.test(src), f + ' has network code');
    assert.ok(!/https?:\/\/(?!www\.w3\.org)/.test(src.replace(/'https?:\/\/'|https:\/\//g, '')), f + ' mentions another address');
  });
  assert.equal((read('sw.js').match(/\bfetch\(/g) || []).length >= 2, true);
  const install = read('js/ui/install.js');
  assert.ok(!/\bfetch\(/.test(install), 'the install file makes no request of its own');
  assert.ok(/register\('sw\.js'/.test(install));
});

/* ----------------------------------------------------------------------- js/appkit.js */

test('swAllowed: only https, or http on this computer; never file:; "?nosw=1" removes it; automation is left alone unless "?sw=on"', () => {
  const ok = (protocol, hostname, search, nav) => K.swAllowed({ protocol, hostname, search: search || '' }, nav || {});
  assert.equal(ok('https:', 'give.example').ok, true);
  assert.equal(ok('http:', 'localhost').ok, true);
  assert.equal(ok('http:', '127.0.0.1').ok, true);
  assert.equal(ok('http:', '[::1]').ok, true);
  assert.equal(ok('http:', 'give.example').reason, 'insecure');
  assert.equal(ok('http:', '127.0.0.1.evil.test').reason, 'insecure', 'a look-alike host name is not this computer');
  assert.equal(ok('http:', 'localhost.evil.test').reason, 'insecure');
  assert.equal(ok('file:', '').reason, 'file');
  assert.equal(ok('ftp:', 'x').ok, false);
  assert.equal(ok('about:', '').ok, false);
  // the escape hatch wins over everything, and asks for the worker to be removed
  ['?nosw=1', '?nosw', '?fast=1&nosw=1', '?nosw=true&x=1', '?x=1&nosw=1#live'].forEach((q) => {
    const v = ok('https:', 'give.example', q);
    assert.deepEqual([v.ok, v.reason, v.unregister], [false, 'nosw', true], q);
  });
  ['?nosw=0', '?noswx=1', '?xnosw=1', ''].forEach((q) => assert.equal(ok('https:', 'give.example', q).ok, true, q));
  assert.equal(ok('file:', '', '?nosw=1').reason, 'nosw');
  // automation
  assert.equal(ok('http:', '127.0.0.1', '', { webdriver: true }).reason, 'automation');
  assert.equal(ok('http:', '127.0.0.1', '?sw=on', { webdriver: true }).ok, true);
  assert.equal(ok('http:', '127.0.0.1', '?sw=0', { webdriver: true }).reason, 'automation');
  assert.equal(ok('https:', 'give.example', '', { webdriver: false }).ok, true);
  // a browser with no service worker support
  assert.equal(ok('https:', 'give.example', '', { serviceWorker: false }).reason, 'unsupported');
  assert.doesNotThrow(() => K.swAllowed(undefined, undefined));
  assert.equal(K.swAllowed(undefined, undefined).ok, false);
});

test('isIosSafari: Safari on an iPhone or iPad only (also an iPad that says it is a Mac); other browsers and other systems are not', () => {
  const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
  const IPAD_AS_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
  const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.52 Mobile/15E148 Safari/604.1';
  const IPHONE_FIREFOX = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/124.0 Mobile/15E148 Safari/605.1.15';
  const IPHONE_EDGE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/123.0 Mobile/15E148 Safari/605.1.15';
  const IPHONE_APP = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
  const MAC_SAFARI = IPAD_AS_MAC;
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36';
  const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';
  assert.equal(K.isIosSafari(IPHONE_SAFARI, 'iPhone', 5), true);
  assert.equal(K.isIosSafari(IPAD_AS_MAC, 'MacIntel', 5), true, 'an iPad that says it is a Mac');
  assert.equal(K.isIosSafari(MAC_SAFARI, 'MacIntel', 0), false, 'a real Mac has no touch screen');
  assert.equal(K.isIosSafari(MAC_SAFARI, 'MacIntel', 1), false);
  assert.equal(K.isIosSafari(IPHONE_CHROME, 'iPhone', 5), false);
  assert.equal(K.isIosSafari(IPHONE_FIREFOX, 'iPhone', 5), false);
  assert.equal(K.isIosSafari(IPHONE_EDGE, 'iPhone', 5), false);
  assert.equal(K.isIosSafari(IPHONE_APP, 'iPhone', 5), false, 'a web view inside another app');
  assert.equal(K.isIosSafari(ANDROID, 'Linux armv8l', 5), false);
  assert.equal(K.isIosSafari(WINDOWS, 'Win32', 0), false);
  assert.equal(K.isIosSafari('', '', 0), false);
  assert.equal(K.isIosSafari(undefined, undefined, undefined), false);
});

/** The real js/live.js on a pretend page, for its real featured-event rules (eventAt). */
function eventAt() {
  const sandbox = { console, Date, Promise, setTimeout, clearTimeout };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  ['core.js', 'config.js', 'data.js'].forEach((f) => vm.runInContext(read('js/' + f), sandbox, { filename: f }));
  sandbox.GS.bus = { emit() {}, on() {} };
  sandbox.GS.payments = { mode: () => 'demo' };
  sandbox.GS.store = {}; sandbox.GS.fair = {}; sandbox.GS.games = {};
  vm.runInContext(read('js/live.js'), sandbox, { filename: 'live.js' });
  return sandbox.GS.live.eventAt;
}
const at = (y, mo, d, h, mi) => new Date(y, mo - 1, d, h, mi || 0).getTime();
const R = K.reminders;

test('reminders: the saved settings are read strictly (off unless a literal true, the lead one of 1, 2, 5 or 10 minutes)', () => {
  assert.deepEqual(R.normSettings(undefined), { on: false, lead: 2 });
  assert.deepEqual(R.normSettings(null), { on: false, lead: 2 });
  assert.deepEqual(R.normSettings('yes'), { on: false, lead: 2 });
  assert.deepEqual(R.normSettings([true]), { on: false, lead: 2 });
  assert.deepEqual(R.normSettings({ on: 'true', lead: 5 }), { on: false, lead: 5 }, '"true" the string is not on');
  assert.deepEqual(R.normSettings({ on: 1 }), { on: false, lead: 2 });
  assert.deepEqual(R.normSettings({ on: true }), { on: true, lead: 2 });
  assert.deepEqual(R.normSettings({ on: true, lead: 10 }), { on: true, lead: 10 });
  assert.deepEqual(R.normSettings({ on: true, lead: 3 }), { on: true, lead: 2 }, 'an odd lead falls back');
  assert.deepEqual(R.normSettings({ on: true, lead: '5' }), { on: true, lead: 2 });
  assert.deepEqual(R.normSettings({ on: true, lead: -1 }), { on: true, lead: 2 });
});

test('reminders against the real events: the next start, the minute to remind at, and an event too close to remind about is skipped', () => {
  const ev = eventAt();
  // Wednesday 4 Nov 2026: no Giving Tuesday; a Double Pot Hour at the top of every hour before 6 pm; Disaster Relief Night from 6 pm
  assert.equal(new Date(at(2026, 11, 4, 13, 30)).getDay(), 3, 'the test date is a Wednesday');
  let n = R.nextStart(ev, at(2026, 11, 4, 13, 30));
  assert.deepEqual([n.event.id, n.at], ['double', at(2026, 11, 4, 14, 0)]);
  n = R.nextStart(ev, at(2026, 11, 4, 14, 5));            // inside a Double Pot Hour: the next one is an hour on
  assert.deepEqual([n.event.id, n.at], ['double', at(2026, 11, 4, 15, 0)]);
  n = R.nextStart(ev, at(2026, 11, 4, 17, 30));
  assert.deepEqual([n.event.id, n.at], ['relief', at(2026, 11, 4, 18, 0)]);
  n = R.nextStart(ev, at(2026, 11, 4, 20, 0));            // relief runs to midnight, then the early-morning Double Pot Hour
  assert.deepEqual([n.event.id, n.at], ['double', at(2026, 11, 5, 0, 0)]);
  n = R.nextStart(ev, at(2026, 11, 2, 23, 30));           // Monday night (relief) into Giving Tuesday
  assert.deepEqual([n.event.id, n.at], ['tuesday', at(2026, 11, 3, 0, 0)]);
  n = R.nextStart(ev, at(2026, 11, 3, 12, 0));            // all of Tuesday is one event: the next start is Wednesday's first hour
  assert.deepEqual([n.event.id, n.at], ['double', at(2026, 11, 4, 0, 0)]);
  n = R.nextStart(ev, at(2026, 11, 4, 13, 59));
  assert.equal(n.at, at(2026, 11, 4, 14, 0), 'a minute before it starts');
  assert.equal(R.nextStart(ev, at(2026, 11, 4, 14, 0)).at, at(2026, 11, 4, 15, 0), 'strictly after: at the start itself it is the one after');

  // plan: 2 minutes before 14:00 is 13:58
  let p = R.plan(ev, at(2026, 11, 4, 13, 30), 2);
  assert.deepEqual([p.event.name, p.startAt, p.fireAt, p.lead], ['Double Pot Hour', at(2026, 11, 4, 14, 0), at(2026, 11, 4, 13, 58), 2]);
  p = R.plan(ev, at(2026, 11, 4, 13, 58), 2);              // the reminder moment has just come: not late, the next event instead
  assert.equal(p.startAt, at(2026, 11, 4, 15, 0));
  p = R.plan(ev, at(2026, 11, 4, 13, 59), 2);
  assert.equal(p.startAt, at(2026, 11, 4, 15, 0), 'too late to remind about 14:00');
  p = R.plan(ev, at(2026, 11, 4, 13, 59), 1);              // a one-minute lead still has a second to spare... but not a whole minute
  assert.equal(p.startAt, at(2026, 11, 4, 15, 0));
  p = R.plan(ev, at(2026, 11, 4, 13, 58, 0) - 1000, 1);
  assert.equal(p.startAt, at(2026, 11, 4, 14, 0));
  p = R.plan(ev, at(2026, 11, 4, 13, 30), 10);
  assert.equal(p.fireAt, at(2026, 11, 4, 13, 50));
  p = R.plan(ev, at(2026, 11, 4, 13, 30), 7);              // an odd lead is the default of 2
  assert.equal(p.lead, 2);
  // never in the past, whatever the time
  for (let i = 0; i < 400; i++) {
    const now = at(2026, 11, 1, 0, 0) + i * 7 * 60000 + 13000;
    const q = R.plan(ev, now, 2);
    assert.ok(q && q.fireAt > now && q.startAt === q.fireAt + 120000, 'now ' + new Date(now).toString());
  }
  // no events at all: nothing to remind about
  assert.equal(R.nextStart(() => null, at(2026, 11, 4, 13, 30)), null);
  assert.equal(R.plan(() => null, at(2026, 11, 4, 13, 30), 2), null);
});

test('reminder wording: plain, says the tables are simulated and the money is pretend, and uses the singular for one minute', () => {
  const m2 = R.message({ id: 'double', name: 'Double Pot Hour' }, 2);
  assert.equal(m2.title, 'Double Pot Hour starts in 2 minutes');
  assert.ok(/simulated/.test(m2.body) && /pretend/.test(m2.body) && !/win|prize|payout/i.test(m2.body), m2.body);
  assert.equal(m2.tag, 'givespin-event-double');
  assert.equal(R.message({ id: 'relief', name: 'Disaster Relief Night' }, 1).title, 'Disaster Relief Night starts in 1 minute');
  assert.equal(R.message({ id: 'x', name: 'X' }, 99).title, 'X starts in 2 minutes');
});
