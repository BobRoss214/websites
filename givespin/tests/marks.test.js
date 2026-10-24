// Run with:  node --test givespin/tests/marks.test.js
// Illustrated emblems (js/marks.js): every charity without a real logo gets a picture made from its own data, drawn in the browser,
// with no files and no network. These tests run the real scripts in a pretend page and check all of the roster.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

/** A fresh copy of the site's scripts (core, config, roster, logos, icons, marks) on a pretend page with a pretend Image. */
function makePage() {
  const made = [];
  class FakeImage {
    constructor() { made.push(this); this.decoding = ''; this.onload = null; this.onerror = null; }
  }
  const sandbox = { Image: FakeImage };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  ['core.js', 'config.js', 'data.js', 'logos.js', 'icons.js', 'marks.js'].forEach((f) => {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', f), 'utf8'), sandbox, { filename: f });
  });
  return { GS: sandbox.GS, images: made };
}

const page = makePage();
const GS = page.GS;
const ALL = GS.charities;

/* ---------- independent helpers (written here on purpose, so a mistake in js/marks.js cannot hide itself) ---------- */

const ELEMENTS = new Set(['svg', 'linearGradient', 'stop', 'path', 'g', 'circle', 'rect', 'line', 'ellipse', 'polyline', 'polygon']);
const ATTRS = new Set(['xmlns', 'viewBox', 'width', 'height', 'class', 'aria-hidden', 'focusable', 'id', 'x1', 'y1', 'x2', 'y2', 'stop-color', 'offset',
  'd', 'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-linejoin', 'stroke-linecap', 'stroke-opacity', 'transform', 'cx', 'cy', 'r',
  'x', 'y', 'rx', 'ry', 'points']);

/** A strict little XML reader for the subset an emblem may use: no text, no comments, no entities, every tag closed and attribute quoted. */
function readSvg(svg) {
  const tagRe = /<(\/?)([A-Za-z][\w-]*)((?:\s+[A-Za-z_:][\w:.-]*="[^"<>&]*")*)\s*(\/?)>/y;
  const attrRe = /([A-Za-z_:][\w:.-]*)="([^"]*)"/g;
  const stack = [], nodes = [];
  let pos = 0;
  while (pos < svg.length) {
    tagRe.lastIndex = pos;
    const m = tagRe.exec(svg);
    assert.ok(m, 'not well-formed at offset ' + pos + ': ' + svg.slice(pos, pos + 40));
    pos = tagRe.lastIndex;
    const [, closing, name, rawAttrs, selfClose] = m;
    if (closing) {
      assert.ok(!rawAttrs.trim() && !selfClose, 'a closing tag has attributes: ' + name);
      assert.equal(stack.pop(), name, 'closing tag does not match the open one: ' + name);
      continue;
    }
    const attrs = {};
    let a;
    attrRe.lastIndex = 0;
    while ((a = attrRe.exec(rawAttrs))) {
      assert.ok(!(a[1] in attrs), 'attribute given twice: ' + a[1]);
      attrs[a[1]] = a[2];
    }
    nodes.push({ name, attrs, depth: stack.length });
    if (!selfClose) { stack.push(name); }
    if (nodes.length === 1) { assert.equal(name, 'svg', 'the root is not <svg>'); }
    else { assert.ok(stack.length > 0 || selfClose, 'more than one root element'); }
  }
  assert.equal(stack.length, 0, 'tags left open: ' + stack.join(','));
  return nodes;
}

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const hue = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) { return 0; }
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return h * 60;
};
const hueGap = (a, b) => { const d = Math.abs(hue(a) - hue(b)) % 360; return d > 180 ? 360 - d : d; };
/** the emblem with its gradient id taken out, so two emblems compare by what they look like */
const look = (svg) => svg.replace(/id="[^"]*"/g, 'id="X"').replace(/url\(#[^)]*\)/g, 'url(#X)');
const bytes = (s) => Buffer.byteLength(s, 'utf8');

test('all 500 charities get a well-formed emblem with nothing in it that could load, run or read', () => {
  assert.equal(ALL.length, 500, 'the roster is not 500 any more: update this test');
  ALL.forEach((ch) => {
    const svg = GS.emblemSVG(ch);
    assert.equal(typeof svg, 'string', ch.id);
    const nodes = readSvg(svg);
    nodes.forEach((n) => {
      assert.ok(ELEMENTS.has(n.name), ch.id + ': element not allowed: <' + n.name + '>');
      Object.keys(n.attrs).forEach((k) => assert.ok(ATTRS.has(k), ch.id + ': attribute not allowed: ' + k));
    });
    const root = nodes[0].attrs;
    assert.equal(root.xmlns, 'http://www.w3.org/2000/svg');
    assert.equal(root.viewBox, '0 0 64 64', ch.id);
    assert.equal(root['aria-hidden'], 'true', ch.id + ': the emblem is decoration, the name is always written next to it');
    // every reference stays inside the picture; there is no address in it other than the XML namespace
    const ids = nodes.filter((n) => n.attrs.id).map((n) => n.attrs.id);
    assert.equal(ids.length, 1, ch.id + ': one gradient, one id');
    (svg.match(/url\([^)]*\)/g) || []).forEach((u) => assert.equal(u, 'url(#' + ids[0] + ')', ch.id + ': a reference that leaves the picture'));
    assert.ok(!/https?:|\/\/|javascript:|data:|@import|<script|<style|<image|<use|<text|<foreignObject|\bon\w+=|href=/i.test(svg.replace('http://www.w3.org/2000/svg', '')), ch.id + ': something that could load, run or read');
    // colours are plain hex (or none), and the picture has no letters in it (so it cannot copy a wordmark)
    nodes.forEach((n) => ['fill', 'stroke', 'stop-color'].forEach((k) => {
      if (n.attrs[k] !== undefined) { assert.match(n.attrs[k], /^(#[0-9a-f]{6}|#fff|none|url\(#[\w-]+\))$/, ch.id + ': odd ' + k); }
    }));
  });
});

test('an emblem is the same every time, in a fresh page, and for a copy of the charity, and is not a function of the logo list', () => {
  const again = makePage().GS;
  ALL.forEach((ch) => {
    const a = GS.emblemSVG(ch);
    assert.equal(GS.emblemSVG(ch), a, ch.id + ': two calls differ');
    assert.equal(again.emblemSVG(again.charity(ch.id)), a, ch.id + ': a fresh page differs');
    assert.equal(GS.emblemSVG(JSON.parse(JSON.stringify(ch))), a, ch.id + ': a copy of the charity differs');
    assert.equal(JSON.stringify(GS.emblemInfo(ch)), JSON.stringify(again.emblemInfo(again.charity(ch.id))), ch.id);
  });
  // a charity that has a real logo still has an emblem (the logo is shown instead, and the emblem is what a failed logo falls back to)
  const withLogo = ALL.filter((c) => GS.logoFor(c));
  assert.ok(withLogo.length > 0);
  withLogo.forEach((c) => assert.ok(GS.emblemSVG(c).indexOf('<svg') === 0, c.id));
});

test('an emblem stays under the size budget (2.5 KB), on average well under it', () => {
  let total = 0, biggest = 0;
  ALL.forEach((ch) => {
    const n = bytes(GS.emblemSVG(ch));
    total += n; biggest = Math.max(biggest, n);
    assert.ok(n <= 2500, ch.id + ' is ' + n + ' bytes');
  });
  assert.ok(total / ALL.length < 1500, 'the average emblem is ' + Math.round(total / ALL.length) + ' bytes');
  assert.ok(biggest > 500, 'suspiciously small: ' + biggest);
});

test('at least 95% of the 500 emblems look different from every other one', () => {
  const seen = new Map();
  ALL.forEach((ch) => { const k = look(GS.emblemSVG(ch)); seen.set(k, (seen.get(k) || 0) + 1); });
  const distinct = seen.size;
  assert.ok(distinct >= Math.ceil(ALL.length * 0.95), 'only ' + distinct + ' of ' + ALL.length + ' emblems look different');
  // and the gradient ids that keep two emblems on one page apart are different for every charity
  assert.equal(new Set(ALL.map((ch) => (GS.emblemSVG(ch).match(/id="([^"]+)"/) || [])[1])).size, ALL.length);
});

test('the emblems use many different glyphs and badge shapes, both colour moods, and no one picture takes over', () => {
  const glyphs = {}, shapes = {}, modes = {};
  ALL.forEach((ch) => {
    const i = GS.emblemInfo(ch);
    glyphs[i.glyph] = (glyphs[i.glyph] || 0) + 1; shapes[i.shape] = (shapes[i.shape] || 0) + 1; modes[i.mode] = (modes[i.mode] || 0) + 1;
  });
  assert.ok(Object.keys(glyphs).length >= 8, 'only ' + Object.keys(glyphs).length + ' glyphs: ' + Object.keys(glyphs).join(', '));
  assert.ok(Object.keys(glyphs).length >= 25, 'fewer glyphs than expected: ' + Object.keys(glyphs).length);
  assert.ok(Object.keys(shapes).length >= 6, 'only ' + Object.keys(shapes).length + ' badge shapes');
  Object.keys(shapes).forEach((s) => assert.ok(shapes[s] >= 20 && shapes[s] <= 120, 'the "' + s + '" shape is used ' + shapes[s] + ' times'));
  assert.deepEqual(Object.keys(modes).sort(), ['day', 'night']);
  assert.ok(modes.night >= 60 && modes.day >= 250, JSON.stringify(modes));
  Object.keys(glyphs).forEach((g) => assert.ok(glyphs[g] <= ALL.length * 0.12, 'the "' + g + '" glyph takes ' + glyphs[g] + ' of ' + ALL.length));
  // every glyph that was chosen is really drawn (an unknown name would silently fall back to a heart)
  const iconNames = Object.keys(GS.iconPaths);
  Object.keys(glyphs).forEach((g) => {
    const ownOrIcon = iconNames.indexOf(g) >= 0 || ['child', 'bowl', 'tree', 'fish', 'antler', 'cross', 'ball', 'rank', 'chat'].indexOf(g) >= 0;
    assert.ok(ownOrIcon, 'glyph "' + g + '" is not drawn anywhere');
  });
});

test('the glyph keeps at least 3:1 contrast with both tones of its badge, for all 500, and the tones come from the accent', () => {
  let worst = 99;
  ALL.forEach((ch) => {
    const nodes = readSvg(GS.emblemSVG(ch));
    const stops = nodes.filter((n) => n.name === 'stop').map((n) => n.attrs['stop-color']);
    assert.equal(stops.length, 2, ch.id);
    const g = nodes.filter((n) => n.name === 'g')[0];
    assert.ok(g, ch.id + ': no glyph group');
    const ink = g.attrs.stroke;
    assert.ok(nodes.filter((n) => n.depth > 1 && n.name !== 'stop').length >= 1, ch.id + ': the glyph is empty');
    stops.forEach((s) => {
      const c = contrast(ink, s);
      worst = Math.min(worst, c);
      assert.ok(c >= 3, ch.id + ': glyph ' + ink + ' on ' + s + ' is only ' + c.toFixed(2) + ':1');
    });
    // the tones belong to the charity's own accent colour
    stops.forEach((s) => assert.ok(hueGap(s, ch.accent) <= 30, ch.id + ': tone ' + s + ' is far from the accent ' + ch.accent));
    const rim = nodes.find((n) => n.name === 'path').attrs.stroke;   // the badge outline
    assert.ok(hueGap(rim, ch.accent) <= 30, ch.id + ': the outline ' + rim + ' is far from the accent ' + ch.accent);
  });
  assert.ok(worst >= 3, 'worst contrast ' + worst);
});

test('the glyph fits the charity: the main cause gives the default, words in the name and blurb override it', () => {
  let n = 0;   // the emblem of a charity is remembered by its id, so every pretend charity needs its own
  const g = (o) => GS.emblemInfo(Object.assign({ id: 'pretend-' + (++n), name: 'Quiet Fund', short: 'Quiet Fund', blurb: '', causes: ['community'], serves: [], accent: '#6a9df0' }, o)).glyph;
  const oneOf = (v, list, why) => assert.ok(list.indexOf(v) >= 0, why + ': got "' + v + '", expected one of ' + list.join('/'));
  // keyword overrides (the main cause is the vague "community" in all of these)
  assert.equal(g({ name: 'Clean Water Wells' }), 'droplet');
  assert.equal(g({ name: 'Friends of Animal Rescue' }), 'paw-print');
  assert.equal(g({ name: 'Open Book Library Trust' }), 'book-open');
  assert.equal(g({ name: 'Coastal Ocean Guardians' }), 'waves');
  assert.equal(g({ name: 'Shelter for Homeless Families' }), 'house');
  assert.equal(g({ name: 'The Cancer Fund' }), 'ribbon');
  assert.equal(g({ name: 'Eye Care Aid' }), 'eye');
  assert.equal(g({ name: 'School Scholarship Fund' }), 'graduation-cap');
  oneOf(g({ name: 'Veterans Support Network' }), ['rank', 'star', 'medal'], 'veterans');
  oneOf(g({ name: 'Hope Pantry' }), ['wheat', 'bowl'], 'food');
  oneOf(g({ name: 'Wildlife Trust' }), ['antler', 'bird', 'tree', 'leaf'], 'wildlife');
  oneOf(g({ name: 'Children First' }), ['child', 'star'], 'children');
  oneOf(g({ name: 'Orchestra Friends' }), ['music'], 'music');
  // a word in the name beats the main cause; with no keyword the main cause decides
  assert.equal(g({ name: 'Ocean Friends', causes: ['hunger'] }), 'waves');
  assert.equal(g({ causes: ['cancer'] }), 'ribbon');
  assert.equal(g({ causes: ['water'] }), 'droplet');
  assert.equal(g({ causes: ['animals'], name: 'Quiet Fund' }), 'paw-print');
  oneOf(g({ causes: ['hunger'] }), ['wheat', 'bowl'], 'hunger');
  oneOf(g({ causes: ['veterans'] }), ['rank', 'star', 'medal'], 'veterans cause');
  oneOf(g({ causes: ['oceans'] }), ['waves', 'fish', 'sailboat'], 'oceans cause');
  // a blurb alone does not override a clear main cause, but several words in it can
  assert.equal(g({ causes: ['water'], blurb: 'Supports children at school.' }), 'droplet');
  assert.equal(g({ causes: ['community'], blurb: 'Rescues dogs, cats and other animals and finds homes for pets.' }), 'paw-print');
  // nothing in the glyph list names a religion, so a faith-based charity gets its cause's picture
  assert.equal(g({ name: 'Christian Aid Fund', causes: ['water'] }), 'droplet');
  // real charities (skipped quietly when one has left the roster)
  const real = { aspca: ['paw-print'], acs: ['ribbon'], awf: ['antler'], alzheimers: ['brain'], amf: ['syringe'], habitat: ['house'], samaritans: ['chat'], rspb: ['bird'], 'book-aid-international': ['book-open'], 'black-dog-institute': ['brain'], 'fred-hollows-foundation': ['eye'] };
  let checked = 0;
  Object.keys(real).forEach((id) => { const ch = GS.charity(id); if (ch) { checked++; oneOf(GS.emblemInfo(ch).glyph, real[id], id); } });
  assert.ok(checked >= 8, 'only ' + checked + ' of the sample charities are still in the roster');
});

test('a charity with thin or odd data still gets a valid emblem, and nothing at all gets an empty string', () => {
  [{ id: 'x1', accent: '#123456' }, { id: 'x2', name: 'No Causes', causes: [], accent: '#ffffff' }, { id: 'x3', name: 'N', causes: ['nonsense'], serves: ['nobody'], accent: '#000000' },
    { id: 'x4', name: 'Odd', causes: ['kids'], accent: 'not-a-colour' }].forEach((ch) => {
    const svg = GS.emblemSVG(ch);
    readSvg(svg);
    const stops = readSvg(svg).filter((n) => n.name === 'stop').map((n) => n.attrs['stop-color']);
    const ink = readSvg(svg).filter((n) => n.name === 'g')[0].attrs.stroke;
    stops.forEach((s) => assert.ok(contrast(ink, s) >= 3, ch.id + ' contrast ' + contrast(ink, s).toFixed(2)));
  });
  assert.equal(GS.emblemSVG(null), '');
  assert.equal(GS.emblemSVG({}), '');
  assert.equal(GS.emblemInfo(null), null);
});

test('the gradient id can be set for each copy on a page, and is the only thing that changes', () => {
  const ch = ALL[7];
  const a = GS.emblemSVG(ch, 'm1'), b = GS.emblemSVG(ch, 'm2');
  assert.notEqual(a, b);
  assert.equal(a.split('m1').join('m2'), b);
  assert.ok(a.indexOf('id="m1"') > 0 && a.indexOf('url(#m1)') > 0);
  assert.equal(look(a), look(b));
  assert.equal(GS.emblemSVG(ch), GS.emblemSVG(ch, undefined));
});

test('GS.markImage gives a loaded emblem image for a charity with no logo, the logo for one that has it, and falls back to the emblem when a logo will not load', () => {
  const p = makePage();
  const G = p.GS, imgs = p.images;
  const none = G.charities.find((c) => !G.logoFor(c));
  const logo = G.charities.find((c) => G.logoFor(c));
  assert.ok(none && logo);
  assert.equal(G.markImage(null), null);
  // no logo: null while loading, then the same loaded image every time, and its source is the emblem as a data address (no request leaves the page)
  assert.equal(G.markImage(none), null);
  assert.equal(imgs.length, 1);
  assert.match(imgs[0].src, /^data:image\/svg\+xml/);
  assert.equal(decodeURIComponent(imgs[0].src.slice(imgs[0].src.indexOf(',') + 1)), G.emblemSVG(none));
  assert.equal(G.markImage(none), null, 'still loading');
  imgs[0].onload();
  assert.equal(G.markImage(none), imgs[0]);
  assert.equal(G.markImage(none), imgs[0]);
  assert.equal(imgs.length, 1, 'one image per charity, however often it is asked for');
  // a real logo: its own file first
  assert.equal(G.markImage(logo), null);
  assert.equal(imgs.length, 2);
  assert.equal(imgs[1].src, G.logoFor(logo));
  imgs[1].onload();
  assert.equal(G.markImage(logo), imgs[1]);
  // a logo that will not load: the emblem takes its place
  const logo2 = G.charities.filter((c) => G.logoFor(c))[1];
  assert.equal(G.markImage(logo2), null);
  const bad = imgs[imgs.length - 1];
  bad.onerror();
  assert.equal(imgs.length, 4, 'the emblem is requested after the logo failed');
  assert.equal(G.markImage(logo2), null, 'not ready until the emblem has loaded');
  imgs[3].onload();
  assert.equal(G.markImage(logo2), imgs[3]);
  assert.match(imgs[3].src, /^data:image\/svg\+xml/);
  // a failed logo that is told to fail late does not undo the emblem
  bad.onload && bad.onload();
  assert.equal(G.markImage(logo2), imgs[3]);
});
