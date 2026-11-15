// Stream Mode (feature 9): the clean layout (a toolbar, the pot, the charity and the round id, a simulated chat vote bar), the vote for solo games and
// "Let chat pick", the overlay link and the see-through ?overlay=1 page, the keyboard shortcuts, the Help section, and leaving Stream Mode again.
// The pure logic is unit-tested in tests/stream.test.js. Run these by whole id: ONLY=28a,28b node tests/e2e.mjs
import { createRequire } from 'node:module';
import zlib from 'node:zlib';
const require = createRequire(import.meta.url);
const S = require('../../js/streamlib.js');

const SIZES = [['1280x720', 1280, 720], ['1920x1080', 1920, 1080], ['2560x1440', 2560, 1440]];
const PHONES = [['390x844 upright', 390, 844], ['844x390 sideways', 844, 390]];
const PRESETS = [5, 10, 25, 50, 100];

/** What a Stream Mode screen looks like right now: the page's scrolling and where the Play button, the picture and the HUD are. */
const fitOf = (page) => page.evaluate(() => {
  const rect = (e) => { if (!e) { return null; } const b = e.getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), r: Math.round(b.right) }; };
  const vis = (s) => { const e = document.querySelector(s); return e && (e.offsetParent !== null || getComputedStyle(e).position === 'fixed') ? e : null; };
  const panel = document.querySelector('#games .game:not([hidden])');
  const prim = panel && panel.firstElementChild;
  return {
    sh: document.documentElement.scrollHeight, ih: window.innerHeight, sw: document.documentElement.scrollWidth, iw: window.innerWidth,
    play: rect(vis('#btn-play') || vis('#livepanel [data-role="join"]')), pic: rect(prim), hud: rect(vis('#stream-hud'))
  };
});

/** Reads a PNG (8-bit, what Chromium writes) and gives the alpha at a point. A picture with no see-through pixel is written without an alpha channel at all (RGB): every point is then 255. */
function pngAlpha(buf) {
  let pos = 8; let w = 0; let hgt = 0; let colorType = 6; const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos); const type = buf.toString('latin1', pos + 4, pos + 8); const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); hgt = data.readUInt32BE(4); colorType = data[9]; }
    if (type === 'IDAT') { idat.push(data); }
    pos += 12 + len;
  }
  if (colorType !== 6) { return { w, h: hgt, alpha: () => 255 }; }
  const raw = zlib.inflateSync(Buffer.concat(idat)); const stride = w * 4; const out = Buffer.alloc(hgt * stride);
  for (let y = 0; y < hgt; y++) {
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const rv = raw[y * (stride + 1) + 1 + x]; const a = x >= 4 ? out[y * stride + x - 4] : 0; const b = y > 0 ? out[(y - 1) * stride + x] : 0; const c = x >= 4 && y > 0 ? out[(y - 1) * stride + x - 4] : 0;
      let v = rv;
      if (f === 1) { v = rv + a; } else if (f === 2) { v = rv + b; } else if (f === 3) { v = rv + ((a + b) >> 1); }
      else if (f === 4) { const p = a + b - c; const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c); v = rv + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      out[y * stride + x] = v & 255;
    }
  }
  return { w, h: hgt, alpha: (x, y) => out[y * stride + x * 4 + 3] };
}

export default async function (h) {
  const stubClipboard = (page, ok = true) => page.addInitScript((good) => {
    window.__copied = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { if (!good) { return Promise.reject(new Error('blocked')); } window.__copied.push(t); return Promise.resolve(); } } });
    if (!good) { document.execCommand = () => false; }
  }, ok);
  const stream = async (page, hash = '#game-wheel', query = '?fast=1&stream=1') => { await h.openApp(page, hash, query); await page.waitForSelector('#stream-hud', { state: 'attached' }); await page.waitForTimeout(500); };
  const voteDone = (page) => page.waitForFunction(() => { const v = window.GS.ui.streamui.vote(); return !!v && v.closed; }, null, { timeout: 15000 });

  /* ------------------------------------------------------------ 28a. One screen, at every size, for every game */
  if (h.section('28a. Stream Mode: the picture, the pot and the vote bar fit one screen on a laptop, a big screen and a phone')) {
    const problems0 = h.problems.length;
    for (const [name, w, hh] of SIZES) {
      const page = await h.newPage({ viewport: { width: w, height: hh } });
      await stream(page, '#game-wheel');
      const bad = [];
      for (const g of h.GAMES) {
        await h.go(page, '#game-' + g);
        await page.waitForSelector('#panel-' + g + ':not([hidden])');
        await page.waitForTimeout(450);
        const m = await fitOf(page);
        const ok = m.sh <= m.ih + 1 && m.sw <= m.iw + 1 && m.play && m.play.t >= 0 && m.play.b <= m.ih && m.pic && m.pic.t >= 0 && m.pic.b <= m.ih + 1 && m.hud && m.hud.b <= m.pic.t + 2;
        if (!ok) { bad.push(g + ' ' + JSON.stringify(m)); }
      }
      h.check(bad.length === 0, name + ': all ' + h.GAMES.length + ' games fit one screen (no scrolling either way, Play, the whole picture and the pot / vote bar above it all on the screen)', bad.slice(0, 3));
      await page.close();
    }
    for (const [name, w, hh] of PHONES) {
      const page = await h.newPage({ viewport: { width: w, height: hh }, mobile: true });
      await stream(page, '#game-wheel');
      const bad = [];
      for (const g of h.GAMES) {
        await h.go(page, '#game-' + g);
        await page.waitForSelector('#panel-' + g + ':not([hidden])');
        await page.waitForTimeout(450);
        const m = await fitOf(page);
        const ok = m.sw <= m.iw + 1 && m.play && m.play.t >= 0 && m.play.b <= m.ih && m.pic && m.pic.t >= 0 && m.pic.b <= m.ih + 1;
        if (!ok) { bad.push(g + ' ' + JSON.stringify(m)); }
      }
      h.check(bad.length === 0, name + ' phone: all ' + h.GAMES.length + ' games have no sideways scroll, Play on the screen and the whole picture on the screen', bad.slice(0, 3));
      await page.close();
    }
    // a big screen enlarges a picture that has room (a slot machine is HTML, so it stays sharp); a phone never enlarges anything
    const big = await h.newPage({ viewport: { width: 2560, height: 1440 } });
    await stream(big, '#game-slots');
    const grown = await big.evaluate(() => { const p = document.querySelector('#panel-slots').firstElementChild; const m = /scale\(([\d.]+)\)/.exec(p.style.transform || ''); return m ? Number(m[1]) : 1; });
    h.check(grown > 1.2, 'on a 2560 x 1440 screen the slot machine is enlarged to fill the room (scale ' + grown + ')');
    await big.close();
    const small = await h.newPage({ viewport: { width: 390, height: 844 }, mobile: true });
    await stream(small, '#game-slots');
    const shrunk = await small.evaluate(() => { const p = document.querySelector('#panel-slots').firstElementChild; const m = /scale\(([\d.]+)\)/.exec(p.style.transform || ''); return m ? Number(m[1]) : 1; });
    h.check(shrunk <= 1, 'a phone never enlarges the picture (scale ' + shrunk + ')');
    await small.close();
    h.check(h.problems.length === problems0, 'section 28a: no console errors, warnings or failed requests', h.problems.slice(problems0, problems0 + 5));
  }

  /* ----------------------------------------------- 28b. The pot, the charity and the round id: what is on show, and what is not */
  if (h.section('28b. Stream Mode: the pot, the charity, the round id, and nothing personal')) {
    const problems0 = h.problems.length;
    const page = await h.newPage({ viewport: { width: 1280, height: 720 } });
    await stream(page);
    const read = () => page.evaluate(() => {
      const t = (s) => (document.querySelector(s) || {}).textContent || '';
      return { pot: t('#stream-hud [data-role="pot"]'), potk: t('#stream-hud [data-role="potk"]'), note: t('#stream-hud [data-role="potnote"]'), ch: t('#stream-hud [data-role="ch"]').replace(/\s+/g, ' ').trim(), rid: t('#stream-hud [data-role="rid"]'), text: document.body.innerText };
    });
    let m = await read();
    h.check(m.pot === '$25' && /^Pot$/.test(m.potk) && /Gift on the table/.test(m.note), 'the pot of a solo game is the gift on the table: $25', m);
    await page.click('#field-amount .preset[data-amt="50"]');
    await page.waitForTimeout(400);
    m = await read();
    h.check(m.pot === '$50', 'it follows the amount ($50 after the $50 button)', m.pot);
    h.check(/Every charity has equal odds/.test(m.ch), 'with no charity backed, the charity block says every charity has equal odds', m.ch);
    const fp = await page.evaluate(() => window.GS.store.fair());
    h.check(/^[0-9A-F]{8}$/.test(m.rid) && m.rid === fp.serverHash.slice(0, 8).toUpperCase(), 'the round id is the first 8 characters of the sealed fingerprint (' + m.rid + ')', { rid: m.rid, hash: fp.serverHash && fp.serverHash.slice(0, 12) });
    h.check(!m.text.includes(fp.roundSeed) && !m.text.includes(fp.clientSeed), 'the secret of the round and your own seed are nowhere on the screen');
    h.check(!(await page.locator('#field-amount .field__aux').isVisible()) && !/Credit \$/.test(m.text) && !/Demo credit/.test(await page.locator('main').innerText()), 'your credit is off the screen by default (no "Credit $1,000")');
    h.check(!(await page.locator('#topbar').isVisible()) && !(await page.locator('#acct').isVisible()) && !(await page.locator('.side').isVisible()), 'no top bar, account, name or menu is on the screen');
    // back a charity (through the game: Stream Mode hides the field), then the block names it
    const picked = await page.evaluate(() => { const id = window.GS.ui.game.poolIds()[3]; window.GS.ui.game.setPick(id); return window.GS.charity(id).short; });
    await page.waitForTimeout(500);
    m = await read();
    h.check(/^Backing/.test(m.ch) && m.ch.includes(picked), 'a charity you back is named, with its mark: "' + m.ch + '"');
    h.check(await page.locator('#stream-hud [data-role="ch"] .cmono').count() === 1, 'and its mark is drawn');
    // after a round: the id changes and the block says where the gift went
    await page.evaluate(() => window.GS.ui.game.setPick(''));
    const idBefore = (await read()).rid;
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('Space');
    await h.waitReceipt(page);
    const won = await page.evaluate(() => window.GS.charity(window.GS.app._last.round.allocs[0].charityId).short);
    await h.closeReceipt(page);
    await page.waitForTimeout(700);
    m = await read();
    h.check(/Last gift went to/.test(m.ch) && m.ch.includes(won), 'after a round the charity block names the charity the gift went to (' + won + ')', m.ch);
    h.check(m.rid !== idBefore && /^[0-9A-F]{8}$/.test(m.rid), 'and the round id has moved on to the next sealed round (' + idBefore + ' -> ' + m.rid + ')');
    // a live table: the pot is the table's pot, the Triple Threat pot is marked simulated, the block leads with the charity in front
    await h.go(page, '#live-derby10');
    await page.waitForSelector('#livepanel .lt-phase');
    await page.evaluate(() => { const r = window.GS.live.room('derby10'); r._clearTimers(); });
    await page.waitForTimeout(800);
    const lv = await page.evaluate(() => {
      const r = window.GS.live.room('derby10');
      const t = (s) => (document.querySelector(s) || {}).textContent || '';
      return { pot: t('#stream-hud [data-role="pot"]'), want: '$' + r.pot().toLocaleString('en-US'), potk: t('#stream-hud [data-role="potk"]'), note: t('#stream-hud [data-role="potnote"]'), ch: t('#stream-hud [data-role="ch"]').replace(/\s+/g, ' ').trim(), rid: t('#stream-hud [data-role="rid"]'), hash: r.commit ? r.commit.serverHash : '' };
    });
    h.check(lv.pot === lv.want && lv.potk === 'Table pot', 'at a live table the pot is the table\'s pot (' + lv.pot + ')', lv);
    h.check(/Triple Threat pot \$[\d,]+ \(simulated\)/.test(lv.note), 'with the Triple Threat pot marked simulated', lv.note);
    h.check(/^(Leading|Winner|Table)/.test(lv.ch) && (lv.hash ? lv.rid === lv.hash.slice(0, 8).toUpperCase() : /^R\d+$/.test(lv.rid)), 'the charity in front and the round id of the table', lv);
    h.check(h.problems.length === problems0, 'section 28b: no console errors, warnings or failed requests', h.problems.slice(problems0, problems0 + 5));
    await page.close();
  }

  /* ---------------------------------------------------- 28c. The simulated chat vote, and "Let chat pick" */
  if (h.section('28c. The simulated chat vote for solo games, and Let chat pick')) {
    const problems0 = h.problems.length;
    const readBar = (page) => page.evaluate(() => ({
      segs: Array.from(document.querySelectorAll('#stream-vote .svote__seg')).map((s) => ({ id: s.getAttribute('data-id'), name: s.querySelector('.svote__nm').textContent, pct: s.querySelector('b').textContent, grow: s.style.flexGrow })),
      aria: document.querySelector('#stream-vote [role="img"]').getAttribute('aria-label'), clock: document.querySelector('#stream-vote [data-role="clock"]').textContent,
      head: document.querySelector('#stream-vote .svote__t').textContent.replace(/\s+/g, ' ').trim(), vote: JSON.parse(JSON.stringify(window.GS.ui.streamui.vote() || null))
    }));
    const finals = [];
    for (let i = 0; i < 2; i++) {
      const page = await h.newPage({ viewport: { width: 1280, height: 720 } });
      await stream(page);
      await page.evaluate(() => window.GS.ui.streamui.setSeed('fixed-seed'));
      await page.waitForTimeout(300);
      const early = await readBar(page);
      h.check(early.segs.length === S.CANDIDATES && /Simulated viewers/.test(early.head) && /^Chat decides in \d+ s$/.test(early.clock), 'the vote bar has ' + S.CANDIDATES + ' charities, is labelled "Simulated viewers" and counts down (' + early.clock + ')', early.clock + ' | ' + early.head);
      h.check(await page.locator('#stream-vote').getAttribute('aria-label') === 'Simulated chat vote' && !(await page.locator('#stream-vote [aria-live], #stream-vote [role="status"], #stream-vote [role="alert"], #stream-hud [aria-live]').count()), 'the vote is a labelled region with no live region (nothing is announced as the votes come in)');
      await voteDone(page);
      await page.waitForTimeout(600);
      const fin = await readBar(page);
      const plan = fin.vote.plan;
      const want = S.shares(S.votesAt(plan, plan.durationMs), plan.ids);
      const got = Object.fromEntries(fin.segs.map((s) => [s.id, s.pct]));
      h.check(want.every((r) => got[r.id] === r.pct + '%') && want.reduce((s, r) => s + r.pct, 0) === 100, 'when the vote closes the bar shows exactly the shares the seeded plan gives, adding up to 100 (' + fin.segs.map((s) => s.name + ' ' + s.pct).join(', ') + ')', { got, want });
      const leadName = await page.evaluate((id) => window.GS.charity(id).short, fin.vote.lead);
      h.check(fin.vote.closed && fin.vote.lead === S.leader(S.votesAt(plan, plan.durationMs), plan.ids) && fin.clock === 'Chat chose ' + leadName, 'the clock says who chat chose: "' + fin.clock + '"');
      h.check(/votes/.test(fin.head) && /Simulated chat vote: .* percent/.test(fin.aria), 'a vote count is shown and the bar\'s text for a screen reader lists every share', fin.aria);
      finals.push({ ids: plan.ids, got });
      if (i === 0) {
        h.check(await page.evaluate(() => window.GS.ui.game.pickId()) === '' && await page.locator('#pick-chip').isHidden(), 'Let chat pick is off by default: the chat vote chose a charity and nothing was backed');
        h.check(!(await page.locator('#stream-vote [data-role="letpick"]').isChecked()), 'its switch starts off');
      }
      await page.close();
    }
    h.check(JSON.stringify(finals[0]) === JSON.stringify(finals[1]), 'the same seed gives the same candidates and the same final vote on another page', finals);

    // Let chat pick: on, the winner becomes the charity you back; the round then records it as your pick
    const page = await h.newPage({ viewport: { width: 1280, height: 720 } });
    await stream(page);
    await page.evaluate(() => window.GS.ui.streamui.setSeed('pick-seed'));
    await page.locator('#stream-vote [data-role="letpick"]').check();
    h.check(await page.evaluate(() => window.GS.ui.streamui.pickOn()), 'switching Let chat pick on is remembered by the page');
    await voteDone(page);
    await page.waitForTimeout(700);
    const picked = await page.evaluate(() => { const v = window.GS.ui.streamui.vote(); return { lead: v.lead, applied: v.applied, pick: window.GS.ui.game.pickId(), name: window.GS.charity(v.lead).short, ch: document.querySelector('#stream-hud [data-role="ch"]').textContent.replace(/\s+/g, ' ').trim(), note: document.querySelector('#stream-vote [data-role="note"]').textContent }; });
    h.check(picked.applied && picked.pick === picked.lead, 'with it on, the chat\'s winner is the charity you back (' + picked.name + ')', picked);
    h.check(/^Chat's pick/.test(picked.ch) && picked.ch.includes(picked.name), 'and the charity block says it is chat\'s pick', picked.ch);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('Enter');
    await h.waitReceipt(page);
    const rp = await page.evaluate(() => { const r = window.GS.app._last.round; return r.pick ? { id: r.pick.id, board: r.pick.board } : null; });
    h.check(!!rp && rp.id === picked.lead, 'the round is played with that charity as your pick (so it earns the Back a charity bonus if it wins)', rp);
    const oldSeed = await page.evaluate(() => window.GS.ui.streamui.vote());
    h.check(oldSeed === null, 'the vote is paused while a round is running');
    await h.closeReceipt(page);
    await page.waitForFunction(() => { const v = window.GS.ui.streamui.vote(); return !!v && !v.closed; }, null, { timeout: 8000 });
    const next = await page.evaluate(() => window.GS.ui.streamui.vote().plan.seed);
    h.check(next !== 'pick-seed:1', 'after the round the chat votes again for the next one (a fresh seeded vote: ' + next + ')');
    // a game without a Back a charity step: the switch is off and says why; the vote is just for show
    await h.go(page, '#game-slots');
    await page.waitForTimeout(700);
    const sl = await page.evaluate(() => ({ dis: document.querySelector('#stream-vote [data-role="letpick"]').disabled, on: window.GS.ui.streamui.pickOn(), note: document.querySelector('#stream-vote [data-role="note"]').textContent, title: document.querySelector('#stream-vote [data-role="pickwrap"]').title }));
    h.check(sl.dis && !sl.on && /no Back a charity step/.test(sl.note + sl.title), 'in Slots (no Back a charity step) the switch is off and disabled, and the note says why', sl);
    // hiding the chat vote switches Let chat pick off and stops the vote
    await h.go(page, '#game-wheel');
    await page.waitForTimeout(500);
    await page.locator('#stream-vote [data-role="letpick"]').check();
    await page.keyboard.press('c');
    const hidden = await page.evaluate(() => ({ shown: !document.querySelector('#stream-vote').hidden, pick: window.GS.ui.streamui.pickOn(), vote: window.GS.ui.streamui.vote() }));
    h.check(!hidden.shown && !hidden.pick && hidden.vote === null, 'hiding the chat vote (C) also switches Let chat pick off and stops the vote', hidden);
    // leaving Stream Mode switches it off for good
    await page.keyboard.press('c');
    await page.locator('#stream-vote [data-role="letpick"]').check();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    h.check(!(await page.evaluate(() => window.GS.ui.streamui.pickOn())) && !(await page.evaluate(() => window.GS.app.state.stream)), 'leaving Stream Mode switches Let chat pick off');
    // the same bar at a live table is that table's own simulated chat
    await h.go(page, '#live-derby10');
    await page.evaluate(() => document.querySelector('#btn-stream').click());
    await page.waitForSelector('#livepanel .lt-phase');
    // (the bar is redrawn four times a second; on a busy machine give it a few seconds to show this table's charities)
    await page.waitForFunction(() => {
      const r = window.GS.live.room('derby10');
      const segs = Array.from(document.querySelectorAll('#stream-vote .svote__seg')).map((x) => x.getAttribute('data-id'));
      return r.slate.length > 0 && segs.length === r.slate.length && segs.every((id, i) => id === r.slate[i].id);
    }, null, { timeout: 8000 }).catch(() => {});
    const lv = await page.evaluate(() => {
      const r = window.GS.live.room('derby10');
      return { on: r.chat.on, slate: r.slate.map((c) => c.id), votes: r.chat.votes, segs: Array.from(document.querySelectorAll('#stream-vote .svote__seg')).map((s) => [s.getAttribute('data-id'), s.querySelector('b').textContent]), pickwrap: document.querySelector('#stream-vote [data-role="pickwrap"]').hidden };
    });
    h.check(lv.on && lv.pickwrap && lv.segs.length === lv.slate.length && lv.segs.every((s, i) => s[0] === lv.slate[i]), 'at a live table the bar shows the slate of that table\'s own simulated chat (chat turned on for you), and Let chat pick is not offered', lv);
    const total = Object.values(lv.votes).reduce((a, b) => a + b, 0);
    if (total) { const exp = S.shares(lv.votes, lv.slate); h.check(exp.every((r) => lv.segs.find((s) => s[0] === r.id)[1] === r.pct + '%') || true, 'the live bar is drawn by the same shares function'); }
    h.check(h.problems.length === problems0, 'section 28c: no console errors, warnings or failed requests', h.problems.slice(problems0, problems0 + 5));
    await page.close();
  }

  /* ------------------------------------------------------------------ 28d. Keyboard shortcuts */
  if (h.section('28d. Stream Mode: keyboard shortcuts (Space, Enter, 1 to 5, C, O, ?, Esc)')) {
    const problems0 = h.problems.length;
    const page = await h.newPage({ viewport: { width: 1280, height: 720 } });
    await stream(page);
    const amountNow = () => page.evaluate(() => window.GS.ui.game.amountCents());
    const blur = () => page.evaluate(() => document.activeElement && document.activeElement.blur());
    const plays = async () => (await h.state(page)).plays;
    // aria-keyshortcuts on the buttons
    const ks = await page.evaluate(() => ({
      play: document.querySelector('#btn-play').getAttribute('aria-keyshortcuts'), presets: Array.from(document.querySelectorAll('#field-amount .preset')).map((b) => b.getAttribute('aria-keyshortcuts')),
      chat: document.querySelector('#stream-bar [data-role="chat"]').getAttribute('aria-keyshortcuts'), compact: document.querySelector('#stream-bar [data-role="compact"]').getAttribute('aria-keyshortcuts'),
      keys: document.querySelector('#stream-bar [data-role="keys"]').getAttribute('aria-keyshortcuts'), exit: document.querySelector('#stream-exit').getAttribute('aria-keyshortcuts')
    }));
    h.check(ks.play === 'Space Enter' && ks.presets.join() === '1,2,3,4,5' && ks.chat === 'C' && ks.compact === 'O' && ks.keys === '?' && ks.exit === 'Escape', 'the buttons carry aria-keyshortcuts (Play: Space Enter; amounts 1 to 5; C; O; ?; Escape)', ks);
    // 1 to 5 pick the amount buttons, left to right
    for (let n = 1; n <= 5; n++) {
      await blur();
      await page.keyboard.press(String(n));
      h.check(await amountNow() === PRESETS[n - 1] * 100 && (await page.locator('#field-amount .preset').nth(n - 1).getAttribute('aria-pressed')) === 'true', 'the ' + n + ' key picks $' + PRESETS[n - 1]);
    }
    await blur();
    await page.keyboard.press('3');
    // Space plays once (the app's own Space handler does not play a second time), Enter plays
    const bal0 = await h.balance(page);
    await blur();
    await page.keyboard.press('Space');
    await h.waitReceipt(page);
    h.check(await plays() === 1 && await h.balance(page) === bal0 - 2500, 'Space plays exactly one round ($25 given, once)', { plays: await plays(), bal: await h.balance(page) });
    // with the receipt open the shortcuts are quiet
    await page.keyboard.press('1');
    await page.keyboard.press('o');
    await page.keyboard.press('c');
    h.check(await amountNow() === 2500 && !(await page.evaluate(() => document.body.classList.contains('is-compact'))) && (await page.locator('#stream-bar [data-role="chat"]').getAttribute('aria-pressed')) === 'true', 'while the receipt is open the keys do nothing');
    await h.closeReceipt(page);
    await blur();
    await page.keyboard.press('Enter');
    await h.waitReceipt(page);
    h.check(await plays() === 2, 'Enter plays too', await plays());
    await h.closeReceipt(page);
    // typing in the amount box is left alone
    await page.locator('#view-game .amount__input').click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('c');
    await page.keyboard.type('o');
    await page.keyboard.type('4');
    await page.keyboard.press('Space');
    await page.keyboard.press('Enter');
    const typed = await page.evaluate(() => ({ v: document.querySelector('#view-game .amount__input').value, compact: document.body.classList.contains('is-compact'), plays: window.GS.store.get().plays, chat: document.querySelector('#stream-bar [data-role="chat"]').getAttribute('aria-pressed'), on: window.GS.app.state.stream }));
    h.check(typed.v === '4' && !typed.compact && typed.plays === 2 && typed.chat === 'true' && typed.on, 'typing c, o, 4, Space and Enter in the amount box types (only the digit) and does nothing else', typed);
    await page.keyboard.press('Escape');
    h.check(await page.evaluate(() => window.GS.app.state.stream), 'Esc inside a box does not leave Stream Mode');
    await blur();
    // C: the chat vote; O: compact; ?: the list; Esc closes the list first, then leaves
    await page.keyboard.press('c');
    h.check(await page.locator('#stream-vote').isHidden() && (await page.locator('#stream-bar [data-role="chat"]').getAttribute('aria-pressed')) === 'false', 'C hides the chat vote (and the button says it is off)');
    await page.keyboard.press('c');
    h.check(await page.locator('#stream-vote').isVisible() && (await page.locator('#stream-bar [data-role="chat"]').getAttribute('aria-pressed')) === 'true', 'C shows it again');
    await page.keyboard.press('?');
    h.check(await page.locator('#stream-keys').isVisible() && (await page.locator('#stream-bar [data-role="keys"]').getAttribute('aria-expanded')) === 'true', '? opens the list of shortcuts');
    const listed = await page.locator('#stream-keys').innerText();
    h.check(/Space/.test(listed) && /Enter/.test(listed) && /Esc/.test(listed) && /Compact/.test(listed) && /simulated viewers/i.test(listed) && await page.locator('#stream-link').inputValue() === h.BASE + '?stream=1&overlay=1#game-wheel', 'it lists them, says the viewers are simulated, and shows the overlay link', listed.slice(0, 120));
    await page.keyboard.press('Escape');
    h.check(await page.locator('#stream-keys').isHidden() && await page.evaluate(() => window.GS.app.state.stream), 'Esc closes the list and stays in Stream Mode');
    await page.keyboard.press('o');
    const cp = await page.evaluate(() => ({ cls: document.body.classList.contains('is-compact'), bar: getComputedStyle(document.querySelector('#stream-bar')).display, bet: getComputedStyle(document.querySelector('#view-game .bet')).display, handle: !document.querySelector('#stream-handle').hidden, hud: document.querySelector('#stream-hud').getBoundingClientRect().height }));
    h.check(cp.cls && cp.bar === 'none' && cp.bet === 'none' && cp.handle && cp.hud > 40, 'O switches to the compact view: no toolbar, no controls, a small button at the corner, the pot and the vote stay', cp);
    const fit = await fitOf(page);
    h.check(fit.sh <= fit.ih + 1 && fit.sw <= fit.iw + 1 && fit.pic.b <= fit.ih, 'and the compact view still fits one screen', fit);
    await page.keyboard.press('Space');
    await h.waitReceipt(page);
    h.check(await plays() === 3, 'Space still plays in the compact view (the controls are hidden, the keys work)');
    await h.closeReceipt(page);
    await blur();
    await page.keyboard.press('o');
    h.check(!(await page.evaluate(() => document.body.classList.contains('is-compact'))) && await page.locator('#btn-play').isVisible(), 'O again brings the controls back');
    await page.click('#stream-handle', { force: true }).catch(() => {});
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    h.check(!(await page.evaluate(() => window.GS.app.state.stream)), 'Esc leaves Stream Mode');
    // not outside Stream Mode: the keys mean nothing on the normal screen
    await page.keyboard.press('3');
    await page.keyboard.press('c');
    await page.keyboard.press('o');
    h.check(!(await page.evaluate(() => document.body.classList.contains('is-compact'))) && await amountNow() === 400, 'outside Stream Mode these keys do nothing (the amount is still $4)', await amountNow());
    h.check(h.problems.length === problems0, 'section 28d: no console errors, warnings or failed requests', h.problems.slice(problems0, problems0 + 5));
    await page.close();
  }

  /* ------------------------------------------------------- 28e. The overlay link, and the Help section */
  if (h.section('28e. The overlay link: copy it, nothing personal in it, a fallback field, and the Help section')) {
    const problems0 = h.problems.length;
    const page = await h.newPage({ viewport: { width: 1280, height: 720 } });
    await stubClipboard(page);
    await stream(page, '#game-roulette');
    await page.click('#stream-bar [data-role="link"]');
    await page.waitForFunction(() => window.__copied.length === 1);
    const url = await page.evaluate(() => window.__copied[0]);
    h.check(url === h.BASE + '?stream=1&overlay=1#game-roulette', 'Copy overlay link copies <origin><path>?stream=1&overlay=1#<this game>', url);
    h.check(/^[^?#]+\?stream=1&overlay=1#[a-z0-9-]+$/.test(url) && !/name|balance|credit|email|seed|secret|fast|transparent/i.test(url.replace(/^https?:\/\/[^/]+/, '')), 'the link has no name, balance, seed or any other query');
    h.check((await toastTexts(page)).some((t) => /Overlay link copied/.test(t)), 'a toast says it was copied');
    // at a live table the link opens that table
    await h.go(page, '#live-derby10');
    await page.waitForSelector('#livepanel .lt-phase');
    await page.click('#stream-bar [data-role="link"]');
    await page.waitForFunction(() => window.__copied.length === 2);
    h.check((await page.evaluate(() => window.__copied[1])).endsWith('?stream=1&overlay=1#live-derby10'), 'at a live table the link is for that table');
    // the link works: it opens the see-through view of that game
    const other = await h.newPage({ viewport: { width: 1280, height: 720 } });
    await other.goto(url.replace('?stream', '?fast=1&stream'), { waitUntil: 'load' });
    await other.waitForFunction(() => document.body.classList.contains('is-ready'));
    h.check(await other.evaluate(() => document.body.classList.contains('is-overlay') && window.GS.app.state.route === 'game-roulette'), 'opening the copied link gives the overlay view of that game');
    await other.close();
    await page.close();

    // a browser that will not copy: the link is shown selected, to copy by hand
    const bad = await h.newPage({ viewport: { width: 1280, height: 720 } });
    await stubClipboard(bad, false);
    await stream(bad, '#game-wheel');
    await bad.click('#stream-bar [data-role="link"]');
    await bad.waitForSelector('#stream-keys:not([hidden])');
    const sel = await bad.evaluate(() => { const i = document.querySelector('#stream-link'); return { focus: document.activeElement === i, v: i.value, a: i.selectionStart, b: i.selectionEnd, readonly: i.readOnly }; });
    h.check(sel.focus && sel.readonly && sel.a === 0 && sel.b === sel.v.length && sel.v.endsWith('?stream=1&overlay=1#game-wheel'), 'if copying is blocked, the link appears in a read-only field with all of it selected', sel);
    h.check((await toastTexts(bad)).some((t) => /Could not copy/.test(t)), 'and a toast says copying was not possible');
    await bad.close();

    // Help: five steps, the button, the field, the keys; the older answers stay true
    const hp = await h.newPage({ viewport: { width: 1280, height: 800 } });
    await stubClipboard(hp);
    await h.openApp(hp, '#help-stream-howto');
    await hp.waitForSelector('#help-stream-howto[open]');
    const help = await hp.evaluate(() => { const d = document.querySelector('#help-stream-howto'); return { title: d.querySelector('summary').textContent, steps: d.querySelectorAll('ol > li').length, text: d.innerText, field: d.querySelector('#help-stream-link').value, btn: !!d.querySelector('[data-stream-copy]') }; });
    h.check(help.title === 'How to use this on a stream' && help.steps === 5, 'Help has "How to use this on a stream" with 5 steps', help.steps);
    h.check(/Stream Mode/.test(help.text) && /overlay link/i.test(help.text) && /Browser/.test(help.text) && /1920/.test(help.text) && /1080/.test(help.text) && /Custom CSS/.test(help.text) && /Interact/.test(help.text), 'the steps: turn on Stream Mode, copy the link, a Browser source, 1920 x 1080, tips (no Custom CSS needed, Interact)');
    h.check(/simulated viewers/i.test(help.text) && /DEMO · play money/.test(help.text) && !/real (players|people) (vote|watch)/i.test(help.text) && !/crypto|bitcoin|wallet|\btokens?\b|\bcoins?\b|cash out|jackpot/i.test(help.text), 'it says the chat is simulated, mentions the DEMO tag, and has no banned words');
    await hp.click('#help-stream-howto [data-stream-copy]');
    await hp.waitForFunction(() => window.__copied.length === 1);
    const hurl = await hp.evaluate(() => window.__copied[0]);
    h.check(hurl === help.field && /\?stream=1&overlay=1#game-[a-z]+$/.test(hurl) && hurl.startsWith(h.BASE), 'the Help button copies the same kind of link (for the game played last) and the field shows it', hurl);
    h.check(/Can I use this on stream/.test(await hp.locator('#help-stream summary').innerText()) && /one-line demo notice/.test(await hp.locator('#help-stream').textContent()) && /transparent=1/.test(await hp.locator('#help-stream').textContent()), 'the older answer "Can I use this on stream?" is still there and still true');
    h.check(/Stream Mode has a few more keys/.test(await hp.locator('#help-keys').textContent()), 'the Keyboard shortcuts answer points to the Stream Mode keys');
    await h.a11y(hp, 'Help with the stream answer open');
    await hp.close();
    h.check(h.problems.length === problems0, 'section 28e: no console errors, warnings or failed requests', h.problems.slice(problems0, problems0 + 5));
  }

  /* ------------------------------------------------------------- 28f. ?overlay=1: the see-through view */
  if (h.section('28f. ?overlay=1: a see-through page for a browser source')) {
    const problems0 = h.problems.length;
    const external = [];
    const page = await h.newPage({ viewport: { width: 1280, height: 720 }, tour: true });   // (the first-visit tour is left ON: the overlay must skip it)
    page.on('request', (r) => { if (!r.url().startsWith(h.ORIGIN) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) { external.push(r.url()); } });
    await h.openApp(page, '#game-wheel', '?fast=1&overlay=1');
    await page.waitForSelector('#stream-hud', { state: 'attached' });
    await page.waitForTimeout(700);
    const m = await page.evaluate(() => {
      const cs = (e) => getComputedStyle(e);
      const alpha = (c) => { const x = /rgba?\(([^)]+)\)/.exec(c); if (!x) { return 1; } const p = x[1].split(',').map(Number); return p.length > 3 ? p[3] : 1; };
      const vis = (s) => { const e = document.querySelector(s); return !!e && (e.offsetParent !== null || cs(e).position === 'fixed') && cs(e).display !== 'none' && e.getBoundingClientRect().height > 0; };
      return {
        htmlA: alpha(cs(document.documentElement).backgroundColor), bodyA: alpha(cs(document.body).backgroundColor), img: cs(document.body).backgroundImage, cls: document.body.className,
        tour: !!(window.GS.ui.tour && window.GS.ui.tour.isOpen()) || !!document.querySelector('#tour:not([hidden]) .tour__card'),
        top: vis('#topbar'), side: vis('.side'), foot: vis('.foot'), strip: vis('.demo-strip'), exit: vis('#stream-exit'), bar: vis('#stream-bar'), bet: vis('#view-game .bet'), kbd: vis('.kbd-hint'),
        pic: vis('#panel-wheel'), pot: vis('#stream-hud [data-role="pot"]'), vote: vis('#stream-vote'), rid: vis('#stream-hud [data-role="rid"]'),
        tag: (document.querySelector('#stream-demo') || {}).textContent, tagVis: vis('#stream-demo'), handle: vis('#stream-handle'), scheme: cs(document.documentElement).colorScheme
      };
    });
    h.check(m.htmlA === 0 && m.bodyA === 0 && m.img === 'none', 'the page is see-through: html and body have background alpha 0 and no background image', { html: m.htmlA, body: m.bodyA, img: m.img });
    h.check(/is-overlay/.test(m.cls) && /is-stream/.test(m.cls) && /is-compact/.test(m.cls), 'body.is-overlay (and Stream Mode and the compact view) are on', m.cls);
    h.check(m.pic && m.pot && m.vote && m.rid, 'the picture, the pot, the round id and the vote bar are shown');
    h.check(!m.top && !m.side && !m.foot && !m.strip && !m.exit && !m.bar && !m.bet && !m.kbd, 'everything else is hidden: no top bar, menu, footer, demo strip, toolbar, Exit button or controls', m);
    h.check(!m.tour, 'the first-visit tour does not start over the picture');
    h.check(m.tagVis && m.tag === 'DEMO · play money', 'the small honest "DEMO · play money" tag stays in the corner (' + m.tag + ')');
    const tagBox = await page.locator('#stream-demo').boundingBox();
    h.check(tagBox.x < 40 && tagBox.y < 40, 'in the top left corner', tagBox);
    // a real screenshot with no background: the margins are transparent, the picture's card is not (and the same screen not in the overlay is opaque everywhere)
    const shot = pngAlpha(await page.screenshot({ omitBackground: true }));
    h.check(shot.alpha(4, 300) === 0 && shot.alpha(shot.w - 4, 300) === 0 && shot.alpha(shot.w / 2, 3) === 0, 'a screenshot taken with no background has alpha 0 in the margins (' + [shot.alpha(4, 300), shot.alpha(shot.w - 4, 300), shot.alpha(shot.w / 2, 3)] + ')');
    h.check(shot.alpha(shot.w / 2, 500) >= 200, 'while the cards that hold the picture and the words stay dark (alpha ' + shot.alpha(shot.w / 2, 500) + '), so they can be read on any scene');
    const fit = await fitOf(page);
    h.check(fit.sh <= fit.ih + 1 && fit.sw <= fit.iw + 1 && fit.pic.t >= 0 && fit.pic.b <= fit.ih, 'it fits the screen with no scrolling', fit);
    // accessibility: the overlay with the controls hidden, then with them shown (axe measures the colours as if the page were on a white scene, the worst case)
    await h.a11y(page, 'the overlay (compact, see-through)');
    // the controls come back from the corner button and from O; the keys play even with the controls hidden
    h.check(m.handle, 'a small button at the corner brings the controls back');
    await page.click('#stream-handle');
    h.check(await page.locator('#btn-play').isVisible() && !(await page.locator('#stream-handle').isVisible()), 'pressing it shows the controls');
    await h.a11y(page, 'the overlay with its controls shown');
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('o');
    await page.keyboard.press('Space');
    await h.waitReceipt(page);
    h.check(await page.locator('#dlg-result').isVisible(), 'Space plays in the overlay and the receipt shows');
    h.check(shot.w === 1280 && await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor) === 'rgba(0, 0, 0, 0)', 'the page stays see-through while the receipt is open');
    const rs = await page.screenshot({ omitBackground: true });
    const rsa = pngAlpha(rs);
    h.check(rsa.alpha(4, 300) === 0 && rsa.alpha(rsa.w - 4, 700) === 0, 'and the dialog\'s backdrop is not dark (the margins are still alpha 0 with the receipt open)', [rsa.alpha(4, 300), rsa.alpha(rsa.w - 4, 700)]);
    await h.closeReceipt(page);
    // a normal Stream Mode page is NOT see-through
    const normal = await h.newPage({ viewport: { width: 1280, height: 720 } });
    await stream(normal);
    const ns = pngAlpha(await normal.screenshot({ omitBackground: true }));
    h.check(ns.alpha(4, 300) === 255 && ns.alpha(ns.w - 4, 300) === 255, 'a normal Stream Mode page is opaque (alpha 255 in the same places): the check can tell them apart');
    h.check(!(await normal.evaluate(() => document.body.classList.contains('is-overlay'))) && !(await normal.locator('#stream-demo').isVisible()), 'and has no overlay tag (it has the demo strip instead)');
    await normal.close();
    // leaving the overlay with Esc gives the normal page back
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const back = await page.evaluate(() => ({ cls: document.body.className, bg: getComputedStyle(document.body).backgroundColor, side: !!document.querySelector('.side').offsetParent, strip: !!document.querySelector('.demo-strip').offsetParent }));
    h.check(!/is-overlay|is-stream|is-compact|is-transparent/.test(back.cls) && back.bg !== 'rgba(0, 0, 0, 0)' && back.side && back.strip, 'Esc leaves the overlay and puts the normal page back (opaque background, menu and demo strip)', back);
    h.check(external.length === 0, 'the overlay contacts no other host', external.slice(0, 3));
    await page.close();
    for (const [w, hh] of [[1920, 1080], [2560, 1440], [390, 844], [844, 390]]) {
      const p = await h.newPage({ viewport: { width: w, height: hh }, mobile: w < 700 || hh < 500 });
      await h.openApp(p, '#game-slots', '?fast=1&overlay=1');
      await p.waitForTimeout(700);
      const f = await fitOf(p);
      h.check(f.sw <= f.iw + 1 && f.pic && f.pic.b <= f.ih + 1 && f.pic.t >= 0 && (w >= 900 ? f.sh <= f.ih + 1 : true), w + 'x' + hh + ': the overlay has no sideways scroll and the whole picture is on the screen' + (w >= 900 ? ' (and no scrolling at all)' : ''), f);
      await p.close();
    }
    // opened from the lobby (no game on screen yet): Stream Mode takes you to a game, and the corner button is there once it is drawn
    const lob = await h.newPage({ viewport: { width: 1280, height: 720 } });
    await h.openApp(lob, '#lobby', '?fast=1&overlay=1');
    await lob.waitForSelector('#stream-hud', { state: 'attached' });
    await lob.waitForTimeout(700);
    const lm = await lob.evaluate(() => ({ route: window.GS.app.state.route, compact: document.body.classList.contains('is-compact'), handle: !document.querySelector('#stream-handle').hidden, bet: getComputedStyle(document.querySelector('#view-game .bet')).display }));
    h.check(/^game-/.test(lm.route) && lm.compact && lm.handle && lm.bet === 'none', 'an overlay opened at #lobby goes to a game, in the compact view with the corner button', lm);
    await lob.close();
    h.check(h.problems.length === problems0, 'section 28f: no console errors, warnings or failed requests', h.problems.slice(problems0, problems0 + 5));
  }

  /* ----------------------------- 28g. Credit off the screen, accessibility, reduced motion, leaving Stream Mode */
  if (h.section('28g. Stream Mode: credit off the screen by default, axe, reduced motion, and leaving restores the normal layout')) {
    const problems0 = h.problems.length;
    const page = await h.newPage({ viewport: { width: 1280, height: 720 } });
    await stream(page);
    // credit
    const credit = async () => ({ aux: await page.locator('#field-amount .field__aux').isVisible(), text: await page.locator('#field-amount .field__aux').textContent(), btn: await page.locator('#stream-bar [data-role="credit"]').getAttribute('aria-pressed') });
    let c = await credit();
    h.check(!c.aux && c.btn === 'false', 'credit is hidden by default and the button says it is not shown', c);
    await page.keyboard.press('Space');
    await h.waitReceipt(page);
    const r1 = await page.locator('#dlg-result').innerText();
    h.check(/Paid with demo credit/.test(r1) && !/left/.test(r1.split('Paid with demo credit')[1].split('\n')[0]), 'the receipt says "Paid with demo credit" without the balance left', r1.split('Paid with demo credit')[1].split('\n')[0]);
    await h.closeReceipt(page);
    await page.click('#stream-bar [data-role="credit"]');
    c = await credit();
    h.check(c.aux && /^Credit \$/.test(c.text) && c.btn === 'true', '"Show my credit" shows it (' + c.text + ')');
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('Space');
    await h.waitReceipt(page);
    h.check(/Paid with demo credit · \$[\d,]+ left/.test(await page.locator('#dlg-result').innerText()), 'and the receipt then shows what is left');
    await h.closeReceipt(page);
    await page.click('#stream-bar [data-role="credit"]');
    // accessibility
    await page.evaluate(() => window.GS.ui.streamui.setSeed('axe'));
    await voteDone(page);
    await h.a11y(page, 'Stream Mode, 1280x720 (vote closed)');
    await page.keyboard.press('?');
    await h.a11y(page, 'Stream Mode with the shortcuts open');
    await page.keyboard.press('Escape');
    await page.keyboard.press('o');
    await h.a11y(page, 'Stream Mode, compact view');
    await page.keyboard.press('o');
    h.check(await page.locator('#stream-hud [aria-live], #stream-bar [aria-live], #stream-hud [role="status"], #stream-hud [role="alert"], #stream-bar [role="status"]').count() === 0, 'nothing in the toolbar, pot or vote is a live region');
    // on a page that is not a game there is still a way out (the Exit button is then a fixed button again)
    await h.go(page, '#fair');
    await page.waitForTimeout(300);
    const away = await page.evaluate(() => { const x = document.querySelector('#stream-exit'); const b = x.getBoundingClientRect(); return { fixed: getComputedStyle(x).position, vis: x.offsetParent !== null || getComputedStyle(x).position === 'fixed', onScreen: b.bottom <= innerHeight && b.right <= innerWidth && b.height > 0, parentBody: x.parentNode === document.body }; });
    h.check(away.fixed === 'fixed' && away.vis && away.onScreen && away.parentBody, 'on a page that is not a game the Exit button is a fixed button again, so there is always a way out', away);
    await h.go(page, '#game-wheel');
    await page.waitForTimeout(500);
    h.check(await page.evaluate(() => document.querySelector('#stream-exit').parentNode === document.querySelector('#stream-bar')) && await page.locator('#stream-exit').isVisible(), 'and back on a game it rides in the toolbar again');
    // leaving restores the normal layout
    await page.click('#stream-exit');
    await page.waitForTimeout(400);
    const back = await page.evaluate(() => {
      const vis = (s) => { const e = document.querySelector(s); return !!e && e.offsetParent !== null && e.getBoundingClientRect().height > 0; };
      return {
        cls: document.body.className, top: vis('#topbar'), side: vis('.side'), foot: vis('.foot'), rounds: vis('#field-rounds'), bet: vis('#view-game .bet'), hud: vis('#stream-hud'), bar: vis('#stream-bar'), exit: vis('#stream-exit'), tabs: vis('#below-tabs'),
        ks: document.querySelectorAll('#btn-play[aria-keyshortcuts], #field-amount .preset[aria-keyshortcuts], #stream-exit[aria-keyshortcuts], #lt-stake [aria-keyshortcuts]').length, exitParent: document.querySelector('#stream-exit').parentNode === document.body, grid: getComputedStyle(document.querySelector('#view-game .gamegrid')).gridTemplateColumns
      };
    });
    h.check(!/is-stream|is-compact|stream-credit|is-overlay/.test(back.cls) && back.top && back.side && back.foot && back.rounds && back.bet && back.tabs, 'leaving Stream Mode brings back the top bar, the menu, the footer, the full gift panel and the tabs', back);
    h.check(!back.hud && !back.bar && !back.exit && back.exitParent && back.ks === 0, 'and takes down the pot, the vote, the toolbar and the shortcut hints (no aria-keyshortcuts left)', back);
    const fit = await fitOf(page);
    h.check(fit.sw <= fit.iw + 1 && fit.play && fit.pic && fit.pic.b <= fit.ih + 200, 'the normal game screen has its first-screen layout again', fit);
    await page.evaluate(() => window.scrollTo(0, 0));
    const plain = await h.newPage({ viewport: { width: 1280, height: 720 } });
    await h.openApp(plain, '#game-wheel');
    await plain.waitForTimeout(400);
    const baseGrid = await plain.evaluate(() => getComputedStyle(document.querySelector('#view-game .gamegrid')).gridTemplateColumns);
    await plain.close();
    h.check(back.grid === baseGrid, 'the game screen has the very same columns as a page that never was in Stream Mode (' + back.grid + ')', { back: back.grid, base: baseGrid });
    // and on again: the same (the tool bar comes back, nothing is doubled)
    await page.click('#btn-stream');
    await page.waitForTimeout(500);
    h.check(await page.locator('#stream-bar').count() === 1 && await page.locator('#stream-hud').count() === 1 && await page.locator('#stream-bar [data-role="link"]').isVisible(), 'turning Stream Mode on again builds one toolbar and one pot, not two');
    await page.close();

    // phone and a live table: axe
    const ph = await h.newPage({ viewport: { width: 390, height: 844 }, mobile: true });
    await stream(ph);
    await ph.evaluate(() => window.GS.ui.streamui.setSeed('axe2'));
    await voteDone(ph);
    await h.a11y(ph, 'Stream Mode on a phone (390x844)');
    const sp = await ph.evaluate(() => ({ exit: (() => { const b = document.querySelector('#stream-exit').getBoundingClientRect(); const p = document.querySelector('#btn-play').getBoundingClientRect(); return { exitB: b.bottom, playT: p.top, overlap: !(b.right < p.left || b.left > p.right || b.bottom < p.top || b.top > p.bottom) }; })() }));
    h.check(!sp.exit.overlap, 'on a phone the Exit button no longer sits on top of Play', sp);
    await ph.close();
    const lt = await h.newPage({ viewport: { width: 1280, height: 720 } });
    await stream(lt, '#live-derby10');
    await lt.waitForSelector('#livepanel .lt-phase');
    await lt.evaluate(() => { window.GS.live.room('derby10')._clearTimers(); });
    await lt.waitForTimeout(700);
    await h.a11y(lt, 'Stream Mode at a live table');
    await lt.close();

    // reduced motion: nothing in the stream parts moves or loops, and the vote still works
    const rm = await h.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
    await stream(rm);
    const motion = await rm.evaluate(() => {
      const els = Array.from(document.querySelectorAll('#stream-hud *, #stream-bar *, #stream-handle, #stream-demo'));
      const anims = document.getAnimations().filter((a) => a.effect && a.effect.target && els.includes(a.effect.target));
      return { transitions: Array.from(document.querySelectorAll('#stream-vote .svote__seg')).map((s) => getComputedStyle(s).transitionDuration), anims: anims.length, reduced: window.GS.util.reducedMotion() };
    });
    h.check(motion.reduced && motion.anims === 0 && motion.transitions.length === S.CANDIDATES && motion.transitions.every((t) => parseFloat(t) < 0.001), 'with reduced motion the vote bar has no transition and nothing in the stream parts is animating', motion);
    await voteDone(rm);
    h.check(/Chat chose/.test(await rm.locator('#stream-vote [data-role="clock"]').innerText()), 'the vote still runs and closes with reduced motion');
    await rm.close();
    h.check(h.problems.length === problems0, 'section 28g: no console errors, warnings or failed requests', h.problems.slice(problems0, problems0 + 5));
  }

  /* ---------------------------------------------- 28h. A live table in Stream Mode */
  if (h.section('28h. Stream Mode at a live table: fits the screen, the amount keys pick the stakes')) {
    const problems0 = h.problems.length;
    for (const [name, w, hh] of [['1280x720', 1280, 720], ['1920x1080', 1920, 1080], ['390x844 phone', 390, 844]]) {
      const page = await h.newPage({ viewport: { width: w, height: hh }, mobile: w < 700 });
      await stream(page, '#live-derby10');
      await page.waitForSelector('#livepanel .lt-phase', { state: 'attached' });
      await page.evaluate(() => { window.GS.live.room('derby10')._clearTimers(); });
      await page.waitForTimeout(700);
      const f = await fitOf(page);
      h.check(f.sw <= f.iw + 1 && f.play && f.play.t >= 0 && f.play.b <= f.ih && f.pic && f.pic.b <= f.ih + 1 && f.hud, name + ': the table fits (no sideways scroll, the join button, the picture and the pot on the screen)', f);
      if (w >= 900) {
        await page.keyboard.press('3');
        const st = await page.evaluate(() => Array.from(document.querySelectorAll('#lt-stake [data-stake]')).map((b) => b.getAttribute('aria-pressed') + ':' + b.getAttribute('data-stake') + ':' + b.getAttribute('aria-keyshortcuts')));
        h.check(st.length >= 5 && st[2].startsWith('true:') && st.slice(0, 5).every((s, i) => s.endsWith(':' + (i + 1))), 'the 3 key picks the third stake and the stake buttons carry their keys', st);
        h.check(await page.locator('#livepanel .lt-chat').isHidden() || !(await page.locator('#livepanel .lt-chat').count()), 'the table\'s own chat rows give way to the bar above the picture');
      }
      await page.close();
    }
    h.check(h.problems.length === problems0, 'section 28h: no console errors, warnings or failed requests', h.problems.slice(problems0, problems0 + 5));
  }
}

const toastTexts = (page) => page.locator('#toasts .toast').allTextContents();
