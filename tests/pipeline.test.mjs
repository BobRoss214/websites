// order: 50
// browser: no
// covers: tools/*, lang/*, pages/*, *.html, js/farm-map-data.js, print/*, assets/qr/*
/* The Python tools (needs python3 and beautifulsoup4; segno for the QR part):
 *   - the rebuild commands (pages.py, i18n.py extract, i18n.py build) change nothing on a finished site, and give the same result run twice
 *   - no translation is missing, no text is left loose (orphans)
 *   - an edited English sentence is reported as missing, and unsafe translations / empty maps are refused
 *   - the farm map and the QR signs are rebuilt exactly as committed
 *   - every page's icon sprite has every drawing the page points at; the extra pages load js/footer-art.js, not js/hero.js
 *   - the tools' own checks (tools/test_add_photo.py, tools/test_pages.py) pass
 * Everything happens in a temporary copy of the site; your files are not touched. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { ROOT, ok, info, skip, finish } from './lib.mjs';

const PY = process.env.WA_PYTHON || 'python3';
const py = (cwd, ...args) => spawnSync(PY, args, { cwd, encoding: 'utf8' });
if (py(ROOT, '-c', 'import bs4').status !== 0) skip(`${PY} with beautifulsoup4 is not available (pip install beautifulsoup4)`);
const hasSegno = py(ROOT, '-c', 'import segno').status === 0;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-pipeline-'));
fs.cpSync(ROOT, tmp, { recursive: true, filter: (src) => !/(^|[\\/])(\.git|node_modules|tests|__pycache__)([\\/]|$)/.test(path.relative(ROOT, src)) });
const hashAll = (dir) => {
  const out = {};
  (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) { if (f.name !== '__pycache__') walk(p); } else out[path.relative(dir, p)] = crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex'); } })(dir);
  return out;
};
const differ = (a, b) => Object.keys({ ...a, ...b }).filter((k) => a[k] !== b[k]);
const rebuild = () => [py(tmp, 'tools/pages.py'), py(tmp, 'tools/i18n.py', 'extract'), py(tmp, 'tools/i18n.py', 'build')];

try {
  const before = hashAll(tmp);
  for (const round of [1, 2]) {
    const r = rebuild();
    ok(`rebuild commands, run ${round}: all three succeed`, r.every((x) => x.status === 0), r.map((x) => x.stderr.trim().split('\n').pop()).filter(Boolean).join(' | '));
    const changed = differ(before, hashAll(tmp));
    ok(`rebuild commands, run ${round}: nothing changes on a finished site`, changed.length === 0, changed.slice(0, 5).join(', '));
  }
  for (const code of ['es', 'hi', 'zh', 'vi']) {
    const r = py(tmp, 'tools/i18n.py', 'missing', code);
    ok(`${code}: no translation missing (page text and JavaScript text)`, /, 0 missing, .*JavaScript: 0 missing/.test(r.stdout), r.stdout.trim());
  }
  const orphans = py(tmp, 'tools/i18n.py', 'orphans');
  ok('no loose text left out of the translations (orphans)', orphans.status === 0 && orphans.stdout.trim() === '', orphans.stdout.trim().split('\n')[0]);

  // the light pages: every drawing a page points at (<use href="#...">, url(#...), also in the style sheets) is on that page, the extra pages load the
  // footer art and not the hero engine, and the home page keeps both
  {
    const cssUrls = fs.readdirSync(path.join(tmp, 'css')).filter((f) => f.endsWith('.css')).flatMap((f) => [...fs.readFileSync(path.join(tmp, 'css', f), 'utf8').matchAll(/url\(\s*["']?#([^)"']+)/g)].map((m) => m[1]));
    for (const f of fs.readdirSync(tmp).filter((x) => x.endsWith('.html') && x !== '404.html').sort()) {
      const t = fs.readFileSync(path.join(tmp, f), 'utf8');
      const have = new Set([...t.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
      const want = new Set([...[...t.matchAll(/<use\b[^>]*?\bhref="#([^"]+)"/g)].map((m) => m[1]), ...[...t.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]), ...cssUrls]);
      const lost = [...want].filter((i) => !have.has(i));
      ok(`${f}: every drawing the page points at is in its icon sprite (${want.size} used)`, lost.length === 0, lost.join(', '));
      const hero = t.includes('id="hero-scene"');
      ok(`${f}: loads ${hero ? 'js/hero.js' : 'js/footer-art.js and not js/hero.js'}`, hero ? t.includes('<script src="js/hero.js">') : (t.includes('<script src="js/footer-art.js">') && !t.includes('js/hero.js')));
    }
  }

  // the tools' own checks (tools/test_*.py): each builds its own throw-away folders and needs Pillow
  for (const name of fs.readdirSync(path.join(ROOT, 'tools')).filter((f) => /^test_.*\.py$/.test(f)).sort()) {
    if (py(ROOT, '-c', 'import PIL').status !== 0) { info(`(tools/${name} was skipped: Pillow is not installed; pip install pillow)`); continue; }
    const r = spawnSync(PY, [`tools/${name}`], { cwd: tmp, encoding: 'utf8', timeout: 170000 });
    const out = (r.stderr || '') + (r.stdout || '');
    ok(`tools/${name} passes`, r.status === 0 && /\bOK\b/.test(out), out.trim().split('\n').slice(-3).join(' | '));
  }

  // an edited English sentence shows up as missing, with its new id
  const idx = path.join(tmp, 'index.html');
  const html = fs.readFileSync(idx, 'utf8');
  const OLD = 'Pick your own in the patch.';
  if (html.includes(OLD)) {
    fs.writeFileSync(idx, html.replace(OLD, 'Pick your own in the big patch.'));
    py(tmp, 'tools/pages.py'); py(tmp, 'tools/i18n.py', 'extract');
    const m = py(tmp, 'tools/i18n.py', 'missing', 'es', '--list');
    ok('an edited English sentence is listed as missing (with --list)', /1 missing/.test(m.stdout) && /Pick your own in the big patch\./.test(m.stdout), m.stdout.trim().split('\n').slice(0, 2).join(' / '));
    fs.writeFileSync(idx, html);
    py(tmp, 'tools/pages.py'); py(tmp, 'tools/i18n.py', 'extract'); py(tmp, 'tools/i18n.py', 'build');
  } else info('(the sentence used for the "edited English" check is no longer on the page: that check was skipped)');

  // unsafe translations are refused, and nothing is half-built
  const esFile = path.join(tmp, 'lang', 'src', 'es.json'), esJs = path.join(tmp, 'lang', 'es.js');
  const esBefore = fs.readFileSync(esFile, 'utf8'), jsBefore = fs.readFileSync(esJs, 'utf8');
  const data = JSON.parse(esBefore); const k = Object.keys(data.ui)[0];
  data.ui[k] += ' <img src=x onerror=alert(1)>';
  fs.writeFileSync(esFile, JSON.stringify(data));
  const bad = py(tmp, 'tools/i18n.py', 'build');
  ok('build refuses a translation that adds markup or an event handler', bad.status !== 0 && fs.readFileSync(esJs, 'utf8') === jsBefore, (bad.stderr || bad.stdout).trim().split('\n').slice(0, 2).join(' / '));
  fs.writeFileSync(esFile, esBefore);

  // the farm map
  const mapBefore = fs.readFileSync(path.join(tmp, 'js', 'farm-map-data.js'), 'utf8');
  const fm = py(tmp, 'tools/farm_map.py', 'tools/saved-map.json');
  ok('farm_map.py rebuilds js/farm-map-data.js exactly as committed', fm.status === 0 && fs.readFileSync(path.join(tmp, 'js', 'farm-map-data.js'), 'utf8') === mapBefore, fm.stdout.split('\n')[0]);
  fs.writeFileSync(path.join(tmp, 'empty-map.json'), JSON.stringify({ imageSize: { width: 380, height: 587 }, items: [{ id: 'p', type: 'pen', pts: [[1, 1], [2, 2]] }] }));
  const em = py(tmp, 'tools/farm_map.py', 'empty-map.json');
  ok('farm_map.py refuses a map with nothing to draw and keeps the old one', em.status !== 0 && fs.readFileSync(path.join(tmp, 'js', 'farm-map-data.js'), 'utf8') === mapBefore, (em.stderr || em.stdout).trim().split('\n')[0]);
  const nf = py(tmp, 'tools/farm_map.py', 'no-such-file.json');
  ok('farm_map.py says plainly when the file is missing (no Python error)', nf.status !== 0 && !/Traceback/.test(nf.stderr), (nf.stderr || '').trim().split('\n')[0]);

  // the QR signs
  if (hasSegno) {
    const qr = py(tmp, 'tools/make_qr.py');
    const now = hashAll(tmp), changed = differ(before, now).filter((f) => /^(assets[\\/]qr|print)/.test(f));
    ok('make_qr.py rebuilds the signs exactly as committed', qr.status === 0 && changed.length === 0, qr.stderr.trim().split('\n').pop() || changed.join(', '));
  } else info('(segno is not installed: the QR check was skipped; pip install segno)');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
await finish({});
