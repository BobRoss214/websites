// order: 90
// browser: yes
// quick: no
// covers: js/*, css/extras.css, css/sections.css, index.html, docs/BROWSER_INTERFERENCE.md
/* Real-world interference: visitors do not use a clean browser. Something else gets in the way, and the page must still work, quietly.
 * One short check for each kind (the full list, with what was found, is docs/BROWSER_INTERFERENCE.md):
 *   - a content blocker stops js/analytics.js (the one file name the filter lists look for), blocks every other web site, and hides boxes by their
 *     names (signup, social, banner...): the page works, no error, nothing else is contacted
 *   - the browser refuses cookies and storage (SecurityError, "storage is full", no storage at all): the language and the checklist still work
 *   - Chrome's own Translate rewrites every text node and the page language: the page's own updates and language switch still work, and the
 *     farm's names carry translate="no"
 *   - the connection drops after the page is open: language, questions, photos, the Drive time box and the email signup answer in plain words
 *   - an old or limited browser (no IntersectionObserver, ResizeObserver, dialog, replaceChildren...): menu and photo viewer still open
 *   - a hotspot or proxy that adds a banner and a script
 *   - Reader mode and "save as": with scripts off every page has its main part, one top heading and its text
 *   - browser zoom to 400% (a screen 320 px wide) and 500% (256 px): nothing runs past the right edge
 * About 40 seconds. */
import { run, ok, info, until, ms } from './lib.mjs';

const PAGES = ['index.html', 'first-visit.html', 'pumpkin-patch.html', 'school-field-trips.html', 'strawberry-picking.html', 'wise-pie.html'];
const BLOCKED = /ERR_BLOCKED_BY_CLIENT|Failed to load resource|net::ERR_/;   // what the browser itself says about a request that was stopped on purpose

const T0 = Date.now(), lap = (what) => info(`${what}: ${Math.round((Date.now() - T0) / 1000)} s so far`);
await run('interference', async ({ browser, base }) => {
  // one page with everything noted: errors, the other web sites it tried to reach, init script, extra routes
  async function open(url, o = {}) {
    const ctx = await browser.newContext({ viewport: o.viewport || { width: 1280, height: 900 }, locale: 'en-US', timezoneId: 'America/New_York', serviceWorkers: 'block', javaScriptEnabled: o.js !== false, ...(o.ctx || {}) });
    if (o.init) await ctx.addInitScript(o.init);
    const p = await ctx.newPage();
    p.setDefaultTimeout(ms(15000));
    const rec = { errors: [], outside: [], stopped: [] };
    p.on('pageerror', (e) => rec.errors.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !BLOCKED.test(m.text())) rec.errors.push('console: ' + m.text()); });
    await p.route('**/*', (route) => {
      const u = route.request().url();
      if (!u.startsWith(base) && !u.startsWith('data:') && !u.startsWith('blob:')) { rec.outside.push(u); return route.abort(); }   // no other web site is reachable here
      if (o.block && o.block(u)) { rec.stopped.push(u); return route.abort('blockedbyclient'); }
      return route.continue();
    });
    if (o.setup) await o.setup(p, ctx);
    await p.goto(base + url, { waitUntil: 'load', timeout: ms(60000) });
    if (o.js !== false) await until(p, () => !!(window.WISE_ACRES && window.WISE_ACRES.features), null, 30000);
    return { p, ctx, rec };
  }
  const pickLang = async (p, code) => { await p.evaluate((c) => window.WISE_ACRES.setLang(c), code); return until(p, (c) => document.documentElement.lang === c, code, 15000); };
  const scrollThrough = (p) => p.evaluate(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); } window.scrollTo(0, 0); });

  /* ---------------------------------------------------------------- 1. content blockers */
  {
    const HIDE = '.signup,.follow-signup,[data-signup],.social,.social-links,.gh-banner,.site-notice,.notice,.lang-offer,.float-pizza,.press,.reviews,[class*="newsletter"],[class*="popup"],[class*="banner"],[class*="promo"],[class*="share"],[class*="sponsor"],[class*="cookie"]{display:none!important}';
    for (const [name, o] of [
      ['js/analytics.js is stopped (the name filter lists look for) and every other web site is out of reach', { block: (u) => /\/js\/analytics\.js/.test(u) }],
      ['boxes with names like signup, social, banner, notice are hidden', { setup: (p) => p.addInitScript(`document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(HIDE)}; document.head.appendChild(s); });`) }],
    ]) {
      const { p, ctx, rec } = await open('first-visit.html', o);
      await scrollThrough(p);
      const h1 = await p.evaluate(() => (document.querySelector('h1') || {}).textContent || '');
      const lang = await pickLang(p, 'es');
      const faq = await p.evaluate(() => { const d = [...document.querySelectorAll('main details')].find((x) => !x.open); if (!d) return false; d.querySelector('summary').click(); return d.open; });
      ok(`blockers: ${name}: the page works (top heading, language switch, a question opens), no error, and no request tried to reach another web site during the visit (nothing for a third-party blocker to stop)`, h1.trim().length > 5 && lang && faq && !rec.errors.length && !rec.outside.length, JSON.stringify({ h1: h1.slice(0, 30), lang, faq, errors: rec.errors.slice(0, 2), outside: rec.outside.slice(0, 2) }));
      await ctx.close();
    }
  }

  /* ---------------------------------------------------------------- 2. cookies and storage refused */
  {
    const WAYS = {
      'storage refuses every use (cookies blocked: SecurityError) and is full (QuotaExceededError)': `for (const k of ['localStorage','sessionStorage']) Object.defineProperty(window, k, { get() { throw new DOMException('The operation is insecure.', 'SecurityError'); } }); Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); };`,
      'no storage at all, no indexedDB, cookies throw (an old WebView)': `for (const k of ['localStorage','sessionStorage']) Object.defineProperty(window, k, { get() { return null; } }); Object.defineProperty(window, 'indexedDB', { get() { throw new DOMException('denied', 'SecurityError'); } }); Object.defineProperty(document, 'cookie', { get() { throw new DOMException('denied', 'SecurityError'); }, set() { throw new DOMException('denied', 'SecurityError'); } });`,
    };
    for (const [name, init] of Object.entries(WAYS)) {
      const { p, ctx, rec } = await open('first-visit.html', { init });
      const lang = await pickLang(p, 'es');
      const box = p.locator('#checklist input[type=checkbox]').first();
      let ticked = false;
      if (await box.count()) { await box.scrollIntoViewIfNeeded(); await box.check(); ticked = await box.isChecked(); }
      ok(`storage: ${name}: the language changes, a checklist box can be ticked, no error`, lang && ticked && !rec.errors.length, JSON.stringify({ lang, ticked, errors: rec.errors.slice(0, 2) }));
      await ctx.close();
    }
  }

  /* ---------------------------------------------------------------- 3. the browser's own translation */
  {
    // what Chrome's Translate does: every text node becomes <font><font>translated</font></font>, <html lang> is the new language, class translated-ltr
    const SIM = `window.__translate = (lang) => { const w = document.createTreeWalker(document.body, 4); const list = []; while (w.nextNode()) list.push(w.currentNode);
      list.forEach((t) => { const p = t.parentElement; if (!p || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/.test(p.tagName) || !t.nodeValue.trim()) return;
        const a = document.createElement('font'), b = document.createElement('font'); b.textContent = '\\u00ab' + t.nodeValue + '\\u00bb'; a.appendChild(b); p.replaceChild(a, t); });
      document.documentElement.lang = lang; document.documentElement.classList.add('translated-ltr'); };`;
    const { p, ctx, rec } = await open('wise-pie.html', { init: SIM, setup: (pg) => pg.clock.install({ time: new Date('2026-10-02T11:58:00-04:00') }) });
    await p.clock.runFor(1500);
    await p.evaluate(() => window.__translate('fr'));
    const lines = () => p.evaluate(() => document.body.innerText.split('\n').map((s) => s.trim()).filter(Boolean));
    const before = await lines();
    await p.clock.runFor(5 * 60 * 1000);
    const after = await lines();
    const fresh = after.filter((l) => !before.includes(l));
    ok('translate: with the page translated by the browser, the page\'s own live texts (pizza countdown, badges) keep updating', fresh.length > 0, fresh.slice(0, 3).join(' | '));
    await p.evaluate(() => window.WISE_ACRES.setLang('hi'));
    for (let i = 0; i < 40 && (await p.evaluate(() => document.documentElement.lang)) !== 'hi'; i++) { await p.clock.runFor(200); await p.waitForTimeout(100); }
    const h1 = await p.evaluate(() => document.querySelector('h1').textContent);
    ok('translate: our own language switch still works on top of it (html lang follows, the heading is in Hindi)', (await p.evaluate(() => document.documentElement.lang)) === 'hi' && /[ऀ-ॿ]/.test(h1) && !rec.errors.length, JSON.stringify({ h1: h1.slice(0, 30), errors: rec.errors.slice(0, 2) }));
    await ctx.close();
    const es = await open('first-visit.html');
    await pickLang(es.p, 'es');
    const marks = await es.p.evaluate(() => ({ names: document.querySelectorAll('wa-en').length, noTranslate: document.querySelectorAll('wa-en[translate="no"]').length, brand: document.querySelectorAll('.brand-name[translate="no"]').length }));
    ok('translate: the farm\'s names (the logo, and every name marked in another language) carry translate="no", so a browser does not translate "Wise Acres" or "Wise Pie"', marks.names > 5 && marks.noTranslate === marks.names && marks.brand >= 2, JSON.stringify(marks));
    await es.ctx.close();
  }

  /* ---------------------------------------------------------------- 4. the connection drops after the page is open */
  {
    const { p, ctx, rec } = await open('first-visit.html');
    await scrollThrough(p);
    await ctx.setOffline(true);
    await p.evaluate(() => window.WISE_ACRES.setLang('hi'));
    await p.waitForTimeout(800);
    const stayed = await p.evaluate(() => document.documentElement.lang);
    ok('offline: asking for a language whose words cannot be fetched leaves the page as it was (English, html lang en), no error', stayed === 'en' && !rec.errors.length, stayed + ' ' + rec.errors.slice(0, 1));
    const faq = await p.evaluate(() => { const d = [...document.querySelectorAll('main details')].find((x) => !x.open); if (!d) return false; d.querySelector('summary').click(); return d.open; });
    ok('offline: a question opens', faq);
    await p.locator('#drive-form').scrollIntoViewIfNeeded();
    await p.fill('#drive-addr', '100 Main St, Monroe NC');
    await p.click('#drive-form button[type=submit]');
    const said = await until(p, () => /not working|try the Google Maps/i.test(document.querySelector('#drive-result').innerText), null, 15000);
    const busy = await p.evaluate(() => document.querySelector('#drive-form button[type=submit]').getAttribute('aria-busy'));
    ok('offline: the Drive time box says in plain words that the lookup is not working and points to the Google Maps button; the button is not left busy', said && busy !== 'true', await p.evaluate(() => document.querySelector('#drive-result').innerText.slice(0, 90)));
    await ctx.close();
    // the email signup (switched on with a Mailchimp address): blocked host, no connection, a host that never answers: a plain message and the other way in, never "Joining..." forever
    const EXTRA = `WISE_ACRES.signup = { action: 'https://wiseacres.us21.list-manage.com/subscribe/post?u=abc123&id=def456', interests: {}, tags: '', languageField: '' };`;
    {
      const s = await open('index.html', { setup: async (pg) => { await pg.route('**/js/content.js', async (r) => { const res = await r.fetch(); r.fulfill({ response: res, body: (await res.text()) + '\n' + EXTRA }); }); await pg.route('**/*list-manage.com/**', (r) => r.abort('blockedbyclient')); } });
      for (const name of ['the mail host is blocked by a content blocker', 'there is no connection']) {
        if (name.startsWith('there')) { await s.p.unroute('**/*list-manage.com/**'); await s.ctx.setOffline(true); }
        await s.p.locator('[data-signup]').scrollIntoViewIfNeeded();
        await s.p.fill('#su-email', 'visitor@example.com');
        await s.p.evaluate(() => { document.querySelector('[data-signup-msg]').textContent = ''; });
        await s.p.click('[data-signup] button[type=submit]');
        const msg = await until(s.p, () => /did not go through/.test((document.querySelector('[data-signup-msg]') || {}).textContent || ''), null, 15000);
        const fb = await s.p.evaluate(() => { const f = document.querySelector('[data-signup-fallback]'); return !!f && !f.hidden; });
        ok(`offline: signup when ${name}: it says "did not go through", shows the "Join the email list" button, and is not left busy`, msg && fb && (await s.p.evaluate(() => document.querySelector('[data-signup] button[type=submit]').getAttribute('aria-disabled'))) !== 'true', JSON.stringify({ msg, fb }));
      }
      await s.ctx.close();
    }
  }

  /* ---------------------------------------------------------------- 5. an old or limited browser, a drawing surface that is not there */
  {
    const OLD = `try { delete Element.prototype.replaceChildren; } catch (e) {} delete window.IntersectionObserver; delete window.ResizeObserver; delete window.requestIdleCallback;
      try { HTMLDialogElement.prototype.showModal = undefined; } catch (e) {} try { delete Array.prototype.at; delete Object.hasOwn; delete String.prototype.replaceAll; delete window.structuredClone; } catch (e) {}
      HTMLCanvasElement.prototype.getContext = function () { return null; }; Object.defineProperty(window, 'AudioContext', { value: undefined }); Object.defineProperty(window, 'webkitAudioContext', { value: undefined });`;
    for (const [name, ua, vp] of [
      ['an in-app browser on an old Android WebView (Chrome 80 engine)', 'Mozilla/5.0 (Linux; Android 10; SM-G960U Build/QP1A.190711.020; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/80.0.3987.162 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/300.0.0.0.0;]', { width: 390, height: 844 }],
      ['a TV browser', 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) 76.0.3809.146/6.0 TV Safari/537.36', { width: 1920, height: 1080 }],
    ]) {
      const { p, ctx, rec } = await open('pumpkin-patch.html', { init: OLD, viewport: vp, ctx: { userAgent: ua, isMobile: vp.width < 600, hasTouch: vp.width < 600 } });
      const z = p.locator('[data-zoom]:visible').first();
      let viewer = null;
      if (await z.count()) { await z.scrollIntoViewIfNeeded(); await z.click(); viewer = await until(p, () => { const l = document.querySelector('.lightbox'); return !!l && l.getBoundingClientRect().height > 0; }, null, 5000); await p.keyboard.press('Escape'); }
      const menu = vp.width < 600 ? (await p.locator('#menu-toggle').click(), await p.evaluate(() => document.querySelector('#menu-toggle').getAttribute('aria-expanded'))) : 'n/a';
      const lang = await pickLang(p, 'es');
      ok(`old browsers: ${name} (no IntersectionObserver, dialog, replaceChildren, canvas or audio): menu, photo viewer and language switch work, no error`, viewer === true && (menu === 'true' || menu === 'n/a') && lang && !rec.errors.length, JSON.stringify({ viewer, menu, lang, errors: rec.errors.slice(0, 2) }));
      await ctx.close();
    }
  }

  /* ---------------------------------------------------------------- 6. a hotspot or proxy that changes the page on its way */
  {
    const rewrite = (html) => html.replace(/<body([^>]*)>/, '<body$1><div id="portal-banner" style="position:fixed;top:0;left:0;right:0;height:56px;z-index:2147483647;background:#fc0;color:#000">Free Wi-Fi: accept the terms</div><script>window.__portal=1;var f=window.fetch;window.fetch=function(){return f.apply(this,arguments)};<\/script>').replace(/>\s+</g, '> <');
    const { p, ctx, rec } = await open('index.html', { viewport: { width: 390, height: 844 }, setup: (pg) => pg.route('**/index.html', async (r) => { const res = await r.fetch(); r.fulfill({ response: res, body: rewrite(await res.text()) }); }) });
    const there = await p.evaluate(() => !!document.querySelector('#portal-banner') && window.__portal === 1);
    await p.locator('#menu-toggle').click();
    const menu = await p.evaluate(() => document.querySelector('#menu-toggle').getAttribute('aria-expanded'));
    const lang = await pickLang(p, 'es');
    ok('proxy: a page with a banner and a script added by a hotspot, and its spaces squeezed out, still starts: menu and language switch work, no error', there && menu === 'true' && lang && !rec.errors.length, JSON.stringify({ there, menu, lang, errors: rec.errors.slice(0, 2) }));
    await ctx.close();
  }

  /* ---------------------------------------------------------------- 7. reader mode, "save page as", scripts off */
  {
    const bad = [];
    for (const pg of PAGES) {
      const { p, ctx } = await open(pg, { js: false });
      const r = await p.evaluate(() => { const m = document.querySelector('main'), txt = (e) => e.innerText.replace(/\s+/g, ' ').trim(); const hs = [...document.querySelectorAll('main h1, main h2, main h3')]; return { lang: document.documentElement.lang, h1: document.querySelectorAll('h1').length, main: !!m, text: m ? txt(m).length : 0, hidden: hs.filter((h) => getComputedStyle(h).display === 'none').length, title: document.title.length }; });
      if (!(r.lang === 'en' && r.h1 === 1 && r.main && r.text > 1500 && r.hidden === 0 && r.title > 10)) bad.push(pg + ' ' + JSON.stringify(r));
      await ctx.close();
    }
    ok('reader mode: with scripts off all 6 pages have a <main> part with its text, one top heading, no heading hidden, a title and html lang', bad.length === 0, bad.join(' | '));
  }

  /* ---------------------------------------------------------------- 8. browser zoom 400% and 500% */
  {
    const wide = async (pg, w) => {   // drawings and the flying bee come and go at the edge, so they are left out
      const { p, ctx } = await open(pg, { viewport: { width: w, height: 600 } });
      const r = await p.evaluate(() => { const vw = document.documentElement.clientWidth; const out = [...document.querySelectorAll('body *')].filter((e) => { if (e.closest('svg,#sprite,[aria-hidden="true"],.hero-scene,.bee-fly')) return false; const b = e.getBoundingClientRect(), cs = getComputedStyle(e); return b.right > vw + 1 && b.width > 0 && cs.position !== 'fixed' && cs.display !== 'none'; }).slice(0, 3).map((e) => e.tagName.toLowerCase() + '.' + String(e.className).slice(0, 20)); return { side: document.documentElement.scrollWidth - vw, out }; });
      await ctx.close(); return r;
    };
    const w320 = [], w256 = [];
    for (const pg of ['first-visit.html', 'pumpkin-patch.html', 'wise-pie.html']) { const r = await wide(pg, 320); if (r.side > 0 || r.out.length) w320.push(pg + ' ' + JSON.stringify(r)); }
    for (const pg of ['index.html', 'first-visit.html']) { const r = await wide(pg, 256); if (r.side > 0 || r.out.length) w256.push(pg + ' ' + JSON.stringify(r)); }
    ok('zoom 400% (a screen 320 px wide): on First visit, Pumpkin patch and Wise Pie nothing runs past the right edge and the page does not scroll sideways', w320.length === 0, w320.join(' | '));
    ok('zoom 500% (256 px wide): on the home page and First visit nothing runs past the right edge either', w256.length === 0, w256.join(' | '));
  }
});
