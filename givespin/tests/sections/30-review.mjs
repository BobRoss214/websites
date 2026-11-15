// The independent review of the whole round (wave 1 and wave 2 merged). Sections 30a to 30f.
//   30a  "Erase my data" takes the erased card back off the page too (body[data-cardback] kept the old one until a reload)
//   30b  the "1 in N" sentence for a charity that is not on the board uses the real roster size (it said "over a thousand" for 500 charities), everywhere it is said
//   30c  damaged and hand-edited saves (the main save and every givespin:x:* key, with markup in the names) open every page: no console problems, no injected markup, no sideways scroll
//   30d  visiting the new pages again and again adds no handlers, no timers and no duplicate ids
//   30e  the season track opens centred on the visitor's tier on every window width (it was off by 107 to 755 px, and out of sight on a 2560 px window)
//   30f  the profile card's note does not call a profile a "round" (it still says plainly that no money moved)
// 30c and 30d are guards for things the review looked at and found sound (nothing needed fixing); 30a, 30b, 30e and 30f fail on the tree the review started from.
import fs from 'node:fs';
import path from 'node:path';

export default async function (h) {
  const { check, newPage, openApp, go, section, problems, N, root } = h;
  const text = (f) => fs.readFileSync(path.join(root, f), 'utf8');
  const ADA = { signedIn: true, name: 'Ada Lovelace', type: 'email', contact: 'ada@example.com', hue: 200, createdAt: 1 };
  /** Starts a page with the given raw localStorage values (once per page, after the harness has emptied it). */
  const seed = (page, items) => page.addInitScript((items) => {
    try { if (!sessionStorage.getItem('__review')) { sessionStorage.setItem('__review', '1'); Object.keys(items).forEach((k) => localStorage.setItem(k, items[k])); } } catch (e) { /* ignore */ }
  }, items);
  const save = (extra) => JSON.stringify(Object.assign({ v: 2, xp: 40000, totalCents: 150000, plays: 40, streak: 3, bestStreak: 5 }, extra || {}));

  /* ---------------------------------------------------------------- 30a */
  if (section('30a. "Erase my data" also takes the erased card back off the page')) {
    const problems0 = problems.length;
    const page = await newPage();
    await seed(page, { 'givespin:v2': save({ account: ADA }) });
    await openApp(page, '#quests');
    // earn the Emerald back and wear it, through the real picker
    await page.evaluate(() => { window.GS.cosmetics.unlock('cardback', 'emerald'); window.GS.ui.quests.render(); });
    await page.locator('#view-quests input[name="q-cardback"][value="emerald"]').check({ force: true });
    check(await page.evaluate(() => document.body.getAttribute('data-cardback')) === 'emerald', 'choosing the Emerald back puts it on the page (data-cardback = emerald)');
    check(await page.evaluate(() => window.GS.cosmetics.active('cardback')) === 'emerald', 'and it is the saved choice');
    // erase everything through the real account menu
    await page.click('#acct [data-role="toggle"]');
    await page.click('#acct [data-role="settings"]');
    await page.waitForSelector('#dlg-settings[open]');
    const erase = page.locator('#dlg-settings [data-role="erase"]');
    await erase.click(); await erase.click();
    await page.waitForFunction(() => !document.querySelector('#dlg-settings').open);
    const after = await page.evaluate(() => ({ attr: document.body.getAttribute('data-cardback'), active: window.GS.cosmetics.active('cardback'), conf: window.GS.cosmetics.active('confetti'), owns: window.GS.cosmetics.owns('cardback', 'emerald') }));
    check(!after.owns && after.active === 'classic' && after.conf === 'classic', 'after "Erase my data" the cosmetics are back to the classic ones', after);
    check(after.attr === 'classic', 'and the card back on the page is the classic one at once, not the erased Emerald until a reload (data-cardback)', after);
    await page.close();
    check(problems.length === problems0, 'section 30a: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ---------------------------------------------------------------- 30b */
  if (section('30b. The "1 in N" sentence says the real number of charities, wherever it is said')) {
    const problems0 = problems.length;
    const want = new RegExp('about 1 in ' + N + '\\b');
    const page = await newPage();
    await openApp(page, '#help');
    await page.evaluate(() => document.querySelectorAll('#view-help details').forEach((d) => { d.open = true; }));
    const help = await page.locator('#view-help').innerText();
    check(want.test(help.replace(/\s+/g, ' ')) && !/over a thousand/i.test(help), 'Help (Back a charity) says "about 1 in ' + N + '", not "over a thousand"');
    await go(page, '#cards');
    const cards = (await page.locator('#view-cards').innerText()).replace(/\s+/g, ' ');
    check(want.test(cards) && !/over a thousand/i.test(cards), 'the cards page says the same');
    await go(page, '#game-wheel');
    await page.click('#pick-btn');
    await page.waitForSelector('dialog[open]');
    const dlg = (await page.locator('dialog[open]').first().innerText()).replace(/\s+/g, ' ');
    check(want.test(dlg) && !/over a thousand/i.test(dlg), 'and so does the Back a charity dialog of a game', dlg.slice(0, 200));
    await page.keyboard.press('Escape');
    await page.close();
    const index = text('index.html');
    check(!/over a thousand/i.test(index) && new RegExp('og:description" content="[^"]*\\b' + N + ' charities').test(index), 'the share-preview text (og:description) says ' + N + ' charities');
    const src = ['js/ui/game.js', 'js/ui/pages.js', 'js/ui/collection.js'].filter((f) => /over a thousand/i.test(text(f)));
    check(src.length === 0, 'no source file that writes visitor text still says "over a thousand"', src);
    check(problems.length === problems0, 'section 30b: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ---------------------------------------------------------------- 30c */
  if (section('30c. Damaged and hand-edited saves open every page: no console problems, no injected markup, no sideways scroll')) {
    const problems0 = problems.length;
    const XSS = '<img src=x onerror="window.__xss=1">';
    const XSS2 = '"><svg onload="window.__xss=1">';
    const variants = {
      'invalid JSON in the main save': { 'givespin:v2': '{not json' },
      'wrong types all over the main save': { 'givespin:v2': JSON.stringify({ v: 2, xp: 'abc', totalCents: {}, plays: [], streak: 'x', history: 'nope', badges: [1, 2], cards: 5, prefs: 'x', account: 7, daily: 'x', cup: 3, weekly: 'q', fair: 8, plans: {}, charityCounts: [], crew: {}, balanceCents: 'NaN' }) },
      'markup in the signed-in name': { 'givespin:v2': save({ account: { signedIn: true, name: XSS, type: 'email', contact: XSS2, hue: 40, createdAt: 1 } }) },
      'damaged givespin:x:* keys': { 'givespin:v2': save(), 'givespin:x:profile': '{not json', 'givespin:x:quests': '[]', 'givespin:x:cosmetics': '5', 'givespin:x:waitlist': JSON.stringify({ nickname: XSS, notify: true, savedAt: 1 }), 'givespin:x:share': '7', 'givespin:x:reminders': JSON.stringify({ on: true, lead: 'x' }), 'givespin:x:stream': 'null' },
      'hostile values in givespin:x:* keys': { 'givespin:v2': save(), 'givespin:x:profile': JSON.stringify({ name: XSS, frame: '__proto__', title: 'constructor' }), 'givespin:x:quests': JSON.stringify({ v: 1, claimed: { __proto__: true, constructor: 1 }, announced: 'x', hi: 5, marks: [], firstSeen: 'abc', season: { id: 5, days: 'x', ids: {}, quest: 'NaN' } }), 'givespin:x:cosmetics': JSON.stringify({ v: 1, owned: { frame: 'x', title: [{}], cardback: '__proto__', confetti: 5 }, active: { cardback: XSS, confetti: '__proto__' } }), 'givespin:x:waitlist': JSON.stringify({ nickname: 'a'.repeat(100000), notify: true, savedAt: 'x' }), 'givespin:x:share': JSON.stringify({ showName: 'yes', size: '<b>' }), 'givespin:x:reminders': JSON.stringify({ on: 1, lead: 1e9 }), 'givespin:x:stream': JSON.stringify({ chat: 'x', compact: [], credit: {} }) }
    };
    const routes = ['#lobby', '#me', '#quests', '#boards', '#spotlights', '#make-it-real', '#live', '#leagues', '#crews', '#cards', '#club', '#giving'];
    for (const [name, items] of Object.entries(variants)) {
      const page = await newPage();
      await seed(page, items);
      await openApp(page, '#lobby');
      const bad = [];
      for (const r of routes) {
        await go(page, r);
        const m = await page.evaluate(() => {
          const v = Array.from(document.querySelectorAll('.view')).find((e) => !e.hidden);
          return { len: v ? v.innerText.length : -1, xss: !!window.__xss, injected: document.querySelectorAll('img[src="x"], svg[onload]').length, polluted: ({}).polluted !== undefined, sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, junk: /\bNaN\b|\[object|Infinity/.test(v ? v.innerText : '') };
        });
        if (m.len < 20 || m.xss || m.injected || m.polluted || m.sideways || m.junk) { bad.push(r + ' ' + JSON.stringify(m)); }
      }
      check(bad.length === 0, name + ': all ' + routes.length + ' pages open and are clean', bad);
      await page.close();
    }
    check(problems.length === problems0, 'section 30c: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ---------------------------------------------------------------- 30d */
  if (section('30d. Visiting the pages again and again adds no handlers, no timers and no duplicate ids')) {
    const problems0 = problems.length;
    const page = await newPage();
    await seed(page, { 'givespin:v2': save() });
    await openApp(page, '#lobby');
    await page.waitForTimeout(1200);
    // every route is visited once first (some things are built on the first visit only); after that nothing may grow
    const routes = ['#lobby', '#me', '#quests', '#boards', '#spotlights', '#make-it-real', '#live', '#leagues', '#crews', '#cards', '#club', '#giving', '#help'];
    for (const r of routes) { await go(page, r); }
    await go(page, '#lobby');
    await page.evaluate(() => {
      const p = (window.__rv = { bus: 0, listeners: 0, intervals: new Set() });
      const on = window.GS.bus.on; window.GS.bus.on = function () { p.bus++; return on.apply(this, arguments); };
      // (net: the test helper's own go() adds a one-time hashchange listener and takes it off again, which must not count)
      const add = EventTarget.prototype.addEventListener, rem = EventTarget.prototype.removeEventListener;
      EventTarget.prototype.addEventListener = function () { if (this === window || this === document) { p.listeners++; } return add.apply(this, arguments); };
      EventTarget.prototype.removeEventListener = function () { if (this === window || this === document) { p.listeners--; } return rem.apply(this, arguments); };
      const si = window.setInterval, ci = window.clearInterval;
      window.setInterval = function () { const id = si.apply(window, arguments); p.intervals.add(id); return id; };
      window.clearInterval = function (id) { p.intervals.delete(id); return ci.apply(window, arguments); };
    });
    const before = await page.evaluate(() => document.querySelectorAll('dialog').length);
    for (let i = 0; i < 10; i++) {
      for (const r of routes) { await go(page, r); }
    }
    await go(page, '#lobby');
    const res = await page.evaluate(() => ({ bus: window.__rv.bus, listeners: window.__rv.listeners, intervals: window.__rv.intervals.size, dialogs: document.querySelectorAll('dialog').length }));
    check(res.bus === 0, 'ten more rounds of visits to ' + routes.length + ' pages add no event-bus handlers', res);
    check(res.listeners === 0, 'and no window or document listeners that stay (added minus removed)', res);
    check(res.intervals === 0, 'and leave no timer running that was not already', res);
    check(res.dialogs === before, 'and create no new dialogs', { before, after: res.dialogs });
    const dups = {};
    for (const r of routes) {
      await go(page, r);
      const dup = await page.evaluate(() => { const c = {}; document.querySelectorAll('[id]').forEach((e) => { c[e.id] = (c[e.id] || 0) + 1; }); return Object.keys(c).filter((k) => c[k] > 1); });
      if (dup.length) { dups[r] = dup; }
    }
    check(Object.keys(dups).length === 0, 'no one of the ' + routes.length + ' pages has a duplicate id', dups);
    await page.close();
    check(problems.length === problems0, 'section 30d: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ---------------------------------------------------------------- 30e */
  if (section('30e. The season track opens centred on the visitor\'s tier, on a laptop and on a very wide window')) {
    const problems0 = problems.length;
    const d = new Date();
    const sid = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const claimed = {};
    for (let i = 1; i <= 19; i++) { claimed['s:' + sid + ':' + String(i).padStart(2, '0')] = true; }   // tiers 1 to 19 claimed: the first one to claim is tier 20
    const deep = { 'givespin:v2': save({ plays: 20 }), 'givespin:x:quests': JSON.stringify({ v: 1, claimed, announced: true, hi: {}, marks: {}, firstSeen: sid + '-01', season: { id: sid, days: {}, ids: [], quest: 2400 } }) };
    const where = (page) => page.evaluate(() => {
      const t = document.querySelector('.qtrack');
      const tr = t.getBoundingClientRect();
      const first = t.querySelector('.qtier.is-ready') || t.querySelector('.qtier.is-next');
      const r = first.getBoundingClientRect();
      return { tier: first.querySelector('.qtier__btn').getAttribute('data-tier'), off: Math.round((r.left + r.width / 2) - (tr.left + tr.width / 2)), inView: r.left >= tr.left - 1 && r.right <= tr.right + 1, firstTierLeft: Math.round(t.querySelector('.qtier').getBoundingClientRect().left - tr.left), scrollLeft: Math.round(t.scrollLeft) };
    });
    for (const [w, hh] of [[1280, 720], [1920, 1080], [2560, 1440]]) {
      const page = await newPage({ viewport: { width: w, height: hh } });
      await seed(page, deep);
      await openApp(page, '#quests');
      await page.waitForTimeout(500);
      const m = await where(page);
      check(m.tier === '20' && m.inView && Math.abs(m.off) <= 40, w + 'x' + hh + ': the tier to claim (20) is in view and in the middle of the strip', m);
      await page.close();
    }
    // a new visitor: the strip starts at the first tier, not scrolled past it
    for (const [w, hh] of [[1280, 720], [2560, 1440]]) {
      const page = await newPage({ viewport: { width: w, height: hh } });
      await openApp(page, '#quests');
      await page.waitForTimeout(500);
      const m = await where(page);
      check(m.scrollLeft === 0 && m.firstTierLeft >= 0, w + 'x' + hh + ': a new visitor sees the strip from tier 1 (nothing scrolled out of sight on the left)', m);
      await page.close();
    }
    check(problems.length === problems0, 'section 30e: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ---------------------------------------------------------------- 30f */
  if (section('30f. The profile card says "Simulated", not "Simulated round", and still says nothing real moved')) {
    const problems0 = problems.length;
    const page = await newPage();
    await openApp(page, '#me');
    const n = await page.evaluate(() => {
      const p = window.GS.share.profileCard({ demo: true, totalText: '$6,500', standing: { rank: 2, level: 4, label: 'Rank 2, Level 4', name: 'Benefactor' }, streak: 4 });
      const r = window.GS.share.roundCard({ demo: true, amountText: '$25', cents: 2500, game: 'Lucky Wheel', charities: [{ name: 'WaterAid', short: 'WaterAid' }] });
      return { profile: p.note, round: r.note };
    });
    check(/^Simulated: no money moved and nothing was charged/.test(n.profile) && !/round/i.test(n.profile), 'the profile card note: "' + n.profile + '"', n);
    check(/^Simulated round: no money moved and nothing was charged/.test(n.round), 'the round card still says "Simulated round: ..."', n);
    await page.close();
    check(problems.length === problems0, 'section 30f: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }
}
