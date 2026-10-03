/* Privacy-friendly analytics: nothing happens until a provider is chosen; with ?track=debug the events the README lists are recorded
 * (Review click, Press click, Waitlist click, Reminder added, Map select, Signup submit, Email signup click, Directions click, ...).
 * Also, with a dummy id for each provider and stand-in provider scripts: what exactly is handed to Plausible, GoatCounter and Umami, event names
 * and details (no address, email or free text ever), Do Not Track and Global Privacy Control in every spelling, a blocked or broken provider script
 * never breaks the page, and with analytics off (the default) not one request leaves the site and nothing is stored. */
import { run, open, ok, okSoon, until } from './lib.mjs';

const EXTRA = `WISE_ACRES.week = { updated: '2026-10-01', days: [ { date: '2026-10-03', farm: 'full', pizza: 'full' } ] }; WISE_ACRES.signup.demo = true; WISE_ACRES.seasonPicker = true;`;   // the test clicks the season switcher
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

  /* ---------------------------------------------------------------- providers, event names and details, Do Not Track, broken scripts */
  const PROV = {
    plausible: { cfg: `WISE_ACRES.analytics = { provider: 'plausible', site: 'dummy.example' };`, host: 'plausible.io', attr: 'data-domain', val: 'dummy.example' },
    goatcounter: { cfg: `WISE_ACRES.analytics = { provider: 'goatcounter', endpoint: 'https://dummy.goatcounter.com/count' };`, host: 'gc.zgo.at', attr: 'data-goatcounter', val: 'https://dummy.goatcounter.com/count' },
    umami: { cfg: `WISE_ACRES.analytics = { provider: 'umami', site: 'dummy-website-id', src: 'https://umami.example/script.js' };`, host: 'umami.example', attr: 'data-website-id', val: 'dummy-website-id' },
    cloudflare: { cfg: `WISE_ACRES.analytics = { provider: 'cloudflare', token: 'dummy-token' };`, host: 'static.cloudflareinsights.com', attr: 'data-cf-beacon', val: '{"token":"dummy-token"}' },
  };
  // stand-ins for the providers' own scripts: they record what the site hands them (window.__prov)
  const STUB = {
    'plausible.io': `window.__prov = []; (window.plausible && window.plausible.q || []).forEach((a) => window.__prov.push(['plausible'].concat(Array.from(a)))); window.plausible = function () { window.__prov.push(['plausible'].concat(Array.from(arguments))); };`,
    'gc.zgo.at': `window.__prov = []; window.goatcounter = { count: function (o) { window.__prov.push(['goatcounter', o]); } };`,
    'umami.example': `window.__prov = []; window.umami = { track: function (n, p) { window.__prov.push(['umami', n, p]); } };`,
    'static.cloudflareinsights.com': `window.__prov = [];`,
  };
  const PROBE = 'ANALYTICSPROBE 99 Nowhere Rd, Zzyzx, NC 11111', MAIL = 'analytics-probe@example.com';
  // opens the home page with a provider chosen; every other site is answered by a stand-in (nothing leaves this computer) and logged
  async function withProvider(cfg, o = {}) {
    const seen = [];
    const pg = await open(browser, base, 'index.html' + (o.query ? '?' + o.query : ''), errs, {
      time: '2026-10-01T15:00:00-04:00', extra: (cfg || '') + '\n' + EXTRA, lang: o.lang,
      routes: async (page) => {
        if (o.init) await page.addInitScript(o.init);
        await page.context().route((u) => u.protocol.startsWith('http') && !u.href.startsWith(base), async (route) => {
          const rq = route.request(), u = new URL(rq.url()), cors = { 'access-control-allow-origin': '*' };
          seen.push({ host: u.host, type: rq.resourceType(), url: rq.url() });
          if (o.block && rq.resourceType() === 'script') return o.block === 'abort' ? route.abort('blockedbyclient') : route.fulfill({ status: 500, body: 'no' });
          if (/nominatim/.test(u.host)) return route.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify([{ lat: '34.9854', lon: '-80.5495', display_name: '100 Main Street, Monroe' }]) });
          if (/osrm/.test(u.host)) return route.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify({ code: 'Ok', routes: [{ distance: 22853, duration: 1432 }] }) });
          if (rq.resourceType() === 'script') return route.fulfill({ contentType: 'application/javascript', body: STUB[u.host] || '' });
          return route.fulfill({ status: 204, body: '' });
        });
      },
    });
    return { pg, seen };
  }
  const tap = (pg, sel) => pg.evaluate(async (s) => { const deadline = Date.now() + 15000; let el; while (!(el = document.querySelector(s)) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50)); if (!el) return false; el.click(); return true; }, sel);
  // a visit that makes most events: links, season, hero, map, reminders, Drive time, signup, language
  async function useSite(pg) {
    await pg.addStyleTag({ content: 'html{scroll-behavior:auto!important}.action-bar{display:none!important}' });
    await pg.evaluate(() => document.addEventListener('click', (e) => { if (e.target.closest('a[href]')) e.preventDefault(); }));
    for (const sel of ['.hero-cta a.btn-red', 'a[href^="mailto:"]', 'a[href*="google.com/maps/dir"]', 'a[href*="square.site"]', 'a[href*="instagram.com"]', 'a[href*="facebook.com"]', 'a[href^="tel:"]', 'a[href*="docs.google.com/forms"]', 'a[data-review]', '.press-list a', '#season-switch button[data-season="winter"]', '#pick-btn', '#farm-map .map-legend button', '[data-rel-remind]']) await tap(pg, sel);
    await tap(pg, '[data-rel-ics]'); await tap(pg, '[data-rel-remind]'); await tap(pg, '[data-rel-google]');
    await pg.locator('#drive-form').scrollIntoViewIfNeeded();
    await pg.fill('#drive-addr', PROBE); await pg.click('#drive-form button[type=submit]');
    await until(pg, () => document.querySelector('#drive-result')?.getAttribute('data-kind') === 'ok', null, 20000);
    await pg.locator('#signup').scrollIntoViewIfNeeded();
    await pg.fill('#su-email', MAIL); await pg.check('input[value=pumpkins]'); await pg.click('[data-signup] button[type=submit]');
    await until(pg, () => /Preview only/.test(document.querySelector('[data-signup-msg]')?.textContent || ''), null, 15000);
    await tap(pg, '.lang-btn'); await tap(pg, '.lang-list [data-lang="es"]');
    await until(pg, () => document.documentElement.lang.startsWith('es'), null, 15000);
  }

  // off by default: no request to any other site, nothing stored, even after using everything
  {
    const { pg, seen } = await withProvider('');
    await useSite(pg);
    ok('analytics off (default): the only other sites contacted are the ones a button press allows (address search, route server), no analytics address', seen.every((x) => /nominatim|osrm/.test(x.host)) && seen.length >= 2, JSON.stringify(seen.map((x) => x.host)));
    ok('analytics off: no log, no track(), no provider script', await pg.evaluate(() => !window.WISE_ACRES.analyticsLog && !window.WISE_ACRES.track && !document.querySelector('script[data-domain],script[data-goatcounter],script[data-website-id],script[data-cf-beacon]')));
    ok('analytics off: nothing stored but the language the visitor picked', await pg.evaluate(() => Object.keys(localStorage).join() === 'wa.lang' && sessionStorage.length === 0 && document.cookie === ''));
    await pg.context().close();
  }
  // each provider: the right script, the right events, nothing personal
  const allEvents = [];
  for (const [name, P] of Object.entries(PROV)) {
    const { pg, seen } = await withProvider(P.cfg);
    await useSite(pg);
    const scripts = await pg.evaluate(() => [...document.querySelectorAll('script[src^="http"]')].map((s) => ({ src: s.src, attrs: Object.fromEntries([...s.attributes].filter((a) => a.name.startsWith('data-')).map((a) => [a.name, a.value])) })));
    ok(`${name}: a finished choice gives no analytics warning in the Site check box`, !/analytics/.test(await pg.evaluate(() => (document.querySelector('#wa-problems') || {}).textContent || '')));
    ok(`${name}: exactly one provider script, from ${P.host}, with the dummy id`, scripts.length === 1 && new URL(scripts[0].src).host === P.host && scripts[0].attrs[P.attr] === P.val, JSON.stringify(scripts));
    ok(`${name}: no other analytics address is contacted`, seen.every((x) => x.host === P.host || /nominatim|osrm/.test(x.host)), JSON.stringify([...new Set(seen.map((x) => x.host))]));
    const events = await pg.evaluate(() => window.WISE_ACRES.analyticsLog.map((e) => ({ name: e.name, props: e.props })));
    allEvents.push(...events);
    const delivered = await pg.evaluate(() => JSON.parse(JSON.stringify(window.__prov || [])));
    if (name === 'cloudflare') ok('cloudflare: page views only, so no event is handed to it', delivered.length === 0, JSON.stringify(delivered.slice(0, 2)));
    else {
      ok(`${name}: the events are handed to the provider's own function`, delivered.length >= 12 && delivered.length === events.length, `${delivered.length} of ${events.length}`);
      if (name === 'plausible') ok('plausible: name plus {props} (for example Season preview {season})', delivered.some((d) => d[1] === 'Season preview' && d[2] && d[2].props && d[2].props.season === 'winter') && delivered.every((d) => typeof d[1] === 'string' && d[2] && d[2].props), JSON.stringify(delivered[0]));
      if (name === 'goatcounter') ok('goatcounter: path "event/<name>[/<where on the page>]" and nothing else (no season, language, kind or count)', delivered.every((d) => /^event\/[A-Za-z _-]+(\/[a-z-]+)?$/.test(d[1].path) && d[1].event === true && Object.keys(d[1]).sort().join() === 'event,path,title'), JSON.stringify(delivered.slice(0, 2)));
      if (name === 'umami') ok('umami: name plus the same details', delivered.some((d) => d[1] === 'Season preview' && d[2].season === 'winter'), JSON.stringify(delivered[0]));
    }
    await pg.context().close();
  }
  const names = [...new Set(allEvents.map((e) => e.name))];
  ok('events seen across the providers cover the README list (links, reminders, map, signup, season, language, hero, Drive time, sections)', ['Reserve click', 'Email click', 'Directions click', 'Pizza pre-order click', 'Instagram click', 'Facebook click', 'Phone click', 'School tour form click', 'Review click', 'Press click', 'Reminder added', 'Map select', 'Signup submit', 'Season preview', 'Language change', 'Hero played', 'Drive time', 'Section view'].every((n) => names.includes(n)), 'missing: ' + ['Reserve click', 'Email click', 'Directions click', 'Pizza pre-order click', 'Instagram click', 'Facebook click', 'Phone click', 'School tour form click', 'Review click', 'Press click', 'Reminder added', 'Map select', 'Signup submit', 'Season preview', 'Language change', 'Hero played', 'Drive time', 'Section view'].filter((n) => !names.includes(n)).join(', '));
  ok('event names are written one way: capital letter, then plain words (no snake_case, no punctuation)', names.every((n) => /^[A-Z][a-z]+( [a-z-]+)*$/.test(n)), names.filter((n) => !/^[A-Z][a-z]+( [a-z-]+)*$/.test(n)).join(', '));
  const allowedProps = { where: /^[a-z][a-z0-9-]*$/, section: /^[a-z][a-z0-9-]*$/, season: /^(spring|summer|fall|winter)$/, lang: /^(en|es|hi|zh|vi)$/, type: /^(ics|google)$/, kind: /^[a-z][a-z-]*$/, interests: /^\d+$/, to: /^(farm|greenhouse)$/ };
  const badProps = allEvents.flatMap((e) => Object.entries(e.props || {}).filter(([k, v]) => !allowedProps[k] || !allowedProps[k].test(String(v))).map(([k, v]) => `${e.name}.${k}=${v}`));
  ok('event details are only short fixed words or counts: where, section, season, lang, type, kind, interests, to', badProps.length === 0, badProps.slice(0, 5).join(', '));
  ok('no event contains the typed address or the email address', !/ANALYTICSPROBE|Zzyzx|Nowhere|analytics-probe|@/i.test(JSON.stringify(allEvents)));
  // Do Not Track and Global Privacy Control, every spelling
  for (const [label, init, honoured] of [
    ['doNotTrack "1"', () => Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' }), true],
    ['doNotTrack "yes" (old Firefox)', () => Object.defineProperty(navigator, 'doNotTrack', { get: () => 'yes' }), true],
    ['window.doNotTrack "1" (old Safari)', () => { window.doNotTrack = '1'; }, true],
    ['msDoNotTrack "1" (Internet Explorer, old Edge)', () => Object.defineProperty(navigator, 'msDoNotTrack', { get: () => '1' }), true],
    ['Global Privacy Control', () => Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true }), true],
    ['doNotTrack "0" (the visitor has not asked)', () => Object.defineProperty(navigator, 'doNotTrack', { get: () => '0' }), false],
  ]) {
    const { pg, seen } = await withProvider(PROV.plausible.cfg, { init });
    await tap(pg, '#season-switch button[data-season="winter"]');
    const scripted = seen.some((x) => x.host === 'plausible.io'), tracked = await pg.evaluate(() => !!window.WISE_ACRES.track);
    ok(`${label}: ${honoured ? 'no provider script, no events' : 'counted as normal'}`, honoured ? !scripted && !tracked : scripted && tracked, `script ${scripted}, track ${tracked}`);
    await pg.context().close();
  }
  { // a Do Not Track visitor with ?track=debug: events are only listed in memory/console, nothing is sent
    const { pg, seen } = await withProvider(PROV.plausible.cfg, { query: 'track=debug', init: () => Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' }) });
    await tap(pg, '#season-switch button[data-season="winter"]');
    await okSoon('Do Not Track plus ?track=debug: nothing is sent (the events stay in the page)', async () => ({ sent: seen.some((x) => x.host === 'plausible.io'), logged: await pg.evaluate(() => window.WISE_ACRES.analyticsLog.length) }), (v) => !v.sent && v.logged > 0);
    await pg.context().close();
  }
  { // a language link opens the page in another language: that counts as a language change
    const { pg } = await withProvider(PROV.plausible.cfg, { lang: 'es' });
    await okSoon('a page opened in Spanish counts one Language change {lang: es}', () => log(pg), (l) => l.includes('Language change {"lang":"es"}'));
    await pg.context().close();
  }
  // a provider script that is blocked or answers with an error never breaks the page, and the site keeps working
  for (const block of ['abort', '500']) for (const name of ['plausible', 'goatcounter', 'umami']) {
    const { pg } = await withProvider(PROV[name].cfg, { block });
    await useSite(pg);
    ok(`${name}: script ${block === 'abort' ? 'blocked by an ad blocker' : 'answers 500'}: the page still works (Drive time answered, language changed) and the site's own code reports no error`, await pg.evaluate(() => document.documentElement.lang.startsWith('es') && document.querySelector('#drive-result')?.getAttribute('data-kind') === 'ok' && typeof window.WISE_ACRES.track === 'function'));
    await pg.context().close();
  }
  { // a provider that is chosen but not finished (no id, unknown name) adds no script and sends nothing
    for (const cfg of [`WISE_ACRES.analytics = { provider: 'plausible' };`, `WISE_ACRES.analytics = { provider: 'umami', site: 'x' };`, `WISE_ACRES.analytics = { provider: 'nonsense', site: 'x' };`]) {
      const { pg, seen } = await withProvider(cfg);
      await tap(pg, '#season-switch button[data-season="winter"]');
      ok(`unfinished choice (${cfg.replace('WISE_ACRES.analytics = ', '').slice(0, 40)}): no script, nothing sent`, seen.length === 0 && (await pg.evaluate(() => !document.querySelector('script[src^="http"]'))), JSON.stringify(seen));
      ok('unfinished choice: the yellow Site check box says "Nothing is counted"', /analytics\.[a-z]+.*Nothing is counted/.test(await pg.evaluate(() => (document.querySelector('#wa-problems') || {}).textContent || '')), await pg.evaluate(() => (document.querySelector('#wa-problems') || {}).textContent || 'no box'));
      await pg.context().close();
    }
  }
});
