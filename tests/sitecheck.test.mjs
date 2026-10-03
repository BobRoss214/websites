/* The "Site check" box: mistakes the owner can make in js/content.js are loud (on the owner's own computer, or on the live site with ?check) and say
 * what to fix and where. A misspelled setting (noticeUntill), a wrong farmPoint (swapped numbers, no minus sign, text), a js/content.js that stops or is
 * missing (with its line number), a range of closure days ('2026-11-09..2026-11-15'), the box's two kinds of message (settings to fix, old lines
 * that hid themselves), and the "Opens Thu, Nov 12" label when the next opening is more than a week away, in all five languages.
 * Visitors never see any of it. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { run, open, ok, okSoon, until, info, ROOT, ms } from './lib.mjs';

const CONTENT = fs.readFileSync(path.join(ROOT, 'js/content.js'), 'utf8');
const lineOf = (text, needle) => text.slice(0, text.indexOf(needle)).split('\n').length;   // the line a piece of text is on (1 = first)
const box = (p) => p.evaluate(() => { const b = document.getElementById('wa-problems'); return b ? b.textContent.replace(/\s+/g, ' ') : ''; });
// what the box is made of: its title, the settings to fix, the old lines, its colour and its role
const parts = (p) => p.evaluate(() => {
  const b = document.getElementById('wa-problems'); if (!b) return null;
  const li = (ul) => Array.from(ul.querySelectorAll('li')).map((x) => x.textContent);
  const lists = Array.from(b.children).filter((e) => e.tagName === 'UL'), old = Array.from(b.children).find((e) => e.tagName === 'DIV');
  return { title: b.firstElementChild.textContent, role: b.getAttribute('role'), bg: b.style.backgroundColor, broken: lists.flatMap(li), old: old ? li(old) : [], oldHeading: old ? old.firstElementChild.textContent : '' };
});

await run('sitecheck', async ({ browser, base, errs }) => {
  const at = (extra, o = {}) => open(browser, base, 'index.html', errs, { extra, ...o });
  const done = (p) => p.context().close();

  // ---- the unchanged site: the box is not there (every real setting name is known)
  let p = await at('');
  ok('the unchanged site: no Site check box (no real setting is called unknown)', (await box(p)) === '', await box(p));
  await done(p);
  p = await at(`WISE_ACRES.noticeUntil = '2026-10-05'; WISE_ACRES.hours.farm.winter = [5, 6]; WISE_ACRES.community = [];
    WISE_ACRES.week = { updated: '2026-10-01', expireDays: 14, note: 'Tomatoes!', crops: { tomatoes: 'peak' }, days: [{ date: '2026-10-02', farm: 'open', pizza: 'open', note: 'x' }], waitlistEmail: 'cathy@wiseacresorganic.com', feed: '' };
    WISE_ACRES.signup = { action: '', interests: {}, tags: '', languageField: '' };
    WISE_ACRES.reviews = [{ quote: 'Lovely', name: 'A. B.', source: 'Google', url: 'https://example.com/r', date: 'May 2026', lang: 'es' }];
    WISE_ACRES.community = [{ src: 'assets/photos/family-sunflower-field.webp', alt: 'A family', by: '@x', url: 'https://example.com' }];`);
  ok('every documented setting, written correctly, gives no warning', (await box(p)) === '', await box(p));
  await done(p);

  // ---- a misspelled setting is named, and the real one suggested
  p = await at(`WISE_ACRES.noticeUntill = '2026-10-05'; WISE_ACRES.closure = []; WISE_ACRES.zzzzzz = 1; WISE_ACRES.hours.greenhouse.opens = '09:00';
    WISE_ACRES.week = { updatd: '2026-10-01' }; WISE_ACRES.signup.actoin = 'x'; WISE_ACRES.photos[0].captoin = 'x'; WISE_ACRES.hours.farm.fal = [4]; WISE_ACRES.reviewurl = 'https://example.com';`);
  let b = (await parts(p)) || { broken: [], title: '' }; const msg = (rx) => b.broken.find((m) => rx.test(m)) || '';
  ok('noticeUntill: named, with the file and the right spelling', /^js\/content\.js: "noticeUntill" is not a setting the site knows, so it does nothing\. Did you mean "noticeUntil"\?/.test(msg(/noticeUntill/)), msg(/noticeUntill/) || JSON.stringify(b.broken));
  ok('closure: "Did you mean closures"', /"closure".*Did you mean "closures"/.test(msg(/"closure"/)), msg(/"closure"/));
  ok('reviewurl (capital letters wrong): "Did you mean reviewUrl"', /"reviewurl".*Did you mean "reviewUrl"/.test(msg(/"reviewurl"/)), msg(/"reviewurl"/));
  ok('a name that is near nothing: no guess, the names you can use are listed', /"zzzzzz".*The names you can use here: seasonPicker, reviews, analytics, notice, noticeUntil, closures/.test(msg(/"zzzzzz"/)) && !/Did you mean/.test(msg(/"zzzzzz"/)), msg(/"zzzzzz"/));
  ok('inside hours.greenhouse: "opens" -> "open"', /^hours\.greenhouse: "opens".*Did you mean "open"\?/.test(msg(/"opens"/)), msg(/"opens"/));
  ok('inside hours.farm: "fal" -> "fall"', /^hours\.farm: "fal".*"fall"/.test(msg(/"fal"/)), msg(/"fal"/));
  ok('inside week: "updatd" -> "updated"', /^week: "updatd".*"updated"/.test(msg(/"updatd"/)), msg(/"updatd"/));
  ok('inside signup: "actoin" -> "action"', /^signup: "actoin".*"action"/.test(msg(/"actoin"/)), msg(/"actoin"/));
  ok('inside a photo: "captoin" -> "caption", with the number of the photo', /^photos number 1: "captoin".*"caption"/.test(msg(/"captoin"/)), msg(/"captoin"/));
  ok('the title counts the settings to fix and the box is yellow with role=alert', /^Site check: \d+ things to fix$/.test(b.title) && b.role === 'alert' && /255, 243, 176/.test(b.bg), b.title + ' ' + b.role + ' ' + b.bg);
  await done(p);

  // ---- farmPoint
  const spot = async (value) => {
    const q = await at('WISE_ACRES.farmPoint = ' + value + ';');
    const r = await q.evaluate(() => { const f = WISE_ACRES.features.readFarmPoint(); return { point: f.point, problems: f.problems }; });
    const text = await box(q); await done(q);
    return { ...r, text };
  };
  let r = await spot('{ lat: 35.05, lon: -80.6 }');
  ok('farmPoint with two good numbers: used, no warning', r.point && r.point.lat === 35.05 && r.point.lon === -80.6 && !/farmPoint/.test(r.text), JSON.stringify(r));
  r = await spot('{ lat: -80.6, lon: 35.05 }');
  ok('farmPoint swapped: not used, and the box says the numbers look swapped and which goes first', r.point === null && /farmPoint: lat and lon look swapped\. The first number \(lat\) is about 35 here, the second \(lon\) about -80\. Swap them\./.test(r.text), r.text.slice(0, 400));
  r = await spot('{ lat: 35.05, lon: 80.6 }');
  ok('farmPoint without the minus sign: not used, the box says to put it in', r.point === null && /farmPoint\.lon is 80\.6 and needs a minus sign: -80\.6/.test(r.text), r.text.slice(0, 400));
  r = await spot('{ lat: -35.05, lon: -80.6 }');
  ok('farmPoint with a minus sign too many on lat: not used, the box says so', r.point === null && /farmPoint\.lat is -35\.05 and must not have a minus sign: 35\.05/.test(r.text), r.text.slice(0, 400));
  r = await spot('{ lat: 51.5, lon: -0.1 }');
  ok('farmPoint outside the United States: not used, the box gives the allowed ranges', r.point === null && /is not in the United States: lat must be between 24 and 50 and lon between -125 and -66/.test(r.text), r.text.slice(0, 400));
  r = await spot("{ lat: '35.05', lon: '-80.6' }");
  ok('farmPoint numbers in quote marks: still used, and the box says to take the quote marks off', r.point && r.point.lat === 35.05 && r.point.lon === -80.6 && /farmPoint\.lat "35\.05" is written as text\. It works, but take the quote marks off/.test(r.text) && /farmPoint\.lon "-80\.6" is written as text/.test(r.text), r.text.slice(0, 400));
  r = await spot("{ lat: '35.05N', lon: -80.6 }");
  ok('farmPoint with a letter in a number: not used, the box shows what is allowed', r.point === null && /farmPoint\.lat "35\.05N" is not a number\. Use only digits, a dot and a minus sign, like lat: 35\.0\. It is not used/.test(r.text), r.text.slice(0, 400));
  r = await spot('{ lat: 35.05 }');
  ok('farmPoint with one number missing: the box says which', r.point === null && /farmPoint needs both numbers; lon is missing/.test(r.text), r.text.slice(0, 400));
  r = await spot('[35.05, -80.6]');
  ok('farmPoint written as a list: the box shows the right shape', r.point === null && /farmPoint must look like \{ lat: 35\.0, lon: -80\.6 \}/.test(r.text), r.text.slice(0, 400));
  r = await spot('null');
  ok('farmPoint null (not set): nothing to say', r.point === null && r.text === '', r.text);

  // ---- js/content.js stops (a typo) or is missing: the box says where, in plain words; the visitors see nothing
  const broken = async (transform, o = {}) => {
    const junk = [];
    const q = await open(browser, base, 'index.html', junk, { routes: async (pg) => {
      await pg.route('**/js/content.js', (route) => (transform === null ? route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not found' }) : route.fulfill({ contentType: 'text/javascript', body: transform(CONTENT) })));
      if (o.noEarlyScript) await pg.route('**/index.html*', async (route) => { const res = await route.fetch(); route.fulfill({ response: res, body: (await res.text()).replace(/<script src="js\/guard\.js"><\/script>\n/, '') }); });
    } });
    await until(q, () => !!document.getElementById('wa-problems'), null, 8000);
    const res = { text: await box(q), parts: await parts(q), hours: await q.evaluate(() => !!(window.WISE_ACRES && window.WISE_ACRES.hours)), features: await q.evaluate(() => !!(window.WISE_ACRES && window.WISE_ACRES.features)) };
    await done(q); return res;
  };
  const stop = (text) => /js\/content\.js stopped at line (\d+): "([^"]*)"\. (.*)$/.exec(text) || [];
  let L = lineOf(CONTENT, "  closures: [],");
  r = await broken((c) => c.replace("  noticeUntil: '',\n", "  noticeUntil: ''\n"));
  let m = stop(r.text);
  ok('a missing comma: the box names js/content.js and the line the browser stopped at', +m[1] === L && /Unexpected identifier/.test(m[2]), r.text.slice(0, 300) + ' (the line after the missing comma is ' + L + ')');
  ok('...and says a comma is missing at the end of the line before, to look at that line and the one above it', /comma missing at the end of the line before/.test(r.text) && /Look at that line and the line above it/.test(r.text), r.text.slice(0, 500));
  ok('...says everything in the file is off and visitors see no message, and what to do next', /hours, closures, the notice bar, photos, reviews and the signup are all off and visitors see no message/.test(r.text) && /Fix it, save, refresh\./.test(r.text), r.text.slice(300, 800));
  ok('...the rest of the site still runs (the box itself is proof), the title counts one thing', r.features && !r.hours && /^Site check: 1 thing to fix/.test(r.text), r.text.slice(0, 80));
  L = lineOf(CONTENT, "  notice: '',");
  r = await broken((c) => c.replace("  notice: '',", '  notice: “Closed Saturday”,'));
  m = stop(r.text);
  ok('a curly quote mark: the line is named and the hint says curly quote marks', +m[1] === L && /curly quote mark/.test(r.text), r.text.slice(0, 400));
  r = await broken((c) => c.replace("  notice: '',", "  notice: 'We're closed Saturday',"));
  m = stop(r.text);
  ok('an apostrophe inside single quotes: the line is named and the box shows the double-quote fix', +m[1] === L && /write "We're open" with double quotes/.test(r.text), r.text.slice(0, 400));
  L = lineOf(CONTENT, "  closures: [],");
  r = await broken((c) => c.replace("  closures: [],", '  closures: [oops],'));
  m = stop(r.text);
  ok('a word without quote marks (a ReferenceError): the line is named and the hint says to put quote marks around text', +m[1] === L && /oops is not defined/.test(m[2]) && /no quote marks around it/.test(r.text), r.text.slice(0, 400));
  r = await broken((c) => c.replace(/\};\s*$/, ''));
  ok('the closing } at the end of the file deleted: the box says a bracket is missing, or one too many', /stopped at line \d+: "SyntaxError: Unexpected end of input"/.test(r.text) && /A bracket \} or \] is missing, or there is one too many\./.test(r.text), r.text.slice(0, 300));
  r = await broken((c) => c + '\nWISE_ACRES.hours.nothere.x = 1;\n');
  m = stop(r.text);
  ok('an error after the settings were read (at the end of the file): the line is the last one, and the box says the settings before it were read', +m[1] === CONTENT.split('\n').length + 1 && r.hours && /The settings before that line were read; the ones after it are off\./.test(r.text), r.text.slice(0, 500));
  r = await broken(null);
  ok('js/content.js missing (404): the box says the file could not be loaded, where it belongs', /js\/content\.js could not be loaded: the file is missing, was renamed, or is not in the js folder next to season\.js/.test(r.text), r.text.slice(0, 300));
  r = await broken((c) => c.replace("  noticeUntil: '',\n", "  noticeUntil: ''\n"), { noEarlyScript: true });
  ok('without the page\'s small error note (an older page): the box still says js/content.js did not run, with the F12 way to find the line', /js\/content\.js did not run/.test(r.text) && /Open the browser console \(F12\)/.test(r.text), r.text.slice(0, 300));

  // ---- visitors see nothing, with or without a broken file; the owner's two ways in
  const proxy = async (url, transform) => {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 }, timezoneId: 'America/New_York' });
    await ctx.route('http://farm.test/**', async (route) => {
      const req = route.request(), u = new URL(req.url());
      if (['image', 'font', 'media'].includes(req.resourceType())) { route.abort(); return; }
      try {
        const res = await route.fetch({ url: base + u.pathname.slice(1) + u.search });
        if (u.pathname === '/js/content.js') route.fulfill({ status: 200, contentType: 'text/javascript', body: transform((await res.text())) }); else route.fulfill({ response: res });
      } catch (e) { route.abort(); }
    });
    const pg = await ctx.newPage(); pg.on('pageerror', () => {});
    await pg.goto(url, { waitUntil: 'load', timeout: ms(60000) });
    await until(pg, () => !!(window.WISE_ACRES && window.WISE_ACRES.features), null, 20000);
    await pg.waitForTimeout(600);
    const out = { box: await box(pg), body: await pg.evaluate(() => document.body.innerText) };
    await ctx.close(); return out;
  };
  const bad = (c) => c.replace("  noticeUntil: '',\n", "  noticeUntil: ''\n");
  r = await proxy('http://farm.test/index.html', bad);
  ok('a visitor on the live site (no ?check): no box and no word about js/content.js, even though it is broken', r.box === '' && !/content\.js|Site check/.test(r.body), r.box.slice(0, 120));
  r = await proxy('http://farm.test/index.html?check', bad);
  ok('the owner on the live site with ?check: the box shows the error and its line, and says who else can see it', /stopped at line \d+/.test(r.box) && /web address has \?check in it/.test(r.box), r.box.slice(0, 300));
  r = await proxy('http://farm.test/index.html', (c) => c.replace("  closures: [],", "  closure: [],"));
  ok('a visitor does not see a misspelled setting either', r.box === '', r.box.slice(0, 120));

  // the page opened straight from the folder (file://): the box shows by itself, with the line
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-sitecheck-'));
  try {
    for (const name of fs.readdirSync(ROOT)) if (name !== 'js' && name !== 'tests' && name !== '.git' && name !== 'node_modules') fs.symlinkSync(path.join(ROOT, name), path.join(tmp, name));
    fs.mkdirSync(path.join(tmp, 'js'));
    for (const name of fs.readdirSync(path.join(ROOT, 'js'))) fs.symlinkSync(path.join(ROOT, 'js', name), path.join(tmp, 'js', name));
    fs.rmSync(path.join(tmp, 'js', 'content.js')); fs.writeFileSync(path.join(tmp, 'js', 'content.js'), bad(CONTENT));
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } }), pg = await ctx.newPage(); pg.on('pageerror', () => {});
    await pg.goto(pathToFileURL(path.join(tmp, 'index.html')).href, { waitUntil: 'load', timeout: ms(60000) });
    await until(pg, () => !!document.getElementById('wa-problems'), null, 20000);
    const t = await box(pg); await ctx.close();
    ok('opened from the folder (file://): the box shows by itself ("open on this computer"); the browser gives no line number there, so the box says so and sends the owner to the console (F12)', /js\/content\.js (did not run|stopped)/.test(t) && /open on this computer/.test(t) && (/stopped at line \d+/.test(t) || (/straight from a folder is not given the line number/.test(t) && /Open the browser console \(F12\)/.test(t))), t.slice(0, 500));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }

  // ---- the box has two kinds of message: settings to fix, and old lines that hid themselves (nothing is broken)
  p = await at('', { time: '2026-10-05T12:00:00-04:00' });
  b = await parts(p);
  ok('only old lines: the title says nothing is broken, the box is green and calm (role=status)', b && b.title === 'Site check: nothing is broken' && b.role === 'status' && /230, 244, 218/.test(b.bg) && b.broken.length === 0, JSON.stringify(b).slice(0, 300));
  ok('...the old lines have their own heading that says they are fine, and each says Hidden since', b && /^Old lines that hid themselves\. Nothing is broken: remove them when you like\.$/.test(b.oldHeading) && b.old.length === 1 && /^Hidden since 2026-10-05/.test(b.old[0]), JSON.stringify(b && b.old).slice(0, 200));
  await done(p);
  p = await at("WISE_ACRES.noticeUntill = 'x';", { time: '2026-10-05T12:00:00-04:00' });
  b = await parts(p);
  ok('a setting to fix and an old line together: the title counts only the thing to fix, the box is yellow, the two lists are apart', b && b.title === 'Site check: 1 thing to fix' && b.role === 'alert' && /255, 243, 176/.test(b.bg) && b.broken.length === 1 && /noticeUntill/.test(b.broken[0]) && b.old.length === 1 && /Hidden since/.test(b.old[0]) && !b.broken.some((x) => /Hidden since/.test(x)), JSON.stringify(b).slice(0, 400));
  await done(p);
  p = await at('', { time: '2026-10-05T12:00:00-04:00', lang: 'es' });
  b = await parts(p);
  ok('in Spanish the two headings are Spanish (the messages themselves stay English)', b && b.title === 'Revisión del sitio: nada está roto' && /^Líneas antiguas que se ocultaron solas/.test(b.oldHeading), b && b.title + ' | ' + b.oldHeading);
  await done(p);

  // ---- closures: a day, or a range of days with two dots
  p = await at('');
  const days = await p.evaluate(() => {
    const x = (list) => WISE_ACRES.live.expandClosures(list);
    return { week: x(['2026-11-09..2026-11-15']), year: x(['2026-12-30..2027-01-02']), one: x(['2026-11-09..2026-11-09']), spaces: x(['2026-11-09 .. 2026-11-11']), mixed: x(['2026-10-03', '2026-11-09..2026-11-10', '2026-12-25']), short: x(['2026-11-9..2026-11-10']) };
  });
  ok('a range of a week is seven days, both ends counted (Nov 9 to Nov 15)', days.week.days.length === 7 && days.week.days[0] === '2026-11-09' && days.week.days[6] === '2026-11-15' && days.week.problems.length === 0, JSON.stringify(days.week));
  ok('a range across the new year: Dec 30, 31, Jan 1, 2', days.year.days.join() === '2026-12-30,2026-12-31,2027-01-01,2027-01-02', days.year.days.join());
  ok('a range of one day, a range with spaces around the dots, a short day (11-9), and days mixed with ranges, are all read', days.one.days.join() === '2026-11-09' && days.spaces.days.join() === '2026-11-09,2026-11-10,2026-11-11' && days.short.days.join() === '2026-11-09,2026-11-10' && days.mixed.days.join() === '2026-10-03,2026-11-09,2026-11-10,2026-12-25', JSON.stringify([days.one.days, days.spaces.days, days.short.days, days.mixed.days]));
  await done(p);

  const labels = async (extra, date, lang) => {
    const q = await at(extra, { lang, time: date });
    const out = await q.evaluate((d) => ({ gh: WISE_ACRES.live.status('greenhouse', new Date(d)).text, farm: (WISE_ACRES.live.status('farm', new Date(d)) || {}).text, date: WISE_ACRES.features.fmtYmd('2026-11-15', { weekday: 'short', month: 'short', day: 'numeric' }), label: WISE_ACRES.live.dateLabel('2026-11-15'), box: (document.getElementById('wa-problems') || {}).textContent || '' }), date);
    await done(q); return out;
  };
  // Sunday Nov 8, 9 pm (the GreenHouse is open Fri-Sun, 10 am-8 pm): after closing time on a Sunday
  let l = await labels('', '2026-11-08T21:00:00-05:00');
  ok('no closures: Friday is 5 days away, written as a weekday', /^Closed now\. Opens Friday at 10 am$/.test(l.gh), l.gh);
  l = await labels("WISE_ACRES.closures = ['2026-11-13'];", '2026-11-08T21:00:00-05:00');
  ok('6 days away is still a weekday name ("Opens Saturday")', /^Closed now\. Opens Saturday at 10 am$/.test(l.gh), l.gh);
  l = await labels("WISE_ACRES.closures = ['2026-11-13..2026-11-14'];", '2026-11-08T21:00:00-05:00');
  ok('7 days away: the date is added, so "Sunday" is not mistaken for today ("Opens Sun, Nov 15")', /^Closed now\. Opens Sun, Nov 15 at 10 am$/.test(l.gh), l.gh);
  l = await labels("WISE_ACRES.closures = ['2026-11-20..2026-11-22'];", '2026-11-20T12:00:00-05:00');
  ok('a closed week-end, written as a range: "Closed today. Opens Fri, Nov 27 at 10 am"', /^Closed today\. Opens Fri, Nov 27 at 10 am$/.test(l.gh), l.gh);
  l = await labels("WISE_ACRES.closures = ['2026-11-13..2026-11-15'];", '2026-11-10T12:00:00-05:00');
  ok('a week with every open day closed: the next opening is on the date ("Opens Fri, Nov 20")', /^Closed today\. Opens Fri, Nov 20 at 10 am$/.test(l.gh), l.gh);
  // the farm (fall: Thu-Sun by reservation); Monday Oct 12
  l = await labels('', '2026-10-12T12:00:00-04:00');
  ok('the farm, no closures: "Next reserved day: Thursday"', /Next reserved day: Thursday$/.test(l.farm || ''), l.farm);
  l = await labels("WISE_ACRES.closures = ['2026-10-15..2026-10-17'];", '2026-10-12T12:00:00-04:00');
  ok('the farm, closed Thu-Sat: "Next reserved day: Sunday" (6 days away)', /Next reserved day: Sunday$/.test(l.farm || ''), l.farm);
  l = await labels("WISE_ACRES.closures = ['2026-10-15..2026-10-18'];", '2026-10-12T12:00:00-04:00');
  ok('the farm, closed Thu-Sun: the next reserved day is 10 days away and is written as a date ("Thu, Oct 22"), not left blank', /Next reserved day: Thu, Oct 22$/.test(l.farm || ''), l.farm);

  // the same label in the five languages: the date is written like every other date on the page (fmtYmd in js/features.js)
  const seen = {};
  for (const lang of ['en', 'es', 'hi', 'zh', 'vi']) {
    l = await labels("WISE_ACRES.closures = ['2026-11-13..2026-11-14'];", '2026-11-08T21:00:00-05:00', lang === 'en' ? undefined : lang);
    seen[lang] = l.gh;
    ok(lang + ': the opening label carries the date written as the page writes dates (' + l.label + ')', l.label === l.date && l.gh.includes(l.label) && /\d/.test(l.label), l.gh + ' | ' + l.date + ' | ' + l.label);
  }
  ok('Spanish, Chinese, Vietnamese and Hindi write the date in their own words (no English month or weekday left)', !/Sun|Nov/.test(seen.es + seen.hi + seen.zh + seen.vi), JSON.stringify(seen));
  info(JSON.stringify(seen));

  // ---- mistakes in a range are named, and a wrong range closes nothing
  p = await at("WISE_ACRES.closures = ['2026-11-09..2026-13-15', '2026-11-15..2026-11-09', '2026-01-01..2027-12-31', '2026-11-09 to 2026-11-15', '2026-11-9..2026-11-10', '2026-11-20..2026-11-22'];", { time: '2026-11-13T12:00:00-05:00' });
  b = await parts(p);
  const has = (rx) => (b ? b.broken : []).find((x) => rx.test(x)) || '';
  ok('a range with a day that does not exist: the box names the range and the day', /closures "2026-11-09\.\.2026-13-15": "2026-13-15" is not a real day\. Write a range like '2026-11-09\.\.2026-11-15'/.test(has(/2026-13-15/)), has(/2026-13-15/));
  ok('a range written backwards: the box gives it the right way round', /ends before it starts\. Write the first day first: '2026-11-09\.\.2026-11-15'/.test(has(/ends before/)), has(/ends before/));
  ok('a range of more than 100 days: the box says it is ignored and to check the years', /more than 100 days long, so it is ignored/.test(has(/100 days/)), has(/100 days/));
  ok('"to" instead of two dots: the box shows the two-dot way', /looks like a range of days\. Write a range with two dots/.test(has(/looks like a range/)), has(/looks like a range/));
  ok('a short day inside a range (2026-11-9): read, and the box says how to write it', /was read as 2026-11-09/.test(has(/2026-11-9/)), has(/2026-11-9/));
  ok('a good range gives no warning', !b.broken.some((x) => /2026-11-20/.test(x)), JSON.stringify(b.broken));
  const st = await p.evaluate(() => WISE_ACRES.live.status('greenhouse', new Date('2026-11-13T12:00:00-05:00')).text);
  ok('the wrong ranges closed nothing: Friday Nov 13 at noon is still open', /^Open now, until 8 pm$/.test(st), st);
  await done(p);
  p = await at("WISE_ACRES.closures = '2026-11-09..2026-11-15';");
  b = await parts(p);
  ok('closures written as one text instead of a list: the box shows the list form with a range', b && /closures must be a list of dates: closures: \['2026-10-04', '2026-11-09\.\.2026-11-15'\]/.test(b.broken.join(' ')), b && b.broken.join(' ').slice(0, 200));
  await done(p);
});
