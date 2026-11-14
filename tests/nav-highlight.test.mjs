// order: 392
// browser: yes
// covers: js/main.js, css/styles.css, css/sections.css, css/extras.css, index.html
/* The top menu: What's in season and Tomatoes & basil (Things to Do), Wise Pie pizza and About The GreenHouse (GreenHouse) and Everything in the store (Store) each take
 * you to their own section, and the button of the group whose section you are reading is the one that lights up (yellow), and the line too when its list is open.
 * Checked on the page itself and inside a sandboxed frame from another address, the way the claude.ai preview shows the site (there the browser used to ignore the
 * "middle of the screen" setting of the highlight, so after Pizza the Tomatoes link lit up, because the end of the Tomatoes section sits under the header). Smooth
 * scrolling is left on, as a visitor has it: the mistake only shows when the page glides up to a section. Also: every language, short and tall windows, the phone menu and
 * the menu of a narrow or zoomed-in window, and that the 44px tap area of one button never covers part of its neighbour. */
import { run, open, ok, ms } from './lib.mjs';

const sleep = (n) => new Promise((r) => setTimeout(r, n));
// the section -> the group (its list id is nav-list-<key>) and the line that goes to it
const NAMES = {
  seasons: { key: 'things', group: 'Things to Do', line: 'What’s in season' }, tomatoes: { key: 'things', group: 'Things to Do', line: 'Tomatoes & basil' },
  pizza: { key: 'greenhouse', group: 'GreenHouse', line: 'Wise Pie pizza' }, greenhouse: { key: 'greenhouse', group: 'GreenHouse', line: 'About The GreenHouse' },
  shop: { key: 'store', group: 'Store', line: 'Everything in the store' },
};

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
  const folded = (f) => f.evaluate(() => getComputedStyle(document.getElementById('menu-toggle')).display !== 'none');
  const look = (f, id) => f.evaluate((id) => {
    const a = document.querySelector(`.nav-group-list a[href="#${id}"]`), r = a.getBoundingClientRect();
    const under = r.width ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;   // for a failure: what a click on the line reaches now
    return {
      top: Math.round(document.getElementById(id).getBoundingClientRect().top),
      header: Math.round(document.getElementById('site-header').getBoundingClientRect().bottom),
      buttons: [...document.querySelectorAll('.nav-group-btn[aria-current]')].map((x) => x.getAttribute('aria-controls').replace('nav-list-', '')),
      lines: [...document.querySelectorAll('.nav-group-list a[aria-current]')].map((x) => x.getAttribute('href').slice(1)),
      open: document.querySelectorAll('.nav-group.is-open').length,
      hash: location.hash,
      under: !r.width ? 'the line is not shown' : under && under.closest('a') === a ? 'the line' : under ? under.tagName.toLowerCase() + (under.id ? '#' + under.id : '') + (under.className && typeof under.className === 'string' ? '.' + under.className.trim().split(/\s+/).join('.') : '') : 'nothing',
    };
  }, id);
  // click one line of the menu (opening its list, or the phone menu, first) and check where you land and what lights up
  const go = async (f, tag, id, why) => {
    const n = NAMES[id];
    if (await folded(f)) {
      await f.click('#menu-toggle');
      await f.waitForFunction(() => { const x = document.getElementById('nav'); return x.classList.contains('is-open') && getComputedStyle(x).opacity === '1'; }, null, { timeout: ms(5000) }).catch(() => {});
    } else {
      await f.click(`button[aria-controls="nav-list-${n.key}"]`);
      await f.waitForSelector(`#nav-list-${n.key}`, { state: 'visible', timeout: ms(5000) }).catch(() => {});
    }
    await f.click(`#nav-list-${n.key} a[href="#${id}"]`);
    await rest(f);
    const s = await look(f, id);
    const landed = s.top >= s.header - 2 && s.top <= s.header + 60;   // just under the header (the page keeps 16px free there)
    ok(`${tag}: ${n.group} > ${n.line} ${why} lands on its section, the list is closed, and ${n.group} lights up and no other button`, landed && s.buttons.join() === n.key && s.open === 0,
      `section top ${s.top}px, header ends at ${s.header}px, buttons lit: ${s.buttons.join(', ') || 'nothing'}, ${s.open} list(s) open` + (landed ? '' : `, address ends in ${s.hash || '(nothing)'}, under the line: ${s.under}`));
    ok(`${tag}: ${n.line} ${why}: its line is lit too, and no other line`, s.lines.join() === id, `lines lit: ${s.lines.join(', ') || 'nothing'}`);
  };
  // every point across a button belongs to that button: the invisible 44px tap area of a short word must not reach over a neighbour (the red dot on Things to Do in the fall too).
  // The same for the lines of one open list: each is its own 44px tap area.
  const reach = async (f, tag) => {
    const bad = await f.evaluate(() => {
      if (getComputedStyle(document.getElementById('menu-toggle')).display !== 'none') return ['the bar is folded into the menu button'];
      const out = [];
      for (const b of document.querySelectorAll('.nav-group-btn')) {
        const r = b.getBoundingClientRect();
        for (const fx of [0.06, 0.3, 0.5, 0.7, 0.94]) {
          const e = document.elementFromPoint(r.left + r.width * fx, r.top + r.height / 2), got = e && e.closest('.nav-group-btn');
          if (got !== b) out.push(`${b.getAttribute('aria-controls')} at ${Math.round(fx * 100)}% -> ${got ? got.getAttribute('aria-controls') : e ? e.tagName : 'nothing'}`);
        }
      }
      return out;
    });
    ok(`${tag}: a click anywhere on one of the seven buttons reaches that button and not a neighbour`, bad.length === 0, bad.slice(0, 6).join('; '));
    await f.click('button[aria-controls="nav-list-store"]');
    await f.waitForSelector('#nav-list-store', { state: 'visible', timeout: ms(5000) }).catch(() => {});
    const wrong = await f.evaluate(() => {
      const out = [];
      for (const a of document.querySelectorAll('#nav-list-store a')) {
        const r = a.getBoundingClientRect();
        for (const fy of [0.1, 0.5, 0.9]) { const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height * fy), got = e && e.closest('a'); if (got !== a) out.push(`${a.getAttribute('href')} at ${Math.round(fy * 100)}% -> ${got ? got.getAttribute('href') : e ? e.tagName : 'nothing'}`); }
      }
      return out;
    });
    ok(`${tag}: a click anywhere on a line of the open Store list reaches that line and not the one next to it`, wrong.length === 0, wrong.slice(0, 6).join('; '));
    await f.click('button[aria-controls="nav-list-store"]');
  };
  const DOWN = [['seasons', 'from the top'], ['tomatoes', 'going down'], ['pizza', 'going down'], ['greenhouse', 'going down'], ['shop', 'going down']];
  const UP = [['greenhouse', 'going back up'], ['pizza', 'going back up'], ['tomatoes', 'going back up'], ['seasons', 'going back up']];

  // 1. inside the preview frame and on the page itself, a laptop screen: every line, down the page and back up
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

  // 3. the other languages (other word lengths: the buttons are wider or narrower and the bar is tighter)
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
