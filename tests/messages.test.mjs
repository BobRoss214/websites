/* What the farm (English-speaking staff) receives, and what lands in the visitor's own calendar, whichever language the page is in.
 *
 * The rule: whatever goes TO THE FARM is English (subject, labels, the day), and a visitor on a Spanish / Hindi / Chinese / Vietnamese page gets their own
 * words next to the English so they can follow it. Their own typing is never touched. Calendar files are for the visitor, so they stay in the visitor's
 * language; they must be valid files whatever the language (UTF-8, CRLF, lines of at most 75 bytes, escaping, time zone).
 * Covers: the waitlist email, the corporate-event email, every fixed mailto: link, the .ics file, the Google Calendar link, the Mailchimp signup
 * (email with a + sign, a non-Latin email, the optional language field). Mailchimp is pretended; nothing is sent anywhere. */
import fs from 'node:fs';
import { run, open, ok, okSoon, until, info } from './lib.mjs';

const LANGS = ['en', 'es', 'hi', 'zh', 'vi'];
const NAME = { en: 'English', es: 'Spanish', hi: 'Hindi', zh: 'Chinese', vi: 'Vietnamese' };
const WEEK = `WISE_ACRES.week = { updated: '2026-10-01', days: [ { date: '2026-10-03', farm: 'full', pizza: 'full' } ], waitlistEmail: 'cathy@wiseacresorganic.com' };`;
const ASCII = /^[\x21-\x7e]+$/;   // a link address with nothing in it that an email program could mangle: no space, no line break, no letter outside ASCII

/** Reads a mailto: link the way an email program does. */
function mail(href) {
  const m = /^mailto:([^?]*)\?(.*)$/.exec(href);
  if (!m) return null;
  const q = {}; m[2].split('&').forEach((kv) => { const i = kv.indexOf('='); q[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); });
  return { to: m[1], subject: q.subject, body: q.body, raw: href, lines: (q.body || '').split('\r\n') };
}

/** A strict reading of an iCalendar file (RFC 5545): returns the list of things that are wrong with it (empty = fine). */
function strictIcs(buf) {
  const bad = [];
  const dec = new TextDecoder('utf-8', { fatal: true });
  const text = (() => { try { return dec.decode(buf); } catch (e) { bad.push('not valid UTF-8'); return Buffer.from(buf).toString('latin1'); } })();
  if (/(^|[^\r])\n/.test(text) || /\r(?!\n)/.test(text)) bad.push('a line ends with a bare LF or CR (must be CRLF)');
  if (!text.endsWith('\r\n')) bad.push('does not end with a line break');
  const physical = text.split('\r\n'); physical.pop();
  physical.forEach((l, i) => {
    const bytes = Buffer.byteLength(l, 'utf8');
    if (bytes > 75) bad.push(`line ${i + 1} is ${bytes} bytes (limit 75): ${l.slice(0, 40)}`);
    try { dec.decode(Buffer.from(l, 'utf8')); } catch (e) { bad.push(`line ${i + 1} cuts a character in two`); }
    if (/[\x00-\x08\x0b-\x1f\x7f]/.test(l)) bad.push(`line ${i + 1} has a control character`);
  });
  if (physical[0] && /^[ \t]/.test(physical[0])) bad.push('starts with a folded line');
  const lines = []; physical.forEach((l) => { if (/^[ \t]/.test(l) && lines.length) lines[lines.length - 1] += l.slice(1); else lines.push(l); });
  const stack = []; const events = []; let ev = null; let inAlarm = false;
  const all = [];
  lines.forEach((l, i) => {
    const m = /^([A-Z0-9-]+)((?:;[A-Za-z0-9-]+=(?:"[^"]*"|[^;:",]*)(?:,(?:"[^"]*"|[^;:",]*))*)*):(.*)$/.exec(l);
    if (!m) { bad.push(`line ${i + 1} is not NAME:value  -> ${l.slice(0, 50)}`); return; }
    const [, name, params, value] = m;
    if (name === 'BEGIN') { stack.push(value); if (value === 'VEVENT') { ev = []; } if (value === 'VALARM') inAlarm = true; return; }
    if (name === 'END') { const top = stack.pop(); if (top !== value) bad.push(`END:${value} does not match BEGIN:${top}`); if (value === 'VEVENT') { events.push(ev); ev = null; } if (value === 'VALARM') inAlarm = false; return; }
    if (ev && !inAlarm) ev.push({ name, params: params.slice(1), value });
    if (['SUMMARY', 'DESCRIPTION'].includes(name)) {   // TEXT: , ; and \ must be escaped, and only \\ \; \, \n may follow a backslash
      if (/(^|[^\\])(\\\\)*[,;]/.test(value)) bad.push(`${name} has an unescaped , or ; -> ${value.slice(0, 50)}`);
      if (/\\(?![\\;,nN])/.test(value.replace(/\\\\/g, ''))) bad.push(`${name} has a bad backslash -> ${value.slice(0, 50)}`);
    }
    all.push({ name, params: params.slice(1), value });
  });
  if (stack.length) bad.push('BEGIN without END: ' + stack.join(','));
  if (!/^BEGIN:VCALENDAR/.test(lines[0] || '') || !/^END:VCALENDAR/.test(lines[lines.length - 1] || '')) bad.push('not wrapped in VCALENDAR');
  if (!all.some((x) => x.name === 'VERSION' && x.value === '2.0')) bad.push('no VERSION:2.0');
  if (!all.some((x) => x.name === 'PRODID')) bad.push('no PRODID');
  if (!all.some((x) => x.name === 'TZID' && x.value === 'America/New_York')) bad.push('no VTIMEZONE for America/New_York');
  const uids = new Set();
  events.forEach((e, n) => {
    const get = (k) => (e.find((x) => x.name === k || x.name + ';' + x.params === k) || {}).value;
    const start = e.find((x) => x.name === 'DTSTART'), end = e.find((x) => x.name === 'DTEND');
    if (!get('UID')) bad.push(`event ${n + 1}: no UID`); else if (uids.has(get('UID'))) bad.push(`event ${n + 1}: UID used twice`); else uids.add(get('UID'));
    if (!/^\d{8}T\d{6}Z$/.test(get('DTSTAMP') || '')) bad.push(`event ${n + 1}: DTSTAMP is not UTC (…Z)`);
    if (!start || !/^TZID=America\/New_York$/.test(start.params) || !/^\d{8}T\d{6}$/.test(start.value)) bad.push(`event ${n + 1}: DTSTART must be local time with TZID=America/New_York`);
    if (!end || !(end.value > start.value)) bad.push(`event ${n + 1}: DTEND is not after DTSTART`);
    if (!get('SUMMARY')) bad.push(`event ${n + 1}: no SUMMARY`);
  });
  return { bad, events: events.map((e) => Object.fromEntries(e.map((x) => [x.name, x.value]))), text: lines.join('\n') };
}

await run('messages', async ({ browser, base, errs }) => {
  // ---------------------------------------------------------------- 1. the waitlist email goes to the farm in English
  const own = {};   // what each language's link says, to compare later
  for (const lang of LANGS) {
    const p = await open(browser, base, 'index.html', errs, { lang, extra: WEEK });
    const link = '[data-week-days] a[data-track="Waitlist click"]';
    await until(p, (s) => !!document.querySelector(s), link, 20000);
    const href = await p.getAttribute(link, 'href');
    const m = mail(href);
    ok(`${lang}: the waitlist link is a mailto: to the farm`, !!m && m.to === 'cathy@wiseacresorganic.com', href.slice(0, 80));
    if (!m) { await p.context().close(); continue; }
    ok(`${lang}: the whole address is plain ASCII (non-Latin words are percent-encoded UTF-8, no raw spaces or line breaks)`, ASCII.test(href), href.slice(0, 120));
    ok(`${lang}: the subject is English, with the day in English`, m.subject === 'Waitlist: Saturday, Oct 3', JSON.stringify(m.subject));
    ok(`${lang}: the first line of the email is English`, m.lines[0] === 'Hi! Please add me to the waitlist for Saturday, Oct 3.', JSON.stringify(m.lines[0]));
    ok(`${lang}: line breaks are %0D%0A (never a bare %0A)`, /%0D%0A/.test(href) && !/(?<!%0D)%0A/.test(href) && !/%0D(?!%0A)/.test(href));
    const labels = ['My name', 'How many people', 'Visit with or without pizza'].map((l) => m.lines.find((x) => x.startsWith(l)));
    ok(`${lang}: the three labels are English and end with a colon for the visitor to type after`, labels.every((x) => x && /:$/.test(x)), JSON.stringify(labels));
    ok(`${lang}: nothing is filled in for the visitor (their own typing starts empty)`, labels.every((x) => /:$/.test(x)) && m.lines[m.lines.length - 1] === '');
    ok(`${lang}: not too long for an email program (under 2,000 characters)`, href.length < 2000, String(href.length));
    if (lang === 'en') {
      ok('en: the English email has no extra lines and no language line', m.lines.join('|') === 'Hi! Please add me to the waitlist for Saturday, Oct 3.||My name:|How many people:|Visit with or without pizza:|', m.lines.join('|'));
      ok('en: no note about the email being in English', await p.locator('[data-waitlist-note]').isHidden());
    } else {
      ok(`${lang}: the visitor's own greeting is under the English one`, m.lines[1] && m.lines[1] !== m.lines[0] && /[^\x00-\x7f]|^¡Hola/.test(m.lines[1]) && !/\{|\}/.test(m.lines[1]), JSON.stringify(m.lines[1]));
      ok(`${lang}: each label shows the visitor's own words in brackets: "My name (…):"`, labels.every((x) => /^[A-Za-z ]+ \(.+\):$/.test(x)), JSON.stringify(labels));
      const pl = m.lines.find((x) => x.startsWith('Preferred language'));
      ok(`${lang}: a "Preferred language" line names the language in English, so the farm can answer in it`, /^Preferred language \(.+\): /.test(pl || '') && (pl || '').endsWith(': ' + NAME[lang]), JSON.stringify(pl));
      const note = ((await p.textContent('[data-waitlist-note]')) || '').trim();
      ok(`${lang}: the page says the email is in English (a visible note, written in ${lang})`, await p.locator('[data-waitlist-note]').isVisible() && note.length > 40 && !/Nothing is sent until/.test(note), note.slice(0, 80));
      ok(`${lang}: the button text is in the visitor's language`, !/^Email us/.test(((await p.textContent(link)) || '').trim()));
      own[lang] = m;
    }
    // changing the language rebuilds the draft (English stays English, the visitor's words follow)
    if (lang === 'es') {
      await p.evaluate(() => WISE_ACRES.setLang('en'));
      await okSoon('es -> en: the draft becomes the plain English one', async () => mail(await p.getAttribute(link, 'href')).lines.length, (n) => n === 6);
      await p.evaluate(() => WISE_ACRES.setLang('zh'));
      await okSoon('en -> zh: the draft gets the Chinese words next to the English', async () => mail(await p.getAttribute(link, 'href')).lines.some((x) => /^My name \(.*姓名.*\):$/.test(x)), (v) => v === true);
    }
    await p.context().close();
  }

  {   // an address the owner typed with a + in it stays as typed (a + is not a space in the address part)
    const p = await open(browser, base, 'index.html', errs, { lang: 'zh', extra: WEEK.replace("'cathy@wiseacresorganic.com'", "'cathy+waitlist@wiseacresorganic.com'") });
    const link = '[data-week-days] a[data-track="Waitlist click"]';
    await until(p, (s) => !!document.querySelector(s), link, 20000);
    const href = await p.getAttribute(link, 'href');
    ok('a waitlist address with a + sign (cathy+waitlist@...) is kept as typed', href.startsWith('mailto:cathy+waitlist@wiseacresorganic.com?subject=Waitlist%3A%20Saturday%2C%20Oct%203&body='), href.slice(0, 100));
    await p.context().close();
  }

  // ---------------------------------------------------------------- 2. every mailto: link on the site has an English subject
  for (const [page, lang] of [['index.html', 'zh'], ['first-visit.html', 'es'], ['school-field-trips.html', 'hi'], ['index.html', 'vi']]) {
    const p = await open(browser, base, page, errs, { lang });
    const hrefs = await p.evaluate(() => Array.from(document.querySelectorAll('a[href^="mailto:"]')).map((a) => a.getAttribute('href')));
    const withSubject = hrefs.map(mail).filter(Boolean);
    ok(`${page} (${lang}): ${hrefs.length} mailto: links, every address is plain ASCII`, hrefs.length > 0 && hrefs.every((h) => ASCII.test(h)), hrefs.filter((h) => !ASCII.test(h)).join(' '));
    ok(`${page} (${lang}): every subject is English (ASCII letters only)`, withSubject.length > 0 && withSubject.every((x) => /^[ -~]+$/.test(x.subject)), withSubject.map((x) => x.subject).join(' | '));
    ok(`${page} (${lang}): every email goes to a wiseacresorganic.com address`, hrefs.every((h) => /^mailto:[a-z]+@wiseacresorganic\.com(\?|$)/.test(h)), hrefs.join(' '));
    await p.context().close();
  }

  // ---------------------------------------------------------------- 3. the corporate-event email (a form in the link)
  for (const lang of LANGS) {
    const p = await open(browser, base, 'index.html', errs, { lang });
    const raw = await p.evaluate(() => (Array.from(document.querySelectorAll('a[href^="mailto:"]')).find((a) => /body=/.test(a.getAttribute('href'))) || { getAttribute: () => '' }).getAttribute('href'));
    const m = mail(raw);
    ok(`${lang}: the corporate inquiry link is there, with an English subject`, !!m && m.subject === 'Corporate event inquiry', raw.slice(0, 100));
    if (!m) { await p.context().close(); continue; }
    ok(`${lang}: its address is plain ASCII and its line breaks are %0D%0A`, ASCII.test(raw) && /%0D%0A/.test(raw) && !/(?<!%0D)%0A/.test(raw) && !/%0D(?!%0A)/.test(raw), raw.slice(0, 160));
    const want = ['Company', 'Approximate group size', 'Preferred date'];
    ok(`${lang}: the three labels start with the English words`, want.every((w) => m.lines.some((l) => l.startsWith(w))), JSON.stringify(m.lines));
    if (lang === 'en') ok('en: labels are plain English', m.lines.join('|') === 'Company:|Approximate group size:|Preferred date:|', m.lines.join('|'));
    else ok(`${lang}: each label also shows the visitor's own words: "Company (…):"`, want.every((w) => m.lines.some((l) => new RegExp('^' + w + ' \\(.+\\):$').test(l))), JSON.stringify(m.lines));
    await p.context().close();
  }

  // ---------------------------------------------------------------- 4. calendar files (for the visitor: in the visitor's language, valid in every language)
  for (const lang of LANGS) {
    const p = await open(browser, base, 'index.html', errs, { lang });
    await p.locator('[data-rel-remind]').scrollIntoViewIfNeeded();
    await p.click('[data-rel-remind]');
    const google = await p.getAttribute('[data-rel-google]', 'href');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-rel-ics]')]);
    const buf = fs.readFileSync(await dl.path());
    const r = strictIcs(buf);
    ok(`${lang}: the .ics file is valid (UTF-8, CRLF, lines of at most 75 bytes, escaping, time zone)`, r.bad.length === 0, r.bad.slice(0, 3).join(' ; '));
    ok(`${lang}: 4 events, each opening at 5:00 PM New York time (a clock time with the time zone name, not a UTC guess)`, r.events.length === 4 && r.events.every((e) => /T170000$/.test(e.DTSTART || '')) && /DTSTART;TZID=America\/New_York:20261006T170000/.test(r.text), r.events.map((e) => e.DTSTART).join(' '));
    ok(`${lang}: the file is named in English`, dl.suggestedFilename() === 'wise-acres-pizza-reservations.ics', dl.suggestedFilename());
    ok(`${lang}: the title and description are in the visitor's language`, lang === 'en' ? /pizza reservations open/.test(r.events[0].SUMMARY) : !/^Wise Acres: pizza reservations open$/.test(r.events[0].SUMMARY) && /[^\x00-\x7f]|reservas/.test(r.events[0].DESCRIPTION), r.events[0].SUMMARY);
    ok(`${lang}: the description keeps the booking address whole`, /https:\/\/bookeo\.com\/wiseacres\?category=41576YNUUTJ173F2927356/.test(r.text.replace(/\\,/g, ',')), r.events[0].DESCRIPTION.slice(-70));
    // the Google Calendar link
    const g = new URL(google);
    ok(`${lang}: the Google Calendar link: right host, New York time zone, a weekly series of 4, opening 5 PM Eastern (21:00 UTC in October)`, g.host === 'calendar.google.com' && g.searchParams.get('ctz') === 'America/New_York' && g.searchParams.get('dates') === '20261006T210000Z/20261006T213000Z' && g.searchParams.get('recur') === 'RRULE:FREQ=WEEKLY;COUNT=4', google.slice(0, 160));
    ok(`${lang}: its title is the same as the file's, and its text keeps the booking address`, g.searchParams.get('text') === r.events[0].SUMMARY.replace(/\\,/g, ',').replace(/\\;/g, ';') && /bookeo\.com\/wiseacres/.test(g.searchParams.get('details')), g.searchParams.get('text'));
    ok(`${lang}: the link is plain ASCII and short enough for browsers (under 2,000 characters)`, ASCII.test(google) && google.length < 2000, String(google.length));
    await p.context().close();
  }
  // a reservation date after the clocks go back (Nov 1): still 5 PM New York time in the file, 22:00 UTC in the Google link
  {
    const routes = async (pg) => { await pg.route('**/index.html*', async (r) => { const res = await r.fetch(); const html = (await res.text()).replace('</tbody>\n              </table>\n            </div>\n          </div>\n          <p', '<tr data-release="2026-11-03" data-until="2026-11-08"><td>Nov 3</td><td>Nov 6–8</td></tr></tbody></table></div></div><p'); r.fulfill({ response: res, body: html }); }); };
    const p = await open(browser, base, 'index.html', errs, { time: '2026-10-28T09:00:00-04:00', routes });
    await p.locator('[data-rel-remind]').scrollIntoViewIfNeeded();
    const has = await p.evaluate(() => !!document.querySelector('tr[data-release="2026-11-03"]'));
    if (has) {
      await p.click('[data-rel-remind]');
      const g = new URL(await p.getAttribute('[data-rel-google]', 'href'));
      const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-rel-ics]')]);
      const r = strictIcs(fs.readFileSync(await dl.path()));
      ok('Nov 3 (after the clocks go back): the file says 5:00 PM New York time and is valid', r.bad.length === 0 && /DTSTART;TZID=America\/New_York:20261103T170000/.test(r.text), r.bad.join(' ; '));
      ok('Nov 3: the Google link says 22:00 UTC (= 5 PM EST)', g.searchParams.get('dates') === '20261103T220000Z/20261103T223000Z', g.searchParams.get('dates'));
    } else info('(the schedule table changed shape: the November check was skipped)');
    await p.context().close();
  }

  // ---------------------------------------------------------------- 5. the Mailchimp signup: what the farm gets with each signup
  const MC = (extra = '') => `WISE_ACRES.signup = { action: 'https://wiseacres.us21.list-manage.com/subscribe/post?u=U123&id=L456', interests: { pumpkins: 'group[1][2]', trees: 'group[1][8]' }, tags: '111'${extra} };`;
  async function signUp(lang, extra, email, o = {}) {
    const seen = [];
    const p = await open(browser, base, 'index.html', errs, { lang, extra: MC(extra), routes: async (pg) => { await pg.route('**/subscribe/post-json**', (r) => { const u = new URL(r.request().url()); seen.push({ u, raw: r.request().url() }); r.fulfill({ contentType: 'application/javascript', body: u.searchParams.get('c') + '({"result":"success","msg":"ok"});' }); }); } });
    await p.locator('#su-email').scrollIntoViewIfNeeded();
    const note = { shown: await p.locator('[data-signup-lang-note]').isVisible(), text: ((await p.textContent('[data-signup-lang-note]')) || '').trim() };
    await p.fill('#su-email', email); await p.check('input[value=pumpkins]');
    await p.click('[data-signup] button[type=submit]');
    await okSoon(`${lang}: the signup was sent`, async () => seen.length, (n) => n >= 1);
    const box = await p.evaluate(() => (document.getElementById('wa-problems') || {}).textContent || '');
    await p.context().close();
    return { s: seen[0], box, note };
  }
  for (const lang of LANGS) {
    const { s, note } = await signUp(lang, ", languageField: 'MMERGE7'", 'mom+farm@example.com');
    ok(`${lang}: the form tells the visitor that the language of the page goes along (a visible line, in ${lang})`, note.shown && note.text.length > 15 && (lang === 'en' ? /We note the language of this page/.test(note.text) : !/^We note/.test(note.text)), note.text.slice(0, 80));
    ok(`${lang}: the signup carries the visitor's language in English in the field the owner named (MMERGE7=${NAME[lang]})`, s && s.u.searchParams.get('MMERGE7') === NAME[lang], s && s.raw.slice(0, 200));
    ok(`${lang}: the email address arrives exactly as typed, the + sign included (sent as %2B, not read as a space)`, s && s.u.searchParams.get('EMAIL') === 'mom+farm@example.com' && /EMAIL=mom%2Bfarm%40example\.com/.test(s.raw), s && s.raw.slice(0, 200));
    ok(`${lang}: the ticked interest and the tag still go along`, s && s.u.searchParams.get('group[1][2]') === '2' && s.u.searchParams.get('tags') === '111');
  }
  {
    const { s, note } = await signUp('es', '', 'mamá@example.com');
    ok('without languageField the form does not mention the language (nothing about it is sent)', !note.shown);
    ok('without languageField nothing about the language is sent (no extra field, no "lang")', s && ![...s.u.searchParams.keys()].some((k) => /^(MMERGE|LANG|lang|mc_language)/.test(k)), s && [...s.u.searchParams.keys()].join(','));
    ok('an email with an accent is sent as UTF-8 and comes back whole', s && s.u.searchParams.get('EMAIL') === 'mamá@example.com' && ASCII.test(s.raw), s && s.raw.slice(0, 160));
  }
  {
    const { s } = await signUp('zh', ", languageField: 'MMERGE7'", '用户@例子.中国');
    ok('a Chinese email address is sent as UTF-8 and comes back whole', s && s.u.searchParams.get('EMAIL') === '用户@例子.中国' && ASCII.test(s.raw), s && s.raw.slice(0, 160));
  }
  {
    const { s, box } = await signUp('vi', ", languageField: 'bad name!'", 'mom@example.com');
    ok('a languageField that is not a Mailchimp field name is not sent, and the Site check box says so', s && ![...s.u.searchParams.keys()].some((k) => /bad/i.test(k)) && /languageField/.test(box), box.slice(0, 200));
  }
});
