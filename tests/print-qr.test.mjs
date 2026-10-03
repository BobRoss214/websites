/* Paper: the printable QR signs (print/qr-signs.html) and what the six pages look like when printed.
 *   - the signs: readable on a phone, not listed in search, one sign per Letter and per A4 page, English and Spanish wording for every sign,
 *     every code is big enough and has a quiet edge (module size and margin in the printed size), error correction M or better,
 *     the pages and places the codes open exist, and (with segno, zxing-cpp and pillow) every code scans back to its address
 *   - the pages: in print no button, tab, game, banner, bottom bar or live countdown is left, no text is light enough to vanish on white paper
 *     (a browser leaves background colours off), every FAQ answer is open, nothing is wider than the paper, the links people need
 *     (booking, sign-up, pre-order, the school form) show their address, and the First visit page is still exactly ONE sheet */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { run, open, ok, info, until, ROOT } from './lib.mjs';

const pagesIn = (pdf) => (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

await run('print-qr', async ({ browser, base, errs }) => {
  for (const width of [320, 390, 768]) {
    const p = await open(browser, base, 'print/qr-signs.html', errs, { viewport: { width, height: 800 }, ready: false });
    const r = await p.evaluate(() => { const q = document.querySelector('.qr').getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, signs: document.querySelectorAll('.sign').length, qrLeft: Math.round(q.left), qrRight: Math.round(q.right) }; });
    ok(`${width}px wide: no sideways scroll and the code fits`, r.sw <= width && r.qrLeft >= 0 && r.qrRight <= width, JSON.stringify(r));
    await p.context().close();
  }
  const p = await open(browser, base, 'print/qr-signs.html', errs, { ready: false });
  const info1 = await p.evaluate(() => ({ signs: document.querySelectorAll('.sign').length, svgs: document.querySelectorAll('.sign .qr svg').length, robots: (document.querySelector('meta[name=robots]') || {}).content, lang: [...document.querySelectorAll('.sign h1 span[lang=es]')].length, ids: [...document.querySelectorAll('.sign')].map((s) => s.id) }));
  ok('there are signs, each with a QR code, a Spanish line and noindex on the page', info1.signs >= 9 && info1.svgs === info1.signs && info1.lang === info1.signs && /noindex/.test(info1.robots), JSON.stringify({ ...info1, ids: undefined }));
  await p.emulateMedia({ media: 'print' });
  const pdf = await p.pdf({ format: 'Letter', printBackground: true, preferCSSPageSize: true });
  ok('printing gives exactly one page per sign', pagesIn(pdf) === info1.signs, `${pagesIn(pdf)} pages for ${info1.signs} signs`);
  const pdfA4 = await p.pdf({ format: 'A4', printBackground: false });
  ok('A4 paper also gives exactly one page per sign', pagesIn(pdfA4) === info1.signs, `${pagesIn(pdfA4)} pages for ${info1.signs} signs`);

  // size on paper. The picture is 10 px per module and has a 4-module quiet edge built in (make_qr.py: scale=10, border=4).
  // A whole sign shrunk to a 4 x 6 inch card is 4 / 8.5 of its size, so a module must be at least 0.5 / (4 / 8.5) = 1.06 mm on the Letter sign.
  const q = await p.evaluate(() => [...document.querySelectorAll('.sign')].map((s) => {
    const svg = s.querySelector('.qr svg'), modules = svg.viewBox.baseVal.width / 10, dark = svg.querySelectorAll('path')[1].getBBox();
    return { id: s.id, moduleMm: +(svg.getBoundingClientRect().width / modules * 25.4 / 96).toFixed(2), quiet: Math.min(dark.x, dark.y - 0.5, modules - dark.x - dark.width, modules - dark.y - dark.height - 0.5) };
  }));
  const small = q.filter((x) => x.moduleMm < 1.06), cramped = q.filter((x) => x.quiet < 4);
  ok('every printed code has modules of at least 1.06 mm (0.5 mm when the sign is shrunk to 4 x 6 in)', small.length === 0, small.map((x) => x.id + ' ' + x.moduleMm + ' mm').join(', ') || 'smallest ' + Math.min(...q.map((x) => x.moduleMm)) + ' mm');
  ok('every code has a quiet edge of at least 4 modules', cramped.length === 0, cramped.map((x) => x.id + ' ' + x.quiet).join(', '));
  const src = fs.readFileSync(path.join(ROOT, 'tools', 'make_qr.py'), 'utf8');
  ok('the codes use error correction level M or better (a sign that gets dirty still scans)', /segno\.make\(url, error='[mqh]'\)/.test(src) && /dark='#000000', light='#ffffff'/.test(src), 'black on white, level ' + ((src.match(/segno\.make\(url, error='(\w)'\)/) || [])[1] || '?'));
  await p.context().close();

  // wording and targets
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'qr_links.json'), 'utf8').replace(/^﻿/, ''));
  const thin = cfg.signs.filter((s) => !(s.title_en && s.title_es && s.text_en && s.text_es));
  ok('every sign in tools/qr_links.json has its English and Spanish title and text', thin.length === 0, thin.map((s) => s.id).join(', '));
  const stray = info1.ids.filter((id) => !cfg.signs.some((s) => s.id === id)), left = cfg.signs.filter((s) => !info1.ids.includes(s.id)).map((s) => s.id);
  ok('every sign on the page is in tools/qr_links.json; the only sign left out is the review sign (until reviewUrl is set)', stray.length === 0 && left.every((id) => id === 'review'), 'not on the page: ' + (left.join(', ') || 'none'));
  for (const s of cfg.signs.filter((x) => x.url.startsWith('{site}'))) {
    const [file, hash] = s.url.replace('{site}', '').split('#'), f = path.join(ROOT, file.split('?')[0]);
    const html = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
    ok(`the "${s.id}" sign opens a page and place that exist (${file.split('?')[0]}#${hash})`, !!html && (!hash || html.includes(`id="${hash}"`)));
  }
  // every code scans back (the same check as `make_qr.py --check`), in a temporary copy
  const PY = process.env.WA_PYTHON || 'python3';
  if (spawnSync(PY, ['-c', 'import segno, zxingcpp, PIL'], { encoding: 'utf8' }).status === 0) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-qr-'));
    try {
      fs.mkdirSync(path.join(tmp, 'tools')); fs.mkdirSync(path.join(tmp, 'js'));
      for (const f of ['make_qr.py', 'qr_links.json']) fs.copyFileSync(path.join(ROOT, 'tools', f), path.join(tmp, 'tools', f));
      fs.copyFileSync(path.join(ROOT, 'js', 'content.js'), path.join(tmp, 'js', 'content.js'));
      const r = spawnSync(PY, ['tools/make_qr.py', '--check'], { cwd: tmp, encoding: 'utf8' });
      const good = (r.stdout.match(/scans OK/g) || []).length;
      ok('every QR code scans back to the address in tools/qr_links.json', r.status === 0 && good === info1.signs && !/CHECK FAILED/.test(r.stdout), `${good} of ${info1.signs} scanned` + (r.stderr ? ' ' + r.stderr.trim().split('\n').pop() : ''));
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  } else info('(segno, zxing-cpp or pillow is not installed: the scan-back check was skipped; pip install segno zxing-cpp pillow)');

  // the six pages on paper: the print width of Letter with .6 in margins is 7.3 in = 700 px
  const PAGES = ['index', 'first-visit', 'pumpkin-patch', 'strawberry-picking', 'school-field-trips', 'wise-pie'];
  const KEY = /^https:\/\/(bookeo\.com|eepurl\.com|docs\.google\.com\/forms|wise-pie-wood-fired-at-wise-acres\.square\.site)/;
  for (const lang of ['en', 'hi']) for (const pg of PAGES) {
    const pp = await open(browser, base, `${pg}.html`, errs, { lang, viewport: { width: 700, height: 900 } });
    await pp.emulateMedia({ media: 'print' });
    await until(pp, () => !document.querySelector('details:not([open])'), null, 5000);
    const a = await pp.evaluate((keySrc) => {
      const KEYRE = new RegExp(keySrc);
      const vis = (e) => { for (let x = e; x; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden') return false; } const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const name = (e) => e.tagName.toLowerCase() + (e.className && e.className.baseVal === undefined ? '.' + String(e.className).trim().split(/\s+/)[0] : '') + ' "' + (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24) + '"';
      const lum = (s) => { const m = s.match(/[\d.]+/g).map(Number); const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
      const all = [...document.querySelectorAll('body *')], bad = [];
      const key = [];
      for (const e of document.querySelectorAll('button,[role=button],[role=tab]')) if (vis(e)) bad.push('button ' + name(e));
      for (const e of document.querySelectorAll('a.btn')) {
        if (!vis(e)) continue;
        const h = e.getAttribute('href') || '';
        const dest = /^(mailto:|tel:)/.test(h) || KEYRE.test(h);
        if (!dest) bad.push('button link ' + name(e) + ' -> ' + h.slice(0, 30));
        else if (KEYRE.test(h)) { const c = getComputedStyle(e, '::after').content; if (c === '"' + h + '"') key.push(h); else bad.push('address not printed under ' + name(e)); }
      }
      for (const e of all) if (vis(e) && ['fixed', 'sticky'].includes(getComputedStyle(e).position)) bad.push('fixed/sticky ' + name(e));
      for (const e of document.querySelectorAll('canvas,video,iframe,audio,.live,.hero-live,.next-up,.action-bar,.announce,.nav,.lightbox,[data-print]')) if (vis(e)) bad.push('screen-only ' + name(e));
      for (const x of document.getAnimations()) if (x.playState === 'running' && x.effect && x.effect.target && vis(x.effect.target)) bad.push('animating ' + name(x.effect.target));   // a hidden element (the bee) may keep its script animation
      for (const e of all) {
        if (!vis(e) || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        const cs = getComputedStyle(e); if (lum(cs.color) > 0.45) bad.push('light text ' + name(e));
      }
      const det = [...document.querySelectorAll('details')].filter((d) => !d.closest('.print-skip'));
      const shut = det.filter((d) => !d.open || ![...d.children].filter((c) => c.tagName !== 'SUMMARY').some(vis));
      return { bad: bad.slice(0, 6), key, details: det.length, shut: shut.map((d) => name(d.querySelector('summary') || d)), skipped: document.querySelectorAll('.print-skip').length, sw: document.documentElement.scrollWidth };
    }, KEY.source);
    ok(`${pg} (${lang}) prints with nothing that needs a screen and nothing light on white`, a.bad.length === 0, a.bad.join(' | '));
    ok(`${pg} (${lang}) prints every FAQ answer open`, a.shut.length === 0 && (pg === 'first-visit' || a.details > 0), a.shut.join(', ') || `${a.details} answers`);
    ok(`${pg} (${lang}) is not wider than the paper`, a.sw <= 701, 'scroll width ' + a.sw + ' of 700');
    if (pg !== 'first-visit') ok(`${pg} (${lang}) prints an address for booking or sign-up`, a.key.length > 0, a.key.slice(0, 2).join(', ') || 'none');
    else ok('first-visit prints only its own sheet (the hero and the FAQ are left out)', a.skipped === 2 && a.details === 0, 'print-skip ' + a.skipped);
    await pp.context().close();
  }

  // how many sheets: the First visit page is ONE sheet in every language, on both papers; the others stay short
  const LIMIT = { index: 40, 'first-visit': 1, 'pumpkin-patch': 8, 'strawberry-picking': 8, 'school-field-trips': 8, 'wise-pie': 8 };
  for (const [pg, langs, papers] of [['first-visit', ['en', 'es', 'hi', 'zh', 'vi'], ['Letter', 'A4']], ['index', ['en'], ['Letter', 'A4']], ['pumpkin-patch', ['en'], ['Letter']], ['strawberry-picking', ['en'], ['Letter']], ['school-field-trips', ['en'], ['Letter']], ['wise-pie', ['en'], ['Letter']]]) {
    for (const lang of langs) {
      const pp = await open(browser, base, `${pg}.html`, errs, { lang, viewport: { width: 1280, height: 900 } });
      await pp.emulateMedia({ media: 'print' });
      await until(pp, () => !document.querySelector('details:not([open])'), null, 5000);
      const n = [];
      for (const paper of papers) n.push(paper + ' ' + pagesIn(await pp.pdf({ format: paper, printBackground: false })));
      ok(`${pg} (${lang}) prints on ${LIMIT[pg] === 1 ? 'one sheet' : 'at most ' + LIMIT[pg] + ' sheets'}`, n.every((x) => +x.split(' ')[1] <= LIMIT[pg]), n.join(', '));
      await pp.context().close();
    }
  }
});
