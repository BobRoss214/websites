/* The printable QR signs (print/qr-signs.html): readable on a phone, not listed in search, and printing gives exactly one letter-size page per sign. */
import { run, open, ok } from './lib.mjs';

await run('print-qr', async ({ browser, base, errs }) => {
  for (const width of [320, 390, 768]) {
    const p = await open(browser, base, 'print/qr-signs.html', errs, { viewport: { width, height: 800 }, ready: false });
    const r = await p.evaluate(() => { const q = document.querySelector('.qr').getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, signs: document.querySelectorAll('.sign').length, qrLeft: Math.round(q.left), qrRight: Math.round(q.right) }; });
    ok(`${width}px wide: no sideways scroll and the code fits`, r.sw <= width && r.qrLeft >= 0 && r.qrRight <= width, JSON.stringify(r));
    await p.context().close();
  }
  const p = await open(browser, base, 'print/qr-signs.html', errs, { ready: false });
  const info = await p.evaluate(() => ({ signs: document.querySelectorAll('.sign').length, svgs: document.querySelectorAll('.sign .qr svg').length, robots: (document.querySelector('meta[name=robots]') || {}).content, lang: [...document.querySelectorAll('.sign h1 span[lang=es]')].length }));
  ok('there are signs, each with a QR code, a Spanish line and noindex on the page', info.signs >= 9 && info.svgs === info.signs && info.lang === info.signs && /noindex/.test(info.robots), JSON.stringify(info));
  await p.emulateMedia({ media: 'print' });
  const pdf = await p.pdf({ format: 'Letter', printBackground: true, preferCSSPageSize: true });
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  ok('printing gives exactly one page per sign', pages === info.signs, `${pages} pages for ${info.signs} signs`);
  await p.context().close();
});
