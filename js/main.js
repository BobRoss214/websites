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

  // <dialog> and its methods arrived in Safari 15.4 and Firefox 98. Where they are missing, the photo viewer is drawn as a plain fixed box
  // (class lb-fallback in css/styles.css) and opened, closed and Escape-d here, so a tap on a photo still works.
  const hasDialog = typeof HTMLDialogElement === 'function' && typeof HTMLDialogElement.prototype.showModal === 'function';
  const openDialog = (d) => { if (hasDialog) { d.showModal(); return; } d.classList.add('lb-fallback'); d.setAttribute('open', ''); const c = $('.lightbox-close', d); if (c) c.focus(); };
  const closeDialog = (d) => { if (hasDialog) d.close(); else d.removeAttribute('open'); };
  const wireDialog = (d) => {
    if (hasDialog || d._fb) return; d._fb = true;
    const f = $('form', d); if (f) f.addEventListener('submit', (e) => { e.preventDefault(); closeDialog(d); });   // method="dialog" does nothing here and would reload the page
    d.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); closeDialog(d); } });
  };

  /* ------------------------------------------------------------------ *
   * Photo viewer: ONE <dialog> shared by the gallery and by every photo marked data-zoom (the page's own #lightbox, or one made on first use).
   * Photos from the gallery open with Previous / Next buttons, the Left / Right arrow keys and a sideways swipe, and say "3 of 30"; they go round
   * (the last one is followed by the first) through the photos the topic button shows right now, in page order. A single photo opens without them.
   * ------------------------------------------------------------------ */
  const viewer = (() => {
    let box = null, img = null, cap = null, count = null, prev = null, next = null;
    let set = [], at = 0, dir = 1, opener = null, pre = null, onLoad = null, finger = null;
    const SWIPE = 48;   // px sideways; and at least twice as far as it went up or down, so a scroll-like or diagonal drag changes nothing
    const later = window.requestIdleCallback ? (f) => window.requestIdleCallback(f, { timeout: 1500 }) : (f) => setTimeout(f, 250);

    const afterClose = () => { box.classList.remove('is-zoomed'); if (opener && opener.isConnected) { try { opener.focus({ preventScroll: true }); } catch (e) { /* gone */ } } opener = null; };
    const shut = () => { closeDialog(box); afterClose(); };
    const render = (fade) => {
      const p = set[at], many = set.length > 1;
      img.src = p.src; img.alt = p.alt; cap.textContent = p.caption || '';
      box.classList.toggle('is-single', !many);
      prev.hidden = next.hidden = count.hidden = !many;
      if (many) {
        prev.setAttribute('aria-label', t('Previous photo')); next.setAttribute('aria-label', t('Next photo'));
        const n = doc.createElement('span'), alt = doc.createElement('span');   // the number is what is seen; the photo's description is only for a screen reader
        n.textContent = t('{n} of {total}', { n: at + 1, total: set.length });
        alt.className = 'sr-only'; alt.textContent = p.alt ? '. ' + p.alt : '';
        count.textContent = ''; count.appendChild(n); count.appendChild(alt);   // not replaceChildren(): Chrome before 86 does not have it
      }
      if (fade && !reduceMotion) { img.classList.remove('lb-fade'); void img.offsetWidth; img.classList.add('lb-fade'); }   // a short fade, never a slide
      // only the photo the visitor is heading for is fetched ahead of time, and only when the browser is idle
      if (onLoad) img.removeEventListener('load', onLoad);
      if (many) {
        const ahead = () => later(() => { pre = new Image(); pre.decoding = 'async'; pre.src = set[(at + dir + set.length) % set.length].src; });
        if (img.complete) ahead(); else { onLoad = () => { onLoad = null; ahead(); }; img.addEventListener('load', onLoad, { once: true }); }
      }
    };
    const go = (d) => { if (set.length < 2) return; dir = d; at = (at + d + set.length) % set.length; render(true); };

    const ensure = () => {
      if (box) return;
      box = $('#lightbox');
      if (!box) {
        box = doc.createElement('dialog');
        box.className = 'lightbox'; box.id = 'lightbox'; box.setAttribute('aria-label', t('Photo viewer'));
        box.innerHTML = '<form method="dialog"><button class="lightbox-close" type="submit"><svg class="ico" aria-hidden="true"><use href="#i-close"/></svg></button></form><img id="lightbox-img" alt=""><p id="lightbox-cap"></p>';
        doc.body.appendChild(box);
      }
      img = $('#lightbox-img', box); cap = $('#lightbox-cap', box);
      const arrow = (cls, d) => { const b = doc.createElement('button'); b.type = 'button'; b.className = 'lightbox-nav ' + cls; b.hidden = true; b.innerHTML = '<svg class="ico" aria-hidden="true"><use href="#i-arrow"/></svg>'; b.addEventListener('click', () => go(d)); return b; };
      prev = arrow('lightbox-prev', -1); next = arrow('lightbox-next', 1);
      count = doc.createElement('p'); count.id = 'lightbox-count'; count.className = 'lightbox-count'; count.hidden = true;
      count.setAttribute('role', 'status'); count.setAttribute('aria-live', 'polite');   // read out when the photo changes
      box.append(prev, next, count);
      wireDialog(box);
      // a tap on the dark area closes it; a tap in the gaps between the photo and the buttons (inside the box) does not
      box.addEventListener('click', (e) => { if (e.target !== box) return; const r = box.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) shut(); });
      box.addEventListener('close', afterClose);
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {   // Tab goes round the buttons of the viewer instead of out to the browser's own bar
          const tabs = $$('button', box).filter((b) => !b.hidden && !b.disabled);
          if (!tabs.length) return;
          const first = tabs[0], last = tabs[tabs.length - 1];
          if (e.shiftKey && (doc.activeElement === first || !box.contains(doc.activeElement))) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && (doc.activeElement === last || !box.contains(doc.activeElement))) { e.preventDefault(); first.focus(); }
          return;
        }
        if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
        if (e.key === 'ArrowRight') { e.preventDefault(); go(1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      });
      // swipe: one finger, mostly sideways. Two fingers (a pinch) and a zoomed-in page are left alone.
      const fingers = new Set();
      box.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') return;
        fingers.add(e.pointerId);
        finger = fingers.size === 1 && !e.target.closest('button') ? { id: e.pointerId, x: e.clientX, y: e.clientY } : null;
      });
      const end = (e, done) => {
        fingers.delete(e.pointerId);
        const f = finger; if (!f || f.id !== e.pointerId) return;
        finger = null;
        const zoomed = window.visualViewport && window.visualViewport.scale > 1.02;
        const dx = e.clientX - f.x, dy = e.clientY - f.y;
        if (done && !zoomed && fingers.size === 0 && Math.abs(dx) >= SWIPE && Math.abs(dx) >= 2 * Math.abs(dy)) go(dx < 0 ? 1 : -1);
      };
      box.addEventListener('pointerup', (e) => end(e, true));
      box.addEventListener('pointercancel', (e) => end(e, false));
      // zoomed in with a pinch: one finger moves the picture instead of being held back (the viewer allows only pinching while it is not zoomed)
      if (window.visualViewport) window.visualViewport.addEventListener('resize', () => box.classList.toggle('is-zoomed', window.visualViewport.scale > 1.02));
    };

    const open = (list, index, from) => {
      ensure();
      box.setAttribute('aria-label', t('Photo viewer'));
      const x = $('.lightbox-close', box); if (x) x.setAttribute('aria-label', t('Close photo'));   // translated text never goes into markup
      set = list; at = index; dir = 1; opener = from || null; finger = null;
      render(false);
      openDialog(box);
    };
    return { open, one: (src, alt, caption, from) => open([{ src, alt: alt || '', caption: caption || '' }], 0, from) };
  })();

  function initPrint() {
    $$('[data-print]').forEach((b) => b.addEventListener('click', () => window.print()));
    // On paper every answer should show, not only the one that happens to be open: open them all while printing, then put them back.
    // (The question groups share a name so only one stays open; the name is taken off for the moment too.)
    let opened = null;
    const openAll = () => { if (opened) return; opened = $$('main details').map((d) => ({ d, open: d.open, name: d.getAttribute('name') })); opened.forEach(({ d }) => { d.removeAttribute('name'); d.open = true; }); };
    const putBack = () => { if (!opened) return; opened.forEach(({ d, open, name }) => { if (name !== null) d.setAttribute('name', name); d.open = open; }); opened = null; };
    addEventListener('beforeprint', openAll); addEventListener('afterprint', putBack);
    if (window.matchMedia) { const mq = window.matchMedia('print'); const on = (e) => (e.matches ? openAll() : putBack()); if (mq.addEventListener) mq.addEventListener('change', on); else if (mq.addListener) mq.addListener(on); }
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
        // a link only to a web address (https:// or http://): a javascript: or data: address from js/content.js is not made into a link
        if (r.url && /^https?:\/\//i.test(String(r.url).trim())) { const a = doc.createElement('a'); a.href = String(r.url).trim(); a.target = '_blank'; a.rel = 'noopener'; a.textContent = r.source; by.appendChild(a); }
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
    const photos = ((window.WISE_ACRES && window.WISE_ACRES.photos) || []).filter((p) => p && typeof p.src === 'string' && p.src);   // no picture file, no photo (the Site check box says so, js/features.js)
    const section = $('#gallery');
    if (!section || !photos.length) return;

    const grid = $('#gallery-grid');
    const filters = $('#gallery-filters');
    const countEl = $('#gallery-count');
    const altOf = (p) => (p.alt ? t(p.alt) : '');   // a photo without alt text is read as "undefined" otherwise
    const tagsOf = (p) => (Array.isArray(p.tags) ? p.tags : []).map((x) => String(x).trim().toLowerCase()).filter(Boolean);   // tags: ["berries", "flowers"] in js/content.js

    const items = photos.map((p) => {
      const li = doc.createElement('li');
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.setAttribute('aria-haspopup', 'dialog');   // tells a screen reader that this opens the photo viewer
      const thumb = doc.createElement('img');
      thumb.loading = 'lazy'; thumb.decoding = 'async'; thumb.src = p.src;   // lazy first: setting src first starts the download at once
      btn.appendChild(thumb);
      li.appendChild(btn);
      grid.appendChild(li);
      const it = { p, li, btn, thumb, tags: tagsOf(p) };
      btn.addEventListener('click', () => {   // the viewer goes round the photos that are shown right now (the topic button pressed), in page order
        const shown = items.filter((x) => !x.li.hidden);
        viewer.open(shown.map((x) => ({ src: x.p.src, alt: altOf(x.p), caption: x.p.caption ? t(x.p.caption) : '' })), Math.max(0, shown.indexOf(it)), btn);
      });
      return it;
    });
    const words = () => items.forEach((it) => {   // alt text and button labels in the language of the page (drawn again when the language changes)
      it.thumb.alt = altOf(it.p);
      it.btn.setAttribute('aria-label', t('Enlarge photo:') + (it.p.alt ? ' ' + altOf(it.p) : ''));
    });
    words();

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
    const bind = (el) => {
      if (el._zoom) return;
      el._zoom = true;
      if (el.tagName === 'IMG') {
        el.tabIndex = 0; el.setAttribute('role', 'button'); el.setAttribute('aria-haspopup', 'dialog');   // a photo that opens the viewer
        const open = () => { const fc = el.closest('figure') && el.closest('figure').querySelector('figcaption'); viewer.one(el.currentSrc || el.src, el.alt, fc ? fc.textContent : '', el); };
        el.addEventListener('click', open);
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      } else {
        el.setAttribute('aria-haspopup', 'dialog');
        el.addEventListener('click', (e) => { e.preventDefault(); viewer.one(el.href, el.textContent.trim(), '', el); });
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
    // a change of language puts back the closed-menu label: say "Close menu" again if the menu is open
    doc.addEventListener('wa:lang', () => toggle.setAttribute('aria-label', toggle.getAttribute('aria-expanded') === 'true' ? t('Close menu') : t('Open menu')));
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

    // The seven drop-down groups (Visit, Things to Do, GreenHouse, Store, Groups & Parties, About Us, Contact): a click on a button opens its list under it,
    // a second click, Escape, a click anywhere else or tabbing out closes it. Only one list is open at a time. A click on a line closes the list and the browser
    // goes to the line's place. (In the phone menu the buttons are hidden and every list is shown: the CSS does that, nothing here runs for it.)
    const groups = $$('.nav-group', nav);
    const btnOf = (g) => $('.nav-group-btn', g);
    const isOpen = (g) => g.classList.contains('is-open');
    const setGroup = (g, open) => {
      g.classList.toggle('is-open', open);
      btnOf(g).setAttribute('aria-expanded', String(open));
    };
    const closeGroups = (except) => groups.forEach((g) => { if (g !== except && isOpen(g)) setGroup(g, false); });
    groups.forEach((g) => {
      const btn = btnOf(g);
      btn.addEventListener('click', () => { const open = !isOpen(g); closeGroups(g); setGroup(g, open); });
      g.addEventListener('focusout', (e) => { if (!g.contains(e.relatedTarget)) setGroup(g, false); });
      g.addEventListener('click', (e) => { if (e.target.closest('a')) setGroup(g, false); });
    });
    // a press or a click anywhere else closes the open list (pointerdown also covers a tap where the browser sends no click to the page)
    const outside = (e) => { if (!(e.target.closest && e.target.closest('.nav-group'))) closeGroups(); };
    doc.addEventListener('pointerdown', outside);
    doc.addEventListener('click', outside);
    // Escape closes the open list and puts the focus back on its button (also when the focus was not inside the list)
    doc.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      groups.filter(isOpen).forEach((g) => { const keep = g.contains(doc.activeElement) || doc.activeElement === doc.body; setGroup(g, false); if (keep) btnOf(g).focus(); });
    });

    // A line for something that only some seasons show (the "Playgrounds" card is not there in winter) goes to its
    // data-fallback place in the other seasons. The place is the line's own address with the part after # changed, so it also works on the other pages.
    const seasonal = $$('a[data-seasons]', nav);
    seasonal.forEach((a) => { a.dataset.href = a.getAttribute('href'); });
    const aim = (id) => seasonal.forEach((a) => a.setAttribute('href', a.dataset.seasons.split(/\s+/).indexOf(id) >= 0 ? a.dataset.href : a.dataset.href.replace(/#.*$/, '#' + a.dataset.fallback)));
    aim(S.active || S.current());
    doc.addEventListener('wa:season', (e) => aim(e.detail));

    // Coming up: a line that says which season it belongs to (data-coming="winter") is bold with a little red dot from 60 days before that season
    // starts until it ends, and so is the button of its group (the class has-coming), so a visitor who has not opened the list sees it too.
    // A screen reader is told "coming soon" (a hint the line is described by) until the season has started. The day is the farm's day (the season code works it out).
    const COMING_DAYS = 60;
    if (W.clockOk && W.clockOk() && S && S.list) {
      const today = new Date();
      $$('a[data-coming]', nav).forEach((a) => {
        const s = S.list.filter((x) => x.id === a.dataset.coming)[0];
        if (!s) return;
        const now = S.inWindow(s, today);
        if (!now && S.daysUntilStart(s, today) > COMING_DAYS) return;
        a.classList.add('is-coming');
        if (!now) {   // beside the link, not inside it: the words of the line stay the words of the line
          const hint = doc.createElement('span');
          hint.className = 'sr-only'; hint.id = 'coming-' + s.id;
          const say = () => { hint.textContent = t('Coming soon'); };
          say(); doc.addEventListener('wa:lang', say);
          a.parentNode.appendChild(hint); a.setAttribute('aria-describedby', hint.id);
        }
        const g = a.closest('.nav-group');
        if (g) g.classList.add('has-coming');
      });
    }

    // Scroll-spy: light the group button (and the line, if its list is open) for the section in the middle of the screen.
    if (!('IntersectionObserver' in window)) return;
    // A place can have several lines (Ice cream and Drinks are under GreenHouse and under Store): all of them are kept.
    const links = new Map();
    $$('.nav a[href^="#"]', nav).forEach((a) => { const key = a.getAttribute('href').slice(1); links.set(key, (links.get(key) || []).concat(a)); });
    // each group says which sections belong to it (data-spy on the group, in index.html)
    const groupOf = new Map();
    groups.forEach((g) => (g.dataset.spy || '').split(/\s+/).filter(Boolean).forEach((key) => groupOf.set(key, g)));
    const setCurrent = (id) => {
      links.forEach((list, key) => list.forEach((a) => (key === id ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current'))));
      groups.forEach((g) => { if (groupOf.get(id) === g) btnOf(g).setAttribute('aria-current', 'true'); else btnOf(g).removeAttribute('aria-current'); });
    };
    const onSpy = (entries) => {
      entries.forEach((en) => { if (en.isIntersecting) setCurrent(en.target.dataset.nav || en.target.id); });
    };
    // root: doc keeps the band in the middle of the screen when the site is shown inside a frame from another address (the claude.ai
    // preview is one). Without it the browser ignores rootMargin there, the whole screen counts, and the section that comes into view last
    // wins: scrolling up to Pizza lit Tomatoes, whose end sits under the header. Older browsers do not take a page as root: the plain way then.
    let spy;
    try { spy = new IntersectionObserver(onSpy, { root: doc, rootMargin: '-45% 0px -50% 0px' }); } catch (e) { spy = new IntersectionObserver(onSpy, { rootMargin: '-45% 0px -50% 0px' }); }
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
   * Hero: the bee and the butterfly
   *
   * What follows the pointer is a bee or a butterfly. The page picks one at random when it loads, and every 45 to 75 seconds (random) while the
   * visitor stays it flies off the edge of the hero and comes back as the other kind. The address can pick the kind instead (?critter=bee or
   * ?critter=butterfly; only this page reads it, nothing is stored): then it stays that kind, which is what the tests and a person showing the
   * page need. window.WISE_ACRES.critter.kind says which one it is, .swap() starts the change at once and .changeIn says how many ms are left until it comes by itself.
   * HOW IT MOVES: it chases a spot the way a living thing does, in one smooth glide, never in hops. Ten times a second it looks where it wants to be
   * (the pointer, or a spot of the field when nobody is moving one), works out how fast to go (far away: fast; close: slower and slower, so it
   * settles by itself) and starts a short straight leg of 240 ms from where it is right now. Where it is right now is worked out from the running leg's
   * own start time and length (a leg is a Web Animation of the transform of #bee-fly, and it is given its start time at once, see clock() below), so every
   * new leg starts exactly where the last one has got to and the path has no joins, however slowly the computer draws its frames. A leg costs the
   * compositor next to nothing; nothing runs per frame, because a drawing frame of the hero costs the browser far more than the creature is worth
   * (every endless loop in the scene is restyled and repainted with it).
   * (The flight must move a <div>: an <svg> element moved by the `translate` property is not run by the compositor.)
   * The bee goes straight and turns to face the way it goes. The butterfly is slower and lighter and drifts a little from side to side as it
   * flies, and it banks towards the way it goes. The wings and the bobbing are endless CSS loops on the drawing inside (css/styles.css).
   * It settles next to the hero's own buttons and cards instead of on them (it may fly over them, not rest on them), so it never hides one for long.
   * What parks it (and nothing else): the hero is scrolled out of sight, the tab is hidden, the season is winter (the CSS hides it), or the visitor
   * pressed "Pause animations" (data-calm="all"). The page's own calm mode (data-calm="light" or "most", set when the hero struggles on a slow
   * computer) never stops the flight: a flight is a few compositor animations that cost next to nothing (see initMotion for what it rests).
   * A change of kind always ends: if the creature has not got out of the hero after 12 seconds (whatever went wrong) the other kind is put there anyway. Parked while it is
   * still in sight, it stays where it is, as what it is; parked out of sight, it is put back inside the hero as the other kind. A window made smaller puts it back inside the hero.
   * A pointer over the hero proves that the hero is on screen, whatever an observer last said (a viewer that shows the page in a frame can be wrong
   * about that), so a pointer wakes a creature that was parked by mistake. With "reduce motion" it is not shown at all.
   * ------------------------------------------------------------------ */
  function initBee() {
    const hero = $('#top');
    const bee = $('#bee-fly');                  // the box that flies; the bee and the butterfly are both drawn inside it, one of them shown (data-kind)
    if (!hero || !bee) return;
    if (reduceMotion || !bee.animate) { bee.setAttribute('hidden', ''); return; }

    const TICK = 100, LEG = 240, LEAVE_MAX = 12000;   // ms: how often it looks where to go, how long one leg is (a leg is cut short by the next one), and the longest the flight out of the hero may last (see swap)
    // gain: how fast it goes for each pixel it still has to go (px per second per px); min, max: the slowest and fastest it goes (px per second);
    // wander*: the same for a stroll through the field; rest: how long it stays before it strolls to another spot (ms: least, then up to this much more)
    const KINDS = {
      bee: { gain: 3.4, min: 45, max: 860, wanderGain: 1.5, wanderMax: 210, rest: [2200, 2600], sway: 0 },
      butterfly: { gain: 2.4, min: 35, max: 540, wanderGain: 1.1, wanderMax: 150, rest: [1500, 2200], sway: 11 },
    };
    const HUES = ['monarch', 'morpho', 'admiral'];   // the butterfly's colours (css/styles.css)
    const BW = 52, BH = 40;                     // the box (px): what has to be clear of a button
    const asked = new URLSearchParams(location.search).get('critter');
    const pinned = asked === 'bee' || asked === 'butterfly' ? asked : '';
    const later = () => 45000 + Math.random() * 30000;   // the next change of kind

    let w = hero.clientWidth, h = hero.clientHeight;
    let x = w * 0.2, y = h * 0.55, tilt = 0, flip = 1;   // where it is, or was when the current leg began (tilt: the butterfly's lean, in degrees; flip: the bee's scaleX, 1 or -1 and between while it turns)
    let kind = pinned || (Math.random() < 0.5 ? 'bee' : 'butterfly');
    let leg = null;                             // the leg in flight: { anim, x0, y0, x1, y1, r0, r1 }
    let aim = null;                             // where it is going: { follow } (the pointer) or { x, y } (a spot), plus gain, max, near and done
    let facing = 1, lastMove = 0, wanderAt = 0, swapAt = pinned ? Infinity : performance.now() + later(), px = 0, py = 0;
    let onScreen = false, running = false, tickTimer = 0, wanderTimer = 0, swapGuard = 0, leaving = 0;   // leaving: -1 or 1, the side it flies out of while it changes kind
    const clamp2 = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

    const setKind = (k) => {
      kind = k; bee.dataset.kind = k;
      if (k === 'butterfly') bee.dataset.hue = HUES[Math.floor(Math.random() * HUES.length)];
    };
    const pose = (a, b, f, r) => `translate(${a.toFixed(1)}px, ${b.toFixed(1)}px) ` + (kind === 'bee' ? `scaleX(${f.toFixed(2)})` : `rotate(${r.toFixed(1)}deg)`);   // scaleX turns the bee to face the way it flies
    const place = () => { bee.style.transform = pose(x, y, flip, tilt); };
    setKind(kind); place();
    bee.classList.add('is-ready');

    // The clock every leg is run by (ms): the browser's animation clock. A leg gets its start time from it at once, and where the creature is at a moment is
    // worked out from that start time, not asked of the browser: a leg that is left to start "at the next drawn frame" is not started yet in the eyes of the
    // script while the compositor already draws it, and a computer that draws a frame only now and then (a slow phone, a busy laptop) then sent the
    // creature back to where the last leg began, again and again: it jumped back and forth instead of gliding (tests/critter.test.mjs: "every leg has its start time at once").
    const clock = () => { const t = doc.timeline && doc.timeline.currentTime; return typeof t === 'number' ? t : performance.now(); };
    const here = (t = clock()) => {             // where it is at the moment t, part-way through a leg: [x, y, tilt, flip]
      if (!leg) return [x, y, tilt, flip];
      let e;
      if (leg.t0 !== null) e = clamp2((t - leg.t0) / leg.ms, 0, 1);   // the legs are linear
      else { const p = leg.anim.effect.getComputedTiming().progress; e = typeof p === 'number' ? clamp2(p, 0, 1) : 0; }   // a browser that does not take a start time: ask the leg
      return [leg.x0 + (leg.x1 - leg.x0) * e, leg.y0 + (leg.y1 - leg.y0) * e, leg.r0 + (leg.r1 - leg.r0) * e, leg.f0 + (leg.f1 - leg.f0) * e];
    };
    const go = (x1, y1, r1, f1, ms, t = clock()) => {   // one leg, straight and even, from where it is right now (t: the moment it is looked at)
      [x, y, tilt, flip] = here(t);
      const prev = leg;
      const anim = bee.animate([{ transform: pose(x, y, flip, tilt) }, { transform: pose(x1, y1, f1, r1) }], { duration: ms, easing: 'linear', fill: 'forwards' });
      let t0 = t;
      try { anim.startTime = t; if (!(Math.abs(anim.startTime - t) < 0.5)) t0 = null; } catch (e) { t0 = null; }
      leg = { anim, t0, ms, x0: x, y0: y, x1, y1, r0: tilt, r1, f0: flip, f1 };
      if (prev) prev.anim.cancel();
    };

    // The hero's own buttons and cards: the creature settles next to them, not on them. The box's top-left corner is moved to the nearest spot, just above,
    // below or beside a button, where the box touches none of them (the pointer keeps the button, the creature keeps the pointer company).
    const keep = $$('.hero-cta a, .hero-note, .hero-note a, .season-switch, .chips a, .picker', hero);
    const clearOf = (tx, ty) => {
      const r = hero.getBoundingClientRect();
      const boxes = keep.filter((el) => el.getClientRects().length).map((el) => { const b = el.getBoundingClientRect(); return [b.left - r.left - BW + 2, b.top - r.top - BH + 2, b.right - r.left - 2, b.bottom - r.top - 2]; });   // where the box's corner would touch the button
      const inside = (b, cx, cy) => cx > b[0] && cx < b[2] && cy > b[1] && cy < b[3];
      if (!boxes.some((b) => inside(b, tx, ty))) return [tx, ty];
      const spots = [];
      boxes.forEach((b) => spots.push([tx, b[1]], [tx, b[3]], [b[0], ty], [b[2], ty]));
      const free = spots.filter((c) => c[0] >= -BW / 2 && c[0] <= w - BW / 2 && c[1] >= 0 && c[1] <= h - BH && !boxes.some((b) => inside(b, c[0], c[1])))
        .sort((a, b) => Math.hypot(a[0] - tx, a[1] - ty) - Math.hypot(b[0] - tx, b[1] - ty));
      return free.length ? free[0] : [tx, ty];
    };
    const spotOf = (a) => {                     // where the aim is right now (the pointer moves, so a following aim is worked out each time)
      if (!a.follow) return [a.x, a.y];
      const r = hero.getBoundingClientRect();
      return clearOf(clamp2(px - r.left - 26, -BW / 2, w - BW / 2), clamp2(py - r.top - 24, 0, Math.max(0, h - BH)));   // (a pointer that has been left outside the hero by a smaller window is followed to the edge of it)
    };

    const setAim = (a) => { aim = a; if (running && !tickTimer) chase(); };
    function chase() {                          // the one step of the glide: look, work out the speed, start a leg, look again in a moment
      tickTimer = 0;
      if (!running || !aim) return;
      if (leg && leg.t0 === null && (leg.anim.pending === true || leg.anim.startTime === null)) { tickTimer = setTimeout(chase, TICK); return; }   // (a browser that took no start time) the last leg is not drawn yet: a new one would throw it away before it moved
      const K = KINDS[kind], a = aim, t = clock();
      const [cx, cy] = here(t);
      const [tx, ty] = spotOf(a);
      const dx = tx - cx, dy = ty - cy, d = Math.hypot(dx, dy);
      if (d < (a.near || 4)) {                  // there
        if (a.follow && performance.now() - lastMove < 700) { tickTimer = setTimeout(chase, TICK); return; }   // the pointer is still about: stay with it
        aim = null;
        if (a.done) a.done();
        return;
      }
      const speed = clamp2(d * a.gain, K.min, a.max), step = Math.min(d, speed * LEG / 1000), ms = Math.max(60, step / speed * 1000);
      let ex = cx + dx / d * step, ey = cy + dy / d * step;
      if (K.sway) { const k = Math.sin(performance.now() / 280) * K.sway * Math.min(1, d / 90); ex += -dy / d * k; ey += dx / d * k; }   // the butterfly drifts to one side and the other
      if (kind === 'bee' && Math.abs(dx) > 18) facing = dx > 0 ? 1 : -1;
      go(ex, ey, kind === 'butterfly' ? clamp2(dx / 14, -18, 18) : 0, kind === 'bee' ? facing : 1, ms, t);
      tickTimer = setTimeout(chase, TICK);
    }
    const followAim = () => ({ follow: true, gain: KINDS[kind].gain, max: KINDS[kind].max });

    const wander = () => {                      // nobody is moving a pointer: stroll through the field now and then, slowly
      wanderTimer = 0;
      if (!running) return;
      const now = performance.now(), K = KINDS[kind];
      if (!leaving && now >= swapAt) swap();
      else if (!leaving && !aim && now - lastMove > 2500 && now >= wanderAt) {
        const [sx, sy] = clearOf(w * (0.08 + Math.random() * 0.84), h * (0.5 + Math.random() * 0.36));
        wanderAt = now + K.rest[0] + Math.random() * K.rest[1];
        setAim({ x: sx, y: sy, gain: K.wanderGain, max: K.wanderMax, near: 8 });
      }
      wanderTimer = setTimeout(wander, Math.max(250, 2500 - (now - lastMove), wanderAt - now));   // when both waits are over
    };
    // The change of kind: it flies out over the nearer side edge of the hero (the hero hides what is outside it), and when it is out the
    // other kind is put there and flies in from the same side, to the pointer if it has just been moved, else to a spot in the field.
    function swap() {
      if (leaving || !running) return;
      const [cx, cy] = here();
      leaving = cx < w / 2 ? -1 : 1;
      clearTimeout(swapGuard); swapGuard = setTimeout(() => { swapGuard = 0; if (leaving) arrive(); }, LEAVE_MAX);   // whatever goes wrong, the change of kind ends: while it lasts the pointer is not followed
      setAim({ x: leaving < 0 ? -BW - 40 : w + 40, y: clamp2(cy - 30, 0, h - BH), gain: 2, max: KINDS[kind].max * 0.6, near: 6, done: arrive });
    }
    function arrive() {
      const side = leaving; leaving = 0;
      clearTimeout(swapGuard); swapGuard = 0;
      aim = null; clearTimeout(tickTimer); tickTimer = 0;
      if (leg) { leg.anim.cancel(); leg = null; }
      const r = hero.getBoundingClientRect(), now = performance.now();
      setKind(kind === 'bee' ? 'butterfly' : 'bee');
      swapAt = pinned ? Infinity : now + later();
      wanderAt = now + KINDS[kind].rest[0];   // it does not set off again the moment it is back
      facing = flip = side < 0 ? 1 : -1; tilt = 0;
      if (!running) { x = side < 0 ? 12 : w - BW - 12; y = clamp2(y, 40, h - BH - 12); place(); return; }   // parked (Pause, a hidden tab) while it was away: it is back where it can be seen
      x = side < 0 ? -BW - 40 : w + 40; place();
      if (now - lastMove < 3000) setAim(followAim());
      else { const [sx, sy] = clearOf(w * (0.15 + Math.random() * 0.7), h * (0.5 + Math.random() * 0.3)); setAim({ x: sx, y: sy, gain: 1.6, max: KINDS[kind].max * 0.5, near: 8 }); }
    }
    const onMove = (e) => {
      px = e.clientX; py = e.clientY; lastMove = performance.now();
      if (!onScreen) { onScreen = true; sync(); }   // a pointer here: the hero is on screen
      if (running && !leaving && !(aim && aim.follow)) setAim(followAim());
    };
    hero.addEventListener('pointermove', onMove, { passive: true });
    hero.addEventListener('pointerdown', onMove, { passive: true });
    // The window changed size: a creature that now lies outside the hero (at rest or parked: the hero hides what is outside it) is put back inside, and so is the spot it was going to
    // for a stroll. One that is following the pointer is looked after by its next look.
    const fit = () => {
      if (leaving) return;
      const lo = -BW / 2, hiX = w - BW / 2, hiY = Math.max(0, h - BH);
      if (aim && !aim.follow && !aim.done) { aim.x = clamp2(aim.x, lo, hiX); aim.y = clamp2(aim.y, 0, hiY); }
      const [cx, cy, r, f] = here(), nx = clamp2(cx, lo, hiX), ny = clamp2(cy, 0, hiY);
      if (nx === cx && ny === cy) return;
      if (leg) { leg.anim.cancel(); leg = null; }
      x = nx; y = ny; tilt = r; flip = f; place();
    };
    addEventListener('resize', () => { w = hero.clientWidth; h = hero.clientHeight; fit(); }, { passive: true });

    function sync() {
      const on = onScreen && !doc.hidden && root.getAttribute('data-season') !== 'winter' && root.getAttribute('data-calm') !== 'all';
      if (on === running) return;
      running = on;
      if (running) {
        const now = performance.now();
        lastMove = Math.min(lastMove, now - 2000); swapAt = Math.max(swapAt, now + 8000);   // not at once after a visitor comes back
        wanderTimer = setTimeout(wander, 600);
        return;
      }
      clearTimeout(tickTimer); clearTimeout(wanderTimer); tickTimer = wanderTimer = 0; aim = null;
      if (leg) { [x, y, tilt, flip] = here(); place(); leg.anim.cancel(); leg = null; }   // park it where it is
      if (leaving) {
        if (x + BW > 8 && x < w - 8) { leaving = 0; clearTimeout(swapGuard); swapGuard = 0; swapAt = pinned ? Infinity : performance.now() + later(); }   // still in sight: it stays where it is, as what it is, and changes some other time
        else arrive();                                                               // out of sight: it comes back, parked, in the other kind
      }
    }
    if ('IntersectionObserver' in window) new IntersectionObserver((entries) => { onScreen = entries[entries.length - 1].isIntersecting; sync(); }).observe(hero);
    else { onScreen = true; sync(); }   // no observer: it just keeps going
    doc.addEventListener('visibilitychange', sync);
    doc.addEventListener('wa:season', sync);
    doc.addEventListener('wa:calm', sync);   // "Pause animations" parks it where it is; the calm mode (light, most) does not touch the flight
    W.critter = { get kind() { return kind; }, swap, get changeIn() { return swapAt - performance.now(); } };   // changeIn: ms left until it changes kind by itself (Infinity when the address picked the kind)
  }

  /* ------------------------------------------------------------------ *
   * Motion: the "Pause animations" buttons and the automatic calm mode
   *   One switch on <html>, data-calm, set here and read by the scripts (the bee) and the CSS (the hero's layers):
   *     (not set)         everything moves as drawn
   *     data-calm="light" the page found the hero struggling (a slow phone): the smallest decorations of the hero rest (sparks,
   *                       smoke puffs, swaying flowers, butterflies, the little bees, tree lights; the falling leaves and snow fade
   *                       out (css/hero.css) and rest when they have faded, so that none freezes in mid-air in sight); the bee or
   *                       butterfly that follows the pointer keeps its wings and its flying
   *     data-calm="most"  still struggling after that: every endless animation rests except the few that show something
   *                       (the pulsing "open now" dot, the bell of the reservation chip, the "now" season badge), the
   *                       tractor and the barrel train, which keep driving (they froze on slow computers before), and the wings
   *                       and bobbing of the bee or butterfly that follows the pointer (it flies on, and a creature that flies on
   *                       with frozen wings looks broken)
   *     data-calm="all"   the visitor pressed "Pause animations": every endless animation rests, the bee stops where it is and the
   *                       hero's layers no longer slide at different speeds while scrolling
   *   The buttons show pressed while any of these is set, so one press turns all motion back on (and the page never switches
   *   by itself again). A rested animation stops where it is, so the picture stays whole. What a tap starts (picking, the wagon's
   *   toot, a tree, a farm friend) still plays; anything endless it starts rests a moment later. With "all" a new badge still
   *   shows, but no fruit rains down the hero (js/hero.js, rain). Nothing is stored: it lasts
   *   until the page is left.
   *   The automatic check costs next to nothing: it watches only while the hero is on the screen and the tab is visible, 2 seconds
   *   at a time (6 times, starting 4 seconds after the page has loaded, then every 15 s), counting frames and the browser's long tasks.
   *   With "reduce motion" on in the visitor's system the CSS stops the animations itself: the buttons stay hidden, nothing here runs.
   * ------------------------------------------------------------------ */
  function initMotion() {
    const btns = $$('[data-motion]');
    if (reduceMotion || typeof doc.getAnimations !== 'function') { btns.forEach((b) => { b.hidden = true; }); return; }
    const hero = $('#top');
    const SMALL = '.spark, .puff, .sway, .leaf, .flake, .butterfly, .bw, .bzz, .bzz *, .bulb, .bee, .bee *, .bfly, .bfly *';
    const SHOWS = '.live-dot, .chip-rel .ico, .now-badge';
    const DRIVES = '.rig, .rig *';   // the tractor and the barrel train (wheels, bounce, waving riders): they keep driving by themselves, only the visitor's "Pause animations" stops them
    const FADE = 650;   // ms: the falling leaves and snow fade out in .6 s (css/hero.css); what they are made of rests when they are gone
    let level = '', visitor = false, fadeEnd = 0;
    const held = new Set();   // the animations rested here, so that turning motion on again can start them
    const wanted = (a) => {
      const el = a.effect && a.effect.target;
      if (typeof a.animationName !== 'string' || !el || a.effect.getTiming().iterations !== Infinity) return false;   // endless CSS animations only
      if (level === 'all') return true;
      if (el.closest('#bee-fly')) return false;   // the bee or butterfly that follows the pointer keeps its wings and its bobbing in "light" and in "most": a creature that flies on with frozen wings looks broken
      if (performance.now() < fadeEnd && el.closest('.particles')) return false;   // the leaves and snow are fading out: they go on falling until they are gone, they must not freeze in mid-air in sight
      if (level === 'most') return !el.matches(SHOWS) && !el.matches(DRIVES);
      return !!hero && hero.contains(el) && el.matches(SMALL);
    };
    const rest = () => { if (level) doc.getAnimations().forEach((a) => { if (!held.has(a) && wanted(a)) { a.pause(); held.add(a); } }); };
    const wake = () => {
      const els = new Set();
      held.forEach((a) => { const el = a.effect && a.effect.target; if (el && el.isConnected) { if (a.effect.pseudoElement) { a.currentTime = 0; a.play(); } else els.add(el); } });   // (a part of a drawing that is a ::before restarts too, like the element it belongs to: the tipping of a falling leaf must stay in step with its drifting)
      held.clear();
      // Started again as new CSS animations, so the CSS keeps pausing them off screen and in a hidden tab.
      els.forEach((el) => { const was = el.style.animationName; el.style.animationName = 'none'; void getComputedStyle(el).animationName; el.style.animationName = was; });
    };
    let soon = 0;
    const restSoon = () => { if (level && !soon) soon = setTimeout(() => { soon = 0; rest(); }); };
    doc.addEventListener('animationstart', restSoon, true);   // new endless animations: a season drawn again, a lit tree, a section drawn later
    ['wa:season', 'wa:lang'].forEach((ev) => doc.addEventListener(ev, restSoon));
    const label = () => {
      const on = !!level;
      btns.forEach((b) => { b.setAttribute('aria-pressed', String(on)); b.title = on ? t('Play animations') : t('Pause animations'); });
    };
    function set(next, by) {   // the steps only add to what rests (light, most), or go back to nothing
      if (next === level) return;
      const faded = level === 'light' || level === 'most';   // (the layer of leaves and snow is out of sight already)
      level = next;
      if (next) root.setAttribute('data-calm', next); else root.removeAttribute('data-calm');
      fadeEnd = (next === 'light' || next === 'most') && !faded ? performance.now() + FADE : 0;
      if (next) { rest(); if (fadeEnd) setTimeout(rest, FADE + 30); } else wake();
      label();
      doc.dispatchEvent(new CustomEvent('wa:calm', { detail: { level: next, by } }));
    }
    btns.forEach((b) => b.addEventListener('click', () => { visitor = true; set(level ? '' : 'all', 'visitor'); }));
    doc.addEventListener('wa:lang', label);
    label();
    W.motion = { get level() { return level; } };

    // The automatic check: is the hero struggling? Three bad 2-s spells in a row move one step (light, then most). A page that was put at "light" by this check
    // (never by the visitor) goes back to full motion once, after four good spells in a row: a slow moment while the page loaded must not freeze the falling leaves for good.
    // But resting the small decorations is often what makes a weak phone fast, so the four good spells do not prove that it can do without: after that one way back the very next look
    // comes at once, and one bad spell is enough to put it back to "light" (a real false alarm, slow only while loading, still stays at full motion).
    // A browser run by a program (the tests, tests/visual-check.mjs) never switches by itself: its speed is that of a busy test computer.
    if (!hero || !('IntersectionObserver' in window) || navigator.webdriver) return;
    let onScreen = false, ready = false, sampling = false, timer = 0, bad = 0, good = 0, recovered = false, quick = 6, longs = [], seen = null;
    try {
      seen = new PerformanceObserver((list) => { if (sampling) longs = longs.concat(list.getEntries()); });
      seen.observe({ type: 'longtask' });
    } catch (e) { seen = null; /* no long-task timing (Safari, Firefox): frames only */ }
    const over = () => visitor || level === 'most' || level === 'all';
    const later = (wait) => { clearTimeout(timer); if (ready && onScreen && !doc.hidden && !over()) timer = setTimeout(sample, wait); };
    function sample() {
      if (sampling || over() || !onScreen || doc.hidden) return;
      sampling = true; longs = [];
      let frames = 0, t0 = 0;
      const step = (now) => {
        if (!t0) t0 = now; else frames++;
        if (now - t0 < 2000 && onScreen && !doc.hidden && !over()) { requestAnimationFrame(step); return; }
        sampling = false;
        const span = now - t0;
        if (span > 1800 && !over()) {   // a whole spell (not cut short by scrolling away or a hidden tab)
          // takeRecords: on a busy phone the observer's own callback can come late; the long tasks of this spell are counted all the same
          if (seen) longs = longs.concat(seen.takeRecords());
          const fps = frames * 1000 / span, busy = longs.filter((e) => e.startTime + e.duration > t0).reduce((sum, e) => sum + e.duration, 0);
          const struggling = fps < 35 && (seen ? busy >= 150 : fps < 25);
          bad = struggling ? bad + 1 : 0;
          good = struggling ? 0 : good + 1;
          if (bad >= (recovered && !level ? 1 : 3)) { bad = 0; good = 0; quick = 4; set(level ? 'most' : 'light', 'auto'); }   // (after the one way back a single bad spell is enough: a phone that needs "light" would otherwise struggle for a minute before it got it again)
          else if (level === 'light' && !visitor && !recovered && good >= 4) { recovered = true; good = 0; quick = 1; set('', 'auto'); }   // only once: a computer that struggles again stays calm; the next look comes at once
        }
        later(quick > 0 ? (quick--, 0) : 15000);
      };
      requestAnimationFrame(step);
    }
    new IntersectionObserver((entries) => { onScreen = entries[entries.length - 1].isIntersecting; if (onScreen) later(500); else clearTimeout(timer); }).observe(hero);
    doc.addEventListener('visibilitychange', () => later(500));
    const start = () => setTimeout(() => { ready = true; later(0); }, 4000);   // well after the page has loaded: loading itself is busy on every phone, and a page in a frame (a preview) is slower still
    if (doc.readyState === 'complete') start(); else addEventListener('load', start);
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
    let live = [], next = null, onNow = [], gapDay = '';
    const markNow = () => {   // also when the farm's day changes while the page is open (a season ends or starts)
      const at = new Date();
      live = S.live(at);
      onNow = S.happening(at);   // the trees are only on the tree days: not on the five days between the two weekends (the "Now" badges still follow live)
      gapDay = live.length && !onNow.length ? S.nextTreeDay(at) : '';
      S.list.forEach((s) => { const b = $('.now-badge', $('#tab-' + s.id)); if (b) b.hidden = !live.some((x) => x.id === s.id); });
      next = S.list.filter((s) => !S.inWindow(s, at)).sort((a, b) => S.daysUntilStart(a, at) - S.daysUntilStart(b, at))[0] || target;
    };
    const target = S.list.find((s) => s.id === S.current(now));
    markNow();
    select(target.id);

    // The hero's season switcher and these tabs stay in step.
    doc.addEventListener('wa:season', (e) => select(e.detail));

    const fact = $('#fact-season');
    const renderFact = () => {
      if (!fact) return;
      fact.textContent = onNow.length
        ? t('{crop} \u2014 happening now', { crop: onNow.map((s) => t(s.crop)).join(' & ') })
        : gapDay ? t('Next up: {crop} ({when})', { crop: t(live[0].crop), when: W.live.dateLabel(gapDay) })
          : t('Next up: {crop} ({when})', { crop: t(next.crop), when: t(next.next) });
    };
    renderFact();
    doc.addEventListener('wa:lang', renderFact);
    doc.addEventListener('wa:day', () => { markNow(); renderFact(); });
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
    const farm = $('#farm');
    const btns = $$('[data-fs]', (farm && farm.parentElement) || doc);
    const notes = $$('[data-fs-note]', root);
    const cols = $$('#farm-glance [data-col]');
    let nowId = '', liveId = '';
    // the "Now" marks and "This season", read again when the farm's day changes (wa:day, js/live.js): a page left open overnight.
    // nowId is the season the site opens on (the one in progress, between seasons the one that starts next); "Now" and "This season" are only for a season
    // that is really in progress (liveId), so on the days before the trees nothing says the winter has started.
    const markNow = () => {
      const day = new Date(), liveIds = S.live(day).map((s) => s.id);
      nowId = S.current(day); liveId = liveIds[0] || '';
      $$('[data-fs]', root).forEach((b) => { const m = $('.fs-now', b.parentElement); if (m) m.hidden = !liveIds.includes(b.dataset.fs); });
      notes.forEach((n) => { if (!n.hidden) $('.fs-this', n).hidden = n.dataset.fsNote !== liveId; });
    };
    markNow();
    doc.addEventListener('wa:day', markNow);
    let shown = null;

    const select = (id, animate) => {
      if (id === shown) return;
      shown = id;
      btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.fs === id)));
      notes.forEach((n) => {
        const on = n.dataset.fsNote === id;
        n.hidden = !on;
        if (on) $('.fs-this', n).hidden = id !== liveId;
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
    doc.addEventListener('wa:day', markNow);
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

    const byHash = Object.create(null);   // no inherited names: index.html#constructor must not find Object's own "constructor"
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
    const draw = () => {
      const today = S.farmDay(new Date()).getDay();   // the farm's weekday (Eastern Time)
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
    doc.addEventListener('wa:day', draw);   // the new day (js/live.js): a page left open overnight
  }

  function initFarmCalendar() {
    const cal = $('.cal');
    if (!cal) return;
    const place = () => {
      if (W.clockOk && !W.clockOk()) { cal.classList.remove('has-today'); return; }   // no readable clock: no "Today" mark
      const now = S.farmDay(new Date());   // the farm's date (Eastern Time)
      const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      cal.style.setProperty('--today', ((now.getMonth() + (now.getDate() - 1) / dim) / 12).toFixed(4));
      cal.classList.add('has-today');
    };
    place();
    doc.addEventListener('wa:day', place);   // a page left open over midnight
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
      sun:    { label: 'a sunflower',     sym: 'sunflower', size: 62 },
      pink:   { label: 'a pink flower',   sym: 'bloom', size: 54, color: '#ff6fa5' },
      white:  { label: 'a white daisy',   sym: 'bloom', size: 54, color: '#ffffff' },
      purple: { label: 'a purple flower', sym: 'bloom', size: 54, color: '#a682ff' },
      orange: { label: 'an orange flower', sym: 'bloom', size: 54, color: '#ff8a3d' },
      blue:   { label: 'a blue flower',   sym: 'bloom', size: 54, color: '#5aa9ff' },
    };
    const NS = 'http://www.w3.org/2000/svg';
    let n = 0;
    // The line under the cup is written again in the new language if the visitor changes language while it is showing.
    let line = null;
    const say = (fn) => { line = fn; msg.textContent = fn(); };
    doc.addEventListener('wa:lang', () => { if (line) msg.textContent = line(); });

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
      say(full
        ? () => t('Your cup is full! Cutting a real bouquet is part of the fun in our flower field.')
        : () => t('Added {flower}. {n} of {total} flowers in your cup.', { flower: t(k.label), n: n, total: SLOTS.length }));
      if (full && buttons.includes(doc.activeElement)) clear.focus({ preventScroll: true });   // the flower button that was just pressed is switched off: keep the keyboard on the one button left to use
      buttons.forEach((b) => { b.disabled = full; });
    }

    buttons.forEach((b) => b.addEventListener('click', () => add(b.dataset.kind)));
    clear.addEventListener('click', () => {
      stems.textContent = ''; heads.textContent = ''; n = 0;
      buttons.forEach((b) => { b.disabled = false; });
      say(() => t('Fresh cup! Tap a flower to add it.'));
    });
  }

  /* ------------------------------------------------------------------ *
   * Goat
   * ------------------------------------------------------------------ */
  function initGoat() {
    const btn = $('#goat-btn'), bubble = $('#goat-bubble');
    if (!btn) return;
    const lines = ['Baa! Welcome to the farm!', 'Have you picked a strawberry yet?', 'Psst… got any snacks?', 'Baa-rilliant day for a visit!', 'Don’t forget your reservation!', 'The kids can feed us. Just ask!'];
    let i = 0, said = -1;
    btn.addEventListener('click', () => {
      said = i++ % lines.length;
      bubble.textContent = t(lines[said]);
      btn.classList.remove('baa'); void btn.offsetWidth; btn.classList.add('baa');
    });
    doc.addEventListener('wa:lang', () => { if (said >= 0) bubble.textContent = t(lines[said]); });   // what the goat said stays, in the new language
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
    const loops = (el) => typeof el.getAnimations === 'function' && el.getAnimations().some((a) => a.effect && a.effect.target === el && a.animationName && a.effect.getTiming().iterations === Infinity);
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
    btn.addEventListener('click', (e) => {
      scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      // The button hides itself once the top is near, and a button that hides takes the keyboard focus with it (focus on nothing, the next Tab starts who knows where).
      // A key press (the click has no mouse or finger: detail 0) puts the focus on the first thing in the page instead.
      if (e.detail === 0) { const first = $('.skip-link') || $('#site-header a, #site-header button'); if (first) { try { first.focus({ preventScroll: true }); } catch (err) { /* gone */ } } }
    });
    doc.addEventListener('wa:lang', () => btn.setAttribute('aria-label', t('Back to top')));
    update();
  }

  /* ------------------------------------------------------------------ */
  // Each part starts on its own: one that fails (an old browser, a browser extension, a bad edit) must not stop the others,
  // or the sections below the first screen stay invisible (.reveal) and the phone menu does not open. The error is still reported.
  [initToTop, initOffscreenPause, initPrint, initGallery, initZoom, initReviews, initNav, initReveal, initBee, initMotion, initSeasons, initFarmSeasons,
    initGroups, initWeekStrips, initVarietyFilter, initFarmCalendar, initBouquet, initGoat, initCrops, initScroll]
    .forEach((init) => {
      try { init(); } catch (e) {
        if (init === initReveal) $$('.reveal, .crop-row, .goat-nook').forEach((el) => el.classList.add('in'));   // never leave the sections invisible
        setTimeout(() => { throw e; });
      }
    });
})();
