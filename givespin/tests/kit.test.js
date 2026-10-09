// Run with:  node --test givespin/tests/kit.test.js
// The shared race toolkit's pieces for clickable charities and charity marks on a canvas (js/kit.js).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function load(markImage) {
  const sandbox = { GS: { markImage } };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/kit.js'), 'utf8'), sandbox);
  return sandbox.GS.kit;
}

/** A pretend canvas context that writes down what was drawn on it. */
function fakeCtx() {
  const calls = [];
  const rec = (name) => (...a) => { calls.push([name, ...a]); };
  const ctx = { calls };
  ['save', 'restore', 'beginPath', 'closePath', 'arc', 'fill', 'clip', 'stroke', 'drawImage'].forEach((n) => { ctx[n] = rec(n); });
  return ctx;
}

test('an ellipse spot: inside is below 1, the middle is 0, outside is not on it', () => {
  const kit = load();
  const sp = { x: 100, y: 50, rx: 10, ry: 5 };
  assert.equal(kit.spotScore(sp, 100, 50), 0);
  assert.ok(kit.spotScore(sp, 105, 50) < 1);
  assert.equal(kit.spotScore(sp, 111, 50), Infinity);
  assert.equal(kit.spotScore(sp, 100, 56), Infinity);
  assert.equal(kit.spotScore(sp, 109, 53) < 1, false, 'the corner of the box is outside an ellipse');
});

test('a rectangle spot: anywhere on it counts, just behind any round spot', () => {
  const kit = load();
  const rect = { x0: 0, y0: 0, x1: 100, y1: 20 };
  assert.equal(kit.spotScore(rect, 50, 10), 0.99);
  assert.equal(kit.spotScore(rect, 101, 10), Infinity);
  assert.equal(kit.spotScore(rect, 50, 21), Infinity);
});

test('pickSpot: the nearest centre wins, the one on top wins before that, and nothing is picked off every spot', () => {
  const kit = load();
  const a = { id: 'a', x: 10, y: 10, rx: 8, ry: 8 };
  const b = { id: 'b', x: 18, y: 10, rx: 8, ry: 8 };
  assert.equal(kit.pickSpot([a, b], 12, 10).id, 'a');
  assert.equal(kit.pickSpot([a, b], 16, 10).id, 'b');
  assert.equal(kit.pickSpot([a, b], 14, 10).id, 'a', 'a tie goes to the first');
  const top = Object.assign({}, b, { z: 1 });
  assert.equal(kit.pickSpot([a, top], 12, 10).id, 'b', 'a spot on top wins even when another centre is nearer');
  const label = { id: 'l', x0: 0, y0: 0, x1: 40, y1: 20 };
  assert.equal(kit.pickSpot([label, a], 10, 10).id, 'a', 'a round mark on a label wins where they meet');
  assert.equal(kit.pickSpot([label, a], 30, 15).id, 'l');
  assert.equal(kit.pickSpot([a, b], 200, 200), null);
  assert.equal(kit.pickSpot([], 1, 1), null);
});

const plain = (v) => JSON.parse(JSON.stringify(v));   // (an object made inside the page's sandbox is not the same kind as one made here)

test('canvasPoint turns a click into the canvas\'s own units, and ignores clicks outside it', () => {
  const kit = load();
  const canvas = { getBoundingClientRect: () => ({ left: 100, top: 40, width: 300, height: 150 }) };
  assert.deepEqual(plain(kit.canvasPoint(canvas, 600, 300, 250, 115)), { x: 300, y: 150 }, 'drawn at half size: units double');
  assert.deepEqual(plain(kit.canvasPoint(canvas, 300, 150, 100, 40)), { x: 0, y: 0 });
  assert.equal(kit.canvasPoint(canvas, 300, 150, 99, 100), null);
  assert.equal(kit.canvasPoint(canvas, 300, 150, 200, 191), null);
  assert.equal(kit.canvasPoint(canvas, 0, 150, 200, 100), null, 'not drawn yet');
  assert.equal(kit.canvasPoint({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }) }, 300, 150, 1, 1), null, 'not laid out');
  assert.equal(kit.canvasPoint(null, 300, 150, 1, 1), null);
});

test('drawMark draws nothing while there is no picture, or for a badge under 14 px across', () => {
  const ch = { id: 'x', accent: '#336699' };
  const none = load(() => null);
  const ctx = fakeCtx();
  assert.equal(none.drawMark(ctx, ch, 10, 10, 20), false);
  assert.equal(ctx.calls.length, 0);
  const img = { naturalWidth: 100, naturalHeight: 50 };
  const kit = load(() => img);
  assert.equal(kit.MARK_MIN, 14);
  assert.equal(kit.drawMark(ctx, ch, 10, 10, 6.9), false, '13.8 px across is too small');
  assert.equal(ctx.calls.length, 0);
  assert.equal(kit.drawMark(ctx, ch, 10, 10, 7), true, '14 px across is enough');
  assert.equal(load(() => ({ naturalWidth: 0, naturalHeight: 0, complete: false })).drawMark(fakeCtx(), ch, 10, 10, 20), false, 'a picture still loading is not drawn');
  const square = fakeCtx();
  assert.equal(load(() => ({ naturalWidth: 0, naturalHeight: 0, complete: true })).drawMark(square, ch, 10, 10, 20), true, 'a loaded picture with no size of its own (some SVG files) is drawn as a square');
  const sq = square.calls.find((c) => c[0] === 'drawImage');
  assert.ok(Math.abs(sq[4] - 31.2) < 1e-9 && Math.abs(sq[5] - 31.2) < 1e-9);
  const broken = fakeCtx();
  broken.drawImage = () => { throw new Error('InvalidStateError'); };
  assert.equal(kit.drawMark(broken, ch, 10, 10, 20), false, 'a picture the browser cannot draw falls back instead of throwing');
  assert.equal(load().drawMark(fakeCtx(), ch, 10, 10, 20), false, 'no GS.markImage at all (an older page) is fine');
});

test('drawMark fits the picture inside a round badge: white disc, picture kept in proportion, a ring in the charity\'s colour', () => {
  const ch = { id: 'x', accent: '#336699' };
  const kit = load(() => ({ naturalWidth: 200, naturalHeight: 100 }));
  const ctx = fakeCtx();
  assert.equal(kit.drawMark(ctx, ch, 50, 40, 20), true);
  const draw = ctx.calls.find((c) => c[0] === 'drawImage');
  // the box is the badge less 22% padding: 31.2 px; a 2:1 picture is 31.2 wide and 15.6 tall, centred on (50, 40)
  assert.ok(Math.abs(draw[4] - 31.2) < 1e-9 && Math.abs(draw[5] - 15.6) < 1e-9, 'size ' + draw.slice(4, 6));
  assert.ok(Math.abs(draw[2] - (50 - 15.6)) < 1e-9 && Math.abs(draw[3] - (40 - 7.8)) < 1e-9, 'position ' + draw.slice(2, 4));
  assert.ok(ctx.calls.some((c) => c[0] === 'clip') && ctx.calls.some((c) => c[0] === 'restore'), 'drawn clipped to the disc, and the clip is let go');
  assert.equal(ctx.fillStyle, '#fff');
  assert.equal(ctx.strokeStyle, '#336699');
  const ringless = fakeCtx();
  kit.drawMark(ringless, ch, 50, 40, 20, { ring: false });
  assert.equal(ringless.calls.some((c) => c[0] === 'stroke'), false);
  const gold = fakeCtx();
  kit.drawMark(gold, ch, 50, 40, 20, { ring: '#ffc542' });
  assert.equal(gold.strokeStyle, '#ffc542');
  // a canvas works as a picture too (it has width and height, not naturalWidth)
  const cv = load(() => ({ width: 40, height: 40 }));
  assert.equal(cv.drawMark(fakeCtx(), ch, 5, 5, 10), true);
});
