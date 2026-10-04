// order: 45
// browser: no
// quick: yes
// covers: js/*.js, *.html
/* Rules that one careless edit breaks for every page at once (no browser, a second). PART 1, the head of every page: the viewport tag (without it a phone shows the page
 * as a tiny desktop; no browser test notices, because they run as a desktop), the "only light" colour-scheme tag, the charset and the page language. PART 2,
 * the scripts that a slow phone feels at once: no loop that waits by looking at the clock (it blocks the whole page: a 4-second
 * loop at start shows nothing for 4 seconds), no `debugger` statement, no alert / confirm / prompt box, no synchronous network request, no eval / new Function / a
 * string handed to setTimeout. These are the usual ways one careless edit freezes or breaks every page; none of the browser tests would notice a freeze that ends
 * by itself. Each rule is tried on a made-up bad line first, so a rule that stopped working cannot pass quietly. The comments in the files are not looked at. */
import fs from 'node:fs';
import path from 'node:path';
import { ok, finish, ROOT } from './lib.mjs';

/* ---------------------------------------------------------------- 1. the head of every page */
const PAGES = ['index.html', 'first-visit.html', 'pumpkin-patch.html', 'school-field-trips.html', 'strawberry-picking.html', 'wise-pie.html', '404.html'];
const HEAD = [
  ['<meta name="viewport" content="width=device-width, initial-scale=1">', /<meta name="viewport" content="width=device-width, initial-scale=1">/, '<head><meta charset="utf-8"></head>', 'the viewport tag (phones show the page at its real size, not as a tiny desktop)'],
  ['<meta name="color-scheme" content="only light">', /<meta name="color-scheme" content="only light">/, '<head><meta name="viewport" content="x"></head>', 'the "only light" colour-scheme tag (a phone in dark mode must not darken the pages: tests/auto-dark)'],
  ['<meta charset="utf-8">', /<meta charset="utf-8">/i, '<head></head>', 'the UTF-8 charset tag (accents, Hindi, Chinese)'],
  ['<html lang="en"', /<html lang="[a-z]{2}"/, '<html lang="enn" class="x">', 'a two-letter language on <html>'],
];
for (const [, re, bad, name] of HEAD) {
  ok(`(tried on a bad sample first) ${name}`, !re.test(bad));
  const missing = PAGES.filter((f) => !re.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
  ok(`every page has ${name}`, missing.length === 0, missing.join(', '));
}

/* ---------------------------------------------------------------- 2. the scripts */
const RULES = [
  ['no loop that waits by reading the clock (while (Date.now() - start < ...) blocks the page)', /\bwhile\s*\(\s*(?:Date\.now\(\)|performance\.now\(\)|new Date\(\)(?:\.getTime\(\))?)\s*[-<>]/, 'while (Date.now() - t < 4000) { }'],
  ['no `debugger` statement', /\bdebugger\s*;/, 'debugger;'],
  ['no alert, confirm or prompt box', /(?<![.\w$])(?:alert|confirm|prompt)\s*\(/, 'alert("hi")'],
  ['no synchronous network request (XMLHttpRequest open with false)', /\.open\(\s*['"][A-Z]+['"]\s*,[^)]*,\s*false\s*\)/, 'x.open("GET", u, false)'],
  ['no eval, new Function or a string handed to setTimeout / setInterval', /(?<![.\w$])eval\s*\(|new\s+Function\s*\(|\bset(?:Timeout|Interval)\s*\(\s*['"`]/, 'setTimeout("run()", 5)'],
];
const strip = (code) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');   // comments (a // inside a web address is kept by the [^:] rule)
const files = fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f);
const code = Object.fromEntries(files.map((f) => [f, strip(fs.readFileSync(path.join(ROOT, f), 'utf8'))]));
for (const [name, re, bad] of RULES) {
  ok(`(the rule is tried on a bad line first) ${name}`, re.test(bad));
  const hits = files.filter((f) => re.test(code[f]));
  ok(`${name}: ${files.length} scripts in js/`, hits.length === 0, hits.join(', '));
}
await finish({});
