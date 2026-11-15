// The second walk-through of the whole site on phones, tablets and big screens (sections 31a to 31d). Each section guards one thing the walk found.
//   31a  Stream Mode on a 320 px phone, a 375 px phone and a tablet held upright: no sideways scroll, the picture's box is as wide as the page, the docked panel is at the left and bottom edges
//   31b  keyboard focus is never left under the sticky top bar (Shift+Tab, every window size) or under the phone's bottom bar (Tab) on the pages that are not games
//   31c  the lobby's quests line keeps "N rewards to claim" together on a phone
//   31d  the lobby at six window sizes: the games come first, the blocks come under them, nothing sticks out sideways
export default async function (h) {
  const { check, newPage, openApp, go, section, problems } = h;
  const stream = async (page, hash) => { await openApp(page, hash, '?fast=1&stream=1'); await page.waitForSelector('#stream-hud', { state: 'attached' }); await page.waitForTimeout(500); };

  /* ---------------------------------------------------------------- 31a */
  if (section('31a. Stream Mode on a small phone and on a tablet held upright: the page fits and the panel sits at the edges')) {
    const problems0 = problems.length;
    const look = (page) => page.evaluate(() => {
      const box = (s) => { const e = document.querySelector(s); if (!e) { return null; } const b = e.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom) }; };
      const bet = document.querySelector('#bet-panel'); const live = document.querySelector('#livepanel');
      const dock = bet && getComputedStyle(bet).position === 'fixed' ? '#bet-panel' : live && getComputedStyle(live).position === 'fixed' ? '#livepanel' : null;
      return { iw: window.innerWidth, ih: window.innerHeight, sw: document.documentElement.scrollWidth, stage: box('#stage'), dock: dock && box(dock), dockSel: dock };
    });
    for (const [name, w, hh] of [['a 320 px phone', 320, 568], ['a 375 px phone', 375, 667], ['a tablet held upright (768 x 1024)', 768, 1024]]) {
      for (const [what, hash] of [['a game', '#game-wheel'], ['a live table', '#live-derby10']]) {
        const page = await newPage({ viewport: { width: w, height: hh }, mobile: true });
        await stream(page, hash);
        const m = await look(page);
        // (compared with the window's real width, w: on a phone that is wider than its window the browser zooms out, and innerWidth then reports the wider number)
        check(m.sw <= w, 'Stream Mode, ' + what + ' on ' + name + ': the page does not scroll sideways (' + m.sw + ' wide in a ' + w + ' px window)', m);
        check(!!m.stage && m.stage.l >= 0 && m.stage.r <= w && m.stage.r - m.stage.l >= w - 60, 'Stream Mode, ' + what + ' on ' + name + ': the picture\'s box is as wide as the page, not a fixed 330 px column', m.stage);
        check(!!m.dock && m.dock.l <= 1 && m.dock.r >= w - 1 && m.dock.r <= w + 1, 'Stream Mode, ' + what + ' on ' + name + ': the docked panel runs from the left edge to the right edge (there is no side rail to leave room for)', m.dock);
        check(!!m.dock && Math.abs(m.dock.b - hh) <= 1, 'Stream Mode, ' + what + ' on ' + name + ': the docked panel sits on the bottom edge (there is no bottom bar to float above)', m.dock);
        await page.close();
      }
    }
    // the normal (not Stream Mode) page keeps what it had: the panel beside the side rail on a tablet, above the bottom bar on a phone
    const tab = await newPage({ viewport: { width: 768, height: 1024 }, mobile: true });
    await openApp(tab, '#game-wheel');
    check(await tab.evaluate(() => getComputedStyle(document.querySelector('#bet-panel')).left) === '68px', 'outside Stream Mode the tablet\'s docked panel still starts beside the side rail (68 px)');
    await tab.close();
    const ph = await newPage({ viewport: { width: 375, height: 667 }, mobile: true });
    await openApp(ph, '#game-wheel');
    const above = await ph.evaluate(() => { const b = document.querySelector('#bet-panel').getBoundingClientRect(); const n = document.querySelector('.side').getBoundingClientRect(); return { panelBottom: Math.round(b.bottom), navTop: Math.round(n.top) }; });
    check(above.panelBottom <= above.navTop + 1, 'outside Stream Mode the phone\'s docked panel still sits above the bottom bar', above);
    await ph.close();
    check(problems.length === problems0, 'section 31a: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ---------------------------------------------------------------- 31b */
  if (section('31b. Keyboard focus is not left under the top bar or the phone\'s bottom bar')) {
    const problems0 = problems.length;
    // true when the focused control's top edge is under a fixed or sticky bar (the point 6 px inside its top edge is not the control)
    const hidden = () => {
      const e = document.activeElement; if (!e || e === document.body) { return null; }
      const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || e.closest('.switch, label.switchrow, [hidden]')) { return null; }
      const probe = (y) => { const t = document.elementFromPoint(Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1), Math.min(Math.max(y, 1), innerHeight - 1)); return !!t && t !== e && !e.contains(t) && !t.contains(e) && !!t.closest('.topbar, .side'); };
      const top = probe(r.top + Math.min(6, r.height / 2)); const bottom = probe(r.bottom - Math.min(6, r.height / 2));
      return (top || bottom) ? (e.tagName.toLowerCase() + ' "' + (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24) + '" ' + (top ? 'top' : 'bottom') + ' ' + Math.round(r.top) + '-' + Math.round(r.bottom)) : null;
    };
    const phone = await newPage({ viewport: { width: 390, height: 844 }, mobile: true });
    await openApp(phone, '#lobby');
    const sp = await phone.evaluate(() => { const cs = getComputedStyle(document.documentElement); return { top: parseFloat(cs.scrollPaddingTop), bottom: parseFloat(cs.scrollPaddingBottom), topH: document.querySelector('.topbar').getBoundingClientRect().height, navH: document.querySelector('.side').getBoundingClientRect().height }; });
    check(sp.top >= sp.topH && sp.bottom >= sp.navH, 'on a phone the lobby keeps the top bar (' + sp.topH + ' px) and the bottom bar (' + Math.round(sp.navH) + ' px) clear when it scrolls to a control', sp);
    const under = [];
    for (let i = 0; i < 55; i++) { await phone.keyboard.press('Tab'); await phone.waitForTimeout(30); const x = await phone.evaluate(hidden); if (x) { under.push(x); } }
    check(under.length === 0, 'tabbing down the lobby on a phone never leaves the focused control under the bottom bar', under.slice(0, 4));
    await go(phone, '#boards'); await phone.evaluate(() => window.scrollTo(0, 0));
    const under2 = [];
    for (let i = 0; i < 50; i++) { await phone.keyboard.press('Tab'); await phone.waitForTimeout(30); const x = await phone.evaluate(hidden); if (x) { under2.push(x); } }
    check(under2.length === 0, 'and the same on Leaderboards (the Join buttons, the tabs, the footer links)', under2.slice(0, 4));
    await phone.close();
    for (const [name, w, hh, mobile] of [['a laptop', 1366, 768, false], ['a phone', 390, 844, true], ['a tablet held upright', 768, 1024, true]]) {
      const page = await newPage({ viewport: { width: w, height: hh }, mobile });
      await openApp(page, '#lobby');
      for (const route of ['#lobby', '#help', '#boards']) {
        await go(page, route);
        await page.evaluate(() => { window.scrollTo(0, document.documentElement.scrollHeight); const l = Array.from(document.querySelectorAll('a[href], button, summary')).filter((e) => e.getBoundingClientRect().width > 0 && !e.closest('.side, .topbar')); l[l.length - 1].focus({ preventScroll: true }); });
        const up = [];
        for (let i = 0; i < 30; i++) { await page.keyboard.press('Shift+Tab'); await page.waitForTimeout(30); const x = await page.evaluate(hidden); if (x) { up.push(x); } }
        check(up.length === 0, 'Shift+Tab up ' + route + ' on ' + name + ' never leaves the focused control under the top bar', up.slice(0, 4));
      }
      await page.close();
    }
    check(problems.length === problems0, 'section 31b: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ---------------------------------------------------------------- 31c */
  if (section('31c. The lobby\'s quests line keeps "N rewards to claim" together on a phone')) {
    const problems0 = problems.length;
    for (const w of [320, 360, 390, 412]) {
      const page = await newPage({ viewport: { width: w, height: 800 }, mobile: true });
      await page.clock.setFixedTime(new Date(2026, 10, 19, 12));   // a visitor who joins late in the month starts with a head start, so there are rewards to claim at once
      await openApp(page, '#lobby');
      await page.waitForSelector('[data-block="quests"] .qblock');
      const m = await page.evaluate(() => { const e = document.querySelector('[data-block="quests"] .qblock__ready'); return e ? { text: e.textContent, rects: e.getClientRects().length } : null; });
      check(!!m && /rewards? to claim/.test(m.text) && m.rects === 1, 'on a ' + w + ' px phone "' + (m && m.text) + '" stays on one line', m);
      await page.close();
    }
    check(problems.length === problems0, 'section 31c: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }

  /* ---------------------------------------------------------------- 31d */
  if (section('31d. The lobby at six window sizes: games first, blocks under them, nothing sticks out sideways')) {
    const problems0 = problems.length;
    for (const [w, hh, mobile] of [[320, 568, true], [390, 844, true], [844, 390, true], [768, 1024, true], [1366, 768, false], [2560, 1440, false]]) {
      const page = await newPage({ viewport: { width: w, height: hh }, mobile });
      await openApp(page, '#lobby');
      await page.waitForSelector('#view-lobby [data-role="blocks"] [data-block]');
      const m = await page.evaluate(() => {
        const top = (e) => e.getBoundingClientRect().top + window.scrollY;
        const tiles = Array.from(document.querySelectorAll('#view-lobby .tile:not([hidden])'));
        const lastTile = tiles[tiles.length - 1]; const blocks = Array.from(document.querySelectorAll('#view-lobby [data-role="blocks"] > [data-block]'));
        const wide = blocks.filter((b) => { const r = b.getBoundingClientRect(); return r.left < -1 || r.right > document.documentElement.clientWidth + 1; }).map((b) => b.getAttribute('data-block'));
        const narrow = tiles.filter((t) => t.getBoundingClientRect().width < 120).length;
        const causes = document.querySelector('#view-lobby #lb-causes');
        return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, tiles: tiles.length, tilesBottom: Math.round(top(lastTile) + lastTile.getBoundingClientRect().height), firstBlock: blocks.length ? Math.round(top(blocks[0])) : null, blocks: blocks.length, wide, narrow, causes: Math.round(top(causes)), lastBlockBottom: blocks.length ? Math.round(top(blocks[blocks.length - 1]) + blocks[blocks.length - 1].getBoundingClientRect().height) : null };
      });
      check(m.sw <= m.cw, w + ' x ' + hh + ': the lobby does not scroll sideways', m);
      check(m.tiles === 20 && m.narrow === 0, w + ' x ' + hh + ': all 20 game tiles show and none is narrower than 120 px', m);
      check(m.blocks >= 4 && m.firstBlock >= m.tilesBottom - 1 && m.lastBlockBottom <= m.causes + 1 && m.wide.length === 0, w + ' x ' + hh + ': the ' + m.blocks + ' blocks sit under the last game tile and above "Pick a cause first", none wider than the window', m);
      await page.close();
    }
    check(problems.length === problems0, 'section 31d: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
  }
}
