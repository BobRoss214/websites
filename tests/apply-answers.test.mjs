// order: 79
// browser: no
// quick: no
// covers: tools/apply_answers.py, tools/apply_answers_rules.json, tools/simulate_answers.py, tools/test_apply_answers.py, tools/rehearse_answers.py, tools/rehearse_answers.json, docs/DECISION_PLAYBOOK.md
/* The answers runner (tools/apply_answers.py): it turns the farm owner's answers (the export of the dashboard) into the file changes of the playbook, tries them on a
 * copy of the site, and writes a report and a patch. This runs  python3 tools/test_apply_answers.py  (needs python3, Node and git; no browser, no internet) and shows one
 * line for each check: every shape of answers file, the match of the owner's words to an option, the owner's own values, "I will send ..." answers (applied to nothing),
 * contradictory answers (refused), the order of dependent answers, a recipe that cannot be applied, a red check that names its answer, and --in-place (only when clean and green).
 * Two whole runs happen on a copy of the site, so it takes one to four minutes on a busy computer; your own files are never touched. Read docs/APPLY_ANSWERS.md. */
import { spawnSync } from 'node:child_process';
import { ROOT, ok, info, skip, finish } from './lib.mjs';

const PY = process.env.WA_PYTHON || 'python3';
if (spawnSync(PY, ['--version']).status !== 0) skip(`${PY} is not available`);
if (spawnSync('node', ['--version']).status !== 0) skip('Node is not available');
if (spawnSync('git', ['--version']).status !== 0) skip('git is not available');

const r = spawnSync(PY, ['-B', '-W', 'ignore', 'tools/test_apply_answers.py', '-v'], { cwd: ROOT, encoding: 'utf8', timeout: 560000, env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONDONTWRITEBYTECODE: '1' } });
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
ok('tools/test_apply_answers.py ran to the end and listed its checks', n >= 30 && /\nOK|FAILED/.test(text), `${n} checks found; exit code ${r.status}; ${text.trim().split('\n').slice(-3).join(' | ').slice(0, 200)}`);
ok('python3 tools/test_apply_answers.py ends with OK', r.status === 0, String(r.status));
await finish({});
