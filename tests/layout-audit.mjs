/* Layout audit: ONE function that runs inside a page (page.evaluate(auditLayout, options)) and returns what looks broken.
 * Used by tests/layout-sweep.test.mjs. It looks at the page as it is NOW (scroll to the places you want checked first) and reports:
 *   sideways       the page can be scrolled sideways (documentElement.scrollWidth > clientWidth); lists the elements that stick out
 *   sticks-out     text, a button or a picture reaches past the screen edge (even when the page hides the sideways scroll)
 *   clipped-text   an element with overflow hidden/clip cuts off some of its own text
 *   ellipsis       text is shortened with "..." (text-overflow)
 *   overlap        two pieces of text drawn on top of each other (page text only; pictures behind text are fine)
 *   button-wrap    a button or link-button label runs over 3 or more lines
 *   button-cut     a button label reaches outside its own button
 *   img-stretch    a picture drawn with a different width/height ratio than the file has (object-fit fill)
 *   img-broken     a picture that did not load
 *   bars           the fixed/sticky bars together cover too much of the screen (options.barsMax, default 45%)
 *   bars-overlap   two fixed bars on top of each other
 *   tofu           a character the fonts cannot draw (the empty box); also reported for Hindi and Chinese
 * Options: { parts: ['all'] (default) | ['page'] (everything but the floating bars) | ['fixed'] (only the floating bars, as they are on the screen right now), barsMax: 0.45 }. Returns { problems: [{ kind, sel, info }], stats: {...} }.
 * Must stay self-contained: it is sent to the page as text. */
export function auditLayout(options) {
  const opt = Object.assign({ parts: ['all'], barsMax: 0.45 }, options || {});
  const want = (p) => opt.parts.includes('all') || opt.parts.includes(p);
  const problems = [];
  const add = (kind, el, info) => {
    let aid = 0;
    if (el && el.setAttribute) { aid = (window.__auditN = (window.__auditN || 0) + 1); el.setAttribute('data-audit-id', aid); }   // so a picture can point at the exact element
    problems.push({ kind, sel: el ? sel(el) : '', info: info || '', aid });
  };
  const de = document.documentElement, cw = de.clientWidth, ch = de.clientHeight;

  function sel(el) {
    const parts = []; let e = el;
    for (let i = 0; e && e.nodeType === 1 && i < 3 && e !== document.body && e !== de; i++, e = e.parentElement) {
      let s = e.tagName.toLowerCase();
      if (e.id) { parts.unshift(s + '#' + e.id); break; }
      const c = (e.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
      if (c.length) s += '.' + c.join('.');
      parts.unshift(s);
    }
    return parts.join(' > ');
  }
  const cs = (el) => getComputedStyle(el);
  const visible = (el) => { try { return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }); } catch (e) { return true; } };
  const srOnly = (r) => r.width <= 1.5 || r.height <= 1.5;
  const fixedMemo = new Map();
  const inFixed = (el) => {   // the element or one of its parents is fixed or sticky (a bar that floats over the page)
    if (!el || el === document.body) return false;
    if (fixedMemo.has(el)) return fixedMemo.get(el);
    const p = cs(el).position; const v = p === 'fixed' || p === 'sticky' || inFixed(el.parentElement);
    fixedMemo.set(el, v); return v;
  };
  const inArt = (el) => !!el.closest('svg');
  const hasText = (el) => { for (const n of el.childNodes) if (n.nodeType === 3 && n.data.trim()) return true; return false; };
  // rectangles of the text inside an element (one per line), only the element's own and its children's text
  function textRects(el, inflowOnly) {
    const out = []; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!n.data.trim()) continue;
      const pe = n.parentElement; if (!pe || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(pe.tagName) || !visible(pe)) continue;
      if (inflowOnly) { let abs = false; for (let q = pe; q && q !== el.parentElement; q = q.parentElement) { const ps = cs(q).position; if (ps === 'absolute' || ps === 'fixed') { abs = true; break; } } if (abs) continue; }   // a badge that sits on the edge of a button is meant to stick out
      const r = document.createRange(); r.selectNodeContents(n);
      for (const q of r.getClientRects()) if (q.width > 1 && q.height > 1) out.push({ x: q.left, y: q.top, w: q.width, h: q.height, right: q.right, bottom: q.bottom, node: n, el: pe });
    }
    return out;
  }
  // an ancestor that cuts what sticks out of it and sits inside the screen
  const clippedByAncestor = (el) => {
    for (let p = el.parentElement; p && p !== document.body && p !== de; p = p.parentElement) {
      const s = cs(p); if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
      const r = p.getBoundingClientRect(); if (r.right <= cw + 1 && r.left >= -1) return true;
    }
    return false;
  };

  const all = Array.from(document.body.querySelectorAll('*'));

  if (want('page')) {
    /* ---- sideways scroll and things that stick out of the screen */
    const over = de.scrollWidth - cw;
    const poking = [];
    for (const el of all) {
      if (inArt(el) || ['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'BR', 'WBR'].includes(el.tagName)) continue;
      const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || srOnly(r)) continue;
      if (!(r.right > cw + 1 || r.left < -1)) continue;
      if (!visible(el)) continue;
      const pos = cs(el).position;
      if (pos === 'fixed') { if (r.right > cw + 1 || r.left < -1) poking.push({ el, r, fixed: true }); continue; }
      if (clippedByAncestor(el)) continue;
      poking.push({ el, r });
    }
    // keep the outermost element of each group
    const outer = poking.filter((a) => !poking.some((b) => b !== a && b.el.contains(a.el)));
    if (over > 1) {
      add('sideways', de, `page is ${de.scrollWidth}px wide in a ${cw}px window (+${over}px)`);
      for (const a of outer.slice(0, 6)) add('sideways-culprit', a.el, `box ${Math.round(a.r.left)}..${Math.round(a.r.right)} (window 0..${cw})`);
    } else {
      // the page does not scroll sideways, but something is cut at the edge: only report it when it carries text or is a button/picture
      for (const a of outer) { const el = a.el; if (hasText(el) || /^(A|BUTTON|IMG|INPUT|SELECT|LABEL)$/.test(el.tagName) || el.querySelector('img,button,a')) add('sticks-out', el, `box ${Math.round(a.r.left)}..${Math.round(a.r.right)} (window 0..${cw})${a.fixed ? ' (fixed bar)' : ''}`); }
    }

    /* ---- text cut off by overflow:hidden, text shortened with "..." */
    for (const el of all) {
      if (inArt(el) || el === document.body) continue;
      const s = cs(el);
      const clip = (v) => v === 'hidden' || v === 'clip';
      if (!clip(s.overflowX) && !clip(s.overflowY) && s.textOverflow !== 'ellipsis') continue;
      const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4 || srOnly(r) || !visible(el)) continue;
      if (!(el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)) continue;
      // is any of its text really outside its box?
      const beyond = textRects(el).filter((t) => !t.el.closest('svg') && (clip(s.overflowX) && (t.right > r.right + 1 || t.x < r.left - 1)) || (clip(s.overflowY) && (t.bottom > r.bottom + 1 || t.y < r.top - 1)));
      if (!beyond.length) continue;
      const first = beyond[0];
      add(s.textOverflow === 'ellipsis' && s.whiteSpace === 'nowrap' ? 'ellipsis' : 'clipped-text', el, `"${first.node.data.trim().slice(0, 40)}" reaches ${Math.round(Math.max(first.right - r.right, first.bottom - r.bottom, r.left - first.x))}px outside its box (${Math.round(r.width)}x${Math.round(r.height)})`);
    }

    /* ---- text on top of other text */
    const boxes = [];
    for (const el of all) {
      if (!hasText(el) || inArt(el) || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'OPTION', 'TEXTAREA'].includes(el.tagName)) continue;
      const r0 = el.getBoundingClientRect(); if (srOnly(r0) || !visible(el) || inFixed(el)) continue;
      for (const n of el.childNodes) {
        if (n.nodeType !== 3 || !n.data.trim()) continue;
        const rg = document.createRange(); rg.selectNodeContents(n);
        // the middle 70% of the line box: the empty room for tall accents and descenders is not ink, so touching there is not an overlap
        for (const q of rg.getClientRects()) if (q.width > 3 && q.height > 3) boxes.push({ el, x: q.left + scrollX, y: q.top + scrollY + q.height * 0.15, w: q.width, h: q.height * 0.7, t: n.data.trim().slice(0, 28) });
      }
    }
    boxes.sort((a, b) => a.y - b.y);
    const seen = new Set();
    for (let i = 0; i < boxes.length; i++) {
      const a = boxes[i];
      for (let j = i + 1; j < boxes.length && boxes[j].y < a.y + a.h; j++) {
        const b = boxes[j]; if (a.el === b.el) { continue; }
        const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ix <= 3 || iy <= 3) continue;
        if (ix * iy / Math.min(a.w * a.h, b.w * b.h) < 0.3) continue;
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const key = sel(a.el) + '|' + sel(b.el); if (seen.has(key)) continue; seen.add(key);
        add('overlap', a.el, `"${a.t}" overlaps "${b.t}" in ${sel(b.el)} (${Math.round(ix)}x${Math.round(iy)}px)`);
      }
    }

    /* ---- buttons: label too many lines, label outside its button */
    for (const el of all) {
      const isBtn = el.matches('a.btn, button, [role="button"], .btn, .chip, .filter-btn, summary, label.drive-opt, .fs-btn, .season-btn');
      if (!isBtn || inArt(el)) continue;
      const r = el.getBoundingClientRect(); if (r.width < 8 || r.height < 8 || srOnly(r) || !visible(el)) continue;
      const rects = textRects(el, true); if (!rects.length) continue;
      const perNode = new Map(); for (const t of rects) { if (!perNode.has(t.node)) perNode.set(t.node, new Set()); perNode.get(t.node).add(Math.round(t.y / 3)); }
      const worst = [...perNode].sort((a, b) => b[1].size - a[1].size)[0], lines = worst[1].size;
      if (lines >= 3 && el.tagName !== 'SUMMARY') add('button-wrap', el, `label runs over ${lines} lines: "${worst[0].data.trim().slice(0, 40)}"`);
      const out = rects.find((t) => t.right > r.right + 1.5 || t.x < r.left - 1.5 || t.bottom > r.bottom + 2 || t.y < r.top - 2);
      if (out) add('button-cut', el, `"${out.node.data.trim().slice(0, 40)}" reaches ${Math.round(Math.max(out.right - r.right, r.left - out.x, out.bottom - r.bottom, r.top - out.y))}px outside the button (${Math.round(r.width)}x${Math.round(r.height)})`);
    }

    /* ---- pictures: broken, drawn with another ratio than the file */
    for (const img of document.images) {
      const r = img.getBoundingClientRect(); if (r.width < 4 || r.height < 4 || !visible(img)) continue;
      if (img.complete && img.naturalWidth === 0 && img.currentSrc) { add('img-broken', img, img.currentSrc.slice(-60)); continue; }
      if (!img.naturalWidth || !img.naturalHeight) continue;
      const fit = cs(img).objectFit; if (fit !== 'fill') continue;
      const nat = img.naturalWidth / img.naturalHeight, drawn = r.width / r.height;
      if (Math.min(r.width, r.height) > 24 && Math.abs(drawn / nat - 1) > 0.04) add('img-stretch', img, `file ${img.naturalWidth}x${img.naturalHeight} (${nat.toFixed(2)}) drawn ${Math.round(r.width)}x${Math.round(r.height)} (${drawn.toFixed(2)})`);
    }

    /* ---- characters the fonts cannot draw (the empty box) */
    const c = document.createElement('canvas'); c.width = c.height = 48;
    const g = c.getContext('2d', { willReadFrequently: true });
    const ink = (s, font) => { g.clearRect(0, 0, 48, 48); g.font = font; g.textBaseline = 'top'; g.fillText(s, 3, 3); const d = g.getImageData(0, 0, 48, 48).data; let h = 7; for (let i = 3; i < d.length; i += 4) h = (h * 31 + d[i]) | 0; return h; };
    const missingRef = {};
    const wanted = new Map();   // "char|font" -> { ch, font, el }
    for (const el of all) {
      if (!hasText(el) || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(el.tagName) || !visible(el)) continue;
      const s = cs(el); const font = `${s.fontStyle} ${s.fontWeight} 32px ${s.fontFamily}`;
      for (const n of el.childNodes) {
        if (n.nodeType !== 3) continue;
        for (const ch of n.data) {
          if (ch.codePointAt(0) < 0x250 || /[\s\u200b-\u200f\u2028-\u202f\u2060-\u206f\ufe00-\ufe0f\ufeff]/.test(ch)) continue;   // plain Latin and invisible characters need no check
          const k = ch + '|' + font; if (!wanted.has(k) && wanted.size < 900) wanted.set(k, { ch, font, el });
        }
      }
    }
    const tofu = new Map();
    for (const { ch, font, el } of wanted.values()) {
      const mark = /\p{M}/u.test(ch), base = mark ? 'क' : '';   // a combining mark is drawn on a Devanagari letter
      const ref = missingRef[font] || (missingRef[font] = ink(base + '\u{10FFFF}', font));
      if (ink(base + ch, font) === ref) { const key = ch; if (!tofu.has(key)) tofu.set(key, { ch, el, n: 0 }); tofu.get(key).n++; }
    }
    for (const t of tofu.values()) add('tofu', t.el, `U+${t.ch.codePointAt(0).toString(16).toUpperCase()} "${t.ch}" has no glyph in ${cs(t.el).fontFamily.slice(0, 60)}`);
  }

  /* ---- fixed and sticky bars on the screen right now */
  if (want('fixed')) {
    const bars = [];
    for (const el of all) {
      const p = cs(el).position; if (p !== 'fixed' && p !== 'sticky') continue;
      if (inArt(el) || el.id === 'wa-problems') continue;   // the yellow Site check box is for the owner's own computer, visitors never see it
      const r = el.getBoundingClientRect(); if (r.width < 20 || r.height < 12 || !visible(el)) continue;
      if (r.bottom < 0 || r.top > ch) continue;                       // not on the screen now
      if (p === 'sticky' && !(r.top <= 1 || r.bottom >= ch - 1)) continue;   // a sticky box that has not stuck to an edge is just part of the page
      // a child of a bar is part of that bar
      if (bars.some((b) => b.el.contains(el))) continue;
      bars.push({ el, r, p });
    }
    for (let i = bars.length - 1; i >= 0; i--) if (bars.some((b, j) => j !== i && bars[i].el.contains(b.el))) bars.splice(i, 1);
    // union of the horizontal bands the bars cover (full width bars; narrow floating buttons count by their area share of a full band)
    const bands = bars.filter((b) => b.r.width >= cw * 0.5).map((b) => [Math.max(0, b.r.top), Math.min(ch, b.r.bottom)]).sort((a, b) => a[0] - b[0]);
    let covered = 0, end = -1;
    for (const [a, b] of bands) { const s = Math.max(a, end); if (b > s) { covered += b - s; end = b; } }
    const share = covered / ch;
    if (share > opt.barsMax) add('bars', null, `${Math.round(share * 100)}% of the ${ch}px-high screen is covered by bars: ${bars.filter((b) => b.r.width >= cw * 0.5).map((b) => sel(b.el) + ' ' + Math.round(b.r.height) + 'px').join(' + ')}`);
    for (let i = 0; i < bars.length; i++) for (let j = i + 1; j < bars.length; j++) {
      const a = bars[i].r, b = bars[j].r;
      const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left), iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ix > 6 && iy > 6 && !bars[i].el.contains(bars[j].el) && !bars[j].el.contains(bars[i].el)) add('bars-overlap', bars[i].el, `overlaps ${sel(bars[j].el)} by ${Math.round(ix)}x${Math.round(iy)}px`);
    }
    return { problems, stats: { bars: bars.map((b) => ({ sel: sel(b.el), top: Math.round(b.r.top), bottom: Math.round(b.r.bottom), w: Math.round(b.r.width) })), share: Math.round(share * 100), scrollWidth: de.scrollWidth, clientWidth: cw, clientHeight: ch } };
  }
  return { problems, stats: { scrollWidth: de.scrollWidth, clientWidth: cw, clientHeight: ch } };
}
