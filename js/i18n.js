/* Wise Acres: languages.
 *
 *   - Every block of text on a page carries data-t="<id>" (see tools/i18n.py). English stays in
 *     the HTML; when a visitor picks another language the blocks are swapped from lang/<code>.js.
 *   - Text that JavaScript writes goes through WISE_ACRES.t("English text", {vars}).
 *   - Loaded in <head>, before everything else, so the chosen language is ready before the page paints.
 *
 * Add a language: add it to LANGS below, create lang/src/<code>.json, run `python3 tools/i18n.py build`.
 */
(() => {
  'use strict';

  const W = (window.WISE_ACRES = window.WISE_ACRES || {});
  const doc = document;

  const LANGS = [
    { code: 'en', name: 'English', short: 'EN', html: 'en' },
    { code: 'es', name: 'Español', short: 'ES', html: 'es' },
    { code: 'hi', name: 'हिन्दी', short: 'हिं', html: 'hi' },
    { code: 'zh', name: '中文', short: '中文', html: 'zh-Hans' },
    { code: 'vi', name: 'Tiếng Việt', short: 'VI', html: 'vi' },
  ];
  const CODES = LANGS.map((l) => l.code);
  W.languages = LANGS;
  W.dict = W.dict || {};

  // The word "Language" for the language button and the footer list (read aloud by screen readers).
  const LANG_WORD = { en: 'Language', es: 'Idioma', hi: 'भाषा', zh: '语言', vi: 'Ngôn ngữ' };

  // Asked in the visitor's own language when their browser prefers it.
  const OFFER = {
    es: ['¿Prefieres ver este sitio en español?', 'Sí, en español', 'No, gracias'],
    hi: ['क्या आप यह साइट हिन्दी में देखना चाहेंगे?', 'हाँ, हिन्दी में', 'नहीं, धन्यवाद'],
    zh: ['需要查看中文版本吗？', '查看中文', '不用了'],
    vi: ['Bạn muốn xem trang này bằng tiếng Việt?', 'Có, tiếng Việt', 'Không, cảm ơn'],
  };

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };

  function initial() {
    const q = /[?&]lang=([a-z]{2})\b/i.exec(location.search);
    if (q && CODES.includes(q[1].toLowerCase())) return q[1].toLowerCase();
    const s = store.get('wa.lang');
    return s && CODES.includes(s) ? s : 'en';
  }

  W.lang = initial();
  // Set now, before the page is drawn: the header layout and some text sizes depend on it (css :lang()).
  doc.documentElement.lang = (LANGS.find((l) => l.code === W.lang) || LANGS[0]).html;

  /* ------------------------------------------------------------------ *
   * t(): text that JavaScript writes
   * ------------------------------------------------------------------ */
  const hasOwn = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
  function t(s, vars) {
    const d = W.dict[W.lang];
    // Own keys only: a map name or note such as "constructor" must not pick up Object.prototype.constructor.
    let out = (W.lang !== 'en' && d && hasOwn(d.js, s) && typeof d.js[s] === 'string' && d.js[s]) || s;
    if (vars) out = String(out).replace(/\{(\w+)\}/g, (m, k) => (hasOwn(vars, k) ? vars[k] : m));
    return out;
  }
  W.t = t;

  /* ------------------------------------------------------------------ *
   * clock(): a time of day worded like the fixed texts of the page.
   *   Hindi  शाम 5 बजे, रात 11:59 बजे      Chinese  下午 5 点, 晚上 11:59      Vietnamese  5 giờ chiều, 11:59 tối
   * English ("5:00 PM") and Spanish ("5:00 p. m.") already come out right from the browser's own 12-hour wording, so this
   * returns '' for them (and for any other language): the caller then uses Intl as before. h is 0 to 23, m is 0 to 59.
   * ------------------------------------------------------------------ */
  const DAY_PART = {
    hi: (h) => (h < 4 ? 'रात' : h < 12 ? 'सुबह' : h < 16 ? 'दोपहर' : h < 20 ? 'शाम' : 'रात'),
    zh: (h) => (h < 5 ? '凌晨' : h < 8 ? '早上' : h < 12 ? '上午' : h < 13 ? '中午' : h < 18 ? '下午' : '晚上'),
    vi: (h) => (h < 4 ? 'đêm' : h < 11 ? 'sáng' : h < 13 ? 'trưa' : h < 18 ? 'chiều' : 'tối'),
  };
  W.clock = (h, m, code) => {
    code = code || W.lang;
    const part = hasOwn(DAY_PART, code) && DAY_PART[code];
    if (!part || !(h >= 0 && h < 24 && m >= 0 && m < 60)) return '';
    const h12 = h % 12 || 12, mm = m ? ':' + String(m).padStart(2, '0') : '';   // a whole hour has no minutes, as in "10 am"
    if (code === 'hi') return part(h) + ' ' + h12 + mm + ' बजे';
    if (code === 'zh') return part(h) + ' ' + h12 + (m ? mm : ' 点');
    return m ? h12 + mm + ' ' + part(h) : h12 + ' giờ ' + part(h);
  };

  /* ------------------------------------------------------------------ *
   * Loading dictionaries (before first paint when we can)
   * ------------------------------------------------------------------ */
  const loading = {};
  function load(code, done) {
    if (code === 'en' || W.dict[code]) { done(); return; }
    const s = doc.createElement('script');
    s.src = 'lang/' + code + '.js';
    s.onload = () => done();
    s.onerror = () => done();
    (doc.head || doc.documentElement).appendChild(s);
  }
  if (W.lang !== 'en' && !W.dict[W.lang] && doc.readyState === 'loading') {
    // Parser-blocking on purpose: the page is translated before it is first drawn.
    doc.write('<script src="lang/' + W.lang + '.js"><\/script>');
  }

  /* ------------------------------------------------------------------ *
   * Applying a language to the page
   * ------------------------------------------------------------------ */
  const ATTR_PREFIX = 'data-ta-';

  function swapBlock(el, d, code) {
    if (el._en === undefined) {
      el._en = el.innerHTML;
      el._svgs = Array.from(el.querySelectorAll('svg')).map((n) => n.outerHTML);
      el._links = (el._en.match(/<a\b[^>]*>/g)) || [];     // real opening tags of the links, in order
    }
    if (el._code === code) return;   // already swapped (while the page was read, or by translateNow()): do not rebuild it, so nothing the other scripts attached is lost
    el._code = code;
    const tr = code !== 'en' && d[el.getAttribute('data-t')];
    if (tr) {
      let i = 0;
      el.innerHTML = tr.replace(/<svg\/>/g, () => el._svgs[i++] || '').replace(/<a(\d+)>/g, (m, n) => el._links[n - 1] || '<a>');
    }
    else if (el.innerHTML !== el._en) el.innerHTML = el._en;
  }
  function swapAttrs(el, d, code) {
    for (const a of el.attributes) {
      if (a.name.indexOf(ATTR_PREFIX) !== 0) continue;
      const attr = a.name.slice(ATTR_PREFIX.length);
      if (el['_en_' + attr] === undefined) el['_en_' + attr] = el.getAttribute(attr);
      const tr = code !== 'en' && d[a.value];
      el.setAttribute(attr, tr || el['_en_' + attr]);
    }
  }
  function swapBlocks(code) {
    const d = (W.dict[code] && W.dict[code].ui) || {};
    doc.querySelectorAll('[data-t]').forEach((el) => swapBlock(el, d, code));
    doc.querySelectorAll('*').forEach((el) => swapAttrs(el, d, code));
  }

  let meta = null;
  function swapMeta() {
    if (!meta) {
      const q = (s) => doc.querySelector(s);
      meta = { title: doc.title, nodes: [['meta[name="description"]', 'content'], ['meta[property="og:title"]', 'content'], ['meta[property="og:description"]', 'content']]
        .map(([s, a]) => { const n = q(s); return n ? { n, a, en: n.getAttribute(a) } : null; }).filter(Boolean) };
    }
    doc.title = t(meta.title);
    meta.nodes.forEach((m) => m.n.setAttribute(m.a, t(m.en)));
  }

  function apply(code) {
    const info = LANGS.find((l) => l.code === code) || LANGS[0];
    doc.documentElement.lang = info.html;
    swapBlocks(code);
    swapMeta();
    markMenus();
  }

  // Changing language changes the height of every text block, and the browser loses its place because the
  // text it was anchored to is replaced. So remember which block is at the top of the screen and put it back.
  function placeMark() {
    if (window.scrollY < 120) return null;
    const edge = (doc.querySelector('.site-header') || { getBoundingClientRect: () => ({ bottom: 70 }) }).getBoundingClientRect().bottom + 4;
    const els = doc.querySelectorAll('[data-t]');
    for (let i = 0; i < els.length; i++) {
      if (els[i].closest('header, nav, #action-bar, [aria-hidden="true"]')) continue; // fixed or hidden things do not move with the page
      const r = els[i].getBoundingClientRect();
      if (r.height > 0 && r.bottom > edge + 6 && r.top < window.innerHeight) return { el: els[i], top: r.top };
    }
    return null;
  }
  function restoreMark(m) {
    if (!m || !m.el.isConnected) return;
    const d = m.el.getBoundingClientRect().top - m.top;
    if (Math.abs(d) > 1) { try { window.scrollTo({ top: window.scrollY + d, left: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, window.scrollY + d); } }   // a browser that rejects 'instant' still scrolls
  }

  // The language is applied when the page has been read to the end (DOMContentLoaded), but the big scripts at the end of the page run before that,
  // and the first screen can be painted in English in the meantime. main.js is the first of them: it calls this, so the texts are swapped
  // while the page is still being built. ready() below then only finishes the job (menus, titles, the "wa:lang" event).
  W.translateNow = () => {
    if (W.lang === 'en' || !(W.dict[W.lang] && W.dict[W.lang].ui) || !doc.body) return;
    const info = LANGS.find((l) => l.code === W.lang) || LANGS[0];
    doc.documentElement.lang = info.html;
    swapBlocks(W.lang);
    swapMeta();
  };

  function setLang(code, opts) {
    if (!CODES.includes(code)) return;
    const mark = placeMark();
    load(code, () => {
      W.lang = code;
      if (!(opts && opts.quiet)) store.set('wa.lang', code);
      apply(code);
      doc.dispatchEvent(new CustomEvent('wa:lang', { detail: code }));
      restoreMark(mark);
      // late changes (a font that arrives, a block that redraws): once more, unless the reader has already moved
      const y = window.scrollY;
      setTimeout(() => { if (Math.abs(window.scrollY - y) < 2) restoreMark(mark); }, 500);
    });
  }
  W.setLang = setLang;

  /* ------------------------------------------------------------------ *
   * Switcher UI
   * ------------------------------------------------------------------ */
  const GLOBE = '<svg class="ico" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>';

  function buildMenu(box) {
    if (box._built) return;
    box._built = true;
    box.classList.add('lang');
    box.innerHTML = '<button type="button" class="lang-btn" aria-haspopup="true" aria-expanded="false" aria-label="' + (LANG_WORD[W.lang] || LANG_WORD.en) + '">' + GLOBE + '<span class="lang-cur"></span></button>' +
      '<ul class="lang-list" role="menu" hidden>' + LANGS.map((l) => '<li role="none"><button type="button" role="menuitemradio" aria-checked="false" data-lang="' + l.code + '" lang="' + l.html + '">' + l.name + '</button></li>').join('') + '</ul>';
    const btn = box.querySelector('.lang-btn'), list = box.querySelector('.lang-list');
    const close = () => { list.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
    // The header is sticky: moving focus inside it must not scroll the page (it used to throw the reader hundreds of pixels up).
    btn.addEventListener('click', (e) => { e.stopPropagation(); const open = list.hidden; list.hidden = !open; btn.setAttribute('aria-expanded', String(open)); if (open) { const cur = list.querySelector('[aria-checked="true"]') || list.querySelector('button'); cur.focus({ preventScroll: true }); } });
    list.addEventListener('click', (e) => { const b = e.target.closest('[data-lang]'); if (b) { setLang(b.dataset.lang); close(); btn.focus({ preventScroll: true }); } });
    list.addEventListener('keydown', (e) => {
      const items = Array.from(list.querySelectorAll('button')), i = items.indexOf(doc.activeElement);
      if (e.key === 'Escape') { close(); btn.focus({ preventScroll: true }); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus({ preventScroll: true }); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus({ preventScroll: true }); }
    });
    doc.addEventListener('click', (e) => { if (!box.contains(e.target)) close(); });
    box.addEventListener('focusout', (e) => { if (!list.hidden && e.relatedTarget && !box.contains(e.relatedTarget)) close(); });   // Tab away closes it, like the More menu
  }
  function buildList(ul) {
    if (ul._built) return;
    ul._built = true;
    ul.innerHTML = LANGS.map((l) => '<li><button type="button" class="lang-link" data-lang="' + l.code + '" lang="' + l.html + '">' + l.name + '</button></li>').join('');
    ul.addEventListener('click', (e) => { const b = e.target.closest('[data-lang]'); if (b) setLang(b.dataset.lang); });
  }
  function buildMenus() {
    doc.querySelectorAll('[data-lang-menu]').forEach(buildMenu);
    doc.querySelectorAll('[data-lang-list]').forEach(buildList);
  }

  function markMenus() {
    const cur = LANGS.find((l) => l.code === W.lang) || LANGS[0];
    doc.querySelectorAll('.lang-cur').forEach((n) => { n.textContent = cur.short; });
    doc.querySelectorAll('.lang-btn, [data-lang-list]').forEach((n) => n.setAttribute('aria-label', LANG_WORD[cur.code] || LANG_WORD.en));
    doc.querySelectorAll('[data-lang]').forEach((b) => {
      const on = b.dataset.lang === cur.code;
      if (b.classList.contains('lang-link')) b.setAttribute('aria-pressed', String(on));
      else b.setAttribute('aria-checked', String(on));
    });
  }

  /* ------------------------------------------------------------------ *
   * "Would you like this in Spanish?" — only when the browser asks for it and nothing was chosen yet
   * ------------------------------------------------------------------ */
  let offered = false;
  function offer() {
    if (offered || !doc.body) return;
    offered = true;
    if (W.lang !== 'en' || store.get('wa.lang') || store.get('wa.offer')) return;
    const prefs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']).map((x) => String(x).toLowerCase().slice(0, 2));
    const code = prefs.find((p) => OFFER[p]);
    if (!code) return;
    const [q, yes, no] = OFFER[code];
    const bar = doc.createElement('div');
    bar.className = 'lang-offer'; bar.setAttribute('role', 'region'); bar.setAttribute('lang', code); bar.setAttribute('aria-label', LANG_WORD[code] || LANG_WORD.en);
    bar.innerHTML = '<p lang="' + code + '"></p><button type="button" class="btn btn-sm btn-sun" data-y></button><button type="button" class="btn btn-sm btn-ghost" data-n></button>';
    bar.querySelector('p').textContent = q; bar.querySelector('[data-y]').textContent = yes; bar.querySelector('[data-n]').textContent = no;
    bar.querySelector('[data-y]').addEventListener('click', () => { setLang(code); bar.remove(); });
    bar.querySelector('[data-n]').addEventListener('click', () => { store.set('wa.offer', '1'); bar.remove(); });
    doc.body.prepend(bar);
  }

  function ready() {
    buildMenus();
    if (W.lang !== 'en') { apply(W.lang); doc.dispatchEvent(new CustomEvent('wa:lang', { detail: W.lang })); } else markMenus();
    offer();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', ready); else ready();

  // While the browser reads the page (W.onParse, js/season.js), each text block is put in the chosen language and the
  // language button in the header is drawn, so the first paint is already right and nothing jumps when ready() runs.
  // ready() still goes over the whole page once more, as before.
  if (doc.readyState === 'loading' && W.onParse) {
    const reading = new Set();   // read, but maybe not all of their contents yet
    W.onParse((els) => {
      const d = W.lang !== 'en' && W.dict[W.lang] && W.dict[W.lang].ui;
      els.forEach((el) => {
        if (el === doc.body) offer();
        if (d) { swapAttrs(el, d, W.lang); if (el.hasAttribute('data-t')) reading.add(el); }
        if (el.matches('[data-lang-menu]')) reading.add(el);   // the list in the footer is built by ready(), as before: it is not in the first screen
      });
      reading.forEach((el) => {
        if (!W.parsed(el)) return;
        reading.delete(el);
        if (el.matches('[data-lang-menu]')) { buildMenu(el); markMenus(); }
        else if (d && el.isConnected) swapBlock(el, d, W.lang);
      });
    });
  }
})();
