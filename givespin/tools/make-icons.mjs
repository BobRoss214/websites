// Draws the app icons in assets/icons/ from the site's own logo (the heart in the dashed ring, as in assets/favicon.svg).
//
//   NODE_PATH=$(npm root -g) node tools/make-icons.mjs
//
// Needs Playwright with a Chromium build. It writes five small PNG files: icon-192.png, icon-512.png and icon-maskable-512.png (the manifest's icons),
// apple-touch-icon.png (the iPhone home-screen icon) and badge-96.png (a white heart on a see-through background for notifications).
// Run it again after changing the logo; nothing else in the project needs it. Chromium writes full-colour PNGs (the 512 px one is about 120 KB), so the
// committed files were then cut to a 96-colour palette, which keeps each one under 11 KB and looks the same at these sizes:
//   convert icon-512.png +dither -colors 96 -define png:compression-level=9 PNG8:icon-512.png   (ImageMagick; do the same for the other four)
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'icons');
fs.mkdirSync(out, { recursive: true });

const HEART = 'M20 28.2c-.4 0-.7-.1-1-.4-4.1-3.6-7-6.2-7-9.6 0-2.3 1.8-4.1 4-4.1 1.6 0 3.1.8 4 2.2.9-1.4 2.4-2.2 4-2.2 2.2 0 4 1.8 4 4.1 0 3.4-2.9 6-7 9.6-.3.3-.6.4-1 .4Z';
const GRAD = '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22f07a"/><stop offset="1" stop-color="#14b8a6"/></linearGradient></defs>';
const glyph = (scale) => '<g transform="translate(20 20) scale(' + scale + ') translate(-20 -20)"><circle cx="20" cy="20" r="12.5" fill="none" stroke="#03210f" stroke-opacity=".28" stroke-width="2" stroke-dasharray="3.2 3.2"/><path d="' + HEART + '" fill="#03210f"/></g>';

// "any" icons: the rounded logo. Maskable and Apple icons: a full square (the phone cuts the corners), with the picture well inside the safe middle.
const FILES = [
  ['icon-192.png', 192, GRAD + '<rect width="40" height="40" rx="10" fill="url(#g)"/>' + glyph(1)],
  ['icon-512.png', 512, GRAD + '<rect width="40" height="40" rx="10" fill="url(#g)"/>' + glyph(1)],
  ['icon-maskable-512.png', 512, GRAD + '<rect width="40" height="40" fill="url(#g)"/>' + glyph(1.15)],
  ['apple-touch-icon.png', 180, GRAD + '<rect width="40" height="40" fill="url(#g)"/>' + glyph(1.15)],
  ['badge-96.png', 96, '<path transform="translate(20 20) scale(1.1) translate(-20 -20)" d="' + HEART + '" fill="#fff"/>', '10 10 20 20']
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [name, size, body, box] of FILES) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent('<!doctype html><body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" viewBox="' + (box || '0 0 40 40') + '" width="' + size + '" height="' + size + '">' + body + '</svg>');
  await page.screenshot({ path: path.join(out, name), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  console.log(name, size + 'x' + size, fs.statSync(path.join(out, name)).size + ' bytes');
}
await browser.close();
