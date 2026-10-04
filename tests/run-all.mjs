#!/usr/bin/env node
/* Runs the site tests one at a time and prints a summary table.
 *
 *   node tests/run-all.mjs                    every test
 *   node tests/run-all.mjs i18n map           only the tests whose name contains one of these words (=map: exactly that test)
 *   node tests/run-all.mjs --quick            the fast tests without a browser, plus a few fast browser tests that cover the main risks
 *   node tests/run-all.mjs --shard 2/4        the 2nd of 4 parts of the list, split by how long each test takes (tests/timings.json)
 *   node tests/run-all.mjs --changed          which tests cover the files you changed (git), and the command to run them (--run runs them)
 *   node tests/run-all.mjs --list             the tests, what they need and how long they usually take
 *   node tests/run-all.mjs --stop             stop at the first test that fails
 *   node tests/run-all.mjs --retry            run a failing test once more; if it then passes it is shown as FLAKY (so a load problem is named, not hidden)
 *   node tests/run-all.mjs --update-timings   after the run, save the seconds of every test that passed in tests/timings.json
 *
 * Nothing about a test is written in this file. Each tests/NAME.test.mjs says in its first lines where it belongs:
 *     // order: 120          where it runs in a full run (small first; a test without a number runs last)
 *     // browser: no         "no" when it does not need Playwright (default: yes)
 *     // quick: yes          part of --quick (default: yes for a test without a browser, no for the others)
 *     // covers: js/live.js, css/*    the files it checks, for --changed ("*" matches anything, a lone "*" every file)
 * so a new test is one new file and edits nothing else but one row of the table in tests/README.md. A test file without these lines still runs.
 *
 * Every test starts its own web server on a free port. Environment: WA_URL, WA_PORT, WA_CHROME, WA_SLOW (see tests/README). */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, axeSource, ms, machine } from './lib.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(DIR);
const TIMINGS = path.join(DIR, 'timings.json');
const FLAGS = ['--list', '--stop', '--quick', '--changed', '--run', '--retry', '--update-timings', '--shard', '--files', '--help'];

/* ---------------------------------------------------------------- the command line */
const argv = process.argv.slice(2), flags = new Set(), words = [];
const opt = { shard: '', ref: '', files: null };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) { words.push(a); continue; }
  const [flag, val] = a.split(/=(.*)/s, 2);
  if (!FLAGS.includes(flag)) { console.log('Unknown option ' + flag + '. The options are: ' + FLAGS.join(' ') + '  (node tests/run-all.mjs --help)'); process.exit(2); }
  if (flag === '--shard') opt.shard = val !== undefined ? val : argv[++i] || '';
  else if (flag === '--files') { flags.add('--changed'); opt.files = (val || '').split(',').map((f) => f.trim()).filter(Boolean); }
  else if (flag === '--changed') { flags.add('--changed'); if (val) opt.ref = val; }
  else flags.add(flag);
}
if (flags.has('--help')) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').match(/\/\*([\s\S]*?)\*\//)[1].replace(/^ \*? ?/gm, '').trim()); process.exit(0); }

/* ---------------------------------------------------------------- the tests and what each says about itself */
function readMeta(file) {
  const src = fs.readFileSync(file, 'utf8');
  // a test file without header lines runs last; it needs a browser when it starts one (run(), launch() or loadPlaywright() from lib.mjs, or a tool that does)
  const m = { order: 1000, browser: /\bawait run\(|\blaunch\(|\bchromium\b|\bloadPlaywright\b|season_calendar/.test(src), quick: null, covers: [], header: false };
  for (const line of src.split('\n').slice(0, 12)) {
    const h = line.match(/^\/\/\s*(order|browser|quick|covers)\s*:\s*(.*?)\s*$/);
    if (!h) continue;
    m.header = true;
    if (h[1] === 'order') m.order = h[2] !== '' && Number.isFinite(+h[2]) ? +h[2] : 1000;
    else if (h[1] === 'covers') m.covers.push(...h[2].split(/[\s,]+/).filter(Boolean));
    else m[h[1]] = /^(yes|true|1)$/i.test(h[2]);
  }
  if (m.quick === null) m.quick = !m.browser;
  return m;
}
const ALL = fs.readdirSync(DIR).filter((f) => f.endsWith('.test.mjs')).map((f) => {
  const name = f.replace(/\.test\.mjs$/, ''), file = path.join(DIR, f);
  const first = (fs.readFileSync(file, 'utf8').replace(/^(\/\/[^\n]*\n)+/, '').match(/\/\*\s*([\s\S]*?)\*\//) || [, ''])[1].replace(/\s*\n\s*\*?\s*/g, ' ').trim();   // the first /* ... */ comment, after the // header lines
  return { name, file, about: first, ...readMeta(file) };
}).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

let timings = {};
try { timings = JSON.parse(fs.readFileSync(TIMINGS, 'utf8')); } catch (e) { /* no timings yet: every test counts the same */ }
const known = Object.entries(timings).filter(([k, v]) => !k.startsWith('_') && typeof v === 'number').map(([, v]) => v).sort((a, b) => a - b);
const median = known.length ? known[Math.floor(known.length / 2)] : 60;
const usual = (t) => (typeof timings[t.name] === 'number' ? timings[t.name] : median);
const dur = (s) => (s < 180 ? Math.round(s) + ' s' : s < 7200 ? (s / 60).toFixed(s < 600 ? 1 : 0) + ' min' : (s / 3600).toFixed(1) + ' h');

const pick = (list, ws) => (ws.length ? list.filter((t) => ws.some((w) => (w.startsWith('=') ? t.name === w.slice(1) : t.name.includes(w)))) : list);
// the shortest command that selects exactly these tests
const commandFor = (list) => 'node tests/run-all.mjs ' + list.map((t) => (pick(ALL, [t.name]).every((x) => list.includes(x)) ? t.name : '=' + t.name)).join(' ');

/* ---------------------------------------------------------------- --changed: which tests cover which files */
const globRe = (p) => new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
function changedFiles() {
  if (opt.files) return opt.files;
  try {
    const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).split('\n').filter(Boolean);
    return [...new Set([...git(['diff', '--name-only', '--relative', opt.ref || 'HEAD']), ...git(['ls-files', '--others', '--exclude-standard'])])]
      .filter((f) => !/^tests\/(node_modules|\.visual)\//.test(f));
  } catch (e) {
    console.log('--changed needs a git folder (' + String(e.message).split('\n')[0] + '). Name the files instead:  node tests/run-all.mjs --files=css/styles.css,js/live.js');
    process.exit(2);
  }
}
function planChanged() {
  const files = changedFiles();
  if (!files.length) { console.log('No file is changed (git status is clean).' + (opt.ref ? '' : ' To compare with an older commit:  node tests/run-all.mjs --changed=main   (or --changed=HEAD~1)')); process.exit(0); }
  const chosen = new Set(), lines = [], unmatched = [];
  for (const f of files) {
    if (/^tests\/(run-all\.mjs|timings\.json)$/.test(f)) continue;   // the runner itself: run  node tests/run-all.mjs runner
    const own = f.match(/^tests\/(.+)\.test\.mjs$/);
    const hits = ALL.filter((t) => (own && own[1] === t.name) || t.covers.some((p) => globRe(p).test(f)));
    if (f === 'tests/lib.mjs') hits.push(...ALL.filter((t) => t.quick));   // every test uses it: the quick set is the practical check
    hits.forEach((t) => chosen.add(t));
    const set = [...new Set(hits)], big = set.filter((t) => t.browser).map((t) => t.name), small = set.filter((t) => !t.browser).map((t) => t.name);
    if (set.length) lines.push(f.padEnd(34) + ' -> ' + (big.join(', ') || '-') + (small.length ? '   [no browser: ' + small.join(', ') + ']' : '')); else unmatched.push(f);
  }
  const list = ALL.filter((t) => chosen.has(t));
  console.log('Changed files: ' + files.length + (opt.ref ? ' (compared with ' + opt.ref + ')' : ' (not yet committed)'));
  lines.forEach((l) => console.log('  ' + l));
  if (unmatched.length) console.log('  No test names these files: ' + unmatched.join(', ') + '\n  (put them in the "covers" line of the test that should check them; until then  node tests/run-all.mjs --quick  is a fair check)');
  if (!list.length) { console.log('\nNo test is listed for these files.'); process.exit(0); }
  if (files.some((f) => /^(css\/|pages\/|lang\/|.*\.html$)/.test(f))) console.log('\nThe look of the pages may have changed too: node tests/visual-check.mjs shows which parts look different (it is not one of the tests; it needs a baseline, see "The visual check" below).');
  console.log('\n' + list.length + ' tests, about ' + dur(list.reduce((a, t) => a + usual(t), 0)) + ' at the times in tests/timings.json:\n  ' + commandFor(list) + '\n  (add --run to this command line to run them now)');
  return list;
}

/* ---------------------------------------------------------------- choosing what to run */
let names = ALL;
if (flags.has('--changed')) { names = planChanged(); if (!flags.has('--run')) process.exit(0); }
if (flags.has('--quick')) names = names.filter((t) => t.quick);
names = pick(names, words);

if (opt.shard) {
  const m = opt.shard.match(/^(\d+)\/(\d+)$/), i = m && +m[1], n = m && +m[2];
  if (!m || i < 1 || i > n) { console.log('--shard wants "i/n", for example --shard 2/4 (the 2nd of 4 parts). Got: ' + opt.shard); process.exit(2); }
  // longest first, each into the part that is shortest so far (the same answer on every computer); inside a part the normal order is kept
  const bins = Array.from({ length: n }, () => ({ sum: 0, list: [] }));
  [...names].sort((a, b) => usual(b) - usual(a) || a.name.localeCompare(b.name)).forEach((t) => { const b = bins.reduce((x, y) => (y.sum < x.sum ? y : x)); b.list.push(t); b.sum += usual(t); });
  console.log('Part ' + i + ' of ' + n + ': ' + bins[i - 1].list.length + ' tests, about ' + dur(bins[i - 1].sum) + ' (all parts: ' + bins.map((b) => dur(b.sum)).join(', ') + ')');
  names = names.filter((t) => bins[i - 1].list.includes(t));
}

if (flags.has('--list')) {
  for (const t of names) console.log(t.name.padEnd(18) + (t.browser ? '[browser] ' : '[no browser] ').padEnd(13) + (t.quick ? 'quick  ' : '       ') + (typeof timings[t.name] === 'number' ? dur(timings[t.name]) : '?').padStart(7) + '  ' + (t.header ? '' : '(no header lines: runs last) ') + t.about.slice(0, 120));
  console.log('\n' + names.length + ' tests, about ' + dur(names.reduce((a, t) => a + usual(t), 0)) + ' in all' + (known.length ? ' (' + String(timings._measured || 'times in tests/timings.json') + ')' : ''));
  process.exit(0);
}
if (!names.length) { console.log('No test matches: ' + [...flags, ...words].join(' ')); process.exit(1); }

/* ---------------------------------------------------------------- running */
const needBrowser = names.some((t) => t.browser);
let playwright = true;
try { await loadPlaywright(); } catch (e) { playwright = false; if (needBrowser) console.log('Playwright is not installed, so the browser tests cannot run.\n  Fix: in the tests folder run  npm install && npx playwright install chromium   (see tests/README)\n'); }
if (!axeSource() && names.some((t) => t.name === 'axe')) console.log('(axe-core is not installed: the accessibility test will be skipped. In the tests folder: npm install)\n');
const mc = machine();
console.log(names.length + ' tests, about ' + dur(names.reduce((a, t) => a + usual(t), 0)) + ' at the times in tests/timings.json.' + (mc.busy ? '  The computer is busy (load ' + mc.load.toFixed(0) + ' on ' + mc.cores + ' cores): waits are made ' + mc.factor + ' times longer.' : '') + '\n');

const LIMIT = Math.min(ms(900000), 2700000);   // no single test may run longer than 15 minutes (longer when the computer is busy: WA_SLOW, at most 45); the slowest, drive, needs about 8 on a busy computer
const results = [];
function runOne(t) {
  return new Promise((resolve) => {
    const t0 = Date.now(), out = [];
    const child = spawn(process.execPath, [t.file], { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => { out.push('\nTIMEOUT: stopped after ' + Math.round(LIMIT / 1000) + ' s'); child.kill('SIGKILL'); }, LIMIT);
    child.stdout.on('data', (d) => out.push(String(d))); child.stderr.on('data', (d) => out.push(String(d)));
    child.on('close', (code) => {
      clearTimeout(timer);
      const text = out.join(''), lines = text.split('\n');
      const sum = text.match(/(\d+) passed, (\d+) failed(?: \(skipped\))?/);
      resolve({ name: t.name, code, secs: (Date.now() - t0) / 1000, passed: sum ? +sum[1] : 0, failed: sum ? +sum[2] : 0, skipped: /^SKIP /m.test(text), crashed: !sum, failLines: lines.filter((l) => l.startsWith('FAIL ')), tail: lines.filter(Boolean).slice(-6), busyNote: /^NOTE: the computer was busy/m.test(text) });
    });
  });
}
const isBad = (r) => !r.skipped && (r.code !== 0 || r.failed > 0 || r.crashed);
const show = (r, label) => {
  const bad = isBad(r);
  console.log(`${label || (bad ? 'FAIL' : r.skipped ? 'SKIP' : 'PASS')}  ${r.name.padEnd(18)} ${r.skipped ? 'skipped' : r.crashed ? 'did not finish (exit code ' + r.code + ')' : r.passed + ' passed' + (r.failed ? ', ' + r.failed + ' FAILED' : '')}  (${Math.round(r.secs)}s)`);
  if (bad) (r.failLines.length ? r.failLines : r.tail).slice(0, 12).forEach((l) => console.log('      ' + l.slice(0, 220)));
};

for (const t of names) {
  if (t.browser && !playwright) { results.push({ name: t.name, skipped: true, passed: 0, failed: 0, secs: 0, why: 'no Playwright' }); console.log(`SKIP  ${t.name.padEnd(18)} (Playwright is not installed)`); continue; }
  process.stdout.write(`...   ${t.name.padEnd(18)} running\r`);
  let r = await runOne(t);
  if (isBad(r) && flags.has('--retry')) {
    show(r, 'FAIL'); console.log('      running ' + t.name + ' once more (--retry) ...');
    const second = await runOne(t);
    second.secs += r.secs; second.firstFailures = r.failLines.length ? r.failLines : r.tail;
    if (!isBad(second)) second.flaky = true;
    r = second;
  }
  results.push(r);
  if (r.flaky) show(r, 'FLAKY'); else show(r);
  if (isBad(r) && flags.has('--stop')) break;
}

/* ---------------------------------------------------------------- the summary */
const failed = results.filter(isBad), flaky = results.filter((r) => r.flaky);
const total = results.reduce((a, r) => a + r.passed, 0), checks = results.reduce((a, r) => a + r.failed, 0), wall = results.reduce((a, r) => a + r.secs, 0);
console.log('\n' + 'Test'.padEnd(18) + 'Result'.padEnd(9) + 'Checks'.padStart(7) + 'Seconds'.padStart(9) + 'Usual'.padStart(8));
for (const r of results) {
  console.log(r.name.padEnd(18) + (r.flaky ? 'FLAKY' : r.skipped ? 'skipped' : isBad(r) ? 'FAILED' : 'passed').padEnd(9) + String(r.passed + r.failed).padStart(7) + r.secs.toFixed(r.secs < 10 ? 1 : 0).padStart(9) + (typeof timings[r.name] === 'number' ? String(timings[r.name]) : '-').padStart(8));
}
console.log('Total'.padEnd(18) + ''.padEnd(9) + String(total + checks).padStart(7) + wall.toFixed(0).padStart(9) + String(Math.round(results.reduce((a, r) => a + (r.skipped ? 0 : usual(r)), 0))).padStart(8) + '   (' + dur(wall) + ')');
console.log(`\n${results.length} test files: ${results.filter((r) => !r.skipped && !isBad(r)).length} passed (${flaky.length} of them only on the second try), ${failed.length} failed, ${results.filter((r) => r.skipped).length} skipped.  Checks: ${total} passed, ${checks} failed.`);
if (flaky.length) { console.log('Flaky (failed once, passed on the second run): ' + flaky.map((r) => r.name).join(', ')); flaky.forEach((r) => (r.firstFailures || []).slice(0, 3).forEach((l) => console.log('      first run: ' + l.slice(0, 200)))); }
if (failed.length) console.log('Failed: ' + failed.map((r) => r.name).join(', '));
const now = machine();
if ((failed.length || flaky.length) && (now.busy || mc.busy || results.some((r) => r.busyNote))) console.log('NOTE: the computer was busy during this run (load ' + Math.max(now.load, mc.load).toFixed(0) + ' on ' + now.cores + ' cores). A failure that does not come back is most likely the load, not the site: run the failed test again on its own (node tests/NAME.test.mjs; WA_SLOW=10 makes every time limit 10 times longer), or use --retry.');

if (flags.has('--update-timings')) {
  const good = results.filter((r) => !r.skipped && !isBad(r) && !r.flaky);
  if (!good.length) console.log('No timings saved: no test passed.');
  else {
    const out = { _note: 'Seconds one test file takes, used by --shard and --quick to balance the work. Written by: node tests/run-all.mjs --update-timings. Never edit by hand.', _measured: new Date().toISOString().slice(0, 10) + ', load ' + now.load.toFixed(0) + ' on ' + now.cores + ' cores' };
    const all = { ...Object.fromEntries(Object.entries(timings).filter(([k, v]) => !k.startsWith('_') && ALL.some((t) => t.name === k))), ...Object.fromEntries(good.map((r) => [r.name, Math.max(1, Math.round(r.secs))])) };
    for (const k of Object.keys(all).sort()) out[k] = all[k];
    fs.writeFileSync(TIMINGS, JSON.stringify(out, null, 2) + '\n');
    console.log('Saved the seconds of ' + good.length + ' tests in tests/timings.json');
  }
}
console.log(failed.length ? 'FAILED' : 'ALL PASSED');
process.exit(failed.length ? 1 : 0);
