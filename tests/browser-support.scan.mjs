/* Reads the site's own files (js/*.js, css/*.css, the pages, print/) and lists every browser feature they use, each named by its path in MDN's
 * browser-compat-data ("css.properties.gap", "css.selectors.focus-visible", "api.IntersectionObserver", "javascript.operators.optional_chaining").
 * It is used twice and needs nothing from the network or from npm:
 *   - tools/browser_support_table.mjs (a developer's tool) looks each name up in the compat data and writes tests/browser-support.table.json;
 *   - tests/browser-support.test.mjs reads that table and fails for a feature that is not in it, or is newer than the browsers the site supports.
 * It reads the code the way a person would, with plain pattern matching (no parser to install), so it can be wrong in two ways: a use it cannot
 * see (it only looks for the patterns below), and a use it sees that is not one (a word that is also a feature's name). The table has a place
 * to say "reviewed: this is our own function" for the second kind. */
import fs from 'node:fs';
import path from 'node:path';

/* ------------------------------------------------------------------ which files */
export function sourceFiles(root) {
  const out = [];
  const list = (dir, test) => { const d = path.join(root, dir); if (!fs.existsSync(d)) return; for (const f of fs.readdirSync(d).sort()) if (test(f)) out.push((dir ? dir + '/' : '') + f); };
  list('js', (f) => f.endsWith('.js'));
  list('css', (f) => f.endsWith('.css'));
  list('', (f) => f.endsWith('.html'));      // index.html, the five built pages, 404.html
  list('print', (f) => f.endsWith('.html'));
  return out;
}

// the line number of a position, counted from the newlines found once for each text (the last text is remembered, so reading one file is quick)
let lineText = null, lineStarts = [];
const lineOf = (text, index) => {
  if (text !== lineText) { lineText = text; lineStarts = []; for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) lineStarts.push(i); }
  let lo = 0, hi = lineStarts.length;   // the number of newlines before index
  while (lo < hi) { const mid = (lo + hi) >> 1; if (lineStarts[mid] < index) lo = mid + 1; else hi = mid; }
  return lo + 1;
};
const blank = (s) => s.replace(/[^\n]/g, ' ');

/* ------------------------------------------------------------------ JavaScript */
const KEYWORD_BEFORE_REGEX = /(?:^|[^\w$.])(?:return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else|yield|await)$/;

/** The code with every comment, string and template text blanked out (same length, same lines), and the regular expression literals listed. */
export function stripJs(src) {
  let out = '', i = 0;
  const regexes = [];
  const stack = [];              // open template literals: the depth of "{" inside each ${ }
  let depth = 0, last = '';      // last: the last significant character of code (to tell "/" the divider from "/" the start of a regular expression)
  const n = src.length;
  const keep = (s) => { out += s; const t = s.replace(/\s+$/, ''); if (t) last = t[t.length - 1]; };
  const readTemplate = () => {  // after the opening backtick: blank the text; stop at the closing backtick or at "${"
    let j = i;
    while (j < n) {
      const c = src[j];
      if (c === '\\') { j += 2; continue; }
      if (c === '`') { out += blank(src.slice(i, j)) + '`'; i = j + 1; last = '`'; return false; }
      if (c === '$' && src[j + 1] === '{') { out += blank(src.slice(i, j)) + '${'; i = j + 2; stack.push(depth); depth = 0; last = '{'; return true; }
      j++;
    }
    out += blank(src.slice(i)); i = n; return false;
  };
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { let j = src.indexOf('\n', i); if (j < 0) j = n; out += blank(src.slice(i, j)); i = j; continue; }
    if (c === '/' && d === '*') { let j = src.indexOf('*/', i + 2); j = j < 0 ? n : j + 2; out += blank(src.slice(i, j)); i = j; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
      out += c + blank(src.slice(i + 1, j)) + (src[j] === c ? c : ''); i = Math.min(j + 1, n); last = c; continue;
    }
    if (c === '`') { out += '`'; i++; readTemplate(); continue; }
    if (c === '{') { depth++; keep(c); i++; continue; }
    if (c === '}') {
      if (stack.length && depth === 0) { depth = stack.pop(); out += '}'; i++; last = '}'; readTemplate(); continue; }   // the end of a ${ }: the template text goes on
      depth--; keep(c); i++; continue;
    }
    if (c === '/') {
      const divider = /[\w$)\]]/.test(last) && !KEYWORD_BEFORE_REGEX.test(out.slice(-12));
      if (!divider) {   // a regular expression literal
        let j = i + 1, inClass = false;
        while (j < n && src[j] !== '\n') { const e = src[j]; if (e === '\\') { j += 2; continue; } if (e === '[') inClass = true; else if (e === ']') inClass = false; else if (e === '/' && !inClass) break; j++; }
        if (src[j] === '/') {
          let k = j + 1; while (k < n && /[a-z]/.test(src[k])) k++;
          regexes.push({ pattern: src.slice(i + 1, j), flags: src.slice(j + 1, k), index: i });
          out += '/' + blank(src.slice(i + 1, j)) + '/' + src.slice(j + 1, k); i = k; last = '/'; continue;
        }
      }
    }
    keep(c); i++;
  }
  return { code: out, regexes };
}

/** Names that exist on older objects too, so a list of "only in new browsers" cannot hold them, but that a script can use in the new way: the name and the compat-data path of the new use. */
export const AMBIGUOUS_NAMES = {
  show: 'api.HTMLDialogElement.show',
  showModal: 'api.HTMLDialogElement.showModal',
  close: 'api.HTMLDialogElement.close',
  showPicker: 'api.HTMLInputElement.showPicker',
  requestSubmit: 'api.HTMLFormElement.requestSubmit',
  scrollIntoViewIfNeeded: 'api.Element.scrollIntoViewIfNeeded',
  replaceState: 'api.History.replaceState',
};

/* JavaScript syntax newer than ES2015, named by their path in the compat data. A pattern runs over the code with the strings and comments blanked out. */
const JS_SYNTAX = [
  ['javascript.operators.optional_chaining', /\?\.(?!\d)/g],
  ['javascript.operators.nullish_coalescing', /\?\?(?!=)/g],
  ['javascript.operators.nullish_coalescing_assignment', /\?\?=/g],
  ['javascript.operators.logical_or_assignment', /\|\|=/g],
  ['javascript.operators.logical_and_assignment', /&&=/g],
  ['javascript.classes.private_class_fields', /(?:^|[^\w$'"`#])#[A-Za-z_$][\w$]*/g],
  ['javascript.classes.static.initialization_blocks', /\bstatic\s*\{/g],
  ['javascript.builtins.BigInt', /(?<![\w$.])\d+n\b/g],
  ['javascript.grammar.numeric_separators', /(?<![\w$.])\d+_\d[\d_]*/g],
  ['javascript.operators.await.top_level', /^await\b/gm],
  ['javascript.statements.for_await_of', /\bfor\s+await\b/g],
  ['javascript.operators.import', /(?<![\w$.])import\s*\(/g],
  ['javascript.operators.import_meta', /\bimport\.meta\b/g],
  ['javascript.statements.import', /^\s*import\s+[\w{*]/gm],
  ['javascript.statements.export', /^\s*export\s+/gm],
  ['javascript.statements.try_catch.optional_catch_binding', /\bcatch\s*\{/g],
  ['javascript.operators.exponentiation', /\*\*/g],
  ['javascript.functions.arrow_functions', /=>/g],
  ['javascript.statements.async_function', /\basync\s+(?:function\b|\(|[\w$]+\s*=>)/g],
  ['javascript.operators.await', /(?<![\w$.])await\s+[\w$(\[`'"!-]/g],
  ['javascript.operators.spread', /\.\.\.[\w$(\[{]/g],
  ['javascript.grammar.template_literals', /`/g],
  ['javascript.statements.for_of', /\bfor\s*\(\s*(?:const|let|var)\s+[^;]*?\bof\b/g],
  ['javascript.statements.class', /\bclass\s+[\w$]+\s*(?:extends\s+[\w$.]+\s*)?\{/g],
  ['javascript.statements.generator_function', /\bfunction\s*\*|\*\s*[\w$]+\s*\([^)]*\)\s*\{/g],
];
const JS_REGEX_SYNTAX = [
  ['javascript.regular_expressions.lookbehind_assertion', (p) => /\(\?<[=!]/.test(p)],
  ['javascript.regular_expressions.named_capturing_group', (p) => /\(\?<[A-Za-z_$]/.test(p)],
  ['javascript.regular_expressions.unicode_character_class_escape', (p) => /\\[pP]\{/.test(p)],
];
const JS_REGEX_FLAGS = { s: 'javascript.builtins.RegExp.dotAll', d: 'javascript.builtins.RegExp.hasIndices', v: 'javascript.builtins.RegExp.unicodeSets', y: 'javascript.builtins.RegExp.sticky', u: 'javascript.builtins.RegExp.unicode' };

// Reserved words and words every script has: never a feature's name
const NOT_A_NAME = new Set('if for while switch catch function return typeof new delete void do else try finally throw case default var let const class extends super this null true false undefined NaN Infinity in of instanceof yield await async static get set constructor prototype arguments length name'.split(' '));

/** Every use in a script: [{ key, line }]. "js-name:X" is the word X used as a method, a property or a global, kept for the "watch list" of the table. */
export function scanJs(text, offsetLine = 0) {
  const { code, regexes } = stripJs(text);
  const uses = [];
  const at = (index) => lineOf(code, index) + offsetLine;
  for (const [key, rx] of JS_SYNTAX) { rx.lastIndex = 0; for (const m of code.matchAll(rx)) uses.push({ key: 'js-syntax:' + key, line: at(m.index) }); }
  for (const r of regexes) {
    for (const [key, test] of JS_REGEX_SYNTAX) if (test(r.pattern)) uses.push({ key: 'js-syntax:' + key, line: at(r.index) });
    for (const f of r.flags) if (JS_REGEX_FLAGS[f]) uses.push({ key: 'js-syntax:' + JS_REGEX_FLAGS[f], line: at(r.index) });
  }
  // member: written after a dot (el.close); call: followed by "(" . The table can say "our own function, never the method" with these.
  const name = (nm, index, member, endIndex) => { if (NOT_A_NAME.has(nm)) return; uses.push({ key: 'js-name:' + nm, line: at(index), member, call: /^\s*\(/.test(code.slice(endIndex, endIndex + 8)) }); };
  for (const m of code.matchAll(/(?:\?\.|(?<![.\d])\.(?!\.))\s*([A-Za-z_$][\w$]*)/g)) name(m[1], m.index, true, m.index + m[0].length);
  for (const m of code.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\s*\(/g)) uses.push({ key: 'js-name:' + m[1], line: at(m.index), member: false, call: true });   // a plain call: requestIdleCallback(...), structuredClone(...)
  for (const m of code.matchAll(/\bnew\s+([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)/g)) { for (const part of m[1].split('.')) uses.push({ key: 'js-name:' + part, line: at(m.index), member: false, call: true }); }
  for (const m of code.matchAll(/(?<![\w$.])([A-Z][A-Za-z0-9]{2,})\b/g)) name(m[1], m.index, false, m.index + m[0].length);   // a global such as HTMLDialogElement or Intl
  // styles a script sets: el.style.aspectRatio = ..., el.style.setProperty('inset', ...), el.style.cssText = 'a:b;c:d'  (read from the text: the quote marks matter)
  const kebab = (n) => n.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
  const noComments = text.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g, (m, a1) => (a1 || '') + blank(m.slice((a1 || '').length)));
  for (const m of code.matchAll(/\.style\.([a-z][A-Za-z]*)\s*=(?!=)/g)) if (m[1] !== 'cssText') uses.push({ key: 'css-prop:' + (m[1] === 'cssFloat' ? 'float' : kebab(m[1])), line: at(m.index), js: true });
  for (const m of noComments.matchAll(/\.style\.setProperty\(\s*['"]([a-zA-Z-]+)['"]/g)) uses.push({ key: 'css-prop:' + (m[1].startsWith('--') ? '--*' : m[1]), line: lineOf(noComments, m.index) + offsetLine, js: true });
  for (const m of noComments.matchAll(/\.style\.cssText\s*[+]?=\s*(['"])((?:(?!\1)[^\\\n]|\\.)*)\1/g)) for (const u of scanCss('x{' + m[2] + '}', { watchValues: new Set() })) uses.push({ key: u.key, line: lineOf(noComments, m.index) + offsetLine, js: true });
  const seenUse = new Set();
  return uses.filter((u) => {
    if (u.key.startsWith('js-name:') && NOT_A_NAME.has(u.key.slice(8))) return false;
    const id = u.key + '|' + u.line + '|' + u.member + '|' + u.call;   // the same word found by two of the patterns above counts once
    if (seenUse.has(id)) return false;
    seenUse.add(id); return true;
  });
}

/* ------------------------------------------------------------------ CSS */
/** Splits CSS into pieces: [{ type: 'rule', prelude, atrules: [..the at-rules around it..], decls: [{prop, value, line}] }, { type: 'at', name, prelude, line }] */
export function parseCss(text, offsetLine = 0) {
  const src = text.replace(/\/\*[\s\S]*?\*\//g, (m) => blank(m));
  const items = [];
  const n = src.length;
  let i = 0;
  const chain = [];          // the open at-rules: { name, prelude }
  const skipString = (j) => { const q = src[j]; j++; while (j < n && src[j] !== q) j += src[j] === '\\' ? 2 : 1; return j + 1; };
  const readUntil = (j, stops) => {   // from j to the first of the stop characters outside (), [] and strings
    let paren = 0;
    while (j < n) {
      const c = src[j];
      if (c === '"' || c === "'") { j = skipString(j); continue; }
      if (c === '(' || c === '[') paren++;
      else if (c === ')' || c === ']') paren--;
      else if (paren <= 0 && stops.includes(c)) return j;
      j++;
    }
    return j;
  };
  const block = (j, ctx) => {    // j is just after "{"; reads declarations and nested rules until the matching "}"
    const decls = [];
    for (;;) {
      while (j < n && /\s/.test(src[j])) j++;
      if (j >= n) return { end: j, decls };
      if (src[j] === '}') return { end: j + 1, decls };
      if (src[j] === ';') { j++; continue; }
      const stop = readUntil(j, ['{', ';', '}']);
      const head = src.slice(j, stop), line = lineOf(src, j) + offsetLine;
      if (src[stop] === '{') {   // a rule or an at-rule inside
        const prelude = head.trim();
        if (prelude.startsWith('@')) {
          const m = prelude.match(/^@([\w-]+)\s*([\s\S]*)$/);
          const at = { name: m[1].toLowerCase(), prelude: m[2].trim(), line };
          items.push({ type: 'at', ...at, atrules: chain.map((c) => c.name + ' ' + c.prelude) });
          chain.push(at);
          const inner = block(stop + 1, at.name);
          chain.pop();
          if (inner.decls.length && !['keyframes', '-webkit-keyframes'].includes(at.name)) items.push({ type: 'rule', prelude: '', atrules: chain.map((c) => c.name + ' ' + c.prelude).concat(at.name + ' ' + at.prelude), decls: inner.decls, line });
          if (['keyframes', '-webkit-keyframes'].includes(at.name) && inner.decls.length) items.push({ type: 'rule', prelude: '@keyframes', atrules: chain.map((c) => c.name + ' ' + c.prelude), decls: inner.decls, line });
          j = inner.end; continue;
        }
        const inner = block(stop + 1, 'rule');
        items.push({ type: 'rule', prelude, atrules: chain.map((c) => c.name + ' ' + c.prelude), decls: inner.decls, line });
        if (ctx === 'rule') { /* nested rule inside a rule (CSS nesting): reported as its own rule */ }
        j = inner.end; continue;
      }
      // a declaration (or an at-rule with no block, such as @import or @charset)
      if (head.trim().startsWith('@')) { const m = head.trim().match(/^@([\w-]+)\s*([\s\S]*)$/); if (m) items.push({ type: 'at', name: m[1].toLowerCase(), prelude: m[2].trim(), line, atrules: chain.map((c) => c.name + ' ' + c.prelude) }); }
      else { const c = head.indexOf(':'); if (c > 0) decls.push({ prop: head.slice(0, c).trim().toLowerCase(), value: head.slice(c + 1).trim(), line }); }
      j = src[stop] === ';' ? stop + 1 : stop;   // at "}" (the last declaration has no ";") the loop sees the "}" and ends this block
    }
  };
  let pos = 0;
  while (pos < n) { const r = block(pos, 'top'); if (r.end <= pos) break; pos = r.end; }   // a stray "}" at the top is skipped
  void i;
  return items;
}

/* What a @supports condition checks: ["prop:gap", "prop:aspect-ratio", "selector::has"] (the condition inside "not" is a check too, but of the old way) */
function supportsChecks(prelude) {
  const out = [];
  for (const m of prelude.matchAll(/\(\s*([\w-]+)\s*:/g)) out.push('prop:' + m[1].toLowerCase());
  for (const m of prelude.matchAll(/selector\(\s*([^)]*(?:\([^)]*\)[^)]*)*)\)/gi)) for (const p of m[1].matchAll(/::?([\w-]+)/g)) out.push('selector:' + p[1].toLowerCase());
  return out;
}

const SELECTOR_FUNCTIONS = new Set(['not', 'is', 'where', 'has', 'nth-child', 'nth-last-child', 'nth-of-type', 'nth-last-of-type', 'lang', 'dir', 'host', 'slotted', 'part']);

/** Everything a style sheet uses: [{ key, line, guarded, fallback, note }] ; kinds: css-prop, css-value (only the pairs in `watchValues`), css-fn, css-unit, css-pseudo, css-sel, css-at, css-media, css-color */
export function scanCss(text, { watchValues = new Set(), offsetLine = 0 } = {}) {
  const uses = [];
  const items = parseCss(text, offsetLine);
  for (const it of items) {
    if (it.type === 'at') {
      uses.push({ key: 'css-at:' + it.name, line: it.line });
      if (it.name === 'media' || it.name === 'import' || it.name === 'container') for (const k of mediaFeatures(it.prelude)) uses.push({ key: (it.name === 'container' ? 'css-container:' : 'css-media:') + k, line: it.line });
      continue;
    }
    // what surrounds the rule: the @supports checks around it (a rule inside "@supports not" is the old way, so it uses nothing new)
    const checks = [], notChecks = [];
    for (const a of it.atrules) {
      const m = a.match(/^supports\s+([\s\S]*)$/); if (!m) continue;
      (/^not\b/i.test(m[1].trim()) ? notChecks : checks).push(...supportsChecks(m[1]));
    }
    const inMedia = it.atrules.filter((a) => a.startsWith('media ')).map((a) => a.replace(/^media\s+/, ''));
    void inMedia;
    const sels = it.prelude ? splitTop(it.prelude, ',') : [];
    const selUses = [];
    for (const sel of sels) for (const u of selectorFeatures(sel)) selUses.push(u);
    if (/(^|[^\w\\-])&/.test(it.prelude.replace(/\[[^\]]*\]/g, ''))) selUses.push('css-sel:nesting');
    for (const k of new Set(selUses)) {
      const name = k.replace(/^css-(?:pseudo|sel):/, '');
      uses.push({ key: k, line: it.line, guarded: checks.includes('selector:' + name), selector: it.prelude.slice(0, 120), notBranch: notChecks.length > 0 });
    }
    const seen = new Map();   // property -> how many times it was declared before in this rule
    const props = new Set(it.decls.map((d) => d.prop));
    for (const d of it.decls) {
      const earlier = seen.get(d.prop) || 0;
      const before = it.decls.slice(0, it.decls.indexOf(d)).map((x) => x.prop);   // what the rule declared above this line (a fallback must come first)
      seen.set(d.prop, earlier + 1);
      const base = d.prop.replace(/^-(?:webkit|moz|ms|o)-/, '');
      const guarded = checks.includes('prop:' + d.prop) || checks.includes('prop:' + base);
      const ctx = { line: d.line, guarded, supports: checks.length > 0, notBranch: notChecks.length > 0, earlier, before, selector: it.prelude.slice(0, 120), props, prop: d.prop, value: d.value };
      if (/^(?:row-gap|column-gap|gap)$/.test(d.prop)) uses.push({ key: 'css-gap:' + gapContext(it.decls), ...ctx });   // gap works in a grid since Safari 10.3, in a flex box only since 14.1
      else uses.push({ key: (d.prop.startsWith('--') ? 'css-prop:--*' : 'css-prop:' + d.prop), ...ctx });
      if (it.prelude === '@keyframes') { /* the properties inside keyframes count like any other */ }
      const v = d.value.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/url\(\s*(?:"[^"]*"|'[^']*'|[^)]*)\)/gi, 'url()').replace(/"[^"]*"|'[^']*'/g, '""');
      for (const m of v.matchAll(/([a-zA-Z_-][\w-]*)\(/g)) {
        const fn = m[1].toLowerCase();
        if (fn === 'url' || (fn === 'rect' && d.prop === 'clip')) continue;   // clip: rect(...) is the old visually-hidden trick, not the new clip-path shape
        uses.push({ key: 'css-fn:' + fn, ...ctx, guarded: guarded || checks.includes('prop:' + d.prop) });
      }
      for (const m of v.matchAll(/(?<![\w#.-])(-?\d*\.?\d+)([a-zA-Z]+|%)(?![\w-])/g)) { if (m[2] !== '%') uses.push({ key: 'css-unit:' + m[2].toLowerCase(), ...ctx }); }
      for (const m of v.matchAll(/#([0-9a-fA-F]+)(?![\w-])/g)) { if (m[1].length === 4 || m[1].length === 8) uses.push({ key: 'css-color:hex-alpha', ...ctx }); }
      if (/\b(?:rgba?|hsla?)\(\s*[\d.%]+\s+[\d.%]+/.test(v)) uses.push({ key: 'css-color:space-separated', ...ctx });
      if (/\b(?:rgba?|hsla?)\([^)]*\/\s*[\d.%]+\s*\)/.test(v)) uses.push({ key: 'css-color:slash-alpha', ...ctx });
      for (const m of v.matchAll(/(?<![\w#.\d-])([a-zA-Z][\w-]*)(?![\w(-])/g)) {
        const id = m[1].toLowerCase();
        if (watchValues.has(d.prop + ':' + id) || watchValues.has(base + ':' + id)) uses.push({ key: 'css-value:' + (watchValues.has(d.prop + ':' + id) ? d.prop : base) + ':' + id, ...ctx });
      }
    }
  }
  return uses;
}

function splitTop(s, sep) {
  const out = []; let depth = 0, cur = '', q = '';
  for (const c of s) {
    if (q) { cur += c; if (c === q) q = ''; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === '(' || c === '[') depth++; else if (c === ')' || c === ']') depth--;
    if (c === sep && depth === 0) { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out;
}

function selectorFeatures(sel) {
  const out = [];
  const s = sel.replace(/\[[^\]]*\]/g, '[]').replace(/"[^"]*"|'[^']*'/g, '""');
  for (const m of s.matchAll(/(::?)([a-zA-Z-][\w-]*)(\()?/g)) {
    const name = m[2].toLowerCase();
    if (['before', 'after', 'first-line', 'first-letter'].includes(name) && m[1] === ':') { out.push('css-pseudo:' + name); continue; }
    out.push('css-pseudo:' + name);
    if (m[3] && name === 'not') {   // :not( ... ): a list, or a complex selector, is newer than a single simple selector
      let depth = 1, j = m.index + m[0].length, arg = '';
      while (j < s.length && depth) { const c = s[j]; if (c === '(') depth++; else if (c === ')') { depth--; if (!depth) break; } arg += c; j++; }
      if (splitTop(arg, ',').length > 1 || /[\s>+~]/.test(arg.trim())) out.push('css-sel:not-list');
    }
    if (m[3] && name === 'nth-child') { let j = m.index + m[0].length, arg = ''; for (let depth = 1; j < s.length; j++) { const c = s[j]; if (c === '(') depth++; else if (c === ')') { depth--; if (!depth) break; } arg += c; } if (/\bof\b/.test(arg)) out.push('css-sel:nth-child-of'); }
  }
  return out;
}

/** The media features a query uses: "hover", "prefers-reduced-motion", "width" (also from min-width), "range-syntax" for (width >= 600px) ... */
function mediaFeatures(prelude) {
  const out = new Set();
  for (const m of prelude.matchAll(/\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)) {
    const body = m[1].trim();
    if (/[<>]=?/.test(body.replace(/\([^)]*\)/g, ''))) { out.add('range-syntax'); const f = body.match(/[a-z-]+/); if (f) out.add(f[0].replace(/^(?:min|max)-/, '')); continue; }
    const f = body.match(/^([a-zA-Z-]+)/);
    if (f) out.add(f[1].toLowerCase().replace(/^(?:min|max)-(?=(?:width|height|resolution|aspect-ratio|color|monochrome|color-index|device-width|device-height|device-aspect-ratio)$)/, ''));
  }
  if (/\bor\b/i.test(prelude.replace(/\([^)]*\)/g, (x) => x.replace(/\bor\b/gi, ' ')) ) || /\)\s+or\s+\(/i.test(prelude)) out.add('or-syntax');
  return out;
}

/* ------------------------------------------------------------------ HTML */
const GLOBAL_SKIP = /^(?:aria-|data-|on)/;   // aria-* and data-* are not browser features (event handler attributes are read as scripts)

/** The elements, attributes, inline scripts and styles of a page. */
export function scanHtml(text, opts = {}) {
  const uses = [];
  let src = text.replace(/<!--[\s\S]*?-->/g, (m) => blank(m));
  // inline scripts and styles: scanned as code, then blanked so their text is not read as tags
  src = src.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (m, attrs, body) => {
    const type = (attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i) || [])[1] || '';
    if (body.trim() && (!type || /^(?:text|application)\/(?:x-)?javascript$|^module$/i.test(type))) {
      const startLine = lineOf(text, text.indexOf(m)) - 1;
      for (const u of scanJs(body, startLine + lineOf(m, m.indexOf(body)) - 1)) uses.push(u);
    }
    return m.replace(body, blank(body));
  });
  src = src.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (m, attrs, body) => {
    const startLine = lineOf(text, text.indexOf(m)) - 1;
    for (const u of scanCss(body, { ...opts, offsetLine: startLine + lineOf(m, m.indexOf(body)) - 1 })) uses.push(u);
    return m.replace(body, blank(body));
  });
  let svgDepth = 0;
  const TAG = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/g;
  for (const m of src.matchAll(TAG)) {
    const closing = m[1] === '/', tag = m[2].toLowerCase(), line = lineOf(src, m.index), selfClosing = m[4] === '/';
    if (closing) { if (tag === 'svg' && svgDepth) svgDepth--; continue; }
    const inSvg = svgDepth > 0 || tag === 'svg';
    uses.push({ key: (inSvg ? 'svg-el:' : 'html-el:') + tag, line });
    if (tag === 'svg' && !selfClosing) svgDepth++;
    for (const a of m[3].matchAll(/\s+([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
      const name = a[1].toLowerCase(), value = a[2] ?? a[3] ?? a[4] ?? '';
      if (/^on[a-z]+$/.test(name)) { for (const u of scanJs(value, line - 1)) uses.push(u); continue; }
      if (GLOBAL_SKIP.test(name)) continue;
      if (name === 'style') { for (const u of scanCss('x{' + value + '}', { ...opts, offsetLine: line - 1 })) if (u.key !== 'css-at:media') uses.push(u); continue; }
      uses.push({ key: (inSvg ? 'svg-attr:' : 'html-attr:') + tag + '.' + name, line });
      if (tag === 'input' && name === 'type') uses.push({ key: 'html-input:' + value.toLowerCase(), line });
      if (tag === 'link' && name === 'rel') for (const r of value.toLowerCase().split(/\s+/)) if (r) uses.push({ key: 'html-rel:' + r, line });
      if (tag === 'script' && name === 'type' && value === 'module') uses.push({ key: 'html-script:module', line });
    }
  }
  return uses;
}

/* ------------------------------------------------------------------ everything */
/** The browsers the site is made for, and the first version of each that it must work on (the number is the version of that browser). */
export const TARGETS = { safari: 14, safari_ios: 14, chrome: 90, chrome_android: 80, firefox: 78, samsunginternet_android: 13 };

/** Every use in every file: Map key -> [{ file, line, ... }]. `watch` is { values: Set("prop:value"), names: Set(name) } from the table. */
export function scanAll(root, watch = {}) {
  const map = new Map();
  const add = (file, uses) => { for (const u of uses) { if (!map.has(u.key)) map.set(u.key, []); map.get(u.key).push({ file, ...u }); } };
  const watchValues = watch.values || new Set();
  const names = watch.names || null;
  for (const file of sourceFiles(root)) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    let uses;
    if (file.endsWith('.js')) uses = scanJs(text);
    else if (file.endsWith('.css')) uses = scanCss(text, { watchValues });
    else uses = scanHtml(text, { watchValues });
    if (names) uses = uses.filter((u) => !u.key.startsWith('js-name:') || names.has(u.key.slice(8)));
    add(file, uses);
  }
  return map;
}

/** Is a gap in this rule on a grid, a flex box or text columns? ("flex" also when the rule does not say: the strictest reading) */
function gapContext(decls) {
  const display = (decls.find((d) => d.prop === 'display') || { value: '' }).value;
  if (/grid/.test(display) || decls.some((d) => /^grid-(?:template|auto)/.test(d.prop))) return 'grid';
  if (/flex/.test(display)) return 'flex';
  if (decls.some((d) => /^(?:columns|column-count|column-width)$/.test(d.prop))) return 'multicol';
  return 'flex';
}

/** The conditions of every "@supports not (...)" in the style sheets: what the site has an old-browser way for. */
export function supportsNotConditions(root) {
  const out = [];
  for (const file of sourceFiles(root).filter((f) => f.endsWith('.css'))) for (const it of parseCss(fs.readFileSync(path.join(root, file), 'utf8'))) if (it.type === 'at' && it.name === 'supports' && /^not\b/i.test(it.prelude)) out.push(it.prelude);
  return out;
}
