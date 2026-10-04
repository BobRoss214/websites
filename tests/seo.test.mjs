// order: 15
// browser: no
// covers: *.html, pages/*, sitemap.xml, robots.txt, tools/pages.py, assets/og-*
/* What search engines and share cards (Facebook, iMessage, WhatsApp) read from the pages, without a browser (a second or two):
 *   - every page: its own title (20 to 62 letters) and description (110 to 165 letters), both different on every page, one canonical address that is the
 *     site's own, og:url the same, the share picture present, as big as the tags say (1200 x 630) and small enough for WhatsApp (300 KB),
 *     with a description of it, twitter tags that match, lang="en", nothing that asks for a per-language address (there is none: see docs/SEARCH_AND_SHARING_CHECK.md)
 *   - robots: the 6 pages may be indexed; 404.html and print/ may not
 *   - structured data (JSON-LD): parses; only the types the site uses; the business has a name, a postal address, its own address and an e-mail the page
 *     shows; every extra page's WebPage says what the page's own tags say; every FAQ question is on the page; every price in it is on the page;
 *     nothing that needs data the site does not have (a star rating, reviews, offers); an Event, if one is ever added, is complete and not in the past
 *   - sitemap.xml: exactly the 6 indexable pages at their canonical addresses, no duplicates, a lastmod (if any) is a real date that is not in the future;
 *     robots.txt names it and does not block any of its pages
 * Each check is run first on a deliberately broken sample, so a check that stopped working cannot pass quietly. */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, ok, finish } from './lib.mjs';

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SITE = /^SITE = '([^']+)'/m.exec(read('tools/pages.py'))[1];
const decode = (s) => s.replace(/&nbsp;/g, '\u00a0').replace(/&rsquo;/g, '\u2019').replace(/&lsquo;/g, '\u2018').replace(/&ldquo;/g, '\u201c').replace(/&rdquo;/g, '\u201d').replace(/&ndash;/g, '\u2013').replace(/&mdash;/g, '\u2014')
  .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d)).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const squash = (s) => s.replace(/[\s\u00a0]+/g, ' ').trim();
const text = (html) => squash(decode(html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|svg|template)\b[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ')));
const meta = (html, key) => { const m = new RegExp('<meta (?:name|property)="' + key.replace(/[:.]/g, '\\$&') + '" content="([^"]*)"').exec(html); return m ? decode(m[1]) : null; };
const link = (html, rel) => [...html.matchAll(new RegExp('<link rel="' + rel + '" href="([^"]*)"', 'g'))].map((m) => m[1]);
const titleOf = (html) => { const m = /<title>([^<]*)<\/title>/.exec(html); return m ? squash(decode(m[1])) : ''; };
const jsonld = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const pngSize = (f) => { const b = fs.readFileSync(path.join(ROOT, f)); return b.slice(0, 8).toString('hex') === '89504e470d0a1a0a' ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null; };
const nodes = (o, out = []) => { if (Array.isArray(o)) o.forEach((x) => nodes(x, out)); else if (o && typeof o === 'object') { out.push(o); Object.values(o).forEach((x) => nodes(x, out)); } return out; };
const typeOf = (n) => [].concat(n['@type'] || []);

/* ---- the checks, as small functions (each is tried on a broken sample below) ---- */
const lengthProblem = (what, s, lo, hi) => (s.length < lo || s.length > hi ? `${what} is ${s.length} letters (${lo} to ${hi}): ${s.slice(0, 50)}` : '');
const eventProblems = (e, now) => {
  const p = [], start = Date.parse(e.startDate), end = Date.parse(e.endDate || e.startDate);
  if (!e.name) p.push('no name');
  if (!(start > 0)) p.push('startDate is not a date');
  if (e.endDate && !(Date.parse(e.endDate) >= start)) p.push('endDate is before startDate');
  if (end + 24 * 3600 * 1000 < now) p.push('it is over (' + (e.endDate || e.startDate) + ')');
  if (!e.location || !(e.location.name || e.location['@type'] === 'VirtualLocation') || (e.location['@type'] === 'Place' && !e.location.address)) p.push('location needs a name and an address');
  if (e.eventStatus && !/^https?:\/\/schema\.org\/Event(Scheduled|Cancelled|MovedOnline|Postponed|Rescheduled)$/.test(e.eventStatus)) p.push('eventStatus is not a schema.org status');
  for (const o of [].concat(e.offers || [])) if (!/^\d+(\.\d+)?$/.test(String(o.price)) || !/^[A-Z]{3}$/.test(o.priceCurrency || '')) p.push('an offer needs a numeric price and a currency');
  return p;
};
const sitemapProblems = (locs, canon, now, lastmods) => [
  ...locs.filter((u, i) => locs.indexOf(u) !== i).map((u) => 'listed twice: ' + u),
  ...locs.filter((u) => !canon.includes(u)).map((u) => 'not a canonical page address: ' + u),
  ...canon.filter((u) => !locs.includes(u)).map((u) => 'indexable page missing: ' + u),
  ...lastmods.filter((d) => !/^\d{4}-\d\d-\d\d(T[\d:.]+(Z|[+-]\d\d:\d\d))?$/.test(d) || !(Date.parse(d) > 0) || Date.parse(d) > now + 24 * 3600 * 1000).map((d) => 'lastmod is not a past date: ' + d),
];

const NOW = Date.now();
ok('self-test: a title or description of the wrong length is caught', lengthProblem('title', 'x'.repeat(90), 20, 62) !== '' && lengthProblem('title', 'short', 20, 62) !== '' && lengthProblem('title', 'x'.repeat(50), 20, 62) === '');
ok('self-test: an Event that is over, has no place or has a bad price is caught', eventProblems({ name: 'x', startDate: '2020-01-01', location: { '@type': 'Place', name: 'a' }, offers: { price: 'free' } }, NOW).length >= 3
  && eventProblems({ name: 'x', startDate: new Date(NOW + 86400000 * 3).toISOString().slice(0, 10), location: { '@type': 'Place', name: 'a', address: 'b' }, eventStatus: 'https://schema.org/EventScheduled', offers: { price: '3', priceCurrency: 'USD' } }, NOW).length === 0);
ok('self-test: a sitemap with a missing page, an extra page, a twin or a future lastmod is caught', sitemapProblems(['a', 'a', 'x'], ['a', 'b'], NOW, ['2999-01-01', 'soon']).length === 5 && sitemapProblems(['a'], ['a'], NOW, ['2026-10-03']).length === 0);

/* ---- the pages ---- */
const files = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html') && f !== '404.html').sort();
const html = Object.fromEntries(files.map((f) => [f, read(f)]));
const canonOf = (f) => SITE + (f === 'index.html' ? '' : f);
ok('the site has the 6 pages this test knows (a new page needs a line in the sitemap and its own tags: then this count changes)', files.length === 6, files.join(', '));

const per = (what, fn) => { const bad = files.map((f) => { const r = fn(html[f], f); return r ? f + ': ' + r : ''; }).filter(Boolean); ok(what, bad.length === 0, bad.slice(0, 4).join(' | ')); };
const unique = (what, fn) => { const seen = {}; const bad = []; for (const f of files) { const v = fn(html[f]); if (seen[v]) bad.push(f + ' = ' + seen[v]); seen[v] = f; } ok(what, bad.length === 0, bad.join(' | ')); };

per('every page title is 20 to 62 letters (search results show about 50 to 60)', (h) => lengthProblem('title', titleOf(h), 20, 62));
per('every page description is 110 to 165 letters (search results show about 120 to 160)', (h) => lengthProblem('description', meta(h, 'description') || '', 110, 165));
unique('every page has its own title', titleOf);
unique('every page has its own description', (h) => meta(h, 'description'));
unique('every page has its own first heading', (h) => text((/<h1\b[\s\S]*?<\/h1>/.exec(h) || [''])[0].replace(/<[^>]*\bhidden\b[^>]*>[\s\S]*?<\/span>/g, '')));
per('every page says lang="en" (its words are English until the visitor picks a language)', (h) => (/<html lang="en"[ >]/.test(h) ? '' : 'no lang="en"'));
per('every page has exactly one canonical address, and it is the site\'s own address for that page', (h, f) => { const c = link(h, 'canonical'); return c.length === 1 && c[0] === canonOf(f) ? '' : 'canonical ' + JSON.stringify(c) + ' instead of ' + canonOf(f); });
per('og:url is the canonical address', (h, f) => (meta(h, 'og:url') === canonOf(f) ? '' : 'og:url ' + meta(h, 'og:url')));
per('og:title, og:description, og:type, og:site_name and og:locale are there, in a length share cards show (title 70, description 200)', (h) => ['og:title', 'og:description', 'og:type', 'og:site_name', 'og:locale'].map((k) => (meta(h, k) ? '' : k + ' missing')).join('') || (meta(h, 'og:title').length > 70 || meta(h, 'og:description').length > 200 ? 'too long for a share card' : ''));
per('the twitter card is large and uses the same picture and description of it as og:', (h) => (meta(h, 'twitter:card') === 'summary_large_image' && meta(h, 'twitter:image') === meta(h, 'og:image') && meta(h, 'twitter:image:alt') === meta(h, 'og:image:alt') ? '' : 'twitter tags differ from og: tags'));
per('the share picture is on this site, is a real PNG as big as og:image:width/height say (1200 x 630), is under 300 KB (WhatsApp skips bigger ones) and has a description', (h) => {
  const u = meta(h, 'og:image') || '', alt = meta(h, 'og:image:alt') || '';
  if (!u.startsWith(SITE + 'assets/')) return 'og:image is not under ' + SITE + 'assets/: ' + u;
  const f = u.slice(SITE.length);
  if (!fs.existsSync(path.join(ROOT, f))) return f + ' is missing';
  const size = pngSize(f);
  if (!size || size[0] !== +meta(h, 'og:image:width') || size[1] !== +meta(h, 'og:image:height') || size[0] !== 1200 || size[1] !== 630) return f + ' is ' + (size || []).join('x') + ', the tags say ' + meta(h, 'og:image:width') + 'x' + meta(h, 'og:image:height');
  if (fs.statSync(path.join(ROOT, f)).size > 300 * 1024) return f + ' is over 300 KB';
  return alt.length < 40 ? 'og:image:alt is too short' : '';
});
unique('every page has its own share picture', (h) => meta(h, 'og:image'));
per('no page asks for a per-language address (no hreflang, no og:locale:alternate): the site has one address per page and swaps the words in the browser', (h) => (/hreflang|og:locale:alternate/.test(h) ? 'hreflang or og:locale:alternate found: every language needs its own address first' : ''));
per('no page is marked noindex (these 6 are meant to be found)', (h) => (/<meta name="robots"[^>]*(noindex|none)/i.test(h) ? 'noindex' : ''));
const notFound = read('404.html');
ok('404.html is marked noindex and has no canonical address', /<meta name="robots" content="noindex">/.test(notFound) && link(notFound, 'canonical').length === 0);
const printed = fs.readdirSync(path.join(ROOT, 'print')).filter((f) => f.endsWith('.html'));
ok('every page in print/ is marked noindex (' + printed.length + ' pages)', printed.length > 0 && printed.every((f) => /<meta name="robots" content="noindex">/.test(read('print/' + f))), printed.join(', '));

/* ---- structured data ---- */
const ALLOWED = ['LocalBusiness', 'PostalAddress', 'WebPage', 'FAQPage', 'Question', 'Answer'];
per('every JSON-LD block parses, is on https://schema.org and uses only the types this site has data for', (h) => {
  const blocks = jsonld(h);
  if (!blocks.length) return 'no structured data';
  for (const b of blocks) {
    if (b['@context'] !== 'https://schema.org') return '@context is ' + b['@context'];
    for (const n of nodes(b)) for (const t of typeOf(n)) if (!ALLOWED.includes(t) && !/^(Event|Offer|Place)$/.test(t)) return 'type ' + t + ' (add it to the test only if the page shows the data for it)';
  }
  return '';
});
per('the home page names the business (name, postal address, own url, e-mail shown on the page, founding date as a date, sameAs on https)', (h, f) => {
  if (f !== 'index.html') return '';
  const b = jsonld(h).flatMap((x) => nodes(x)).find((n) => typeOf(n).includes('LocalBusiness'));
  if (!b) return 'no LocalBusiness';
  const a = b.address || {}, page = text(h);
  const miss = ['name', 'url', 'email', 'image'].filter((k) => !b[k]).concat(['streetAddress', 'addressLocality', 'addressRegion', 'postalCode', 'addressCountry'].filter((k) => !a[k]));
  if (miss.length) return 'missing ' + miss.join(', ');
  if (typeOf(a)[0] !== 'PostalAddress' || !/^\d{5}$/.test(a.postalCode) || a.addressCountry !== 'US') return 'the address is not a US PostalAddress with a 5-digit ZIP';
  if (b.url !== SITE || !b['@id'].startsWith(SITE)) return 'url or @id is not the site address';
  if (!page.includes(b.email) || !page.includes(a.streetAddress)) return 'the e-mail or the street address is not shown on the page';
  if (b.foundingDate && !/^\d{4}(-\d\d(-\d\d)?)?$/.test(b.foundingDate)) return 'foundingDate is not a date';
  return (b.sameAs || []).every((u) => /^https:\/\//.test(u)) ? '' : 'sameAs holds an address that is not https';
});
per('each extra page\'s WebPage says what the page\'s own tags say (address, title, description, belongs to the business on the home page)', (h, f) => {
  if (f === 'index.html') return '';
  const w = jsonld(h).flatMap((x) => nodes(x)).find((n) => typeOf(n).includes('WebPage'));
  if (!w) return 'no WebPage';
  if (w['@id'] !== canonOf(f) || w.url !== canonOf(f) || w.name !== titleOf(h) || w.description !== meta(h, 'description') || w.isPartOf['@id'] !== SITE + '#site') return 'the WebPage differs from the page\'s tags';
  return w.inLanguage === 'en-US' ? '' : 'inLanguage is ' + w.inLanguage;
});
per('every FAQ question in the structured data is on the page and has an answer without tags, and none is listed twice', (h) => {
  const qs = jsonld(h).flatMap((x) => nodes(x)).filter((n) => typeOf(n).includes('Question')), page = text(h);
  const names = qs.map((q) => q.name);
  const bad = qs.filter((q) => !q.name || !page.includes(squash(q.name)) || !q.acceptedAnswer || !q.acceptedAnswer.text || q.acceptedAnswer.text.length < 20 || /[<>]/.test(q.acceptedAnswer.text));
  return bad.length ? 'not on the page or empty: ' + bad.map((q) => q.name).slice(0, 2).join(' / ') : names.some((n, i) => names.indexOf(n) !== i) ? 'a question is listed twice' : '';
});
per('every price in the structured data is also on the page', (h) => {
  const page = text(h), prices = [...JSON.stringify(jsonld(h)).matchAll(/\$\d+(?:\.\d\d)?/g)].map((m) => m[0]);
  const lost = prices.filter((p) => !page.includes(p));
  return lost.length ? 'not on the page: ' + [...new Set(lost)].join(', ') : '';
});
per('no star rating, review, offer or event is claimed (the site has no real ones: reviews is empty in js/content.js); an Event added later must be complete and not over', (h) => {
  const bad = [];
  for (const n of jsonld(h).flatMap((x) => nodes(x))) {
    for (const k of ['aggregateRating', 'review', 'offers', 'priceRange']) if (n[k] && !typeOf(n).includes('Event')) bad.push(k + ' on ' + (typeOf(n)[0] || 'a node'));
    if (typeOf(n).includes('Event')) bad.push(...eventProblems(n, NOW));
  }
  return bad.join('; ');
});

/* ---- sitemap.xml and robots.txt ---- */
const sm = read('sitemap.xml');
const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const lastmods = [...sm.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
const problems = sitemapProblems(locs, files.map(canonOf), NOW, lastmods);
ok('sitemap.xml lists exactly the 6 pages at their canonical addresses, each once, with no future or invented lastmod', problems.length === 0, problems.join(' | '));
const robots = read('robots.txt');
const blocked = [...robots.matchAll(/^Disallow:\s*(\S+)/gm)].map((m) => m[1]).filter((p) => locs.some((u) => new URL(u).pathname.startsWith(p)));
ok('robots.txt names the sitemap by its full address and blocks none of the pages in it', robots.includes('Sitemap: ' + SITE + 'sitemap.xml') && blocked.length === 0, blocked.join(', '));

await finish({});
