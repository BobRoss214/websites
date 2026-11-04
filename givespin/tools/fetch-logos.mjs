#!/usr/bin/env node
/*
 * Collects a small logo for each charity from its own website and lists them in js/logos.js.
 *
 *   node tools/fetch-logos.mjs                 every charity that does not have a logo yet
 *   node tools/fetch-logos.mjs --force         fetch them all again
 *   node tools/fetch-logos.mjs --only unicef-usa,care
 *
 * It needs a normal internet connection and Node 18+. For each charity it loads the home page once, looks for the
 * site's touch icon or favicon (the square image the organisation itself publishes for this purpose), keeps the
 * largest PNG at least 48 px wide, and saves it to assets/logos/<id>.png. Charities with no suitable image are
 * simply left out and keep their monogram circle.
 *
 * READ THIS FIRST: a logo is the charity's trademark. Showing it to identify the organisation is common practice,
 * but it can look like an endorsement and some organisations ask for permission or have brand rules. Check each
 * charity's terms, remove any you are not comfortable with, and keep the "not affiliated" footer. Set
 * `logos: false` in js/config.js to turn logos off everywhere without deleting anything.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'assets', 'logos');
const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'js', 'data.js'), 'utf8'), sandbox);
const charities = sandbox.window.GS.charities;
fs.mkdirSync(outDir, { recursive: true });

const UA = 'Mozilla/5.0 (compatible; GiveSpinLogoFetcher/1.0; +https://example.invalid/about)';
async function get(url, asText) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const res = await fetch(url, { redirect: 'follow', signal: ctl.signal, headers: { 'user-agent': UA, accept: asText ? 'text/html' : 'image/png,image/*' } });
    if (!res.ok) { return null; }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 1_500_000) { return null; }
    return { buf, url: res.url };
  } catch { return null; } finally { clearTimeout(timer); }
}

function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) { return null; }
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function candidates(html, base) {
  const out = [];
  const re = /<link\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const rel = (/rel\s*=\s*["']([^"']+)["']/i.exec(tag) || [])[1] || '';
    const href = (/href\s*=\s*["']([^"']+)["']/i.exec(tag) || [])[1];
    if (!href || !/icon/i.test(rel) || /mask-icon/i.test(rel)) { continue; }
    const sizes = (/sizes\s*=\s*["'](\d+)x\d+/i.exec(tag) || [])[1];
    let score = sizes ? Number(sizes) : (/apple-touch/i.test(rel) ? 180 : 32);
    if (/\.svg(\?|$)/i.test(href) || /\.ico(\?|$)/i.test(href)) { score = 0; }
    try { out.push({ url: new URL(href, base).href, score }); } catch { /* bad href */ }
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

async function logoFor(ch) {
  const base = 'https://' + ch.url + '/';
  const page = await get(base, true);
  const list = page ? candidates(page.buf.toString('utf8'), page.url) : [];
  for (const x of ['apple-touch-icon.png', 'apple-touch-icon-precomposed.png']) {
    try { list.push({ url: new URL('/' + x, page ? page.url : base).href, score: 1 }); } catch { /* ignore */ }
  }
  for (const c of list) {
    if (!c.score) { continue; }
    const img = await get(c.url, false);
    const size = img && pngSize(img.buf);
    if (size && size.w >= 48 && size.h >= 48) { return img.buf; }
  }
  return null;
}

const todo = charities.filter((c) => (!only || only.includes(c.id)) && (force || !fs.existsSync(path.join(outDir, c.id + '.png'))));
console.log(`${todo.length} charities to try (${charities.length} in the roster)`);
let done = 0, ok = 0;
const failed = [];
async function worker(queue) {
  while (queue.length) {
    const ch = queue.shift();
    const buf = await logoFor(ch);
    if (buf) { fs.writeFileSync(path.join(outDir, ch.id + '.png'), buf); ok += 1; } else { failed.push(ch.id); }
    done += 1;
    if (done % 25 === 0) { console.log(`  ${done}/${todo.length} (${ok} logos)`); }
  }
}
const queue = todo.slice();
await Promise.all(Array.from({ length: 6 }, () => worker(queue)));

const have = {};
for (const c of charities) { if (fs.existsSync(path.join(outDir, c.id + '.png'))) { have[c.id] = 'png'; } }
fs.writeFileSync(path.join(root, 'js', 'logos.js'), `/*
 * Which charities have a logo file in assets/logos/ (id -> file extension). Written by tools/fetch-logos.mjs.
 * Charities not listed here keep their monogram circle.
 */
(function () {
  'use strict';
  var GS = (window.GS = window.GS || {});
  GS.logos = ${JSON.stringify(have)};
})();
`);
console.log(`Done: ${Object.keys(have).length} charities have a logo, ${failed.length} did not (they keep their monogram).`);
if (failed.length) { console.log('No logo found for: ' + failed.join(', ')); }
