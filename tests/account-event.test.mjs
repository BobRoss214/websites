// order: 395
// browser: yes
// covers: js/demo-app.js, js/demo-ui.js, js/demo-data.js, js/demo-store.js, js/demo-view-event.js, js/demo-view-family.js, js/demo-view-pizza.js, js/demo-pizza-editor.js, js/demo-kitchen.js, css/demo.css, pages/account.html, pages/farm-desk.html, pages/kitchen.html
/* The pretend account, as a family sees it (account.html?demo and kitchen.html?demo, a real browser):
 *   - the sign-up asks ONE plain question, "Do you plan or manage a party, an event or a school trip?", with four big buttons (real radio buttons made in JavaScript: the
 *     page files hold no input, text box or list): No / Yes: a party / Yes: a school trip / Yes: another event; No is chosen to begin with; "Fill in sample details" chooses the school trip;
 *     on a computer screen (1440 x 900) the whole question shows without scrolling (the name and the email share a line, and the question comes right after the email, before the
 *     pretend password); on a phone the name and the email are one under the other;
 *   - each answer: what the account keeps, which tabs there are, what the My event screen says for that kind (the page's own prices: a party is one price for the whole party,
 *     a school trip $11 each, another event shows no price);
 *   - My event is on the tab bar ONLY for a family that has an event; its address (#event) opens the first tab for the others; "I also plan an event" at the bottom of My family
 *     adds one (a party, a school trip or another event) and shows the tab, and the link is gone once there is an event;
 *   - there is no My year: no tab, no script, no file, and none of the words about how many times a family came (visits so far, badges, stamps, streaks, season pass) on any tab;
 *   - the contact links: "Questions? Email Vanessa" on a school trip, "Pizza questions? Email Ava" on My pizza (and in the pizza editor), "Pizza kitchen contact:" with Ava's address on
 *     the kitchen screen; mailto links to the addresses the site already shows, no telephone link;
 *   - My visits: the box with Mrs. Cathy's answer carries the tour hook (acct-reply) in every state, not only while she suggests something (yes, no, a suggestion, OK, kept);
 *     a day closed by the desk says why in one sentence ("The farm is closed that day because of rain."), the new-day box says the same reason, and so does the desk's own promise;
 *   - DemoUI.closeModals() closes every open dialog by the demo's own close, and the cards of tour chapter 10 that light a button which opens a dialog (js/tour-steps-c.js, run
 *     here on the real screen) close it when they are left, find their boxes (the answer card is no longer skipped), and keep a family made by hand;
 *   - DemoUI.clearToasts() takes away every toast that is on the screen and nothing else (a dialog stays, the store is the same), and says how many there were; the real cards of
 *     chapter 10 do it when they are left, so the message that a new notice makes (the kitchen's "suggests something else") never sits on top of the next card;
 *   - accessibility (axe, when axe-core is installed): the sign-up card, the three kinds of My event, My family with its box, My pizza and its editor have no violations.
 * Run: node tests/account-event.test.mjs  (or: node tests/run-all.mjs account-event) */
import fs from 'node:fs';
import path from 'node:path';
import { run, open, ok, info, axeSource, ROOT, TODAY } from './lib.mjs';

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const axe = axeSource();
const RULES = { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] } };
const STILL = '*{animation:none!important;transition:none!important}';
const VANESSA = 'mailto:vanessa@wiseacresorganic.com?subject=School%20tour%20question', AVA = 'mailto:ava@wiseacresorganic.com?subject=Wise%20Pie%20question';
const WORDS_OF_COUNTING = /visits? so far|visits? this year|times you|how many times|visit number|badges?|stamps?|streak|season pass|loyal/i;

await run('account-event', async ({ browser, base, errs }) => {
  /* ---- the files: no field in a page file, no My year anywhere ---- */
  for (const f of ['pages/account.html', 'pages/farm-desk.html', 'pages/kitchen.html']) {
    ok(`${f}: no input, text box or list is written in the page (they are built in JavaScript)`, !/<(input|textarea|select)\b/i.test(read(f)));
  }
  ok('My year is gone from the files: no js/demo-view-year.js, no script tag for it in the page source or the built page, no tab called year in the shell', !fs.existsSync(path.join(ROOT, 'js/demo-view-year.js'))
    && !/demo-view-year/.test(read('pages/account.html') + read('account.html')) && !/'year'/.test(read('js/demo-app.js')) && !/acct-year|dvy-/.test(read('js/demo-view-kit.js') + read('js/tour-steps-c.js') + read('css/demo.css')));

  const KEY = { 'No': 'none', 'Yes: a party': 'party', 'Yes: a school trip': 'school', 'Yes: another event': 'other' };   // the button words and what the account keeps
  const radio = (p, words) => p.locator(`.demo-signup input[type=radio][value="${KEY[words]}"]`);
  const tabsOf = (p) => p.locator('.demo-tabs [role=tab]').allInnerTexts();
  const selected = (p) => p.locator('.demo-tabs [aria-selected=true]').innerText();
  const goTab = async (p, name) => { await p.click(`.demo-tabs [data-tab="${name}"]`); await p.waitForSelector(`.demo-view[data-view="${name}"]`); await p.waitForTimeout(150); };
  const axeOn = async (p, label, selector) => {
    if (!axe) return;
    await p.addStyleTag({ content: STILL });
    await p.evaluate(axe);
    const res = await p.evaluate(async ([sel, rules]) => (await window.axe.run(document.querySelector(sel) || document, rules)).violations.map((v) => v.id + ' [' + v.impact + '] ' + v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')), [selector, RULES]);
    ok(`axe: ${label} has no violations`, res.length === 0, res.join(' ; '));
  };
  const signUp = async (p, answer) => {
    await p.waitForSelector('.demo-signup');
    await p.fill('#demo-su-name', 'Pat');
    await p.fill('#demo-su-email', 'pat@example.com');
    if (answer) await radio(p, answer).check();
    await p.click('.demo-signup button[type=submit]');
    await p.waitForSelector('.demo-tabs [role=tab]');
    await p.waitForTimeout(200);
  };

  /* ---- the sign-up card ---- */
  {
    const p = await open(browser, base, 'account.html', errs, { query: 'demo' });
    await p.waitForSelector('.demo-signup');
    const legend = await p.locator('.demo-signup fieldset legend').innerText();
    const labels = await p.locator('.demo-signup .demo-choice').allInnerTexts();
    ok('the sign-up asks ONE plain question', legend.trim() === 'Do you plan or manage a party, an event or a school trip?' && await p.locator('.demo-signup fieldset').count() === 1, legend);
    ok('with four big buttons, in this order: No / Yes: a party / Yes: a school trip / Yes: another event', labels.map((x) => x.trim()).join(' | ') === 'No | Yes: a party | Yes: a school trip | Yes: another event', labels.join(' | '));
    // the first screen of a computer (1440 x 900, not scrolled): the whole question can be seen, and why: the name and the email share a line, and the question comes before the pretend password
    const first = await p.evaluate(() => {
      const R = (s) => { const e = document.querySelector(s), r = e ? e.getBoundingClientRect() : null; return r ? { x: r.left, y: r.top, right: r.right, bottom: r.bottom, w: r.width } : null; };
      const after = (a, b) => !!(document.querySelector(a).compareDocumentPosition(document.querySelector(b)) & Node.DOCUMENT_POSITION_FOLLOWING);
      return { vh: window.innerHeight, scrolled: window.scrollY, legend: R('.demo-signup fieldset legend'), last: Math.max(...[...document.querySelectorAll('.demo-signup .demo-choice')].map((e) => e.getBoundingClientRect().bottom)),
        name: R('#demo-su-name'), email: R('#demo-su-email'), order: after('#demo-su-email', '.demo-signup fieldset') && after('.demo-signup fieldset', '#demo-su-pass') };
    });
    ok('on a computer screen (1440 x 900) the whole question shows without scrolling: its words and all four buttons end at least 20 px above the bottom edge', first.vh === 900 && first.scrolled === 0 && first.legend.y > 0 && first.last <= first.vh - 20, JSON.stringify(first));
    ok('...the name and the email share one line (each wide enough to type in), and the question comes right after the email, before the pretend password', Math.abs(first.name.y - first.email.y) < 2 && first.email.x > first.name.right && first.name.w >= 200 && first.email.w >= 200 && first.order, JSON.stringify(first));
    ok('they are real radio buttons of one group (the arrow keys and a screen reader work), and No is chosen to begin with', await p.locator('.demo-signup input[type=radio]').count() === 4 && await p.locator('.demo-signup input[type=radio][name="demo-su-event"]').count() === 4
      && await radio(p, 'No').isChecked() && !await radio(p, 'Yes: a party').isChecked());
    ok('a screen reader hears only the words: the four radio buttons are named exactly No, Yes: a party, Yes: a school trip and Yes: another event (the tick that shows the chosen one is not part of the name)',
      (await Promise.all(Object.keys(KEY).map((w) => p.getByRole('radio', { name: w, exact: true }).count()))).join() === '1,1,1,1');
    const boxes = await p.locator('.demo-signup .demo-choice').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
    ok('each button is big: at least 44 px tall and wide (a finger can press it)', boxes.every(([w, h]) => w >= 120 && h >= 44), JSON.stringify(boxes));
    await radio(p, 'No').focus();
    await p.keyboard.press('ArrowDown');
    ok('the arrow keys move the choice (Down from No chooses "Yes: a party")', await radio(p, 'Yes: a party').isChecked());
    await p.click('.demo-signup [data-demo-fill]');
    ok('"Fill in sample details" fills in the name and the email and chooses "Yes: a school trip"', await p.inputValue('#demo-su-name') === 'Alex' && await p.inputValue('#demo-su-email') === 'alex@example.com' && await radio(p, 'Yes: a school trip').isChecked());
    ok('the hint says only a yes adds the My event tab, and has Vanessa\'s link for school trips', /Only a yes adds the My event tab/.test(await p.locator('.demo-signup .demo-choices .demo-hint').innerText()) && await p.locator(`.demo-signup a[href="${VANESSA}"]`).innerText() === 'Questions? Email Vanessa');
    await axeOn(p, 'the sign-up card (with the question)', '.demo-signup');
    if (axe) {   // prove once that axe really reports a mistake here (a picture without a text alternative), so a silent axe cannot pass everything
      const bad = await p.evaluate(async (rules) => { document.body.insertAdjacentHTML('beforeend', '<img id="axe-self-test" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">'); const r = (await window.axe.run(document, rules)).violations.map((v) => v.id); document.getElementById('axe-self-test').remove(); return r; }, RULES);
      ok('axe really runs: it reports a deliberate mistake (an image without alt)', bad.includes('image-alt'), bad.join(','));
    }
    const wide = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    ok('the page does not scroll sideways', wide);
    await p.context().close();
    const phone = await open(browser, base, 'account.html', errs, { query: 'demo', viewport: { width: 390, height: 844 } });
    await phone.waitForSelector('.demo-signup');
    ok('on a phone the name and the email are one under the other (the card is too narrow for two columns), each wide enough to type in', await phone.evaluate(() => { const n = document.querySelector('#demo-su-name').getBoundingClientRect(), e = document.querySelector('#demo-su-email').getBoundingClientRect(); return e.top >= n.bottom && Math.abs(e.left - n.left) < 2 && n.width >= 240 && e.width >= 240; }));
    ok('on a phone the four buttons still fit inside the card and the page does not scroll sideways', await phone.evaluate(() => { const c = document.querySelector('.demo-signup').getBoundingClientRect(); return document.documentElement.scrollWidth <= window.innerWidth && [...document.querySelectorAll('.demo-signup .demo-choice')].every((e) => e.getBoundingClientRect().right <= c.right + 1); }));
    await phone.context().close();
  }

  /* ---- answer No: no My event tab; add one later ---- */
  {
    const p = await open(browser, base, 'account.html', errs, { query: 'demo' });
    await signUp(p, 'No');
    const tabs = (await tabsOf(p)).map((x) => x.trim());
    ok('answer No: the tabs are My visits, My pizza, My family, Tell me when, Receipts and questions, Photos and reviews (no My event, no My year)', tabs.join(' | ') === 'My visits | My pizza | My family | Tell me when | Receipts and questions | Photos and reviews', tabs.join(' | '));
    ok('the account keeps the answer and has no event', await p.evaluate(() => window.DemoStore.current().eventKind === 'none' && window.DemoStore.list('events').length === 0));
    await p.evaluate(() => { window.location.hash = '#event'; });
    await p.waitForTimeout(250);
    ok('the address #event opens the first tab (My visits) and is left as it is', (await selected(p)).trim() === 'My visits' && await p.evaluate(() => window.location.hash) === '#event');
    await p.evaluate(() => { window.location.hash = '#year'; });
    await p.waitForTimeout(250);
    ok('so does the old address #year', (await selected(p)).trim() === 'My visits');
    await goTab(p, 'family');
    const link = p.locator('.dvf-event button');
    ok('My family has a small, quiet link at the bottom: "I also plan an event"', await link.count() === 1 && (await link.innerText()).trim() === 'I also plan an event');
    ok('it is the last thing on the screen (below the Save button and the form)', await p.evaluate(() => { const l = document.querySelector('.dvf-event button').getBoundingClientRect(), s = document.querySelector('[data-k="fam-save"]').getBoundingClientRect(); return l.top > s.bottom; }));
    await link.click();
    await p.waitForSelector('.demo-modal');
    const buttons = (await p.locator('.demo-modal-actions button').allInnerTexts()).map((x) => x.trim());
    ok('the link opens a box with the three kinds (A party / A school trip / Another event) and "Not now", and Vanessa\'s link for school trips', buttons.join(' | ') === 'A party | A school trip | Another event | Not now' && await p.locator(`.demo-modal-body a[href="${VANESSA}"]`).innerText() === 'Questions? Email Vanessa', buttons.join(' | '));
    ok('the box opens with "A party" in focus (not the mail link, so a quick Enter does not open a mail program)', await p.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-demo-action') === 'party'));
    await axeOn(p, 'the "I also plan an event" box', '.demo-modal');
    await p.click('.demo-modal-actions button:has-text("Not now")');
    await p.waitForTimeout(150);
    ok('"Not now" changes nothing: still no event, no My event tab', await p.evaluate(() => window.DemoStore.list('events').length === 0) && !(await tabsOf(p)).some((x) => /My event/.test(x)));
    await axeOn(p, 'My family with the link', '#demo-panel');
    await link.click();
    await p.waitForSelector('.demo-modal');
    await p.click('.demo-modal-actions button[data-demo-action="party"]');
    await p.waitForSelector('.demo-tabs [data-tab="event"]');
    await p.waitForTimeout(300);
    ok('choosing "A party" adds a sample party, keeps the kind in the account and opens the new My event tab', await p.evaluate(() => window.DemoStore.list('events').length === 1 && window.DemoStore.list('events')[0].kind === 'party' && window.DemoStore.current().eventKind === 'party') && (await selected(p)).trim() === 'My event' && await p.evaluate(() => window.location.hash) === '#event');
    ok('the tab bar now has My event, after Photos and reviews', (await tabsOf(p)).map((x) => x.trim()).join(' | ') === 'My visits | My pizza | My family | Tell me when | Receipts and questions | Photos and reviews | My event');
    const added = (await p.locator('#demo-panel').innerText()).replace(/\s+/g, ' ');
    ok('and the new My event is the sample party, with Mrs. Cathy\'s first message in its thread', /Sample birthday party/.test(added) && /Thank you for booking a party/.test(added), added.slice(0, 200));
    await goTab(p, 'family');
    ok('the "I also plan an event" link is gone once there is an event', await p.locator('.dvf-event').count() === 0);
    await p.context().close();
  }

  /* ---- answer "a party" ---- */
  {
    const p = await open(browser, base, 'account.html', errs, { query: 'demo' });
    await signUp(p, 'Yes: a party');
    ok('answer "a party": My event is the last tab, and the account keeps the kind', (await tabsOf(p)).map((x) => x.trim()).pop() === 'My event' && await p.evaluate(() => window.DemoStore.current().eventKind === 'party'));
    await goTab(p, 'event');
    const text = (await p.locator('#demo-panel').innerText()).replace(/\s+/g, ' ');
    ok('My event shows a party: the chip, the guests (no students), the one price for the whole party and the page\'s rules', /Party/.test(await p.locator('[data-tour="acct-event"] .dvk-chip').innerText()) && /Sample birthday party/.test(text) && /24\s*Guests/.test(text) && /50\s*Most guests/.test(text) && !/Students|Chaperones/.test(text)
      && /\$300 for the whole party/.test(text) && /farm entry fee for every guest is included/.test(text) && /up to 50 guests/.test(text) && /Children age 2 and younger are free and do not count/.test(text) && /2\.5 hours/.test(text), text.slice(0, 400));
    ok('a party has no school contact: no Vanessa link there', await p.locator(`#demo-panel a[href="${VANESSA}"]`).count() === 0);
    ok('the checklist is the Parties card\'s "How it works" (cake, decorate, check-in, no outside alcohol)', /Bring cake and snacks for your guests/.test(text) && /Decorate your party space/.test(text) && /they are with your party when they check in/.test(text) && /not to bring their own alcohol/.test(text));
    // the guest count can be changed as a request
    await p.fill('#demo-panel input[data-k="ev-guests"]', '30');
    await p.click('#demo-panel [data-k="ev-send"]');
    await p.waitForSelector('[data-k="ev-status"]');
    ok('a new guest count is a REQUEST to Mrs. Cathy (guests only), and nothing changes before she answers', await p.evaluate(() => { const r = window.DemoStore.list('requests')[0]; return r.kind === 'event-change' && r.status === 'waiting' && JSON.stringify(r.patch) === '{"guests":30}' && /guest count from 24 guests to 30 guests/.test(r.summary) && window.DemoStore.list('events')[0].guests === 24; }));
    // Mrs. Cathy's desk (the same browser) reads a party as guests, not as students and chaperones
    const desk = await p.context().newPage();
    desk.on('pageerror', (e) => errs.push('farm-desk.html pageerror: ' + e.message));
    await desk.goto(base + 'farm-desk.html?demo', { waitUntil: 'load' });
    await desk.waitForSelector('[data-tour="desk-card"][data-req-kind="event-change"]', { timeout: 40000 });
    const deskCard = (await desk.locator('[data-tour="desk-card"][data-req-kind="event-change"]').innerText()).replace(/\s+/g, ' ');
    const deskGroups = (await desk.locator('[data-tour="desk-groups"]').innerText()).replace(/\s+/g, ' ');
    ok('the desk reads the party as guests: the request says "Booked now: 24 guests" and the Groups card "24 guests", with no students or chaperones', /Booked now: 24 guests/.test(deskCard) && /24 guests/.test(deskGroups) && !/student|chaperone/i.test(deskCard + ' ' + deskGroups), deskCard.slice(0, 200) + ' || ' + deskGroups.slice(0, 200));
    await desk.click('[data-tour="desk-card"][data-req-kind="event-change"] [data-tour="desk-suggest"]');
    await desk.waitForTimeout(300);
    const asks = (await desk.locator('[data-tour="desk-card"][data-req-kind="event-change"] label').allInnerTexts()).map((x) => x.trim());
    ok('and her "suggest" form asks for Guests (no Students, no Chaperones)', asks.includes('Guests') && !asks.includes('Students') && !asks.includes('Chaperones'), asks.join(' | '));
    await desk.close();
    await p.evaluate(() => { const S = window.DemoStore, r = S.list('requests')[0]; S.reply(r.id, { answer: 'yes', note: 'Fine.' }); });
    await p.waitForTimeout(300);
    ok('after her yes the party has 30 guests and the screen says so', /Your guest count is now 30 guests/.test(await p.locator('#demo-panel').innerText()) && /30\s*Guests/.test((await p.locator('#demo-panel').innerText()).replace(/\s+/g, ' ')));
    await axeOn(p, 'My event (a party, with an answered request)', '#demo-panel');
    await p.click('[data-demo-signout]');
    await p.waitForSelector('.demo-signup', { state: 'visible' });
    ok('after Sign out the sign-up question begins again with No chosen', await radio(p, 'No').isChecked() && !await radio(p, 'Yes: a party').isChecked());
    await p.context().close();
  }

  /* ---- answer "another event" ---- */
  {
    const p = await open(browser, base, 'account.html', errs, { query: 'demo' });
    await signUp(p, 'Yes: another event');
    await goTab(p, 'event');
    const text = (await p.locator('#demo-panel').innerText()).replace(/\s+/g, ' ');
    ok('answer "another event": My event shows an event with guests and NO price (the website names none), and says Mrs. Cathy gives a quote', (await p.locator('[data-tour="acct-event"] .dvk-chip').innerText()).trim() === 'Event' && /30\s*Guests/.test(text) && /No price yet/.test(text) && /Mrs\. Cathy gives you a quote/.test(text) && !/\$\d/.test(await p.locator('[data-tour="acct-event"]').innerText()), text.slice(0, 300));
    await axeOn(p, 'My event (another event)', '#demo-panel');
    await p.context().close();
  }

  /* ---- answer "a school trip": every tab, no My year, the contact links ---- */
  {
    const p = await open(browser, base, 'account.html', errs, { query: 'demo' });
    await signUp(p, 'Yes: a school trip');
    const tabs = (await tabsOf(p)).map((x) => x.trim());
    ok('answer "a school trip": the seven tabs are there, My event last, and there is no My year', tabs.join(' | ') === 'My visits | My pizza | My family | Tell me when | Receipts and questions | Photos and reviews | My event' && !tabs.some((x) => /year/i.test(x)), tabs.join(' | '));
    ok('the account keeps "school" and the sample school trip follows the page (at least 100 students)', await p.evaluate(() => window.DemoStore.current().eventKind === 'school' && window.DemoStore.list('events')[0].kind === 'school' && window.DemoStore.list('events')[0].students >= 100));
    await goTab(p, 'event');
    const text = (await p.locator('#demo-panel').innerText()).replace(/\s+/g, ' ');
    ok('My event shows a school tour: students and chaperones, $11 each, the admission total', (await p.locator('[data-tour="acct-event"] .dvk-chip').innerText()).trim() === 'School tour' && /Sample Elementary, 2nd grade/.test(text) && /Admission total/.test(text) && /\$1,188/.test(text) && /Permission slips back/.test(text), text.slice(0, 300));
    const van = p.locator(`#demo-panel a[href="${VANESSA}"]`);
    ok('a school trip shows "Questions? Email Vanessa", a mailto link to the address the site already shows', await van.count() === 1 && (await van.innerText()).trim() === 'Questions? Email Vanessa');
    // the head count of a school trip is still a request (students and chaperones), with the page's minimum
    await p.fill('#demo-panel input[data-k="ev-students"]', '99');
    await p.fill('#demo-panel input[data-k="ev-guests"]', '8');
    await p.click('#demo-panel [data-k="ev-send"]');
    await p.waitForTimeout(250);
    ok('under 100 students is refused with the page\'s own rule, and nothing is sent', /minimum group size for a school tour is 100 students/.test(await p.locator('#demo-panel .dvk-err').first().innerText()) && await p.evaluate(() => window.DemoStore.list('requests').length === 0));
    await p.fill('#demo-panel input[data-k="ev-students"]', '102');
    await p.fill('#demo-panel input[data-k="ev-guests"]', '6');
    await p.click('#demo-panel [data-k="ev-send"]');
    await p.waitForSelector('[data-k="ev-status"]');
    ok('102 students and 6 chaperones is a request to Mrs. Cathy (students and guests), and the trip is not changed before her answer', await p.evaluate(() => { const r = window.DemoStore.list('requests')[0]; return r.kind === 'event-change' && r.status === 'waiting' && JSON.stringify(r.patch) === '{"students":102,"guests":6}' && /head count from 100 students and 8 chaperones to 102 students and 6 chaperones/.test(r.summary) && window.DemoStore.list('events')[0].students === 100; }));
    await axeOn(p, 'My event (a school trip, with a request waiting)', '#demo-panel');
    // all tabs: none of the words about how many times a family came, no telephone link on the screens of the contacts
    const seen = [];
    for (const name of ['visits', 'pizza', 'family', 'alerts', 'messages', 'photos', 'event']) {
      await goTab(p, name);
      seen.push([name, (await p.locator('#demo-panel').innerText()).replace(/\s+/g, ' ')]);
    }
    const counting = seen.filter(([, t]) => WORDS_OF_COUNTING.test(t)).map(([n, t]) => n + ': ' + (t.match(WORDS_OF_COUNTING) || [''])[0]);
    ok('no tab says how many times the family came: no "visits so far", "this year", badges, stamps, streaks or season pass', counting.length === 0, counting.join('; '));
    // My pizza and its editor
    await goTab(p, 'pizza');
    const ava = p.locator(`#demo-panel a[href="${AVA}"]`);
    ok('My pizza shows "Pizza questions? Email Ava", a mailto link to the address the site already shows', await ava.count() === 1 && (await ava.innerText()).trim() === 'Pizza questions? Email Ava');
    await axeOn(p, 'My pizza', '#demo-panel');
    await p.click('[data-pz-edit]');
    await p.waitForSelector('.dp-editor');
    await p.waitForTimeout(200);
    ok('while the family changes the order, the pizza editor shows the same line (once on the screen, not twice)', await p.locator(`#demo-panel a[href="${AVA}"]`).count() === 1 && await p.locator(`.dp-editor a[href="${AVA}"]`).count() === 1 && (await p.locator(`.dp-editor a[href="${AVA}"]`).innerText()).trim() === 'Pizza questions? Email Ava');
    await axeOn(p, 'the pizza editor', '#demo-panel');
    ok('no telephone link on My pizza, My event or the box of My family', await p.locator('#demo-panel a[href^="tel:"]').count() === 0);
    // the school trip is the only event: no "I also plan an event" link on My family
    await goTab(p, 'family');
    ok('a family that has an event does not see "I also plan an event"', await p.locator('.dvf-event').count() === 0);
    await p.context().close();
  }

  /* ---- My visits: the answer box, the closed day, the dialogs, and the tour's cards for them on the real screen ---- */
  {
    const p = await open(browser, base, 'account.html', errs, { query: 'demo' });
    await signUp(p, 'No');   // Pat, made by hand
    await p.evaluate(() => { window.WA_TOUR_STEPS = []; });
    await p.addScriptTag({ content: read('js/tour-steps-c.js') });   // the real cards of chapter 10, run against the real screen
    const card = (id, which) => p.evaluate(async ([i, w]) => { const st = window.WA_TOUR_STEPS.find((x) => x.id === i); if (!st || typeof st[w] !== 'function') return 'none'; await st[w]({}); return 'done'; }, [id, which]);
    const lit = async (id) => p.locator(await p.evaluate((i) => window.WA_TOUR_STEPS.find((x) => x.id === i).target, id)).first();
    const modals = () => p.locator('.demo-modal').count();
    const calm = () => p.evaluate(() => !document.documentElement.classList.contains('demo-modal-open'));
    const store = (fn, arg) => p.evaluate(fn, arg);
    const textOf = async (loc) => ((await loc.count()) ? (await loc.first().innerText()).replace(/\s+/g, ' ').trim() : '(not on the screen)');   // a missing box is a failed check, not a 20 second wait
    ok('the real chapter 10 is in the page: its cards (the original 24, and the cards added to show the pretend rush)', await p.evaluate(() => window.WA_TOUR_STEPS.length) >= 24);

    // a family made by hand is kept by the sign-up card and the card after it
    await card('ch10-signup', 'before');
    ok('the tour\'s sign-up card only signs the family out: the sign-up form shows, and Pat (made by hand) is still in the browser', await (await lit('ch10-signup')).isVisible()
      && await store(() => !window.DemoStore.current() && window.DemoStore.snapshot().accounts.length === 1 && window.DemoStore.snapshot().accounts[0].name === 'Pat'));
    await card('ch10-sample', 'before');
    ok('the next card signs Pat in again (no new sample family) and shows the visit', await (await lit('ch10-sample')).isVisible() && await store(() => !!window.DemoStore.current() && window.DemoStore.current().name === 'Pat' && window.DemoStore.current().eventKind === 'none'));

    // the sample card lights the whole visit card, which holds the same button: a dialog opened there is closed when the card is left too
    await p.locator('[data-tour="acct-visit-card"] [data-dv-request]').click();
    await p.waitForSelector('.demo-modal');
    await card('ch10-sample', 'after');
    ok('a dialog opened from the lit visit card (sample card) is closed when the card is left', await modals() === 0 && await calm());

    // the request dialog: opened by the lit button, closed when the card is left
    await card('ch10-request', 'before');
    const ask = await lit('ch10-request');
    ok('the request card lights the "Request a different day" button', await ask.isVisible() && (await ask.innerText()).trim() === 'Request a different day');
    await ask.click();
    await p.waitForSelector('.demo-modal');
    ok('the lit button opens a dialog', await modals() === 1);
    await card('ch10-request', 'after');
    ok('leaving the card closes it with the demo\'s own close: no dialog is left, the page is not marked as having one, the focus is back on the button, and no request was sent',
      await modals() === 0 && await calm() && await p.evaluate(() => !!document.activeElement && document.activeElement.getAttribute('data-tour') === 'acct-request-day') && await store(() => window.DemoStore.list('requests').length === 0));

    // two dialogs on top of each other (the request, and the Start over question), then the cards of the strip
    await ask.click();
    await p.waitForSelector('.demo-modal');
    await p.evaluate(() => document.querySelector('[data-tour="demo-reset"]').click());   // (the strip is behind the first dialog: pressed from the page)
    await p.waitForFunction(() => document.querySelectorAll('.demo-modal').length === 2);
    ok('DemoUI.closeModals() closes dialogs that sit on top of each other: two were open, none is left, and Start over was not done (Pat is still there)',
      await store(() => window.DemoUI.closeModals()) === 2 && await modals() === 0 && await calm() && await store(() => !!window.DemoStore.current() && window.DemoStore.current().name === 'Pat'));
    ok('with no dialog open it does nothing and says 0', await store(() => window.DemoUI.closeModals()) === 0);
    const strip = [];
    for (const id of ['ch10-intro', 'ch10-real-needs', 'ch10-worth-asking']) {
      await p.evaluate(() => document.querySelector('[data-tour="demo-reset"]').click());
      await p.waitForSelector('.demo-modal');
      const was = await modals();
      await card(id, 'after');
      if (!(was === 1 && await modals() === 0 && await calm() && await store(() => !!window.DemoStore.current()))) strip.push(id);
    }
    ok('the three cards that light the strip close the "Are you sure?" question of Start over when they are left, and nothing is cleared', strip.length === 0, strip.join(', '));

    // waiting, then the answer: the answer card finds its box (it used to be skipped), whatever the answer was
    await card('ch10-waiting', 'before');
    ok('the waiting card lights the waiting box, and while the request waits there is no answer box yet', await (await lit('ch10-waiting')).isVisible() && /Waiting for a reply from Mrs\. Cathy/.test(await textOf(await lit('ch10-waiting'))) && await p.locator('[data-tour="acct-reply"]').count() === 0);
    await card('ch10-answer', 'before');
    const answer = await lit('ch10-answer');
    ok('after the tour\'s yes the answer card finds its box and it says what happened', await p.locator('[data-tour="acct-reply"]').count() === 1 && await answer.isVisible() && /Mrs\. Cathy said yes\. Your visit is moved\./.test(await textOf(answer)), await textOf(answer));
    const drive = (how) => p.evaluate((h) => {
      const S = window.DemoStore, D = window.DemoData, v = S.list('visits').filter((x) => x.date >= S.today())[0];
      const day = S.openDays(D.addDays(S.today(), 1), v.package, 8).filter((d) => d !== v.date)[0], left = S.openRequestFor('visits', v.id);
      if (left) S.cancel(left.id);   // a suggestion left unanswered by the last state: the family cancels it first (a visit has one open request)
      const q = S.ask({ kind: 'visit-change', to: 'cathy', from: 'family', target: { coll: 'visits', id: v.id }, patch: { date: day, time: '13:00' }, summary: 'Move the visit', note: 'Another day works better.' });
      if (h === 'yes' || h === 'no') S.reply(q.id, { answer: h, note: 'Fine.' });
      if (h === 'suggested' || h === 'accepted' || h === 'declined') S.reply(q.id, { answer: 'suggest', note: 'How about this?', suggestion: { patch: { date: day, time: '12:00' }, summary: 'The same day at 12:00 pm' } });
      if (h === 'accepted') S.respond(q.id, 'ok');
      if (h === 'declined') S.respond(q.id, 'decline');
      return q.id;
    }, how);
    const states = [['yes', /Mrs\. Cathy said yes\. Your visit is moved\./], ['no', /Mrs\. Cathy said no\. Your visit stays as it was\./], ['suggested', /Mrs\. Cathy suggests something else/],
      ['accepted', /You said OK to Mrs\. Cathy’s plan\. Your visit is moved\./], ['declined', /You kept your visit as it was\./]];
    for (const [how, words] of states) {
      await drive(how);
      await p.waitForTimeout(300);
      const box = p.locator('[data-tour="acct-reply"]');
      ok(`the answer box has its tour hook when the state is "${how}": one box, on the screen, with the words for that state`, await box.count() === 1 && await box.first().isVisible() && words.test(await textOf(box)), (await textOf(box)).slice(0, 120));
    }

    // Pat said no to the event question, so the lit My family box has "I also plan an event", which opens a dialog: closed when the card is left
    await card('ch10-family', 'before');
    await p.locator('[data-tour="acct-family"] .dvf-event button').click();
    await p.waitForSelector('.demo-modal');
    await card('ch10-family', 'after');
    ok('a dialog opened from the lit My family box ("I also plan an event") is closed when the card is left, and no event was added', await modals() === 0 && await calm() && await store(() => window.DemoStore.list('events').length === 0));

    // a closed day: the card, the banner, the new-day box, and the other reasons
    await card('ch10-closed', 'before');
    const banner = await lit('ch10-closed');
    const said = () => textOf(p.locator('[data-tour="acct-closed-banner"] p'));
    const long = (d) => p.evaluate((x) => window.DemoUI.dateLong(x), d);
    const visitDay = () => store(() => { const S = window.DemoStore; return S.list('visits').filter((x) => x.date >= S.today())[0].date; });
    ok('the closed-day card lights the banner, and the tour closed the day for rain: "The farm is closed that day because of rain." (the reason is said once, in the sentence)', await banner.isVisible() && await said() === 'The farm is closed that day because of rain.', await said());
    await banner.locator('button').click();
    await p.waitForSelector('.demo-modal');
    const newDay = () => textOf(p.locator('.demo-modal .dv-form p'));
    ok('the new-day box says the same reason, with the day', await newDay() === 'The farm is closed on ' + await long(await visitDay()) + ' because of rain. Pick a new day and Mrs. Cathy will confirm it.', await newDay());
    await card('ch10-closed', 'after');
    ok('leaving the closed-day card closes that dialog too, and the day stays closed (nothing was sent)', await modals() === 0 && await calm() && await store(() => window.DemoStore.list('closedDays').length === 1 && window.DemoStore.list('requests').filter((r) => r.status === 'waiting').length === 0));
    const reasons = [['strong wind', 'strong wind'], ['a power cut', 'a power cut'], ['a holiday.', 'a holiday'], [undefined, 'weather'], ['  rain  ', 'rain']];
    const bad = [];
    for (const [given, shown] of reasons) {
      const day = await visitDay();
      await store((d) => window.DemoStore.openDay(d), day);
      await store(([d, r]) => window.DemoStore.closeDay(d, r), [day, given]);
      await p.waitForSelector('[data-tour="acct-closed-banner"]');
      await p.waitForTimeout(150);
      const b = await said();
      await p.locator('[data-tour="acct-closed-banner"] button').click();
      await p.waitForSelector('.demo-modal');
      const n = await newDay();
      await store(() => window.DemoUI.closeModals());
      if (b !== `The farm is closed that day because of ${shown}.` || n !== `The farm is closed on ${await long(day)} because of ${shown}. Pick a new day and Mrs. Cathy will confirm it.`) bad.push(`${given}: "${b}" / "${n}"`);
    }
    ok('closed for "strong wind", "a power cut", "a holiday." (the owner\'s full stop is not doubled), nothing given ("weather") or with spaces around it: the banner and the new-day box use that reason, once', bad.length === 0, bad.join(' | '));
    // an old record that is closed but has no reason written says weather
    await store(() => { const S = window.DemoStore, v = S.list('visits').filter((x) => x.date >= S.today())[0]; S.update('visits', v.id, { closed: true, closedReason: '' }); });
    await p.waitForTimeout(250);
    ok('a visit marked closed with no reason says "weather"', await said() === 'The farm is closed that day because of weather.', await said());

    // the real desk: close the day with its own form (Rain is its first choice), and read the three sentences
    await store((d) => { window.DemoStore.openDay(d); }, await visitDay());
    const desk = await p.context().newPage();
    desk.on('pageerror', (e) => errs.push('farm-desk.html pageerror: ' + e.message));
    await desk.clock.install({ time: new Date(TODAY) });
    await desk.goto(base + 'farm-desk.html?demo', { waitUntil: 'load' });
    await desk.waitForSelector('#ds-close-day', { timeout: 40000 });
    const day = await visitDay();
    await desk.selectOption('#ds-close-day', day);
    ok('the desk offers Rain first', await desk.inputValue('#ds-close-why') === 'rain');
    await desk.click('button:has-text("Close this day")');
    await desk.waitForSelector('.ds-confirm');
    const promise = (await desk.locator('.ds-confirm p').nth(1).innerText()).replace(/\s+/g, ' ');
    const quoted = (/“([^”]+)”/.exec(promise) || [])[1];
    await desk.click('button:has-text("Yes, close this day")');
    await p.waitForSelector('[data-tour="acct-closed-banner"]');
    await p.waitForTimeout(250);
    const notice = await store(() => window.DemoStore.noticesFor('family')[0].text);
    ok('what the desk promises the family is what the family\'s bell gets: "The farm is closed on <day> because of rain. Pick a new day for your visit."', quoted === 'The farm is closed on ' + await long(day) + ' because of rain. Pick a new day for your visit.' && notice === quoted, quoted + ' | ' + notice);
    ok('...and the banner and the new-day box say the same reason (rain)', await said() === 'The farm is closed that day because of rain.');
    await desk.close();
    await p.context().close();
  }

  /* ---- the toasts: a small message that fades by itself is taken away when a card is left (js/tour-steps-c.js on the real screen) ---- */
  {
    const p = await open(browser, base, 'account.html', errs, { query: 'demo' });
    await signUp(p, 'No');   // Pat, made by hand (the sign-up makes a toast of its own, "Account created...")
    await p.evaluate(() => { window.WA_TOUR_STEPS = []; });
    await p.addScriptTag({ content: read('js/tour-steps-c.js') });
    const card = (id, which) => p.evaluate(async ([i, w]) => { const st = window.WA_TOUR_STEPS.find((x) => x.id === i); if (!st || typeof st[w] !== 'function') return 'none'; await st[w]({}); return 'done'; }, [id, which]);
    const toasts = () => p.locator('[data-demo-toasts] .demo-toast').count();
    const store = (fn, arg) => p.evaluate(fn, arg);
    const whole = () => store(() => JSON.stringify(window.DemoStore.snapshot()));
    ok('every one of the cards of the real chapter 10 (the original 24 and the ones added since) has an after()', await store(() => window.WA_TOUR_STEPS.length >= 24 && window.WA_TOUR_STEPS.every((s) => typeof s.after === 'function')));
    await store(() => { window.DemoUI.clearToasts(); });   // the sign-up's own toast goes, so the next check sees only the toast of the notice

    // the real thing: a notice arrives while the page is open (the alert the tour sends on "The alert arrives") and the page makes a toast for it
    await card('ch10-bell', 'before');
    await p.waitForSelector('[data-demo-toasts] .demo-toast');
    const said = (await p.locator('[data-demo-toasts] .demo-toast').first().innerText()).trim();
    ok('a notice that arrives while the page is open makes one toast, with the notice\'s own words', await toasts() === 1 && said === await store(() => window.DemoStore.noticesFor('family')[0].text), said);
    const had = await whole();
    await card('ch10-bell', 'after');
    ok('leaving the card takes that toast away, and the demo is the same (nothing is sent, answered or read)', await toasts() === 0 && await whole() === had);

    // DemoUI.clearToasts() itself: only toasts go; a dialog that is open stays, and nothing is sent
    await store(() => { window.DemoUI.toast('First message', { ms: 60000 }); window.DemoUI.toast('Second message', { kind: 'info', ms: 60000 }); });
    await card('ch10-request', 'before');
    await p.locator('[data-tour="acct-request-day"]').first().click();
    await p.waitForSelector('.demo-modal');
    const asked = await store(() => window.DemoStore.list('requests').length);
    ok('two toasts and a dialog are on the screen', await toasts() === 2 && await p.locator('.demo-modal').count() === 1);
    ok('DemoUI.clearToasts() takes away both toasts and says 2; the open dialog stays open and no request was sent', await store(() => window.DemoUI.clearToasts()) === 2 && await toasts() === 0 && await p.locator('.demo-modal').count() === 1 && await store(() => window.DemoStore.list('requests').length) === asked);
    await store(() => window.DemoUI.closeModals());
    ok('with no toast on the screen it does nothing and says 0', await store(() => window.DemoUI.clearToasts()) === 0);

    // any card: an old toast that is still on the screen is gone when the card is left
    const ids = await store(() => window.WA_TOUR_STEPS.map((s) => s.id)), stuck = [];
    for (const id of ids) {
      await store(() => { window.DemoUI.toast('An old message', { ms: 60000 }); });
      if (await toasts() !== 1) { stuck.push(id + ' (no toast to begin with)'); continue; }
      await card(id, 'after');
      if (await toasts() !== 0) stuck.push(id);
    }
    ok('leaving any of the cards takes an old toast away', ids.length >= 24 && stuck.length === 0, ids.length + ' cards' + (stuck.length ? ', stuck: ' : '') + stuck.join(', '));
    await p.context().close();
  }

  /* ---- the kitchen screen ---- */
  {
    const p = await open(browser, base, 'kitchen.html', errs, { query: 'demo' });
    await p.waitForSelector('.kit-contact');
    const line = p.locator('.kit-contact');
    ok('the kitchen screen ends with a quiet line "Pizza kitchen contact: ava@wiseacresorganic.com" and the address is a mailto link', (await line.innerText()).trim() === 'Pizza kitchen contact: ava@wiseacresorganic.com' && await line.locator(`a[href="${AVA}"]`).count() === 1 && await p.locator('.kit a[href^="tel:"]').count() === 0);
    ok('it comes after the queue of orders', await p.evaluate(() => { const c = document.querySelector('.kit-contact'), q = document.querySelector('.kit-queue'); return !!(q.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING); }));
    await axeOn(p, 'the kitchen screen\'s contact line', '.kit-contact');
    // the kitchen confirms the sample order: the family gets its notice (DemoStore.postNotice, the store's own function)
    await p.evaluate(() => window.DemoStore.createAccount());
    await p.waitForSelector('[data-tour="kit-confirm"]', { timeout: 30000 });
    await p.click('[data-tour="kit-confirm"]');
    await p.waitForTimeout(300);
    ok('"Confirm order" on the kitchen screen makes the family a notice that leads to My pizza (the store function that makes notices works)', await p.evaluate(() => { const n = window.DemoStore.noticesFor('family')[0]; return !!n && /^The kitchen confirmed your pizza order for /.test(n.text) && n.link === '#pizza' && window.DemoStore.list('orders')[0].status === 'confirmed' && typeof window.DemoStore.notify === 'undefined' && typeof window.DemoStore.postNotice === 'function'; }));
    await p.context().close();
  }
  info('the axe checks ' + (axe ? 'ran' : 'did NOT run: axe-core was not found (set AXE_PATH to its axe.min.js)'));
});
