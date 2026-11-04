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
 *   - three things an independent walk of the real tour found, tried on the real steps (the engine's own checks are in tests/tour.test.mjs): the open-now badges keep saying what the pretended
 *     season says after a minute and when the tab is shown again (js/live.js draws them again with the real date every 60 seconds); the sign-up preview cannot be sent (it has no address, so
 *     the browser would load the page again and the tour would be gone); the language list puts the site's language back when the step is left; a dialog of the pretend account
 *     that the owner opens from a lit button is above the tour's dimmer, its buttons work, the card sits off it, and Next works with it still open (it is closed by the step)
 *   - the steps that used to leave the whole page free (the basket game, the menu at the top, the pretend account's request and bell): the lit part and what it opens (the menu's list, the
 *     bell's panel, the dialog, and for the game its picture) can be used and are lit, and everything else is locked: the menu, the tabs, the language list; a real click there does nothing
 *   - the spring picture that the cards of the basket game and of the first screen talk about: kids pick in the strawberry rows, the sunflowers at the sides can be snipped and grow
 *     back, and the basket card says so (the words of the cards are in js/tour-steps.js; the picture is js/hero.js)
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

  /* ================================================================ the real steps: what an independent walk of the tour found (the day of the story) */
  {
    const time = DAYS[0][0], tag = 'real steps: ';
    p = await openPage(browser, base, errs, { time });
    await p.click('.wa-tour-pill');
    await welcome(p, tag + 'the welcome card opens');

    // the open-now badges draw themselves again every 60 seconds and when the tab is shown again, with the real date: they must keep saying what the pretended season says
    const badges = () => p.evaluate(() => [...document.querySelectorAll('.hero-live .live')].filter((e) => !e.hidden).map((e) => e.textContent.replace(/\s+/g, ' ').trim()).join(' | '));
    await goto(p, 'ch2-badges');
    await atTitle(p, 'Open now, or closed today', tag + 'the badges step shows');
    const real = await badges();
    await btn(p, 'Summer').click();
    await okSoon(tag + 'Summer pressed: only The GreenHouse badge shows, and it says it is open', async () => ({ l: await look(p), b: await badges() }), (v) => v.l && v.l.rowBusy === 'false' && v.l.choices.includes('Summer*') && /Open now/.test(v.b) && !/farm|visits|reserved/i.test(v.b));
    const summer = await badges();
    ok(tag + 'the badges of today are not the badges of a summer Saturday (the day of the story is a Tuesday in fall)', summer !== real, JSON.stringify({ real, summer }));
    await p.clock.runFor(65000);
    await settled(p, 300);
    ok(tag + 'a minute later (js/live.js drew the badges again with the real date) they still say the summer words: "' + summer + '"', (await badges()) === summer, JSON.stringify({ now: await badges(), summer }));
    await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await settled(p, 300);
    ok(tag + 'and when the tab is shown again', (await badges()) === summer, await badges());
    await press(p, 'Next');
    await atTitle(p, 'The big buttons', tag + 'Next goes on');
    ok(tag + 'Next put the real badges back, and the draw-again every minute asks for the real date again', (await badges()) === real && (await p.evaluate(() => !window.WISE_ACRES.pretendNow)), JSON.stringify({ now: await badges(), real }));
    await p.clock.runFor(65000);
    await settled(p, 300);
    ok(tag + '...also after the next minute', (await badges()) === real, await badges());

    // the sign-up preview: a form without an address that nobody handles; the browser would send it to this same page, with the email in the address, and the tour would close
    await goto(p, 'ch8-signup');
    await atTitle(p, 'The email sign-up', tag + 'the sign-up step shows');
    await p.fill('#su-email', 'owner@example.com');
    const urlWas = p.url();
    await p.click('#signup button[type="submit"]');
    await p.waitForTimeout(500);
    let sent;
    try { sent = await p.evaluate(() => ({ url: location.href, card: !!document.querySelector('.wa-tour-card'), note: (document.querySelector('.wa-tour-flash') || {}).textContent || '', email: document.getElementById('su-email').value })); } catch (e) { sent = { error: String(e.message).slice(0, 90) }; }
    ok(tag + 'typing an email in the sign-up preview and pressing "Join the email list" sends nothing: the address does not change, the tour stays, and the card says forms are switched off', !sent.error && sent.url === urlWas && sent.card && /Forms are switched off/.test(sent.note) && sent.email === 'owner@example.com', JSON.stringify(sent));

    // the language list: a press on another language really changes the site, and the site keeps it; leaving the step puts it back
    await goto(p, 'ch9-languages');
    await atTitle(p, 'The language list', tag + 'the language step shows');
    await p.click('.lang-list [data-lang="es"]');
    await okSoon(tag + 'Español pressed: the whole site is Spanish', () => p.evaluate(() => ({ w: window.WISE_ACRES.lang, h: document.documentElement.lang })), (v) => v.w === 'es' && v.h === 'es', 20000);
    await press(p, 'Next');
    await okSoon(tag + 'Next: the site is English again, and the choice kept on this device is not Spanish', () => p.evaluate(() => ({ w: window.WISE_ACRES.lang, h: document.documentElement.lang, kept: (function () { try { return localStorage.getItem('wa.lang'); } catch (e) { return 'blocked'; } })() })), (v) => v.w === 'en' && v.h === 'en' && v.kept !== 'es', 20000);
    await p.keyboard.press('Escape');
    await okSoon(tag + 'the tour closes', () => p.evaluate(() => !document.querySelector('.wa-tour')), (v) => v === true);
    await p.context().close();

    // a dialog of the pretend account, opened by the lit button of a step (the request form of ch10-request): it is above the dimmer, usable, the card is not under it, and Next works
    const d = await open(browser, base, 'account.html', errs, { query: 'demo&tour', time });
    await d.addStyleTag({ content: '#wa-problems{display:none!important}' });
    await d.click('.wa-tour-pill');
    await welcome(d, tag + 'account page: the welcome card opens');
    await goto(d, 'ch10-request');
    await atTitle(d, 'Request a different day', tag + 'account page: the request step shows');
    await d.click('[data-tour="acct-request-day"]');
    await okSoon(tag + 'the lit button opens the dialog', () => d.evaluate(() => !!document.querySelector('.demo-modal .demo-modal-box')), (v) => v === true);
    await d.waitForTimeout(600);
    const dlg = await d.evaluate(() => {
      const back = document.querySelector('.demo-modal'), box = back.querySelector('.demo-modal-box'), cs = getComputedStyle(back), card = document.querySelector('.wa-tour-card');
      const nx = [...card.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Next'), c = card.getBoundingClientRect(), r = nx.getBoundingClientRect();
      const on = (el) => { const q = el.getBoundingClientRect(); return document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2) === el; };
      const area = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      const controls = [...box.querySelectorAll('button, input, textarea, a[href]')].filter((e) => e.getClientRects().length);
      const deep = (q, k) => Math.min(q.right, k.right) - Math.max(q.left, k.left) >= 4 && Math.min(q.bottom, k.bottom) - Math.max(q.top, k.top) >= 4;   // really under the card, not a hair's width
      return { z: cs.zIndex, bg: cs.backgroundColor, pe: cs.pointerEvents, boxPe: getComputedStyle(box).pointerEvents, nextOnTop: on(nx), controls: controls.length, controlsUnderCard: controls.filter((e) => deep(e.getBoundingClientRect(), c)).map((e) => (e.className || e.tagName) + ' ' + (e.textContent || e.name || '').trim().slice(0, 20)), buttonsOnTop: [...box.querySelectorAll('.demo-modal-actions button, .demo-modal-x')].every(on) };
    });
    ok(tag + 'the dialog is above the dimmer, its own overlay does not dim or block, the card sits off its buttons and fields, and its buttons and Next are the things at their places', dlg.z === '9100' && dlg.bg === 'rgba(0, 0, 0, 0)' && dlg.pe === 'none' && dlg.boxPe === 'auto' && dlg.nextOnTop && dlg.controlsUnderCard.length === 0 && dlg.buttonsOnTop && dlg.controls > 5, JSON.stringify(dlg));
    const before = await d.evaluate(() => [...document.querySelectorAll('.demo-modal input[type="radio"]')].findIndex((r) => r.checked));
    await d.locator('.demo-modal label.dv-choice').nth(1).click();
    ok(tag + 'a real click on a choice inside the dialog works (the other day is picked)', (await d.evaluate(() => [...document.querySelectorAll('.demo-modal input[type="radio"]')].findIndex((r) => r.checked))) !== before, '');
    await press(d, 'Next');
    await atTitle(d, 'Waiting for a reply', tag + 'Next works with the dialog still open: the next card shows');
    ok(tag + '...and the step closed the dialog when it was left', await d.evaluate(() => !document.querySelector('.demo-modal') && !document.documentElement.classList.contains('demo-modal-open')), '');
    await d.keyboard.press('Escape');   // the focus went back to the lit button when the dialog closed: this Esc brings it to the card...
    await d.keyboard.press('Escape');   // ...and this one closes the tour
    await okSoon(tag + 'the tour closes (the dialog is gone, so Esc is the tour\'s)', () => d.evaluate(() => !document.querySelector('.wa-tour')), (v) => v === true);
    await d.context().close();
  }

  /* ================================================================ the steps that used to leave the whole page free: the lit part and what it opens can be used, nothing else can */
  {
    const tag = 'locked page: ';
    const time = DAYS[0][0];
    // what a press at the middle of an element would meet: the element itself (or something in it), or the tour's click stopper
    const meet = (pg, sel) => pg.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(), h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { self: !!h && (h === e || e.contains(h)), stopped: !!(h && h.closest('.wa-tour-shield')), at: h ? (h.id || String(h.className).slice(0, 30) || h.tagName) : null, y: Math.round(r.top + r.height / 2) }; }, sel);
    const edges = (pg) => pg.evaluate(() => ({ extra: document.querySelector('.wa-tour').classList.contains('has-extra'), rings: [...document.querySelectorAll('.wa-tour-ring')].map((g) => { const b = g.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; }) }));
    const boxOf = (pg, sel) => pg.evaluate((s) => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; }, sel);
    const near = (a, b, d = 4) => Math.abs(a - b) <= d;
    const around = (g, b) => !!g && near(g.x, b.x - 8) && near(g.y, b.y - 8) && near(g.w, b.w + 16) && near(g.h, b.h + 16);
    const click = async (pg, sel) => { const b = await boxOf(pg, sel); await pg.mouse.click(b.x + b.w / 2, b.y + b.h / 2); };
    const attr = (pg, sel, a) => pg.evaluate(([s, n]) => document.querySelector(s).getAttribute(n), [sel, a]);
    const VISIT = '.nav-group-btn[aria-controls="nav-list-visit"]';

    const p = await openPage(browser, base, errs, { time });
    await p.click('.wa-tour-pill');
    await welcome(p, tag + 'the welcome card opens');
    // the basket game: its picture is the playground (lit with the picker); the menu above it is locked
    await goto(p, 'ch2-game');
    await atTitle(p, 'The basket game', tag + 'the basket game step shows');
    await settled(p, 600);
    let e = await edges(p);
    const menuBtn = await meet(p, VISIT), pickBtn = await meet(p, '#pick-btn');
    ok(tag + 'the basket game: the picture is lit with the picker (a second yellow edge), the picker button can be pressed, and the menu above is locked (a press meets the click stopper)', e.extra && e.rings.length === 1 && pickBtn && pickBtn.self && !pickBtn.stopped && menuBtn && menuBtn.stopped, JSON.stringify({ e, menuBtn, pickBtn }));
    await click(p, VISIT);
    await settled(p, 300);
    ok(tag + 'a real click on the menu\'s Visit button does nothing in the game step (its list stays shut)', (await attr(p, VISIT, 'aria-expanded')) === 'false');
    await click(p, '#pick-btn');
    await okSoon(tag + 'a real click on the picker button works (the basket count goes up)', () => p.evaluate(() => document.getElementById('pick-count').textContent), (v) => v === '1');

    // the menu at the top: Visit opens its list, which is lit with the bar and can be used; the rest of the page is locked
    await goto(p, 'ch3-menu');
    await atTitle(p, 'The menu at the top', tag + 'the menu step shows');
    await settled(p, 600);
    await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await settled(p, 600);
    e = await edges(p);
    ok(tag + 'the menu step: before a button is pressed only the menu bar is lit', !e.extra && e.rings.length === 0, JSON.stringify(e));
    await click(p, VISIT);
    await okSoon(tag + 'the menu step: Visit opens its list, the list is lit with the bar (a yellow edge 8 px round it) and a link in it can be pressed', async () => ({ e: await edges(p), list: await boxOf(p, '#nav-list-visit'), link: await meet(p, '#nav-list-visit a') }), (v) => v.e.extra && v.e.rings.length === 1 && around(v.e.rings[0], v.list) && v.link && v.link.self && !v.link.stopped, 20000);
    const big = await meet(p, '.hero-cta .btn-white');
    ok(tag + 'the menu step: the big white button of the first screen is locked (a press meets the click stopper)', big && big.stopped, JSON.stringify(big));
    const h0 = await p.evaluate(() => location.hash);
    if (big && big.stopped) await click(p, '.hero-cta .btn-white');
    await settled(p, 300);
    ok(tag + 'the menu step: a real click on it does nothing (the address does not change)', (await p.evaluate(() => location.hash)) === h0, await p.evaluate(() => location.hash));
    await press(p, 'Next');
    await okSoon(tag + 'the menu step: Next shuts the list again (after()) and only one part is lit', async () => ({ e: await edges(p), open: await attr(p, VISIT, 'aria-expanded') }), (v) => !v.e.extra && v.e.rings.length === 0 && v.open === 'false', 20000);
    await p.context().close();

    // the pretend account: the request (the lit button opens a dialog) and the bell (its list is not inside it); the tabs are locked
    const d = await open(browser, base, 'account.html', errs, { query: 'demo&tour', time });
    await d.addStyleTag({ content: '#wa-problems{display:none!important}' });
    await d.click('.wa-tour-pill');
    await welcome(d, tag + 'account page: the welcome card opens');
    await goto(d, 'ch10-request');
    await atTitle(d, 'Request a different day', tag + 'account page: the request step shows');
    await settled(d, 600);
    await d.evaluate(() => document.querySelector('#demo-tab-pizza').scrollIntoView({ block: 'center', behavior: 'instant' }));   // the step has scrolled the page to its lit button: the tab is brought on the screen, so that a press on it can be tried
    await settled(d, 300);
    const tabIn = await meet(d, '#demo-tab-pizza'), hashAt = await d.evaluate(() => location.hash);
    ok(tag + 'the request step: the My pizza tab is locked (a press meets the click stopper)', tabIn && tabIn.stopped, JSON.stringify(tabIn));
    await click(d, '#demo-tab-pizza');
    await settled(d, 400);
    ok(tag + 'the request step: a real click on the My pizza tab does not switch the screen (the address is the same, and the card still talks about the lit part)', (await d.evaluate(() => location.hash)) === hashAt && (await look(d)).title === 'Request a different day', await d.evaluate(() => location.hash));
    await goto(d, 'ch10-bell');
    await atTitle(d, 'The alert arrives', tag + 'account page: the bell step shows');
    await settled(d, 600);
    e = await edges(d);
    ok(tag + 'the bell step: before the bell is pressed only the bell is lit', !e.extra && e.rings.length === 0, JSON.stringify(e));
    await click(d, '[data-tour="acct-bell"]');
    await okSoon(tag + 'the bell step: the bell opens its list, which is not inside the bell, the list is lit (a yellow edge 8 px round it) and a notice in it can be pressed', async () => ({ e: await edges(d), panel: await boxOf(d, '#demo-bell-panel'), notice: await meet(d, '#demo-bell-panel .demo-notice') }), (v) => v.e.extra && v.e.rings.length === 1 && around(v.e.rings[0], v.panel) && v.notice && v.notice.self && !v.notice.stopped, 20000);
    const tab2 = await meet(d, '#demo-tab-pizza');
    ok(tag + 'the bell step: the My pizza tab is locked while the list is open', tab2 && tab2.stopped, JSON.stringify(tab2));
    await d.context().close();
  }

  /* ================================================================ the Christmas trees step: in every season the lit box is the list that names the trees, and in winter the green line is lit too */
  {
    const tag = 'trees: ';
    const p = await openPage(browser, base, errs, { time: DAYS[0][0] });
    await p.click('.wa-tour-pill');
    await welcome(p, tag + 'the welcome card opens');
    await goto(p, 'ch6-trees');
    await atTitle(p, 'Christmas trees at The GreenHouse', tag + 'the step shows');
    await settled(p, 600);
    const boxes = () => p.evaluate(() => {
      const rect = (e) => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; };
      const hole = rect(document.querySelector('.wa-tour-hole')), li = [...document.querySelectorAll('#greenhouse .gh-features li')].find((x) => /Christmas trees in season/.test(x.textContent));
      const line = document.querySelector('#greenhouse .gh-trees'), shown = !!(line && !line.hidden && line.getClientRects().length);
      return { hole, li: li ? rect(li) : null, line: shown ? rect(line) : null, rings: [...document.querySelectorAll('.wa-tour-ring')].map(rect), hb: document.querySelector('.site-header').getBoundingClientRect().bottom, vh: innerHeight };
    });
    const within = (a, h) => !!a && a.x >= h.x - 1 && a.y >= h.y - 1 && a.x + a.w <= h.x + h.w + 1 && a.y + a.h <= h.y + h.h + 1;
    const around = (g, b) => !!g && !!b && Math.abs(g.x - (b.x - 8)) <= 4 && Math.abs(g.y - (b.y - 8)) <= 4 && Math.abs(g.w - (b.w + 16)) <= 4 && Math.abs(g.h - (b.h + 16)) <= 4;
    for (const id of SEASONS) {
      await btn(p, capital(id)).click();
      await okSoon(tag + capital(id) + ' pressed: the card says ' + capital(id), () => look(p), (v) => v && v.rowBusy === 'false' && new RegExp('^' + capital(id) + '\\b').test(v.text), 20000);
      await settled(p, 600);
      const b = await boxes();
      ok(tag + capital(id) + ': the lit box is the list that names the trees: it holds "Christmas trees in season", and that line is whole in the window under the top bar', within(b.li, b.hole) && b.li.y >= b.hb && b.li.y + b.li.h <= b.vh, JSON.stringify(b));
      if (id === 'winter') ok(tag + 'Winter: the green line "Christmas trees are here" is lit too (a yellow edge round it, with the yellow note), and it is whole in the window', !!b.line && b.rings.length === 2 && b.rings.some((g) => around(g, b.line)) && b.line.y >= b.hb && b.line.y + b.line.h <= b.vh, JSON.stringify(b));
      else ok(tag + capital(id) + ': there is no green line, so only the yellow note is lit with the list', !b.line && b.rings.length === 1, JSON.stringify(b));
    }
    await p.context().close();
  }

  /* ================================================================ the school tours step: the price card, and the buttons under the words (the sign-up form and Vanessa's email), all lit and usable */
  {
    const tag = 'school tours: ';
    const p = await openPage(browser, base, errs, { time: DAYS[0][0] });
    await p.click('.wa-tour-pill');
    await welcome(p, tag + 'the welcome card opens');
    await goto(p, 'ch8-school');
    await atTitle(p, 'School tours and group events', tag + 'the step shows');
    await settled(p, 600);
    const boxOf = (sel) => p.evaluate((s) => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; }, sel);
    const meet = (sel) => p.evaluate((s) => { const e = document.querySelector(s); const r = e.getBoundingClientRect(), h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { self: !!h && (h === e || e.contains(h)), stopped: !!(h && h.closest('.wa-tour-shield')) }; }, sel);
    const rings = await p.evaluate(() => [...document.querySelectorAll('.wa-tour-ring')].map((g) => { const b = g.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; }));
    const row = await boxOf('#school-tours .card-actions'), s2 = await look(p);
    const near = (a, b, d = 4) => Math.abs(a - b) <= d;
    ok(tag + 'the buttons under the words (the sign-up form, Email Vanessa, About school field trips) are lit with the price card (a yellow edge 8 px round them)', rings.length === 1 && near(rings[0].x, row.x - 8) && near(rings[0].y, row.y - 8) && near(rings[0].w, row.w + 16) && near(rings[0].h, row.h + 16), JSON.stringify({ rings, row }));
    const mail = await meet('#school-tours a[href^="mailto:vanessa"]'), form = await meet('#school-tours a[href*="docs.google.com/forms"]');
    ok(tag + 'Vanessa\'s email button and the sign-up form button can be pressed (not behind the click stopper)', mail.self && !mail.stopped && form.self && !form.stopped, JSON.stringify({ mail, form }));
    ok(tag + 'the card names her: "Questions? Vanessa\'s email is here."', /Questions\? Vanessa’s email is here\./.test(s2.text), s2.text);
    await p.context().close();
  }

  /* ================================================================ the spring picture, as the cards of the basket game and of the first screen describe it (20 Apr) */
  {
    const tag = 'spring picture: ';
    const p = await openPage(browser, base, errs, { time: DAYS[1][0] });
    await settled(p, 1500);
    const pic = await p.evaluate(() => ({ season: document.documentElement.getAttribute('data-season'), kids: document.querySelectorAll('#hero-scene [data-npc="kid"]').length, flowers: document.querySelectorAll('#hero-scene .flower-cut').length, hint: ((document.getElementById('pick-msg') || {}).textContent || '') }));
    ok(tag + 'the page is dressed for spring, kids with baskets stand in the strawberry rows, five sunflowers at the sides can be snipped', pic.season === 'spring' && pic.kids >= 2 && pic.flowers === 5, JSON.stringify(pic));
    const hintOf = () => p.evaluate(() => ((document.getElementById('pick-msg') || {}).textContent || '').replace(/\s+/g, ' ').trim());
    ok(tag + 'the basket card says "Try it! Tap the strawberries to pick them, or snip a sunflower." (the words the tour quotes)', (await hintOf()).includes('Try it! Tap the strawberries to pick them, or snip a sunflower.'), await hintOf());
    const at = await p.evaluate(() => { const r = document.querySelector('#hero-scene .flower-cut rect').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await p.mouse.click(at.x, at.y);
    await settled(p, 300);
    const cut = await p.evaluate(() => document.querySelectorAll('#hero-scene .flower-cut .berry.is-picked').length);
    ok(tag + 'a tap on a sunflower at the side snips it', cut === 1, String(cut));
    await p.clock.runFor(12000);   // it grows back after 7 to 11 seconds (js/hero.js picks the time by chance)
    await settled(p, 300);
    ok(tag + '...and it grows back (nothing is snipped 12 seconds later)', (await p.evaluate(() => document.querySelectorAll('#hero-scene .flower-cut .berry.is-picked').length)) === 0, '');
    await p.context().close();
  }
});
