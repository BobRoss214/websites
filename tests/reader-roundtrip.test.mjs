// order: 66
// browser: no
// quick: no
// covers: tools/review_sheet.py, tools/review_notes.json, tools/review_instructions.json, docs/READER_HANDOUT.md, docs/CHECK_A_LANGUAGE.md, lang/src/*, tools/i18n.py, tools/i18n_facts.mjs
/* The way a reader's work gets into the site, from the hand-out to the rebuild (docs/READER_HANDOUT.md). Needs Python 3.8 or newer and Node, no browser, no packages
 * beyond the ones tools/i18n.py already needs. Everything happens in a temporary copy of the site; your files are not touched.
 *   - the sheets the readers get: export all, and the SHORT sheet for a reader who already did the first one (`changes`): a text that is new, one that changed
 *     (with what it said before), one that replaces an older id, one that is gone, a text that already has the reader's correction (left out), nothing to send when
 *     nothing changed, a sheet of another language refused; the short sheet has the same columns, so `import` reads it
 *   - a sample reader, in each of the four languages, sends a corrected sheet back (a plain .csv with commas, or with semicolons as Excel in many countries
 *     saves it): two good corrections, a changed price, a lost {placeholder} and a correction written on the old id of a text that has a new id. The dry run
 *     writes nothing; the real import writes exactly the two good lines of lang/src/<code>.json, nothing of English, and says what it refused and why
 *   - then the steps the hand-out gives: python3 tools/i18n.py build, i18n.py missing (0 for every language), node tools/i18n_facts.mjs (0 differences), and the
 *     built lang/<code>.js has the reader's words
 *   - "renamed" in tools/review_notes.json names only ids that changed: the new id is a text of the site, the old one is not */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, ok, info, skip, finish } from './lib.mjs';

const PY = process.env.WA_PYTHON || 'python3';
if (spawnSync(PY, ['-c', 'import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)']).status !== 0) skip(`${PY} (Python 3.8 or newer) is not available`);
if (spawnSync(PY, ['-c', 'import bs4']).status !== 0) skip('beautifulsoup4 is not installed (tools/i18n.py needs it): pip install beautifulsoup4');
if (!fs.existsSync(path.join(ROOT, 'tools', 'review_sheet.py'))) { ok('tools/review_sheet.py exists', false); await finish(); process.exit(1); }

const LANGS = ['es', 'hi', 'zh', 'vi'];
const HEADER = ['id', 'priority', 'where', 'English', 'current translation', 'question for you', 'correction', 'note'];
const COL = { id: 0, pri: 1, where: 2, en: 3, cur: 4, ask: 5, corr: 6, note: 7 };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-roundtrip-'));
const site = path.join(tmp, 'site');
fs.mkdirSync(site);
for (const d of ['tools', 'lang', 'js', 'pages']) fs.cpSync(path.join(ROOT, d), path.join(site, d), { recursive: true, filter: (p) => !/__pycache__/.test(p) });
for (const f of fs.readdirSync(ROOT).filter((x) => /\.(html|xml|webmanifest|txt)$/.test(x))) fs.copyFileSync(path.join(ROOT, f), path.join(site, f));
const here = (...p) => path.join(site, ...p);
const read = (...p) => fs.readFileSync(here(...p), 'utf8');
const run = (cmd, args) => { const r = spawnSync(cmd, args, { cwd: site, encoding: 'utf8', maxBuffer: 1 << 28 }); return { code: r.status, out: r.stdout || '', err: r.stderr || '', all: (r.stdout || '') + (r.stderr || '') }; };
const sheetTool = (...args) => run(PY, ['tools/review_sheet.py', ...args]);

/* a small CSV reader and writer, the way Excel and Google Sheets save */
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
const writeCsv = (rows, delim = ',') => rows.map((r) => r.map((s) => (/[",\r\n;]/.test(s) || s.includes(delim) ? '"' + String(s).replace(/"/g, '""') + '"' : String(s))).join(delim)).join('\r\n') + '\r\n';
const readSheet = (p) => parseCsv(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
const saveSheet = (p, rows, delim = ',') => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, '﻿' + writeCsv(rows, delim), 'utf8'); };
const byId = (rows) => Object.fromEntries(rows.slice(1).map((r) => [r[COL.id], r]));
const lines = (s) => s.split('\n');

try {
  /* ------------------------------------------------------------------ the sheets the readers get */
  const ex = sheetTool('export', 'all');
  ok('export all makes the full sheets (the first ones given out)', ex.code === 0 && LANGS.every((c) => new RegExp('^' + c + ': \\d+ rows', 'm').test(ex.out)), ex.all.slice(0, 200));
  const first = path.join(tmp, 'first');
  fs.cpSync(here('review'), first, { recursive: true });
  const rowsOf = Object.fromEntries(LANGS.map((c) => [c, readSheet(path.join(first, c + '.csv'))]));
  ok('the sheets have the columns the hand-out names', LANGS.every((c) => rowsOf[c][0].join('|') === HEADER.join('|')), rowsOf.es[0].join('|'));

  /* ------------------------------------------------------------------ the short sheet: changes since the sheet that was given out */
  {
    const out = path.join(tmp, 'chg-none');
    const r = sheetTool('changes', 'es', path.join(first, 'es.csv'), '--out=' + out);
    ok('changes: a sheet that is as the site is now gives "nothing to send" and writes nothing', r.code === 0 && /nothing to send/.test(r.out) && !fs.existsSync(out), r.all.slice(0, 200));
  }
  {
    const old = rowsOf.es.map((r) => r.slice());
    const body = old.slice(1);
    const plainRow = (i) => body.findIndex((r, k) => k >= i && r[COL.id].startsWith('t') && !/[<{]/.test(r[COL.en]) && r[COL.en].length > 25 && r[COL.cur] && r[COL.cur] !== r[COL.en]);
    const iNew = plainRow(0), iChg = plainRow(iNew + 1), iRep = plainRow(iChg + 1), iApplied = plainRow(iRep + 1);
    const idNew = body[iNew][COL.id], idChg = body[iChg][COL.id], idRep = body[iRep][COL.id], idApplied = body[iApplied][COL.id];
    const keepNow = { chg: body[iChg][COL.cur], applied: body[iApplied][COL.cur] };
    const total = body.length;
    body[iChg][COL.cur] = 'Un texto de antes';                 // changed since the sheet: shows what it said before
    body[iRep][COL.id] = 'tdeadbeef';                          // the same words under another id: REPLACES
    body[iApplied][COL.cur] = 'Otro texto anterior';           // the site now has the correction this reader wrote in it: left out
    body[iApplied][COL.corr] = keepNow.applied;
    const rowsOld = [old[0], ...body.filter((_, k) => k !== iNew), ['tfeedface', '3', 'Old page', 'A line that is not on the site any more.', 'Una línea que ya no está.', '', '', '']];   // iNew is not in the old sheet: NEW
    const oldFile = path.join(tmp, 'old-es.csv');
    saveSheet(oldFile, rowsOld);
    const out = path.join(tmp, 'chg');
    const r = sheetTool('changes', 'es', oldFile, '--out=' + out);
    ok('changes: it counts what it found (1 new, 1 changed, 1 replaces an older id, 1 no longer on the website; the others as the old sheet showed them; one correction already in)',
      r.code === 0 && r.out.includes(`1 new, 1 changed, 1 replace an older id, 1 no longer on the website; ${total - 4} texts are as the old sheet showed them, 1 already have the reader's correction`), r.out.slice(0, 400));
    ok('changes: it writes the short sheet in four files (.xlsx, .csv, .html and the e-mail text)', ['xlsx', 'csv', 'html'].every((e) => fs.existsSync(path.join(out, 'es-changes.' + e))) && fs.existsSync(path.join(out, 'es-changes-message.txt')) && fs.readdirSync(out).length === 4, fs.readdirSync(out).join(','));
    const rows = readSheet(path.join(out, 'es-changes.csv'));
    const got = byId(rows);
    ok('changes: the short sheet has the same columns as the full one, so import reads it', rows[0].join('|') === HEADER.join('|'));
    ok('changes: it lists exactly the four rows, new, changed, replaces and removed', rows.length === 5 && Object.keys(got).sort().join(',') === [idNew, idChg, idRep, 'tfeedface'].sort().join(','), Object.keys(got).join(','));
    ok(`changes: the new text says NEW (${idNew})`, /^NEW since the first sheet\./.test(got[idNew][COL.ask]), got[idNew][COL.ask]);
    ok(`changes: the changed text says CHANGED and what it said before (${idChg})`, /^CHANGED since the first sheet\./.test(got[idChg][COL.ask]) && got[idChg][COL.ask].includes('Un texto de antes') && got[idChg][COL.cur] === keepNow.chg, got[idChg][COL.ask]);
    ok(`changes: the text with a new id says REPLACES and names the old id (${idRep} replaces tdeadbeef)`, /^REPLACES the line with id tdeadbeef of the first sheet\./.test(got[idRep][COL.ask]) && /words are the same/.test(got[idRep][COL.ask]), got[idRep][COL.ask]);
    ok('changes: a text that is gone says REMOVED, with its old words, and asks for nothing', /^REMOVED:/.test(got.tfeedface[COL.ask]) && got.tfeedface[COL.cur] === 'Una línea que ya no está.' && got.tfeedface[COL.pri] === '3', got.tfeedface[COL.ask]);
    ok('changes: a text whose current words are the correction the reader wrote is not listed', !(idApplied in got));
    ok('changes: it tells the person who edits the site which id to add to "renamed" (the old id and the new one)', new RegExp(idRep + ' is the new id of tdeadbeef: add "tdeadbeef": "' + idRep + '" under "renamed"').test(r.out), r.out.slice(-600));
    const msg = fs.readFileSync(path.join(out, 'es-changes-message.txt'), 'utf8');
    const html = fs.readFileSync(path.join(out, 'es-changes.html'), 'utf8');
    const T = JSON.parse(read('tools', 'review_instructions.json'));
    ok('changes: the e-mail, the printable page and the "Read me first" sheet say what is in the short sheet, in Spanish and in English', msg.includes(T.es.changes) && msg.includes(T.en.changes.replace('@LANG@', 'Spanish')) && html.includes(T.es.changes.slice(0, 40)) && !/How long does it take/.test(html)
      && /Subject: /.test(msg), msg.slice(0, 200));
    const x = run(PY, ['-c', 'import zipfile,sys\nz=zipfile.ZipFile(sys.argv[1])\nprint(z.read("xl/sharedStrings.xml").decode("utf-8"))', path.join(out, 'es-changes.xlsx')]);
    ok('changes: the .xlsx opens, with the short sheet and the instructions that say what it holds', x.code === 0 && x.out.includes('Esta hoja es corta') && x.out.includes('REPLACES the line with id tdeadbeef') && x.out.includes(T.es.changes_title), x.err.slice(0, 200));
    ok('changes: the instructions of every language have the two new parts (changes_title, changes), with no @LANG@ in the languages other than English', ['en', ...LANGS].every((c) => T[c].changes_title && T[c].changes && (c === 'en' || !/@LANG@/.test(T[c].changes))));
    ok('changes: it does not overwrite a short sheet that already has corrections in it', (() => {
      const mine = readSheet(path.join(out, 'es-changes.csv')); mine[1][COL.corr] = 'una corrección'; saveSheet(path.join(out, 'es-changes.csv'), mine);
      const again = sheetTool('changes', 'es', oldFile, '--out=' + out);
      const forced = sheetTool('changes', 'es', oldFile, '--out=' + out, '--force');
      return again.code === 1 && /NOT made/.test(again.out) && forced.code === 0;
    })());
    // the short sheet is read by import like any sheet: a correction on its NEW row is accepted, the REMOVED row (an id the site does not have) asks for nothing
    const mine = readSheet(path.join(out, 'es-changes.csv'));
    const newRow = mine.find((r) => r[COL.id] === idNew);
    newRow[COL.corr] = /[.。।]$/.test(newRow[COL.cur]) ? newRow[COL.cur].replace(/[.。।]$/, '!') : newRow[COL.cur] + '!';
    saveSheet(path.join(tmp, 'back-changes.csv'), mine);
    const dry = sheetTool('import', 'es', path.join(tmp, 'back-changes.csv'), '--dry-run');
    ok('changes: import reads the short sheet like any sheet: the correction on the new row is accepted; the words in "question for you" and the removed row are no problem', dry.code === 0 && /4 rows read, 1 with a correction: 1 accepted, 0 not used/.test(dry.out) && !/NOT USED|not read/.test(dry.out), dry.out.slice(0, 400));
    const wrong = sheetTool('changes', 'es', path.join(first, 'hi.csv'), '--out=' + path.join(tmp, 'chg-wrong'));
    ok('changes: the sheet of another language is refused in plain words, nothing is written', wrong.code === 2 && /does not belong to the Spanish file/.test(wrong.all) && !fs.existsSync(path.join(tmp, 'chg-wrong')), wrong.all.slice(0, 200));
  }

  /* ------------------------------------------------------------------ "renamed" */
  {
    const notes = JSON.parse(read('tools', 'review_notes.json'));
    const EN = JSON.parse(read('lang', 'en.json'));
    const pairs = Object.entries(notes.renamed || {});
    ok(`renamed: every new id of "renamed" in tools/review_notes.json is a text of the site and no old id is (${pairs.length} pair${pairs.length === 1 ? '' : 's'})`, pairs.length > 0 && pairs.every(([o, n]) => EN[n] !== undefined && EN[o] === undefined), JSON.stringify(pairs));
  }

  /* ------------------------------------------------------------------ a sample reader in each language */
  const FIX = {
    es: { skip: 'Saltar al contenido', east: '{text} (hora del Este de EE. UU.)', faq: ['Mira el', 'Consulta el'], delim: ',' },
    hi: { skip: 'मुख्य सामग्री पर जाइए', east: '{text} (अमेरिका का पूर्वी समय)', faq: ['देखें', 'देखिए'], delim: ';' },
    zh: { skip: '跳至正文', east: '{text}（美东时间）', faq: ['请查看', '请参阅'], delim: ',' },
    vi: { skip: 'Chuyển tới nội dung', east: '{text} (giờ miền Đông nước Mỹ)', faq: ['Xem', 'Hãy xem'], delim: ',' },
  };
  const SKIP_ID = 't0a4470d6', EAST_ID = 'jb90454d4', PRICE_ID = 't48324abe', PH_ID = 'j0e9f7be0', FAQ_NEW = 't6fab8a7b', FAQ_OLD = 'te6cbae6c';
  const SRC = (c) => JSON.parse(read('lang', 'src', c + '.json'));
  const before = Object.fromEntries(LANGS.map((c) => [c, read('lang', 'src', c + '.json')]));
  const enBefore = read('lang', 'en.json');
  for (const code of LANGS) {
    const fix = FIX[code];
    const rows = rowsOf[code].map((r) => r.slice());
    const g = byId(rows);
    const need = [SKIP_ID, EAST_ID, PRICE_ID, PH_ID, FAQ_NEW].filter((id) => !g[id]);
    ok(`${code}: the sample reader's rows are in the sheet`, need.length === 0, need.join(','));
    g[SKIP_ID][COL.corr] = fix.skip;
    g[EAST_ID][COL.corr] = fix.east;
    g[EAST_ID][COL.note] = 'Both Eastern and "of the East" are used; this one is shorter.';
    const price = g[PRICE_ID][COL.cur];
    const phEn = g[PH_ID][COL.en];
    g[PRICE_ID][COL.corr] = price.replace('$4.50', '$5.50');                                    // a reader who "fixes" a price
    g[PH_ID][COL.corr] = g[PH_ID][COL.cur].replace('{total}', '');                              // a reader who loses a {placeholder}
    // the line that got a new id after the first sheets: this reader's sheet still has the old id and the old words (no <span> mark), and a better word
    const oldRow = g[FAQ_NEW].slice();
    oldRow[COL.id] = FAQ_OLD;
    oldRow[COL.en] = oldRow[COL.en].replace(/<\/?span[^>]*>/g, '');
    oldRow[COL.cur] = oldRow[COL.cur].replace(/<\/?span[^>]*>/g, '');
    oldRow[COL.ask] = '';
    oldRow[COL.corr] = oldRow[COL.cur].replace(fix.faq[0], fix.faq[1]);
    if (oldRow[COL.corr] === oldRow[COL.cur]) ok(`${code}: the sample word of the old-id line is in the text`, false, fix.faq[0]);
    rows.push(oldRow);
    const back = path.join(tmp, 'back-' + code + '.csv');
    saveSheet(back, rows, fix.delim);
    const hash = () => read('lang', 'src', code + '.json');
    const dry = sheetTool('import', code, back, '--dry-run');
    ok(`${code}: the dry run writes nothing and says what it would do`, hash() === before[code] && /Dry run: 2 correction\(s\) would be written/.test(dry.out), dry.out.slice(-300));
    const imp = sheetTool('import', code, back);
    const accepted = [...imp.out.matchAll(/^Row \d+ \((\w+)\): ACCEPTED/gm)].map((m) => m[1]).sort();
    const refused = [...imp.out.matchAll(/^Row \d+ \((\w+)\): NOT USED/gm)].map((m) => m[1]).sort();
    ok(`${code}: the two good corrections are accepted, the price, the lost {placeholder} and the old-id line are not used (exit code 1)`, imp.code === 1 && accepted.join(',') === [EAST_ID, SKIP_ID].sort().join(',') && refused.join(',') === [FAQ_NEW, PH_ID, PRICE_ID].sort().join(','), imp.out.slice(0, 600));
    ok(`${code}: the refusals are in plain words (a price that is not the English price; the lost {total}; the old id has a new one)`, /\$5\.50|5\.50/.test(imp.out) && /\{total\}/.test(imp.out) && new RegExp(FAQ_OLD + ' is ' + FAQ_NEW + ' now').test(imp.out), imp.out.slice(0, 900));
    ok(`${code}: the note the reader wrote is shown to the owner, not applied`, /Notes your friend wrote/.test(imp.out) && imp.out.includes('shorter'), imp.out.slice(-400));
    // exactly the two lines changed in lang/src/<code>.json, and not one word of English
    const a = lines(before[code]), b = lines(read('lang', 'src', code + '.json'));
    const changed = a.length === b.length ? a.map((l, i) => (l === b[i] ? -1 : i)).filter((i) => i >= 0) : [-1];
    const S = SRC(code);
    ok(`${code}: exactly two lines of lang/src/${code}.json changed, and they are the reader's two corrections`, changed.length === 2 && S.ui[SKIP_ID] === fix.skip && S.js['{text} (Eastern Time)'] === fix.east, changed.join(','));
    const was = JSON.parse(before[code]);
    ok(`${code}: the refused texts keep the words they had`, S.ui[PRICE_ID] === was.ui[PRICE_ID] && S.ui[FAQ_NEW] === was.ui[FAQ_NEW] && S.js[phEn] === was.js[phEn] && was.js[phEn] !== undefined);
    ok(`${code}: English did not change`, read('lang', 'en.json') === enBefore);
    ok(`${code}: the tool says what to run next and runs none of it (lang/${code}.js is as before)`, /python3 tools\/i18n\.py build/.test(imp.out) && /i18n\.py missing/.test(imp.out) && !read('lang', code + '.js').includes(fix.skip));
  }

  /* ------------------------------------------------------------------ the steps of the hand-out: build, missing, facts */
  const build = run(PY, ['tools/i18n.py', 'build']);
  ok('python3 tools/i18n.py build works', build.code === 0 && LANGS.every((c) => new RegExp('lang/' + c + '\\.js').test(build.out)), build.all.slice(-300));
  for (const code of LANGS) {
    const m = run(PY, ['tools/i18n.py', 'missing', code]);
    ok(`python3 tools/i18n.py missing ${code} says 0 missing, also for the texts written by JavaScript`, m.code === 0 && /\b0 missing\b/.test(m.out) && /JavaScript: 0 missing/.test(m.out), m.all.slice(0, 200));
    ok(`lang/${code}.js has the reader's words after the build`, read('lang', code + '.js').includes(FIX[code].skip) && read('lang', code + '.js').includes(FIX[code].east.replace(/\\/g, '\\\\')), '');
  }
  const facts = run(process.execPath, ['tools/i18n_facts.mjs']);
  ok('node tools/i18n_facts.mjs: no difference in a number, price, time, day, date or name after the reader\'s corrections', facts.code === 0 && /\b0 difference\(s\) shown/.test(facts.out), facts.out.slice(-300));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
await finish();
