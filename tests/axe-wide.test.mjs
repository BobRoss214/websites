// order: 305
// browser: yes
// quick: no
// covers: css/*, *.html, pages/*, js/*
/* Accessibility, wide: the real axe-core (WCAG 2.0/2.1 A and AA plus best practices; no rule is switched off) over 35 pages chosen from the whole
 * matrix of 6 pages x 5 languages x 4 seasons (the clock is moved into each) x phone and desktop x light and dark, so that EVERY PAIR of those is in
 * it (checked below), plus the home page in all four seasons on both sizes and the 404 page; then 18 states a normal load never shows (photo viewer,
 * language / More / phone / "Remind me" menus, achievement badge, signup with an error, Site check box with and without problems, the language offer,
 * the drive-time answer, the map legend note, the notice bar, a season picked in the hero) and every tab of "What's in season" and "What's on the farm". Then what axe
 * cannot do: (1) text on a gradient or a picture, which axe reports as "could not decide": the first screen of 20 of those pages is photographed with
 * the text made invisible and the colour of the text is compared with the pixels behind it (WCAG 4.5:1, large text 3:1); (2) a focus mark on every
 * control (2 pages); (3) no keyboard trap: the menus and the photo viewer open with Enter, Tab leaves a menu, Esc closes and puts the focus back on
 * the button. Scroll animations are paused (a colour caught half-way through a fade is not the page). The site is light only (color-scheme: only
 * light): the dark runs prove that a browser or phone set to dark mode still gets the same, passing page.
 * Run time: written for about two minutes on a quiet 4-core computer (it runs four pages at a time); it is slower when the computer is busy.
 *   AXE_FULL=1 runs the whole matrix (480 pages, light and dark, every pixel check; about 20 times longer)
 *   AXE_ONLY='wise-pie.html phone en summer' one page of the matrix ('^index.html desktop' and so on: a pattern), AXE_STATES='Remind' the states whose name matches
 *   AXE_SHOTS=folder saves the picture each pixel check was measured on.   Needs axe-core (AXE_PATH, or npm i -D axe-core). */
import fs from 'node:fs';
import { run, open, ok, info, axeSource, skip, until } from './lib.mjs';

const axe = axeSource();
if (!axe) skip('axe-core is not installed (npm i -D axe-core, or set AXE_PATH)');

const EXTRA = `WISE_ACRES.week = { updated: '2026-10-01', note: 'Tomatoes are at their best. Bring a bucket!', crops: { tomatoes: 'peak', pumpkins: 'starting' },
  days: [ { date: '2026-10-02', farm: 'few', pizza: 'open', note: 'Rain possible' }, { date: '2026-10-03', farm: 'full', pizza: 'full' }, { date: '2026-10-04', farm: 'closed', pizza: 'none' } ], demo: true };
WISE_ACRES.signup.demo = true; WISE_ACRES.reviewUrl = 'https://g.page/r/example/review';
WISE_ACRES.community = [ { src: 'assets/photos/goat-with-pumpkins.webp', alt: 'A baby goat sniffing small pumpkins', by: '@someone on Instagram', url: 'https://www.instagram.com/p/xyz/' }, { src: 'assets/photos/mums-and-red-shed.webp', alt: 'Mums by a shed', by: 'A visitor' } ];
WISE_ACRES.entrancePhoto = { src: 'assets/photos/mums-and-red-shed.webp', alt: 'The farm gate on Hartis Road', caption: 'Look for this gate.' };`;
const RULES = { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } };
const STILL = '.reveal{opacity:1!important;transform:none!important}*{animation:none!important;transition:none!important}.crop{transform:scale(1)!important}';
// the owner's Site check box is drawn over the page on this test computer (it shows only on the farm's own computer or with ?check): visitors never see it, so the page runs
// leave it out and the states below have it
const VISITOR = STILL + '#wa-problems{display:none!important}';
const PAGES = ['index.html', 'first-visit.html', 'pumpkin-patch.html', 'school-field-trips.html', 'strawberry-picking.html', 'wise-pie.html'];
const LANGS = ['en', 'es', 'hi', 'zh', 'vi'];
const SEASONS = ['spring', 'summer', 'fall', 'winter'];
const WHEN = { spring: '2027-05-10T12:00:00-04:00', summer: '2027-06-25T12:00:00-04:00', fall: '2026-10-02T12:00:00-04:00', winter: '2026-12-01T12:00:00-05:00' };   // the clock decides the season
const SIZES = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };

/** Runs the tasks `n` at a time (each returns { rows: [[name, ok, detail]], errs }); results in order. */
async function pool(tasks, label, n = 4) {
  const out = new Array(tasks.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    for (let k; (k = next++) < tasks.length;) {
      try { out[k] = await tasks[k](); } catch (e) { out[k] = { rows: [[`${label(k)}: the check ran to the end`, false, String(e && e.message).split('\n')[0]]], errs: [] }; }
    }
  }));
  return out;
}

/* ------------------------------------------------------------------ axe, in the page */
const AXE_RUN = async ([rules, scope]) => {
  const res = await window.axe.run(scope ? document.querySelector(scope) : document, rules);
  const contrast = res.incomplete.find((i) => i.id === 'color-contrast');
  return {
    v: res.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary || '').replace(/\s+/g, ' ').slice(0, 160)) })),
    undecided: contrast ? contrast.nodes.length : 0,
  };
};
const says = (r) => r.v.map((v) => `[${v.impact}] ${v.id}: ${v.nodes.join(' | ')}`).join(' ;; ').slice(0, 700);

/* ------------------------------------------------------------------ text on gradients and pictures (what axe cannot decide) */
// Runs in a blank page: for each text, its colour against the pixels of a screenshot taken with the text made invisible. The 3rd percentile of the
// contrast: a border or an edge inside the box is not the text.
const DECODE = async ({ b64, items }) => {
  const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
  const cv = new OffscreenCanvas(bmp.width, bmp.height), g = cv.getContext('2d'); g.drawImage(bmp, 0, 0);
  const d = g.getImageData(0, 0, bmp.width, bmp.height).data, W = bmp.width;
  const lin = new Float32Array(256); for (let i = 0; i < 256; i++) { const c = i / 255; lin[i] = c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  return items.map((it) => {
    const [tr, tg, tb, ta] = it.color, ratios = [];
    let worst = null;
    for (const [x, y, w, h] of it.rects) {
      const x0 = Math.max(0, Math.ceil(x)), y0 = Math.max(0, Math.ceil(y)), x1 = Math.min(bmp.width, Math.floor(x + w)), y1 = Math.min(bmp.height, Math.floor(y + h));   // only whole pixels inside the line box (the edge row can be a border)
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
        const i = (yy * W + xx) * 4, R = d[i], G = d[i + 1], B = d[i + 2], mix = (v, t) => Math.round(ta * t + (1 - ta) * v);
        const b = 0.2126 * lin[R] + 0.7152 * lin[G] + 0.0722 * lin[B], a = 0.2126 * lin[mix(R, tr)] + 0.7152 * lin[mix(G, tg)] + 0.0722 * lin[mix(B, tb)];
        const q = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        ratios.push(q); if (!worst || q < worst[0]) worst = [q, R, G, B];
      }
    }
    ratios.sort((p, q) => p - q);
    return ratios.length ? { p3: ratios[Math.floor(ratios.length * 0.03)], n: ratios.length, worst: worst.slice(1).join(',') } : null;
  });
};
// !important inside a layer beats the page's own !important: every text (and svg text) becomes invisible, nothing moves
const GHOST = '@layer ghost{*,*::before,*::after{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;text-decoration-color:transparent!important}svg text,svg tspan{fill:transparent!important;stroke:none!important}.bee-fly,#critters{visibility:hidden!important}}';   // (the bee that flies across the first screen is decoration, and moves)
/** The first screen of the page (scroll 0), text that axe could not decide. Text inside aria-hidden art (the farm scene's signs) is decoration. */
async function firstScreen(p, helper, tag = '') {
  // nothing may move between measuring the text and photographing it: fonts in first, and the measuring is repeated after the photograph
  await p.evaluate(() => document.fonts.ready);
  const sels = await p.evaluate(async () => {
    const res = await window.axe.run(document, { runOnly: { type: 'rule', values: ['color-contrast'] } });
    return (res.incomplete[0] ? res.incomplete[0].nodes : []).map((n) => n.target[0]).filter((s) => {
      const el = document.querySelector(s); if (!el || el.closest('[aria-hidden="true"]')) return false;
      const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0;
    });
  });
  const looks = await p.evaluate((sels) => sels.map((sel) => {
    const el = document.querySelector(sel), cs = getComputedStyle(el), cstr = el instanceof SVGElement ? cs.fill : cs.color;
    if (cs.visibility === 'hidden' || cs.display === 'none' || !/^rgb/.test(cstr)) return null;
    const m = cstr.match(/[\d.]+/g).map(Number), fs = parseFloat(cs.fontSize);
    return { color: [m[0], m[1], m[2], m.length > 3 ? m[3] : 1], large: fs >= 24 || (parseInt(cs.fontWeight, 10) >= 700 && fs >= 18.66) };
  }), sels);
  const style = await p.addStyleTag({ content: GHOST });
  // where every line of text is (the lines that are wholly on the screen, with nothing laid over them: the owner's Site check box, the bottom bar)
  const measure = () => p.evaluate(([sels, looks]) => {
    const out = [];
    sels.forEach((sel, i) => {
      if (!looks[i]) return;
      const el = document.querySelector(sel), rects = [], tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n; (n = tw.nextNode());) { if (!n.nodeValue.trim()) continue; const r = document.createRange(); r.selectNodeContents(n); for (const q of r.getClientRects()) if (q.width > 1 && q.height > 1) rects.push([q.left, q.top, q.width, q.height]); }
      const covered = rects.some(([x, y, w, h]) => y < 3 || y + h > innerHeight - 3 || x < 0 || x + w > innerWidth ||
        [2, w / 2, w - 2].some((dx) => [2, h / 2, h - 2].some((dy) => { const hit = document.elementFromPoint(x + dx, y + dy); return !hit || !(el.contains(hit) || hit.contains(el)); })));
      if (rects.length && !covered) out.push({ sel, rects, color: looks[i].color, large: looks[i].large, text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30) });
    });
    return out;
  }, [sels, looks]);
  let items = [], png = null;
  for (let attempt = 0; attempt < 4; attempt++) {   // a thing that moves (the farm scene, a badge coming in) is waited for: the picture must show what was measured
    items = await measure();
    png = items.length ? await p.screenshot({ animations: 'disabled' }) : null;
    const again = await measure();
    if (!items.length || JSON.stringify(again.map((x) => x.rects)) === JSON.stringify(items.map((x) => x.rects))) break;
    await p.clock.runFor(250);
  }
  if (png && process.env.AXE_SHOTS) fs.writeFileSync(process.env.AXE_SHOTS + '/' + tag.replace(/\W+/g, '-') + '.png', png);   // debugging: the picture the contrast was measured on
  await style.evaluate((e) => e.remove());
  if (!items.length) return { checked: 0, bad: [], undecided: sels.length };
  const res = await helper.evaluate(DECODE, { b64: png.toString('base64'), items: items.map((x) => ({ color: x.color, rects: x.rects })) });
  const bad = [];
  items.forEach((x, k) => { const need = x.large ? 3 : 4.5; if (res[k] && res[k].p3 < need) bad.push(`"${x.text}" ${Math.round(res[k].p3 * 100) / 100}:1 (needs ${need}), text rgb(${x.color.slice(0, 3)}) on rgb(${res[k].worst}) ${x.sel.slice(0, 50)}`); });
  return { checked: items.length, bad, undecided: sels.length };
}

/* ------------------------------------------------------------------ the matrix */
function matrix() {
  const runs = [];
  if (process.env.AXE_FULL === '1') {
    for (const page of PAGES) for (const lang of LANGS) for (const season of SEASONS) for (const size of Object.keys(SIZES)) for (const dark of [false, true]) runs.push({ page, lang, season, size, dark, pixel: true });
    return runs;
  }
  // a Latin square: every page x language, page x season, language x season, page x size, language x size, season x size, and each of those with dark, is in it
  PAGES.forEach((page, pi) => LANGS.forEach((lang, li) => runs.push({ page, lang, season: SEASONS[(pi + li) % 4], size: (li + Math.floor(pi / 3)) % 2 ? 'phone' : 'desktop', dark: (pi * 5 + li) % 3 === 0 })));
  // the home page (the one with a different farm scene in every season) in all four seasons on both sizes
  for (const season of SEASONS) for (const size of Object.keys(SIZES)) if (!runs.some((r) => r.page === 'index.html' && r.season === season && r.size === size)) runs.push({ page: 'index.html', lang: 'en', season, size, dark: false });
  // the pixel check (the slower part) on every home page run and, on the other pages, in summer (the deepest sky) and winter
  runs.forEach((r) => { r.pixel = r.page === 'index.html' || r.season === 'summer' || r.season === 'winter'; });
  runs.push({ page: '404.html', lang: 'en', season: 'fall', size: 'phone', dark: false });
  return runs;
}
const pairs = (runs, a, b) => new Set(runs.map((r) => r[a] + '|' + r[b])).size;

async function matrixRun(browser, base, helper, r) {
  const errs = [], rows = [];
  const plain = r.page === '404.html';   // a page of its own with no scripts: nothing to wait for
  const p = await open(browser, base, r.page, errs, plain ? { viewport: SIZES[r.size], ready: false, time: false } : { viewport: SIZES[r.size], lang: r.lang, time: WHEN[r.season], extra: EXTRA });
  if (r.dark) await p.emulateMedia({ colorScheme: 'dark' });
  await p.addStyleTag({ content: VISITOR });
  await until(p, () => document.readyState === 'complete');
  await p.evaluate(axe);
  const res = await p.evaluate(AXE_RUN, [RULES, null]);
  const season = await p.evaluate(() => document.documentElement.dataset.season || '');
  const dark = r.dark ? await p.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches) : true;
  const tag = `${r.page} ${r.size} ${r.lang} ${r.season}${r.dark ? ' dark' : ''}`;
  rows.push([`axe: ${tag} has no violations`, res.v.length === 0, says(res)]);
  if (r.page !== '404.html' && (season !== r.season || !dark)) rows.push([`axe: ${tag} was the page that was meant (season ${season}, dark mode on: ${dark})`, false, '']);
  const px = r.pixel ? await firstScreen(p, helper, tag) : { undecided: 0, bad: [] };
  if (r.pixel) rows.push([`text on gradients and pictures: the first screen of ${tag} (${px.checked} of ${px.undecided} texts axe could not decide, measured on the pixels)`, px.bad.length === 0, px.bad.join(' | ')]);
  if (r.page === 'index.html' && r.lang === 'en' && r.size === 'desktop' && r.season === 'fall') {
    const boxes = await p.evaluate(() => { const v = (s) => { const e = document.querySelector(s); return !!e && !e.hidden && !e.closest('[hidden]') && e.getBoundingClientRect().height > 0; }; return { week: v('[data-week]'), pizza: v('[data-rel-box]'), countdown: v('[data-countdown]'), signup: v('#signup'), map: v('#farm-map') }; });
    rows.push([`the optional boxes were in the page that axe looked at: this week, pizza countdown, next-season countdown, signup, farm map`, Object.values(boxes).every(Boolean), JSON.stringify(boxes)]);
  }
  await p.context().close();
  return { rows, errs, undecided: px.undecided };
}

/* ------------------------------------------------------------------ the states a normal load does not show */
const waitFor = async (p, fn, arg, what) => { if (!(await until(p, fn, arg, 8000))) throw new Error(what); };
// one page, one or more steps (each step ends in a state that is then checked with axe)
const STATES = [
  { vp: 'desktop', lang: 'zh', steps: [
    ['photo viewer open: a link (zh, desktop)', async (p) => { await p.evaluate(() => document.querySelector('a[data-zoom]').click()); await waitFor(p, () => document.getElementById('lightbox').open, null, 'the viewer did not open'); }],
    ['photo viewer open: a photo (zh, desktop)', async (p) => { await p.keyboard.press('Escape'); await p.clock.runFor(300); await p.evaluate(() => [...document.querySelectorAll('img[data-zoom]')].find((i) => i.getBoundingClientRect().width > 20).click()); await waitFor(p, () => document.getElementById('lightbox').open, null, 'the viewer did not open'); }],
  ] },
  { vp: 'phone', steps: [['photo viewer open on a phone (en)', async (p) => { await p.evaluate(() => [...document.querySelectorAll('img[data-zoom]')].find((i) => i.getBoundingClientRect().width > 20).click()); await waitFor(p, () => document.getElementById('lightbox').open, null, 'the viewer did not open'); }]] },
  { vp: 'desktop', lang: 'hi', steps: [['language menu open (hi, desktop)', async (p) => { await p.click('header .lang-btn'); await waitFor(p, () => !document.querySelector('header .lang-list').hidden, null, 'the menu did not open'); }]] },
  { vp: 'phone', steps: [['language menu open (en, phone)', async (p) => { await p.click('header .lang-btn'); await waitFor(p, () => !document.querySelector('header .lang-list').hidden, null, 'the menu did not open'); }]] },
  { vp: 'desktop', lang: 'es', steps: [
    ['More menu open (es, desktop)', async (p) => { await p.click('.nav-more-btn'); await waitFor(p, () => document.querySelector('.nav-more-btn').getAttribute('aria-expanded') === 'true', null, 'the menu did not open'); }],
    ['"Remind me" menu open (es, desktop)', async (p) => { await p.keyboard.press('Escape'); await p.evaluate(() => document.querySelector('[data-rel-remind]').scrollIntoView({ block: 'center' })); await p.click('[data-rel-remind]'); await waitFor(p, () => !document.getElementById('rel-menu').hidden, null, 'the menu did not open'); }],
  ] },
  { vp: 'phone', lang: 'vi', steps: [['phone menu open (vi)', async (p) => { await p.click('#menu-toggle'); await waitFor(p, () => document.getElementById('menu-toggle').getAttribute('aria-expanded') === 'true', null, 'the menu did not open'); }]] },
  { vp: 'phone', lang: 'hi', steps: [['signup form with an error: nothing typed (hi, phone)', async (p) => { await p.evaluate(() => document.querySelector('#signup').scrollIntoView()); await p.click('#signup button[type=submit]'); await waitFor(p, () => document.querySelector('[data-signup-msg]').textContent.trim().length > 0, null, 'no error message'); }]] },
  { vp: 'desktop', steps: [['signup form with an error: not an email (en, desktop)', async (p) => { await p.fill('#su-email', 'abc'); await p.click('#signup button[type=submit]'); await waitFor(p, () => document.querySelector('[data-signup-msg]').textContent.trim().length > 0, null, 'no error message'); }]] },
  // nothing wrong and no old line: no box at all (by design). So the clock is moved to Oct 6, after a few lines that hide themselves: the calm box that lists them
  { vp: 'desktop', query: 'check', time: '2026-10-06T12:00:00-04:00', steps: [['Site check box, nothing broken, old lines listed (en, desktop)', async (p) => { await waitFor(p, () => !!document.getElementById('wa-problems') && /nothing is broken/i.test(document.getElementById('wa-problems').textContent), null, 'no calm Site check box'); }]] },
  { vp: 'phone', lang: 'zh', query: 'check', extra: EXTRA + "\nWISE_ACRES.hourz = {}; WISE_ACRES.closures = ['2026-13-45']; WISE_ACRES.week.days[0].farm = 'maybe';", steps: [['Site check box with problems (zh, phone)', async (p) => { await waitFor(p, () => !!document.getElementById('wa-problems') && document.querySelectorAll('#wa-problems li').length > 0, null, 'no list of problems'); }]] },
  { vp: 'phone', locale: 'es-ES', steps: [['language offer bar (browser in Spanish, phone)', async (p) => { await waitFor(p, () => !!document.querySelector('.lang-offer'), null, 'no offer bar'); }]] },
  { vp: 'desktop', lang: 'es', routes: async (pg) => { await pg.route(/nominatim|osrm|openstreetmap/, (r) => r.fulfill({ contentType: 'application/json', body: '[]' })); }, steps: [['drive-time form with an answer: address not found (es, desktop)', async (p) => { await p.evaluate(() => document.querySelector('#drive-form').scrollIntoView({ block: 'center' })); await p.fill('#drive-addr', '1 Main St, Nowhere'); await p.click('#drive-form button[type=submit]'); await waitFor(p, () => document.querySelector('#drive-result').textContent.trim().length > 0, null, 'no answer in the drive-time box'); }]] },
  { vp: 'phone', lang: 'vi', steps: [['map legend item chosen, its note shown (vi, phone)', async (p) => { await p.evaluate(() => document.querySelector('.map-legend button, .map-legend [role=button]').scrollIntoView()); await p.click('.map-legend button, .map-legend [role=button]'); await waitFor(p, () => !document.querySelector('.map-detail').hidden, null, 'no note shown'); }]] },
  { vp: 'phone', lang: 'es', extra: EXTRA + "\nWISE_ACRES.notice = 'Closed Saturday for rain. Sorry!';", steps: [['notice bar (es, phone)', async (p) => { await waitFor(p, () => !!document.getElementById('site-notice'), null, 'no notice bar'); }]] },
  { vp: 'desktop', lang: 'vi', steps: [
    ['achievement badge (vi, desktop)', async (p) => {
      await waitFor(p, () => document.querySelectorAll('#hero-scene [data-pick]').length > 5, null, 'the farm scene did not start');
      for (let k = 0; k < 40; k++) {   // every free plant, then a wait for them to grow back (the badge goes by itself after 6 seconds: look before waiting)
        await p.evaluate(() => document.querySelectorAll('#hero-scene [data-pick]:not([data-state=picked])').forEach((e) => e.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))));
        if (await p.evaluate(() => !!document.querySelector('.ach-stack .ach'))) break;
        await p.clock.fastForward(12000);
      }
      await waitFor(p, () => !!document.querySelector('.ach-stack .ach'), null, 'no badge after 40 rounds of picking');
    }],
    ['a season picked in the hero that is not the season of the clock (winter, desktop)', async (p) => { await p.clock.fastForward(12000); await p.evaluate(() => window.WISE_ACRES.hero.setSeason('winter')); await p.clock.fastForward(600); await waitFor(p, () => document.documentElement.dataset.season === 'winter', null, 'the season did not change'); }],
  ] },
];
async function stateRun(browser, base, s) {
  const errs = [], rows = [];
  const p = await open(browser, base, 'index.html', errs, { viewport: SIZES[s.vp], lang: s.lang, query: s.query, locale: s.locale, routes: s.routes, time: s.time, extra: s.extra || EXTRA });
  await p.addStyleTag({ content: STILL });
  await p.evaluate(axe);
  for (const [name, go] of s.steps) {
    let reached = true, why = '';
    try { await go(p); } catch (e) { reached = false; why = String(e.message).split('\n')[0]; }
    await p.clock.runFor(400);
    const res = await p.evaluate(AXE_RUN, [RULES, null]);
    rows.push([`state reached: ${name}`, reached, why], [`axe: ${name} has no violations`, res.v.length === 0, says(res)]);
  }
  await p.context().close();
  return { rows, errs };
}
// the season tabs and the "What's on the farm" tabs: one tab at a time (only the shown panel is in the page's accessibility tree)
async function tabsRun(browser, base) {
  const errs = [], rows = [];
  const p = await open(browser, base, 'index.html', errs, { viewport: SIZES.phone, lang: 'es', extra: EXTRA });
  await p.addStyleTag({ content: STILL });
  await p.evaluate(axe);
  for (const [name, tabs, scope, panel] of [['season tabs', '#season-tabs [data-season="X"]', '#seasons', null], ["What's on the farm tabs", '#farm-seasons [data-fs="X"]', '#farm', '#farm-cards']]) {
    for (const s of SEASONS) {
      await p.click(tabs.replace('X', s)); await p.clock.runFor(300);
      const res = await p.evaluate(AXE_RUN, [RULES, scope]);
      rows.push([`axe: ${name}, ${s} (es, phone) has no violations`, res.v.length === 0, says(res)]);
    }
  }
  await p.context().close();
  return { rows, errs };
}

/* ------------------------------------------------------------------ the keyboard */
// every control that can take focus shows a mark when it has it (its own outline, or a ring on the box around it)
const FOCUS_MARKS = () => {
  const SEL = 'a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), select, textarea, summary, [tabindex]:not([tabindex="-1"]), [role=button]';
  const shown = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0' && !e.closest('[hidden],[inert]') && !(e.closest('details:not([open])') && !e.matches('summary')); };
  const sig = (e) => { const c = getComputedStyle(e); return [c.outlineStyle, c.outlineWidth, c.boxShadow, c.backgroundColor, c.borderTopColor, c.color, c.textDecorationLine, c.transform].join('|'); };
  const name = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/)[0] : '') + ' "' + (e.textContent || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 24) + '"';
  const list = [...document.querySelectorAll(SEL)].filter(shown), bad = [];
  for (const e of list) {
    const before = sig(e);
    e.focus({ focusVisible: true, preventScroll: true });
    if (document.activeElement !== e) { bad.push('cannot take focus: ' + name(e)); continue; }
    const cs = getComputedStyle(e);
    let ring = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
    for (let a = e.parentElement, k = 0; a && k < 3 && !ring; a = a.parentElement, k++) { const ac = getComputedStyle(a); ring = ac.outlineStyle !== 'none' && parseFloat(ac.outlineWidth) > 0; }   // a ring drawn on the box around (:has)
    if (!e.matches(':focus-visible') || (!ring && before === sig(e))) bad.push('no focus mark: ' + name(e));
    e.blur();
  }
  return { n: list.length, bad };
};
async function focusRun(browser, base, page, size, lang) {
  const errs = [];
  const p = await open(browser, base, page, errs, { viewport: SIZES[size], lang, extra: EXTRA });
  await p.addStyleTag({ content: STILL });
  const r = await p.evaluate(FOCUS_MARKS);
  await p.context().close();
  return { rows: [[`keyboard: every one of the ${r.n} controls of ${page} (${size}, ${lang}) shows a focus mark`, r.bad.length === 0 && r.n > 20, r.bad.slice(0, 5).join(' | ')]], errs };
}
// menus and the viewer: Enter opens, Tab leaves a menu (a menu is not a trap), Esc closes, the focus is back on the button
const POPUPS = {
  desktop: [
    { name: 'language menu', trigger: 'header .lang-btn', isOpen: () => !document.querySelector('header .lang-list').hidden, within: 'header .lang' },
    { name: 'More menu', trigger: '.nav-more-btn', isOpen: () => document.querySelector('.nav-more-btn').getAttribute('aria-expanded') === 'true', within: '.nav-more' },
    { name: '"Remind me" menu', trigger: '[data-rel-remind]', isOpen: () => !document.getElementById('rel-menu').hidden, within: '#rel-menu', pre: (p) => p.evaluate(() => document.querySelector('[data-rel-remind]').scrollIntoView({ block: 'center' })) },
    { name: 'photo viewer (a link)', trigger: 'a[data-zoom]', isOpen: () => document.getElementById('lightbox').open, within: '#lightbox', modal: true, pre: (p) => p.evaluate(() => document.querySelector('a[data-zoom]').scrollIntoView({ block: 'center' })) },
    { name: 'photo viewer (a photo)', trigger: '[data-kbd]', isOpen: () => document.getElementById('lightbox').open, within: '#lightbox', modal: true, pre: (p) => p.evaluate(() => { const e = [...document.querySelectorAll('img[data-zoom]')].find((x) => { const r = x.getBoundingClientRect(); return r.width > 20 && r.height > 20 && !x.closest('[hidden]'); }); e.setAttribute('data-kbd', ''); e.scrollIntoView({ block: 'center' }); }) },
  ],
  phone: [
    { name: 'phone menu', trigger: '#menu-toggle', isOpen: () => document.getElementById('menu-toggle').getAttribute('aria-expanded') === 'true', within: '#nav' },
    { name: 'language menu (phone)', trigger: 'header .lang-btn', isOpen: () => !document.querySelector('header .lang-list').hidden, within: 'header .lang' },
  ],
};
async function popupRun(browser, base, size) {
  const errs = [], rows = [];
  const p = await open(browser, base, 'index.html', errs, { viewport: SIZES[size], extra: EXTRA });
  await p.addStyleTag({ content: STILL });
  for (const pop of POPUPS[size]) {
    if (pop.pre) await pop.pre(p);
    const inside = () => p.evaluate((w) => { const a = document.activeElement; return !!(a && a.closest(w)); }, pop.within);
    await p.focus(pop.trigger);
    await p.keyboard.press('Enter'); await p.clock.runFor(300);
    const opened = await p.evaluate(pop.isOpen);
    rows.push([`keyboard: ${pop.name} opens with Enter`, opened, '']);
    if (!opened) continue;
    if (!pop.modal) {
      let left = 0;
      for (let i = 1; i <= 30 && !left; i++) { await p.keyboard.press('Tab'); await p.clock.runFor(50); if (!(await inside())) left = i; }
      rows.push([`keyboard: ${pop.name} is no keyboard trap (Tab leaves it)`, left > 0, left ? `after ${left} Tab(s)` : 'still inside after 30']);
      if (!(await p.evaluate(pop.isOpen))) { await p.focus(pop.trigger); await p.keyboard.press('Enter'); await p.clock.runFor(300); }
    }
    await p.keyboard.press('Escape'); await p.clock.runFor(400);
    rows.push([`keyboard: ${pop.name} closes with Esc and the focus is back on its button`, !(await p.evaluate(pop.isOpen)) && (await p.evaluate((t) => document.activeElement === document.querySelector(t), pop.trigger)), '']);
  }
  await p.context().close();
  return { rows, errs };
}

/* ------------------------------------------------------------------ the tests of the tests */
async function selfTests(browser, base, helper) {
  const errs = [], rows = [];
  const p = await open(browser, base, 'first-visit.html', errs, { viewport: SIZES.desktop });
  await p.addStyleTag({ content: STILL });
  await p.evaluate(axe);
  // axe: a picture without a text alternative
  const bad = await p.evaluate(async (rules) => { document.body.insertAdjacentHTML('beforeend', '<img id="axe-self-test" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">'); const r = (await window.axe.run(document, rules)).violations.map((v) => v.id); document.getElementById('axe-self-test').remove(); return r; }, RULES);
  rows.push(['axe really runs: it reports a deliberate mistake (image without alt)', bad.includes('image-alt'), bad.join(',')]);
  // the focus-mark check: a button with its outline switched off
  await p.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<button id="fm-self-test" style="outline:none!important;box-shadow:none!important">no mark</button>'));
  const fm = (await p.evaluate(FOCUS_MARKS)).bad.filter((b) => /fm-self-test/.test(b));
  await p.evaluate(() => document.getElementById('fm-self-test').remove());
  rows.push(['the focus check really sees a control with no focus mark', fm.length === 1, fm.join(' | ')]);
  // the pixel check: pale grey text over a pale gradient (axe says "could not decide", the pixels say 1.4 : 1)
  await p.evaluate(() => { document.body.insertAdjacentHTML('beforeend', '<p id="px-self-test" style="position:fixed;z-index:99999;top:90px;left:20px;width:320px;margin:0;padding:12px;font:20px/1.2 sans-serif;background:linear-gradient(90deg,#ffffff,#e6e6e6);color:#cfcfcf">Pale text on a gradient</p>'); });
  const px = await firstScreen(p, helper);
  rows.push(['the pixel check really reports pale text on a gradient (a deliberate mistake)', px.bad.some((b) => /Pale text/.test(b)), px.bad.join(' | ').slice(0, 200)]);
  await p.context().close();
  return { rows, errs };
}

await run('axe-wide', async ({ browser, base, errs }) => {
  const T = Date.now(), lap = (what) => info(`${what}: ${Math.round((Date.now() - T) / 1000)} s`);
  const helper = await (await browser.newContext()).newPage();   // a blank page that reads the pictures
  await helper.goto('about:blank');
  const report = (results) => results.forEach((r) => { r.rows.forEach((x) => ok(...x)); if (r.errs) errs.push(...r.errs); });

  const runs = (process.env.AXE_STATES ? [] : matrix()).filter((r) => !process.env.AXE_ONLY || new RegExp(process.env.AXE_ONLY).test(`${r.page} ${r.size} ${r.lang} ${r.season}${r.dark ? ' dark' : ''}`));   // AXE_ONLY='index.html desktop en fall' runs one page
  if (process.env.AXE_FULL !== '1' && !process.env.AXE_ONLY && !process.env.AXE_STATES) {
    const m = runs.filter((r) => r.page !== '404.html');
    ok('the sample covers every pair of page, language, season, size and light/dark (34 runs)', pairs(m, 'page', 'lang') === 30 && pairs(m, 'page', 'season') === 24 && pairs(m, 'lang', 'season') === 20 && pairs(m, 'page', 'size') === 12 && pairs(m, 'lang', 'size') === 10 && pairs(m, 'season', 'size') === 8 && pairs(m, 'page', 'dark') === 12 && pairs(m, 'lang', 'dark') === 10 && pairs(m, 'season', 'dark') === 8 && pairs(m, 'size', 'dark') === 4,
      [['page', 'lang'], ['page', 'season'], ['lang', 'season'], ['page', 'size'], ['lang', 'size'], ['season', 'size'], ['page', 'dark'], ['lang', 'dark'], ['season', 'dark'], ['size', 'dark']].map(([a, b]) => a + 'x' + b + '=' + pairs(m, a, b)).join(' '));
  }
  const only = process.env.AXE_ONLY, statesOnly = process.env.AXE_STATES;   // debugging: one page, or the states whose name matches
  const picked = STATES.filter((x) => !statesOnly || x.steps.some((st) => new RegExp(statesOnly).test(st[0])));
  const tasks = statesOnly ? picked.map((x) => () => stateRun(browser, base, x)) : only ? runs.map((r) => () => matrixRun(browser, base, helper, r)) : [
    ...runs.map((r) => () => matrixRun(browser, base, helper, r)),
    ...STATES.map((s) => () => stateRun(browser, base, s)),
    () => tabsRun(browser, base),
    () => focusRun(browser, base, 'index.html', 'desktop', 'en'), () => focusRun(browser, base, 'wise-pie.html', 'phone', 'es'),
    () => popupRun(browser, base, 'desktop'), () => popupRun(browser, base, 'phone'),
    () => selfTests(browser, base, helper),
  ];
  const labels = statesOnly ? picked.map((x) => x.steps[0][0]) : only ? runs.map((r) => 'axe ' + r.page) : [...runs.map((r) => 'axe ' + r.page + ' ' + r.lang + ' ' + r.season), ...STATES.map((s) => s.steps[0][0]), 'tabs', 'focus 1', 'focus 2', 'popups desktop', 'popups phone', 'self-tests'];
  const results = await pool(tasks, (k) => labels[k]);
  report(results);
  const undecided = results.slice(0, runs.length).reduce((n, r) => n + (r.undecided || 0), 0);
  info(`axe could not decide the colour of ${undecided} texts in the first screens (gradients, pictures, overlaps); each was measured on the pixels instead`);
  lap(`${runs.length} pages, ${STATES.reduce((n, x) => n + x.steps.length, 0) + 8} states, the keyboard`);
});
