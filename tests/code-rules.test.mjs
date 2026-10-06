// order: 45
// browser: no
// quick: yes
// covers: js/*.js, *.html
/* Rules that one careless edit breaks for every page at once (no browser, a second). PART 1, the head of every page: the viewport tag (without it a phone shows the page
 * as a tiny desktop; no browser test notices, because they run as a desktop), the "only light" colour-scheme tag, the charset and the page language. PART 2,
 * the scripts that a slow phone feels at once: no loop that waits by looking at the clock (it blocks the whole page: a 4-second
 * loop at start shows nothing for 4 seconds), no `debugger` statement, no alert / confirm / prompt box, no synchronous network request, no eval / new Function / a
 * string handed to setTimeout. These are the usual ways one careless edit freezes or breaks every page; none of the browser tests would notice a freeze that ends
 * by itself. PART 3, what a rebuilt page can lose without a stale file to give it away: a script tag the home page no longer has, the scripts in the wrong order (js/guard.js
 * above js/content.js, js/season.js before the scripts that use it), a button with no name for a screen reader. Each rule is tried on a made-up bad line first, so a rule that
 * stopped working cannot pass quietly. The comments in the files are not looked at. */
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
/* ---------------------------------------------------------------- 3. the script tags and the buttons of the pages (after a rebuild nothing is stale, so only a rule like this one notices) */
const html = Object.fromEntries(PAGES.map((f) => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]));
const loaded = (text) => [...text.matchAll(/<script src="js\/([a-z0-9-]+\.js)"><\/script>/g)].map((m) => m[1]);
// each pair: the first must be loaded above the second, wherever the second is loaded (guard.js: "keep it above the js/content.js line in every page"; js/season.js defines
// W.onParse and W.seasons, which i18n.js and live.js use while the page is read; main.js calls the translation of i18n.js; features.js asks for W.live)
const BEFORE = [['guard.js', 'content.js'], ['content.js', 'season.js'], ['season.js', 'i18n.js'], ['season.js', 'live.js'], ['i18n.js', 'main.js'], ['live.js', 'features.js']];
const misplaced = (list) => BEFORE.filter(([a, b]) => list.includes(b) && !(list.includes(a) && list.indexOf(a) < list.indexOf(b))).map(([a, b]) => `${a} must come before ${b}`);
ok('(tried on a bad sample first) scripts in the wrong order are found', misplaced(['content.js', 'guard.js', 'season.js']).length === 1 && misplaced(['guard.js', 'content.js', 'live.js']).length === 1 && misplaced(['guard.js', 'content.js', 'season.js']).length === 0);
const order = PAGES.map((f) => [f, misplaced(loaded(html[f]))]).filter(([, m]) => m.length);
ok('the scripts of every page come in an order that works (guard, content, season, i18n and live, main, features)', order.length === 0, order.map(([f, m]) => f + ': ' + m.join(', ')).join(' | '));
const homeScripts = loaded(html['index.html']);
const notLoaded = (list, jsFiles) => jsFiles.filter((f) => f !== 'footer-art.js' && !list.includes(f));   // footer-art.js: only the five extra pages load it (instead of hero.js)
ok('(tried on a bad sample first) a script the home page does not load is found', notLoaded(['guard.js'], ['guard.js', 'live.js']).length === 1 && notLoaded(['guard.js'], ['guard.js', 'footer-art.js']).length === 0);
const unloaded = notLoaded(homeScripts, files.map((f) => path.basename(f)));
ok(`the home page loads every script in js/ (${files.length} files, js/footer-art.js is the extra pages' own)`, homeScripts.length >= 10 && unloaded.length === 0, unloaded.join(', '));
const unnamed = (text) => [...text.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].filter((m) => !/\b(?:aria-label|aria-labelledby|title)="[^"]+"/.test(m[1]) && !m[2].replace(/<[^>]*>/g, '').trim()).map((m) => (m[1].match(/\b(?:id|class)="([^"]*)"/) || [, 'a button'])[1]);
ok('(tried on a bad sample first) a button with only a picture and no name is found, one with a name is not', unnamed('<button class="x"><svg aria-hidden="true"></svg></button>').length === 1 && unnamed('<button aria-label="Open menu"><svg></svg></button><button>Send</button>').length === 0);
const nameless = PAGES.map((f) => [f, unnamed(html[f])]).filter(([, n]) => n.length);
ok('every button on every page has a name for a screen reader (its words, aria-label, aria-labelledby or title)', nameless.length === 0, nameless.map(([f, n]) => f + ': ' + n.join(', ')).join(' | '));
await finish({});
