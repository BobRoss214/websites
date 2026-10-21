// order: 352
// browser: yes
// covers: css/styles.css, css/hero.css, js/hero.js, js/main.js, index.html
/* The red barn on the far hill of the home page's farm scene is always whole: not cut off at the top, in every season, on a phone, a laptop,
 * a 1920 x 1080 screen, wide and short windows, very wide screens and with the browser zoomed, after scrolling down and back up (fast, with the
 * Home key), after a resize and after a reload in the middle of the page; and it stays below the sun, not on top of it.
 * The cause it guards against: the hills are drawn to fill the width, so on a wide, short window their picture is taller than their strip, and an
 * inner <svg> cuts at its own edge. At 1920 x 1080 that cut the roof and the weathervane off (a fifth of the barn), and on a short or very wide
 * window half of it or all of it (css/styles.css, svg.layer and .hero). */
import { run, open, ok, until, settled } from './lib.mjs';

// How the barn sits in the scene. The barn is cut when its painted top is above the edge of whatever frames it: the far layer's own <svg> box
// (only while that clips: overflow is not visible), the scene and the hero. The sun is checked against the barn's outline (roof, weathervanes, silo).
const MEASURE = () => {
  const far = document.getElementById('far'), scene = document.getElementById('hero-scene'), hero = document.getElementById('top');
  const barn = far && far.querySelector('use[href="#barn"]');
  if (!barn) return { err: 'no barn drawn' };
  const b = barn.getBoundingClientRect(), f = far.getBoundingClientRect(), s = scene.getBoundingClientRect(), h = hero.getBoundingClientRect();
  const frame = Math.max(getComputedStyle(far).overflow === 'visible' ? -1e9 : f.top, s.top, h.top);
  const out = { season: document.documentElement.dataset.season, hero: Math.round(h.width) + 'x' + Math.round(h.height), cut: Math.round(Math.max(0, frame - b.top) * 10) / 10, barnH: Math.round(b.height) };
  const sun = document.querySelector('.sun'), sr = sun && sun.getBoundingClientRect();
  if (sr && sr.width && getComputedStyle(sun).display !== 'none') {
    const cx = sr.left + sr.width / 2, cy = sr.top + sr.height / 2, rays = sr.width * 106 / 220;   // the rays reach 106 of the sun's 110 units
    const segs = [[87, 1, 87, 20], [20, 172, 20, 86], [20, 86, 32, 50], [32, 50, 87, 20], [87, 20, 142, 50], [142, 50, 154, 86], [160, 58, 167, 44], [167, 44, 180, 38], [180, 38, 193, 44], [193, 44, 200, 58], [200, 58, 200, 170], [180, 38, 180, 17]];
    const k = b.width / 183, ox = b.left - 17 * k, oy = b.top - k;   // the painted barn spans x 17..200 and y 1..173 of its 220 x 180 drawing
    let min = Infinity;
    segs.forEach(([x1, y1, x2, y2]) => { for (let i = 0; i <= 20; i++) min = Math.min(min, Math.hypot(ox + (x1 + (x2 - x1) * i / 20) * k - cx, oy + (y1 + (y2 - y1) * i / 20) * k - cy)); });
    out.sunGap = Math.round(min - rays);
  }
  out.layer = far.style.transform || '';
  out.y = Math.round(scrollY);
  return out;
};
const frames = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const measure = async (p) => { await frames(p); return p.evaluate(MEASURE); };
async function choose(p, s) {
  await p.evaluate((x) => WISE_ACRES.hero.setSeason(x), s);
  await until(p, (x) => document.documentElement.dataset.season === x && !document.getElementById('hero-scene').classList.contains('is-swapping') && !!document.querySelector('#far use[href="#barn"]'), s, 20000);
}
const whole = (m) => !m.err && m.cut === 0;   // (on a narrow screen the barn is off to the right side of the picture: that is by design, only the top is checked)
const clear = (m) => m.sunGap === undefined || m.sunGap >= 0;

await run('barn', async ({ browser, base, errs }) => {
  const page = async (w, h, o = {}) => {
    const p = await open(browser, base, 'index.html', errs, { viewport: { width: w, height: h }, deviceScaleFactor: o.dpr });
    await p.addStyleTag({ content: 'html{scroll-behavior:auto!important}#wa-problems,.action-bar{display:none!important}' });
    await until(p, () => !!(window.WISE_ACRES.hero && document.querySelector('#far use[href="#barn"]')), null, 20000);
    return p;
  };

  // ---- the reader can see a cut: with the old rule (the far hill's <svg> cuts at its edge) the barn at 1920 x 1080 is cut, as the farm saw it
  const p = await page(1920, 1080);
  await p.addStyleTag({ content: 'svg.layer-far{overflow:hidden!important}.hero{min-height:clamp(660px,calc(100svh - 112px),880px)!important}' });
  const old = await measure(p);
  ok('the check sees the old fault: with the far hill cut at its own edge, 1920 x 1080 cuts the top of the barn off', old.cut > 20, JSON.stringify(old));
  await p.context().close();

  // ---- every season, many window sizes (phones, laptops, 1920 x 1080, wide and short, very wide)
  const SIZES = [[390, 800], [360, 640], [800, 600], [1024, 700], [1280, 600], [1366, 768], [1440, 900], [1536, 730], [1920, 1080], [1920, 940], [1920, 700], [2560, 1440], [3440, 1440]];
  for (const [w, h] of SIZES) {
    const q = await page(w, h);
    const bad = [], near = [];
    for (const s of ['spring', 'summer', 'fall', 'winter']) {
      await choose(q, s);
      const m = await measure(q);
      if (!whole(m)) bad.push(JSON.stringify(m));
      if (!clear(m)) near.push(JSON.stringify(m));
    }
    ok(`${w} x ${h}: the barn is whole in every season`, bad.length === 0, bad.join(' | '));
    ok(`${w} x ${h}: the barn stays below the sun, not on top of it`, near.length === 0, near.join(' | '));
    await q.context().close();
  }

  // ---- browser zoom (a zoomed page has a smaller window in CSS pixels and more screen pixels to each)
  for (const [W, H, z] of [[1920, 1080, 1.1], [1920, 1080, 1.25], [1920, 1080, 1.5], [1366, 768, 1.25], [2560, 1440, 0.8]]) {
    const q = await page(Math.round(W / z), Math.round(H / z), { dpr: z });
    const m = await measure(q);
    ok(`${W} x ${H} at ${Math.round(z * 100)}%: the barn is whole and below the sun`, whole(m) && clear(m), JSON.stringify(m));
    await q.context().close();
  }

  // ---- scrolling, resizing and reloading: the layers follow the page and the barn is whole again at the top
  const r = await page(1366, 768);
  const layerAt = (m) => { const v = /translate3d\(0px, (-?[\d.]+)px/.exec(m.layer); return v ? +v[1] : 0; };
  const followsPage = (m) => Math.abs(layerAt(m) - m.y * 0.28) < 0.6;   // data-depth 0.28 of the far hill (js/main.js, initScroll)
  for (const y of [250, 600, 1200, 4000, 0]) await r.evaluate((v) => window.scrollTo(0, v), y);
  await settled(r);
  let m = await measure(r);
  ok('down and back up fast: the barn is whole and the far hill is back in place', whole(m) && m.y === 0 && followsPage(m), JSON.stringify(m));
  await r.evaluate(() => window.scrollTo(0, 3000));
  await settled(r);
  await r.keyboard.press('Home');
  await until(r, () => scrollY === 0, null, 8000);
  await settled(r);
  m = await measure(r);
  ok('Home key from far down: the barn is whole and the far hill is back in place', whole(m) && m.y === 0 && followsPage(m), JSON.stringify(m));
  await r.evaluate(() => window.scrollTo(0, 300));
  await settled(r);
  await choose(r, 'spring');
  await r.setViewportSize({ width: 1920, height: 1080 });
  await settled(r);
  m = await measure(r);
  ok('a season picked and the window made 1920 x 1080 while scrolled a little: the barn is whole and the far hill follows the page', whole(m) && followsPage(m), JSON.stringify(m));
  await r.setViewportSize({ width: 1920, height: 700 });
  await r.evaluate(() => window.scrollTo(0, 0));
  await settled(r);
  m = await measure(r);
  ok('...then made short (1920 x 700) and back at the top: the barn is whole and below the sun', whole(m) && clear(m) && followsPage(m), JSON.stringify(m));
  await r.evaluate(() => window.scrollTo(0, 500));
  await settled(r);
  await r.reload({ waitUntil: 'load' });
  await until(r, () => !!(window.WISE_ACRES && window.WISE_ACRES.hero && document.querySelector('#far use[href="#barn"]')), null, 20000);
  await r.addStyleTag({ content: 'html{scroll-behavior:auto!important}#wa-problems,.action-bar{display:none!important}' });
  await settled(r);
  m = await measure(r);
  ok('a reload in the middle of the page: the far hill follows the page', whole(m) && followsPage(m), JSON.stringify(m));
  await r.evaluate(() => window.scrollTo(0, 0));
  await settled(r);
  m = await measure(r);
  ok('...and back at the top: the barn is whole', whole(m) && followsPage(m), JSON.stringify(m));
  await r.context().close();
});
