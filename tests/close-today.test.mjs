// order: 39
// browser: no
// quick: no
// covers: tools/close_today.py, tools/notice_phrases.json, tools/test_close_today.py, js/content.js
/* The same-day closure tool (tools/close_today.py): one safe command that closes a day in js/content.js and writes the notice in five languages.
 * This runs  python3 tools/test_close_today.py  (needs python3 and Node; no browser, no internet; 20 to 50 seconds) and shows one line for each check.
 * It works on temporary copies of the files the tool uses; your own js/content.js is never touched. What the browser sees after a closure
 * (badges, bar, Reserve links, pizza chip, --undo leaves the page identical) is step S1 of tools/year_rehearsal.mjs (the year-rehearsal test). */
import { spawnSync } from 'node:child_process';
import { ROOT, ok, info, skip, finish } from './lib.mjs';

const PY = process.env.WA_PYTHON || 'python3';
if (spawnSync(PY, ['--version']).status !== 0) skip(`${PY} is not available`);
if (spawnSync('node', ['--version']).status !== 0) skip('Node is not available');

const r = spawnSync(PY, ['-B', 'tools/test_close_today.py', '-v'], { cwd: ROOT, encoding: 'utf8', timeout: 170000, env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONDONTWRITEBYTECODE: '1' } });
const text = (r.stderr || '') + '\n' + (r.stdout || '');
let n = 0;
for (const line of text.split('\n')) {
  const m = /^(test\w+) \(__main__\.(\w+)\.\w+\)(?:\n)?.*?\.\.\. (ok|FAIL|ERROR|skipped.*)$/.exec(line);
  if (!m) continue;
  n++;
  const [, name, , result] = m;
  const words = name.replace(/^test_/, '').replace(/_/g, ' ');
  if (/^skipped/.test(result)) { info(`(${words} was skipped: ${result})`); continue; }
  ok(words, result === 'ok', result === 'ok' ? '' : (text.match(new RegExp(`(?:FAIL|ERROR): ${name}[\\s\\S]*?(?=\\n={10,}|\\n-{10,}\\nRan)`)) || [''])[0].split('\n').slice(-6).join(' | ').slice(0, 400));
}
ok('tools/test_close_today.py ran to the end and listed its checks', n >= 15 && /\nOK|FAILED/.test(text), `${n} checks found; exit code ${r.status}; ${text.trim().split('\n').slice(-3).join(' | ').slice(0, 200)}`);
ok('python3 tools/test_close_today.py ends with OK', r.status === 0, String(r.status));
await finish({});
