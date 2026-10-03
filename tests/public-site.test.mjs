/* Keeps the tests and the owner's notes off the public site: nothing links to tests/ or docs/, the sitemap lists only real pages, robots.txt and
 * _headers keep tests/, docs/ and print/ out of search results, and tests/ holds no web page. No browser needed. */
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

const headers = read('_headers');
ok('_headers marks /tests/*, /docs/* and /print/* as noindex', ['tests', 'docs', 'print'].every((d) => new RegExp('^/' + d + '/\\*\\s*\\n\\s+X-Robots-Tag:\\s*noindex', 'm').test(headers)));

const web = walk('tests').filter((f) => /\.(html?|svg|xml|css)$/i.test(f));
ok('tests/ contains no web page or style (nothing to index or open by mistake)', web.length === 0, web.join(', '));
ok('tests/ is not named in the web manifest or the 404 page', !/tests\//.test(read('manifest.webmanifest')) && !/tests\//.test(read('404.html')));

await finish({});
