/* Looping animations only run where someone can see them: a section far from the screen is paused as a whole (.is-offscreen), a long
 * section pauses its far-away drawings one by one (.anim-off), and everything pauses while the browser tab is hidden (html.anim-hidden). */
import { run, open, ok, okSoon } from './lib.mjs';

// every element in the page with an endless animation, split into "in a paused part of the page" and "not"
const loops = (p) => p.evaluate(() => {
  const r = { paused: { n: 0, notPaused: 0 }, free: { n: 0, notRunning: 0 } };
  for (const e of document.querySelectorAll('main *, .site-footer *')) {
    const cs = getComputedStyle(e);
    if (cs.animationName === 'none' || !/infinite/.test(cs.animationIterationCount) || e.closest('#sprite, symbol, defs')) continue;
    const states = cs.animationPlayState.split(',').map((x) => x.trim());   // one word for each animation on the element
    if (e.closest('.is-offscreen, .anim-off')) { r.paused.n++; if (!states.every((x) => x === 'paused')) r.paused.notPaused++; }
    else { r.free.n++; if (!states.every((x) => x === 'running')) r.free.notRunning++; }
  }
  return r;
});
const cls = (p, sel, c) => p.evaluate(([s, k]) => document.querySelector(s).classList.contains(k), [sel, c]);

await run('pause', async ({ browser, base, errs }) => {
  const p = await open(browser, base, 'index.html', errs);
  await okSoon('a section far down the page is paused, the hero on screen is not', async () => ({ faq: await cls(p, '#faq', 'is-offscreen'), top: await cls(p, '#top', 'is-offscreen') }), (v) => v.faq === true && v.top === false);
  const a = await loops(p);
  ok('there are endless animations in the page, and every one inside a paused part really is paused', a.paused.n > 0 && a.paused.notPaused === 0, JSON.stringify(a));
  ok('the ones that can be seen are running', a.free.n > 0 && a.free.notRunning === 0, JSON.stringify(a));
  await okSoon('long sections pause their far-away drawings one by one (.anim-off)', () => p.evaluate(() => document.querySelectorAll('.anim-off').length), (n) => n > 0, 20000);

  // scrolling wakes up what comes near and pauses what is left behind
  await p.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
  await p.evaluate(() => document.querySelector('#faq').scrollIntoView());
  await okSoon('scrolled to the FAQ: it runs again and the hero is paused', async () => ({ faq: await cls(p, '#faq', 'is-offscreen'), top: await cls(p, '#top', 'is-offscreen') }), (v) => v.faq === false && v.top === true);
  const b = await loops(p);
  ok('...and still nothing in a paused part is running', b.paused.notPaused === 0, JSON.stringify(b));

  // a drawing that was paused wakes up when it is scrolled near
  await p.evaluate(() => window.scrollTo(0, 0));
  await okSoon('back at the top: some drawings further down are paused one by one', () => p.evaluate(() => document.querySelectorAll('.anim-off').length), (n) => n > 0, 20000);
  await p.evaluate(() => { const el = document.querySelector('.anim-off'); window.__off = el; el.scrollIntoView({ block: 'center' }); });
  await okSoon('a paused drawing wakes up when it is scrolled into view', () => p.evaluate(() => !window.__off.classList.contains('anim-off')), (v) => v === true, 20000);

  // everything pauses while the tab is hidden
  const hidden = (v) => p.evaluate((h) => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); document.dispatchEvent(new Event('visibilitychange')); }, v);
  await hidden(true);
  await okSoon('a hidden tab pauses every animation (html.anim-hidden)', () => p.evaluate(() => document.documentElement.classList.contains('anim-hidden')), (v) => v === true);
  const h = await p.evaluate(() => Array.from(document.querySelectorAll('main *')).filter((e) => { const cs = getComputedStyle(e); return cs.animationName !== 'none' && /infinite/.test(cs.animationIterationCount) && !cs.animationPlayState.split(',').every((x) => x.trim() === 'paused'); }).length);
  ok('...really: no endless animation is left running', h === 0, String(h));
  await hidden(false);
  await okSoon('coming back to the tab starts them again', () => p.evaluate(() => document.documentElement.classList.contains('anim-hidden')), (v) => v === false);
  await p.context().close();
});
