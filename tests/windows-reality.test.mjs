// order: 55
// browser: no
// quick: no
// covers: tools/*, README.md, docs/LAUNCH_CHECKLIST.md
/* The owner's Python tools on a Windows (or Mac) computer, as far as this computer can pretend to be one (no browser; 30 seconds on an idle computer, up to two minutes on a busy one):
 *   - an old console code page: the tools are run with their output in cp1252, cp437 and plain ASCII; none may stop with a Python error, and a text
 *     a person has to paste back into a file (a translation key) stays exact (a \uXXXX escape means the same letter)
 *   - Windows checkouts and editors: the whole site with Windows line endings (what `git config core.autocrlf true` gives) and with the invisible marker
 *     Notepad's "UTF-8" adds (BOM): the rebuild gives the same files apart from the line endings and the marker, and deploy/ is exactly the same
 *     (the same fingerprint in FILES.txt) as from a Unix checkout
 *   - a file saved in the old "ANSI" format stops the tool with a message that names the file and the line (not a Python error, and not "index.html is
 *     missing a part"); a file that is read-only says so plainly
 *   - a folder with spaces and accents (My Site (copy)/José Pérez), tools started from another folder, serve.py asked for a missing file whose name the
 *     console cannot show, a PATH with nothing but Python on it (no node, git or curl)
 *   - every tool parses as Python 3.8 and uses nothing newer from the library (and runs with python3.8 or 3.9 when one is found: WA_PYTHON38)
 *   - the docs: the section for Windows, no commands joined with && or ;, and tools/serve.bat written so that it works with any line endings
 * What cannot be pretended here (read, not run): the real Windows console, OneDrive locking a file, the 260-letter path limit, SO_REUSEADDR sharing a
 * port, a double-click on the .bat, a case-insensitive disk. Everything happens in temporary copies; your files are not touched. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { ROOT, ok, info, skip, finish } from './lib.mjs';

const PY = process.env.WA_PYTHON || 'python3';
const probe = (exe, code) => spawnSync(exe, ['-c', code], { encoding: 'utf8' }).status === 0;
if (!probe(PY, 'import bs4')) skip(`${PY} with beautifulsoup4 is not available (pip install beautifulsoup4)`);
const hasPillow = probe(PY, 'import PIL'), hasSegno = probe(PY, 'import segno');
const EXE = spawnSync(PY, ['-c', 'import sys; print(sys.executable)'], { encoding: 'utf8' }).stdout.trim() || PY;
const posix = process.platform !== 'win32';

const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-windows-'));
try { fs.chmodSync(SCRATCH, 0o755); } catch (e) { /* Windows */ }

/* ------------------------------------------------------------------ copies of the site */
const LEFT_OUT = /(^|[\\/])(\.git|node_modules|tests|docs|deploy|__pycache__|\.visual)([\\/]|$)/;
const BASE = path.join(SCRATCH, 'base');
fs.cpSync(ROOT, BASE, { recursive: true, filter: (src) => !LEFT_OUT.test(path.relative(ROOT, src)) });
const clone = (name) => { const dest = path.join(SCRATCH, name); fs.cpSync(BASE, dest, { recursive: true }); return dest; };
const files = (dir) => { const out = []; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (e.name !== '__pycache__' && e.name !== 'deploy') walk(p); } else out.push(path.relative(dir, p).split(path.sep).join('/')); } })(dir); return out.sort(); };
const isText = (rel) => /(\.(html|css|js|mjs|json|svg|txt|xml|webmanifest|md|py|bat)|^_headers)$/.test(path.posix.basename(rel));
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const rewrite = (dir, fn) => { for (const rel of files(dir)) if (isText(rel)) { const p = path.join(dir, rel); const n = fn(rel, fs.readFileSync(p)); if (n) fs.writeFileSync(p, n); } };
const toCrlf = (dir) => rewrite(dir, (rel, b) => Buffer.from(b.toString('latin1').replace(/\r?\n/g, '\r\n'), 'latin1'));
const NOTEPAD_EDITS = /^(index\.html|pages\/[^/]+\.html|js\/content\.js|lang\/src\/[^/]+\.json|tools\/(qr_links|saved-map)\.json)$/;   // what a person opens and saves
const addBom = (dir) => rewrite(dir, (rel, b) => (NOTEPAD_EDITS.test(rel) && !b.subarray(0, 3).equals(BOM) ? Buffer.concat([BOM, b]) : null));
const addBomTo = (dir, rels) => { for (const rel of rels) { const p = path.join(dir, rel); const b = fs.readFileSync(p); if (!b.subarray(0, 3).equals(BOM)) fs.writeFileSync(p, Buffer.concat([BOM, b])); } };
/** A fingerprint of every file that ignores the two things a Windows editor changes: the line endings and the BOM. */
const digest = (dir) => Object.fromEntries(files(dir).map((rel) => {
  let b = fs.readFileSync(path.join(dir, rel));
  if (isText(rel)) { if (b.subarray(0, 3).equals(BOM)) b = b.subarray(3); b = Buffer.from(b.toString('latin1').replace(/\r\n/g, '\n'), 'latin1'); }
  return [rel, crypto.createHash('sha1').update(b).digest('hex')];
}));
const differ = (a, b) => Object.keys({ ...a, ...b }).filter((k) => a[k] !== b[k]);

/* ------------------------------------------------------------------ running a tool */
const NOISE = ['PYTHONIOENCODING', 'PYTHONUTF8', 'LC_ALL', 'LANG', 'LC_CTYPE', 'PYTHONCOERCECLOCALE', 'PYTHONLEGACYWINDOWSSTDIO'];
const envOf = (extra = {}, pathVar = null) => { const e = { ...process.env }; for (const k of NOISE) delete e[k]; if (pathVar) e.PATH = pathVar; return { ...e, ...extra }; };
const CONSOLES = {
  cp1252: { PYTHONIOENCODING: 'cp1252', PYTHONUTF8: '0' },        // a Western Windows window, or output sent to a file or a pipe
  cp437: { PYTHONIOENCODING: 'cp437', PYTHONUTF8: '0' },          // the old DOS code page
  ascii: { LC_ALL: 'C', LANG: 'C', PYTHONCOERCECLOCALE: '0', PYTHONUTF8: '0' },   // a shell with no language set
};
/** Runs python with these arguments; resolves { code, out, err } (the text read as latin1, so every byte is kept). */
const exec = (cwd, args, env = envOf(), exe = EXE, timeout = 170000) => new Promise((resolve) => {
  const out = [], err = [];
  const p = spawn(exe, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  p.stdout.on('data', (d) => out.push(d)); p.stderr.on('data', (d) => err.push(d));
  const timer = setTimeout(() => p.kill(), timeout);
  p.on('error', (e) => { clearTimeout(timer); resolve({ code: -1, out: '', err: String(e) }); });
  p.on('close', (code) => { clearTimeout(timer); resolve({ code, out: Buffer.concat(out).toString('latin1'), err: Buffer.concat(err).toString('latin1') }); });
});
const all = (r) => r.out + r.err;
const PYERR = /Traceback|UnicodeEncodeError|UnicodeDecodeError/;
const clean = (r) => r.code === 0 && !PYERR.test(all(r));
const lastLine = (r) => all(r).trim().split('\n').slice(-2).join(' | ').slice(0, 220);
const cp1252 = (s) => new TextDecoder('windows-1252').decode(Buffer.from(s, 'latin1'));
const unescapeU = (s) => s.replace(/\\u([0-9a-fA-F]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
const verdict = (ok_, why) => ({ code: ok_ ? 0 : 1, out: '', err: ok_ ? '' : why });

// a PATH with nothing but Python on it: no node, git or curl (what a bare Windows computer has)
let BARE = null;
if (posix) { BARE = path.join(SCRATCH, 'bin'); fs.mkdirSync(BARE); for (const n of ['python3', 'python']) fs.symlinkSync(EXE, path.join(BARE, n)); }

// a picture with an accent and a space in its name, for add_photo
let PICTURE = null;
if (hasPillow) {
  fs.mkdirSync(path.join(SCRATCH, 'Fotos Jos\u00e9'));
  PICTURE = path.join(SCRATCH, 'Fotos Jos\u00e9', 'Cabra con gorro \u00f1.jpg');
  spawnSync(EXE, ['-c', 'import sys; from PIL import Image; im = Image.new("RGB", (900, 600), (40, 120, 60)); im.paste((220, 200, 40), (100, 100, 500, 400)); im.save(sys.argv[1], "JPEG")', PICTURE]);
}
const ALT = 'A goat wearing a \u201cgreen\u201d hat \u2014 tr\u00e8s mignon';

/* ------------------------------------------------------------------ 1. every tool under an old console */
async function consoleChain(label, extra, full) {
  const dir = clone('console-' + label);
  const env = envOf(extra, BARE);
  const cmds = [
    ['i18n.py dump hi 0 5', ['tools/i18n.py', 'dump', 'hi', '0', '5']],
    ['check_facts.py', ['tools/check_facts.py']],
    ['farm_map.py', ['tools/farm_map.py', 'tools/saved-map.json']],
  ];
  if (full) {
    cmds.unshift(['pages.py', ['tools/pages.py']], ['i18n.py extract', ['tools/i18n.py', 'extract']], ['i18n.py jsstrings', ['tools/i18n.py', 'jsstrings']], ['i18n.py build', ['tools/i18n.py', 'build']],
      ['i18n.py missing hi --list', ['tools/i18n.py', 'missing', 'hi', '--list']], ['i18n.py missing zh --list', ['tools/i18n.py', 'missing', 'zh', '--list']]);
    cmds.push(['check_facts.py --short', ['tools/check_facts.py', '--short']], ['launch_check.py --help', ['tools/launch_check.py', '--help']]);
    if (hasSegno) cmds.push(['make_qr.py', ['tools/make_qr.py']]);
  }
  const res = [];
  for (const [name, args] of cmds) res.push([name, await exec(dir, args, env)]);
  if (hasPillow) {   // a picture with an accent in its name; words the window may not be able to show
    const plain = label === 'ascii';   // no way to type an accent in a window with no language: only the picture's name has one
    const r = await exec(dir, ['tools/add_photo.py', PICTURE, '--name', 'goat-test', '--alt', plain ? 'A goat wearing a green hat' : ALT, '--caption', 'Goat', '--dry-run'], env);
    res.push(['add_photo.py --dry-run (picture "Cabra con gorro \u00f1.jpg")', r]);
    res.push(['add_photo.py --dry-run (the path pasted with its quote marks, as Windows "Copy as path" gives it)', await exec(dir, ['tools/add_photo.py', '"' + PICTURE + '"', '--name', 'goat-test', '--alt', 'A goat in a field', '--dry-run'], env)]);
    if (!plain) {   // the line it asks you to copy into lang/src/*.json: the same words, or the same words as \u escapes
      const m = r.out.match(/^ {7}"(.*)": "\.\.\.",$/m);
      const printed = m ? unescapeU(cp1252(m[1])) : null;
      res.push(['add_photo.py: the alt text it asks you to translate can be pasted back exactly', verdict(printed === ALT, 'it printed ' + JSON.stringify(printed))]);
    }
  }
  if (label !== 'cp1252') {   // a text a translator pastes back: a missing "js" key with a letter that this code page does not have must come out as \uXXXX, not as ?
    const es = path.join(dir, 'lang', 'src', 'es.json');
    const data = JSON.parse(fs.readFileSync(es, 'utf8'));
    const key = Object.keys(data.js).find((k) => /[\u2018-\u201d\u2013\u2014\u2026]/.test(k));
    if (key) {
      delete data.js[key]; fs.writeFileSync(es, JSON.stringify(data, null, 1));
      const r = await exec(dir, ['tools/i18n.py', 'missing', 'es', '--list'], env);
      const line = r.out.split('\n').find((l) => l.startsWith('js | '));
      const printed = line ? unescapeU(line.slice(5).replace(/ +\(from .*$/, '')) : null;
      res.push(['i18n.py missing --list: a text with a curly quote or a dash can be pasted back exactly', verdict(printed === key, 'it printed ' + JSON.stringify(printed) + ' for ' + JSON.stringify(key))]);
    } else info('(no "js" text with a curly quote or a dash was found: the paste-back check was skipped)');
  }
  return { label, res };
}

/* ------------------------------------------------------------------ 2. Windows checkouts, and a folder with spaces and accents: deploy/ is the same */
async function deployRun(dir, env, cwd) {
  const r = await exec(cwd || dir, [path.join(dir, 'tools', 'make_deploy_folder.py')], env);
  const p = path.join(dir, 'deploy', 'FILES.txt');
  const txt = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  return { r, txt, fp: (txt.match(/sha256 of the whole folder: (\w+)/) || [])[1] };
}
async function deployGroup() {
  const lfDir = path.join(SCRATCH, 'My Site (copy)', 'Jos\u00e9 P\u00e9rez');   // spaces and accents; started from another folder
  fs.mkdirSync(path.dirname(lfDir), { recursive: true });
  fs.cpSync(BASE, lfDir, { recursive: true });
  const npDir = clone('notepad');                      // Windows line endings and the BOM in every file an editor touches
  toCrlf(npDir); addBom(npDir);
  const elsewhere = async () => {   // the other tools, started from another folder (python C:\\...\\tools\\pages.py): nothing may depend on the folder the window is in
    const lfDir = path.join(SCRATCH, 'My Site (copy)', 'Mar\u00eda L\u00f3pez');   // its own copy: deploy/ is being made in the other one
    fs.cpSync(BASE, lfDir, { recursive: true });
    const rs = [];
    for (const a of [['pages.py'], ['check_facts.py', '--brief'], ['farm_map.py', 'tools/saved-map.json'], ['farm_map.py', 'saved-map.json'], ['i18n.py', 'missing', 'es']].concat(hasSegno ? [['make_qr.py']] : [])) {
      rs.push([a.join(' '), await exec(os.tmpdir(), [path.join(lfDir, 'tools', a[0]), ...a.slice(1)], envOf({}, BARE))]);
    }
    return rs;
  };
  const [lf, np, other] = await Promise.all([deployRun(lfDir, envOf({}, BARE), os.tmpdir()), deployRun(npDir, envOf(CONSOLES.cp1252)), elsewhere()]);
  return { lfDir, npDir, lf, np, other };
}

/* ------------------------------------------------------------------ 3. files that are not what the tools expect */
const ANSI_MAP = { '\u2013': 0x96, '\u2014': 0x97, '\u2018': 0x91, '\u2019': 0x92, '\u201c': 0x93, '\u201d': 0x94, '\u2026': 0x85 };
/** What Notepad's "ANSI" does: every letter becomes one byte (a dash or a curly quote too); letters it does not have become ?. */
const saveAsAnsi = (rel) => (dir) => { const p = path.join(dir, rel); const bytes = []; for (const ch of fs.readFileSync(p, 'utf8')) { const c = ch.codePointAt(0); bytes.push(c < 128 ? c : ANSI_MAP[ch] !== undefined ? ANSI_MAP[ch] : c < 256 ? c : 0x3f); } fs.writeFileSync(p, Buffer.from(bytes)); };
const pasteAnsiLetter = (rel) => (dir) => fs.appendFileSync(path.join(dir, rel), Buffer.from([0x0a, 0x63, 0x61, 0x66, 0xe9, 0x0a]));   // "caf" and an e-acute as one byte, as pasted into an ANSI file
const T = { pages: ['tools/pages.py'], extract: ['tools/i18n.py', 'extract'], build: ['tools/i18n.py', 'build'], missing: ['tools/i18n.py', 'missing', 'es'], facts: ['tools/check_facts.py', '--brief'], qr: ['tools/make_qr.py'], map: ['tools/farm_map.py', 'tools/saved-map.json'] };
const qr = hasSegno ? [T.qr] : [];
const SCENARIOS = [
  ['a BOM at the start of lang/src/es.json and hi.json', (d) => addBomTo(d, ['lang/src/es.json', 'lang/src/hi.json']), [T.build, T.missing], null],
  ['a BOM at the start of js/content.js', (d) => addBomTo(d, ['js/content.js']), [T.missing, ...qr], null],
  ['a BOM at the start of index.html and pages/first-visit.html', (d) => addBomTo(d, ['index.html', 'pages/first-visit.html']), [T.pages, T.extract], null],
  ['a BOM at the start of tools/saved-map.json and tools/qr_links.json', (d) => addBomTo(d, ['tools/saved-map.json', 'tools/qr_links.json']), [T.map, ...qr], null],
  ['index.html saved as ANSI', saveAsAnsi('index.html'), [T.pages, T.facts], 'index.html'],
  ['js/content.js saved as ANSI', saveAsAnsi('js/content.js'), [T.missing, ...qr], 'js/content.js'],
  ['lang/src/es.json saved as ANSI', saveAsAnsi('lang/src/es.json'), [T.build, T.facts], 'lang/src/es.json'],
  ['pages/first-visit.html with one ANSI letter pasted in', pasteAnsiLetter('pages/first-visit.html'), [T.pages], 'pages/first-visit.html'],
  ['tools/saved-map.json with one ANSI letter pasted in', pasteAnsiLetter('tools/saved-map.json'), [T.map], 'tools/saved-map.json'],
  ...(hasSegno ? [['tools/qr_links.json with one ANSI letter pasted in', pasteAnsiLetter('tools/qr_links.json'), [T.qr], 'tools/qr_links.json']] : []),
];
const badFiles = () => Promise.all(SCENARIOS.map(async ([name, mutate, cmds, expect], i) => {
  const dir = clone('bad-' + i);
  mutate(dir);
  const rs = [];
  for (const c of cmds) rs.push(await exec(dir, c, envOf(CONSOLES.cp1252)));
  return { name, rs, expect };
}));

/* ------------------------------------------------------------------ 3b. what Windows does to a text file written without newline=: every "\n" becomes CR LF */
// open() is made to do that for this run (as Windows text mode does); a tool that writes a file the plain way then leaves a CR in it. The tools must give the Unix bytes anyway.
const WINDOWS_NEWLINES = 'import builtins, io, runpy, sys\n_open = builtins.open\n'
  + 'def win_open(file, mode="r", buffering=-1, encoding=None, errors=None, newline=None, *a, **k):\n'
  + '    if "b" not in mode and newline is None and any(c in mode for c in "wax+"):\n        newline = "\\r\\n"\n'
  + '    return _open(file, mode, buffering, encoding, errors, newline, *a, **k)\n'
  + 'builtins.open = io.open = win_open\n'
  + 'tool = sys.argv[1]\nsys.argv = sys.argv[1:]\nrunpy.run_path(tool, run_name="__main__")\n';
async function newlineRun() {
  const dir = clone('windows-newlines');
  const rs = [];
  for (const a of [T.pages, T.extract, ['tools/i18n.py', 'jsstrings'], T.build, T.map, ...qr]) rs.push(await exec(dir, ['-c', WINDOWS_NEWLINES, ...a], envOf(CONSOLES.cp1252)));
  const raw = (d) => Object.fromEntries(files(d).map((f) => [f, crypto.createHash('sha1').update(fs.readFileSync(path.join(d, f))).digest('hex')]));
  const changed = differ(raw(BASE), raw(dir));
  const hasCr = (d, f) => isText(f) && fs.existsSync(path.join(d, f)) && fs.readFileSync(path.join(d, f)).includes(13);
  const unixCheckout = !files(BASE).some((f) => hasCr(BASE, f));   // on a Windows checkout the committed files have CR LF and the tools write LF: only a CR in what a tool wrote is wrong
  return { rs, wrong: changed.filter((f) => hasCr(dir, f)).concat(unixCheckout ? changed : []) };
}

/* ------------------------------------------------------------------ 4. a file that is read-only (as a user that is not root; root can write anywhere) */
async function readOnly() {
  const dir = clone('readonly');
  fs.chmodSync(path.join(dir, 'wise-pie.html'), 0o444);
  let exe = EXE, args = ['tools/pages.py'];
  if (posix && process.getuid && process.getuid() === 0) {   // become the user "nobody" for this one run
    if (spawnSync('id', ['nobody']).status !== 0 || spawnSync('runuser', ['--help']).error) return null;
    spawnSync('chown', ['-R', 'nobody', dir]);
    exe = 'runuser'; args = ['-u', 'nobody', '--', EXE, 'tools/pages.py'];
  }
  const r = await exec(dir, args, envOf(), exe);
  if (/runuser: failed to execute/.test(all(r))) return null;   // that user cannot start this Python
  return { good: r.code !== 0 && /I could not open or change .*wise-pie\.html/.test(all(r)) && /read-only/.test(all(r)) && !/Traceback/.test(all(r)), detail: all(r).trim().split('\n')[0].slice(0, 200) };
}

/* ------------------------------------------------------------------ 5. serve.py asked for a missing file whose name the console cannot show */
async function serveRun(label, extra, dir, cwd) {
  const p = spawn(EXE, [path.join(dir, 'tools', 'serve.py'), '--port', '0', '--no-open'], { cwd, env: envOf(extra, BARE), stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  p.stdout.on('data', (d) => { out += d.toString('latin1'); }); p.stderr.on('data', (d) => { err += d.toString('latin1'); });
  const res = { label };
  try {
    const t0 = Date.now();
    while (!/Address: +http:\/\/localhost:\d+\//.test(out) && Date.now() - t0 < 15000 && p.exitCode === null) await new Promise((r) => setTimeout(r, 50));
    const m = out.match(/Address: +http:\/\/localhost:(\d+)\//);
    if (!m) return { label, failed: 'it did not start: ' + (out + err).trim().slice(0, 200) };
    const base = `http://127.0.0.1:${m[1]}`;
    res.home = await fetch(base + '/').then(async (r) => [r.status, await r.text()]).catch((e) => [0, String(e)]);
    res.missing = await fetch(base + '/%E2%9C%93-%E4%B8%AD-%E0%A4%B9-caf%C3%A9.png').then(async (r) => [r.status, (await r.text()).length]).catch((e) => [0, String(e)]);
    res.again = await fetch(base + '/').then((r) => r.status).catch(() => 0);
  } finally {
    p.kill();
    await new Promise((r) => setTimeout(r, 150));
  }
  return { ...res, log: out + err };
}

/* ------------------------------------------------------------------ 6. Python 3.8 or 3.9, when this computer has one */
async function olderPython() {
  for (const exe of [process.env.WA_PYTHON38, 'python3.8', 'python3.9'].filter(Boolean)) {
    const v = spawnSync(exe, ['-c', 'import sys; print("%d.%d" % sys.version_info[:2])'], { encoding: 'utf8' });
    if (v.status !== 0 || !probe(exe, 'import bs4, PIL')) continue;
    const dir = clone('older-python');
    const rs = [];
    for (const t of ['tools/test_pages.py', 'tools/test_check_facts.py']) rs.push(await exec(dir, [t], envOf(), exe));
    return { exe, version: v.stdout.trim(), good: rs.every((r) => r.code === 0 && /\bOK\b/.test(all(r))), detail: rs.map(lastLine).join(' || ') };
  }
  return null;
}

/* ------------------------------------------------------------------ run it */
let failedToRun = false;
try {
  /* group 1: the three consoles and the two deploy/ builds, at the same time */
  const [consoles, dep] = await Promise.all([
    Promise.all([consoleChain('cp1252', CONSOLES.cp1252, true), consoleChain('cp437', CONSOLES.cp437, false), consoleChain('ascii', CONSOLES.ascii, false)]),
    deployGroup(),
  ]);
  for (const { label, res } of consoles) {
    const bad = res.filter(([, r]) => !clean(r));
    ok(`console ${label}: all ${res.length} tool runs end well, with no Python error and the text that must be pasted back exact`, bad.length === 0, bad.map(([n, r]) => n + ': ' + lastLine(r)).join(' || '));
    const facts = res.find(([n]) => n === 'check_facts.py');
    ok(`console ${label}: check_facts.py still lists every place as file:line (index.html, pages/, js/content.js, lang/src/)`, !!facts && /\n {6}(index\.html|pages\/[\w-]+\.html):\d+/.test(facts[1].out) && /js\/content\.js:\d+/.test(facts[1].out) && /lang\/src\/\w+\.json:\d+/.test(facts[1].out), '');
  }
  if (!BARE) info('(the PATH with nothing but Python on it was not tried: symbolic links are not available here)');
  const { lfDir, npDir, lf, np, other } = dep;
  ok('make_deploy_folder.py in "My Site (copy)/Jos\u00e9 P\u00e9rez", started from another folder, with nothing but Python on the PATH: ready', lf.r.code === 0 && /Ready: /.test(lf.r.out) && /Pages and translations are up to date\./.test(lf.r.out) && !PYERR.test(all(lf.r)), lastLine(lf.r));
  ok(`started from another folder, in "My Site (copy)/Mar\u00eda L\u00f3pez": ${other.map(([n]) => n).join(', ')} all end well (a relative file name is counted from the site folder)`, other.every(([, r]) => clean(r)), other.filter(([, r]) => !clean(r)).map(([n, r]) => n + ': ' + lastLine(r)).join(' || '));
  ok('FILES.txt names every file with / (never \\)', lf.txt.length > 1000 && !lf.txt.includes('\\') && /assets\/photos\//.test(lf.txt), '');
  ok('make_deploy_folder.py on a Windows checkout (Windows line endings and a BOM in every file an editor touches, console cp1252): ready, and it does not call the folder out of date',
    np.r.code === 0 && /Ready: /.test(np.r.out) && /Pages and translations are up to date\./.test(np.r.out) && !PYERR.test(all(np.r)), lastLine(np.r));
  ok('deploy/ from the Windows checkout is the same as from the Unix one: the same fingerprint in FILES.txt', !!lf.fp && lf.fp === np.fp, `${lf.fp} against ${np.fp}`);
  const odd = !fs.existsSync(path.join(npDir, 'deploy')) ? ['deploy/ was not made'] : files(path.join(npDir, 'deploy')).filter((f) => { if (!isText(f)) return false; const b = fs.readFileSync(path.join(npDir, 'deploy', f)); return b.subarray(0, 3).equals(BOM) || b.includes(13); });
  ok('no text file in that deploy/ has a BOM or a Windows line ending', odd.length === 0, odd.slice(0, 4).join(', '));
  void lfDir;

  /* group 2: the rebuild on a Windows checkout, files that are not what the tools expect, a read-only file, serve.py, Python 3.8 */
  const crDir = clone('crlf'); toCrlf(crDir); addBom(crDir);
  const [rebuilt, bad, ro, serves, older, nl] = await Promise.all([
    (async () => { const rs = []; for (const a of [T.pages, T.extract, T.build]) rs.push(await exec(crDir, a, envOf(CONSOLES.cp1252, BARE))); return rs; })(),
    badFiles(),
    readOnly(),
    Promise.all([serveRun('cp1252', CONSOLES.cp1252, clone('serve-1'), SCRATCH), serveRun('plain ASCII', CONSOLES.ascii, clone('serve-2'), SCRATCH), serveRun('cp437, in the folder with spaces and accents, started from another folder', CONSOLES.cp437, lfDir, os.tmpdir())]),
    olderPython(),
    newlineRun(),
  ]);
  ok('the three rebuild commands (pages.py, i18n.py extract, i18n.py build) on a Windows checkout end well', rebuilt.every(clean), rebuilt.map(lastLine).join(' || '));
  const wrong = differ(digest(BASE), digest(crDir));
  ok('... and give the same files as on a Unix checkout, apart from the line endings and the BOM', wrong.length === 0, wrong.slice(0, 5).join(', '));
  ok('with Windows text mode pretended (open() turns every \\n into CR LF unless the tool says newline=): the rebuild commands, farm_map.py and make_qr.py write Unix line endings only (and on a Unix checkout exactly the committed bytes)', nl.rs.every(clean) && nl.wrong.length === 0, nl.wrong.length ? 'different: ' + nl.wrong.slice(0, 4).join(', ') : nl.rs.map(lastLine).join(' || '));
  for (const s of bad) {
    if (!s.expect) { ok(`${s.name}: the tools read the file as they would a plain one`, s.rs.every(clean), s.rs.map(lastLine).join(' || ')); continue; }
    const good = s.rs.every((r) => r.code !== 0 && !/Traceback/.test(all(r)) && all(r).includes(s.expect + ' is not saved as UTF-8: line '));
    ok(`${s.name}: each tool stops, names ${s.expect} and the line, and says how to save it`, good && s.rs.every((r) => /Encoding: UTF-8/.test(all(r))), s.rs.map((r) => all(r).trim().split('\n')[0].slice(0, 120)).join(' || '));
    if (s.name.startsWith('index.html')) ok('... pages.py does not say "index.html is missing a part"', !/missing a part/.test(all(s.rs[0])), '');
  }
  if (ro) ok('a read-only file: pages.py says which file, that it is read-only or open elsewhere, and what to do (no Python error)', ro.good, ro.detail);
  else info('(the read-only check was skipped: this computer runs the test as root and cannot become another user)');
  for (const s of serves) {
    if (s.failed) { ok(`serve.py (${s.label}): starts`, false, s.failed); continue; }
    ok(`serve.py (${s.label}): shows the site, answers 404 for a missing file whose name the window cannot show, and keeps running`,
      s.home[0] === 200 && /<html/i.test(s.home[1]) && s.missing[0] === 404 && s.missing[1] > 0 && s.again === 200 && !PYERR.test(s.log), `home ${s.home[0]}, missing ${s.missing[0]}, again ${s.again}; ${s.log.trim().split('\n').pop()}`);
  }
  if (older) ok(`the tools' own checks pass with ${older.exe} (Python ${older.version})`, older.good, older.detail);
  else info('(no python3.8 or python3.9 with beautifulsoup4 and Pillow was found: the tools were only checked by parsing them as Python 3.8; WA_PYTHON38 can name one)');
} catch (e) {
  failedToRun = true;
  ok('the windows-reality test ran to the end', false, String(e && e.stack ? e.stack.split('\n').slice(0, 4).join(' / ') : e));
}

/* ------------------------------------------------------------------ 7. what can be checked by reading */
if (!failedToRun) {
  const tools = fs.readdirSync(path.join(ROOT, 'tools')).filter((f) => f.endsWith('.py')).sort();
  const src = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const bareStrings = (s) => s.replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g, '""');   // the code without the words inside quote marks

  // Python 3.8: every file parses with the 3.8 grammar, and uses no newer library function
  const parse = spawnSync(EXE, ['-c', 'import ast, sys\nfor f in sys.argv[1:]:\n    try:\n        ast.parse(open(f, encoding="utf-8").read(), filename=f, feature_version=(3, 8))\n    except SyntaxError as e:\n        print("%s line %s: %s" % (f, e.lineno, e.msg))'].concat(tools.map((f) => path.join(ROOT, 'tools', f))), { encoding: 'utf8' });
  ok(`all ${tools.length} files in tools/ parse with the Python 3.8 grammar`, parse.status === 0 && parse.stdout.trim() === '', parse.stdout.trim().split('\n')[0] || parse.stderr.trim().split('\n').pop());
  const NEWER = [[/\.removeprefix\(|\.removesuffix\(/, 'str.removeprefix/removesuffix (3.9)'], [/\bzoneinfo\b/, 'zoneinfo (3.9)'], [/\bmath\.(lcm|nextafter|ulp)\b/, 'math.lcm/nextafter/ulp (3.9)'], [/\bfunctools\.cache\b|@cache\b/, 'functools.cache (3.9)'],
    [/\bast\.unparse\b/, 'ast.unparse (3.9)'], [/\.bit_count\(/, 'int.bit_count (3.10)'], [/\bzip\([^)]*strict=/, 'zip(strict=) (3.10)'], [/\bisinstance\([^)]*\b\w+ \| \w+\)/, 'isinstance(x, A | B) (3.10)'], [/^\s*(?:from|import) +tomllib\b/m, 'tomllib (3.11)']];
  const newer = [];
  for (const f of tools) {
    const s = bareStrings(src('tools/' + f));
    for (const [rx, what] of NEWER) if (rx.test(s)) newer.push(f + ': ' + what);
    if (!/from __future__ import annotations/.test(s)) {
      if (/->\s*(?:list|dict|tuple|set|frozenset|type)\[|\b\w+\s*:\s*(?:list|dict|tuple|set)\[[^\]=\n]*\]\s*[=,)]/.test(s)) newer.push(f + ': list[...] or dict[...] in an annotation (3.9)');
      if (/\b\w+\s*:\s*\w+\s*\|\s*None\b|->\s*\w+\s*\|\s*None\b/.test(s)) newer.push(f + ': "X | None" in an annotation (3.10)');
    }
  }
  ok('no tool uses a library function or an annotation that needs Python 3.9 or newer', newer.length === 0, newer.join('; '));

  // reading and writing: every text file is opened with its encoding named; no child process is read with the computer's own code page
  const loose = [], writes = [];
  for (const f of tools) {
    const lines = src('tools/' + f).split('\n');
    lines.forEach((line, i) => {
      const code = line.replace(/#.*$/, '');
      for (const m of code.matchAll(/(?<![\w.])open\(((?:[^()]|\([^()]*\))*)\)/g)) {   // the builtin open(, not Image.open( or os.fdopen(
        const args = m[1];
        if (/['"][rwa]b\+?['"]/.test(args) || /encoding=/.test(args) || /os\.devnull/.test(args)) continue;
        loose.push(`${f}:${i + 1}`);
        if (/['"]w['"]/.test(args) && !f.startsWith('test_')) writes.push(`${f}:${i + 1}`);
      }
      if (!f.startsWith('test_') && /(?<![\w.])open\(.*['"]w['"]/.test(code) && !/newline=/.test(code) && !/os\.devnull/.test(code) && !/encoding=/.test(code)) writes.push(`${f}:${i + 1}`);
      const call = lines.slice(i, i + 3).join(' ');
      if (/subprocess\.run\(/.test(code) && /(text=True|universal_newlines=True)/.test(call) && !/encoding=/.test(call) && !f.startsWith('test_')) loose.push(`${f}:${i + 1} (a child process read with the computer's own code page)`);
    });
  }
  ok('every open() of a text file in tools/ names its encoding, so a tool reads UTF-8 on every computer', loose.length === 0, loose.slice(0, 6).join(', '));
  const unix = [];
  for (const f of tools.filter((x) => !x.startsWith('test_'))) src('tools/' + f).split('\n').forEach((line, i) => { if (/open\(/.test(line) && /['"]w['"]/.test(line) && !/newline=/.test(line) && !/os\.devnull/.test(line)) unix.push(`${f}:${i + 1}`); });
  ok('every text file a tool writes is written with newline=\'\\n\': the same bytes on every computer', unix.length === 0 && writes.length === 0, unix.concat(writes).join(', '));

  // the lines at the top of every tool are the same everywhere (copied, not shared: a tool must work when it is copied alone)
  const block = (s) => { const a = s.indexOf('# ---- Windows safety'), b = s.indexOf('# ---- end of the Windows safety lines'); return a >= 0 && b > a ? s.slice(a, b) : null; };
  const owned = tools.filter((f) => f !== 'launch_check.py' && !f.startsWith('test_'));
  const blocks = owned.map((f) => [f, block(src('tools/' + f))]);
  ok(`the "Windows safety" lines (a letter the window cannot show prints as ?; a file not saved as UTF-8 or a read-only one is explained) open all ${owned.length} tools and are the same in each`,
    blocks.every(([, b]) => b) && new Set(blocks.map(([, b]) => b)).size === 1, blocks.every(([, b]) => b) ? '' : blocks.filter(([, b]) => !b).map(([f]) => f + ' has none').join(', '));
  ok('tools/launch_check.py makes its own output safe (reconfigure with errors=\'replace\')', /stdout\.reconfigure\(errors='replace'\)/.test(src('tools/launch_check.py')), '');

  // serve.py must not let a second program share its port on Windows
  const share = spawnSync(EXE, ['-c', 'import sys; sys.path.insert(0, sys.argv[1]); import serve; print(serve.may_share_port("nt"), serve.may_share_port("posix"), serve.Server.allow_reuse_address == serve.may_share_port())', path.join(ROOT, 'tools')], { encoding: 'utf8' });
  ok('serve.py does not set SO_REUSEADDR on Windows, so a busy port is refused and two windows cannot show different sites at one address', share.stdout.trim() === 'False True True', share.stdout.trim() || share.stderr.trim().split('\n').pop());

  // the way check_facts writes a place: file:line with / even where the computer's own separator is \ (os.path.relpath is made to give \ for this run)
  const sepRun = spawnSync(EXE, ['-c', 'import os, runpy, sys\n_r = os.path.relpath\nos.path.relpath = lambda p, s=None: _r(p, s).replace("/", "\\\\")\nsys.argv = ["tools/check_facts.py"]\ntry:\n    runpy.run_path("tools/check_facts.py", run_name="__main__")\nexcept SystemExit:\n    pass'], { cwd: BASE, encoding: 'utf8' });
  ok('check_facts.py shows a place as file:line with / (never with \\) even where the computer writes paths with \\', sepRun.status === 0 && /pages\/[\w-]+\.html:\d+/.test(sepRun.stdout) && !/(?:pages|lang\\src|lang)\\[\w.-]+:\d+/.test(sepRun.stdout), sepRun.stderr.trim().split('\n').pop());

  // the docs
  const readme = src('README.md'), checklist = src('docs/LAUNCH_CHECKLIST.md');
  const at = readme.indexOf('## Commands on Windows, Mac and Linux'), day = readme.indexOf('## Day-to-day changes');
  const section = at >= 0 && day > at ? readme.slice(at, day) : '';
  ok('README has the section "Commands on Windows, Mac and Linux" early (before "Day-to-day changes")', at > 0 && day > at, '');
  const need = ['python3 --version', 'python --version', 'py -3 --version', 'python -m pip install beautifulsoup4', 'Microsoft Store', 'app execution aliases', 'UTF-8', 'ANSI', '&&', 'Node.js is not needed', 'tools/serve.bat', 'OneDrive', 'curl.exe'];
  ok('... it says how to find the Python command, how to install the packages, what to do when python opens the Microsoft Store, how to save, how to join commands, that Node is not needed, and about OneDrive', need.every((w) => section.includes(w)), need.filter((w) => !section.includes(w)).join(', '));
  const blocked = [];
  for (const [name, text] of [['README.md', readme], ['docs/LAUNCH_CHECKLIST.md', checklist]]) for (const m of text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)) m[1].split('\n').forEach((l) => { if (/^\s*(python3?|py|node|git|curl|pip3?)\b.*(&&|;\s|\|\|)/.test(l) || /^\s*(ls|cat|rm|cp|mv|chmod|sudo|export|source)\b/.test(l)) blocked.push(name + ': ' + l.trim().slice(0, 70)); });
  ok('no command block in README.md or the launch checklist joins commands with && or ;, or uses a Unix-only command (ls, cat, rm, cp, chmod...)', blocked.length === 0, blocked.join(' | '));
  const chained = [];
  for (const f of tools.filter((x) => !x.startsWith('test_'))) src('tools/' + f).split('\n').forEach((l, i) => { if (/(&&|;) *python3? tools\//.test(l)) chained.push(`tools/${f}:${i + 1}`); });
  ok('no tool prints or documents a line that joins two python3 commands with && or ;', chained.length === 0, chained.join(', '));
  ok('the launch checklist writes curl.exe for PowerShell next to its curl line', /curl -sI [^\n]*curl\.exe/.test(checklist), '');
  ok('nothing still sends the owner to "Commands: one-time setup" (the old name of that section)', ![readme, checklist, ...tools.map((f) => src('tools/' + f))].some((t) => t.includes('Commands: one-time setup')), '');

  // tools/serve.bat: a double-click launcher that cannot be run on every Windows from here, so it is kept plain
  const bat = fs.readFileSync(path.join(ROOT, 'tools', 'serve.bat'));
  const code = bat.toString('latin1').split('\n').filter((l) => !/^\s*rem\b/i.test(l)).join('\n');
  ok('tools/serve.bat is plain ASCII (a console reads it in its own code page)', ![...bat].some((b) => b > 126 || (b < 32 && ![9, 10, 13].includes(b))), '');
  ok('tools/serve.bat has no label, no goto and no ( ) block, so it works with Unix or Windows line endings', !/^\s*:/m.test(code) && !/\bgoto\b/i.test(code) && !/[()]/.test(code), '');
  ok('tools/serve.bat goes to the site folder, tries py -3 and then python (only when py is not found), and keeps its window open', /pushd "%~dp0\.\."/.test(code) && /py -3 tools\\serve\.py/.test(code) && /if errorlevel 9009 python tools\\serve\.py/.test(code) && /\bpause\b/i.test(code), '');
  ok('the script tools/serve.bat starts exists', fs.existsSync(path.join(ROOT, 'tools', 'serve.py')), '');
}

try { fs.rmSync(SCRATCH, { recursive: true, force: true }); } catch (e) { info('(the temporary copies in ' + SCRATCH + ' could not be removed: ' + e.message + ')'); }
await finish({});
