// Run with:  node --test givespin/tests/share.test.js
// js/share.js: what goes on a share card (the words, the verify code, the big-win rule, file names, line breaking). No canvas needed.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const share = require('../js/share.js');

const HASH = '3f9a1c07' + 'ab'.repeat(28);
const STAND = { rank: 2, level: 6, label: 'Rank 2 · Level 6', name: 'Benefactor' };
const base = (o) => Object.assign({
  demo: true, amountText: '$25', cents: 2500, game: 'Lucky Wheel', charities: [{ name: 'WaterAid', short: 'WaterAid' }],
  standing: STAND, receiptId: 'GS-7K2M9Q', fair: { serverHash: HASH }
}, o || {});
const width = (t) => Array.from(t).length * 10;   // a pretend font where every letter is 10 wide

test('the two sizes are 1080 x 1350 and 1080 x 1080, and an unknown size is portrait', () => {
  assert.deepEqual([share.SIZES.portrait.w, share.SIZES.portrait.h], [1080, 1350]);
  assert.deepEqual([share.SIZES.square.w, share.SIZES.square.h], [1080, 1080]);
  assert.equal(share.sizeFor('square').id, 'square');
  assert.equal(share.sizeFor('banner').id, 'portrait');
  assert.equal(share.sizeFor(undefined).id, 'portrait');
});

test('the big-win rule: a Triple Threat, a rank-up, a backed win, or $100 and over; nothing else', () => {
  assert.equal(share.bigWin({ jackpot: true, cents: 100 }), 'jackpot');
  assert.equal(share.bigWin({ rankedUp: true, cents: 100 }), 'rankup');
  assert.equal(share.bigWin({ pickWon: true, cents: 100 }), 'called');
  assert.equal(share.bigWin({ cents: 10000 }), 'big');
  assert.equal(share.bigWin({ cents: 9999 }), '', 'a cent under $100 is a plain card');
  assert.equal(share.bigWin({ cents: 2500 }), '');
  assert.equal(share.bigWin({}), '');
  assert.equal(share.bigWin(), '');
  assert.equal(share.bigWin({ jackpot: true, rankedUp: true, pickWon: true, cents: 99999 }), 'jackpot', 'a Triple Threat is named first');
  assert.equal(share.bigLabel('jackpot'), 'Triple Threat');
  assert.equal(share.bigLabel(''), '');
  assert.equal(share.roundCard(base({ cents: 20000 })).ribbon, 'Big gift');
  assert.equal(share.roundCard(base()).ribbon, '');
});

test('the verify code is the first 8 characters of the hash plus the receipt id, and only when there is a draw to check', () => {
  const v = share.verifyCode({ serverHash: HASH.toUpperCase() }, 'GS-7K2M9Q');
  assert.equal(v.hash, '3f9a1c07');
  assert.equal(v.text, 'Verify this round: 3f9a1c07 · GS-7K2M9Q');
  assert.equal(v.hint, 'Check it at Fair Play');
  assert.equal(share.verifyCode(null, 'GS-7K2M9Q'), null, 'no draw (a direct gift, or no crypto): no code');
  assert.equal(share.verifyCode({ serverHash: 'abc' }, 'GS-7K2M9Q'), null, 'a hash that is too short is not a hash');
  assert.equal(share.verifyCode({ serverHash: 'zz'.repeat(32) }, 'GS-7K2M9Q'), null, 'and neither is a string that is not hex');
  assert.equal(share.verifyCode({ serverHash: HASH }, ''), null, 'without a receipt id there is nothing to look up');
  assert.equal(share.verifyCode({ serverHash: HASH }, 'GS 7K<2>'), null, 'an odd id is refused');
  assert.equal(share.roundCard(base({ direct: true })).verify, null, 'a direct gift has no draw, so no verify line');
  assert.equal(share.roundCard(base()).verify.text, v.text);
});

test('the secret number never reaches a card, only the public fingerprint', () => {
  const card = share.roundCard(base({ fair: { serverHash: HASH, roundSeed: 'SECRETSEED'.repeat(6), clientSeed: 'lucky' } }));
  const everything = JSON.stringify(card) + share.shareText(card) + share.altText(card, 'portrait');
  assert.ok(!/SECRETSEED/.test(everything) && !/lucky/.test(everything));
  assert.ok(!everything.includes(HASH), 'not even the whole hash: only its first characters');
});

test('the name is on the card only when it is given, and it is made safe', () => {
  assert.equal(share.roundCard(base()).name, '');
  assert.equal(share.roundCard(base()).eyebrow, 'A gift from the arcade');
  const named = share.roundCard(base({ name: '  Ada   Lovelace ' }));
  assert.equal(named.name, 'Ada Lovelace');
  assert.equal(named.eyebrow, 'Ada Lovelace’s gift');
  assert.equal(share.cleanName('ada@example.com'), '', 'an email address is not a display name');
  assert.equal(share.cleanName('<b>Ada</b>'), 'Ada', 'a tag is dropped (the card is drawn, not HTML, but a name should look like a name)');
  assert.ok(!/[<>]/.test(share.cleanName('<script>alert(1)</script>')));
  assert.equal(share.cleanName('line one\nline two').includes('\n'), false);
  assert.equal(Array.from(share.cleanName('x'.repeat(80))).length, share.MAX_NAME);
  assert.equal(share.cleanName('日本語の名前'), '日本語の名前');
  assert.equal(share.cleanName('😀'.repeat(40)).length, share.MAX_NAME * 2, 'cut on a whole character, not in the middle of an emoji');
  assert.equal(share.cleanName(null), '');
  assert.equal(share.cleanName(42), '42');
});

test('the share text never holds the name when the card does not, never the balance, and does not claim a finished gift at checkout', () => {
  const off = share.roundCard(base({ name: '' }));
  const t = share.shareText(off);
  assert.equal(t, 'My GiveSpin round landed on WaterAid (play money). Check it yourself: 3f9a1c07 · GS-7K2M9Q. Give it a spin:');
  assert.ok(!/Ada/.test(t));
  const on = share.shareText(share.roundCard(base({ name: 'Ada' })));
  assert.ok(on.startsWith('Ada’s GiveSpin round'));
  const co = share.shareText(share.roundCard(base({ demo: false })));
  assert.ok(/picked WaterAid for my \$25 gift/.test(co) && !/just gave/i.test(co) && !/play money/.test(co), co);
  const many = share.shareText(share.roundCard(base({ charities: [1, 2, 3, 4, 5].map((n) => ({ name: 'C' + n, short: 'C' + n })) })));
  assert.ok(/landed on 5 charities/.test(many), many);
  const three = share.shareText(share.roundCard(base({ charities: [1, 2, 3].map((n) => ({ name: 'Charity ' + n, short: 'C' + n })) })));
  assert.ok(/landed on C1, C2 and C3 /.test(three), three);
  assert.ok(!/balance|credit|@/i.test(t + on + co + many + three));
});

test('a round with several charities says how many, and keeps the first three names', () => {
  const c = share.roundCard(base({ charities: [1, 2, 3, 4, 5].map((n) => ({ name: 'Charity ' + n, short: 'C' + n })) }));
  assert.equal(c.charity, '5 charities');
  assert.deepEqual(c.names, ['Charity 1', 'Charity 2', 'Charity 3']);
  assert.equal(c.more, 2);
  assert.equal(c.count, 5);
  assert.equal(share.roundCard(base()).charity, 'WaterAid');
  const none = share.roundCard(base({ charities: [] }));
  assert.equal(none.charity, 'a charity', 'a charity that has left the roster does not make "0 charities"');
  assert.ok(/landed on a charity /.test(share.shareText(none)), share.shareText(none));
});

test('demo wording and checkout wording differ, and the demo card says nothing was charged', () => {
  const d = share.roundCard(base());
  const r = share.roundCard(base({ demo: false }));
  assert.equal(d.lead, 'went to');
  assert.equal(r.lead, 'is for');
  assert.ok(/no money moved/.test(d.note) && /nothing was charged/.test(d.note));
  assert.ok(!/nothing was charged/.test(r.note) && /checkout/.test(r.note));
  assert.ok(/own device/.test(d.verifyNote), 'the demo card says where the secret is made');
  assert.equal(r.verifyNote, '');
});

test('the profile card holds the standing, the total, the favourite and the streak, and the name only when given', () => {
  const p = share.profileCard({ demo: true, name: 'Ada', standing: STAND, totalText: '$7,500', top: { name: 'WaterAid' }, cause: 'Clean water', streak: 5 });
  assert.equal(p.kind, 'profile');
  assert.equal(p.eyebrow, 'Ada’s giving');
  assert.equal(p.totalLine, '$7,500 given');
  assert.equal(p.topLine, 'Most given to: WaterAid');
  assert.equal(p.causeLine, 'Favourite cause: Clean water');
  assert.equal(p.streakLine, '5 days in a row');
  const q = share.profileCard({ demo: true, standing: { rank: 0, level: 7, label: 'Level 7', name: 'Kind Roller' }, totalText: '$40', streak: 1 });
  assert.equal(q.eyebrow, 'My giving');
  assert.equal(q.name, '');
  assert.equal(q.standing.label, 'Level 7');
  assert.equal(q.topLine, '');
  assert.equal(q.streakLine, '1 day in a row');
  assert.equal(share.profileCard({ standing: STAND, totalText: '$0', streak: 0 }).streakLine, '');
  const t = share.shareText(p);
  assert.equal(t, 'Ada’s GiveSpin profile: Rank 2 · Level 6, $7,500 given (play money). Give it a spin:');
  assert.ok(!/Ada/.test(share.shareText(share.profileCard({ standing: STAND, totalText: '$7,500', demo: true }))));
});

test('the picture has proper alt text: size, standing, amount, charity, game, the verify line and the frame', () => {
  const a = share.altText(share.roundCard(base({ jackpot: true })), 'square');
  assert.ok(/square \(1080 by 1080\)/.test(a), a);
  assert.ok(/Gold frame: Triple Threat/.test(a) && /Rank 2 · Level 6, Benefactor/.test(a) && /\$25 went to WaterAid, game: Lucky Wheel/.test(a), a);
  assert.ok(/Verify this round: 3f9a1c07 · GS-7K2M9Q\. Check it at Fair Play/.test(a) && /nothing was charged/.test(a) && /The house is a charity/.test(a), a);
  const plain = share.altText(share.roundCard(base()), 'portrait');
  assert.ok(!/Gold frame/.test(plain) && /portrait \(1080 by 1350\)/.test(plain));
  const pa = share.altText(share.profileCard({ demo: true, standing: STAND, totalText: '$7,500', top: { name: 'WaterAid' }, streak: 3 }), 'portrait');
  assert.ok(/\$7,500 given/.test(pa) && /Most given to: WaterAid/.test(pa) && /3 days in a row/.test(pa), pa);
});

test('file names are safe and say what the picture is', () => {
  assert.equal(share.fileName('gift', 'GS-7K2M9Q', 'portrait'), 'givespin-gift-GS-7K2M9Q-portrait.png');
  assert.equal(share.fileName('gift', 'GS-7K2M9Q', 'square'), 'givespin-gift-GS-7K2M9Q-square.png');
  assert.equal(share.fileName('profile', 'GS-7K2M9Q', 'square'), 'givespin-profile-square.png');
  assert.equal(share.fileName('gift', '', 'banner'), 'givespin-gift-portrait.png');
  assert.equal(share.fileName('gift', '../../etc/passwd', 'square'), 'givespin-gift-square.png', 'an id with slashes is dropped, not cleaned into a path');
  assert.ok(/^[A-Za-z0-9.-]+$/.test(share.fileName('gift', 'GS-ABC123', 'square')));
});

test('the address on a card has no #route, ?query, scheme or index.html, and nothing for a page opened from a file', () => {
  assert.equal(share.siteUrl('http://127.0.0.1:8000/index.html?fast=1#lobby'), 'http://127.0.0.1:8000/');
  assert.equal(share.siteUrl('https://givespin.example/arcade/index.html#game-wheel'), 'https://givespin.example/arcade/');
  assert.equal(share.siteLabel('https://givespin.example/arcade/'), 'givespin.example/arcade');
  assert.equal(share.siteLabel('https://givespin.example/'), 'givespin.example');
  assert.equal(share.siteLabel('file:///home/me/givespin/index.html'), '');
  assert.equal(share.siteUrl('javascript:alert(1)'), '');
  assert.equal(share.siteLabel(''), '');
});

test('line breaking: words stay whole, a long word is cut, and a too-long text ends in an ellipsis', () => {
  const r = share.wrapText('The Royal National Lifeboat Institution', 190, width, 3);
  assert.deepEqual(r.lines, ['The Royal National', 'Lifeboat', 'Institution']);
  assert.equal(r.cut, false);
  r.lines.forEach((l) => assert.ok(width(l) <= 190, l));
  assert.deepEqual(share.wrapText('The Royal National Lifeboat Institution', 200, width, 3).lines, ['The Royal National', 'Lifeboat Institution'], 'a line may be exactly as wide as the box');
  const cut = share.wrapText('The Royal National Lifeboat Institution of Great Britain and Ireland', 200, width, 2);
  assert.equal(cut.lines.length, 2);
  assert.equal(cut.cut, true);
  assert.ok(cut.lines[1].endsWith('…'));
  cut.lines.forEach((l) => assert.ok(width(l) <= 200, l + ' is ' + width(l)));
  const long = share.wrapText('Supercalifragilisticexpialidocious', 100, width, 5);
  assert.ok(long.lines.length >= 4 && long.lines.every((l) => width(l) <= 100) && long.lines.join('') === 'Supercalifragilisticexpialidocious', long.lines.join('|'));
  assert.deepEqual(share.wrapText('', 100, width, 2).lines, []);
  assert.deepEqual(share.wrapText('   ', 100, width, 2).lines, []);
  assert.deepEqual(share.wrapText('one', 100, width, 0).lines, ['one'], 'at least one line is always allowed');
});

test('ellipsize and fitSize: the text fits, or the font shrinks until it does', () => {
  assert.equal(share.ellipsize('short', 100, width), 'short');
  const e = share.ellipsize('A very long charity name indeed', 120, width);
  assert.ok(e.endsWith('…') && width(e) <= 120, e);
  assert.equal(share.ellipsize('anything', 5, width), '…', 'even a tiny box gets the dots, not an error');
  const at = (t, px) => Array.from(t).length * px * 0.5;
  assert.equal(share.fitSize('hello world', 1000, at, 120, 30), 120, 'plenty of room: the biggest size');
  assert.equal(share.fitSize('hello world', 33, at, 120, 30), 30, 'no room at all: the smallest size, never smaller');
  const px = share.fitSize('hello world', 330, at, 120, 30);
  assert.ok(at('hello world', px) <= 330 && at('hello world', px + 1) > 330, 'the largest size that fits: ' + px);
  assert.equal(share.fitSize('x', 100, at, 20, 40), 40, 'a maximum under the minimum gives the minimum');
});

test('the profile card finds the charity and cause given to most from the saved history', () => {
  const hist = [
    { allocations: [{ charityId: 'b', cents: 500 }, { charityId: 'a', cents: 500 }] },
    { allocations: [{ charityId: 'a', cents: 200 }] },
    { allocations: [{ charityId: 'c', cents: 700 }] },
    { allocations: [] },
    null,
    {}
  ];
  assert.deepEqual(share.topCharities(hist, 2), [{ id: 'a', cents: 700 }, { id: 'c', cents: 700 }], 'a tie goes to the earlier id');
  assert.deepEqual(share.topCharities([], 3), []);
  assert.deepEqual(share.topCharities(undefined, 3), []);
  const causes = { a: ['water'], b: ['water', 'health'], c: ['health'] };
  const tc = share.topCauses(hist, (id) => causes[id], 3);
  assert.deepEqual(tc, [{ id: 'health', cents: 950 }, { id: 'water', cents: 950 }], 'a charity with two causes shares its total between them');
  assert.deepEqual(share.topCauses(hist, () => [], 3), []);
});

test('the remembered choices default to private: the name off and portrait', () => {
  assert.deepEqual(share.normPrefs(undefined), { showName: false, size: 'portrait' });
  assert.deepEqual(share.normPrefs({ showName: 'yes', size: 'banner' }), { showName: false, size: 'portrait' }, 'only a real true turns the name on');
  assert.deepEqual(share.normPrefs({ showName: true, size: 'square' }), { showName: true, size: 'square' });
  assert.deepEqual(share.normPrefs('junk'), { showName: false, size: 'portrait' });
});
