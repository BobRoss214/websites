// order: 166
// browser: yes
// covers: js/main.js, css/*, index.html
/* What follows the pointer over the hero (js/main.js, initBee): a bee or a butterfly, chosen at random when the page loads and changed now and then. The test runs everything
 * once for each kind (?critter=bee, ?critter=butterfly: the address option only this page reads).
 * It keeps following after everything that used to freeze it or could stop it. The owner saw the bee freeze "sometimes, when it is following my mouse": the page's own
 * calm mode (data-calm="light", set by itself when the hero struggles on a slow computer) parked it for good, and nothing took the calm mode back. Here, every situation
 * is followed by a pointer move, and the creature must be sent to the pointer again (its newest flight leg ends where the pointer is; this is read from the animation, so a
 * busy computer that draws few frames does not matter): after Pause and Play, after the calm mode the page sets by itself (the real switch: a processor slowed down 6x, a
 * browser that is not run by a program, at 1440 x 900; the wings and bobbing rest, the flight does not), after data-calm "light" and "most", after scrolling away and back,
 * a hidden tab, winter and back, a resized window, a pointer that enters over a button or over a drawn friend, a flight that ended while the tab was hidden, and a long
 * pause. The visitor's own "Pause animations" (data-calm="all") still parks it where it was drawn. Also: the right drawing shows (the other does not), both are hidden from
 * screen readers and never catch a click, the wings flap (the butterfly's faster than the butterflies of the scene) and everything that moves is a transform (the compositor
 * runs it), a butterfly's legs are slower and curved (a middle keyframe off the straight line, the bend changes sides) and a bee's are straight, both settle next to the hero's
 * buttons and not on them, the change of kind (it flies out of the hero and comes back as the other one; by itself between 45 and 75 seconds, never when the address picks the
 * kind), "reduce motion" hides both, and a phone 390 px wide. The flight is still one compositor animation (nothing runs per frame). */
import { run, open, ok, okSoon, info, until, ms, machine } from './lib.mjs';

const DESK = { width: 1440, height: 900 };
const KINDS = ['bee', 'butterfly'];
const realWait = (t) => new Promise((r) => setTimeout(r, t));

// where the newest flight leg of the creature ends, in hero coordinates (null: no flight at all)
const goal = (p) => p.evaluate(() => {
  const a = document.querySelector('#bee-fly').getAnimations().filter((x) => x.effect && x.effect.getKeyframes);
  if (!a.length) return null;
  const k = a[a.length - 1].effect.getKeyframes(), m = /translate\(([-\d.]+)px, ([-\d.]+)px/.exec(k[k.length - 1].transform || '');
  return m ? [+m[1], +m[2]] : null;
});
const legs = (p) => p.evaluate(() => document.querySelector('#bee-fly').getAnimations().filter((x) => x.effect && x.effect.getKeyframes && !x.animationName).length);
const boxAt = (p) => p.evaluate(() => { const r = document.querySelector('#bee-fly').getBoundingClientRect(), h = document.querySelector('#top').getBoundingClientRect(); return [Math.round(r.x - h.x), Math.round(r.y - h.y)]; });
const wantFor = (p, x, y) => p.evaluate(([x, y]) => { const r = document.querySelector('#top').getBoundingClientRect(); return [x - r.x - 26, y - r.y - 24]; }, [x, y]);   // the box's top-left corner when its middle is on the pointer
const dist = (a, b) => (a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : Infinity);
const kindOf = (p) => p.evaluate(() => document.querySelector('#bee-fly').dataset.kind);
const calmOf = (p) => p.evaluate(() => document.documentElement.getAttribute('data-calm'));
// the answer of an IntersectionObserver comes with a drawn frame (late on a busy computer): ask the same question and wait for ours, which is delivered after the page's own
const seen = (p) => p.evaluate(() => new Promise((r) => { const io = new IntersectionObserver(() => { io.disconnect(); r(); }); io.observe(document.querySelector('#top')); }));
const hidden = (p, v) => p.evaluate((h) => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); document.dispatchEvent(new Event('visibilitychange')); }, v);

// Moves the pointer to (x, y) over the hero; waits (page time, a pretend clock) until the creature has been sent there. { ok, goal, want }
async function follows(p, x, y, { tries = 24, tol = 8 } = {}) {
  await p.mouse.move(x, y, { steps: 5 });
  const want = await wantFor(p, x, y);
  let g = null;
  for (let i = 0; i < tries; i++) {
    await p.clock.runFor(250); await realWait(20);
    g = await goal(p);
    if (dist(g, want) < tol) return { ok: true, goal: g, want };
  }
  return { ok: false, goal: g, want };
}
const said = (f) => (f.ok ? 'sent to the pointer' : `NOT sent to the pointer: its flight ends at ${JSON.stringify(f.goal && f.goal.map(Math.round))}, the pointer is at ${JSON.stringify(f.want.map(Math.round))}`);
const SPOTS = [[330, 330], [1050, 250], [600, 380], [260, 560], [1100, 470]];   // bare sky and field, away from the buttons

await run('critter', async ({ browser, base, errs }) => {
  const load = machine();
  info(`the computer's load while this test ran: ${load.load.toFixed(1)} on ${load.cores} cores`);
  let p, f;
  for (const kind of KINDS) {
    const q = KINDS.length > 1 ? 'critter=' + kind : '';
    const name = kind;
    const fresh = async (extra = {}) => { const p = await open(browser, base, 'index.html', errs, { viewport: DESK, query: q, ...extra }); await seen(p); await p.clock.runFor(900); return p; };

    // ---------------------------------------------------------------- 1. the ordinary case, and the visitor's own pause
    p = await fresh();
    f = await follows(p, ...SPOTS[0]);
    ok(`${name}: it follows the pointer`, f.ok, said(f));
    f = await follows(p, ...SPOTS[1]);
    ok(`${name}: ...and again, somewhere else`, f.ok, said(f));
    await p.click('.picker [data-motion]'); await p.clock.runFor(400);
    ok(`${name}: "Pause animations" (data-calm="all"): no flight is running`, (await calmOf(p)) === 'all' && (await legs(p)) === 0, `data-calm=${await calmOf(p)}, flights ${await legs(p)}`);
    const parked = await boxAt(p);
    await p.mouse.move(...SPOTS[2], { steps: 5 }); await p.clock.runFor(2500); await realWait(300);
    const still = await boxAt(p);
    ok(`${name}: ...and the pointer does not move it while it is paused`, JSON.stringify(still) === JSON.stringify(parked) && (await legs(p)) === 0, JSON.stringify([parked, still]));
    await p.click('.picker [data-motion]'); await p.clock.runFor(400);
    f = await follows(p, ...SPOTS[3]);
    ok(`${name}: pressed again ("Play animations"): it follows again`, (await calmOf(p)) === null && f.ok, `${said(f)}; data-calm=${await calmOf(p)}`);
    await p.context().close();

    // ---------------------------------------------------------------- 2. the calm mode the page sets by itself ("light", then "most"): the bee keeps flying
    // (the attribute and the event are what the page's own switch does; the real switch is tried at the end)
    for (const level of ['light', 'most']) {
      p = await fresh();
      await p.evaluate((l) => { document.documentElement.setAttribute('data-calm', l); document.dispatchEvent(new CustomEvent('wa:calm', { detail: { level: l, by: 'auto' } })); }, level);
      await p.clock.runFor(700);
      f = await follows(p, ...SPOTS[0]);
      ok(`${name}: the page's calm mode "${level}": it still follows the pointer`, f.ok, said(f));
      f = await follows(p, ...SPOTS[4]);
      ok(`${name}: ...and goes on following`, f.ok, said(f));
      await p.context().close();
    }

    // ---------------------------------------------------------------- 3. the other ways it could stop
    p = await fresh();
    await p.evaluate(() => scrollTo({ top: 3200, behavior: 'instant' })); await p.clock.runFor(700); await seen(p);
    const away = await legs(p);
    await p.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await p.clock.runFor(700); await seen(p); await p.clock.runFor(900);
    f = await follows(p, ...SPOTS[1]);
    ok(`${name}: scrolled away (no flight while out of sight: ${away}) and back: it follows`, away === 0 && f.ok, said(f));

    await follows(p, ...SPOTS[0]);
    await hidden(p, true); await p.clock.runFor(1500);
    const hid = await legs(p);
    await hidden(p, false); await p.clock.runFor(900);
    f = await follows(p, ...SPOTS[2]);
    ok(`${name}: a hidden tab (no flight meanwhile: ${hid}) and back: it follows`, hid === 0 && f.ok, said(f));

    await p.click('#season-switch button[data-season="winter"]');
    await until(p, () => document.documentElement.dataset.season === 'winter', null, 30000); await p.clock.runFor(900);
    const win = await p.evaluate(() => getComputedStyle(document.querySelector('#bee-fly')).display);
    await p.click('#season-switch button[data-season="spring"]');
    await until(p, () => document.documentElement.dataset.season === 'spring', null, 30000); await p.clock.runFor(900);
    f = await follows(p, ...SPOTS[3]);
    ok(`${name}: winter (hidden: display ${win}) and back to spring: it follows`, win === 'none' && f.ok, said(f));

    await p.setViewportSize({ width: 820, height: 700 }); await p.clock.runFor(700);
    await p.setViewportSize(DESK); await p.clock.runFor(900);
    f = await follows(p, ...SPOTS[4]);
    ok(`${name}: the window made smaller and bigger again: it follows`, f.ok, said(f));
    await p.context().close();

    // a pointer that comes into the hero from over a button or over a drawn friend
    p = await fresh();
    const btn = await p.evaluate(() => { const r = document.querySelector('.hero-cta a').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    await p.mouse.move(700, 60); await p.mouse.move(btn[0], btn[1], { steps: 12 });
    const wb = await wantFor(p, btn[0], btn[1]);
    let g = null; for (let i = 0; i < 24 && dist(g, wb) > 100; i++) { await p.clock.runFor(250); await realWait(20); g = await goal(p); }
    ok(`${name}: a pointer that comes in over the big Reserve button: the bee is sent next to it`, dist(g, wb) <= 100, `its flight ends at ${JSON.stringify(g && g.map(Math.round))}, the button's middle is at ${JSON.stringify(wb.map(Math.round))}`);
    const friend = await p.evaluate(() => { for (const e of document.querySelectorAll('#field [data-pick], .scene-hit, .tree-pick')) { const r = e.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2; if (y > 150 && y < innerHeight - 60 && x > 20 && x < innerWidth - 20) { const t = document.elementFromPoint(x, y); if (t && (t === e || e.contains(t))) return [x, y]; } } return null; });
    ok(`${name}: (there is a drawn friend to point at)`, !!friend);
    if (friend) {
      await p.mouse.move(700, 60); f = await follows(p, friend[0], friend[1]);
      ok(`${name}: a pointer that comes in over a drawn friend (a berry): it follows`, f.ok, said(f));
    }
    await p.context().close();

    // a flight that ends while the tab is hidden, and a long pause (the clock of the page jumps while a flight is under way)
    p = await fresh();
    await p.mouse.move(600, 300, { steps: 5 }); await p.clock.runFor(700);
    await hidden(p, true); await p.clock.runFor(4000); await hidden(p, false); await p.clock.runFor(900);
    f = await follows(p, ...SPOTS[2]);
    ok(`${name}: a flight that ended while the tab was hidden: it follows afterwards`, f.ok, said(f));
    f = await follows(p, ...SPOTS[0]);   // a new flight has just begun ...
    await p.clock.fastForward(60000); await p.clock.runFor(1000);   // ... and the clock of the page runs a minute ahead of the drawing
    // in ONE turn of the page (no frame is drawn in between): where the bee is drawn, then the tab is hidden (the bee is parked), then where it is
    const park = await p.evaluate(() => {
      const el = document.querySelector('#bee-fly'), at = () => { const m = new DOMMatrixReadOnly(getComputedStyle(el).transform); return [Math.round(m.m41 * 10) / 10, Math.round(m.m42 * 10) / 10]; };
      const before = at(), flying = el.getAnimations().length;
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange'));
      return { before, after: at(), flying, flightsAfter: el.getAnimations().length };
    });
    ok(`${name}: after a long pause it parks where it is drawn, not where a clock says it should be`, park.flying > 0 && park.flightsAfter === 0 && Math.hypot(park.before[0] - park.after[0], park.before[1] - park.after[1]) < 2, JSON.stringify(park));
    await hidden(p, false); await p.clock.runFor(900);
    f = await follows(p, ...SPOTS[1]);
    ok(`${name}: ...and it follows again`, f.ok, said(f));
    await p.context().close();

    // ---------------------------------------------------------------- 4. what it looks like and how it moves
    p = await fresh(); await p.clock.runFor(1500);
    const d = await p.evaluate(() => {
      const box = document.querySelector('#bee-fly'), cs = (e) => getComputedStyle(e);
      const loops = box.getAnimations({ subtree: true }).filter((a) => a.effect.getTiming().iterations === Infinity && a.playState === 'running');
      const props = new Set(); loops.forEach((a) => a.effect.getKeyframes().forEach((k) => Object.keys(k).forEach((n) => { if (!['offset', 'easing', 'composite', 'computedOffset'].includes(n)) props.add(n); })));
      return {
        kind: box.dataset.kind, aria: box.getAttribute('aria-hidden'), svgAria: [...box.querySelectorAll('svg')].map((v) => v.getAttribute('aria-hidden')), pe: cs(box).pointerEvents,
        shown: { bee: cs(document.querySelector('#bee')).display, bfly: cs(document.querySelector('#bfly')).display }, size: [Math.round(box.offsetWidth), Math.round(box.offsetHeight)],
        loops: loops.map((a) => ({ name: a.animationName, on: (a.effect.target.getAttribute('class') || a.effect.target.tagName).split(' ')[0], ms: a.effect.getTiming().duration })),
        props: [...props], wingParents: [...box.querySelectorAll('.bw')].map((n) => n.parentNode.id), hue: box.dataset.hue || '',
      };
    });
    const mine = kind === 'bee' ? 'bee' : 'bfly', other = kind === 'bee' ? 'bfly' : 'bee';
    ok(`${name}: the ${kind} is drawn and the other one is not (data-kind="${d.kind}")`, d.kind === kind && d.shown[mine] === 'block' && d.shown[other] === 'none', JSON.stringify(d.shown));
    ok(`${name}: hidden from screen readers (the box and both drawings) and it never catches a click`, d.aria === 'true' && d.svgAria.every((v) => v === 'true') && d.pe === 'none', JSON.stringify([d.aria, d.svgAria, d.pe]));
    const flaps = d.loops.filter((l) => l.name === (kind === 'bee' ? 'buzz' : 'flap')), bob = d.loops.filter((l) => l.name === (kind === 'bee' ? 'beeFly' : 'bflyBob'));
    ok(`${name}: the wings flap (two wings, a loop each) and it bobs (one loop)`, flaps.length === 2 && bob.length === 1 && d.loops.length === 3, JSON.stringify(d.loops));
    if (kind === 'butterfly') {
      ok('butterfly: its wings flap faster than the two butterflies of the scene (.32 s per half beat), and are direct children of the drawing', flaps.length === 2 && flaps.every((l) => l.ms < 200 && l.ms >= 60) && d.wingParents.length === 2 && d.wingParents.every((id) => id === 'bfly'), JSON.stringify([flaps, d.wingParents]));
      ok(`butterfly: coloured from the site's palette (${d.hue})`, ['', 'morpho', 'admiral'].includes(d.hue) && d.size[0] === 52, JSON.stringify([d.hue, d.size]));
    } else ok('bee: the wings buzz faster still (.09 s per half beat)', flaps.length === 2 && flaps.every((l) => l.ms <= 100), JSON.stringify(flaps));
    ok(`${name}: everything that loops moves by transform only (the compositor runs it: no repaint, no script)`, d.props.length === 1 && d.props[0] === 'transform', JSON.stringify(d.props));

    // the shape of a flight: a bee goes straight, a butterfly takes longer and curves, and bends to the other side the next time
    const shapeOf = () => p.evaluate(() => {
      const a = document.querySelector('#bee-fly').getAnimations().filter((x) => x.effect && x.effect.getKeyframes), z = a[a.length - 1];
      if (!z) return null;
      const pts = z.effect.getKeyframes().map((k) => { const m = /translate\(([-\d.]+)px, ([-\d.]+)px/.exec(k.transform || ''); return m ? [+m[1], +m[2]] : null; });
      return { pts, ms: z.effect.getTiming().duration, props: [...new Set(z.effect.getKeyframes().flatMap((k) => Object.keys(k)))].filter((n) => !['offset', 'easing', 'composite', 'computedOffset'].includes(n)) };
    });
    const bendOf = (sh) => {   // how far the middle of the flight is off the straight line from its start to its end (px, signed)
      const a = sh.pts[0], b = sh.pts[sh.pts.length - 1], m = sh.pts[Math.floor(sh.pts.length / 2)], len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return ((b[0] - a[0]) * (a[1] - m[1]) - (a[0] - m[0]) * (b[1] - a[1])) / len;
    };
    await follows(p, ...SPOTS[0]); const one = await shapeOf();
    await follows(p, ...SPOTS[4]); const two = await shapeOf();
    await follows(p, ...SPOTS[1]); const three = await shapeOf();
    if (kind === 'bee') ok('bee: a flight is a straight line (two keyframes), 1.7 s', [one, two, three].every((x) => x && x.pts.length === 2 && x.ms === 1700), JSON.stringify([one && one.pts.length, one && one.ms]));
    else {
      ok('butterfly: a flight has a middle keyframe or more, is slower than the bee\'s (1.7 s), and is off the straight line by at least 12 px in the middle', [one, two, three].every((x) => x && x.pts.length >= 3 && x.ms > 1700 && Math.abs(bendOf(x)) >= 12), JSON.stringify([one, two, three].map((x) => x && [x.pts.length, x.ms, Math.round(bendOf(x))])));
      ok('butterfly: it bends to the other side every time (the sign of the bend changes from one flight to the next)', Math.sign(bendOf(one)) !== Math.sign(bendOf(two)) && Math.sign(bendOf(two)) !== Math.sign(bendOf(three)), JSON.stringify([one, two, three].map(bendOf).map(Math.round)));
    }
    ok(`${name}: a flight moves only the transform (it keeps to the compositor)`, [one, two, three].every((x) => x && x.props.length === 1 && x.props[0] === 'transform'), JSON.stringify([one && one.props]));
    await p.context().close();

    // ---------------------------------------------------------------- 5. it settles next to the hero's buttons and cards, not on them
    p = await fresh();
    const spots = await p.evaluate(() => {
      const hero = document.querySelector('#top').getBoundingClientRect(), out = [];
      for (const [sel, label] of [['.hero-cta a', 'Reserve'], ['.hero-cta a ~ a', 'See what\'s in season'], ['.hero-note a', 'GreenHouse link'], ['.picker .motion-btn', 'Pause'], ['#pick-btn', 'Pick'], ['#season-switch button', 'a season button']]) {
        const e = [...document.querySelectorAll(sel)].find((n) => n.getClientRects().length); if (!e) continue;
        const r = e.getBoundingClientRect(); out.push({ label, x: r.x + r.width / 2, y: r.y + r.height / 2, rect: [r.left - hero.left, r.top - hero.top, r.right - hero.left, r.bottom - hero.top] });
      }
      return out;
    });
    const covered = [];
    for (const t of spots) {
      await p.mouse.move(700, 4); await p.clock.runFor(300);
      await p.mouse.move(t.x, t.y, { steps: 8 }); await p.clock.runFor(700);   // its flight starts within half a second
      const want = await wantFor(p, t.x, t.y); let g = null;
      for (let i = 0; i < 10 && !(g && dist(g, want) < 140); i++) { await p.clock.runFor(250); await realWait(20); g = await goal(p); }
      if (!g) { covered.push(t.label + ': no flight'); continue; }
      const ox = Math.min(g[0] + 52, t.rect[2]) - Math.max(g[0], t.rect[0]), oy = Math.min(g[1] + 40, t.rect[3]) - Math.max(g[1], t.rect[1]);
      if (ox > 3 && oy > 3) covered.push(`${t.label}: covered by ${Math.round(ox)} x ${Math.round(oy)} px`);
      else if (dist(g, want) > 140) covered.push(`${t.label}: ${Math.round(dist(g, want))} px from the pointer`);
    }
    ok(`${name}: with the pointer resting on each of ${spots.length} buttons (${spots.map((t) => t.label).join(', ')}) it settles beside the button, close to the pointer, never on it`, spots.length >= 5 && covered.length === 0, covered.join('; '));
    await p.context().close();

    // ---------------------------------------------------------------- 6. the change of kind
    p = await fresh();
    ok(`${name}: the hook says which kind it is (WISE_ACRES.critter.kind)`, (await p.evaluate(() => window.WISE_ACRES.critter.kind)) === kind);
    const heroW = await p.evaluate(() => document.querySelector('#top').clientWidth);
    await p.evaluate(() => window.WISE_ACRES.critter.swap()); await p.clock.runFor(300);
    const out = await goal(p), outShape = await shapeOf();
    ok(`${name}: the change starts by flying out over a side edge of the hero (its flight ends beyond the edge: ${JSON.stringify(out && out.map(Math.round))})`, !!out && (out[0] < -50 || out[0] > heroW + 10), JSON.stringify(out));
    await p.clock.runFor(kind === 'bee' ? 1800 : 2400); await realWait(100);
    const flipped = await kindOf(p);
    ok(`${name}: ...and when it is out of sight the other kind comes back (data-kind="${flipped}")`, flipped === (kind === 'bee' ? 'butterfly' : 'bee'));
    const back = await shapeOf();
    ok(`${name}: ...flying in from the same side (it starts beyond the edge and its flight ends inside the hero)`, !!back && (back.pts[0][0] < -40 || back.pts[0][0] > heroW) && Math.sign(back.pts[0][0] - heroW / 2) === Math.sign(out[0] - heroW / 2) && back.pts[back.pts.length - 1][0] > 0 && back.pts[back.pts.length - 1][0] < heroW - 20, JSON.stringify(back && [back.pts[0], back.pts[back.pts.length - 1]]));
    await p.clock.runFor(2600);
    f = await follows(p, ...SPOTS[2]);
    ok(`${name}: ...and then it follows the pointer, as the other kind`, f.ok, said(f));
    const before2 = await kindOf(p);
    await p.evaluate(() => window.WISE_ACRES.critter.swap()); await p.clock.runFor(300);
    await p.click('.picker [data-motion]'); await p.clock.runFor(400);
    const parkedAt = await boxAt(p), after2 = await kindOf(p);
    ok(`${name}: "Pause animations" while it is away changing kind: it is back at once, in the other kind, parked inside the hero`, (await legs(p)) === 0 && after2 !== before2 && parkedAt[0] > -10 && parkedAt[0] < heroW, JSON.stringify([before2, after2, parkedAt, heroW]));
    await p.context().close();

    // by itself: between 45 and 75 seconds (the page's clock runs ahead; nothing is moved), never when the address picked the kind
    p = await open(browser, base, 'index.html', errs, { viewport: DESK, query: q });
    await seen(p); await p.clock.runFor(900);
    const flips = []; let last = await kindOf(p), t = 0;
    for (; t < (kind === 'bee' ? 130000 : 130000); t += 2000) { await p.clock.runFor(2000); const k = await kindOf(p); if (k !== last) { flips.push(t + 2000); last = k; } }
    ok(`${name}: the address picked the kind: it never changes by itself (130 s of page time)`, flips.length === 0, JSON.stringify(flips));
    await p.context().close();
  }

  // by itself, with no address option: the kind is random at the start and changes every 45 to 75 seconds
  {
    const times = [], starts = [];
    for (let run = 0; run < 3; run++) {
      const p2 = await open(browser, base, 'index.html', errs, { viewport: DESK });
      await seen(p2); await p2.clock.runFor(900);
      let last = await kindOf(p2), t = 0, prev = 0; starts.push(last);
      for (; t < 215000; t += 2000) { await p2.clock.runFor(2000); const k = await kindOf(p2); if (k !== last) { times.push([run, Math.round((t + 2000 - prev) / 1000)]); prev = t + 2000; last = k; } }
      await p2.context().close();
    }
    const gaps = times.map((x) => x[1]);
    ok('with no address option the kind changes by itself, every 45 to 75 seconds (plus the few seconds its flight out and back take): the gaps between changes, in seconds', gaps.length >= 6 && gaps.every((g) => g >= 44 && g <= 90), JSON.stringify({ starts, gaps }));
  }
  // the start is a coin toss (Math.random below one half: a bee; above: a butterfly)
  for (const [roll, want] of [[0.2, 'bee'], [0.8, 'butterfly']]) {
    const r = await open(browser, base, 'index.html', errs, { viewport: DESK, routes: async (pg) => { await pg.addInitScript((v) => { Math.random = () => v; }, roll); } });
    ok(`with no address option the page picks at random when it loads: a roll of ${roll} gives a ${want}`, (await kindOf(r)) === want, await kindOf(r));
    await r.context().close();
  }

  // ---------------------------------------------------------------- 7. "reduce motion": neither shows; a phone 390 px wide
  for (const kind of KINDS) {
    const q = 'critter=' + kind;
    const r = await open(browser, base, 'index.html', errs, { viewport: DESK, query: q, reducedMotion: 'reduce' });
    const rv = await r.evaluate(() => ({ display: getComputedStyle(document.querySelector('#bee-fly')).display, hidden: document.querySelector('#bee-fly').hidden, loops: document.getAnimations().filter((a) => a.playState === 'running' && a.effect.getTiming().iterations === Infinity && document.querySelector('#bee-fly').contains(a.effect.target)).length, legs: document.querySelector('#bee-fly').getAnimations().length }));
    ok(`${kind}: with "reduce motion" it is not shown, nothing of it moves`, rv.display === 'none' && rv.hidden && rv.loops === 0 && rv.legs === 0, JSON.stringify(rv));
    await r.context().close();

    const ph = await open(browser, base, 'index.html', errs, { viewport: { width: 390, height: 844 }, touch: true, query: q });
    await seen(ph); await ph.clock.runFor(900);
    const tap = async (x, y) => ph.evaluate(([x, y]) => document.querySelector('#top').dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, bubbles: true, pointerType: 'touch' })), [x, y]);   // a touch on the hero, without a click that would follow a link
    const heroTop = await ph.evaluate(() => { const r = document.querySelector('#top').getBoundingClientRect(); return [r.x, r.y]; });
    const fingers = [[300, heroTop[1] + 300], [80, heroTop[1] + 250], [200, heroTop[1] + 120]];
    const hits = [];
    for (const [x, y] of fingers) {
      await tap(x, y); const want = [x - heroTop[0] - 26, y - heroTop[1] - 24]; let g = null;
      for (let i = 0; i < 20 && dist(g, want) > 10; i++) { await ph.clock.runFor(250); await realWait(20); g = await goal(ph); }
      hits.push(dist(g, want) <= 10);
    }
    const flow = await ph.evaluate(() => ({ wide: document.documentElement.scrollWidth - document.documentElement.clientWidth, pe: getComputedStyle(document.querySelector('#bee-fly')).pointerEvents, vis: document.querySelector('#bee-fly').checkVisibility() }));
    ok(`${kind}: on a phone 390 px wide a touch sends it to the finger (3 of 3), it never catches a touch, and the page does not scroll sideways`, hits.every(Boolean) && flow.pe === 'none' && flow.wide <= 0 && flow.vis, JSON.stringify([hits, flow]));
    const btnPhone = await ph.evaluate(() => { const hero = document.querySelector('#top').getBoundingClientRect(), e = document.querySelector('.hero-cta a'), r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, rect: [r.left - hero.left, r.top - hero.top, r.right - hero.left, r.bottom - hero.top] }; });
    await tap(btnPhone.x, btnPhone.y); const wantB = [btnPhone.x - heroTop[0] - 26, btnPhone.y - heroTop[1] - 24]; let gb = null;
    for (let i = 0; i < 20 && !(gb && dist(gb, wantB) < 140 && i > 3); i++) { await ph.clock.runFor(250); await realWait(20); gb = await goal(ph); }
    const bx = gb ? Math.min(gb[0] + 52, btnPhone.rect[2]) - Math.max(gb[0], btnPhone.rect[0]) : 99, by = gb ? Math.min(gb[1] + 40, btnPhone.rect[3]) - Math.max(gb[1], btnPhone.rect[1]) : 99;
    ok(`${kind}: on the phone, a touch on the big Reserve button: it settles next to it, not on it`, !!gb && !(bx > 3 && by > 3) && dist(gb, wantB) < 140, JSON.stringify({ goal: gb, overlap: [Math.round(bx), Math.round(by)] }));
    await ph.context().close();
  }

  // ---------------------------------------------------------------- 8. the real switch: a slow processor, a browser that is not run by a program, 1440 x 900, the real clock
  for (const kind of KINDS) {
    const slow = await open(browser, base, 'index.html', errs, {
      viewport: DESK, time: false, query: 'critter=' + kind,
      routes: async (pg) => {
        await pg.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { configurable: true, get: () => false }); });
        const cdp = await pg.context().newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
      },
    });
    const level1 = await until(slow, () => document.documentElement.getAttribute('data-calm'), null, 60000);
    ok(`${kind}: 6x slower processor, 1440 x 900: the page switches to data-calm="light" by itself`, level1 === 'light', String(level1));
    const loops = () => slow.evaluate(() => document.querySelector('#bee-fly').getAnimations({ subtree: true }).filter((a) => a.playState === 'running' && a.effect.getTiming().iterations === Infinity).length);
    const realFollows = async (x, y, limit = 40000) => {
      await slow.mouse.move(x, y, { steps: 5 });
      const want = await wantFor(slow, x, y), t0 = Date.now(); let g = null;
      while (Date.now() - t0 < ms(limit)) { await realWait(200); g = await goal(slow); if (dist(g, want) < 8) return { ok: true, goal: g, want }; }
      return { ok: false, goal: g, want };
    };
    f = await realFollows(...SPOTS[0]);
    ok(`${kind}: ...and it still follows the pointer (it used to stay where it was for good)`, f.ok, said(f));
    ok(`${kind}: ...its wings and bobbing rest (no endless animation of it runs)`, (await loops()) === 0, String(await loops()));
    if (kind === 'bee') {   // the second step and the way back: once is enough (the butterfly goes through the same code)
      const level2 = await until(slow, () => document.documentElement.getAttribute('data-calm') === 'most', null, 60000);
      f = await realFollows(...SPOTS[4]);
      ok('still slow: data-calm="most", and it still follows the pointer', level2 && f.ok, `${level2 ? 'most' : await calmOf(slow)}; ${said(f)}`);
      await slow.click('.picker [data-motion]'); await realWait(300);
      f = await realFollows(...SPOTS[1]);
      ok('one press on the (pressed) button: motion is back, it follows', (await calmOf(slow)) === null && f.ok, `${await calmOf(slow)}; ${said(f)}`);
    }
    await slow.context().close();
  }
});
