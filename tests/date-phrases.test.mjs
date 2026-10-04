// order: 37
// browser: no
// quick: no
// covers: tools/date_phrases.py, tools/i18n.py, lang/src/*, index.html
/* The dates of the pizza schedule translate themselves (tools/date_phrases.py, called by  python3 tools/i18n.py extract). Needs python3 and
 * beautifulsoup4, no browser, about 30 seconds. Everything happens in a temporary copy of the site; your files are not touched.
 *   - the farm's own lines come out letter for letter: the 8 date cells of the fall 2026 table and the "Open now" line of Oct 2 and 3
 *     (written by hand in Spanish, Hindi, Chinese and Vietnamese before this tool existed; they are copied into this file)
 *   - every day of a year, as one day, two days, a range and a range over two months, in all four languages: the same numbers as the English,
 *     the right month and weekday word, no English left, no two different dates with the same words, the same tags as the English
 *   - a new weekend typed into the page (a row, a changed "Open now" line) needs no translator: pages.py + extract + build leaves
 *     "0 missing" in all four languages, the lines are in lang/src and in the built lang/<code>.js, and running extract again changes nothing
 *   - a line a person wrote in lang/src is never replaced
 *   - a sentence in another shape, or a date in a shape the tool does not know, is still reported as missing, with the reason in plain words */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, ok, info, skip, finish } from './lib.mjs';

const PY = process.env.WA_PYTHON || 'python3';
const ENV = { ...process.env, PYTHONIOENCODING: 'utf-8' };
const py = (cwd, ...args) => spawnSync(PY, args, { cwd, encoding: 'utf8', env: ENV });
if (py(ROOT, '-c', 'import bs4').status !== 0) skip(`${PY} with beautifulsoup4 is not available (pip install beautifulsoup4)`);
const LANGS = ['es', 'hi', 'zh', 'vi'];

/** The tool's translation of each English text: { text: { es, hi, zh, vi } } (null where the tool does not know the text). */
const generate = (texts) => {
  const r = spawnSync(PY, ['-c', 'import sys,json; sys.path.insert(0,"tools"); import date_phrases as d; t=json.load(sys.stdin); print(json.dumps({x:{c:d.translate(c,x) for c in d.LANGS} for x in t}, ensure_ascii=False))'],
    { cwd: ROOT, input: JSON.stringify(texts), encoding: 'utf8', env: ENV, maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(r.stderr.trim().split('\n').pop());
  return JSON.parse(r.stdout);
};

const OPEN = (dates, tail = '') => `<strong>Open now:</strong> pizza reservations for ${dates}.${tail}`;
const RAIN = (day, date) => ` We haven’t opened ${day}, ${date}. Unless the forecast changes a lot, we’ll be closed that day for rain.`;

// ---- 1. the farm's own lines: [English, es, hi, zh, vi], as they stood in lang/src/*.json before the tool existed
const GOLD = [
  ['Oct 6', '6 oct', '6 अक्टूबर', '10月6日', '6 thg 10'],
  ['Oct 9–11', '9–11 oct', '9–11 अक्टूबर', '10月9–11日', '9–11 thg 10'],
  ['Oct 13', '13 oct', '13 अक्टूबर', '10月13日', '13 thg 10'],
  ['Oct 16–18', '16–18 oct', '16–18 अक्टूबर', '10月16–18日', '16–18 thg 10'],
  ['Oct 20', '20 oct', '20 अक्टूबर', '10月20日', '20 thg 10'],
  ['Oct 23–25', '23–25 oct', '23–25 अक्टूबर', '10月23–25日', '23–25 thg 10'],
  ['Oct 27', '27 oct', '27 अक्टूबर', '10月27日', '27 thg 10'],
  ['Oct 30–Nov 8', '30 oct–8 nov', '30 अक्टूबर–8 नवंबर', '10月30日–11月8日', '30 thg 10–8 thg 11'],
  [OPEN('Oct 2 &amp; 3', RAIN('Sunday', 'Oct 4')),
    '<strong>Abierto ahora:</strong> reservas con pizza para el 2 y 3 de oct. No hemos abierto el domingo 4 de oct. A menos que el pronóstico cambie mucho, ese día estaremos cerrados por lluvia.',
    '<strong>अभी खुला:</strong> 2 और 3 अक्टूबर के लिए पिज़्ज़ा रिज़र्वेशन। रविवार, 4 अक्टूबर के रिज़र्वेशन हमने अभी नहीं खोले हैं। जब तक पूर्वानुमान बहुत न बदले, उस दिन हम बारिश के कारण बंद रहेंगे।',
    '<strong>现已开放：</strong>10 月 2 日和 3 日的披萨预约。10 月 4 日（周日）尚未开放。除非天气预报大幅变化，否则我们那天会因下雨休息。',
    '<strong>Đang mở:</strong> đặt chỗ có pizza cho ngày 2 và 3 thg 10. Chúng tôi chưa mở Chủ Nhật, 4 thg 10. Trừ khi dự báo thay đổi nhiều, chúng tôi sẽ đóng cửa ngày đó vì mưa.'],
];
{
  const got = generate(GOLD.map((g) => g[0]));
  let n = 0, bad = [];
  for (const g of GOLD) LANGS.forEach((code, i) => { n++; if (got[g[0]][code] !== g[i + 1]) bad.push(`${code} "${g[0].slice(0, 30)}": ${got[g[0]][code]}`); });
  ok(`the farm's own lines (${GOLD.length} English texts x 4 languages = ${n}) come out letter for letter`, bad.length === 0, bad.slice(0, 3).join(' | '));
}

// ---- 2. a whole year of dates
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYNAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WORDS = {   // the month word after a day number, and the weekday words (Sunday first), as the farm's own lines write them
  es: { month: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'], week: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] },
  hi: { month: ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'], week: ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'] },
  zh: { month: null, week: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] },   // 10月 / 10 月: the number and 月
  vi: { month: null, week: ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'] },   // thg 10
};
const word = (w, f = '') => new RegExp(`(?<![\\p{L}])${w}(?![\\p{L}])`, 'u' + f);
const monthRe = (code, m, f = '') => code === 'zh' ? new RegExp(`(?<!\\d)${m + 1} ?月`, f) : code === 'vi' ? new RegExp(`thg ${m + 1}(?!\\d)`, f) : word(WORDS[code].month[m], f);
const days = [];   // every day of 2028 (a leap year): [month index, day, weekday]
for (let t = Date.UTC(2028, 0, 1); new Date(t).getUTCFullYear() === 2028; t += 864e5) { const d = new Date(t); days.push([d.getUTCMonth(), d.getUTCDate(), d.getUTCDay()]); }
const label = ([m, d]) => `${MON[m]} ${d}`;
const texts = [], meta = {};   // English text -> { nums, months, weekday }
const add = (text, nums, months, weekday = -1) => { if (!meta[text]) { texts.push(text); meta[text] = { nums, months, weekday }; } };
for (let i = 0; i + 2 < days.length; i++) {
  const a = days[i], b = days[i + 1], c = days[i + 2];
  const tail = (en, nums, months) => add(OPEN(en, RAIN(DAYNAME[b[2]], label(b))), [...nums, b[1]], [...months, b[0]], b[2]);
  for (const [en, to] of [[label(a)], [`${label(a)}–${b[0] === a[0] ? b[1] : label(b)}`, b], [`${label(a)}–${c[0] === a[0] ? c[1] : label(c)}`, c], [`${label(a)} &amp; ${b[0] === a[0] ? b[1] : label(b)}`, b]]) {
    const nums = to ? [a[1], to[1]] : [a[1]], months = to ? [a[0], to[0]] : [a[0]];
    add(en, nums, months); add(OPEN(en), nums, months); tail(en, nums, months);
  }
}
{
  const got = generate(texts);
  const probs = { missing: [], numbers: [], month: [], weekday: [], english: [], tags: [], spaces: [] };
  const ENGLISH = /\b(Open|now|reservations|haven|forecast|closed|rain|that|day|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/;
  const tags = (x) => (x.match(/<\/?[a-z][a-z0-9]*/g) || []).join();
  for (const code of LANGS) {
    const seen = new Set();
    for (const en of texts) {
      const tr = got[en][code], m = meta[en], at = `${code} ${en.replace(/<[^>]+>/g, '').slice(0, 45)}`;
      if (tr == null) { probs.missing.push(at); continue; }
      seen.add(tr);
      let plain = tr.replace(/<[^>]+>/g, '');
      const months = [...new Set(m.months)];
      for (const mi of months) if (!monthRe(code, mi).test(plain)) probs.month.push(`${at}: month ${MON[mi]}`);
      if (m.weekday >= 0 && !plain.includes(WORDS[code].week[m.weekday])) probs.weekday.push(`${at}: ${WORDS[code].week[m.weekday]}`);
      if (code === 'zh' || code === 'vi') for (const mi of months) plain = plain.replace(monthRe(code, mi, 'g'), ' ');   // the month number is not a day number
      const nums = [...plain.matchAll(/\d+/g)].map((x) => +x[0]);
      if (nums.join() !== m.nums.join()) probs.numbers.push(`${at}: ${nums.join(',')} instead of ${m.nums.join(',')}`);
      if (ENGLISH.test(tr.replace(/<[^>]+>/g, '')) || ((code === 'hi' || code === 'zh') && /[A-Za-z]/.test(tr.replace(/<[^>]+>/g, '').replace(/pizza/g, '')))) probs.english.push(`${at} -> ${tr.replace(/<[^>]+>/g, '').slice(0, 60)}`);
      if (tags(tr) !== tags(en)) probs.tags.push(at);
      if (/ {2,}|^ | $/.test(tr)) probs.spaces.push(`${at} -> ${tr.slice(0, 50)}`);
    }
    ok(`${code}: no two different English dates share one translation (${seen.size} of ${texts.length})`, seen.size === texts.length, `${texts.length - seen.size} collide`);
  }
  const first = (k) => probs[k].slice(0, 3).join(' | ');
  ok(`a whole year of dates (every day of 2028 as one day, two days, a range, a range over two months; as a table cell, in the "Open now" line, and with the rain sentence: ${texts.length} English texts x 4 languages): all understood`, probs.missing.length === 0, first('missing'));
  ok('...each keeps the day numbers of the English, in the same order', probs.numbers.length === 0, first('numbers'));
  ok('...each names its month in that language (Spanish oct, Hindi अक्टूबर, Chinese 10月, Vietnamese thg 10)', probs.month.length === 0, first('month'));
  ok('...each names the right weekday in that language', probs.weekday.length === 0, first('weekday'));
  ok('...no English month, weekday or sentence word is left in it', probs.english.length === 0, first('english'));
  ok('...each has the same tags as the English (the <strong> stays)', probs.tags.length === 0, first('tags'));
  ok('...no double, leading or trailing space', probs.spaces.length === 0, first('spaces'));
}
{
  // twelve months must give twelve different words, seven weekdays seven different words (a swapped pair would pass the checks above for one date only)
  const twelve = MON.map((m) => `${m} 5`), got = generate(twelve);
  const wd = DAYNAME.map((d) => OPEN('Oct 9', RAIN(d, 'Oct 11'))), g2 = generate(wd);
  for (const code of LANGS) {
    ok(`${code}: the 12 months have 12 different words`, new Set(twelve.map((t) => got[t][code])).size === 12, '');
    ok(`${code}: the 7 weekdays have 7 different words`, new Set(wd.map((t) => g2[t][code])).size === 7, '');
  }
}

// ---- 3. a new weekend, typed into a copy of the page
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-dates-'));
try {
  const copy = (rel) => fs.cpSync(path.join(ROOT, rel), path.join(tmp, rel), { recursive: true, filter: (s) => !/__pycache__/.test(s) });
  for (const f of fs.readdirSync(ROOT).filter((x) => x.endsWith('.html') && x !== '404.html')) copy(f);
  for (const d of ['pages', 'lang', 'js', 'tools']) copy(d);
  fs.mkdirSync(path.join(tmp, 'assets'));
  for (const f of fs.readdirSync(path.join(ROOT, 'assets'), { withFileTypes: true }).filter((x) => x.isFile())) copy('assets/' + f.name);   // the share pictures pages.py looks for
  const step = () => [py(tmp, 'tools/pages.py'), py(tmp, 'tools/i18n.py', 'extract'), py(tmp, 'tools/i18n.py', 'build')];
  const srcs = () => Object.fromEntries(LANGS.map((c) => [c, fs.readFileSync(path.join(tmp, 'lang', 'src', c + '.json'), 'utf8')]));
  const miss = (code) => py(tmp, 'tools/i18n.py', 'missing', code, '--list').stdout;
  const idx = path.join(tmp, 'index.html');
  const html = fs.readFileSync(idx, 'utf8');
  const rowEnd = '                </tbody>';
  const rowsOk = html.includes(rowEnd) && html.includes('data-t="t58da3033"');
  if (!rowsOk) {
    info('(the schedule table or the "Open now" line is no longer in index.html in the shape this part of the test uses: that part was skipped)');
  } else {
    step();
    const before = srcs();
    const r = step();
    ok('a finished site: extract adds nothing (no line of lang/src changes)', r.every((x) => x.status === 0) && LANGS.every((c) => srcs()[c] === before[c]), r.map((x) => x.stderr.trim().split('\n').pop()).join(''));

    // a new weekend: a table row, and the "Open now" line replaced by one for Oct 9 and 10 with Sunday held back
    const sentence = html.match(/<p data-t="t58da3033"[^>]*>(.*?)<\/p>/s);
    let edited = html.replace(rowEnd, '                  <tr data-release="2026-11-03" data-until="2026-11-08"><td>Nov 3</td><td>Nov 6&ndash;8</td></tr>\n' + rowEnd);
    edited = edited.replace(sentence[0], sentence[0].replace(/<p data-t="t58da3033"/, '<p').replace(sentence[1], '<strong>Open now:</strong> pizza reservations for Oct 9 &amp; 10. We haven&rsquo;t opened Sunday, Oct 11. Unless the forecast changes a lot, we&rsquo;ll be closed that day for rain.'));
    fs.writeFileSync(idx, edited);
    const s1 = step();
    ok('a new row (Nov 3 / Nov 6–8) and a new "Open now" line: pages.py, extract and build all succeed', s1.every((x) => x.status === 0), s1.map((x) => x.stderr.trim().split('\n').pop()).join(''));
    ok('...extract says which lines the tool translated', /date line\(s\) translated by the tool/.test(s1[1].stdout), s1[1].stdout.trim().split('\n').slice(-3).join(' | '));
    for (const code of LANGS) {
      const m = py(tmp, 'tools/i18n.py', 'missing', code).stdout;
      ok(`${code}: nothing is missing (page text and JavaScript text)`, /, 0 missing, .*JavaScript: 0 missing/.test(m), m.trim().split('\n')[0]);
    }
    const built = Object.fromEntries(LANGS.map((c) => [c, fs.readFileSync(path.join(tmp, 'lang', c + '.js'), 'utf8')]));
    const after = srcs();
    ok('...the new lines are in lang/src and in the built lang/<code>.js, in each language', LANGS.every((c) => after[c].includes(c === 'zh' ? '11月6–8日' : c === 'es' ? '6–8 nov' : c === 'hi' ? '6–8 नवंबर' : '6–8 thg 11') && built[c].includes(c === 'zh' ? '11月6–8日' : c === 'es' ? '6–8 nov' : c === 'hi' ? '6–8 नवंबर' : '6–8 thg 11')), '');
    ok('...the old lines are still there, unchanged', LANGS.every((c) => { const o = JSON.parse(before[c]).ui, n = JSON.parse(after[c]).ui; return Object.keys(o).every((k) => n[k] === o[k]); }), '');
    const s2 = step();
    ok('...running it again changes nothing', s2.every((x) => x.status === 0) && LANGS.every((c) => srcs()[c] === after[c]), '');

    // a line a person wrote is never replaced
    const es = JSON.parse(after.es);
    const key = Object.keys(es.ui).find((k) => es.ui[k] === '6–8 nov');
    es.ui[key] = '6 al 8 de noviembre';
    fs.writeFileSync(path.join(tmp, 'lang', 'src', 'es.json'), JSON.stringify(es, null, 1) + '\n');
    step();
    ok('a line already in lang/src (written or corrected by a person) is not replaced', JSON.parse(srcs().es).ui[key] === '6 al 8 de noviembre', JSON.parse(srcs().es).ui[key]);

    // shapes the tool does not know are still missing, and say why
    const odd = edited.replace('<td>Nov 6&ndash;8</td>', '<td>Nov 6-8</td>').replace('pizza reservations for Oct 9 &amp; 10.', 'pizza reservations for Oct 9 &amp; 10, rain or shine.');
    fs.writeFileSync(idx, odd);
    step();
    const m = miss('es');
    ok('a hyphen instead of the long dash, or an added phrase in the "Open now" line, is listed as missing (as before)', /2 missing/.test(m) && /Nov 6-8/.test(m) && /rain or shine/.test(m), m.split('\n').slice(0, 1).join(''));
    ok('...and the list says why the tool did not translate them', /not translated by the tool: It looks like a date/.test(m) && /not translated by the tool: The dates "Oct 9 &amp; 10, rain or shine"/.test(m), m.split('\n').filter((l) => /not translated/.test(l)).join(' | ').slice(0, 200));
    const bad = py(tmp, 'tools/date_phrases.py', 'Oct 32');
    ok('python3 tools/date_phrases.py "Oct 32" says there is no such day', bad.status === 1 && /there is no Oct 32/.test(bad.stdout), bad.stdout.trim());
  }
  const sample = py(ROOT, 'tools/date_phrases.py', '--sample');
  ok('python3 tools/date_phrases.py --sample lists the lines for a native speaker (14 English lines, 4 languages each)', sample.status === 0 && (sample.stdout.match(/^ {3}(es|hi|zh|vi) {2}\S/gm) || []).length === 56, String((sample.stdout.match(/^ {3}(es|hi|zh|vi) {2}\S/gm) || []).length));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
await finish({});
