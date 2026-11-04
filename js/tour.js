/* Wise Acres: "Take a tour" for Mrs. Cathy and Rob. OWNER-ONLY: real visitors never see it. docs/TOUR.md says how to turn it on and how to add a step.
 *
 * Tour mode is on only when window.WA_TOUR === true (the preview build sets it), or the address has ?tour, or the address ends in #tour.
 * With the mode off this file defines window.WA_TOUR_MODE and stops: it reads nothing, stores nothing, adds nothing to the page and asks for no file.
 * With it on: a "Take a tour" button; when it is pressed a welcome card; then one thing at a time is lit and a small card says what it is.
 *   css/tour.css is loaded at the start of tour mode; the steps (js/tour-steps.js, -b.js, -c.js) the first time the tour is opened.
 * The tour changes nothing for real. It keeps only its own place: sessionStorage['wa-tour'] (this tab: where it is, and the jump to another page)
 * and localStorage['wa-tour'] (the place to continue from another day). Closing it puts the page back (menus, scroll place, the steps' own undo).
 * No IntersectionObserver here on purpose: the claude.ai preview shows the site in a frame where its rootMargin is ignored, so the lit box is
 * placed with plain scroll and measure code (getBoundingClientRect on every frame while a step shows).
 */
(() => {
  'use strict';

  const win = window, doc = document, root = doc.documentElement;

  /* ------------------------------------------------------------------ *
   * 1. The switch. Only the window flag and the page address are read: never storage.
   * ------------------------------------------------------------------ */
  const tourMode = () => {
    try { return win.WA_TOUR === true || /(?:^|[?&])tour(?:[=&]|$)/.test(win.location.search) || win.location.hash === '#tour'; } catch (e) { return false; }
  };
  win.WA_TOUR_MODE = tourMode;
  if (!tourMode()) return;   // the real site: this was all

  const W = (win.WISE_ACRES = win.WISE_ACRES || {});
  if (W.tour) return;        // the script was loaded twice

  const me = doc.currentScript;
  const where = me && me.src ? /^(.*)js\/tour\.js(?:[?#].*)?$/.exec(me.src) : null;
  const BASE = where ? where[1] : '';   // the folder of the site, from this script's own address ('' = the page's own folder)
  const CSS = 'css/tour.css';
  const FILES = ['js/tour-steps.js', 'js/tour-steps-b.js', 'js/tour-steps-c.js'];
  const KEY = 'wa-tour';
  const REVEAL = '.reveal, .crop-row, .goat-nook';   // the boxes that fade in as they come on screen (js/main.js, initReveal)
  const DEMO_PAGES = ['account', 'farm-desk', 'kitchen'];   // the pretend-account pages (their tabs use the address hash)

  const $ = (sel, from = doc) => from.querySelector(sel);
  const $$ = (sel, from = doc) => Array.from(from.querySelectorAll(sel));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const frames = (fn) => requestAnimationFrame(fn);
  const make = (tag, cls, text) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const warn = (what, e) => { try { console.warn('Wise Acres tour: ' + what + ': ' + (e && e.message ? e.message : e)); } catch (x) { /* no console */ } };

  const shown = (e) => {   // on the page, not hidden, not zero-sized
    if (!e || !e.isConnected || !e.getClientRects().length) return false;
    const r = e.getBoundingClientRect();
    if (!(r.width > 0 || r.height > 0)) return false;
    const cs = getComputedStyle(e);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const find = (sel) => {   // the first VISIBLE match of a selector (null when there is none or the selector is bad)
    if (!sel) return null;
    let list;
    try { list = doc.querySelectorAll(sel); } catch (e) { return null; }
    for (let i = 0; i < list.length; i++) if (shown(list[i])) return list[i];
    return null;
  };
  const pageOf = () => { const name = /([^/]*)$/.exec(win.location.pathname)[1].replace(/\.html?$/i, ''); return name === '' ? 'index' : name; };
  // <page>.html next to the page that is showing. No #tour: the account pages use the hash for their tabs. The next page carries on from the tour's own place in
  // browser storage, as soon as tour mode is on there (the preview sets the flag on every page). An address that turned the mode on by itself keeps doing so:
  // the query (?tour, ?demo) goes along, and #tour goes along to a page that does not use the hash.
  const urlOf = (page) => {
    try {
      const u = new URL(page + '.html', win.location.href);
      u.search = win.location.search; u.hash = '';
      if (win.location.hash === '#tour' && DEMO_PAGES.indexOf(page) < 0) u.hash = 'tour';
      return u.href;
    } catch (e) { return page + '.html'; }
  };
  const calm = () => root.hasAttribute('data-calm') || (win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ------------------------------------------------------------------ *
   * 2. Its own place. Written only now that tour mode is on. Falls back to memory when storage is blocked.
   * ------------------------------------------------------------------ */
  const mem = {};
  const kv = {
    get(kind) { try { const raw = win[kind].getItem(KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return mem[kind] || null; } },
    set(kind, v) { mem[kind] = v; try { win[kind].setItem(KEY, JSON.stringify(v)); } catch (e) { /* blocked: the copy in memory is used */ } },
    del(kind) { mem[kind] = null; try { win[kind].removeItem(KEY); } catch (e) { /* blocked */ } },
  };
  const chOf = (s) => (s.chapter == null ? 0 : s.chapter);
  // run: 1 while the tour is open on this tab; go: the moment the tour left for another page (the next page carries on only if it is fresh)
  const remember = (run, s, go) => {
    if (!s) return;
    kv.set('localStorage', { id: s.id, ch: chOf(s) });
    kv.set('sessionStorage', { run: run ? 1 : 0, id: s.id, ch: chOf(s), go: go || 0 });
  };
  const forget = () => { kv.del('sessionStorage'); kv.del('localStorage'); };

  /* ------------------------------------------------------------------ *
   * 3. The files: the stylesheet at the start, the steps the first time the tour opens.
   * ------------------------------------------------------------------ */
  const inline = () => win.WA_TOUR_INLINE === true;   // the preview build put the css and the steps in the page itself
  let cssReady = null, stepsReady = null;
  let steps = [], chapters = [], chapterOf = Object.create(null);

  const loadCss = () => cssReady || (cssReady = new Promise((resolve) => {
    if (inline() || $('link[href*="tour.css"], style[data-tour-css]')) { resolve(true); return; }
    const link = make('link');
    let done = false;
    const end = (ok) => { if (!done) { done = true; resolve(ok); } };
    link.rel = 'stylesheet'; link.href = BASE + CSS;
    link.onload = () => end(true); link.onerror = () => end(false);
    setTimeout(() => end(!!link.sheet), 8000);
    (doc.head || root).appendChild(link);
  }));

  const addScript = (file) => new Promise((resolve) => {   // a file that is missing is fine: it counts as loaded
    const s = make('script');
    let done = false;
    const end = () => { if (!done) { done = true; resolve(); } };
    s.src = BASE + file; s.async = false; s.onload = end; s.onerror = end;   // not async: the files are fetched together but run in the order they are asked for, so when two files use one id the earlier file's step is the one that shows
    setTimeout(end, 12000);
    (doc.head || root).appendChild(s);
  });

  // The pretend account pages exist only in demo mode (js/demo-header.js, WA_DEMO_MODE). Without it their steps are left out altogether: no jump to a page that
  // shows only "this is a demo page", no waiting for targets that cannot be there, and no gap in the step numbers.
  const demoOn = () => { try { return typeof win.WA_DEMO_MODE === 'function' ? !!win.WA_DEMO_MODE() : win.WA_DEMO === true; } catch (e) { return false; } };

  const build = () => {   // every file pushed its steps into window.WA_TOUR_STEPS: sort by order, drop a repeated id, group by chapter
    const raw = Array.isArray(win.WA_TOUR_STEPS) ? win.WA_TOUR_STEPS : [];
    const seen = Object.create(null), list = [], demo = demoOn();
    raw.forEach((s, k) => { if (s && typeof s === 'object' && s.id != null && !seen[s.id] && (demo || DEMO_PAGES.indexOf(s.page) < 0)) { seen[s.id] = 1; list.push({ s, k }); } });
    const ord = (x) => { const n = Number(x.s.order); return isNaN(n) ? Infinity : n; };
    list.sort((a, b) => { const p = ord(a), q = ord(b); return p !== q ? (p < q ? -1 : 1) : a.k - b.k; });
    steps = list.map((x) => x.s);
    const titles = Object.create(null);
    (Array.isArray(win.WA_TOUR_CHAPTERS) ? win.WA_TOUR_CHAPTERS : []).forEach((c) => { if (c && c.n != null) titles[c.n] = c.title; });
    chapters = []; chapterOf = Object.create(null);
    steps.forEach((s, i) => {   // the parts of the tour, in order, each with its first step and the number of steps
      const key = String(chOf(s));
      let c = chapterOf[key];
      if (!c) {
        const own = typeof chOf(s) === 'string' && isNaN(Number(chOf(s))) ? chOf(s) : 'Part ' + chOf(s);
        c = chapterOf[key] = { key, title: titles[chOf(s)] || own, first: i, count: 0 };
        chapters.push(c);
      }
      c.count++;
    });
  };
  const loadSteps = () => stepsReady || (stepsReady = (inline() ? Promise.resolve() : Promise.all(FILES.map(addScript))).then(build));

  /* ------------------------------------------------------------------ *
   * 4. The hooks of a step: before(ctx) when it is about to show, after(ctx) when it is left. Slow or broken ones never stop the tour.
   * ------------------------------------------------------------------ */
  let undos = [];
  const waitFor = (what, ms) => new Promise((resolve) => {   // resolves the element (or the function's answer), or null after ms; never rejects
    const t0 = Date.now(), limit = ms == null ? 3000 : ms;
    const look = () => {
      let v = null;
      try { v = typeof what === 'function' ? what() : find(what); } catch (e) { v = null; }
      if (v) resolve(v); else if (Date.now() - t0 >= limit) resolve(null); else setTimeout(look, 50);
    };
    look();
  });
  const makeCtx = (s) => ({
    step: s, page: pageOf(),
    $: (sel) => $(sel), $$: (sel) => $$(sel),
    wait, waitFor,
    undo: (fn) => { if (typeof fn === 'function') undos.push(fn); },
  });
  const run = (fn, s, ms) => {
    if (typeof fn !== 'function') return Promise.resolve();
    let p;
    try { p = Promise.resolve(fn(makeCtx(s))); } catch (e) { warn('step ' + s.id, e); return Promise.resolve(); }
    return Promise.race([p.catch((e) => warn('step ' + s.id, e)), wait(ms)]);
  };

  /* ------------------------------------------------------------------ *
   * 5. The pieces of the tour on screen: a dimmer with a hole, the card, a polite live region.
   * ------------------------------------------------------------------ */
  let ui = null, closing = false;
  let idx = -1, curStep = null, curEl = null, curRad = 14, entered = null, seq = 0, arrivedFor = null;
  let view = 'none', backView = 'welcome';
  let opener = null, savedScroll = null, wasOpen = [];
  let frame = 0, placed = '', glide = 0, cardAt = null, styled = true, clip = '';   // clip: the window cut out of the shield, as last written

  const pill = make('button', 'btn btn-sun btn-sm wa-tour-pill', 'Take a tour');
  pill.type = 'button'; pill.id = 'wa-tour-pill'; pill.hidden = true; pill.lang = 'en';
  pill.setAttribute('aria-haspopup', 'dialog');

  const sheet = () => (root.clientWidth || win.innerWidth) <= 640;   // a phone: the card is a sheet at the bottom
  const headerH = () => {   // the sticky top bar; on the pretend-account pages (a computer) the thin demo bar sticks under it, and the lit box must not hide behind that either
    const h = $('.site-header'), d = $('.demo-bar');
    let n = h ? h.getBoundingClientRect().height : 0;
    if (d) { const cs = getComputedStyle(d), top = parseFloat(cs.top); if (cs.position === 'sticky') n = (isNaN(top) ? n : top) + d.getBoundingClientRect().height; }
    return n;
  };
  const jump = (y) => {   // an instant scroll, whatever smooth scrolling the page asks for
    const before = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    win.scrollTo(0, y);
    root.style.scrollBehavior = before;
  };
  const snapReveal = (el) => {   // a box that fades in as it comes on screen is shown at once, so what is measured is where it stays
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      if (n.matches(REVEAL) && !n.classList.contains('in')) {
        const own = n.style.transition;
        n.style.transition = 'none'; n.classList.add('in'); void n.offsetWidth;
        setTimeout(() => { n.style.transition = own; }, 80);
      }
    }
  };
  const pinned = (el) => {   // in the sticky top bar (or fixed): scrolling does not bring it anywhere
    for (let n = el; n && n !== doc.body && n !== root; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.position === 'fixed') return true;
      if (cs.position === 'sticky') { const t = parseFloat(cs.top); if (!isNaN(t) && Math.abs(n.getBoundingClientRect().top - t) < 2) return true; }
    }
    return false;
  };
  const still = (el) => new Promise((resolve) => {   // resolves when the box has stopped moving for 3 frames (or after 0.9 s)
    let last = '', same = 0;
    const t0 = Date.now();
    const look = () => {
      const b = el.getBoundingClientRect(), k = [b.left, b.top, b.width, b.height].map((v) => Math.round(v * 2)).join();
      same = k === last ? same + 1 : 0; last = k;
      if (same >= 3 || Date.now() - t0 > 700 || !el.isConnected) resolve(); else frames(look);
    };
    frames(look);
    setTimeout(resolve, 900);   // a hidden tab draws no frames
  });
  const inScroller = (el) => {   // inside a box that scrolls by itself (a wide table): that box is scrolled first
    for (let n = el.parentElement; n && n !== doc.body && n !== root; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (/auto|scroll/.test(cs.overflowY + cs.overflowX) && (n.scrollHeight > n.clientHeight + 1 || n.scrollWidth > n.clientWidth + 1)) return true;
    }
    return false;
  };
  const bring = async (el, keep) => {   // bring the box to a comfortable place under the sticky bar (and above the sheet on a phone), then wait until it stops moving; keep: after a press on a small button, a box taller than the room stays where it is while part of it shows (the step's run() may have scrolled to what matters)
    snapReveal(el);
    if (pinned(el)) return;
    if (inScroller(el)) { try { el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' }); } catch (e) { /* an old browser */ } }
    const r = el.getBoundingClientRect(), vh = win.innerHeight;
    const top = headerH() + 14, bottom = vh - 14 - (sheet() && ui ? ui.card.offsetHeight + 8 : 0);
    let dy = 0;
    if (r.height <= bottom - top) { if (r.top < top || r.bottom > bottom) dy = r.top - (top + (bottom - top - r.height) / 2); }
    else if (!(keep && r.top < bottom && r.bottom > top)) dy = r.top - top;   // taller than the free room: its top just under the bar
    if (Math.abs(dy) >= 1) jump(win.scrollY + dy);
    await still(el);
  };

  const fill = (el, text) => {   // plain text: "\n" is a line break, a line starting with "- " is a bullet
    el.textContent = '';
    let ul = null, para = [];
    const flush = () => { if (para.length) { el.appendChild(make('p', '', para.join('\n'))); para = []; } };
    String(text == null ? '' : text).split('\n').forEach((line) => {
      const m = /^\s*(?:-|•)\s+(.*)$/.exec(line);
      if (m) { flush(); if (!ul) { ul = make('ul'); el.appendChild(ul); } ul.appendChild(make('li', '', m[1])); }
      else { ul = null; if (line.trim() === '') flush(); else para.push(line); }
    });
    flush();
  };

  const buildUi = () => {
    const box = make('div', 'wa-tour'), shield = make('div', 'wa-tour-shield'), hole = make('div', 'wa-tour-hole');
    const card = make('section', 'wa-tour-card');
    box.id = 'wa-tour'; box.lang = 'en';
    card.id = 'wa-tour-card'; card.tabIndex = -1;
    card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-labelledby', 'wa-tour-title');
    const progress = make('p', 'wa-tour-progress'), bar = make('div', 'wa-tour-bar'), fillBar = make('i');
    const title = make('h2', 'wa-tour-title'), body = make('div', 'wa-tour-body'), actions = make('div', 'wa-tour-actions');
    const choices = make('div', 'wa-tour-choices');   // a step's own row of small buttons (step.choices), between the text and Back / Next
    const x = make('button', 'wa-tour-x', '×');
    title.id = 'wa-tour-title'; bar.setAttribute('aria-hidden', 'true'); bar.appendChild(fillBar);
    choices.setAttribute('role', 'group'); choices.hidden = true;
    x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.addEventListener('click', () => endTour(false));
    card.append(progress, bar, title, body, choices, actions, x);
    const live = make('div', 'sr-only');
    live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite'); live.setAttribute('aria-atomic', 'true');
    box.append(shield, hole, card, live);
    // a press inside the tour never reaches the page: its own "click anywhere else closes me" rules (the menus) must not fire for the tour's buttons
    ['click', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart'].forEach((ev) => box.addEventListener(ev, (e) => e.stopPropagation()));
    doc.body.appendChild(box);
    return { box, shield, hole, card, progress, bar: fillBar, title, body, choices, actions, x, live, primary: null };
  };

  const say = (text) => { const live = ui && ui.live; if (!live) return; live.textContent = ''; setTimeout(() => { if (ui && ui.live === live) live.textContent = text; }, 60); };
  const button = (label, handler, kind) => {
    const b = make('button', 'btn btn-sm btn-' + (kind || 'white'), label);
    b.type = 'button';
    if (handler) b.addEventListener('click', handler); else b.disabled = true;
    return b;
  };
  // A step's own row of small buttons (step.choices, docs/TOUR.md): a few words above them, one button each, the chosen one pressed. Pressing one runs its
  // run(ctx) (a Promise is waited for), then the card shows that choice's title and text and the lit box is measured again (the page part may have changed size).
  // The tour keeps no other record of it: whatever run() changed on the page is put back by the step's after() (or ctx.undo), like everything else a step does.
  let defs = null, chosen = -1, choosing = null;   // the choices of the step that shows, the pressed one (-1: none), and the press still being carried out
  const drawChoices = (list, label, on) => {
    const row = ui.choices;
    row.textContent = '';
    row.hidden = !(list && list.length);
    if (row.hidden) { row.removeAttribute('aria-label'); row.removeAttribute('aria-busy'); return; }
    row.setAttribute('aria-label', label || 'Choose');
    row.setAttribute('aria-busy', 'false');
    if (label) row.appendChild(make('p', 'wa-tour-choices-label', label));
    const line = make('div', 'wa-tour-choices-row');
    list.forEach((d, i) => {
      const b = make('button', 'btn btn-sm btn-white wa-tour-choice', d.label);
      b.type = 'button'; b.setAttribute('aria-pressed', i === on ? 'true' : 'false');
      b.addEventListener('click', () => choose(i));
      line.appendChild(b);
    });
    row.appendChild(line);
  };
  const choicesOf = (s) => {   // step.choices is a list, or a function that gives the list when the card shows (so it can look at the page a before() has just set up)
    let list = s.choices;
    if (typeof list === 'function') { try { list = list(makeCtx(s)); } catch (e) { warn('step ' + s.id, e); list = null; } }
    list = Array.isArray(list) ? list.filter((d) => d && typeof d === 'object' && typeof d.label === 'string' && d.label !== '') : [];
    return list.length ? list : null;
  };
  const choose = (i) => {
    const s = curStep, d = defs && defs[i];
    if (!ui || view !== 'step' || !s || !d || choosing || i === chosen || ui.card.classList.contains('is-busy')) return;   // busy: the tour is moving to another step
    const mine = seq;
    chosen = i;
    $$('.wa-tour-choice', ui.choices).forEach((b, k) => b.setAttribute('aria-pressed', k === i ? 'true' : 'false'));
    ui.choices.setAttribute('aria-busy', 'true');
    const same = () => mine === seq && !!ui && curStep === s && view === 'step';   // false once the owner has gone to another step, opened Contents or closed the tour meanwhile
    choosing = run(d.run, s, 8000).then(async () => {
      try {
        if (ui) ui.choices.setAttribute('aria-busy', 'false');
        if (!same()) return;
        const title = d.title || s.title || '', text = d.text != null ? d.text : s.text;
        ui.title.textContent = title; fill(ui.body, text); ui.body.scrollTop = 0;
        const el = s.target ? find(s.target) : null;   // the part may have been drawn again, or be gone in this choice (then the page is dimmed all over)
        curEl = el;
        if (el) await bring(el, true);
        if (!same()) return;
        placed = ''; place(true);
        say(title + '. ' + String(text || '').replace(/\n+/g, ' '));
      } finally { choosing = null; }
    });
  };

  // what the card shows: a line above the title, the title, the text, and a row of buttons ([label, handler, kind]; the last one marked "primary" gets the focus)
  const setCard = (o) => {
    const old = $('.wa-tour-flash', ui.card); if (old) old.remove();
    ui.progress.textContent = o.kicker || ''; ui.progress.hidden = !o.kicker;
    if (o.sub) ui.progress.appendChild(make('span', 'wa-tour-chapter', ' ' + o.sub));
    ui.bar.parentNode.hidden = o.pct == null;
    if (o.pct != null) ui.bar.style.width = Math.round(o.pct * 100) + '%';
    ui.title.textContent = o.title || '';
    fill(ui.body, o.text);
    if (o.list) ui.body.appendChild(o.list);
    drawChoices(o.choices, o.choicesLabel, o.chosen);
    ui.actions.textContent = '';
    ui.primary = null;
    (o.buttons || []).forEach((def) => {
      if (!def) return;
      const b = button(def[0], def[1], def[2]);
      ui.actions.appendChild(b);
      if (def[3]) ui.primary = b;
    });
    ui.card.setAttribute('aria-modal', o.free || o.tryIt ? 'false' : 'true');
    ui.box.classList.toggle('is-free', !!o.free);   // a "Try it" step: the whole page may be used
    ui.box.classList.toggle('is-try', !!o.tryIt);    // any other step with a lit box: the lit part may be used, and nothing else (see place)
    ui.box.classList.toggle('is-still', calm());
    ui.card.classList.toggle('is-busy', false);
    ui.body.scrollTop = 0;
  };

  // What the card should not sit on when it has to sit on the lit box: its buttons, links, fields, switches and headings, and what an open button of it shows (a list, a panel)
  const KEEP_CLEAR = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, label, [role="button"], [role="switch"], [role="tab"], [role="checkbox"], [role="radio"], h1, h2, h3, h4, h5, h6';
  const keepClear = () => {
    const out = [];
    if (!curEl || !curEl.isConnected) return out;
    const add = (n) => { if (out.length < 400 && shown(n)) { const b = n.getBoundingClientRect(); if (b.width >= 8 && b.height >= 8) out.push(b); } };
    $$(KEEP_CLEAR, curEl).forEach(add);
    if (curEl.matches(KEEP_CLEAR)) add(curEl);
    $$('[aria-controls][aria-expanded="true"]', curEl).forEach((c) => { const p = doc.getElementById(c.getAttribute('aria-controls')); if (p) add(p); });
    return out;
  };

  /* The lit box and the card follow the target while a step shows: one measure per frame, a style change only when something moved. */
  const place = (force) => {
    if (!ui) return;
    const { box, hole, card, shield } = ui;
    if (view === 'step' && curStep && curStep.target && (!curEl || !curEl.isConnected)) { const again = find(curStep.target); if (again) { curEl = again; curRad = 14; } }   // a re-drawn page part: found again
    let r = null;
    if (curEl && curEl.isConnected) { const b = curEl.getBoundingClientRect(); if (b.width > 0 || b.height > 0) r = b; }
    box.classList.toggle('no-hole', !r);
    // A step with a lit box lets the visitor use what is lit (open a question, choose a tab) and nothing else: the shield that stops clicks has a window cut out of it
    // where the lit part of the page is (the part's own box, not the glow around it). It is cut again whenever the part moves or grows (an opened answer).
    let cut = '';
    if (r && box.classList.contains('is-try')) {
      const x1 = Math.round(r.left), y1 = Math.round(r.top), x2 = Math.round(r.right), y2 = Math.round(r.bottom);
      cut = 'polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ' + x1 + 'px ' + y1 + 'px, ' + x1 + 'px ' + y2 + 'px, ' + x2 + 'px ' + y2 + 'px, ' + x2 + 'px ' + y1 + 'px, ' + x1 + 'px ' + y1 + 'px)';
    }
    if (cut !== clip) { clip = cut; shield.style.clipPath = cut; }
    const vw = root.clientWidth || win.innerWidth, vh = win.innerHeight, phone = vw <= 640;
    const hl = r ? r.left - 8 : 0, ht = r ? r.top - 8 : 0, hw = r ? r.width + 16 : 0, hh = r ? r.height + 16 : 0;
    const dbox = $('.demo-modal-box'), dr = dbox && shown(dbox) ? dbox.getBoundingClientRect() : null;   // a dialog of the page is open (the pretend account's): the card keeps off its box
    const dk = dr ? [dr.left, dr.top, dr.width, dr.height].map(Math.round).join() : '';
    const key = [hl, ht, hw, hh, vw, vh, card.offsetWidth, card.offsetHeight].map(Math.round).join() + '|' + dk;
    if (!force && key === placed) return;
    placed = key;
    if (r) {
      hole.style.left = hl + 'px'; hole.style.top = ht + 'px'; hole.style.width = hw + 'px'; hole.style.height = hh + 'px'; hole.style.borderRadius = curRad + 'px';
    }
    card.classList.toggle('is-sheet', phone);
    if (phone) { card.style.left = card.style.top = card.style.width = ''; cardAt = null; return; }
    // the card on a computer: beside the box (the side with more room first), then below, then above, then a corner; never over the box when it can be helped
    const w = card.offsetWidth, h = card.offsetHeight, M = 14, G = 18;
    const at = cardAt;
    if (!force && r && at && Math.abs(at[0] - hl) < 30 && Math.abs(at[1] - ht) < 30 && Math.abs(at[2] - hw) < 30 && Math.abs(at[3] - hh) < 30 && at[4] === w && at[5] === h && at[6] === vw && at[7] === vh && at[8] === dk) return;   // it drifted a little: the card stays where it is
    cardAt = [hl, ht, hw, hh, w, h, vw, vh, dk];
    let x, y;
    if (!r) { x = (vw - w) / 2; y = Math.max(M, (vh - h) / 2); }
    else {
      const midY = clamp(ht + hh / 2 - h / 2, M, Math.max(M, vh - h - M)), midX = clamp(hl + hw / 2 - w / 2, M, Math.max(M, vw - w - M));
      const right = [hl + hw + G, midY], left = [hl - G - w, midY], below = [midX, ht + hh + G], above = [midX, ht - G - h];
      const opts = (hl + hw / 2 < vw / 2 ? [right, left, below, above] : [left, right, below, above]).concat([[vw - w - M, vh - h - M], [M, vh - h - M], [vw - w - M, M], [M, M]]);
      let best = null, bestScore = Infinity;
      const keep = keepClear();
      opts.forEach((o) => {
        const out = Math.max(0, M - o[0]) + Math.max(0, o[0] + w - (vw - M)) + Math.max(0, M - o[1]) + Math.max(0, o[1] + h - (vh - M));
        const ox = Math.max(0, Math.min(o[0] + w, hl + hw) - Math.max(o[0], hl)), oy = Math.max(0, Math.min(o[1] + h, ht + hh) - Math.max(o[1], ht));
        let hit = 0;   // how much of the buttons, fields, switches and headings of the lit box this place would cover
        keep.forEach((b) => { hit += Math.max(0, Math.min(o[0] + w, b.right) - Math.max(o[0], b.left)) * Math.max(0, Math.min(o[1] + h, b.bottom) - Math.max(o[1], b.top)); });
        const under = dr ? Math.max(0, Math.min(o[0] + w, dr.right) - Math.max(o[0], dr.left)) * Math.max(0, Math.min(o[1] + h, dr.bottom) - Math.max(o[1], dr.top)) : 0;   // how much of the dialog's box
        const score = out * 1000 + ox * oy + hit * 5 + under * 8;
        if (score < bestScore) { best = o; bestScore = score; }
      });
      x = best[0]; y = best[1];
    }
    card.style.width = ''; card.style.left = Math.round(x) + 'px'; card.style.top = Math.round(y) + 'px';
  };
  const track = () => { frame = 0; if (!ui) return; place(false); frame = frames(track); };
  const startTracking = () => { if (!frame && ui) frame = frames(track); };
  const stopTracking = () => { if (frame) cancelAnimationFrame(frame); frame = 0; };
  const gliding = () => {   // the lit box and the card slide from one step to the next (not in calm mode or with reduced motion)
    if (!ui || calm()) return;
    ui.box.classList.add('is-gliding');
    clearTimeout(glide);
    glide = setTimeout(() => { if (ui) ui.box.classList.remove('is-gliding'); }, 420);
  };

  /* ------------------------------------------------------------------ *
   * 6. Moving through the steps.
   * ------------------------------------------------------------------ */
  const setBusy = (on) => { if (ui) { ui.card.classList.toggle('is-busy', on); ui.card.setAttribute('aria-busy', on ? 'true' : 'false'); } };
  const focusCard = () => {   // focus goes to the main button; a page element that was focused is let go first, with no new owner, so a menu that closes
    const a = doc.activeElement;                // when focus moves to another element (the phone menu focuses its first link) stays open
    if (a && a !== doc.body && ui && !ui.box.contains(a)) { try { a.blur(); } catch (e) { /* gone */ } }
    const to = (ui && (ui.primary || ui.x)) || null;
    if (to) { try { to.focus({ preventScroll: true }); } catch (e) { to.focus(); } }
  };
  const openStatus = () => {   // a small picture of the page's menus, to put back at the end
    wasOpen = $$('[aria-expanded="true"][aria-controls]');
  };
  const closeOpened = () => {   // a menu a step left open is closed again
    $$('[aria-expanded="true"][aria-controls]').forEach((b) => { if (wasOpen.indexOf(b) < 0 && !(ui && ui.box.contains(b))) { try { b.click(); } catch (e) { /* gone */ } } });
  };

  const present = async (n, s, el, mine, keep) => {   // the step is ready: show its card, bring the box into place, start following it (keep: the same step again, after Contents)
    if (!(keep && curStep === s && defs)) { defs = choicesOf(s); chosen = defs ? defs.findIndex((d) => d.pressed === true) : -1; }   // a step shown anew starts with no choice pressed (unless a choice says pressed: true, because before() has already done it); one shown again keeps the choice the page is still showing
    const pick = defs && chosen >= 0 ? defs[chosen] : null;
    const title = pick && pick.title ? pick.title : s.title, text = pick && pick.text != null ? pick.text : s.text;
    idx = n; curStep = s; curEl = el; curRad = 14;
    if (el) { const c = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0; curRad = clamp(c + 8, 14, 32); }
    remember(true, s, 0);
    const last = n === steps.length - 1, ch = chapterOf[String(chOf(s))];
    view = 'step';
    setCard({
      kicker: 'Step ' + (n + 1) + ' of ' + steps.length + ' - ' + (ch ? ch.title : ''), sub: ch ? 'Chapter ' + (chapters.indexOf(ch) + 1) + ' of ' + chapters.length : '', pct: (n + 1) / steps.length,
      title, text, choices: defs, choicesLabel: s.choicesLabel, chosen, free: s.allowClicks === true, tryIt: s.allowClicks !== true && s.allowClicks !== false && !!el,
      buttons: [['Back', n > 0 ? back : null, 'white'], ['Contents', () => openContents('step'), 'white'], last ? ['Start again', again, 'sun'] : null, last ? ['Finish', () => endTour(true), 'green', true] : ['Next', next, 'red', true]],
    });
    gliding();
    if (el) { await bring(el); if (mine !== seq || !ui) return; }
    placed = '';
    place(true);
    startTracking();
    setBusy(false);
    focusCard();
    say('Step ' + (n + 1) + ' of ' + steps.length + (ch ? '. ' + ch.title : '') + '. ' + (title || '') + '. ' + String(text || '').replace(/\n+/g, ' '));
    doc.dispatchEvent(new CustomEvent('wa:tour', { detail: { type: 'step', id: s.id, index: n } }));
  };

  const move = async (i, dir) => {   // show step i; steps that must be skipped are passed in the direction dir; a newer move cancels an older one
    if (!ui) return;
    const mine = ++seq, step = dir || 1;
    setBusy(true);
    const leaving = entered; entered = null;
    if (choosing) await choosing;   // a choice still being carried out finishes first, so that after() puts back everything it did
    if (leaving) await run(leaving.after, leaving, 3000);
    if (mine !== seq || !ui) return;
    for (let n = i; n >= 0 && n < steps.length; n += step) {
      const s = steps[n];
      if (s.page && s.page !== pageOf() && arrivedFor !== s.id) {   // a step on another page: go there; the tour carries on when that page has loaded
        stopTracking();
        remember(true, s, Date.now());
        say('Going to the next page.');
        win.location.assign(urlOf(s.page));
        setTimeout(() => { if (mine === seq && ui) { setBusy(false); setCard({ title: 'The next page did not open', text: 'Please try again, or use Close and open the page yourself.', buttons: [['Close', () => endTour(false), 'red', true]] }); view = 'note'; focusCard(); } }, 7000);
        return;
      }
      if (arrivedFor === s.id) arrivedFor = null;
      entered = s;
      await run(s.before, s, 8000);
      if (mine !== seq || !ui) return;
      let el = null;
      if (s.target) { el = find(s.target) || (await waitFor(s.target, 500)); if (mine !== seq || !ui) return; }
      if (!el && s.skipIfMissing) { entered = null; await run(s.after, s, 3000); if (mine !== seq || !ui) return; continue; }
      await present(n, s, el, mine);
      return;
    }
    if (step > 0) endTour(true);   // the steps after this one all skipped themselves: the tour is over
    else if (steps[idx]) goTo(idx, 1);   // nothing before this one: stay
  };
  const goTo = (i, dir) => move(i, dir).catch((e) => { warn('moving to a step', e); setBusy(false); });
  const next = () => goTo(idx + 1, 1);
  const back = () => goTo(idx - 1, -1);
  const again = () => { forget(); goTo(0, 1); };

  const savedIndex = () => {   // where to continue from: this tab's place first, then the one from another day
    const s = kv.get('sessionStorage') || kv.get('localStorage');
    if (!s || s.id == null) return -1;
    for (let i = 0; i < steps.length; i++) if (steps[i].id === s.id) return i;
    for (let j = 0; j < steps.length; j++) if (String(chOf(steps[j])) === String(s.ch)) return j;
    return -1;
  };

  /* ------------------------------------------------------------------ *
   * 7. The cards that are not steps: the welcome, the contents, a note.
   * ------------------------------------------------------------------ */
  const minutes = () => Math.max(5, Math.round(steps.reduce((n, s) => n + (s.choices ? 3 : 1), 0) * 15 / 300) * 5);   // about 15 seconds a step (a step with small buttons counts as three: there is more to look at), to the nearest 5 minutes
  const showWelcome = () => {
    view = 'welcome';
    const ready = steps.length > 0, at = ready ? savedIndex() : -1;
    stopTracking(); curStep = null; curEl = null;
    setCard({
      title: 'Your website tour',
      text: 'This is a tour of your new website. It takes about ' + minutes() + ' minutes. You can stop any time and do the rest later: come back and press "Continue where I stopped". Use Next and Back. Contents lets you jump to any part. Whatever is lit up on the page, you can click and try.' +
        (at > 0 ? '\n\nYou stopped at step ' + (at + 1) + ' of ' + steps.length + '.' : ''),
      buttons: [
        at > 0 ? ['Continue where I stopped', () => goTo(at, 1), 'red', true] : null,
        ['Start the tour', ready ? () => goTo(0, 1) : null, at > 0 ? 'white' : 'red', at <= 0],
        ['Choose a part', ready ? () => openContents('welcome') : null, 'white'],
        ['Not now', () => endTour(false), 'ghost'],
      ],
    });
    placed = ''; place(true); setBusy(!ready);
    focusCard();
    say('Your website tour. This is a tour of your new website. It takes about ' + minutes() + ' minutes.' + (at > 0 ? ' You stopped at step ' + (at + 1) + '.' : ''));
  };
  const showNote = (title, text) => {
    view = 'note'; stopTracking(); curStep = null; curEl = null;
    setCard({ title, text, buttons: [['Close', () => endTour(false), 'red', true]] });
    placed = ''; place(true); setBusy(false); focusCard(); say(title + '. ' + text);
  };
  function openContents(from) {
    if (!ui || !steps.length) return;
    backView = from || 'welcome';
    view = 'contents'; curEl = null;   // no lit box behind the list: the card goes to the middle and the page is dimmed all over
    const list = make('ul', 'wa-tour-chapters'), at = curStep ? idx : savedIndex();
    const here = at >= 0 && steps[at] ? String(chOf(steps[at])) : '';   // the part you are in (or stopped in)
    chapters.forEach((c, i) => {
      const li = make('li'), b = make('button', 'wa-tour-chap' + (c.key === here ? ' is-here' : ''));
      b.type = 'button';
      b.appendChild(make('span', 'wa-tour-chap-name', (i + 1) + '. ' + c.title));
      b.appendChild(doc.createTextNode(' '));
      b.appendChild(make('span', 'wa-tour-chap-count', c.count + (c.count === 1 ? ' step' : ' steps')));
      if (c.key === here) b.setAttribute('aria-current', 'step');
      b.addEventListener('click', () => goTo(c.first, 1));
      li.appendChild(b); list.appendChild(li);
    });
    setCard({
      kicker: 'Contents', title: 'Choose a part', list,
      text: at >= 0 && steps[at] ? 'You are at step ' + (at + 1) + ' of ' + steps.length + '. Choose a part to go there.' : 'Choose a part to start there.',
      buttons: [['Back', () => { if (backView === 'step' && curStep) renderBackToStep(); else showWelcome(); }, 'white', true]],
    });
    placed = ''; place(true);
    focusCard();
    say('Contents. Choose a part of the tour.');
  }
  const renderBackToStep = () => { present(idx, curStep, find(curStep.target), seq, true); };

  /* ------------------------------------------------------------------ *
   * 8. Open, close, and the keys.
   * ------------------------------------------------------------------ */
  const inTour = (n) => !!(ui && n && ui.box.contains(n));
  const pageDialog = () => $$('.demo-modal, dialog[open]').some((d) => !inTour(d) && shown(d));   // a dialog of the page (the pretend account's .demo-modal, the photo viewer) is open
  const openNow = () => $$('[aria-expanded="true"]').some((b) => !inTour(b));   // a menu or list of the page is open: it keeps its own Esc
  const reachable = () => {   // what Tab can reach: the card's buttons, and (when the page may be used) what is inside the lit box
    const mine = $$('button:not([disabled])', ui.card).filter((b) => !b.hidden);
    if (!(view === 'step' && curStep && curStep.allowClicks !== false && curEl)) return mine;
    const sel = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
    let more = $$(sel, curEl);
    if (curEl.matches(sel)) more.unshift(curEl);
    $$('[aria-controls][aria-expanded="true"]', curEl).forEach((c) => { const t = doc.getElementById(c.getAttribute('aria-controls')); if (t) more = more.concat($$(sel, t)); });
    return mine.concat(more.filter(shown));
  };
  const onKey = (e) => {   // heard at the window, before the page's own handlers (a menu that takes Esc for itself)
    if (!ui) return;
    const t = e.target, free = inTour(t) || t === doc.body || t === root || !t;
    if (e.key === 'Tab') {
      const list = reachable();
      if (!list.length) return;
      const at = list.indexOf(doc.activeElement);
      if (at < 0 && !free) return;   // some other part of the page: let the browser go on
      e.preventDefault(); e.stopPropagation();
      list[at < 0 ? (e.shiftKey ? list.length - 1 : 0) : (at + (e.shiftKey ? -1 : 1) + list.length) % list.length].focus();
      return;
    }
    if (e.key === 'Escape' && !e.altKey && !e.ctrlKey && !e.metaKey) {
      if (pageDialog()) return;   // an open dialog of the page takes Esc for itself (it closes; the tour stays)
      if (!free) {   // the focus is on a part of the page (a question of the lit part): one Esc brings it back to the card, the next one closes the tour. An open menu keeps its own Esc
        if (view === 'step' && !openNow()) { e.preventDefault(); e.stopPropagation(); focusCard(); }
        return;
      }
    }
    if (e.altKey || e.ctrlKey || e.metaKey || !free) return;   // a key meant for a part of the page that has the focus
    if (e.key === 'Escape') {
      if (view === 'contents') { if (backView === 'step' && curStep) renderBackToStep(); else showWelcome(); } else endTour(false);
    } else if (view === 'step' && (e.key === 'ArrowRight' || (e.key === 'Enter' && (t === ui.card || t === doc.body || t === root)))) {
      if (idx < steps.length - 1) next();
    } else if (view === 'step' && e.key === 'ArrowLeft') {
      if (idx > 0) back();
    } else return;
    e.preventDefault(); e.stopPropagation();
  };
  const onResize = () => { if (ui) { placed = ''; place(true); } };

  // While the tour is open, a link that would take the visitor away from this page (to another page, another website, an e-mail or a phone call) does nothing
  // but say so; a place on this same page (#...) still scrolls. A form that would send something to another website is stopped the same way.
  let flashTimer = 0;
  const flash = (text) => {   // a short note in the card, gone after a few seconds (or at the next step)
    if (!ui) return;
    let n = $('.wa-tour-flash', ui.card);
    if (!n) { n = make('p', 'wa-tour-flash'); n.setAttribute('role', 'status'); ui.card.insertBefore(n, ui.actions); }
    n.textContent = text;
    say(text);   // a paragraph that appears with its words already in it is often not read out: the card's polite line says them too
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { if (n.parentNode) n.parentNode.removeChild(n); }, 4000);
  };
  const leaves = (a) => {   // does this link go anywhere but a place on the page that is open now? Only the part after # may differ: a link to this same file (index.html, index.html?x=1, an empty address) loads the page again, and the tour is gone
    const href = a.getAttribute('href') || '';
    if (href.charAt(0) === '#' || /^javascript:/i.test(href)) return false;
    if (/^(mailto|tel|sms):/i.test(href)) return true;
    try {
      const u = new URL(href, win.location.href), here = win.location, one = (p) => p.replace(/\/index\.html$/, '/');   // "/" and "/index.html" are the same page
      return u.origin !== here.origin || one(u.pathname) !== one(here.pathname) || u.search !== here.search || href.indexOf('#') < 0;
    } catch (e) { return false; }
  };
  let backTimer = 0;
  const comeBack = () => {   // a link to a place on this page scrolls the page away from the lit part: a moment later the lit part is brought back, and the card with it
    if (view !== 'step' || !curEl) return;
    const mine = seq, el = curEl;
    clearTimeout(backTimer);
    backTimer = setTimeout(() => {
      if (!ui || view !== 'step' || mine !== seq || curEl !== el) return;
      bring(el, true).then(() => { if (ui && mine === seq) { placed = ''; place(true); } });
    }, 700);
  };
  const onLink = (e) => {
    if (!ui || !e.target || !e.target.closest || inTour(e.target)) return;
    const a = e.target.closest('a[href]');
    if (!a || a.hasAttribute('data-zoom')) return;   // a link marked data-zoom only opens the photo viewer (js/main.js): it goes nowhere
    if (leaves(a)) {
      e.preventDefault(); e.stopPropagation();
      flash('This link is switched off during the tour, because it would take you away from it.');
      return;
    }
    if (e.type !== 'click' || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    // "/" and "/index.html" are one page, but the browser loads the page again for a link that spells it the other way, and the tour would be gone: only the place is moved to
    let u = null;
    try { u = new URL(a.getAttribute('href') || '', win.location.href); } catch (err) { u = null; }
    if (u && u.origin === win.location.origin && u.pathname !== win.location.pathname) { e.preventDefault(); e.stopPropagation(); win.location.hash = u.hash; }
    comeBack();
  };
  const onForm = (e) => {
    const f = e.target;
    if (!ui || !f || !f.action || inTour(f)) return;
    let out = false;
    try { out = new URL(f.action, win.location.href).origin !== win.location.origin; } catch (err) { out = false; }
    if (out) { e.preventDefault(); e.stopPropagation(); flash('Forms are switched off during the tour.'); }
  };
  const onFormLate = (e) => {   // heard after the page's own handlers: a form that nobody handled (no action, no script) would send its fields to this same address and load the page again
    const f = e.target;
    if (!ui || e.defaultPrevented || !f || inTour(f) || f.method === 'dialog') return;
    e.preventDefault();
    flash('Forms are switched off during the tour.');
  };

  const openTour = (how, at) => beginTour(how, at).catch((e) => warn('opening', e));
  const beginTour = async (how, at) => {   // how: 'welcome' (the button, a link, #tour) or 'resume' (the page after a jump: carry on at step at)
    if (ui || closing) return;
    opener = doc.activeElement && doc.activeElement !== doc.body ? doc.activeElement : null;
    savedScroll = { y: win.scrollY, page: pageOf() };
    openStatus();
    ui = buildUi();
    pill.hidden = true;
    ui.box.classList.toggle('is-still', calm());
    win.addEventListener('keydown', onKey, true);
    win.addEventListener('resize', onResize);
    doc.addEventListener('click', onLink, true);
    doc.addEventListener('auxclick', onLink, true);
    doc.addEventListener('submit', onForm, true);
    doc.addEventListener('submit', onFormLate, false);
    root.classList.add('wa-tour-open');   // css/tour.css: what the page opens over the tour (a dialog) is lifted above the dimmer
    setCard({ title: 'Your website tour', text: 'Getting the tour ready...', buttons: [['Not now', () => endTour(false), 'ghost', true]] });
    setBusy(true); place(true);
    styled = await loadCss();
    await loadSteps();
    if (!ui) return;
    if (!styled) { showNote('The tour could not start', 'Its look did not load. Please reload the page and try again.'); return; }
    if (!steps.length) { showNote('The tour could not start', 'Its steps did not load. Please reload the page and try again.'); return; }
    if (how === 'resume') {
      let i = -1;
      for (let k = 0; k < steps.length; k++) if (steps[k].id === at.id) i = k;
      if (i < 0) for (let j = 0; j < steps.length; j++) if (String(chOf(steps[j])) === String(at.ch)) { i = j; break; }
      if (i < 0) { showWelcome(); return; }
      arrivedFor = steps[i].id;
      goTo(i, 1);
      return;
    }
    showWelcome();
  };

  const endTour = async (finished) => {
    if (!ui || closing) return;
    closing = true; seq++;
    const last = curStep || steps[idx] || null;
    const wasLast = idx === steps.length - 1 && idx >= 0;
    try {   // what the steps did is put back; whatever goes wrong here, the tour is still taken away below
      stopTracking();
      const leaving = entered; entered = null; curStep = null; curEl = null;
      if (choosing) await Promise.race([choosing, wait(600)]);
      defs = null; chosen = -1;
      if (leaving) await run(leaving.after, leaving, 600);
      while (undos.length) { const f = undos.pop(); try { f(); } catch (e) { warn('undo', e); } }
      closeOpened();
    } catch (e) { warn('closing', e); }
    try {
      win.removeEventListener('keydown', onKey, true);
      win.removeEventListener('resize', onResize);
      doc.removeEventListener('click', onLink, true);
      doc.removeEventListener('auxclick', onLink, true);
      doc.removeEventListener('submit', onForm, true);
      doc.removeEventListener('submit', onFormLate, false);
      root.classList.remove('wa-tour-open');
      clearTimeout(backTimer);
      clearTimeout(flashTimer);
      clearTimeout(glide);
      ui.box.remove();
    } catch (e) { warn('closing', e); }
    ui = null; view = 'none';
    pill.hidden = !styled;
    if (savedScroll && savedScroll.page === pageOf()) jump(savedScroll.y);
    const back = opener && opener.isConnected && !opener.hidden ? opener : pill;
    try { back.focus({ preventScroll: true }); } catch (e) { /* gone */ }
    if (finished || wasLast) forget(); else if (last) remember(false, last, 0);
    idx = -1; opener = null; savedScroll = null; placed = ''; cardAt = null;
    closing = false;
    doc.dispatchEvent(new CustomEvent('wa:tour', { detail: { type: 'close', finished: !!(finished || wasLast) } }));
  };

  /* ------------------------------------------------------------------ *
   * 9. Start: the button, links that open the tour, and carrying on after a jump to another page.
   * ------------------------------------------------------------------ */
  const start = () => {
    doc.body.appendChild(pill);
    pill.addEventListener('click', () => openTour('welcome'));
    doc.addEventListener('click', (e) => {   // any link or button with data-tour-open (the demo bar's "Take a tour") opens the welcome card where the visitor is
      const a = e.target && e.target.closest ? e.target.closest('[data-tour-open]') : null;
      if (a) { e.preventDefault(); openTour('welcome'); }
    });
    win.addEventListener('hashchange', () => { if (win.location.hash === '#tour') openTour('welcome'); });
    loadCss().then((ok) => { if (ok) pill.hidden = !!ui; else warn('css/tour.css did not load, so there is no tour button', ''); });
    W.tour = { open: () => openTour('welcome'), close: () => endTour(false), goto: (id) => { for (let i = 0; i < steps.length; i++) if (steps[i].id === id) return goTo(i, 1); return null; }, steps: () => steps.slice() };
    const saved = kv.get('sessionStorage');
    const fresh = !!(saved && saved.run && saved.go && Date.now() - saved.go < 30000);
    if (saved && saved.run && !fresh) kv.set('sessionStorage', { run: 0, id: saved.id, ch: saved.ch, go: 0 });   // the page was reached some other way: not a jump of the tour
    const begin = () => {
      if (fresh) { kv.set('sessionStorage', { run: 1, id: saved.id, ch: saved.ch, go: 0 }); openTour('resume', saved); }
      else if (win.location.hash === '#tour') openTour('welcome');
    };
    const ready = () => { const f = doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve(); f.then(() => setTimeout(begin, 150), () => setTimeout(begin, 150)); };
    if (doc.readyState === 'complete') ready(); else win.addEventListener('load', ready, { once: true });
  };
  if (doc.body) start(); else doc.addEventListener('DOMContentLoaded', start, { once: true });
})();
