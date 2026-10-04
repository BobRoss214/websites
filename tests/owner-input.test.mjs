// order: 135
// browser: yes
// quick: no
// covers: js/content.js, js/features.js, js/main.js, js/analytics.js
/* What the owner types into js/content.js reaches visitors. The owner copies words and addresses from other people (a review, a Mailchimp link,
 * an analytics snippet), so this test types HOSTILE ones and looks at the real page, in English and Spanish and with the Site check box open:
 *   - markup typed into the notice bar, a review, the week note, the closures, a photo or a community credit stays plain text: no element is made
 *     from it, no script runs (a marker is set by every hostile snippet), no pop-up opens
 *   - an address that is not https:// (javascript:, data:) never becomes a link: not in a review, not on the "Write a review" buttons, not in the
 *     Mailchimp form (which then stays hidden); a script address in the analytics settings that is not https:// is never loaded
 *   - every link that opens a new tab says noopener
 *   - the Site check box shows the hostile words as text too
 * The settings are added after js/content.js (the test's own "extra" setting), so your files are not touched. */
import { run, ok, open, ms } from './lib.mjs';

const MARK = (n) => 'window.__xss=' + n;
const IMG = (n) => '<img src=x onerror="' + MARK(n) + '">';
const HOSTILE = `
  const W = window.WISE_ACRES;
  W.notice = ${JSON.stringify(IMG(1) + '<script>' + MARK(2) + '</script>Closed <b>Saturday</b>')};
  W.noticeUntil = '2099-12-31';
  W.closures = ${JSON.stringify([IMG(3), '2026-10-11..<img>'])};
  W.reviews = [
    { quote: ${JSON.stringify(IMG(4))}, name: ${JSON.stringify('<script>' + MARK(5) + '</script>Sam')}, source: ${JSON.stringify('<i>Google</i>')}, url: 'javascript:${MARK(6)}', date: ${JSON.stringify(IMG(7))}, lang: ${JSON.stringify('" onclick="' + MARK(8))} },
    { quote: 'Great', name: 'Pat', source: 'Facebook', url: 'data:text/html,<script>${MARK(9)}</script>' },
    { quote: 'Fine', name: 'Lee', source: 'Yelp', url: 'https://www.yelp.com/biz/example' },
  ];
  W.reviewUrl = 'javascript:${MARK(10)}';
  W.signup = { action: 'javascript:${MARK(11)}', interests: { x: ${JSON.stringify(IMG(12))} }, tags: ${JSON.stringify(IMG(13))}, languageField: ${JSON.stringify('x"><script>' + MARK(14) + '</script>')} };
  W.community = [ { src: 'javascript:${MARK(15)}', alt: ${JSON.stringify(IMG(16))}, by: ${JSON.stringify(IMG(17))}, url: 'javascript:${MARK(18)}' }, { src: 'https://evil.example/pixel.png', alt: 'x', by: 'y', url: 'https://evil.example/' } ];
  W.entrancePhoto = { src: 'javascript:${MARK(19)}', alt: ${JSON.stringify(IMG(20))}, caption: ${JSON.stringify(IMG(21))} };
  W.photos = (W.photos || []).concat([{ src: 'javascript:${MARK(22)}', alt: ${JSON.stringify(IMG(23))}, caption: ${JSON.stringify(IMG(24))}, tags: [${JSON.stringify('<x onclick="' + MARK(25) + '">')}] }]);
  W.week = { updated: '2026-10-02', note: ${JSON.stringify(IMG(26))}, expireDays: 30, crops: { tomatoes: ${JSON.stringify(IMG(27))}, ${JSON.stringify(IMG(28))}: 'peak' }, days: [ { date: '2026-10-03', farm: ${JSON.stringify(IMG(29))}, pizza: 'open', note: ${JSON.stringify(IMG(30))} } ], waitlistEmail: 'a@b.co?bcc=evil@example.com', feed: 'javascript:${MARK(31)}' };
  W.hours = { greenhouse: { days: ['x'], open: ${JSON.stringify(IMG(32))}, close: '20:00' }, pizza: { days: [5], open: '16:00', close: ${JSON.stringify(IMG(33))} }, farm: { fall: [${JSON.stringify(IMG(34))}] } };
  W.analytics = { provider: 'plausible', site: ${JSON.stringify('x"><script>' + MARK(35) + '</script>')}, src: 'javascript:${MARK(36)}' };
  W.farmPoint = { lat: ${JSON.stringify(IMG(37))}, lon: 'x' };
`;

/** What a visitor's page ended up with: any marker, pop-up, element made from hostile words, link that could run code, link without noopener. */
const look = (p) => p.evaluate(() => {
  const bad = [];
  document.querySelectorAll('[onerror],[onclick],[onload],[onmouseover]').forEach((e) => { if (/__xss/.test(e.outerHTML)) bad.push('handler: ' + e.tagName); });
  document.querySelectorAll('img[src="x"], iframe, object, embed').forEach((e) => bad.push('element: ' + e.tagName));
  const js = Array.from(document.querySelectorAll('a[href], area[href], form[action], iframe[src], script[src], link[href]'))
    .filter((e) => /^\s*(javascript|data|vbscript):/i.test(e.getAttribute('href') || e.getAttribute('action') || e.getAttribute('src') || '')).map((e) => e.tagName + ' ' + (e.getAttribute('href') || e.getAttribute('action') || e.getAttribute('src')).slice(0, 40));
  const blank = Array.from(document.querySelectorAll('a[target="_blank"]')).filter((a) => !/\bnoopener\b/i.test(a.rel)).map((a) => (a.getAttribute('href') || '').slice(0, 50));
  const box = document.getElementById('wa-problems');
  return {
    marker: window.__xss === undefined ? null : window.__xss,
    handler: bad, jsLinks: js, noNoopener: blank,
    boxElements: box ? box.querySelectorAll('img, script, b, i, iframe').length : 0,
    boxText: box ? box.textContent : '',
    noticeElements: document.querySelectorAll('#site-notice img, #site-notice script, #site-notice b').length,
    noticeText: (document.querySelector('#site-notice') || {}).textContent || '',
    reviewLinks: Array.from(document.querySelectorAll('#review-grid a')).map((a) => a.getAttribute('href')),
    reviewText: (document.getElementById('review-grid') || {}).textContent || '',
    signupHidden: !!(document.querySelector('[data-signup]') && document.querySelector('[data-signup]').hidden),
    scripts: Array.from(document.scripts).map((s) => s.src).filter((s) => s && !s.startsWith(location.origin)),
  };
});

await run('owner-input', async ({ browser, base, errs }) => {
  const seen = [];   // every request to the pretend hostile site, and every pop-up
  const dialogs = [];
  const watch = async (p) => {
    await p.route(/^https?:\/\/evil\.example\//, (r) => { seen.push(r.request().url()); r.abort(); });
    p.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });
  };
  const views = {};
  for (const [name, url, opts] of [
    ['home', 'index.html', {}], ['home in Spanish', 'index.html', { lang: 'es' }], ['home with the Site check box', 'index.html', { query: 'check' }],
    ['first-visit page', 'first-visit.html', {}], ['first-visit page with the Site check box', 'first-visit.html', { query: 'check' }],
  ]) {
    const p = await open(browser, base, url, errs, { extra: HOSTILE, routes: watch, ...opts });
    await p.waitForTimeout(ms(800));
    views[name] = await look(p);
    await p.context().close();
  }
  const all = Object.entries(views);
  ok('no hostile snippet ran: the marker was never set, in any of the 5 views', all.every(([, v]) => v.marker === null), all.map(([n, v]) => n + '=' + v.marker).filter((x) => !/=null$/.test(x)).join(', '));
  ok('no pop-up opened', dialogs.length === 0, dialogs.join(' | '));
  ok('no element was made from the hostile words (no picture, no frame, no handler attribute)', all.every(([, v]) => v.handler.length === 0), all.map(([n, v]) => v.handler.length ? n + ': ' + v.handler.join(', ') : '').filter(Boolean).join(' | '));
  ok('no link, form or script has a javascript:, data: or vbscript: address', all.every(([, v]) => v.jsLinks.length === 0), all.map(([n, v]) => v.jsLinks.length ? n + ': ' + v.jsLinks.join(', ') : '').filter(Boolean).join(' | '));
  ok('every link that opens a new tab says noopener', all.every(([, v]) => v.noNoopener.length === 0), all.map(([n, v]) => v.noNoopener.length ? n + ': ' + v.noNoopener.join(', ') : '').filter(Boolean).join(' | '));
  const home = views.home;
  ok('the notice bar shows the words as text (the <img> and <b> are written out, not made)', home.noticeElements === 0 && /<img src=x onerror/.test(home.noticeText) && /Closed <b>Saturday<\/b>/.test(home.noticeText), home.noticeText.slice(0, 120));
  ok('reviews: the hostile quote and name are text; only the https:// review has a link (javascript: and data: addresses do not)', JSON.stringify(home.reviewLinks) === JSON.stringify(['https://www.yelp.com/biz/example']) && /<img src=x/.test(home.reviewText), JSON.stringify(home.reviewLinks));
  ok('the Mailchimp form stays hidden for a javascript: address (the old signup button stays)', home.signupHidden, String(home.signupHidden));
  ok('a script address in the analytics settings that is not https:// is not loaded', home.scripts.every((s) => !/^javascript:/i.test(s)), home.scripts.join(', '));
  ok('the Site check box shows the hostile words as text, not as elements', views['home with the Site check box'].boxElements === 0 && views['home with the Site check box'].boxText.length > 50, 'elements ' + views['home with the Site check box'].boxElements + ', text ' + views['home with the Site check box'].boxText.length);
  ok('the first-visit page: the hostile entrance photo and the Site check box made no elements either', views['first-visit page with the Site check box'].boxElements === 0, String(views['first-visit page with the Site check box'].boxElements));
  ok('the pretend hostile site was never asked for anything: a community photo from another site is refused, and nothing else reaches out', seen.length === 0, seen.join(' | '));
});
