// order: 393
// browser: yes
// covers: css/styles.css, css/extras.css, css/features.css, js/main.js, js/features.js, index.html, pages/first-visit.html, first-visit.html
/* Where a link to a place on the same page puts that place: just under the sticky header, on the same line every time (88 px on a computer, 80 px
 * on a phone: the room the header takes plus 16 px, "scroll-padding-top" in css/styles.css). Smooth scrolling is left on, as a visitor has it. Each
 * link is clicked the way a visitor does it (the menu, a button) on a page that has just opened, and the place is measured when the page has
 * stopped moving, on a laptop, a full HD screen, a narrow window and a phone, in English and Spanish, inside a sandboxed frame from another address
 * (the way the claude.ai preview shows the site) and with reduced motion.
 * What it guards against: the boxes that fade in as they come up the screen (".reveal") start 26 px lower. The browser works out where to scroll
 * when the link is clicked, and a box that is still hidden is drawn 26 px lower at that moment. So "On the Farm", the pizza schedule and the
 * "Fall & holidays" and "Farm visit" groups of the Shop ended 26 px too high, the top of the box under the header, once the box had slid up. The
 * heights of everything above them did not change (css/styles.css, .reveal). Also a link to a place inside such a box (the Drive time box).
 * The First visit page (first-visit.html): the cards with an id (Parking, Bathrooms, Dogs, Strollers & wheelchairs) had a scroll margin of their own
 * on top of the page's, and their links ended 88 px lower than every other link (css/extras.css, .fact-card[id]). */
import { run, open, ok, settled, ms } from './lib.mjs';

const sleep = (n) => new Promise((r) => setTimeout(r, n));
const TOL = 4;                       // px: how far from the usual line counts as the same place
const OWN_MARGIN = ['drive-form', 'follow-signup'];   // the only places with a scroll margin of their own (css/features.css): their line is the usual one plus that margin. Any other place must end on the usual line
const SIZES = [['laptop 1366x768', 1366, 768], ['full HD 1920x1080', 1920, 1080], ['narrow window 1100x700', 1100, 700], ['phone 390x844', 390, 844]];

await run('anchor-landing', async ({ browser, base, errs }) => {
  // framed: the site inside <iframe sandbox>, like the claude.ai preview (a sandboxed frame has no address of its own, "null", so it counts as another site)
  const start = async ({ page = 'index.html', framed = false, width, height, lang, reduced = false, time, extra, asIs = false }) => {
    const src = page + (lang ? '?lang=' + lang : '');
    const routes = framed ? (p) => p.route('**/anchor-landing-frame.html', (r) => r.fulfill({ contentType: 'text/html',
      body: `<!doctype html><html><body style="margin:0"><iframe sandbox="allow-scripts allow-popups allow-forms" src="${src}" style="display:block;width:100vw;height:100vh;border:0"></iframe></body></html>` })) : null;
    const p = await open(browser, base, framed ? 'anchor-landing-frame.html' : page, errs, { viewport: { width, height }, routes, ready: !framed && !asIs, lang: framed ? undefined : lang, reducedMotion: reduced ? 'reduce' : undefined, time, extra });
    let f = framed ? null : p.mainFrame();
    for (let i = 0; !f && i < 100; i++) { f = p.frames().find((x) => x !== p.mainFrame() && /index\.html|first-visit\.html/.test(x.url())) || null; if (!f) await sleep(100); }
    if (f && framed) await f.waitForFunction(() => !!(window.WISE_ACRES && window.WISE_ACRES.features) && document.readyState === 'complete', null, { timeout: ms(30000) }).catch(() => {});
    return { p, f };
  };
  // the page has stopped gliding (scrollY the same for half a second) and nothing is still sliding or fading into place
  const rest = async (f, from) => {
    for (const end = Date.now() + ms(3000); from !== undefined && Date.now() < end && (await f.evaluate(() => Math.round(scrollY))) === from; await sleep(50));   // the glide has started
    let last = null, same = 0;
    for (const end = Date.now() + ms(20000); same < 5 && Date.now() < end; await sleep(100)) { const y = await f.evaluate(() => Math.round(scrollY)); same = y === last ? same + 1 : 0; last = y; }
    await settled({ evaluate: (fn, arg) => f.evaluate(fn, arg) }, 0);
  };
  const look = (f, id) => f.evaluate((id) => {
    const t = document.getElementById(id), r = t.getBoundingClientRect();
    return {
      top: Math.round(r.top * 10) / 10,
      header: Math.round(document.getElementById('site-header').getBoundingClientRect().bottom * 10) / 10,
      pad: parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop),   // the room the page keeps free under the header
      margin: parseFloat(getComputedStyle(t).scrollMarginTop),
      hash: location.hash, y: Math.round(scrollY), max: document.documentElement.scrollHeight - innerHeight,
    };
  }, id);
  // click a link (opening the phone menu first when the links are behind the menu button) and say where the page was
  const click = async (f, sel) => {
    if (sel.startsWith('.nav ') && await f.evaluate(() => getComputedStyle(document.getElementById('menu-toggle')).display !== 'none')) {
      await f.click('#menu-toggle');
      await f.waitForFunction(() => { const n = document.getElementById('nav'); return n.classList.contains('is-open') && getComputedStyle(n).opacity === '1'; }, null, { timeout: ms(5000) }).catch(() => {});
    }
    const from = await f.evaluate(() => Math.round(scrollY));
    await f.click(sel);
    return from;
  };
  // wait for the page to stop, then check where the place is
  const check = async (f, tag, what, id, from) => {
    await rest(f, from);
    const s = await look(f, id);
    const line = s.pad + (OWN_MARGIN.includes(id) ? s.margin : 0);
    const atEnd = s.y >= s.max - 1;   // the page cannot scroll further: a place near its end cannot reach the line
    return ok(`${tag}: ${what} puts #${id} on the usual line under the header`, (Math.abs(s.top - line) <= TOL || (atEnd && s.top > line)) && s.top >= s.header - 1,
      `#${id} starts ${s.top}px from the top of the window, the line is ${line}px, the header ends at ${s.header}px, the address ends in ${s.hash || '(nothing)'}`);
  };
  // one try on a fresh page; a click that cannot be made is one failed check, not the end of the test
  const attempt = async (tag, opts, name, body) => {
    const { p, f } = await start(opts);
    try {
      if (!f) ok(`${tag}: the site opens (for ${name})`, false, 'the page did not open');
      else await body(f, p);
    } catch (e) { ok(`${tag}: ${name}`, false, String(e.message).split('\n')[0]); }
    await p.context().close();
  };

  // the way there: a link from the menu, a button on the first screen, or a button of the Shop (reached through the menu first, so the groups below it were never on the screen)
  const CASES = [
    { id: 'farm', what: '"On the Farm" in the menu', link: '.nav ul > li > a[href="#farm"]' },
    { id: 'schedule', what: 'the "Pizza reservations" button', link: '.chip-rel a[href="#schedule"]' },
    { id: 'shop-pumpkins', what: 'the "Fall & holidays" button of the Shop', via: '.nav ul > li > a[href="#shop"]', link: '.shop-jump a[href="#shop-pumpkins"]' },
    { id: 'shop-farm', what: 'the "Farm visit" button of the Shop', via: '.nav ul > li > a[href="#shop"]', link: '.shop-jump a[href="#shop-farm"]' },
  ];
  const MENU = ['seasons', 'tomatoes', 'pizza', 'greenhouse', 'shop'];   // plain sections, for comparison: they were always right
  const home = async (tag, opts, only) => {
    for (const c of CASES.filter((x) => !only || only.includes(x.id))) {
      await attempt(tag, opts, '#' + c.id, async (f) => {
        if (c.via) await rest(f, await click(f, c.via));
        await check(f, tag, c.what, c.id, await click(f, c.link));
        if (c.id === 'farm') for (const id of MENU) await check(f, tag, `"${id}" in the menu, going down,`, id, await click(f, `.nav ul > li > a[href="#${id}"]`));
      });
    }
  };

  // 1. the four sizes, English; then Spanish (longer words) on the laptop and the phone
  for (const [name, width, height] of SIZES) await home(name, { width, height });
  for (const [name, width, height] of [SIZES[0], SIZES[3]]) await home(name + ' in Spanish', { width, height, lang: 'es' });

  // 2. inside a sandboxed frame from another address, the way the claude.ai preview shows the site (the phone with two of the four places)
  await home('in a preview frame, ' + SIZES[0][0], { width: 1366, height: 768, framed: true });
  await home('in a preview frame, ' + SIZES[3][0], { width: 390, height: 844, framed: true }, ['farm', 'shop-farm']);

  // 3. reduced motion: no glide, the page jumps, and the box still has to come to the same place
  await home('reduced motion, ' + SIZES[0][0], { width: 1366, height: 768, reduced: true }, ['farm', 'shop-farm']);

  // 4. a page opened at a place (a link from another page, a QR code): the place is put in view again once the page has loaded
  for (const [name, width, height, ids] of [[SIZES[0][0], 1366, 768, ['menu', 'options', 'shop-farm']], [SIZES[3][0], 390, 844, ['farm', 'varieties']]]) {
    for (const id of ids) {
      await attempt(name, { page: 'index.html#' + id, width, height, asIs: true }, 'index.html#' + id, async (f) => {
        // The page puts the place back in view 0.3 s and 1.5 s after it has loaded (js/features.js, keepHashTarget), while the boxes slide in: let it do both, in real time
        const t0 = await f.evaluate(() => performance.now());   // (the page has loaded: the page clock runs in real time)
        await f.waitForFunction((t0) => !!(window.WISE_ACRES && window.WISE_ACRES.features) && performance.now() > t0 + 1800, t0, { timeout: ms(30000) });
        await check(f, name, `opening the page at #${id}`, id);
      });
    }
  }

  // 5. a place inside a fading box: the Drive time box (a button on the first screen, the box is at the end of the page) and the signup block ("Tell me when" in winter, with the signup preview on)
  for (const [name, width, height] of [SIZES[0], SIZES[3]]) {
    await attempt(name, { width, height }, '#drive-form', async (f) => check(f, name, 'a "Drive time" button', 'drive-form', await click(f, '#visit a[data-drive-link]:visible')));
    await attempt(name + ' in winter', { width, height, time: '2026-12-15T12:00:00-05:00', extra: 'WISE_ACRES.signup.demo = true;' }, '#follow-signup',
      async (f) => check(f, name + ' in winter', 'a "Tell me when" button', 'follow-signup', await click(f, 'a[data-signup-link]:visible')));
  }

  // 6. the First visit page: the four cards of "Good to know" (Parking, Bathrooms, Dogs, Strollers & wheelchairs) end on the same line as every other place
  const CARDS = ['parking', 'bathrooms', 'dogs', 'strollers'];
  const card = (f, tag, id, from) => check(f, tag, `"${id}" in Good to know`, id, from);
  for (const [name, width, height] of SIZES) {
    await attempt(name + ', First visit page', { page: 'first-visit.html', width, height }, 'the quick links', async (f) => {
      for (const id of CARDS) await card(f, name + ', First visit page', id, await click(f, `.quick-links a[href="#${id}"]`));
    });
  }
  await attempt('phone 390x844 in Spanish, First visit page', { page: 'first-visit.html', width: 390, height: 844, lang: 'es' }, 'the quick links', async (f) => {
    for (const id of CARDS) await card(f, 'phone 390x844 in Spanish, First visit page', id, await click(f, `.quick-links a[href="#${id}"]`));
  });
  await attempt('in a preview frame, phone 390x844, First visit page', { page: 'first-visit.html', width: 390, height: 844, framed: true }, 'the quick links', async (f) => {
    for (const id of CARDS) await card(f, 'in a preview frame, phone 390x844, First visit page', id, await click(f, `.quick-links a[href="#${id}"]`));
  });
  // ...also a link from another page (the home page's questions send people to first-visit.html#parking, #strollers and #checklist) and the Drive time box of this page (a margin of its own, on purpose)
  for (const [name, width, height, ids] of [[SIZES[0][0], 1366, 768, ['parking', 'checklist']], [SIZES[3][0], 390, 844, ['strollers']]]) {
    for (const id of ids) {
      await attempt(name + ', First visit page', { page: 'first-visit.html#' + id, width, height, asIs: true }, 'first-visit.html#' + id, async (f) => {
        const t0 = await f.evaluate(() => performance.now());
        await f.waitForFunction((t0) => !!(window.WISE_ACRES && window.WISE_ACRES.features) && performance.now() > t0 + 1800, t0, { timeout: ms(30000) });
        await check(f, name + ', First visit page', `opening the page at #${id}`, id);
      });
    }
  }
  await attempt(SIZES[0][0] + ', First visit page', { page: 'first-visit.html', width: 1366, height: 768 }, '#drive-form', async (f) => check(f, SIZES[0][0] + ', First visit page', 'the "Drive time" button', 'drive-form', await click(f, 'a[data-drive-link]:visible')));

  // In a sandboxed frame the browser refuses the site's fonts (they are sent without a CORS header and the frame's address is "null"), so the
  // text shows in the stand-in fonts. That is the frame, not the site: only those messages are left out of the page errors.
  for (let i = errs.length - 1; i >= 0; i--) if (/^anchor-landing-frame\.html console: Access to font at .* blocked by CORS policy/.test(errs[i])) errs.splice(i, 1);
});
