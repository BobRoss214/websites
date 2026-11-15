// Run with:  node --test givespin/tests/ranks.test.js
// Rank emblems (js/ranks.js): eight badges drawn in code as inline SVG. These tests run the real script on a pretend page
// (a bare window with GS = {}) and check the contract that the rest of the site relies on.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const FILE = path.join(__dirname, '../js/ranks.js');

/** A fresh copy of js/ranks.js on a pretend page that only has window.GS = {}. */
function load() {
  const sandbox = { GS: {} };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), sandbox, { filename: 'ranks.js' });
  return sandbox.GS;
}

const GS = load();
const R = GS.ranks;
const IDS = ['patron', 'benefactor', 'champion', 'guardian', 'paragon', 'luminary', 'titan', 'immortal'];
const SIZES = [16, 20, 24, 32, 40, 41, 64, 96, 128, 160, 220];

/* ---------- independent helpers (written here on purpose, so a mistake in js/ranks.js cannot hide itself) ---------- */

/** A strict little XML reader: every tag closed, every attribute quoted, no attribute twice. Returns the elements in order. */
function readSvg(svg) {
  const tagRe = /<(\/?)([A-Za-z][\w-]*)((?:\s+[A-Za-z_:][\w:.-]*="[^"<>]*")*)\s*(\/?)>/y;
  const attrRe = /([A-Za-z_:][\w:.-]*)="([^"]*)"/g;
  const stack = [], nodes = [];
  let pos = 0;
  while (pos < svg.length) {
    if (svg[pos] !== '<') {   // text is only allowed inside <title>
      const next = svg.indexOf('<', pos);
      assert.equal(stack[stack.length - 1], 'title', 'text outside a <title>: ' + svg.slice(pos, pos + 30));
      pos = next;
      continue;
    }
    tagRe.lastIndex = pos;
    const m = tagRe.exec(svg);
    assert.ok(m, 'not well-formed at offset ' + pos + ': ' + svg.slice(pos, pos + 40));
    pos = tagRe.lastIndex;
    const [, closing, name, rawAttrs, selfClose] = m;
    if (closing) { assert.equal(stack.pop(), name, 'closing tag does not match the open one: ' + name); continue; }
    const attrs = {};
    let a;
    attrRe.lastIndex = 0;
    while ((a = attrRe.exec(rawAttrs))) { assert.ok(!(a[1] in attrs), 'attribute given twice: ' + a[1]); attrs[a[1]] = a[2]; }
    nodes.push({ name, attrs });
    if (nodes.length === 1) { assert.equal(name, 'svg', 'the root is not <svg>'); }
    else { assert.ok(stack.length > 0, 'more than one root element'); }
    if (!selfClose) { stack.push(name); }
  }
  assert.equal(stack.length, 0, 'tags left open: ' + stack.join(','));
  return nodes;
}
const idsIn = (svg) => readSvg(svg).filter((n) => n.attrs.id).map((n) => n.attrs.id);
const refsIn = (svg) => Array.from(svg.matchAll(/url\(#([^)]+)\)/g), (m) => m[1]);
const sameApartFromIds = (s) => s.replace(/rk\d+_/g, 'rkN_');
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

/* ---------- the tests ---------- */

test('META: eight entries in rank order with colours and a plain one-sentence blurb', () => {
  assert.equal(R.META.length, 8);
  assert.deepEqual(Array.from(R.META, (m) => m.id), IDS);   // Array.from: the script's own arrays come from the pretend page
  R.META.forEach((m) => {
    assert.match(m.color, /^#[0-9a-f]{6}$/i, m.id + ' color');
    assert.match(m.accent, /^#[0-9a-f]{6}$/i, m.id + ' accent');
    assert.match(m.grad, /^linear-gradient\(/, m.id + ' grad');
    assert.equal(typeof m.blurb, 'string');
    assert.ok(m.blurb.length > 20 && m.blurb.length < 160, m.id + ' blurb length ' + m.blurb.length);
    assert.match(m.blurb, /^[A-Z].*\.$/, m.id + ' blurb is one sentence');
    assert.doesNotMatch(m.blurb, /crypto|bitcoin|token|blockchain|nft|wallet|cash value/i, m.id + ' blurb wording');
    // the colours may be used for text: readable (4.5:1) on the page background and on both panel colours of css/base.css
    ['#0a1219', '#0b1620', '#13202c', '#182a38'].forEach((bg) => {
      assert.ok(contrast(m.color, bg) >= 4.5, m.id + ' color on ' + bg + ': ' + contrast(m.color, bg).toFixed(2));
      assert.ok(contrast(m.accent, bg) >= 4.5, m.id + ' accent on ' + bg);
    });
  });
});

test('emblem(1..8, 16..220) gives one well-formed <svg> with no undefined or NaN, at the size asked for', () => {
  for (let n = 1; n <= 8; n++) {
    SIZES.forEach((px) => {
      const s = R.emblem(n, px);
      assert.ok(s.startsWith('<svg'), 'rank ' + n + ' at ' + px + ' px');
      assert.doesNotMatch(s, /undefined|NaN|null|Infinity|\[object/, 'rank ' + n + ' at ' + px + ' px');
      const root = readSvg(s)[0];
      assert.equal(root.attrs.width, String(px));
      assert.equal(root.attrs.height, String(px));
      assert.equal(root.attrs.viewBox, '0 0 100 100');
      assert.match(root.attrs.class, new RegExp('(^| )rk-' + n + '( |$)'));
    });
  }
});

test('bad input: anything that is not a whole rank 1..8 gives an empty string (documented choice)', () => {
  [0, 9, -1, 2.5, NaN, Infinity, null, undefined, '', 'gold', {}, []].forEach((n) => {
    assert.equal(R.emblem(n, 64), '', 'emblem(' + String(n) + ')');
    assert.equal(R.ring(n, 5, 64), '', 'ring(' + String(n) + ')');
  });
  assert.ok(R.emblem('3', 64).startsWith('<svg'), 'a numeric string is fine');
  // a size that is not a positive number falls back to 24 px; huge or tiny sizes are clamped
  assert.match(R.emblem(2, NaN), /width="24"/);
  assert.match(R.emblem(2, -5), /width="24"/);
  assert.match(R.emblem(2, 'big'), /width="24"/);
  assert.match(R.emblem(2, 4), /width="8"/);
  assert.match(R.emblem(2, 5000), /width="1024"/);
});

test('a title makes it role="img" with that <title> (escaped); without one it is aria-hidden', () => {
  const titled = R.emblem(2, 64, { title: 'Rank 2, Benefactor, level 6' });
  const root = readSvg(titled)[0];
  assert.equal(root.attrs.role, 'img');
  assert.ok(!('aria-hidden' in root.attrs));
  assert.match(titled, /^<svg[^>]*><title>Rank 2, Benefactor, level 6<\/title>/, 'the title comes first');
  const plain = readSvg(R.emblem(2, 64))[0];
  assert.equal(plain.attrs['aria-hidden'], 'true');
  assert.ok(!('role' in plain.attrs));
  const tricky = R.emblem(5, 20, { title: '<b>"Tom" & Jerry</b>' });
  assert.match(tricky, /<title>&lt;b&gt;&quot;Tom&quot; &amp; Jerry&lt;\/b&gt;<\/title>/);
  readSvg(tricky);
});

test('ids are unique inside one emblem and across many, and every url(#...) points at one of its own ids', () => {
  const all = new Set();
  for (let n = 1; n <= 8; n++) {
    [16, 20, 64, 128, 220].forEach((px) => {
      [R.emblem(n, px), R.ring(n, 6, px)].forEach((s) => {
        const ids = idsIn(s);
        assert.equal(new Set(ids).size, ids.length, 'an id repeats inside rank ' + n + ' at ' + px);
        refsIn(s).forEach((r) => assert.ok(ids.includes(r), 'rank ' + n + ' at ' + px + ' refers to a missing #' + r));
        ids.forEach((id) => { assert.ok(!all.has(id), 'id used twice on the page: ' + id); all.add(id); });
      });
    });
  }
  assert.ok(all.size > 100);
});

test('stable text: the same input gives the same string apart from the id counter', () => {
  for (let n = 1; n <= 8; n++) {
    [16, 40, 64, 220].forEach((px) => {
      const opts = { title: 'Rank ' + n, ring: 7 };
      assert.equal(sameApartFromIds(R.emblem(n, px, opts)), sameApartFromIds(R.emblem(n, px, opts)));
      assert.equal(sameApartFromIds(R.emblem(n, px)), sameApartFromIds(load().ranks.emblem(n, px)), 'a fresh page draws the same');
    });
  }
});

test('40 px and under is the simple drawing and never moves; bigger ones move unless animated is false', () => {
  for (let n = 1; n <= 8; n++) {
    const small = R.emblem(n, 40), big = R.emblem(n, 64), still = R.emblem(n, 220, { animated: false });
    assert.match(readSvg(small)[0].attrs.class, /(^| )rk-sm( |$)/);
    assert.doesNotMatch(small, /rk-anim/);
    assert.doesNotMatch(R.emblem(n, 16, { animated: true }), /rk-anim/);
    assert.match(readSvg(big)[0].attrs.class, /(^| )rk-anim( |$)/);
    assert.doesNotMatch(readSvg(still)[0].attrs.class, /rk-anim/);
    assert.ok(small.length < big.length, 'the small drawing is simpler (rank ' + n + ')');
  }
});

test('ring(n, level): ten segments with `level` of them lit; opts.ring does the same through emblem()', () => {
  for (let n = 1; n <= 8; n++) {
    for (let level = 0; level <= 10; level++) {
      [20, 128].forEach((px) => {
        const s = R.ring(n, level, px);
        assert.equal((s.match(/class="rk-lit/g) || []).length, level, 'rank ' + n + ' level ' + level + ' at ' + px);
        assert.equal((s.match(/class="rk-dim"/g) || []).length, 10 - level);
        assert.equal((s.match(/rk-now/g) || []).length, level ? 1 : 0);
        assert.match(readSvg(s)[0].attrs.class, /(^| )rk-ring( |$)/);
        assert.equal(sameApartFromIds(s), sameApartFromIds(R.emblem(n, px, { ring: level })));
      });
    }
  }
  assert.equal((R.ring(3, 15, 64).match(/class="rk-lit/g) || []).length, 10, 'levels above 10 light all ten');
  assert.equal((R.ring(3, -2, 64).match(/class="rk-lit/g) || []).length, 0, 'levels below 0 light none');
  assert.doesNotMatch(R.emblem(3, 64), /rk-lit|rk-dim|rk-ring/, 'no ring unless asked for');
});

test('self-contained: no files, no other hosts, no scripts, and only GS.ranks is added', () => {
  for (let n = 1; n <= 8; n++) {
    [16, 220].forEach((px) => {
      const s = R.ring(n, 4, px, { title: 'x' });
      assert.deepEqual(s.match(/https?:\/\/[^"]*/g), ['http://www.w3.org/2000/svg'], 'the only address is the SVG namespace');
      assert.doesNotMatch(s, /<image|<script|<foreignObject|href=|@import|on[a-z]+="/i);
      readSvg(s).forEach((node) => assert.ok(!/^on/i.test(Object.keys(node.attrs).join(' ')), 'no event handlers'));
    });
  }
  assert.deepEqual(Object.keys(load()), ['ranks']);
  const src = fs.readFileSync(FILE, 'utf8');
  assert.ok(Buffer.byteLength(src) < 60 * 1024, 'js/ranks.js is ' + Buffer.byteLength(src) + ' bytes');
  assert.match(src, /^\/\*[\s\S]*?\*\/\s*\(function \(\) \{\s+'use strict';[\s\S]*\}\)\(\);\s*$/, 'one IIFE in strict mode, like the other scripts');
  // the code itself, with string literals and then comments blanked out
  const code = src.replace(/'(?:[^'\\\n]|\\.)*'/g, "''").replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  assert.doesNotMatch(code, /\b(let|const)\s+[A-Za-z_$]|\bclass\s+[A-Za-z_$]|=>|`/, 'plain ES5: no let/const/class, arrow functions or template strings');
  assert.doesNotMatch(code, /Math\.random|Date\.now|new Date/, 'nothing random or time based');
});
