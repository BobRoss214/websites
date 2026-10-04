// order: 25
// browser: no
// quick: no
// covers: patches/*, docs/OPTION_PATCHES.md, tools/option_matrix.py
/* The optional patches in patches/optional/ (the farm's open decisions that change files): each one has its header (what it does, which
 * question it answers, what it conflicts with, which host it is for, what to run after), each applies to the site as it is now with
 * `git apply`, every set that makes sense applies together in the documented order, docs/OPTION_PATCHES.md names every patch, and
 * tools/option_matrix.py can list the combinations. Needs git and python3, no browser. Nothing is written in the site folder: the files
 * a patch touches are copied to a temporary folder. (The slow part, rebuilding and testing every combination, is
 * `python3 tools/option_matrix.py`; see README.md.) A patch that was already applied (its changes are in the files) counts as fine. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, ok, info, skip, finish } from './lib.mjs';

const PY = process.env.WA_PYTHON || 'python3';
if (spawnSync('git', ['--version']).status !== 0) skip('git is not installed (it is needed for git apply)');
const DIR = path.join(ROOT, 'patches', 'optional');
const REQUIRED = ['Option', 'Name', 'Does', 'Answers', 'Conflicts', 'Requires', 'Host', 'Order', 'After'];
const HOSTS = ['cloudflare', 'netlify', 'github'];

if (!fs.existsSync(DIR)) { ok('patches/optional/ exists', false); await finish(); process.exit(); }
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.patch')).sort();
const others = fs.readdirSync(DIR).filter((f) => !f.endsWith('.patch') && f !== 'README.md');
ok('patches/optional/ holds patch files (and nothing else but a README.md)', files.length > 0 && others.length === 0, others.join(', '));

const header = (text) => {
  const h = {};
  for (const line of text.split('\n')) {
    if (/^(diff |--- |\+\+\+ )/.test(line)) break;
    const m = /^([A-Za-z]+):\s*(.*)$/.exec(line);
    if (m) h[m[1]] = m[2].trim();
  }
  return h;
};
const patches = files.map((f) => {
  const text = fs.readFileSync(path.join(DIR, f), 'utf8');
  const touched = [...text.matchAll(/^diff --git a\/(\S+) b\/(\S+)$/gm)].map((m) => m[2]);
  return { file: f, text, head: header(text), touched };
});

/* ---- the header ---- */
for (const p of patches) {
  const missing = REQUIRED.filter((k) => !p.head[k]);
  ok(`${p.file}: header has ${REQUIRED.join(', ')}`, missing.length === 0, 'missing: ' + missing.join(', '));
  ok(`${p.file}: a plain name (letters, digits, dashes), and a header before the first diff line`, /^[A-Za-z0-9]+(-[A-Za-z0-9]+)*\.patch$/.test(p.file) && p.text.indexOf('Option:') >= 0 && p.text.indexOf('Option:') < p.text.search(/^diff /m), p.file);
  ok(`${p.file}: Order is a number, Host is "any" or names hosts we know`, /^\d+$/.test(p.head.Order || '') && (/^any\b/i.test(p.head.Host || '') || HOSTS.some((h) => (p.head.Host || '').toLowerCase().includes(h))), `${p.head.Order} / ${p.head.Host}`);
  ok(`${p.file}: "Answers" names a question number (d01 ... d73) or a launch decision (D1 ... D9)`, /\b(d\d\d|D\d)\b/.test(p.head.Answers || ''), p.head.Answers);
}
const ids = patches.map((p) => p.head.Option);
ok('every Option: id is different', new Set(ids).size === ids.length, ids.join(', '));
const bad = [];
for (const p of patches) for (const c of (p.head.Conflicts || '').split(/[\s,;]+/).filter((t) => t && !/^(none|nothing)$/i.test(t))) {
  const other = patches.find((q) => q.head.Option === c);
  if (!other) bad.push(`${p.head.Option} conflicts with unknown ${c}`);
  else if (!(other.head.Conflicts || '').split(/[\s,;]+/).includes(p.head.Option)) bad.push(`${c} does not list ${p.head.Option} back`);
}
ok('"Conflicts" names real patches and is listed on both sides', bad.length === 0, bad.join('; '));

/* ---- each patch applies to the files as they are now ---- */
const git = (cwd, ...args) => spawnSync('git', args, { cwd, encoding: 'utf8' });
// A patch that edits a file the site does not have yet (its "Requires:" line names the file) waits for it instead of failing.
for (const p of patches) p.absent = ((p.head.Requires || '').match(/\b(?:tools|tests|js|css|docs|lang)\/[\w./-]+\.\w+/g) || []).filter((f) => !fs.existsSync(path.join(ROOT, f)));
for (const p of patches.filter((q) => q.absent.length)) ok(`${p.file}: waits for ${p.absent.join(', ')}, which is not in the site yet (not checked until it is)`, true);
for (const p of patches.filter((q) => !q.absent.length)) {
  const fwd = git(ROOT, 'apply', '--check', path.join(DIR, p.file));
  let how = 'applies';
  let good = fwd.status === 0;
  if (!good) { const rev = git(ROOT, 'apply', '--check', '--reverse', path.join(DIR, p.file)); if (rev.status === 0) { good = true; how = 'is already applied'; } }
  ok(`${p.file}: git apply --check on the site as it is (${how})`, good, (fwd.stderr || '').trim().split('\n').slice(0, 2).join(' | '));
}

/* ---- every set that makes sense applies together, in the documented order ---- */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-optpatch-'));
try {
  const touchedAll = [...new Set(patches.flatMap((p) => p.touched))].filter((f) => fs.existsSync(path.join(ROOT, f)));
  const base = path.join(tmp, 'base');
  for (const f of touchedAll) { fs.mkdirSync(path.dirname(path.join(base, f)), { recursive: true }); fs.copyFileSync(path.join(ROOT, f), path.join(base, f)); }
  const ordered = [...patches].sort((a, b) => Number(a.head.Order) - Number(b.head.Order) || a.file.localeCompare(b.file));
  const conflicts = (a, b) => (a.head.Conflicts || '').split(/[\s,;]+/).includes(b.head.Option) || (b.head.Conflicts || '').split(/[\s,;]+/).includes(a.head.Option);
  let sets = 0; const fails = [];
  const alreadyIn = new Set(patches.filter((p) => !p.absent.length).filter((p) => git(base, 'apply', '--check', '--reverse', path.join(DIR, p.file)).status === 0 && git(base, 'apply', '--check', path.join(DIR, p.file)).status !== 0).map((p) => p.file));
  const usable = ordered.filter((p) => !alreadyIn.has(p.file) && !p.absent.length);
  // `git apply` works file by file: a patch changes only the files in its diff, and the hunks of one file do not care what happened to another.
  // So a set of patches applies together exactly when, for every file, the patches of the set that touch that file apply to it one after the other
  // in the documented order. That is all that has to be tried: every set of the patches that touch the same file, one file at a time (a few
  // hundred small applies). Trying whole sets of 15 patches would be 2^15 copies of the site. One more set at the end puts everything together:
  // the first choice of every group of alternatives and every patch that has no alternative, then the last choice.
  const byFile = new Map();
  for (const p of usable) for (const f of new Set(p.touched)) byFile.set(f, [...(byFile.get(f) || []), p]);
  const tryApply = (pick, only) => {
    const work = path.join(tmp, 'w');
    fs.rmSync(work, { recursive: true, force: true });
    fs.mkdirSync(work, { recursive: true });
    if (only) { if (fs.existsSync(path.join(base, only))) { fs.mkdirSync(path.dirname(path.join(work, only)), { recursive: true }); fs.copyFileSync(path.join(base, only), path.join(work, only)); } }
    else fs.cpSync(base, work, { recursive: true });
    for (const p of pick) {
      const r = git(work, 'apply', ...(only ? ['--include=' + only] : []), path.join(DIR, p.file));
      if (r.status !== 0) { fails.push(`${only ? only + ': ' : ''}${pick.map((x) => x.head.Option).join(' + ')}: ${p.head.Option} does not apply (${(r.stderr || '').trim().split('\n')[0]})`); return; }
    }
  };
  for (const [f, grp] of byFile) {
    if (grp.length < 2) continue;   // a file that only one patch changes is checked by that patch's own "git apply --check" above
    for (let mask = 1; mask < (1 << grp.length); mask++) {
      const pick = grp.filter((_, i) => mask & (1 << i));
      if (pick.length < 2 || pick.some((a, i) => pick.slice(i + 1).some((b) => conflicts(a, b)))) continue;
      sets++;
      tryApply(pick, f);
      if (fails.length >= 5) break;
    }
  }
  for (const last of [false, true]) {   // everything at once: the first (or last) of each set of alternatives, plus every patch without alternatives
    const chosen = [];
    for (const p of (last ? [...usable].reverse() : usable)) if (!chosen.some((c) => conflicts(c, p))) chosen.push(p);
    sets++;
    tryApply(ordered.filter((p) => chosen.includes(p)));
  }
  ok(`every set of patches that do not conflict applies together, in "Order" order (git apply, no fuzz): ${sets} sets of patches that touch the same file, one file at a time, and everything at once`, fails.length === 0 && sets > 0, fails.slice(0, 3).join(' | '));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

/* ---- the table and the matrix program ---- */
const doc = fs.existsSync(path.join(ROOT, 'docs', 'OPTION_PATCHES.md')) ? fs.readFileSync(path.join(ROOT, 'docs', 'OPTION_PATCHES.md'), 'utf8') : '';
ok('docs/OPTION_PATCHES.md exists and names every patch file', doc.length > 0 && files.every((f) => doc.includes('patches/optional/' + f)), files.filter((f) => !doc.includes('patches/optional/' + f)).join(', '));
const run = spawnSync(PY, [path.join(ROOT, 'tools', 'option_matrix.py'), ROOT, '--list'], { encoding: 'utf8', timeout: 60000 });
const n = /^(\d+) combinations \((\d+) different sets of patches\)/m.exec(run.stdout || '');
ok('tools/option_matrix.py --list works and lists the combinations', run.status === 0 && !!n && Number(n[1]) >= Number(n[2]) && Number(n[2]) >= files.length, (run.stdout || run.stderr || '').split('\n')[0]);
ok('the list names every patch (but one that waits for a file the site does not have yet)', patches.filter((p) => !p.absent.length).every((p) => (run.stdout || '').includes(p.file)), '');
if (n) info(`${n[1]} combinations (${n[2]} different sets of patches), ${files.length} patch files`);

await finish({});
