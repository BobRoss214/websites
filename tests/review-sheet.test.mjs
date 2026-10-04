// order: 65
// browser: no
// quick: no
// covers: tools/review_sheet.py, lang/src/*
/* The language review kit (tools/review_sheet.py): a friend who speaks the language corrects the site in a spreadsheet, and the corrections come back
 * into lang/src/<code>.json. Needs Python 3.8 or newer (no packages) and no browser. Everything happens in a temporary copy of the site; your files
 * are not touched.
 *   - export, from the real files: five files for every language (an .xlsx with a "Texts" sheet and a "Read me first" sheet, the same table as CSV with a
 *     byte order mark, as a printable page with the one-page instructions, the instructions page alone, and the e-mail text), one row for every text with its priority (1: the 150
 *     texts to do first, 2: the next 450, 3: the rest; inside a priority in reading order), our question for the friend where we have one, aria and alt
 *     texts and the QR sign words marked, a text on several pages once, the same bytes every time (on every Python version)
 *   - the instructions for the friend (tools/review_instructions.json): in English and in the friend's language, complete, and the data files
 *     (tools/review_notes.json) point only at texts that exist; a question goes away when the line it was about is fixed; the tool still works without them
 *   - import: a sheet with no corrections changes nothing byte for byte (also saved by Excel in other ways); a sheet where every row repeats the text
 *     already on the site is accepted completely (so the rules accept every text of the site and the English in every row matches its id)
 *   - a good correction changes exactly one line of lang/src/<code>.json (or one word of tools/qr_links.json), keeps the key order and the layout,
 *     never touches English, leaves no temporary file
 *   - every bad correction is refused with its row number, its id and the right plain reason; the good rows are still applied (--strict applies
 *     none, the exit code is 1); a dry run writes nothing
 *   - the ways Excel and Google Sheets save a file: commas, semicolons, tabs, CRLF or LF, with and without a byte order mark, UTF-16, quotes inside
 *     quotes, columns in another order, an .xlsx file; files that cannot be used (wrong language, not UTF-8, no header) are refused in plain words
 *   - what a friend can do wrong in the sheet and what a spreadsheet program does to it: a number or a date in the correction cell, cells that only have a
 *     colour (LibreOffice and Excel write them), words typed over the English, over the current translation or in the question column, a .ods file, a
 *     file made before the priority column existed: refused or listed by row in plain words, never lost silently and never written wrong
 *   - drift: the facts check of the tool is run beside differences() of tests/consistency.test.mjs on about 20,000 pairs and must give the same answer
 *   - the tool is written for Python 3.8 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { ROOT, ok, info, skip, finish } from './lib.mjs';

const PY = process.env.WA_PYTHON || 'python3';
const TOOL = path.join(ROOT, 'tools', 'review_sheet.py');
if (!fs.existsSync(TOOL)) { ok('tools/review_sheet.py exists', false); await finish(); process.exit(1); }
if (spawnSync(PY, ['-c', 'import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)']).status !== 0) skip(`${PY} (Python 3.8 or newer) is not available`);

const LANGS = ['es', 'hi', 'zh', 'vi'];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-review-'));
const site = path.join(tmp, 'site');
const copy = (rel) => { fs.mkdirSync(path.dirname(path.join(site, rel)), { recursive: true }); fs.cpSync(path.join(ROOT, rel), path.join(site, rel), { recursive: true }); };
for (const f of ['tools/review_sheet.py', 'tools/review_notes.json', 'tools/review_instructions.json', 'tools/qr_links.json', 'lang/en.json', 'lang/js-strings.json', 'lang/src', 'js/content.js']) copy(f);
if (fs.existsSync(path.join(ROOT, 'tools', 'i18n_facts_allow.json'))) copy('tools/i18n_facts_allow.json');   // the 22 differences that are meant (when the facts audit is in the site)
for (const f of fs.readdirSync(ROOT).filter((x) => x.endsWith('.html'))) copy(f);

const run = (...args) => { const r = spawnSync(PY, ['tools/review_sheet.py', ...args], { cwd: site, encoding: 'utf8', maxBuffer: 1 << 28 }); return { code: r.status, out: r.stdout || '', err: r.stderr || '', all: (r.stdout || '') + (r.stderr || '') }; };
const py = (code, input) => { const r = spawnSync(PY, ['-c', code], { cwd: site, encoding: 'utf8', input, maxBuffer: 1 << 28 }); return { code: r.status, out: r.stdout || '', err: r.stderr || '' }; };
const sha = (f) => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex');
const here = (...p) => path.join(site, ...p);
const read = (...p) => fs.readFileSync(here(...p), 'utf8');
const pristine = path.join(tmp, 'pristine');
fs.cpSync(site, pristine, { recursive: true });
const restore = () => { for (const d of ['lang', 'tools']) { fs.rmSync(here(d), { recursive: true, force: true }); fs.cpSync(path.join(pristine, d), here(d), { recursive: true }); } fs.rmSync(here('review'), { recursive: true, force: true }); };
const SOURCES = () => { const out = {}; (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else out[path.relative(site, p)] = sha(p); } })(site); delete out['tools/review_sheet.py']; return Object.fromEntries(Object.entries(out).filter(([k]) => !k.startsWith('review' + path.sep) && !k.includes('__pycache__'))); };
const changedFiles = (a, b) => Object.keys({ ...a, ...b }).filter((k) => a[k] !== b[k]);

/* ---- a small CSV reader and writer (what Excel and Google Sheets make) ---- */
function parseCsv(text, d = ',') {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === d) { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; rows.push(row); row = []; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows;
}
function writeCsv(rows, { delim = ',', nl = '\r\n', all = false } = {}) {
  const cell = (s) => (all || /[",\r\n]/.test(s) || s.includes(delim) ? '"' + String(s).replace(/"/g, '""') + '"' : String(s));
  return rows.map((r) => r.map(cell).join(delim)).join(nl) + nl;
}
const COL = { id: 0, pri: 1, where: 2, en: 3, cur: 4, ask: 5, corr: 6, note: 7 };
const HEADER = ['id', 'priority', 'where', 'English', 'current translation', 'question for you', 'correction', 'note'];
const sheet = (code) => parseCsv(read('review', code + '.csv').replace(/^﻿/, ''));
const save = (name, rows, opts = {}) => {
  const text = writeCsv(rows, opts), p = here('review', name);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, opts.bytes ? opts.bytes(text) : Buffer.from((opts.bom === false ? '' : '﻿') + text, 'utf8'));
  return path.join('review', name);
};
const rowOf = (rows, pred) => rows.slice(1).find(pred);
const withCorrections = (rows, edits) => rows.map((r, i) => { if (i === 0) return r.slice(); const id = r[COL.id]; if (!(id in edits)) return r.slice(); const c = r.slice(); c[COL.corr] = edits[id]; return c; });
const EN = JSON.parse(fs.readFileSync(path.join(ROOT, 'lang', 'en.json'), 'utf8'));
const SRC = (code) => JSON.parse(fs.readFileSync(here('lang', 'src', code + '.json'), 'utf8'));
const plain = (s) => String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const tweak = (s) => (/[.。।!]$/.test(s) ? s.replace(/[.。।!]$/, '!') : s + '!');   // a small real change that keeps every fact

try {
  /* ------------------------------------------------------------------ the tool is written for Python 3.8 */
  {
    const r = py('import ast,sys\nsrc=open("tools/review_sheet.py",encoding="utf-8").read()\nast.parse(src, feature_version=(3, 8))\nprint("ok")');
    ok('the tool is valid Python 3.8 syntax (no newer syntax)', r.code === 0 && /ok/.test(r.out), r.err.trim().split('\n').pop());
    const old = spawnSync('python3.8', ['-m', 'py_compile', here('tools', 'review_sheet.py')], { encoding: 'utf8' });
    if (old.error) info('(python3.8 itself is not installed here; the syntax was checked with feature_version=(3, 8))');
    else ok('python3.8 compiles the tool', old.status === 0, (old.stderr || '').trim().split('\n').pop());
    const imp = spawnSync('python3.8', ['-c', 'import sys; sys.path.insert(0, "tools"); import review_sheet; print(len(review_sheet.NAMES))'], { cwd: site, encoding: 'utf8' });
    if (!imp.error) ok('python3.8 imports the tool and runs its rules', imp.status === 0 && /^\d+/.test(imp.stdout), (imp.stderr || '').trim().split('\n').pop());
  }

  /* ------------------------------------------------------------------ export */
  const before = SOURCES();
  const ex = run('export', 'all');
  ok('export all succeeds', ex.code === 0 && LANGS.every((c) => new RegExp('^' + c + ': \\d+ rows', 'm').test(ex.out)), ex.all.slice(0, 200));
  ok('export writes only into review/ (no site file changes)', changedFiles(before, SOURCES()).length === 0, changedFiles(before, SOURCES()).join(', '));
  ok('export makes five files for every language: .xlsx, .csv, .html, -instructions.html and -message.txt (nothing else)', fs.readdirSync(here('review')).sort().join(',') === LANGS.flatMap((c) => [c + '-instructions.html', c + '-message.txt', c + '.csv', c + '.html', c + '.xlsx']).sort().join(','), fs.readdirSync(here('review')).join(','));
  const qr = JSON.parse(read('tools', 'qr_links.json'));
  const jsFiles = JSON.parse(read('lang', 'js-strings.json'));
  const notes = JSON.parse(read('tools', 'review_notes.json'));
  const exported = {}, orders = {};
  /* the texts in reading order with what the tool knows about each (the sheet itself is sorted by priority) */
  const orderOf = (code) => JSON.parse(py(`import sys, json\nsys.path.insert(0, "tools")\nimport review_sheet as r\nsite = r.Site()\nprint(json.dumps([[i.id, i.kind, i.quiet, i.english] for i in r.build_items(site, ${JSON.stringify(code)})]))`).out);
  for (const code of LANGS) {
    const raw = fs.readFileSync(here('review', code + '.csv'));
    ok(`${code}: the CSV starts with a UTF-8 byte order mark (Excel then reads the letters right)`, raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf);
    ok(`${code}: Windows line ends (\\r\\n) between rows`, /\r\n/.test(raw.toString('utf8')) && !/[^\r]\n/.test(raw.toString('utf8').replace(/"[^"]*"/g, '')));
    const rows = sheet(code), head = rows[0], data = rows.slice(1);
    exported[code] = rows;
    ok(`${code}: the columns are id, priority, where, English, current translation, question for you, correction, note`, head.join('|') === HEADER.join('|'), head.join('|'));
    ok(`${code}: every row has eight cells; priority is 1, 2 or 3; correction and note are empty`, data.every((r) => r.length === 8 && /^[123]$/.test(r[COL.pri]) && r[COL.corr] === '' && r[COL.note] === ''), String(data.findIndex((r) => r.length !== 8 || !/^[123]$/.test(r[COL.pri]) || r[COL.corr] || r[COL.note])));
    const src = SRC(code);
    const jsKeys = new Set([...Object.keys(jsFiles), ...Object.keys(src.js)]);
    const nQr = qr.signs.length * 2 + (code === 'es' ? 0 : 2);
    ok(`${code}: one row for every page text (${Object.keys(EN).length}), every text the code writes (${jsKeys.size}) and every QR sign line (${nQr})`, data.length === Object.keys(EN).length + jsKeys.size + nQr, `${data.length} rows`);
    const ids = data.map((r) => r[COL.id]);
    ok(`${code}: every id is there once (a text on several pages is listed once)`, new Set(ids).size === ids.length && Object.keys(EN).every((id) => ids.includes(id)), 'duplicates: ' + ids.filter((x, i) => ids.indexOf(x) !== i).slice(0, 3).join(','));
    const unspace = (s) => s.replace(/^ (?=[=+\-@\t])/, '');
    const dec = (s) => s.replace(/&amp;/g, '&');   // the sheet shows an ordinary & where the page text has &amp;
    let bad = '';
    for (const r of data) {
      if (r[COL.id].startsWith('t') && EN[r[COL.id]] !== undefined) { if (unspace(r[COL.en]) !== dec(EN[r[COL.id]])) bad = bad || r[COL.id] + ' English'; if (unspace(r[COL.cur]) !== dec(src.ui[r[COL.id]] || '')) bad = bad || r[COL.id] + ' translation'; }
      else if (r[COL.id].startsWith('j')) { if (!jsKeys.has(unspace(r[COL.en])) || unspace(r[COL.cur]) !== (src.js[unspace(r[COL.en])] || '')) bad = bad || r[COL.id] + ' js'; }
      else if (!r[COL.id].startsWith('qr-')) bad = bad || r[COL.id] + ' unknown id';
    }
    ok(`${code}: the English and the current translation in every row are the ones in the files`, bad === '', bad);
    ok(`${code}: every row says where it is (words, never empty)`, data.every((r) => r[COL.where].trim().length > 3), String(data.findIndex((r) => r[COL.where].trim().length <= 3)));
    ok(`${code}: no cell starts with = + - or @ (Excel would read it as a formula)`, data.every((r) => [COL.where, COL.en, COL.cur, COL.ask].every((i) => !/^[=+\-@\t]/.test(r[i]))));
    /* priority and order */
    const order = orderOf(code); orders[code] = order;
    const known = Object.fromEntries(order.map(([id, kind, quiet, en]) => [id, { kind, quiet, en }]));
    const prio = data.map((r) => +r[COL.pri]);
    const n = [1, 2, 3].map((p) => prio.filter((x) => x === p).length);
    ok(`${code}: priority 1 is 150 texts, priority 2 the next 450, priority 3 all the others (${n.join(', ')})`, n[0] === 150 && n[1] === 450 && n[2] === data.length - 600, n.join(', '));
    const pos = (id) => order.findIndex((o) => o[0] === id);
    ok(`${code}: the rows come priority 1 first, then 2, then 3; inside a priority in reading order (the home page, the other pages in order, the texts the code writes)`,
      prio.every((p, i) => i === 0 || p >= prio[i - 1]) && [1, 2, 3].every((p) => { const at = data.filter((r) => +r[COL.pri] === p).map((r) => pos(r[COL.id])); return at.every((x, i) => x >= 0 && (i === 0 || x > at[i - 1])); }));
    ok(`${code}: priority 1 has every QR sign line (${nQr}; they are printed on signs, which costs money to fix)`, data.filter((r) => r[COL.id].startsWith('qr-')).every((r) => r[COL.pri] === '1') && data.filter((r) => r[COL.pri] === '1' && r[COL.id].startsWith('qr-')).length === nQr);
    const priced = data.filter((r) => known[r[COL.id]] && known[r[COL.id]].kind === 'ui' && !known[r[COL.id]].quiet && /\$/.test(known[r[COL.id]].en));
    ok(`${code}: priority 1 has every text on a page that has a price in it (${priced.length})`, priced.length > 20 && priced.every((r) => r[COL.pri] === '1'), priced.filter((r) => r[COL.pri] !== '1').map((r) => r[COL.id]).slice(0, 3).join(','));
    const promised = (notes.first || []).filter((id) => known[id]);
    ok(`${code}: priority 1 has the lines about refunds, rain, pets, allergies and safety that tools/review_notes.json names (${promised.length})`, promised.length >= 20 && promised.every((id) => data.find((r) => r[COL.id] === id)[COL.pri] === '1'));
    const hero = data.find((r) => r[COL.en] === 'Welcome to Wise Acres!'), menu = data.find((r) => r[COL.en] === 'Visit');
    ok(`${code}: priority 1 starts at the top of the home page (the menu, the hero words)`, hero && menu && hero[COL.pri] === '1' && menu[COL.pri] === '1' && ids.indexOf(menu[COL.id]) < 40);
    ok(`${code}: a text nobody reads on the screen (screen-reader label only, photo description, page title) is never in priority 1`, data.every((r) => r[COL.pri] !== '1' || r[COL.id].startsWith('qr-') || !known[r[COL.id]].quiet || (notes.first || []).includes(r[COL.id])));
    const last = data.filter((r) => r[COL.pri] === '3').map((r) => r[COL.id]);
    ok(`${code}: the texts of the page's code and the photo descriptions are mostly priority 3`, data.filter((r) => /^\[photo description\]/.test(r[COL.where])).every((r) => r[COL.pri] !== '1') && last.length > 500);
    const w = data.map((r) => r[COL.where]);
    ok(`${code}: marked as such: photo descriptions, screen-reader labels, page titles and descriptions, QR sign words`, ['[photo description]', '[screen-reader label]', '[page title or search description]', '[QR sign]'].every((m) => w.some((x) => x.includes(m))));
    const skipRow = data.find((r) => unspace(r[COL.en]) === 'Skip to content');
    ok(`${code}: a text on every page says "Every page"`, skipRow && /^Every page/.test(skipRow[COL.where]), skipRow && skipRow[COL.where]);
    ok(`${code}: a text on two pages names both`, w.some((x) => /; also on: /.test(x)));
    /* the question for you column */
    const asked = data.filter((r) => r[COL.ask] !== '');
    const allowN = fs.existsSync(here('tools', 'i18n_facts_allow.json')) ? JSON.parse(read('tools', 'i18n_facts_allow.json')).filter((e) => e.lang === code).length : 0;
    ok(`${code}: the question column has our doubts, what we changed after a check and (${allowN}) what differs on purpose; most rows have none (${asked.length} rows)`, asked.length >= 8 && asked.length < 60 && asked.every((r) => r[COL.ask].length > 40 && /[.?)”]$/.test(r[COL.ask])), String(asked.length));
    if (allowN) {
      const allow = JSON.parse(read('tools', 'i18n_facts_allow.json')).filter((e) => e.lang === code);
      const lost = allow.filter((e) => !asked.some((r) => r[COL.ask].includes('On purpose: ' + e.reason)));
      ok(`${code}: every one of the ${allow.length} differences from the English that are meant (the facts allow list) is shown to the friend on its row, with its reason`, lost.length === 0, lost.map((e) => e.id).join(','));
    }
    ok(`${code}: no question is left half-made (no @ placeholder, no "undefined", no raw {braces} from the data file)`, asked.every((r) => !/undefined|\[object|@LANG@|@N\d@/.test(r[COL.ask])));
    /* the printable page */
    const html = read('review', code + '.html');
    const trs = (html.match(/<td class="id">/g) || []).length;
    ok(`${code}: the printable page has the same rows, the language's own fonts and no script`, trs === data.length && html.includes(`<td lang="${{ es: 'es', hi: 'hi', zh: 'zh-Hans', vi: 'vi' }[code]}">`) && html.includes({ es: 'system-ui', hi: 'Noto Sans Devanagari', zh: 'PingFang SC', vi: 'Segoe UI' }[code]) && !/<script/i.test(html) && /@media print/.test(html), `${trs} rows`);
    ok(`${code}: the printable page shows every id and escapes the markup of the texts`, ids.every((id) => html.includes('>' + id + '<')) && !/<a1>|<svg\/>/.test(html));
    ok(`${code}: the printable page starts with the instructions in two columns (the friend's language, then English) and has a heading row for each priority`, (html.match(/<section lang="/g) || []).length === 2 && html.indexOf('<section lang="' + { es: 'es', hi: 'hi', zh: 'zh-Hans', vi: 'vi' }[code] + '">') < html.indexOf('<section lang="en">') && html.indexOf('<section lang="en">') < html.indexOf('<table class="main">') && [1, 2, 3].every((p) => html.includes(`<tr class="group p${p}">`)));
    const lone = read('review', code + '-instructions.html');
    ok(`${code}: the instructions page alone: the same two columns as the top of the printable page, one landscape page when printed, no table and no script`, (lone.match(/<section lang="/g) || []).length === 2 && lone.includes(html.slice(html.indexOf('<div class="how">'), html.indexOf('</div>', html.indexOf('<div class="how">')))) && /@page\{size:landscape/.test(lone) && !/<table class="main"|<script/i.test(lone) && lone.length < 30000, String(lone.length));
    ok(`${code}: the printable page prints the instructions on one landscape page, then the table`, /@page\{size:landscape/.test(html) && /\.how\{[^}]*break-after:page/.test(html.slice(html.indexOf('@media print'))));
  }
  /* the same bytes every time, on every file */
  const snapshot = () => Object.fromEntries(fs.readdirSync(here('review')).map((f) => [f, sha(here('review', f))]));
  const first = snapshot();
  const again = run('export', 'all');
  const second = snapshot();
  ok('exporting again with no corrections in the sheets gives the same bytes in all 20 files (no dates, nothing random)', again.code === 0 && Object.keys(first).length === 20 && JSON.stringify(first) === JSON.stringify(second), Object.keys(first).filter((k) => first[k] !== second[k]).join(','));
  {
    const same = LANGS.every((c) => Buffer.compare(fs.readFileSync(here('review', c + '.csv')), Buffer.from('﻿' + writeCsv(exported[c]), 'utf8')) === 0);
    ok('the CSV read and written again by a program gives the same bytes (so no program can find it odd)', same);
    const old = spawnSync('python3.8', ['tools/review_sheet.py', 'export', 'all', '--out=review38'], { cwd: site, encoding: 'utf8' });
    if (old.error) info('(python3.8 itself is not installed here; the sheets were only made with ' + PY + ')');
    else ok('Python 3.8 makes the same 20 files, byte for byte, as the newer Python (the owner may have either)', old.status === 0 && fs.readdirSync(here('review38')).every((f) => sha(here('review38', f)) === first[f]) && fs.readdirSync(here('review38')).length === 20, (old.stderr || '').slice(0, 200));
    fs.rmSync(here('review38'), { recursive: true, force: true });
  }

  /* ------------------------------------------------------------------ the .xlsx file */
  const XL = `import sys, json, zipfile, re
from xml.etree import ElementTree as ET
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
z = zipfile.ZipFile(sys.argv[1])
shared = [''.join(t.text or '' for t in si.iter('{%s}t' % NS['m'])) for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS)]
def table(name):
    rows = []
    for row in ET.fromstring(z.read(name)).iter('{%s}row' % NS['m']):
        cells = {}
        for c in row.findall('m:c', NS):
            col = 0
            for ch in re.match('[A-Z]+', c.get('r')).group(0): col = col * 26 + ord(ch) - 64
            v = c.find('m:v', NS)
            cells[col - 1] = (shared[int(v.text)] if c.get('t') == 's' else v.text) if v is not None else ''
        rows.append([cells.get(i, '') for i in range(max(cells) + 1)] if cells else [])
    return rows
wb = ET.fromstring(z.read('xl/workbook.xml'))
info = zipfile.ZipFile(sys.argv[1]).infolist()
print(json.dumps({
  'sheets': [s.get('name') for s in wb.iter('{%s}sheet' % NS['m'])],
  'active': wb.find('m:bookViews/m:workbookView', NS).get('activeTab'),
  'texts': table('xl/worksheets/sheet1.xml'), 'readme': table('xl/worksheets/sheet2.xml'),
  'stored': all(i.compress_type == 0 for i in info), 'dates': sorted(set(i.date_time for i in info)), 'names': [i.filename for i in info],
  'styles': z.read('xl/styles.xml').decode('utf8'), 'cols': re.search(r'<cols>.*?</cols>', z.read('xl/worksheets/sheet1.xml').decode('utf8')).group(0),
  'formulas': bool(re.search(r'<f[ >]|t="e"', z.read('xl/worksheets/sheet1.xml').decode('utf8'))), 'bad_xml': [n for n in z.namelist() if n.endswith('.xml') or n.endswith('.rels')
     if not (lambda d: (ET.fromstring(d), True)[1])(z.read(n))],
}))`;
  const xl = (code, file = path.join('review', code + '.xlsx')) => { const r = py(`import sys\nsys.argv = ["x", ${JSON.stringify(here(file))}]\n${XL}`); try { return JSON.parse(r.out); } catch (e) { return { error: r.err.slice(-300) }; } };
  for (const code of LANGS) {
    const x = xl(code), csv = exported[code];
    ok(`${code}: the .xlsx is a well-formed Excel file: every part is XML, the parts Excel needs are there`, !x.error && x.bad_xml.length === 0 && ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/sharedStrings.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml'].every((f) => (x.names || []).includes(f)), x.error);
    ok(`${code}: the first sheet is "Texts" (so a file saved again by Excel still imports), the second is "Read me first", and the file opens on the second`, !x.error && x.sheets.join('|') === 'Texts|Read me first' && x.active === '1', JSON.stringify(x.sheets));
    const unsp = (s) => s.replace(/^ (?=[=+\-@\t])/, '');
    const fromX = (x.texts || []).map((r) => HEADER.map((_, i) => String(r[i] === undefined ? '' : r[i])));
    ok(`${code}: the "Texts" sheet is the CSV table, cell by cell (${csv.length - 1} rows)`, fromX.length === csv.length && fromX.every((r, i) => r.every((c, j) => (i === 0 ? c === csv[i][j] : unsp(csv[i][j]) === c))), fromX.findIndex((r, i) => r.some((c, j) => (i === 0 ? c !== csv[i][j] : unsp(csv[i][j]) !== c))) + ' is the first row that differs');
    const body = (x.readme || []).map((r) => r[0] || '').join('\n');
    ok(`${code}: the "Read me first" sheet has the instructions in the friend's language and in English, with the counts filled in`, /Thank you for checking the/.test(body) && body.indexOf('Thank you for checking') > body.indexOf({ es: 'Gracias por revisar', hi: 'जाँचने के लिए धन्यवाद', zh: '感谢你帮忙检查', vi: 'Cảm ơn bạn đã kiểm tra' }[code]) && body.includes('150') && body.includes('450') && !/@(LANG|N\d)@/.test(body), body.slice(0, 120));
    ok(`${code}: the correction and note columns are formatted as text (Excel cannot turn 9/29 into a date) and the correction column is coloured`, !x.error && (x.cols.match(/<col [^>]*style="(\d+)"/g) || []).length === 3 && /<col min="7" max="7"[^>]*style="4"/.test(x.cols) && /<xf numFmtId="49" fontId="0" fillId="3"/.test(x.styles), x.cols);
    ok(`${code}: the .xlsx is stored, not compressed, with a fixed date: the same bytes on every computer`, !x.error && x.stored && x.dates.length === 1 && x.dates[0].join() === '1980,1,1,0,0,0');
    ok(`${code}: no cell of the .xlsx has a formula or an error (they are all text or whole numbers)`, !x.error && x.formulas === false);
    const r = run('import', code, `review/${code}.xlsx`);
    ok(`${code}: importing the .xlsx as it is: no correction, exit 0, nothing changes`, r.code === 0 && /with a correction: 0 accepted/.test(r.out) && /Nothing to change/.test(r.out) && !/NOT USED|not read/.test(r.out), r.all.slice(0, 200));
  }
  {
    // a friend types into the .xlsx: edit the file the way a program would save it (a shared string for the correction cell)
    const editXlsx = (code, edits, name, { empty = [], types = {} } = {}) => {
      const script = `import sys, json, zipfile, re
src, dst, edits, empty, types = sys.argv[1], sys.argv[2], json.loads(sys.argv[3]), json.loads(sys.argv[4]), json.loads(sys.argv[5])
zin = zipfile.ZipFile(src)
parts = {n: zin.read(n) for n in zin.namelist()}
sheet = parts['xl/worksheets/sheet1.xml'].decode('utf8')
from xml.sax.saxutils import escape
for ref, text in edits.items():
    cell = '<c r="%s" s="4" t="inlineStr"><is><t xml:space="preserve">%s</t></is></c>' % (ref, escape(text)) if types.get(ref) is None else '<c r="%s" s="4"><v>%s</v></c>' % (ref, text)
    sheet = re.sub(r'(<row r="%s"[^>]*>)(.*?)(</row>)' % ref[1:], lambda m: m.group(1) + m.group(2) + cell + m.group(3), sheet, count=1, flags=re.S)
for ref in empty:
    sheet = re.sub(r'(<row r="%s"[^>]*>)(.*?)(</row>)' % ref[1:], lambda m: m.group(1) + m.group(2) + '<c r="%s" s="4"/>' % ref + m.group(3), sheet, count=1, flags=re.S)
parts['xl/worksheets/sheet1.xml'] = sheet.encode('utf8')
z = zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED)
for n, d in parts.items(): z.writestr(n, d)
z.close()`;
      const out = path.join('review', name);
      const r = spawnSync(PY, ['-c', script, here('review', code + '.xlsx'), here(out), JSON.stringify(edits), JSON.stringify(empty), JSON.stringify(types)], { cwd: site, encoding: 'utf8' });
      if (r.status !== 0) info('xlsx edit failed: ' + r.stderr.slice(-200));
      return out;
    };
    const rows = exported.es;
    const rowNo = (pred) => rows.findIndex((r, i) => i && pred(r)) + 1;
    const skip = rowNo((r) => unspaceCell(r[COL.en]) === 'Skip to content'), show = rowNo((r) => unspaceCell(r[COL.en]) === 'Show names');
    const G = (n) => 'G' + n;
    restore(); run('export', 'all');
    const f1 = editXlsx('es', { [G(skip)]: 'Saltar al contenido, “ya”' }, 'typed.xlsx');
    const r1 = run('import', 'es', f1);
    ok('a correction typed into the .xlsx (curly quotes, a comma) is read and written', r1.code === 0 && /1 accepted/.test(r1.out) && SRC('es').ui[rows[skip - 1][COL.id]] === 'Saltar al contenido, “ya”', r1.all.slice(0, 200));
    ok('...and the report says the row, the id, before, after and what changed in words', /Row \d+ \(\S+\): ACCEPTED/.test(r1.out) && /before  : Ir al contenido/.test(r1.out) && /after   : Saltar al contenido/.test(r1.out) && /change  : /.test(r1.out));
    restore(); run('export', 'all');
    const f2 = editXlsx('es', { [G(skip)]: 'Saltar al contenido' }, 'typed.xlsx', { empty: Array.from({ length: 30 }, (_, i) => G(i + 60)) });
    const r2 = run('import', 'es', f2);
    ok('empty cells that only have a colour or a format (LibreOffice and Excel write them) are not corrections: only the typed row is read', r2.code === 0 && /1 with a correction: 1 accepted, 0 not used/.test(r2.out) && !/NOT USED/.test(r2.out), r2.all.slice(0, 260));
    restore(); run('export', 'all');
    const f3 = editXlsx('es', { [G(skip)]: '45929' }, 'typed.xlsx', { types: { [G(skip)]: 'n' } });
    const s3 = SOURCES();
    const r3 = run('import', 'es', f3);
    ok('a correction cell that is a number or a date (Excel changed it) is refused, naming the row, and nothing is written', r3.code === 1 && /Row \d+ \(\S+\): NOT USED/.test(r3.out) && /looks like Excel changed this: the cell holds a number/.test(r3.out) && changedFiles(s3, SOURCES()).length === 0, r3.all.slice(0, 200));
    restore(); run('export', 'all');
    const f4 = editXlsx('es', { [G(skip)]: 'Saltar al contenido', [G(show)]: 'Mostrar {zz} nombres' }, 'typed.xlsx');
    const r4 = run('import', 'es', f4, '--strict');
    ok('--strict on the .xlsx: one bad row (a changed {placeholder}) and nothing at all is written', r4.code === 1 && /NOTHING was written/.test(r4.out) && /Row \d+ \(\S+\): NOT USED/.test(r4.out) && changedFiles(pristineSources(), SOURCES()).length === 0, r4.out.slice(-240));
    // a file saved by LibreOffice or Excel is a zip with a mimetype first: .ods is refused in plain words
    const ods = path.join('review', 'saved.ods');
    spawnSync(PY, ['-c', 'import sys, zipfile\nz = zipfile.ZipFile(sys.argv[1], "w")\nz.writestr("mimetype", "application/vnd.oasis.opendocument.spreadsheet")\nz.writestr("content.xml", "<office:document-content/>")\nz.close()', here(ods)]);
    const r5 = run('import', 'es', ods);
    ok('a LibreOffice .ods file is refused in plain words (exit 2) with the way to save it as .xlsx; nothing is written', r5.code === 2 && /\.ods\) file/.test(r5.err) && /Save As > Excel \(\.xlsx\)/.test(r5.err) && changedFiles(pristineSources(), SOURCES()).length === 0, r5.err.slice(0, 200));
  }
  {
    // a friend who types the better text over the old one, or answers in the question column, or changes the English: listed by row, never lost silently
    restore(); run('export', 'all');
    const rows = exported.es, a = rowOf(rows, (r) => unspaceCell(r[COL.en]) === 'Skip to content'), b = rowOf(rows, (r) => unspaceCell(r[COL.en]) === 'Show names');
    const asked = rowOf(rows, (r) => r[COL.ask] !== '' && EN[r[COL.id]] !== undefined);
    const c = rowOf(rows, (r) => unspaceCell(r[COL.en]) === 'Welcome to Wise Acres!');
    const edit = (row, col, text) => (rr) => rr.map((r) => (r[COL.id] === row[COL.id] ? r.map((x, j) => (j === col ? text : x)) : r));
    let table = rows.map((r) => r.slice());
    for (const f of [edit(a, COL.cur, 'Saltar al contenido principal'), edit(b, COL.en, 'Show the names'), edit(asked, COL.ask, 'Bien así'), edit(c, COL.ask, 'no sé')]) table = f(table);
    const snapW = SOURCES();
    const rw = run('import', 'es', save('es.wrongcol.csv', table));
    ok('words typed over the current translation, over the English or in the question column (no correction on the row) are listed row by row, exit 1, nothing written', rw.code === 1 && /4 row\(s\) have other words in a column that is not read/.test(rw.out) && [a, b, asked, c].every((r) => new RegExp(`Row \\d+ \\(${r[COL.id]}\\): the "[a-zA-Z ]+" cell says: `).test(rw.out)) && /Nothing to change/.test(rw.out) && changedFiles(snapW, SOURCES()).length === 0, rw.out.slice(0, 500));
    ok('...and says what to do (type it in the correction column and import again) and that a changed site is not a mistake', /type them in the "correction" column/.test(rw.out) && /changed after this sheet was made, nothing is wrong/.test(rw.out));
    ok('...it names which cell: "current translation", "English", "question for you"', /the "current translation" cell says: Saltar al contenido principal/.test(rw.out) && /the "English" cell says: Show the names/.test(rw.out) && /the "question for you" cell says: Bien así/.test(rw.out));
    // the correction typed in the note column instead: shown as a note, not lost
    const note = rows.map((r) => (r[COL.id] === a[COL.id] ? r.map((x, j) => (j === COL.note ? 'Saltar al contenido principal' : x)) : r.slice()));
    const rn = run('import', 'es', save('es.note.csv', note));
    ok('a better text typed in the note column is shown with its row ("not applied; for you to read"), not lost', rn.code === 0 && /Notes your friend wrote \(not applied; for you to read\)/.test(rn.out) && /Saltar al contenido principal/.test(rn.out) && changedFiles(snapW, SOURCES()).length === 0, rn.out.slice(0, 300));
    // an edit in the English cell on a row that also has a correction is still refused (the English does not match the id)
    const both = rows.map((r) => (r[COL.id] === b[COL.id] ? r.map((x, j) => (j === COL.en ? 'Show the names' : j === COL.corr ? 'Mostrar los nombres' : x)) : r.slice()));
    const rb = run('import', 'es', save('es.both.csv', both));
    ok('a changed English cell on a row that has a correction: the row is refused (English does not match the id)', rb.code === 1 && /English in this row is not the English of this id/.test(rb.out) && changedFiles(snapW, SOURCES()).length === 0, rb.out.slice(0, 300));
    // a sheet made before the priority and question columns existed (six columns) still imports
    const oldSheet = rows.map((r, i) => { const d = [r[COL.id], r[COL.where], r[COL.en], r[COL.cur], i && r[COL.id] === a[COL.id] ? 'Saltar al contenido' : r[COL.corr], r[COL.note]]; return i === 0 ? ['id', 'where', 'English', 'current translation', 'correction', 'note'] : d; });
    const ro = run('import', 'es', save('es.sixcolumns.csv', oldSheet));
    ok('a sheet with the six old columns (no priority, no question) still imports, and nothing is said about a column that is not read', ro.code === 0 && /1 accepted/.test(ro.out) && !/not read/.test(ro.out) && SRC('es').ui[a[COL.id]] === 'Saltar al contenido', ro.all.slice(0, 200));
    // a third of the rows deleted and the rest sorted by the English: the id says which text a row is
    const kept = rows.slice(1).filter((r, i) => i % 3 !== 1 || r[COL.id] === a[COL.id]).sort((x, y) => x[COL.en].localeCompare(y[COL.en])).map((r) => r.map((c, j) => (r[COL.id] === a[COL.id] && j === COL.corr ? 'Saltar al inicio' : c)));
    const rs = run('import', 'es', save('es.sorted.csv', [rows[0], ...kept]));
    ok(`a sheet with a third of the rows deleted and the rest sorted by the English still imports (${kept.length} rows): the id says which text a row is`, rs.code === 0 && /1 accepted/.test(rs.out) && SRC('es').ui[a[COL.id]] === 'Saltar al inicio' && !/not read/.test(rs.out), rs.all.slice(0, 200));
  }

  /* ------------------------------------------------------------------ the instructions for the friend, the e-mail, and the data files of the sheet */
  {
    const T = JSON.parse(read('tools', 'review_instructions.json'));
    const KEYS = ['subject', 'title', 'intro', 'time_title', 'time', 'do_title', 'do', 'keep_title', 'keep', 'send_title', 'send', 'thanks', 'open_line', 'columns_title', 'columns', 'tiers'];
    const SCRIPT = { es: /[áéíóúñ¿¡]/, hi: /[ऀ-ॿ]/, zh: /[一-鿿]/, vi: /[ăâêôơưđạảãấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/ };
    for (const code of ['en', ...LANGS]) {
      const t = T[code] || {};
      ok(`instructions (${code}): every part is there: title, what it is, how long, what to do, what not to change, how to send it back, thanks, the columns, the priorities`, KEYS.every((k) => t[k] && t[k].length), KEYS.filter((k) => !(t[k] && t[k].length)).join(','));
      ok(`instructions (${code}): the same number of steps as English (${T.en.do.length} to do, ${T.en.keep.length} not to change, ${T.en.send.length} to send, ${T.en.columns.length} columns, 3 priorities)`, t.do.length === T.en.do.length && t.keep.length === T.en.keep.length && t.send.length === T.en.send.length && t.columns.length === T.en.columns.length && t.tiers.length === 3);
      ok(`instructions (${code}): the columns are named as in the sheet, in the same order`, t.columns.map((c) => c[0]).join('|') === HEADER.join('|') && t.columns.every((c) => c[1].length > 3), t.columns.map((c) => c[0]).join('|'));
      const all = JSON.stringify(t);
      ok(`instructions (${code}): it says what not to change: {n}, {time}, <a1>, <strong>, names, numbers, prices, e-mail addresses are kept as they are`, /\{n\}/.test(t.keep.join(' ')) && /\{time\}/.test(t.keep.join(' ')) && /<a1>/.test(t.keep.join(' ')) && /<strong>/.test(t.keep.join(' ')) && /Wise Acres/.test(t.keep.join(' ')) && /Wise Pie/.test(t.keep.join(' ')));
      ok(`instructions (${code}): it names the two sheets, the time, and where to type (correction, note, question for you)`, /Texts/.test(t.do.join(' ')) && /Read me first/.test(t.open_line) && /Texts/.test(t.open_line) && /@N1@/.test(t.time) && /20/.test(t.time) && /correction/.test(t.do.join(' ')) && /note/.test(t.do.join(' ')) && /question for you/.test(t.do.join(' ')));
      ok(`instructions (${code}): it says how to send it back (save, keep .xlsx, Google Sheets: download .xlsx, attachment)`, /xlsx/.test(t.send.join(' ')) && /Google/.test(t.send.join(' ')));
      ok(`instructions (${code}): only the placeholders the tool fills in (@LANG@, @N1@, @N2@, @N3@), no emoji, no tab, no double space`, (all.match(/@[A-Z0-9]+@/g) || []).every((x) => ['@LANG@', '@N1@', '@N2@', '@N3@'].includes(x)) && !/\p{Extended_Pictographic}|\t|\\t|  /u.test(all.replace(/\\"/g, '')));
      if (code !== 'en') ok(`instructions (${code}): written in the friend's own script, not English words with a few names`, SCRIPT[code].test(t.intro) && SCRIPT[code].test(t.time) && SCRIPT[code].test(t.do[1]) && SCRIPT[code].test(t.thanks) && SCRIPT[code].test(t.subject), t.intro.slice(0, 40));
    }
    // the e-mail text
    for (const code of LANGS) {
      const m = read('review', code + '-message.txt');
      const own = T[code];
      ok(`${code}: the e-mail text has a Subject line in the friend's language and in English, the message in both, and the real counts`, /^Subject: /.test(m) && m.split('\n')[0].includes(own.subject) && m.split('\n')[0].includes('  /  Could you check the') && m.includes(own.intro) && m.includes(T.en.intro.replace(/@LANG@/g, { es: 'Spanish', hi: 'Hindi', zh: 'Chinese', vi: 'Vietnamese' }[code])) && m.indexOf(own.intro) < m.indexOf('Wise Acres is a small family farm') && m.includes('150') && !/@[A-Z0-9]+@/.test(m), m.slice(0, 150));
      ok(`${code}: the e-mail text is short enough to paste (under 4,000 letters) and says to open "Read me first"`, m.length < 4000 && /Read me first/.test(m));
    }
    // the data file points only at texts that exist, and its questions are about lines that still say what they said
    for (const code of LANGS) {
      const ids = new Set(orders[code].map((o) => o[0]));
      const wrong = [];
      for (const e of notes.ask.filter((x) => x.lang === code)) for (const i of e.ids) if (!ids.has(i)) wrong.push(i);
      for (const e of notes.changed.filter((x) => x.lang === code)) if (!ids.has(e.id)) wrong.push(e.id);
      ok(`${code}: every id in tools/review_notes.json ("ask" and "changed") is a text of the site`, wrong.length === 0, wrong.join(','));
      const live = notes.ask.filter((x) => x.lang === code).flatMap((e) => e.ids.filter((i) => { const cur = SRC(code); const v = i.startsWith('t') ? cur.ui[i] : i.startsWith('j') ? Object.entries(cur.js).find(([k]) => crypto.createHash('sha1').update(k).digest('hex').slice(0, 8) === i.slice(1))?.[1] : ''; return !e.when || (v || '').includes(e.when); }));
      ok(`${code}: the questions of tools/review_notes.json are about lines that still say it (${live.length} rows; a line that was fixed stops asking)`, live.length >= (code === 'es' ? 5 : 8), String(live.length));
    }
    ok('every id in "first" of tools/review_notes.json is a page text of the site', (notes.first || []).every((id) => EN[id] !== undefined), (notes.first || []).filter((id) => EN[id] === undefined).join(','));
    ok('the questions are written in plain English, each with its own reason (every entry has "ask", a language, ids)', notes.ask.every((e) => LANGS.includes(e.lang) && e.ids.length && e.ask.length > 40 && !/\p{Extended_Pictographic}/u.test(e.ask)) && notes.changed.every((e) => LANGS.includes(e.lang) && e.id && e.when && e.why && e.before));
  }
  {
    // a question disappears when the line it was about is fixed (the translation no longer contains the doubted words); a changed line asks nothing when it was changed again
    restore();
    const peak = 'Mejor momento para recoger';
    const j = JSON.parse(read('lang', 'src', 'es.json'));
    ok('test data: the Spanish "Peak picking" line says what the question is about', j.js['Peak picking'] === peak, j.js['Peak picking']);
    const q0 = run('export', 'es', '--force'); const row0 = sheet('es').find((r) => r[COL.en] === 'Peak picking');
    ok('a question is shown while the line says the doubted words', row0 && /best time to pick/.test(row0[COL.ask]) && /Pico de la cosecha/.test(row0[COL.ask]), row0 && row0[COL.ask]);
    const txt = read('lang', 'src', 'es.json').replace(`"${peak}"`, '"Pico de la cosecha"');
    fs.writeFileSync(here('lang', 'src', 'es.json'), txt);
    run('export', 'es', '--force'); const row1 = sheet('es').find((r) => r[COL.en] === 'Peak picking');
    ok('...and is gone when the line was fixed', row1 && row1[COL.ask] === '' && row1[COL.cur] === 'Pico de la cosecha', row1 && row1[COL.ask]);
    // the tool without its data files: still a sheet, no questions, no crash
    restore();
    fs.rmSync(here('tools', 'review_notes.json')); fs.rmSync(here('tools', 'review_instructions.json')); fs.rmSync(here('tools', 'i18n_facts_allow.json'), { force: true });
    const nofiles = run('export', 'es', '--force');
    const rr = sheet('es');
    ok('without tools/review_notes.json, review_instructions.json and the allow list the export still works (no questions; priority 1 is the QR lines, the prices and the top of the home page)', nofiles.code === 0 && rr.length > 1300 && rr.slice(1).every((r) => r[COL.ask] === '') && rr.slice(1).filter((r) => r[COL.pri] === '1').length === 150, nofiles.all.slice(0, 200));
    const okImport = run('import', 'es', 'review/es.xlsx');
    ok('...and that .xlsx imports (the file does not depend on the data files)', okImport.code === 0 && /with a correction: 0/.test(okImport.out), okImport.all.slice(0, 160));
    restore();
  }

  /* ------------------------------------------------------------------ export does not wipe a sheet with corrections */
  {
    const rows = exported.es; const target = rowOf(rows, (r) => unspaceCell(r[COL.en]) === 'Skip to content');
    const p = save('es.csv', withCorrections(rows, { [target[COL.id]]: 'Saltar al contenido' }));
    const h = sha(here(p));
    const r1 = run('export', 'es');
    ok('export will not overwrite a sheet that already has corrections (exit 1, says why)', r1.code === 1 && /NOT made/.test(r1.out) && sha(here(p)) === h, r1.out.slice(0, 160));
    const r2 = run('export', 'es', '--force');
    ok('--force does overwrite it', r2.code === 0 && sha(here(p)) !== h && sheet('es').every((r, i) => i === 0 || r[COL.corr] === ''));
  }
  function unspaceCell(s) { return s.replace(/^ (?=[=+\-@\t])/, ''); }
  run('export', 'all', '--force');

  /* ------------------------------------------------------------------ a sheet with no corrections changes nothing */
  const snap = SOURCES();
  for (const code of LANGS) {
    const r = run('import', code, `review/${code}.csv`);
    ok(`${code}: import of a sheet with no correction: nothing to change, exit 0, every file byte for byte the same`, r.code === 0 && /with a correction: 0 accepted, 0 not used, 0 the same as now/.test(r.out) && /Nothing to change/.test(r.out) && changedFiles(snap, SOURCES()).length === 0, r.all.slice(0, 200) + changedFiles(snap, SOURCES()).join(','));
  }
  {
    const rows = exported.hi;
    const variants = [['semicolons, LF, no BOM', { delim: ';', nl: '\n', bom: false }], ['tabs, CRLF, BOM, everything quoted', { delim: '\t', all: true }]];
    for (const [name, opts] of variants) {
      const p = save('hi.variant.csv', rows, opts);
      const r = run('import', 'hi', p);
      ok(`a sheet saved by another program (${name}) with no corrections changes nothing`, r.code === 0 && /0 with a correction/.test(r.out) && changedFiles(snap, SOURCES()).length === 0, r.all.slice(0, 160));
    }
  }
  // every row repeats the text on the site: the rules accept every text of the site, and the English of every row matches its id
  for (const code of LANGS) {
    const rows = exported[code];
    const p = save(`${code}.same.csv`, rows.map((r, i) => { if (i === 0) return r.slice(); const c = r.slice(); c[COL.corr] = r[COL.cur]; return c; }));
    const r = run('import', code, p, '--dry-run');
    const n = rows.length - 1;
    ok(`${code}: all ${n} rows repeating today's text are accepted as "the same as now" (the rules accept every text of the site)`, r.code === 0 && new RegExp(`${n} rows read, ${n} with a correction: 0 accepted, 0 not used, ${n} the same as now`).test(r.out), r.out.split('\n').filter((l) => /NOT USED|^    /.test(l)).slice(0, 4).join(' | ') || r.all.slice(0, 200));
  }

  /* ------------------------------------------------------------------ a good correction */
  const lineDiff = (a, b) => { const x = a.split('\n'), y = b.split('\n'); return x.length === y.length ? x.map((l, i) => (l === y[i] ? null : i)).filter((i) => i !== null) : null; };
  const target = (code, pred) => rowOf(exported[code], pred);
  {
    restore(); run('export', 'all');
    const es = exported.es;
    const uiRow = target('es', (r) => unspaceCell(r[COL.en]) === 'Skip to content');
    const newUi = tweak(uiRow[COL.cur]);
    const jsRow = target('es', (r) => unspaceCell(r[COL.en]) === 'Show names');
    const newJs = tweak(jsRow[COL.cur]);
    const qrRow = target('es', (r) => r[COL.id] === 'qr-review-title');
    const newQr = '¿Te gustó tu visita?';
    const p = save('es.corrected.csv', withCorrections(es, { [uiRow[COL.id]]: newUi, [jsRow[COL.id]]: newJs, [qrRow[COL.id]]: newQr }));
    const srcBefore = read('lang', 'src', 'es.json'), qrBefore = read('tools', 'qr_links.json'), all0 = SOURCES();
    const mode = fs.statSync(here('lang', 'src', 'es.json')).mode;
    const r = run('import', 'es', p);
    ok('a good page-text, code-text and QR-sign correction: exit 0, each shown as ACCEPTED with before, after and what changed in words', r.code === 0 && (r.out.match(/: ACCEPTED/g) || []).length === 3 && /before  : /.test(r.out) && /after   : /.test(r.out) && /change  : (changed|added|removed)/.test(r.out), r.all.slice(0, 300));
    const srcAfter = read('lang', 'src', 'es.json'), qrAfter = read('tools', 'qr_links.json');
    const d = lineDiff(srcBefore, srcAfter), dq = lineDiff(qrBefore, qrAfter);
    ok('exactly two lines of lang/src/es.json changed (the page text and the code text), same line count, same order', d && d.length === 2, d ? d.join(',') : 'line count changed');
    const a = JSON.parse(srcBefore), b = JSON.parse(srcAfter);
    ok('...to the new words, and nothing else in the file differs (keys, order, the other texts)', b.ui[uiRow[COL.id]] === newUi && b.js[unspaceCell(jsRow[COL.en])] === newJs && JSON.stringify(Object.keys(a.ui)) === JSON.stringify(Object.keys(b.ui)) && JSON.stringify(Object.keys(a.js)) === JSON.stringify(Object.keys(b.js)) && Object.keys(a.ui).filter((k) => a.ui[k] !== b.ui[k]).length === 1 && Object.keys(a.js).filter((k) => a.js[k] !== b.js[k]).length === 1);
    ok('...the file ends the way it did and keeps its permissions', srcAfter.endsWith('\n') === srcBefore.endsWith('\n') && fs.statSync(here('lang', 'src', 'es.json')).mode === mode);
    const q1 = JSON.parse(qrBefore), q2 = JSON.parse(qrAfter);
    ok('exactly one line of tools/qr_links.json changed: the Spanish title of the review sign', dq && dq.length === 1 && q2.signs[0].title_es === newQr && JSON.stringify({ ...q2, signs: q2.signs.map((s, i) => (i ? s : { ...s, title_es: q1.signs[0].title_es })) }) === JSON.stringify(q1), dq ? dq.join(',') : 'line count changed');
    const after = SOURCES();
    const touched = changedFiles(all0, after);
    ok('English is never touched: the only files that changed are lang/src/es.json and tools/qr_links.json', touched.sort().join(',') === ['lang/src/es.json', 'tools/qr_links.json'].sort().join(','), touched.join(','));
    ok('no temporary file is left behind and nothing was rebuilt (no lang/es.js made)', fs.readdirSync(here('lang', 'src')).every((f) => /\.json$/.test(f)) && fs.readdirSync(here('tools')).every((f) => !/\.tmp$/.test(f)) && !fs.existsSync(here('lang', 'es.js')));
    ok('it prints the commands to run next and runs none of them (build, the QR page, missing, the test)', /python3 tools\/i18n\.py build/.test(r.out) && /python3 tools\/make_qr\.py/.test(r.out) && /i18n\.py missing es/.test(r.out) && /run-all\.mjs consistency/.test(r.out) && /does not run|this tool does not run them/.test(r.out));
    const again2 = run('import', 'es', p);
    ok('importing the same file again changes nothing ("the same as now")', again2.code === 0 && /3 the same as now/.test(again2.out) && changedFiles(after, SOURCES()).length === 0, again2.out.slice(0, 160));
  }
  {
    restore(); run('export', 'all');
    const hiQr = target('hi', (r) => r[COL.id] === 'qr-facebook-title'), hiHow = target('hi', (r) => r[COL.id] === 'qr-how'), hiUi = target('hi', (r) => unspaceCell(r[COL.en]).startsWith('Home School Day'));
    const p = save('hi.corrected.csv', withCorrections(exported.hi, { [hiQr[COL.id]]: 'Facebook पर हमें खोजें', [hiHow[COL.id]]: 'अपने फ़ोन का कैमरा इस वर्ग की ओर करें।' }));
    const qrBefore = read('tools', 'qr_links.json');
    const r = run('import', 'hi', p);
    const q2 = JSON.parse(read('tools', 'qr_links.json')), q1 = JSON.parse(qrBefore);
    const dq = lineDiff(qrBefore, read('tools', 'qr_links.json'));
    ok('Hindi QR sign words go into the "languages" part of tools/qr_links.json (the sign title and the line above the square)', r.code === 0 && q2.languages.hi.signs.facebook.title === 'Facebook पर हमें खोजें' && q2.languages.hi.how.includes('वर्ग') && q2.languages.zh.signs.facebook.title === q1.languages.zh.signs.facebook.title && q2.languages.vi.how === q1.languages.vi.how && dq && dq.length === 2, r.all.slice(0, 200));
    ok('...and lang/src/hi.json is untouched (no page text was corrected)', read('lang', 'src', 'hi.json') === fs.readFileSync(path.join(pristine, 'lang', 'src', 'hi.json'), 'utf8'));
  }

  {
    // a text with & : the sheet shows an ordinary "&" and a correction with "&" is written the way the page text writes it (&amp;)
    restore(); run('export', 'all');
    const amp = rowOf(exported.es, (r) => /&/.test(r[COL.en]) && EN[r[COL.id]] !== undefined && /&amp;/.test(EN[r[COL.id]]) && !/</.test(EN[r[COL.id]]) && EN[r[COL.id]].length < 60);
    const p = save('es.amp.csv', withCorrections(exported.es, { [amp[COL.id]]: 'Flores & amapolas' }));
    const r = run('import', 'es', p);
    ok('a correction with & is accepted and written as &amp; (the sheet showed an ordinary &)', !!amp && !/&amp;/.test(amp[COL.en]) && r.code === 0 && SRC('es').ui[amp[COL.id]] === 'Flores &amp; amapolas' && /after   : Flores & amapolas/.test(r.out), r.out.slice(0, 240));
  }

  /* ------------------------------------------------------------------ bad corrections, each refused with a plain reason */
  {
    restore(); run('export', 'all');
    const rowsOf = (code) => exported[code];
    const cases = [];   // [language, finder, new text, expected reason, name]
    const add = (code, find, make, rx, name) => { const row = rowOf(rowsOf(code), find); if (!row) { ok('test data: ' + name, false, 'no row found'); return; } cases.push({ code, row, text: make(row), rx, name }); };
    const ui = (pred) => (r) => EN[r[COL.id]] !== undefined && pred(unspaceCell(r[COL.en]), r);
    const jsr = (en) => (r) => unspaceCell(r[COL.en]) === en;
    add('hi', jsr('Added {flower}. {n} of {total} flowers in your cup.'), () => 'एक फूल जोड़ा।', /missing \{flower\}, \{n\}, \{total\}/, 'a lost {placeholder}');
    add('es', jsr('Show names'), (r) => r[COL.cur] + ' {x}', /has \{x\}, which is not in the English/, 'an added {placeholder}');
    add('es', ui((e) => /\$11 per student/.test(e) && !/<a/.test(e)), (r) => r[COL.cur].replace(/\$11/g, '$12'), /The prices are different: the English has \$11( \(2 times\))?, the correction has \$12/, 'a changed price');
    add('es', ui((e) => /Ages 3 and up/.test(e) && /\$/.test(e) === false), (r) => r[COL.cur].replace(/\b3\b/, '4'), /number 3 of the English is missing/, 'a changed age');
    add('es', ui((e, r) => /Thursday through Sunday/.test(e) && /jueves/.test(r[COL.cur])), (r) => r[COL.cur].replace(/jueves/g, 'lunes'), /days of the week are different: the English has .*, the correction has/, 'a changed weekday');
    add('es', ui((e, r) => /Wise Pie/.test(e) && r[COL.cur].includes('Wise Pie') && !/<a/.test(e) && e.length < 80), (r) => r[COL.cur].replace(/Wise Pie/g, 'Pastel Sabio'), /name "Wise Pie" must stay/, 'a changed name');
    add('es', ui((e, r) => /vanessa@wiseacresorganic\.com/.test(e) && !/<a/.test(e) && e.length > 40), (r) => r[COL.cur].replace('vanessa@', 'vanesa@'), /e-mail address vanessa@wiseacresorganic\.com must stay/, 'a changed e-mail address');
    add('es', ui((e) => /<a1>/.test(e) && /<\/a>/.test(e) && e.length < 160), (r) => r[COL.cur].replace('</a>', ''), /missing <\/a>/, 'a link mark lost');
    add('es', ui((e) => /<strong>No dogs/.test(e)), (r) => r[COL.cur] + ' <b>x</b>', /has <\/b>, <b> which the English does not have/, 'an extra mark');
    add('es', ui((e) => /<strong>Let them warm/.test(e)), (r) => r[COL.cur].replace('<strong>', '\u0001').replace('</strong>', '<strong>').replace('\u0001', '</strong>'), /marks in < > are in the wrong order/, 'marks in the wrong order');
    add('vi', ui((e, r) => /Wise Pie/.test(e) && /<strong>|<a1>|<svg\/>/.test(e) === false && r[COL.cur].includes('Wise Pie') && e.length < 80), (r) => r[COL.cur].replace('Wise Pie', '<wa-en>Wise Pie</wa-en>'), /it has <\/wa-en>, <wa-en> which the English does not have.*Do not add <wa-en> or <wa-run>/, 'a <wa-en> mark added');
    add('zh', ui((e) => /\$/.test(e) === false && /Skip to content/.test(e)), () => '   ', /only spaces or an empty line/, 'a line with only spaces');
    add('hi', jsr('Company:'), () => 'कंपनी', /label: the page shows it with a colon/, 'a label without its colon');
    add('es', jsr('Company:'), () => 'Empresa (nombre):', /Do not use brackets inside it/, 'a label with brackets');
    add('vi', jsr('Show names'), () => 'Hiện "tên"', /cannot contain < > or a straight double quote/, 'a straight double quote in a code text');
    add('zh', (r) => r[COL.id] === 'qr-instagram-text', () => '关注我们的 Instagram', /handle or web address @wiseacresorganic must stay/, 'a lost @handle');
    add('es', ui((e) => /^Aug$/.test(e)), () => '29-Sep', /looks like Excel changed this: "29-Sep" is how Excel writes a date/, 'Excel turned a date around');
    add('hi', ui((e) => /^Jan$/.test(e)), () => '5:00:00 PM', /looks like Excel changed this: "5:00:00 PM"/, 'Excel added seconds to a time');
    add('vi', ui((e) => /^Feb$/.test(e)), () => '1.00E+05', /looks like Excel changed this: "1\.00E\+05" is how Excel writes a very large or very small number/, 'Excel wrote a number as 1.00E+05');
    add('zh', ui((e) => /^Mar$/.test(e)), () => '#NAME?', /looks like Excel changed this: it shows an error code/, 'Excel showed #NAME?');
    add('es', ui((e) => /^Apr$/.test(e)), () => '2026-04-01', /looks like Excel changed this/, 'Excel wrote a date as 2026-04-01');
    add('hi', ui((e) => /^May$/.test(e)), () => '??? ???', /letters look lost/, 'letters lost as ????');
    add('hi', ui((e) => /^Jun$/.test(e)), () => 'à¤…à¤ªà¤¨à¥‡', /letters look scrambled/, 'letters scrambled (wrong character set)');
    add('es', ui((e) => e === 'Welcome to Wise Acres!'), () => 'OK', /looks like a remark/, 'a remark instead of a translation');
    // wrong ids
    const rows = rowsOf('es').slice(1);
    const a = rows.find((r) => unspaceCell(r[COL.en]) === 'Skip to content'), bRow = rows.find((r) => /^Reserve/.test(unspaceCell(r[COL.en])) && EN[r[COL.id]] !== undefined);
    const edits = {};
    // build one sheet for Spanish with every Spanish case, then Hindi, Chinese and Vietnamese ones
    const bySheet = {};
    for (const c of cases) (bySheet[c.code] = bySheet[c.code] || []).push(c);
    for (const code of Object.keys(bySheet)) {
      restore(); run('export', 'all');
      const snap2 = SOURCES();
      let table = withCorrections(exported[code], Object.fromEntries(bySheet[code].map((c) => [c.row[COL.id], c.text])));
      let extra = '';
      if (code === 'es') {
        const ghost = ['tdeadbeef', '1', 'x', 'x', 'x', '', 'una corrección', ''];   // an id that is not on the site
        const swapped = exported.es.find((r) => r[COL.id] === bRow[COL.id]).slice(); swapped[COL.id] = a[COL.id]; swapped[COL.corr] = 'Otra cosa';   // an id edited to another row's id, the English left as it was
        const dupA = exported.es.find((r) => r[COL.id] === a[COL.id]).slice(); dupA[COL.corr] = 'Saltar al inicio';
        const dupB = dupA.slice(); dupB[COL.corr] = 'Ir al principio';
        table = table.concat([ghost, swapped, dupA, dupB]);
        extra = 'es';
      }
      const p = save(`${code}.bad.csv`, table);
      const rr = run('import', code, p);
      const blocks = rr.out.split(/\n(?=Row \d+ \()/);
      const blockOf = (id) => blocks.find((b) => b.startsWith('Row ') && b.includes('(' + id + ')'));
      for (const c of bySheet[code]) {
        const b = blockOf(c.row[COL.id]);
        ok(`${code}: refused with the right plain reason: ${c.name}`, !!b && /NOT USED/.test(b) && c.rx.test(b.replace(/\s+/g, ' ')), b ? b.split('\n').slice(0, 4).join(' / ') : 'no block for ' + c.row[COL.id] + ' in: ' + rr.out.slice(0, 200));
      }
      if (extra) {
        const g = blockOf('tdeadbeef');
        ok('es: an id that is not on the site is refused, says the id column must stay as exported', g && /NOT USED/.test(g) && /is not a text of this site/.test(g) && /id column must stay/.test(g), g);
        const sw = rr.out.split(/\n(?=Row \d+ \()/).filter((x) => x.includes('(' + a[COL.id] + ')'));
        ok('es: an id edited to another row\'s id (the English left as it was) is refused: the English does not match the id', sw.some((x) => /English in this row is not the English of this id/.test(x)), sw.join(' | ').slice(0, 200));
        ok('es: the same id corrected twice with different words: the first is used, the second refused with its row', sw.some((x) => /ACCEPTED/.test(x)) && sw.some((x) => /already corrected on row \d+ with different words/.test(x)), sw.map((x) => x.split('\n')[0]).join(' | '));
      }
      ok(`${code}: every refused block names a row number and the id, and the exit code is 1`, rr.code === 1 && blocks.filter((b) => /NOT USED/.test(b)).every((b) => /^Row \d+ \(\S+\): NOT USED\n    \S/.test(b)), String(rr.code));
      const touched = changedFiles(snap2, SOURCES());
      if (code === 'es') ok('es: the one good correction in the same sheet was still written (and only it)', touched.join(',') === 'lang/src/es.json' && /Saltar al inicio/.test(read('lang', 'src', 'es.json')) === true && lineDiff(fs.readFileSync(path.join(pristine, 'lang', 'src', 'es.json'), 'utf8'), read('lang', 'src', 'es.json')).length === 1, touched.join(','));
      else ok(`${code}: nothing was written (every row was refused)`, touched.length === 0, touched.join(','));
    }
    // --strict and --dry-run on a sheet with one good and one bad row
    restore(); run('export', 'all');
    const good = rowOf(exported.es, (r) => unspaceCell(r[COL.en]) === 'Skip to content'), bad = rowOf(exported.es, (r) => unspaceCell(r[COL.en]) === 'Show names');
    const p = save('es.mixed.csv', withCorrections(exported.es, { [good[COL.id]]: tweak(good[COL.cur]), [bad[COL.id]]: 'Mostrar {zz} nombres' }));
    const s0 = SOURCES();
    const dry = run('import', 'es', p, '--dry-run');
    ok('--dry-run: says what would change and what is refused, writes nothing', dry.code === 1 && /Dry run: 1 correction\(s\) would be written/.test(dry.out) && /NOT USED/.test(dry.out) && changedFiles(s0, SOURCES()).length === 0, dry.out.slice(-200));
    const strict = run('import', 'es', p, '--strict');
    ok('--strict: one refused row means nothing is written at all, exit code 1, and it says so', strict.code === 1 && /NOTHING was written/.test(strict.out) && changedFiles(s0, SOURCES()).length === 0, strict.out.slice(-200));
    const loose = run('import', 'es', p);
    ok('without --strict the good row is written and the refused one is listed (exit code 1)', loose.code === 1 && /Written: 1 correction/.test(loose.out) && changedFiles(s0, SOURCES()).join(',') === 'lang/src/es.json', loose.out.slice(-200));
  }

  /* ------------------------------------------------------------------ the ways a spreadsheet program saves the file */
  {
    const code = 'es';
    const row = (rows) => rowOf(rows, (r) => unspaceCell(r[COL.en]) === 'Skip to content');
    const fresh = () => { restore(); run('export', 'all'); };
    fresh();
    const base = exported.es, tr = row(base), want = 'Saltar al contenido, "ya"';
    const check = (name, r) => {
      const now = SRC(code).ui[tr[COL.id]];
      ok(`a sheet saved as ${name}: the correction is read and written`, r.code === 0 && now === want && /1 accepted/.test(r.out), `${r.code} ${now} ${r.all.slice(0, 160)}`);
    };
    const edits = { [tr[COL.id]]: want };
    const variants = [
      ['comma, CRLF, BOM (Excel, "CSV UTF-8")', (rows) => save('v.csv', rows)],
      ['comma, LF, no BOM (Google Sheets)', (rows) => save('v.csv', rows, { nl: '\n', bom: false })],
      ['semicolon, CRLF, BOM (Excel in many countries)', (rows) => save('v.csv', rows, { delim: ';' })],
      ['semicolon, LF, no BOM', (rows) => save('v.csv', rows, { delim: ';', nl: '\n', bom: false })],
      ['tab and UTF-16 (Excel "Unicode Text")', (rows) => save('v.txt', rows, { delim: '\t', bytes: (t) => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(t, 'utf16le')]) })],
      ['every cell in quotes', (rows) => save('v.csv', rows, { all: true })],
      ['a byte order mark that a program turned into three letters (ï»¿)', (rows) => save('v.csv', rows, { bom: false, bytes: (t2) => Buffer.from('ï»¿' + t2, 'utf8') })],
      ['columns in another order, an extra column, header names in capitals', (rows) => save('v.csv', rows.map((r, i) => { const [id, , wh, en, cur, ask, co, no] = r; return i === 0 ? ['NOTE', 'Id', 'CORRECTION', 'extra', 'English', 'Current translation', 'Question for you'] : [no, id, co, 'zzz', en, cur, ask]; }))],
    ];
    for (const [name, make] of variants) {
      fresh();
      const p = make(withCorrections(base, edits));
      check(name, run('import', code, p));
    }
    // a correction with a comma, quotes and a line break inside one cell
    fresh();
    const withBreak = 'Saltar\nal contenido';
    const r1 = run('import', code, save('v.csv', withCorrections(base, { [tr[COL.id]]: withBreak })));
    ok('a correction with a line break inside the cell: written with the break turned into a space', r1.code === 0 && SRC(code).ui[tr[COL.id]] === 'Saltar al contenido', r1.out.slice(0, 160));
    // semicolon file where the cells also hold commas: still the right cells
    fresh();
    const r2 = run('import', code, save('v.csv', withCorrections(base, edits), { delim: ';' }));
    ok('a semicolon file with commas and quotes inside a cell reads the cell whole', r2.code === 0 && SRC(code).ui[tr[COL.id]] === want);
    // an .xlsx file (Excel's own format), made here with the standard library
    const xlsx = (rows, numberCell) => {
      const script = `import sys, json, zipfile, xml.sax.saxutils as x
rows, num = json.loads(sys.stdin.read())
strings = []
def si(s):
    if s not in strings: strings.append(s)
    return strings.index(s)
def colname(i): return chr(65 + i)
sheet = []
for r, row in enumerate(rows, start=1):
    cells = []
    for c, v in enumerate(row):
        if num and r == num[0] and c == num[1]:
            cells.append('<c r="%s%d" t="n"><v>%s</v></c>' % (colname(c), r, num[2]))
        elif v != '':
            cells.append('<c r="%s%d" t="s"><v>%d</v></c>' % (colname(c), r, si(v)))
    sheet.append('<row r="%d">%s</row>' % (r, ''.join(cells)))
z = zipfile.ZipFile(sys.argv[1], 'w', zipfile.ZIP_DEFLATED)
z.writestr('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>')
z.writestr('xl/worksheets/sheet1.xml', '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>%s</sheetData></worksheet>' % ''.join(sheet))
z.writestr('xl/sharedStrings.xml', '<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">%s</sst>' % ''.join('<si><t xml:space="preserve">%s</t></si>' % x.escape(s) for s in strings))
z.close()`;
      const p = here('review', 'v.xlsx');
      const r = spawnSync(PY, ['-c', script, p], { input: JSON.stringify([rows, numberCell || null]), encoding: 'utf8' });
      return { path: path.join('review', 'v.xlsx'), ok: r.status === 0, err: r.stderr };
    };
    fresh();
    const x1 = xlsx(withCorrections(base, edits));
    const r3 = x1.ok ? run('import', code, x1.path) : { code: -1, out: '', all: x1.err };
    ok('a plain .xlsx file (not saved as CSV) is read too', r3.code === 0 && SRC(code).ui[tr[COL.id]] === want, r3.all.slice(0, 200));
    fresh();
    const idx = base.findIndex((r) => r[COL.id] === tr[COL.id]) + 1;
    const x2 = xlsx(base, [idx, COL.corr, '45929']);
    const r4 = x2.ok ? run('import', code, x2.path) : { code: -1, out: '', all: x2.err };
    ok('an .xlsx cell that Excel turned into a number or a date is refused: looks like Excel changed this', r4.code === 1 && /looks like Excel changed this: the cell holds a number or a date/.test(r4.out) && changedFiles(pristineSources(), SOURCES()).length === 0, r4.all.slice(0, 200));
  }
  function pristineSources() { const out = {}; (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else out[path.relative(pristine, p)] = sha(p); } })(pristine); delete out['tools/review_sheet.py']; return out; }

  /* ------------------------------------------------------------------ files that cannot be used, refused in plain words with nothing written */
  {
    restore(); run('export', 'all');
    const base = pristineSources();
    const refuse = (name, r, rx) => ok(`${name}: refused in plain words (exit 2), nothing changed`, r.code === 2 && rx.test(r.err) && changedFiles(base, SOURCES()).length === 0, `${r.code} ${r.err.slice(0, 200)}`);
    refuse('the sheet of another language (a Hindi sheet imported as Spanish)', run('import', 'es', path.join('review', 'hi.csv')), /does not belong to the Spanish file/);
    // a Hindi file saved in the old Windows format (letters lost): the bytes are not UTF-8
    fs.writeFileSync(here('review', 'old.csv'), Buffer.concat([Buffer.from('id,where,English,current translation,correction,note\r\n'), Buffer.from([0x74, 0x31, 0x2c, 0x78, 0x2c, 0x79, 0x2c, 0x7a, 0x2c, 0xe9, 0x2c, 0x0d, 0x0a])]));
    refuse('a file not saved as UTF-8 (Hindi)', run('import', 'hi', path.join('review', 'old.csv')), /not saved as UTF-8/);
    fs.writeFileSync(here('review', 'nohead.csv'), 'a,b,c\r\n1,2,3\r\n');
    refuse('a file with no id and correction header', run('import', 'es', path.join('review', 'nohead.csv')), /no header row with the columns "id" and "correction"/);
    fs.writeFileSync(here('review', 'empty.csv'), '');
    refuse('an empty file', run('import', 'es', path.join('review', 'empty.csv')), /file is empty/);
    refuse('a file that is not there', run('import', 'es', path.join('review', 'nothing.csv')), /Cannot read/);
    refuse('a language that does not exist', run('import', 'fr', path.join('review', 'es.csv')), /There is no language 'fr'/);
    fs.writeFileSync(here('review', 'old.xls'), Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(40)]));
    refuse('an old Excel .xls file', run('import', 'es', path.join('review', 'old.xls')), /old Excel \(\.xls\) file/);
    // Spanish in the old Windows format: accents are still right, so it is accepted with a note
    const row = rowOf(exported.es, (r) => unspaceCell(r[COL.en]) === 'Skip to content');
    const text = writeCsv([exported.es[0], row.map((c, i) => (i === COL.corr ? 'Saltar al contenido, ¡ya! señor' : c))]);   // a small sheet: every letter of it is in the old Windows character set
    fs.writeFileSync(here('review', 'cp.csv'), Buffer.from(text, 'latin1'));
    const r = run('import', 'es', path.join('review', 'cp.csv'));
    ok('a Spanish file in the old Windows format (cp1252) is read right, with a note to save as UTF-8 next time', r.code === 0 && /not saved as UTF-8/.test(r.out) && SRC('es').ui[row[COL.id]] === 'Saltar al contenido, ¡ya! señor', r.all.slice(0, 200));
    // the site's translations changed after the sheet was made: a few rows differ from the sheet (a note on those rows), many (refused)
    restore(); run('export', 'all');
    const one = rowOf(exported.es, (r) => unspaceCell(r[COL.en]) === 'Skip to content');
    const stale = exported.es.map((r, i) => { const c = r.slice(); if (i && r[COL.id] === one[COL.id]) { c[COL.cur] = 'Texto viejo'; c[COL.corr] = tweak(one[COL.cur]); } return c; });
    const r5 = run('import', 'es', save('stale.csv', stale));
    ok('a row whose "current translation" is not what the site says now is still applied, with a plain note that the site text changed', r5.code === 0 && /not what the sheet showed/.test(r5.out) && /1 accepted/.test(r5.out), r5.out.slice(0, 260));
    const old = exported.es.map((r, i) => { const c = r.slice(); if (i && i % 4 !== 0) c[COL.cur] = 'Texto viejo ' + i; return c; });
    const r6 = run('import', 'es', save('old.sheet.csv', old));
    ok('a sheet made before most translations changed is refused: make a new one', r6.code === 2 && /Make a fresh sheet with `export es`/.test(r6.err), r6.err.slice(0, 160));
  }

  /* ------------------------------------------------------------------ drift: the facts check against differences() in tests/consistency.test.mjs */
  {
    const src = fs.readFileSync(path.join(ROOT, 'tests', 'consistency.test.mjs'), 'utf8');
    const line = (name) => { const m = src.match(new RegExp('^const ' + name + ' = .*$', 'm')); return m ? m[0] : null; };
    const a = src.indexOf('const MONTH_EN ='), b = src.indexOf('// the checks above must be able to see a wrong fact');
    const parts = ['NAMED', 'decode', 'DAYS', 'plain'].map(line);
    if (a < 0 || b < 0 || parts.some((x) => !x)) ok('drift: tests/consistency.test.mjs still has the shape this test reads (differences() and the lines it needs)', false, 'update the extraction in tests/review-sheet.test.mjs');
    else {
      const lib = vm.runInNewContext(parts.join('\n') + '\n' + src.slice(a, b) + '\n;({ differences, NAMES })', {});
      const en = EN, pairs = [];
      for (const lang of LANGS) {
        const d = SRC(lang), real = [];
        for (const [id, trn] of Object.entries(d.ui)) if (en[id] !== undefined) real.push([en[id], trn, lang]);
        for (const [k, trn] of Object.entries(d.js)) real.push([k, trn, lang]);
        pairs.push(...real);
        for (let i = 0; i < real.length; i++) pairs.push([real[i][0], real[(i * 7 + 3) % real.length][1], lang]);   // the English with the translation of another text
        for (let i = 0; i < real.length; i++) { const t = real[i][1]; pairs.push([real[i][0], t.replace(/\d/, (c) => String((+c + 1) % 10)), lang]); pairs.push([real[i][0], t + ' 99 $5 3%', lang]); }
      }
      for (const x of [['$3 per person, ages 3 and up', '$4 por persona, a partir de los 3 años', 'es'], ['Thursday–Sunday', 'Thứ Sáu–Chủ Nhật', 'vi'], ['Oct 6', '7 de oct', 'es'], ['Tuesday, Oct 6', '10 月 6 日周二', 'zh'], ['Fri–Sun, 10 am–8 pm', 'शुक्र–रवि, सुबह 10 बजे–रात 8 बजे', 'hi'], ['Infants 2 and under are free', '३ साल और उससे छोटे शिशुओं के लिए मुफ़्त', 'hi'], ['Email vanessa@wiseacresorganic.com', 'Escribe a vanesa@wiseacresorganic.com', 'es'], ['Call 704-628-6232', 'Llama al 704-628-6233', 'es'], ['Open every Tuesday at 5:00 PM', 'Abre los martes a las 17:00', 'es']]) pairs.push(x);
      const expected = pairs.map((p) => lib.differences(...p));
      const r = py('import sys, json\nsys.path.insert(0, "tools")\nimport review_sheet as r\npairs = json.load(sys.stdin)\nprint(json.dumps([r.differences(*p) for p in pairs]))', JSON.stringify(pairs));
      let got = null; try { got = JSON.parse(r.out); } catch (e) { /* reported below */ }
      const bad = got ? pairs.map((p, i) => (JSON.stringify(got[i]) === JSON.stringify(expected[i]) ? -1 : i)).filter((i) => i >= 0) : [-2];
      const withDiff = expected.filter((x) => x.length).length;
      ok(`drift: the tool's facts check agrees with differences() in tests/consistency.test.mjs on ${pairs.length} pairs (${withDiff} with a difference to find)`, !!got && bad.length === 0 && withDiff > 2000, got ? bad.slice(0, 2).map((i) => JSON.stringify(pairs[i]).slice(0, 160) + ' js ' + JSON.stringify(expected[i]) + ' py ' + JSON.stringify(got[i])).join(' || ') : r.err.slice(0, 300));
      const names = py('import sys, json\nsys.path.insert(0, "tools")\nimport review_sheet as r\nprint(json.dumps(r.NAMES))');
      ok('drift: the names that stay in English (NAMES) are the same list in the tool and in the test', JSON.stringify(JSON.parse(names.out || '[]')) === JSON.stringify(lib.NAMES), names.err.slice(0, 120));
    }
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
info('a run takes two to three minutes: every check starts the tool again on a temporary copy of the site');
await finish();
