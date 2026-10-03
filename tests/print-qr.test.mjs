/* Paper: the printable QR signs (print/qr-signs.html) and what the six pages look like when printed.
 *   - the signs: readable on a phone, not listed in search, one sign per Letter and per A4 page, English and Spanish wording for every sign,
 *     every code is big enough and has a quiet edge (module size and margin in the printed size), error correction M or better,
 *     the pages and places the codes open exist, and (with segno, zxing-cpp and pillow) every code scans back to its address
 *   - the same signs in Hindi, Chinese and Vietnamese (print/qr-signs.hi.html, .zh.html, .vi.html): every sign has its wording from tools/qr_links.json
 *     in that language with the English small underneath, the same code and address as the English sheet, nothing cut off, one sign per page on
 *     Letter and A4, and no missing letters (empty boxes) in this computer's fonts
 *   - the pages: in print no button, tab, game, banner, bottom bar or live countdown is left, no text is light enough to vanish on white paper
 *     (a browser leaves background colours off), every FAQ answer is open, nothing is wider than the paper, the links people need
 *     (booking, sign-up, pre-order, the school form) show their address, and the First visit page is still exactly ONE sheet */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { run, open, ok, info, until, ROOT } from './lib.mjs';

const pagesIn = (pdf) => (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

/* Letters that no font on this computer can draw (they would print as empty boxes). The site's own web fonts hold only Latin letters, so for any
 * other letter the browser must find a font of the computer; Chrome says which fonts drew a piece of text (CSS.getPlatformFontsForNode), and a
 * letter nobody can draw is "drawn" by the web font alone. A letter that no font has at all (U+10FFFD) is the control: it must come out as missing.
 * Only Devanagari and Chinese letters are asked about: Vietnamese letters are built from the web font's own letters and marks (no system font needed). */
async function missingLetters(page, chars) {
  const inWebFont = /[\u0000-\u00FF\u0131\u0152\u0153\u02BB\u02BC\u02C6\u02DA\u02DC\u0304\u0308\u0329\u2000-\u206F\u20AC\u2122\u2191\u2193\u2212\u2215\uFEFF\uFFFD]/;
  const need = chars.filter((c) => !inWebFont.test(c) && /[\u0900-\u097F\u2E80-\u9FFF\uFF00-\uFFEF]/.test(c));
  await page.evaluate((list) => { const box = document.createElement('div'); box.id = 'probes'; list.forEach((c) => { const s = document.createElement('div'); s.className = 'probe'; s.textContent = c; box.appendChild(s); }); document.body.appendChild(box); }, [...need, '\u{10FFFD}']);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument');
  const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '#probes .probe' });
  const drawn = [];
  for (const nodeId of nodeIds) drawn.push((await cdp.send('CSS.getPlatformFontsForNode', { nodeId })).fonts.some((f) => !f.isCustomFont));
  await cdp.detach();
  await page.evaluate(() => document.getElementById('probes').remove());
  const control = drawn.pop();
  return { usable: control === false, missing: need.filter((c, i) => !drawn[i]) };
}

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

  // the signs in Hindi, Chinese and Vietnamese: the language big, the English small underneath, the same codes
  const SHEETS = [['hi', 'hi', /[ऀ-ॿ]/], ['zh', 'zh-Hans', /[一-鿿]/], ['vi', 'vi', /[ăâêôơưđàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i]];
  const read = () => [...document.querySelectorAll('.sign')].map((s) => {
    const own = (e) => (e ? [...e.childNodes].filter((n) => !(n.nodeType === 1 && n.tagName === 'SPAN')).map((n) => n.textContent).join('') : '');
    const small = (e) => { const x = e && e.querySelector(':scope > span[lang=en]'); return x ? x.textContent : ''; };
    const r = s.getBoundingClientRect(), out = [...s.querySelectorAll('*')].filter((e) => { const b = e.getBoundingClientRect(); return b.width && (b.left < r.left - 1 || b.right > r.right + 1 || b.bottom > r.bottom + 1); }).map((e) => e.tagName);
    const dark = s.querySelectorAll('.qr svg path')[1];
    return { id: s.id, title: own(s.querySelector('h1')), titleEn: small(s.querySelector('h1')), titleLang: s.querySelector('h1').getAttribute('lang'), how: own(s.querySelector('.how')), text: own(s.querySelector('.text')), textEn: small(s.querySelector('.text')),
      also: s.querySelector('.also') ? s.querySelector('.also').textContent : '', url: s.querySelector('.url').textContent, code: dark ? dark.getAttribute('d') : '', out, chars: [...new Set([...s.textContent].filter((c) => c.charCodeAt(0) > 127 && /\S/.test(c)))] };
  });
  const mainP = await open(browser, base, 'print/qr-signs.html', errs, { ready: false });
  await mainP.emulateMedia({ media: 'print' });
  const main = await mainP.evaluate(read);
  ok('the English and Spanish sheet: the menu and map signs (the two that open this website) say the page is also in the other languages, no other sign does',
    main.every((x) => (!!x.also) === /^\{site\}/.test((cfg.signs.find((s) => s.id === x.id) || {}).url || '') && (!x.also || /Español.*हिन्दी.*中文.*Tiếng Việt/.test(x.also))), main.filter((x) => x.also).map((x) => x.id).join(', '));
  const goneMain = await missingLetters(mainP, [...new Set(main.flatMap((x) => x.chars))]);
  if (goneMain.usable) ok('the English and Spanish sheet: the language names in the also-in line are drawn by a font of this computer (no empty boxes)', goneMain.missing.length === 0, 'missing: ' + goneMain.missing.join(' '));
  else info('(this browser cannot say which font drew a letter, so the empty-box check was skipped)');
  await mainP.context().close();
  for (const [code, htmlLang, script] of SHEETS) {
    const block = (cfg.languages || {})[code];
    ok(`${code}: tools/qr_links.json has wording for every sign`, !!block && cfg.signs.every((s) => block.signs[s.id] && block.signs[s.id].title && block.signs[s.id].text) && !!block.how && !!block.also);
    for (const width of [390, 1280]) {
      const sp = await open(browser, base, `print/qr-signs.${code}.html`, errs, { viewport: { width, height: 800 }, ready: false });
      if (width === 390) ok(`${code}: the sheet has no sideways scroll at 390 px`, (await sp.evaluate(() => document.documentElement.scrollWidth)) <= 390);
      else {
        await sp.emulateMedia({ media: 'print' });
        const sheet = await sp.evaluate(read), meta = await sp.evaluate(() => ({ lang: document.documentElement.lang, robots: (document.querySelector('meta[name=robots]') || {}).content, button: (document.querySelector('.bar button') || {}).getAttribute('onclick') }));
        ok(`${code}: the same signs as the English sheet, in the same order, with the same codes and addresses`, sheet.map((x) => x.id).join() === main.map((x) => x.id).join() && sheet.every((x, i) => x.code && x.code === main[i].code && x.url === main[i].url), sheet.map((x) => x.id).join(' '));
        const bad = sheet.filter((x) => {
          const w = (block && block.signs[x.id]) || {}, c = cfg.signs.find((q) => q.id === x.id);
          const small = x.textEn === c.text_en || (x.textEn === '' && w.text === c.text_en);   // an address that is the same in both languages is printed once
          return !(x.title === w.title && x.text === w.text && x.how === block.how && x.titleEn === c.title_en && small && x.titleLang === htmlLang && script.test(x.title + x.text));
        });
        ok(`${code}: every sign has its title, line and "how" in ${code} (from tools/qr_links.json) with the English underneath`, bad.length === 0, bad.map((x) => x.id).join(', '));
        ok(`${code}: the also-in line is on the menu and map signs only and names the other four languages`, sheet.every((x) => (!!x.also) === /^\{site\}/.test(cfg.signs.find((s) => s.id === x.id).url) && (!x.also || ['English', 'Español', 'हिन्दी', '中文', 'Tiếng Việt'].filter((n) => x.also.includes(n)).length === 4)));
        ok(`${code}: nothing sticks out of its sign`, sheet.every((x) => x.out.length === 0), sheet.filter((x) => x.out.length).map((x) => x.id + ' ' + x.out.join('/')).join(', '));
        ok(`${code}: the page says its language, is not listed in search and keeps the Print button`, meta.lang === htmlLang && /noindex/.test(meta.robots) && meta.button === 'window.print()', JSON.stringify(meta));
        for (const paper of ['Letter', 'A4']) { const n = pagesIn(await sp.pdf({ format: paper, printBackground: false })); ok(`${code}: ${paper} prints exactly one page per sign`, n === sheet.length, `${n} pages for ${sheet.length} signs`); }
        const gone = await missingLetters(sp, [...new Set(sheet.flatMap((x) => x.chars))]);
        if (gone.usable) ok(`${code}: every letter on the sheet is drawn by a font of this computer (no empty boxes)`, gone.missing.length === 0, 'missing: ' + gone.missing.join(' '));
        else info(`(${code}: this browser cannot say which font drew a letter, so the empty-box check was skipped)`);
      }
      await sp.context().close();
    }
  }

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
