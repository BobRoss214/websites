// order: 48
// browser: no
// quick: yes
// covers: js/demo-data.js, js/demo-pizza-data.js, index.html, pages/first-visit.html, pages/school-field-trips.html, assets/photos/wise-pie-fall-menu-2026.webp
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
ok('wagon ride $4.50 per person, ages 2 and younger ride free', has(homeText, 'Wagon ride $4.50 per person') && has(homeText, 'Ages 2 and younger ride free') && P.wagon === 4.5 && P.wagonFreeAge === 2);
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

/* ---------------- changes, rain, links ---------------- */
ok('the sentences about changes and severe weather are the site\'s own ("Changes and rain", First visit)', has(visit, Data.RULES.change) && has(visit, Data.RULES.weather), Data.RULES.change);
ok('the Directions link is the one the site already has', has(home.replace(/&amp;/g, '&'), 'href="' + Data.LINKS.directions + '"'));
ok('What to bring leads to the checklist card of First visit; the First visit page and the home page exist', has(read('pages/first-visit.html'), 'id="checklist"') && Data.LINKS.whatToBring === 'first-visit.html#checklist' && fs.existsSync(path.join(ROOT, 'index.html')) && fs.existsSync(path.join(ROOT, Data.LINKS.firstVisit)));
ok('the farm address is the site\'s own', has(homeText, '4701 Hartis Road') && /^4701 Hartis Rd, Indian Trail, NC 28079$/.test(Data.LINKS.address));

/* ---------------- the demo's scripts keep to the data file ---------------- */
const demoJs = fs.readdirSync(path.join(ROOT, 'js')).filter((f) => /^demo-.*\.js$/.test(f) && f !== 'demo-data.js');
const stray = [];
for (const f of demoJs) {
  const code = read('js/' + f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
  for (const m of code.matchAll(/\$\d[\d,.]*/g)) stray.push(f + ' ' + m[0]);
}
ok('no dollar amount is written into the other demo scripts (every price comes from js/demo-data.js, so one test covers them all)', stray.length === 0, stray.slice(0, 6).join(', ') + (demoJs.length ? '' : ' (no other demo scripts yet)'));
await finish({});
