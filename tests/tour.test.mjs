// order: 192
// browser: yes
// covers: js/tour.js, css/tour.css, index.html, first-visit.html
/* The "Take a tour" ENGINE (js/tour.js and css/tour.css; docs/TOUR.md), with a made-up set of steps (the real ones are written by other people and are tested by
 * tests/tour-targets.test.mjs): the test serves its own js/tour-steps.js and js/tour-steps-b.js and lets js/tour-steps-c.js be missing, so what is tested is the
 * engine and nothing about the words of the real tour. tests/tour-off.test.mjs proves that with the mode OFF nothing changes on any page.
 *   - the button: where it is (it covers neither the round "back to top" button nor the basket box), its name, that css/tour.css is asked for at once and the steps
 *     only when it is pressed; the welcome card, its words, "Not now"; Start; the step cards: "Step N of M - Part", "Chapter X of Y", Back, Next, Contents, Close
 *   - the lit box: the same place as the target (8 px more on each side), the card never over it, the card inside the window, a target below the fold brought under the
 *     sticky bar, the box following the page when it scrolls, a boxes that is still waiting to fade in (the preview frame may never fire its observers) shown at once
 *   - the steps: sorted by order from several files, a repeated id ignored, a missing file fine, a step whose target is missing is skipped (skipIfMissing) or shown in the
 *     middle, before / after run in order and are waited for, a hook that throws does not stop the tour, ctx.undo and a menu left open are put back when it closes
 *   - clicks: blocked behind the dimmer, except the lit part of the page (a question opens, a tab changes; links that leave the page are switched off) and, in a step that says allowClicks, the whole page; a press inside the tour never reaches the page's own "click anywhere else" rules
 *   - keys and screen readers: the card is a dialog, focus goes to Next after each step and stays in the card (Tab / Shift+Tab), Right / Left / Enter / Esc, one polite line
 *     for each step, axe finds nothing in the card
 *   - other pages: a step on another page goes there (no #tour, no hash) and carries on from the tour's place in browser storage; Back goes back; an old place is not resumed
 *   - stopping and coming back: "Continue where I stopped" after a reload, Finish forgets, Start again; Contents (with the number of steps in each part)
 *   - ways in: ?tour, #tour, window.WA_TOUR, a link with data-tour-open; WA_TOUR_INLINE asks for no file; the pretend-account steps only count when demo mode is on
 *   - calm mode and reduced motion (nothing slides), a phone (the card is a sheet at the bottom; the target is above it), a long text scrolls inside the card
 *   - a step's own row of small buttons (step.choices, used by the season walk of the real steps): not there on other steps, one button each with the pressed one marked,
 *     run() waited for and a run() that throws not stopping the card, the card's title and text changing, the lit box measured again, a press ignored while the tour moves on,
 *     Next / Back / Contents / Esc while a press is still being carried out, a list given by a function, a phone, axe
 *   - what an independent walk of the real tour found (section 8): a form nobody handles is stopped (the sign-up preview), a dialog the page opens over the tour is above the
 *     dimmer and keeps its Esc, the first Esc on a part of the page brings the focus back to the card, a link to a place on the page brings the lit part back, the card keeps off the
 *     buttons of a wide lit box, the lit part is brought under the sticky demo bar too
 *   - a wide, short lit part in a laptop window (section 9: a strip 1,300 px wide and 96 px high at 1366x768, 1280x800 and 992x800): there is no room beside it for the card, so the part is
 *     brought to the top of the free room and the card goes under it, whole in the window and not on the part
 *   - what is lit besides the target (section 10): a list that a lit button opens (aria-controls, aria-expanded: a menu bar's list, a bell's panel) is lit too, with a yellow edge of its own and the
 *     dimmer in layers, and can be used; the parts a step names with "also" (the basket game's picture) likewise; everything else stays locked, a real click on it does nothing; Tab reaches
 *     the list; a step with allowClicks: false lights nothing more
 *   - a dialog of the page that is not the pretend account's (section 8b): the Store's pop-up (a stand-in built like js/shop-pop.js: a fixed overlay with a dim of its own, a box that says role="dialog"
 *     aria-modal="true", and aria-hidden and inert on every other child of <body>, the tour's own box included) opens above the dimmer and the click stopper, its box takes clicks and its overlay does not,
 *     the tour's card stays usable (not inert: Next and Back work) and keeps off the box, Esc closes the pop-up and not the tour, and the pop-up is at its own level again when the tour is closed; the
 *     same for any other overlay that holds a role="dialog" aria-modal="true" box (a computer and a phone) */
import { run, open, ok, okSoon, until, info, settled, ms, axeSource, ROOT } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const CSS = fs.readFileSync(path.join(ROOT, 'css/tour.css'), 'utf8');
// the colour of one pixel of the window: a 1 x 1 screenshot (an 8-bit PNG: RGB or RGBA, one row)
const pixel = async (p, x, y) => {
  const png = await p.screenshot({ clip: { x: Math.round(x), y: Math.round(y), width: 1, height: 1 } });
  let pos = 8, ct = 0;
  const idat = [];
  while (pos < png.length) { const len = png.readUInt32BE(pos), type = png.toString('latin1', pos + 4, pos + 8), data = png.subarray(pos + 8, pos + 8 + len); if (type === 'IHDR') ct = data[9]; else if (type === 'IDAT') idat.push(data); pos += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat));   // one row: a filter byte, then the pixel (the filter of a single pixel changes nothing: its neighbours are 0)
  return [raw[1], raw[2], raw[3], ct === 6 ? raw[4] : 255];
};

/* ---------------------------------------------------------------- the made-up steps (served instead of the real files) */
const LONG = Array.from({ length: 160 }, (_, i) => 'word' + i).join(' ');
const STEPS_A = `
window.__log = window.__log || [];
(window.WA_TOUR_STEPS = window.WA_TOUR_STEPS || []).push(
  { id: 'a1', order: 101, chapter: 1, page: 'index', target: null, title: 'Welcome card', text: 'Line one.\\nLine two.' },
  { id: 'a2', order: 201, chapter: 2, page: 'index', target: '.announce', title: 'The strip', text: 'The top strip.',
    before: function (ctx) { (window.__log = window.__log || []).push('before:a2:' + (ctx && ctx.step && ctx.step.id) + ':' + (ctx && ctx.page)); },
    after: function () { window.__log.push('after:a2'); } },
  { id: 'a3', order: 202, chapter: 2, page: 'index', target: '.hero-cta .btn-red', title: 'Reserve', text: 'The red button.',
    before: function (ctx) { window.__log.push('before:a3:start'); return ctx.wait(300).then(function () { window.__log.push('before:a3:done'); }); } },
  { id: 'a4', order: 203, chapter: 2, page: 'index', target: '.nothing-like-this', skipIfMissing: true, title: 'Skipped', text: 'never seen' },
  { id: 'a5', order: 301, chapter: 3, page: 'index', target: '#faq', title: 'Questions', text: 'The FAQ.\\n- First\\n- Second',
    before: function (ctx) { var b = document.getElementById('t-disc'); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); ctx.undo(function () { window.__log.push('undo:a5'); }); },
    after: function () { window.__log.push('after:a5'); } },
  { id: 'a6', order: 302, chapter: 3, page: 'index', target: '#t-btn', allowClicks: true, title: 'Try it', text: 'Click the test button.' },
  { id: 'a7', order: 303, chapter: 3, page: 'index', target: '.nothing-like-this', title: 'No target', text: 'Centered card.' },
  { id: 'a8', order: 304, chapter: 3, page: 'index', target: '#visit', title: 'Broken hook', text: 'The hook throws.', before: function () { throw new Error('boom'); } },
  { id: 'a9', order: 401, chapter: 4, page: 'first-visit', target: 'h1', title: 'Other page', text: 'This is the first-visit page.' },
  { id: 'a10', order: 501, chapter: 5, page: 'index', target: null, title: 'The end', text: 'A list:\\n- one\\n- two' }
);
window.WA_TOUR_CHAPTERS = [{ n: 1, title: 'Welcome' }, { n: 2, title: 'The first screen' }, { n: 3, title: 'Planning' }, { n: 4, title: 'Other page' }, { n: 5, title: 'The end' }];
`;
const STEPS_B = `
(window.WA_TOUR_STEPS = window.WA_TOUR_STEPS || []).push(
  { id: 'b1', order: 250, chapter: 2, page: 'index', target: '.picker', title: 'From file b', text: 'Merged by order.' },
  { id: 'a2', order: 999, chapter: 9, page: 'index', target: null, title: 'A repeated id', text: 'Never shown.' }
);
`;
const STEPS_LONG = `(window.WA_TOUR_STEPS = window.WA_TOUR_STEPS || []).push({ id: 'l1', order: 101, chapter: 1, page: 'index', target: '#visit', title: 'A long one', text: '${LONG}' });`;
const STEPS_ONE = (extra) => `(window.WA_TOUR_STEPS = window.WA_TOUR_STEPS || []).push({ id: 'o1', order: 101, chapter: 1, page: 'index', target: '.announce', title: 'One', text: 'One.' }${extra || ''});`;
// steps with a row of small buttons (step.choices): a plain card, one with three buttons (a slow one, one that throws), one whose list comes from a function, a last card
const STEPS_CHOICES = `
window.__log = window.__log || [];
(window.WA_TOUR_STEPS = window.WA_TOUR_STEPS || []).push(
  { id: 'c1', order: 101, chapter: 1, page: 'index', target: null, title: 'Plain card', text: 'No buttons here.' },
  { id: 'c2', order: 102, chapter: 1, page: 'index', target: '.announce', title: 'Pick one', text: 'Intro text.', choicesLabel: 'See it as:',
    before: function () { window.__log.push('before:c2'); },
    after: function () { window.__log.push('after:c2'); },
    choices: [
      { label: 'One', title: 'First choice', text: 'Text of one.\\n- a\\n- b', run: function (ctx) { window.__log.push('run:one:' + (ctx && ctx.step && ctx.step.id)); ctx.undo(function () { window.__log.push('undo:one'); }); } },
      { label: 'Two', text: 'Text of two.', run: function () { window.__log.push('run:two:start'); return new Promise(function (r) { setTimeout(function () { window.__log.push('run:two:done'); r(); }, 450); }); } },
      { label: 'Three', title: 'Third', text: 'Text of three.', run: function () { window.__log.push('run:three'); throw new Error('boom'); } }
    ] },
  { id: 'c3', order: 103, chapter: 1, page: 'index', target: '#faq', title: 'List from a function', text: 'Function text.',
    choices: function (ctx) { window.__log.push('choices:c3:' + (ctx && ctx.step && ctx.step.id)); return [{ label: 'Only', text: 'Only text.' }, null, { label: '' }, 'junk', { text: 'no label' }, { label: 'Preset', text: 'Already in effect.', pressed: true }]; } },
  { id: 'c4', order: 104, chapter: 1, page: 'index', target: null, title: 'Last card', text: 'End.' }
);
window.WA_TOUR_CHAPTERS = [{ n: 1, title: 'Choices' }];
`;
const js = (body) => ({ contentType: 'text/javascript', body });
// the routes of a page: which steps files exist (a missing one answers 404)
const serve = (files, log = []) => async (page) => {
  page.on('request', (r) => log.push(new URL(r.url()).pathname));
  await page.route('**/js/tour-steps.js', (r) => (files.a != null ? r.fulfill(js(files.a)) : r.fulfill({ status: 404, body: 'no' })));
  await page.route('**/js/tour-steps-b.js', (r) => (files.b != null ? r.fulfill(js(files.b)) : r.fulfill({ status: 404, body: 'no' })));
  await page.route('**/js/tour-steps-c.js', (r) => (files.c != null ? r.fulfill(js(files.c)) : r.fulfill({ status: 404, body: 'no' })));
};

/* ---------------------------------------------------------------- what the page and the tour look like (measured in the page) */
const box = (e) => (e ? { x: e.left, y: e.top, w: e.width, h: e.height, r: e.right, b: e.bottom } : null);
const look = (p) => p.evaluate(() => {
  const rect = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, r: b.right, b: b.bottom }; };
  const c = document.querySelector('.wa-tour-card'), root = document.querySelector('.wa-tour');
  if (!c) return null;
  const k = (c.querySelector('.wa-tour-progress') || {}).textContent || '';
  const m = /Step (\d+) of (\d+)/.exec(k);
  const live = document.querySelector('.wa-tour [role="status"]');
  return {
    kicker: k.replace(/\s+/g, ' ').trim(), n: m ? +m[1] : 0, of: m ? +m[2] : 0, title: (c.querySelector('.wa-tour-title') || {}).textContent || '', text: (c.querySelector('.wa-tour-body') || {}).innerText || '',
    buttons: [...c.querySelectorAll('button')].map((b) => (b.getAttribute('aria-label') || b.textContent).trim() + (b.disabled ? ' (off)' : '')), busy: c.classList.contains('is-busy') || c.getAttribute('aria-busy') === 'true',   // the class goes when the new words are on the card; aria-busy only when the lit box is placed and the focus is on the card
    card: rect(c), hole: root.classList.contains('no-hole') ? null : rect(document.querySelector('.wa-tour-hole')), free: root.classList.contains('is-free'), still: root.classList.contains('is-still'),
    sheet: c.classList.contains('is-sheet'), focus: document.activeElement ? (document.activeElement.getAttribute('aria-label') || document.activeElement.textContent || '').trim() : '', inCard: c.contains(document.activeElement),
    live: live ? live.textContent : '', scrollY: window.scrollY, vw: document.documentElement.clientWidth, vh: window.innerHeight, bodyScroll: (c.querySelector('.wa-tour-body') || {}).scrollHeight > (c.querySelector('.wa-tour-body') || {}).clientHeight + 1,
    pillShown: !!document.querySelector('.wa-tour-pill') && !document.querySelector('.wa-tour-pill').hidden, dialog: c.getAttribute('role'), name: (document.getElementById(c.getAttribute('aria-labelledby')) || {}).textContent || '',
    choices: [...c.querySelectorAll('.wa-tour-choice')].map((b) => b.textContent.trim() + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')).join('|'),
    choicesRow: (() => { const r = c.querySelector('.wa-tour-choices'); return r && !r.hidden ? { label: (r.querySelector('.wa-tour-choices-label') || {}).textContent || '', role: r.getAttribute('role'), name: r.getAttribute('aria-label'), busy: r.getAttribute('aria-busy') } : null; })(),
    items: c.querySelectorAll('.wa-tour-body li').length,
  };
});
const rectOf = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, r: b.right, b: b.bottom }; }, sel);
const overlap = (a, b) => (a && b ? Math.max(0, Math.min(a.r, b.r) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.y, b.y)) : 0);
const near = (a, b, tol = 3) => Math.abs(a - b) <= tol;
const lit = (hole, t, pad = 8) => !!(hole && t && near(hole.x, t.x - pad) && near(hole.y, t.y - pad) && near(hole.w, t.w + 2 * pad) && near(hole.h, t.h + 2 * pad));
const inside = (c, vw, vh) => !!(c && c.x >= 0 && c.y >= 0 && c.r <= vw + 0.5 && c.b <= vh + 0.5);
const btn = (p, name) => p.locator('.wa-tour-card').getByRole('button', { name, exact: true });
const press = async (p, name) => { await btn(p, name).click(); };
// The tour at rest: its own animations (the card fading in, the lit box and the card sliding to the next place, 0.2 to 0.3 s) are over. A position is measured after this:
// a quick computer is done with the slide before the next look, a busy one is not.
const rest = (p) => p.evaluate(async (cap) => {
  const t0 = performance.now(), frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await frames();
  for (let i = 0; i < 30 && performance.now() - t0 < cap; i++) {
    const moving = document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.wa-tour'));
    if (!moving.length) break;
    await Promise.race([Promise.all(moving.map((a) => a.finished.catch(() => {}))), new Promise((r) => setTimeout(r, 250))]);
  }
  await frames();
}, ms(4000));
const atStep = async (p, n, name) => { const r = await okSoon(name || `the card shows step ${n}`, () => look(p), (s) => s && s.n === n && !s.busy); await rest(p); return r; };
const logOf = (p) => p.evaluate(() => (window.__log || []).slice());
const PHONE = { width: 390, height: 844 };

// a few things of its own for the page: a fixed box with a button that counts presses, and a menu button that opens and closes (what a step may leave open)
const inject = (p) => p.evaluate(() => {
  const d = document.createElement('div');
  d.id = 't-box'; d.style.cssText = 'position:fixed;left:20px;top:110px;z-index:60;background:#fff;padding:8px;border:2px solid #000';
  d.innerHTML = '<button type="button" id="t-btn">Press me</button> <button type="button" id="t-disc" aria-expanded="false" aria-controls="t-panel">Menu</button><div id="t-panel" hidden>panel</div>';
  document.body.appendChild(d);
  window.__btn = 0; window.__docClicks = 0;
  document.getElementById('t-btn').addEventListener('click', () => { window.__btn++; });
  document.getElementById('t-disc').addEventListener('click', () => { const b = document.getElementById('t-disc'), o = b.getAttribute('aria-expanded') !== 'true'; b.setAttribute('aria-expanded', String(o)); document.getElementById('t-panel').hidden = !o; });
  document.addEventListener('click', () => { window.__docClicks++; });
});
const store = (p) => p.evaluate(() => ({ ls: localStorage.getItem('wa-tour'), ss: sessionStorage.getItem('wa-tour'), keys: Object.keys(localStorage) }));
// Makes a link with this address (and these attributes), presses it as a program would (a.click()), and says what happened: did the address change, what note did the card
// show, is the page still the same page (a word set before the press is still there: a page that is loaded again has lost it), is a photo viewer open.
const poke = async (p, href, attrs = {}) => {
  await p.evaluate(() => { window.__kept = 'kept'; const old = document.querySelector('.wa-tour-flash'); if (old) old.remove(); });   // a note from an earlier press is not this press's
  const r = await p.evaluate(([h, at]) => {
    const a = document.createElement('a'); a.setAttribute('href', h); a.textContent = 'poke'; a.setAttribute('data-poke', '');
    Object.keys(at).forEach((k) => a.setAttribute(k, at[k]));
    document.body.appendChild(a);
    if (at['data-zoom'] != null && window.WISE_ACRES && window.WISE_ACRES.bindZoom) window.WISE_ACRES.bindZoom(a);
    const was = location.href;
    a.click();
    const n = document.querySelector('.wa-tour-flash');
    return { moved: location.href !== was, now: location.pathname + location.search + location.hash, note: n ? n.textContent : '', viewer: !!document.querySelector('dialog[open]') };
  }, [href, attrs]);
  await p.waitForTimeout(450);
  let same = false, said = '';
  try { same = await p.evaluate(() => window.__kept === 'kept'); said = await p.evaluate(() => (document.querySelector('.wa-tour [role="status"]:not(.wa-tour-flash)') || {}).textContent || ''); } catch (e) { same = false; }
  try { await p.evaluate(() => { const d = document.querySelector('dialog[open]'); if (d) d.close(); document.querySelectorAll('[data-poke]').forEach((x) => x.remove()); const n = document.querySelector('.wa-tour-flash'); if (n) n.remove(); history.replaceState(null, '', location.pathname + location.search); }); } catch (e) { /* the page went away */ }
  return { ...r, same, said };
};
const switchedOff = (r) => /switched off/.test(r.note) && !r.moved && r.same;

await run('tour', async ({ browser, base, errs }) => {
  /* ================================================================ 1. a computer: the button, the welcome card, a walk through the steps */
  const asked = [];
  let p = await open(browser, base, 'index.html', errs, { query: 'tour', routes: serve({ a: STEPS_A, b: STEPS_B }, asked) });
  await inject(p);
  await okSoon('?tour: the "Take a tour" button is on the page, with its words', () => p.evaluate(() => { const b = document.querySelector('.wa-tour-pill'); if (!b || b.hidden) return null; const r = b.getBoundingClientRect(); return { t: b.textContent.trim(), w: r.width, h: r.height, pop: b.getAttribute('aria-haspopup') }; }), (b) => b && b.t === 'Take a tour' && b.w > 60 && b.h >= 40 && b.pop === 'dialog');
  ok('the style sheet is asked for at once, the steps are not asked for until the button is pressed', asked.some((u) => /\/css\/tour\.css$/.test(u)) && !asked.some((u) => /tour-steps/.test(u)), asked.filter((u) => /tour/.test(u)).join(' '));
  const pill0 = await rectOf(p, '.wa-tour-pill'), picker = await rectOf(p, '.picker');
  ok('at the top of the page the button covers neither the basket box nor the top bar, and is inside the window', overlap(pill0, picker) === 0 && pill0.r <= 1440 && pill0.b <= 900 && pill0.y > 120, JSON.stringify({ pill0, picker }));
  await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 1700); });
  await okSoon('scrolled down, the round "back to top" button shows, and the tour button does not cover it', async () => { const t = await rectOf(p, '.to-top'), b = await rectOf(p, '.wa-tour-pill'); return t && t.w > 0 && (await p.evaluate(() => !document.querySelector('.to-top').hidden)) ? overlap(t, b) : -1; }, (v) => v === 0);
  const scrollBefore = 1700;

  await p.getByRole('button', { name: 'Take a tour', exact: true }).click();   // the round button is on the page, not in the card
  await okSoon('the button opens a welcome card: a dialog with a name, the words of the plan, and its three buttons', () => look(p), (s) => s && s.dialog === 'dialog' && s.name === 'Your website tour' && /^This is a tour of your website\. It takes about \d+ minutes\. You can stop any time/.test(s.text) && /Continue where I stopped/.test(s.text) && /Contents lets you jump to any part/.test(s.text) && !s.busy);
  await rest(p);
  const s0 = await look(p);
  ok('the welcome card has Start the tour, Choose a part and Not now (and no "Continue" button the first time), and the first button has the focus', s0.buttons.join('|') === 'Start the tour|Choose a part|Not now|Close' && s0.focus === 'Start the tour', s0.buttons.join('|') + ' / ' + s0.focus);
  ok('the minutes come from the number of steps (11 steps: about 5 minutes, 15 seconds a step to the nearest 5)', /about 5 minutes/.test(s0.text), s0.text.slice(0, 120));
  ok('the card is in the middle of the window and the button is hidden while it is open', near(s0.card.x + s0.card.w / 2, s0.vw / 2, 3) && near(s0.card.y + s0.card.h / 2, s0.vh / 2, 3) && !s0.pillShown, JSON.stringify({ c: s0.card, p: s0.pillShown }));
  ok('the steps files are asked for now, the missing one (-c) too, and nothing breaks', asked.some((u) => /tour-steps\.js$/.test(u)) && asked.some((u) => /tour-steps-b\.js$/.test(u)) && asked.some((u) => /tour-steps-c\.js$/.test(u)));
  const dim = await p.evaluate(() => { const s = document.querySelector('.wa-tour-shield').getBoundingClientRect(); return { w: s.width, h: s.height, bg: getComputedStyle(document.querySelector('.wa-tour-shield')).backgroundColor }; });
  ok('the page behind is dimmed all over (a layer as big as the window)', dim.w >= 1440 && dim.h >= 900 && /rgba\(.*0\.7/.test(dim.bg), JSON.stringify(dim));
  await press(p, 'Not now');
  await okSoon('"Not now" takes the card away, the button comes back with the focus, nothing is stored and the page is where it was', () => p.evaluate(() => ({ card: !!document.querySelector('.wa-tour'), pill: !document.querySelector('.wa-tour-pill').hidden, focus: document.activeElement && document.activeElement.className, y: Math.round(scrollY), ls: localStorage.getItem('wa-tour') })), (s) => !s.card && s.pill && /wa-tour-pill/.test(s.focus) && s.ls === null && Math.abs(s.y - scrollBefore) < 3);

  // start
  await p.click('.wa-tour-pill');
  await okSoon('the button opens the welcome card again', () => look(p), (s) => s && s.name === 'Your website tour');
  await press(p, 'Start the tour');
  await atStep(p, 1, 'Start the tour: step 1 shows');
  let s = await look(p);
  ok('step 1 reads "Step 1 of 11 - Welcome" and, under it, "Chapter 1 of 5"; the steps of the two files are counted together', s.kicker === 'Step 1 of 11 - Welcome Chapter 1 of 5', s.kicker);
  ok('step 1: Back is off, Next has the focus, and the card without a target is in the middle with nothing lit', s.buttons.join('|') === 'Back (off)|Contents|Next|Close' && s.focus === 'Next' && s.hole === null && near(s.card.x + s.card.w / 2, s.vw / 2, 3) && near(s.card.y + s.card.h / 2, s.vh / 2, 3), JSON.stringify({ b: s.buttons, f: s.focus, h: s.hole }));
  ok('"\\n" in a step\'s text is a line break', s.text === 'Line one.\nLine two.', JSON.stringify(s.text));
  await okSoon('the card says the step to a screen reader in one polite line (role status)', () => look(p), (x) => /Step 1 of 11\. Welcome\. Welcome card\./.test(x.live));
  ok('the tour keeps its place: sessionStorage and localStorage "wa-tour" hold step a1', await store(p).then((st) => /"id":"a1"/.test(st.ss) && /"run":1/.test(st.ss) && /"id":"a1"/.test(st.ls)), JSON.stringify(await store(p)));

  // step 2: a strip at the very top
  await press(p, 'Next');
  await atStep(p, 2, 'Next: step 2 shows');
  s = await look(p);
  let target = await rectOf(p, '.announce');
  ok('step 2 lights the top strip: the lit box is the strip with 8 px round it, the card is not over it, and it is inside the window', lit(s.hole, target) && overlap(s.card, target) === 0 && inside(s.card, s.vw, s.vh), JSON.stringify({ hole: s.hole, target, card: s.card }));
  ok('the card is under the strip and the focus is on Next again', s.card.y >= target.b && s.focus === 'Next', JSON.stringify({ y: s.card.y, b: target.b, f: s.focus }));
  ok('the "title" is the step\'s own, the progress bar line says the part', s.title === 'The strip' && s.kicker === 'Step 2 of 11 - The first screen Chapter 2 of 5', s.kicker);
  let log = await logOf(p);
  ok('before(ctx) ran with the step and the page name in ctx', log.includes('before:a2:a2:index'), log.join(','));
  const behind = await p.evaluate(() => window.__btn);
  // a click behind the dimmer does not reach the page (the test button is fixed at the left, under the dimmer)
  const tb = await rectOf(p, '#t-btn');
  await p.mouse.click(tb.x + tb.w / 2, tb.y + tb.h / 2);
  ok('a click on the page behind the dimmer is stopped (the test button did not count it)', (await p.evaluate(() => window.__btn)) === behind, String(await p.evaluate(() => window.__btn)));

  // step 3: a slow before(), then a button
  await press(p, 'Next');
  await atStep(p, 3, 'Next: step 3 shows (after its slow before() finished)');
  log = await logOf(p);
  ok('after(a2) ran when the step was left, then before(a3) began, and the card waited for it to finish (it returned a Promise)', log.indexOf('after:a2') < log.indexOf('before:a3:start') && log.indexOf('before:a3:start') < log.indexOf('before:a3:done'), log.join(','));
  s = await look(p);
  target = await rectOf(p, '.hero-cta .btn-red');
  ok('step 3 lights the red Reserve button: its box, 8 px round it, and the card beside it, not over it', lit(s.hole, target) && overlap(s.card, target) === 0 && inside(s.card, s.vw, s.vh), JSON.stringify({ hole: s.hole, target, card: s.card }));
  ok('the card is beside the button on the side with more room (the button is on the left, so the card goes right)', s.card.x >= target.r, JSON.stringify({ cx: s.card.x, tr: target.r }));
  ok('the lit box has a rounded edge and a ring of the farm\'s yellow', await p.evaluate(() => { const c = getComputedStyle(document.querySelector('.wa-tour-hole')); return parseFloat(c.borderTopLeftRadius) >= 14 && /255, 201, 40/.test(c.boxShadow); }), '');

  // step 4 is skipped (skipIfMissing), step 5 comes from the other file
  await press(p, 'Next');
  await atStep(p, 5, 'Next: step 4 (a target that is not there, skipIfMissing) is skipped, step 5 shows');
  s = await look(p);
  ok('the skipped step leaves a gap in the numbers, and the step of file b sits by its order (between 3 and the planning part)', s.title === 'From file b' && s.kicker === 'Step 5 of 11 - The first screen Chapter 2 of 5', s.kicker);
  ok('the repeated id in file b is ignored (there are 11 steps, not 12)', s.of === 11, String(s.of));
  const pk = await rectOf(p, '.picker');
  ok('step 5 lights the basket box (in the first screen), nothing covers it', lit(s.hole, pk) && overlap(s.card, pk) === 0, JSON.stringify({ hole: s.hole, pk, card: s.card }));

  // step 6: a section below, brought into view; its before() opens the test menu
  await press(p, 'Next');
  await atStep(p, 6, 'Next: step 6 shows');
  s = await look(p);
  target = await rectOf(p, '#faq');
  const head = await p.evaluate(() => document.querySelector('.site-header').getBoundingClientRect().bottom);
  ok('step 6: the page scrolled; the section is in the window with its top just under the sticky top bar, and the lit box is the section', s.scrollY > 500 && target.y >= head && target.y <= head + 40 && lit(s.hole, target), JSON.stringify({ scrollY: s.scrollY, ty: target.y, head, hole: s.hole }));
  ok('the card is inside the window, and "- " lines are bullets', inside(s.card, s.vw, s.vh) && (await p.evaluate(() => document.querySelectorAll('.wa-tour-body li').length)) === 2, JSON.stringify(s.card));
  ok('before() of step 6 opened the test menu', await p.evaluate(() => document.getElementById('t-disc').getAttribute('aria-expanded')) === 'true');
  const hy = (await look(p)).hole.y;
  await p.evaluate(() => window.scrollBy(0, 130));
  await okSoon('the lit box follows the section when the page is scrolled by hand', () => look(p), (x) => x.hole && Math.abs(x.hole.y - (hy - 130)) <= 3);
  ok('clicks inside the tour never reach the page: pressing Next did not make the page see a click', await (async () => { const before = await p.evaluate(() => window.__docClicks); await press(p, 'Back'); await atStep(p, 5); await press(p, 'Next'); await atStep(p, 6); return (await p.evaluate(() => window.__docClicks)) === before; })(), '');

  // step 6 again: a step without allowClicks that lights a part of the page: that part can be used (open a question), nothing else can
  ok('step 6 (a lit section, no allowClicks): the dimmer is cut open where the section is, the dialog says it is not modal, and the whole page is not free', await p.evaluate(() => { const b = document.querySelector('.wa-tour'); return b.classList.contains('is-try') && !b.classList.contains('is-free') && /polygon/.test(b.querySelector('.wa-tour-shield').style.clipPath) && document.querySelector('.wa-tour-card').getAttribute('aria-modal') === 'false'; }), '');
  await p.evaluate(() => { const d = document.querySelector('#faq details:not([open])'); if (d) d.scrollIntoView({ block: 'center' }); });
  await p.waitForTimeout(300);
  const q1 = await p.evaluate(() => { const ds = Array.from(document.querySelectorAll('#faq details')), d = ds.find((x) => !x.open); if (!d) return null; const r = d.querySelector('summary').getBoundingClientRect(); return { i: ds.indexOf(d), x: r.x + 40, y: r.y + r.height / 2 }; });
  ok('step 6: a closed question can be found in the lit section', !!q1, JSON.stringify(q1));
  if (q1) {
    await p.mouse.click(q1.x, q1.y);
    await okSoon('step 6: pressing a question in the lit section opens it (the page sees the press)', () => p.evaluate((i) => document.querySelectorAll('#faq details')[i].open, q1.i), (v) => v === true);
    await okSoon('...and the lit box grows or shrinks with it (the box still has the section\'s size)', async () => { const h = await look(p); const t2 = await rectOf(p, '#faq'); return { h, t2 }; }, (v) => v.h.hole && Math.abs(v.h.hole.h - (v.t2.h + 16)) <= 3);
  }
  // the test button sits at the top left of the window: it must be outside the lit section to prove anything, so the page is scrolled until the section starts below it
  await p.evaluate(() => { const f = document.querySelector('#faq'); window.scrollBy(0, f.getBoundingClientRect().top - 300); });
  await okSoon('...and the cut in the dimmer follows the section when it is scrolled (the section now starts below the test button)', async () => ({ h: await look(p), t: await rectOf(p, '#faq'), b: await rectOf(p, '#t-btn') }), (v) => v.h.hole && v.t.y > v.b.b + 20 && Math.abs(v.h.hole.y - (v.t.y - 8)) <= 3);
  await rest(p);
  const tb3 = await rectOf(p, '#t-btn');
  await p.mouse.click(tb3.x + tb3.w / 2, tb3.y + tb3.h / 2);
  ok('step 6: a press outside the lit section is still stopped (the test button did not count it)', (await p.evaluate(() => window.__btn)) === behind, String(await p.evaluate(() => window.__btn)));
  // a link in the lit section that leads away does nothing but say so; a link to a place on the page works
  await p.evaluate(() => {
    const host = document.querySelector('#faq .faq-list') || document.querySelector('#faq');
    const a = document.createElement('a'); a.id = 't-out'; a.href = 'https://example.com/away'; a.target = '_blank'; a.textContent = 'Away link'; a.style.cssText = 'display:inline-block;padding:8px';
    const b = document.createElement('a'); b.id = 't-here'; b.href = '#visit'; b.textContent = 'Here link'; b.style.cssText = 'display:inline-block;padding:8px';
    host.appendChild(a); host.appendChild(b); window.__popups = 0; window.open = () => { window.__popups++; return null; };
    a.scrollIntoView({ block: 'center' });
  });
  await p.waitForTimeout(300);
  const outBox = await rectOf(p, '#t-out');
  const urlBefore = await p.evaluate(() => location.href);
  await p.mouse.click(outBox.x + outBox.w / 2, outBox.y + outBox.h / 2);
  await p.waitForTimeout(400);
  ok('step 6: a link that leads away from the page does nothing and the card says so', (await p.evaluate(() => location.href)) === urlBefore && (await p.evaluate(() => /switched off/.test((document.querySelector('.wa-tour-flash') || {}).textContent || ''))), await p.evaluate(() => (document.querySelector('.wa-tour-flash') || {}).textContent));
  await p.evaluate(() => { const e = document.getElementById('t-out'); if (e) e.remove(); const h = document.getElementById('t-here'); if (h) h.remove(); });
  // the page is index.html?tour here: a link to this file, with or without a query, or with an empty address, loads it again (the tour would be gone); one that differs after # only does not
  const viewerLink = await poke(p, 'assets/photos/wise-pie-fall-menu-2026.webp', { 'data-zoom': '' });
  ok('step 6: the site\'s own photo link (data-zoom) is not switched off: it opens the photo viewer, with no note in the card', viewerLink.viewer && viewerLink.note === '' && viewerLink.same, JSON.stringify(viewerLink));
  const same1 = await poke(p, 'index.html'), same2 = await poke(p, 'index.html?x=1'), same3 = await poke(p, ''), same4 = await poke(p, 'index.html?tour');
  ok('step 6: a link to this same page (index.html, index.html?x=1, an empty address, index.html?tour) is switched off like a link to another page, and the page is not loaded again', switchedOff(same1) && switchedOff(same2) && switchedOff(same3) && switchedOff(same4), JSON.stringify({ same1, same2, same3, same4 }));
  const hashOnly = await poke(p, '#visit'), hashSame = await poke(p, 'index.html?tour#visit'), hashTwin = await poke(p, './?tour#visit');
  ok('step 6: a link that differs only after the # (#visit, index.html?tour#visit) works: the address changes, no note, the page stays', hashOnly.now === '/index.html?tour#visit' && hashOnly.note === '' && hashOnly.same && hashSame.now === '/index.html?tour#visit' && hashSame.note === '' && hashSame.same, JSON.stringify({ hashOnly, hashSame }));
  ok('step 6: "./?tour#visit" is this page spelled the other way ("/" for "/index.html"): the browser would load it again, so the tour only moves to the place (the address stays /index.html?tour, with #visit)', hashTwin.now === '/index.html?tour#visit' && hashTwin.note === '' && hashTwin.same, JSON.stringify(hashTwin));
  const away = await poke(p, 'https://example.com/away');
  ok('step 6: when a link is switched off the note is also said in the polite line of the card (a paragraph that appears with its words is often not read out)', switchedOff(away) && /switched off/.test(away.said), JSON.stringify(away));

  // step 7: allowClicks
  await press(p, 'Next');
  await atStep(p, 7, 'Next: step 7 (allowClicks) shows');
  s = await look(p);
  ok('step 7 says the page may be used: the dimmer lets clicks through and the dialog says it is not modal', s.free && await p.evaluate(() => getComputedStyle(document.querySelector('.wa-tour-shield')).pointerEvents === 'none' && document.querySelector('.wa-tour-card').getAttribute('aria-modal') === 'false'), '');
  const tb2 = await rectOf(p, '#t-btn');
  await p.mouse.click(tb2.x + tb2.w / 2, tb2.y + tb2.h / 2);
  ok('step 7: a click on the lit button reaches the page', (await p.evaluate(() => window.__btn)) === behind + 1, String(await p.evaluate(() => window.__btn)));
  ok('after(a5) ran when step 6 was left', (await logOf(p)).includes('after:a5'));

  // step 8: no target (not skipped): a card in the middle
  await press(p, 'Next');
  await atStep(p, 8, 'Next: step 8 shows');
  s = await look(p);
  ok('step 8 (target missing, not skipIfMissing): the card is in the middle with nothing lit, and the step is still shown', s.hole === null && near(s.card.x + s.card.w / 2, s.vw / 2, 3) && s.title === 'No target', JSON.stringify({ h: s.hole, t: s.title }));

  // step 9: a hook that throws
  await press(p, 'Next');
  await atStep(p, 9, 'Next: step 9 (its before() throws) shows all the same');
  s = await look(p);
  target = await rectOf(p, '#visit');
  ok('a before() that throws does not stop the tour: the step is shown and its target is lit', s.title === 'Broken hook' && lit(s.hole, target), JSON.stringify({ t: s.title, hole: s.hole, target }));

  /* ---------------------------------------------------------------- another page, and back */
  await press(p, 'Next');
  await until(p, () => /first-visit\.html/.test(location.pathname), null, 30000);
  const url = p.url();
  ok('step 10 is on another page: the tour went to first-visit.html by itself, with no # at the end (the account pages use the hash)', /first-visit\.html\?tour$/.test(url), url);
  await atStep(p, 10, 'the tour carried on at step 10 on the new page');
  s = await look(p);
  target = await rectOf(p, 'h1');
  ok('step 10 lights the headline of that page; the place it was resumed from in browser storage is used up (go is 0)', lit(s.hole, target) && /"go":0/.test((await store(p)).ss), JSON.stringify({ hole: s.hole, target, ss: (await store(p)).ss }));
  await press(p, 'Back');
  await until(p, () => /index\.html/.test(location.pathname) || location.pathname.endsWith('/'), null, 30000);
  await atStep(p, 9, 'Back goes to the page of the step before (the home page) and shows step 9');
  ok('Back on the other page went to the home page and showed the step before', /index\.html\?tour$/.test(p.url()) && (await look(p)).title === 'Broken hook', p.url());
  await press(p, 'Next');
  await atStep(p, 10, 'Next goes to the other page again');
  await press(p, 'Next');
  await atStep(p, 11, 'and on to the last step, on the home page');
  await inject(p);   // the home page was loaded again: the made-up box is gone
  s = await look(p);
  ok('the last step: Back, Contents, Start again and Finish (no Next), and the list in its text is a list', s.buttons.join('|') === 'Back|Contents|Start again|Finish|Close' && s.focus === 'Finish' && s.n === 11, s.buttons.join('|') + ' / ' + s.focus);

  /* ---------------------------------------------------------------- Contents */
  await press(p, 'Contents');
  await okSoon('Contents shows each part with its number of steps, and the part you are in is marked', () => p.evaluate(() => [...document.querySelectorAll('.wa-tour-chap')].map((b) => b.textContent.trim().replace(/\s+/g, ' ') + (b.getAttribute('aria-current') ? ' *' : ''))), (l) => l.join('|') === '1. Welcome 1 step|2. The first screen 4 steps|3. Planning 4 steps|4. Other page 1 step|5. The end 1 step *');
  const c1 = await look(p);
  ok('Contents says where you are and has no lit box (the page is dimmed all over)', /You are at step 11 of 11/.test(c1.text) && c1.hole === null, c1.text.slice(0, 80));
  ok('Contents is a list of buttons with no bullet dots and no padding at the left (the rule for the lists in the card\'s words does not reach it)', await p.evaluate(() => { const c = getComputedStyle(document.querySelector('.wa-tour-chapters')); return c.listStyleType === 'none' && parseFloat(c.paddingLeft) === 0; }), '');
  await p.keyboard.press('Escape');
  await atStep(p, 11, 'Esc in Contents goes back to the step (it does not close the tour)');
  await press(p, 'Contents');
  await okSoon('Contents opens again', () => look(p), (x) => x && x.title === 'Choose a part');
  await btn(p, 'Back').click();
  await atStep(p, 11, '"Back" in Contents goes back to the step');
  await press(p, 'Contents');
  await okSoon('Contents opens a third time', () => look(p), (x) => x && x.title === 'Choose a part');
  await p.getByRole('button', { name: /^3\. Planning/ }).click();
  await atStep(p, 6, 'a part in Contents goes to the first step of that part (step 6)');

  /* ---------------------------------------------------------------- keys */
  await p.keyboard.press('ArrowRight');
  await atStep(p, 7, 'the Right arrow is Next');
  await p.keyboard.press('ArrowLeft');
  await atStep(p, 6, 'the Left arrow is Back');
  // step 6 lights a section and says nothing about clicks: the keyboard may use the card and what is inside the lit section (a question), and nothing else
  const placeOf = () => p.evaluate(() => { const a = document.activeElement; return a && a.closest('.wa-tour-card') ? 'card' : a && a.closest('#faq') ? 'section' : 'page'; });
  const went = new Set();
  for (let i = 0; i < 12; i++) { await p.keyboard.press('Tab'); went.add(await placeOf()); }
  for (let i = 0; i < 12; i++) { await p.keyboard.press('Shift+Tab'); went.add(await placeOf()); }
  ok('Tab and Shift+Tab go round the buttons of the card and the lit section and never reach the rest of the page', !went.has('page') && went.has('card') && went.has('section'), [...went].join());
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.keyboard.press('Enter');
  await atStep(p, 7, 'Enter with nothing focused is Next');
  await p.keyboard.press('Escape');
  await okSoon('Esc closes the tour, the button comes back with the focus, and the page is back where this page was opened (the top: the tour came back from the other page)', () => p.evaluate(() => ({ card: !!document.querySelector('.wa-tour'), pill: !document.querySelector('.wa-tour-pill').hidden, focus: document.activeElement && document.activeElement.className, y: Math.round(scrollY) })), (x) => !x.card && x.pill && /wa-tour-pill/.test(x.focus) && x.y < 3);
  log = await logOf(p);
  ok('closing put things back: the menu a step opened is closed again (the page stays as it was) and the undo of the step ran', (await p.evaluate(() => document.getElementById('t-disc').getAttribute('aria-expanded'))) === 'false' && log.includes('undo:a5'), log.join(','));
  const st = await store(p);
  ok('closing in the middle keeps the place for another time (localStorage "wa-tour" is step a6, the tab says it is not running)', /"id":"a6"/.test(st.ls) && /"run":0/.test(st.ss), JSON.stringify(st));

  /* ---------------------------------------------------------------- stopping, coming back, finishing */
  await p.reload({ waitUntil: 'load' });
  await until(p, () => !!(window.WISE_ACRES && window.WISE_ACRES.features), null, 30000);
  await okSoon('after a reload the button is there', () => p.evaluate(() => !!document.querySelector('.wa-tour-pill') && !document.querySelector('.wa-tour-pill').hidden), (v) => v === true);
  ok('a reload does not start the tour by itself', !(await p.evaluate(() => !!document.querySelector('.wa-tour'))));
  await inject(p);
  await p.click('.wa-tour-pill');
  await okSoon('the welcome card now offers "Continue where I stopped" first, says where, and Start the tour is second', () => look(p), (x) => x && /^Continue where I stopped\|Start the tour\|Choose a part\|Not now/.test(x.buttons.join('|')) && /You stopped at step 7 of 11\./.test(x.text));
  await press(p, 'Continue where I stopped');
  await atStep(p, 7, 'Continue goes to the step where the owner stopped');
  await p.keyboard.press('Escape');
  await okSoon('closed again', () => p.evaluate(() => !document.querySelector('.wa-tour')), (v) => v === true);
  // Finish forgets
  await p.click('.wa-tour-pill');
  await okSoon('welcome again', () => look(p), (x) => x && x.name === 'Your website tour');
  await press(p, 'Continue where I stopped');
  await atStep(p, 7);
  await p.evaluate(() => window.WISE_ACRES.tour.goto('a10'));
  await atStep(p, 11, 'the last step shows');
  await press(p, 'Finish');
  await okSoon('Finish closes the tour', () => p.evaluate(() => !document.querySelector('.wa-tour')), (v) => v === true);
  const after = await store(p);
  ok('Finish left nothing of the tour in browser storage', after.ls === null && after.ss === null && !after.keys.some((k) => /tour/.test(k)), JSON.stringify(after));
  await p.click('.wa-tour-pill');
  await okSoon('after Finish the welcome card has no "Continue" button', () => look(p), (x) => x && x.buttons.join('|') === 'Start the tour|Choose a part|Not now|Close');
  await press(p, 'Choose a part');
  await okSoon('from the welcome card "Choose a part" opens Contents (no step is marked, as nothing is started)', () => look(p), (x) => x && x.title === 'Choose a part' && /Choose a part to start there/.test(x.text));
  await p.getByRole('button', { name: /^5\. The end/ }).click();
  await atStep(p, 11, 'a part chosen from the welcome card starts there');
  await press(p, 'Start again');
  await atStep(p, 1, '"Start again" goes back to step 1');
  await p.getByRole('button', { name: 'Close', exact: true }).click();
  await okSoon('the X closes the tour', () => p.evaluate(() => !document.querySelector('.wa-tour')), (v) => v === true);
  ok('no page errors so far, and the only thing the tour keeps is wa-tour', (await store(p)).keys.every((k) => k === 'wa-tour' || /^wa\./.test(k)), JSON.stringify((await store(p)).keys));
  await p.context().close();

  /* ================================================================ 2. a way in, the old place, and the other doors */
  // #tour opens the welcome card by itself, with no ?tour
  p = await open(browser, base, 'index.html#tour', errs, { routes: serve({ a: STEPS_ONE() }) });
  s = await okSoon('an address ending in #tour opens the welcome card (it never starts the tour by itself)', () => look(p), (x) => x && x.name === 'Your website tour' && x.n === 0);
  await p.context().close();
  // window.WA_TOUR = true is enough (the preview), and a link with data-tour-open opens the card without changing the address
  p = await open(browser, base, 'index.html', errs, { routes: async (pg) => { await pg.addInitScript(() => { window.WA_TOUR = true; }); await serve({ a: STEPS_ONE() })(pg); } });
  await okSoon('window.WA_TOUR = true shows the button, with no ?tour', () => p.evaluate(() => !!document.querySelector('.wa-tour-pill') && !document.querySelector('.wa-tour-pill').hidden), (v) => v === true);
  const before = p.url();
  await p.evaluate(() => { const a = document.createElement('a'); a.href = 'index.html#tour'; a.setAttribute('data-tour-open', ''); a.id = 'open-link'; a.textContent = 'Take a tour (link)'; a.style.cssText = 'position:fixed;left:10px;top:120px;z-index:60;background:#fff'; document.body.appendChild(a); });
  await p.click('#open-link');
  await okSoon('a link with data-tour-open opens the welcome card on this page, and the address does not change', () => look(p), (x) => x && x.name === 'Your website tour' && /It takes about \d+ minutes/.test(x.text));   // ("Getting the tour ready..." has the same title: wait for the words of the welcome card)
  ok('the address did not change', p.url() === before, p.url());
  ok('with one step the welcome card says "about 5 minutes" (never less)', /about 5 minutes/.test((await look(p)).text));
  await p.context().close();
  // the home page is "/" on the real site and "index.html" in a link: they are one page
  p = await open(browser, base, '', errs, { routes: async (pg) => { await pg.addInitScript(() => { window.WA_TOUR = true; }); await serve({ a: STEPS_ONE() })(pg); } });
  await p.click('.wa-tour-pill');
  await okSoon('the page served as "/": the welcome card opens', () => look(p), (x) => x && x.name === 'Your website tour');
  ok('the address of this page is "/" (no index.html, no query)', new URL(p.url()).pathname === '/' && new URL(p.url()).search === '', p.url());
  const root1 = await poke(p, 'index.html#visit'), root2 = await poke(p, '#visit');
  ok('"/" and "index.html" are the same page: a link to index.html#visit works (the tour moves to the place and the address stays "/"), and so does #visit', root1.now === '/#visit' && root1.note === '' && root1.same && root2.now === '/#visit' && root2.note === '' && root2.same, JSON.stringify({ root1, root2 }));
  const root3 = await poke(p, 'index.html'), root4 = await poke(p, './'), root5 = await poke(p, 'first-visit.html#top'), root6 = await poke(p, 'index.html?x=1#visit');
  ok('"/": a link to the page itself (index.html, ./), to another page, or to the same page with another query is switched off, and the page is not loaded again', switchedOff(root3) && switchedOff(root4) && switchedOff(root5) && switchedOff(root6), JSON.stringify({ root3, root4, root5, root6 }));
  await p.context().close();
  // an old place is not resumed; a fresh one is (the jump of the tour itself)
  const placeAt = (v) => async (pg) => { await pg.addInitScript((val) => { try { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); sessionStorage.setItem('wa-tour', JSON.stringify(val)); } } catch (e) { /* blocked */ } }, v); await serve({ a: STEPS_A, b: STEPS_B })(pg); };
  p = await open(browser, base, 'index.html', errs, { query: 'tour', routes: placeAt({ run: 1, id: 'a5', ch: 3, go: 1000 }) });
  await settled(p, 1500);
  ok('a place left more than 30 seconds ago is not resumed: no card, and the tab is marked as not running', !(await p.evaluate(() => !!document.querySelector('.wa-tour'))) && /"run":0/.test((await store(p)).ss), JSON.stringify(await store(p)));
  await p.context().close();
  p = await open(browser, base, 'index.html', errs, { query: 'tour', routes: async (pg) => { await pg.addInitScript(() => { try { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); sessionStorage.setItem('wa-tour', JSON.stringify({ run: 1, id: 'a5', ch: 3, go: Date.now() })); } } catch (e) { /* blocked */ } }); await serve({ a: STEPS_A, b: STEPS_B })(pg); } });
  await atStep(p, 6, 'a fresh place (the tour has just come from another page) carries on at once, with no card to press first');
  await p.context().close();

  // the pretend-account pages: their steps only count when demo mode is on
  const withAccount = STEPS_A + `(window.WA_TOUR_STEPS).push({ id: 'acc1', order: 1001, chapter: 10, page: 'account', target: '[data-tour="acct-signup"]', skipIfMissing: true, title: 'Account', text: 'Pretend.' });`;
  p = await open(browser, base, 'index.html', errs, { query: 'tour', routes: serve({ a: withAccount, b: STEPS_B }) });
  await p.click('.wa-tour-pill');
  await okSoon('demo mode off: the steps of the account pages are left out (still 11 steps, no 10th part)', () => look(p), (x) => x && x.name === 'Your website tour');
  await press(p, 'Start the tour');
  await atStep(p, 1);
  ok('demo mode off: 11 steps, not 12', (await look(p)).of === 11, String((await look(p)).of));
  await p.context().close();
  p = await open(browser, base, 'index.html', errs, { query: 'tour', routes: async (pg) => { await pg.addInitScript(() => { window.WA_DEMO = true; }); await serve({ a: withAccount, b: STEPS_B })(pg); } });   // WA_DEMO is the flag the preview build sets; js/demo-header.js (on every page) turns it into window.WA_DEMO_MODE()
  await p.click('.wa-tour-pill');
  await okSoon('demo mode on', () => look(p), (x) => x && x.name === 'Your website tour');
  await press(p, 'Start the tour');
  await atStep(p, 1);
  ok('demo mode on (window.WA_DEMO is true, so window.WA_DEMO_MODE() is true): the account step is counted, 12 steps', (await look(p)).of === 12, String((await look(p)).of));
  await p.context().close();

  // no steps at all, and no part list
  p = await open(browser, base, 'index.html', errs, { query: 'tour', routes: serve({}) });
  await p.click('.wa-tour-pill');
  s = await okSoon('with no steps file at all the card says plainly that the tour could not start, and can be closed', () => look(p), (x) => x && x.title === 'The tour could not start');
  await p.getByRole('button', { name: 'Close', exact: true }).first().click();
  await okSoon('closed', () => p.evaluate(() => !document.querySelector('.wa-tour')), (v) => v === true);
  await p.context().close();
  p = await open(browser, base, 'index.html', errs, { query: 'tour', routes: serve({ a: `(window.WA_TOUR_STEPS = window.WA_TOUR_STEPS || []).push({ id: 'x1', order: 2, chapter: 7, target: null, title: 'Two', text: '2' }, { id: 'x0', order: 1, chapter: 'Opening', target: null, title: 'One', text: '1' });` }) });
  await p.click('.wa-tour-pill');
  await okSoon('welcome', () => look(p), (x) => x && x.name === 'Your website tour');
  await press(p, 'Choose a part');
  await okSoon('with no list of part titles, Contents uses the chapter (a number becomes "Part 7", a word is the title), in the order of the steps', () => p.evaluate(() => [...document.querySelectorAll('.wa-tour-chap-name')].map((e) => e.textContent)), (l) => l.join('|') === '1. Opening|2. Part 7');
  await p.context().close();

  /* ================================================================ 3. what it does to a page the preview shows: observers that never fire, files already inside */
  p = await open(browser, base, 'index.html', errs, { query: 'tour', routes: async (pg) => {
    await pg.addInitScript(() => { window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } }; });   // the frame of the preview may never call them
    await serve({ a: STEPS_ONE().replace("'.announce'", "'article.choose-farm'") })(pg);
  } });
  const dead = await p.evaluate(() => getComputedStyle(document.querySelector('article.choose-farm')).opacity);
  await p.click('.wa-tour-pill');
  await okSoon('welcome', () => look(p), (x) => x && x.name === 'Your website tour');
  await press(p, 'Start the tour');
  await atStep(p, 1);
  await okSoon('a box that is still waiting to fade in (its observer never fires) is shown by the tour: the lit card is opaque', () => p.evaluate(() => getComputedStyle(document.querySelector('article.choose-farm')).opacity), (v) => Number(v) === 1);
  ok('(the card was invisible before, so the check above means something)', Number(dead) < 1, dead);
  await p.context().close();

  const asked2 = [];
  p = await open(browser, base, 'index.html', errs, { routes: async (pg) => {
    await pg.addInitScript('window.WA_TOUR = true; window.WA_TOUR_INLINE = true;');
    await pg.addInitScript(STEPS_ONE());   // the steps are already in the page (the preview build puts them in before js/tour.js)
    pg.on('request', (r) => asked2.push(new URL(r.url()).pathname));
  } });
  await p.addStyleTag({ content: CSS });
  await okSoon('WA_TOUR_INLINE: the button is there', () => p.evaluate(() => !!document.querySelector('.wa-tour-pill') && !document.querySelector('.wa-tour-pill').hidden), (v) => v === true);
  await p.click('.wa-tour-pill');
  await okSoon('WA_TOUR_INLINE: with the steps and the style already in the page the tour opens', () => look(p), (x) => x && x.name === 'Your website tour' && /Continue|Start the tour/.test(x.buttons.join()));
  await press(p, 'Start the tour');
  await atStep(p, 1, 'WA_TOUR_INLINE: step 1 shows');
  ok('WA_TOUR_INLINE: no request at all for css/tour.css or the steps files', !asked2.some((u) => /tour\.css|tour-steps/.test(u)), asked2.filter((u) => /tour/.test(u)).join(' '));
  await p.context().close();

  /* ================================================================ 4. calm mode and reduced motion */
  p = await open(browser, base, 'index.html', errs, { query: 'tour', reducedMotion: 'reduce', routes: serve({ a: STEPS_A, b: STEPS_B }) });
  await p.click('.wa-tour-pill');
  await okSoon('welcome (reduced motion)', () => look(p), (x) => x && x.name === 'Your website tour');
  await press(p, 'Start the tour');
  await press(p, 'Next');
  await atStep(p, 2);
  const m1 = await p.evaluate(() => { const h = getComputedStyle(document.querySelector('.wa-tour-hole')), c = getComputedStyle(document.querySelector('.wa-tour-card')), b = getComputedStyle(document.querySelector('.wa-tour-bar i')); return { hole: h.transitionDuration, card: c.animationName, cardT: c.transitionDuration, bar: b.transitionDuration }; });
  ok('reduced motion: nothing slides or fades (no transition on the lit box, the card or the progress bar, no entrance animation)', /^0s(, 0s)*$/.test(m1.hole) && m1.card === 'none' && /^0s(, 0s)*$/.test(m1.cardT) && /^0s(, 0s)*$/.test(m1.bar), JSON.stringify(m1));
  await p.context().close();
  p = await open(browser, base, 'index.html', errs, { query: 'tour', routes: serve({ a: STEPS_A, b: STEPS_B }) });
  await p.evaluate(() => document.documentElement.setAttribute('data-calm', 'all'));   // "Pause animations"
  await p.click('.wa-tour-pill');
  await okSoon('welcome (calm)', () => look(p), (x) => x && x.name === 'Your website tour');
  await press(p, 'Start the tour');
  await press(p, 'Next');
  await atStep(p, 2);
  const m2 = await p.evaluate(() => { const h = getComputedStyle(document.querySelector('.wa-tour-hole')), c = getComputedStyle(document.querySelector('.wa-tour-card')); return { still: document.querySelector('.wa-tour').classList.contains('is-still'), glide: document.querySelector('.wa-tour').classList.contains('is-gliding'), hole: h.transitionDuration, card: c.animationName }; });
  ok('calm mode ("Pause animations"): nothing slides or fades either, and the lit box does not glide', m2.still && !m2.glide && /^0s(, 0s)*$/.test(m2.hole) && m2.card === 'none', JSON.stringify(m2));
  await p.context().close();
  p = await open(browser, base, 'index.html', errs, { query: 'tour', routes: serve({ a: STEPS_A, b: STEPS_B }) });
  await p.click('.wa-tour-pill');
  await okSoon('welcome (normal motion)', () => look(p), (x) => x && x.name === 'Your website tour');
  await press(p, 'Start the tour'); await press(p, 'Next'); await atStep(p, 2);
  const m3 = await p.evaluate(() => getComputedStyle(document.querySelector('.wa-tour-card')).animationName);
  ok('(normal motion: the card does come in with an animation, so the two checks above mean something)', m3 === 'wa-tour-in', m3);
  const ax = axeSource();
  if (ax) {
    await p.evaluate(ax);
    const res = await p.evaluate(async () => { const r = await window.axe.run({ include: [['#wa-tour']] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } }); return r.violations.map((v) => v.id + ': ' + v.nodes.map((n) => n.target.join(' ')).join(' | ')); });
    ok('axe (WCAG 2.1 A and AA, best practices) finds nothing wrong in the open tour card', res.length === 0, res.join(' ;; '));
  } else info('axe-core is not installed here: the accessibility check of the card was skipped');
  await p.context().close();

  /* ================================================================ 5. a phone */
  p = await open(browser, base, 'index.html', errs, { query: 'tour', viewport: PHONE, touch: true, routes: serve({ a: STEPS_A, b: STEPS_B }) });
  await inject(p);
  const pp = await rectOf(p, '.wa-tour-pill');
  ok('phone: the button is inside the window, clear of the bottom bar and of the basket box', pp && pp.r <= 390 && pp.b <= 844 && overlap(pp, await rectOf(p, '.action-bar')) === 0 && overlap(pp, await rectOf(p, '.picker')) === 0, JSON.stringify(pp));
  await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 1500); });
  await okSoon('phone: scrolled down, the round button shows and the tour button does not cover it', async () => (await p.evaluate(() => !document.querySelector('.to-top').hidden)) ? overlap(await rectOf(p, '.to-top'), await rectOf(p, '.wa-tour-pill')) : -1, (v) => v === 0);
  await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 0); });
  await p.tap('.wa-tour-pill');
  await okSoon('phone: the welcome card is a sheet at the bottom, 8 px from the edges', () => look(p), (x) => x && x.name === 'Your website tour' && x.sheet && !x.busy);
  await rest(p);
  s = await look(p);   // (okSoon says whether it was true; it does not give the value back)
  ok('phone: the sheet is 8 px from the left, the right and the bottom', near(s.card.x, 8, 1) && near(s.card.r, 382, 1) && near(s.card.b, 836, 2), JSON.stringify(s.card));
  await p.tap('text=Start the tour');
  await atStep(p, 1);
  await btn(p, 'Next').tap(); await atStep(p, 2);
  await btn(p, 'Next').tap(); await atStep(p, 3);
  s = await look(p);
  target = await rectOf(p, '.hero-cta .btn-red');
  ok('phone: the red button is lit, the card is the sheet under it, and the button is not under the sheet', lit(s.hole, target) && s.sheet && target.b <= s.card.y && inside(s.card, s.vw, s.vh), JSON.stringify({ hole: s.hole, target, card: s.card }));
  await btn(p, 'Next').tap(); await atStep(p, 5);
  await btn(p, 'Next').tap(); await atStep(p, 6);
  s = await look(p);
  target = await rectOf(p, '#faq');
  ok('phone: a section below is brought up under the top bar, and the sheet is over its lower part', target.y >= 60 && target.y <= 130 && s.sheet, JSON.stringify({ ty: target.y }));
  ok('phone: the page does not scroll sideways while the tour is open', await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1);
  await btn(p, 'Contents').tap();
  s = await okSoon('phone: Contents fits the sheet: the list scrolls and the Back button stays in the window', () => look(p), (x) => x && x.title === 'Choose a part' && inside(x.card, x.vw, x.vh));
  await p.context().close();

  /* ================================================================ 6. a long text scrolls inside the card */
  p = await open(browser, base, 'index.html', errs, { query: 'tour', viewport: { width: 1280, height: 600 }, routes: serve({ a: STEPS_LONG }) });
  await p.click('.wa-tour-pill');
  await okSoon('welcome', () => look(p), (x) => x && x.name === 'Your website tour');
  await press(p, 'Start the tour');
  await atStep(p, 1, 'a step with a very long text shows');
  s = await look(p);
  ok('a very long text (160 words) in a low window: the card stays inside the window, the text scrolls inside it and the buttons stay in view', inside(s.card, s.vw, s.vh) && s.bodyScroll && (await p.evaluate(() => { const b = document.querySelector('.wa-tour-actions').getBoundingClientRect(); return b.bottom <= innerHeight && b.top >= 0; })), JSON.stringify({ card: s.card, scroll: s.bodyScroll }));
  await p.context().close();

  /* ================================================================ 7. a step's own row of small buttons (step.choices) */
  p = await open(browser, base, 'index.html', errs, { query: 'tour', routes: serve({ a: STEPS_CHOICES }) });
  await p.click('.wa-tour-pill');
  await okSoon('choices: welcome', () => look(p), (x) => x && x.name === 'Your website tour');
  await press(p, 'Start the tour');
  await atStep(p, 1, 'choices: a card without choices shows first');
  s = await look(p);
  ok('a step without choices has no row of small buttons: the row is hidden and empty', s.choicesRow === null && s.choices === '' && (await p.evaluate(() => document.querySelector('.wa-tour-choices').hidden && document.querySelector('.wa-tour-choices').childElementCount === 0)), JSON.stringify(s.choicesRow));
  await press(p, 'Next');
  await atStep(p, 2, 'choices: step 2 (three small buttons) shows');
  s = await look(p);
  ok('a step with choices: the row has its words above the buttons and is a group with that name; one button each, none pressed; the step\'s own title and text show', !!s.choicesRow && s.choicesRow.label === 'See it as:' && s.choicesRow.role === 'group' && s.choicesRow.name === 'See it as:' && s.choicesRow.busy === 'false' && s.choices === 'One|Two|Three' && s.title === 'Pick one' && s.text === 'Intro text.', JSON.stringify({ r: s.choicesRow, c: s.choices, t: s.title }));
  const order = await p.evaluate(() => { const r = (q) => document.querySelector(q).getBoundingClientRect(); return { body: r('.wa-tour-body').bottom, row: [r('.wa-tour-choices').top, r('.wa-tour-choices').bottom], actions: r('.wa-tour-actions').top, minH: Math.min(...[...document.querySelectorAll('.wa-tour-choice')].map((b) => b.getBoundingClientRect().height)) }; });
  target = await rectOf(p, '.announce');
  ok('the row sits between the text and Back / Next, each button is a finger high (44 px), the focus is still on Next, and the lit box is the strip with the card clear of it', order.body <= order.row[0] + 1 && order.row[1] <= order.actions + 1 && order.minH >= 43.5 && s.focus === 'Next' && lit(s.hole, target) && overlap(s.card, target) === 0 && inside(s.card, s.vw, s.vh), JSON.stringify({ order, f: s.focus }));
  ok('(the step\'s before() ran, and no run() has run yet: nothing is pressed for the owner)', (await logOf(p)).join() === 'before:c2');

  await btn(p, 'One').click();
  await okSoon('pressing One: it is pressed (the others are not), the card shows that choice\'s title and its text (a list too), and the lit box is still the strip', () => look(p), (x) => x.choices === 'One*|Two|Three' && x.title === 'First choice' && x.text.startsWith('Text of one.') && x.items === 2 && x.choicesRow.busy === 'false' && lit(x.hole, target));
  log = await logOf(p);
  ok('run(ctx) of One ran once, with the step in ctx', log.filter((l) => /^run:/.test(l)).join() === 'run:one:c2', log.join(','));
  await okSoon('a screen reader hears the new title and text in one polite line', () => look(p), (x) => /First choice\. Text of one\. - a - b/.test(x.live));
  await btn(p, 'One').click();
  await p.waitForTimeout(300);
  ok('pressing the pressed button again does nothing (run() did not run twice)', (await logOf(p)).filter((l) => /^run:one/.test(l)).length === 1);

  // a slow run(): the button is pressed at once, the old text stays until it is over, and a press meanwhile is ignored
  await btn(p, 'Two').click();
  s = await look(p);
  ok('Two (a run() that takes a while): pressed at once, the row says it is busy, the old title and text stay until it is over', s.choices === 'One|Two*|Three' && s.choicesRow.busy === 'true' && s.title === 'First choice', JSON.stringify({ c: s.choices, b: s.choicesRow && s.choicesRow.busy, t: s.title }));
  await btn(p, 'Three').click();
  await okSoon('...then the card shows the text of Two, and since Two has no title of its own the step\'s title is back', () => look(p), (x) => x.title === 'Pick one' && x.text === 'Text of two.' && x.choicesRow.busy === 'false' && x.choices === 'One|Two*|Three');
  log = await logOf(p);
  ok('run() of Two was waited for, and the press on Three while it was running was ignored', log.indexOf('run:two:start') > -1 && log.indexOf('run:two:start') < log.indexOf('run:two:done') && !log.includes('run:three'), log.join(','));

  // a run() that throws does not stop the card
  await btn(p, 'Three').click();
  await okSoon('Three (its run() throws): the card still shows its title and text', () => look(p), (x) => x.title === 'Third' && x.text === 'Text of three.' && x.choices === 'One|Two|Three*');
  ok('...and run() of Three did run', (await logOf(p)).includes('run:three'));

  // Next while a slow run() is still going: it is waited for before after() runs
  await btn(p, 'Two').click();
  await press(p, 'Next');
  await atStep(p, 3, 'choices: Next while a press is still being carried out goes on to step 3');
  log = await logOf(p);
  ok('after() of the step ran only after the slow run() was over', log.lastIndexOf('run:two:start') > -1 && log.lastIndexOf('run:two:done') > log.lastIndexOf('run:two:start') && log.indexOf('after:c2') > log.lastIndexOf('run:two:done'), log.join(','));

  // a list given by a function: asked when the card shows; a bad entry (null, no label, a word) is left out
  s = await look(p);
  ok('a list given by a function: it was asked with the step in ctx; only the good entries are buttons (a null, a word, an entry without a label are left out); no words above them, the group is called "Choose"', log.includes('choices:c3:c3') && /^Only\|Preset\*?$/.test(s.choices) && s.choicesRow.label === '' && s.choicesRow.name === 'Choose', JSON.stringify({ c: s.choices, r: s.choicesRow }));
  ok('a choice that says pressed: true (before() has already done it) shows pressed, with its own words, and no run() is called for it', s.choices === 'Only|Preset*' && s.title === 'List from a function' && s.text === 'Already in effect.', JSON.stringify({ c: s.choices, t: s.text }));
  await btn(p, 'Only').click();
  await okSoon('a choice with no run() and no title: only the text changes', () => look(p), (x) => x.title === 'List from a function' && x.text === 'Only text.' && x.choices === 'Only*|Preset');

  // Back: the step starts again with nothing pressed
  await press(p, 'Back');
  await atStep(p, 2, 'choices: Back shows step 2 again');
  s = await look(p);
  ok('coming back to the step: nothing is pressed and the step\'s own title and text show again; before() ran again', s.choices === 'One|Two|Three' && s.title === 'Pick one' && s.text === 'Intro text.' && (await logOf(p)).filter((l) => l === 'before:c2').length === 2, s.choices);

  // Contents and back: the pressed button and its text stay (the page was not changed back)
  await btn(p, 'One').click();
  await okSoon('One is pressed again', () => look(p), (x) => x.choices === 'One*|Two|Three' && x.title === 'First choice');
  const afters = (await logOf(p)).filter((l) => l === 'after:c2').length;
  await press(p, 'Contents');
  s = await okSoon('Contents has no small buttons of its own', () => look(p), (x) => x && x.title === 'Choose a part' && x.choicesRow === null && x.choices === '');
  await btn(p, 'Back').click();
  await okSoon('Back from Contents: the same step, with One still pressed and its text, and after() did not run meanwhile', async () => ({ l: await look(p), a: (await logOf(p)).filter((x) => x === 'after:c2').length }), (v) => v.l && v.l.n === 2 && v.l.choices === 'One*|Two|Three' && v.l.title === 'First choice' && v.a === afters);
  await press(p, 'Contents');
  await okSoon('Contents opens again', () => look(p), (x) => x && x.title === 'Choose a part');
  await p.getByRole('button', { name: /^1\. Choices/ }).click();
  await atStep(p, 1, 'choices: a part chosen in Contents goes to its first step');
  ok('...and after() of step 2 ran when it was left that way', (await logOf(p)).filter((l) => l === 'after:c2').length === afters + 1);

  // the keyboard: the small buttons are in the Tab round, and Enter presses one
  await press(p, 'Next');
  await atStep(p, 2, 'choices: step 2 again, for the keyboard');
  let reached = '';
  for (let i = 0; i < 4 && !/^(One|Two|Three)$/.test(reached); i++) { await p.keyboard.press('Shift+Tab'); reached = (await look(p)).focus; }
  ok('Shift+Tab from Next reaches the small buttons (Contents, Back, then Three)', reached === 'Three', reached);
  await p.keyboard.press('Enter');
  await okSoon('Enter on the small button presses it', () => look(p), (x) => x.choices === 'One|Two|Three*' && x.title === 'Third');

  // axe on the card with its row
  const ax2 = axeSource();
  if (ax2) {
    await p.evaluate(ax2);
    const res2 = await p.evaluate(async () => { const r = await window.axe.run({ include: [['#wa-tour']] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } }); return r.violations.map((v) => v.id + ': ' + v.nodes.map((n) => n.target.join(' ')).join(' | ')); });
    ok('axe (WCAG 2.1 A and AA, best practices) finds nothing wrong in the card with its row of small buttons', res2.length === 0, res2.join(' ;; '));
  } else info('axe-core is not installed here: the accessibility check of the row was skipped');

  // Esc while a slow press is going: the card goes, the press is waited for (a short while), after() and the undo of the earlier press ran
  await btn(p, 'Two').click();
  await p.keyboard.press('Escape');
  await okSoon('Esc while a press is still being carried out closes the tour', () => p.evaluate(() => !document.querySelector('.wa-tour')), (v) => v === true);
  log = await logOf(p);
  ok('...the slow run() was over before the tour was taken away, after() of the step ran, and the undo of a press ran', log.lastIndexOf('run:two:done') > -1 && log.lastIndexOf('after:c2') > log.lastIndexOf('run:two:done') && log.includes('undo:one'), log.join(','));
  await p.context().close();

  // the welcome card's minutes: a step with small buttons counts as three (there is more to look at), a plain step as one; 15 seconds each, to the nearest 5 minutes
  const many = (extra) => `(window.WA_TOUR_STEPS = window.WA_TOUR_STEPS || []).push.apply(window.WA_TOUR_STEPS, Array.from({ length: 20 }, function (_, i) { return { id: 'm' + i, order: 101 + i, chapter: 1, page: 'index', target: null, title: 'M' + i, text: 'm'${extra} }; }));`;
  for (const [extra, minutes, what] of [['', 5, '20 plain steps'], [", choices: [{ label: 'A', text: 'a' }]", 15, '20 steps with small buttons']]) {
    p = await open(browser, base, 'index.html', errs, { query: 'tour', routes: serve({ a: many(extra) }) });
    await p.click('.wa-tour-pill');
    await okSoon('the welcome card for ' + what + ' says about ' + minutes + ' minutes', () => look(p), (x) => x && x.name === 'Your website tour' && new RegExp('It takes about ' + minutes + ' minutes\\.').test(x.text));
    await p.context().close();
  }

  // a phone: the row wraps inside the sheet
  p = await open(browser, base, 'index.html', errs, { query: 'tour', viewport: PHONE, touch: true, routes: serve({ a: STEPS_CHOICES }) });
  await p.tap('.wa-tour-pill');
  await okSoon('choices (phone): welcome', () => look(p), (x) => x && x.name === 'Your website tour');
  await p.tap('text=Start the tour');
  await atStep(p, 1);
  await btn(p, 'Next').tap();
  await atStep(p, 2, 'choices (phone): step 2 shows');
  await btn(p, 'Two').tap();
  await okSoon('choices (phone): a tap presses a small button and the card changes', () => look(p), (x) => x.choices === 'One|Two*|Three' && x.text === 'Text of two.');
  s = await look(p);
  target = await rectOf(p, '.announce');
  ok('choices (phone): the sheet with the row is inside the window and the page does not scroll sideways', s.sheet && inside(s.card, s.vw, s.vh) && (await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 1, JSON.stringify({ card: s.card }));
  await p.context().close();

  /* ================================================================ 8. what an independent walk of the real tour found */
  const STEPS_WALK = `
(window.WA_TOUR_STEPS = window.WA_TOUR_STEPS || []).push(
  { id: 'w1', order: 101, chapter: 1, page: 'index', target: '#faq', title: 'A lit section', text: 'Forms, links, a question and a dialog.' },
  { id: 'w2', order: 102, chapter: 1, page: 'index', target: '#t-wide', title: 'A wide box', text: 'The card keeps off the buttons.' },
  { id: 'w3', order: 103, chapter: 1, page: 'index', target: null, title: 'The end', text: 'End.' }
);
window.WA_TOUR_CHAPTERS = [{ n: 1, title: 'Walk' }];
`;
  p = await open(browser, base, 'index.html', errs, { query: 'tour', routes: serve({ a: STEPS_WALK }) });
  await p.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    // in the lit section (#faq): a form that nobody handles, a form the page handles, a form that only closes a dialog, a question, a link to a place far away, a menu with its own Esc
    const host = document.querySelector('#faq .faq-list') || document.querySelector('#faq');
    const box = document.createElement('div'); box.id = 't-walk'; box.style.cssText = 'padding:12px;background:#fff';
    box.innerHTML = '<form id="t-bare" novalidate><input id="t-email" name="EMAIL" type="email" value="a@b.example"> <button type="submit" id="t-bare-go">Join the list</button></form>'
      + '<form id="t-own" novalidate><button type="submit" id="t-own-go">Handled by the page</button></form>'
      + '<form id="t-dlg" method="dialog"><button type="submit" id="t-dlg-go">Closes a dialog</button></form>'
      + '<details id="t-q"><summary id="t-sum">A question</summary><p>An answer.</p></details>'
      + '<a id="t-down" href="#visit" style="display:inline-block;padding:8px">Go to the visit part</a> '
      + '<button type="button" id="t-menu-btn" aria-expanded="false" aria-controls="t-menu-list">Menu</button><ul id="t-menu-list" hidden><li>One</li></ul>';
    host.appendChild(box);
    window.__own = 0; window.__menuEsc = 0; window.__kept = 'kept';
    document.getElementById('t-own').addEventListener('submit', (e) => { e.preventDefault(); window.__own++; });
    const mb = document.getElementById('t-menu-btn');
    mb.addEventListener('click', () => { const o = mb.getAttribute('aria-expanded') !== 'true'; mb.setAttribute('aria-expanded', String(o)); document.getElementById('t-menu-list').hidden = !o; });
    mb.addEventListener('keydown', (e) => { if (e.key === 'Escape' && mb.getAttribute('aria-expanded') === 'true') { window.__menuEsc++; mb.click(); } });   // the page closes its own menu
    // a wide lit box with a button at the top right and one at the bottom right: there is no room beside it, so the card has to sit on it
    const wide = document.createElement('div'); wide.id = 't-wide'; wide.style.cssText = 'position:fixed;left:100px;top:100px;width:1240px;height:640px;z-index:55;background:#fffdf6;border:2px solid #3a2416';
    wide.innerHTML = '<h2 style="margin:12px">A wide box</h2><button type="button" id="t-no" style="position:absolute;right:20px;top:20px;width:200px;height:60px">No</button><button type="button" id="t-yes" style="position:absolute;right:20px;bottom:20px;width:200px;height:60px">Yes</button><span id="t-tag" class="t-tag" style="position:absolute;left:20px;bottom:20px;padding:6px 12px;background:#d33;color:#fff">Next door</span><p style="margin:12px">Plain words.</p>';
    document.body.appendChild(wide);
    // a dialog of the page, built like the pretend account's (css/demo.css: fixed, z-index 200; js/demo-ui.js: Esc is heard on the document, in the capture phase)
    const st = document.createElement('style');
    st.textContent = '.demo-modal{position:fixed;top:0;right:0;bottom:0;left:0;z-index:200;display:flex;align-items:flex-start;justify-content:center;padding:80px 14px;background:rgba(0,0,0,.45)}.demo-modal-box{position:relative;box-sizing:border-box;width:min(100%,44rem);height:360px;background:#fff;border:3px solid #000;padding:20px}';
    document.head.appendChild(st);
    window.__modalClicks = 0; window.__modalEsc = 0;
    window.__openModal = () => {
      const back = document.createElement('div'); back.className = 'demo-modal'; back.setAttribute('data-demo-modal', '');
      back.innerHTML = '<div class="demo-modal-box" role="dialog" aria-modal="true" tabindex="-1"><h2>A dialog</h2><button type="button" id="t-m-ok">OK</button></div>';
      document.body.appendChild(back);
      back.querySelector('#t-m-ok').addEventListener('click', () => { window.__modalClicks++; });
      const onKey = (e) => { if (e.key === 'Escape') { window.__modalEsc++; back.remove(); document.removeEventListener('keydown', onKey, true); } };
      document.addEventListener('keydown', onKey, true);
      back.querySelector('#t-m-ok').focus();
    };
  });
  await p.click('.wa-tour-pill');
  await okSoon('walk: the welcome card opens', () => look(p), (x) => x && x.name === 'Your website tour' && !x.busy);
  await press(p, 'Start the tour');
  await atStep(p, 1, 'walk: step 1 lights the FAQ section');
  ok('walk: while the tour is open <html> has the class wa-tour-open', await p.evaluate(() => document.documentElement.classList.contains('wa-tour-open')), '');
  const showMid = (sel) => p.evaluate((x) => document.querySelector(x).scrollIntoView({ block: 'center' }), sel).then(() => p.waitForTimeout(400));
  const noteNow = () => p.evaluate(() => (document.querySelector('.wa-tour-flash') || {}).textContent || '');
  const clearNote = () => p.evaluate(() => { const n = document.querySelector('.wa-tour-flash'); if (n) n.remove(); });

  // a form nobody handles (no action, no script: the sign-up preview): its send would load this page again with the fields in the address, and the tour would be gone
  await showMid('#t-bare-go');
  const urlWas = p.url();
  await p.click('#t-bare-go');
  await p.waitForTimeout(500);
  let bare;
  try { bare = await p.evaluate(() => ({ url: location.href, kept: window.__kept, card: !!document.querySelector('.wa-tour-card'), note: (document.querySelector('.wa-tour-flash') || {}).textContent || '' })); } catch (e) { bare = { error: String(e.message).slice(0, 90) }; }
  ok('walk: a form that nobody handles is stopped: the address does not change, the page is not loaded again, the tour stays, and the card says forms are switched off', !bare.error && bare.url === urlWas && bare.kept === 'kept' && bare.card && /Forms are switched off/.test(bare.note), JSON.stringify(bare));
  await clearNote();
  await showMid('#t-own-go');
  await p.click('#t-own-go');
  await p.waitForTimeout(300);
  ok('walk: a form the page handles itself (its own code stops the send) is left alone: the code ran once and the card has no note', (await p.evaluate(() => window.__own)) === 1 && (await noteNow()) === '', String(await noteNow()));
  await showMid('#t-dlg-go');
  await p.click('#t-dlg-go');
  await p.waitForTimeout(300);
  ok('walk: a form that only closes a dialog (method="dialog") is left alone too', (await noteNow()) === '' && (await p.evaluate(() => window.__kept)) === 'kept', String(await noteNow()));
  // the photo viewer: opened by a photo link of the page, closed by the form in its corner
  await p.evaluate(() => { const a = document.createElement('a'); a.id = 't-photo'; a.href = 'assets/photos/wise-pie-fall-menu-2026.webp'; a.setAttribute('data-zoom', ''); a.textContent = 'A photo'; a.style.cssText = 'display:inline-block;padding:8px'; document.getElementById('t-walk').appendChild(a); if (window.WISE_ACRES && window.WISE_ACRES.bindZoom) window.WISE_ACRES.bindZoom(a); });
  await showMid('#t-photo');
  await p.click('#t-photo');
  await okSoon('walk: a photo link of the page opens the photo viewer while the tour is open', () => p.evaluate(() => !!document.querySelector('dialog[open]')), (v) => v === true);
  await p.click('dialog[open] .lightbox-close');
  await okSoon('walk: ...and the viewer\'s own close button closes it (its form is not stopped), with no note in the card', async () => ({ open: await p.evaluate(() => !!document.querySelector('dialog[open]')), note: await noteNow() }), (v) => v.open === false && v.note === '');

  // a dialog of the page opened over the tour (the pretend account's .demo-modal): above the dimmer and the card, usable, and it keeps its Esc
  await p.evaluate(() => window.__openModal());
  await p.waitForTimeout(500);   // the card moves off the dialog on the next frame or two
  const mz = await p.evaluate(() => { const back = document.querySelector('.demo-modal'), okb = document.getElementById('t-m-ok'), r = okb.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { z: getComputedStyle(back).zIndex, onTop: hit === okb }; });
  ok('walk: a dialog the page opens while the tour is open is above the dimmer (z-index 9100), and its button is the thing at that place', mz.z === '9100' && mz.onTop, JSON.stringify(mz));
  const reach = await p.evaluate(() => {
    const back = document.querySelector('.demo-modal'), box = back.querySelector('.demo-modal-box'), cs = getComputedStyle(back), card = document.querySelector('.wa-tour-card');
    const nx = [...card.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Next'), r = nx.getBoundingClientRect(), c = card.getBoundingClientRect(), d = box.getBoundingClientRect(), o = document.getElementById('t-m-ok').getBoundingClientRect();
    const area = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return { bg: cs.backgroundColor, pe: cs.pointerEvents, boxPe: getComputedStyle(box).pointerEvents, nextOnTop: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === nx, cardOverBox: Math.round(100 * area(c, d) / (d.width * d.height)), cardOverOk: area(c, o) };
  });
  ok('walk: the dialog\'s own dim overlay does not dim or block (transparent, no pointer events), only its box takes clicks, the Next button of the card is still the thing at its place, and the card sits off the dialog (it covers its button not at all and its box by ' + reach.cardOverBox + ' percent)', reach.bg === 'rgba(0, 0, 0, 0)' && reach.pe === 'none' && reach.boxPe === 'auto' && reach.nextOnTop && reach.cardOverOk === 0 && reach.cardOverBox <= 10, JSON.stringify(reach));
  await p.click('#t-m-ok');
  ok('walk: ...a real click on the dialog\'s button reaches it', (await p.evaluate(() => window.__modalClicks)) === 1, '');
  await press(p, 'Next');
  await atStep(p, 2, 'walk: Next works while the dialog is open (the card is not under its overlay)');
  await press(p, 'Back');
  await atStep(p, 1, 'walk: ...and Back');
  ok('walk: (the dialog is still open: the tour does not close the dialogs of the page; a step that opens one closes it in its after())', await p.evaluate(() => !!document.querySelector('.demo-modal')), '');
  await p.focus('#t-m-ok');
  await p.keyboard.press('Escape');
  await okSoon('walk: Esc with the dialog open (the focus is in it) closes the dialog and not the tour', () => p.evaluate(() => ({ esc: window.__modalEsc, modal: !!document.querySelector('.demo-modal'), card: !!document.querySelector('.wa-tour-card') })), (v) => v.esc === 1 && !v.modal && v.card);
  await p.evaluate(() => { window.__openModal(); document.activeElement.blur(); });
  await p.keyboard.press('Escape');
  await okSoon('walk: ...and with the focus on the page itself (nothing focused) it is the same', () => p.evaluate(() => ({ esc: window.__modalEsc, modal: !!document.querySelector('.demo-modal'), card: !!document.querySelector('.wa-tour-card') })), (v) => v.esc === 2 && !v.modal && v.card);

  // a link to a place on this page scrolls the page away from the lit section: a moment later the lit section is brought back, with the card
  await showMid('#t-down');
  await p.evaluate(() => { window.__y0 = window.scrollY; window.__dev = 0; window.addEventListener('scroll', () => { window.__dev = Math.max(window.__dev, Math.abs(window.scrollY - window.__y0)); }); });
  await p.click('#t-down');
  await okSoon('walk: after a link to #visit in the lit section the lit section is on the screen again (the page had gone away, then came back), and the lit box is on it', async () => ({ dev: await p.evaluate(() => window.__dev), r: await rectOf(p, '#faq'), l: await look(p) }), (v) => v.dev > 400 && v.r && v.r.y < v.l.vh - 100 && v.r.b > 100 && v.l.hole && v.l.hole.y < v.l.vh && v.l.hole.b > 0 && inside(v.l.card, v.l.vw, v.l.vh), 20000);

  // a wide lit box: the card has to sit on it and keeps off its two buttons
  await press(p, 'Next');
  await atStep(p, 2, 'walk: step 2 lights the wide box');
  s = await look(p);
  const yes = await rectOf(p, '#t-yes'), no = await rectOf(p, '#t-no'), tagBox = await rectOf(p, '#t-tag'), headBox = await rectOf(p, '#t-wide h2');
  ok('walk: the card is on the wide box (there is no room beside it) and covers neither of its buttons, nor its heading, nor the small label at its corner (the four corners are all taken: the card sits between them, on plain words)', overlap(s.card, await rectOf(p, '#t-wide')) > 0 && overlap(s.card, yes) === 0 && overlap(s.card, no) === 0 && overlap(s.card, tagBox) === 0 && overlap(s.card, headBox) === 0 && inside(s.card, s.vw, s.vh), JSON.stringify({ card: s.card, yes, no, tag: tagBox, head: headBox }));
  await press(p, 'Back');
  await atStep(p, 1, 'walk: Back to step 1');

  // Esc: a menu of the page keeps its own Esc; a question of the lit section: one Esc brings the focus back to the card, the next one closes the tour
  await showMid('#t-menu-btn');
  await p.click('#t-menu-btn');
  ok('walk: the menu in the lit section opens (the page may use it)', (await p.evaluate(() => document.getElementById('t-menu-btn').getAttribute('aria-expanded'))) === 'true', '');
  await p.keyboard.press('Escape');
  await okSoon('walk: Esc with that menu open is the menu\'s own: it closes, and the tour stays open with the focus where it was', () => p.evaluate(() => ({ esc: window.__menuEsc, open: document.getElementById('t-menu-btn').getAttribute('aria-expanded'), card: !!document.querySelector('.wa-tour-card'), onMenu: document.activeElement && document.activeElement.id === 't-menu-btn' })), (v) => v.esc === 1 && v.open === 'false' && v.card && v.onMenu);
  await showMid('#t-sum');
  await p.focus('#t-sum');
  await p.keyboard.press('Escape');
  await okSoon('walk: Esc with the focus on a question of the lit section brings the focus back to the card (the tour stays open)', () => look(p), (x) => x && x.inCard && x.focus === 'Next');
  await p.focus('#t-sum');
  await p.keyboard.press('ArrowRight');
  await p.waitForTimeout(300);
  ok('walk: (the arrow keys belong to the page while the focus is on a question: the step did not change)', (await look(p)).n === 1, '');
  await p.keyboard.press('Escape');
  await okSoon('walk: (one Esc again: the focus is back on the card)', () => look(p), (x) => x && x.inCard);
  await p.keyboard.press('Escape');
  await okSoon('walk: ...and the next Esc, from the card, closes the tour', () => p.evaluate(() => !document.querySelector('.wa-tour')), (v) => v === true);
  ok('walk: when the tour is closed <html> has no wa-tour-open and a dialog of the page is at its own level again (z-index 200)', await (async () => { await p.evaluate(() => window.__openModal()); const r = await p.evaluate(() => ({ cls: document.documentElement.classList.contains('wa-tour-open'), z: getComputedStyle(document.querySelector('.demo-modal')).zIndex })); await p.evaluate(() => { const m = document.querySelector('.demo-modal'); if (m) m.remove(); }); return !r.cls && r.z === '200'; })(), '');
  await p.context().close();

  /* ================================================================ 8b. the Store's pop-up (a stand-in built like js/shop-pop.js) and any other dialog that says role="dialog" aria-modal="true" */
  // The Store's pop-up is a fixed overlay (div.shop-pop: z-index 300, a dim of its own, shut = invisible) with a box (div.shop-pop-box, role="dialog" aria-modal="true"). While it is open the real one
  // shuts every other part of the page: aria-hidden and inert on each child of <body>, the tour's own box too. The stand-in does the same, so this is the engine against that behaviour.
  // (tests/tour-store.test.mjs does it with the real pop-up and the real Store steps, when js/shop-pop.js is in this repo.)
  const STEPS_POP = `
(window.WA_TOUR_STEPS = window.WA_TOUR_STEPS || []).push(
  { id: 'q1', order: 101, chapter: 1, page: 'index', target: '#t-card', title: 'A box that opens a pop-up', text: 'Press the box.' },
  { id: 'q2', order: 102, chapter: 1, page: 'index', target: '#faq', title: 'Another step', text: 'The next one.' },
  { id: 'q3', order: 103, chapter: 1, page: 'index', target: null, title: 'The end', text: 'End.' }
);
window.WA_TOUR_CHAPTERS = [{ n: 1, title: 'Pop-up' }];
`;
  for (const [vw, vh, what] of [[1440, 900, 'a computer'], [1100, 800, 'a small computer'], [390, 844, 'a phone']]) {
    const tag = 'pop-up (' + what + '): ';
    p = await open(browser, base, 'index.html', errs, { query: 'tour', viewport: { width: vw, height: vh }, routes: serve({ a: STEPS_POP }) });
    await p.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      const lit = document.createElement('div');
      lit.id = 't-card'; lit.style.cssText = 'position:fixed;left:40px;top:120px;width:220px;z-index:60;background:#fff;padding:10px;border:2px solid #000';
      lit.innerHTML = '<button type="button" id="t-open">Open the pop-up</button>';
      document.body.appendChild(lit);
      const st = document.createElement('style');   // the look of the Store's pop-up that matters here (css/shop-pop.css)
      st.textContent = '.shop-pop{position:fixed;top:0;right:0;bottom:0;left:0;z-index:300;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(58,36,22,.62);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .16s ease,visibility 0s linear .16s}'
        + '.shop-pop.is-open{opacity:1;visibility:visible;pointer-events:auto;transition-delay:0s}'
        + '.shop-pop-box{position:relative;box-sizing:border-box;width:min(92vw,34rem);height:380px;max-height:85vh;overflow-y:auto;background:#fffdf6;color:#3a2416;border:3px solid #3a2416;border-radius:26px;padding:20px}'
        + 'html.shop-pop-lock{overflow:hidden}';
      document.head.appendChild(st);
      const pop = document.createElement('div'), box = document.createElement('div');
      pop.className = 'shop-pop'; box.className = 'shop-pop-box';
      box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'A pop-up'); box.tabIndex = -1;
      box.innerHTML = '<h2>A pop-up</h2><button type="button" id="t-pop-x">Close</button> <button type="button" id="t-pop-ok">OK</button>';
      pop.appendChild(box); document.body.appendChild(pop);
      let saved = [];
      const state = { clicks: 0, esc: 0 };
      const keys = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); state.esc++; shut(); } };
      const strayed = (e) => { if (!box.contains(e.target)) document.getElementById('t-pop-x').focus({ preventScroll: true }); };   // the real one pulls the focus back into the box
      const lock = () => {   // what js/shop-pop.js does to the page behind it
        saved = [];
        Array.from(document.body.children).forEach((el) => { if (el === pop || /^(?:SCRIPT|STYLE|LINK|TEMPLATE|NOSCRIPT)$/.test(el.tagName)) return; saved.push([el, el.getAttribute('aria-hidden'), el.hasAttribute('inert')]); el.setAttribute('aria-hidden', 'true'); el.setAttribute('inert', ''); });
        document.documentElement.classList.add('shop-pop-lock');
      };
      const unlock = () => {
        saved.forEach((x) => { if (x[1] === null) x[0].removeAttribute('aria-hidden'); else x[0].setAttribute('aria-hidden', x[1]); if (!x[2]) x[0].removeAttribute('inert'); });
        saved = []; document.documentElement.classList.remove('shop-pop-lock');
      };
      const open = () => { if (pop.classList.contains('is-open')) return; lock(); void pop.offsetWidth; pop.classList.add('is-open'); document.addEventListener('keydown', keys, true); document.addEventListener('focusin', strayed); document.getElementById('t-pop-x').focus({ preventScroll: true }); };
      const shut = () => { pop.classList.remove('is-open'); document.removeEventListener('keydown', keys, true); document.removeEventListener('focusin', strayed); unlock(); };
      document.getElementById('t-open').addEventListener('click', open);
      document.getElementById('t-pop-x').addEventListener('click', shut);
      document.getElementById('t-pop-ok').addEventListener('click', () => { state.clicks++; });
      window.__pop = { open, shut, state, isOpen: () => pop.classList.contains('is-open') };
    });
    await p.click('.wa-tour-pill');
    await okSoon(tag + 'the welcome card opens', () => look(p), (x) => x && x.name === 'Your website tour' && !x.busy);
    await press(p, 'Start the tour');
    await atStep(p, 1, tag + 'step 1 lights the box that opens the pop-up');
    const where = () => p.evaluate(() => {   // what the owner has on the screen while the pop-up is open
      const pop = document.querySelector('.shop-pop'), box = pop.querySelector('.shop-pop-box'), okb = document.getElementById('t-pop-ok'), r = okb.getBoundingClientRect(), xb = document.getElementById('t-pop-x'), xr = xb.getBoundingClientRect(), tour = document.getElementById('wa-tour');
      const cs = getComputedStyle(pop), card = document.querySelector('.wa-tour-card'), nx = [...card.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Next'), nr = nx.getBoundingClientRect();
      const hit = (x, y) => document.elementFromPoint(x, y), c = card.getBoundingClientRect(), d = box.getBoundingClientRect();
      const area = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return { z: cs.zIndex, bg: cs.backgroundColor, pe: cs.pointerEvents, boxPe: getComputedStyle(box).pointerEvents, okOnTop: hit(r.left + r.width / 2, r.top + r.height / 2) === okb, xOnTop: hit(xr.left + xr.width / 2, xr.top + xr.height / 2) === xb, nextOnTop: hit(nr.left + nr.width / 2, nr.top + nr.height / 2) === nx,
        inert: tour.hasAttribute('inert'), ariaHidden: tour.getAttribute('aria-hidden'), cardOverBox: Math.round(100 * area(c, d) / (d.width * d.height)), cardOverOk: area(c, r), box: [d.left, d.top, d.width, d.height].map(Math.round) };
    });
    const hole = await rectOf(p, '#t-card');
    await p.mouse.click(hole.x + 20, hole.y + 20);   // the lit box: the click reaches the page's own button
    await okSoon(tag + 'a click on the lit box opens the pop-up (the page opened it: the tour let the click through)', () => p.evaluate(() => window.__pop.isOpen()), (v) => v === true);
    await p.waitForTimeout(500);   // the pop-up fades in and the card moves off it
    let w = await where();
    ok(tag + 'the pop-up is above the dimmer (z-index 9100), its own dim does not dim or block (transparent, no pointer events), its box takes clicks, and its button is the thing at its place', w.z === '9100' && w.bg === 'rgba(0, 0, 0, 0)' && w.pe === 'none' && w.boxPe === 'auto' && w.okOnTop && w.xOnTop, JSON.stringify(w));
    ok(tag + 'the page shut the tour\'s own box with the rest (inert, aria-hidden) and the tour gives it back: the card is usable, and Next is the thing at its place', !w.inert && w.ariaHidden === null && w.nextOnTop, JSON.stringify({ inert: w.inert, ariaHidden: w.ariaHidden, next: w.nextOnTop }));
    if (vw >= 1300) ok(tag + 'the card sits off the pop-up\'s box (it covers its button not at all and the box by ' + w.cardOverBox + ' percent)', w.cardOverOk === 0 && w.cardOverBox <= 10, JSON.stringify({ cardOverBox: w.cardOverBox, ok: w.cardOverOk, box: w.box }));
    else if (vw >= 700) ok(tag + 'the window is too narrow to put the card beside the pop-up\'s box (it covers ' + w.cardOverBox + ' percent of it), but the card keeps off its buttons', w.cardOverOk === 0 && w.okOnTop && w.xOnTop, JSON.stringify({ cardOverBox: w.cardOverBox, ok: w.cardOverOk, box: w.box }));
    await p.click('#t-pop-ok');
    ok(tag + 'a real click on the pop-up\'s button reaches it', (await p.evaluate(() => window.__pop.state.clicks)) === 1, '');
    await press(p, 'Next');
    await atStep(p, 2, tag + 'Next works while the pop-up is open (the card is not under it and not inert)');
    await press(p, 'Back');
    await atStep(p, 1, tag + '...and Back');
    ok(tag + '(the pop-up is still open: the tour does not shut the dialogs of the page; the step that opened one shuts it in its after())', await p.evaluate(() => window.__pop.isOpen()), '');
    await p.focus('#t-pop-x');
    await p.keyboard.press('Escape');
    await okSoon(tag + 'Esc with the focus in the pop-up closes the pop-up and not the tour', () => p.evaluate(() => ({ open: window.__pop.isOpen(), esc: window.__pop.state.esc, card: !!document.querySelector('.wa-tour-card') })), (v) => !v.open && v.esc === 1 && v.card);
    s = await look(p);
    ok(tag + '...the tour is still on step 1', s.n === 1, String(s.n));
    await p.evaluate(() => { window.__pop.open(); document.activeElement.blur(); });
    await p.waitForTimeout(300);
    await p.keyboard.press('Escape');
    await okSoon(tag + '...and with nothing focused it is the same', () => p.evaluate(() => ({ open: window.__pop.isOpen(), esc: window.__pop.state.esc, card: !!document.querySelector('.wa-tour-card') })), (v) => !v.open && v.esc === 2 && v.card);
    await p.evaluate(() => window.__pop.open());
    await p.waitForTimeout(400);
    await p.mouse.click(vw - 20, 20);   // the dim part of the overlay, away from the box and the card
    await p.waitForTimeout(200);
    ok(tag + 'a click on the dim part of the pop-up does nothing during the tour (only its box takes clicks; the tour\'s click stopper has the rest)', await p.evaluate(() => window.__pop.isOpen()), '');
    await press(p, 'Close');   // the round Close button of the tour's card, with the pop-up still open
    await okSoon(tag + 'the tour closes with the pop-up open', () => p.evaluate(() => !document.querySelector('.wa-tour')), (v) => v === true);
    const after = await p.evaluate(() => ({ z: getComputedStyle(document.querySelector('.shop-pop')).zIndex, cls: document.documentElement.classList.contains('wa-tour-open') }));
    ok(tag + 'after the tour the pop-up is at its own level again (z-index 300) and <html> has no wa-tour-open', after.z === '300' && !after.cls, JSON.stringify(after));
    await p.evaluate(() => window.__pop.shut());

    /* any other overlay that holds a box with role="dialog" aria-modal="true": lifted above the dimmer by the tour, let go when it is gone, its Esc left alone */
    await p.click('.wa-tour-pill');
    await okSoon(tag + 'any dialog: the welcome card opens again', () => look(p), (x) => x && x.name === 'Your website tour' && !x.busy);
    await press(p, 'Start the tour');
    await atStep(p, 1, tag + 'any dialog: step 1 shows');
    await p.evaluate(() => {
      const g = document.createElement('div');
      g.id = 't-gen'; g.style.cssText = 'position:fixed;top:0;right:0;bottom:0;left:0;z-index:250;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.4)';
      g.innerHTML = '<div id="t-gen-box" role="dialog" aria-modal="true" tabindex="-1" style="box-sizing:border-box;width:420px;max-width:92vw;height:300px;background:#fff;border:3px solid #000;padding:16px"><button type="button" id="t-gen-ok">OK</button></div>';
      document.body.appendChild(g);
      window.__gen = { clicks: 0, esc: 0 };
      g.querySelector('#t-gen-ok').addEventListener('click', () => { window.__gen.clicks++; });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && g.style.display !== 'none') { window.__gen.esc++; g.style.display = 'none'; } }, true);   // the page's own Esc
    });
    const genNow = () => p.evaluate(() => {
      const g = document.getElementById('t-gen'), okb = document.getElementById('t-gen-ok'), r = okb.getBoundingClientRect(), card = document.querySelector('.wa-tour-card'), c = card.getBoundingClientRect(), d = document.getElementById('t-gen-box').getBoundingClientRect();
      const area = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return { z: getComputedStyle(g).zIndex, okOnTop: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === okb, cardOverBox: Math.round(100 * area(c, d) / (d.width * d.height)), lifted: document.querySelectorAll('.wa-tour-lift').length };
    });
    await okSoon(tag + 'any dialog: its overlay is lifted above the dimmer (z-index 9100) within a moment, and its button is the thing at its place', genNow, (v) => v.z === '9100' && v.okOnTop && v.lifted === 1);
    await p.waitForTimeout(400);
    w = await genNow();
    if (vw >= 1300) ok(tag + 'any dialog: the card sits off its box (' + w.cardOverBox + ' percent of the box)', w.cardOverBox <= 10, JSON.stringify(w));
    await p.click('#t-gen-ok');
    ok(tag + 'any dialog: a real click on its button reaches it', (await p.evaluate(() => window.__gen.clicks)) === 1, '');
    await p.focus('#t-gen-ok');
    await p.keyboard.press('Escape');
    await okSoon(tag + 'any dialog: Esc is the dialog\'s own (it closes) and the tour stays open', () => p.evaluate(() => ({ esc: window.__gen.esc, card: !!document.querySelector('.wa-tour-card') })), (v) => v.esc === 1 && v.card);
    await okSoon(tag + 'any dialog: when the dialog is gone its overlay is let go (no wa-tour-lift left on the page)', () => p.evaluate(() => document.querySelectorAll('.wa-tour-lift').length), (n) => n === 0);
    await p.evaluate(() => { document.getElementById('t-gen').style.display = 'flex'; window.__gen.esc = 0; });
    await okSoon(tag + 'any dialog: shown again, it is lifted again', genNow, (v) => v.z === '9100' && v.lifted === 1);
    await press(p, 'Close');
    await okSoon(tag + 'any dialog: the tour closes with the dialog open, and the lift is taken away', () => p.evaluate(() => ({ gone: !document.querySelector('.wa-tour'), lifted: document.querySelectorAll('.wa-tour-lift').length, z: getComputedStyle(document.getElementById('t-gen')).zIndex })), (v) => v.gone && v.lifted === 0 && v.z === '250');
    await p.context().close();
  }

  // the lit part is brought under the sticky bar of the pretend-account pages too, not only under the top bar
  const STEPS_BAR = `(window.WA_TOUR_STEPS = window.WA_TOUR_STEPS || []).push({ id: 'b1', order: 101, chapter: 1, page: 'index', target: '#faq', title: 'Under both bars', text: 'The section is brought under the top bar and the demo bar.' });`;
  p = await open(browser, base, 'index.html', errs, { query: 'tour', routes: serve({ a: STEPS_BAR }) });
  await p.evaluate(() => {
    const h = document.querySelector('.site-header'), top = Math.round(h.getBoundingClientRect().height) + 3;
    const bar = document.createElement('div'); bar.className = 'demo-bar'; bar.id = 't-bar';
    bar.style.cssText = 'position:sticky;top:' + top + 'px;z-index:40;height:70px;background:#ffc928;border-bottom:3px solid #3a2416';
    bar.textContent = 'A demo bar';
    h.insertAdjacentElement('afterend', bar);
  });
  await p.click('.wa-tour-pill');
  await okSoon('walk (demo bar): the welcome card opens', () => look(p), (x) => x && x.name === 'Your website tour' && !x.busy);
  await press(p, 'Start the tour');
  await atStep(p, 1, 'walk (demo bar): step 1 lights the FAQ section');
  const secT = await rectOf(p, '#faq'), barT = await rectOf(p, '#t-bar'), headT = await p.evaluate(() => document.querySelector('.site-header').getBoundingClientRect().bottom);
  ok('walk (demo bar): the lit section starts below the top bar AND the sticky demo bar under it, so nothing of it is hidden behind them', barT.y >= headT - 1 && secT.y >= barT.b - 1, JSON.stringify({ section: secT.y, bar: [barT.y, barT.b], head: headT }));
  await p.context().close();

  /* ================================================================ 9. a wide, short part in a laptop window (the Store's row of group buttons: 1,300 px wide and 96 px high, on a screen 768 px high) */
  // There is no room beside it for the card (380 px wide). When the part is brought to the middle of the window there is no room above or below it either: the card is about 390 px high and
  // wants 26 px of air, and the window leaves about 280 px on each side of a 96 px part. So the part is brought to the top of the free room (the card goes under it): the card is whole in
  // the window, not cut off at the top and not on the part. (Found by looking at the real Store at 1366x768, 1280x800, 1100x800 and 992x800.)
  const WORDS55 = Array.from({ length: 55 }, (_, i) => 'word' + i).join(' ');
  const STRIP_STEP = (title, text) => `(window.WA_TOUR_STEPS = window.WA_TOUR_STEPS || []).push({ id: 's1', order: 101, chapter: 1, page: 'index', target: '#t-strip', title: '${title}', text: '${text}' });`;
  const STORE_WORDS = 'Everything for sale at the farm and The GreenHouse is listed here, in groups. Each product has a name, a price and a small drawing. These buttons jump straight to a group. Visitors can check a price before they ask.';   // the words of the Store's own first step: a card of about 390 px
  // two cards: the one above, and one with a long text (about 570 px: at 1366x768 it does not fit under the strip even when the strip is at the top of the free room, so the strip goes to the bottom and the card above it)
  const CARDS = [['a short text', STRIP_STEP('The Store, all in one place', STORE_WORDS)], ['a long text', STRIP_STEP('A wide strip of buttons, all in one place', WORDS55)]];
  for (const [w, h, what, STEPS_STRIP] of [[1366, 768], [1280, 800], [992, 800]].flatMap(([a, b]) => CARDS.map(([n, st]) => [a, b, n, st]))) {
    const tag = `wide strip, ${w}x${h}, ${what}: `;
    p = await open(browser, base, 'index.html', errs, { query: 'tour', viewport: { width: w, height: h }, routes: serve({ a: STEPS_STRIP }) });
    await p.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      const sec = document.querySelector('#faq'), d = document.createElement('div');
      d.id = 't-strip'; d.style.cssText = 'box-sizing:border-box;width:calc(100% - 64px);max-width:1300px;margin:60px auto;height:96px;padding:8px;display:flex;flex-wrap:wrap;gap:8px;background:#fffdf6;border:2px solid #3a2416';
      for (let i = 1; i <= 12; i++) { const a = document.createElement('a'); a.href = '#faq'; a.textContent = 'Group ' + i; a.style.cssText = 'padding:6px 12px;border:1px solid #3a2416;border-radius:20px;background:#fff'; d.appendChild(a); }
      sec.parentNode.insertBefore(d, sec);
    });
    await p.click('.wa-tour-pill');
    await okSoon(tag + 'the welcome card opens', () => look(p), (x) => x && x.name === 'Your website tour' && !x.busy);
    await press(p, 'Start the tour');
    await atStep(p, 1, tag + 'step 1 lights the strip');
    s = await look(p);
    const strip = await rectOf(p, '#t-strip'), headB = await p.evaluate(() => document.querySelector('.site-header').getBoundingClientRect().bottom);
    ok(tag + 'the card is tall (' + Math.round(s.card.h) + ' px): with the strip in the middle of the window it would fit neither above nor below it', s.card.h + 26 > (s.vh - headB - 28 - strip.h) / 2, JSON.stringify({ card: s.card, strip, headB, vh: s.vh }));
    ok(tag + 'the strip is whole in the window, under the top bar, and lit', strip.y >= headB - 1 && strip.b <= s.vh && lit(s.hole, strip), JSON.stringify({ strip, hole: s.hole, headB, vh: s.vh }));
    ok(tag + 'the card is whole in the window and not on the strip', inside(s.card, s.vw, s.vh) && overlap(s.card, strip) === 0, JSON.stringify({ card: s.card, strip }));
    await p.context().close();
  }

  /* ================================================================ 9b. a tall lit part starts below the top bar and the vine that hangs under it (the strawberry vine of the real pages) */
  const STEPS_VINE = `(window.WA_TOUR_STEPS = window.WA_TOUR_STEPS || []).push({ id: 'v1', order: 101, chapter: 1, page: 'index', target: '#faq', title: 'A tall section', text: 'Its top is below the top bar and below the vine.' });`;
  p = await open(browser, base, 'index.html', errs, { query: 'tour', routes: serve({ a: STEPS_VINE }) });
  await p.click('.wa-tour-pill');
  await okSoon('vine: the welcome card opens', () => look(p), (x) => x && x.name === 'Your website tour' && !x.busy);
  await press(p, 'Start the tour');
  await atStep(p, 1, 'vine: step 1 lights the FAQ section');
  s = await look(p);
  const vineEnd = await p.evaluate(() => { const v = document.querySelector('.site-header .vine'); return v ? v.getBoundingClientRect().bottom : null; });
  ok('vine: the lit box (the section with 8 px round it) starts below the vine that hangs under the top bar, so none of it is hidden behind the leaves', vineEnd !== null && !!s.hole && s.hole.y >= vineEnd - 1, JSON.stringify({ vineEnd, hole: s.hole }));
  await p.context().close();

  /* ================================================================ 9c. the parts a step names with "also" are brought into the window together with the target, when they fit there together */
  // A target and a part 600 px below it, in the flow of the page far from the top: with the target alone in the middle of the window the other one would be below the window.
  const STEPS_FLOW = `(window.WA_TOUR_STEPS = window.WA_TOUR_STEPS || []).push({ id: 'f1', order: 101, chapter: 1, page: 'index', target: '#t-fa', also: '#t-fb', title: 'Two parts', text: 'Both are in the window.' });`;
  p = await open(browser, base, 'index.html', errs, { query: 'tour', routes: serve({ a: STEPS_FLOW }) });
  await p.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    const wrap = document.createElement('div');
    wrap.id = 't-flow'; wrap.style.cssText = 'margin:900px 0 900px;padding:0 24px';
    wrap.innerHTML = '<div id="t-fa" style="height:100px;background:#fffdf6;border:2px solid #3a2416">The target</div><div style="height:500px"></div><div id="t-fb" style="height:100px;background:#e8f4ff;border:2px solid #3a2416">Named with also</div>';
    const sec = document.querySelector('#faq');
    sec.parentNode.insertBefore(wrap, sec);
  });
  await p.click('.wa-tour-pill');
  await okSoon('also in the flow: the welcome card opens', () => look(p), (x) => x && x.name === 'Your website tour' && !x.busy);
  await press(p, 'Start the tour');
  await atStep(p, 1, 'also in the flow: step 1 lights the target and the other part');
  const fa = await rectOf(p, '#t-fa'), fb = await rectOf(p, '#t-fb'), fHead = await p.evaluate(() => document.querySelector('.site-header').getBoundingClientRect().bottom);
  s = await look(p);
  ok('also in the flow: the target and the part named with also are both whole in the window, under the top bar (the window is ' + s.vh + ' px high, the two are 700 px from top to bottom)', fa.y >= fHead - 1 && fb.b <= s.vh && fa.b <= s.vh && fb.y >= fHead - 1, JSON.stringify({ fa, fb, head: fHead, vh: s.vh }));
  await p.context().close();

  /* ================================================================ 10. what is lit besides the target: a list a lit button opens, a part a step names with "also" */
  // The lit part can be used and nothing else can. A button of it that opens a list (aria-controls, aria-expanded) lights the list too, and the list can be used; so can the parts a step names
  // with "also" (the basket game's picture). Everything else stays locked, in every step. (Found by an independent walk of the real tour: ten steps left the whole page free.)
  const STEPS_LIT = `
(window.WA_TOUR_STEPS = window.WA_TOUR_STEPS || []).push(
  { id: 'm1', order: 101, chapter: 1, page: 'index', target: '#t-bar', title: 'A bar with a list', text: 'Press Menu. Its list is lit too.' },
  { id: 'm2', order: 102, chapter: 1, page: 'index', target: '#t-picker', also: '#t-play', title: 'A game', text: 'The picture is the playground.' },
  { id: 'm3', order: 103, chapter: 1, page: 'index', target: '#t-bellbox', title: 'A bell', text: 'The bell opens a list that is not inside it.' },
  { id: 'm4', order: 104, chapter: 1, page: 'index', target: '#t-bar', allowClicks: false, title: 'Nothing', text: 'Nothing can be pressed here.' }
);
window.WA_TOUR_CHAPTERS = [{ n: 1, title: 'Lit' }];
`;
  p = await open(browser, base, 'index.html', errs, { query: 'tour', routes: serve({ a: STEPS_LIT }) });
  await p.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    window.__hits = { other: 0, fruit: 0, away: 0, notice: 0 };
    const add = (html) => { const d = document.createElement('div'); d.innerHTML = html; document.body.appendChild(d.firstElementChild); };
    const toggle = (btn) => btn.addEventListener('click', () => { const o = btn.getAttribute('aria-expanded') !== 'true'; btn.setAttribute('aria-expanded', String(o)); document.getElementById(btn.getAttribute('aria-controls')).hidden = !o; });
    // a bar with a Menu button; its list hangs below the bar (the way the site's menu bar does it)
    add('<div id="t-bar" style="position:fixed;left:60px;top:100px;width:640px;height:56px;z-index:55;background:#fffdf6;border:2px solid #3a2416"><button id="t-menu" type="button" aria-expanded="false" aria-controls="t-list" style="margin:8px">Menu</button>'
      + '<ul id="t-list" hidden style="position:absolute;left:8px;top:60px;width:240px;margin:0;padding:6px;list-style:none;background:#fff;border:2px solid #3a2416"><li><a id="t-l1" href="#visit">Hours</a></li><li><a id="t-l2" href="https://example.com/away">Away</a></li></ul></div>');
    // a part of the page that is not lit: a button that counts the presses it gets
    add('<button id="t-other" type="button" style="position:fixed;left:20px;top:780px;width:160px;height:50px;z-index:55;background:#fff;border:0;margin:0">Other</button>');
    // the game: a picker, and a picture that is its playground (named with "also"); a button further away that is neither
    add('<div id="t-picker" style="position:fixed;left:60px;top:560px;width:240px;height:70px;z-index:55;background:#fff">Pick</div>');
    add('<div id="t-play" style="position:fixed;left:400px;top:250px;width:520px;height:380px;z-index:55;background:#e8f4ff"><button id="t-fruit" type="button" style="position:absolute;left:200px;top:150px;width:100px;height:50px">Fruit</button></div>');
    add('<button id="t-away" type="button" style="position:fixed;left:1000px;top:700px;width:120px;height:44px;z-index:55;background:#fff">Away</button>');
    // a bell: its list is NOT inside it
    add('<div id="t-bellbox" style="position:fixed;left:1100px;top:100px;width:70px;height:60px;z-index:55;background:#fffdf6;border:2px solid #3a2416"><button id="t-bell" type="button" aria-expanded="false" aria-controls="t-panel">Bell</button></div>');
    add('<div id="t-panel" hidden style="position:fixed;left:900px;top:170px;width:300px;height:140px;z-index:55;background:#fff;border:2px solid #000"><button id="t-p1" type="button">Notice</button></div>');
    toggle(document.getElementById('t-menu')); toggle(document.getElementById('t-bell'));
    [['t-other', 'other'], ['t-fruit', 'fruit'], ['t-away', 'away'], ['t-p1', 'notice']].forEach(([id, k]) => document.getElementById(id).addEventListener('click', () => { window.__hits[k]++; }));
  });
  const hits = () => p.evaluate(() => JSON.stringify(window.__hits));
  const litNow = () => p.evaluate(() => {
    const box = document.querySelector('.wa-tour'), rect = (e) => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, r: b.right, b: b.bottom }; };
    return { extra: box.classList.contains('has-extra'), rings: [...document.querySelectorAll('.wa-tour-ring')].map(rect), dimLayers: document.querySelectorAll('.wa-tour-dim, .wa-tour-dim .wa-tour-layer').length, stopLayers: document.querySelectorAll('.wa-tour-shield, .wa-tour-shield .wa-tour-layer').length };
  });
  const topAt = (x, y) => p.evaluate(([a, b]) => { const e = document.elementFromPoint(a, b); return { id: e ? e.id : '', stopped: !!(e && e.closest('.wa-tour-shield')) }; }, [x, y]);
  const mid = (r) => [r.x + r.w / 2, r.y + r.h / 2];
  const clickOn = async (sel) => { const r = await rectOf(p, sel); await p.mouse.click(...mid(r)); };
  await p.click('.wa-tour-pill');
  await okSoon('lit parts: the welcome card opens', () => look(p), (x) => x && x.name === 'Your website tour' && !x.busy);
  await press(p, 'Start the tour');
  await atStep(p, 1, 'lit parts: step 1 lights the bar');
  let ls = await litNow();
  ok('lit parts: before the menu is pressed only the bar is lit (one window in the dimmer, no second yellow edge)', !ls.extra && ls.rings.length === 0 && ls.stopLayers === 1, JSON.stringify(ls));
  await clickOn('#t-menu');
  await okSoon('lit parts: the Menu button opens its list, and the list is lit with the bar: a yellow edge of its own, 8 px round it, and a dimmer made of two layers', async () => ({ ls: await litNow(), list: await rectOf(p, '#t-list') }), (v) => v.ls.extra && v.ls.rings.length === 1 && lit(v.ls.rings[0], v.list) && v.ls.dimLayers === 2 && v.ls.stopLayers === 2);
  await rest(p);
  const list = await rectOf(p, '#t-list');
  s = await look(p);
  ok('lit parts: the card keeps off the opened list and off the bar', overlap(s.card, list) === 0 && overlap(s.card, await rectOf(p, '#t-bar')) === 0 && inside(s.card, s.vw, s.vh), JSON.stringify({ card: s.card, list }));
  const white = await pixel(p, list.r - 6, list.b - 6), page = await pixel(p, (await rectOf(p, '#t-other')).x + 8, (await rectOf(p, '#t-other')).y + 8);
  ok('lit parts: the opened list is not dimmed (its white is still white) and the white button outside is (it is dark now)', white[0] >= 250 && white[1] >= 250 && white[2] >= 250 && page[0] < 200 && page[1] < 200 && page[2] < 200, JSON.stringify({ white, page }));
  const onLink = await topAt(...mid(await rectOf(p, '#t-l1'))), onOther = await topAt(...mid(await rectOf(p, '#t-other')));
  ok('lit parts: a press on a link of the list reaches the link; a press on the button outside meets the click stopper', onLink.id === 't-l1' && !onLink.stopped && onOther.stopped, JSON.stringify({ onLink, onOther }));
  await clickOn('#t-other');
  ok('lit parts: a real click on the button outside does nothing (the page did not see it)', (await hits()) === '{"other":0,"fruit":0,"away":0,"notice":0}', await hits());
  await p.focus('#t-menu');
  await p.keyboard.press('Tab');
  ok('lit parts: Tab goes from the Menu button into the opened list', (await p.evaluate(() => document.activeElement && document.activeElement.id)) === 't-l1', await p.evaluate(() => document.activeElement && document.activeElement.id));
  await clickOn('#t-l1');
  await okSoon('lit parts: a real click on a link in the opened list works (the page goes to the place the link names)', () => p.evaluate(() => location.hash), (v) => v === '#visit');
  const awayUrl = await p.evaluate(() => location.href);
  await clickOn('#t-l2');
  await okSoon('lit parts: a link in the list that leaves the page does nothing but say so', () => p.evaluate(() => ({ u: location.href, note: (document.querySelector('.wa-tour-flash') || {}).textContent || '' })), (v) => v.u === awayUrl && /switched off/.test(v.note));
  await clickOn('#t-menu');
  await okSoon('lit parts: the Menu button shuts the list: only the bar is lit again', litNow, (v) => !v.extra && v.rings.length === 0 && v.stopLayers === 1 && v.dimLayers === 1);

  await press(p, 'Next');
  await atStep(p, 2, 'lit parts: step 2 (a game: the picker, and a picture named with also) shows');
  ls = await litNow();
  const play = await rectOf(p, '#t-play');
  ok('lit parts: the picture named with "also" is lit with the picker from the start (a yellow edge round it)', ls.extra && ls.rings.length === 1 && lit(ls.rings[0], play), JSON.stringify(ls));
  await clickOn('#t-fruit');
  await clickOn('#t-away');
  await clickOn('#t-other');
  ok('lit parts: a click in the picture counts (the page sees it); a click on the button next to it and one on the other button do not', (await hits()) === '{"other":0,"fruit":1,"away":0,"notice":0}', await hits());

  await press(p, 'Next');
  await atStep(p, 3, 'lit parts: step 3 (a bell whose list is not inside it) shows');
  ls = await litNow();
  ok('lit parts: before the bell is pressed only the bell is lit', !ls.extra && ls.rings.length === 0, JSON.stringify(ls));
  await clickOn('#t-bell');
  await okSoon('lit parts: the bell opens its list, which is not inside the bell, and the list is lit', async () => ({ ls: await litNow(), panel: await rectOf(p, '#t-panel') }), (v) => v.ls.extra && v.ls.rings.length === 1 && lit(v.ls.rings[0], v.panel));
  await rest(p);
  await clickOn('#t-p1');
  await clickOn('#t-other');
  ok('lit parts: a click in the bell\'s list counts; a click on the button outside does not', (await hits()) === '{"other":0,"fruit":1,"away":0,"notice":1}', await hits());

  await press(p, 'Next');
  await atStep(p, 4, 'lit parts: step 4 (allowClicks: false, a bar) shows');
  await p.evaluate(() => { const b = document.getElementById('t-menu'); b.setAttribute('aria-expanded', 'true'); document.getElementById('t-list').hidden = false; });
  await p.waitForTimeout(400);
  ls = await litNow();
  const stuck = await topAt(...mid(await rectOf(p, '#t-menu')));
  ok('lit parts: a step that says allowClicks: false lights nothing more, and nothing in it can be pressed (not even the lit button)', !ls.extra && ls.rings.length === 0 && stuck.stopped, JSON.stringify({ ls, stuck }));
  await p.context().close();
});
