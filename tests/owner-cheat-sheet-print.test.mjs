// order: 235
// browser: yes
// covers: print/owner-cheat-sheet.html, print/owner-cheat-sheet.es.html, tools/make_cheat_sheet.py, docs/OWNER_CHEAT_SHEET.md, docs/OWNER_CHEAT_SHEET.es.md
/* The printed cheat sheet fits on ONE sheet of paper, both sides (a browser test; about 15 seconds, no network). The two pages print/owner-cheat-sheet.html (English)
 * and print/owner-cheat-sheet.es.html (Spanish) are printed to PDF by the browser's own print code on Letter paper and on A4 paper. Each must come out as exactly 2 pages,
 * the front must hold box T and jobs 1 to 5 and the back jobs 6 to 12 (read from the page's own structure), and the same pages drawn 5% bigger must still be 2 pages
 * (a safety margin, so a wider font on another computer does not push a line onto a third page). On screen the page has no horizontal scroll at phone width.
 * When it fails: shorten the sheet (docs/OWNER_CHEAT_SHEET.md, and the Spanish copy), or lower the print font in tools/make_cheat_sheet.py, then run  python3 tools/make_cheat_sheet.py . */
import { ok, run, ms } from './lib.mjs';

const pageCount = (pdf) => (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
await run('owner-cheat-sheet-print', async ({ browser, base }) => {
  for (const [file, label] of [['owner-cheat-sheet.html', 'English'], ['owner-cheat-sheet.es.html', 'Spanish']]) {
    for (const format of ['Letter', 'A4']) {
      const ctx = await browser.newContext(); const page = await ctx.newPage();
      await page.goto(base + 'print/' + file, { waitUntil: 'load', timeout: ms(30000) });
      await page.evaluate(() => document.fonts.ready);
      await page.emulateMedia({ media: 'print' });
      const pdf = await page.pdf({ format, printBackground: true });
      const sides = await page.evaluate(() => [...document.querySelectorAll('.side')].map((s) => [...s.querySelectorAll('.job h2')].map((h) => h.textContent.trim().split('.')[0])));
      ok(label + ' on ' + format + ': 2 pages (one sheet, both sides)', pageCount(pdf) === 2, pageCount(pdf) + ' pages');
      ok(label + ' on ' + format + ': the front holds the start, box T and jobs 1 to 5; the back jobs 6 to 12', sides.length === 2 && sides[0].slice(-1)[0] === '5' && sides[1][0] === '6' && sides[1].slice(-1)[0] === '12', JSON.stringify(sides));
      // a safety margin: the same page with everything drawn 5% bigger (another computer's fonts, a printer that adds a margin) must still be 2 pages
      const bigger = await page.pdf({ format, printBackground: true, scale: 1.05 });
      ok(label + ' on ' + format + ': still 2 pages when everything is drawn 5% bigger (a margin for other fonts and printers)', pageCount(bigger) === 2, pageCount(bigger) + ' pages at 105%');
      await ctx.close();
    }
  }
  const phone = await browser.newContext({ viewport: { width: 360, height: 700 } }); const p = await phone.newPage();
  await p.goto(base + 'print/owner-cheat-sheet.html');
  const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok('at phone width the page has no sideways scroll', over <= 1, over + ' px too wide');
  await phone.close();
});
