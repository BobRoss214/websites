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
 *   - calm mode and reduced motion (nothing slides), a phone (the card is a sheet at the bottom; the target is above it), a long text scrolls inside the card */
import { run, open, ok, okSoon, until, info, settled, ms, axeSource, ROOT } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';

const CSS = fs.readFileSync(path.join(ROOT, 'css/tour.css'), 'utf8');

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
    buttons: [...c.querySelectorAll('button')].map((b) => (b.getAttribute('aria-label') || b.textContent).trim() + (b.disabled ? ' (off)' : '')), busy: c.classList.contains('is-busy'),
    card: rect(c), hole: root.classList.contains('no-hole') ? null : rect(document.querySelector('.wa-tour-hole')), free: root.classList.contains('is-free'), still: root.classList.contains('is-still'),
    sheet: c.classList.contains('is-sheet'), focus: document.activeElement ? (document.activeElement.getAttribute('aria-label') || document.activeElement.textContent || '').trim() : '', inCard: c.contains(document.activeElement),
    live: live ? live.textContent : '', scrollY: window.scrollY, vw: document.documentElement.clientWidth, vh: window.innerHeight, bodyScroll: (c.querySelector('.wa-tour-body') || {}).scrollHeight > (c.querySelector('.wa-tour-body') || {}).clientHeight + 1,
    pillShown: !!document.querySelector('.wa-tour-pill') && !document.querySelector('.wa-tour-pill').hidden, dialog: c.getAttribute('role'), name: (document.getElementById(c.getAttribute('aria-labelledby')) || {}).textContent || '',
  };
});
const rectOf = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, r: b.right, b: b.bottom }; }, sel);
const overlap = (a, b) => (a && b ? Math.max(0, Math.min(a.r, b.r) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.y, b.y)) : 0);
const near = (a, b, tol = 3) => Math.abs(a - b) <= tol;
const lit = (hole, t, pad = 8) => !!(hole && t && near(hole.x, t.x - pad) && near(hole.y, t.y - pad) && near(hole.w, t.w + 2 * pad) && near(hole.h, t.h + 2 * pad));
const inside = (c, vw, vh) => !!(c && c.x >= 0 && c.y >= 0 && c.r <= vw + 0.5 && c.b <= vh + 0.5);
const btn = (p, name) => p.getByRole('button', { name, exact: true });
const press = async (p, name) => { await btn(p, name).click(); };
const atStep = (p, n, name) => okSoon(name || `the card shows step ${n}`, () => look(p), (s) => s && s.n === n && !s.busy);
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

  await press(p, 'Take a tour');
  await okSoon('the button opens a welcome card: a dialog with a name, the words of the plan, and its three buttons', () => look(p), (s) => s && s.dialog === 'dialog' && s.name === 'Your website tour' && /^This is a tour of your new website\. It takes about \d+ minutes\. You can stop any time/.test(s.text) && /Continue where I stopped/.test(s.text) && /Contents lets you jump to any part/.test(s.text));
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
  let inCard = true;
  for (let i = 0; i < 12; i++) { await p.keyboard.press('Tab'); inCard = inCard && (await look(p)).inCard; }
  for (let i = 0; i < 12; i++) { await p.keyboard.press('Shift+Tab'); inCard = inCard && (await look(p)).inCard; }
  ok('Tab and Shift+Tab go round the buttons of the card and never leave it', inCard);
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
  await okSoon('a link with data-tour-open opens the welcome card on this page, and the address does not change', () => look(p), (x) => x && x.name === 'Your website tour');
  ok('the address did not change', p.url() === before, p.url());
  ok('with one step the welcome card says "about 5 minutes" (never less)', /about 5 minutes/.test((await look(p)).text));
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
  p = await open(browser, base, 'index.html', errs, { query: 'tour', routes: async (pg) => { await pg.addInitScript(() => { window.WA_DEMO_MODE = () => true; }); await serve({ a: withAccount, b: STEPS_B })(pg); } });
  await p.click('.wa-tour-pill');
  await okSoon('demo mode on', () => look(p), (x) => x && x.name === 'Your website tour');
  await press(p, 'Start the tour');
  await atStep(p, 1);
  ok('demo mode on (window.WA_DEMO_MODE() is true): the account step is counted, 12 steps', (await look(p)).of === 12, String((await look(p)).of));
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
  s = await okSoon('phone: the welcome card is a sheet at the bottom, 8 px from the edges', () => look(p), (x) => x && x.name === 'Your website tour' && x.sheet);
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
});
