/* Wise Acres Organic Farm — interactions
 * No dependencies. Everything here is progressive enhancement: the page is fully
 * readable and every link works without JavaScript.
 */
(() => {
  'use strict';

  const doc = document;
  const root = doc.documentElement;
  root.classList.remove('no-js');
  if (window.WISE_ACRES && window.WISE_ACRES.translateNow) window.WISE_ACRES.translateNow();   // texts in the visitor's language before the rest of the page is built

  const $ = (sel, ctx = doc) => ctx.querySelector(sel);
  const $$ = (sel, ctx = doc) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Season dates, the seeded PRNG and the hero scene live in js/season.js and js/hero.js.
  const W = window.WISE_ACRES || {};
  const S = W.seasons;
  const t = (s, v) => (W.t ? W.t(s, v) : String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v ? v[k] : m)));
  const mulberry32 = W.rand;

  function initPrint() {
    $$('[data-print]').forEach((b) => b.addEventListener('click', () => window.print()));
    // keep ticks on the "what to bring" list between visits
    const boxes = $$('#checklist input[type="checkbox"]');
    if (!boxes.length) return;
    try {
      const saved = JSON.parse(localStorage.getItem('wa.checklist') || '[]');
      boxes.forEach((b, i) => { b.checked = !!saved[i]; });
    } catch (e) { /* storage unavailable */ }
    boxes.forEach((b) => b.addEventListener('change', () => {
      try { localStorage.setItem('wa.checklist', JSON.stringify(boxes.map((x) => x.checked))); } catch (e) { /* ignore */ }
    }));
  }

  /* ------------------------------------------------------------------ *
   * Reviews: real quotes from js/content.js, shown with where they were posted
   * ------------------------------------------------------------------ */
  function initReviews() {
    const list = $('#review-grid');
    const items = (W.reviews || []).filter((r) => r && r.quote && r.name);
    if (!list) return;
    if (!items.length) { list.hidden = true; return; }
    items.forEach((r) => {
      const li = doc.createElement('li');
      li.className = 'review';
      const q = doc.createElement('blockquote'), p = doc.createElement('p');
      p.textContent = '\u201C' + r.quote + '\u201D';
      if (r.lang) p.lang = r.lang;
      q.appendChild(p);
      const by = doc.createElement('p');
      by.className = 'review-by';
      by.append('\u2014 ' + r.name + (r.date ? ', ' + r.date : ''));
      if (r.source) {
        by.append(' \u00B7 ');
        if (r.url) { const a = doc.createElement('a'); a.href = r.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = r.source; by.appendChild(a); }
        else by.append(r.source);
      }
      li.append(q, by);
      list.appendChild(li);
    });
  }

  /* ------------------------------------------------------------------ *
   * Gallery — appears only when photos are listed in js/content.js
   * ------------------------------------------------------------------ */
  function initGallery() {
    const photos = (window.WISE_ACRES && window.WISE_ACRES.photos) || [];
    const section = $('#gallery');
    if (!section || !photos.length) return;

    const grid = $('#gallery-grid');
    const box = $('#lightbox');
    const img = $('#lightbox-img');
    const cap = $('#lightbox-cap');
    const filters = $('#gallery-filters');
    const countEl = $('#gallery-count');
    const tagsOf = (p) => (Array.isArray(p.tags) ? p.tags : []).map((x) => String(x).trim().toLowerCase()).filter(Boolean);   // tags: ["berries", "flowers"] in js/content.js

    const items = photos.map((p) => {
      const li = doc.createElement('li');
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.setAttribute('aria-haspopup', 'dialog');   // tells a screen reader that this opens the photo viewer
      const thumb = doc.createElement('img');
      thumb.loading = 'lazy'; thumb.decoding = 'async'; thumb.src = p.src;   // lazy first: setting src first starts the download at once
      btn.appendChild(thumb);
      btn.addEventListener('click', () => {
        img.src = p.src; img.alt = t(p.alt); cap.textContent = p.caption ? t(p.caption) : '';
        box.showModal();
      });
      li.appendChild(btn);
      grid.appendChild(li);
      return { p, li, btn, thumb, tags: tagsOf(p) };
    });
    const words = () => items.forEach((it) => {   // alt text and button labels in the language of the page (drawn again when the language changes)
      it.thumb.alt = t(it.p.alt);
      it.btn.setAttribute('aria-label', t('Enlarge photo:') + ' ' + t(it.p.alt));
    });
    words();
    box.addEventListener('click', (e) => { if (e.target === box) box.close(); });

    // Topic buttons: one is pressed at a time ("All" to start). A photo with no tags shows under "All" only.
    // The photos are drawn once and only hidden or shown, so the buttons never move and the focus stays on the one that was pressed.
    const buttons = filters ? $$('[data-gtag]', filters) : [];
    let current = 'all';
    const showCount = (n, label) => {
      if (!countEl) return;
      countEl.textContent = '';
      const who = doc.createElement('span');
      who.className = 'sr-only';
      who.textContent = label + ': ';      // read aloud with the number, so two groups with the same count still sound different
      countEl.append(who, n === 1 ? t('1 photo') : t('{count} photos', { count: n }));
    };
    const apply = () => {
      let n = 0;
      items.forEach((it) => { const on = current === 'all' || it.tags.includes(current); it.li.hidden = !on; if (on) n++; });
      const pressed = buttons.find((b) => b.dataset.gtag === current);
      showCount(n, pressed ? pressed.textContent.trim() : '');
    };
    if (filters && items.some((it) => it.tags.length)) {
      buttons.forEach((b) => {
        const tag = b.dataset.gtag;
        if (tag !== 'all' && !items.some((it) => it.tags.includes(tag))) b.hidden = true;   // no photo in that group (yet): no button
        b.addEventListener('click', () => {
          current = tag;
          buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
          apply();
        });
      });
      filters.hidden = false;
      if (countEl) countEl.hidden = false;
    }
    apply();
    doc.addEventListener('wa:lang', () => { words(); apply(); });

    section.hidden = false;
  }

  /* ------------------------------------------------------------------ *
   * Zoom: any photo or link marked data-zoom opens in the photo viewer
   * ------------------------------------------------------------------ */
  function initZoom() {
    let box = null, img = null, cap = null;
    const ensure = () => {
      if (box) return;
      box = $('#lightbox');
      if (!box) {
        box = doc.createElement('dialog');
        box.className = 'lightbox'; box.id = 'lightbox'; box.setAttribute('aria-label', t('Photo viewer'));
        box.innerHTML = '<form method="dialog"><button class="lightbox-close" type="submit"><svg class="ico" aria-hidden="true"><use href="#i-close"/></svg></button></form><img id="lightbox-img" alt=""><p id="lightbox-cap"></p>';
        $('.lightbox-close', box).setAttribute('aria-label', t('Close photo'));   // translated text never goes into markup
        doc.body.appendChild(box);
        box.addEventListener('click', (e) => { if (e.target === box) box.close(); });
      }
      img = $('#lightbox-img', box); cap = $('#lightbox-cap', box);
    };
    const show = (src, alt, caption) => { ensure(); img.src = src; img.alt = alt || ''; cap.textContent = caption || ''; box.showModal(); };
    const bind = (el) => {
      if (el._zoom) return;
      el._zoom = true;
      if (el.tagName === 'IMG') {
        el.tabIndex = 0; el.setAttribute('role', 'button'); el.setAttribute('aria-haspopup', 'dialog');   // a photo that opens the viewer
        const open = () => { const fc = el.closest('figure') && el.closest('figure').querySelector('figcaption'); show(el.currentSrc || el.src, el.alt, fc ? fc.textContent : ''); };
        el.addEventListener('click', open);
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      } else {
        el.setAttribute('aria-haspopup', 'dialog');
        el.addEventListener('click', (e) => { e.preventDefault(); show(el.href, el.textContent.trim(), ''); });
      }
    };
    $$('[data-zoom]').forEach(bind);
    W.bindZoom = bind;   // js/features.js uses this for photos it adds later
  }

  /* ------------------------------------------------------------------ *
   * Navigation (mobile menu + scroll-spy)
   * ------------------------------------------------------------------ */
  function initNav() {
    const toggle = $('#menu-toggle');
    const nav = $('#nav');
    const header = $('#site-header');
    const setOpen = (open) => {
      // Start the overlay right under the header, wherever the announcement bar has left it.
      nav.style.top = open ? Math.max(0, Math.round(header.getBoundingClientRect().bottom)) + 'px' : '';
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? t('Close menu') : t('Open menu'));
      nav.classList.toggle('is-open', open);
      doc.body.classList.toggle('nav-lock', open);
    };
    // The menu sits before its button in the page, so Tab from the button would skip it and land on the page behind it.
    // Opening it moves focus to its first link instead.
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      setOpen(open);
      if (open) { const first = $('a', nav); if (first) first.focus(); }
    });
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    // Tabbing out of the header (past the menu button, or back out of the menu) closes the open menu.
    header.addEventListener('focusout', (e) => { if (nav.classList.contains('is-open') && e.relatedTarget && !header.contains(e.relatedTarget)) setOpen(false); });
    doc.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { setOpen(false); toggle.focus(); }
    });
    addEventListener('resize', () => { if (getComputedStyle(toggle).display === 'none') setOpen(false); });

    // "More" dropdown: click to open, Escape or an outside click to close, and it closes when focus leaves.
    const more = $('.nav-more', nav);
    const moreBtn = more && $('.nav-more-btn', more);
    const setMore = (open) => {
      if (!more) return;
      more.classList.toggle('is-open', open);
      moreBtn.setAttribute('aria-expanded', String(open));
    };
    if (more) {
      moreBtn.addEventListener('click', () => setMore(!more.classList.contains('is-open')));
      more.addEventListener('keydown', (e) => { if (e.key === 'Escape') { setMore(false); moreBtn.focus(); } });
      more.addEventListener('focusout', (e) => { if (!more.contains(e.relatedTarget)) setMore(false); });
      doc.addEventListener('click', (e) => { if (!more.contains(e.target)) setMore(false); });
      more.addEventListener('click', (e) => { if (e.target.closest('a')) setMore(false); });
    }

    // Scroll-spy: highlight the nav link for the section in the middle of the screen.
    if (!('IntersectionObserver' in window)) return;
    const links = new Map($$('.nav ul a[href^="#"]').map((a) => [a.getAttribute('href').slice(1), a]));
    const setCurrent = (id) => {
      links.forEach((a, key) => (key === id ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
      if (moreBtn) { const inMore = !!(links.get(id) && more.contains(links.get(id))); if (inMore) moreBtn.setAttribute('aria-current', 'true'); else moreBtn.removeAttribute('aria-current'); }
    };
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) setCurrent(en.target.dataset.nav || en.target.id); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('main > section[id], #farm, #farm-cards').forEach((s) => spy.observe(s));
  }

  /* ------------------------------------------------------------------ *
   * Reveal-on-scroll
   * ------------------------------------------------------------------ */
  function initReveal() {
    const targets = $$('.reveal, .crop-row, .goat-nook');
    $$('.reveal').forEach((el) => {
      const sibs = Array.from(el.parentElement.children).filter((c) => c.classList.contains('reveal'));
      el.style.setProperty('--d', String(sibs.indexOf(el) % 4));
    });
    if (!('IntersectionObserver' in window)) { targets.forEach((el) => el.classList.add('in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
    targets.forEach((el) => io.observe(el));
  }

  /* ------------------------------------------------------------------ *
   * Hero: the bee
   * ------------------------------------------------------------------ */
  function initBee() {
    const hero = $('#top');
    const bee = $('#bee');
    if (!hero || !bee) return;
    if (reduceMotion) { bee.setAttribute('hidden', ''); return; }   // SVG has no .hidden property

    let w = hero.clientWidth, h = hero.clientHeight;
    let x = w * 0.2, y = h * 0.55, tx = x, ty = y;
    let lastMove = 0, running = false, facing = 1, t = 0, wander = 0;

    const setTarget = (e) => {
      const r = hero.getBoundingClientRect();
      tx = e.clientX - r.left - 26; ty = e.clientY - r.top - 24; lastMove = performance.now();
    };
    hero.addEventListener('pointermove', setTarget);
    hero.addEventListener('pointerdown', setTarget);
    addEventListener('resize', () => { w = hero.clientWidth; h = hero.clientHeight; }, { passive: true });

    function frame(now) {
      if (!running) return;
      t += 0.016;
      if (now - lastMove > 2500 && now > wander) {           // idle: visit the field
        tx = w * (0.08 + Math.random() * 0.84);
        ty = h * (0.5 + Math.random() * 0.36);
        wander = now + 2200 + Math.random() * 2600;
      }
      const dx = tx - x;
      x += dx * 0.045; y += (ty - y) * 0.045;
      if (Math.abs(dx) > 6) facing = dx > 0 ? 1 : -1;
      const bob = Math.sin(t * 9) * 5;
      bee.style.transform = `translate3d(${x.toFixed(1)}px, ${(y + bob).toFixed(1)}px, 0) scaleX(${facing}) rotate(${(Math.sin(t * 5) * 5).toFixed(1)}deg)`;
      raf = requestAnimationFrame(frame);
    }
    // It only flies while the hero is on screen, the tab is visible and the season shows a bee (the CSS hides it in winter:
    // a hidden bee used to keep the loop, and with it a drawing frame of the whole hero, going all the time).
    let onScreen = false, raf = 0;
    const sync = () => {
      const on = onScreen && !doc.hidden && root.getAttribute('data-season') !== 'winter';
      if (on && !running) { running = true; raf = requestAnimationFrame(frame); }
      if (!on) { running = false; cancelAnimationFrame(raf); }
    };
    new IntersectionObserver((entries) => { onScreen = entries[entries.length - 1].isIntersecting; sync(); }).observe(hero);
    doc.addEventListener('visibilitychange', sync);
    doc.addEventListener('wa:season', sync);
  }

  /* ------------------------------------------------------------------ *
   * Scroll-linked effects: vine progress, hero parallax, tractor
   * ------------------------------------------------------------------ */
  function initScroll() {
    const header = $('#site-header');
    const hero = $('#top');
    const layers = $$('.layer[data-depth]').map((el) => ({ el, depth: parseFloat(el.dataset.depth) }));
    const steps = $('#steps');
    const stepEls = steps ? $$('.step', steps) : [];
    const track = steps ? $('.track', steps) : null;
    let ticking = false, moveTimer = 0;

    function update() {
      ticking = false;
      const y = window.scrollY;
      const vh = window.innerHeight;
      const max = root.scrollHeight - vh;
      header.style.setProperty('--vp', max > 0 ? clamp(y / max, 0, 1).toFixed(4) : '0');

      if (hero && !reduceMotion && y < hero.offsetHeight + 40) {
        layers.forEach(({ el, depth }) => { el.style.transform = `translate3d(0, ${(y * depth).toFixed(1)}px, 0)`; });
      }

      if (steps) {
        const r = steps.getBoundingClientRect();
        const p = clamp((vh * 0.8 - r.top) / (r.height * 0.85), 0, 1);
        steps.style.setProperty('--p', p.toFixed(4));
        stepEls.forEach((s, i) => s.classList.toggle('is-reached', p >= 0.08 + i * 0.38));
        if (!reduceMotion && p > 0 && p < 1) {
          track.classList.add('is-moving');
          clearTimeout(moveTimer);
          moveTimer = setTimeout(() => track.classList.remove('is-moving'), 160);
        }
      }
    }
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll, { passive: true });
    update();
  }

  /* ------------------------------------------------------------------ *
   * Seasons: tabs + illustrated scenes
   * ------------------------------------------------------------------ */
  const use = (id, x, y, w, h, extra = '') => `<use href="#${id}" x="${x}" y="${y}" width="${w}" height="${h}" ${extra}/>`;
  const grow = (i, inner) => `<g class="grow" style="--i:${i}">${inner}</g>`;
  const plantAt = (cx, base, w, i, berriesList) => {
    const h = w * 0.75, bw = w * 0.27, bh = bw * 72 / 64;
    let s = use('sb-plant', cx - w / 2, base - h * 0.94, w, h);
    berriesList.forEach(([dx, dy]) => { s += use('strawberry', cx + dx * w - bw / 2, base - h * 0.94 + dy * h, bw, bh); });
    return grow(i, s);
  };

  function sceneSpring() {
    let s = `<circle cx="400" cy="64" r="30" fill="#ffd42e" stroke="#3a2416" stroke-width="3"/>` +
      use('cloud', 26, 24, 130, 53) + use('cloud', 250, 62, 96, 39) +
      `<path d="M0 196C80 158 170 168 250 184S410 176 480 156V340H0Z" fill="#a8dc8a"/>` +
      use('tree', 74, 116, 54, 66) + use('tree', 132, 138, 40, 49) + use('tree', 398, 96, 60, 73) +
      `<path d="M0 234C120 212 250 220 480 204V340H0Z" fill="#62b04a"/>` +
      `<rect x="0" y="262" width="480" height="14" fill="#8a5a35" stroke="#3a2416" stroke-width="3"/>` +
      `<rect x="0" y="322" width="480" height="30" fill="#8a5a35" stroke="#3a2416" stroke-width="3"/>`;
    [[52, 0], [138, 1], [224, 2], [310, 3], [396, 4], [470, 5]].forEach(([cx, i]) => {
      s += plantAt(cx, 268, 78, i, i % 2 ? [[-0.3, 0.55], [0.14, 0.5]] : [[0.12, 0.52]]);
    });
    [[80, 6], [200, 7], [318, 8], [430, 9]].forEach(([cx, i]) => {
      s += plantAt(cx, 334, 110, i, i % 2 ? [[-0.3, 0.56], [0.13, 0.5]] : [[-0.28, 0.5], [0.16, 0.56]]);
    });
    return s;
  }

  function sceneSummer() {
    let rays = '';
    for (let i = 0; i < 12; i++) rays += `<path d="M-7-52 0-72 7-52Z" transform="rotate(${i * 30})"/>`;
    let s = `<g transform="translate(384 70)"><g class="sun-rays" fill="#ffb300" stroke="#3a2416" stroke-width="2.5" stroke-linejoin="round">${rays}</g>` +
      `<circle r="44" fill="#ffd42e" stroke="#3a2416" stroke-width="3"/><ellipse cx="-14" cy="-4" rx="4" ry="6" fill="#3a2416"/><ellipse cx="14" cy="-4" rx="4" ry="6" fill="#3a2416"/><path d="M-14 10Q0 24 14 10" fill="none" stroke="#3a2416" stroke-width="3.5" stroke-linecap="round"/></g>` +
      use('cloud', 30, 30, 120, 49) +
      `<path d="M0 214C100 180 200 192 300 204S430 196 480 186V340H0Z" fill="#9fd67a"/>` +
      `<path d="M0 262C140 240 300 250 480 236V340H0Z" fill="#62b04a"/>`;
    [[36, 330, 92, 0], [138, 322, 72, 2], [354, 326, 78, 1], [430, 334, 96, 3]].forEach(([x, base, w, i]) => {
      const h = w * 380 / 140;
      s += grow(i, use('sunflower-plant', x - w / 2, base - h, w, h));
    });
    [[196, 300, 70, 4], [262, 314, 78, 5], [300, 292, 62, 6]].forEach(([x, base, w, i]) => {
      s += grow(i, use('blueberry', x - w / 2, base - w, w, w));
    });
    s += `<g class="scene-bee">${use('bee-s', 150, 110, 40, 29)}</g>`;
    return s;
  }

  function sceneFall() {
    let s = `<circle cx="70" cy="86" r="30" fill="#ffb347" stroke="#3a2416" stroke-width="3"/>` +
      `<path d="M0 206C90 176 190 186 270 198S420 190 480 176V340H0Z" fill="#e7c27d"/>` +
      use('barn', 300, 92, 150, 123) +
      `<path d="M0 246C120 224 260 234 480 220V340H0Z" fill="#8fbf4d"/>` +
      `<path d="M0 296C160 280 320 290 480 280V340H0Z" fill="#7aad3e"/>`;
    [[40, 300, 92, 0], [138, 316, 118, 1], [252, 306, 86, 2], [340, 322, 128, 3], [450, 308, 96, 4]].forEach(([cx, base, w, i]) => {
      const h = w * 92 / 110;
      s += grow(i, use('pumpkin', cx - w / 2, base - h, w, h));
    });
    s += grow(5, `<rect x="178" y="272" width="64" height="44" rx="6" fill="#f0c95a" stroke="#3a2416" stroke-width="3"/><path d="M182 284h56M182 296h56M182 308h56" stroke="#3a2416" stroke-width="2" opacity=".4"/>`);
    [[120, '#e5642f', 6.2, -1], [210, '#f5a300', 7.4, -4], [330, '#c8412f', 5.6, -3], [420, '#ffc928', 8.2, -6]].forEach(([x, c, d, delay]) => {
      s += `<g transform="translate(${x} 0)"><path class="leaf-fall" d="M0 0c6-8 16-8 22 0-6 8-16 8-22 0Z" fill="${c}" stroke="#3a2416" stroke-width="2" style="animation-duration:${d}s;animation-delay:${delay}s"/></g>`;
    });
    return s;
  }

  function sceneWinter() {
    let s = `<circle cx="400" cy="70" r="26" fill="#fff" opacity=".9"/>` +
      `<path d="M0 200C90 176 200 186 290 198S430 186 480 176V340H0Z" fill="#dbe9f2"/>` +
      `<path d="M0 240C120 218 260 228 480 214V340H0Z" fill="#f6fbfe"/>` +
      `<path d="M0 300C160 286 320 296 480 286V340H0Z" fill="#fff"/>`;
    [[70, 300, 64, 88, 0], [150, 286, 84, 116, 1], [250, 300, 74, 102, 2], [350, 292, 100, 138, 3], [440, 304, 70, 96, 4]].forEach(([cx, base, w, h, i]) => {
      s += grow(i, use('fir', cx - w / 2, base - h, w, h));
    });
    [[40, 4.8, -1], [110, 6.2, -3], [190, 5.4, -2], [280, 7, -5], [360, 5.8, -4], [430, 6.6, -1]].forEach(([x, d, delay]) => {
      s += `<g transform="translate(${x} 0)"><circle class="leaf-fall" r="4" fill="#fff" stroke="#bcd3e0" stroke-width="1.5" style="animation-duration:${d}s;animation-delay:${delay}s"/></g>`;
    });
    return s;
  }

  // Drawn "stickers" that sit on top of the real photos
  const stickersSpring = () =>
    grow(0, use('strawberry', 388, 236, 62, 70, 'transform="rotate(10 419 271)"')) +
    grow(1, use('strawberry', 436, 280, 46, 52, 'transform="rotate(-14 459 306)"')) +
    grow(2, use('strawberry', 346, 286, 40, 45, 'transform="rotate(18 366 308)"'));
  const stickersFall = () =>
    grow(0, use('pumpkin', 6, 262, 92, 78)) +
    grow(1, use('pumpkin-w', 392, 268, 70, 59)) +
    grow(2, use('pumpkin-b', 330, 286, 56, 47));
  const stickersSummer = () =>
    grow(0, use('sunflower', 4, 232, 104, 104)) +
    grow(1, use('blueberry', 380, 246, 76, 78)) +
    `<g class="scene-bee">${use('bee-s', 160, 56, 44, 32)}</g>`;

  // Keyboard-accessible tab behaviour shared by the season and group tabs.
  function wireTabs(tabs, activate) {
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => activate(t, false));
      t.addEventListener('keydown', (e) => {
        const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
        let next = -1;
        if (e.key in keys) next = (i + keys[e.key] + tabs.length) % tabs.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = tabs.length - 1;
        if (next >= 0) { e.preventDefault(); activate(tabs[next], true); }
      });
    });
  }

  function initSeasons() {
    const tabs = $$('#season-tabs .season-tab');
    if (!tabs.length) return;
    const panels = $$('.season-panel');
    const builders = { spring: sceneSpring, summer: sceneSummer, fall: sceneFall, winter: sceneWinter };
    const stickers = { spring: stickersSpring, summer: stickersSummer, fall: stickersFall };
    $$('.scene-card').forEach((card) => {
      const key = card.dataset.scene;
      const photo = card.classList.contains('has-photo');
      card.insertAdjacentHTML('beforeend',
        `<svg${photo ? ' class="stickers"' : ''} viewBox="0 0 480 340" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${(photo ? stickers[key] : builders[key])()}</svg>`);
    });

    const select = (id, focus) => {
      tabs.forEach((t) => {
        const on = t.dataset.season === id;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        if (on && focus) t.focus();
      });
      panels.forEach((p) => {
        const on = p.dataset.season === id;
        p.hidden = !on;
        p.classList.toggle('is-active', on);
      });
    };
    wireTabs(tabs, (t, focus) => select(t.dataset.season, focus));

    // Mark what's happening now, and open that season by default.
    const now = new Date();
    const live = S.live(now);
    live.forEach((s) => { $('.now-badge', $('#tab-' + s.id)).hidden = false; });
    const target = S.list.find((s) => s.id === S.current(now));
    select(target.id);
    const next = S.list.filter((s) => !S.inWindow(s, now)).sort((a, b) => S.daysUntilStart(a, now) - S.daysUntilStart(b, now))[0] || target;

    // The hero's season switcher and these tabs stay in step.
    doc.addEventListener('wa:season', (e) => select(e.detail));

    const fact = $('#fact-season');
    const renderFact = () => {
      if (!fact) return;
      fact.textContent = live.length
        ? t('{crop} \u2014 happening now', { crop: live.map((s) => t(s.crop)).join(' & ') })
        : t('Next up: {crop} ({when})', { crop: t(next.crop), when: t(next.next) });
    };
    renderFact();
    doc.addEventListener('wa:lang', renderFact);
  }

  /* ------------------------------------------------------------------ *
   * Groups: school tours / parties / corporate (deep-linkable tabs)
   * ------------------------------------------------------------------ */
  // "What's on the farm": a season picker that opens on the current season. Each card says which seasons it
  // belongs to (data-seasons), so the u-pick card swaps crop, colour and drawing and one-season things stay out.
  function initFarmSeasons() {
    const root = $('[data-farm-seasons]');
    const list = $('#farm-cards');
    if (!root || !list) return;
    const cards = $$('li[data-seasons]', list);
    const btns = $$('[data-fs]', $('#farm')?.parentElement || doc);
    const notes = $$('[data-fs-note]', root);
    const cols = $$('#farm-glance [data-col]');
    const nowId = S.current(new Date());
    S.live(new Date()).forEach((s) => { const b = $('[data-fs="' + s.id + '"]', root); if (b) $('.fs-now', b.parentElement).hidden = false; });
    let shown = null;

    const select = (id, animate) => {
      if (id === shown) return;
      shown = id;
      btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.fs === id)));
      notes.forEach((n) => {
        const on = n.dataset.fsNote === id;
        n.hidden = !on;
        if (on) $('.fs-this', n).hidden = id !== nowId;
      });
      cols.forEach((c) => c.classList.toggle('is-sel', c.dataset.col === id));
      let k = 0;
      cards.forEach((card) => {
        const on = card.dataset.seasons.split(' ').includes(id);
        card.hidden = !on;
        card.classList.remove('fs-in');
        if (on) {
          card.classList.add('in');   // the reveal observer may never have seen a card that started hidden
          if (animate) { card.style.setProperty('--k', String(k)); void card.offsetWidth; card.classList.add('fs-in'); }
          k += 1;
        }
      });
      list.style.setProperty('--fcols', String(k % 3 === 0 || k === 6 ? 3 : 4));
      list.dataset.season = id;
    };

    btns.forEach((b) => b.addEventListener('click', () => select(b.dataset.fs, true)));
    doc.addEventListener('wa:season', (e) => select(e.detail, true));
    select(S.active || nowId, false);
  }

  function initGroups() {
    const tabs = $$('#group-tabs .group-tab');
    const panels = $$('.group-panel');
    if (!tabs.length) return;
    const select = (panel, focus) => {
      tabs.forEach((t) => {
        const on = t.dataset.panel === panel;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        if (on && focus) t.focus();
      });
      panels.forEach((p) => {
        const on = p.dataset.panel === panel;
        p.hidden = !on;
        p.classList.toggle('is-active', on);
      });
    };
    wireTabs(tabs, (t, focus) => select(t.dataset.panel, focus));

    const byHash = {};
    tabs.forEach((t) => { byHash[t.dataset.hash] = t.dataset.panel; });
    const go = (hash, scroll) => {
      const panel = byHash[String(hash).replace('#', '')];
      if (!panel) return false;
      select(panel);
      if (scroll) $('#groups').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      return true;
    };
    // Links like #parties or #corporate elsewhere on the page open the right tab.
    doc.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (a && go(a.getAttribute('href'), true)) e.preventDefault();
    });
    addEventListener('hashchange', () => go(location.hash, true));
    if (location.hash && go(location.hash, false)) setTimeout(() => $('#groups').scrollIntoView(), 60);
  }

  /* ------------------------------------------------------------------ *
   * Small components: week strips + the farm-year "today" marker
   * ------------------------------------------------------------------ */
  function initVarietyFilter() {
    const buttons = $$('#variety-filters .filter-btn');
    const items = $$('#variety-list .variety');
    if (!buttons.length) return;
    buttons.forEach((btn) => btn.addEventListener('click', () => {
      const f = btn.dataset.filter;
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      items.forEach((li) => { li.hidden = f !== 'all' && li.dataset.cat !== f; });
    }));
  }

  function initWeekStrips() {
    const today = S.farmDay(new Date()).getDay();   // the farm's weekday (Eastern Time)
    const draw = () => {
      // Jan 1, 2023 was a Sunday, so day n is Jan 1 + n.
      const letter = (d) => new Intl.DateTimeFormat(W.lang || 'en', { weekday: 'narrow', timeZone: 'UTC' }).format(new Date(Date.UTC(2023, 0, 1 + d, 12)));
      $$('.week-strip[data-days]').forEach((el) => {
        const on = el.dataset.days.split(',').map(Number);
        el.innerHTML = [1, 2, 3, 4, 5, 6, 0].map((d) =>
          `<span class="day${on.includes(d) ? ' on' : ''}${d === today ? ' today' : ''}" aria-hidden="true">${letter(d)}</span>`).join('');
      });
    };
    draw();
    doc.addEventListener('wa:lang', draw);
  }

  function initFarmCalendar() {
    const cal = $('.cal');
    if (!cal) return;
    const now = S.farmDay(new Date());   // the farm's date (Eastern Time)
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    cal.style.setProperty('--today', ((now.getMonth() + (now.getDate() - 1) / dim) / 12).toFixed(4));
    cal.classList.add('has-today');
  }

  /* ------------------------------------------------------------------ *
   * Flowers: build-a-bouquet
   * ------------------------------------------------------------------ */
  function initBouquet() {
    const stems = $('#bq-stems'), heads = $('#bq-heads'), msg = $('#bq-msg'), clear = $('#bq-clear');
    const buttons = $$('.bq-flower');
    if (!stems || !heads) return;
    // tools/i18n.py does not tag attributes of <svg>, so the picture's label is set (and re-set when the language changes) here
    const cup = $('#bouquet-svg'), labelCup = () => { if (cup) cup.setAttribute('aria-label', t('A paper cup that fills with the flowers you tap')); };
    labelCup(); doc.addEventListener('wa:lang', labelCup);
    const MOUTH = { x: 150, y: 205 };
    // [angle from vertical (deg), distance from the cup mouth] — filled from the middle out
    const SLOTS = [[0, 96], [-11, 150], [11, 150], [-24, 96], [24, 96], [-32, 150], [32, 150], [-48, 96], [48, 96], [0, 182]];
    const KINDS = {
      sun:    { label: 'sunflower',     sym: 'sunflower', size: 62 },
      pink:   { label: 'pink flower',   sym: 'bloom', size: 54, color: '#ff6fa5' },
      white:  { label: 'white daisy',   sym: 'bloom', size: 54, color: '#ffffff' },
      purple: { label: 'purple flower', sym: 'bloom', size: 54, color: '#a682ff' },
      orange: { label: 'orange flower', sym: 'bloom', size: 54, color: '#ff8a3d' },
      blue:   { label: 'blue flower',   sym: 'bloom', size: 54, color: '#5aa9ff' },
    };
    const NS = 'http://www.w3.org/2000/svg';
    let n = 0;

    function add(kind) {
      if (n >= SLOTS.length) return;
      const k = KINDS[kind];
      const [deg, dist] = SLOTS[n];
      const a = deg * Math.PI / 180;
      const hx = MOUTH.x + Math.sin(a) * dist, hy = MOUTH.y - Math.cos(a) * dist;
      const bx = MOUTH.x + Math.sin(a) * 12, by = MOUTH.y + 14;
      const qx = (bx + hx) / 2 + Math.sin(a) * 6, qy = (by + hy) / 2;
      const d = `M${bx.toFixed(1)} ${by} Q${qx.toFixed(1)} ${qy.toFixed(1)} ${hx.toFixed(1)} ${hy.toFixed(1)}`;
      [['bq-stem', d], ['bq-stem-in', d]].forEach(([cls, dd]) => {
        const p = doc.createElementNS(NS, 'path');
        p.setAttribute('class', cls); p.setAttribute('d', dd);
        stems.appendChild(p);
      });
      const outer = doc.createElementNS(NS, 'g');
      outer.setAttribute('transform', `translate(${(hx - k.size / 2).toFixed(1)} ${(hy - k.size / 2).toFixed(1)})`);
      const inner = doc.createElementNS(NS, 'g');
      inner.setAttribute('class', 'bq-head');
      const u = doc.createElementNS(NS, 'use');
      u.setAttribute('href', '#' + k.sym);
      u.setAttribute('width', k.size); u.setAttribute('height', k.size);
      if (k.color) u.setAttribute('style', 'color:' + k.color);
      inner.appendChild(u); outer.appendChild(inner); heads.appendChild(outer);
      n += 1;
      const full = n >= SLOTS.length;
      msg.textContent = full
        ? t('Your cup is full! Cutting a real bouquet is part of the fun in our flower field.')
        : t('Added a {flower}. {n} of {total} flowers in your cup.', { flower: t(k.label), n: n, total: SLOTS.length });
      buttons.forEach((b) => { b.disabled = full; });
    }

    buttons.forEach((b) => b.addEventListener('click', () => add(b.dataset.kind)));
    clear.addEventListener('click', () => {
      stems.textContent = ''; heads.textContent = ''; n = 0;
      buttons.forEach((b) => { b.disabled = false; });
      msg.textContent = t('Fresh cup! Tap a flower to add it.');
    });
  }

  /* ------------------------------------------------------------------ *
   * Goat
   * ------------------------------------------------------------------ */
  function initGoat() {
    const btn = $('#goat-btn'), bubble = $('#goat-bubble');
    if (!btn) return;
    const lines = ['Baa! Welcome to the farm!', 'Have you picked a strawberry yet?', 'Psst… got any snacks?', 'Baa-rilliant day for a visit!', 'Don’t forget your reservation!', 'The kids can feed us. Just ask!'];
    let i = 0;
    btn.addEventListener('click', () => {
      bubble.textContent = t(lines[i++ % lines.length]);
      btn.classList.remove('baa'); void btn.offsetWidth; btn.classList.add('baa');
    });
  }

  /* ------------------------------------------------------------------ *
   * Crop rows that grow along the top of a few sections
   * ------------------------------------------------------------------ */
  function initCrops() {
    const bloomColors = ['#ff6fa5', '#a682ff', '#ffffff', '#ff8a3d', '#5aa9ff'];
    const make = (type, rndv) => {
      const pick = (a) => a[Math.floor(rndv() * a.length)];
      if (type === 'eat') {
        if (rndv() < 0.45) { return { h: 34 + rndv() * 16, ratio: 40 / 52, html: '<svg viewBox="0 0 40 52"><use href="#sprout"/></svg>' }; }
        const c = pick(bloomColors), h = 70 + rndv() * 40;
        return { h, ratio: 0.55, sway: true, html: `<svg viewBox="0 0 60 110"><path d="M30 110V40" stroke="#3a2416" stroke-width="9" stroke-linecap="round"/><path d="M30 110V40" stroke="#43a047" stroke-width="5" stroke-linecap="round"/><path d="M30 92c-14 0-20-8-22-16 12-2 20 4 22 16Z" fill="#5cb85c" stroke="#3a2416" stroke-width="2.5" stroke-linejoin="round"/><g style="color:${c}"><use href="#bloom" x="2" y="0" width="56" height="56"/></g></svg>` };
      }
      const r = rndv();
      if (r < 0.15) { const h = 96 + rndv() * 26; return { h, ratio: 140 / 380, sway: true, html: '<svg viewBox="0 0 140 380"><use href="#sunflower-plant"/></svg>' }; }
      if (r < 0.32) { const h = 44 + rndv() * 16; return { h, ratio: 120 / 90, html: '<svg viewBox="0 0 120 90"><use href="#sb-plant"/></svg>' }; }
      if (r < 0.46) { const h = 44 + rndv() * 14; return { h, ratio: 110 / 92, html: '<svg viewBox="0 0 110 92"><use href="#pumpkin"/></svg>' }; }
      if (r < 0.58) { const h = 44 + rndv() * 12; return { h, ratio: 90 / 92, html: '<svg viewBox="0 0 90 92"><use href="#blueberry"/></svg>' }; }
      if (r < 0.74) { const h = 78 + rndv() * 22; return { h, ratio: 80 / 110, sway: true, html: '<svg viewBox="0 0 80 110"><use href="#tomato-plant"/></svg>' }; }
      if (r < 0.88) { const h = 40 + rndv() * 14; return { h, ratio: 1, html: '<svg viewBox="0 0 64 64" style="color:' + pick(['#4caf50', '#3f9b45', '#66bb6a', '#7b2d5f']) + '"><use href="#basil"/></svg>' }; }
      return { h: 36 + rndv() * 12, ratio: 40 / 52, html: '<svg viewBox="0 0 40 52"><use href="#sprout"/></svg>' };
    };

    const fill = (row) => {
      const type = row.dataset.crops;
      const width = row.parentElement.clientWidth;
      const step = width < 600 ? 50 : 62;
      const r = mulberry32(type === 'eat' ? 5 : 8);
      row.textContent = '';
      let i = 0;
      for (let x = 8; x < width; x += step + r() * 16) {
        const c = make(type, r);
        if (x + c.h * c.ratio > width - 6) break;            // never poke past the screen edge
        const el = doc.createElement('span');
        el.className = 'crop' + (c.sway ? ' sway-crop' : '');
        el.style.cssText = `left:${x.toFixed(0)}px;height:${c.h.toFixed(0)}px;width:${(c.h * c.ratio).toFixed(0)}px;--i:${i++}`;
        el.innerHTML = c.html;
        row.appendChild(el);
      }
    };
    let timer = 0;
    const all = () => $$('.crop-row[data-crops]').forEach(fill);
    all();
    addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(all, 200); }, { passive: true });
  }

  /* ------------------------------------------------------------------ *
   * Keep the page light: looping animations only run where someone can see them.
   *  - A section that is far from the screen is paused as a whole (.is-offscreen).
   *  - Inside a section, every drawing that loops is paused on its own while it is off the screen (.anim-off):
   *    the long sections (Visit, Greenhouse, Shop) are "on screen" while one corner of them is, but their
   *    drawings can be several screens away.
   *  - Everything is paused while the tab is hidden (html.anim-hidden).
   * Only endless CSS loops are watched, so hover and click effects (which run once) are never touched, and with
   * prefers-reduced-motion the CSS has switched the loops off already, so there is nothing to pause.
   * A drawing that is not found (drawn later, or inside a symbol) simply keeps running: it can never be frozen by mistake.
   * ------------------------------------------------------------------ */
  function initOffscreenPause() {
    const onVis = () => root.classList.toggle('anim-hidden', doc.hidden);
    doc.addEventListener('visibilitychange', onVis);
    onVis();
    if (!('IntersectionObserver' in window)) return;

    // Drawings that loop. The hero is one screen tall and is paused as a section; the sprite has its own rule below;
    // a symbol or <defs> is only drawn through <use> somewhere else, so its own box says nothing about what can be seen.
    const SKIP = '#top, #sprite, symbol, defs';
    const watched = new WeakSet();
    const artIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.target.isConnected) { artIO.unobserve(e.target); return; }   // redrawn since
        e.target.classList.toggle('anim-off', !e.isIntersecting);
      });
    }, { rootMargin: '200px' });   // wakes up before it scrolls into view
    const hasBox = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 || r.height > 0; };
    const loops = (el) => el.getAnimations().some((a) => a.effect && a.effect.target === el && a.animationName && a.effect.getTiming().iterations === Infinity);
    // The box to watch for one looping element: the whole drawing (outermost <svg>), and never something that moves itself
    // (bobbing, drifting, spinning): a box that moves could be paused just off the screen and then never come back.
    // A drawing that is not drawn yet (size 0, in a section the lazy rendering skips) is watched through the nearest box
    // around it. If there is no real box at the drawing, it is left alone (null) and keeps running.
    const boxFor = (t) => {
      let el = t;
      while (el.ownerSVGElement) el = el.ownerSVGElement;
      const mine = el.getBoundingClientRect();
      for (let hops = 0; el && el !== doc.body && hops < 6; hops++, el = el.parentElement) {
        if (el.matches('main, main > section, .site-footer, .footer-field')) return null;   // a whole section is handled above
        if (loops(el) || !hasBox(el)) continue;   // it moves itself, or has no box yet: watch what holds it instead
        // close to the drawing (inside it, or at most 100px away, less than the 200px head start below), so that when the
        // drawing can be seen this box is always inside the head start too
        const r = el.getBoundingClientRect();
        if (Math.max(0, mine.left - r.right, r.left - mine.right, mine.top - r.bottom, r.top - mine.bottom) <= 100) return el;
      }
      return null;
    };
    const scan = (scope) => {
      let list;
      try { list = scope ? scope.getAnimations({ subtree: true }) : doc.getAnimations(); } catch (err) { return; }
      list.forEach((a) => {
        const t = a.effect && a.effect.target;
        if (!a.animationName || !t || !t.isConnected || a.effect.getTiming().iterations !== Infinity || t.closest(SKIP)) return;   // endless CSS loops only
        const box = boxFor(t);
        if (box && !watched.has(box)) { watched.add(box); artIO.observe(box); }
      });
    };
    // Look again whenever new drawings can appear: after load, when a section comes near, after a season, language,
    // tab or size change (cards, panels and crop rows are drawn again).
    const pending = new Set();
    let timer = 0;
    const scanSoon = (scope) => {
      pending.add(scope || doc);
      clearTimeout(timer);
      timer = setTimeout(() => { const all = pending.has(doc), list = [...pending]; pending.clear(); if (all) scan(); else list.forEach(scan); }, 250);
    };
    if (doc.readyState === 'complete') scanSoon(); else addEventListener('load', () => scanSoon());
    ['wa:season', 'wa:lang'].forEach((ev) => doc.addEventListener(ev, () => scanSoon()));
    addEventListener('resize', () => scanSoon(), { passive: true });
    doc.addEventListener('click', (e) => { const sec = e.target.closest && e.target.closest('main > section'); if (sec) scanSoon(sec); });

    const scanned = new WeakMap();   // a section is looked at again when it comes near, but not more than every few seconds
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        e.target.classList.toggle('is-offscreen', !e.isIntersecting);
        if (e.isIntersecting && e.target.matches('main > section') && !(performance.now() - (scanned.get(e.target) || -1e9) < 5000)) { scanned.set(e.target, performance.now()); scanSoon(e.target); }
      });
    }, { rootMargin: '160px 0px' });
    $$('main > section, .site-footer, .footer-field').forEach((el) => {
      io.observe(el);
      // A section that is skipped by the lazy rendering has no boxes yet, so its drawings can only be found once it is drawn.
      el.addEventListener('contentvisibilityautostatechange', (e) => { if (!e.skipped) scanSoon(el); });
    });
    // The waving riders live inside the sprite, so it only runs while the add-ons list is on screen.
    const sprite = $('#sprite');
    const users = $$('.addon-list');
    if (sprite && users.length) {
      const seen = new Set();
      new IntersectionObserver((entries) => {
        entries.forEach((e) => (e.isIntersecting ? seen.add(e.target) : seen.delete(e.target)));
        sprite.classList.toggle('is-offscreen', seen.size === 0);
      }, { rootMargin: '160px 0px' }).observe(users[0]);
    } else if (sprite && !$('#farm-map')) {
      sprite.classList.add('is-offscreen');   // a page with no wagon anywhere (the guide pages): nobody can see the riders wave
    }
  }

  /* ------------------------------------------------------------------ *
   * Back-to-top button: shows after a couple of screens of scrolling
   * ------------------------------------------------------------------ */
  function initToTop() {
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'to-top';
    btn.hidden = true;
    btn.setAttribute('aria-label', t('Back to top'));
    btn.innerHTML = '<svg class="ico" aria-hidden="true"><use href="#i-chevron"/></svg>';
    doc.body.appendChild(btn);
    let ticking = false;
    const update = () => { ticking = false; btn.hidden = scrollY < innerHeight * 1.6; };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    btn.addEventListener('click', () => { scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); });
    doc.addEventListener('wa:lang', () => btn.setAttribute('aria-label', t('Back to top')));
    update();
  }

  /* ------------------------------------------------------------------ */
  initToTop();
  initOffscreenPause();
  initPrint();
  initGallery();
  initZoom();
  initReviews();
  initNav();
  initReveal();
  initBee();
  initSeasons();
  initFarmSeasons();
  initGroups();
  initWeekStrips();
  initVarietyFilter();
  initFarmCalendar();
  initBouquet();
  initGoat();
  initCrops();
  initScroll();
})();
