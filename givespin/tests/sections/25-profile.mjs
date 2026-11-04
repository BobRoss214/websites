// Feature 4: the profile page (#me) and the simulated players' profiles. Sections 25a to 25k.
//   25a  an empty save: friendly empty states, the hero, nothing unlocked, no Share button without share cards
//   25b  a rich save: totals, favourites (checked against an independent count), cards, badges, recent gifts
//   25c  the card at the top at every rank boundary
//   25d  the display name: editing, validation messages, persistence across a reload, unsafe stored values
//   25e  frames and titles: locked and unlocked, picking, the keyboard, a reset closing one again
//   25f  where the chosen name shows (account menu, league, live feed, crews) and where it must not change; erasing
//   25g  the page is reachable from the account menu, the side card and the Giving Club
//   25h  a simulated player's profile from a live table, the league and a crew
//   25i  axe scans of the page and of the bot dialog
//   25j  no sideways scrolling from 320 to 2560 px
//   25k  reduced motion and the Share button
//   25l  real-donation (redirect) mode: the profile says "sent to checkout", not "given", and shows no demo wording
import fs from 'node:fs';
import path from 'node:path';

export default async function (h) {
  const { check, newPage, openApp, go, section, a11y, core, GSdata, problems } = h;
  const IDS = GSdata.charities.map((c) => c.id);
  const money = (c) => core.fmtMoney(c, true);
  const KEY = 'givespin:x:profile';
  const ADA = { signedIn: true, name: 'Ada Lovelace', type: 'email', contact: 'ada@example.com', hue: 200, createdAt: 1 };
  const NOW = Date.now();
  const charity = (id) => GSdata.charities.find((c) => c.id === id);
  const causeName = (id) => GSdata.causes.find((c) => c.id === id).name;
  const plural = (n, a, b) => n + ' ' + (n === 1 ? a : b);

  /** A save with a history we know the answer for: A 5 rounds, B 4, C 3 (the bigger gifts), D 3 (smaller), E 1, F 1, and a two-charity round. Newest first. */
  const rounds = [];
  const add = (id, cents, game) => rounds.push({ id: 'r' + rounds.length, ts: NOW - rounds.length * 5400e3, game: game || 'wheel', totalCents: cents, rounds: 1, status: 'ok', pay: 'credit', freq: 'once', allocations: [{ charityId: id, cents }] });
  const [A, B, C, D, E, F, G] = [IDS[3], IDS[40], IDS[77], IDS[120], IDS[200], IDS[260], IDS[330]];
  [A, B, A, B, C, A, D, A, B, C, D, A, B, C, D, E].forEach((id, i) => add(id, id === C ? 2000 : id === D ? 500 : 1000, ['wheel', 'plinko', 'slots', 'dice'][i % 4]));
  rounds.splice(3, 0, { id: 'rx', ts: NOW - 3 * 5400e3 - 1000, game: 'derby', totalCents: 1200, rounds: 1, status: 'ok', pay: 'credit', freq: 'once', allocations: [{ charityId: F, cents: 700 }, { charityId: G, cents: 500 }] });
  const HISTORY = rounds.slice();

  /** What the favourites should be, counted again here without the page's code: rounds per charity and per cause, then more rounds, more cents, later, id. */
  const expectedFavs = (history) => {
    const ch = {}, cs = {};
    history.forEach((r) => {
      const seenC = new Set(), seenK = new Set();
      r.allocations.forEach((a) => {
        const e = ch[a.charityId] || (ch[a.charityId] = { id: a.charityId, n: 0, cents: 0, last: 0 });
        if (!seenC.has(a.charityId)) { seenC.add(a.charityId); e.n++; }
        e.cents += a.cents; e.last = Math.max(e.last, r.ts);
        charity(a.charityId).causes.forEach((k) => {
          const c = cs[k] || (cs[k] = { id: k, n: 0, cents: 0, last: 0 });
          if (!seenK.has(k)) { seenK.add(k); c.n++; }
          c.cents += a.cents; c.last = Math.max(c.last, r.ts);
        });
      });
    });
    const order = (x, y) => y.n - x.n || y.cents - x.cents || y.last - x.last || (x.id < y.id ? -1 : 1);
    const top = (m) => Object.values(m).sort(order).slice(0, 3);
    return {
      causes: top(cs).map((e) => causeName(e.id) + ' | ' + plural(e.n, 'round', 'rounds') + ' · ' + money(e.cents)),
      charities: top(ch).map((e) => charity(e.id).name + ' | ' + plural(e.n, 'round', 'rounds') + ' · ' + money(e.cents))
    };
  };

  const saveOf = (cents, extra) => Object.assign({ v: 2, xp: Math.floor(cents / 10), totalCents: cents, plays: 20, streak: 2, bestStreak: 4 }, extra || {});
  const cardsOf = (n) => { const o = {}; IDS.slice(0, n).forEach((id, i) => { o[id] = { n: 1 + (i % 2), rarity: core.RARITIES[i % 4], ts: NOW }; }); return o; };
  const badgesOf = (n) => { const o = {}; core.BADGES.slice(0, n).forEach((b) => { o[b.id] = NOW - 86400e3; }); return o; };
  const rich = (cents, extra) => saveOf(cents, Object.assign({ plays: 80, streak: 6, bestStreak: 9, biggestCents: 12000, liveRounds: 7, verifies: 2, cards: cardsOf(31), badges: badgesOf(14), history: HISTORY,
    setClaims: { '2026-09': true, '2026-10': true }, charityCounts: Object.fromEntries(IDS.slice(0, 18).map((id) => [id, 2])) }, extra || {}));

  const seeded = async (save, opts, profile) => {
    const p = await newPage(opts || {});
    await p.addInitScript(([s, pr]) => { try { if (!sessionStorage.getItem('__seeded')) { if (s) { localStorage.setItem('givespin:v2', JSON.stringify(s)); } if (pr) { localStorage.setItem('givespin:x:profile', JSON.stringify(pr)); } sessionStorage.setItem('__seeded', '1'); } } catch (e) { /* ignore */ } }, [save, profile || null]);
    return p;
  };
  const ready = (p) => p.waitForFunction(() => window.GS && window.GS.app && document.body.classList.contains('is-ready'));
  const reseed = async (p, save, profile, hash) => {
    await p.evaluate(([s, pr, k]) => { localStorage.setItem('givespin:v2', JSON.stringify(s)); if (pr) { localStorage.setItem(k, JSON.stringify(pr)); } else { localStorage.removeItem(k); } }, [save, profile || null, KEY]);
    await p.reload({ waitUntil: 'load' });
    await ready(p);
    await go(p, hash || '#me');
    if ((hash || '#me') === '#me') { await p.waitForSelector('#view-me .phero__name'); }
  };
  const openMe = async (p) => { await openApp(p, '#me'); await p.waitForSelector('#view-me .phero__name'); };
  const noSideways = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const text = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; }, sel);
  const stored = (p) => p.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
  const heroOf = (p) => p.evaluate(() => {
    const q = (s) => { const e = document.querySelector('#view-me ' + s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
    const bar = document.querySelector('#view-me .phero [role="progressbar"]');
    return {
      name: q('.phero__name'), title: q('.phero__title'), rank: (document.querySelector('#view-me .phero__rank') || { firstChild: { textContent: null } }).firstChild.textContent.trim(), rname: q('.phero__rname'), next: q('.phero__next'), xp: q('.phero__xp'), hint: q('.phero__hint'),
      pct: bar && Number(bar.getAttribute('aria-valuenow')), barLabel: bar && bar.getAttribute('aria-label'),
      ring: !!document.querySelector('#view-me .phero .pframe__in > svg'), medal: q('.phero .pmedal b'), frame: (document.querySelector('#view-me .phero .pframe') || { className: '' }).className.replace(/\s+/g, ' ')
    };
  });

  /* ------------------------------------------------------------------------------------------------------ 25a */
  if (section('25a. My profile with an empty save: a friendly page, nothing unlocked, nothing invented')) {
    const problems0 = problems.length;
    const p = await newPage({ viewport: { width: 1366, height: 800 } });
    await openMe(p);
    check(await p.locator('#view-me h1').count() === 1 && await text(p, '#view-me h1') === 'My profile', 'the page has one h1, "My profile"');
    check((await p.title()).startsWith('My profile'), 'the tab title names the page', await p.title());
    const hero = await heroOf(p);
    check(hero.name === 'Mystery Giver' && /Pick one below/.test(hero.hint), 'with no name yet the card says "Mystery Giver" and where to pick one', hero);
    check(hero.rank === 'Level 1' && hero.rname === 'Rookie Giver' && hero.pct === 0 && !hero.ring && hero.medal === '1' && hero.title === null, 'a new player is "Level 1 · Rookie Giver" with the level medal (no rank emblem yet), no title and an empty bar', hero);
    check(/Next rank: Patron at \$1,000/.test(hero.next || '') && /\$1,000 to go/.test(hero.next || ''), 'the next goal is the first rank', hero.next);
    check(/pframe--plain/.test(hero.frame), 'the plain frame is round the medal', hero.frame);
    const stats = await p.evaluate(() => Array.from(document.querySelectorAll('#view-me .pstats .stat')).map((s) => s.querySelector('.stat__val').textContent.trim() + ' | ' + s.querySelector('.stat__lbl').textContent.replace(/\s+/g, ' ').trim()));
    check(stats.length === 4 && /^\$0 \| Total given/.test(stats[0]) && stats[1] === '0 days | Streak · best 0 days' && stats[2] === '0 | Rounds played' && stats[3] === '0 | Charities supported', 'four totals, all zero and in words', stats);
    const empties = await p.evaluate(() => Array.from(document.querySelectorAll('#view-me .empty')).map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
    check(empties.length === 4 && empties.filter((t) => /No favourites yet/.test(t)).length === 2 && empties.some((t) => /No cards yet/.test(t)) && empties.some((t) => /No gifts yet/.test(t)), 'every empty list says so in plain words and tells the visitor what to do', empties);
    check(await p.locator('#view-me .badge').count() === core.BADGES.length && await p.locator('#view-me .badge.is-locked').count() === core.BADGES.length, 'all ' + core.BADGES.length + ' badges are listed, every one dimmed as locked');
    const lockedHow = await p.evaluate(() => Array.from(document.querySelectorAll('#view-me .badge.is-locked')).every((b) => /^How to earn: /.test(b.querySelector('.badge__desc').textContent) && /Locked/.test(b.textContent)));
    check(lockedHow, 'each locked badge says how to earn it');
    check(await p.locator('#view-me .rgift').count() === 0 && await p.locator('#view-me [data-open-charity]').count() === 0, 'no recent gifts and no charity links when nothing has been given');
    check(await p.locator('#view-me [data-role="share"]').count() === 1 && /Share my profile/.test(await p.locator('#view-me [data-role="share"]').innerText()), 'the Share my profile button is shown now that the share cards exist');
    const frames = await p.evaluate(() => Array.from(document.querySelectorAll('#view-me [data-role="frames"] .pickcard')).map((l) => ({ id: l.querySelector('input').value, off: l.querySelector('input').disabled, on: l.querySelector('input').checked, how: /How to unlock: /.test(l.textContent) })));
    check(frames.length === 8 && frames.filter((f) => !f.off).map((f) => f.id).join() === 'plain' && frames.every((f) => f.off === f.how) && frames[0].on, 'eight frames are listed; only Plain is open and checked; each locked one says how to unlock it', frames);
    const titles = await p.evaluate(() => Array.from(document.querySelectorAll('#view-me [data-role="titles"] .pickcard')).map((l) => ({ id: l.querySelector('input').value, off: l.querySelector('input').disabled, on: l.querySelector('input').checked, how: /How to unlock: /.test(l.textContent) })));
    check(titles.length === 9 && titles[0].id === '' && titles[0].on && titles.slice(1).every((t) => t.off && t.how), 'nine title choices: "No title" is checked, the eight real titles are all locked and say how to unlock', titles);
    const words = await p.evaluate(() => document.querySelector('#view-me').innerText);
    check(!/\b(crypto(?!graphic)|bitcoin|ethereum|blockchain|wallet|NFTs?|tokens?|coins?|winnings|payout|prize|jackpot|cash out|real players)\b/i.test(words), 'the page uses none of the banned words');
    check(!/NaN|undefined|null|\[object/.test(words), 'no NaN, undefined or [object] anywhere on the page');
    check(await noSideways(p), 'no sideways scroll at 1366 px');
    await h.shot(p, '25a-profile-empty');
    await p.close();
    check(problems.length === problems0, 'section 25a: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ------------------------------------------------------------------------------------------------------ 25b */
  if (section('25b. A rich profile: totals, favourites, cards, badges and recent gifts are right')) {
    const problems0 = problems.length;
    const save = rich(750000);
    const p = await seeded(save, { viewport: { width: 1366, height: 800 } });
    await openMe(p);
    const stats = await p.evaluate(() => Array.from(document.querySelectorAll('#view-me .pstats .stat')).map((s) => s.querySelector('.stat__val').textContent.trim() + ' | ' + s.querySelector('.stat__lbl').textContent.replace(/\s+/g, ' ').trim()));
    check(stats[0].startsWith('$7,500 | Total given') && stats[1] === '6 days | Streak · best 9 days' && stats[2] === '80 | Rounds played' && stats[3] === '18 | Charities supported', 'total given, streak and best streak, rounds and charities come from the save', stats);
    const want = expectedFavs(HISTORY);
    const favs = await p.evaluate(() => Array.from(document.querySelectorAll('#view-me .pfavlist')).map((l) => Array.from(l.children).map((li) => li.querySelector('b').textContent + ' | ' + li.querySelector('small').textContent)));
    check(JSON.stringify(favs[0]) === JSON.stringify(want.causes), 'the favourite causes are the three with the most rounds, with counts (checked against a separate count)', { page: favs[0], want: want.causes });
    check(JSON.stringify(favs[1]) === JSON.stringify(want.charities), 'the favourite charities are the three with the most rounds, ties by the bigger gifts (A 5, B 4, C 3 beats D 3)', { page: favs[1], want: want.charities });
    check(want.charities[0].startsWith(charity(A).name) && want.charities[2].startsWith(charity(C).name), 'the data really has the tie the test is built on (C and D both 3 rounds)', want.charities);
    const marks = await p.evaluate(() => Array.from(document.querySelectorAll('#view-me .pfavlist')[1].querySelectorAll('.pfav__btn')).map((b) => ({ id: b.getAttribute('data-open-charity'), mark: !!b.querySelector('.cmono'), label: b.getAttribute('aria-label') })));
    check(marks.length === 3 && marks.every((m) => m.mark && /Open its profile/.test(m.label)) && marks[0].id === A, 'each favourite charity has its mark (ui.mono) and is a button that opens its profile', marks);
    check(/Worked out from your latest 17 rounds/.test(await text(p, '#view-me .pfavs + .tabnote') || ''), 'a line says the favourites come from the latest rounds (17 here)', await text(p, '#view-me .pfavs + .tabnote'));
    await p.locator('#view-me .pfav__btn').first().click();
    await p.waitForSelector('#dlg-profile[open]');
    check((await text(p, '#dlg-profile .prof__name') || '').includes(charity(A).name), 'tapping a favourite charity opens that charity\'s profile');
    await p.keyboard.press('Escape');
    await p.waitForFunction(() => !document.querySelector('#dlg-profile').open);
    const cards = await text(p, '#view-me [data-role="cards"]');
    check(/31 of 500 cards held/.test(cards) && /Monthly sets finished: 2/.test(cards), 'the cards section counts the cards held (31) and the monthly sets finished (2)', cards);
    const rar = await p.evaluate(() => Array.from(document.querySelectorAll('#view-me .prar')).map((r) => r.textContent.replace(/\s+/g, ' ').trim()));
    const byR = { common: 0, rare: 0, epic: 0, legendary: 0 }; Object.values(save.cards).forEach((c) => { byR[c.rarity]++; });
    check(JSON.stringify(rar) === JSON.stringify(['common', 'rare', 'epic', 'legendary'].map((r) => byR[r] + ' ' + r[0].toUpperCase() + r.slice(1))), 'the rarity counts are right', rar);
    const badges = await p.evaluate(() => ({ on: Array.from(document.querySelectorAll('#view-me .badge:not(.is-locked)')).length, off: Array.from(document.querySelectorAll('#view-me .badge.is-locked')).length, tag: document.querySelector('#view-me [data-role="badges"] .tag').textContent.trim(),
      when: Array.from(document.querySelectorAll('#view-me .badge:not(.is-locked) .badge__when')).every((e) => /^Unlocked [A-Z][a-z]{2} \d{1,2}, \d{4}$/.test(e.textContent.trim())) }));
    check(badges.on === 14 && badges.off === 10 && badges.tag === '14 / 24' && badges.when, '14 of 24 badges are shown as earned (with their date) and 10 dimmed as locked', badges);
    const recent = await p.evaluate(() => Array.from(document.querySelectorAll('#view-me .rgift')).map((g) => ({ id: g.getAttribute('data-open-charity'), amt: g.querySelector('.rgift__amt').textContent })));
    const firstEight = HISTORY.slice(0, 8).map((r) => ({ id: r.allocations[0].charityId, amt: money(r.totalCents) }));
    check(JSON.stringify(recent) === JSON.stringify(firstEight), 'Recent gifts shows the last eight rounds, newest first, with their amounts', { recent, firstEight });
    check(await p.evaluate(() => document.querySelectorAll('#view-me .rgift').length) === 8, 'exactly eight');
    await h.shot(p, '25b-profile-rich');
    // the page follows the save: a new round while it is open redraws it
    await p.evaluate(() => { document.activeElement.blur(); });
    await p.evaluate(() => { const s = GS.store.get(); s.totalCents += 100; GS.bus.emit('progress'); });
    await p.waitForFunction(() => /\$7,501/.test(document.querySelector('#view-me .pstats').textContent));
    check(true, 'the page redraws when progress changes while it is open');
    await p.close();
    check(problems.length === problems0, 'section 25b: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ------------------------------------------------------------------------------------------------------ 25c */
  if (section('25c. The card at the top at every rank boundary: "Rank 2 · Level 6", the emblem, the bar, the next goal')) {
    const problems0 = problems.length;
    const p = await seeded(saveOf(0), { viewport: { width: 1366, height: 800 } });
    await openMe(p);
    const cases = [0, 5000, 99999, 100000, 109999, 110000, 499999, 500000, 750000, 999999, 1000000, 2000000, 4999999, 5000000, 9999999, 10000000, 50000000, 99999999, 100000000, 190000000, 999999999];
    const bad = [];
    for (const cents of cases) {
      await reseed(p, saveOf(cents), null, '#me');
      const want = core.standingFor(Math.floor(cents / 10), cents);
      const g = await heroOf(p);
      const ok = g.rank === want.label && g.rname === want.name && g.pct === want.pct && g.ring === (want.rank > 0) && (want.rank > 0 ? g.medal === null : g.medal === String(want.level)) &&
        (want.maxed ? /top: Rank 8 · Level 10/.test(g.next) && g.barLabel === 'Top rank reached' : (/to go/.test(g.next) && g.barLabel === 'Progress to ' + want.nextLabel));
      if (!ok) { bad.push({ cents, want: [want.label, want.name, want.pct, want.rank], got: g }); }
      const theme = await p.evaluate(() => document.querySelector('#view-me [data-role="hero"]').getAttribute('style'));
      if ((want.rank > 0) !== /--rc:#[0-9a-f]{3,8}/i.test(theme || '')) { bad.push({ cents, theme }); }
    }
    check(bad.length === 0, 'at ' + cases.length + ' totals from $0 to $9,999,999.99 (every boundary and a cent either side) the card shows the right rank and level, name, bar and next goal, the emblem (or the level medal before $1,000) and the rank\'s colours', bad.slice(0, 3));
    // the words of one of them, in full
    await reseed(p, saveOf(750000), null, '#me');
    const g = await heroOf(p);
    check(g.rank === 'Rank 2 · Level 6' && g.rname === 'Benefactor' && /Next: Level 7 at \$8,000 \(\$500 to go\)/.test(g.next), '$7,500 reads "Rank 2 · Level 6", Benefactor, "Next: Level 7 at $8,000 ($500 to go)"', g);
    check(await p.locator('#view-me .phero .pframe__in svg').count() >= 1 && await p.locator('#view-me .phero .pframe__in svg [class*="rk-lit"]').count() === 6, 'the level ring has six lit segments for level 6', await p.locator('#view-me .phero .pframe__in svg [class*="rk-lit"]').count());
    // a link back to the Giving Club
    check(await p.locator('#view-me .phero a[href="#club"]').count() === 1, 'the card links to the Giving Club');
    await p.close();
    check(problems.length === problems0, 'section 25c: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ------------------------------------------------------------------------------------------------------ 25d */
  if (section('25d. The display name: edit it, see it, keep it after a reload, and every way it can be refused')) {
    const problems0 = problems.length;
    const p = await seeded(rich(750000), { viewport: { width: 1366, height: 800 } });
    await openMe(p);
    const input = p.locator('#me-name');
    check(await input.getAttribute('maxlength') === '40' && (await p.locator('label[for="me-name"]').innerText()).toLowerCase().includes('display name'), 'the field has a real label ("Display name")');
    check(/1 to 20 characters/.test(await text(p, '#me-name-hint')) && /only shown on this device/.test(await text(p, '#view-me .pedit__note')) && /cards you choose to share/.test(await text(p, '#view-me .pedit__note')), 'the hint gives the rules and one line says the name is only shown on this device and on cards that are shared');
    check(await p.locator('#view-me [data-role="clearname"]').count() === 0, 'there is no Clear button while no name is saved');
    const save = async (v) => { await input.fill(v); await p.click('#view-me [data-role="nameform"] button[type="submit"]'); await p.waitForTimeout(80); };
    const err = () => text(p, '#me-name-err');
    // refused
    const refusals = [
      ['', /Type a name, 1 to 20 characters/], ['    ', /Type a name/], ['<b>hi</b>', /cannot contain < or >/], ['<script>alert(1)</script>', /cannot contain < or >/],
      ['http://spam.example', /links or web addresses/], ['www.give.now', /links/], ['sam@example.com', /links/], ['spam.com', /links/],
      ['😀 party', /letters, numbers, spaces and simple punctuation/], ['{braces}', /simple punctuation/], ['!!!', /at least one letter or number/],
      ['A'.repeat(21), /21 characters\. 20 is the limit/], ['日本語'.repeat(8), /24 characters/], ['fuck', /not allowed here/], ['F u C k', /not allowed/], ['sh1t', /not allowed/]
    ];
    const bad = [];
    for (const [v, re] of refusals) {
      await save(v);
      const msg = await err();
      const inv = await input.getAttribute('aria-invalid');
      const focused = await p.evaluate(() => document.activeElement && document.activeElement.id === 'me-name');
      if (!(re.test(msg || '') && inv === 'true' && focused)) { bad.push({ v, msg, inv, focused }); }
    }
    check(bad.length === 0, 'each of ' + refusals.length + ' bad names (empty, tags, links, emoji, braces, too long, rude, disguised) gets a plain message, marks the field invalid and keeps focus in it', bad.slice(0, 3));
    check(await stored(p) === null, 'a refused name saves nothing');
    check(await p.locator('#me-name-err').getAttribute('role') === 'alert', 'the message is an alert, so a screen reader hears it');
    check(!/fuck|sh1t/i.test(await err() || ''), 'the message does not repeat the refused word', await err());
    // accepted
    await save('  Captain   Kind ');
    check(await text(p, '#view-me .phero__name') === 'Captain Kind' && await input.inputValue() === 'Captain Kind', 'a name with extra spaces is tidied and shown on the card at once');
    check(/Saved\. Your name is Captain Kind/.test(await text(p, '[data-role="ok"]') || '') && await input.getAttribute('aria-invalid') === 'false' && !(await err()), 'a calm "Saved" line (announced politely) replaces the error');
    check(await p.locator('#view-me [data-role="ok"]').getAttribute('role') === 'status', 'the saved line is a status message');
    check(JSON.stringify(await stored(p)) === JSON.stringify({ name: 'Captain Kind', frame: 'plain', title: '' }), 'it is stored under its own key (givespin:x:profile) as { name, frame, title }', await stored(p));
    check(JSON.parse(await p.evaluate(() => localStorage.getItem('givespin:v2'))).name === undefined && !/Captain/.test(await p.evaluate(() => localStorage.getItem('givespin:v2'))), 'and never in the main save');
    check(await p.locator('#view-me [data-role="clearname"]').count() === 1, 'a Clear button appears');
    check(await p.evaluate(() => GS.ui.displayName() === 'Captain Kind' && GS.ui.chosenName() === 'Captain Kind'), 'ui.displayName() and ui.chosenName() return it');
    // other kinds of name that are fine
    for (const v of ['Ünal Çelik', '日本語の名前', "Mary-Jane O'Neil", 'Tom & Jerry', 'A'.repeat(20), 'Zoë (the kind)']) {
      await save(v);
      const shown = await text(p, '#view-me .phero__name');
      check(shown === v && (await stored(p)).name === v, 'the name "' + v + '" is accepted and shown as typed (letters from other languages, punctuation, exactly 20 characters)', shown);
    }
    // it is text, never markup
    check(await p.locator('#view-me .phero__name *').count() === 0, 'the name is drawn as text');
    await save('Captain Kind');
    // persistence
    await p.reload({ waitUntil: 'load' });
    await ready(p);
    await go(p, '#me');
    await p.waitForSelector('#view-me .phero__name');
    check(await text(p, '#view-me .phero__name') === 'Captain Kind' && await p.locator('#me-name').inputValue() === 'Captain Kind', 'after a reload the name is still there, on the card and in the field');
    // clear
    await p.click('#view-me [data-role="clearname"]');
    check(await text(p, '#view-me .phero__name') === 'Mystery Giver' && await stored(p) !== null && (await stored(p)).name === '' && await p.locator('#me-name').inputValue() === '', 'Clear takes the name off the card and out of the field');
    check(/Name cleared/.test(await text(p, '[data-role="ok"]') || '') && await p.evaluate(() => document.activeElement.id) === 'me-name', 'it says so and keeps focus in the field');
    // saving an empty field while a name is saved clears it
    await save('Zed');
    await save('');
    check(await text(p, '#view-me .phero__name') === 'Mystery Giver', 'saving an empty field with a name saved clears it too');
    // Enter in the field saves
    await input.fill('Enter Key');
    await input.press('Enter');
    check(await text(p, '#view-me .phero__name') === 'Enter Key', 'pressing Enter in the field saves');
    await p.close();

    // a stored profile that was edited by hand: nothing unsafe gets in
    const q = await seeded(rich(750000), { viewport: { width: 1366, height: 800 } }, { name: '<img src=x onerror="window.__pwn=1">', frame: '<b>x</b>', title: '"><script>window.__pwn=2</script>' });
    await openMe(q);
    const hero = await heroOf(q);
    check(hero.name === 'Mystery Giver' && /pframe--plain/.test(hero.frame) && hero.title === null, 'a hand-edited profile with markup in its name, frame and title is read as no name, the plain frame and no title', hero);
    check(await q.evaluate(() => window.__pwn === undefined && !document.querySelector('#view-me img[src="x"]') && !document.querySelector('#view-me script')), 'nothing from it ran or was added to the page');
    await q.close();
    const r = await seeded(rich(750000), { viewport: { width: 1366, height: 800 } }, { name: 'fuck', frame: 'rays', title: 'giver' });
    await openMe(r);
    const hr = await heroOf(r);
    check(hr.name === 'Mystery Giver' && /pframe--plain/.test(hr.frame) && hr.title === 'Giver', 'a rude stored name is dropped, a frame that is still locked ($7,500 is not Rank 3) falls back to plain, and an open title is kept', hr);
    await r.close();
    check(problems.length === problems0, 'section 25d: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ------------------------------------------------------------------------------------------------------ 25e */
  if (section('25e. Frames and titles: locked ones say how to unlock, open ones can be picked, the keyboard works, a reset closes them again')) {
    const problems0 = problems.length;
    // $7,500 (rank 2): laurel and halo open; best streak 4 keeps flame closed, 5 badges keep stars closed, 12 cards keep hex closed, no finished set keeps diamond closed, rank 2 keeps rays closed
    const save = saveOf(750000, { plays: 20, streak: 2, bestStreak: 4, biggestCents: 12000, liveRounds: 2, verifies: 0, cards: cardsOf(12), badges: badgesOf(5), history: HISTORY, charityCounts: Object.fromEntries(IDS.slice(0, 10).map((id) => [id, 1])) });
    const p = await seeded(save, { viewport: { width: 1366, height: 800 } });
    await openMe(p);
    const state = (kind) => p.evaluate((k) => Array.from(document.querySelectorAll('#view-me [data-role="' + k + 's"] .pickcard')).map((l) => { const i = l.querySelector('input'); return { id: i.value, off: i.disabled, on: i.checked, lock: (l.querySelector('.pickcard__lock') || { textContent: '' }).textContent.trim() }; }), kind);
    const openFrames = ['plain', 'laurel', 'halo'];
    const fr = await state('frame');
    check(fr.filter((f) => !f.off).map((f) => f.id).join() === openFrames.join() && fr.filter((f) => f.off).map((f) => f.id).join() === 'flame,stars,hex,diamond,rays', 'frames: Plain, Laurel and Halo are open; Flame, Stars, Hexagon, Diamond and Sunburst are locked', fr);
    check(fr.filter((f) => f.off).every((f) => /^Locked\. How to unlock: .{8,}/.test(f.lock)), 'every locked frame has a plain "Locked. How to unlock: ..." line', fr.filter((f) => f.off).map((f) => f.lock));
    const lockText = Object.fromEntries(fr.map((f) => [f.id, f.lock]));
    check(/7 days/.test(lockText.flame) && /12 badges/.test(lockText.stars) && /25 cards/.test(lockText.hex) && /monthly card set/.test(lockText.diamond) && /Champion/.test(lockText.rays) && /\$10,000/.test(lockText.rays), 'the lines say the real rules (7 days, 12 badges, 25 cards, a monthly set, Champion at $10,000)', lockText);
    const tt = await state('title');
    // streak keeper (5 days) closed, set collector closed, explorer (10 charities) open, high roller ($120 round) open, giver open, table regular (2 of 5) closed, fair play (0) closed, rank climber open (rank 2)
    check(tt.filter((t) => t.id && !t.off).map((t) => t.id).join() === 'giver,explorer,high-roller,rank-climber', 'titles: Giver, Charity Explorer, High Roller and Rank Climber are open for this save; the other four are locked', tt.map((t) => t.id + (t.off ? '-' : '+')));
    // clicking a locked card does nothing
    await p.locator('#view-me .pickcard:has(input[value="flame"])').click({ force: true });
    check((await stored(p)) === null && /pframe--plain/.test((await heroOf(p)).frame), 'clicking a locked frame changes nothing');
    // pick an open one with the mouse
    await p.locator('#view-me .pickcard:has(input[value="laurel"])').click();
    check((await stored(p)).frame === 'laurel' && /pframe--laurel/.test((await heroOf(p)).frame) && await p.locator('#view-me .phero .pframe__art ellipse').count() === 40, 'picking Laurel saves it and draws the wreath (40 leaves) round the emblem');
    check(/Frame: Laurel/.test((await h.toastText(p)).join(' ')), 'a toast confirms it');
    check(await p.locator('#view-me .pickcard.is-on:has(input[value="laurel"])').count() === 1 && await p.locator('#view-me [data-role="frames"] .pickcard.is-on').count() === 1, 'exactly one frame card is marked as chosen');
    // keyboard: the radio group moves with the arrow keys, skipping locked ones
    await p.focus('#view-me input[name="me-frame"]:checked');
    await p.keyboard.press('ArrowRight');
    check((await stored(p)).frame === 'halo' && /pframe--halo/.test((await heroOf(p)).frame), 'with the keyboard, the arrow key goes from Laurel to the next open frame (Halo), skipping the locked ones');
    await p.keyboard.press('ArrowLeft');
    check((await stored(p)).frame === 'laurel', 'and back again');
    // titles
    await p.locator('#view-me .pickcard:has(input[value="high-roller"])').click();
    let hero = await heroOf(p);
    check(hero.title === 'High Roller' && (await stored(p)).title === 'high-roller', 'picking the High Roller title shows it under the name', hero);
    await p.locator('#view-me .pickcard:has(input[value=""])').click();
    check((await heroOf(p)).title === null && (await stored(p)).title === '', '"No title" takes it off again');
    await p.locator('#view-me .pickcard:has(input[value="giver"])').click();
    check(await text(p, '#view-me .phero__title') === 'Giver', 'Giver is picked');
    check(await p.evaluate(() => { const c = GS.ui.profile.current(); return c.frame.id === 'laurel' && c.title.id === 'giver' && c.standing.rank === 2 && c.facts.cardsOwned === 12 && c.name === ''; }), 'ui.profile.current() hands the share card the frame, title, standing and numbers');
    // after a reload they are still chosen
    await p.reload({ waitUntil: 'load' }); await ready(p); await go(p, '#me'); await p.waitForSelector('#view-me .phero__name');
    hero = await heroOf(p);
    check(/pframe--laurel/.test(hero.frame) && hero.title === 'Giver' && await p.locator('#view-me input[name="me-frame"]:checked').getAttribute('value') === 'laurel', 'the frame and the title are still chosen after a reload');
    // a reset closes what was earned: the choice falls back to plain / none, and the picker says why
    await p.evaluate(() => { GS.store.reset(); GS.bus.emit('progress'); });
    await p.waitForTimeout(150);
    hero = await heroOf(p);
    check(/pframe--plain/.test(hero.frame) && hero.title === null && hero.rank === 'Level 1', 'after "reset my progress" the card is Level 1 with the plain frame and no title (the choices are no longer open)', hero);
    const after = await state('frame');
    check(after.filter((f) => !f.off).map((f) => f.id).join() === 'plain' && after.find((f) => f.id === 'laurel').lock.includes('$100'), 'and the picker shows Laurel as locked again with "Give $100 in total."');
    check(await p.evaluate(() => GS.local.get('profile').frame === 'laurel'), 'the choice itself is kept, so earning it again brings it back');
    // a feature that registers another frame and title: it appears, locked, with its own how-to line
    await p.evaluate(() => {
      GS.profileFrames.add({ id: 'season-gold', name: 'Season Gold', description: 'For the season track.', how: 'Reach tier 30 of the season track.', unlocked: () => false });
      GS.profileTitles.add({ id: 'quest-master', name: 'Quest Master', description: 'Finishes quests.', how: 'Finish 10 quests.', unlocked: () => true });
      GS.ui.pages.me();
    });
    const more = await p.evaluate(() => ({ f: Array.from(document.querySelectorAll('#view-me [data-role="frames"] .pickcard')).length, t: Array.from(document.querySelectorAll('#view-me [data-role="titles"] .pickcard')).length,
      sg: document.querySelector('#view-me .pickcard:has(input[value="season-gold"])').textContent, qm: document.querySelector('#view-me .pickcard:has(input[value="quest-master"]) input').disabled }));
    check(more.f === 9 && more.t === 10 && /Reach tier 30 of the season track/.test(more.sg) && more.qm === false, 'GS.profileFrames.add / GS.profileTitles.add: a feature\'s own frame (locked, with its line) and title (open) show up in the pickers', more);
    check(await p.locator('#view-me .pickcard:has(input[value="season-gold"]) .pframe--season-gold').count() === 1 && await p.locator('#view-me .pickcard:has(input[value="season-gold"]) .pframe__art circle').count() === 2, 'a frame with no picture of its own is drawn as the plain ring');
    check(await noSideways(p), 'no sideways scroll');
    await h.shot(p, '25e-profile-pickers');
    await p.close();
    check(problems.length === problems0, 'section 25e: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ------------------------------------------------------------------------------------------------------ 25f */
  if (section('25f. Where the name shows (account menu, league, live feed, crews), where it stays as it was, and "Erase my data"')) {
    const problems0 = problems.length;
    const signed = rich(750000, { account: ADA });
    // 1. no name chosen: everything is exactly as before
    const a = await seeded(signed, { viewport: { width: 1366, height: 800 } });
    await openApp(a, '#leagues');
    check(await a.evaluate(() => GS.ui.displayName()) === 'Ada Lovelace' && await a.evaluate(() => GS.ui.chosenName()) === '', 'signed in with no name chosen: displayName() is the account name and chosenName() is empty');
    check(await text(a, '#view-leagues .lrow.is-you .lrow__name') !== null && (await text(a, '#view-leagues .lrow.is-you .lrow__name')).startsWith('Ada Lovelace'), 'the league row is the account name, as before');
    check(/Account menu for Ada Lovelace, Rank 2, Benefactor, level 6/.test(await a.locator('#acct [data-role="toggle"]').getAttribute('aria-label')), 'the account button is named as before');
    check(await a.locator('#acct .avatar').first().innerText() === 'AL', 'the avatar is "AL"');
    // crews: join and talk
    await a.evaluate(() => { GS.crews.join(GS.crews.CREWS[0].id); GS.crews.say('hello there'); });
    await go(a, '#crews');
    check((await text(a, '#view-crews .cmsg.is-you b')) === 'You' && (await text(a, '#view-crews .crewmates .is-you')).startsWith('You'), 'with no name chosen the crew chat and the crewmate list still say "You"');
    await a.close();
    const s0 = await seeded(rich(750000), { viewport: { width: 1366, height: 800 } });
    await openApp(s0, '#leagues');
    check((await text(s0, '#view-leagues .lrow.is-you .lrow__name')).startsWith('You'), 'signed out with no name chosen: the league row says "You", as before');
    await s0.close();

    // 2. a name chosen: it shows in all of them
    const p = await seeded(signed, { viewport: { width: 1366, height: 800 } }, { name: 'Captain Kind', frame: 'plain', title: '' });
    await openApp(p, '#leagues');
    check((await text(p, '#view-leagues .lrow.is-you .lrow__name')).startsWith('Captain Kind') && (await text(p, '#view-leagues .lrow.is-you')).includes('(you)'), 'the league row shows the chosen name and still says "(you)"');
    check(/Account menu for Captain Kind, Rank 2, Benefactor, level 6/.test(await p.locator('#acct [data-role="toggle"]').getAttribute('aria-label')) && await p.locator('#acct .avatar').first().innerText() === 'CK', 'the account button names the chosen name and its avatar is "CK"');
    await p.click('#acct [data-role="toggle"]');
    check(await text(p, '#acct .acct__who b') === 'Captain Kind', 'the account menu shows the chosen name');
    await p.keyboard.press('Escape');
    await p.evaluate(() => { GS.crews.join(GS.crews.CREWS[0].id); GS.crews.say('hello there'); });
    await go(p, '#crews');
    check((await text(p, '#view-crews .cmsg.is-you b')) === 'Captain Kind' && (await text(p, '#view-crews .crewmates .is-you')).startsWith('Captain Kind'), 'the crew chat and the crewmate list show the chosen name');
    // live feed
    await go(p, '#live-derby');
    await p.evaluate(() => { const r = GS.live.room('derby'); r._clearTimers(); r._note({ kind: 'join', who: 'you', name: 'You', dollars: 20, charityId: GS.charities[0].id }); });
    await p.click('#tab-feed');
    await p.waitForFunction(() => document.querySelectorAll('#tabp .feed__row').length >= 1);
    check((await text(p, '#tabp .feed__row.is-you b')) === 'Captain Kind', 'the live table\'s feed shows the chosen name where it said "You"');
    // changing the name while the feed is on screen shows the new name next time it is drawn
    await p.evaluate(() => { GS.local.set('profile', { name: 'Second Name', frame: 'plain', title: '' }); GS.ui.game.refreshLiveTab(); });
    check((await text(p, '#tabp .feed__row.is-you b')) === 'Second Name', 'a changed name reaches the feed without anything else changing (the feed\'s cache knows the name)');
    await p.close();

    // 3. changing the name on the profile page changes the account button at once
    const q = await seeded(signed, { viewport: { width: 1366, height: 800 } });
    await openMe(q);
    await q.fill('#me-name', 'Lady Ada');
    await q.press('#me-name', 'Enter');
    check(/Account menu for Lady Ada/.test(await q.locator('#acct [data-role="toggle"]').getAttribute('aria-label')), 'saving a name on the profile page updates the account button straight away');
    await q.click('#view-me [data-role="clearname"]');
    check(/Account menu for Ada Lovelace/.test(await q.locator('#acct [data-role="toggle"]').getAttribute('aria-label')) && (await text(q, '#view-me .phero__name')) === 'Ada Lovelace', 'clearing it goes back to the account name (the card shows it too)');
    check(await q.locator('#view-me .phero__hint').count() === 0, 'with an account name the "No name yet" hint is gone');

    // 4. Erase my data wipes it
    await q.fill('#me-name', 'Erase Me');
    await q.press('#me-name', 'Enter');
    await q.click('#acct [data-role="toggle"]');
    await q.click('#acct [data-role="settings"]');
    await q.waitForSelector('#dlg-settings[open]');
    const erase = q.locator('#dlg-settings [data-role="erase"]');
    await erase.click();
    await erase.click();
    await q.waitForFunction(() => !document.querySelector('#dlg-settings').open);
    check(await stored(q) === null && await q.evaluate(() => GS.ui.displayName() === '' && GS.ui.chosenName() === ''), '"Erase my data on this device" erases the profile too (name, frame and title)');
    await q.close();
    check(problems.length === problems0, 'section 25f: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ------------------------------------------------------------------------------------------------------ 25g */
  if (section('25g. The profile is reachable: the account menu, the side level card and the Giving Club (and the card still says the rank)')) {
    const problems0 = problems.length;
    const p = await seeded(rich(750000, { account: ADA }), { viewport: { width: 1366, height: 800 } });
    await openApp(p);
    await p.click('#acct [data-role="toggle"]');
    const items = await p.evaluate(() => Array.from(document.querySelectorAll('#acct .acct__item')).map((a) => a.textContent.trim()));
    check(items[0] === 'My profile' && items.includes('My Giving') && items.includes('Giving Club'), 'the account menu has "My profile" (first), and still My Giving and Giving Club', items);
    await p.click('#acct a[href="#me"]');
    await h.onRoute(p, 'me');
    check(await p.locator('#view-me').isVisible() && await p.evaluate(() => document.querySelector('#acct .acct__menu').hidden), 'it opens the profile and closes the menu');
    await go(p, '#lobby');
    // the side card
    const card = p.locator('#side-level a.lvlcard');
    check(await card.getAttribute('href') === '#me' && /^Rank 2, Benefactor, level 6\. Open your profile$/.test(await card.getAttribute('aria-label')), 'the side card links to #me and its accessible name still says the rank and level ("Rank 2, Benefactor, level 6. Open your profile")', await card.getAttribute('aria-label'));
    await card.click();
    await h.onRoute(p, 'me');
    check(await p.locator('#view-me').isVisible() && await p.evaluate(() => document.title.startsWith('My profile')), 'clicking the side card opens the profile, not the Giving Club');
    check(await p.locator('.side__link[href="#club"]').count() === 1, 'the Giving Club is still in the nav');
    // the Giving Club has a way over
    await go(p, '#club');
    check(await p.locator('#view-club a.btn[href="#me"]').count() === 1, 'the Giving Club page has a "My profile" button');
    await p.click('#view-club a.btn[href="#me"]');
    await h.onRoute(p, 'me');
    check(await p.locator('#view-me').isVisible(), 'which opens the profile');
    // a level card before $1,000
    await reseed(p, saveOf(50000, { xp: 1500 }), null, '#lobby');
    const lv = p.locator('#side-level a.lvlcard');
    check(await lv.getAttribute('href') === '#me' && /^Level 5, Heart Hustler\. Open your profile$/.test(await lv.getAttribute('aria-label')), 'before the first rank the card links to the profile too and says "Level 5, Heart Hustler"', await lv.getAttribute('aria-label'));
    await p.close();
    // a phone has no side card: the Giving Club button is the way over, and it works there
    const ph = await seeded(saveOf(0), { viewport: { width: 390, height: 844 }, mobile: true });
    await openApp(ph, '#club');
    check(await ph.locator('#view-club a.btn[href="#me"]').isVisible(), 'on a phone the Giving Club page shows the "My profile" button (the side card is not there)');
    await ph.tap('#view-club a.btn[href="#me"]');
    await h.onRoute(ph, 'me');
    check(await ph.locator('#view-me').isVisible(), 'and it opens the profile');
    await ph.close();
    check(problems.length === problems0, 'section 25g: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ------------------------------------------------------------------------------------------------------ 25h */
  if (section('25h. A simulated player\'s profile: from a live table, the league and a crew; always labelled a bot')) {
    const problems0 = problems.length;
    const p = await seeded(rich(750000), { viewport: { width: 1366, height: 800 } });
    await openApp(p, '#live-derby');
    await p.click('#tab-feed');
    await p.waitForFunction(() => document.querySelectorAll('#tabp .feed__row button[data-bot]').length >= 3, null, { timeout: 30000 });
    await p.evaluate(() => { GS.live.room('derby')._clearTimers(); });
    const btn = await p.evaluate(() => Array.from(document.querySelectorAll('#tabp .feed__row button[data-bot]')).map((b) => ({ name: b.getAttribute('data-bot'), text: b.textContent, label: b.getAttribute('aria-label'), type: b.type, tab: b.tabIndex, inFeedRow: !!b.closest('.feed__row') })));
    check(btn.length >= 3 && btn.every((b) => b.type === 'button' && b.tab === 0 && b.text === b.name && b.label === b.name + ', simulated player. Open details' && b.inFeedRow), 'every bot name in the live feed is a real button (in the tab order, named "<name>, simulated player. Open details")', btn.slice(0, 3));
    const name = btn[0].name;
    // keyboard: focus it, press Enter
    await p.focus('#tabp .feed__row button[data-bot]');
    await p.keyboard.press('Enter');
    await p.waitForSelector('#dlg-bot[open]');
    const dlg = await p.evaluate(() => {
      const d = document.querySelector('#dlg-bot');
      const t = (s) => { const e = d.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
      return { title: t('#dlg-bot-title'), note: t('.bot__note'), rank: t('.bot__rank b'), rname: t('.bot__rank span'), facts: Array.from(d.querySelectorAll('.facts__row')).map((r) => r.textContent.replace(/\s+/g, ' ').trim()), emblem: !!d.querySelector('.bot__emblem svg'), medal: !!d.querySelector('.bot__emblem .pmedal'),
        labelledby: d.getAttribute('aria-labelledby'), pill: !!d.querySelector('#dlg-bot-title .botpill'), focusIn: d.contains(document.activeElement), full: d.textContent.replace(/\s+/g, ' ') };
    });
    const want = core.botStanding(name);
    check(dlg.title === name + ' BOT' && dlg.labelledby === 'dlg-bot-title' && dlg.pill, 'the dialog is named after the bot and carries the BOT pill', dlg);
    check(dlg.note === 'BOT: a simulated player. Everything here is made up.', 'it says, clearly, "BOT: a simulated player. Everything here is made up."', dlg.note);
    check(dlg.rank === want.label && dlg.rname === want.name && (want.rank > 0 ? dlg.emblem && !dlg.medal : dlg.medal), 'it shows the bot\'s rank as "' + want.label + '" (core.botStanding) with its emblem' + (want.rank ? '' : ' (a level medal: this bot has no rank)'), dlg);
    check(dlg.facts.length === 5 && dlg.facts.every((f) => /\(made up\)$/.test(f)) && dlg.facts.some((f) => /^Habit/.test(f)) && dlg.facts.some((f) => /^Favourite cause/.test(f)) && dlg.facts.some((f) => /^Pretend streak ?\d+ days? \(made up\)$/.test(f)), 'five made-up details (title, favourite cause and game, habit, pretend streak), each marked "(made up)"', dlg.facts);
    check(!/real player|real people|follow|message them/i.test(dlg.full.replace('nothing to follow or message', '')), 'it never claims a real person', dlg.full);
    check(dlg.focusIn, 'focus moved into the dialog');
    // the details are the same every time for the same name
    const again = await p.evaluate((n) => { GS.ui.profile.openBot(n); return Array.from(document.querySelectorAll('#dlg-bot .facts__row')).map((r) => r.textContent.replace(/\s+/g, ' ').trim()); }, name).catch(() => null);
    check(again === null || JSON.stringify(again) === JSON.stringify(dlg.facts), 'opening it again gives the same details');
    await p.keyboard.press('Escape');
    await p.waitForFunction(() => !document.querySelector('#dlg-bot').open);
    check(await p.evaluate((n) => document.activeElement && document.activeElement.getAttribute('data-bot') === n, name), 'Escape closes it and focus goes back to the name that opened it');
    // mouse: open, close with the button, focus returns
    await p.locator('#tabp .feed__row button[data-bot]').first().click();
    await p.waitForSelector('#dlg-bot[open]');
    await p.click('#dlg-bot [data-role="bot-close"]');
    await p.waitForFunction(() => !document.querySelector('#dlg-bot').open);
    check(await p.evaluate((n) => document.activeElement && document.activeElement.getAttribute('data-bot') === n, name), 'the Close button does the same');
    // the X in the corner
    await p.locator('#tabp .feed__row button[data-bot]').first().click();
    await p.waitForSelector('#dlg-bot[open]');
    await p.click('#dlg-bot .modal__close');
    await p.waitForFunction(() => !document.querySelector('#dlg-bot').open);
    // the feed is redrawn while the dialog is open: focus goes to the same name in the new list
    await p.locator('#tabp .feed__row button[data-bot]').first().click();
    await p.waitForSelector('#dlg-bot[open]');
    await p.evaluate(() => { const f = document.querySelector('#tabp'); f.innerHTML = f.innerHTML; });
    await p.keyboard.press('Escape');
    await p.waitForFunction(() => !document.querySelector('#dlg-bot').open);
    check(await p.evaluate((n) => { const a = document.activeElement; return !!a && a.getAttribute('data-bot') === n && document.contains(a); }, name), 'if the table redraws its feed while the dialog is open, focus still goes back to that name in the new list');
    check(await p.evaluate(() => !!document.querySelector('#dlg-bot').querySelector('.bot__note')), 'the label is part of the dialog every time');
    // a name that is not a bot name at all: nothing breaks and it is still labelled
    await p.evaluate(() => GS.ui.profile.openBot('<img src=x onerror=window.__pwn=1> "quoted" & co'));
    const odd = await p.evaluate(() => ({ title: document.querySelector('#dlg-bot-title').textContent, img: !!document.querySelector('#dlg-bot img'), pwn: window.__pwn, note: document.querySelector('#dlg-bot .bot__note').textContent }));
    check(odd.title.startsWith('<img src=x') && !odd.img && odd.pwn === undefined && /simulated player/.test(odd.note), 'a name with markup in it is shown as text and the dialog is still labelled', odd);
    await p.keyboard.press('Escape');
    await p.evaluate(() => GS.ui.profile.openBot(''));
    check(!(await p.evaluate(() => document.querySelector('#dlg-bot').open)), 'an empty name opens nothing');
    check(await noSideways(p), 'no sideways scroll with the buttons in the feed');
    await h.shot(p, '25h-live-feed-bots');
    // the league: rivals are buttons too, you are not
    await go(p, '#leagues');
    const lg = await p.evaluate(() => ({ rivals: document.querySelectorAll('#view-leagues .lrow:not(.is-you) button[data-bot]').length, rows: document.querySelectorAll('#view-leagues .lrow').length, you: document.querySelectorAll('#view-leagues .lrow.is-you button[data-bot]').length }));
    check(lg.rows === 15 && lg.rivals === 14 && lg.you === 0, 'in the weekly league the 14 simulated rivals are buttons and the visitor\'s own row is not', lg);
    await p.locator('#view-leagues .lrow:not(.is-you) button[data-bot]').nth(2).click();
    await p.waitForSelector('#dlg-bot[open]');
    check(/BOT: a simulated player/.test(await text(p, '#dlg-bot .bot__note')), 'a rival opens the same labelled dialog');
    await p.keyboard.press('Escape');
    // crews: crewmates
    await p.evaluate(() => { GS.crews.join(GS.crews.CREWS[1].id); });
    await go(p, '#crews');
    const cm = await p.evaluate(() => ({ mates: document.querySelectorAll('#view-crews .crewmates button[data-bot]').length, all: document.querySelectorAll('#view-crews .crewmates li').length }));
    check(cm.mates >= 3 && cm.mates === cm.all - 1, 'in a crew every crewmate is a button and "You" is not', cm);
    await p.locator('#view-crews .crewmates button[data-bot]').first().click();
    await p.waitForSelector('#dlg-bot[open]');
    check(await p.evaluate(() => document.querySelector('#dlg-bot').open), 'a crewmate opens it too');
    await p.keyboard.press('Escape');
    await p.close();

    // a bot with a rank (the two pinned ones) and one without, at phone size, touch
    const ph = await seeded(saveOf(0), { viewport: { width: 390, height: 844 }, mobile: true });
    await openApp(ph);
    for (const n of ['CharityCat', 'BigHeartBen', 'PocketAces', 'NovaGiver', 'MapleMoon']) {
      await ph.evaluate((x) => GS.ui.profile.openBot(x), n);
      const g = await ph.evaluate(() => ({ rank: document.querySelector('#dlg-bot .bot__rank b').textContent, emb: !!document.querySelector('#dlg-bot .bot__emblem svg'), w: document.querySelector('#dlg-bot').getBoundingClientRect().width, sw: document.documentElement.scrollWidth <= window.innerWidth + 1 }));
      const w = core.botStanding(n);
      check(g.rank === w.label && g.emb === (w.rank > 0) && g.w <= 390 && g.sw, n + ' on a phone: "' + w.label + '"' + (w.rank ? ', with its emblem' : ', a level medal') + ', and the dialog fits the screen', g);
      await ph.keyboard.press('Escape');
    }
    await ph.close();
    check(problems.length === problems0, 'section 25h: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ------------------------------------------------------------------------------------------------------ 25i */
  if (section('25i. Accessibility scans of the profile page and the bot dialog (laptop, phone, phone held sideways)')) {
    const problems0 = problems.length;
    const sizes = [['a laptop', { width: 1366, height: 768 }, false], ['a phone', { width: 390, height: 844 }, true], ['a phone held sideways', { width: 844, height: 390 }, true]];
    for (const [name, viewport, mobile] of sizes) {
      const p = await seeded(saveOf(0), { viewport, mobile });
      await openMe(p);
      await a11y(p, 'My profile with no data on ' + name);
      await reseed(p, rich(750000, { account: ADA }), { name: 'Captain Kind', frame: 'laurel', title: 'giver' }, '#me');
      await a11y(p, 'My profile with data, a name, a frame and a title on ' + name);
      await reseed(p, rich(100000000), { name: 'WWWWWWWWWWWWWWWWWWWW', frame: 'rays', title: 'high-roller' }, '#me');
      await a11y(p, 'My profile at the top rank with a 20-letter name on ' + name);
      await p.fill('#me-name', '<b>');
      await p.press('#me-name', 'Enter');
      await a11y(p, 'My profile with an error showing on ' + name);
      await p.evaluate(() => GS.ui.profile.openBot('PocketAces'));
      await a11y(p, 'the bot dialog (an unranked bot) on ' + name);
      await p.keyboard.press('Escape');
      await p.evaluate(() => GS.ui.profile.openBot('CharityCat'));
      await a11y(p, 'the bot dialog (an Immortal bot) on ' + name);
      await p.keyboard.press('Escape');
      await p.close();
    }
    // the live feed with its buttons, and the league
    const lp = await seeded(rich(750000), { viewport: { width: 1366, height: 768 } });
    await openApp(lp, '#live-derby');
    await h.a11y(lp, 'a live table\'s page before the feed is opened');
    await lp.click('#tab-feed');
    await lp.waitForFunction(() => document.querySelectorAll('#tabp .feed__row button[data-bot]').length >= 3, null, { timeout: 30000 });
    await lp.evaluate(() => { GS.live.room('derby')._clearTimers(); });
    await a11y(lp, 'the live feed with bot names as buttons');
    await go(lp, '#leagues');
    await a11y(lp, 'the league with bot names as buttons');
    await lp.close();
    check(problems.length === problems0, 'section 25i: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ------------------------------------------------------------------------------------------------------ 25j */
  if (section('25j. The profile page never scrolls sideways, from 320 to 2560 px')) {
    const problems0 = problems.length;
    const p = await seeded(rich(100000000, { account: ADA }), { viewport: { width: 1366, height: 800 } }, { name: 'WWWWWWWWWWWWWWWWWWWW', frame: 'rays', title: 'high-roller' });
    await openMe(p);
    const bad = [];
    for (const w of [320, 360, 390, 414, 600, 768, 820, 1024, 1180, 1280, 1366, 1440, 1920, 2560]) {
      await p.setViewportSize({ width: w, height: w < 700 ? 800 : 900 });
      await p.waitForTimeout(160);
      const m = await p.evaluate(() => {
        const vw = window.innerWidth;
        const over = Array.from(document.querySelectorAll('#view-me *')).filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > vw + 1 || r.left < -1) && !e.closest('svg'); })   // (the drawings' own insides are clipped by their emblem; the page-level check is scrollWidth).slice(0, 3).map((e) => String(e.getAttribute('class') || e.tagName));
        const hero = document.querySelector('#view-me .phero').getBoundingClientRect();
        return { sideways: document.documentElement.scrollWidth > vw + 1, over, heroR: Math.round(hero.right), vw, frame: Math.round(document.querySelector('#view-me .phero .pframe').getBoundingClientRect().width) };
      });
      if (m.sideways || m.over.length) { bad.push([w, m]); }
    }
    check(bad.length === 0, 'with a 20-letter name, the highest rank and every section full there is no sideways scroll at 14 widths from 320 to 2560 px, and nothing sticks out of the page', bad.slice(0, 3));
    await p.setViewportSize({ width: 320, height: 800 });
    await p.waitForTimeout(150);
    const frame = await p.evaluate(() => Math.round(document.querySelector('#view-me .phero .pframe').getBoundingClientRect().width));
    check(frame >= 150 && frame <= 240, 'the big emblem is still big on a 320 px phone (' + frame + ' px)', frame);
    await reseed(p, saveOf(0), null, '#me');
    await p.setViewportSize({ width: 320, height: 800 });
    check(await noSideways(p), 'an empty profile at 320 px does not scroll sideways either');
    await p.close();
    // the dialog and the feed at the smallest sizes
    const q = await seeded(saveOf(0), { viewport: { width: 320, height: 568 }, mobile: true });
    await openApp(q);
    await q.evaluate(() => GS.ui.profile.openBot('CharityCat'));
    const d = await q.evaluate(() => { const r = document.querySelector('#dlg-bot .modal__card').getBoundingClientRect(); return { l: r.left, r: r.right, w: window.innerWidth, sw: document.documentElement.scrollWidth <= window.innerWidth + 1 }; });
    check(d.l >= 0 && d.r <= d.w && d.sw, 'the bot dialog fits a 320 px phone', d);
    await q.close();
    check(problems.length === problems0, 'section 25j: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ------------------------------------------------------------------------------------------------------ 25k */
  if (section('25k. Reduced motion and the Share button')) {
    const problems0 = problems.length;
    const motionOf = (page) => page.evaluate(() => {
      const name = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).animationName : null; };
      return { fl: name('#view-me .phero .fl'), st: name('#view-me .phero .st'), halo: name('#view-me .phero .halo'), spin: name('#view-me .phero .spin') };
    });
    const withFrame = async (page, frame) => { await page.evaluate((f) => { GS.local.set('profile', { name: '', frame: f, title: '' }); GS.ui.pages.me(); }, frame); await page.waitForTimeout(60); return motionOf(page); };
    const calm = await seeded(rich(100000000), { viewport: { width: 1366, height: 800 }, reducedMotion: 'reduce' });
    await openMe(calm);
    const still = [];
    for (const f of ['flame', 'stars', 'halo', 'rays']) { const m = await withFrame(calm, f); still.push(Object.values(m).filter((v) => v !== null)[0]); }
    check(still.length === 4 && still.every((v) => v === 'none'), 'with reduced motion on, the flame, stars, halo and sunburst frames do not animate', still);
    const small = await calm.evaluate(() => Array.from(document.querySelectorAll('#view-me .pframe--sm *')).every((e) => getComputedStyle(e).animationName === 'none'));
    check(small, 'and nothing in the pickers moves');
    await calm.close();
    const live = await seeded(rich(100000000), { viewport: { width: 1366, height: 800 } });
    await openMe(live);
    const moving = [];
    for (const f of ['flame', 'stars', 'halo', 'rays']) { const m = await withFrame(live, f); moving.push(Object.values(m).filter((v) => v !== null)[0]); }
    check(JSON.stringify(moving) === JSON.stringify(['pf-flame', 'pf-twinkle', 'pf-halo', 'pf-spin']), 'without a preference they do move (flicker, twinkle, glow, slow turn), so the check above is real', moving);
    check(await live.evaluate(() => Array.from(document.querySelectorAll('#view-me .pframe--sm *')).every((e) => getComputedStyle(e).animationName === 'none')), 'the small previews in the pickers stay still even then');

    // the Share button: only when the share cards exist
    // the share cards exist in the whole site, so take the real one away for a moment to prove the button follows it
    await live.evaluate(() => { window.__realOpen = GS.ui.sharecard.openProfile; delete GS.ui.sharecard.openProfile; GS.ui.pages.me(); });
    check(await live.locator('#view-me [data-role="share"]').count() === 0, 'no Share button while ui.sharecard.openProfile does not exist');
    await live.evaluate(() => { GS.ui.sharecard = GS.ui.sharecard || {}; GS.ui.sharecard.openProfile = () => { window.__shared = (window.__shared || 0) + 1; }; GS.ui.pages.me(); });
    const share = live.locator('#view-me [data-role="share"]');
    check(await share.count() === 1 && /Share my profile/.test(await share.innerText()), 'once it exists the page shows "Share my profile"');
    await share.click();
    check(await live.evaluate(() => window.__shared) === 1, 'and the button calls ui.sharecard.openProfile()');
    await live.evaluate(() => { delete GS.ui.sharecard.openProfile; GS.ui.pages.me(); });
    check(await live.locator('#view-me [data-role="share"]').count() === 0, 'and it goes away again when it does not');
    await live.evaluate(() => { GS.ui.sharecard.openProfile = window.__realOpen; GS.ui.pages.me(); });
    check(await live.locator('#view-me [data-role="share"]').count() === 1, 'and the real share cards bring it back');
    await live.close();
    check(problems.length === problems0, 'section 25k: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ------------------------------------------------------------------------------------------------------ 25l */
  if (section('25l. My profile in real-donation (redirect) mode: "sent to checkout", and no demo wording')) {
    const problems0 = problems.length;
    const p = await seeded(rich(750000), { viewport: { width: 1366, height: 800 } });
    await p.route('**/js/config.js', async (route) => {
      const src = fs.readFileSync(path.join(h.root, 'js/config.js'), 'utf8').replace("mode: 'demo'", "mode: 'redirect'");
      await route.fulfill({ status: 200, contentType: 'text/javascript', body: src });
    });
    await openMe(p);
    check(await p.locator('html').getAttribute('data-mode') === 'redirect', 'redirect mode is on');
    const lbl = await p.evaluate(() => document.querySelector('#view-me .pstats .stat__lbl').textContent.replace(/\s+/g, ' ').trim());
    check(lbl === 'Total sent to checkout' && await p.locator('#view-me .pstats .tag').count() === 0, 'the first total says "Total sent to checkout", with no demo tag', lbl);
    const words = await p.evaluate(() => document.querySelector('#view-me').innerText);
    check(!/Total given|demo|play-money|pretend/i.test(words), 'the page has no "Total given" or demo wording in this mode');
    check(await p.locator('#view-me .phero__name').count() === 1 && await p.locator('#view-me .pickcard').count() === 17 && await noSideways(p), 'the rest of the page is the same and does not scroll sideways');
    await p.close();
    check(problems.length === problems0, 'section 25l: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }
}
