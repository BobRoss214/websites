// order: 75
// browser: no
// covers: README.md, docs/*, tools/plain_lint.py
/* The documents the farm owner reads are written in plain words. tools/plain_lint.py reads their owner-facing sections (README.md: the
 * "Start here", "Day-to-day changes", "A new year", "Check your changes", "Putting it online" and "Optional patches" parts; the launch checklist, the
 * questions, the year calendar, "What the site stores", the optional-patches table and the owner-page proposal: all of it except what is said below)
 * and counts the length of every sentence, the syllables of every word, and the words that only a developer uses. This test runs it with --strict and
 * fails when:
 *   - a section is harder than grade 9 on average (Flesch-Kincaid), or a sentence is longer than 40 words, or a word from the [jargon] part of
 *     tools/plain_words.txt (config, deploy, repo, commit, regex, cache, parse ...) is used in a sentence of an owner-facing section;
 *   - a [hold] entry (a sentence that is held back from those limits because a patch in patches/optional/ carries its line) matches no sentence, or two;
 *   - tools/plain_lint.py names a heading the file no longer has, or reads nothing from a file;
 *   - the limits in the tool were loosened (grade above 9, sentences above 40 words), or the jargon list lost one of its words;
 *   - the tool no longer fails on a bad sentence (it is run on a copy with a 45-word sentence added, with "deploy" added, and so on).
 * Not read on purpose: docs/DECISION_PLAYBOOK.md (for whoever edits the site), "Sources" in the launch checklist, "For whoever edits the site" and
 * "Translation notes" in the questions file, the Spanish copies (they are kept in step by hand and by tests/owner-calendar.test.mjs).
 * No browser; about a second. Needs python3 (3.8 or newer). When it fails: write the sentence in plainer words (shorter, one idea each; the word list
 * says what to write instead), then run  node tests/docs.test.mjs  as well. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, ok, info, skip, finish } from './lib.mjs';

const PY = process.env.WA_PYTHON || 'python3';
if (spawnSync(PY, ['--version']).status !== 0) skip('python3 is not installed');
const TOOL = path.join(ROOT, 'tools', 'plain_lint.py');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const lint = (...args) => spawnSync(PY, [TOOL, ...args], { encoding: 'utf8', timeout: 60000 });
const OWNER_DOCS = ['README.md', 'docs/LAUNCH_CHECKLIST.md', 'docs/QUESTIONS_FOR_THE_FARM.md', 'docs/OWNER_YEAR_CALENDAR.md', 'docs/WHAT_THE_SITE_STORES.md', 'docs/OPTION_PATCHES.md', 'docs/PROPOSAL_owner_page.md'];

// ---- the tool and its word list exist, and the limits are still the agreed ones
ok('tools/plain_lint.py and tools/plain_words.txt exist', fs.existsSync(TOOL) && fs.existsSync(path.join(ROOT, 'tools', 'plain_words.txt')));
const src = fs.readFileSync(TOOL, 'utf8');
const grade = Number((/^MAX_GRADE = ([\d.]+)/m.exec(src) || [])[1]), longest = Number((/^MAX_SENTENCE = (\d+)/m.exec(src) || [])[1]);
ok('the limits were not loosened: grade ' + grade + ' (at most 9) and ' + longest + ' words a sentence (at most 40)', grade > 0 && grade <= 9 && longest > 0 && longest <= 40);
const words = read('tools/plain_words.txt'), jargon = new Map();
let part = '';
for (const raw of words.split('\n')) {
  const line = raw.replace(/#.*$/, '').trim();
  if (!line) continue;
  const h = /^\[(\w+)\]$/.exec(line);
  if (h) { part = h[1]; continue; }
  if (part === 'jargon') { const [w, ...rest] = line.split('='); jargon.set(w.trim().toLowerCase(), rest.join('=').trim()); }
}
const NEEDED = ['config', 'deploy', 'repo', 'commit', 'regex', 'csp', 'dom', 'build step', 'hash', 'cli', 'endpoint', 'cache', 'minify', 'markup', 'parse', 'runtime'];
ok('the [jargon] list still has the words it was made for (' + NEEDED.length + ')', NEEDED.every((w) => jargon.has(w)), NEEDED.filter((w) => !jargon.has(w)).join(', '));
ok('every [jargon] word says what to write instead', [...jargon].every(([, plain]) => plain.length > 0), [...jargon].filter(([, plain]) => !plain).map(([w]) => w).join(', '));

// ---- the tool counts correctly, and reads every owner-facing document
const self = lint('--self-test');
ok('tools/plain_lint.py --self-test passes (its own counting of words, syllables and sentences)', self.status === 0, (self.stdout + self.stderr).trim().split('\n').slice(0, 3).join(' | '));
const list = lint('--list');
ok('--list names every owner-facing document and reads at least one section of each', list.status === 0 && OWNER_DOCS.every((d) => new RegExp('^' + d.replace(/[.]/g, '\\.') + ': [1-9]\\d* section', 'm').test(list.stdout)), list.stdout.split('\n').filter((l) => /^\S/.test(l)).join(' | '));
ok('the playbook (for whoever edits the site) is not on the list', !/DECISION_PLAYBOOK/.test(list.stdout));
const table = lint();
const whole = [...table.stdout.matchAll(/^== (\S+)\n[\s\S]*?^whole file \(owner-facing parts\)\s+(\d+)\s+(\d+)/gm)].map((m) => ({ file: m[1], words: +m[2], sentences: +m[3] }));
ok('every owner-facing document gives the tool real text to read (at least 400 words each)', OWNER_DOCS.every((d) => (whole.find((w) => w.file === d) || { words: 0 }).words >= 400), whole.map((w) => w.file + ' ' + w.words).join(', '));
for (const w of whole) info(w.file + ': ' + w.words + ' words in ' + w.sentences + ' sentences');

// ---- the real check: every section, every sentence, every word from the list
const strict = lint('--strict', '--quiet', '--all-problems');
const problems = strict.stdout.split('\n').filter((l) => /^ {2}\S/.test(l));
ok('no owner-facing section is above grade ' + grade + ', no sentence is over ' + longest + ' words, no word from [jargon] is used (' + (strict.status === 0 ? 'all clear' : problems.length + ' problem(s)') + ')', strict.status === 0, problems.slice(0, 6).map((l) => l.trim().slice(0, 190)).join(' || '));
const held = (words.match(/^\S[^\n]* :: [^\n]+$/gm) || []).filter((l) => !/^#/.test(l));
info(held.length + ' sentence(s) are held back on purpose (the [hold] part of tools/plain_words.txt; each is a line that a patch in patches/optional/ carries)');

// ---- the tool still fails when it should (a copy of the files with a bad sentence added)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-plain-'));
const put = (f, text) => { fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true }); fs.writeFileSync(path.join(tmp, f), text); };
const prop = read('docs/PROPOSAL_owner_page.md');
const check = (f, text) => { put(f, text); return lint('--strict', '--quiet', '--root', tmp, f); };
try {
  const same = check('docs/PROPOSAL_owner_page.md', prop);
  ok('a copy of the proposal, unchanged, passes (the check does not fail by itself)', same.status === 0, same.stdout.trim().slice(-200));
  const long45 = 'The farm owner opens the file, finds the setting that she wants to change, types the new words between the quote marks, saves the file, looks at the site on her own screen, and then publishes the change that she made earlier in the same morning.';
  const long = check('docs/PROPOSAL_owner_page.md', prop + '\n\n' + long45 + '\n');
  ok('it fails on a new sentence of ' + long45.split(/\s+/).length + ' words', long.status === 1 && /a sentence of \d+ words/.test(long.stdout), long.stdout.trim().slice(-200));
  const bad = check('docs/PROPOSAL_owner_page.md', prop + '\n\nWe deploy the site with a regex.\n');
  ok('it fails on a new sentence with a word from the [jargon] list (deploy, regex)', bad.status === 1 && /the word "deploy"/.test(bad.stdout) && /the word "regex"/.test(bad.stdout), bad.stdout.trim().slice(-200));
  const quoted = check('docs/PROPOSAL_owner_page.md', prop + '\n\nPress `deploy` or the button called "Deploy site" and read "commit" on the screen.\n');
  ok('it leaves a word in `backticks` or in "double quotes" alone (a file name or a label on a screen is not jargon)', quoted.status === 0, quoted.stdout.trim().slice(-200));
  const readme = read('README.md');
  const gone = check('README.md', readme.replace('There is no build step.', 'There is nothing to build before you upload.'));
  ok('it fails when a [hold] entry no longer matches a sentence (a held line was rewritten: the entry must go)', gone.status === 1 && /matches no sentence/.test(gone.stdout), gone.stdout.trim().slice(-200));
  const renamed = check('README.md', readme.replace('## Day-to-day changes', '## Everyday changes'));
  ok('it fails when a heading named in the tool is renamed in the file', renamed.status === 1 && /no such heading/.test(renamed.stdout), renamed.stdout.trim().slice(-200));
  const hard = check('docs/PROPOSAL_owner_page.md', prop + '\n\n## Appendix\n\n' + 'Notwithstanding administrative considerations, comprehensive organizational infrastructure necessitates extraordinarily sophisticated implementation methodologies. '.repeat(4) + '\n');
  ok('it fails on a section that is harder than grade ' + grade, hard.status === 1 && /grade [\d.]+ is above/.test(hard.stdout), hard.stdout.trim().slice(-200));
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

// ---- registered
ok('tests/README.md lists this test', /`plain-lint`/.test(read('tests/README.md')));
const own = read('tests/plain-lint.test.mjs');
ok('tests/run-all.mjs runs it in its order, and without a browser (it reads the "// order:" and "// browser: no" lines at the top of this file)', /^\/\/ order: \d+/m.test(own) && /^\/\/ browser: no/m.test(own));

await finish({});
