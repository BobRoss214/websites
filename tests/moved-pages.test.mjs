// order: 27
// browser: yes
// quick: no
// covers: patches/optional/redirects-B-redirect-pages.patch, tools/i18n.py, lang/src/*, js/i18n.js
/* The 13 "this page has moved" pages of the old-address option (patches/optional/redirects-B-redirect-pages.patch) speak the visitor's language.
 * Nothing in the site folder is changed: the test copies the site to a temporary folder, applies the patch there with `git apply`, runs the rebuild commands (pages.py,
 * i18n.py extract, jsstrings, build: every language must say 0 missing), and opens the 13 pages in a real browser, in each of the 5 languages, with and without JavaScript.
 *   - the jump is the one the patch always had: every page still has <meta http-equiv="refresh" content="0; url=..."> to the same address, and a link to it, and the
 *     real page (nothing stripped) lands on that address, with and without JavaScript, in every language, and the section then starts 88 px (computer) or 80 px (phone) under the top of the screen, as for a direct link;
 *   - the two lines of each page carry data-t ids and every language has a translation of them (tools/i18n.py reads these folders, so extract, build and missing know them);
 *   - with the language saved by the language button (wa.lang), with ?lang=, or, when nothing was chosen and the offer was not refused, with the browser's language list:
 *     the lines, the title and <html lang> are in that language on all 13 pages; a saved English, a refused offer and a language the site does not have stay English;
 *   - no flash of English: no frame is drawn with the English words while another language is on its way; when the words do not arrive (blocked, or 404) the English shows;
 *   - with JavaScript off the page is English, readable, and still jumps (meta refresh) and has its link;
 *   - no page error and no console error on any of it. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, ok, info, skip, finish, startServer, launch, ms } from './lib.mjs';

const PY = process.env.WA_PYTHON || 'python3';
if (spawnSync(PY, ['-c', 'import sys, bs4; sys.exit(0 if sys.version_info >= (3, 8) else 1)']).status !== 0) skip(`${PY} (Python 3.8 or newer, with beautifulsoup4) is not available`);
if (spawnSync('git', ['--version']).status !== 0) skip('git is not installed');
const PATCH = 'patches/optional/redirects-B-redirect-pages.patch';
if (!fs.existsSync(path.join(ROOT, PATCH))) skip(PATCH + ' is not in this site');

const LANGS = ['es', 'hi', 'zh', 'vi'], HTML_LANG = { en: 'en', es: 'es', hi: 'hi', zh: 'zh-Hans', vi: 'vi' };
// what each old address has always jumped to (the patch's first version): the jump must not change
const MOVED = { about: '/#about', 'contact-us': '/#contact', contact: '/#contact', faq: '/#faq', 'flowers-photographers': '/#flowers', flowers: '/#flowers', food: '/wise-pie.html', parties: '/#groups',
  'parties-school-tours': '/#groups', 'school-tours': '/school-field-trips.html', schooltours: '/school-field-trips.html', 'the-greenhouse': '/#greenhouse', wiseacres: '/#visit' };
const ENGLISH_LINK = { about: 'Go to the About section of our home page', 'contact-us': 'Go to the contact section of our home page', contact: 'Go to the contact section of our home page', faq: 'Go to the FAQ on our home page',
  'flowers-photographers': 'Go to the flowers section of our home page', flowers: 'Go to the flowers section of our home page', food: 'Go to the Wise Pie page', parties: 'Go to the groups and parties section of our home page',
  'parties-school-tours': 'Go to the groups and parties section of our home page', 'school-tours': 'Go to the school field trips page', schooltours: 'Go to the school field trips page',
  'the-greenhouse': 'Go to the GreenHouse section of our home page', wiseacres: 'Go to the Visit section of our home page' };
const DIRS = Object.keys(MOVED);

// ---- a temporary copy of the site with the patch applied and rebuilt
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-moved-'));
const site = path.join(tmp, 'site');
fs.cpSync(ROOT, site, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules|deploy|review|\.visual|__pycache__)([\\/]|$)/.test(src) });
const sh = (cmd, args) => spawnSync(cmd, args, { cwd: site, encoding: 'utf8', timeout: 300000 });
const applied = sh('git', ['apply', '--whitespace=nowarn', PATCH]);
ok('the patch applies to the site as it is now (git apply)', applied.status === 0, (applied.stderr || '').slice(0, 300));
const steps = [['tools/pages.py'], ['tools/i18n.py', 'extract'], ['tools/i18n.py', 'jsstrings'], ['tools/i18n.py', 'build']].map((a) => sh(PY, a));
ok('the rebuild commands run (pages.py, extract, jsstrings, build)', steps.every((s) => s.status === 0), steps.map((s) => (s.stderr || '').slice(0, 150)).join(' | '));
const missing = LANGS.map((l) => [l, sh(PY, ['tools/i18n.py', 'missing', l]).stdout]);
ok('every language says 0 missing after the patch (the moved pages are known to extract, build and missing)', missing.every(([, out]) => / 0 missing, .*JavaScript: 0 missing/.test(out)), missing.map(([l, o]) => l + ': ' + o.split('\n')[0]).join(' | '));

// ---- the files
const read = (rel) => fs.readFileSync(path.join(site, rel), 'utf8');
const page = Object.fromEntries(DIRS.map((d) => [d, fs.existsSync(path.join(site, d, 'index.html')) ? read(d + '/index.html') : '']));
const src = Object.fromEntries(LANGS.map((l) => [l, JSON.parse(read(`lang/src/${l}.json`)).ui]));
const idsOf = (d) => [...page[d].matchAll(/data-t="(t[0-9a-f]{8})"/g)].map((m) => m[1]);
const refresh = (d) => (/<meta http-equiv="refresh" content="0; url=([^"]+)">/.exec(page[d]) || [])[1];
ok('all 13 folders have a page', DIRS.every((d) => page[d]), DIRS.filter((d) => !page[d]).join(', '));
ok('the jump is unchanged: each page still has <meta http-equiv="refresh" content="0; url=..."> to the same address as before, and a link to it', DIRS.every((d) => refresh(d) === MOVED[d] && page[d].includes(`<a data-t="`) && page[d].includes(`href="${MOVED[d]}"`)), DIRS.filter((d) => refresh(d) !== MOVED[d]).join(', '));
ok('the English is still in the HTML (the fallback): "This page has moved." and the link line, and the title', DIRS.every((d) => page[d].includes('>This page has moved.</p>') && page[d].includes('>' + ENGLISH_LINK[d] + '</a>') && page[d].includes('<title>This page has moved | Wise Acres Organic Farm</title>')));
ok('each page loads js/moved.js, and its two lines carry data-t ids', DIRS.every((d) => page[d].includes('<script src="/js/moved.js"></script>') && idsOf(d).length === 2), DIRS.filter((d) => idsOf(d).length !== 2).join(', '));
const allIds = [...new Set(DIRS.flatMap(idsOf))];
ok('there are 10 different texts (one shared line and 9 link lines), each translated in es, hi, zh and vi with a text that is not the English', allIds.length === 10 && allIds.every((id) => LANGS.every((l) => typeof src[l][id] === 'string' && src[l][id].length > 3 && !/^(This page has moved\.|Go to )/.test(src[l][id]))), allIds.length + ' ids');
ok('no translation carries markup (the lines are plain text)', allIds.every((id) => LANGS.every((l) => !/[<>]/.test(src[l][id]))));

const errs = [];
const srv = await startServer({ root: site });
const browser = await launch();
const home = await (async () => { const c = await browser.newContext(); const p = await c.newPage(); await p.goto(srv.url, { waitUntil: 'load' }); const ids = await p.evaluate(() => [...document.querySelectorAll('[id]')].map((e) => e.id)); await c.close(); return new Set(ids); })();
ok('every address a moved page jumps to is a page or a section that exists', DIRS.every((d) => MOVED[d].startsWith('/#') ? home.has(MOVED[d].slice(2)) : fs.existsSync(path.join(site, MOVED[d].slice(1)))), DIRS.filter((d) => MOVED[d].startsWith('/#') && !home.has(MOVED[d].slice(2))).join(', '));

/** A page in a fresh browser context. `stay` takes the <meta http-equiv="refresh"> out of the document so the page can be looked at (the real jump is tested apart). */
async function view(d, { saved, query = '', locale = 'en-US', js = true, stay = true, routes, extra }) {
  const ctx = await browser.newContext({ locale, javaScriptEnabled: js, viewport: { width: 700, height: 500 } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(ms(20000));
  p.on('pageerror', (e) => errs.push(d + ' pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(d + ' console: ' + m.text()); });
  if (saved && js) await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, saved);
  if (js) await ctx.addInitScript(() => {   // every frame the browser draws: is the text hidden, and what does it say?
    window.__frames = [];
    const tick = () => { const b = document.body, t = b && b.querySelector('[data-t]'); window.__frames.push(b ? { vis: getComputedStyle(b).visibility, text: t ? t.textContent : '' } : null); if (window.__frames.length < 600) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  if (stay) await ctx.route((u) => u.pathname === `/${d}/`, async (route) => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()).replace(/<meta http-equiv="refresh"[^>]*>/i, '') }); });
  if (routes) await routes(ctx);
  await p.goto(`${srv.url}${d}/${query}`, { waitUntil: 'load' });
  if (js) await p.waitForFunction(() => !document.documentElement.classList.contains('moved-wait'), null, { timeout: ms(8000) }).catch(() => {});
  const got = await p.evaluate(() => ({ lang: document.documentElement.lang, title: document.title, lines: [...document.querySelectorAll('[data-t]')].map((e) => e.textContent), ids: [...document.querySelectorAll('[data-t]')].map((e) => e.getAttribute('data-t')), href: (document.querySelector('a') || {}).getAttribute && document.querySelector('a').getAttribute('href'), hidden: document.documentElement.classList.contains('moved-wait'), vis: getComputedStyle(document.body).visibility, frames: window.__frames || [] }));
  await ctx.close();
  return got;
}
const want = (d, l) => idsOf(d).map((id) => (l === 'en' ? null : src[l][id]));
const englishLines = (d) => ['This page has moved.', ENGLISH_LINK[d]];
const isEnglish = (d, g) => g.lines[0] === englishLines(d)[0] && g.lines[1] === englishLines(d)[1] && g.lang === 'en' && g.title === 'This page has moved | Wise Acres Organic Farm';
const isLang = (d, g, l) => JSON.stringify(g.lines) === JSON.stringify(want(d, l)) && g.lang === HTML_LANG[l] && g.title === want(d, l)[0] + ' | Wise Acres Organic Farm' && !g.hidden && g.vis === 'visible' && g.href === MOVED[d];

// ---- the language saved with the language button: all 13 pages in all 5 languages
const bad = [];
for (const l of ['en', ...LANGS]) for (const d of DIRS) {
  const g = await view(d, { saved: { 'wa.lang': l } });
  if (!(l === 'en' ? isEnglish(d, g) && !g.hidden && g.href === MOVED[d] : isLang(d, g, l))) bad.push(`${d} saved ${l}: ${JSON.stringify([g.lang, g.title, g.lines, g.hidden]).slice(0, 160)}`);
}
ok('with the language saved by the language button (wa.lang), all 13 pages show their two lines, the title and <html lang> in that language: English, Spanish, Hindi, Chinese, Vietnamese (65 pages looked at), and the link still goes to the same address', bad.length === 0, bad.slice(0, 3).join(' || '));

// ---- the other ways the visitor's language is known
const other = [];
const first = 'about', second = 'food';
for (const l of LANGS) {
  for (const d of [first, second]) {
    const q = await view(d, { query: `?lang=${l}` });
    if (!isLang(d, q, l)) other.push(`?lang=${l} ${d}`);
    const b = await view(d, { locale: { es: 'es-MX', hi: 'hi-IN', zh: 'zh-CN', vi: 'vi-VN' }[l] });   // nothing saved: the browser's list
    if (!isLang(d, b, l)) other.push(`browser ${l} ${d}: ${JSON.stringify([b.lang, b.lines]).slice(0, 120)}`);
  }
}
ok('?lang=xx, and the browser\'s language list when nothing was chosen, give the same words in es, hi, zh and vi (on the first and the last kind of page)', other.length === 0, other.slice(0, 3).join(' || '));
const stays = [];
for (const [name, args] of [['saved English beats a Spanish browser', { saved: { 'wa.lang': 'en' }, locale: 'es-MX' }], ['a refused offer (wa.offer) beats a Spanish browser', { saved: { 'wa.offer': '1' }, locale: 'es-MX' }],
  ['a language the site does not have', { locale: 'fr-FR' }], ['an unknown ?lang=', { query: '?lang=fr', locale: 'es-MX' }], ['the second language of the list', { locale: 'de-DE' }]]) {
  const g = await view(first, args);
  if (!isEnglish(first, g) || g.hidden) stays.push(name + ': ' + JSON.stringify([g.lang, g.lines]).slice(0, 100));
}
const second2 = await view(first, { locale: 'fr-FR' });
const listed = await (async () => { const ctx = await browser.newContext({ locale: 'fr-FR', javaScriptEnabled: true }); await ctx.addInitScript(() => Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'vi-VN', 'en'] })); const p = await ctx.newPage(); await ctx.route((u) => u.pathname === `/${first}/`, async (route) => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()).replace(/<meta http-equiv="refresh"[^>]*>/i, '') }); }); await p.goto(`${srv.url}${first}/`); await p.waitForFunction(() => !document.documentElement.classList.contains('moved-wait')); const t = await p.evaluate(() => [document.documentElement.lang, document.querySelector('[data-t]').textContent]); await ctx.close(); return t; })();
ok('a saved English, a refused offer, a language the site does not have and an unknown ?lang= keep the English; the first language of the list that the site has wins (fr, vi, en gives Vietnamese)', stays.length === 0 && isEnglish(first, second2) && listed[0] === 'vi' && listed[1] === src.vi[idsOf(first)[0]], stays.join(' || ') + ' / ' + listed.join(' '));

// ---- no flash of English
const flashes = [];
for (const l of LANGS) {
  const g = await view(first, { saved: { 'wa.lang': l }, routes: (ctx) => ctx.route(`**/lang/${l}.js`, async (route) => { await new Promise((r) => setTimeout(r, 700)); await route.continue(); }) });   // the words arrive late
  const seen = g.frames.filter(Boolean);
  const bare = seen.filter((f) => f.vis === 'visible' && f.text === 'This page has moved.');
  if (bare.length || !isLang(first, g, l)) flashes.push(`${l}: ${bare.length} frames showed the English, final ${JSON.stringify(g.lines).slice(0, 60)}`);
}
ok('no flash of English: with the words arriving late (0.7 s), no frame is drawn with the English visible, and the page ends in the language', flashes.length === 0, flashes.join(' || '));
const gone = [];
for (const [name, routes] of [['the file is blocked', (ctx) => ctx.route('**/lang/es.js', (r) => r.abort())], ['the file is a 404', (ctx) => ctx.route('**/lang/es.js', (r) => r.fulfill({ status: 404, body: 'no' }))],
  ['the file has no words for these lines', (ctx) => ctx.route('**/lang/es.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: 'window.WISE_ACRES=window.WISE_ACRES||{};(WISE_ACRES.dict=WISE_ACRES.dict||{}).es={ui:{},js:{}};' }))]]) {
  const g = await view(first, { saved: { 'wa.lang': 'es' }, routes });
  if (!isEnglish(first, g) || g.hidden || g.vis !== 'visible') gone.push(name + ': ' + JSON.stringify([g.lang, g.lines, g.hidden, g.vis]).slice(0, 120));
}
ok('when the words do not arrive (blocked, 404, or nothing for these lines) the English shows, readable, and <html lang> stays en', gone.length === 0, gone.join(' || '));

// ---- the jump itself, nothing stripped
const jumped = [], landed = [];
const FEW = ['about', 'food'];   // the other languages are tried on one section and one page
for (const [js, l, dirs] of [[true, 'en', DIRS], [true, 'es', DIRS], [false, 'en', DIRS], [true, 'hi', FEW], [true, 'zh', FEW], [true, 'vi', FEW]]) {
  for (const d of dirs) {
    const ctx = await browser.newContext({ javaScriptEnabled: js, viewport: { width: 700, height: 500 } });
    if (js && l !== 'en') await ctx.addInitScript((c) => localStorage.setItem('wa.lang', c), l);
    const p = await ctx.newPage();
    p.setDefaultTimeout(ms(20000));
    p.on('pageerror', (e) => errs.push(d + ' pageerror: ' + e.message));
    await p.goto(`${srv.url}${d}/`, { waitUntil: 'commit' }).catch(() => {});
    const want = new URL(MOVED[d], srv.url);
    try { await p.waitForURL((u) => u.pathname === want.pathname && u.hash === want.hash, { timeout: ms(20000) }); } catch (e) { jumped.push(`${d} (${js ? 'JS ' + l : 'no JS'}): ${p.url()}`); }
    await ctx.close();
  }
}
ok('the real pages jump to the same address as before (13 pages): in English and Spanish with JavaScript and with JavaScript off, and in Hindi, Chinese and Vietnamese', jumped.length === 0, jumped.slice(0, 3).join(' || '));
// where the section lands is the home page's own work (the header is 88 px high on a computer, 80 on a phone: the section starts just under it); the jump must not change it
for (const [size, top] of [[{ width: 1440, height: 900 }, 88], [{ width: 390, height: 844 }, 80]]) {
  for (const [d, l] of [['about', 'en'], ['faq', 'es'], ['the-greenhouse', 'vi']]) {
    const ctx = await browser.newContext({ viewport: size });
    if (l !== 'en') await ctx.addInitScript((c) => localStorage.setItem('wa.lang', c), l);
    const p = await ctx.newPage();
    p.setDefaultTimeout(ms(30000));
    await p.goto(`${srv.url}${d}/`, { waitUntil: 'commit' }).catch(() => {});
    const id = MOVED[d].slice(2);
    let at = null;
    for (let n = 0; n < 60; n++) { at = await p.evaluate((x) => { const e = document.getElementById(x); return e ? Math.round(e.getBoundingClientRect().top) : null; }, id).catch(() => null); if (at !== null && Math.abs(at - top) <= 2) break; await new Promise((r) => setTimeout(r, ms(400))); }
    if (at === null || Math.abs(at - top) > 2) landed.push(`${d} ${l} at ${size.width}px: section top ${at}, expected ${top}`);
    await ctx.close();
  }
}
ok('after the jump the section starts 88 px under the top of a computer screen and 80 px under the top of a phone screen, as it does for a direct link', landed.length === 0, landed.join(' || '));

// ---- JavaScript off: English, readable, link and jump
const plain = [];
for (const d of DIRS) {
  const g = await view(d, { js: false, saved: { 'wa.lang': 'es' }, locale: 'es-MX' });
  if (!isEnglish(d, g) || g.href !== MOVED[d] || g.vis !== 'visible' || g.hidden) plain.push(d + ': ' + JSON.stringify([g.lang, g.lines, g.hidden, g.vis]).slice(0, 100));
}
ok('with JavaScript off the page is English and readable (nothing is hidden) even for a Spanish browser, and the link is there', plain.length === 0, plain.slice(0, 3).join(' || '));

ok('no page error and no console error on any of it', errs.length === 0, errs.slice(0, 3).join(' | '));
info('pages: ' + DIRS.length + '; languages: 5; copy: ' + site);
await srv.close();
await browser.close();
fs.rmSync(tmp, { recursive: true, force: true });
await finish({});
