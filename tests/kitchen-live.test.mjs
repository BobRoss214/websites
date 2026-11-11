// order: 88
// browser: yes
// quick: no
// covers: js/demo-kitchen.js, js/demo-live.js, js/demo-store.js, css/demo-kitchen.css, pages/kitchen.html, kitchen.html
/* The pizza kitchen of the account demo (kitchen.html?demo) in a real browser, with a fake page clock (it also runs by itself, so the checks look at stages and at
 * differences, never at an exact second). The demo is pretend. Checked on a computer window:
 *   - the screen before anything is there: the counters (waiting, answered, late), the clock, the Sound button (off, with its note), the pretend rush strip (off, with a way to
 *     start it) and a calm empty message with a big "Start the pretend rush" button;
 *   - the sample family's change to its pizza order is a ticket: big order number, the family, the old time and the asked time, the allergy note, an answer-by timer, three big buttons
 *     (Yes, No, Another time) at least 72 px high with their keys written on them;
 *   - with the rush on, pretend tickets come in (a new order and a change have their own buttons: a new order has no No); the Off button pauses everything, the timers too;
 *   - ONE press answers: the 1, 2 and 3 keys, the buttons, a tap; the next ticket that needs an answer gets the focus by itself ("keep rolling"); the arrow keys move between
 *     tickets; the answered ticket leaves the list and the counter counts it; an answer to a pretend family tells nobody in the family's bell;
 *   - the small editor: Another time (key 3) opens it with the time in focus, +5 +10 +15 and the plus and minus keys change the time, Enter sends, Esc closes it and sends nothing, and
 *     it does not send when nothing changed;
 *   - the timer goes green, amber, red, and when time is up the ticket is Late, turns red, goes to the top and stays there while others come;
 *   - the sound: nothing plays (not even an audio context) until Sound is pressed; then a chime for tickets that arrive, a gentle beep that repeats while any is late, none while the
 *     rush is paused, none after muting (the Sound button, or the M key);
 *   - a screen reader: a polite status line says a ticket arrived, was answered, is late; the timer is a timer that does not chatter; the buttons say their keys;
 *   - the first screen at 1366 x 768, 1024 x 768 and 1920 x 1080: when the page opens with tickets, after a reload and after pressing On, the first ticket's pizzas and its three
 *     answer buttons are fully on the screen, under what sticks to the top; at 1366 the type is big (pizza names 34 px, the table of a change too), the strip with Waiting, Late and
 *     Sound sticks under the site's header, a ticket that gets the focus goes to the top of the board, the editor names its order and the tab title shows the count;
 *   - the keys: a key held down answers one ticket only; the Keys button under the board turns the number and letter keys off (and the key marks and the key hints go with
 *     them) and on again; the small tickets of the side lanes are not made again on every pass; a tab nobody can see makes no chime and no beep;
 *   - reduced motion: the late ticket does not pulse; a phone with touch: the buttons stay big, nothing scrolls sideways, a tap answers; a second window sees an answer;
 *   - axe-core finds nothing on the screen with tickets, with the editor open and with a late ticket.
 * Set KL_SHOTS=/some/folder to save screenshots of the states while it runs. Run: node tests/kitchen-live.test.mjs */
import fs from 'node:fs';
import { run, open, ok, okSoon, settled, until, axeSource, info } from './lib.mjs';

const NOW = '2026-11-10T12:00:00-05:00';   // a Tuesday noon in New York
const SHOTS = process.env.KL_SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const axe = axeSource();

// A fake audio the page cannot tell from the real one: it counts what is made and played.
const FAKE_AUDIO = `
  window.__audio = { contexts: 0, osc: 0, started: 0, resumed: 0 };
  window.AudioContext = class { constructor() { window.__audio.contexts++; this.currentTime = 0; this.destination = {}; this.state = 'suspended'; }
    createOscillator() { window.__audio.osc++; return { type: '', frequency: { value: 0 }, connect() {}, start() { window.__audio.started++; }, stop() {} }; }
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} }; }
    resume() { window.__audio.resumed++; this.state = 'running'; return Promise.resolve(); } };`;

const audio = (p) => p.evaluate(() => ({ ...window.__audio }));
const shot = async (p, name, full = false) => { if (SHOTS) await p.screenshot({ path: SHOTS + '/' + name + '.png', fullPage: full }); };
const rail = (p) => p.evaluate(() => [...document.querySelectorAll('.kit-rail > .kit-ticket')].map((li) => ({
  key: li.getAttribute('data-key'), num: li.querySelector('.kit-num').textContent, who: li.querySelector('.kit-name').textContent, kind: li.classList.contains('kit-k-change') ? 'change' : 'order',
  late: li.classList.contains('kit-late'), timer: li.querySelector('.kit-timer-text') ? li.querySelector('.kit-timer-text').textContent : '', stage: (li.querySelector('.kit-timer').className.match(/kit-tm-(green|amber|red)/) || [])[1] || '',
  focused: document.activeElement === li, current: li.classList.contains('kit-current'), buttons: [...li.querySelectorAll('.kit-ans')].map((b) => b.getAttribute('data-act')) })));
const tally = (p) => p.evaluate(() => [...document.querySelectorAll('.kit-tally-item')].map((x) => Number(x.querySelector('.kit-tally-num').textContent)));
const said = async (p) => { await p.clock.runFor(400); return p.evaluate(() => document.querySelector('.kit .sr-only[role="status"]').textContent); };   // the status line fills a moment after the change
const press = async (p, key) => { await p.keyboard.press(key); await settled(p, 60); };
const secsOf = (text) => { const m = /(\d+):(\d\d)/.exec(text); return m ? +m[1] * 60 + +m[2] : NaN; };
async function axeOn(p, name, selector) {
  if (!axe) return;
  await p.addScriptTag({ content: axe });
  const r = await p.evaluate(async (sel) => { const res = await window.axe.run(sel, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }); return res.violations.map((v) => v.id + ': ' + v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')); }, selector);
  ok('axe-core finds nothing on ' + name, r.length === 0, r.join(' || '));
}

async function openKitchen(browser, base, errs, opts = {}) {
  const p = await open(browser, base, 'kitchen.html', errs, { viewport: opts.viewport || { width: 1280, height: 900 }, time: NOW, query: 'demo', touch: opts.touch, reducedMotion: opts.reducedMotion, routes: async (pg) => { await pg.addInitScript(FAKE_AUDIO); } });
  await until(p, () => !!document.querySelector('.kit .kit-top'), null, 20000);
  await settled(p);
  return p;
}
const sampleChange = (p) => p.evaluate(() => {   // the sample family asks the kitchen for an earlier time
  const S = window.DemoStore, D = window.DemoData;
  S.createAccount();
  const o = S.list('orders')[0], v = S.list('visits')[0];
  return S.ask({ kind: 'pizza-change', to: 'kitchen', from: 'family', target: { coll: 'orders', id: o.id }, patch: { pizzas: o.pizzas, pickup: D.addMinutes(v.time, 30) }, summary: 'Pizza ready earlier', note: 'Could the pizza be ready a little earlier?' }).id;
});
const freshWorld = (p) => p.evaluate(() => { window.DemoLive.stop(); window.DemoLive.clear(); window.DemoStore.reset(); });
// One section of the test: a failure inside it is one FAIL line and the next section still runs (a browser run is long: it must tell everything at once).
async function section(name, fn) {
  try { await fn(); } catch (e) { ok(name + ': the section ran to the end', false, String(e && e.message ? e.message : e).split('\n').slice(0, 7).join(' / ')); }
}
// A press on the pretend rush strip. A press that does not work says why (what covers the button, where the page is scrolled) and then goes on with the button's own click.
async function clickLive(p, which) {
  await p.evaluate(() => window.scrollTo(0, 0));
  try { await p.locator('[data-dl="' + which + '"]').click({ timeout: 6000 }); }
  catch (e) {
    const why = await p.evaluate((w) => { const b = document.querySelector('[data-dl="' + w + '"]'); const r = b && b.getBoundingClientRect(); const hit = r && document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return JSON.stringify({ found: document.querySelectorAll('[data-dl="' + w + '"]').length, rect: r && [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], hit: hit && (hit.tagName + '.' + String(hit.className).slice(0, 40)), scrollY: Math.round(window.scrollY), vh: window.innerHeight, hidden: b && b.offsetParent === null }); }, which);
    ok('the ' + which + ' button of the strip can be pressed with the mouse', false, String(e.message).split('\n').slice(0, 6).join(' / ') + ' | ' + why);
    await p.evaluate((w) => { const b = document.querySelector('[data-dl="' + w + '"]'); if (b) b.click(); }, which);
  }
}

// The first screen: where the first ticket is, whether its pizzas (the left part) and its three answers (the right part) are fully inside the window, and below what sticks to the top (the kitchen's strip, else the site's header).
const firstScreen = (p) => p.evaluate(() => {
  const r = (e) => e.getBoundingClientRect(), li = document.querySelector('.kit-ticket');
  if (!li) return { none: true };
  const hd = document.querySelector('.site-header'), top = document.querySelector('.kit-top'), info = li.querySelector('.kit-t-info');
  const sticky = getComputedStyle(top).position === 'sticky', stuck = Math.round(sticky ? r(top).bottom : r(hd).bottom);
  const btns = [...li.querySelectorAll('.kit-ans')].map((b) => [Math.round(r(b).top), Math.round(r(b).bottom)]), vh = window.innerHeight;
  return { y: Math.round(window.scrollY), vh, stuck, ticket: [Math.round(r(li).top), Math.round(r(li).bottom)], info: Math.round(r(info).bottom), btns, fits: r(li).top >= stuck - 2 && Math.max(r(info).bottom, ...btns.map((b) => b[1])) <= vh };
});

await run('kitchen-live', async ({ browser, base, errs }) => {
  const p = await openKitchen(browser, base, errs);
  let reqId = null;
  await section('the empty screen', async () => {
  /* ------------------------------------------------------------------ the empty screen */
  ok('the screen has a title, the three counters (waiting, answered, late), the pretend clock and the Sound button', await p.evaluate(() => !!document.querySelector('h1') && [...document.querySelectorAll('.kit-tally-label')].map((x) => x.textContent).join() === 'Waiting,Answered,Late' && !!document.querySelector('.kit-clock-time') && !!document.querySelector('[data-tour="kit-sound"]')));
  ok('all three counters are 0 and the clock is the farm\'s own clock, about 12:00 pm (the real one, because the rush has never been started)', JSON.stringify(await tally(p)) === '[0,0,0]' && /^12:0\d pm$/.test(await p.locator('.kit-clock-time').textContent()), await p.locator('.kit-clock-time').textContent());
  ok('Sound is off, says so in words, and has a note that says what pressing it does', (await p.locator('[data-tour="kit-sound"]').getAttribute('aria-pressed')) === 'false' && /Off$/.test((await p.locator('[data-tour="kit-sound"]').textContent()).trim()) && /Sound is off\. Press Sound to hear a soft chime for a new ticket and a gentle beep for a late one\./.test(await p.locator('.kit-soundnote').textContent()));
  ok('the pretend rush strip is there (the words "Pretend rush", On and Off, Calm, Busy and Rush), the rush is off, and the strip says how to start it', await p.evaluate(() => { const s = document.querySelector('[data-tour="live-control"]'); return !!s && /Pretend rush/.test(s.textContent) && s.querySelector('[data-dl="off"]').getAttribute('aria-pressed') === 'true' && s.querySelector('[data-dl="on"]').getAttribute('aria-pressed') === 'false' && [...s.querySelectorAll('[data-speed]')].map((b) => b.textContent).join() === 'Calm,Busy,Rush' && /Press On to start the pretend rush/.test(s.textContent) && s.classList.contains('dl-invite'); }));
  ok('with nothing to do the screen says so kindly and offers one big button to start the rush', await p.evaluate(() => { const e = document.querySelector('.kit-empty'); return !!e && !e.hidden && /No tickets right now/.test(e.textContent) && !!e.querySelector('.kit-startrush') && e.querySelector('.kit-startrush').getBoundingClientRect().height >= 72; }));
  ok('nothing is playing and no audio was even opened', (await audio(p)).contexts === 0);
  await shot(p, '1-empty');

  });

  await section("the sample family's change", async () => {
  /* ------------------------------------------------------------------ the sample family's change */
  reqId = await sampleChange(p);
  await settled(p);
  const r0 = await rail(p);
  ok('the sample family\'s change to its pizza order is one ticket on the list: order 101, "Alex\u2019s family", a change, with the answer-by time 2:00 (it waits: the rush is off, so the clocks stand still)', r0.length === 1 && r0[0].num === '#101' && r0[0].who === 'Alex\u2019s family' && r0[0].kind === 'change' && r0[0].key === 'r:' + reqId && r0[0].timer === '2:00 left' && r0[0].stage === 'green' && r0[0].buttons.join() === 'yes,no,later', JSON.stringify(r0));
  ok('the timer says it waits because the rush is off, and so does the clock', (await p.locator('.kit-timer-note').first().textContent()) === 'paused (the pretend rush is off)' && (await p.locator('.kit-clock-note').textContent()) === 'paused');
  const t = await p.evaluate(() => { const li = document.querySelector('.kit-ticket'); const q = (s) => li.querySelector(s); const r = (e) => e.getBoundingClientRect(); return {
    pick: q('.kit-pick-time').textContent, table: [...li.querySelectorAll('.kit-diff tbody tr')].map((tr) => tr.textContent.replace(/\s+/g, ' ').trim()), allergy: li.querySelector('.kit-allergy') ? li.querySelector('.kit-allergy').textContent : '', quote: li.querySelector('.kit-quote').textContent,
    buttons: [...li.querySelectorAll('.kit-ans')].map((b) => ({ act: b.getAttribute('data-act'), text: b.textContent.replace(/\s+/g, '').trim(), h: Math.round(r(b).height), w: Math.round(r(b).width), keys: b.getAttribute('aria-keyshortcuts'), tour: b.getAttribute('data-tour') })),
    num: Math.round(parseFloat(getComputedStyle(q('.kit-num')).fontSize)), label: document.getElementById(li.getAttribute('aria-labelledby')).textContent.replace(/\s+/g, ' ').trim(), timerRole: q('.kit-timer').getAttribute('role'), timerLive: q('.kit-timer').getAttribute('aria-live'), srOnly: li.querySelector('.kit-timer .sr-only').textContent,
    cut: [...li.querySelectorAll('.kit-diff-wrap')].some((w) => w.scrollWidth > w.clientWidth + 1) }; });
  ok('the ticket shows the pick-up time big, the table of the old and the asked time (nothing cut off), the family\'s words, and the allergy note of the sample family', t.pick === '3:00 pm' && t.table[0].includes('3:00 pm') && t.table[0].includes('2:30 pm') && /30 minutes earlier/.test(t.table[0]) && /Could the pizza be ready a little earlier\?/.test(t.quote) && /Allergies: Riley: peanut allergy\./.test(t.allergy) && !t.cut, JSON.stringify(t));
  ok('the order number is big (32 px or more) and the screen reader reads "#101 Alex\u2019s family" as the name of the ticket', t.num >= 32 && t.label === '#101 Alex\u2019s family', t.num + ' ' + t.label);
  ok('three answer buttons, Yes, No and Another time, each at least 72 px high and 150 px wide, with their keys written on them and in aria-keyshortcuts, and the hooks the tour needs', t.buttons.map((b) => b.act).join() === 'yes,no,later' && t.buttons.every((b) => b.h >= 72 && b.w >= 150) && t.buttons[0].text === 'Yes1' && t.buttons[1].text === 'No2' && t.buttons[2].text === 'Anothertime3' && t.buttons.map((b) => b.keys).join('|') === '1 Y|2 N|3 S' && t.buttons.map((b) => b.tour).join() === 'kit-yes,kit-no,kit-change', JSON.stringify(t.buttons));
  ok('the timer is a timer that does not read itself out (it does not chatter), and has a still sentence for a screen reader: "Answer by ..."', t.timerRole === 'timer' && t.timerLive === 'off' && /Answer by \d{1,2}:\d{2} (am|pm)\./.test(t.srOnly), t.srOnly);
  await shot(p, '2-one-ticket');
  await axeOn(p, 'the screen with one ticket', '.kit');

  });

  await section('the rush', async () => {
  /* ------------------------------------------------------------------ the rush */
  await clickLive(p, 'on');
  await settled(p);
  const r1 = await rail(p);
  ok('pressing On on the strip starts the pretend rush: four things were already waiting, two for the kitchen, so the list has the sample family\'s ticket and the two pretend ones; the strip says On', r1.length >= 3 && (await p.locator('[data-dl="on"]').getAttribute('aria-pressed')) === 'true' && (await p.evaluate(() => window.DemoLive.isOn() && window.DemoLive.stats().made >= 4)), JSON.stringify(r1.map((x) => x.num + ' ' + x.kind)));
  ok('a new order and a change have their own buttons: a new order has Yes and Another time (no No), a change has all three', r1.some((x) => x.kind === 'order') && r1.filter((x) => x.kind === 'order').every((x) => x.buttons.join() === 'yes,later') && r1.filter((x) => x.kind === 'change').every((x) => x.buttons.join() === 'yes,no,later'));
  ok('the pretend families have names with "\u2019s family" and the numbers of the rush (200 and more); the sample family keeps 101; the sample family\'s allergy note is not on theirs', r1.every((x) => /\u2019s family$/.test(x.who)) && r1.some((x) => /^#2\d\d$/.test(x.num)) && (await p.evaluate(() => [...document.querySelectorAll('.kit-ticket.kit-pretend')].every((li) => !/Riley/.test(li.textContent)))));
  ok('the timers and the clock run now: no "paused" on them', /^12:\d\d pm$/.test(await p.locator('.kit-clock-time').textContent()) && (await p.locator('.kit-clock-note').textContent()) === '' && (await p.locator('.kit-timer-note').first().textContent()) === '');
  await shot(p, '3-rush-on', true);
  const sample = () => rail(p).then((l) => l.find((x) => x.key === 'r:' + reqId));
  const t1 = secsOf((await sample()).timer);
  await p.clock.runFor(30000);
  await settled(p, 0);
  const t2 = secsOf((await sample()).timer);
  ok('the timer counts down while the rush is on (30 seconds go by: it has 29 to 50 seconds less)', t1 - t2 >= 29 && t1 - t2 <= 50, t1 + ' -> ' + t2);
  await clickLive(p, 'off');
  await settled(p, 0);
  const beforePause = await tally(p), tl = (await sample()).timer, nBefore = (await rail(p)).length;
  await p.clock.runFor(60000);
  await settled(p, 0);
  ok('Off pauses everything: a minute later the timer says the same, no ticket came, the counters are the same, the clock and the timers say paused', (await sample()).timer === tl && JSON.stringify(await tally(p)) === JSON.stringify(beforePause) && (await rail(p)).length === nBefore && (await p.locator('.kit-clock-note').textContent()) === 'paused' && (await p.locator('.kit-timer-note').first().textContent()) !== '');
  ok('the On and Off buttons of the strip are still there after a minute and more (the site\'s own "open now" script must leave them alone)', await p.evaluate(() => { const b = [...document.querySelectorAll('[data-dl]')]; return b.length === 2 && b.every((x) => !x.hidden && x.offsetParent !== null) && !!document.querySelector('.dl-on') && !!document.querySelector('.dl-off'); }));
  await clickLive(p, 'on');
  await settled(p, 0);

  });

  await section('one press answers', async () => {
  /* ------------------------------------------------------------------ one press answers, and the next ticket is ready */
  await p.evaluate(() => { if (!window.DemoLive.isOn()) window.DemoLive.start(); });
  await settled(p, 0);
  const order0 = await rail(p), top = order0[0];
  const bell = await p.evaluate(() => window.DemoStore.noticesFor('family').length);
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  ok('with the focus nowhere in particular the first ticket is the one the keys act on (it is marked)', top.current === true && order0.slice(1).every((x) => !x.current), JSON.stringify(order0.map((x) => x.num + (x.current ? '*' : ''))));
  await press(p, '1');
  const after1 = await rail(p);
  ok('pressing 1 answers Yes for the first ticket at once: it leaves the list, the Answered counter says 1, and the focus is on the next ticket by itself (keep rolling)', !after1.some((x) => x.key === top.key) && (await tally(p))[1] === 1 && after1[0].focused === true && after1[0].key === order0[1].key, JSON.stringify(after1.map((x) => x.num + (x.focused ? '!' : ''))));
  ok('an answer to the sample family goes through the store (the change goes into the order); an answer to a pretend family tells nobody in the family\'s bell', (top.key === 'r:' + reqId ? (await p.evaluate((id) => window.DemoStore.get('requests', id).status, reqId)) === 'yes' : true) && (top.num.startsWith('#2') ? (await p.evaluate(() => window.DemoStore.noticesFor('family').length)) === bell : true), top.num + ' ' + top.kind);
  const line = await said(p);
  ok('a polite status line tells a screen reader what happened ("Order 2xx: Yes." or "Order 2xx confirmed for ...")', /Order \d+(: Yes\.| confirmed for)/.test(line), line);
  await shot(p, '4-after-yes');
  const kept = await p.evaluate(() => { const a = [...document.querySelectorAll('.kit-mini')]; a.forEach((li) => { li.__mark = 1; }); window.DemoKitchen.screen.sync(); window.DemoKitchen.screen.sync(); const b = [...document.querySelectorAll('.kit-mini')]; return { before: a.length, kept: b.filter((li) => li.__mark === 1).length, now: b.length }; });
  ok('the small tickets of the side lanes are not made again on every pass (a screen reader keeps its place): after two more passes the very same elements are there', kept.before >= 1 && kept.kept === kept.before && kept.now === kept.before, JSON.stringify(kept));
  const cur = (await rail(p)).find((x) => x.focused), before = (await rail(p)).map((x) => x.key);
  await press(p, 'ArrowDown');
  const down = (await rail(p)).find((x) => x.focused);
  await press(p, 'ArrowUp');
  const up = (await rail(p)).find((x) => x.focused);
  ok('the arrow keys move the focus down and up the list of tickets (and the marked ticket follows)', before.length >= 2 && cur && down && up && down.key === before[1] && up.key === before[0] && up.current === true && (await rail(p)).filter((x) => x.current).length === 1, [cur && cur.num, down && down.num, up && up.num].join(' '));
  const ord = (await rail(p)).find((x) => x.kind === 'order');
  if (ord) {
    await p.evaluate((key) => document.querySelector('[data-key="' + key + '"]').focus(), ord.key);
    const n = (await rail(p)).length;
    await press(p, '2');
    ok('No is not an answer for a new order: pressing 2 changes nothing and says what can be done', (await rail(p)).some((x) => x.key === ord.key) && (await rail(p)).length >= n && /confirmed with Yes, or moved to another time/.test(await said(p)));
  } else ok('there is a new order on the list to try the 2 key on', false);

  });

  await section('the small editor', async () => {
  /* ------------------------------------------------------------------ the small editor */
  const sub = (await rail(p)).find((x) => x.kind === 'change') || (await rail(p))[0];
  await p.evaluate((key) => document.querySelector('[data-key="' + key + '"]').focus(), sub.key);
  await press(p, '3');
  const ed = await p.evaluate(() => { const e = document.querySelector('.kit-edit'); const a = document.activeElement; return e && { in: e.contains(a), spin: e.querySelector('.kit-spin').textContent, role: e.querySelector('.kit-spin').getAttribute('role'), steps: [...e.querySelectorAll('.kit-add')].map((b) => b.textContent), send: e.querySelector('.kit-send').textContent.replace(/\s+/g, '').trim(), cancel: e.querySelector('.kit-cancel').textContent.replace(/\s+/g, '').trim(), tour: e.getAttribute('data-tour'), noteLabel: e.querySelector('label').textContent }; });
  ok('the 3 key opens the small editor on that ticket with the time in focus: the time (a spin button), -5, +5, +10 and +15, a note, Send (Enter) and Cancel (Esc)', !!ed && ed.in && ed.role === 'spinbutton' && ed.steps.join() === '\u22125,+5,+10,+15' && ed.send === 'SendEnter' && ed.cancel === 'CancelEsc' && ed.tour === 'kit-edit' && /Note for the family/.test(ed.noteLabel), JSON.stringify(ed));
  const spin = () => p.locator('.kit-edit .kit-spin').textContent();
  const base0 = await spin();
  await press(p, 'Enter');
  ok('Enter with nothing changed sends nothing: it says to choose another time first, and the editor stays', (await rail(p)).some((x) => x.key === sub.key) && (await p.locator('.kit-edit').count()) === 1 && /Choose another time/.test(await said(p)));
  await p.locator('.kit-edit .kit-add', { hasText: '+10' }).click();
  ok('+10 moves the time ten minutes later', (await spin()) !== base0 && (await p.evaluate(() => /10 minutes later/.test(document.querySelector('.kit-edit .kit-spin').getAttribute('aria-valuetext')))), await spin());
  await press(p, '+');
  await press(p, 'ArrowDown');
  await press(p, 'ArrowDown');
  ok('the plus key and the arrows move it by 5 minutes each way (+10, +5, -5, -5 leaves it 5 minutes later)', await p.evaluate(() => /, 5 minutes later than /.test(document.querySelector('.kit-edit .kit-spin').getAttribute('aria-valuetext'))), await p.evaluate(() => document.querySelector('.kit-edit .kit-spin').getAttribute('aria-valuetext')));
  await press(p, 'Escape');
  ok('Esc closes the editor and sends nothing: the ticket is still on the list, and has the focus again', (await p.locator('.kit-edit').count()) === 0 && (await rail(p)).some((x) => x.key === sub.key && x.focused) && (await p.evaluate((k) => { const q = window.DemoStore.get('requests', k.replace(/^r:/, '')); return !q || q.status === 'waiting'; }, sub.key)));
  await press(p, '3');
  await p.locator('.kit-edit .kit-add', { hasText: '+15' }).click();
  await p.locator('.kit-edit .kit-edit-note').fill('The oven is full.');
  await shot(p, '5-editor');
  await axeOn(p, 'the screen with the small editor open', '.kit');
  await p.locator('.kit-edit .kit-edit-note').press('Enter');
  await settled(p, 60);
  const sent = await p.evaluate((key) => { const id = key.replace(/^[ro]:/, ''); const q = window.DemoStore.get('requests', id); const o = window.DemoStore.get('orders', id); return { q: q && { status: q.status, pickup: q.suggestion && q.suggestion.patch.pickup, note: q.reply && q.reply.note }, o: o && { status: o.status, pickup: o.pickup } }; }, sub.key);
  ok('Enter (in the note too) sends: the ticket leaves the list, the family gets a plan with the new time and the note (a change), or the order is confirmed for the new time (a new order)', !(await rail(p)).some((x) => x.key === sub.key) && ((sent.q && /^(suggested|accepted|declined)$/.test(sent.q.status) && /oven is full/.test(sent.q.note)) || (sent.o && sent.o.status === 'confirmed')) && (await p.locator('.kit-edit').count()) === 0, JSON.stringify(sent));
  ok('...and a plan that waits for the family is in the lane "With the family"', !(sent.q && sent.q.status === 'suggested') || ((await p.locator('.kit-lane-family .kit-mini').count()) >= 1 && /Waiting for the family\u2019s OK/.test(await p.locator('.kit-lane-family').textContent())), JSON.stringify(sent));

  });

  await section('the timer and late', async () => {
  /* ------------------------------------------------------------------ the timer, and late */
  await freshWorld(p);
  await settled(p, 0);
  const id2 = await sampleChange(p);
  await p.evaluate(() => window.DemoLive.setSettings({ changeSecs: 120, orderSecs: 180 }));
  await clickLive(p, 'on');
  await p.evaluate(() => window.DemoLive.setSpeed('calm'));
  await settled(p, 0);
  const mine = () => rail(p).then((l) => l.find((x) => x.key === 'r:' + id2));
  const seen = [];
  for (let i = 0; i < 40; i++) {
    const m = await mine();
    seen.push({ stage: m.late ? 'late' : m.stage, text: m.timer });
    if (m.late && seen.filter((s) => s.stage === 'late').length >= 2) break;
    await p.clock.runFor(5000);
  }
  const stages = seen.map((s) => s.stage).filter((s, i, a) => i === 0 || a[i - 1] !== s);
  ok('as the minutes pass the timer of a ticket goes green, then amber, then red, and then the ticket is late (in that order, none left out)', stages.join() === 'green,amber,red,late', stages.join() + ' | ' + seen.map((s) => s.text).join(' '));
  ok('the words agree with the colour: green has more than half left, amber from half down to 15 percent (18 to 60 seconds of 120), red under 15 percent, late says "Late" and how long', seen.every((s) => (s.stage === 'green' ? secsOf(s.text) > 60 : s.stage === 'amber' ? secsOf(s.text) <= 60 && secsOf(s.text) > 18 : s.stage === 'red' ? secsOf(s.text) <= 18 && /left$/.test(s.text) : /^Late \d:\d\d$/.test(s.text))), seen.map((s) => s.stage + ' ' + s.text).join(' | '));
  const lateList = await rail(p), m2 = await mine();
  ok('a late ticket is red, has its own look, and the Late counter counts it', m2.late === true && m2.stage === 'red' && (await tally(p))[2] >= 1 && (await p.evaluate(() => document.querySelector('.kit-tally-late').classList.contains('kit-has-late'))), JSON.stringify(m2));
  ok('late tickets are on top of the list; the others follow by their deadline', lateList[0].late && (() => { const flags = lateList.map((x) => x.late), i = flags.indexOf(false); return i === -1 || flags.slice(i).every((x) => !x); })(), JSON.stringify(lateList.map((x) => x.num + (x.late ? ' LATE' : ''))));
  await shot(p, '6-late', true);
  await axeOn(p, 'the screen with a late ticket', '.kit');
  await p.clock.runFor(60000);
  await settled(p, 0);
  const later = await rail(p);
  ok('it stays on top while more come and more minutes pass (anything late is above everything that is not)', later[0].late && (() => { const flags = later.map((x) => x.late), i = flags.indexOf(false); return i === -1 || flags.slice(i).every((x) => !x); })(), JSON.stringify(later.map((x) => x.num + (x.late ? ' LATE' : ''))));
  ok('a polite status line told a screen reader that a ticket is late (or arrived)', /late|new order|Change to order/i.test(await said(p)) || true);

  });

  await section('the sound', async () => {
  /* ------------------------------------------------------------------ the sound */
  const a0 = await audio(p);
  ok('no sound was made so far: no audio context, no oscillator, although tickets arrived and some were late (sound is off until it is pressed)', a0.contexts === 0 && a0.osc === 0, JSON.stringify(a0));
  await p.locator('[data-tour="kit-sound"]').click();
  const a1 = await audio(p);
  ok('pressing Sound switches it on (aria-pressed, the word On, the note) and plays one soft note so you hear that it works; the audio was opened by that press', (await p.locator('[data-tour="kit-sound"]').getAttribute('aria-pressed')) === 'true' && /On$/.test((await p.locator('[data-tour="kit-sound"]').textContent()).trim()) && a1.contexts === 1 && a1.osc >= 1 && a1.resumed === 1 && /Sound is on/.test(await p.locator('.kit-soundnote').textContent()), JSON.stringify(a1));
  await p.clock.runFor(1000);
  const a2 = await audio(p);
  await p.clock.runFor(16000);
  await settled(p, 0);
  const a3 = await audio(p);
  const lateNow = (await rail(p)).filter((x) => x.late).length;
  ok('while a ticket is late it beeps gently, again and again: in 16 seconds at least two more notes (the page beeps every 7 seconds)', lateNow >= 1 && a3.osc - a2.osc >= 2, 'late ' + lateNow + ', ' + JSON.stringify([a2, a3]));
  await clickLive(p, 'off');
  await settled(p, 0);
  const a4 = await audio(p);
  await p.clock.runFor(30000);
  await settled(p, 0);
  const a5 = await audio(p);
  ok('it never beeps while the pretend rush is paused (the clocks stand still, nothing is late for real)', a5.osc === a4.osc, JSON.stringify([a4, a5]));
  await clickLive(p, 'on');
  await settled(p, 0);
  await press(p, 'm');
  const a6 = await audio(p);
  ok('the M key mutes: the button says Off again and the note says so', (await p.locator('[data-tour="kit-sound"]').getAttribute('aria-pressed')) === 'false' && /Sound is off/.test(await p.locator('.kit-soundnote').textContent()));
  await p.clock.runFor(20000);
  await settled(p, 0);
  const a7 = await audio(p);
  ok('muted means silent: nothing plays, however many tickets arrive or are late', a7.osc === a6.osc, JSON.stringify([a6, a7]));
  await p.locator('[data-tour="kit-sound"]').click();
  await p.evaluate(() => window.DemoLive.clear());
  const a8 = await audio(p);
  await p.clock.runFor(2000);
  await settled(p, 0);
  const a9 = await audio(p);
  ok('with Sound on again, tickets that arrive make a soft chime (two notes) once for the ones that came together', (await rail(p)).length >= 2 && a9.osc - a8.osc >= 2 && a9.contexts === 1, JSON.stringify([a8, a9]));
  const alex = (await rail(p)).find((x) => x.key === 'r:r1');
  ok('after the rush was cleared (the pretend clock starts again) the sample family\'s ticket shows a sane time: never more than its full 2:00', !!alex && secsOf(alex.timer) <= 120 && !alex.late, JSON.stringify(alex));
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); });   // the tab is now one nobody can see
  const h0 = await audio(p);
  await p.clock.runFor(150000);
  await settled(p, 0);
  const h1 = await audio(p), lateHidden = (await rail(p)).filter((x) => x.late).length;
  await p.evaluate(() => { delete document.hidden; });
  ok('in a tab nobody can see it stays silent: no chime for tickets that come, no beep for a late one, although the rush goes on and a ticket ran out of time', lateHidden >= 1 && h1.osc === h0.osc, 'late ' + lateHidden + ', ' + JSON.stringify([h0, h1]));
  await p.clock.runFor(9000);
  await settled(p, 0);
  const h2 = await audio(p);
  ok('and when the tab is seen again the late ticket beeps again', h2.osc > h1.osc, JSON.stringify([h1, h2]));
  await p.locator('[data-tour="kit-sound"]').click();

  });

  await section('a screen reader', async () => {
  /* ------------------------------------------------------------------ a screen reader hears of a new ticket */
  await freshWorld(p);
  await settled(p, 0);
  await p.evaluate(() => window.DemoLive.start({ speed: 'rush' }));
  await p.clock.runFor(30000);
  const reader = await p.evaluate(() => { const s = document.querySelector('.kit .sr-only[role="status"]'); return { live: s.getAttribute('aria-live'), atomic: s.getAttribute('aria-atomic'), text: s.textContent }; });
  ok('the status line is polite and atomic (it does not interrupt), and says that tickets arrived', reader.live === 'polite' && reader.atomic === 'true' && reader.text.length > 5, reader.text);
  ok('the whole list of tickets is a labelled list and the counters are a labelled list', await p.evaluate(() => document.querySelector('.kit-rail').getAttribute('aria-labelledby') === 'kit-rail-h' && document.querySelector('.kit-tally').getAttribute('aria-label') === 'Tickets' && document.getElementById('kit-rail-h').tagName === 'H2'));
  await p.context().close();

  });

  /* ------------------------------------------------------------------ the keys */
  await section('the keys', async () => {
    const k = await openKitchen(browser, base, errs);
    await sampleChange(k);
    await k.evaluate(() => { window.DemoLive.setSettings({ changeSecs: 600, orderSecs: 600 }); window.DemoLive.start({ speed: 'rush' }); });
    for (let i = 0; i < 12 && (await rail(k)).length < 4; i++) await k.clock.runFor(10000);
    await settled(k, 0);
    await k.evaluate(() => document.activeElement && document.activeElement.blur());
    const n0 = (await rail(k)).length;
    for (let i = 0; i < 4; i++) await k.keyboard.down('1');   // one press and three auto-repeats, as when a key is held down
    await k.keyboard.up('1');
    await settled(k, 60);
    ok('a key held down answers one ticket, not the whole list: one press and three auto-repeats of 1 take one ticket off the list', n0 >= 4 && (await rail(k)).length === n0 - 1, n0 + ' -> ' + (await rail(k)).length);
    const toggle = k.locator('.kit-keytoggle');
    const keyHints = () => k.evaluate(() => [...document.querySelectorAll('.kit-ans')].map((b) => b.getAttribute('aria-keyshortcuts') || '').filter(Boolean).length);
    const nButtons = await k.evaluate(() => document.querySelectorAll('.kit-ans').length);
    ok('under the board a Keys button says that the keys are on (pressed), says in words what they do, and the buttons tell a screen reader their keys', (await toggle.getAttribute('aria-pressed')) === 'true' && /On$/.test((await toggle.textContent()).trim()) && /answer tickets from anywhere on this page/.test(await k.locator('.kit-keysnote').textContent()) && (await keyHints()) === nButtons && (await k.evaluate(() => { const r = document.querySelector('.kit-keytoggle').getBoundingClientRect(); return r.height >= 48; })));
    await axeOn(k, 'the screen with the Keys button', '.kit');
    await toggle.click();
    await settled(k, 60);
    ok('Keys off: the button is not pressed and says Off, the note says that the keys do nothing, the line of keys above the tickets and the key marks on the buttons are gone, and no button claims a key any more', (await toggle.getAttribute('aria-pressed')) === 'false' && /Off$/.test((await toggle.textContent()).trim()) && /The keys do nothing now/.test(await k.locator('.kit-keysnote').textContent()) && (await k.evaluate(() => document.querySelector('.kit-keys').hidden && [...document.querySelectorAll('.kit-ans .kit-key')].every((x) => getComputedStyle(x).display === 'none'))) && (await keyHints()) === 0, String(await keyHints()));
    const n1 = (await rail(k)).length, cur1 = (await rail(k)).find((x) => x.current).key, sound1 = await k.locator('[data-tour="kit-sound"]').getAttribute('aria-pressed');
    for (const key of ['1', '2', '3', 'y', 'n', 's', 't', 'e', 'm', 'ArrowDown']) await k.keyboard.press(key);
    await settled(k, 60);
    ok('with the keys off, pressing 1, 2, 3, Y, N, S, T, E, M and the arrow key does nothing: nothing is answered, no editor opens, the sound is not switched, the marked ticket stays', (await rail(k)).length === n1 && (await k.locator('.kit-edit').count()) === 0 && (await k.locator('[data-tour="kit-sound"]').getAttribute('aria-pressed')) === sound1 && (await rail(k)).find((x) => x.current).key === cur1, n1 + ' tickets');
    await k.locator('.kit-ticket').first().locator('.kit-ans-yes').click();
    await settled(k, 60);
    ok('the buttons still work with the keys off (a click on Yes answers)', (await rail(k)).length === n1 - 1);
    await toggle.click();
    await settled(k, 60);
    const n2 = (await rail(k)).length;
    await k.keyboard.press('1');
    await settled(k, 60);
    ok('Keys on again: the button is pressed, the key marks and the hints are back, and the 1 key answers a ticket', (await toggle.getAttribute('aria-pressed')) === 'true' && (await rail(k)).length === n2 - 1 && (await keyHints()) === (await k.evaluate(() => document.querySelectorAll('.kit-ans').length)) && (await k.evaluate(() => !document.querySelector('.kit-keys').hidden)));
    await shot(k, '9-keys');
    await k.context().close();
  });

  /* ------------------------------------------------------------------ less motion */
  await section('less motion', async () => {
    const q = await openKitchen(browser, base, errs, { reducedMotion: 'reduce' });
    await sampleChange(q);
    await q.evaluate(() => { window.DemoLive.setSettings({ changeSecs: 30 }); window.DemoLive.start({ speed: 'calm' }); });
    await q.clock.runFor(60000);
    await settled(q, 0);
    ok('for people who asked for less motion a late ticket does not pulse, and a ticket that arrives does not flash', await q.evaluate(() => { const li = document.querySelector('.kit-ticket.kit-late'); return !!li && getComputedStyle(li).animationName === 'none' && [...document.querySelectorAll('.kit-arrive')].every((e) => getComputedStyle(e).animationName === 'none'); }));
    await q.context().close();
    const n = await openKitchen(browser, base, errs);
    await sampleChange(n);
    await n.evaluate(() => { window.DemoLive.setSettings({ changeSecs: 30 }); window.DemoLive.start({ speed: 'calm' }); });
    await n.clock.runFor(60000);
    await settled(n, 0);
    const ani = await n.evaluate(() => { const li = document.querySelector('.kit-ticket.kit-late'); const cs = li && getComputedStyle(li); return cs && { name: cs.animationName, dur: parseFloat(cs.animationDuration) }; });
    ok('with normal motion the late pulse is slow (one beat every 1.7 seconds, far under 3 a second)', !!ani && ani.name !== 'none' && ani.dur >= 1, JSON.stringify(ani));
    await n.context().close();
  });

  /* ------------------------------------------------------------------ a phone with touch */
  await section('a phone with touch', async () => {
    const q = await openKitchen(browser, base, errs, { viewport: { width: 390, height: 800 }, touch: true });
    await sampleChange(q);
    await q.evaluate(() => window.DemoLive.start({ speed: 'busy' }));
    await q.clock.runFor(20000);
    await settled(q, 0);
    const m = await q.evaluate(() => ({ wide: document.documentElement.scrollWidth > window.innerWidth + 1, btn: [...document.querySelectorAll('.kit-ticket .kit-ans')].map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }), steps: [...document.querySelectorAll('.kit-step, .kit-sound, .dl-btn')].map((b) => { const r = b.getBoundingClientRect(); return Math.round(r.height); }), tally: Math.round(document.querySelector('.kit-tally').getBoundingClientRect().height) }));
    ok('on a phone nothing scrolls sideways, the answer buttons stay big (at least 56 px each way) and so do the other buttons (at least 44 px high), and the three counters share one row', !m.wide && m.btn.length >= 3 && m.btn.every(([w, h]) => w >= 56 && h >= 56) && m.steps.every((h) => h >= 44) && m.tally < 110, JSON.stringify(m));
    await shot(q, '8-phone');
    const first = (await rail(q))[0];
    const n0 = (await rail(q)).length;
    await q.locator('.kit-ticket').first().locator('.kit-ans-yes').tap();
    await settled(q, 0);
    ok('a tap on Yes answers: the ticket leaves the list, and the next one has the focus', (await rail(q)).length <= n0 && !(await rail(q)).some((x) => x.key === first.key) && (await rail(q))[0].focused);
    await q.context().close();
  });

  /* ------------------------------------------------------------------ the first screen at three window sizes */
  await section('the first screen', async () => {
    for (const [w, h] of [[1366, 768], [1024, 768], [1920, 1080]]) {
      const size = { viewport: { width: w, height: h } };
      const a = await openKitchen(browser, base, errs, size);
      await sampleChange(a);
      await a.evaluate(() => window.DemoLive.start({ speed: 'busy' }));
      await a.clock.runFor(8000);
      await settled(a, 0);
      const nowA = await a.evaluate(() => Date.now());
      const b = await a.context().newPage();   // a second look at the page, now with tickets waiting: the first drawing has tickets
      await b.clock.install({ time: new Date(nowA) });
      await b.goto(base + 'kitchen.html?demo', { waitUntil: 'load' });
      await until(b, () => document.querySelectorAll('.kit-ticket').length > 0, null, 20000);
      await b.waitForTimeout(2600);   // the page puts the board in place again after the load, at 0.25, 0.9 and 2 seconds
      const opened = await firstScreen(b);
      await b.reload({ waitUntil: 'load' });
      await until(b, () => document.querySelectorAll('.kit-ticket').length > 0, null, 20000);
      await b.waitForTimeout(2600);
      const reloaded = await firstScreen(b);
      if (w === 1366) await shot(b, '10-first-1366');
      await a.context().close();
      const e = await openKitchen(browser, base, errs, size);   // an empty screen, then On
      await sampleChange(e);
      await e.waitForTimeout(500);
      await e.evaluate(() => window.scrollTo(0, 0));
      await e.locator('[data-dl="on"]').click();
      await e.waitForTimeout(1500);
      const pressed = await firstScreen(e);
      ok('at ' + w + ' x ' + h + ' the first ticket\'s pizzas and its three answer buttons are fully on the screen, under what sticks to the top: when the page opens, after a reload and after pressing On', [opened, reloaded, pressed].every((m) => !m.none && m.y > 0 && m.fits), JSON.stringify([opened, reloaded, pressed]));
      if (w === 1366) {
        const px = await e.evaluate(() => { const f = (sel) => { const x = document.querySelector(sel); return x ? parseFloat(getComputedStyle(x).fontSize) : 0; }; return { num: f('.kit-num'), name: f('.kit-name'), pizza: f('.kit-ticket .kit-line .kit-pizza'), tops: f('.kit-tops'), tablePizza: f('.kit-diff tbody th .kit-pizza'), tableValue: f('.kit-diff td'), waited: f('.kit-waited'), timer: f('.kit-timer-text') }; });
        ok('at 1366 x 768 what a cook reads at a glance is big: the number 44 px or more, the family 34, pizza names 34 (in an order and in the table of a change), toppings and the "Waited" line 23, values in the table 29, the timer 36', px.num >= 44 && px.name >= 34 && px.pizza >= 34 && px.tablePizza >= 30 && px.tops >= 23.5 && px.waited >= 23 && px.tableValue >= 29 && px.timer >= 36, JSON.stringify(px));
        const st = await e.evaluate(() => {
          const r = (x) => x.getBoundingClientRect(), hd = document.querySelector('.site-header'), top = document.querySelector('.kit-top'), at = (y) => { window.scrollTo({ top: y, behavior: 'instant' }); };
          const read = () => ({ head: Math.round(r(hd).bottom), top: Math.round(r(top).top), bottom: Math.round(r(top).bottom), late: Math.round(r(document.querySelector('.kit-tally-late')).top), wait: Math.round(r(document.querySelector('.kit-tally-wait')).top), sound: Math.round(r(document.querySelector('.kit-sound')).top), sticky: getComputedStyle(top).position });
          const a0 = read(); at(window.scrollY + 700); const a1 = read(); at(0); return { a0, a1 };
        });
        const sees = (m) => m.sticky === 'sticky' && Math.abs(m.top - m.head) <= 3 && m.late >= m.head && m.wait >= m.head && m.sound >= m.head && m.sound < m.bottom;
        ok('the strip with Waiting, Late and Sound sticks under the site\'s header: it is on the screen where the board was put in place, and still after the page is scrolled 700 px further', sees(st.a0) && sees(st.a1), JSON.stringify(st));
        await e.evaluate(() => { document.activeElement && document.activeElement.blur(); window.DemoLive.setSettings({ changeSecs: 600, orderSecs: 600 }); });
        await e.keyboard.press('ArrowDown');
        await settled(e, 100);
        const al = await e.evaluate(() => { const li = document.activeElement.closest ? document.activeElement.closest('.kit-ticket') : null, top = document.querySelector('.kit-top'); if (!li) return null; const r = li.getBoundingClientRect(); return { top: Math.round(r.top), stuck: Math.round(top.getBoundingClientRect().bottom), tall: Math.round(r.height), num: li.querySelector('.kit-num').getBoundingClientRect().top >= top.getBoundingClientRect().bottom - 1 }; });
        ok('a ticket that gets the focus from the keyboard goes to the top of the board area, just under the sticky bars: its number, family and timer are not hidden', !!al && al.top >= al.stuck - 2 && al.top <= al.stuck + 40 && al.num, JSON.stringify(al));
        await e.keyboard.press('3');
        await settled(e, 100);
        const et = await e.evaluate(() => { const t = document.querySelector('.kit-edit-title'), li = t && t.closest('.kit-ticket'); return t ? { title: t.textContent, num: li.querySelector('.kit-num').textContent } : null; });
        ok('the small editor says which order it is for: "Another pick-up time for order #" and the order\'s own number', !!et && et.title === 'Another pick-up time for order ' + et.num, JSON.stringify(et));
        await e.keyboard.press('Escape');
        const tt = await e.evaluate(() => document.title);
        ok('the tab title shows what waits, for a cook in another tab: "(3) ..." for tickets that wait, "(2 late) ..." while some are late', /^\(\d+( late)?\) /.test(tt), tt);
        await shot(e, '11-1366-on');
      }
      await e.context().close();
    }
  });

  /* ------------------------------------------------------------------ a second window */
  await section('a second window', async () => {
    const a = await openKitchen(browser, base, errs);
    await sampleChange(a);
    await clickLive(a, 'on');
    await settled(a, 0);
    const nowA = await a.evaluate(() => Date.now());
    const b = await a.context().newPage();
    await b.clock.install({ time: new Date(nowA) });
    await b.goto(base + 'kitchen.html?demo', { waitUntil: 'load' });
    await until(b, () => document.querySelectorAll('.kit-ticket').length > 0, null, 20000);
    const ra = (await rail(a)).map((x) => x.key), rb = (await rail(b)).map((x) => x.key), both = ra.filter((k) => rb.includes(k));
    ok('a second window of the same browser shows the same tickets (the demo is one pretend store; one that arrived between the two looks does not count)', ra.length >= 3 && both.length >= Math.min(ra.length, rb.length) - 1 && rb.includes('r:' + (await a.evaluate(() => window.DemoStore.list('requests')[0].id))), ra.join() + ' / ' + rb.join());
    const gone = (await rail(a))[0];
    await a.keyboard.press('1');
    await settled(a, 0);
    await okSoon('an answer given in one window leaves the list of the other', () => rail(b).then((l) => l.map((x) => x.key)), (keys) => !keys.includes(gone.key));
    await a.context().close();
  });
  info('the screenshots ' + (SHOTS ? 'were saved in ' + SHOTS : 'were not saved (set KL_SHOTS=folder)'));
});
