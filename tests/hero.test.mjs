// order: 350
// browser: yes
// covers: js/hero.js, js/season.js, js/content.js, css/hero.css, index.html
/* The seasonal hero: which season it is on a date, the "See the farm in..." switcher and its little Now and Next tags (on every kind of day, moved by a page left open past midnight, not changed by pressing a season, not cut off or on a letter in five languages at eight sizes), picking things, the tractor, keyboard use,
 * no sideways scrolling from phone to wide screen, reduced motion, and seasonPicker: false. The falling leaves of fall: each one has its three animations (it falls
 * through the hero's own height, it drifts to one side and the other, its drawing tips the way it drifts), they fall from above the top edge to below the bottom edge
 * of the hero whatever its height (the snow too: 1440 x 600), --fh follows the hero's picture when the window does not change (a resize observer), and on a slow computer (the page's own calm mode,
 * data-calm light or most) the layer fades out instead of freezing in mid-air (a transition of its own, out and in), and is hidden where `translate` is not understood (@supports). */
import { run, open, ok, okSoon, until, settled, info } from './lib.mjs';

const season = (p) => p.evaluate(() => document.documentElement.dataset.season);
// Choose a season with the switcher and wait until the scene for it has been drawn.
async function choose(p, s) {
  await p.click(`#season-switch button[data-season="${s}"]`);
  await until(p, (x) => document.documentElement.dataset.season === x && document.querySelectorAll('#field [data-pick]').length > 10, s, 20000);
}
// Click something pickable whose centre really hits itself.
async function clickPick(p) {
  const pt = await p.evaluate(() => {
    for (const el of [...document.querySelectorAll('#field [data-pick]')].reverse()) {
      const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      if (x < 4 || y < 130 || x > innerWidth - 4 || y > innerHeight - 4) continue;
      const hit = document.elementFromPoint(x, y);
      if (hit && hit.closest('[data-pick]') === el) return { x, y };
    }
    return null;
  });
  if (!pt) return false;
  await p.mouse.click(pt.x, pt.y);
  return true;
}
const frames = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

/* ---- the little tags at the top right of the season buttons: "now" on the season that is on today, "next" on the one that starts next (between seasons only "next") ----
 * They follow today's date (the page clock), not the picture. They are drawn again when the farm's day changes (js/live.js announces wa:day when a page is left open past midnight; the tour's
 * pretend days use it too) and when the language changes (tests/i18n-a11y.test.mjs checks the words in all five languages). */
// what the buttons show now, in the order of the buttons: "fall:now=now winter:next=next"
const tagsOf = (q) => q.evaluate(() => [...document.querySelectorAll('#season-switch button')].map((b) => [b.dataset.season].concat([...b.querySelectorAll('.ss-now,.ss-next')].map((n) => n.className.slice(3) + '=' + n.textContent)).join(':')).filter((x) => x.includes('=')).join(' '));
// the page's clock goes to another day and the farm's day changes
const onDay = async (q, iso) => { await q.clock.setSystemTime(new Date(iso)); await q.evaluate(() => document.dispatchEvent(new CustomEvent('wa:day', { detail: '' }))); };
const TAG_DAYS = [   // [the farm's day at noon, what the buttons show, which day it is]
  ['2026-10-02T12:00:00-04:00', 'fall:now=now winter:next=next', 'a day in fall: Now on Fall, Next on Winter (the Christmas trees)'],
  ['2026-11-08T12:00:00-05:00', 'fall:now=now winter:next=next', 'the last day of fall'],
  ['2026-11-09T12:00:00-05:00', 'winter:next=next', 'the day after fall, between seasons: no Now, Next on Winter'],
  ['2026-11-26T12:00:00-05:00', 'winter:next=next', 'Thanksgiving, two days before the first tree day: only Next, on Winter'],
  ['2026-11-28T12:00:00-05:00', 'spring:next=next winter:now=now', 'the first tree day (Saturday, the last weekend in November): Now on Winter, Next on Spring'],
  ['2026-12-06T12:00:00-05:00', 'spring:next=next winter:now=now', 'the last tree day (the Sunday after the first Saturday of December): the last day of winter'],
  ['2026-12-07T12:00:00-05:00', 'spring:next=next', 'the day after the last tree day: only Next, on Spring'],
  ['2027-01-20T12:00:00-05:00', 'spring:next=next', 'January: only Next, on Spring'],
  ['2027-04-14T12:00:00-04:00', 'spring:next=next', 'the day before spring'],
  ['2027-04-15T12:00:00-04:00', 'spring:now=now summer:next=next', 'the first day of spring'],
  ['2027-05-10T12:00:00-04:00', 'spring:now=now summer:next=next', 'a day in spring: Now on Spring, Next on Summer'],
  ['2027-06-08T12:00:00-04:00', 'summer:next=next', 'between spring and summer'],
  ['2027-06-20T12:00:00-04:00', 'summer:now=now fall:next=next', 'a day in summer: Now on Summer, Next on Fall'],
  ['2027-07-11T12:00:00-04:00', 'fall:next=next', 'between summer and fall'],
  ['2026-11-27T12:00:00-05:00', 'winter:next=next', 'the Friday after Thanksgiving (no tree day): still only Next, on Winter'],
  ['2026-12-02T12:00:00-05:00', 'spring:next=next winter:now=now', 'a weekday between the two tree weekends: the winter season is on (Now on Winter)'],
  ['2027-11-27T12:00:00-05:00', 'spring:next=next winter:now=now', 'the first tree day of the next year (2027: the last Saturday of November is Nov 27)'],
  ['2027-11-26T12:00:00-05:00', 'winter:next=next', 'the day before it (2027): only Next, on Winter'],
];
// What a customer would call wrong with a tag: cut off (by the window, or by a box with overflow hidden), on top of another button, another tag or "See the farm in", or on two lines
const TAG_PROBLEMS = () => {
  const R = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
  const meet = (a, b) => a.l < b.r - 0.5 && a.r > b.l + 0.5 && a.t < b.b - 0.5 && a.b > b.t + 0.5;
  const sw = document.querySelector('#season-switch'), btns = [...sw.querySelectorAll('button')], tags = [...sw.querySelectorAll('.ss-now,.ss-next')];
  const label = sw.querySelector('.ss-label'), lr = label && label.getClientRects().length ? R(label) : null, bad = [];
  for (const t of tags) {
    const tr = R(t), own = t.parentElement, who = t.className.slice(3) + ' on ' + own.dataset.season;
    if (tr.l < 0 || tr.r > innerWidth || tr.t < 0) bad.push(who + ' is outside the window');
    for (let a = own; a && a !== document.documentElement; a = a.parentElement) {   // a box that cuts off what sticks out of it
      const cs = getComputedStyle(a), x = /hidden|clip|auto|scroll/.test(cs.overflowX), y = /hidden|clip|auto|scroll/.test(cs.overflowY), ar = R(a);
      if ((x && (tr.l < ar.l - 0.5 || tr.r > ar.r + 0.5)) || (y && (tr.t < ar.t - 0.5 || tr.b > ar.b + 0.5))) bad.push(who + ' is cut off by ' + a.tagName.toLowerCase() + '.' + String(a.className).split(' ')[0]);
    }
    btns.forEach((b) => { if (b !== own && meet(tr, R(b))) bad.push(who + ' covers the ' + b.dataset.season + ' button'); });
    if (lr && meet(tr, lr)) bad.push(who + ' covers "See the farm in"');
    tags.forEach((o) => { if (o !== t && meet(tr, R(o))) bad.push(who + ' touches the other tag'); });
    if (t.offsetHeight > 2.2 * parseFloat(getComputedStyle(t).fontSize)) bad.push(who + ' is on two lines');
  }
  return bad;
};
// Pixels: the letters of the buttons must look the same with the tags as without them. Three pictures of the row of buttons (and the room above it, where the tags stand): as it is, with the tags
// hidden, and with the tags hidden and the letters see-through (the letters are where the last two differ). A letter pixel that differs between the first two is under a tag.
// `blank` is an empty page that only decodes the pictures.
async function coveredInk(q, blank) {
  const clip = await q.evaluate(() => { const r = document.querySelector('#season-switch').getBoundingClientRect(), x = Math.max(0, Math.floor(r.left) - 20); return { x, y: Math.max(0, Math.floor(r.top) - 30), width: Math.min(innerWidth, Math.ceil(r.right) + 20) - x, height: Math.ceil(r.height) + 40 }; });
  const shoot = async (css) => {
    const st = css ? await q.addStyleTag({ content: css }) : null;
    const picture = (await q.screenshot({ clip })).toString('base64');
    if (st) await st.evaluate((e) => e.remove());
    return picture;
  };
  const a = await shoot(''), b = await shoot('.ss-now,.ss-next{visibility:hidden!important}'), c = await shoot('.ss-now,.ss-next{visibility:hidden!important}.ss-name{color:transparent!important}');
  return blank.evaluate(async ([A, B, C]) => {
    const px = async (s) => { const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + s)).blob()); const g = new OffscreenCanvas(bmp.width, bmp.height).getContext('2d'); g.drawImage(bmp, 0, 0); return g.getImageData(0, 0, bmp.width, bmp.height).data; };
    const far = (x, y, i) => Math.max(Math.abs(x[i] - y[i]), Math.abs(x[i + 1] - y[i + 1]), Math.abs(x[i + 2] - y[i + 2]));
    const [pa, pb, pc] = [await px(A), await px(B), await px(C)];
    let ink = 0, covered = 0;
    for (let i = 0; i < pa.length; i += 4) if (far(pb, pc, i) > 60) { ink++; if (far(pa, pb, i) > 30) covered++; }
    return { ink, covered };
  }, [a, b, c]);
}
async function tagChecks({ browser, base, errs }) {
  // which season has which tag, on every kind of day (the page's clock is moved and the farm's day announced, as js/live.js does it after midnight)
  const q = await open(browser, base, 'index.html', errs, { time: TAG_DAYS[0][0] });
  for (const [iso, want, what] of TAG_DAYS) {
    await onDay(q, iso);
    const got = await tagsOf(q);
    ok(`${what} (${iso.slice(0, 10)}): the buttons show "${want}"`, got === want, got);
  }
  // the real way a page changes day: left open past midnight, js/live.js notices at its next minute and the tags move on their own
  await onDay(q, '2026-11-08T12:00:00-05:00');
  await q.clock.setSystemTime(new Date('2026-11-09T00:30:00-05:00'));
  await q.clock.runFor(61000);
  const over = await tagsOf(q);
  ok('a page left open from the last day of fall into the next day: "now" is gone and "next" stays on Winter, by itself', over === 'winter:next=next', over);
  const clockless = await q.evaluate(() => { const S = WISE_ACRES.seasons; return { between: S.upcoming(new Date(2026, 10, 9)).id, inFall: S.upcoming(new Date(2026, 9, 2)).id, inWinter: S.upcoming(new Date(2026, 11, 1)).id }; });
  ok('W.seasons.upcoming(date): the season that starts next and is not on (Nov 9: winter, Oct 2: winter, Dec 1: spring)', clockless.between === 'winter' && clockless.inFall === 'winter' && clockless.inWinter === 'spring', JSON.stringify(clockless));
  await q.context().close();

  // the checks can fail: a tag moved onto the letters of its button is found in the pictures, and a tag moved onto the next button is found by the measuring of the boxes
  const m = await open(browser, base, 'index.html', errs, { viewport: { width: 1440, height: 900 }, time: TAG_DAYS[0][0] });
  await m.addStyleTag({ content: 'html{scroll-behavior:auto!important}.action-bar{display:none!important}body *{animation:none!important;transition:none!important}#bee-fly,#critters,.bee-fly,.particles{visibility:hidden!important}' });   // (nothing may move between the pictures: the bee and the leaves are hidden)
  const blank0 = await m.context().newPage();
  const fine = await coveredInk(m, blank0), fineBoxes = await m.evaluate(TAG_PROBLEMS);
  await m.addStyleTag({ content: '.ss-next{top:9px!important;right:12px!important}' });   // on the word "Winter"
  const hit1 = await coveredInk(m, blank0);
  await m.addStyleTag({ content: '.ss-now{right:-80px!important}' });   // on the Winter button
  const hit2 = await m.evaluate(TAG_PROBLEMS);
  ok('the checks can fail: a tag moved onto the letters of its button is found in the pictures (' + hit1.covered + ' of ' + hit1.ink + ' letter pixels), a tag moved onto the next button by the measuring of the boxes, and the page as it is has neither',
    fine.covered === 0 && fineBoxes.length === 0 && hit1.covered > 20 && hit2.some((x) => /covers the winter button|touches the other tag/.test(x)), JSON.stringify({ fine, fineBoxes, hit1, hit2 }));
  await m.context().close();

  // the tags in every language, at the sizes of the site: not cut off, not on another button, tag or words (computer, tablet, phone, phone on its side)
  const SIZES = [[1920, 900], [1440, 900], [1100, 800], [768, 1024], [390, 844], [360, 740], [320, 640], [667, 375], [740, 360]];
  const STATES = [TAG_DAYS[0][0], TAG_DAYS[2][0], TAG_DAYS[4][0], TAG_DAYS[7][0], TAG_DAYS[10][0], TAG_DAYS[12][0]];   // both tags side by side (fall); only Next, on the last button; Now on the last and Next on the first (winter); only Next, on the first; Now on the first (spring) and Next on the second; Now on the second (summer) and Next on the third
  for (const lang of ['en', 'es', 'hi', 'vi', 'zh']) {
    const l = await open(browser, base, 'index.html', errs, { lang: lang === 'en' ? undefined : lang, viewport: { width: 1920, height: 900 }, time: STATES[0] });
    await l.addStyleTag({ content: 'html{scroll-behavior:auto!important}.action-bar{display:none!important}body *{animation:none!important;transition:none!important}#bee-fly,#critters,.bee-fly,.particles{visibility:hidden!important}' });   // (nothing may move between the pictures: the bee and the leaves are hidden)
    const blank = await l.context().newPage();
    const probs = []; let looks = 0, ink = 0, covered = 0, pictures = 0;
    for (const [w, h] of SIZES) {
      await l.setViewportSize({ width: w, height: h });
      for (const iso of STATES) {
        await onDay(l, iso);
        await l.clock.runFor(200);
        const bad = await l.evaluate(TAG_PROBLEMS);
        looks++;
        if (bad.length) probs.push(w + 'x' + h + ' ' + iso.slice(0, 10) + ': ' + bad.join(', '));
        if ((w === 1440 || w === 768 || (w === 390 && iso === STATES[0])) && iso !== STATES[1] && iso !== STATES[3]) {   // pictures: every season has had a Now and a Next (the days that repeat a button are left out)
          const c = await coveredInk(l, blank);
          ink += c.ink; covered += c.covered; pictures++;
        }
      }
    }
    ok(`${lang}: the Now and Next tags are not cut off and are not on another button, tag or words, at 1920, 1440, 1100, 768, 390, 360 and 320 px and on two phones on their side (${looks} looks)`, probs.length === 0, probs.slice(0, 3).join(' | '));
    ok(`${lang}: no tag covers a letter of the buttons (${pictures} pictures at 1440, 768 and 390 px, ${ink} letter pixels, every season with a Now and a Next)`, ink > 500 && covered === 0, ink + ' letter pixels, ' + covered + ' under a tag');
    await l.context().close();
  }
}

// The people in the spring field, as the window shows them now (the first screen: what is below the fold or past the sides is not seen). For each one, in the order of the picture:
//   x     the middle of its drawing across the hero
//   on    the share of the drawing's box (.kid-pick) inside the window and the hero
//   cov   of the part of that box that is on screen, the share under the page's own words, pills, chips, buttons or the picker card (the page's text has pointer-events: none, so asking what is on
//         top of a point never finds it: these are measured as rectangles, the lines of the words one by one)
//   head  of the head and the hat (the upper 45 % of what is drawn) the share that is seen: on screen, not under the page, not under a plant, a sunflower or the grass in front
//   body  the same for everything that is drawn of the person (what is below the fold counts as not seen)
//   front the share of what is drawn that the drawing of another person is over
//   tap   the share of its tap area (6 x 6 points) that lies inside a sunflower's tap area, and mid: whether the middle of the person does (a tap there snips the flower, the person says nothing)
//   own   the share of its tap area (6 x 6 points, the ones on screen and not under the page's own chips or buttons) where a tap really lands on the person, whatever is in front (a sunflower, a strawberry, another person)
// What is drawn is found with isPointInFill / isPointInStroke on the person's own shapes, so that points below the fold can be told as well.
const kidsView = (q) => q.evaluate(() => {
  const scene = document.querySelector('#hero-scene'), hero = document.querySelector('#top'), h0 = hero.getBoundingClientRect(), W = innerWidth, H = innerHeight;
  // who gets a tap on each kid's tap area: the browser's own answer for 6 x 6 points of it that are on screen (a tap on the part of the area that is under the page's chips or buttons goes to them: left out)
  const who = [...document.querySelectorAll('#field [data-npc="kid"]')].map((k) => {
    const r = k.querySelector('.npc-hit').getBoundingClientRect();
    let n = 0, mine = 0;
    for (let gx = 0; gx < 6; gx++) for (let gy = 0; gy < 6; gy++) {
      const x = r.left + (gx + 0.5) * r.width / 6, y = r.top + (gy + 0.5) * r.height / 6;
      if (x < 0 || x > W || y < 0 || y > H) continue;
      const e = document.elementFromPoint(x, y);
      if (e && !scene.contains(e)) continue;   // (the page's own chip or button)
      n++; if (e && k.contains(e)) mine++;
    }
    return n ? Math.round(100 * mine / n) : 100;
  });
  // (the picture does not take taps itself, so asking what is on top of a point never finds a plant: for the measuring every shape of it can be found, and the transparent tap areas are skipped)
  const probe = document.head.appendChild(document.createElement('style'));
  probe.textContent = '#hero-scene svg *{pointer-events:auto!important}';
  // (the basket of a person is a <use>, which has no shapes of its own to ask: they are copied in for the measuring, as the use scales them, so that the basket counts as part of the person)
  const sym = document.querySelector('symbol#basket'), copies = [];
  if (sym) document.querySelectorAll('#field [data-npc="kid"] use[href="#basket"]').forEach((u) => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', 'translate(0 .4) scale(.64)');   // (the use is 64 x 52 for a symbol of 100 x 80: .64, and 0.4 down to be in the middle)
    [...sym.children].forEach((c) => g.appendChild(c.cloneNode(true)));
    u.parentNode.insertBefore(g, u.nextSibling); copies.push(g);
  });
  const win = { l: 0, t: Math.max(0, h0.top), r: W, b: Math.min(H, h0.bottom) };
  const cover = [], add = (r) => { if (r.width > 1 && r.height > 1) cover.push(r); };
  const copy = document.querySelector('.hero-copy'), tw = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const e = n.parentElement;
    if (!n.data.trim() || !e.getClientRects().length || getComputedStyle(e).visibility === 'hidden' || e.closest('[hidden], .sr-only')) continue;
    const rg = document.createRange(); rg.selectNodeContents(n);
    for (const r of rg.getClientRects()) add(r);
  }
  for (const e of hero.querySelectorAll('.hero-cta a, .chips li, .season-switch button, .hero-note a, .hero-live .live, #picker')) if (e.getClientRects().length) add(e.getBoundingClientRect());
  const under = (x, y) => cover.some((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
  const flowers = [...document.querySelectorAll('#fore .flower-cut')].map((f) => f.querySelector(':scope > rect').getBoundingClientRect());
  const inFlower = (x, y) => flowers.some((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
  const shapesOf = (k) => [...k.querySelectorAll('.kid-pick path, .kid-pick circle, .kid-pick ellipse, .kid-pick rect, .kid-pick polygon, .kid-pick polyline')].filter((e) => !e.closest('.npc-hit') && !e.closest('defs')).map((e) => {
    const m = e.getScreenCTM(), cs = getComputedStyle(e);
    return m ? { e, inv: m.inverse(), fill: cs.fill !== 'none', stroke: cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0 } : null;
  }).filter(Boolean);
  const paintedAt = (sh, x, y) => { const pt = new DOMPoint(x, y).matrixTransform(sh.inv); return (sh.fill && sh.e.isPointInFill(pt)) || (sh.stroke && sh.e.isPointInStroke(pt)); };
  const list = [...document.querySelectorAll('#field [data-npc="kid"]')], shapes = list.map(shapesOf);
  const result = list.map((k, i) => {
    const d = k.querySelector('.kid-pick').getBoundingClientRect();
    const iw = Math.max(0, Math.min(d.right, win.r) - Math.max(d.left, win.l)), ih = Math.max(0, Math.min(d.bottom, win.b) - Math.max(d.top, win.t));
    let seen = 0, hid = 0;
    for (let gx = 0; gx < 12; gx++) for (let gy = 0; gy < 12; gy++) {
      const x = d.left + (gx + 0.5) * d.width / 12, y = d.top + (gy + 0.5) * d.height / 12;
      if (x < win.l || x > win.r || y < win.t || y > win.b) continue;
      seen++; if (under(x, y)) hid++;
    }
    const pts = [];
    for (let gx = 0; gx < 24; gx++) for (let gy = 0; gy < 24; gy++) {
      const x = d.left + (gx + 0.5) * d.width / 24, y = d.top + (gy + 0.5) * d.height / 24;
      if (shapes[i].some((sh) => paintedAt(sh, x, y))) pts.push([x, y]);
    }
    let head = 0, body = 0, front = 0, hn = 0;
    if (pts.length) {
      const ys = pts.map((q) => q[1]), top = Math.min(...ys), cut = top + 0.45 * (Math.max(...ys) - top);
      let hv = 0, bv = 0;
      for (const [x, y] of pts) {
        const isHead = y < cut;
        if (isHead) hn++;
        if (shapes.some((s, j) => j > i && s.some((sh) => paintedAt(sh, x, y)))) front++;   // (a person drawn later is in front)
        if (x < win.l || x > win.r || y < win.t || y > win.b || under(x, y)) continue;
        const t = document.elementsFromPoint(x, y).find((e) => !(e.tagName === 'rect' && e.getAttribute('fill') === 'transparent') && (k.contains(e) || !e.closest('[data-npc="kid"]')));   // the top thing that is drawn there (not a tap area, not another person)
        if (t && scene.contains(t) && !k.contains(t)) continue;   // a plant, a sunflower or the grass in front
        bv++; if (isHead) hv++;
      }
      head = hn ? Math.round(100 * hv / hn) : 0; body = Math.round(100 * bv / pts.length); front = Math.round(100 * front / pts.length);
    }
    const hit = k.querySelector('.npc-hit').getBoundingClientRect();
    let tn = 0, tf = 0;
    for (let gx = 0; gx < 6; gx++) for (let gy = 0; gy < 6; gy++) {
      const x = hit.left + (gx + 0.5) * hit.width / 6, y = hit.top + (gy + 0.5) * hit.height / 6;
      if (x < 0 || x > W || y < 0 || y > H) continue;
      tn++; if (inFlower(x, y)) tf++;
    }
    return { x: Math.round(d.left + d.width / 2 - h0.left), on: Math.round(100 * iw * ih / (d.width * d.height)), cov: seen ? Math.round(100 * hid / seen) : 100, head, body, front, tap: tn ? Math.round(100 * tf / tn) : 0, mid: inFlower(hit.left + hit.width / 2, hit.top + hit.height / 2), own: who[i] };
  });
  copies.forEach((g) => g.remove());
  probe.remove();
  return result;
});

// The friend button (#npc-btn) pressed once for every friend of the picture, as the window shows it now: for each press who spoke (the bubble is put on its element: `_say`) and how much of that friend's tap area is
// inside the window and the hero, and how many of the friends have at least 60 % of theirs there (good) or any of it (any), worked out just before the press.
const friendTour = (q) => q.evaluate(() => {
  const hero = document.querySelector('#top'), btn = document.querySelector('#npc-btn'), all = [...document.querySelectorAll('#hero-scene [data-npc]')];
  const share = (el) => {
    const r = (el.querySelector('.npc-hit') || el).getBoundingClientRect(), h = hero.getBoundingClientRect();
    const w = Math.min(r.right, h.right, innerWidth) - Math.max(r.left, h.left, 0), v = Math.min(r.bottom, h.bottom, innerHeight) - Math.max(r.top, h.top, 0);
    return r.width > 0 && r.height > 0 ? Math.max(0, w) * Math.max(0, v) / (r.width * r.height) : 0;
  };
  const out = [];
  for (let i = 0; i < all.length; i++) {
    const before = all.map(share);
    btn.click();
    const bubble = [...hero.querySelectorAll('.npc-say')].pop(), who = all.findIndex((e) => e._say === bubble);
    out.push({ who, share: who >= 0 ? Math.round(100 * before[who]) : -1, good: before.filter((v) => v >= 0.6).length, any: before.filter((v) => v > 0).length });
  }
  return { n: all.length, out };
});

await run('hero', async ({ browser, base, errs }) => {
  const page = async (w, h, o = {}) => {
    const p = await open(browser, base, 'index.html', errs, { viewport: { width: w, height: h }, reducedMotion: o.reduced ? 'reduce' : undefined });
    await p.addStyleTag({ content: 'html{scroll-behavior:auto!important}.action-bar{display:none!important}' });
    await until(p, () => !!(window.WISE_ACRES.hero && document.querySelectorAll('#field [data-pick]').length > 10), null, 20000);
    return p;
  };
  const p = await page(1440, 900);

  // ---- date logic
  const d = await p.evaluate(() => { const S = WISE_ACRES.seasons, c = (y, m, dd) => S.current(new Date(y, m - 1, dd)); return { a: c(2026, 9, 30), b: c(2026, 4, 25), c: c(2026, 6, 20), d: c(2026, 12, 1), e: c(2026, 12, 20), f: c(2027, 3, 1), g: c(2026, 11, 20) }; });
  ok('Sep 30 is fall, Apr 25 spring, Jun 20 summer', d.a === 'fall' && d.b === 'spring' && d.c === 'summer', JSON.stringify(d));
  ok('Dec 1 is winter (the trees are on), Dec 20 and Mar 1 are spring (between seasons the site opens on the season that starts next: it no longer stays wintry through the holidays), Nov 20 is winter (the trees are next)', d.d === 'winter' && d.e === 'spring' && d.f === 'spring' && d.g === 'winter', JSON.stringify(d));
  const between = await p.evaluate(() => { const S = WISE_ACRES.seasons, c = (y, m, dd) => S.current(new Date(y, m - 1, dd, 12)); return [c(2026, 11, 9), c(2026, 11, 10), c(2026, 12, 6), c(2026, 12, 7), c(2027, 6, 9), c(2027, 7, 20), c(2027, 11, 8)].join(); });
  ok('the day after fall (Nov 9, Nov 10) the site opens on Winter, the day after the last tree day (Dec 7) on Spring, Jun 9 on Summer, Jul 20 on Fall, and Nov 8 (the last day of fall) on Fall', between === 'winter,winter,winter,spring,summer,fall,fall', between);

  // ---- the page opens on today's season, with the switcher
  const cur = await p.evaluate(() => WISE_ACRES.seasons.current());
  ok('page opens on the current season', (await season(p)) === cur, cur);
  ok('switcher is visible with 4 radio buttons', (await p.locator('#season-switch button[role=radio]').count()) === 4 && (await p.locator('#season-switch').isVisible()));
  ok('"now" tag on the current season', (await p.locator(`#season-switch button[data-season="${cur}"] .ss-now`).count()) === 1);
  const tags0 = await tagsOf(p);
  ok('on the test day (a day in fall) "now" is on Fall and "next" on Winter, and nowhere else', tags0 === 'fall:now=now winter:next=next', tags0);
  await tagChecks({ browser, base, errs });

  // ---- each season: the scene, the radio state, the season tab, the chooser card
  const want = { spring: 'rgb(255, 221, 228)', summer: 'rgb(225, 230, 255)', fall: 'rgb(255, 227, 194)', winter: 'rgb(220, 236, 250)' };
  for (const s of ['spring', 'summer', 'fall', 'winter']) {
    await choose(p, s);
    ok(`${s}: the Now and Next tags stay where they are (they follow today's date, not the picture)`, (await tagsOf(p)) === tags0, await tagsOf(p));
    ok(`${s}: data-season and radio state`, (await season(p)) === s && (await p.getAttribute(`#season-switch button[data-season="${s}"]`, 'aria-checked')) === 'true' && (await p.locator('#season-switch [aria-checked=true]').count()) === 1);
    ok(`${s}: pickable things drawn`, (await p.locator('#field [data-pick]').count()) > 10);
    await okSoon(`${s}: season tab synced`, () => p.getAttribute(`#tab-${s}`, 'aria-selected'), (v) => v === 'true');
    await okSoon(`${s}: chooser card colour`, () => p.evaluate(() => getComputedStyle(document.querySelector('.choose-farm')).backgroundColor), (v) => v === want[s]);
    const art = await p.evaluate(() => ({ art: [...document.querySelectorAll('.choose-farm .choose-art')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.dataset.only), ticks: [...document.querySelectorAll('.choose-farm .ticks')].filter((e) => e.getBoundingClientRect().height > 0).map((e) => e.dataset.only) }));
    ok(`${s}: chooser art and bullets match`, art.art.length === 1 && art.art[0] === s && art.ticks.length === 1 && art.ticks[0] === s, JSON.stringify(art));
    ok(`${s}: hint text`, ((await p.textContent('#pick-msg')) || '').length > 10 && (await p.textContent('#pick-count')) === '0');
    // the chooser card's buttons follow the season: reserve in spring/summer/fall, "Tell me when" in winter, "See prices" in fall only
    const acts = await p.evaluate(() => Array.from(document.querySelectorAll('.choose-farm .card-actions a')).filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.textContent.trim().replace(/\s+/g, ' ')));
    const wantRed = s === 'winter' ? 'Tell me when' : 'Reserve the farm';
    ok(`${s}: the card buttons are "${wantRed}"${s === 'fall' ? ', Directions and See prices' : ' and Directions'}`, acts.includes(wantRed) && acts.includes('Directions') && acts.includes('See prices') === (s === 'fall') && acts.includes(s === 'winter' ? 'Reserve the farm' : 'Tell me when') === false, JSON.stringify(acts));
  }

  // ---- spring: the people in the strawberry rows stand where they can be seen (not behind the words, the chips, the card or the sunflowers), and the sunflowers at the sides can be snipped
  await choose(p, 'spring');
  const measuring = await p.addStyleTag({ content: '#bee-fly{visibility:hidden!important}.kid-pick{animation:none!important}' });   // (the bee flies over everything, and a kid that bends over the rows must stand still for the measuring)
  await p.clock.runFor(600);
  // The people of the field in real windows (the window, not the screen: the browser of a laptop is 100 to 130 px lower than its screen), one size after the other on this page, as kidsView (above) sees them.
  // A person is "clear" when 80 % of its head and hat and 60 % of its body are on the first screen and not under anything (the page's words, pills, chips and card, a plant, a sunflower), and nobody is in front of it.
  const clearKid = (k) => k.head >= 80 && k.body >= 60 && k.front <= 10;
  const SEEN = [[1920, 950, 3], [1920, 1080, 3], [2560, 1440, 3], [1440, 900, 3], [1440, 780, 2]];   // [window width, window height, clear people wanted at each side]
  const NEAR = [[1536, 730], [1100, 800], [992, 800]];   // looked at too (nothing is asked of how many are clear: see below), for the sunflowers and for nobody being cut off at the sides
  const LOW = [[1366, 650], [1280, 680], [1280, 600], [1024, 650]];   // windows so low that the first row of strawberries is under their bottom edge
  const view = {};
  for (const [w, h] of [...SEEN, ...NEAR, ...LOW]) {
    await p.setViewportSize({ width: w, height: h });
    await p.clock.runFor(300);
    view[w + 'x' + h] = await kidsView(p);
  }
  for (const [w, h, want] of SEEN) {
    const v = view[w + 'x' + h], left = v.filter((k) => k.x < w / 2 && clearKid(k)).length, right = v.filter((k) => k.x >= w / 2 && clearKid(k)).length;
    ok(`spring, window ${w} x ${h}: ${left} clear people at the left and ${right} at the right of the field (at least ${want} at each side; clear: 80 % of the head and 60 % of the body in sight, nobody in front)`, left >= want && right >= want, JSON.stringify(v.map((k) => [k.x, k.head, k.body, k.cov, k.front])));
  }
  // Where fewer can be clear (said, not asked): at 1536 x 730 the window's bottom edge cuts the people (1 at the left and 2 at the right are clear), and in the windows of 1100 and 992 px the chips and the
  // picker card take some of the ground (2 and 3, 2 and 2)
  for (const [w, h] of NEAR) {
    const v = view[w + 'x' + h];
    info(`spring, window ${w} x ${h}: ${v.filter((k) => k.x < w / 2 && clearKid(k)).length} clear people at the left, ${v.filter((k) => k.x >= w / 2 && clearKid(k)).length} at the right; the best shows ${Math.max(...v.map((k) => k.head >= 80 ? k.body : 0))} % of what is drawn of it`);
  }
  // The first row of strawberries ends under the bottom edge of the window in the low windows: no person of the field can be on the first screen there (the picture sits at the bottom of the hero, which is about 800 px high
  // however low the window is); farm people stand in the rows, not on the hills, so nothing is asked of those sizes but that it is so
  for (const [w, h] of LOW) {
    await p.setViewportSize({ width: w, height: h });
    const first = await p.evaluate(() => Math.round(document.querySelector('#field use[href="#sb-plant"]').getBoundingClientRect().bottom));
    ok(`spring, window ${w} x ${h}: the first row of strawberries ends ${first} px down, under the bottom edge of the window (${h} px; at most 20 px of it is above): nothing of the field is on the first screen`, first >= h - 20, String(first));
  }
  for (const [w, h] of [...SEEN, ...NEAR]) {
    const v = view[w + 'x' + h];
    ok(`spring, window ${w} x ${h}: nobody stands behind another one (at most 10 % of a person is under another), ${v.length} people`, v.length >= 6 && v.every((k) => k.front <= 10), JSON.stringify(v.map((k) => k.front)));
  }
  // the people and the sunflowers: the middle of a person is never inside a sunflower's tap area and at most 30 % of its own tap area is (at 1920 x 1080, 1440 x 900 and 1100 x 800)
  for (const [w, h] of [[1920, 1080], [1440, 900], [1100, 800]]) {
    const v = view[w + 'x' + h];
    ok(`spring, window ${w} x ${h}: no person has its middle in a sunflower's tap area, and each keeps 70 % or more of its own tap area (${Math.max(...v.map((k) => k.tap))} % is the most that is inside one)`, v.every((k) => !k.mid && k.tap <= 30), JSON.stringify(v.map((k) => [k.x, k.tap, k.mid])));
    ok(`spring, window ${w} x ${h}: a tap on a person lands on that person (at least 70 % of its tap area is its own, whatever is in front of it; ${Math.min(...v.map((k) => k.own))} % is the least)`, v.every((k) => k.own >= 70), JSON.stringify(v.map((k) => [k.x, k.own])));
  }
  for (const [w, h] of [[1100, 800], [992, 800]]) {
    const v = view[w + 'x' + h];
    ok(`spring, window ${w} x ${h}: nobody is cut off at the sides (at least 60 % of every drawing is inside the window)`, v.every((k) => k.on >= 60), JSON.stringify(v.map((k) => [k.x, k.on])));
  }
  // the friend button says hi to a friend that can be seen: pressed once for every friend (the people of the field, the riders, the barrel kids), each one that speaks has 60 % or more of its tap area inside the window and
  // the hero (when any friend has: otherwise one that shows at all), the friends that speak are not always the same, and none that is cut off at a side or under the bottom edge speaks while others can be seen
  for (const [w, h] of [[1440, 900], [1100, 800], [992, 800], [1366, 650]]) {
    await p.setViewportSize({ width: w, height: h });
    const t = await friendTour(p), spoke = new Set(t.out.map((o) => o.who));
    const bad = t.out.filter((o) => o.who < 0 || (o.good ? o.share < 60 : o.any ? o.share <= 0 : false));
    ok(`friend button, window ${w} x ${h}: pressed ${t.n} times, every friend that speaks is on the screen (60 % or more of its tap area; ${t.out[0].good} of the ${t.n} friends are, ${t.out[0].any} show at all); ${bad.length} do not`, t.n >= 15 && bad.length === 0, JSON.stringify(t.out));
    // (when no friend shows at all, the picture being under the bottom edge as at 1366 x 650, the button goes round all of them: it is also the way for someone who cannot see the picture)
    const shows = t.out[0].any > 0;
    ok(`...and it goes round: ${spoke.size} different friends spoke${shows ? '' : ' (none shows: all of them, in turn)'}`, shows ? spoke.size >= Math.min(3, t.out[0].good || t.out[0].any) && spoke.size <= Math.max(t.out[0].good, t.out[0].any) : spoke.size === t.n, JSON.stringify([...spoke]));
  }
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.clock.runFor(300);
  const hint = (((await p.textContent('#pick-msg')) || '').replace(/\s+/g, ' ')).trim();
  ok('spring: the hint line tells about the sunflowers too ("Try it! Tap the strawberries to pick them, or snip a sunflower.")', hint === 'Try it! Tap the strawberries to pick them, or snip a sunflower.', hint);
  const flowers = await p.evaluate(() => [...document.querySelectorAll('#fore .flower-cut')].map((e) => e.dataset.pick));
  ok('spring: the five sunflowers at the sides are things to snip, as in summer', flowers.length === 5 && flowers.every((k) => k === 'fruit'), JSON.stringify(flowers));
  // one real click on the head of a sunflower: it is snipped (counted in the basket, drawn picked), it is not a strawberry, and it grows back after a few seconds like the others
  const aim = await p.evaluate(() => {
    for (const [i, e] of [...document.querySelectorAll('#fore .flower-cut')].entries()) {
      const r = e.getBoundingClientRect();
      for (const [a, c] of [[.5, .12], [.5, .2], [.4, .12], [.6, .12], [.5, .3]]) {
        const x = r.left + r.width * a, y = r.top + r.height * c, top = document.elementFromPoint(x, y);
        if (x > 4 && y > 130 && x < innerWidth - 4 && y < innerHeight - 4 && top && top.closest('.flower-cut') === e) return { i, x, y };
      }
    }
    return null;
  });
  ok('spring: the head of a sunflower can be clicked (it is the top thing there)', !!aim, JSON.stringify(aim));
  if (aim) {
    const n0 = +(await p.textContent('#pick-count'));
    await p.mouse.click(aim.x, aim.y);
    await okSoon('spring: a click on a sunflower snips it (the basket counts it, the flower is drawn picked)', () => p.evaluate((i) => { const e = document.querySelectorAll('#fore .flower-cut')[i]; return { n: +document.querySelector('#pick-count').textContent, picked: e.dataset.state === 'picked' && e.querySelector('.berry').classList.contains('is-picked') }; }, aim.i), (v) => v.n === n0 + 1 && v.picked);
    await p.clock.fastForward(12000);
    await okSoon('...and it grows back after a few seconds', () => p.evaluate((i) => { const e = document.querySelectorAll('#fore .flower-cut')[i]; return !e.dataset.state && !e.querySelector('.berry').classList.contains('is-picked'); }, aim.i), (v) => v === true);
    await p.click('#pick-btn');
    await okSoon('...the button of the basket picks a strawberry or snips a flower, one more in the basket', () => p.textContent('#pick-count'), (v) => +v === n0 + 2);
  }
  await measuring.evaluate((e) => e.remove());

  // ---- fall: picking, the wagon, the tractor
  await choose(p, 'fall');
  ok('fall: the "New tomatoes" chip shows', await p.locator('.chip-new').isVisible());
  const c0 = +(await p.textContent('#pick-count'));
  ok('fall: a pumpkin can be clicked', await clickPick(p));
  await okSoon('fall: the count goes up and the pumpkin is picked', () => p.evaluate(() => ({ n: +document.querySelector('#pick-count').textContent, picked: document.querySelectorAll('#field [data-state=picked]').length })), (v) => v.n === c0 + 1 && v.picked === 1);
  await p.click('#pick-btn');
  await okSoon('fall: the button picks one too', () => p.textContent('#pick-count'), (v) => +v === 2);
  await p.evaluate(() => document.querySelector('#field [data-rig]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  ok('fall: tapping the wagon toots', (await p.locator('#field .rig.tooting').count()) === 1);
  const t1 = await p.evaluate(() => getComputedStyle(document.querySelector('#field .rig')).transform);
  await okSoon('fall: the tractor moves', () => p.evaluate(() => getComputedStyle(document.querySelector('#field .rig')).transform), (v) => v !== t1, 20000);
  ok('fall: falling leaves', (await p.locator('.particles .leaf').count()) > 8);
  // each leaf: falls through the hero's own height (heroFall, the leaf's `translate`), drifts to one side and the other (heroSway, its transform, smooth and back and forth) and its
  // drawing tips the way it drifts (heroRock, on its ::before: only the drawing turns, so the drifting stays level)
  const leaves = await p.evaluate(() => {
    const box = document.querySelector('.particles'), all = document.getAnimations(), list = [...box.querySelectorAll('.leaf')];
    const sets = list.map((l) => all.filter((a) => a.effect && a.effect.target === l).map((a) => (a.effect.pseudoElement || 'self') + ':' + a.animationName).sort().join(' + '));
    const timing = (name) => { const a = all.find((x) => x.effect && x.effect.target === list[0] && x.animationName === name), t = a && a.effect.getTiming(); return t && { dir: t.direction, iterations: t.iterations, easing: a.effect.getKeyframes()[0].easing }; };   // (a CSS animation's easing is on its keyframes)
    return { n: list.length, sets: [...new Set(sets)], fh: box.style.getPropertyValue('--fh'), heroH: document.querySelector('#top').clientHeight, fall: timing('heroFall'), sway: timing('heroSway'), rock: timing('heroRock') };
  });
  ok('fall: every leaf has its three animations (it falls, it drifts, its drawing tips)', leaves.n > 8 && leaves.sets.length === 1 && leaves.sets[0] === '::before:heroRock + self:heroFall + self:heroSway', JSON.stringify(leaves.sets));
  ok('...the drifting and the tipping go back and forth smoothly (alternate, endless, eased), so a leaf never jumps when they start over', !!leaves.sway && !!leaves.rock && leaves.sway.dir === 'alternate' && leaves.rock.dir === 'alternate' && leaves.sway.iterations === Infinity && leaves.rock.iterations === Infinity && leaves.sway.easing === leaves.rock.easing && leaves.sway.easing !== 'linear', JSON.stringify([leaves.sway, leaves.rock]));
  ok(`...the height a leaf falls through is the hero's own (--fh is ${leaves.fh}, the hero is ${leaves.heroH}px high)`, leaves.fh === leaves.heroH + 'px', leaves.fh);
  // How calm each leaf moves, in numbers (Mrs. Cathy asked for calmer leaves): it falls at 25 to 60 px a second, drifts sideways at no more than 21 px a second (the first leaves drifted at 45 on
  // average, a swing every 3 to 6 s) and a whole swing, there and back, takes 4.5 s or more, it reaches at least 10 px to each side (it is not a straight line) and it tips no faster than 44 degrees
  // a second. Measured on the animations themselves: each is stopped at the start and at the end of one of its own iterations (one drift, or the whole fall), and the distance, or the turn, between the
  // two is divided by the time that takes.
  const calm = await p.evaluate(() => {
    const box = document.querySelector('.particles'), all = document.getAnimations(), out = [];
    for (const leaf of box.querySelectorAll('.leaf')) {
      const get = (name, pseudo) => all.find((x) => x.effect && x.effect.target === leaf && x.animationName === name && (x.effect.pseudoElement || null) === (pseudo || null));
      const fall = get('heroFall'), sway = get('heroSway'), rock = get('heroRock', '::before');
      const seek = (a, f) => { const t = a.effect.getTiming(), dur = a.effect.getComputedTiming().duration, k = Math.ceil(-t.delay / dur) + 2; a.pause(); a.currentTime = t.delay + (k + (f ? 0.999 : 0.001)) * dur; };   // (the time is never negative)
      const x = () => leaf.getBoundingClientRect().left, y = () => leaf.getBoundingClientRect().top, rot = () => parseFloat(getComputedStyle(leaf, '::before').rotate);
      seek(sway, 0); seek(rock, 0); seek(fall, 0); const x0 = x(), r0 = rot(), y0 = y();
      seek(sway, 1); seek(rock, 1); seek(fall, 1); const x1 = x(), r1 = rot(), y1 = y();
      const fd = fall.effect.getComputedTiming().duration / 1000, sd = sway.effect.getComputedTiming().duration / 1000;
      [fall, sway, rock].forEach((a) => a.play());
      out.push({ fall: Math.abs(y1 - y0) / fd, side: Math.abs(x1 - x0) / sd, reach: Math.abs(x1 - x0) / 2, swing: 2 * sd, turn: Math.abs(r1 - r0) / sd });
    }
    return out;
  });
  const most = (k) => Math.max(...calm.map((c) => c[k])), least = (k) => Math.min(...calm.map((c) => c[k])), avg = (k) => calm.reduce((s, c) => s + c[k], 0) / calm.length, f0 = (v) => Math.round(v);
  ok(`...they fall slowly: ${f0(least('fall'))} to ${f0(most('fall'))} px a second (${f0(avg('fall'))} on average; at most 60, and not hanging: at least 25)`, calm.length > 8 && most('fall') <= 60 && least('fall') >= 25, JSON.stringify(calm.map((c) => f0(c.fall))));
  ok(`...they drift sideways gently: at most ${f0(most('side'))} px a second (${f0(avg('side'))} on average; at most 21), a whole swing takes ${(least('swing')).toFixed(1)} s or more (at least 4.5), and each leaf reaches ${f0(least('reach'))} px or more to each side (at least 10: not a straight line)`, most('side') <= 21 && least('swing') >= 4.5 && least('reach') >= 10 && avg('side') >= 8, JSON.stringify(calm.map((c) => [f0(c.side), f0(c.reach), +c.swing.toFixed(1)])));
  ok(`...and tip slowly: at most ${f0(most('turn'))} degrees a second (${f0(avg('turn'))} on average; at most 44)`, most('turn') <= 44 && least('turn') > 5, JSON.stringify(calm.map((c) => f0(c.turn))));
  // a leaf begins its fall above the top edge of the hero (all of it) and ends it below the bottom edge (all of it), whatever the height: looked at part-way through each leaf's own fall
  const edges = await p.evaluate(() => {
    const hero = document.querySelector('#top').getBoundingClientRect(), box = document.querySelector('.particles'), all = document.getAnimations(), out = [];
    for (const leaf of box.querySelectorAll('.leaf')) {
      const a = all.find((x) => x.effect && x.effect.target === leaf && x.animationName === 'heroFall'), delay = a.effect.getTiming().delay, dur = a.effect.getComputedTiming().duration;
      a.pause();
      const at = (f) => { a.currentTime = delay + (2 + f) * dur; const r = leaf.getBoundingClientRect(); return [r.top - hero.top, r.bottom - hero.top]; };   // (the third time round: the time is never negative, and a negative time shows nothing of the animation)
      out.push({ start: at(0.001), mid: at(0.5), end: at(0.999) });
      a.play();
    }
    return { out, h: document.querySelector('#top').clientHeight };
  });
  const badEdges = edges.out.filter((e) => !(e.start[1] < 0 && e.end[0] > edges.h && e.mid[0] > 0 && e.mid[1] < edges.h));
  ok(`...and every leaf falls from above the top edge to below the bottom edge of the hero (${edges.out.length} leaves, hero ${edges.h}px high; ${badEdges.length} do not)`, edges.out.length > 8 && badEdges.length === 0, JSON.stringify(badEdges.slice(0, 2)));
  // the page's own calm mode (a slow computer): the layer fades out, it does not freeze in mid-air; the visitor's own Pause keeps the picture as it is
  for (const level of ['light', 'most']) {
    await p.evaluate((l) => document.documentElement.setAttribute('data-calm', l), level);
    await okSoon(`fall, calm "${level}": the falling leaves fade out (the layer's opacity goes to 0) instead of freezing in mid-air`, () => p.evaluate(() => getComputedStyle(document.querySelector('.particles')).opacity), (v) => v === '0', 6000);
  }
  await p.evaluate(() => document.documentElement.setAttribute('data-calm', 'all'));
  await okSoon('...the visitor\'s own "Pause animations" (data-calm="all") keeps the leaves where they are, in sight', () => p.evaluate(() => getComputedStyle(document.querySelector('.particles')).opacity), (v) => v === '1', 6000);
  // the layer fades by a transition of its own (the base rule, not only the calm rules): it fades OUT when the calm mode comes and IN again when it goes, and js/main.js (initMotion) lets
  // the leaves rest only when it has faded (tests/calm.test.mjs), so that none is ever frozen in mid-air in sight
  const fadeIn = await p.evaluate(() => {
    const box = document.querySelector('.particles'), cs = getComputedStyle(box);
    const own = { property: cs.transitionProperty, duration: cs.transitionDuration };   // (with no data-calm: the base rule)
    document.documentElement.setAttribute('data-calm', 'light'); void cs.opacity;
    const out = box.getAnimations().filter((a) => a.transitionProperty === 'opacity').length;
    box.getAnimations().forEach((a) => { if (a.transitionProperty === 'opacity') a.finish(); });
    document.documentElement.removeAttribute('data-calm'); void cs.opacity;
    const back = box.getAnimations().filter((a) => a.transitionProperty === 'opacity').length;
    return { own, out, back, opacityNow: cs.opacity };
  });
  ok('the layer of leaves has a transition of its own (opacity, .6 s) with no calm mode set', fadeIn.own.property === 'opacity' && fadeIn.own.duration === '0.6s', JSON.stringify(fadeIn.own));
  ok('...it fades out when "light" is set and fades in again when the calm mode is gone (a transition runs both times: it does not jump)', fadeIn.out === 1 && fadeIn.back === 1 && fadeIn.opacityNow === '0', JSON.stringify(fadeIn));
  await okSoon('...and with no calm mode the layer is fully there again', () => p.evaluate(() => getComputedStyle(document.querySelector('.particles')).opacity), (v) => v === '1', 6000);
  // a browser without the single-property transforms (Chrome before 104, Safari before 14.1) cannot move a leaf along its fall (the page does it with `translate`): it must not show them hanging in a row
  // along the top edge, so the layer is hidden there. This browser has the property, so the rule can only be looked at, not seen at work.
  const guard = await p.evaluate(() => {
    const out = [];
    for (const s of document.styleSheets) {
      let rules; try { rules = s.cssRules; } catch (e) { continue; }
      for (const r of rules) if (r.type === CSSRule.SUPPORTS_RULE) out.push({ cond: r.conditionText, inner: [...r.cssRules].map((x) => (x.selectorText || '') + '{' + (x.style ? x.style.display : '') + '}') });
    }
    const snow = [...document.styleSheets].reduce((all, s) => { try { return all.concat([...s.cssRules]); } catch (e) { return all; } }, []).find((r) => r.type === CSSRule.KEYFRAMES_RULE && r.name === 'heroSnow');
    return { rule: out.find((r) => /^not \(translate:\s*0 0\)$/.test(r.cond)) || null, snowUsesFh: !!snow && /var\(--fh/.test(snow.cssText), snowUses108vh: !!snow && /vh/.test(snow.cssText.replace(/var\(--fh,100vh\)/g, '')) };
  });
  ok('the layer is hidden where `translate` is not understood: @supports not (translate:0 0) { .particles { display:none } }', !!guard.rule && guard.rule.inner.length === 1 && guard.rule.inner[0] === '.particles{none}', JSON.stringify(guard.rule));
  ok('the snow, like the leaves, falls through --fh (the hero\'s own height) and not through a part of the window\'s height', guard.snowUsesFh && !guard.snowUses108vh, JSON.stringify(guard));
  // the window changes size: the height the leaves fall through follows it
  const fhNow = () => p.evaluate(() => ({ fh: document.querySelector('.particles').style.getPropertyValue('--fh'), h: document.querySelector('#top').clientHeight }));
  await p.setViewportSize({ width: 1000, height: 700 });
  await okSoon('a smaller window: --fh follows the new height of the hero', fhNow, (v) => v.fh === v.h + 'px' && v.h !== leaves.heroH, 6000);
  await p.setViewportSize({ width: 1440, height: 900 });
  await okSoon('...and back to the big window', fhNow, (v) => v.fh === v.h + 'px' && v.h === leaves.heroH, 6000);
  // The hero's picture can change size with no change of the window (the first drawing, a font that arrives late, the words of a season wrapping differently): --fh follows it, a resize observer
  // on the picture (a window resize alone left it stale: the leaves then stopped short of the bottom edge or fell on for nothing)
  const fhPic = () => p.evaluate(() => ({ fh: document.querySelector('.particles').style.getPropertyValue('--fh'), h: document.querySelector('#critters').clientHeight }));
  await p.evaluate(() => { document.querySelector('#critters').style.height = '500px'; });
  await okSoon('the hero\'s picture made lower with the window as it was: --fh follows it (500px)', fhPic, (v) => v.fh === '500px' && v.h === 500, 6000);
  await p.evaluate(() => { document.querySelector('#critters').style.height = ''; });
  await okSoon('...and back to its own height', fhPic, (v) => v.fh === v.h + 'px' && v.h > 600, 6000);
  ok('fall: wheels spin', (await p.evaluate(() => getComputedStyle(document.querySelector('.wheel.wt1')).animationName)) === 'wheelSpin');

  // ---- the barrel train (spring, summer, fall): six barrels, a kid waving in each (not all in step), the tractor in front, wheels that turn
  const train = await p.evaluate(() => {
    const rig = document.querySelector('#field .rig-barrel');
    if (!rig) return null;
    const waves = [...rig.querySelectorAll('.wave')].map((w) => getComputedStyle(w));
    // the tractor: drawn after every kid (so on top of them) and ahead of every barrel (the train drives to the right)
    const tractor = rig.querySelector('.wheel.wt1'), cx = (e) => { const r = e.getBoundingClientRect(); return r.left + r.width / 2; };
    const kids = [...rig.querySelectorAll('.npc-body')], hits = [...rig.querySelectorAll('.npc-hit[data-npc=barrel]')];
    return { barrels: hits.length, kids: kids.length,
      waving: waves.filter((w) => w.animationName === 'wave').length, delays: new Set(waves.map((w) => w.animationDelay)).size,
      wheels: [...rig.querySelectorAll('.wheel.bt')].filter((w) => getComputedStyle(w).animationName === 'wheelSpin').length,
      tractorInFront: !!tractor && kids.every((k) => k.compareDocumentPosition(tractor) & Node.DOCUMENT_POSITION_FOLLOWING) && hits.every((h) => cx(tractor) > cx(h)) };
  });
  ok('the barrel train has six barrels and six kids, all of them waving, not all in step', !!train && train.barrels === 6 && train.kids === 6 && train.waving === 6 && train.delays >= 5, JSON.stringify(train));
  ok('...twelve barrel wheels turn and the tractor is drawn in front', !!train && train.wheels === 12 && train.tractorInFront, JSON.stringify(train));
  // where the train and the wagon ride are at the very start and the very end of their loops: out of sight both times, so they never pop in or out
  // (the wagon showed at the right edge of a screen 680 to 760 px wide when its loop ended)
  const RIGS = [['barrel train', '#field .rig-barrel'], ['wagon ride', '#field .rig:not(.rig-barrel)']];
  const loopEnds = (q, sel) => q.evaluate((sel) => {
    const rig = document.querySelector(sel), hero = document.getElementById('top').getBoundingClientRect();
    const a = rig.getAnimations().find((x) => x.animationName === 'rigDrive');
    if (!a) return null;
    const dur = a.effect.getComputedTiming().duration, t0 = a.effect.getTiming().delay + dur;   // (a negative delay: the 2nd loop starts at currentTime delay + duration)
    a.pause();
    const at = (t) => { a.currentTime = t0 + t; const r = rig.getBoundingClientRect(); return { left: Math.round(r.left - hero.left), right: Math.round(r.right - hero.left) }; };
    const out = { start: at(0), end: at(dur - 1), width: Math.round(hero.width) };
    a.play();
    return out;
  }, sel);
  for (const [w, h] of [[1366, 768], [1920, 1080], [390, 800], [600, 800], [680, 800], [720, 800], [760, 800], [761, 800]]) {
    const q = await page(w, h);
    const bad = { 'barrel train': [], 'wagon ride': [] };
    for (const s of ['spring', 'summer', 'fall']) {
      await q.evaluate((x) => WISE_ACRES.hero.setSeason(x), s);
      await until(q, (x) => document.documentElement.dataset.season === x && !!document.querySelector('#field .rig-barrel') && !!document.querySelector('#field .rig:not(.rig-barrel)'), s);
      for (const [name, sel] of RIGS) {
        const e = await loopEnds(q, sel);
        if (!e || !(e.start.right < 0 && e.end.left > e.width)) bad[name].push(s + ' ' + JSON.stringify(e));
      }
    }
    for (const [name] of RIGS) ok(`${w} x ${h}: the ${name} starts and ends its loop out of sight`, bad[name].length === 0, bad[name].join(' | '));
    await q.context().close();
  }

  // ---- winter: trees, fires, snow
  await choose(p, 'winter');
  ok('winter: the tomato chip and the bee are hidden', !(await p.locator('.chip-new').isVisible()) && !(await p.locator('.bee').isVisible()));
  ok('winter: clicking a tree lights it', (await clickPick(p)) && (await okSoon('winter: a tree is lit', () => p.locator('#field .tree-pick.lit').count(), (n) => n === 1)));
  ok('winter: bulbs twinkle once lit', (await p.evaluate(() => getComputedStyle(document.querySelector('.tree-pick.lit .bulb')).animationName)) === 'twinkle');
  await p.click('#pick-btn');
  await okSoon('winter: the button lights another tree', () => p.evaluate(() => ({ lit: document.querySelectorAll('#field .tree-pick.lit').length, n: +document.querySelector('#pick-count').textContent })), (v) => v.lit === 2 && v.n === 2);
  await p.evaluate(() => document.querySelector('#field [data-fire]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  ok('winter: tapping a campfire flares it', (await p.locator('#field .campfire.flare').count()) === 1);
  ok('winter: snowflakes', (await p.locator('.particles .flake').count()) > 20);
  await p.evaluate(() => document.documentElement.setAttribute('data-calm', 'light'));
  await okSoon('winter, calm "light": the snow fades out too', () => p.evaluate(() => getComputedStyle(document.querySelector('.particles')).opacity), (v) => v === '0', 6000);
  await p.evaluate(() => document.documentElement.removeAttribute('data-calm'));
  // the snow falls from above the top edge to below the bottom edge of the hero, whatever its height. A window much lower than the hero tells "the hero's own height" (--fh) from "a part of the
  // window's height" (it used to end at 108vh, short of the bottom edge): 1440 x 600, where the hero is about 750px high.
  await p.setViewportSize({ width: 1440, height: 600 });
  await okSoon('winter, a window 600px high: --fh follows the hero (higher than the window)', fhNow, (v) => v.fh === v.h + 'px' && v.h > 600 * 1.08 + 20, 6000);
  const snow = await p.evaluate(() => {
    const hero = document.querySelector('#top').getBoundingClientRect(), box = document.querySelector('.particles'), all = document.getAnimations(), out = [];
    for (const flake of box.querySelectorAll('.flake')) {
      const a = all.find((x) => x.effect && x.effect.target === flake && x.animationName === 'heroSnow'), delay = a.effect.getTiming().delay, dur = a.effect.getComputedTiming().duration;
      a.pause();
      const at = (f) => { a.currentTime = delay + (2 + f) * dur; const r = flake.getBoundingClientRect(); return [r.top - hero.top, r.bottom - hero.top]; };
      out.push({ start: at(0.001), mid: at(0.5), end: at(0.999) });
      a.play();
    }
    return { out, h: document.querySelector('#top').clientHeight };
  });
  const badSnow = snow.out.filter((e) => !(e.start[1] < 0 && e.end[0] > snow.h && e.mid[0] > 0 && e.mid[1] < snow.h));
  ok(`...and every flake falls from above the top edge to below the bottom edge of the hero (${snow.out.length} flakes, hero ${Math.round(snow.h)}px high; ${badSnow.length} do not)`, snow.out.length > 20 && badSnow.length === 0, JSON.stringify(badSnow.slice(0, 2)));
  await p.setViewportSize({ width: 1440, height: 900 });
  ok('winter: flames animate', (await p.evaluate(() => getComputedStyle(document.querySelector('.campfire .f1')).animationName)) === 'flick1');

  // ---- keyboard on the switcher
  await p.focus('#season-switch button[aria-checked=true]');
  await p.keyboard.press('ArrowLeft');
  await okSoon('keyboard: ArrowLeft goes to fall', () => season(p), (v) => v === 'fall');
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight');
  await okSoon('keyboard: ArrowRight wraps round to spring', () => season(p), (v) => v === 'spring');
  ok('roving tabindex: one stop', (await p.locator('#season-switch button[tabindex="0"]').count()) === 1);
  await choose(p, 'summer');
  await okSoon('picking summer shows the summer seasons panel', () => p.evaluate(() => !document.querySelector('.season-panel[data-season="summer"]').hidden), (v) => v);
  await p.context().close();

  // ---- no sideways scrolling, phone to wide screen, every season
  for (const w of [320, 375, 414, 768, 1024, 1440, 1920]) {
    const q = await page(w, w < 500 ? 740 : 900);
    const bad = []; let fh = null;
    for (const s of ['spring', 'summer', 'fall', 'winter']) {
      await q.evaluate((x) => WISE_ACRES.hero.setSeason(x), s);
      await until(q, (x) => document.documentElement.dataset.season === x, s);
      await frames(q);
      const ov = await q.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (ov > 0) bad.push(s + ' ' + ov);
      if (s === 'fall') fh = await q.evaluate(() => ({ fh: (document.querySelector('.particles') || { style: { getPropertyValue: () => '' } }).style.getPropertyValue('--fh'), h: document.querySelector('#top').clientHeight }));
    }
    ok(`${w}px: the leaves fall through the hero's own height (--fh ${fh && fh.fh}, the hero is ${fh && fh.h}px high)`, !!fh && fh.fh === fh.h + 'px', JSON.stringify(fh));
    ok(`${w}px: no horizontal overflow in any season`, bad.length === 0, bad.join(', '));
    const sw = await q.evaluate(() => { const r = document.querySelector('#season-switch').getBoundingClientRect(); return { left: r.left, right: r.right }; });
    ok(`${w}px: the switcher is inside the viewport`, sw.left >= 0 && sw.right <= w + 0.5, JSON.stringify(sw));
    await q.context().close();
  }

  // ---- reduced motion
  const r = await page(1440, 900, { reduced: true });
  await choose(r, 'fall');
  const rest = await r.evaluate(() => { const rg = document.querySelector('#field .rig'), cs = getComputedStyle(rg), bb = rg.getBoundingClientRect(); return { anim: cs.animationName, x: bb.left, w: bb.width }; });
  ok('reduced motion: the tractor is parked in view', rest.anim === 'none' && rest.x > 0 && rest.x + rest.w < 1440, JSON.stringify(rest));
  ok('reduced motion: no particles', (await r.locator('.particles').count()) === 0 || !(await r.locator('.particles').first().isVisible()));
  // nothing may keep moving: no endless animation runs in any season, and no drawing loop is running (the bee is hidden)
  const stillState = () => r.evaluate(() => ({ loops: document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations === Infinity).map((a) => (a.animationName || a.transitionProperty) + ' on ' + (a.effect.target && a.effect.target.className && a.effect.target.className.baseVal !== undefined ? a.effect.target.className.baseVal : a.effect.target.className)), bee: getComputedStyle(document.querySelector('#bee-fly')).display }));
  // (the page's timers of the next 600 ms run first (its clock is a fake one: no real wait), so a loop that would start a moment later is seen too; then the check waits for the old scene's loops to end)
  for (const s of ['spring', 'summer', 'fall', 'winter']) { await choose(r, s); await settled(r, 600); await okSoon(`reduced motion, ${s}: no endless animation is running and the bee is hidden`, stillState, (st) => st.loops.length === 0 && st.bee === 'none'); }
  ok('reduced motion: trees can still be lit', (await clickPick(r)) && (await okSoon('reduced motion: a tree is lit', () => r.locator('#field .tree-pick.lit').count(), (n) => n === 1)));
  // the "+1" that flies up from a pick would end at once, invisible, so it stays where it is for a moment
  ok('reduced motion: the "+1" next to a lit tree stays visible', await okSoon('reduced motion: the +1 shows', () => r.evaluate(() => { const e = document.querySelector('.plus-one'); return e ? getComputedStyle(e).opacity : '0'; }), (v) => v === '1'));
  await r.context().close();

  // ---- seasonPicker: false
  const off = await open(browser, base, 'index.html', errs, { ready: false, routes: async (pg) => { await pg.route('**/js/content.js', (route) => route.fulfill({ contentType: 'text/javascript', body: 'window.WISE_ACRES={seasonPicker:false,photos:[]};' })); } });
  await until(off, () => document.querySelectorAll('#field [data-pick]').length > 10, null, 20000);
  ok('seasonPicker: false hides the switcher', !(await off.locator('#season-switch').isVisible()));
  ok('...and still draws the current season', (await off.locator('#field [data-pick]').count()) > 10);
  await off.context().close();
});
