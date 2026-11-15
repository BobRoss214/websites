// Features 10, 11 and 12 (the safe parts): Make it real, the real-table transport and the waitlist note, the installable app. Sections 29a to 29h.
//   29a  the Make it real page: seven steps, every real one "Not started", nothing to click that could take money, demo and redirect mode, every size
//   29b  the transport against the real live engine in a browser: every message valid, the lock and result pass the commit/reveal check, a stake is a bet
//   29c  the waitlist note on the Live tables page: validation, only a nickname and a yes on the device, nothing sent, erased with "Erase my data"
//   29d  the manifest and icons as the browser sees them (Chromium's own manifest parser and installability check)
//   29e  the service worker: not in an automated browser by default, saves the site, opens with no network, the offline page, never stale, never another site, ?nosw=1
//   29f  the Install button: hidden by default, shown only on the browser's install prompt (or the iPhone hint), gone when installed, never on a game screen
//   29g  the reminders: off by default, asks only when switched on, fires from the live-table schedule (a fake clock), honest about what it cannot do
//   29h  the new blocks on the Live tables page and the footer button at every size, and in reduced motion
// Real install prompts, a real iPhone and real Android notifications are NOT checked here: only headless Chromium is available.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export default async function (h) {
  const { check, newPage, openApp, go, section, a11y, waitReceipt, closeReceipt, problems, GSdata, ORIGIN, BASE, root } = h;
  const SW = require(path.join(root, 'sw.js'));
  const BANNED = /crypto(?!graph)|bitcoin|ethereum|blockchain|wallet|\bNFTs?\b|\btokens?\b|\bcoins?\b/i;
  const ADA = { signedIn: true, name: 'Ada Lovelace', type: 'email', contact: 'ada@example.com', hue: 200, createdAt: 1 };
  const KEY_WAIT = 'givespin:x:waitlist';
  const KEY_REM = 'givespin:x:reminders';
  const text = (page, sel) => page.locator(sel).first().innerText();
  const sideways = (page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  const store = (page, key) => page.evaluate((k) => { const v = localStorage.getItem(k); return v === null ? null : JSON.parse(v); }, key);
  const ready = (page) => page.waitForFunction(() => window.GS && window.GS.app && document.body.classList.contains('is-ready'));
  /** A page that starts signed in (the account is a preview kept in the saved game), for the "Erase my data" checks. */
  const signedIn = (page) => page.addInitScript((acct) => {
    try { if (!sessionStorage.getItem('__acct')) { sessionStorage.setItem('__acct', '1'); localStorage.setItem('givespin:v2', JSON.stringify({ v: 2, xp: 0, totalCents: 0, plays: 0, streak: 0, bestStreak: 0, account: acct })); } } catch (e) { /* ignore */ }
  }, ADA);
  const cacheCount = (page) => page.evaluate(async () => { const k = (await caches.keys()).filter((n) => n.indexOf('givespin-') === 0); return k.length ? (await (await caches.open(k[0])).keys()).length : -1; });
  const savedAll = async (page) => {
    for (let i = 0; i < 60; i++) { if (await cacheCount(page) >= SW.PRECACHE.length) { return true; } await page.waitForTimeout(250); }
    return false;
  };

  /* ---------------------------------------------------------------- 29a */
  if (section('29a. Make it real: seven honest steps, every real one "Not started", nothing that could take money, in demo and redirect mode, at every size')) {
    const problems0 = problems.length;
    const page = await newPage();
    await openApp(page, '#make-it-real');
    const m = await page.evaluate(() => {
      const v = document.querySelector('#view-make-it-real');
      const rows = Array.from(v.querySelectorAll('.mr-row'));
      const real = rows.filter((r) => r.querySelector('.mr-row__lbl b').textContent === 'For real');
      const demo = rows.filter((r) => r.querySelector('.mr-row__lbl b').textContent === 'In this demo');
      return {
        h1: v.querySelectorAll('h1').length, h1text: v.querySelector('h1').textContent, title: document.title, steps: v.querySelectorAll('.mr-step').length,
        realChips: real.map((r) => r.querySelector('.mr-chip').textContent.trim()), demoChips: demo.map((r) => r.querySelector('.mr-chip').textContent.trim()),
        realTodo: real.every((r) => r.querySelector('.mr-chip').classList.contains('is-todo')), demoDone: demo.every((r) => r.querySelector('.mr-chip').classList.contains('is-done')),
        count: v.querySelector('.mr-count').textContent, status: v.querySelector('.mr-status').textContent, headings: Array.from(v.querySelectorAll('h2')).map((x) => x.textContent),
        controls: v.querySelectorAll('form, input, textarea, select, button').length, external: Array.from(v.querySelectorAll('a[href]')).filter((a) => /^(?:https?:)?\/\//.test(a.getAttribute('href'))).length,
        all: v.innerText, modeHere: Array.from(v.querySelectorAll('.mr-mode')).map((x) => x.classList.contains('is-here')), main: document.querySelector('#main') === document.activeElement || true
      };
    });
    check(m.h1 === 1 && m.h1text === 'Make it real' && m.title === 'Make it real | GiveSpin', 'the page has one heading, "Make it real", and its own title', m);
    check(m.steps === 7 && m.realChips.length === 7 && m.realChips.every((c) => c === 'Not started') && m.realTodo, 'seven steps, and the "For real" half of every one carries a "Not started" chip', m.realChips);
    check(m.demoChips.length === 7 && m.demoChips.every((c) => c === 'Done in this demo') && m.demoDone, 'the "In this demo" half of every step is the pretend stand-in, with a "Done in this demo" chip');
    check(/^0 of 7 real steps started/.test(m.count), 'the page counts the real steps started, and it is 0 of 7', m.count);
    check(/all pretend/i.test(m.status) && /demo mode/i.test(m.status) && /bots/i.test(m.status), 'it says at the top that it is all pretend, in demo mode, with bots', m.status);
    check(['What real giving would need', 'What changes for you', 'The one switch', 'More'].every((t) => m.headings.includes(t)), 'the sections are there: what it needs, what changes for you, the one switch, more', m.headings);
    check(m.controls === 0, 'there is nothing on the page to type into or press: no form, no field, no button that could take anything', m.controls);
    check(m.external === 0, 'the page links to no other site');
    check(!BANNED.test(m.all) && !/real players|winnings|payout|prize|jackpot|cash out/i.test(m.all), 'no crypto words, no "real players", no winnings, payout, prize or jackpot wording', (BANNED.exec(m.all) || [])[0]);
    check(/js\/config\.js/.test(m.all) && /takes nothing here/i.test(m.all) && /checkout\.url/.test(m.all) && /no checkout link set up/.test(m.all) && /https/.test(m.all) && /sent to checkout/.test(m.all), 'the switch is explained as it really is: redirect takes nothing here, https links only, "sent to checkout", nothing until checkout.url is filled in');
    check(/Only the person who runs the site can change it/.test(m.all) && /this page cannot/.test(m.all), 'it says the page cannot change the mode');
    check(m.modeHere[0] === true && m.modeHere[1] === false, 'the "demo" card is marked as this copy\'s mode');
    check(await page.evaluate(() => GS.config.mode === 'demo' && GS.payments.mode() === 'demo' && document.documentElement.getAttribute('data-mode') === 'demo'), 'visiting it left the mode on demo');
    const bal = await page.evaluate(() => GS.store.balance());
    check(bal === 100000, 'and the demo credit is untouched', bal);
    // reachable from the footer, from Help, and from "Is this real money?"
    await go(page, '#lobby');
    await page.click('.foot__links a[href="#make-it-real"]');
    check(await page.evaluate(() => GS.app.state.route) === 'make-it-real', 'the footer link opens it');
    await go(page, '#help-makereal');
    const hm = await page.locator('#help-makereal').evaluate((d) => ({ open: d.open, t: d.innerText }));
    check(hm.open && /none of it has been started/i.test(hm.t) && hm.t.includes('Make it real') && !/real players/i.test(hm.t), 'Help answers "Could this be made real?" and says none of it has been started', hm.t.slice(0, 80));
    await go(page, '#help-real');
    check(await page.locator('#help-real a[href="#make-it-real"]').count() === 1 && /demo mode/.test(await text(page, '#help-real')), '"Is this real money?" is as before and links to the page');
    await page.click('#help-real a[href="#make-it-real"]');
    check(await page.evaluate(() => GS.app.state.route) === 'make-it-real', 'and that link works');
    await a11y(page, 'Make it real, laptop');
    await page.close();
    // every size, no sideways scroll, and the phone and a narrow window read in one column
    const bad = [];
    for (const [w, hh, mobile] of [[320, 640, true], [390, 844, true], [768, 1024, true], [1366, 768, false], [1920, 1080, false], [2560, 1440, false]]) {
      const p = await newPage({ viewport: { width: w, height: hh }, mobile });
      await openApp(p, '#make-it-real');
      const cols = await p.evaluate(() => getComputedStyle(document.querySelector('.mr-step__rows')).gridTemplateColumns.split(' ').length);
      if (await sideways(p) || (w <= 720 && cols !== 1) || (w >= 1000 && cols !== 2)) { bad.push(w + ' sideways=' + (await sideways(p)) + ' cols=' + cols); }
      if (w === 390 || w === 320) { await a11y(p, 'Make it real at ' + w); }
      await p.close();
    }
    check(bad.length === 0, 'at 320, 390, 768, 1366, 1920 and 2560 px wide: no sideways scroll, one column on a phone and two beside each other on a laptop', bad);
    // redirect mode: the status line says so, the steps still say Not started
    const rp = await newPage();
    await rp.route('**/js/config.js', async (route) => {
      const src = fs.readFileSync(path.join(root, 'js/config.js'), 'utf8').replace("mode: 'demo'", "mode: 'redirect'");
      await route.fulfill({ status: 200, contentType: 'text/javascript', body: src });
    });
    await openApp(rp, '#make-it-real');
    const rr = await rp.evaluate(() => ({ status: document.querySelector('.mr-status').textContent, here: Array.from(document.querySelectorAll('.mr-mode')).map((x) => x.classList.contains('is-here')), todo: document.querySelectorAll('.mr-chip.is-todo').length, mode: GS.payments.mode() }));
    check(rr.mode === 'redirect' && /redirect/.test(rr.status) && /takes nothing here/i.test(rr.status) && !/all pretend/.test(rr.status) && rr.here[1] === true && rr.here[0] === false, 'in redirect mode the page says so, says it takes nothing here, and marks the other card', rr);
    check(rr.todo === 7, 'and every real step still says Not started (what a copy is set to does not make anything real)');
    await rp.close();
    check(problems.length === problems0, 'section 29a: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ---------------------------------------------------------------- 29b */
  if (section('29b. The transport against the real live engine: valid messages, a fair lock and result, a stake is a bet, nothing about the engine changes')) {
    const problems0 = problems.length;
    const page = await newPage();
    await openApp(page, '#live');
    check(await page.evaluate(() => !!(GS.transport && GS.transport.createLocalTransport && GS.transport.attachLive && GS.transport.validateMessage)), 'GS.transport is loaded with its interface');
    await page.evaluate(async () => {
      const T = GS.transport;
      window.__bridge = T.attachLive(GS.live, GS.bus);
      const t = T.createLocalTransport({ hub: window.__bridge.hub, name: 'Watcher' });
      await t.connect('plinko10');
      window.__msgs = [];
      t.on('*', (m) => window.__msgs.push(m));
    });
    // a round of its own: wait for the result of one that opens after we began listening
    await page.waitForFunction(() => window.__msgs.some((m) => m.type === 'lock') && window.__msgs.some((m) => m.type === 'result' && m.body.round === window.__msgs.filter((x) => x.type === 'lock')[0].body.round), null, { timeout: 60000 });
    const r = await page.evaluate(async () => {
      const T = GS.transport, msgs = window.__msgs;
      const invalid = msgs.filter((m) => !T.validateMessage(m).ok);
      const lock = msgs.filter((m) => m.type === 'lock')[0];
      const result = msgs.filter((m) => m.type === 'result' && m.body.round === lock.body.round)[0];
      const verify = result.body.fair ? await GS.fair.verifyWeighted(result.body.fair) : null;
      const seqs = window.__bridge.hub.backlog('plinko10').map((m) => m.seq);
      const byType = {};
      msgs.forEach((m) => { byType[m.type] = (byType[m.type] || 0) + 1; });
      return {
        invalid: invalid.length, problems: window.__bridge.problems, fairOk: T.checkFair(lock, result), verify, byType,
        tableOnly: msgs.every((m) => (['state', 'lock', 'result'].indexOf(m.type) >= 0) === (m.from.kind === 'table')),
        bots: msgs.filter((m) => m.type === 'bet').every((m) => m.from.kind === 'bot' && /^bot-/.test(m.from.id) && GS.live.HANDLES.some((n) => m.from.name === n || m.from.name.indexOf(n) === 0)),
        gapless: seqs.every((s, i) => i === 0 || s === seqs[i - 1] + 1), encoded: msgs.every((m) => T.encode(m).ok && T.decode(T.encode(m).text).ok),
        winnerIsBoard: GS.charity(result.body.winnerId) !== undefined, potMatches: lock.body.pot === result.body.pot
      };
    });
    check(r.invalid === 0 && r.problems.length === 0, 'every message the adapter made from the real engine passes validateMessage (' + JSON.stringify(r.byType) + ')', r);
    check((r.byType.state || 0) > 0 && (r.byType.bet || 0) > 0 && r.byType.lock >= 1 && r.byType.result >= 1, 'a round gave states, bets, a lock and a result');
    check(r.fairOk.ok && r.potMatches, 'the lock and the result of that round pass checkFair (same round, the revealed seed matches the published commit, same pot)', r.fairOk);
    check(r.verify && r.verify.ok, 'and the real verifier (GS.fair.verifyWeighted, the Verify button) accepts what the adapter published', r.verify);
    check(r.tableOnly && r.bots && r.gapless && r.encoded && r.winnerIsBoard, 'only the table announces state, lock and result; every bettor is a labelled bot; seq has no gaps; every message encodes and decodes', r);
    // the visitor's own stake becomes a bet from the player; cancelling is a cancel; the demo credit behaves exactly as before
    const bal0 = await page.evaluate(() => GS.store.balance());
    const placed = await page.waitForFunction(() => {
      const room = GS.live.room('plinko10');
      if (!(room.phase === 'open' && !room.you && room.msLeft() > 700)) { return false; }
      const res = room.join(GS.charities[3].id, 20);
      window.__join = res;
      return res.ok;
    }, null, { timeout: 40000, polling: 40 }).then(() => true, () => false);
    check(placed, 'a stake of $20 could be placed at the table (the engine works as before with the adapter listening)');
    const mine = await page.evaluate(() => window.__msgs.filter((m) => m.type === 'bet' && m.from.kind === 'player'));
    check(mine.length === 1 && mine[0].from.name === 'You' && mine[0].body.dollars === 20 && mine[0].body.action === 'place' && mine[0].body.charityId === GSdata.charities[3].id, 'it is a bet from the player "You", for $20, place', mine);
    check(await page.evaluate(() => GS.store.balance()) === bal0 - 2000, 'the stake took $20 of demo credit, as it always did');
    await page.evaluate(() => GS.live.room('plinko10').cancel());
    const cancelled = await page.evaluate(() => window.__msgs.filter((m) => m.type === 'bet' && m.from.kind === 'player').map((m) => m.body.action));
    check(cancelled.join() === 'place,cancel', 'taking it back is a cancel message', cancelled);
    check(await page.evaluate(() => GS.store.balance()) === bal0, 'and the credit is back exactly');
    // the player cannot announce a result through a transport, and a seeded local room is repeatable
    const forge = await page.evaluate(async () => {
      const t = GS.transport.createLocalTransport({ hub: window.__bridge.hub, name: 'Mallory' });
      await t.connect('plinko10');
      return [t.send({ type: 'result', body: {} }).reason, t.send({ type: 'state', body: {} }).reason, t.send({ type: 'bet', body: { round: 1, charityId: 'oxfam', dollars: 5000, action: 'place' } }).reason];
    });
    check(forge.join() === 'not-allowed,not-allowed,body', 'a player cannot send a result or a state, and a stake over $1,000 is refused', forge);
    await page.evaluate(() => window.__bridge.stop());
    const n = await page.evaluate(() => window.__bridge.count());
    await page.waitForTimeout(500);
    check(await page.evaluate(() => window.__bridge.count()) === n, 'stop() makes the adapter deaf');
    check(await page.evaluate(() => GS.live.ids().length === 70 && GS.live.room('plinko10').title().indexOf('Plinko') === 0), 'the 70 live tables are all still there');
    await page.close();
    check(problems.length === problems0, 'section 29b: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ---------------------------------------------------------------- 29c */
  if (section('29c. The waitlist note on the Live tables page: validation, only a nickname and a yes, on this device only, erased with "Erase my data"')) {
    const problems0 = problems.length;
    const page = await newPage();
    await signedIn(page);
    const sent = [];
    page.on('request', (r) => sent.push(r.method() + ' ' + r.url()));
    await openApp(page, '#live');
    const blk = '[data-block="waitlist"]';
    check(await page.locator(blk).count() === 1 && await text(page, blk + ' h2') === 'Join the waitlist for real tables', 'the Live tables page has the waitlist block, headed "Join the waitlist for real tables"');
    const t0 = await text(page, blk);
    check(t0.includes('Saved on this device only. Nothing is sent anywhere.'), 'it says: "Saved on this device only. Nothing is sent anywhere."');
    check(/every other player/i.test(t0) && /bot/i.test(t0) && !/real players/i.test(t0) && !BANNED.test(t0), 'it says the other players are bots, never "real players", no crypto words', t0.slice(0, 120));
    check(await page.locator(blk + ' input').count() === 2 && await page.locator(blk + ' input[type="email"], ' + blk + ' input[type="tel"]').count() === 0, 'it has two fields only, a nickname and a tick: no email, no phone number');
    check(await page.locator(blk + ' label[for="wl-nick"]').count() === 1 && await page.locator('#wl-nick').getAttribute('maxlength') !== null, 'the field has a label');
    // the block is on the tiles page only, and comes back
    await go(page, '#tables-plinko');
    check(await page.locator(blk).count() === 0, 'a game\'s own page of tables does not have it');
    await go(page, '#live');
    check(await page.locator(blk).count() === 1, 'and the tiles page has it again');
    // refused input: a message, aria-invalid, nothing stored (a signed-in visitor's account name starts the field, so clear it first)
    const sub = blk + ' button[type="submit"]';
    check(await page.inputValue('#wl-nick') === 'Ada Lovelace', 'a signed-in visitor\'s name starts the field');
    await page.fill('#wl-nick', '');
    await page.locator(sub).click({ force: true });
    check((await text(page, blk + ' [data-role="msg"]')).startsWith('Type a name') && await page.locator('#wl-nick').getAttribute('aria-invalid') === 'true' && await store(page, KEY_WAIT) === null, 'an empty name: a message, the field is marked invalid, nothing stored');
    const refused = [];
    for (const v of ['<b>x</b>', 'visit www.example.com', 'ada@example.com', 'x'.repeat(30)]) {
      await page.fill('#wl-nick', v);
      await page.check(blk + ' [data-role="notify"]', { force: true });
      await page.locator(sub).click({ force: true });
      const msg = await text(page, blk + ' [data-role="msg"]');
      if (!msg || await store(page, KEY_WAIT) !== null || await page.locator('#wl-nick').getAttribute('aria-invalid') !== 'true') { refused.push(v + ' -> ' + msg); }
      await page.locator(blk + ' [data-role="notify"]').setChecked(false, { force: true });
    }
    check(refused.length === 0, 'markup, a web address, an email address and an over-long name are each refused with a message and nothing stored', refused);
    await page.fill('#wl-nick', 'Fine Name');
    await page.locator(sub).click({ force: true });
    check(/Tick/.test(await text(page, blk + ' [data-role="msg"]')) && await store(page, KEY_WAIT) === null, 'a good name without the tick: asks for the tick, stores nothing');
    await a11y(page, 'waitlist with a message showing');
    // a good one
    sent.length = 0;
    await page.fill('#wl-nick', '  Ann   the Giver ');
    await page.locator(blk + ' [data-role="notify"]').setChecked(true, { force: true });
    await page.locator(sub).click({ force: true });
    const v = await store(page, KEY_WAIT);
    check(v && Object.keys(v).sort().join() === 'nickname,notify,savedAt' && v.nickname === 'Ann the Giver' && v.notify === true && Math.abs(v.savedAt - Date.now()) < 20000, 'saving keeps only the nickname (tidied), the yes and the time, under givespin:x:waitlist', v);
    check(await page.evaluate(() => Object.keys(localStorage).filter((k) => k !== 'givespin:x:waitlist' && (localStorage.getItem(k) || '').indexOf('Ann the Giver') >= 0).length) === 0, 'and in no other key');
    check(await page.locator(blk + ' .wl-saved').isVisible() && /Ann the Giver/.test(await text(page, blk + ' .wl-saved')) && /nobody will contact you/.test(await text(page, blk + ' .wl-saved')), 'the block says it is noted, for whom, and that nobody will contact them');
    check(sent.filter((r) => !/^GET \S+\/assets\/logos\/[a-z0-9.-]+$/.test(r)).length === 0, 'saving made no network request (the only requests were this page\'s own charity pictures coming in)', sent.filter((r) => !/\/assets\/logos\//.test(r)));
    check(/Noted on this device/.test((await page.locator('#toasts').innerText())), 'a toast says it was noted on this device');
    await a11y(page, 'waitlist saved');
    // it persists, can be changed and removed
    await page.reload();
    await ready(page);
    await go(page, '#live');
    check(await page.locator(blk + ' .wl-saved').isVisible() && await page.inputValue('#wl-nick') === 'Ann the Giver' && await page.locator(blk + ' [data-role="notify"]').isChecked(), 'after a reload the note is still there, with the name and the tick');
    await page.fill('#wl-nick', 'Bo');
    await page.locator(sub).click({ force: true });
    check((await store(page, KEY_WAIT)).nickname === 'Bo', 'it can be changed');
    await page.click(blk + ' [data-role="remove"]');
    check(await store(page, KEY_WAIT) === null && !(await page.locator(blk + ' .wl-saved').isVisible()), 'and removed: the key is gone');
    // hand-edited storage never gets in: a name with markup is read as no note, extra fields are dropped at the next save
    await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ nickname: '<img src=x onerror=alert(1)>', notify: true, savedAt: 1 })), KEY_WAIT);
    await go(page, '#lobby'); await go(page, '#live');
    check(!(await page.locator(blk + ' .wl-saved').isVisible()) && await page.locator(blk + ' img').count() === 0, 'an unsafe stored name is read as "no note" and nothing is injected');
    await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ nickname: 'Ann', notify: true, savedAt: 5, email: 'a@b.co', phone: '555' })), KEY_WAIT);
    await go(page, '#lobby'); await go(page, '#live');
    check(/Ann/.test(await text(page, blk + ' .wl-saved')), 'a stored note with extra fields still shows its nickname');
    await page.locator(sub).click({ force: true });
    check(Object.keys(await store(page, KEY_WAIT)).sort().join() === 'nickname,notify,savedAt', 'and the next save keeps only the three fields (the email and phone are gone)');
    // the profile name is offered as the starting nickname
    await page.click(blk + ' [data-role="remove"]');
    await page.evaluate(() => GS.local.set('profile', { name: 'Captain Kind', frame: 'plain', title: '' }));
    await go(page, '#lobby'); await go(page, '#live');
    check(await page.inputValue('#wl-nick') === 'Captain Kind', 'the name chosen on the profile page starts the field');
    // keyboard: the field, the tick and the button in that order
    await page.focus('#wl-nick');
    await page.keyboard.press('Tab');
    const a1 = await page.evaluate(() => document.activeElement.getAttribute('data-role'));
    await page.keyboard.press('Tab');
    const a2 = await page.evaluate(() => document.activeElement.getAttribute('type'));
    check(a1 === 'notify' && a2 === 'submit', 'the keyboard goes field, tick, button', [a1, a2]);
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Space');
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Enter');
    check((await store(page, KEY_WAIT) || {}).nickname === 'Captain Kind', 'and it can be filled in and saved with the keyboard alone');
    // "Erase my data" removes it
    await page.click('#acct [data-role="toggle"]');
    await page.click('#acct [data-role="settings"]');
    await page.waitForSelector('#dlg-settings[open]');
    const erase = page.locator('#dlg-settings [data-role="erase"]');
    await erase.click(); await erase.click();
    await page.waitForFunction(() => !document.querySelector('#dlg-settings').open);
    check(await store(page, KEY_WAIT) === null, '"Erase my data on this device" removes the waitlist note');
    check(!(await page.locator(blk + ' .wl-saved').isVisible()), 'and the block on the page goes back to empty at once');
    await page.close();
    // narrow phone: fits, and the scan is clean
    const ph = await newPage({ viewport: { width: 320, height: 640 }, mobile: true });
    await openApp(ph, '#live');
    check(!(await sideways(ph)), 'at 320 px wide the Live tables page with the note does not scroll sideways');
    await a11y(ph, 'waitlist on a 320 px phone');
    await ph.close();
    check(problems.length === problems0, 'section 29c: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ---------------------------------------------------------------- 29d */
  if (section('29d. The manifest and icons as the browser sees them: fields, icon sizes, no manifest errors, installable')) {
    const problems0 = problems.length;
    const page = await newPage();
    await openApp(page, '#lobby');
    const mf = await page.evaluate(async () => {
      const link = document.querySelector('link[rel="manifest"]');
      const res = await fetch(link.href);
      const man = await res.json();
      const load = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i.naturalWidth + 'x' + i.naturalHeight); i.onerror = () => ok('failed'); i.src = src; });
      const icons = [];
      for (const ic of man.icons) { const r = await fetch(new URL(ic.src, link.href)); icons.push({ src: ic.src, status: r.status, type: r.headers.get('content-type'), real: await load(new URL(ic.src, link.href).href), says: ic.sizes, purpose: ic.purpose }); }
      const apple = document.querySelector('link[rel="apple-touch-icon"]');
      const ar = await fetch(apple.href);
      return { status: res.status, type: res.headers.get('content-type'), man, icons, apple: { status: ar.status, size: await load(apple.href) }, theme: document.querySelector('meta[name="theme-color"]').content, appleTitle: (document.querySelector('meta[name="apple-mobile-web-app-title"]') || {}).content };
    });
    const man = mf.man;
    check(mf.status === 200 && /manifest\+json|json/.test(mf.type), 'the manifest is served (200) as a manifest', [mf.status, mf.type]);
    check(man.name === 'GiveSpin Arcade' && man.short_name === 'GiveSpin' && man.start_url === './' && man.scope === './' && man.display === 'standalone', 'name "GiveSpin Arcade", a short name, start_url and scope "./", display standalone', man);
    check(man.theme_color === mf.theme && man.background_color === '#0a1219', 'the colours are the page\'s own (theme-color meta, the dark background)', [man.theme_color, mf.theme, man.background_color]);
    check(mf.icons.length === 3 && mf.icons.every((i) => i.status === 200 && i.type === 'image/png' && i.real === i.says), 'every icon loads (200, image/png) at exactly the size it says', mf.icons);
    check(mf.icons.some((i) => i.says === '192x192') && mf.icons.some((i) => i.says === '512x512' && i.purpose === 'any') && mf.icons.some((i) => i.says === '512x512' && i.purpose === 'maskable'), '192, 512 and a maskable 512 are there');
    check(mf.apple.status === 200 && mf.apple.size === '180x180' && mf.appleTitle === 'GiveSpin', 'the iPhone icon is 180 x 180 and the home-screen title is "GiveSpin"', mf.apple);
    const cdp = await page.context().newCDPSession(page);
    const parsed = await cdp.send('Page.getAppManifest');
    check(parsed.errors.length === 0, 'Chromium\'s own manifest parser reports no errors or warnings', parsed.errors);
    const inst = await cdp.send('Page.getInstallabilityErrors');
    check(inst.installabilityErrors.length === 0, 'and its installability check lists nothing missing', inst.installabilityErrors);
    check(await page.evaluate(() => !!document.querySelector('link[rel="icon"]')), 'the tab icon is still there');
    await page.close();
    check(problems.length === problems0, 'section 29d: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ---------------------------------------------------------------- 29e */
  if (section('29e. The service worker: off in an automated browser by default, saves the site, opens with no network, the offline page, never stale, never another site, ?nosw=1')) {
    const problems0 = problems.length;
    // 1. an automated browser is left alone unless asked
    const plain = await newPage();
    await openApp(plain, '#lobby');
    await plain.waitForTimeout(1800);
    const none = await plain.evaluate(async () => ({ regs: (await navigator.serviceWorker.getRegistrations()).length, ctl: !!navigator.serviceWorker.controller, webdriver: navigator.webdriver, caches: (await caches.keys()).length, reg: await GS.ui.install.registration() }));
    check(none.webdriver === true && none.regs === 0 && !none.ctl && none.caches === 0 && none.reg === null, 'in an automated browser (navigator.webdriver) no worker is registered unless the address says ?sw=on, so every other test sees the site exactly as before', none);
    await plain.close();

    // 2. with ?sw=on: registered, in control, the whole site saved
    const page = await newPage();
    const ext = [];
    page.on('request', (r) => { if (!r.url().startsWith(ORIGIN)) { ext.push(r.url()); } });
    await openApp(page, '#lobby', '?fast=1&sw=on');
    await page.evaluate(() => Promise.race([navigator.serviceWorker.ready, new Promise((_, no) => setTimeout(() => no(new Error('no service worker')), 25000))]));
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 25000 });
    const info = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return { scope: r.scope, script: r.active && r.active.scriptURL, state: r.active && r.active.state }; });
    check(info.scope === ORIGIN + '/' && info.script === ORIGIN + '/sw.js' && info.state === 'activated', 'with ?sw=on the worker is registered at the site root and activated', info);
    check(await savedAll(page), 'the whole site was saved: ' + SW.PRECACHE.length + ' files in the saved copy named ' + SW.CACHE);
    const keys = await page.evaluate(async () => (await (await caches.open('givespin-v1')).keys()).map((r) => r.url));
    const missing = SW.PRECACHE.filter((f) => !keys.includes(ORIGIN + '/' + f));
    check(missing.length === 0 && keys.every((u) => u.startsWith(ORIGIN + '/')), 'every file on the list is in it, and every one is from this site', missing.slice(0, 3));
    check(ext.length === 0, 'the worker and the page asked no other site for anything', ext.slice(0, 3));

    // 3. the app opens with the network cut, and a game plays
    const ctx = page.context();
    await ctx.setOffline(true);
    const prob1 = problems.length;
    await page.reload({ waitUntil: 'load' });
    await ready(page);
    check(await page.locator('.tile').count() === h.GAMES.length + 1 && /GiveSpin/.test(await page.title()), 'with the network cut, reloading opens the whole app from the saved copy (lobby with every game tile)');
    await go(page, '#game-wheel');
    await page.waitForSelector('#panel-wheel:not([hidden])');
    await page.click('#btn-play');
    await waitReceipt(page);
    check(/DEMO/.test(await page.locator('#dlg-result').innerText()), 'and a game plays to its receipt, offline, stamped DEMO');
    await closeReceipt(page);
    await go(page, '#help-install');
    check(await page.locator('#help-install').evaluate((d) => d.open), 'Help opens offline too');
    // (an image that was never saved fails quietly, as it would without the worker: those are the only things that may have failed)
    const offlineProblems = problems.splice(prob1);
    check(offlineProblems.every((p) => /assets\/logos\/|ERR_FAILED|ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(p)), 'while offline the only failures were pictures that had never been saved (a charity logo), which the page already copes with', offlineProblems.slice(0, 4));

    // 4. the offline page: no saved copy of the app and no network
    await page.evaluate(async () => { const c = await caches.open('givespin-v1'); await c.delete('index.html'); });
    await page.goto(BASE + '?fast=1&sw=on&again=1', { waitUntil: 'load' });
    const off = await page.evaluate(() => ({ title: document.title, h1: document.querySelector('h1').textContent, body: document.body.innerText }));
    check(off.title === 'Offline | GiveSpin' && off.h1 === 'You are offline.' && /The house is still a charity\./.test(off.body) && /nothing was charged/i.test(off.body), 'with nothing saved and no network, the friendly page: "You are offline. The house is still a charity."', off);
    await a11y(page, 'the offline page');
    check(!(await sideways(page)), 'the offline page does not scroll sideways');
    await ctx.setOffline(false);

    // 5. back online: the live files win over the saved ones (never stale), and the app is saved again
    await page.evaluate(async () => { const c = await caches.open('givespin-v1'); await c.put('js/config.js', new Response("window.GS=window.GS||{};window.GS.config={mode:'redirect'};", { headers: { 'content-type': 'text/javascript' } })); });
    await page.goto(BASE + '?fast=1&sw=on', { waitUntil: 'load' });
    await ready(page);
    check(await page.evaluate(() => GS.config.mode === 'demo' && GS.payments.mode() === 'demo'), 'online, a tampered saved copy of js/config.js loses to the network: nothing stale can hide a new version (and mode is still demo)');
    await page.waitForTimeout(400);
    const refreshed = await page.evaluate(async () => { const r = await (await caches.open('givespin-v1')).match('js/config.js'); return r ? r.text() : ''; });
    check(/mode: 'demo'/.test(refreshed), 'and the saved copy was refreshed from the network');
    check(await page.evaluate(async () => !!(await (await caches.open('givespin-v1')).match('index.html'))), 'the app page was saved again');
    // 6. the escape hatch
    await page.goto(BASE + '?fast=1&nosw=1', { waitUntil: 'load' });
    await ready(page);
    let gone = false;
    for (let i = 0; i < 40 && !gone; i++) {
      gone = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length === 0 && (await caches.keys()).filter((k) => k.indexOf('givespin-') === 0).length === 0);
      if (!gone) { await page.waitForTimeout(250); }
    }
    check(gone, '?nosw=1 removes the worker and its saved copy');
    await page.waitForTimeout(1500);
    check(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length) === 0, 'and registers nothing on that visit');
    await page.close();

    // 7. file:// never tries
    const fp = await newPage();
    await fp.goto('file://' + path.join(root, 'index.html') + '?fast=1&sw=on');
    await ready(fp);
    await fp.waitForTimeout(1200);
    check(await fp.evaluate(async () => {
      if ((await GS.ui.install.registration()) !== null) { return false; }
      try { return !navigator.serviceWorker || (await navigator.serviceWorker.getRegistrations()).length === 0; } catch (e) { return true; }   // (the browser refuses to even list them for a file)
    }), 'opened from a file (file://) it never registers a worker, even with ?sw=on');
    check(await fp.locator('.install-btn').isHidden(), 'and shows no Install button');
    await fp.close();
    check(problems.length === problems0, 'section 29e: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ---------------------------------------------------------------- 29f */
  if (section('29f. The Install button: hidden by default, shown only on the browser\'s install prompt (or the iPhone hint), gone once installed, never on a game screen')) {
    const problems0 = problems.length;
    const page = await newPage();
    await openApp(page, '#lobby');
    const btn = '.foot__links .install-btn';
    check(await page.locator(btn).count() === 1 && await page.locator(btn).isHidden(), 'by default the Install button is in the footer links and hidden');
    for (const r of ['#lobby', '#game-wheel', '#live', '#help', '#make-it-real', '#me']) {
      await go(page, r);
      if (!(await page.locator(btn).isHidden())) { check(false, 'the button is hidden on ' + r); }
    }
    check(true, 'and it stays hidden on the lobby, a game, Live tables, Help, Make it real and the profile page');
    // a synthetic install prompt (what Chromium fires)
    await go(page, '#game-wheel');
    await page.evaluate(() => {
      window.__prompted = 0;
      const e = new Event('beforeinstallprompt', { cancelable: true });
      e.prompt = () => { window.__prompted += 1; return Promise.resolve(); };
      e.userChoice = Promise.resolve({ outcome: 'dismissed', platform: 'web' });
      window.dispatchEvent(e);
      window.__prevented = e.defaultPrevented;
    });
    check(await page.evaluate(() => window.__prevented) === true, 'the browser\'s own bar is held back (the event is cancelled) so the footer button is the one way in');
    check(await page.locator(btn).isVisible() && (await text(page, btn)).trim() === 'Install the app', 'on the prompt the footer button shows: "Install the app"');
    const where = await page.evaluate(() => { const b = document.querySelector('.install-btn'); return { inFoot: !!b.closest('.foot'), inGame: !!b.closest('#view-game, .bet, #panel-wheel'), tag: b.tagName }; });
    check(where.inFoot && !where.inGame && where.tag === 'BUTTON', 'it is a real button in the footer, not in the game or its gift panel', where);
    // the footer's own last link is still the row's last child (older checks look for `.foot__links a:last-child`; the button goes first, not last)
    check(await page.evaluate(() => { const l = document.querySelector('.foot__links a:last-child'); return !!l && l.getAttribute('href') === '#help-privacy'; }), 'with the button showing, the last child of the footer links is still the Privacy link');
    // the one screen rule: Play is still on the first screen with the button showing
    const play = await page.evaluate(() => { const r = document.querySelector('#btn-play').getBoundingClientRect(); return { bottom: Math.round(r.bottom), h: innerHeight }; });
    check(play.bottom <= play.h, 'with the button showing, Play is still on the first screen of the game', play);
    await a11y(page, 'a game with the Install button showing');
    await page.locator(btn).scrollIntoViewIfNeeded();
    await page.click(btn);
    check(await page.evaluate(() => window.__prompted) === 1 && await page.locator(btn).isHidden(), 'pressing it shows the browser\'s prompt once and hides the button');
    // installed while open
    await page.evaluate(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = () => Promise.resolve(); e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e); });
    check(await page.locator(btn).isVisible(), 'a later prompt shows it again');
    await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
    check(await page.locator(btn).isHidden() && /GiveSpin is installed/.test(await page.locator('#toasts').innerText()), 'once installed it hides and a toast says so');
    // lobby with the button on a phone: a real tap target, and no sideways scroll
    await page.close();
    const ph = await newPage({ viewport: { width: 320, height: 640 }, mobile: true });
    await openApp(ph, '#lobby');
    await ph.evaluate(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = () => Promise.resolve(); e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e); });
    await ph.locator(btn).scrollIntoViewIfNeeded();
    const box = await ph.locator(btn).boundingBox();
    check(box.height >= 36 && !(await sideways(ph)), 'on a 320 px phone the button is a thumb-sized target (' + Math.round(box.height) + ' px high) and the page does not scroll sideways', box);
    await a11y(ph, 'lobby footer with the Install button at 320 px');
    await ph.close();
    // already installed (display mode standalone): never shown
    const st = await newPage();
    await st.addInitScript(() => { const mm = window.matchMedia.bind(window); window.matchMedia = (q) => (/display-mode:\s*standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : mm(q)); });
    await openApp(st, '#lobby');
    await st.evaluate(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = () => Promise.resolve(); e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e); });
    check(await st.locator(btn).isHidden(), 'when the app is already installed (standalone) the button never shows, even if the browser fires the prompt');
    await st.close();
    // Safari on an iPhone: no prompt event, so a hint; other iPhone browsers, Android and desktop: nothing
    const UAS = {
      ios: ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1', 'iPhone', 5, true],
      iosChrome: ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.52 Mobile/15E148 Safari/604.1', 'iPhone', 5, false],
      android: ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36', 'Linux armv81', 5, false]
    };
    for (const [name, [ua, platform, touch, shows]] of Object.entries(UAS)) {
      const p = await newPage({ viewport: { width: 390, height: 844 }, mobile: true });
      await p.addInitScript(([u, pl, t]) => {
        Object.defineProperty(navigator, 'userAgent', { get: () => u });
        Object.defineProperty(navigator, 'platform', { get: () => pl });
        Object.defineProperty(navigator, 'maxTouchPoints', { get: () => t });
      }, [ua, platform, touch]);
      await openApp(p, '#lobby');
      const vis = await p.locator(btn).isVisible();
      check(vis === shows, name + (shows ? ': Safari on an iPhone shows the hint button without any prompt event' : ': hidden until the browser offers an install prompt'));
      if (name === 'ios') {
        check((await text(p, btn)).trim() === 'Add to Home Screen', 'its label is "Add to Home Screen"');
        await p.locator(btn).scrollIntoViewIfNeeded();
        await p.click(btn);
        await p.waitForSelector('#dlg-install-ios[open]');
        const hint = await text(p, '#dlg-install-ios');
        check(/Share/.test(hint) && /Add to Home Screen/.test(hint) && await p.locator('#dlg-install-ios li').count() === 2 && !/real money|payment/i.test(hint), 'the hint is two short steps: Share, then Add to Home Screen', hint);
        await a11y(p, 'the Add to Home Screen hint');
        await p.keyboard.press('Escape');
        await p.waitForFunction(() => !document.querySelector('#dlg-install-ios').open);
        check(await p.evaluate(() => document.activeElement === document.querySelector('.install-btn')), 'closing it returns focus to the button');
      }
      await p.close();
    }
    // on iOS, once it is on the Home Screen (navigator.standalone is true) the hint is gone
    const hs = await newPage({ viewport: { width: 390, height: 844 }, mobile: true });
    await hs.addInitScript(([u]) => {
      Object.defineProperty(navigator, 'userAgent', { get: () => u });
      Object.defineProperty(navigator, 'platform', { get: () => 'iPhone' });
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
      Object.defineProperty(navigator, 'standalone', { get: () => true });
    }, [UAS.ios[0]]);
    await openApp(hs, '#lobby');
    check(await hs.locator(btn).isHidden(), 'on iOS, once it is on the Home Screen (opened standalone) the hint is gone');
    await hs.close();
    check(problems.length === problems0, 'section 29f: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ---------------------------------------------------------------- 29g */
  if (section('29g. Reminders: off by default, ask only when switched on, fire from the live-table schedule (a fake clock), honest about what they cannot do')) {
    const problems0 = problems.length;
    // a pretend Notification whose answer and permission the test chooses, and which writes down what it is asked to show
    const fakeNotification = (page, answer, permission) => page.addInitScript(([ans, perm]) => {
      window.__shown = []; window.__asked = 0;
      class N { constructor(t, o) { window.__shown.push({ title: t, body: o && o.body, tag: o && o.tag }); } }
      // what the visitor answered stays for the rest of the visit (a reload keeps it), like a real browser
      let saved = null; try { saved = sessionStorage.getItem('__np'); } catch (e) { /* ignore */ }
      N.permission = saved || perm;
      N.requestPermission = (cb) => {
        window.__asked += 1;
        if (ans === 'granted' || ans === 'denied') { N.permission = ans; try { sessionStorage.setItem('__np', ans); } catch (e) { /* ignore */ } }
        if (cb) { cb(ans); }
        return Promise.resolve(ans);
      };
      window.Notification = N;
    }, [answer, permission]);
    const T0 = new Date(2026, 10, 4, 13, 50, 0).getTime();     // Wednesday 4 Nov 2026, 13:50 (a Double Pot Hour starts at 14:00)
    const blk = '[data-block="reminders"]';
    const toggle = async (page) => { await page.focus(blk + ' [data-role="rm-on"]'); await page.keyboard.press('Space'); await page.waitForTimeout(150); };

    // 1. defaults: off, nothing asked, nothing armed, nothing stored; the honest words
    const d = await newPage();
    await fakeNotification(d, 'granted', 'default');
    await openApp(d, '#live');
    const t = await text(d, blk);
    check(await d.locator(blk).count() === 1 && await d.locator(blk + ' [data-role="rm-on"]').isChecked() === false && /Remind me when my table is about to start/.test(t), 'the Live tables page has a switch "Remind me when my table is about to start", off');
    check(t.includes('Reminders only work while GiveSpin is open or installed and the browser keeps it alive. No push server, nothing is sent from here.'), 'with the honest line: "Reminders only work while GiveSpin is open or installed and the browser keeps it alive. No push server, nothing is sent from here."');
    check(await d.evaluate(() => window.__asked) === 0 && await store(d, KEY_REM) === null && await d.evaluate(() => !GS.ui.install.reminders.state().armed), 'by default nothing was asked of the browser, nothing is stored and no timer runs');
    check(!BANNED.test(t) && !/real players|prize|payout|win/i.test(t), 'no crypto words, no "real players", nothing about winning', t.slice(0, 80));
    const order = await d.evaluate(() => Array.from(document.querySelectorAll('.live-extras > section')).map((s) => s.getAttribute('data-block')));
    check(order.join() === 'reminders,waitlist', 'the reminders block comes before the waitlist block', order);
    await a11y(d, 'reminders block (off)');
    await d.close();

    // 2. a "no" leaves it off, with a plain message and nothing stored as on
    for (const [ans, re] of [['denied', /blocked/], ['default', /No problem/]]) {
      const p = await newPage();
      await fakeNotification(p, ans, ans);
      await openApp(p, '#live');
      await toggle(p);
      const st = await p.evaluate(() => GS.ui.install.reminders.state());
      check(await p.evaluate(() => window.__asked) === (ans === 'denied' ? 0 : 1) && st.on === false && !st.armed && !(await p.locator(blk + ' [data-role="rm-on"]').isChecked()) && re.test(await text(p, blk + ' [data-role="rm-msg"]')), 'the browser says ' + ans + ': the switch stays off, the message is plain, no timer', st);
      check((await store(p, KEY_REM) || { on: false }).on === false, '... and nothing is stored as on');
      if (ans === 'denied') { await a11y(p, 'reminders block with the "blocked" message'); }
      await p.close();
    }
    // 3. a browser with no notifications at all
    const nn = await newPage();
    await nn.addInitScript(() => { try { delete window.Notification; window.Notification = undefined; } catch (e) { /* ignore */ } });
    await openApp(nn, '#live');
    check(await nn.locator(blk + ' [data-role="rm-on"]').isDisabled() && /cannot show reminders/.test(await text(nn, blk + ' [data-role="rm-next"]')), 'a browser without notifications: the switch is disabled and says so');
    await nn.close();

    // 4. yes: stored, armed, the next event shown, fires at the right time from the schedule, and again for the next one
    const p = await newPage();
    await p.clock.install({ time: T0 });
    await fakeNotification(p, 'granted', 'default');
    await openApp(p, '#live');
    check(/Next featured event: Double Pot Hour at 2:00\s?PM/.test(await text(p, blk + ' [data-role="rm-next"]')), 'before it is on the page already shows the next featured event (a Double Pot Hour at 14:00)', await text(p, blk + ' [data-role="rm-next"]'));
    await toggle(p);
    const on = await p.evaluate(() => GS.ui.install.reminders.state());
    check(on.on && on.armed && on.permission === 'granted' && await p.evaluate(() => window.__asked) === 1, 'switched on: the browser was asked once, it said yes, a timer is armed', on);
    check(JSON.stringify(await store(p, KEY_REM)) === JSON.stringify({ on: true, lead: 2 }), 'and it is stored as { on: true, lead: 2 }', await store(p, KEY_REM));
    check(/Next reminder: Double Pot Hour at 2:00\s?PM.*reminded at 1:58\s?PM/.test(await text(p, blk + ' [data-role="rm-next"]')), 'it shows when it will remind: 1:58 PM for the 2:00 PM event', await text(p, blk + ' [data-role="rm-next"]'));
    check(await p.evaluate(() => window.__shown.length) === 0, 'nothing has been shown yet');
    await p.clock.fastForward('10:00');
    await p.waitForTimeout(200);
    const fired = await p.evaluate(() => ({ shown: window.__shown, last: GS.ui.install.reminders.last(), next: document.querySelector('[data-role="rm-next"]').textContent }));
    check(fired.shown.length === 1 && fired.shown[0].title === 'Double Pot Hour starts in 2 minutes' && /simulated/.test(fired.shown[0].body) && /pretend/.test(fired.shown[0].body) && fired.shown[0].tag === 'givespin-event-double', 'at the reminder time one notification was shown: "Double Pot Hour starts in 2 minutes", saying the tables are simulated and the money pretend', fired.shown);
    check(/Double Pot Hour at 3:00\s?PM/.test(fired.next), 'and the next reminder is already waiting, for 3:00 PM', fired.next);
    check(/Double Pot Hour starts in 2 minutes/.test(await p.locator('#toasts').innerText()), 'with the page open, a toast says it too');
    await p.clock.fastForward('01:00:00');
    await p.waitForTimeout(200);
    check(await p.evaluate(() => window.__shown.length) === 2, 'an hour later the next one fires (and only one more)', await p.evaluate(() => window.__shown.length));
    // the evening event (Disaster Relief Night at 18:00), and Giving Tuesday at midnight
    // off again: the timer stops and the stored value says off
    await toggle(p);
    const off = await p.evaluate(() => GS.ui.install.reminders.state());
    check(!off.on && !off.armed && (await store(p, KEY_REM)).on === false, 'switched off: no timer, stored as off');
    await p.clock.fastForward('03:00:00');
    check(await p.evaluate(() => window.__shown.length) === 2, 'and nothing more is shown');
    // on again, then a reload keeps it (the permission is still granted)
    await toggle(p);
    await p.reload();
    await ready(p);
    await go(p, '#live');
    const again = await p.evaluate(() => GS.ui.install.reminders.state());
    check(again.on && again.armed && await p.locator(blk + ' [data-role="rm-on"]').isChecked(), 'after a reload it is still on and armed');
    await p.close();

    // 5. saved as on but the permission was taken away: it goes off by itself
    const rv = await newPage();
    await rv.addInitScript((k) => { try { if (!sessionStorage.getItem('__rv')) { sessionStorage.setItem('__rv', '1'); localStorage.setItem(k, JSON.stringify({ on: true, lead: 2 })); } } catch (e) { /* ignore */ } }, KEY_REM);
    await fakeNotification(rv, 'denied', 'denied');
    await openApp(rv, '#live');
    check(await rv.evaluate(() => !GS.ui.install.reminders.state().on && !GS.ui.install.reminders.state().armed) && (await store(rv, KEY_REM)).on === false, 'saved as on, but the browser has since blocked notifications: it is off, nothing runs, and the stored value is corrected');
    await rv.close();

    // 6. hand-edited values are not trusted
    const he = await newPage();
    await he.addInitScript((k) => { try { if (!sessionStorage.getItem('__he')) { sessionStorage.setItem('__he', '1'); localStorage.setItem(k, JSON.stringify({ on: 'true', lead: 9999 })); } } catch (e) { /* ignore */ } }, KEY_REM);
    await fakeNotification(he, 'granted', 'granted');
    await openApp(he, '#live');
    check(await he.evaluate(() => { const s = GS.ui.install.reminders.state(); return !s.on && !s.armed && s.lead === 2; }), 'a stored { on: "true", lead: 9999 } is read as off with the 2-minute lead');
    await he.close();

    // 7. "Erase my data" turns it off
    const er = await newPage();
    await signedIn(er);
    await fakeNotification(er, 'granted', 'default');
    await openApp(er, '#live');
    await toggle(er);
    check(await er.evaluate(() => GS.ui.install.reminders.state().armed), '(on again, signed in)');
    await er.click('#acct [data-role="toggle"]');
    await er.click('#acct [data-role="settings"]');
    await er.waitForSelector('#dlg-settings[open]');
    const erase = er.locator('#dlg-settings [data-role="erase"]');
    await erase.click(); await erase.click();
    await er.waitForFunction(() => !document.querySelector('#dlg-settings').open);
    check(await store(er, KEY_REM) === null && await er.evaluate(() => !GS.ui.install.reminders.state().on && !GS.ui.install.reminders.state().armed) && !(await er.locator(blk + ' [data-role="rm-on"]').isChecked()), '"Erase my data on this device" stops the timer and clears the switch');
    await er.close();

    // 8. with a service worker (?sw=on) the reminder goes through registration.showNotification, with the site's own icons. Headless Chromium refuses to show
    //    any real notification (Notification.permission is "denied" there whatever is granted), so the permission is set to "granted" and showNotification is a
    //    recorder: what is checked is that the page asks the worker for the right notification, not that an operating system shows it.
    const rl = await newPage();
    await rl.addInitScript(() => {
      Object.defineProperty(Notification, 'permission', { get: () => 'granted' });
      window.__sw = [];
      ServiceWorkerRegistration.prototype.showNotification = function (title, opts) { window.__sw.push({ title, opts }); return Promise.resolve(); };
    });
    await rl.clock.install({ time: T0 });
    await openApp(rl, '#live', '?fast=1&sw=on');
    await rl.evaluate(() => Promise.race([navigator.serviceWorker.ready, new Promise((_, no) => setTimeout(() => no(new Error('no service worker')), 25000))]));
    await rl.waitForTimeout(300);
    await toggle(rl);
    check(await rl.evaluate(() => GS.ui.install.reminders.state().armed), 'with permission and a worker, the switch arms the timer');
    await rl.clock.fastForward('10:00');
    await rl.waitForTimeout(200);
    const sw = await rl.evaluate(() => window.__sw);
    check(sw.length === 1 && sw[0].title === 'Double Pot Hour starts in 2 minutes' && sw[0].opts.tag === 'givespin-event-double' && /simulated/.test(sw[0].opts.body) && sw[0].opts.data.url === '#live', 'the page asked the service worker to show "Double Pot Hour starts in 2 minutes" (tag, words and a link back to #live)', sw);
    const icons = await rl.evaluate(async (o) => [(await fetch(o.icon)).status, (await fetch(o.badge)).status], sw[0].opts);
    check(icons.join() === '200,200', 'and the icon and badge it names are real files of the site', [sw[0].opts.icon, sw[0].opts.badge, icons]);
    await rl.close();
    check(problems.length === problems0, 'section 29g: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ---------------------------------------------------------------- 29h */
  if (section('29h. The new blocks and the footer button at every size, with a scan, and in reduced motion')) {
    const problems0 = problems.length;
    const bad = [];
    for (const [w, hh, mobile] of [[320, 568, true], [390, 844, true], [844, 390, true], [768, 1024, true], [1366, 768, false], [1920, 1080, false], [2560, 1440, false]]) {
      const p = await newPage({ viewport: { width: w, height: hh }, mobile });
      await openApp(p, '#live');
      const m = await p.evaluate(() => {
        const wrap = document.querySelector('.live-extras'); const r = wrap.getBoundingClientRect();
        const tiles = document.querySelector('#view-live .tiles').getBoundingClientRect();
        return { right: Math.round(r.right), vw: innerWidth, blocks: wrap.children.length, sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, tilesTop: Math.round(tiles.top), wrapTop: Math.round(r.top), sw: document.documentElement.scrollHeight };
      });
      if (m.sideways || m.right > m.vw + 1 || m.blocks !== 2 || m.wrapTop <= m.tilesTop) { bad.push(w + 'x' + hh + ' ' + JSON.stringify(m)); }
      await p.close();
    }
    check(bad.length === 0, 'at 320, 390, 844 (sideways), 768, 1366, 1920 and 2560 px the two blocks sit under the game tiles, inside the window, with no sideways scroll', bad);
    for (const [w, hh, mobile] of [[1366, 768, false], [390, 844, true]]) {
      const p = await newPage({ viewport: { width: w, height: hh }, mobile });
      await openApp(p, '#live');
      await p.locator('.live-extras').scrollIntoViewIfNeeded();
      await a11y(p, 'Live tables page with both blocks at ' + w);
      // the first screen is the same as before: the game tiles are where they were, the new blocks are below the fold
      const first = await p.evaluate(() => ({ tile: document.querySelector('#view-live .tile').getBoundingClientRect().top < innerHeight }));
      await p.close();
      check(first.tile, 'at ' + w + ' px the first screen of Live tables still starts with the game tiles');
    }
    const rm = await newPage({ reducedMotion: 'reduce' });
    await openApp(rm, '#live');
    await rm.waitForTimeout(300);
    const anim = await rm.evaluate(() => Array.from(document.querySelectorAll('.live-extras *, #view-make-it-real *')).filter((e) => { const c = getComputedStyle(e); return (c.animationName !== 'none' && c.animationDuration !== '0s') || (parseFloat(c.transitionDuration) > 0.2); }).length);
    await go(rm, '#make-it-real');
    check(anim === 0, 'in reduced motion nothing in the new blocks animates');
    await a11y(rm, 'Make it real in reduced motion');
    await rm.close();
    // the footer: the install button never changes the footer's own links
    const f = await newPage();
    await openApp(f, '#lobby');
    check(await f.evaluate(() => Array.from(document.querySelectorAll('.foot__links > a')).map((a) => a.textContent).join('|')) === 'What is GiveSpin?|How we make money|Help|Fair Play?|Make it real|Privacy', 'the footer\'s own links are as they were');
    await f.close();
    check(problems.length === problems0, 'section 29h: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }
}
