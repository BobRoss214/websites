#!/usr/bin/env node
/* Finds two scripts of one preview page that fight over a top-level name, and says which files they are.
 *
 *   node work-notes/preview/globals-check.mjs [DIR]      (default /tmp/preview-out; the build runs it for you)
 *
 * On the real site every js/ file is its own <script>, and all of them share one global scope. The preview keeps that: each file is its own inline
 * <script> in the same place (build-artifact.py), so a clash behaves exactly as on the real site: `const x` in two files is a SyntaxError for the second
 * ("Identifier 'x' has already been declared") and the whole second file does not run; a top-level `function x` or `var x` in two files silently
 * replaces the first. This runs the inline scripts of a page in order in a bare JavaScript engine (no page, so most of them stop early with a ReferenceError,
 * which is ignored: the names are made before the first line runs) and reports both kinds, with the names the build gave each inline script (//# sourceURL=).
 * Every file of the site is meant to be one function wrapped in ( ... )(); then there is nothing to find. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

const esc = (k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const topLevel = (name) => new RegExp('^(?:const|let|class|var|function)\\s+' + esc(name) + '\\b', 'm');   // a declaration that starts in column 0 (not inside a function)

/** html: the text of one built page. Returns [{ name, file, others, kind }] */
export function findClashes(html) {
  const ctx = vm.createContext({});
  const owner = new Map();                 // global name -> file that made it (var / function / assignment)
  const seen = [];                         // { file, code } of the scripts already run
  const out = [];
  let n = 0;
  for (const m of html.matchAll(SCRIPT)) {
    const type = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(m[1]);
    if (/\bsrc\s*=/i.test(m[1]) || (type && !/^(?:text\/javascript|module)$/i.test(type[1]))) continue;
    n++;
    const code = m[2].replace(/<\\\/(script)/gi, '</$1').replace(/<\\!--/g, '<!--');
    const file = (/\/\/# sourceURL=(\S+)/.exec(code) || [null, 'inline script ' + n])[1];
    const before = new Set(Object.getOwnPropertyNames(ctx));
    try {
      new vm.Script(code, { filename: file }).runInContext(ctx, { timeout: 1500 });
    } catch (e) {
      const msg = String((e && e.message) || e);
      const dup = /Identifier '([^']+)' has already been declared/.exec(msg);
      if (dup) out.push({ name: dup[1], file, others: seen.filter((x) => topLevel(dup[1]).test(x.code)).map((x) => x.file), kind: 'declared twice (let / const / class): this whole file does not run' });
      else if (e instanceof SyntaxError) out.push({ name: '(syntax)', file, others: [], kind: 'SyntaxError: ' + msg });
      // anything else is the ordinary "there is no page here" error of a script run on its own: ignored
    }
    for (const k of Object.getOwnPropertyNames(ctx)) {
      if (before.has(k)) {
        if (owner.has(k) && owner.get(k) !== file && topLevel(k).test(code) && !/^(?:const|let|class)\s/m.test((topLevel(k).exec(code) || [''])[0])) out.push({ name: k, file, others: [owner.get(k)], kind: 'defined again at the top level (var / function): it replaces the first' });
        continue;
      }
      owner.set(k, file);
    }
    seen.push({ file, code });
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = path.resolve(process.argv[2] || '/tmp/preview-out');
  let bad = 0, pages = 0;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.html')).sort()) {
    pages++;
    for (const c of findClashes(fs.readFileSync(path.join(dir, f), 'utf8'))) {
      bad++;
      console.log('CLASH in ' + f + ': ' + c.name + ' in ' + c.file + (c.others.length ? ' and ' + c.others.join(', ') : '') + ' - ' + c.kind);
    }
  }
  console.log(bad ? bad + ' top-level name clash(es) in ' + pages + ' pages' : 'no top-level name clashes in ' + pages + ' pages');
  process.exit(bad ? 1 : 0);
}
