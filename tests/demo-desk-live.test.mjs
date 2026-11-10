// order: 88
// browser: yes
// quick: no
// covers: js/demo-desk.js, css/demo-staff.css, js/demo-live.js, js/demo-store.js, farm-desk.html, pages/farm-desk.html
/* Mrs. Cathy and Rob's desk (farm-desk.html) in the pretend rush, in a real browser on a fake clock (the page's clock is a fake one, so a minute of the rush costs no real time
 * and every run is the same: the engine makes event k from its seed and k alone). The desk is pretend: nothing is sent. Checked:
 *   - without the rush: the "Right now" box with the rush's control strip (the same strip as the kitchen's: Pretend rush, On / Off, Calm / Busy / Rush), four counters, a feed that
 *     says so when nothing happened, no pretend family anywhere, a plain page title;
 *   - the rush On: families of the rush wait on the desk with their own names (a change of day with its visit, a question), the counters and the feed follow, the title of the tab
 *     counts what waits; "This week" and "Photos and reviews" know them too;
 *   - new things arrive while Mrs. Cathy works: the cards she has stay the same elements in the same order, a note she is typing keeps its words and its cursor, the new cards come
 *     last with a New mark that fades without drawing the card again, the "new" button counts them and takes the focus to the first one, the arrivals are said politely in batches;
 *   - the answers: Yes, No, a suggestion, a reply, Approve, Not now each work on a pretend family as on the family's own (the store makes no notice for a pretend family and
 *     one for the real one); an answered card leaves the waiting list at once, shows under Answered, the focus goes to the next card, "Answered today" and the feed follow; the
 *     family answers a suggestion by itself and the desk says so;
 *   - Off pauses everything (nothing arrives, the pretend clock stands still, the words of the feed go on counting), On and the speed buttons go on again, Rush brings more than Calm;
 *   - a long rush does not grow the screen without end (cards, lines, nodes, records), the same seed gives the same screen twice, a calm window and a phone (no sideways scroll,
 *     two counters in a row, big buttons), reduced motion (no animation), no animation that repeats, and axe-core finds nothing.
 * The store's and the engine's own rules are in tests/demo-store.test.mjs and tests/demo-live.test.mjs (no browser). Run: node tests/demo-desk-live.test.mjs */
import { run, open, ok, okSoon, settled, until, axeSource, info } from './lib.mjs';

const NOW = '2026-11-10T12:00:00-05:00';   // a Tuesday at noon in the fall: the pretend farm clock follows the real one in the farm's hours
const axe = axeSource();
const WAIT = '#desk-waiting .ds-stack[aria-live="off"] > [data-key]';
const DONE = '#desk-waiting .ds-stack-tight > [data-key]';
const APPR = '#desk-approvals .ds-stack:not(.ds-stack-tight) > [data-key]';
const ADONE = '#desk-approvals .ds-stack-tight > [data-key]';

const keys = (p, sel) => p.evaluate((s) => [...document.querySelectorAll(s)].map((c) => c.getAttribute('data-key')), sel);
const heads = (p, sel) => p.evaluate((s) => [...document.querySelectorAll(s)].map((c) => c.querySelector('h3').textContent.trim()), sel);
const tile = (p, label) => p.evaluate((l) => { const t = [...document.querySelectorAll('.ds-live .ds-tile')].find((x) => x.querySelector('.ds-tile-l').textContent.trim() === l); return t ? Number(t.querySelector('.ds-tile-n').textContent) : null; }, label);
const feed = (p) => p.evaluate(() => [...document.querySelectorAll('.ds-feed li')].map((l) => ({ at: l.querySelector('.ds-feed-at').textContent, text: l.querySelector('.ds-feed-text').textContent, fresh: l.classList.contains('is-fresh') })));
const pill = (p) => p.evaluate(() => { const b = document.querySelector('.ds-pill'); return b && !b.hidden ? b.textContent.trim() : null; });
const focusKey = (p) => p.evaluate(() => (document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-focus')) || '');
const store = (p, fn, arg) => p.evaluate(fn, arg);
const made = (p) => p.evaluate(() => window.DemoStore.get('live').count || 0);
const live = (p) => p.evaluate(() => { const l = window.DemoStore.get('live'); return { on: !!l.on, speed: l.speed, t: l.t, count: l.count || 0 }; });
const run1 = async (p, ms, step = 5000) => { for (let t = 0; t < ms; t += step) await p.clock.runFor(Math.min(step, ms - t)); await settled(p, 50); };

async function openDesk(browser, base, errs, o = {}) {
  const p = await open(browser, base, 'farm-desk.html', errs, { query: 'demo', time: NOW, viewport: o.viewport || { width: 1280, height: 720 }, reducedMotion: o.reducedMotion });
  await until(p, () => !!document.querySelector('[data-tour="desk-live"]'), null, 20000);
  await settled(p);
  return p;
}
async function startRush(p, speed) {
  if (speed) await p.click('[data-tour="live-control"] [data-speed="' + speed + '"]');
  await p.click('[data-tour="live-control"] .dl-on');
  await settled(p, 100);
}
// what a run of the rush looks like, for two runs to be compared
const picture = (p) => p.evaluate(() => ({
  waiting: [...document.querySelectorAll('#desk-waiting .ds-stack[aria-live="off"] > [data-key]')].map((c) => c.getAttribute('data-key') + ' ' + c.querySelector('h3').textContent.trim() + ' | ' + (c.querySelector('.ds-ask') || c.querySelector('.ds-bubble p') || { textContent: '' }).textContent.trim()),
  feed: [...document.querySelectorAll('.ds-feed .ds-feed-text')].map((x) => x.textContent), made: window.DemoStore.get('live').count
}));

await run('demo-desk-live', async ({ browser, base, errs }) => {
  /* ------------------------------------------------------------------ no rush: the box, the strip, the counters */
  const p = await openDesk(browser, base, errs);
  const box = await p.evaluate(() => {
    const b = document.querySelector('[data-tour="desk-live"]'), s = b && b.querySelector('[data-tour="live-control"]');
    return { h2: b && b.querySelector('h2').textContent.trim(), strip: !!s, inBox: !!s && b.contains(s), buttons: s ? [...s.querySelectorAll('button')].map((x) => x.textContent.trim() + ':' + x.getAttribute('aria-pressed')) : [], state: s ? s.querySelector('.dl-state').textContent : '', invite: !!s && s.classList.contains('dl-invite'),
      emptyCard: !document.querySelector('.ds-nodata').hidden, feedEmpty: !document.querySelector('.ds-feed-empty').hidden, tilesHidden: document.querySelector('.ds-tiles').hidden, title: document.title };
  });
  ok('the desk has a "Right now" box with the rush\'s own strip in it (Pretend rush: On, Off, Calm, Busy, Rush), off at the start, with the invitation to press On', box.h2 === 'Right now' && box.inBox && JSON.stringify(box.buttons) === JSON.stringify(['On:false', 'Off:true', 'Calm:false', 'Busy:true', 'Rush:false']) && box.invite && /Press On to start the pretend rush/.test(box.state), JSON.stringify(box));
  ok('a desk with no family yet still has that box: the feed says nothing happened yet and how to start, the counters are not shown, and the "no family has signed up" card is there', box.feedEmpty && box.tilesHidden && box.emptyCard && box.title === 'Demo: Mrs. Cathy\'s desk | Wise Acres Organic Farm', JSON.stringify(box));
  await store(p, () => { window.DemoStore.createAccount(); });
  await settled(p);
  const labels = await p.evaluate(() => [...document.querySelectorAll('.ds-live .ds-tile')].map((t) => t.querySelector('.ds-tile-l').textContent.trim() + ':' + t.querySelector('.ds-tile-n').textContent + ':' + t.tagName));
  ok('with a family: four counters in this order, all 0, the first, second and fourth are links to their parts of the screen and "Answered today" is not a link', JSON.stringify(labels) === JSON.stringify(['Waiting for you:0:A', 'Photos and reviews to look at:0:A', 'Answered today:0:DIV', 'People waiting for news:0:A']), labels.join(' | '));
  ok('the rush is off: no pretend family in any list, the feed has nothing, the title is the page\'s own', await p.evaluate(() => ['visits', 'orders', 'requests', 'messages', 'reviews', 'photos'].every((c) => window.DemoStore.list(c, { live: true }).length === window.DemoStore.list(c).length) && !document.title.startsWith('(')) && (await feed(p)).length === 0);

  /* ------------------------------------------------------------------ On: the pretend families come */
  await startRush(p);
  const w0 = await keys(p, WAIT), f0 = await feed(p), st0 = await live(p);
  ok('pressing On starts the rush at Busy: it is on in the shared store, and the four things that were already waiting are made (two for the desk, two for the kitchen)', st0.on && st0.speed === 'busy' && st0.count === 4 && w0.length >= 2, JSON.stringify(st0) + ' ' + w0.length);
  const names = await heads(p, WAIT);
  ok('the desk shows them with their own family names (the curly apostrophe, never "Alex\'s family"): a change of day and a question', names.length >= 2 && names.every((n) => /’s family( asks the farm)?$/.test(n) && !/^Alex/.test(n)), names.join(' | '));
  const kinds = await p.evaluate((s) => [...document.querySelectorAll(s)].map((c) => c.querySelector('.ds-chip').textContent.trim()), WAIT);
  ok('their chips say what each one is (Change of day, Question), and the change of day shows the booked visit under its name', kinds.includes('Change of day') && kinds.includes('Question') && /Booked now: .* · \d+ (person|people)/.test(await p.locator(WAIT + ' >> nth=0').innerText().then((t) => t.replace(/\s+/g, ' '))), kinds.join());
  ok('the counters follow: Waiting for you counts the cards, the rest are 0', (await tile(p, 'Waiting for you')) === w0.length && (await tile(p, 'Answered today')) === 0 && (await tile(p, 'Photos and reviews to look at')) === (await keys(p, APPR)).length);
  ok('the feed has one line for each arrival, newest first, each with "just now" and the family\'s name; at most six lines', f0.length >= 2 && f0.length <= 6 && f0.every((l) => l.at === 'just now' && /’s family/.test(l.text)) && f0.some((l) => /asks: Move/.test(l.text)) && f0.some((l) => /asks the farm: “/.test(l.text)), JSON.stringify(f0));
  ok('the tab says how many things wait while the rush is on, and the clock of the box is the rush\'s own', (await p.title()) === '(' + ((await keys(p, WAIT)).length + (await keys(p, APPR)).length) + ') Demo: Mrs. Cathy\'s desk | Wise Acres Organic Farm' && /^Time: \d{1,2}:\d{2} (am|pm)$/.test(await p.locator('.ds-clock').innerText()));
  const week = await p.locator('#desk-week').innerText();
  ok('"This week" lists the pretend visits under their own family names too', /’s family · \d+ (person|people) · with pizza/.test(week.replace(/\s+/g, ' ')), week.replace(/\s+/g, ' ').slice(0, 300));
  const strip = await p.evaluate(() => [...document.querySelectorAll('[data-tour="live-control"] button')].map((b) => b.textContent.trim() + ':' + b.getAttribute('aria-pressed')).join(' '));
  ok('the strip says On (pressed) and Busy (pressed)', strip === 'On:true Off:false Calm:false Busy:true Rush:false', strip);

  /* ------------------------------------------------------------------ the same seed, the same screen twice */
  await p.click('[data-tour="live-control"] [data-speed="rush"]');
  await run1(p, 60000);
  const pic1 = await picture(p);
  {
    const q = await openDesk(browser, base, errs);
    await store(q, () => { window.DemoStore.createAccount(); });
    await settled(q);
    await startRush(q);
    await q.click('[data-tour="live-control"] [data-speed="rush"]');
    await run1(q, 60000);
    const pic2 = await picture(q);
    ok('the same seed on the same fake clock gives the same screen: the same cards in the same order with the same families and words, the same feed, the same number of things made', JSON.stringify(pic1) === JSON.stringify(pic2) && pic1.made >= 7, JSON.stringify(pic1).slice(0, 200) + ' || ' + JSON.stringify(pic2).slice(0, 200));
    await q.context().close();
  }

  /* ------------------------------------------------------------------ new things arrive while Mrs. Cathy works */
  const before = await keys(p, WAIT);
  ok('(a minute at Rush: more families have written, the desk is busy)', before.length >= 3 && (await live(p)).speed === 'rush', String(before.length));
  const firstId = await p.evaluate(() => { const c = document.querySelector('#desk-waiting .ds-stack[aria-live="off"] > [data-key] textarea'); return c ? c.id : ''; });
  await p.evaluate(() => { window.__first = document.querySelector('#desk-waiting .ds-stack[aria-live="off"] > [data-key]'); window.__firstTa = window.__first.querySelector('textarea'); });
  await p.locator('#' + firstId).click();
  await p.keyboard.type('Hello there');
  const have = await keys(p, WAIT);
  await run1(p, 40000);
  const after = await keys(p, WAIT);
  ok('while she types, more cards arrived: the cards she had are still there, in the same order, and the new ones came after them', after.length > have.length && JSON.stringify(after.slice(0, have.length)) === JSON.stringify(have), have.length + ' -> ' + after.length);
  const kept = await p.evaluate(() => ({ same: window.__first.isConnected && document.querySelector('#desk-waiting .ds-stack[aria-live="off"] > [data-key]') === window.__first, ta: window.__firstTa === document.activeElement, value: window.__firstTa.value }));
  ok('her card is the same element (not drawn again), the note is still in its box and the keyboard focus is still in it', kept.same && kept.ta && kept.value === 'Hello there', JSON.stringify(kept));
  await p.keyboard.type(' again');
  ok('...and the cursor was not moved: the next words go after the old ones', (await p.evaluate(() => window.__firstTa.value)) === 'Hello there again');
  const fresh = await p.evaluate((n) => [...document.querySelectorAll('#desk-waiting .ds-stack[aria-live="off"] > [data-key]')].slice(n).map((c) => ({ cls: c.classList.contains('is-new'), chip: !!c.querySelector('.ds-chip-new'), anim: getComputedStyle(c).animationName, dur: getComputedStyle(c).animationDuration, iter: getComputedStyle(c).animationIterationCount })), have.length);
  ok('each new card has the New mark and the red edge; its arrival is one soft fade of 2.4 seconds that runs once (nothing flashes or repeats)', fresh.length > 0 && fresh.every((c) => c.cls && c.chip && c.anim === 'dsArrive' && c.dur === '2.4s' && c.iter === '1'), JSON.stringify(fresh[0]));
  const said = await p.evaluate(() => [...document.querySelectorAll('.sr-only[role="status"]')].map((x) => x.textContent));
  ok('the arrivals were said politely in a place of their own, in batches ("New: ..." or "3 new: ... and 2 more.")', said.some((t) => /^(New: |\d+ new: .* and \d+ more\.$)/.test(t)), JSON.stringify(said));
  const pl = await pill(p);
  ok('the "new" button counts the new cards that are out of sight', /^\d+ new cards? · Show$/.test(pl || '') && (await p.locator('.ds-pill').getAttribute('aria-label')).startsWith('Show the '), String(pl));
  await p.locator('.ds-pill').focus();
  await p.keyboard.press('Enter');
  await settled(p, 300);
  const fk = await focusKey(p);
  ok('pressing it (also from the keyboard) takes the focus to the heading of the first new card, which is on the screen, and the button goes', /^card:/.test(fk) && (await pill(p)) === null && (await p.evaluate(() => { const r = document.activeElement.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })), fk);
  await run1(p, 32000);
  const marks = await p.evaluate(() => ({ chips: document.querySelectorAll('#desk-waiting .ds-stack[aria-live="off"] .ds-chip-new').length, same: window.__first.isConnected && window.__firstTa.value === 'Hello there again' }));
  ok('after half a minute the New marks are off the cards that stay (taken off in place: the card with the note in it is still the same element, the words still there)', marks.same && marks.chips <= 3, JSON.stringify(marks));

  /* ------------------------------------------------------------------ answering: Yes */
  await p.evaluate(() => window.scrollTo(0, 0));
  await settled(p, 100);
  const order0 = await keys(p, WAIT), doneBefore = await tile(p, 'Answered today'), notices0 = await store(p, () => window.DemoStore.noticesFor('family').length);
  const visitKey = await p.evaluate((s) => { const c = [...document.querySelectorAll(s)].find((x) => x.getAttribute('data-req-kind') === 'visit-change'); return c ? c.getAttribute('data-key') : ''; }, WAIT);
  const who = await p.evaluate((k) => document.querySelector('[data-key="' + k + '"] h3').textContent.trim(), visitKey);
  const rid = visitKey.slice(2);
  const planned = await store(p, (id) => { const r = window.DemoStore.get('requests', id); return { date: r.patch.date, visit: r.target.id }; }, rid);
  await p.locator('[data-key="' + visitKey + '"] [data-tour="desk-yes"]').click();
  await settled(p, 100);
  const order1 = await keys(p, WAIT), done1 = await keys(p, DONE);
  ok('Yes on a pretend family\'s change of day: the card leaves the waiting list at once and is the first one under Answered, with its result', !order1.includes(visitKey) && order1.length === order0.length - 1 && done1[0] === visitKey && /You said Yes\./.test(await p.locator('[data-key="' + visitKey + '"]').innerText()), order0.length + ' -> ' + order1.length + ' ' + done1.join());
  const r1 = await store(p, (id) => window.DemoStore.get('requests', id), rid);
  ok('the store has the answer as the family\'s own: status yes, the time of the reply, the visit moved to the day that was asked for', r1.status === 'yes' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(r1.reply.at) && (await store(p, (v) => window.DemoStore.get('visits', v).date, planned.visit)) === planned.date, JSON.stringify(r1.reply));
  const idx = order0.indexOf(visitKey), nextKey = order0[idx + 1] || order0[idx - 1];
  ok('the keyboard focus went to the heading of the next card (not to the answer under Answered), so she can go on', (await focusKey(p)) === 'card:' + nextKey, (await focusKey(p)) + ' wanted card:' + nextKey);
  ok('the pretend family made no notice in the real family\'s bell, and the family\'s own visits and requests are as they were', (await store(p, () => window.DemoStore.noticesFor('family').length)) === notices0 && (await store(p, () => window.DemoStore.list('requests').length)) === 0);
  ok('"Answered today" counts it, and the feed has "You said Yes to ..." at the top with "just now"', (await tile(p, 'Answered today')) === doneBefore + 1 && (await feed(p))[0].text === 'You said Yes to ' + who + '.' && (await feed(p))[0].at === 'just now', JSON.stringify((await feed(p))[0]));
  ok('Waiting for you went down by one too', (await tile(p, 'Waiting for you')) === order1.length);

  /* ------------------------------------------------------------------ a question: a reply */
  const qKey = await p.evaluate((s) => { const c = [...document.querySelectorAll(s)].find((x) => x.querySelector('.ds-chip').textContent.trim() === 'Question'); return c ? c.getAttribute('data-key') : ''; }, WAIT);
  if (qKey) {
    const thread = qKey.slice(2), doneQ = await tile(p, 'Answered today');
    await p.locator('[data-key="' + qKey + '"] button:has-text("Send reply")').click();
    ok('a reply with no words is not sent: the card stays and she is told to write a few words', (await keys(p, WAIT)).includes(qKey) && (await p.evaluate(() => document.querySelector('.sr-only[role="status"]').textContent)) === 'Write a few words first.');
    await p.locator('[data-key="' + qKey + '"] textarea').fill('Thank you! Closed-toe shoes are best.');
    await p.locator('[data-key="' + qKey + '"] button:has-text("Send reply")').click();
    await settled(p, 100);
    const msgs = await store(p, (t) => window.DemoStore.thread(t), thread);
    ok('a reply to a question: the card moves to Answered ("Your reply was sent."), the thread holds her words, marked as the pretend family\'s and with no notice for the real family', !(await keys(p, WAIT)).includes(qKey) && (await keys(p, DONE)).includes(qKey) && /Your reply was sent\./.test(await p.locator('[data-key="' + qKey + '"]').innerText()) && msgs.length === 0, JSON.stringify(msgs).slice(0, 200));
    const all = await store(p, (t) => window.DemoStore.list('messages', { live: true }).filter((m) => m.thread === t), thread);
    ok('...the thread has two messages, hers is from "cathy" with the family\'s name and live: true, and "Answered today" counted it', all.length === 2 && all[1].from === 'cathy' && all[1].live === true && /’s family$/.test(all[1].fam) && (await tile(p, 'Answered today')) === doneQ + 1 && (await store(p, () => window.DemoStore.noticesFor('family').length)) === notices0, JSON.stringify(all.map((m) => m.from)));
  } else ok('(a question is waiting)', false, 'no question card on the desk');

  /* ------------------------------------------------------------------ No, and a suggestion that the family answers by itself */
  const v2 = await p.evaluate((s) => { const c = [...document.querySelectorAll(s)].filter((x) => x.getAttribute('data-req-kind') === 'visit-change'); return c.map((x) => x.getAttribute('data-key')); }, WAIT);
  if (v2.length >= 2) {
    const noKey = v2[0], sgKey = v2[1], noId = noKey.slice(2), sgId = sgKey.slice(2);
    await p.locator('[data-key="' + noKey + '"] [data-tour="desk-no"]').click();
    await settled(p, 100);
    const rn = await store(p, (id) => window.DemoStore.get('requests', id), noId);
    ok('No: the request is answered no, nothing changes for the visit, the card moves to Answered with "You said No."', rn.status === 'no' && /You said No\./.test(await p.locator('[data-key="' + noKey + '"]').innerText()) && (await feed(p))[0].text.startsWith('You said No to '));
    await p.locator('[data-key="' + sgKey + '"] [data-tour="desk-suggest"]').click();
    await p.locator('#sg-' + sgId + '-day').selectOption({ index: 1 });
    await p.locator('[data-key="' + sgKey + '"] button:has-text("Send my suggestion")').click();
    await settled(p, 100);
    const rs = await store(p, (id) => window.DemoStore.get('requests', id), sgId);
    ok('a suggestion: the request is suggested with the day and time she chose, the card moves to Answered and says it waits for the family\'s OK', rs.status === 'suggested' && !!rs.suggestion.patch.date && (await keys(p, DONE)).includes(sgKey) && /Waiting for the family’s OK/.test(await p.locator('[data-key="' + sgKey + '"]').innerText()));
    await run1(p, 25000);
    const ra = await store(p, (id) => window.DemoStore.get('requests', id), sgId);
    ok('a few seconds later the family answered by itself: accepted or no thanks, the card under Answered says which, and the feed has a line for it', ['accepted', 'declined'].includes(ra.status) && /(said OK|said no thanks)/.test(await p.locator('[data-key="' + sgKey + '"]').innerText()) && (await p.evaluate(() => [...document.querySelectorAll('.ds-feed-text')].map((x) => x.textContent).concat(window.DemoDesk.app.ui.feed.map((f) => f.text)).join('|'))).match(/(said OK to your suggestion|said no thanks to your suggestion)/) !== null, ra.status);
  } else ok('(two changes of day are waiting)', false, v2.length + ' change(s) of day on the desk');

  /* ------------------------------------------------------------------ the family's own request and a pretend photo and review */
  const own = await store(p, () => { const v = window.DemoStore.list('visits').filter((x) => x.id === 'v1')[0], d = window.DemoData; return window.DemoStore.ask({ kind: 'visit-change', to: 'cathy', from: 'family', target: { coll: 'visits', id: v.id }, patch: { date: d.addDays(v.date, 1), time: '13:00' }, summary: 'Move to the next day, 1:00 pm', note: 'Another day works better.' }); });
  await settled(p, 100);
  const wk = await keys(p, WAIT);
  ok('the family\'s own request comes last, under the signed-in family\'s name, and is marked as new like the others', wk[wk.length - 1] === 'r:' + own.id && (await heads(p, WAIT)).pop() === 'Alex’s family', wk.join());
  const nBefore = await store(p, () => window.DemoStore.noticesFor('family').length);
  await p.locator('[data-key="r:' + own.id + '"] [data-tour="desk-yes"]').click();
  await settled(p, 100);
  ok('Yes to the family\'s own request IS told to the family (one notice), the visit moved: a pretend family never does that', (await store(p, () => window.DemoStore.noticesFor('family').length)) === nBefore + 1 && (await store(p, () => window.DemoStore.get('visits', 'v1').time)) === '13:00');
  await store(p, () => {
    const S = window.DemoStore, at = S.now().date + ' ' + S.now().time;
    S.add('photos', { visitId: '', name: 'Goat meets pumpkins', thumb: 'assets/photos/goat-with-pumpkins.webp', status: 'waiting', at, live: true, fam: 'Test’s family' });
    S.add('reviews', { visitId: 'v2', stars: 4, text: 'A lovely morning.', status: 'waiting', at, live: true, fam: 'Test’s family' });
  });
  await settled(p, 100);
  const aw = await heads(p, APPR), nA = await tile(p, 'Photos and reviews to look at');
  ok('a photo and a review of a pretend family wait under Photos and reviews with its name; the counter and the title count them', aw.includes('Photo from Test’s family') && aw.includes('Review from Test’s family') && nA === aw.length && /^\(\d+\) /.test(await p.title()), aw.join(' | '));
  const photoKey = await p.evaluate((s) => [...document.querySelectorAll(s)].find((c) => /Photo from Test/.test(c.querySelector('h3').textContent)).getAttribute('data-key'), APPR);
  const doneA = await tile(p, 'Answered today');
  await p.locator('[data-key="' + photoKey + '"] button:has-text("Approve")').click();
  await settled(p, 100);
  const ph = await store(p, () => window.DemoStore.list('photos', { live: true }).filter((x) => x.fam === 'Test’s family')[0]);
  ok('Approve: the photo is approved with the time it was decided, it moves to the done part, "Answered today" counts it, the feed says so, the real family got no notice', ph.status === 'approved' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(ph.decided) && (await keys(p, ADONE)).includes(photoKey) && (await tile(p, 'Answered today')) === doneA + 1 && (await feed(p))[0].text === 'You approved the photo from Test’s family.' && (await store(p, () => window.DemoStore.noticesFor('family').length)) === nBefore + 1);
  const revKey = await p.evaluate((s) => [...document.querySelectorAll(s)].find((c) => /Review from Test/.test(c.querySelector('h3').textContent)).getAttribute('data-key'), APPR);
  await p.locator('[data-key="' + revKey + '"] button:has-text("Not now")').click();
  await settled(p, 100);
  ok('Not now on the review: declined, decided, counted, and the focus went to something that is still there', (await store(p, () => window.DemoStore.list('reviews', { live: true }).filter((x) => x.fam === 'Test’s family')[0].status)) === 'declined' && (await feed(p))[0].text === 'You said Not now to the review from Test’s family.' && (await p.evaluate(() => !!document.activeElement && document.activeElement !== document.body)));

  /* ------------------------------------------------------------------ Off pauses, On and the speed go on */
  await p.click('[data-tour="live-control"] .dl-off');
  await settled(p, 100);
  const paused = await live(p), cardsOff = (await keys(p, WAIT)).length, madeOff = await made(p);
  await run1(p, 90000);
  const pausedLater = await live(p);
  ok('Off: nothing more is made in 90 seconds, no card comes, the pretend clock stands still, the title is the page\'s own, the strip says Paused', !paused.on && pausedLater.count === madeOff && (await keys(p, WAIT)).length === cardsOff && pausedLater.t === paused.t && !(await p.title()).startsWith('(') && /Paused/.test(await p.locator('.dl-state').innerText()), JSON.stringify([paused, pausedLater]));
  ok('...the words of the feed go on counting (the feed is not frozen): the old lines say minutes ago', (await feed(p)).some((l) => /^\d+ min ago$/.test(l.at)), JSON.stringify((await feed(p)).map((l) => l.at)));
  await p.click('[data-tour="live-control"] [data-speed="calm"]');
  await p.click('[data-tour="live-control"] .dl-on');
  const c0 = await made(p);
  await run1(p, 120000);
  const calmMade = (await made(p)) - c0;
  await p.click('[data-tour="live-control"] [data-speed="rush"]');
  const r0 = await made(p);
  await run1(p, 120000);
  const rushMade = (await made(p)) - r0;
  ok('On again goes on from where it stopped; Calm brings fewer things than Rush in the same two minutes', calmMade >= 1 && rushMade > calmMade && (await live(p)).on, 'calm ' + calmMade + ', rush ' + rushMade);

  /* ------------------------------------------------------------------ axe, with the rush running */
  if (axe) {
    await p.evaluate(axe);
    const bad = await p.evaluate(async () => (await window.axe.run(document.querySelector('[data-demo-app="desk"]'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } })).violations.map((v) => v.id + ' [' + v.impact + '] ' + v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' ; ')));
    ok('axe-core finds nothing on the desk while the rush runs (cards, counters, feed, strip, the "new" button)', bad.length === 0, bad.join(' | '));
  } else info('axe-core is not installed: the accessibility check was left out');

  /* ------------------------------------------------------------------ a long rush does not grow the screen without end */
  await p.click('[data-tour="live-control"] [data-speed="rush"]');
  await run1(p, 600000, 20000);
  const big = await p.evaluate(() => ({ cards: document.querySelectorAll('#desk-waiting .ds-stack[aria-live="off"] > [data-key]').length, done: document.querySelectorAll('#desk-waiting .ds-stack-tight > [data-key]').length, appr: document.querySelectorAll('#desk-approvals [data-key]').length, feed: document.querySelectorAll('.ds-feed li').length, kept: window.DemoDesk.app.ui.feed.length, order: Object.keys(window.DemoDesk.app.ui.order).length, nodes: document.querySelectorAll('*').length,
    records: ['visits', 'orders', 'requests', 'messages', 'reviews', 'photos'].reduce((n, c) => n + window.DemoStore.list(c, { live: true }).length, 0), notices: window.DemoStore.snapshot().notices.length, made: window.DemoStore.get('live').count, week: [...document.querySelectorAll('#desk-week .ds-day')].map((d) => d.querySelectorAll('.ds-lines:not(.ds-pizza-lines) li').length) }));
  ok('after ten more minutes at Rush with nobody answering: at most 24 cards wait, 6 lines in the feed, 6 answered, a few hundred nodes, and the records of the rush stay a small number (the engine tidies old ones)', big.made > 40 && big.cards <= 24 && big.done <= 6 && big.feed <= 6 && big.kept <= 40 && big.order <= 40 && big.nodes < 4000 && big.records < 160 && big.week.every((n) => n <= 6), JSON.stringify(big));
  ok('...and the notices of the sides did not pile up (the rush makes none for the family; the desk and the kitchen notices stay small)', big.notices < 80, String(big.notices));

  /* ------------------------------------------------------------------ the end: reload keeps the rush, the feed is built again from the store */
  await p.reload({ waitUntil: 'load' });
  await until(p, () => !!document.querySelector('[data-tour="desk-live"]'), null, 20000);
  await settled(p, 300);
  const re = await feed(p);
  ok('after a reload the rush is still on (the choice is kept), the cards and the feed are drawn again from the store, and the lines say how long ago (no "just now" for old ones)', (await live(p)).on && (await keys(p, WAIT)).length > 0 && re.length > 0, JSON.stringify(re.map((l) => l.at)));
  await p.context().close();

  /* ------------------------------------------------------------------ reduced motion: no animation at all */
  {
    const q = await openDesk(browser, base, errs, { reducedMotion: 'reduce' });
    await store(q, () => { window.DemoStore.createAccount(); });
    await settled(q);
    await startRush(q);
    await q.click('[data-tour="live-control"] [data-speed="rush"]');
    await run1(q, 20000);
    const an = await q.evaluate(() => [...document.querySelectorAll('.ds-card.is-new, .ds-feed-line.is-fresh')].map((c) => getComputedStyle(c).animationName));
    ok('with "reduce motion" the new cards and lines do not animate (the New mark and the red edge still show)', an.length > 0 && an.every((n) => n === 'none') && (await q.locator('.ds-chip-new').count()) > 0, JSON.stringify(an));
    await q.context().close();
  }

  /* ------------------------------------------------------------------ a phone */
  {
    const q = await openDesk(browser, base, errs, { viewport: { width: 390, height: 844 } });
    await store(q, () => { window.DemoStore.createAccount(); });
    await settled(q);
    await startRush(q);
    await run1(q, 20000);
    const m = await q.evaluate(() => {
      const box = document.querySelector('.ds-live').getBoundingClientRect(), t = [...document.querySelectorAll('.ds-live .ds-tile')].map((x) => { const r = x.getBoundingClientRect(); return { top: Math.round(r.top), left: Math.round(r.left), h: Math.round(r.height) }; });
      const b = [...document.querySelectorAll('[data-tour="live-control"] button')].map((x) => Math.round(x.getBoundingClientRect().height));
      return { wide: document.documentElement.scrollWidth - innerWidth, inside: box.right <= innerWidth + 1 && box.left >= -1, tiles: t, buttons: b, lines: [...document.querySelectorAll('.ds-feed li')].filter((l) => getComputedStyle(l).display !== 'none').length, cols: getComputedStyle(document.querySelector('.ds-tiles')).gridTemplateColumns.split(' ').length };
    });
    ok('on a phone: no sideways scroll, the box fits, the counters sit two in a row, every button of the strip is at least 44 px high, the feed shows four lines at most', m.wide <= 1 && m.inside && m.cols === 2 && m.tiles[0].top === m.tiles[1].top && m.tiles[2].top > m.tiles[0].top && m.buttons.every((h) => h >= 44) && m.lines <= 4, JSON.stringify(m));
    await q.locator('#desk-waiting [data-tour="desk-yes"]').first().click();
    await settled(q, 100);
    ok('on a phone Yes works too: the card moves to Answered and the counter follows', (await tile(q, 'Answered today')) === 1);
    await q.context().close();
  }
});
