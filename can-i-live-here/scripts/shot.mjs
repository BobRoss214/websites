// Screenshot helper: node scripts/shot.mjs <url> <outfile> [width] [height] [fullPage]
import { chromium } from '@playwright/test';
const [url, out, w = '390', h = '844', full = 'true'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.screenshot({ path: out, fullPage: full === 'true' });
console.log(JSON.stringify({ out, errors }));
await browser.close();
