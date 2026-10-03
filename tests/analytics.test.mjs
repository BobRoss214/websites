/* Privacy-friendly analytics: nothing happens until a provider is chosen; with ?track=debug the events the README lists are recorded
 * (Review click, Press click, Waitlist click, Reminder added, Map select, Signup submit, Email signup click, Directions click, ...). */
import { run, open, ok, okSoon, until } from './lib.mjs';

const EXTRA = `WISE_ACRES.week = { updated: '2026-10-01', days: [ { date: '2026-10-03', farm: 'full', pizza: 'full' } ] }; WISE_ACRES.signup.demo = true;`;
const log = (p) => p.evaluate(() => (window.WISE_ACRES.analyticsLog || []).map((e) => e.name + (e.props && Object.keys(e.props).length ? ' ' + JSON.stringify(e.props) : '')));

await run('analytics', async ({ browser, base, errs }) => {
  // off by default: no log, no provider script
  let p = await open(browser, base, 'index.html', errs);
  ok('off by default (no log, no provider script)', await p.evaluate(() => !window.WISE_ACRES.analyticsLog && !document.querySelector('script[data-domain],script[data-goatcounter],script[data-website-id],script[data-cf-beacon]')));
  ok('track() is not defined while analytics is off', await p.evaluate(() => !window.WISE_ACRES.track));
  await p.context().close();

  // do-not-track visitors are never counted, even with a provider chosen
  p = await open(browser, base, 'index.html', errs, { extra: `WISE_ACRES.analytics = { provider: 'plausible', site: 'example.com' };`, routes: async (pg) => { await pg.addInitScript(() => Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' })); } });
  ok('Do Not Track: no provider script is added', await p.evaluate(() => !document.querySelector('script[data-domain]')));
  await p.context().close();

  // debug mode records the events
  p = await open(browser, base, 'index.html?track=debug', errs, { time: '2026-10-01T15:00:00-04:00', extra: EXTRA });
  await p.addStyleTag({ content: 'html{scroll-behavior:auto!important}.action-bar{display:none!important}' });
  await p.evaluate(() => document.addEventListener('click', (e) => { if (e.target.closest('a[href]')) e.preventDefault(); }));   // links must not leave the page
  // Look the element up and click it in one step inside the page: the page redraws boxes now and then (this week, the countdown), and on a slow computer
  // a link found a moment ago can already be gone, and a click on a removed link records nothing.
  const click = async (sel) => { await until(p, (s) => !!document.querySelector(s), sel, 20000); await p.evaluate((s) => document.querySelector(s).click(), sel); };
  await click('.hero-cta a.btn-red');
  await click('#season-switch button[data-season="winter"]');
  await click('a[data-review]');
  await click('.press-list a');
  await click('[data-week-days] a[data-track="Waitlist click"]');
  await click('[data-rel-remind]'); await click('[data-rel-google]');
  await click('[data-rel-remind]'); await click('[data-rel-ics]');
  await click('#farm-map .map-legend button');
  await click('a[href*="google.com/maps/dir"]'); await click('a[href*="maps.apple.com"]'); await click('a[href*="waze.com/ul"]');
  await p.locator('#signup').scrollIntoViewIfNeeded();
  await p.fill('#su-email', 'mom@example.com'); await p.check('input[value=pumpkins]'); await p.click('[data-signup] button[type=submit]');
  await p.evaluate(() => document.querySelector('#faq').scrollIntoView());
  const WANT = ['Reserve click', 'Season preview', 'Review click', 'Press click', 'Waitlist click', 'Reminder added {"type":"google"}', 'Reminder added {"type":"ics"}', 'Map select', 'Signup submit {"interests":1}', 'Section view {"section":"faq"}'];
  await okSoon('events recorded', async () => { const l = await log(p); return { missing: WANT.filter((x) => !l.some((e) => e.startsWith(x))), recorded: l.length }; }, (v) => v.missing.length === 0, 45000);
  const l = await log(p);
  ok('Directions click is recorded for the Google, Apple Maps and Waze links (one event name)', l.filter((e) => e.startsWith('Directions click')).length >= 3, JSON.stringify(l.filter((e) => e.startsWith('Directions'))));
  ok('Season preview names the season', l.some((e) => e === 'Season preview {"season":"winter"}'));
  await p.context().close();

  // the old signup button (when Mailchimp is not connected) is counted too
  p = await open(browser, base, 'index.html?track=debug', errs);
  await p.evaluate(() => document.addEventListener('click', (e) => { if (e.target.closest('a[href]')) e.preventDefault(); }));
  await p.locator('[data-signup-fallback]').evaluate((a) => a.click());
  await okSoon('"Email signup click" is recorded for the old signup button', () => log(p), (x) => x.some((e) => e.startsWith('Email signup click')));
  await p.context().close();
});
