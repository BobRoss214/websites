// Rewrites the PRECACHE list in sw.js from index.html, so the app's saved copy always matches what the page loads.
//
//   node tools/make-precache.mjs          (run it from the givespin folder after adding or removing a script, style sheet or icon in index.html)
//
// The list is every local file index.html loads (style sheets, scripts, the tab icon, the manifest, the Apple icon), plus offline.html, the manifest's icons,
// the notification badge and the fonts that the style sheets name. tests/pwa.test.js checks the same rule, so a stale list is caught by the unit tests.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const html = read('index.html');
const hrefs = [...html.matchAll(/<link\b[^>]*\bhref="([^"]+)"/g)].map((m) => m[1]);
const srcs = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
const cssFiles = hrefs.filter((h) => /\.css$/.test(h));
const fonts = [];
cssFiles.forEach((css) => {
  for (const m of read(css).matchAll(/url\(\s*["']?([^)"']+)["']?\s*\)/g)) {
    if (!/^(?:data:|https?:|#)/.test(m[1])) { fonts.push(path.posix.normalize(path.posix.join(path.posix.dirname(css), m[1]))); }
  }
});
const manifest = JSON.parse(read('manifest.webmanifest'));
const list = [...new Set(['index.html', 'offline.html', 'manifest.webmanifest', ...hrefs.filter((h) => !/\.css$/.test(h)), ...manifest.icons.map((i) => i.src), 'assets/icons/badge-96.png', ...fonts, ...cssFiles, ...srcs])];
const missing = list.filter((f) => !fs.existsSync(path.join(root, f)));
if (missing.length) { console.error('These files are named but do not exist: ' + missing.join(', ')); process.exit(1); }
const sw = read('sw.js').replace(/var PRECACHE = \[[\s\S]*?\n\];/, 'var PRECACHE = [\n' + list.map((u) => "  '" + u + "'").join(',\n') + '\n];');
fs.writeFileSync(path.join(root, 'sw.js'), sw);
console.log('sw.js: PRECACHE now lists ' + list.length + ' files');
