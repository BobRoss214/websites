/* Keeps the tests and the owner's notes off the public site: nothing links to tests/ or docs/, the sitemap lists only real pages, robots.txt and
 * _headers keep tests/, docs/ and print/ out of search results, and tests/ holds no web page. Also: the site's own address is written the same way
 * everywhere (a forgotten place would make Google and share cards point at another site). No browser needed. */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, ok, finish } from './lib.mjs';

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const walk = (dir, out = []) => { for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) { const rel = path.join(dir, e.name); if (e.isDirectory()) { if (!['node_modules', '.git'].includes(e.name)) walk(rel, out); } else out.push(rel); } return out; };

// the pages of the site: every .html outside tests/ and node_modules
const pages = [...fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')), ...walk('pages'), ...walk('print')].filter((f) => f.endsWith('.html'));
const linking = pages.filter((f) => /(?:href|src|action)\s*=\s*["'](?:\.?\/)?(?:tests|docs)\//i.test(read(f)) || /["']\/(?:tests|docs)\//.test(read(f)));
ok('no page links to anything under tests/ or docs/', linking.length === 0, linking.join(', '));

const sitemap = read('sitemap.xml');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
ok('sitemap.xml lists nothing under tests/, docs/, print/, tools/, pages/ or lang/', locs.length > 0 && !locs.some((u) => /\/(tests|docs|print|tools|pages|lang)\//.test(u)), locs.filter((u) => /\/(tests|docs|print|tools|pages|lang)\//.test(u)).join(', '));
const missing = locs.map((u) => new URL(u).pathname.replace(/^\//, '') || 'index.html').filter((f) => !fs.existsSync(path.join(ROOT, f)));
ok('every address in sitemap.xml is a real page', missing.length === 0, missing.join(', '));

const robots = read('robots.txt');
ok('robots.txt keeps /tests/, /docs/ and /print/ out of search engines', ['tests', 'docs', 'print'].every((d) => new RegExp('^Disallow:\\s*/' + d + '/\\s*$', 'm').test(robots)), robots.replace(/\n/g, ' | '));
ok('robots.txt still lets the site itself be crawled and names the sitemap', /^Allow:\s*\/\s*$/m.test(robots) && /^Sitemap:\s*https:\/\/\S+\/sitemap\.xml\s*$/m.test(robots));

// One address everywhere: SITE in tools/pages.py, the home page's own tags and structured data, the sitemap, robots.txt and the QR signs.
// Changing the domain and forgetting one of these leaves canonical tags and share pictures pointing at another site.
const site = (read('tools/pages.py').match(/^SITE = '([^']+)'/m) || [])[1] || '';
const originOf = (u) => { try { return new URL(u).origin; } catch (e) { return ''; } };
const home = read('index.html');
const tagValues = (html, re) => [...html.matchAll(re)].map((m) => m[1]);
const selfUrls = (f) => {
  const html = read(f);
  return [...tagValues(html, /<link rel="canonical" href="([^"]+)"/g), ...tagValues(html, /<meta (?:property|name)="(?:og:url|og:image|twitter:image)" content="([^"]+)"/g),
    ...tagValues(html, /"(?:@id|url|image)":\s*"(https?:[^"]+)"/g).filter((u) => originOf(u) !== 'https://www.google.com')];
};
ok('SITE in tools/pages.py is one plain address ending in a slash', /^https:\/\/[^/]+\/$/.test(site), site);
const origin = originOf(site);
const wrongPlace = [];
for (const f of fs.readdirSync(ROOT).filter((n) => n.endsWith('.html') && n !== '404.html')) for (const u of selfUrls(f)) if (originOf(u) !== origin && !/^https:\/\/(www\.)?(facebook|instagram)\.com\//.test(u)) wrongPlace.push(f + ': ' + u);
ok('every canonical, share and structured-data address of every page is on the SITE address', wrongPlace.length === 0, wrongPlace.slice(0, 4).join(' | '));
ok('the home page names itself exactly as SITE does', tagValues(home, /<link rel="canonical" href="([^"]+)"/g)[0] === site, tagValues(home, /<link rel="canonical" href="([^"]+)"/g)[0]);
ok('sitemap.xml, robots.txt and the QR signs use the SITE address', locs.every((u) => u.startsWith(site)) && read('robots.txt').includes('Sitemap: ' + site + 'sitemap.xml') && JSON.parse(read('tools/qr_links.json')).site === site,
  [locs.find((u) => !u.startsWith(site)), JSON.parse(read('tools/qr_links.json')).site].filter(Boolean).join(' | '));

const headers = read('_headers');
ok('_headers marks /tests/*, /docs/* and /print/* as noindex', ['tests', 'docs', 'print'].every((d) => new RegExp('^/' + d + '/\\*\\s*\\n\\s+X-Robots-Tag:\\s*noindex', 'm').test(headers)));

const web = walk('tests').filter((f) => /\.(html?|svg|xml|css)$/i.test(f));
ok('tests/ contains no web page or style (nothing to index or open by mistake)', web.length === 0, web.join(', '));
ok('tests/ is not named in the web manifest or the 404 page', !/tests\//.test(read('manifest.webmanifest')) && !/tests\//.test(read('404.html')));

await finish({});
