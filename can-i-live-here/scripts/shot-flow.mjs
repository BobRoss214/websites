// Screenshot the results and a place page with a sample household already answered.
import { chromium } from '@playwright/test';
const S = process.argv[2];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];
async function shot(name, w, h, path, full = false) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.evaluate(() => sessionStorage.setItem('cilh-answers', JSON.stringify({ answers: { goal: 'buy', adults: 2, kids: 1, incomeMonthly: 7500, incomeType: 'salary', debtCar: 450, credit: 'good', savings: 30000, firstTime: true, rural: true, bedrooms: 3, workPlace: 'Raleigh, NC', workPlaceId: 'p3755000', commuteMax: 35 }, skipped: [] })));
  await page.goto(`http://localhost:4173/${path}`, { waitUntil: 'networkidle' });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${S}/${name}.png`, fullPage: full });
  await page.close();
}
await shot('04-results-phone', 390, 844, '#/results', true);
await shot('05-results-laptop', 1366, 900, '#/results', false);
await shot('06-place-phone', 390, 844, '#/place/c37085', true);
console.log(JSON.stringify(errors, null, 1));
await browser.close();
