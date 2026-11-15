// Share cards (the picture after a round and the profile card) and the fair-play showcase (the lobby block, the checker, the Verify shortcut).
// Sections 24a to 24e. Run one with ONLY=24a (the filter takes whole ids, not the prefix).
import fs from 'node:fs';

const DLG = '#dlg-sharecard';

export default async function (h) {
  const { check, newPage, openApp, go, a11y, waitReceipt, closeReceipt } = h;

  // plays one round of the wheel with a gift of `amount` dollars and waits for the receipt
  const playRound = async (page, amount) => {
    await go(page, '#game-wheel');
    if (amount) { await h.setAmount(page, amount); }
    await page.click('#btn-play');
    await waitReceipt(page);
    await page.evaluate(() => window.GS.confetti.clear());
  };
  const openShare = async (page) => {
    await page.click('#dlg-result [data-role="share"]');
    await page.waitForSelector(DLG + '[open] .sc__preview[data-ready="1"]', { timeout: 20000 });
  };
  const pickSize = async (page, size) => {
    await page.click(DLG + ' [data-size="' + size + '"]');
    await page.waitForFunction((s) => { const p = document.querySelector('#dlg-sharecard .sc__preview'); return p.getAttribute('data-shape') === s && p.getAttribute('data-ready') === '1'; }, size, { timeout: 20000 });
  };
  const closeShare = async (page) => {
    await page.click(DLG + ' .modal__close');
    await page.waitForFunction(() => !document.querySelector('#dlg-sharecard').open);
  };
  // what the picture on show really is: its own pixels (drawn back onto a canvas), its size and what the page says about it
  const look = (page) => page.evaluate(async () => {
    const img = document.querySelector('#dlg-sharecard [data-role="img"]');
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const px = (x, y) => Array.from(g.getImageData(x, y, 1, 1).data);
    const seen = new Set();
    for (let y = 0; y < cv.height; y += 30) { for (let x = 0; x < cv.width; x += 30) { seen.add(px(x, y).join(',')); } }
    let gold = 0;
    for (let x = 14; x < 40; x++) { const [r, gr, b] = px(x, Math.round(cv.height / 2)); if (r > 200 && gr > 140 && b < 150) { gold++; } }
    const c = window.GS.ui.sharecard.canvas();
    const p = document.querySelector('#dlg-sharecard .sc__preview');
    return { w: img.naturalWidth, h: img.naturalHeight, colours: seen.size, gold, canvas: [c.width, c.height], frame: p.getAttribute('data-frame'), alt: img.alt, last: window.GS.ui.sharecard.last(), corner: px(2, 2) };
  });

  /* ======================================================================== */
  if (h.section('24a. Share your gift: a picture after a round, in two sizes, with the fancy frame only for a big win')) {
    const problems0 = h.problems.length;
    const page = await newPage();
    await openApp(page, '#game-wheel');
    await playRound(page, 5);
    const rec = await page.evaluate(() => { const l = window.GS.app._last; return { fair: l.round.fair, id: l.pay.receipt, cents: l.round.cents, fmt: window.GS.core.fmtMoney(l.round.cents, true), bal: window.GS.core.fmtMoney(window.GS.store.balance(), true) }; });
    check(/Share your gift/.test(await page.locator('#dlg-result [data-role="share"]').innerText()), 'the receipt\'s Share button reads "Share your gift"');
    await page.focus('#dlg-result [data-role="share"]');
    await openShare(page);
    check((await page.locator(DLG + ' .modal__title').innerText()) === 'Share your gift', 'it opens the "Share your gift" dialog');
    check(await page.evaluate(() => document.querySelector('#dlg-sharecard').getAttribute('aria-labelledby') === 'dlg-sharecard-title' && !!document.getElementById('dlg-sharecard-title')), 'the dialog is named by its title');

    // the two sizes: portrait first, then square; each is a picture of the right size with real content in it
    const sizes = [['portrait', 1080, 1350], ['square', 1080, 1080]];
    for (const [id, w, hh] of sizes) {
      await pickSize(page, id);
      const r = await look(page);
      check(r.w === w && r.h === hh && r.canvas[0] === w && r.canvas[1] === hh, id + ': the picture and the canvas are ' + w + ' x ' + hh, r);
      check(r.colours > 25, id + ': the picture is not blank (' + r.colours + ' different colours in a sample grid)', r.colours);
      check(r.corner[3] === 255, id + ': it is fully opaque (no see-through corners)', r.corner);
      check(r.gold === 0 && r.frame === 'plain' && r.last.big === '', id + ': a small gift gets the plain frame (no gold border)', { gold: r.gold, frame: r.frame });
      check(r.alt.includes(id) && r.alt.includes(String(w)) && r.alt.includes(rec.fmt) && /Lucky Wheel/.test(r.alt) && /nothing was charged/.test(r.alt), id + ': the <img> has a real alt text (shape, amount, game, the demo line)', r.alt);
    }
    check((await page.locator(DLG + ' [data-size="square"]').getAttribute('aria-pressed')) === 'true' && (await page.locator(DLG + ' [data-size="portrait"]').getAttribute('aria-pressed')) === 'false', 'the shape toggle says which one is chosen (aria-pressed)');
    check((await page.evaluate(() => window.GS.local.get('share', null))).size === 'square', 'and the last shape is remembered (GS.local key "share")');

    // the verify code on the card is the receipt's own: the first 8 characters of the fingerprint shown before the round, and the receipt id
    const want = 'Verify this round: ' + rec.fair.serverHash.slice(0, 8) + ' · ' + rec.id;
    const info = await page.evaluate(() => window.GS.ui.sharecard.last());
    check(info.verify === want, 'the verify code on the card matches the receipt\'s fair data', { got: info.verify, want });
    const hashOnReceipt = await page.evaluate(() => document.querySelector('#dlg-result .rs-fair dd.mono').textContent);
    check(hashOnReceipt === rec.fair.serverHash && hashOnReceipt.startsWith(info.verify.split(': ')[1].slice(0, 8)), 'and it is the start of the fingerprint the receipt shows under Fair play details', hashOnReceipt);
    check(!info.text.includes(rec.fair.roundSeed) && !info.alt.includes(rec.fair.roundSeed), 'the secret number is nowhere on the card, in its text or in its alt text');
    check(!info.text.includes(rec.bal) && !info.alt.includes(rec.bal) && !/balance|credit/i.test(info.text + info.alt), 'neither is the balance (' + rec.bal + ')');
    check(/Simulated round: no money moved/.test(info.alt) && /The house is a charity/.test(info.alt), 'the demo card says nothing real moved, in the site\'s own voice');

    // the text that travels with the picture is short and has the site address (and no name: none is chosen)
    check(/^My GiveSpin round landed on .+\(play money\)\. Check it yourself: [0-9a-f]{8} · GS-[A-Z0-9]{6}\. Give it a spin:$/.test(info.text), 'the share text is short and names the round\'s verify code', info.text);

    // keyboard and focus
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    const firstTab = async () => { await page.keyboard.press('Tab'); return page.evaluate(() => document.activeElement && (document.activeElement.getAttribute('data-role') || document.activeElement.getAttribute('data-size') || document.activeElement.className)); };
    const seenFocus = [];
    for (let i = 0; i < 9; i++) { seenFocus.push(await firstTab()); }
    check(seenFocus.some((x) => x === 'portrait') && seenFocus.some((x) => x === 'square') && seenFocus.includes('download') && seenFocus.includes('copy'), 'the keyboard reaches the shape buttons, the link to the profile and every action', seenFocus);
    await page.focus(DLG + ' [data-size="portrait"]');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#dlg-sharecard .sc__preview').getAttribute('data-shape') === 'portrait' && document.querySelector('#dlg-sharecard .sc__preview').getAttribute('data-ready') === '1');
    check((await page.locator(DLG + ' [data-size="portrait"]').getAttribute('aria-pressed')) === 'true', 'Enter on a shape button chooses it');
    await a11y(page, 'the share dialog (laptop)');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#dlg-sharecard').open);
    check(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-role') === 'share' && !!document.activeElement.closest('#dlg-result')), 'closing it puts the focus back on the receipt\'s Share button');
    check(await page.evaluate(() => document.querySelector('#dlg-result').open), 'and the receipt is still open under it');
    await closeReceipt(page);

    // a big gift ($100 or more) gets the fancy frame: a gold border, in both sizes
    await playRound(page, 150);
    await openShare(page);
    for (const [id] of sizes) {
      await pickSize(page, id);
      const r = await look(page);
      check(r.gold >= 8 && r.frame === 'fancy' && r.last.big === 'big' && r.last.ribbon === 'Big gift', id + ': a $150 gift gets the fancy frame (gold border, ribbon "Big gift")', { gold: r.gold, frame: r.frame, last: r.last.big });
      check(r.colours > 40, id + ': and it is busier than the plain card (confetti dots, glow, bulbs): ' + r.colours + ' colours', r.colours);
      check(/Gold frame: Big gift/.test(r.alt), id + ': the alt text mentions the gold frame', r.alt);
    }
    await closeShare(page);
    // the rule at its edges, on the real receipt: $99.99 is plain, $100 is fancy (the rule itself is unit-tested)
    const rules = await page.evaluate(async () => {
      const last = window.GS.app._last;
      const run = async (patch, sum) => {
        window.GS.ui.sharecard.openRound({ round: Object.assign({}, last.round, patch), pay: last.pay, summary: Object.assign({}, last.summary, sum || {}), demo: true });
        await new Promise((r) => { const t0 = Date.now(); (function w() { const p = document.querySelector('#dlg-sharecard .sc__preview'); if ((p && p.getAttribute('data-ready') === '1' && Date.now() - t0 > 150) || Date.now() - t0 > 20000) { r(); } else { setTimeout(w, 40); } })(); });
        const l = window.GS.ui.sharecard.last();
        document.querySelector('#dlg-sharecard .modal__close').click();
        await new Promise((r) => setTimeout(r, 60));
        return l.big;
      };
      return {
        edge: await run({ cents: 9999, jackpot: false, pick: null }, { rankedUp: false }),
        hundred: await run({ cents: 10000, jackpot: false, pick: null }, { rankedUp: false }),
        triple: await run({ cents: 500, jackpot: true, pick: null }, { rankedUp: false }),
        called: await run({ cents: 500, jackpot: false, pick: { id: 'x', won: true, board: 8, wins: 1 } }, { rankedUp: false }),
        notCalled: await run({ cents: 500, jackpot: false, pick: { id: 'x', won: false, board: 8, wins: 0 } }, { rankedUp: false }),
        rankup: await run({ cents: 500, jackpot: false, pick: null }, { rankedUp: true })
      };
    });
    check(rules.edge === '' && rules.hundred === 'big' && rules.triple === 'jackpot' && rules.called === 'called' && rules.notCalled === '' && rules.rankup === 'rankup', 'the fancy frame is for $100 or more, a Triple Threat, a backed charity that won, or a rank-up (a cent under $100 and a missed call are plain)', rules);
    // closing the dialog and opening it again in the same breath still draws the new picture (the first dialog's late "close" event must not cancel it)
    const again = await page.evaluate(async () => {
      const last = window.GS.app._last;
      const ctx = { round: last.round, pay: last.pay, summary: last.summary, demo: true };
      const ready = () => new Promise((r) => { const t0 = Date.now(); (function w() { const p = document.querySelector('#dlg-sharecard .sc__preview'); if ((p && p.getAttribute('data-ready') === '1') || Date.now() - t0 > 20000) { r(!!(p && p.getAttribute('data-ready') === '1')); } else { setTimeout(w, 40); } })(); });
      window.GS.ui.sharecard.openRound(ctx);
      const first = await ready();
      document.querySelector('#dlg-sharecard .modal__close').click();
      window.GS.ui.sharecard.openRound(ctx);
      const second = await ready();
      await new Promise((r) => setTimeout(r, 300));
      const img = document.querySelector('#dlg-sharecard [data-role="img"]');
      document.querySelector('#dlg-sharecard .modal__close').click();
      return { first, second, shown: !!img.src && img.naturalWidth > 0 };
    });
    check(again.first && again.second && again.shown, 'closing the share dialog and opening it again at once still draws the picture', again);
    await closeReceipt(page);
    check(h.problems.length === problems0, 'section 24a: no console errors, warnings or failed requests', h.problems.slice(problems0, problems0 + 5));
    await page.close();

    // on a phone (and the smallest one): the picture and the actions fit, nothing scrolls sideways
    for (const [name, vp] of [['a phone', { width: 390, height: 844 }], ['a 320 px phone', { width: 320, height: 640 }], ['a phone held sideways', { width: 844, height: 390 }]]) {
      const p = await newPage({ viewport: vp, mobile: true });
      await openApp(p, '#game-wheel');
      await playRound(p, 5);
      await openShare(p);
      const m = await p.evaluate(() => {
        const d = document.querySelector('#dlg-sharecard');
        const img = d.querySelector('[data-role="img"]').getBoundingClientRect();
        const body = d.querySelector('.modal__body');
        const dl = d.querySelector('[data-role="download"]').getBoundingClientRect();
        return { sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 || body.scrollWidth > body.clientWidth + 1, imgW: Math.round(img.width), imgH: Math.round(img.height), imgR: Math.round(img.right), vw: window.innerWidth, dlVisibleOrScroll: dl.width > 100 };
      });
      check(!m.sideways && m.imgR <= m.vw && m.imgW > 120 && m.dlVisibleOrScroll, 'on ' + name + ' the picture (' + m.imgW + ' x ' + m.imgH + ' px) and the buttons fit, nothing scrolls sideways', m);
      if (vp.width === 390) { await a11y(p, 'the share dialog (phone)'); }
      await p.close();
    }
  }

  /* ======================================================================== */
  if (h.section('24b. Share your gift: the name switch, Download, Web Share and the copy fallback')) {
    const problems0 = h.problems.length;
    const page = await newPage();
    // record every picture handed to the browser as a download, and let a test stub the share sheet
    await page.addInitScript(() => {
      window.__blobs = [];
      const make = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (b) => { window.__blobs.push({ type: b.type, size: b.size }); return make(b); };
    });
    await openApp(page, '#game-wheel');
    await playRound(page, 5);
    await openShare(page);

    // no chosen name: the switch is off and cannot be turned on, with a way to choose one
    const sw0 = await page.evaluate(() => { const i = document.querySelector('#dlg-sharecard [data-role="show-name"]'); return { checked: i.checked, disabled: i.disabled, role: i.getAttribute('role'), label: i.closest('label').innerText, link: !!document.querySelector('#dlg-sharecard [data-role="get-name"]') }; });
    check(!sw0.checked && sw0.disabled && sw0.role === 'switch' && /Show my name on the card/.test(sw0.label) && sw0.link, 'with no chosen name the "Show my name on the card" switch is off and disabled, and points to the profile', sw0);
    check((await page.evaluate(() => window.GS.ui.sharecard.last())).name === '', 'and the card has no name');

    // Download: a real PNG
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click(DLG + ' [data-role="download"]')]);
    const file = await dl.path();
    const bytes = fs.readFileSync(file);
    check(/^givespin-gift-GS-[A-Z0-9]{6}-(portrait|square)\.png$/.test(dl.suggestedFilename()), 'Download saves "' + dl.suggestedFilename() + '" (named after the receipt and the shape)');
    check(bytes.length > 20000 && bytes.slice(0, 8).toString('hex') === '89504e470d0a1a0a', 'the file is a real PNG (' + bytes.length + ' bytes, PNG signature)');
    const blobs = await page.evaluate(() => window.__blobs);
    check(blobs.some((b) => b.type === 'image/png' && b.size > 20000 && b.size === bytes.length), 'it was made from an image/png blob of that size', blobs);
    check((await page.locator(DLG + ' [data-role="hint"]').isHidden()), 'while downloads work there is no "press and hold" hint');
    check((await page.locator('#toasts .toast').allInnerTexts()).some((t) => /Download started/.test(t)), 'a toast says the download started');

    // when the download fails (a click that is refused), the dialog says how else to save the picture, and the picture is still on show
    await page.evaluate(() => { window.__click = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { throw new Error('blocked'); }; });
    await page.click(DLG + ' [data-role="download"]');
    const hint = await page.locator(DLG + ' [data-role="hint"]').innerText();
    check(/press and hold the picture/i.test(hint) && /Save image/.test(hint) && await page.locator(DLG + ' [data-role="img"]').isVisible(), 'a failed download shows the hint and keeps the picture visible to save by hand', hint);
    await page.evaluate(() => { HTMLAnchorElement.prototype.click = window.__click; });
    await closeShare(page);

    // the name: chosen in the profile, off until switched on, remembered, and never in the text when off
    await page.evaluate(() => window.GS.local.set('profile', { name: 'Ada', frame: '', title: '' }));
    await page.click('#dlg-result [data-role="share"]');
    await page.waitForSelector(DLG + '[open] .sc__preview[data-ready="1"]');
    const sw1 = await page.evaluate(() => { const i = document.querySelector('#dlg-sharecard [data-role="show-name"]'); return { checked: i.checked, disabled: i.disabled, small: i.closest('label').querySelector('small').innerText }; });
    check(!sw1.checked && !sw1.disabled && sw1.small === 'Ada', 'with a chosen name the switch can be used, and it starts OFF (private by default)', sw1);
    let t0 = await page.evaluate(() => window.GS.ui.sharecard.last());
    check(t0.name === '' && !t0.text.includes('Ada') && !t0.alt.includes('Ada'), 'with the switch off the name is not on the card, in its share text or in its alt text', t0.text);
    await page.click(DLG + ' .sc__name');
    await page.waitForFunction(() => window.GS.ui.sharecard.last().nameShown);
    t0 = await page.evaluate(() => window.GS.ui.sharecard.last());
    check(t0.name === 'Ada' && /^Ada’s GiveSpin round/.test(t0.text) && /Ada/.test(t0.alt), 'switched on, the card, its text and its alt text carry the name', t0);
    check((await page.evaluate(() => window.GS.local.get('share', null))).showName === true, 'the choice is remembered under GS.local "share"');
    const px = await look(page);
    check(px.last.nameShown && px.colours > 25, 'and the picture was drawn again with it');
    await closeShare(page);
    await page.click('#dlg-result [data-role="share"]');
    await page.waitForSelector(DLG + '[open] .sc__preview[data-ready="1"]');
    check(await page.evaluate(() => document.querySelector('#dlg-sharecard [data-role="show-name"]').checked) && (await page.evaluate(() => window.GS.ui.sharecard.last())).nameShown, 'opened again, the switch is still on (remembered)');
    await page.click(DLG + ' .sc__name');
    await page.waitForFunction(() => !window.GS.ui.sharecard.last().nameShown);
    t0 = await page.evaluate(() => window.GS.ui.sharecard.last());
    check(!t0.text.includes('Ada') && !t0.alt.includes('Ada') && (await page.evaluate(() => window.GS.local.get('share', null))).showName === false, 'switched off again, the name is gone from everything and the choice is saved off');

    // the account's name is used when there is no profile name, and never the email address
    await page.evaluate(() => { window.GS.local.remove('profile'); window.GS.accounts.createAccount('email', 'kim@example.com', 'Kim'); window.GS.bus.emit('account'); });
    await closeShare(page);
    await page.click('#dlg-result [data-role="share"]');
    await page.waitForSelector(DLG + '[open] .sc__preview[data-ready="1"]');
    const hasKim = await page.evaluate(() => { const i = document.querySelector('#dlg-sharecard [data-role="show-name"]'); return { disabled: i.disabled, small: i.closest('label').querySelector('small').innerText }; });
    check(!hasKim.disabled && hasKim.small === 'Kim', 'a signed-in account\'s name can be shown when there is no profile name', hasKim);
    await page.click(DLG + ' .sc__name');
    await page.waitForFunction(() => window.GS.ui.sharecard.last().nameShown);
    t0 = await page.evaluate(() => window.GS.ui.sharecard.last());
    check(t0.name === 'Kim' && !/example\.com|kim@/i.test(t0.text + t0.alt), 'and the email address is never on the card, in its text or in its alt text', t0.text);
    await page.click(DLG + ' .sc__name');
    await page.waitForFunction(() => !window.GS.ui.sharecard.last().nameShown);

    // Web Share where the browser can share files: the picture goes as a file, with a short text and the address
    await closeShare(page);
    await page.evaluate(() => {
      window.__shared = null;
      navigator.canShare = (d) => !!(d && d.files && d.files.length && d.files[0].type === 'image/png');
      navigator.share = (d) => { window.__shared = { files: (d.files || []).map((f) => ({ name: f.name, type: f.type, size: f.size })), text: d.text, url: d.url, title: d.title }; return Promise.resolve(); };
    });
    await page.click('#dlg-result [data-role="share"]');
    await page.waitForSelector(DLG + '[open] .sc__preview[data-ready="1"]');
    check(await page.locator(DLG + ' [data-role="share"]').isVisible(), 'with Web Share available the Share button shows');
    await page.click(DLG + ' [data-role="share"]');
    const sh = await page.evaluate(() => window.__shared);
    check(sh && sh.files.length === 1 && sh.files[0].type === 'image/png' && sh.files[0].size > 20000 && /\.png$/.test(sh.files[0].name), 'Web Share is called with the PNG as a file', sh);
    check(sh && /GiveSpin round landed on/.test(sh.text) && !/Ada|Kim/.test(sh.text) && /^http:\/\/127\.0\.0\.1:\d+\/$/.test(sh.url) && sh.title === 'GiveSpin', 'with a short text, the site address (no #route, no query) and nothing personal', sh);
    // a browser that shares text but not files: the text and address still go, with no file
    await page.evaluate(() => { window.__shared = null; navigator.canShare = () => false; });
    await page.click(DLG + ' [data-role="share"]');
    const sh2 = await page.evaluate(() => window.__shared);
    check(sh2 && sh2.files.length === 0 && /GiveSpin round/.test(sh2.text) && !!sh2.url, 'where files cannot be shared, the text and address are shared without the file', sh2);
    // closing the share sheet is not an error and copies nothing
    await page.evaluate(() => { window.__copied = null; Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { window.__copied = t; return Promise.resolve(); } }, configurable: true }); navigator.share = () => Promise.reject(Object.assign(new Error('closed'), { name: 'AbortError' })); });
    await page.click(DLG + ' [data-role="share"]');
    await page.waitForTimeout(150);
    check((await page.evaluate(() => window.__copied)) === null, 'closing the share sheet changes nothing (no copy, no error)');
    await closeShare(page);

    // no Web Share at all: no Share button, and the copy button puts the text and the link on the clipboard
    await page.evaluate(() => { delete navigator.canShare; Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); });
    await page.click('#dlg-result [data-role="share"]');
    await page.waitForSelector(DLG + '[open] .sc__preview[data-ready="1"]');
    check(await page.locator(DLG + ' [data-role="share"]').isHidden(), 'without Web Share there is no Share button (the copy button is the way)');
    await page.click(DLG + ' [data-role="copy"]');
    const copied = await page.evaluate(() => window.__copied);
    check(copied && /GiveSpin round landed on/.test(copied) && /http:\/\/127\.0\.0\.1:\d+\/$/.test(copied) && /[0-9a-f]{8} · GS-/.test(copied), 'Copy link and text puts the text, the verify code and the address on the clipboard', copied);
    check((await page.locator('#toasts .toast').allInnerTexts()).some((t) => /copied to your clipboard/.test(t)), 'and says so');
    await closeShare(page);
    await closeReceipt(page);
    check(h.problems.length === problems0, 'section 24b: no console errors, warnings or failed requests', h.problems.slice(problems0, problems0 + 5));
    await page.close();

    // reduced motion: nothing in the dialog is animated
    const calm = await newPage({ reducedMotion: 'reduce' });
    await openApp(calm, '#game-wheel');
    await playRound(calm, 5);
    await openShare(calm);
    const anim = await calm.evaluate(() => ['.sc__img', '.sc__preview', '.sc__ctl', '.sc__act .btn'].map((s) => { const e = document.querySelector('#dlg-sharecard ' + s); const c = getComputedStyle(e); return s + ':' + c.animationName + ':' + c.transitionDuration; }));
    check(anim.every((x) => /:none:/.test(x)) && (await calm.evaluate(() => window.GS.util.reducedMotion())), 'with reduced motion the picture and the controls have no animation', anim);
    await calm.close();
  }

  /* ======================================================================== */
  if (h.section('24c. Share your profile: the same dialog, sizes and actions, for the profile card')) {
    const problems0 = h.problems.length;
    const page = await newPage();
    await openApp(page, '#lobby');
    // a ranked save with some history: three gifts to two charities
    await page.evaluate(() => {
      const st = window.GS.store.get();
      st.totalCents = 650000; st.xp = 65000; st.streak = 4; st.lastDay = window.GS.core.dayKey();
      st.history.unshift({ id: 'GS-AAAAAA', ts: Date.now(), game: 'wheel', totalCents: 4000, status: 'demo', pay: 'credit', rounds: 1, freq: 'once', allocations: [{ charityId: 'wateraid', cents: 4000 }] });
      st.history.unshift({ id: 'GS-BBBBBB', ts: Date.now(), game: 'wheel', totalCents: 1000, status: 'demo', pay: 'credit', rounds: 1, freq: 'once', allocations: [{ charityId: 'unicef', cents: 1000 }] });
      window.GS.bus.emit('progress');
    });
    check(await page.evaluate(() => !!(window.GS.ui.sharecard && typeof window.GS.ui.sharecard.openProfile === 'function')), 'ui.sharecard.openProfile exists for the profile page to call');
    await page.evaluate(() => window.GS.ui.sharecard.openProfile());
    await page.waitForSelector(DLG + '[open] .sc__preview[data-ready="1"]', { timeout: 20000 });
    check((await page.locator(DLG + ' .modal__title').innerText()) === 'Share your profile', 'it opens "Share your profile"');
    for (const [id, w, hh] of [['portrait', 1080, 1350], ['square', 1080, 1080]]) {
      await pickSize(page, id);
      const r = await look(page);
      check(r.w === w && r.h === hh && r.canvas[0] === w && r.canvas[1] === hh && r.colours > 25, id + ': the profile picture is ' + w + ' x ' + hh + ' and not blank', { w: r.w, h: r.h, colours: r.colours });
      check(r.last.kind === 'profile' && r.gold === 0 && /Rank 2 · Level \d+/.test(r.alt) && /\$6,500 given/.test(r.alt) && /Most given to: WaterAid/.test(r.alt) && /4 days in a row/.test(r.alt), id + ': the alt text has the standing, the total given, the charity given to most and the streak', r.alt);
    }
    const info = await page.evaluate(() => window.GS.ui.sharecard.last());
    check(/^My GiveSpin profile: Rank 2 · Level \d+, \$6,500 given \(play money\)\. Give it a spin:$/.test(info.text) && info.verify === '', 'the text is short, has no name (off) and the profile has no verify line', info.text);
    check(!info.alt.includes(await page.evaluate(() => window.GS.core.fmtMoney(window.GS.store.balance(), true) + ' left')), 'and no balance');
    // the name switch works here too
    await page.evaluate(() => window.GS.local.set('profile', { name: 'Ada', frame: '', title: '' }));
    await closeShare(page);
    await page.evaluate(() => window.GS.ui.sharecard.openProfile());
    await page.waitForSelector(DLG + '[open] .sc__preview[data-ready="1"]');
    check(!(await page.evaluate(() => document.querySelector('#dlg-sharecard [data-role="show-name"]').checked)), 'the name switch starts off for the profile too');
    await page.click(DLG + ' .sc__name');
    await page.waitForFunction(() => window.GS.ui.sharecard.last().nameShown);
    const named = await page.evaluate(() => window.GS.ui.sharecard.last());
    check(named.name === 'Ada' && /^Ada’s GiveSpin profile/.test(named.text) && /Ada/.test(named.alt), 'switched on, the name is on the profile card, in its text and in its alt text', named.text);
    // Download and Web Share work here too
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click(DLG + ' [data-role="download"]')]);
    check(/^givespin-profile-(portrait|square)\.png$/.test(dl.suggestedFilename()) && fs.statSync(await dl.path()).size > 20000, 'Download saves givespin-profile-….png', dl.suggestedFilename());
    await page.click(DLG + ' .sc__name');
    await page.waitForFunction(() => !window.GS.ui.sharecard.last().nameShown);
    await a11y(page, 'the profile share dialog (laptop)');
    await closeShare(page);
    // a visitor with no rank yet and no gifts: the XP level on the card, never an empty ring
    const fresh = await newPage();
    await openApp(fresh, '#lobby');
    await fresh.evaluate(() => window.GS.ui.sharecard.openProfile());
    await fresh.waitForSelector(DLG + '[open] .sc__preview[data-ready="1"]');
    const f = await look(fresh);
    check(/Level 1/.test(f.alt) && !/Rank/.test(f.alt) && /\$0 given/.test(f.alt) && f.colours > 15, 'with no rank yet the card shows the XP level (Level 1) and $0 given', f.alt);
    // it also works when asked from a ranked player on a phone (the profile page's Share my profile button calls exactly this)
    await fresh.close();
    check(h.problems.length === problems0, 'section 24c: no console errors, warnings or failed requests', h.problems.slice(problems0, problems0 + 5));
    await page.close();
    const ph = await newPage({ viewport: { width: 390, height: 844 }, mobile: true });
    await openApp(ph, '#lobby');
    await ph.evaluate(() => { const st = window.GS.store.get(); st.totalCents = 650000; st.xp = 65000; window.GS.ui.sharecard.openProfile(); });
    await ph.waitForSelector(DLG + '[open] .sc__preview[data-ready="1"]');
    await a11y(ph, 'the profile share dialog (phone)');
    await ph.close();
  }

  /* ======================================================================== */
  if (h.section('24d. Verify on every receipt: a shortcut to the fair-play details')) {
    const problems0 = h.problems.length;
    const page = await newPage({ viewport: { width: 390, height: 700 }, mobile: true });
    await openApp(page, '#game-wheel');
    await playRound(page, 5);
    const jump = page.locator('#dlg-result [data-role="verify-jump"]');
    check(await jump.isVisible() && /Verify/.test(await jump.innerText()), 'the receipt has a visible "Verify" button');
    check(await page.evaluate(() => !document.querySelector('#dlg-result details.rs-fair').open), 'the fair-play details start closed, as before');
    await jump.click();
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
      const d = document.querySelector('#dlg-result details.rs-fair');
      const b = d.getBoundingClientRect();
      const act = document.querySelector('#dlg-result .rs-actions').getBoundingClientRect();
      return { open: d.open, top: Math.round(b.top), bottom: Math.round(b.bottom), actTop: Math.round(act.top), vh: window.innerHeight, focus: document.activeElement && document.activeElement.getAttribute('data-role') };
    });
    check(r.open && r.top >= 0 && r.top < r.vh && r.focus === 'verify', 'it opens the details, scrolls them into view and puts the keyboard on their "Verify this round" button', r);
    await page.keyboard.press('Enter');
    await page.waitForSelector('#dlg-result .vfy li');
    check(await page.locator('#dlg-result .vfy li.is-ok').count() === 3, 'and Enter there verifies the round (three ticks)');
    // the details still work the old way too
    await closeReceipt(page);
    await playRound(page, 5);
    await page.click('#dlg-result .rs-fair > summary');
    await page.click('#dlg-result [data-role="verify"]');
    await page.waitForSelector('#dlg-result .vfy li');
    check(await page.locator('#dlg-result .vfy li.is-ok').count() === 3, 'the existing details and Verify this round button still work');
    await a11y(page, 'a receipt with the Verify shortcut (phone)');
    await closeReceipt(page);
    // a direct gift has no draw, so no Verify shortcut and no fair-play box
    await go(page, '#charity-wateraid');
    await page.waitForSelector('#dlg-profile[open]');
    await page.click('#dlg-profile [data-role="give"]');
    await page.waitForSelector('#dlg-direct[open]');
    await page.click('#dlg-direct .preset[data-amt="10"]');
    await page.click('#dlg-direct [data-role="go"]');
    await waitReceipt(page);
    check(await page.locator('#dlg-result [data-role="verify-jump"]').count() === 0, 'a direct gift has no draw, so no Verify shortcut');
    await page.click('#dlg-result [data-role="share"]');
    await page.waitForSelector(DLG + '[open] .sc__preview[data-ready="1"]');
    const dg = await page.evaluate(() => window.GS.ui.sharecard.last());
    check(dg.verify === '' && /Direct gift/.test(dg.alt) && !/Verify this round/.test(dg.alt), 'and its share card has no verify line (it never claims a check it cannot back up)', dg.alt);
    await closeShare(page);
    await closeReceipt(page);
    // without the crypto API: no fair-play details, no Verify shortcut, no verify line on the card, and the card still works
    const nc = await newPage();
    await nc.addInitScript(() => { Object.defineProperty(window.crypto, 'subtle', { value: undefined, configurable: true }); });
    await openApp(nc, '#game-wheel');
    await nc.click('#btn-play');
    await waitReceipt(nc);
    await nc.evaluate(() => window.GS.confetti.clear());
    check(await nc.locator('#dlg-result [data-role="verify-jump"]').count() === 0 && await nc.locator('#dlg-result .rs-fair').count() === 0, 'without crypto.subtle the receipt has no Verify shortcut and no fair-play claim');
    await openShare(nc);
    const ncl = await nc.evaluate(() => window.GS.ui.sharecard.last());
    check(ncl.verify === '' && ncl.w === 1080 && !/Verify this round/.test(ncl.text + ncl.alt), 'and the card has no verify line but still draws', ncl);
    await nc.close();
    // a live table's result card has the shortcut too
    const live = await newPage();
    await openApp(live, '#live-derby');
    const staked = await live.evaluate(async () => {
      const room = window.GS.live.room('derby');
      const until = (fn, ms) => new Promise((res) => { const t0 = Date.now(); (function w() { if (fn()) { res(true); } else if (Date.now() - t0 > ms) { res(false); } else { setTimeout(w, 15); } })(); });
      for (let i = 0; i < 8; i++) {
        await until(() => room.phase === 'open' && room.msLeft() > Math.min(900, room.phaseMs * 0.4), 45000);
        if (room.join(room.field()[0].charity.id, 20).ok) { return true; }
      }
      return false;
    });
    check(staked, 'a $20 stake goes onto a live table (to get a live result)');
    // (the table clears its result a few seconds later, so its own timer is stopped in the turn that sees the result)
    const seen = await live.waitForFunction(() => { const room = window.GS.live.room('derby'); if (!(room.phase === 'result' && room.result && room.result.you && document.querySelector('#lt-result .lt-res'))) { return null; } room._clearTimers(); return true; }, null, { timeout: 90000, polling: 100 }).then(() => true, () => false);
    check(seen, 'the live result is on screen');
    const ljump = live.locator('#lt-result [data-role="verify-jump"]');
    check(await ljump.count() === 1 && await ljump.isVisible(), 'the live result has the Verify shortcut too');
    await ljump.click();
    await live.waitForTimeout(300);
    const lr = await live.evaluate(() => ({ open: document.querySelector('#lt-result details.rs-fair').open, focus: document.activeElement && document.activeElement.getAttribute('data-role') }));
    check(lr.open && lr.focus === 'verify', 'it opens the live round\'s fair-play details and puts the keyboard on their Verify button', lr);
    await live.keyboard.press('Enter');
    await live.waitForSelector('#lt-result .vfy li');
    check(await live.locator('#lt-result .vfy li.is-ok').count() === 3, 'and Enter verifies the live round (hash, pot and winner)');
    await live.close();
    check(h.problems.length === problems0, 'section 24d: no console errors, warnings or failed requests', h.problems.slice(problems0, problems0 + 5));
    await page.close();
  }

  /* ======================================================================== */
  if (h.section('24e. Fair play showcase: the lobby block and the checker (a sample round with the real GS.fair code)')) {
    const problems0 = h.problems.length;
    for (const [name, vp, mobile] of [['a laptop', { width: 1366, height: 768 }, false], ['a phone', { width: 390, height: 844 }, true]]) {
      const page = await newPage({ viewport: vp, mobile });
      await openApp(page, '#lobby');
      const b = await page.evaluate(() => {
        const blk = document.querySelector('#view-lobby [data-block="fair"]');
        const promos = document.querySelector('#view-lobby .promos').getBoundingClientRect();
        const r = blk ? blk.getBoundingClientRect() : null;
        const tiles = document.querySelector('#view-lobby [data-role="tiles"]').getBoundingClientRect();
        const cause = document.querySelector('#view-lobby #lb-causes').getBoundingClientRect();
        const strip = document.querySelector('#view-lobby [data-role="livestrip"]');
        return blk ? { top: Math.round(r.top + scrollY), promosBottom: Math.round(promos.bottom + scrollY), tilesTop: Math.round(tiles.top + scrollY), tilesBottom: Math.round(tiles.bottom + scrollY), causeTop: Math.round(cause.top + scrollY), h: Math.round(r.height), text: blk.innerText, heading: (blk.querySelector('h2') || {}).textContent, sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, order: Array.from(document.querySelectorAll('#view-lobby [data-role="blocks"] > [data-block]')).map((e) => e.getAttribute('data-block')) } : null;
      });
      check(!!b && b.top >= b.promosBottom && b.top >= b.tilesBottom - 1 && b.top < b.causeTop, 'on ' + name + ' the fair-play block sits under the game tiles (the games come first) and above "Pick a cause first"', b && { top: b.top, promosBottom: b.promosBottom, tilesTop: b.tilesTop, tilesBottom: b.tilesBottom, causeTop: b.causeTop });
      check(!!b && /can be checked/i.test(b.heading) && /Try it yourself/.test(b.heading) && /Try the checker/.test(b.text) && /How Fair Play works/.test(b.text), 'on ' + name + ' it has the heading, the "Try the checker" button and the link to Fair Play', b && b.text.slice(0, 200));
      check(!!b && /made on your own device/.test(b.text) && /not an outside audit/.test(b.text) && !/provably/i.test(b.text), 'on ' + name + ' it is honest about the demo (the secret is made on your own device, not an outside audit)', b && b.text.slice(0, 400));
      check(!!b && !b.sideways && b.h < (vp.width < 600 ? 290 : 200), 'on ' + name + ' it is compact (' + (b && b.h) + ' px tall) and nothing scrolls sideways', b && b.h);
      if (name === 'a laptop') { check(b.order.indexOf('fair') >= 0, 'the block is registered with ui.lobby.addBlock (id fair)', b.order); }

      await page.click('#view-lobby [data-block="fair"] [data-role="try"]');
      await page.waitForSelector('#dlg-fairdemo[open] [data-step="3"]');
      const d0 = await page.evaluate(() => { const d = document.querySelector('#dlg-fairdemo'); return { text: d.innerText, hash: d.querySelector('[data-role="hash"]').textContent, steps: Array.from(d.querySelectorAll('.fsd__step h3')).map((e) => e.textContent.trim()), board: d.querySelectorAll('[data-role="board"] li').length, secret: !!d.querySelector('[data-role="secret"]'), win: d.querySelectorAll('.is-win').length, checkOff: d.querySelector('[data-role="check"]').disabled, tamperOff: d.querySelector('[data-role="tamper"]').disabled }; });
      check(/A sample round, not one of yours/.test(d0.text) && /Sample/.test(d0.text), 'on ' + name + ' the checker says plainly that it is a sample round, not one of yours');
      check(d0.steps.length === 3 && d0.steps[0].endsWith('Sealed first') && d0.steps[1].endsWith('Drawn') && d0.steps[2].endsWith('Check it yourself'), 'on ' + name + ' it has the three steps: Sealed first, Drawn, Check it yourself', d0.steps);
      check(/^[0-9a-f]{64}$/.test(d0.hash) && d0.board === 8 && !d0.secret && d0.win === 0 && d0.checkOff && d0.tamperOff, 'on ' + name + ' step 1 already shows the fingerprint (64 hex), the secret is still sealed, the board has 8 charities and no winner yet', d0);
      if (name === 'a phone') { await a11y(page, 'the checker dialog before the draw (phone)'); }
      await page.click('#dlg-fairdemo [data-role="draw"]');
      await page.waitForSelector('#dlg-fairdemo [data-role="secret"]');
      const d1 = await page.evaluate(async () => {
        const d = document.querySelector('#dlg-fairdemo');
        const secret = d.querySelector('[data-role="secret"]').textContent;
        const hash = d.querySelector('[data-role="hash"]').textContent;
        const winners = Array.from(d.querySelectorAll('.is-win'));
        const ids = Array.from(d.querySelectorAll('[data-role="board"] li')).map((li) => li.getAttribute('data-id'));
        const names = Array.from(d.querySelectorAll('[data-role="board"] li .fsd__nm')).map((e) => e.textContent);
        const real = names.every((n) => window.GS.charities.some((c) => c.name === n));
        // the same draw, redone here with the real code
        const idx = await window.GS.fair.drawIndices(secret, 'sample', 0, ids.length, 1);
        return { secret, hash, sha: await window.GS.fair.sha256Hex(secret), winners: winners.length, winnerId: winners[0] && winners[0].getAttribute('data-id'), want: ids[idx[0]], sorted: JSON.stringify(ids) === JSON.stringify(ids.slice().sort()), real, tag: winners[0] && winners[0].innerText, focus: document.activeElement && document.activeElement.getAttribute('data-role'), drawn: d.querySelector('[data-role="drawn"]').innerText, checkOn: !d.querySelector('[data-role="check"]').disabled };
      });
      check(/^[0-9a-f]{64}$/.test(d1.secret) && d1.sha === d1.hash, 'on ' + name + ' step 2 reveals the secret and hashing it gives the fingerprint shown first', { sha: d1.sha, hash: d1.hash });
      check(d1.winners === 1 && d1.winnerId === d1.want && /Winner/.test(d1.tag) && d1.sorted && d1.real, 'on ' + name + ' exactly one charity is marked Winner (in words, not only colour), it is the one the real draw maths picks, from a board of real roster charities', d1);
      check(/pick #\d of 8/.test(d1.drawn) && d1.checkOn && d1.focus === 'check', 'on ' + name + ' it says which pick the maths landed on, and the keyboard moves on to "Check it"', d1);
      await page.click('#dlg-fairdemo [data-role="check"]');
      await page.waitForSelector('#dlg-fairdemo .vfy li');
      check(await page.locator('#dlg-fairdemo .vfy li.is-ok').count() === 3 && await page.locator('#dlg-fairdemo .vfy li.is-bad').count() === 0, 'on ' + name + ' "Check it" shows three ticks: nothing was changed, so everything matches');
      await page.click('#dlg-fairdemo [data-role="tamper"]');
      await page.waitForFunction(() => document.querySelectorAll('#dlg-fairdemo .vfy li.is-bad').length > 0);
      const t = await page.evaluate(() => { const d = document.querySelector('#dlg-fairdemo'); return { bad: d.querySelectorAll('.vfy li.is-bad').length, hashBad: /does NOT match/.test(d.querySelector('.vfy li.is-bad').innerText), mark: (d.querySelector('.fsd__checked mark') || {}).textContent, out: d.querySelector('[data-role="out"]').innerText, live: d.querySelector('[data-role="out"]').getAttribute('aria-live') }; });
      check(t.bad >= 1 && t.hashBad && t.mark && /One character changed/.test(t.out), 'on ' + name + ' "Tamper with it" changes one character (shown highlighted) and the check fails: the secret no longer matches the fingerprint', t);
      check(t.live === 'polite', 'on ' + name + ' the result is announced politely, and only after a button press');
      await page.click('#dlg-fairdemo [data-role="check"]');
      await page.waitForFunction(() => document.querySelectorAll('#dlg-fairdemo .vfy li.is-ok').length === 3);
      check(true, 'on ' + name + ' pressing "Check it" again passes again (the real secret was never touched)');
      if (name === 'a laptop') { await a11y(page, 'the checker dialog after the draw (laptop)'); }
      await page.click('#dlg-fairdemo [data-role="again"]');
      await page.waitForFunction((old) => document.querySelector('#dlg-fairdemo [data-role="hash"]').textContent !== old, d0.hash);
      check(await page.evaluate(() => !document.querySelector('#dlg-fairdemo [data-role="secret"]') && document.querySelectorAll('#dlg-fairdemo .is-win').length === 0), 'on ' + name + ' "New sample round" seals a new secret (a new fingerprint, nothing drawn yet)');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('#dlg-fairdemo').open);
      check(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-role') === 'try'), 'on ' + name + ' closing it puts the focus back on "Try the checker"');
      await page.close();
    }

    // a 320 px phone: the block and the dialog do not scroll sideways
    const tiny = await newPage({ viewport: { width: 320, height: 568 }, mobile: true });
    await openApp(tiny, '#lobby');
    await tiny.click('#view-lobby [data-block="fair"] [data-role="try"]');
    await tiny.waitForSelector('#dlg-fairdemo[open] [data-step="3"]');
    await tiny.click('#dlg-fairdemo [data-role="draw"]');
    await tiny.waitForSelector('#dlg-fairdemo [data-role="secret"]');
    const sw = await tiny.evaluate(() => ({ page: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, dlg: document.querySelector('#dlg-fairdemo .modal__body').scrollWidth > document.querySelector('#dlg-fairdemo .modal__body').clientWidth + 1 }));
    check(!sw.page && !sw.dlg, 'on a 320 px phone the checker does not scroll sideways', sw);
    await tiny.close();

    // without crypto.subtle (the same way section 13a2 removes it): honest, not broken
    const nc = await newPage();
    await nc.addInitScript(() => { Object.defineProperty(window.crypto, 'subtle', { value: undefined, configurable: true }); });
    await openApp(nc, '#lobby');
    check(await nc.evaluate(() => window.GS.fair.available()) === false, 'test setup: no crypto.subtle');
    const note = await nc.locator('#view-lobby [data-block="fair"] [data-role="nosecure"]').innerText();
    check(/cannot run the checker/.test(note), 'the lobby block says the checker cannot run here', note);
    await nc.click('#view-lobby [data-block="fair"] [data-role="try"]');
    await nc.waitForSelector('#dlg-fairdemo[open]');
    const off = await nc.evaluate(() => { const d = document.querySelector('#dlg-fairdemo'); return { text: d.innerText, steps: d.querySelectorAll('.fsd__step').length, draw: !!d.querySelector('[data-role="draw"]') }; });
    check(/not available here/i.test(off.text) && /secure page/.test(off.text) && /make no fair-play claim/.test(off.text) && off.steps === 0 && !off.draw, 'the checker says "not available here", why, and shows no steps to pretend', off.text);
    await a11y(nc, 'the checker dialog without crypto.subtle');
    await nc.click('#dlg-fairdemo [data-role="close"]');
    await nc.waitForFunction(() => !document.querySelector('#dlg-fairdemo').open);
    await nc.close();

    check(h.problems.length === problems0, 'section 24e: no console errors, warnings or failed requests', h.problems.slice(problems0, problems0 + 5));
  }
}
