/* Wise Acres: "What to buy": a card opens a pop-up with the ingredient list of the product. Nothing is stored or sent.
 * The lists are PREVIEW DATA in js/shop-sample.js (window.WISE_ACRES.shopSample, by picture name: the p-<slug> in the card's <use>). Without that file this script does nothing:
 * no button, no class, no listener on a card, no file asked for. With it, each card that has an entry gets the class shop-card-pop (css/extras.css: it grows when pointed at)
 * and a transparent button.shop-open over the whole card, named "<name>, <price>, show ingredients" in the page's language. A click, Enter or Space opens ONE pop-up
 * (div.shop-pop, role="dialog"), built the first time and filled again each time; css/shop-pop.css is asked for when a card is first pointed at. While it is open the page behind
 * is hidden (aria-hidden, inert) and does not scroll, Tab stays inside, Escape, the X, Close and a click outside shut it, and focus goes back to the card. Its words go through
 * WISE_ACRES.t() (lang/src/<code>.json, "js"); the names in the lists stay English. */
(function () {
  'use strict';

  const W = (window.WISE_ACRES = window.WISE_ACRES || {}), doc = document, root = doc.documentElement;
  const me = doc.currentScript;
  const where = me && me.src ? /^(.*)js\/shop-pop\.js(?:[?#].*)?$/.exec(me.src) : null;
  const BASE = where ? where[1] : '';   // the site's folder, from this script's own address ('' when the preview put the script in the page)
  const t = (s, v) => (W.t ? W.t(s, v) : s);
  const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  let items = [], cssReady = null, current = null, opener = null, down = null, saved = [], ticket = 0;
  let pop, box, closeX, picture, title, price, note, pretend, heading, list, contains, done;

  /* ---------------------------------------------------------------- the cards */
  function slugOf(card) {   // the product's id: the picture's name without p-
    const use = card.querySelector('.shop-bubble use');
    const m = use ? /#p-([a-z0-9-]+)$/.exec(use.getAttribute('href') || '') : null;
    return m ? m[1] : '';
  }
  function priceOf(card) {
    const p = card.querySelector('.shop-price, .shop-opts');
    if (!p) return '';
    if (!p.classList.contains('shop-opts')) return clean(p.textContent);
    return Array.prototype.map.call(p.children, (li) => Array.prototype.map.call(li.children, (c) => clean(c.textContent)).join(' ')).join(', ');
  }
  function labelOf(item) {
    const n = item.card.querySelector('.shop-name');
    const vars = { name: clean(n && n.textContent), price: priceOf(item.card) };
    const s = item.entry.heading === 'Made of' ? t('{name}, {price}, show what it is made of', vars) : t('{name}, {price}, show ingredients', vars);
    return s.replace(/,\s*,/g, ',');
  }
  const relabel = () => items.forEach((item) => item.btn.setAttribute('aria-label', labelOf(item)));

  /* ---------------------------------------------------------------- the style sheet (as js/tour.js loads css/tour.css) */
  function loadCss() {
    return cssReady || (cssReady = new Promise((resolve) => {
      if (doc.querySelector('link[href*="shop-pop.css"], style[data-shop-pop-css]')) { resolve(true); return; }   // already in the page (the preview)
      const link = doc.createElement('link');
      let finished = false;
      const end = (ok) => { if (!finished) { finished = true; if (!ok) { cssReady = null; link.remove(); } resolve(ok); } };   // a failed try is forgotten: the next click asks again
      link.rel = 'stylesheet'; link.href = BASE + 'css/shop-pop.css';
      link.onload = () => end(true); link.onerror = () => end(false);
      setTimeout(() => end(!!link.sheet), 8000);
      (doc.head || root).appendChild(link);
    }));
  }

  /* ---------------------------------------------------------------- the pop-up */
  function build() {
    const el = (tag, cls, parent) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (parent) parent.appendChild(n); return n; };
    pop = el('div', 'shop-pop'); pop.hidden = true;
    box = el('div', 'shop-pop-box', pop);
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'shop-pop-title'); box.setAttribute('aria-describedby', 'shop-pop-pretend'); box.tabIndex = -1;
    closeX = el('button', 'shop-pop-x', el('div', 'shop-pop-bar', box)); closeX.type = 'button';
    const head = el('div', 'shop-pop-head', box), main = el('div', 'shop-pop-main', box);
    picture = el('span', 'shop-pop-pic', head);
    title = el('h2', 'shop-pop-name', head); title.id = 'shop-pop-title';
    price = el('div', 'shop-pop-price', main);
    note = el('p', 'shop-pop-note', main);
    pretend = el('p', 'shop-pop-pretend', main); pretend.id = 'shop-pop-pretend';
    heading = el('h3', 'shop-pop-h', main);
    list = el('ul', 'shop-pop-list', main); list.setAttribute('lang', 'en');   // the names in the lists are English in every language
    contains = el('p', 'shop-pop-contains', main);
    done = el('button', 'btn btn-sm shop-pop-done', main); done.type = 'button';
    closeX.addEventListener('click', close); done.addEventListener('click', close);
    pop.addEventListener('pointerdown', (e) => { down = e.target; });
    pop.addEventListener('click', (e) => { if (e.target === pop && (down === pop || down === null)) close(); down = null; });   // the dim part, not the end of a drag that began in the box
    doc.body.appendChild(pop);
  }

  function fill(item) {
    const card = item.card, entry = item.entry, group = card.closest('.shop-group'), ico = card.querySelector('.shop-ico');
    box.className = 'shop-pop-box ' + ((group && /\bsg-[a-z0-9-]+/.exec(group.className)) || [''])[0];   // the group's own colours (--g, --gt, --gp)
    picture.textContent = '';
    if (ico) { const c = ico.cloneNode(true); c.setAttribute('class', 'shop-pop-ico'); picture.appendChild(c); }
    const n = card.querySelector('.shop-name'), p = card.querySelector('.shop-price, .shop-opts'), s = card.querySelector('.shop-sub');
    title.textContent = clean(n && n.textContent);
    price.textContent = '';
    if (p) {
      const c = p.cloneNode(true);
      [c].concat(Array.prototype.slice.call(c.querySelectorAll('[data-t]'))).forEach((x) => x.removeAttribute('data-t'));   // the language switch must not rewrite the copy
      price.appendChild(c);
    }
    note.textContent = clean(s && s.textContent); note.hidden = !note.textContent;
    pretend.textContent = t('(This is not the real ingredients. This is just a preview.)');
    heading.textContent = entry.heading === 'Made of' ? t('Made of') : t('Ingredients');
    list.textContent = '';
    entry.list.forEach((x) => { const li = doc.createElement('li'); li.textContent = x; list.appendChild(li); });
    contains.textContent = '';
    if (entry.contains) {
      const b = doc.createElement('strong'), w = doc.createElement('span');
      b.textContent = t('Contains:'); w.setAttribute('lang', 'en'); w.textContent = ' ' + entry.contains;
      contains.appendChild(b); contains.appendChild(w);
    }
    contains.hidden = !entry.contains;
    closeX.setAttribute('aria-label', t('Close')); done.textContent = t('Close');
  }

  function lock() {   // the page behind: out of reach of screen readers and Tab, and it does not scroll or slide when the scroll bar goes
    saved = [];
    Array.prototype.forEach.call(doc.body.children, (el) => {
      if (el === pop || /^(?:SCRIPT|STYLE|LINK|TEMPLATE|NOSCRIPT)$/.test(el.tagName)) return;
      saved.push([el, el.getAttribute('aria-hidden'), el.hasAttribute('inert')]);
      el.setAttribute('aria-hidden', 'true'); el.setAttribute('inert', '');
    });
    root.style.setProperty('--shop-bar', Math.max(0, window.innerWidth - root.clientWidth) + 'px');
    root.classList.add('shop-pop-lock');
  }
  function unlock() {
    saved.forEach((s) => {
      if (s[1] === null) s[0].removeAttribute('aria-hidden'); else s[0].setAttribute('aria-hidden', s[1]);
      if (!s[2]) s[0].removeAttribute('inert');
    });
    saved = [];
    root.classList.remove('shop-pop-lock'); root.style.removeProperty('--shop-bar');
  }

  function keys(e) {
    if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = Array.prototype.filter.call(box.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])'), (x) => !x.disabled && x.getClientRects().length);
    const a = doc.activeElement, first = f[0], last = f[f.length - 1];
    if (!f.length) { e.preventDefault(); return; }
    if (e.shiftKey ? (a === first || a === box || !box.contains(a)) : (a === last || !box.contains(a))) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
  }
  function strayed(e) { if (!box.contains(e.target)) closeX.focus({ preventScroll: true }); }   // focus came back from the browser's own bar: into the box

  function open(item, btn) {
    if (pop && pop.classList.contains('is-open')) return;
    const mine = ++ticket;
    current = item; opener = btn;
    if (!pop) build();
    fill(item);
    loadCss().then((ok) => {
      if (mine !== ticket) return;   // closed, or another card was asked for, while the style sheet was on its way
      if (!ok) { current = null; opener = null; try { console.warn('Wise Acres: css/shop-pop.css did not load, so the pop-up stays shut'); } catch (x) { /* no console */ } return; }
      lock();
      pop.hidden = false;
      void pop.offsetWidth;   // the first frame is the shut one, so the fade runs
      pop.classList.add('is-open');
      doc.addEventListener('keydown', keys, true); doc.addEventListener('focusin', strayed);
      closeX.focus({ preventScroll: true });
    });
  }
  function close() {
    ticket++; current = null;
    if (!pop || !pop.classList.contains('is-open')) return;
    pop.classList.remove('is-open');
    doc.removeEventListener('keydown', keys, true); doc.removeEventListener('focusin', strayed);
    unlock();
    const b = opener; opener = null;
    if (b && b.isConnected) b.focus({ preventScroll: true });
  }

  /* ---------------------------------------------------------------- start: only when there is data */
  function start() {
    const data = W.shopSample, shop = doc.getElementById('shop');
    if (!shop || !data || typeof data !== 'object') return;   // no sample file: the feature is not there
    shop.querySelectorAll('.shop-card').forEach((card) => {
      const slug = slugOf(card), entry = slug && own(data, slug) ? data[slug] : null;
      if (!entry || !Array.isArray(entry.list) || !entry.list.length) return;
      const btn = doc.createElement('button');
      btn.type = 'button'; btn.className = 'shop-open'; btn._item = { card: card, btn: btn, entry: entry };
      card.classList.add('shop-card-pop'); card.appendChild(btn);
      items.push(btn._item);
    });
    if (!items.length) return;
    relabel();
    const hit = (e) => (e.target.closest ? e.target.closest('.shop-open') : null);
    const warm = (e) => { if (hit(e)) { loadCss(); shop.removeEventListener('pointerover', warm); shop.removeEventListener('focusin', warm); } };
    shop.addEventListener('pointerover', warm); shop.addEventListener('focusin', warm);
    shop.addEventListener('click', (e) => { const b = hit(e); if (b) open(b._item, b); });
    shop.addEventListener('focusin', (e) => {   // the keyboard gets the same grow as the pointer (but not a card that a mouse click focused)
      const b = hit(e);
      if (!b) return;
      let seen = true;
      try { seen = b.matches(':focus-visible'); } catch (x) { /* a browser that does not know the selector: show it */ }
      if (seen) b._item.card.classList.add('shop-pop-focus');
    });
    shop.addEventListener('focusout', (e) => { const b = hit(e); if (b) b._item.card.classList.remove('shop-pop-focus'); });
    doc.addEventListener('wa:lang', () => { relabel(); if (current && pop && pop.classList.contains('is-open')) fill(current); });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})();
