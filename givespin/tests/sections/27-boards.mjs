// Feature 8: the leaderboards (#boards): top crews, charities and players for this week and all time, the visitor's own row, crew goals, Share my crew,
// and the lobby block. Sections 27a to 27j (run them by whole id: ONLY=27a,27b,...).
//   27a  the page opens: heading, the simulated note, three tabs, the toggle, the crews table with BOT pills, goal bars; numbers equal the logic's at a fixed clock
//   27b  tabs and the toggle by keyboard (arrow keys, Home, End, roving tab stop) and by mouse; each state's heading and table
//   27c  players: a fresh save is last, a ranked save, a save with gifts this week; the visitor's row at its real rank; BOT pills and chips; bot names open a dialog
//   27d  charities: the top ten, the visitor's own backings, rows further down, the "not a ranking" note, names open the charity's profile
//   27e  crews: joining from the page, the visitor's gifts in the total and the goal, a reached goal, one crew only, leaving on the Crews page
//   27f  Share my crew: the dialog, both shapes (real PNG, size, not blank), plain and gold frames, alt text, no name, Download / Share / Copy, keyboard
//   27g  the lobby block, Help, real-donation mode, an older save, nothing stored and nothing changed in the save, Erase my data
//   27h  no sideways scroll from 320 to 2560 px (every tab and both ranges), a phone held sideways, reduced motion, nothing animates, no layout shift
//   27i  axe scans of every state at a laptop and a phone size, with a crew joined and with a rank
//   27j  the clock: a week boundary, numbers fixed inside a slot, only growing through the week, the same after a reload
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const B = require('../../js/boards.js');
const weekly = require('../../js/weekly.js');

const BANNED = /\b(crypto(?!graphic)|bitcoin|ethereum|blockchain|wallet|NFTs?|tokens?|coins?|jackpot|cash out|winnings|payout|real players?)\b/i;

export default async function (h) {
  const { check, newPage, openApp, go, section, a11y, core, GSdata, problems } = h;
  const browserOf = async () => { const q = await newPage({}); const b = q.context().browser(); await q.close(); return b; };
  const IDS = GSdata.charities.map((c) => c.id);
  const charity = (id) => GSdata.charities.find((c) => c.id === id);
  // the amounts as the page prints them: cents under $1,000, whole dollars from there on
  const m = (c) => core.fmtMoney(c >= 100000 ? Math.round(c / 100) * 100 : c, true);
  const WED = new Date(2026, 10, 4, 12, 0, 0);     // a Wednesday of 2026-W45
  const HOUR = 3600e3;

  const saveOf = (cents, extra) => Object.assign({ v: 2, xp: Math.floor(cents / 10), totalCents: cents, plays: 20, streak: 2, bestStreak: 4 }, extra || {});
  /** A round `ago` ms before `when`, giving `cents` to each charity id. */
  const round = (when, ago, cents, ids, i) => ({ id: 'r' + i, ts: when.getTime() - ago, game: 'wheel', totalCents: cents * ids.length, rounds: 1, status: 'ok', pay: 'credit', freq: 'once', allocations: ids.map((id) => ({ charityId: id, cents })) });

  /** A page with a fixed clock and (when given) a saved game, opened on #boards. */
  const open = async (opts, hash) => {
    const o = opts || {};
    const p = await newPage({ viewport: o.viewport || { width: 1366, height: 800 }, mobile: o.mobile, reducedMotion: o.reducedMotion });
    if (o.when !== false) { await p.clock.setFixedTime(o.when || WED); }
    if (o.save) {
      await p.addInitScript((s) => { try { if (!sessionStorage.getItem('__seeded')) { localStorage.setItem('givespin:v2', JSON.stringify(s)); sessionStorage.setItem('__seeded', '1'); } } catch (e) { /* ignore */ } }, o.save);
    }
    await openApp(p, hash === undefined ? '#boards' : hash);
    if ((hash === undefined || hash === '#boards')) { await p.waitForSelector('#bd-panel table'); }
    return p;
  };

  /** What the logic says should be on the page: the page's own lists of bots and crews, the roster, the spotlight, and the visitor's numbers from the save we gave it. */
  const expectCtx = async (p, save, when) => {
    const lists = await p.evaluate(() => ({ handles: GS.live.HANDLES.slice(), crews: GS.crews.CREWS.map((c) => ({ id: c.id, name: c.name, members: c.members.slice() })) }));
    const sp = weekly.current(GSdata.charities, when || WED);
    return { handles: lists.handles, crews: lists.crews, charityIds: IDS, spotlightId: sp.id, me: B.mine(save ? { history: save.history, totalCents: save.totalCents, charityCounts: save.charityCounts, crew: save.crew || '' } : { history: [], totalCents: 0, crew: '' }, when || WED) };
  };

  const rows = (p) => p.evaluate(() => Array.from(document.querySelectorAll('#bd-panel table tbody tr')).map((tr) => {
    const q = (s) => { const e = tr.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
    return {
      rank: Number(q('.bd__n')), you: tr.classList.contains('is-you'), hasYou: tr.classList.contains('has-you'), extra: !!tr.closest('.bd__extra'),
      name: tr.querySelector('.botname') ? tr.querySelector('.botname').textContent.trim() : (tr.querySelector('.bd__ch') ? tr.querySelector('.bd__ch span:last-child').textContent.trim() : (q('.bd__nm b') || '')),
      id: tr.getAttribute('data-crew'), value: q('.bd__v'), sub: q('.amt small') || q('.bd__amt small'), pills: tr.querySelectorAll('.botpill').length, chips: tr.querySelectorAll('.rchip').length,
      bar: tr.querySelector('[role="progressbar"]') ? { now: tr.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'), text: tr.querySelector('[role="progressbar"]').getAttribute('aria-valuetext'), width: tr.querySelector('[role="progressbar"] i').style.width, done: tr.querySelector('[role="progressbar"]').classList.contains('is-done') } : null,
      goalText: q('.bd__goalt'), join: tr.querySelector('[data-join]') ? tr.querySelector('[data-join]').getAttribute('data-join') : null, text: tr.innerText.replace(/\s+/g, ' ').trim()
    };
  }));
  const text = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ').trim() : null; }, sel);
  const noSideways = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const tabIs = (p, id) => p.evaluate((i) => document.querySelector('#bd-tab-' + i).getAttribute('aria-selected') === 'true', id);
  const pick = async (p, tab, range) => {
    await p.click('#bd-tab-' + tab);
    if (range) { await p.click('[data-range="' + range + '"]'); }
    await p.waitForSelector('#bd-panel table');
  };

  /* ------------------------------------------------------------------------------------------------------ 27a */
  if (section('27a. Leaderboards: the page opens with a note that everyone else is a bot, three tabs, the toggle, and crews with goals')) {
    const problems0 = problems.length;
    const p = await open();
    check(await p.locator('#view-boards h1').count() === 1 && (await text(p, '#view-boards h1')) === 'Leaderboards' && (await p.title()).startsWith('Leaderboards'), 'one h1, "Leaderboards", and the tab title says so', await p.title());
    const note = await p.locator('#view-boards .simbanner').first();
    check(await note.isVisible() && /Simulated players/.test(await note.innerText()) && /bot/i.test(await note.innerText()) && (await note.getAttribute('role')) === 'note', 'a visible note says the other players are simulated bots (and their numbers made up)', await note.innerText());
    const tabs = await p.evaluate(() => Array.from(document.querySelectorAll('[role="tablist"] [role="tab"]')).map((t) => ({ t: t.textContent.trim(), sel: t.getAttribute('aria-selected'), idx: t.tabIndex, ctl: t.getAttribute('aria-controls') })));
    check(tabs.length === 3 && tabs.map((t) => t.t).join() === 'Crews,Charities,Players' && tabs[0].sel === 'true' && tabs[1].sel === 'false' && tabs.map((t) => t.idx).join() === '0,-1,-1' && tabs.every((t) => t.ctl === 'bd-panel'), 'a real tablist: Crews, Charities, Players; Crews selected and the only tab stop', tabs);
    check(await p.evaluate(() => { const l = document.querySelector('[role="tablist"]'); return /simulated/i.test(l.getAttribute('aria-label')); }), 'the tablist\'s label says simulated');
    check(await p.evaluate(() => document.querySelector('#bd-panel').getAttribute('role') === 'tabpanel' && document.querySelector('#bd-panel').getAttribute('aria-labelledby') === 'bd-tab-crews'), 'the panel is a tabpanel labelled by the selected tab');
    const tog = await p.evaluate(() => Array.from(document.querySelectorAll('[data-range]')).map((b) => b.textContent.trim() + ':' + b.getAttribute('aria-pressed')));
    check(tog.join() === 'This week:true,All time:false', 'the toggle is two buttons with aria-pressed: This week is on', tog);
    check(/^Top crews this week/.test(await text(p, '#bd-h')) && /Nov 2 to Nov 8/.test(await text(p, '#bd-panel .bd__head .tag')) && /ends in 4 days 12 hours/.test(await text(p, '#bd-panel .bd__head .tag')), 'the heading says it is this week, which week, and how long is left (Wednesday noon: 4 days 12 hours)', await text(p, '#bd-panel .bd__head .tag'));
    const table = await p.evaluate(() => { const t = document.querySelector('#bd-panel table'); return { label: t.getAttribute('aria-label'), colHeads: Array.from(t.querySelectorAll('thead th')).map((x) => x.getAttribute('scope')), rowHeads: Array.from(t.querySelectorAll('tbody th')).map((x) => x.getAttribute('scope')), n: t.querySelectorAll('tbody tr').length }; });
    check(table.n === 4 && table.colHeads.every((s) => s === 'col') && table.rowHeads.every((s) => s === 'row') && /simulated/i.test(table.label), 'a real table: 4 crews, column headers with scope col, a row header (scope row) on each row, and a label that says simulated', table);
    const rs = await rows(p);
    const ctx = await expectCtx(p, null);
    const want = B.crews('week', WED, ctx).rows;
    check(JSON.stringify(rs.map((r) => [r.rank, r.id, r.value])) === JSON.stringify(want.map((r) => [r.rank, r.id, m(r.cents)])), 'the crews, their order and their totals are what the logic gives at this moment', { page: rs.map((r) => [r.rank, r.id, r.value]), want: want.map((r) => [r.rank, r.id, m(r.cents)]) });
    check(rs.every((r) => r.pills === 1) && rs.every((r) => /7 bot members/.test(r.text)), 'every crew carries a BOT pill and says "7 bot members"', rs.map((r) => r.text));
    const wantBy = {}; want.forEach((w) => { wantBy[w.id] = w; });
    check(rs.every((r) => r.bar && r.bar.text === m(wantBy[r.id].cents) + ' of ' + m(wantBy[r.id].goal) && r.goalText === r.bar.text && r.bar.now === String(wantBy[r.id].pct) && r.bar.width === wantBy[r.id].pct + '%'), 'every crew has a goal bar (progressbar) whose words are "$X of $Y" and whose width is that share', rs.map((r) => r.bar));
    check(await p.evaluate(() => Array.from(document.querySelectorAll('#bd-panel [role="progressbar"]')).every((b) => /weekly goal/.test(b.getAttribute('aria-label')) && b.getAttribute('aria-valuemin') === '0' && b.getAttribute('aria-valuemax') === '100')), 'each bar is named ("<crew> weekly goal") and has its range');
    check(rs.every((r) => r.join === r.id), 'with no crew every row has a Join button', rs.map((r) => r.join));
    check(/No crew yet/.test(await text(p, '#bd-panel .bd__mine')) && await p.locator('[data-role="share-crew"]').count() === 0, 'and the page says so, with no Share my crew button yet');
    const words = await p.evaluate(() => document.querySelector('#view-boards').innerText);
    check(!BANNED.test(words) && !/NaN|undefined|null|\[object/.test(words), 'no banned word, no NaN or undefined on the page');
    check(!/\b(best|leading|largest|most popular|number one)\b/i.test(words), 'no superlatives about anyone on the page', words.match(/\b(best|leading|largest|most popular|number one)\b/i));
    check(await noSideways(p), 'no sideways scroll at 1366 px');
    await h.shot(p, '27a-boards-crews');
    await a11y(p, 'the leaderboards (crews, this week) at a laptop size');
    await p.close();
    check(problems.length === problems0, 'section 27a: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ------------------------------------------------------------------------------------------------------ 27b */
  if (section('27b. Leaderboards: the tabs and the toggle work by keyboard (arrows, Home, End) and by mouse')) {
    const problems0 = problems.length;
    const p = await open();
    await p.focus('#bd-tab-crews');
    await p.keyboard.press('ArrowRight');
    check(await tabIs(p, 'charities') && await p.evaluate(() => document.activeElement.id === 'bd-tab-charities'), 'ArrowRight moves to Charities and focuses it');
    check(/^Charities this week/.test(await text(p, '#bd-h')) && await p.evaluate(() => document.querySelector('#bd-panel').getAttribute('aria-labelledby') === 'bd-tab-charities') && await p.locator('#bd-panel tbody tr').count() >= 10, 'the panel shows the charities list and is labelled by that tab');
    check(await p.evaluate(() => Array.from(document.querySelectorAll('[role="tab"]')).map((t) => t.tabIndex).join() === '-1,0,-1'), 'only the selected tab is a tab stop');
    await p.keyboard.press('ArrowRight');
    check(await tabIs(p, 'players') && /^Top players this week/.test(await text(p, '#bd-h')), 'ArrowRight again: Players');
    await p.keyboard.press('ArrowRight');
    check(await tabIs(p, 'crews') && await p.evaluate(() => document.activeElement.id === 'bd-tab-crews'), 'and once more it wraps round to Crews');
    await p.keyboard.press('ArrowLeft');
    check(await tabIs(p, 'players'), 'ArrowLeft wraps the other way');
    await p.keyboard.press('Home');
    check(await tabIs(p, 'crews'), 'Home goes to the first tab');
    await p.keyboard.press('End');
    check(await tabIs(p, 'players'), 'End goes to the last tab');
    await p.keyboard.press('Tab');
    check(await p.evaluate(() => document.activeElement.matches('[data-range]')), 'Tab leaves the tab list for the This week / All time buttons', await p.evaluate(() => document.activeElement.outerHTML.slice(0, 80)));
    await p.keyboard.press('Tab');
    check(await p.evaluate(() => document.activeElement.matches('[data-range="all"]')), 'and on to All time');
    await p.keyboard.press('Enter');
    check(await p.evaluate(() => document.querySelector('[data-range="all"]').getAttribute('aria-pressed') === 'true' && document.querySelector('[data-range="week"]').getAttribute('aria-pressed') === 'false') && /^Top players of all time/.test(await text(p, '#bd-h')), 'Enter on All time switches the filter: aria-pressed moves and the heading changes');
    check(await p.evaluate(() => document.activeElement.matches('[data-range="all"]')), 'the focus stays on the button that was pressed');
    check(/All-time totals/.test(await text(p, '#bd-panel .bd__head .tag')) && !/ends in/.test(await text(p, '#bd-panel .bd__head .tag')), 'All time has no "ends in" countdown');
    await p.keyboard.press('Shift+Tab');
    await p.keyboard.press('Space');
    check(await p.evaluate(() => document.querySelector('[data-range="week"]').getAttribute('aria-pressed') === 'true'), 'Space on This week switches back');
    // mouse
    await p.click('#bd-tab-crews');
    check(await tabIs(p, 'crews') && /^Top crews this week/.test(await text(p, '#bd-h')), 'clicking a tab shows it');
    await p.click('[data-range="all"]');
    const allCrews = await rows(p);
    check(allCrews.length === 4 && allCrews.every((r) => r.bar === null) && !(await p.locator('#bd-panel [role="progressbar"]').count()), 'the all-time crews have no goal bars (a goal is for a week)');
    check(/^Top crews of all time/.test(await text(p, '#bd-h')), 'and the heading says all time');
    // the choice sticks when the page is left and opened again in the same visit
    await go(p, '#lobby');
    await go(p, '#boards');
    await p.waitForSelector('#bd-panel table');
    check(await tabIs(p, 'crews') && await p.evaluate(() => document.querySelector('[data-range="all"]').getAttribute('aria-pressed') === 'true'), 'leaving the page and coming back keeps the tab and the filter for this visit');
    await p.close();
    check(problems.length === problems0, 'section 27b: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ------------------------------------------------------------------------------------------------------ 27c */
  if (section('27c. Leaderboards: players, with the visitor\'s own row always there at its real rank')) {
    const problems0 = problems.length;
    // a fresh save: last of 61, shown under the top ten
    let p = await open();
    await pick(p, 'players');
    let rs = await rows(p);
    let ctx = await expectCtx(p, null);
    let want = B.players('week', WED, ctx);
    check(rs.length === 11 && rs.filter((r) => r.extra).length === 1 && rs[10].extra && rs[10].you, 'a fresh save: the top ten, then the visitor\'s own row under them, in its own part of the table', rs.map((r) => [r.rank, r.name, r.extra]));
    check(rs[10].rank === 61 && /#61<\/b> of 61/.test(await p.locator('.bd__you').innerHTML()) && rs[10].value === '$0', 'it is #61 of 61 with $0', { rank: rs[10].rank, line: await text(p, '.bd__you') });
    check(JSON.stringify(rs.slice(0, 10).map((r) => [r.rank, r.name, r.value])) === JSON.stringify(want.rows.slice(0, 10).map((r) => [r.rank, r.name, m(r.cents)])), 'the ten bots, their order and amounts are what the logic gives (this week)', rs.slice(0, 10).map((r) => [r.rank, r.name, r.value]));
    check(rs.slice(0, 10).every((r) => r.pills === 1 && r.chips === 1 && !r.you), 'every bot has a BOT pill and a rank chip');
    const chipsOk = await p.evaluate(() => Array.from(document.querySelectorAll('#bd-panel tbody tr:not(.is-you)')).every((tr) => { const c = tr.querySelector('.rchip'); const b = tr.querySelector('.botname'); return c && c.getAttribute('role') === 'img' && /level/i.test(c.getAttribute('aria-label')) && b && /simulated player/.test(b.getAttribute('aria-label')); }));
    check(chipsOk, 'the chips are named for screen readers (rank and level) and each bot name is a button named "simulated player"');
    check(await p.evaluate(() => { const r = document.querySelector('.bd__extra .is-you'); return !!r && /You/.test(r.innerText) && !!r.querySelector('.rchip'); }), 'the visitor\'s row says You and has their own chip');
    const amounts = rs.slice(0, 10).map((r) => r.value);
    check(rs.slice(0, 10).every((r, i) => r.rank === i + 1), 'ranks run 1 to 10 in order');
    await p.click('[data-range="all"]');
    rs = await rows(p);
    want = B.players('all', WED, ctx);
    check(JSON.stringify(rs.slice(0, 10).map((r) => [r.rank, r.name, r.value])) === JSON.stringify(want.rows.slice(0, 10).map((r) => [r.rank, r.name, m(r.cents)])) && rs[0].name === 'CharityCat', 'all time: the bots\' fixed totals (CharityCat, the pinned top rank, first)', rs.slice(0, 3).map((r) => [r.name, r.value]));
    check(await p.evaluate(() => /sit|fits/.test(document.querySelector('.bd__lede').textContent) || /fits the rank chip/.test(document.querySelector('.bd__lede').textContent)), 'the page says each bot\'s total fits its rank chip');
    // the chips agree with the totals: a Rank 8 chip next to a total of $1,000,000 or more
    const top = await p.evaluate(() => { const tr = document.querySelector('#bd-panel tbody tr'); return { chip: tr.querySelector('.rchip').getAttribute('aria-label'), v: tr.querySelector('.bd__v').textContent }; });
    check(/^Rank 8/.test(top.chip) && Number(top.v.replace(/[^0-9]/g, '')) >= 1000000, 'the top bot\'s chip says Rank 8 and its total is at least $1,000,000', top);
    await p.close();

    // a ranked save with $1,000 given and nothing this week: weekly last, all time in the middle, and the chip is Rank 1
    p = await open({ save: saveOf(100000) });
    await pick(p, 'players', 'all');
    rs = await rows(p);
    ctx = await expectCtx(p, saveOf(100000));
    want = B.players('all', WED, ctx);
    const mine = rs.find((r) => r.you);
    check(mine && mine.rank === want.you.rank && mine.value === '$1,000' && mine.extra === (want.you.rank > 10), 'a save with $1,000 given: all time the visitor is #' + want.you.rank + ' of 61 with $1,000 (' + (mine && mine.rank) + ')', { page: mine && [mine.rank, mine.value], want: want.you.rank });
    check(await p.evaluate(() => /Rank 1/.test(document.querySelector('#bd-panel .is-you .rchip').getAttribute('aria-label'))), 'and their chip says Rank 1');
    check(want.you.rank === 1 + want.rows.filter((r) => !r.you && r.cents >= 100000).length, 'the rank is one more than the number of bots ahead (checked by counting)');
    await p.click('[data-range="week"]');
    rs = await rows(p);
    check(rs.find((r) => r.you).rank === 61 && rs.find((r) => r.you).value === '$0', 'this week the same visitor, with no gifts this week, is last with $0 (all time and this week differ)');
    await p.close();

    // a save with gifts this week: $5,000 given this week puts the visitor first, inside the list, highlighted, no extra row
    const big = saveOf(500000, { history: [round(WED, 2 * HOUR, 250000, [IDS[3]], 1), round(WED, 5 * HOUR, 250000, [IDS[4]], 2), round(WED, 9 * 24 * HOUR, 99999999, [IDS[5]], 3)] });
    p = await open({ save: big });
    await pick(p, 'players', 'week');
    rs = await rows(p);
    check(rs[0].you && rs[0].rank === 1 && rs[0].value === '$5,000' && rs.filter((r) => r.extra).length === 0 && rs.length === 10, 'with $5,000 given this week (a round from 9 days ago is not counted) the visitor is #1, in the list, with no extra row', rs.slice(0, 2));
    check(/You are <b>#1<\/b>/.test(await p.locator('.bd__you').innerHTML()) && !/under the top 10/.test(await text(p, '.bd__you')), 'and the line above the table says #1');
    check(await p.evaluate(() => document.querySelector('#bd-panel tbody tr').classList.contains('is-you') && getComputedStyle(document.querySelector('#bd-panel tbody tr th')).borderTopColor !== getComputedStyle(document.querySelector('#bd-panel tbody tr:nth-child(2) th')).borderTopColor), 'the visitor\'s row is picked out from the others');
    // a bot's name opens its dialog
    await p.click('#bd-panel tbody tr:nth-child(2) .botname');
    await p.waitForSelector('#dlg-bot[open]');
    check(/simulated player/i.test(await text(p, '#dlg-bot')) && /BOT/.test(await text(p, '#dlg-bot')), 'a bot\'s name opens the simulated-player dialog');
    await p.keyboard.press('Escape');
    await p.close();

    // somewhere in the middle: one cent more than a bot puts the visitor in front of it, an exact tie puts the visitor after it
    const p0 = await open();
    const ctx0 = await expectCtx(p0, null);
    await p0.close();
    const bots = B.players('week', WED, ctx0).rows.filter((r) => !r.you);
    const target = bots[20].cents;
    for (const [cents, label] of [[target, 'level with'], [target + 1, 'one cent ahead of']]) {
      const sv = saveOf(1000000, { history: [{ id: 'q', ts: WED.getTime() - HOUR, game: 'wheel', totalCents: cents, rounds: 1, status: 'ok', pay: 'credit', freq: 'once', allocations: [{ charityId: IDS[1], cents }] }] });
      const q = await open({ save: sv });
      await pick(q, 'players', 'week');
      const got = (await rows(q)).find((r) => r.you);
      // counted here, not taken from the logic: the bots ahead of the visitor, and on a tie the bots count as ahead
      const independent = 1 + bots.filter((r) => (label === 'level with' ? r.cents >= cents : r.cents > cents)).length;
      check(got.rank === independent && got.value === m(cents), 'a visitor ' + label + ' the #21 bot is #' + independent + ' (the page says ' + got.rank + ') and ' + (label === 'level with' ? 'a tie goes to the bot' : 'is in front of it'), got);
      await q.close();
    }
    check(problems.length === problems0, 'section 27c: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ------------------------------------------------------------------------------------------------------ 27d */
  if (section('27d. Leaderboards: charities by times backed, with the visitor\'s own backings, and an honest note')) {
    const problems0 = problems.length;
    let p = await open();
    await pick(p, 'charities');
    let rs = await rows(p);
    let ctx = await expectCtx(p, null);
    let want = B.charities('week', WED, ctx);
    check(rs.length === 10 && JSON.stringify(rs.map((r) => [r.rank, r.name, r.value])) === JSON.stringify(want.rows.slice(0, 10).map((r) => [r.rank, charity(r.id).short, r.count.toLocaleString('en-US')])), 'the top ten charities, their order and their counts are what the logic gives', rs.map((r) => [r.rank, r.name, r.value]));
    check(rs.every((r) => !r.hasYou && !r.extra), 'with no gifts of the visitor\'s nothing is marked as theirs');
    check(!/\btop\b/i.test(await text(p, '#bd-h')), 'the charities heading does not call any charity "top" (voice rule 9: no superlatives about charities)', await text(p, '#bd-h'));
    check(/not a ranking of how good or effective/i.test(await text(p, '.bd__lede')) || /says nothing about how good or effective a charity is/.test(await text(p, '.bd__lede')), 'the page says it is not a ranking of how good a charity is', await text(p, '.bd__lede'));
    check(/not an endorsement/.test(await text(p, '.bd__lede')) && /You have not backed a charity this week/.test(await text(p, '.bd__you')), 'and not an endorsement; and it says the visitor has backed none yet');
    check(await p.evaluate(() => Array.from(document.querySelectorAll('#bd-panel tbody th')).every((th) => th.querySelector('button[data-open-charity]'))), 'each name is a real button');
    // the charity of the week is tagged when it is in the list
    const spotId = ctx.spotlightId;
    const tags = await p.evaluate(() => Array.from(document.querySelectorAll('#bd-panel .tag')).map((t) => t.textContent.trim()));
    check(want.rows.slice(0, 10).some((r) => r.id === spotId) === tags.includes('Charity of the week'), 'the charity of the week is tagged when it is in the top ten, and only then (it is ' + charity(spotId).short + ')');
    await p.click('#bd-panel tbody tr:first-child .bd__ch');
    await p.waitForSelector('#dlg-profile[open]');
    check((await text(p, '#dlg-profile')).includes(charity(want.rows[0].id).name), 'a charity\'s name opens its profile', await text(p, '#dlg-profile h2'));
    await p.keyboard.press('Escape');
    await p.close();

    // the visitor's own backings are added: two rounds on a charity from the top of the list, one far down
    const lead = want.rows[0].id, mid = want.rows[3].id, low = want.rows[300].id;
    const hist = [round(WED, HOUR, 500, [lead], 1), round(WED, 2 * HOUR, 500, [lead, mid], 2), round(WED, 3 * HOUR, 500, [low], 3), round(WED, 12 * 24 * HOUR, 500, [low], 4)];
    const sv = saveOf(10000, { history: hist, charityCounts: { [lead]: 9, [mid]: 4, [low]: 7 } });
    p = await open({ save: sv });
    await pick(p, 'charities', 'week');
    rs = await rows(p);
    ctx = await expectCtx(p, sv);
    want = B.charities('week', WED, ctx);
    const leadRow = want.rows.find((r) => r.id === lead);
    check(leadRow.you === 2 && leadRow.count === leadRow.bots + 2, 'the logic counts the visitor\'s two rounds on the first charity this week (the older ones are not this week)');
    const shownLead = rs.find((r) => r.name === charity(lead).short);
    check(shownLead && shownLead.value === leadRow.count.toLocaleString('en-US') && shownLead.hasYou && /You backed it 2 times/.test(shownLead.text) && /2 from you/.test(shownLead.text), 'the page shows it with the visitor\'s 2 added and "You backed it 2 times"', shownLead);
    const lowRow = want.rows.find((r) => r.id === low);
    const extra = rs.filter((r) => r.extra);
    check(lowRow.rank > 10 && extra.length >= 1 && extra.some((r) => r.name === charity(low).short && r.rank === lowRow.rank && r.value === lowRow.count.toLocaleString('en-US')), 'a charity the visitor backed that is not in the top ten is shown under the list at its real rank (#' + lowRow.rank + ')', extra.map((r) => [r.rank, r.name]));
    check(/You backed <b>3<\/b> charities this week/.test(await p.locator('.bd__you').innerHTML()) || /You backed 3 charities this week/.test(await text(p, '.bd__you')), 'the line above the table says how many charities the visitor backed this week (3)', await text(p, '.bd__you'));
    await p.click('[data-range="all"]');
    rs = await rows(p);
    const wantAll = B.charities('all', WED, ctx);
    const lowAll = wantAll.rows.find((r) => r.id === low);
    check(lowAll.you === 7 && lowAll.count === lowAll.bots + 7, 'all time uses the saved counts (7 for the far-down charity, more than the history alone)');
    const gotAll = rs.find((r) => r.name === charity(low).short);
    check(!!gotAll ? gotAll.value === lowAll.count.toLocaleString('en-US') : lowAll.rank > 10, 'and the all-time page agrees', gotAll);
    check(JSON.stringify(rs.filter((r) => !r.extra).map((r) => [r.rank, r.name, r.value])) === JSON.stringify(wantAll.rows.slice(0, 10).map((r) => [r.rank, charity(r.id).short, r.count.toLocaleString('en-US')])), 'the all-time top ten is what the logic gives', { page: rs.filter((r) => !r.extra).map((r) => [r.rank, r.name, r.value]), want: wantAll.rows.slice(0, 10).map((r) => [r.rank, charity(r.id).short, r.count.toLocaleString('en-US')]) });
    await p.close();
    check(problems.length === problems0, 'section 27d: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ------------------------------------------------------------------------------------------------------ 27e */
  if (section('27e. Leaderboards: join a crew from the page; the visitor\'s gifts fill its total and its goal; one crew only')) {
    const problems0 = problems.length;
    const gifts = saveOf(3000, { history: [round(WED, HOUR, 3000, [IDS[7]], 1)] });
    let p = await open({ save: gifts });
    let ctx = await expectCtx(p, gifts);
    const before = B.crews('week', WED, ctx).rows;
    const target = before[2];     // the third crew
    await p.click('[data-join="' + target.id + '"]');
    await p.waitForSelector('[data-role="share-crew"]');
    check(await p.evaluate(() => GS.store.crew()) === target.id && await p.evaluate(() => GS.crews.mine().id) === target.id, 'Join puts the visitor in that crew (the same save field the Crews page uses): ' + target.id);
    ctx = await expectCtx(p, Object.assign({}, gifts, { crew: target.id }));
    const after = B.crews('week', WED, ctx).rows;
    let rs = await rows(p);
    const mine = rs.find((r) => r.you);
    const wantMine = after.find((r) => r.id === target.id);
    check(mine && mine.id === target.id && mine.value === m(wantMine.cents) && wantMine.cents === target.cents + 3000 && /\$30 from you/.test(mine.text) && /Your crew/.test(mine.text), 'the crew\'s total grows by the visitor\'s $30 this week, says "$30 from you" and is marked Your crew', mine);
    check(JSON.stringify(rs.map((r) => [r.rank, r.id])) === JSON.stringify(after.map((r) => [r.rank, r.id])), 'the order is re-worked with the visitor in (' + after.map((r) => r.id).join(', ') + ')');
    check(rs.every((r) => r.join === null) && rs.filter((r) => r.you).length === 1, 'no Join buttons are left, and only one crew is the visitor\'s');
    check(/You are in .*#\d this week/.test(await text(p, '.bd__mine')) && await p.locator('[data-role="share-crew"]').isVisible() && await p.locator('.bd__mine a[href="#crews"]').count() === 1, 'the strip says which crew and its rank, with Share my crew and a link to the Crews page');
    check(await p.evaluate(() => document.activeElement.matches('[data-role="share-crew"]')), 'the focus moved to Share my crew (the Join button it was on is gone)');
    check(/You joined/.test((await h.toastText(p)).join(' ')), 'a toast says you joined', await h.toastText(p));
    // the goal bar uses the visitor's gifts
    const bar = mine.bar;
    check(bar && bar.now === String(wantMine.pct) && bar.text === m(wantMine.cents) + ' of ' + m(wantMine.goal), 'the goal bar is $X of $Y including the visitor\'s gifts', bar);
    // the Crews page shows the same crew
    await go(p, '#crews');
    check((await text(p, '#view-crews #cr-me')) === ctx.crews.find((c) => c.id === target.id).name, 'the Crews page shows the same crew');
    await go(p, '#boards');
    check(await p.evaluate(() => document.querySelectorAll('#bd-panel tr.is-you').length) === 1, 'back on the page the visitor is still in it');
    // all time: the visitor's whole total is added to the crew
    await p.click('[data-range="all"]');
    rs = await rows(p);
    const allWant = B.crews('all', WED, ctx).rows.find((r) => r.id === target.id);
    check(allWant.youCents === 3000 && rs.find((r) => r.id === target.id).value === m(allWant.cents), 'all time adds the visitor\'s total given (' + m(allWant.youCents) + ') to their crew');
    // leaving is done on the Crews page: the boards follow
    await go(p, '#crews');
    await p.click('[data-role="crew-leave"]');
    await go(p, '#boards');
    await p.waitForSelector('#bd-panel table');
    check(await p.evaluate(() => GS.store.crew()) === '' && (await rows(p)).every((r) => !r.you && r.join), 'after leaving on the Crews page the boards show no crew and Join buttons again');
    await p.close();

    // a reached goal: enough gifts this week finishes it
    const goalWant = before.find((r) => r.id === before[0].id);
    const bigGift = saveOf(goalWant.goal, { crew: goalWant.id, crewEver: true, history: [round(WED, HOUR, goalWant.goal, [IDS[8]], 1)] });
    p = await open({ save: bigGift });
    rs = await rows(p);
    const done = rs.find((r) => r.id === goalWant.id);
    check(done && done.bar.now === '100' && done.bar.done && /goal reached/.test(done.goalText) && done.rank === 1, 'a crew whose goal is reached shows 100%, "goal reached" and the finished bar (and is first)', done);
    check(await p.evaluate(() => getComputedStyle(document.querySelector('.bd__bar.is-done i')).backgroundImage.includes('240, 168, 28') || getComputedStyle(document.querySelector('.bd__bar.is-done i')).backgroundImage.includes('240,168,28')), 'the finished bar is gold');
    await p.close();
    check(problems.length === problems0, 'section 27e: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ------------------------------------------------------------------------------------------------------ 27f */
  if (section('27f. Leaderboards: Share my crew draws a real picture, in both shapes, and nothing personal is on it')) {
    const problems0 = problems.length;
    const sv = saveOf(3000, { crew: 'tide', crewEver: true, history: [round(WED, HOUR, 3000, [IDS[7]], 1)]});
    const p = await open({ save: sv, viewport: { width: 1366, height: 800 } });
    const ctx = await expectCtx(p, sv);
    const row = B.crews('week', WED, ctx).you;
    await p.click('[data-role="share-crew"]');
    await p.waitForSelector('#dlg-crewcard[open] [data-ready="1"]');
    const dlg = await p.evaluate(() => {
      const d = document.querySelector('#dlg-crewcard'); const img = d.querySelector('[data-role="img"]');
      return { title: d.querySelector('.modal__title').textContent, alt: img.alt, w: img.width, h: img.height, natW: img.naturalWidth, natH: img.naturalHeight, pressed: Array.from(d.querySelectorAll('[data-size]')).map((b) => b.getAttribute('data-size') + ':' + b.getAttribute('aria-pressed')), buttons: Array.from(d.querySelectorAll('.sc__act .btn')).map((b) => b.textContent.trim() + (b.hidden ? ' (hidden)' : '') + (b.disabled ? ' (disabled)' : '')), frame: d.querySelector('[data-role="preview"]').getAttribute('data-frame'), file: GS.ui.boards.last() };
    });
    check(dlg.title === 'Share my crew' && dlg.natW === 1080 && dlg.natH === 1350 && dlg.pressed.join() === 'portrait:true,square:false', 'the dialog opens with a 1080 x 1350 portrait picture (as a real image)', dlg);
    check(/Tide Turners/.test(dlg.alt) && /simulated/i.test(dlg.alt) && /weekly goal/.test(dlg.alt) && new RegExp('#' + row.rank + ' of 4').test(dlg.alt), 'its alt text names the crew, its rank and goal, and says simulated', dlg.alt);
    check(dlg.frame === 'plain', 'a crew still short of its goal gets the plain frame');
    check(!/Ada|@/.test(dlg.alt + dlg.file.text) && !/\bYou\b/.test(dlg.file.text), 'no name, email or "You" in the alt text or the share text', dlg.file.text);
    const pix = await p.evaluate(() => {
      const cv = GS.ui.boards.canvas(); const all = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;   // one read of the whole picture
      const at = (x, y) => Array.from(all.slice((y * cv.width + x) * 4, (y * cv.width + x) * 4 + 4));
      const seen = new Set(); let n = 0;
      for (let y = 20; y < cv.height; y += 37) { for (let x = 20; x < cv.width; x += 41) { const d = at(x, y); seen.add((d[0] >> 4 << 8) | (d[1] >> 4 << 4) | (d[2] >> 4)); n++; } }
      return { w: cv.width, h: cv.height, colours: seen.size, samples: n, opaque: String(at(5, 5)[3]), border: at(540, 28) };
    });
    check(pix.w === 1080 && pix.h === 1350 && pix.colours > 20 && pix.opaque === '255', 'the picture is not blank (' + pix.colours + ' colours in a sample grid) and is opaque', pix);
    check(pix.border[0] < 100 && pix.border[2] > 80, 'and its border is the plain blue-grey line, not gold (pixel ' + pix.border.join(',') + ')');
    check(dlg.buttons.join('|').startsWith('Download PNG') && dlg.buttons.some((b) => /^Copy link and text/.test(b)), 'Download PNG and Copy link and text are there', dlg.buttons);
    // Download gives a real PNG
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#dlg-crewcard [data-role="download"]')]);
    const file = await dl.path();
    const buf = fs.readFileSync(file);
    check(dl.suggestedFilename() === 'givespin-crew-portrait.png' && buf.slice(0, 8).toString('hex') === '89504e470d0a1a0a' && buf.length > 20000 && buf.readUInt32BE(16) === 1080 && buf.readUInt32BE(20) === 1350, 'Download PNG saves givespin-crew-portrait.png: a real PNG, 1080 x 1350, ' + buf.length + ' bytes');
    // the square shape
    await p.click('#dlg-crewcard [data-size="square"]');
    await p.waitForSelector('#dlg-crewcard [data-shape="square"][data-ready="1"]');
    const sq = await p.evaluate(() => { const c = GS.ui.boards.canvas(); const i = document.querySelector('#dlg-crewcard [data-role="img"]'); return { w: c.width, h: c.height, nat: [i.naturalWidth, i.naturalHeight], alt: i.alt, pressed: Array.from(document.querySelectorAll('#dlg-crewcard [data-size]')).map((b) => b.getAttribute('aria-pressed')).join() }; });
    check(sq.w === 1080 && sq.h === 1080 && sq.nat.join() === '1080,1080' && /square \(1080 by 1080\)/.test(sq.alt) && sq.pressed === 'false,true', 'the Square shape is 1080 x 1080 with its own alt text');
    // Web Share with the picture as a file, where the browser has it
    await p.evaluate(() => { window.__shared = null; navigator.canShare = () => true; navigator.share = (d) => { window.__shared = { files: (d.files || []).map((f) => f.type + ':' + f.name + ':' + f.size), text: d.text, url: d.url, title: d.title }; return Promise.resolve(); }; });
    await p.click('#dlg-crewcard [data-size="portrait"]');
    await p.waitForSelector('#dlg-crewcard [data-shape="portrait"][data-ready="1"]');
    check(await p.locator('#dlg-crewcard [data-role="share"]').isVisible(), 'the Share button is shown when the browser has Web Share');
    await p.click('#dlg-crewcard [data-role="share"]');
    const shared = await p.evaluate(() => window.__shared);
    check(shared && shared.files.length === 1 && /^image\/png:givespin-crew-portrait\.png:\d{5,}/.test(shared.files[0]) && /simulated crewmates/.test(shared.text) && /Tide Turners/.test(shared.text) && !/#/.test(shared.url || ''), 'Share gives Web Share the PNG as a file plus a short text that says simulated, and the address with no #route', shared);
    // Copy puts the words on the clipboard (stubbed: a headless page cannot read the real one)
    await p.evaluate(() => { window.__copied = null; GS.ui.copy = (t) => { window.__copied = t; return Promise.resolve(true); }; });
    await p.click('#dlg-crewcard [data-role="copy"]');
    const copied = await p.evaluate(() => window.__copied);
    check(copied && /Tide Turners/.test(copied) && /Give it a spin:/.test(copied) && /simulated/.test(copied), 'Copy link and text puts the words (with "simulated") on the clipboard', copied);
    check(!BANNED.test(dlg.alt + (copied || '')), 'no banned word in the words of the card');
    await a11y(p, 'the Share my crew dialog');
    // keyboard: Tab stays in the dialog, Escape closes it, the focus goes back to the button that opened it
    for (let i = 0; i < 12; i++) { await p.keyboard.press('Tab'); }
    check(await p.evaluate(() => !!document.activeElement.closest('#dlg-crewcard')), 'Tab keeps going round inside the dialog');
    await p.keyboard.press('Escape');
    await p.waitForFunction(() => !document.querySelector('#dlg-crewcard').open);
    check(await p.evaluate(() => document.activeElement.matches('[data-role="share-crew"]')), 'Escape closes it and the focus returns to Share my crew');
    // open and close and open again at once: the new picture is not cancelled
    await p.click('[data-role="share-crew"]');
    await p.keyboard.press('Escape');
    await p.click('[data-role="share-crew"]');
    await p.waitForSelector('#dlg-crewcard[open] [data-ready="1"]', { timeout: 15000 });
    check(true, 'closing and opening it again at once still draws the picture');
    await p.keyboard.press('Escape');
    await p.close();

    // a crew that reached its goal gets the gold frame and a ribbon
    const ctx2 = await expectCtx(await open(), null);
    const g0 = B.crews('week', WED, ctx2).rows.find((r) => r.id === 'tide');
    const gold = saveOf(g0.goal, { crew: 'tide', crewEver: true, history: [round(WED, HOUR, g0.goal, [IDS[8]], 1)] });
    const q = await open({ save: gold });
    await q.click('[data-role="share-crew"]');
    await q.waitForSelector('#dlg-crewcard[open] [data-ready="1"]');
    const gp = await q.evaluate(() => {
      const cv = GS.ui.boards.canvas(); const all = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      const at = (x, y) => Array.from(all.slice((y * cv.width + x) * 4, (y * cv.width + x) * 4 + 4));
      return { frame: document.querySelector('#dlg-crewcard [data-role="preview"]').getAttribute('data-frame'), meta: GS.ui.boards.last(), border: at(540, 26), side: at(26, 675) };
    });
    check(gp.frame === 'fancy' && gp.meta.ribbon === 'Goal reached' && gp.border[0] > 200 && gp.border[1] > 150 && gp.border[2] < 200, 'a crew that reached its goal gets the gold frame and a "Goal reached" ribbon (the border pixel is gold)', gp);
    check(/goal, reached/.test(gp.meta.text) && /Gold frame: Goal reached/.test(gp.meta.alt), 'and the share text and alt text say so');
    await q.close();

    // no crew: the button does not exist, and the call refuses politely
    const r = await open();
    const out = await r.evaluate(() => { GS.ui.boards.openShare(); return { open: !!document.querySelector('#dlg-crewcard[open]'), toast: (document.querySelector('#toasts .toast') || {}).textContent }; });
    check(!out.open && /Join a crew first/.test(out.toast || ''), 'without a crew the share call opens nothing and says to join one first', out);
    await r.close();
    check(problems.length === problems0, 'section 27f: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ------------------------------------------------------------------------------------------------------ 27g */
  if (section('27g. Leaderboards: the lobby block, Help, real-donation mode, older saves, nothing stored, Erase my data')) {
    const problems0 = problems.length;
    // the lobby block
    let p = await open({}, '');
    const blk = await p.evaluate(() => { const b = document.querySelector('[data-block="boards"]'); return b ? { hidden: b.hidden, h2: b.querySelector('h2') && b.querySelector('h2').textContent, items: Array.from(b.querySelectorAll('.bdl__item')).map((li) => li.innerText.replace(/\s+/g, ' ').trim()), link: b.querySelector('a[href="#boards"]') && b.querySelector('a[href="#boards"]').textContent, label: b.querySelector('ol').getAttribute('aria-label'), note: b.querySelector('.bdl__note').textContent, bars: b.querySelectorAll('[role="progressbar"]').length } : null; });
    const ctx = await expectCtx(p, null);
    const lead = B.leaders(WED, ctx, 3);
    check(blk && !blk.hidden && blk.h2 === 'This week’s leaders' && blk.items.length === 3 && blk.bars === 3, 'the lobby has a "This week\'s leaders" block with three crews and a goal bar each', blk);
    check(blk.items.every((t, i) => t.includes(ctx.crews.find((c) => c.id === lead[i].id).name) && t.includes('BOT') && t.includes(m(lead[i].cents) + ' of ' + m(lead[i].goal))), 'they are the top three crews, in order, each marked BOT with "$X of $Y"', blk.items);
    check(/simulated/i.test(blk.label) && /Simulated crews: every member is a bot/.test(blk.note) && blk.link === 'See the leaderboards', 'the block says simulated (in its label and its note) and links to the boards');
    const order = await p.evaluate(() => Array.from(document.querySelectorAll('[data-role="blocks"] > [data-block]')).map((b) => b.getAttribute('data-block')));
    check(order.indexOf('boards') > order.indexOf('spotlight') && order.indexOf('boards') >= 0, 'it sits after the charity of the week in the lobby blocks', order);
    await p.click('[data-block="boards"] a[href="#boards"]');
    await p.waitForSelector('#bd-panel table');
    check(await p.evaluate(() => GS.app.state.route) === 'boards', 'its link opens the Leaderboards');
    await go(p, '#boards');
    check(await p.evaluate(() => document.querySelector('.side__link[data-route="boards"]').getAttribute('aria-current') === 'page'), 'and the side menu marks Leaderboards as the current page');
    // Help
    await go(p, '#help-boards');
    await p.waitForSelector('#help-boards[open]');
    const help = await text(p, '#help-boards');
    check(/What are the leaderboards\?/.test(help) && /everyone on them except you is a bot/.test(help) && /not a ranking of how good a charity is/.test(help) && /not an endorsement/.test(help) && !BANNED.test(help), 'Help answers "What are the leaderboards?": everyone but you is a bot, not a ranking of charities, no banned word', help.slice(0, 120));
    await p.close();

    // an older save: no crew fields, no charity counts, no weekly block: the page still loads and the save is untouched
    const old = { v: 2, xp: 400, totalCents: 40000, plays: 12, streak: 1, bestStreak: 3, history: [round(WED, 3 * HOUR, 2500, [IDS[11]], 1), round(WED, 30 * HOUR, 2500, [IDS[12]], 2)] };
    p = await open({ save: old });
    const before = await p.evaluate(() => ({ s: localStorage.getItem('givespin:v2'), keys: Object.keys(localStorage).sort() }));
    for (const t of ['crews', 'charities', 'players']) { for (const r of ['week', 'all']) { await pick(p, t, r); } }
    await go(p, '#lobby');
    await go(p, '#boards');
    await pick(p, 'crews', 'week');
    const after = await p.evaluate(() => ({ s: localStorage.getItem('givespin:v2'), keys: Object.keys(localStorage).sort() }));
    const strip = (j) => { const o = JSON.parse(j); return JSON.stringify({ xp: o.xp, totalCents: o.totalCents, plays: o.plays, history: (o.history || []).length, crew: o.crew }); };
    check(strip(after.s) === strip(before.s) && JSON.stringify(after.keys.filter((k) => /boards/.test(k))) === '[]', 'visiting every tab and filter changes nothing in the save and stores nothing of its own (no "boards" key)', { before: before.keys, after: after.keys });
    const rs = await rows(p);
    check(rs.length === 4 && rs.every((r) => r.join), 'an older save with no crew fields and no charity counts loads and the page draws (4 crews, all joinable)');
    await pick(p, 'players', 'all');
    check((await rows(p)).find((r) => r.you).value === '$400', 'the older save\'s total ($400) is the visitor\'s all-time number');
    await p.close();

    // real-donation mode: the page works and says what the visitor's numbers count; no lobby block
    const browser = await browserOf();
    const ctx2 = await browser.newContext({ viewport: { width: 1366, height: 800 } });
    const rp = await ctx2.newPage();
    rp.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
    await rp.route('**/js/config.js', async (route) => {
      let src = fs.readFileSync(path.join(h.root, 'js/config.js'), 'utf8');
      src = src.replace("mode: 'demo'", "mode: 'redirect'");
      await route.fulfill({ status: 200, contentType: 'text/javascript', body: src });
    });
    await rp.addInitScript(() => { try { if (!sessionStorage.getItem('__fresh')) { localStorage.clear(); sessionStorage.setItem('__fresh', '1'); localStorage.setItem('givespin.tour', 'done'); } } catch (e) { /* ignore */ } });
    await openApp(rp, '#lobby');
    await rp.waitForTimeout(300);
    check(await rp.locator('html').getAttribute('data-mode') === 'redirect' && await rp.evaluate(() => { const b = document.querySelector('[data-block="boards"]'); return !b || b.hidden || b.offsetParent === null; }), 'in real-donation mode the lobby has no simulated leaders block');
    await go(rp, '#boards');
    await rp.waitForSelector('#bd-panel table');
    check(/sent to checkout/.test(await text(rp, '#view-boards .simbanner')) && /Simulated players/.test(await text(rp, '#view-boards .simbanner')), 'the boards page opens and its note says the visitor\'s numbers count what was sent to checkout');
    await pick(rp, 'players');
    check(/sent to checkout/.test(await text(rp, '.bd__you')) && !/play money|demo/i.test(await text(rp, '#bd-panel')), 'the players line says "sent to checkout" and nothing says play money or demo there', await text(rp, '.bd__you'));
    await ctx2.close();

    // Erase my data leaves nothing of this page behind (the page stores nothing)
    const e = await open({ save: saveOf(5000, { crew: 'owls', crewEver: true, history: [round(WED, HOUR, 5000, [IDS[2]], 1)] }) });
    await e.evaluate(() => GS.store.eraseAll && GS.store.eraseAll());
    await e.evaluate(() => GS.local.clearAll());
    await go(e, '#lobby');
    await go(e, '#boards');
    await e.waitForSelector('#bd-panel table');
    check((await rows(e)).every((r) => !r.you), 'after erasing, the visitor is in no crew any more');
    await e.close();
    check(problems.length === problems0, 'section 27g: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ------------------------------------------------------------------------------------------------------ 27h */
  if (section('27h. Leaderboards: no sideways scroll from 320 to 2560 px on every tab and filter, a phone held sideways, reduced motion, no layout shift')) {
    const problems0 = problems.length;
    const sv = saveOf(150000, { crew: 'owls', crewEver: true, history: [round(WED, HOUR, 3000, [IDS[7]], 1), round(WED, 2 * HOUR, 3000, [IDS[450]], 2)] });
    const sizes = [[320, 640, true], [390, 844, true], [768, 1024, true], [1280, 800, false], [2560, 1440, false], [844, 390, true], [568, 320, true]];
    for (const [w, hh, mobile] of sizes) {
      const p = await open({ save: sv, viewport: { width: w, height: hh }, mobile });
      const bad = [];
      for (const t of ['crews', 'charities', 'players']) {
        for (const r of ['week', 'all']) {
          await pick(p, t, r);
          const o = await p.evaluate(() => {
            const de = document.documentElement; const cont = document.querySelector('#bd-panel').getBoundingClientRect();
            const wide = Array.from(document.querySelectorAll('#bd-panel table, #bd-panel td, #bd-panel th')).filter((e) => e.getBoundingClientRect().right > cont.right + 1 || e.scrollWidth > e.clientWidth + 1).map((e) => e.tagName + '.' + e.className).slice(0, 3);
            const clipped = Array.from(document.querySelectorAll('#bd-panel .bd__v')).filter((e) => e.scrollWidth > e.clientWidth + 1).length;
            return { sideways: de.scrollWidth > window.innerWidth + 1, wide, clipped, tabs: Array.from(document.querySelectorAll('.bd__tabs .tab')).every((t) => t.getBoundingClientRect().right <= window.innerWidth) };
          });
          if (o.sideways || o.wide.length || o.clipped || !o.tabs) { bad.push(t + '/' + r + ' ' + JSON.stringify(o)); }
        }
      }
      check(bad.length === 0, w + 'x' + hh + (mobile ? ' (phone)' : '') + ': no sideways scroll, no cell wider than the table, no clipped amount, all three tabs inside the window, on all six states', bad);
      await p.close();
    }
    // 2560: the page keeps a readable width (the shell caps it)
    {
      const p = await open({ save: sv, viewport: { width: 2560, height: 1440 } });
      const w = await p.evaluate(() => Math.round(document.querySelector('#bd-panel').getBoundingClientRect().width));
      check(w <= 1320, 'at 2560 px the table panel is no wider than the page\'s own column (' + w + ' px)');
      await h.shot(p, '27h-boards-2560');
      await p.close();
    }
    // a phone held sideways: the page scrolls up and down like any page, and the first row can be scrolled fully into view with nothing laid over it
    {
      const p = await open({ save: sv, viewport: { width: 844, height: 390 }, mobile: true });
      await pick(p, 'players', 'week');
      await p.locator('#bd-panel tbody tr').first().scrollIntoViewIfNeeded();
      const vis = await p.evaluate(() => {
        const tr = document.querySelector('#bd-panel tbody tr'); const r = tr.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { top: r.top, bottom: r.bottom, h: window.innerHeight, covered: !tr.contains(top) };
      });
      check(vis.top >= 0 && vis.bottom <= vis.h && !vis.covered, 'a phone held sideways: the first row can be scrolled fully into view and nothing covers it', vis);
      await h.shot(p, '27h-boards-sideways');
      await p.close();
    }
    // reduced motion: nothing on the page is animating (and with no preference there is no animation on it either)
    for (const rm of ['reduce', 'no-preference']) {
      const p = await open({ save: sv, reducedMotion: rm });
      for (const t of ['crews', 'charities', 'players']) { await pick(p, t, 'week'); }
      const anim = await p.evaluate(() => document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('#view-boards')).map((a) => a.animationName || a.constructor.name));
      check(anim.length === 0, 'reduced motion = ' + rm + ': no animation or transition runs on the page', anim);
      await p.close();
    }
    // layout shift: nothing moves after the page is drawn (the table does not grow once the fonts and logos load) and a tab switch does not shift the heading
    {
      const p = await newPage({ viewport: { width: 1366, height: 800 } });
      await p.clock.setFixedTime(WED);
      await openApp(p, '#lobby');
      await p.evaluate(() => { window.__cls = 0; new PerformanceObserver((l) => { l.getEntries().forEach((e) => { if (!e.hadRecentInput) { window.__cls += e.value; } }); }).observe({ type: 'layout-shift', buffered: false }); });
      await go(p, '#boards');
      await p.waitForSelector('#bd-panel table');
      await p.waitForTimeout(1200);
      await pick(p, 'charities');
      await p.waitForTimeout(800);
      const cls = await p.evaluate(() => window.__cls);
      check(cls < 0.1, 'layout shift while the page opens and a tab is switched is small (' + cls.toFixed(4) + ' < 0.1)');
      const y0 = await p.evaluate(() => document.querySelector('.bd__controls').getBoundingClientRect().top);
      await pick(p, 'players');
      await pick(p, 'crews');
      const y1 = await p.evaluate(() => document.querySelector('.bd__controls').getBoundingClientRect().top);
      check(y0 === y1, 'the tabs and the toggle stay where they are when the tab changes (' + y0 + ' and ' + y1 + ')');
      await p.close();
    }
    check(problems.length === problems0, 'section 27h: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ------------------------------------------------------------------------------------------------------ 27i */
  if (section('27i. Leaderboards: axe finds nothing in any tab or filter, at a laptop and a phone size, with a crew and a rank')) {
    const problems0 = problems.length;
    const sv = saveOf(150000, { crew: 'paws', crewEver: true, history: [round(WED, HOUR, 3000, [IDS[7]], 1), round(WED, 2 * HOUR, 3000, [IDS[450]], 2)] });
    for (const [label, vp, mobile] of [['laptop', { width: 1366, height: 800 }, false], ['phone', { width: 390, height: 844 }, true]]) {
      for (const [tag, save] of [['a visitor with no crew', null], ['a visitor in a crew with a rank', sv]]) {
        const p = await open({ save, viewport: vp, mobile });
        for (const t of ['crews', 'charities', 'players']) {
          for (const r of ['week', 'all']) {
            await pick(p, t, r);
            await a11y(p, 'the leaderboards: ' + t + ', ' + r + ', ' + label + ', ' + tag);
          }
        }
        await p.close();
      }
    }
    // the lobby block, the reduced-motion page and a sideways phone
    let p = await open({ save: sv }, '');
    await p.locator('[data-block="boards"]').scrollIntoViewIfNeeded();
    await a11y(p, 'the lobby with the leaders block');
    await p.close();
    p = await open({ save: sv, reducedMotion: 'reduce' });
    await a11y(p, 'the leaderboards with reduced motion');
    await p.close();
    p = await open({ save: sv, viewport: { width: 844, height: 390 }, mobile: true });
    await pick(p, 'crews', 'week');
    await a11y(p, 'the leaderboards on a phone held sideways');
    await p.close();
    check(problems.length === problems0, 'section 27i: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ------------------------------------------------------------------------------------------------------ 27j */
  if (section('27j. Leaderboards: the clock: numbers are fixed in a slot and only grow, the week changes on Monday, and a reload shows the same')) {
    const problems0 = problems.length;
    const grab = async (p) => {
      const out = {};
      for (const t of ['crews', 'players']) { await pick(p, t, 'week'); out[t] = (await rows(p)).map((r) => [r.id || r.name, Number(r.value.replace(/[^0-9.]/g, ''))]); }
      out.range = await text(p, '#bd-panel .bd__head .tag');
      return out;
    };
    // Sunday 23:59:50 and Monday 00:00:10: two different weeks, each equal to the logic's
    const sun = new Date(2026, 10, 8, 23, 59, 50), mon = new Date(2026, 10, 9, 0, 0, 10);
    const ps = await open({ when: sun });
    const pm = await open({ when: mon });
    const gs = await grab(ps), gm = await grab(pm);
    check(/Nov 2 to Nov 8/.test(gs.range) && /ends in 1 minute/.test(gs.range), 'Sunday 23:59:50 is still the week of Nov 2 to Nov 8', gs.range);
    check(/Nov 9 to Nov 15/.test(gm.range) && /ends in 6 days 23 hours/.test(gm.range), 'Monday 00:00:10 is the new week, Nov 9 to Nov 15, with a week to go', gm.range);
    const ctxS = await expectCtx(ps, null, sun), ctxM = await expectCtx(pm, null, mon);
    const wantS = B.crews('week', sun, ctxS).rows, wantM = B.crews('week', mon, ctxM).rows;
    check(JSON.stringify(gs.crews.map((r) => r[0])) === JSON.stringify(wantS.map((r) => r.id)) && JSON.stringify(gm.crews.map((r) => r[0])) === JSON.stringify(wantM.map((r) => r.id)), 'each side of the boundary shows the crews the logic gives for its own week');
    check(gm.crews.every((r) => r[1] < 5) && gs.crews.every((r) => r[1] > 300), 'the new week starts with a few dollars, the old one ended with hundreds', { sun: gs.crews, mon: gm.crews });
    check(gm.players.every((r) => r[1] < 10) && gs.players[0][1] > 100, 'and so does every player (under $10 on Monday morning, the leader had hundreds on Sunday night)', [gm.players.slice(0, 3), gs.players.slice(0, 3)]);
    await ps.close(); await pm.close();

    // inside one 15-minute slot nothing changes; a slot later the numbers have grown; they never go down
    const slotMs = 7 * 24 * HOUR / B.SLOTS;
    const start = new Date(2026, 10, 4, 10, 0, 0);
    const info = B.weekInfo(start);
    const slotStart = info.start.getTime() + info.slot * slotMs;
    const a = await open({ when: new Date(slotStart + 1000) });
    const b = await open({ when: new Date(slotStart + slotMs - 1000) });
    const c = await open({ when: new Date(slotStart + slotMs + 1000) });
    const ga = await grab(a), gb = await grab(b), gc = await grab(c);
    check(JSON.stringify(ga) === JSON.stringify(gb), 'two moments inside the same 15-minute slot show identical numbers');
    const total = (g) => g.crews.reduce((s, r) => s + r[1], 0);
    check(total(gc) >= total(ga) && JSON.stringify(gc) !== JSON.stringify(ga), 'the next slot shows more (' + total(ga) + ' then ' + total(gc) + ')');
    await a.close(); await b.close(); await c.close();
    const seq = [];
    for (let k = 0; k < 8; k++) {
      const q = await open({ when: new Date(2026, 10, 2 + Math.floor(k * 0.9), (k * 7) % 24, 30) });
      seq.push([new Date(2026, 10, 2 + Math.floor(k * 0.9), (k * 7) % 24, 30).getTime(), (await rows(q)).reduce((s, r) => s + Number(r.value.replace(/[^0-9.]/g, '')), 0)]);
      await q.close();
    }
    seq.sort((x, y) => x[0] - y[0]);
    check(seq.every((v, i) => i === 0 || v[1] >= seq[i - 1][1]) && seq[7][1] > seq[0][1], 'through the week the crews\' total only goes up (8 moments from Monday to Wednesday)', seq.map((v) => v[1]));

    // a reload shows the same
    const r1 = await open();
    const g1 = await grab(r1);
    await r1.reload({ waitUntil: 'load' });
    await r1.waitForFunction(() => window.GS && GS.app && document.body.classList.contains('is-ready'));
    await go(r1, '#boards');
    await r1.waitForSelector('#bd-panel table');
    const g2 = await grab(r1);
    check(JSON.stringify(g1) === JSON.stringify(g2), 'after a reload the numbers are the same (nothing is stored; they come from the clock)');
    await r1.close();

    // another time zone: the week turns over at the visitor's own Monday midnight (Auckland is 13 hours ahead of UTC in November)
    const browser = await browserOf();
    for (const [label, when, want] of [['Sunday 23:59:50', new Date('2026-11-08T23:59:50+13:00'), /Nov 2 to Nov 8/], ['Monday 00:00:10', new Date('2026-11-09T00:00:10+13:00'), /Nov 9 to Nov 15/]]) {
      const cx = await browser.newContext({ viewport: { width: 1366, height: 800 }, timezoneId: 'Pacific/Auckland' });
      const pg = await cx.newPage();
      pg.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
      await pg.addInitScript(() => { try { if (!sessionStorage.getItem('__fresh')) { localStorage.clear(); sessionStorage.setItem('__fresh', '1'); localStorage.setItem('givespin.tour', 'done'); } } catch (e) { /* ignore */ } });
      await pg.clock.setFixedTime(when);
      await openApp(pg, '#boards');
      await pg.waitForSelector('#bd-panel table');
      const tag = await text(pg, '#bd-panel .bd__head .tag');
      check(want.test(tag), 'in Auckland, ' + label + ' local time: "' + tag + '"', tag);
      await cx.close();
    }
    check(problems.length === problems0, 'section 27j: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }
}
