// order: 210
// browser: yes
// covers: js/*.js, *.html, _headers, docs/WHAT_THE_SITE_STORES.md, docs/LAUNCH_CHECKLIST.md
/* Privacy: what the site keeps in a visitor's browser and which other sites it contacts, checked against the allow-lists below.
 * Fails when a new storage key, cookie, IndexedDB / Cache Storage entry or service worker shows up, when another site is contacted that is not on the
 * list or before the visitor presses the button that allows it, when the address typed into the Drive time box is stored or sent anywhere but the address
 * search, when the shipped files mention a site or a storage call that is not on the list, or when the documented Content-Security-Policy would block
 * something the site really does. docs/WHAT_THE_SITE_STORES.md is the human version of these lists: change both together. Needs a browser. */
import fs from 'node:fs';
import path from 'node:path';
import { run, open, ok, okSoon, until, info, ROOT, ms } from './lib.mjs';

/* ------------------------------------------------------------------ the allow-lists (keep in step with docs/WHAT_THE_SITE_STORES.md, sections 1 to 3) */
// What the site may keep in localStorage: key -> what a value may look like. Nothing else (no cookies, sessionStorage, IndexedDB, Cache Storage, service worker).
const KEYS = {
  'wa.lang': /^(en|es|hi|zh|vi)$/,                              // the language the visitor picked
  'wa.offer': /^1$/,                                           // "No, thanks" to the language question
  'wa.checklist': /^\[(true|false)(,(true|false))*\]$/,        // the First-visit "what to bring" ticks
};
// Other sites the running site may contact, and the visitor's action that allows it ("phase" below). Nothing is contacted while a page is just read.
const HOSTS = [
  { host: /^nominatim\.openstreetmap\.org$/, phase: 'drive', what: 'address search (Get drive time)' },
  { host: /^router\.project-osrm\.org$/, phase: 'drive', what: 'route server (Get drive time)' },
  { host: /\.list-manage\.com$/, phase: 'signup', what: 'Mailchimp (Join the email list, only when signup.action is set)' },
  { host: /^calendar\.google\.com$/, phase: 'google-reminder', what: 'Add to Google Calendar (opens when tapped)' },
];
// Web addresses that may be written in the shipped files: links a visitor taps, credits, structured data, and the examples in comments. A NEW site here
// needs a decision (and a line in docs/WHAT_THE_SITE_STORES.md section 5).
const WRITTEN_HOSTS = new Set([
  'www.wiseacresorganic.com', 'bookeo.com', 'www.google.com', 'www.instagram.com', 'eepurl.com', 'www.facebook.com', 'wise-pie-wood-fired-at-wise-acres.square.site',
  'waze.com', 'maps.apple.com', 'docs.google.com', 'calendar.google.com', 'www.openstreetmap.org', 'nominatim.openstreetmap.org', 'router.project-osrm.org', 'project-osrm.org',
  'www.axios.com', 'www.yelp.com', 'www.tripadvisor.com', 'g.page',
  'plausible.io', 'gc.zgo.at', 'static.cloudflareinsights.com',                   // analytics providers (js/analytics.js, off by default)
  'www.w3.org', 'schema.org', 'www.sitemaps.org',                                                      // XML and structured-data names, never contacted
  'YOURCODE.goatcounter.com', 'YOUR-UMAMI', 'NAME.us21.list-manage.com', 'other-site',   // examples in comments
]);
// Files that may use a browser storage or network API, and which one. Everything else must not.
const API_FILES = { 'js/i18n.js': ['localStorage'], 'js/main.js': ['localStorage'] };
const PROBE = 'SECRETPROBE 4242 Zephyr Lane, Zzyzxville, NC 99999';   // the "address" typed into the Drive time box
const MAIL = 'privacy-probe@example.com';
const MC = `WISE_ACRES.signup = { action: 'https://wiseacres.us21.list-manage.com/subscribe/post?u=U123&id=L456', interests: { pumpkins: 'group[1][2]' }, tags: '111', languageField: 'LANGUAGE' };`;
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const walk = (dir, ok2) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name), ok2) : ok2(e.name) ? [path.join(dir, e.name)] : []));
const publicFiles = [...fs.readdirSync(ROOT).filter((f) => /\.(html|webmanifest|txt|xml)$/.test(f)), ...walk('js', (n) => n.endsWith('.js')), ...walk('css', (n) => n.endsWith('.css')), ...walk('lang', (n) => n.endsWith('.js')), ...walk('print', (n) => n.endsWith('.html')), '_headers'];

/* ------------------------------------------------------------------ 1. what the shipped files say (no browser needed) */
{
  // every web address written in a shipped file is on the list
  const found = new Map();
  for (const f of publicFiles) for (const m of read(f).matchAll(/https?:\/\/([A-Za-z0-9][A-Za-z0-9._-]*)/g)) { if (!found.has(m[1])) found.set(m[1], f); }
  const unknown = [...found].filter(([h]) => !WRITTEN_HOSTS.has(h));
  ok('every web address in the shipped files is on the allow-list', unknown.length === 0, unknown.map(([h, f]) => h + ' (in ' + f + ')').join(', '));
  const stale = [...WRITTEN_HOSTS].filter((h) => !found.has(h));
  ok('the allow-list names no site that is no longer used', stale.length === 0, stale.join(', '));
  // nothing is loaded from another site: no script, stylesheet, picture, font or frame with an outside address
  const loads = [];
  for (const f of publicFiles.filter((x) => /\.html$/.test(x))) for (const m of read(f).matchAll(/<(script|link|img|iframe|source|video|audio|embed|object|input)\b[^>]*?\b(?:src|href|data|poster)\s*=\s*["']((?:https?:)?\/\/[^"']+)["']/gi)) { if (m[1].toLowerCase() !== 'link' || !/rel\s*=\s*["']?(canonical|alternate|me|author|license|help|next|prev)/i.test(m[0])) loads.push(f + ': <' + m[1] + '> ' + m[2]); }
  for (const f of publicFiles.filter((x) => /\.css$/.test(x))) for (const m of read(f).matchAll(/(?:url\(\s*["']?|@import\s+["']?)((?:https?:)?\/\/[^"')\s]+)/gi)) loads.push(f + ': ' + m[1]);
  ok('no page, stylesheet or font loads anything from another site (fonts are local)', loads.length === 0, loads.slice(0, 4).join(' | '));
  // no embedded frames, videos, audio or plug-ins; no file upload; the only places a visitor can type are the signup email and the Drive time address
  const embeds = [];
  for (const f of publicFiles.filter((x) => /\.(html|js)$/.test(x) && !x.startsWith('lang/'))) { const code = read(f); for (const m of code.matchAll(/<(iframe|video|audio|embed|object)\b|createElement\(\s*['"](iframe|video|audio|embed|object|form|textarea|select)['"]|type\s*=\s*["']file["']|FormData|FileReader/g)) embeds.push(m[0] + ' in ' + f); }
  ok('no iframe, video, audio, embed, object or file upload anywhere (no embedded maps or social posts; nobody can upload a photo)', embeds.length === 0, embeds.slice(0, 5).join(', '));
  const typing = [];
  for (const f of publicFiles.filter((x) => /\.html$/.test(x))) for (const m of read(f).matchAll(/<(input|textarea|select)\b[^>]*>/g)) { const tag = m[0], type = (/type\s*=\s*["']?(\w+)/.exec(tag) || [, 'text'])[1], id = (/\bid\s*=\s*["']([^"']+)/.exec(tag) || [, ''])[1]; if (!['checkbox', 'radio'].includes(type) && !['su-email', 'drive-addr'].includes(id)) typing.push(f + ' ' + tag.slice(0, 80)); }
  ok('the only text boxes are the signup email (#su-email) and the Drive time address (#drive-addr), as docs/WHAT_THE_SITE_STORES.md section 7 says', typing.length === 0, typing.join(' | '));
  // storage and network calls only where they are expected
  const apis = ['localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'cookieStore', 'caches.open', 'serviceWorker', 'sendBeacon', 'WebSocket', 'EventSource', 'XMLHttpRequest'];
  const stray = [];
  for (const f of [...publicFiles.filter((x) => /\.(js|html)$/.test(x) && !x.startsWith('lang/'))]) { const code = read(f); for (const a of apis) if (code.includes(a) && !(API_FILES[f] || []).includes(a)) stray.push(a + ' in ' + f); }
  ok('only js/i18n.js and js/main.js touch localStorage; nothing uses cookies, sessionStorage, IndexedDB, caches, service workers, beacons or sockets', stray.length === 0, stray.join(', '));
  // the keys written are the allowed ones
  const written = new Set(); for (const f of ['js/i18n.js', 'js/main.js']) for (const m of read(f).matchAll(/['"](wa\.[A-Za-z.]+)['"]/g)) written.add(m[1]);
  ok('the localStorage keys in the code are exactly the allowed keys', [...written].sort().join() === Object.keys(KEYS).sort().join(), [...written].join(', '));
  // the fact sheet lists the same keys and hosts
  const sheet = read('docs/WHAT_THE_SITE_STORES.md'), sec1 = sheet.slice(sheet.indexOf('## 1.'), sheet.indexOf('## 2.'));
  const documented = new Set([...sec1.matchAll(/^\| `(wa\.[A-Za-z.]+)`/gm)].map((m) => m[1]));
  ok('docs/WHAT_THE_SITE_STORES.md section 1 lists exactly the allowed storage keys', [...documented].sort().join() === Object.keys(KEYS).sort().join(), [...documented].join(', '));
  const undocumented = ['nominatim.openstreetmap.org', 'router.project-osrm.org', 'list-manage.com', 'calendar.google.com'].filter((h) => !sheet.includes(h));
  ok('docs/WHAT_THE_SITE_STORES.md names every site the page can contact', undocumented.length === 0, undocumented.join(', '));
  // headers
  const headers = read('_headers');
  ok('_headers: Referrer-Policy sends other sites at most the site name (strict-origin-when-cross-origin or stricter)', /^\s*Referrer-Policy:\s*(strict-origin-when-cross-origin|strict-origin|same-origin|no-referrer)\s*$/m.test(headers));
  ok('_headers: location, camera and microphone are switched off, and the site sets no cookie', /Permissions-Policy:.*geolocation=\(\)/.test(headers) && /camera=\(\)/.test(headers) && /microphone=\(\)/.test(headers) && !/set-cookie/i.test(headers));
}

await run('privacy', async ({ browser, base, errs }) => {
  const ORIGIN = base.replace(/\/$/, '');
  const hostOf = (u) => new URL(u).host.replace(/:\d+$/, '');
  // Opens a page with every request logged (own and other sites); answers for the other sites (nothing leaves this computer).
  async function visit(url, opts = {}) {
    const S = { phase: 'load', ext: [], own: [], popups: [] };
    const p = await open(browser, base, url, errs, {
      ...opts,
      routes: async (pg) => {
        const ctx = pg.context();
        ctx.on('request', (r) => { const u = r.url(); const rec = { u, ph: S.phase, ref: r.headers().referer || null, ck: !!r.headers().cookie, post: r.postData() || null, m: r.method() }; (u.startsWith(ORIGIN + '/') ? S.own : S.ext).push(rec); });
        await ctx.route((u) => u.protocol.startsWith('http') && !u.href.startsWith(ORIGIN + '/'), async (route) => {
          const u = new URL(route.request().url()), cors = { 'access-control-allow-origin': '*' };
          if (/nominatim/.test(u.host)) return route.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify([{ lat: '34.9854', lon: '-80.5495', display_name: '100 Main Street, Monroe' }]) });
          if (/osrm/.test(u.host)) return route.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify({ code: 'Ok', routes: [{ distance: 22853, duration: 1432 }] }) });
          if (/list-manage/.test(u.host)) return route.fulfill({ contentType: 'application/javascript', body: (u.searchParams.get('c') || 'x') + '(' + JSON.stringify({ result: 'success', msg: 'ok' }) + ');' });
          return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>stand-in</title>' });
        });
        ctx.on('page', (pp) => { if (pp !== pg) setTimeout(() => pp.close().catch(() => {}), 1200); });
        if (opts.routes) await opts.routes(pg, S);
      },
    });
    S.p = p;
    return S;
  }
  // everything the browser kept for this visit
  const kept = async (S) => {
    const p = S.p, ctx = p.context();
    const inPage = await p.evaluate(async () => {
      const o = { ls: {}, ss: {}, cookie: document.cookie, idb: [], caches: [], sw: 0, url: location.href };
      for (let i = 0; i < localStorage.length; i++) o.ls[localStorage.key(i)] = localStorage.getItem(localStorage.key(i));
      for (let i = 0; i < sessionStorage.length; i++) o.ss[sessionStorage.key(i)] = sessionStorage.getItem(sessionStorage.key(i));
      try { o.idb = indexedDB.databases ? (await indexedDB.databases()).map((d) => d.name) : []; } catch (e) { /* none */ }
      try { o.caches = await caches.keys(); } catch (e) { /* none */ }
      try { o.sw = (await navigator.serviceWorker.getRegistrations()).length; } catch (e) { /* none */ }
      return o;
    });
    inPage.cookies = (await ctx.cookies()).map((c) => c.name);
    return inPage;
  };
  const nothingKept = (k) => Object.keys(k.ls).length === 0 && Object.keys(k.ss).length === 0 && !k.cookie && k.cookies.length === 0 && k.idb.length === 0 && k.caches.length === 0 && k.sw === 0;
  const keysOk = (k) => Object.entries(k.ls).every(([n, v]) => KEYS[n] && KEYS[n].test(v));
  const scrollAll = (p) => p.evaluate(async () => { const sleep = (n) => new Promise((r) => setTimeout(r, n)); let y = 0; for (let i = 0; i < 150; i++) { window.scrollTo(0, y); y += Math.round(innerHeight * 0.7); await sleep(40); if (y > document.documentElement.scrollHeight + innerHeight) break; } window.scrollTo(0, 0); });
  const press = (p, sel, nth = 0) => p.evaluate(({ sel, nth }) => { const el = document.querySelectorAll(sel)[nth]; if (!el) return false; if (typeof el.click === 'function') el.click(); else for (const t of ['pointerdown', 'pointerup', 'click']) el.dispatchEvent(new (t === 'click' ? MouseEvent : PointerEvent)(t, { bubbles: true, cancelable: true })); return true; }, { sel, nth });

  /* ---------------------------------------------------------------- 2. just reading: every public page, English and one other language */
  const OTHER = ['es', 'hi', 'zh', 'vi'];
  const pages = ['index.html', 'first-visit.html', 'pumpkin-patch.html', 'school-field-trips.html', 'strawberry-picking.html', 'wise-pie.html', '404.html', 'print/qr-signs.html'];
  const reading = [];
  for (const [i, pg] of pages.entries()) for (const lang of ['en', OTHER[i % OTHER.length]]) {
    const plain = /404|qr-signs/.test(pg);
    const S = await visit(pg, { lang: lang === 'en' ? undefined : lang, ready: !plain });
    if (!plain) { await scrollAll(S.p); await press(S.p, '#faq summary'); await press(S.p, '#faq summary', 1); }
    await new Promise((r) => setTimeout(r, ms(plain ? 1200 : 400)));   // a request that comes late would still be seen (longer on a busy computer)
    const k = await kept(S);
    reading.push({ pg, lang, ext: S.ext.map((e) => e.u), kept: k, own: S.own.length });
    await S.p.context().close();
  }
  const withExt = reading.filter((r) => r.ext.length);
  ok(`reading ${reading.length} page visits (8 pages, English and another language each): no other site is contacted`, withExt.length === 0, withExt.map((r) => r.pg + ' ' + r.lang + ' -> ' + r.ext[0]).join(' | '));
  const withKept = reading.filter((r) => !nothingKept(r.kept));
  ok('reading leaves nothing behind: no localStorage, sessionStorage, cookie, IndexedDB, Cache Storage or service worker (also for a ?lang= link)', withKept.length === 0, withKept.map((r) => r.pg + ' ' + r.lang + ' ' + JSON.stringify(r.kept)).join(' | '));
  info(reading.length + ' visits, ' + reading.reduce((n, r) => n + r.own, 0) + ' requests, all to the site itself');

  /* ---------------------------------------------------------------- 3. a full visit to the home page, every feature used */
  const S = await visit('index.html', { extra: MC });
  const p = S.p;
  await p.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
  await p.evaluate(() => { window.print = () => {}; });
  await new Promise((r) => setTimeout(r, ms(1500)));
  const before = await kept(S);
  ok('right after the page opens, before anything is pressed: nothing kept, nothing sent to another site', nothingKept(before) && S.ext.length === 0, JSON.stringify(before) + ' ' + S.ext.map((e) => e.u).join(' '));
  S.phase = 'read'; await scrollAll(p); await press(p, '#faq summary');
  S.phase = 'play';
  for (const s of ['spring', 'summer', 'fall', 'winter']) await press(p, `#season-switch button[data-season="${s}"]`);
  for (let i = 0; i < 6; i++) await press(p, '#field [data-pick]', i);
  await press(p, '#pick-btn'); await press(p, '[data-rig]'); await press(p, '[data-fire]'); await press(p, '#goat-btn');
  for (let i = 1; i < 5; i++) await press(p, '#gallery .filter-btn', i);
  await press(p, 'img[data-zoom]'); await p.keyboard.press('Escape');
  for (let i = 0; i < 3; i++) await press(p, '#farm-map .map-legend button', i);
  S.phase = 'ics-reminder'; await press(p, '[data-rel-remind]'); await press(p, '[data-rel-ics]');
  S.phase = 'google-reminder'; await press(p, '[data-rel-remind]'); await press(p, '[data-rel-google]');
  await okSoon('"Add to Google Calendar" opens Google Calendar (stand-in) in a new tab', async () => S.ext.filter((e) => /calendar\.google\.com/.test(e.u)).length, (n) => n >= 1, 20000);   // the new tab asks a moment after the tap: wait before the next step
  S.phase = 'drive';
  await p.locator('#drive-form').scrollIntoViewIfNeeded();
  await p.fill('#drive-addr', PROBE); await p.click('#drive-form button[type=submit]');
  await until(p, () => document.querySelector('#drive-result')?.getAttribute('data-kind') === 'ok', null, 20000);
  const driveLinks = await p.evaluate(() => [...document.querySelectorAll('#drive-result a')].map((a) => a.href));
  S.phase = 'signup';
  await p.locator('#signup').scrollIntoViewIfNeeded();
  await p.fill('#su-email', MAIL); await p.check('input[value=pumpkins]'); await p.click('[data-signup] button[type=submit]');
  await okSoon('the signup went to Mailchimp (stand-in)', async () => S.ext.filter((e) => /list-manage/.test(e.u)).length, (n) => n >= 1, 20000);
  S.phase = 'language';
  await press(p, '.lang-btn'); await press(p, '.lang-list [data-lang="es"]');
  await until(p, () => document.documentElement.lang.startsWith('es'), null, 15000);
  await new Promise((r) => setTimeout(r, ms(800)));
  const after = await kept(S);

  const bad = S.ext.filter((e) => !HOSTS.some((h) => h.host.test(hostOf(e.u)) && h.phase === e.ph));
  ok('every other site contacted is on the list AND only after its own button (address search and route server: Get drive time; Mailchimp: Join the email list; Google Calendar: Add to Google Calendar)', bad.length === 0 && S.ext.length > 0, bad.map((e) => hostOf(e.u) + ' during "' + e.ph + '"').join(', ') + ' | all: ' + S.ext.map((e) => hostOf(e.u) + '@' + e.ph).join(', '));
  const hostsSeen = [...new Set(S.ext.map((e) => hostOf(e.u)))].sort();
  info('other sites contacted in this visit: ' + hostsSeen.join(', '));
  ok('the whole visit keeps only allowed things: localStorage "wa.lang" with a language code, no cookie, sessionStorage, IndexedDB, Cache Storage or service worker', keysOk(after) && Object.keys(after.ls).join() === 'wa.lang' && Object.keys(after.ss).length === 0 && !after.cookie && after.cookies.length === 0 && after.idb.length === 0 && after.caches.length === 0 && after.sw === 0, JSON.stringify(after));
  ok('no request to any site carries a cookie', S.ext.every((e) => !e.ck) && S.own.every((e) => !e.ck));
  // the typed address
  const geo = S.ext.filter((e) => /nominatim/.test(e.u));
  ok('the typed address goes to the address search and nowhere else (first request has it, in q=)', geo.length >= 1 && new URL(geo[0].u).searchParams.get('q') === PROBE, geo[0] && geo[0].u);
  const leak = [...S.own, ...S.ext.filter((e) => !/nominatim/.test(e.u))].filter((e) => /SECRETPROBE|Zephyr|Zzyzx/i.test(e.u + (e.post || '') + (e.ref || '')));
  ok('the typed address is in no other request (the site, the route server, Mailchimp, Google Calendar; no body, no Referer)', leak.length === 0, leak.map((e) => e.u).join(' | '));
  const stored = JSON.stringify(after) + (await p.evaluate(() => JSON.stringify([history.state, window.name, document.title, location.href])));
  ok('the typed address is not in localStorage, sessionStorage, cookies, the page address, the #hash, the title or the history state', !/SECRETPROBE|Zephyr|Zzyzx/i.test(stored), stored.slice(0, 200));
  ok('the only link that carries the address is the tapped-only "Open these directions in Google Maps" button', driveLinks.filter((l) => /SECRETPROBE|Zephyr/i.test(decodeURIComponent(l))).every((l) => /google\.com\/maps\/dir/.test(l)) && driveLinks.some((l) => /google\.com\/maps\/dir/.test(l)), driveLinks.join(' '));
  const route = S.ext.filter((e) => /osrm/.test(e.u));
  ok('the route server gets two pairs of coordinates and fixed options, not the words typed', route.length === 1 && /\/route\/v1\/driving\/-?[\d.]+,-?[\d.]+;-?[\d.]+,-?[\d.]+\?overview=false&alternatives=false&steps=false$/.test(route[0].u), route[0] && route[0].u);
  // what the other sites are told about where the visitor came from
  const refs = S.ext.map((e) => e.ref).filter(Boolean);
  ok('every request to another site names only the site (Referer has no page, no search, no hash)', refs.every((r) => { const u = new URL(r); return u.pathname === '/' && !u.search && !u.hash; }), [...new Set(refs)].join(' '));
  // Mailchimp
  const mc = S.ext.filter((e) => /list-manage/.test(e.u));
  const mcq = mc[0] ? new URL(mc[0].u) : null;
  const allowedParams = /^(u|id|EMAIL|tags|c|LANGUAGE|group\[\d+\]\[\d+\]|b_U123_L456)$/;
  ok('Mailchimp gets only: the email, the ticked interest codes, the tags, the two list codes, the robot-trap field, the reply name and (when set) the language', mcq && mcq.searchParams.get('EMAIL') === MAIL && [...mcq.searchParams.keys()].every((k) => allowedParams.test(k)), mcq && [...mcq.searchParams.keys()].join(','));
  ok('Mailchimp gets the language only as an English word, and only because signup.languageField is set', mcq && ['Spanish', 'English'].includes(mcq.searchParams.get('LANGUAGE')), mcq && mcq.searchParams.get('LANGUAGE'));
  // the calendar file and the Google Calendar link carry only opening times and the Bookeo link
  const gcal = S.ext.find((e) => /calendar\.google\.com/.test(e.u));
  ok('the Google Calendar link carries only the opening times, a text about them and the Bookeo link', gcal && [...new URL(gcal.u).searchParams.keys()].sort().join() === 'action,ctz,dates,details,recur,text' && !/@|SECRETPROBE/.test(gcal.u), gcal && gcal.u.slice(0, 160));
  await S.p.context().close();

  /* the optional live week feed on another site: a plain request each time the home page opens, with no cookie and not even the site name */
  const W = await visit('index.html', { extra: `WISE_ACRES.week = { feed: 'https://feed.example/week.json' };`, routes: async (pg) => {
    await pg.context().route((u) => u.host === 'feed.example', (r) => r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ updated: '2026-10-01', days: [] }) }));
  } });
  await okSoon('week feed (when set): asked for once when the home page opens', async () => W.ext.filter((e) => /feed\.example/.test(e.u)).length, (n) => n === 1, 20000);
  const feedReq = W.ext.find((e) => /feed\.example/.test(e.u));
  ok('week feed: no Referer (not even the site name) and no cookie; nothing else leaves the site', feedReq && !feedReq.ref && !feedReq.ck && W.ext.length === 1, feedReq && JSON.stringify(feedReq));
  ok('week feed: nothing is kept in the browser', nothingKept(await kept(W)));
  await W.p.context().close();

  /* ---------------------------------------------------------------- 4. the language question, the checklist */
  let L = await visit('index.html', { locale: 'es-US' });
  await until(L.p, () => !!document.querySelector('.lang-offer [data-n]'), null, 15000);
  ok('the language question (browser set to Spanish) keeps nothing until it is answered', nothingKept(await kept(L)));
  await press(L.p, '.lang-offer [data-n]');
  const no = await kept(L);
  ok('"No, thanks" keeps wa.offer = 1 and nothing else', Object.keys(no.ls).join() === 'wa.offer' && keysOk(no) && no.cookies.length === 0, JSON.stringify(no.ls));
  await L.p.context().close();
  L = await visit('index.html', { locale: 'es-US' });
  await until(L.p, () => !!document.querySelector('.lang-offer [data-y]'), null, 15000);
  await press(L.p, '.lang-offer [data-y]');
  await okSoon('"Yes" keeps wa.lang = es and nothing else (and sends nothing)', async () => ({ k: await kept(L), ext: L.ext.length }), (v) => Object.keys(v.k.ls).join() === 'wa.lang' && v.k.ls['wa.lang'] === 'es' && v.k.cookies.length === 0 && v.ext === 0, 15000);
  await L.p.context().close();
  const F = await visit('first-visit.html');
  await F.p.evaluate(() => { window.print = () => {}; });
  await F.p.locator('input[type=checkbox]').first().scrollIntoViewIfNeeded();
  await press(F.p, 'input[type=checkbox]', 0); await press(F.p, 'input[type=checkbox]', 2); await press(F.p, '[data-print]');
  const fk = await kept(F);
  ok('ticking the First-visit checklist keeps wa.checklist (true/false per line) and nothing else; nothing is sent', Object.keys(fk.ls).join() === 'wa.checklist' && keysOk(fk) && fk.cookies.length === 0 && F.ext.length === 0, JSON.stringify(fk.ls));
  await F.p.context().close();

  /* ---------------------------------------------------------------- 5. the documented Content-Security-Policy would block nothing the site does */
  const doc = read('docs/LAUNCH_CHECKLIST.md'), cspLine = /Content-Security-Policy: (default-src[^\n`]*)/.exec(doc);
  ok('docs/LAUNCH_CHECKLIST.md still shows the Content-Security-Policy line', !!cspLine);
  if (cspLine) {
    const CSP = cspLine[1].trim();
    const C = await visit('index.html', { extra: MC, routes: async (pg) => {
      await pg.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });
      await pg.context().route((u) => u.href.startsWith(ORIGIN + '/') && /(\.html?|\/)$/.test(u.pathname), async (r) => { const res = await r.fetch(); r.fulfill({ response: res, headers: { ...res.headers(), 'content-security-policy': CSP } }); });
    } });
    await C.p.evaluate(() => { window.print = () => {}; });
    await scrollAll(C.p);
    await press(C.p, '#season-switch button[data-season="winter"]'); await press(C.p, '#pick-btn'); await press(C.p, 'img[data-zoom]'); await C.p.keyboard.press('Escape');
    await press(C.p, '[data-rel-remind]'); await press(C.p, '[data-rel-ics]');
    await C.p.locator('#drive-form').scrollIntoViewIfNeeded();
    await C.p.fill('#drive-addr', PROBE); await C.p.click('#drive-form button[type=submit]');
    await until(C.p, () => document.querySelector('#drive-result')?.getAttribute('data-kind') === 'ok', null, 20000);
    await C.p.fill('#su-email', MAIL); await C.p.check('input[value=pumpkins]'); await C.p.click('[data-signup] button[type=submit]');
    await until(C.p, () => /Check your email/.test(document.querySelector('[data-signup-msg]')?.textContent || ''), null, 20000);
    await press(C.p, '.lang-btn'); await press(C.p, '.lang-list [data-lang="hi"]'); await until(C.p, () => document.documentElement.lang.startsWith('hi'), null, 15000);
    const viol = await C.p.evaluate(() => window.__csp);
    ok('with the documented Content-Security-Policy, a full visit (scripts, fonts, pictures, the calendar file, Drive time, Mailchimp signup, language change) has no violation', viol.length === 0, viol.join(' | '));
    await C.p.context().close();
    const Q = await visit('print/qr-signs.html', { ready: false, routes: async (pg) => {
      await pg.addInitScript(() => { window.__csp = []; window.__printed = 0; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });
      await pg.context().route((u) => u.href.startsWith(ORIGIN + '/') && /(\.html?|\/)$/.test(u.pathname), async (r) => { const res = await r.fetch(); r.fulfill({ response: res, headers: { ...res.headers(), 'content-security-policy': CSP } }); });
    } });
    await Q.p.evaluate(() => { window.print = () => { window.__printed++; }; });
    await Q.p.click('.bar button');
    ok('with the policy, the Print button on the QR sign page still works (its fingerprint matches the code)', (await Q.p.evaluate(() => window.__printed)) === 1 && (await Q.p.evaluate(() => window.__csp)).length === 0);
    await Q.p.context().close();
  }
});
