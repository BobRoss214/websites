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
  const events = [];
  const state = { full: false };
  const sandbox = {
    localStorage: {
      getItem: (k) => (data.has(k) ? data.get(k) : null),
      setItem: (k, v) => { if (state.full) { const e = new Error('The quota has been exceeded.'); e.name = 'QuotaExceededError'; throw e; } data.set(k, String(v)); },
      removeItem: (k) => { data.delete(k); }
    },
    CustomEvent,
    dispatchEvent: (ev) => { events.push(ev); return true; }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  ['core.js', 'config.js', 'data.js', 'store.js'].forEach((f) => {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', f), 'utf8'), sandbox, { filename: f });
  });
  return { GS: sandbox.GS, data, events, state, KEY: 'givespin:v2' };
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
    game: opts.game || 'roulette', totalCents: 2500, rounds: 1, status: 'done', pay: 'credit', fair: f,
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

/** Records a stake-weighted (live table) round with `n` backed charities. */
async function playLiveRound(page, n, nonce) {
  const { GS } = page;
  const ids = GS.charities.map((c) => c.id);
  const weights = ids.slice(0, n).map((id, i) => [id, 5 + (i % 7) * 5]);
  const commit = await fair.newCommit();
  const clientSeed = 'live' + nonce;
  const drawn = await fair.drawWeighted(commit.roundSeed, clientSeed, nonce, weights);
  const f = {
    roundSeed: commit.roundSeed, serverHash: commit.serverHash, clientSeed, nonce, poolHash: await fair.weightsHash(weights), count: 1,
    winners: [drawn.winner], filters: GS.core.emptyFilters(), excluded: [], board: [], weights
  };
  GS.store.recordPlay({
    game: 'wheel', totalCents: 2000, rounds: 1, status: 'done', pay: 'credit', fair: f,
    live: { pot: weights.reduce((t, w) => t + w[1], 0), players: 12, stake: 2000, pick: ids[0], won: false, winner: drawn.winner },
    allocations: [{ charityId: drawn.winner, cents: 2000, hits: 1 }]
  });
  return f;
}

test('a live round with 25 backed charities keeps all 25 stakes and still verifies after a reload', async () => {
  for (const n of [13, 25, 30, 40]) {
    const page = makePage();
    const f = await playLiveRound(page, n, n);
    page.GS.store.load();
    const entry = page.GS.store.get().history[0];
    assert.equal(entry.fair.weights.length, n, n + ' stakes came back');
    assert.equal(JSON.stringify(entry.fair.weights), JSON.stringify(f.weights));
    const r = await fair.verifyWeighted(entry.fair);
    assert.deepEqual({ hashOk: r.hashOk, poolOk: r.poolOk, winnersOk: r.winnersOk }, { hashOk: true, poolOk: true, winnersOk: true }, n + ' backed charities');
  }
  const page = makePage();
  await playLiveRound(page, 45, 45);
  page.GS.store.load();
  assert.equal(page.GS.store.get().history[0].fair.weights.length, 40, 'the cap is 40 stakes (a table has up to 30 gates)');
});

test('a Dice or slots round (drawn from the whole pool) keeps the pool, so it still verifies after a charity is added to the roster', async () => {
  const page = makePage();
  const { GS } = page;
  const f = await playRound(page, GS.charities.length, { game: 'dice' }); // the whole roster in play: what the game now saves as `board`
  assert.equal(f.board.length, GS.charities.length);
  page.GS.store.load();
  const entry = GS.store.get().history[0];
  assert.equal(entry.fair.board.length, GS.charities.length);
  assert.equal((await verifyFromStore(page, entry)).ok, true, 'before any roster change');
  GS.charities.push({ id: 'zz-brand-new-charity', name: 'Brand New', causes: [], serves: [], where: [], how: [] }); // a roster update arrives
  const after = await verifyFromStore(page, GS.store.get().history[0]);
  assert.equal(after.ok, true, 'after the roster grew by one');
  // the same round saved the old way (no board: the pool is rebuilt from the filters and today's roster) does fail after the update
  const old = JSON.parse(JSON.stringify(entry.fair));
  old.board = [];
  assert.equal((await verifyFromStore(page, { fair: old })).ok, false, 'the old way breaks, which is why the board is saved');
});

test('a round cut to 300 by the older version is flagged, and the flag survives saving; a fresh 300 board is not flagged', async () => {
  const page = makePage();
  const ids = page.GS.charities.map((c) => c.id);
  const mk = (id, fairPart) => ({ id, ts: 1, game: 'wheel', totalCents: 500, rounds: 1, status: 'done', pay: 'credit', freq: 'once', allocations: [{ charityId: ids[0], cents: 500 }], fair: Object.assign({ roundSeed: 'a', serverHash: 'b', clientSeed: 'c', nonce: 1, poolHash: 'd', count: 1, winners: [ids[0]] }, fairPart) });
  page.data.set(page.KEY, JSON.stringify({ v: 2, history: [mk('GS-OLD300', { board: ids.slice(0, 300) }), mk('GS-OLD299', { board: ids.slice(0, 299) }), mk('GS-OLDEXC', { excluded: ids.slice(0, 300) })] }));
  page.GS.store.load();
  const flags = () => JSON.stringify(page.GS.store.get().history.map((h) => h.fair.cut === true));
  assert.equal(flags(), '[true,false,true]');
  page.GS.store.save();
  page.GS.store.load();
  assert.equal(flags(), '[true,false,true]', 'after a save and another load');
  const fresh = makePage();
  await playRound(fresh, 300);
  fresh.GS.store.load();
  assert.equal(fresh.GS.store.get().history[0].fair.cut, undefined, 'a 300-charity board saved by this version is not flagged');
});

test('saving does not change the saved text, and a reload then a save gives the very same text', async () => {
  const page = makePage();
  for (let i = 1; i <= 8; i++) { await playRound(page, 400 + i * 50, { nonce: i, excluded: page.GS.charities.slice(0, 20 + i).map((c) => c.id) }); }
  const t1 = page.data.get(page.KEY);
  page.GS.store.save();
  assert.equal(page.data.get(page.KEY), t1, 'saving again');
  page.GS.store.load();
  page.GS.store.save();
  const t2 = page.data.get(page.KEY);
  const a = JSON.parse(t1);
  const b = JSON.parse(t2);
  assert.equal(JSON.stringify(b.ids), JSON.stringify(a.ids), 'the id table is kept as it was');
  assert.equal(JSON.stringify(b.history.map((h) => [h.fair.boardIx, h.fair.excludedIx])), JSON.stringify(a.history.map((h) => [h.fair.boardIx, h.fair.excludedIx])), 'every round keeps its packed text');
  page.GS.store.load();
  page.GS.store.save();
  assert.equal(page.data.get(page.KEY), t2, 'after one reload, a reload then a save gives the very same text');
  assert.ok(page.GS.store.get().history.every((h) => h.fair && typeof h.fair._pk === 'object'), 'each round remembers its packed text');
});

test('saving 60 big rounds does not repack them: the packed text of a round is worked out once', async () => {
  const page = makePage();
  for (let i = 1; i <= 60; i++) { await playRound(page, 1000, { nonce: i }); }
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 20; i++) { page.GS.store.save(); }
  const each = Number(process.hrtime.bigint() - t0) / 20 / 1e6;
  console.log('# a save with 60 rounds on 1,000-charity boards takes about ' + each.toFixed(1) + ' ms');
  assert.ok(each < 40, 'a save took ' + each.toFixed(1) + ' ms'); // the repacking version took about 50 ms on a quiet machine; this one a few
});

test('the id table running out spells the lists out in full instead of dropping ids', async () => {
  const page = makePage();
  const fake = (r, k, n) => Array.from({ length: n }, (_, i) => 'x' + r + '-' + k + '-' + i);
  for (let r = 1; r <= 60; r++) {
    page.GS.store.recordPlay({
      game: 'roulette', totalCents: 500, rounds: 1, status: 'done', pay: 'credit',
      fair: { roundSeed: 's' + r, serverHash: 'h', clientSeed: 'c', nonce: r, poolHash: 'p', count: 1, winners: ['a'], filters: page.GS.core.emptyFilters(), excluded: fake(r, 'e', 1100), board: fake(r, 'b', 1100) },
      allocations: [{ charityId: page.GS.charities[0].id, cents: 500, hits: 1 }]
    });
  }
  page.GS.store.load();
  const h = page.GS.store.get().history;
  assert.equal(h.length, 60);
  assert.ok(h.every((e) => e.fair.board.length === 1100 && e.fair.excluded.length === 1100), 'every list came back whole');
  assert.equal(h[0].fair.board[0], 'x60-b-0');
  assert.equal(h[59].fair.excluded[1099], 'x1-e-1099');
});

test('reading a packed list is strict: a piece must be three base-36 digits that point at a real id', async () => {
  const page = makePage();
  const ids = page.GS.charities.map((c) => c.id);
  const bad = {
    v: 2, ids: [ids[0], ids[1], ids[2]],
    history: [{ id: 'GS-DDDDDD', ts: 1, game: 'wheel', totalCents: 500, rounds: 1, status: 'done', pay: 'credit', freq: 'once', allocations: [{ charityId: ids[0], cents: 500 }],
      fair: { roundSeed: 'a', serverHash: 'b', clientSeed: 'c', nonce: 1, poolHash: 'd', count: 1, winners: [ids[0]], boardIx: '000-01 02A02001' } }]
  };
  page.data.set(page.KEY, JSON.stringify(bad));
  page.GS.store.load();
  // pieces: "000" ok, "-01" no (a sign), " 02" no (a space), "A02" no (a capital), "001" ok; the last piece is incomplete
  assert.equal(JSON.stringify(page.GS.store.get().history[0].fair.board), JSON.stringify([ids[0], ids[1]]));
});

test('a failed save (storage full) is swallowed, tells the page once per failure, and the game state still works', async () => {
  const page = makePage();
  await playRound(page, 12, { nonce: 1 });
  page.state.full = true;
  await playRound(page, 12, { nonce: 2 }); // must not throw
  assert.equal(page.GS.store.get().history.length, 2, 'the round is kept in memory');
  assert.ok(page.events.length >= 1 && page.events.every((e) => e.type === 'gs:savefail'), 'the page was told');
  assert.equal(page.events[0].detail.name, 'QuotaExceededError');
  page.state.full = false;
  const n = page.events.length;
  page.GS.store.save();
  assert.equal(page.events.length, n, 'no event when saving works');
});
