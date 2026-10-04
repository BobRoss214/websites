// order: 315
// browser: yes
// covers: *.html, pages/*, js/main.js, js/features.js, js/hero.js, js/i18n.js, lang/*
/* Link names and screen reader noise (a blind visitor listening to the list of links and walking the page): two links with the same words must lead to the same
 * place, or carry a second word that tells them apart ("Directions The u-pick farm" and "Directions The GreenHouse", built from the card's own heading, so every
 * language gets it for free); the game score in the hero is not read as a bare number; the drawings are hidden from screen readers (nothing exposes an
 * unnamed picture); the hero buttons have names; the live countdown is a timer (silent), not a live region that talks every second.
 * Home page and First-visit page, English at 1280 px and Chinese at 390 px (Latin words left over would show in the names). Quick: about 15 seconds. */
import { run, open, ok } from './lib.mjs';

// Pairs of links that share their words on purpose and say different things only in the page around them. Each one is named here so a NEW pair has to be decided on.
const SAME_WORDS_OK = [
  'Wise Pie pizza',                 // the footer: the home page section and the separate page
  'See the varieties',              // the tomato list on the home page and the guide below it
  'cathy@wiseacresorganic.com',     // the same address with different subject lines
  'vanessa@wiseacresorganic.com',   // the same
  'pranee@wiseacresorganic.com',
  'ava@wiseacresorganic.com',
];

// the accessible name the way a browser works it out for a link: aria-labelledby, then aria-label, then the words inside
const NAMES = () => {
  const text = (e) => (e.getAttribute('aria-label') || e.textContent || '').replace(/\s+/g, ' ').trim();
  const name = (a) => {
    const ids = (a.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean);
    if (ids.length) return ids.map((id) => { const n = document.getElementById(id); return n ? text(n) : ''; }).join(' ').trim();
    return text(a);
  };
  const out = [];
  for (const a of document.querySelectorAll('a[href]')) {
    if (a.closest('[hidden], [aria-hidden="true"]') || getComputedStyle(a).display === 'none') continue;   // the menu of a phone is closed with a transform, not hidden: its links count
    out.push({ name: name(a), href: a.getAttribute('href'), visible: text(a), t: a.getAttribute('data-t') || '' });
  }
  return out;
};

await run('link-names', async ({ browser, base, errs }) => {
  const views = [['index.html', 'en', { width: 1280, height: 800 }], ['index.html', 'zh', { width: 390, height: 844 }], ['first-visit.html', 'en', { width: 1280, height: 800 }]];
  const okPairs = new Set();   // the places each allowed pair leads to, found in the English run: the other languages lead to the same places (their words differ, the pairs do not)
  for (const [pg, lang, vp] of views) {
    const p = await open(browser, base, pg, errs, { viewport: vp, touch: vp.width < 600, lang: lang === 'en' ? undefined : lang });
    await p.waitForTimeout(500);
    const links = await p.evaluate(NAMES);
    const byName = new Map();
    for (const l of links) { if (!byName.has(l.name)) byName.set(l.name, { hrefs: new Set(), ts: new Set() }); const g = byName.get(l.name); g.hrefs.add(l.href); g.ts.add(l.t); }
    const key = (g) => [...g.hrefs].sort().join(' | ');
    if (lang === 'en') for (const [n, g] of byName) if (SAME_WORDS_OK.includes(n) && g.hrefs.size > 1) okPairs.add(key(g));
    const clash = [...byName].filter(([n, g]) => n && g.hrefs.size > 1 && !SAME_WORDS_OK.includes(n) && !okPairs.has(key(g))).map(([n, g]) => `"${n}" -> ${g.hrefs.size} different places`);
    ok(`${pg} ${lang}: no two links share their name and lead to different places (${links.length} links)`, clash.length === 0, clash.slice(0, 5).join('; '));
    // a name must still contain the words on the button (a visitor who speaks the words to a voice control)
    const lost = links.filter((l) => l.visible && l.name && !l.name.toLowerCase().includes(l.visible.toLowerCase().slice(0, 12))).map((l) => `"${l.visible.slice(0, 30)}" is named "${l.name.slice(0, 40)}"`);
    ok(`${pg} ${lang}: every link name contains the words written on it`, lost.length === 0, lost.slice(0, 4).join('; '));

    if (pg === 'index.html') {
      const r = await p.evaluate(() => {
        const exposedSvg = Array.from(document.querySelectorAll('main svg, header svg, footer svg')).filter((s) => !s.closest('[aria-hidden="true"]') && s.getAttribute('aria-hidden') !== 'true' && s.getAttribute('role') !== 'img' && !s.closest('#sprite, symbol, defs')).length;
        const pick = document.getElementById('pick-count');
        const timer = document.querySelector('.rel-count');
        const hero = ['#pick-btn', '#npc-btn'].map((s) => { const b = document.querySelector(s); return b ? (b.getAttribute('aria-label') || b.textContent || '').trim() : null; });
        const live = Array.from(document.querySelectorAll('[aria-live=assertive], [role=alert]')).filter((e) => e.checkVisibility()).length;
        return { exposedSvg, pickHidden: pick && pick.getAttribute('aria-hidden') === 'true', timerRole: timer && timer.getAttribute('role'), timerLive: timer && timer.getAttribute('aria-live'), hero, assertive: live };
      });
      ok(`${lang}: no drawing is left for a screen reader (every svg is aria-hidden or a named image)`, r.exposedSvg === 0, r.exposedSvg + ' svg left');
      ok(`${lang}: the hero game's score is hidden from screen readers (its message line says what happened)`, r.pickHidden === true);
      ok(`${lang}: the hero buttons have names`, r.hero.every((n) => n === null || n.length > 1), JSON.stringify(r.hero));
      ok(`${lang}: the countdown is a timer and never a live region (it would talk every second)`, r.timerRole === 'timer' && (r.timerLive === null || r.timerLive === 'off'), `role=${r.timerRole} aria-live=${r.timerLive}`);
      ok(`${lang}: no assertive live region or alert on a quiet page`, r.assertive === 0, r.assertive + ' found');
    }
    await p.context().close();
  }
});
