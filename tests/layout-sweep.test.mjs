/* Layout sweep (small, fast version): the home page and the First-visit page in Spanish, Hindi, Chinese and Vietnamese (the long words and the other scripts)
 * on a small phone (320), a phone (390) and a computer (1280): the page must not scroll sideways, nothing may stick out past the screen edge, no text may be cut off by
 * a box with overflow hidden, no button label may run over 4 or more lines or reach outside its button, no text may sit on top of other text, no picture may be stretched
 * or broken, the bars that float over the page (top menu, bottom buttons, back-to-top) may not cover each other or too much of a 320 x 568 screen, and every
 * character on the page must have a glyph (no empty boxes in Hindi or Chinese).
 * The checking itself is tests/layout-audit.mjs, which can also be run over every page, language, season and width (see tests/README). */
import { run, open, ok, info, until } from './lib.mjs';
import { auditLayout } from './layout-audit.mjs';

const PAGES = ['index.html', 'first-visit.html'];
const LANGS = ['es', 'hi', 'zh', 'vi'];
const SIZES = [{ w: 320, h: 568 }, { w: 390, h: 844 }, { w: 1280, h: 800 }];
const PARALLEL = 4;

await run('layout-sweep', async ({ browser, base, errs }) => {
  const results = [];
  // One page view per page and language, looked at on a computer window first and then shrunk to a phone and a small phone (a person who turns the phone or
  // drags the window does the same). The full sweep opens a fresh window of every width instead (see tests/README).
  async function lookAt(p, v) {
    await p.setViewportSize({ width: v.w, height: v.h });
    await new Promise((r) => setTimeout(r, 500));   // the page's own resize handlers (they wait 200 ms) have run
    // the menu slides away and the bars move with a CSS transition when the window gets narrower: look when they have come to rest
    await p.evaluate(() => Promise.race([Promise.all(document.getAnimations().filter((a) => a instanceof CSSTransition).map((a) => a.finished.catch(() => {}))), new Promise((r) => setTimeout(r, 3000))]));
    // a window as tall as the page: every section draws itself at once (no scrolling through 50,000 px), every picture loads
    await p.evaluate(() => { document.querySelectorAll('img').forEach((i) => { i.loading = 'eager'; }); });
    const tall = await p.evaluate(() => document.documentElement.scrollHeight);
    await p.setViewportSize({ width: v.w, height: Math.min(Math.max(tall, v.h), 30000) });
    await p.evaluate(async () => {
      await document.fonts.ready;
      const sleep = (n) => new Promise((r) => setTimeout(r, n));
      await Promise.all([...document.images].filter((i) => i.src).map((i) => Promise.race([i.decode().catch(() => {}), sleep(4000)])));
      await sleep(300);
    });
    const top = await p.evaluate(auditLayout, { parts: ['page'] });
    // the window as the visitor has it: the floating bars at the top of the page and 1.8 screens down
    await p.setViewportSize({ width: v.w, height: v.h });
    await p.evaluate(() => window.scrollTo(0, 0));
    await new Promise((r) => setTimeout(r, 300));
    const bars0 = await p.evaluate(auditLayout, { parts: ['fixed'] });
    await p.evaluate(() => window.scrollTo(0, Math.round(innerHeight * 1.8)));
    await until(p, () => Math.abs(window.scrollY - Math.round(innerHeight * 1.8)) < 4, null, 5000);
    await new Promise((r) => setTimeout(r, 400));
    const down = await p.evaluate(auditLayout, { parts: ['fixed'] });
    results.push({ ...v, problems: [...top.problems, ...bars0.problems, ...down.problems] });
  }
  const jobs = [];
  for (const pg of PAGES) for (const lang of LANGS) jobs.push({ pg, lang });
  async function view({ pg, lang }) {
    const p = await open(browser, base, pg, errs, { lang, viewport: { width: 1280, height: 800 } });
    try {
      await p.addStyleTag({ content: 'html.cv .cv-sec{content-visibility:visible!important}html{scroll-behavior:auto!important}' });
      for (const { w, h } of [...SIZES].reverse()) await lookAt(p, { pg, lang, w, h });
    } finally { await p.context().close(); }
  }
  let next = 0;
  await Promise.all(Array.from({ length: PARALLEL }, async () => { while (next < jobs.length) { const j = jobs[next++]; try { await view(j); } catch (e) { errs.push(`${j.pg} ${j.lang}: ${String(e.message).split('\n')[0]}`); } } }));
  const views = PAGES.length * LANGS.length * SIZES.length;

  const where = (r) => `${r.pg.replace('.html', '')} ${r.lang} ${r.w}px`;
  // a label over 3 lines in a narrow Spanish card still reads well; 4 or more lines is a bug
  const real = (p) => p.kind !== 'button-wrap' || Number((/over (\d+) lines/.exec(p.info) || [, 9])[1]) >= 4;
  const list = (kinds, w) => results.filter((r) => (w == null || r.w === w)).flatMap((r) => r.problems.filter((p) => kinds.includes(p.kind) && real(p)).map((p) => `${where(r)}: ${p.sel || 'page'} ${p.info}`));
  ok(`all ${views} page views were looked at`, results.length === views, `${results.length} of ${views}`);
  for (const { w } of SIZES) {
    ok(`${w}px: no page scrolls sideways and nothing sticks out past the screen edge`, list(['sideways', 'sideways-culprit', 'sticks-out'], w).length === 0, list(['sideways', 'sideways-culprit', 'sticks-out'], w).slice(0, 4).join(' | '));
    ok(`${w}px: no text is cut off by a box (overflow hidden) or shortened with "..."`, list(['clipped-text', 'ellipsis'], w).length === 0, list(['clipped-text', 'ellipsis'], w).slice(0, 4).join(' | '));
    ok(`${w}px: no button label runs over 4 lines or reaches outside its button`, list(['button-wrap', 'button-cut'], w).length === 0, list(['button-wrap', 'button-cut'], w).slice(0, 4).join(' | '));
    ok(`${w}px: no text sits on top of other text`, list(['overlap'], w).length === 0, list(['overlap'], w).slice(0, 4).join(' | '));
    ok(`${w}px: no picture is stretched or broken`, list(['img-stretch', 'img-broken'], w).length === 0, list(['img-stretch', 'img-broken'], w).slice(0, 4).join(' | '));
    ok(`${w}px: the bars that float over the page do not cover each other or too much of the screen`, list(['bars', 'bars-overlap'], w).length === 0, list(['bars', 'bars-overlap'], w).slice(0, 4).join(' | '));
  }
  ok('every character on the page has a glyph in Spanish, Hindi, Chinese and Vietnamese (no empty boxes)', list(['tofu']).length === 0, [...new Set(list(['tofu']))].slice(0, 4).join(' | '));
  info(`${views} page views: ${PAGES.join(', ')} x ${LANGS.join(', ')} x ${SIZES.map((s) => s.w).join(', ')} px`);
});
