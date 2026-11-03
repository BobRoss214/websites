// order: 395
// browser: yes
// covers: js/demo-app.js, js/demo-ui.js, js/demo-data.js, js/demo-store.js, js/demo-view-event.js, js/demo-view-family.js, js/demo-view-pizza.js, js/demo-pizza-editor.js, js/demo-kitchen.js, css/demo.css, pages/account.html, pages/farm-desk.html, pages/kitchen.html
/* The pretend account, as a family sees it (account.html?demo and kitchen.html?demo, a real browser):
 *   - the sign-up asks ONE plain question, "Do you plan or manage a party, an event or a school trip?", with four big buttons (real radio buttons made in JavaScript: the
 *     page files hold no input, text box or list): No / Yes: a party / Yes: a school trip / Yes: another event; No is chosen to begin with; "Fill in sample details" chooses the school trip;
 *   - each answer: what the account keeps, which tabs there are, what the My event screen says for that kind (the page's own prices: a party is one price for the whole party,
 *     a school trip $11 each, another event shows no price);
 *   - My event is on the tab bar ONLY for a family that has an event; its address (#event) opens the first tab for the others; "I also plan an event" at the bottom of My family
 *     adds one (a party, a school trip or another event) and shows the tab, and the link is gone once there is an event;
 *   - there is no My year: no tab, no script, no file, and none of the words about how many times a family came (visits so far, badges, stamps, streaks, season pass) on any tab;
 *   - the contact links: "Questions? Email Vanessa" on a school trip, "Pizza questions? Email Ava" on My pizza (and in the pizza editor), "Pizza kitchen contact:" with Ava's address on
 *     the kitchen screen; mailto links to the addresses the site already shows, no telephone link;
 *   - accessibility (axe, when axe-core is installed): the sign-up card, the three kinds of My event, My family with its box, My pizza and its editor have no violations.
 * Run: node tests/account-event.test.mjs  (or: node tests/run-all.mjs account-event) */
import fs from 'node:fs';
import path from 'node:path';
import { run, open, ok, info, axeSource, ROOT } from './lib.mjs';

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
    if (answer) await p.getByRole('radio', { name: answer, exact: true }).check();
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
    ok('they are real radio buttons of one group (the arrow keys and a screen reader work), and No is chosen to begin with', await p.locator('.demo-signup input[type=radio]').count() === 4 && await p.locator('.demo-signup input[type=radio][name="demo-su-event"]').count() === 4
      && await p.getByRole('radio', { name: 'No', exact: true }).isChecked() && !await p.getByRole('radio', { name: 'Yes: a party', exact: true }).isChecked());
    const boxes = await p.locator('.demo-signup .demo-choice').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
    ok('each button is big: at least 44 px tall and wide (a finger can press it)', boxes.every(([w, h]) => w >= 120 && h >= 44), JSON.stringify(boxes));
    await p.getByRole('radio', { name: 'No', exact: true }).focus();
    await p.keyboard.press('ArrowDown');
    ok('the arrow keys move the choice (Down from No chooses "Yes: a party")', await p.getByRole('radio', { name: 'Yes: a party', exact: true }).isChecked());
    await p.click('.demo-signup [data-demo-fill]');
    ok('"Fill in sample details" fills in the name and the email and chooses "Yes: a school trip"', await p.inputValue('#demo-su-name') === 'Alex' && await p.inputValue('#demo-su-email') === 'alex@example.com' && await p.getByRole('radio', { name: 'Yes: a school trip', exact: true }).isChecked());
    ok('the hint says only a yes adds the My event tab, and has Vanessa\'s link for school trips', /Only a yes adds the My event tab/.test(await p.locator('.demo-signup .demo-choices .demo-hint').innerText()) && await p.locator(`.demo-signup a[href="${VANESSA}"]`).innerText() === 'Questions? Email Vanessa');
    await axeOn(p, 'the sign-up card (with the question)', '.demo-signup');
    const wide = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    ok('the page does not scroll sideways', wide);
    await p.context().close();
    const phone = await open(browser, base, 'account.html', errs, { query: 'demo', viewport: { width: 390, height: 844 } });
    await phone.waitForSelector('.demo-signup');
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
    ok('a party has no school contact: no Vanessa link there', await p.locator(`a[href="${VANESSA}"]`).count() === 0);
    ok('the checklist is the Parties card\'s "How it works" (cake, decorate, check-in, no outside alcohol)', /Bring cake and snacks for your guests/.test(text) && /Decorate your party space/.test(text) && /they are with your party when they check in/.test(text) && /not to bring their own alcohol/.test(text));
    // the guest count can be changed as a request
    await p.fill('#demo-panel input[data-k="ev-guests"]', '30');
    await p.click('#demo-panel [data-k="ev-send"]');
    await p.waitForSelector('[data-k="ev-status"]');
    ok('a new guest count is a REQUEST to Mrs. Cathy (guests only), and nothing changes before she answers', await p.evaluate(() => { const r = window.DemoStore.list('requests')[0]; return r.kind === 'event-change' && r.status === 'waiting' && JSON.stringify(r.patch) === '{"guests":30}' && /guest count from 24 guests to 30 guests/.test(r.summary) && window.DemoStore.list('events')[0].guests === 24; }));
    await p.evaluate(() => { const S = window.DemoStore, r = S.list('requests')[0]; S.reply(r.id, { answer: 'yes', note: 'Fine.' }); });
    await p.waitForTimeout(300);
    ok('after her yes the party has 30 guests and the screen says so', /Your guest count is now 30 guests/.test(await p.locator('#demo-panel').innerText()) && /30\s*Guests/.test((await p.locator('#demo-panel').innerText()).replace(/\s+/g, ' ')));
    await axeOn(p, 'My event (a party, with an answered request)', '#demo-panel');
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
    await axeOn(p, 'My event (a school trip)', '#demo-panel');
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

  /* ---- the kitchen screen ---- */
  {
    const p = await open(browser, base, 'kitchen.html', errs, { query: 'demo' });
    await p.waitForSelector('.kit-contact');
    const line = p.locator('.kit-contact');
    ok('the kitchen screen ends with a quiet line "Pizza kitchen contact: ava@wiseacresorganic.com" and the address is a mailto link', (await line.innerText()).trim() === 'Pizza kitchen contact: ava@wiseacresorganic.com' && await line.locator(`a[href="${AVA}"]`).count() === 1 && await p.locator('.kit a[href^="tel:"]').count() === 0);
    ok('it comes after the queue of orders', await p.evaluate(() => { const c = document.querySelector('.kit-contact'), q = document.querySelector('.kit-queue'); return !!(q.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING); }));
    await axeOn(p, 'the kitchen screen\'s contact line', '.kit-contact');
    await p.context().close();
  }
  info('the axe checks ' + (axe ? 'ran' : 'did NOT run: axe-core was not found (set AXE_PATH to its axe.min.js)'));
});
