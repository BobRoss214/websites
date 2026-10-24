// order: 394
// browser: yes
// covers: css/styles.css, css/extras.css, js/features.js, js/main.js, index.html, first-visit.html, pumpkin-patch.html, strawberry-picking.html, school-field-trips.html, wise-pie.html
/* A page OPENED at an address with a #place (a link from another page, the questions that link into first-visit.html, a QR code, a shared link): the place
 * must be on the usual line under the sticky header (88 px on a computer, 80 px on a phone) the moment the browser first jumps to it, and stay there.
 * Every frame is looked at (scrollY and the top of the place) from the start until 2 s after the page has loaded, in real time, with smooth scrolling
 * left on as a visitor has it, on a laptop and a phone, in English and Spanish, in a sandboxed frame from another address (the claude.ai preview) and with
 * reduced motion, on the home page and on First visit.
 * What it guards against: "html{scroll-behavior:smooth}" also smoothed the browser's first jump to the #place, made while the page was still being built.
 * That jump became a glide that ran past the place by thousands of pixels on a laptop (about 270 px on a phone) and stayed there until the page put the
 * place back in view 1.5 s after loading (keepHashTarget in js/features.js). The check fails when, after its first move, the page is ever more than
 * 40 px from the place where it ends (a glide, an overshoot, a jump later), or when the place ends off the usual line.
 * Also: once the page has loaded, links on the page still glide (smooth scrolling is only held back while a page opens). */
import { run, open, ok, ms } from './lib.mjs';

const sleep = (n) => new Promise((r) => setTimeout(r, n));
const TOL = 4;        // px: how far from the usual line counts as the same place
const MOVE = 40;      // px: how far from its final place the page may be at any frame after its first move (the 26 px a box that fades in slides, and a little more)
const SIZES = { laptop: [1366, 768], phone: [390, 844] };

// in the page, from its first moment: frames in real time (the page's own "today" is the tests' usual day, but the timers and frames are not faked)
const SAMPLER = (id) => {
  const ho = window.__ho = { rows: [], load: -1 };
  const D = Date, off = new D('2026-10-02T12:00:00-04:00').getTime() - D.now();
  class FD extends D { constructor(...a) { if (a.length) super(...a); else super(D.now() + off); } static now() { return D.now() + off; } }
  window.Date = FD;
  addEventListener('load', () => { ho.load = Math.round(performance.now()); });
  let last = '';
  const tick = () => {
    const y = Math.round(scrollY * 10) / 10, el = document.getElementById(id), top = el ? Math.round(el.getBoundingClientRect().top * 10) / 10 : null, k = y + '|' + top;
    if (k !== last) { ho.rows.push([Math.round(performance.now()), y, top]); last = k; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

await run('hash-open', async ({ browser, base, errs }) => {
  // opens page + '#' + id (framed: inside <iframe sandbox>, like the claude.ai preview: a sandboxed frame has no address of its own, "null", so it counts as another site)
  const start = async ({ page = 'index.html', id, width, height, lang, framed = false, reduced = false }) => {
    const src = page + (lang ? '?lang=' + lang : '') + (id ? '#' + id : '');
    const routes = async (p) => {
      await p.addInitScript(SAMPLER, id || '');
      if (framed) await p.route('**/hash-open-frame.html', (r) => r.fulfill({ contentType: 'text/html', body: `<!doctype html><html><body style="margin:0"><iframe sandbox="allow-scripts allow-popups allow-forms" src="${src}" style="display:block;width:100vw;height:100vh;border:0"></iframe></body></html>` }));
    };
    const p = await open(browser, base, framed ? 'hash-open-frame.html' : src, errs, { viewport: { width, height }, routes, ready: false, time: false, reducedMotion: reduced ? 'reduce' : undefined });
    let f = framed ? null : p.mainFrame();
    for (let i = 0; !f && i < 100; i++) { f = p.frames().find((x) => x !== p.mainFrame() && x.url().includes(page)) || null; if (!f) await sleep(100); }
    return { p, f };
  };
  const loaded = (f, after) => f.waitForFunction((after) => !!window.__ho && window.__ho.load > 0 && performance.now() > window.__ho.load + after, after, { timeout: ms(40000), polling: 100 });

  // 1. a page opened at a #place: look at every frame until 2 s after the load
  const OPEN = [
    ['laptop', 'index.html', ['menu', 'farm']], ['phone', 'index.html', ['farm', 'varieties']],
    ['laptop', 'first-visit.html', ['parking', 'checklist']], ['phone', 'first-visit.html', ['strollers']],
    ['laptop in Spanish', 'index.html', ['menu'], { lang: 'es' }], ['phone in Spanish', 'index.html', ['farm'], { lang: 'es' }],
    ['laptop in a preview frame', 'index.html', ['menu'], { framed: true }], ['phone in a preview frame', 'index.html', ['farm'], { framed: true }],
    ['laptop with reduced motion', 'index.html', ['menu'], { reduced: true }],
  ];
  for (const [name, page, ids, extra = {}] of OPEN) {
    const [width, height] = SIZES[name.split(' ')[0]];
    for (const id of ids) {
      const tag = `${name}, ${page}#${id}`;
      const { p, f } = await start({ page, id, width, height, ...extra });
      try {
        if (!f) { ok(`${tag}: the page opens`, false, 'the page did not open'); await p.context().close(); continue; }
        await loaded(f, 2300);   // the page puts the place back at 0.3 s and 1.5 s after the load: let it do both
        const s = await f.evaluate((id) => {
          const t = document.getElementById(id), r = t.getBoundingClientRect();
          return { rows: window.__ho.rows, load: window.__ho.load, y: Math.round(scrollY * 10) / 10, top: Math.round(r.top * 10) / 10, line: parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop), max: document.documentElement.scrollHeight - innerHeight };
        }, id);
        // from the first frame in which the page has moved: how far it went past its final place, how far short of it, and when it last was off it
        let first = null, over = 0, short = 0, lastOff = 0;
        for (const [t, y] of s.rows) {
          if (first === null) { if (y > 0) first = t; else continue; }
          over = Math.max(over, y - s.y); short = Math.max(short, s.y - y);
          if (Math.abs(y - s.y) > MOVE) lastOff = t;
        }
        const atEnd = s.y >= s.max - 1;
        ok(`${tag}: the place is on the usual line when the page has settled`, (Math.abs(s.top - s.line) <= TOL || (atEnd && s.top > s.line)) && s.y > 0, `#${id} ends ${s.top}px from the top of the window, the line is ${s.line}px, the page is at ${s.y}`);
        ok(`${tag}: the page goes to the place in one step and stays (no glide, no overshoot, no jump later)`, first !== null && over <= MOVE && short <= MOVE,
          first === null ? 'the page never moved' : `the page first moved ${first - s.load} ms after the load; it ends at ${s.y}px, went ${Math.round(over)}px past that and was ${Math.round(short)}px short of it, still more than ${MOVE}px off at ${lastOff ? lastOff - s.load : '-'} ms after the load`);
      } catch (e) { ok(`${tag}: ${page}#${id}`, false, String(e.message).split('\n')[0]); }
      await p.context().close();
    }
  }

  // 2. links glide again once the page is open: on a page opened without a #place (right after the load) and on one opened at a #place (after its 1.5 s of settling)
  const glide = async (f, sel) => {
    await f.evaluate(() => { window.__g = new Set(); window.__gStop = false; const t = () => { window.__g.add(Math.round(scrollY)); if (!window.__gStop) requestAnimationFrame(t); }; t(); });
    await f.click(sel);
    await sleep(ms(2500));
    return f.evaluate(() => { window.__gStop = true; return { steps: window.__g.size, y: Math.round(scrollY), top: Math.round(document.getElementById('farm').getBoundingClientRect().top), sb: getComputedStyle(document.documentElement).scrollBehavior }; });
  };
  for (const [name, id] of [['opened without a #place', ''], ['opened at #menu, after it has settled', 'menu']]) {
    const { p, f } = await start({ id, width: 1366, height: 768 });
    try {
      await loaded(f, id ? 2300 : 300);
      const g = await glide(f, '.nav ul > li > a[href="#farm"]');
      ok(`laptop, page ${name}: the "On the Farm" link glides (smooth scrolling is on again)`, g.steps >= 4 && g.sb === 'smooth', `scroll-behavior ${g.sb}, ${g.steps} different places seen on the way to ${g.y}px`);
      ok(`laptop, page ${name}: the "On the Farm" link still ends on the usual line`, Math.abs(g.top - 88) <= TOL, `#farm ends ${g.top}px from the top, the line is 88px`);
    } catch (e) { ok(`laptop, page ${name}: links glide`, false, String(e.message).split('\n')[0]); }
    await p.context().close();
  }

  // In a sandboxed frame the browser refuses the site's fonts (they are sent without a CORS header and the frame's address is "null"), so the
  // text shows in the stand-in fonts. That is the frame, not the site: only those messages are left out of the page errors.
  for (let i = errs.length - 1; i >= 0; i--) if (/^hash-open-frame\.html console: Access to font at .* blocked by CORS policy/.test(errs[i])) errs.splice(i, 1);
});
