// order: 60
// browser: no
// covers: *.html, pages/*, js/content.js, js/season.js, js/features.js, lang/src/*, tools/qr_links.json, tools/check_facts.py, print/*
/* One fact, one answer: the same price, clock time, age, group size, phone, address, e-mail and date is written in many places (home page, five
 * other pages, FAQ answers, page descriptions, structured data, js/content.js, the QR sign list) and in five languages. This test reads the built
 * pages and lang/*.js and fails when two places give different answers, or when a translation gives a different number, price, time, weekday,
 * month, name or e-mail than its English. No browser needed. WA_FACTS=1 prints every place of every fact (file:line and the exact words).
 * Every failure says what is wrong in plain words, names the file the farm edits (pages/first-visit.html, not the built first-visit.html; lang/src/es.json,
 * not lang/es.js) with words to search for, and says what to do next. Never a blank reason. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT, ok, finish } from './lib.mjs';

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SHOW = !!process.env.WA_FACTS;

/* ------------------------------------------------------------------ *
 * Reading a built page: its text in reading order (blocks separated by " | "), where each block starts (file line), and its attributes
 * ------------------------------------------------------------------ */
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…', middot: '·', copy: '©', times: '×', ntilde: 'ñ' };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : NAMED[e.toLowerCase()] ?? m));
const BREAK = /^(?:p|li|ul|ol|div|section|article|header|footer|nav|main|aside|h[1-6]|table|thead|tbody|tr|td|th|dt|dd|dl|figure|figcaption|details|summary|caption|address|form|br|hr|button|label|legend)$/i;
const TEXT_ATTRS = new Set(['alt', 'aria-label', 'title']);   // words a visitor can read or hear, outside the page text

function readPage(file) {
  const html = read(file);
  const ldBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)].map((m) => { let data = null; try { data = JSON.parse(m[1]); } catch (e) { /* reported below */ } return { data, line: html.slice(0, m.index).split('\n').length }; });
  const jsonld = ldBlocks.map((b) => b.data).filter(Boolean);
  const blank = (m) => m.replace(/[^\n]/g, '');
  const s = html.replace(/<!--[\s\S]*?-->/g, blank).replace(/<(script|style|svg|template)\b[\s\S]*?<\/\1\s*>/gi, blank);
  let text = '', line = 1;
  const marks = [[0, 1]], attrs = [], extra = [];
  const startBlock = (at = line) => { text = text.replace(/ +$/, ''); if (text !== '' && !text.endsWith('|')) text += ' | '; else if (text.endsWith('|')) text += ' '; marks.push([text.length, at]); };
  const re = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|[^<]+|</g; let m;
  while ((m = re.exec(s))) {
    const chunk = m[0];
    if (chunk[0] === '<' && m[1]) {
      const tag = m[1].toLowerCase();
      if (chunk[1] !== '/') {
        const ar = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g; let am;
        while ((am = ar.exec(m[2]))) {
          const a = { tag, name: am[1].toLowerCase(), value: decode(am[2] ?? am[3]), line };
          attrs.push(a);
          if (TEXT_ATTRS.has(a.name) && /\S/.test(a.value)) extra.push([a.value, line]);
        }
      }
      if (BREAK.test(tag)) startBlock(); else if (!text.endsWith(' ')) text += ' ';
    } else if (chunk[0] !== '<') { const d = decode(chunk).replace(/\s+/g, ' '); text += text.endsWith(' ') ? d.replace(/^ /, '') : d; }
    line += (chunk.match(/\n/g) || []).length;
  }
  for (const a of attrs) if (a.tag === 'meta' && /^(description|og:description|og:title)$/.test((attrs.find((b) => b.tag === 'meta' && b.line === a.line && /^(name|property)$/.test(b.name)) || {}).value || '') && a.name === 'content') extra.push([a.value, a.line]);
  const words = (v, out = []) => { if (typeof v === 'string') { if (/\s/.test(v) && !/^https?:/.test(v)) out.push(v); } else if (v && typeof v === 'object') for (const x of Object.values(v)) words(x, out); return out; };
  for (const b of ldBlocks) for (const v of words(b.data)) extra.push([v, b.line]);   // structured data (FAQ answers, descriptions): a place a search engine reads
  for (const [v, l] of extra) { startBlock(l); text += v; }
  return { file, text, marks, attrs, jsonld, badLd: ldBlocks.filter((b) => !b.data).length, lineOf: (i) => { let lo = 0, hi = marks.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (marks[mid][0] <= i) lo = mid; else hi = mid - 1; } return marks[lo][1]; } };
}

const PAGES = ['index.html', 'first-visit.html', 'pumpkin-patch.html', 'strawberry-picking.html', 'school-field-trips.html', 'wise-pie.html'].map(readPage);
const page = (f) => PAGES.find((p) => p.file === f);
const snippet = (p, i, len) => p.text.slice(Math.max(0, i - 12), i + len + 12).replace(/\s+/g, ' ');

/* Where a place is, in words an owner can use: the file she edits (not the built copy of it) and the words to search for.
 * The five pages next to index.html are built from pages/; lang/es.js is built from lang/src/es.json. index.html is edited itself, so its line number is right. */
const SRC = (f) => (/^lang\/(\w+)\.js$/.test(f) ? 'lang/src/' + f.slice(5, -3) + '.json' : /^[a-z0-9-]+\.html$/.test(f) && f !== 'index.html' ? 'pages/' + f : f);
const at = (x) => { const f = SRC(x.file); return f === x.file && x.line ? f + ':' + x.line : f; };
const loc = (p, i) => at({ file: p.file, line: p.lineOf(i) });
const quoted = (x) => `${at(x)} "${String(x.words).replace(/\s+/g, ' ').slice(0, 70)}"`;
const MORE = (list, n = 3) => list.slice(0, n).join('; ') + (list.length > n ? ' and ' + (list.length - n) + ' more' : '');
const REBUILD = 'then run  python3 tools/pages.py  (and  python3 tools/i18n.py build  if you changed lang/src); README: "Change a fact everywhere"';
/** One check. why = what is wrong, in plain words; fix = what to do next. A failing check always says something (never blank). */
function verify(name, cond, why, fix) {
  return ok(name, cond, cond ? '' : (String(why || '').trim() || 'no details were available: run  WA_FACTS=1 node tests/consistency.test.mjs  to see every place') + (fix ? '  TO FIX: ' + fix : ''));
}

/* what the site's own settings say (js/content.js: hours; js/season.js: season dates) */
const contentSrc = read('js/content.js');
const sandbox = {}; sandbox.window = sandbox;
vm.runInNewContext(contentSrc, sandbox);
const CONTENT = sandbox.WISE_ACRES || {};
const contentLine = (rx) => { const i = contentSrc.search(rx); return i < 0 ? 0 : contentSrc.slice(0, i).split('\n').length; };
const seasonSrc = read('js/season.js');
const featuresSrc = read('js/features.js');

/* ------------------------------------------------------------------ *
 * Normalisers: every way of writing a value becomes one string
 * ------------------------------------------------------------------ */
const num = (s) => { const f = parseFloat(String(s).replace(/,/g, '')); return Number.isInteger(f) ? String(f) : f.toFixed(2).replace(/0$/, ''); };
const money = (s) => '$' + num(s);
const hhmm = (h, mi, ap) => { let x = +h; if (ap) { ap = ap.toLowerCase(); if (ap === 'pm' && x < 12) x += 12; if (ap === 'am' && x === 12) x = 0; } return String(x).padStart(2, '0') + ':' + (mi || '00'); };
const T = '(\\d{1,2})(?::(\\d\\d))?(?: ?([ap]m))?';        // 5:00 PM, 4 pm, 10
const timeOf = (m, i) => hhmm(m[i], m[i + 1], m[i + 2]);
const range = (m, i) => { const a = [m[i], m[i + 1], m[i + 2]], b = [m[i + 3], m[i + 4], m[i + 5]]; if (!a[2] && b[2]) a[2] = b[2]; let s = hhmm(...a), e = hhmm(...b); if (e < s) e = hhmm(+b[0] + 12, b[1]); return s + '-' + e; };   // "4 to 8 pm"; "10 to 4"
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dayNo = (w) => DAYS.findIndex((d) => d.toLowerCase().startsWith(w.slice(0, 3).toLowerCase()));
const WD = '(Mon|Tues?|Wed(?:nes)?|Thu(?:rs)?|Fri|Sat(?:ur)?|Sun)(?:day)?';
const daySet = (list) => [...new Set(list)].sort((a, b) => (a + 6) % 7 - (b + 6) % 7).map((d) => DAYS[d].slice(0, 3)).join(',');   // Monday first, Sunday last
const expand = (a, b) => { const out = [a]; for (let d = a; d !== b;) { d = (d + 1) % 7; out.push(d); } return out; };
const daysFrom = (s) => {   // "Thursday–Sunday", "Friday through Sunday", "Fri–Sun", "Thursday, Friday, Saturday & Sunday"
  const r = new RegExp(WD + '(?:\\s*(?:–|-|to|through)\\s*' + WD + ')?', 'g'); const days = []; let m, prev = null;
  const parts = s.split(/\s*(?:,|&|and)\s*/);
  for (const part of parts) { const mm = new RegExp('^\\s*' + WD + '(?:\\s*(?:–|-|to|through)\\s*' + WD + ')?\\s*$').exec(part); if (!mm) continue; days.push(...(mm[2] ? expand(dayNo(mm[1]), dayNo(mm[2])) : [dayNo(mm[1])])); }
  return daySet(days);
};
const dayList = (nums) => daySet(nums);   // [4,5,6,0] from js/content.js

/* ------------------------------------------------------------------ *
 * The facts. find: [regex over the page text (group 1 is the value, or [regex, group number])]. A fact passes when every place gives the same value.
 * ------------------------------------------------------------------ */
const MONEY = '\\$(\\d+(?:\\.\\d+)?)';
const WDN = '(?:Mon|Tues?|Wed(?:nes)?|Thu(?:rs)?|Fri|Sat(?:ur)?|Sun)(?:day)?';
const WDR = WDN + '(?:\\s*(?:–|-|to|through)\\s*' + WDN + ')?';                 // Thursday–Sunday, Friday through Sunday, Fri–Sun
const DAYTXT = '(' + WDR + '(?:\\s*(?:,|&|and)\\s*' + WDR + ')*)';                 // ... or a list: Friday, Saturday & Sunday
const FACTS = [
  /* ---- prices ---- */
  { id: 'price: farm fun without pizza, per person', norm: money, min: 4, find: [
    new RegExp('No pizza \\| (?:[^$|]+\\| )?' + MONEY + ' per person'), new RegExp('Farm fun, no pizza \\| ' + MONEY), new RegExp('farm fun without pizza is ' + MONEY + ' per person')] },
  { id: 'price: farm fun with pizza, base', norm: money, min: 3, find: [new RegExp('Yes pizza \\| (?:[^$|]+\\| )?' + MONEY + ' base'), new RegExp('Farm fun with pizza \\| ' + MONEY + ' base')] },
  { id: 'pizza package: number of pizzas included', norm: num, min: 3, find: [/Includes (\d+) Wise Pie pizzas, plus/] },
  { id: 'price: extra per person in the pizza package, the photo passes\' farm fee and the no-pizza field fee', norm: money, min: 9, find: [
    new RegExp('Includes \\d+ Wise Pie pizzas, plus ' + MONEY + ' per person'), new RegExp('\\+ ' + MONEY + ' per person farm fee'),
    new RegExp('No pizza \\| (?:[^$|]+\\| )?' + MONEY + ' per person'), new RegExp('Farm fun, no pizza \\| ' + MONEY), new RegExp('farm fun without pizza is ' + MONEY + ' per person')] },
  { id: 'price: corn pit, per person', norm: money, min: 5, find: [new RegExp('Corn pit[ |]{1,4}' + MONEY + ' per person'), new RegExp('corn pit \\(' + MONEY + ' per person\\)'), new RegExp('the corn pit is ' + MONEY + ' per person')] },
  { id: 'price: wagon ride, per person', norm: money, min: 5, find: [new RegExp('Wagon ride[ |]{1,4}' + MONEY + ' per person'), new RegExp('wagon ride \\(' + MONEY + ' per person\\)'), new RegExp('Wagon rides are ' + MONEY + ' per person')] },
  { id: 'price: barrel train, per child', norm: money, min: 4, find: [new RegExp('Barrel train[ |]{1,4}' + MONEY + ' per child'), new RegExp('barrel train is ' + MONEY + ' per child')] },
  { id: 'price: tomatoes, per pound', norm: money, min: 5, find: [new RegExp(MONEY + ' per pound')] },
  { id: 'price: basil, per stem', norm: money, min: 5, find: [new RegExp(MONEY + ' per stem')] },
  { id: 'price: school tour, per student, parent and sibling (and in the page description)', norm: money, min: 7, find: [new RegExp(MONEY + ' per student'), new RegExp(MONEY + ' admission fee'), new RegExp(MONEY + ' each')] },
  { id: 'price: private party', norm: money, min: 1, find: [new RegExp(MONEY + ' per party')] },
  { id: 'price: gluten-free crust, extra', norm: money, min: 3, find: [new RegExp('gluten-free crust[ |]{1,4}\\+' + MONEY), new RegExp('[Gg]luten-free crust is \\+' + MONEY), new RegExp('gluten-free crust \\(\\+' + MONEY + '\\)')] },
  { id: 'price: vegan cheese, extra', norm: money, min: 3, find: [new RegExp('vegan cheese[ |]{1,4}\\+' + MONEY), new RegExp('vegan cheese is \\+' + MONEY), new RegExp('vegan cheese \\(\\+' + MONEY + '\\)')] },
  { id: 'price: refund fee for a cancelled reservation (%)', norm: num, min: 3, find: [/(\d+)% credit card processing fee/] },
  /* ---- clock times ---- */
  { id: 'time: pizza reservations open (Tuesday)', norm: String, min: 7, find: [new RegExp('Tuesdays? at ' + T, 'i'), new RegExp('Opens Tuesday, ' + T, 'i')].map((r) => [r, 0]),
    val: (m) => timeOf(m, 1), extra: () => [...(page('index.html').attrs.filter((a) => a.name === 'data-release-time').map((a) => ({ file: 'index.html', line: a.line, value: hhmm(...a.value.split(':').map(Number).slice(0, 1), a.value.split(':')[1]), words: 'data-release-time="' + a.value + '"' })))] },
  { id: 'time: The GreenHouse open hours (Fri-Sun)', norm: String, min: 5, find: [new RegExp('(?<!At The GreenHouse ,? ?)(?:Fri–Sun|Friday–Sunday),? ' + T + ' ?– ?' + T, 'i')], val: (m) => range(m, 1),
    extra: () => [{ file: 'js/content.js', line: contentLine(/greenhouse:/), value: CONTENT.hours.greenhouse.open + '-' + CONTENT.hours.greenhouse.close, words: 'hours.greenhouse' }] },
  { id: 'time: Wise Pie at The GreenHouse (no reservation)', norm: String, min: 9, val: (m) => range(m, 1), find: [
    new RegExp('\\| ' + T + ' ?– ?' + T + ' \\| At The GreenHouse', 'i'), new RegExp('first come, first served from ' + T + ' to ' + T, 'i'),
    new RegExp('GreenHouse from ' + T + ' to ' + T + ', Friday through Sunday', 'i'), new RegExp('Poplin Rd\\)(?:, you can get pizza)? Friday through Sunday from ' + T + ' to ' + T, 'i'),
    new RegExp('GreenHouse ?\\|? ?, Friday–Sunday, ' + T + '–' + T, 'i'), new RegExp('Friday to Sunday,? ' + T + ' to ' + T, 'i')],
    extra: () => [{ file: 'js/content.js', line: contentLine(/pizza:\s*\{/), value: CONTENT.hours.pizza.open + '-' + CONTENT.hours.pizza.close, words: 'hours.pizza' }] },
  { id: 'time: pizza at the farm, with a farm reservation', norm: String, min: 3, val: (m) => range(m, 1), find: [new RegExp('\\| ' + T + ' ?– ?' + T + ' \\| At the farm', 'i'), new RegExp('available from ' + T + ' to ' + T + ' by farm reservation', 'i')] },
  { id: 'time: pizza at the farm ends', norm: String, min: 3, find: [new RegExp('(?:At the farm ?,? ?\\|? ?until|farm until|you can get pizza until) ' + T, 'i')].map((r) => [r, 0]), val: (m) => timeOf(m, 1) },
  { id: 'time: last moment to change a reservation for free', norm: String, min: 5, find: [new RegExp('until ' + T + ' (?:the night before|PM the night before)', 'i')].map((r) => [r, 0]), val: (m) => timeOf(m, 1) },
  /* ---- days of the week ---- */
  { id: 'days: farm visits without pizza (fall)', norm: String, min: 7, val: (m) => daysFrom(m[1]), find: [
    new RegExp('No pizza \\| ' + DAYTXT + ' \\|', 'i'), new RegExp('Farm fun, no pizza \\| ' + MONEY + ' per person \\| [^|]*?Ages 3 and up\\. ' + DAYTXT + '\\.'), new RegExp('Field fee, ages 3 and up\\. (?:Infants[^.]*\\. )?' + DAYTXT),
    new RegExp(DAYTXT + ' reservations, with or without pizza'), new RegExp('farm is open ' + DAYTXT + ' by reservation'), new RegExp('Farm-fun-only reservations are available ' + DAYTXT), new RegExp('Reservations without pizza are available ' + DAYTXT)],
    extra: () => [{ file: 'js/content.js', line: contentLine(/farm:\s*\{/), value: dayList(CONTENT.hours.farm.fall), words: 'hours.farm.fall' }, ...stripDays('No')] },
  { id: 'days: farm visits with pizza, and pizza at the farm', norm: String, min: 6, val: (m) => daysFrom(m[1]), find: [
    new RegExp('Yes pizza \\| ' + DAYTXT + ' \\|', 'i'), new RegExp('Includes 2 Wise Pie pizzas, plus \\$\\d+ per person \\(ages 3\\+\\)\\. ' + DAYTXT + '\\.'), new RegExp('Reservations with Wise Pie pizza are (?:available )?' + DAYTXT)], extra: () => stripDays('Yes') },
  { id: 'days: The GreenHouse and Wise Pie there (Fri-Sun)', norm: String, min: 12, val: (m) => daysFrom(m[1]), find: [
    new RegExp(DAYTXT + ',? \\d{1,2} ?[ap]m ?– ?\\d{1,2} ?[ap]m', 'i'), new RegExp('Fall hours:? ' + DAYTXT), new RegExp('GreenHouse from \\d+ to \\d+ pm, ' + DAYTXT, 'i'), new RegExp('Poplin Rd\\)(?:, you can get pizza)? ' + DAYTXT + ' from', 'i'),
    new RegExp(DAYTXT + ',? \\d to \\d pm', 'i')],
    extra: () => [{ file: 'js/content.js', line: contentLine(/greenhouse:/), value: dayList(CONTENT.hours.greenhouse.days), words: 'hours.greenhouse.days' }, { file: 'js/content.js', line: contentLine(/pizza:\s*\{/), value: dayList(CONTENT.hours.pizza.days), words: 'hours.pizza.days' }, ...stripDays('GreenHouse')] },
  /* ---- ages ---- */
  { id: 'age: free (infants, wagon ride, party children)', norm: num, min: 10, find: [/[Ii]nfants (\d+) and under are free/, /[Aa]ges (\d+) and younger ride free/, /[Cc]hildren (\d+) and under are free/, /[Cc]hildren age (\d+) and younger are free/] },
  { id: 'age: from this age people pay the field fee / school admission', norm: num, min: 11, find: [/[Aa]ges (\d+) and up/, /\(ages (\d+)\+\)/, /ages (\d+) and older/, /ages (\d+) and up/] },
  { id: 'age: barrel train (and under only)', norm: num, min: 3, find: [/Ages (\d+) and under only/] },
  /* ---- group sizes ---- */
  { id: 'size: most guests at a private party and at the first corporate package', norm: num, min: 2, find: [/Up to (\d+) guests/] },
  { id: 'size: smallest school group (students)', norm: num, min: 4, find: [/Minimum group size: (\d+) students/, /Minimum (\d+) students/, /minimum group size for a traditional fall school tour is (\d+) students/] },
  { id: 'size: people in one photo session', norm: num, min: 1, find: [/up to (\d+) people/] },
  /* ---- pizza ---- */
  { id: 'pizza: size in inches', norm: num, min: 3, find: [/(\d+) inches/] },
  { id: 'pizza: feeds adults', norm: String, min: 4, find: [/about (\d)(?:–| to )(\d) adults/], val: (m) => m[1] + '-' + m[2] },
  { id: 'pizza: feeds children', norm: String, min: 4, find: [/or (\d)(?:–| to )(\d) children/], val: (m) => m[1] + '-' + m[2] },
  { id: 'pizza: ready for pick-up after (hours)', norm: num, min: 2, find: [/(\d+) hour after your reservation time/] },
  { id: 'pizza: pre-order link posted (days ahead), also on the QR sign', norm: num, min: 3, find: [/(?:link posted|link goes up|link is posted|link we post|[Ww]e post the pre-order link) (\d+) days (?:ahead|before)/], extra: () => qrFacts(/posted (\d+) days ahead/) },
  { id: 'pizza: oven temperature (°F) in the page text and descriptions', norm: num, min: 4, find: [/(\d+)-degree oven/] },
  /* ---- the farm and the family ---- */
  { id: 'year the farm began', norm: String, min: 3, find: [/since (20\d\d)/, /March of (20\d\d)/, /[Ff]amily owned since (20\d\d)/],
    extra: () => PAGES[0].jsonld.flatMap((j) => (j.foundingDate ? [{ file: 'index.html', line: 0, value: j.foundingDate.slice(0, 4), words: 'foundingDate ' + j.foundingDate }] : [])) },
  { id: 'year of the fall prices, menu and schedule', norm: String, min: 9, find: [/(?:Fall|fall|Menu) (20\d\d)/, /fall (20\d\d) can/, /prices are for fall (20\d\d)/i] },
];

function stripDays(kind) {   // the week strips on the home page: the picture's days (data-days="4,5,6,0") and the words read aloud (aria-label) say the same days as the card they belong to
  const out = []; let card = null;
  read('index.html').split('\n').forEach((ln, i) => {
    const h = />(Yes|No) pizza</.exec(ln); if (h) card = h[1];
    const d = /data-days="([\d,]+)"[^>]*aria-label="([^"]*)"/.exec(ln); if (!d) return;
    const label = decode(d[2]);
    if ((/^Open /.test(label) ? 'GreenHouse' : card) !== kind) return;
    out.push({ file: 'index.html', line: i + 1, value: dayList(d[1].split(',').map(Number)), words: 'data-days="' + d[1] + '"' }, { file: 'index.html', line: i + 1, value: daysFrom(label.replace(/^(?:Available|Open) /, '')), words: 'aria-label="' + label + '"' });
  });
  return out;
}
function qrFacts(rx) {
  const qr = JSON.parse(read('tools/qr_links.json')); const out = [];
  for (const s of qr.signs) { const m = rx.exec(s.text_en || ''); if (m) out.push({ file: 'tools/qr_links.json', line: 0, value: m[1], words: s.text_en }); }
  return out;
}

function collect(f) {
  const found = [];
  for (const p of PAGES) for (const entry of f.find) {
    const [rx, g] = Array.isArray(entry) ? entry : [entry, 1];
    const re = new RegExp(rx.source, rx.flags.replace('g', '') + 'g'); let m;
    while ((m = re.exec(p.text))) {
      const value = f.val ? f.val(m) : (m[g] === undefined ? undefined : f.norm(m[g]));
      if (value === undefined || value === '') continue;
      const line = p.lineOf(m.index);
      if (!found.some((x) => x.file === p.file && x.line === line && x.value === value)) found.push({ file: p.file, line, value, words: snippet(p, m.index, m[0].length) });   // one place = one block of the page, however many ways the test reads it
    }
  }
  if (f.extra) found.push(...f.extra());
  return found;
}

const tableRows = [];
const perFile = (found) => { const n = {}; for (const x of found) n[SRC(x.file)] = (n[SRC(x.file)] || 0) + 1; return Object.entries(n).map(([f, c]) => f + ' (' + c + ')').join(', ') || 'nowhere'; };
for (const f of FACTS) {
  const found = collect(f);
  const values = [...new Set(found.map((x) => x.value))];
  for (const x of found) tableRows.push([f.id, x.value, x.file + ':' + x.line, x.words]);
  if (found.length < (f.min || 1)) {
    verify(f.id + ': found where it is written', false,
      `found in ${found.length} place(s), expected at least ${f.min}. Found in: ${perFile(found)}. A sentence that states this was deleted or reworded (so this test no longer recognises it), or the fact moved.`,
      found.length ? `compare the files above with the other pages and put the missing sentence back; if you changed it on purpose, give the test the new wording or lower  min: ${f.min}  for "${f.id}" in tests/consistency.test.mjs`
        : `put the sentence back; if the farm took this fact off the site on purpose, delete "${f.id}" from the FACTS list in tests/consistency.test.mjs`);
    continue;
  }
  const groups = values.map((v) => ({ v, items: found.filter((x) => x.value === v) })).sort((a, b) => b.items.length - a.items.length);
  const tie = groups.length > 1 && groups[1].items.length === groups[0].items.length;
  const odd = groups.slice(tie ? 0 : 1).map((g) => g.v + ' at ' + MORE(g.items.map(quoted))).join('   vs   ');
  verify(f.id + ' (' + found.length + ' places say ' + values.join(' / ') + ')', values.length === 1,
    `${values.length} different answers. ` + (tie ? 'About as many places say each, so ask the farm which is right: ' : `Most places (${groups[0].items.length}) say ${groups[0].v}; different: `) + odd,
    `make every place say ${tie ? 'the right one' : groups[0].v}: edit the file named (search for the words in quotes), ${REBUILD}`);
}

/* ------------------------------------------------------------------ *
 * More answers that must agree
 * ------------------------------------------------------------------ */
const index = PAGES[0];
const noLd = PAGES.filter((p) => p.jsonld.length === 0 || p.badLd).map((p) => SRC(p.file));
verify('structured data (JSON-LD) is valid on all ' + PAGES.length + ' pages, so its facts are read above', noLd.length === 0, 'the structured data block (<script type="application/ld+json">) is missing or is not valid JSON in: ' + noLd.join(', '), 'open the file, find that block in the head (a missing comma or quote mark is the usual cause; for pages/ files it is written by tools/pages.py), fix it, ' + REBUILD);

// policies: every place that talks about a rule gives the same answer (no page says the opposite)
{
  const rules = [
    ['pets stay home, service animals are welcome', /pets must stay home|[Pp]ets stay home|Leave pets at home|No dogs/g, /(?<!Are )\b(?:dogs|pets) (?:are |is )?(?:welcome|allowed|permitted)\b|\bbring (?:your )?(?:dog|pet)s?\b/gi, 8],
    ['outside alcohol is not allowed', /Outside alcohol is (?:not permitted|prohibited)|Please do not bring your own alcohol|State rules do not allow you to bring your own alcohol/g, /outside alcohol (?:is )?(?:allowed|welcome|permitted)\b/gi, 4],
    ['severe weather: we close, we e-mail, we refund in full', /we(?:’|')ll email you and give a full refund/g, /\bno refunds?\b|non-refundable|partial refund/gi, 4],
    ['the farm itself is by reservation only, the GreenHouse needs none', /needs no reservation|No reservation (?:is )?required|No reservations required|No reservation needed|No reservation and no farm access/g, /walk-ins? (?:are )?welcome|reservations? (?:are )?(?:optional|not needed) at the farm/gi, 6],
    ['payment: cash preferred, cards accepted', /Cash (?:is )?preferred/g, /cash only|no cards/gi, 3],
  ];
  for (const [what, yes, no, min] of rules) {
    const found = [], contra = [];
    for (const p of PAGES) { for (const m of p.text.matchAll(yes)) found.push(loc(p, m.index)); for (const m of p.text.matchAll(no)) contra.push(`${loc(p, m.index)} "${snippet(p, m.index, m[0].length)}"`); }
    for (const w of found) tableRows.push(['policy: ' + what, 'yes', w, '']);
    verify('policy: ' + what + ' (' + found.length + ' places)', found.length >= min && contra.length === 0,
      contra.length ? 'a place says the opposite of the rule "' + what + '": ' + MORE(contra) : 'the rule "' + what + '" is written in only ' + found.length + ' places, expected at least ' + min + ' (' + (found.length ? [...new Set(found.map((x) => x.split(':')[0]))].join(', ') : 'nowhere') + '): a sentence was reworded or deleted',
      contra.length ? 'change the sentence named so it says the same rule as everywhere else (or, if the rule really changed, change every place), ' + REBUILD : 'put the sentence back in the page that lost it; if you reworded it on purpose, give this test the new wording (search for "' + what.slice(0, 30) + '" in tests/consistency.test.mjs)');
  }
}

// the pizza menu: the price range on the page is the cheapest and the dearest pizza on the menu
{
  const menu = [...read('index.html').matchAll(/class="menu-price">\$(\d+)</g)].map((m) => +m[1]);
  const m = /\$(\d+)–\$(\d+)/.exec(index.text);
  verify('pizza menu: the price range says the cheapest and the dearest pizza (' + (m ? '$' + m[1] + '–$' + m[2] : 'none found') + ', menu ' + Math.min(...menu) + '–' + Math.max(...menu) + ')', menu.length >= 9 && !!m && +m[1] === Math.min(...menu) && +m[2] === Math.max(...menu),
    menu.length < 9 ? 'only ' + menu.length + ' pizzas with a price were found in the menu of index.html, expected at least 9' : !m ? 'the price range ("$15–$17") was not found in the text of index.html' : 'the range says $' + m[1] + '–$' + m[2] + ' but the menu prices in index.html are ' + menu.join(', '),
    'make the range in index.html (search for the two prices with a dash between them) say the lowest and the highest menu price (class="menu-price"), ' + REBUILD);
}

// the pizza schedule: the opening day is a Tuesday and the words say the same day; the visits start on the Friday after; the line hides after the last visit day
{
  const src = read('index.html'); const rows = [...src.matchAll(/<tr data-release="(\d{4})-(\d\d)-(\d\d)" data-until="(\d{4})-(\d\d)-(\d\d)"><td[^>]*>([^<]*)<\/td><td[^>]*>([^<]*)<\/td>/g)];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const bad = [];
  for (const r of rows) {
    const d = new Date(Date.UTC(+r[1], +r[2] - 1, +r[3])), u = new Date(Date.UTC(+r[4], +r[5] - 1, +r[6]));
    const open = decode(r[7]).trim(), visits = decode(r[8]).trim();
    const say = new RegExp('^' + MON[d.getUTCMonth()] + ' ' + d.getUTCDate() + '$').test(open);
    const v = /^([A-Z][a-z]{2}) (\d+)(?:–(?:([A-Z][a-z]{2}) )?(\d+))?$/.exec(visits);
    const first = v ? new Date(Date.UTC(+r[1], MON.indexOf(v[1]), +v[2])) : null, last = v ? new Date(Date.UTC(+r[1], MON.indexOf(v[3] || v[1]), +(v[4] || v[2]))) : null;
    const fri = new Date(d.getTime() + 3 * 864e5);
    if (d.getUTCDay() !== 2) bad.push(`${r[1]}-${r[2]}-${r[3]} is not a Tuesday`);
    if (!say) bad.push(`opening day written "${open}" but data-release is ${r[1]}-${r[2]}-${r[3]}`);
    if (!first || first.getTime() !== fri.getTime()) bad.push(`"${visits}" does not start on the Friday after ${open}`);
    if (!last || last.getTime() !== u.getTime()) bad.push(`data-until ${r[4]}-${r[5]}-${r[6]} is not the last visit day in "${visits}"`);
    if (last && last.getUTCDay() !== 0) bad.push(`"${visits}" does not end on a Sunday`);
  }
  verify('pizza schedule (' + rows.length + ' rows): Tuesday openings, matching words, visits from the next Friday to a Sunday, hide date = last visit day', rows.length >= 4 && bad.length === 0,
    bad.length ? 'index.html, the pizza schedule table (search for  data-release  ): ' + bad.join('; ') : 'only ' + rows.length + ' rows of the pizza schedule table (<tr data-release="…" data-until="…">) were read in index.html, expected at least 4: a row was deleted (fine once the season is over: then lower the 4 in tests/consistency.test.mjs) or a row lost its data-release or data-until',
    bad.length ? 'in that row make data-release the Tuesday, the dates in words the same day, the visit dates the Friday to Sunday after it, and data-until the last Sunday' : 'put the row back, or lower the 4 for "pizza schedule" in tests/consistency.test.mjs when old weekends were removed');
}

// weekday and date written together must be the same day of the year the page is about ("Tuesday, Oct 6" is a Tuesday in 2026)
{
  const year = +(/Fall (20\d\d)/.exec(index.text) || [])[1];
  const MONS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  const bad = []; let n = 0;
  for (const p of PAGES) { const re = new RegExp('(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day,? (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (\\d{1,2})', 'g'); let m; while ((m = re.exec(p.text))) { n++; const d = new Date(Date.UTC(year, MONS[m[2]], +m[3])); if (!DAYS[d.getUTCDay()].startsWith(m[1])) bad.push(`${loc(p, m.index)} "${m[0]}" is a ${DAYS[d.getUTCDay()]} in ${year}`); } }
  verify('every "Weekday, Month day" is that weekday in ' + year + ' (' + n + ' found)', n >= 3 && bad.length === 0,
    bad.length ? 'a weekday does not match its date: ' + MORE(bad) : 'only ' + n + ' "Weekday, Month day" dates were found on the pages, expected at least 3 (the dates in the text were reworded or the year in "Fall ' + year + '" changed)',
    bad.length ? 'fix the weekday or the day number in the place named (search for the words in quotes), ' + REBUILD : 'if the pages no longer write dates that way, lower the 3 for this check in tests/consistency.test.mjs');
}

// the dated lines hide on the day the words say ("Tuesday, Oct 6" hides after 2026-10-06; "Sunday, Oct 4" after 2026-10-04)
{
  const src = read('index.html'); const bad = []; let n = 0;
  const MONS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
  for (const m of src.matchAll(/<(li|p)\b[^>]*data-until="(\d{4})-(\d\d)-(\d\d)"[^>]*>([\s\S]*?)<\/\1>/g)) {
    const t = decode(m[5].replace(/<[^>]+>/g, ' ')); const d = /(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day, (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2})/.exec(t);
    if (!d) continue; n++;
    if (MONS[d[1]] !== +m[3] || +d[2] !== +m[4]) bad.push(`"${d[0]}" but data-until="${m[2]}-${m[3]}-${m[4]}"`);
  }
  verify('lines that name a day hide after that day (' + n + ' checked)', n >= 3 && bad.length === 0,
    bad.length ? 'in index.html a line names a day but hides on another: ' + MORE(bad) : 'only ' + n + ' dated lines (data-until="…" with a "Weekday, Month day" in them) were found in index.html, expected at least 3: lines that went out of date were deleted (fine: then lower the 3 in tests/consistency.test.mjs)',
    bad.length ? 'in index.html change that line\'s data-until to the day written in its words (or the words to the day in data-until)' : 'lower the 3 for this check in tests/consistency.test.mjs if the old lines were removed on purpose');
}

// the farm year bars (the "farm year at a glance" picture) start and end where the words next to them say
{
  const src = read('index.html'); const bad = []; let n = 0;
  const fraction = { early: [0, 0.34], mid: [0.34, 0.67], late: [0.67, 1.0] };
  const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  for (const li of src.matchAll(/<span class="cal-range">([^<]*)<\/span>[\s\S]*?<span class="cal-track"[^>]*>([\s\S]*?)<\/span><\/span>\s*<\/li>/g)) {
    const words = decode(li[1]).toLowerCase(); const bars = [...li[2].matchAll(/--s:([\d.]+);--e:([\d.]+)/g)].map((b) => [+b[1], +b[2]]);
    const mon = (w) => MON.findIndex((x) => w.startsWith(x));
    let start = null, end = null;
    const MONTHS = '(january|february|march|april|may|june|july|august|september|october|november|december)';   // "mid-April to early June", "mid- to late June through early July", "late September through October"
    const parts = new RegExp('(early|mid|late)?[- ]*(?:to (?:early|mid|late) )?' + MONTHS + '\\s*(?:to|through)\\s+(early |mid-|late )?' + MONTHS).exec(words.replace('mid- to late ', 'mid-').replace('new this year: every weekend, ', ''));
    if (/thanksgiving/.test(words)) { start = [10.7, 11.0]; const e = /early (december)/.exec(words); end = e ? [11.0, 11.34] : null; }
    else if (parts) {
      const a = fraction[parts[1]] || [0, 0.34], mo1 = mon(parts[2]); start = [mo1 + a[0] - 0.05, mo1 + a[1] + 0.05];
      const mod = (parts[3] || '').replace(/[- ]/g, ''), mo2 = mon(parts[4]); end = mod ? [mo2 + fraction[mod][0] - 0.05, mo2 + fraction[mod][1] + 0.05] : [mo2 + 1 - 0.1, mo2 + 1 + 0.1];   // "through October" = to the end of October
    } else if (/^april.*july and september/.test(words)) { start = [3 - 0.1, 3 + 0.1]; end = [7 - 0.1, 7 + 0.1]; }
    if (!start) { bad.push('could not read "' + words + '"'); continue; }
    n++;
    const b = bars[0];
    if (!(b[0] >= start[0] && b[0] <= start[1])) bad.push(`"${words}": the bar starts at ${b[0]}, the words put it between ${start.map((x) => x.toFixed(2)).join(' and ')}`);
    if (end && !(b[1] >= end[0] && b[1] <= end[1])) bad.push(`"${words}": the bar ends at ${bars[0][1]}, the words put it between ${end.map((x) => x.toFixed(2)).join(' and ')} (months count from 0 = January 1; 10 = November 1)`);
  }
  verify('farm year bars match the dates written beside them (' + n + ' checked)', n >= 6 && bad.length === 0,
    bad.length ? 'in index.html (the "farm year at a glance" list, search for  cal-range  ): ' + MORE(bad) : 'only ' + n + ' year bars were read in index.html, expected at least 6: the wording next to a bar was changed so the test cannot read it',
    bad.length ? 'change the bar (--s and --e, months counted from 0 = January 1) or the words next to it so they say the same dates' : 'put the wording back to the usual form ("mid-April to early June") or lower the 6 for this check in tests/consistency.test.mjs');
}

// the words for the seasons name the same months as the dates in js/season.js and the crop dates in js/features.js
{
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const d = (rx) => { const m = rx.exec(seasonSrc); return m ? { month: MONTHS[+m[1]], day: +m[2] } : null; };
  const spring = [d(/id: 'spring'.*?start: function \(y\) \{ return new Date\(y, (\d+), (\d+)\)/), d(/id: 'spring'.*?end: function \(y\) \{ return new Date\(y, (\d+), (\d+)\)/)];
  const summer = [d(/id: 'summer'.*?start: function \(y\) \{ return new Date\(y, (\d+), (\d+)\)/), d(/id: 'summer'.*?end: function \(y\) \{ return new Date\(y, (\d+), (\d+)\)/)];
  const fall = [d(/id: 'fall'.*?start: function \(y\) \{ return new Date\(y, (\d+), (\d+)\)/), d(/id: 'fall'.*?end: function \(y\) \{ return new Date\(y, (\d+), (\d+)\)/)];
  const winterEnd = d(/id: 'winter'.*?end: function \(y\) \{ return new Date\(y, (\d+), (\d+)\)/);
  const tom = /id: 'tomatoes'.*?wins: \(y\) => \[\[new Date\(y, (\d+), (\d+)\), new Date\(y, (\d+), (\d+)\)\]\]/.exec(featuresSrc);
  const bad = [], t = index.text;
  const half = (x) => (x.day <= 10 ? 'early' : x.day <= 20 ? 'mid' : 'late');
  const want = [
    ['spring', `${half(spring[0])}-${spring[0].month} to ${half(spring[1])} ${spring[1].month}`, /Usually (mid-April to early June)/i],
    ['summer', `mid- to late ${summer[0].month} through ${half(summer[1])} ${summer[1].month}`, /Usually (mid- to late June through early July)/i],
    ['fall', `${half(fall[0])}-${fall[0].month} through ${half(fall[1])} ${fall[1].month}`, /(Mid-September through early November)/i],
  ];
  for (const [name, expect, rx] of want) { const m = rx.exec(t); if (!m) { bad.push(name + ': the words were not found'); continue; } if (m[1].toLowerCase().replace(/[ -]+/g, '') !== expect.toLowerCase().replace(/[ -]+/g, '')) bad.push(`${name}: the page says "${m[1]}", js/season.js says ${expect}`); }
  if (!(winterEnd && winterEnd.month === 'December' && /Friday after Thanksgiving to early December/.test(t) && half(winterEnd) === 'early')) bad.push('winter: "Friday after Thanksgiving to early December" does not match the end date in js/season.js');
  if (!(tom && +tom[1] === 8 && +tom[2] >= 20 && +tom[3] === 9 && +tom[4] >= 28) || !/late September through October/.test(t)) bad.push('tomatoes and basil: "late September through October" does not match the dates in js/features.js');
  verify('season words match js/season.js and the tomato dates in js/features.js', bad.length === 0, 'the seasons in the text and in js/season.js (or the tomato dates in js/features.js) differ: ' + bad.join('; '),
    'change the words in index.html (search for the words quoted above) or the dates in js/season.js so they say the same months, ' + REBUILD);
}

// phone numbers, e-mail addresses, street addresses and web links
{
  // Phone numbers: the day-of emergency number (on the line that says "Day-of emergencies") and, once the farm agrees to show it, ONE main number. Each is written the
  // same everywhere (text, tel: link, structured data). A second main number, or two spellings of one, fails.
  const hits = [];
  const dayOfWords = /Day-of|emergenc/i;
  for (const p of PAGES) {
    const raw = read(p.file).split('\n');
    for (const m of p.text.matchAll(/\(?\b(\d{3})\)?[-. ] ?(\d{3})[-. ](\d{4})\b/g)) hits.push({ num: m[1] + m[2] + m[3], file: p.file, line: p.lineOf(m.index), words: snippet(p, m.index, m[0].length), dayOf: dayOfWords.test(p.text.slice(Math.max(0, m.index - 90), m.index)) });
    for (const a of p.attrs) if (a.name === 'href' && /^tel:/i.test(a.value)) hits.push({ num: a.value.replace(/\D/g, '').replace(/^1/, ''), file: p.file, line: a.line, words: 'tel: link ' + a.value, dayOf: dayOfWords.test(raw[a.line - 1] || '') });
  }
  for (const j of index.jsonld) if (j.telephone) hits.push({ num: String(j.telephone).replace(/\D/g, '').replace(/^1/, ''), file: 'index.html', line: 0, words: 'structured data "telephone": ' + j.telephone, dayOf: false });
  const dayNums = [...new Set(hits.filter((h) => h.dayOf).map((h) => h.num))], mainNums = [...new Set(hits.filter((h) => !h.dayOf).map((h) => h.num))];
  const pretty = (n) => n.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3');
  const where = (nums, dayOf) => nums.map((n) => pretty(n) + ' at ' + MORE(hits.filter((h) => h.num === n && h.dayOf === dayOf).map(quoted))).join('   vs   ');
  verify('phone: the day-of emergency number is the same in its text and its tel: link (' + (dayNums.map(pretty).join(', ') || 'none') + ')', dayNums.length === 1,
    dayNums.length ? 'two different day-of emergency numbers: ' + where(dayNums, true) : 'no day-of emergency number was found (the line "Day-of emergencies: call or text …" in index.html)',
    dayNums.length ? 'make the written number and the tel: link in the "Day-of emergencies" line the same (edit index.html), ' + REBUILD : 'put the line back in index.html (search for  Day-of emergencies  )');
  verify('phone: at most ONE main number, written the same everywhere, in text, tel: links and structured data (' + (mainNums.map(pretty).join(', ') || 'none shown yet') + ')', mainNums.length <= 1,
    'more than one main phone number is on the site: ' + where(mainNums, false) + '. (The day-of emergency number does not count; one main number is fine.)',
    'one of them is a typo, or an old number: make them all the same main number (edit the places named), ' + REBUILD);
  const mail = [], bad = [];
  for (const p of PAGES) for (const m of read(p.file).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) { const h = /href="mailto:([^"?]+)/.exec(m[1]); if (!h) continue; const t = decode(m[2].replace(/<[^>]+>/g, ' ')); const shown = (t.match(/[\w.+-]+@[\w.-]+/) || [])[0]; mail.push(h[1].toLowerCase()); if (shown && shown.toLowerCase() !== h[1].toLowerCase()) bad.push(`${SRC(p.file)}: shows ${shown} but opens ${h[1]}`); }
  const written = new Set(); for (const p of PAGES) for (const m of p.text.matchAll(/[\w.+-]+@[\w-]+\.[\w.]+/g)) written.add(m[0].toLowerCase());
  const listed = new Set([...index.text.matchAll(/Who to email[\s\S]*?Send your question to the right place \|([\s\S]*?)\| Drive time/g)].flatMap((m) => [...m[1].matchAll(/[\w.+-]+@[\w-]+\.[\w.]+/g)].map((x) => x[0].toLowerCase())));
  const strange = [...written, ...mail].filter((e) => !listed.has(e));
  const ldMail = index.jsonld.map((j) => j.email).filter(Boolean);
  const ldBad = ldMail.filter((e) => !listed.has(e.toLowerCase()));
  verify('e-mail: an address shown in a link is the address the link opens; only the addresses in "Who to email" appear (' + [...listed].join(', ') + '); structured data uses the general one', listed.size >= 4 && bad.length === 0 && strange.length === 0 && ldBad.length === 0,
    bad.concat(strange.map((e) => e + ' is written in ' + PAGES.filter((p) => p.text.toLowerCase().includes(e)).map((p) => SRC(p.file)).join(', ') + ' but is not in the "Who to email" list of index.html'), ldBad.map((e) => 'the structured data in index.html uses ' + e + ', which is not in the "Who to email" list'), listed.size < 4 ? ['only ' + listed.size + ' addresses were read in the "Who to email" list of index.html, expected at least 4'] : []).join('; '),
    'make the written address and the address its link opens the same, and use only addresses from the "Who to email" list of index.html (a new address goes into that list first), ' + REBUILD);
  const addr = []; const street = { Hartis: '4701', Poplin: '5503' };
  for (const p of PAGES) for (const m of p.text.matchAll(/(\d{4})? ?(Hartis|Poplin)\b/g)) if (m[1] !== street[m[2]] && !(m[1] === undefined && /(?:on|at) $|^$/.test(''))) { const before = p.text.slice(Math.max(0, m.index - 3), m.index); if (m[1] !== undefined || !/\w/.test(before)) addr.push(`${loc(p, m.index)} "${snippet(p, m.index, m[0].length)}"`); }
  const zips = new Set(); for (const p of PAGES) for (const m of p.text.matchAll(/NC (\d{5})/g)) zips.add(m[1]);
  const ld = index.jsonld.map((j) => j.address).filter(Boolean)[0] || {};
  verify('address: 4701 goes with Hartis and 5503 with Poplin everywhere, one ZIP code (' + [...zips].join(', ') + '), structured data matches', addr.length === 0 && zips.size === 1 && ld.streetAddress === '4701 Hartis Rd' && ld.postalCode === [...zips][0],
    [addr.length ? 'a street number does not go with its street (4701 Hartis, 5503 Poplin): ' + MORE(addr) : '', zips.size !== 1 ? 'the pages give ' + zips.size + ' ZIP codes: ' + [...zips].join(', ') : '', ld.streetAddress !== '4701 Hartis Rd' || ld.postalCode !== [...zips][0] ? 'the structured data in index.html says "' + ld.streetAddress + '", ZIP ' + ld.postalCode : ''].filter(Boolean).join('; '),
    'correct the address in the place named (search for the words in quotes), ' + REBUILD);
  // every "directions" link (Google, Apple, Waze), the drive-time tool and the structured data's map link name one of the two street addresses
  const full = { farm: ld.streetAddress + ', ' + ld.addressLocality + ', ' + ld.addressRegion + ' ' + ld.postalCode, greenhouse: '5503 Poplin Rd, ' + ld.addressLocality + ', ' + ld.addressRegion + ' ' + ld.postalCode };
  const stray = []; let seen = 0;
  const dest = (u) => { try { const q = new URL(u).searchParams; return q.get('destination') || q.get('daddr') || (/waze\.com/.test(u) ? q.get('q') : null) || (/query=/.test(u) && /4701|5503/.test(u) ? q.get('query') : null); } catch (e) { return null; } };
  for (const p of PAGES) for (const a of p.attrs) if (a.name === 'href') { const d = dest(a.value); if (d === null) continue; seen++; if (d !== full.farm && d !== full.greenhouse) stray.push(`${at({ file: p.file, line: a.line })} opens "${d}"`); }
  const biz = index.jsonld.find((j) => j.address) || {}, hasMap = dest(String(biz.hasMap || '')) || '';
  if (hasMap !== full.farm.replace(/,/g, '')) stray.push('structured data hasMap opens "' + hasMap + '"');
  for (const [k, v] of Object.entries({ farm: /farm:\s*\{ addr: '([^']+)'/.exec(featuresSrc), greenhouse: /greenhouse:\s*\{ addr: '([^']+)'/.exec(featuresSrc) })) if (!v || v[1] !== full[k]) stray.push('js/features.js drive-time address for the ' + k + ' is "' + (v ? v[1] : 'missing') + '"');
  verify('directions links: all ' + seen + ' map links (Google, Apple, Waze), the drive-time tool and the structured data open "' + full.farm + '" or "' + full.greenhouse + '"', seen >= 10 && stray.length === 0,
    stray.length ? 'a map link or the drive-time address names another place: ' + MORE(stray, 4) : 'only ' + seen + ' map links were found, expected at least 10: links were removed or their form changed',
    stray.length ? 'make the link (search for the address in its destination=, daddr= or q=) name the farm or The GreenHouse address in full, ' + REBUILD : 'put the links back, or lower the 10 for this check in tests/consistency.test.mjs');
  const links = (rx) => new Set(PAGES.flatMap((p) => p.attrs.filter((a) => a.name === 'href' && rx.test(a.value)).map((a) => a.value)));
  const book = links(/bookeo\.com/), square = links(/square\.site/), signup = links(/eepurl\.com/);
  verify('one booking page, one pre-order page and one e-mail signup address on every page', book.size === 1 && square.size === 1 && signup.size === 1,
    (book.size !== 1 ? book.size + ' different Bookeo (reservation) links: ' + [...book].join(' , ') + '. ' : '') + (square.size !== 1 ? square.size + ' different Square (pizza pre-order) links: ' + [...square].join(' , ') + '. ' : '') + (signup.size !== 1 ? signup.size + ' different e-mail signup links: ' + [...signup].join(' , ') : ''),
    'use the same link on every page (search the pages/ files and index.html for the odd one out), ' + REBUILD);
  const drive = PAGES.filter((p) => p.attrs.some((a) => a.name === 'data-drive')).map((p) => p.attrs.filter((a) => a.name === 'data-drive').map((a) => a.value).join(','));
  verify('drive minutes to each town are the same on the home page and the first-visit page (' + drive.join(' / ') + ')', drive.length === 2 && drive[0] === drive[1],
    drive.length !== 2 ? 'the drive times (data-drive="…") were found on ' + drive.length + ' pages, expected 2 (index.html and pages/first-visit.html)' : 'the drive minutes differ: index.html says ' + drive[0] + ', pages/first-visit.html says ' + drive[1],
    'make the data-drive="…" numbers the same in both files, ' + REBUILD);
}

/* ------------------------------------------------------------------ *
 * The languages: numbers, prices, times, weekdays, months, names and e-mail addresses in a translation are the English ones
 * ------------------------------------------------------------------ */
const LANGS = ['es', 'hi', 'zh', 'vi'];
const dict = {};
for (const code of LANGS) { const sb = {}; sb.window = sb; vm.runInNewContext(read('lang/' + code + '.js'), sb); dict[code] = sb.WISE_ACRES.dict[code]; }
const EN = JSON.parse(read('lang/en.json'));   // id -> English
const plain = (s) => decode(String(s).replace(/<[^>]+>/g, ' ')).replace(/[   ]/g, ' ');

const MONTH_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH = {   // regular expressions for the months in each language (full names and the short forms the site uses)
  es: ['enero|ene', 'febrero|feb', 'marzo|mar', 'abril|abr', 'mayo|may', 'junio|jun', 'julio|jul', 'agosto|ago', 'septiembre|setiembre|sep|sept', 'octubre|oct', 'noviembre|nov', 'diciembre|dic'],
  hi: ['जन|Jan', 'फ़र|फर|Feb', 'मार्च|Mar', 'अप्रै|Apr', 'मई|May', 'जून|Jun', 'जुल|Jul', 'अग|Aug', 'सित|Sep', 'अक्टू|अक्तू|Oct', 'नव|Nov', 'दिस|Dec'],   // the year bar writes the Latin short names (Jan..Dec)
};
const WEEKDAY = {   // the names in each language, Sunday first (a short form after the bar; "bên thứ ba" is "third party", not Tuesday)
  es: ['domingo|dom', 'lunes|lun', 'martes', 'mi[eé]rcoles|mi[eé]', 'jueves|jue', 'viernes|vie', 's[aá]bado|s[aá]b'],
  hi: ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'],
  vi: ['chủ nhật', 'thứ hai', 'thứ ba', 'thứ tư', 'thứ năm', 'thứ sáu', 'thứ bảy'],
};
const WEDGE = { es: ['(?<![\\p{L}])', '\\.?(?![\\p{L}])'], vi: ['(?<![\\p{L}])(?<!bên )', '(?![\\p{L}])'], hi: ['', ''] };
const ZHDAY = '日一二三四五六';
const count = (s, rx) => (s.match(rx) || []).length;
function weekdays(s, lang) {   // sorted list of weekday numbers (0 = Sunday) found in s
  const out = [];
  if (lang === 'en') { const r = /(?<![A-Za-z])(Sun|Mon|Tue|Wed|Thu|Fri|Sat)(?:[a-z]*day)?s?(?![a-z])/g; let m; while ((m = r.exec(s))) out.push(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(m[1])); return out.sort(); }
  if (lang === 'zh') { for (const m of s.matchAll(/(?:周|星期)([日一二三四五六天])/g)) out.push(m[1] === '天' ? 0 : ZHDAY.indexOf(m[1])); return out.sort(); }
  const [pre, post] = WEDGE[lang];
  WEEKDAY[lang].forEach((names, d) => { for (const _ of s.matchAll(new RegExp(pre + '(?:' + names + ')' + post, 'giu'))) out.push(d); });
  return out.sort();
}
function months(s, lang) {   // sorted list of month numbers (1-12) written as words
  const out = [];
  if (lang === 'en') { const r = /(?<![A-Za-z])(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\b/g; let m; while ((m = r.exec(s))) out.push(MONTH_EN.findIndex((x) => x.startsWith(m[1].slice(0, 3))) + 1); return out.sort((a, b) => a - b); }
  if (lang === 'zh' || lang === 'vi') return out;   // written as numbers: 10月, thg 10
  MONTH[lang].forEach((names, i) => { const rx = lang === 'es' ? new RegExp('(?<![A-Za-zÀ-ÿ])(?:' + names + ')\\.?(?![A-Za-zÀ-ÿ])', 'gi') : new RegExp(names, 'g'); for (let k = 0; k < count(s, rx); k++) out.push(i + 1); });
  return out.sort((a, b) => a - b);
}
const DEV = { '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9' };
function numbers(s) {   // every number, as written in digits ("1,500" and "1.500" are 1500, "4,50" is 4.5); ":00" minutes are not counted
  s = s.replace(/[०-९]/g, (c) => DEV[c]).replace(/:00\b/g, '').replace(/(?<=\d)[,\u202f.](?=\d{3}\b)/g, '').replace(/(?<=\d),(?=\d{1,2}\b)/g, '.');
  return (s.match(/\d+(?:\.\d+)?/g) || []).map((x) => String(parseFloat(x)));
}
const moneyOf = (s) => (s.match(/\$\s?\d[\d,]*(?:\.\d+)?/g) || []).map((x) => String(parseFloat(x.replace(/[$,\s]/g, '')))).sort();
const percentOf = (s) => (s.match(/\d+(?:[.,]\d+)?\s?%/g) || []).map((x) => String(parseFloat(x.replace(',', '.')))).sort();
const NAMES = ['Wise Acres', 'Wise Pie', 'The GreenHouse', 'Hartis', 'Poplin', 'Waxhaw Creamery', 'Uno Alla Volta', 'Follow Your Heart', 'Wholly Wholesome', 'Foster Village', 'Cathy', 'Pranee', 'Vanessa', 'Ava', 'Bailey', 'Morgan', 'Mac'];
const ALLOWED_EXTRA = [[/700-degree/, '370']];   // 700 °F, and the translator adds the Celsius figure
const SAME_HOURS = /\b[ap]\.?m\b|\d:\d\d| to \d|\d ?[–-] ?\d/i;

/** What differs between an English text and its translation (empty list = the same).
 *  tools/review_sheet.py has a Python copy of this function (it checks a friend's corrections before they are written); tests/review-sheet.test.mjs runs
 *  both on about 20,000 pairs and fails when they disagree: when you change a rule here, change it there too. */
function differences(en, tr, lang) {
  const e = plain(en), t = plain(tr), out = [];
  const eMoney = moneyOf(e), tMoney = moneyOf(t); if (eMoney.join() !== tMoney.join()) out.push(`prices ${eMoney.join(' ') || '-'} vs ${tMoney.join(' ') || '-'}`);
  const ePct = percentOf(e), tPct = percentOf(t); if (ePct.join() !== tPct.join()) out.push(`percent ${ePct.join(' ') || '-'} vs ${tPct.join(' ') || '-'}`);
  // numbers (ages, counts, clock hours, dates): the same digits; a 12-hour time may be written on the 24-hour clock; a month may be written as a number
  const eMonths = months(e, 'en'), tMonths = months(t, lang);
  const want = numbers(e); const have = numbers(t);
  if (lang === 'zh' || lang === 'vi') for (const mo of eMonths) want.push(String(mo));
  if (lang === 'es' || lang === 'hi') for (const m of e.matchAll(/(?<![\d/])(\d{1,2})\/(\d{1,2})(?![\d/])/g)) { const i = want.indexOf(String(+m[1])); if (i >= 0 && tMonths.includes(+m[1])) want.splice(i, 1); }   // 9/29 may be written 29 septiembre / 29 सितंबर: the month is then a word, not a digit
  const missing = [];
  for (const x of want) { const i = have.indexOf(x); if (i >= 0) { have.splice(i, 1); continue; } const k = SAME_HOURS.test(e) && +x >= 1 && +x <= 12 ? have.indexOf(String(+x + 12)) : -1; if (k >= 0) { have.splice(k, 1); continue; } missing.push(x); }
  const extra = have.filter((x) => !want.includes(x) && !ALLOWED_EXTRA.some(([rx, v]) => rx.test(e) && v === x));
  if (missing.length) out.push('number ' + missing.join(', ') + ' is not in the translation'); if (extra.length) out.push('number ' + extra.join(', ') + ' is not in the English');
  if (lang === 'es' || lang === 'hi') { const miss = eMonths.filter((mo) => !tMonths.includes(mo)); if (miss.length) out.push('month ' + miss.map((x) => MONTH_EN[x - 1]).join(', ') + ' is not in the translation'); }
  const eDays = weekdays(e, 'en'), tDays = weekdays(t, lang);
  if (eDays.join() !== tDays.join()) { const names = (a) => a.map((d) => DAYS[d].slice(0, 3)).join(' ') || '-'; out.push('weekdays ' + names(eDays) + ' vs ' + names(tDays)); }
  for (const n of NAMES) if (new RegExp('(?<![A-Za-z])' + n + '(?![A-Za-z])').test(e) && !t.includes(n)) out.push('name "' + n + '" is not in the translation');
  for (const a of e.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []) if (!t.includes(a)) out.push('e-mail ' + a + ' is not in the translation');
  for (const a of e.match(/\b\d{3}-\d{3}-\d{4}\b/g) || []) if (!t.includes(a)) out.push('phone ' + a + ' is not in the translation');
  return out;
}

// the checks above must be able to see a wrong fact: these pairs are mistakes on purpose
{
  const wrong = [
    ['$3 per person, ages 3 and up', '$4 por persona, a partir de los 3 años', 'es'], ['$3 per person, ages 3 and up', '每人 $3，4 岁及以上', 'zh'], ['Open every Tuesday at 5:00 PM', 'Abre todos los martes a las 6:00 p. m.', 'es'],
    ['Thursday–Sunday', 'viernes a domingo', 'es'], ['Thursday–Sunday', 'Thứ Sáu–Chủ Nhật', 'vi'], ['Oct 6', '7 de oct', 'es'], ['Infants 2 and under are free', '3 साल और उससे छोटे शिशुओं के लिए मुफ़्त', 'hi'],
    ['Email vanessa@wiseacresorganic.com', 'Escribe a vanesa@wiseacresorganic.com', 'es'], ['Wise Pie pizza at The GreenHouse', 'Pizza Wise Pi en el invernadero', 'es'], ['we refund minus the 3% fee', 'reembolsamos menos la comisión del 5 %', 'es'],
  ];
  const right = [['$3 per person, ages 3 and up', '$3 por persona, a partir de los 3 años', 'es'], ['Open every Tuesday at 5:00 PM', 'Abre todos los martes a las 5:00 p. m.', 'es'], ['Open every Tuesday at 5:00 PM', 'Abre los martes a las 17:00', 'es'], ['Oct 6', '6 de oct', 'es'], ['Fri–Sun, 10 am–8 pm', 'शुक्र–रवि, सुबह 10 बजे–रात 8 बजे', 'hi'], ['Tuesday, Oct 6', '10 月 6 日周二', 'zh']];
  const blind = wrong.filter(([e, t, l]) => differences(e, t, l).length === 0), noisy = right.filter(([e, t, l]) => differences(e, t, l).length > 0);
  verify('the language check sees a wrong price, time, age, weekday, month, name or e-mail, and accepts the same fact written another way', blind.length === 0 && noisy.length === 0, blind.map((x) => 'missed: ' + x[1]).concat(noisy.map((x) => 'false alarm: ' + x[1] + ' = ' + differences(...x).join(', '))).join('; '),
    'this is a problem in the test itself (the function differences() in tests/consistency.test.mjs), not in the site: tell the developer');
}

// the QR signs (tools/qr_links.json, printed from print/qr-signs.html and the Hindi, Chinese and Vietnamese sheets): the same address and web links as the pages, a copy in every language with the same facts
{
  const qr = JSON.parse(read('tools/qr_links.json')), printed = read('print/qr-signs.html'), bad = []; let printedCount = 0;
  const biz = index.jsonld.find((j) => j.address) || {}, addr = biz.address || {};
  const d = qr.signs.find((x) => x.id === 'directions');
  if (!d || !d.text_en.startsWith(addr.streetAddress.replace(/ Rd$/, ' Road') + ', ' + addr.addressLocality + ', ' + addr.addressRegion)) bad.push('"Directions" sign does not name ' + addr.streetAddress);
  if (!d || decodeURIComponent(new URL(d.url).searchParams.get('destination')) !== addr.streetAddress + ', ' + addr.addressLocality + ', ' + addr.addressRegion + ' ' + addr.postalCode) bad.push('"Directions" sign opens another address than the page');
  const link = (rx) => new Set(PAGES.flatMap((p) => p.attrs.filter((a) => a.name === 'href' && rx.test(a.value)).map((a) => a.value)));
  for (const [id, rx] of [['reserve', /bookeo\.com/], ['pizza', /square\.site/], ['signup', /eepurl\.com/]]) { const sign = qr.signs.find((x) => x.id === id); if (!sign || !link(rx).has(sign.url)) bad.push('"' + id + '" sign opens ' + (sign && sign.url) + ', not the link the pages use'); }
  for (const sign of qr.signs) {
    for (const k of ['title', 'text']) { const dd = differences(sign[k + '_en'], sign[k + '_es'], 'es'); if (dd.length) bad.push(`${sign.id} ${k}: ${dd.join('; ')}`); }
    if (!printed.includes('id="' + sign.id + '"')) continue;   // a sign without a web address yet (the review sign, until reviewUrl is set) is not printed
    printedCount++;
    const mine = new RegExp('<section class="sign" id="' + sign.id + '">[\\s\\S]*?<h1>([\\s\\S]*?)<span lang="es">([\\s\\S]*?)</span></h1>[\\s\\S]*?<p class="text">([\\s\\S]*?)<span lang="es">([\\s\\S]*?)</span></p>').exec(printed);
    if (!mine || [decode(mine[1]), decode(mine[2]), decode(mine[3]), decode(mine[4])].join('|') !== [sign.title_en, sign.title_es, sign.text_en, sign.text_es].join('|')) bad.push(sign.id + ': the printed sign (print/qr-signs.html) does not say what tools/qr_links.json says');
  }
  // the same signs in Hindi, Chinese and Vietnamese (the "languages" part at the end of the list): the same facts, and the printed sheet says what the list says
  for (const code of ['hi', 'zh', 'vi']) {
    const block = (qr.languages || {})[code]; let sheet = '';
    try { sheet = read(`print/qr-signs.${code}.html`); } catch (e) { bad.push(`print/qr-signs.${code}.html is missing`); }
    if (!block) { bad.push(`${code}: no wording in tools/qr_links.json`); continue; }
    for (const sign of qr.signs) {
      const w = block.signs && block.signs[sign.id];
      if (!w) { bad.push(`${code} ${sign.id}: no wording`); continue; }
      for (const k of ['title', 'text']) { const dd = differences(sign[k + '_en'], w[k], code); if (dd.length) bad.push(`${code} ${sign.id} ${k}: ${dd.join('; ')}`); }
      if (!sheet.includes('id="' + sign.id + '"')) continue;
      const own = (x) => decode(x.replace(/<\/?wa-en[^>]*>/g, ''));
      const m = new RegExp('<section class="sign" id="' + sign.id + '">[\\s\\S]*?<h1 lang="[^"]*">([\\s\\S]*?)<span lang="en">([\\s\\S]*?)</span></h1>[\\s\\S]*?<p class="text" lang="[^"]*">([\\s\\S]*?)(?:<span lang="en">([\\s\\S]*?)</span>)?</p>').exec(sheet);
      const same = m && (m[4] === undefined ? w.text === sign.text_en : decode(m[4]) === sign.text_en);   // an address that is the same in both languages is printed once
      if (!m || !same || own(m[1]) !== w.title || decode(m[2]) !== sign.title_en || own(m[3]) !== w.text) bad.push(`${code} ${sign.id}: the printed sheet (print/qr-signs.${code}.html) does not say what tools/qr_links.json says`);
    }
  }
  verify('QR signs (' + qr.signs.length + ' in the list, ' + printedCount + ' printed): the address and web links match the pages, every language has the same facts, the printed pages say what the list says', printedCount >= 9 && bad.length === 0,
    bad.length ? 'in tools/qr_links.json or print/qr-signs.html: ' + MORE(bad, 4) : 'only ' + printedCount + ' signs are printed in print/qr-signs.html, expected at least 9',
    bad.length ? 'fix the sign in tools/qr_links.json (the English, Spanish, Hindi, Chinese and Vietnamese words, the web address), then run  python3 tools/make_qr.py  to print the pages again' : 'run  python3 tools/make_qr.py  to make print/qr-signs.html again');
}

for (const code of LANGS) {
  const bad = []; let n = 0;
  for (const [id, tr] of Object.entries(dict[code].ui)) { const en = EN[id]; if (en === undefined) continue; n++; const d = differences(en, tr, code); if (d.length) bad.push(`${id} "${plain(en).slice(0, 70)}" → "${plain(tr).slice(0, 70)}": ${d.join('; ')}`); }
  for (const [en, tr] of Object.entries(dict[code].js)) { n++; const d = differences(en, tr, code); if (d.length) bad.push(`js "${en.slice(0, 70)}" → "${plain(tr).slice(0, 70)}": ${d.join('; ')}`); }
  verify(code + ': ' + n + ' translated texts carry the English numbers, prices, times, weekdays, months, names and e-mail addresses', n > 500 && bad.length === 0,
    bad.length ? bad.length + ' translation(s) in lang/src/' + code + '.json differ from their English. First: ' + bad.slice(0, 3).join('  |  ') : 'only ' + n + ' translated texts were read for ' + code + ', expected more than 500: lang/' + code + '.js is missing or was not built',
    bad.length ? 'open lang/src/' + code + '.json, search for the id (tXXXXXXXX) or the English words quoted, make the number, price, time, weekday, month, name or e-mail the same as the English, then run  python3 tools/i18n.py build' : 'run  python3 tools/i18n.py build');
}

// the same English sentence, written in two places, is translated with the same facts in both (a fact repeated in the FAQ and on a page cannot drift)
for (const code of LANGS) {
  const byFact = new Map(), bad = [];
  for (const [id, en] of Object.entries(EN)) { const tr = dict[code].ui[id]; if (tr === undefined) continue; const key = plain(en).toLowerCase().replace(/[^a-z0-9$%:]+/g, ' ').trim(); if (key.length < 12) continue; const sig = [moneyOf(plain(tr)).join(','), numbers(plain(tr)).sort().join(','), weekdays(plain(tr), code).join(',')].join('/'); const was = byFact.get(key); if (was && was.sig !== sig) bad.push(plain(en).slice(0, 60)); else byFact.set(key, { sig }); }
  verify(code + ': one English wording is translated with the same facts everywhere it appears', bad.length === 0, 'the same English sentence is translated with different facts in two places of lang/src/' + code + '.json: ' + bad.slice(0, 3).join(' | '),
    'search lang/src/' + code + '.json for the English words quoted, find the two translations of it and make their numbers, prices and weekdays the same, then run  python3 tools/i18n.py build');
}

if (SHOW) { for (const r of tableRows.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]))) console.log(r.join('\t')); }
await finish({});
