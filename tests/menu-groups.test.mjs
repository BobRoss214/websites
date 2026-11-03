// order: 391
// browser: yes
// covers: index.html, pages/*.html, tools/pages.py, css/sections.css, css/extras.css, css/features.css, js/main.js, lang/*
/* The top menu: seven buttons (Visit, Things to Do, GreenHouse, Store, Groups & Parties, About Us, Contact), each one opens a list of lines, and a click on
 * a line scrolls the page to that place (work-notes/MENU-PLAN.md has the full list; the table below is the same list, written out on purpose, so a line
 * that is moved, renamed or sent to another place is caught).
 * Checked: the words and the address of every line on the six pages (the other five pages send every line to index.html, the First-visit guide to first-visit.html);
 * a button opens its list (aria-expanded), a second click, Escape (focus goes back to the button), a click anywhere else and tabbing out close it, only one list is
 * open at a time, a click on a line closes it; the keyboard (Tab goes from button to button, Enter and Space open, Tab goes into the list); every line puts its place
 * on the usual line under the header (88 px), the group tabs (school tours, parties, corporate) are opened by their line, and the two lines for things that only
 * some seasons show (Meet the animals, Playgrounds) go to What's on the farm in winter; the button of the group whose section is in the middle of the screen
 * is lit (aria-current), and the line too when its address is exactly that section; the red "new" dot is on Things to Do in the fall and nowhere else; the
 * phone menu (each group name as a small heading, every line under it); and Spanish. */
import { run, open, ok, okSoon, until, settled, ms } from './lib.mjs';

const sleep = (n) => new Promise((r) => setTimeout(r, n));
const TOL = 4;   // px: how far from the usual line counts as the same place

// [group name, list id, [line, address on the home page]]; "What’s in season" has the curly apostrophe the site uses everywhere
const MENU = [
  ['Visit', 'visit', [['Hours & locations', '#visit'], ['Reserve a time', '#steps'], ['Choose your package', '#options'], ['First-visit guide', '#first-visit'], ['Farm map', '#farm-map'], ['Directions', '#contact']]],
  ['Things to Do', 'things', [['What’s in season', '#seasons'], ['U-pick', '#farm'], ['Tomatoes & basil', '#tomatoes'], ['U-cut flowers', '#flowers'], ['Rides & add-ons', '#addons'], ['Meet the animals', '#animals'], ['Playgrounds', '#farm-playgrounds'], ['Photography', '#photography']]],
  ['GreenHouse', 'greenhouse', [['About The GreenHouse', '#greenhouse'], ['Wise Pie pizza', '#pizza'], ['Ice cream', '#shop-icecream'], ['Drinks', '#shop-drinks'], ['Christmas trees', '#shop-pumpkins']]],
  ['Store', 'store', [['Everything in the store', '#shop'], ['Snacks', '#shop-snacks'], ['Ice cream', '#shop-icecream'], ['Pizza', '#shop-greenhouse'], ['Drinks', '#shop-drinks'], ['Pantry & bakery', '#shop-pantry'], ['Gifts & merchandise', '#shop-gifts'], ['Plants & seasonal', '#shop-plants']]],
  ['Groups & Parties', 'groups', [['School tours', '#school-tours'], ['Parties at the farm', '#parties'], ['Corporate events', '#corporate']]],
  ['About Us', 'about', [['Our story', '#about'], ['Reviews', '#reviews'], ['Photos', '#gallery']]],
  ['Contact', 'contact', [['Contact us', '#contact'], ['Questions (FAQ)', '#faq'], ['Email sign-up', '#follow-signup']]],
];
const LINES = MENU.reduce((n, g) => n + g[2].length, 0);
// which group lights up for each section of the home page (the scripts call a section by its data-nav, else its id; this is the same list as work-notes/MENU-PLAN.md)
const SPY = {
  Visit: ['visit', 'this-week', 'farm-map', 'first-visit', 'reserve'], 'Things to Do': ['farm', 'farm-cards', 'seasons', 'tomatoes', 'flowers'], GreenHouse: ['greenhouse', 'pizza'],
  Store: ['shop'], 'Groups & Parties': ['groups'], 'About Us': ['about', 'reviews', 'gallery'], Contact: ['faq', 'contact'],
};
const PAGES = ['index.html', 'first-visit.html', 'pumpkin-patch.html', 'school-field-trips.html', 'strawberry-picking.html', 'wise-pie.html'];
const SEASONAL = { '#farm-playgrounds': 'spring summer fall' };   // the lines whose place only some seasons show: winter goes to #farm (the animals and the goats are one block that shows all year)
const TABS = { '#school-tours': 'school', '#parties': 'parties', '#corporate': 'corporate' };
const OWN_MARGIN = { '#follow-signup': 90 };   // the signup block keeps 90 px of its own under the header (css/features.css)

const names = (p) => p.evaluate(() => [...document.querySelectorAll('.nav > ul > li.nav-group')].map((g) => ({
  btn: g.querySelector('.nav-group-btn').textContent.trim().replace(/\s+/g, ' '), list: g.querySelector('.nav-group-list').id, controls: g.querySelector('.nav-group-btn').getAttribute('aria-controls'),
  expanded: g.querySelector('.nav-group-btn').getAttribute('aria-expanded'),
  lines: [...g.querySelectorAll('.nav-group-list a')].map((a) => [a.textContent.trim().replace(/\s+/g, ' '), a.getAttribute('href')]),
})));
const openLists = (p) => p.evaluate(() => [...document.querySelectorAll('.nav-group-btn[aria-expanded="true"]')].map((b) => b.getAttribute('aria-controls')));
const shown = (p, id) => p.evaluate((id) => { const l = document.getElementById(id), r = l.getBoundingClientRect(); return getComputedStyle(l).display !== 'none' && r.width > 0 && r.height > 0; }, id);
const focused = (p) => p.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.getAttribute('aria-controls') || a.getAttribute('href') || a.tagName) : null; });

await run('menu-groups', async ({ browser, base, errs }) => {
  // ---------------------------------------------------------------- 1. the words and addresses, on the six pages
  for (const page of PAGES) {
    const p = await open(browser, base, page, errs, { viewport: { width: 1440, height: 900 } });
    const got = await names(p);
    const home = page === 'index.html';
    ok(`${page}: seven buttons in this order: ${MENU.map((g) => g[0]).join(', ')}`, got.length === 7 && got.every((g, i) => g.btn === MENU[i][0]), JSON.stringify(got.map((g) => g.btn)));
    ok(`${page}: every button says what it opens (aria-controls is its list) and starts closed`, got.every((g, i) => g.controls === 'nav-list-' + MENU[i][1] && g.list === g.controls && g.expanded === 'false'), JSON.stringify(got.map((g) => [g.controls, g.list, g.expanded])));
    const want = MENU.map((g) => g[2].map(([t, h]) => [t, home ? h : (h === '#first-visit' ? 'first-visit.html' : 'index.html' + h)]));
    ok(`${page}: the ${LINES} lines have the exact words and go to the exact places (${home ? 'on the page itself' : 'index.html#..., the First-visit guide to first-visit.html'})`, JSON.stringify(got.map((g) => g.lines)) === JSON.stringify(want),
      JSON.stringify(got.map((g, i) => g.lines.filter((l, j) => JSON.stringify(l) !== JSON.stringify(want[i][j])))));
    const ids = await p.evaluate(() => [...document.querySelectorAll('[id]')].map((e) => e.id));
    ok(`${page}: no id is used twice (the lists add 14)`, new Set(ids).size === ids.length, ids.filter((x, i) => ids.indexOf(x) !== i).join(', '));
    if (home) {
      const missing = await p.evaluate(() => [...document.querySelectorAll('.nav-group-list a[href^="#"]')].map((a) => a.getAttribute('href').slice(1)).filter((id) => !document.getElementById(id)));
      ok('index.html: every line of every list has its place on the page (an id)', missing.length === 0, missing.join(', '));
      const seen = await p.evaluate(() => [...document.querySelectorAll('.nav-group-list')].map((l) => getComputedStyle(l).display));
      ok('index.html: all seven lists are closed when the page opens (nothing sticks out of the bar)', seen.every((d) => d === 'none'), seen.join(','));
    }
    await p.context().close();
  }

  // ---------------------------------------------------------------- 2. open and close, with the mouse
  const p = await open(browser, base, 'index.html', errs, { viewport: { width: 1440, height: 900 } });
  await p.addStyleTag({ content: '#wa-problems{display:none!important}' });
  const btn = (id) => `button[aria-controls="nav-list-${id}"]`;
  await p.click(btn('store'));
  await okSoon('a click on Store opens its list (aria-expanded true, the list shows under the button)', async () => ({ open: await openLists(p), shown: await shown(p, 'nav-list-store') }), (v) => v.open.join() === 'nav-list-store' && v.shown);
  const box = await p.evaluate(() => { const l = document.getElementById('nav-list-store'), b = document.querySelector('button[aria-controls="nav-list-store"]'), r = l.getBoundingClientRect(), br = b.getBoundingClientRect(), a = [...l.querySelectorAll('a')].map((x) => Math.round(x.getBoundingClientRect().height)), cs = getComputedStyle(l);
    return { below: r.top >= br.bottom - 1, onScreen: r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, minH: Math.min(...a), white: cs.backgroundColor, border: cs.borderTopWidth + ' ' + cs.borderTopColor, radius: cs.borderTopLeftRadius, shadow: cs.boxShadow, pos: getComputedStyle(document.getElementById('site-header')).position }; });
  ok('the list is under its button, on the screen, white with a 3px ink border, rounded, with a small shadow, and every line is at least 44px tall; the bar stays sticky', box.below && box.onScreen && box.minH >= 44 && box.white === 'rgb(255, 255, 255)' && /^3px rgb\(58, 36, 22\)/.test(box.border) && parseFloat(box.radius) >= 12 && box.shadow !== 'none' && box.pos === 'sticky', JSON.stringify(box));
  await p.click(btn('store'));
  await okSoon('a second click on the same button closes it', async () => ({ open: await openLists(p), shown: await shown(p, 'nav-list-store') }), (v) => v.open.length === 0 && !v.shown);

  await p.click(btn('visit'));
  await p.click(btn('contact'));
  await okSoon('only one list is open at a time (opening Contact closed Visit)', () => openLists(p), (v) => v.join() === 'nav-list-contact');
  const lastBox = await p.evaluate(() => { const r = document.getElementById('nav-list-contact').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right), innerWidth]; });
  ok('the last list does not run off the right edge of the window', lastBox[0] >= 0 && lastBox[1] <= lastBox[2], lastBox.join(' '));
  await p.mouse.click(60, 600);
  await okSoon('a click anywhere else closes the open list', () => openLists(p), (v) => v.length === 0);

  await p.click(btn('greenhouse'));
  await p.keyboard.press('Escape');
  await okSoon('Escape closes the list and puts the focus back on its button', async () => ({ open: await openLists(p), focus: await focused(p) }), (v) => v.open.length === 0 && v.focus === 'nav-list-greenhouse');
  await p.click(btn('things'));
  await p.focus('#nav-list-things a');   // focus inside the list, then Escape
  await p.keyboard.press('Escape');
  await okSoon('Escape with the focus inside the list closes it and the button gets the focus', async () => ({ open: await openLists(p), focus: await focused(p) }), (v) => v.open.length === 0 && v.focus === 'nav-list-things');

  // ---------------------------------------------------------------- 3. the keyboard
  await p.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
  await p.focus(btn('visit'));
  await p.keyboard.press('Tab');
  ok('Tab goes from one button to the next (the closed lists are skipped)', (await focused(p)) === 'nav-list-things', await focused(p));
  await p.keyboard.press('Shift+Tab');
  await p.keyboard.press('Enter');
  await okSoon('Enter on a button opens its list', () => openLists(p), (v) => v.join() === 'nav-list-visit');
  await p.keyboard.press('Tab');
  ok('Tab goes into the open list, to its first line', (await p.evaluate(() => document.activeElement.getAttribute('href'))) === '#visit' && await p.evaluate(() => !!document.activeElement.closest('#nav-list-visit')), await focused(p));
  await p.keyboard.press('Shift+Tab');
  await p.keyboard.press('Space');
  await okSoon('Space on the same button closes it', () => openLists(p), (v) => v.length === 0);
  await p.keyboard.press('Space');
  await okSoon('Space on a button opens its list', () => openLists(p), (v) => v.join() === 'nav-list-visit');
  const nLines = MENU[0][2].length;
  for (let i = 0; i < nLines; i++) await p.keyboard.press('Tab');   // one Tab per line: the focus is on the last line
  ok('Tab goes down the lines of the open list one by one, the focus is on the last line', (await p.evaluate(() => document.activeElement.getAttribute('href'))) === MENU[0][2][nLines - 1][1] && (await openLists(p)).join() === 'nav-list-visit', await focused(p));
  await p.keyboard.press('Tab');
  await okSoon('Tab past the last line of the list leaves it, and the list closes (focus is on the next button)', async () => ({ open: await openLists(p), focus: await focused(p) }), (v) => v.open.length === 0 && v.focus === 'nav-list-things');
  await p.keyboard.press('Enter');
  await p.keyboard.press('Escape');
  await okSoon('Enter, then Escape: open, closed, focus still on the button', async () => ({ open: await openLists(p), focus: await focused(p) }), (v) => v.open.length === 0 && v.focus === 'nav-list-things');

  // ---------------------------------------------------------------- 4. every line goes to its place
  const rest = async (f, from) => {
    for (const end = Date.now() + ms(3000); from !== undefined && Date.now() < end && (await f.evaluate(() => Math.round(scrollY))) === from; await sleep(50));   // the glide has started
    let last = null, same = 0;
    for (const end = Date.now() + ms(20000); same < 5 && Date.now() < end; await sleep(100)) { const y = await f.evaluate(() => Math.round(scrollY)); same = y === last ? same + 1 : 0; last = y; }
    await settled({ evaluate: (fn, arg) => f.evaluate(fn, arg) }, 0);
  };
  const look = (id) => p.evaluate((id) => {
    const t = document.getElementById(id), r = t.getBoundingClientRect();
    return { shown: t.getClientRects().length > 0, top: Math.round(r.top * 10) / 10, header: Math.round(document.getElementById('site-header').getBoundingClientRect().bottom * 10) / 10,
      pad: parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop), y: Math.round(scrollY), max: document.documentElement.scrollHeight - innerHeight, hash: location.hash,
      open: document.querySelectorAll('.nav-group.is-open').length, tab: ['school', 'parties', 'corporate'].find((k) => document.getElementById('gtab-' + k) && document.getElementById('gtab-' + k).getAttribute('aria-selected') === 'true') || '' };
  }, id);
  for (const [group, lid, lines] of MENU) {
    for (const [text, href] of lines) {
      const id = href.slice(1);
      await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));   // each line from a page that has just been at the top, so the boxes below were never on the screen
      await rest(p);
      await p.click(btn(lid));
      const from = await p.evaluate(() => Math.round(scrollY));
      await p.click(`#nav-list-${lid} a[href="${href}"]`);
      await rest(p, from);
      const s = await look(TABS[href] ? 'groups' : id);
      const line = s.pad + (OWN_MARGIN[href] || 0);
      const atEnd = s.y >= s.max - 1;
      ok(`${group} > ${text}: lands on ${TABS[href] ? '#groups with the ' + TABS[href] + ' tab chosen' : href} on the usual line under the header, and the list closes`,
        s.shown && (Math.abs(s.top - line) <= TOL || (atEnd && s.top > line)) && s.top >= s.header - 1 && s.open === 0 && (!TABS[href] || s.tab === TABS[href]),
        `${TABS[href] ? '#groups' : href} starts ${s.top}px from the top, the line is ${line}px, header ends at ${s.header}px, ${s.open} list(s) open, tab "${s.tab}", address ${s.hash || '(nothing)'}`);
    }
  }
  await p.context().close();

  // ---------------------------------------------------------------- 5. the group of the section in the middle of the screen is lit
  {
    const q = await open(browser, base, 'index.html', errs, { viewport: { width: 1440, height: 900 } });
    await q.addStyleTag({ content: '#wa-problems{display:none!important}' });
    const sections = await q.evaluate(() => [...document.querySelectorAll('main > section[id], #farm, #farm-cards')].filter((s) => s.getClientRects().length > 0).map((s) => [s.id, s.dataset.nav || s.id]));
    const groupOf = (key) => (Object.entries(SPY).find(([, keys]) => keys.includes(key)) || [''])[0];
    const bad = [];
    for (const [id, key] of sections) {
      await q.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center', behavior: 'instant' }), id);
      const want = groupOf(key);
      const lit = await until(q, (w) => { const l = [...document.querySelectorAll('.nav-group-btn[aria-current]')].map((b) => b.textContent.trim()); return (w ? l.length === 1 && l[0] === w : l.length === 0) ? 'yes' : false; }, want, 4000);
      if (!lit) bad.push(`#${id}: ${(await q.evaluate(() => [...document.querySelectorAll('.nav-group-btn[aria-current]')].map((b) => b.textContent.trim()).join('+'))) || 'nothing lit'} instead of ${want || 'nothing'}`);
    }
    ok(`scrolling to each of the ${sections.length} sections lights the button of its group and no other (the hero, with no group, lights nothing)`, bad.length === 0, bad.join('; '));
    // a line whose address is exactly the section in the middle is lit too (when its list is open): Store > Everything in the store for #shop
    await q.evaluate(() => document.getElementById('shop').scrollIntoView({ block: 'center', behavior: 'instant' }));
    await until(q, () => !!document.querySelector('.nav-group-btn[aria-current]'), null, 4000);
    await q.click('button[aria-controls="nav-list-store"]');
    const lit = await q.evaluate(() => [...document.querySelectorAll('.nav-group-list a[aria-current]')].map((a) => a.textContent.trim() + ' ' + a.getAttribute('href')));
    ok('with #shop in the middle, the line "Everything in the store" is lit in the open list, and only the lines that go to #shop', lit.join('|') === 'Everything in the store #shop', lit.join('|'));
    await q.click('button[aria-controls="nav-list-store"]');   // closed again: the button is not "open" (white) but lit
    await okSoon('the lit button looks like the lit links did (sun yellow with an ink ring)', () => q.evaluate(() => { const b = document.querySelector('.nav-group-btn[aria-current]'), cs = getComputedStyle(b); return { bg: cs.backgroundColor, shadow: cs.boxShadow }; }),
      (v) => v.bg === 'rgb(255, 201, 40)' && v.shadow === 'rgb(58, 36, 22) 0px 0px 0px 2.5px inset', 4000);
    await q.context().close();
  }

  // ---------------------------------------------------------------- 6. things only some seasons show, and the red dot
  for (const [name, time, season] of [['fall', '2026-10-02T12:00:00-04:00', 'fall'], ['summer', '2026-07-01T12:00:00-04:00', 'summer'], ['winter', '2026-12-15T12:00:00-05:00', 'winter'], ['spring', '2026-05-01T12:00:00-04:00', 'spring']]) {
    const q = await open(browser, base, 'index.html', errs, { viewport: { width: 1440, height: 900 }, time });
    await q.addStyleTag({ content: '#wa-problems{display:none!important}' });
    const hrefs = await q.evaluate(() => Object.fromEntries([...document.querySelectorAll('.nav-group-list a[data-seasons]')].map((a) => [a.textContent.trim(), a.getAttribute('href')])));
    const wantHref = (h) => (SEASONAL[h].split(' ').includes(season) ? h : '#farm');
    ok(`${name}: "Playgrounds" goes to its card when the farm shows it, and to #farm when it does not`, hrefs['Playgrounds'] === wantHref('#farm-playgrounds'), JSON.stringify(hrefs));
    const cards = await q.evaluate(() => ['farm-playgrounds'].map((id) => document.getElementById(id).getClientRects().length > 0));
    ok(`${name}: a line goes to a card only when the card is on the page (shown: ${cards.join(', ')})`, cards.every((c) => c === (season !== 'winter')) && [hrefs['Playgrounds']].every((h, i) => (h === '#farm') === !cards[i]), JSON.stringify([cards, hrefs]));
    const animals = await q.evaluate(() => { const a = [...document.querySelectorAll('.nav-group-list a')].filter((x) => x.textContent.trim() === 'Meet the animals'), b = document.getElementById('animals'); return { lines: a.length, href: a[0] && a[0].getAttribute('href'), seasonal: a[0] && a[0].hasAttribute('data-seasons'), shown: !!b && b.getClientRects().length > 0, goats: !!b && /goat/i.test(b.textContent), farm: !!b && /farm animals/i.test(b.textContent), oldGoatsLine: [...document.querySelectorAll('.nav-group-list a')].some((x) => /Meet the goats/.test(x.textContent)) }; });
    ok(`${name}: one "Meet the animals" line (no "Meet the goats"), always to #animals, a block that is on the page and speaks of the farm animals and the goats`, animals.lines === 1 && animals.href === '#animals' && !animals.seasonal && animals.shown && animals.goats && animals.farm && !animals.oldGoatsLine, JSON.stringify(animals));
    const dot = await q.evaluate(() => { const b = document.querySelector('.nav-tomato .nav-group-btn'), a = getComputedStyle(b, '::after'); return { content: a.content, w: a.width, color: a.backgroundColor, onOthers: [...document.querySelectorAll('.nav-group:not(.nav-tomato):not(.has-coming) .nav-group-btn')].filter((x) => getComputedStyle(x, '::after').content !== 'none').length }; });
    ok(`${name}: the red dot is ${season === 'fall' ? 'on the Things to Do button' : 'not there'}, and on no other button`, dot.onOthers === 0 && (season === 'fall' ? dot.content === '""' && dot.w === '9px' : dot.content === 'none'), JSON.stringify(dot));
    if (season === 'fall') {
      // the picker in the first screen changes the season on the page: the two lines follow it
      await q.click('#season-switch button[data-season="winter"]');
      await okSoon('fall: choosing Winter in the first-screen picker sends the two lines to #farm', () => q.evaluate(() => [...document.querySelectorAll('.nav-group-list a[data-seasons]')].map((a) => a.getAttribute('href')).join()), (v) => v === '#farm', 4000);
      await q.click('#season-switch button[data-season="spring"]');
      await okSoon('...and Spring sends them back to their cards', () => q.evaluate(() => [...document.querySelectorAll('.nav-group-list a[data-seasons]')].map((a) => a.getAttribute('href')).join()), (v) => v === '#farm-playgrounds', 4000);
    }
    await q.context().close();
  }
  {   // the other pages: the Playgrounds line in winter (index.html#farm) and fall (index.html#farm-playgrounds); "Meet the animals" always goes to index.html#animals
    for (const [time, wantA] of [['2026-12-15T12:00:00-05:00', 'index.html#farm'], ['2026-10-02T12:00:00-04:00', 'index.html#farm-playgrounds']]) {
      const q = await open(browser, base, 'wise-pie.html', errs, { viewport: { width: 1440, height: 900 }, time });
      const got = await q.evaluate(() => [...document.querySelectorAll('.nav-group-list a[data-seasons]')].map((a) => a.getAttribute('href')));
      ok(`wise-pie.html on ${time.slice(0, 10)}: "Playgrounds" goes to ${wantA}`, got[0] === wantA, got.join());
      const animalsHref = await q.evaluate(() => [...document.querySelectorAll('.nav-group-list a')].filter((x) => x.textContent.trim() === 'Meet the animals').map((x) => x.getAttribute('href')));
      ok(`wise-pie.html on ${time.slice(0, 10)}: "Meet the animals" goes to index.html#animals`, animalsHref.length === 1 && animalsHref[0] === 'index.html#animals', animalsHref.join());
      await q.context().close();
    }
  }

  // ---------------------------------------------------------------- 6b. "coming up": the Christmas trees line is bold with a red dot from 60 days before tree season until it ends, and its group's button has the dot too
  for (const [time, want] of [['2026-07-01T12:00:00-04:00', false], ['2026-09-20T12:00:00-04:00', false], ['2026-10-02T12:00:00-04:00', true], ['2026-12-01T12:00:00-05:00', true], ['2026-12-15T12:00:00-05:00', false]]) {
    const q = await open(browser, base, 'index.html', errs, { viewport: { width: 1440, height: 900 }, time });
    const c = await q.evaluate(() => {
      const a = [...document.querySelectorAll('.nav-group-list a')].find((x) => x.textContent.trim().startsWith('Christmas trees')), g = a && a.closest('.nav-group');
      const dot = (el, ps) => { const s = getComputedStyle(el, ps); return s.content === '""' && s.width === '9px'; };
      return { line: !!a && a.classList.contains('is-coming'), weight: a && getComputedStyle(a).fontWeight, lineDot: !!a && dot(a, '::after'), group: !!g && g.classList.contains('has-coming'), btnDot: !!g && dot(g.querySelector('.nav-group-btn'), '::after'), hint: a ? [...a.parentNode.querySelectorAll('.sr-only')].map((x) => x.textContent.trim()).join() : '', words: a ? a.textContent.trim() : '', others: document.querySelectorAll('.nav-group.has-coming').length };
    });
    const inSeason = time.startsWith('2026-12-01');
    ok(`${time.slice(0, 10)}: Christmas trees ${want ? 'is bold with a red dot and its group button has the dot' : 'is a plain line'}${want ? (inSeason ? '' : ' (and a screen reader hears "coming soon")') : ''}`,
      want ? c.line && Number(c.weight) >= 700 && c.lineDot && c.group && c.btnDot && c.others === 1 && c.words === 'Christmas trees' && (inSeason ? c.hint === '' : /coming soon/i.test(c.hint)) : !c.line && !c.lineDot && !c.group && c.others === 0 && c.hint === '', JSON.stringify(c));
    await q.context().close();
  }

  // ---------------------------------------------------------------- 7. an extra page: the lists open and close there too, and a line leads to the home page
  {
    const q = await open(browser, base, 'strawberry-picking.html', errs, { viewport: { width: 1440, height: 900 } });
    await q.click(btn('store'));
    await okSoon('strawberry-picking.html: a click on Store opens its list', () => openLists(q), (v) => v.join() === 'nav-list-store');
    await q.keyboard.press('Escape');
    await okSoon('...and Escape closes it, focus back on the button', async () => ({ open: await openLists(q), focus: await focused(q) }), (v) => v.open.length === 0 && v.focus === 'nav-list-store');
    await q.click(btn('about'));
    await Promise.all([q.waitForURL(/index\.html#reviews/, { timeout: ms(30000) }), q.click('#nav-list-about a[href="index.html#reviews"]')]);
    await settled(q, 0);
    ok('a line on an extra page (About Us > Reviews) leads to the home page, at #reviews', /index\.html#reviews$/.test(q.url()), q.url());
    await q.context().close();
  }

  // ---------------------------------------------------------------- 8. the phone menu: each name is a small heading, every line is a chip under it
  {
    const q = await open(browser, base, 'index.html', errs, { viewport: { width: 390, height: 800 }, touch: true });
    await q.addStyleTag({ content: '#wa-problems{display:none!important}' });
    const hidden = await q.evaluate(() => [...document.querySelectorAll('.nav-group-btn')].every((b) => getComputedStyle(b).display === 'none'));
    ok('phone 390: the seven drop-down buttons are not there (the menu button is)', hidden && (await q.evaluate(() => getComputedStyle(document.getElementById('menu-toggle')).display !== 'none')));
    await q.click('#menu-toggle');
    await until(q, () => { const n = document.getElementById('nav'); return n.classList.contains('is-open') && getComputedStyle(n).opacity === '1'; }, null, 5000);
    const m = await q.evaluate(() => {
      const nav = document.getElementById('nav'), titles = [...nav.querySelectorAll('.nav-group-title')];
      const cs = (e) => getComputedStyle(e);
      const lines = [...nav.querySelectorAll('.nav-group-list a')];
      return { titles: titles.map((t) => [t.textContent.trim(), cs(t).display, t.getBoundingClientRect().width > 0]), lines: lines.length, visibleLines: lines.filter((a) => a.getClientRects().length > 0 && cs(a).visibility !== 'hidden').length,
        tall: Math.min(...lines.map((a) => a.getBoundingClientRect().height)), wide: Math.max(...lines.map((a) => a.getBoundingClientRect().right)), vw: innerWidth, scrollX: document.documentElement.scrollWidth - innerWidth };
    });
    ok('phone 390: each group name shows as a small heading, in the same order', JSON.stringify(m.titles.map((t) => t[0])) === JSON.stringify(MENU.map((g) => g[0])) && m.titles.every((t) => t[1] === 'block' && t[2]), JSON.stringify(m.titles));
    ok(`phone 390: all ${LINES} lines are visible links (chips), at least 44px tall, none wider than the screen, and the page does not scroll sideways`, m.lines === LINES && m.visibleLines === LINES && m.tall >= 44 && m.wide <= m.vw && m.scrollX <= 0, JSON.stringify(m));
    await q.click('#nav a[href="#shop-pantry"]');
    await rest(q);
    const s = await q.evaluate(() => ({ top: Math.round(document.getElementById('shop-pantry').getBoundingClientRect().top), header: Math.round(document.getElementById('site-header').getBoundingClientRect().bottom), menu: document.getElementById('nav').classList.contains('is-open'), locked: document.body.classList.contains('nav-lock') }));
    ok('phone 390: a click on Store > Pantry & bakery closes the menu and puts #shop-pantry under the header', !s.menu && !s.locked && s.top >= s.header - 2 && s.top <= s.header + 30, JSON.stringify(s));
    await q.context().close();
  }

  // ---------------------------------------------------------------- 9. Spanish: the words, and the bar
  {
    const q = await open(browser, base, 'index.html', errs, { viewport: { width: 1440, height: 900 }, lang: 'es' });
    const es = await q.evaluate(() => [...document.querySelectorAll('.nav > ul > li.nav-group')].map((g) => g.querySelector('.nav-group-btn').textContent.trim().replace(/\s+/g, ' ')));
    ok('Spanish: the seven buttons are in Spanish', es.join('|') === 'Visita|Qué hacer|GreenHouse|Tienda|Grupos y fiestas|Quiénes somos|Contacto', es.join('|'));
    const fit = await q.evaluate(() => { const hi = document.querySelector('.header-inner').getBoundingClientRect(), n = document.querySelector('.nav').getBoundingClientRect(), l = document.querySelector('[data-lang-menu]').getBoundingClientRect(); return { navRight: n.right, langLeft: l.left, innerRight: hi.right, langRight: l.right }; });
    ok('Spanish 1440: the bar fits on one line (the Reserve button ends before the language button, which ends inside the header)', fit.navRight <= fit.langLeft + 0.5 && fit.langRight <= fit.innerRight + 0.5, JSON.stringify(fit));
    await q.click(btn('things'));
    const lines = await q.evaluate(() => [...document.querySelectorAll('#nav-list-things a')].map((a) => a.textContent.trim()));
    ok('Spanish: the lines of Things to Do are in Spanish', lines.join('|') === 'Qué hay de temporada|Recoge tú mismo|Tomates y albahaca|Flores para cortar|Paseos y extras|Conoce a los animales|Parques infantiles|Fotografía', lines.join('|'));
    await q.context().close();
  }
});
