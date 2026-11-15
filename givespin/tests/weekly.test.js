// Run with:  node --test givespin/tests/weekly.test.js
// js/weekly.js: the charity of the week (same week, same charity; a full walk through the roster before any repeat; the past list worked out
// backwards; the Sunday/Monday boundary of core.weekKey), the two sentences about it, and the bonus XP for backing it.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../js/core.js');
const weekly = require('../js/weekly.js');

const SRC = (f) => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8');

/** The roster and its helpers, loaded the way the page loads them. */
function loadData() {
  const sandbox = { window: {} };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SRC('data.js'), sandbox);
  return sandbox.GS;
}
const GS = loadData();
const roster = GS.charities;
const ids = roster.map((c) => c.id);
const N = roster.length;

const at = (y, m, d, h = 12, mi = 0, s = 0) => new Date(y, m - 1, d, h, mi, s);
const pick = (date) => weekly.current(roster, date).id;
const day = (d, k) => { const x = new Date(d.getTime()); x.setDate(x.getDate() + k); return x; };

test('a week key becomes a week number and back again, for every week of eight years (53-week years included)', () => {
  for (let i = -60; i < 420; i++) {
    const key = weekly.keyForIndex(i);
    assert.equal(weekly.weekIndex(key), i, key);
  }
  assert.equal(weekly.weekIndex('2024-W01'), 0);
  assert.equal(weekly.weekIndex('2024-W02'), 1);
  assert.equal(weekly.weekIndex('2025-W01'), 52, '2024 has 52 weeks');
  assert.equal(weekly.weekIndex('2026-W53') + 1, weekly.weekIndex('2027-W01'), '2026 has a 53rd week');
  assert.ok(Number.isNaN(weekly.weekIndex('nonsense')) && Number.isNaN(weekly.weekIndex('2026-W54')) && Number.isNaN(weekly.weekIndex('')));
});

test('the week number goes up by exactly one at each Monday midnight (the week core.weekKey names, Monday to Sunday) and at no other moment', () => {
  let last = null;
  let d = at(2023, 12, 20, 0, 0, 0);
  const end = at(2031, 1, 20, 0, 0, 0);
  let mondays = 0;
  while (d < end) {
    const idx = weekly.weekIndex(core.weekKey(d));
    const isMonday = d.getDay() === 1;
    if (last !== null) { assert.equal(idx - last, isMonday ? 1 : 0, d.toDateString()); }
    if (isMonday) { mondays += 1; }
    last = idx;
    d = day(d, 1);
  }
  assert.ok(mondays > 360);
});

test('the same week gives the same charity on every day and at every minute, and the next week gives a different one', () => {
  const mon = at(2026, 11, 2, 0, 0, 0);          // 2026-W45 starts on this Monday
  const first = pick(mon);
  for (let k = 0; k < 7; k++) {
    assert.equal(pick(day(mon, k)), first, 'day ' + k);
    assert.equal(pick(at(2026, 11, 2 + k, 23, 59, 59)), first, 'last second of day ' + k);
  }
  assert.notEqual(pick(day(mon, 7)), first);
  assert.notEqual(pick(day(mon, -1)), first, 'the Sunday before belongs to the week before');
  assert.equal(weekly.current(roster, mon).week, '2026-W45');
  assert.equal(weekly.current(roster, at(2026, 11, 1, 23, 59, 59)).week, '2026-W44', 'Sunday night is still the old week');
  assert.equal(weekly.current(roster, at(2026, 11, 2, 0, 0, 0)).week, '2026-W45', 'Monday 00:00 is the new one');
  const a = weekly.current(roster, at(2026, 11, 1, 23, 59, 59));
  const b = weekly.current(roster, at(2026, 11, 2, 0, 0, 0));
  assert.equal(b.index, a.index + 1);
  assert.notEqual(a.id, b.id);
});

test('the year boundary: the weeks around New Year follow core.weekKey, one charity each, none skipped or doubled', () => {
  const days = [at(2026, 12, 28), at(2027, 1, 3), at(2027, 1, 4), at(2024, 12, 29), at(2024, 12, 30), at(2025, 1, 5), at(2025, 1, 6)];
  assert.equal(pick(days[0]), pick(days[1]), '2026-W53 runs Monday 28 Dec to Sunday 3 Jan');
  assert.notEqual(pick(days[1]), pick(days[2]), '2027-W01 starts Monday 4 Jan');
  assert.equal(weekly.current(roster, days[1]).week, '2026-W53');
  assert.equal(weekly.current(roster, days[2]).week, '2027-W01');
  assert.equal(weekly.current(roster, days[3]).week, '2024-W52');
  assert.equal(weekly.current(roster, days[4]).week, '2025-W01');
  assert.equal(pick(days[4]), pick(days[5]));
  assert.notEqual(pick(days[3]), pick(days[4]));
});

test('no charity comes back before every other one has had a turn: any run of as many weeks as there are charities has no repeat', () => {
  const seq = [];
  for (let i = 0; i < 3 * N + 5; i++) { seq.push(weekly.spotlightId(ids, weekly.keyForIndex(i - N))); }
  assert.ok(seq.every((id) => ids.includes(id)));
  const seen = new Set();
  for (let i = 0; i < seq.length; i++) {
    if (i >= N) { seen.delete(seq[i - N]); }
    assert.ok(!seen.has(seq[i]), 'week ' + i + ' repeats ' + seq[i] + ' inside one full walk');
    seen.add(seq[i]);
  }
  assert.equal(new Set(seq.slice(0, N)).size, N, 'one walk gives every charity exactly one week');
  assert.deepEqual(seq.slice(N, 2 * N), seq.slice(0, N), 'and the walk is the same order again afterwards');
});

test('the order does not depend on how the roster happens to be listed, and the weeks are not simply alphabetical', () => {
  const shuffled = core.seededShuffle(ids, 'any other order');
  for (let i = 0; i < 40; i++) { assert.equal(weekly.spotlightId(shuffled, weekly.keyForIndex(i)), weekly.spotlightId(ids, weekly.keyForIndex(i))); }
  const run = [];
  for (let i = 100; i < 110; i++) { run.push(weekly.spotlightId(ids, weekly.keyForIndex(i))); }
  assert.notDeepEqual(run, run.slice().sort(), 'ten weeks in a row are not in alphabetical order');
});

test('the past spotlights are recomputed backwards, match what each of those weeks showed, and nothing is stored', () => {
  const now = at(2026, 11, 3, 15, 30);
  const list = weekly.past(roster, now, 12);
  assert.equal(list.length, 12);
  const cur = weekly.current(roster, now);
  assert.equal(cur.week, '2026-W45');
  assert.equal(list[0].week, '2026-W44', 'the most recent past week comes first');
  list.forEach((p, i) => {
    const then = day(now, -7 * (i + 1));
    assert.equal(p.week, core.weekKey(then), 'week ' + i);
    assert.equal(p.id, pick(then), 'the charity of ' + p.week);
    assert.equal(p.charity.id, p.id);
    assert.equal(p.index, cur.index - (i + 1));
    assert.equal(p.start.getDay(), 1, 'a week starts on a Monday');
    assert.equal(p.end.getDay(), 0, 'and ends on a Sunday');
    assert.equal(Math.round((p.end - p.start) / 86400000), 6);
    assert.equal(core.weekKey(p.start), p.week);
    assert.equal(core.weekKey(p.end), p.week);
    assert.notEqual(p.id, cur.id, 'this week\'s charity is not in the past list');
  });
  assert.equal(new Set(list.map((p) => p.id)).size, 12, 'twelve different charities');
  // asked a week later, the list has moved along by one and the old first entry is now second
  const later = weekly.past(roster, day(now, 7), 12);
  assert.equal(later[1].id, list[0].id);
  assert.equal(later[0].id, cur.id);
  // the same answer at any time of that week
  assert.deepEqual(weekly.past(roster, at(2026, 11, 2, 0, 0, 0), 12).map((p) => p.id), list.map((p) => p.id));
  assert.deepEqual(weekly.past(roster, at(2026, 11, 8, 23, 59, 59), 12).map((p) => p.id), list.map((p) => p.id));
});

test('a roster of one, two or none still gives an answer and never throws', () => {
  assert.equal(weekly.current([], at(2026, 11, 3)).id, null);
  assert.equal(weekly.current([], at(2026, 11, 3)).charity, null);
  const one = [roster[0]];
  assert.equal(weekly.current(one, at(2026, 11, 3)).id, roster[0].id);
  assert.deepEqual(weekly.past(one, at(2026, 11, 3), 3).map((p) => p.id), [roster[0].id, roster[0].id, roster[0].id]);
  const two = roster.slice(0, 2);
  const a = weekly.current(two, at(2026, 11, 3)).id;
  const b = weekly.current(two, at(2026, 11, 10)).id;
  assert.notEqual(a, b, 'two charities take turns');
  assert.equal(weekly.spotlightId(ids, 'rubbish'), null);
});

test('days left in the week count down to the next Monday', () => {
  assert.equal(weekly.daysLeft(at(2026, 11, 2)), 7, 'Monday');
  assert.equal(weekly.daysLeft(at(2026, 11, 4)), 5, 'Wednesday');
  assert.equal(weekly.daysLeft(at(2026, 11, 8, 23, 59)), 1, 'Sunday night');
});

/* ------------------------------------------------------------------ the bonus */

test('the bonus: a flat 25 XP for backing the charity of the week, win or lose, on top of the old bonus for backing a winner', () => {
  assert.equal(weekly.SPOTLIGHT_XP, 25);
  const spot = 'wateraid';
  assert.deepEqual(weekly.roundBonus(null, spot), { pick: 0, spotlight: 0, total: 0 }, 'nothing backed');
  assert.deepEqual(weekly.roundBonus({ id: 'oxfam', won: false, wins: 0, board: 8 }, spot), { pick: 0, spotlight: 0, total: 0 }, 'another charity, lost');
  const old = core.pickBonusXp(8, 2);
  assert.deepEqual(weekly.roundBonus({ id: 'oxfam', won: true, wins: 2, board: 8 }, spot), { pick: old, spotlight: 0, total: old }, 'the old bonus is exactly as before');
  assert.deepEqual(weekly.roundBonus({ id: spot, won: false, wins: 0, board: 8 }, spot), { pick: 0, spotlight: 25, total: 25 }, 'backed it and it lost: still 25');
  assert.deepEqual(weekly.roundBonus({ id: spot, won: true, wins: 1, board: 500 }, spot), { pick: core.pickBonusXp(500, 1), spotlight: 25, total: core.pickBonusXp(500, 1) + 25 }, 'backed it and it won: both');
  assert.equal(weekly.roundBonus({ id: spot, won: true, wins: 3, board: 8 }, spot).spotlight, 25, 'a gift split into several rounds gets the 25 once, not once per round');
  assert.equal(weekly.roundBonus({ id: spot, won: true, wins: 1, board: 8 }, '').spotlight, 0, 'no charity of the week, no bonus');
  assert.equal(weekly.roundBonus({ id: '', won: true, wins: 1, board: 8 }, '').spotlight, 0);
});

test('the bonus flows into the saved XP: 10 XP per $1, plus the bonus, reported separately from the gift', () => {
  const data = new Map();
  const sandbox = { localStorage: { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => { data.set(k, String(v)); }, removeItem: (k) => { data.delete(k); } }, CustomEvent, dispatchEvent: () => true };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  ['core.js', 'config.js', 'data.js', 'store.js'].forEach((f) => vm.runInContext(SRC(f), sandbox, { filename: f }));
  const S = sandbox.GS.store;
  const spot = weekly.current(sandbox.GS.charities, new Date()).id;
  const play = (cents, pickInfo) => {
    const b = weekly.roundBonus(pickInfo, spot);
    return S.recordPlay({ game: 'roulette', totalCents: cents, rounds: 1, status: 'done', pay: 'credit', allocations: [{ charityId: spot, cents, hits: 1 }], pick: pickInfo ? { charityId: pickInfo.id, won: pickInfo.won, board: pickInfo.board } : null, bonusXp: b.total });
  };
  const miss = play(2500, { id: spot, won: false, wins: 0, board: 8 });
  assert.equal(miss.giftXp, 250);
  assert.equal(miss.bonusXp, 25);
  assert.equal(miss.xpGain, 275, 'a $25 gift with the charity of the week backed and not winning');
  const none = play(1000, null);
  assert.equal(none.bonusXp, 0);
  assert.equal(none.xpGain, 100, 'without a charity backed the XP is the gift\'s alone');
  assert.equal(S.get().xp, 375);
});

/* ------------------------------------------------------- the two sentences */

const SUPER = /\b(best|better|most|least|largest|biggest|greatest|highest|top|leading|leader|leaders|lead|leads|only|first|premier|finest|foremost|world-class|pioneer|pioneering|major|unique|ultimate|number one|trusted|famous|renowned|cost-effective|guarantee|guaranteed|miracle|every|always|never|free|#1)\b/i;

test('every one of the roster\'s charities gets exactly two sentences, built from its own entry, with no superlative, no amount and no number', () => {
  const abbrev = /\b(St|Dr|Mr|Mrs|Ms|Inc|Ltd|Co|Mt|No|vs)\.|\b(?:[A-Z]\.){2,}/g;
  const bad = [];
  roster.forEach((c) => {
    const e = weekly.explain(c, GS);
    if (e.sentences.length !== 2) { bad.push(c.id + ': ' + e.sentences.length + ' sentences'); return; }
    e.sentences.forEach((s, i) => {
      if (!/^[A-Za-z0-9]/.test(s) || !/\.$/.test(s)) { bad.push(c.id + ' #' + i + ' is not a sentence: ' + s); }
      // the charity's own name may hold a number, a full stop or a word like "First" or "Free": only the words around it are checked
      let rest = s;
      [c.name, c.short].forEach((n) => { rest = rest.split(n).join(' '); });
      if ((rest.replace(abbrev, '').match(/[.!?]\s+[A-Z0-9]/g) || []).length) { bad.push(c.id + ' #' + i + ' is more than one sentence: ' + s); }
      if (/[0-9$%]/.test(rest)) { bad.push(c.id + ' #' + i + ' has a number or an amount: ' + s); }
      if (SUPER.test(rest)) { bad.push(c.id + ' #' + i + ' has a superlative or a claim (' + rest.match(SUPER)[0] + '): ' + s); }
      if (i === 1 && /\b(buys?|bought|pays? for|covers?|provides? \w+ for)\b/i.test(rest)) { bad.push(c.id + ' #' + i + ' says what a gift buys: ' + s); }
    });
    if (e.text !== e.sentences.join(' ')) { bad.push(c.id + ': text is not the two sentences'); }
    if (e.sentences[1].indexOf('A gift to ') !== 0) { bad.push(c.id + ': second sentence'); }
  });
  assert.deepEqual(bad, []);
});

test('the sentences use only what the entry says: the description word for word, or its causes; who it helps, where and how from its own tags', () => {
  const samples = [];
  roster.forEach((c) => {
    const e = weekly.explain(c, GS);
    if (e.from === 'description') { assert.equal(e.sentences[0], c.blurb.trim(), c.id + ': its own description, unchanged'); }
    else {
      const names = c.causes.slice(0, 2).map((id) => GS.cause(id).name.toLowerCase());
      names.forEach((n) => assert.ok(e.sentences[0].toLowerCase().includes(n), c.id + ': names its cause ' + n + ': ' + e.sentences[0]));
      assert.ok(e.sentences[0].indexOf(/\.$/.test(c.short) ? c.name : c.short) === 0, c.id + ': starts with its name');
    }
    const s2 = e.sentences[1];
    if (!c.serves.length) { assert.ok(!/ helping /.test(s2), c.id + ': says nobody in particular is helped when the entry names none: ' + s2); }
    if (c.where.indexOf('us') >= 0) { assert.ok(s2.includes('the United States'), c.id + ': ' + s2); }
    if (c.where.indexOf('uk') >= 0) { assert.ok(s2.includes('the United Kingdom'), c.id + ': ' + s2); }
    if (c.where.indexOf('australia') >= 0) { assert.ok(s2.includes('Australia'), c.id + ': ' + s2); }
    if (c.where.indexOf('global') >= 0) { assert.ok(/worldwide/.test(s2), c.id + ': ' + s2); }
    if (c.where.indexOf('africa') >= 0) { assert.ok(s2.includes('Africa'), c.id + ': ' + s2); }
    if (c.how.indexOf('research') >= 0) { assert.ok(s2.includes('research'), c.id + ': ' + s2); }
    if (samples.length < 3 && e.from === 'description') { samples.push(e.text); }
  });
  const fromFacts = roster.filter((c) => weekly.explain(c, GS).from === 'facts').length;
  const fromBlurb = N - fromFacts;
  assert.ok(fromBlurb > N * 0.6, 'most charities speak in their own words: ' + fromBlurb + ' of ' + N);
  assert.ok(fromFacts > 0, 'and the descriptions that make a claim are left out');
});

test('a description that makes a claim, names a number or runs to two sentences is never repeated', () => {
  [
    'The leading advocacy organization for cats.', 'Leads the movement to bring the country to no-kill.', 'Researches the most cost-effective giving.',
    'Free, world-class lessons for anyone.', 'The nation\'s largest grassroots mental health organization.', 'Pioneering research and care. Families never receive a bill.',
    'Works in 44 countries.', 'Gives $5 to every family.', 'Fights hunger!', 'Brings music to schools. Known as Something until 2022.', 'No full stop at the end'
  ].forEach((t) => assert.equal(weekly.safeBlurb(t), false, t));
  [
    'Brings clean, safe drinking water to people in developing countries.', 'Flies veterans to Washington, D.C. to visit the memorials built for them.',
    'Provides college scholarships to children of U.S. Marines and Navy Corpsmen.'
  ].forEach((t) => assert.equal(weekly.safeBlurb(t), true, t));
});

test('every id the roster uses for who, where and how has a plain word in js/weekly.js (a new one added to the roster must be added there)', () => {
  GS.facets.serves.forEach((f) => assert.ok(weekly.SERVES[f.id], 'serves: ' + f.id));
  GS.facets.how.forEach((f) => assert.ok(weekly.HOW[f.id], 'how: ' + f.id));
  GS.facets.where.forEach((f) => assert.ok(weekly.HOME[f.id] || weekly.FOCUS[f.id] || f.id === 'global', 'where: ' + f.id));
  assert.equal(weekly.explain(roster[0], GS).sentences.length, 2);
});

test('sample sentences read plainly', () => {
  const by = (id) => weekly.explain(GS.charity(id), GS).sentences;
  assert.deepEqual(by('charity-water'), ['Brings clean, safe drinking water to people in developing countries.', 'A gift to charity: water supports its work worldwide, through funding for other groups.']);
  assert.equal(by('dogs-trust')[1], 'A gift to Dogs Trust supports its work in the United Kingdom and worldwide, through direct help and training.');
  assert.equal(by('aarp-foundation')[1], 'A gift to AARP Foundation supports its work helping older adults in the United States, through direct help and advocacy.');
  assert.equal(by('cancer-research-institute')[0], 'Cancer Research Institute is a charity working on cancer and health care.', 'its own description says "leading", so the sentence is built from its causes instead');
});
