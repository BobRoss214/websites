// order: 36
// browser: no
// covers: docs/OWNER_CHEAT_SHEET.md, docs/OWNER_CHEAT_SHEET.es.md, print/owner-cheat-sheet.html, print/owner-cheat-sheet.es.html, tools/*, index.html, pages/*, js/content.js, js/features.js, README.md
/* The owner's cheat sheet (docs/OWNER_CHEAT_SHEET.md, its Spanish copy and the printed pages) still says what the files and tools say. No browser; about 10 seconds
 * (python3 runs every tool the sheet names with --help, in a throw-away copy of the site, so nothing in the real folder is touched). Compared:
 *   - the shape: a start, the translation box T and jobs 1 to 12, each job with 3 to 6 numbered steps (box T: 5), then "Notes for the team";
 *   - every command in a code span names a script that exists; each tool answers --help with its usage and exit code 0;
 *     every --flag the sheet writes is in that tool's own words; every i18n.py word (extract, missing, build, jsstrings) is in its help;
 *   - every "Search `words`" is found in the file the step names; the first command of jobs 1, 6 and 7 (tools/change_fact.py, without --yes) is run in the copy: it lists the places the sheet names and changes nothing;
 *   - every message the sheet says you should see (Ready:, NOT READY:, agree everywhere; 0 disagree., Heads up:, Closed today ...) is still written in the tool or the
 *     script that prints it, and is still on the sheet; a message that changes in a tool turns this red until the sheet is changed;
 *   - the Spanish copy is the same page: the same number of lines from the title on, the same kind of line, the same words in backticks, the same numbers;
 *   - the printed pages (print/owner-cheat-sheet.html and .es.html) are the ones tools/make_cheat_sheet.py makes from the two notes now, have 12 jobs, and are not uploaded;
 *   - the README, the launch checklist's weekly list and tests/README.md point to the sheet.
 * When it fails: change the sheet (and its Spanish copy, line for line), run  python3 tools/make_cheat_sheet.py  for the printed pages, then  node tests/docs.test.mjs  and
 *  python3 tools/plain_lint.py --strict . A test in a browser, owner-cheat-sheet-print, checks that each printed page fits one sheet, both sides. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, ok, info, skip, finish } from './lib.mjs';

const PY = process.env.WA_PYTHON || 'python3';
if (spawnSync(PY, ['--version']).status !== 0) skip('python3 is not installed');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const exists = (f) => fs.existsSync(path.join(ROOT, f));
const en = read('docs/OWNER_CHEAT_SHEET.md'), es = read('docs/OWNER_CHEAT_SHEET.es.md');

// ---- the shape
const sections = (text) => { const out = []; let cur = null; for (const line of text.split('\n')) { if (line.startsWith('## ')) { cur = { head: line.slice(3).trim(), lines: [] }; out.push(cur); } else if (cur) cur.lines.push(line); } return out; };
const sec = sections(en), jobs = sec.filter((s) => /^\d+\. /.test(s.head)), steps = (s) => s.lines.filter((l) => /^\d+\. /.test(l));
ok('the sheet has its start, box T and 12 jobs numbered 1 to 12, then "Notes for the team"', sec[0].head === 'Before you start' && /^T\. /.test(sec[1].head) && jobs.length === 12 && jobs.every((j, i) => j.head.startsWith((i + 1) + '. ')) && sec[sec.length - 1].head === 'Notes for the team', sec.map((s) => s.head.slice(0, 12)).join(' | '));
ok('every job has 3 to 6 numbered steps, and box T has 5', jobs.every((j) => steps(j).length >= 3 && steps(j).length <= 6) && steps(sec[1]).length === 5, jobs.map((j) => steps(j).length).join(','));
const text = (j) => j.lines.join('\n');
ok('jobs 1 to 10 each name a command or a file in a code span, and say what you should see (job 2 says what the badges say)', jobs.slice(0, 10).every((j, i) => /`(?:python3|node) tools\/|`[\w\/.-]+\.(?:js|html|json)`/.test(text(j)) && (/should (?:see|say|list)/.test(text(j)) || i === 1)), jobs.slice(0, 10).map((j) => j.head.slice(0, 14)).join(' | '));
ok('jobs 2, 3 and 4 name the file to open and the words to search for, jobs 2 and 3 say what you should see on the page, and job 5 sends you on to box T', [1, 2, 3].every((i) => /[Ss]earch `/.test(text(jobs[i])) && /`[\w\/.-]+\.(?:js|html|json)`/.test(text(jobs[i]))) && /Closed today\./.test(text(jobs[1])) && /Heads up:/.test(text(jobs[2])) && /[Bb]ox T/.test(text(jobs[4])));
ok('jobs 1, 6 and 7 are one command each: the command, the same command with --yes, what you should see, and undo', [0, 5, 6].every((i) => /`python3 tools\/change_fact\.py (?:hours|price|email)[^`]*`/.test(text(jobs[i])) && /with `--yes`/.test(text(jobs[i])) && /`Ready\.`/.test(text(jobs[i])) && (/change_fact\.py undo/.test(text(jobs[i])) || i === 0) && !/box T/.test(text(jobs[i]))));

// ---- the commands
const spans = [...en.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);
const commands = spans.filter((s) => /^(?:python3?|node) tools\//.test(s));
const scriptOf = (c) => c.split(/\s+/)[1];
const missingScripts = [...new Set(commands.map(scriptOf))].filter((f) => !exists(f));
ok('every command in a code span runs a script that exists (' + new Set(commands.map(scriptOf)).size + ' scripts in ' + commands.length + ' commands)', commands.length > 20 && missingScripts.length === 0, missingScripts.join(', '));
const toolPaths = [...new Set(spans.filter((s) => /^tools\/[\w.-]+$/.test(s)))];
ok('every tool named by its path in a code span exists (' + toolPaths.join(', ') + ')', toolPaths.every(exists), toolPaths.filter((f) => !exists(f)).join(', '));

// every tool answers --help, in a throw-away copy of the site (pages.py rebuilds the pages when it is asked for help, so it must never run in the real folder)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-cheat-'));
for (const e of fs.readdirSync(ROOT)) { if (['.git', 'node_modules', 'deploy', 'tests', 'review', 'patches'].includes(e)) continue; fs.cpSync(path.join(ROOT, e), path.join(tmp, e), { recursive: true }); }
const scripts = [...new Set(commands.filter((c) => c.startsWith('python3')).map(scriptOf))];
const helpText = {}, helpBad = [];
for (const s of scripts) {
  const r = spawnSync(PY, [s, '--help'], { cwd: tmp, encoding: 'utf8', timeout: 90000 });
  helpText[s] = (r.stdout || '') + (r.stderr || '');
  const usage = /usage|python3 tools\/|Adds a photo/i.test(helpText[s]);
  if (!(usage && r.status === 0)) helpBad.push(s + ' (exit ' + r.status + ')');
}
ok('every python3 tool in the sheet answers --help with its usage and exit code 0 (' + scripts.length + ' tried in a copy)', scripts.length >= 8 && helpBad.length === 0, helpBad.join(', '));
const badFlags = [];
for (const c of commands.filter((x) => x.startsWith('python3'))) {
  const s = scriptOf(c), src = read(s);
  for (const f of new Set(c.match(/(?<=\s)--[a-z-]+/g) || [])) if (f !== '--help' && !src.includes(f)) badFlags.push(s + ' has no ' + f);
}
ok('every --flag written in a command is in that tool\'s own words', badFlags.length === 0, badFlags.join(', '));
const i18nWords = new Set(commands.filter((c) => c.startsWith('python3 tools/i18n.py ')).map((c) => c.split(/\s+/)[2]));
ok('every i18n.py word in the sheet (' + [...i18nWords].join(', ') + ') is in its help', [...i18nWords].every((w) => helpText['tools/i18n.py'].includes(w)), [...i18nWords].filter((w) => !helpText['tools/i18n.py'].includes(w)).join(', '));
const factNames = new Set(commands.filter((c) => c.startsWith('python3 tools/check_facts.py ')).map((c) => c.split(/\s+/)[2]).filter((w) => w && !w.startsWith('-')));
const factsHelp = spawnSync(PY, ['tools/check_facts.py', '--short'], { cwd: tmp, encoding: 'utf8', timeout: 90000 }).stdout || '';
ok('every fact the sheet asks check_facts.py about (' + [...factNames].join(', ') + ') matches a fact it knows', [...factNames].every((w) => spawnSync(PY, ['tools/check_facts.py', w, '--brief'], { cwd: tmp, encoding: 'utf8' }).status === 0 && new RegExp(w.replace('-', '.?'), 'i').test(factsHelp.replace(/-/g, '-'))), [...factNames].join(', '));
// the one-command jobs: the first command of each (without --yes) lists places and changes nothing; what the sheet says about its list is what it prints
const DRY = [["price '$31' '$32'", ['3 places in 2 files', 'index.html', 'pages/pumpkin-patch.html', '3 page texts']], ['hours "Fri-Sun, 10 am-8 pm" "Fri-Sun, 10 am-9 pm"', ['index.html', 'js/content.js']],
  ['email cathy@wiseacresorganic.com office@wiseacresorganic.com', ['js/features.js', '6 page texts']], ['phone 704-207-6347 704-555-1234', ['1 page text']]];
const HASH = 'import hashlib,os\nh=hashlib.sha256()\nfor b,d,f in sorted(os.walk(".")):\n    for n in sorted(f):\n        if "__pycache__" not in b: h.update(open(os.path.join(b,n),"rb").read())\nprint(h.hexdigest())';
const dryBad = [];
for (const [args, want] of DRY) {
  if (!en.includes('`python3 tools/change_fact.py ' + args + '`')) { dryBad.push('the sheet no longer has `python3 tools/change_fact.py ' + args + '`'); continue; }
  const before = spawnSync(PY, ['-c', HASH], { cwd: tmp, encoding: 'utf8' }).stdout;
  const parts = args.match(/"[^"]*"|'[^']*'|\S+/g).map((x) => x.replace(/^"|"$/g, '').replace(/^'|'$/g, ''));
  const r = spawnSync(PY, ['tools/change_fact.py', ...parts], { cwd: tmp, encoding: 'utf8', timeout: 120000 });
  const after = spawnSync(PY, ['-c', HASH], { cwd: tmp, encoding: 'utf8' }).stdout;
  const out = (r.stdout || '') + (r.stderr || '');
  if (r.status !== 0 || want.some((w) => !out.includes(w)) || before !== after) dryBad.push(args + ': exit ' + r.status + ', missing ' + want.filter((w) => !out.includes(w)).join(' / ') + (before !== after ? ', and it changed a file' : ''));
}
ok('the first command of jobs 1, 6 and 7 lists the places the sheet names, and changes nothing (' + DRY.length + ' run in the copy)', dryBad.length === 0, dryBad.join('; '));
fs.rmSync(tmp, { recursive: true, force: true });

// ---- the words to search for, and the counts
const bad = [], found = [];
for (const j of jobs) {
  let file = null;
  for (const l of j.lines) {
    for (const m of l.matchAll(/`((?:[\w-]+\/)*[\w.-]+\.(?:html|js|json))`|[Ss]earch `([^`]+)`/g)) {
      if (m[1]) file = m[1].startsWith('pages/') || m[1].includes('/') || exists(m[1]) ? m[1] : file;
      else if (m[2]) {
        const after = /`((?:[\w-]+\/)*[\w.-]+\.(?:html|js|json))`/.exec(l.slice(m.index + m[0].length));   // "Search `2026` in `index.html`": the file comes after the words
        const here = (after && /^ in /.test(l.slice(m.index + m[0].length)) ? after[1] : null) || file;
        if (!here) { bad.push(j.head.slice(0, 12) + ': "' + m[2] + '" has no file'); continue; }
        file = here;
        found.push(file + ' <- ' + m[2]);
        if (!exists(file) || !read(file).includes(m[2])) bad.push(file + ' has no ' + m[2]);
      }
    }
  }
}
ok('every "Search `words`" is found in the file its step names (' + found.length + ' searches)', found.length >= 6 && bad.length === 0, bad.join('; '));
const count = (f, w) => read(f).split(w).length - 1;   // every time the words occur in the file
const COUNTS = [['js/content.js', 'closures: [],', 1, 'Search `closures: [],`'], ['js/content.js', "notice: '',", 1, "Search `notice: '',`"], ['js/content.js', "noticeUntil: '',", 1, "search `noticeUntil: '',`"]];
const wrongCount = COUNTS.filter(([f, w, n, said]) => count(f, w) !== n || !en.includes(said)).map(([f, w, n, said]) => f + ' ' + w + ': ' + count(f, w) + ' in the file, the sheet says ' + n + (en.includes(said) ? '' : ' (the words "' + said + '" are not on the sheet)'));
ok('the counts the sheet gives are the real counts in the files (' + COUNTS.length + ' checked)', wrongCount.length === 0, wrongCount.join('; '));
const hoursRows = (read('index.html').match(/data-release="\d{4}-\d{2}-\d{2}" data-until="\d{4}-\d{2}-\d{2}"/g) || []).length;
ok('the pizza table has rows the sheet can point to (the last row looks like the one it shows)', hoursRows >= 4 && /<tr data-release="2026-10-27" data-until="2026-11-08">/.test(read('index.html')) && en.includes('<tr data-release="2026-10-27" data-until="2026-11-08">'), hoursRows + ' rows');

// ---- what you should see: each message is written in the file that prints it
// [what the sheet says, what the file must hold so that it is printed, where]; js/ means any script in the js folder
const SEEN = [
  ['Ready:', 'Ready: ', 'tools/make_deploy_folder.py'], ['NOT READY: 4 checks are red.', 'NOT READY: %d check', 'tools/make_deploy_folder.py'], ['Upload what is INSIDE that folder', 'Upload what is INSIDE that folder', 'tools/make_deploy_folder.py'],
  ['WARNING:', "'  WARNING: '", 'tools/make_deploy_folder.py'], ['Ready.', 'Ready. %d place', 'tools/change_fact.py'], ['every fact agrees and no text is missing', 'every fact agrees and no text is missing', 'tools/change_fact.py'], ['NOT DONE yet', 'NOT DONE yet', 'tools/change_fact.py'],
  ['means more than one thing', 'means more than one thing', 'tools/change_fact.py'], ['Facts agree everywhere.', 'Facts agree everywhere.', 'tools/make_deploy_folder.py'], ['Translations complete:', 'Translations complete: ', 'tools/make_deploy_folder.py'],
  ['Ready to make deploy/ (nothing was written: --check).', 'Ready to make deploy/ (nothing was written: --check)', 'tools/make_deploy_folder.py'],
  ['agree everywhere; 0 disagree.', 'agree everywhere; %d disagree.', 'tools/check_facts.py'], ['DIFFERENT', 'DIFFERENT', 'tools/check_facts.py'], ['== Summary ==', '== Summary ==', 'tools/launch_check.py'], ['Address:', 'Address:', 'tools/serve.py'],
  ['Done.', "'Done.'", 'tools/add_photo.py'], ['picture:', 'picture:', 'tools/add_photo.py'], ['306 JavaScript strings -> lang/js-strings.json', 'JavaScript strings -> ', 'tools/i18n.py'], ['not valid JSON', 'not valid JSON', 'tools/i18n.py'],
  ['text written by JavaScript: 0 missing', 'text written by JavaScript: ', 'tools/i18n.py'], ['0 missing', ' missing', 'tools/i18n.py'],
  ['Site check: nothing is broken', 'nothing is broken', 'js/'], ['Site check: 1 thing to fix', 'thing to fix', 'js/'], ['js/content.js stopped at line', "js/content.js stopped ' + (e.line ? 'at line '", 'js/'], ['was read as 2026-10-04.', 'was read as', 'js/'],
  ['Heads up:', 'Heads up:', 'js/'], ['Closed today.', 'Closed today', 'js/'], ['No visits today.', 'No visits today', 'js/'], ['Open now, until 9 pm', 'Open now, until', 'js/'],
  ['Next pizza reservations open in 4 hours 59 minutes', 'Next pizza reservations open in', 'js/'], ['Pizza reservations are open now', 'Pizza reservations are open now', 'js/'],
];
const jsAll = fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js')).map((f) => read('js/' + f)).join('\n');
const unprinted = SEEN.filter(([, w, f]) => !(f === 'js/' ? jsAll : read(f)).includes(w));
ok('every message the sheet says you should see is still written where it is printed (' + SEEN.length + ' checked)', unprinted.length === 0, unprinted.map(([, w, f]) => '"' + w + '" in ' + f).join('; '));
const notOnSheet = SEEN.filter(([w]) => !en.includes(w)).map(([w]) => w);
ok('and every one of those messages is on the sheet (so this list cannot drift from the sheet)', notOnSheet.length === 0, notOnSheet.join('; '));

// ---- the Spanish copy: the same page
const KIND = (l) => (/^#{1,6} /.test(l) ? 'h' + l.match(/^#+/)[0].length : l.startsWith('- ') ? 'li' : /^\d+\. /.test(l) ? 'num' : 'p');
// (the Spanish note names the Spanish printed page: print/owner-cheat-sheet.es.html is read as print/owner-cheat-sheet.html)
const SIG = (l) => { const ticks = [...l.matchAll(/`[^`]*`/g)].map((m) => m[0].replace('owner-cheat-sheet.es.html', 'owner-cheat-sheet.html')).sort(); const rest = l.replace(/`[^`]*`/g, ' ').replace(/\]\([^)]*\)/g, ' '); return JSON.stringify({ ticks, nums: (rest.match(/\d+(?::\d+)?/g) || []).sort() }); };
const linesOf = (t) => { const all = t.split('\n').map((l) => l.replace(/\s+$/, '')).filter(Boolean); return all.slice(all.findIndex((l) => l.startsWith('# '))); };
const enL = linesOf(en), esL = linesOf(es);
ok('the Spanish copy exists, says it was written by an AI, and links to the English sheet (and the English sheet links to it)', /Note for the team: this translation was written by an AI/.test(es) && /Nota para el equipo: esta traducción fue escrita por una IA/.test(es) && /\]\(OWNER_CHEAT_SHEET\.md\)/.test(es) && /\]\(OWNER_CHEAT_SHEET\.es\.md\)/.test(en));
ok('Spanish: the same number of lines as the English sheet, from the title to the end (' + enL.length + ')', enL.length === esL.length, esL.length + ' in Spanish');
const drift = [];
for (let i = 0; i < Math.min(enL.length, esL.length); i++) {
  if (KIND(enL[i]) !== KIND(esL[i])) drift.push('line ' + (i + 1) + ' is a different kind of line: "' + esL[i].slice(0, 50) + '"');
  else if (SIG(enL[i]) !== SIG(esL[i])) drift.push('line ' + (i + 1) + ' differs in a word in backticks or a number: "' + esL[i].slice(0, 60) + '" (English ' + SIG(enL[i]) + ' / Spanish ' + SIG(esL[i]) + ')');
}
ok('Spanish: every line has the same kind, the same words in backticks (commands, files, messages) and the same numbers as its English line', drift.length === 0, drift.slice(0, 3).join(' || ') + (drift.length > 3 ? ' ... and ' + (drift.length - 3) + ' more' : ''));
ok('Spanish: the steps of every job are the same numbers, in order', JSON.stringify(sections(es).map((s) => steps(s).length)) === JSON.stringify(sec.map((s) => steps(s).length)));

// ---- the printed pages
const gen = spawnSync(PY, ['tools/make_cheat_sheet.py', '--check'], { cwd: ROOT, encoding: 'utf8', timeout: 60000 });
ok('print/owner-cheat-sheet.html and print/owner-cheat-sheet.es.html are what tools/make_cheat_sheet.py makes from the two notes now', gen.status === 0, (gen.stdout + gen.stderr).trim().split('\n').slice(0, 2).join(' | ') + '  → run  python3 tools/make_cheat_sheet.py');
for (const [file, doc, label] of [['print/owner-cheat-sheet.html', en, 'English'], ['print/owner-cheat-sheet.es.html', es, 'Spanish']]) {
  const html = exists(file) ? read(file) : '';
  const liHtml = (html.match(/<li>/g) || []).length, liDoc = sections(doc).filter((s) => !/^(Notes for the team|Notas para el equipo)/.test(s.head)).reduce((n, s) => n + s.lines.filter((l) => /^(\d+\.|-) /.test(l)).length, 0);
  ok(label + ' print page: 12 jobs and box T in two sides, every step of the note (' + liDoc + '), nothing from "Notes for the team", noindex, light only', (html.match(/<section class="job" id="job-\d+">/g) || []).length === 12 && /id="box-t"/.test(html) && (html.match(/<div class="side"/g) || []).length === 2 && liHtml === liDoc && !/Notes for the team|Notas para el equipo/.test(html) && /name="robots" content="noindex"/.test(html) && /name="color-scheme" content="only light"/.test(html), liHtml + ' steps in the page, ' + liDoc + ' in the note');
}
const deploySrc = read('tools/make_deploy_folder.py');
ok('the printed sheets are left out of the upload folder (LEFT_OUT_INSIDE in tools/make_deploy_folder.py)', /LEFT_OUT_INSIDE = \[[\s\S]*?'print\/owner-cheat-sheet\.html'[\s\S]*?'print\/owner-cheat-sheet\.es\.html'[\s\S]*?\n\]/.test(deploySrc));

// ---- the sheet is linked from the places the owner starts
ok('the README and the launch checklist (the weekly list) link to the sheet, and tests/README.md lists both tests', /\]\(docs\/OWNER_CHEAT_SHEET\.md\)/.test(read('README.md')) && /\]\(OWNER_CHEAT_SHEET\.md\)/.test(read('docs/LAUNCH_CHECKLIST.md')) && /`owner-cheat-sheet`/.test(read('tests/README.md')) && /`owner-cheat-sheet-print`/.test(read('tests/README.md')));
info('commands: ' + commands.length + '; scripts: ' + scripts.length + '; searches: ' + found.length + '; messages: ' + SEEN.length + '; lines in the English sheet: ' + enL.length);

await finish({});
