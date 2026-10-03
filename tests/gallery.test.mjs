/* The photo gallery: the topic buttons above it (Berries, Flowers, Farm animals, Fall, Pizza, People & events), the photo count that is read aloud,
 * photos without tags (shown under All only), mistakes in `tags` in js/content.js (reported in the "Site check" box), and the languages. */
import { run, open, ok, okSoon } from './lib.mjs';

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
});
