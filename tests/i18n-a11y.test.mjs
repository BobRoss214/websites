/* Screen readers and browser text in every language: the page language attribute, English names inside a translated sentence marked
 * lang="en" (and nothing else), the language button naming the current language, the tab title and description, and the text JavaScript
 * writes (the "now" tag, the menu button, the signup message) following a change of language.
 * Text direction: none of the five languages is right-to-left, so no page may set one. */
import { run, open, ok, okSoon, until, txt } from './lib.mjs';

const EXTRA = `WISE_ACRES.signup.demo = true;`;
const HTML_LANG = { en: 'en', es: 'es', hi: 'hi', zh: 'zh-Hans', vi: 'vi' };
const BUTTON = { en: 'Language: English', es: 'Idioma: Español', hi: 'भाषा: हिन्दी', zh: '语言：中文', vi: 'Ngôn ngữ: Tiếng Việt' };
const NOW = { es: 'ahora', hi: 'अभी', zh: '现在', vi: 'bây giờ' };
const MENU = { es: ['Abrir menú', 'Cerrar menú'], hi: ['मेनू खोलें', 'मेनू बंद करें'], zh: ['打开菜单', '关闭菜单'], vi: ['Mở menu', 'Đóng menu'] };

// the names the page must say in an English voice: any of them left outside a lang="en" element is a miss
const NAMES = 'Wise Acres|Wise Pie|GreenHouse|Instagram|Facebook|USDA|Indian Trail|Hartis|Poplin|Waze|Halfzies|Ricotta Pie|Dill Pickle|Bee Keeper|Farmer Cathy';
const names = (p) => p.evaluate((src) => {
  const re = new RegExp('\\b(?:' + src + ')\\b'), left = [], w = document.createTreeWalker(document.body, 4);
  while (w.nextNode()) { const n = w.currentNode, e = n.parentElement; if (e && !e.closest('script,style,noscript,svg,textarea,option,[lang="en"]') && re.test(n.nodeValue)) left.push(n.nodeValue.trim().slice(0, 60)); }
  const marked = [...document.querySelectorAll('wa-en')];
  return { left, marked: marked.length, badLang: marked.filter((e) => e.getAttribute('lang') !== 'en').length, nested: marked.filter((e) => e.querySelector('wa-en') || e.parentElement.closest('wa-en')).length };
}, NAMES);

// Do the wrappers change the layout? Measure every element that has a wrapper inside, take the wrappers out, measure again. A name inside a
// button or the top bar (flex boxes) used to open gaps there, so this looks at the boxes of the children too.
const layoutShift = async (p) => {
  let h = -1;   // let late pictures and fonts arrive first: the page height must have stopped changing
  for (let i = 0; i < 12; i++) { const now = await p.evaluate(() => document.documentElement.scrollHeight); if (now === h) break; h = now; await p.waitForTimeout(300); }
  return p.evaluate(() => {
  const wraps = [...document.querySelectorAll('wa-run, wa-en')];
  const hosts = [...new Set(wraps.map((e) => { let h = e.parentElement; while (h && /^WA-/.test(h.tagName)) h = h.parentElement; return h; }))];
  const measure = () => hosts.map((h) => { const r = h.getBoundingClientRect(); return [[r.left, r.top + scrollY, r.width, r.height], ...[...h.children].filter((c) => !/^WA-/.test(c.tagName)).map((c) => { const k = c.getBoundingClientRect(); return [k.left, k.top + scrollY, k.width, k.height]; })]; });
  const before = measure(), height = document.documentElement.scrollHeight;
  wraps.slice().reverse().forEach((e) => { if (e.isConnected) e.replaceWith(...e.childNodes); });
  hosts.forEach((h) => h.normalize());
  const after = measure(), bad = [];
  hosts.forEach((h, i) => { const a = before[i], c = after[i]; const d = a.length !== c.length ? 99 : Math.max(...a.map((r, k) => Math.max(...r.map((v, j) => Math.abs(v - c[k][j]))))); if (d > 0.6) bad.push(h.tagName + ' ' + h.textContent.trim().replace(/\s+/g, ' ').slice(0, 30) + ' (' + d.toFixed(1) + ' px)'); });
  return { hosts: hosts.length, bad, grew: document.documentElement.scrollHeight - height };
  });
};

await run('i18n-a11y', async ({ browser, base, errs }) => {
  const en = await open(browser, base, 'index.html', errs, { extra: EXTRA });
  const enTitle = await en.title();
  const enDesc = await en.evaluate(() => document.querySelector('meta[name=description]').content);
  ok('English: html lang = en, no wrapper, the button says "Language: English"', (await en.evaluate(() => document.documentElement.lang)) === 'en' && (await en.locator('wa-en').count()) === 0 && (await en.getAttribute('.lang-btn', 'aria-label')) === BUTTON.en, await en.getAttribute('.lang-btn', 'aria-label'));
  ok('no page sets a text direction (none of the languages is right to left)', await en.evaluate(() => !document.querySelector('[dir]') && getComputedStyle(document.documentElement).direction === 'ltr'));

  for (const lang of ['es', 'hi', 'zh', 'vi']) {
    for (const page of ['index.html', 'wise-pie.html', 'first-visit.html']) {
      const p = await open(browser, base, page, errs, { lang, extra: EXTRA });
      const r = await names(p);
      ok(`${lang} ${page}: farm, pizza, street and service names carry lang="en" (${r.marked} marked)`, r.left.length === 0 && r.marked > 10 && r.badLang === 0 && r.nested === 0, JSON.stringify(r.left.slice(0, 4)));
      if (page === 'index.html') {
        ok(`${lang}: html lang = ${HTML_LANG[lang]}, tab title and description are translated`, await p.evaluate(([l, t, d]) => document.documentElement.lang === l && document.title !== t && document.querySelector('meta[name=description]').content !== d, [HTML_LANG[lang], enTitle, enDesc]), await p.title());
        const label = await p.getAttribute('.lang-btn', 'aria-label');
        ok(`${lang}: the language button names the current language`, label === BUTTON[lang], label);
        ok(`${lang}: every language in the menu is written in itself and carries its own lang`, await p.evaluate(() => [...document.querySelectorAll('.lang-list [data-lang]')].every((b) => b.getAttribute('lang') === ({ en: 'en', es: 'es', hi: 'hi', zh: 'zh-Hans', vi: 'vi' })[b.dataset.lang])));
        ok(`${lang}: the menu marks the current language`, await p.evaluate((c) => document.querySelector('.lang-list [aria-checked="true"]').dataset.lang === c, lang));
        ok(`${lang}: the "now" tag on the season buttons is translated`, (await txt(p, '.ss-now')) === NOW[lang], await txt(p, '.ss-now'));

        // text written later by JavaScript is marked too, and an English quotation is left alone
        await p.evaluate(() => {
          const a = document.createElement('p'); a.id = 'probe-a'; a.textContent = 'Visit Wise Pie today'; document.body.appendChild(a);
          const b = document.createElement('p'); b.id = 'probe-b'; b.lang = 'en'; b.textContent = 'Visit Wise Pie today'; document.body.appendChild(b);
        });
        await okSoon(`${lang}: a name written by JavaScript gets lang="en"`, () => p.evaluate(() => ({ a: [...document.querySelectorAll('#probe-a wa-en')].map((e) => e.textContent), b: document.querySelectorAll('#probe-b wa-en').length })), (v) => v.a.join() === 'Wise Pie' && v.b === 0);

        // live switches
        await p.evaluate(() => WISE_ACRES.setLang('en'));
        await okSoon(`${lang}: back to English: no wrapper left in the page text, html lang = en`, () => p.evaluate(() => ({ w: document.querySelectorAll('[data-t] wa-en').length, l: document.documentElement.lang, b: document.querySelector('.lang-btn').getAttribute('aria-label'), n: document.querySelector('.ss-now').textContent })), (v) => v.w === 0 && v.l === 'en' && v.b === BUTTON.en && v.n === 'now');
        await p.evaluate((c) => WISE_ACRES.setLang(c), lang);
        await okSoon(`${lang}: and forward again`, () => p.evaluate(() => ({ w: document.querySelectorAll('[data-t] wa-en').length, l: document.documentElement.lang })), (v) => v.w > 10 && v.l === HTML_LANG[lang]);
      }
      await p.context().close();
    }

    // the wrappers leave every box where it was (a fresh page: the measuring takes the wrappers out)
    for (const [w, h, label] of [[1440, 900, ''], [390, 844, 'on a phone']]) {
      const q = await open(browser, base, 'index.html', errs, { lang, viewport: { width: w, height: h } });
      const sh = await layoutShift(q);
      ok(`${lang}: the wrappers change no box ${label || 'on the page'} (${sh.hosts} places measured)`, sh.hosts > 20 && sh.bad.length === 0 && Math.abs(sh.grew) <= 2, JSON.stringify(sh.bad.slice(0, 3)) + ' ' + sh.grew);
      await q.context().close();
    }

    // words the owner types in js/content.js: the English fallback is said with an English voice, wording written for the language is not
    for (const [name, extra, wantEn] of [
      ['English notice and entrance photo', `WISE_ACRES.notice = 'Closed Saturday for rain.'; WISE_ACRES.entrancePhoto = { src: 'assets/photos/baby-goat-under-heat-lamp.webp', alt: 'Look for the red barn', caption: 'Park by the red barn' };`, true],
      ['notice and entrance photo written for the language', `WISE_ACRES.notice = { en: 'Closed Saturday.', ${lang}: 'Cerrado.' }; WISE_ACRES.entrancePhoto = { src: 'assets/photos/baby-goat-under-heat-lamp.webp', alt: { en: 'Look for the red barn', ${lang}: 'Busca el granero' }, caption: { en: 'Park by the red barn', ${lang}: 'Estaciona junto al granero' } };`, false],
    ]) {
      const o = await open(browser, base, 'first-visit.html', errs, { lang, extra });
      const got = await o.evaluate(() => ({ notice: document.querySelector('#site-notice .sn-text') && document.querySelector('#site-notice .sn-text').getAttribute('lang'), alt: document.querySelector('[data-entrance] img').getAttribute('lang'), cap: document.querySelector('[data-entrance] figcaption').getAttribute('lang'), shown: !document.querySelector('[data-entrance]').hidden }));
      ok(`${lang}: ${name}: lang="en" ${wantEn ? 'on' : 'not on'} the owner's words`, got.shown && (got.notice === 'en') === wantEn && (got.alt === 'en') === wantEn && (got.cap === 'en') === wantEn, JSON.stringify(got));
      await o.context().close();
    }

    // the language file does not arrive (offline, blocked): the page is English and says so everywhere, and no name is marked
    {
      const f = await open(browser, base, 'index.html', errs, { lang, routes: (pg) => pg.route(`**/lang/${lang}.js`, (r) => r.abort()) });
      const got = await f.evaluate(() => ({ lang: document.documentElement.lang, btn: document.querySelector('.lang-btn').getAttribute('aria-label'), marked: document.querySelectorAll('wa-en').length, nav: document.querySelector('.nav li:first-child a').textContent.trim() }));
      ok(`${lang}: language file missing: English page, html lang = en, the button says so, no wrapper`, got.lang === 'en' && got.btn === BUTTON.en && got.marked === 0 && got.nav === 'Visit', JSON.stringify(got));
      await f.context().close();
    }

    // the signup message is worded again when the language changes
    const s = await open(browser, base, 'index.html', errs, { lang: 'en', extra: EXTRA });
    await s.locator('#signup button[type=submit]').scrollIntoViewIfNeeded();
    await s.click('#signup button[type=submit]');
    await okSoon('English signup message', () => txt(s, '[data-signup-msg]'), (v) => /does not look right/.test(v || ''));
    await s.evaluate((c) => WISE_ACRES.setLang(c), lang);
    await okSoon(`${lang}: the signup message changes language with the page`, () => txt(s, '[data-signup-msg]'), (v) => !!v && !/does not look right/.test(v) && /[^\x00-\x7f]/.test(v));   // every other language has an accent or its own script
    ok(`${lang}: the message stays a polite status`, await s.evaluate(() => { const m = document.querySelector('[data-signup-msg]'); return m.getAttribute('role') === 'status' && m.getAttribute('aria-live') === 'polite'; }));
    await s.context().close();

    // the menu button on a phone says "close" in the new language while the menu is open
    const m = await open(browser, base, 'index.html', errs, { lang: 'en', viewport: { width: 390, height: 844 } });
    await m.click('#menu-toggle');
    await m.evaluate((c) => WISE_ACRES.setLang(c), lang);
    await okSoon(`${lang}: menu open, language changed: the button still says close`, () => m.getAttribute('#menu-toggle', 'aria-label'), (v) => v === MENU[lang][1], 8000);
    await m.context().close();
  }
});
