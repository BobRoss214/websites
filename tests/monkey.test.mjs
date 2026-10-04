// order: 410
// browser: yes
// quick: no
// covers: js/*, css/*, index.html, first-visit.html, pumpkin-patch.html
/* Random use ("monkey test"): a visitor who does not follow the script. A seeded random generator taps, clicks, scrolls, types Tab, Enter, Space,
 * Escape and the arrow keys, opens and closes the menu, the language list, the photo viewer, the season picker and the games, switches the
 * calm button, pinches and zooms and turns the phone, for a fixed number of actions on a few combinations of screen, language and season.
 * After every 10 actions (and at the end) it checks what must always be true:
 *   - no error in the page or the console
 *   - the page does not scroll sideways
 *   - nothing is stuck over the screen: an open photo viewer, menu or language list closes with Escape or its own button, and after that
 *     no big fixed layer is left on top
 *   - keyboard focus is not lost into nothing (after Enter, Space or Escape on a control, something on the page still has it, unless the page was left)
 *   - no text is left blank (the top heading, the translated blocks, the names of buttons and links)
 *   - the page language (<html lang>), the language button and the season (<html data-season>) say what the page's own state says
 * The seed is printed. A failure prints the seed, the combination and the last 20 actions. To run the same thing again:
 *     WA_SEED=<seed> node tests/monkey.test.mjs          (WA_ONLY=2 runs only the 2nd combination, WA_ACTIONS=200 makes the runs longer)
 * What is the same on every run and what is not: the same seed gives the same random choices, and what moves in real time (CSS transitions, smooth
 * scrolling, sections drawn only when they are near) is switched off, the page's own timers and dice are fixed, and every combination gets a browser of
 * its own. Pictures, fonts and files still arrive when they arrive, so the page can look a little different from one run to the next, and a failure may
 * need a few runs of the same seed to show itself again. That is why the last 20 actions are printed in words: they can be repeated by hand.
 * The tests the monkey cannot do: a tap while the page is pinched in (the page is first brought back to normal size, as a visitor would let go and
 * look again), links that leave the site (not followed), real mobile browsers.
 * About 60 to 90 seconds on a computer that is not busy. */
import { run, ok, info, until, ms, launch } from './lib.mjs';

const SEED = process.env.WA_SEED ? Number(process.env.WA_SEED) >>> 0 : 20261004;
const ACTIONS = Number(process.env.WA_ACTIONS) || 60;
const EVERY = 10;
const ONLY = process.env.WA_ONLY ? Number(process.env.WA_ONLY) : 0;
const NOISE = /ERR_BLOCKED_BY_CLIENT|Failed to load resource|net::ERR_/;   // another web site cannot be reached here, on purpose

// the same random numbers for the same seed (mulberry32)
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const DATES = { spring: '2026-04-25T12:00:00-04:00', summer: '2026-06-25T12:00:00-04:00', fall: '2026-10-02T12:00:00-04:00', winter: '2026-12-10T12:00:00-05:00' };
const COMBOS = [
  { name: '390 phone, English, fall, home page', page: 'index.html', w: 390, h: 844, lang: 'en', season: 'fall', touch: true },
  { name: '390 phone, Spanish, winter, First visit', page: 'first-visit.html', w: 390, h: 844, lang: 'es', season: 'winter', touch: true },
  { name: '1280 computer, Hindi, spring, home page', page: 'index.html', w: 1280, h: 800, lang: 'hi', season: 'spring', touch: false },
  { name: '320 small phone, Chinese, summer, home page', page: 'index.html', w: 320, h: 568, lang: 'zh', season: 'summer', touch: true },
  { name: '768 tablet, Vietnamese, fall, Pumpkin patch', page: 'pumpkin-patch.html', w: 768, h: 1024, lang: 'vi', season: 'fall', touch: true },
];
const LANG_HTML = { en: 'en', es: 'es', hi: 'hi', zh: 'zh-Hans', vi: 'vi' };

// what a person could tap right now: visible, not covered, not a way off the site
const TARGETS = () => {
  const sel = 'a[href], button, summary, input, select, textarea, [role=button], [role=radio], [role=tab], [role=menuitemradio], [data-zoom], label, [tabindex]';
  const out = [], vw = innerWidth, vh = innerHeight;
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect();
    if (r.width < 6 || r.height < 6 || r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue;   // (cheap tests first: most of the page is off the screen)
    if (el.closest('[inert],[hidden]')) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.pointerEvents === 'none') continue;
    const x = Math.min(Math.max(r.left + r.width / 2, 1), vw - 2), y = Math.min(Math.max(r.top + r.height / 2, 1), vh - 2);
    const top = document.elementFromPoint(x, y);
    if (!top || !(el === top || el.contains(top) || top.contains(el))) continue;
    let page = false;
    if (el.tagName === 'A') {
      const h = el.getAttribute('href') || '';
      if (/^(mailto:|tel:|sms:|javascript:)/i.test(h) || el.target === '_blank' || el.hasAttribute('download')) continue;
      try { const u = new URL(h, location.href); if (u.origin !== location.origin) continue; page = u.pathname !== location.pathname; } catch (e) { continue; }
    }
    out.push({ x: Math.round(x), y: Math.round(y), page, lang: el.getAttribute('data-lang') || '', motion: el.hasAttribute('data-motion'), season: el.hasAttribute('data-season') || el.hasAttribute('data-fs'), zoom: el.hasAttribute('data-zoom'), offer: !!el.closest('.lang-offer'), d: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/)[0] : '') + ' "' + (el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 18) + '"' });
  }
  return out;
};

// what must be true; returns a list of plain sentences (empty = fine)
const LOOK = ({ expect: expectLang, map: LANG_HTML }) => {
  const bad = [], doc = document, W = window.WISE_ACRES || {};
  const ae = doc.activeElement;
  const zoomed = window.visualViewport && window.visualViewport.scale > 1.02;
  if (!zoomed && doc.documentElement.scrollWidth - doc.documentElement.clientWidth > 1) bad.push('the page scrolls sideways (' + (doc.documentElement.scrollWidth - doc.documentElement.clientWidth) + ' px)');
  const h1 = doc.querySelector('h1');
  if (!h1 || !h1.textContent.trim()) bad.push('the top heading is blank');
  const blank = [...doc.querySelectorAll('[data-t]')].filter((e) => { if (e.textContent.trim() || e.querySelector('img,svg,input')) return false; if (e.closest('[hidden],[aria-hidden="true"],svg,template,noscript')) return false; return getComputedStyle(e).display !== 'none'; });
  if (blank.length) bad.push(blank.length + ' translated text block(s) are blank, e.g. ' + blank[0].tagName.toLowerCase() + (blank[0].id ? '#' + blank[0].id : '') + '.' + String(blank[0].className).slice(0, 20));
  const nameless = [...doc.querySelectorAll('a[href], button')].filter((e) => { if (e.textContent.trim() || e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.getAttribute('title') || e.querySelector('img[alt]:not([alt=""])')) return false; if (e.closest('[hidden],[aria-hidden="true"],[inert],template')) return false; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return false; const r = e.getBoundingClientRect(); return r.width >= 2 && r.height >= 2; });
  if (nameless.length) bad.push(nameless.length + ' button(s) or link(s) have no name, e.g. ' + nameless[0].tagName.toLowerCase() + '.' + String(nameless[0].className).slice(0, 24));
  if (doc.documentElement.lang !== LANG_HTML[W.lang || 'en']) bad.push('html lang is "' + doc.documentElement.lang + '" but the page language is "' + W.lang + '"');
  if (expectLang && W.lang !== expectLang.lang) bad.push('the page language changed by itself: "' + expectLang.lang + '" became "' + W.lang + '"');
  const active = W.seasons && W.seasons.active;
  if (active && doc.documentElement.getAttribute('data-season') !== active) bad.push('data-season is "' + doc.documentElement.getAttribute('data-season') + '" but the season is "' + active + '"');
  const radios = [...doc.querySelectorAll('[role=radio][data-season]')].filter((b) => b.getAttribute('aria-checked') === 'true');
  if (radios.length > 1) bad.push('more than one season button is marked chosen');
  if (radios.length === 1 && active && radios[0].getAttribute('data-season') !== active) bad.push('the chosen season button says "' + radios[0].getAttribute('data-season') + '" but the season is "' + active + '"');
  const lb = doc.querySelector('.lang-btn');
  if (lb && W.lang) { const names = { en: 'English', es: 'Español', hi: 'हिन्दी', zh: '中文', vi: 'Tiếng Việt' }; if (!(lb.getAttribute('aria-label') || '').includes(names[W.lang])) bad.push('the language button does not name the page language "' + names[W.lang] + '": "' + lb.getAttribute('aria-label') + '"'); }
  return bad;
};

// something big fixed over the middle of the screen (an overlay), not the top bar or the bottom bar
const COVER = () => {
  const vw = innerWidth, vh = innerHeight, bad = [];
  for (const [fx, fy] of [[0.5, 0.5], [0.25, 0.3], [0.75, 0.3], [0.25, 0.7], [0.75, 0.7]]) {
    let el = document.elementFromPoint(Math.round(vw * fx), Math.round(vh * fy));
    for (; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' || el.tagName === 'DIALOG') { const r = el.getBoundingClientRect(); if (r.width * r.height >= 0.5 * vw * vh) { bad.push((el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 20)) + ' [class="' + String(el.className).slice(0, 40) + '", ' + cs.position + ', visibility ' + cs.visibility + ', opacity ' + cs.opacity + ', menu button expanded=' + ((document.querySelector('#menu-toggle') || { getAttribute: () => '?' }).getAttribute('aria-expanded')) + ', body class="' + document.body.className.slice(0, 30) + '"] covers ' + Math.round((100 * r.width * r.height) / (vw * vh)) + '% of the screen'); break; } }
    }
  }
  return [...new Set(bad)];
};

const opened = [];   // every browser this test started: whatever happens, none may be left running (it would keep the test from ending)
await run('monkey', async ({ browser: first, base }) => {
  info(`monkey seed ${SEED}, ${ACTIONS} actions in each of ${ONLY ? 1 : COMBOS.length} combinations (WA_SEED=${SEED} node tests/monkey.test.mjs replays it)`);
  let total = 0;
  for (let ci = 0; ci < COMBOS.length; ci++) {
    if (ONLY && ONLY !== ci + 1) continue;
    const c = COMBOS[ci];
    const r = rng((SEED + Math.imul(ci + 1, 2654435761)) >>> 0);   // each combination has its own stream, so WA_ONLY replays the same actions
    const pick = (list) => list[Math.floor(r() * list.length)];
    const log = [], problems = [], seen = { errors: [] }, tapped = [];   // (tapped: what the last taps were on)
    if (process.env.WA_TRACE) { const push = log.push.bind(log); log.push = (...a) => { console.error('   [trace] ' + a.join(' ')); return push(...a); }; }   // every action as it starts, so a hang shows where it stopped
    const browser = await launch(); opened.push(browser);   // a browser of its own for each combination: nothing that an earlier one left in memory (pictures, fonts) changes what this one sees
    const ctx = await browser.newContext({ viewport: { width: c.w, height: c.h }, locale: c.lang === 'en' ? 'en-US' : c.lang, timezoneId: 'America/New_York', isMobile: c.touch, hasTouch: c.touch, deviceScaleFactor: 1, serviceWorkers: 'block' });
    const p = await ctx.newPage();
    p.setDefaultTimeout(ms(4000));
    p.on('pageerror', (e) => seen.errors.push('page error: ' + e.message));
    ctx.on('page', (np) => { if (np !== p) { log.push('(a new window opened: ' + np.url().slice(0, 60) + ')'); np.close().catch(() => {}); } });   // a link that opens a new tab: a visitor just closes it
    p.on('close', () => { if (!seen.done) log.push('(THE PAGE WAS CLOSED)'); });
    p.on('crash', () => { seen.errors.push('the page crashed'); seen.crashed = true; });
    p.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) seen.errors.push('console: ' + m.text()); });
    await p.route('**/*', (route) => { const u = route.request().url(); return !u.startsWith(base) && !u.startsWith('data:') && !u.startsWith('blob:') ? route.abort() : route.continue(); });
    // Same seed, same run: what moves in real time (CSS transitions, smooth scrolling, a section drawn only when it is near) is switched off, and the
    // page's own timers run only when this test lets them (the fake clock). Anything else is left as it is.
    await p.addInitScript(`(() => { let s = ${(SEED + ci) >>> 0}; Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`);   // the page's own dice too
    await p.addInitScript(() => { addEventListener('click', (e) => { const t = e.target; window.__n = (window.__n || 0) + 1; window.__clicks = (window.__clicks || []).concat([(t.tagName || '?').toLowerCase() + (t.id ? '#' + t.id : '') + '.' + String(t.className).slice(0, 14) + ' "' + (t.textContent || '').trim().slice(0, 12) + '" data-lang=' + (t.closest && t.closest('[data-lang]') ? t.closest('[data-lang]').getAttribute('data-lang') : '') + ' at ' + Math.round(e.clientX) + ',' + Math.round(e.clientY)]).slice(-4); }, true); });   // (what really received the last clicks, for a failure message)
    await p.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '*,*::before,*::after{transition:none!important}html{scroll-behavior:auto!important}html.cv .cv-sec{content-visibility:visible!important}'; document.head.appendChild(st); }); });
    await p.clock.install({ time: new Date(DATES[c.season]) });
    await p.goto(base + c.page + '?lang=' + c.lang, { waitUntil: 'load', timeout: ms(60000) });
    await until(p, () => !!(window.WISE_ACRES && window.WISE_ACRES.features), null, 30000);
    await p.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await p.clock.runFor(1200);
    await p.evaluate(() => document.fonts.ready);
    await p.evaluate(() => { window.__monkey = 1; });
    const expect = { lang: c.lang };   // the language the page should be in, until an action changes it on purpose
    let w = c.w, h = c.h;
    const settle = async () => { const dt = pick([60, 150, 400]); if (process.env.WA_TRACE) console.error('   [trace] settle: clock.runFor(' + dt + ')'); await p.clock.runFor(dt); if (process.env.WA_TRACE) console.error('   [trace] settle: fonts'); await p.evaluate(() => document.fonts.ready).catch(() => {}); };   // (a font that arrives late moves the text, and so the next tap)
    const targets = () => { if (process.env.WA_TRACE) console.error('   [trace] looking for things to tap'); return p.evaluate(TARGETS); };
    const press = async (key) => { log.push('key ' + key); await p.keyboard.press(key); };
    const tapAt = async (x, y, why) => {
      tapped.push(String(why || ''));
      log.push(`${c.touch ? 'tap' : 'click'} ${x},${y} ${why || ''}`.trim());
      // what is really under the finger (a tap "anywhere" can land on a language choice too)
      const o = await p.evaluate(([px, py]) => { const e = document.elementFromPoint(px, py), l = e && e.closest('[data-lang]'); return { lang: l ? l.getAttribute('data-lang') : '', offer: !!(e && e.closest('.lang-offer')) }; }, [x, y]).catch(() => ({}));
      const n0 = await p.evaluate(() => window.__n || 0).catch(() => 0);
      if (c.touch) {
        // pinched in: the finger is on the screen and the page's numbers are in layout pixels, which do not match. A visitor lets go and looks again, so the page is
        // brought back to normal size first (a pinch stays in the run for keys and scrolling, not for the next tap)
        const k = await p.evaluate(() => (window.visualViewport ? visualViewport.scale : 1)).catch(() => 1);
        if (k > 1.02) {
          try { const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 }); await cdp.detach(); log.push('(the page is back to normal size before the tap)'); await p.clock.runFor(100); } catch (e) { log.push('(could not undo the pinch: no tap)'); return; }
          const o2 = await p.evaluate(([px, py]) => { const e = document.elementFromPoint(px, py), l = e && e.closest('[data-lang]'); return { lang: l ? l.getAttribute('data-lang') : '', offer: !!(e && e.closest('.lang-offer')) }; }, [x, y]).catch(() => ({}));
          Object.assign(o, o2);
        }
        await p.touchscreen.tap(x, y);
      } else await p.mouse.click(x, y);
      // what really got the tap (the page can move a little between looking and tapping, so the answer is taken from the click itself)
      const got = await p.evaluate((k) => ((window.__n || 0) > k ? (window.__clicks || []).slice(-1)[0] : null), n0).catch(() => null);
      const real = got ? ((/data-lang=(\w+)/.exec(got) || [])[1] || '') : '';
      if (got && (o ? o.lang || '' : '') !== real) log.push(`(the page moved under the finger: the tap landed on ${got.replace(/ at \d+,\d+$/, '')})`);
      if (real) await chose(real);   // a language choice: the page must now be in that language
      if (got && o && o.offer) {   // "Do you want this page in Vietnamese?": the answer may change the language; take the page's word for it once it has settled
        const was = expect.lang;
        for (let i = 0; i < 40; i++) { const now = await p.evaluate(() => (window.WISE_ACRES || {}).lang).catch(() => was); if (now !== was) { expect.lang = now; break; } await p.clock.runFor(100); await p.waitForTimeout(60); }
      }
    };
    const tapOne = async (filter, why) => { const t = (await targets()).filter(filter); if (!t.length) return false; const o = pick(t); await tapAt(o.x, o.y, why + ' ' + o.d); return true; };
    const quiet = async () => { await p.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {}); await p.clock.runFor(300); };   // files the page asked for have arrived, and what waited for them has run
    // the words of a language come from a file: give it a few seconds (real time), then the page must be in that language
    const chose = async (code) => {
      expect.lang = code;
      let now = null;
      for (let i = 0; i < 40; i++) { now = await p.evaluate(() => (window.WISE_ACRES || {}).lang).catch(() => code); if (now === code) { await quiet(); return; } await p.clock.runFor(100); await p.waitForTimeout(60); }
      const why = await p.evaluate(() => { const W = window.WISE_ACRES || {}; return JSON.stringify({ lang: W.lang, htmlLang: document.documentElement.lang, button: (document.querySelector('.lang-btn') || {}).textContent, dictionaries: Object.keys(W.dict || {}), checked: [...document.querySelectorAll('.lang-list [aria-checked="true"]')].map((b) => b.dataset.lang), scripts: [...document.scripts].filter((x) => /lang\//.test(x.src)).map((x) => x.src.split('/').pop()), lastClicks: window.__clicks, viewport: innerWidth + 'x' + innerHeight, scale: window.visualViewport && visualViewport.scale });  }).catch(() => '?');
      problems.push(`after action ${log.length}: a language choice "${code}" was tapped, but the page stayed in "${now}" (${why})`);
    };
    const ACTS = [
      [28, async () => { const t = (await targets()).filter((o) => !o.page || r() < 0.12); if (!t.length) return; const o = pick(t); await tapAt(o.x, o.y, o.d); }],
      [7, async () => { await tapAt(Math.round(r() * (w - 2)) + 1, Math.round(r() * (h - 2)) + 1, 'anywhere'); }],
      [12, async () => { const dy = Math.round((r() - 0.35) * 1600); log.push('scroll ' + dy); await p.evaluate((d) => window.scrollBy(0, d), dy); }],
      [16, async () => { await press(pick(['Tab', 'Tab', 'Shift+Tab', 'Enter', 'Space', 'Escape', 'Escape', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageDown', 'a', 'Backspace'])); }],
      [5, async () => { await tapOne((o) => /#menu-toggle/.test(o.d), 'menu'); }],
      [6, async () => { if (!(await tapOne((o) => /\.lang-btn/.test(o.d), 'language button'))) return; await settle(); if (r() < 0.7) await tapOne((o) => !!o.lang, 'language choice'); }],
      [6, async () => { await tapOne((o) => o.zoom, 'photo'); }],
      [6, async () => { await tapOne((o) => o.season, 'season'); }],
      [6, async () => { await tapOne((o) => /sun|friend|pick|rig|fire|goat|cup|basket|berry|tree|bee|tractor/i.test(o.d), 'game'); }],
      [3, async () => { await tapOne((o) => o.motion, 'calm'); }],
      [3, async () => { if (c.touch) { log.push('pinch zoom'); try { const cdp = await ctx.newCDPSession(p); await cdp.send('Input.synthesizePinchGesture', { x: Math.round(w / 2), y: Math.round(h / 2), scaleFactor: pick([1.6, 2.2, 0.7]), relativeSpeed: 800 }); await cdp.detach(); } catch (e) { log.push('(pinch not possible: ' + String(e.message).split('\n')[0].slice(0, 90) + ')'); } } else { const f = pick([1, 1.25, 1.5, 2, 3]); const nw = Math.max(320, Math.round(c.w / f)); log.push('browser zoom ' + f + ' (screen ' + nw + ' px)'); w = nw; h = Math.round(c.h / f); await p.setViewportSize({ width: w, height: h }); } }],
      [1, async () => { log.push('turn the phone'); [w, h] = [h, w]; await p.setViewportSize({ width: w, height: h }); }],
      [1, async () => { if ((await p.evaluate(() => history.length)) <= 2) { log.push('(nothing to go back to)'); return; } log.push('back'); await p.goBack({ waitUntil: 'commit', timeout: 3000 }).catch(() => {}); if (!p.url().startsWith(base)) { log.push('(that was before the first page: forward again)'); await p.goForward({ waitUntil: 'commit', timeout: 3000 }).catch(() => {}); } }],
    ];
    const sum = ACTS.reduce((s, a) => s + a[0], 0);
    const act = async () => { let x = r() * sum; for (const [wt, fn] of ACTS) { if ((x -= wt) < 0) return fn(); } };

    // a menu or a box that is closing is still moving, and CSS runs in real time (slowly on a busy computer): finish every running transition, then look
    const settleCss = async () => { await p.evaluate(() => document.getAnimations().forEach((a) => { if (a.constructor.name === 'CSSTransition') { try { a.finish(); } catch (e) { /* gone */ } } })); await p.clock.runFor(50); };
    const check = async (at) => {
      await p.clock.runFor(1500); await settleCss();   // the page's own waiting timers (a season change draws once after a short wait) run out first
      // 1. errors since the last look
      if (seen.errors.length) { problems.push(`after action ${at}: ${seen.errors.slice(0, 2).join(' | ')}`); seen.errors.length = 0; }
      // 2. closable overlays: what is open must close with Escape (one box at a time: a language list inside the open menu closes first) or with its own button
      const OPEN = () => {
        const out = [], d = document.querySelector('dialog[open], .lightbox.lb-fallback'), t = document.querySelector('#menu-toggle'), l = document.querySelector('.lang-list');
        if (d && d.getBoundingClientRect().height > 0) out.push('the photo viewer');
        if (t && t.getAttribute('aria-expanded') === 'true') out.push('the menu');
        if (l && !l.hidden) out.push('the language list');
        return out;
      };
      const CLOSE_BUTTONS = () => { for (const q of ['.lightbox-close', '#menu-toggle[aria-expanded="true"]', '.lang-btn[aria-expanded="true"]']) { const b = document.querySelector(q); if (b) b.click(); } };
      let open = await p.evaluate(OPEN);
      for (let i = 0; i < 4 && open.length; i++) { log.push('(check) Escape on ' + open.join(' and ')); await p.keyboard.press('Escape'); await p.clock.runFor(300); await settleCss(); open = await p.evaluate(OPEN); }
      if (open.length) {
        const where = await p.evaluate(() => { const a = document.activeElement; return a ? a.tagName.toLowerCase() + (a.id ? '#' + a.id : '') + '.' + String(a.className).slice(0, 20) : 'nothing'; });
        log.push('(check) close buttons of ' + open.join(' and ') + ' (keyboard focus is on ' + where + ')');
        await p.evaluate(CLOSE_BUTTONS); await p.clock.runFor(300); await settleCss();
        problems.push(`after action ${at}: ${open.join(' and ')} did not close with Escape (pressed 4 times)` + ((await p.evaluate(OPEN)).length ? ' or with its own button' : ' (its own button closed it)'));
      }
      const covered = await p.evaluate(COVER);
      if (covered.length) problems.push(`after action ${at}: something is left on top of the page: ${covered.join('; ')}`);
      // 3. the page's own state
      const bad = await p.evaluate(LOOK, { expect, map: LANG_HTML });
      if (bad.length) problems.push(`after action ${at}: ${bad.slice(0, 3).join('; ')}`);
    };

    let n = 0, skipped = 0;
    try {
      for (; n < ACTIONS && !problems.length; n++) {
        const url0 = p.url();
        const focusBefore = await p.evaluate(() => { const a = document.activeElement; return a && a !== document.body && a !== document.documentElement ? { lang: a.getAttribute('data-lang') || '', anchor: a.tagName === 'A' && /^#/.test(a.getAttribute('href') || ''), tag: a.tagName.toLowerCase() + (a.id ? '#' + a.id : '') + '.' + String(a.className).slice(0, 18), vis: a.isConnected && (a.checkVisibility ? a.checkVisibility() : a.getBoundingClientRect().width > 0) } : null; }).catch(() => null);
        const before = log.length;
        // a page that stops answering (a timer that sets itself again at once, a loop that never ends) must not hang the test: 60 seconds for one action is a failure
        let hung = false;
        let timer; const watchdog = new Promise((res) => { timer = setTimeout(() => { hung = true; res(); }, ms(60000)); });
        try { await Promise.race([(async () => { await act(); await settle(); })(), watchdog]); clearTimeout(timer); if (hung) { problems.push(`action ${n + 1} did not finish in 60 seconds: the page stopped answering`); break; } if (process.env.WA_VERBOSE) log.push('   [state] ' + JSON.stringify(await p.evaluate(() => { const h = document.querySelector('#site-header'), n = document.querySelector('#nav'); return { y: Math.round(scrollY), h: document.documentElement.scrollHeight, hb: h ? Math.round(h.getBoundingClientRect().bottom) : null, nt: n ? Math.round(n.getBoundingClientRect().top) : null, lang: (window.WISE_ACRES || {}).lang, season: document.documentElement.dataset.season, menu: (document.querySelector('#menu-toggle') || { getAttribute: () => null }).getAttribute('aria-expanded'), fonts: document.fonts.size, imgs: [...document.images].filter((i) => i.complete).length }; }))); } catch (e) { skipped++; log.push('(skipped: ' + String(e.message).split('\n')[0].slice(0, 70) + ')'); }
        // a link to another page was followed (a new document): wait for its scripts; a language asked for only with ?lang= is not kept by the next page (docs/WHAT_THE_SITE_STORES.md), so the page's own language is the new starting point
        if (!(await p.evaluate(() => window.__monkey === 1).catch(() => false))) {
          log.push('(new page ' + p.url().replace(base, '/') + ')');
          await until(p, () => !!(window.WISE_ACRES && window.WISE_ACRES.features), null, 20000);
          await quiet(); await p.clock.runFor(900);
          await p.evaluate(() => { window.__monkey = 1; });
          expect.lang = await p.evaluate(() => (window.WISE_ACRES || {}).lang);
        }
        // a key on the focused language choice changes the language too
        if (focusBefore && focusBefore.lang && /^key (Enter|Space)/.test(log.slice(before).join(' '))) await chose(focusBefore.lang);
        // focus: after Enter, Space or Escape on a control, it must not end up on nothing (unless the page was left)
        const k = log.slice(before).find((s) => /^key (Enter|Space|Escape)/.test(s));
        if (k && focusBefore && focusBefore.vis && !focusBefore.anchor && p.url() === url0 &&   // (a link to a place on this page: the browser starts the next Tab at that place, which is what a visitor wants)
         !tapped.slice(-3).some((d) => d.includes(focusBefore.tag.slice(0, Math.min(focusBefore.tag.length, 16))))) {   // (a control a finger tapped a moment ago that then hid itself, such as "Back to top": a finger, not a key, took it away)   // (a control that was already hidden by an earlier action has lost the focus then, not now)
          const lost = await p.evaluate(() => { const a = document.activeElement; return !a || a === document.body || a === document.documentElement; }).catch(() => false);
          if (lost) problems.push(`after action ${n + 1}: keyboard focus was on ${focusBefore.tag} and is on nothing after "${k}"`);
        }
        if ((n + 1) % EVERY === 0) await check(n + 1);
      }
      if (!problems.length) await check(n);
    } catch (e) {   // the test could not go on: a page that crashed or was closed under it is a failure to report (with the actions that led there), never a hang
      problems.push(`the test could not go on after action ${n + 1}: ${String(e.message).split('\n')[0].slice(0, 120)}` + (seen.crashed ? ' (the page crashed)' : '') + (p.isClosed() ? ' (the page was closed)' : ''));
    }
    total += n;
    const last = log.slice(-20).map((s, i) => `   ${log.length - Math.min(20, log.length) + i + 1}. ${s}`).join('\n');
    ok(`monkey: ${c.name}: ${n} actions (${skipped} skipped), every check holds`, problems.length === 0, problems.length ? `${problems[0]}\n   seed ${SEED}, combination ${ci + 1} (${c.name}); replay: WA_SEED=${SEED} WA_ONLY=${ci + 1} node tests/monkey.test.mjs\n   the last 20 actions:\n${last}` : '');
    seen.done = true;
    if (process.env.WA_VERBOSE) console.log(`   every action of combination ${ci + 1}:\n` + log.map((x, i) => `   ${i + 1}. ${x}`).join('\n'));
    await Promise.race([browser.close().catch(() => {}), new Promise((res) => setTimeout(res, 8000))]);   // (a page that hung may not close politely)
  }
  info(`${total} random actions in all`);
});
await Promise.all(opened.map((b) => Promise.race([b.close().catch(() => {}), new Promise((res) => setTimeout(res, 8000))])));
