// order: 70
// browser: no
// covers: assets/*, css/*, js/*, *.html, manifest.webmanifest, tools/add_photo.py, tools/make_deploy_folder.py
/* What the site ships and what is hidden in it (no browser needed):
 *   - no picture the visitor can download carries a GPS location, a camera make or model, a serial number, a person's name, a comment, XMP/IPTC data,
 *     a taken-at time or a hidden preview picture (tools/add_photo.py strips all of this from every new photo; this catches anything added by hand)
 *   - SVG files hold no script, no link to another site and no editor notes
 *   - every file a page, style, script, manifest or the sitemap points to under assets/ exists (a commented-out example is not a pointer)
 *   - every file in assets/ is used by something, or is on the list just below (so nothing dead is uploaded), and no two uploaded files are the same
 *   - nothing uploaded is a surprise in size (a phone original, a scan)
 * The checker is tried first on pictures made here with a GPS location, a camera name and so on, so it cannot go blind without a failure. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, ok, finish } from './lib.mjs';

// ---- the lists to edit ------------------------------------------------------------------------------------------------------------------
// Files under assets/ that nothing points to, on purpose. Anything else in assets/ that no page, style, script or manifest uses fails the test.
const NOT_USED = [
  ['assets/qr/', 'the QR codes as separate files for a print shop (made by tools/make_qr.py); print/qr-signs.html has its own copy of each, and they are not uploaded'],
];
// Files under assets/ that nothing points to but that ARE uploaded, on purpose: the licence texts and credits that travel with the fonts and the icons
// (the font licence asks for it; docs/CREDITS_AND_LICENCES.md, tests/licences.test.mjs).
const UPLOADED_ON_PURPOSE = ['assets/fonts/LICENSE-OFL-', 'assets/LICENSE-icons-', 'assets/CREDITS.txt'];
// What a picture may still say about itself: how to turn it, its resolution, its colour space and its size. Everything else in EXIF is refused.
const HARMLESS_EXIF = new Set([0x0112, 0x011A, 0x011B, 0x0128, 0x0213, 0x8769, 0x9000, 0x9101, 0xA000, 0xA001, 0xA002, 0xA003, 0xA005, 0x0001, 0x0002]);
const MAX_BYTES = 1_000_000;      // a shipped picture is not heavier than this (the biggest today, the printed menu, is 0.44 MB)
const MAX_SIDE = 2400;            // ... and not wider or taller than this (add_photo.py makes photos at most 1400)
// -----------------------------------------------------------------------------------------------------------------------------------------

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const walk = (dir, out = []) => { for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) { const rel = (dir ? dir + '/' : '') + e.name; if (e.isDirectory()) { if (!['node_modules', '.git', '.visual', '__pycache__', 'deploy'].includes(e.name)) walk(rel, out); } else out.push(rel); } return out; };

// ---- what is uploaded: the same rules as tools/make_deploy_folder.py (FOLDERS, TOP_FILES, LEFT_OUT_INSIDE)
const deploySrc = read('tools/make_deploy_folder.py');
const folders = [...(deploySrc.match(/^FOLDERS\s*=\s*\[([^\]]*)\]/m) || [, ''])[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const topFiles = [...(deploySrc.match(/^TOP_FILES\s*=\s*\[([^\]]*)\]/m) || [, ''])[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const leftOut = [...(deploySrc.match(/^LEFT_OUT_INSIDE\s*=\s*\[([\s\S]*?)^\]/m) || [, ''])[1].matchAll(/\(\s*'([^']+)'\s*,/g)].map((m) => m[1]);
const everything = walk('');
const shipped = everything.filter((f) => (folders.some((d) => f.startsWith(d + '/')) || !f.includes('/') && (f.endsWith('.html') || topFiles.includes(f))) && !leftOut.some((p) => f === p || f.startsWith(p)) && !/(^|\/)(\.[^/]*|__pycache__)(\/|$)|\.(py|md|orig|rej|bak)$/i.test(f));
ok('the upload rules were read from tools/make_deploy_folder.py (folders, top files, left-out parts)', folders.length >= 4 && leftOut.length >= 1 && shipped.length > 40, `${folders.length} folders, ${leftOut.length} left out, ${shipped.length} files`);

// ---- reading what is hidden in a picture ----------------------------------------------------------------------------------------------
const EXIF_NAMES = { 0x010E: 'ImageDescription', 0x010F: 'camera Make', 0x0110: 'camera Model', 0x0131: 'Software', 0x0132: 'DateTime', 0x013B: 'Artist (a person)', 0x8298: 'Copyright (a person)',
  0x8825: 'GPS location', 0x9003: 'DateTimeOriginal', 0x9004: 'DateTimeDigitized', 0x9286: 'UserComment', 0x927C: 'MakerNote', 0xA420: 'ImageUniqueID', 0xA430: 'CameraOwnerName',
  0xA431: 'camera BodySerialNumber', 0xA435: 'LensSerialNumber', 0x9C9B: 'XPTitle', 0x9C9C: 'XPComment', 0x9C9D: 'XPAuthor (a person)', 0x9C9E: 'XPKeywords', 0x9C9F: 'XPSubject' };

/** Hidden things in a block of EXIF/TIFF data: returns a list of plain words ([] = nothing but the harmless tags). */
function exifProblems(buf) {
  if (buf.slice(0, 6).toString('latin1') === 'Exif\0\0') buf = buf.slice(6);
  const le = buf.slice(0, 2).toString('latin1') === 'II';
  if (!le && buf.slice(0, 2).toString('latin1') !== 'MM') return ['EXIF data that cannot be read'];
  const u16 = (o) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o)), u32 = (o) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
  const found = new Set(); let thumb = false;
  const ifd = (off, depth, first) => {
    if (off < 8 || off + 2 > buf.length || depth > 3) return;
    const n = u16(off);
    for (let i = 0; i < n && off + 2 + i * 12 + 12 <= buf.length; i++) {
      const e = off + 2 + i * 12, tag = u16(e);
      if (!HARMLESS_EXIF.has(tag)) found.add(EXIF_NAMES[tag] || 'EXIF tag 0x' + tag.toString(16));
      if (tag === 0x8769 || tag === 0xA005) ifd(u32(e + 8), depth + 1, false);
    }
    const next = off + 2 + n * 12 + 4 <= buf.length ? u32(off + 2 + n * 12) : 0;
    if (first && next) thumb = true;      // a second block of tags is the little preview picture (a thumbnail)
  };
  try { ifd(u32(4), 0, true); } catch (e) { return ['EXIF data that cannot be read']; }
  return [...found, ...(thumb ? ['a hidden preview picture (thumbnail)'] : [])];
}

/** Everything a picture file says about itself that a visitor could download: [] = clean. Returns { problems, size: [w, h] } */
function inspect(name, buf) {
  const ext = name.toLowerCase().split('.').pop(), problems = [];
  let size = null;
  if (ext === 'webp') {
    if (buf.slice(0, 4).toString('latin1') !== 'RIFF' || buf.slice(8, 12).toString('latin1') !== 'WEBP') return { problems: ['not a WebP file'], size };
    for (let i = 12; i + 8 <= buf.length;) {
      const tag = buf.slice(i, i + 4).toString('latin1'), len = buf.readUInt32LE(i + 4), body = buf.slice(i + 8, i + 8 + len);
      if (tag === 'EXIF') problems.push(...exifProblems(body));
      else if (tag === 'XMP ') problems.push('XMP data');
      else if (tag === 'VP8X') size = [1 + body.readUIntLE(4, 3), 1 + body.readUIntLE(7, 3)];
      else if (tag === 'VP8 ' && !size && body.length > 10) size = [body.readUInt16LE(6) & 0x3fff, body.readUInt16LE(8) & 0x3fff];
      else if (tag === 'VP8L' && !size && body.length > 5) { const b = body.readUInt32LE(1); size = [(b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1]; }
      i += 8 + len + (len & 1);
    }
  } else if (ext === 'png') {
    if (buf.slice(1, 4).toString('latin1') !== 'PNG') return { problems: ['not a PNG file'], size };
    for (let i = 8; i + 12 <= buf.length;) {
      const len = buf.readUInt32BE(i), tag = buf.slice(i + 4, i + 8).toString('latin1'), body = buf.slice(i + 8, i + 8 + len);
      if (tag === 'IHDR') size = [body.readUInt32BE(0), body.readUInt32BE(4)];
      else if (tag === 'eXIf') problems.push(...exifProblems(body));
      else if (['tEXt', 'iTXt', 'zTXt'].includes(tag)) problems.push(`a text note (${body.slice(0, body.indexOf(0) > 0 ? body.indexOf(0) : 12).toString('latin1')})`);
      else if (tag === 'tIME') problems.push('the time it was saved');
      i += 12 + len;
    }
  } else if (ext === 'jpg' || ext === 'jpeg') {
    if (buf[0] !== 0xFF || buf[1] !== 0xD8) return { problems: ['not a JPEG file'], size };
    for (let i = 2; i + 4 <= buf.length;) {
      if (buf[i] !== 0xFF) break;
      const marker = buf[i + 1], len = buf.readUInt16BE(i + 2), body = buf.slice(i + 4, i + 2 + len);
      if (marker === 0xDA) break;
      if (marker >= 0xC0 && marker <= 0xCF && ![0xC4, 0xC8, 0xCC].includes(marker)) size = [body.readUInt16BE(3), body.readUInt16BE(1)];
      if (marker === 0xE1 && body.slice(0, 6).toString('latin1') === 'Exif\0\0') problems.push(...exifProblems(body));
      else if (marker === 0xE1 && /ns\.adobe\.com\/xap/.test(body.slice(0, 40).toString('latin1'))) problems.push('XMP data');
      else if (marker === 0xED) problems.push('IPTC / Photoshop data');
      else if (marker === 0xFE) problems.push('a comment');
      i += 2 + len;
    }
  } else if (ext === 'svg') {
    const s = buf.toString('utf8');
    if (/<script/i.test(s)) problems.push('a script');
    if (/\son[a-z]+\s*=|javascript:/i.test(s)) problems.push('an event handler or javascript: link');
    if (/(?:href|src)\s*=\s*["']\s*(?:https?:)?\/\//i.test(s) || /url\(\s*["']?\s*https?:/i.test(s)) problems.push('a link to another site');
    if (/<!--/.test(s)) problems.push('a comment (editor notes)');
    if (/<metadata|<rdf:|sodipodi:|inkscape:|xmlns:(?:inkscape|sodipodi|dc|cc|rdf)|<\?xml-stylesheet|illustrator|<foreignObject/i.test(s)) problems.push('metadata or editor data');
  } else if (ext === 'woff2') {
    if (buf.slice(0, 4).toString('latin1') !== 'wOF2') return { problems: ['not a WOFF2 font'], size };
    if (buf.readUInt32BE(28) || buf.readUInt32BE(36)) problems.push('a metadata or private block');
  } else if (ext === 'ico') { /* an icon holds no notes */ } else problems.push('a kind of file this test cannot look into (' + ext + '): teach files-audit.test.mjs about it first');
  return { problems, size };
}

// ---- the checker is tried on pictures made here ------------------------------------------------------------------------------------------
const le16 = (n) => Buffer.from([n & 255, n >> 8]), le32 = (n) => Buffer.from([n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255]);
/** A small EXIF block: entries [tag, value] (SHORT or inline), optionally a GPS block and a second (thumbnail) block. */
function exifBlock(entries, { gps = false, thumb = false } = {}) {
  const all = entries.map(([tag, v]) => Buffer.concat([le16(tag), le16(3), le32(1), le16(v), le16(0)]));
  const gpsOff = 8 + 2 + (entries.length + (gps ? 1 : 0)) * 12 + 4;
  if (gps) all.push(Buffer.concat([le16(0x8825), le16(4), le32(1), le32(gpsOff)]));
  const ifd0 = Buffer.concat([le16(all.length), ...all, le32(thumb ? 8 + 2 + all.length * 12 + 4 + (gps ? 2 + 12 + 4 : 0) : 0)]);
  const parts = [Buffer.from('II*\0', 'latin1'), le32(8), ifd0];
  if (gps) parts.push(Buffer.concat([le16(1), le16(0x0001), le16(2), le32(2), Buffer.from('N\0\0\0', 'latin1'), le32(0)]));
  if (thumb) parts.push(Buffer.concat([le16(0), le32(0)]));
  return Buffer.concat(parts);
}
const chunk = (tag, body) => Buffer.concat([Buffer.from(tag, 'latin1'), le32(body.length), body, body.length & 1 ? Buffer.alloc(1) : Buffer.alloc(0)]);
const webp = (...chunks) => { const body = Buffer.concat([Buffer.from('WEBP', 'latin1'), ...chunks]); return Buffer.concat([Buffer.from('RIFF', 'latin1'), le32(body.length), body]); };
const pngChunk = (tag, body) => Buffer.concat([Buffer.from([body.length >>> 24, (body.length >> 16) & 255, (body.length >> 8) & 255, body.length & 255]), Buffer.from(tag, 'latin1'), body, Buffer.alloc(4)]);
const png = (...chunks) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), pngChunk('IHDR', Buffer.from([0, 0, 0, 8, 0, 0, 0, 8, 8, 2, 0, 0, 0])), ...chunks, pngChunk('IEND', Buffer.alloc(0))]);
const jpeg = (...segs) => Buffer.concat([Buffer.from([0xFF, 0xD8]), ...segs, Buffer.from([0xFF, 0xD9])]);
const seg = (marker, body) => Buffer.concat([Buffer.from([0xFF, marker, (body.length + 2) >> 8, (body.length + 2) & 255]), body]);
const vp8 = chunk('VP8 ', Buffer.concat([Buffer.alloc(6), le16(16), le16(16), Buffer.alloc(4)]));
const has = (name, buf, word) => inspect(name, buf).problems.some((p) => p.includes(word));
const harmless = exifBlock([[0x0112, 1], [0x011A, 72], [0xA001, 65535]]);
ok('the checker finds a GPS location, a camera make and a hidden preview in a WebP, and passes a WebP with only a turn and a resolution',
  has('a.webp', webp(vp8, chunk('EXIF', exifBlock([[0x0112, 1]], { gps: true }))), 'GPS') && has('a.webp', webp(vp8, chunk('EXIF', exifBlock([[0x010F, 1]]))), 'camera Make')
  && has('a.webp', webp(vp8, chunk('EXIF', exifBlock([[0x0112, 1]], { thumb: true }))), 'thumbnail') && has('a.webp', webp(vp8, chunk('XMP ', Buffer.from('<x:xmpmeta/>'))), 'XMP')
  && inspect('a.webp', webp(vp8, chunk('EXIF', harmless))).problems.length === 0);
ok('the checker finds EXIF, text notes and the save time in a PNG, and EXIF, XMP, IPTC and comments in a JPEG',
  has('a.png', png(pngChunk('eXIf', exifBlock([[0x0112, 1]], { gps: true }))), 'GPS') && has('a.png', png(pngChunk('tEXt', Buffer.from('Author\0Jane'))), 'Author') && has('a.png', png(pngChunk('tIME', Buffer.alloc(7))), 'time')
  && has('a.jpg', jpeg(seg(0xE1, Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), exifBlock([[0x0110, 1]], { gps: true })]))), 'GPS') && has('a.jpg', jpeg(seg(0xFE, Buffer.from('taken by Jane'))), 'comment')
  && has('a.jpg', jpeg(seg(0xED, Buffer.from('Photoshop 3.0\0'))), 'IPTC') && has('a.jpg', jpeg(seg(0xE1, Buffer.from('http://ns.adobe.com/xap/1.0/\0<x/>'))), 'XMP')
  && inspect('a.png', png()).problems.length === 0 && inspect('a.jpg', jpeg(seg(0xE1, Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), harmless])))).problems.length === 0);
ok('the checker finds a script, a link to another site and editor notes in an SVG, and passes a plain drawing',
  has('a.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'script') && has('a.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><image href="https://x.example/a.png"/></svg>'), 'another site')
  && has('a.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><!-- Created with Inkscape --></svg>'), 'comment') && has('a.svg', Buffer.from('<svg xmlns:inkscape="x"/>'), 'editor data')
  && inspect('a.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><path d="M0 0h8v8z"/></svg>')).problems.length === 0);

// ---- what is uploaded ------------------------------------------------------------------------------------------------------------------
const pictures = shipped.filter((f) => /\.(webp|png|jpe?g|gif|svg|ico|avif|pdf|mp4|webm|woff2?)$/i.test(f));
const report = pictures.map((f) => ({ f, ...inspect(f, fs.readFileSync(path.join(ROOT, f))), bytes: fs.statSync(path.join(ROOT, f)).size }));
const hidden = report.filter((r) => r.problems.length);
ok(`no uploaded picture, drawing or font carries hidden data (${pictures.length} files: GPS, camera, serial number, names, comments, XMP, IPTC, thumbnails, scripts, editor notes)`, hidden.length === 0,
  hidden.map((r) => r.f + ': ' + [...new Set(r.problems)].join(', ')).join(' | '));
const big = report.filter((r) => r.bytes > MAX_BYTES || (r.size && Math.max(...r.size) > MAX_SIDE));
ok(`no uploaded picture is heavier than ${MAX_BYTES / 1e6} MB or longer than ${MAX_SIDE} pixels (a phone original or a scan)`, big.length === 0, big.map((r) => `${r.f} ${(r.bytes / 1e6).toFixed(1)} MB ${r.size ? r.size.join('x') : ''}`).join(', '));
const bySum = {};
for (const f of pictures) { const h = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex'); (bySum[h] = bySum[h] || []).push(f); }
const twins = Object.values(bySum).filter((v) => v.length > 1);
ok('no two uploaded pictures are the same file under two names', twins.length === 0, twins.map((v) => v.join(' = ')).join(' | '));

// ---- what points at what ------------------------------------------------------------------------------------------------------------------
// The text that makes the site: pages and their sources, the print sheets, styles, scripts (without the notes written in them), manifest, sitemap.
const strip = (f, t) => (/\.html$/.test(f) ? t.replace(/<!--[\s\S]*?-->/g, '') : /\.css$/.test(f) ? t.replace(/\/\*[\s\S]*?\*\//g, '') : /\.js$/.test(f) ? t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[\s;,{(])\/\/[^\n]*/g, '$1') : t);
const live = everything.filter((f) => /^(?:[^/]+\.html|pages\/[^/]+\.html|print\/[^/]+\.html|css\/[^/]+\.css|js\/[^/]+\.js|manifest\.webmanifest|sitemap\.xml)$/.test(f));
const asset = /(?<![\w.-])(?:\.\.\/)?(assets\/[A-Za-z0-9_./-]+\.(?:webp|png|jpe?g|gif|svg|ico|avif|pdf|mp4|webm|woff2?))/g;
const pointedAt = new Map();
for (const f of live) for (const m of strip(f, read(f)).matchAll(asset)) { if (!pointedAt.has(m[1])) pointedAt.set(m[1], new Set()); pointedAt.get(m[1]).add(f); }
const gone = [...pointedAt].filter(([a]) => !fs.existsSync(path.join(ROOT, a)));
ok(`every file the site points to under assets/ exists (${pointedAt.size} pointers read from the pages, print sheets, styles, scripts and manifest)`, pointedAt.size > 40 && gone.length === 0,
  gone.map(([a, by]) => a + ' (named in ' + [...by].join(', ') + ')').join(' | '));
const inAssets = everything.filter((f) => f.startsWith('assets/'));
const allowed = (f) => NOT_USED.some(([p]) => f.startsWith(p));
const kept = (f) => UPLOADED_ON_PURPOSE.some((p) => f.startsWith(p));
const dead = inAssets.filter((f) => !pointedAt.has(f) && !allowed(f) && !kept(f));
ok('every file in assets/ is used by a page, style, script or manifest, or is on the NOT_USED or UPLOADED_ON_PURPOSE list at the top of this test', dead.length === 0, dead.join(', '));
const stale = NOT_USED.filter(([p]) => !inAssets.some((f) => f.startsWith(p)) || inAssets.filter((f) => f.startsWith(p)).some((f) => pointedAt.has(f)));
ok('the NOT_USED list is honest: each entry still matches files, and none of them is used after all', stale.length === 0, stale.map((s) => s[0]).join(', '));
ok('the UPLOADED_ON_PURPOSE list is honest: each entry still matches files, and they are uploaded', UPLOADED_ON_PURPOSE.every((p) => shipped.some((f) => f.startsWith(p))), UPLOADED_ON_PURPOSE.filter((p) => !shipped.some((f) => f.startsWith(p))).join(', '));
const sent = NOT_USED.flatMap(([p]) => shipped.filter((f) => f.startsWith(p)));
ok('what nothing uses is not uploaded either (the deploy folder leaves it out)', sent.length === 0, sent.join(', '));

await finish({});
