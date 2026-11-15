// The brand voice (docs/voice.md): "a gambling website, but it is for charity". These checks pin the vocabulary and, just as much, the honesty
// underneath it: nothing says or implies real money moved in demo mode, "cash out" is nowhere, the jackpot is a Triple Threat, and the
// "How we make money: we do not" answer is reachable and true. (The crypto-wording and no-superlative checks are 13q and run on every page.)
import fs from 'node:fs';
import path from 'node:path';

const CASH = /\bcash(?:ed|ing)?[\s-]*out\b/i;
const JACKPOT = /\bjackpots?\b/i;
// words that would say a visitor is paid, or that real money moved, or that the other players are real
const MONEY = /\bwinnings\b|\bpayouts?\b|\byou (?:won|win|earned|received) \$|\breal players?\b|\bwithdraw|\bcash prize\b/i;
const HOUSE = /House edge: 0%\. The house is a charity\./;

// every source file a visitor can read from (the pages are built from these)
function sources(root) {
  const out = [path.join(root, 'index.html')];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const f = path.join(d, e.name);
    if (e.isDirectory()) { walk(f); } else if (e.name.endsWith('.js')) { out.push(f); }
  });
  walk(path.join(root, 'js'));
  return out;
}

export default async function (h) {
  const { check, section, go, openApp, newPage, waitReceipt, closeReceipt, setAmount, a11y, problems } = h;
  const problems0 = problems.length;
  const text = (page, sel) => page.locator(sel).innerText();
  const flat = (s) => String(s).replace(/\s+/g, ' ');

  /* ---------------------------------------------------------------------------------------------------------------- */
  if (section('22a. House edge: 0%. The house is a charity. (lobby, Fair Play, Help, a game) and the footer')) {
    const page = await newPage();
    await openApp(page, '#lobby');
    const lobby = flat(await text(page, '#view-lobby'));
    check(HOUSE.test(lobby) && /How we make money: we do not\./.test(lobby), 'the lobby has the house-edge strip, with the honest follow-up one tap away', lobby.slice(0, 300));
    check(await page.locator('#view-lobby .housestrip a[href="#help-money"]').count() === 1, 'the strip links to "How we make money"');
    await go(page, '#fair');
    check(HOUSE.test(flat(await text(page, '#view-fair'))), 'Fair Play has the house-edge strip');
    await go(page, '#help');
    check(HOUSE.test(flat(await text(page, '#view-help'))), 'Help has the house-edge strip');
    await a11y(page, 'Help with the house-edge strip');
    await go(page, '#game-wheel');
    await page.click('#tab-about');
    const about = flat(await page.locator('#view-game').textContent());
    check(/House edge: 0%\. The house is a charity\./.test(about), 'a game\'s About tab carries it too');
    // the footer: Responsible giving corner and the link to "How we make money"
    const foot = flat(await page.locator('footer.foot').textContent());
    check(/Responsible giving\./.test(foot) && /Giving should feel good/.test(foot) && /monthly giving limit/.test(foot) && !/Give responsibly/i.test(foot), 'the footer says "Responsible giving" (kind, short, where to set the limit), not "Give responsibly"', foot.slice(0, 260));
    check(/equal odds/.test(foot) && /weigh each charity by what is in the pot/.test(foot), 'and still says every solo game has equal odds and live tables weigh by the pot (the claim is kept)');
    check(await page.locator('footer.foot a[href="#help-limit"]').count() === 1, 'the footer links to the Responsible giving answer');
    check(await page.locator('footer.foot .foot__links a[href="#help-money"]').count() === 1 && /How we make money/.test(await text(page, 'footer.foot .foot__links')), 'the footer links to "How we make money"');
    await page.close();
  }

  /* ---------------------------------------------------------------------------------------------------------------- */
  if (section('22b. How we make money: we do not (footer, Help, the tour) and that it is true')) {
    const page = await newPage();
    await openApp(page, '#lobby');
    await page.click('footer.foot .foot__links a[href="#help-money"]');
    await h.onRoute(page, 'help');
    await page.waitForTimeout(200);
    const open = await page.locator('#help-money').evaluate((d) => d.open);
    check(open, 'the footer link opens the answer in Help');
    const q = await text(page, '#help-money summary');
    const a = flat(await text(page, '#help-money .faq__a'));
    check(/How we make money: we do not\./.test(q), 'the question is "How we make money: we do not."', q);
    check(/We do not\./.test(a) && /play-money preview/.test(a) && /demo credit is free/.test(a) && /no real money moves/.test(a) && /nobody is paid/.test(a), 'in demo mode it says it plainly: a play-money preview, free demo credit, no real money moves, nobody is paid', a);
    check(/checkout page/.test(a) && /never sees your card/.test(a) && /never holds the money/.test(a) && /adds no fee of its own/.test(a) && /Going live/.test(a), 'and says what the code does if real giving is switched on: the gift goes through the payment provider\'s checkout, GiveSpin never sees the card or holds the money, adds no fee (README "Going live")', a);
    check(!/\bwill (?:never|always)\b|\bforever\b|\bpromise\b|\bguarantee/i.test(a), 'and promises nothing about a future business');
    await a11y(page, 'Help with How we make money open');
    // from the lobby strip
    await go(page, '#lobby');
    await page.click('#view-lobby .housestrip a[href="#help-money"]');
    await h.onRoute(page, 'help');
    await page.waitForTimeout(200);
    check(await page.locator('#help-money').evaluate((d) => d.open), 'the lobby strip link opens it too');
    await page.close();

    // the tour mentions it on the last card, and "it is play-money" stays prominent on the first
    const tp = await newPage({ tour: true });
    await openApp(tp);
    await tp.waitForSelector('#tour:not([hidden])', { timeout: 6000 });
    const welcome = flat(await text(tp, '#tour .tour__card'));
    check(/everything here is fake/i.test(welcome) && /credit is pretend/i.test(welcome) && /not a betting site/i.test(welcome) && /House edge: 0%/.test(welcome), 'the tour\'s first card still says everything is fake, and adds the house edge', welcome.slice(0, 400));
    const cards = [welcome];
    while (await tp.locator('#tour [data-tour="next"]').count()) {
      await tp.click('#tour [data-tour="next"]');
      await tp.waitForTimeout(100);
      cards.push(flat(await text(tp, '#tour .tour__card')));
    }
    check(/how we make money: we do not/i.test(cards[cards.length - 1]), 'the last tour card mentions how we make money', cards[cards.length - 1]);
    check(cards.length === 9 && cards.every((c) => !CASH.test(c)), 'nine tour cards, and none says "cash out"', cards.length);
    check(cards.some((c) => /give it out/i.test(c)), 'the credit card says credit only goes one way, out, when you give it out');
    check(cards.some((c) => /VIP lounge/.test(c)) && cards.some((c) => /Responsible giving/.test(c)), 'the tour names the VIP lounge and Responsible giving');
    await tp.close();

    // in real-donation (redirect) mode the answer is the other branch: it does not call itself a play-money preview
    const rp = await newPage();
    await rp.route('**/js/config.js', async (route) => {
      let src = fs.readFileSync(path.join(h.root, 'js/config.js'), 'utf8');
      src = src.replace("mode: 'demo'", "mode: 'redirect'");
      await route.fulfill({ status: 200, contentType: 'text/javascript', body: src });
    });
    await openApp(rp, '#help-money');
    const ra = flat(await text(rp, '#help-money .faq__a'));
    check(await rp.locator('html').getAttribute('data-mode') === 'redirect' && /We do not\./.test(ra) && /checkout page/.test(ra) && /never sees your card/.test(ra) && !/play-money|demo credit/i.test(ra), 'in redirect mode the answer is about the checkout page and does not say play-money', ra);
    await rp.close();
  }

  /* ---------------------------------------------------------------------------------------------------------------- */
  if (section('22c. "Give out", never "cash out"; and no word that implies winnings or real money moved')) {
    // the source: nothing a visitor can read, in any file, says cash out (code comments included, so a search finds nothing)
    const bad = [];
    sources(h.root).forEach((f) => { if (CASH.test(fs.readFileSync(f, 'utf8'))) { bad.push(path.relative(h.root, f)); } });
    check(bad.length === 0, 'no source file (index.html, js/) says cash out, cashed out or cashing out', bad);
    const page = await newPage();
    await openApp(page, '#lobby');
    // every page, as it reads on screen
    const routes = ['#lobby', '#live', '#leagues', '#crews', '#cards', '#giving', '#charities', '#club', '#fair', '#help', '#me', '#quests', '#boards', '#spotlights', '#make-it-real', '#game-wheel', '#game-slots', '#game-scratch'];
    const cash = [], money = [], jp = [];
    for (const r of routes) {
      await go(page, r);
      await page.waitForTimeout(120);
      const t = flat(await page.locator('#main').textContent());
      if (CASH.test(t)) { cash.push(r); }
      if (MONEY.test(t)) { money.push(r + ': ' + (t.match(MONEY) || [''])[0]); }
      if (JACKPOT.test(t)) { jp.push(r); }
    }
    check(cash.length === 0, 'no page says "cash out"', cash);
    check(money.length === 0, 'no page says winnings, payout, "you won $", real players or withdraw', money);
    check(jp.length === 0, 'no page uses the word "jackpot" (it is a Triple Threat)', jp);
    // the dialogs
    await go(page, '#lobby');
    await page.click('#btn-credit');
    await page.waitForSelector('#dlg-credit[open]');
    const credit = flat(await page.locator('#dlg-credit').textContent());
    check(!CASH.test(credit) && /only goes one way, out, when you give it out/.test(credit) && /not real money/.test(credit), 'the Add credit dialog says it is not real money and it only goes out when you give it out', credit.slice(0, 300));
    await page.keyboard.press('Escape');
    await page.click('#btn-daily');
    await page.waitForSelector('#dlg-daily[open]');
    await page.click('#dlg-daily [data-role="spin"]');
    await page.waitForFunction(() => !window.GS.store.dailyAvailable(), null, { timeout: 15000 });
    const daily = flat(await page.locator('#dlg-daily [data-role="msg"]').textContent());
    check(/free demo credit/.test(daily) && !MONEY.test(daily) && !/You won/.test(daily), 'the daily wheel result says free demo credit, never "You won $"', daily);
    await page.keyboard.press('Escape');
    // Help in full
    await go(page, '#help');
    await page.evaluate(() => Array.prototype.forEach.call(document.querySelectorAll('#view-help details'), (d) => { d.open = true; }));
    const help = flat(await page.locator('#view-help').textContent());
    check(!CASH.test(help) && !JACKPOT.test(help) && !MONEY.test(help), 'every Help answer, opened: no cash out, no jackpot, no winnings');
    check(/Triple Threat pot/.test(help) && /a Triple Threat, a finished card set/.test(help) && /only thing you can do is give out/.test(help), 'Help says Triple Threat pot (live tables), Triple Threat (XP bonus) and "give out"');
    await page.close();
  }

  /* ---------------------------------------------------------------------------------------------------------------- */
  if (section('22d. Triple Threat: the live-table pot, the slot receipt, and nothing called a jackpot')) {
    const page = await newPage();
    await openApp(page, '#live', '');
    await page.evaluate(() => { window.GS.live.setEvent(null); window.GS.live.setJackpot(700); });
    await page.waitForSelector('#view-live .jpmeter');
    const lv = flat(await text(page, '#view-live'));
    check(/Triple Threat pot/.test(lv) && /simulated/.test(lv) && !JACKPOT.test(lv), 'the live-tables page names the rolling pot "Triple Threat pot" (simulated)', lv.slice(0, 300));
    check(/Triple Threat pot is \d+% of the way to dropping/.test(await page.locator('#view-live .jpmeter__bar').getAttribute('aria-label')), 'its meter says so for a screen reader');
    // a full pot drops at the next table: the chip, as the table shows it
    await go(page, '#live-derby');
    await page.evaluate(() => { window.GS.live.setJackpot(1600); window.GS.live.room('derby').openRound(0); });
    await page.waitForSelector('#livepanel .chip-ev--jackpot', { timeout: 15000 }).catch(() => {});
    const chip = flat(await page.locator('#livepanel .chip-ev--jackpot').innerText().catch(() => ''));
    check(/Triple Threat pot drops here: \+\$1,?600/.test(chip) && /simulated/.test(chip), 'a table that gets the pot says "Triple Threat pot drops here" (simulated)', chip);
    // a Triple Threat on a slot machine, on the receipt
    await go(page, '#game-sweets');
    await setAmount(page, 30);
    await page.click('#rounds-seg [data-reels="6"]');
    await page.evaluate(() => { window.__oldDraw = window.GS.fair.drawIndices; window.GS.fair.drawIndices = async (a, b, c, n, count) => [0, 0, 0, 1, 2, 3].slice(0, count); });
    await page.click('#btn-play');
    await waitReceipt(page);
    const rc = flat(await text(page, '#dlg-result'));
    check(/TRIPLE THREAT/.test(rc) && /Triple Threat/i.test(await text(page, '#dlg-result .jackpot-tag')) && !JACKPOT.test(rc), 'the receipt says Triple Threat and nothing says jackpot', rc.slice(0, 200));
    await page.evaluate(() => { window.GS.fair.drawIndices = window.__oldDraw; });
    await closeReceipt(page);
    await page.close();
  }

  /* ---------------------------------------------------------------------------------------------------------------- */
  if (section('22e. A demo receipt: the house line, still stamped DEMO, no money moved; the sending step has a loading line; an error is honest')) {
    const page = await newPage();
    await openApp(page, '#game-wheel');
    const bal0 = await h.balance(page);
    await page.click('#btn-play');
    const sendingHandle = await page.waitForFunction(() => { const e = document.querySelector('#dlg-result .rs-sending'); return e ? e.innerText : false; }, null, { polling: 'raf', timeout: 60000 }).catch(() => null);
    const sending = sendingHandle ? flat(await sendingHandle.jsonValue()) : '';
    await waitReceipt(page);
    const rc = flat(await text(page, '#dlg-result'));
    check(/Sending your demo gift/.test(sending) && /nothing is charged/i.test(sending) && ['Shuffling the charities…', 'Polishing the confetti…', 'Warming up the tables…'].some((l) => sending.includes(l)), 'the sending step still says "Sending your demo gift", that nothing is charged, and has a loading line', sending);
    check(/The house wins: the house is a charity\./.test(rc), 'the receipt has the house line');
    check(/Simulated round: no money moved and nothing was charged\./.test(rc) && await page.locator('#dlg-result .stamp').innerText() === 'DEMO' && /Demo mode\. This receipt is not a tax document\./.test(rc), 'and is still stamped DEMO, says no money moved and nothing was charged, and is not a tax document');
    check(!MONEY.test(rc) && !CASH.test(rc) && !JACKPOT.test(rc) && !/\b(?:you donated|donation (?:made|sent|received)|has been (?:sent|donated))\b/i.test(rc), 'it implies no winnings, no payout and no real donation', rc.slice(0, 200));
    check(await h.balance(page) === bal0 - 2500, 'the gift came off the demo credit, in pretend dollars ($25)', await h.balance(page));
    await a11y(page, 'receipt with the house line');
    await closeReceipt(page);
    // a failed payment: honest, and nothing charged
    await page.evaluate(() => { window.__oldProcess = window.GS.payments.process; window.GS.payments.process = () => Promise.reject(new Error('boom')); });
    const before = await h.balance(page);
    await page.click('#btn-play');
    await page.waitForFunction(() => Array.from(document.querySelectorAll('#toasts .toast')).some((t) => /Something went wrong/.test(t.textContent)), null, { timeout: 60000 });
    const toasts = (await h.toastText(page)).map(flat);
    check(toasts.some((t) => /Something went wrong\. Nothing was charged\./.test(t)) && await h.balance(page) === before && !(await h.receiptOpen(page)), 'an error says "Something went wrong. Nothing was charged." and nothing was', toasts);
    await page.evaluate(() => { window.GS.payments.process = window.__oldProcess; });
    // (the app logs the failure to the console on purpose; that one deliberate error is not a problem)
    for (let i = problems.length - 1; i >= problems0; i--) { if (/Error: boom/.test(problems[i])) { problems.splice(i, 1); } }
    await page.close();
  }

  /* ---------------------------------------------------------------------------------------------------------------- */
  if (section('22f. Empty states with personality (and still a next step)')) {
    const page = await newPage();
    await openApp(page, '#lobby');
    const lobby = flat(await text(page, '#view-lobby [data-role="recent"]'));
    check(/No rounds yet\. The tables are warm/.test(lobby), 'the lobby\'s empty "latest rounds"', lobby);
    await go(page, '#giving');
    const giving = flat(await text(page, '#view-giving'));
    check(/No gifts yet/.test(giving) && /The house is waiting, and the house is a charity/.test(giving) && await page.locator('#view-giving .emptycard a[href="#game-wheel"]').count() === 1, 'My Giving: "No gifts yet", the house is waiting, and a button to the first round', giving.slice(0, 300));
    check(/No rounds yet\. Play your first round/.test(giving), 'and its history says "No rounds yet" with a link to play (one joke per page: the house line is only on "No gifts yet")');
    check(/No repeat gifts yet/.test(giving) && /Your giving by cause will appear here/.test(giving), 'and the repeat gifts and the cause bars say what is missing');
    await go(page, '#cards');
    check(/No cards yet\./.test(await text(page, '#view-cards')) && /the house deals you the charity that wins/.test(flat(await text(page, '#view-cards'))), 'Your cards: "No cards yet", the house deals you the winner');
    await go(page, '#crews');
    check(/No crew yet\. Every table needs a few friends/.test(flat(await text(page, '#view-crews'))) && await page.locator('#view-crews [data-crew-join]').count() > 0, 'Crews: "No crew yet", and the crews to join');
    await go(page, '#leagues');
    check(/Nothing yet: give a little and take a seat\./.test(flat(await text(page, '#view-leagues'))), 'Leagues: with no XP yet it says to give a little and take a seat');
    await go(page, '#charities');
    await page.fill('#view-charities input[type="search"]', 'zzzzqqqq');
    await page.waitForTimeout(400);
    check(/No charities match at this table\. Try a different search/.test(flat(await text(page, '#view-charities .empty'))), 'Charities: a search with no match');
    // the search box
    await page.fill('#search-input', 'zzzzqqqq');
    await page.waitForSelector('#search-list .search__none');
    check(/Nothing matches “zzzzqqqq”\. Not even the house has that\./.test(await text(page, '#search-list')), 'the top search: "Nothing matches ... Not even the house has that."');
    await page.fill('#search-input', '');
    // a game with no rounds yet
    await go(page, '#game-dice');
    await page.click('#tab-rounds');
    const rounds = flat(await page.locator('#view-game').textContent());
    check(/No rounds of Dice yet\. Deal yourself in/.test(rounds), 'a game\'s "My rounds" tab: "Deal yourself in"');
    await go(page, '#fair');
    check(/No verified-fair rounds yet\. Play a game and it will appear here\./.test(flat(await text(page, '#view-fair'))), 'Fair Play: no verified rounds yet');
    check(await text(page, '#view-fair [data-role="block"] .hashrow code').then((t) => t.length > 8 && !/Preparing/.test(t)), 'and the sealed envelope has its fingerprint (the loading line "Sealing the envelope…" is only shown for a moment)');
    await page.close();
  }

  /* ---------------------------------------------------------------------------------------------------------------- */
  if (section('22g. Responsible giving: the corner in Help, in the account, and the limit says so')) {
    const page = await newPage();
    await openApp(page, '#help-limit');
    await page.waitForTimeout(200);
    const q = await text(page, '#help-limit summary');
    const a = flat(await text(page, '#help-limit .faq__a'));
    check(/^Responsible giving: can I limit how much I give\?/.test(q) && /Giving should feel good/.test(a) && /Card & responsible giving/.test(a) && /change or remove it any time/.test(a), 'Help: "Responsible giving", kind and clear, says where to set it', q + ' | ' + a);
    // sign up quickly (the same preview steps as section 9), then open the account dialog
    await go(page, '#game-wheel');
    await page.click('#acct [data-role="signup"]');
    await page.waitForSelector('#dlg-auth[open]');
    await page.fill('#au-contact', 'voice@example.com');
    await page.fill('#au-pass', 'Passw0rd!xyz');
    await page.check('#dlg-auth [data-role="agree"]');
    await page.click('#dlg-auth button[type="submit"]');
    await page.waitForSelector('#au-code');
    await page.fill('#au-code', '123456');
    await page.click('#dlg-auth button[type="submit"]');
    await page.waitForSelector('#au-name');
    await page.fill('#au-name', 'Sam');
    await page.click('#dlg-auth button[type="submit"]');
    await page.waitForSelector('#dlg-auth [data-role="later"]');
    await page.click('#dlg-auth [data-role="later"]');
    await page.waitForFunction(() => !document.querySelector('#dlg-auth').open);
    await page.click('#acct [data-role="toggle"]');
    check(/Card & responsible giving/.test(await text(page, '#acct [data-role="settings"]')), 'the account menu entry is "Card & responsible giving"');
    await page.click('#acct [data-role="settings"]');
    await page.waitForSelector('#dlg-settings[open]');
    const lim = flat(await page.locator('#dlg-settings').textContent());   // (textContent: the section titles are drawn in capitals, which innerText would return)
    check(/Responsible giving: monthly limit/.test(lim) && /Giving should feel good, and a limit keeps it that way/.test(lim), 'the account dialog has the Responsible giving section', lim.slice(0, 400));
    await a11y(page, 'account settings with Responsible giving');
    await page.click('#dlg-settings [data-limit="50"]');
    check((await h.toastText(page)).some((t) => /Responsible giving: monthly limit set to \$50\./.test(t)), 'setting a limit says "Responsible giving: monthly limit set to $50."');
    await page.keyboard.press('Escape');
    await go(page, '#game-wheel');
    await setAmount(page, 80);
    await page.click('#btn-play');
    await page.waitForTimeout(300);
    const toasts = (await h.toastText(page)).map(flat).join(' ');
    check(/Responsible giving: that would go past your monthly giving limit of \$50/.test(toasts) && !(await h.receiptOpen(page)), 'a gift past the limit is stopped, kindly, by name', toasts);
    await page.close();
  }

  /* ---------------------------------------------------------------------------------------------------------------- */
  if (section('22h. The VIP lounge: the Giving Club page, the lobby card, ranks unchanged and no invented perks')) {
    const page = await newPage();
    await openApp(page, '#lobby');
    const promos = flat(await text(page, '#view-lobby .promos'));
    check(/The VIP lounge is open\./.test(promos) && /The only way in is giving\./.test(promos) && /Enter the lounge/.test(promos) && !/Open the Club/.test(promos), 'the lobby card says "The VIP lounge is open" and "Enter the lounge"', promos);
    await page.click('#view-lobby .promos a[href="#club"]');
    await h.onRoute(page, 'club');
    const head = flat(await text(page, '#view-club .page-head'));
    check(/^Giving Club/.test(head) && /Welcome to the VIP lounge\. The only way in is giving\. Every \$1 you give earns 10 XP\./.test(head), 'the Giving Club page keeps its name and welcomes you to the VIP lounge', head);
    const club = flat(await text(page, '#view-club'));
    const names = h.core.RANKS.map((r) => r.name);
    check(names.every((n) => club.includes(n)) && /Ranks are your lounge membership/.test(club), 'the eight ranks keep their names and are called lounge membership', names.filter((n) => !club.includes(n)));
    check(!/perk|free drinks|bonus credit|cashback|discount/i.test(club.replace(/clubperks/g, '')), 'and no perk is promised that does not exist');
    check(/Giving Club/.test(await text(page, '#side .side__link[data-route="club"]')), 'the side menu still says Giving Club');
    await page.close();
  }

  check(problems.length === problems0, 'section 22: no console errors, warnings or failed requests', problems.slice(problems0, problems0 + 5));
}

