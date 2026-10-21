// order: 316
// browser: yes
// covers: index.html, pages/first-visit.html, first-visit.html, js/main.js, css/extras.css, css/features.css, tools/pages.py, lang/*
/* The short first-visit guide on the home page (index.html at id="first-visit").
 * Why it exists: in some viewers (a page shown inside another site, in a frame) a link to another page file ends on the bottom of the page, while a link to a place
 * on the same page always works. So the menu, the More list, the footer and the "First time at Wise Acres?" line go to #first-visit, and the guide is on the home page.
 * Checks, with no browser: the links, the order of the sections, every sentence is also on first-visit.html (so it is already translated and it cannot drift), the
 * extra pages still link to the real guide page. Checks with a browser: More (wide screen) and the menu button (phone) lead to the section and stay on the home page,
 * the menu closes, the right link is highlighted; the same inside a sandboxed frame from another address (a viewer like the farm's preview), in three languages. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run, ok as check1, open, startServer, ROOT, ms } from './lib.mjs';
const ok = (name, cond, detail = '') => check1(name, cond, cond ? '' : detail);   // the detail (what was seen) is printed only when a check fails

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const index = read('index.html');
const full = read('first-visit.html');

// ---------------------------------------------------------------- no browser
const a = index.indexOf('<section class="section section-tint first-visit" id="first-visit"');
const sec = a < 0 ? '' : index.slice(a, index.indexOf('</section>', a));
ok('index.html has the section id="first-visit" (once)', a >= 0 && index.split('id="first-visit"').length === 2);
ok('it has a heading and the one button to the full page at the end', /<h2[^>]*id="fv-h"/.test(sec) && sec.trimEnd().match(/<a [^>]*href="first-visit\.html"[^>]*>[^<]*Open the full first-visit guide/) !== null && (sec.match(/href="first-visit\.html"/g) || []).length === 1);

// the places that said first-visit.html now say #first-visit (the FAQ buttons keep first-visit.html#parking, #strollers, #checklist: they are not the menu)
const hrefs = (re) => [...index.matchAll(re)].map((m) => m[1]);
ok('the menu bar and the More list link to #first-visit', hrefs(/<li class="nav-first(?:-more)?"><a [^>]*href="([^"]*)"/g).join(' ') === '#first-visit #first-visit');
ok('the footer link and the "First time at Wise Acres?" line link to #first-visit', hrefs(/<li><a [^>]*href="([^"]*)">First-visit guide<\/a><\/li>/g).join(' ') === '#first-visit' && /class="first-time[^"]*">.*?<a href="#first-visit">/.test(index));
const plain = [...index.matchAll(/href="first-visit\.html"/g)].length;
ok('the only link to first-visit.html (without a place in it) on the home page is the button at the end of the guide', plain === 1, plain === 1 ? '' : plain + ' found');

// every sentence of the guide is also on the full page, word for word (the code of a text is made from its words), or one of the two named exceptions
const codes = (s) => [...s.matchAll(/data-t(?:a-[a-z-]+)?="(t[0-9a-f]{8})"/g)].map((m) => m[1]);
const fullMain = full.slice(full.indexOf('<main'), full.indexOf('</main>'));
const OWN = { t9c2ac95a: 'the name of the guide, as in the menu', t363d0898: 'the button that opens the full page' };
const mine = [...new Set(codes(sec))];
const onFull = new Set(codes(fullMain));
const drift = mine.filter((c) => !onFull.has(c) && !OWN[c]);
ok(`all ${mine.length} texts of the short guide are on first-visit.html word for word (${Object.keys(OWN).length} named exceptions)`, mine.length > 20 && drift.length === 0,
  drift.length === 0 ? '' : 'not on the full page any more: ' + drift.join(', ') + '. Somebody changed a sentence in pages/first-visit.html (or here) and not in the other place: change the same words in both, then run python3 tools/pages.py, python3 tools/i18n.py extract, python3 tools/i18n.py missing es --list');
const missing = [];
for (const lang of ['es', 'hi', 'zh', 'vi']) {
  const ui = JSON.parse(read(`lang/src/${lang}.json`)).ui || {};
  for (const c of mine) if (!ui[c]) missing.push(lang + ' ' + c);
}
ok('every text of the guide has its Spanish, Hindi, Chinese and Vietnamese translation', missing.length === 0, missing.slice(0, 8).join(', '));

// the extra pages keep the real guide page in their menus: tools/pages.py turns #first-visit back into first-visit.html
const built = ['first-visit.html', 'pumpkin-patch.html', 'strawberry-picking.html', 'school-field-trips.html', 'wise-pie.html'];
const wrong = built.filter((f) => /index\.html#first-visit/.test(read(f)) || !/<li class="nav-first"><a [^>]*href="first-visit\.html"/.test(read(f)) || !/<li class="nav-first-more"><a [^>]*href="first-visit\.html"/.test(read(f)));
ok('the five extra pages still link to first-visit.html in their menu (never to index.html#first-visit)', wrong.length === 0, wrong.join(', '));

// ---------------------------------------------------------------- browser
const settle = async (p, root) => {   // the page scrolls smoothly: wait until it has stopped
  let last = -1, still = 0;
  for (let i = 0; i < 80 && still < 4; i++) { await p.waitForTimeout(150); const y = await root.evaluate(() => Math.round(scrollY)); still = y === last ? still + 1 : 0; last = y; }
};
const state = (root) => root.evaluate(() => {
  const s = document.getElementById('first-visit');
  const r = s.getBoundingClientRect();
  const q = (sel) => document.querySelector(sel);
  const card = q('#first-visit .fact-card');
  return {
    path: location.pathname, hash: location.hash, top: Math.round(r.top), header: Math.round(q('#site-header').getBoundingClientRect().bottom),
    fromBottom: Math.round(document.documentElement.scrollHeight - scrollY - innerHeight),
    menuOpen: q('#nav').classList.contains('is-open'), moreOpen: q('.nav-more').classList.contains('is-open'), locked: document.body.classList.contains('nav-lock'),
    moreLink: q('.nav-first-more a').hasAttribute('aria-current'), barLink: q('.nav-first a').hasAttribute('aria-current'), moreBtn: q('.nav-more-btn').hasAttribute('aria-current'),
    visitLink: q('.nav a[href="#visit"]').hasAttribute('aria-current'),
    shown: getComputedStyle(card).opacity === '1' && getComputedStyle(q('#fv-h')).opacity === '1', lang: document.documentElement.lang,
    order: [...document.querySelectorAll('main > section[id]')].map((x) => x.id),
  };
});
const WIDE = { width: 1366, height: 768 }, PHONE = { width: 390, height: 800 };

async function click(p, root, wide) {
  if (wide) { await root.locator('.nav-more-btn').click(); await root.locator('.nav-first-more a').click(); }
  else { await root.locator('#menu-toggle').click(); await root.locator('.nav-first a').click(); }
  await settle(p, root);
  await p.waitForTimeout(600);   // the "reveal" fade of the cards
}

function check(label, st, wide, lang, navigations) {
  ok(`${label}: stays on the home page, the address now ends with #first-visit`, st.path.endsWith('/index.html') && st.hash === '#first-visit', st.path + st.hash);
  ok(`${label}: no other page was loaded`, navigations.every((u) => /\/index\.html/.test(u) || /\/host\.html/.test(u) || u === 'about:blank'), navigations.join(' | '));
  ok(`${label}: the guide is at the top of the screen, just under the header, not the bottom of the page`, st.top >= 0 && st.top <= st.header + 40 && st.fromBottom > 600, `top ${st.top}, header ${st.header}, ${st.fromBottom}px above the bottom`);
  ok(`${label}: the menu is closed again`, wide ? !st.moreOpen : !st.menuOpen && !st.locked, JSON.stringify({ more: st.moreOpen, menu: st.menuOpen, locked: st.locked }));
  ok(`${label}: the First-visit guide link is highlighted (${wide ? 'under More, and the More button' : 'in the phone menu'}), the Visit link is not`, st.visitLink === false && (wide ? st.moreLink && st.moreBtn : st.barLink && st.moreLink), JSON.stringify(st));
  ok(`${label}: the cards are shown (the fade-in ran)`, st.shown);
  ok(`${label}: the page is in ${lang}`, st.lang.slice(0, 2) === lang, st.lang);
}

await run('first-visit-guide', async ({ browser, base, errs }) => {
  // the section sits after the Visit section (and its map) and before Seasons, and is one of the sections the scripts walk through
  const p0 = await open(browser, base, 'index.html', errs, { time: false });
  const order = await p0.evaluate(() => [...document.querySelectorAll('main > section[id]')].map((x) => x.id));
  ok('it is a section of main between visit and seasons', order.indexOf('first-visit') > order.indexOf('visit') && order.indexOf('first-visit') < order.indexOf('seasons'), order.join(' '));
  await p0.close();

  // 1. a normal window, English
  for (const [name, vp] of [['wide', WIDE], ['phone', PHONE]]) {
    const p = await open(browser, base, 'index.html', errs, { time: false, viewport: vp, touch: name === 'phone' });
    const nav = []; p.on('framenavigated', (f) => { if (f === p.mainFrame()) nav.push(f.url()); });
    await p.addStyleTag({ content: '#wa-problems{display:none!important}' });
    await click(p, p, name === 'wide');
    check(`window ${name} en`, await state(p), name === 'wide', 'en', nav);
    await p.context().close();
  }

  // 2. inside a sandboxed frame (scripts, pop-ups and forms allowed; not the same origin) from another address, in English, Spanish and Chinese
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-host-'));
  fs.writeFileSync(path.join(dir, 'host.html'), '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;height:100%}iframe{display:block;border:0;width:100%;height:100vh}</style>'
    + '<iframe id="f" sandbox="allow-scripts allow-popups allow-forms" title="site"></iframe><script>document.getElementById("f").src = new URLSearchParams(location.search).get("src");</script>');
  const host = await startServer({ root: dir, port: 0 });
  try {
    for (const lang of ['en', 'es', 'zh']) for (const [name, vp] of [['wide', WIDE], ['phone', PHONE]]) {
      const ctx = await browser.newContext({ viewport: vp, hasTouch: name === 'phone', isMobile: false, locale: 'en-US', timezoneId: 'America/New_York' });
      const p = await ctx.newPage();
      p.setDefaultTimeout(ms(20000));
      p.on('pageerror', (e) => errs.push('frame pageerror: ' + e.message));
      const nav = []; p.on('framenavigated', (f) => nav.push(f.url()));
      await p.goto(host.url + 'host.html?src=' + encodeURIComponent(base + 'index.html?lang=' + lang));
      const frame = await (await p.waitForSelector('#f')).contentFrame();
      await frame.waitForFunction(() => !!(window.WISE_ACRES && window.WISE_ACRES.features), null, { timeout: ms(30000) });
      await p.waitForTimeout(500);
      await frame.addStyleTag({ content: '#wa-problems{display:none!important}' });
      const sandboxed = await frame.evaluate(() => { try { void window.localStorage; return false; } catch (e) { return true; } });
      ok(`frame ${name} ${lang}: the page really is in a sandbox without its own origin (storage is blocked)`, sandboxed);
      await click(p, frame, name === 'wide');
      check(`frame ${name} ${lang}`, await state(frame), name === 'wide', lang, nav);
      await ctx.close();
    }
  } finally { await host.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
