// order: 72
// browser: no
// covers: assets/fonts/*, assets/CREDITS.txt, assets/LICENSE-*, docs/CREDITS_AND_LICENCES.md, index.html, tools/make_deploy_folder.py, js/farm-map-data.js
/* Licences and credits (no browser, under 5 seconds): the work of other people that the site ships is recorded, and what its licences ask for travels with it.
 *   - every font file in assets/fonts has a licence file in the same folder, named for the font's family (LICENSE-OFL-<Family>.txt); the font's own
 *     copyright line (read from the name table inside the .woff2, no tools needed) is the first line of that file, the font says it is under the OFL, and the
 *     text under it is the SIL Open Font License 1.1 word for word (a fingerprint of the real text, taken from the Fontsource packages the fonts came from)
 *   - the icon licences (Feather MIT, Lucide ISC) are there and every icon docs/CREDITS_AND_LICENCES.md says is taken from them is in index.html
 *   - assets/CREDITS.txt names every family, both icon sets and OpenStreetMap, and every file it points to exists
 *   - docs/CREDITS_AND_LICENCES.md: every row has who/licence/evidence, "done" is yes, no or n/a, every path it names exists, every font file is in a row,
 *     and a row that says "yes" names a licence file that exists
 *   - nothing is loaded from another site (no outside script, style sheet or font), and no script or style sheet carries a licence banner of its own
 *     (a library pasted in would): if one is added, the table needs a row first
 *   - the upload tool (tools/make_deploy_folder.py) carries the licence files and stops when a font lacks its licence
 * When it fails: add the licence file next to the font (copy the LICENSE from the font's npm package, exactly), add a row to the table, or take the pasted code out. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { ROOT, ok, info, finish } from './lib.mjs';

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const exists = (f) => fs.existsSync(path.join(ROOT, f));
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

// The text of the SIL Open Font License 1.1 (from "SIL OPEN FONT LICENSE" to the end), as every Fontsource package ships it. Legal text: it is never reworded.
const OFL_BODY_SHA = 'ebc109078c06f79af74cf2b27454c262830d12a65749f0e2bf25d1ac1db7a02a';
// The full licence files of the two icon sets, as their npm packages ship them (feather-icons 4.29.2, lucide-static 1.51.0).
const ICON_LICENCES = { 'assets/LICENSE-icons-Feather-MIT.txt': ['308028e93fcf84972523cdf6e616f73168546b4953895f516d01287f16fe7bee', /MIT License[\s\S]*Cole Bemis/], 'assets/LICENSE-icons-Lucide-ISC.txt': ['b495047bd93a9b06913511076f504daba17d5bbeb3e0650f3bb53a4220329c57', /ISC License[\s\S]*Lucide/] };
// The drawings in index.html that are taken from Feather or Lucide (docs/CREDITS_AND_LICENCES.md, "How the icons were matched").
const ICONS = ['i-phone', 'i-mail', 'i-pin', 'i-calendar', 'i-instagram', 'i-facebook', 'i-bell', 'i-clock', 'i-info', 'i-cash', 'i-leaf', 'i-external'];

/* ---------------------------------------------------------------- the name table of a .woff2 (the font's own copyright line) */
const KNOWN_TAGS = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];
function fontNames(file) {
  const b = fs.readFileSync(path.join(ROOT, file));
  if (b.toString('latin1', 0, 4) !== 'wOF2') throw new Error('not a WOFF2 file');
  const n = b.readUInt16BE(12), compressed = b.readUInt32BE(20);
  let p = 48;
  const base128 = () => { let v = 0; for (let i = 0; i < 5; i++) { const c = b[p++]; v = v * 128 + (c & 127); if (!(c & 128)) return v; } throw new Error('bad length'); };
  const tables = [];
  for (let i = 0; i < n; i++) {
    const flags = b[p++], idx = flags & 63, version = flags >> 6;
    let tag;
    if (idx === 63) { tag = b.toString('latin1', p, p + 4); p += 4; } else tag = KNOWN_TAGS[idx];
    const orig = base128(), transformed = tag === 'glyf' || tag === 'loca' ? version !== 3 : version !== 0;
    tables.push({ tag, length: transformed ? base128() : orig });
  }
  const data = zlib.brotliDecompressSync(b.subarray(p, p + compressed));
  let off = 0, nm = null;
  for (const t of tables) { if (t.tag === 'name') nm = data.subarray(off, off + t.length); off += t.length; }
  if (!nm) throw new Error('no name table');
  const count = nm.readUInt16BE(2), strings = nm.readUInt16BE(4), out = {};
  for (let i = 0; i < count; i++) {
    const r = 6 + i * 12, platform = nm.readUInt16BE(r), id = nm.readUInt16BE(r + 6), len = nm.readUInt16BE(r + 8), at = strings + nm.readUInt16BE(r + 10);
    if (platform !== 3 || out[id]) continue;   // the Windows (UTF-16) names
    out[id] = Buffer.from(nm.subarray(at, at + len)).swap16().toString('utf16le');
  }
  return out;
}

/* ---------------------------------------------------------------- 1. fonts */
const fontDir = 'assets/fonts';
const fonts = fs.readdirSync(path.join(ROOT, fontDir)).filter((f) => /\.(woff2?|ttf|otf)$/i.test(f)).sort();
ok('there are font files to check in assets/fonts (and they are all .woff2: the name-table reader below needs that)', fonts.length >= 4 && fonts.every((f) => f.endsWith('.woff2')), fonts.join(', '));
const bodies = new Set();
for (const f of fonts) {
  const family = f.split('-')[0];
  const Family = family[0].toUpperCase() + family.slice(1);
  const lic = `${fontDir}/LICENSE-OFL-${Family}.txt`;
  let names = {};
  try { names = fontNames(`${fontDir}/${f}`); } catch (e) { ok(`${f}: the name table can be read`, false, e.message); continue; }
  ok(`${f}: the licence file ${lic} is next to it`, exists(lic));
  if (!exists(lic)) continue;
  const text = read(lic), first = text.split('\n')[0].trim(), body = text.slice(text.indexOf('-----------------------------------------------------------\nSIL OPEN FONT LICENSE'));
  bodies.add(sha(body));
  ok(`${f}: the font says "${(names[0] || '').slice(0, 52)}..." and that is the first line of ${path.basename(lic)}`, !!names[0] && first.startsWith(names[0].trim()), `font: "${names[0]}" / file: "${first.slice(0, 120)}"`);
  ok(`${f}: the font names the SIL Open Font License as its licence (name table), like the licence file`, /scripts\.sil\.org\/OFL/.test(names[14] || '') && /SIL Open Font License, Version 1\.1/.test(text), String(names[14]));
  ok(`${f}: the family in the font ("${names[1]}") is the one in the licence file's name (${Family})`, (names[1] || '').toLowerCase().startsWith(family.toLowerCase()) && text.includes(`The ${Family} Project Authors`), String(names[1]));
  ok(`${path.basename(lic)}: no Reserved Font Name (the font may be used as it is)`, !/Reserved Font Name[s]?\)?\s*[:"]|with Reserved Font Name/i.test(text.split('\n').slice(0, 4).join(' ')));
}
ok('the licence text under each font is the SIL Open Font License 1.1, word for word (fingerprint of the real text)', bodies.size === 1 && bodies.has(OFL_BODY_SHA), [...bodies].join(', '));
ok('no licence file is left without a font (a font that was taken out takes its licence with it)', fs.readdirSync(path.join(ROOT, fontDir)).filter((f) => /^LICENSE-OFL-/.test(f)).every((f) => fonts.some((x) => x.split('-')[0].toLowerCase() === f.replace(/^LICENSE-OFL-|\.txt$/g, '').toLowerCase())));

/* ---------------------------------------------------------------- 2. icons */
for (const [f, [want, re]] of Object.entries(ICON_LICENCES)) ok(`${f} is the licence file of its package, unchanged`, exists(f) && sha(fs.readFileSync(path.join(ROOT, f))) === want && re.test(read(f)));
const home = read('index.html');
ok(`the ${ICONS.length} icons that come from Feather and Lucide are in index.html`, ICONS.every((i) => home.includes(`<symbol id="${i}"`)), ICONS.filter((i) => !home.includes(`<symbol id="${i}"`)).join(', '));
ok('index.html says, next to the icons, where their licences are', /UI ICONS[^\n]*Feather \(MIT\)[^\n]*Lucide \(ISC\)[^\n]*assets\/CREDITS\.txt/.test(home));

/* ---------------------------------------------------------------- 3. assets/CREDITS.txt */
const credits = exists('assets/CREDITS.txt') ? read('assets/CREDITS.txt') : '';
ok('assets/CREDITS.txt names every font family, both icon sets, and OpenStreetMap with its copyright page', ['Fredoka', 'Nunito', 'Caveat', 'Feather', 'Lucide', 'OpenStreetMap contributors', 'openstreetmap.org/copyright', 'OSRM', 'Nominatim'].every((w) => credits.includes(w)));
const named = [...credits.matchAll(/\bassets\/[\w./-]+\.txt\b/g)].map((m) => m[0]);
ok(`every licence file that assets/CREDITS.txt points to exists (${named.length})`, named.length >= 5 && named.every(exists), named.filter((f) => !exists(f)).join(', '));
ok('the copyright lines in assets/CREDITS.txt are the ones in the licence files', ['fredoka', 'nunito', 'caveat'].every((k) => { const lic = read(`${fontDir}/LICENSE-OFL-${k[0].toUpperCase() + k.slice(1)}.txt`).split('\n')[0].match(/Copyright \d{4} The \w+ Project Authors \([^)]+\)/); return lic && credits.includes(lic[0]); }));

/* ---------------------------------------------------------------- 4. the table in docs/CREDITS_AND_LICENCES.md */
const doc = read('docs/CREDITS_AND_LICENCES.md');
const tableStart = doc.indexOf('| # | What |');
const rows = doc.slice(tableStart).split('\n').slice(2).filter((l) => /^\| L\d+ \|/.test(l)).map((l) => l.split(/ \| /).map((c) => c.replace(/^\|\s*|\s*\|$/g, '').trim()));
const cols = ['#', 'What', 'Where', 'Who', 'Licence', 'Asks', 'Done', 'Evidence'];
ok('the table has its rows (L1, L2, ...) with eight columns each', rows.length >= 15 && rows.every((r) => r.length === cols.length), rows.filter((r) => r.length !== cols.length).map((r) => r[0] + ' has ' + r.length).join(', '));
const bad = (fn) => rows.filter((r) => !fn(r)).map((r) => r[0]).join(', ');
ok('every row says who made it, which licence, what the licence asks, and has evidence (more than a few words, with a file name or a number in it)', rows.every((r) => [3, 4, 5].every((i) => r[i].length > 3) && r[7].length > 25 && (/`[^`]+`/.test(r[7]) || /\d/.test(r[7]))), bad((r) => [3, 4, 5].every((i) => r[i].length > 3) && r[7].length > 25 && (/`[^`]+`/.test(r[7]) || /\d/.test(r[7]))));
ok('"Done" is yes, no or n/a in every row', rows.every((r) => /^(\*\*)?(yes|no|n\/a)\b/.test(r[6])), bad((r) => /^(\*\*)?(yes|no|n\/a)\b/.test(r[6])));
const paths = (cell) => [...cell.matchAll(/`([\w.-]+(?:\/[\w.-]+)+)`/g)].map((m) => m[1]).filter((p) => /\.(html|js|mjs|css|json|py|md|txt|xml|svg|webmanifest|png|webp|woff2)$/.test(p) || /\/$/.test(p));
const gone = rows.flatMap((r) => [...paths(r[2]), ...paths(r[6]), ...paths(r[7])].filter((p) => !exists(p)).map((p) => r[0] + ': ' + p));
ok('every file the table names exists (the third-party items are really where the table says)', gone.length === 0, gone.join(', '));
ok('a row that says "yes" names the licence file that makes it yes, and the file exists', rows.filter((r) => /^yes/.test(r[6])).every((r) => paths(r[6]).length > 0 && paths(r[6]).every(exists)), rows.filter((r) => /^yes/.test(r[6]) && !paths(r[6]).length).map((r) => r[0]).join(', '));
const inTable = (f) => rows.some((r) => r[2].includes(f));
ok('every font file in assets/fonts is in the table (a new font needs a row first)', fonts.every(inTable), fonts.filter((f) => !inTable(f)).join(', '));
const need = [['Fredoka', /Fredoka/], ['Nunito', /Nunito/], ['Caveat', /Caveat/], ['the icons', /Feather/], ['OpenStreetMap', /OpenStreetMap/], ['the map traced from the aerial picture', /aerial/], ['the photos', /photos/]];
ok('the table has a row for each of: ' + need.map((n) => n[0]).join(', '), need.every(([, re]) => rows.some((r) => re.test(r[1] + ' ' + r[2] + ' ' + r[3] + ' ' + r[4] + ' ' + r[7]))), need.filter(([, re]) => !rows.some((r) => re.test(r.join(' ')))).map((n) => n[0]).join(', '));
ok('what is still open is not hidden: a row with "no" is named in the summary at the top of the document', rows.filter((r) => /^(\*\*)?no\b/.test(r[6])).every((r) => doc.slice(0, tableStart).includes('row ' + r[0])), rows.filter((r) => /^(\*\*)?no\b/.test(r[6])).map((r) => r[0]).join(', '));
info(`${rows.length} rows: ${rows.filter((r) => /^yes/.test(r[6])).length} done, ${rows.filter((r) => /^(\*\*)?no\b/.test(r[6])).length} open (${rows.filter((r) => /^(\*\*)?no\b/.test(r[6])).map((r) => r[0]).join(', ')}), ${rows.filter((r) => /^n\/a/.test(r[6])).length} n/a`);

/* ---------------------------------------------------------------- 5. nothing pasted in, nothing loaded from elsewhere */
const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
const outside = [];
for (const f of pages) {
  const html = read(f).replace(/<!--[\s\S]*?-->/g, '');
  for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) if (/^(https?:)?\/\//.test(m[1])) outside.push(f + ': script ' + m[1]);
  for (const m of html.matchAll(/<link\b[^>]*\brel="(?:stylesheet|preload|modulepreload)"[^>]*\bhref="([^"]+)"/g)) if (/^(https?:)?\/\//.test(m[1])) outside.push(f + ': ' + m[1]);
  for (const m of html.matchAll(/<link\b[^>]*\bhref="([^"]+)"[^>]*\brel="(?:stylesheet|preload|modulepreload)"/g)) if (/^(https?:)?\/\//.test(m[1])) outside.push(f + ': ' + m[1]);
}
ok(`no page loads a script, style sheet or font from another site (${pages.length} pages read)`, pages.length >= 7 && outside.length === 0, outside.join(' | '));
const cssFiles = fs.readdirSync(path.join(ROOT, 'css')).filter((f) => f.endsWith('.css')).map((f) => 'css/' + f);
const outsideCss = cssFiles.flatMap((f) => [...read(f).matchAll(/url\(\s*["']?(https?:\/\/[^)"']+)/g)].map((m) => f + ': ' + m[1]));
ok('no style sheet loads a font or picture from another site', outsideCss.length === 0, outsideCss.join(' | '));
const code = [...fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f), ...cssFiles];
const banner = /@license|@preserve|^\s*\/\*!|\bcopyright\s*(?:\(c\)|©|&copy;)|\(c\)\s*(?:19|20)\d\d\b|\bSPDX-License/im;
const pasted = code.filter((f) => !/^js\/(farm-map-data|content)\.js$/.test(f) && banner.test(read(f)));
ok(`no script or style sheet carries a licence banner of its own (${code.length} files read: a pasted library would)`, pasted.length === 0, pasted.join(', '));
const longest = code.map((f) => [f, Math.max(...read(f).split('\n').map((l) => l.length))]).filter(([f, n]) => n > 6000 && !/^js\/farm-map-data\.js$/.test(f));
ok('no script or style sheet has a line over 6000 letters (shrunk code is somebody else\'s library)', longest.length === 0, longest.map(([f, n]) => f + ' ' + n).join(', '));

/* ---------------------------------------------------------------- 6. the upload carries them */
const tool = read('tools/make_deploy_folder.py');
const folders = [...(tool.match(/^FOLDERS\s*=\s*\[([^\]]*)\]/m) || [, ''])[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const leftOut = [...(tool.match(/^LEFT_OUT_INSIDE\s*=\s*\[([\s\S]*?)^\]/m) || [, ''])[1].matchAll(/\(\s*'([^']+)'\s*,/g)].map((m) => m[1]);
const junk = new RegExp((tool.match(/^JUNK\s*=\s*re\.compile\(r'(.*)',\s*re\.I\)/m) || [, '$^'])[1], 'i');
const licenceFiles = [...fs.readdirSync(path.join(ROOT, fontDir)).filter((f) => /^LICENSE-/.test(f)).map((f) => `${fontDir}/${f}`), ...Object.keys(ICON_LICENCES), 'assets/CREDITS.txt'];
ok(`the upload tool copies assets/ and leaves out none of the ${licenceFiles.length} licence and credit files, and does not take them for junk`, folders.includes('assets') && licenceFiles.every((f) => !leftOut.some((p) => f.startsWith(p)) && !junk.test(f)), licenceFiles.filter((f) => leftOut.some((p) => f.startsWith(p)) || junk.test(f)).join(', '));
ok('the upload tool stops when a font in the folder has no licence file (it checks assets/fonts/LICENSE-OFL-)', /LICENSE-OFL-/.test(tool) && /def licence_problems/.test(tool));
ok('the audit of the upload (tests/files-audit.test.mjs) knows these files are meant to be uploaded although no page points to them', /assets\/fonts\/LICENSE-OFL-/.test(read('tests/files-audit.test.mjs')) && /assets\/CREDITS\.txt/.test(read('tests/files-audit.test.mjs')));

await finish({});
