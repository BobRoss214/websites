// order: 326
// browser: yes
// quick: no
// covers: js/shop-pop.js, js/shop-pop-box.js, js/shop-sample.js, css/shop-pop.css, css/extras.css, index.html, tools/pages.py, lang/*, tests/shop-list.json
/* "What to buy": a card that opens a pop-up with the (pretend) ingredient list of the product, checked on the home page. The lists are PREVIEW DATA in js/shop-sample.js
 * ("SAMPLE DATA, NOT REAL"); without that file the whole feature is dormant. The page is the one the builder asked for: "when users hover over the little snacks or anything in the
 * what to buy section, it makes it a little larger and a bigger animation ... and also make it clickable. And when the users click it, there's a little pop-up box in the middle of
 * their screen, and it says all the ingredients of that product ... in big parentheses it says this is not the real ingredients, this is just a preview".
 *   1  DORMANT: with js/shop-sample.js refused, no card has a button, a class or a tabindex, nothing grows, nothing is asked for (no css/shop-pop.css), no console error, and the
 *      requests are the same as when js/shop-pop.js is refused too
 *   2  WITH DATA: every product card of groups 1-11 (and the beer, cider and wine group when the page has it) has one real button (type=button, named "<name>, <price>, show
 *      ingredients" in the page's language), the <li> stays a plain <li>; the farm visit group, the five older cards and a card with no list have none; the pizza bar's own links
 *      still win over the button
 *   3  HOVER at 1366, 1920, 1280, 1264 and 1024 px: the card grows 4 to 12 percent and rises above its neighbours, no corner of it is cut by a column or a group, it is not turned
 *      (the text stays upright and readable), and after the pointer leaves it is back at rest; with reduced motion, and with "Pause animations", nothing is scaled (shadow and edge
 *      still change); on a phone (touch) a tap leaves no card big
 *   4  CLICK: a pop-up in the middle of the window (1366x768 and 390x844, within 3 px), with the card's name, price and note, the BIG notice "(This is not the real ingredients.
 *      This is just a preview.)" (1.25 rem or more, bold, inside the box, in view without scrolling), and the list: every item is in the page's text
 *   5  KEYBOARD: Enter and Space open it; focus goes into the box; Tab and Shift+Tab stay inside; Escape closes it and focus goes back to the card; a click on the dim part closes
 *      it; the page behind does not scroll and does not slide sideways when the scroll bar goes; three different cards in a row show no stale content
 *   6  ACCESSIBILITY: axe with the pop-up open; role, aria-modal, name and description; the page behind is hidden from screen readers while it is open and as before after;
 *      contrast of the band, the notice and the chips in every group
 *   7  LANGUAGES (en, es, hi, zh, vi): the pop-up's own words and the notice in the page's language (no English left in them), the names in the list stay English; no sideways
 *      scroll and no cut text at 390 and 1366 px; a language change with the pop-up closed re-names the buttons
 *   8  DATA (no browser): js/shop-sample.js has an entry for every product of groups 1-11 (the old beer card is replaced by the beer group), none without a card, none empty, and
 *      none of the words the farm has not said (health claims, "vegan", "natural", "local", digits ...) unless the card's own words say it
 *   9  weight: the bytes of the new files (information); the pop-up's code (js/shop-pop-box.js) is asked for by the small js/shop-pop.js only when the sample lists are there
 * Names of the page's own parts are in the helper text below (SP): if the markup is renamed, change them there. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { run, open, ok, okSoon, info, until, settled, axeSource, ROOT } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIST = JSON.parse(fs.readFileSync(path.join(HERE, 'shop-list.json'), 'utf8'));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const HAS_SAMPLE = fs.existsSync(path.join(ROOT, 'js', 'shop-sample.js'));
const BEER = ['dales-light-lager', 'blood-orange-wheat', 'hop-drop', 'kei-truck', 'oktoberfest', 'three-c-ipa', 'planet-pulp-ipa', 'hoppy-amber', 'loyal-to-the-dream', 'shape-shifter-pumpkin-spice',
  'peach-crumble-cider', 'brambling-blackberry-cider', 'bev-pinot-grigio', 'glitz-bubbly-white', 'noblio-sauvignon-blanc', 'franciscan-cabernet'];   // the drinks of the chalkboard group (the old card "Beer, hard cider & wine" is replaced by them)
const NOTICE = '(This is not the real ingredients. This is just a preview.)';
const LANGS = ['en', 'es', 'hi', 'zh', 'vi'];
const DICT = Object.fromEntries(['es', 'hi', 'zh', 'vi'].map((c) => [c, JSON.parse(read(`lang/src/${c}.json`)).js]));
const REVEAL = '.reveal{opacity:1!important;transform:none!important;transition:none!important}html{scroll-behavior:auto!important}';
const DESKTOP = { width: 1366, height: 768 }, PHONE = { width: 390, height: 844 };
const near = (a, b, d) => Math.abs(a - b) <= d;
const ONLY = process.env.SHOPPOP_ONLY || '';   // for working on one part: SHOPPOP_ONLY=dormant,data,hover,keys,languages (nothing set: all of it)
const go = (part) => !ONLY || ONLY.split(',').includes(part);

/* ------------------------------------------------------------------ the page's own parts, and small helpers that run inside the page */
const SP = `window.__sp = {
  slug: (c) => { const u = c.querySelector('.shop-bubble use'), m = u && /#p-([a-z0-9-]+)$/.exec(u.getAttribute('href') || ''); return m ? m[1] : ''; },
  cards: () => [...document.querySelectorAll('#shop .shop-card')],
  bySlug: (s) => window.__sp.cards().find((c) => window.__sp.slug(c) === s) || null,
  box: (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }; },
  group: (c) => { const g = c.closest('.shop-group'); return g ? ((/\\bsg-[a-z0-9]+/.exec(g.className) || [''])[0]) : ''; },
  lum: (c) => { const [r, g, b] = c.match(/[\\d.]+/g).slice(0, 3).map((v) => { v = +v / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; },
  ratio: (a, b) => { const x = window.__sp.lum(a), y = window.__sp.lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); },
  txt: (s) => { const e = document.querySelector(s); return e ? e.textContent.replace(/\\s+/g, ' ').trim() : null; },
};`;
const prep = async (p, buttons = true) => { await p.addStyleTag({ content: REVEAL }); await p.evaluate(SP); if (buttons) await until(p, () => document.querySelectorAll('#shop .shop-open').length > 0, null, 30000); };   // the cards get their buttons once js/shop-pop.js has asked for the pop-up's code (the page's load waits for it)
const center = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
/** brings a card (by its picture name) to the middle of the window; returns its box at rest */
async function show(p, slug) {
  await p.evaluate((s) => window.__sp.bySlug(s).scrollIntoView({ block: 'center' }), slug);
  await p.mouse.move(2, 2);
  await settled(p, 0);
  return p.evaluate((s) => window.__sp.box(window.__sp.bySlug(s)), slug);
}
/** the point on a card's picture (never on a link of the card) */
const spot = (p, slug) => p.evaluate((s) => { const r = window.__sp.bySlug(s).querySelector('.shop-bubble').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, slug);
const isOpen = (p) => p.evaluate(() => !!document.querySelector('.shop-pop.is-open'));
async function openBy(p, slug) {   // a real click on the card's picture
  await show(p, slug);
  const at = await spot(p, slug);
  await p.mouse.click(at.x, at.y);
  return until(p, () => !!document.querySelector('.shop-pop.is-open'), null, 20000);
}
async function closeBy(p) { await p.keyboard.press('Escape'); return until(p, () => !document.querySelector('.shop-pop.is-open'), null, 10000); }
const popText = (p) => p.evaluate(() => ({
  name: window.__sp.txt('.shop-pop-name'), price: window.__sp.txt('.shop-pop-price'), note: document.querySelector('.shop-pop-note').hidden ? '' : window.__sp.txt('.shop-pop-note'),
  notice: window.__sp.txt('.shop-pop-pretend'), heading: window.__sp.txt('.shop-pop-h'), items: [...document.querySelectorAll('.shop-pop-list li')].map((li) => li.textContent),
  contains: document.querySelector('.shop-pop-contains').hidden ? '' : window.__sp.txt('.shop-pop-contains'), done: window.__sp.txt('.shop-pop-done'), x: document.querySelector('.shop-pop-x').getAttribute('aria-label'),
}));

/* ------------------------------------------------------------------ 8. DATA, and what the page has (no browser) */
const sample = (() => {
  if (!HAS_SAMPLE) return null;
  const sandbox = { window: { WISE_ACRES: {} } };
  vm.runInNewContext(read('js/shop-sample.js'), sandbox);   // the file must run as it is (one IIFE, ES2017)
  return sandbox.window.WISE_ACRES.shopSample;
})();
const homeHtml = read('index.html');
const shopHtml = homeHtml.slice(homeHtml.indexOf('id="shop"'), homeHtml.indexOf('id="flowers"'));
const pageSlugs = [...shopHtml.matchAll(/<span class="shop-bubble"><svg[^>]*><use href="#p-([a-z0-9-]+)"\/>/g)].map((m) => m[1]);
const beerOnPage = BEER.some((s) => pageSlugs.includes(s));
const PRODUCTS = LIST.products.filter((x) => x.group >= 1 && x.group <= 11 && x.slug !== 'beer-wine');   // beer-wine: the old card, replaced by the beer group (it has no list)
const EXPECTED = [...PRODUCTS.map((x) => x.slug), ...(beerOnPage ? BEER : [])];
const SAYS = Object.fromEntries(LIST.products.map((x) => [x.slug, (x.name + ' ' + x.note).toLowerCase()]));
const FORBIDDEN = /gluten[- ]?free|vegan|dairy[- ]?free|nut[- ]?free|non-?gmo|\bnatural|\blocal|\bfresh|home-?made|hand-?made|organic|\bcure|\bheal|\bboost|immun|\bdetox|\bvitamin|\bprobiotic|antioxidant|\bcalori|\d|\bages? |\byears?\b/i;

if (!HAS_SAMPLE) info('js/shop-sample.js is not in this copy of the site (the real site): only the DORMANT check runs');
else {
  const head = read('js/shop-sample.js').slice(0, 400);
  ok('js/shop-sample.js says in its first lines that it is SAMPLE DATA, NOT REAL, English only, and not for the real website', /SAMPLE DATA, NOT REAL\. English only\. Must not go on the real website until the farm gives the real lists\./.test(head));
  const keys = Object.keys(sample);
  const missing = EXPECTED.filter((s) => !keys.includes(s)), orphans = keys.filter((s) => !pageSlugs.includes(s) && !(!beerOnPage && BEER.includes(s)));
  ok(`every product of groups 1-11 has a list (${PRODUCTS.length} products${beerOnPage ? ' and the 16 beer, cider and wine drinks' : ''})`, missing.length === 0, missing.join(', '));
  ok('no list belongs to a picture that no card shows' + (beerOnPage ? '' : ' (the 16 drinks of the beer group wait for their cards: that group is not in this copy of the page yet)'), orphans.length === 0, orphans.join(', '));
  ok('the farm visit group, the old "Beer, hard cider & wine" card and every other card with no list has none', !keys.some((s) => ['beer-wine', 'wagon-ride', 'barrel-train', 'corn-pit', 'scavenger-hunt', 'sunn-hemp-maze', 'upick'].includes(s)));
  const shape = keys.filter((s) => { const e = sample[s]; return !(e && ['Ingredients', 'Made of'].includes(e.heading) && Array.isArray(e.list) && e.list.length >= 1 && e.list.length <= 14 && e.list.every((x) => typeof x === 'string' && x.trim() && x === x.trim()) && new Set(e.list.map((x) => x.toLowerCase())).size === e.list.length && (e.contains === undefined || (typeof e.contains === 'string' && e.contains.trim() && e.heading === 'Ingredients'))); });
  ok('every list has a heading ("Ingredients" or "Made of"), 1 to 14 plain items, none twice, and a "contains" line only for things you put in or on your body', shape.length === 0, shape.join(', '));
  const words = [];
  for (const s of keys) for (const x of [...sample[s].list, sample[s].contains || '']) { const m = FORBIDDEN.exec(x); if (m && !(SAYS[s] && SAYS[s].includes(m[0].toLowerCase().trim()))) words.push(`${s}: "${x}" (${m[0].trim()})`); }
  ok('no list has a health claim, a dose, a number, an age, or "vegan", "natural", "local", "fresh", "homemade", "organic" unless the card itself says it', words.length === 0, words.slice(0, 5).join(' | '));
  ok('the pizza and the ice cream bars (the wide cards) have lists: they are products of groups 2 and 3', !!sample.pizza && !!sample['ice-cream']);
}

await run('shop-pop', async ({ browser, base, errs }) => {
  /* -------------------------------------------------------------- 1. DORMANT */
  if (go('dormant')) {
    const seen = { A: [], B: [] };
    const visit = async (key, refuse) => {
      const before = errs.length;
      const p = await open(browser, base, 'index.html', errs, { viewport: DESKTOP, routes: async (pg) => { pg.on('request', (r) => seen[key].push(new URL(r.url()).pathname)); for (const f of refuse) await pg.route('**/js/' + f, (r) => r.abort()); } });
      await prep(p, false);
      const slug = 'hot-pretzel', rest = await show(p, slug), at = center(rest);
      await p.mouse.move(at.x, at.y);
      await settled(p, 0);
      const hover = await p.evaluate((s) => window.__sp.box(window.__sp.bySlug(s)), slug);
      await p.mouse.click(at.x, at.y);
      await settled(p, 300);
      const st = await p.evaluate(() => ({ buttons: document.querySelectorAll('.shop-open').length, classes: document.querySelectorAll('.shop-card-pop, .shop-pop-focus').length, tabindex: document.querySelectorAll('#shop [tabindex]').length, pop: !!document.querySelector('.shop-pop'), sheet: !!document.querySelector('link[href*="shop-pop"], style[data-shop-pop-css]'), lock: document.documentElement.className.includes('shop-pop') }));
      return { p, st, rest, hover, bad: errs.length - before };
    };
    const a = await visit('A', ['shop-sample.js']);
    ok('DORMANT (js/shop-sample.js refused): no card has a button, a class or a tabindex, and no pop-up or style sheet was made', a.st.buttons === 0 && a.st.classes === 0 && a.st.tabindex === 0 && !a.st.pop && !a.st.sheet && !a.st.lock, JSON.stringify(a.st));
    ok('...a card is not larger under the pointer, and a click does nothing', near(a.hover.w, a.rest.w, 0.5) && near(a.hover.h, a.rest.h, 0.5), JSON.stringify([a.rest, a.hover]));
    ok('...and no console error or page error', a.bad === 0, errs.slice(-3).join(' | '));
    await a.p.context().close();
    const b = await visit('B', ['shop-sample.js', 'shop-pop.js']);
    await b.p.context().close();
    const drop = (list) => [...new Set(list.filter((u) => /\.(js|css|json)$/.test(u) && !/shop-(pop|sample)\.js$/.test(u)))].sort();   // (js/shop-pop.js is refused in the second visit and the first one, with the sample refused, must ask for nothing more)
    const extra = drop(seen.A).filter((u) => !drop(seen.B).includes(u)), gone = drop(seen.B).filter((u) => !drop(seen.A).includes(u));
    ok('...it asks for the same files as with js/shop-pop.js refused as well: not for js/shop-pop-box.js (the pop-up\'s code), not for css/shop-pop.css', extra.length === 0 && gone.length === 0 && !seen.A.some((u) => /shop-pop-box\.js|shop-pop\.css/.test(u)), 'extra: ' + extra.join(', ') + ' / missing: ' + gone.join(', '));
  }
  if (!HAS_SAMPLE) return;
  if (!axeSource()) info('axe-core is not installed: the axe check is skipped');

  /* -------------------------------------------------------------- 2. WITH DATA (and 4, 5, 6 on the same page) */
  if (go('data')) {
  const p = await open(browser, base, 'index.html', errs, { viewport: DESKTOP });
  await prep(p);
  const cards = await p.evaluate(() => window.__sp.cards().map((c) => ({ slug: window.__sp.slug(c), name: c.querySelector('.shop-name').textContent.replace(/\s+/g, ' ').trim(), tag: c.tagName, role: c.getAttribute('role'), tabindex: c.getAttribute('tabindex'),
    full: c.classList.contains('shop-full'), group: window.__sp.group(c), btn: [...c.querySelectorAll('button.shop-open')].map((b) => ({ type: b.type, label: b.getAttribute('aria-label'), kids: b.children.length, text: b.textContent })), cls: c.classList.contains('shop-card-pop') })));
  const withBtn = cards.filter((c) => c.btn.length);
  const exp = new Set(EXPECTED);
  ok(`every product card of groups 1-11 has one button (${EXPECTED.length} cards)`, EXPECTED.every((s) => cards.filter((c) => c.slug === s && c.btn.length === 1).length === 1), EXPECTED.filter((s) => !cards.some((c) => c.slug === s && c.btn.length === 1)).join(', '));
  ok('no other card has one: not the farm visit group, not the five older cards (Farm fun x2, U-pick pumpkins, strawberries, blueberries), not the old beer card', withBtn.every((c) => exp.has(c.slug)) && withBtn.length === EXPECTED.length, withBtn.filter((c) => !exp.has(c.slug)).map((c) => c.name).join(', ') + ` (${withBtn.length} buttons)`);
  ok('each is a real button (type=button, no text of its own, named "<name>, <price>, show ingredients" or "... show what it is made of"), and its card is still a plain <li>', withBtn.every((c) => c.btn[0].type === 'button' && c.btn[0].kids === 0 && c.btn[0].text === '' && c.tag === 'LI' && c.role === null && c.tabindex === null && c.cls && c.btn[0].label.startsWith(c.name + ', ') && /, show (ingredients|what it is made of)$/.test(c.btn[0].label)), withBtn.filter((c) => !(c.btn[0].label || '').startsWith(c.name + ', ')).map((c) => c.name + ' = ' + c.btn[0].label).slice(0, 3).join(' | '));
  const made = withBtn.filter((c) => sample[c.slug].heading === 'Made of').every((c) => /show what it is made of$/.test(c.btn[0].label)) && withBtn.filter((c) => sample[c.slug].heading !== 'Made of').every((c) => /show ingredients$/.test(c.btn[0].label));
  ok('a thing that is not eaten ("Made of": caps, shirts, plants, jars) says "show what it is made of", the rest "show ingredients"', made);
  const price = withBtn.find((c) => c.slug === 'slushie');
  ok('a card with two sizes puts both in the name ("Slushie, Small $3, Large $4, show ingredients")', !!price && /^Slushie, Small \$3, Large \$4, show ingredients$/.test(price.btn[0].label), price && price.btn[0].label);
  const bars = await p.evaluate(() => ['pizza', 'ice-cream'].map((s) => { const c = window.__sp.bySlug(s); const a = c && c.querySelector('.shop-full-actions a'); if (!a) return { s, ok: !!c && c.classList.contains('shop-full') }; a.scrollIntoView({ block: 'center' }); const r = a.getBoundingClientRect(), top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { s, ok: top === a || a.contains(top), full: c.classList.contains('shop-full') }; }));
  ok('the wide pizza and ice cream bars have their button, and the pizza bar\'s own two links are still the top thing under the pointer', bars.every((b) => b.ok) && cards.filter((c) => ['pizza', 'ice-cream'].includes(c.slug)).every((c) => c.btn.length === 1), JSON.stringify(bars));

  /* -------------------------------------------------------------- 4. CLICK */
  ok('a click on a card opens the pop-up (role=dialog)', await openBy(p, 'hot-pretzel'));
  const geo = await p.evaluate(() => {
    const b = document.querySelector('.shop-pop-box'), r = b.getBoundingClientRect(), n = document.querySelector('.shop-pop-pretend'), nr = n.getBoundingClientRect(), cs = getComputedStyle(n);
    return { cx: r.x + r.width / 2 - innerWidth / 2, cy: r.y + r.height / 2 - innerHeight / 2, w: r.width, h: r.height, fs: parseFloat(cs.fontSize), fw: +cs.fontWeight, root: parseFloat(getComputedStyle(document.documentElement).fontSize),
      inside: nr.left >= r.left && nr.right <= r.right && nr.top >= r.top && nr.bottom <= r.bottom, inView: nr.top >= 0 && nr.bottom <= innerHeight && b.scrollTop === 0, room: b.scrollHeight <= b.clientHeight, overlay: document.querySelector('.shop-pop').getBoundingClientRect().width === innerWidth };
  });
  ok('1366x768: the box is in the middle of the window (within 3 px, both ways), at most 34rem wide and 85% high, over a dim layer that covers the window', Math.abs(geo.cx) <= 3 && Math.abs(geo.cy) <= 3 && geo.w <= 34 * geo.root + 1 && geo.h <= 768 * 0.85 + 1 && geo.overlay, JSON.stringify(geo));
  ok('...the notice is big (1.25 rem or more) and bold, inside the box and in view without scrolling', geo.fs >= 1.25 * geo.root && geo.fw >= 700 && geo.inside && geo.inView, `${geo.fs}px, weight ${geo.fw}, inside ${geo.inside}, in view ${geo.inView}`);
  const hp = await popText(p);
  const pretzel = await p.evaluate(() => { const c = window.__sp.bySlug('hot-pretzel'); return { name: c.querySelector('.shop-name').textContent.trim(), price: c.querySelector('.shop-price').textContent.trim(), note: c.querySelector('.shop-sub').textContent.replace(/\s+/g, ' ').trim() }; });
  ok('...it shows the card\'s name, price and its own note (the pretzel\'s "Caramel Apple contains nuts"), the notice exactly as the builder asked, and the heading "Ingredients"', hp.name === pretzel.name && hp.price === pretzel.price && hp.note === pretzel.note && /Caramel Apple contains nuts/.test(hp.note) && hp.notice === NOTICE && hp.heading === 'Ingredients', JSON.stringify([hp, pretzel]));
  ok('...the list is the pretzel\'s (every item is in the page\'s text), then "Contains: wheat"', JSON.stringify(hp.items) === JSON.stringify(sample['hot-pretzel'].list) && await p.evaluate((l) => l.every((x) => document.body.innerText.includes(x)), sample['hot-pretzel'].list) && hp.contains === 'Contains: wheat', JSON.stringify([hp.items, hp.contains]));
  ok('...the picture is the card\'s own (<use href="#p-hot-pretzel">)', await p.evaluate(() => { const u = document.querySelector('.shop-pop-pic use'); return !!u && u.getAttribute('href') === '#p-hot-pretzel'; }));
  await closeBy(p);
  for (const [slug, heading, contains] of [['trucker-cap', 'Made of', false], ['blood-orange-wheat', 'Ingredients', true]]) {
    if (slug === 'blood-orange-wheat' && !beerOnPage) continue;
    ok(`a "${heading}" card (${slug}) opens too: its heading, its items${contains ? ', "Contains:"' : ' and no "Contains:" line'}`, await openBy(p, slug) && await (async () => { const t = await popText(p); return t.heading === heading && JSON.stringify(t.items) === JSON.stringify(sample[slug].list) && (contains ? /^Contains: /.test(t.contains) : t.contains === '') && t.notice === NOTICE; })());
    await closeBy(p);
  }
  await p.context().close();

  /* ... on a phone (touch): the pop-up in the middle, a tap leaves no card big */
  {
    const q = await open(browser, base, 'index.html', errs, { viewport: PHONE, touch: true });
    await prep(q);
    const rest = await show(q, 'hot-pretzel'), at = await spot(q, 'hot-pretzel');
    await q.touchscreen.tap(at.x, at.y);
    ok('390x844 (touch): a tap opens the pop-up', await until(q, () => !!document.querySelector('.shop-pop.is-open'), null, 20000));
    const g = await q.evaluate(() => { const b = document.querySelector('.shop-pop-box'), r = b.getBoundingClientRect(), n = document.querySelector('.shop-pop-pretend').getBoundingClientRect(); return { cx: r.x + r.width / 2 - innerWidth / 2, cy: r.y + r.height / 2 - innerHeight / 2, w: r.width, left: r.left, right: r.right, sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth, noticeIn: n.left >= r.left && n.right <= r.right, root: parseFloat(getComputedStyle(document.documentElement).fontSize), fs: parseFloat(getComputedStyle(document.querySelector('.shop-pop-pretend')).fontSize) }; });
    ok('...in the middle (within 3 px), 92% of the width, the notice big and inside it, no sideways scroll', Math.abs(g.cx) <= 3 && Math.abs(g.cy) <= 3 && near(g.w, 390 * 0.92, 2) && g.noticeIn && g.sideways <= 0 && g.fs >= 1.25 * g.root, JSON.stringify(g));
    await closeBy(q);
    await settled(q, 0);
    const after = await q.evaluate((s) => window.__sp.box(window.__sp.bySlug(s)), 'hot-pretzel');
    ok('...after it shuts, the card is not left big (a touch screen has no hover to leave it in)', near(after.w, rest.w, 0.6) && near(after.h, rest.h, 0.6), JSON.stringify([rest, after]));
    await q.context().close();
  }
  }

  /* -------------------------------------------------------------- 3. HOVER */
  if (go('hover')) {
  const PICKS = async (pg) => pg.evaluate(() => {   // the first card (left edge, left column), the one furthest right (right column), a wide bar
    const pops = [...document.querySelectorAll('#shop .shop-card-pop:not(.shop-full)')], right = pops.reduce((m, c) => (c.getBoundingClientRect().right > m.getBoundingClientRect().right ? c : m), pops[0]);
    return [['the first snack', window.__sp.slug(document.querySelector('#shop-snacks .shop-card-pop'))], ['the card furthest right', window.__sp.slug(right)], ['the pizza bar', 'pizza']];
  });
  for (const width of [1366, 1920, 1280, 1264, 1024]) {
    const h = await open(browser, base, 'index.html', errs, { viewport: { width, height: 800 } });
    await prep(h);
    const overflow = await h.evaluate(() => ['.shop-groups', '.shop-group', '.shop-grid', '#shop'].map((s) => getComputedStyle(document.querySelector(s)).overflow).join('/'));
    if (width === 1366) info('overflow of #shop, .shop-groups, .shop-group and .shop-grid (visible means nothing is cut by them): ' + overflow);
    for (const [what, slug] of await PICKS(h)) {
      const rest = await show(h, slug), at = center(rest);
      const before = await h.evaluate((s) => { const c = window.__sp.bySlug(s), cs = getComputedStyle(c); return { shadow: cs.boxShadow, edge: cs.borderTopColor, bubble: getComputedStyle(c.querySelector('.shop-bubble')).transform }; }, slug);
      await h.mouse.move(at.x, at.y);
      const grown = await (async () => { let last; for (let i = 0; i < 80; i++) { await settled(h, 0); last = await h.evaluate((s) => { const c = window.__sp.bySlug(s), r = c.getBoundingClientRect(), cs = getComputedStyle(c); return { w: r.width, h: r.height, top: r.top, bottom: r.bottom, left: r.left, right: r.right, z: cs.zIndex, pos: cs.position, tf: cs.transform, shadow: cs.boxShadow, edge: cs.borderTopColor, cursor: cs.cursor, bubble: getComputedStyle(c.querySelector('.shop-bubble')).transform, name: parseFloat(getComputedStyle(c.querySelector('.shop-name')).fontSize), op: cs.opacity }; }, slug); if (last.w / rest.w > 1.04 || i > 6) break; await new Promise((r) => setTimeout(r, 60)); } return last; })();
      const k = grown.w / rest.w, m = /^matrix\(([^)]+)\)$/.exec(grown.tf), v = m ? m[1].split(',').map(Number) : [];
      ok(`${width}px, ${what}: under the pointer it grows 4 to 12 percent (x${k.toFixed(3)}), lifts (${(rest.y - grown.top).toFixed(1)} px higher at the top) and gets the pointer cursor`, k >= 1.04 && k <= 1.12 && grown.top < rest.y - 1 && grown.cursor === 'pointer', JSON.stringify({ rest, grown }));
      ok(`...it sits above its neighbours (z-index ${grown.z}), is only scaled and moved, never turned, so its text stays upright, and is fully opaque`, Number(grown.z) > 0 && grown.pos === 'relative' && v.length === 6 && near(v[1], 0, 0.001) && near(v[2], 0, 0.001) && near(v[0], v[3], 0.001) && grown.op === '1' && grown.name >= 15.2, JSON.stringify({ tf: grown.tf, z: grown.z, name: grown.name }));
      ok('...its shadow is deeper, its edge is the warm red, and its picture tilts and grows', grown.shadow !== before.shadow && grown.edge !== before.edge && grown.bubble !== before.bubble && grown.bubble !== 'none', JSON.stringify({ before, grown }));
      const cut = await h.evaluate((s) => { const c = window.__sp.bySlug(s), r = c.getBoundingClientRect(), pts = [[r.left + 14, r.top + 14], [r.right - 14, r.top + 14], [r.left + 14, r.bottom - 14], [r.right - 14, r.bottom - 14], [r.left + r.width / 2, r.top + 4], [r.left + r.width / 2, r.bottom - 4], [r.left + 4, r.top + r.height / 2], [r.right - 4, r.top + r.height / 2]]; return pts.map(([x, y]) => { const e = document.elementFromPoint(x, y); return e && c.contains(e) ? '' : (e ? e.tagName + '.' + String(e.className).slice(0, 24) : 'nothing') + ' at ' + Math.round(x) + ',' + Math.round(y); }).filter(Boolean); }, slug);
      ok('...not one of its edges or corners is cut by a column, a group or a neighbour (the card is the top thing at 8 points around it)', cut.length === 0, cut.join(' | '));
      await h.mouse.move(2, 2);
      await okSoon('...once the pointer leaves, the card is back at rest (size, shadow, edge)', () => h.evaluate((s) => { const c = window.__sp.bySlug(s), r = c.getBoundingClientRect(), cs = getComputedStyle(c); return [r.width, r.height, r.top, cs.boxShadow, cs.borderTopColor].join('|'); }, slug), (x) => x === [rest.w, rest.h, rest.y, before.shadow, before.edge].join('|') || (Math.abs(Number(x.split('|')[0]) - rest.w) < 0.6 && x.split('|').slice(3).join('|') === before.shadow + '|' + before.edge));
    }
    await h.context().close();
  }
  {   // reduced motion in the system, and "Pause animations": no scale and no tilt, the shadow and the edge still change
    const r = await open(browser, base, 'index.html', errs, { viewport: DESKTOP, reducedMotion: 'reduce' });
    await prep(r);
    for (const mode of ['reduced motion', 'Pause animations']) {
      if (mode === 'Pause animations') await r.evaluate(() => document.documentElement.setAttribute('data-calm', 'all'));
      const rest = await show(r, 'hot-pretzel'), at = center(rest);
      const b0 = await r.evaluate(() => { const c = window.__sp.bySlug('hot-pretzel'), cs = getComputedStyle(c); return { shadow: cs.boxShadow, edge: cs.borderTopColor }; });
      await r.mouse.move(at.x, at.y);
      await settled(r, 0);
      const g = await r.evaluate(() => { const c = window.__sp.bySlug('hot-pretzel'), cs = getComputedStyle(c), q = c.getBoundingClientRect(); return { w: q.width, h: q.height, top: q.top, shadow: cs.boxShadow, edge: cs.borderTopColor, tf: cs.transform, bubble: getComputedStyle(c.querySelector('.shop-bubble')).transform }; });
      ok(`${mode}: under the pointer nothing is scaled, lifted or tilted (size and place the same, no transform), but the shadow and the edge change`, near(g.w, rest.w, 0.5) && near(g.h, rest.h, 0.5) && near(g.top, rest.y, 0.5) && g.tf === 'none' && g.bubble === 'none' && g.shadow !== b0.shadow && g.edge !== b0.edge, JSON.stringify({ rest, g, b0 }));
      await r.mouse.move(2, 2);
    }
    ok('reduced motion: the pop-up opens and shuts at once (no fade, no scale)', await openBy(r, 'hot-pretzel') && await r.evaluate(() => { const b = document.querySelector('.shop-pop-box'), cs = getComputedStyle(b); return cs.transform === 'none' && parseFloat(getComputedStyle(document.querySelector('.shop-pop')).transitionDuration) <= 0.001; }));
    await closeBy(r);
    await r.context().close();
  }
  }

  /* -------------------------------------------------------------- 5. KEYBOARD, 6. ACCESSIBILITY (a fresh page) */
  if (go('keys')) {
  const k = await open(browser, base, 'index.html', errs, { viewport: DESKTOP });
  await prep(k);
  await k.addStyleTag({ content: 'html::-webkit-scrollbar{width:17px}html::-webkit-scrollbar-thumb{background:#999}' });   // a classic scroll bar that takes room, as most computers have (the test browser hides its own)
  const focusIn = async (slug) => { await show(k, slug); await k.keyboard.press('Shift'); await k.evaluate((s) => window.__sp.bySlug(s).querySelector('.shop-open').focus(), slug); };
  await focusIn('hot-pretzel');
  const lit = await k.evaluate(() => { const c = window.__sp.bySlug('hot-pretzel'); return { cls: c.classList.contains('shop-pop-focus'), tf: getComputedStyle(c).transform, ring: getComputedStyle(c.querySelector('.shop-open')).outlineStyle }; });
  ok('keyboard focus on a card gives it the same grow as the pointer, and a focus ring on the button over the card', lit.cls && lit.tf !== 'none' && lit.ring !== 'none', JSON.stringify(lit));
  const lay0 = await k.evaluate(() => ({ left: document.querySelector('#shop .wrap').getBoundingClientRect().left, bar: innerWidth - document.documentElement.clientWidth, y: scrollY, hidden: [...document.body.children].map((e) => [e.tagName, e.getAttribute('aria-hidden'), e.hasAttribute('inert')].join(':')).join(',') }));
  await k.keyboard.press('Enter');
  ok('Enter on the focused card opens the pop-up and focus goes into the box', await until(k, () => !!document.querySelector('.shop-pop.is-open'), null, 20000) && await k.evaluate(() => !!document.activeElement.closest('.shop-pop-box')));
  const inside = [];
  for (let i = 0; i < 5; i++) { await k.keyboard.press('Tab'); inside.push(await k.evaluate(() => { const a = document.activeElement; return a.closest('.shop-pop-box') ? a.className.split(' ').pop() : 'OUT:' + a.tagName; })); }
  for (let i = 0; i < 3; i++) { await k.keyboard.press('Shift+Tab'); inside.push(await k.evaluate(() => { const a = document.activeElement; return a.closest('.shop-pop-box') ? a.className.split(' ').pop() : 'OUT:' + a.tagName; })); }
  ok('Tab and Shift+Tab go round the two buttons of the box (X and Close) and never leave it', inside.every((x) => /^shop-pop-(x|done)$/.test(x)) && new Set(inside).size === 2, inside.join(' '));
  const mid = await k.evaluate(() => ({ left: document.querySelector('#shop .wrap').getBoundingClientRect().left, bar: innerWidth - document.documentElement.clientWidth, y: scrollY, gap: getComputedStyle(document.documentElement).paddingRight }));
  await k.mouse.wheel(0, 900); await k.keyboard.press('PageDown'); await k.keyboard.press('End');
  await settled(k, 0);
  const lock = await k.evaluate(() => ({ left: document.querySelector('#shop .wrap').getBoundingClientRect().left, y: scrollY }));
  ok('the page behind does not scroll (wheel, Page Down, End) and does not slide sideways when the scroll bar goes (it was ' + lay0.bar + ' px wide)', lay0.bar === 17 && mid.bar === 0 && near(mid.left, lay0.left, 0.5) && near(lock.left, lay0.left, 0.5) && lock.y === lay0.y && mid.gap === '17px', JSON.stringify({ lay0, mid, lock }));
  const hidden = await k.evaluate(() => [...document.body.children].filter((e) => !e.matches('script, style, link, .shop-pop')).map((e) => [e.tagName, e.getAttribute('aria-hidden'), e.hasAttribute('inert')]));
  ok('while it is open every other block of the page is hidden from screen readers and cannot be reached (aria-hidden, inert)', hidden.length > 3 && hidden.every((h) => h[1] === 'true' && h[2] === true), JSON.stringify(hidden.filter((h) => h[1] !== 'true' || !h[2])));
  const attrs = await k.evaluate(() => { const b = document.querySelector('.shop-pop-box'), by = (a) => { const e = document.getElementById(b.getAttribute(a)); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; }; return { role: b.getAttribute('role'), modal: b.getAttribute('aria-modal'), name: by('aria-labelledby'), desc: by('aria-describedby'), title: document.querySelector('.shop-pop-name').textContent, x: document.querySelector('.shop-pop-x').getBoundingClientRect(), xl: document.querySelector('.shop-pop-x').getAttribute('aria-label'), h2: document.querySelectorAll('.shop-pop-box h2').length, tag: document.querySelector('.shop-pop-name').tagName }; });
  ok('role="dialog", aria-modal="true", named by the product\'s name, described by the notice; a heading; the X is 44 px and named "Close"', attrs.role === 'dialog' && attrs.modal === 'true' && attrs.name === 'Hot pretzel' && attrs.desc === NOTICE && attrs.tag === 'H2' && attrs.x.width >= 44 && attrs.x.height >= 44 && attrs.xl === 'Close', JSON.stringify(attrs));
  if (axeSource()) {
    await k.evaluate(axeSource());
    const res = await k.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] } })).violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 2).map((n) => n.target.join(' ')) })));
    ok('axe (WCAG A and AA, best practice) finds nothing with the pop-up open', res.length === 0, res.map((v) => `[${v.impact}] ${v.id}: ${v.nodes.join(' ; ')}`).join(' | '));
  }
  await k.keyboard.press('Escape');
  ok('Escape shuts it and focus goes back to the card\'s button (which shows the keyboard grow again)', await until(k, () => !document.querySelector('.shop-pop.is-open'), null, 10000) && await k.evaluate(() => { const a = document.activeElement; return a.classList.contains('shop-open') && a.closest('.shop-card').querySelector('.shop-name').textContent.trim() === 'Hot pretzel' && a.closest('.shop-card').classList.contains('shop-pop-focus'); }));
  await settled(k, 0);
  const lay1 = await k.evaluate(() => ({ left: document.querySelector('#shop .wrap').getBoundingClientRect().left, bar: innerWidth - document.documentElement.clientWidth, y: scrollY, hidden: [...document.body.children].map((e) => [e.tagName, e.getAttribute('aria-hidden'), e.hasAttribute('inert')].join(':')).join(','), pad: document.documentElement.style.paddingRight, cls: document.documentElement.className.includes('shop-pop') }));
  ok('after it shuts the page is as before: the scroll bar is back, nothing slid, the blocks are no longer hidden or inert, the place on the page is the same', lay1.bar === 17 && near(lay1.left, lay0.left, 0.5) && lay1.hidden === lay0.hidden && lay1.y === lay0.y && !lay1.cls, JSON.stringify({ lay0, lay1 }));
  await k.keyboard.press('Space');
  ok('Space on the focused card opens it too', await until(k, () => !!document.querySelector('.shop-pop.is-open'), null, 20000));
  await k.mouse.click(6, 6);   // the dim part, outside the box
  ok('a click on the dim part outside the box closes it, and focus is back on the card', await until(k, () => !document.querySelector('.shop-pop.is-open'), null, 10000) && await k.evaluate(() => document.activeElement.classList.contains('shop-open')));
  // a drag that begins in the box and ends on the dim part must not close it
  await openBy(k, 'hot-pretzel');
  const boxAt = await k.evaluate(() => { const r = document.querySelector('.shop-pop-box').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await k.mouse.move(boxAt.x, boxAt.y); await k.mouse.down(); await k.mouse.move(6, 6); await k.mouse.up();
  ok('a press in the box that is let go on the dim part (selecting text) does not close it', await isOpen(k));
  await closeBy(k);
  // three different cards in a row: nothing of the one before is left
  const rows = [];
  for (const slug of ['hot-pretzel', 'trucker-cap', 'pizza', 'water']) {
    await openBy(k, slug);
    const t = await popText(k), card = await k.evaluate((s) => { const c = window.__sp.bySlug(s); return { name: c.querySelector('.shop-name').textContent.trim(), sub: c.querySelector('.shop-sub') ? c.querySelector('.shop-sub').textContent.replace(/\s+/g, ' ').trim() : '', pic: c.querySelector('.shop-bubble use').getAttribute('href'), group: window.__sp.group(c) }; }, slug);
    const shown = await k.evaluate(() => ({ pic: document.querySelector('.shop-pop-pic use').getAttribute('href'), cls: document.querySelector('.shop-pop-box').className, n: document.querySelectorAll('.shop-pop-pic svg, .shop-pop-price > *').length }));
    rows.push(t.name === card.name && t.note === card.sub && JSON.stringify(t.items) === JSON.stringify(sample[slug].list) && t.heading === sample[slug].heading && (sample[slug].contains ? t.contains === 'Contains: ' + sample[slug].contains : t.contains === '') && shown.pic === card.pic && shown.cls.includes(card.group) && shown.n === 2 ? '' : slug + ' ' + JSON.stringify({ t, card, shown }));
    await closeBy(k);
  }
  ok('four cards in a row (pretzel with note and "Contains", cap "Made of", the wide pizza bar, water): each time its own name, picture, group colours, note, heading, list and "Contains" line, nothing left from the one before', rows.every((x) => !x), rows.filter(Boolean).join(' || '));

  /* -------------------------------------------------------------- 6. contrast, in every group */
  const groups = await k.evaluate(() => [...new Set(window.__sp.cards().filter((c) => c.querySelector('.shop-open')).map((c) => window.__sp.group(c)))].map((g) => window.__sp.slug(window.__sp.cards().find((c) => c.querySelector('.shop-open') && window.__sp.group(c) === g))));
  const weak = [];
  for (const slug of groups) {
    await openBy(k, slug);
    const c = await k.evaluate(() => {
      const css = (s) => getComputedStyle(document.querySelector(s)), R = window.__sp.ratio, box = css('.shop-pop-box').backgroundColor, out = [];
      out.push(['name on the band', R(css('.shop-pop-name').color, css('.shop-pop-head').backgroundColor)]);
      out.push(['notice', R(css('.shop-pop-pretend').color, css('.shop-pop-pretend').backgroundColor)]);
      out.push(['heading', R(css('.shop-pop-h').color, box)]); out.push(['note', R(css('.shop-pop-note').color, box)]); out.push(['price', R(getComputedStyle(document.querySelector('.shop-pop-price .shop-price, .shop-pop-price .so-p')).color, box)]);
      document.querySelectorAll('.shop-pop-list li').forEach((li, i) => { if (i < 2) out.push(['chip', R(getComputedStyle(li).color, getComputedStyle(li).backgroundColor)]); });
      out.push(['Close', R(css('.shop-pop-done').color, css('.shop-pop-done').backgroundColor)]);
      return out.map(([n, r]) => [n, Math.round(r * 10) / 10]);
    });
    for (const [n, r] of c) if (r < 4.5) weak.push(`${slug} ${n} ${r}`);
    await closeBy(k);
  }
  ok(`contrast of the words in the pop-up is 4.5 to 1 or better in each of the ${groups.length} groups (name on the band, notice, heading, note, price, chips, Close)`, weak.length === 0 && groups.length >= 11, weak.join(', ') + ` (${groups.length} groups)`);
  await k.context().close();
  }

  /* -------------------------------------------------------------- 7. LANGUAGES */
  if (go('languages')) {
  const want = (code) => (code === 'en' ? { notice: NOTICE, ing: 'Ingredients', made: 'Made of', contains: 'Contains:', close: 'Close', label: (n, pr) => `${n}, ${pr}, show ingredients`, labelMade: (n, pr) => `${n}, ${pr}, show what it is made of` }
    : { notice: DICT[code]['(This is not the real ingredients. This is just a preview.)'], ing: DICT[code].Ingredients, made: DICT[code]['Made of'], contains: DICT[code]['Contains:'], close: DICT[code].Close,
      label: (n, pr) => DICT[code]['{name}, {price}, show ingredients'].replace('{name}', n).replace('{price}', pr), labelMade: (n, pr) => DICT[code]['{name}, {price}, show what it is made of'].replace('{name}', n).replace('{price}', pr) });
  for (const code of LANGS) {
    const w = want(code);
    for (const view of [DESKTOP, PHONE]) {
      const l = await open(browser, base, 'index.html', errs, { viewport: view, lang: code, touch: view === PHONE });
      await prep(l);
      const labels = await l.evaluate(() => { const lab = (s) => { const c = window.__sp.bySlug(s); return { name: c.querySelector('.shop-name').textContent.replace(/\s+/g, ' ').trim(), price: c.querySelector('.shop-price').textContent.replace(/\s+/g, ' ').trim(), label: c.querySelector('.shop-open').getAttribute('aria-label') }; }; return { pretzel: lab('hot-pretzel'), cap: lab('trucker-cap') }; });
      if (view === DESKTOP) ok(`${code}: the buttons are named in the page's language ("${labels.pretzel.label}")`, labels.pretzel.label === w.label(labels.pretzel.name, labels.pretzel.price) && labels.cap.label === w.labelMade(labels.cap.name, labels.cap.price) && (code === 'en' || !/show |ingredients|made of/i.test(labels.pretzel.label + labels.cap.label)), JSON.stringify(labels));
      for (const slug of ['hot-pretzel', 'trucker-cap']) {
        if (!await openBy(l, slug)) { ok(`${code} ${view.width}px: ${slug} opens`, false); continue; }
        const t = await popText(l);
        const wantHeading = sample[slug].heading === 'Made of' ? w.made : w.ing;
        const fit = await l.evaluate(() => {
          const b = document.querySelector('.shop-pop-box'), r = b.getBoundingClientRect(), cut = [];
          b.querySelectorAll('.shop-pop-name, .shop-pop-price, .shop-pop-note, .shop-pop-pretend, .shop-pop-h, .shop-pop-list li, .shop-pop-contains, .shop-pop-done').forEach((e) => { const q = e.getBoundingClientRect(); if (q.left < r.left - 0.5 || q.right > r.right + 0.5 || e.scrollWidth > e.clientWidth + 1) cut.push(e.className + ' ' + Math.round(q.left) + '-' + Math.round(q.right) + ' scroll ' + e.scrollWidth + '/' + e.clientWidth); });
          return { cut, boxSide: b.scrollWidth - b.clientWidth, page: document.documentElement.scrollWidth - document.documentElement.clientWidth, h: r.height, vh: innerHeight };
        });
        const english = /[A-Za-z]/.test([t.notice, t.heading, t.done, t.x].join('') + (t.contains ? t.contains.split(/[:：]/)[0] : ''));
        ok(`${code} ${view.width}px, ${slug}: the notice, the heading, "Contains" and "Close" are the page's language${code === 'en' ? '' : ' (no English left in them)'}; the list stays English`,
          t.notice === w.notice && t.heading === wantHeading && t.done === w.close && t.x === w.close && (t.contains === '' || t.contains.startsWith(w.contains)) && (code === 'en' || code === 'es' || code === 'vi' || !english) && (code === 'en' || t.notice !== NOTICE) && JSON.stringify(t.items) === JSON.stringify(sample[slug].list), JSON.stringify({ t, wantHeading }));
        ok(`${code} ${view.width}px, ${slug}: no sideways scroll (page or box) and no text cut off at the side`, fit.cut.length === 0 && fit.boxSide <= 0 && fit.page <= 0 && fit.h <= fit.vh * 0.85 + 1, JSON.stringify(fit));
        await closeBy(l);
      }
      if (view === DESKTOP && code === 'en') {   // a language change with the pop-up closed re-names the buttons; and with it open, re-writes it
        const was = labels.pretzel.label;
        await l.evaluate(() => window.WISE_ACRES.setLang('es'));
        await okSoon('en -> es with the pop-up closed: the card\'s button is named in Spanish', () => l.evaluate(() => window.__sp.bySlug('hot-pretzel').querySelector('.shop-open').getAttribute('aria-label')), (x) => x !== was && /ver ingredientes$/.test(x));
        await openBy(l, 'hot-pretzel');
        await l.evaluate(() => window.WISE_ACRES.setLang('en'));
        await okSoon('es -> en with the pop-up open: it is written again in English (the notice, the Close button) and the closed buttons are English again', async () => ({ n: await l.evaluate(() => window.__sp.txt('.shop-pop-pretend')), d: await l.evaluate(() => window.__sp.txt('.shop-pop-done')), a: await l.evaluate(() => window.__sp.bySlug('water').querySelector('.shop-open').getAttribute('aria-label')) }), (x) => x.n === NOTICE && x.d === 'Close' && /, show ingredients$/.test(x.a));
        await closeBy(l);
      }
      await l.context().close();
    }
  }
  }

  /* -------------------------------------------------------------- 9. weight */
  const kb = (n) => (n / 1024).toFixed(1) + ' KB';
  const hover = read('css/extras.css').match(/\/\* A card with a pretend ingredient list[\s\S]*?@media print\{\.shop-open\{display:none\}\}/);
  for (const [name, text] of [['js/shop-pop.js (resident)', read('js/shop-pop.js')], ['js/shop-pop-box.js (asked for when there is sample data)', read('js/shop-pop-box.js')], ['css/shop-pop.css', read('css/shop-pop.css')], ['js/shop-sample.js', read('js/shop-sample.js')], ['the hover block in css/extras.css', hover ? hover[0] : '']]) {
    const raw = Buffer.from(text);
    info(`${name}: ${raw.length} bytes (${kb(raw.length)}), gzip -9 ${zlib.gzipSync(raw, { level: 9 }).length} bytes, brotli ${zlib.brotliCompressSync(raw).length} bytes`);
  }
  ok('the hover block is found in css/extras.css (for the weight line above)', !!hover);
});
