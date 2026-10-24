// Run with:  node --test givespin/tests/marble.test.js
// Marble Run (js/games/marble.js): where a click opens a marble's charity, and when a glass marble wears its charity's mark.
// The game is loaded on its own with a stand-in for the shared race engine, which hands over the game's own description of itself.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

/** Everything drawn on a pretend canvas is written down; any drawing call that is not listed here is accepted and ignored. */
function fakeCtx() {
  const calls = [];
  const ctx = new Proxy({}, {
    get(t, k) {
      if (k === 'calls') { return calls; }
      if (k in t) { return t[k]; }
      return (...a) => { calls.push([k, ...a]); return /^create/.test(k) ? { addColorStop() {} } : undefined; };
    },
    set(t, k, v) { t[k] = v; return true; }
  });
  return ctx;
}

function load(markImage) {
  const GS = { core: {}, util: { reducedMotion: () => false }, markImage };
  const sandbox = { GS, performance: { now: () => 0 }, setTimeout, clearTimeout, console };
  sandbox.window = sandbox;
  sandbox.devicePixelRatio = 1;
  sandbox.document = { createElement: () => ({ width: 0, height: 0, getContext: () => fakeCtx() }) };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/kit.js'), 'utf8'), sandbox);
  let spec = null;
  GS.crowdGame = (s) => { spec = s; return {}; };
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/games/marble.js'), 'utf8'), sandbox);
  return { spec, kit: GS.kit };
}

const PICTURE = { naturalWidth: 96, naturalHeight: 96, complete: true };

test('a marble at rest is clicked where it is drawn, with a little room round it', () => {
  const { spec } = load();
  const sp = spec.hitSpot({ _x: 100, _y: 50, _pos: { lift: 0 } }, { geo: { r: 11, k: 1 } });
  assert.deepEqual([sp.x, sp.y], [100, 50]);
  assert.ok(!sp.z, 'not on top of anything');
  assert.ok(sp.rx >= 11 && sp.rx === sp.ry, 'a circle at least as big as the marble');
});

test('a marble of a crowd is never smaller than a fingertip, and a narrow screen scales the spot with the picture', () => {
  const { spec } = load();
  const tiny = spec.hitSpot({ _x: 100, _y: 50, _pos: { lift: 0 } }, { geo: { r: 2.2, k: 0.6 } });
  assert.equal(tiny.rx, 5);
  const small = spec.hitSpot({ _x: 100, _y: 50, _pos: { lift: 0 } }, { geo: { r: 11, k: 0.5 } });
  assert.deepEqual([small.x, small.y], [50, 25]);
  assert.ok(small.rx < 11 && small.rx >= 5);
});

test('a marble tossed up in the shake is clicked where it is seen, and the marble itself is on top of the one it hides', () => {
  const { spec, kit } = load();
  const S = { geo: { r: 11, k: 1 } };
  const rest = spec.hitSpot({ _x: 100, _y: 50, _pos: { lift: 0 } }, S);
  const up = spec.hitSpot({ _x: 100, _y: 50, _pos: { lift: 1 } }, S);
  assert.ok(Array.isArray(up) && up.length === 2, 'its disc, and its circle');
  const disc = up[0], circle = up[1];
  assert.ok(Math.abs(disc.y - (50 - 11 * 1.3)) < 1e-9 && circle.y === disc.y, 'both ride above the place it left');
  assert.equal(disc.z, 1);
  assert.ok(!circle.z, 'the wider circle is not on top');
  assert.ok(disc.rx > 11 && disc.rx < rest.rx, 'the disc is the marble as painted (a little bigger than at rest), not the wider circle');
  const above = spec.hitSpot({ _x: 100, _y: 26, _pos: { lift: 0 } }, S);     // the marble a pitch (24 px) above it
  // on the tossed marble (even where the one above has its middle nearer) the tossed marble is the one
  assert.equal(kit.pickSpot([above, disc, circle], 100, 28), disc);
  // in the ring round it that is not the marble, the nearest middle wins as everywhere else
  assert.equal(kit.pickSpot([above, disc, circle], 100, 20), above);
  assert.equal(kit.pickSpot([above, disc, circle], 100, 51), circle);
});

test('a glass marble wears its charity\'s mark only where the badge is big enough to read (the 22 px marbles of a small bag)', () => {
  const ch = { id: 'wateraid', accent: '#3366cc' };
  const e = { ch, idx: 0, run: { place: 0 } };
  const pos = { x: 40, y: 40, lift: 0, ang: 0, hd: 0, sp: 0 };
  const drewMark = (r, markImage) => {
    const { spec } = load(markImage);
    const ctx = fakeCtx();
    spec.entity(ctx, Object.assign({}, e), pos, { geo: { r, k: 1 }, lead: {}, pickId: '', n: 8 });
    return ctx.calls.some((c) => c[0] === 'drawImage' && c[1] === PICTURE);
  };
  const has = () => PICTURE;
  assert.equal(drewMark(11, has), true, 'a 22 px marble (a bag of up to 12) gets its mark');
  assert.equal(drewMark(7, has), false, 'a 14 px marble would only hold an 11 px badge: colour only');
  assert.equal(drewMark(5.5, has), false);
  assert.equal(drewMark(2.2, has), false, 'a crowd of 500 stays colour only');
  assert.equal(drewMark(11, () => null), false, 'nothing is drawn while the picture is still loading');
});

test('the mark sits between the glass body and the gloss', () => {
  const ch = { id: 'msf', accent: '#cc2222' };
  const pos = { x: 40, y: 40, lift: 0, ang: 0, hd: 0, sp: 0 };
  const { spec } = load(() => PICTURE);
  const ctx = fakeCtx();
  spec.entity(ctx, { ch, idx: 0, run: { place: 0 } }, pos, { geo: { r: 11, k: 1 }, lead: {}, pickId: '', n: 8 });
  const imgs = ctx.calls.filter((c) => c[0] === 'drawImage');
  const iMark = imgs.findIndex((c) => c[1] === PICTURE);
  assert.ok(iMark === 1, 'the glass body is painted first, then the mark');
  assert.ok(imgs.length === 3 && imgs[2][1] !== PICTURE, 'and the shaded glass with its gloss is painted last');
});
