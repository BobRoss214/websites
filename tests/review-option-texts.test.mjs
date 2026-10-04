// order: 26
// browser: no
// quick: no
// covers: tools/review_option_texts.py, tools/review_sheet.py, patches/optional/*, docs/OPTION_PATCHES.md, lang/src/*
/* The reader sheets for the words that exist only if the farm picks an option (tools/review_option_texts.py). No browser; needs git and Python 3.8 (and beautifulsoup4, as the
 * rebuild commands do). The part that tries patches takes about two minutes, because every patch is applied and rebuilt in a copy of the site. Checked:
 *   - without running anything: every patch in patches/optional/ has a Strings: line, and the translation lines it adds are the same in number in Spanish, Hindi, Chinese and
 *     Vietnamese (a patch that adds a text in three languages is caught here); a patch that says "Strings: none" adds no translation line; one that names new texts adds some;
 *   - --list names every patch with its answer; wrong options are refused in plain words (exit 2) and change nothing;
 *   - on two patches, run for real in copies of the site: winter-B (one new sentence) gets a sheet in each language with exactly that sentence (the id its header names), a
 *     translation that is not the English, the owner answer that turns it on, an .html and a .csv with a byte order mark and the 8 columns; reserve-window (no words) gets
 *     no sheet and the index says so; the index names the sheet to hand out for the answer; nothing is missing after the patch, the facts check has nothing to say, and the
 *     site's own files were not changed (a hash of every file before and after);
 *   - the docs say how to make the sheets (docs/OPTION_PATCHES.md) and tests/README.md lists this test. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { ROOT, ok as record, info, skip, finish } from './lib.mjs';
const ok = (name, condition, detail = '') => record(name, condition, condition ? '' : detail);   // the reason is shown only when the check fails

const PY = process.env.WA_PYTHON || 'python3';
if (spawnSync(PY, ['-c', 'import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)']).status !== 0) skip(`${PY} (Python 3.8 or newer) is not available`);
if (spawnSync('git', ['--version']).status !== 0) skip('git is not installed');
const TOOL = 'tools/review_option_texts.py';
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const LANGS = ['es', 'hi', 'zh', 'vi'];
const run = (...args) => spawnSync(PY, [TOOL, ...args], { cwd: ROOT, encoding: 'utf8', timeout: 900000, maxBuffer: 1 << 26 });

ok(TOOL + ' exists', fs.existsSync(path.join(ROOT, TOOL)));

// ---- the patches themselves, read as text
const dir = path.join(ROOT, 'patches', 'optional');
const patches = fs.readdirSync(dir).filter((f) => f.endsWith('.patch')).sort();
const lines = (f) => fs.readFileSync(path.join(dir, f), 'utf8').split('\n');
const added = (f) => { const n = Object.fromEntries(LANGS.map((l) => [l, 0])); let cur = null; for (const line of lines(f)) { const m = /^diff --git a\/(\S+)/.exec(line); if (m) cur = m[1]; const l = cur && /^lang\/src\/(es|hi|zh|vi)\.json$/.exec(cur); if (l && /^\+\s+"[^"]+": /.test(line) && !line.startsWith('+++')) n[l[1]]++; } return n; };
const header = (f) => { const h = {}; for (const line of lines(f)) { if (/^(diff |--- |\+\+\+ )/.test(line)) break; const m = /^([A-Za-z]+):\s*(.*)$/.exec(line); if (m) h[m[1]] = m[2]; } return h; };
const noStrings = [], uneven = [], liars = [];
for (const f of patches) {
  const h = header(f), n = added(f), counts = LANGS.map((l) => n[l]);
  if (!h.Strings) noStrings.push(f);
  if (new Set(counts).size !== 1) uneven.push(f + ' ' + JSON.stringify(n));
  if (/^none\b/i.test(h.Strings || '') && counts.some((c) => c > 0)) liars.push(f + ' says none but adds ' + counts.join('/'));
  if (h.Strings && !/^none\b/i.test(h.Strings) && /\bnew|changed\b/.test(h.Strings) && !counts.every((c) => c > 0)) liars.push(f + ' names new texts but adds ' + counts.join('/'));
}
ok('every patch in patches/optional/ (' + patches.length + ') has a Strings: line', noStrings.length === 0, noStrings.join(', '));
ok('every patch adds the same number of translation lines in Spanish, Hindi, Chinese and Vietnamese (no text in only some of the four)', uneven.length === 0, uneven.join('; '));
ok('a patch that says "Strings: none" adds no translation line, and one that names new texts adds some', liars.length === 0, liars.join('; '));

// ---- the command line
const list = run('--list');
ok('--list names every patch with the answer it gives and what its header promises', list.status === 0 && patches.every((f) => list.stdout.includes(header(f).Option || f)) && /answers:/.test(list.stdout), list.stdout.slice(0, 200));
for (const [args, why] of [[['--only', 'zzzz-no-such-patch'], 'a name that matches no patch'], [['--jobs', '0'], '--jobs 0'], [['--colour'], 'an unknown option'], [['--patch', '/nonexistent.patch'], 'a missing patch file'], [['--out'], '--out without a folder']]) {
  const r = run(...args);
  ok('refused in plain words (exit 2, no traceback): ' + why, r.status === 2 && !/Traceback/.test(r.stdout + r.stderr), `exit ${r.status}: ${(r.stdout + r.stderr).slice(0, 120)}`);
}

// ---- two patches, for real
const hashAll = () => { const h = crypto.createHash('sha256'); const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) { if (['.git', 'node_modules', 'deploy', 'review', '__pycache__', '.visual'].includes(e.name)) continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else h.update(p + fs.readFileSync(p).toString('base64')); } }; walk(ROOT); return h.digest('hex'); };
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-optsheets-'));
const before = hashAll();
const r = run('--only', 'winter-B', '--only', 'reserve-window', '--out', out, '--jobs', '2');
ok('the tool ran on winter-B and reserve-window (exit 0)', r.status === 0, `exit ${r.status}: ${(r.stdout + r.stderr).slice(-400)}`);
ok('the site folder itself was not changed by the run (every file, before and after)', hashAll() === before);
const idx = fs.existsSync(path.join(out, 'index.json')) ? JSON.parse(fs.readFileSync(path.join(out, 'index.json'), 'utf8')) : { options: [] };
const text = fs.existsSync(path.join(out, 'INDEX.txt')) ? fs.readFileSync(path.join(out, 'INDEX.txt'), 'utf8') : '';
const wb = idx.options.find((o) => o.option === 'winter-B'), rw = idx.options.find((o) => o.option === 'reserve-window');
const sentenceId = (/\(id (t[0-9a-f]{8})\)/.exec(header('winter-B-fall-prices-note.patch').Strings || '') || [])[1];
ok('winter-B: one new text in every language, and its sheets are in the index', !!wb && LANGS.every((l) => wb.texts[l] && wb.texts[l].new === 1 && wb.texts[l].changed === 0) && LANGS.every((l) => wb.sheets.includes(`winter-B/${l}.html`)), JSON.stringify(wb && wb.texts));
ok('winter-B: nothing is missing after the patch in any language, and nothing was left untranslated', !!wb && LANGS.every((l) => wb.missing[l][0] === 0 && wb.missing[l][1] === 0 && wb.not_translated[l].length === 0), JSON.stringify(wb && wb.missing));
ok('winter-B: the facts check of the translations has nothing to say', !!wb && (wb.facts === null || (wb.facts.code === 0 && /\b0 difference/.test(wb.facts.lines.join(' ')))), JSON.stringify(wb && wb.facts));
ok('reserve-window (no words): no sheet, and the index says there is nothing to hand out', !!rw && rw.sheets.length === 0 && !fs.existsSync(path.join(out, 'reserve-window')) && /\[reserve-window\][^\n]*\n\s+patch:[^\n]*\n\s+no new or changed words: nothing to hand out/.test(text), text.slice(0, 600));
for (const l of LANGS) {
  const csvPath = path.join(out, 'winter-B', l + '.csv'), htmlPath = path.join(out, 'winter-B', l + '.html');
  const csv = fs.existsSync(csvPath) ? fs.readFileSync(csvPath) : Buffer.alloc(0);
  const body = csv.toString('utf8').replace(/^﻿/, '');
  const rows = body.split('\r\n').filter(Boolean);
  const cells = rows[1] ? rows[1].match(/("([^"]|"")*"|[^,]*)(,|$)/g) : [];
  ok(`winter-B ${l}: the .csv starts with a byte order mark, has the 8 columns and exactly one row, for the sentence its header names (${sentenceId}), with a translation that is not the English and the answer that turns it on`,
    csv[0] === 0xEF && csv[1] === 0xBB && csv[2] === 0xBF && rows[0] === 'id,where,English,current translation,replaces,turned on by,correction,note' && rows.length === 2 && rows[1].startsWith(sentenceId + ',') && /d01 B/.test(rows[1]) && cells.length >= 8 && cells[2] !== cells[3],
    rows.slice(0, 2).join(' | ').slice(0, 300));
  const page = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, 'utf8') : '';
  ok(`winter-B ${l}: the .html has the row, the instructions and the language`, page.includes(sentenceId) && /only if the farm chooses this option/.test(page) && new RegExp(`<td lang="${l === 'zh' ? 'zh-Hans' : l}">`).test(page), page.length + ' bytes');
}
ok('INDEX.txt names the answer (d01 B), the patch and the sheet to hand out', /d01 B \(winter\)[^\n]*\[winter-B\]/.test(text) && /winter-B\/es\.html/.test(text), text.slice(0, 500));
fs.rmSync(out, { recursive: true, force: true });

// ---- the docs
ok('docs/OPTION_PATCHES.md says how to make the sheets (python3 tools/review_option_texts.py)', /python3 tools\/review_option_texts\.py/.test(read('docs/OPTION_PATCHES.md')) && /review\/options/.test(read('docs/OPTION_PATCHES.md')));
ok('tests/README.md lists this test', /`review-option-texts`/.test(read('tests/README.md')));
info('patches read: ' + patches.length);
await finish({});
