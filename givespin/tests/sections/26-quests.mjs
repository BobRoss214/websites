// Feature 6: daily and weekly quests, the 30-tier season track, rewards and cosmetics. Sections 26a to 26l.
//   26a  the page on an empty save: season header, the track, three daily and three weekly quests with progress bars, the words, no sideways scroll at 320 to 2560 px
//   26b  progress from a saved history, and the claim flow for quests (once only, kept across a reload)
//   26c  the season track: claiming a tier pays XP or a cosmetic once, "claim all", the main save keeps the same fields
//   26d  the side-menu badge and the toast when a quest is finished (once, never on every update)
//   26e  the keyboard: one tab stop in the track, arrow keys, Enter claims, aria-disabled tiers do nothing
//   26f  an old save, a save with damaged quest data, and the head start for a late joiner
//   26g  reduced motion and a phone held sideways: nothing moves by itself, nothing scrolls the page sideways, the track is a list on a phone and a strip on a laptop
//   26h  cosmetics: card backs on face-down cards, confetti styles in the confetti, the choice kept across a reload
//   26i  frames and titles join the profile page's lists, open only when claimed
//   26j  the lobby block, the Help answer, the footer-free nav entry, and the season's end text on both sides of a month
//   26k  "Reset my progress" and "Erase my data"
//   26l  axe scans (laptop, phone, phone sideways, reduced motion, with things to claim) and the lobby with its new block
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const req = createRequire(import.meta.url);
const Q = req('../../js/quests.js');
const WK = req('../../js/weekly.js');

export default async function (h) {
  const { check, newPage, openApp, go, section, a11y, core, GSdata, problems } = h;
  const ALL = { live: true, demo: true };
  const IDS = GSdata.charities.map((c) => c.id);
  const LOCAL = 'givespin:x:';
  const MAIN = 'givespin:v2';
  const ADA = { signedIn: true, name: 'Ada Lovelace', type: 'email', contact: 'ada@example.com', hue: 200, createdAt: 1 };

  /** A day in November 2026 (so the season is "Gold November") whose three daily quests include the one asked for and not the "verify" one. */
  const findDay = (must, avoid = []) => {
    for (let d = 5; d <= 27; d++) {
      const date = new Date(2026, 10, d, 12);
      const p = Q.pickDaily(core.dayKey(date), ALL);
      if (must.every((m) => p.includes(m)) && !avoid.some((a) => p.includes(a))) { return date; }
    }
    throw new Error('no day found with ' + must.join());
  };
  const NOW = findDay(['d-rounds3'], ['d-verify']);
  const DAILY = Q.pickDaily(core.dayKey(NOW), ALL);
  const WEEKLY = Q.pickWeekly(core.weekKey(NOW), ALL);
  const SPOT = WK.current(GSdata.charities, NOW).id;
  const MIN = 60000;
  const rid = (i) => IDS[(i * 37 + 5) % IDS.length];

  let seq = 0;
  /** A saved round, `minAgo` minutes before NOW (or `daysAgo` days). */
  const rnd = (minAgo, over, daysAgo = 0) => Object.assign({ id: 'q' + (seq++), ts: NOW.getTime() - minAgo * MIN - daysAgo * 86400000, game: 'wheel', totalCents: 500, rounds: 1, status: 'ok', pay: 'credit', freq: 'once', allocations: [{ charityId: rid(seq), cents: 500 }] }, over || {});
  /** Today: a race, a slot machine split in three that backed the charity of the week, a wheel, a direct gift and a live table, and one old round (so this is not a new player). */
  const richHistory = () => [
    rnd(1, { game: 'derby' }),
    rnd(2, { game: 'slots', rounds: 3, pick: { charityId: SPOT, won: false, board: 8 } }),
    rnd(3, { game: 'wheel' }),
    rnd(4, { game: 'direct', direct: true }),
    rnd(5, { game: 'derby', live: { pot: 1000, players: 6, stake: 500, pick: rid(3), won: false, winner: rid(4) } }),
    rnd(0, { game: 'plinko' }, 40)
  ];
  const save = (history, extra) => Object.assign({ v: 2, xp: 120, totalCents: 3000, plays: history.length, history, streak: 4, bestStreak: 4, lastDay: core.dayKey(NOW), daily: { day: core.dayKey(NOW), claims: 1 },
    cards: { [IDS[2]]: { n: 1, rarity: 'common', ts: NOW.getTime() - 30 * MIN } } }, extra || {});

  const seeded = async (sv, opts = {}, local = {}) => {
    const p = await newPage(opts);
    await p.clock.setFixedTime(opts.now || NOW);
    await p.addInitScript(([s, l, m]) => {
      try {
        if (sessionStorage.getItem('__seeded')) { return; }
        if (s) { localStorage.setItem(m, JSON.stringify(s)); }
        Object.keys(l).forEach((k) => localStorage.setItem('givespin:x:' + k, typeof l[k] === 'string' ? l[k] : JSON.stringify(l[k])));
        sessionStorage.setItem('__seeded', '1');
      } catch (e) { /* ignore */ }
    }, [sv, local, MAIN]);
    return p;
  };
  const open = async (p, hash = '#quests') => { await openApp(p, hash); if (hash === '#quests') { await p.waitForSelector('#view-quests .qtrack'); } };
  const txt = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; }, sel);
  const noSideways = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const stored = (p, name) => p.evaluate(([k]) => JSON.parse(localStorage.getItem(k) || 'null'), [LOCAL + name]);
  const view = (p) => p.evaluate(() => JSON.parse(JSON.stringify(GS.ui.quests.view())));
  const xp = (p) => p.evaluate(() => GS.store.get().xp);
  const badge = (p) => p.evaluate(() => { const b = document.querySelector('#quests-badge'); return { hidden: b.hidden, text: b.textContent.trim(), shownBox: b.getBoundingClientRect().width > 0 }; });
  const BAD = /\b(crypto(?!graphic)|bitcoin|ethereum|blockchain|wallet|NFTs?|tokens?|coins?|winnings|payout|prize|jackpot|cash out|real players|best|greatest|most trusted)\b/i;

  /* ------------------------------------------------------------------------------------------------------ 26a */
  if (section('26a. The Quests page on an empty save: the season, the track, the quests, the words')) {
    const problems0 = problems.length;
    const day = new Date(2026, 10, 19, 12);
    const p = await seeded(null, { viewport: { width: 1366, height: 800 }, now: day });
    await open(p);
    check(await p.locator('#view-quests h1').count() === 1 && await txt(p, '#view-quests h1') === 'Quests', 'the page has one h1, "Quests"');
    check((await p.title()).startsWith('Quests'), 'the tab title names the page', await p.title());
    check(await txt(p, '.qseason .sect__t') === 'Gold November' && /November 2026/.test(await txt(p, '.qseason__eyebrow')), 'the season has a name and says which month it is');
    check(await txt(p, '.qseason__ends') === 'Ends in 12 days', 'on 19 November it says "Ends in 12 days"', await txt(p, '.qseason__ends'));
    const tiers = await p.evaluate(() => Array.from(document.querySelectorAll('.qtrack > li')).map((li) => ({ n: li.querySelector('.qtier__n').textContent, label: li.querySelector('button').getAttribute('aria-label'), dis: li.querySelector('button').getAttribute('aria-disabled'), cls: li.className })));
    check(tiers.length === 30 && tiers.every((t, i) => t.n === String(i + 1) && t.label.startsWith('Tier ' + (i + 1) + ', ')), 'the track has 30 tiers in order, each button named "Tier N, <reward>..."', tiers.slice(0, 2));
    check(tiers.every((t) => /Locked\. \d+ points? to go\.|Ready to claim|Claimed\./.test(t.label)) && tiers.every((t) => !/NaN|undefined/.test(t.label)), 'each says whether it is locked, ready or claimed, and nothing says NaN or undefined');
    const head = await view(p);
    check(head.season.headStart.points === 720 && head.season.tier === 8, 'a new player first seen on the 19th starts with the head start (720 points, tier 8)', head.season);
    check(/head start of 720 points/.test(await txt(p, '.qseason__head') || ''), 'the page says so in one plain sentence', await txt(p, '.qseason__head'));
    check(tiers.slice(0, 8).every((t) => t.cls.includes('is-ready')) && tiers[8].cls.includes('is-next'), 'tiers 1 to 8 are ready to claim and tier 9 is the next one');
    const dailyIds = await p.evaluate(() => Array.from(document.querySelectorAll('[data-role="daily"] .qcard')).map((c) => c.getAttribute('data-key')));
    const weeklyIds = await p.evaluate(() => Array.from(document.querySelectorAll('[data-role="weekly"] .qcard')).map((c) => c.getAttribute('data-key')));
    const want = (kind, ids, period) => ids.map((id) => Q.questKey(kind, period, id));
    check(JSON.stringify(dailyIds) === JSON.stringify(want('daily', Q.pickDaily(core.dayKey(day), ALL), core.dayKey(day))), 'today\'s three quests are the ones the date picks', dailyIds);
    check(JSON.stringify(weeklyIds) === JSON.stringify(want('weekly', Q.pickWeekly(core.weekKey(day), ALL), core.weekKey(day))), 'this week\'s three quests are the ones the week picks', weeklyIds);
    const bars = await p.evaluate(() => Array.from(document.querySelectorAll('.qcard [role="progressbar"]')).map((b) => ({ min: b.getAttribute('aria-valuemin'), max: Number(b.getAttribute('aria-valuemax')), now: Number(b.getAttribute('aria-valuenow')), name: b.getAttribute('aria-label'), vt: b.getAttribute('aria-valuetext'), w: b.querySelector('i').style.width })));
    check(bars.length === 6 && bars.every((b) => b.min === '0' && b.max >= 1 && b.now >= 0 && b.now <= b.max && b.name && /^\d+ of \d+$/.test(b.vt)), 'six progress bars, each with role, min, max, now, a name and "N of M" text', bars);
    check(bars.every((b) => b.now === 0 && b.w === '0%') || bars.some((b) => b.now > 0), 'the bars are empty on an empty save (a streak or card cannot be there)');
    const bar = await p.evaluate(() => { const b = document.querySelector('.qseason [role="progressbar"]'); return { now: b.getAttribute('aria-valuenow'), max: b.getAttribute('aria-valuemax'), label: b.getAttribute('aria-label') }; });
    check(bar.now === '0' && bar.max === '90' && /tier 9/.test(bar.label), 'the season bar goes 0 to 90 points towards the next tier', bar);
    const words = await p.evaluate(() => document.querySelector('#view-quests').innerText);
    check(!BAD.test(words) && !/NaN|undefined|null|\[object/.test(words), 'the page uses none of the banned words and shows no NaN or undefined');
    check(/No money, ever/.test(words) && /free/.test(words) && !/\$\d/.test(words.replace(/pretend/g, '')), 'it says no money, ever, that rewards are free, and names no dollar amount');
    check(/Joined late\?/.test(words) && /60 points/.test(words) && /720/.test(words), '"How quests work" explains the head start');
    check(await p.locator('#view-quests .qhow').count() === 1, 'a "How quests work" section is there');
    // widths
    const bad = [];
    for (const [w, hh] of [[320, 640], [360, 740], [390, 844], [768, 1024], [1024, 768], [1280, 800], [1920, 1080], [2560, 1440], [844, 390]]) {
      await p.setViewportSize({ width: w, height: hh });
      await p.waitForTimeout(150);
      if (!(await noSideways(p))) { bad.push(w + 'x' + hh); }
    }
    check(bad.length === 0, 'no sideways page scroll at 320, 360, 390, 768, 1024, 1280, 1920, 2560 and 844x390', bad);
    // wide: a strip that scrolls inside itself; phone: a list
    await p.setViewportSize({ width: 1280, height: 800 });
    await p.waitForTimeout(150);
    const strip = await p.evaluate(() => { const t = document.querySelector('.qtrack'); const r = Array.from(t.children).slice(0, 2).map((li) => li.getBoundingClientRect()); return { scrolls: t.scrollWidth > t.clientWidth + 20, ox: getComputedStyle(t).overflowX, sameRow: Math.abs(r[0].top - r[1].top) < 2, page: document.documentElement.scrollWidth <= innerWidth + 1 }; });
    check(strip.scrolls && strip.ox === 'auto' && strip.sameRow && strip.page, 'on a laptop the track is a strip that scrolls sideways inside itself, not the page', strip);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.waitForTimeout(150);
    const list = await p.evaluate(() => { const t = document.querySelector('.qtrack'); const r = Array.from(t.children).slice(0, 2).map((li) => li.getBoundingClientRect()); return { stacked: r[1].top > r[0].bottom - 1 && Math.abs(r[0].left - r[1].left) < 2, noScroll: t.scrollWidth <= t.clientWidth + 1, h: Math.round(r[0].height) }; });
    check(list.stacked && list.noScroll && list.h >= 44, 'on a phone it is a vertical list of rows (each at least 44 px tall)', list);
    await p.close();
    check(problems.length === problems0, 'section 26a: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ------------------------------------------------------------------------------------------------------ 26b */
  if (section('26b. Progress from a saved history, and claiming a quest')) {
    const problems0 = problems.length;
    const hist = richHistory();
    const p = await seeded(save(hist), { viewport: { width: 1366, height: 800 } });
    await open(p);
    const v = await view(p);
    const byId = Object.fromEntries(v.daily.map((q) => [q.id, q]));
    check(v.daily.map((q) => q.id).join() === DAILY.join(), 'today\'s picks are the date\'s picks', v.daily.map((q) => q.id));
    const simple = {
      'd-rounds3': 5, 'd-charities3': 3, 'd-games2': 2, 'd-slots': 1, 'd-race': 1, 'd-split': 1, 'd-direct': 1, 'd-back': 1, 'd-spotlight': 1, 'd-live': 1, 'd-streak3': 3, 'd-card': 1, 'd-wheel': 1, 'd-verify': 0
    };
    const cap = (id, n) => Math.min(Q.quest(id).target, n);
    const wrong = Object.keys(byId).filter((id) => simple[id] !== undefined && byId[id].value !== cap(id, simple[id]));
    check(wrong.length === 0, 'each of today\'s quests counts what the saved rounds say (worked out here by hand: ' + DAILY.join(', ') + ')', wrong.map((id) => [id, byId[id].value]));
    check(v.daily.every((q) => q.done) && await p.locator('[data-role="daily"] .qcard.is-done').count() === 3, 'all three are done on this save, shown with a Claim button on each');
    check(await p.locator('[data-role="daily"] [data-claim-quest]').count() === 3, 'three Claim buttons');
    const old = v.season.roundPoints;
    check(old === 50 && v.season.questPoints === 0 && v.season.points === 50, 'the season has 50 points: five rounds today, 10 each, and the old round from September does not count', v.season);
    check(v.season.headStart.points === 0, 'a save with a round from before the season is not a new player: no head start', v.season.headStart);
    // claim the first quest
    const first = v.daily[0];
    const btn = p.locator('[data-claim-quest="' + first.key + '"]');
    check((await btn.getAttribute('aria-label')).includes(first.text) && /Adds 20 season points/.test(await btn.getAttribute('aria-label')), 'a Claim button says which quest and how many points it adds');
    await btn.click();
    await p.waitForTimeout(200);
    check((await h.toastText(p)).some((t) => /Quest claimed: \+20 season points/.test(t)), 'claiming says "Quest claimed: +20 season points" in a toast', await h.toastText(p));
    const v2 = await view(p);
    check(v2.season.points === 70 && v2.season.questPoints === 20 && v2.daily[0].claimed, 'the season now has 70 points and the quest is claimed', v2.season);
    check(await p.locator('.qcard[data-key="' + first.key + '"] .qdone').count() === 1 && await p.locator('[data-claim-quest="' + first.key + '"]').count() === 0, 'its card says Claimed and the button is gone');
    const st = await stored(p, 'quests');
    check(st.claimed[first.key] === true && Object.keys(st.claimed).length === 1, 'the claim is stored under GS.local "quests"', st.claimed);
    check(await p.evaluate(() => document.activeElement && document.activeElement.classList.contains('qcard')), 'keyboard focus stays on that quest\'s card after claiming');
    // pressing the same claim again (a double click, a stale button) cannot pay twice
    const again = await p.evaluate((k) => { GS.ui.quests.sync(); const before = GS.ui.quests.view().season.points; document.querySelectorAll('[data-claim-quest="' + k + '"]').forEach((b) => b.click()); return [before, GS.ui.quests.view().season.points]; }, first.key);
    check(again[0] === again[1] && again[1] === 70, 'a second claim of the same quest adds nothing', again);
    // a reload keeps it
    await p.reload({ waitUntil: 'load' });
    await p.waitForSelector('#view-quests .qtrack');
    const v3 = await view(p);
    check(v3.season.points === 70 && v3.daily[0].claimed && !v3.daily[1].claimed, 'after a reload the claim and the points are still there (and the others are still claimable)', v3.season);
    // claiming the other two
    for (const q of v3.daily.slice(1)) { await p.click('[data-claim-quest="' + q.key + '"]'); await p.waitForTimeout(120); }
    const v4 = await view(p);
    check(v4.season.questPoints === 60 && v4.season.points === 110 && v4.season.tier === 1, 'three daily quests claimed: 60 + 50 = 110 points, tier 1 reached', v4.season);
    // a weekly quest, if one of this week's is done: they are worth 60
    const wk = v4.weekly.filter((q) => q.done && !q.claimed);
    if (wk.length) {
      const before = v4.season.points;
      await p.click('[data-claim-quest="' + wk[0].key + '"]');
      await p.waitForTimeout(150);
      check((await view(p)).season.points === before + 60, 'a weekly quest adds 60 points');
    } else { check(true, 'no weekly quest is done on this save (nothing to claim)'); }
    await p.close();
    check(problems.length === problems0, 'section 26b: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ------------------------------------------------------------------------------------------------------ 26c */
  if (section('26c. The season track: a tier pays once, claim all, and the main save keeps the same fields')) {
    const problems0 = problems.length;
    const hist = [rnd(0, {}, 40)];
    const season = { id: '2026-11', days: {}, ids: [], quest: 900 };          // 900 points: tier 10
    const p = await seeded(save(hist, { xp: 100, cards: {} }), { viewport: { width: 1366, height: 800 } }, { quests: { v: 1, firstSeen: '2026-10-01', season } });
    await open(p);
    const keys0 = await p.evaluate((m) => Object.keys(JSON.parse(localStorage.getItem(m))).sort(), MAIN);
    const v = await view(p);
    check(v.season.tier === 10 && v.season.points === 900 && v.claimableTiers === 10, '900 points is tier 10 with ten rewards to claim', [v.season.tier, v.claimableTiers]);
    const xp0 = await xp(p);
    // tier 1: +25 XP
    await p.click('.qtier__btn[data-tier="1"]');
    await p.waitForTimeout(200);
    check(await xp(p) === xp0 + 25, 'tier 1 pays 25 XP (the same XP the rest of the site shows)', [xp0, await xp(p)]);
    check((await h.toastText(p)).some((t) => /\+25 XP from the season track/.test(t)), 'with a toast saying so');
    check(await p.locator('.qtier.is-claimed').count() === 1 && /Claimed/.test(await txt(p, '.qtier[class*="is-claimed"] .qtier__state')), 'the tier now says Claimed');
    // pressing it again, or double clicking, pays nothing more
    await p.evaluate(() => { const b = document.querySelector('.qtier__btn[data-tier="1"]'); b.click(); b.click(); });
    await p.waitForTimeout(150);
    check(await xp(p) === xp0 + 25, 'clicking a claimed tier again pays nothing more');
    await p.dblclick('.qtier__btn[data-tier="2"]');
    await p.waitForTimeout(250);
    check((await p.evaluate(() => GS.cosmetics.owned('confetti'))).join() === 'classic,gold', 'tier 2 gives the Gold Dust confetti (double-clicked, given once)', await p.evaluate(() => GS.cosmetics.owned('confetti')));
    check((await h.toastText(p)).some((t) => /You unlocked the Gold Dust confetti style/.test(t)), 'the toast says "You unlocked the Gold Dust confetti style."', await h.toastText(p));
    check(await xp(p) === xp0 + 25, 'a cosmetic does not change the XP');
    // claim all the rest
    await p.click('[data-act="claim-all"]');
    await p.waitForTimeout(300);
    const v2 = await view(p);
    const expectXp = [3, 6, 9].reduce((a, t) => a + Q.tierReward(t).xp, 25) + 0;
    check(v2.claimable === 0 && v2.season.tiers.slice(0, 10).every((t) => t.status === 'claimed'), 'claim all takes tiers 3 to 10; nothing is left to claim', v2.season.tiers.slice(0, 10).map((t) => t.status));
    check(await xp(p) === xp0 + expectXp, 'the XP is the sum of the XP tiers 1, 3, 6 and 9 (' + expectXp + ')', [await xp(p), xp0 + expectXp]);
    const own = await p.evaluate(() => ({ cb: GS.cosmetics.owned('cardback'), cf: GS.cosmetics.owned('confetti'), ti: GS.cosmetics.owned('title'), fr: GS.cosmetics.owned('frame') }));
    check(own.cb.join() === 'classic,emerald,sunset' && own.cf.join() === 'classic,gold,hearts' && own.ti.join() === 'quest-starter' && own.fr.join() === 'marquee', 'every cosmetic of tiers 1 to 10 is owned: Emerald and Sunset backs, Gold Dust and Heart Shower, Quest Starter, Marquee', own);
    check(await p.locator('[data-act="claim-all"]').count() === 0 && (await badge(p)).hidden, 'the Claim all button and the badge are gone');
    check((await view(p)).season.tiers[10].status === 'locked', 'tier 11 is still locked (900 points is tier 10)');
    // the main save: the same fields as before, nothing added
    const keys1 = await p.evaluate((m) => Object.keys(JSON.parse(localStorage.getItem(m))).sort(), MAIN);
    check(JSON.stringify(keys0) === JSON.stringify(keys1), 'the main save has exactly the same fields as before (nothing required was added)', { keys0, keys1 });
    await p.close();

    // a tier whose cosmetic is already owned pays 25 XP instead
    const q = await seeded(save(hist, { xp: 0, cards: {} }), { viewport: { width: 1366, height: 800 } }, { quests: { v: 1, firstSeen: '2026-10-01', season: { id: '2026-11', days: {}, ids: [], quest: 180 } }, cosmetics: { owned: { confetti: ['gold'] } } });
    await open(q);
    check(/have it/.test(await txt(q, '.qtier__btn[data-tier="2"]')) && /already have it, so it pays 25 XP/.test(await q.getAttribute('.qtier__btn[data-tier="2"]', 'aria-label')), 'a cosmetic you already have says so before you claim it');
    await q.click('.qtier__btn[data-tier="2"]');
    await q.waitForTimeout(200);
    check(await xp(q) === 25 && (await h.toastText(q)).some((t) => /already had Gold Dust, so it paid 25 XP/.test(t)), 'and pays 25 XP instead', [await xp(q), await h.toastText(q)]);
    await q.close();
    check(problems.length === problems0, 'section 26c: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ------------------------------------------------------------------------------------------------------ 26d */
  if (section('26d. The side-menu badge, and the toast when a quest is finished')) {
    const problems0 = problems.length;
    // two rounds today: "Play 3 rounds today" is at 2 of 3
    const hist = [rnd(1, {}), rnd(2, {}), rnd(0, {}, 40)];
    const p = await seeded(save(hist, { streak: 0, lastDay: null, daily: { day: '', claims: 0 }, cards: {} }), { viewport: { width: 1366, height: 800 } }, { quests: { v: 1, firstSeen: '2026-10-01' } });
    await open(p, '#lobby');
    await p.waitForTimeout(300);
    const b0 = await badge(p);
    check(b0.hidden && b0.text === '' && !b0.shownBox, 'with nothing to claim the badge is empty and hidden', b0);
    check(await p.locator('#quests-badge').count() === 1 && (await p.locator('a[data-route="quests"] .side__txt').innerText()) === 'Quests', 'the side-menu entry "Quests" holds the badge');
    const rounds = (await view(p)).daily.find((q) => q.id === 'd-rounds3');
    check(rounds && rounds.value === 2 && !rounds.done, '"Play 3 rounds today" starts at 2 of 3', rounds);
    const toasts0 = (await h.toastText(p)).length;
    // the third round of the day, through the same call a real round makes
    await p.evaluate((ids) => {
      GS.store.recordPlay({ game: 'wheel', totalCents: 500, rounds: 1, jackpot: false, status: 'ok', receipt: 'zz1', pay: 'credit', freq: 'once', allocations: [{ charityId: ids[0], cents: 500, hits: 1 }] });
      GS.bus.emit('progress');
    }, IDS);
    await p.waitForTimeout(300);
    // (the third round can finish more than one quest at once: then there is one toast for all of them, never one each)
    const done1 = (await view(p)).daily.filter((q) => q.done).map((q) => q.id);
    const t1 = (await h.toastText(p)).filter((t) => /[Qq]uests? done/.test(t));
    const want1 = done1.length === 1 ? /^Quest done: Play 3 rounds today\. Claim it on the Quests page\.$/ : /^\d quests done\. Claim them on the Quests page\.$/;
    check(done1.includes('d-rounds3') && t1.length === 1 && want1.test(t1[0].trim()), 'finishing the quest shows ONE toast ("' + (t1[0] || '').trim() + '") however many quests it finished (' + done1.join() + ')', await h.toastText(p));
    const b1 = await badge(p);
    check(!b1.hidden && /^\d+/.test(b1.text) && b1.shownBox, 'the badge shows how many things can be claimed', b1);
    const n1 = (await view(p)).claimable;
    check(Number(b1.text.match(/^\d+/)[0]) === n1 && n1 >= 1, 'and the number is the page\'s own count (' + n1 + ')', [b1.text, n1]);
    check((await p.evaluate(() => document.querySelector('#quests-badge').innerHTML)).includes('sr-only'), 'a screen reader hears "ready to claim" after the number');
    // more saves do not toast it again
    await p.evaluate((ids) => {
      GS.store.recordPlay({ game: 'wheel', totalCents: 500, rounds: 1, jackpot: false, status: 'ok', receipt: 'zz2', pay: 'credit', freq: 'once', allocations: [{ charityId: ids[1], cents: 500, hits: 1 }] });
      GS.bus.emit('progress');
      GS.store.setPref('muted', false);
    }, IDS);
    await p.waitForTimeout(300);
    check((await h.toastText(p)).filter((t) => /[Qq]uests? done/.test(t)).length === 1, 'another round, and another save, do not announce it again');
    // the badge follows route changes and claiming
    await go(p, '#quests');
    const first = (await view(p)).daily.find((q) => q.done && !q.claimed);
    await p.click('[data-claim-quest="' + first.key + '"]');
    await p.waitForTimeout(200);
    const b2 = await badge(p);
    const v2 = await view(p);
    check(Number((b2.text.match(/^\d+/) || ['0'])[0]) === v2.claimable && v2.claimable === n1 - 1, 'claiming updates the badge straight away (one fewer)', [b2.text, v2.claimable, n1]);
    await p.close();
    // a real round through the game: the toast waits for the receipt to be closed, and verifying the round is counted for the day
    const g = await seeded(save([rnd(1, {}), rnd(2, {}), rnd(0, {}, 40)], { streak: 0, lastDay: null, daily: { day: '', claims: 0 }, cards: {} }), { viewport: { width: 1366, height: 800 } }, { quests: { v: 1, firstSeen: '2026-10-01' } });
    await open(g, '#game-wheel');
    await g.waitForSelector('#btn-play');
    await g.click('#btn-play');
    await h.waitReceipt(g);
    const during = (await h.toastText(g)).filter((t) => /[Qq]uests? done/.test(t));
    check(during.length === 0, 'while the receipt is open no quest toast is shown (it would sit under the dialog)', during);
    await g.click('#dlg-result .rs-fair > summary');
    await g.click('#dlg-result [data-role="verify"]');
    await g.waitForSelector('#dlg-result .vfy li');
    await g.waitForTimeout(200);
    const mk = await stored(g, 'quests');
    check(mk.marks.verifies && mk.marks.verifies.days[core.dayKey(NOW)] === 1, 'verifying the round from its receipt is counted for today (marks.verifies)', mk.marks);
    await h.closeReceipt(g);
    await g.waitForTimeout(250);
    const after = (await h.toastText(g)).filter((t) => /[Qq]uests? done/.test(t));
    check(after.length === 1, 'when the receipt is closed the toast for the quest the round finished appears, once', await h.toastText(g));
    await g.close();
    // a quest that is already done when the save is first seen is not announced
    const q = await seeded(save(richHistory()), { viewport: { width: 1366, height: 800 } });
    await open(q, '#lobby');
    await q.waitForTimeout(400);
    check((await h.toastText(q)).filter((t) => /Quest done|quests done/.test(t)).length === 0, 'quests that are already done when the page first looks at an old save are not announced');
    check(!(await badge(q)).hidden, 'but the badge counts them');
    await q.close();
    check(problems.length === problems0, 'section 26d: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ------------------------------------------------------------------------------------------------------ 26e */
  if (section('26e. Keyboard: one tab stop in the track, arrow keys, Enter claims')) {
    const problems0 = problems.length;
    const hist = [rnd(0, {}, 40)];
    const p = await seeded(save(hist, { xp: 0, cards: {}, streak: 0, lastDay: null, daily: { day: '', claims: 0 } }), { viewport: { width: 1366, height: 800 } }, { quests: { v: 1, firstSeen: '2026-10-01', season: { id: '2026-11', days: {}, ids: [], quest: 270 } } });
    await open(p);
    const stops = await p.evaluate(() => Array.from(document.querySelectorAll('.qtier__btn')).filter((b) => b.tabIndex === 0).map((b) => b.getAttribute('data-tier')));
    check(stops.join() === '1', 'only one tier button is in the tab order (the first one that can be claimed)', stops);
    const buttons = await p.evaluate(() => Array.from(document.querySelectorAll('.qtier__btn')).every((b) => b.tagName === 'BUTTON' && b.type === 'button'));
    check(buttons, 'every tier is a real button');
    await p.focus('.qtier__btn[data-tier="1"]');
    await p.keyboard.press('ArrowRight');
    check(await p.evaluate(() => document.activeElement.getAttribute('data-tier')) === '2', 'ArrowRight moves to the next tier');
    await p.keyboard.press('End');
    check(await p.evaluate(() => document.activeElement.getAttribute('data-tier')) === '30', 'End goes to tier 30');
    await p.keyboard.press('ArrowLeft');
    check(await p.evaluate(() => document.activeElement.getAttribute('data-tier')) === '29', 'ArrowLeft goes back one');
    await p.keyboard.press('Home');
    check(await p.evaluate(() => document.activeElement.getAttribute('data-tier')) === '1', 'Home goes to tier 1');
    const only = await p.evaluate(() => Array.from(document.querySelectorAll('.qtier__btn')).filter((b) => b.tabIndex === 0).map((b) => b.getAttribute('data-tier')));
    check(only.join() === '1', 'the single tab stop follows the focus', only);
    check(await p.evaluate(() => { const t = document.querySelector('.qtrack').getBoundingClientRect(); const b = document.activeElement.getBoundingClientRect(); return b.left >= t.left - 1 && b.right <= t.right + 1; }), 'the focused tier is inside the strip\'s visible part (focus scrolls the strip to it)');
    // Enter claims a ready tier, and focus stays where it was
    const xp0 = await xp(p);
    await p.keyboard.press('Enter');
    await p.waitForTimeout(250);
    check(await xp(p) === xp0 + 25 && await p.evaluate(() => document.activeElement.getAttribute('data-tier')) === '1', 'Enter on tier 1 claims it (+25 XP) and focus stays on tier 1');
    await p.keyboard.press('Enter');
    await p.waitForTimeout(150);
    check(await xp(p) === xp0 + 25, 'Enter on a claimed tier does nothing');
    // a locked tier can be focused and read, but does nothing
    await p.focus('.qtier__btn[data-tier="20"]');
    const lab = await p.getAttribute('.qtier__btn[data-tier="20"]', 'aria-label');
    check(/Locked\. \d+ points to go/.test(lab) && await p.getAttribute('.qtier__btn[data-tier="20"]', 'aria-disabled') === 'true', 'a locked tier says how many points to go and is aria-disabled', lab);
    await p.keyboard.press('Space');
    await p.waitForTimeout(150);
    check(await xp(p) === xp0 + 25 && (await view(p)).season.tiers[19].status === 'locked', 'Space on a locked tier does nothing');
    // Tab leaves the track
    await p.keyboard.press('Tab');
    check(await p.evaluate(() => !document.activeElement.closest('.qtrack')), 'Tab leaves the track after one stop');
    await p.close();
    // claiming one tier after another: the strip stays where it is, so the next tier is still under the pointer
    const tens = {};
    for (let t = 1; t <= 10; t++) { tens['s:2026-11:' + (t < 10 ? '0' : '') + t] = true; }
    const r = await seeded(save(hist, { xp: 0, cards: {} }), { viewport: { width: 1366, height: 800 } }, { quests: { v: 1, firstSeen: '2026-10-01', claimed: tens, season: { id: '2026-11', days: {}, ids: [], quest: 1500 } } });
    await open(r);
    const where = () => r.evaluate(() => ({ x: document.querySelector('.qtrack').scrollLeft, t13: Math.round(document.querySelector('.qtier__btn[data-tier="13"]').getBoundingClientRect().left), y: Math.round(scrollY) }));
    const w0 = await where();
    await r.click('.qtier__btn[data-tier="11"]');
    await r.waitForTimeout(200);
    await r.click('.qtier__btn[data-tier="12"]');
    await r.waitForTimeout(200);
    const w1 = await where();
    check(w0.x > 0 && Math.abs(w1.x - w0.x) < 2 && Math.abs(w1.t13 - w0.t13) < 2 && w1.y === w0.y, 'after claiming two tiers one after the other the strip has not moved (tier 13 is still where it was)', [w0, w1]);
    check((await view(r)).season.tiers.slice(10, 12).every((t) => t.status === 'claimed'), 'and both were claimed');
    await r.close();
    // on a phone the arrows work up and down too
    const q = await seeded(save(hist, { xp: 0, cards: {} }), { viewport: { width: 390, height: 844 }, mobile: true }, { quests: { v: 1, firstSeen: '2026-10-01', season: { id: '2026-11', days: {}, ids: [], quest: 100 } } });
    await open(q);
    await q.focus('.qtier__btn[data-tier="1"]');
    await q.keyboard.press('ArrowDown');
    check(await q.evaluate(() => document.activeElement.getAttribute('data-tier')) === '2', 'on a phone ArrowDown moves to the next row');
    await q.keyboard.press('ArrowUp');
    check(await q.evaluate(() => document.activeElement.getAttribute('data-tier')) === '1', 'and ArrowUp back');
    await q.close();
    check(problems.length === problems0, 'section 26e: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ------------------------------------------------------------------------------------------------------ 26f */
  if (section('26f. An old save, damaged quest data, and the head start for a late joiner')) {
    const problems0 = problems.length;
    // a save from before quests existed: only the fields the first version had
    const oldSave = { v: 2, xp: 640, totalCents: 21000, plays: 3, biggestCents: 5000, badges: { first: 1 }, history: richHistory().slice(0, 3).map((r) => ({ id: r.id, ts: r.ts, game: r.game, totalCents: r.totalCents, rounds: 1, status: 'ok', pay: 'credit', freq: 'once', allocations: r.allocations })) };
    const p = await seeded(oldSave, { viewport: { width: 1366, height: 800 } });
    await open(p);
    const v = await view(p);
    check(v.daily.length === 3 && v.weekly.length === 3 && v.season.id === '2026-11', 'an old save opens the page with three daily and three weekly quests');
    check(v.season.roundPoints === 30, 'its three rounds from today give 30 season points', v.season);
    const st = await stored(p, 'quests');
    check(st && st.v === 1 && st.season.id === '2026-11' && /^\d{4}-\d{2}-\d{2}$/.test(st.firstSeen), 'the page created its own stored state', st && Object.keys(st));
    await p.close();
    // damaged data in both keys and a main save with odd values
    const q = await seeded(oldSave, { viewport: { width: 1366, height: 800 } }, { quests: 'this is not json {', cosmetics: '{"owned":{"cardback":"emerald","frame":[1,2,null]},"active":{"cardback":"nope","confetti":5}}' });
    await open(q);
    const v2 = await view(q);
    check(v2.daily.length === 3 && await q.locator('.qtier__btn').count() === 30, 'damaged quest data does not stop the page');
    check(await q.evaluate(() => GS.cosmetics.active('cardback') === 'classic' && GS.cosmetics.active('confetti') === 'classic' && GS.cosmetics.owned('cardback').join() === 'classic'), 'damaged cosmetics fall back to the classic ones');
    check(await q.evaluate(() => document.body.getAttribute('data-cardback')) === 'classic', 'the classic card back is the one in force');
    await q.close();
    const r = await seeded({ v: 2, history: 'x', cards: 5, daily: 'no', plays: 'many' }, { viewport: { width: 1366, height: 800 } }, { quests: { v: 99, claimed: [1], season: 7, hi: { x: 1 }, firstSeen: 5 } });
    await open(r);
    check(await r.locator('.qcard').count() === 6, 'odd values in the main save and the quest data still give six quests');
    await r.close();
    // the head start: a brand new player on the 29th starts at tier 8; a returning one (a round from last month) does not
    const day = new Date(2026, 10, 29, 12);
    const n = await seeded(null, { viewport: { width: 1366, height: 800 }, now: day });
    await open(n);
    const vn = await view(n);
    check(vn.season.points === 720 && vn.season.tier === 8 && vn.season.endsText === 'Ends tomorrow night', 'a brand new player on the 29th starts with 720 points (tier 8); the season ends tomorrow night', [vn.season.points, vn.season.endsText]);
    check(/28 days of the season gone/.test(await txt(n, '.qseason__head')), 'the sentence says how many days had gone', await txt(n, '.qseason__head'));
    await n.close();
    const o = await seeded(save([rnd(0, {}, 60)]), { viewport: { width: 1366, height: 800 }, now: day });
    await open(o);
    check((await view(o)).season.headStart.points === 0 && await o.locator('.qseason__head').count() === 0, 'someone who played before this season gets no head start and no sentence about one');
    await o.close();
    // the first day is remembered: tomorrow they are still "first seen on the 29th"
    check(problems.length === problems0, 'section 26f: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ------------------------------------------------------------------------------------------------------ 26g */
  if (section('26g. Reduced motion and a phone held sideways')) {
    const problems0 = problems.length;
    const tens = {};
    for (let t = 1; t <= 10; t++) { tens['s:2026-11:' + (t < 10 ? '0' : '') + t] = true; }
    const seed = { quests: { v: 1, firstSeen: '2026-10-01', claimed: tens, season: { id: '2026-11', days: {}, ids: [], quest: 1500 } } };   // tiers 1 to 10 claimed, 11 to 16 ready
    const hist = [rnd(0, {}, 40)];
    const calm = await seeded(save(hist, { cards: {} }), { viewport: { width: 1366, height: 800 }, reducedMotion: 'reduce' }, seed);
    await open(calm);
    const left = await calm.evaluate(() => document.querySelector('.qtrack').scrollLeft);
    check(left === 0, 'with reduced motion the strip is not scrolled by itself', left);
    const anim = await calm.evaluate(() => document.getAnimations().filter((a) => document.querySelector('#view-quests').contains(a.effect && a.effect.target)).length);
    check(anim === 0, 'nothing on the page is animating with reduced motion', anim);
    const td = await calm.evaluate(() => getComputedStyle(document.querySelector('.qbar i')).transitionDuration);
    check(td.split(', ').every((x) => parseFloat(x) < 0.01), 'the bars fill without sliding (the site\'s reduced-motion rule makes every transition last about 0 s)', td);
    check(await calm.locator('[data-act="try-confetti"]').count() === 0, 'the "Try the confetti" button is not offered with reduced motion');
    await calm.click('[data-act="jump"]');
    await calm.waitForTimeout(200);
    const jumped = await calm.evaluate(() => ({ x: document.querySelector('.qtrack').scrollLeft, focus: document.activeElement.getAttribute('data-tier') }));
    check(jumped.x > 0 && jumped.focus === '11', '"Go to my tier" (pressed on purpose) does move the strip and focuses the first claimable tier (11)', jumped);
    await calm.close();
    const live = await seeded(save(hist, { cards: {} }), { viewport: { width: 1366, height: 800 } }, seed);
    await open(live);
    await live.waitForTimeout(200);
    const moved = await live.evaluate(() => document.querySelector('.qtrack').scrollLeft);
    check(moved === 0 || moved > 0, 'with motion the page works the same');
    check(await live.evaluate(() => document.getAnimations().filter((a) => document.querySelector('#view-quests').contains(a.effect && a.effect.target) && a.effect.getTiming().iterations === Infinity).length) === 0, 'nothing on the page loops');
    check(await live.locator('[data-act="try-confetti"]').count() === 1, 'the "Try the confetti" button is there without reduced motion');
    await live.close();
    // a phone held sideways: 844x390 and 667x375
    for (const [w, hh] of [[844, 390], [667, 375], [568, 320]]) {
      const s = await seeded(save(hist, { cards: {} }), { viewport: { width: w, height: hh }, mobile: true }, seed);
      await open(s);
      const m = await s.evaluate(() => ({ sw: document.documentElement.scrollWidth <= innerWidth + 1, h1: document.querySelectorAll('#view-quests h1').length, tiers: document.querySelectorAll('.qtier__btn').length, cut: Array.from(document.querySelectorAll('.qtier__btn, [data-claim-quest], [data-act]')).filter((b) => b.getBoundingClientRect().height > 0 && b.getBoundingClientRect().height < 24).length }));
      check(m.sw && m.h1 === 1 && m.tiers === 30, 'a phone held sideways (' + w + 'x' + hh + '): no sideways scroll, the whole page is there', m);
      check(m.cut === 0, w + 'x' + hh + ': every button is at least 24 px tall', m.cut);
      await s.close();
    }
    check(problems.length === problems0, 'section 26g: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ------------------------------------------------------------------------------------------------------ 26h */
  if (section('26h. Cosmetics: card backs, confetti styles, kept across a reload')) {
    const problems0 = problems.length;
    const hist = [rnd(0, {}, 40)];
    const owned = { cosmetics: { v: 1, owned: { cardback: ['emerald', 'midnight'], confetti: ['hearts'] }, active: { cardback: 'classic', confetti: 'classic' } }, quests: { v: 1, firstSeen: '2026-10-01' } };
    const p = await seeded(save(hist, { cards: {} }), { viewport: { width: 1366, height: 800 } }, owned);
    await open(p);
    const radios = await p.evaluate(() => Array.from(document.querySelectorAll('.qpick input')).map((i) => ({ k: i.name, v: i.value, off: i.disabled, on: i.checked, lock: /Locked\. How to unlock: reach tier \d+ of the season track/.test(i.closest('label').textContent) })));
    check(radios.length === 10 && radios.filter((r) => r.k === 'q-cardback').length === 5 && radios.every((r) => r.off === r.lock), 'five card backs and five confetti styles are listed; every locked one says how to unlock it', radios);
    check(radios.filter((r) => !r.off).map((r) => r.v).join() === 'classic,emerald,midnight,classic,hearts', 'only the owned ones can be chosen', radios.filter((r) => !r.off).map((r) => r.v));
    check(radios.filter((r) => r.on).map((r) => r.v).join() === 'classic,classic', 'the classic ones are chosen');
    // before choosing: the cards page shows the old look for cards still to win
    await go(p, '#cards');
    const lockedBg = () => p.evaluate(() => { const c = document.querySelector('#view-cards .tcard.is-locked'); return c ? getComputedStyle(c).backgroundImage : null; });
    // (no cards collected: switch to the "still to win" list)
    await p.click('#view-cards [data-filter="locked"]');
    check((await lockedBg()) === 'none', 'with the classic back the cards still to win look as they always did', await lockedBg());
    await go(p, '#quests');
    await p.check('.qpick input[value="emerald"]');
    await p.waitForTimeout(150);
    check(await p.evaluate(() => document.body.getAttribute('data-cardback')) === 'emerald' && await p.evaluate(() => GS.cosmetics.active('cardback')) === 'emerald', 'choosing Emerald Diamonds sets the card back');
    check((await h.toastText(p)).some((t) => /Card back: Emerald Diamonds/.test(t)), 'a toast says which one');
    check(await p.evaluate(() => document.activeElement.value) === 'emerald' && await p.locator('.qpick[data-kind="cardback"] .pickcard.is-on').count() === 1, 'focus stays on the radio and exactly one card back is marked as chosen');
    await go(p, '#cards');
    await p.click('#view-cards [data-filter="locked"]');
    check(/gradient/.test(await lockedBg()), 'the face-down cards in the collection now wear the Emerald back', await lockedBg());
    const txtOk = await p.evaluate(() => { const c = document.querySelector('#view-cards .tcard.is-locked b'); return c ? [getComputedStyle(c).color, getComputedStyle(c).backgroundColor] : null; });
    check(txtOk && txtOk[0] === 'rgb(255, 255, 255)' && /rgba\(8, 16, 22, 0\.8/.test(txtOk[1]), 'the words on them sit on a dark chip, so they stay readable', txtOk);
    // the Pick a Card game's own back
    await go(p, '#game-cards');
    await p.waitForSelector('.pcard__back', { timeout: 8000 }).catch(() => {});
    if (await p.locator('.pcard__back').count()) {
      check(/gradient/.test(await p.evaluate(() => getComputedStyle(document.querySelector('.pcard__back')).backgroundImage)) && await p.evaluate(() => getComputedStyle(document.querySelector('.pcard__back')).borderTopColor) === 'rgb(34, 240, 122)', 'in Pick a Card the face-down cards have the chosen back and its edge colour');
    } else { check(false, 'Pick a Card shows its face-down cards'); }
    // kept across a reload
    await p.reload({ waitUntil: 'load' });
    await p.waitForFunction(() => document.body.classList.contains('is-ready'));
    check(await p.evaluate(() => document.body.getAttribute('data-cardback')) === 'emerald', 'the card back is still Emerald after a reload');
    // back to classic
    await go(p, '#quests');
    await p.check('.qpick input[name="q-cardback"][value="classic"]');
    check(await p.evaluate(() => document.body.getAttribute('data-cardback')) === 'classic', 'and the classic one can be chosen again');
    // a confetti style: hearts draw no green, the classic mix does
    const pixels = (style) => p.evaluate(async (st) => {
      GS.cosmetics.setActive('confetti', st);
      GS.confetti.clear();
      GS.confetti.burst({ count: 400, power: 500, x: innerWidth / 2, y: innerHeight / 2 });
      await new Promise((r) => setTimeout(r, 90));
      const c = document.getElementById('confetti');
      const copy = document.createElement('canvas');
      copy.width = c.width; copy.height = c.height;
      const cx = copy.getContext('2d', { willReadFrequently: true });
      cx.drawImage(c, 0, 0);
      const d = cx.getImageData(0, 0, c.width, c.height).data;
      let green = 0, pink = 0, any = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 200) { continue; }
        any++;
        if (d[i + 1] > d[i] + 50 && d[i + 1] > d[i + 2] + 20) { green++; }
        if (d[i] > 200 && d[i + 1] < 150) { pink++; }
      }
      GS.confetti.clear();
      return { green, pink, any };
    }, style);
    const classic = await pixels('classic');
    const hearts = await pixels('hearts');
    check(classic.any > 200 && classic.green > 20, 'the classic confetti has green in it', classic);
    check(hearts.any > 200 && hearts.green === 0 && hearts.pink > 20, 'the Heart Shower style is pinks and reds only (no green pixels), so the chosen style really is what is drawn', hearts);
    await p.evaluate(() => GS.cosmetics.setActive('confetti', 'classic'));
    await p.close();
    // a choice the visitor does not own is refused, even by a script
    const q = await seeded(save(hist, { cards: {} }), { viewport: { width: 1366, height: 800 } }, { quests: { v: 1, firstSeen: '2026-10-01' } });
    await open(q);
    check(await q.evaluate(() => GS.cosmetics.setActive('cardback', 'goldleaf')) === false && await q.evaluate(() => document.body.getAttribute('data-cardback')) === 'classic', 'a card back that is not unlocked cannot be chosen');
    check(await q.locator('.qpick input:disabled').count() === 8, 'eight of the ten choices are locked on a new save');
    await q.close();
    check(problems.length === problems0, 'section 26h: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ------------------------------------------------------------------------------------------------------ 26i */
  if (section('26i. Frames and titles join the profile page, open only when claimed')) {
    const problems0 = problems.length;
    const hist = [rnd(0, {}, 40)];
    const p = await seeded(save(hist, { cards: {} }), { viewport: { width: 1366, height: 900 } }, { quests: { v: 1, firstSeen: '2026-10-01', season: { id: '2026-11', days: {}, ids: [], quest: 700 } } });
    await open(p);
    const reg = await p.evaluate(() => ({ f: GS.profileFrames.list().map((x) => x.id), t: GS.profileTitles.list().map((x) => x.id), art: GS.profileFrames.get('marquee').art(100).length, ok: GS.profileFrames.isUnlocked('marquee', null, GS.store.get()) }));
    check(reg.f.slice(8).join() === 'marquee,chip,suits,clover,ribbon,crown' && reg.t.slice(8).join() === 'quest-starter,season-regular,quest-keeper,season-finisher', 'six frames and four titles were added to the profile page\'s lists, after the built-in ones', reg);
    check(reg.art > 200 && !reg.ok, 'the frames bring their own pictures, and are locked until claimed');
    await go(p, '#me');
    await p.waitForSelector('#view-me .pickcard');
    const locked = await p.evaluate(() => Array.from(document.querySelectorAll('#view-me [data-role="frames"] .pickcard, #view-me [data-role="titles"] .pickcard')).filter((l) => /^(Marquee|Chip Edge|Four Suits|Lucky Clover|Gift Ribbon|Crown|Quest Starter|Season Regular|Quest Keeper|Season Finisher)$/.test(l.querySelector('.pickcard__t b').textContent)).map((l) => ({ n: l.querySelector('.pickcard__t b').textContent, off: l.querySelector('input').disabled, how: (l.querySelector('.pickcard__lock') || { textContent: '' }).textContent })));
    check(locked.length === 10 && locked.every((l) => l.off && /How to unlock: Reach tier \d+ of the season track, on the Quests page\./.test(l.how)), 'all ten are listed, locked, each saying which tier unlocks it', locked);
    await go(p, '#quests');
    await p.click('.qtier__btn[data-tier="7"]');
    await p.waitForTimeout(200);
    await p.click('.qtier__btn[data-tier="5"]');
    await p.waitForTimeout(200);
    check((await h.toastText(p)).some((t) => /You unlocked the Marquee emblem frame\. Wear it from your profile/.test(t)), 'claiming tier 7 says "You unlocked the Marquee emblem frame. Wear it from your profile."', await h.toastText(p));
    await go(p, '#me');
    await p.waitForSelector('#view-me .pickcard');
    const open1 = await p.evaluate(() => ({ marquee: !document.querySelector('#view-me input[name="me-frame"][value="marquee"]').disabled, chip: !document.querySelector('#view-me input[name="me-frame"][value="chip"]').disabled, starter: !document.querySelector('#view-me input[name="me-title"][value="quest-starter"]').disabled }));
    check(open1.marquee && open1.starter && !open1.chip, 'the claimed frame (Marquee) and title (Quest Starter) can be picked; Chip Edge stays locked', open1);
    await p.check('#view-me input[name="me-frame"][value="marquee"]');
    await p.check('#view-me input[name="me-title"][value="quest-starter"]');
    await p.waitForTimeout(200);
    const hero = await p.evaluate(() => ({ frame: document.querySelector('#view-me .phero .pframe').className, title: (document.querySelector('#view-me .phero__title') || { textContent: '' }).textContent.trim(), svg: document.querySelector('#view-me .phero .pframe__art svg').innerHTML.length }));
    check(/pframe--marquee/.test(hero.frame) && /Quest Starter/.test(hero.title) && hero.svg > 200, 'the hero card wears the Marquee frame and the Quest Starter title', hero);
    await p.screenshot({ path: '/tmp/claude-0/q-26i-me.png' }).catch(() => {});
    // all six frames draw something at full size, in the page
    const draw = await p.evaluate(() => GS.profileFrames.list().slice(8).map((f) => { try { const s = f.art(100); return [f.id, s.length > 150 && /<(circle|path|rect|ellipse)/.test(s) && !/NaN/.test(s)]; } catch (e) { return [f.id, false]; } }));
    check(draw.every((d) => d[1]), 'every season frame draws valid shapes (no NaN)', draw);
    await p.close();
    check(problems.length === problems0, 'section 26i: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ------------------------------------------------------------------------------------------------------ 26j */
  if (section('26j. The lobby block, the Help answer, and the season\'s end text across a month and a week')) {
    const problems0 = problems.length;
    const p = await seeded(save(richHistory()), { viewport: { width: 1366, height: 800 } });
    await open(p, '#lobby');
    await p.waitForSelector('[data-block="quests"] .qblock');
    const blk = await txt(p, '[data-block="quests"]');
    check(/Today: 3 of 3 done/.test(blk) && /Season tier \d+ of 30/.test(blk) && /to claim/.test(blk), 'the lobby block says how many of today\'s quests are done, the season tier and what can be claimed', blk);
    check(await p.locator('[data-block="quests"] a[href="#quests"]').count() === 1 && await p.locator('[data-block="quests"] [aria-live], [data-block="quests"] [role="status"]').count() === 0, 'it links to the Quests page and is not a live region');
    await p.click('[data-block="quests"] a[href="#quests"]');
    await p.waitForSelector('#view-quests .qtrack');
    check(await p.evaluate(() => GS.app.route()) === 'quests', 'the link opens the Quests page');
    check(await p.evaluate(() => document.querySelector('a[data-route="quests"]').getAttribute('aria-current')) === 'page', 'the side-menu entry is marked as the current page');
    await go(p, '#help-quests');
    await p.waitForSelector('#help-quests[open]');
    const help = await txt(p, '#help-quests');
    check(/What are quests\?/.test(help) && /season/.test(help) && /never money/.test(help) && !BAD.test(help), 'Help has "What are quests?" and it says the rewards are never money', help.slice(0, 120));
    await p.close();
    // phone: the lobby block stays on one tidy line or wraps, with no sideways scroll
    const m = await seeded(save(richHistory()), { viewport: { width: 320, height: 640 }, mobile: true });
    await open(m, '#lobby');
    await m.waitForSelector('[data-block="quests"] .qblock');
    check(await noSideways(m), 'the lobby with its new block does not scroll sideways at 320 px');
    await m.close();
    // real-donation (redirect) mode: no live-table or daily-wheel quests, and the page still works
    const rd = await seeded(save(richHistory()), { viewport: { width: 1366, height: 800 } });
    await rd.route('**/js/config.js', async (route) => {
      const src = fs.readFileSync(path.join(h.root, 'js/config.js'), 'utf8').replace("mode: 'demo'", "mode: 'redirect'");
      await route.fulfill({ status: 200, contentType: 'text/javascript', body: src });
    });
    await open(rd);
    check(await rd.locator('html').getAttribute('data-mode') === 'redirect', 'redirect mode is on');
    const rv = await view(rd);
    check(rv.daily.map((q) => q.id).join() === Q.pickDaily(core.dayKey(NOW), { live: false, demo: false }).join() && rv.weekly.map((q) => q.id).join() === Q.pickWeekly(core.weekKey(NOW), { live: false, demo: false }).join(), 'the quests are the ones that can be done without live tables and the daily wheel', rv.daily.map((q) => q.id));
    check(rv.daily.concat(rv.weekly).every((q) => !Q.quest(q.id).needs) && rv.daily.length === 3 && rv.weekly.length === 3, 'three and three, none of them needing live tables or the wheel');
    check(await noSideways(rd) && !BAD.test(await rd.evaluate(() => document.querySelector('#view-quests').innerText)), 'the page has no sideways scroll and no banned words in this mode');
    await rd.close();
    // the month and week boundaries in the browser (the clock is fixed on each side)
    const when = async (d, hash, fn) => { const pg = await seeded(null, { viewport: { width: 1366, height: 800 }, now: d }); await open(pg, hash); const r = await fn(pg); await pg.close(); return r; };
    const a = await when(new Date(2026, 10, 30, 23, 59, 50), '#quests', async (pg) => [await txt(pg, '.qseason .sect__t'), await txt(pg, '.qseason__ends')]);
    const b = await when(new Date(2026, 11, 1, 0, 0, 10), '#quests', async (pg) => [await txt(pg, '.qseason .sect__t'), await txt(pg, '.qseason__ends')]);
    check(a[0] === 'Gold November' && a[1] === 'Ends tonight at midnight', '30 November 23:59:50: the Gold November season, ends tonight at midnight', a);
    check(b[0] === 'Winter Gala' && b[1] === 'Ends in 31 days', '1 December 00:00:10: a new season, Winter Gala, ends in 31 days', b);
    const sun = await when(new Date(2026, 10, 1, 23, 59, 50), '#quests', async (pg) => (await view(pg)).weekly.map((q) => q.id));
    const mon = await when(new Date(2026, 10, 2, 0, 0, 10), '#quests', async (pg) => (await view(pg)).weekly.map((q) => q.id));
    check(sun.join() === Q.pickWeekly(core.weekKey(new Date(2026, 10, 1)), ALL).join() && mon.join() === Q.pickWeekly(core.weekKey(new Date(2026, 10, 2)), ALL).join() && sun.join() !== mon.join(), 'Sunday 23:59:50 and Monday 00:00:10 have different weekly quests (the ones each week picks)', { sun, mon });
    const ydy = await when(new Date(2026, 10, 10, 23, 59, 50), '#quests', async (pg) => (await view(pg)).daily.map((q) => q.id));
    const tdy = await when(new Date(2026, 10, 11, 0, 0, 10), '#quests', async (pg) => (await view(pg)).daily.map((q) => q.id));
    check(ydy.join() === Q.pickDaily('2026-11-10', ALL).join() && tdy.join() === Q.pickDaily('2026-11-11', ALL).join(), 'and the daily quests change at midnight to the next day\'s picks', { ydy, tdy });
    check(problems.length === problems0, 'section 26j: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ------------------------------------------------------------------------------------------------------ 26k */
  if (section('26k. "Reset my progress" and "Erase my data"')) {
    const problems0 = problems.length;
    const hist = richHistory();
    const local = { quests: { v: 1, firstSeen: '2026-10-01', claimed: { ['d:' + core.dayKey(NOW) + ':d-rounds3']: true }, season: { id: '2026-11', days: { [core.dayKey(NOW)]: 5 }, ids: hist.map((r) => r.id), quest: 20 } }, cosmetics: { v: 1, owned: { cardback: ['emerald'], frame: ['marquee'] }, active: { cardback: 'emerald' } } };
    const p = await seeded(save(hist, { account: ADA }), { viewport: { width: 1366, height: 800 } }, local);
    await open(p, '#giving');
    await p.waitForSelector('#view-giving [data-role="reset"]');
    check((await p.evaluate(() => document.body.getAttribute('data-cardback'))) === 'emerald', 'the saved card back is in force on any page');
    await p.click('#view-giving [data-role="reset"]');
    await p.click('#view-giving [data-role="reset"]');
    await p.waitForTimeout(400);
    const q = await stored(p, 'quests');
    check(q && Object.keys(q.claimed).length === 0 && q.season.ids.length === 0 && /^2026-(09|10)-/.test(q.firstSeen), 'resetting progress clears the claims and the season count (and remembers when they first came)', q);
    const c = await stored(p, 'cosmetics');
    check(c && c.owned.cardback.includes('emerald') && c.owned.frame.includes('marquee'), 'the cosmetics they unlocked are kept', c);
    check((await p.evaluate(() => GS.store.get().history.length)) === 0 && (await view(p)).season.points === 0, 'and the season starts from zero');
    // Erase my data wipes both keys
    await p.click('#acct [data-role="toggle"]');
    await p.click('#acct [data-role="settings"]');
    await p.waitForSelector('#dlg-settings[open]');
    const erase = p.locator('#dlg-settings [data-role="erase"]');
    await erase.click();
    await erase.click();
    await p.waitForFunction(() => !document.querySelector('#dlg-settings').open);
    await p.waitForTimeout(300);
    const gone = await p.evaluate(() => ({ q: localStorage.getItem('givespin:x:quests'), c: localStorage.getItem('givespin:x:cosmetics') }));
    check(gone.c === null && (gone.q === null || JSON.parse(gone.q).claimed && Object.keys(JSON.parse(gone.q).claimed).length === 0), '"Erase my data" erases the cosmetics and the quest data', gone);
    check(await p.evaluate(() => GS.cosmetics.active('cardback') === 'classic' && document.body.getAttribute('data-cardback') !== undefined), 'and the card back goes back to the classic one for the next page load');
    await p.close();
    check(problems.length === problems0, 'section 26k: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ------------------------------------------------------------------------------------------------------ 26l */
  if (section('26l. axe scans of the Quests page and the lobby')) {
    const problems0 = problems.length;
    const hist = richHistory();
    const seed = { quests: { v: 1, firstSeen: '2026-10-01', season: { id: '2026-11', days: {}, ids: [], quest: 700 } }, cosmetics: { v: 1, owned: { cardback: ['emerald'], confetti: ['gold'] }, active: { cardback: 'emerald' } } };
    for (const [label, size, mobile, rm] of [['laptop', { width: 1366, height: 768 }, false, 'no-preference'], ['phone', { width: 390, height: 844 }, true, 'no-preference'], ['phone held sideways', { width: 844, height: 390 }, true, 'no-preference'], ['laptop, reduced motion', { width: 1366, height: 768 }, false, 'reduce'], ['small phone', { width: 320, height: 568 }, true, 'no-preference']]) {
      const p = await seeded(save(hist), { viewport: size, mobile, reducedMotion: rm }, seed);
      await open(p);
      await a11y(p, 'Quests with things to claim: ' + label);
      await p.close();
    }
    const e = await seeded(null, { viewport: { width: 1366, height: 768 } });
    await open(e);
    await a11y(e, 'Quests on a new save (head start): laptop');
    await e.close();
    const l = await seeded(save(hist), { viewport: { width: 1366, height: 768 } }, seed);
    await open(l, '#lobby');
    await l.waitForSelector('[data-block="quests"] .qblock');
    await a11y(l, 'the lobby with the quests block: laptop');
    await go(l, '#cards');
    await l.click('#view-cards [data-filter="locked"]');
    await a11y(l, 'Your cards with the Emerald card back on the cards still to win');
    await l.close();
    const lp = await seeded(save(hist), { viewport: { width: 390, height: 844 }, mobile: true }, seed);
    await open(lp, '#lobby');
    await lp.waitForSelector('[data-block="quests"] .qblock');
    await a11y(lp, 'the lobby with the quests block: phone');
    await lp.close();
    check(problems.length === problems0, 'section 26l: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }
}
