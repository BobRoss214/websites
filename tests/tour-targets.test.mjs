// order: 96
// browser: yes
// quick: no
// covers: js/tour-steps*.js, index.html, first-visit.html, tools/plain_words.txt
/* The words of the tour "Take a tour" (js/tour-steps.js, js/tour-steps-b.js, js/tour-steps-c.js) against the real pages. The engine (js/tour.js) is NOT
 * loaded: the three steps files are read from disk and put into the page by hand, so this test says if the WORDS and the TARGETS are right even when the
 * engine is broken or missing.
 *
 *   Words (no browser needed for these): every step has the fields the engine reads and no other, an id and an order that nobody else has (order is
 *   chapter * 100 + the place in the chapter), a chapter that has a title, a page the site has, a title of 9 words at most, a text of 45 words at most
 *   with no sentence over 25 words (a line that starts with "- " is a bullet line and counts as its own sentence), no web address, e-mail address, year,
 *   markup, "Kathy" or jargon word from tools/plain_words.txt, and every dollar amount in a text is an amount that the site's own pages show (a price is
 *   never invented).
 *   Targets (a browser): the steps are walked in order, the way the engine walks them, in ONE browser context per window size: on the page the step names
 *   (the pretend-demo pages only when their files exist, and with ?demo), before() is run (with an EMPTY object: it must never read what the engine hands
 *   it), the page is let to settle, the first visible match of the target must be there (a box that hides itself by date says skipIfMissing: true and is
 *   listed here, not failed), it is scrolled into view and must be fully drawn (a box that is still fading in does not count), have a size and show
 *   something; for a step that lets the owners click, a click on another tab or season button is tried; a button of the lit part that opens a list (aria-controls) must say
 *   aria-expanded="true" while it is open, because the tour finds and lights what it opens that way, and the parts a step names with `also` must be on the page; then after() is run
 *   and the page must be as it was before (the season, the open tab, the open menus). This is done at 1440 and at 390 px wide.
 *   The same walk without the scrolling is repeated on five other days (the real day, winter, a day when nothing is in season, spring and summer) on the
 *   home page: a target that disappears on one of those days must say skipIfMissing, because the owners may open the tour in any month.
 *   Steps with small buttons on their card (step.choices: the season walk, docs/TOUR.md): the list is asked for with no page (it must work without one), every button has a
 *   short label and words that follow the same rules as a step's (9-word title, 45-word text, no address, year, jargon or invented price), the step has an after();
 *   in the browser every button is PRESSED in turn (its run()), as an owner would: the lit box must still be on the page and show something, a Spring / Summer / Fall / Winter
 *   button must leave the whole page in that season, every phrase the card puts in double curly quotes (“...”) must be written in the lit box, the buttons must show
 *   different things, and after() must put the words of the lit box and the whole page (season, open tabs, the lines of a season, the parts that follow the clock)
 *   back as they were. A "Month day" in the card of a season must be the first or the last day of that season in js/season.js.
 *   The Store's "Prices coming soon" cards must be exactly the ones that chapters 7 and 11 name, and a number that a text quotes from the page ("Fifteen
 *   common questions") must be the page's own.
 *   WA_WORDS_ONLY=1 node tests/tour-targets.test.mjs runs only the first part (no browser, about a second); WA_TOUR_ONLY=3,ch2-game limits the walks to
 *   chapter 3 and the step ch2-game. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { run, open, ok, info, finish, settled, until, ROOT, ms } from './lib.mjs';

const FILES = ['js/tour-steps.js', 'js/tour-steps-b.js', 'js/tour-steps-c.js'];
const PAGE_FILE = { index: 'index.html', 'first-visit': 'first-visit.html', account: 'account.html', 'farm-desk': 'farm-desk.html', kitchen: 'kitchen.html' };
const DEMO_PAGES = ['account', 'farm-desk', 'kitchen'];
const FIELDS = ['id', 'order', 'chapter', 'page', 'target', 'also', 'title', 'text', 'allowClicks', 'skipIfMissing', 'before', 'after', 'choices', 'choicesLabel'];
const CHOICE_FIELDS = ['label', 'title', 'text', 'run', 'pressed'];
const SEASON_NAMES = ['spring', 'summer', 'fall', 'winter'];
const SIZES = [{ width: 1440, height: 900 }, { width: 390, height: 844 }];
const OTHER_DAYS = [
  ['2026-11-03T12:00:00-05:00', 'the real day (3 Nov 2026)'],
  ['2026-12-01T12:00:00-05:00', 'winter (Christmas trees)'],
  ['2027-02-10T12:00:00-05:00', 'a day when nothing is in season'],
  ['2027-04-20T12:00:00-04:00', 'spring'],
  ['2027-06-25T12:00:00-04:00', 'summer'],
];

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const exists = (f) => fs.existsSync(path.join(ROOT, f));
const wordsOf = (s) => String(s).trim().split(/\s+/).filter(Boolean);
const numbersAside = (t) => String(t == null ? '' : t).replace(/\d+/g, '#').replace(/\b(day|hour|minute|second)s\b/gi, '$1');
const squash = (t) => String(t).toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\s+/g, ' ').trim();   // words compared without capitals, curly quotes or odd spaces
const stripTags = (html) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#?\w+;/g, ' ');

/* ---------------------------------------------------------------- the steps files, read without a browser */
const present = FILES.filter(exists);
const missingFiles = FILES.filter((f) => !exists(f));
const win = {};
const loadErrors = [];
for (const f of present) {
  try { vm.runInNewContext(read(f), { window: win, document: {} }, { filename: f }); } catch (e) { loadErrors.push(f + ': ' + String(e && e.message).split('\n')[0]); }
}
const steps = (win.WA_TOUR_STEPS || []).slice().sort((a, b) => a.order - b.order);
const chapters = win.WA_TOUR_CHAPTERS || [];

/* ---------------------------------------------------------------- what the site's own pages say */
const SITE_PAGES = ['index.html', 'first-visit.html', 'pumpkin-patch.html', 'school-field-trips.html', 'strawberry-picking.html', 'wise-pie.html'];
const siteText = SITE_PAGES.filter(exists).map((f) => stripTags(read(f))).join(' ');
const siteAmounts = new Set((siteText.match(/\$\d[\d,]*(?:\.\d+)?/g) || []).map((a) => a.replace(/,/g, '')));
const jargon = (() => {
  if (!exists('tools/plain_words.txt')) return [];
  const out = []; let on = false;
  for (const line of read('tools/plain_words.txt').split('\n')) {
    if (/^\[/.test(line)) { on = /^\[jargon\]/.test(line); continue; }
    if (!on || /^\s*#/.test(line) || !line.includes('=')) continue;
    const w = line.split('=')[0].trim().toLowerCase();
    if (w) out.push(w);
  }
  return out;
})();

/* ---------------------------------------------------------------- the rules for the words */
function sentencesOf(text) {
  const out = [];
  for (const line of String(text).split('\n')) {
    const body = line.replace(/^\s*-\s+/, '').replace(/\bMrs\./g, 'Mrs');
    for (const s of body.split(/(?<=[.!?])\s+/)) if (s.trim()) out.push(s.trim());
  }
  return out;
}
const countWords = (text) => String(text).split('\n').reduce((n, l) => n + wordsOf(l.replace(/^\s*-\s+/, '')).length, 0);

/** The rules for the title and the text of a card (a step's own, or one that a small button of the step shows). `who` starts every message. */
function copyProblems(o, who, { needTitle, needText }) {
  const p = [];
  if (o.title === undefined ? needTitle : (typeof o.title !== 'string' || !o.title.trim())) p.push(who + 'needs a title');
  else if (typeof o.title === 'string' && wordsOf(o.title).length > 9) p.push(who + 'title has ' + wordsOf(o.title).length + ' words (9 at most)');
  if (o.text === undefined ? needText : (typeof o.text !== 'string' || !o.text.trim())) p.push(who + 'needs a text');
  else if (typeof o.text === 'string') {
    const n = countWords(o.text), raw = wordsOf(o.text).length;
    if (n > 45) p.push(who + 'text has ' + n + ' words (45 at most)');
    else if (raw > 45) p.push(who + 'text has ' + raw + ' words with the bullet dashes counted (45 at most, so a stricter counter agrees)');
    for (const sen of sentencesOf(o.text)) if (wordsOf(sen).length > 25) p.push(who + 'a sentence has ' + wordsOf(sen).length + ' words (25 at most): "' + sen.slice(0, 60) + '..."');
  }
  for (const k of ['title', 'text']) {
    const v = typeof o[k] === 'string' ? o[k] : '';
    if (/[<>]/.test(v)) p.push(who + k + ' has markup (< or >); the engine shows plain text');
    if (/https?:\/\/|www\.|\b[\w-]+\.(?:com|org|net|html)\b|\S+@\S+\.\S+/i.test(v)) p.push(who + k + ' has a web address or e-mail address (the privacy test reads every js file for those)');
    if (/\b20[0-3]\d\b/.test(v)) p.push(who + k + ' has a year (tests/time-bombs.test.mjs: no year in js files; say "this fall")');
    if (/\bkathy\b/i.test(v)) p.push(who + k + ' spells Cathy as Kathy');
    for (const j of jargon) if (new RegExp('\\b' + j.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:s|es|ed|ing)?\\b', 'i').test(v)) p.push(who + k + ' uses the word "' + j + '" (tools/plain_words.txt lists it as jargon)');
  }
  for (const a of (typeof o.text === 'string' ? o.text : '').match(/\$\d[\d,]*(?:\.\d+)?/g) || []) if (!siteAmounts.has(a.replace(/,/g, ''))) p.push(who + 'the amount ' + a + ' is not on any page of the site (never invent a price)');
  return p;
}

/** The list of small buttons of a step (step.choices is a list, or a function that gives it), asked here with no page: it must work without one. */
function choicesOf(s) {
  if (s.choices === undefined) return { list: null, problems: [] };
  let list = s.choices;
  if (typeof list === 'function') { try { list = list({}); } catch (e) { return { list: null, problems: ['choices() threw: ' + String(e && e.message).split('\n')[0]] }; } }
  if (!Array.isArray(list) || !list.length) return { list: null, problems: ['choices must be a list (or a function that gives one) with at least one entry'] };
  const problems = [];
  if (s.choicesLabel !== undefined && (typeof s.choicesLabel !== 'string' || !s.choicesLabel.trim() || wordsOf(s.choicesLabel).length > 6)) problems.push('choicesLabel must be a few words (6 at most)');
  if (typeof s.after !== 'function') problems.push('a step with choices needs an after() that puts the page back');
  const seen = new Set();
  list.forEach((c, i) => {
    const who = 'choice ' + (i + 1) + ': ';
    if (!c || typeof c !== 'object') { problems.push(who + 'must be an object'); return; }
    for (const k of Object.keys(c)) if (!CHOICE_FIELDS.includes(k)) problems.push(who + 'unknown field "' + k + '"');
    if (typeof c.label !== 'string' || !c.label.trim()) problems.push(who + 'needs a label'); else if (wordsOf(c.label).length > 2) problems.push(who + 'label has ' + wordsOf(c.label).length + ' words (2 at most: it is a small button)');
    else if (seen.has(c.label)) problems.push(who + 'the label "' + c.label + '" is used twice'); else seen.add(c.label);
    if (c.run !== undefined && typeof c.run !== 'function') problems.push(who + 'run must be a function');
    if (c.pressed !== undefined && typeof c.pressed !== 'boolean') problems.push(who + 'pressed must be true or false');
    problems.push(...copyProblems(c, who, { needTitle: false, needText: false }));
    if (c.title === undefined && c.text === undefined) problems.push(who + 'has neither a title nor a text: pressing it would change nothing on the card');
  });
  return { list, problems };
}

function wordProblems(s) {
  const p = [];
  for (const k of Object.keys(s)) if (!FIELDS.includes(k)) p.push('unknown field "' + k + '" (the engine does not read it; a typo?)');
  if (typeof s.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(s.id)) p.push('id must be a short name in small letters, digits and dashes');
  if (!Number.isInteger(s.order) || s.order < 100) p.push('order must be a whole number: chapter * 100 + the place in the chapter');
  if (!Number.isInteger(s.chapter) || !chapters.some((c) => c.n === s.chapter)) p.push('chapter ' + s.chapter + ' has no title in WA_TOUR_CHAPTERS');
  else if (Math.floor(s.order / 100) !== s.chapter) p.push('order ' + s.order + ' does not belong to chapter ' + s.chapter + ' (order = chapter * 100 + the place)');
  if (!Object.prototype.hasOwnProperty.call(PAGE_FILE, s.page)) p.push('page must be one of ' + Object.keys(PAGE_FILE).join(', '));
  if (!(s.target === null || (typeof s.target === 'string' && s.target.trim() !== ''))) p.push('target must be one CSS selector or null');
  p.push(...copyProblems(s, '', { needTitle: true, needText: true }));
  for (const k of ['allowClicks', 'skipIfMissing']) if (s[k] !== undefined && typeof s[k] !== 'boolean') p.push(k + ' must be true or false');
  if (s.also !== undefined && !((typeof s.also === 'string' && s.also.trim() !== '') || (Array.isArray(s.also) && s.also.length > 0 && s.also.every((x) => typeof x === 'string' && x.trim() !== '')))) p.push('also must be a CSS selector or a list of them');
  if (s.also !== undefined && !s.target) p.push('also needs a target (it names more parts to light with it)');
  for (const k of ['before', 'after']) if (s[k] !== undefined && typeof s[k] !== 'function') p.push(k + ' must be a function');
  p.push(...choicesOf(s).problems);
  return p;
}

/* ---------------------------------------------------------------- in the page: what a visitor can see of a target */
const IN_PAGE = `(() => {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    for (let a = el; a && a.nodeType === 1; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.display === 'none' || cs.visibility === 'hidden' || a.hidden) return false;
    }
    return true;
  };
  const opacity = (el) => { let o = 1; for (let a = el; a && a.nodeType === 1; a = a.parentElement) o *= parseFloat(getComputedStyle(a).opacity); return o; };
  const find = (sel) => { let all = []; try { all = Array.from(document.querySelectorAll(sel)); } catch (e) { return { bad: true, n: 0 }; } const el = all.find(visible) || null; return { n: all.length, el, bad: false }; };
  // the words a visitor can see; a box that is not drawn (hidden) counts as '[hidden]': the page leaves old words inside a hidden pizza countdown, which nobody sees
  const text = (sel) => { const e = document.querySelector(sel); if (!e) return null; return e.getClientRects().length ? e.innerText.replace(/\\s+/g, ' ').replace(/\\d+/g, '#').replace(/\\b(day|hour|minute|second)s\\b/gi, '$1').trim() : '[hidden]'; };   // numbers become # and 'days' become 'day' (a countdown moves on by itself)
  const snapshot = () => JSON.stringify([
    document.documentElement.getAttribute('data-season'),
    Array.from(document.querySelectorAll('[aria-expanded="true"],[aria-selected="true"],[aria-checked="true"],[aria-pressed="true"]')).map((e) => (e.id || e.className || e.tagName) + '|' + (e.getAttribute('data-season') || e.getAttribute('data-fs') || e.getAttribute('data-lang') || '')),
    !!(document.getElementById('nav') && document.getElementById('nav').classList.contains('is-open')),
    // what the season walk changes and must put back: the lines that belong to a season, and the boxes that follow the clock (their words)
    Array.from(document.querySelectorAll('[data-only],[data-out-of-season]')).map((e) => (e.hasAttribute('hidden') ? 1 : 0)).join(''),
    ['.announce [data-ann-season]', '.next-up', '#this-week', '.hero-live', '#fact-season', '[data-rel-chip]', '[data-rel-box]', '#season-tabs .now-badge:not([hidden])', '.fs-now:not([hidden])'].map(text),
    Array.from(document.querySelectorAll('.week-strip .day.today')).map((e) => e.textContent).join() + '|' + ((document.querySelector('.cal') || { style: { getPropertyValue: () => '' } }).style.getPropertyValue('--today')),
    Array.from(document.querySelectorAll('#farm-cards > li')).filter((e) => !e.hidden).length,
  ]);
  window.__tour = {
    snapshot,
    stepById: (id) => (window.WA_TOUR_STEPS || []).find((s) => s.id === id),
    start(id, which) {   // not waited for here: a hook may return a Promise that needs the page clock to move (the test moves it)
      const st = { ran: false, done: false, error: '' };
      window.__tourRun = st;
      const s = this.stepById(id);
      if (!s || typeof s[which] !== 'function') { st.done = true; return; }
      st.ran = true;
      try { Promise.resolve(s[which]({})).then(() => { st.done = true; }, (e) => { st.error = String((e && e.message) || e); st.done = true; }); }
      catch (e) { st.error = String((e && e.message) || e); st.done = true; }
    },
    probe(sel) {
      if (sel === null) return { centred: true };
      const f = find(sel);
      if (f.bad) return { bad: true };
      if (!f.el) { return { n: f.n, shown: false, why: f.n ? 'the page has ' + f.n + ' match(es) but none is visible' : 'nothing on the page matches' }; }
      const r = f.el.getBoundingClientRect();
      let inner = 1;   // the boxes inside that fade in one after the other (.reveal): the ones on the screen must all be drawn
      for (const d of (f.el.classList.contains('reveal') ? [f.el] : []).concat(Array.from(f.el.querySelectorAll('.reveal')))) {
        const rr = d.getBoundingClientRect();
        if (rr.width < 4 || rr.height < 4 || rr.bottom < 0 || rr.top > innerHeight || !visible(d)) continue;
        inner = Math.min(inner, opacity(d));
      }
      return { n: f.n, shown: true, w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), opacity: +opacity(f.el).toFixed(2), inner: +inner.toFixed(2),
        something: !!(f.el.innerText && f.el.innerText.trim() !== '') || !!f.el.querySelector('img,svg,canvas,input,button,select,textarea,a'), vh: innerHeight };
    },
    bringIntoView(sel) {
      const f = find(sel); if (!f.el) return false;
      f.el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });   // also scrolls a menu that scrolls inside itself (the phone menu)
      const r = f.el.getBoundingClientRect();
      if (r.height > innerHeight - 220) window.scrollBy({ top: r.top - 120, behavior: 'instant' });   // a tall box: its top just under the sticky header
      return true;
    },
    covered(sel) {
      const f = find(sel); if (!f.el) return '';
      const r = f.el.getBoundingClientRect();
      let top = Math.max(r.top, 0);
      const bottom = Math.min(r.bottom, innerHeight);
      if (r.bottom > 140 && top < 90) top = 90;   // a box that goes under the sticky header: look at the part below it
      const x = Math.min(innerWidth - 2, Math.max(2, r.left + r.width / 2)), y = Math.min(innerHeight - 2, Math.max(2, (top + bottom) / 2));
      const hit = document.elementFromPoint(x, y);
      if (!hit || f.el.contains(hit) || hit.contains(f.el)) return '';
      return hit.tagName.toLowerCase() + (hit.className && typeof hit.className === 'string' ? '.' + hit.className.split(' ')[0] : '');
    },
    openers(sel) {   // buttons in the lit part that open something (aria-expanded + aria-controls): the tour lights what they open and lets it be used, but only when the button says aria-expanded="true" while it is open
      const f = find(sel); if (!f.el) return { opened: 0, outside: 0, unseen: [] };
      const box = f.el.getBoundingClientRect(), res = { opened: 0, outside: 0, unseen: [] };
      const list = Array.from(f.el.querySelectorAll('[aria-expanded][aria-controls]'));
      if (f.el.matches('[aria-expanded][aria-controls]')) list.unshift(f.el);
      list.forEach((b) => {
        if (!visible(b)) return;
        const c = document.getElementById(b.getAttribute('aria-controls'));
        const name = '"' + (b.getAttribute('aria-label') || b.textContent || b.id || '?').trim().replace(/\\s+/g, ' ').slice(0, 30) + '"';
        if (!c) { res.unseen.push(name + ' says it opens #' + b.getAttribute('aria-controls') + ', which is not on the page'); return; }
        const was = b.getAttribute('aria-expanded') === 'true';
        if (!was) b.click();
        const r = c.getBoundingClientRect(), drawn = r.width > 0 && r.height > 0;
        if (drawn) {
          res.opened++;
          if (b.getAttribute('aria-expanded') !== 'true') res.unseen.push(name + ' shows #' + (c.id || '?') + ' but its aria-expanded is not "true" while it is open, so the tour would not light it');
          if (r.left < box.left - 12 || r.right > box.right + 12 || r.top < box.top - 12 || r.bottom > box.bottom + 12) res.outside++;
        }
        if (!was) b.click();
      });
      return res;
    },
    tryClick(sel) {   // what an owner may do in a step that says allowClicks: choose another season or tab
      const f = find(sel); if (!f.el) return '';
      const b = Array.from(f.el.querySelectorAll('[aria-checked="false"],[aria-selected="false"]')).find((x) => visible(x) && x.tagName === 'BUTTON');
      if (!b) return '';
      b.click();
      return (b.id || b.getAttribute('data-season') || b.textContent.trim().slice(0, 20));
    },
    parts(sel, also) { const f = find(sel); return f.el ? [f.el].concat([].concat(also || []).map((x) => find(x).el).filter(Boolean)) : []; },   // the lit box and the parts a step lights with it (also)
    boxText(sel, also) { const l = this.parts(sel, also); return l.length ? l.map((e) => e.innerText.replace(/\\s+/g, ' ').trim()).join(' ') : null; },   // what is written in the lit box now (as shown: capitals of a heading included)
    boxAll(sel, also) { const l = this.parts(sel, also); return l.length ? l.map((e) => e.textContent.replace(/\\s+/g, ' ').trim()).join(' ') : null; },   // everything written in it, also what the site's own style leaves out on a phone
    dataSeason() { return document.documentElement.getAttribute('data-season'); },
    choiceList(id) { const s = this.stepById(id); const l = typeof s.choices === 'function' ? s.choices({}) : s.choices; return l ? l.map((c) => ({ label: c.label, title: c.title, text: c.text, pressed: !!c.pressed })) : []; },
    startChoice(id, i) {   // like start(), for the run() of the small button i (a fresh list is asked for, as the engine does when the card shows)
      const st = { ran: false, done: false, error: '' };
      window.__tourRun = st;
      const s = this.stepById(id);
      const l = s ? (typeof s.choices === 'function' ? s.choices({}) : s.choices) : null;
      const c = l && l[i];
      if (!c || typeof c.run !== 'function') { st.done = true; return; }
      st.ran = true;
      try { Promise.resolve(c.run({})).then(() => { st.done = true; }, (e) => { st.error = String((e && e.message) || e); st.done = true; }); }
      catch (e) { st.error = String((e && e.message) || e); st.done = true; }
    },
    soonCards() {
      return Array.from(document.querySelectorAll('.shop-card')).filter((c) => c.querySelector('.shop-soon')).map((c) => (c.querySelector('.shop-name') || {}).textContent.trim());
    },
  };
})();`;

/* ---------------------------------------------------------------- helpers that drive the page */
async function putStepsInPage(p) {
  await p.evaluate(() => { window.WA_TOUR_STEPS = []; window.WA_TOUR_CHAPTERS = undefined; });
  for (const f of present) await p.addScriptTag({ content: read(f) });
  await p.addScriptTag({ content: IN_PAGE });
}
async function goPage(p, base, page) {
  await p.goto(base + PAGE_FILE[page] + (DEMO_PAGES.includes(page) ? '?demo' : ''), { waitUntil: 'load', timeout: ms(60000) });
  if (!DEMO_PAGES.includes(page)) await until(p, () => !!(window.WISE_ACRES && window.WISE_ACRES.features), null, 30000);
  try { await p.clock.runFor(DEMO_PAGES.includes(page) ? 1500 : 1200); } catch (e) { /* the real clock is in use */ }
  await settled(p, 300);
}
/** Runs before() or after() of a step with an EMPTY object and waits until it is over (a returned Promise too, moving the page clock meanwhile). */
async function hook(p, id, which) {   // which: 'before', 'after', or the number of a small button of the step (its run())
  await p.evaluate(([i, w]) => (typeof w === 'number' ? window.__tour.startChoice(i, w) : window.__tour.start(i, w)), [id, which]);
  const end = Date.now() + ms(12000);
  for (;;) {
    const st = await p.evaluate(() => window.__tourRun);
    if (st.done) return st;
    if (Date.now() > end) return { ran: true, done: false, error: 'it did not finish within 12 seconds' };
    try { await p.clock.runFor(250); } catch (e) { await new Promise((r) => setTimeout(r, 100)); }
  }
}
// WA_TOUR_ONLY=3,ch2-game limits the browser walks to chapter 3 and the step ch2-game (the word rules always look at every step): quick to use while writing one step
const ONLY = (process.env.WA_TOUR_ONLY || '').split(',').map((x) => x.trim()).filter(Boolean);
const wanted = (s) => !ONLY.length || ONLY.some((x) => (/^\d+$/.test(x) ? +x === s.chapter : x === s.id));
const label = (s) => String(s.order).padStart(4) + ' ' + s.id + (s.target ? '  ' + s.target : '  (card in the middle)');

/** Walks the steps in order. `full` = the real walk (scrolls, waits for the fade-in, tries clicks); otherwise the light one for other days. */
async function walk({ browser, base, errs, size, full, time, pages, tag }) {
  const list = steps.filter((s) => pages.includes(s.page) && wanted(s));
  if (!list.length) return { skipped: [], seen: 0 };
  let p = await open(browser, base, PAGE_FILE[list[0].page], errs, { viewport: size, time, query: DEMO_PAGES.includes(list[0].page) ? 'demo' : '' });
  let on = list[0].page;
  await putStepsInPage(p);
  const skipped = [];
  let bad = 0, menusChecked = 0, menusBad = 0;
  if (full) {   // the check for what a lit button opens, tried first on made-up samples: it must report the one the tour could not find and leave the others alone
    const sample = await p.evaluate(() => {
      const made = [];
      const mk = (id, inner) => { const d = document.createElement('div'); d.id = id; d.style.cssText = 'position:absolute;left:0;top:0;width:200px;height:40px'; d.innerHTML = inner; document.body.appendChild(d); made.push(d); return d; };
      const wire = (d) => { const b = d.querySelector('button'); b.addEventListener('click', () => { const o = b.getAttribute('aria-expanded') !== 'true'; b.setAttribute('aria-expanded', String(o)); document.getElementById(b.getAttribute('aria-controls')).hidden = !o; }); };
      mk('t-far', '<button type="button" aria-expanded="false" aria-controls="t-far-list">Menu</button>');   // a list that is not inside the lit part at all (the bell's)
      const far = document.createElement('ul'); far.id = 't-far-list'; far.hidden = true; far.textContent = 'x'; document.body.appendChild(far); made.push(far);
      wire(document.getElementById('t-far'));
      wire(mk('t-hang', '<button type="button" aria-expanded="false" aria-controls="t-hang-list">Menu</button><ul id="t-hang-list" hidden style="position:absolute;left:0;top:44px;width:150px;height:120px">x</ul>'));
      wire(mk('t-fit', '<button type="button" aria-expanded="false" aria-controls="t-fit-list">Menu</button><ul id="t-fit-list" hidden style="position:absolute;left:60px;top:2px;width:100px;height:30px;margin:0">x</ul>'));
      const lazy = mk('t-lazy', '<button type="button" aria-expanded="false" aria-controls="t-lazy-list">Menu</button><ul id="t-lazy-list" hidden style="position:absolute;left:0;top:44px;width:150px;height:60px">x</ul>');   // shows its list and never says aria-expanded="true"
      lazy.querySelector('button').addEventListener('click', () => { const l = document.getElementById('t-lazy-list'); l.hidden = !l.hidden; });
      const sum = (id) => { const o = window.__tour.openers('#' + id); return o.opened + '/' + o.outside + '/' + o.unseen.length; };   // opened / reaching outside / the tour cannot find it
      const r = { far: sum('t-far'), hang: sum('t-hang'), fit: sum('t-fit'), lazy: sum('t-lazy'), closedAgain: ['t-hang-list', 't-fit-list', 't-far-list', 't-lazy-list'].every((id) => document.getElementById(id).hidden) };
      made.forEach((n) => n.remove());
      return r;
    });
    ok('(tried first on made-up samples) the check for what a lit button opens finds the list that is not inside the lit part and the list that hangs out of it (both are fine: the tour lights them), reports a list that is shown without aria-expanded="true" (the tour could not find it), and closes what it opened', sample.far === '1/1/0' && sample.hang === '1/1/0' && sample.fit === '1/0/0' && sample.lazy === '1/1/1' && sample.closedAgain, JSON.stringify(sample));
  }
  const rec = (name, cond, detail) => { if (!cond) bad++; if (full || !cond) ok(name, cond, detail); };   // the light walks print only what fails, and one line at the end
  for (const s of list) {
    if (s.page !== on) { await goPage(p, base, s.page); on = s.page; await putStepsInPage(p); }
    const name = tag + '  ' + label(s);
    const site = !DEMO_PAGES.includes(s.page);   // the demo changes its own state on purpose: only the site pages are compared before and after
    const before = site ? await p.evaluate(() => window.__tour.snapshot()) : '';
    const b = await hook(p, s.id, 'before');
    if (b.error) { rec(name + ': before() ran without an error', false, b.error); continue; }
    if (b.ran) await settled(p, 300);   // a menu or a tab that before() opened needs a moment
    let pr = await p.evaluate(([t]) => window.__tour.probe(t), [s.target]);
    if (pr.bad) { rec(name + ': the target is a valid CSS selector', false, s.target); continue; }
    if (pr.centred) { rec(name + ': a card in the middle of the screen (no target)', true); }
    else if (!pr.shown) {
      if (s.skipIfMissing) { skipped.push(tag + '  ' + label(s) + '  (' + pr.why + ')'); rec(name + ': target not shown here, and the step says skipIfMissing', true, pr.why); }
      else rec(name + ': the target is on the page and visible' + (full ? '' : ' (a step whose target can hide on some days needs skipIfMissing: true)'), false, pr.why);
    } else {
      let detail = pr.w + 'x' + pr.h + ' px';
      let good = true;
      if (full) {
        await p.evaluate(([t]) => window.__tour.bringIntoView(t), [s.target]);
        await settled(p, 600);
        const drawn = await until(p, ([t]) => { const r = window.__tour.probe(t); return r.shown && r.opacity >= 0.95 && r.inner >= 0.95; }, [s.target], 6000);
        pr = await p.evaluate(([t]) => window.__tour.probe(t), [s.target]);
        if (!drawn) { good = false; detail += '  [still fading in after scrolling to it: opacity ' + pr.opacity + ', boxes inside ' + pr.inner + ']'; }
      }
      if (!pr.something) { good = false; detail += '  [the target has nothing in it to look at]'; }
      rec(name + ': the target is on the page, visible' + (full ? ', fully drawn' : ''), good, detail);
      if (full) {
        const cover = await p.evaluate(([t]) => window.__tour.covered(t), [s.target]);
        if (cover) info('note: something else (' + cover + ') is on top of the middle of the target ' + s.target);
        if (pr.h > pr.vh) info('note: the target is taller than the window (' + pr.h + ' of ' + pr.vh + ' px): ' + s.id);
        {   // what a lit button opens (a list under a menu bar, the bell's panel) is lit too and can be used: the tour finds it by aria-controls, and by aria-expanded="true" while it is open
          const op = await p.evaluate(([t]) => window.__tour.openers(t), [s.target]);
          menusChecked++;
          if (op.unseen.length) { menusBad++; rec(name + ': what the lit buttons open is found by the tour (aria-controls, and aria-expanded "true" while it is open)', false, op.unseen.join('; ')); }
          else if (op.opened) info('the lit part has ' + op.opened + ' button' + (op.opened === 1 ? '' : 's') + ' that open something' + (op.outside ? ' (' + op.outside + ' of them reach outside the lit box: the tour lights that too)' : '') + ': ' + s.id);
        }
        for (const sel of [].concat(s.also || [])) {   // the other parts the step lights with its target
          const pa = await p.evaluate(([x]) => window.__tour.probe(x), [sel]);
          rec(name + ': the part named with also (' + sel + ') is on the page and visible', !pa.bad && pa.shown, pa.bad ? 'not a valid selector' : pa.shown ? '' : pa.why);
        }
        if (s.allowClicks) {
          const clicked = await p.evaluate(([t]) => window.__tour.tryClick(t), [s.target]);
          if (clicked) { await settled(p, 600); info('tried a click on "' + clicked + '" inside the target (the step allows clicks)'); }
        }
      }
    }
    // the small buttons of the step (the season walk): press each one in turn, the way an owner would, and look at the lit box after each press
    const buttons = full && pr.shown ? await p.evaluate(([id]) => window.__tour.choiceList(id), [s.id]) : [];
    if (buttons.length) {
      const boxBefore = await p.evaluate(([t, a]) => window.__tour.boxText(t, a), [s.target, s.also || []]);
      const seen = [], seenAll = [], phone = size.width < 600;   // on a phone the site's own style leaves some words out (the "In season:" part of the top strip): the tour is made for the computer first
      for (let i = 0; i < buttons.length; i++) {
        const c = buttons[i], nm = name + ' - button "' + c.label + '"';
        const r = await hook(p, s.id, i);
        if (r.error) { rec(nm + ': run() ran without an error', false, r.error); continue; }
        await settled(p, 600);
        const bad = [];
        const there = await p.evaluate(([t]) => window.__tour.probe(t), [s.target]);
        if (!there.shown) bad.push('the lit box is not on the page any more (' + there.why + ')');
        else if (!there.something) bad.push('the lit box has nothing in it to look at');
        if (SEASON_NAMES.includes(c.label.toLowerCase())) {
          const now = await p.evaluate(() => window.__tour.dataSeason());
          if (now !== c.label.toLowerCase()) bad.push('the page is in "' + now + '", not in ' + c.label.toLowerCase());
        }
        const box = (await p.evaluate(([t, a]) => window.__tour.boxText(t, a), [s.target, s.also || []])) || '';
        const all = phone ? (await p.evaluate(([t, a]) => window.__tour.boxAll(t, a), [s.target, s.also || []])) || '' : '';
        seen.push(box); seenAll.push(all || box);
        const phrases = [...String((c.title || '') + ' ' + (c.text || '')).matchAll(/\u201c([^\u201d]+)\u201d/g)].map((m) => m[1]);
        const lost = phrases.filter((ph) => !squash(box).includes(squash(ph)));
        const hid = lost.filter((ph) => phone && squash(all).includes(squash(ph)));   // there in the page, left out by the style on a phone
        const missing = lost.filter((ph) => !hid.includes(ph));
        if (hid.length) info('note: on a phone the site leaves out ' + hid.map((m) => '\u201c' + m + '\u201d').join(', ') + ' in ' + s.target + ' (the computer shows it)');
        if (missing.length) bad.push('the card quotes ' + missing.map((m) => '\u201c' + m + '\u201d').join(', ') + ' but the lit box says: ' + box.slice(0, 260));
        if (process.env.WA_TOUR_SHOW) info(c.label + ': ' + box.slice(0, 330));
        rec(nm + ': the lit box is on the page and shows what the card says (' + phrases.length + ' quoted phrase' + (phrases.length === 1 ? '' : 's') + ')' + (full ? '' : ''), bad.length === 0, bad.join(' | '));
      }
      if (buttons.length > 1) {
        const shown = new Set(seen).size, written = new Set(seenAll).size;
        if (phone && shown < 2 && written > 1) info('note: on a phone the lit box looks the same for every button; the words that change are left out by the site\'s own style (' + s.target + ')');
        rec(name + ': the buttons show different things in the lit box (' + shown + ' different of ' + seen.length + ')', shown > 1 || (phone && written > 1), 'every button left the lit box as it was: ' + (seen[0] || '').slice(0, 200));
      }
      const a2 = await hook(p, s.id, 'after');
      if (a2.error) { rec(name + ': after() ran without an error', false, a2.error); continue; }
      if (a2.ran) await settled(p, 300);
      const boxAfter = await p.evaluate(([t, a]) => window.__tour.boxText(t, a), [s.target, s.also || []]);
      rec(name + ': after() put the words of the lit box back as they were (numbers aside: a countdown moves on by itself)', numbersAside(boxAfter) === numbersAside(boxBefore), boxAfter === boxBefore ? '' : 'before: ' + String(boxBefore).slice(0, 160) + ' | after: ' + String(boxAfter).slice(0, 160));
      if (site) {
        const afterSnap = await p.evaluate(() => window.__tour.snapshot());
        rec(name + ': after() puts the page back as it was (season, open tab, open menus, the lines of a season, the parts that follow the clock)', afterSnap === before, afterSnap === before ? '' : 'before ' + before + '  after ' + afterSnap);
      }
      continue;
    }
    const a = await hook(p, s.id, 'after');
    if (a.error) { rec(name + ': after() ran without an error', false, a.error); continue; }
    if (a.ran) await settled(p, 300);
    if (site && (s.before || s.after)) {
      const afterSnap = await p.evaluate(() => window.__tour.snapshot());
      rec(name + ': after() puts the page back as it was (season, open tab, open menus)', afterSnap === before, afterSnap === before ? '' : 'before ' + before + '  after ' + afterSnap);
    }
  }
  await p.context().close();
  if (full && menusChecked) ok(tag + ': what the lit buttons open is found by the tour in every step (' + menusChecked + ' steps looked at)', menusBad === 0);
  if (!full && !bad) ok(tag + ': all ' + list.length + ' steps have a visible target or say skipIfMissing', true);
  return { skipped, seen: list.length };
}

/* ================================================================ the test */
/** The checks that need no browser (about a second): WA_WORDS_ONLY=1 node tests/tour-targets.test.mjs runs only these, handy while writing a step. */
function wordChecks() {
  ok('the steps files that are here run without an error', loadErrors.length === 0, loadErrors.join('; '));
  ok('js/tour-steps.js is here and gives the titles of all 11 chapters (WA_TOUR_CHAPTERS)', present.includes('js/tour-steps.js') && chapters.length === 11 && chapters.every((c, i) => c.n === i + 1 && typeof c.title === 'string' && c.title.trim() !== '' && wordsOf(c.title).length <= 6), JSON.stringify(chapters).slice(0, 200));
  for (const f of missingFiles) info(f + ' is not here (yet): its chapters are not checked');
  ok('there are steps (' + steps.length + ' in ' + present.length + ' file(s))', steps.length > 0);
  const ids = new Map(), orders = new Map();
  for (const s of steps) { ids.set(s.id, (ids.get(s.id) || 0) + 1); orders.set(s.order, (orders.get(s.order) || 0) + 1); }
  ok('every id is used once', [...ids.values()].every((n) => n === 1), [...ids].filter(([, n]) => n > 1).map(([k]) => k).join(', '));
  ok('every order number is used once', [...orders.values()].every((n) => n === 1), [...orders].filter(([, n]) => n > 1).map(([k]) => k).join(', '));
  let wordFails = 0;
  for (const s of steps) { const p = wordProblems(s); if (p.length) { wordFails++; ok('the words of step ' + s.order + ' ' + s.id, false, p.join(' | ')); } }
  ok('the words of all ' + steps.length + ' steps follow the rules (fields, 9-word title, 45-word text, 25-word sentences, no address, year, jargon or invented price)', wordFails === 0);
  const perChapter = {};
  for (const s of steps) perChapter[s.chapter] = (perChapter[s.chapter] || 0) + 1;
  info('steps per chapter: ' + chapters.map((c) => c.n + ': ' + (perChapter[c.n] || 0)).join(', ') + '  (total ' + steps.length + ')');
  if (!missingFiles.length) {
    const empty = chapters.filter((c) => !perChapter[c.n]).map((c) => c.n);
    ok('every chapter has at least one step (all three files are here)', empty.length === 0, 'chapters without a step: ' + empty.join(', '));
  }
  // what the owners are told about clicking is said once, in the same words: on the welcome card (js/tour.js) and on the first step
  const clicking = 'Whatever is lit up on the page, you can click and try.', hello = steps.find((s) => s.id === 'ch1-hello');
  {   // the card about the season buttons: which day a button pretends, and what 'single quotes' in the other cards mean
    const c = steps.find((s) => s.id === 'ch1-seasons');
    ok('the card about the season buttons says that a button pretends a Saturday at noon in the middle of the season, and that words in ‘single quotes’ show on another day', !!c && /pretends it is a Saturday at noon, in the middle of that season/.test(c.text) && /Words in ‘single quotes’ show on another day/.test(c.text), c && c.text);
  }
  ok('the welcome card and the first step say the same about clicking: "' + clicking + '"', read('js/tour.js').includes(clicking) && !!hello && hello.text.includes(clicking), hello ? hello.text.slice(0, 120) : 'no step ch1-hello');
}

if (process.env.WA_WORDS_ONLY) { wordChecks(); await finish({}); }
else await run('tour-targets', async ({ browser, base, errs }) => {
  wordChecks();

  /* ---- 2. what the texts say about the page: the Prices coming soon cards (chapters 7 and 11) and the numbers they quote */
  const p0 = await open(browser, base, 'index.html', errs, {});
  await putStepsInPage(p0);
  const soon = await p0.evaluate(() => window.__tour.soonCards());
  const norm = (t) => String(t).toLowerCase().replace(/&/g, 'and').replace(/[‘’]/g, "'").replace(/\s+/g, ' ');
  const priced = await p0.evaluate(() => Array.from(document.querySelectorAll('.shop-card')).filter((c) => !c.querySelector('.shop-soon')).map((c) => (c.querySelector('.shop-name') || {}).textContent.trim()));
  ok('the Store has cards that say Prices coming soon (' + soon.length + ': ' + soon.join(', ') + ')', soon.length > 0);
  for (const ch of [7, 11]) {
    const mine = steps.filter((s) => s.chapter === ch);
    if (!mine.length) { info('chapter ' + ch + ' has no steps here yet: its list of Prices coming soon cards is not checked'); continue; }
    const text = norm(mine.map((s) => s.text).join(' '));
    const unnamed = soon.filter((n) => {
      const m = norm(n).match(/^u-pick (.+)$/);
      return m ? !(text.includes('u-pick') && text.includes(m[1])) : !text.includes(norm(n));
    });
    ok('chapter ' + ch + ' names every card that says Prices coming soon', unnamed.length === 0, 'not named: ' + unnamed.join(', '));
    const wrong = priced.filter((n) => text.includes(norm(n)) && !soon.some((c) => norm(c).includes(norm(n)) || norm(n).includes(norm(c))));
    ok('chapter ' + ch + ' does not name a Store card that already has a price', wrong.length === 0, 'named but priced: ' + wrong.join(', '));
  }
  // numbers that a text quotes from the page ("Fifteen common questions", "Six towns"): they must still be true. Each pattern is narrow on purpose.
  const WORD_NUMBERS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20 };
  const CLAIMS = [
    [/\b(\w+) cards in the Store still say/i, () => soon.length, 'cards in the Store that say Prices coming soon'],
    [/\b(\w+) (?:common )?questions are answered/i, '#faq .faq-list > details', 'questions in the FAQ'],
    [/\b(\w+) towns? show/i, '.drive-list > li', 'towns in the drive-time list'],
    [/\b(\w+) pizzas at \$/i, '#menu .menu-list > li', 'pizzas on the menu'],
    [/\bin (\w+) groups\b/i, '#shop .shop-jump > li', 'groups in the Store'],
    [/\b(\w+) tabs show what visitors/i, '#season-tabs .season-tab', 'season tabs'],
    [/\b(\w+) lists:/i, '#nav .nav-group', 'lists in the top bar'],
  ];
  for (const [re, sel, what] of CLAIMS) {
    for (const st of steps) {
      const m = st.text.match(re);
      if (!m) continue;
      const said = /^\d+$/.test(m[1]) ? +m[1] : WORD_NUMBERS[m[1].toLowerCase()];
      if (!said) continue;
      const real = typeof sel === 'function' ? sel() : await p0.evaluate((q) => document.querySelectorAll(q).length, sel);
      ok('step ' + st.order + ' ' + st.id + ' says ' + m[1] + ' ' + what + ' and the page has ' + real, said === real);
    }
  }
  // the dates in the season buttons' words: a "Month day" in the card of a season must be the first or the last day of that season in js/season.js
  const seasonDates = await p0.evaluate(() => { const f = (d) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }); const out = {}; window.WISE_ACRES.seasons.list.forEach((x) => { out[x.id] = [f(x.start(2026)), f(x.end(2026))]; }); return out; });
  const MONTH_DAY = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/g;
  let datesChecked = 0;
  for (const st of steps) {
    const { list } = choicesOf(st);
    for (const c of list || []) {
      const id = String(c.label).toLowerCase();
      if (!seasonDates[id]) continue;
      for (const d of String((c.title || '') + ' ' + (c.text || '')).match(MONTH_DAY) || []) {
        datesChecked++;
        ok('step ' + st.id + ', ' + c.label + ': the date "' + d + '" is the first or the last day of that season in js/season.js (' + seasonDates[id].join(' and ') + ')', seasonDates[id].includes(d));
      }
    }
  }
  info(datesChecked + ' dates in the cards of the season buttons were checked against js/season.js');
  // what the strip at the top says AFTER a season ends (the words in single curly quotes in the strip step) is what the page says on the day after the season's last day
  const stripStep = steps.find((x) => x.id === 'ch2-strip');
  if (stripStep) {
    for (const c of choicesOf(stripStep).list || []) {
      const id = String(c.label).toLowerCase();
      const later = (String(c.text).match(/\u2018([^\u2019]+)\u2019/g) || []).map((x) => x.slice(1, -1));
      if (!seasonDates[id] || !later.length) continue;
      const day = await p0.evaluate((sid) => { const d = window.WISE_ACRES.seasons.list.find((x) => x.id === sid).end(2026); return [d.getFullYear(), d.getMonth(), d.getDate() + 1]; }, id);
      await p0.clock.setSystemTime(new Date(day[0], day[1], day[2], 12, 0, 0));
      await p0.evaluate(() => window.WISE_ACRES.live.refresh());
      const said = await p0.evaluate(() => document.querySelector('.announce [data-ann-season]').textContent.trim());
      ok('step ch2-strip, ' + c.label + ': the day after the season, the strip says ' + JSON.stringify(later[0]) + ' (the page says ' + JSON.stringify(said) + ')', later.every((l) => squash(said) === squash(l)), said);
    }
  }
  await p0.context().close();

  /* ---- 3. the walk, at 1440 and 390 px, on the test day */
  const pagesHere = Object.keys(PAGE_FILE).filter((pg) => !DEMO_PAGES.includes(pg) || exists(PAGE_FILE[pg]));
  const noPage = [...new Set(steps.filter((s) => !pagesHere.includes(s.page)).map((s) => s.page))];
  if (noPage.length) info('the pages ' + noPage.join(', ') + ' are not here yet (' + steps.filter((s) => noPage.includes(s.page)).length + ' steps listed, not checked)');
  const listed = [];
  for (const size of SIZES) {
    const r = await walk({ browser, base, errs, size, full: true, time: undefined, pages: pagesHere, tag: size.width + ' px' });
    listed.push(...r.skipped);
  }
  if (listed.length) { info('steps whose target was not shown (skipIfMissing: true, so the engine skips them):'); listed.forEach((l) => info('  ' + l)); }

  /* ---- 4. the same walk on other days (home page and first-visit page only, no scrolling) */
  for (const [time, what] of OTHER_DAYS) {
    for (const size of SIZES) {
      await walk({ browser, base, errs, size, full: false, time, pages: ['index', 'first-visit'].filter((pg) => pagesHere.includes(pg)), tag: size.width + ' px, ' + what });
    }
  }
});
