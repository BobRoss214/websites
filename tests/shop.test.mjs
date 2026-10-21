// order: 325
// browser: yes
// covers: index.html, css/*, lang/*, js/i18n.js, js/main.js, tests/shop-list.json, tests/layout-audit.mjs
/* "What to buy" (the products section, #shop in index.html), checked against the farm's own products list: tests/shop-list.json, made from SHOP-LIST.md by
 * tests/shop-list.make.mjs. The page maker's work is never used to decide what is right; prices are shown to the public, so a second author checks them.
 *   1  every product of the list is on the page exactly once, in its group, with its name; no card the list does not have (the few extra cards that the
 *      published page had before are named in the list file); the groups are the list's groups
 *   2  the prices: the dollar amounts of each card are the list's (with their small words: small / large, 1 scoop, 8 oz, a pound), a price the farm has not
 *      confirmed shows the page's own "Prices coming soon" and no dollar sign, free things say free, and no number appears that the list does not give
 *   3  the pictures: every <use href="#p-..."> has its <symbol>, none is empty, each card shows the picture of its own product, no picture serves two
 *   4  words that must never be there, in any language: phone numbers, the elderberry brand's health claims and dose figures, the maker's own name
 *   5  the five languages: the same dollar amounts on every card, every text block has its translation, no English left over
 *   6  links: every #shop... link in the site's html pages has its target; each jump button lands its group under the sticky header
 *   7  layout at 320, 360, 390, 768, 1024, 1366 and 1920 px wide (and the long languages on a phone): nothing sideways, no cut text, 2 / 3 / 4 columns
 *   8  reading aids: pictures hidden from screen readers, every card in a list item, heading order, readable price text (and axe, when it is installed)
 *   9  (information) how tall #shop is on a computer and on a phone
 * The names of the page's own parts (the class names) are in SEL below: if the markup is renamed, change them there and nowhere else. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, open, ok, info, until, settled, axeSource, ROOT, ms } from './lib.mjs';
import { auditLayout } from './layout-audit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIST = JSON.parse(fs.readFileSync(path.join(HERE, 'shop-list.json'), 'utf8'));
const PRODUCTS = LIST.products, GROUPS = LIST.groups, EXTRAS = LIST.extras || [];
const LANGS = ['en', 'es', 'hi', 'zh', 'vi'];
const WIDTHS = [1366, 1920, 1024, 768, 390, 360, 320];   // the first one gets every check; the others get the layout checks
const SEL = { card: '.shop-card', group: '.shop-group', groupHead: '.shop-band-h', name: '.shop-name', jump: '.shop-jump a', grid: '.shop-grid', full: '.shop-full' };
const STILL = '.reveal{opacity:1!important;transform:none!important}*{animation:none!important;transition:none!important}html{scroll-behavior:auto!important}html.cv .cv-sec{content-visibility:visible!important}';

/* ------------------------------------------------------------------ small helpers (Node side) */
const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const norm = (s) => clean(s).toLowerCase().replace(/&amp;|&/g, ' and ').replace(/[\u2018\u2019`]/g, "'").replace(/[^a-z0-9' -]+/g, ' ').replace(/\s+/g, ' ').trim();   // "Beer, hard cider & wine" == "beer hard cider and wine"
const digits = (s) => String(s).replace(/[\u0966-\u096f]/g, (c) => String(c.charCodeAt(0) - 0x966)).replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/[\uff10-\uff19]/g, (c) => String(c.charCodeAt(0) - 0xff10));
const numOf = (s) => Number(String(s).replace(/^[.,]/, '0.').replace(',', '.'));
// every dollar amount in a text: "$5", "$1.25", "$.84", "$ 4", "5$", "US$5", "5 USD", "5 dólares", "5 đô la", "5美元", "5 डॉलर"
function amountsIn(text) {
  const t = digits(text), out = [];
  for (const m of t.matchAll(/(?:US)?\$\s*(\d+(?:[.,]\d{1,2})?|[.,]\d{1,2})(?![\d])/g)) out.push(numOf(m[1]));
  for (const m of t.matchAll(/(\d+(?:[.,]\d{1,2})?)\s*(?:US\$|USD|\$|dólares?|dollars?|đô la|đô|美元|美金|डॉलर)/gi)) out.push(numOf(m[1]));
  return out.sort((a, b) => a - b);
}
const same = (a, b) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 0.001);
// is every number of `small` in `big` (as a multiset)?
function within(small, big) { const rest = [...big]; for (const x of small) { const i = rest.findIndex((y) => Math.abs(y - x) < 0.001); if (i < 0) return false; rest.splice(i, 1); } return true; }
const rest = (small, big) => { const r = [...big]; for (const x of small) { const i = r.findIndex((y) => Math.abs(y - x) < 0.001); if (i >= 0) r.splice(i, 1); } return r; };
const few = (list, n = 6) => (list.length <= n ? list : [...list.slice(0, n), `(+${list.length - n} more)`]).join(' | ');
const numbersIn = (s) => [...digits(s).replace(/\$\s*\d*\.?\d+/g, ' ').matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => String(numOf(m[0])));   // numbers that are not dollar amounts, "4.00" == "4"
const slugOf = (name) => PRODUCTS.find((p) => norm(p.name) === norm(name));

/* The sentences in the list file give the words the page must use for a price nobody has confirmed. The page already has them (lang/en.json); the test
   finds their key there, so the other languages can be checked against the page's own translation of the same words. */
const EN_JSON = JSON.parse(fs.readFileSync(path.join(ROOT, 'lang/en.json'), 'utf8'));
const UNKNOWN_KEY = Object.keys(EN_JSON).find((k) => EN_JSON[k] === LIST.unknownWords) || '';

/* ------------------------------------------------------------------ words that must never be on the page (any language) */
const FORBIDDEN = [
  ['a phone number', (t) => { const d = digits(t); return /(?:\+?\d{1,2}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]\d{3}[\s.-]\d{4}/.test(d) || /(?<![\d.,])\d{10,11}(?![\d.,])/.test(d) || /\btel:/i.test(t) || /\bwhatsapp\b/i.test(t); }],
  ['"immune" / immunity', (t) => /immun|miễn dịch|免疫|प्रतिरक्ष|रोग.?प्रतिरोध|इम्यून/i.test(t)],
  ['"antiviral"', (t) => /anti[\s-]?vir|kháng vi|抗病毒|एंटी.?वायरल|विषाणु/i.test(t)],
  ['"inflammatory"', (t) => /inflam|viêm|炎症|抗炎|消炎|इन्?फ्लेमे|सूजन/i.test(t)],
  ['"antioxidant"', (t) => /anti[\s-]?ox|chống oxy|chống oxi|抗氧化|एंटी.?ऑक्?सी|एंटी.?ओक्?सी/i.test(t)],
  ['a dose ("1,500 mg", "1,440 mg", any "mg")', (t) => /\d\s*(?:mg|milligram|miligramo|毫克|मिलीग्राम)\b/i.test(digits(t)) || /\b1[,.\s]?(?:500|440)\s*(?:mg|milligram|miligramo|毫克|मिलीग्राम)/i.test(digits(t))],
  ['"cure" / "heals"', (t) => /\bcure[sd]?\b|\bcuring\b|\bheal(?:s|ed|ing)?\b|\b(?:cura|curar|sana|sanar|sanan)\b|chữa|治愈|治疗|治病|疗效|治好|इलाज|उपचार|ठीक करत/i.test(t)],
  ['a health claim (flu, cold and flu, medicine, remedy)', (t) => /\bflu\b|\bcold\s*(?:&|and)\s*flu\b|\bmedicin|\bremed(?:y|ies)\b|\bgripe\b|cúm|流感|感冒|फ्लू|जुकाम/i.test(t)],
  ['the name "Wayne Hansen"', (t) => /wayne\s+hansen|\bhansen\b|韦恩|汉森|हैनसन|हेंसन|हैन्सन/i.test(t)],
];
const forbiddenIn = (t) => FORBIDDEN.filter(([, f]) => f(t)).map(([what]) => what);

/* ------------------------------------------------------------------ the page's #shop in the html file (no browser): raw words, attributes, comments */
function sectionOf(html, id) {
  const open = new RegExp('<section\\b[^>]*\\bid="' + id + '"[^>]*>').exec(html);
  if (!open) return '';
  let depth = 0;
  const re = /<(\/?)section\b[^>]*>/g;
  re.lastIndex = open.index;
  for (let m; (m = re.exec(html)); ) { depth += m[1] ? -1 : 1; if (depth === 0) return html.slice(open.index, m.index + m[0].length); }
  return html.slice(open.index);
}
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SHOP_SRC = sectionOf(INDEX, 'shop');
function htmlFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (/^(\.git|node_modules|tests|\.visual|docs)$/.test(e.name)) continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) htmlFiles(f, out); else if (/\.html$/.test(e.name)) out.push(f);
  }
  return out;
}

/* ------------------------------------------------------------------ the page side: functions sent to the browser as text, so they use nothing from this file */
function readShop(SEL) {
  const shop = document.getElementById('shop');
  const clean = (s) => String(s).replace(/\s+/g, ' ').trim();
  const textOf = (root, skipBrand) => {          // the words of a part, with a space at every edge between two parts (so "1 scoop" + "$4" is "1 scoop $4")
    let out = '';
    (function walk(n) {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) out += c.data;
        else if (c.nodeType === 1) {
          const t = c.tagName.toLowerCase();
          if (t === 'script' || t === 'style' || t === 'template' || t === 'svg') continue;
          if (skipBrand && (t === 'wa-en' || c.getAttribute('lang') === 'en')) { out += ' '; continue; }   // the farm's own names stay English in every language
          out += ' '; if (t !== 'br') walk(c); out += ' ';
        }
      }
    })(root);
    return clean(out);
  };
  const attrText = [];
  shop.querySelectorAll('*').forEach((e) => { for (const a of e.attributes) if (/^(aria-label|title|alt|placeholder|href|content|value)$/.test(a.name)) attrText.push(a.value); });
  const cards = [...shop.querySelectorAll(SEL.card)].map((c, i) => {
    const g = c.closest(SEL.group), h = g && g.querySelector(SEL.groupHead), n = c.querySelector(SEL.name);
    return {
      i, group: h ? clean(h.textContent) : '', groupId: g ? g.id : '', name: n ? textOf(n) : '', text: textOf(c),
      uses: [...c.querySelectorAll('use')].map((u) => u.getAttribute('href') || u.getAttribute('xlink:href') || ''),
      keys: [...c.querySelectorAll('[data-t]')].map((e) => ({ key: e.getAttribute('data-t'), text: textOf(e), plain: textOf(e, true), tag: e.tagName.toLowerCase() })),
      links: [...c.querySelectorAll('a')].map((a) => a.getAttribute('href') || ''),
      inLi: !!c.closest('li') && ['UL', 'OL'].includes((c.closest('li').parentElement || {}).tagName),
    };
  });
  // text with letters that no data-t block holds (it would stay English in every language), and attributes with words but no translation
  const stray = [], strayAttrs = [];
  const w = document.createTreeWalker(shop, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const p = n.parentElement;
    if (!p || p.closest('[data-t], svg, script, style, template')) continue;
    if (/[A-Za-z\u00c0-\u024f]{2,}/.test(n.data)) stray.push(clean(n.data).slice(0, 50));
  }
  shop.querySelectorAll('[aria-label],[title],[alt]').forEach((e) => {
    for (const a of ['aria-label', 'title', 'alt']) { const v = e.getAttribute(a); if (v && /[A-Za-z]{2,}/.test(v) && !e.hasAttribute('data-ta-' + a)) strayAttrs.push(a + '="' + v.slice(0, 40) + '"'); }
  });
  const dict = (window.WISE_ACRES && WISE_ACRES.dict && WISE_ACRES.dict[WISE_ACRES.lang] && WISE_ACRES.dict[WISE_ACRES.lang].ui) || null;
  const has = (k) => !!dict && Object.prototype.hasOwnProperty.call(dict, k) && typeof dict[k] === 'string' && dict[k].trim() !== '';
  const keyList = [...new Set([...shop.querySelectorAll('[data-t]')].map((e) => e.getAttribute('data-t')))];
  const attrKeys = [...new Set([...shop.querySelectorAll('*')].flatMap((e) => [...e.attributes].filter((a) => a.name.indexOf('data-ta-') === 0).map((a) => a.value)))];
  return {
    lang: window.WISE_ACRES ? WISE_ACRES.lang : '', htmlLang: document.documentElement.lang, cards, stray, strayAttrs,
    groups: [...shop.querySelectorAll(SEL.group)].map((g) => { const h = g.querySelector(SEL.groupHead); return { id: g.id, head: h ? clean(h.textContent) : '', tag: h ? h.tagName.toLowerCase() : '', cards: g.querySelectorAll(SEL.card).length }; }),
    pills: [...shop.querySelectorAll(SEL.jump)].map((a) => ({ href: a.getAttribute('href') || '', text: clean(a.textContent) })),
    headings: [...shop.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => ({ tag: h.tagName.toLowerCase(), text: clean(h.textContent) })),
    allText: textOf(shop) + ' ' + attrText.join(' '), shopText: textOf(shop),
    keys: keyList, attrKeys, missing: keyList.filter((k) => !has(k)), missingAttr: attrKeys.filter((k) => !has(k)),
    dictText: Object.fromEntries(keyList.filter(has).map((k) => [k, dict[k].replace(/<svg\/>/g, '').replace(/<\/?a\d*>/g, '').replace(/<br\s*\/?>/g, ' ').replace(/\s+/g, ' ').trim()])),
    svgBare: [...shop.querySelectorAll('svg')].filter((s) => s.getAttribute('aria-hidden') !== 'true' && !(s.getAttribute('role') === 'img' && (s.getAttribute('aria-label') || s.querySelector('title')))).map((s) => (s.getAttribute('class') || 'svg') + ' ' + ((s.querySelector('use') || {getAttribute: () => ''}).getAttribute('href') || '')),
    reveal: [...shop.querySelectorAll('.reveal')].map((e) => Math.round(parseFloat(getComputedStyle(e).opacity) * 100) / 100),
  };
}
function readOutside() {   // the words of the page without #shop (for "the page's existing wording")
  const copy = document.body.cloneNode(true);
  const s = copy.querySelector('#shop'); if (s) s.remove();
  copy.querySelectorAll('script,style,svg,template').forEach((e) => e.remove());
  return copy.textContent.replace(/\s+/g, ' ');
}
function readSymbols(expected) {
  const sym = (id) => { const e = document.getElementById(id); return e && e.tagName.toLowerCase() === 'symbol' ? e : null; };
  const uses = [...document.querySelectorAll('use')].map((u) => (u.getAttribute('href') || u.getAttribute('xlink:href') || '').replace(/^#/, '')).filter(Boolean);
  const probe = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  probe.setAttribute('width', '0'); probe.setAttribute('height', '0'); probe.style.cssText = 'position:absolute;visibility:hidden;overflow:hidden';
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); probe.appendChild(g); document.body.appendChild(probe);
  const info = (id) => {
    const s = sym(id);
    if (!s) return { id, found: false };
    const shapes = s.querySelectorAll('path,circle,ellipse,rect,polygon,polyline,line,image,use,text').length;
    const vb = (s.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
    let area = 0;
    try { g.textContent = ''; [...s.childNodes].forEach((c) => g.appendChild(c.cloneNode(true))); const b = g.getBBox(); area = vb.length === 4 && vb[2] > 0 && vb[3] > 0 ? (b.width * b.height) / (vb[2] * vb[3]) : (b.width && b.height ? 1 : 0); } catch (e) { area = 0; }
    return { id, found: true, shapes, hasViewBox: vb.length === 4 && vb.every((n) => Number.isFinite(n)) && vb[2] > 0 && vb[3] > 0, area: Math.round(area * 100) / 100, markup: s.innerHTML.replace(/\s+/g, ' ') };
  };
  const list = expected.map(info);
  probe.remove();
  const missingUses = [...new Set(uses.filter((id) => !document.getElementById(id) || (id.indexOf('p-') === 0 && !sym(id))))];
  const pSymbols = [...document.querySelectorAll('symbol[id^="p-"]')].map((s) => s.id);
  return { list, missingUses, pSymbols, usesInShop: [...document.querySelectorAll('#shop use')].map((u) => (u.getAttribute('href') || '').replace(/^#/, '')) };
}
function readLayout(SEL) {
  const shop = document.getElementById('shop'), de = document.documentElement, vw = de.clientWidth;
  const grids = [...shop.querySelectorAll(SEL.grid)].map((g) => {
    const cards = [...g.children].filter((c) => c.matches(SEL.card) && !c.matches(SEL.full));
    if (cards.length < 4) return null;
    const t0 = cards[0].getBoundingClientRect().top;
    return { id: (g.closest(SEL.group) || {}).id || '', cards: cards.length, cols: cards.filter((c) => Math.abs(c.getBoundingClientRect().top - t0) < 4).length };
  }).filter(Boolean);
  // text parts that cut their own words: wider or taller inside than their box (clipped, shortened with "...", or a fixed height that is too small)
  const cut = [];
  const sel = (e) => { const p = e.parentElement; return e.tagName.toLowerCase() + '.' + String(e.className || '').trim().split(/\s+/).slice(0, 2).join('.') + (p && p.className ? ' in ' + String(p.className).trim().split(/\s+/)[0] : ''); };
  shop.querySelectorAll('*').forEach((e) => {
    if (e.closest('svg')) return;
    if (![...e.childNodes].some((n) => n.nodeType === 3 && n.data.trim())) return;
    const cs = getComputedStyle(e);
    if (cs.display === 'inline' || cs.display === 'contents') return;
    const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
    if (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + Math.max(6, e.clientHeight * 0.12)) cut.push(`${sel(e)} "${clean(e.textContent).slice(0, 30)}" content ${e.scrollWidth}x${e.scrollHeight} in a box ${e.clientWidth}x${e.clientHeight}`);
    function clean(s) { return String(s).replace(/\s+/g, ' ').trim(); }
  });
  const sh = shop.getBoundingClientRect();
  return { vw, innerWidth: window.innerWidth, pageW: de.scrollWidth, shopW: shop.scrollWidth, shopClientW: shop.clientWidth, shopH: Math.round(sh.height), shopLeft: Math.round(sh.left), shopRight: Math.round(sh.right), grids, cut };
}
function contrastOf() {   // the text colour against what is behind it, for every part that carries a price, "Prices coming soon" or "Free"
  const lum = (r, g, b) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const parse = (c) => { const m = c.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
  const behind = (el) => {
    const layers = []; let image = false;
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n); const c = parse(cs.backgroundColor);
      if (cs.backgroundImage !== 'none') image = true;
      if (c.a > 0) { layers.push(c); if (c.a >= 1) break; }
    }
    let base = { r: 255, g: 255, b: 255 };
    for (const c of layers.reverse()) base = { r: c.r * c.a + base.r * (1 - c.a), g: c.g * c.a + base.g * (1 - c.a), b: c.b * c.a + base.b * (1 - c.a) };
    return { base, image };
  };
  const out = [];
  document.querySelectorAll('#shop *').forEach((e) => {
    if (e.closest('svg') || ![...e.childNodes].some((n) => n.nodeType === 3 && /\$\s*\d|prices coming soon|^\s*free\s*$/i.test(n.data))) return;
    if (!e.getClientRects().length) return;
    const cs = getComputedStyle(e), fg = parse(cs.color), bg = behind(e);
    const a = fg.a, mix = { r: fg.r * a + bg.base.r * (1 - a), g: fg.g * a + bg.base.g * (1 - a), b: fg.b * a + bg.base.b * (1 - a) };
    const l1 = lum(mix.r, mix.g, mix.b), l2 = lum(bg.base.r, bg.base.g, bg.base.b), ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const px = parseFloat(cs.fontSize), large = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
    out.push({ text: e.textContent.replace(/\s+/g, ' ').trim().slice(0, 24), ratio: Math.round(ratio * 100) / 100, need: large ? 3 : 4.5, image: bg.image, px });
  });
  return out;
}

/* ------------------------------------------------------------------ waiting for scrolls */
async function scrolled(p, cap = 6000) {   // until the page has stopped moving (a smooth scroll to a link takes a moment)
  let last = -1, still = 0; const end = Date.now() + ms(cap);
  while (still < 4 && Date.now() < end) { const y = await p.evaluate(() => Math.round(window.scrollY)); still = y === last ? still + 1 : 0; last = y; await p.waitForTimeout(60); }
  return last;
}
async function throughShop(p) {   // scroll down the whole section once, like a visitor, so everything that reveals itself on the way has done so
  const box = await p.evaluate(() => { const s = document.getElementById('shop'), r = s.getBoundingClientRect(); return { top: r.top + window.scrollY, h: r.height, vh: window.innerHeight }; });
  for (let y = box.top - box.vh * 0.3; y < box.top + box.h; y += box.vh * 0.6) { await p.evaluate((v) => window.scrollTo(0, v), Math.max(0, Math.round(y))); await p.waitForTimeout(50); }
  await p.evaluate((v) => window.scrollTo(0, v), Math.round(box.top));
  await settled(p, 300);
}
async function openShop(browser, base, errs, o = {}) {
  const p = await open(browser, base, 'index.html', errs, { viewport: { width: o.w || 1366, height: o.h || 900 }, lang: o.lang });
  if (o.lang && o.lang !== 'en') await until(p, (c) => window.WISE_ACRES && WISE_ACRES.lang === c && !!WISE_ACRES.dict[c], o.lang, 20000);
  await until(p, () => !!document.getElementById('shop'), null, 20000);
  return p;
}

/* ================================================================== the checks that need no browser */
{
  const slugs = PRODUCTS.map((p) => p.slug);
  ok('the list file is sane: 12 groups, every product in one group, no slug twice, a price rule and a picture for each', GROUPS.length === 12 && new Set(slugs).size === slugs.length && PRODUCTS.every((p) => GROUPS.some((g) => g.n === p.group && g.slugs.includes(p.slug)) && p.symbols.length && (p.unknown || p.free || p.amounts.length)) && GROUPS.every((g) => g.slugs.every((s) => slugs.includes(s))), `${PRODUCTS.length} products`);
  info(`the list: ${PRODUCTS.length} products in ${GROUPS.length} groups; ${PRODUCTS.filter((p) => p.unknown).length} have no confirmed price ("${LIST.unknownWords}"), ${PRODUCTS.filter((p) => p.free).length} are free; ${EXTRAS.length} extra cards are allowed because the published page already had them (${EXTRAS.map((e) => e.name).join(', ')})`);
  ok(`the words for an unconfirmed price ("${LIST.unknownWords}") are in the page's own text list (lang/en.json)`, !!UNKNOWN_KEY, UNKNOWN_KEY || 'not found');
  ok('index.html has the section #shop (the products)', SHOP_SRC.length > 2000, `${SHOP_SRC.length} characters`);

  // the words in the html and in every translation of the page's #shop (also what is hidden: attributes, comments)
  const keys = [...new Set([...SHOP_SRC.matchAll(/\bdata-t="([^"]+)"/g)].map((m) => m[1]).concat([...SHOP_SRC.matchAll(/\bdata-ta-[a-z-]+="([^"]+)"/g)].map((m) => m[1])))];
  const texts = [['English html', SHOP_SRC.replace(/<svg[\s\S]*?<\/svg>/g, ' ')]];
  for (const code of LANGS.slice(1)) {
    let ui = {};
    try { ui = JSON.parse(fs.readFileSync(path.join(ROOT, 'lang/src', code + '.json'), 'utf8')).ui || {}; } catch (e) { /* none */ }
    texts.push([code + ' texts', keys.map((k) => ui[k] || '').join(' \n ')]);
  }
  const bad = texts.flatMap(([where, t]) => forbiddenIn(t).map((w) => where + ': ' + w));
  ok('forbidden words (phone numbers, health claims, doses, the maker\'s name): none in the section\'s html (comments and attributes too) or in any of its translations (lang/src)', bad.length === 0, few(bad));
  // every block of the section has a translation in every language (the source files; the built files are checked below in the browser)
  const noTr = [];
  for (const code of LANGS.slice(1)) {
    let ui = {};
    try { ui = JSON.parse(fs.readFileSync(path.join(ROOT, 'lang/src', code + '.json'), 'utf8')).ui || {}; } catch (e) { /* none */ }
    const miss = keys.filter((k) => typeof ui[k] !== 'string' || !ui[k].trim());
    if (miss.length) noTr.push(`${code}: ${miss.length} of ${keys.length} (${miss.slice(0, 3).map((k) => (EN_JSON[k] || k).slice(0, 24)).join(', ')})`);
  }
  ok(`every text of the section has a translation in lang/src in all four other languages (${keys.length} texts)`, noTr.length === 0, noTr.join(' | '));

  // 6: every link to #shop... in the site's html pages
  const ids = new Map();
  const idsOf = (f) => { if (!ids.has(f)) { let t = ''; try { t = fs.readFileSync(f, 'utf8'); } catch (e) { /* no such file */ } ids.set(f, t ? new Set([...t.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map((m) => m[1])) : null); } return ids.get(f); };
  let links = 0; const broken = [];
  for (const f of htmlFiles(ROOT)) {
    const html = fs.readFileSync(f, 'utf8');
    for (const m of html.matchAll(/\bhref\s*=\s*["']([^"']*#shop[^"']*)["']/g)) {
      links++;
      const [file, frag] = m[1].split('#');
      let target = f;
      if (file) target = file.startsWith('/') ? path.join(ROOT, file) : path.resolve(path.dirname(f), file);
      if (/^https?:/.test(file)) continue;
      if (target.endsWith(path.sep) || (file && !path.extname(target))) target = path.join(target, 'index.html');
      if (/^\/?$/.test(file || '') && file) target = path.join(ROOT, 'index.html');
      const set = idsOf(target);
      if (!set || !set.has(frag)) broken.push(`${path.relative(ROOT, f)}: ${m[1]}`);
    }
  }
  ok(`every link to #shop... in the site's html pages has its target (${links} links)`, links > 3 && broken.length === 0, few(broken));
}

/* ================================================================== the checks in the browser */
await run('shop', async ({ browser, base, errs }) => {
  /* ---------------------------------------------- English, a computer window: what is on the page */
  const p = await openShop(browser, base, errs, { w: 1366, h: 900 });
  await throughShop(p);
  await settled(p, 1500, 4000);
  const reveal = await until(p, () => [...document.querySelectorAll('#shop .reveal')].every((e) => parseFloat(getComputedStyle(e).opacity) > 0.99), null, 8000);
  const en = await p.evaluate(readShop, SEL);
  ok('the section is revealed when it is scrolled to (nothing stays invisible)', !!reveal && en.cards.length > 0, JSON.stringify(en.reveal.filter((o) => o < 0.99).slice(0, 5)));
  const outside = await p.evaluate(readOutside);
  await p.addStyleTag({ content: STILL });

  /* ---- 1: the products, their groups, their names */
  const where = new Map();            // product slug -> cards
  const how = [];                      // per card: { slug|extra, by }
  const used = new Set();
  for (const c of en.cards) how[c.i] = null;
  // by name, then by the picture the card shows, then by the nearest name; whatever is left is "not in the list"
  const tokens = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 2));
  for (const pass of ['name', 'icon', 'near']) {
    for (const c of en.cards) {
      if (how[c.i]) continue;
      let hit = null;
      if (pass === 'name') hit = slugOf(c.name);
      if (pass === 'icon') { const ids = c.uses.map((u) => u.replace(/^#/, '')); hit = PRODUCTS.find((q) => q.symbols.some((s) => ids.includes(s)) && !where.has(q.slug)); }
      if (pass === 'near') {
        const t = tokens(c.name); let best = null, score = 0;
        for (const q of PRODUCTS) { if (where.has(q.slug)) continue; const u = tokens(q.name); const k = [...t].filter((w) => u.has(w)).length / Math.max(1, Math.min(t.size, u.size)); if (k > score) { score = k; best = q; } }
        if (score >= 0.66) hit = best;
      }
      if (hit) { how[c.i] = { slug: hit.slug, by: pass }; }
    }
    for (const c of en.cards) if (how[c.i] && how[c.i].slug) { if (!where.has(how[c.i].slug)) where.set(how[c.i].slug, []); if (!where.get(how[c.i].slug).includes(c)) where.get(how[c.i].slug).push(c); }
  }
  // (a product matched by name twice is a duplicate; a card matched later by picture or likeness takes only a product that nobody has yet)
  const dupes = PRODUCTS.map((q) => ({ q, cards: en.cards.filter((c) => norm(c.name) === norm(q.name)) })).filter((x) => x.cards.length > 1);
  const extraOf = (c) => EXTRAS.find((e) => norm(e.name) === norm(c.name));
  const unlisted = en.cards.filter((c) => !how[c.i] && !extraOf(c));
  const extrasShown = en.cards.filter((c) => !how[c.i] && extraOf(c));
  const missing = PRODUCTS.filter((q) => !where.has(q.slug));
  const near = (c) => { const t = tokens(c.name); let best = null, score = 0; for (const q of PRODUCTS) { const u = tokens(q.name); const k = [...t].filter((w) => u.has(w)).length / Math.max(1, Math.min(t.size, u.size)); if (k > score) { score = k; best = q; } } return score > 0 ? ` (like "${best.name}"?)` : ''; };
  ok(`1: every product of the list has a card in #shop (${PRODUCTS.length - missing.length} of ${PRODUCTS.length})`, missing.length === 0, few(missing.map((q) => `${q.slug} "${q.name}"`)));
  ok('1: every product is on the page exactly once', dupes.length === 0 && [...where.values()].every((l) => l.length === 1), few(dupes.map((x) => `"${x.q.name}" x${x.cards.length}`).concat([...where].filter(([, l]) => l.length > 1).map(([s]) => s))));
  const misnamed = [...where].map(([s, l]) => ({ q: PRODUCTS.find((q) => q.slug === s), c: l[0] })).filter(({ q, c }) => norm(c.name) !== norm(q.name));
  ok('1: every product has the name the list gives it', misnamed.length === 0, few(misnamed.map(({ q, c }) => `${q.slug}: page "${c.name}", list "${q.name}"`)));
  const wrongGroup = [...where].map(([s, l]) => ({ q: PRODUCTS.find((q) => q.slug === s), c: l[0] })).filter(({ q, c }) => norm(c.group) !== norm(GROUPS.find((g) => g.n === q.group).name));
  ok('1: every product sits in its group (the group named in the list)', wrongGroup.length === 0, few(wrongGroup.map(({ q, c }) => `${q.slug}: in "${c.group}", should be in "${GROUPS.find((g) => g.n === q.group).name}"`)));
  ok('1: no card that the list does not have (the published page\'s own few extra cards are named in the list file)', unlisted.length === 0, few(unlisted.map((c) => `"${c.name}" [${c.text.slice(c.name.length).trim().slice(0, 30)}]${near(c)}`)));
  if (extrasShown.length) info(`${extrasShown.length} card(s) are not in SHOP-LIST.md but were already on the published page, so they are allowed: ${extrasShown.map((c) => c.name).join(', ')}`);
  const headings = en.groups.map((g) => norm(g.head));
  const gMissing = GROUPS.filter((g) => !headings.includes(norm(g.name))), gExtra = en.groups.filter((g) => !GROUPS.some((x) => norm(x.name) === norm(g.head)));
  ok(`1: the 12 groups are on the page with the names of the list (headings)`, gMissing.length === 0 && gExtra.length === 0 && en.groups.length === GROUPS.length, few(gMissing.map((g) => `missing "${g.name}"`).concat(gExtra.map((g) => `page has "${g.head}" (#${g.id})`))));
  const order = GROUPS.map((g) => headings.indexOf(norm(g.name)));
  info(`group order on the page: ${order.every((v, i) => i === 0 || v > order[i - 1]) ? 'the same as the list' : 'not the order of the list (' + en.groups.map((g) => g.head).join(' > ') + ')'}`);
  ok('1: each card is shown once in its own group box (no group is empty, no card sits outside a group)', en.groups.every((g) => g.cards > 0) && en.cards.every((c) => c.groupId), few(en.cards.filter((c) => !c.groupId).map((c) => c.name)));

  /* ---- 2: the prices */
  const priceBad = [], pairBad = [], unitBad = [], soonBad = [], freeBad = [], numBad = [], ruleBad = [];
  const soonKey = UNKNOWN_KEY;
  const label = (o) => {   // how the page may write the small word of an option: small, 1 scoop, 8 oz, 8" (8 inch, 8-inch, 8 in), basil
    const t = o.label.toLowerCase();
    if (/^\d+"$/.test(t)) return new RegExp('\\b' + t.slice(0, -1) + '\\s*(?:"|\u2033|\u201d|\'\'|-?\\s?in(?:ch(?:es)?)?\\b)', 'i');
    return new RegExp('(?<![a-z0-9])' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+') + '(?![a-z0-9])', 'i');
  };
  const unitRe = (u) => (/^each$/i.test(u) ? /\b(?:each|every|per (?:drink|glass|serving))\b/i : /^a /i.test(u) ? new RegExp('\\b(?:a|per|\\/|each)\\s*' + u.slice(2).replace(/[^a-z]/gi, '') + '\\b|\\/\\s*' + u.slice(2).replace(/[^a-z]/gi, ''), 'i') : new RegExp(u, 'i'));
  for (const q of PRODUCTS) {
    const c = (where.get(q.slug) || [])[0]; if (!c) continue;
    const have = amountsIn(c.text), text = c.text;
    if (q.unknown) {
      const soonEl = c.keys.find((k) => k.key === soonKey);
      if (/\$|usd|dollar/i.test(text) || have.length) soonBad.push(`${q.slug}: shows ${have.map((a) => '$' + a).join(', ') || 'a dollar sign'} (the list has no confirmed price)`);
      else if (!soonEl || clean(soonEl.text) !== LIST.unknownWords) soonBad.push(`${q.slug}: does not say "${LIST.unknownWords}" (the page's own words, text block ${soonKey})`);
      if (q.noAgeStatement === undefined) { /* no rule */ }
    } else if (q.free) {
      if (/\$/.test(text) || have.length) freeBad.push(`${q.slug}: shows ${have.map((a) => '$' + a).join(', ') || 'a dollar sign'} (it is free)`);
      else if (!/\bfree\b/i.test(text)) freeBad.push(`${q.slug}: does not say "Free"`);
    } else {
      const allowed = q.amounts.concat(q.noteAmounts);
      if (!within(q.amounts, have)) priceBad.push(`${q.slug}: page ${have.map((a) => '$' + a).join(' ') || 'no price'}, list ${q.amounts.map((a) => '$' + a).join(' ')}`);
      else if (!within(rest(q.amounts, have), q.noteAmounts) && rest(q.amounts, have).length) priceBad.push(`${q.slug}: page also shows ${rest(q.amounts, have).filter((a) => !q.noteAmounts.includes(a)).map((a) => '$' + a).join(' ')} (list: ${allowed.map((a) => '$' + a).join(' ')})`);
      if (soonKey && c.keys.some((k) => k.key === soonKey)) soonBad.push(`${q.slug}: has a price but also says "${LIST.unknownWords}"`);
      // each option's small word sits next to its own amount (not swapped): the nearest amount to the word is the right one
      for (const o of q.options) {
        const re = label(o); let found = false, seenWord = false;
        for (const m of text.matchAll(new RegExp(re.source, 'gi'))) {
          seenWord = true;
          const spots = [...text.matchAll(/(?:US)?\$\s*(\d+(?:\.\d{1,2})?|\.\d{1,2})/g)].map((a) => ({ v: numOf(a[1]), d: Math.min(Math.abs(a.index - (m.index + m[0].length)), Math.abs(a.index + a[0].length - m.index)) }));
          if (!spots.length) continue;
          const nearest = Math.min(...spots.map((s) => s.d));
          if (spots.some((s) => s.d === nearest && Math.abs(s.v - o.amount) < 0.001)) found = true;
        }
        if (!found) pairBad.push(`${q.slug}: "${o.label}" should go with $${o.amount}${seenWord ? '' : ' (the word is not there)'}`);
      }
      const units = q.options.map((o) => o.unit).concat([q.unit]).filter(Boolean);
      for (const u of units) if (!unitRe(u).test(text)) unitBad.push(`${q.slug}: the price should say "${u}"`);
    }
    // numbers that are not amounts (sizes, counts, dates) must be ones the list gives for this product
    const okNums = new Set(numbersIn([q.name, q.price, q.note].join(' ')));
    const extraNums = numbersIn(text).filter((n) => !okNums.has(n));
    if (extraNums.length) numBad.push(`${q.slug}: "${extraNums.join(' ')}" is not in the list`);
    // the list's own orders to the page maker
    if (q.linkTo && !c.links.some((h) => h.replace(/^\.?\//, '') === q.linkTo)) ruleBad.push(`${q.slug}: should link to ${q.linkTo}`);
    if (q.noHours) {
      const g = en.groups.find((x) => x.id === c.groupId), grpText = c.text;
      if (/\b\d{1,2}(?::\d{2})?\s?(?:a\.?m\.?|p\.?m\.?)\b|\b\d{1,2}:\d{2}\b|\b(?:mon|tues|wednes|thurs|fri|satur|sun)day\b/i.test(grpText) || /\bopen\b/i.test(grpText)) ruleBad.push(`${q.slug}: the list says do not copy opening hours here: "${grpText.slice(0, 60)}"`);
      void g;
    }
    if (q.noAgeStatement && /\b(?:18|21)\b|\bages?\b|\byears?\b|\bmust be\b|\badults?\b|\bID\b/i.test(c.text)) ruleBad.push(`${q.slug}: the list says no age statement: "${c.text.slice(0, 60)}"`);
    if (q.noNewDates) {
      const ownText = c.text.slice(c.name.length).split(LIST.unknownWords).join('. ');
      const sentences = ownText.split(/(?<=[.!?])\s+/).filter((s) => /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|thanksgiving|weekend|\b(?:mon|tues|wednes|thurs|fri|satur|sun)day\b|\b\d{1,2}(?:st|nd|rd|th)\b/i.test(s));
      const strange = sentences.filter((s) => !outside.includes(clean(s.replace(/\u2019/g, "'"))) && !outside.includes(clean(s)));
      if (strange.length) ruleBad.push(`${q.slug}: dates in words the page does not have elsewhere: "${strange[0].slice(0, 70)}"`);
    }
  }
  for (const c of en.cards.filter((x) => !how[x.i] && extraOf(x))) {   // the extra cards: only the facts the published page had
    const e = extraOf(c), have = amountsIn(c.text);
    if (e.unknown ? have.length || !c.keys.some((k) => k.key === soonKey) : !same(have, e.amounts.slice().sort((a, b) => a - b))) priceBad.push(`extra "${e.name}": page ${have.map((a) => '$' + a).join(' ') || 'no price'}, published page ${e.unknown ? LIST.unknownWords : e.amounts.map((a) => '$' + a).join(' ')}`);
    const okNums = new Set(numbersIn(e.says)), bad = numbersIn(c.text).filter((n) => !okNums.has(n));
    if (bad.length) numBad.push(`extra "${e.name}": "${bad.join(' ')}" is not on the published page`);
  }
  const withCard = PRODUCTS.filter((q) => where.has(q.slug));
  ok(`2: every priced product shows the amounts of the list, and no other amount (${withCard.filter((q) => !q.unknown && !q.free).length} priced)`, priceBad.length === 0, few(priceBad));
  ok('2: a product with sizes or kinds shows each small word next to its own amount ($3 small, $4 large; 1 scoop $4, 2 scoops $6; 8 oz, 16 oz; 8", 10", 12"; basil, tomatoes)', pairBad.length === 0, few(pairBad));
  ok('2: a price per pound, per stem or each says so', unitBad.length === 0, few(unitBad));
  ok(`2: every product with no confirmed price says "${LIST.unknownWords}" (the page's own words) and shows no dollar sign (${PRODUCTS.filter((q) => q.unknown).length} of them)`, soonBad.length === 0, few(soonBad));
  ok('2: a free thing says Free and shows no dollar sign', freeBad.length === 0, few(freeBad));
  ok('2: no number on a card that the list does not give for that product (sizes, counts, ages, dates)', numBad.length === 0, few(numBad));
  ok('2: the list\'s own orders: pizza links to its page and shows no hours, beer and wine have no age statement, Christmas trees have only the page\'s own dates', ruleBad.length === 0, few(ruleBad));

  /* ---- 3: the pictures */
  const expected = [...new Set(PRODUCTS.flatMap((q) => q.symbols))];
  const sy = await p.evaluate(readSymbols, expected);
  const hasSym = new Map(sy.list.map((s) => [s.id, s]));
  ok('3: every <use> on the page (also the group pictures and the jump buttons) has its <symbol>', sy.missingUses.length === 0, few(sy.missingUses));
  ok(`3: every picture the list names exists (${expected.length} symbols: p-<slug>, plus #tractor, #wagon, #barrel-train)`, sy.list.every((s) => s.found), few(sy.list.filter((s) => !s.found).map((s) => '#' + s.id)));
  const emptySy = sy.list.filter((s) => s.found && (s.shapes < 3 || !s.hasViewBox || s.area < 0.1));
  ok('3: no picture is empty (it has a viewBox, at least 3 shapes, and draws over at least a tenth of its box)', emptySy.length === 0, few(emptySy.map((s) => `#${s.id} (${s.shapes} shapes, viewBox ${s.hasViewBox ? 'ok' : 'missing'}, fills ${Math.round(s.area * 100)}%)`)));
  const wrongPic = [...where].map(([s, l]) => ({ q: PRODUCTS.find((q) => q.slug === s), c: l[0] })).filter(({ q, c }) => { const ids = c.uses.map((u) => u.replace(/^#/, '')); return !q.symbols.some((x) => ids.includes(x)) || ids.some((i) => !q.symbols.includes(i)); });
  ok('3: each card shows the picture of its own product (p-<slug>; the wagon ride, barrel train, corn pit and sunn hemp maze use the pictures the list names)', wrongPic.length === 0, few(wrongPic.map(({ q, c }) => `${q.slug}: shows ${c.uses.join(' ') || 'no picture'}, list says ${q.symbols.map((x) => '#' + x).join(' or ')}`)));
  const byPic = {};
  for (const c of en.cards) for (const u of c.uses.map((x) => x.replace(/^#/, ''))) (byPic[u] = byPic[u] || []).push(c.name);
  const twice = Object.entries(byPic).filter(([, names]) => new Set(names).size > 1);
  ok('3: no picture is used for two different products', twice.length === 0, few(twice.map(([u, n]) => `#${u}: ${[...new Set(n)].join(' and ')}`)));
  const byDrawing = {};
  for (const s of sy.list.filter((x) => x.found && x.id.startsWith('p-'))) (byDrawing[s.markup] = byDrawing[s.markup] || []).push(s.id);
  const copies = Object.values(byDrawing).filter((ids) => ids.length > 1);
  ok('3: no two products have the very same drawing (a copy of one picture under two names)', copies.length === 0, few(copies.map((ids) => ids.map((i) => '#' + i).join(' = '))));
  info(`the page has ${sy.pSymbols.length} p-... pictures (the list needs ${expected.filter((i) => i.startsWith('p-')).length})`);

  /* ---- 4: forbidden words, English page (the other languages below) */
  const badEn = forbiddenIn(en.allText);
  ok('4: no phone number, health claim, dose figure or the maker\'s name in #shop (English page, with its attributes)', badEn.length === 0, badEn.join(', '));

  /* ---- 5 and 8 (English part): every block has its text block, a reading structure */
  ok('5: every word in #shop is in a block that can be translated (data-t), and every label that a screen reader says too', en.stray.length === 0 && en.strayAttrs.length === 0, few(en.stray.concat(en.strayAttrs)));
  ok('8: every picture is hidden from screen readers (aria-hidden), none is a bare image', en.svgBare.length === 0, few(en.svgBare));
  ok('8: every card is a list item of a list (ul / ol), so a screen reader counts them', en.cards.every((c) => c.inLi), few(en.cards.filter((c) => !c.inLi).map((c) => c.name)));
  const lv = en.headings.map((h) => Number(h.tag[1]));
  ok('8: the headings go h2, then h3 for each group, then h4 for the products (no level skipped, one h2)', lv[0] === 2 && lv.filter((n) => n === 2).length === 1 && lv.every((n, i) => i === 0 || n <= lv[i - 1] + 1) && en.groups.every((g) => g.tag === 'h3'), `${lv.slice(0, 14).join('')}...; groups: ${en.groups.map((g) => g.tag).join(',')}`);
  const names = en.cards.map((c) => c.name);
  ok('8: every card has a name that is a heading', en.headings.filter((h) => h.tag !== 'h2' && h.tag !== 'h3').length >= en.cards.length - 2, `${en.headings.length} headings for ${en.cards.length} cards`);
  void names;
  const ctr = await p.evaluate(contrastOf);
  const weak = ctr.filter((c) => c.ratio < c.need && !c.image);
  ok(`8: the text of every price ("$5", "Prices coming soon", "Free") reads well: contrast at least 4.5 (3 for large text) (${ctr.length} looked at)`, ctr.length > 20 && weak.length === 0, few(weak.map((c) => `"${c.text}" ${c.ratio}:1 (needs ${c.need}) at ${c.px}px`)));
  const onImage = ctr.filter((c) => c.image);
  if (onImage.length) info(`${onImage.length} price text(s) sit on a gradient or picture, so their contrast was left to axe`);
  const axe = axeSource();
  if (!axe) info('axe-core is not installed: the accessibility rules on #shop were skipped (npm i -D axe-core)');
  else {
    await p.evaluate(axe);
    const res = await p.evaluate(async () => (await window.axe.run({ include: [['#shop']] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] } })).violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n').slice(1, 2).join(' ').trim().slice(0, 90)) })));
    ok('8: axe (WCAG 2.1 A and AA, best practices) finds nothing wrong in #shop', res.length === 0, few(res.map((v) => `[${v.impact}] ${v.id}: ${v.nodes.join(' / ')}`)));
  }

  /* ---- 6: the jump buttons: where each lands the group (a computer window first) */
  async function pills(page, tag) {
    const list = await page.evaluate(readShop, SEL).then((r) => r.pills);
    const bad = [], heads = new Map(en.groups.map((g) => [g.id, norm(g.head)]));
    for (const pill of list) {
      await page.evaluate(() => window.scrollTo(0, 0)); await scrolled(page, 3000);
      const sel = `#shop ${SEL.jump}[href="${pill.href}"]`;
      try { await page.click(sel, { timeout: ms(8000) }); } catch (e) { bad.push(`${pill.href}: could not be clicked`); continue; }
      await scrolled(page);
      const m = await page.evaluate((id) => {
        const t = document.getElementById(id), h = document.querySelector('.site-header');
        if (!t) return null;
        const hb = h ? Math.max(0, h.getBoundingClientRect().bottom) : 0, hp = h ? getComputedStyle(h).position : '';
        return { top: Math.round(t.getBoundingClientRect().top), hb: Math.round(hb), sticky: /fixed|sticky/.test(hp), y: Math.round(window.scrollY), max: Math.round(document.documentElement.scrollHeight - innerHeight) };
      }, pill.href.slice(1));
      if (!m) { bad.push(`${pill.href}: no such place on the page`); continue; }
      const low = m.sticky ? m.hb - 1 : -1;
      if (m.top < Math.max(0, low) || m.top > 220) bad.push(`${pill.text} (${pill.href}): lands ${m.top}px from the top, the header covers 0-${m.hb}px`);
      if (!heads.has(pill.href.slice(1))) bad.push(`${pill.text}: ${pill.href} is not one of the groups`);
      else if (norm(pill.text) !== heads.get(pill.href.slice(1))) bad.push(`"${pill.text}" jumps to the group "${heads.get(pill.href.slice(1))}"`);
    }
    ok(`6: ${tag}: each of the ${list.length} jump buttons lands its group below the sticky header (0 to 220 px from the top), and the group has the button's name`, list.length === GROUPS.length && bad.length === 0, few(bad.concat(list.length === GROUPS.length ? [] : [`${list.length} buttons for ${GROUPS.length} groups`])));
  }
  await p.evaluate(() => { document.documentElement.style.scrollBehavior = ''; });
  await p.addStyleTag({ content: 'html{scroll-behavior:smooth!important}' }).catch(() => {});   // as a visitor has it
  await pills(p, 'computer window');

  /* ---- 7: layout at every width. 1366 is this page; the others are fresh windows */
  const layout = async (page, tag, w) => {
    await throughShop(page);
    const rec = await page.evaluate(readLayout, SEL);
    const aud = await page.evaluate(auditLayout, { parts: ['page'] });
    const mine = await page.evaluate((ps) => ps.map((q) => { const e = q.aid ? document.querySelector('[data-audit-id="' + q.aid + '"]') : null; return { kind: q.kind, sel: q.sel, info: q.info, inShop: !!(e && e.closest('#shop')) }; }), aud.problems);
    const shopProblems = mine.filter((q) => q.inShop || q.kind === 'sideways').map((q) => `${q.kind} ${q.sel} ${q.info}`.slice(0, 160));
    ok(`7: ${tag}: no sideways scroll: the page and #shop fit the ${rec.innerWidth}px window`, rec.pageW <= rec.innerWidth + 1 && rec.shopW <= rec.shopClientW + 1 && rec.shopLeft >= -1 && rec.shopRight <= rec.innerWidth + 1 && !mine.some((q) => q.kind === 'sideways' || q.kind === 'sideways-culprit' || q.kind === 'sticks-out') , `page ${rec.pageW}, #shop ${rec.shopW}/${rec.shopClientW} at ${rec.shopLeft}..${rec.shopRight}; ${few(shopProblems.filter((s) => /^(sideways|sticks)/.test(s)), 3)}`);
    ok(`7: ${tag}: no text is cut off in #shop (names, prices, notes, labels: nothing wider or taller inside than its box, nothing shortened with "...")`, rec.cut.length === 0 && !mine.some((q) => q.inShop && /^(clipped-text|ellipsis|button-cut|overlap|tofu)$/.test(q.kind)), few(rec.cut.concat(shopProblems.filter((s) => /^(clipped|ellipsis|button-cut|overlap|tofu)/.test(s))), 4));
    ok(`7: ${tag}: no picture in #shop is stretched, squeezed or broken, no button label runs over 4 lines`, !mine.some((q) => q.inShop && /^(img-|button-wrap)/.test(q.kind) && (q.kind !== 'button-wrap' || Number((/over (\d+) lines/.exec(q.info) || [, 9])[1]) >= 4)), few(shopProblems.filter((s) => /^(img-|button-wrap)/.test(s)), 4));
    const want = w >= 1100 ? [4] : w >= 700 ? [3] : w >= 340 ? [2] : [1, 2];
    const wantOk = w === 1024 ? [3, 4] : want;
    ok(`7: ${tag}: the product grids show ${wantOk.join(' or ')} columns (${w < 700 ? 'a phone' : w < 1100 ? 'a tablet' : 'a wide computer'})`, rec.grids.length > 0 && rec.grids.every((g) => wantOk.includes(g.cols)), rec.grids.map((g) => `${g.id}: ${g.cols} of ${g.cards}`).join(', '));
    return rec;
  };
  const heights = {};
  heights[1366] = (await layout(p, '1366px', 1366)).shopH;
  const phone = {};
  await p.context().close();
  for (const w of WIDTHS.slice(1)) {
    const q = await openShop(browser, base, errs, { w, h: w < 700 ? 800 : 900 });
    await q.addStyleTag({ content: STILL });
    const rec = await layout(q, w + 'px', w);
    heights[w] = rec.shopH;
    if (w === 390) { await q.addStyleTag({ content: 'html{scroll-behavior:smooth!important}' }); await pills(q, 'phone window (390px)'); phone[390] = true; }
    await q.context().close();
  }
  info(`9: #shop is ${heights[1366]} px tall at 1366 px wide and ${heights[390]} px tall at 390 px wide (${heights[320]} at 320, ${heights[768]} at 768, ${heights[1920]} at 1920)`);

  /* ---- 4, 5 and 7 in the other languages (a phone window: the longest words) */
  const enKeys = new Map(en.cards.flatMap((c) => c.keys.map((k) => [k.key, k.text])));
  const STOP = /\b(?:the|and|with|from|your|for|per|at|of|all|each|are|is|free|bring|buy|only|plus|ages?|every|small|large|big|bag|jar|bottle|cup|pound|stem|person|child|children|scoops?|soon|coming|prices?|made|farm|fresh|barn|open)\b/i;
  const stoplist = (t) => t.match(STOP) ? t.match(STOP)[0] : '';
  for (const lang of LANGS.slice(1)) {
    const q = await openShop(browser, base, errs, { w: 360, h: 800, lang });
    const L = await q.evaluate(readShop, SEL);
    const tag = `${lang}`;
    ok(`5: ${tag}: the page is in the language (${L.htmlLang}), with the same ${en.cards.length} cards and ${en.groups.length} groups`, L.lang === lang && L.cards.length === en.cards.length && L.groups.length === en.groups.length, `${L.cards.length} cards, ${L.groups.length} groups`);
    // the same amounts on every card
    const diff = [];
    for (const c of L.cards) { const e = en.cards[c.i]; if (!e) continue; const a = amountsIn(e.text), b = amountsIn(c.text); if (!same(a, b)) diff.push(`${e.name}: English ${a.map((x) => '$' + x).join(' ') || 'none'}, ${lang} ${b.map((x) => '$' + x).join(' ') || 'none'}`); }
    ok(`5: ${tag}: every card has the same dollar amounts as in English (${en.cards.length} cards)`, diff.length === 0, few(diff));
    // an unconfirmed price says the page's own translated words
    const soonWords = (L.dictText[UNKNOWN_KEY] || '');
    const soonBadL = PRODUCTS.filter((x) => x.unknown && where.has(x.slug)).filter((x) => { const c = L.cards[where.get(x.slug)[0].i]; const k = c && c.keys.find((kk) => kk.key === UNKNOWN_KEY); return !k || clean(k.text) !== soonWords || /\$/.test(c.text); }).map((x) => x.slug);
    ok(`5: ${tag}: every card with no confirmed price says "${soonWords}" and shows no dollar sign`, !!soonWords && soonBadL.length === 0, few(soonBadL));
    // every text block has its translation; no English words left over
    ok(`5: ${tag}: every text block of #shop has its translation in the built language file (${L.keys.length} blocks)`, L.missing.length === 0 && L.missingAttr.length === 0, few(L.missing.concat(L.missingAttr).map((k) => (EN_JSON[k] || k).slice(0, 28))));
    const leaks = [];
    for (const c of L.cards) for (const k of c.keys) {
      const en0 = enKeys.get(k.key) || '';
      const stop = stoplist(k.plain);
      if (stop) leaks.push(`"${k.plain.slice(0, 34)}" has the English word "${stop}"`);
      else if (clean(k.text) === clean(en0) && /(?<![A-Za-z])[a-z]{4,}/.test(en0) && !/^\$|^\d/.test(en0)) leaks.push(`"${en0.slice(0, 34)}" is still English`);
    }
    ok(`5: ${tag}: no English left in the cards (names, small words, notes) except the farm's and makers' names`, leaks.length === 0, few(leaks));
    const badL = forbiddenIn(L.allText);
    ok(`4: ${tag}: no phone number, health claim, dose figure or the maker's name in #shop`, badL.length === 0, badL.join(', '));
    await q.addStyleTag({ content: STILL });
    await layout(q, `${lang} on a 360px phone`, 360);
    await q.context().close();
  }
});
