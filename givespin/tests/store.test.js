// Run with:  node --test givespin/tests/store.test.js
// Saved rounds: a big board must still be there, and still verify, after the page is reloaded (js/store.js).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const fair = require('../js/fair.js');

/** A fresh copy of the site's scripts (core, config, roster, store) on a pretend page with a pretend localStorage. */
function makePage() {
  const data = new Map();
  const sandbox = {
    localStorage: {
      getItem: (k) => (data.has(k) ? data.get(k) : null),
      setItem: (k, v) => { data.set(k, String(v)); },
      removeItem: (k) => { data.delete(k); }
    }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  ['core.js', 'config.js', 'data.js', 'store.js'].forEach((f) => {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', f), 'utf8'), sandbox, { filename: f });
  });
  return { GS: sandbox.GS, data, KEY: 'givespin:v2' };
}

/** Plays one pretend round on a board of `n` charities (or on the whole filtered pool when `board` is false) and records it. */
async function playRound(page, n, opts) {
  opts = opts || {};
  const { GS } = page;
  const ids = GS.charities.map((c) => c.id);
  const boardIds = opts.board === false ? [] : ids.slice(0, n);
  const excluded = opts.excluded || [];
  const pool = opts.board === false ? GS.charities.filter((c) => excluded.indexOf(c.id) < 0) : boardIds.map((id) => ({ id }));
  const sorted = fair.sortedIds(pool);
  const commit = await fair.newCommit();
  const clientSeed = 'lucky' + (opts.nonce || 0);
  const nonce = opts.nonce || 0;
  const idx = await fair.drawIndices(commit.roundSeed, clientSeed, nonce, sorted.length, 1);
  const winner = sorted[idx[0]];
  const f = {
    roundSeed: commit.roundSeed, serverHash: commit.serverHash, clientSeed, nonce, poolHash: await fair.poolHash(pool), count: 1,
    winners: [winner], filters: GS.core.emptyFilters(), excluded: excluded.slice(), board: boardIds.slice().sort()
  };
  GS.store.recordPlay({
    game: 'roulette', totalCents: 2500, rounds: 1, status: 'done', pay: 'credit', fair: f,
    allocations: [{ charityId: winner, cents: 2500, hits: 1 }]
  });
  return f;
}

/** Re-checks a round the way the receipt does: from what the store holds now. */
async function verifyFromStore(page, entry) {
  const { GS } = page;
  const f = entry.fair;
  const boardPool = f.board && f.board.length ? f.board.map((id) => GS.charity(id)).filter(Boolean) : null;
  const pool = boardPool || GS.core.buildPool(GS.charities, f.filters, f.excluded);
  return fair.verify(f, pool);
}

test('a board of 300, 301 or 1,000 charities is still there and still verifies after a reload', async () => {
  for (const n of [300, 301, 1000]) {
    const page = makePage();
    const f = await playRound(page, n);
    assert.equal(page.GS.store.get().history[0].fair.board.length, n);
    page.GS.store.load(); // what a page reload does: read the saved text back
    const entry = page.GS.store.get().history[0];
    assert.equal(entry.fair.board.length, n, 'the whole board of ' + n + ' came back');
    assert.equal(JSON.stringify(entry.fair.board), JSON.stringify(f.board), 'in the same order');
    const r = await verifyFromStore(page, entry);
    assert.deepEqual({ hashOk: r.hashOk, poolOk: r.poolOk, winnersOk: r.winnersOk, ok: r.ok }, { hashOk: true, poolOk: true, winnersOk: true, ok: true }, 'board of ' + n);
  }
});

test('a round drawn from the whole pool keeps a long switched-off list and verifies after a reload', async () => {
  const page = makePage();
  const all = page.GS.charities.map((c) => c.id);
  const excluded = all.slice(0, all.length - 12); // almost everything switched off: 1,000 or more ids
  assert.ok(excluded.length > 1000);
  await playRound(page, 0, { board: false, excluded });
  page.GS.store.load();
  const entry = page.GS.store.get().history[0];
  assert.equal(entry.fair.excluded.length, excluded.length);
  assert.equal(JSON.stringify(entry.fair.excluded), JSON.stringify(excluded));
  assert.equal(entry.fair.board.length, 0);
  assert.equal((await verifyFromStore(page, entry)).ok, true);
});

test('history saved by the older version (ids spelled out, boards cut to 300) still loads', async () => {
  const page = makePage();
  const ids = page.GS.charities.map((c) => c.id);
  const old = {
    v: 2, xp: 10, plays: 2,
    history: [
      { id: 'GS-AAAAAA', ts: 2, game: 'wheel', totalCents: 500, rounds: 1, status: 'done', pay: 'credit', freq: 'once', allocations: [{ charityId: ids[0], cents: 500 }],
        fair: { roundSeed: 'a', serverHash: 'b', clientSeed: 'c', nonce: 1, poolHash: 'd', count: 1, winners: [ids[0]], board: ids.slice(0, 300), excluded: ids.slice(300, 320) } },
      { id: 'GS-BBBBBB', ts: 1, game: 'roulette', totalCents: 500, rounds: 1, status: 'done', pay: 'credit', freq: 'once', allocations: [{ charityId: ids[1], cents: 500 }],
        fair: { roundSeed: 'a', serverHash: 'b', clientSeed: 'c', nonce: 1, poolHash: 'd', count: 1, winners: [ids[1]], board: ids.slice(0, 1000) } }
    ]
  };
  page.data.set(page.KEY, JSON.stringify(old));
  page.GS.store.load();
  const h = page.GS.store.get().history;
  assert.equal(h.length, 2);
  assert.equal(JSON.stringify(h[0].fair.board), JSON.stringify(ids.slice(0, 300)));
  assert.equal(JSON.stringify(h[0].fair.excluded), JSON.stringify(ids.slice(300, 320)));
  assert.equal(h[1].fair.board.length, 1000);
  // and saving again turns them into the packed form without losing anything
  page.GS.store.save();
  page.GS.store.load();
  const h2 = page.GS.store.get().history;
  assert.equal(JSON.stringify(h2[0].fair.board), JSON.stringify(ids.slice(0, 300)));
  assert.equal(h2[1].fair.board.length, 1000);
});

test('storage stays small: 20 rounds on 1,000-charity boards, and a full history of 60', async () => {
  const page = makePage();
  const all = page.GS.charities.map((c) => c.id);
  const excluded = all.slice(0, 1000); // the worst case: a long switched-off list on every round as well
  let at20 = 0;
  for (let i = 1; i <= 60; i++) {
    await playRound(page, 1000, { excluded, nonce: i });
    if (i === 20) { at20 = page.data.get(page.KEY).length; }
  }
  const at60 = page.data.get(page.KEY).length;
  assert.equal(page.GS.store.get().history.length, 60);
  assert.ok(at20 < 1000000, '20 rounds: ' + at20 + ' characters');
  assert.ok(at60 < 1000000, '60 rounds: ' + at60 + ' characters');
  // the newest and the oldest saved round both come back whole and verify
  page.GS.store.load();
  const h = page.GS.store.get().history;
  assert.equal(h.length, 60);
  for (const entry of [h[0], h[59]]) {
    assert.equal(entry.fair.board.length, 1000);
    assert.equal(entry.fair.excluded.length, 1000);
    assert.equal((await verifyFromStore(page, entry)).ok, true);
  }
  console.log('# saved text: 20 rounds = ' + at20 + ' characters, 60 rounds = ' + at60 + ' characters (boards of 1,000 and 1,000 switched-off charities on every round)');
});

test('a damaged saved list does not break loading', async () => {
  const page = makePage();
  const ids = page.GS.charities.map((c) => c.id);
  const bad = {
    v: 2, ids: [ids[0], 7, null, ids[1]],
    history: [{ id: 'GS-CCCCCC', ts: 1, game: 'wheel', totalCents: 500, rounds: 1, status: 'done', pay: 'credit', freq: 'once', allocations: [{ charityId: ids[0], cents: 500 }],
      fair: { roundSeed: 'a', serverHash: 'b', clientSeed: 'c', nonce: 1, poolHash: 'd', count: 1, winners: [ids[0]], boardIx: '000zzz001003', excludedIx: 42 } }]
  };
  page.data.set(page.KEY, JSON.stringify(bad));
  page.GS.store.load();
  const f = page.GS.store.get().history[0].fair;
  assert.equal(JSON.stringify(f.board), JSON.stringify([ids[0], ids[1]]), 'only the entries that point at a real id are kept');
  assert.equal(f.excluded.length, 0);
});
