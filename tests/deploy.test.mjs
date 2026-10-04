// order: 230
// browser: yes
// covers: tools/make_deploy_folder.py, tools/pages.py, tools/i18n.py, tools/check_facts.py, _headers, 404.html
/* The folder to upload, made by tools/make_deploy_folder.py (needs python3 and beautifulsoup4), in a temporary copy of the site:
 *   - only what visitors need: no docs/, tests/, tools/, pages/, review/ (sheets for a native speaker), README.md, .gitignore, lang/src/ or translator lists; _headers and 404.html are in
 *   - FILES.txt lists every file with its size and sha256, and building twice gives the same folder (same fingerprint)
 *   - every file that a page, style, code file, manifest or the sitemap points to is in the folder; file count and size are sane
 *   - served by a plain web server (no special rules), every page in all five languages loads with no error and no missing file
 *   - an out-of-date page is rebuilt (--check only reports it), settings still to set are warned about without stopping,
 *     facts that disagree (tools/check_facts.py) and a missing translation each stop it with one plain line that says how to fix it,
 *     --force builds anyway and says so (on screen and in FILES.txt), and a folder that is not its own is never wiped
 *   - the licence texts and credits travel with the fonts and icons, and a font with no licence text next to it stops the tool (--force does not override that)
 * Your own files are not touched. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { ROOT, ok, info, skip, finish, launch, startServer, ms } from './lib.mjs';

const PY = process.env.WA_PYTHON || 'python3';
const py = (cwd, ...args) => spawnSync(PY, args, { cwd, encoding: 'utf8', timeout: ms(180000) });
if (py(ROOT, '-c', 'import bs4').status !== 0) skip(`${PY} with beautifulsoup4 is not available (pip install beautifulsoup4)`);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-deploy-'));
const site = path.join(tmp, 'site');
fs.cpSync(ROOT, site, { recursive: true, filter: (src) => !/(^|[\\/])(\.git|node_modules|deploy|\.visual|__pycache__)([\\/]|$)/.test(path.relative(ROOT, src)) });   // relative: the site folder itself may sit inside a folder with one of these names
fs.mkdirSync(path.join(site, 'review'), { recursive: true });   // sheets made by tools/review_sheet.py can be lying in the folder: they are never part of the upload
fs.writeFileSync(path.join(site, 'review', 'es.csv'), 'id,where\r\n');
const make = (...args) => { const r = py(site, 'tools/make_deploy_folder.py', ...args); return { code: r.status, out: (r.stdout || '') + (r.stderr || '') }; };
const files = (dir) => { const out = []; (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else out.push(path.relative(dir, p).split(path.sep).join('/')); } })(dir); return out.sort(); };
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const last = (s) => s.trim().split('\n').slice(-3).join(' | ');
const t0 = Date.now(), lap = (what) => process.env.WA_TIMES && info(`(${what}: ${Math.round((Date.now() - t0) / 1000)} s)`);

let browser, server;
const errs = [];
try {
  // ---- build it
  const out1 = path.join(tmp, 'out1'), out2 = path.join(tmp, 'out2');
  const r1 = make('--out', out1);
  ok('the tool succeeds on the finished site', r1.code === 0 && /Ready:/.test(r1.out), last(r1.out));
  const list = files(out1), top = new Set(list.map((f) => f.split('/')[0]));

  // ---- only what visitors need
  const leftOut = ['docs', 'tests', 'tools', 'pages', 'review', 'README.md', '.gitignore', '.git', 'deploy'].filter((n) => top.has(n));
  ok('no docs/, tests/, tools/, pages/, review/, README.md, .gitignore in the folder', leftOut.length === 0, leftOut.join(', '));
  ok('a review/ folder of sheets in the site folder is left out, and the tool says so', !list.some((f) => f.startsWith('review/')) && /review\//.test(r1.out), last(r1.out));
  const langExtra = list.filter((f) => f.startsWith('lang/src/') || /^lang\/[^/]+\.json$/.test(f));
  ok('no lang/src/ and no translator lists (lang/*.json)', langExtra.length === 0, langExtra.join(', '));
  const codes = fs.readdirSync(path.join(site, 'lang', 'src')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
  const need = ['index.html', '404.html', '_headers', 'robots.txt', 'sitemap.xml', 'manifest.webmanifest', 'FILES.txt', 'print/qr-signs.html', ...codes.map((c) => `lang/${c}.js`)];
  ok('_headers, 404.html, the pages, the translations and FILES.txt are in', need.every((f) => list.includes(f)), need.filter((f) => !list.includes(f)).join(', '));
  const licences = ['assets/fonts/LICENSE-OFL-Fredoka.txt', 'assets/fonts/LICENSE-OFL-Nunito.txt', 'assets/fonts/LICENSE-OFL-Caveat.txt', 'assets/LICENSE-icons-Feather-MIT.txt', 'assets/LICENSE-icons-Lucide-ISC.txt', 'assets/CREDITS.txt'];
  ok('the licence texts and the credits travel with the fonts and the icons (the font licence asks for it), and the tool does not report them as unused', licences.every((f) => list.includes(f)) && !/In the folder, but no page points to them[^\n]*LICENSE/.test(r1.out), licences.filter((f) => !list.includes(f)).join(', '));
  const pagesHere = fs.readdirSync(site).filter((f) => f.endsWith('.html')).sort();
  ok('every page of the top folder is in', pagesHere.every((f) => list.includes(f)), pagesHere.filter((f) => !list.includes(f)).join(', '));
  const odd = list.filter((f) => !/\.(html|css|js|svg|png|webp|jpe?g|woff2|txt|xml|webmanifest|ico)$/.test(f) && !['_headers', '_redirects'].includes(f));
  ok('only web files (no scripts, notes, backups or hidden files)', odd.length === 0, odd.join(', '));

  // ---- sizes and FILES.txt
  const bytes = list.filter((f) => f !== 'FILES.txt').reduce((s, f) => s + fs.statSync(path.join(out1, f)).size, 0);
  const biggest = list.map((f) => [f, fs.statSync(path.join(out1, f)).size]).sort((a, b) => b[1] - a[1])[0];
  info(`${list.length - 1} files and FILES.txt, ${(bytes / 1e6).toFixed(1)} MB, biggest ${biggest[0]} ${(biggest[1] / 1e6).toFixed(2)} MB`);
  ok('file count is sane (40 to 400)', list.length >= 40 && list.length <= 400, String(list.length));
  ok('total size is sane (2 to 25 MB) and no file is over 2 MB', bytes > 2e6 && bytes < 25e6 && biggest[1] < 2e6, `${bytes} bytes, ${biggest.join(' ')}`);
  const man = fs.readFileSync(path.join(out1, 'FILES.txt'), 'utf8');
  const rows = [...man.matchAll(/^\s*(\d+)\s+([0-9a-f]{64})\s+(\S+)$/gm)].map((m) => ({ size: +m[1], hash: m[2], file: m[3] }));
  const listed = rows.map((r) => r.file).sort(), real = list.filter((f) => f !== 'FILES.txt');
  ok('FILES.txt lists exactly the files in the folder', JSON.stringify(listed) === JSON.stringify(real), `${listed.length} listed, ${real.length} in the folder`);
  const wrong = rows.filter((r) => !fs.existsSync(path.join(out1, r.file)) || fs.statSync(path.join(out1, r.file)).size !== r.size || sha(path.join(out1, r.file)) !== r.hash);
  ok('every size and sha256 in FILES.txt is right', rows.length > 0 && wrong.length === 0, wrong.map((r) => r.file).join(', '));
  const whole = crypto.createHash('sha256'); [...rows].sort((a, b) => (a.file < b.file ? -1 : 1)).forEach((r) => whole.update(`${r.file}\0${r.hash}\n`));
  const fp = (man.match(/sha256 of the whole folder: ([0-9a-f]{64})/) || [])[1];
  ok('the folder fingerprint in FILES.txt matches the files', fp === whole.digest('hex'), fp);

  // ---- every file that something points to is there (read independently of the tool)
  const have = new Set(list), host = 'www.wiseacresorganic.com', broken = [];
  const check = (ref, fromDir, from) => {
    ref = ref.trim().replace(/&amp;/g, '&');
    if (!ref || /^(#|mailto:|tel:|sms:|javascript:|data:|about:)/.test(ref)) return;
    let p;
    if (/^(https?:)?\/\//.test(ref)) { const u = new URL(ref, 'https://x/'); if (u.host !== host) return; p = u.pathname.slice(1); }
    else { p = ref.split(/[?#]/)[0]; if (!p) return; p = p.startsWith('/') ? p.slice(1) : path.posix.normalize(path.posix.join(fromDir, p)); }
    p = decodeURIComponent(p);
    if (p === '' || p === '.' || p.endsWith('/')) p = p.replace(/^\.$/, '') + 'index.html';
    if (!have.has(p) && !have.has(p + '.html')) broken.push(`${from} -> ${ref}`);
  };
  const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[ \t])\/\/[^\n]*/g, '$1');
  const JSP = /['"`]((?:\.\.\/)?(?:assets|css|js|lang|print)\/[\w\-./]+\.(?:webp|png|jpe?g|gif|svg|woff2?|js|css|html|json|webmanifest|ico))['"`]/g;
  for (const f of list) {
    const text = /\.(html|css|js|webmanifest|xml)$/.test(f) ? fs.readFileSync(path.join(out1, f), 'utf8').replace(/<!--[\s\S]*?-->/g, '') : '';   // comments hold examples, not real files
    const dir = path.posix.dirname(f) === '.' ? '' : path.posix.dirname(f);
    if (f.endsWith('.html')) {
      for (const m of text.matchAll(/\s(?:src|href|poster|content)="([^"]+)"/g)) if (!/^#/.test(m[1]) && (/^(https?:)?\/\//.test(m[1]) ? m[1].includes(host) : /^[\w\-./]+(\.\w+)?([?#].*)?$/.test(m[1]) && /\.|\//.test(m[1]))) check(m[1], dir, f);
      for (const m of text.matchAll(/srcset="([^"]+)"/g)) m[1].split(',').forEach((x) => check(x.trim().split(' ')[0], dir, f));
      for (const m of text.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) check(m[1], dir, f);
      for (const m of noComments(text).matchAll(JSP)) check(m[1], dir, f);
    } else if (f.endsWith('.css')) for (const m of text.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) check(m[1], dir, f);
    else if (f.endsWith('.js') && !f.startsWith('lang/')) for (const m of noComments(text).matchAll(JSP)) check(m[1], '', f);
    else if (f.endsWith('.webmanifest')) (JSON.parse(text).icons || []).forEach((i) => check(i.src, dir, f));
    else if (f === 'sitemap.xml') for (const m of text.matchAll(/<loc>([^<]+)<\/loc>/g)) check(m[1], '', f);
  }
  ok('every file a page, style, code file, manifest or the sitemap points to is in the folder', broken.length === 0, [...new Set(broken)].slice(0, 6).join(' | '));

  lap('first build and checks');
  // ---- the same files give the same folder
  const r2 = make('--out', out2);
  const fp2 = (fs.readFileSync(path.join(out2, 'FILES.txt'), 'utf8').match(/sha256 of the whole folder: ([0-9a-f]{64})/) || [])[1];
  ok('built twice: the same fingerprint', r2.code === 0 && fp2 === fp, `${fp} / ${fp2}`);
  const differs = files(out2).filter((f) => !have.has(f) || sha(path.join(out1, f)) !== sha(path.join(out2, f)));
  ok('built twice: every file byte for byte the same', differs.length === 0 && files(out2).length === list.length, differs.join(', '));

  lap('second build');
  // ---- a plain web server: every page in English, and the home page and one more in every language
  server = await startServer({ root: out1, port: 0 });   // its own free port: WA_PORT may already be the main test server
  browser = await launch();
  const visits = [...pagesHere, 'print/qr-signs.html'].map((pg) => ['en', pg]).concat(codes.flatMap((c) => [[c, 'index.html'], [c, 'first-visit.html']]));
  let loads = 0;
  const problems = [];
  for (const [lang, pg] of visits) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage(); const bad = [];
    p.on('pageerror', (e) => bad.push('pageerror ' + e.message.slice(0, 120)));
    p.on('console', (m) => { if (m.type() === 'error') bad.push('console ' + m.text().slice(0, 120)); });
    p.on('requestfailed', (q) => { if (q.url().startsWith(server.url)) bad.push('failed ' + q.url().replace(server.url, '')); });
    p.on('response', (q) => { if (q.url().startsWith(server.url) && q.status() >= 400) bad.push(q.status() + ' ' + q.url().replace(server.url, '')); });
    const res = await p.goto(server.url + pg + '?lang=' + lang, { waitUntil: 'load', timeout: ms(60000) });
    await p.evaluate(async () => { document.querySelectorAll('img[loading="lazy"]').forEach((i) => { i.loading = 'eager'; }); for (let y = 0; y < document.body.scrollHeight; y += 1800) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 10)); } });
    await p.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: ms(15000), polling: 100 }).catch(() => {});   // every photo has arrived (or failed: then it is listed)
    loads++;
    if (!res || res.status() !== 200 || bad.length) problems.push(`${lang} ${pg}: ${res && res.status()} ${bad.slice(0, 2).join(' / ')}`);
    await ctx.close();
  }
  ok(`served by a plain web server, ${loads} page loads (every page, and two pages in each language): all 200, no error, no missing file`, problems.length === 0, problems.slice(0, 4).join(' | '));

  lap('browser');
  // ---- settings: warned about, never a stop
  const content = path.join(site, 'js', 'content.js'), orig = fs.readFileSync(content, 'utf8');
  fs.writeFileSync(content, orig.replace(/^  seasonPicker: (true|false),/m, '  seasonPicker: true,'));
  const w = make('--no-rebuild', '--out', out2);   // the settings check does not need the rebuild
  ok('seasonPicker still true: a warning, and the folder is still made', w.code === 0 && /WARNING: seasonPicker/.test(w.out), last(w.out));
  fs.writeFileSync(content, orig.replace(/^  seasonPicker: (true|false),/m, '  seasonPicker: false,'));
  ok('seasonPicker false: no warning about it', !/WARNING: seasonPicker/.test(make('--no-rebuild', '--out', out2).out));
  fs.writeFileSync(content, orig);

  // ---- an out-of-date page
  fs.rmSync(path.join(site, 'wise-pie.html'));
  const c = make('--check');
  ok('--check: a page that was not rebuilt is named, and nothing is written', c.code === 1 && /wise-pie\.html/.test(c.out) && !fs.existsSync(path.join(site, 'wise-pie.html')), last(c.out));
  const u = make('--out', out2);
  ok('without --check: the page is rebuilt in the site folder and is in the upload', u.code === 0 && fs.existsSync(path.join(site, 'wise-pie.html')) && fs.existsSync(path.join(out2, 'wise-pie.html')), last(u.out));

  // ---- a folder that is not the tool's own is never wiped
  const foreign = path.join(tmp, 'mine'); fs.mkdirSync(foreign); fs.writeFileSync(path.join(foreign, 'keep.txt'), 'mine');
  const f = make('--out', foreign);
  ok('--out on a folder with other files: refused, nothing deleted', f.code === 1 && fs.existsSync(path.join(foreign, 'keep.txt')), last(f.out));

  // ---- facts that disagree stop it; --force builds anyway and says so
  const pump = path.join(site, 'pages', 'pumpkin-patch.html'), pumpOrig = fs.readFileSync(pump, 'utf8');
  fs.writeFileSync(pump, pumpOrig.replace('farm fun without pizza is $3 per person', 'farm fun without pizza is $4 per person'));
  const out3 = path.join(tmp, 'out3'), out4 = path.join(tmp, 'out4');
  const g = make('--out', out3);
  ok('a price written two ways (the changed sentence also has no translation yet): NOT READY, one plain line for the facts with the file and the fix, one for each language, nothing written', g.code === 1 && /NOT READY: \d+ checks? (is|are) red/.test(g.out)
    && /Facts disagree: price: farm fee per person: \$3 in \d+ places, \$4 in 1 place \(pages\/pumpkin-patch\.html:\d+\)\. Fix: make every place say the same/.test(g.out) && /add --force/.test(g.out) && !fs.existsSync(out3), last(g.out));
  const gf = make('--out', out4, '--force');
  const note = fs.existsSync(path.join(out4, 'FILES.txt')) ? fs.readFileSync(path.join(out4, 'FILES.txt'), 'utf8') : '';
  ok('--force: it builds anyway, says so on screen, lists what was red, and writes that into FILES.txt', gf.code === 0 && /--force: building anyway/.test(gf.out) && /Facts disagree: price: farm fee/.test(gf.out) && /BUILT WITH --force: \d+ red checks were ignored/.test(gf.out)
    && !/Upload what is INSIDE/.test(gf.out) && fs.existsSync(path.join(out4, 'index.html')) && /built with --force although these checks were red/.test(note) && /Facts disagree: price: farm fee/.test(note), last(gf.out));
  const rows4 = [...note.matchAll(/^\s*(\d+)\s+([0-9a-f]{64})\s+(\S+)$/gm)].length;
  ok('...and FILES.txt still lists every file (the note does not break the list)', rows4 === files(out4).length - 1, `${rows4} rows, ${files(out4).length - 1} files`);
  fs.writeFileSync(pump, pumpOrig);
  py(site, 'tools/pages.py'); py(site, 'tools/i18n.py', 'extract'); py(site, 'tools/i18n.py', 'build');   // the sentence is back as it was, so the translations match again
  fs.rmSync(out4, { recursive: true, force: true });
  const clean = make('--check');
  ok('the price put right again: ready again, and it says the facts agree', clean.code === 0 && /Facts agree everywhere/.test(clean.out), last(clean.out));

  // ---- a font without its licence text stops it, and --force does not change that
  const lic = path.join(site, 'assets', 'fonts', 'LICENSE-OFL-Nunito.txt'), licText = fs.readFileSync(lic);
  fs.rmSync(lic);
  const nl = make('--out', out3), nlf = make('--out', out3, '--force');
  ok('a font with no licence text next to it: not ready, nothing written, and the problem names the file to add (--force does not override it)', nl.code === 1 && nlf.code === 1 && /NOT READY/.test(nl.out) && !fs.existsSync(out3) && /assets\/fonts\/nunito-latin-wght-normal\.woff2 has no licence text: add assets\/fonts\/LICENSE-OFL-Nunito\.txt/.test(nl.out), last(nl.out));
  fs.writeFileSync(lic, licText);

  // ---- a missing translation stops it; --force builds anyway
  const src = path.join(site, 'pages', 'wise-pie.html'), html = fs.readFileSync(src, 'utf8');
  const m = html.match(/<p>([A-Z][^<]{20,}?\.)<\/p>/);
  if (m) {
    fs.writeFileSync(src, html.replace(m[0], `<p>${m[1].replace(/\.$/, '')} (a new sentence).</p>`));
    const t = make('--out', out3);
    ok('an English sentence with no translation yet: NOT READY, one line for each language, with how to fix it, nothing written', t.code === 1 && /NOT READY: \d+ checks? (is|are) red/.test(t.out) && /Translations missing: es has 1 page text\(s\)/.test(t.out)
      && /Fix: python3 tools\/i18n\.py missing es --list shows them; add them to lang\/src\/es\.json/.test(t.out) && /Translations missing: vi has 1 page text/.test(t.out) && /add --force/.test(t.out) && !fs.existsSync(out3), last(t.out));
    const tf = make('--out', out4, '--force');
    const note2 = fs.existsSync(path.join(out4, 'FILES.txt')) ? fs.readFileSync(path.join(out4, 'FILES.txt'), 'utf8') : '';
    ok('--force with a missing translation: it builds, says so, and the note in FILES.txt names the languages', tf.code === 0 && /--force: building anyway/.test(tf.out) && /BUILT WITH --force: 4 red checks were ignored/.test(tf.out) && /Translations missing: es has/.test(note2), last(tf.out));
  } else info('(the missing-translation check was skipped: no plain sentence found in pages/wise-pie.html)');
} catch (e) {
  ok('deploy: the test ran to the end', false, String(e && e.stack ? e.stack.split('\n').slice(0, 3).join(' / ') : e));
}
await finish({ browser, site: server, errs });
fs.rmSync(tmp, { recursive: true, force: true });
