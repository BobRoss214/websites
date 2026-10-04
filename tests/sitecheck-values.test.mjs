// order: 120
// browser: yes
// covers: js/content.js, js/guard.js, js/features.js, js/live.js, lang/*.js
/* The "Site check" box, part two: the VALUES in js/content.js. A wrong time ('8 pm' for '20:00'), a close that is not after the open, a day that is not a
 * number from 0 to 6, a notice that is empty or has no English words, a review without a quote or a name, an address that does not start with https://,
 * a photo without a file or a description. Each message names the exact setting and says what to type. And the translation check:
 * ?check&lang=es lists the texts of the page that have no Spanish yet (or says every text is translated). Visitors see none of it. */
import { run, open, ok, okSoon, until, ms, settled } from './lib.mjs';

const box = (p) => p.evaluate(() => { const b = document.getElementById('wa-problems'); return b ? b.textContent.replace(/\s+/g, ' ') : ''; });
const parts = (p) => p.evaluate(() => {
  const b = document.getElementById('wa-problems'); if (!b) return null;
  const li = (ul) => Array.from(ul.querySelectorAll('li')).map((x) => x.textContent);
  const lists = Array.from(b.children).filter((e) => e.tagName === 'UL'), divs = Array.from(b.children).filter((e) => e.tagName === 'DIV');
  return { title: b.firstElementChild.textContent, role: b.getAttribute('role'), bg: b.style.backgroundColor, broken: lists.flatMap(li), sections: divs.map((d) => ({ heading: d.firstElementChild.textContent, items: li(d), text: d.textContent.replace(/\s+/g, ' ') })) };
});

await run('sitecheck-values', async ({ browser, base, errs }) => {
  const at = (extra, o = {}) => open(browser, base, 'index.html', [], { extra, ...o });   // a wrong value may also stop a badge: those errors are not what is tested here
  const done = (p) => p.context().close();
  const check = async (extra, o) => { const p = await at(extra, o); const b = await parts(p); await done(p); return b || { broken: [], sections: [], title: '' }; };
  const find = (b, rx) => b.broken.find((m) => rx.test(m)) || '';

  // ---- the unchanged site, and values that are fine written another way
  let p = await at('');
  ok('the unchanged site: no box (every real value is accepted)', (await box(p)) === '', await box(p));
  await done(p);
  let b = await check("WISE_ACRES.hours.greenhouse.open = '9:30'; WISE_ACRES.hours.greenhouse.close = '24:00'; WISE_ACRES.hours.pizza.days = []; WISE_ACRES.hours.farm.winter = [5, 6, 0]; WISE_ACRES.notice = { en: 'Closed.', es: 'Cerrado.' }; WISE_ACRES.noticeUntil = '2026-10-05'; WISE_ACRES.reviews = [{ quote: 'Lovely', name: 'A.', source: 'Google', url: 'https://example.com/r', lang: 'es' }, { quote: 'Fine', name: 'B.' }];");
  ok("'9:30', '24:00' (midnight), an empty list of days, a notice per language, a review with or without a link: all accepted", b.broken.length === 0 && b.sections.length === 0, JSON.stringify(b).slice(0, 300));

  // ---- hours
  b = await check("WISE_ACRES.hours.greenhouse.close = '8 pm'; WISE_ACRES.hours.pizza.open = '4:30pm'; WISE_ACRES.hours.greenhouse.open = '10';");
  ok("a 12-hour time ('8 pm'): the box names the setting and says what to type ('20:00')", /^hours\.greenhouse\.close "8 pm" is not a time the site can read\. Use the 24-hour clock with a colon, in quote marks: close: '20:00'\./.test(find(b, /greenhouse\.close/)), find(b, /greenhouse\.close/) || JSON.stringify(b.broken));
  ok("'4:30pm' becomes '16:30', and '10' (no minutes) gets the general example", /hours\.pizza\.open "4:30pm".*open: '16:30'/.test(find(b, /pizza\.open/)) && /hours\.greenhouse\.open "10" is not a time the site can read\. Write the 24-hour clock with a colon, in quote marks, like '10:00' \(10 am\) or '16:00' \(4 pm\)\./.test(find(b, /greenhouse\.open "10"/)), find(b, /pizza\.open/) + ' | ' + find(b, /open "10"/));
  b = await check("WISE_ACRES.hours.greenhouse.close = '08:00';");
  ok("close before open ('08:00' after '10:00'): the box says close must be later, and suggests '20:00'", /hours\.greenhouse closes at 08:00 but opens at 10:00\. close must be later than open on the 24-hour clock \(8 pm is '20:00'\)\. Did you mean close: '20:00'\?/.test(find(b, /closes at/)), find(b, /closes at/));
  b = await check("WISE_ACRES.hours.pizza.close = '16:00';");
  ok('close equal to open: also named, no guess when there is none to make', /hours\.pizza closes at 16:00 but opens at 16:00/.test(find(b, /pizza closes/)) && !/Did you mean/.test(find(b, /pizza closes/)), find(b, /pizza closes/));
  b = await check("delete WISE_ACRES.hours.pizza.open; WISE_ACRES.hours.greenhouse.close = 20;");
  ok('open missing: the box says the badge cannot work and what to write; a number instead of a time is named', /hours\.pizza\.open is missing, so the "Open now" badge for it cannot work\. Write it in quote marks on the 24-hour clock, like open: '10:00' \(10 am\)\./.test(find(b, /pizza\.open is missing/)) && /hours\.greenhouse\.close "20" is not a time/.test(find(b, /greenhouse\.close "20"/)), find(b, /pizza\.open/) + ' | ' + find(b, /greenhouse\.close/));
  b = await check("WISE_ACRES.hours.greenhouse.days = ['Friday', '6', 7, 9, 2.5]; WISE_ACRES.hours.pizza.days = 5; WISE_ACRES.hours.farm.fall = [4, 'Sun'];");
  ok('days: a weekday name gets its number', /hours\.greenhouse\.days has "Friday", but days are numbers\. Write 5 \(0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday\)\./.test(find(b, /"Friday"/)), find(b, /"Friday"/));
  ok('...a number in quote marks (it never matches) is named', /hours\.greenhouse\.days has "6" in quote marks, so it never matches a day\. Write 6 without the quote marks\./.test(find(b, /"6"/)), find(b, /"6"/));
  ok('...7 is not Sunday, 9 and 2.5 are not days', /days has 7, but the days run from 0 to 6\. Sunday is 0, not 7/.test(find(b, /has 7/)) && /has "9", which is not a day number\. Use 0 to 6/.test(find(b, /"9"/)) && /has "2\.5", which is not a day number/.test(find(b, /"2\.5"/)), find(b, /has 7/) + ' | ' + find(b, /"9"/));
  ok('...days that are not a list, and a season of hours.farm: named with an example', /hours\.pizza\.days must be a list of day numbers in square brackets, like days: \[5, 6, 0\]/.test(find(b, /pizza\.days/)) && /hours\.farm\.fall has "Sun", but days are numbers\. Write 0/.test(find(b, /farm\.fall/)), find(b, /pizza\.days/) + ' | ' + find(b, /farm\.fall/));

  // ---- the notice
  b = await check("WISE_ACRES.notice = ''; WISE_ACRES.noticeUntil = '2026-10-20';");
  ok('noticeUntil set but notice empty: the box says no bar shows and what to write', /^noticeUntil is set \(2026-10-20\) but notice is empty, so no bar shows\. Write the words in notice: 'Closed Saturday for rain\.', or delete the noticeUntil line\./.test(find(b, /noticeUntil is set/)), find(b, /noticeUntil/) || JSON.stringify(b.broken));
  b = await check("WISE_ACRES.notice = '   ';");
  ok('a notice of only spaces: it would show an empty bar, and the box says how to hide it', /^notice is only spaces, so the bar would show with no words\. Use notice: '' \(two quote marks, nothing between\) to hide it\./.test(find(b, /only spaces/)), find(b, /notice/));
  b = await check("WISE_ACRES.notice = { es: 'Cerrado.', sp: 'x' };");
  ok('a notice per language without English, and a language the site does not have: both named', /notice has no English words \(en: '…'\), so visitors on the English page see no bar/.test(find(b, /no English/)) && /notice has "sp", which is not a language the site has\. Use en, es, hi, zh or vi\./.test(find(b, /"sp"/)), find(b, /notice/));
  b = await check('WISE_ACRES.notice = 5;');
  ok('a notice that is not words: the box shows the right form', /^notice must be words in quote marks, like notice: 'Closed Saturday for rain\.'/.test(find(b, /notice must be/)), find(b, /notice/));
  let q = await at("WISE_ACRES.notice = 'Closed Saturday for rain.'; WISE_ACRES.noticeUntil = '2026-10-03';", { time: '2026-10-05T12:00:00-04:00' });
  b = await parts(q);
  const oldPart = b && b.sections.find((s) => /Old lines/.test(s.heading));
  ok('a notice whose noticeUntil has passed: the calm kind (green, "old line"), hidden since, with how to remove it for good', b && b.role === 'status' && oldPart && oldPart.items.some((x) => /^The notice bar \("Closed Saturday for rain\."\) is hidden because noticeUntil 2026-10-03 has passed\. To remove it for good, write notice: '' and delete the noticeUntil line, or give it a new date\./.test(x)), JSON.stringify(b).slice(0, 400));
  ok('...and the bar itself is not on the page', await q.evaluate(() => !document.getElementById('site-notice')), 'bar shown');
  await done(q);

  // ---- reviews, photos, web addresses
  b = await check(`WISE_ACRES.reviews = [{ quote: 'Great', name: '' }, { quote: '', name: 'B. Smith' }, { source: 'Yelp' }, { quote: 'q', name: 'N', source: 'Google', url: 'http://example.com/post' }, { quote: 'q', name: 'N2', url: 'https://example.com/post' }, { quote: 'q', name: 'N3', lang: 'sp' }, { quote: 'ok', name: 'Fine', source: 'Google', url: 'https://example.com/r' }, 'text'];`);
  ok('a review with no name: skipped, and the box says what to add', /^reviews number 1 is skipped: it has no name\. Add name: "Sarah M\."\. A review needs a quote and a name\./.test(find(b, /number 1 /)), find(b, /number 1 /));
  ok('...no quote: skipped, with the reviewer named; neither: both examples', /^reviews number 2 \(B\. Smith\) is skipped: it has no quote\. Add quote: "the words the reviewer wrote"/.test(find(b, /number 2 /)) && /^reviews number 3 is skipped: it has no quote and no name\. Add both, like quote: "Best strawberries we have ever picked\.", name: "Sarah M\."/.test(find(b, /number 3 /)), find(b, /number 2 /) + ' | ' + find(b, /number 3 /));
  ok('...a link that is not https://: named with the reviewer; a link without a source (never shown): named', /^reviews number 4 \(N\): url "http:\/\/example\.com\/post" must start with https:\/\/ \(copy the whole address of the post from the address bar\)\./.test(find(b, /number 4 /)) && /^reviews number 5 \(N2\): url is set but source is empty, so the link is not shown\. Add source: "Google"/.test(find(b, /number 5 /)), find(b, /number 4 /) + ' | ' + find(b, /number 5 /));
  ok('...a language the site does not have; an entry that is not an object; and the good review gets no message', /^reviews number 6 \(N3\): lang "sp" is not a language the site has\. Use en, es, hi, zh or vi\./.test(find(b, /number 6 /)) && /^reviews number 8 must look like \{ quote: "…", name: "Sarah M\." \}\. It is skipped\./.test(find(b, /number 8 /)) && !find(b, /number 7 /), JSON.stringify(b.broken).slice(0, 500));
  b = await check("WISE_ACRES.reviews = 'Great place';");
  ok('reviews written as one text: the box shows the list form', /^reviews must be a list in square brackets: reviews: \[ \{ quote: "…", name: "Sarah M\." \} \]\./.test(find(b, /reviews must/)), find(b, /reviews/));
  b = await check("WISE_ACRES.photos.push({ caption: 'Nothing here' }); WISE_ACRES.photos.push({ src: 'assets/photos/x.webp', alt: '  ' }); WISE_ACRES.community = [{ src: 'assets/photos/family-sunflower-field.webp', alt: 'A family', by: '@x', url: 'http://example.com/me' }];");
  ok('a photo with neither file nor description: the box names its number and caption and says what is missing', /^photos number \d+ \(Nothing here\) has no src \(the picture file, in the folder assets\/photos\) and no alt \(a short description for people who cannot see the picture\)\./.test(find(b, /Nothing here/)), find(b, /Nothing here/) || JSON.stringify(b.broken));
  ok('...a blank alt is named too; a visitor-photo link that is not https:// is named', /^photos number \d+ has no alt \(a short description/.test(find(b, /^photos number \d+ has no alt/)) && /^community photo number 1: url "http:\/\/example\.com\/me" must start with https:\/\/, or the credit shows without a link\./.test(find(b, /community photo number 1: url/)), find(b, /has no alt/) + ' | ' + find(b, /community photo/));
  b = await check("WISE_ACRES.signup.action = 'http://wise.us21.list-manage.com/subscribe/post?u=0123456789abcdef01234567&id=89abcdef01'; WISE_ACRES.reviewUrl = 'http://g.page/r/abc/review';");
  ok('the signup address starting with http://: the box says to change only the first letters', /^signup\.action starts with http:\/\/, but it must start with https:\/\/ \(change only the first letters\)\./.test(find(b, /signup\.action/)), find(b, /signup/));
  ok('...and the review link starting with http:// is named too', /^reviewUrl "http:\/\/g\.page\/r\/abc\/review" must start with https:\/\//.test(find(b, /reviewUrl/)), find(b, /reviewUrl/));

  // ---- ?check&lang=es: the texts that have no translation yet
  const trans = async (opts = {}) => {
    const q2 = await at('', { lang: 'es', query: opts.query === undefined ? 'check' : opts.query, routes: opts.routes });
    if (opts.query !== '') {   // (no ?check: there is no box to wait for; open() has waited until the scripts started, so a box would be there now)
      await until(q2, () => !!document.getElementById('wa-problems'), null, 20000);
      await until(q2, () => { const b = document.getElementById('wa-problems'); if (!b) return true; const t = b.textContent; return !/\((?:Spanish|Hindi|Chinese|Vietnamese)\)/.test(t) || /code text:|The texts the code writes/.test(t); }, null, 20000);   // the box is filled in again when the list of code texts has been read
    }
    await settled(q2, 0);
    const r = await parts(q2); const html = await q2.evaluate(() => document.documentElement.lang); await done(q2);
    return { b: r, html };
  };
  let t = await trans();
  let sec = t.b && t.b.sections.find((s) => /Spanish/.test(s.heading));
  ok('?check&lang=es on the finished site: the box says every text is translated (in Spanish, with the language named)', t.html === 'es' && sec && /^Todos los textos de esta página están traducidos\. \(Spanish\)$/.test(sec.heading), JSON.stringify(t.b).slice(0, 300));
  ok('...and that the texts the code writes are translated too (it can read the list on this server)', sec && /The texts the code writes \(buttons, messages, countdown\) are all translated too\./.test(sec.text), sec && sec.text);
  ok('...the box is calm (green, role=status): nothing is broken', t.b && t.b.role === 'status' && /230, 244, 218/.test(t.b.bg) && t.b.title === 'Revisión del sitio: nada está roto', JSON.stringify(t.b).slice(0, 200));
  t = await trans({ routes: async (pg) => { await pg.route('**/lang/es.js', async (r) => { const res = await r.fetch(); r.fulfill({ response: res, body: (await res.text()) + "\ndelete WISE_ACRES.dict.es.ui['t37c5399a']; delete WISE_ACRES.dict.es.js['Hide this box'];" }); }); } });
  sec = t.b && t.b.sections.find((s) => /Spanish/.test(s.heading));
  ok('a Spanish text taken out: the heading says some texts are not translated yet (in Spanish) and the box lists the page text with its id and its English words', sec && /^Aún sin traducir: estos textos de esta página se muestran en inglés\. \(Spanish\)$/.test(sec.heading) && sec.items.some((x) => /^"4701 Hartis Road Indian Trail, NC 28079 .*" \(t37c5399a\)$/.test(x)), JSON.stringify(sec).slice(0, 400));
  ok('...and the text the code writes that has no Spanish ("Hide this box") is listed as a code text', sec && sec.items.includes('code text: "Hide this box"'), JSON.stringify(sec && sec.items).slice(0, 300));
  t = await trans({ routes: async (pg) => { await pg.route('**/lang/es.js', (r) => r.fulfill({ status: 404, contentType: 'text/plain', body: 'Not found' })); } });
  ok('?lang=es when lang/es.js did not load: the page is English, and the box says why and how to rebuild it', t.html === 'en' && t.b && t.b.broken.some((m) => /^\?lang=es asked for Spanish but the page is in English: lang\/es\.js did not load \(it must be in the lang folder next to the other languages; rebuild it with python3 tools\/i18n\.py build\)\./.test(m)), JSON.stringify(t.b).slice(0, 300));
  t = await trans({ query: '' });
  ok('?lang=es without ?check: no translation section, no box (the check is asked for with ?check)', t.b === null, JSON.stringify(t.b).slice(0, 200));
  p = await at('', { query: 'check' });
  ok('?check on the English page: no translation section, no box', (await box(p)) === '', await box(p));
  await done(p);

  // the live site (not this computer): the list of code texts is not asked for, and the box says so
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 }, timezoneId: 'America/New_York' });
  const failed = [];
  await ctx.route('http://farm.test/**', async (route) => {
    const req = route.request(), u = new URL(req.url());
    if (['image', 'font', 'media'].includes(req.resourceType())) { route.abort(); return; }
    if (/js-strings/.test(u.pathname)) failed.push(u.pathname);
    try { route.fulfill({ response: await route.fetch({ url: base + u.pathname.slice(1) + u.search }) }); } catch (e) { route.abort(); }
  });
  const live = await ctx.newPage(); live.on('pageerror', () => {});
  await live.goto('http://farm.test/index.html?check&lang=es', { waitUntil: 'load', timeout: ms(60000) });
  await until(live, () => !!document.getElementById('wa-problems'), null, 20000);   // on a live site the code texts are not read at all, so the box is final now
  await settled(live, 0);
  const lp = await parts(live);
  ok('on the live site with ?check&lang=es: the box lists the page texts check, and says the code texts are not checked here and how to see them', lp && lp.sections.some((s) => /Spanish/.test(s.heading) && /The texts the code writes \(buttons, messages, countdown\) are not checked here: the list is not on this site\. On your own computer run python3 tools\/i18n\.py missing es --list or open the site with python3 tools\/serve\.py\./.test(s.text)), JSON.stringify(lp).slice(0, 300));
  ok('...and it did not ask the live site for a file that is not there', failed.length === 0, failed.join(', '));
  await ctx.close();
});
