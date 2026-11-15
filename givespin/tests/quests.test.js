// Run with:  node --test givespin/tests/quests.test.js     (also try it with TZ=Pacific/Auckland, TZ=America/New_York, TZ=Asia/Kolkata)
// js/quests.js: the daily and weekly quests (picked from the date, progress worked out from the saved rounds), the 30-tier season track, the head start for
// late joiners, claiming (each key once), the cosmetics store, and the wording of everything a visitor can read.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../js/core.js');
const Q = require('../js/quests.js');

const SRC = (f) => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8');
const at = (y, m, d, h = 12, mi = 0, s = 0) => new Date(y, m - 1, d, h, mi, s);
const dk = (y, m, d) => core.dayKey(at(y, m, d));
const ALL = { live: true, demo: true };

/** The input advance() wants, with sensible defaults: Wednesday 4 November 2026 at noon, nothing played. */
const input = (over) => Object.assign({ now: at(2026, 11, 4, 12), history: [], save: {}, counters: {}, spotlightId: '', causesOf: () => [], live: true, demo: true, owns: () => false }, over || {});
let n = 0;
/** A saved round at a time, as the store keeps it. */
const round = (when, over) => Object.assign({ id: 'r' + (n++), ts: when.getTime(), game: 'wheel', totalCents: 500, rounds: 1, status: 'ok', pay: 'credit', freq: 'once', allocations: [{ charityId: 'c1', cents: 500 }] }, over || {});
const zone = (tz, fn) => { const old = process.env.TZ; process.env.TZ = tz; try { fn(); } finally { if (old === undefined) { delete process.env.TZ; } else { process.env.TZ = old; } } };

test('the catalogue: 15 daily and 10 weekly quests, each with a unique id, a plain sentence and a target, and nothing throws on an empty save', () => {
  assert.equal(Q.DAILY.length, 15);
  assert.equal(Q.WEEKLY.length, 10);
  const ids = Q.DAILY.concat(Q.WEEKLY).map((t) => t.id);
  assert.equal(new Set(ids).size, 25);
  Q.DAILY.forEach((t) => assert.match(t.id, /^d-[a-z0-9]+$/, t.id));
  Q.WEEKLY.forEach((t) => assert.match(t.id, /^w-[a-z0-9]+$/, t.id));
  Q.DAILY.concat(Q.WEEKLY).forEach((t) => {
    assert.ok(t.target >= 1 && Number.isInteger(t.target), t.id);
    assert.ok(t.text.length > 8 && t.text.length < 60 && !/[!]/.test(t.text), t.text);
    assert.equal(Q.measure(t.id, null, input()), 0, t.id + ' starts at 0 on an empty save');
  });
});

test('picking: three daily quests from the date alone, the same all day and for everyone, never two of a kind', () => {
  const seen = {};
  for (let i = 0; i < 400; i++) {
    const d = new Date(2026, 0, 1 + i);
    const key = core.dayKey(d);
    const a = Q.pickDaily(key, ALL);
    assert.equal(a.length, 3, key);
    assert.deepEqual(Q.pickDaily(key, ALL), a, 'the same day gives the same quests');
    assert.equal(new Set(a.map((id) => Q.quest(id).family)).size, 3, key + ' has two quests of the same kind');
    a.forEach((id) => { seen[id] = (seen[id] || 0) + 1; });
  }
  assert.equal(Object.keys(seen).length, 15, 'every daily quest comes up within 400 days');
  Object.keys(seen).forEach((id) => assert.ok(seen[id] > 30, id + ' comes up ' + seen[id] + ' times in 400 days'));
  let same = 0;
  for (let i = 0; i < 100; i++) { if (Q.pickDaily(dk(2026, 3, 1 + i % 28), ALL).join() === Q.pickDaily(dk(2026, 3, 2 + i % 28), ALL).join()) { same++; } }
  assert.ok(same < 10, 'neighbouring days are not the same list');
});

test('picking: three weekly quests per ISO week, the same on all seven days of it (Monday to Sunday) and a new set on the Monday', () => {
  let changed = 0;
  let prev = '';
  for (let w = 0; w < 120; w++) {
    const monday = new Date(2026, 0, 5 + 7 * w);
    const key = core.weekKey(monday);
    const set = Q.pickWeekly(key, ALL);
    assert.equal(set.length, 3, key);
    assert.equal(new Set(set.map((id) => Q.quest(id).family)).size, 3, key + ' has two weekly quests of the same kind');
    for (let k = 0; k < 7; k++) { assert.equal(core.weekKey(new Date(2026, 0, 5 + 7 * w + k, 23, 59)), key, 'Monday to Sunday is one week'); }
    if (set.join() !== prev) { changed++; }
    prev = set.join();
  }
  assert.ok(changed > 100, 'the weekly set changes nearly every week: ' + changed);
  const seen = new Set();
  for (let w = 0; w < 200; w++) { Q.pickWeekly(core.weekKey(new Date(2026, 0, 5 + 7 * w)), ALL).forEach((id) => seen.add(id)); }
  assert.equal(seen.size, 10, 'every weekly quest comes up');
});

test('picking: quests that need live tables or the demo wheel are replaced by other quests where those do not exist, and only then', () => {
  const needs = (id) => Q.quest(id).needs;
  let affected = 0;
  for (let i = 0; i < 200; i++) {
    const key = core.dayKey(new Date(2026, 5, 1 + i));
    const full = Q.pickDaily(key, ALL);
    const lean = Q.pickDaily(key, { live: false, demo: false });
    assert.equal(lean.length, 3);
    assert.ok(lean.every((id) => !needs(id)), key);
    if (full.every((id) => !needs(id))) { assert.deepEqual(lean, full, 'a day with nothing special is the same everywhere'); } else { affected++; }
  }
  assert.ok(affected > 10 && affected < 120, 'some days are affected: ' + affected);
  for (let w = 0; w < 80; w++) {
    const key = core.weekKey(new Date(2026, 0, 5 + 7 * w));
    const lean = Q.pickWeekly(key, { live: false, demo: false });
    assert.equal(lean.length, 3);
    assert.ok(lean.every((id) => !needs(id)));
  }
});

test('progress comes from the saved rounds of the right day: charities, games, rounds, causes, backing, live, split, direct, slots, races', () => {
  const T = at(2026, 11, 4, 10);
  const causes = { c1: ['animals'], c2: ['animals', 'health'], c3: ['water'] };
  const mk = (over) => input({ causesOf: (id) => causes[id] || [], spotlightId: 'c3', history: over });
  const alloc = (...ids) => ({ allocations: ids.map((id) => ({ charityId: id, cents: 100 })) });
  const h = [
    round(at(2026, 11, 4, 9), Object.assign({ game: 'wheel' }, alloc('c1'))),
    round(at(2026, 11, 4, 11), Object.assign({ game: 'slots', rounds: 3, pick: { charityId: 'c3', won: false, board: 8 } }, alloc('c2', 'c3'))),
    round(at(2026, 11, 4, 12), Object.assign({ game: 'derby', live: { pot: 1000, players: 5, stake: 500, pick: 'c1', won: false, winner: 'c2' } }, alloc('c1'))),
    round(at(2026, 11, 4, 13), Object.assign({ game: 'direct', direct: true }, alloc('c3'))),
    round(at(2026, 11, 3, 23, 59), Object.assign({ game: 'plinko' }, alloc('c9'))),            // yesterday
    round(at(2026, 11, 5, 0, 1), Object.assign({ game: 'plinko' }, alloc('c8')))                // tomorrow
  ];
  const m = (id) => Q.measure(id, null, mk(h));
  assert.equal(m('d-charities3'), 3, 'c1, c2, c3 today (c9 was yesterday, c8 tomorrow)');
  assert.equal(m('d-games2'), 3, 'wheel, slots, derby (a direct gift is not a game)');
  assert.equal(m('d-rounds3'), 4);
  assert.equal(m('d-causes2'), 3, 'animals, health, water');
  assert.equal(m('d-back'), 1);
  assert.equal(m('d-spotlight'), 1, 'c3 is the charity of the week');
  assert.equal(Q.measure('d-spotlight', null, input({ history: h, spotlightId: 'c1' })), 0, 'backing another charity does not count');
  assert.equal(m('d-live'), 1);
  assert.equal(m('d-split'), 1);
  assert.equal(m('d-direct'), 1);
  assert.equal(m('d-slots'), 1);
  assert.equal(m('d-race'), 1);
  assert.equal(Q.measure('d-slots', null, input({ history: [round(at(2026, 11, 4, 9), { game: 'goldrush' })] })), 1, 'all five machines are slots');
  assert.equal(m('w-charities8'), 5, 'the week counts all of Monday to Sunday: c1, c2, c3, c8, c9');
  assert.equal(m('w-games5'), 4, 'wheel, slots, derby, plinko');
  assert.equal(m('w-days4'), 3, 'Wednesday, Tuesday and Thursday');
  assert.equal(m('w-live3'), 1);
  assert.equal(m('w-spotlight'), 1);
  assert.equal(T.getDay(), 3);
});

test('progress from the save: the streak, the daily wheel, cards, the Charity Cup', () => {
  const lastToday = { streak: 4, lastDay: '2026-11-04' };
  assert.equal(Q.measure('d-streak3', null, input({ save: lastToday })), 4);
  assert.equal(Q.measure('d-streak3', null, input({ save: { streak: 4, lastDay: '2026-11-03' } })), 0, 'a streak that was last given to yesterday is not kept going today');
  assert.equal(Q.measure('w-streak5', null, input({ save: { streak: 5, lastDay: '2026-11-02' } })), 5, 'given on Monday of this week');
  assert.equal(Q.measure('w-streak5', null, input({ save: { streak: 9, lastDay: '2026-11-01' } })), 0, 'Sunday last week');
  assert.equal(Q.measure('d-wheel', null, input({ save: { daily: { day: '2026-11-04', claims: 3 } } })), 1);
  assert.equal(Q.measure('d-wheel', null, input({ save: { daily: { day: '2026-11-03', claims: 3 } } })), 0);
  const cards = { a: { n: 1, rarity: 'rare', ts: at(2026, 11, 4, 8).getTime() }, b: { n: 1, rarity: 'common', ts: at(2026, 11, 2, 8).getTime() }, c: { n: 1, rarity: 'common', ts: at(2026, 10, 30, 8).getTime() } };
  assert.equal(Q.measure('d-card', null, input({ save: { cards } })), 1);
  assert.equal(Q.measure('d-card', null, input({ save: { cards: { x: 'junk', y: null, z: { ts: 'no' } } } })), 0, 'odd cards are ignored');
  assert.equal(Q.measure('w-cup', null, input({ save: { cup: { key: core.weekKey(at(2026, 11, 4)), pick: 'c1' } } })), 1);
  assert.equal(Q.measure('w-cup', null, input({ save: { cup: { key: core.weekKey(at(2026, 11, 4)), pick: '' } } })), 0, 'no champion picked yet');
  assert.equal(Q.measure('w-cup', null, input({ save: { cup: { key: '2026-W40', pick: 'c1' } } })), 0, 'last week\'s cup');
});

test('verifying: a running total becomes counts per day, and what was verified before the quests existed does not count', () => {
  const marks = {};
  Q.trackCounter(marks, 'verifies', 7, '2026-11-02');
  assert.deepEqual(marks.verifies, { last: 7, days: {} }, 'the first sight is only a starting point');
  Q.trackCounter(marks, 'verifies', 8, '2026-11-03');
  Q.trackCounter(marks, 'verifies', 8, '2026-11-03');
  Q.trackCounter(marks, 'verifies', 10, '2026-11-04');
  assert.deepEqual(marks.verifies.days, { '2026-11-03': 1, '2026-11-04': 2 });
  Q.trackCounter(marks, 'verifies', 0, '2026-11-04');
  assert.equal(marks.verifies.last, 0, 'a reset moves the starting point down');
  Q.trackCounter(marks, 'verifies', 1, '2026-11-05');
  assert.equal(marks.verifies.days['2026-11-05'], 1);
  // through advance(): day and week
  let st = Q.advance(null, input({ counters: { verifies: 5 } })).state;
  st = Q.advance(st, input({ counters: { verifies: 6 } })).state;
  assert.equal(Q.measure('d-verify', st, input()), 1);
  assert.equal(Q.measure('w-verify2', st, input()), 1);
  st = Q.advance(st, input({ now: at(2026, 11, 3, 12), counters: { verifies: 7 } })).state;      // (an earlier day this week)
  assert.equal(Q.measure('w-verify2', st, input()), 2, 'the week adds up its days');
  assert.equal(Q.measure('d-verify', st, input()), 1, 'but today is still one');
});

test('a quest\'s progress never goes down within its day, even when the store forgets old rounds (it keeps only the latest 60)', () => {
  let day = null;
  for (let i = 0; i < 60 && !day; i++) { const d = new Date(2026, 2, 1 + i, 12); if (Q.pickDaily(core.dayKey(d), ALL).indexOf('d-charities3') >= 0) { day = d; } }
  assert.ok(day, 'found a day with the quest');
  const mk = (h) => input({ now: day, history: h });
  const at1 = (i, id) => round(new Date(day.getTime() + i * 60000), { allocations: [{ charityId: id, cents: 100 }] });
  const three = [at1(0, 'a'), at1(1, 'b'), at1(2, 'c')];
  const find = (st, h) => Q.advance(st, mk(h)).view.daily.find((x) => x.id === 'd-charities3');
  let st = Q.advance(null, mk(three)).state;
  assert.deepEqual([find(st, three).value, find(st, three).done], [3, true]);
  const later = [at1(5, 'c')];                       // the three earlier rounds have scrolled out of the store
  assert.equal(find(st, later).value, 3, 'the progress stays');
  assert.equal(find(st, later).done, true);
  // without the memory the same history would show 1
  assert.equal(find(Q.normState(null), later).value, 1);
  // and the next day starts again from what the rounds say
  const tomorrow = Q.advance(st, input({ now: new Date(day.getTime() + 86400000), history: later })).view.daily;
  assert.ok(tomorrow.every((q) => q.value === 0 || q.id !== 'd-charities3'));
});

test('a quest is "fresh" once when it is completed; the first look at a save is silent', () => {
  let day = null;
  for (let i = 0; i < 60 && !day; i++) { const d = new Date(2026, 2, 1 + i, 12); if (Q.pickDaily(core.dayKey(d), ALL).indexOf('d-rounds3') >= 0) { day = d; } }
  const mk = (h) => input({ now: day, history: h });
  const rows = (k) => Array.from({ length: k }, (_, i) => round(new Date(day.getTime() + i * 60000)));
  let out = Q.advance(null, mk(rows(3)));
  assert.equal(out.view.fresh.length, 0, 'already done when first seen: silent');
  assert.ok(out.view.daily.find((q) => q.id === 'd-rounds3').done);
  out = Q.advance(null, mk(rows(1)));
  out = Q.advance(out.state, mk(rows(2)));
  assert.equal(out.view.fresh.length, 0);
  out = Q.advance(out.state, mk(rows(3)));
  assert.deepEqual(out.view.fresh.map((q) => q.id), ['d-rounds3']);
  out = Q.advance(out.state, mk(rows(4)));
  assert.equal(out.view.fresh.length, 0, 'never announced twice');
});

test('local days and weeks: 23:59 and 00:01, Sunday night and Monday morning, and the clock-change days in six zones', () => {
  const zones = ['UTC', 'America/New_York', 'Europe/London', 'Australia/Lord_Howe', 'Pacific/Auckland', 'Asia/Kolkata', 'Pacific/Kiritimati', 'America/Sao_Paulo'];
  zones.forEach((tz) => zone(tz, () => {
    // Sunday 23:59:59 and Monday 00:00:00 of an ordinary week
    const sun = new Date(2026, 5, 7, 23, 59, 59);
    const mon = new Date(2026, 5, 8, 0, 0, 0);
    assert.equal(Q.dayOfTs(sun.getTime()), '2026-06-07', tz);
    assert.equal(Q.dayOfTs(mon.getTime()), '2026-06-08', tz);
    assert.notEqual(Q.weekOfDay(Q.dayOfTs(sun.getTime())), Q.weekOfDay(Q.dayOfTs(mon.getTime())), tz + ': Sunday night and Monday morning are different weeks');
    // every day of 2026, at 00:00:01 and 23:59:59, belongs to the day the calendar says (this crosses every clock change in the zone)
    for (let i = 0; i < 365; i++) {
      const a = new Date(2026, 0, 1 + i, 0, 0, 1);
      const b = new Date(2026, 0, 1 + i, 23, 59, 59);
      assert.equal(Q.dayOfTs(a.getTime()), core.dayKey(a), tz + ' ' + i);
      assert.equal(Q.dayOfTs(a.getTime()), Q.dayOfTs(b.getTime()), tz + ' day ' + i + ' is one day from first to last second');
      assert.equal(Q.weekOfDay(Q.dayOfTs(a.getTime())), core.weekKey(a), tz + ' week of day ' + i);
    }
    // rounds either side of local midnight are on different days for the quests
    const h = [round(new Date(2026, 2, 8, 23, 59)), round(new Date(2026, 2, 9, 0, 1))];
    assert.equal(Q.measure('d-rounds3', null, input({ now: new Date(2026, 2, 8, 12), history: h })), 1, tz);
    assert.equal(Q.measure('d-rounds3', null, input({ now: new Date(2026, 2, 9, 12), history: h })), 1, tz);
  }));
});

test('the season: the calendar month, ending at local midnight on the 1st, with the days left counted on calendar days (clock changes included)', () => {
  assert.equal(Q.seasonId(at(2026, 11, 4)), '2026-11');
  assert.equal(Q.seasonName('2026-11'), 'Gold November');
  assert.equal(Q.seasonMonth('2026-11'), 'November 2026');
  assert.equal(Q.seasonName('2026-13'), 'Season');
  assert.equal(Q.seasonDays('2026-02'), 28);
  assert.equal(Q.seasonDays('2028-02'), 29);
  assert.equal(Q.seasonDays('2026-12'), 31);
  ['UTC', 'America/New_York', 'Europe/London', 'Australia/Lord_Howe', 'Pacific/Auckland', 'Asia/Kolkata', 'America/Santiago'].forEach((tz) => zone(tz, () => {
    for (let m = 1; m <= 12; m++) {
      const id = Q.seasonId(new Date(2026, m - 1, 10));
      const end = Q.seasonEnd(id);
      assert.equal([end.getDate(), end.getHours(), end.getMinutes()].join(':'), '1:0:0', tz + ' ' + id + ' ends at local midnight on the 1st');
      const dim = Q.seasonDays(id);
      for (let d = 1; d <= dim; d++) {
        for (const hr of [0, 1, 12, 23]) {
          const now = new Date(2026, m - 1, d, hr, 30);
          assert.equal(Q.seasonId(now), id);
          assert.equal(Q.seasonDaysLeft(now), dim - d + 1, tz + ' ' + id + ' day ' + d + ' at ' + hr + ':30');
        }
      }
    }
    assert.equal(Q.seasonId(new Date(2026, 11, 31, 23, 59, 59)), '2026-12');
    assert.equal(Q.seasonId(new Date(2027, 0, 1, 0, 0, 1)), '2027-01');
    assert.equal(Q.seasonEnd('2026-12').getFullYear(), 2027, 'December ends on 1 January');
  }));
});

test('"Ends in N days": the text on every day of a season', () => {
  assert.equal(Q.endsText(at(2026, 11, 1, 0, 5)), 'Ends in 30 days');
  assert.equal(Q.endsText(at(2026, 11, 19, 15)), 'Ends in 12 days');
  assert.equal(Q.endsText(at(2026, 11, 27, 9)), 'Ends in 4 days');
  assert.equal(Q.endsText(at(2026, 11, 28, 9)), 'Ends in 3 days');
  assert.equal(Q.endsText(at(2026, 11, 29, 9)), 'Ends tomorrow night');
  assert.equal(Q.endsText(at(2026, 11, 30, 0, 0, 1)), 'Ends tonight at midnight');
  assert.equal(Q.endsText(at(2026, 11, 30, 23, 59, 59)), 'Ends tonight at midnight');
  assert.equal(Q.endsText(at(2027, 2, 28, 12)), 'Ends tonight at midnight');
  assert.equal(Q.endsText(at(2028, 2, 28, 12)), 'Ends tomorrow night', '2028 is a leap year');
});

test('tier maths: 90 points a tier, 30 tiers, the bar to the next, and the top', () => {
  assert.equal(Q.TIER_COUNT * Q.TIER_POINTS, 2700);
  const t = (p) => Q.tierInfo(p);
  assert.deepEqual([t(0).tier, t(0).into, t(0).pct], [0, 0, 0]);
  assert.deepEqual([t(89).tier, t(89).into, t(89).pct], [0, 89, 99]);
  assert.deepEqual([t(90).tier, t(90).into, t(90).pct], [1, 0, 0]);
  assert.deepEqual([t(179).tier, t(179).into], [1, 89]);
  assert.deepEqual([t(180).tier, t(900).tier, t(2699).tier], [2, 10, 29]);
  assert.deepEqual([t(2700).tier, t(2700).maxed, t(2700).pct], [30, true, 100]);
  assert.deepEqual([t(99999).tier, t(99999).maxed], [30, true], 'there is no 31st tier');
  assert.deepEqual([t(-5).tier, t(NaN).tier, t('x').tier, t(1e300).tier], [0, 0, 0, 30]);
  // through advance(): the bar and the next tier agree
  const v = Q.advance(Q.normState({ firstSeen: '2026-10-01' }), input({ history: [] })).view.season;
  assert.deepEqual([v.points, v.tier, v.toNext, v.nextTier], [0, 0, 90, 1]);
});

test('the track: 30 tiers, one reward each, every cosmetic given exactly once, and the numbers of each kind', () => {
  assert.equal(Q.REWARDS.length, 30);
  const kinds = {};
  let xp = 0;
  const seen = {};
  for (let i = 1; i <= 30; i++) {
    const r = Q.tierReward(i);
    assert.equal(r.tier, i);
    kinds[r.kind] = (kinds[r.kind] || 0) + 1;
    if (r.kind === 'xp') { assert.ok(r.xp >= 25 && r.xp <= 150, 'tier ' + i); xp += r.xp; } else {
      assert.ok(Q.itemOf(r.kind, r.id), 'tier ' + i + ' names a real ' + r.kind);
      assert.ok(!seen[r.kind + r.id], 'given twice: ' + r.kind + ' ' + r.id);
      seen[r.kind + r.id] = true;
      assert.equal(Q.tierOf(r.kind, r.id), i);
    }
    assert.ok(r.label.length > 3 && r.name.length > 1);
  }
  assert.deepEqual(kinds, { xp: 12, confetti: 4, cardback: 4, title: 4, frame: 6 });
  assert.equal(xp, 875, 'bonus XP in the whole track (about $88 of giving, as XP is counted)');
  assert.equal(Q.tierReward(31), null);
  assert.equal(Q.tierReward(0), null);
  // every cosmetic that is not open from the start is on the track, and the classic ones are not
  ['frame', 'title', 'cardback', 'confetti'].forEach((k) => { Q.itemOf && (k === 'frame' ? Q.FRAMES : k === 'title' ? Q.TITLES : k === 'cardback' ? Q.CARD_BACKS : Q.CONFETTI).forEach((it) => assert.equal(Q.tierOf(k, it.id) > 0, it.id !== 'classic', k + ' ' + it.id)); });
  // tier 10 is a milestone worth having, and the last tiers are the best things
  assert.equal(Q.tierReward(10).kind, 'cardback');
  assert.equal(Q.tierReward(29).id, 'crown');
  assert.equal(Q.tierReward(30).id, 'season-finisher');
});

test('a reward the visitor already has pays 25 XP instead (the same track comes round every season)', () => {
  const frame = Q.tierReward(7);
  assert.equal(frame.id, 'marquee');
  assert.deepEqual([Q.resolveReward(frame, () => false).kind, Q.resolveReward(frame, () => false).duplicate], ['frame', undefined]);
  const dup = Q.resolveReward(frame, (k, id) => k === 'frame' && id === 'marquee');
  assert.deepEqual([dup.kind, dup.xp, dup.duplicate, dup.was.id], ['xp', 25, true, 'marquee']);
  assert.match(dup.label, /already have Marquee/);
  const xp = Q.tierReward(1);
  assert.equal(Q.resolveReward(xp, () => true).xp, 25, 'XP rewards stay as they are');
  assert.equal(Q.resolveReward(Q.tierReward(3), () => true).duplicate, undefined);
});

test('the head start: a late joiner gets 60 points for each day gone, up to tier 8, so tier 10 is a couple of days away', () => {
  const cu = (first, id = '2026-11') => Q.catchUp(first, id);
  assert.deepEqual(cu('2026-11-01'), { points: 0, missed: 0 }, 'the first day gets nothing extra');
  assert.deepEqual(cu('2026-11-02'), { points: 60, missed: 1 });
  assert.deepEqual(cu('2026-11-10'), { points: 540, missed: 9 });
  assert.deepEqual(cu('2026-11-13'), { points: 720, missed: 12 });
  assert.deepEqual(cu('2026-11-30'), { points: 720, missed: 29 }, 'capped at tier 8');
  assert.equal(cu('2026-10-30').points, 0, 'first seen before this season: not new');
  assert.equal(cu('2026-12-02').points, 0, 'first seen in another month');
  assert.equal(cu('').points + cu('nonsense').points + cu(undefined).points + cu('2026-11-02', 'x').points, 0);
  assert.ok(Q.CATCHUP_MAX <= 9 * Q.TIER_POINTS, 'the head start never reaches tier 10 by itself');
  // someone who plays an ordinary day (3 rounds and 3 daily quests = 90 points) reaches tier 10 quickly, whenever in the month they arrive from the 10th on
  for (let d = 10; d <= 30; d++) {
    const start = cu(dk(2026, 11, d)).points;
    let days = 0;
    let pts = start;
    while (pts < 10 * Q.TIER_POINTS) { pts += 3 * Q.POINTS.round + 3 * Q.POINTS.daily; days++; }
    assert.ok(days <= 4, 'arriving on the ' + d + 'th: ' + days + ' days to tier 10');
    if (d >= 13) { assert.ok(days <= 2, 'arriving on the ' + d + 'th: ' + days + ' days to tier 10'); }
  }
  // through advance(): the first look fixes the day they were first seen
  const late = Q.advance(null, input({ now: at(2026, 11, 20, 12) })).view.season;
  assert.deepEqual([late.points, late.tier, late.headStart.points], [720, 8, 720]);
  const early = Q.advance(null, input({ now: at(2026, 11, 1, 9) })).view.season;
  assert.deepEqual([early.points, early.tier], [0, 0]);
});

test('the head start is only for people who are new: an old save is not boosted', () => {
  // a save that has played more rounds than the store keeps (60) is a long-time player
  const veteran = Q.advance(null, input({ now: at(2026, 11, 25, 12), save: { plays: 400 }, history: [round(at(2026, 11, 24, 12))] })).view.season;
  assert.equal(veteran.headStart.points, 0);
  // a save with an old round from before this season
  const returning = Q.advance(null, input({ now: at(2026, 11, 25, 12), save: { plays: 1 }, history: [round(at(2026, 10, 12, 12))] })).view.season;
  assert.equal(returning.headStart.points, 0);
  // a save whose first round is in this season is new this season: the head start counts from that day
  const newish = Q.advance(null, input({ now: at(2026, 11, 25, 12), save: { plays: 1 }, history: [round(at(2026, 11, 12, 12))] })).view.season;
  assert.equal(newish.headStart.points, 660);
  // the first day is remembered, not recalculated
  const a = Q.advance(null, input({ now: at(2026, 11, 20, 12) }));
  const b = Q.advance(a.state, input({ now: at(2026, 11, 28, 12) }));
  assert.equal(b.state.firstSeen, '2026-11-20');
  assert.equal(b.view.season.headStart.points, 720);
  // and a new month with a first-seen date in the old one: nothing
  const c = Q.advance(a.state, input({ now: at(2026, 12, 3, 12) }));
  assert.equal(c.view.season.headStart.points, 0);
});

test('season points: 10 for each round, only the first 10 of a day, never from money, and a round is counted once however long it stays in the store', () => {
  const small = [round(at(2026, 11, 4, 9), { totalCents: 100 })];
  const big = [round(at(2026, 11, 4, 9), { totalCents: 100000 })];
  const seen = (h) => Q.advance(Q.normState({ firstSeen: '2026-10-01' }), input({ history: h })).view.season;
  assert.equal(seen(small).roundPoints, 10);
  assert.equal(seen(big).roundPoints, 10, '$1 and $1,000 are worth the same');
  const many = Array.from({ length: 25 }, (_, i) => round(at(2026, 11, 4, 8, i)));
  assert.equal(seen(many).roundPoints, 100, 'the first 10 rounds of a day');
  assert.equal(seen(many).roundsToday, 10);
  const twoDays = Array.from({ length: 12 }, (_, i) => round(at(2026, 11, 4, 8, i))).concat(Array.from({ length: 13 }, (_, i) => round(at(2026, 11, 3, 8, i))));
  assert.equal(seen(twoDays).roundPoints, 200, '12 rounds today and 13 yesterday: the first 10 of each day count');
  const lastMonth = [round(at(2026, 10, 31, 23, 50)), round(at(2026, 11, 1, 0, 10))];
  assert.equal(seen(lastMonth).roundPoints, 10, 'only the round in this season counts');
  // counted once: advancing again with the same history changes nothing
  let st = Q.advance(Q.normState({ firstSeen: '2026-10-01' }), input({ history: many })).state;
  for (let i = 0; i < 5; i++) { st = Q.advance(st, input({ history: many })).state; }
  assert.equal(Q.advance(st, input({ history: many })).view.season.roundPoints, 100);
  // the store only keeps 60 rounds: as they scroll out, the points stay and new rounds add on
  const day = (d) => Array.from({ length: 10 }, (_, i) => round(at(2026, 11, d, 8, i)));
  let all = [];
  let s2 = Q.normState({ firstSeen: '2026-10-01' });
  for (let d = 1; d <= 12; d++) {
    all = day(d).reverse().concat(all).slice(0, 60);
    s2 = Q.advance(s2, input({ now: at(2026, 11, d, 20), history: all })).state;
  }
  assert.equal(all.length, 60);
  assert.equal(Q.advance(s2, input({ now: at(2026, 11, 12, 21), history: all })).view.season.roundPoints, 1200, '12 days of 10 rounds, 6 of which are no longer in the store');
  // an old save with 25 rounds already this month: they count the first time
  const old = Array.from({ length: 25 }, (_, i) => round(at(2026, 11, 1 + (i % 5), 10, i)));
  assert.equal(seen(old).roundPoints, 250);
});

test('claiming a quest: once, only when finished, and it adds season points', () => {
  let day = null;
  for (let i = 0; i < 60 && !day; i++) { const d = new Date(2026, 2, 1 + i, 12); if (Q.pickDaily(core.dayKey(d), ALL).indexOf('d-rounds3') >= 0) { day = d; } }
  const rows = (k) => Array.from({ length: k }, (_, i) => round(new Date(day.getTime() + i * 60000)));
  const mk = (h) => input({ now: day, history: h });
  const key = Q.questKey('daily', core.dayKey(day), 'd-rounds3');
  let st = Q.advance(Q.normState({ firstSeen: '2026-02-01' }), mk(rows(2))).state;
  let c = Q.claimQuest(st, mk(rows(2)), key);
  assert.deepEqual([c.ok, c.reason], [false, 'unfinished']);
  c = Q.claimQuest(st, mk(rows(3)), key);
  assert.deepEqual([c.ok, c.points], [true, 20]);
  const pointsAfter = (s, h) => Q.advance(s, mk(h)).view.season;
  assert.equal(pointsAfter(c.state, rows(3)).questPoints, 20);
  const again = Q.claimQuest(c.state, mk(rows(3)), key);
  assert.deepEqual([again.ok, again.reason, again.points], [false, 'claimed', 0]);
  assert.equal(pointsAfter(again.state, rows(3)).questPoints, 20, 'claiming twice adds nothing');
  assert.deepEqual(Q.claimQuest(c.state, mk(rows(3)), 'd:2026-11-04:d-nothing').reason, 'unknown');
  assert.equal(Q.claimQuest(c.state, mk(rows(3)), '__proto__').ok, false);
  // a quest of another day is not claimable today
  assert.equal(Q.claimQuest(c.state, mk(rows(3)), Q.questKey('daily', '2025-01-01', 'd-rounds3')).ok, false);
  // weekly quests are worth more
  let wk = null;
  for (let i = 0; i < 60 && !wk; i++) { const d = new Date(2026, 2, 2 + 7 * i, 12); if (Q.pickWeekly(core.weekKey(d), ALL).indexOf('w-days4') >= 0) { wk = d; } }
  const wrows = [0, 1, 2, 3].map((i) => round(new Date(wk.getFullYear(), wk.getMonth(), wk.getDate() + i, 10)));
  const wkey = Q.questKey('weekly', core.weekKey(wk), 'w-days4');
  const wc = Q.claimQuest(Q.normState({ firstSeen: '2020-01-01' }), input({ now: wk, history: wrows }), wkey);
  assert.deepEqual([wc.ok, wc.points], [true, 60]);
});

test('claiming a tier: only when reached, once, and it hands back what the tier gives', () => {
  const inp = (pts) => input({ history: [], now: at(2026, 11, 4, 12) });
  let st = Q.normState({ firstSeen: '2026-10-01', season: { id: '2026-11', days: {}, ids: [], quest: 200 } });     // 200 points: tier 2
  let c = Q.claimTier(st, inp(), 3);
  assert.deepEqual([c.ok, c.reason], [false, 'locked']);
  c = Q.claimTier(st, inp(), 1);
  assert.deepEqual([c.ok, c.reward.kind, c.reward.xp], [true, 'xp', 25]);
  const again = Q.claimTier(c.state, inp(), 1);
  assert.deepEqual([again.ok, again.reason], [false, 'claimed']);
  c = Q.claimTier(c.state, inp(), 2);
  assert.deepEqual([c.ok, c.reward.kind, c.reward.id], [true, 'confetti', 'gold']);
  assert.equal(Q.claimTier(c.state, inp(), 31).reason, 'unknown');
  assert.equal(Q.claimTier(c.state, inp(), 0).reason, 'unknown');
  const v = Q.advance(c.state, inp()).view;
  assert.deepEqual(v.season.tiers.slice(0, 3).map((t) => t.status), ['claimed', 'claimed', 'locked']);
  assert.equal(v.claimableTiers, 0);
  // a cosmetic the visitor owns already pays XP when claimed
  const own = Q.claimTier(st, input({ owns: (k, id) => k === 'confetti' && id === 'gold' }), 2);
  assert.deepEqual([own.ok, own.reward.kind, own.reward.xp, own.reward.duplicate], [true, 'xp', 25, true]);
  // the claim belongs to the season: the next month has its own tiers (and its own keys) to claim
  const dec = Q.advance(c.state, input({ now: at(2026, 12, 2, 12) })).view.season;
  assert.deepEqual([dec.id, dec.points, dec.tiers[0].status, dec.tiers[0].key], ['2026-12', 0, 'locked', 's:2026-12:01']);
  assert.equal(v.season.tiers[0].key, 's:2026-11:01');
});

test('claim all: finished quests first (their points can open tiers), then every tier reached, once', () => {
  let day = null;
  for (let i = 0; i < 90 && !day; i++) { const d = new Date(2026, 2, 1 + i, 12); const p = Q.pickDaily(core.dayKey(d), ALL); if (p.indexOf('d-rounds3') >= 0) { day = d; } }
  const rows = Array.from({ length: 4 }, (_, i) => round(new Date(day.getTime() + i * 60000)));
  const given = [];
  const inp = input({ now: day, history: rows, give: (r) => given.push(r.kind + ':' + (r.id || r.xp)) });
  let st = Q.normState({ firstSeen: '2020-01-01', season: { id: core.monthKey(day), days: {}, ids: [], quest: 70 } });   // 70 + 40 for 4 rounds = 110: tier 1
  const before = Q.advance(st, inp).view;
  assert.ok(before.claimableQuests >= 1 && before.claimableTiers === 1, JSON.stringify([before.claimableQuests, before.claimableTiers]));
  const res = Q.claimAll(st, inp);
  assert.ok(res.quests.length >= 1);
  assert.ok(res.tiers.length >= 1 && res.tiers[0].tier === 1);
  assert.deepEqual(given.slice(0, 1), ['xp:25']);
  const after = Q.advance(res.state, inp).view;
  assert.deepEqual([after.claimable, after.claimableQuests, after.claimableTiers], [0, 0, 0]);
  const second = Q.claimAll(res.state, inp);
  assert.deepEqual([second.quests.length, second.tiers.length], [0, 0], 'claiming everything twice gives nothing the second time');
});

test('the stored state: junk of every kind is cleaned, and a damaged save never throws', () => {
  [undefined, null, 5, 'x', [], [[]], { claimed: 'yes' }, { claimed: [1], hi: 'x', marks: [], season: 'nope' }, { claimed: { __proto__: true, constructor: true, 'd:2026-11-04:d-live': true, 'bad key': true }, hi: { 'd:2026-11-04:d-live': -5, 'w:2026-W45:w-days4': 'x' } },
    { season: { id: 'zzz', days: { x: 1, '2026-11-04': -3 }, ids: [1, 'a', null, 'x'.repeat(100)], quest: 'many' }, firstSeen: 'tomorrow' }, { marks: { verifies: { last: -1, days: 5 }, '__proto__': { last: 1 } } }].forEach((raw) => {
    const s = Q.normState(raw);
    assert.equal(s.v, 1);
    assert.ok(Object.keys(s.claimed).every((k) => /^[dws]:/.test(k)));
    assert.equal(s.firstSeen, '');
    const out = Q.advance(raw, input({ history: [null, 5, { ts: 'x' }, { ts: 1, allocations: 'no' }, round(at(2026, 11, 4, 9))], save: { cards: 'x', cup: 5, daily: [], streak: -4, lastDay: 7 }, counters: { verifies: 'x', '__proto__': 3 } }));
    assert.ok(out.view.daily.length === 3 && out.view.weekly.length === 3);
    assert.ok(Number.isInteger(out.view.season.points) && out.view.season.points >= 0);
  });
  const s = Q.normState({ claimed: { 'd:2026-11-04:d-live': true }, hi: { 'd:2026-11-04:d-live': 4.9 }, firstSeen: '2026-11-04' });
  assert.deepEqual([s.claimed['d:2026-11-04:d-live'], s.hi['d:2026-11-04:d-live'], s.firstSeen], [true, 4, '2026-11-04']);
  assert.ok(!('__proto__' in {}) || Object.keys(Q.normState({ claimed: JSON.parse('{"__proto__":true}') }).claimed).length === 0);
});

test('old keys are forgotten after a while, recent ones kept', () => {
  const now = at(2026, 11, 4, 12);
  const s = Q.normState({
    claimed: { 'd:2026-11-03:d-live': true, 'd:2026-09-01:d-live': true, 'w:2026-W44:w-days4': true, 'w:2026-W20:w-days4': true, 's:2026-11:03': true, 's:2026-06:03': true, 's:2026-09:03': true },
    hi: { 'd:2026-01-01:d-live': 1, 'd:2026-11-04:d-live': 1 }
  });
  Q.prune(s, now);
  assert.deepEqual(Object.keys(s.claimed).sort(), ['d:2026-11-03:d-live', 's:2026-09:03', 's:2026-11:03', 'w:2026-W44:w-days4']);
  assert.deepEqual(Object.keys(s.hi), ['d:2026-11-04:d-live']);
});

test('a reset of progress (the saved rounds gone after some were counted) starts the quests and the season over', () => {
  const rows = [round(at(2026, 11, 4, 9)), round(at(2026, 11, 4, 10))];
  let st = Q.advance(Q.normState({ firstSeen: '2026-10-01' }), input({ history: rows })).state;
  st.claimed['d:2026-11-04:d-live'] = true;
  st.season.quest = 40;
  assert.equal(Q.advance(st, input({ history: rows })).view.season.points, 60);
  const out = Q.advance(st, input({ history: [] }));
  assert.equal(out.view.season.points, 0);
  assert.deepEqual(out.state.claimed, {});
  assert.equal(out.state.firstSeen, '2026-10-01', 'when they first came is not forgotten');
  // a save that never counted a round and has no rounds is left alone
  const quiet = Q.normState({ firstSeen: '2026-10-01', claimed: { 'd:2026-11-04:d-wheel': true } });
  assert.deepEqual(Object.keys(Q.advance(quiet, input({ history: [] })).state.claimed), ['d:2026-11-04:d-wheel']);
});

test('weekly "claim 5 daily quests" counts the claimed daily quests of this week only', () => {
  const claimed = {};
  ['2026-11-02', '2026-11-03', '2026-11-04'].forEach((d) => { claimed['d:' + d + ':d-live'] = true; claimed['d:' + d + ':d-back'] = true; });
  claimed['d:2026-11-01:d-live'] = true;        // Sunday of last week
  claimed['w:2026-W45:w-days4'] = true;         // a weekly one is not a daily
  assert.equal(Q.measure('w-dailies5', { claimed }, input()), 6);
  assert.equal(Q.measure('w-dailies5', null, input()), 0);
});

test('the cosmetics store: unlock, own, choose; the classic ones are always there; junk and a broken storage are ignored', () => {
  const mem = {};
  const storage = { get: (k, f) => (k in mem ? JSON.parse(JSON.stringify(mem[k])) : f), set: (k, v) => { mem[k] = JSON.parse(JSON.stringify(v)); return true; } };
  const c = Q.makeCosmetics(storage);
  assert.deepEqual(c.owned('cardback'), ['classic']);
  assert.deepEqual(c.owned('confetti'), ['classic']);
  assert.deepEqual(c.owned('frame'), []);
  assert.equal(c.active('cardback'), 'classic');
  assert.equal(c.active('frame'), '', 'which frame is worn is the profile\'s choice');
  assert.equal(c.unlock('cardback', 'emerald'), true);
  assert.equal(c.unlock('cardback', 'emerald'), false, 'a second unlock is not new');
  assert.equal(c.unlock('cardback', 'nonsense'), false);
  assert.equal(c.unlock('nonsense', 'emerald'), false);
  assert.equal(c.unlock('frame', 'marquee'), true);
  assert.equal(c.owns('frame', 'marquee'), true);
  assert.equal(c.owns('frame', 'chip'), false);
  assert.equal(c.setActive('cardback', 'midnight'), false, 'not owned yet');
  assert.equal(c.setActive('cardback', 'emerald'), true);
  assert.equal(c.active('cardback'), 'emerald');
  assert.equal(c.setActive('frame', 'marquee'), false, 'frames are not chosen here');
  assert.deepEqual(Object.keys(mem), ['cosmetics']);
  // a fresh store over the same storage sees the same
  assert.equal(Q.makeCosmetics(storage).active('cardback'), 'emerald');
  // damaged storage
  mem.cosmetics = { owned: { cardback: ['emerald', 'emerald', 7, 'nope'], frame: 'x', confetti: null }, active: { cardback: 'midnight', confetti: 'gold' } };
  assert.deepEqual(c.owned('cardback'), ['classic', 'emerald']);
  assert.equal(c.active('cardback'), 'classic', 'a choice that is not owned falls back to the classic one');
  assert.equal(c.active('confetti'), 'classic');
  mem.cosmetics = 'garbage';
  assert.deepEqual(c.owned('cardback'), ['classic']);
  // no storage at all, or one that throws
  const none = Q.makeCosmetics(null);
  assert.equal(none.unlock('frame', 'chip'), true, 'it works for this visit without storage');
  assert.deepEqual(none.owned('cardback'), ['classic']);
  const bad = Q.makeCosmetics({ get: () => { throw new Error('blocked'); }, set: () => { throw new Error('blocked'); } });
  assert.doesNotThrow(() => { bad.unlock('frame', 'chip'); bad.owns('frame', 'chip'); bad.active('confetti'); bad.setActive('confetti', 'classic'); });
  assert.equal(bad.active('confetti'), 'classic');
});

test('confetti styles: every style has colours and shapes the confetti code can draw', () => {
  const SHAPES = ['rect', 'circle', 'ribbon', 'heart', 'star'];
  Q.CONFETTI.forEach((c) => {
    assert.ok(c.colors.length >= 5 && c.colors.every((x) => /^#[0-9A-Fa-f]{6}$/.test(x)), c.id);
    assert.ok(c.shapes.length >= 3 && c.shapes.every((x) => SHAPES.includes(x)), c.id);
  });
  assert.equal(Q.confettiStyle('hearts').id, 'hearts');
  assert.equal(Q.confettiStyle('nonsense').id, 'classic');
  assert.equal(Q.confettiStyle(undefined).id, 'classic');
  const confetti = SRC('confetti.js');
  SHAPES.forEach((s) => assert.ok(confetti.includes("'" + s + "'"), 'js/confetti.js draws ' + s));
});

test('the game groups used by the quests are exactly the games the store knows (so a new game cannot be left out by mistake)', () => {
  const store = SRC('store.js');
  const ids = /var GAME_IDS = \[([^\]]*)\]/.exec(store)[1].split(',').map((s) => s.trim().replace(/'/g, '')).filter((x) => x && x !== 'direct');
  const grouped = [].concat(...Object.values(Q.GAME_GROUPS));
  assert.deepEqual(grouped.slice().sort(), ids.slice().sort());
  assert.equal(new Set(grouped).size, grouped.length, 'no game in two groups');
});

test('every word a visitor reads here follows the voice: no money talk, no crypto words, no superlatives', () => {
  const BAD = /\b(crypto(?!graphic)|bitcoin|ethereum|blockchain|wallet|NFTs?|tokens?|coins?|winnings|payout|prize|jackpot|cash out|cashed out|real players|best|greatest|most trusted|top)\b/i;
  const texts = [];
  Q.DAILY.concat(Q.WEEKLY).forEach((t) => texts.push(t.text));
  [Q.FRAMES, Q.TITLES, Q.CARD_BACKS, Q.CONFETTI].forEach((list) => list.forEach((i) => { texts.push(i.name, i.description); }));
  for (let m = 1; m <= 12; m++) { texts.push(Q.seasonName('2026-' + (m < 10 ? '0' : '') + m)); }
  for (let i = 1; i <= 30; i++) { texts.push(Q.tierReward(i).label); }
  texts.push(Q.endsText(at(2026, 11, 4)), Q.resolveReward(Q.tierReward(2), () => true).label);
  texts.forEach((t) => { assert.ok(!BAD.test(t), 'banned wording: ' + t); assert.ok(!/\$/.test(t), 'a dollar sign in: ' + t); assert.ok(!/NaN|undefined|null/.test(t), t); });
  assert.equal(new Set(texts.filter((t, i) => i < 25)).size, 25, 'no two quests read the same');
  [Q.FRAMES, Q.TITLES, Q.CARD_BACKS, Q.CONFETTI].forEach((list) => list.forEach((i) => assert.ok(i.name.length <= 30 && /^[a-z0-9][a-z0-9-]{0,23}$/.test(i.id), i.id)));
});

test('GS.quests and GS.cosmetics are published for the page (loaded the way the page loads it)', () => {
  const sandbox = { window: {} };
  sandbox.window = sandbox;
  sandbox.GS = {};
  vm.createContext(sandbox);
  vm.runInContext(SRC('core.js'), sandbox);
  vm.runInContext(SRC('local.js'), sandbox);
  vm.runInContext(SRC('quests.js'), sandbox);
  assert.equal(typeof sandbox.GS.quests.advance, 'function');
  assert.equal(typeof sandbox.GS.cosmetics.unlock, 'function');
  assert.equal(sandbox.GS.cosmetics.unlock('frame', 'crown'), true, 'it works on top of GS.local (memory when there is no localStorage)');
  assert.equal(sandbox.GS.cosmetics.owns('frame', 'crown'), true);
});
