#!/usr/bin/env node
/* A developer's tool (needs Node, and the network once to get MDN's browser-compat-data). Not for the farm owner.
 *
 * It reads the site's own files with tests/browser-support.scan.mjs, looks every browser feature they use up in MDN's compat data and writes
 * tests/browser-support.table.json: for each feature, the first version of each browser that has it, and whether that is newer than the
 * oldest browsers the site is made for. tests/browser-support.test.mjs reads the table (no network, no browser) and fails when a file uses a
 * feature that is not in it or is newer than those browsers and has no reviewed fallback. What a person wrote by hand in the table (how a
 * newer feature is covered, and the notes) is kept when the table is made again.
 *
 *   npm install --prefix ../bcd @mdn/browser-compat-data
 *   node tools/browser_support_table.mjs --bcd ../bcd/node_modules/@mdn/browser-compat-data
 *   node tools/browser_support_table.mjs --check          only say whether the table is complete (the test does this too)
 *   node tools/browser_support_table.mjs --bcd <folder> --report safari_ios 13.0    what the site uses that this browser version does not have
 * Without --bcd it tries to import "@mdn/browser-compat-data" from the folder it is run in. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { TARGETS, AMBIGUOUS_NAMES, scanAll } from '../tests/browser-support.scan.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TABLE = path.join(ROOT, 'tests', 'browser-support.table.json');
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };

/* ------------------------------------------------------------------ the compat data */
async function loadBcd() {
  const where = opt('--bcd');
  const require = createRequire(path.join(where ? path.resolve(where) : process.cwd(), 'x.js'));
  try { return require(where ? path.resolve(where) : '@mdn/browser-compat-data'); } catch (e) { /* try as an ES module */ }
  try { const m = await import(where ? pathToFileURL(path.resolve(where, 'data.json')).href : '@mdn/browser-compat-data', { with: { type: 'json' } }); return m.default; } catch (e) {
    console.error('I cannot load MDN\'s browser-compat-data. Install it once:  npm install --prefix ../bcd @mdn/browser-compat-data\nthen run:  node tools/browser_support_table.mjs --bcd ../bcd/node_modules/@mdn/browser-compat-data');
    process.exit(2);
  }
}

const num = (v) => { if (v === true) return 0; if (v === false || v == null || v === 'preview') return Infinity; return parseFloat(String(v).replace('≤', '')); };

/** For one browser: min (first version with the feature plainly), prefixed (first with a prefix or another name), ok (works at the target version). */
function plain(support, browser, at) {
  const s = support && support[browser];
  if (!s) return { min: Infinity, prefixed: Infinity, ok: false };
  const T = at ?? TARGETS[browser];
  let min = Infinity, prefixed = Infinity, ok = false, anyMin = Infinity, prefixedOk = false;
  for (const st of Array.isArray(s) ? s : [s]) {
    if (st.flags) continue;
    const added = num(st.version_added), removed = st.version_removed ? num(st.version_removed) : Infinity;
    if (st.prefix || st.alternative_name) { prefixed = Math.min(prefixed, added); if (added <= T && removed > T) prefixedOk = true; continue; }
    anyMin = Math.min(anyMin, added);
    if (removed === Infinity) min = Math.min(min, added);
    if (added <= T && removed > T) ok = true;
  }
  return { min: min === Infinity ? anyMin : min, prefixed, ok, prefixedOk };
}

const BCD = await loadBcd();
const get = (p) => (p ? p.split('.').reduce((o, k) => (o ? o[k] : undefined), BCD) : undefined);
const exists = (p) => { const c = get(p); return c && c.__compat ? p : null; };
/** the path with the same letters in any case (clipPath, viewBox: the pages are read in lower case) */
const ci = (parent, name) => { const o = get(parent); if (!o) return null; const k = Object.keys(o).find((x) => x.toLowerCase() === name.toLowerCase()); return k ? parent + '.' + k : null; };

function versionsOf(p, { prefixed = false, at = {} } = {}) {
  const c = get(p);
  const out = {};
  for (const b of Object.keys(TARGETS)) { const v = plain(c.__compat.support, b, at[b]); out[b] = { min: prefixed ? Math.min(v.min, v.prefixed) : v.min, ok: prefixed ? v.ok || v.prefixedOk : v.ok }; }
  return out;
}

/* ------------------------------------------------------------------ keys -> paths in the compat data */
const cssIdx = Object.create(null);
(function walk(o, pre) { for (const [k, v] of Object.entries(o)) { if (k === '__compat' || typeof v !== 'object') continue; const p = pre + '.' + k; (cssIdx[k] ||= []).push(p); walk(v, p); } })(BCD.css, 'css');
const LENGTH = { dv: 'viewport_percentage_units_dynamic', sv: 'viewport_percentage_units_small', lv: 'viewport_percentage_units_large', cq: 'container_query_length_units' };
const first = (...ps) => { for (const p of ps) { const e = exists(p); if (e) return e; } return null; };

function resolve(key) {
  const i = key.indexOf(':'), kind = key.slice(0, i), name = key.slice(i + 1);
  switch (kind) {
    case 'css-prop': {
      if (name === '--*') return { path: exists('css.properties.custom-property') };
      const direct = exists('css.properties.' + name); if (direct) return { path: direct };
      const m = name.match(/^-(?:webkit|moz|ms|o)-(.*)$/);
      if (m) { const p = exists('css.properties.' + m[1]); if (p) return { path: p, prefixed: true }; }
      return { path: first('css.at-rules.font-face.' + name, 'css.at-rules.property.' + name) };
    }
    case 'css-gap': return { path: exists('css.properties.gap.' + (name === 'flex' ? 'flex_context' : name === 'grid' ? 'grid_context' : 'multicol_context')) };
    case 'css-fn': {
      const ownColor = { rgba: 'css.types.color.rgb', hsla: 'css.types.color.hsl' }[name];
      const tf = ci('css.types.transform-function', name);
      return { path: first(ownColor, tf, 'css.types.' + name, 'css.types.transform-function.' + name, 'css.types.filter-function.' + name, 'css.types.basic-shape.' + name, 'css.types.gradient.' + name, 'css.types.color.' + name, 'css.properties.grid-template-columns.' + name,
        ...(cssIdx[name] || []).filter((p) => p.startsWith('css.types') || p.startsWith('css.properties')).slice(0, 1)) };
    }
    case 'css-unit': {
      const group = LENGTH[name.slice(0, 2)] && /^(?:dv|sv|lv|cq)(?:w|h|i|b|min|max)$/.test(name) ? LENGTH[name.slice(0, 2)] : null;
      if (group) return { path: exists('css.types.length.' + group) };
      return { path: first('css.types.length.' + name, 'css.types.' + ({ fr: 'flex', deg: 'angle', rad: 'angle', turn: 'angle', grad: 'angle', s: 'time', ms: 'time', dpi: 'resolution', dppx: 'resolution', x: 'resolution' }[name] || 'length')) };
    }
    case 'css-pseudo': return { path: exists('css.selectors.' + name) };
    case 'css-sel': return { path: exists({ 'not-list': 'css.selectors.not.selector_list', nesting: 'css.selectors.nesting', 'nth-child-of': 'css.selectors.nth-child.of_syntax' }[name]) };
    case 'css-at': return { path: exists('css.at-rules.' + name) };
    case 'css-container': return { path: exists('css.at-rules.container') };
    case 'css-media': return { path: exists({ 'range-syntax': 'css.at-rules.media.range_syntax', 'or-syntax': 'css.at-rules.media.or_syntax' }[name] || 'css.at-rules.media.' + name) };
    case 'css-color': return { path: exists({ 'hex-alpha': 'css.types.color.rgb_hexadecimal_notation.alpha_hexadecimal_notation', 'space-separated': 'css.types.color.rgb.space_separated_parameters', 'slash-alpha': 'css.types.color.rgb.alpha_parameter' }[name]) };
    case 'css-value': { const j = name.indexOf(':'); return { path: exists('css.properties.' + name.slice(0, j) + '.' + name.slice(j + 1)) }; }
    case 'js-syntax': return { path: exists(name) };
    case 'html-el': return { path: ci('html.elements', name) };
    case 'svg-el': return { path: ci('svg.elements', name) };
    case 'html-attr': {
      const [tag, attr] = name.split('.');
      const el = ci('html.elements', tag);
      return { path: (el && ci(el, attr)) || ci('html.global_attributes', attr) };
    }
    case 'svg-attr': {
      const [tag, attr] = name.split('.');
      const el = ci('svg.elements', tag);
      return { path: (el && ci(el, attr)) || ci('svg.global_attributes', attr) };
    }
    case 'html-input': return { path: exists('html.elements.input.type_' + name) };
    case 'html-rel': return { path: exists('html.elements.link.rel.' + name) || exists('html.elements.a.rel.' + name) };
    case 'html-script': return { path: exists('javascript.statements.import') };
    case 'js-name': return { path: bestForName(name) };
  }
  return { path: null };
}

/* a method, property or global such as "replaceChildren" or "requestIdleCallback": every place in the compat data that has the name */
const nameIdx = Object.create(null);
(function () {
  const add = (root, prefix, depth) => { for (const [k, v] of Object.entries(root)) { if (k === '__compat' || typeof v !== 'object') continue; const p = prefix + '.' + k; (nameIdx[k] ||= []).push(p); if (depth < 1) add(v, p, depth + 1); } };
  for (const [iface, v] of Object.entries(BCD.api)) { if (typeof v !== 'object') continue; (nameIdx[iface] ||= []).push('api.' + iface); add(v, 'api.' + iface, 0); }
  for (const [iface, v] of Object.entries(BCD.javascript.builtins)) { if (typeof v !== 'object') continue; (nameIdx[iface] ||= []).push('javascript.builtins.' + iface); add(v, 'javascript.builtins.' + iface, 0); }
})();
const nameVersions = (name) => {   // the best case over every place that has the name: the earliest version of each browser
  const best = {}; for (const b of Object.keys(TARGETS)) best[b] = { min: Infinity, ok: false };
  const paths = nameIdx[name] || [];
  for (const p of paths) { if (!get(p) || !get(p).__compat) continue; const v = versionsOf(p); for (const b of Object.keys(TARGETS)) { best[b].min = Math.min(best[b].min, v[b].min); best[b].ok = best[b].ok || v[b].ok; } }
  return { best, paths };
};
function bestForName(name) { return (nameIdx[name] || []).find((p) => get(p) && get(p).__compat) || null; }

/** The objects a site's own scripts talk to. A name is on the watch list when it is a member of one of these AND exists only in browsers newer than the
 * targets (in every place the compat data knows it) AND at least two engines ship it: the new methods and properties a person might start using. */
const CORE = ['Window', 'Navigator', 'Document', 'Element', 'Node', 'HTMLElement', 'EventTarget', 'Event', 'CustomEvent', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'TouchEvent', 'UIEvent', 'CSSStyleDeclaration', 'CSSStyleSheet', 'History', 'Location', 'Storage', 'URL', 'URLSearchParams', 'Blob', 'File', 'FormData', 'Headers', 'Request', 'Response', 'AbortController', 'AbortSignal', 'MutationObserver', 'IntersectionObserver', 'ResizeObserver', 'PerformanceObserver', 'Performance', 'DOMTokenList', 'NodeList', 'Range', 'Selection', 'MediaQueryList', 'Screen', 'VisualViewport', 'Clipboard', 'HTMLDialogElement', 'HTMLDetailsElement', 'HTMLImageElement', 'HTMLInputElement', 'HTMLFormElement', 'HTMLMediaElement', 'HTMLVideoElement', 'HTMLCanvasElement', 'HTMLSelectElement', 'HTMLTextAreaElement', 'HTMLButtonElement', 'HTMLAnchorElement', 'HTMLTemplateElement', 'SVGElement', 'SVGSVGElement', 'SVGGraphicsElement', 'DocumentFragment', 'CharacterData', 'Text', 'ParentNode', 'ChildNode', 'Animation', 'CanvasRenderingContext2D', 'Crypto', 'TextEncoder', 'TextDecoder', 'ShadowRoot', 'Intl'];
const CORE_JS = ['Array', 'String', 'Object', 'Promise', 'Number', 'Math', 'Set', 'Map', 'WeakMap', 'WeakSet', 'Date', 'JSON', 'Symbol', 'Reflect', 'RegExp', 'Function', 'Error', 'BigInt', 'Proxy', 'TypedArray', 'ArrayBuffer', 'AggregateError', 'WeakRef', 'FinalizationRegistry', 'Atomics', 'Iterator'];
function watchNames() {
  const core = new Set();
  for (const i of CORE) { const o = BCD.api[i]; if (o) { core.add(i); for (const k of Object.keys(o)) if (k !== '__compat' && typeof o[k] === 'object') core.add(k); } }
  for (const k of Object.keys(BCD.api)) if (/^[a-z]/.test(k)) core.add(k);   // the functions of the page itself: structuredClone, queueMicrotask, reportError ...
  for (const i of CORE_JS) { const o = BCD.javascript.builtins[i]; if (o) { core.add(i); for (const k of Object.keys(o)) if (k !== '__compat' && typeof o[k] === 'object') core.add(k); } }
  const out = [];
  for (const name of core) {
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name) || /^aria[A-Z]/.test(name) || (name.length < 5 && !['at', 'any', 'with'].includes(name))) continue;   // short words are the site's own more often than not
    const { best, paths } = nameVersions(name);
    if (!paths.length || !Object.keys(TARGETS).some((b) => !best[b].ok)) continue;
    const engines = ['chrome', 'firefox', 'safari'].filter((b) => best[b].min < Infinity).length;
    if (engines >= 2) out.push(name);
  }
  return out.sort();
}
function watchValues(usedProps) {
  const out = [];
  for (const prop of usedProps) {
    const v = BCD.css.properties[prop]; if (!v) continue;
    for (const [val, w] of Object.entries(v)) {
      if (val === '__compat' || typeof w !== 'object' || !w.__compat || !/^[a-z][a-z-]*$/.test(val)) continue;
      const vv = versionsOf('css.properties.' + prop + '.' + val);
      const engines = ['chrome', 'firefox', 'safari'].filter((b) => vv[b].min < Infinity).length;
      if (engines >= 2 && Object.keys(TARGETS).some((b) => !vv[b].ok)) out.push(prop + ':' + val);
    }
  }
  return out.sort();
}

/** One line for each feature, so the file stays short and a change shows as a few lines in a diff. */
function format(t) {
  const obj = (o) => '{\n  ' + Object.entries(o).map(([k, v]) => JSON.stringify(k) + ': ' + JSON.stringify(v)).join(',\n  ') + '\n }';
  const wrap = (arr) => { const out = []; let line = ''; for (const x of arr) { const s = JSON.stringify(x) + ', '; if (line.length + s.length > 150) { out.push(line.trimEnd()); line = ''; } line += s; } if (line) out.push(line.trimEnd()); return '[\n  ' + out.join('\n  ').replace(/,$/, '') + '\n ]'; };
  return '{\n "about": ' + JSON.stringify(t.about) + ',\n "bcd": ' + JSON.stringify(t.bcd) + ',\n "targets": ' + JSON.stringify(t.targets) + ',\n "watchNames": ' + wrap(t.watchNames) + ',\n "watchValues": ' + wrap(t.watchValues) +
    ',\n "ok": ' + wrap(t.ok) + ',\n "features": ' + obj(t.features) + ',\n "unresolved": ' + obj(t.unresolved) + '\n}\n';
}

/* ------------------------------------------------------------------ the table */
const previous = fs.existsSync(TABLE) ? JSON.parse(fs.readFileSync(TABLE, 'utf8')) : { features: {}, unresolved: {} };
const usedProps = new Set();   // the properties the style sheets use (a first scan without the value watch)
for (const k of scanAll(ROOT, {}).keys()) if (k.startsWith('css-prop:')) usedProps.add(k.slice(9).replace(/^-(?:webkit|moz|ms|o)-/, ''));
const watch = { names: new Set([...watchNames(), ...Object.keys(AMBIGUOUS_NAMES)]), values: new Set(watchValues(usedProps)) };
const found = scanAll(ROOT, watch);

if (opt('--report')) {   // what the site uses that a given browser version lacks:  --report safari_ios 13.0
  const [, browser, version] = args.slice(args.indexOf('--report') - 0, args.indexOf('--report') + 3);
  const rows = [];
  for (const [key, uses] of found) {
    const r = resolve(key);
    let best = null;
    if (key.startsWith('js-name:')) { const { best: bb } = nameVersions(key.slice(8)); if (bb[browser] && !(bb[browser].min <= Number(version))) best = bb[browser].min; }
    else if (r.path) { const v = versionsOf(r.path, { prefixed: !!r.prefixed, at: { [browser]: Number(version) } }); if (!v[browser].ok) best = v[browser].min; }
    if (best !== null) { const files = {}; for (const u of uses) files[u.file] = (files[u.file] || 0) + 1; rows.push(`${key.padEnd(46)} from ${String(best).padEnd(8)} ${uses.length} uses  ${Object.keys(files).slice(0, 3).join(', ')}`); }
  }
  console.log(`Used by the site and not in ${browser} ${version}:\n  ` + rows.join('\n  ') + `\n(${rows.length} of ${found.size})`);
  process.exit(0);
}

const table = {
  about: 'Made by tools/browser_support_table.mjs from MDN\'s browser-compat-data; read by tests/browser-support.test.mjs. Do not edit the numbers: run the tool again. The notes in "features" (how, fallback) are written by a person and kept.',
  bcd: { version: BCD.__meta.version, timestamp: BCD.__meta.timestamp },
  targets: TARGETS,
  watchNames: [...watch.names],
  watchValues: [...watch.values],
  ok: [],
  features: {},
  unresolved: {},
};
/** what a person wrote in the table: kept when it is made again */
const keep = (prev) => (prev ? Object.fromEntries(['how', 'needs', 'guard', 'guardScope', 'forbid', 'pin', 'fallback'].filter((k) => prev[k] !== undefined).map((k) => [k, prev[k]])) : {});
const todo = [];
for (const [key, uses] of [...found.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const r = resolve(key);
  const files = {}; for (const u of uses) files[u.file] = (files[u.file] || 0) + 1;
  if (key.startsWith('js-name:')) {   // only the names in the watch list got here (see scanAll)
    const amb = AMBIGUOUS_NAMES[key.slice(8)];
    let best = nameVersions(key.slice(8)).best;
    if (amb && get(amb) && get(amb).__compat) { const v = versionsOf(amb); best = Object.fromEntries(Object.keys(TARGETS).map((b) => [b, v[b]])); r.path = amb; }
    const late = Object.keys(TARGETS).filter((b) => !best[b].ok);
    const prev = previous.features[key];
    table.features[key] = { bcd: r.path, min: Object.fromEntries(Object.keys(TARGETS).map((b) => [b, best[b].min])), late, uses: files, ...keep(prev) };
    if (!prev || !prev.how) todo.push(key);
    continue;
  }
  if (!r.path) {
    table.unresolved[key] = (previous.unresolved && previous.unresolved[key]) || '';
    if (!table.unresolved[key]) todo.push(key);
    continue;
  }
  const v = versionsOf(r.path, { prefixed: !!r.prefixed });
  const late = Object.keys(TARGETS).filter((b) => !v[b].ok);
  if (!late.length) { table.ok.push(key); continue; }
  const prev = previous.features[key];
  table.features[key] = { bcd: r.path, ...(r.prefixed ? { prefixed: true } : {}), min: Object.fromEntries(Object.keys(TARGETS).map((b) => [b, v[b].min])), late, uses: files, ...keep(prev) };
  if (!prev || !prev.how || !prev.fallback) todo.push(key);
}
table.ok.sort();
if (args.includes('--check')) {
  const same = JSON.stringify(Object.keys(previous.features || {}).sort()) === JSON.stringify(Object.keys(table.features).sort());
  console.log(same && !todo.length ? 'The table is complete.' : 'The table is out of date or has features without a reviewed fallback: ' + todo.length + ' to review.');
  process.exit(same && !todo.length ? 0 : 1);
}
fs.writeFileSync(TABLE, format(table));
console.log(`Wrote ${path.relative(ROOT, TABLE)}: ${table.ok.length} features every target has, ${Object.keys(table.features).length} newer than a target, ${Object.keys(table.unresolved).length} with no compat data. (compat data ${BCD.__meta.version})`);
if (todo.length) console.log('To review by hand (add "how" and "fallback" in the table, see docs/BROWSER_SUPPORT.md):\n  ' + todo.join('\n  '));
