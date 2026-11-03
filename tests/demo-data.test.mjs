// order: 48
// browser: no
// quick: yes
// covers: js/demo-data.js, js/demo-pizza-data.js, js/demo-view-event.js, js/demo-view-pizza.js, js/demo-kitchen.js, index.html, pages/first-visit.html, pages/school-field-trips.html, assets/photos/wise-pie-fall-menu-2026.webp
/* The numbers of the account demo against the site's own pages (no browser, about a second). js/demo-data.js copies prices, ages, days and the Fall Menu from the
 * pages on purpose: the demo may show only what the site says. This test reads index.html, pages/first-visit.html and pages/school-field-trips.html and fails when a
 * number, a name or a sentence in the demo's data is not on the page any more (a price changed, a pizza was renamed, a package changed its days). When it fails
 * after a change on purpose, change js/demo-data.js to the new page. Also: the links the demo uses exist, the menu picture is there, and no price is written in
 * the demo's scripts that the data file does not own. Run: node tests/demo-data.test.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ok, finish, ROOT } from './lib.mjs';

const require = createRequire(import.meta.url);
const Data = require('../js/demo-data.js');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const decode = (s) => s.replace(/&nbsp;/g, ' ').replace(/&rsquo;/g, '\u2019').replace(/&lsquo;/g, '\u2018').replace(/&ldquo;/g, '\u201c').replace(/&rdquo;/g, '\u201d').replace(/&ndash;/g, '\u2013').replace(/&mdash;/g, '\u2014')
  .replace(/&ntilde;/g, '\u00f1').replace(/&middot;/g, '\u00b7').replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d))
  .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const text = (html) => decode(html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|svg|template)\b[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/[\s\u00a0]+/g, ' ').trim();
const home = read('index.html'), homeText = text(home), visit = text(read('pages/first-visit.html')), school = text(read('pages/school-field-trips.html'));
const has = (hay, s) => hay.includes(s);
const P = Data.PRICES;

/* ---------------- the packages and the add-ons ---------------- */
ok('"Yes pizza": $31 base price, includes 2 Wise Pie pizzas, plus $3 per person (ages 3+)', has(homeText, '$31 base price') && has(homeText, 'Includes 2 Wise Pie pizzas, plus $3 per person (ages 3+)') && P.pizzaBase === 31 && P.pizzasIncluded === 2 && P.perPerson === 3);
ok('"No pizza": $3 per person, field fee, ages 3 and up, children age 2 and younger are free', has(homeText, '$3 per person') && has(homeText, 'Field fee, ages 3 and up') && has(homeText, 'Children age 2 and younger are free') && P.freeAge === 2);
ok('the two packages are offered on the days the page says: pizza Friday, Saturday and Sunday; no pizza Thursday to Sunday (the week strips on the page say the same)',
  has(homeText, 'Friday, Saturday & Sunday') && has(homeText, 'Thursday, Friday, Saturday & Sunday') && has(home, 'data-days="5,6,0"') && has(home, 'data-days="4,5,6,0"') && Data.PACKAGES.pizza.days.join() === '5,6,0' && Data.PACKAGES.farm.days.join() === '4,5,6,0');
ok('wagon ride $4.50 per person, ages 3 and younger ride free', has(homeText, 'Wagon ride $4.50 per person') && has(homeText, 'Ages 3 and younger ride free') && P.wagon === 4.5 && P.wagonFreeAge === 3);
ok('barrel train $3 per child, ages 12 and under only', has(homeText, 'Barrel train $3 per child') && has(homeText, 'Ages 12 and under only') && P.barrel === 3 && P.barrelMaxAge === 12);
ok('corn pit $4 per person, buy one get one free on Thursdays with a reservation', has(homeText, 'Corn pit $4 per person') && has(homeText, 'On Thursdays, the corn pit is buy one, get one free, if you have a reservation') && P.corn === 4);
ok('the pizza is picked up 1 hour after the reservation time (the demo\'s one-hour rule)', has(homeText, 'Pick up your pizzas 1 hour after your reservation time') && Data.defaultPickup('14:00') === '15:00');
ok('"At the farm" pizza hours are 10 am to 4 pm (the demo offers pick-up times up to 4 pm)', has(homeText, '10 am \u2013 4 pm') && Data.FARM_OPENS === '10:00' && Data.FARM_CLOSES === '16:00');

/* ---------------- the Fall Menu ---------------- */
const rows = [...home.matchAll(/<li><span[^>]*class="menu-name"[^>]*>([^<]*)<\/span><span class="menu-price">\$(\d+)<\/span><span[^>]*class="menu-desc"[^>]*>([^<]*)<\/span><\/li>/g)].map((m) => ({ name: decode(m[1]), price: +m[2], desc: decode(m[3]) }));
ok('the page\'s Fall Menu has 9 pizzas and the demo has the same 9: name, price and words, in the same order', rows.length === 9 && JSON.stringify(rows) === JSON.stringify(Data.PIZZAS.map((p) => ({ name: p.name, price: p.price, desc: p.desc }))), rows.length + ' on the page');
ok('every pizza starts with homemade dough and its toppings are what follows', Data.PIZZAS.every((p) => p.desc === 'homemade dough, ' + p.toppings.join(', ')) && new Set(Data.PIZZAS.map((p) => p.id)).size === 9);
ok('gluten-free crust +$9 and vegan cheese +$3, by name, as on the page and the printed menu', has(homeText, 'Wholly Wholesome gluten-free crust +$9') && has(homeText, 'Follow Your Heart vegan cheese +$3') && P.glutenFree === 9 && P.veganCheese === 3);
ok('the printed menu picture is in the site (the prices were read from it)', fs.existsSync(path.join(ROOT, 'assets/photos/wise-pie-fall-menu-2026.webp')) && has(home, 'assets/photos/wise-pie-fall-menu-2026.webp'));

/* ---------------- school trips ---------------- */
ok('school tours: $11 per student, minimum group size 100 students (Groups section and school-field-trips.html)', has(homeText, '$11 per student') && has(homeText, 'Minimum group size: 100 students') && has(school, '$11 per student') && has(school, 'Minimum 100 students') && P.schoolPerStudent === 11 && P.schoolMinStudents === 100);
ok('parents and siblings ages 3 and older who come on the tour pay the same $11', has(homeText, 'If parents and siblings ages 3 and older come on the tour, they pay the $11 admission fee') && has(school, 'Adults and siblings $11 each'));
ok('the minimum-group sentence of the demo is the page\'s own', has(school, 'The minimum group size for a traditional fall school tour is 100 students') && /minimum group size for a school tour is 100 students/.test(Data.eventProblem({ students: 1 })));

/* ---------------- parties and other events (the Parties card, the Corporate events card; "Do you plan or manage a party, an event or a school trip?") ---------------- */
ok('parties: $300 per party (not per person), the farm entry fee is included in it', has(homeText, '$300 per party') && has(homeText, 'The per-person farm entry fee is included in the party cost') && P.partyPrice === 300);
ok('parties: up to 50 guests; children age 2 and younger are free and do not count toward the total', has(homeText, 'Up to 50 guests') && has(homeText, 'Children age 2 and younger are free and do not count toward the total') && P.partyMaxGuests === 50 && P.freeAge === 2);
ok('parties: the party time sentence of the demo is the page\'s own (2.5 hours in all)', has(homeText, '2.5 hours') && has(homeText, Data.RULES.partyTime), Data.RULES.partyTime);
ok('larger events and full farm rentals are for Mrs. Cathy to quote: the page says so, and the corporate prices there are still a DRAFT, so the demo shows no price for "another event"',
  has(homeText, 'For larger events or full farm rentals, email') && has(homeText, 'Draft pricing') && Data.priceEvent({ kind: 'other', guests: 30 }).total === null && Data.priceEvent({ kind: 'other', guests: 30 }).lines.length === 0);
ok('a party costs the one page price, whatever the guest count; a school trip is $11 each as before; no price is invented for another kind', Data.priceEvent({ kind: 'party', guests: 24 }).total === 300 && Data.priceEvent({ kind: 'party', guests: 50 }).total === 300 && Data.priceEvent({ students: 100, guests: 8 }).total === 1188 && Data.priceEvent({ kind: 'school', students: 100, guests: 0 }).total === 1100);
ok('the party rule: more than 50 guests is a problem (the page\'s limit), 50 is fine; another event has no head-count rule; the school minimum is unchanged',
  Data.eventProblem({ kind: 'party', guests: 51 }) !== '' && /up to 50 guests/.test(Data.eventProblem({ kind: 'party', guests: 51 })) && Data.eventProblem({ kind: 'party', guests: 50 }) === '' && Data.eventProblem({ kind: 'other', guests: 500 }) === '' && Data.eventProblem({ students: 99 }) !== '' && Data.eventProblem({ kind: 'school', students: 100 }) === '');
const kinds = Data.EVENT_KINDS;
ok('the sign-up question has four big buttons with exactly these words: No / Yes: a party / Yes: a school trip / Yes: another event; the first one is no event', kinds.map((k) => k.label).join(' | ') === 'No | Yes: a party | Yes: a school trip | Yes: another event' && kinds.map((k) => k.key).join() === 'none,party,school,other');
ok('an answer is read as one of the four keys: nothing given is the ready-made sample (a school trip), anything unknown is no event', Data.eventKindOf(undefined) === 'school' && Data.eventKindOf('party') === 'party' && Data.eventKindOf('PARTY') === 'party' && ['none', null, '', 'banana', 0, {}].every((x) => Data.eventKindOf(x) === 'none'));
ok('the ready-made sample account (Alex) planned a school trip, so it has a My event tab', Data.SAMPLE_ACCOUNT.eventKind === 'school' && Data.sample('2026-11-03', '10:00').events.length === 1 && Data.sample('2026-11-03', '10:00').events[0].kind === 'school');
{
  const day = '2026-11-03', party = Data.sample(day, '10:00', 'party').events[0], school = Data.sample(day, '10:00', 'school').events[0], other = Data.sample(day, '10:00', 'other').events[0], none = Data.sample(day, '10:00', 'none');
  ok('the sample party has guests only, at most 50, on a Saturday after today; the sample school trip has at least 100 students; another event has guests and no price', party.kind === 'party' && party.guests >= 1 && party.guests <= P.partyMaxGuests && !('students' in party) && Data.weekday(party.date) === 6 && party.date > day
    && school.kind === 'school' && school.students >= P.schoolMinStudents && other.kind === 'other' && other.guests >= 1 && !('students' in other), JSON.stringify([party, school, other]));
  ok('answer No: the sample has no event and no event message at all; the rest of the sample is the same', none.events.length === 0 && none.messages.length === 0 && none.visits.length === 3 && none.orders.length === 1 && Data.sample(day, '10:00', 'party').visits.length === 3);
  ok('the sample has no badges, visit counts or points of any kind', !('badges' in Data.sample(day, '10:00')) && !Object.keys(Data.sample(day, '10:00')).some((k) => /badge|stamp|streak|points|count/i.test(k)));
}

/* ---------------- contacts: Vanessa for school tours, Ava for pizza (both already public on the site) ---------------- */
const VAN = Data.CONTACTS.vanessa, AVA = Data.CONTACTS.ava;
ok('Vanessa\'s address and its subject line are on the home page and the school tours page, and the demo\'s link is the same', has(home, 'href="' + VAN.href + '"') && has(read('pages/school-field-trips.html'), 'href="' + VAN.href + '"') && VAN.email === 'vanessa@wiseacresorganic.com' && VAN.text === 'Questions? Email Vanessa');
ok('Ava\'s address and its subject line are on the home page and the Wise Pie page, and the demo\'s link is the same', has(home, 'href="' + AVA.href + '"') && has(read('pages/wise-pie.html'), 'href="' + AVA.href + '"') && AVA.email === 'ava@wiseacresorganic.com' && AVA.text === 'Pizza questions? Email Ava');
ok('a contact is a name, an address, a link and the words of the link, nothing else (no phone number)', [VAN, AVA].every((c) => Object.keys(c).sort().join() === 'email,href,name,text' && /^mailto:[a-z]+@wiseacresorganic\.com\?subject=[A-Za-z0-9%]+$/.test(c.href)));
{
  const addresses = new Set();
  for (const f of fs.readdirSync(path.join(ROOT, 'js')).filter((x) => /^(demo-.*|tour-steps-c)\.js$/.test(x))) {
    const code = read('js/' + f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
    for (const m of code.matchAll(/[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g)) addresses.add(m[0].toLowerCase());
  }
  const allowed = new Set(['alex@example.com', 'vanessa@wiseacresorganic.com', 'ava@wiseacresorganic.com']);
  ok('the only e-mail addresses in the demo scripts and the tour steps are the sample family\'s example address and these two, which the site already shows', [...addresses].every((a) => allowed.has(a)), [...addresses].join(', '));
}

/* ---------------- changes, rain, links ---------------- */
ok('the sentences about changes and severe weather are the site\'s own ("Changes and rain", First visit)', has(visit, Data.RULES.change) && has(visit, Data.RULES.weather), Data.RULES.change);
ok('the Directions link is the one the site already has', has(home.replace(/&amp;/g, '&'), 'href="' + Data.LINKS.directions + '"'));
ok('What to bring leads to the checklist card of First visit; the First visit page and the home page exist', has(read('pages/first-visit.html'), 'id="checklist"') && Data.LINKS.whatToBring === 'first-visit.html#checklist' && fs.existsSync(path.join(ROOT, 'index.html')) && fs.existsSync(path.join(ROOT, Data.LINKS.firstVisit)));
ok('the farm address is the site\'s own', has(homeText, '4701 Hartis Road') && /^4701 Hartis Rd, Indian Trail, NC 28079$/.test(Data.LINKS.address));

/* ---------------- "Tell me when": the choices and the pretend phone ---------------- */
const KINDS = Data.alertKinds, kindOf = (key) => KINDS.find((k) => k.key === key) || {};
const WHEN_SENTENCE = 'Reservations with pizza open every Tuesday at 5:00 PM for the upcoming weekend';
ok('the choices are in this order: a spot on a full day, reservations open, then the seasons as the site has them (strawberries, blueberries and sunflowers, pumpkins and tomatoes, Christmas trees)',
  KINDS.map((k) => k.key).join() === 'spot,reservations,strawberries,blueberries,pumpkins,trees' && KINDS.map((k) => k.label).join(' | ') === 'A spot opens on a full day | Reservations open | Strawberries open | Blueberries and sunflowers open | Pumpkins and tomatoes open | Christmas trees arrive');
ok('every choice has a title, a line under it and the words the family reads in the bell; no two are the same', KINDS.every((k) => k.key && k.label && k.note && k.notice) && new Set(KINDS.map((k) => k.key)).size === KINDS.length && new Set(KINDS.map((k) => k.notice)).size === KINDS.length);
ok('"Reservations open" says only what the site says: reservations with pizza open every Tuesday at 5:00 PM for the upcoming weekend (home page, Wise Pie page, Pumpkin patch page)',
  has(homeText, WHEN_SENTENCE) && has(text(read('pages/wise-pie.html')), WHEN_SENTENCE) && has(text(read('pages/pumpkin-patch.html')), WHEN_SENTENCE) && kindOf('reservations').note.includes(WHEN_SENTENCE));
const TIMES = /\b\d{1,2}(?::\d{2})?\s?(?:AM|PM|am|pm)\b/g, DAYS_OR_MONTHS = /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)\b/g;
const said = KINDS.map((k) => [k.key, k.label + ' ' + k.note + ' ' + k.notice]);
ok('no hour is made up: every time written in these words is on the home page', said.every(([, t]) => (t.match(TIMES) || []).every((m) => has(homeText, m))), said.map(([k, t]) => k + ': ' + (t.match(TIMES) || []).join('/')).join(', '));
ok('no day or date is made up: the only choice that names a weekday is the reservations one, and it is the site\'s sentence', said.filter(([, t]) => (t.match(DAYS_OR_MONTHS) || []).length).map(([k]) => k).join() === 'reservations');
ok('the pretend phone number is a made-up one: it is in the block set aside for made-up numbers (555-0100 to 555-0199) and is not a number the site shows',
  /^\(\d{3}\) 555-01\d\d$/.test(Data.SAMPLE_PHONE) && !homeText.includes(Data.SAMPLE_PHONE) && !home.includes(Data.SAMPLE_PHONE.replace(/\D/g, '')) && Data.sample('2026-11-03').family.phone === Data.SAMPLE_PHONE && JSON.stringify(Data.sample('2026-11-03').family.notify) === '{"text":true,"email":true}');

/* ---------------- the demo's scripts keep to the data file ---------------- */
const demoJs = fs.readdirSync(path.join(ROOT, 'js')).filter((f) => /^demo-.*\.js$/.test(f) && f !== 'demo-data.js');
const stray = [];
for (const f of demoJs) {
  const code = read('js/' + f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
  for (const m of code.matchAll(/\$\d[\d,.]*/g)) stray.push(f + ' ' + m[0]);
}
ok('no dollar amount is written into the other demo scripts (every price comes from js/demo-data.js, so one test covers them all)', stray.length === 0, stray.slice(0, 6).join(', ') + (demoJs.length ? '' : ' (no other demo scripts yet)'));
await finish({});
