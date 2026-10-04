// order: 38
// browser: no
// quick: no
// covers: tools/*.py, tools/serve.py, tools/review_sheet.py, tools/i18n.py, tools/make_deploy_folder.py, tools/make_qr.py, tools/farm_map.py, tools/add_photo.py, tools/launch_check.py, tools/date_phrases.py
/* The tools the owner runs on their own computer meet words and files from other people: pictures, review sheets, saved maps, translations, web addresses,
 * the answers of a web server. This runs  python3 tools/test_safety.py  (needs python3; no browser, no internet; 15 to 40 seconds) and shows one line for
 * each of its checks. Every check builds a HOSTILE input, runs the real tool on a temporary copy of the site and looks at what came out:
 *   serve.py (another site's name in the Host line, ".." in every spelling, links outside the folder, key files, terminal codes, other methods),
 *   review_sheet.py (spreadsheet formulas, markup and placeholders in a correction, huge or booby-trapped files), i18n.py (a translation that adds markup),
 *   make_deploy_folder.py (links and key files), make_qr.py, farm_map.py, add_photo.py, launch_check.py (redirects, gzip bombs, endless answers), date_phrases.py.
 * The page side (what the owner types into js/content.js) is in tests/owner-input.test.mjs. What was tried, found and fixed: docs/TOOLS_SAFETY.md. */
import { spawnSync } from 'node:child_process';
import { ROOT, ok, info, skip, finish } from './lib.mjs';

const PY = process.env.WA_PYTHON || 'python3';
if (spawnSync(PY, ['--version']).status !== 0) skip(`${PY} is not available`);

const r = spawnSync(PY, ['-B', 'tools/test_safety.py', '-v'], { cwd: ROOT, encoding: 'utf8', timeout: 170000, env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONDONTWRITEBYTECODE: '1' } });
const text = (r.stderr || '') + '\n' + (r.stdout || '');
const lines = text.split('\n');
let n = 0;
const seen = [];
for (let i = 0; i < lines.length; i++) {
  const m = /^(test\w+) \(__main__\.(\w+)\.\w+\)(?:\n)?.*?\.\.\. (ok|FAIL|ERROR|skipped.*)$/.exec(lines[i]);
  if (!m) continue;
  n++;
  const [, name, cls, result] = m;
  const words = name.replace(/^test_/, '').replace(/_/g, ' ');
  if (/^skipped/.test(result)) { info(`(${cls}: ${words} was skipped: ${result.replace(/^skipped\s*/, '')})`); continue; }
  seen.push(name);
  ok(`${cls}: ${words}`, result === 'ok', result === 'ok' ? '' : (text.match(new RegExp(`(?:FAIL|ERROR): ${name}[\\s\\S]*?(?=\\n={10,}|\\n-{10,}\\nRan)`)) || [''])[0].split('\n').slice(-6).join(' | ').slice(0, 400));
}
ok('tools/test_safety.py ran to the end and listed its checks', n >= 30 && /\nOK|FAILED/.test(text), `${n} checks found; exit code ${r.status}; ${text.trim().split('\n').slice(-3).join(' | ').slice(0, 200)}`);
ok('python3 tools/test_safety.py ends with OK', r.status === 0, String(r.status));
await finish({});
