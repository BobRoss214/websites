// order: 40
// browser: no
// covers: *.html, css/*, js/*, lang/*, tests/*, *.json, _headers, robots.txt, sitemap.xml, manifest.webmanifest
/* Plain mistakes that a browser quietly forgives (no browser needed, a few seconds):
 *   - HTML (the 6 pages, 404.html, print/*.html, and the pieces in pages/): the same id twice, a label / aria-controls / aria-labelledby / aria-describedby /
 *     list / <use> / #link that points at an id that does not exist, a link to another page's #anchor that is not there, a heading level skipped or empty,
 *     more or less than one h1 and one main, a picture without alt, a <p> holding a block, a link inside a link, a button or link inside a button, link or
 *     summary, target="_blank" without rel, a mistyped mailto: / tel: / web address, a bad lang value, the same attribute twice, JSON-LD that does not parse
 *   - aria-* names and the values of the common ones, role values: real ones only
 *   - nothing the Content-Security-Policy in docs/LAUNCH_CHECKLIST.md would block: no inline <script> (JSON-LD is data), no onclick= and other inline handlers
 *     (except print/'s "window.print()", whose hash is in that policy), no javascript: address, nothing loaded from another web site
 *   - the small files: sitemap.xml, robots.txt, manifest.webmanifest, _headers, every .json
 *   - scripts: every js/*.js and lang/*.js is valid as a browser script (the way the browser reads it), every tests/*.mjs passes node --check,
 *     no console.log / debugger / eval left in js/ (the ?track=debug line of js/analytics.js is allowed)
 *   - style sheets (css/*.css): braces, brackets, quotes and comments balanced; every property is one on the list below (so a typo is caught);
 *     no missing ";" (a second "name:" inside one value); no unknown unit; no impossible hex color; keyword values of the common properties are real
 *     keywords; the "background" shorthand is valid (a color only in the LAST layer, one repeat style per layer: browsers silently drop the whole line
 *     otherwise); @media features are real
 * Each check is first run on a deliberately broken sample, so a check that stopped working cannot pass quietly.
 * A property that is really new and not on KNOWN_PROPERTIES: add it there (one word). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { ROOT, ok, info, finish } from './lib.mjs';

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const list = (dir, ext) => fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(ext)).sort().map((f) => (dir ? dir + '/' : '') + f);
const lineOf = (s, i) => s.slice(0, i).split('\n').length;

/* ---------------- HTML ---------------- */
const VOID = new Set('area base br col embed hr img input link meta source track wbr'.split(' '));
const OPTIONAL_END = new Set('p li dd dt tr td th thead tbody tfoot option colgroup'.split(' '));
const ARIA = new Set('aria-activedescendant aria-atomic aria-autocomplete aria-braillelabel aria-brailleroledescription aria-busy aria-checked aria-colcount aria-colindex aria-colindextext aria-colspan aria-controls aria-current aria-describedby aria-description aria-details aria-disabled aria-dropeffect aria-errormessage aria-expanded aria-flowto aria-grabbed aria-haspopup aria-hidden aria-invalid aria-keyshortcuts aria-label aria-labelledby aria-level aria-live aria-modal aria-multiline aria-multiselectable aria-orientation aria-owns aria-placeholder aria-posinset aria-pressed aria-readonly aria-relevant aria-required aria-roledescription aria-rowcount aria-rowindex aria-rowindextext aria-rowspan aria-selected aria-setsize aria-sort aria-valuemax aria-valuemin aria-valuenow aria-valuetext'.split(' '));
const ROLES = new Set('alert alertdialog application article banner blockquote button caption cell checkbox code columnheader combobox complementary contentinfo definition deletion dialog directory document emphasis feed figure form generic grid gridcell group heading img insertion link list listbox listitem log main marquee math meter menu menubar menuitem menuitemcheckbox menuitemradio navigation none note option paragraph presentation progressbar radio radiogroup region row rowgroup rowheader scrollbar search searchbox separator slider spinbutton status strong subscript superscript switch tab table tablist tabpanel term textbox time timer toolbar tooltip tree treegrid treeitem'.split(' '));
const ARIA_VALUES = { 'aria-hidden': 'true false', 'aria-expanded': 'true false undefined', 'aria-pressed': 'true false mixed undefined', 'aria-checked': 'true false mixed undefined', 'aria-selected': 'true false undefined', 'aria-disabled': 'true false', 'aria-current': 'page step location date time true false', 'aria-live': 'off polite assertive', 'aria-modal': 'true false', 'aria-haspopup': 'false true menu listbox tree grid dialog', 'aria-orientation': 'horizontal vertical undefined', 'aria-busy': 'true false', 'aria-atomic': 'true false', 'aria-required': 'true false', 'aria-readonly': 'true false', 'aria-multiline': 'true false', 'aria-multiselectable': 'true false' };
const BLOCK = new Set('address article aside blockquote details dialog div dl fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup hr main menu nav ol p pre section table ul'.split(' '));
const INTERACTIVE = new Set('a button input select textarea details iframe'.split(' '));
const TOKEN = /<!--[\s\S]*?-->|<!doctype[^>]*>|<(script|style|textarea|title)\b([^>]*)>([\s\S]*?)<\/\1\s*>|<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s"'<>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/gi;
const ATTR = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const unescape = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/** Reads one HTML text. Returns { problems: [text], ids: Map, refs: [...], headings, mains, ld: [...] }. */
function checkHtml(src, { fragment = false, name = '' } = {}) {
  const problems = [], ids = new Map(), refs = [], headings = [], ld = [];
  const stack = [];
  let mains = 0, m;
  const at = (i, msg) => problems.push(`${name}:${lineOf(src, i)} ${msg}`);
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(src))) {
    const raw = m[0];
    if (raw.startsWith('<!')) continue;
    if (m[1]) {   // script, style, textarea, title: its text is not HTML
      const tag = m[1].toLowerCase(), attrs = parseAttrs(m[2], at, m.index);
      if (tag === 'script' && /ld\+json/i.test(attrs.type || '')) ld.push({ text: m[3], at: m.index });
      else if (tag === 'script' && attrs.src === undefined) at(m.index, 'an inline <script> (the Content-Security-Policy in docs/LAUNCH_CHECKLIST.md blocks it: put it in a file in js/)');
      else if (tag === 'script' && /^(https?:)?\/\//i.test(attrs.src)) at(m.index, `a script from another web site: ${attrs.src}`);
      if (attrs.id) addId(attrs.id, m.index);
      continue;
    }
    const closing = m[4] === '/', tag = m[5].toLowerCase();
    if (closing) {
      if (VOID.has(tag)) continue;
      const i = stack.map((s) => s.tag).lastIndexOf(tag);
      if (i < 0) { at(m.index, `</${tag}> closes nothing`); continue; }
      const top = stack[i];
      for (const s of stack.slice(i + 1)) if (!OPTIONAL_END.has(s.tag)) at(s.index, `<${s.tag}> is never closed (</${tag}> at line ${lineOf(src, m.index)} closes the one outside it)`);
      stack.length = i;
      if (/^h[1-6]$/.test(tag)) {
        const inner = src.slice(top.end, m.index);
        const label = inner.replace(/<img[^>]*\balt="([^"]*)"[^>]*>/gi, ' $1 ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
        headings.push({ level: +tag[1], text: label || (top.attrs['aria-label'] || ''), index: top.index });
      }
      continue;
    }
    const attrs = parseAttrs(m[6], at, m.index);
    const open = stack.map((s) => s.tag);
    if (attrs.id !== undefined) addId(attrs.id, m.index);
    for (const [k, v] of Object.entries(attrs)) {
      if (k.startsWith('aria-') && !ARIA.has(k)) at(m.index, `${k} is not an ARIA attribute (a typo?)`);
      if (ARIA_VALUES[k] && !ARIA_VALUES[k].split(' ').includes(v)) at(m.index, `${k}="${v}" is not one of: ${ARIA_VALUES[k].split(' ').join(', ')}`);
      if (k === 'role' && !v.split(/\s+/).every((r) => ROLES.has(r))) at(m.index, `role="${v}" is not an ARIA role`);
      if (/^on[a-z]+$/.test(k) && !(name.startsWith('print/') && k === 'onclick' && v === 'window.print()')) at(m.index, `inline handler ${k}="${v.slice(0, 30)}" (blocked by the Content-Security-Policy: use addEventListener in a file in js/)`);
      if (['href', 'src', 'action', 'formaction'].includes(k) && /^\s*javascript:/i.test(v)) at(m.index, `${k}="javascript:..." (blocked by the Content-Security-Policy)`);
    }
    if (['img', 'iframe', 'source', 'video', 'audio', 'embed', 'object', 'track'].includes(tag) && /^(https?:)?\/\//i.test(attrs.src || attrs.data || '')) at(m.index, `<${tag}> loads from another web site: ${attrs.src || attrs.data}`);
    if (tag === 'link' && /\b(stylesheet|preload|icon|apple-touch-icon|manifest|modulepreload)\b/i.test(attrs.rel || '') && /^(https?:)?\/\//i.test(attrs.href || '')) at(m.index, `<link rel="${attrs.rel}"> loads from another web site: ${attrs.href}`);
    for (const k of ['aria-controls', 'aria-labelledby', 'aria-describedby', 'aria-owns', 'aria-activedescendant', 'aria-details', 'aria-errormessage', 'for', 'list']) {
      if (attrs[k]) for (const t of attrs[k].split(/\s+/)) refs.push({ k, t, index: m.index, tag });
    }
    if (tag === 'use') { const h = attrs.href || attrs['xlink:href'] || ''; if (h.startsWith('#') && h.length > 1) refs.push({ k: '<use>', t: h.slice(1), index: m.index, tag }); }
    if (tag === 'a' && attrs.href !== undefined) checkLink(attrs, at, m.index, refs);
    if (tag === 'main' || attrs.role === 'main') mains++;
    if (tag === 'img' && attrs.alt === undefined) at(m.index, `<img src="${attrs.src || ''}"> has no alt attribute (alt="" for a decoration)`);
    if (tag === 'a' && attrs.target === '_blank' && !/\b(noopener|noreferrer)\b/.test(attrs.rel || '')) at(m.index, `target="_blank" without rel="noopener": ${attrs.href}`);
    if (attrs.lang !== undefined || tag === 'html') { const l = attrs.lang; if (!l || !/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(l)) at(m.index, `lang="${l}" on <${tag}> is not a language code`); }
    if (BLOCK.has(tag) && open.includes('p')) at(m.index, `<${tag}> inside a <p> (the browser closes the paragraph there)`);
    if (tag === 'p' && open.includes('p')) at(m.index, '<p> inside a <p>');
    if (tag === 'a' && open.includes('a')) at(m.index, '<a> inside a <a>');
    if (INTERACTIVE.has(tag) && tag !== 'a' && (open.includes('a') || open.includes('button'))) at(m.index, `<${tag}> inside a ${open.includes('a') ? 'link' : 'button'}`);
    if (tag === 'a' && open.includes('button')) at(m.index, '<a> inside a button');
    if (INTERACTIVE.has(tag) && open.includes('summary')) at(m.index, `<${tag}> inside a <summary>`);
    if (!VOID.has(tag) && m[7] !== '/') stack.push({ tag, index: m.index, end: TOKEN.lastIndex, attrs });
  }
  for (const s of stack) if (!OPTIONAL_END.has(s.tag)) at(s.index, `<${s.tag}> is never closed`);
  function addId(id, index) {
    if (id === '' || /\s/.test(id)) at(index, `id="${id}" is empty or has a space`);
    else if (ids.has(id)) at(index, `id="${id}" is used twice (first at line ${lineOf(src, ids.get(id))})`);
    else ids.set(id, index);
  }
  if (!fragment) {
    for (const r of refs) if (!ids.has(r.t)) at(r.index, `${r.k}="${r.t}" on <${r.tag}> points at an id that is not in this page`);
    const h1 = headings.filter((h) => h.level === 1);
    if (!name.startsWith('print/')) {
      if (h1.length !== 1) problems.push(`${name} has ${h1.length} <h1> (one per page)`);
      if (mains !== 1) problems.push(`${name} has ${mains} <main> (one per page)`);
    }
    let prev = 0;
    for (const h of headings) { if (prev && h.level > prev + 1) at(h.index, `heading jumps from h${prev} to h${h.level} ("${h.text.slice(0, 40)}")`); prev = h.level; }
  }
  for (const h of headings) if (!h.text) at(h.index, `empty <h${h.level}>`);
  for (const l of ld) { try { const j = JSON.parse(l.text); if (!j['@context']) at(l.at, 'JSON-LD has no @context'); } catch (e) { at(l.at, 'JSON-LD does not parse: ' + e.message); } }
  return { problems, ids, refs };
}
function parseAttrs(text, at, index) {
  const out = {}; let a;
  ATTR.lastIndex = 0;
  while ((a = ATTR.exec(text || ''))) {
    const k = a[1].toLowerCase();
    if (k in out) at(index, `the attribute ${k} is written twice on one tag`);
    out[k] = unescape(a[2] ?? a[3] ?? a[4] ?? '');
  }
  return out;
}
function checkLink(a, at, index, refs) {
  const h = a.href;
  if (h === '' || h !== h.trim()) { at(index, `href="${h}" is empty or has a space around it`); return; }
  if (h.startsWith('#')) { if (h.length > 1) refs.push({ k: 'href', t: h.slice(1), index, tag: 'a' }); return; }
  if (/^mailto:/i.test(h)) {
    for (const addr of h.slice(7).split('?')[0].split(',')) if (!/^[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(addr)) at(index, `mailto address looks mistyped: ${h.slice(0, 60)}`);
    if (/\s/.test(h)) at(index, `mailto: with a space in it (use %20): ${h.slice(0, 60)}`);
  } else if (/^tel:/i.test(h)) {
    if (!/^tel:\+\d{8,15}$/.test(h)) at(index, `tel: link is not +country code and digits only: ${h}`);
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(h)) {
    if (!/^https:\/\/[^\s/?#]+\.[a-z]{2,}([/?#]\S*)?$/i.test(h)) at(index, `web address looks mistyped (https:// and a host are needed): ${h.slice(0, 70)}`);
  } else if (/^(\/\/|www\.)/.test(h)) at(index, `web address without https://: ${h}`);
  else {
    const p = h.split('#')[0].split('?')[0];
    if (p && !fs.existsSync(path.join(ROOT, p))) at(index, `link to a file that is not there: ${h}`);
  }
}

/* ---------------- CSS ---------------- */
// Every property the style sheets use today (and the usual ones next to them). A typo is not on this list. Add a really new property here.
const KNOWN_PROPERTIES = new Set(`accent-color align-content align-items align-self all animation animation-delay animation-direction animation-duration animation-fill-mode animation-iteration-count animation-name animation-play-state
animation-timing-function appearance aspect-ratio backdrop-filter backface-visibility background background-attachment background-blend-mode background-clip background-color background-image background-origin background-position
background-position-x background-position-y background-repeat background-size border border-block border-block-end border-block-start border-bottom border-bottom-color border-bottom-left-radius border-bottom-right-radius
border-bottom-style border-bottom-width border-collapse border-color border-image border-inline border-inline-end border-inline-start border-left border-left-color border-left-style border-left-width border-radius border-right
border-right-color border-right-style border-right-width border-spacing border-style border-top border-top-color border-top-left-radius border-top-right-radius border-top-style border-top-width border-width bottom box-decoration-break
box-shadow box-sizing break-after break-before break-inside caption-side caret-color clear clip clip-path color color-scheme column-count column-gap column-rule columns container container-name container-type content content-visibility
counter-increment counter-reset cursor direction display empty-cells fill fill-opacity fill-rule filter flex flex-basis flex-direction flex-flow flex-grow flex-shrink flex-wrap float font font-family font-feature-settings font-kerning
font-optical-sizing font-size font-size-adjust font-stretch font-style font-synthesis font-variant font-variant-numeric font-weight forced-color-adjust gap grid grid-area grid-auto-columns grid-auto-flow grid-auto-rows grid-column
grid-column-end grid-column-start grid-gap grid-row grid-row-end grid-row-start grid-template grid-template-areas grid-template-columns grid-template-rows height hyphens image-rendering inset inset-block inset-block-end inset-block-start
inset-inline inset-inline-end inset-inline-start isolation justify-content justify-items justify-self left letter-spacing line-break line-height list-style list-style-image list-style-position list-style-type margin margin-block
margin-block-end margin-block-start margin-bottom margin-inline margin-inline-end margin-inline-start margin-left margin-right margin-top mask mask-image mask-position mask-repeat mask-size max-block-size max-height max-inline-size
max-width min-block-size min-height min-inline-size min-width mix-blend-mode object-fit object-position offset-path opacity order orphans outline outline-color outline-offset outline-style outline-width overflow overflow-anchor
overflow-wrap overflow-x overflow-y overscroll-behavior overscroll-behavior-x overscroll-behavior-y padding padding-block padding-block-end padding-block-start padding-bottom padding-inline padding-inline-end padding-inline-start
padding-left padding-right padding-top page-break-after page-break-before page-break-inside paint-order perspective perspective-origin place-content place-items place-self pointer-events position quotes resize right rotate row-gap
scale scroll-behavior scroll-margin scroll-margin-top scroll-padding scroll-padding-bottom scroll-padding-top scroll-snap-align scroll-snap-stop scroll-snap-type scrollbar-color scrollbar-gutter scrollbar-width shape-rendering
size stroke stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-width tab-size table-layout text-align text-align-last text-anchor text-decoration text-decoration-color text-decoration-line
text-decoration-skip-ink text-decoration-style text-decoration-thickness text-indent text-overflow text-rendering text-shadow text-size-adjust text-transform text-underline-offset text-wrap top touch-action transform transform-box
transform-origin transform-style transition transition-behavior transition-delay transition-duration transition-property transition-timing-function translate unicode-bidi user-select vertical-align visibility white-space widows width
will-change word-break word-spacing writing-mode z-index zoom`.split(/\s+/));
const PREFIXED = new Set(['-webkit-backdrop-filter', '-webkit-box-decoration-break', '-webkit-font-smoothing', '-moz-osx-font-smoothing', '-webkit-tap-highlight-color', '-webkit-text-size-adjust', '-webkit-touch-callout', '-webkit-user-select', '-webkit-line-clamp', '-webkit-box-orient', '-webkit-appearance', '-webkit-overflow-scrolling', '-webkit-text-stroke', '-webkit-mask-image', '-ms-overflow-style']);
const DESCRIPTORS = { 'font-face': 'font-family src font-weight font-style font-display unicode-range font-stretch size-adjust ascent-override descent-override line-gap-override', property: 'syntax inherits initial-value', page: 'size margin margin-top margin-right margin-bottom margin-left' };
const UNITS = new Set('px em rem % vh vw vmin vmax dvh svh lvh dvw svw lvw ch ex cqw cqh cqi cqb cqmin cqmax s ms deg rad turn grad fr dpi dppx x lh rlh cm mm in pt pc q'.split(' '));
const MEDIA_FEATURES = new Set('width height min-width max-width min-height max-height orientation aspect-ratio min-aspect-ratio max-aspect-ratio hover any-hover pointer any-pointer prefers-reduced-motion prefers-color-scheme prefers-contrast prefers-reduced-transparency prefers-reduced-data forced-colors scripting resolution min-resolution max-resolution display-mode update inverted-colors color monochrome overflow-block overflow-inline'.split(' '));
const GLOBAL = 'inherit initial unset revert revert-layer';
const KEYWORDS = {
  display: `${GLOBAL} none block inline inline-block flex inline-flex grid inline-grid contents table inline-table table-row table-cell table-header-group table-row-group table-footer-group table-column table-column-group table-caption flow-root list-item ruby`,
  position: `${GLOBAL} static relative absolute fixed sticky`,
  visibility: `${GLOBAL} visible hidden collapse`,
  'box-sizing': `${GLOBAL} border-box content-box`,
  'text-align': `${GLOBAL} left right center justify start end match-parent`,
  'flex-direction': `${GLOBAL} row row-reverse column column-reverse`,
  'flex-wrap': `${GLOBAL} nowrap wrap wrap-reverse`,
  'white-space': `${GLOBAL} normal nowrap pre pre-wrap pre-line break-spaces`,
  'text-transform': `${GLOBAL} none uppercase lowercase capitalize full-width`,
  'pointer-events': `${GLOBAL} auto none all visible visiblepainted visiblefill visiblestroke painted fill stroke`,
  'font-style': `${GLOBAL} normal italic oblique`,
  overflow: `${GLOBAL} visible hidden clip scroll auto overlay`, 'overflow-x': `${GLOBAL} visible hidden clip scroll auto overlay`, 'overflow-y': `${GLOBAL} visible hidden clip scroll auto overlay`,
  'object-fit': `${GLOBAL} fill contain cover none scale-down`,
  'word-break': `${GLOBAL} normal break-all keep-all break-word`,
  'overflow-wrap': `${GLOBAL} normal break-word anywhere`,
  'user-select': `${GLOBAL} auto none text all contain`,
  'scroll-behavior': `${GLOBAL} auto smooth`,
  'border-collapse': `${GLOBAL} collapse separate`,
};

/** Reads one style sheet text. Returns { problems, decls }. */
function checkCss(src, name) {
  const problems = [];
  const bad = (i, msg) => problems.push(`${name}:${lineOf(src, i)} ${msg}`);
  // 1. comments out (newlines kept), strings checked
  let text = '', i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2);
      if (e < 0) { bad(i, 'a comment is never closed'); break; }
      text += src.slice(i, e + 2).replace(/[^\n]/g, ' '); i = e + 2; continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
      if (src[j] !== c) { bad(i, 'a quote is never closed'); text += src.slice(i, j); i = j; continue; }
      text += c + src.slice(i + 1, j).replace(/[^\n]/g, '_') + c; i = j + 1; continue;   // a string keeps its length, its characters become "_"
    }
    text += c; i++;
  }
  // 2. blocks and declarations
  const decls = [], blocks = [];
  let start = 0, paren = 0, bracket = 0;
  const flushDecl = (end, ctx) => {
    const raw = text.slice(start, end), t = raw.trim();
    if (!t) return;
    if (!ctx) { if (/^@(import|charset|namespace)\b/.test(t)) return; bad(start + raw.indexOf(t), `text outside any rule: "${t.slice(0, 40)}"`); return; }
    const c = t.indexOf(':');
    if (c < 0) { bad(start + raw.indexOf(t), `"${t.slice(0, 40)}" is not a declaration (no ":")`); return; }
    decls.push({ prop: t.slice(0, c).trim(), value: t.slice(c + 1).trim(), index: start + raw.indexOf(t), ctx });
  };
  for (let p = 0; p < text.length; p++) {
    const c = text[p];
    if (c === '(') paren++;
    else if (c === ')') { paren--; if (paren < 0) { bad(p, 'a ")" has no "("'); paren = 0; } }
    else if (c === '[') bracket++;
    else if (c === ']') { bracket--; if (bracket < 0) { bad(p, 'a "]" has no "["'); bracket = 0; } }
    else if (c === '{' && paren === 0) {
      const prelude = text.slice(start, p).trim();
      const at = /^@([\w-]+)/.exec(prelude);
      const kind = at ? at[1].toLowerCase() : 'rule';
      if (kind === 'rule' && !prelude) bad(p, 'a "{" with no selector');
      if (kind === 'media' || kind === 'supports' || kind === 'container') checkPrelude(kind, prelude, p);
      blocks.push({ kind, at: p });
      start = p + 1;
    } else if (c === ';' && paren === 0) {
      flushDecl(p, blocks.length ? blocks[blocks.length - 1] : null);
      start = p + 1;
    } else if (c === '}' && paren === 0) {
      if (!blocks.length) { bad(p, 'a "}" has no "{"'); start = p + 1; continue; }
      const top = blocks[blocks.length - 1];
      flushDecl(p, top);
      blocks.pop(); start = p + 1;
    }
  }
  if (blocks.length) bad(blocks[blocks.length - 1].at, `a "{" is never closed (${blocks.length} open at the end of the file)`);
  if (paren > 0) problems.push(`${name} has ${paren} "(" that are never closed`);
  function checkPrelude(kind, prelude, at) {
    if (kind === 'media') {
      for (const m of prelude.matchAll(/\(\s*([a-z-]+)\s*[:)<>=]/g)) if (!MEDIA_FEATURES.has(m[1])) bad(at, `@media feature "${m[1]}" is not a real one`);
      if (/\(\s*[a-z-]+\s*:\s*\)/.test(prelude)) bad(at, '@media feature with no value');
    }
    let d = 0; for (const ch of prelude) { if (ch === '(') d++; if (ch === ')') d--; if (d < 0) break; }
    if (d !== 0) bad(at, `unbalanced ( ) in @${kind} ${prelude.slice(0, 50)}`);
  }
  // 3. each declaration
  for (const d of decls) {
    const ctx = d.ctx.kind;
    const { prop, value, index } = d;
    if (!/^(--[\w-]+|-?[a-zA-Z][\w-]*)$/.test(prop)) { bad(index, `"${prop}" is not a property name`); continue; }
    if (prop.startsWith('--')) continue;
    if (DESCRIPTORS[ctx]) { if (!DESCRIPTORS[ctx].split(' ').includes(prop)) bad(index, `"${prop}" is not a property of @${ctx}`); continue; }
    const bare = prop.toLowerCase();
    if (!KNOWN_PROPERTIES.has(bare) && !PREFIXED.has(bare)) { bad(index, `unknown property "${prop}" (a typo? if it is a real new property, add it to KNOWN_PROPERTIES)`); continue; }
    if (!value) { bad(index, `${prop} has no value`); continue; }
    const v = value.replace(/!\s*important\s*$/i, '').trim();
    if (!v) { bad(index, `${prop} has no value`); continue; }
    const flat = v.replace(/url\([^)]*\)/gi, 'url()').replace(/"[^"]*"|'[^']*'/g, '""');
    // a missing ";" shows up as a second "name:" inside one value
    if (/(^|[\s,(])[a-z-]+\s*:\s*\S/.test(flat.replace(/\([^()]*\)/g, ''))) bad(index, `${prop}: "${v.slice(0, 50)}" looks like a missing ";" (a second "name:" inside one value)`);
    if (/!\s*important\s*\S/i.test(value)) bad(index, `${prop}: something after !important`);
    for (const m of flat.matchAll(/(?<![\w#.$-])(\d*\.?\d+)([a-zA-Z%]+)/g)) if (!UNITS.has(m[2].toLowerCase()) && !/^e\d*$/i.test(m[2])) bad(index, `${prop}: unknown unit "${m[2]}" in "${m[0]}"`);
    for (const m of flat.matchAll(/#([0-9a-zA-Z]+)\b/g)) if (!/^([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(m[1]) && !/url\(/.test(flat)) bad(index, `${prop}: "#${m[1]}" is not a color`);
    if (KEYWORDS[bare] && !/(var|calc|env|clamp|min|max)\(/.test(flat)) {
      const allowed = KEYWORDS[bare].split(' ');
      for (const w of flat.split(/[\s,]+/).filter(Boolean)) if (!allowed.includes(w.toLowerCase())) bad(index, `${prop}: "${w}" is not a value of ${prop}`);
    }
    if (bare === 'background') { const e = backgroundProblem(flat); if (e) bad(index, 'background: ' + e + ' (the browser drops the whole line)'); }
  }
  return { problems, decls };
}
/** The "background" shorthand: layers are split at top-level commas; only the LAST layer may hold a color, and one layer may hold only one repeat-style. */
function backgroundProblem(flat) {
  const layers = []; let d = 0, cur = '';
  for (const ch of flat) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { layers.push(cur); cur = ''; } else cur += ch; }
  layers.push(cur);
  const color = /(^|[\s])(#[0-9a-fA-F]{3,8}|(rgb|rgba|hsl|hsla)\(\s*[^)]*\)|transparent|currentcolor|white|black|red|green|blue|yellow|orange)(?=$|[\s])/i;
  for (let k = 0; k < layers.length; k++) {
    const l = layers[k].replace(/(linear|radial|conic|repeating-linear|repeating-radial)-gradient\((?:[^()]|\([^()]*\))*\)/gi, 'GRADIENT').replace(/url\(\)/gi, 'URL');
    if (k < layers.length - 1 && color.test(' ' + l + ' ')) return `a color in layer ${k + 1} of ${layers.length} (only the last layer may have the color)`;
    const rep = (l.match(/\b(repeat-x|repeat-y|repeat|no-repeat|space|round)\b/g) || []);
    if (rep.some((r) => r === 'repeat-x' || r === 'repeat-y') && rep.length > 1) return `"${rep.join(' ')}": repeat-x / repeat-y stand alone`;
    if (rep.length > 2) return `"${rep.join(' ')}": at most two repeat styles in one layer`;
  }
  return '';
}

/* ---------------- run ---------------- */
const pages = ['index.html', 'first-visit.html', 'pumpkin-patch.html', 'strawberry-picking.html', 'school-field-trips.html', 'wise-pie.html'];

// 0. the checks themselves, on broken samples
{
  const has = (r, re) => r.problems.some((p) => re.test(p));
  const page = (body) => `<!doctype html><html lang="en"><head><title>t</title></head><body><main><h1>x</h1>${body}</main></body></html>`;
  ok('self-test: a repeated id is found', has(checkHtml(page('<p id="a">1</p><p id="a">2</p>'), { name: 's' }), /used twice/));
  ok('self-test: a dangling aria-controls / label for / #link is found', checkHtml(page('<button aria-controls="nope">b</button><label for="nope2">l</label><a href="#nope3">x</a>'), { name: 's' }).problems.length === 3);
  ok('self-test: a heading jump, an empty heading and a missing alt are found', (() => { const r = checkHtml(page('<h3>j</h3><h2></h2><img src="a.png">'), { name: 's' }); return has(r, /jumps/) && has(r, /empty <h2>/) && has(r, /no alt/); })());
  ok('self-test: block in p, link in link, button in summary, target=_blank without rel are found', (() => { const r = checkHtml(page('<p><div>x</div></p><a href="#">a<a href="#">b</a></a><details><summary><button>b</button></summary></details><a href="https://example.com/" target="_blank">e</a>'), { name: 's' }); return has(r, /inside a <p>/) && has(r, /<a> inside a <a>/) && has(r, /inside a <summary>/) && has(r, /target="_blank"/); })());
  ok('self-test: bad mailto, tel, web address and lang are found', (() => { const r = checkHtml(page('<a href="mailto:me@home">m</a><a href="tel:704-207-6347">t</a><a href="https:/example.com/">u</a><p lang="english">x</p>'), { name: 's' }); return has(r, /mailto/) && has(r, /tel:/) && has(r, /mistyped/) && has(r, /lang=/); })());
  ok('self-test: an inline script, an inline handler, a javascript: link and a picture from another site are found', (() => { const r = checkHtml(page('<script>var a=1</script><button onclick="go()">b</button><a href="javascript:void(0)">j</a><img src="https://example.com/a.png" alt="">'), { name: 's' }); return has(r, /inline <script>/) && has(r, /inline handler/) && has(r, /javascript:/) && has(r, /another web site/); })());
  ok('self-test: a misspelled aria attribute, a bad aria value and a bad role are found', (() => { const r = checkHtml(page('<p aria-lable="x">a</p><button aria-expanded="yes">b</button><div role="tabs">c</div>'), { name: 's' }); return has(r, /not an ARIA attribute/) && has(r, /aria-expanded="yes"/) && has(r, /not an ARIA role/); })());
  ok('self-test: broken JSON-LD (a trailing comma) is found', has(checkHtml(page('<script type="application/ld+json">{"@context":"x","a":1,}</script>'), { name: 's' }), /JSON-LD does not parse/));
  const css = (t) => checkCss(t, 's.css');
  ok('self-test: CSS: a missing brace, an unknown property, a missing ";", a bad unit and a bad color are found', css('a{color:red').problems.length > 0 && has(css('a{colr:red}'), /unknown property/) && has(css('a{color:red background:blue}'), /missing ";"/) && has(css('a{width:10pxx}'), /unknown unit/) && has(css('a{color:#12345}'), /not a color/));
  ok('self-test: CSS: a bad display keyword and a bad @media feature are found', has(css('a{display:flexx}'), /not a value of display/) && has(css('@media (min-widht:3px){a{color:red}}'), /not a real one/));
  ok('self-test: CSS: a color in a lower background layer and a doubled repeat style are found', has(css('a{background:#fff linear-gradient(red,blue) 0 0/9px 9px,linear-gradient(red,blue) 0 0/9px 9px}'), /only the last layer/) && has(css('a{background:#fff linear-gradient(red,blue) 0 50%/34px 4px repeat-x no-repeat}'), /stand alone/));
  ok('self-test: CSS: good code gives no complaint', css('a{background:linear-gradient(red,blue) 0 0/9px 9px,linear-gradient(red,blue) 0 0/9px 9px #fff;margin:0 auto!important}@media (min-width:40em){b{display:grid}}@font-face{font-family:"X";src:url(a.woff2)}').problems.length === 0);
}

// 1. HTML
const htmlFiles = [...pages, '404.html', ...list('print', '.html')];
const built = {};
for (const f of htmlFiles) {
  const r = checkHtml(read(f), { name: f });
  built[f] = r;
  ok(`${f}: no repeated id, no dangling reference, no skipped heading, one h1 and one main, no bad nesting, no bad link`, r.problems.length === 0, r.problems.slice(0, 4).join(' | '));
}
const fragments = list('pages', '.html');
for (const f of fragments) { const r = checkHtml(read(f), { name: f, fragment: true }); ok(`${f}: no repeated id, no bad nesting, no bad link`, r.problems.length === 0, r.problems.slice(0, 4).join(' | ')); }
{   // links from one page to another page's #anchor
  const missing = [];
  for (const f of pages) for (const m of read(f).matchAll(/href="([a-z0-9-]+\.html)#([^"]+)"/g)) { const t = built[m[1]]; if (t && !t.ids.has(m[2])) missing.push(`${f} -> ${m[1]}#${m[2]}`); }
  ok('links to an #anchor on another page all find it', missing.length === 0, missing.slice(0, 4).join(' | '));
}

// 2. the small files
{
  const sm = read('sitemap.xml');
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const bad = locs.filter((u) => { const p = u.replace(/^https:\/\/[^/]+\//, ''); return !/^https:\/\/[^/]+\//.test(u) || !fs.existsSync(path.join(ROOT, p || 'index.html')); });
  ok('sitemap.xml is well formed and every address in it is a real page', /<urlset[^>]*sitemaps\.org/.test(sm) && (sm.match(/<url>/g) || []).length === (sm.match(/<\/url>/g) || []).length && locs.length >= 6 && bad.length === 0, bad.join(', '));
  const rb = read('robots.txt');
  ok('robots.txt: only real directives, and a Sitemap line', rb.split('\n').filter((l) => l.trim() && !l.startsWith('#')).every((l) => /^(User-agent|Allow|Disallow|Sitemap|Crawl-delay):\s*\S/.test(l)) && /^Sitemap: https:\/\//m.test(rb));
  let mf = null; try { mf = JSON.parse(read('manifest.webmanifest')); } catch (e) { /* reported below */ }
  ok('manifest.webmanifest parses and its icons are files', !!mf && mf.name && mf.start_url && Array.isArray(mf.icons) && mf.icons.every((ic) => fs.existsSync(path.join(ROOT, ic.src))), mf ? '' : 'does not parse');
  const hd = read('_headers').split('\n');
  const hdBad = hd.map((l, n) => [l, n + 1]).filter(([l]) => l.trim() && !l.startsWith('#') && !(/^\/\S*$/.test(l) || /^ {2}[A-Za-z][A-Za-z0-9-]*: \S/.test(l)));
  ok('_headers: every line is a path at the left edge or an indented "Name: value"', hdBad.length === 0 && !hd.some((l) => l.includes('\t')), hdBad.slice(0, 3).map(([l, n]) => `line ${n} "${l}"`).join(' | '));
  const jsonFiles = [...list('lang', '.json'), ...list('lang/src', '.json'), ...list('tools', '.json')];
  const jbad = [];
  for (const f of jsonFiles) { try { JSON.parse(read(f)); } catch (e) { jbad.push(f + ': ' + e.message); } }
  ok(`all ${jsonFiles.length} .json files parse`, jbad.length === 0, jbad.join(' | '));
}

// 3. scripts
{
  const files = [...list('js', '.js'), ...list('lang', '.js')];
  const bad = [];
  for (const f of files) { try { new vm.Script(read(f), { filename: f }); } catch (e) { bad.push(`${f}: ${e.message}`); } }   // the way a browser reads a <script>: no top-level return, no import
  ok(`all ${files.length} files in js/ and lang/ are valid browser scripts`, bad.length === 0, bad.join(' | '));
  const mjs = list('tests', '.mjs');
  const mbad = [];
  for (const f of mjs) { const r = spawnSync(process.execPath, ['--check', path.join(ROOT, f)], { encoding: 'utf8' }); if (r.status !== 0) mbad.push(`${f}: ${(r.stderr || '').split('\n').find((l) => /Error/.test(l)) || 'fails node --check'}`); }
  ok(`all ${mjs.length} files in tests/ pass node --check`, mbad.length === 0, mbad.join(' | '));
  const left = [];
  for (const f of list('js', '.js')) read(f).split('\n').forEach((l, n) => { if (/^\s*\/\//.test(l) || /^\s*\*/.test(l)) return; if (/\bconsole\.(log|debug|info|trace)\b/.test(l) && !(f === 'js/analytics.js' && /\bdebug\b/.test(l))) left.push(`${f}:${n + 1}`); if (/\bdebugger\b|\beval\(|new Function\(/.test(l)) left.push(`${f}:${n + 1}`); });
  ok('no console.log, debugger or eval left in js/', left.length === 0, left.join(', '));
}

// 4. style sheets
for (const f of list('css', '.css')) {
  const r = checkCss(read(f), f);
  ok(`${f}: balanced, every property known, no missing ";", units, colors, keywords and background shorthands valid (${r.decls.length} declarations)`, r.problems.length === 0, r.problems.slice(0, 5).join(' | '));
}
info('Not covered by this test (the tools are not part of this folder): the full Nu HTML Checker rules, ESLint\'s undefined-variable check, which CSS selectors match nothing, and which CSS features an old browser lacks.');

await finish({});
