// order: 330
// browser: yes
// quick: yes
// covers: js/farm-map-data.js, js/map-art.js, js/features.js, css/features.css, tools/farm_map.py, tools/saved-map.json
/* The farm map (home page and First-visit page): drawn from js/farm-map-data.js, tappable legend, keyboard, "Show names", languages,
 * phone width; names typed into the map can never inject markup; an empty or missing map hides the section. */
import { run, open, ok, okSoon, until } from './lib.mjs';

const HOSTILE = `window.WISE_ACRES_MAP = { size: { width: 380, height: 587 }, north: 'up', items: [
  { id: 'a1', type: 'pin', kind: 'checkin', label: '</script><script>window.__pwned=1</script> "q" <b>x</b> <img src=x onerror=window.__pwned=2>', note: '<i>note</i> & "quotes"', pts: [[100, 200]] },
  { id: 'a2', type: 'pin', kind: 'spaceship', label: 'Unknown kind', note: '', pts: [[200, 300]] },
  { id: 'a3', type: 'area', kind: 'pumpkins', label: 'constructor', note: '__proto__', pts: [[40, 330], [180, 330], [180, 400], [40, 400]] },
  { id: 'a4', type: 'text', kind: 'other', label: 'A text note', note: '', pts: [[300, 290]] },
] };`;

const mapState = (p) => p.evaluate(() => {
  const m = document.querySelector('#farm-map');
  const data = window.WISE_ACRES_MAP;
  const named = ((data && data.items) || []).filter((i) => (i.type === 'pin' || i.type === 'area' || i.type === 'path') && i.label);
  return {
    hidden: m.hidden, rendered: m.dataset.rendered || '', items: m.querySelectorAll('.map-item').length, points: named.length,
    keys: new Set(named.map((i) => i.kind + '|' + i.label)).size, legend: m.querySelectorAll('.map-legend button').length,
    groups: [...m.querySelectorAll('.map-legend h3')].map((h) => h.textContent), svgLabel: (m.querySelector('svg') || { getAttribute: () => '' }).getAttribute('aria-label'),
    links: [...m.querySelectorAll('a')].map((a) => a.href).filter((h) => /maps\.apple\.com|waze\.com|google\.com\/maps/.test(h)).length,
  };
});

await run('map', async ({ browser, base, errs }) => {
  // the real map, on both pages
  for (const page of ['index.html', 'first-visit.html']) {
    const p = await open(browser, base, page, errs);
    await until(p, () => document.querySelector('#farm-map') && document.querySelector('#farm-map').dataset.rendered === '1');
    const s = await mapState(p);
    ok(`${page}: the map is drawn from js/farm-map-data.js`, !s.hidden && s.rendered === '1' && s.points > 0 && s.items === s.points, JSON.stringify({ items: s.items, points: s.points }));
    ok(`${page}: one legend button for each kind of thing`, s.legend === s.keys, `${s.legend} buttons for ${s.keys} kinds`);
    if (page === 'index.html') ok('index.html: Apple Maps, Waze and Google Maps links under the map', s.links >= 3, String(s.links));   // First-visit has them in its other sections
    if (page === 'index.html') {
      ok('legend groups are in English', s.groups.length >= 3 && s.groups[0] === 'Getting here', s.groups.join('|'));
      // The detail card is always in the page (a status area for screen readers): it is "open" when it has words in it, empty when closed.
      const card = () => p.evaluate(() => { const d = document.querySelector('#farm-map .map-detail'); return { words: d.textContent.trim(), visible: d.getBoundingClientRect().height > 2, /* closed = a 1 px clipped box (CSS :empty) */ active: document.querySelectorAll('#farm-map .map-item.is-active').length, pressed: document.querySelectorAll('#farm-map .map-legend button[aria-pressed=true]').length }; });
      await p.locator('#farm-map .map-legend button').nth(1).scrollIntoViewIfNeeded();
      await p.locator('#farm-map .map-legend button').nth(1).click();
      await okSoon('legend click opens the detail card and highlights the item on the map', card, (v) => v.words && v.visible && v.active >= 1 && v.pressed === 1);
      await p.locator('#farm-map .map-legend button').nth(1).click();
      await okSoon('the same button again closes it', card, (v) => v.words === '' && !v.visible && v.active === 0 && v.pressed === 0);
      // keyboard: the picture is mouse/touch only (no tab stops, hidden from screen readers); the legend list is the way in
      ok('keyboard: the picture is not a tab stop and is hidden from screen readers', await p.evaluate(() => document.querySelector('#farm-map svg').getAttribute('aria-hidden') === 'true' && !document.querySelector('#farm-map .map-item[tabindex]')));
      await p.locator('#farm-map .map-legend button').nth(2).focus();
      await p.keyboard.press('Enter');
      await okSoon('keyboard: Enter on a legend button opens its card and keeps the focus on it', async () => ({ ...(await card()), focus: await p.evaluate(() => document.activeElement.tagName + ':' + document.activeElement.getAttribute('aria-pressed')) }), (v) => v.words && v.focus === 'BUTTON:true');
      const pressed = () => p.evaluate(() => document.querySelector('#farm-map .map-toggle').getAttribute('aria-pressed') + '/' + document.querySelector('#farm-map .map-wrap').classList.contains('names-off'));
      const before = await pressed();
      await p.click('#farm-map .map-toggle');
      await okSoon('"Show names" switches the name ribbons off and on', pressed, (v) => v !== before);
    }
    await p.context().close();
  }

  // phone: nothing sticks out sideways
  let p = await open(browser, base, 'index.html', errs, { viewport: { width: 390, height: 844 } });
  await until(p, () => document.querySelector('#farm-map').dataset.rendered === '1');
  ok('phone: no sideways page scroll with the map', await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  await p.context().close();

  // other languages: headings and the map's spoken name are translated
  for (const lang of ['es', 'hi', 'zh', 'vi']) {
    p = await open(browser, base, 'index.html', errs, { lang });
    await until(p, () => document.querySelector('#farm-map').dataset.rendered === '1');
    const s = await mapState(p);
    ok(`${lang}: legend headings and the map's name are translated`, s.groups.length > 0 && !s.groups.includes('Getting here') && s.svgLabel !== 'Illustrated map of the farm', JSON.stringify({ g: s.groups[0], l: s.svgLabel }));
    await p.context().close();
  }

  // names typed in the Farm Map Marker are plain text, whatever they contain
  let dialogs = 0;
  p = await open(browser, base, 'index.html', errs, { routes: async (pg) => { pg.on('dialog', (d) => { dialogs++; d.dismiss(); }); await pg.route('**/js/farm-map-data.js', (r) => r.fulfill({ contentType: 'application/javascript', body: HOSTILE })); } });
  await until(p, () => document.querySelector('#farm-map').dataset.rendered === '1');
  const h = await p.evaluate(() => ({ pwned: window.__pwned || 0, injected: document.querySelectorAll('#farm-map img, #farm-map script, #farm-map iframe, #farm-map [onerror]').length, legend: [...document.querySelectorAll('#farm-map .map-legend .ml')].map((e) => e.textContent), proto: Object.prototype.hasOwnProperty.call({}, 'x') }));
  ok('hostile names stay plain text (no script, no element, no dialog)', h.pwned === 0 && h.injected === 0 && dialogs === 0 && h.legend.some((t) => t.includes('</script>')), JSON.stringify(h).slice(0, 220));
  ok('names like "constructor" and an unknown kind do not break the map', h.legend.includes('constructor') && h.legend.includes('Unknown kind') && (await p.locator('#farm-map .map-item').count()) === 3);
  await p.context().close();

  // no points: the section is hidden on both pages
  for (const page of ['index.html', 'first-visit.html']) {
    p = await open(browser, base, page, errs, { routes: async (pg) => { await pg.route('**/js/farm-map-data.js', (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.WISE_ACRES_MAP = null;' })); } });
    ok(`${page}: no map data hides the section`, await p.evaluate(() => document.querySelector('#farm-map').hidden));
    await p.context().close();
  }
});
