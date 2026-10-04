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
// A Windows checkout (git config core.autocrlf true) has Windows line endings in every text file, and the tools write Unix ones: the files are compared by their words.
const TEXT_FILE = /\.(html|css|js|mjs|json|svg|txt|xml|webmanifest|md|py)$|^_headers$/;
const lf = (buf) => Buffer.from(buf.toString('latin1').replace(/\r\n/g, '\n'), 'latin1');
const readLf = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const hashAll = (dir) => {
  const out = {};
  (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) { if (f.name !== '__pycache__') walk(p); } else out[path.relative(dir, p)] = crypto.createHash('sha1').update(TEXT_FILE.test(f.name) ? lf(fs.readFileSync(p)) : fs.readFileSync(p)).digest('hex'); } })(dir);
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

  // i18n.py extract: a character that Python counts as a line break but a browser does not (U+2028 from pasted text, U+0085, a form feed) must not
  // move the data-t tags into the middle of a sentence; and when a later page cannot be read, the earlier pages are left as they were
  {
    const t2 = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-extract-'));
    fs.mkdirSync(path.join(t2, 'tools')); fs.mkdirSync(path.join(t2, 'lang', 'src'), { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'tools', 'i18n.py'), path.join(t2, 'tools', 'i18n.py'));
    fs.copyFileSync(path.join(ROOT, 'tools', 'date_phrases.py'), path.join(t2, 'tools', 'date_phrases.py'));   // i18n.py imports it
    for (const [name, ch] of [['U+2028 line separator', '\u2028'], ['U+0085 next-line character', '\u0085'], ['form feed', '\f']]) {
      fs.writeFileSync(path.join(t2, 'a.html'), `<!doctype html>\n<html><body>\n<p>Alpha text${ch}and more</p>\n<p>Beta text here</p>\n</body></html>\n`);
      const r = py(t2, 'tools/i18n.py', 'extract');
      const out = fs.readFileSync(path.join(t2, 'a.html'), 'utf8');
      ok(`extract: a ${name} inside a text does not move the tags (each paragraph gets its own data-t, the words are intact)`,
        r.status === 0 && new RegExp(`<p data-t="t[0-9a-f]{8}">Alpha text${ch}and more</p>\\n<p data-t="t[0-9a-f]{8}">Beta text here</p>`).test(out), JSON.stringify(out.split('\n')[2]));
    }
    fs.writeFileSync(path.join(t2, 'a.html'), '<!doctype html>\n<html><body>\n<p>Alpha text</p>\n</body></html>\n');
    fs.writeFileSync(path.join(t2, 'b.html'), Buffer.from([0x3c, 0x70, 0x3e, 0xff, 0xfe, 0x3c, 0x2f, 0x70, 0x3e]));   // not UTF-8 text
    const r = py(t2, 'tools/i18n.py', 'extract');
    ok('extract: a page that cannot be read stops the run, and the pages before it are not rewritten', r.status !== 0 && !/data-t=/.test(fs.readFileSync(path.join(t2, 'a.html'), 'utf8')), (r.stderr || '').trim().split('\n').pop());
    fs.rmSync(t2, { recursive: true, force: true });
  }
  // a translation file saved by a Windows editor with the invisible marker at the start (a BOM) is read like the other files the tools read
  {
    const t3 = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-bom-'));
    fs.mkdirSync(path.join(t3, 'tools')); fs.mkdirSync(path.join(t3, 'lang', 'src'), { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'tools', 'i18n.py'), path.join(t3, 'tools', 'i18n.py'));
    fs.copyFileSync(path.join(ROOT, 'tools', 'date_phrases.py'), path.join(t3, 'tools', 'date_phrases.py'));   // i18n.py imports it
    fs.writeFileSync(path.join(t3, 'lang', 'en.json'), '{}');
    const plain = '{\n "js": {\n  "Hello": "Hola"\n },\n "ui": {}\n}\n';
    fs.writeFileSync(path.join(t3, 'lang', 'src', 'es.json'), '\ufeff' + plain);
    const r = py(t3, 'tools/i18n.py', 'build');
    ok('i18n.py build: a translation file with a BOM is read (not "not valid JSON")', r.status === 0 && fs.existsSync(path.join(t3, 'lang', 'es.js')) && /"Hello":"Hola"/.test(fs.readFileSync(path.join(t3, 'lang', 'es.js'), 'utf8')), (r.stdout + r.stderr).trim().split('\n')[0]);
    fs.rmSync(t3, { recursive: true, force: true });
  }

  // the tools' own checks (tools/test_*.py): each builds its own throw-away folders and needs Pillow
  for (const name of fs.readdirSync(path.join(ROOT, 'tools')).filter((f) => /^test_.*\.py$/.test(f)).sort()) {
    if (py(ROOT, '-c', 'import PIL').status !== 0) { info(`(tools/${name} was skipped: Pillow is not installed; pip install pillow)`); continue; }
    const r = spawnSync(PY, [`tools/${name}`], { cwd: tmp, encoding: 'utf8', timeout: 900000 });   // test_change_fact.py makes seven copies of the site and rebuilds each: about 2 minutes, 5 on a very busy computer
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
  const mapBefore = readLf(path.join(tmp, 'js', 'farm-map-data.js'));
  const fm = py(tmp, 'tools/farm_map.py', 'tools/saved-map.json');
  ok('farm_map.py rebuilds js/farm-map-data.js exactly as committed', fm.status === 0 && readLf(path.join(tmp, 'js', 'farm-map-data.js')) === mapBefore, fm.stdout.split('\n')[0]);
  fs.writeFileSync(path.join(tmp, 'empty-map.json'), JSON.stringify({ imageSize: { width: 380, height: 587 }, items: [{ id: 'p', type: 'pen', pts: [[1, 1], [2, 2]] }] }));
  const em = py(tmp, 'tools/farm_map.py', 'empty-map.json');
  ok('farm_map.py refuses a map with nothing to draw and keeps the old one', em.status !== 0 && readLf(path.join(tmp, 'js', 'farm-map-data.js')) === mapBefore, (em.stderr || em.stdout).trim().split('\n')[0]);
  const nf = py(tmp, 'tools/farm_map.py', 'no-such-file.json');
  ok('farm_map.py says plainly when the file is missing (no Python error)', nf.status !== 0 && !/Traceback/.test(nf.stderr), (nf.stderr || '').trim().split('\n')[0]);

  // a saved map with values the Marker should not write but a hand edit can: a shape or a kind that is a list or a block (not a word)
  const write = (name, items) => fs.writeFileSync(path.join(tmp, name), JSON.stringify({ imageSize: { width: 380, height: 587 }, items }));
  const mapNow = () => fs.readFileSync(path.join(tmp, 'js', 'farm-map-data.js'), 'utf8');
  write('odd-map.json', [
    { id: 'a', type: ['pin'], kind: 'barn', label: 'Shape is a list', pts: [[10, 10]] },
    { id: 'b', type: 'pin', kind: ['barn'], label: 'Kind is a list', pts: [[20, 20]] },
    { id: 'c', type: 'pin', kind: { x: 1 }, label: 'Kind is a block', pts: [[30, 30]] },
    { id: 'd', type: { x: 1 }, label: 'Shape is a block', pts: [[35, 35]] },
    { id: 'e', type: 'pin', kind: 'barn', label: 'Fine', pts: [[40, 40]] }]);
  const odd = py(tmp, 'tools/farm_map.py', 'odd-map.json');
  const oddMap = mapNow();
  ok('farm_map.py: a shape or a kind written as a list or a block does not stop it (no Python error): the point is skipped or shown as "Something else"', odd.status === 0 && !/Traceback/.test(odd.stderr), (odd.stderr || '').trim().split('\n').pop());
  let drawn = [];
  try { drawn = JSON.parse(oddMap.slice(oddMap.indexOf('{'), oddMap.lastIndexOf('}') + 1)).items.map((i) => i.label + ': ' + i.kind); } catch (e) { drawn = ['not readable: ' + e.message]; }
  ok('...the three usable points are written (a kind that is no word becomes "other"), the two shapes that are no word are skipped', JSON.stringify(drawn) === JSON.stringify(['Kind is a list: other', 'Kind is a block: other', 'Fine: barn']), JSON.stringify(drawn));
  fs.writeFileSync(path.join(tmp, 'js', 'farm-map-data.js'), mapBefore);
  // half of an emoji (JavaScript cuts a text between its two halves) cannot be written as UTF-8: the old file must stay, not be emptied first
  write('half-emoji-map.json', [{ id: 'a', type: 'pin', kind: 'barn', label: 'Barn \ud83d', pts: [[10, 10]] }, { id: 'b', type: 'pin', kind: 'barn', label: 'Fine', pts: [[40, 40]] }]);
  const half = py(tmp, 'tools/farm_map.py', 'half-emoji-map.json');
  ok('farm_map.py: a name that cannot be saved is refused in plain words, and js/farm-map-data.js is left as it was (not emptied)', half.status !== 0 && !/Traceback/.test(half.stderr) && mapNow() === mapBefore, (half.stderr || half.stdout).trim().split('\n').slice(-1)[0] + (mapNow() === mapBefore ? '' : '  [the file changed: ' + mapNow().length + ' letters]'));
  fs.writeFileSync(path.join(tmp, 'js', 'farm-map-data.js'), mapBefore);

  // the QR signs
  if (hasSegno) {
    const qr = py(tmp, 'tools/make_qr.py');
    const now = hashAll(tmp), changed = differ(before, now).filter((f) => /^(assets[\\/]qr|print)/.test(f));
    ok('make_qr.py rebuilds the signs exactly as committed', qr.status === 0 && changed.length === 0, qr.stderr.trim().split('\n').pop() || changed.join(', '));
    // one address that is too long for a QR code: no sign is written (an earlier sign used to be written before the later one was looked at)
    {
      const cfgFile = path.join(tmp, 'tools', 'qr_links.json'), cfgText = fs.readFileSync(cfgFile, 'utf8'), cfg = JSON.parse(cfgText);
      cfg.signs[1].url = 'https://www.instagram.com/a-new-name/';                          // this sign's code would change...
      cfg.signs[cfg.signs.length - 1].url = 'https://example.com/' + 'a'.repeat(3000);       // ...but a later one cannot be made
      fs.writeFileSync(cfgFile, JSON.stringify(cfg));
      const mark = hashAll(tmp);
      const long = py(tmp, 'tools/make_qr.py');
      const moved = differ(mark, hashAll(tmp)).filter((f) => /^(assets[\\/]qr|print)/.test(f));
      ok('make_qr.py: one address too long: a plain message, exit code 1, and no sign or sheet is changed', long.status !== 0 && !/Traceback/.test(long.stderr) && /too long/.test(long.stderr) && moved.length === 0, moved.length ? 'changed: ' + moved.join(', ') : (long.stderr || '').trim().split('\n').pop());
      fs.writeFileSync(cfgFile, cfgText);
    }
  } else info('(segno is not installed: the QR check was skipped; pip install segno)');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
await finish({});
