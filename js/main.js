/* Wise Acres Organic Farm — interactions
 * No dependencies. Everything here is progressive enhancement: the page is fully
 * readable and every link works without JavaScript.
 */
(() => {
  'use strict';

  const doc = document;
  const root = doc.documentElement;
  root.classList.remove('no-js');

  const $ = (sel, ctx = doc) => ctx.querySelector(sel);
  const $$ = (sel, ctx = doc) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Small seeded PRNG so the illustrated field looks the same on every load.
  function mulberry32(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ------------------------------------------------------------------ *
   * Season windows (typical dates — shown as "typical" in the UI)
   * ------------------------------------------------------------------ */
  const SEASONS = [
    { id: 'spring', crop: 'Strawberries',            from: [4, 15], to: [6, 7],  next: 'mid-April' },
    { id: 'summer', crop: 'Blueberries & sunflowers', from: [6, 1],  to: [7, 10], next: 'June' },
    { id: 'fall',   crop: 'Pumpkins',                 from: [9, 13], to: [11, 8], next: 'mid-September' },
  ];
  const md = (m, d) => m * 100 + d;
  const inWindow = (s, now) => {
    const v = md(now.getMonth() + 1, now.getDate());
    return v >= md(...s.from) && v <= md(...s.to);
  };
  const daysUntilStart = (s, now) => {
    let start = new Date(now.getFullYear(), s.from[0] - 1, s.from[1]);
    if (start < now) start = new Date(now.getFullYear() + 1, s.from[0] - 1, s.from[1]);
    return (start - now) / 864e5;
  };

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

    photos.forEach((p) => {
      const li = doc.createElement('li');
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Enlarge photo: ' + p.alt);
      const thumb = doc.createElement('img');
      thumb.src = p.src; thumb.alt = p.alt; thumb.loading = 'lazy'; thumb.decoding = 'async';
      btn.appendChild(thumb);
      btn.addEventListener('click', () => {
        img.src = p.src; img.alt = p.alt; cap.textContent = p.caption || '';
        box.showModal();
      });
      li.appendChild(btn);
      grid.appendChild(li);
    });
    box.addEventListener('click', (e) => { if (e.target === box) box.close(); });

    section.hidden = false;
    const flowersLink = $('.nav a[href="#flowers"]');
    if (flowersLink) {
      const li = doc.createElement('li');
      li.innerHTML = '<a href="#gallery">Photos</a>';
      flowersLink.parentElement.after(li);
    }
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
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      nav.classList.toggle('is-open', open);
      doc.body.classList.toggle('nav-lock', open);
    };
    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    doc.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { setOpen(false); toggle.focus(); }
    });
    matchMedia('(min-width: 921px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });

    // Scroll-spy: highlight the nav link for the section in the middle of the screen.
    if (!('IntersectionObserver' in window)) return;
    const links = new Map($$('.nav ul a').map((a) => [a.getAttribute('href').slice(1), a]));
    const setCurrent = (id) => {
      links.forEach((a, key) => (key === id ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
    };
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) setCurrent(en.target.id); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('main > section[id]').forEach((s) => spy.observe(s));
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
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    targets.forEach((el) => io.observe(el));
  }

  /* ------------------------------------------------------------------ *
   * Hero: strawberry field + foreground
   * ------------------------------------------------------------------ */
  const berries = [];   // pickable berry groups

  function buildField() {
    const svg = $('#field');
    const fore = $('#fore');
    if (!svg || !fore) return;
    const rnd = mulberry32(11);
    const VPY = 262, BOT = 600, SPAN = BOT - VPY;
    let out = '';

    out += `<path d="M0 ${VPY + 10}C240 ${VPY - 8} 480 ${VPY + 8} 720 ${VPY}S1200 ${VPY - 8} 1440 ${VPY - 2}V${BOT}H0Z" fill="#69b84c"/>`;

    // Perspective soil rows
    const rowPt = (k, t, side, widen) => [720 + k * 230 * t + side * (6 + widen * t), VPY + SPAN * t];
    for (let k = -5; k <= 5; k++) {
      const [ax, ay] = rowPt(k, 0.05, -1, 58), [bx, by] = rowPt(k, 0.05, 1, 58);
      const [cx, cy] = rowPt(k, 1, 1, 58), [dx, dy] = rowPt(k, 1, -1, 58);
      out += `<path d="M${ax} ${ay}L${bx} ${by}L${cx} ${cy}L${dx} ${dy}Z" fill="#8a5a35" stroke="#3a2416" stroke-width="2.5" stroke-linejoin="round"/>`;
      const [ex, ey] = rowPt(k, 0.05, -1, 26), [fx, fy] = rowPt(k, 0.05, 1, 26);
      const [gx, gy] = rowPt(k, 1, 1, 26), [hx, hy] = rowPt(k, 1, -1, 26);
      out += `<path d="M${ex} ${ey}L${fx} ${fy}L${gx} ${gy}L${hx} ${hy}Z" fill="#a4714a" opacity=".55"/>`;
    }

    // Plants, back to front
    const levels = [0.11, 0.15, 0.19, 0.25, 0.32, 0.4, 0.5, 0.62];
    levels.forEach((t) => {
      for (let k = -4; k <= 4; k++) {
        const cx = 720 + k * 230 * t;
        const cy = VPY + SPAN * t;
        const w = 22 + 130 * t, h = w * 0.75;
        out += `<use href="#sb-plant" x="${(cx - w / 2).toFixed(1)}" y="${(cy - h * 0.94).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"/>`;
        const r = rnd();
        const count = t >= 0.25 ? (r < 0.3 ? 0 : r < 0.72 ? 1 : 2) : (r < 0.5 ? 1 : 0);
        const bw = w * 0.27, bh = bw * 72 / 64;
        const spots = [[cx - w * 0.3 - bw / 2, cy - h * 0.56], [cx + w * 0.13, cy - h * 0.5]];
        for (let i = 0; i < count; i++) {
          const [bx, by] = spots[i];
          const berry = `<use href="#strawberry" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}"/>`;
          if (t >= 0.25) {
            const pad = bw * 0.3;
            out += `<g class="berry-hit" transform="translate(${bx.toFixed(1)} ${by.toFixed(1)})" data-berry><g class="berry">${berry}</g>` +
                   `<rect x="${-pad}" y="${-pad}" width="${(bw + pad * 2).toFixed(1)}" height="${(bh + pad * 2).toFixed(1)}" fill="transparent"/></g>`;
          } else {
            out += `<g transform="translate(${bx.toFixed(1)} ${by.toFixed(1)})">${berry}</g>`;
          }
        }
      }
    });
    svg.innerHTML = out;
    $$('[data-berry]', svg).forEach((g) => berries.push(g));

    // Foreground: sunflowers + grass. Overflow is visible so the parallax never shows a seam.
    const blades = (base, minH, maxH, step, fill, seed) => {
      const r = mulberry32(seed);
      let d = `M-40 700V${base}`;
      for (let x = -40; x <= 1480; x += step) d += `L${x + step / 2} ${(base - minH - r() * (maxH - minH)).toFixed(0)}L${x + step} ${base}`;
      return `<path d="${d}V700Z" fill="${fill}" stroke="#3a2416" stroke-width="3" stroke-linejoin="round"/>`;
    };
    const sf = (x, y, w, cls) => `<g class="sway ${cls}"><use href="#sunflower-plant" x="${x}" y="${y}" width="${w}" height="${(w * 380 / 140).toFixed(0)}"/></g>`;
    fore.innerHTML =
      blades(520, 10, 30, 26, '#5cb85c', 4) +
      sf(24, 205, 128, '') + sf(170, 300, 88, 's2') + sf(1236, 250, 112, 's3') + sf(1330, 178, 138, 's2') + sf(1160, 340, 78, '') +
      blades(538, 12, 34, 22, '#2e8b3a', 9);
  }

  /* ------------------------------------------------------------------ *
   * Hero: picking strawberries
   * ------------------------------------------------------------------ */
  function initPicking() {
    const hero = $('#top');
    const countEl = $('#pick-count');
    const msgEl = $('#pick-msg');
    const btn = $('#pick-btn');
    if (!hero || !countEl || !berries.length) return;
    const reserveHref = $('.hero-cta a').getAttribute('href');
    let count = 0;

    const messages = [
      [1, 'Yum! Keep going.'],
      [3, 'You&rsquo;re a natural picker!'],
      [5, 'Basket&rsquo;s filling up! Ready for the real thing? <a href="' + reserveHref + '" target="_blank" rel="noopener">Reserve a visit</a>'],
      [10, 'Wow, ten! <a href="' + reserveHref + '" target="_blank" rel="noopener">Reserve your spot</a> and pick real ones.'],
    ];

    function pick(g) {
      if (g.dataset.state === 'picked') return;
      g.dataset.state = 'picked';
      const berry = $('.berry', g);
      berry.classList.remove('is-regrowing');
      berry.classList.add('is-picked');
      count += 1;
      countEl.textContent = String(count);
      countEl.classList.remove('bump'); void countEl.offsetWidth; countEl.classList.add('bump');
      const m = messages.filter(([n]) => count >= n).pop();
      if (m) msgEl.innerHTML = m[1];

      const r = g.getBoundingClientRect(), h = hero.getBoundingClientRect();
      const plus = doc.createElement('span');
      plus.className = 'plus-one';
      plus.textContent = '+1';
      plus.style.left = (r.left - h.left + r.width / 2 - 12) + 'px';
      plus.style.top = (r.top - h.top - 6) + 'px';
      hero.appendChild(plus);
      setTimeout(() => plus.remove(), 950);

      setTimeout(() => {
        berry.classList.remove('is-picked');
        berry.classList.add('is-regrowing');
        delete g.dataset.state;
        setTimeout(() => berry.classList.remove('is-regrowing'), 900);
      }, 7000 + Math.random() * 4000);
    }

    berries.forEach((g) => g.addEventListener('click', () => pick(g)));

    // Keyboard / touch friendly alternative
    btn.addEventListener('click', () => {
      const free = berries.filter((g) => g.dataset.state !== 'picked');
      if (!free.length) { msgEl.textContent = 'You picked them all! Give them a moment to grow back.'; return; }
      pick(free[Math.floor(Math.random() * free.length)]);
    });
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
      requestAnimationFrame(frame);
    }
    new IntersectionObserver((entries) => {
      const on = entries[0].isIntersecting;
      if (on && !running) { running = true; requestAnimationFrame(frame); }
      if (!on) running = false;
    }).observe(hero);
  }

  /* ------------------------------------------------------------------ *
   * Scroll-linked effects: vine progress, hero parallax, tractor
   * ------------------------------------------------------------------ */
  function initScroll() {
    const header = $('#site-header');
    const hero = $('#top');
    const layers = $$('.layer[data-depth]').map((el) => ({ el, depth: parseFloat(el.dataset.depth) }));
    const steps = $('#steps');
    const stepEls = $$('.step', steps);
    const track = $('.track', steps);
    let ticking = false, moveTimer = 0;

    function update() {
      ticking = false;
      const y = window.scrollY;
      const vh = window.innerHeight;
      const max = root.scrollHeight - vh;
      header.style.setProperty('--vp', max > 0 ? clamp(y / max, 0, 1).toFixed(4) : '0');

      if (!reduceMotion && y < hero.offsetHeight + 40) {
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

  function initSeasons() {
    const tabs = $$('.season-tab');
    const panels = $$('.season-panel');
    const builders = { spring: sceneSpring, summer: sceneSummer, fall: sceneFall };
    $$('.scene-card').forEach((card) => {
      card.innerHTML = `<svg viewBox="0 0 480 340" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${builders[card.dataset.scene]()}</svg>`;
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
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t.dataset.season));
      t.addEventListener('keydown', (e) => {
        const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
        let next = -1;
        if (e.key in keys) next = (i + keys[e.key] + tabs.length) % tabs.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = tabs.length - 1;
        if (next >= 0) { e.preventDefault(); select(tabs[next].dataset.season, true); }
      });
    });

    // Mark what's happening now, and open that season by default.
    const now = new Date();
    const live = SEASONS.filter((s) => inWindow(s, now));
    live.forEach((s) => { $('.now-badge', $('#tab-' + s.id)).hidden = false; });
    const target = live[0] || SEASONS.slice().sort((a, b) => daysUntilStart(a, now) - daysUntilStart(b, now))[0];
    select(target.id);

    const fact = $('#fact-season');
    if (fact) {
      fact.textContent = live.length
        ? live.map((s) => s.crop).join(' & ') + ' — happening now'
        : 'Next up: ' + target.crop + ' (' + target.next + ')';
    }
  }

  /* ------------------------------------------------------------------ *
   * Flowers: build-a-bouquet
   * ------------------------------------------------------------------ */
  function initBouquet() {
    const stems = $('#bq-stems'), heads = $('#bq-heads'), msg = $('#bq-msg'), clear = $('#bq-clear');
    const buttons = $$('.bq-flower');
    if (!stems || !heads) return;
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
        ? 'Your cup is full! Cutting a real bouquet is part of the fun in our flower field.'
        : `Added a ${k.label}. ${n} of ${SLOTS.length} flowers in your cup.`;
      buttons.forEach((b) => { b.disabled = full; });
    }

    buttons.forEach((b) => b.addEventListener('click', () => add(b.dataset.kind)));
    clear.addEventListener('click', () => {
      stems.textContent = ''; heads.textContent = ''; n = 0;
      buttons.forEach((b) => { b.disabled = false; });
      msg.textContent = 'Fresh cup! Tap a flower to add it.';
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
      bubble.textContent = lines[i++ % lines.length];
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
      if (r < 0.2) { const h = 96 + rndv() * 26; return { h, ratio: 140 / 380, sway: true, html: '<svg viewBox="0 0 140 380"><use href="#sunflower-plant"/></svg>' }; }
      if (r < 0.45) { const h = 44 + rndv() * 16; return { h, ratio: 120 / 90, html: '<svg viewBox="0 0 120 90"><use href="#sb-plant"/></svg>' }; }
      if (r < 0.65) { const h = 44 + rndv() * 14; return { h, ratio: 110 / 92, html: '<svg viewBox="0 0 110 92"><use href="#pumpkin"/></svg>' }; }
      if (r < 0.82) { const h = 44 + rndv() * 12; return { h, ratio: 90 / 92, html: '<svg viewBox="0 0 90 92"><use href="#blueberry"/></svg>' }; }
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

  /* ------------------------------------------------------------------ */
  initGallery();
  buildField();
  initNav();
  initReveal();
  initPicking();
  initBee();
  initSeasons();
  initBouquet();
  initGoat();
  initCrops();
  initScroll();
})();
