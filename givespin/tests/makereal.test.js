// Run with:  node --test givespin/tests/makereal.test.js
// "Make it real": the settings file still says demo and has the same values, the money step still behaves as before, the owner's checklist and the page agree,
// and nothing new claims that real giving, real money or real players exist.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/** A file loaded on a pretend page. */
function page(files, extra) {
  const sandbox = Object.assign({ console, Date, Promise, setTimeout, clearTimeout }, extra || {});
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  files.forEach((f) => vm.runInContext(read(f), sandbox, { filename: f }));
  return sandbox.GS;
}
const plain = (x) => JSON.parse(JSON.stringify(x));

test('js/config.js still exports exactly the same settings, with the mode on demo and no checkout link (this feature only added comments)', () => {
  const GS = page(['js/config.js']);
  const c = GS.config;
  assert.deepEqual(plain(Object.keys(c).sort()), ['brand', 'checkout', 'creditTopUps', 'defaultAmount', 'demoCredit', 'logos', 'maxAmount', 'minAmount', 'minPerRound', 'minPool', 'mode', 'presets', 'roundOptions']);
  assert.deepEqual(plain({
    brand: c.brand, mode: c.mode, minAmount: c.minAmount, maxAmount: c.maxAmount, defaultAmount: c.defaultAmount, presets: c.presets, roundOptions: c.roundOptions,
    minPerRound: c.minPerRound, minPool: c.minPool, logos: c.logos, demoCredit: c.demoCredit, creditTopUps: c.creditTopUps
  }), {
    brand: 'GiveSpin', mode: 'demo', minAmount: 1, maxAmount: 1000, defaultAmount: 25, presets: [5, 10, 25, 50, 100], roundOptions: [1, 3, 5, 10],
    minPerRound: 1, minPool: 2, logos: true, demoCredit: 1000, creditTopUps: [100, 500, 1000]
  });
  assert.deepEqual(Object.keys(c.checkout), ['url']);
  assert.equal(c.checkout.url({ id: 'oxfam' }, 2500, { frequency: 'once', dedication: null }), null, 'no checkout link is set up: nothing can be sent anywhere');
  // the code part of the file is exactly what it was before: only comments were added
  const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s+/g, ' ').trim();
  assert.ok(/mode: 'demo', \/\/ 'demo' \| 'redirect'/.test(read('js/config.js')), 'the shipped mode line is unchanged');
  assert.ok(code(read('js/config.js')).length > 300);
});

test('js/payments.js still behaves as before: demo takes play money and sends nothing; redirect only passes on https links', async () => {
  let balance = 5000;
  const store = { spend: (c) => { if (c > balance) { return false; } balance -= c; return true; } };
  // (loaded on one page so the pieces see each other)
  const sandbox = { console, Date, Promise, setTimeout, clearTimeout };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read('js/config.js'), sandbox);
  sandbox.GS.core = { receiptId: () => 'GS-TEST' };
  sandbox.GS.store = store;
  vm.runInContext(read('js/payments.js'), sandbox);
  const GS = sandbox.GS;
  assert.equal(GS.payments.mode(), 'demo');
  const alloc = [{ charity: { id: 'oxfam' }, cents: 2000 }];
  const r = await GS.payments.process(alloc, { timeScale: 0.001 });
  assert.deepEqual(plain([r.status, r.receipt, r.links, r.pay]), ['demo', 'GS-TEST', [], 'credit']);
  assert.equal(balance, 3000, 'demo credit went down by the gift');
  await assert.rejects(GS.payments.process([{ charity: { id: 'oxfam' }, cents: 999999 }], { timeScale: 0.001 }), /Not enough demo credit/);
  // anything but the word 'redirect' is demo
  GS.config.mode = 'live';
  assert.equal(GS.payments.mode(), 'demo');
  // redirect: links only, nothing taken, and only https
  GS.config.mode = 'redirect';
  GS.config.checkout.url = (ch, cents) => (ch.id === 'a' ? 'https://pay.example/a?amount=' + cents / 100 : ch.id === 'b' ? 'http://pay.example/b' : ch.id === 'c' ? 'javascript:alert(1)' : null);
  const before = balance;
  const rr = await GS.payments.process([{ charity: { id: 'a' }, cents: 1000 }, { charity: { id: 'b' }, cents: 500 }, { charity: { id: 'c' }, cents: 500 }, { charity: { id: 'd' }, cents: 500 }], {});
  assert.equal(rr.status, 'checkout');
  assert.deepEqual(plain(rr.links.map((l) => l.url)), ['https://pay.example/a?amount=10', null, null, null]);
  assert.equal(balance, before, 'redirect mode takes nothing');
});

test('the owner\'s checklist (docs/make-it-real.md) and the page agree: the same seven steps, every one "Not started", and nothing says real giving exists', () => {
  const doc = read('docs/make-it-real.md');
  const src = read('js/ui/makereal.js');
  const pageTitles = [...src.matchAll(/\{ id: '[a-z]+', icon: '[a-z-]+', title: '([^']+)'/g)].map((m) => m[1]);
  assert.equal(pageTitles.length, 7, 'seven steps on the page');
  const docTitles = [...doc.matchAll(/^### \d\. (.+)$/gm)].map((m) => m[1].replace(/ \(optional\)$/, ''));
  assert.deepEqual(docTitles.slice().sort(), pageTitles.slice().sort(), 'the same seven steps in the doc');
  assert.ok(/Of the seven steps below, none has been started/i.test(doc));
  const table = doc.split('## Rough order')[1].split('## The steps')[0];
  const rows = table.split('\n').filter((l) => /^\| \d \|/.test(l));
  assert.equal(rows.length, 7);
  assert.ok(rows.every((l) => /\| Not started \|$/.test(l)), 'every step in the table is Not started');
  // on the page, the real half of every step is a "Not started" chip, whatever the step; the demo half is the stand-in that exists
  assert.ok(/chip\(false, 'Not started'\)/.test(src) && !/chip\(true, 'Not started'\)/.test(src));
  assert.ok(/<b>' \+ started \+ ' of ' \+ steps\.length/.test(src) && /var started = 0;/.test(src), 'the count of real steps started is zero');
  // no sentence in either says that giving works, money moves or a charity has agreed
  [src, doc].forEach((t) => {
    assert.ok(!/real donations? (?:are|is) (?:now )?(?:possible|live|open)|you can (?:now )?donate (?:for real|real)|every gift (?:is|reaches)|we (?:pay|send) (?:the )?charit/i.test(t));
  });
  assert.ok(/no charity has been asked or has agreed to anything/i.test(doc));
  assert.ok(/mode: 'redirect'/.test(doc) && /js\/config\.js/.test(doc) && /checkout\.url/.test(doc) && /docs\/live-protocol\.md/.test(doc));
  assert.ok(/Nothing here is legal or tax advice/.test(doc));
  assert.ok(/casino/i.test(doc) && /age limit/i.test(doc), 'the casino styling and the age question are raised with the lawyer');
});

test('the page says what the switch really does, in line with js/payments.js and the README: redirect takes nothing, https only, nothing until checkout.url is filled in', () => {
  const src = read('js/ui/makereal.js');
  ['It takes nothing here', 'never sees a card', 'only secure (https) links are accepted', 'sent to checkout', 'checkout.url', 'no checkout link set up', 'Only the person who runs the site can change it'].forEach((t) => {
    assert.ok(src.includes(t), 'the page says: ' + t);
  });
  const readme = read('README.md').replace(/\s+/g, ' ');
  assert.ok(/no checkout link set up/.test(readme) && /sent to checkout/.test(readme), 'the README says the same');
  const rcpt = read('js/ui/receipt.js');
  assert.ok(/no checkout link/i.test(rcpt), 'the receipt really has that note');
  assert.ok(!/GS\.config\.mode\s*=[^=]/.test(src) && !/config\.mode\s*=[^=]/.test(read('js/ui/install.js') + read('js/transport.js') + read('js/appkit.js')), 'nothing new sets the mode');
});

test('Help links to Make it real and has the install and reminder answers; the footer link is there', () => {
  const pages = read('js/ui/pages.js');
  ['help-install', 'help-reminders', 'help-makereal'].forEach((id) => assert.ok(pages.includes("'" + id + "'"), id));
  assert.ok(/Can I install this\?/.test(pages));
  assert.ok(/href="#make-it-real">What would it take\?/.test(pages), 'Is this real money? points to the page');
  assert.ok(/Reminders only work while GiveSpin is open or installed and the browser keeps it alive\. No push server, nothing is sent from here\./.test(read('js/ui/install.js')), 'the reminder text is the honest one');
  assert.ok(/<a href="#make-it-real">Make it real<\/a>/.test(read('index.html')));
});

test('the wording rules hold in everything this feature wrote: no crypto words, no cash-out, no visitor-facing jackpot, no "real players", no superlatives', () => {
  const files = ['js/ui/makereal.js', 'js/ui/install.js', 'js/appkit.js', 'js/transport.js', 'docs/make-it-real.md', 'docs/live-protocol.md', 'offline.html', 'manifest.webmanifest', 'sw.js'];
  const banned = /crypto(?!graph)|bitcoin|ethereum|blockchain|wallet|\bNFTs?\b|\btokens?\b|\bcoins?\b/i;
  files.forEach((f) => {
    const src = read(f).replace(/var PRECACHE = \[[\s\S]*?\n\];/, '');   // (the list of file names holds js/games/coin.js, the Coin Flip game)
    assert.equal(banned.exec(src), null, f + ' has a banned word');
    assert.ok(!/\bcash(?:ed|ing)?[\s-]*out\b/i.test(src), f + ' says cash out');
    assert.ok(!/real players/i.test(src.replace(/(?:no|not a|never call anyone a) real players?/gi, '')), f + ' says "real players"');
    assert.ok(!/\b(?:the best|most trusted|greatest|number one)\b/i.test(src), f + ' uses a superlative');
  });
  // the visible strings of the page and the install file: no "jackpot", no "winnings", "payout" or "prize"
  ['js/ui/makereal.js', 'js/ui/install.js'].forEach((f) => {
    const strings = (read(f).replace(/\/\*[\s\S]*?\*\//g, '').match(/'(?:\\.|[^'\\\n])*'/g) || []).join(' ');
    assert.ok(!/jackpot|winnings|payout|prize/i.test(strings), f + ' has money-win wording');
  });
});
