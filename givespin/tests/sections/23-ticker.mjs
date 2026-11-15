// The live ticker (a bar of simulated players' gifts under the top bar) and the charity of the week (lobby block, #spotlights page, the strip in a
// solo game's "Back a charity" field, the XP bonus on the receipt). The pure logic is unit-tested in tests/ticker.test.js and tests/weekly.test.js.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const weekly = require('../../js/weekly.js');
const ticker = require('../../js/ticker.js');

// words that make a claim about a charity (used on the charity's own sentences) ...
const CLAIMS = /\b(best|better|most|least|largest|biggest|greatest|highest|top|leading|leader|leaders|lead|leads|only|first|premier|finest|foremost|world-class|pioneer|pioneering|major|unique|ultimate|number one|trusted|famous|renowned|cost-effective|guarantee|guaranteed|miracle|always|never)\b/i;
// ... and the same without "always" and "never" (our own copy says "never money"), used on the copy of the page
const SUPER = /\b(best|better|most|least|largest|biggest|greatest|highest|top|leading|leader|leaders|lead|leads|only|first|premier|finest|foremost|world-class|pioneer|pioneering|major|unique|ultimate|number one|trusted|famous|renowned|cost-effective|guarantee|guaranteed|miracle)\b/i;
const CRYPTO = /crypto(?!graph)|bitcoin|ethereum|blockchain|wallet|\bNFTs?\b|\btokens?\b|\bcoins?\b/i;

/** What the bar says right now: the total, the feed's lines, and its box. */
const read = (page) => page.evaluate(() => {
  const t = document.querySelector('#ticker');
  const r = t.getBoundingClientRect();
  const cs = getComputedStyle(t);
  return {
    hidden: t.hidden, display: cs.display, h: Math.round(r.height * 100) / 100, top: Math.round(r.top * 100) / 100,
    amt: (t.querySelector('[data-role="amt"]') || {}).textContent || '',
    items: Array.from(t.querySelectorAll('.tick__item')).map((li) => li.innerText.replace(/\s+/g, ' ').trim()),
    who: Array.from(t.querySelectorAll('.tick__who b')).map((b) => b.textContent),
    text: t.innerText.replace(/\s+/g, ' ').trim()
  };
});
const shownNow = (page) => page.evaluate(() => { const t = document.querySelector('#ticker'); return !!t && !t.hidden && t.offsetParent !== null && t.getBoundingClientRect().height > 0; });
const moneyOf = (dollars) => '$' + dollars.toLocaleString('en-US');

export default async function (h) {
  /* ----------------------------------------------------------------- 23a. where the ticker is, and what it says */
  if (h.section('23a. Ticker: on the lobby and the Live tables pages, labelled as simulated, never on a game screen')) {
    const problems0 = h.problems.length;
    const page = await h.newPage({ viewport: { width: 1440, height: 900 } });
    await h.openApp(page);
    await page.waitForSelector('#ticker:not([hidden])');
    const lobby = await read(page);
    h.check(await shownNow(page) && lobby.h === 36, 'the lobby has the ticker bar, 36 px high', lobby.h);
    h.check(await page.evaluate(() => document.querySelector('#ticker').tagName === 'ASIDE' && !!document.querySelector('#ticker').getAttribute('aria-label')), 'it is a labelled region (an aside with an aria-label)');
    // "Given today" is the pure function of the clock, the same on every page
    const expect = (d) => moneyOf(ticker.givenToday(d));
    const t0 = new Date();
    const ok = [expect(t0), expect(new Date(Date.now()))];
    h.check(/Given today/.test(lobby.text) && ok.includes(lobby.amt), 'it says "Given today" with the total the clock gives (' + lobby.amt + ')', { amt: lobby.amt, ok });
    h.check(/simulated/i.test(lobby.text), 'and the word "simulated" is on the bar, visibly');
    h.check(await page.evaluate(() => /simulated players/i.test(document.querySelector('#ticker .tick__total').title) && /not real/i.test(document.querySelector('#ticker .tick__total').title)), 'the total\'s tooltip says it is simulated players, not real people or money');
    const desc = await page.evaluate(() => { const t = document.querySelector('#ticker'); const d = document.getElementById(t.getAttribute('aria-describedby')); return d ? d.textContent : ''; });
    h.check(/simulated players \(bots\)/.test(desc) && /not from real people/.test(desc) && /Your own gifts are not counted/.test(desc), 'a description for screen readers says the same, and that your own gifts are not counted', desc);
    h.check(lobby.items.length === 3 && lobby.items.every((s, i) => s.includes(lobby.who[i] + ' BOT gave $') && /BOT gave \$\d+ to \S/.test(s)), 'the feed shows three lines, each "<bot> BOT gave $N to <charity>"', lobby.items);
    const handles = await page.evaluate(() => GS.live.HANDLES);
    h.check(lobby.who.length === 3 && lobby.who.every((n) => handles.includes(n)), 'the bots are the handles the live tables use', lobby.who);
    const chips = await page.evaluate(() => Array.from(document.querySelectorAll('#ticker .tick__item')).map((li) => { const c = li.querySelector('.rchip'); const nm = li.querySelector('.tick__who b').textContent; return { chip: !!c, bot: !!c && c.getAttribute('data-bot') === '1', label: c ? c.getAttribute('aria-label') : '', same: !!c && c.getAttribute('aria-label') === GS.core.botStanding(nm).words }; }));
    h.check(chips.every((c) => c.chip && c.bot && /level/i.test(c.label) && c.same), 'each bot wears the rank chip core.botStanding gives that name (the same as on the live tables)', chips);
    h.check(await page.locator('#ticker .tick__item .botpill').count() === 3 && await page.locator('#ticker [aria-live], #ticker [role="status"], #ticker [role="alert"], #ticker [role="log"], #ticker [role="timer"], #ticker [role="marquee"]').count() === 0, 'every line carries a BOT tag, and nothing in the bar is a live region (no aria-live, status, alert or log)');
    const lines = lobby.items.join(' ');
    h.check(!SUPER.test(lines.replace(/ gave /g, ' ')) && !CRYPTO.test(lines), 'the lines have no superlative and no crypto wording');
    await h.shot(page, '23a-lobby-ticker');

    // the same on the Live tables pages, and on a reload
    await h.go(page, '#live');
    const live = await read(page);
    h.check(await shownNow(page) && live.h === 36 && [expect(new Date()), expect(t0)].includes(live.amt), 'the Live tables page has it too, with the same total', live);
    await h.go(page, '#tables-plinko');
    h.check(await shownNow(page), 'and so does a game\'s page of table sizes (#tables-plinko)');
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => document.body.classList.contains('is-ready'));
    const again = await read(page);
    h.check([expect(new Date()), expect(t0)].includes(again.amt), 'a reload shows the same total (it is a function of the clock, nothing is stored)', again.amt);
    h.check(await page.evaluate(() => Object.keys(localStorage).filter((k) => /ticker|spotlight|weekly/i.test(k)).length === 0), 'nothing is saved in the browser for it');

    // not on the pages that are not the lobby or live tables, not on a game, not on a live table
    for (const r of ['#giving', '#charities', '#club', '#help', '#spotlights', '#leagues']) {
      await h.go(page, r);
      h.check(!(await shownNow(page)), 'no ticker on ' + r);
    }
    const bad = [];
    for (const g of h.GAMES) {
      await h.go(page, '#game-' + g);
      if (await shownNow(page) || (await read(page)).h !== 0) { bad.push(g); }
    }
    h.check(bad.length === 0, 'it is not on any of the ' + h.GAMES.length + ' solo game screens (the one-screen rule)', bad);
    await h.go(page, '#live-plinko10');
    await page.waitForTimeout(300);
    h.check(!(await shownNow(page)), 'and not on a live table, which is a game screen with its own one-screen rule');
    await h.go(page, '#lobby');
    h.check(await shownNow(page), 'it comes back on the lobby');

    // Stream Mode hides it
    await page.click('#btn-stream');
    await page.waitForTimeout(250);
    h.check(!(await shownNow(page)), 'Stream Mode hides it');
    await page.click('#stream-exit');
    await page.waitForTimeout(250);
    await h.go(page, '#lobby');
    h.check(await shownNow(page), 'and it is back when Stream Mode ends');
    await page.close();

    // your own gifts are not mixed in: give one, and the bar still shows the clock's total and none of your gifts
    const p2 = await h.newPage({ viewport: { width: 1440, height: 900 } });
    await h.openApp(p2, '#game-wheel');
    await p2.click('#btn-play');
    await h.waitReceipt(p2);
    const given = await p2.evaluate(() => GS.store.get().history[0].totalCents / 100);
    await h.closeReceipt(p2);
    await h.go(p2, '#lobby');
    const mine = await read(p2);
    h.check([expect(new Date()), expect(t0)].includes(mine.amt) && given > 0 && !/\bYou\b/.test(mine.text), 'after a gift of your own the bar shows only the simulated total and no line of yours (you gave $' + given + ')', mine);
    await p2.close();

    // real-donation (redirect) mode has no simulated crowd: no ticker there, but the charity of the week is still on the lobby
    const ctx = await page.context().browser().newContext({ viewport: { width: 1440, height: 900 } });
    const rp = await ctx.newPage();
    rp.on('pageerror', (e) => h.problems.push('pageerror: ' + e.message));
    await rp.route('**/js/config.js', async (route) => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      let src = fs.readFileSync(path.join(h.root, 'js/config.js'), 'utf8');
      src = src.replace("mode: 'demo'", "mode: 'redirect'");
      await route.fulfill({ status: 200, contentType: 'text/javascript', body: src });
    });
    await rp.addInitScript(() => { try { if (!sessionStorage.getItem('__fresh')) { localStorage.clear(); sessionStorage.setItem('__fresh', '1'); localStorage.setItem('givespin.tour', 'done'); } } catch (e) { /* ignore */ } });
    await h.openApp(rp, '#lobby');
    await rp.waitForTimeout(300);
    h.check(await rp.locator('html').getAttribute('data-mode') === 'redirect' && !(await shownNow(rp)), 'in real-donation mode the ticker is not shown (live tables and their simulated crowd are demo-only)');
    h.check(await rp.locator('[data-block="spotlight"] .spot__name').count() === 1, 'while the charity of the week is still on the lobby');
    await h.go(rp, '#help-ticker');
    h.check(/switched off in this version/.test(await rp.locator('#help-ticker').innerText()), 'and Help says the ticker is off in that version');
    await ctx.close();
    h.check(h.problems.length === problems0, 'section 23a: no console errors, warnings or failed requests', h.problems.slice(problems0, problems0 + 5));
  }

  /* ----------------------------------------------------------------- 23b. pause, hover and focus; reduced motion */
  if (h.section('23b. Ticker: updates by itself, pauses (aria-pressed), waits while pointed at or focused, and keeps still with reduced motion')) {
    const problems0 = h.problems.length;
    const page = await h.newPage({ viewport: { width: 1440, height: 900 } });
    await h.openApp(page);
    await page.waitForSelector('#ticker:not([hidden])');
    const btn = page.locator('#ticker [data-role="pause"]');
    h.check(await btn.evaluate((b) => b.tagName === 'BUTTON' && b.type === 'button') && await btn.getAttribute('aria-pressed') === 'false' && /pause/i.test(await btn.getAttribute('aria-label')), 'a real button, "Pause the ticker", aria-pressed false at the start');
    // it changes by itself: move the bar's clock on by ten minutes and wait for its next tick
    const before = await read(page);
    const was = await page.locator('#ticker [data-role="feed"]').innerText();
    await page.evaluate(() => GS.ui.ticker.skew(10 * 60 * 1000));
    await page.waitForFunction((w) => document.querySelector('#ticker [data-role="feed"]').innerText !== w, was, { timeout: 4000 }).catch(() => {});
    const running = await read(page);
    h.check(running.items.join('|') !== before.items.join('|'), 'left alone it puts in new lines by itself', { before: before.items[0], after: running.items[0] });
    h.check(await page.locator('#ticker [data-role="feed"]').evaluate((f) => f.classList.contains('is-fresh') && getComputedStyle(f).animationName === 'tickin'), 'a new line slides in a few pixels when motion is allowed');
    const total2 = running.amt;
    h.check(total2 === moneyOf(ticker.givenToday(new Date(Date.now() + 10 * 60 * 1000))) || total2 === moneyOf(ticker.givenToday(new Date(Date.now() + 10 * 60 * 1000 - 1000))), 'and so does the total (it is the clock\'s total ten minutes on)', total2);

    // Pause: nothing changes while it is on
    await btn.click();
    h.check(await btn.getAttribute('aria-pressed') === 'true', 'pressing it sets aria-pressed to true');
    await page.mouse.move(5, 500);   // away from the bar, so only Pause is holding it still
    await page.evaluate(() => GS.ui.ticker.skew(10 * 60 * 1000));
    await page.waitForTimeout(2400);
    const held = await read(page);
    h.check(held.items.join('|') === running.items.join('|') && held.amt === running.amt, 'while paused neither the lines nor the total change, even ten minutes on');
    await btn.click();
    await page.mouse.move(5, 500);
    h.check(await btn.getAttribute('aria-pressed') === 'false', 'pressing it again starts it');
    const resumed = await read(page);
    h.check(resumed.items.join('|') !== held.items.join('|') && resumed.amt !== held.amt, 'and it jumps to the moment it is now', { held: held.items[0], resumed: resumed.items[0] });

    // pointing at the bar, or focus inside it, holds it too
    const base = await read(page);
    await page.hover('#ticker .tick__total');
    await page.evaluate(() => GS.ui.ticker.skew(10 * 60 * 1000));
    await page.waitForTimeout(2400);
    h.check((await read(page)).items.join('|') === base.items.join('|'), 'it waits while the pointer is over it (what you are reading does not change)');
    await page.mouse.move(5, 500);
    await page.waitForFunction((was) => document.querySelector('#ticker [data-role="feed"]').innerText !== was, await page.locator('#ticker [data-role="feed"]').innerText(), { timeout: 4000 }).catch(() => {});
    h.check((await read(page)).items.join('|') !== base.items.join('|'), 'and carries on when it leaves');
    const base2 = await read(page);
    await page.focus('#ticker [data-role="feed"]');
    await page.evaluate(() => GS.ui.ticker.skew(10 * 60 * 1000));
    await page.waitForTimeout(2400);
    h.check((await read(page)).items.join('|') === base2.items.join('|'), 'it waits while focus is inside it (a keyboard or screen reader user can read the lines in peace)');
    h.check(await page.locator('#ticker [data-role="feed"]').evaluate((f) => f.tabIndex === 0 && !!f.getAttribute('aria-label')), 'the feed is a tab stop with a name, so the latest lines can be reached by tabbing in');
    h.check(await page.evaluate(() => !document.querySelector('#sr-live').textContent.includes('gave')), 'nothing about the feed was ever put in the page\'s announcer');
    await page.close();

    // reduced motion: it starts paused and nothing moves, fades or animates
    const rm = await h.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await h.openApp(rm);
    await rm.waitForSelector('#ticker:not([hidden])');
    const rbtn = rm.locator('#ticker [data-role="pause"]');
    h.check(await rbtn.getAttribute('aria-pressed') === 'true', 'with reduced motion the ticker starts paused (aria-pressed true)');
    const r0 = await read(rm);
    await rm.evaluate(() => GS.ui.ticker.skew(10 * 60 * 1000));
    await rm.mouse.move(5, 500);
    await rm.waitForTimeout(2400);
    h.check((await read(rm)).items.join('|') === r0.items.join('|'), 'and it stays as it was (static text)');
    await rbtn.click();
    await rm.mouse.move(5, 500);
    await rm.evaluate(() => GS.ui.ticker.skew(10 * 60 * 1000));
    await rm.waitForFunction((was) => document.querySelector('#ticker [data-role="feed"]').innerText !== was, await rm.locator('#ticker [data-role="feed"]').innerText(), { timeout: 5000 }).catch(() => {});
    const moved = await rm.evaluate(() => ({
      fresh: document.querySelector('#ticker [data-role="feed"]').classList.contains('is-fresh'),
      anims: document.getAnimations().filter((a) => document.querySelector('#ticker').contains(a.effect && a.effect.target)).length,
      names: Array.from(document.querySelectorAll('#ticker, #ticker *')).map((e) => getComputedStyle(e).animationName).filter((n) => n !== 'none'),
      trans: Array.from(document.querySelectorAll('#ticker, #ticker *')).map((e) => getComputedStyle(e).transitionDuration).filter((d) => d !== '0s' && d !== '')
    }));
    h.check((await read(rm)).items.join('|') !== r0.items.join('|'), 'started again it changes the text in place');
    h.check(!moved.fresh && moved.anims === 0 && moved.names.length === 0, 'with no animation at all: no fade, no slide, no running animation anywhere in the bar', moved);
    await rm.close();
    h.check(h.problems.length === problems0, 'section 23b: no console errors, warnings or failed requests', h.problems.slice(problems0, problems0 + 5));
  }

  /* ----------------------------------------------------------------- 23c. the bar never changes size */
  if (h.section('23c. Ticker: one fixed height, nothing under it moves, nothing scrolls sideways (320 px to 1440 px)')) {
    const problems0 = h.problems.length;
    for (const [name, size, mobile, wantH] of [['a laptop', { width: 1440, height: 900 }, false, 36], ['a laptop (1366x768)', { width: 1366, height: 768 }, false, 36], ['a tablet', { width: 768, height: 1024 }, true, 36], ['a phone (600)', { width: 600, height: 800 }, true, 36], ['a phone (390)', { width: 390, height: 844 }, true, 52], ['a small phone (320)', { width: 320, height: 640 }, true, 52]]) {
      const page = await h.newPage({ viewport: size, mobile });
      await h.openApp(page);
      for (const route of ['#lobby', '#live']) {
        await h.go(page, route);
        await page.waitForSelector('#ticker:not([hidden])');
        await page.waitForTimeout(200);
        // draw the bar at 160 different moments (about 40 minutes of gifts: different bots, amounts and charities, with the longest names among them) and look at the box and at what is under it
        const m = await page.evaluate(() => {
          const t = document.querySelector('#ticker');
          const below = document.querySelector('.layout');
          const heights = new Set(); const tops = new Set(); const belows = new Set(); const widths = new Set();
          let longest = '';
          for (let i = 0; i < 160; i++) {
            GS.ui.ticker.renderAt(new Date(Date.now() + i * 15000 + 3000 * (i % 5)), false);
            const r = t.getBoundingClientRect();
            heights.add(Math.round(r.height * 100)); tops.add(Math.round(r.top * 100)); widths.add(Math.round(r.width * 100));
            belows.add(Math.round(below.getBoundingClientRect().top * 100));
            const s = t.querySelector('.tick__item').innerText; if (s.length > longest.length) { longest = s; }
          }
          // and the worst case on purpose: the longest bot name and the longest charity name together
          const names = GS.charities.map((c) => c.short).sort((a, b) => b.length - a.length);
          const hs = GS.live.HANDLES.slice().sort((a, b) => b.length - a.length);
          t.querySelector('[data-role="feed"]').innerHTML = [0, 1, 2].map((k) => '<li class="tick__item"><span class="tick__who">' + GS.ui.botChip(hs[k], { px: 16 }) + '<b>' + hs[k] + '</b><span class="botpill tick__bot">BOT</span></span> <span class="tick__what">gave <b>$100</b> to <span class="tick__ch">' + names[k] + '</span></span></li>').join('');
          const r = t.getBoundingClientRect();
          heights.add(Math.round(r.height * 100)); belows.add(Math.round(below.getBoundingClientRect().top * 100));
          return { h: [...heights], tops: [...tops], belows: [...belows], widths: [...widths], longest, sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
        });
        h.check(m.h.length === 1 && m.h[0] === wantH * 100 && m.tops.length === 1 && m.belows.length === 1 && m.widths.length === 1, 'on ' + name + ' (' + route + '): the bar stays ' + wantH + ' px high and where it is, and the page under it does not move, over 160 changes and the longest names', m);
        h.check(!m.sideways, 'on ' + name + ' (' + route + '): no sideways scroll');
      }
      await page.close();
    }
    // the two phone layouts keep the line in full: one item and the total
    const ph = await h.newPage({ viewport: { width: 320, height: 640 }, mobile: true });
    await h.openApp(ph);
    await ph.waitForSelector('#ticker:not([hidden])');
    const small = await ph.evaluate(() => {
      const t = document.querySelector('#ticker');
      const vis = (e) => !!e && e.offsetParent !== null && e.getBoundingClientRect().width > 0;
      return { items: Array.from(t.querySelectorAll('.tick__item')).filter(vis).length, total: vis(t.querySelector('.tick__total')), amt: vis(t.querySelector('[data-role="amt"]')), btn: vis(t.querySelector('[data-role="pause"]')), btnW: t.querySelector('[data-role="pause"]').getBoundingClientRect().width, sim: Array.from(t.querySelectorAll('.tick__sim span')).filter(vis).map((s) => s.textContent), within: Array.from(t.querySelectorAll('.tick__total, [data-role="pause"], .tick__item:first-child')).every((e) => e.getBoundingClientRect().right <= 320.5) };
    });
    h.check(small.items === 1 && small.total && small.amt && small.btn && small.btnW >= 24 && small.within, 'at 320 px it shows the total and one line, and a Pause button of at least 24 px, all inside the screen', small);
    h.check(small.sim.join() === 'BOT', 'and the short "BOT" marker stands in for the word "simulated" there', small.sim);
    await ph.close();
    h.check(h.problems.length === problems0, 'section 23c: no console errors, warnings or failed requests', h.problems.slice(problems0, problems0 + 5));
  }

  /* ----------------------------------------------------------------- 23d. short windows */
  if (h.section('23d. Ticker: hidden in short windows (520 px tall or less, or 600 px tall or less when wider than tall)')) {
    const problems0 = h.problems.length;
    // 520: a phone held sideways (390 to 430 px tall) and a phone with its keyboard open are the windows where a 36 px bar would cost a tenth of the screen
    // 600 in landscape: a laptop window with the browser's own bars (1366x600 or less); a window that is taller than it is wide (a phone upright, 568 and up) keeps it from 521 px
    for (const [w, hh, mobile, shown] of [[844, 390, true, false], [568, 320, true, false], [1366, 560, false, false], [1366, 600, false, false], [1366, 601, false, true], [1366, 768, false, true], [390, 520, true, false], [390, 521, true, true], [320, 568, true, true], [800, 600, false, false], [800, 700, false, true], [600, 560, true, false]]) {
      const page = await h.newPage({ viewport: { width: w, height: hh }, mobile });
      await h.openApp(page);
      for (const r of ['#lobby', '#live']) {
        await h.go(page, r);
        await page.waitForTimeout(150);
        const s = await shownNow(page);
        if (s !== shown) { h.check(false, w + 'x' + hh + ' ' + r + ': ticker ' + (shown ? 'shown' : 'hidden'), { shown: s }); }
      }
      h.check(true, w + 'x' + hh + ': the ticker is ' + (shown ? 'shown' : 'hidden') + ' on the lobby and the Live tables page');
      await page.close();
    }
    h.check(h.problems.length === problems0, 'section 23d: no console errors, warnings or failed requests', h.problems.slice(problems0, problems0 + 5));
  }

  /* ----------------------------------------------------------------- 23e. charity of the week: lobby, page, links */
  if (h.section('23e. Charity of the week: the lobby block and the #spotlights page')) {
    const problems0 = h.problems.length;
    const page = await h.newPage({ viewport: { width: 1440, height: 900 } });
    await h.openApp(page);
    const cur = await page.evaluate(() => { const c = GS.weekly.current(GS.charities, new Date()); return { id: c.id, week: c.week, name: c.charity.name, short: c.charity.short, url: GS.ui.siteUrl(c.charity), ex: GS.weekly.explain(c.charity) }; });
    const expectId = weekly.current(h.GSdata.charities, new Date()).id;
    h.check(cur.id === expectId, 'the page and Node agree on this week\'s charity (' + cur.id + ', ' + cur.week + ')', { page: cur.id, node: expectId });
    // the lobby block
    const block = page.locator('[data-block="spotlight"]');
    h.check(await block.count() === 1 && await block.getAttribute('aria-label') === 'Charity of the week', 'the lobby has a "Charity of the week" block');
    const bt = await block.innerText();
    h.check(bt.includes(cur.name) && bt.includes('Charity of the week') && bt.includes(cur.ex.sentences[0]) && bt.includes('+25 XP'), 'it names the charity, gives its first sentence and the bonus', bt.slice(0, 200));
    const link = block.locator('a.extlink');
    h.check(await link.getAttribute('href') === cur.url && await link.getAttribute('target') === '_blank' && /\bnoopener\b/.test(await link.getAttribute('rel')) && /opens in a new tab/.test(await link.getAttribute('aria-label')), 'its name is a link to the charity\'s website that opens in a new tab with rel noopener', cur.url);
    await h.shot(page, '23e-lobby-block');
    await block.locator('[data-role="back"]').click();
    await h.onRoute(page, await page.evaluate(() => location.hash.slice(1)));
    h.check(/^#game-[a-z]+$/.test(await page.evaluate(() => location.hash)) && await page.locator('#view-game').isVisible(), '"Back it in a game" in the lobby goes to a game', await page.evaluate(() => location.hash));
    // the page
    await h.go(page, '#spotlights');
    h.check(await page.locator('#view-spotlights h1').count() === 1 && await page.locator('#ticker').isHidden(), '#spotlights has one heading (and no ticker)');
    const txt = await page.locator('#view-spotlights [data-role="text"]').innerText();
    h.check(txt === cur.ex.text, 'the explanation on the page is exactly the two sentences from the roster\'s own entry', { txt, want: cur.ex.text });
    h.check(cur.ex.sentences.length === 2 && !CLAIMS.test(txt.split(cur.short).join('').split(cur.name).join('')) && !/[$0-9]/.test(txt.split(cur.short).join('').split(cur.name).join('')) && !CRYPTO.test(txt), 'it has no superlative, no amount and no number');
    const main = page.locator('#view-spotlights .spot--big');
    const nameLink = main.locator('.spot__name a');
    h.check(await nameLink.getAttribute('href') === cur.url && await nameLink.getAttribute('target') === '_blank' && /\bnoopener\b/.test(await nameLink.getAttribute('rel')), 'the name is a link to the website: a new tab, rel noopener');
    const visit = main.locator('[data-role="visit"]');
    h.check(await visit.getAttribute('href') === cur.url && await visit.getAttribute('target') === '_blank' && /noopener/.test(await visit.getAttribute('rel')) && /new tab/.test(await visit.getAttribute('aria-label')), 'and so is the "Visit website" button');
    // the new tab is answered locally: the test itself must not reach another host
    await page.context().route((u) => !u.href.startsWith(h.ORIGIN) && !u.href.startsWith('data:'), (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>charity website (test stand-in)</title>' }));
    const [popup] = await Promise.all([page.waitForEvent('popup', { timeout: 5000 }).catch(() => null), visit.click()]);
    h.check(!!popup, 'clicking it opens a new tab (the page itself stays)');
    if (popup) { await popup.close().catch(() => {}); }
    h.check(page.url().includes('#spotlights'), 'the page is still on #spotlights');
    const bonus = await page.locator('#view-spotlights .spot__bonus').innerText();
    h.check(/25 extra XP/.test(bonus) && /never money/.test(bonus) && /once a round/.test(bonus), 'it explains the bonus: 25 extra XP, once a round, never money', bonus);
    const fine = await page.locator('#view-spotlights .spot__fine').innerText();
    h.check(/not a ranking and not an endorsement/.test(fine), 'and that it is picked automatically, not a ranking or an endorsement');
    const past = await page.evaluate(() => Array.from(document.querySelectorAll('#view-spotlights .spasts .spast')).map((li) => li.querySelector('b').textContent));
    const wantPast = weekly.past(h.GSdata.charities, new Date(), 12).map((p) => p.charity.name);
    h.check(past.length === 12 && JSON.stringify(past) === JSON.stringify(wantPast), 'Past spotlights lists the last twelve weeks, newest first, as Node works them out', past);
    h.check(!past.includes(cur.name), 'this week\'s charity is not in the past list');
    await h.shot(page, '23e-spotlights');
    await page.locator('#view-spotlights .spot--big .aboutbtn').click();
    await page.waitForSelector('#dlg-profile[open]');
    h.check((await page.locator('#dlg-profile-title').innerText()) === cur.name, 'About opens the charity\'s profile');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#dlg-profile').open);
    await page.locator('#view-spotlights .spot--big [data-role="back"]').click();
    await h.onRoute(page, await page.evaluate(() => location.hash.slice(1)));
    h.check(/^#game-[a-z]+$/.test(await page.evaluate(() => location.hash)), '"Back it in a game" on the page goes to a game');
    // it goes to the game last played, when that game has a "Back a charity" step
    await h.go(page, '#game-duck');
    await h.go(page, '#spotlights');
    h.check((await page.locator('#view-spotlights [data-role="back"]').getAttribute('href')) === '#game-duck' || (await page.evaluate(() => GS.store.prefs().game)) !== 'duck', 'the game it goes to is the one last played, when it has a "Back a charity" step');
    await page.close();

    // the week boundary in the browser: Sunday night is the old charity, Monday morning the new one (the clock is fixed on both sides)
    for (const [label, when] of [['Sunday 23:59:50', new Date(2026, 10, 1, 23, 59, 50)], ['Monday 00:00:10', new Date(2026, 10, 2, 0, 0, 10)]]) {
      const pg = await h.newPage({ viewport: { width: 1440, height: 900 } });
      await pg.clock.setFixedTime(when);
      await h.openApp(pg);
      const want = weekly.current(h.GSdata.charities, when);
      const got = await pg.locator('[data-block="spotlight"] .spot__name').innerText();
      h.check(got.trim() === want.charity.name, label + ': the lobby shows ' + want.charity.short + ' (' + want.week + ')', got);
      await h.go(pg, '#spotlights');
      const head = await pg.locator('#view-spotlights .spot__eyebrow').innerText();
      h.check(/Nov 2 to Nov 8/i.test(head) === (label.startsWith('Monday')), label + ': the page says which week it is', head);
      await pg.close();
    }
    h.check(h.problems.length === problems0, 'section 23e: no console errors, warnings or failed requests', h.problems.slice(problems0, problems0 + 5));
  }

  /* ----------------------------------------------------------------- 23f. the strip in a solo game, and the receipt's bonus */
  if (h.section('23f. Charity of the week: the strip in a game panel (no height), backing it, and the bonus on the receipt')) {
    const problems0 = h.problems.length;
    const spot = weekly.current(h.GSdata.charities, new Date());
    const nm = spot.charity.short;
    // a tall laptop window shows the strip in the panel, and Play and the amount buttons stay on the first screen
    const lap = await h.newPage({ viewport: { width: 1440, height: 900 } });
    await h.openApp(lap, '#game-duck');
    const first = await lap.evaluate(() => { const s = document.querySelector('#pick-spot'); const r = (e) => { const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, h: b.height }; }; return { shown: !!s && !s.hidden && s.offsetParent !== null, text: s ? s.innerText : '', h: s ? s.getBoundingClientRect().height : 0, play: r(document.querySelector('#btn-play')), pre: r(document.querySelector('#field-amount .presets')), vh: innerHeight, tag: s ? s.tagName : '', live: s ? s.closest('[aria-live]') : null }; });
    h.check(first.shown && first.text.replace(/\s+/g, ' ').startsWith('Charity of the week: ' + nm + ', +25 XP if you back it'), 'on a 1440x900 laptop the Back a charity field has the strip "Charity of the week: ' + nm + ', +25 XP if you back it"', first.text);
    h.check(first.play.bottom <= first.vh && first.pre.bottom <= first.vh && first.live === null, 'Play and the amount buttons are on the first screen with it, and it is not in a live region', first);
    await h.shot(lap, '23f-strip-laptop');
    // 1366x768 and 1280x720: not drawn at all (the panel has no height to spare there)
    for (const [w, hh] of [[1366, 768], [1280, 720], [1440, 899]]) {
      await lap.setViewportSize({ width: w, height: hh });
      await lap.waitForTimeout(350);
      h.check(await lap.evaluate(() => getComputedStyle(document.querySelector('#pick-spot')).display === 'none'), 'at ' + w + 'x' + hh + ' the strip is not drawn (no height is spent)');
    }
    await lap.close();
    // the whole-field height is the same with and without the strip at 1440x900 up to the strip's own line: Play never leaves the first screen at 900
    // a phone: only inside the Options sheet
    const ph = await h.newPage({ viewport: { width: 390, height: 844 }, mobile: true });
    await h.openApp(ph, '#game-duck');
    const dock = await ph.evaluate(() => { const b = document.querySelector('#btn-play').getBoundingClientRect(); const s = document.querySelector('#pick-spot'); const r = s.getBoundingClientRect(); return { playInView: b.bottom <= innerHeight && b.top >= 0, spotInView: r.width > 0 && r.top >= 0 && r.bottom <= innerHeight && getComputedStyle(s).display !== 'none' }; });
    h.check(dock.playInView && !dock.spotInView, 'on a phone the strip is not on the first screen (Play is)', dock);
    await h.openOptions(ph);
    const sheet = await ph.evaluate(() => { const s = document.querySelector('#pick-spot'); return { shown: getComputedStyle(s).display !== 'none' && s.getBoundingClientRect().width > 0, text: s.innerText }; });
    h.check(sheet.shown && /Charity of the week: /.test(sheet.text), 'it is in the Options sheet', sheet);
    await h.shot(ph, '23f-strip-phone-sheet');
    await ph.close();
    const side = await h.newPage({ viewport: { width: 844, height: 390 }, mobile: true });
    await h.openApp(side, '#game-duck');
    h.check(await side.evaluate(() => getComputedStyle(document.querySelector('#pick-spot')).display === 'none'), 'on a phone held sideways (a short window) it is not drawn');
    await side.close();

    // back it from the strip (1440x900), play, and read the receipt
    const page = await h.newPage({ viewport: { width: 1440, height: 900 } });
    await h.openApp(page, '#game-duck');
    await page.fill('#size-custom', '8');
    await page.locator('#size-custom').blur();   // (a click on the chip's x straight after typing is taken up by the field losing focus, which redraws the chip)
    await page.waitForFunction(() => GS.store.prefs().sizes.duck === 8);
    await page.click('#pick-spot [data-role="spot-back"]');
    await page.waitForFunction(() => /is on the board/.test(document.querySelector('#pick-hint').textContent));
    h.check((await page.locator('#pick-chip').innerText()).includes(nm), 'the "Back it" button in the strip backs the charity (it goes on the board as the chip)');
    h.check((await page.locator('#pick-spot').innerText()).includes('You are backing the charity of the week: +25 XP') && await page.locator('#pick-spot [data-role="spot-back"]').count() === 0, 'and the strip says so');
    h.check(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('pickchip__open')), 'focus moved to the backed charity\'s chip (not lost)');
    const start = await page.evaluate(() => GS.store.get().xp);
    await page.click('#btn-play');
    await h.waitReceipt(page);
    const r1 = await page.evaluate(() => { const l = GS.app._last; const sm = l.summary; return { spot: sm.spotlightXp, bonus: sm.bonusXp, gift: sm.giftXp, hot: sm.hotXp, set: sm.setXp, gain: sm.xpGain, pick: l.round.pick, xp: GS.store.get().xp, pickBonus: l.round.pick.won ? GS.core.pickBonusXp(l.round.pick.board, l.round.pick.wins) : 0, text: document.querySelector('#dlg-result').innerText, card: (document.querySelector('#dlg-result .xpcard') || {}).innerText || '' }; });
    h.check(r1.pick.id === spot.id && r1.spot === 25 && r1.bonus === 25 + r1.pickBonus, 'backing the charity of the week: the summary reports 25 XP for it, and the old bonus for backing a winner is exactly what it was (' + r1.pickBonus + ')', r1);
    h.check(r1.gain === r1.gift + r1.bonus + r1.hot + r1.set && r1.xp - start === r1.gain, 'the XP maths adds up: gift XP + bonus (+ hot hand + set), and the saved XP went up by that much', { gain: r1.gain, gift: r1.gift, bonus: r1.bonus, saved: r1.xp - start });
    h.check(/Charity of the week bonus \+25 XP/.test(r1.card) && r1.card.includes(nm), 'the receipt\'s XP card says "Charity of the week bonus +25 XP" and who you backed', r1.card);
    h.check(new RegExp('\\+ 25 for the charity of the week').test(r1.card) && (r1.pickBonus ? new RegExp('\\+ ' + r1.pickBonus + ' bonus').test(r1.card) : !/ bonus/.test(r1.card.replace(/Charity of the week bonus/, ''))), 'and the arithmetic line shows the 25 apart from the bonus for a winning call', r1.card);
    h.check(!SUPER.test(r1.card.split(nm).join('')) && !CRYPTO.test(r1.card), 'the XP card has no superlative or banned wording');
    await h.shot(page, '23f-receipt-bonus');
    await h.a11y(page, 'receipt with the charity of the week bonus');
    await h.closeReceipt(page);

    // a split gift: still 25, once
    await page.click('#rounds-seg button:has-text("3 rounds")');
    await page.click('#btn-play');
    await h.waitReceipt(page);
    const r2 = await page.evaluate(() => { const sm = GS.app._last.summary; const p = GS.app._last.round.pick; return { spot: sm.spotlightXp, bonus: sm.bonusXp, pickBonus: p.won ? GS.core.pickBonusXp(p.board, p.wins) : 0, hot: sm.hotXp, rounds: GS.app._last.round.rounds }; });
    h.check(r2.rounds === 3 && r2.spot === 25 && r2.bonus === 25 + r2.pickBonus, 'a gift split into 3 rounds still gets the 25 once, not three times', r2);
    await h.closeReceipt(page);
    await page.click('#rounds-seg button:has-text("1 charity")');

    // a board of two: a win comes within a few rounds, and then both bonuses are paid, each as before
    await page.fill('#size-custom', '2');
    await page.locator('#size-custom').blur();
    await page.waitForFunction(() => GS.store.prefs().sizes.duck === 2);
    let won = null;
    for (let i = 0; i < 14 && !won; i++) {
      await page.click('#btn-play');
      await h.waitReceipt(page);
      const r = await page.evaluate(() => { const sm = GS.app._last.summary; const p = GS.app._last.round.pick; return { spot: sm.spotlightXp, bonus: sm.bonusXp, gift: sm.giftXp, hot: sm.hotXp, gain: sm.xpGain, won: p.won, wins: p.wins, board: p.board, want: p.won ? GS.core.pickBonusXp(p.board, p.wins) : 0, card: document.querySelector('#dlg-result .xpcard').innerText }; });
      h.check(r.spot === 25 && r.bonus === 25 + r.want && r.gain === r.gift + r.bonus + r.hot, 'board of 2, round ' + (i + 1) + ' (' + (r.won ? 'won' : 'lost') + '): 25 for the charity of the week plus ' + r.want + ' for a winning call', r);
      if (r.won) { won = r; h.check(r.want > 0 && new RegExp('\\+ ' + r.want + ' bonus \\+ 25 for the charity of the week').test(r.card), 'a winning call and the charity of the week: the card shows "+ ' + r.want + ' bonus + 25 for the charity of the week"', r.card); }
      await h.closeReceipt(page);
    }
    h.check(!!won, 'a win came within 14 rounds on a board of two');
    await page.fill('#size-custom', '8');
    await page.locator('#size-custom').blur();   // (a click on the chip's x straight after typing is taken up by the field losing focus, which redraws the chip)
    await page.waitForFunction(() => GS.store.prefs().sizes.duck === 8);

    // another charity backed: no bonus, and the old behaviour is untouched
    await page.click('#pick-chip [data-role="clear-pick"]');
    h.check((await page.locator('#pick-spot').innerText()).includes('+25 XP if you back it'), 'stop backing it and the strip invites you again');
    await page.click('#pick-btn');
    await page.waitForSelector('#dlg-charitypick[open]');
    await page.fill('#cp-q', 'wateraid');
    const note = await page.evaluate((id) => { const b = document.querySelector('#dlg-charitypick .pickitem[data-id="' + id + '"]'); return b ? b.innerText : null; }, spot.id);
    await page.locator('#dlg-charitypick .pickitem').first().click();
    await page.waitForFunction(() => !document.querySelector('#dlg-charitypick').open);
    h.check(note === null || /Charity of the week/.test(note), 'in the picker the charity of the week is marked "Charity of the week" (when it matches the search)');
    await page.click('#btn-play');
    await h.waitReceipt(page);
    const r3 = await page.evaluate(() => { const sm = GS.app._last.summary; const p = GS.app._last.round.pick; return { spot: sm.spotlightXp, bonus: sm.bonusXp, pick: p.id, won: p.won, want: p.won ? GS.core.pickBonusXp(p.board, p.wins) : 0, text: document.querySelector('#dlg-result .xpcard').innerText }; });
    h.check(r3.pick === 'wateraid' && r3.spot === 0 && r3.bonus === r3.want && !/Charity of the week bonus/.test(r3.text), 'backing another charity: no charity-of-the-week bonus, and the bonus for backing a winner is as before', r3);
    await h.closeReceipt(page);
    // nothing backed
    await page.click('#pick-chip [data-role="clear-pick"]');
    await page.click('#btn-play');
    await h.waitReceipt(page);
    const r4 = await page.evaluate(() => { const sm = GS.app._last.summary; return { spot: sm.spotlightXp, bonus: sm.bonusXp, gain: sm.xpGain, gift: sm.giftXp, hot: sm.hotXp }; });
    h.check(r4.spot === 0 && r4.bonus === 0 && r4.gain === r4.gift + r4.hot, 'nothing backed: no bonus at all', r4);
    await h.closeReceipt(page);
    h.check(h.problems.length === problems0, 'section 23f: no console errors, warnings or failed requests', h.problems.slice(problems0, problems0 + 5));
    await page.close();
  }

  /* ----------------------------------------------------------------- 23g. Help */
  if (h.section('23g. Help: the ticker and the charity of the week are explained')) {
    const problems0 = h.problems.length;
    const page = await h.newPage({ viewport: { width: 1440, height: 900 } });
    await h.openApp(page, '#help-ticker');
    await page.waitForTimeout(300);
    const a = await page.locator('#help-ticker').innerText();
    h.check(await page.locator('#help-ticker').evaluate((d) => d.open) && /simulated players/.test(a) && /BOT/.test(a) && /Your own gifts are never counted/.test(a) && /Pause/.test(a) && /reduced motion/.test(a), 'a Help answer says the ticker is simulated players (bots), that your gifts are not in it, and that it can be paused', a);
    await h.go(page, '#help-spotlight');
    await page.waitForTimeout(300);
    const b = await page.locator('#help-spotlight').innerText();
    h.check(await page.locator('#help-spotlight').evaluate((d) => d.open) && /new one every Monday/.test(b) && /25 extra XP/.test(b) && /never money/.test(b) && /not a ranking and not an endorsement/.test(b), 'another says what the charity of the week is, the 25 XP, and that it is not an endorsement', b);
    h.check(!CRYPTO.test(a + ' ' + b) && !/\b(best|greatest|largest|leading|most|world-class|premier|finest|foremost|trusted|famous|renowned|guaranteed|prize|winnings|payout|real players?)\b/i.test(a + ' ' + b), 'neither uses a banned word');
    h.check(await page.locator('#help-spotlight a[href="#spotlights"]').count() === 1, 'and the answer links to the #spotlights page');
    await page.close();
    h.check(h.problems.length === problems0, 'section 23g: no console errors, warnings or failed requests', h.problems.slice(problems0, problems0 + 5));
  }

  /* ----------------------------------------------------------------- 23h. accessibility scans */
  if (h.section('23h. Ticker and spotlight: accessibility scans (axe) at laptop and phone sizes')) {
    const problems0 = h.problems.length;
    for (const [name, size, mobile] of [['laptop', { width: 1366, height: 768 }, false], ['phone', { width: 390, height: 844 }, true]]) {
      const page = await h.newPage({ viewport: size, mobile });
      await h.openApp(page);
      await page.waitForSelector('#ticker:not([hidden])');
      await h.a11y(page, 'the lobby with the ticker and the spotlight block (' + name + ')');
      await h.go(page, '#live');
      await page.waitForSelector('#ticker:not([hidden])');
      await h.a11y(page, 'the Live tables page with the ticker (' + name + ')');
      await h.go(page, '#tables-plinko');
      await h.a11y(page, 'a game\'s table sizes with the ticker (' + name + ')');
      await h.go(page, '#spotlights');
      await h.a11y(page, 'the Charity of the week page (' + name + ')');
      await h.go(page, '#game-wheel');
      await h.openOptions(page);
      await h.a11y(page, 'a solo game with the strip' + (mobile ? ' in the Options sheet' : '') + ' (' + name + ')');
      await page.close();
    }
    const tall = await h.newPage({ viewport: { width: 1440, height: 900 } });
    await h.openApp(tall, '#game-wheel');
    await h.a11y(tall, 'a solo game with the strip in the panel (1440x900)');
    await tall.close();
    const rm = await h.newPage({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
    await h.openApp(rm);
    await rm.waitForSelector('#ticker:not([hidden])');
    await h.a11y(rm, 'the lobby with the ticker paused for reduced motion');
    await rm.close();
    h.check(h.problems.length === problems0, 'section 23h: no console errors, warnings or failed requests', h.problems.slice(problems0, problems0 + 5));
  }
}
