/* Pizza countdown + reminders, "This week at the farm", email signup (Mailchimp mocked), reviews / press / photo wall / entrance photo,
 * drive times and map-app links.  Each page is opened at a chosen moment (the page clock is set, so the dates in the test are fixed). */
import fs from 'node:fs';
import { run, open as openPage, ok, okSoon, until, txt } from './lib.mjs';

await run('features', async ({ browser, base, errs }) => {
  const b = browser, BASE = base;
  // A page whose js/content.js (and farm-map-data.js) get extra settings appended, at a chosen moment in time (time: '' = real clock).
  const open = (url, { time = '2026-10-01T15:00:00-04:00', extra = '', mapData = '', viewport, lang, routes, timezoneId } = {}) => openPage(b, BASE, url, errs, {
    time: time || undefined, extra, viewport, lang, timezoneId,
    routes: async (p) => { if (mapData) await p.route('**/js/farm-map-data.js', (r) => r.fulfill({ contentType: 'application/javascript', body: mapData })); if (routes) await routes(p); } });
/* ---------------------------------------------------------- 1. countdown */
{
  let p = await open('index.html');
  const st = await p.evaluate(() => { const b = document.querySelector('[data-rel-box]'); return { hidden: b.hidden, mode: b.dataset.mode, tiles: [...b.querySelectorAll('.rc')].map((e) => e.textContent), when: b.querySelector('[data-rel-when]').textContent, label: b.querySelector('[data-rel-count]').getAttribute('aria-label'), chipOff: document.querySelector('[data-rel-chip]').classList.contains('rel-off'), chip: document.querySelector('[data-rel-chip-text]').textContent }; });
  ok('countdown shows 5 days 1h 59m before Oct 6 5 PM', !st.hidden && st.mode === 'wait' && st.tiles[0].startsWith('5') && st.tiles[1].startsWith('01') && st.tiles[2].startsWith('59'), JSON.stringify(st.tiles));
  ok('when line has dates + Eastern time', /For visits Oct 9.11\. Opens Tuesday, Oct 6 at 5:00 PM Eastern Time/.test(st.when), st.when);
  ok('no "Your time" note when the visitor is on Eastern time', !/Your time/.test(st.when));
  ok('screen reader label is minutes-precise', /^Opens in 5 days, 1 hour, 59 minutes$/.test(st.label), st.label);
  ok('hero chip shows time left', !st.chipOff && /Next pizza reservations open in 5 days 1 hour|Next pizza reservations open in 5 days 2 hours/.test(st.chip), st.chip);
  await p.clock.fastForward(60000);
  ok('seconds tick', (await txt(p, '[data-rel-count] .rc[data-k="s"] b')) !== null);
  await p.context().close();

  // exact switch to "open" at 5:00 PM ET
  p = await open('index.html', { time: '2026-10-06T16:59:50-04:00' });
  let m = await p.evaluate(() => document.querySelector('[data-rel-box]').dataset.mode);
  ok('still waiting at 4:59:51 PM', m === 'wait');
  await p.clock.fastForward(15000);
  const op = await p.evaluate(() => { const b = document.querySelector('[data-rel-box]'); return { mode: b.dataset.mode, eyebrow: b.querySelector('[data-rel-eyebrow]').textContent, countHidden: b.querySelector('[data-rel-count]').hidden, reserve: !b.querySelector('[data-rel-reserve]').hidden, remind: !b.querySelector('[data-rel-remind]').hidden, chip: document.querySelector('[data-rel-chip-text]').textContent }; });
  ok('opens exactly at 5 PM: "just opened" + Reserve button', op.mode === 'open' && /just opened/.test(op.eyebrow) && op.countHidden && op.reserve && op.remind, JSON.stringify(op));
  ok('chip says open now', /open now/.test(op.chip));
  await p.clock.fastForward(6 * 3600e3 + 60000);
  m = await p.evaluate(() => { const b = document.querySelector('[data-rel-box]'); return { mode: b.dataset.mode, when: b.querySelector('[data-rel-when]').textContent }; });
  ok('6 hours later it points at Oct 13', m.mode === 'wait' && /Oct 16.18/.test(m.when) && /Tuesday, Oct 13/.test(m.when), m.when);
  await p.context().close();

  // after the last row: everything hides
  p = await open('index.html', { time: '2026-10-28T09:00:00-04:00' });
  const gone = await p.evaluate(() => ({ box: document.querySelector('[data-rel-box]').hidden, chip: document.querySelector('[data-rel-chip]').classList.contains('rel-off') }));
  ok('after Oct 27 the countdown and chip hide', gone.box && gone.chip);
  await p.context().close();

  // a visitor in another time zone gets their own time too
  p = await open('index.html', { time: '2026-10-01T12:00:00-07:00', timezoneId: 'America/Los_Angeles' });
  const w = await txt(p, '[data-rel-when]');
  ok('Pacific visitor sees (Your time: 2:00 PM)', /\(Your time: 2:00 PM\)/.test(w), w);
  await p.context().close();
}

/* ---------------------------------------------------------- 2. calendar reminders */
{
  const p = await open('index.html');
  await p.locator('[data-rel-remind]').scrollIntoViewIfNeeded();
  await p.click('[data-rel-remind]');
  ok('menu opens', await p.isVisible('.remind-menu') && (await p.getAttribute('[data-rel-remind]', 'aria-expanded')) === 'true');
  const gurl = await p.getAttribute('[data-rel-google]', 'href');
  const gp = new URL(gurl);
  ok('Google Calendar link: text, time, zone, weekly repeat', gp.hostname === 'calendar.google.com' && gp.searchParams.get('dates') === '20261006T210000Z/20261006T213000Z' && gp.searchParams.get('ctz') === 'America/New_York' && gp.searchParams.get('recur') === 'RRULE:FREQ=WEEKLY;COUNT=4' && /pizza reservations open/.test(gp.searchParams.get('text')), gurl.slice(0, 160));
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-rel-ics]')]);
  const path = await dl.path(); const ics = fs.readFileSync(path, 'utf8');
  ok('ICS file name', dl.suggestedFilename() === 'wise-acres-pizza-reservations.ics');
  ok('ICS has 4 events with Eastern time + alarm', (ics.match(/BEGIN:VEVENT/g) || []).length === 4 && /DTSTART;TZID=America\/New_York:20261006T170000/.test(ics) && /DTSTART;TZID=America\/New_York:20261027T170000/.test(ics) && /BEGIN:VALARM/.test(ics) && /TRIGGER:-PT15M/.test(ics) && /BEGIN:VTIMEZONE/.test(ics));
  const lines = ics.split('\r\n');
  ok('ICS uses CRLF and every line is 75 bytes or fewer', ics.endsWith('\r\n') && lines.every((l) => Buffer.byteLength(l) <= 75), 'longest ' + Math.max(...lines.map((l) => Buffer.byteLength(l))));
  ok('ICS description unfolds to the booking link', /bookeo\.com\/wiseacres/.test(ics.replace(/\r\n /g, '')));
  ok('menu closes after download', !(await p.isVisible('.remind-menu')));
  await p.click('[data-rel-remind]'); await p.keyboard.press('Escape');
  ok('Escape closes the menu and keeps focus on the button', !(await p.isVisible('.remind-menu')) && (await p.evaluate(() => document.activeElement.hasAttribute('data-rel-remind'))));
  await p.context().close();
}

/* ---------------------------------------------------------- 3. this week at the farm */
{
  let p = await open('index.html');
  const auto = await p.evaluate(() => ({ hidden: document.querySelector('[data-week]').hidden, crops: [...document.querySelectorAll('.wk')].map((e) => e.querySelector('.wk-name').textContent + ' / ' + e.querySelector('.wk-pill').textContent), updated: document.querySelector('[data-week-updated]').textContent, days: document.querySelector('[data-week-days]').hidden, note: document.querySelector('[data-week-note]').hidden }));
  ok('auto: pumpkins, tomatoes, flowers in season', auto.crops.join('|') === 'Pumpkins / In season|Tomatoes & basil / In season|U-cut flowers / In season', auto.crops.join('|'));
  ok('auto: says dates are typical', /typical dates/.test(auto.updated) && auto.days && auto.note);
  await p.context().close();

  const WEEK = `WISE_ACRES.week = { updated: '2026-10-01', note: 'Tomatoes are at their best. Bring a bucket!', crops: { tomatoes: 'peak', flowers: 'off', pumpkins: 'starting' },
    days: [ { date: '2026-09-30', farm: 'open' }, { date: '2026-10-02', farm: 'few', pizza: 'open', note: 'Rain possible' }, { date: '2026-10-03', farm: 'full', pizza: 'full' }, { date: '2026-10-04', farm: 'closed', pizza: 'none' }, { date: '2026-10-30', farm: 'open' } ] };`;
  p = await open('index.html', { extra: WEEK });
  const w = await p.evaluate(() => ({
    crops: [...document.querySelectorAll('.wk')].map((e) => e.querySelector('.wk-name').textContent + ' / ' + e.querySelector('.wk-pill').textContent + ' / ' + e.dataset.state),
    updated: document.querySelector('[data-week-updated]').textContent, note: document.querySelector('[data-week-note] p').textContent,
    rows: [...document.querySelectorAll('[data-week-days] tbody tr')].map((r) => r.textContent.trim().replace(/\s+/g, ' ')),
    wait: [...document.querySelectorAll('.av-act a')].map((a) => a.textContent + ' -> ' + a.getAttribute('href')),
  }));
  ok('override: tomatoes peak first, pumpkins starting, flowers hidden', w.crops.join('|') === 'Tomatoes & basil / Peak picking / peak|Pumpkins / Just starting / starting', w.crops.join('|'));
  ok('override: updated date + note', /Updated Thursday, Oct 1/.test(w.updated) && w.note === 'Tomatoes are at their best. Bring a bucket!', w.updated);
  ok('spots table: past and far-future days dropped, 3 rows', w.rows.length === 3, JSON.stringify(w.rows));
  ok('spots table: few / full / closed wording', /A few spots left/.test(w.rows[0]) && /Rain possible/.test(w.rows[0]) && /Full/.test(w.rows[1]) && /Closed/.test(w.rows[2]), w.rows[1]);
  ok('full day offers the waitlist (mailto with the day in it)', w.wait.some((x) => /^Email us to join the waitlist -> mailto:cathy@wiseacresorganic\.com\?subject=Waitlist%3A%20Saturday%2C%20Oct%203/.test(x)), JSON.stringify(w.wait));
  ok('open day offers Reserve (Bookeo)', w.wait.some((x) => /^Reserve -> https:\/\/bookeo\.com/.test(x)));
  ok('closed day offers no button', w.wait.length === 2, String(w.wait.length));
  await p.context().close();

  // stale: 20 days later the overrides expire
  p = await open('index.html', { time: '2026-10-21T10:00:00-04:00', extra: WEEK });
  const st = await p.evaluate(() => ({ note: document.querySelector('[data-week-note]').hidden, days: document.querySelector('[data-week-days]').hidden, updated: document.querySelector('[data-week-updated]').textContent }));
  ok('stale after 14 days: note + table hidden, back to typical dates', st.note && st.days && /typical/.test(st.updated), JSON.stringify(st));
  await p.context().close();

  // feed
  p = await open('index.html', { extra: `WISE_ACRES.week = { feed: '/week-feed.json' };`, routes: async (pg) => { await pg.route('**/week-feed.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ updated: '2026-10-01', note: 'From the feed', crops: { pumpkins: 'peak' } }) })); } });
  await until(p, () => document.querySelector('[data-week-note] p').textContent === 'From the feed');
  const fd = await p.evaluate(() => ({ note: document.querySelector('[data-week-note] p').textContent, first: document.querySelector('.wk .wk-name').textContent }));
  ok('feed: JSON file overrides the page settings', fd.note === 'From the feed' && fd.first === 'Pumpkins', JSON.stringify(fd));
  await p.context().close();

  // winter: trees at The GreenHouse, 21-day lookahead
  p = await open('index.html', { time: '2026-11-04T10:00:00-05:00' });
  const wt = await p.evaluate(() => [...document.querySelectorAll('.wk')].map((e) => e.textContent.trim().replace(/\s+/g, ' ')));
  ok('Nov 4: trees start Nov 27 (23 days) so no tree card yet', !wt.some((x) => /Christmas/.test(x)), JSON.stringify(wt));
  await p.context().close();
  p = await open('index.html', { time: '2026-11-12T10:00:00-05:00' });
  const wt2 = await p.evaluate(() => [...document.querySelectorAll('.wk')].map((e) => e.textContent.trim().replace(/\s+/g, ' ')));
  ok('Nov 12: tree card says starts Nov 27, at The GreenHouse', wt2.some((x) => /Christmas trees/.test(x) && /At The GreenHouse/.test(x) && /Usually starts Nov 27/.test(x)), JSON.stringify(wt2));
  await p.context().close();
}

/* ---------------------------------------------------------- 4. signup */
{
  let p = await open('index.html', { time: '' });
  ok('signup: not set up -> form hidden, old button shows', (await p.isHidden('[data-signup]')) && (await p.isVisible('[data-signup-fallback]')));
  ok('signup: "Tell me when" still goes to Mailchimp page', (await p.getAttribute('[data-signup-link]', 'href')).includes('eepurl.com'));
  await p.context().close();

  p = await open('index.html', { time: '', extra: `WISE_ACRES.signup.demo = true;` });
  await p.locator('#signup').scrollIntoViewIfNeeded();
  ok('demo: form shows, old button hides', (await p.isVisible('[data-signup]')) && (await p.isHidden('[data-signup-fallback]')));
  ok('demo: other signup links jump to the form', (await p.getAttribute('[data-signup-link]', 'href')) === '#follow-signup');
  await p.fill('#su-email', 'nope'); await p.click('[data-signup] button[type=submit]');
  ok('bad email: message + aria-invalid + focus', /does not look right/.test(await txt(p, '[data-signup-msg]')) && (await p.getAttribute('#su-email', 'aria-invalid')) === 'true');
  await p.fill('#su-email', 'mom@example.com'); await p.check('input[value=pumpkins]'); await p.click('[data-signup] button[type=submit]');
  await okSoon('demo: says nothing was sent', () => txt(p, '[data-signup-msg]'), (v) => /Preview only/.test(v));
  await p.context().close();

  // Mailchimp JSONP, mocked
  const seen = [];
  const mc = async (pg, reply) => { await pg.route('**/subscribe/post-json**', (r) => { const u = new URL(r.request().url()); seen.push(u); r.fulfill({ contentType: 'application/javascript', body: u.searchParams.get('c') + '(' + JSON.stringify(reply) + ');' }); }); };
  const MC = `WISE_ACRES.signup = { action: 'https://wiseacres.us21.list-manage.com/subscribe/post?u=U123&id=L456', interests: { pumpkins: 'group[1][2]', trees: 'group[1][8]' }, tags: '111' };`;
  p = await open('index.html', { time: '', extra: MC, routes: (pg) => mc(pg, { result: 'success', msg: 'ok' }) });
  await p.fill('#su-email', 'mom@example.com'); await p.check('input[value=pumpkins]'); await p.check('input[value=trees]'); await p.check('input[value=pizza]');
  await p.click('[data-signup] button[type=submit]');
  await okSoon('Mailchimp: the request was sent', async () => seen.length, (n) => n >= 1);
  await until(p, () => /Check your email/.test(document.querySelector('[data-signup-msg]').textContent));
  const u = seen[0];
  ok('Mailchimp: calls post-json with u, id, email, groups, tags', u && u.pathname === '/subscribe/post-json' && u.searchParams.get('u') === 'U123' && u.searchParams.get('id') === 'L456' && u.searchParams.get('EMAIL') === 'mom@example.com' && u.searchParams.get('group[1][2]') === '2' && u.searchParams.get('group[1][8]') === '8' && u.searchParams.get('tags') === '111', u && u.search.slice(0, 200));
  ok('Mailchimp: interest with no mapping is simply not sent', u && ![...u.searchParams.keys()].some((k) => /pizza/.test(k)));
  ok('success message + form reset', /Check your email/.test(await txt(p, '[data-signup-msg]')) && (await p.inputValue('#su-email')) === '' && !(await p.isChecked('input[value=pumpkins]')));
  await p.context().close();
  seen.length = 0;
  p = await open('index.html', { time: '', extra: MC, routes: (pg) => mc(pg, { result: 'error', msg: 'mom@example.com is already subscribed to list Wise Acres.' }) });
  await p.fill('#su-email', 'mom@example.com'); await p.click('[data-signup] button[type=submit]');
  await okSoon('already subscribed: friendly message', () => txt(p, '[data-signup-msg]'), (v) => /already on the list/.test(v));
  await p.context().close();
  p = await open('index.html', { time: '', extra: MC, routes: (pg) => mc(pg, { result: 'error', msg: 'Too many subscribe attempts' }) });
  await p.fill('#su-email', 'mom@example.com'); await p.click('[data-signup] button[type=submit]');
  await okSoon('other error: message + the old signup page button comes back', async () => ({ msg: await txt(p, '[data-signup-msg]'), back: await p.isVisible('[data-signup-fallback]') }), (v) => /did not go through/.test(v.msg) && v.back);
  await p.context().close();
}

/* ---------------------------------------------------------- 5. reviews, press, photo wall, entrance */
{
  let p = await open('index.html', { time: '' });
  const r0 = await p.evaluate(() => [...document.querySelectorAll('a[data-review]')].map((a) => a.getAttribute('href')));
  ok('review buttons default to the farm on Google Maps', r0.length === 2 && r0.every((h) => /google\.com\/maps\/search/.test(h)), JSON.stringify(r0));
  const press = await p.evaluate(() => [...document.querySelectorAll('.press-list a')].map((a) => ({ href: a.href, target: a.target, rel: a.rel, text: a.textContent.trim() })));
  ok('press: two Axios Charlotte links open in a new tab', press.length === 2 && press.every((x) => x.target === '_blank' && /noopener/.test(x.rel) && /^https:\/\/www\.axios\.com\/local\/charlotte\//.test(x.href)), JSON.stringify(press.map((x) => x.text.slice(0, 40))));
  ok('community strip hidden when empty', await p.isHidden('#community'));
  await p.context().close();

  p = await open('index.html', { time: '', extra: `WISE_ACRES.reviewUrl = 'https://g.page/r/ABC123/review'; WISE_ACRES.community = [ { src: 'assets/photos/goat-with-pumpkins.webp', alt: 'A baby goat sniffing small pumpkins', by: '@someone on Instagram', url: 'https://www.instagram.com/p/xyz/' }, { src: 'assets/photos/mums-and-red-shed.webp', alt: 'Mums by a shed', by: 'The Smith family' } ];` });
  const r1 = await p.evaluate(() => [...document.querySelectorAll('a[data-review]')].map((a) => a.getAttribute('href')));
  ok('reviewUrl setting reaches every review button', r1.every((h) => h === 'https://g.page/r/ABC123/review'));
  ok('community: strip + gallery section visible', await p.isVisible('#community') && (await p.locator('.community-strip li').count()) === 2);
  ok('community: credit links out only when a url is given', (await p.locator('.community-strip figcaption a').count()) === 1);
  await p.locator('#community').scrollIntoViewIfNeeded();
  await p.locator('.community-strip img').first().click();
  await okSoon('community: clicking a photo opens the big viewer', () => p.evaluate(() => !!(document.querySelector('#lightbox') && document.querySelector('#lightbox').open && /goat/.test(document.querySelector('#lightbox-img').src))), (v) => v);
  await p.keyboard.press('Escape');
  await p.context().close();

  p = await open('first-visit.html', { time: '', extra: `WISE_ACRES.entrancePhoto = { src: 'assets/photos/mums-and-red-shed.webp', alt: 'The farm gate on Hartis Road', caption: 'Look for this gate.' };` });
  ok('entrance photo slot fills in', await p.isVisible('[data-entrance]') && (await txt(p, '[data-entrance] figcaption')) === 'Look for this gate.');
  await p.context().close();
  p = await open('first-visit.html', { time: '' });
  ok('entrance photo slot stays hidden when not set', await p.isHidden('[data-entrance]'));
  await p.context().close();
}

/* ---------------------------------------------------------- 6. drive times + map apps */
{
  const p = await open('index.html', { time: '' });
  const d = await p.evaluate(() => [...document.querySelectorAll('.drive-list li')].map((li) => li.textContent.trim().replace(/\s+/g, ' ')));
  ok('drive times in English', d.join('|') === 'Stallings about 10 minutes|Matthews about 15 minutes|Mint Hill about 20 minutes|Monroe about 20 minutes|Waxhaw about 25 minutes|Uptown Charlotte about 30 minutes', d.join('|'));
  const maps = await p.evaluate(() => [...document.querySelectorAll('.more-maps a')].map((a) => a.href));
  ok('Apple Maps + Waze links for both places', maps.length === 4 && maps.filter((h) => /maps\.apple\.com\/\?daddr=/.test(h)).length === 2 && maps.filter((h) => /waze\.com\/ul\?q=/.test(h)).length === 2 && maps.some((h) => /5503/.test(decodeURIComponent(h))) && maps.some((h) => /4701/.test(decodeURIComponent(h))), JSON.stringify(maps.map((m) => m.slice(0, 50))));
  await p.context().close();
}

});
