// order: 20
// browser: no
// quick: no
// covers: tools/launch_check.py, _headers, robots.txt, sitemap.xml, 404.html, manifest.webmanifest, assets/og-*
/* The launch-day check (tools/launch_check.py): it fetches a site like a visitor and prints PASS / WARN / FAIL in plain words.
 * Here it runs against a small pretend host on this computer that behaves like Cloudflare Pages or Netlify (it compresses, applies the
 * _headers file, answers 404 with 404.html). On the site as it is, the check must find nothing broken (warnings about the owner's
 * open decisions are fine). Then the pretend host and the files are broken one thing at a time and the matching FAIL must appear:
 * a missing file, a wrong canonical address, no compression, a 404 that answers 200, the old placeholder domain, and so on.
 * Needs Python 3.8 or newer (no extra packages) and no browser. Nothing is written in the site folder: the files are copied to a temporary folder. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import zlib from 'node:zlib';
import { spawn, spawnSync } from 'node:child_process';
import { ROOT, ok, info, skip, finish, ms } from './lib.mjs';

const PY = process.env.WA_PYTHON || 'python3';
const TOOL = path.join(ROOT, 'tools', 'launch_check.py');
if (!fs.existsSync(TOOL)) { ok('tools/launch_check.py exists', false); await finish(); process.exit(1); }
if (spawnSync(PY, ['-c', 'import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)']).status !== 0) skip(`${PY} (Python 3.8 or newer) is not available`);

/* ------------------------------------------------------------------ the folder to serve: the files a host would get */
const SITE = 'https://www.wiseacresorganic.com';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-launch-'));
const raw = path.join(tmp, 'raw'), good = path.join(tmp, 'good');
const copyDeploy = (to) => {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (e.isFile() && (/\.(html|xml|txt|webmanifest)$/.test(e.name) || e.name === '_headers') && e.name !== 'README.md') fs.copyFileSync(path.join(ROOT, e.name), path.join(to, e.name));
  }
  for (const d of ['assets', 'css', 'js', 'lang', 'print']) fs.cpSync(path.join(ROOT, d), path.join(to, d), { recursive: true, filter: (s) => !/[\\/]lang[\\/]src([\\/]|$)/.test(s) });
};
copyDeploy(raw);
copyDeploy(good);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.woff2': 'font/woff2',
};
const TEXTY = /^(text\/|application\/(json|xml|manifest\+json)|image\/svg)/;

/* A pretend host. `opts` can be changed between runs: root, gzip, headers, soft404, jsType, redirects, hide, mutate. */
const opts = {};
const reset = () => Object.assign(opts, { root: good, gzip: true, headers: true, soft404: false, jsType: '', redirects: {}, hide: new Set(), mutate: {}, replace: {} });
const rulesOf = (root) => {
  const out = [];
  let cur = null;
  let text = '';
  try { text = fs.readFileSync(path.join(root, '_headers'), 'utf8'); } catch (e) { return out; }
  for (const line of text.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (/^\S/.test(line)) { cur = { re: new RegExp('^' + line.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'), headers: {} }; out.push(cur); } else if (cur) { const i = line.indexOf(':'); cur.headers[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
  }
  return out;
};
const server = http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400); res.end(); return; }
  if (opts.redirects[pathname]) { res.writeHead(301, { Location: opts.redirects[pathname] }); res.end(); return; }
  let file = path.join(opts.root, pathname);
  try { if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html'); } catch (e) { /* below */ }
  let status = 200, body = null;
  if (!opts.hide.has(pathname)) { try { body = fs.readFileSync(file); } catch (e) { body = null; } }
  if (body === null) {
    status = opts.soft404 ? 200 : 404;
    try { body = fs.readFileSync(path.join(opts.root, opts.soft404 ? 'index.html' : '404.html')); file = path.join(opts.root, '404.html'); } catch (e) { body = Buffer.from('Not found'); }
  }
  let ctype = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  if (opts.jsType && /\.js$/.test(file)) ctype = opts.jsType;
  const rel = '/' + path.relative(opts.root, file).split(path.sep).join('/');   // "/" is index.html
  const m = opts.mutate[rel] || opts.mutate[pathname];
  if (m && status === 200) body = Buffer.from(m(body.toString('utf8')));
  if ((opts.replace[rel] || opts.replace[pathname]) && status === 200) body = opts.replace[rel] || opts.replace[pathname];
  const headers = { 'Content-Type': ctype };
  if (/^text\/html/.test(ctype)) headers['Cache-Control'] = 'public, max-age=0, must-revalidate';
  if (opts.headers) for (const r of rulesOf(opts.root)) if (r.re.test(pathname)) Object.assign(headers, r.headers);
  if (opts.gzip && TEXTY.test(ctype) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) { body = zlib.gzipSync(body); headers['Content-Encoding'] = 'gzip'; headers['Vary'] = 'Accept-Encoding'; }
  headers['Content-Length'] = body.length;
  res.writeHead(status, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
});
server.keepAliveTimeout = 5000;
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const ORIGIN = `http://127.0.0.1:${port}`;
// the good folder names the address it is served at (what a deploy to another address would look like); raw keeps the old placeholder address
const rewrite = (dir) => {
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(html|xml|txt)$/.test(e.name)) fs.writeFileSync(p, fs.readFileSync(p, 'utf8').split(SITE).join(ORIGIN)); } };
  walk(dir);
};
rewrite(good);

/* ------------------------------------------------------------------ run the tool */
/* The tool runs as a separate program and asks this process's pretend host for pages, so it must not block this process (no spawnSync). */
const runTool = (args) => new Promise((resolve) => {
  const child = spawn(PY, [TOOL, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  const timer = setTimeout(() => child.kill('SIGKILL'), ms(170000));
  child.stdout.on('data', (d) => { out += d; }); child.stderr.on('data', (d) => { err += d; });
  child.on('close', (code) => { clearTimeout(timer); resolve({ code, out, err }); });
});
const check = async (args = [], url = ORIGIN + '/') => {
  const r = await runTool([url, '--json', '--timeout', '15', ...args]);
  let json = null;
  try { json = JSON.parse(r.out); } catch (e) { /* reported by the caller */ }
  return { code: r.code, json, err: (r.err || '').slice(0, 300) };
};
const find = (j, level, key) => (j ? j.results.filter((x) => x.level === level && (key instanceof RegExp ? key.test(x.key) : x.key === key)) : []);
const fails = (j) => (j ? j.results.filter((x) => x.level === 'FAIL').map((x) => x.key) : ['no result']);
reset();

try {
  /* ---- the site as it is ---- */
  let r = await check();
  ok('good site: the check ran and gave JSON', !!r.json, r.err);
  ok('good site: exit code 0, nothing FAILED', r.code === 0 && fails(r.json).length === 0, 'FAIL lines: ' + fails(r.json).join(', '));
  for (const k of ['reach', 'sitemap-fetch', 'pages-200', 'robots-allow', 'robots-disallow', '404-status', '404-friendly', '404-noindex', 'sec-headers', 'compression', 'assets-ok', 'content-types', 'cache-assets', 'share-image-size', 'jsonld', 'site-check', 'timing-ttfb']) {
    ok(`good site: ${k} is PASS`, find(r.json, 'PASS', k).length > 0, (r.json ? r.json.results.filter((x) => x.key === k).map((x) => x.level + ' ' + x.message).join(' | ') : '').slice(0, 200));
  }
  ok('good site: the owner settings are reported (review link, email signup, farm spot, analytics)', ['setting-review', 'setting-signup', 'setting-farmpoint', 'setting-analytics'].every((k) => r.json.results.some((x) => x.key === k)));
  ok('good site: the summary says whether anything is broken, and the output is plain text (no empty "what to do" on a WARN)', /warning/.test(r.json.summary) && r.json.results.filter((x) => x.level !== 'PASS').every((x) => x.todo || /^Practice run/.test(x.message)));
  r = await check(['--quick']);
  ok('quick check: exit code 0, only pages and headers (no file check)', r.code === 0 && find(r.json, 'PASS', 'pages-200').length === 1 && find(r.json, 'PASS', 'assets-ok').length === 0);
  const text = await runTool([ORIGIN + '/']);
  ok('text output: PASS / WARN / FAIL lines, "What to do" after a warning, a summary at the end', /^PASS /m.test(text.out) && /^WARN /m.test(text.out) && /What to do:/.test(text.out) && /== Summary ==/.test(text.out) && text.code === 0, text.out.slice(-300));
  // the unmodified folder names the real address: fine as a practice run, a FAIL when it is treated as the live site
  opts.root = raw;
  r = await check(['--quick']);
  ok('practice run on the unmodified folder: no FAIL (the placeholder address only warns)', r.code === 0 && find(r.json, 'WARN', 'domain').length === 1, 'FAIL lines: ' + fails(r.json).join(', '));
  r = await check(['--quick', '--live']);
  ok('same folder treated as the live site: FAIL "the site still points at https://www.wiseacresorganic.com"', find(r.json, 'FAIL', 'domain').some((x) => x.message.includes('still points at ' + SITE)) && r.code === 1);
  reset();

  /* ---- one thing broken at a time ---- */
  const broken = async (name, key, setup, args = ['--quick'], level = 'FAIL', code = 1) => {
    reset(); setup();
    const x = await check(args);
    const hit = find(x.json, level, key);
    ok(`${name}: ${level} ${key}${code === 1 ? ', exit code 1' : ', exit code 0'}`, hit.length > 0 && x.code === code, hit.length ? '' : (x.json ? x.json.results.filter((i) => i.level !== 'PASS').map((i) => i.level + ' ' + i.key).join(', ') : x.err));
    if (hit.length && level !== 'PASS') ok(`${name}: the message tells what to do`, hit.every((h) => h.todo && h.message.length > 20), hit[0].todo);
    reset();
    return x;
  };
  await broken('a page of the sitemap is missing', 'page:/wise-pie.html', () => opts.hide.add('/wise-pie.html'));
  await broken('a wrong canonical address', 'canonical:/first-visit.html', () => { opts.mutate['/first-visit.html'] = (t) => t.replace(/(<link rel="canonical" href=")[^"]+/, '$1' + ORIGIN + '/somewhere-else.html'); });
  await broken('no compression', 'compression', () => { opts.gzip = false; });
  await broken('a made-up address answers 200 instead of 404', '404-status', () => { opts.soft404 = true; });
  await broken('a page says noindex', 'noindex-page:/pumpkin-patch.html', () => { opts.mutate['/pumpkin-patch.html'] = (t) => t.replace('<head>', '<head><meta name="robots" content="noindex">'); });
  await broken('robots.txt blocks the site', 'robots-allow', () => { opts.mutate['/robots.txt'] = () => 'User-agent: *\nDisallow: /\n'; });
  await broken('robots.txt forgets the notes folders', 'robots-disallow', () => { opts.mutate['/robots.txt'] = () => 'User-agent: *\nAllow: /\n'; });
  await broken('the sitemap lists a notes page', 'sitemap-forbidden', () => { opts.mutate['/sitemap.xml'] = (t) => t.replace('</urlset>', `<url><loc>${ORIGIN}/docs/NOTES.html</loc></url></urlset>`); });
  await broken('a page redirects instead of answering (like .html to a short address)', 'page-redirect:/wise-pie.html', () => { opts.redirects['/wise-pie.html'] = '/wise-pie'; });
  await broken('the notes folder is online', 'hygiene', () => { fs.mkdirSync(path.join(good, 'docs'), { recursive: true }); fs.writeFileSync(path.join(good, 'docs', 'LAUNCH_CHECKLIST.md'), '# notes'); }, ['--quick']);
  fs.rmSync(path.join(good, 'docs'), { recursive: true, force: true });
  await broken('missing security headers (a host that ignores _headers)', 'sec-headers', () => { opts.headers = false; }, ['--quick'], 'WARN', 0);

  const full = ['--timeout', '15'];
  await broken('a share picture is missing', 'share-image-size', () => opts.hide.add('/assets/og-wise-pie.png'), full);
  await broken('a file the pages need is missing', 'asset-missing', () => opts.hide.add('/assets/og-wise-pie.png'), full);
  await broken('a share picture of the wrong size', 'share-image-size', () => { opts.replace['/assets/og-share.png'] = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'); }, full);
  await broken('broken structured data (JSON-LD)', 'jsonld', () => { opts.mutate['/index.html'] = (t) => t.replace('"@type": "LocalBusiness"', '"@type" "LocalBusiness"'); }, full);
  await broken('leftover TODO / lorem ipsum text', 'placeholders-fail', () => { opts.mutate['/index.html'] = (t) => t.replace('</body>', '<p>TODO fix this lorem ipsum</p></body>'); }, full);
  await broken('the rule that hides the Site check box is gone', 'site-check', () => { opts.mutate['/js/features.js'] = (t) => t.split('[?&]check').join('[?&]zzzz'); }, full);
  await broken('the host sends scripts as text/plain', 'content-types', () => { opts.jsType = 'text/plain'; }, full);
  await broken('the farm spot is set with the numbers swapped', 'setting-farmpoint', () => { opts.mutate['/js/content.js'] = (t) => t.replace(/^(\s*)farmPoint:\s*null/m, '$1farmPoint: { lat: -80.6, lon: 35.1 }'); }, full);
  await broken('a notice bar is left switched on', 'setting-notice', () => { opts.mutate['/js/content.js'] = (t) => t.replace(/^(\s*notice:\s*)''/m, "$1'Closed Saturday for rain.'"); }, full, 'WARN', 0);
  await broken('a notice bar written in five languages is left switched on', 'setting-notice', () => { opts.mutate['/js/content.js'] = (t) => t.replace(/^(\s*notice:\s*)''/m, "$1{ en: 'Closed Saturday for rain.', es: 'Cerrado el sábado por la lluvia.' }"); }, full, 'WARN', 0);
  await broken('old farm addresses forwarded to the new pages', 'old-redirects', () => { opts.redirects['/faq'] = '/#faq'; }, full, 'PASS', 0);

  /* ---- an address that does not answer ---- */
  let x = await check([], 'http://wa-launch-check.invalid/');
  ok('an address that does not exist: FAIL in plain words, exit code 1', x.code === 1 && find(x.json, 'FAIL', 'reach').some((i) => /DNS may still be updating/.test(i.message)), x.json ? x.json.results.map((i) => i.message).join(' | ').slice(0, 200) : x.err);
  x = await check([], 'http://127.0.0.1:1/');
  ok('a port nobody listens on: FAIL "does not answer", exit code 1', x.code === 1 && find(x.json, 'FAIL', 'reach').some((i) => /does not answer/.test(i.message)));
  const bad = await runTool(['not a web address ::']);
  ok('a mistyped address: a clear message and exit code 2', bad.code === 2 && /web address/.test(bad.err), bad.err.slice(0, 120));
} finally {
  await new Promise((r) => { server.closeAllConnections && server.closeAllConnections(); server.close(() => r()); });
  fs.rmSync(tmp, { recursive: true, force: true });
}
info('the check itself takes about 3 seconds per run on this computer');
await finish();
