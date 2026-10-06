// order: 31
// browser: no
// quick: no
// covers: README.md, docs/*
/* The commands the notes tell a person to type (README.md, docs/*.md, tests/README.md, the printed cheat sheet, the help text of every tool and the
 * "After:" lines of the optional patches): no browser; about a minute (every tool is run once with --help, in a throw-away copy of the site).
 * This runs  python3 tools/check_doc_commands.py  and fails when a command names a tool or test that is not there, an option or a word that the
 * tool does not know, a file that is missing, a place in README that does not exist, or a way of writing a command that fails in Windows cmd or
 * PowerShell (two commands joined with && or ;, a $ inside double quote marks, single quote marks, NAME=value in front, grep, mktemp ...). Nothing
 * the notes show is run, except  tool --help  in a copy. It is also tried on a copy of the notes with mistakes put in on purpose: every one must be found.
 * When it fails: fix the note (never the check), or, if a tool really has the option, make the tool say so in its --help. */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT, ok, info, skip, finish } from './lib.mjs';

const PY = process.env.WA_PYTHON || 'python3';
const probe = spawnSync(PY, ['--version'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) { skip('python3 is not available'); await finish(); process.exit(0); }
const run = (root, args) => spawnSync(PY, [path.join(ROOT, 'tools', 'check_doc_commands.py'), '--root', root, ...args], { cwd: root, encoding: 'utf8', timeout: 600000 });
const said = (r) => (r.stdout || '') + (r.stderr || '');
const check = (name, good, why) => ok(name, good, good ? '' : why);

/* ---- 1. the real notes ---- */
const real = run(ROOT, []);
const out = said(real);
const summary = (out.match(/^(\d+) commands found .*$/m) || [])[0] || '';
const found = Number((summary.match(/^(\d+) commands found/) || [])[1] || 0);
const problems = out.split('\n').filter((l) => /^(BROKEN|WINDOWS) /.test(l));
ok('every command in the notes names a tool, test, option and file that exists, and works in Windows cmd and PowerShell too', real.status === 0 && problems.length === 0,
  problems.slice(0, 6).join(' | ') || out.trim().split('\n').slice(-3).join(' | '));
ok('the check really reads the notes (hundreds of commands found: the finder did not go blind)', found >= 500, summary);
info(summary);

/* ---- 2. a copy of the notes with mistakes in it: each must be found ---- */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-doc-commands-'));
try {
  const copy = path.join(tmp, 'site');
  fs.cpSync(ROOT, copy, { recursive: true, filter: (p) => !/(^|[\\/])(node_modules|\.visual|\.git|__pycache__|deploy|review|assets)([\\/]|$)/.test(path.relative(ROOT, p)) });
  const MISTAKES = [
    ['python3 tools/no_such_tool.py', /tools\/no_such_tool\.py, which is not in the site folder/],
    ['python3 tools/pages.py --no-such-option', /--no-such-option, which tools\/pages\.py does not have/],
    ['python3 tools/i18n.py extarct', /"extarct" after i18n\.py, a word that the tool does not know/],
    ['node tests/run-all.mjs no-such-test-name', /the test "no-such-test-name"/],
    ['python3 tools/serve.py --port 8080 --not-an-option', /--not-an-option, which tools\/serve\.py does not have/],
    ['python3 tools/launch_check.py tools/no-such-file.json', /tools\/no-such-file\.json, which is not in the site folder/],
    ['python3 tools/pages.py && python3 tools/i18n.py extract', /joins commands with &&/],
    ['python3 tools/change_fact.py price "$31" "$32"', /bash and PowerShell read \$ in double quote marks/],
    ["python3 tools/change_fact.py text 'old words' 'new words'", /single quote marks: cmd keeps the quote marks/],
    ['WA_X=1 node tests/docs.test.mjs', /cmd and PowerShell do not read NAME=value/],
    ['curl -sI https://www.example.org/ | grep -i server', /Mac or Linux program|Mac and Linux only/],
  ];
  const RIGHT = ['python3 tools/make_deploy_folder.py --out deploy', 'python3 tools/i18n.py missing es --list', 'node tests/run-all.mjs consistency', "python3 tools/change_fact.py price '$31' '$32'"];
  fs.appendFileSync(path.join(copy, 'README.md'), '\n```\n' + MISTAKES.map(([c]) => c).concat(RIGHT).join('\n') + '\n```\n\nSee README, "A place that is not there at all" for more.\n');
  const kit = path.join(copy, 'docs', 'NOTICE_KIT.md');
  fs.writeFileSync(kit, fs.readFileSync(kit, 'utf8').replace(/On Windows type[^\n]*?\(README, "Commands on Windows, Mac and Linux"\)\. /, ''));
  const bad = run(copy, ['--no-help']);
  const text = said(bad);
  check('with mistakes put in on purpose the check says so (exit code 1)', bad.status === 1, 'exit code ' + bad.status);
  for (const [cmd, why] of MISTAKES) check('found: ' + cmd, why.test(text), 'not named in the output');
  check('found: a README place that is not there ("A place that is not there at all")', /points to the README place "A place that is not there at all"/.test(text), 'not named');
  check('found: a note for the owner that says python3 and never says what to type on Windows', /NOTICE_KIT\.md[^\n]*\n\s+-> tells the owner to type python3 but never says what to type on Windows/.test(text), 'not named');
  const falseAlarms = text.split('\n').filter((l) => /^(BROKEN|WINDOWS) +README\.md/.test(l) && RIGHT.some((c) => l.includes(c)));
  check('correct commands next to the wrong ones are not reported', falseAlarms.length === 0, falseAlarms.join(' | '));
  // the copy without the mistakes is clean again
  fs.copyFileSync(path.join(ROOT, 'README.md'), path.join(copy, 'README.md'));
  fs.copyFileSync(path.join(ROOT, 'docs', 'NOTICE_KIT.md'), kit);
  const clean = run(copy, ['--no-help']);
  check('the copy without the mistakes is clean', clean.status === 0, said(clean).trim().split('\n').slice(0, 3).join(' | '));

  // a tool that does its work instead of showing --help is named (on a tiny site of its own, so every tool is not run again)
  const tiny = path.join(tmp, 'tiny');
  for (const d of ['docs', 'tools', 'tests', 'patches/optional', 'print']) fs.mkdirSync(path.join(tiny, d), { recursive: true });
  fs.writeFileSync(path.join(tiny, 'README.md'), '# A tiny site\n\nRun `python3 tools/fake.py` to make the thing.\n');
  fs.writeFileSync(path.join(tiny, 'tools', 'fake.py'), '"""Makes the thing."""\nprint("did the work")\n');
  const noHelp = run(tiny, []);
  check('a tool that does its work instead of showing --help is named', /tools\/fake\.py does not show its help/.test(said(noHelp)), said(noHelp).trim().split('\n').slice(0, 3).join(' | '));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
await finish();
