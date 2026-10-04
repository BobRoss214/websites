// order: 5
// browser: no
// quick: yes
// covers: tests/run-all.mjs, tests/lib.mjs, tests/timings.json, tests/*.test.mjs
/* The test runner itself (tests/run-all.mjs; no browser, a few seconds): it is run on a temporary folder of small pretend tests, so every answer is known.
 * Checks that the order, "no browser", --quick and "covers" are read from the first lines of each test file, that a test without those lines still runs
 * (last), that words pick tests (substring, or =name for exactly one), that --shard splits the list into parts that together are the whole list and are
 * about equally long, that --changed names the tests that cover a file and prints a command that selects exactly them, that the summary table, --stop,
 * --retry (a pass on the second try is called FLAKY) and --update-timings work, and that a wrong option is refused. Then, on the real tests: every
 * "covers" line names files that exist (a renamed file leaves a stale line), and a test that says "browser: no" does not start a browser. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ok as libOk, finish, ROOT } from './lib.mjs';
const ok = (name, good, detail = '') => libOk(name, good, good ? '' : detail);   // what was seen is shown only when a check fails

const REAL = path.join(ROOT, 'tests');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-runner-'));
const put = (name, text) => fs.writeFileSync(path.join(tmp, name), text);
const pass = (n) => `console.log('PASS something');\nconsole.log('\\n${n} passed, 0 failed');\nconsole.log('ALL PASSED');\n`;
fs.copyFileSync(path.join(REAL, 'run-all.mjs'), path.join(tmp, 'run-all.mjs'));
fs.copyFileSync(path.join(REAL, 'lib.mjs'), path.join(tmp, 'lib.mjs'));
put('b-late.test.mjs', '// order: 30\n// browser: no\n// quick: no\n// covers: js/live.js\n/* the third one */\n' + pass(2));
put('a-first.test.mjs', '// order: 10\n// browser: no\n// covers: css/*, tools/pages.py\n/* the first one */\n' + pass(3));
put('c-browser.test.mjs', '// order: 20\n// browser: yes\n// quick: yes\n// covers: css/*\n/* needs a browser */\nimport { run } from "./lib.mjs";\n' + pass(1));
put('d-browser2.test.mjs', '// order: 25\n// browser: yes\n// covers: *.html\n/* needs a browser, not in --quick */\n' + pass(1));
put('e-nohead.test.mjs', '/* no header lines at all */\nimport { ok, finish } from "./lib.mjs";\n' + pass(4));
put('f-flaky.test.mjs', `// order: 40\n// browser: no\n// covers: js/flaky.js\n/* fails the first time only */\nimport fs from 'node:fs';\nconst m = new URL('./flaky.marker', import.meta.url);\nif (!fs.existsSync(m)) { fs.writeFileSync(m, 'x'); console.log('FAIL the first time'); console.log('\\n0 passed, 1 failed'); process.exit(1); }\n` + pass(5));
put('g-broken.test.mjs', "// order: 50\n// browser: no\n// covers: js/broken.js\n/* always fails */\nconsole.log('FAIL always');\nconsole.log('\\n0 passed, 1 failed');\nprocess.exit(1);\n");
put('timings.json', JSON.stringify({ _note: 'x', 'a-first': 100, 'b-late': 90, 'c-browser': 50, 'd-browser2': 40, 'e-nohead': 10, 'f-flaky': 5, 'g-broken': 5 }));

const run = (...args) => { const r = spawnSync(process.execPath, [path.join(tmp, 'run-all.mjs'), ...args], { encoding: 'utf8', env: { ...process.env, WA_SLOW: '1' }, timeout: 120000 }); return { code: r.status, out: String(r.stdout) + String(r.stderr) }; };
const listed = (out) => out.split('\n').filter((l) => /^[a-z]-[a-z0-9]+ /.test(l)).map((l) => l.split(' ')[0]);

// ---- the list: order, kinds, quick
let r = run('--list');
ok('--list: tests run in the order of their "// order:" lines; a test without lines comes last', listed(r.out).join() === 'a-first,c-browser,d-browser2,b-late,f-flaky,g-broken,e-nohead', listed(r.out).join());
ok('--list: "// browser: no" is shown as "no browser", a test without lines is guessed from its code, and says it has no header lines', /^a-first +\[no browser\]/m.test(r.out) && /^c-browser +\[browser\]/m.test(r.out) && /^e-nohead +\[no browser\] .*no header lines/m.test(r.out), r.out.slice(0, 300));
ok('--list: the seconds come from timings.json', /^a-first .* 100 s /m.test(r.out), r.out.split('\n')[0]);
r = run('--quick', '--list');
ok('--quick: the tests without a browser, except one that says "quick: no", plus a browser test that says "quick: yes"', listed(r.out).join() === 'a-first,c-browser,f-flaky,g-broken,e-nohead', listed(r.out).join());

// ---- words
ok('a word picks every test whose name contains it', listed(run('browser', '--list').out).join() === 'c-browser,d-browser2');
ok('=name picks exactly that test', listed(run('=c-browser', '--list').out).join() === 'c-browser' && listed(run('=c-brows', '--list').out).length === 0);
r = run('nothing-like-this');
ok('a word that matches no test says so and exits with 1', r.code === 1 && /No test matches/.test(r.out), r.out.slice(0, 100));
r = run('--no-such-option');
ok('an option that does not exist is refused (exit code 2) with the list of options', r.code === 2 && /Unknown option --no-such-option/.test(r.out) && /--shard/.test(r.out), r.out.slice(0, 120));

// ---- shards
const parts = [1, 2, 3].map((i) => listed(run('--shard', i + '/3', '--list').out));
const flat = parts.flat();
ok('--shard i/3: the three parts together are every test, none twice', flat.length === 7 && new Set(flat).size === 7, JSON.stringify(parts));
const sums = parts.map((p) => p.reduce((a, n) => a + ({ 'a-first': 100, 'b-late': 90, 'c-browser': 50, 'd-browser2': 40, 'e-nohead': 10, 'f-flaky': 5, 'g-broken': 5 }[n]), 0));
ok('--shard: the parts are about equally long by timings.json (here about 100 seconds each)', Math.max(...sums) - Math.min(...sums) <= 15, sums.join(', '));
ok('--shard: the same answer every time', JSON.stringify(parts) === JSON.stringify([1, 2, 3].map((i) => listed(run('--shard=' + i + '/3', '--list').out))));
ok('--shard 4/3 and --shard x are refused', run('--shard', '4/3').code === 2 && run('--shard', 'x').code === 2);
ok('--shard together with --quick splits only the quick tests', [1, 2].flatMap((i) => listed(run('--quick', '--shard', i + '/2', '--list').out)).sort().join() === 'a-first,c-browser,e-nohead,f-flaky,g-broken');

// ---- --changed
r = run('--files=css/styles.css');
const cmd = (r.out.match(/^ {2}(node tests\/run-all\.mjs .*)$/m) || [])[1] || '';
ok('--changed (named files): a css file leads to the tests that list css/*, with their names on the line of the file', /css\/styles\.css +-> c-browser +\[no browser: a-first\]/.test(r.out) && !/b-late/.test(r.out.split('\n').filter((l) => /->/.test(l)).join()), r.out.slice(0, 300));
ok('--changed prints the command to run them and does not run anything', cmd === 'node tests/run-all.mjs a-first c-browser' && !/passed/.test(r.out) && r.code === 0, cmd);
ok('--changed: the printed command picks exactly those tests', listed(run(...cmd.split(" ").slice(2), '--list').out).join() === 'a-first,c-browser', cmd);
r = run('--files=tests/b-late.test.mjs,README.md,js/flaky.js');
ok('--changed: a test file leads to itself, a file nobody lists is reported', /b-late\.test\.mjs +-> .*b-late/.test(r.out) && /js\/flaky\.js +-> .*f-flaky/.test(r.out) && /No test names these files: README\.md/.test(r.out), r.out.slice(0, 400));
r = run('--files=index.html');
ok('--changed: a "*" in covers matches any characters (*.html matches index.html)', /index\.html +-> d-browser2/.test(r.out), r.out.slice(0, 200));
ok('--changed --run runs them', /PASS +a-first/.test(run('--files=tools/pages.py', '--run').out));

// ---- a real run
r = run('a-first', 'e-nohead');
ok('a run prints one line per test, then a table with the seconds and a total, and ends with ALL PASSED (exit 0)', r.code === 0 && /^Test +Result +Checks +Seconds +Usual/m.test(r.out) && /^a-first +passed +3 /m.test(r.out) && /^e-nohead +passed +4 /m.test(r.out) && /^Total +7 /m.test(r.out) && /ALL PASSED/.test(r.out) && /Checks: 7 passed, 0 failed/.test(r.out), r.out.slice(-500));
r = run('g-broken', 'a-first');
ok('a failing test is shown with its FAIL line, the run says FAILED and exits with 1', r.code === 1 && /^FAIL +g-broken/m.test(r.out) && /FAIL always/.test(r.out) && /^FAILED$/m.test(r.out) && /Failed: g-broken/.test(r.out), r.out.slice(-400));
r = run('--stop', 'g-broken', 'e-nohead');
ok('--stop ends the run at the first test that fails (the test after it is not run)', /^FAIL +g-broken/m.test(r.out) && !/e-nohead/.test(r.out) && r.code === 1, r.out.slice(-300));
r = run('f-flaky');
ok('without --retry a test that fails once is a failure', r.code === 1 && /^FAIL +f-flaky/m.test(r.out));
fs.rmSync(path.join(tmp, 'flaky.marker'), { force: true });
r = run('f-flaky', '--retry');
ok('--retry: a test that passes the second time is called FLAKY with its first failure, and does not fail the run (exit 0)', r.code === 0 && /^FLAKY +f-flaky/m.test(r.out) && /first run: FAIL the first time/.test(r.out) && /ALL PASSED/.test(r.out), r.out.slice(-500));
fs.rmSync(path.join(tmp, 'flaky.marker'), { force: true });
r = run('--update-timings', 'a-first', 'g-broken', 'f-flaky');
const saved = JSON.parse(fs.readFileSync(path.join(tmp, 'timings.json'), 'utf8'));
ok('--update-timings saves the seconds of the tests that passed, keeps the others and the notes', typeof saved['a-first'] === 'number' && saved['a-first'] < 50 && saved['b-late'] === 90 && saved['g-broken'] === 5 && typeof saved._measured === 'string', JSON.stringify(saved).slice(0, 300));

// ---- the real tests
const files = [];
(function walk(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { if (['node_modules', '.git', '.visual'].includes(e.name)) continue; const f = path.join(dir, e.name); if (e.isDirectory()) walk(f); else files.push(path.relative(ROOT, f).split(path.sep).join('/')); } })(ROOT);
const globRe = (p) => new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
const staleCovers = (headers) => Object.entries(headers).flatMap(([name, pats]) => pats.filter((p) => !files.some((f) => globRe(p).test(f))).map((p) => name + ': ' + p));
const header = (src) => { const h = { covers: [], browser: null }; for (const l of src.split('\n').slice(0, 12)) { const m = l.match(/^\/\/\s*(covers|browser)\s*:\s*(.*?)\s*$/); if (m && m[1] === 'covers') h.covers.push(...m[2].split(/[\s,]+/).filter(Boolean)); else if (m) h.browser = m[2]; } return h; };
ok('(the stale-pattern check, tried on a pretend header) a pattern that matches no file is found', staleCovers({ x: ['css/*', 'js/no-such-file.js'] }).join() === 'x: js/no-such-file.js');
const real = Object.fromEntries(fs.readdirSync(REAL).filter((f) => f.endsWith('.test.mjs')).map((f) => [f.replace('.test.mjs', ''), header(fs.readFileSync(path.join(REAL, f), 'utf8'))]));
ok('every "// covers:" line in tests/*.test.mjs names files that exist (a stale one means a file was renamed or deleted: change the line)', staleCovers(Object.fromEntries(Object.entries(real).map(([n, h]) => [n, h.covers]))).length === 0, staleCovers(Object.fromEntries(Object.entries(real).map(([n, h]) => [n, h.covers]))).join('; '));
const liars = Object.entries(real).filter(([n, h]) => n !== 'runner' && h.browser === 'no' && /\bawait run\(|\blaunch\(|\bchromium\b/.test(fs.readFileSync(path.join(REAL, n + '.test.mjs'), 'utf8').replace(/^\/\/[^\n]*\n/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''))).map(([n]) => n);
ok('a test that says "// browser: no" does not start a browser (the run would then not skip it when Playwright is missing)', liars.length === 0, liars.join(', '));
let t = {}; try { t = JSON.parse(fs.readFileSync(path.join(REAL, 'timings.json'), 'utf8')); } catch (e) { t = null; }
ok('tests/timings.json is valid and holds only numbers of seconds (besides its notes)', !!t && Object.entries(t).every(([k, v]) => k.startsWith('_') || (typeof v === 'number' && v > 0)), t ? '' : 'it does not parse');

fs.rmSync(tmp, { recursive: true, force: true });
await finish({});
