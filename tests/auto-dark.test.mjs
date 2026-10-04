// order: 380
// browser: yes
// covers: css/*
/* Browser "auto dark mode" (Chrome / Edge / Opera on a dark phone or computer, Samsung Internet's dark mode): browsers darken light-only pages on
 * their own. Their darkening turns the dark text on the yellow buttons, tabs and chips pale (about 1.3 : 1 against the yellow). The pages say
 * <meta name="color-scheme" content="only light"> (and :root{color-scheme:only light} in css/styles.css), which opts out. This test turns the
 * browser's auto dark mode ON (Chromium's own switch, through the DevTools protocol, with the browser set to dark) and checks, from real
 * pictures of the page: (1) as a control, with the opt-out taken out, the yellow parts really do turn unreadable, so the test is meaningful;
 * (2) with the opt-out, the page is not darkened and every yellow part keeps dark text (4.5 : 1 or better). Also checks that every page has the tag. */
import fs from 'node:fs';
import path from 'node:path';
import { run, ok, skip, info, ROOT, until, ms, settled } from './lib.mjs';

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const PAGES = ['index.html', 'first-visit.html', 'pumpkin-patch.html', 'strawberry-picking.html', 'school-field-trips.html', 'wise-pie.html', '404.html', 'print/qr-signs.html'];
const TAG = /<meta name="color-scheme" content="only light">/;

// pictures -> numbers: in a blank page, decode the picture of an element and say how well its text can be read against its background
const DECODE = async (b64) => {
  const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
  const cv = new OffscreenCanvas(bmp.width, bmp.height), g = cv.getContext('2d'); g.drawImage(bmp, 0, 0);
  const d = g.getImageData(0, 0, bmp.width, bmp.height).data, n = bmp.width * bmp.height;
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const L = (i) => 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]);
  const ls = []; let sum = 0; for (let i = 0; i < n; i++) { const l = L(i * 4); ls.push([l, i * 4]); sum += (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3; }
  ls.sort((a, b) => a[0] - b[0]);
  const bg = ls[Math.floor(n / 2)][0], lo = ls[Math.floor(n * 0.02)][0], hi = ls[Math.floor(n * 0.98)][0];
  const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return { contrast: Math.max(ratio(bg, lo), ratio(bg, hi)), mean: sum / n };
};

const TARGETS = [   // yellow parts that carry dark text: [name, selector, filter text]
  ['the hero season button', '.season-switch button[aria-checked="true"]'], ['the "New" chip', '.chips li', 'New:'], ['the chosen season tab', '#season-tabs .season-tab[aria-selected="true"]'],
  ['the chosen group tab', '#group-tabs .group-tab[aria-selected="true"]'], ['a yellow button', '.btn-sun'], ['a countdown tile', '.rel-count .rc'], ['a yellow flag', '.package-flag-sun']];

await run('auto-dark', async ({ browser, base, errs }) => {
  // 1. every page carries the tag, and the style sheet says it too
  const missing = PAGES.filter((f) => !TAG.test(read(f)));
  ok('every page (home, 5 guides, 404, QR signs) has <meta name="color-scheme" content="only light">', missing.length === 0, missing.join(', '));
  ok('css/styles.css says :root{color-scheme:only light}', /:root\{[^}]*color-scheme:\s*only light/.test(read('css/styles.css')));

  // 2. the browser's auto dark mode, switched on
  const measure = async (stripOptOut) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US', timezoneId: 'America/New_York', reducedMotion: 'reduce', colorScheme: 'dark' });
    const decoder = await ctx.newPage(); await decoder.goto('about:blank');
    const p = await ctx.newPage(); p.setDefaultTimeout(ms(20000));
    p.on('pageerror', (e) => errs.push('auto-dark pageerror: ' + e.message));
    const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setAutoDarkModeOverride', { enabled: true });
    if (stripOptOut) {
      await p.route('**/index.html', async (r) => { const res = await r.fetch(); await r.fulfill({ response: res, body: (await res.text()).replace(TAG, '') }); });
      await p.route('**/css/styles.css', async (r) => { const res = await r.fetch(); await r.fulfill({ response: res, body: (await res.text()).replace(/color-scheme:\s*only light;/, '') }); });
    }
    await p.clock.install({ time: new Date('2026-10-01T15:00:00-04:00') });
    await p.goto(base + 'index.html', { waitUntil: 'load', timeout: ms(60000) });
    await until(p, () => !!(window.WISE_ACRES && window.WISE_ACRES.features), null, 30000);
    await p.clock.runFor(1500);
    await p.addStyleTag({ content: '.site-header{position:static!important}.action-bar{display:none!important}' });
    const dec = async (buf) => decoder.evaluate(DECODE, buf.toString('base64'));
    const out = { page: (await dec(await p.screenshot())).mean, parts: [] };
    for (const [name, sel, text] of TARGETS) {
      let loc = p.locator(sel); if (text) loc = loc.filter({ hasText: text });
      const n = await loc.count(); let done = false;
      for (let i = 0; i < Math.min(n, 6) && !done; i++) {
        const e = loc.nth(i); if (!(await e.isVisible())) continue;
        await e.scrollIntoViewIfNeeded(); await settled(p, 150);
        const bb = await e.boundingBox(); if (!bb || bb.width < 30 || bb.height < 20) continue;
        // the inside of the box only (not its dark border or shadow, which would read as a strong contrast on their own)
        const clip = { x: bb.x + 8, y: bb.y + 6, width: bb.width - 16, height: bb.height - 12 };
        const r = await dec(await p.screenshot({ clip })); out.parts.push({ name, contrast: r.contrast }); done = true;
      }
    }
    await ctx.close();
    return out;
  };

  const control = await measure(true);
  const worst = control.parts.length ? Math.min(...control.parts.map((x) => x.contrast)) : 99;
  if (control.parts.length < 4 || worst > 3) { info('control: ' + JSON.stringify(control)); skip('this browser did not darken the control page (opt-out removed), so the check below would prove nothing'); }
  ok('control: without the opt-out, auto dark mode makes yellow parts unreadable', worst < 2.5, `worst ${worst.toFixed(2)} : 1 on ${control.parts.length} parts; page brightness ${Math.round(control.page)}`);

  const real = await measure(false);
  ok('with the opt-out the page is not darkened', real.page > 150, `page brightness ${Math.round(real.page)} (the control: ${Math.round(control.page)})`);
  ok('with the opt-out at least 5 yellow parts were measured', real.parts.length >= 5, real.parts.map((x) => x.name).join(', '));
  const bad = real.parts.filter((x) => x.contrast < 4.5);
  ok('with the opt-out every yellow part keeps readable dark text (4.5 : 1 or better)', bad.length === 0, bad.map((x) => `${x.name} ${x.contrast.toFixed(2)}`).join('; ') || 'lowest ' + Math.min(...real.parts.map((x) => x.contrast)).toFixed(2));
});
