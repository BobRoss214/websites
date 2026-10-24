// Run with:  node --test givespin/tests/record.test.js
// The record of a Marble Run round notes the map (track) it was played on, and that note never takes part in the fair draw (js/store.js, js/fair.js).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const fair = require('../js/fair.js');

/** A fresh copy of the site's scripts (core, config, roster, store) on a pretend page with a pretend localStorage (as in store.test.js). */
function makePage() {
  const data = new Map();
  const sandbox = {
    localStorage: {
      getItem: (k) => (data.has(k) ? data.get(k) : null),
      setItem: (k, v) => { data.set(k, String(v)); },
      removeItem: (k) => { data.delete(k); }
    },
    CustomEvent,
    dispatchEvent: () => true
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  ['core.js', 'config.js', 'data.js', 'store.js'].forEach((f) => {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', f), 'utf8'), sandbox, { filename: f });
  });
  return { GS: sandbox.GS, data, KEY: 'givespin:v2' };
}

/**
 * Draws and records one round on a board of the first `n` charities, the way the game and the receipt do: the winner comes from the seeds and
 * the board only, and the map is handed to the record beside it. `commit` (optional) fixes the seeds, so two rounds can be compared.
 */
async function playRound(page, o) {
  const { GS } = page;
  const n = o.n || 8;
  const boardIds = GS.charities.slice(0, n).map((c) => c.id);
  const pool = boardIds.map((id) => ({ id }));
  const sorted = fair.sortedIds(pool);
  const commit = o.commit || await fair.newCommit();
  const clientSeed = o.clientSeed || 'lucky';
  const nonce = o.nonce || 0;
  const count = o.count || 1;
  const winners = (await fair.drawIndices(commit.roundSeed, clientSeed, nonce, sorted.length, count)).map((i) => sorted[i]);
  const f = {
    roundSeed: commit.roundSeed, serverHash: commit.serverHash, clientSeed, nonce, poolHash: await fair.poolHash(pool), count,
    winners, filters: GS.core.emptyFilters(), excluded: [], board: boardIds.slice().sort()
  };
  const play = {
    game: o.game || 'marble', totalCents: 1000, rounds: count, status: 'done', pay: 'credit', fair: f, direct: !!o.direct,
    allocations: winners.filter((w, i) => winners.indexOf(w) === i).map((w) => ({ charityId: w, cents: Math.floor(1000 / count), hits: 1 }))
  };
  if (o.map !== undefined) { play.map = o.map; }
  GS.store.recordPlay(play);
  return f;
}

/** A copy made in this test's own world (objects made inside the pretend page have another Object, so deepEqual would tell them apart). */
const plain = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

async function verifyEntry(page, entry) {
  const pool = entry.fair.board.map((id) => ({ id }));
  return fair.verify(entry.fair, pool);
}

/** Puts a saved history straight into the pretend storage and loads it, as a page reload of older (or newer) saved data does. */
function loadSaved(page, history) {
  page.data.set(page.KEY, JSON.stringify({ v: 2, history }));
  page.GS.store.load();
  return page.GS.store.get().history;
}

test('a Marble Run round keeps the track it ran on beside the round, never in its fair-play record, and it comes back after a reload', async () => {
  const page = makePage();
  const { GS } = page;
  await playRound(page, { map: { id: 'spiral', name: 'Spiral Tower' } });
  let entry = GS.store.get().history[0];
  assert.deepEqual(plain(entry.map), { id: 'spiral', name: 'Spiral Tower' });
  assert.equal('map' in entry.fair, false, 'the track is not in the fair-play record');
  const saved = JSON.parse(page.data.get(page.KEY)).history[0];
  assert.deepEqual(saved.map, { id: 'spiral', name: 'Spiral Tower' }, 'the saved text has it');
  assert.equal(JSON.stringify(saved.fair).indexOf('spiral'), -1, 'and the saved fair-play record does not mention it');
  GS.store.load();
  entry = GS.store.get().history[0];
  assert.deepEqual(plain(entry.map), { id: 'spiral', name: 'Spiral Tower' }, 'after a reload');
  assert.equal((await verifyEntry(page, entry)).ok, true, 'and the round still verifies');
  // after one reload, a reload then a save gives the very same text (the note does not drift; as for the rest of the save, see store.test.js)
  GS.store.save();
  const t1 = page.data.get(page.KEY);
  GS.store.load(); GS.store.save();
  assert.equal(page.data.get(page.KEY), t1);
  assert.deepEqual(plain(GS.store.get().history[0].map), { id: 'spiral', name: 'Spiral Tower' });
});

test('the track never touches the draw: the same seeds and board give the same winners and the same saved fair-play record on every track', async () => {
  const commit = await fair.newCommit();
  const records = [];
  for (const map of [undefined, { id: 'switchback', name: 'Switchback' }, { id: 'zigzag', name: 'Zigzag Ramps' }, { id: 'spiral', name: 'Spiral Tower' }, { id: 'moon-base', name: 'Moon Base' }]) {
    const page = makePage();
    await playRound(page, { n: 500, count: 3, commit, clientSeed: 'same', nonce: 7, map });
    page.GS.store.load();
    const entry = page.GS.store.get().history[0];
    const r = await verifyEntry(page, entry);
    assert.equal(r.ok, true, 'verifies on ' + (map ? map.name : 'no track'));
    const saved = JSON.parse(page.data.get(page.KEY));
    records.push({ fair: JSON.stringify(entry.fair), savedFair: JSON.stringify(saved.history[0].fair), ids: JSON.stringify(saved.ids), derived: r.derived.join(','), winners: entry.fair.winners.join(',') });
  }
  for (const rec of records.slice(1)) { assert.deepEqual(rec, records[0], 'the fair-play record, its saved text and the redone draw are identical whatever the track'); }
  // and the draw code itself never looks at a map: js/fair.js does not mention one (its only "map" is the array method)
  const src = fs.readFileSync(path.join(__dirname, '../js/fair.js'), 'utf8').replace(/\.map\(/g, '');
  assert.equal(/\bmap\b|track|marble/i.test(src), false, 'js/fair.js never reads a map or a track');
});

test('only Marble Run rounds keep a track: another game, or a direct gift, handed one saves none', async () => {
  const page = makePage();
  const { GS } = page;
  await playRound(page, { game: 'wheel', map: { id: 'spiral', name: 'Spiral Tower' } });
  await playRound(page, { game: 'derby', map: { id: 'spiral', name: 'Spiral Tower' } });
  await playRound(page, { game: 'direct', direct: true, map: { id: 'spiral', name: 'Spiral Tower' } });
  await playRound(page, { game: 'marble' });           // a Marble Run round with no track given (the game had no accessor): no note at all
  await playRound(page, { game: 'marble', map: null });
  assert.deepEqual(plain(GS.store.get().history.map((h) => 'map' in h)), [false, false, false, false, false]);
  GS.store.load();
  assert.deepEqual(plain(GS.store.get().history.map((h) => 'map' in h)), [false, false, false, false, false], 'after a reload');
  assert.equal(page.data.get(page.KEY).indexOf('Spiral'), -1, 'nothing about a track in the saved text');
  // a hand-edited save that puts a track on a wheel round: dropped on load
  const h = loadSaved(page, [{ id: 'GS-W', ts: 1, game: 'wheel', totalCents: 500, rounds: 1, status: 'done', pay: 'credit', freq: 'once', allocations: [{ charityId: GS.charities[0].id, cents: 500 }], map: { id: 'spiral', name: 'Spiral Tower' } }]);
  assert.equal('map' in h[0], false);
});

test('older and damaged saves load: no track, or a garbage one, never stops the page, and the round still verifies', async () => {
  const page = makePage();
  const { GS } = page;
  const f = await playRound(page, { map: undefined });
  const base = JSON.parse(JSON.stringify(GS.store.get().history[0]));
  const long = 'x'.repeat(500);
  const cases = [
    [undefined, undefined],                                   // saved before maps existed
    [null, undefined],
    ['spiral', undefined],                                    // a bare string is not the format
    [42, undefined],
    [true, undefined],
    [['spiral', 'Spiral Tower'], undefined],
    [{}, undefined],
    [{ id: '', name: '' }, undefined],
    [{ id: 5, name: 7 }, undefined],
    [{ id: 'spiral' }, { id: 'spiral', name: '' }],                                   // an id alone: the page shows today's name for it, if the map still exists
    [{ name: 'Spiral Tower' }, { id: '', name: 'Spiral Tower' }],
    [{ id: 'Spiral_Tower!', name: 'Spiral Tower' }, { id: '', name: 'Spiral Tower' }],   // an id in another format: dropped, the name kept
    [{ id: long, name: long }, { id: '', name: 'x'.repeat(40) }],
    [{ id: 'river', name: '  River\n\tRapids\u0000 ' }, { id: 'river', name: 'River Rapids' }],
    [{ id: 'spiral', name: { nested: true } }, { id: 'spiral', name: '' }],
    [{ id: 'spiral', name: 'Spiral Tower', extra: 'x'.repeat(5000) }, { id: 'spiral', name: 'Spiral Tower' }]
  ];
  for (const [given, want] of cases) {
    const e = JSON.parse(JSON.stringify(base));
    delete e.map;
    if (given !== undefined) { e.map = given; }
    e.fair.board = f.board; delete e.fair.boardIx;   // (spelled out, as an older save has it)
    let h;
    assert.doesNotThrow(() => { h = loadSaved(page, [e]); }, JSON.stringify(given));
    assert.equal(h.length, 1, 'the round is kept: ' + JSON.stringify(given));
    assert.deepEqual(plain(h[0].map), want, 'map ' + JSON.stringify(given));
    assert.equal((await verifyEntry(page, h[0])).ok, true, 'still verifies with map ' + JSON.stringify(given));
    assert.doesNotThrow(() => GS.store.save());
  }
});

test('a track this version does not know (from an older or newer save) keeps the name it was saved with', () => {
  const page = makePage();
  const { GS } = page;
  const mk = (id, map) => ({ id, ts: 1, game: 'marble', totalCents: 500, rounds: 1, status: 'done', pay: 'credit', freq: 'once', allocations: [{ charityId: GS.charities[0].id, cents: 500 }], map });
  const h = loadSaved(page, [mk('GS-A', { id: 'moon-base', name: 'Moon Base' }), mk('GS-B', { id: 'spiral', name: 'Spiral Tower (old name)' })]);
  assert.deepEqual(plain(h.map((x) => x.map)), [{ id: 'moon-base', name: 'Moon Base' }, { id: 'spiral', name: 'Spiral Tower (old name)' }]);
  assert.deepEqual(plain(GS.store.cleanMap({ id: 'moon-base', name: 'Moon Base' })), { id: 'moon-base', name: 'Moon Base' }, 'the cleaner is the same one the page uses');
});

test('the track costs little room: about 40 characters a round, and 60 Marble Run rounds on 500-marble boards stay small', async () => {
  const withMap = makePage();
  const without = makePage();
  for (let i = 1; i <= 60; i++) {
    const commit = await fair.newCommit();
    await playRound(withMap, { n: 500, nonce: i, commit, map: { id: 'spiral', name: 'Spiral Tower' } });
    await playRound(without, { n: 500, nonce: i, commit });
  }
  const a = withMap.data.get(withMap.KEY).length;
  const b = without.data.get(without.KEY).length;
  const per = (a - b) / 60;
  assert.ok(per > 0 && per <= 50, 'the note costs ' + per + ' characters a round');
  assert.ok(a < 1000000, '60 rounds: ' + a + ' characters');
  console.log('# the track note: ' + per + ' characters a round (60 rounds on 500-marble boards: ' + a + ' characters, ' + b + ' without the note)');
});
