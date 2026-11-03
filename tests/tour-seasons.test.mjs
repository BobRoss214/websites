// order: 193
// browser: yes
// covers: js/tour.js, js/tour-steps.js, js/season.js, js/hero.js, js/live.js, index.html
/* The SEASON WALK of the tour, with the real engine (js/tour.js) and the real steps (js/tour-steps.js): the steps that have Spring, Summer, Fall and Winter buttons on their card
 * (docs/TOUR.md, "The season walk"; work-notes/NOTES-seasons.md lists what changes). tests/tour.test.mjs tests the small buttons of the engine with made-up steps and
 * tests/tour-targets.test.mjs presses every button of every step and checks the words of the cards against the lit box; this test follows what the OWNERS go through:
 *   - on two days, one in fall (3 Nov, the day of the story) and one in spring (20 Apr): the strip step shows with its four buttons, none pressed, and the page as it is today;
 *     Spring, Summer, Fall and Winter each change the whole page (the season of the page, the strip that is lit), the card says which season it shows, the words it quotes are
 *     in the lit box, and the pretended clock is never left behind (Date is the page's own again after every press)
 *   - Next puts the page back as it was (the season, every line of a season, the strip, the countdown, This week at the farm, the badges, the open tabs, the lines with a last day);
 *     Back does the same; a part in Contents does the same, also when the owner had opened another tab first; Esc does the same, also in the middle of a press
 *   - the page that was put back still works (the hero's own season buttons)
 *   - the buttons are reached with Tab and pressed with Enter; the card stays inside the window; a phone
 *   - the tour is walked from the card about the buttons on, with every season button pressed on every step that has them (WA_SEASONS_FULL=1: to the last card and Finish), and the
 *     page is exactly as it was afterwards, with nothing of the walk left in browser storage */
import { run, open, ok, okSoon, info, settled } from './lib.mjs';

const DAYS = [
  ['2026-11-03T12:00:00-05:00', 'fall', '3 Nov (fall, the day of the story)'],
  ['2027-04-20T12:00:00-04:00', 'spring', '20 Apr (spring)'],
];
const SEASONS = ['spring', 'summer', 'fall', 'winter'];
const PHONE = { width: 390, height: 844 };
const capital = (s) => s[0].toUpperCase() + s.slice(1);

/* what the owner sees on the card */
const look = (p) => p.evaluate(() => {
  const c = document.querySelector('.wa-tour-card');
  if (!c) return null;
  const k = (c.querySelector('.wa-tour-progress') || {}).textContent || '', m = /Step (\d+) of (\d+)/.exec(k);
  const r = c.getBoundingClientRect(), row = c.querySelector('.wa-tour-choices');
  return {
    n: m ? +m[1] : 0, of: m ? +m[2] : 0, busy: c.classList.contains('is-busy'), title: (c.querySelector('.wa-tour-title') || {}).textContent || '', text: (c.querySelector('.wa-tour-body') || {}).innerText || '',
    choices: [...c.querySelectorAll('.wa-tour-choice')].map((b) => b.textContent.trim() + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')).join('|'), rowBusy: row && !row.hidden ? row.getAttribute('aria-busy') : null,
    actions: [...c.querySelectorAll('.wa-tour-actions button')].map((b) => b.textContent.trim()).join('|'),
    focus: document.activeElement ? (document.activeElement.getAttribute('aria-label') || document.activeElement.textContent || '').trim() : '',
    box: { x: r.left, y: r.top, r: r.right, b: r.bottom }, vw: document.documentElement.clientWidth, vh: window.innerHeight,
  };
});
const btn = (p, name) => p.locator('.wa-tour-card').getByRole('button', { name, exact: true });   // in the card only: the page has its own Spring, Summer, Fall and Winter buttons
const press = (p, name) => btn(p, name).click();
const atTitle = (p, title, name) => okSoon(name || 'the card is "' + title + '"', () => look(p), (s) => s && !s.busy && s.title === title);
// the welcome card (the card that says "Getting the tour ready..." has the same title: the steps are not loaded until the real one shows)
const welcome = (p, name) => okSoon(name || 'the welcome card opens', () => look(p), (s) => s && s.title === 'Your website tour' && /^This is a tour of your new website/.test(s.text));

/* what the page looks like to a visitor, for comparing before and after: the season, the lines of a season, the parts that follow the clock, the lines with a last day, the open tabs, Date itself */
const SNAP = `(() => {
  // the words a visitor can see; a box that is not drawn (hidden) counts as '[hidden]': the page leaves old words inside a hidden pizza countdown, which nobody sees
  const text = (sel) => { const e = document.querySelector(sel); if (!e) return null; return e.getClientRects().length ? e.innerText.replace(/\\s+/g, ' ').replace(/\\d+/g, '#').replace(/\\b(day|hour|minute|second)s\\b/gi, '$1').trim() : '[hidden]'; };   // numbers become # and 'days' become 'day' (a countdown moves on by itself)
  return JSON.stringify({
    season: document.documentElement.getAttribute('data-season'),
    lines: Array.from(document.querySelectorAll('[data-only],[data-out-of-season]')).map((e) => (e.hasAttribute('hidden') ? 1 : 0)).join(''),
    clock: ['.announce [data-ann-season]', '.next-up', '#this-week', '.hero-live', '#fact-season', '#hero-h', '.hero-sub:not([hidden])', '[data-rel-chip]', '[data-rel-box]', '#season-tabs .now-badge:not([hidden])', '.fs-now:not([hidden])'].map(text),
    marks: [Array.from(document.querySelectorAll('.week-strip .day.today')).map((e) => e.textContent).join(), (document.querySelector('.cal') || { style: { getPropertyValue: () => '' } }).style.getPropertyValue('--today')],
    until: Array.from(document.querySelectorAll('[data-until]')).map((e) => (getComputedStyle(e).display === 'none' ? 1 : 0)).join(''),
    tab: Array.from(document.querySelectorAll('#season-tabs [aria-selected="true"]')).map((e) => e.dataset.season).join(),
    farm: Array.from(document.querySelectorAll('.fs-btn[aria-pressed="true"]')).map((e) => e.dataset.fs).join(),
    switchOn: Array.from(document.querySelectorAll('#season-switch [aria-checked="true"]')).map((e) => e.dataset.season).join(),
    cards: Array.from(document.querySelectorAll('#farm-cards > li')).filter((e) => !e.hidden).length,
    dateIsOwn: window.Date === window.__Date0,
  });
})()`;
const snap = (p) => p.evaluate(SNAP);
// which parts of two snapshots differ (an empty text means they are the same)
const differ = (a, b) => {
  const x = typeof a === 'string' ? JSON.parse(a) : a, y = typeof b === 'string' ? JSON.parse(b) : b, out = [];
  for (const k of Object.keys(x)) {
    if (Array.isArray(x[k]) && Array.isArray(y[k])) x[k].forEach((v, i) => { if (JSON.stringify(v) !== JSON.stringify(y[k][i])) out.push(k + '[' + i + ']: ' + JSON.stringify(v).slice(0, 110) + ' -> ' + JSON.stringify(y[k][i]).slice(0, 110)); });
    else if (JSON.stringify(x[k]) !== JSON.stringify(y[k])) out.push(k + ': ' + JSON.stringify(x[k]).slice(0, 110) + ' -> ' + JSON.stringify(y[k]).slice(0, 110));
  }
  return out.join(' | ');
};
const parsed = async (p) => JSON.parse(await snap(p));
const strip = (p) => p.evaluate(() => document.querySelector('.announce [data-ann-season]').textContent.trim());
const goto = (p, id) => p.evaluate((i) => window.WISE_ACRES.tour.goto(i), id);
// the page, with its own Date remembered and the "Site check" box left out: that box is only for a computer's own address (127.0.0.1 here), it shows after the first line with a
// last day has hidden itself (every day of this test is later than that) and it sits over the bottom of the window, above the tour; the preview on claude.ai never shows it
const openPage = async (browser, base, errs, opts) => {
  const p = await open(browser, base, 'index.html', errs, Object.assign({ query: 'tour' }, opts));
  await p.addStyleTag({ content: '#wa-problems{display:none!important}' });
  await p.evaluate(() => { window.__Date0 = window.Date; });
  return p;
};
const cardsShown = (p) => p.evaluate(() => [...document.querySelectorAll('#farm-cards > li')].filter((e) => !e.hidden).map((e) => e.querySelector('h3').textContent));

await run('tour-seasons', async ({ browser, base, errs }) => {
  for (const [time, real, what] of DAYS) {
    const tag = what + ': ';
    const p = await openPage(browser, base, errs, { time });
    ok(tag + 'the page is dressed for ' + real + ' to begin with', (await p.evaluate(() => document.documentElement.getAttribute('data-season'))) === real);
    // the owner has opened the Summer tab of "What's in season" before the tour: it is not the season of the page, and every step must put THAT tab back, not the season's
    await p.evaluate(() => { const t = document.querySelector('#season-tabs [data-season="summer"]'); if (t) t.click(); });
    const start = await snap(p), startNow = JSON.parse(start);
    ok(tag + '(the Summer tab is open, and the page is still dressed for ' + real + ')', startNow.tab === 'summer' && startNow.season === real, JSON.stringify([startNow.tab, startNow.season]));
    const stripToday = await strip(p);

    /* ---- open the tour and go to the strip */
    await p.click('.wa-tour-pill');
    await welcome(p, tag + 'the welcome card opens');
    await goto(p, 'ch2-strip');
    await atTitle(p, 'The strip at the very top', tag + 'the strip step shows');
    let s = await look(p);
    ok(tag + 'the strip step has four buttons, none pressed, its own words, and the page is as it is today', s.choices === 'Spring|Summer|Fall|Winter' && /^This strip is on every page/.test(s.text) && s.rowBusy === 'false' && (await snap(p)) === start, s.choices);
    ok(tag + 'the strip says today\'s words before anything is pressed: "' + stripToday + '"', /^(In season|Next up): /.test(stripToday), stripToday);

    /* ---- the four buttons: the whole page goes to that season, the card says which */
    const seen = {};
    for (const id of SEASONS) {
      await btn(p, capital(id)).click();
      await okSoon(tag + capital(id) + ' pressed: the card says ' + capital(id) + ' and the page is in ' + id, async () => ({ l: await look(p), a: await p.evaluate(() => document.documentElement.getAttribute('data-season')) }), (v) => v.l && v.l.rowBusy === 'false' && new RegExp('^' + capital(id) + '\\b').test(v.l.text) && v.a === id && v.l.choices.includes(capital(id) + '*'));
      s = await look(p);
      const line = await strip(p);
      seen[id] = line;
      const quoted = (s.text.match(/“([^”]+)”/g) || []).map((x) => x.slice(1, -1));
      ok(tag + capital(id) + ': the strip says "' + line + '", the card quotes ' + JSON.stringify(quoted) + ', and Date is the page\'s own again', quoted.length > 0 && quoted.every((qt) => line.includes(qt)) && (await p.evaluate(() => window.Date === window.__Date0)), line);
      ok(tag + capital(id) + ': the card stays inside the window', s.box.x >= 0 && s.box.y >= 0 && s.box.r <= s.vw + 0.5 && s.box.b <= s.vh + 0.5, JSON.stringify(s.box));
    }
    ok(tag + 'the four buttons showed four different strips', new Set(Object.values(seen)).size === 4, JSON.stringify(seen));

    /* ---- Next puts everything back, and the next step is the first screen with the same four buttons, none pressed */
    await press(p, 'Next');
    await atTitle(p, 'The first screen follows the season', tag + 'Next goes to the first-screen step');
    ok(tag + 'Next put the page back exactly as it was (season, every line of a season, the strip, the countdown, This week, the badges, the tabs, Date)', (await snap(p)) === start, differ(start, await snap(p)));
    ok(tag + 'the next step starts with no button pressed (the old one is not carried over)', (await look(p)).choices === 'Spring|Summer|Fall|Winter');

    /* ---- the first screen: Winter changes the headline, the red button and the note; Back puts it back */
    await btn(p, 'Winter').click();
    await okSoon(tag + 'Winter on the first screen: the tree headline, the red button is Visit The GreenHouse, the note about The GreenHouse is gone', () => p.evaluate(() => ({ h: document.getElementById('hero-h').innerText, c: [...document.querySelectorAll('.hero-cta a')].filter((a) => a.getClientRects().length).map((a) => a.textContent.trim().replace(/\s+/g, ' ')), n: document.querySelector('.hero-note').getClientRects().length > 0 })), (v) => /Christmas trees/.test(v.h) && /^Visit The GreenHouse/.test(v.c[0]) && v.n === false);
    await press(p, 'Back');
    await atTitle(p, 'The strip at the very top', tag + 'Back goes to the strip step');
    ok(tag + 'Back put the page back exactly as it was', (await snap(p)) === start, differ(start, await snap(p)));

    /* ---- the farm cards: Winter and Spring change them; the Summer tab the owner had open stays the open one afterwards */
    const midNow = JSON.parse(start);
    await goto(p, 'ch5-cards');
    await atTitle(p, "What's on the farm", tag + 'the farm cards step shows');
    await btn(p, 'Winter').click();
    await okSoon(tag + 'Winter on the farm cards: three cards, all next door at The GreenHouse', () => cardsShown(p), (v) => v.length === 3 && v.includes('Christmas Trees'));
    await btn(p, 'Spring').click();
    await okSoon(tag + 'Spring on the farm cards: six cards, strawberries first', () => cardsShown(p), (v) => v.length === 6 && v[0] === 'U-Pick Strawberries');

    /* ---- Contents while a button is pressed: Back from Contents keeps it; a part in Contents leaves the step, so the page is put back */
    await press(p, 'Contents');
    await okSoon(tag + 'Contents opens (while Spring is showing)', () => look(p), (x) => x && x.title === 'Choose a part');
    await btn(p, 'Back').click();
    await okSoon(tag + 'Back from Contents shows the same step with Spring still pressed (the page was not touched)', () => look(p), (x) => x && x.title === "What's on the farm" && x.choices.includes('Spring*') && /^Spring, six cards/.test(x.text));
    await press(p, 'Contents');
    await okSoon(tag + 'Contents opens again', () => look(p), (x) => x && x.title === 'Choose a part');
    await p.getByRole('button', { name: /^3\. This week and the menu/ }).click();
    await atTitle(p, 'The countdown to the next season', tag + 'a part in Contents goes to its first step (the countdown)');
    const jumped = await parsed(p);
    ok(tag + 'the jump put the page back: the season, the farm cards, the open tabs and every line of a season are as before', jumped.season === midNow.season && jumped.cards === midNow.cards && jumped.farm === midNow.farm && jumped.tab === 'summer' && jumped.lines === midNow.lines && jumped.until === midNow.until && jumped.dateIsOwn, differ(midNow, jumped));
    const base1 = await snap(p);
    ok(tag + 'the page is the same as it was at the start (the jump changed nothing that was left)', base1 === start, differ(start, base1));

    /* ---- This week at the farm: the crops of every season are listed, the box is lit even when it is not there today */
    await goto(p, 'ch3-week');
    await atTitle(p, 'This week at the farm', tag + 'the This week step shows');
    for (const id of SEASONS) {
      await btn(p, capital(id)).click();
      await okSoon(tag + 'This week, ' + capital(id) + ': some crops are listed, all in season', () => p.evaluate(() => [...document.querySelectorAll('#this-week [data-week-crops] li')].map((li) => li.textContent.replace(/\s+/g, ' ').trim())), (v) => v.length > 0 && v.every((t) => /In season/.test(t)));
    }

    /* ---- Esc in the middle of a press: the page is put back */
    await btn(p, 'Spring').click();
    await p.keyboard.press('Escape');
    await okSoon(tag + 'Esc closes the tour even in the middle of a press', () => p.evaluate(() => !document.querySelector('.wa-tour')), (v) => v === true);
    await okSoon(tag + 'the page is put back after Esc (also the parts that follow the clock)', async () => (await snap(p)) === base1, (v) => v === true);
    ok(tag + 'the page still works: the first screen\'s own Winter button, and back', await (async () => {
      await p.evaluate(() => window.WISE_ACRES.hero.setSeason('winter'));
      await settled(p, 600);
      const w = await p.evaluate(() => document.documentElement.getAttribute('data-season'));
      await p.evaluate((r) => window.WISE_ACRES.hero.setSeason(r), real);
      await settled(p, 600);
      return w === 'winter' && (await p.evaluate(() => window.Date === window.__Date0));
    })());
    await p.context().close();
  }

  /* ================================================================ the keyboard and a phone, on the day of the story */
  const [time] = DAYS[0];
  let p = await openPage(browser, base, errs, { time });
  const key0 = await snap(p);
  await p.click('.wa-tour-pill');
  await welcome(p, 'keyboard: welcome');
  await goto(p, 'ch4-places');
  await atTitle(p, 'Two places, one family', 'keyboard: the two places step shows');
  let reached = '';
  for (let i = 0; i < 6 && !/^(Spring|Summer|Fall|Winter)$/.test(reached); i++) { await p.keyboard.press('Shift+Tab'); reached = (await look(p)).focus; }
  ok('keyboard: Shift+Tab from Next reaches the season buttons (Contents, Back, then Winter)', reached === 'Winter', reached);
  await p.keyboard.press('Enter');
  await okSoon('keyboard: Enter presses Winter: the farm card says picking is seasonal and has a Tell me when button', () => p.evaluate(() => (document.querySelector('#visit .choose-farm') || { innerText: '' }).innerText), (t) => /Picking is seasonal/.test(t) && /Tell me when/.test(t));
  await p.keyboard.press('Escape');
  await okSoon('keyboard: Esc closes and puts the page back', async () => (await snap(p)) === key0, (v) => v === true);
  await p.context().close();

  p = await openPage(browser, base, errs, { viewport: PHONE, touch: true, time });
  const phone0 = await snap(p);
  await p.tap('.wa-tour-pill');
  await welcome(p, 'phone: welcome');
  await goto(p, 'ch2-strip');
  await atTitle(p, 'The strip at the very top', 'phone: the strip step shows');
  await btn(p, 'Winter').tap();
  await okSoon('phone: Winter pressed: the strip says Christmas trees and the sheet is inside the window', async () => ({ l: await look(p), t: await strip(p) }), (v) => v.l && /Christmas trees/.test(v.t) && v.l.box.x >= 0 && v.l.box.r <= v.l.vw + 0.5 && v.l.box.b <= v.l.vh + 0.5);
  ok('phone: the page does not scroll sideways', (await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 1);
  await btn(p, 'Next').tap();
  await atTitle(p, 'The first screen follows the season', 'phone: Next goes on');
  ok('phone: Next put the page back', (await snap(p)) === phone0);
  await p.context().close();

  /* ================================================================ the tour from the card about the buttons on, every season button pressed on every step that has them */
  // by default as far as three cards after the last step that has the buttons, then Esc; WA_SEASONS_FULL=1 goes on to the last card and Finish (about 50 cards: slow on a busy computer)
  const FULL = !!process.env.WA_SEASONS_FULL;
  p = await openPage(browser, base, errs, { time });
  const full0 = await snap(p);
  await p.click('.wa-tour-pill');
  await welcome(p, 'whole tour: welcome');
  await goto(p, 'ch1-seasons');
  await atTitle(p, 'The page changes with the seasons', 'whole tour: the card about the buttons shows first');
  let walked = 0, last = null, after = 0;
  for (let guard = 0; guard < 200; guard++) {
    const l = await look(p);
    if (!l) break;
    last = l;
    if (l.choices === 'Spring|Summer|Fall|Winter') {
      for (const id of SEASONS) {
        await btn(p, capital(id)).click();
        await okSoon('whole tour, step ' + l.n + ' (' + l.title + '): ' + capital(id) + ' shows', () => look(p), (x) => x && x.rowBusy === 'false' && x.choices.includes(capital(id) + '*'));
      }
      walked++;
    }
    if (/Finish/.test(l.actions)) break;
    if (!FULL && walked >= 10 && ++after > 3) break;
    await press(p, 'Next');
    await okSoon('whole tour: Next from step ' + l.n, () => look(p), (x) => x && !x.busy && x.n === l.n + 1);
    if (!(await p.evaluate(() => window.Date === window.__Date0))) { ok('whole tour: Date is the page\'s own after step ' + l.n, false); break; }
  }
  info(walked + ' steps had the four season buttons; the last card was step ' + (last && last.n) + ' of ' + (last && last.of));
  ok('whole tour: ' + walked + ' steps had the four season buttons (10 are expected)', walked === 10, String(walked));
  if (FULL) {
    ok('whole tour: the last card was reached', !!last && /Finish/.test(last.actions));
    await press(p, 'Finish');
  } else await p.keyboard.press('Escape');
  await okSoon('the tour closes', () => p.evaluate(() => !document.querySelector('.wa-tour')), (v) => v === true);
  await okSoon('...and the page is exactly as it was before the tour (every walk was put back)', async () => (await snap(p)) === full0, (v) => v === true);
  const keys = await p.evaluate(() => Object.keys(localStorage).concat(Object.keys(sessionStorage)));
  ok(FULL ? 'after Finish nothing of the tour is left in browser storage (the season walk keeps nothing of its own)' : 'the tour keeps only its own place in browser storage (wa-tour); the season walk keeps nothing of its own', FULL ? !keys.some((k) => /tour/.test(k)) : keys.every((k) => k === 'wa-tour' || /^wa\./.test(k)), JSON.stringify(keys));
  await p.context().close();
});
