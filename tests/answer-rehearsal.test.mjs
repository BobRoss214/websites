// order: 78
// browser: no
// quick: no
// covers: docs/DECISION_PLAYBOOK.md, tools/rehearse_answers.py, tools/rehearse_answers.json, *.html, pages/*, js/content.js, js/season.js, lang/src/*, tests/consistency.test.mjs
/* The steps the playbook gives for the owner's answers still work. tools/rehearse_answers.py replays an answer on a throw-away copy of the site: it
 * follows the steps of docs/DECISION_PLAYBOOK.md (open the file, find the place the playbook names, change the words), then runs the standard steps
 * (pages.py, i18n extract / jsstrings / build, "missing" = 0 in four languages) and the checks. The full replay of all answers takes an hour or more
 * (python3 tools/rehearse_answers.py --all, see docs/ANSWER_REHEARSAL.md), so this test does the quick part, in under a minute, no browser:
 *   - every answer of the playbook (dNN=X) is either replayed or has a reason why not (the playbook changed? a new answer needs a replay or a reason);
 *   - every step of every replay still finds its place in the files, as often as the playbook says (a note about a place that moved fails here
 *     before it fails on the owner's day);
 *   - one whole replay with the rebuild runs: the steps, python3 tools/pages.py, the translations, "missing" = 0;
 *   - the tool leaves the site folder alone (the folder is the same before and after) and cleans up its temporary copies.
 * When it fails: fix the playbook words (or the file the playbook names), then the recipe in tools/rehearse_answers.json if the place really moved. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { ROOT, ok, info, skip, finish } from './lib.mjs';

const PY = process.env.WA_PYTHON || 'python3';
if (spawnSync(PY, ['--version']).status !== 0) skip('python3 is not installed');
const TOOL = path.join(ROOT, 'tools', 'rehearse_answers.py');
const MYTMP = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-rehearse-test-'));   // the tool makes its copies in here, so another run on the same machine cannot be counted by mistake
const run = (...args) => spawnSync(PY, [TOOL, ...args], { encoding: 'utf8', timeout: 240000, cwd: ROOT, env: { ...process.env, TMPDIR: MYTMP } });
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const digest = () => crypto.createHash('sha1').update(['index.html', 'js/content.js', 'README.md', 'docs/DECISION_PLAYBOOK.md', 'lang/src/es.json'].map(read).join('\u0000')).digest('hex');
const temps = () => fs.readdirSync(MYTMP).filter((n) => n.startsWith('wa-rehearse-')).length;

ok('tools/rehearse_answers.py and tools/rehearse_answers.json exist', fs.existsSync(TOOL) && fs.existsSync(path.join(ROOT, 'tools', 'rehearse_answers.json')));
const recipes = JSON.parse(read('tools/rehearse_answers.json'));
const skipped = recipes._skipped || {};
const keys = Object.keys(recipes).filter((k) => !k.startsWith('_'));
ok('every answer has a short line saying what it does, and every skipped answer a reason', keys.every((k) => (recipes[k].what || '').length > 10) && Object.values(skipped).every((r) => r.length > 10), keys.filter((k) => !(recipes[k].what || '').length).join(', '));

const before = digest(), tmpBefore = temps(), t0 = Date.now();
const cov = run('--coverage');
ok('every answer of the playbook is replayed or has a reason not to be (' + (cov.stdout.split('\n')[0] || cov.stderr.slice(0, 120)) + ')', cov.status === 0, cov.stdout.split('\n').slice(1, 4).join(' | '));

const steps = run('--steps-only', '--all', '--jobs', '4');
const wrong = steps.stdout.split('\n').filter((l) => /WRONG STEP|PROBLEM/.test(l)).map((l) => l.trim());
ok('every step of the ' + keys.length + ' replays still finds its place in the files, as often as the playbook says', steps.status === 0 && wrong.length === 0 && new RegExp(keys.length + ' answer\\(s\\) replayed').test(steps.stdout), wrong.slice(0, 4).join(' | ') || steps.stderr.slice(0, 200));

const one = run('--quick', 'd20=B');
ok('one whole replay (d20=B, pizza ready time) works: the steps, the rebuild, the translations, "missing" is 0 in es, hi, zh and vi', one.status === 0 && /d20=B\s+pass/.test(one.stdout), one.stdout.trim().split('\n').slice(0, 4).join(' | ') || one.stderr.slice(0, 200));

ok('the site folder is the same after the replays (nothing was written there), and no temporary copy was left behind', digest() === before && temps() === tmpBefore, 'temporary folders left: ' + (temps() - tmpBefore));
info('replayed in ' + Math.round((Date.now() - t0) / 1000) + ' seconds');
ok('tests/README.md lists this test and its first lines say it needs no browser (tests/run-all.mjs reads them)', /`answer-rehearsal`/.test(read('tests/README.md')) && /^\/\/ browser: no$/m.test(read('tests/answer-rehearsal.test.mjs')));

fs.rmSync(MYTMP, { recursive: true, force: true });
await finish({});
