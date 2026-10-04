// order: 310
// browser: yes
// covers: css/*, js/main.js, js/features.js, js/hero.js, js/i18n.js, *.html, pages/*
/* Keyboard only and screen reader: a visitor who never touches a mouse. Each of the six pages in English at 1280 px, then in Hindi or Chinese at 390 px:
 * Tab from the top to the end (and Shift+Tab back on one page): the skip link comes first and lands on the main content; every link, button, field,
 * tab, filter, FAQ question, map point, photo and mini game is reached; focus is always on screen, visible (a ring of 3:1 against what is under it),
 * not cut off, not under the sticky header, the bottom bar or the back-to-top button, never on something invisible or inside aria-hidden; no trap.
 * Then each control with its own keys: the menus and the language menu (Escape closes and gives focus back), tabs and the hero season picker (arrow
 * keys), the photo viewer (keeps focus, Escape returns to the photo), FAQ, map points, Remind me, filters, the bouquet, the goat, the hero's two
 * buttons. What a screen reader gets: a name in the page's own language, alt on images, one main, headings without skipped levels, live regions that
 * do not talk every second, the signup and drive-time errors tied to their field. With reduced motion nothing moves focus by itself. */
import { run, open, ok, info, until } from './lib.mjs';

// Which language each page is walked in besides English (Hindi or Chinese, both scripts with no Latin letters, so English left over shows).
const PAGES = [['index.html', 'zh'], ['first-visit.html', 'hi'], ['pumpkin-patch.html', 'zh'], ['strawberry-picking.html', 'hi'], ['school-field-trips.html', 'zh'], ['wise-pie.html', 'hi']];
const WIDE = { width: 1280, height: 900 }, PHONE = { width: 390, height: 800 };
// Names that stay English in every language (the farm's own names, places, services, people), so they are not "English left over".
const NAMES = /Wise Acres( Organic Farm)?|Wise Pie|The GreenHouse|GreenHouse|Instagram|Facebook|Google( Maps| Calendar)?|Apple Maps|Waze|Tripadvisor|Yelp|Axios Charlotte|USDA|Indian Trail|Hartis Rd|Poplin Rd|OpenStreetMap|Bookeo|Mailchimp|Halfzies|Ricotta Pie|Dill Pickle|Bee Keeper|Farmer Cathy|Waxhaw Creamery|Uno Alla Volta|Wholly Wholesome|Follow Your Heart|English|Español|Tiếng Việt|[\w.+-]+@[\w.-]+|https?:\S+|[#@]\w+/g;

/* Put into each page once: look() describes the element that has focus and what is wrong with how it shows. */
function helpers() {
  const lum = (c) => { const m = String(c).match(/[\d.]+/g); if (!m || (m.length > 3 && +m[3] < 0.95)) return null; return m.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return x == null || y == null ? null : (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  // the colour behind an element: the first solid background up the tree; null when a picture, a gradient or a drawing is in the way
  const solidBg = (e) => {
    for (let n = e; n && n.nodeType === 1; n = n.parentElement) {
      if (n instanceof SVGElement || n.tagName === 'IMG' || n.tagName === 'VIDEO' || n.tagName === 'CANVAS') return null;
      const s = getComputedStyle(n);
      if (s.backgroundImage !== 'none') return null;
      const c = s.backgroundColor, m = c.match(/[\d.]+/g);
      if (m && (m.length < 4 || +m[3] >= 0.95)) return c;
      if (m && m.length > 3 && +m[3] > 0.1) return null;   // see-through: depends on what is under it
    }
    return getComputedStyle(document.body).backgroundColor;
  };
  const fixedOf = (e) => { for (let n = e; n && n.nodeType === 1; n = n.parentElement) { const p = getComputedStyle(n).position; if (p === 'fixed' || p === 'sticky') return n; } return null; };
  const tag = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/)[0] : '');
  const label = (e) => (e.getAttribute('aria-label') || e.innerText || e.alt || e.value || e.title || (e.querySelector('img') || {}).alt || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  window.__kb = {
    look() {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return null;
      // what shows the focus: the element's own ring, or (for a hidden radio / checkbox, a photo in a frame, the hero chip) its neighbour's or parent's
      const seen = (n) => n.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && parseFloat(getComputedStyle(n).opacity) > 0.5 && n.getBoundingClientRect().width > 1;
      const ringed = (n) => { const s = getComputedStyle(n); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1; };
      const ind = [el, el.nextElementSibling, el.parentElement].find((n) => n && ringed(n) && seen(n)) || (ringed(el) ? el : null);
      const out = { d: tag(el), name: label(el), x: Math.round(el.getBoundingClientRect().left), y: Math.round(el.getBoundingClientRect().top + scrollY), fixed: !!fixedOf(el), again: !!el.dataset.kbSeen, probs: [] };
      el.dataset.kbSeen = '1';
      const bad = (t) => out.probs.push(t);
      if (!el.matches(':focus-visible')) bad('not :focus-visible');
      if (el.closest('[aria-hidden="true"]')) bad('inside aria-hidden');
      if (el.closest('[inert]')) bad('inside inert');
      if (!ind) { bad('no focus ring'); return out; }
      const is = getComputedStyle(ind), r = ind.getBoundingClientRect();
      if (!seen(ind)) bad('focus is on something invisible');
      if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) bad('off screen (' + Math.round(r.left) + ',' + Math.round(r.top) + ')');
      const ow = parseFloat(is.outlineWidth), oo = parseFloat(is.outlineOffset), ext = Math.max(0, ow + oo);
      if (ow < 2) bad('ring thinner than 2px');
      // the ring must not be cut off by the window edge or by a box that clips its content
      if (r.top - ext < -1 || r.left - ext < -1 || r.right + ext > innerWidth + 1 || r.bottom + ext > innerHeight + 1) bad('ring cut off by the window edge');
      for (let n = ind.parentElement; n && n !== document.body; n = n.parentElement) {
        const s = getComputedStyle(n);
        if (/(hidden|clip|auto|scroll)/.test(s.overflowX + s.overflowY)) { const q = n.getBoundingClientRect(); const cut = Math.max(q.left - (r.left - ext), r.right + ext - q.right, q.top - (r.top - ext), r.bottom + ext - q.bottom); if (cut > 1.5) { bad('ring cut off by ' + tag(n) + ' (' + Math.round(cut) + 'px)'); break; } }
      }
      // nothing fixed (header, bottom bar, back-to-top) on top of the element: points well inside it (corners are often round)
      for (const [fx, fy] of [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
        const x = r.left + r.width * fx, y = r.top + r.height * fy;
        if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
        const top = document.elementFromPoint(x, y);
        if (!top || el.contains(top) || top.contains(el) || ind.contains(top)) continue;
        const f = fixedOf(top);
        if (f && !f.contains(el)) { bad('covered by ' + tag(f)); break; }
      }
      // ring contrast against what is under it (WCAG 1.4.11): a white band under the ring (box-shadow 0 0 0 Npx) counts as what is under it
      const halo = [...is.boxShadow.matchAll(/(rgba?\([^)]*\)) 0px 0px 0px (\d+(?:\.\d+)?)px/g)].find((m) => +m[2] >= ext - 0.5 && !is.boxShadow.includes('inset'));
      const ring = is.outlineColor, unders = [];
      if (halo) unders.push(halo[1]);
      else {
        const mid = oo + ow / 2;   // the middle of the ring band, outside the box (or inside it when the offset is negative)
        for (const [x, y] of [[r.left + r.width / 2, r.top - mid], [r.left + r.width / 2, r.bottom + mid], [r.left - mid, r.top + r.height / 2], [r.right + mid, r.top + r.height / 2]]) {
          if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
          const under = document.elementsFromPoint(x, y).find((n) => n !== ind && !ind.contains(n) && n !== el);
          unders.push(under ? solidBg(under) : null);
        }
      }
      const rs = unders.map((u) => (u ? ratio(ring, u) : null));
      const known = rs.filter((v) => v != null);
      out.contrast = known.length ? Math.round(Math.min(...known) * 10) / 10 : null;
      if (out.contrast != null && out.contrast < 3) bad('ring contrast ' + out.contrast + ':1 (' + ring + ' on ' + unders[rs.indexOf(Math.min(...known))] + ')');
      return out;
    },
    // focusable things that are shown but never got focus (a radio group has one stop: its other members are fine)
    missed() {
      const groups = new Set([...document.querySelectorAll('input[type=radio][data-kb-seen]')].map((r) => r.name));
      return [...document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, summary, [tabindex], iframe')]
        .filter((e) => !e.dataset.kbSeen && !e.disabled && e.tabIndex >= 0 && !e.closest('[inert], dialog:not([open])') && e.checkVisibility({ visibilityProperty: true }) && !(e.type === 'radio' && groups.has(e.name)))
        .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
        .map((e) => tag(e) + ' "' + label(e) + '"');
    },
    // what a screen reader is given: names left in English, images with no alt, landmarks, heading levels, form fields with no label
    reader(lang, namesSrc) {
      const NAMES = new RegExp(namesSrc, 'g'), out = { english: [], noAlt: [], skips: [], noLabel: [], badRef: [] };
      const script = { hi: /[\u0900-\u097f]/, zh: /[\u3400-\u9fff]/ }[lang] || /[^\x00-\x7f]/;
      const own = (e, viaRef) => {   // the words of a name that are in the page's language (English names are wrapped in lang="en")
        if (e.closest('[lang="en"]')) return '';
        // a name built from other elements (aria-labelledby) does not follow THEIR aria-labelledby (the browser rule; a link may name itself and its heading: "selfId headingId")
        const a = e.getAttribute('aria-label') || (viaRef ? '' : (e.getAttribute('aria-labelledby') || '').split(/\s+/).map((i) => { const t = document.getElementById(i); return t ? own(t, true) : ''; }).join(' '));
        if (a) return a;
        if (e.tagName === 'IMG') return e.alt || '';
        const c = e.cloneNode(true); c.querySelectorAll('[lang="en"], wa-en, [aria-hidden="true"], svg, .sr-only[data-no-i18n]').forEach((x) => x.remove());
        return c.textContent + ' ' + [...c.querySelectorAll('img')].map((i) => i.alt).join(' ');
      };
      const shown = (e) => e.checkVisibility({ visibilityProperty: true }) || e.closest('.sr-only');
      const things = [...document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, summary, [tabindex="0"], img, [role="img"], [role="region"], [role="group"], [role="tablist"], [role="radiogroup"], nav, dialog')].filter((e) => !e.closest('[aria-hidden="true"]'));
      for (const e of things) {
        if (e.tagName === 'IMG' && !e.hasAttribute('alt')) out.noAlt.push(e.getAttribute('src'));
        if (lang === 'en' || !shown(e) || e.closest('[data-no-i18n]:not([data-signup-msg])')) continue;
        const words = own(e).replace(NAMES, ' ').replace(/\s+/g, ' ');
        // left over = English words and not one word of the page's own script (a translated alt may quote the English on a sign)
        if (/\b[A-Za-z]{3,}\b(?:[\s,.'’-]+\b[A-Za-z]{2,}\b)+/.test(words) && !script.test(words)) out.english.push(tag(e) + ': ' + words.trim().slice(0, 60));
      }
      for (const f of document.querySelectorAll('input:not([type=hidden]), select, textarea')) {
        if (!(f.labels && f.labels.length) && !f.getAttribute('aria-label') && !f.getAttribute('aria-labelledby')) out.noLabel.push(tag(f));
        for (const id of (f.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean)) if (!document.getElementById(id)) out.badRef.push(tag(f) + ' -> #' + id);
      }
      out.main = document.querySelectorAll('main, [role="main"]').length;
      out.banner = [...document.querySelectorAll('body > header, [role="banner"]')].length;
      out.footer = [...document.querySelectorAll('body > footer, [role="contentinfo"]')].length;
      const navs = [...document.querySelectorAll('nav, [role="navigation"]')].filter((n) => !n.closest('[aria-hidden="true"]')).map((n) => n.getAttribute('aria-label') || (document.getElementById(n.getAttribute('aria-labelledby')) || {}).textContent || '');
      out.navs = navs; out.navDup = navs.length !== new Set(navs).size || (navs.length > 1 && navs.some((n) => !n));
      let prev = 0;
      for (const h of document.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
        if (!h.checkVisibility() && !h.closest('.sr-only') && !h.classList.contains('sr-only')) continue;
        if (h.closest('[aria-hidden="true"], [hidden]')) continue;
        const lv = +h.tagName[1];
        if (prev && lv > prev + 1) out.skips.push('h' + prev + ' -> h' + lv + ' "' + h.textContent.trim().slice(0, 30) + '"');
        prev = lv;
      }
      out.h1 = document.querySelectorAll('h1').length;
      return out;
    },
  };
}

/** Tab (or Shift+Tab) from where focus is until it leaves the page; returns the stops. */
async function walk(p, back, limit) {
  const stops = [];
  for (let i = 0; i < limit; i++) {
    await p.keyboard.press(back ? 'Shift+Tab' : 'Tab');
    const s = await p.evaluate(() => window.__kb.look());
    if (!s) return { stops, ended: true };
    stops.push(s);
  }
  return { stops, ended: false };
}


const active = (p) => p.evaluate(() => { const e = document.activeElement; return e ? e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.split(' ')[0] : '') + ' "' + (e.getAttribute('aria-label') || e.innerText || e.alt || '').replace(/\s+/g, ' ').trim().slice(0, 30) + '"' : null; });
// focus the first element that matches and can be seen (as if the reader had tabbed to it)
const focusOn = (p, sel) => p.evaluate((s) => { const e = [...document.querySelectorAll(s)].find((x) => x.checkVisibility()); if (!e) return false; e.scrollIntoView({ block: 'center' }); e.focus(); return document.activeElement === e; }, sel);
const settle = (p, t = 200) => p.clock.runFor(t);

/** Back to the top with nothing focused, at this window size: the next Tab starts from the top of the page again. */
async function restart(p, vp) {
  await p.setViewportSize(vp);
  await p.evaluate(() => { document.querySelectorAll('[data-kb-seen]').forEach((e) => delete e.dataset.kbSeen); scrollTo({ top: 0, behavior: 'instant' }); const b = document.body; b.tabIndex = -1; b.focus({ preventScroll: true }); b.removeAttribute('tabindex'); });
  await settle(p);
}

/** Changes the language the way a keyboard user does: the globe button, Enter, arrow keys, Enter. */
async function switchLang(p, code) {
  await focusOn(p, '.lang-btn'); await p.keyboard.press('Enter'); await settle(p, 100);
  for (let i = 0; i < 6 && !(await p.evaluate((c) => document.activeElement.dataset.lang === c, code)); i++) await p.keyboard.press('ArrowDown');
  await p.keyboard.press('Enter');
  const done = await until(p, (w) => document.documentElement.lang === w, { en: 'en', hi: 'hi', zh: 'zh-Hans' }[code], 15000);
  await settle(p, 600);
  return { lang: await p.evaluate(() => document.documentElement.lang), done: !!done, back: await p.evaluate(() => document.activeElement.classList.contains('lang-btn')) };
}

/** Tab from the top of the page to the end, then (back: true) Shift+Tab to the top again, and what a screen reader is given. */
async function tour(p, label, vp, lang, { back = false } = {}) {
  await restart(p, vp);
  const { stops, ended } = await walk(p, false, 420);
  ok(`${label}: Tab goes from the top to the end of the page and out (no trap), ${stops.length} stops`, ended && stops.length > 20, ended ? '' : 'still inside after ' + stops.length + ' stops, at ' + (stops[stops.length - 1] || {}).d);
  ok(`${label}: the first Tab stop is the skip link`, !!stops[0] && /skip-link/.test(stops[0].d), stops[0] && stops[0].d);
  const probs = stops.filter((s) => s.probs.length).map((s) => s.d + ' "' + s.name + '": ' + s.probs.join(', '));
  ok(`${label}: focus is always visible (on screen, a ring of 3:1, not cut off, not under the header, bar or back-to-top button, not on anything invisible)`, probs.length === 0, probs.slice(0, 6).join(' | '));
  const again = stops.filter((s) => s.again);
  ok(`${label}: no stop comes twice`, again.length === 0, again.slice(0, 3).map((s) => s.d + ' "' + s.name + '"').join(', '));
  // the order follows the page: it never jumps back up by more than a screen (side-by-side columns are read top to bottom, then the next column)
  const jumps = [];
  for (let i = 1; i < stops.length; i++) { const a = stops[i - 1], b = stops[i]; if (!a.fixed && !b.fixed && b.y < a.y - vp.height) jumps.push(a.d + ' -> ' + b.d + ' (' + (b.y - a.y) + 'px)'); }
  ok(`${label}: the Tab order follows the page from top to bottom`, jumps.length === 0, jumps.slice(0, 3).join(' | '));
  const missed = await p.evaluate(() => window.__kb.missed());
  ok(`${label}: everything you can click can also be reached with Tab`, missed.length === 0, missed.slice(0, 6).join(', '));
  const sr = await p.evaluate(([l, n]) => window.__kb.reader(l, n), [lang, NAMES.source]);
  if (lang !== 'en') ok(`${label}: names and labels are in the page's language (no English left over)`, sr.english.length === 0, sr.english.slice(0, 5).join(' | '));
  ok(`${label}: every picture has alt text (empty when it is decoration)`, sr.noAlt.length === 0, sr.noAlt.slice(0, 4).join(', '));
  ok(`${label}: landmarks: one main, one header, one footer, each navigation named differently`, sr.main === 1 && sr.banner === 1 && sr.footer === 1 && !sr.navDup, JSON.stringify({ main: sr.main, header: sr.banner, footer: sr.footer, navs: sr.navs }));
  ok(`${label}: one h1, and headings do not skip a level`, sr.h1 === 1 && sr.skips.length === 0, 'h1 x' + sr.h1 + ' ' + sr.skips.slice(0, 3).join(' | '));
  ok(`${label}: every form field has a label, and its aria-describedby points at something`, sr.noLabel.length === 0 && sr.badRef.length === 0, sr.noLabel.concat(sr.badRef).join(', '));
  if (back) {   // Shift+Tab from outside the end of the page: the same stops in the opposite order, up to the skip link
    const { stops: bw } = await walk(p, true, stops.length + 5);
    const want = stops.map((s) => s.d + '|' + s.name).reverse(), got = bw.map((s) => s.d + '|' + s.name);
    const at = want.findIndex((k, i) => k !== got[i]);
    ok(`${label}: Shift+Tab from the end goes back through the same ${want.length} stops to the skip link`, at === -1, at === -1 ? '' : 'stop ' + at + ': expected ' + want[at] + ', got ' + got[at]);
  }
}

/** The phone menu and the language menu at phone width (the home page in Chinese, after its tour). */
async function phoneMenus(p) {
  await focusOn(p, '#menu-toggle'); await p.keyboard.press('Enter'); await settle(p);
  const open1 = await p.evaluate(() => ({ exp: document.querySelector('#menu-toggle').getAttribute('aria-expanded'), inMenu: !!document.activeElement.closest('#nav'), name: document.querySelector('#menu-toggle').getAttribute('aria-label') }));
  await p.keyboard.press('Escape'); await settle(p);
  const shut = await p.evaluate(() => ({ exp: document.querySelector('#menu-toggle').getAttribute('aria-expanded'), back: document.activeElement.id, name: document.querySelector('#menu-toggle').getAttribute('aria-label') }));
  ok('phone menu (Chinese): Enter opens it with focus on its first link, Escape closes it and gives focus back; the button is named in Chinese', open1.exp === 'true' && open1.inMenu && shut.exp === 'false' && shut.back === 'menu-toggle' && /[\u4e00-\u9fff]/.test(open1.name) && /[\u4e00-\u9fff]/.test(shut.name), JSON.stringify({ open1, shut }));
  await p.keyboard.press('Enter'); await settle(p);
  let last = null;
  for (let i = 0; i < 30; i++) { await p.keyboard.press('Tab'); last = await p.evaluate(() => ({ inMenu: !!document.activeElement.closest('#nav'), at: document.activeElement.tagName })); if (!last.inMenu) break; }
  ok('phone menu: Tab goes through the open menu and out of it (no trap)', !!last && !last.inMenu, JSON.stringify(last));
  // Tab past the menu's last link reaches the globe button in the header: the menu is still open around it
  await focusOn(p, '.lang-btn'); await p.keyboard.press('Enter'); await settle(p);
  const zl = await p.evaluate(() => ({ menu: document.querySelector('#menu-toggle').getAttribute('aria-expanded'), exp: document.querySelector('.lang-btn').getAttribute('aria-expanded'), focus: document.activeElement.getAttribute('data-lang') }));
  await p.keyboard.press('Escape'); await settle(p);
  const zl2 = await p.evaluate(() => ({ menu: document.querySelector('#menu-toggle').getAttribute('aria-expanded'), exp: document.querySelector('.lang-btn').getAttribute('aria-expanded'), on: document.activeElement.className }));
  ok('language menu inside the open phone menu: Enter opens it on the current language; Escape closes only the language list, focus back on the globe button', zl.exp === 'true' && zl.focus === 'zh' && zl2.exp === 'false' && /lang-btn/.test(zl2.on) && (zl.menu !== 'true' || zl2.menu === 'true'), JSON.stringify({ zl, zl2 }));
  if (zl2.menu === 'true') {
    await p.keyboard.press('Escape'); await settle(p);
    ok('phone menu: a second Escape closes the menu too, focus on the menu button', await p.evaluate(() => document.querySelector('#menu-toggle').getAttribute('aria-expanded') === 'false' && document.activeElement.id === 'menu-toggle'), await active(p));
  }
  // motion on: the hero, the tractor and the countdowns never take focus
  await p.emulateMedia({ reducedMotion: 'no-preference' });
  await focusOn(p, '#goat-btn'); const parked = await active(p);
  await p.clock.runFor(4000);
  ok('motion on: focus stays where it was put for 4 s', (await active(p)) === parked, await active(p));
  await p.emulateMedia({ reducedMotion: 'reduce' });
}

/** Each control with its own keys (the home page on a big screen in English, after its tour). */
async function controls(p) {
  await restart(p, WIDE);
  await p.keyboard.press('Tab'); await p.keyboard.press('Enter'); await settle(p);
  const onMain = await p.evaluate(() => document.activeElement.id === 'main');
  await p.keyboard.press('Tab');
  ok('skip link: Enter moves focus to the main content, and the next Tab stays in it', onMain && await p.evaluate(() => !!document.activeElement.closest('main')), await active(p));

  await focusOn(p, '.nav-more-btn'); await p.keyboard.press('Enter'); await settle(p);
  const more = await p.evaluate(() => document.querySelector('.nav-more-btn').getAttribute('aria-expanded'));
  await p.keyboard.press('Tab'); const inside = await p.evaluate(() => !!document.activeElement.closest('.nav-more-list'));
  await p.keyboard.press('Escape'); await settle(p);
  ok('"More" menu: Enter opens it, Tab goes into it, Escape closes it and gives focus back to the button', more === 'true' && inside && await p.evaluate(() => document.querySelector('.nav-more-btn').getAttribute('aria-expanded') === 'false' && document.activeElement.classList.contains('nav-more-btn')), JSON.stringify({ more, inside, now: await active(p) }));
  await p.keyboard.press('Enter'); await settle(p);
  for (let i = 0; i < 12; i++) await p.keyboard.press('Tab');
  await settle(p);
  ok('"More" menu: tabbing out of it closes it', await p.evaluate(() => document.querySelector('.nav-more-btn').getAttribute('aria-expanded') === 'false'), await active(p));

  await focusOn(p, '.lang-btn'); await p.keyboard.press('Enter'); await settle(p);
  const l1 = await active(p); await p.keyboard.press('ArrowDown'); const l2 = await active(p);
  await p.keyboard.press('Escape'); await settle(p);
  ok('language menu: Enter opens it with focus on a language, ArrowDown moves, Escape closes it and gives focus back', l1 !== l2 && await p.evaluate(() => document.querySelector('.lang-btn').getAttribute('aria-expanded') === 'false' && document.activeElement.classList.contains('lang-btn')), [l1, l2, await active(p)].join(' / '));

  await focusOn(p, '.season-switch [role="radio"][aria-checked="true"]');
  const s0 = await p.evaluate(() => document.activeElement.dataset.season); await p.keyboard.press('ArrowRight'); await settle(p, 500);
  const s1 = await p.evaluate(() => ({ focus: document.activeElement.dataset.season, checked: document.activeElement.getAttribute('aria-checked') }));
  ok('hero season picker: ArrowRight moves to the next season and picks it', !!s1.focus && s1.focus !== s0 && s1.checked === 'true', JSON.stringify({ s0, s1 }));
  await p.keyboard.press('ArrowLeft'); await settle(p, 500);

  for (const [sel, name] of [['#season-tabs [role="tab"][aria-selected="true"]', 'season tabs'], ['#group-tabs [role="tab"][aria-selected="true"]', 'group tabs']]) {
    await focusOn(p, sel); const t0 = await active(p); await p.keyboard.press('ArrowRight'); await settle(p);
    const st = await p.evaluate(() => { const t = document.activeElement, pan = document.getElementById(t.getAttribute('aria-controls')); return { role: t.getAttribute('role'), selected: t.getAttribute('aria-selected'), panel: !!pan && !pan.hidden }; });
    await p.keyboard.press('Tab');
    const out = await p.evaluate(() => document.activeElement.getAttribute('role') !== 'tab');
    ok(`${name}: ArrowRight moves to the next tab and shows its panel; Tab then leaves the tab row`, st.role === 'tab' && st.selected === 'true' && st.panel && out, JSON.stringify({ t0, st, out }));
  }

  for (const [sel, name] of [['#gallery button[aria-haspopup="dialog"]', 'gallery photo'], ['img[data-zoom]', 'photo in the page']]) {
    const found = await focusOn(p, sel), opener = await active(p);
    await p.keyboard.press('Enter'); await settle(p);
    const st = await p.evaluate(() => { const d = document.querySelector('dialog[open]'); return { open: !!d, inside: !!d && d.contains(document.activeElement), modal: !!d && d.matches(':modal') }; });
    const trail = [];
    for (let i = 0; i < 4; i++) { await p.keyboard.press('Tab'); trail.push(await p.evaluate(() => { const d = document.querySelector('dialog[open]'), a = document.activeElement; return !d ? 'closed' : d.contains(a) ? 'in' : a === document.body ? 'browser' : 'PAGE ' + a.tagName; })); }
    await p.keyboard.press('Escape'); await settle(p);
    const back = await active(p);
    ok(`photo viewer from a ${name}: Enter opens it with focus inside, Tab never reaches the page behind, Escape closes it and focus is back on the photo`, found && st.open && st.inside && st.modal && !trail.some((t) => /PAGE|closed/.test(t)) && back === opener && await p.evaluate(() => !document.querySelector('dialog[open]')), JSON.stringify({ st, trail, opener, back }));
  }

  await focusOn(p, '.faq-list summary'); await p.keyboard.press('Enter'); const o1 = await p.evaluate(() => document.activeElement.parentElement.open);
  await p.keyboard.press(' '); const o2 = await p.evaluate(() => document.activeElement.parentElement.open);
  ok('FAQ: Enter opens a question, Space closes it', o1 === true && o2 === false);

  await focusOn(p, '#farm-map .map-legend button'); await p.keyboard.press('Enter'); await settle(p);
  const map = await p.evaluate(() => { const b = document.activeElement, d = document.querySelector('#farm-map .map-detail'); return { pressed: b.getAttribute('aria-pressed'), card: d && !d.hidden ? d.textContent.trim().slice(0, 40) : '', live: d && (d.getAttribute('aria-live') || d.getAttribute('role')) }; });
  ok('farm map: Enter on a place shows its card, which a screen reader hears (polite live region)', map.pressed === 'true' && map.card.length > 2 && /polite|status/.test(map.live || ''), JSON.stringify(map));

  if (await focusOn(p, '[data-rel-remind]')) {
    await p.keyboard.press('Enter'); await settle(p);
    const exp = await p.evaluate(() => document.querySelector('[data-rel-remind]').getAttribute('aria-expanded'));
    await p.keyboard.press('Tab'); const first = await active(p);
    await p.keyboard.press('Escape'); await settle(p);
    ok('"Remind me": Enter opens the choices, Tab reaches the first one, Escape closes them and gives focus back', exp === 'true' && /calendar|ics/i.test(first) && await p.evaluate(() => document.activeElement.matches('[data-rel-remind]') && document.activeElement.getAttribute('aria-expanded') === 'false'), JSON.stringify({ exp, first, now: await active(p) }));
  } else info('no "Remind me" button on this date');

  for (const sel of ['.filter-btn[data-filter]', '#gallery .filter-btn', '.fs-btn']) {
    const found = await focusOn(p, sel + ':not([aria-pressed="true"])');
    if (found) { await p.keyboard.press('Enter'); await settle(p); }
    ok(`filter buttons ${sel}: Enter picks one (aria-pressed)`, found && await p.evaluate(() => document.activeElement.getAttribute('aria-pressed') === 'true'), await active(p));
  }

  await focusOn(p, '.bq-flower'); await p.keyboard.press('Enter'); await p.keyboard.press(' '); await settle(p);
  ok('bouquet game: Enter and Space add flowers, and the count is read out (live region)', await p.evaluate(() => { const m = document.querySelector('#bq-msg'); return /2/.test(m.textContent) && m.getAttribute('aria-live') === 'polite'; }), await p.evaluate(() => document.querySelector('#bq-msg').textContent));
  const g0 = await p.evaluate(() => document.querySelector('#goat-bubble').textContent);
  await focusOn(p, '#goat-btn'); await p.keyboard.press('Enter'); await settle(p);
  ok('goat game: Enter makes the goat answer, read out by the live region', await p.evaluate((g) => { const b = document.querySelector('#goat-bubble'); return b.textContent !== g && b.getAttribute('aria-live') === 'polite'; }, g0));
  for (const [id, msg] of [['#pick-btn', '#pick-msg'], ['#npc-btn', '#npc-live']]) {
    const m0 = await p.evaluate((m) => document.querySelector(m).textContent, msg);
    await focusOn(p, id); await p.keyboard.press('Enter'); await settle(p, 600);
    ok(`hero scene: the ${id} button does with a key what tapping the drawing does, and says what happened (role="status")`, await p.evaluate(([m, t]) => { const e = document.querySelector(m); return e.textContent.trim() !== t.trim() && e.textContent.trim().length > 2 && e.getAttribute('role') === 'status'; }, [msg, m0]));
  }
  ok('hero scene drawing: hidden from screen readers and never takes focus (the two buttons above are its keyboard way in)', await p.evaluate(() => { const s = document.querySelector('#hero-scene'); return !!s && s.getAttribute('aria-hidden') === 'true' && ![...s.querySelectorAll('a, button, input, [tabindex]')].some((e) => e.tabIndex >= 0); }));

  await focusOn(p, '#drive-addr'); await p.keyboard.type('ab'); await p.keyboard.press('Enter'); await settle(p);
  const drive = await p.evaluate(() => { const i = document.querySelector('#drive-addr'), ids = (i.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean); return { invalid: i.getAttribute('aria-invalid'), said: ids.map((x) => (document.getElementById(x) || {}).textContent || '').join(' ').trim(), live: ids.some((x) => /polite|assertive/.test((document.getElementById(x) || { getAttribute: () => '' }).getAttribute('aria-live') || '')), focus: document.activeElement.id }; });
  ok('drive time: a too-short address is marked invalid, the message is tied to the field and read out, focus stays in the field', drive.invalid === 'true' && drive.said.length > 5 && drive.live && drive.focus === 'drive-addr', JSON.stringify(drive));

  await focusOn(p, '#su-email'); await p.keyboard.type('not-an-email'); await p.keyboard.press('Enter'); await settle(p, 600);
  const su = await p.evaluate(() => { const i = document.querySelector('#su-email'), ids = (i.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean), m = document.querySelector('[data-signup-msg]'); return { invalid: i.getAttribute('aria-invalid'), said: ids.map((x) => (document.getElementById(x) || {}).textContent || '').join(' ').trim(), msg: m.textContent.trim(), live: m.getAttribute('aria-live') }; });
  ok('signup: a wrong email is marked invalid, and its error text is tied to the field (aria-describedby) and read out', su.invalid === 'true' && su.said.length > 5 && su.said === su.msg && su.live === 'polite', JSON.stringify(su));

  // live regions that change by themselves must not talk every second (the countdowns are role="timer", which is silent)
  await p.evaluate(() => {
    window.__talk = new Map();
    const live = '[aria-live="polite"], [aria-live="assertive"], [role="status"], [role="alert"], [role="log"]';
    new MutationObserver((ms) => { for (const m of ms) { const n = m.target.nodeType === 1 ? m.target : m.target.parentElement, r = n && n.closest(live); if (r && r.getAttribute('aria-live') !== 'off') { const k = r.id || r.className; window.__talk.set(k, (window.__talk.get(k) || 0) + 1); } } }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  // and nothing moves focus by itself
  await focusOn(p, '.faq-list summary'); const parked = await active(p);
  await p.clock.runFor(4000);
  const talk = await p.evaluate(() => [...window.__talk].filter(([, n]) => n > 2).map(([k, n]) => k + ' x' + n));
  ok('no live region speaks on its own every second (4 s with nothing pressed)', talk.length === 0, talk.join(', '));
  ok('the countdowns are role="timer", not polite or assertive live regions', await p.evaluate(() => document.querySelectorAll('[role="timer"]').length > 0 && [...document.querySelectorAll('[role="timer"]')].every((t) => !/polite|assertive/.test(t.getAttribute('aria-live') || ''))));
  ok('reduced motion: focus stays where it was put for 4 s', (await active(p)) === parked, await active(p));
}

await run('keyboard', async ({ browser, base, errs }) => {
  // English on a big screen, then Hindi or Chinese on a phone; on the home page also every control with its keys, and the phone menus
  const t0 = Date.now(), took = () => Math.round((Date.now() - t0) / 1000) + ' s';
  for (const [url, other] of PAGES) {
    const p = await open(browser, base, url, errs, { viewport: WIDE, reducedMotion: 'reduce', extra: url === 'index.html' ? 'WISE_ACRES.signup.demo = true;' : undefined });
    await p.evaluate(helpers);
    await tour(p, `${url} en 1280px`, WIDE, 'en', { back: url === 'pumpkin-patch.html' });
    if (url === 'index.html') { await controls(p); info('home page controls done after ' + took()); }
    const sw = await switchLang(p, other);
    ok(`${url}: the language menu switches the page to ${other} with the keyboard (Enter, arrow keys, Enter), focus back on the globe button`, sw.done && sw.back, JSON.stringify(sw));
    await tour(p, `${url} ${other} 390px`, PHONE, other);
    if (url === 'index.html') await phoneMenus(p);
    await p.context().close();
    info(url + ' done after ' + took());
  }
});
