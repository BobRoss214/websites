#!/usr/bin/env node
/* Visitors who do not use the site the way most people do. Three walks, each prints a short table (nothing is written, nothing is sent anywhere):
 *
 *   node tools/visitor_walk.mjs keys      a visitor with a keyboard and no mouse: how many key presses reach each job (Reserve, the hours, the price, pizza,
 *                                         parking in the FAQ, contact, Spanish, the school page) on a phone-sized and a desktop window, and how many Tab stops
 *                                         each page has (a long walk with Tab alone is why the menu matters)
 *   node tools/visitor_walk.mjs leaks     English left over in Chinese, Vietnamese, Hindi and Spanish: all the text, labels, picture descriptions and tab titles
 *                                         of every page, plus what the pop-ups show (photo viewer, farm map, drive time box and its errors, signup, reminder,
 *                                         calendar file, games) and the 404 page. Names that stay English in every language are not listed.
 *   node tools/visitor_walk.mjs arrive    a visitor who lands on one of the extra pages from a search result (with or without #anchor): is the answer on the
 *                                         screen, can they Reserve, switch language, get to the home page, find a price, the days, an address, an e-mail
 *
 * Needs the same things as the tests (Playwright, see tests/README.md); it starts its own web server and pins the clock to Saturday 3 October 2026 10:30
 * in New York, like the rest of the visitor checks. Add  --lang zh,vi  to choose the languages for "leaks". It is slow (a few minutes): it is a walk, not a test. */
import fs from 'node:fs';
import { startSite, launch, open } from '../tests/lib.mjs';

const NOW = '2026-10-03T10:30:00-04:00';
const EXTRA = 'window.WISE_ACRES.seasonPicker = false;';
const PHONE = { width: 390, height: 844 }, DESK = { width: 1280, height: 800 };
const cmd = process.argv[2] || '';
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
if (!['keys', 'leaks', 'arrive'].includes(cmd)) { console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n\/\*/, '')); process.exit(0); }

const site = await startSite();
const browser = await launch();
const errs = [];
const sleep = (n) => new Promise((r) => setTimeout(r, n));

/* ------------------------------------------------------------------ keys */
async function keys() {
  const active = (p) => p.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return ''; return (e.getAttribute('aria-label') || e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60); });
  const rows = [];
  for (const [vn, vp] of [['phone', PHONE], ['desktop', DESK]]) {
    const phone = vp.width < 700;
    const fresh = async () => { const p = await open(browser, site.url, 'index.html', errs, { viewport: vp, time: NOW, extra: EXTRA }); await sleep(500); return { p, n: 0 }; };
    const press = async (k, key) => { k.n++; await k.p.keyboard.press(key); await sleep(20); };
    const tabTo = async (k, re, max = 400) => { if (re.test(await active(k.p))) return true; for (let i = 0; i < max; i++) { await press(k, 'Tab'); if (re.test(await active(k.p))) return true; } return false; };
    const menu = async (k, label, viaMore) => {
      if (phone) { await tabTo(k, /^Open menu$/); await press(k, 'Enter'); }   // the focus moves into the menu by itself
      else if (viaMore) { await tabTo(k, /^More$/); await press(k, 'Enter'); }
      if (!(await tabTo(k, new RegExp('^' + label + '$')))) return false; await press(k, 'Enter'); await sleep(600); return true;
    };
    const jobs = [
      ['Reserve (top bar link)', async (k) => { await tabTo(k, /^Reserve your time$/); await press(k, 'Enter'); return true; }],
      ['skip link, then the hero Reserve button', async (k) => { await press(k, 'Tab'); await press(k, 'Enter'); return tabTo(k, /^Reserve your visit$/); }],
      ['hours: the GreenHouse section', (k) => menu(k, 'GreenHouse', false)],
      ['price: the Visit section', (k) => menu(k, 'Visit', false)],
      ['pizza section', (k) => menu(k, 'Pizza', false)],
      ['parking: FAQ "Where do I park?"', async (k) => { if (!(await menu(k, 'FAQ', true))) return false; if (!(await tabTo(k, /^Where do I park\?$/))) return false; await press(k, 'Enter'); return true; }],
      ['contact section', (k) => menu(k, 'Contact', true)],
      ['switch to Spanish', async (k) => { await tabTo(k, /^Language: English$/); await press(k, 'Enter'); await tabTo(k, /Espa/); await press(k, 'Enter'); await sleep(400); return true; }],
      ['school page (Groups, "About school field trips")', async (k) => { if (!(await menu(k, 'Groups', true))) return false; return tabTo(k, /^About school field trips$/); }],
    ];
    for (const [name, fn] of jobs) { const k = await fresh(); let found = false; try { found = await fn(k); } catch (e) { errs.push(name + ': ' + String(e.message).split('\n')[0]); } rows.push({ name, vn, keys: found ? k.n : 'not reached' }); await k.p.context().close(); }
    // Tab stops on each page, once round
    for (const pg of ['index.html', 'first-visit.html', 'pumpkin-patch.html', 'school-field-trips.html']) {
      const k = await open(browser, site.url, pg, errs, { viewport: vp, time: NOW, extra: EXTRA }); await sleep(400);
      const seen = []; let first = null;
      for (let i = 0; i < 800; i++) { await k.keyboard.press('Tab'); const id = await k.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return ''; return e.tagName + '|' + (e.id || (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30)) ; }); if (!id) continue; if (first === null) first = id; else if (id === first) break; seen.push(id); }   // the place on the page is left out of the id: the page has scrolled when the walk comes round again
      rows.push({ name: 'Tab stops on ' + pg, vn, keys: seen.length }); await k.context().close();
    }
  }
  console.log('\nKey presses (Tab, Enter and the other keys together) from a fresh page:\n');
  for (const r of rows) console.log(String(r.keys).padStart(10) + '  ' + r.vn.padEnd(8) + r.name);
}

/* ------------------------------------------------------------------ leaks */
async function leaks() {
  const LANGS = (arg('lang', 'es,zh,vi,hi')).split(',');
  const PAGES = ['index.html', 'first-visit.html', 'pumpkin-patch.html', 'strawberry-picking.html', 'school-field-trips.html', 'wise-pie.html'];
  const OPT = `WISE_ACRES.seasonPicker = true; WISE_ACRES.signup.demo = true; WISE_ACRES.reviewUrl = 'https://g.page/r/example/review';`;
  const COLLECT = () => {
    const out = [];
    const skip = (e) => !e || ['SCRIPT', 'STYLE', 'TEMPLATE'].includes(e.tagName) || e.closest('svg:not([role=img])') || e.closest('#sprite');
    const w = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) { const e = n.parentElement; if (skip(e) || e.closest('[lang=en]')) continue; const t = n.data.replace(/\s+/g, ' ').trim(); if (t) out.push(t); }
    for (const e of document.querySelectorAll('*')) { if (skip(e) || e.closest('[lang=en]')) continue; for (const a of ['alt', 'aria-label', 'title', 'placeholder']) { const v = e.getAttribute(a); if (v && v.trim()) out.push(v.replace(/\s+/g, ' ').trim()); } }
    out.push(document.title); for (const m of document.querySelectorAll('meta[name=description], meta[property="og:title"], meta[property="og:description"], meta[property="og:image:alt"]')) out.push(m.content);
    return out;
  };
  const states = async (p, lang) => {   // the pop-ups: what they add to the page
    const all = new Map();
    const take = async (name) => { for (const t of await p.evaluate(COLLECT)) if (!all.has(t)) all.set(t, name); };
    await take('page');
    const tryDo = async (name, fn) => { try { await fn(); await sleep(350); await take(name); } catch (e) { /* the pop-up is not on this page */ } };
    await tryDo('language menu', () => p.click('.lang-btn'));
    await p.keyboard.press('Escape').catch(() => {});
    await tryDo('photo viewer', async () => { await p.locator('#gallery-grid button, #gallery-grid a').first().scrollIntoViewIfNeeded(); await p.locator('#gallery-grid button, #gallery-grid a').first().click(); });
    await p.keyboard.press('Escape').catch(() => {});
    await tryDo('farm map', async () => { const b = p.locator('.map-legend button').nth(2); await b.scrollIntoViewIfNeeded(); await b.click(); });
    for (const [name, text] of [['drive time: empty', ''], ['drive time: answer', '100 Main Street Monroe NC']]) await tryDo(name, async () => { await p.locator('#drive-form').scrollIntoViewIfNeeded(); await p.fill('#drive-addr', text); await p.click('#drive-form button[type=submit]'); await p.waitForFunction(() => { const r = document.querySelector('#drive-result'); return r && (r.getAttribute('data-kind') || r.textContent.trim()); }, null, { timeout: 8000 }); });
    await tryDo('signup: empty', async () => { await p.locator('#signup').scrollIntoViewIfNeeded(); await p.fill('#su-email', ''); await p.click('#signup button[type=submit]'); });
    await tryDo('signup: bad address', async () => { await p.fill('#su-email', 'nobody'); await p.click('#signup button[type=submit]'); });
    await tryDo('signup: good address', async () => { await p.fill('#su-email', 'someone@example.com'); await p.click('#signup button[type=submit]'); });
    await tryDo('reminder menu', async () => { const b = p.locator('[data-rel-remind]'); await b.scrollIntoViewIfNeeded(); await b.click(); });
    try { const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 6000 }), p.click('[data-rel-ics]')]); for (const l of fs.readFileSync(await dl.path(), 'utf8').split('\r\n').filter((x) => /^(SUMMARY|DESCRIPTION):/.test(x))) all.set(l.replace(/^[A-Z]+:/, ''), 'calendar file'); } catch (e) { /* no reminder box */ }
    await tryDo('season picker', async () => { await p.locator('.picker button').last().scrollIntoViewIfNeeded(); await p.locator('.picker button').last().click(); });
    await tryDo('game, friend', async () => { await p.evaluate(() => scrollTo(0, 0)); for (let i = 0; i < 12; i++) await p.click('#pick-btn'); for (let i = 0; i < 4; i++) await p.click('#npc-btn'); });
    return all;
  };
  const english = new Set();   // every text the English pages and pop-ups show
  const cache = {};
  const gather = async (lang) => {
    const found = new Map();
    for (const pg of PAGES) {
      const p = await open(browser, site.url, pg, errs, { viewport: pg === 'index.html' ? PHONE : DESK, touch: pg === 'index.html', lang: lang === 'en' ? undefined : lang, time: NOW, extra: EXTRA + OPT });
      await sleep(600); await p.evaluate(() => document.querySelectorAll('.reveal').forEach((e) => e.classList.add('in')));
      const m = pg === 'index.html' ? await states(p, lang) : new Map((await p.evaluate(COLLECT)).map((t) => [t, 'page']));
      for (const [t, s] of m) if (!found.has(t)) found.set(t, pg.replace('.html', '') + ' / ' + s);
      await p.context().close();
    }
    const p4 = await open(browser, site.url, '404.html', errs, { viewport: PHONE, lang: lang === 'en' ? undefined : lang, time: NOW, ready: false });
    await sleep(700); for (const t of await p4.evaluate(COLLECT)) if (!found.has(t)) found.set(t, '404 page'); await p4.context().close();
    return found;
  };
  for (const [t] of await gather('en')) english.add(t);
  const NAMES = /Wise Acres|Wise Pie|The GreenHouse|GreenHouse|Indian Trail|USDA|Hartis|Poplin|Instagram|Facebook|Google|Apple Pay|Apple Maps|Apple|Maps|Waze|Tripadvisor|Yelp|OpenStreetMap|Mailchimp|Axios|Charlotte|Waxhaw|Creamery|Follow Your Heart|Wholly Wholesome|Cathy|Vanessa|Pranee|Ava|Bloomin_at_wiseacres|Foster Village|Stallings|Matthews|Mint Hill|Monroe|Jasper|Sakura|Beefsteak|Black Krim|Green Zebra|Red Zebra|Sweet Basil|Red Rubin|Honey Bee|Black Cherry|Brown Berry|Camp Joy|White Cherry|Halfzies|Margherita|Pepperoni|Ricotta Pie|Dill Pickle|Bee Keeper|Farmer Cathy|NC|Rd|Road|Organic Farm|Español|Tiếng Việt/g;
  const bare = (t) => t.replace(/\S+@\S+|https?:\/\/\S+|[#@]\w+/g, ' ').replace(NAMES, ' ');
  for (const lang of LANGS) {
    const found = await gather(lang); cache[lang] = found;
  }
  // a text is a suspect when it is identical to an English text (2 or more words) in this language but NOT in every language (names are identical everywhere)
  const everywhere = (t) => LANGS.every((l) => cache[l].has(t));
  for (const lang of LANGS) {
    const sus = [];
    for (const [t, where] of cache[lang]) {
      const letters = bare(t).match(/[A-Za-z][A-Za-z’']{2,}/g) || [];
      const nonLatin = lang === 'zh' || lang === 'hi';
      const same = english.has(t) && letters.length >= 2 && !everywhere(t);
      const mixed = nonLatin && letters.length >= 1;
      if (same || mixed) sus.push([where, t.slice(0, 110)]);
    }
    console.log(`\n== ${lang}: ${sus.length} texts to look at (a quoted English sentence from a photo or from the booking e-mail is fine)`);
    for (const [w, t] of sus.slice(0, 80)) console.log('  ' + w.padEnd(34) + t);
  }
}

/* ------------------------------------------------------------------ arrive */
async function arrive() {
  const ARR = ['first-visit.html#parking', 'first-visit.html#strollers', 'first-visit.html#dogs', 'pumpkin-patch.html', 'strawberry-picking.html', 'school-field-trips.html', 'wise-pie.html'];
  const FACT = { reserve: /bookeo\.com|Reserve/, price: /\$\s?\d/, days: /thursday|friday|saturday|sunday/i, hours: /\b(?!11:59)\d{1,2}(:\d\d)? ?(am|pm)\b/i, address: /4701 Hartis|5503 Poplin/, email: /@wiseacresorganic\.com/, phone: /\b704[-. )]*\d{3}[-. ]\d{4}/ };
  console.log('\n(Y = on the screen the visitor lands on; a number = screens further down; - = not on the page)\n');
  console.log('page'.padEnd(34) + 'view'.padEnd(9) + 'h1  ' + Object.keys(FACT).map((k) => k.padEnd(8)).join('') + 'language home');
  for (const url of ARR) for (const [vn, vp] of [['phone', PHONE], ['desktop', DESK]]) {
    const p = await open(browser, site.url, url, errs, { viewport: vp, touch: vn === 'phone', time: NOW, extra: EXTRA });
    await sleep(1500);   // the jump to the anchor has finished
    const r = await p.evaluate((F) => {
      const vh = innerHeight; const inView = (e) => { if (!e) return false; const q = e.getBoundingClientRect(); return q.width > 0 && q.bottom > 0 && q.top < vh; };
      const fixedBar = document.querySelector('nav.action-bar'); const bar = fixedBar && getComputedStyle(fixedBar).display !== 'none';
      const res = {};
      for (const [k, [src, fl]] of Object.entries(F)) { const re = new RegExp(src, fl); const els = Array.from(document.querySelectorAll('main *, footer *, .site-header *, nav.action-bar *')).filter((e) => (!e.children.length || e.tagName === 'A') && (re.test(e.textContent) || re.test(e.getAttribute('href') || '')) && getComputedStyle(e).display !== 'none'); const on = els.find(inView) || (k === 'reserve' && bar ? fixedBar : null); res[k] = on ? 'Y' : els.length ? String(Math.round(Math.abs(els[0].getBoundingClientRect().top) / vh * 10) / 10) : '-'; }
      const lb = document.querySelector('.lang-btn'), br = document.querySelector('a.brand');
      return { res, h1: inView(document.querySelector('h1')), lang: inView(lb), home: !!br };
    }, Object.fromEntries(Object.entries(FACT).map(([k, v]) => [k, [v.source, v.flags]])));
    console.log(url.padEnd(34) + vn.padEnd(9) + (r.h1 ? 'Y   ' : '-   ') + Object.keys(FACT).map((k) => String(r.res[k]).padEnd(8)).join('') + (r.lang ? 'Y        ' : '-        ') + (r.home ? 'Y' : '-'));
    await p.context().close();
  }
}

try { await ({ keys, leaks, arrive })[cmd](); }
catch (e) { console.log('The walk stopped: ' + String(e && e.stack ? e.stack.split('\n').slice(0, 3).join(' / ') : e)); process.exitCode = 1; }
if (errs.length) console.log('\nPage errors while walking: ' + errs.slice(0, 3).join(' | '));
await browser.close(); await site.close();
