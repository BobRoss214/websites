#!/usr/bin/env node
/* Makes tests/shop-list.json from the farm's products list (work-notes/SHOP-LIST.md), the one source of truth for the "What to buy" section (#shop in index.html).
 *
 *   node tests/shop-list.make.mjs                                write tests/shop-list.json from work-notes/SHOP-LIST.md
 *   node tests/shop-list.make.mjs PATH/TO/SHOP-LIST.md           ... from another copy of the list
 *   node tests/shop-list.make.mjs --check                        change nothing; exit 1 when tests/shop-list.json is not what the list says
 *
 * The list has one line per product:   - slug | English name | price | small note | what to draw
 * and one heading per group:           ### 1. Snacks & treats (at the barn)
 * A price of `?` means the farm has not confirmed it: the page then shows "Prices coming soon" and no dollar sign.
 * Nothing here is written by hand except the tables below (SYMBOLS, RULES, SAYS, AVOID, BUTTONS, NAMES, LOANWORDS, OLD_FACTS and EXTRAS). Each one says
 * where its words come from, and this script stops when the list or the farm's older page no longer has them. The rest is read from the list, so a
 * changed price in the list is a changed price here.
 * tests/shop.test.mjs checks the page against the file this makes. It never reads the page to decide what is right. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'shop-list.json');
const args = process.argv.slice(2);
const check = args.includes('--check');
const src = args.find((a) => !a.startsWith('--')) || path.join(path.dirname(HERE), 'work-notes', 'SHOP-LIST.md');
if (args.includes('--help') || !fs.existsSync(src)) { console.log('Usage: node tests/shop-list.make.mjs [PATH/TO/SHOP-LIST.md] [--check]   (without a path: work-notes/SHOP-LIST.md)'); process.exit(args.includes('--help') ? 0 : 2); }
const md = fs.readFileSync(src, 'utf8').replace(/\r\n/g, '\n');   // (a Windows copy of the list with CR LF line ends is the same list)

/* ---- the pictures: by default the symbol p-<slug>; these four reuse a picture that is drawn elsewhere (the list says so in group 12) */
const SYMBOLS = {
  'wagon-ride': ['tractor', 'wagon'],            // "reuse the existing symbols #tractor / #wagon"
  'barrel-train': ['barrel-train'],              // "reuse the existing #barrel-train"
  'corn-pit': ['p-corn-cob'],                    // "use a small corn cob drawing p-corn-cob"
  'sunn-hemp-maze': ['p-sunn-hemp-mini'],        // "a green plant with yellow flowers p-sunn-hemp-mini"
};

/* ---- orders to the page maker that are in the list's own words; the phrases must still be in the list, or this stops */
const RULES = {
  pizza: { needs: [/LINK to the existing page wise-pie\.html/, /Opening hours may show in this group/], set: { linkTo: 'wise-pie.html', hoursOk: ['10 am', '8 pm'] } },   // the hours of the farm's older page (see OLD_FACTS): no other clock time in the pizza group
  'beer-wine': { needs: [/Do not put an age statement/], set: { noAgeStatement: true } },
  'christmas-tree': { needs: [/keep the page's existing wording only/], set: { noNewDates: true } },
};

/* ---- sentences a card must carry, word for word (the decisions of 24 Oct 2026). Each one must be in the product's note in the list, or this stops. */
const SAYS = {
  'hot-pretzel': ['Caramel Apple contains nuts.'],
  slushie: ['Also on the board with the slushies: organic strawberry lemonade, apple cider'],
  pumpkin: ['Big pumpkins are sold by the pound.', 'Weigh them at the weight station by the barn.', 'On the barn display, each mini pumpkin is $1.50 and each medium pumpkin is $4.00.'],
  'beer-wine': ['Every beer, hard cider and wine is the same price.', "What's pouring changes."],
};

/* ---- words that were taken out of a card on purpose because no sign or photo says them: they must not come back. The card's own name is kept by the test anyway. */
const AVOID = {
  'kettle-corn': [{ words: 'big bag', why: 'no photo says the bag is big' }],
  soap: [{ words: 'handmade', why: 'no photo says the soap is handmade (only the candle sign does)' }],
  izze: [{ words: 'sparkling juice', why: 'no sign says "sparkling juice"; the sign says "Izze"' }],
};

/* ---- the jump button of a group that is named for a card of the group, not for the group: the top menu already has a link called "Pizza" and one called
 *      "Flowers" that go elsewhere, and the link-names test wants two links with the same words to lead to the same place (commit "Shop buttons: give Pizza and Flowers their own names") */
const BUTTONS = { 3: 'pizza', 11: 'flower-jar' };   // group number -> the slug of the product whose name is the button's name

/* ---- names that stay as written in every language (scents, makers): not left-over English. Each one must be in the list. */
const NAMES = ['Tobacco Barn', 'Christmas Hearth', 'Apple Harvest', 'Kokomo'];

/* ---- an English word that a language of the site uses as its own on the pages outside the Shop too (the test looks for it there, and only then lets the Shop use it) */
const LOANWORDS = [{ lang: 'vi', word: 'pound', why: 'the Vietnamese texts of the tomato prices use "mỗi pound"; the Shop uses the same words (the same text block)' }];

/* ---- words of the list that are the farm's own older text and are on no sign: the older page of the site (before the Shop was built, commit e3a195f) has them,
 *      and this script checks that (only when git and that commit are here). Pizza prices and hours: decision 2; the ages of the two rides: decision 6. */
const OLD_PAGE = { commit: 'e3a195f', file: 'index.html' };
const OLD_FACTS = {
  pizza: ['<dd>$15&ndash;$17</dd>', 'Gluten-free crust is +$9 and vegan cheese is +$3.', 'Open Friday&ndash;Sunday, 10 am&ndash;8 pm'],
  'wagon-ride': ['Ages 2 and younger ride free.'],
  'barrel-train': ['Ages 12 and under only.'],
  'corn-pit': ['Buy one, get one free on Thursdays with reservations.'],
  upick: ['Every weekend, late September through October.'],
};

/* ---- cards the page may show that the list does not have. Each one is a fact the published page already had before the new section was made (commit
 *      e3a195f: the old #shop price lists), so the test can tell an old fact from an invented one: this script checks the words below against that commit.
 *      `says` = the words and numbers the card may carry. The test fails on any other card that is not in the list. Take a row out to forbid the card. */
const EXTRAS = [
  { name: 'Farm fun, no pizza', amounts: [3], unknown: false, says: '$3 per person. Ages 3 and up. Thursday-Sunday. Children age 2 and younger are free.', old: ['Farm fun, no pizza', '$3 per person', 'Children age 2 and younger are free'] },
  { name: 'Farm fun with pizza', amounts: [31, 3], unknown: false, says: '$31 base price. Includes 2 Wise Pie pizzas, plus $3 per person (ages 3+). Friday-Sunday.', old: ['Farm fun with pizza', '$31 base', 'Includes 2 Wise Pie pizzas, plus $3 per person'] },
  { name: 'U-pick strawberries', amounts: [], unknown: true, says: 'Prices coming soon. In spring.', old: ['<dt data-t="t93f3a241">Strawberries</dt><dd data-t="tf1fa2a1d" class="soon">Prices coming soon'] },
  { name: 'U-pick blueberries', amounts: [], unknown: true, says: 'Prices coming soon. In summer.', old: ['<dt data-t="tc9b6a025">Blueberries</dt><dd data-t="tf1fa2a1d" class="soon">Prices coming soon'] },
  { name: 'U-pick pumpkins', amounts: [], unknown: true, says: 'Prices coming soon. Pick your own in the patch.', old: ['<dt data-t="t443ca977">U-pick pumpkins</dt><dd data-t="tf1fa2a1d" class="soon">Prices coming soon'] },
].map((e) => ({ ...e, source: `${OLD_PAGE.file} at commit ${OLD_PAGE.commit} (the old #shop price list)` }));

/* ---- reading the list ---- */
const num = (s) => Number(String(s).replace(/^\./, '0.'));
const amountsIn = (s) => [...String(s).matchAll(/\$\s*(\d*\.?\d+)/g)].map((m) => num(m[1]));
const RANGE = /^\$\s*(\d*\.?\d+)\s+to\s+\$\s*(\d*\.?\d+)$/i;      // "$15 to $17"
const groups = [];
const products = [];
let cur = null;
for (const line of md.split('\n')) {
  let m = /^### (\d+)\.\s+(.*)$/.exec(line);
  if (m) {
    const text = m[2];
    const name = text.replace(/\s*[(.].*$/, '').trim();               // "Farm visit, rides & picking (ride tokens ...). These are ..." -> "Farm visit, rides & picking"
    const where = (/\(([^)]*)\)/.exec(text) || [, ''])[1].trim();
    cur = { n: Number(m[1]), name, where, slugs: [] };
    groups.push(cur);
    continue;
  }
  m = /^- ([a-z0-9]+(?:-[a-z0-9]+)*) \|(.*)$/.exec(line);
  if (!m) continue;
  if (!cur) throw new Error('a product line before any group: ' + line);
  const f = m[2].split(/\s*\|\s*/).map((x) => x.trim());
  if (f[0] === '') f.shift();
  if (f.length !== 4) throw new Error(`product ${m[1]}: expected "name | price | note | what to draw" (4 fields), got ${f.length}: ${line}`);
  const [name, price, note] = f;
  const unknown = price === '?';
  const free = /^free$/i.test(price);
  const p = { slug: m[1], group: cur.n, name, price, unknown, free, amounts: [], options: [], unit: '', note, noteAmounts: amountsIn(note), symbols: SYMBOLS[m[1]] || ['p-' + m[1]] };
  if (!unknown && !free) {
    // "$3 small, $4 large" | "1 scoop $4, 2 scoops $6" | "$19.99 (8 oz)" | '8" $8, 10" $13, 12" $20' | "basil $1 a stem, tomatoes $4.50 a pound" | "$.84 a pound" | "$15 to $17"
    const parts = price.split(/,\s*(?![^()]*\))/);
    p.amounts = amountsIn(price);
    if (!p.amounts.length) throw new Error(`product ${m[1]}: a price with no dollar amount: ${price}`);
    for (const part of parts) {
      const range = RANGE.exec(part.trim());
      if (range) {
        if (parts.length > 1) throw new Error(`product ${m[1]}: a range ("${part}") cannot sit beside other prices`);
        p.range = [num(range[1]), num(range[2])];
        if (!(p.range[0] < p.range[1])) throw new Error(`product ${m[1]}: the range "${part}" must go from the smaller to the larger amount`);
        continue;
      }
      const a = amountsIn(part);
      if (a.length !== 1) throw new Error(`product ${m[1]}: cannot read the price part "${part}"`);
      const rest = part.replace(/\$\s*\d*\.?\d+/, ' ').replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();   // the words around the amount
      const um = /\b((?:a|per|each)\b.*)$/i.exec(rest);                                                   // "a pound", "a stem", "each"
      const unit = um ? um[1].trim() : '';
      const label = (um ? rest.slice(0, um.index) : rest).trim();                                        // "small", "1 scoop", '8"', "8 oz", "basil"
      if (parts.length > 1 || label) p.options.push({ amount: a[0], label, unit });                        // one size alone ("$19.99 (8 oz)") is still a label to find
      else p.unit = unit;
      if (parts.length > 1 && !label) throw new Error(`product ${m[1]}: option with no label: ${part}`);
    }
  }
  for (const [slug, r] of Object.entries(RULES)) if (slug === p.slug) { for (const re of r.needs) if (!re.test(md)) throw new Error(`rule for ${slug}: the list no longer says ${re}`); Object.assign(p, r.set); }
  if (SAYS[p.slug]) {
    for (const s of SAYS[p.slug]) if (!note.includes(s)) throw new Error(`${p.slug}: the card must say "${s}" but the list's note does not have these words`);
    p.says = SAYS[p.slug];
  }
  if (AVOID[p.slug]) p.avoid = AVOID[p.slug];
  if (OLD_FACTS[p.slug]) p.oldPage = `${OLD_PAGE.file} at commit ${OLD_PAGE.commit}`;
  products.push(p);
  cur.slugs.push(p.slug);
}

/* ---- the list must look like the list we were given: stop on anything odd instead of writing a wrong file ---- */
const seen = new Set();
for (const p of products) { if (seen.has(p.slug)) throw new Error('slug twice in the list: ' + p.slug); seen.add(p.slug); }
if (groups.length !== 12) throw new Error('expected 12 groups, found ' + groups.length);
if (groups.some((g) => !g.slugs.length)) throw new Error('a group with no product: ' + groups.find((g) => !g.slugs.length).name);
if (groups.find((g) => g.n === 8).slugs.some((s) => !products.find((p) => p.slug === s).unknown)) throw new Error('group 8 (Wear Wise Acres): the list says ALL prices are "?"');
for (const table of [RULES, SAYS, AVOID, OLD_FACTS]) for (const slug of Object.keys(table)) if (!seen.has(slug)) throw new Error(`a rule names the product "${slug}", which the list does not have`);
for (const [n, slug] of Object.entries(BUTTONS)) {
  const g = groups.find((x) => x.n === Number(n));
  if (!g || !g.slugs.includes(slug)) throw new Error(`group ${n} has no product "${slug}" to give its jump button the name of`);
  g.button = products.find((p) => p.slug === slug).name;
}
for (const n of NAMES) if (!md.includes(n)) throw new Error(`the name "${n}" is not in the list any more`);

/* ---- the old page is the proof for the extras and for the older words (only when git and that commit are here; a copy of the site without git skips this) ---- */
let oldHtml = '';
try { oldHtml = execFileSync('git', ['show', `${OLD_PAGE.commit}:${OLD_PAGE.file}`], { cwd: path.dirname(HERE), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }); } catch (e) { /* no git here */ }
if (oldHtml) {
  for (const x of EXTRAS) for (const phrase of x.old) if (!oldHtml.includes(phrase)) throw new Error(`extra card "${x.name}": "${phrase}" is not on the published page at ${OLD_PAGE.commit}, so it is not an old fact`);
  for (const [slug, phrases] of Object.entries(OLD_FACTS)) for (const phrase of phrases) if (!oldHtml.includes(phrase)) throw new Error(`${slug}: "${phrase}" is not on the farm's older page at ${OLD_PAGE.commit}, so the list cannot call it an older fact`);
} else console.log('(git and commit ' + OLD_PAGE.commit + ' are not here: the extra cards and the older words were not checked against the old page)');
for (const x of EXTRAS) delete x.old;

/* ---- one product on one line, so a changed price is one changed line in a diff ---- */
const J = (v) => JSON.stringify(v);
const lines = [
  '{',
  ` "_about": ${J('Made by tests/shop-list.make.mjs from the farm\'s products list (work-notes/SHOP-LIST.md). Do not edit by hand: change the list, then run  node tests/shop-list.make.mjs work-notes/SHOP-LIST.md')},`,
  ` "_source": ${J({ file: path.basename(src), sha256: crypto.createHash('sha256').update(md).digest('hex') })},`,
  ` "unknownWords": ${J('Prices coming soon')},`,
  ` "names": ${J(NAMES)},`,
  ` "loanwords": ${J(LOANWORDS)},`,
  ' "groups": [', groups.map((g) => '  ' + J(g.button ? { n: g.n, name: g.name, where: g.where, slugs: g.slugs, button: g.button } : { n: g.n, name: g.name, where: g.where, slugs: g.slugs })).join(',\n'), ' ],',
  ' "products": [', products.map((p) => '  ' + J(p)).join(',\n'), ' ],',
  ' "extras": [', EXTRAS.map((e) => '  ' + J(e)).join(',\n'), ' ]',
  '}',
];
const text = lines.join('\n');

if (check) {
  let have = '';
  try { have = fs.readFileSync(OUT, 'utf8'); } catch (e) { /* none */ }
  if (have.replace(/\r\n/g, '\n').trim() !== text.trim()) { console.log('tests/shop-list.json is not what ' + path.relative(process.cwd(), src) + ' says. Run:  node tests/shop-list.make.mjs ' + path.relative(process.cwd(), src)); process.exit(1); }
  console.log('tests/shop-list.json matches ' + path.relative(process.cwd(), src) + ' (' + products.length + ' products in ' + groups.length + ' groups).');
} else {
  fs.writeFileSync(OUT, text + '\n');
  const unknown = products.filter((p) => p.unknown).length, free = products.filter((p) => p.free).length;
  console.log(`wrote ${path.relative(process.cwd(), OUT)}: ${products.length} products in ${groups.length} groups (${unknown} with no confirmed price, ${free} free), ${EXTRAS.length} allowed extra cards`);
}
