// Run with:  node --test givespin/tests/profile.test.js
// The profile's rules (js/profile.js): the display name checks, what is kept, the favourites worked out from the history, the frames and titles and what
// unlocks each, and the made-up details of a simulated player. Pure logic: no page needed.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const core = require('../js/core.js');
const P = require('../js/profile.js');

const BANNED_WORDS = /crypto|bitcoin|ethereum|blockchain|wallet|\bnfts?\b|\btokens?\b|\bcoins?\b|winnings|payout|prize|jackpot|cash out|real players/i;

/* ------------------------------------------------------------------ names */

test('an ordinary name is accepted, trimmed, with its spaces tidied', () => {
  for (const n of ['Sam', 'Ada Lovelace', "Mary-Jane O'Neil", 'Zoe_99', 'Team A&B', 'Dr. Who?', 'Joy (the kind)', 'x']) {
    const r = P.validateName(n);
    assert.equal(r.ok, true, n);
    assert.equal(r.value, n);
    assert.equal(r.reason, '');
    assert.equal(r.message, '');
  }
  assert.equal(P.validateName('   Sam    Kay \t ').value, 'Sam Kay');
  assert.equal(P.validateName('Sam  Kay').value, 'Sam Kay', 'a no-break space counts as a space');
  assert.equal(P.validateName('Sam\nKay').value, 'Sam Kay', 'a line break becomes a space');
});

test('names from other languages and with accents are accepted', () => {
  for (const n of ['Ünal Çelik', 'José', 'Zoë', '日本語の名前', 'Ольга', 'Μαρία', 'Åsa', 'Nguyễn Văn']) {
    assert.equal(P.validateName(n).ok, true, n);
  }
  // a letter written as base + combining accent is the same name as the single character
  assert.equal(P.validateName('José').value, 'José');
});

test('1 to 20 characters: counted as characters, not as bytes or code units', () => {
  assert.equal(P.validateName('a'.repeat(20)).ok, true);
  const long = P.validateName('a'.repeat(21));
  assert.equal(long.ok, false);
  assert.equal(long.reason, 'long');
  assert.match(long.message, /21 characters/);
  assert.match(long.message, /20/);
  // 20 letters outside the basic plane (two code units each) are 20 characters
  const astral = '\u{1D49C}'.repeat(20);
  assert.equal(astral.length, 40);
  assert.equal(P.validateName(astral).ok, true);
  assert.equal(P.validateName(astral + '\u{1D49C}').ok, false);
  assert.equal(P.validateName('日本語'.repeat(7)).ok, false, '21 characters');
  assert.equal(P.validateName('日本語'.repeat(6) + '日本').ok, true, '20 characters');
  // spaces count, and a name that is too long only because of its spaces is tidied first
  assert.equal(P.validateName('a' + ' '.repeat(50) + 'b').value, 'a b');
});

test('nothing, or only spaces, is refused with a plain message', () => {
  for (const n of ['', '   ', '\t\n', null, undefined, {}, [], true, '​​']) {
    const r = P.validateName(n);
    assert.equal(r.ok, false, JSON.stringify(n));
    assert.equal(r.reason, 'empty');
    assert.match(r.message, /1 to 20/);
  }
  assert.equal(P.validateName(12345).ok, true, 'a number is read as its digits');
  assert.equal(P.validateName(NaN).ok, false);
  assert.equal(P.validateName(Infinity).ok, false);
});

test('no < or >, so no tags can get through', () => {
  for (const n of ['<b>x</b>', 'a<b', 'a>b', '<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '<']) {
    const r = P.validateName(n);
    assert.equal(r.ok, false, n);
    assert.equal(r.reason, 'html');
  }
  // an entity cannot be typed either (a semicolon is not simple punctuation), and a bare & is fine
  assert.equal(P.validateName('&lt;b&gt;').reason, 'chars');
  assert.equal(P.validateName('Tom & Jerry').ok, true);
});

test('no links or web addresses', () => {
  for (const n of ['http://x', 'https://example.org', 'HTTPS foo', 'www.give.now', 'sam.com', 'give.io', 'my.site', 'a@b', 'sam@example.com', 'a/b', 'a\\b', 'visit.ru']) {
    const r = P.validateName(n);
    assert.equal(r.ok, false, n);
    assert.equal(r.reason, 'link', n);
  }
  // a dot in a name is fine when it is not an address
  for (const n of ['Mr.Nice', 'J. R. Smith', 'St. John', 'Sam.K', 'Ms. Hopper']) { assert.equal(P.validateName(n).ok, true, n); }
});

test('only letters, numbers, spaces and simple punctuation', () => {
  for (const n of ['😀', 'Sam 😀', '{x}', 'a|b', 'a;b', 'a:b', 'a=b', 'a"b', 'a`b', 'a^b', 'a%b', 'a#b', 'a$b', '[x]', '!!!', '...', '- - -', '()', '‮evil']) {
    const r = P.validateName(n);
    if (n === '‮evil') { assert.equal(r.value, 'evil', 'a direction override is removed'); continue; }
    assert.equal(r.ok, false, n);
    assert.equal(r.reason, 'chars', n);
    assert.match(r.message, /letters, numbers, spaces/);
  }
  assert.equal(P.validateName('!Sam!').ok, true, 'punctuation is fine round a letter');
});

test('zero-width, direction and control characters are removed before the checks', () => {
  assert.equal(P.validateName('Sa​m').value, 'Sam');
  assert.equal(P.validateName('Sa‍m⁠').value, 'Sam');
  assert.equal(P.validateName('﻿Sam').value, 'Sam');
  assert.equal(P.validateName('Sam\u0007').value, 'Sam');
  assert.equal(P.validateName('Sa\u0000m').value, 'Sam');
  assert.equal(P.validateName('⁦Sam⁩').value, 'Sam');
  // hidden characters cannot be used to sneak past the block-list
  assert.equal(P.validateName('fu​ck').ok, false);
});

test('rude words are refused, however they are dressed up', () => {
  for (const n of ['fuck', 'FUCK', 'Fuck You', 'Mr Fucker', 'sh1t', 'SH1T', 'f u c k', 'f.u.c.k', 'f-u-c-k', 'bitch', 'B1tch', 'Bullshit', 'asshole', 'a55', 'Ass', 'Big Ass', 'cunt', 'wh0re', 'n1gger', 'Nigga', 'faggot', 'FAG', 'Nazi', 'Hitler', 'Hitler Fan', 'rapist', 'Porn Star', '\u0455h\u0456t', 'Jizz', 'wanker', 'Tits', 'cum', 'Sex', 'piss off', 'twat']) {
    const r = P.validateName(n);
    assert.equal(r.ok, false, n);
    assert.equal(r.reason, 'blocked', n);
  }
  // accents do not help either
  assert.equal(P.validateName('fu\u0308ck').ok, false);
  assert.equal(P.validateName('shít').ok, false);
});

test('the block-list does not trip on ordinary words and names that merely contain a rude one', () => {
  for (const n of ['Scunthorpe', 'Cassie', 'Assist', 'Assad', 'Grape', 'Drape', 'Therapist', 'Peacock', 'Hancock', 'Cockney', 'Dickens', 'Penistone', 'Classic', 'Analyst', 'Shiitake',
    'Kishita', 'Essex', 'Sussex', 'Middlesex', 'Cumberland', 'Document', 'Titan', 'Title', 'Pittsburgh', 'Mississippi', 'Pissarro', 'Arsenal', 'Parsley', 'Bass', 'Mass', 'Pass Kit',
    'Niagara', 'Slutsky', 'Class Act', 'Tom Hit', 'Sam Hill', 'Rapunzel', 'Moses', 'Nazir', 'Naziha', 'Spice', 'Cooper', 'Coonan']) {
    const r = P.validateName(n);
    assert.equal(r.ok, true, n + ' should be allowed (' + r.reason + ')');
  }
});

test('the refusal messages never repeat the word that was refused', () => {
  const msgs = ['fuck', 'asshole', 'http://x.com', '<b>', '😀', ''].map((n) => P.validateName(n).message).join(' ');
  assert.doesNotMatch(msgs, /fuck|asshole/i);
  for (const r of ['empty', 'html', 'link', 'chars', 'long', 'blocked']) {
    const m = { empty: '', html: '<', link: 'a@b', chars: '😀', long: 'a'.repeat(30), blocked: 'fuck' }[r];
    const out = P.validateName(m);
    assert.equal(out.reason, r);
    assert.ok(out.message.length > 8 && out.message.length < 160, r);
    assert.doesNotMatch(out.message, BANNED_WORDS, r);
  }
});

test('a huge or odd input is refused quickly and never throws', () => {
  const t0 = Date.now();
  const big = 'a'.repeat(1e6);
  assert.equal(P.validateName(big).ok, false);
  assert.equal(P.validateName('<'.repeat(1e5)).ok, false);
  assert.equal(P.validateName(' '.repeat(1e6)).reason, 'empty');
  assert.equal(P.validateName('a '.repeat(1e5)).ok, false);
  assert.ok(Date.now() - t0 < 3000, 'took ' + (Date.now() - t0) + ' ms');
  const evil = { toString() { throw new Error('boom'); } };
  assert.doesNotThrow(() => P.validateName(evil));
  assert.equal(P.validateName(evil).ok, false);
  assert.equal(P.validateName(Symbol.iterator.toString()).ok, false, 'a string with brackets is not a name');
});

/* ------------------------------------------------------------------ what is kept, and the name shown */

test('sanitize keeps a good profile and turns anything odd into the defaults', () => {
  assert.deepEqual(P.sanitize({ name: 'Sam', frame: 'laurel', title: 'giver' }), { name: 'Sam', frame: 'laurel', title: 'giver' });
  assert.deepEqual(P.sanitize({ name: '  Sam   K ', frame: 'plain', title: '' }), { name: 'Sam K', frame: 'plain', title: '' });
  const empty = { name: '', frame: 'plain', title: '' };
  for (const bad of [null, undefined, 5, 'x', [], true, () => 1]) { assert.deepEqual(P.sanitize(bad), empty, String(bad)); }
  assert.deepEqual(P.sanitize({}), empty);
  // a hand-edited name that breaks the rules is dropped, whatever else is there
  assert.deepEqual(P.sanitize({ name: '<script>alert(1)</script>', frame: 'halo' }), { name: '', frame: 'halo', title: '' });
  assert.equal(P.sanitize({ name: 'fuck' }).name, '');
  assert.equal(P.sanitize({ name: 'a'.repeat(99) }).name, '');
  assert.equal(P.sanitize({ name: 42 }).name, '');
  // ids must be short and plain
  assert.equal(P.sanitize({ frame: '<img>' }).frame, 'plain');
  assert.equal(P.sanitize({ frame: 'A'.repeat(40) }).frame, 'plain');
  assert.equal(P.sanitize({ frame: 7 }).frame, 'plain');
  assert.equal(P.sanitize({ title: '../../x' }).title, '');
  assert.equal(P.sanitize({ title: { a: 1 } }).title, '');
});

test('the name to show: the one chosen, else the signed-in account, else nothing', () => {
  const acct = { signedIn: true, name: 'Ada Lovelace' };
  assert.equal(P.displayName({ name: 'Captain' }, acct), 'Captain');
  assert.equal(P.displayName({}, acct), 'Ada Lovelace');
  assert.equal(P.displayName(null, acct), 'Ada Lovelace');
  assert.equal(P.displayName({ name: 'Captain' }, { signedIn: false, name: 'Ada' }), 'Captain');
  assert.equal(P.displayName({}, { signedIn: false, name: 'Ada' }), '', 'a signed-out account name is not shown');
  assert.equal(P.displayName({}, null), '');
  assert.equal(P.displayName(undefined, undefined), '');
  assert.equal(P.displayName({ name: '<b>' }, acct), 'Ada Lovelace', 'a chosen name that breaks the rules is ignored');
  assert.equal(P.displayName({}, { signedIn: true, name: 5 }), '');
  assert.equal(P.displayName({}, { signedIn: true, name: '  Ada   L ' }), 'Ada L');
  assert.equal(P.displayName({}, { signedIn: true, name: 'x'.repeat(100) }).length, 40, 'an account name keeps the 40-character cap the account has');
});

/* ------------------------------------------------------------------ the numbers the unlock rules read */

test('facts: a missing, empty or odd save gives zeros and never throws', () => {
  const zero = P.facts({});
  assert.equal(zero.totalCents, 0);
  assert.equal(zero.rank, 0);
  assert.equal(zero.badges, 0);
  assert.equal(zero.cardsOwned, 0);
  assert.equal(zero.setsDone, 0);
  assert.equal(zero.charities, 0);
  assert.deepEqual(zero.rarity, { common: 0, rare: 0, epic: 0, legendary: 0 });
  for (const bad of [null, undefined, 5, 'x', [], { totalCents: 'lots', cards: 5, badges: [1, 2], history: 'no', setClaims: 7, streak: -3, bestStreak: NaN }]) {
    assert.deepEqual(P.facts(bad), zero, JSON.stringify(bad));
  }
});

test('facts: the rank comes from the total given, at the exact boundaries', () => {
  assert.equal(P.facts({ totalCents: 99999 }).rank, 0);
  assert.equal(P.facts({ totalCents: 100000 }).rank, 1);
  assert.equal(P.facts({ totalCents: 499999 }).rank, 1);
  assert.equal(P.facts({ totalCents: 500000 }).rank, 2);
  assert.equal(P.facts({ totalCents: 1000000 }).rank, 3);
  assert.equal(P.facts({ totalCents: 100000000 }).rank, 8);
  assert.equal(P.facts({ totalCents: '1000000' }).rank, 3, 'a number saved as text still counts');
  assert.equal(P.facts({ totalCents: 1e30 }).rank, 8);
});

test('facts: streaks, badges, cards and sets are counted from what is really there', () => {
  const f = P.facts({
    streak: 4, bestStreak: 2, plays: 9, xp: 120, biggestCents: 15000, liveRounds: 6, verifies: 1, directGifts: 2, jackpots: 1,
    badges: { a: 123, b: 456, c: 0, d: null },
    cards: { x: { rarity: 'rare', n: 2 }, y: { rarity: 'legendary' }, z: { rarity: 'mystery' }, w: 'junk', v: null },
    setClaims: { '2026-09': true, '2026-10': true, '2026-08': false },
    charityCounts: { a: 3, b: 1 },
    history: [{ allocations: [{ charityId: 'b', cents: 1 }, { charityId: 'c', cents: 1 }] }, null, 'x', { allocations: 'no' }, { allocations: [null, { charityId: 5 }] }]
  });
  assert.equal(f.bestStreak, 4, 'the best streak is never below the current one');
  assert.equal(f.streak, 4);
  assert.equal(f.plays, 9);
  assert.equal(f.badges, 2);
  assert.deepEqual(f.badgeIds.sort(), ['a', 'b']);
  assert.equal(f.cardsOwned, 3);
  assert.deepEqual(f.rarity, { common: 1, rare: 1, epic: 0, legendary: 1 });
  assert.equal(f.setsDone, 2);
  assert.equal(f.charities, 3, 'a, b and c: the saved counts and the history, each charity once');
  assert.equal(f.biggestCents, 15000);
  assert.equal(f.liveRounds, 6);
});

/* ------------------------------------------------------------------ frames and titles */

test('there are eight frames and eight titles, each with everything a visitor needs', () => {
  assert.equal(P.frames.list().length, 8);
  assert.equal(P.titles.list().length, 8);
  for (const reg of [P.frames, P.titles]) {
    const ids = reg.list().map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length, 'unique ids');
    for (const e of reg.list()) {
      assert.match(e.id, /^[a-z0-9][a-z0-9-]{0,23}$/);
      assert.ok(e.name && e.name.length <= 30, e.id);
      assert.ok(e.description.length > 5, e.id + ' description');
      assert.ok(e.how.length > 5, e.id + ' how to unlock');
      assert.doesNotMatch(e.name + ' ' + e.description + ' ' + e.how, BANNED_WORDS, e.id);
      assert.equal(e.builtin, true);
    }
  }
  assert.deepEqual(P.frames.list().map((e) => e.id), ['plain', 'laurel', 'flame', 'halo', 'stars', 'hex', 'diamond', 'rays']);
  assert.ok(P.titles.get('giver') && P.titles.get('streak-keeper') && P.titles.get('set-collector'));
  assert.equal(P.frames.fallback, 'plain');
  assert.equal(P.titles.fallback, '');
});

test('a brand new player has the plain frame and no title, and every locked one says how to unlock it', () => {
  const f = P.facts({});
  assert.deepEqual(P.frames.unlockedIds(f), ['plain']);
  assert.deepEqual(P.titles.unlockedIds(f), []);
  for (const e of P.frames.list().concat(P.titles.list())) {
    if (e.id !== 'plain') { assert.match(e.how, /[A-Za-z]/); assert.notEqual(e.how, 'Open from the start.'); }
  }
});

test('each frame opens at exactly its boundary and not before', () => {
  const open = (id, save) => P.frames.isUnlocked(id, P.facts(save), save);
  assert.equal(open('laurel', { totalCents: 9999 }), false);
  assert.equal(open('laurel', { totalCents: 10000 }), true);
  assert.equal(open('flame', { bestStreak: 6 }), false);
  assert.equal(open('flame', { bestStreak: 7 }), true);
  assert.equal(open('flame', { streak: 7 }), true, 'a current streak counts as a best');
  assert.equal(open('halo', { totalCents: 99999 }), false);
  assert.equal(open('halo', { totalCents: 100000 }), true);
  const badges = (n) => { const b = {}; for (let i = 0; i < n; i++) { b['b' + i] = 1; } return { badges: b }; };
  assert.equal(open('stars', badges(11)), false);
  assert.equal(open('stars', badges(12)), true);
  const cards = (n) => { const c = {}; for (let i = 0; i < n; i++) { c['c' + i] = { rarity: 'common', n: 1 }; } return { cards: c }; };
  assert.equal(open('hex', cards(24)), false);
  assert.equal(open('hex', cards(25)), true);
  assert.equal(open('diamond', {}), false);
  assert.equal(open('diamond', { setClaims: { '2026-10': true } }), true);
  assert.equal(open('diamond', { setClaims: { '2026-10': false } }), false);
  assert.equal(open('rays', { totalCents: 999999 }), false);
  assert.equal(open('rays', { totalCents: 1000000 }), true);
  assert.equal(open('plain', {}), true);
});

test('each title opens at exactly its boundary and not before', () => {
  const open = (id, save) => P.titles.isUnlocked(id, P.facts(save), save);
  assert.equal(open('giver', { plays: 0 }), false);
  assert.equal(open('giver', { plays: 1 }), true);
  assert.equal(open('streak-keeper', { bestStreak: 4 }), false);
  assert.equal(open('streak-keeper', { bestStreak: 5 }), true);
  assert.equal(open('set-collector', {}), false);
  assert.equal(open('set-collector', { setClaims: { a: true } }), true);
  const seen = (n) => { const c = {}; for (let i = 0; i < n; i++) { c['c' + i] = 1; } return { charityCounts: c }; };
  assert.equal(open('explorer', seen(9)), false);
  assert.equal(open('explorer', seen(10)), true);
  assert.equal(open('high-roller', { biggestCents: 9999 }), false);
  assert.equal(open('high-roller', { biggestCents: 10000 }), true);
  assert.equal(open('table-regular', { liveRounds: 4 }), false);
  assert.equal(open('table-regular', { liveRounds: 5 }), true);
  assert.equal(open('fair-play-fan', { verifies: 0 }), false);
  assert.equal(open('fair-play-fan', { verifies: 1 }), true);
  assert.equal(open('rank-climber', { totalCents: 499999 }), false);
  assert.equal(open('rank-climber', { totalCents: 500000 }), true);
});

test('resolve gives the chosen one while it is open and the default otherwise (a reset can close it again)', () => {
  const rich = { totalCents: 2000000, bestStreak: 10, plays: 5 };
  const poor = {};
  assert.equal(P.frames.resolve('rays', P.facts(rich), rich), 'rays');
  assert.equal(P.frames.resolve('rays', P.facts(poor), poor), 'plain');
  assert.equal(P.frames.resolve('nope', P.facts(rich), rich), 'plain');
  assert.equal(P.frames.resolve(undefined, P.facts(rich), rich), 'plain');
  assert.equal(P.frames.resolve(5, P.facts(rich), rich), 'plain');
  assert.equal(P.titles.resolve('giver', P.facts(rich), rich), 'giver');
  assert.equal(P.titles.resolve('giver', P.facts(poor), poor), '');
  assert.equal(P.titles.resolve('', P.facts(rich), rich), '');
  assert.equal(P.titles.resolve('nope', P.facts(rich), rich), '');
});

test('a later feature can register more frames and titles; a broken one is refused and a built-in cannot be replaced', () => {
  const frames = P.frames, titles = P.titles;
  const before = frames.list().length;
  assert.equal(frames.add({ id: 'season-gold', name: 'Season Gold', description: 'For the season track.', how: 'Reach tier 30.', unlocked: (f, save) => !!(save && save.tier >= 30) }), true);
  assert.equal(frames.list().length, before + 1);
  assert.equal(frames.get('season-gold').builtin, false);
  assert.equal(frames.isUnlocked('season-gold', P.facts({ tier: 30 }), { tier: 30 }), true);
  assert.equal(frames.isUnlocked('season-gold', P.facts({}), {}), false);
  // adding the same id again replaces it (a feature that registers twice)
  assert.equal(frames.add({ id: 'season-gold', name: 'Season Gold 2', how: 'x' }), true);
  assert.equal(frames.list().length, before + 1);
  assert.equal(frames.get('season-gold').name, 'Season Gold 2');
  assert.equal(frames.isUnlocked('season-gold', P.facts({}), {}), true, 'no rule means it is open');
  // a frame can bring its own picture
  assert.equal(frames.add({ id: 'sparkle', name: 'Sparkle', art: () => '<circle/>' }), true);
  assert.equal(typeof frames.get('sparkle').art, 'function');
  // refused
  for (const bad of [null, 5, 'x', {}, { id: 'A' }, { id: 'Bad Id', name: 'x' }, { id: 'ok-id' }, { id: 'ok-id', name: '   ' }, { id: 'ok-id', name: 'x'.repeat(31) }, { id: 'ok-id', name: 'x', unlocked: 'yes' }, { id: '-no', name: 'x' }, { id: 'a'.repeat(25), name: 'x' }]) {
    assert.equal(frames.add(bad), false, JSON.stringify(bad));
  }
  assert.equal(frames.add({ id: 'plain', name: 'Mine' }), false, 'a built-in stays as it is');
  assert.equal(frames.get('plain').name, 'Plain');
  assert.equal(titles.add({ id: 'quest-master', name: 'Quest Master', how: 'Finish 10 quests.', unlocked: () => false }), true);
  assert.equal(titles.has('quest-master'), true);
  assert.equal(titles.add({ id: 'giver', name: 'Mine' }), false);
});

test('a rule that throws, or answers anything but true, counts as locked', () => {
  const reg = P.titles;
  reg.add({ id: 't-throws', name: 'Throws', unlocked: () => { throw new Error('boom'); } });
  reg.add({ id: 't-truthy', name: 'Truthy', unlocked: () => 'yes' });
  reg.add({ id: 't-undef', name: 'Undef', unlocked: () => {} });
  assert.equal(reg.isUnlocked('t-throws', P.facts({}), {}), false);
  assert.equal(reg.isUnlocked('t-truthy', P.facts({}), {}), false);
  assert.equal(reg.isUnlocked('t-undef', P.facts({}), {}), false);
  assert.equal(reg.isUnlocked('missing', P.facts({}), {}), false);
  assert.equal(reg.resolve('t-throws', P.facts({}), {}), '');
  assert.doesNotThrow(() => reg.unlockedIds(P.facts({}), {}));
});

/* ------------------------------------------------------------------ favourites and recent rounds */

const CAUSES = { a: ['health'], b: ['health', 'kids'], c: ['animals'], d: ['kids'], e: [], f: ['animals', 'kids'] };
const causesOf = (id) => CAUSES[id] || [];
const round = (ts, ...allocs) => ({ ts, allocations: allocs.map(([charityId, cents]) => ({ charityId, cents })) });

test('favourites of an empty or odd history are empty, never an error', () => {
  const none = { charities: [], causes: [], rounds: 0 };
  for (const h of [[], undefined, null, 'x', 5, {}, [null, 5, 'x', {}, { allocations: 'no' }, { allocations: [] }, { allocations: [null, {}, { charityId: 5 }, { charityId: '' }] }]]) {
    assert.deepEqual(P.favourites(h, { causesOf }), none, JSON.stringify(h));
  }
  assert.deepEqual(P.favourites([]), none);
});

test('favourites: the most rounds first, three of each', () => {
  const h = [round(5, ['a', 100]), round(4, ['a', 100]), round(3, ['a', 100]), round(2, ['b', 500]), round(1, ['b', 500]), round(0, ['c', 900]), round(9, ['d', 100]), round(8, ['d', 100], ['e', 5])];
  const f = P.favourites(h, { causesOf });
  assert.deepEqual(f.charities.map((c) => [c.id, c.count]), [['a', 3], ['b', 2], ['d', 2]]);
  assert.equal(f.charities.length, 3);
  assert.equal(f.rounds, 8);
  assert.deepEqual(f.charities.find((c) => c.id === 'a'), { id: 'a', count: 3, cents: 300, last: 5 });
  // causes: health = a x3 + b x2 = 5 rounds, kids = b x2 + d x2 = 4, animals = c x1 = 1
  assert.deepEqual(f.causes.map((c) => [c.id, c.count]), [['health', 5], ['kids', 4], ['animals', 1]]);
  assert.equal(P.favourites(h, { causesOf, limit: 1 }).charities.length, 1);
  assert.equal(P.favourites(h, { causesOf, limit: 10 }).charities.length, 5);
  assert.equal(P.favourites(h, { causesOf, limit: 0 }).charities.length, 3, 'a limit that is not a positive number falls back to three');
});

test('favourites: ties go to the bigger gift, then the more recent round, then the id, and the same history always gives the same list', () => {
  // all four have one round: order by cents, then recency, then id
  const h = [round(10, ['x1', 300]), round(20, ['x2', 300]), round(30, ['x3', 900]), round(20, ['x0', 300])];
  const f = P.favourites(h, {});
  assert.deepEqual(f.charities.map((c) => c.id), ['x3', 'x0', 'x2'], 'most cents first, then the later round, then the lower id');
  // identical in every way: by id
  const t = P.favourites([round(1, ['q', 100]), round(1, ['p', 100]), round(1, ['r', 100])], {});
  assert.deepEqual(t.charities.map((c) => c.id), ['p', 'q', 'r']);
  // the order the rounds come in does not change the answer
  const rev = P.favourites(h.slice().reverse(), {});
  assert.deepEqual(rev.charities.map((c) => c.id), f.charities.map((c) => c.id));
  assert.deepEqual(P.favourites(h, {}), P.favourites(h, {}));
});

test('favourites: a cause counts once for a round however many of its charities were in it; cents add up for every charity', () => {
  const h = [round(1, ['a', 100], ['b', 100], ['c', 50])];
  const f = P.favourites(h, { causesOf });
  const health = f.causes.find((c) => c.id === 'health');
  assert.equal(health.count, 1, 'a and b are both health: still one round');
  assert.equal(health.cents, 200);
  assert.equal(f.causes.find((c) => c.id === 'kids').count, 1);
  assert.equal(f.causes.find((c) => c.id === 'kids').cents, 100);
  // a charity listed twice in one round is one round for it, with both amounts
  const dup = P.favourites([round(1, ['a', 100], ['a', 50])], {});
  assert.deepEqual(dup.charities[0], { id: 'a', count: 1, cents: 150, last: 1 });
});

test('favourites: junk amounts and times are treated as nothing, and charities that left the roster are skipped', () => {
  const h = [
    { ts: 'soon', allocations: [{ charityId: 'a', cents: 'lots' }, { charityId: 'a', cents: -5 }, { charityId: 'a', cents: NaN }, { charityId: 'a', cents: 1.9 }] },
    { ts: -1, allocations: [{ charityId: 'gone', cents: 500 }, { charityId: 'b', cents: 7 }] }
  ];
  const f = P.favourites(h, { causesOf, known: (id) => id !== 'gone' });
  assert.deepEqual(f.charities.map((c) => [c.id, c.count, c.cents, c.last]), [['a', 1, 1, 0], ['b', 1, 7, 0]].sort((x, y) => y[2] - x[2]));
  assert.equal(f.charities.find((c) => c.id === 'gone'), undefined);
  assert.equal(f.rounds, 2);
  // a round made only of unknown charities does not count as a round
  assert.equal(P.favourites([round(1, ['gone', 5])], { known: () => false }).rounds, 0);
  // a cause list that is not a list, or holds junk, is ignored
  assert.deepEqual(P.favourites([round(1, ['a', 5])], { causesOf: () => 'health' }).causes, []);
  assert.deepEqual(P.favourites([round(1, ['a', 5])], { causesOf: () => [5, null, '', 'health'] }).causes.map((c) => c.id), ['health']);
});

test('favourites: ids that are special words in JavaScript are just ids', () => {
  const h = [round(1, ['__proto__', 5]), round(2, ['constructor', 5]), round(3, ['toString', 5]), round(4, ['__proto__', 5])];
  const f = P.favourites(h, { causesOf: () => ['__proto__', 'hasOwnProperty'] });
  assert.deepEqual(f.charities.map((c) => [c.id, c.count]), [['__proto__', 2], ['toString', 1], ['constructor', 1]]);   // (the later of the two single rounds comes first)
  assert.equal(f.causes.length, 2);
  assert.equal(({}).polluted, undefined);
});

test('favourites: a very long history is handled fast and counted right', () => {
  const h = [];
  for (let i = 0; i < 200000; i++) { h.push(round(i, ['c' + (i % 7), 100 + (i % 3)], ['c' + ((i * 3) % 11), 50])); }
  const t0 = Date.now();
  const f = P.favourites(h, { causesOf: (id) => ['k' + (id.length % 3)] });
  assert.ok(Date.now() - t0 < 4000, 'took ' + (Date.now() - t0) + ' ms');
  assert.equal(f.rounds, 200000);
  assert.equal(f.charities.length, 3);
  assert.ok(f.charities[0].count >= f.charities[1].count && f.charities[1].count >= f.charities[2].count);
  // independent count for the first one
  const want = {};
  h.forEach((r) => { const seen = new Set(r.allocations.map((a) => a.charityId)); seen.forEach((id) => { want[id] = (want[id] || 0) + 1; }); });
  assert.equal(f.charities[0].count, Math.max(...Object.values(want)));
});

test('recentRounds: the newest rounds that can be shown, skipping the ones that cannot', () => {
  const ok = (id) => id !== 'gone';
  const h = [round(9, ['gone', 1]), { ts: 8, allocations: [] }, null, 'x', round(7, ['a', 1]), { ts: 6 }, round(5, ['b', 1], ['gone', 1]), round(4, ['c', 1]), round(3, ['d', 1])];
  assert.deepEqual(P.recentRounds(h, 8, ok).map((r) => r.ts), [7, 5, 4, 3]);
  assert.deepEqual(P.recentRounds(h, 2, ok).map((r) => r.ts), [7, 5]);
  assert.deepEqual(P.recentRounds(h, 0, ok).length, 4, 'no limit given: up to eight');
  assert.deepEqual(P.recentRounds(undefined, 8, ok), []);
  assert.deepEqual(P.recentRounds('x', 8, ok), []);
  assert.equal(P.recentRounds(h, 8)[0].ts, 9, 'without a check every round with an allocation counts');
  const many = []; for (let i = 0; i < 1000; i++) { many.push(round(i, ['a', 1])); }
  assert.equal(P.recentRounds(many, 8, ok).length, 8);
});

/* ------------------------------------------------------------------ simulated players */

test('a simulated player has the same made-up profile every time, from the name alone', () => {
  const causes = [{ id: 'kids', name: 'Kids & Youth' }, { id: 'animals', name: 'Animals' }, { id: 'health', name: 'Health' }];
  const games = [{ id: 'wheel', name: 'Lucky Wheel' }, { id: 'plinko', name: 'Plinko' }];
  const a = P.botDetails('PocketAces', { causes, games });
  assert.deepEqual(P.botDetails('PocketAces', { causes, games }), a);
  assert.equal(a.name, 'PocketAces');
  assert.deepEqual(a.standing, core.botStanding('PocketAces'));
  assert.equal(a.standing.bot, true);
  assert.ok(P.BOT_TITLES.includes(a.title));
  assert.ok(P.BOT_HABITS.includes(a.habit));
  assert.ok(causes.some((c) => c.id === a.cause.id));
  assert.ok(games.some((g) => g.id === a.game.id));
  assert.ok(a.streak >= 2 && a.streak <= 30);
  // different names give different bots (not all the same)
  const names = ['NovaGiver', 'MapleMoon', 'TurboTess', 'RiverRuby', 'OtterOllie', 'PixelPaw', 'SunnySid', 'KiwiKai', 'ZigZagZed', 'HoneyHawk'];
  const titles = new Set(names.map((n) => P.botDetails(n, { causes, games }).title));
  assert.ok(titles.size >= 4, 'the ten bots had ' + titles.size + ' different titles');
  const habits = new Set(names.map((n) => P.botDetails(n, { causes, games }).habit));
  assert.ok(habits.size >= 4);
});

test('a simulated player works for any name and without lists', () => {
  const bare = P.botDetails('Zed');
  assert.equal(bare.cause, null);
  assert.equal(bare.game, null);
  assert.ok(bare.title && bare.habit);
  for (const n of ['', null, undefined, 5, '<b>x</b>', 'Ünal', '日本語', 'x'.repeat(500), '  spaced   out  ', '😀']) {
    const d = P.botDetails(n, { causes: [], games: [] });
    assert.ok(d.name.length <= 40);
    assert.equal(typeof d.title, 'string');
    assert.equal(d.cause, null, 'an empty list gives no favourite');
  }
  assert.equal(P.botDetails('  spaced   out  ').name, 'spaced out');
  assert.equal(P.botDetails('x'.repeat(500)).name.length, 40);
});

test('a simulated player never says anything real: every line is plain, made-up and free of banned wording', () => {
  for (const t of P.BOT_TITLES.concat(P.BOT_HABITS)) { assert.doesNotMatch(t, BANNED_WORDS, t); assert.ok(t.length < 50); }
  assert.ok(P.BOT_TITLES.length >= 12 && P.BOT_HABITS.length >= 10);
  assert.equal(new Set(P.BOT_TITLES).size, P.BOT_TITLES.length);
});

/* ------------------------------------------------------------------ the browser's copy */

test('in a browser the module is published as GS.profile, GS.profileFrames and GS.profileTitles', () => {
  const sandbox = { GS: { core }, console };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/profile.js'), 'utf8'), sandbox, { filename: 'profile.js' });
  const GS = sandbox.GS;
  assert.equal(typeof GS.profile.validateName, 'function');
  assert.equal(GS.profileFrames, GS.profile.frames);
  assert.equal(GS.profileTitles, GS.profile.titles);
  assert.equal(GS.profileFrames.list().length, 8);
  assert.equal(GS.profile.validateName('fuck').ok, false);
  assert.equal(GS.profile.validateName('Sam').ok, true);
  assert.equal(GS.profile.facts({ totalCents: 100000 }).rank, 1, 'the page copy uses the page\'s own GS.core');
});
