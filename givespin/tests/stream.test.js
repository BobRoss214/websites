// Run with:  node --test givespin/tests/stream.test.js
// js/streamlib.js: Stream Mode's pure logic. The simulated chat vote (seeded, a pure function of the time that has passed), the shares that
// draw the vote bar, the keyboard shortcuts and the overlay link.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../js/streamlib.js');

const IDS = ['wateraid', 'oxfam', 'unicef', 'msf', 'rspca', 'nspcc', 'sightsavers'];
const key = (k, extra) => Object.assign({ key: k, target: { tag: 'BODY' } }, extra || {});
const ctx = { stream: true };

test('a vote plan is the same for the same seed and different for another', () => {
  const a = S.plan({ seed: 'x1', ids: IDS.slice(0, 4) });
  const b = S.plan({ seed: 'x1', ids: IDS.slice(0, 4) });
  const c = S.plan({ seed: 'x2', ids: IDS.slice(0, 4) });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.events, c.events);
  assert.equal(a.events.length, S.TICKS);
  assert.equal(a.durationMs, S.VOTE_MS);
});

test('the votes only grow with time, start at zero, and every candidate is in the count', () => {
  const p = S.plan({ seed: 'grow', ids: IDS.slice(0, 4) });
  assert.deepEqual(Object.keys(S.votesAt(p, 0)).sort(), IDS.slice(0, 4).slice().sort());
  assert.equal(S.total(S.votesAt(p, 0)), 0);
  let last = 0;
  for (let t = 0; t <= p.durationMs + 1000; t += 250) {
    const n = S.total(S.votesAt(p, t));
    assert.ok(n >= last, 'at ' + t + ' ms: ' + n + ' is below ' + last);
    last = n;
  }
  assert.equal(last, p.events.reduce((s, e) => s + e.n, 0), 'after the window every vote has been counted');
  assert.ok(p.events.every((e) => e.at > 0 && e.at < p.durationMs && e.n >= 1 && e.n <= 6 && IDS.includes(e.id)));
  // the same moment always gives the same count (no clock, no hidden state)
  assert.deepEqual(S.votesAt(p, 7300), S.votesAt(p, 7300));
});

test('a seeded vote has a leader, over many seeds the leader changes, and the vote is never empty', () => {
  const leaders = new Set();
  for (let i = 0; i < 40; i++) {
    const p = S.plan({ seed: 'seed' + i, ids: IDS.slice(0, 4) });
    const final = S.votesAt(p, p.durationMs);
    assert.ok(S.total(final) >= S.TICKS, 'at least one vote per moment');
    const lead = S.leader(final, p.ids);
    assert.ok(p.ids.includes(lead));
    leaders.add(lead);
  }
  assert.ok(leaders.size >= 3, 'the winner is not always the same charity: ' + [...leaders].join());
});

test('shares always add up to exactly 100, are whole numbers, and are ordered biggest first', () => {
  for (let i = 0; i < 200; i++) {
    const p = S.plan({ seed: 'sum' + i, ids: IDS.slice(0, 3 + (i % 3)) });
    const t = Math.round(((i * 37) % 21000));
    const rows = S.shares(S.votesAt(p, t), p.ids);
    const votes = S.total(S.votesAt(p, t));
    assert.equal(rows.length, p.ids.length);
    assert.equal(rows.reduce((s, r) => s + r.pct, 0), votes ? 100 : 0, 'seed ' + i + ' at ' + t);
    assert.ok(rows.every((r) => Number.isInteger(r.pct) && r.pct >= 0));
    for (let k = 1; k < rows.length; k++) { assert.ok(rows[k - 1].n >= rows[k].n); }
  }
  assert.deepEqual(S.shares({ a: 1, b: 1, c: 1 }, ['a', 'b', 'c']).map((r) => r.pct), [34, 33, 33], 'a three-way tie: the first listed gets the spare point');
  assert.deepEqual(S.shares({}, ['a', 'b']).map((r) => r.pct), [0, 0]);
  assert.deepEqual(S.shares({ a: 5 }, ['a', 'b']).map((r) => [r.id, r.pct]), [['a', 100], ['b', 0]]);
  // a live table keeps its own counts, with charities that have none yet left out of them: the same function draws its bar
  assert.deepEqual(S.shares({ x: 3, y: 1 }, ['y', 'x', 'z']).map((r) => [r.id, r.n]), [['x', 3], ['y', 1], ['z', 0]]);
});

test('the leader: nobody before the first vote, ties go to the first listed', () => {
  assert.equal(S.leader({}, ['a', 'b']), '');
  assert.equal(S.leader({ a: 0, b: 0 }, ['a', 'b']), '');
  assert.equal(S.leader({ a: 2, b: 2 }, ['a', 'b']), 'a');
  assert.equal(S.leader({ a: 2, b: 3 }, ['a', 'b']), 'b');
});

test('candidates come from the seed alone, whatever order the list came in, with no repeats', () => {
  const a = S.pickCandidates(IDS, 's1', 4);
  const b = S.pickCandidates(IDS.slice().reverse(), 's1', 4);
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, 4);
  assert.ok(a.every((id) => IDS.includes(id)));
  assert.notDeepEqual(a, S.pickCandidates(IDS, 's2', 4));
  assert.equal(S.pickCandidates(['a', 'a', 'b'], 's', 4).length, 2, 'fewer charities than asked: all of them, once');
  assert.deepEqual(S.pickCandidates([], 's', 4), []);
  assert.equal(S.pickCandidates(IDS, 's').length, S.CANDIDATES);
});

test('the clock rounds up and never goes below zero', () => {
  assert.equal(S.secondsLeft(20000), 20);
  assert.equal(S.secondsLeft(19001), 20);
  assert.equal(S.secondsLeft(1), 1);
  assert.equal(S.secondsLeft(0), 0);
  assert.equal(S.secondsLeft(-500), 0);
});

test('the overlay link names the page, the two switches and the game, and nothing else', () => {
  const loc = { protocol: 'https:', host: 'example.org', pathname: '/givespin/index.html' };
  assert.equal(S.overlayUrl(loc, 'game-wheel'), 'https://example.org/givespin/index.html?stream=1&overlay=1#game-wheel');
  assert.equal(S.overlayUrl(loc, '#live-derby10'), 'https://example.org/givespin/index.html?stream=1&overlay=1#live-derby10');
  assert.equal(S.overlayUrl({ protocol: 'file:', host: '', pathname: '/home/me/givespin/index.html' }, 'game-slots'), 'file:///home/me/givespin/index.html?stream=1&overlay=1#game-slots');
  // an address with a query or a fragment already in its path does not leak into the link, and a strange route falls back to a game
  assert.equal(S.overlayUrl({ protocol: 'http:', host: 'localhost:8000', pathname: '/index.html?name=Sam&balance=900#x' }, 'giving'), 'http://localhost:8000/index.html?stream=1&overlay=1#game-wheel');
  assert.equal(S.safeRoute('game-<script>'), 'game-wheel');
  assert.equal(S.safeRoute('charity-oxfam'), 'game-wheel');
  assert.equal(S.safeRoute('lobby'), 'lobby');
  assert.equal(S.safeRoute('tables-plinko'), 'tables-plinko');
  const url = S.overlayUrl(loc, 'game-roulette');
  assert.ok(!/name|balance|email|seed|secret|fast/i.test(url.replace('givespin', '')), 'nothing personal in it');
});

test('shortcuts: Space and Enter play only when nothing else has the keyboard', () => {
  assert.deepEqual(S.keyAction(key(' '), ctx), { action: 'play' });
  assert.deepEqual(S.keyAction(key('Enter'), ctx), { action: 'play' });
  assert.deepEqual(S.keyAction(key(' ', { target: { tag: 'MAIN', id: 'main' } }), ctx), { action: 'play' });
  assert.equal(S.keyAction(key(' ', { target: { tag: 'BUTTON' } }), ctx), null, 'on a button, Space is the button\'s own');
  assert.equal(S.keyAction(key('Enter', { target: { tag: 'A' } }), ctx), null);
  assert.equal(S.keyAction(key(' ', { repeat: true }), ctx), null, 'holding the key does not play again');
  assert.equal(S.keyAction(key(' '), { stream: true, busy: true }), null, 'not while a round is running');
});

test('shortcuts: 1 to 5, C, O and ? mean what Help says; other keys mean nothing', () => {
  for (let n = 1; n <= 5; n++) { assert.deepEqual(S.keyAction(key(String(n)), ctx), { action: 'amount', n }); }
  assert.equal(S.keyAction(key('0'), ctx), null);
  assert.equal(S.keyAction(key('6'), ctx), null);
  assert.deepEqual(S.keyAction(key('c'), ctx), { action: 'chat' });
  assert.deepEqual(S.keyAction(key('C'), ctx), { action: 'chat' });
  assert.deepEqual(S.keyAction(key('o'), ctx), { action: 'compact' });
  assert.deepEqual(S.keyAction(key('O'), ctx), { action: 'compact' });
  assert.deepEqual(S.keyAction(key('?'), ctx), { action: 'help' });
  ['a', 'x', 'Tab', 'ArrowLeft', 'F5', '7', '+'].forEach((k) => assert.equal(S.keyAction(key(k), ctx), null, k));
  // a digit on a focused button still picks an amount (a button has no use for a digit), and an amount cannot be changed mid-round
  assert.deepEqual(S.keyAction(key('3', { target: { tag: 'BUTTON' } }), ctx), { action: 'amount', n: 3 });
  assert.equal(S.keyAction(key('3'), { stream: true, busy: true }), null);
});

test('shortcuts: Esc leaves Stream Mode, but closes the "?" panel first and waits for a round to end', () => {
  assert.deepEqual(S.keyAction(key('Escape'), ctx), { action: 'exit' });
  assert.deepEqual(S.keyAction(key('Escape'), { stream: true, helpOpen: true }), { action: 'close-help' });
  assert.equal(S.keyAction(key('Escape'), { stream: true, busy: true }), null);
  assert.equal(S.keyAction(key('Escape'), { stream: true, dialogOpen: true }), null, 'a dialog\'s own Esc closes the dialog');
});

test('shortcuts never fire while typing, with Ctrl, Alt or Meta, with a dialog open, or outside Stream Mode', () => {
  const typing = [{ tag: 'INPUT', type: 'text' }, { tag: 'INPUT' }, { tag: 'INPUT', type: 'number' }, { tag: 'INPUT', type: 'search' }, { tag: 'TEXTAREA' }, { tag: 'SELECT' }, { tag: 'DIV', editable: true }, { tag: 'DIV', role: 'textbox' }, { tag: 'INPUT', type: 'text', role: 'combobox' }];
  typing.forEach((t) => ['c', 'o', '1', ' ', 'Enter', 'Escape', '?'].forEach((k) => assert.equal(S.keyAction(key(k, { target: t }), ctx), null, JSON.stringify(t) + ' ' + k)));
  ['ctrlKey', 'metaKey', 'altKey'].forEach((m) => ['c', '1', 'o', ' ', 'Escape'].forEach((k) => assert.equal(S.keyAction(key(k, { [m]: true }), ctx), null, m + ' ' + k)));
  assert.equal(S.keyAction(key('c'), { stream: true, dialogOpen: true }), null);
  assert.equal(S.keyAction(key('c'), { stream: false }), null);
  assert.equal(S.keyAction(key('c'), {}), null);
  assert.equal(S.keyAction(null, ctx), null);
  // a checkbox, a radio and a button are not places to type: C still works there (Space on them is their own, see above)
  assert.deepEqual(S.keyAction(key('c', { target: { tag: 'INPUT', type: 'checkbox' } }), ctx), { action: 'chat' });
  assert.equal(S.isTyping({ tag: 'INPUT', type: 'checkbox' }), false);
  assert.equal(S.isTyping(null), false);
});

test('the listed shortcuts are the ones the mapping understands', () => {
  const flat = [];
  S.SHORTCUTS.forEach((s) => s.keys.forEach((k) => flat.push(k)));
  assert.deepEqual(flat, ['Space', 'Enter', '1', '2', '3', '4', '5', 'C', 'O', '?', 'Esc']);
  flat.forEach((k) => {
    const real = k === 'Space' ? ' ' : k === 'Esc' ? 'Escape' : k;
    assert.ok(S.keyAction(key(real), ctx), k + ' is understood');
  });
});

test('a round id is the first 8 characters of the public fingerprint, never more, and falls back to a number', () => {
  assert.equal(S.roundId('3fa9c2d1b7e0aabbccdd', 4), '3FA9C2D1');
  assert.equal(S.roundId('', 4), 'R4');
  assert.equal(S.roundId(undefined, undefined), 'R1');
  assert.equal(S.roundId('zz', 2), 'R2');
  assert.equal(S.roundId('3fa9c2d1b7e0aabbccdd', 4).length, 8);
});

test('the source has no network calls, no real-money words and none of the banned words', () => {
  const src = fs.readFileSync(path.join(__dirname, '../js/streamlib.js'), 'utf8');
  assert.ok(!/fetch\(|XMLHttpRequest|WebSocket|sendBeacon/.test(src));
  const words = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/crypto|bitcoin|ethereum|blockchain|wallet|\bNFTs?\b|\btokens?\b|\bcoins?\b|cash out|jackpot|real players/i.test(words));
});
