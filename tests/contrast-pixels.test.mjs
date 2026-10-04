// order: 315
// browser: yes
// quick: no
// covers: css/*, *.html, pages/*, js/hero.js, js/main.js
/* Text over pictures: contrast measured with pixels, the part axe cannot judge. The home page and the First-visit page, fall and winter,
 * 390 and 1280 px, English and Hindi: every visible text is measured against what is really painted behind it. The page is photographed
 * with the letters made see-through (the photo, gradient, hero drawing, scrim or text shadow behind them shows) and the WCAG ratio of the
 * text colour against those pixels is worked out; a text fails when the worst tenth of the pixels in its line boxes is below 4.5:1 (3:1
 * for large text). Text on a plain colour or a plain top-to-bottom gradient is worked out from the colours (the same sum without a photo);
 * any other gradient of colours counts each of its colours. The hero drawing moves: its words are measured at two moments of its
 * animations. Also every hover, keyboard-focus and pressed look of the home page, the hero game's badge in each of its colours, and the
 * top of the First-visit page in summer (its line under the title was too light on the blue sky). A deliberate mistake is put in first,
 * to prove the measuring catches one. Text hidden from screen readers (aria-hidden, the drawings) is left out and counted.
 * The functions are exported: the longer sweep (six pages, four languages, four seasons, more states; letters found by painting them in
 * a test colour) uses the same measure(). */
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* ------------------------------------------------------------------ PNG (Playwright's screenshots: 8-bit RGB or RGBA, not interlaced) */
export function decodePng(buf) {
  let pos = 8, w = 0, h = 0, ct = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('latin1', pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; if (data[8] !== 8 || data[12] !== 0) throw new Error('unexpected PNG format'); }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : 0;
  if (!bpp) throw new Error('PNG colour type ' + ct);
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(w * h * bpp);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[dst + x - bpp] : 0, b = y ? out[dst - stride + x] : 0, c = x >= bpp && y ? out[dst - stride + x - bpp] : 0;
      let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[dst + x] = v & 255;
    }
  }
  return { w, h, bpp, data: out };
}

/* ------------------------------------------------------------------ colour sums (WCAG 2) */
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export const ratio = (a, b) => { const x = lum(a[0], a[1], a[2]), y = lum(b[0], b[1], b[2]); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

/* ------------------------------------------------------------------ in the page */
export function pageCode() {
  if (window.__cx) return;
  const parse = (c) => { const m = String(c || '').match(/-?[\d.]+/g); if (!m || m.length < 3 || /^\s*(none|transparent)\s*$/.test(c)) return null; return [+m[0], +m[1], +m[2], m.length > 3 ? +m[3] : 1]; };
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const over = (t, u) => { const a = t[3]; return [t[0] * a + u[0] * (1 - a), t[1] * a + u[1] * (1 - a), t[2] * a + u[2] * (1 - a), 1]; };
  const tag = (e) => { const p = []; for (let n = e; n && n !== document.body && p.length < 3; n = n.parentElement) p.unshift(n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (typeof n.className === 'string' && n.className.trim() ? '.' + n.className.trim().split(/\s+/)[0] : '')); return p.join(' > '); };
  const fixedOf = (e) => { for (let n = e; n && n.nodeType === 1; n = n.parentElement) { const p = getComputedStyle(n).position; if (p === 'fixed' || p === 'sticky') return n; } return null; };
  const sheet = document.createElement('style'); sheet.id = 'cx-mode';
  // the letters of the texts being photographed (marked data-cx) see-through, or pure green without shadows
  const T = '[data-cx],[data-cx] *,[data-cx]::first-line,[data-cx] *::first-line';
  // something painted in front of the words for a moment (the flying bee) is not what is behind them: it is hidden for the photos
  const OCC = '[data-cx-occ]{visibility:hidden!important}';
  // an SVG text is painted with fill (its outline halo stays in the see-through picture, like a text shadow)
  const SVGT = 'text[data-cx],[data-cx] text,tspan[data-cx],[data-cx] tspan';
  // an underline drawn by a link around the words is not behind them either
  const DECO = '[data-cx-deco]{text-decoration-color:transparent!important}';
  const MODES = {
    '': '',
    bg: T + '{-webkit-text-fill-color:transparent!important;caret-color:transparent!important;text-decoration-color:transparent!important;-webkit-text-stroke-color:transparent!important}' + SVGT + '{fill:transparent!important}' + OCC + DECO,
    g: T + '{-webkit-text-fill-color:#00ff00!important;text-shadow:none!important;caret-color:transparent!important}' + SVGT + '{fill:#00ff00!important;stroke:none!important}' + OCC,
  };
  const S = window.__cx = { items: [], ignored: [], skipped: 0 };
  // hit testing finds everything, also what lets clicks through (the hero drawing, decorations); nothing looks different
  const pe = document.createElement('style'); pe.id = 'cx-pe'; pe.textContent = '*{pointer-events:auto!important}';
  S.hit = (on) => { if (on) document.head.appendChild(pe); else pe.remove(); };
  S.mode = (m) => { sheet.textContent = MODES[m]; if (!sheet.isConnected) document.head.appendChild(sheet); return document.body.offsetHeight; };

  // animations: transitions jump to their end, endless loops stand still at a chosen point of their cycle (f = 0..1), short ones end
  S.anim = (f) => {
    S.f = f;
    for (const a of document.getAnimations()) {
      try {
        if (typeof CSSTransition !== 'undefined' && a instanceof CSSTransition) { a.finish(); continue; }
        const t = a.effect.getComputedTiming();
        if (t.iterations === Infinity || t.endTime === Infinity) { a.pause(); a.currentTime = (t.delay || 0) + (Number(t.duration) || 0) * f; }
        else a.finish();
      } catch (e) { /* an animation that cannot be moved */ }
    }
  };

  // the part of a box that clipping parents leave visible (sr-only text, a strip scrolled sideways)
  const visiblePart = (e, q) => {
    let r = { l: q.left, t: q.top, r: q.right, b: q.bottom };
    for (let n = e; n && n !== document.documentElement; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (/inset\(50%/.test(s.clipPath) || /^rect\(0px,? 0px,? 0px,? 0px\)$/.test(s.clip)) return null;
      if (s.overflowX !== 'visible' || s.overflowY !== 'visible') {
        const k = n.getBoundingClientRect();
        if (s.overflowX !== 'visible') { r.l = Math.max(r.l, k.left); r.r = Math.min(r.r, k.right); }
        if (s.overflowY !== 'visible') { r.t = Math.max(r.t, k.top); r.b = Math.min(r.b, k.bottom); }
      }
      if (r.r - r.l < 1 || r.b - r.t < 4) return null;
    }
    return r;
  };
  const rectsOf = (it) => {
    const out = [];
    for (const n of it.nodes) {
      if (!n.isConnected) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      for (const q of rg.getClientRects()) { if (q.width < 1 || q.height < 4) continue; const v = visiblePart(it.el, q); if (v) out.push({ x: v.l, y: v.t, w: v.r - v.l, h: v.b - v.t }); }
    }
    return out;
  };

  // every element with its own visible words (one item per element: the words of a link inside a sentence are the link's)
  S.collect = (scope, skip) => {
    S.items = []; S.ignored = []; S.skipped = 0;
    // the sections that fade in when scrolled to: as a reader sees them once there
    document.querySelectorAll('.reveal, .crop-row, .goat-nook').forEach((e) => e.classList.add('in'));
    S.anim(S.f || 0);
    const roots = scope ? [...document.querySelectorAll(scope)].filter((r, k, all) => !all.some((o) => o !== r && o.contains(r))) : [document.body];
    const groups = new Map();
    for (const root of roots) {
      const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (tw.nextNode()) {
        const n = tw.currentNode;
        if (!/\S/.test(n.nodeValue)) continue;
        const e = n.parentElement;
        if (!e || e.closest('script,style,noscript,template,title,option') || (skip && e.closest(skip))) continue;
        let g = groups.get(e); if (!g) groups.set(e, (g = [])); g.push(n);
      }
      // the words a placeholder shows in an empty field
      for (const f of root.querySelectorAll('input[placeholder], textarea[placeholder]')) if (!f.value && f.placeholder.trim()) groups.set(f, 'placeholder');
    }
    for (const [e, nodes] of groups) {
      if (!e.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      const it = { el: e, nodes: nodes === 'placeholder' ? [] : nodes, placeholder: nodes === 'placeholder' };
      const rects = it.placeholder ? [(() => { const q = e.getBoundingClientRect(); return { x: q.left, y: q.top, w: q.width, h: q.height }; })()] : rectsOf(it);
      if (!rects.length || rects.every((q) => q.y + q.h + scrollY <= 0 || q.x + q.w <= 0 || q.x >= innerWidth)) { S.skipped++; continue; }
      const text = it.placeholder ? e.placeholder : nodes.map((x) => x.nodeValue).join(' ').replace(/\s+/g, ' ').trim();
      if (!S.withHidden && (e.closest('[aria-hidden="true"]') || (e instanceof SVGElement && e.closest('svg:not([role="img"])')))) { S.ignored.push(tag(e) + ' "' + text.slice(0, 30) + '"'); continue; }
      const cs = getComputedStyle(e, it.placeholder ? '::placeholder' : null);
      const fs = parseFloat(cs.fontSize), fw = parseInt(cs.fontWeight, 10) || 400;
      it.i = S.items.length; it.text = text.slice(0, 60); it.sel = tag(e); it.size = fs; it.weight = fw;
      it.large = fs >= 24 || (fs >= 18.66 && fw >= 700);   // 18pt, or 14pt bold
      it.fixed = !!fixedOf(e);
      it.y = rects[0].y + (it.fixed ? 0 : scrollY);
      it.done = false;
      S.items.push(it);
    }
    return { n: S.items.length, ignored: S.ignored.length, skipped: S.skipped };
  };

  // What is behind one point of the words: 'solid' with the colour (layers mixed down to the first opaque one), 'pixel' when a picture, a
  // gradient, a drawing, a see-through group, a filter or a text shadow is involved, or 'covered' when something else is painted on top.
  // A plain top-to-bottom linear-gradient (no picture, one layer, its own size): the colour at any height is worked out, no photo needed.
  const gradient = (n, s) => {
    const m = /^linear-gradient\((.*)\)$/.exec(s.backgroundImage);
    if (!m || /url\(|gradient\(.*gradient\(/.test(s.backgroundImage) || !/^auto( auto)?$/.test(s.backgroundSize) || s.backgroundAttachment !== 'scroll') return null;
    const parts = []; let d = 0, cur = '';
    for (const ch of m[1]) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && !d) { parts.push(cur.trim()); cur = ''; } else cur += ch; }
    parts.push(cur.trim());
    if (/^(to bottom|180deg)$/.test(parts[0])) parts.shift(); else if (/^(to |-?[\d.]+(deg|turn|rad))/.test(parts[0])) return null;
    const r = n.getBoundingClientRect(), top = r.top + parseFloat(s.borderTopWidth), h = r.height - parseFloat(s.borderTopWidth) - parseFloat(s.borderBottomWidth);
    const stops = [];
    for (const p of parts) {
      const cm = /^(rgba?\([^)]*\))\s*(.*)$/.exec(p); if (!cm) return null;
      const col = parse(cm[1]); const pos = cm[2].trim().split(/\s+/).filter(Boolean);
      if (pos.length > 1) return null;
      stops.push({ col, at: !pos.length ? null : /%$/.test(pos[0]) ? parseFloat(pos[0]) / 100 * h : /px$/.test(pos[0]) ? parseFloat(pos[0]) : NaN });
    }
    if (stops.some((q) => Number.isNaN(q.at)) || stops.length < 2) return null;
    if (stops[0].at == null) stops[0].at = 0;
    if (stops[stops.length - 1].at == null) stops[stops.length - 1].at = h;
    for (let i = 1; i < stops.length; i++) { if (stops[i].at == null) { let j = i; while (stops[j].at == null) j++; for (let k = i; k < j; k++) stops[k].at = stops[i - 1].at + (stops[j].at - stops[i - 1].at) * (k - i + 1) / (j - i + 1); } stops[i].at = Math.max(stops[i].at, stops[i - 1].at); }
    return (y) => {
      const t = y - top;
      if (t <= stops[0].at) return stops[0].col;
      for (let i = 1; i < stops.length; i++) if (t <= stops[i].at) { const a = stops[i - 1], b = stops[i], f = b.at > a.at ? (t - a.at) / (b.at - a.at) : 1; return a.col.map((v, k) => v + (b.col[k] - v) * f); }
      return stops[stops.length - 1].col;
    };
  };
  // Any other gradient made only of colours (the dots of the pizza section): somewhere behind the words it may be any of its colours, so
  // each is tried and the worst one counts (stricter than the photo, never kinder).
  const hull = (s) => {
    if (/url\(|image-set|element\(/.test(s.backgroundImage)) return null;
    const cols = (s.backgroundImage.match(/rgba?\([^)]*\)/g) || []).map(parse).filter(Boolean);
    return cols.length ? cols : null;
  };
  let memo = new Map();   // what one element paints, worked out once per screen
  const paint = (n) => {
    let v = memo.get(n);
    if (v) return v;
    const s = getComputedStyle(n), t = n.tagName.toUpperCase();
    v = { bg: parse(s.backgroundColor) };
    if (parseFloat(s.opacity) === 0 || s.visibility === 'hidden') { v.paints = false; v.bg = null; memo.set(n, v); return v; }   // an invisible input laid over a label
    if (/^(IMG|VIDEO|CANVAS|IFRAME|PICTURE)$/.test(t) || n instanceof SVGElement) v.pixel = 'picture ' + t.toLowerCase();
    else if (s.backgroundImage !== 'none' && !(S.fast && ((v.grad = gradient(n, s)) || (v.hull = hull(s))))) v.pixel = 'background image or gradient';
    else if (parseFloat(s.opacity) < 1) v.pixel = 'see-through';
    else if (s.filter !== 'none' || s.backdropFilter !== 'none' || (s.webkitBackdropFilter && s.webkitBackdropFilter !== 'none') || s.mixBlendMode !== 'normal') v.pixel = 'filter';
    else if (s.boxShadow.includes('inset')) v.pixel = 'inset shadow';
    else {
      // a ::before / ::after that paints: where it is, when it is a plain absolutely placed box (a tick, a chevron); else anywhere
      v.deco = [];
      for (const pe of ['::before', '::after']) {
        const ps = getComputedStyle(n, pe);
        if (ps.content === 'none' || ps.content === 'normal') continue;
        const pc = parse(ps.backgroundColor);
        if (!((pc && pc[3] > 0) || ps.backgroundImage !== 'none' || ps.boxShadow !== 'none')) continue;
        let box = null;
        const mx = ps.transform === 'none' ? [1, 0, 0, 1, 0, 0] : (/^matrix\(([^)]*)\)$/.exec(ps.transform) || [, ''])[1].split(',').map(Number);
        if (ps.position === 'absolute' && s.position !== 'static' && mx.length === 6 && /px$/.test(ps.left) && /px$/.test(ps.top) && /px$/.test(ps.width) && /px$/.test(ps.height)) {
          const r = n.getBoundingClientRect(), extra = ps.boxSizing === 'border-box' ? 0 : 1;
          const w = parseFloat(ps.width) + extra * (parseFloat(ps.paddingLeft) + parseFloat(ps.paddingRight) + parseFloat(ps.borderLeftWidth) + parseFloat(ps.borderRightWidth));
          const h = parseFloat(ps.height) + extra * (parseFloat(ps.paddingTop) + parseFloat(ps.paddingBottom) + parseFloat(ps.borderTopWidth) + parseFloat(ps.borderBottomWidth));
          const x = r.left + parseFloat(s.borderLeftWidth) + parseFloat(ps.left), y = r.top + parseFloat(s.borderTopWidth) + parseFloat(ps.top);
          // its four corners after its transform (turned round its transform-origin)
          const [ox, oy] = ps.transformOrigin.split(' ').map(parseFloat), [a, b, c, d, tx, ty] = mx;
          const cs4 = [[0, 0], [w, 0], [0, h], [w, h]].map(([px, py]) => [x + ox + a * (px - ox) + c * (py - oy) + tx, y + oy + b * (px - ox) + d * (py - oy) + ty]);
          const sh = ps.boxShadow === 'none' ? 0 : 12;   // a shadow reaches a little further
          box = { l: Math.min(...cs4.map((q) => q[0])) - 2 - sh, t: Math.min(...cs4.map((q) => q[1])) - 2 - sh, r: Math.max(...cs4.map((q) => q[0])) + 2 + sh, b: Math.max(...cs4.map((q) => q[1])) + 2 + sh };
        }
        v.deco.push({ pe, box });
      }
    }
    v.paints = !!(v.pixel || (v.bg && v.bg[3] > 0));
    memo.set(n, v);
    return v;
  };
  // the colour of the letters: an SVG text is painted with its fill
  const ink = (e, cs) => (e instanceof SVGElement ? parse(cs.fill) : null) || parse(cs.color) || [0, 0, 0, 1];
  const behind = (it, x, y, cs) => {
    const stack = document.elementsFromPoint(x, y), e = it.el;
    const k = stack.findIndex((n) => n === e || e.contains(n));
    if (k < 0) return { covered: true };
    const decoAt = (v) => (v.deco || []).find((d) => !d.box || (x >= d.box.l && x <= d.box.r && y >= d.box.t && y <= d.box.b));
    for (let j = 0; j < k; j++) { if (stack[j].contains(e)) continue; const v = paint(stack[j]); if (v.paints || decoAt(v)) return { covered: true }; }   // something painted on top of the words (a parent found first is only its positioned ::before)
    const layers = [];
    for (let j = 0; j < stack.length; j++) {
      if (j < k && !stack[j].contains(e)) continue;
      const n = stack[j];
      if (n !== e && e.contains(n)) continue;   // an icon or a word inside the element
      const v = paint(n);
      if (v.pixel) return { pixel: v.pixel };
      const d = decoAt(v); if (d) return { pixel: 'decoration ' + d.pe };
      if (v.grad) { const gc = v.grad(y); layers.push(gc); if (gc[3] >= 0.999) break; }   // painted over the background colour
      if (v.hull) layers.push({ any: v.hull });
      if (v.bg && v.bg[3] > 0) { layers.push(v.bg); if (v.bg[3] >= 0.999) break; }
    }
    let bgs = [[255, 255, 255, 1]];   // the canvas under everything is white
    for (let j = layers.length - 1; j >= 0; j--) {
      const L = layers[j];
      if (L.any) { const next = []; for (const b of bgs) { next.push(b); for (const c of L.any) next.push(over(c, b)); } bgs = next.slice(0, 64); }
      else bgs = bgs.map((b) => over(L, b));
    }
    if (cs.webkitTextFillColor && cs.webkitTextFillColor !== cs.color && !it.placeholder && !(it.el instanceof SVGElement)) return { pixel: 'text fill' };
    let best = null;
    for (const bg of bgs) { const fg = over(ink(it.el, cs), bg), v = ratio(fg, bg); if (!best || v < best.ratio) best = { solid: true, bg: bg.slice(0, 3).map(Math.round), fg: fg.slice(0, 3).map(Math.round), ratio: v }; }
    return best;
  };

  // One screen: the items whose lines are all inside [top, bottom] (and not done yet). Plain ones are worked out here; for the others the
  // boxes to photograph come back.
  S.stop = (top, bottom, fixedToo, force) => {
    memo = new Map();
    S.mode('');
    document.querySelectorAll('[data-cx], [data-cx-occ], [data-cx-deco]').forEach((e) => { e.removeAttribute('data-cx'); e.removeAttribute('data-cx-occ'); e.removeAttribute('data-cx-deco'); });
    const done = [], pix = [];
    for (const it of S.items) {
      if (force != null && it.i !== force) continue;
      if (it.done || (force == null && ((it.fixed && !fixedToo) || (!it.fixed && fixedToo === 'only')))) continue;
      if (!it.fixed && (it.y < scrollY - 400 || it.y > scrollY + innerHeight + 400)) continue;
      if (!it.el.isConnected || !it.el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      const rects = it.placeholder ? [(() => { const q = it.el.getBoundingClientRect(); return { x: q.left, y: q.top, w: q.width, h: q.height }; })()] : rectsOf(it);
      if (!rects.length) continue;
      const box = rects.reduce((a, r) => ({ t: Math.min(a.t, r.y), b: Math.max(a.b, r.y + r.h), l: Math.min(a.l, r.x), r: Math.max(a.r, r.x + r.w) }), { t: 1e9, b: -1e9, l: 1e9, r: -1e9 });
      if (force == null && (box.t < top || box.b > bottom || box.l < 0 || box.r > innerWidth)) continue;
      it.done = true;
      const cs = getComputedStyle(it.el, it.placeholder ? '::placeholder' : null);
      const res = { i: it.i, text: it.text, sel: it.sel, large: it.large, size: it.size, weight: it.weight, box: { x: box.l, y: box.t, w: box.r - box.l, h: box.b - box.t }, pageY: Math.round(box.t + (it.fixed ? 0 : scrollY)) };
      let why = null, worst = null; const pts = [];
      if (cs.textShadow !== 'none' && !it.placeholder) why = 'text shadow';
      if (S.allPixels && !it.placeholder) why = why || 'all';
      rects.forEach((r, k) => { for (const fx of (k === 0 || k === rects.length - 1 ? [0.08, 0.5, 0.92] : [0.5])) pts.push([r.x + r.w * fx, r.y + r.h / 2]); });
      for (const [x, y] of pts) {
        if (why) break;
        const b = behind(it, x, y, cs);
        if (b.covered) continue;
        if (b.pixel) { why = b.pixel; break; }
        if (!worst || b.ratio < worst.ratio) worst = b;
      }
      if (why) {
        // whatever is painted in front of the words anywhere along their lines (every 16px) is hidden for the photos
        for (const r of rects) for (let x = r.x + 2; x < r.x + r.w; x += 16) {
          const st = document.elementsFromPoint(x, r.y + r.h / 2), k = st.findIndex((n) => n === it.el || it.el.contains(n));
          for (let j = 0; j < k; j++) {
            if (st[j].contains(it.el) || !paint(st[j]).paints) continue;
            // the whole small thing in front (all of the bee, not one stripe of it)
            let o = st[j];
            for (let a = o.parentElement; a && !a.contains(it.el); a = a.parentElement) { const q = a.getBoundingClientRect(); if (q.width * q.height > Math.max(20000, 4 * r.w * r.h)) break; o = a; }
            o.setAttribute('data-cx-occ', '');
          }
        }
        for (let a = it.el; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).textDecorationLine !== 'none') a.setAttribute('data-cx-deco', '');
        it.el.setAttribute('data-cx', ''); it.el.setAttribute('data-cx-px', ''); pix.push({ ...res, why, rects, color: ink(it.el, cs), op: (() => { let o = 1; for (let n = it.el; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); return o; })() }); continue; }
      if (!worst) { done.push({ ...res, covered: true }); continue; }
      done.push({ ...res, mode: 'colour', ratio: Math.round(worst.ratio * 100) / 100, fg: worst.fg, bg: worst.bg });
    }
    return { done, pix };
  };
  // where the page and the first line of each of these texts are now (to see that nothing moved while it was photographed)
  S.where = (ids) => [scrollX, scrollY, ...ids.flatMap((i) => { const r = rectsOf(S.items[i])[0]; return r ? [r.x, r.y] : [-1, -1]; })];
  S.left = () => S.items.filter((it) => !it.done && it.el.isConnected && it.el.checkVisibility({ opacityProperty: true, visibilityProperty: true })).map((it) => ({ i: it.i, y: it.y, fixed: it.fixed, text: it.text }));
  // the band of the window that nothing fixed covers (sticky header on top, the phone's bottom bar, the Site check box)
  S.band = () => {
    let top = 0, bottom = innerHeight;
    const hdr = document.querySelector('.site-header'); if (hdr) top = Math.max(top, hdr.getBoundingClientRect().bottom);
    for (const sel of ['.action-bar', '#wa-problems']) { const b = document.querySelector(sel); if (b && b.checkVisibility() && getComputedStyle(b).position === 'fixed') bottom = Math.min(bottom, b.getBoundingClientRect().top); }
    return { top: top + 2, bottom: bottom - 2 };
  };
  S.waitImages = () => Promise.all([...document.images].filter((i) => { const r = i.getBoundingClientRect(); return r.bottom > -200 && r.top < innerHeight + 200 && !i.complete && i.currentSrc; }).map((i) => (i.decode ? i.decode().catch(() => {}) : null)));
  // the next screen: scroll to the first text not measured yet, let its pictures arrive, measure what fits between the header and the bottom bar
  S.next = async (f) => {
    const left = S.items.filter((it) => !it.done && !it.fixed && it.el.isConnected && it.el.checkVisibility({ opacityProperty: true, visibilityProperty: true }));
    if (!left.length) return null;
    left.sort((a, b) => a.y - b.y);
    const b0 = S.band();
    scrollTo({ top: Math.max(0, left[0].y - b0.top - 8), left: 0, behavior: 'instant' });
    await S.waitImages();
    S.anim(f);
    const b = S.band();
    let r = S.stop(b.top, b.bottom, false);
    if (!r.done.length && !r.pix.length) { r = S.stop(0, innerHeight, false, left[0].i); r.done.forEach((x) => { x.partial = true; }); r.pix.forEach((x) => { x.partial = true; }); if (!r.done.length && !r.pix.length) { left[0].done = true; r.done.push({ i: left[0].i, text: left[0].text, sel: left[0].sel, covered: true, partial: true }); } }
    return r;
  };
}

/* ------------------------------------------------------------------ in Node: walk a page screen by screen */
const SAMPLE = (A, G, clip, dpr, item) => {
  // A: letters see-through (whatever is behind them shows, text shadows included), G: letters pure green without shadows.
  // A letter pixel is pure green in G and something else in A; behind it is A.
  const col = item.color || [0, 0, 0, 1], alpha = (col[3] == null ? 1 : col[3]) * (item.op == null ? 1 : item.op);
  const rs = []; let worst = null;
  for (const r of item.rects) {
    const x0 = Math.max(0, Math.floor((r.x - clip.x) * dpr)), y0 = Math.max(0, Math.floor((r.y - clip.y) * dpr));
    const x1 = Math.min(A.w, Math.ceil((r.x + r.w - clip.x) * dpr)), y1 = Math.min(A.h, Math.ceil((r.y + r.h - clip.y) * dpr));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const k = (y * A.w + x) * A.bpp, kg = G ? (y * G.w + x) * G.bpp : 0;
      if (G && (G.data[kg] > 12 || G.data[kg + 1] < 243 || G.data[kg + 2] > 12)) continue;   // not a letter (without G: every pixel of the line box)
      const bg = [A.data[k], A.data[k + 1], A.data[k + 2]];
      if (G && bg[0] < 30 && bg[1] > 225 && bg[2] < 30) continue;   // green behind green: cannot tell
      const fg = [col[0] * alpha + bg[0] * (1 - alpha), col[1] * alpha + bg[1] * (1 - alpha), col[2] * alpha + bg[2] * (1 - alpha)];
      const v = ratio(fg, bg);
      rs.push(v);
      if (!worst || v < worst.v) worst = { v, x: clip.x + x / dpr, y: clip.y + y / dpr, bg };
    }
  }
  if (rs.length < 12) return null;
  rs.sort((a, b) => a - b);
  return { worst: Math.round(rs[0] * 100) / 100, p10: Math.round(rs[Math.floor(rs.length * 0.1)] * 100) / 100, n: rs.length, at: worst && { x: Math.round(worst.x), y: Math.round(worst.y), bg: worst.bg } };
};

/**
 * Measures every text of the page (or of `scope`, a selector; `skip`: a selector left out). Returns { results, ignored, skipped }.
 * opts: dpr (the context's device scale factor, default 2), anim (0..1: the moment of the endless animations), crops (a folder: failing
 * texts are saved there as pictures) and tag (a name for those files), fast (plain gradients worked out from their colours), box (every
 * pixel of the line boxes instead of only the letters: one picture instead of two), allPixels (photograph every text, for checking),
 * withHidden (also the text hidden from screen readers).
 */
export async function measure(p, opts = {}) {
  const dpr = opts.dpr || 2, anim = opts.anim == null ? 0.15 : opts.anim;
  await p.evaluate(pageCode);
  await p.evaluate((h) => { scrollTo({ top: 0, left: 0, behavior: 'instant' }); window.__cx.withHidden = h; }, !!opts.withHidden);
  await p.evaluate((f) => window.__cx.anim(f), anim);
  const info = await p.evaluate(([s, k]) => window.__cx.collect(s, k), [opts.scope || null, opts.skip || null]);
  await p.evaluate(([a, f]) => { window.__cx.hit(true); window.__cx.allPixels = a; window.__cx.fast = f; }, [!!opts.allPixels, !!opts.fast]);
  const results = [];
  const cdp = await p.context().newCDPSession(p);
  // the clip of Page.captureScreenshot is in page coordinates (the window's scroll position added)
  const shoot = async (clip, at) => { const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: clip.x + at[0], y: clip.y + at[1], width: clip.width, height: clip.height, scale: dpr }, captureBeyondViewport: false }); return decodePng(Buffer.from(data, 'base64')); };
  const pixels = async (pix) => {
    if (!pix.length) return;
    const vw = await p.evaluate(() => [innerWidth, innerHeight, scrollX, scrollY]);
    // texts close together share one picture
    const groups = [];
    for (const it of pix.slice().sort((a, b) => a.box.y - b.box.y)) {
      const g = groups[groups.length - 1], u = g && { l: Math.min(g.l, it.box.x), t: Math.min(g.t, it.box.y), r: Math.max(g.r, it.box.x + it.box.w), b: Math.max(g.b, it.box.y + it.box.h) };
      if (g && (u.r - u.l) * (u.b - u.t) <= 1.6 * (g.area + it.box.w * it.box.h)) { Object.assign(g, u); g.area += it.box.w * it.box.h; g.items.push(it); }
      else groups.push({ l: it.box.x, t: it.box.y, r: it.box.x + it.box.w, b: it.box.y + it.box.h, area: it.box.w * it.box.h, items: [it] });
    }
    for (const g of groups) {
      g.clip = { x: Math.max(0, Math.floor(g.l - 2)), y: Math.max(0, Math.floor(g.t - 2)) };
      g.clip.width = Math.min(vw[0], Math.ceil(g.r + 2)) - g.clip.x; g.clip.height = Math.min(vw[1], Math.ceil(g.b + 2)) - g.clip.y;
    }
    let ok = groups.filter((g) => g.clip.width >= 2 && g.clip.height >= 2);
    if (ok.length > 2) {   // many: one picture of the part of the screen that holds them all
      const u = { l: Math.min(...ok.map((g) => g.clip.x)), t: Math.min(...ok.map((g) => g.clip.y)), r: Math.max(...ok.map((g) => g.clip.x + g.clip.width)), b: Math.max(...ok.map((g) => g.clip.y + g.clip.height)) };
      ok = [{ clip: { x: u.l, y: u.t, width: u.r - u.l, height: u.b - u.t }, items: ok.flatMap((g) => g.items) }];
    }
    // the photos are only used when nothing moved while they were taken (a page still scrolling, a block still being redrawn)
    const ids = pix.map((it) => it.i), expect = [vw[2], vw[3], ...pix.flatMap((it) => [it.rects[0].x, it.rects[0].y])];
    const same = (a) => a.length === expect.length && a.every((v, k) => Math.abs(v - expect[k]) < 1.5);
    let steady = false;
    for (let tries = 0; tries < 3 && !steady; tries++) {
      if (tries) { await p.evaluate(([x, y, f]) => { scrollTo({ left: x, top: y, behavior: 'instant' }); window.__cx.anim(f); }, [vw[2], vw[3], anim]); await p.waitForTimeout(150); }
      if (!same(await p.evaluate((i) => window.__cx.where(i), ids))) continue;
      await p.evaluate(() => window.__cx.mode('bg'));
      for (const g of ok) g.A = await shoot(g.clip, [vw[2], vw[3]]);
      if (!opts.box) { await p.evaluate(() => window.__cx.mode('g')); for (const g of ok) g.G = await shoot(g.clip, [vw[2], vw[3]]); }
      steady = same(await p.evaluate((i) => window.__cx.where(i), ids));
    }
    if (!steady) { for (const it of pix) results.push({ i: it.i, text: it.text, sel: it.sel, large: it.large, box: it.box, pageY: it.pageY, mode: 'pixels', why: it.why, covered: true, moving: true }); return; }
    for (const g of ok) {
      const { A, G, clip } = g;
      for (const it of g.items) {
        const m = SAMPLE(A, G, clip, dpr, it);
        const r = { i: it.i, text: it.text, sel: it.sel, large: it.large, size: it.size, weight: it.weight, box: it.box, pageY: it.pageY, mode: 'pixels', why: it.why, partial: it.partial };
        if (!m) { results.push({ ...r, covered: true }); continue; }
        Object.assign(r, m, { ratio: m.p10 });
        results.push(r);
      }
    }
  };
  const crop = async (r) => {
    if (!opts.crops) return;
    const need = r.large ? 3 : 4.5;
    if (r.covered || r.ratio >= need) return;
    const vw = await p.evaluate(() => [innerWidth, innerHeight]);
    const clip = { x: Math.max(0, r.box.x - 10), y: Math.max(0, r.box.y - 10) };
    clip.width = Math.max(4, Math.min(vw[0] - clip.x, r.box.w + 20)); clip.height = Math.max(4, Math.min(vw[1] - clip.y, r.box.h + 20));
    const file = path.join(opts.crops, `${opts.tag || 'x'}-${r.i}.png`);
    await p.evaluate(() => window.__cx.mode(''));   // the page as it really looks
    try { await p.screenshot({ path: file, clip }); r.crop = file; } catch (e) { /* off screen */ }
  };
  // fixed things first (header, notice bar, bottom bar), at the top of the page
  {
    const s = await p.evaluate(() => window.__cx.stop(0, innerHeight, 'only'));
    const before = results.length;
    results.push(...s.done); await pixels(s.pix);
    for (const r of results.slice(before)) await crop(r);
  }
  for (let guard = 0; guard < 400; guard++) {
    const s = await p.evaluate((f) => window.__cx.next(f), anim);
    if (!s) break;
    const before = results.length;
    results.push(...s.done); await pixels(s.pix);
    for (const r of results.slice(before)) await crop(r);
  }
  await p.evaluate(() => { window.__cx.hit(false); window.__cx.mode(''); document.querySelectorAll('[data-cx], [data-cx-occ], [data-cx-deco]').forEach((e) => { e.removeAttribute('data-cx'); e.removeAttribute('data-cx-occ'); e.removeAttribute('data-cx-deco'); }); });
  return { results, ignored: await p.evaluate(() => window.__cx.ignored), skipped: info.skipped };
}

export const fails = (rs) => rs.filter((r) => !r.covered && r.ratio != null && r.ratio < (r.large ? 3 : 4.5));

/* ------------------------------------------------------------------ hover, keyboard focus, pressed: which elements change their look */
// Marks (data-cx-hover / -focus / -active) the elements a :hover, :focus(-visible/-within) or :active rule gives another colour, background,
// opacity, filter, shadow or transform. Returns how many.
export function markStateTargets() {
  const PROPS = /(^|;\s*)(color|background(-color|-image)?|opacity|filter|text-shadow|-webkit-text-fill-color|transform|translate|scale|visibility|display|mix-blend-mode)\s*:/;
  const split = (s) => { const out = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && !d) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map((x) => x.trim()); };
  const RE = { hover: /:hover/, focus: /:focus(-visible|-within)?\b/, active: /:active/ };
  const sets = { hover: new Set(), focus: new Set(), active: new Set() };
  const visit = (rules) => {
    for (const r of rules) {
      if (r.cssRules && !(r instanceof CSSStyleRule)) {
        if (r instanceof CSSMediaRule && !matchMedia(r.conditionText || r.media.mediaText).matches) continue;
        if (typeof CSSSupportsRule !== 'undefined' && r instanceof CSSSupportsRule && !CSS.supports(r.conditionText)) continue;
        visit(r.cssRules); continue;
      }
      if (!(r instanceof CSSStyleRule) || !PROPS.test(r.style.cssText)) continue;
      for (const sel of split(r.selectorText)) {
        for (const k of Object.keys(RE)) {
          const m = RE[k].exec(sel);
          if (!m || /:not\([^)]*:(hover|focus|active)/.test(sel)) continue;
          let end = m.index, d = 0;
          while (end < sel.length) { const ch = sel[end]; if (ch === '(') d++; else if (ch === ')') d--; else if (!d && /[\s>+~]/.test(ch)) break; end++; }
          const target = sel.slice(0, end).replace(/:(hover|focus-visible|focus-within|focus|active)\b/g, '').trim() || '*';
          try { document.querySelectorAll(target).forEach((e) => { if (e.checkVisibility && e.checkVisibility()) sets[k].add(e); }); } catch (e) { /* a selector this browser does not take */ }
        }
      }
    }
  };
  for (const sh of document.styleSheets) { try { visit(sh.cssRules); } catch (e) { /* another site's sheet */ } }
  for (const k of Object.keys(sets)) { document.querySelectorAll('[data-cx-' + k + ']').forEach((e) => e.removeAttribute('data-cx-' + k)); sets[k].forEach((e) => e.setAttribute('data-cx-' + k, '')); }
  return Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, v.size]));
}
// The look of the marked elements and everything in them, saved (save: true) or compared: changed ones get data-cx-s. Returns how many changed.
export function stateSignatures([kind, save]) {
  const sig = (e) => { const s = getComputedStyle(e); return [s.color, s.backgroundColor, s.backgroundImage, s.opacity, s.filter, s.textShadow, s.webkitTextFillColor, s.visibility, s.display].join('|'); };
  const els = new Set();
  document.querySelectorAll('[data-cx-' + kind + ']').forEach((t) => { els.add(t); t.querySelectorAll('*').forEach((c) => els.add(c)); let a = t.parentElement; for (let i = 0; a && i < 3; i++, a = a.parentElement) els.add(a); });
  if (save) { window.__cxSig = new Map([...els].map((e) => [e, sig(e)])); return els.size; }
  document.querySelectorAll('[data-cx-s]').forEach((e) => e.removeAttribute('data-cx-s'));
  let n = 0;
  for (const [e, v] of window.__cxSig) if (e.isConnected && sig(e) !== v) { (e.closest('[data-cx-' + kind + ']') || e).setAttribute('data-cx-s', ''); n++; }
  return n;
}
export const STATES = [['hover', ['hover']], ['focus', ['focus', 'focus-visible', 'focus-within']], ['active', ['active', 'hover', 'focus']]];
/** Puts every marked element of `kind` in that state (or back), through the browser's developer tools. */
export async function forceState(cdp, kind, classes, on) {
  const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
  const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '[data-cx-' + kind + ']' });
  await Promise.all(nodeIds.map((nodeId) => cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: on ? classes : [] }).catch(() => {})));
  return nodeIds.length;
}

/* ------------------------------------------------------------------ the test */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { run, open, ok, info, until } = await import('./lib.mjs');
  const DATES = { summer: '2026-06-26T12:00:00-04:00', fall: '2026-10-02T12:00:00-04:00', winter: '2026-12-04T12:00:00-05:00' };
  const HTML = { en: 'en', hi: 'hi' };
  const TALL = 2400;   // below the hero the window is made tall, so there are fewer screens to photograph (nothing there depends on the window's height)
  const show = (rs) => rs.slice(0, 6).map((r) => `${r.sel.split(' > ').slice(-2).join(' > ')} "${r.text.slice(0, 30)}" ${r.ratio}:1 (needs ${r.large ? 3 : 4.5}${r.at ? ', worst at ' + r.at.x + ',' + r.at.y : ''})`).join(' | ');
  const fast = { fast: true, box: true };
  // each page and season opened once; the language is switched in the page, the width by resizing the window
  const PLAN = [
    // fixed: the line under the title of the five smaller pages was light brown on the blue top of the summer sky (4.0:1 on a phone)
    ['first-visit.html', 'summer', [['en', 390, 'top'], ['hi', 1280, 'top']]],
    ['first-visit.html', 'fall', [['en', 1280, 'page'], ['hi', 390, 'page']]],
    ['first-visit.html', 'winter', [['en', 390, 'top'], ['hi', 1280, 'top']]],
    ['index.html', 'fall', [['en', 1280, 'page moments states']]],
    ['index.html', 'winter', [['hi', 1280, 'hero'], ['en', 390, 'hero']]],
  ];
  await run('contrast-pixels', async ({ browser, base, errs }) => {
    const t0 = Date.now(), took = () => Math.round((Date.now() - t0) / 1000) + ' s';
    const ignored = {};
    for (const [url, season, runs] of PLAN) {
      const p = await open(browser, base, url, errs, { viewport: { width: runs[0][1], height: runs[0][1] < 600 ? 800 : 900 }, deviceScaleFactor: 2, time: DATES[season] });
      if (url === 'first-visit.html' && season === 'summer') {
        // the measuring works: white words on the page-top colour band and grey words on white are caught, dark words on the band pass
        await p.evaluate(() => {
          const top = document.querySelector('.page-hero-copy');
          top.insertAdjacentHTML('beforeend', '<p id="cxp-white" style="color:#fff;font-size:16px;font-weight:600">White words on the page-top band</p><p id="cxp-dark" style="color:#3a2416;font-size:16px">Dark words on the page-top band</p>');
          document.querySelector('main').insertAdjacentHTML('beforeend', '<p id="cxp-grey" style="color:#aaa;background:#fff;font-size:16px">Light grey on white</p>');
        });
        const pr = await measure(p, { ...fast, scope: '#cxp-white, #cxp-dark, #cxp-grey' });
        const by = (id) => pr.results.find((r) => r.sel.endsWith('#' + id)) || {};
        ok('the measuring catches bad contrast: white words on the band and light grey on white fail, dark words on the band pass', fails([by('cxp-white')]).length === 1 && fails([by('cxp-grey')]).length === 1 && by('cxp-dark').ratio >= 4.5,
          JSON.stringify(['cxp-white', 'cxp-grey', 'cxp-dark'].map((id) => [id, by(id).mode, by(id).ratio])));
        await p.evaluate(() => document.querySelectorAll('#cxp-white, #cxp-dark, #cxp-grey').forEach((e) => e.remove()));
      }
      for (const [lang, width, what] of runs) {
        const label = `${url} ${season} ${lang} ${width}px`, vp = { width, height: width < 600 ? 800 : 900 };
        await p.setViewportSize(vp);
        if ((await p.evaluate(() => document.documentElement.lang)) !== HTML[lang]) { await p.evaluate((c) => window.WISE_ACRES.setLang(c, { quiet: true }), lang); await until(p, (h) => document.documentElement.lang === h, HTML[lang], 15000); await p.clock.runFor(800); }
        // the top of the page (the hero drawing and its words) at the real window size, at two moments of its animations when asked
        const moments = what.includes('moments') ? [0.15, 0.85] : [0.15];   // the full sweep used three moments; two catch the same here
        let left = 0;   // texts left out as decoration in this run
        await p.evaluate(() => document.querySelectorAll('[data-cx-px]').forEach((e) => e.removeAttribute('data-cx-px')));
        for (const f of moments) {
          if (f !== moments[0]) await p.clock.runFor(1500);   // the parts moved by script go on too
          // the later moments: only the words that have a picture behind them (the others do not move)
          const h = await measure(p, { ...fast, anim: f, scope: f === moments[0] ? '.hero, .page-hero, .site-header, .announce' : '.hero [data-cx-px], .page-hero [data-cx-px], .site-header [data-cx-px], .announce [data-cx-px]' });
          const bad = fails(h.results);
          if (f === moments[0]) left += h.ignored.length;
          ok(`${label}: the words at the top of the page (header, notice bar, ${url === 'index.html' ? 'hero drawing' : 'page-top band'}${moments.length > 1 ? ', animations at ' + Math.round(f * 100) + '% of their cycle' : ''}) have enough contrast against what is behind them (${h.results.length} texts)`, bad.length === 0 && h.results.length > (f === moments[0] ? 5 : 2), show(bad));
        }
        if (what.includes('page')) {
          await p.setViewportSize({ width, height: TALL });
          const m = await measure(p, { ...fast, skip: '.hero, .page-hero, .site-header, .announce' });
          await p.setViewportSize(vp);
          const bad = fails(m.results), covered = m.results.filter((r) => r.covered).length;
          left += m.ignored.length;
          ok(`${label}: every other text on the page has enough contrast against what is behind it (${m.results.length} texts, ${m.results.filter((r) => r.mode === 'pixels').length} photographed)`, bad.length === 0 && m.results.length > 80 && covered <= m.results.length * 0.05, show(bad) + (covered > m.results.length * 0.05 ? ' | too many not measurable: ' + covered : ''));
        }
        if (what.includes('page')) ignored[url] = Math.max(ignored[url] || 0, left);
        if (what.includes('states')) {
          // the hero game's badge, one of each colour ("Achievement unlocked!" in the bare ring colour was 1.9 to 4.3:1 before its own darker colour)
          await p.evaluate(() => { const b = document.querySelector('#pick-btn'); for (let i = 0; i < 101; i++) b.click(); });
          await p.clock.runFor(700);
          const kinds = await p.evaluate(() => {
            const a = document.querySelector('.ach'); if (!a) return 0;
            const box = document.createElement('div'); box.id = 'cx-badges'; box.style.cssText = 'position:fixed;left:16px;top:110px;display:grid;gap:6px;z-index:60;width:390px';
            for (const v of ['strawberry', 'blueberry', 'sunflower', 'pumpkin', 'winter', 'time']) { const c = a.cloneNode(true); c.className = 'ach ach-' + v; c.style.animation = 'none'; box.appendChild(c); }
            document.body.appendChild(box); return box.children.length;
          });
          const bm = await measure(p, { ...fast, scope: '#cx-badges' });
          await p.evaluate(() => { const b = document.querySelector('#cx-badges'); if (b) b.remove(); });
          ok(`${label}: the hero game's badges, in each of their ${kinds} colours, keep enough contrast (${bm.results.length} texts)`, kinds === 6 && bm.results.length >= 18 && fails(bm.results).length === 0, show(fails(bm.results)));
          // hover, keyboard focus and pressed: every element whose look changes, all at once, in that state
          // (fixed: the hover wash of the pizza e-mail button let its white words drop to 4.2:1 over a dot of the background)
          const cdp = await p.context().newCDPSession(p);
          await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
          await p.setViewportSize({ width, height: TALL });
          const counts = await p.evaluate(markStateTargets);
          for (const [kind, classes] of STATES) {
            await p.evaluate(stateSignatures, [kind, true]);
            await forceState(cdp, kind, classes, true);
            const changed = await p.evaluate(stateSignatures, [kind, false]);
            const m = changed ? await measure(p, { ...fast, scope: '[data-cx-s]' }) : { results: [] };
            await forceState(cdp, kind, classes, false);
            const bad = fails(m.results);
            ok(`${label}: ${kind === 'focus' ? 'keyboard focus' : kind === 'active' ? 'pressed' : 'hover'} looks keep enough contrast (${counts[kind]} elements with such a look, ${changed} changed, ${m.results.length} texts)`, bad.length === 0, show(bad));
          }
          await p.setViewportSize(vp);
        }
      }
      await p.context().close();
      info(`${url} ${season} done after ${took()}`);
    }
    info('left out as decoration (hidden from screen readers): ' + Object.entries(ignored).map(([u, n]) => n + ' texts on ' + u).join(', '));
  });
}
