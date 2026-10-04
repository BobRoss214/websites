// order: 62
// browser: no
// quick: no
// covers: tools/*, lang/*, pages/*, *.html, js/content.js, js/season.js
/* tools/doctor.py, the one command that says in plain words what is wrong with the site and what to type (no browser needed; python3 and beautifulsoup4):
 *   - a healthy site (with its upload folder): exit 0, a green checklist, the last line READY TO UPLOAD
 *   - a broken copy for each check: a built page not rebuilt, a missing translation, a fact written two ways, a missing file, a typo in js/content.js
 *     (with Node: its line; without Node: a careful look that still names the line), a Search Console tag pasted inside the explaining comment,
 *     a host file saved as _redirects.txt or _headers deleted (the doctor and make_deploy_folder name each of the two files and where it ended up),
 *     an out-of-date upload folder, an upload folder that no longer
 *     matches its FILES.txt, no upload folder: exit 1, the matching RED line with where and the fix, and NOT READY: N things + the one next command
 *   - it never changes a file (every file of the copy is hashed before and after, and no new file or folder appears), never uses the network,
 *     works from any folder, in a folder name with spaces, with Windows line endings (CRLF), and without Node (a note, not a red line)
 *   - folders that can lie next to the site (patches/, review/, .venv) are not part of the upload: nothing red, still READY TO UPLOAD
 *   - tools/doctor.py is valid for Python 3.8
 * Everything happens in temporary copies of the site; your own files are not touched. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { ROOT, ok, info, skip, finish, ms } from './lib.mjs';

const PY = process.env.WA_PYTHON || 'python3';
const probe = (...args) => spawnSync(PY, args, { encoding: 'utf8', timeout: ms(60000) });
if (probe('-c', 'import bs4').status !== 0) skip(`${PY} with beautifulsoup4 is not available (pip install beautifulsoup4)`);
const PYTHON_PATH = (probe('-c', 'import sys; print(sys.executable)').stdout || PY).trim();

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-doctor-test-'));
const SKIP = /(^|[\\/])(\.git|node_modules|deploy|\.visual|__pycache__|tests)([\\/]|$)/;
const sha = (p) => crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex');
const snapshot = (dir) => {   // every file with its hash, and every folder: nothing may be added, removed or changed
  const out = [];
  (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) { const p = path.join(d, f.name); if (f.isDirectory()) { out.push('dir ' + path.relative(dir, p)); walk(p); } else out.push(path.relative(dir, p) + ' ' + sha(p)); } })(dir);
  return crypto.createHash('sha1').update(out.join('\n')).digest('hex') + ' (' + out.length + ' entries)';
};
const tempDoctorDirs = () => fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith('wa-doctor-') && !n.startsWith('wa-doctor-test-')).length;
const doctor = (dir, { env = {}, cwd = dir } = {}) => new Promise((resolve) => {
  const t0 = Date.now(), chunks = [];
  const withNode = { PATH: path.dirname(process.execPath) + path.delimiter + (process.env.PATH || '') };   // Node.js is on the PATH unless a case says otherwise
  const child = spawn(PYTHON_PATH, [path.join(dir, 'tools', 'doctor.py')], { cwd, env: { ...process.env, ...withNode, ...env, NO_COLOR: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  const timer = setTimeout(() => child.kill('SIGKILL'), ms(240000));
  child.stdout.on('data', (d) => chunks.push(d)); child.stderr.on('data', (d) => chunks.push(d));
  child.on('close', (code) => { clearTimeout(timer); resolve({ code, out: Buffer.concat(chunks).toString('utf8'), secs: (Date.now() - t0) / 1000 }); });
});
const lastLine = (s) => s.trim().split('\n').pop();
const reds = (s) => s.split('\n').filter((l) => /^ {2}RED /.test(l));
const tail = (s) => s.trim().split('\n').slice(-4).join(' | ');
const noNode = path.join(tmp, 'no-node-bin'); fs.mkdirSync(noNode);   // a PATH with no Node in it
const noBs4 = path.join(tmp, 'no-bs4'); fs.mkdirSync(noBs4); fs.writeFileSync(path.join(noBs4, 'bs4.py'), "raise ImportError(\"No module named 'bs4'\")\n");   // beautifulsoup4 "not installed"

try {
  // ---- the healthy site, with its upload folder made by the tool
  const A0 = path.join(tmp, 'A0');
  fs.cpSync(ROOT, A0, { recursive: true, filter: (p) => !SKIP.test(path.relative(ROOT, p)) });
  const made = spawnSync(PYTHON_PATH, ['tools/make_deploy_folder.py'], { cwd: A0, encoding: 'utf8', timeout: ms(300000) });
  ok('setup: the upload folder is made in a copy of the site', made.status === 0 && fs.existsSync(path.join(A0, 'deploy', 'FILES.txt')), tail((made.stdout || '') + (made.stderr || '')));

  const before = snapshot(A0), dirsBefore = tempDoctorDirs();
  const h = await doctor(A0, { cwd: os.tmpdir() });   // from another folder: it still looks at the site it sits in
  ok('a healthy site: exit 0 and the last line says READY TO UPLOAD (started from another folder)', h.code === 0 && /^READY TO UPLOAD: upload what is inside deploy\/ \(docs\/LAUNCH_CHECKLIST\.md, step 3\.2\)\. Afterwards: python3 tools\/launch_check\.py https:\/\/YOUR-ADDRESS\/$/.test(lastLine(h.out)) && reds(h.out).length === 0, tail(h.out));
  ok('...a checklist in plain words: setup, the site files, settings, the upload folder', ['1. Setup', '2. The site files', '3. Settings to look at before launch', '4. The upload folder'].every((x) => h.out.includes('\n' + x)) && /OK {4}Every language is complete \(texts translated: es \d+, hi \d+, vi \d+, zh \d+\)/.test(h.out) && /OK {4}The facts agree everywhere \(\d+ facts compared/.test(h.out) && /OK {4}js\/content\.js has no typo/.test(h.out) && /OK {4}deploy\/ is up to date/.test(h.out), h.out.slice(0, 600));
  ok('...launch settings still empty are "look", never red', /look {2}reviewUrl is empty/.test(h.out) && /look {2}farmPoint is not set/.test(h.out), h.out.split('\n').filter((l) => /^ {2}look/.test(l)).join(' | ').slice(0, 300));
  ok('...the two files the host reads are named: _headers is in the upload folder (where), _redirects is not and that can be fine (a "look" line)', /OK {4}_headers is in the upload folder, at its top \(deploy\/_headers\): the security notes and the cache times\. Cloudflare Pages and Netlify read it\./.test(h.out) && /look {2}_redirects is not in the upload folder, because your site folder has no _redirects file\. That is fine unless the new site takes over the old farm addresses; then follow checklist step 3\.6\./.test(h.out), h.out.split('\n').filter((l) => /_(headers|redirects)/.test(l)).join(' | ').slice(0, 300));
  ok('...the "look" lines are plain words: no question number and no decision number, and each says what to do', !/\b(question|decision) [DQ]?\d+/i.test(h.out) && /look {2}farmPoint is not set: .* put the farm's two map numbers on that line of js\/content\.js \(checklist, step 3\.13; the owner dashboard card is "The farm's exact spot on the map"\)/.test(h.out) && /look {2}reviewUrl is empty: .* paste the short review link from your Google Business Profile between the quote marks \(checklist, step 3\.12; the owner dashboard card is "Google review link"\)/.test(h.out), h.out.split('\n').filter((l) => /^ {2}look/.test(l)).join(' | ').slice(0, 400));
  ok('...it never changed a file of the site and left no new file or folder (every file hashed before and after)', snapshot(A0) === before, before + ' / ' + snapshot(A0));
  ok('...it cleaned up its temporary copy', tempDoctorDirs() === dirsBefore, `${dirsBefore} -> ${tempDoctorDirs()} folders named wa-doctor-*`);
  info(`healthy run: ${h.secs.toFixed(0)} s (on a quiet computer about 5 s; Node.js ${spawnSync('node', ['--version'], { encoding: 'utf8' }).stdout.trim()} is on the PATH)`);
  ok('...it is quick (under a minute even when the computer is busy)', h.secs < ms(60), h.secs + ' s');
  const src = fs.readFileSync(path.join(ROOT, 'tools', 'doctor.py'), 'utf8');
  ok('it never uses the network (no network module is imported)', !/^\s*(import|from)\s+.*\b(urllib|socket|http|ssl|ftplib|smtplib|requests|xmlrpc)\b/m.test(src), 'a network module is imported');

  // ---- one broken copy for each check (each starts from the healthy copy)
  const sub = (file, a, b) => (d) => { const p = path.join(d, file); const s = fs.readFileSync(p, 'utf8'); if (!s.includes(a)) throw new Error(`${file} has no ${a.slice(0, 40)}: this test needs the new wording`); fs.writeFileSync(p, s.replace(a, b)); };
  const NOTICE = "  noticeUntil: '',\n";
  const contentLine = fs.readFileSync(path.join(A0, 'js', 'content.js'), 'utf8').split('\n').findIndex((l) => l.startsWith('  closures: [],')) + 1;   // the line after the one that loses its comma
  const plainSentence = (() => { const m = fs.readFileSync(path.join(A0, 'pages', 'wise-pie.html'), 'utf8').match(/<p>([A-Z][^<]{20,}?\.)<\/p>/); return m && m; })();
  const TAG = '<meta name="google-site-verification" content="AbC123realCode9xyz">';
  const tagAt = (change) => (d) => { const p = path.join(d, 'index.html'), h = fs.readFileSync(p, 'utf8'), m = h.match(/<!-- GOOGLE SEARCH CONSOLE[\s\S]*?-->/); if (!m) throw new Error('index.html has no GOOGLE SEARCH CONSOLE comment'); fs.writeFileSync(p, h.replace(m[0], change(m[0], TAG))); };
  const cases = {
    stale: { mutate: sub('wise-pie.html', '</body>', '<!-- edited by hand --></body>') },
    translation: { mutate: plainSentence ? sub('pages/wise-pie.html', plainSentence[0], `<p>${plainSentence[1].replace(/\.$/, '')} (a new sentence).</p>`) : () => {} },
    fact: { mutate: sub('index.html', 'tel:+17042076347', 'tel:+17042076348') },
    missing: { mutate: (d) => fs.rmSync(path.join(d, 'assets', 'favicon.svg')) },
    typo: { mutate: sub('js/content.js', NOTICE, "  noticeUntil: ''\n") },
    typoNoNode: { mutate: sub('js/content.js', NOTICE, "  noticeUntil: ''\n"), env: { PATH: noNode } },
    healthyNoNode: { mutate: () => {}, env: { PATH: noNode } },
    noBs4: { mutate: () => {}, env: { PYTHONPATH: noBs4 } },
    tagHidden: { mutate: tagAt((c, tag) => c.replace(/\s*-->$/, ' ' + tag + ' -->')) },
    reviewNoSign: { mutate: sub('js/content.js', "  reviewUrl: '',", "  reviewUrl: 'https://g.page/r/CQ1aBcDeFgHiEAE/review',") },
    tagLive: { mutate: tagAt((c, tag) => c + '\n  ' + tag) },
    redirectsTxt: { mutate: (d) => fs.writeFileSync(path.join(d, '_redirects.txt'), '/old-farm-page /wise-pie 301\n') },
    noHeaders: { mutate: (d) => fs.rmSync(path.join(d, '_headers')) },
    extraFolders: { mutate: (d) => { fs.mkdirSync(path.join(d, 'patches', 'optional'), { recursive: true }); fs.writeFileSync(path.join(d, 'patches', 'optional', 'README.md'), '# x\n'); fs.writeFileSync(path.join(d, 'patches', 'optional', 'a.patch'), 'x\n'); fs.mkdirSync(path.join(d, 'review')); fs.writeFileSync(path.join(d, 'review', 'es.csv'), 'id,where\r\n'); fs.mkdirSync(path.join(d, '.venv', 'lib'), { recursive: true }); fs.writeFileSync(path.join(d, '.venv', 'lib', 'x.py'), 'x\n'); } },
    staleDeploy: { mutate: (d) => fs.appendFileSync(path.join(d, 'js', 'content.js'), '\n// a note written after the upload folder was made\n') },
    filesTxt: { mutate: (d) => { fs.appendFileSync(path.join(d, 'deploy', 'robots.txt'), '# changed by hand\n'); fs.writeFileSync(path.join(d, 'deploy', 'extra.txt'), 'x'); } },
    noDeploy: { mutate: (d) => fs.rmSync(path.join(d, 'deploy'), { recursive: true, force: true }) },
  };
  const results = {};
  const names = Object.keys(cases);
  let next = 0;
  await Promise.all([0, 1, 2, 3].map(async () => {   // four at a time
    while (next < names.length) {
      const name = names[next++], c = cases[name], d = path.join(tmp, 'case-' + name);
      fs.cpSync(A0, d, { recursive: true });
      await c.mutate(d);
      const pre = snapshot(d), r = await doctor(d, { env: c.env });
      results[name] = { ...r, readOnly: snapshot(d) === pre };
    }
  }));
  const R = results;
  const onlyOne = (r) => reds(r.out).length === 1 && /^NOT READY: 1 thing to fix\. Next: python3 tools\/make_deploy_folder\.py$/.test(lastLine(r.out));

  ok('a built page that was not rebuilt: one RED line naming the page, and the one command that fixes it', R.stale.code === 1 && /RED {3}These built files are out of date .*: wise-pie\.html/.test(R.stale.out) && /Fix: {3}python3 tools\/make_deploy_folder\.py {3}\(it rebuilds them/.test(R.stale.out) && onlyOne(R.stale), tail(R.stale.out));
  if (plainSentence) {
    const t = R.translation.out;
    ok('a sentence with no translation yet: one RED line for each language with the counts, where, and the command to list the words', R.translation.code === 1 && ['es', 'hi', 'vi', 'zh'].every((c) => new RegExp(`RED {3}${c} is not complete: 1 page text\\(s\\) and 0 text\\(s\\) written by the code have no translation yet\\.`).test(t) && new RegExp(`Where: lang/src/${c}\\.json`).test(t) && new RegExp(`Fix: {3}python3 tools/i18n\\.py missing ${c} --list {3}shows them; add each one to lang/src/${c}\\.json, then run python3 tools/i18n\\.py build`).test(t)), tail(t));
    ok('...and the last line counts the red things and gives the first command (what is done by hand comes before rebuilding)', /^NOT READY: \d+ things to fix\. Next: python3 tools\/i18n\.py missing es --list$/.test(lastLine(t)), lastLine(t));
  } else info('(the missing-translation case was skipped: no plain sentence found in pages/wise-pie.html)');
  ok('a fact written two ways (a phone number): one RED line with the two numbers, where to see every place, and the command', R.fact.code === 1 && /RED {3}A fact is written two ways: two different day-of emergency numbers: 704-207-6347, 704-207-6348/.test(R.fact.out) && /Where: every place is listed, with its words, by the command below/.test(R.fact.out) && /Fix: {3}python3 tools\/check_facts\.py/.test(R.fact.out), tail(R.fact.out));
  ok('a file the pages point to is missing: the RED line names the page and the file to search for', R.missing.code === 1 && /RED {3}\d+ link\(s\) in the pages point to a file that is not there: .*assets\/favicon\.svg/.test(R.missing.out) && /Where: \S+\.html \(search for \/?assets\/favicon\.svg in that file\)/.test(R.missing.out), tail(R.missing.out));
  ok('a typo in js/content.js (Node.js on the PATH): the RED line gives the error and its line, what the usual causes are, and what visitors would see', R.typo.code === 1 && /RED {3}js\/content\.js has a typo: SyntaxError: Unexpected identifier 'closures'\. Until it is fixed, the notice bar, hours, closures, photos and reviews are all off, and visitors see no message\./.test(R.typo.out) && new RegExp(`Where: js/content\\.js, line ${contentLine}\\b`).test(R.typo.out) && /Fix: {3}Look at that line and the one above it: a missing comma/.test(R.typo.out) && /OK {4}Node\.js v/.test(R.typo.out), tail(R.typo.out));
  ok('the same typo without Node.js: a note (not red) that Node is missing, and a careful look that still names the line and the missing comma', R.typoNoNode.code === 1 && /look {2}Node\.js was not found\. You do not need it/.test(R.typoNoNode.out) && new RegExp(`RED {3}js/content\\.js has a typo at line ${contentLine}: a comma is probably missing at the end of line ${contentLine - 1}, before this one\\. .*\\(Found without Node\\.js, which looks less carefully\\.\\)`).test(R.typoNoNode.out) && new RegExp(`Where: js/content\\.js, line ${contentLine}\\b`).test(R.typoNoNode.out), tail(R.typoNoNode.out));
  ok('a healthy site without Node.js: exit 0, READY TO UPLOAD, Node is only a "look" line and js/content.js is said to be checked less carefully', R.healthyNoNode.code === 0 && /^READY TO UPLOAD/.test(lastLine(R.healthyNoNode.out)) && reds(R.healthyNoNode.out).length === 0 && /look {2}Node\.js was not found/.test(R.healthyNoNode.out) && /OK {4}js\/content\.js looks fine \(checked less carefully, without Node\.js/.test(R.healthyNoNode.out), tail(R.healthyNoNode.out));
  ok('beautifulsoup4 not installed: one RED line with the pip command (the rebuild-based checks are skipped and said to be), the other checks still run', R.noBs4.code === 1 && /RED {3}beautifulsoup4 is not installed, so the pages and translations cannot be rebuilt or checked\. You need it as soon as you edit a file in pages\/ or lang\/src\/, and for the upload folder\./.test(R.noBs4.out) && /Fix: {3}python3 -m pip install beautifulsoup4 {3}\(if pip answers "externally-managed-environment" on a new Mac or Linux computer, or you made a \.venv folder and have not switched it on in this window: README, "Commands on Windows, Mac and Linux", step 4\)/.test(R.noBs4.out) && /look {2}The pages, translations and language check were skipped/.test(R.noBs4.out) && /OK {4}The facts agree everywhere/.test(R.noBs4.out) && /OK {4}Every file the pages point to is there/.test(R.noBs4.out) && /^NOT READY: 1 thing to fix\. Next: python3 -m pip install beautifulsoup4$/.test(lastLine(R.noBs4.out)), tail(R.noBs4.out));
  ok('a Search Console tag pasted inside the explaining comment (where it does nothing): a RED line that says so, where, and to move it below the comment', R.tagHidden.code === 1 && /RED {3}The Google Search Console tag \(content="AbC123realCo\.\.\."\) is in index\.html, but inside the explaining comment/.test(R.tagHidden.out) && /Where: index\.html, the comment that starts "GOOGLE SEARCH CONSOLE"/.test(R.tagHidden.out) && /Fix: {3}cut the whole line .* BELOW that comment, after its closing -->/.test(R.tagHidden.out), tail(R.tagHidden.out));
  ok('a review link set but no printable review sign made yet: a "look" line (not red) that says to run make_qr.py', /look {2}reviewUrl is set, but the printable review sign \(print\/qr-signs\.html\) does not carry that link yet/.test(R.reviewNoSign.out) && /make_qr\.py/.test(R.reviewNoSign.out) && !/look {2}reviewUrl is empty/.test(R.reviewNoSign.out), tail(R.reviewNoSign.out));
  ok('the same tag on a line of its own below the comment: no RED line about it, and an OK line', !/Search Console tag/.test(reds(R.tagLive.out).join('\n')) && /OK {4}The Google Search Console tag is in the head of index\.html/.test(R.tagLive.out), tail(R.tagLive.out));
  ok('a host file saved as _redirects.txt: a RED line that says the host will not read it, and to rename it', R.redirectsTxt.code === 1 && /RED {3}_redirects is NOT in the upload folder: your site folder has "_redirects\.txt", and the host does not read a file with that ending\./.test(R.redirectsTxt.out) && /Fix: {3}rename it to _redirects \(no \.txt at the end\), then make the upload folder again/.test(R.redirectsTxt.out), tail(R.redirectsTxt.out));
  ok('_headers deleted from the site folder: a RED line (the host would add no security notes and no cache times) and how to get it back', R.noHeaders.code === 1 && /RED {3}_headers is NOT in the upload folder, because your site folder has no _headers file\. Without it the host adds no security notes and no cache times\./.test(R.noHeaders.out) && /Fix: {3}put _headers back from your backup/.test(R.noHeaders.out), tail(R.noHeaders.out));
  ok('a patches/ folder, a review/ folder and a .venv folder lying in the site folder: nothing red, still READY TO UPLOAD (they are not part of the upload and are not "out of date" or "should not be in it")', R.extraFolders.code === 0 && /^READY TO UPLOAD/.test(lastLine(R.extraFolders.out)) && reds(R.extraFolders.out).length === 0, tail(R.extraFolders.out));
  ok('an upload folder that is out of date (a file of the site changed after it was made): one RED line naming the file, and the one command', R.staleDeploy.code === 1 && /RED {3}deploy\/ is out of date: the site has changed since it was made: js\/content\.js is older than the site/.test(R.staleDeploy.out) && /Fix: {3}python3 tools\/make_deploy_folder\.py/.test(R.staleDeploy.out) && onlyOne(R.staleDeploy), tail(R.staleDeploy.out));
  ok('an upload folder that no longer matches its FILES.txt (a file changed, a file added by hand): named', R.filesTxt.code === 1 && /RED {3}deploy\/ does not match its own FILES\.txt \(someone changed a file inside it\): .*robots\.txt was changed.*extra\.txt is not listed/.test(R.filesTxt.out) && /Where: deploy\/FILES\.txt/.test(R.filesTxt.out) && /it makes the folder again from scratch/.test(R.filesTxt.out), tail(R.filesTxt.out));
  ok('no upload folder yet: one RED line and the command that makes it', R.noDeploy.code === 1 && /RED {3}There is no upload folder yet \(deploy\/ with its FILES\.txt\)\./.test(R.noDeploy.out) && /Where: deploy\//.test(R.noDeploy.out) && onlyOne(R.noDeploy), tail(R.noDeploy.out));
  const unchanged = names.filter((n) => !R[n].readOnly);
  ok('read-only proof: in every broken copy too, not one file was changed, added or removed by the doctor', unchanged.length === 0, 'changed in: ' + unchanged.join(', '));
  info('seconds per run: ' + names.map((n) => `${n} ${R[n].secs.toFixed(0)}`).join(', '));

  // ---- the careful look without Node, on its own: each kind of typo is named with its line
  const lines = fs.readFileSync(path.join(A0, 'js', 'content.js'), 'utf8');
  const kinds = [
    ['an apostrophe inside single quotes', "  notice: '',", "  notice: 'We're closed',", /not closed on this line \(an apostrophe inside single quotes/],
    ['a curly quote mark', "  notice: '',", '  notice: “Closed”,', /a curly quote mark/],
    ['a bracket that is closed twice', '  closures: [],', '  closures: []],', /a closing \] that has no opening \[|a closing \] here/],
    ['the final } missing', '\n};\n', '\n', /never closed/],
    ['a comment that never ends', "  notice: '',", "  /* x\n  notice: '',", /never closed with \*\//],
    ['a comma missing between two photos', '},\n    { src:', '}\n    { src:', /comma is probably missing/],
  ];
  const probe2 = spawnSync(PYTHON_PATH, ['-c', `import sys, json
sys.path.insert(0, ${JSON.stringify(path.join(A0, 'tools'))}); sys.dont_write_bytecode = True
import doctor
cases = json.load(sys.stdin)
print(json.dumps([doctor.js_problem(c) for c in cases]))`], { input: JSON.stringify([lines, ...kinds.map(([, a, b]) => { if (!lines.includes(a)) throw new Error('content.js has no ' + a.trim()); return lines.replace(a, b); })]), encoding: 'utf8', timeout: ms(60000) });
  const found = JSON.parse(probe2.stdout || '[]');
  ok('the careful look (without Node) finds nothing wrong in the real js/content.js', found[0] === null, JSON.stringify(found[0]));
  kinds.forEach(([what, , , rx], i) => ok(`...and names ${what}, with a line number`, Array.isArray(found[i + 1]) && Number.isInteger(found[i + 1][0]) && rx.test(found[i + 1][1]), JSON.stringify(found[i + 1])));

  // ---- the wrong folder
  const bare = path.join(tmp, 'bare'); fs.mkdirSync(path.join(bare, 'tools'), { recursive: true }); fs.copyFileSync(path.join(ROOT, 'tools', 'doctor.py'), path.join(bare, 'tools', 'doctor.py'));
  const w = await doctor(bare);
  ok('started where there is no site: it says so and how to start it from the website folder (no Python error)', w.code === 1 && /RED {3}I cannot find index\.html next to the tools folder, so this is not the website folder\./.test(w.out) && /Fix: {2}open a terminal in the website folder .* python3 tools\/doctor\.py/.test(w.out) && !/Traceback/.test(w.out), tail(w.out));

  // ---- a folder name with spaces, and files with Windows line endings (CRLF)
  const B = path.join(tmp, 'my site (copy)');
  fs.cpSync(A0, B, { recursive: true });
  const TEXT = /\.(html|js|css|json|md|txt|xml|webmanifest|py|svg)$/i;
  let converted = 0;
  (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (TEXT.test(f.name)) { const s = fs.readFileSync(p, 'utf8'); if (!s.includes('\r\n')) { fs.writeFileSync(p, s.replace(/\n/g, '\r\n')); converted++; } } } })(B);
  const madeB = spawnSync(PYTHON_PATH, ['tools/make_deploy_folder.py'], { cwd: B, encoding: 'utf8', timeout: ms(300000) });
  ok(`setup: the same site in a folder named "my site (copy)", ${converted} files with Windows line endings, and its upload folder`, madeB.status === 0 && fs.existsSync(path.join(B, 'deploy', 'FILES.txt')), tail((madeB.stdout || '') + (madeB.stderr || '')));
  const preB = snapshot(B);
  const hb = await doctor(B, { cwd: os.tmpdir() });
  ok('a site in a folder with spaces and CRLF files: exit 0 and READY TO UPLOAD, from another folder', hb.code === 0 && /^READY TO UPLOAD/.test(lastLine(hb.out)) && reds(hb.out).length === 0 && hb.out.includes('looking at ' + B), tail(hb.out));
  ok('...and it changed nothing there either', snapshot(B) === preB, 'changed');
  fs.writeFileSync(path.join(B, 'js', 'content.js'), fs.readFileSync(path.join(B, 'js', 'content.js'), 'utf8').replace("  noticeUntil: '',\r\n", "  noticeUntil: ''\r\n"));
  const tb = await doctor(B, { cwd: os.tmpdir() });
  ok('a typo in a CRLF js/content.js: the same line number as in a file with Unix line endings', tb.code === 1 && new RegExp(`Where: js/content\\.js, line ${contentLine}\\b`).test(tb.out), tail(tb.out));

  // ---- valid for Python 3.8
  const py38 = spawnSync('python3.8', ['--version'], { encoding: 'utf8' });
  const compile = (code) => spawnSync(code[0], code.slice(1), { encoding: 'utf8', timeout: ms(60000) });
  const SYNTAX = 'import ast, sys\nfor f in sys.argv[1:]:\n    with open(f, encoding="utf-8") as fh:\n        ast.parse(fh.read(), filename=f' + ', feature_version=(3, 8))\nprint("ok")';
  const files = ['doctor.py', 'make_deploy_folder.py', 'check_facts.py'].map((f) => path.join(ROOT, 'tools', f));
  const c38 = py38.status === 0 ? compile(['python3.8', '-W', 'error', '-c', SYNTAX.replace(', feature_version=(3, 8)', ''), ...files]) : compile([PYTHON_PATH, '-W', 'error', '-c', SYNTAX, ...files]);
  ok(`tools/doctor.py (and the tools it uses) are valid Python 3.8 (${py38.status === 0 ? 'checked with python3.8' : 'checked with this Python, parsing as 3.8'})`, c38.status === 0 && /ok/.test(c38.stdout), (c38.stderr || '').trim().split('\n').pop());
  if (py38.status === 0) {   // really run it with Python 3.8 (beautifulsoup4 may not be installed for it: then it must say so, not crash)
    const r38 = spawnSync('python3.8', [path.join(A0, 'tools', 'doctor.py')], { cwd: A0, encoding: 'utf8', timeout: ms(240000), env: { ...process.env, NO_COLOR: '1' } });
    const out38 = (r38.stdout || '') + (r38.stderr || '');
    ok('run by Python 3.8 itself: no Python error, and it ends with READY TO UPLOAD or NOT READY', !/Traceback/.test(out38) && /^(READY TO UPLOAD|NOT READY)/.test(lastLine(out38)) && [0, 1].includes(r38.status), tail(out38));
  } else info('(no python3.8 on this computer: the run under 3.8 was skipped)');
} catch (e) {
  ok('doctor: the test ran to the end', false, String(e && e.stack ? e.stack.split('\n').slice(0, 3).join(' / ') : e));
}
await finish({});
fs.rmSync(tmp, { recursive: true, force: true });
