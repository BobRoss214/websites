// order: 191
// browser: yes
// covers: js/tour.js, css/tour.css, *.html, pages/*
/* The tour is OFF on the real site, and with it off NOTHING may change on any page (docs/TOUR.md). Every page that loads js/tour.js is checked: the 6 pages, and the
 * three pretend-account pages when they exist. Tour mode is on only with window.WA_TOUR === true, ?tour, or an address ending in #tour.
 *   1. (no browser) every page loads js/tour.js once, as the last script; the part of js/tour.js before its "mode is off, stop here" line uses no storage, no cookie,
 *      no page-building call and no listener (so the flag is read without touching storage), and `?tourist`, `#tours` and the like are not tour mode.
 *   2. (browser) with the mode off: window.WA_TOUR_MODE() is false, no tour button, no tour box, no tour style sheet, no steps file asked for, nothing written
 *      to localStorage / sessionStorage / cookies, no element or listener made by js/tour.js (its calls are caught by looking at which script is running), and the
 *      page is IDENTICAL to the same page with js/tour.js replaced by an empty file: the same page text and markup, the same files asked for, the same
 *      size, and one new global name (WA_TOUR_MODE) and nothing else.
 *   The spies are tried first on a page that has the mode on (`?tour`): they must see js/tour.js work there, or they would prove nothing. */
import fs from 'node:fs';
import path from 'node:path';
import { run, open, ok, info, settled, ROOT } from './lib.mjs';

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const PAGES = ['index', 'first-visit', 'pumpkin-patch', 'strawberry-picking', 'school-field-trips', 'wise-pie']
  .concat(['account', 'farm-desk', 'kitchen'].filter((p) => fs.existsSync(path.join(ROOT, p + '.html'))));   // the pretend-account pages, once they exist

/* ---------------------------------------------------------------- 1. what the files say (no browser) */
const TAG = '<script src="js/tour.js"></script>';
for (const pg of PAGES) {
  const html = read(pg + '.html');
  const tags = [...html.matchAll(/<script src="js\/([a-z0-9-]+\.js)"><\/script>/g)].map((m) => m[1]);
  ok(`${pg}: js/tour.js is loaded once, as the last script of the page`, html.split(TAG).length === 2 && tags[tags.length - 1] === 'tour.js', tags.join(' '));
}
const src = read('js/tour.js');
const cut = src.indexOf('if (!tourMode()) return;');
ok('js/tour.js stops at "if (!tourMode()) return;" (the line that ends the work when the mode is off)', cut > 0, String(cut));
const before = src.slice(0, cut).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');   // without the comments
const forbidden = ['localStorage', 'sessionStorage', 'document.cookie', 'cookieStore', 'indexedDB', 'createElement', 'appendChild', 'insertBefore', 'append(', 'innerHTML', 'addEventListener', 'setTimeout', 'requestAnimationFrame', 'fetch(', 'XMLHttpRequest', 'classList', 'setAttribute'];
const found = forbidden.filter((w) => before.includes(w));
ok('the part of js/tour.js that runs when the mode is off uses no storage, cookie, element, listener, timer or request', found.length === 0, found.join(', '));
ok('(tried on a bad sample first) the same check does find a storage word', ['localStorage'].filter((w) => 'const x = localStorage.getItem("a");'.includes(w)).length === 1);
const prefixLines = before.split('\n').filter((l) => l.trim()).length;
info(`the code that runs with the mode off: ${prefixLines} lines`);

/* The same words, read by the page's own rule (a copy of tourMode()): what turns the mode on and what must not */
const modeOf = (search, hash) => /(?:^|[?&])tour(?:[=&]|$)/.test(search) || hash === '#tour';
ok('the address rule: ?tour, ?tour=1, ?a=1&tour and #tour turn it on; ?tourist, ?retour, ?a=tour, #tours and #tour-x do not',
  modeOf('?tour', '') && modeOf('?tour=1', '') && modeOf('?a=1&tour', '') && modeOf('', '#tour') && !modeOf('?tourist', '') && !modeOf('?retour', '') && !modeOf('?a=tour', '') && !modeOf('', '#tours') && !modeOf('', '#tour-x'));
ok('the copy of the address rule in this test is the one in js/tour.js', src.includes('/(?:^|[?&])tour(?:[=&]|$)/.test(win.location.search)') && src.includes("win.location.hash === '#tour'"));

/* ---------------------------------------------------------------- 2. what the browser sees */
// Runs before any script of the page. It notes a call that is made WHILE js/tour.js is the running script (document.currentScript): storage, cookies, page building,
// listeners, timers, requests. Only the first run of a script (the part that is not in a callback) can be seen, which is all the mode-off code ever has.
const SPY = `(() => {
  const log = (window.__tourCalls = []);
  const mine = () => { const s = document.currentScript; return !!(s && /\\/js\\/tour\\.js/.test(s.src)); };
  const wrap = (obj, name, label) => { const orig = obj && obj[name]; if (typeof orig !== 'function') return; obj[name] = function () { if (mine()) log.push(label || name); return orig.apply(this, arguments); }; };
  ['getItem', 'setItem', 'removeItem', 'clear', 'key'].forEach((n) => wrap(Storage.prototype, n, 'storage.' + n));
  ['createElement', 'createElementNS', 'createTextNode', 'write', 'writeln'].forEach((n) => wrap(Document.prototype, n, 'document.' + n));
  ['appendChild', 'insertBefore', 'replaceChild', 'removeChild'].forEach((n) => wrap(Node.prototype, n, 'node.' + n));
  ['append', 'prepend', 'after', 'before', 'remove', 'setAttribute', 'removeAttribute', 'insertAdjacentHTML', 'insertAdjacentElement'].forEach((n) => wrap(Element.prototype, n, 'element.' + n));
  wrap(EventTarget.prototype, 'addEventListener', 'addEventListener');
  ['fetch', 'setTimeout', 'setInterval', 'requestAnimationFrame'].forEach((n) => wrap(window, n, n));
  wrap(XMLHttpRequest.prototype, 'open', 'xhr.open');
  const ck = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
  if (ck && ck.configurable) Object.defineProperty(Document.prototype, 'cookie', { configurable: true, get() { if (mine()) log.push('cookie read'); return ck.get.call(this); }, set(v) { if (mine()) log.push('cookie write'); return ck.set.call(this, v); } });
  ['localStorage', 'sessionStorage'].forEach((k) => { const d = Object.getOwnPropertyDescriptor(window, k); if (d && d.get && d.configurable) Object.defineProperty(window, k, { configurable: true, get() { if (mine()) log.push(k + ' touched'); return d.get.call(this); } }); });
  window.__globalsAtStart = Object.getOwnPropertyNames(window);
})();`;

const mask = (html) => html.replace(/(data-k="s"><b>)\d+(<\/b>)/g, '$1#$2');   // the pizza countdown's seconds tick in real time: they are the one thing that differs between two loads of the same page

// Loads a page and says what is on it. `empty`: js/tour.js is replaced by an empty script (the page as if the tag were not there).
async function look(browser, base, errs, pg, o = {}) {
  const asked = [];
  const p = await open(browser, base, pg + '.html', errs, {
    viewport: o.viewport, query: o.query, time: undefined,
    routes: async (page) => {
      await page.addInitScript(SPY);
      page.on('request', (r) => asked.push(new URL(r.url()).pathname));
      if (o.empty) await page.route('**/js/tour.js', (r) => r.fulfill({ contentType: 'text/javascript', body: '' }));
    },
  });
  await settled(p, 1500);
  const s = await p.evaluate(() => ({
    mode: typeof window.WA_TOUR_MODE === 'function' ? window.WA_TOUR_MODE() : 'missing',
    calls: window.__tourCalls.slice(),
    html: document.documentElement.outerHTML,
    globals: Object.getOwnPropertyNames(window).filter((n) => window.__globalsAtStart.indexOf(n) < 0),
    sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight,
    pill: !!document.querySelector('#wa-tour-pill, .wa-tour-pill'), box: !!document.querySelector('#wa-tour, .wa-tour, [class*="wa-tour"], [id^="wa-tour"]'),
    sheets: [...document.styleSheets].map((x) => x.href || '').filter((h) => /tour/.test(h)).length, links: document.querySelectorAll('link[href*="tour"], script[src*="tour-steps"]').length,
    tourObject: !!(window.WISE_ACRES && window.WISE_ACRES.tour),
    ls: Object.keys(localStorage).filter((k) => /tour/.test(k)), ss: Object.keys(sessionStorage).filter((k) => /tour/.test(k)), cookie: document.cookie,
  }));
  await p.context().close();
  return { ...s, html: mask(s.html), asked: [...new Set(asked)].sort() };
}

await run('tour-off', async ({ browser, base, errs }) => {
  // the spy first: on a page with the mode ON it must see js/tour.js work (a page, a style sheet and storage)
  const on = await look(browser, base, errs, 'index', { query: 'tour' });
  const kinds = new Set(on.calls);
  ok('(tried first on a page with the mode on) the spies see js/tour.js build the button, listen, and touch storage',
    on.mode === true && kinds.has('document.createElement') && kinds.has('node.appendChild') && kinds.has('addEventListener') && [...kinds].some((k) => /Storage touched/i.test(k) || /storage/.test(k)), [...kinds].join(', '));
  ok('(tried first on a page with the mode on) the page does get a tour button, and asks for css/tour.css', on.pill && on.asked.some((u) => /\/css\/tour\.css$/.test(u)), `pill ${on.pill}, asked ${on.asked.filter((u) => /tour/.test(u)).join(' ')}`);
  info('with ?tour, js/tour.js made these calls while it first ran: ' + [...kinds].join(', '));

  for (const pg of PAGES) {
    const normal = await look(browser, base, errs, pg);
    const empty = await look(browser, base, errs, pg, { empty: true });
    ok(`${pg}: tour mode is off (window.WA_TOUR_MODE() is false)`, normal.mode === false, String(normal.mode));
    ok(`${pg}: js/tour.js made no call to storage, cookies, page building, listeners, timers or requests`, normal.calls.length === 0, normal.calls.join(', '));
    ok(`${pg}: no tour button, no tour box, no tour style sheet or steps file in the page, no tour object`, !normal.pill && !normal.box && normal.sheets === 0 && normal.links === 0 && !normal.tourObject, JSON.stringify({ pill: normal.pill, box: normal.box, sheets: normal.sheets, links: normal.links, obj: normal.tourObject }));
    ok(`${pg}: css/tour.css and the steps files are never asked for`, !normal.asked.some((u) => /tour\.css|tour-steps/.test(u)), normal.asked.filter((u) => /tour/.test(u)).join(' '));
    ok(`${pg}: nothing of the tour in localStorage, sessionStorage or cookies`, normal.ls.length === 0 && normal.ss.length === 0 && !/tour/.test(normal.cookie), JSON.stringify({ ls: normal.ls, ss: normal.ss, cookie: normal.cookie }));
    ok(`${pg}: the page is identical to the same page with an empty js/tour.js (same markup and text: ${normal.html.length} characters)`, normal.html === empty.html,
      normal.html === empty.html ? '' : `lengths ${normal.html.length} and ${empty.html.length}; first difference at ${[...normal.html].findIndex((c, i) => c !== empty.html[i])}`);
    ok(`${pg}: the same size on screen (${normal.sw} x ${normal.sh}) and the same files asked for as with an empty js/tour.js`, normal.sw === empty.sw && normal.sh === empty.sh && normal.asked.join() === empty.asked.join(),
      `${normal.sw}x${normal.sh} against ${empty.sw}x${empty.sh}; only in one: ${normal.asked.filter((u) => !empty.asked.includes(u)).concat(empty.asked.filter((u) => !normal.asked.includes(u))).join(' ')}`);
    ok(`${pg}: the only new global name is WA_TOUR_MODE`, normal.globals.filter((g) => !empty.globals.includes(g)).join() === 'WA_TOUR_MODE' && empty.globals.filter((g) => !normal.globals.includes(g)).length === 0,
      normal.globals.filter((g) => !empty.globals.includes(g)).join());
  }

  // the same on a phone, for the two pages with the most in them
  for (const pg of ['index', 'first-visit']) {
    const viewport = { width: 390, height: 844 };
    const normal = await look(browser, base, errs, pg, { viewport });
    const empty = await look(browser, base, errs, pg, { viewport, empty: true });
    ok(`${pg}, phone: no tour button or box, and the page is identical to the same page with an empty js/tour.js`, !normal.pill && !normal.box && normal.html === empty.html && normal.sw === empty.sw && normal.sh === empty.sh && normal.calls.length === 0, `${normal.html.length}/${empty.html.length} chars, ${normal.sw}x${normal.sh} / ${empty.sw}x${empty.sh}, calls ${normal.calls.join()}`);
  }

  // addresses that look like the switch but are not
  for (const [query, why] of [['tourist', '?tourist'], ['retour=1', '?retour=1'], ['x=tour', '?x=tour']]) {
    const r = await look(browser, base, errs, 'first-visit', { query });
    ok(`an address with ${why} does not turn the tour on`, r.mode === false && !r.pill && r.calls.length === 0, `mode ${r.mode}`);
  }
  // a stored place from an earlier tour does nothing when the mode is off: not even a look at it
  {
    const stored = { id: 't1', ch: 1, run: 1, go: Date.now() };
    const asked = [];
    const p = await open(browser, base, 'first-visit.html', errs, { routes: async (page) => {
      await page.addInitScript(SPY);
      await page.addInitScript((v) => { try { sessionStorage.setItem('wa-tour', JSON.stringify(v)); localStorage.setItem('wa-tour', JSON.stringify(v)); } catch (e) { /* blocked */ } }, stored);
      page.on('request', (r) => asked.push(new URL(r.url()).pathname));
    } });
    await settled(p, 1200);
    const s = await p.evaluate(() => ({ calls: window.__tourCalls.slice(), pill: !!document.querySelector('.wa-tour-pill, #wa-tour'), ss: sessionStorage.getItem('wa-tour'), ls: localStorage.getItem('wa-tour') }));
    ok('a place left by an earlier tour is ignored when the mode is off: nothing shows, nothing is asked for, the stored text is untouched', !s.pill && s.calls.length === 0 && !asked.some((u) => /tour\.css|tour-steps/.test(u)) && s.ss === JSON.stringify(stored) && s.ls === JSON.stringify(stored), JSON.stringify(s));
    await p.context().close();
  }
});
