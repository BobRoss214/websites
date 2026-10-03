/* Keeps the notes in README.md, docs/ and tests/README.md true to the files they talk about (no browser needed): no line numbers,
 * every place a note names by its words is still in that file, every file path in backticks exists, every relative link and #anchor
 * works, and every python3 tools/... or node tests/... command names a script that exists.
 *
 * A place in a file is named by words you can find with Ctrl+F (an id, a data-t, a setting name, a test's name, a few words of the
 * line), never by a line number, which moves every time a line is added above it. The notes write it like this (see "How the docs
 * point into files" in docs/DECISION_PLAYBOOK.md):
 *     index.html at `id="pizza"`                  the words occur once in the file
 *     index.html at `data-t="t559ec077"` (2 places)    ... or exactly as often as the note says
 *     js/content.js from `hours: {` to `week:`     a stretch of lines
 *     `index.html` at `...`, consistency at `...`  the file name may be in backticks; a test may be named by its short name
 *     README row "Farm map", README.md, section "Languages"
 * A setting the farm fills in later (reviewUrl, farmPoint, signup.action in js/content.js) is named by its name only, never by today's value:
 *     js/content.js at `reviewUrl:` (2 places), not at `reviewUrl: ''`
 * The value changes when the owner types hers, and a note that quotes the empty value would then turn this test red although it is still right.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, ok, info, finish } from './lib.mjs';

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const exists = (f) => fs.existsSync(path.join(ROOT, f));
const DOCS = ['README.md', 'tests/README.md', ...fs.readdirSync(path.join(ROOT, 'docs')).filter((f) => f.endsWith('.md')).map((f) => 'docs/' + f)];
const TEXT = Object.fromEntries(DOCS.map((d) => [d, read(d)]));
const lineOf = (s, i) => s.slice(0, i).split('\n').length;

// Files that are made by a tool or by npm and are not in the repository; the docs may name them before they exist.
const MADE_LATER = [/^deploy(\/|$)/, /^review(\/|$)/, /^FILES\.txt$/, /^node_modules(\/|$)/, /^tests\/node_modules(\/|$)/, /^axe\.min\.js$/, /^tests\/\.visual(\/|$)/, /^report\.html$/,
  /^tests\/package-lock\.json$/, /^assets\/badges\/$/];
// Names that are only examples in the text (a photo you might add, a test you might write).
const EXAMPLES = ['picture.jpg', 'assets/photos/goat-in-frog-hat.webp', 'assets/og-pumpkin-patch-2.png', 'something.test.mjs'];
// Lines that list files in other projects' repositories (the sources a doc was checked against), not files here.
const OTHER_REPO = /public repositor|documentation source/;
// Paths that are examples or patterns, not files: placeholders like <code> or NAME, globs, and other people's sites.
const NOT_A_PATH = (p) => /[<>*{}$]|\bNAME\b|\bXX\b|\.\.\.|^https?:|^\/\/|^www\.|@/.test(p);

// The tests can be named by their short name, as the docs do: "consistency at `...`" means tests/consistency.test.mjs.
const TESTS = fs.readdirSync(path.join(ROOT, 'tests')).filter((f) => f.endsWith('.test.mjs')).map((f) => f.replace('.test.mjs', ''));
const FILE = String.raw`(?:[\w-]+/)*[\w.-]+\.(?:html|js|mjs|css|json|py|md|txt|xml|svg|webmanifest)`;
const FILE_OR_TEST = '(?:' + FILE + '|' + TESTS.map((t) => t.replace(/[-]/g, '\\-')).join('|') + ')';
const resolveFile = (name, doc) => {
  if (TESTS.includes(name)) return 'tests/' + name + '.test.mjs';
  for (const c of [name, path.posix.join(path.posix.dirname(doc), name), 'pages/' + name, 'tests/' + name, 'docs/' + name]) if (exists(c)) return c;
  return null;
};

/* ---- 1. No line numbers ---- */
// file:12, file:12-20, file:12, 30; "(:153)" and "consistency :325" (short forms for a line in a test); "index.html line 1714", "lines 1736-1738"
const LINE_REFS = [
  new RegExp('`?(' + FILE + ')`?:\\d+', 'g'),
  new RegExp('(?<![\\w/.:-])(?:' + TESTS.join('|') + ')? ?\\(?:\\d{1,4}(?:[-–]\\d+)?\\b(?![:.]\\d)', 'g'),
  /\b(?:[Ll]ines?|[Aa]bout line) \d{1,4}\b(?! (?:words|characters|lines|or more|languages|signs))/g,
];
// Notes about history that may name line numbers on purpose (they describe an old version, which does not move), as
// { doc: 'docs/NAME.md', words: 'words on that line' }. Empty today; keep it short.
const HISTORY_OK = [];
const bare = [];
for (const d of DOCS) {
  for (const re of LINE_REFS) {
    for (const m of TEXT[d].matchAll(re)) {
      const at = d + ':' + lineOf(TEXT[d], m.index);
      if (HISTORY_OK.some((h) => h.doc === d && TEXT[d].split('\n')[lineOf(TEXT[d], m.index) - 1].includes(h.words))) continue;
      if (/^\d{1,2}:\d\d/.test(m[0].replace(/^\D*/, ''))) continue;   // a clock time
      bare.push(at + ' "' + m[0].trim() + '"');
    }
  }
}
ok('no doc points into a file by line number (' + DOCS.length + ' docs; use words you can find with Ctrl+F instead)', bare.length === 0, bare.slice(0, 12).join('; ') + (bare.length > 12 ? ' and ' + (bare.length - 12) + ' more' : ''));

/* ---- 2. Every place named by words is still there ---- */
// FILE at `A`, `B` (2 places) and `C`      FILE from `A` to `B`      `FILE` at `A` (a note)      consistency at `A`
const ONE = '`(?!`?(?:' + FILE_OR_TEST + ')`?,? (?:at|from|near) )[^`\\n]+`(?: \\([^()`\\n]*\\))?';   // a note in brackets may follow each one: ($750, up to 50 guests), (2 places)
const SEP = '(?:, (?:and |or |then )?(?:from )?| and (?:from )?| or | to | then | from )';
const AT = new RegExp('(?<![\\w/.-])`?(' + FILE_OR_TEST + ')`?(?: test)?,? (?:at|from|near) (' + ONE + '(?:' + SEP + ONE + ')*)', 'g');
let anchors = 0;
const lost = [], noFile = [];
for (const d of DOCS) {
  for (const m of TEXT[d].matchAll(AT)) {
    const f = resolveFile(m[1], d);
    const at = d + ':' + lineOf(TEXT[d], m.index);
    if (!f) { noFile.push(at + ' ' + m[1]); continue; }
    const body = read(f);
    for (const a of m[2].matchAll(/`([^`\n]+)`(?: \((\d+) places\b[^()`\n]*\))?/g)) {
      anchors++;
      const want = a[2] ? +a[2] : 1;
      const n = body.split(a[1]).length - 1;
      if (n !== want) lost.push(at + ' ' + f + ' `' + a[1] + '` is in the file ' + n + ' time' + (n === 1 ? '' : 's') + (want === 1 ? '' : ', the doc says ' + want));
    }
  }
}
ok('every place a doc names with "FILE at `words`" is still in that file, once (or as often as the doc says): ' + anchors + ' checked', anchors > 0 && lost.length === 0 && noFile.length === 0,
  noFile.map((x) => 'no such file: ' + x).concat(lost).slice(0, 12).join('; ') + (lost.length > 12 ? ' and ' + (lost.length - 12) + ' more' : ''));

// README rows and doc sections named in the docs: README row "Farm map", README rows "A" and "B", FILE, section "Heading", FILE, sections "A" and "B"
// (a section is named by the start of its heading, a row by the start of its first cell)
const README_ROWS = read('README.md').split('\n').filter((l) => l.startsWith('|')).map((l) => l.slice(1).split('|')[0].replace(/\*\*/g, '').trim());
const rowsMissing = [], sectionsMissing = [];
let rowsChecked = 0, sectionsChecked = 0;
for (const d of DOCS) {
  for (const m of TEXT[d].matchAll(/\bREADME(?:\.md)?,? (?:table )?rows? ((?:"[^"\n]+"(?:,? (?:and|or) |, )?)+)/g)) {
    for (const r of m[1].matchAll(/"([^"\n]+)"/g)) {
      rowsChecked++;
      if (!README_ROWS.some((c) => c.startsWith(r[1]))) rowsMissing.push(d + ':' + lineOf(TEXT[d], m.index) + ' "' + r[1] + '"');
    }
  }
  for (const m of TEXT[d].matchAll(new RegExp('`?(' + FILE + ')`?, (?:the )?sections? ((?:"[^"\\n]+"(?: \\([^()\\n]*\\))?(?:,? (?:and|or) |, )?)+)', 'g'))) {
    const f = resolveFile(m[1], d);
    const heads = f ? read(f).split('\n').filter((l) => /^#{1,6} /.test(l)).map((l) => l.replace(/^#+ /, '').replace(/\*\*|`/g, '')) : [];
    for (const h of m[2].replace(/\([^()]*\)/g, '').matchAll(/"([^"\n]+)"/g)) {   // the notes in brackets are not section names
      sectionsChecked++;
      if (!heads.some((l) => l.startsWith(h[1]))) sectionsMissing.push(d + ':' + lineOf(TEXT[d], m.index) + ' ' + m[1] + ' "' + h[1] + '"');
    }
  }
}
ok('every README row named in the docs is in the README table (' + rowsChecked + ' checked)', rowsMissing.length === 0, rowsMissing.join('; '));
ok('every doc section named as FILE, section "..." exists (' + sectionsChecked + ' checked)', sectionsMissing.length === 0, sectionsMissing.join('; '));

/* ---- 3. File paths in backticks exist ---- */
const KNOWN_DIR = /^(assets|css|js|lang|pages|print|tools|tests|docs)\//;
const WEB_ADDRESS = /^[\w-]+(?:\.[\w-]+)+\//;
const SITE_FILE = /\.(html|js|mjs|css|json|py|md|png|jpg|jpeg|webp|svg|ico|txt|xml|webmanifest|woff2)$/;
const missingPaths = [];
let pathsChecked = 0;
const ALL_FILES = [];
const walk = (dir) => { for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) { if (['.git', 'node_modules'].includes(e.name)) continue; const rel = dir ? dir + '/' + e.name : e.name; if (e.isDirectory()) walk(rel); else ALL_FILES.push(rel); } };
walk('');
for (const d of DOCS) {
  for (const m of TEXT[d].matchAll(/`([^`\n]+)`/g)) {
    let p = m[1].trim();
    // the path at the start of a command or a "file: setting" note: `python3 tools/i18n.py build`, `js/content.js: hours`
    if (/^(python3?|node|cd|npx|open|start) /.test(p) || /\s/.test(p)) continue;
    p = p.replace(/^\.\//, '').replace(/[#?].*$/, '').replace(/:$/, '');
    if (NOT_A_PATH(p) || !/^[\w./-]+$/.test(p) || p.startsWith('.') || EXAMPLES.includes(p)) continue;
    if (OTHER_REPO.test(TEXT[d].split('\n')[lineOf(TEXT[d], m.index) - 1])) continue;
    // a path into one of the site's folders, or a file name with a site file's extension; not a web address such as bookeo.com/wiseacres
    if (!(KNOWN_DIR.test(p) || (!WEB_ADDRESS.test(p) && SITE_FILE.test(p)))) continue;
    if (p.startsWith('/')) continue;                     // an address on the live site, not a file here
    if (MADE_LATER.some((r) => r.test(p))) continue;
    pathsChecked++;
    const found = p.includes('/') ? exists(p) || exists(path.posix.join(path.posix.dirname(d), p)) : ALL_FILES.some((f) => f === p || f.endsWith('/' + p));
    if (!found) missingPaths.push(d + ':' + lineOf(TEXT[d], m.index) + ' `' + m[1] + '`');
  }
}
ok('every file path in backticks in the docs exists (' + pathsChecked + ' checked; files made later by a tool or npm are left out)', missingPaths.length === 0, missingPaths.slice(0, 15).join('; ') + (missingPaths.length > 15 ? ' and ' + (missingPaths.length - 15) + ' more' : ''));

/* ---- 4. Relative links and #anchors ---- */
// GitHub's way of turning a heading into an #anchor: lower case, punctuation dropped, spaces to hyphens
const slug = (h) => h.trim().toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
const slugsOf = (f) => { const seen = {}; return read(f).split('\n').filter((l) => /^#{1,6} /.test(l)).map((l) => { const s = slug(l.replace(/^#+ /, '').replace(/`/g, '')); const n = seen[s] = (seen[s] ?? -1) + 1; return n ? s + '-' + n : s; }); };
const badLinks = [];
let linksChecked = 0;
for (const d of DOCS) {
  for (const m of TEXT[d].matchAll(/\]\(([^)\s]+)\)/g)) {
    const href = m[1];
    if (/^(https?:|mailto:|tel:)/.test(href)) continue;
    linksChecked++;
    const [file, hash] = href.split('#');
    const target = file ? path.posix.normalize(path.posix.join(path.posix.dirname(d), file)) : d;
    if (!exists(target)) { badLinks.push(d + ':' + lineOf(TEXT[d], m.index) + ' ' + href + ' (no such file)'); continue; }
    if (hash && target.endsWith('.md') && !slugsOf(target).includes(decodeURIComponent(hash))) badLinks.push(d + ':' + lineOf(TEXT[d], m.index) + ' ' + href + ' (no such heading)');
  }
}
ok('every relative link in the docs opens a file that exists, at a heading that exists (' + linksChecked + ' checked)', badLinks.length === 0, badLinks.join('; '));

/* ---- 5. Commands name scripts that exist ---- */
const badCmds = [];
let cmdsChecked = 0;
for (const d of DOCS) {
  for (const m of TEXT[d].matchAll(/\b(?:python3?|node) ((?:tools|tests)\/[\w./-]+)/g)) {
    if (NOT_A_PATH(m[1])) continue;
    cmdsChecked++;
    if (!exists(m[1])) badCmds.push(d + ':' + lineOf(TEXT[d], m.index) + ' ' + m[0]);
  }
}
ok('every "python3 tools/..." and "node tests/..." command in the docs names a script that exists (' + cmdsChecked + ' checked)', cmdsChecked > 10 && badCmds.length === 0, badCmds.join('; '));

/* ---- 6. Nothing points outside the repository ---- */
// A path on the helper's own computer (a scratch folder, /tmp, a home folder) means nothing to the owner and breaks when the repo moves.
const outside = [];
for (const d of DOCS) {
  for (const m of TEXT[d].matchAll(/(?:\/tmp\/|\/root\/|\/home\/[\w-]+\/|\bscratchpad\/|C:\\Users\\)[^\s`)|"]*/g)) outside.push(d + ':' + lineOf(TEXT[d], m.index) + ' ' + m[0]);
}
ok('no doc names a file outside the repository (a helper\'s scratch folder, /tmp or a home folder)', outside.length === 0, outside.slice(0, 10).join('; ') + (outside.length > 10 ? ' and ' + (outside.length - 10) + ' more' : ''));

/* ---- 7. The decision playbook has a table row, a topic and an entry for every dashboard question ---- */
// Without this a question added to the dashboard (d43 to d45 were) can be missing from the playbook for days without anyone noticing, and a title
// changed in the table but not in the entry (or the other way round) goes unseen. (The dashboard itself is not in the repository, so its texts
// cannot be compared here: whoever changes a dashboard text changes the playbook with it.)
{
  const pb = TEXT['docs/DECISION_PLAYBOOK.md'];
  const part = (from, to) => { const a = pb.indexOf(from); if (a < 0) return ''; const b = pb.indexOf(to, a + from.length); return pb.slice(a, b < 0 ? undefined : b); };
  const rows = new Map([...part('### Every dashboard question, and its doc number', '\n### ').matchAll(/^\| (d\d\d) \| ([^|]+?) \| ([^|]+?) \|$/gm)].map((m) => [m[1], { title: m[2], doc: m[3] }]));
  const entries = new Map([...pb.matchAll(/^### (d\d\d)\. (.+)$/gm)].map((m) => [m[1], m[2].trim()]));
  const topics = new Set([...part('## The 10 topics', '\n## ').matchAll(/\bd\d\d\b/g)].map((m) => m[0]));
  const noNumber = new Set([...part('### Dashboard questions with no number in the doc', '\n## ').matchAll(/^\| (d\d\d) \|/gm)].map((m) => m[1]));
  const problems = [];
  const top = Math.max(0, ...[...rows.keys()].map((k) => +k.slice(1)));
  for (let n = 1; n <= top; n++) { const id = 'd' + String(n).padStart(2, '0'); if (!rows.has(id)) problems.push(id + ' has no row in "Every dashboard question, and its doc number"'); }
  for (const [id, r] of rows) {
    if (!entries.has(id)) problems.push(id + ' has no "### ' + id + '." entry');
    else if (entries.get(id) !== r.title) problems.push(id + ' is called "' + r.title + '" in the table and "' + entries.get(id) + '" in its entry');
    if (!topics.has(id)) problems.push(id + ' is in no topic of "The 10 topics"');
    const noDoc = r.doc === 'none' || r.doc.startsWith('related');   // "related: Q25" (d29) is a note, not a number
    if (noDoc !== noNumber.has(id)) problems.push(id + (noDoc ? ' has no doc number but is not in' : ' has a doc number but is in') + ' "Dashboard questions with no number in the doc"');
  }
  for (const id of entries.keys()) if (!rows.has(id)) problems.push(id + ' has an entry but no table row');
  for (const id of topics) if (!rows.has(id)) problems.push(id + ' is in a topic but has no table row');
  ok('the decision playbook has a table row, a topic and an entry for every dashboard question (' + rows.size + ' questions, d01 to d' + String(top).padStart(2, '0') + ')', rows.size > 40 && problems.length === 0, problems.slice(0, 8).join('; ') + (problems.length > 8 ? ' and ' + (problems.length - 8) + ' more' : ''));
}

info(DOCS.length + ' docs: ' + DOCS.join(', '));
await finish();
