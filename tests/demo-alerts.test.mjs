// order: 87
// browser: yes
// quick: no
// covers: js/demo-view-alerts.js, js/demo-view-kit.js, js/demo-store.js, js/demo-data.js, js/demo-desk.js, account.html, pages/account.html
/* The "Tell me when" screen of the account demo (account.html#alerts) in a real browser. The demo is pretend: nothing is sent, so this looks at what the family sees and
 * at what the pretend account keeps. Checked, on a computer window and on a phone:
 *   - the order: "Where should we send these messages?" at the top, then "A spot opens on a full day", "Reservations open", strawberries, blueberries and sunflowers,
 *     pumpkins and tomatoes, Christmas trees, then "Alerts you got" (the words come from DemoData.alertKinds, so the screen and the data cannot drift apart);
 *   - the two big switches: "Text message" with the pretend phone number and "Email" with the account's email, both on at the start, each at least 44 px high, named for
 *     a screen reader as switches with their state, worked with the mouse and with the keyboard (Space and Enter), the focus stays on the one that was pressed;
 *   - one or both can be on, and the last one cannot be turned off: it stays on and a short friendly note says why (it is read out politely, and it goes when another
 *     way is turned on); the choice is kept in the pretend account (a reload, a second window);
 *   - "A spot opens on a full day" still works with a day to choose (a waitlist entry, the desk's count and its "A spot opened on <day>." alert), "Reservations open" is a
 *     second, separate switch that the desk counts and sends, and the four seasons are unchanged;
 *   - no sideways scroll on a phone, and axe-core (WCAG 2.0 and 2.1 A and AA) finds nothing on the screen.
 * The store's own rules are in tests/demo-store.test.mjs (no browser). Run: node tests/demo-alerts.test.mjs */
import { run, open, ok, okSoon, settled, until, axeSource, info } from './lib.mjs';

const NOW = '2026-11-03T12:00:00-05:00';   // a Tuesday in the fall: the next days the farm offers are Thursday Nov 5 to Sunday Nov 8
const PHONE = '(555) 010-0123';
const LABELS = ['A spot opens on a full day', 'Reservations open', 'Strawberries open', 'Blueberries and sunflowers open', 'Pumpkins and tomatoes open', 'Christmas trees arrive'];
const KEEP = 'Keep at least one on, so we can reach you.';
const axe = axeSource();

const text = (p, name) => p.getByRole('switch', { name, exact: true });
const email = (p) => text(p, 'Email alex@example.com');
const sms = (p) => text(p, 'Text message ' + PHONE);
const checked = (loc) => loc.getAttribute('aria-checked');
const way = (p) => p.evaluate(() => JSON.stringify(window.DemoStore.getNotify()));
const toasts = (p) => p.evaluate(() => [...document.querySelectorAll('.demo-toast')].map((t) => t.textContent.trim()));
const focused = (p) => p.evaluate(() => (document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-k')) || '');
const gotList = (p) => p.evaluate(() => [...document.querySelectorAll('[data-tour="acct-alerts"] .dva-got li span:first-child')].map((s) => s.textContent.trim()));

async function family(browser, base, errs, viewport, who = { name: 'Alex', email: 'alex@example.com' }) {
  const p = await open(browser, base, 'account.html', errs, { viewport, time: NOW, query: 'demo' });
  await p.evaluate((w) => { window.DemoStore.createAccount(w); }, who);
  await settled(p);
  await p.evaluate(() => { window.location.hash = '#alerts'; });
  await until(p, () => !!document.querySelector('[data-tour="acct-alerts"]'), null, 15000);
  await settled(p);
  return p;
}

await run('demo-alerts', async ({ browser, base, errs }) => {
  /* ------------------------------------------------------------------ the computer window */
  const p = await family(browser, base, errs, { width: 1280, height: 900 });
  const names = await p.evaluate(() => window.DemoData.alertKinds.map((k) => k.label));
  ok('the screen is the "Tell me when" tab, and the words of the choices are the ones in DemoData.alertKinds, in the order the family should see them', JSON.stringify(names) === JSON.stringify(LABELS) && (await p.evaluate(() => document.querySelector('.demo-view-title').textContent.trim())) === 'Tell me when', names.join(' | '));
  const heads = await p.evaluate(() => [...document.querySelectorAll('[data-tour="acct-alerts"] h3')].map((h) => { const r = h.getBoundingClientRect(); return { t: h.textContent.trim(), top: Math.round(r.top), left: Math.round(r.left) }; }));
  ok('top to bottom: where to send the messages first, then the six choices in order, then the alerts the family got', JSON.stringify(heads.map((x) => x.t)) === JSON.stringify(['Where should we send these messages?', ...LABELS, 'Alerts you got']), heads.map((x) => x.t).join(' | '));
  ok('on a computer window "A spot opens on a full day" and "Reservations open" sit side by side, at the top of the choices, above the four seasons', heads[1].top === heads[2].top && heads[1].left < heads[2].left && heads[3].top > heads[1].top && heads[0].top < heads[1].top, JSON.stringify(heads.slice(0, 4)));

  // the two big switches
  const sw = await p.evaluate(() => [...document.querySelectorAll('.dva-way button')].map((b) => { const r = b.getBoundingClientRect(); return { role: b.getAttribute('role'), checked: b.getAttribute('aria-checked'), w: Math.round(r.width), h: Math.round(r.height), text: b.textContent.replace(/\s+/g, ' ').trim() }; }));
  ok('two big switch buttons under the question: "Text message" with the pretend phone number and "Email" with the account email, in that order, both on', sw.length === 2 && sw.every((s) => s.role === 'switch' && s.checked === 'true') && /^Text message\s*\(555\) 010-0123\s*On$/.test(sw[0].text) && /^Email\s*alex@example\.com\s*On$/.test(sw[1].text), JSON.stringify(sw));
  ok('each is a big target: at least 44 px high (and wide), as the other switches of the demo are', sw.every((s) => s.h >= 44 && s.w >= 150), JSON.stringify(sw.map((s) => s.w + 'x' + s.h)));
  ok('a screen reader meets them as switches named "Text message (555) 010-0123" and "Email alex@example.com", both on, inside a group that is named by the question',
    (await sms(p).count()) === 1 && (await email(p).count()) === 1 && (await checked(sms(p))) === 'true' && (await checked(email(p))) === 'true' && (await p.evaluate(() => { const b = document.querySelector('.dva-way button'); const s = b.closest('section'); return !!s && s.getAttribute('aria-labelledby') && document.getElementById(s.getAttribute('aria-labelledby')).textContent === 'Where should we send these messages?'; })));
  ok('the pretend phone number is the sample one and the account keeps both ways on at the start', (await p.evaluate(() => window.DemoStore.get('family').phone)) === PHONE && (await way(p)) === '{"text":true,"email":true}');
  ok('there is no note at the start, and the note place is a polite status line', (await p.evaluate(() => { const n = document.querySelector('.dva-way-note'); return !!n && n.getAttribute('role') === 'status' && n.textContent === ''; })));

  // the mouse: turn email off, then try the last way
  await email(p).click();
  await settled(p);
  ok('pressing "Email" turns it off: the switch says Off, text stays on, and the pretend account keeps it', (await checked(email(p))) === 'false' && (await checked(sms(p))) === 'true' && (await way(p)) === '{"text":true,"email":false}');
  ok('a message says what will happen, in plain words', (await toasts(p)).some((t) => t === 'We will send your messages by text message only.'), (await toasts(p)).join(' | '));
  await okSoon('the keyboard focus is still on the switch that was pressed (the screen was drawn again)', () => focused(p), (k) => k === 'notify-email');
  const told = (await toasts(p)).length;
  await sms(p).click();
  await settled(p);
  const note = p.locator('.dva-way-note');
  ok('pressing the last way that is on ("Text message") changes nothing: it stays on, and a short friendly note appears', (await checked(sms(p))) === 'true' && (await checked(email(p))) === 'false' && (await way(p)) === '{"text":true,"email":false}' && (await note.textContent()) === KEEP && (await note.isVisible()), await note.textContent());
  ok('the focus stays on that switch, and nothing was saved or announced as a change', (await focused(p)) === 'notify-text' && (await toasts(p)).length === told);
  await sms(p).click();
  ok('pressing it again leaves the note there, and the switch on', (await note.textContent()) === KEEP && (await checked(sms(p))) === 'true' && (await way(p)) === '{"text":true,"email":false}');
  await email(p).click();
  await settled(p);
  ok('turning "Email" on again: both are on, the note is gone, the account keeps both', (await checked(email(p))) === 'true' && (await checked(sms(p))) === 'true' && (await way(p)) === '{"text":true,"email":true}' && (await p.locator('.dva-way-note').textContent()) === '' && (await toasts(p)).some((t) => t === 'We will send your messages by text message and email.'));

  // the keyboard
  await email(p).focus();
  await p.keyboard.press('Space');
  await settled(p);
  ok('the keyboard: Space on "Email" turns it off', (await checked(email(p))) === 'false' && (await way(p)) === '{"text":true,"email":false}');
  await okSoon('...and the focus is still on it', () => focused(p), (k) => k === 'notify-email');
  await p.keyboard.press('Enter');
  await settled(p);
  ok('the keyboard: Enter turns it on again', (await checked(email(p))) === 'true' && (await way(p)) === '{"text":true,"email":true}');
  ok('the order the keyboard goes through: the two switches, then the first choice and its day box, before the other choices', (await p.evaluate(() => { const els = [...document.querySelectorAll('[data-tour="acct-alerts"] button, [data-tour="acct-alerts"] select')]; return els.slice(0, 4).map((e) => e.getAttribute('data-k') || e.textContent.trim().slice(0, 12)); })).join() === 'notify-text,notify-email,alert-spot,alert-spot-day');

  // one way only, then a reload: the choice is kept
  await sms(p).click();
  await settled(p);
  ok('"Text message" turned off: email is the one way left', (await checked(sms(p))) === 'false' && (await checked(email(p))) === 'true' && (await way(p)) === '{"text":false,"email":true}');
  await p.reload({ waitUntil: 'load' });
  await until(p, () => !!document.querySelector('[data-tour="acct-alerts"]'), null, 15000);
  await settled(p, 600);
  ok('after a reload the pretend account still sends by email only, the switches show it, and there is no old note', (await way(p)) === '{"text":false,"email":true}' && (await checked(sms(p))) === 'false' && (await checked(email(p))) === 'true' && (await p.locator('.dva-way-note').textContent()) === '');

  // the choices
  await p.evaluate(() => { window.DemoStore.setNotify({ text: true, email: true }); });
  await settled(p);
  const choices = await p.evaluate(() => [...document.querySelectorAll('.dva-list > li')].map((li) => ({ t: li.querySelector('h3').textContent.trim(), note: (li.querySelector('.dvk-note') || {}).textContent, sw: li.querySelector('[role="switch"]').getAttribute('aria-checked'), art: !!li.querySelector('.dva-art svg') })));
  ok('six cards, every switch off at the start, each with its picture and a line of words', choices.length === 6 && choices.every((c) => c.sw === 'false' && c.art && c.note), JSON.stringify(choices.map((c) => c.sw)));
  ok('"Reservations open" says only what the site says about it', choices[1].note === 'A notice when new reservations open. Reservations with pizza open every Tuesday at 5:00 PM for the upcoming weekend.', choices[1].note);
  ok('the four seasons keep their words', choices.slice(2).map((c) => c.note).join('|') === 'A notice when strawberry picking opens.|A notice when blueberry and sunflower picking opens.|A notice when pumpkin and tomato picking opens.|A notice when the Christmas trees arrive.');

  // reservations: its own switch, counted and sent by the desk (a second window of the same browser)
  await text(p, 'Reservations open').click();
  await settled(p);
  ok('"Reservations open" is a switch of its own: on, saved as alerts.reservations, and the full-day switch is not touched', (await checked(text(p, 'Reservations open'))) === 'true' && (await p.evaluate(() => { const a = window.DemoStore.get('alerts'); return a.reservations === true && !a.spot; })) && (await toasts(p)).some((t) => t === 'On: Reservations open. You will see it under the bell.'));

  // the full day: a day to choose, the waitlist, the desk
  const spot = text(p, 'A spot opens on a full day');
  const pick = p.locator('[data-k="alert-spot-day"]');
  ok('"A spot opens on a full day": off at the start, and the day box waits (it cannot be used until the switch is on)', (await checked(spot)) === 'false' && (await pick.isDisabled()));
  await spot.click();
  await settled(p);
  const first = await p.evaluate(() => window.DemoStore.list('waitlist').filter((w) => w.active !== false).map((w) => w.day));
  ok('turning it on puts the family on the waitlist for the first day offered (Thursday, Nov 5) and opens the day box', (await checked(spot)) === 'true' && first.join() === '2026-11-05' && !(await pick.isDisabled()) && (await pick.inputValue()) === '2026-11-05');
  await pick.selectOption('2026-11-06');
  await pick.blur();   // the screen is not drawn again while a box has the focus: the family has moved on
  await settled(p);
  const waits = await p.evaluate(() => ({ all: window.DemoStore.list('waitlist').map((w) => w.day + ':' + (w.active !== false)), counts: window.DemoStore.alertCounts() }));
  ok('choosing another day moves the waitlist entry (the old one is switched off, nothing deleted), and the desk counts one family for that day', waits.all.join() === '2026-11-05:false,2026-11-06:true' && waits.counts.spot === 1 && waits.counts.days['2026-11-06'] === 1 && waits.counts.reservations === 1, JSON.stringify(waits));

  const desk = await p.context().newPage();
  desk.on('pageerror', (e) => errs.push('desk pageerror: ' + e.message));
  await desk.goto(base + 'farm-desk.html?demo', { waitUntil: 'load' });
  await desk.clock.runFor(1500);
  const rows = () => desk.evaluate(() => [...document.querySelectorAll('[data-tour="desk-people"] .ds-person')].map((li) => ({ t: li.querySelector('strong').textContent.trim(), n: li.querySelector('.ds-person-n').textContent.trim(), can: !li.querySelector('button').disabled })));
  await okSoon('the desk lists "Reservations open" and the chosen day among the people waiting, with one family each', async () => { await desk.clock.runFor(200); return rows(); },
    (r) => r.some((x) => x.t === 'Reservations open' && /^1 family is waiting/.test(x.n) && x.can) && r.some((x) => x.t === 'A spot opens on Friday, Nov 6' && /^1 family is waiting/.test(x.n) && x.can));
  const labels = (await rows()).map((x) => x.t);
  ok('the desk shows every choice once: the four seasons and reservations, then a line for each day somebody waits for', JSON.stringify(labels) === JSON.stringify(['Reservations open', 'Strawberries open', 'Blueberries and sunflowers open', 'Pumpkins and tomatoes open', 'Christmas trees arrive', 'A spot opens on Friday, Nov 6']), labels.join(' | '));
  await desk.locator('.ds-person', { hasText: 'Reservations open' }).getByRole('button', { name: /Send the alert/ }).click();
  await desk.locator('.ds-person', { hasText: 'A spot opens on Friday, Nov 6' }).getByRole('button', { name: /Send the alert/ }).click();
  await desk.clock.runFor(300);
  await okSoon('the alerts reach the family: both are listed under "Alerts you got" with the farm\'s words, and the bell counts them', async () => { await settled(p); return gotList(p); },
    (g) => g.includes('New reservations are open at Wise Acres.') && g.includes('A spot opened on Friday, Nov 6.'));
  ok('the sent days switch off by themselves: the full-day switch is Off again and nobody is waiting; reservations stay on', (await checked(spot)) === 'false' && (await p.evaluate(() => window.DemoStore.alertCounts().spot)) === 0 && (await checked(text(p, 'Reservations open'))) === 'true');
  await desk.close();

  // a family that typed its own name and email: the sample phone is used, and its own email is shown
  const other = await family(browser, base, errs, { width: 1280, height: 900 }, { name: 'Pat', email: 'pat@example.com' });
  ok('a family that signed up with its own name and email still has a pretend phone number to show (the sample one), and its own email', (await text(other, 'Text message ' + PHONE).count()) === 1 && (await text(other, 'Email pat@example.com').count()) === 1);
  await other.context().close();

  // accessibility on the computer window
  if (axe) {
    await p.evaluate(axe);
    const bad = await p.evaluate(async () => (await window.axe.run(document.querySelector('[data-tour="acct-alerts"]'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } })).violations.map((v) => v.id + ' [' + v.impact + '] ' + v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' ; ')));
    ok('axe-core finds nothing on the screen (computer window)', bad.length === 0, bad.join(' | '));
    const proof = await p.evaluate(async () => {   // prove that axe really looks: a picture with no text alternative put on the screen for a moment is reported
      const host = document.querySelector('[data-tour="acct-alerts"]');
      host.insertAdjacentHTML('beforeend', '<img id="axe-self-test" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">');
      const ids = (await window.axe.run(host, { runOnly: { type: 'tag', values: ['wcag2a'] } })).violations.map((v) => v.id);
      document.getElementById('axe-self-test').remove();
      return ids;
    });
    ok('axe really runs here: it reports a deliberate mistake (an image with no text alternative)', proof.includes('image-alt'), proof.join(','));
    await p.evaluate(() => { window.DemoStore.setNotify({ text: true, email: true }); });
    await settled(p);
    await sms(p).click();     // text off: email is the last way left
    await email(p).click();   // refused: the note shows
    await settled(p);
    const bad2 = await p.evaluate(async () => (await window.axe.run(document.querySelector('[data-tour="acct-alerts"]'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } })).violations.map((v) => v.id + ' [' + v.impact + '] ' + v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' ; ')));
    ok('...and nothing with a switch off and the friendly note showing', (await note.textContent()) === KEEP && bad2.length === 0, bad2.join(' | '));
  } else info('axe-core is not installed: the accessibility check was left out (npm i -D axe-core)');
  await p.context().close();

  /* ------------------------------------------------------------------ the phone */
  const ph = await family(browser, base, errs, { width: 390, height: 844 });
  const m = await ph.evaluate(() => {
    const sws = [...document.querySelectorAll('.dva-way button')].map((b) => { const r = b.getBoundingClientRect(); return { top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) }; });
    const heads = [...document.querySelectorAll('[data-tour="acct-alerts"] h3')].map((h) => h.textContent.trim());
    return { sws, heads, wide: document.documentElement.scrollWidth - window.innerWidth };
  });
  ok('on a phone the two switches are one above the other, each as wide as the card, at least 44 px high, in the same order', m.sws.length === 2 && m.sws[1].top > m.sws[0].top && m.sws[0].left === m.sws[1].left && m.sws.every((s) => s.w >= 250 && s.h >= 44) && JSON.stringify(m.heads) === JSON.stringify(['Where should we send these messages?', ...LABELS, 'Alerts you got']), JSON.stringify(m));
  ok('no sideways scrolling on a phone (the long email and the day box fit)', m.wide <= 1, m.wide + ' px too wide');
  await ph.getByRole('switch', { name: 'Email alex@example.com', exact: true }).click();
  await settled(ph);
  ok('a phone: the same switches work', (await way(ph)) === '{"text":true,"email":false}');
  if (axe) {
    await ph.evaluate(axe);
    const bad = await ph.evaluate(async () => (await window.axe.run(document.querySelector('[data-tour="acct-alerts"]'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } })).violations.map((v) => v.id + ' [' + v.impact + '] ' + v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' ; ')));
    ok('axe-core finds nothing on the screen (phone)', bad.length === 0, bad.join(' | '));
  }
  await ph.context().close();
});
