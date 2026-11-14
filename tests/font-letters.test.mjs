// order: 73
// browser: no
// covers: assets/fonts/*, tools/font_subset.py, tools/fonts-full/*, *.html, pages/*, js/*, css/*, lang/*, print/*, tools/qr_links.json, tools/notice_phrases.json
/* The slim fonts (no browser, under 5 seconds). The three Latin font files in assets/fonts are made by tools/font_subset.py from the
 * full fonts in tools/fonts-full: only the letters the site can show are kept, so every page is lighter on a phone.
 *   - every letter that a page, a script, a translation or a printed sign uses, and that the full font has, is in the slim font
 *     (a new letter, say in a name, fails here with the letter's name until the tool is run again: python3 tools/font_subset.py)
 *   - a slim font has no letter the full font does not have, and it is smaller than the full font
 *   - the full fonts are there for the tool (they are not uploaded)
 * The fonts are read here directly (the letter table inside the .woff2), so the test needs no tools. */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { ROOT, ok, info, finish } from './lib.mjs';

const FONTS = ['caveat-latin-700-normal.woff2', 'fredoka-latin-wght-normal.woff2', 'nunito-latin-wght-normal.woff2'];
// The same list as TEXT in tools/font_subset.py: every file whose words can reach a screen or a printed sign.
const TEXT = [['.', /\.html$/], ['js', /\.js$/], ['css', /\.css$/], ['lang', /\.js$/], ['lang/src', /\.json$/], ['print', /\.html$/], ['pages', /\.html$/], ['tools', /^(qr_links|notice_phrases)\.json$/]];

const KNOWN_TAGS = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];

/** The code points a .woff2 font has a drawing for (its cmap table). */
function letters(file) {
  const b = fs.readFileSync(file);
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
  let off = 0, cm = null;
  for (const t of tables) { if (t.tag === 'cmap') cm = data.subarray(off, off + t.length); off += t.length; }
  if (!cm) throw new Error('no cmap table');
  const out = new Set(), count = cm.readUInt16BE(2);
  for (let i = 0; i < count; i++) {
    const s = cm.readUInt32BE(4 + i * 8 + 4), format = cm.readUInt16BE(s);
    if (format === 4) {
      const segs = cm.readUInt16BE(s + 6) / 2, ends = s + 14, starts = ends + segs * 2 + 2, deltas = starts + segs * 2, ranges = deltas + segs * 2;
      for (let k = 0; k < segs; k++) {
        const end = cm.readUInt16BE(ends + k * 2), start = cm.readUInt16BE(starts + k * 2), delta = cm.readUInt16BE(deltas + k * 2), range = cm.readUInt16BE(ranges + k * 2);
        for (let c = start; c <= end && c !== 0xFFFF; c++) {
          let g;
          if (range === 0) g = (c + delta) & 0xFFFF;
          else { g = cm.readUInt16BE(ranges + k * 2 + range + (c - start) * 2); if (g) g = (g + delta) & 0xFFFF; }
          if (g) out.add(c);
        }
      }
    } else if (format === 12) {
      const groups = cm.readUInt32BE(s + 12);
      for (let k = 0; k < groups; k++) { const a = cm.readUInt32BE(s + 16 + k * 12), z = cm.readUInt32BE(s + 20 + k * 12); for (let c = a; c <= z; c++) out.add(c); }
    }
  }
  return out;
}

const used = new Set();
let files = 0;
for (const [dir, rx] of TEXT) {
  const d = path.join(ROOT, dir);
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d).sort()) {
    if (!rx.test(f) || !fs.statSync(path.join(d, f)).isFile()) continue;
    files++;
    for (const ch of fs.readFileSync(path.join(d, f), 'utf8')) used.add(ch.codePointAt(0));
  }
}
ok('the files with the site\'s words were read (pages, scripts, styles, translations, signs)', files > 30 && used.size > 150, `${files} files, ${used.size} different letters and signs`);

const show = (c) => `${String.fromCodePoint(c)} (U+${c.toString(16).toUpperCase().padStart(4, '0')})`;
for (const name of FONTS) {
  const fullPath = path.join(ROOT, 'tools', 'fonts-full', name), slimPath = path.join(ROOT, 'assets', 'fonts', name);
  const there = fs.existsSync(fullPath) && fs.existsSync(slimPath);
  ok(`${name}: the full font is in tools/fonts-full and the slim one in assets/fonts`, there, 'tools/font_subset.py makes the slim font from the full one');
  if (!there) continue;
  const full = letters(fullPath), slim = letters(slimPath);
  const missing = [...used].filter((c) => full.has(c) && !slim.has(c)).sort((a, b) => a - b);
  ok(`${name}: every letter the site uses is in the font (${slim.size} of the full font's ${full.size} are kept)`, missing.length === 0,
    `missing: ${missing.map(show).join(', ')}  -> run: python3 tools/font_subset.py`);
  const extra = [...slim].filter((c) => !full.has(c));
  ok(`${name}: it is the full font with letters left out, nothing else (no new letter, and a smaller file)`, extra.length === 0 && slim.size > 100 && fs.statSync(slimPath).size < fs.statSync(fullPath).size,
    `${extra.length} letters the full font does not have; ${fs.statSync(slimPath).size} bytes against ${fs.statSync(fullPath).size}`);
}
info('A letter that is left out is not lost on a page: the browser draws that one letter in the stand-in font.');
finish();
