// order: 392
// browser: yes
// covers: js/main.js, css/styles.css, css/sections.css, css/extras.css, index.html
/* The top menu: Seasons, Tomatoes, Pizza, GreenHouse and Shop each take you to their own section, and the link of the section you are
 * reading is the one that lights up (yellow). Checked on the page itself and inside a sandboxed frame from another address, the way the
 * claude.ai preview shows the site (there the browser used to ignore the "middle of the screen" setting of the highlight, so after Pizza
 * the Tomatoes link lit up, because the end of the Tomatoes section sits under the header). Smooth scrolling is left on, as a visitor has it:
 * the mistake only shows when the page glides up to a section. Also: every language, short and tall windows, the phone menu and the menu of a
 * narrow window (or a zoomed-in one), and that the 44px tap area of one link never covers part of its neighbour. */
import { run, open, ok, ms } from './lib.mjs';

const sleep = (n) => new Promise((r) => setTimeout(r, n));
const NAMES = { seasons: 'Seasons', tomatoes: 'Tomatoes', pizza: 'Pizza', greenhouse: 'GreenHouse', shop: 'Shop' };

await run('nav-highlight', async ({ browser, base, errs }) => {
  // framed: the site inside <iframe sandbox>, like the claude.ai preview (a sandboxed frame has no address of its own, "null", so it counts as another site)
  const start = async ({ framed, width, height, lang }) => {
    const src = 'index.html' + (lang ? '?lang=' + lang : '');
    const routes = framed ? (p) => p.route('**/nav-highlight-frame.html', (r) => r.fulfill({ contentType: 'text/html',
      body: `<!doctype html><html><body style="margin:0"><iframe sandbox="allow-scripts allow-popups allow-forms" src="${src}" style="display:block;width:100vw;height:100vh;border:0"></iframe></body></html>` })) : null;
    const p = await open(browser, base, framed ? 'nav-highlight-frame.html' : 'index.html', errs, { viewport: { width, height }, routes, ready: !framed, lang: framed ? undefined : lang });
    let f = framed ? null : p.mainFrame();
    for (let i = 0; !f && i < 100; i++) { f = p.frames().find((x) => /index\.html/.test(x.url())) || null; if (!f) await sleep(100); }
    if (!f) return { p, f: null };
    await f.waitForFunction(() => !!(window.WISE_ACRES && window.WISE_ACRES.features) && document.readyState === 'complete', null, { timeout: ms(30000) }).catch(() => {});
    return { p, f };
  };
  // the page has stopped gliding (scrollY the same for half a second), and two frames have been drawn so the highlight has caught up
  const rest = async (f) => {
    let last = null, same = 0;
    for (const end = Date.now() + ms(20000); same < 5 && Date.now() < end; await sleep(100)) { const y = await f.evaluate(() => Math.round(scrollY)); same = y === last ? same + 1 : 0; last = y; }
    await f.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  };
  const look = (f, id) => f.evaluate((id) => {
    const a = document.querySelector(`.nav ul > li > a[href="#${id}"]`), r = a.getBoundingClientRect();
    const under = r.width ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;   // for a failure: what a click on the link reaches now
    return {
      top: Math.round(document.getElementById(id).getBoundingClientRect().top),
      header: Math.round(document.getElementById('site-header').getBoundingClientRect().bottom),
      lit: [...document.querySelectorAll('.nav a[aria-current]')].map((x) => x.getAttribute('href').slice(1)),
      hash: location.hash,
      under: !r.width ? 'the link is folded away' : under && under.closest('a') === a ? 'the link' : under ? under.tagName.toLowerCase() + (under.id ? '#' + under.id : '') + (under.className && typeof under.className === 'string' ? '.' + under.className.trim().split(/\s+/).join('.') : '') : 'nothing',
    };
  }, id);
  // click one menu link (opening the phone menu first when the links are behind the menu button) and check where you land and what lights up
  const go = async (f, tag, id, why) => {
    if (await f.evaluate(() => getComputedStyle(document.getElementById('menu-toggle')).display !== 'none')) {
      await f.click('#menu-toggle');
      await f.waitForFunction(() => { const n = document.getElementById('nav'); return n.classList.contains('is-open') && getComputedStyle(n).opacity === '1'; }, null, { timeout: ms(5000) }).catch(() => {});
    }
    await f.click(`.nav ul > li > a[href="#${id}"]`);
    await rest(f);
    const s = await look(f, id);
    const landed = s.top >= s.header - 2 && s.top <= s.header + 60;   // just under the header (the page keeps 16px free there)
    ok(`${tag}: ${NAMES[id]} ${why} lands on the ${NAMES[id]} section and lights up ${NAMES[id]} only`, landed && s.lit.join() === id,
      `section top ${s.top}px, header ends at ${s.header}px, lit: ${s.lit.join(', ') || 'nothing'}` + (landed ? '' : `, address ends in ${s.hash || '(nothing)'}, under the link: ${s.under}`));
  };
  // every point across a link belongs to that link: the invisible 44px tap area of a short word (or the red dot on Tomatoes in the fall) must not reach over a neighbour
  const reach = async (f, tag) => {
    const bad = await f.evaluate((ids) => {
      if (getComputedStyle(document.getElementById('menu-toggle')).display !== 'none') return ['the bar is folded into the menu button'];
      const out = [];
      for (const id of ids) {
        const a = document.querySelector(`.nav ul > li > a[href="#${id}"]`), r = a.getBoundingClientRect();
        for (const fx of [0.06, 0.3, 0.5, 0.7, 0.94]) {
          const e = document.elementFromPoint(r.left + r.width * fx, r.top + r.height / 2), got = e && e.closest('a');
          if (got !== a) out.push(`${id} at ${Math.round(fx * 100)}% -> ${got ? got.getAttribute('href') : e ? e.tagName : 'nothing'}`);
        }
      }
      return out;
    }, Object.keys(NAMES));
    ok(`${tag}: a click anywhere on Seasons, Tomatoes, Pizza, GreenHouse or Shop reaches that link and not a neighbour`, bad.length === 0, bad.slice(0, 6).join('; '));
  };
  const DOWN = [['seasons', 'from the top'], ['tomatoes', 'going down'], ['pizza', 'going down'], ['greenhouse', 'going down'], ['shop', 'going down']];
  const UP = [['greenhouse', 'going back up'], ['pizza', 'going back up'], ['tomatoes', 'going back up'], ['seasons', 'going back up']];

  // 1. inside the preview frame and on the page itself, a laptop screen: every link, down the page and back up
  for (const framed of [true, false]) {
    const { p, f } = await start({ framed, width: 1366, height: 768 });
    const tag = (framed ? 'in a preview frame' : 'on the page') + ' 1366x768';
    if (ok(`${tag}: the site opens`, !!f)) { await reach(f, tag); for (const [id, why] of [...DOWN, ...UP]) await go(f, tag, id, why); }
    await p.context().close();
  }

  // 2. short and tall windows (the highlight follows the line 45-50% down the screen, whatever its height)
  for (const [width, height] of [[1280, 500], [1920, 1400]]) {
    const { p, f } = await start({ framed: true, width, height });
    const tag = `in a preview frame ${width}x${height}`;
    if (ok(`${tag}: the site opens`, !!f)) for (const [id, why] of [['shop', 'from the top'], ['pizza', 'going back up'], ['tomatoes', 'going back up']]) await go(f, tag, id, why);
    await p.context().close();
  }

  // 3. the other languages (other word lengths: the links are wider or narrower and the bar is tighter)
  for (const lang of ['es', 'vi', 'hi', 'zh']) {
    const { p, f } = await start({ framed: true, width: 1366, height: 900, lang });
    const tag = `in a preview frame, ${lang}, 1366x900`;
    if (ok(`${tag}: the site opens in ${lang}`, !!f && (await f.evaluate(() => document.documentElement.lang)).split('-')[0] === lang)) {
      await reach(f, tag);
      for (const [id, why] of [['shop', 'from the top'], ['pizza', 'going back up'], ['tomatoes', 'going back up'], ['greenhouse', 'going down']]) await go(f, tag, id, why);
    }
    await p.context().close();
  }

  // 4. the menu behind the menu button: a phone, and a narrow (or zoomed-in) computer window
  for (const [width, height] of [[390, 800], [1100, 800]]) {
    const { p, f } = await start({ framed: true, width, height });
    const tag = `in a preview frame ${width}x${height}, menu button`;
    if (ok(`${tag}: the site opens`, !!f)) for (const [id, why] of [['shop', 'from the top'], ['pizza', 'going back up'], ['tomatoes', 'going back up']]) await go(f, tag, id, why);
    await p.context().close();
  }

  // In a sandboxed frame the browser refuses the site's fonts (they are sent without a CORS header and the frame's address is "null"), so the
  // text shows in the stand-in fonts. That is the frame, not the site: only those messages are left out of the page errors.
  for (let i = errs.length - 1; i >= 0; i--) if (/^nav-highlight-frame\.html console: Access to font at .* blocked by CORS policy/.test(errs[i])) errs.splice(i, 1);
});
