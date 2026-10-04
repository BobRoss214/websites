// order: 395
// browser: yes
// covers: css/*, index.html, js/main.js, js/features.js, js/i18n.js
/* Colour-blind visitors (about 1 man in 12): a "chosen / not chosen" look must not be told apart by colour alone.
 * Chrome simulates five ways of seeing (Emulation.setEmulatedVisionDeficiency: protanopia, deuteranopia, tritanopia,
 * achromatopsia, blurred vision); the home page is photographed in each, and the pixels of each state are compared.
 * The rule (WCAG 1.4.1, and its note on lightness): two states pass when a shape tells them apart, or when their colours differ by a
 * WCAG contrast of at least 3:1 in every one of the four colour simulations (lightness survives colour blindness; hue does not).
 * Checked here: the shape cues added for docs/COLOUR_BLIND_CHECK.md (the ring round the current language in the language menu, the
 * thicker edge of the chosen season above the hero, the thick line under the chosen season in the "What's on the farm" table) and
 * the shapes that were already there (the dark ring of open days in the week strip, the dark edge of the chosen place in the map
 * list). A deliberate mistake is put in first (the language ring taken away) to prove the measuring catches one.
 * Also: every link inside running text on the home page is underlined (or is a pill-shaped tag). The full table of every state and
 * all five simulations is in docs/COLOUR_BLIND_CHECK.md. */
import zlib from 'node:zlib';
import { run, open, ok, info, settled } from './lib.mjs';

function decodePng(buf) {
  let pos = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('latin1', pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; } else if (type === 'IDAT') idat.push(data); else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(w * h * bpp);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[dst + x - bpp] : 0, b = y ? out[dst - stride + x] : 0, c = x >= bpp && y ? out[dst - stride + x - bpp] : 0;
      let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[dst + x] = v & 255;
    }
  }
  return { w, h, bpp, data: out };
}
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
// the colour that covers most of a box
function dominant(img, x0, y0, x1, y1) {
  const bins = new Map(); let best = null;
  for (let y = Math.max(0, y0); y < Math.min(img.h, y1); y++) for (let x = Math.max(0, x0); x < Math.min(img.w, x1); x++) {
    const k = (y * img.w + x) * img.bpp, key = (img.data[k] >> 3) << 10 | (img.data[k + 1] >> 3) << 5 | (img.data[k + 2] >> 3);
    const e = bins.get(key) || [0, 0, 0, 0]; e[0] += img.data[k]; e[1] += img.data[k + 1]; e[2] += img.data[k + 2]; e[3]++; bins.set(key, e);
    if (!best || e[3] > best[3]) best = e;
  }
  return best ? [best[0] / best[3], best[1] / best[3], best[2] / best[3]] : [0, 0, 0];
}

const VISIONS = ['protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia'];
const DPR = 2;

// each check puts the page in place and returns the two boxes to compare (window coordinates): a thin strip where the shape cue is
const CHECKS = [
  ['language menu: the current language has a dark ring, the others do not', () => {
    scrollTo(0, 0); const b = document.querySelector('.lang-btn'); if (b.getAttribute('aria-expanded') !== 'true') b.click();
    const l = document.querySelector('.lang-list'), e = (x) => { const r = x.getBoundingClientRect(); return { x: r.left + 0.6, y: r.top + r.height * 0.4, w: 1.2, h: r.height * 0.2 }; };
    return [e(l.querySelector('[aria-checked="true"]')), e(l.querySelector('[aria-checked="false"]'))];
  }],
  ['"See the farm in" (above the hero): the chosen season has a thicker dark edge', () => {
    scrollTo(0, 0); const s = document.querySelector('#season-switch'), e = (x) => { const r = x.getBoundingClientRect(); return { x: r.left + r.width * 0.45, y: r.top + 2.9, w: r.width * 0.1, h: 1.2 }; };
    return [e(s.querySelector('[aria-checked="true"]')), e(s.querySelector('[aria-checked="false"]'))];
  }],
  ['"What\'s on the farm" table: a thick line under the chosen season', () => {
    const t = document.querySelector('#farm-glance'); t.scrollIntoView({ block: 'center' });
    const e = (x) => { const r = x.getBoundingClientRect(); return { x: r.left + r.width * 0.4, y: r.bottom - 6.2, w: r.width * 0.2, h: 2 }; };
    return [e(t.querySelector('thead th.is-sel')), e(t.querySelector('thead th[data-col]:not(.is-sel)'))];
  }],
  ['week strip: open days have a dark ring, closed days a pale one', () => {
    const s = [...document.querySelectorAll('.week-strip')].find((w) => w.querySelector('.day.on:not(.today)') && w.querySelector('.day:not(.on):not(.today)'));
    s.scrollIntoView({ block: 'center' });
    const e = (x) => { const r = x.getBoundingClientRect(); return { x: r.left + 0.3, y: r.top + r.height * 0.42, w: 2, h: r.height * 0.16 }; };
    return [e(s.querySelector('.day.on:not(.today)')), e(s.querySelector('.day:not(.on):not(.today)'))];
  }],
  ['farm map list: the chosen place has a dark edge', () => {
    const bs = document.querySelectorAll('#farm-map .map-legend button'); if (bs[0].getAttribute('aria-pressed') !== 'true') bs[0].click();
    bs[0].scrollIntoView({ block: 'center' });
    const e = (x) => { const r = x.getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.bottom - 2.5, w: r.width * 0.3, h: 2 }; };
    return [e(bs[0]), e(bs[1])];
  }],
];

await run('colour-blind', async ({ browser, base, errs }) => {
  const p = await open(browser, base, 'index.html', errs, { viewport: { width: 1280, height: 900 }, deviceScaleFactor: DPR, reducedMotion: 'reduce' });
  await p.addStyleTag({ content: '*{animation:none!important;transition:none!important;scroll-behavior:auto!important} body > div[style*="z-index: 99999"]{display:none!important}' });
  const cdp = await p.context().newCDPSession(p);
  // load every lazy picture first, so the page does not grow while it is measured
  await p.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); }
    await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 4000); }))));
    scrollTo(0, 0);
  });

  // the worst contrast between the two boxes over the four colour simulations
  const measure = async (setup, tries = 3) => {
    let boxes, prev = '', key = '';
    for (let k = 0; k < 4; k++) {   // until the boxes stop moving (pictures still loading above)
      boxes = await p.evaluate(setup); await p.waitForTimeout(200);
      key = JSON.stringify(boxes.map((b) => [Math.round(b.x), Math.round(b.y)])); if (key === prev) break; prev = key;
    }
    await settled(p, 0);   // a state that was just changed (the chosen map place) fades in with a CSS transition: the picture must be taken after it, not during it (a pale edge at load 80)
    const [sx, sy] = await p.evaluate(() => [scrollX, scrollY]);
    const l = Math.floor(Math.min(...boxes.map((b) => b.x)) - 4), t = Math.floor(Math.min(...boxes.map((b) => b.y)) - 4);
    const clip = { x: l + sx, y: t + sy, width: Math.ceil(Math.max(...boxes.map((b) => b.x + b.w)) + 4) - l, height: Math.ceil(Math.max(...boxes.map((b) => b.y + b.h)) + 4) - t, scale: DPR };
    const res = {};
    for (const v of VISIONS) {
      await cdp.send('Emulation.setEmulatedVisionDeficiency', { type: v });
      const img = decodePng(Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png', clip })).data, 'base64'));
      const [a, b] = boxes.map((x) => dominant(img, Math.round((x.x - l) * DPR), Math.round((x.y - t) * DPR), Math.round((x.x + x.w - l) * DPR), Math.round((x.y + x.h - t) * DPR)));
      res[v] = Math.round(contrast(a, b) * 100) / 100;
    }
    await cdp.send('Emulation.setEmulatedVisionDeficiency', { type: 'none' });
    // the boxes must still be where they were when the pictures were taken; if the page moved, measure again
    const after = JSON.stringify((await p.evaluate(setup)).map((b) => [Math.round(b.x), Math.round(b.y)]));
    if (after !== key && tries > 1) return measure(setup, tries - 1);
    return res;
  };
  const worst = (r) => Math.min(...Object.values(r));

  // the deliberate mistake: without its ring, the current language is told apart by colour alone
  const tag = await p.addStyleTag({ content: '.lang-list button[aria-checked="true"]{box-shadow:none!important}' });
  const bad = await measure(CHECKS[0][1]);
  ok('deliberate mistake: with the ring taken away, the measuring sees the current language is not told apart (under 3:1)', worst(bad) < 3, JSON.stringify(bad));
  await tag.evaluate((n) => n.remove());
  await p.keyboard.press('Escape');

  for (const [name, setup] of CHECKS) {
    const r = await measure(setup);
    ok(name + ' (at least 3:1 in every colour simulation)', worst(r) >= 3, JSON.stringify(r));
    await p.keyboard.press('Escape');
  }

  // links inside running text: underlined (or a pill-shaped tag), so they do not depend on colour
  const links = await p.evaluate(() => {
    const bad = []; let n = 0;
    for (const a of document.querySelectorAll('a[href]')) {
      if (!a.getClientRects().length) continue;
      const blk = a.closest('p,li,td,dd,figcaption,blockquote'); if (!blk) continue;
      if (blk.textContent.replace(/\s+/g, ' ').trim().length - a.textContent.trim().length < 12) continue;
      const cs = getComputedStyle(a); if (cs.display !== 'inline') continue;
      n++;
      const pill = parseFloat(cs.borderTopLeftRadius) > 0 && cs.backgroundColor !== getComputedStyle(blk).backgroundColor && !/rgba\(0, 0, 0, 0\)/.test(cs.backgroundColor);
      if (!/underline/.test(cs.textDecorationLine) && !pill) bad.push(a.textContent.trim().slice(0, 40));
    }
    return { n, bad };
  });
  ok('every link inside running text is underlined or a pill-shaped tag (' + links.n + ' links)', links.n > 5 && links.bad.length === 0, links.bad.join(' | '));
  info('the full table of states and simulations: docs/COLOUR_BLIND_CHECK.md');
});
