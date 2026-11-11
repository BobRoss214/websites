// order: 80
// browser: yes
// quick: yes
// covers: js/live.js, js/season.js, js/content.js, index.html, first-visit.html
/* "Open now" badges (hours, closures, Eastern Time, daylight saving), the winter hours of the Christmas tree weekends with "Not official yet" next to them, the
 * next-season countdown and the notice bar. Oct 2 2026 is a Friday; New York is UTC-4 until Nov 1, then UTC-5. */
import { run, open, ok, okSoon } from './lib.mjs';

await run('live', async ({ browser, base, errs }) => {
  const p = await open(browser, base, 'index.html', errs);
  await p.waitForFunction(() => window.WISE_ACRES && window.WISE_ACRES.live && window.WISE_ACRES.live.status);
  const st = (name, iso) => p.evaluate(([n, i]) => { const s = WISE_ACRES.live.status(n, new Date(i)); return s && (s.state + ' | ' + s.text); }, [name, iso]);
  const GH = 'greenhouse';

  ok('Fri 11:30 ET: The GreenHouse is open until 8 pm', (await st(GH, '2026-10-02T15:30:00Z')).startsWith('open | Open now, until 8 pm'), await st(GH, '2026-10-02T15:30:00Z'));
  ok('Fri 08:00 ET: opens today at 10 am', (await st(GH, '2026-10-02T12:00:00Z')).startsWith('soon | Opens today at 10 am'), await st(GH, '2026-10-02T12:00:00Z'));
  const after = await st(GH, '2026-10-03T00:30:00Z');
  ok('Fri 20:30 ET: closed, opens tomorrow', after === 'closed | Closed now. Opens tomorrow at 10 am', after);
  const mon = await st(GH, '2026-10-05T16:00:00Z');
  ok('Mon noon ET: closed, opens Friday', mon === 'closed | Closed today. Opens Friday at 10 am', mon);
  const pz = await st('pizza', '2026-10-02T19:00:00Z');
  ok('Pizza at 3 pm: opens at 4 pm', pz === 'soon | Opens today at 4 pm', pz);
  ok('Pizza at 6 pm: open until 8 pm', (await st('pizza', '2026-10-02T22:00:00Z')).startsWith('open | Open now, until 8 pm'));
  const farmThu = await st('farm', '2026-10-01T16:00:00Z'), farmMon = await st('farm', '2026-10-05T16:00:00Z');
  ok('Farm on a Thursday in fall: reserved visits', farmThu === 'open | Reserved visits today', farmThu);
  ok('Farm on a Monday: next reserved day is Thursday', farmMon === 'closed | No visits today. Next reserved day: Thursday', farmMon);
  ok('Farm badge hidden outside fall', await p.evaluate(() => WISE_ACRES.live.status('farm', new Date('2026-05-05T16:00:00Z')) === null));
  ok('Winter time (EST, after Nov 1): 10:30 ET is 15:30Z and still open', (await st(GH, '2026-11-06T15:30:00Z')).startsWith('open'));

  await p.evaluate(() => { WISE_ACRES.closures.push('2026-10-02'); });
  const cl = await st(GH, '2026-10-02T15:30:00Z');
  ok('a closure date closes the day', cl === 'closed | Closed today. Opens tomorrow at 10 am', cl);

  const cd = await p.evaluate(() => ({ next: document.querySelector('[data-cd-next]').textContent, days: document.querySelector('[data-cd-days]').textContent, vis: !document.querySelector('[data-countdown]').hidden }));
  ok('next-season countdown shows', cd.vis && +cd.days > 20, JSON.stringify(cd));
  ok('badges are drawn', (await p.locator('.live:not([hidden])').count()) >= 3);
  ok('the hero shows the same "open now" badges for the farm and The GreenHouse', (await p.locator('.hero-live [data-live=farm]:not([hidden])').count()) === 1 && (await p.locator('.hero-live [data-live=greenhouse]:not([hidden])').count()) === 1);
  ok('the menu has a "First-visit guide" link to the short guide on this page (#first-visit), which exists', (await p.locator('#nav a[href="#first-visit"]').count()) >= 1 && (await p.locator('main > section#first-visit').count()) === 1);

  // The little "Next" tag on the season buttons is on the season that the countdown (and, between seasons, the top bar) call "Next up"; "Now" is on the season that is on.
  // A page left open past midnight moves them: js/live.js announces the new day, js/hero.js draws the tags again.
  const tagged = () => p.evaluate(() => { const b = document.querySelector('#season-switch .ss-next'), s = b && WISE_ACRES.seasons.list.find((x) => x.id === b.parentElement.dataset.season); return { crop: s ? s.crop : '', now: !!document.querySelector('#season-switch .ss-now'), cd: document.querySelector('[data-cd-next]').textContent, bar: document.querySelector('[data-ann-season]').textContent }; });
  const inFall = await tagged();
  ok('fall (Oct 2): "now" is on Fall and the "next" tag is on the season that the countdown calls "Next up"', inFall.now && inFall.crop === 'Christmas trees at The GreenHouse' && inFall.cd.includes(inFall.crop), JSON.stringify(inFall));
  await p.clock.setSystemTime(new Date('2026-11-09T00:30:00-05:00'));   // the page was left open past the last day of fall
  await p.clock.runFor(61000);
  const between = await tagged();
  ok('the day after fall: the "now" tag is gone, "next" stays on Winter, and the countdown and the top bar say the same (Next up)', !between.now && between.crop === 'Christmas trees at The GreenHouse' && between.cd.includes(between.crop) && between.bar.includes(between.crop), JSON.stringify(between));

  // Winter: the Christmas tree weekends (the last weekend in November and the first weekend in December, Saturday and Sunday only; this year Nov 28-29 and Dec 5-6).
  // The GreenHouse and Wise Pie are open 11 am to 8 pm with "Not official yet" right after the hours; the farm is open with no reservation and says no hours.
  const badges = () => p.evaluate(() => Array.from(document.querySelectorAll('[data-live]')).filter((e) => !e.hidden).map((e) => {
    const tx = e.querySelector('.live-text'), last = tx && tx.lastElementChild;
    return { k: e.dataset.live, text: e.textContent.replace(/\s+/g, ' ').trim(), label: !!(last && last.classList.contains('not-official')), labels: e.querySelectorAll('.not-official').length };
  }));
  const at = async (iso) => { await p.clock.setSystemTime(new Date(iso)); await p.clock.runFor(61000); };
  await at('2026-11-28T12:00:00-05:00');
  let b = await badges();
  const by = (k) => b.filter((x) => x.k === k);
  // the top bar, the countdown and the line under the farm picker say "In season" / "Happening now" on a tree day, and on the days between the weekends they name the next tree day
  const words = () => p.evaluate(() => { const t = (q) => ((document.querySelector(q) || {}).textContent || '').replace(/\s+/g, ' ').trim(); return { bar: t('[data-ann-season]'), now: t('[data-cd-now]'), next: t('[data-cd-next]'), days: t('[data-cd-days]'), fact: t('#fact-season') }; });
  const sat = await words();
  ok('Sat Nov 28 (a tree day): the top bar says "In season: Christmas trees at The GreenHouse", the countdown "Happening now: ...", the line under the farm picker "... happening now"',
    sat.bar === 'In season: Christmas trees at The GreenHouse' && sat.now === 'Happening now: Christmas trees at The GreenHouse' && sat.fact === 'Christmas trees at The GreenHouse \u2014 happening now', JSON.stringify(sat));
  ok('Sat Nov 28 noon (the first tree day): The GreenHouse badges (hero, "Two places", The GreenHouse section) say "Open now, until 8 pm Not official yet", the label is the last thing after the hours',
    by('greenhouse').length >= 3 && by('greenhouse').every((x) => x.text === 'Open now, until 8 pm Not official yet' && x.label && x.labels === 1), JSON.stringify(by('greenhouse')));
  ok('...and Wise Pie says the same, with the label (no pizza hours of its own: it follows The GreenHouse)', by('pizza').length >= 2 && by('pizza').every((x) => x.text === 'Open now, until 8 pm Not official yet' && x.label), JSON.stringify(by('pizza')));
  ok('...and the farm badges say "Open today. No reservation needed" with no label and no hours', by('farm').length >= 2 && by('farm').every((x) => x.text === 'Open today. No reservation needed' && !x.label && x.labels === 0), JSON.stringify(by('farm')));
  await p.evaluate(() => WISE_ACRES.setLang('es'));
  await okSoon('in Spanish the label is "Aún no es oficial", still right after the hours', () => badges().then((l) => l.filter((x) => x.k === 'greenhouse' || x.k === 'pizza')), (l) => l.length >= 5 && l.every((x) => /Abierto ahora, hasta las 8 p\. ?m\.? Aún no es oficial$/.test(x.text) && x.label));
  await p.evaluate(() => WISE_ACRES.setLang('en'));
  // the pumpkin patch page and the first-visit page are written for reservations: they leave the farm badge out while the winter season is in progress, and show it in fall
  for (const pg of ['pumpkin-patch.html', 'first-visit.html']) {
    const q = await open(browser, base, pg, errs, { time: '2026-11-28T12:00:00-05:00' }), q2 = await open(browser, base, pg, errs, { time: '2026-10-02T12:00:00-04:00' });
    const shown = (x) => x.evaluate(() => [...document.querySelectorAll('[data-live=farm]')].filter((e) => !e.hidden).map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
    ok(pg + ': on a tree day the farm badge is left out (data-live-not="winter"), on a fall day it says "Reserved visits today"', (await shown(q)).length === 0 && (await shown(q2)).join() === 'Reserved visits today', JSON.stringify([await shown(q), await shown(q2)]));
    await q.context().close(); await q2.context().close();
  }
  await at('2026-12-02T12:00:00-05:00');
  b = await badges();
  ok('Wed Dec 2 (inside the season, between the weekends): The GreenHouse and Wise Pie say when they open next (Saturday, 11 am), the farm says its next open day, the label stays with the 11 am',
    by('greenhouse').every((x) => x.text === 'Closed today. Opens Saturday at 11 am Not official yet') && by('pizza').every((x) => x.text === 'Closed today. Opens Saturday at 11 am Not official yet') && by('farm').every((x) => x.text === 'Closed today. Next open day: Saturday'), JSON.stringify(b));
  const gap = await words();
  ok('Wed Dec 2 (between the weekends: the winter season is on, the trees are not): the top bar, the countdown and the line under the farm picker name the next tree day instead of "In season" or "Happening now"',
    gap.bar === 'Next up: Christmas trees at The GreenHouse, usually Sat, Dec 5' && gap.now === '' && gap.next === 'Next up: Christmas trees at The GreenHouse. Usually starts Sat, Dec 5.' && gap.days === '3'
      && gap.fact === 'Next up: Christmas trees at The GreenHouse (Sat, Dec 5)', JSON.stringify(gap));
  await p.evaluate(() => WISE_ACRES.setLang('es'));
  const gapEs = await words();
  ok('...in Spanish too (the same words as before the first weekend, with the date of the next tree day), and never "De temporada" or "Ahora mismo"', /^Próximo: .*, normalmente sáb, 5 dic$/.test(gapEs.bar) && gapEs.now === '' && !/De temporada|Ahora mismo/.test(gapEs.bar + gapEs.next + gapEs.fact) && /5 dic/.test(gapEs.fact), JSON.stringify(gapEs));
  await p.evaluate(() => WISE_ACRES.setLang('en'));
  await at('2026-12-06T21:00:00-05:00');
  b = await badges();
  ok('Sun Dec 6 at 9 pm (the last tree day, after closing): the next opening named is the usual one ("Opens Friday at 10 am"), no label anywhere; the farm badge has no hours, so it still says it is open today until midnight', by('greenhouse').every((x) => x.text === 'Closed now. Opens Friday at 10 am' && x.labels === 0) && by('pizza').every((x) => x.text === 'Closed now. Opens Friday at 4 pm' && x.labels === 0) && by('farm').length > 0 && by('farm').every((x) => x.text === 'Open today. No reservation needed') && b.every((x) => x.labels === 0), JSON.stringify(b));
  await at('2026-11-10T12:00:00-05:00');
  b = await badges();
  ok('Tue Nov 10 (fall is over, the trees are not on yet): the usual hours, no label, no farm badge', by('greenhouse').every((x) => x.text === 'Closed today. Opens Friday at 10 am' && x.labels === 0) && by('farm').length === 0, JSON.stringify(b));

  // notice bar: shows, expires by date, and can be written per language
  await p.evaluate(() => { WISE_ACRES.notice = 'Closed Sunday for rain.'; WISE_ACRES.live.refresh(); });
  ok('notice bar appears', await p.isVisible('#site-notice'));
  await p.evaluate(() => { WISE_ACRES.noticeUntil = '2020-01-01'; WISE_ACRES.live.refresh(); });
  ok('notice expires after noticeUntil', (await p.locator('#site-notice').count()) === 0);
  await p.evaluate(() => { WISE_ACRES.noticeUntil = ''; WISE_ACRES.notice = { en: 'Closed Sunday for rain.', es: 'Cerrado el domingo por lluvia.' }; WISE_ACRES.live.refresh(); });
  ok('notice written as { en, es }: English visitors get English', ((await p.textContent('#site-notice .sn-text')) || '').trim() === 'Closed Sunday for rain.');
  await p.evaluate(() => WISE_ACRES.setLang('es'));
  await okSoon('notice written as { en, es }: Spanish visitors get Spanish', () => p.evaluate(() => (document.querySelector('#site-notice .sn-text') || {}).textContent), (v) => v === 'Cerrado el domingo por lluvia.');
  await p.context().close();
});
