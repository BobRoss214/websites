// order: 62
// browser: no
// covers: lang/src/*, lang/en.json, lang/js-strings.json, tools/i18n_facts.mjs, tools/i18n_facts_allow.json
/* The facts in the translations (no browser, about 5 seconds): every translated text (lang/src/{es,hi,zh,vi}.json: page text, aria labels, picture descriptions, titles,
 * and the texts written by JavaScript) says the same prices, numbers, clock times, dates, months, days of the week, ages, group sizes, names, e-mail addresses and phone
 * numbers as its English, and keeps the small words that carry a promise (free, only, always, never, no / not, about, usually, the seasons, the holidays).
 * A wrong number, day or price in one language is the worst translation mistake, and nobody who reads that language has to be there to catch it.
 * Written-out numbers, the 12 and 24 hour clocks, Devanagari digits, ranges ("Friday through Sunday" = "viernes a domingo" = "周五至周日") and the local way of writing
 * a date are all read before the comparison; what is read, and how, is in tools/i18n_facts.mjs (run it to see every difference, with the English next to it).
 * A difference that is meant goes on tools/i18n_facts_allow.json with its reason; an entry that no longer matches anything fails the test (so the list cannot rot).
 * The checker is tried first on wrong translations made here (a changed price, weekday, am / pm, month, age limit, name, e-mail ...), and on a temporary copy of the real
 * lang files with one number, one weekday, one price and one time changed, so it cannot go blind without a failure. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT, ok as record, finish } from './lib.mjs';
import { LANGS, load, loadAllow, audit, compare, read } from '../tools/i18n_facts.mjs';

const ok = (name, condition, detail = '') => record(name, condition, condition ? '' : detail);   // the reason is shown only when the check fails
const T0 = Date.now();
const items = load(), allow = loadAllow();
const fileOf = (l) => `lang/src/${l}.json`;
const KINDS = ['price', 'percent', 'contact', 'date', 'month', 'early/mid/late', 'days', 'time', 'numbers', 'units', 'bound', 'words', 'name'];

/* ------------------------------------------------------------------ what was read */
{
  const missing = LANGS.flatMap((l) => items.filter((it) => typeof it.tr[l] !== 'string').map((it) => `${l} ${it.id.slice(0, 30)}`));
  ok(`all ${items.length} English texts (page text, labels, picture descriptions, texts written by JavaScript) have a translation in ${LANGS.join(', ')}`, items.length > 1200 && missing.length === 0,
    missing.length ? 'no translation for: ' + missing.slice(0, 4).join(', ') + ' (run  python3 tools/i18n.py missing es  to see the list)' : 'only ' + items.length + ' texts were read from lang/en.json and lang/src/*.json');
  // what visitors get (lang/xx.js) is what the lang/src files say, so a fix is not forgotten without  python3 tools/i18n.py build
  const stale = [];
  for (const l of LANGS) {
    const sb = {}; sb.window = sb; vm.runInNewContext(fs.readFileSync(path.join(ROOT, `lang/${l}.js`), 'utf8'), sb);
    const built = sb.WISE_ACRES.dict[l], src = JSON.parse(fs.readFileSync(path.join(ROOT, fileOf(l)), 'utf8'));
    for (const part of ['ui', 'js']) { const a = built[part] || {}, b = src[part] || {}; const bad = Object.keys(b).filter((k) => a[k] !== b[k]).length + Object.keys(a).filter((k) => !(k in b)).length; if (bad) stale.push(`${l} ${part}: ${bad}`); }
  }
  ok('the built files lang/es.js, hi.js, zh.js, vi.js say what lang/src/*.json say', stale.length === 0, 'out of date: ' + stale.join(', ') + '. Run  python3 tools/i18n.py build');
}

/* ------------------------------------------------------------------ the audit */
const { flags, stale, checked } = audit({ items, allow });
const open = flags.filter((x) => !x.allowed), allowed = flags.filter((x) => x.allowed);
for (const l of LANGS) {
  const mine = open.filter((x) => x.lang === l);
  ok(`${l}: every translated text has the English prices, numbers, times, dates, days, ages, names and promise words (${checked} read)`, mine.length === 0,
    mine.length ? `${mine.length} difference(s) in ${fileOf(l)}. First: ` + mine.slice(0, 3).map((x) => `[${x.kind}] ${x.id.startsWith('js:') ? 'the JS text "' + x.id.slice(3, 40) + '"' : x.id} "${x.en.slice(0, 50)}" -> "${x.tr.slice(0, 60)}": ${x.msg}`).join('  |  ')
      + `  |  What to do: open ${fileOf(l)}, search for the id or the words, make the fact the same as the English, then run  python3 tools/i18n.py build.  If the difference is meant, add it to tools/i18n_facts_allow.json with the reason.  To see all: node tools/i18n_facts.mjs --lang ${l}` : '');
}
ok('every entry of tools/i18n_facts_allow.json still matches a difference (nothing stale), and has a language, a kind and a reason', stale.length === 0 && allow.every((a) => ['*', ...LANGS].includes(a.lang) && KINDS.includes(a.kind) && typeof a.reason === 'string' && a.reason.length >= 25),
  stale.length ? 'no longer needed: ' + stale.slice(0, 3).map((a) => `${a.lang} ${a.id.slice(0, 30)} [${a.kind}]`).join('; ') + '. Delete these lines from tools/i18n_facts_allow.json' : 'an entry has a wrong language or kind, or a reason shorter than 25 letters');

// the reader must not be blind: the same kinds of facts are found in every language as in the English (a language where the numbers, times or days are not read would pass everything)
{
  const seen = {}, count = (l, k, test) => { seen[l] ??= {}; seen[l][k] = (seen[l][k] || 0); };
  const kinds = { price: (f) => f.money.length, time: (f) => f.time.length, date: (f) => f.date.length, days: (f) => f.days.length, month: (f) => f.month.length, 'early/mid/late': (f) => f.qual.length, numbers: (f) => f.numbers.length, bound: (f) => f.bound.length, contact: (f) => f.contact.length };
  const tot = {};
  for (const it of items) for (const l of ['en', ...LANGS]) { const f = read(l === 'en' ? it.en : it.tr[l], l); for (const [k, fn] of Object.entries(kinds)) if (fn(f)) { tot[l] ??= {}; tot[l][k] = (tot[l][k] || 0) + 1; } }
  const min = { price: 25, time: 15, date: 8, days: 30, month: 50, 'early/mid/late': 25, numbers: 80, bound: 15, contact: 40 };
  const lacking = [];
  for (const [k, n] of Object.entries(min)) { if ((tot.en[k] || 0) < n) lacking.push(`English ${k}: ${tot.en[k] || 0}`); for (const l of LANGS) if ((tot[l]?.[k] || 0) < 0.9 * (tot.en[k] || 0)) lacking.push(`${l} ${k}: ${tot[l]?.[k] || 0} of ${tot.en[k]}`); }
  ok('the reader finds the facts in every language (prices, times, dates, days, months, early / mid / late, numbers, ages, e-mail and phone) as often as in the English', lacking.length === 0,
    'a language is read worse than the English, or the English has far fewer facts than expected: ' + lacking.slice(0, 4).join('; ') + '. This is a problem in tools/i18n_facts.mjs, not in the site: tell the developer');
}

/* ------------------------------------------------------------------ the checker sees a wrong fact (and accepts the same fact written another way) */
{
  // [English, translation] pairs. WRONG ones must be flagged with the kind named; RIGHT ones must pass.
  const WRONG = {
    es: [['price', '$3 per person', '$4 por persona'], ['price', '$3 per person', '$3 por niño'], ['days', 'Friday through Sunday, 4 to 8 pm', 'De jueves a domingo, de 4 a 8 p. m.'], ['days', 'Thursday–Sunday', 'viernes a domingo'], ['time', '10 am – 4 pm', '10 a. m. – 4 a. m.'],
      ['time', '4 to 8 pm', 'de 5 a 8 p. m.'], ['time', 'Open every Tuesday at 5:00 PM', 'Abre los martes a las 6:00 p. m.'], ['date', 'Oct 6', '6 de nov'], ['numbers', 'One family, up to 6 people', 'Una familia, hasta 7 personas'], ['units', 'Takes 45 minutes', 'Dura 45 horas'],
      ['bound', 'Ages 3 and up', 'Hasta 3 años'], ['early/mid/late', 'late April through early May', 'de principios de abril a principios de mayo'], ['words', 'Children age 2 and younger are free', 'Los niños de 2 años o menos pagan'],
      ['name', 'Wise Pie pizza at The GreenHouse', 'Pizza Wise Pi en The GreenHouse'], ['contact', 'Email vanessa@wiseacresorganic.com', 'Escribe a vanesa@wiseacresorganic.com'], ['contact', 'Call 704-207-6347', 'Llama al 704-207-6348'],
      ['percent', 'a 3% fee', 'una comisión del 5 %'], ['words', 'No reservation needed', 'Se necesita reserva'], ['words', 'Open by reservation only', 'Abierto con reserva'], ['words', 'Usually mid-April', 'Mediados de abril'], ['month', 'April–July', 'abril a agosto']],
    hi: [['price', '$3 per person', 'प्रति व्यक्ति $4'], ['days', 'Friday through Sunday', 'शनिवार से रविवार'], ['time', '10 am – 4 pm', 'सुबह 10 बजे – सुबह 4 बजे'], ['numbers', 'up to 6 people', 'अधिकतम 7 लोग'], ['date', 'Oct 6', '6 नवंबर'],
      ['bound', 'Ages 3 and up', '3 साल और उससे छोटे'], ['early/mid/late', 'mid-April', 'अप्रैल के अंत'], ['words', 'No reservation needed', 'रिज़र्वेशन की ज़रूरत है'], ['units', 'Takes 45 minutes', '45 घंटे लगते हैं']],
    zh: [['price', '$3 per person', '每人 $4'], ['days', 'Friday through Sunday', '周四至周日'], ['time', '10 am – 4 pm', '上午 10 点至上午 4 点'], ['date', 'Oct 6', '10 月 7 日'], ['bound', 'Ages 3 and up', '3 岁及以下'], ['early/mid/late', 'late April', '4 月上旬'],
      ['numbers', 'up to 6 people', '最多 7 人'], ['words', 'No reservation needed', '需要预约'], ['units', 'Takes 45 minutes', '需要 45 小时']],
    vi: [['price', '$3 per person', '$4 mỗi người'], ['days', 'Friday through Sunday', 'Thứ Năm đến Chủ Nhật'], ['time', '10 am – 4 pm', '10 giờ sáng – 4 giờ sáng'], ['date', 'Oct 6', '6 thg 11'], ['bound', 'Ages 3 and up', '3 tuổi trở xuống'],
      ['early/mid/late', 'late April', 'đầu tháng 4'], ['numbers', 'up to 6 people', 'tối đa 7 người'], ['words', 'No reservation needed', 'Cần đặt chỗ'], ['units', 'Takes 45 minutes', 'Mất 45 giờ']],
  };
  const RIGHT = {
    es: [['$3 per person, ages 3 and up', '$3 por persona, a partir de los 3 años'], ['Open every Tuesday at 5:00 PM', 'Abre los martes a las 17:00'], ['Open every Tuesday at 5:00 PM', 'Abre todos los martes a las 5:00 p. m.'], ['Friday through Sunday, 4 to 8 pm', 'De viernes a domingo, de 4 a 8 p. m.'],
      ['Fri, Sat & Sun', 'Viernes, sábado y domingo'], ['Thursday–Sunday', 'jueves a domingo'], ['Oct 23–25', '23–25 oct'], ['Tuesday, Nov 3, 9 am–1 pm', 'martes 3 de nov, 9 a. m.–1 p. m.'], ['Usually mid-April through early June', 'Normalmente de mediados de abril a principios de junio'],
      ['Ages 12 and under only.', 'Solo para niños de 12 años o menos.'], ['Pizza from 10 to 4', 'Pizza de 10 a 4'], ['Real pizza, 1,500 miles', 'Pizza de verdad, 1.500 millas']],
    hi: [['$3 per person, ages 3 and up', 'प्रति व्यक्ति $3, 3 साल और उससे बड़े'], ['Open every Tuesday at 5:00 PM', 'हर मंगलवार शाम 5:00 बजे खुलता है'], ['Friday through Sunday, 4 to 8 pm', 'शुक्रवार से रविवार, शाम 4 से रात 8 बजे'], ['Oct 6', '6 अक्टूबर'], ['10 am – 4 pm', 'सुबह 10 बजे – शाम 4 बजे'], ['Open 10 am', 'सुबह १० बजे खुलता है']],
    zh: [['$3 per person, ages 3 and up', '每人 $3，3 岁及以上'], ['Open every Tuesday at 5:00 PM', '每周二下午 5:00 开放'], ['Friday through Sunday, 4 to 8 pm', '周五至周日，下午 4 点至 8 点'], ['Oct 6', '10 月 6 日'], ['10 am – 4 pm', '上午 10 点至下午 4 点'], ['Tuesday, Nov 3, 9 am–1 pm', '11 月 3 日周二，上午 9 点至下午 1 点'], ['Six years of farming', '六年的种植经验']],
    vi: [['$3 per person, ages 3 and up', '$3 mỗi người (từ 3 tuổi trở lên)'], ['Open every Tuesday at 5:00 PM', 'Mở vào Thứ Ba lúc 5 giờ chiều hằng tuần'], ['Friday through Sunday, 4 to 8 pm', 'Thứ Sáu đến Chủ Nhật, 4 đến 8 giờ tối'], ['Oct 6', '6 thg 10'], ['10 am – 4 pm', '10 giờ sáng – 4 giờ chiều'], ['Tuesday, Nov 3', 'Thứ Ba, 3 thg 11']],
  };
  const blind = [], noisy = []; let nWrong = 0, nRight = 0;
  for (const l of LANGS) {
    for (const [kind, en, tr] of WRONG[l]) { nWrong++; if (!compare(en, tr, l).some((d) => d.kind === kind)) blind.push(`${l} [${kind}] "${tr}"`); }
    for (const [en, tr] of RIGHT[l]) { nRight++; const d = compare(en, tr, l); if (d.length) noisy.push(`${l} "${tr}" = ${d.map((x) => x.msg).join(', ')}`); }
  }
  ok(`the checker sees ${nWrong} wrong facts made on purpose (price, per-what, day, am / pm, hour, month, number, unit, age limit, early / mid / late, free, name, e-mail, phone, percent, no / not, only, usually) in es hi zh vi`, blind.length === 0, 'missed: ' + blind.slice(0, 4).join('; ') + '. This is a problem in tools/i18n_facts.mjs, not in the site: tell the developer');
  ok(`... and accepts ${nRight} right translations written another way (24-hour clock, ranges, abbreviations, local dates, written-out numbers, decimal points)`, noisy.length === 0, 'false alarm: ' + noisy.slice(0, 3).join('; ') + '. This is a problem in tools/i18n_facts.mjs, not in the site: tell the developer');
}

/* ------------------------------------------------------------------ a temporary copy of the real lang files, with facts changed in it */
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-facts-'));
  const copy = (rel) => { fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true }); fs.copyFileSync(path.join(ROOT, rel), path.join(tmp, rel)); };
  let report = '';
  try {
    for (const f of ['lang/en.json', 'tools/i18n_facts_allow.json', ...LANGS.map(fileOf)]) copy(f);
    const data = Object.fromEntries(LANGS.map((l) => [l, JSON.parse(fs.readFileSync(path.join(tmp, fileOf(l)), 'utf8'))]));
    const en = JSON.parse(fs.readFileSync(path.join(tmp, 'lang/en.json'), 'utf8'));
    const edits = [];   // {lang, id, kind}
    const change = (lang, kind, pick, mutate) => {
      for (const [id, e] of Object.entries(en)) { const t = data[lang].ui[id]; if (typeof t !== 'string' || !pick(e, t)) continue; const m = mutate(t); if (m && m !== t) { data[lang].ui[id] = m; edits.push({ lang, id, kind }); return true; } }
      return false;
    };
    // a number: a text whose only fact is one small number, in Spanish; the number goes up by one
    change('es', 'numbers', (e, t) => { const f = read(e, 'en'), g = read(t, 'es'); return f.numbers.length === 1 && +f.numbers[0] >= 2 && +f.numbers[0] <= 9 && !f.money.length && !f.time.length && !f.date.length && g.numbers.join() === f.numbers.join(); }, (t) => t.replace(/\b(\d)\b/, (m, d) => String(+d + 1)));
    // a weekday, in Vietnamese and in Chinese (Friday becomes Thursday)
    change('vi', 'days', (e, t) => /Thứ Sáu/.test(t), (t) => t.replace('Thứ Sáu', 'Thứ Năm'));
    change('zh', 'days', (e, t) => /周五/.test(t), (t) => t.replace('周五', '周四'));
    // a price, in Chinese ($3 becomes $4)
    change('zh', 'price', (e, t) => /\$3\b/.test(t) && /\$3\b/.test(e), (t) => t.replace(/\$3\b/, '$4'));
    // a time of day in Hindi (the evening becomes the morning) and in Spanish (p. m. becomes a. m.)
    change('hi', 'time', (e, t) => /शाम\s*\d/.test(t) && /\d\s?pm/i.test(e), (t) => t.replace(/शाम(\s*\d)/, 'सुबह$1'));
    change('es', 'time', (e, t) => /\d\s?p\. m\./.test(t) && /\d\s?pm/i.test(e), (t) => t.replace(/(\d\s?)p\. m\./, '$1a. m.'));
    for (const l of LANGS) fs.writeFileSync(path.join(tmp, fileOf(l)), JSON.stringify(data[l], null, 1) + '\n');
    const after = audit({ root: tmp });
    const found = edits.map((ed) => after.flags.some((x) => !x.allowed && x.lang === ed.lang && x.id === ed.id && x.kind === ed.kind));
    report = edits.map((ed, i) => `${ed.lang} ${ed.id} [${ed.kind}] ${found[i] ? 'seen' : 'MISSED'}`).join(', ');
    ok('on a temporary copy of the real lang files, one changed number, two changed weekdays, one changed price and two changed times (am / pm) are all found (6 changes made, the originals untouched)',
      edits.length === 6 && found.every(Boolean), edits.length < 6 ? 'only ' + edits.length + ' of 6 changes could be made (' + report + '): a text the changes were made on is no longer there; adjust the test' : 'not all seen: ' + report);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

console.log(`     ${allowed.length} difference(s) are on the allow list (tools/i18n_facts_allow.json); ${open.length} are open; ${Math.round((Date.now() - T0) / 100) / 10} s`);
await finish({});
