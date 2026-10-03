/* The photo gallery: the topic buttons above it (Berries, Flowers, Farm animals, Fall, Pizza, People & events), the photo count that is read aloud,
 * photos without tags (shown under All only), mistakes in `tags` in js/content.js (reported in the "Site check" box), and the languages. And the photo
 * viewer: Previous / Next buttons, Left / Right arrow keys, "3 of 30", going round, only the photos a topic button shows, focus, Escape, motion, axe. */
import { run, open, ok, okSoon, until, axeSource, info } from './lib.mjs';

const state = (p) => p.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('#gallery-filters [data-gtag]'));
  const items = Array.from(document.querySelectorAll('#gallery-grid > li'));
  return {
    filtersShown: !document.getElementById('gallery-filters').hidden,
    buttons: btns.filter((b) => !b.hidden).map((b) => ({ tag: b.dataset.gtag, text: b.textContent.trim(), pressed: b.getAttribute('aria-pressed') })),
    total: items.length, shown: items.filter((li) => !li.hidden).length,
    count: (document.getElementById('gallery-count') || {}).textContent || '', countShown: !document.getElementById('gallery-count').hidden,
    focus: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.gtag || '' : '',
  };
});
const box = (p) => p.evaluate(() => { const b = document.getElementById('wa-problems'); return b ? b.textContent : ''; });

await run('gallery', async ({ browser, base, errs }) => {
  let p = await open(browser, base, 'index.html', errs);
  await p.evaluate(() => document.getElementById('gallery').scrollIntoView());
  let s = await state(p);
  ok('the gallery has photos', s.total > 5, String(s.total));
  ok('topic buttons are shown when some photos have tags, "All" is pressed to start and every photo is shown', s.filtersShown && s.buttons.length >= 3 && s.buttons[0].tag === 'all' && s.buttons[0].pressed === 'true' && s.shown === s.total, JSON.stringify(s));
  ok('only buttons with a photo behind them are shown, and they are all unpressed except All', s.buttons.slice(1).every((b) => b.pressed === 'false'), JSON.stringify(s.buttons));
  ok('the count is shown (read aloud with the name of the group)', s.countShown && new RegExp('^All: ' + s.total + ' photos$').test(s.count), s.count);

  // press a topic
  const topic = s.buttons[1];
  const want = await p.evaluate((tag) => { const t = (x) => String(x).trim().toLowerCase(); return (window.WISE_ACRES.photos || []).filter((ph) => Array.isArray(ph.tags) && ph.tags.map(t).includes(tag)).length; }, topic.tag);
  await p.click(`#gallery-filters [data-gtag="${topic.tag}"]`);
  await okSoon(`pressing "${topic.text}" shows only its photos (${want}) and says how many`, () => state(p), (v) => v.shown === want && v.shown < v.total && v.buttons.find((b) => b.tag === topic.tag).pressed === 'true' && v.buttons[0].pressed === 'false' && v.count === `${topic.text}: ${want === 1 ? '1 photo' : want + ' photos'}`);
  s = await state(p);
  ok('the photos are only hidden, not redrawn: the pressed button keeps the keyboard focus and the buttons do not move', s.focus === topic.tag && s.total > 0, JSON.stringify({ focus: s.focus }));
  await p.click('#gallery-filters [data-gtag="all"]');
  await okSoon('"All" brings every photo back', () => state(p), (v) => v.shown === v.total && v.buttons[0].pressed === 'true');
  // the keyboard works too (they are real buttons)
  await p.focus(`#gallery-filters [data-gtag="${topic.tag}"]`);
  await p.keyboard.press('Space');
  await okSoon('a topic can be chosen with the keyboard', () => state(p), (v) => v.shown === want);
  await p.context().close();

  // photos without tags are shown under All only; with no tags at all there are no buttons
  p = await open(browser, base, 'index.html', errs, { extra: 'WISE_ACRES.photos.forEach((ph) => { delete ph.tags; });' });
  s = await state(p);
  ok('no photo has a tag: no topic buttons and no count, every photo is shown', !s.filtersShown && !s.countShown && s.shown === s.total && s.total > 0, JSON.stringify({ f: s.filtersShown, c: s.countShown }));
  await p.context().close();
  p = await open(browser, base, 'index.html', errs, { extra: 'WISE_ACRES.photos.forEach((ph, i) => { if (i > 0) delete ph.tags; }); WISE_ACRES.photos[0].tags = ["pizza"];' });
  s = await state(p);
  ok('one tagged photo: only its button (and All) are shown; the untagged photos are under All only', s.filtersShown && s.buttons.length === 2 && s.buttons[1].tag === 'pizza', JSON.stringify(s.buttons));
  await p.click('#gallery-filters [data-gtag="pizza"]');
  await okSoon('...pressing it shows just that photo', () => state(p), (v) => v.shown === 1 && /: 1 photo$/.test(v.count));
  await p.context().close();

  // mistakes in js/content.js are reported, never break the gallery
  p = await open(browser, base, 'index.html', errs, { extra: 'WISE_ACRES.photos[0].tags = ["berries", "kittens"]; WISE_ACRES.photos[1].tags = "flowers";' });
  const b = await box(p);
  ok('a tag that has no button is reported with the tags that work', /has the tag "kittens", but the gallery has no button for it/.test(b) && /berries, flowers, animals, fall, pizza, people/.test(b), b.slice(0, 300));
  ok('tags that are not a list are reported (the photo stays under All)', /tags must be a list/.test(b), b.slice(0, 300));
  s = await state(p);
  ok('...and the gallery still works', s.total > 5 && s.shown === s.total);
  await p.context().close();

  // other languages: the buttons and the count are in the visitor's language; the count is drawn again when the language changes
  for (const lang of ['es', 'hi', 'zh', 'vi']) {
    p = await open(browser, base, 'index.html', errs, { lang });
    s = await state(p);
    ok(`${lang}: the topic buttons are translated and the count has no {placeholder}`, s.buttons.length >= 3 && s.buttons.every((x) => x.text !== 'All' && x.text !== 'Berries' && x.text !== 'Flowers' && x.text !== 'Farm animals') && !/[{}]|photos?$/.test(s.count) && s.count.length > 0, JSON.stringify({ b: s.buttons.map((x) => x.text), c: s.count }));
    await p.context().close();
  }
  p = await open(browser, base, 'index.html', errs, { lang: 'es' });
  await p.evaluate(() => document.querySelector('button[data-lang="en"]').click());
  await okSoon('switching language to English changes the buttons and the count at once', () => state(p), (v) => v.buttons[0] && v.buttons[0].text === 'All' && /^All: \d+ photos$/.test(v.count));
  await p.context().close();

  /* ---------------------------------------------------------- the photo viewer */
  const POOL = 'const P = WISE_ACRES.photos; const n = P.length; while (P.length < 30) P.push(Object.assign({}, P[P.length % n])); P.length = 30;';   // exactly 30 photos, whatever the farm has listed
  const view = (pg) => pg.evaluate(() => {
    const d = document.getElementById('lightbox'), r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, vis: b.width > 0 }; };
    const c = d.querySelector('.lightbox-count');
    return { open: d.open, count: c && c.firstChild ? c.firstChild.textContent : '', countHidden: c ? c.hidden : true, live: c ? c.getAttribute('aria-live') : null, role: c ? c.getAttribute('role') : null,
      src: d.querySelector('img').getAttribute('src'), alt: d.querySelector('img').alt, cap: document.getElementById('lightbox-cap').textContent,
      prev: r(d.querySelector('.lightbox-prev')), next: r(d.querySelector('.lightbox-next')), img: r(d.querySelector('img')), capBox: r(document.getElementById('lightbox-cap')),
      prevLabel: (d.querySelector('.lightbox-prev') || {}).ariaLabel || '', nextLabel: (d.querySelector('.lightbox-next') || {}).ariaLabel || '',
      focusIn: d.contains(document.activeElement), focusOn: document.activeElement ? document.activeElement.tagName + '.' + document.activeElement.className : '' };
  });
  const hit = (a, b) => a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const thumb = (pg, i) => pg.locator('#gallery-grid li:not([hidden]) button').nth(i);
  let v;

  for (const [label, vp] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    p = await open(browser, base, 'index.html', errs, { viewport: vp, extra: POOL });
    await p.evaluate(() => document.getElementById('gallery').scrollIntoView());
    const photos = await p.evaluate(() => WISE_ACRES.photos.map((x) => x.src));
    await thumb(p, 2).click();
    v = await view(p);
    ok(`viewer (${label}): opens on the photo that was chosen and says "3 of 30" visibly`, v.open && v.count === '3 of 30' && !v.countHidden && v.src === photos[2], JSON.stringify({ c: v.count, s: v.src }));
    ok(`viewer (${label}): the count is a polite live region, so a screen reader says it when the photo changes`, v.live === 'polite' && v.role === 'status');
    ok(`viewer (${label}): Previous and Next are 44x44 or bigger, in view, and cover neither the photo nor its caption`, v.prev.w >= 44 && v.prev.h >= 44 && v.next.w >= 44 && v.next.h >= 44 && !hit(v.prev, v.img) && !hit(v.next, v.img) && !hit(v.prev, v.capBox) && !hit(v.next, v.capBox) && v.prev.x >= 0 && v.next.x + v.next.w <= vp.width, JSON.stringify({ prev: v.prev, next: v.next }));
    ok(`viewer (${label}): the buttons have names (Previous photo, Next photo)`, v.prevLabel === 'Previous photo' && v.nextLabel === 'Next photo', v.prevLabel + ' / ' + v.nextLabel);
    await p.keyboard.press('ArrowRight');
    v = await view(p);
    ok(`viewer (${label}): the Right arrow key shows the next photo (4 of 30) with its own description`, v.count === '4 of 30' && v.src === photos[3] && v.alt.length > 3, JSON.stringify({ c: v.count, a: v.alt }));
    await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft');
    v = await view(p);
    ok(`viewer (${label}): the Left arrow key goes back (2 of 30)`, v.count === '2 of 30' && v.src === photos[1], v.count);
    await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft');
    v = await view(p);
    ok(`viewer (${label}): going back from the first photo wraps to the last (30 of 30)`, v.count === '30 of 30' && v.src === photos[29], v.count);
    await p.keyboard.press('ArrowRight');
    v = await view(p);
    ok(`viewer (${label}): going forward from the last photo wraps to the first (1 of 30)`, v.count === '1 of 30' && v.src === photos[0], v.count);
    await p.locator('#lightbox .lightbox-next').click();
    await p.locator('#lightbox .lightbox-next').click();
    v = await view(p);
    ok(`viewer (${label}): the Next button works like the arrow key (one click, one photo)`, v.count === '3 of 30' && v.src === photos[2], v.count);
    await p.locator('#lightbox .lightbox-prev').click();
    ok(`viewer (${label}): the Previous button too`, (await view(p)).count === '2 of 30');
    let stays = true; const seen = [];
    for (let i = 0; i < 8; i++) { await p.keyboard.press('Tab'); const f = await view(p); seen.push(f.focusOn); if (!f.focusIn) stays = false; }
    await p.keyboard.press('Shift+Tab');
    ok(`viewer (${label}): Tab and Shift+Tab stay inside the viewer (close, Previous, Next)`, stays && (await view(p)).focusIn, seen.join(' | '));
    await p.keyboard.press('Escape');
    await until(p, () => !document.getElementById('lightbox').open);
    const back = await p.evaluate(() => { const a = document.activeElement; return { onThumb: !!a.closest && !!a.closest('#gallery-grid') && a.tagName === 'BUTTON', idx: [...document.querySelectorAll('#gallery-grid li')].indexOf(a.closest('li')) }; });
    ok(`viewer (${label}): Escape closes it and the focus goes back to the photo that opened it (the 3rd)`, back.onThumb && back.idx === 2, JSON.stringify(back));
    await p.context().close();
  }

  // only the photos the topic button shows, in page order
  p = await open(browser, base, 'index.html', errs, { extra: POOL });
  await p.evaluate(() => document.getElementById('gallery').scrollIntoView());
  const topicBtn = (await state(p)).buttons[1];
  await p.click(`#gallery-filters [data-gtag="${topicBtn.tag}"]`);
  const shownSrc = await p.evaluate(() => [...document.querySelectorAll('#gallery-grid > li:not([hidden]) img')].map((i) => i.getAttribute('src')));
  ok(`viewer, "${topicBtn.text}" pressed: ${shownSrc.length} of 30 photos are shown`, shownSrc.length > 1 && shownSrc.length < 30, String(shownSrc.length));
  await thumb(p, 1).click();
  v = await view(p);
  ok(`viewer, "${topicBtn.text}" pressed: the count is out of the photos shown ("2 of ${shownSrc.length}")`, v.count === `2 of ${shownSrc.length}`, v.count);
  const tour = [];
  for (let i = 0; i < shownSrc.length; i++) { tour.push((await view(p)).src); await p.keyboard.press('ArrowRight'); }
  const rotated = shownSrc.slice(1).concat(shownSrc.slice(0, 1));
  ok(`viewer, "${topicBtn.text}" pressed: Next visits only those photos, in page order, and comes back to the start`, JSON.stringify(tour) === JSON.stringify(rotated) && (await view(p)).count === `2 of ${shownSrc.length}`, tour.length + ' photos');
  await p.keyboard.press('Escape');
  await p.click('#gallery-filters [data-gtag="all"]');
  await thumb(p, 0).click();
  ok('viewer, "All" pressed again: back to 30 photos', (await view(p)).count === '1 of 30');
  await p.context().close();

  // one photo shown: nothing to go to
  p = await open(browser, base, 'index.html', errs, { extra: 'WISE_ACRES.photos.forEach((ph, i) => { if (i > 0) delete ph.tags; }); WISE_ACRES.photos[0].tags = ["pizza"];' });
  await p.evaluate(() => document.getElementById('gallery').scrollIntoView());
  await p.click('#gallery-filters [data-gtag="pizza"]');
  await thumb(p, 0).click();
  v = await view(p);
  ok('viewer with one photo shown: no Previous, Next or count (there is nothing to go to)', v.open && !v.prev.vis && !v.next.vis && v.countHidden, JSON.stringify({ p: v.prev, c: v.countHidden }));
  await p.keyboard.press('ArrowRight');
  ok('...and the arrow key keeps the same photo', (await view(p)).src === v.src);
  await p.context().close();

  // a photo marked data-zoom (not from the gallery) opens alone
  p = await open(browser, base, 'index.html', errs);
  await p.locator('.photo-strip img[data-zoom]:visible').first().scrollIntoViewIfNeeded();
  await p.locator('.photo-strip img[data-zoom]:visible').first().click();
  v = await view(p);
  ok('a single photo from the page (not the gallery) opens alone: no Previous, Next or count', v.open && !v.prev.vis && !v.next.vis && v.countHidden, JSON.stringify({ p: v.prev, n: v.next }));
  await p.keyboard.press('Escape');
  ok('...and Escape closes it and the focus goes back to that photo', await p.evaluate(() => document.activeElement.hasAttribute('data-zoom')));
  await p.context().close();

  // the dark area closes it; the gaps inside the box do not
  p = await open(browser, base, 'index.html', errs, { viewport: { width: 1280, height: 900 }, extra: POOL });
  await p.evaluate(() => document.getElementById('gallery').scrollIntoView());
  await thumb(p, 4).click();
  const box4 = await p.evaluate(() => { const r = document.getElementById('lightbox').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await p.mouse.click(box4.x + 5, box4.y + box4.h / 2);
  ok('a click on the edge of the box (between its buttons and photo) does not close the viewer', (await view(p)).open);
  await p.mouse.click(box4.x - 12, box4.y + box4.h / 2);
  await until(p, () => !document.getElementById('lightbox').open);
  ok('a click on the dark area outside the box closes it', !(await view(p)).open);
  await p.context().close();

  // motion: a short fade in normal mode, nothing at all when the visitor asked for less motion; never a slide
  for (const reduced of [false, true]) {
    p = await open(browser, base, 'index.html', errs, { extra: POOL, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await p.evaluate(() => document.getElementById('gallery').scrollIntoView());
    await thumb(p, 0).click();
    await p.keyboard.press('ArrowRight');
    const m = await p.evaluate(() => document.querySelector('#lightbox img').getAnimations().map((x) => ({ name: x.animationName, ms: x.effect.getTiming().duration, props: [...new Set(x.effect.getKeyframes().flatMap((k) => Object.keys(k)).filter((k) => !['offset', 'easing', 'composite', 'computedOffset'].includes(k)))] })));
    if (reduced) ok('reduced motion: changing the photo plays no animation at all', m.length === 0, JSON.stringify(m));
    else ok('normal motion: changing the photo plays one short fade (opacity only, 250 ms or less), no slide', m.length === 1 && m[0].props.join() === 'opacity' && m[0].ms <= 250, JSON.stringify(m));
    await p.context().close();
  }

  // the viewer in the other languages: button names and the count are in the visitor's language
  const WANT = { es: ['Foto anterior', 'Foto siguiente', '3 de 30', '4 de 30'], hi: ['पिछली फ़ोटो', 'अगली फ़ोटो', '30 में से 3', '30 में से 4'], zh: ['上一张照片', '下一张照片', '第 3 张，共 30 张', '第 4 张，共 30 张'], vi: ['Ảnh trước', 'Ảnh tiếp theo', '3 trên 30', '4 trên 30'] };
  for (const lang of ['es', 'hi', 'zh', 'vi']) {
    p = await open(browser, base, 'index.html', errs, { lang, extra: POOL });
    await p.evaluate(() => document.getElementById('gallery').scrollIntoView());
    await thumb(p, 2).click();
    v = await view(p);
    ok(`${lang}: the viewer's buttons and count are translated ("${WANT[lang][2]}") and have no {placeholder}`, v.prevLabel === WANT[lang][0] && v.nextLabel === WANT[lang][1] && v.count === WANT[lang][2] && !/[{}]/.test(v.count + v.prevLabel), JSON.stringify({ a: v.prevLabel, b: v.nextLabel, c: v.count }));
    await p.keyboard.press('ArrowRight');
    const c4 = (await view(p)).count;
    ok(`${lang}: the count follows the photo (${WANT[lang][3]})`, c4 === WANT[lang][3], c4);
    await p.context().close();
  }

  // axe on the open viewer
  const axe = axeSource();
  if (!axe) info('SKIP the accessibility check of the open viewer: axe-core is not installed (npm i -D axe-core)');
  else for (const [label, vp, lang] of [['desktop', { width: 1280, height: 900 }, 'en'], ['phone', { width: 390, height: 844 }, 'es']]) {
    p = await open(browser, base, 'index.html', errs, { viewport: vp, lang, extra: POOL });
    await p.addStyleTag({ content: '.reveal{opacity:1!important;transform:none!important}*{animation:none!important;transition:none!important}' });
    await p.evaluate(() => document.getElementById('gallery').scrollIntoView());
    await thumb(p, 2).click();
    await p.keyboard.press('ArrowRight');
    await p.evaluate(axe);
    const res = await p.evaluate(async () => (await window.axe.run(document.getElementById('lightbox'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] } })).violations.map((x) => x.id + ' [' + x.impact + '] ' + x.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' ; ')));
    ok(`axe: the open photo viewer (${label}, ${lang}) has no violations`, res.length === 0, res.join(' | '));
    await p.context().close();
  }
});
