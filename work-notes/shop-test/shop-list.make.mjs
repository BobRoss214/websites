#!/usr/bin/env node
/* Makes tests/shop-list.json from the farm's products list (SHOP-LIST.md), the one source of truth for the "What to buy" section (#shop in index.html).
 *
 *   node tests/shop-list.make.mjs PATH/TO/SHOP-LIST.md          write tests/shop-list.json
 *   node tests/shop-list.make.mjs PATH/TO/SHOP-LIST.md --check  change nothing; exit 1 when tests/shop-list.json is not what the list says
 *
 * The list has one line per product:   - slug | English name | price | small note | what to draw
 * and one heading per group:           ### 1. Snacks & treats (at the barn)
 * A price of `?` means the farm has not confirmed it: the page then shows "Prices coming soon" and no dollar sign.
 * Nothing here is written by hand except SYMBOLS (the pictures that are reused from other places on the site), RULES (sentences in the list that
 * are orders to the page maker: "do not copy hours here") and EXTRAS (cards the page also shows that are NOT in the list, each with the place on the
 * published page where its words come from). The rest is read from the list, so a changed price in the list is a changed price here.
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
const src = args.find((a) => !a.startsWith('--'));
if (!src) { console.log('Usage: node tests/shop-list.make.mjs PATH/TO/SHOP-LIST.md [--check]'); process.exit(2); }
const md = fs.readFileSync(src, 'utf8');

/* ---- the pictures: by default the symbol p-<slug>; these four reuse a picture that is drawn elsewhere (the list says so in group 12) */
const SYMBOLS = {
  'wagon-ride': ['tractor', 'wagon'],            // "reuse the existing symbols #tractor / #wagon"
  'barrel-train': ['barrel-train'],              // "reuse the existing #barrel-train"
  'corn-pit': ['p-corn-cob'],                    // "use a small corn cob drawing p-corn-cob"
  'sunn-hemp-maze': ['p-sunn-hemp-mini'],        // "a green plant with yellow flowers p-sunn-hemp-mini"
};

/* ---- orders to the page maker that are in the list's own words; the phrase must still be in the list, or this stops */
const RULES = {
  pizza: { needs: /do not copy hours here/, set: { linkTo: 'wise-pie.html', noHours: true } },
  'beer-wine': { needs: /Do not put an age statement/, set: { noAgeStatement: true } },
  'christmas-tree': { needs: /keep the page's existing wording only/, set: { noNewDates: true } },
};

/* ---- cards the page may show that the list does not have. Each one is a fact the published page already had before the new section was made (commit
 *      e3a195f: the old #shop price lists), so the test can tell an old fact from an invented one: this script checks the words below against that commit.
 *      `says` = the words and numbers the card may carry. The test fails on any other card that is not in the list. Take a row out to forbid the card. */
const OLD_PAGE = { commit: 'e3a195f', file: 'index.html' };
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
const groups = [];
const products = [];
let cur = null;
for (const line of md.split('\n')) {
  let m = /^### (\d+)\.\s+(.*)$/.exec(line);
  if (m) {
    const text = m[2];
    const name = text.replace(/\s*[(.].*$/, '').trim();               // "Rides, games and picking (tokens ...). These are ..." -> "Rides, games and picking"
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
    // "$3 small, $4 large" | "1 scoop $4, 2 scoops $6" | "$19.99 (8 oz), $32.99 (16 oz)" | '8" $8, 10" $13, 12" $20' | "basil $1 a stem, tomatoes $4.50 a pound" | "$.84 a pound" | "$6 each"
    const parts = price.split(/,\s*(?![^()]*\))/);
    p.amounts = amountsIn(price);
    if (!p.amounts.length) throw new Error(`product ${m[1]}: a price with no dollar amount: ${price}`);
    for (const part of parts) {
      const a = amountsIn(part);
      if (a.length !== 1) throw new Error(`product ${m[1]}: cannot read the price part "${part}"`);
      const rest = part.replace(/\$\s*\d*\.?\d+/, ' ').replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();   // the words around the amount
      const um = /\b((?:a|per|each)\b.*)$/i.exec(rest);                                                   // "a pound", "a stem", "each"
      const unit = um ? um[1].trim() : '';
      const label = (um ? rest.slice(0, um.index) : rest).trim();                                        // "small", "1 scoop", '8"', "8 oz", "basil"
      if (parts.length > 1) p.options.push({ amount: a[0], label, unit });
      else p.unit = unit;
      if (parts.length > 1 && !label) throw new Error(`product ${m[1]}: option with no label: ${part}`);
    }
  }
  for (const [slug, r] of Object.entries(RULES)) if (slug === p.slug) { if (!r.needs.test(md)) throw new Error(`rule for ${slug}: the list no longer says ${r.needs}`); Object.assign(p, r.set); }
  products.push(p);
  cur.slugs.push(p.slug);
}

/* ---- the list must look like the list we were given: stop on anything odd instead of writing a wrong file ---- */
const seen = new Set();
for (const p of products) { if (seen.has(p.slug)) throw new Error('slug twice in the list: ' + p.slug); seen.add(p.slug); }
if (groups.length < 12) throw new Error('expected 12 groups, found ' + groups.length);
if (groups.some((g) => !g.slugs.length)) throw new Error('a group with no product: ' + groups.find((g) => !g.slugs.length).name);
if (groups.find((g) => g.n === 8).slugs.some((s) => !products.find((p) => p.slug === s).unknown)) throw new Error('group 8 (Wear Wise Acres): the list says ALL prices are "?"');

/* ---- the old page is the proof for the extras (only when git and that commit are here; a copy of the site without git skips this) ---- */
let oldHtml = '';
try { oldHtml = execFileSync('git', ['show', `${OLD_PAGE.commit}:${OLD_PAGE.file}`], { cwd: path.dirname(HERE), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }); } catch (e) { /* no git here */ }
if (oldHtml) {
  for (const x of EXTRAS) for (const phrase of x.old) if (!oldHtml.includes(phrase)) throw new Error(`extra card "${x.name}": "${phrase}" is not on the published page at ${OLD_PAGE.commit}, so it is not an old fact`);
} else console.log('(git and commit ' + OLD_PAGE.commit + ' are not here: the extra cards were not checked against the old page)');
for (const x of EXTRAS) delete x.old;

/* ---- one product on one line, so a changed price is one changed line in a diff ---- */
const J = (v) => JSON.stringify(v);
const lines = [
  '{',
  ` "_about": ${J('Made by tests/shop-list.make.mjs from the farm\'s products list (SHOP-LIST.md). Do not edit by hand: change the list, then run  node tests/shop-list.make.mjs PATH/TO/SHOP-LIST.md')},`,
  ` "_source": ${J({ file: 'SHOP-LIST.md', sha256: crypto.createHash('sha256').update(md).digest('hex') })},`,
  ` "unknownWords": ${J('Prices coming soon')},`,
  ' "groups": [', groups.map((g) => '  ' + J({ n: g.n, name: g.name, where: g.where, slugs: g.slugs })).join(',\n'), ' ],',
  ' "products": [', products.map((p) => '  ' + J(p)).join(',\n'), ' ],',
  ' "extras": [', EXTRAS.map((e) => '  ' + J(e)).join(',\n'), ' ]',
  '}',
];
const text = lines.join('\n');

if (check) {
  let have = '';
  try { have = fs.readFileSync(OUT, 'utf8'); } catch (e) { /* none */ }
  if (have.trim() !== text.trim()) { console.log('tests/shop-list.json is not what ' + src + ' says. Run:  node tests/shop-list.make.mjs ' + src); process.exit(1); }
  console.log('tests/shop-list.json matches ' + src + ' (' + products.length + ' products in ' + groups.length + ' groups).');
} else {
  fs.writeFileSync(OUT, text + '\n');
  const unknown = products.filter((p) => p.unknown).length, free = products.filter((p) => p.free).length;
  console.log(`wrote ${path.relative(process.cwd(), OUT)}: ${products.length} products in ${groups.length} groups (${unknown} with no confirmed price, ${free} free), ${EXTRAS.length} allowed extra cards`);
}
