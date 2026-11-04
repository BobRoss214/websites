// order: 166
// browser: yes
// covers: js/main.js, css/*, index.html
/* What follows the pointer over the hero (js/main.js, initBee): a bee or a butterfly, chosen at random when the page loads and changed now and then. Everything is run
 * once for each kind (?critter=bee, ?critter=butterfly: the address option only this page reads), both kinds at the same time.
 *
 * HOW IT MOVES (what is tested): it chases a spot (the pointer, or a spot of the field when the pointer has rested for 2.5 s). Ten times a second it starts a short straight
 * leg of at most 240 ms, a Web Animation of the transform of #bee-fly, from the exact place it has reached, so the path has no joins. It goes faster the farther away the spot is
 * and slower and slower as it nears (a bee up to 860 px per second, a butterfly up to 540), the butterfly sways a little to the sides and leans (rotates) towards the way it goes,
 * the bee turns round smoothly (its scaleX goes through the numbers between 1 and -1, never a one-frame flip). It settles next to the hero's own buttons and cards, not on them. When
 * nobody moves the pointer it strolls about, slowly (a bee up to 210 px per second, a butterfly up to 150). Every 45 to 75 seconds (never when the address picks the kind) it flies
 * out of a side edge of the hero and comes back as the other kind. It is parked (stops where it is) when the hero is out of sight, the tab is hidden, the season is winter or the
 * visitor pressed "Pause animations" (data-calm="all"); the page's own calm mode (light, most) does not stop the flight. With "reduce motion" it is hidden.
 *
 * HOW THIS TEST LOOKS AT IT. The flight checks wait in REAL time: the page's clock is a fake one that Playwright moves along with the real time, and a leg is run by the browser's own
 * animation clock, which no fake clock moves. Every leg the page starts is written down (a wrapper round Element.animate, LEG_LOG): its keyframes, its length in time, where the creature
 * was drawn just before, and whether it has its start time when the turn of the page that made it ends. That is the most important check: a leg that is left to start at the next drawn
 * frame is not started yet in the eyes of the script while the compositor already draws it, and on a computer that draws a frame only now and then the creature went back to where the
 * last leg began, again and again (the builder saw it as "jumping around"; a look at the creature's box from a script cannot see it, the script's own picture of the box is the one
 * that is wrong). With the start times known, the way the creature goes follows from the legs alone (modelAt), and that is what the smoothness checks use: the pointer goes round a circle
 * for 6 s, then rests for 20 s. Every step is looked at (none bigger than the kind can fly in that time, none back), and so are the company it keeps with the pointer, where it rests and how
 * it strolls. A light look at the real box a few times a second proves that the browser draws what the legs say. (A look at the box every frame would cost the busy page so much that its
 * timers run late, and the busy page is what must be judged: those checks that depend on the timing say so and are left out when the legs came 300 ms apart or more.) The page's own calm mode
 * is only simulated here (the attribute and the event); the real switch (a slow processor), with the wings of the follower running in "light" and in "most" and the flight going on, is in tests/calm.test.mjs.
 *
 * A BUSY PAGE (busy): every frame the page draws costs 90 ms of its own turn (the browser's own requestAnimationFrame, taken before the pretend clock replaces it), so the page draws about ten
 * frames a second at best, much fewer on a busy computer. The creature must still reach the pointer three times, never go back on the way, every leg must have its start time at once, and a change
 * of kind must end. Once more in a browser that takes no start time for an animation (NO_START: the page's fallback, which asks the leg how far it is and waits for a leg that is not drawn yet).
 * A CHANGE OF KIND THAT CANNOT GET OUT (stuck): the animation clock of the page is made to stand still, so the creature can never reach the edge; 5 s on it is still what it was, 13 s on the
 * other kind is there. "Pause animations" while the change starts (the creature is in sight): it stays where it is, as what it is; when it is already out of sight: it is back, parked inside the
 * hero, as the other kind. A window made smaller puts a parked creature, and one that follows a pointer beyond the new edge, back inside the hero. */
import { run, open, ok, info, until, ms, machine } from './lib.mjs';

const DESK = { width: 1440, height: 900 };
const KINDS = ['bee', 'butterfly'];
const FAST = { bee: 860, butterfly: 540 };      // the fastest each kind flies (px per second)
const STROLL = { bee: 210, butterfly: 150 };    // the fastest each kind strolls when nobody moves the pointer
const LEG_MS = 240;                             // the longest one leg of the flight lasts
const SPOTS = [[330, 330], [800, 260], [1100, 400], [700, 330], [300, 500], [900, 300], [500, 480]];   // bare sky and field (window pixels at 1440 x 900), clear of every button
const PAUSE = '.picker [data-motion]';
const realWait = (t) => new Promise((r) => setTimeout(r, t));
const dist = (a, b) => (a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : Infinity);
const pct = (list, f) => { const s = list.slice().sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(f * s.length))] : 0; };
const r1 = (v) => Math.round(v * 10) / 10;

// the results of one run for one kind are kept and shown together when it is over (both kinds run at the same time)
const chain = () => {
  const rows = [];
  return { ck: (name, cond, detail = '') => { rows.push([name, !!cond, detail]); return !!cond; }, flush: () => rows.forEach(([n, c, d]) => ok(n, c, d)) };
};
// like okSoon in lib.mjs, but the result goes to the chain
async function soon(ck, name, get, test, limit = 15000) {
  const t0 = Date.now(), end = t0 + ms(limit);
  let v, good = false;
  for (;;) {
    try { v = await get(); good = !!test(v); } catch (e) { v = 'error: ' + e.message; good = false; }
    if (good || Date.now() > end) break;
    await realWait(100);
  }
  ck(name, good, good ? '' : (typeof v === 'string' ? v : JSON.stringify(v)) + '  [still not true after ' + Math.round((Date.now() - t0) / 1000) + ' s]');
  return good;
}

/* ---------------------------------------------------------------- looking at the page */
// the middle of the creature's box, in the hero's own coordinates
const centre = (p) => p.evaluate(() => { const r = document.querySelector('#bee-fly').getBoundingClientRect(), h = document.querySelector('#top').getBoundingClientRect(); return [r.x - h.x + r.width / 2, r.y - h.y + r.height / 2]; });
const viewCentre = (p) => p.evaluate(() => { const r = document.querySelector('#bee-fly').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
const inHero = (p, x, y) => p.evaluate(([x, y]) => { const h = document.querySelector('#top').getBoundingClientRect(); return [x - h.x, y - h.y]; }, [x, y]);
const kindOf = (p) => p.evaluate(() => document.querySelector('#bee-fly').dataset.kind);
const calmOf = (p) => p.evaluate(() => document.documentElement.getAttribute('data-calm'));
const legsOf = (p) => p.evaluate(() => document.querySelector('#bee-fly').getAnimations().length);   // flights started and not cancelled: none when it is parked
// the answer of an IntersectionObserver comes with a drawn frame (late on a busy computer): ask the same question and wait for ours, which is delivered after the page's own
const seen = (p) => p.evaluate(() => new Promise((r) => { const io = new IntersectionObserver(() => { io.disconnect(); r(); }); io.observe(document.querySelector('#top')); }));
const hidden = (p, v) => p.evaluate((h) => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); document.dispatchEvent(new Event('visibilitychange')); }, v);

// Written into the page before its own scripts: every leg of the flight (Element.animate on #bee-fly) is noted down the moment it starts: the browser's animation clock, the keyframes,
// how long it lasts, where the creature was drawn just before it, and, one microtask later (still in the same turn of the page, so before any frame is drawn), whether the leg already
// has its start time. Read back as window.__legs.
const LEG_LOG = () => {
  const animate = Element.prototype.animate;
  const log = window.__legs = [];
  Element.prototype.animate = function (keyframes, options) {
    let before = null;
    if (this.id === 'bee-fly') { const m = new DOMMatrixReadOnly(getComputedStyle(this).transform); before = [m.m41, m.m42]; }
    const a = animate.apply(this, arguments);
    if (before) {
      const rec = { kind: this.dataset.kind, clock: document.timeline.currentTime, kf: Array.from(keyframes, (k) => k.transform), props: Array.from(keyframes, (k) => Object.keys(k).join()), ms: options.duration, easing: options.easing, fill: options.fill, before, pending: null, startTime: null };
      log.push(rec);
      Promise.resolve().then(() => { rec.pending = a.pending; rec.startTime = a.startTime; });
    }
    return a;
  };
};
const legsLog = (p) => p.evaluate(() => window.__legs.slice());
// Written into the page before its own scripts, and so before the pretend clock replaces it: the browser's own requestAnimationFrame (for the busy page below).
const REAL_RAF = () => { window.__raf = window.requestAnimationFrame.bind(window); };
// A browser that does not take a start time for an animation (the setter is there and does nothing): the page then asks the leg how far it is, as it did before it gave every leg its start time.
const NO_START = () => {
  const d = Object.getOwnPropertyDescriptor(Animation.prototype, 'startTime');
  Object.defineProperty(Animation.prototype, 'startTime', { configurable: true, enumerable: d.enumerable, get: d.get, set() { /* refused */ } });
};
// A busy page: every frame it draws costs `jank` ms of its own turn, so it draws about ten at best and its timers come in between (a slow phone, a laptop with many things open).
// Resolves with the frames a second it manages.
const busyStart = (p, jank) => p.evaluate((jank) => new Promise((resolve) => {
  let n = 0; const t0 = performance.now();
  (function loop() { window.__raf(() => { const t = performance.now(); while (performance.now() - t < jank); if (++n === 5) resolve(Math.round(n * 1000 / (performance.now() - t0))); loop(); }); })();
}), jank);
// how far the creature gets from a spot (hero coordinates) after it has been nearer, every 50 ms from inside the page: a creature that goes straight for the spot never gets farther
const tripStart = (p, target) => p.evaluate((t) => {
  const el = document.querySelector('#bee-fly'), w = el.offsetWidth / 2, h = el.offsetHeight / 2, rows = [];
  window.__trip = { rows, iv: setInterval(() => { const m = new DOMMatrixReadOnly(getComputedStyle(el).transform); rows.push(Math.hypot(m.m41 + w - t[0], m.m42 + h - t[1])); }, 50) };
}, target);
const tripStop = (p) => p.evaluate(() => { clearInterval(window.__trip.iv); return window.__trip.rows; });
const regress = (rows) => { let best = Infinity, worst = 0; for (const d of rows) { best = Math.min(best, d); worst = Math.max(worst, d - best); } return worst; };

const TF = /translate\(([-\d.]+)px, ([-\d.]+)px\) (?:scaleX\(([-\d.]+)\)|rotate\(([-\d.]+)deg\))/;
const legOf = (l) => {
  const a = TF.exec(l.kf[0]), b = TF.exec(l.kf[1]);
  if (l.kf.length !== 2 || !a || !b) return null;
  const n = (m, i) => (m[i] === undefined ? null : +m[i]);
  return { kind: l.kind, x0: +a[1], y0: +a[2], x1: +b[1], y1: +b[2], f0: n(a, 3), f1: n(b, 3), r0: n(a, 4), r1: n(b, 4), ms: l.ms, st: l.startTime, clock: l.clock, before: l.before, pending: l.pending, easing: l.easing, fill: l.fill, props: l.props, len: Math.hypot(+b[1] - +a[1], +b[2] - +a[2]) };
};
// What is wrong with the legs: their shape, their start, their speed and (joins: true) whether each one begins where the one before it had got to.
function legChecks(raw, kind, { joins = false } = {}) {
  const L = raw.map(legOf), bad = { shape: [], start: [], speed: [], join: [] };
  L.forEach((l, i) => {
    if (!l) { bad.shape.push(`#${i} is not one straight leg: ${JSON.stringify(raw[i].kf)}`); return; }
    if (l.props.some((x) => x !== 'transform') || l.easing !== 'linear' || l.fill !== 'forwards' || !(l.ms >= 60 && l.ms <= LEG_MS + 1)) bad.shape.push(`#${i} ${l.props} ${l.easing} ${l.fill} ${l.ms} ms`);
    if (l.pending !== false || typeof l.st !== 'number' || Math.abs(l.st - l.clock) > 0.01) bad.start.push(`#${i} pending ${l.pending}, start time ${l.st}, clock ${l.clock}`);
    const v = l.len / (l.ms / 1000);
    if (v > FAST[l.kind] * 1.04) bad.speed.push(`#${i} a ${l.kind} at ${Math.round(v)} px/s`);
    const q = joins && i > 0 ? L[i - 1] : null;
    if (q) {
      const dt = l.st - q.st;
      if (dt >= 0 && dt <= q.ms) {   // the leg before it was still on its way
        const e = dt / q.ms, ex = q.x0 + (q.x1 - q.x0) * e, ey = q.y0 + (q.y1 - q.y0) * e;
        const gap = Math.hypot(l.x0 - ex, l.y0 - ey), seenGap = Math.hypot(l.x0 - l.before[0], l.y0 - l.before[1]);
        if (gap > 1 || seenGap > 2) bad.join.push(`#${i} starts ${r1(gap)} px from where the leg before it had got to (${r1(seenGap)} px from where it was drawn)`);
        if (l.f0 !== null && q.f0 !== null && Math.abs(l.f0 - (q.f0 + (q.f1 - q.f0) * e)) > 0.03) bad.join.push(`#${i} turns from ${l.f0}, the leg before it had got to ${r1(q.f0 + (q.f1 - q.f0) * e)}`);
        if (l.r0 !== null && q.r0 !== null && Math.abs(l.r0 - (q.r0 + (q.r1 - q.r0) * e)) > 0.3) bad.join.push(`#${i} leans from ${l.r0}, the leg before it had got to ${r1(q.r0 + (q.r1 - q.r0) * e)}`);
      }
    }
  });
  return { n: L.length, L, bad };
}
const said = (list) => (list.length ? list.slice(0, 3).join(' | ') + (list.length > 3 ? ` ... (${list.length})` : '') : '');

// Moves the pointer to (x, y) over the hero (window pixels) and leaves it there; waits (real time) until the middle of the creature's box is within `tol` px of it.
async function follows(p, x, y, { tol = 60, limit = 15000, steps = 5 } = {}) {
  await p.mouse.move(x, y, { steps });
  const want = await inHero(p, x, y), t0 = Date.now(), end = t0 + ms(limit);
  let at = await centre(p);
  while (dist(at, want) > tol && Date.now() < end) { await realWait(80); at = await centre(p); }
  return { ok: dist(at, want) <= tol, at, want, secs: (Date.now() - t0) / 1000 };
}
// ... to a spot that is far from where the creature is now (so that a creature that did not move cannot pass)
async function farFollows(p, opts) {
  const c = await viewCentre(p), s = SPOTS.find((q) => dist(q, c) > 300) || SPOTS[0];
  return follows(p, s[0], s[1], opts);
}
const told = (f) => (f.ok ? `it got to the pointer in ${f.secs.toFixed(1)} s` : `NOT at the pointer after ${f.secs.toFixed(0)} s: it is at ${f.at.map(Math.round)}, the pointer at ${f.want.map(Math.round)}`);
// stays where it is for `wait` ms (a parked creature): { still, legs }
async function stays(p, wait = 1500) { const a = await centre(p); await realWait(wait); const b = await centre(p); return { still: dist(a, b) < 0.6, moved: r1(dist(a, b)), legs: await legsOf(p) }; }
// waits until the creature has come to rest (its middle has not moved 1 px for 250 ms) within `near` px of `want` (hero coordinates); returns { ok, c }: c is its middle at rest (or the last
// place it was seen). It looks from inside the page, every 100 ms: a slow round trip between this program and a busy page cannot make it miss the short moment the creature stays at rest.
const settlesNear = (p, want, { near = 170, limit = 15000 } = {}) => p.evaluate(({ want, near, limit }) => new Promise((resolve) => {
  const el = document.querySelector('#bee-fly'), w = el.offsetWidth / 2, h = el.offsetHeight / 2, t0 = performance.now();
  let last = null, since = t0;
  const iv = setInterval(() => {
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform), c = [m.m41 + w, m.m42 + h], now = performance.now();
    if (last && Math.hypot(c[0] - last[0], c[1] - last[1]) < 1) {
      if (now - since >= 250 && Math.hypot(c[0] - want[0], c[1] - want[1]) <= near) { clearInterval(iv); resolve({ ok: true, c, t: document.timeline.currentTime }); return; }
    } else since = now;
    last = c;
    if (now - t0 > limit) { clearInterval(iv); resolve({ ok: false, c, want, t: document.timeline.currentTime }); }
  }, 100);
}), { want, near, limit: ms(limit) });
// the hero's own buttons and cards (hero coordinates) and the size of the creature's box
const keepRects = (p) => p.evaluate(() => {
  const hero = document.querySelector('#top'), h = hero.getBoundingClientRect(), box = document.querySelector('#bee-fly');
  const list = [...hero.querySelectorAll('.hero-cta a, .hero-note, .hero-note a, .season-switch, .chips a, .picker')].filter((e) => e.getClientRects().length).map((e) => { const r = e.getBoundingClientRect(); return [r.left - h.left, r.top - h.top, r.right - h.left, r.bottom - h.top]; });
  return { list, w: box.offsetWidth, h: box.offsetHeight, hero: [h.width, h.height] };
});
// how far the creature's box (its middle at c) lies over a rectangle: [across, down] in px
const overlap = (c, size, r) => [Math.min(c[0] + size.w / 2, r[2]) - Math.max(c[0] - size.w / 2, r[0]), Math.min(c[1] + size.h / 2, r[3]) - Math.max(c[1] - size.h / 2, r[1])];
const onAny = (c, keep) => keep.list.map((r) => overlap(c, keep, r)).filter(([a, b]) => a > 8 && b > 8).length;   // more than 8 px over a button in both ways: it sits on it

// What the browser itself says about the creature, a few times a second: [animation clock, x, y, cos, sin] of its box (cos and sin of its turn: the bee's scaleX, the butterfly's lean).
// It is read from the transform alone (the box sits at the hero's corner). Looking more often would cost the busy page more than it is worth: every look makes the browser work out the
// style of the whole animated hero, and a page that is busy answers later with every look (the legs a second apart instead of ten a second). The way the creature goes is worked out from
// the legs instead (modelAt): this is only there to prove that the browser draws what the legs say.
const recStart = (p, every = 250) => p.evaluate((every) => {
  const el = document.querySelector('#bee-fly'), w = el.offsetWidth / 2, h = el.offsetHeight / 2, rows = [];
  window.__rec = { rows, iv: setInterval(() => { const m = new DOMMatrixReadOnly(getComputedStyle(el).transform); rows.push([document.timeline.currentTime, m.m41 + w, m.m42 + h, m.a, m.b]); }, every) };
}, every);
const recStop = (p) => p.evaluate(() => { clearInterval(window.__rec.iv); return window.__rec.rows.filter((r, i, a) => i === 0 || r[0] > a[i - 1][0]); });
// Where the legs say the creature is at the moment t (animation clock): the leg that began last before t, at its progress (a leg that has ended stays where it ended until the next begins).
// [x, y (the middle of its box), cos, sin of its turn]; null before the first leg.
function modelAt(legs, t, half) {
  let i = -1;
  for (let k = 0; k < legs.length && legs[k].st <= t; k++) i = k;
  if (i < 0) return null;
  const l = legs[i], e = Math.max(0, Math.min(1, (t - l.st) / l.ms)), rad = (d) => (d * Math.PI) / 180;
  const f = l.f0 === null ? null : l.f0 + (l.f1 - l.f0) * e, r = l.r0 === null ? null : l.r0 + (l.r1 - l.r0) * e;
  return [l.x0 + (l.x1 - l.x0) * e + half[0], l.y0 + (l.y1 - l.y0) * e + half[1], f !== null ? f : Math.cos(rad(r)), r !== null ? Math.sin(rad(r)) : 0];
}
const modelRows = (legs, t0, t1, half, every = 30) => { const out = []; for (let t = t0; t <= t1; t += every) { const m = modelAt(legs, t, half); if (m) out.push([t, ...m]); } return out; };
// the pointer stays where it is (a pointer event every 300 ms from inside the page, at the same place) so that the creature, which strolls off when no pointer has moved for 2.5 s, stays with it
const hold = (p, x, y) => p.evaluate(([x, y]) => {
  const hero = document.querySelector('#top'); clearInterval(window.__hold);
  const send = () => hero.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true, pointerType: 'mouse' }));
  send(); window.__hold = setInterval(send, 300);
}, [x, y]);
const release = (p) => p.evaluate(() => clearInterval(window.__hold));
// a pointer made inside the page (one pointermove every 16 ms along the path, so that a busy computer cannot thin it out); the path is a circle (cx, cy, R: window pixels)
const circle = (p, geo, secs) => p.evaluate(({ cx, cy, R, secs }) => new Promise((resolve) => {
  const hero = document.querySelector('#top'), t0 = performance.now(), c0 = document.timeline.currentTime;
  let moves = 0;
  const iv = setInterval(() => {
    const f = Math.min(1, (performance.now() - t0) / (secs * 1000)), a = f * Math.PI * 2;
    hero.dispatchEvent(new PointerEvent('pointermove', { clientX: cx + R * Math.cos(a), clientY: cy + R * Math.sin(a), bubbles: true, pointerType: 'mouse' })); moves++;
    if (f >= 1) { clearInterval(iv); resolve({ moves, from: c0, to: document.timeline.currentTime }); }
  }, 16);
}), { ...geo, secs });
// the free band between the season buttons and the first big button, as a circle for the pointer (hero coordinates). The creature keeps its box clear of every button (the box's corner is
// 26 px left of and 24 px above the pointer), so the pointer must stay about 46 px below the season buttons and 38 px above the first big button, and some more.
const freeCircle = (p) => p.evaluate(() => {
  const h = document.querySelector('#top').getBoundingClientRect(), sw = document.querySelector('.season-switch').getBoundingClientRect(), btn = document.querySelector('.hero-cta a').getBoundingClientRect();
  const top = sw.bottom - h.top + 46 + 16, bottom = btn.top - h.top - 38 - 16, R = Math.max(40, Math.min(150, (bottom - top) / 2));
  return { cx: h.width / 2, cy: (top + bottom) / 2, R };
});

/* ---------------------------------------------------------------- one kind, on one page: what it looks like and how it behaves */
async function behaviour(browser, base, errs, kind, ck) {
  const mine = kind === 'bee' ? 'bee' : 'bfly', other = kind === 'bee' ? 'bfly' : 'bee';
  const p = await open(browser, base, 'index.html', errs, { viewport: DESK, query: 'critter=' + kind, routes: async (pg) => { await pg.addInitScript(LEG_LOG); } });
  await seen(p);
  let f;

  // ---- 1. what it is: the right drawing shows, nothing for a screen reader, it never catches a click, the wings flap, only transforms move
  const d = await p.evaluate(() => {
    const box = document.querySelector('#bee-fly'), cs = (e) => getComputedStyle(e), r = box.getBoundingClientRect();
    const loops = box.getAnimations({ subtree: true }).filter((a) => a.effect.getTiming().iterations === Infinity && a.playState === 'running');
    const props = new Set(); loops.forEach((a) => a.effect.getKeyframes().forEach((k) => Object.keys(k).forEach((n) => { if (!['offset', 'easing', 'composite', 'computedOffset'].includes(n)) props.add(n); })));
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return {
      kind: box.dataset.kind, aria: box.getAttribute('aria-hidden'), svgAria: [...box.querySelectorAll('svg')].map((v) => v.getAttribute('aria-hidden')), pe: cs(box).pointerEvents, catches: !!(top && top.closest('#bee-fly')),
      shown: { bee: cs(document.querySelector('#bee')).display, bfly: cs(document.querySelector('#bfly')).display }, size: [Math.round(box.offsetWidth), Math.round(box.offsetHeight)],
      loops: loops.map((a) => ({ name: a.animationName, ms: a.effect.getTiming().duration })), props: [...props], wingParents: [...box.querySelectorAll('.bw')].map((n) => n.parentNode.id), hue: box.dataset.hue || '',
    };
  });
  ck(`${kind}: the ${kind} is drawn and the other one is not (data-kind="${d.kind}")`, d.kind === kind && d.shown[mine] === 'block' && d.shown[other] === 'none', JSON.stringify(d.shown));
  ck(`${kind}: hidden from screen readers (the box and both drawings) and it never catches a click (pointer-events none, and a click on its middle goes to what is under it)`, d.aria === 'true' && d.svgAria.every((v) => v === 'true') && d.pe === 'none' && !d.catches, JSON.stringify([d.aria, d.svgAria, d.pe, d.catches]));
  const flaps = d.loops.filter((l) => l.name === (kind === 'bee' ? 'buzz' : 'flap')), bob = d.loops.filter((l) => l.name === (kind === 'bee' ? 'beeFly' : 'bflyBob'));
  ck(`${kind}: the wings flap (two wings, a loop each) and it bobs (one loop)`, flaps.length === 2 && bob.length === 1 && d.loops.length === 3, JSON.stringify(d.loops));
  if (kind === 'butterfly') {
    ck('butterfly: its wings flap faster than the two butterflies of the scene (.32 s per half beat), and are direct children of the drawing', flaps.length === 2 && flaps.every((l) => l.ms < 200 && l.ms >= 60) && d.wingParents.length === 2 && d.wingParents.every((id) => id === 'bfly'), JSON.stringify([flaps, d.wingParents]));
    ck(`butterfly: coloured from the site's palette (${d.hue || 'monarch'})`, ['', 'monarch', 'morpho', 'admiral'].includes(d.hue) && d.size[0] === 52, JSON.stringify([d.hue, d.size]));
  } else ck('bee: the wings buzz faster still (.09 s per half beat)', flaps.length === 2 && flaps.every((l) => l.ms <= 100), JSON.stringify(flaps));
  ck(`${kind}: everything that loops moves by transform only (the compositor runs it: no repaint, no script)`, d.props.length === 1 && d.props[0] === 'transform', JSON.stringify(d.props));
  const keep = await keepRects(p);

  // ---- 2. it follows the pointer; the visitor's own pause parks it where it is, and play lets it follow again
  f = await farFollows(p);
  ck(`${kind}: it follows the pointer`, f.ok, told(f));
  f = await farFollows(p);
  ck(`${kind}: ...and again, somewhere else`, f.ok, told(f));
  await p.click(PAUSE);
  await soon(ck, `${kind}: "Pause animations" (data-calm="all"): no flight is running`, () => legsOf(p), (n) => n === 0, 6000);
  ck(`${kind}: ...and the page says so (data-calm="${await calmOf(p)}")`, (await calmOf(p)) === 'all');
  const parkedAt = await viewCentre(p), elsewhere = SPOTS.find((q) => dist(q, parkedAt) > 300) || SPOTS[0];
  await p.mouse.move(elsewhere[0], elsewhere[1], { steps: 6 });
  let s = await stays(p, 1500);
  ck(`${kind}: ...it stays where it is while the pointer goes elsewhere (moved ${s.moved} px, flights ${s.legs})`, s.still && s.legs === 0, JSON.stringify(s));
  await p.click(PAUSE);
  ck(`${kind}: pressed again ("Play animations"): data-calm is gone`, (await calmOf(p)) === null);
  f = await farFollows(p);
  ck(`${kind}: ...and it follows again`, f.ok, told(f));

  // ---- 3. the page's own calm mode does not stop the flight (only the visitor's pause does)
  for (const level of ['light', 'most']) {
    await p.evaluate((l) => { document.documentElement.setAttribute('data-calm', l); document.dispatchEvent(new CustomEvent('wa:calm', { detail: { level: l, by: 'auto' } })); }, level);
    f = await farFollows(p);
    ck(`${kind}: the page's calm mode "${level}": it still follows the pointer`, f.ok, told(f));
  }
  await p.evaluate(() => { document.documentElement.removeAttribute('data-calm'); document.dispatchEvent(new CustomEvent('wa:calm', { detail: { level: '', by: 'auto' } })); });

  // ---- 4. the other ways it is parked: scrolled out of sight, a hidden tab, winter; each time it follows again afterwards
  await p.evaluate(() => scrollTo({ top: 3200, behavior: 'instant' })); await seen(p);
  await soon(ck, `${kind}: scrolled out of sight: no flight is running`, () => legsOf(p), (n) => n === 0, 8000);
  s = await stays(p, 1000);
  ck(`${kind}: ...it stays where it is (moved ${s.moved} px)`, s.still && s.legs === 0, JSON.stringify(s));
  await p.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await seen(p); await realWait(500);
  f = await farFollows(p);
  ck(`${kind}: scrolled back: it follows`, f.ok, told(f));

  await hidden(p, true);
  await soon(ck, `${kind}: a hidden tab: no flight is running`, () => legsOf(p), (n) => n === 0, 6000);
  s = await stays(p, 1000);
  ck(`${kind}: ...it stays where it is (moved ${s.moved} px)`, s.still && s.legs === 0, JSON.stringify(s));
  await hidden(p, false); await realWait(300);
  f = await farFollows(p);
  ck(`${kind}: the tab is shown again: it follows`, f.ok, told(f));

  await p.click('#season-switch button[data-season="winter"]');
  await until(p, () => document.documentElement.dataset.season === 'winter', null, 30000);
  await soon(ck, `${kind}: winter: it is hidden (display none) and no flight is running`, () => p.evaluate(() => ({ display: getComputedStyle(document.querySelector('#bee-fly')).display, legs: document.querySelector('#bee-fly').getAnimations().length })), (v) => v.display === 'none' && v.legs === 0, 8000);
  await p.click('#season-switch button[data-season="spring"]');
  await until(p, () => document.documentElement.dataset.season === 'spring' && document.querySelectorAll('#field [data-pick]').length > 5, null, 30000); await realWait(800);
  f = await farFollows(p);
  ck(`${kind}: back to spring: it follows`, f.ok, told(f));

  // the window made smaller while the pointer rests beyond the new right edge of the hero (the page still has the pointer's last place): the creature comes to the edge, inside, not out of sight
  f = await follows(p, 1100, 400);
  ck(`${kind}: (it is at the pointer, on the right of the big window)`, f.ok, told(f));
  await hold(p, 1100, 400);
  await p.setViewportSize({ width: 820, height: 700 });
  await soon(ck, `${kind}: the window made 820 px wide while the pointer rests at x 1100: the ${kind} comes to the right edge of the hero, inside it`, () => p.evaluate(() => { const r = document.querySelector('#bee-fly').getBoundingClientRect(), h = document.querySelector('#top').getBoundingClientRect(); return { cx: Math.round(r.x - h.x + r.width / 2), cy: Math.round(r.y - h.y + r.height / 2), w: Math.round(h.width), h: Math.round(h.height) }; }), (v) => v.cx <= v.w + 1 && v.cx >= v.w - 60 && v.cy >= 0 && v.cy <= v.h, 8000);
  await release(p);
  await p.setViewportSize(DESK); await realWait(500);
  // a creature that is PARKED (Pause) beyond the new right edge is put back inside it at once: the hero hides what lies outside, and a parked creature does not move again by itself
  f = await follows(p, 1100, 400);
  await p.evaluate((sel) => document.querySelector(sel).click(), PAUSE);
  await soon(ck, `${kind}: (Pause: no flight is running)`, () => legsOf(p), (n) => n === 0, 6000);
  const right = await centre(p);
  await p.setViewportSize({ width: 820, height: 700 });
  await soon(ck, `${kind}: parked at x ${Math.round(right[0])}, the window is made 820 px wide: the ${kind} is put back inside the hero (it used to be left outside, hidden)`, () => p.evaluate(() => { const r = document.querySelector('#bee-fly').getBoundingClientRect(), h = document.querySelector('#top').getBoundingClientRect(); return { cx: Math.round(r.x - h.x + r.width / 2), cy: Math.round(r.y - h.y + r.height / 2), w: Math.round(h.width), h: Math.round(h.height) }; }), (v) => right[0] > v.w + 40 && v.cx <= v.w + 1 && v.cx > 0 && v.cy >= 0 && v.cy <= v.h, 6000);
  s = await stays(p, 800);
  ck(`${kind}: ...and it stays there, parked (moved ${s.moved} px, flights ${s.legs})`, s.still && s.legs === 0, JSON.stringify(s));
  await p.setViewportSize(DESK); await realWait(500);
  await p.evaluate((sel) => document.querySelector(sel).click(), PAUSE);   // Play
  ck(`${kind}: ...Play, the big window again: data-calm is gone`, (await calmOf(p)) === null);
  await p.setViewportSize({ width: 820, height: 700 }); await realWait(700);
  await p.setViewportSize(DESK); await realWait(900);
  f = await farFollows(p);
  ck(`${kind}: the window made smaller and bigger again: it follows`, f.ok, told(f));

  // ---- 5. it settles beside the hero's buttons and cards, not on them (the pointer rests on each one in turn); a pointer that comes in over a button or over a drawn friend
  const spots = await p.evaluate(() => {
    const out = [];
    for (const [sel, label] of [['#season-switch button', 'a season button'], ['.hero-cta a', 'Reserve'], ['.hero-cta a ~ a', 'See what\'s in season'], ['.hero-note a', 'GreenHouse link'], ['#pick-btn', 'Pick'], ['.picker .motion-btn', 'Pause']]) {
      const e = [...document.querySelectorAll(sel)].find((n) => n.getClientRects().length); if (!e) continue;
      const r = e.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
      if (y > 0 && y < innerHeight && x > 0 && x < innerWidth) out.push({ label, x, y });
    }
    return out;
  });
  const covered = [];
  for (const t of spots) {
    await p.mouse.move(t.x, t.y, { steps: 8 });
    const want = await inHero(p, t.x, t.y), r = await settlesNear(p, want);
    if (!r.ok) covered.push(`${t.label}: it did not come to rest near the pointer (last seen at ${r.c.map(Math.round)}, the pointer at ${want.map(Math.round)})`);
    else if (onAny(r.c, keep)) covered.push(`${t.label}: it sits on a button at ${r.c.map(Math.round)}`);
  }
  ck(`${kind}: with the pointer resting on each of ${spots.length} buttons (${spots.map((t) => t.label).join(', ')}) it settles beside the button, close to the pointer, never on it`, spots.length >= 5 && covered.length === 0, covered.join('; '));
  await p.mouse.move(700, 40); await realWait(400);
  const btn = await p.evaluate(() => { const r = document.querySelector('.hero-cta a').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await p.mouse.move(btn[0], btn[1], { steps: 12 });
  const cb = await settlesNear(p, await inHero(p, btn[0], btn[1]));
  ck(`${kind}: a pointer that comes in over the big Reserve button: the ${kind} settles next to it, not on it`, cb.ok && !onAny(cb.c, keep), JSON.stringify(cb));
  const friend = await p.evaluate(() => { for (const e of document.querySelectorAll('#field [data-pick], .scene-hit, .tree-pick')) { const r = e.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2; if (y > 150 && y < innerHeight - 60 && x > 20 && x < innerWidth - 20) { const t = document.elementFromPoint(x, y); if (t && (t === e || e.contains(t))) return [x, y]; } } return null; });
  ck(`${kind}: (there is a drawn friend to point at)`, !!friend);
  if (friend) {
    await p.mouse.move(700, 40); await realWait(300);
    f = await follows(p, friend[0], friend[1]);
    ck(`${kind}: a pointer that comes in over a drawn friend (a berry): it follows`, f.ok, told(f));
  }

  // ---- 6. a long pause of the page's clock: it parks where it is DRAWN (in one turn of the page: where it is drawn, then the tab is hidden, then where it is)
  f = await farFollows(p);
  await p.clock.fastForward(60000); await realWait(200);
  const park = await p.evaluate(() => {
    const el = document.querySelector('#bee-fly'), at = () => { const m = new DOMMatrixReadOnly(getComputedStyle(el).transform); return [Math.round(m.m41 * 10) / 10, Math.round(m.m42 * 10) / 10]; };
    const before = at(), flying = el.getAnimations().length;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange'));
    return { before, after: at(), flying, flightsAfter: el.getAnimations().length };
  });
  ck(`${kind}: after a long pause of the page's clock it parks where it is drawn (moved ${r1(dist(park.before, park.after))} px), not where a clock says it should be`, park.flying > 0 && park.flightsAfter === 0 && dist(park.before, park.after) < 2, JSON.stringify(park));
  await hidden(p, false); await realWait(400);
  f = await farFollows(p);
  ck(`${kind}: ...and it follows again`, f.ok, told(f));

  // ---- 7. the change of kind: it flies out of a side edge of the hero, the other kind comes back from the same edge, and follows
  const hook = await p.evaluate(() => ({ kind: window.WISE_ACRES.critter.kind, w: document.querySelector('#top').clientWidth, changeIn: window.WISE_ACRES.critter.changeIn }));
  ck(`${kind}: the hook says which kind it is (WISE_ACRES.critter.kind) and that it never changes by itself (changeIn ${hook.changeIn})`, hook.kind === kind && hook.changeIn === Infinity);
  const nLegs = (await legsLog(p)).length, c0 = await centre(p), side = c0[0] < hook.w / 2 ? 'left' : 'right';
  await p.evaluate(() => window.WISE_ACRES.critter.swap());
  const out = await soon(ck, `${kind}: the change starts by flying out over the ${side} edge of the hero (the nearer one)`, () => centre(p), (c) => (side === 'left' ? c[0] < -10 : c[0] > hook.w + 10), 20000);
  const flipped = await soon(ck, `${kind}: ...and when it is out of sight the other kind comes back`, () => kindOf(p), (k) => k === (kind === 'bee' ? 'butterfly' : 'bee'), 20000);
  if (out && flipped) {
    const after = (await legsLog(p)).slice(nLegs).map(legOf).filter(Boolean);
    const inFlight = after.find((l) => l.kind !== kind);   // the first leg of the other kind
    ck(`${kind}: ...flying in from the same edge (its first leg begins beyond the ${side} edge, at x ${inFlight ? Math.round(inFlight.x0) : '?'})`, !!inFlight && (side === 'left' ? inFlight.x0 < -40 : inFlight.x0 > hook.w + 20), JSON.stringify(inFlight));
    await soon(ck, `${kind}: ...and comes inside the hero`, () => centre(p), (c) => c[0] > 20 && c[0] < hook.w - 20, 20000);
    await realWait(600);
    f = await farFollows(p);
    ck(`${kind}: ...and then it follows the pointer, as the other kind`, f.ok, told(f));
    // "Pause animations" the moment the change of kind starts (one turn of the page: the creature has not moved yet, it is in sight): it stays where it is, as what it is, and the change waits
    // (it used to be put at the edge in the other kind: a jump from the middle of the sky to x 12)
    const k1 = await kindOf(p);
    const still = await p.evaluate((sel) => {
      const el = document.querySelector('#bee-fly'), hero = document.querySelector('#top');
      const mid = () => { const r = el.getBoundingClientRect(), h = hero.getBoundingClientRect(); return [r.x - h.x + r.width / 2, r.y - h.y + r.height / 2]; };
      const before = mid(), was = el.dataset.kind;
      window.WISE_ACRES.critter.swap();
      document.querySelector(sel).click();
      return { before, after: mid(), was, now: el.dataset.kind, legs: el.getAnimations().length, w: hero.clientWidth, calm: document.documentElement.getAttribute('data-calm') };
    }, PAUSE);
    ck(`${kind}: "Pause animations" just as the change of kind starts (it is still in sight): it stays where it is (moved ${r1(dist(still.before, still.after))} px, from x ${Math.round(still.before[0])}), as a ${still.was}, nothing flies`, still.calm === 'all' && still.now === still.was && still.was === k1 && still.legs === 0 && dist(still.before, still.after) < 2 && still.after[0] > 0 && still.after[0] < still.w, JSON.stringify(still));
    s = await stays(p, 1000);
    ck(`${kind}: ...and it stays there (moved ${s.moved} px)`, s.still && s.legs === 0, JSON.stringify(s));
    await p.evaluate((sel) => document.querySelector(sel).click(), PAUSE);   // Play
    f = await farFollows(p);
    ck(`${kind}: ...Play: it follows the pointer, still a ${k1}`, f.ok && (await kindOf(p)) === k1, told(f));
    // ... when it is already out of sight, changing kind, Pause brings it back at once as the other kind, parked inside the hero (a creature outside the hero would never be seen again)
    const gone = await p.evaluate((sel) => new Promise((resolve) => {
      const el = document.querySelector('#bee-fly'), hero = document.querySelector('#top'), was = el.dataset.kind, t0 = performance.now();
      window.WISE_ACRES.critter.swap();
      const iv = setInterval(() => {
        const r = el.getBoundingClientRect(), h = hero.getBoundingClientRect(), out = r.right <= h.left + 6 || r.left >= h.right - 6;   // (fewer than 8 px of its box inside the hero: out of sight, by the page's own rule)
        if (el.dataset.kind !== was) { clearInterval(iv); resolve({ missed: true, was, now: el.dataset.kind }); return; }   // it was back before this looked: nothing to judge
        if (out || performance.now() - t0 > 25000) {
          clearInterval(iv); document.querySelector(sel).click();
          const r2 = el.getBoundingClientRect(), h2 = hero.getBoundingClientRect();
          resolve({ out, was, now: el.dataset.kind, x: Math.round(r2.x - h2.x), legs: el.getAnimations().length, w: Math.round(h2.width), calm: document.documentElement.getAttribute('data-calm') });
        }
      }, 16);
    }), PAUSE);
    if (gone.missed) info(`${kind}: the change of kind was over before it could be looked at while out of sight (too busy to judge Pause while it is away)`);
    else ck(`${kind}: "Pause animations" while it is out of sight changing kind: it is back at once, in the other kind, parked inside the hero (x ${gone.x} of ${gone.w})`, gone.out && gone.calm === 'all' && gone.now !== gone.was && gone.legs === 0 && gone.x > -10 && gone.x < gone.w, JSON.stringify(gone));
    s = await stays(p, 800);
    ck(`${kind}: ...and it stays there, parked (moved ${s.moved} px)`, s.still && s.legs === 0, JSON.stringify(s));
    await p.evaluate((sel) => document.querySelector(sel).click(), PAUSE);   // Play
    f = await farFollows(p);
    ck(`${kind}: ...Play: it follows the pointer`, f.ok, told(f));
  }

  // ---- 8. all the legs this page started: short, straight, transform only, not faster than the kind, and every one has its start time at once
  const legs = legChecks(await legsLog(p), kind);
  ck(`${kind}: ${legs.n} legs in all: each is one straight leg of the transform only, linear, 60 to ${LEG_MS} ms long`, legs.n > 20 && legs.bad.shape.length === 0, said(legs.bad.shape) || `${legs.n} legs`);
  ck(`${kind}: ...none goes faster than ${FAST[kind]} px per second`, legs.bad.speed.length === 0, said(legs.bad.speed));
  ck(`${kind}: ...every leg has its start time at once (it never waits for a drawn frame: on a slow computer it jumped back and forth)`, legs.bad.start.length === 0, said(legs.bad.start));
  await p.context().close();
}

/* ---------------------------------------------------------------- one kind, on a page of its own: how smoothly it moves */
async function smoothness(browser, base, errs, kind, ck) {
  const p = await open(browser, base, 'index.html', errs, { viewport: DESK, query: 'critter=' + kind, routes: async (pg) => { await pg.addInitScript(LEG_LOG); } });
  await seen(p);
  const keep = await keepRects(p), geo = await freeCircle(p), [ox, oy] = await p.evaluate(() => { const h = document.querySelector('#top').getBoundingClientRect(); return [h.x, h.y]; });
  const heroW = keep.hero[0], heroH = keep.hero[1], half = [keep.w / 2, keep.h / 2];
  const middle = (x, y) => [x, y - 24 + keep.h / 2];   // where the middle of the creature's box is when the pointer rests at (x, y) (hero coordinates): its corner is 26 px left of and 24 px above the pointer
  const gapsOf = (legs) => legs.slice(1).map((l, i) => l.st - legs[i].st).filter((g) => g < 20000);   // how far apart in time the legs began (about 100 ms when the computer keeps up)
  // A computer that is far too busy runs the page's timers late (a leg every second instead of ten a second): what is asked of the timing then cannot be judged. Those checks say so
  // (and are left out) when the legs of that part began, in the middle, more than 300 ms apart; what does not depend on the timing (the legs themselves, the biggest step) is always asked.
  const judging = (legs, what) => {
    const gap = pct(gapsOf(legs), 0.5), busy = legs.length > 1 && gap > 300;
    if (busy) info(`${kind}: ${what}: the legs began ${Math.round(gap)} ms apart (about 100 when the computer keeps up): too busy to judge the timing of this part`);
    return (name, cond, detail) => (busy ? true : ck(name, cond, detail));
  };
  const arm = () => p.evaluate(() => { window.__mv = null; document.querySelector('#top').addEventListener('pointermove', () => { if (window.__mv === null) window.__mv = document.timeline.currentTime; }, { once: true }); });   // the moment the first pointer event of a trip arrives
  const movedAt = () => p.evaluate(() => window.__mv);
  // the pointer goes to (x, y) (hero coordinates of the creature's spot: window x, hero y) and stays; waits until the creature has settled there
  const goTo = async (x) => {
    await release(p); await arm();
    await p.mouse.move(x, geo.cy + oy);   // one pointer event: the pointer is at once where it will rest (the creature goes for the pointer where it is now)
    await hold(p, x, geo.cy + oy);
    const r = await settlesNear(p, middle(x - ox, geo.cy), { near: 14, limit: 25000 });
    return { from: await movedAt(), to: r.t, ok: r.ok, at: r.c };
  };

  // ---- the turn, the speed and the sway: the pointer goes far right (the creature settles there, facing right), far left (it turns round) and far right again (it turns round again).
  await recStart(p);
  const first = await goTo(1100), toLeft = await goTo(300), toRight = await goTo(1100);
  await release(p);
  const checks = await recStop(p), legs = (await legsLog(p)).map(legOf).filter(Boolean);
  ck(`${kind}: the pointer goes far to the right, to the left and to the right again: the ${kind} follows each time and comes to rest at the pointer`, first.ok && toLeft.ok && toRight.ok, JSON.stringify([first, toLeft, toRight]));
  const wayLegs = legs.filter((l) => l.st >= toRight.from && l.st <= toRight.to), turnLegs = legs.filter((l) => l.st >= toLeft.from && l.st <= toRight.to), tripJudge = judging(turnLegs, 'the way across');
  const wayRows = modelRows(legs, toRight.from, toRight.to, half);
  // the way across (the last trip, to the right): it goes the faster the farther the spot, and slows down as it nears
  const tgtTL = [1100 - ox - 26, geo.cy - 24];
  const pts = wayLegs.map((l) => ({ d: dist([l.x0, l.y0], tgtTL), v: l.len / (l.ms / 1000) }));
  const far = pts.filter((q) => q.d > 500), near = pts.filter((q) => q.d < 40);
  ck(`${kind}: it goes the faster the farther the spot is: from over 500 px away it flies at ${far.length ? Math.round(far[0].v) : '-'} px per second (a ${kind}: up to ${FAST[kind]})`, far.length > 0 && far[0].v >= FAST[kind] * 0.9 && far[0].v <= FAST[kind] * 1.04, JSON.stringify(pts.slice(0, 3)));
  tripJudge(`${kind}: ...and slows down as it nears (under 40 px away it goes at most ${Math.round(FAST[kind] * 0.35)} px per second; the fastest of those ${near.length ? Math.round(Math.max(...near.map((q) => q.v))) : '-'})`, near.length > 0 && Math.max(...near.map((q) => q.v)) <= FAST[kind] * 0.35, JSON.stringify(near.slice(0, 3)));
  let ordered = true;
  for (const a of pts) for (const b of pts) if (a.d >= b.d * 1.5 && a.v < b.v * 0.88 - 3) ordered = false;
  ck(`${kind}: ...and the speed never goes up as the spot gets nearer (a leg from farther away is never slower than one from nearer)`, ordered, JSON.stringify(pts.map((q) => [Math.round(q.d), Math.round(q.v)])));
  // seen from above: a bee goes straight, a butterfly sways a little to the sides (how far its way is off the straight line between where it began and where it ended)
  let off = -1;
  if (wayRows.length > 3) {
    const a = wayRows[0], z = wayRows[wayRows.length - 1], len = Math.hypot(z[1] - a[1], z[2] - a[2]) || 1;
    off = Math.max(...wayRows.map((r) => Math.abs((z[1] - a[1]) * (a[2] - r[2]) - (a[1] - r[1]) * (z[2] - a[2])) / len));
  }
  if (kind === 'bee') ck(`bee: it flies straight (its way across the sky is at most ${r1(off)} px off the straight line)`, wayRows.length > 3 && off <= 4, `${wayRows.length} points`);
  else tripJudge(`butterfly: it sways a little to the sides on its way (at most ${r1(off)} px off the straight line: not a straight line, not wild)`, wayRows.length > 3 && off >= 2.5 && off <= 40, `${wayRows.length} points`);
  // the turn: leg by leg, and as the legs draw it (every 30 ms)
  if (kind === 'bee') {
    const flips = turnLegs.filter((l) => l.f0 !== null), fast = flips.filter((l) => Math.abs(l.f1 - l.f0) / l.ms > 2 / 100), mid = flips.filter((l) => Math.abs(l.f0) < 0.9);
    ck(`bee: it turns round smoothly: no leg flips it in under 100 ms (${fast.length} do), and it turns both ways`, flips.some((l) => l.f0 > 0.9 && l.f1 < -0.9) && flips.some((l) => l.f0 < -0.9 && l.f1 > 0.9) && fast.length === 0, JSON.stringify(flips.slice(0, 8).map((l) => [l.f0, l.f1, l.ms])));
    tripJudge(`bee: ...a turn goes through the numbers between 1 and -1 over several legs (${mid.length} legs begin part-way through a turn)`, mid.length >= 2, JSON.stringify(flips.slice(0, 8).map((l) => [l.f0, l.f1, l.ms])));
    const turn = modelRows(legs, toLeft.from, toLeft.from + 2000, half), i0 = turn.findIndex((r) => r[3] < 0.95), i1 = i0 < 0 ? -1 : turn.findIndex((r, i) => i >= i0 && r[3] < -0.95);
    if (i0 > 0 && i1 > i0) {
      const part = turn.slice(i0 - 1, i1 + 1), mids = part.filter((r) => Math.abs(r[3]) < 0.9).length, took = part[part.length - 1][0] - part[0][0];
      let back = 0; for (let i = 1; i < part.length; i++) if (part[i][3] > part[i - 1][3] + 0.03) back++;
      ck(`bee: ...drawn every 30 ms, the turn from facing right to facing left takes ${Math.round(took)} ms (at least 100), ${mids} of the pictures show it half-turned, and it never turns back part-way`, took >= 100 && mids >= 3 && back === 0, JSON.stringify(part.map((r) => +r[3].toFixed(2))));
    } else ck('bee: ...the turn from facing right to facing left can be found', false, JSON.stringify(turn.slice(0, 12).map((r) => +r[3].toFixed(2))));
  } else {
    const lean = turnLegs.filter((l) => l.r0 !== null), right = lean.filter((l) => l.x1 - l.x0 > 25), left = lean.filter((l) => l.x1 - l.x0 < -25);
    const wild = lean.filter((l) => Math.abs(l.r1) > 18.01 || Math.abs(l.r0) > 18.01 || Math.abs(l.r1 - l.r0) / l.ms > 36 / 100);
    ck(`butterfly: it never leans more than 18 degrees, and the lean changes gently (${wild.length} legs break this)`, lean.length > 3 && wild.length === 0, JSON.stringify(wild.slice(0, 3).map((l) => [l.r0, l.r1, l.ms])));
    ck(`butterfly: it leans towards the way it goes (${right.length} legs to the right, all leaning right; ${left.length} to the left, all leaning left)`, right.length > 1 && left.length > 1 && right.every((l) => l.r1 > 2) && left.every((l) => l.r1 < -2), JSON.stringify(lean.slice(0, 5).map((l) => [l.r0, l.r1])));
  }

  // ---- the circle: the pointer goes round a smooth circle for 6 s (a circle in the free band of the hero: it never crosses a button)
  await release(p); await p.mouse.move(geo.cx + geo.R + ox, geo.cy + oy, { steps: 6 });
  await hold(p, geo.cx + geo.R + ox, geo.cy + oy);
  await settlesNear(p, middle(geo.cx + geo.R, geo.cy), { near: 14, limit: 25000 });
  await release(p);
  const c0 = (await legsLog(p)).length;
  const run = await circle(p, { cx: geo.cx + ox, cy: geo.cy + oy, R: geo.R }, 6);
  const c1 = (await legsLog(p)).length;
  // ---- ...and then the pointer rests where it stopped, for 20 s: the creature settles, wanders, stays in the hero, never stands still for long
  await realWait(20000);
  const proof = await recStop(p), allRaw = await legsLog(p), all = allRaw.map(legOf).filter(Boolean);
  const circleRaw = allRaw.slice(c0, c1), circleLegs = circleRaw.map(legOf).filter(Boolean), restLegs = allRaw.slice(c1).map(legOf).filter(Boolean);
  const ring = modelRows(all, run.from, run.to, half), rest = modelRows(all, run.to + 1, all[all.length - 1].st + all[all.length - 1].ms, half);
  const pointerAt = (t) => { const a = Math.min(1, Math.max(0, (t - run.from) / 6000)) * Math.PI * 2; return middle(geo.cx + geo.R * Math.cos(a), geo.cy + geo.R * Math.sin(a)); };
  const circleGap = pct(gapsOf(circleLegs), 0.5), roundJudge = judging(circleLegs, 'the circle');
  info(`${kind}: the circle: ${run.moves} pointer moves, ${circleRaw.length} legs; the rest: ${restLegs.length} legs in ${r1((rest[rest.length - 1][0] - run.to) / 1000)} s`);

  // the browser draws what the legs say (what it says about the box, a few times a second, against the way the legs go)
  const worst = proof.map((r) => { const m = modelAt(all, r[0], half); return m ? { at: Math.round(r[0] - all[0].st), px: Math.hypot(r[1] - m[0], r[2] - m[1]), turn: Math.abs(r[3] - m[2]) } : { px: 0, turn: 0 }; });
  const off1 = worst.reduce((m, w) => (w.px > m.px ? w : m), { px: 0 }), off2 = Math.max(0, ...worst.map((w) => w.turn));
  ck(`${kind}: the browser draws what the legs say (${proof.length} looks in all: at worst ${r1(off1.px)} px away from where the legs put it, its turn ${r1(off2)} off)`, proof.length > 20 && off1.px < 3 && off2 < 0.08, JSON.stringify(off1));

  const stepsOf = (rs) => rs.slice(1).map((r, i) => ({ dt: r[0] - rs[i][0], dx: r[1] - rs[i][1], dy: r[2] - rs[i][2], d: Math.hypot(r[1] - rs[i][1], r[2] - rs[i][2]), t: r[0] })).filter((s) => s.dt > 0.5);
  const st = stepsOf(ring), jumps = st.filter((s) => s.d > FAST[kind] * (s.dt / 1000) * 1.5 + 12), big = st.reduce((m, s) => (s.d > m.d ? s : m), { d: 0, dt: 0 });
  ck(`${kind}: the pointer goes round a circle: no step of the ${kind} is bigger than it could fly in that time (the biggest: ${r1(big.d)} px in ${r1(big.dt)} ms; ${jumps.length} too big)`, st.length > 100 && jumps.length === 0, JSON.stringify(jumps.slice(0, 3)));
  let back = 0, pairs = 0, way = 0;
  for (let i = 0; i < st.length; i++) { way += st[i].d; if (i && st[i].d > 1 && st[i - 1].d > 1) { pairs++; if (st[i].dx * st[i - 1].dx + st[i].dy * st[i - 1].dy < 0) back++; } }
  const ideal = 2 * Math.PI * geo.R;
  ck(`${kind}: ...it goes round with the pointer without a step back (${back} of ${pairs} pairs of steps turn back)`, back <= 1, `${back}/${pairs}`);
  roundJudge(`${kind}: ...and without wasted ways (${Math.round(way)} px for a circle of ${Math.round(ideal)})`, way >= ideal * 0.5 && way <= ideal * 1.6 + 80, `${Math.round(way)}`);
  const lag = ring.filter((r) => r[0] - run.from > 2000).map((r) => dist([r[1], r[2]], pointerAt(r[0])));
  const slack = FAST[kind] * circleGap / 1000 * 0.5;   // a page that is late falls behind the pointer by about this much
  ck(`${kind}: ...and it keeps company with the pointer (usually ${Math.round(pct(lag, 0.5))} px from it, at worst ${Math.round(pct(lag, 0.95))} px)`, lag.length > 20 && pct(lag, 0.5) <= 160 + slack && pct(lag, 0.95) <= 300 + slack, `${Math.round(pct(lag, 0.5))} / ${Math.round(pct(lag, 0.95))}`);
  const cl = legChecks(circleRaw, kind, { joins: true });
  const secs = circleRaw.length > 1 ? (circleRaw[circleRaw.length - 1].startTime - circleRaw[0].startTime) / 1000 : 0, rate = secs > 0 ? (circleRaw.length - 1) / secs : 0;
  ck(`${kind}: the legs of the circle (${cl.n}) are short and straight, at the speed of the kind, each with its start time at once, no more than ten a second (${r1(rate)})`, cl.n > 3 && rate <= 13 && cl.bad.shape.length + cl.bad.speed.length + cl.bad.start.length === 0, said([...cl.bad.shape, ...cl.bad.speed, ...cl.bad.start]) || `${r1(rate)} a second`);
  roundJudge(`${kind}: ...about ten a second when the computer keeps up (${r1(rate)}; a timer that is late by a few ms makes it 8)`, rate >= 6, `${r1(rate)} a second`);
  ck(`${kind}: ...and every leg begins exactly where the one before it had got to (no joins in the path)`, cl.bad.join.length === 0, said(cl.bad.join));

  // after the circle the pointer rests where it stopped
  const restJudge = judging(restLegs, 'the rest'), lateness = Math.max(0, ...gapsOf(restLegs));   // lateness: the longest wait between two legs
  const stopAt = middle(geo.cx + geo.R, geo.cy);
  restJudge(`${kind}: the pointer stops: within 5 s the ${kind} is next to it (within 60 px)`, rest.filter((r) => r[0] - run.to < 5000).some((r) => dist([r[1], r[2]], stopAt) <= 60));
  const away = Math.max(0, ...rest.filter((r) => r[0] - run.to > 2500).map((r) => dist([r[1], r[2]], stopAt)));
  restJudge(`${kind}: ...and after 2.5 s without a pointer it starts to stroll (it went ${Math.round(away)} px away)`, away >= 60);
  const xs = rest.map((r) => r[1]), ys2 = rest.map((r) => r[2]);
  ck(`${kind}: while it strolls it stays inside the hero (x ${Math.round(Math.min(...xs))} to ${Math.round(Math.max(...xs))} of ${Math.round(heroW)}, y ${Math.round(Math.min(...ys2))} to ${Math.round(Math.max(...ys2))} of ${Math.round(heroH)})`, Math.min(...xs) > -3 && Math.max(...xs) < heroW + 3 && Math.min(...ys2) > -3 && Math.max(...ys2) < heroH + 3);
  let longest = 0, a = 0;   // never still for long: the longest time it stayed within 2 px of one place
  for (let b = 1; b < rest.length; b++) { while (dist([rest[a][1], rest[a][2]], [rest[b][1], rest[b][2]]) > 2) a++; longest = Math.max(longest, rest[b][0] - rest[a][0]); }
  ck(`${kind}: ...and it never stands still for long (the longest time in one place: ${r1(longest / 1000)} s of ${r1((rest[rest.length - 1][0] - rest[0][0]) / 1000)}; at most 7 s, and more only as far as the page itself was late: ${r1(lateness / 1000)} s)`, longest <= 7000 + lateness, `${Math.round(longest)} ms`);
  const win = []; a = 0;   // how fast it strolls: over windows of about 150 ms, once it has left the pointer
  for (let b = 1; b < rest.length; b++) { while (rest[b][0] - rest[a][0] > 200) a++; if (rest[b][0] - run.to > 3500 && rest[b][0] - rest[a][0] >= 120) win.push(dist([rest[a][1], rest[a][2]], [rest[b][1], rest[b][2]]) / (rest[b][0] - rest[a][0]) * 1000); }
  const fastest = win.length ? Math.max(...win) : 0;
  ck(`${kind}: ...it strolls slowly (at most ${Math.round(fastest)} px per second; a ${kind}: up to ${STROLL[kind]})`, win.length > 20 && fastest <= STROLL[kind] * 1.25 + 15, `${win.length} windows`);
  let path = 0; for (let i = 1; i < rest.length; i++) path += dist([rest[i][1], rest[i][2]], [rest[i - 1][1], rest[i - 1][2]]);
  restJudge(`${kind}: ...it really goes places (${Math.round(path)} px in all)`, path >= 150);
  const resting = []; a = 0;   // where it rests (it has not moved 1 px for 1.2 s) it is beside the hero's buttons, not on them
  for (let b = 1; b < rest.length; b++) { while (rest[b][0] - rest[a][0] > 1200) a++; if (rest[b][0] - rest[a][0] >= 1150 && dist([rest[a][1], rest[a][2]], [rest[b][1], rest[b][2]]) < 1) resting.push([rest[b][1], rest[b][2]]); }
  const onBtn = resting.filter((c) => onAny(c, keep));
  restJudge(`${kind}: ...and where it rests (${resting.length} pictures) it is never on a button or a card`, onBtn.length === 0 && resting.length > 0, JSON.stringify(onBtn.slice(0, 2)));
  const sl = legChecks(allRaw.slice(c1), kind, { joins: true }), bads = [...sl.bad.shape, ...sl.bad.speed, ...sl.bad.start, ...sl.bad.join];
  ck(`${kind}: ...its legs are as short and straight as the rest, each starts at once and where the one before it had got to (${sl.n} legs)`, sl.n > 2 && bads.length === 0, said(bads));
  await p.context().close();
}

/* ---------------------------------------------------------------- the rest: reduce motion, a phone, the schedule of the change of kind */
async function guests(browser, base, errs, kind, ck) {
  const q = 'critter=' + kind;
  const r = await open(browser, base, 'index.html', errs, { viewport: DESK, query: q, reducedMotion: 'reduce' });
  const rv = await r.evaluate(() => ({ display: getComputedStyle(document.querySelector('#bee-fly')).display, hidden: document.querySelector('#bee-fly').hidden, loops: document.getAnimations().filter((a) => a.playState === 'running' && a.effect.getTiming().iterations === Infinity && document.querySelector('#bee-fly').contains(a.effect.target)).length, legs: document.querySelector('#bee-fly').getAnimations().length }));
  ck(`${kind}: with "reduce motion" it is not shown, nothing of it moves`, rv.display === 'none' && rv.hidden && rv.loops === 0 && rv.legs === 0, JSON.stringify(rv));
  await r.context().close();

  const ph = await open(browser, base, 'index.html', errs, { viewport: { width: 390, height: 844 }, touch: true, query: q });
  await seen(ph);
  const tap = (x, y) => ph.evaluate(([x, y]) => document.querySelector('#top').dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, bubbles: true, pointerType: 'touch' })), [x, y]);   // a touch on the hero, without a click that would follow a link
  const heroTop = await ph.evaluate(() => { const r = document.querySelector('#top').getBoundingClientRect(); return [r.x, r.y]; });
  const keep = await keepRects(ph), hits = [];
  for (const [x, y] of [[300, heroTop[1] + 300], [80, heroTop[1] + 250], [200, heroTop[1] + 120]]) {
    await tap(x, y);
    const want = [x - heroTop[0], y - heroTop[1]], end = Date.now() + ms(15000);
    let at = await centre(ph);
    while (dist(at, want) > 60 && Date.now() < end) { await realWait(80); at = await centre(ph); }
    hits.push(dist(at, want) <= 60);
  }
  const flow = await ph.evaluate(() => ({ wide: document.documentElement.scrollWidth - document.documentElement.clientWidth, pe: getComputedStyle(document.querySelector('#bee-fly')).pointerEvents, vis: document.querySelector('#bee-fly').checkVisibility() }));
  ck(`${kind}: on a phone 390 px wide a touch sends it to the finger (${hits.filter(Boolean).length} of 3), it never catches a touch, and the page does not scroll sideways`, hits.every(Boolean) && flow.pe === 'none' && flow.wide <= 0 && flow.vis, JSON.stringify([hits, flow]));
  const b = await ph.evaluate(() => { const r = document.querySelector('.hero-cta a').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await tap(b[0], b[1]);
  const cb = await settlesNear(ph, [b[0] - heroTop[0], b[1] - heroTop[1]]);
  ck(`${kind}: on the phone, a touch on the big Reserve button: it settles next to it, not on it`, cb.ok && !onAny(cb.c, keep), JSON.stringify(cb));
  await ph.context().close();
}

/* ---------------------------------------------------------------- a busy page: a computer that draws a frame only now and then */
// The page is made busy the way a slow phone is: every frame it draws costs 90 ms of its own turn. A leg that waits for the next DRAWN frame to start is then not started when the next look comes
// (the look found it "not started", threw it away and began again, and the creature stood still or went back); the creature must still glide to the pointer, never go back, and a change of kind must end.
// With { nostart: true } the browser takes no start time for an animation (the fallback of the page: it asks the leg how far it is, and waits for a leg that is not drawn yet).
async function busy(browser, base, errs, kind, ck, { nostart = false } = {}) {
  const tag = `${kind}, a busy page${nostart ? ' in a browser that takes no start time' : ''}`;
  const p = await open(browser, base, 'index.html', errs, { viewport: DESK, query: 'critter=' + kind, routes: async (pg) => {
    await pg.addInitScript(LEG_LOG); await pg.addInitScript(REAL_RAF);
    if (nostart) await pg.addInitScript(NO_START);
  } });
  await seen(p);
  const fps = await busyStart(p, 90);
  info(`${tag}: the page manages ${fps} frames a second`);
  const trips = [];
  for (const [x, y] of nostart ? [[1200, 520], [250, 420]] : [[1200, 520], [250, 420], [900, 300]]) {
    await tripStart(p, await inHero(p, x, y));
    const f = await follows(p, x, y, { limit: 25000, steps: 1 });   // (one pointer event: the spot is the same from the first look to the last, so any step away from it is the creature's own)
    trips.push({ f, back: regress(await tripStop(p)) });
  }
  ck(`${tag}: it flies to the pointer, ${trips.length} far spots one after the other (${trips.map((t) => t.f.ok ? t.f.secs.toFixed(1) + ' s' : 'NOT').join(', ')})`, trips.every((t) => t.f.ok), trips.map((t) => told(t.f)).join(' | '));
  const back = Math.max(...trips.map((t) => t.back));
  // (without a start time of its own a leg is read at the last drawn frame, which on a busy page is up to a tenth of a second behind: a small step back is all that is left of the old jumping)
  const most = nostart ? 70 : 25;
  ck(`${tag}: ...and on the way it never goes back (at worst ${Math.round(back)} px farther from the spot than it had been; at most ${most})`, back <= most, trips.map((t) => Math.round(t.back)).join(', '));
  const raw = await legsLog(p);
  if (nostart) ck(`${tag}: (the browser really took no start time: no leg had one at once)`, raw.length > 5 && raw.every((l) => l.pending === true), JSON.stringify(raw.slice(0, 2)));
  else {
    const legs = legChecks(raw, kind, { joins: true });
    ck(`${tag}: ...its ${legs.n} legs are short and straight, each has its start time at once and begins where the one before it had got to`, legs.n > 10 && legs.bad.shape.length + legs.bad.speed.length + legs.bad.start.length + legs.bad.join.length === 0, said([...legs.bad.shape, ...legs.bad.speed, ...legs.bad.start, ...legs.bad.join]) || `${legs.n} legs`);
  }
  if (!nostart) {   // a change of kind in a busy page ends, and the new kind flies to the pointer
    const was = await kindOf(p);
    await p.evaluate(() => window.WISE_ACRES.critter.swap());
    await soon(ck, `${tag}: a change of kind ends (the other kind is there)`, () => kindOf(p), (k) => k !== was, 30000);
    const f = await farFollows(p, { limit: 25000 });
    ck(`${tag}: ...and the new kind flies to the pointer`, f.ok, told(f));
  }
  await p.context().close();
}

/* ---------------------------------------------------------------- a change of kind that cannot get out */
// However it goes wrong, a change of kind ends (while it lasts the pointer is not followed): at the latest 12 s after it began, the other kind is there. The fault is made on purpose: the
// animation clock of the page stands still, so the creature can never tell that a leg has got anywhere and never reaches the edge of the hero. The pretend clock is held and moved by hand.
async function stuck(browser, base, errs, kind, ck) {
  const other = kind === 'bee' ? 'butterfly' : 'bee';
  const p = await open(browser, base, 'index.html', errs, { viewport: DESK, query: 'critter=' + kind });
  await seen(p);
  let f = await farFollows(p);
  ck(`${kind}: (it follows the pointer, before the change of kind that cannot get out)`, f.ok, told(f));
  await p.evaluate(() => {
    const c = document.timeline.currentTime;
    Object.defineProperty(document.timeline, 'currentTime', { configurable: true, get: () => c });   // the clock of the animations stands still
    window.WISE_ACRES.critter.swap();
  });
  await p.clock.pauseAt(new Date((await p.evaluate(() => Date.now())) + 1000));
  await p.clock.fastForward(4000);
  await realWait(300);
  ck(`${kind}: the change of kind starts but the creature cannot get out: 5 s on it is still a ${kind} (the change is given time to fly out)`, (await kindOf(p)) === kind, await kindOf(p));
  await p.clock.fastForward(8000);
  await soon(ck, `${kind}: ...13 s on the ${other} is there whatever went wrong (a change of kind can never stay stuck)`, () => kindOf(p), (k) => k === other, 6000);
  await p.evaluate(() => { delete document.timeline.currentTime; });
  await p.clock.resume();
  f = await farFollows(p);
  ck(`${kind}: ...and the ${other} follows the pointer (nothing of the change was left behind)`, f.ok, told(f));
  await p.context().close();
}

await run('critter', async ({ browser, base, errs }) => {
  const load = machine();
  info(`the computer's load while this test started: ${load.load.toFixed(1)} on ${load.cores} cores`);
  const t0 = Date.now();
  const plan = [];
  // (the rest of the guests, a busy page and a change of kind that cannot get out are run one after the other in one chain: a busy page uses a whole processor)
  const guestsAll = async (browser, base, errs, kind, ck) => {
    for (const [name, fn] of [['guests', guests], ['busy', busy], ['busy, no start time', (...a) => busy(...a, { nostart: true })], ['stuck', stuck]]) {
      try { await fn(browser, base, errs, kind, ck); } catch (e) { ck(`${kind}: ${name}: the test ran to the end`, false, String(e && e.stack ? e.stack.split('\n').slice(0, 3).join(' / ') : e)); }
    }
  };
  for (const kind of KINDS) for (const [name, fn] of [['behaviour', behaviour], ['smoothness', smoothness], ['guests', guestsAll]]) {
    plan.push((async () => {
      const c = chain();
      try { await fn(browser, base, errs, kind, c.ck); } catch (e) { c.ck(`${kind}: ${name}: the test ran to the end`, false, String(e && e.stack ? e.stack.split('\n').slice(0, 3).join(' / ') : e)); }
      return c;
    })());
  }
  // the change of kind by itself: every 45 to 75 seconds (the page's clock runs ahead; the Math.random of the page is held at one value to get the two ends), never when the address picks the kind
  const schedule = (async () => {
    const c = chain(), ck = c.ck;
    try {
      for (const [roll, kind, lo, hi] of [[0, 'bee', 45000, 45000], [0.9999, 'butterfly', 74900, 75000]]) {
        const p = await open(browser, base, 'index.html', errs, { viewport: DESK, routes: async (pg) => { await pg.addInitScript((v) => { Math.random = () => v; }, roll); } });
        await seen(p);
        const h = await p.evaluate(() => ({ kind: window.WISE_ACRES.critter.kind, due: window.WISE_ACRES.critter.changeIn + performance.now(), now: performance.now() }));
        ck(`with no address option the page picks at random when it loads: a roll of ${roll} gives a ${kind}`, h.kind === kind, h.kind);
        ck(`...and it changes kind by itself ${roll === 0 ? '45' : '75'} s after it started when the roll is ${roll === 0 ? '0' : 'nearly 1'} (45 to 75 s: due at ${Math.round(h.due)} ms; the page started within the first ${Math.round(h.now)} ms)`, h.due >= lo && h.due <= hi + h.now + 50, JSON.stringify(h));
        if (roll === 0) {
          await p.clock.fastForward(46500);
          const was = await kindOf(p);
          await soon(ck, '...and when the time has come it flies out and comes back as the other kind', () => kindOf(p), (k) => k !== was, 30000);
          const again = await p.evaluate(() => ({ due: window.WISE_ACRES.critter.changeIn + performance.now(), now: performance.now() }));
          ck('...and the next change is again 45 to 75 s away', again.due - again.now > 40000 && again.due - again.now <= 75000, JSON.stringify(again));
        }
        await p.context().close();
      }
      for (const kind of KINDS) {
        const p = await open(browser, base, 'index.html', errs, { viewport: DESK, query: 'critter=' + kind });
        await seen(p);
        await p.clock.runFor(130000);
        const v = await p.evaluate(() => ({ kind: window.WISE_ACRES.critter.kind, changeIn: window.WISE_ACRES.critter.changeIn, c: (() => { const r = document.querySelector('#bee-fly').getBoundingClientRect(), h = document.querySelector('#top').getBoundingClientRect(); return [Math.round(r.x - h.x), Math.round(r.y - h.y), Math.round(h.width)]; })() }));
        ck(`${kind}: the address picked the kind: it never changes by itself (130 s of page time), it does not fly out of the hero`, v.kind === kind && v.changeIn === Infinity && v.c[0] > -10 && v.c[0] < v.c[2], JSON.stringify(v));
        await p.context().close();
      }
      for (const [roll, want] of [[0.2, 'bee'], [0.8, 'butterfly']]) {   // the start is a coin toss (Math.random below one half: a bee; above: a butterfly)
        const p = await open(browser, base, 'index.html', errs, { viewport: DESK, routes: async (pg) => { await pg.addInitScript((v) => { Math.random = () => v; }, roll); } });
        ck(`with no address option the page picks at random when it loads: a roll of ${roll} gives a ${want}`, (await kindOf(p)) === want, await kindOf(p));
        await p.context().close();
      }
    } catch (e) { ck('the schedule: the test ran to the end', false, String(e && e.stack ? e.stack.split('\n').slice(0, 3).join(' / ') : e)); }
    return c;
  })();
  const all = await Promise.all([...plan, schedule]);
  all.forEach((c) => c.flush());
  info(`this test took ${Math.round((Date.now() - t0) / 1000)} s (the computer's load now: ${machine().load.toFixed(1)} on ${machine().cores} cores)`);
});
