/* "Open now" badges (hours, closures, Eastern Time, daylight saving), the next-season countdown and the notice bar.
 * Oct 2 2026 is a Friday; New York is UTC-4 until Nov 1, then UTC-5. */
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
  ok('the menu has a "First-visit guide" link to first-visit.html', (await p.locator('#nav a[href="first-visit.html"]').count()) >= 1);

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
