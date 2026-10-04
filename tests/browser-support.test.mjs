// order: 45
// browser: no
// covers: css/*, js/*, *.html, pages/*, tests/browser-support.*, tools/browser_support_table.mjs, docs/BROWSER_SUPPORT.md
/* Older phones and other browsers, checked by reading the code (no browser, no network, a few seconds):
 *   - every browser feature the site's own files use (js/*.js, css/*.css, the pages, print/) is listed in tests/browser-support.table.json, with the first
 *     version of each browser that has it (MDN's browser-compat-data, put there by tools/browser_support_table.mjs)
 *   - a feature newer than the oldest browsers the site is made for (iPhone and Safari 14, Chrome 90 and Android Chrome 80, Firefox 78, Samsung Internet 13)
 *     has a reviewed way of coping with its absence, and where a program can check that way (a fallback written first, an @supports block, a test before
 *     the call) the test checks it; a new use of such a feature, or a feature that is not in the table at all, fails until it is reviewed
 *   - the reader of the code is first tried on small samples, so a reader that stopped working cannot pass quietly
 * Only Chromium exists in the test setup, so this is the nearest thing to a Safari and Firefox test: docs/BROWSER_SUPPORT.md says what is read and not run. */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, ok, info, finish } from './lib.mjs';
import { TARGETS, scanAll, scanCss, scanJs, scanHtml, stripJs, parseCss, supportsNotConditions } from './browser-support.scan.mjs';

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const table = JSON.parse(read('tests/browser-support.table.json'));
const keysOf = (uses) => new Set(uses.map((u) => u.key));

/* ---- 1. the reader of the code works (small samples with a known answer) ---- */
{
  const js = scanJs(`
    const a = "x?.y ?? z"; // ?. in a comment ?? too
    const r = /(?<=a)b\\//s, q = a / 2 / 3;
    const t = \`\${a ?? 1} ?. \${[1].at(-1)}\`;
    a?.b; el.replaceChildren(); window.requestIdleCallback ? 1 : 2; close(); dlg.close();
  `);
  const k = keysOf(js);
  ok('reader of scripts: finds ?. and ?? in code but not in a string or a comment', js.filter((u) => u.key.endsWith('optional_chaining')).length === 1 && js.filter((u) => u.key.endsWith('nullish_coalescing')).length === 1, [...k].filter((x) => x.startsWith('js-syntax')).join(' '));
  ok('reader of scripts: finds a look-behind and the s flag in a regular expression, and a division is not one', k.has('js-syntax:javascript.regular_expressions.lookbehind_assertion') && k.has('js-syntax:javascript.builtins.RegExp.dotAll'), '');
  ok('reader of scripts: reads the code inside a template literal (.at( there) and tells a method from our own function (close() and dlg.close())',
    js.some((u) => u.key === 'js-name:at' && u.member && u.call) && js.some((u) => u.key === 'js-name:close' && !u.member && u.call) && js.some((u) => u.key === 'js-name:close' && u.member && u.call) && k.has('js-name:replaceChildren') && k.has('js-name:requestIdleCallback'), '');
  const css = scanCss(`
    .a{display:flex;gap:8px;inset:0;aspect-ratio:1}
    .b{display:grid;gap:4px}
    .c{top:0;right:0;inset:0}
    .d{min-height:100vh;min-height:calc(100dvh - 3px);width:clamp(1px,2vw,3px)}
    @supports not (aspect-ratio:1){.e::after{padding-top:70%}}
    @supports (height:1dvh){.f{height:50dvh}}
    .g:is(.h,.i):has(> a:focus-visible){color:rgba(0,0,0,.5)} .j:not(.k,.l){color:#fff}
    @media (hover:hover) and (min-width:40em){.m{translate:0 5px}}
    @media (width >= 600px){.n{overflow-x:clip}}
    @keyframes z{from{rotate:0deg}to{rotate:9deg}}
    /* .x{inset:9px} */ .y{background:url("data:image/svg+xml;utf8,<svg a='b;c'/>");left:1px}
  `, { watchValues: new Set(['overflow-x:clip']) });
  const ck = keysOf(css);
  ok('reader of style sheets: finds properties, functions, units, pseudo-classes, at-rules and media features', ['css-prop:aspect-ratio', 'css-prop:inset', 'css-fn:clamp', 'css-unit:dvh', 'css-pseudo:is', 'css-pseudo:has', 'css-pseudo:focus-visible', 'css-sel:not-list', 'css-media:hover', 'css-media:range-syntax', 'css-prop:rotate', 'css-at:supports', 'css-at:keyframes'].every((x) => ck.has(x)),
    ['css-prop:aspect-ratio', 'css-prop:inset', 'css-fn:clamp', 'css-unit:dvh', 'css-pseudo:is', 'css-pseudo:has', 'css-pseudo:focus-visible', 'css-sel:not-list', 'css-media:hover', 'css-media:range-syntax', 'css-prop:rotate', 'css-at:supports', 'css-at:keyframes'].filter((x) => !ck.has(x)).join(' '));
  ok('reader of style sheets: a gap in a flex box is not one in a grid, a value on the watch list is found, a comment and a url(...) with ; inside are not read as code',
    css.filter((u) => u.key === 'css-gap:flex').length === 1 && css.filter((u) => u.key === 'css-gap:grid').length === 1 && ck.has('css-value:overflow-x:clip') && !css.some((u) => u.prop === 'inset' && u.value === '9px') && css.some((u) => u.key === 'css-prop:left'), '');
  const inset = css.filter((u) => u.key === 'css-prop:inset');
  ok('reader of style sheets: knows what was written above a declaration (the old way first), inside which @supports, and after which earlier line of the same property',
    inset.length === 2 && inset.some((u) => u.before.includes('top') && u.before.includes('right')) && inset.some((u) => !u.before.includes('top')) &&
    css.find((u) => u.key === 'css-unit:dvh' && u.value.includes('calc')).earlier === 1 && css.find((u) => u.key === 'css-unit:dvh' && u.supports) !== undefined, '');
  ok('reader of style sheets: lists the conditions of @supports not', (() => { const d = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'bs-')); try { fs.mkdirSync(path.join(d, 'css')); fs.writeFileSync(path.join(d, 'css', 'a.css'), '@supports not (aspect-ratio:1){.e{x:y}} @supports (gap:1px){.f{x:y}}'); return supportsNotConditions(d).join('|') === 'not (aspect-ratio:1)'; } finally { fs.rmSync(d, { recursive: true, force: true }); } })(), '');
  const html = scanHtml(`<!doctype html><html lang="en"><head><style>.q{aspect-ratio:2}</style></head><body>
    <dialog id="d"></dialog><img src="a.webp" loading="lazy" alt=""><input type="email" inputmode="email">
    <svg viewBox="0 0 1 1"><use href="#i"/></svg><button style="inset:0" onclick="x?.y()">b</button>
    <script>const v = 1 ?? 2;</script><script type="application/ld+json">{"a":"?."}</script></body></html>`);
  const hk = keysOf(html);
  ok('reader of pages: finds elements, attributes, input types, inline styles, event handlers and inline scripts (but not JSON-LD)',
    ['html-el:dialog', 'html-attr:img.loading', 'html-input:email', 'html-attr:input.inputmode', 'svg-el:use', 'svg-attr:use.href', 'css-prop:inset', 'css-prop:aspect-ratio'].every((x) => hk.has(x)) && html.filter((u) => u.key.endsWith('optional_chaining')).length === 1 && html.filter((u) => u.key.endsWith('nullish_coalescing')).length === 1,
    ['html-el:dialog', 'html-attr:img.loading', 'html-input:email', 'html-attr:input.inputmode', 'svg-el:use', 'svg-attr:use.href', 'css-prop:inset', 'css-prop:aspect-ratio'].filter((x) => !hk.has(x)).join(' '));
  void stripJs; void parseCss;
}

/* ---- 2. the table ---- */
ok('the table was made for the same browsers as this test (run tools/browser_support_table.mjs after changing them)', JSON.stringify(table.targets) === JSON.stringify(TARGETS), JSON.stringify(table.targets));
ok('the table says which version of MDN\'s compat data it came from', !!(table.bcd && table.bcd.version), table.bcd && table.bcd.version);

/* ---- 3. what the files use ---- */
const found = scanAll(ROOT, { values: new Set(table.watchValues), names: new Set(table.watchNames) });
const filesUsed = (uses) => { const out = {}; for (const u of uses) out[u.file] = (out[u.file] || 0) + 1; return out; };
const where = (uses) => uses.slice(0, 2).map((u) => u.file + ':' + u.line).join(', ');
const okSet = new Set(table.ok);
const missing = [];
for (const [key, uses] of found) if (!okSet.has(key) && !table.features[key] && !(table.unresolved && table.unresolved[key] !== undefined)) missing.push(key + ' (' + where(uses) + ')');
ok(`every feature the files use is in the table (${found.size} found: ${table.ok.length} that all the browsers have, ${Object.keys(table.features).length} newer than one of them, ${Object.keys(table.unresolved).length} with no compat data)`, missing.length === 0,
  missing.slice(0, 6).join('; ') + (missing.length > 6 ? ' and ' + (missing.length - 6) + ' more' : '') + (missing.length ? '  -> look each one up, give it a fallback if it is newer than a target, and run:  node tools/browser_support_table.mjs --bcd <folder of @mdn/browser-compat-data>  (see docs/BROWSER_SUPPORT.md)' : ''));
const noReason = Object.entries(table.unresolved || {}).filter(([, why]) => !why).map(([k]) => k);
ok('every feature with no compat data has a reason written beside it', noReason.length === 0, noReason.slice(0, 6).join(', '));

/* ---- 4. a feature newer than a target is reviewed, and its fallback is real ---- */
const HOWS = new Set(['longhand', 'cascade', 'supports-not', 'prefix-pair', 'guard', 'own', 'manual', 'progressive', 'na']);
const LONGHANDS = { inset: ['top', 'right', 'bottom', 'left'], 'padding-block': ['padding-top', 'padding-bottom'], 'padding-inline': ['padding-left', 'padding-right'], 'margin-block': ['margin-top', 'margin-bottom'], 'margin-inline': ['margin-left', 'margin-right'], 'border-block': ['border-top', 'border-bottom'] };
const supportsNot = supportsNotConditions(ROOT);
const fileText = {};
const text = (f) => (fileText[f] ||= read(f));
const unreviewed = [], badHow = [], pinned = [], mechanical = [], stale = [];
const byHow = {};
for (const [key, e] of Object.entries(table.features)) {
  const uses = found.get(key) || [];
  if (!uses.length) { stale.push(key); continue; }
  if (!e.how || !e.fallback || !HOWS.has(e.how)) { unreviewed.push(key); continue; }
  (byHow[e.how] ||= []).push(key);
  // a person's reviewed claim is checked where a program can check it
  const bad = [];
  const mech = ['longhand', 'cascade', 'prefix-pair'].includes(e.how);
  if (mech) for (const u of uses) if (u.js) bad.push({ file: u.file, line: u.line, why: `${u.file}:${u.line} sets it from a script (el.style): a script cannot write the old way first, so review it by hand` });
  if (e.how === 'longhand') for (const u of uses.filter((x) => !x.js)) { const need = LONGHANDS[u.prop]; if (!need || !need.every((p) => u.before.includes(p))) bad.push(u); }
  if (e.how === 'cascade') for (const u of uses.filter((x) => !x.js)) if (!(u.guarded || u.supports || u.earlier > 0)) bad.push(u);
  if (e.how === 'supports-not') if (!e.needs || !supportsNot.some((c) => c.replace(/\s+/g, '').includes(e.needs.replace(/\s+/g, '')))) bad.push({ file: 'css/*.css', line: 0, why: 'no "@supports not (' + e.needs + ')" block' });
  if (e.how === 'prefix-pair') for (const u of uses.filter((x) => !x.js)) { const base = u.prop.replace(/^-webkit-/, ''); if (!u.props.has(base) || !u.props.has('-webkit-' + base)) bad.push(u); }
  if (e.how === 'guard') { if (!e.guard) bad.push({ file: '', line: 0, why: 'no guard written' }); else for (const f of Object.keys(filesUsed(e.guardScope === 'member-call' ? uses.filter((u) => u.member && u.call) : uses))) if (!new RegExp(e.guard).test(text(f))) bad.push({ file: f, line: 0, why: 'no test matching /' + e.guard + '/' }); }
  if (e.how === 'own') { const forbid = e.forbid; if (forbid === 'member-call') for (const u of uses) if (u.member && u.call) bad.push(u); if (forbid === 'call') for (const u of uses) if (u.call) bad.push(u); }
  if (bad.length) mechanical.push(`${key}: ${bad.slice(0, 2).map((u) => u.why || `${u.file}:${u.line}`).join(', ')}${bad.length > 2 ? ' and ' + (bad.length - 2) + ' more' : ''}`);
  // a use of a risky feature that was not there when it was reviewed
  if (e.how === 'manual' || e.pin) { const had = e.uses || {}; const now = filesUsed(uses); for (const [f, n] of Object.entries(now)) if (n > (had[f] || 0)) pinned.push(`${key}: ${f} uses it ${n} times, ${had[f] || 0} were reviewed`); }
}
ok('every feature newer than a target has a reviewed way of coping (how, and a fallback in plain words)', unreviewed.length === 0 && badHow.length === 0, unreviewed.slice(0, 6).join(', ') + (unreviewed.length ? '  (add "how" and "fallback" to it in the table: docs/BROWSER_SUPPORT.md)' : ''));
ok('where a program can check the way of coping, it holds: the old way written first (longhand, cascade), an @supports not block (supports-not), a prefixed twin (prefix-pair), a test before the call (guard), our own name (own)', mechanical.length === 0, mechanical.slice(0, 6).join('; '));
ok('no new use of the features whose fallback was weighed one by one (aspect-ratio, :is(), :has(), :focus-visible, rotate, scale, translate, <dialog>): a new one needs a review, then run tools/browser_support_table.mjs', pinned.length === 0, pinned.slice(0, 6).join('; '));
if (stale.length) info(`(${stale.length} feature${stale.length === 1 ? '' : 's'} in the table are no longer used: ${stale.slice(0, 5).join(', ')}${stale.length > 5 ? ', ...' : ''}; run tools/browser_support_table.mjs to drop them)`);

/* ---- 5. the oldest browsers: what the table says about the first versions ---- */
const lateFor = (browser) => Object.entries(table.features).filter(([k, e]) => e.late && e.late.includes(browser) && (found.get(k) || []).length);
const cannot = {};
for (const b of Object.keys(TARGETS)) cannot[b] = lateFor(b).filter(([, e]) => e.how === 'manual' || e.how === 'progressive').length;
info('newer than the oldest browser the site is made for, and not covered by a fallback that is checked above (the page reads and works without them; docs/BROWSER_SUPPORT.md says what each one changes): ' + Object.entries(cannot).map(([b, n]) => b.replace('samsunginternet_android', 'Samsung Internet').replace('chrome_android', 'Chrome on Android').replace('safari_ios', 'Safari on iPhone').replace(/^chrome$/, 'Chrome').replace(/^safari$/, 'Safari').replace(/^firefox$/, 'Firefox') + ' ' + n).join(', '));
info('compat data: MDN browser-compat-data ' + table.bcd.version + '; ' + Object.keys(byHow).map((h) => `${byHow[h].length} ${h}`).join(', '));

await finish({});
