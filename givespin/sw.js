/*
 * GiveSpin's service worker: it keeps a copy of the site on the device so the app opens with no network, and shows a friendly page if it cannot.
 * It is only ever registered from js/ui/install.js, on https or localhost, never from file:. It makes no request to any other site and caches nothing
 * from one. There is no push server and nothing is sent from here.
 *
 *   - install    saves the files in PRECACHE (the site's own files, below) in one go; if any one cannot be fetched, nothing is saved and it tries again next visit
 *   - pages      (opening or reloading the site) network first, so a new version is seen at once; with no network, the saved copy of the page, else offline.html
 *   - code       (js, css, html, json, the manifest) network first too, so a deploy can never be hidden behind an old copy; the saved copy only when the network fails
 *   - pictures   (anything else of ours: logos, icons, fonts) the saved copy first, fetched once and kept
 *
 * Change VERSION whenever you want every device to throw its saved copy away. PRECACHE must match index.html: tests/pwa.test.js fails if a script, style
 * sheet or icon is added or removed there without the same change here, and prints the list to paste.
 */
'use strict';

var VERSION = 'v1';
var CACHE = 'givespin-' + VERSION;
var INDEX = 'index.html';
var OFFLINE = 'offline.html';
var PRECACHE = [
  'index.html',
  'offline.html',
  'manifest.webmanifest',
  'assets/favicon.svg',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
  'assets/icons/badge-96.png',
  'assets/fonts/sora-latin-wght-normal.woff2',
  'assets/fonts/inter-latin-wght-normal.woff2',
  'css/base.css',
  'css/shell.css',
  'css/views.css',
  'css/dialogs.css',
  'css/games.css',
  'css/live.css',
  'css/chooser.css',
  'css/slots.css',
  'css/tour.css',
  'css/ranks.css',
  'css/rankui.css',
  'css/ticker.css',
  'css/sharecard.css',
  'css/profile.css',
  'css/quests.css',
  'css/boards.css',
  'css/stream.css',
  'css/app.css',
  'css/voice.css',
  'css/fit.css',
  'css/walk.css',
  'js/icons.js',
  'js/core.js',
  'js/ranks.js',
  'js/fair.js',
  'js/config.js',
  'js/data.js',
  'js/logos.js',
  'js/marks.js',
  'js/util.js',
  'js/local.js',
  'js/share.js',
  'js/kit.js',
  'js/store.js',
  'js/audio.js',
  'js/confetti.js',
  'js/payments.js',
  'js/accounts.js',
  'js/crews.js',
  'js/live.js',
  'js/weekly.js',
  'js/ticker.js',
  'js/quests.js',
  'js/boards.js',
  'js/transport.js',
  'js/streamlib.js',
  'js/appkit.js',
  'js/profile.js',
  'js/art.js',
  'js/ui/common.js',
  'js/ui/rankui.js',
  'js/ui/voice.js',
  'js/ui/amount.js',
  'js/ui/opts.js',
  'js/games/wheel.js',
  'js/games/slots.js',
  'js/games/drop.js',
  'js/games/plinko.js',
  'js/games/roulette.js',
  'js/games/scratch.js',
  'js/games/cards.js',
  'js/games/dice.js',
  'js/games/coin.js',
  'js/games/derby.js',
  'js/games/crowd.js',
  'js/games/duck.js',
  'js/games/marble.js',
  'js/games/marble-map-zigzag.js',
  'js/games/marble-map-spiral.js',
  'js/games/marble-map-garden.js',
  'js/games/marble-map-pinch.js',
  'js/games/marble-map-river.js',
  'js/games/balloon.js',
  'js/games/standing.js',
  'js/games/lotto.js',
  'js/ui/filters.js',
  'js/ui/charity.js',
  'js/ui/account.js',
  'js/ui/picker.js',
  'js/ui/chooser.js',
  'js/ui/receipt.js',
  'js/ui/live.js',
  'js/ui/variants.js',
  'js/ui/game.js',
  'js/ui/lobby.js',
  'js/ui/pages.js',
  'js/ui/collection.js',
  'js/ui/leagues.js',
  'js/ui/ticker.js',
  'js/ui/spotlight.js',
  'js/ui/sharecard.js',
  'js/ui/fairshow.js',
  'js/ui/profile.js',
  'js/ui/quests.js',
  'js/ui/boards.js',
  'js/ui/stream.js',
  'js/ui/makereal.js',
  'js/ui/install.js',
  'js/ui/tour.js',
  'js/app.js'
];

/**
 * What to do with a request: 'skip' (leave it to the browser: another site, not a GET, a range request), 'page' (opening the site), 'code' (a script, style
 * sheet, page or data file of ours) or 'asset' (a picture or font of ours). `req` needs url, method, mode and (optionally) headers.get; `origin` is this site's.
 */
function classify(req, origin) {
  var url;
  try { url = new URL(req.url); } catch (e) { return 'skip'; }
  if (req.method !== 'GET') { return 'skip'; }
  if (url.origin !== origin || (url.protocol !== 'https:' && url.protocol !== 'http:')) { return 'skip'; }   // never touch, never keep, anything from another site
  if (req.headers && typeof req.headers.get === 'function' && req.headers.get('range')) { return 'skip'; }
  if (req.mode === 'navigate') { return 'page'; }
  if (/\.(?:js|mjs|css|html|json|webmanifest|md)$/i.test(url.pathname)) { return 'code'; }
  return 'asset';
}

/**
 * The key a page is kept under, or '' when it is not the app's own page. The site is one page, so every way of opening it (the folder, /index.html, with a
 * query) is the same saved copy; any other page under the same address (a docs folder, say) is not kept. `scope` is the worker's scope (an address ending in /).
 */
function pageKey(url, scope) {
  var base = new URL('./', scope).pathname;
  return url.origin === new URL(scope).origin && (url.pathname === base || url.pathname === base + INDEX) ? INDEX : '';
}

/** Only a plain, successful answer from this site is kept (not an error, a partial answer or a redirect: a redirected answer cannot be used for opening a page). */
function canKeep(res) { return !!res && res.status === 200 && res.type === 'basic' && !res.redirected; }

function putCopy(key, res) {
  if (!key || !canKeep(res)) { return; }
  var copy = res.clone();
  caches.open(CACHE).then(function (c) { return c.put(key, copy); }).catch(function () { /* storage full or blocked: carry on without it */ });
}

/** Network first. For a page, when the network fails: the saved copy of the app, else the offline page. For code: the saved copy, else an error. */
function networkFirst(req, isPage) {
  var key = isPage ? pageKey(new URL(req.url), self.registration.scope) : req;
  return fetch(req).then(function (res) {
    putCopy(key, res);
    return res;
  }).catch(function () {
    return (key ? caches.match(key, { ignoreSearch: true }) : Promise.resolve(undefined)).then(function (hit) {
      if (hit) { return hit; }
      if (isPage) { return caches.match(OFFLINE).then(function (off) { return off || Response.error(); }); }
      return Response.error();
    });
  });
}

/** Saved copy first (pictures and fonts do not change under the same name), fetched and kept the first time. */
function cacheFirst(req) {
  return caches.match(req).then(function (hit) {
    if (hit) { return hit; }
    return fetch(req).then(function (res) { putCopy(req, res); return res; });
  });
}

/* A plain script file can be loaded by Node for the tests; in the browser only the worker part below runs. */
if (typeof self !== 'undefined' && typeof self.addEventListener === 'function' && typeof caches !== 'undefined') {
  self.addEventListener('install', function (e) {
    e.waitUntil(
      caches.open(CACHE).then(function (c) {
        // 'reload' goes round the browser's own copy, so what is saved is what the server has now
        return c.addAll(PRECACHE.map(function (u) { return new Request(u, { cache: 'reload' }); }));
      }).then(function () { return self.skipWaiting(); })
    );
  });

  self.addEventListener('activate', function (e) {
    e.waitUntil(
      caches.keys().then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k.indexOf('givespin-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
      }).then(function () { return self.clients.claim(); })
    );
  });

  self.addEventListener('fetch', function (e) {
    var kind = classify(e.request, self.location.origin);
    if (kind === 'skip') { return; }
    e.respondWith(kind === 'asset' ? cacheFirst(e.request) : networkFirst(e.request, kind === 'page'));
  });

  // a reminder notification (js/ui/install.js shows it through this worker): tapping it brings the app forward, on the Live tables page
  self.addEventListener('notificationclick', function (e) {
    e.notification.close();
    var target = new URL('./#live', self.registration.scope).href;
    e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.indexOf(self.registration.scope) === 0 && 'focus' in list[i]) { return list[i].focus(); }
      }
      return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
    }));
  });
}

if (typeof module === 'object' && module.exports) {
  module.exports = { VERSION: VERSION, CACHE: CACHE, INDEX: INDEX, OFFLINE: OFFLINE, PRECACHE: PRECACHE, classify: classify, pageKey: pageKey, canKeep: canKeep };
}
