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

test('a board of 300, 301 or 500 charities is still there and still verifies after a reload', async () => {
  for (const n of [300, 301, 500]) {
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
  const excluded = all.slice(0, all.length - 12); // almost everything switched off: about 490 ids
  assert.ok(excluded.length > 400);
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
        fair: { roundSeed: 'a', serverHash: 'b', clientSeed: 'c', nonce: 1, poolHash: 'd', count: 1, winners: [ids[1]], board: ids.slice(0, 500) } }
    ]
  };
  page.data.set(page.KEY, JSON.stringify(old));
  page.GS.store.load();
  const h = page.GS.store.get().history;
  assert.equal(h.length, 2);
  assert.equal(JSON.stringify(h[0].fair.board), JSON.stringify(ids.slice(0, 300)));
  assert.equal(JSON.stringify(h[0].fair.excluded), JSON.stringify(ids.slice(300, 320)));
  assert.equal(h[1].fair.board.length, 500);
  // and saving again turns them into the packed form without losing anything
  page.GS.store.save();
  page.GS.store.load();
  const h2 = page.GS.store.get().history;
  assert.equal(JSON.stringify(h2[0].fair.board), JSON.stringify(ids.slice(0, 300)));
  assert.equal(h2[1].fair.board.length, 500);
});

test('storage stays small: 20 rounds on 1,000-charity boards, and a full history of 60', async () => {
  const page = makePage();
  const all = page.GS.charities.map((c) => c.id);
  const excluded = all.slice(0, 500); // the worst case: a long switched-off list on every round as well
  let at20 = 0;
  for (let i = 1; i <= 60; i++) {
    await playRound(page, 500, { excluded, nonce: i });
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
    assert.equal(entry.fair.board.length, 500);
    assert.equal(entry.fair.excluded.length, 500);
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
  for (let i = 1; i <= 60; i++) { await playRound(page, 500, { nonce: i }); }
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
      fair: { roundSeed: 's' + r, serverHash: 'h', clientSeed: 'c', nonce: r, poolHash: 'p', count: 1, winners: ['a'], filters: page.GS.core.emptyFilters(), excluded: fake(r, 'e', 480), board: fake(r, 'b', 480) },
      allocations: [{ charityId: page.GS.charities[0].id, cents: 500, hits: 1 }]
    });
  }
  page.GS.store.load();
  const h = page.GS.store.get().history;
  assert.equal(h.length, 60);
  assert.ok(h.every((e) => e.fair.board.length === 480 && e.fair.excluded.length === 480), 'every list came back whole');
  assert.equal(h[0].fair.board[0], 'x60-b-0');
  assert.equal(h[59].fair.excluded[479], 'x1-e-479');
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

test('a saved round with nothing allocated is dropped, so the lobby never meets it', async () => {
  const page = makePage();
  const ids = page.GS.charities.map((c) => c.id);
  const mk = (allocations) => ({ id: 'GS-DDDDDD', ts: 1, game: 'wheel', totalCents: 500, rounds: 1, status: 'done', pay: 'credit', freq: 'once', allocations });
  page.data.set(page.KEY, JSON.stringify({ v: 2, ids: [], history: [mk([]), mk([{}]), mk([{ charityId: 7 }]), mk([{ charityId: ids[0], cents: 500 }])] }));
  page.GS.store.load();
  const h = page.GS.store.get().history;
  assert.equal(h.length, 1, 'only the round that names a charity survives');
  assert.equal(h[0].allocations[0].charityId, ids[0]);
});

test('"Erase my data" removes the dedication text, custom lists, switched-off charities and the id table, and keeps only sound, voice and sidebar', async () => {
  const page = makePage();
  await playRound(page, 12, { nonce: 1 });
  const ids = page.GS.charities.map((c) => c.id);
  const set = (k, v) => page.GS.store.setPref(k, v);
  set('dedication', { kind: 'memory', name: 'Grandma Rose', note: 'She loved clean water.' });
  set('custom', { wheel: { on: true, ids: ids.slice(0, 5) } });
  set('excluded', ids.slice(0, 10));
  set('muted', true); set('voice', true); set('sidebar', false);
  page.GS.store.eraseAll();
  const p = page.GS.store.prefs();
  assert.equal(p.dedication.name, '');
  assert.equal(p.dedication.note, '');
  assert.equal(JSON.stringify(p.custom), '{}');
  assert.equal(p.excluded.length, 0);
  assert.equal(p.muted, true);
  assert.equal(p.voice, true);
  assert.equal(p.sidebar, false);
  const raw = page.data.get(page.KEY);
  assert.ok(raw.indexOf('Grandma Rose') < 0 && raw.indexOf(ids[3]) < 0, 'nothing of the old rounds or choices is left in the saved text');
  assert.equal(page.GS.store.get().history.length, 0);
});

test('recordPlay: the gift earns exactly 10 XP for every $1, and bonuses and the hot hand are reported on top, separately', () => {
  const page = makePage();
  const { GS } = page;
  const ids = GS.charities.map((c) => c.id);
  const play = (cents, extra) => GS.store.recordPlay(Object.assign({
    game: 'wheel', totalCents: cents, rounds: 1, status: 'done', pay: 'credit', receipt: 'r' + Math.random(),
    allocations: [{ charityId: ids[0], cents, hits: 1 }]
  }, extra || {}));
  const a = play(500);
  assert.equal(a.giftXp, 50, '$5 is 50 XP');
  assert.equal(a.bonusXp, 0);
  assert.equal(a.hotXp, 0);
  assert.equal(a.xpGain, 50);
  assert.equal(GS.store.get().xp, 50, 'the XP total is exactly what the receipts said');
  const b = play(2000, { rounds: 5 });
  assert.equal(b.giftXp, 200, 'splitting a $20 gift into five rounds adds nothing');
  const c = play(1000, { pick: { charityId: ids[0], won: true, board: 8, wins: 1 }, bonusXp: 34 });
  assert.equal(c.giftXp, 100);
  assert.equal(c.bonusXp, 34, 'backing the winner is a separate bonus');
  assert.equal(c.xpGain, 134);
  const d = play(1000);   // the call was a hit, so the hot hand is on now
  assert.equal(d.giftXp, 100, 'the gift part is never multiplied');
  assert.equal(d.hotXp, 10, 'a hot hand of one adds x1.1: 10 XP on top of 100');
  assert.equal(d.xpGain, 110);
  const j = play(1000, { jackpot: true });
  assert.equal(j.bonusXp, GS.core.JACKPOT_XP);
  assert.equal(GS.store.get().xp, 50 + 200 + 134 + 110 + j.xpGain, 'every receipt adds up to the saved XP');
});

test('the Marble Run track choice is saved, comes back after a reload, and a missing or damaged one means the first track', () => {
  const page = makePage();
  const { GS } = page;
  assert.equal(GS.store.prefs().marbleMap, '', 'a new visitor has no choice, which means the first track');
  GS.store.setPref('marbleMap', 'spiral');
  GS.store.load();
  assert.equal(GS.store.prefs().marbleMap, 'spiral', 'a chosen track survives a reload');
  GS.store.setPref('marbleMap', 'random');
  GS.store.load();
  assert.equal(GS.store.prefs().marbleMap, 'random', 'so does Surprise me');
  // saved data from before there were tracks has no such key
  const old = JSON.parse(page.data.get(page.KEY));
  delete old.prefs.marbleMap;
  page.data.set(page.KEY, JSON.stringify(old));
  GS.store.load();
  assert.equal(GS.store.prefs().marbleMap, '', 'older saved data without the key loads, as the first track');
  // junk in the saved text never gets through (only a short lower-case id does; whether the game still has that track is the game\'s business)
  [5, null, true, ['spiral'], { id: 'spiral' }, 'Spiral Tower', '', 'a'.repeat(40), '../../x', '<script>'].forEach((junk) => {
    const d = JSON.parse(page.data.get(page.KEY));
    d.prefs.marbleMap = junk;
    page.data.set(page.KEY, JSON.stringify(d));
    GS.store.load();
    assert.equal(GS.store.prefs().marbleMap, '', JSON.stringify(junk) + ' is dropped');
  });
  const d2 = JSON.parse(page.data.get(page.KEY));
  d2.prefs.marbleMap = 'a-track-from-the-future';
  page.data.set(page.KEY, JSON.stringify(d2));
  GS.store.load();
  assert.equal(GS.store.prefs().marbleMap, 'a-track-from-the-future', 'a well-formed id the store has never heard of is kept (the game decides what it means)');
  GS.store.setPref('marbleMap', 'zigzag');
  GS.store.eraseAll();
  assert.equal(GS.store.prefs().marbleMap, '', '"Erase my data" forgets the track too');
  assert.ok(page.data.get(page.KEY).indexOf('zigzag') < 0, 'and it is gone from the saved text');
});

/* ------------------------------------------------------------------ ranks: what a round reports, and that nothing about them is stored */

/** Records one pretend gift of `cents` and returns what the store says about it. */
function give(GS, cents, extra) {
  const ids = GS.charities.map((c) => c.id);
  return GS.store.recordPlay(Object.assign({
    game: 'wheel', totalCents: cents, rounds: 1, status: 'done', pay: 'credit', receipt: 'GS-R' + Math.random().toString(36).slice(2, 8),
    allocations: [{ charityId: ids[0], cents, hits: 1 }]
  }, extra || {}));
}
/** A page whose player has already given `cents` (and has the XP that earns, unless `xp` says otherwise). */
function pageWith(cents, xp) {
  const page = makePage();
  const s = page.GS.store.get();
  s.totalCents = cents;
  s.xp = xp === undefined ? Math.round(cents / 10) : xp;
  return page;
}

test('a round that crosses $1,000 reports the rank-up once: rankBefore, rankAfter and rankedUp (and the next gift does not report it again)', () => {
  const page = pageWith(99900);                       // $999.00 given: still the old level 10
  const { GS } = page;
  assert.equal(GS.store.standing().label, 'Level 10');
  const a = give(GS, 100);                            // $1.00 more is exactly $1,000.00
  assert.equal(GS.store.get().totalCents, 100000);
  assert.deepEqual([a.rankBefore.label, a.rankBefore.rank], ['Level 10', 0]);
  assert.deepEqual([a.rankAfter.label, a.rankAfter.rank, a.rankAfter.name, a.rankAfter.level], ['Rank 1 · Level 1', 1, 'Patron', 1]);
  assert.equal(a.rankedUp, true, 'exactly $1,000.00 is the first rank');
  assert.equal(a.levelUp, false, 'a rank-up is not also a level-up');
  assert.equal(a.leveledUp, false, 'the XP level was already 10: the old flag is untouched');
  const b = give(GS, 100);                            // $1,001.00: still rank 1 level 1
  assert.deepEqual([b.rankedUp, b.levelUp, b.rankBefore.label, b.rankAfter.label], [false, false, 'Rank 1 · Level 1', 'Rank 1 · Level 1']);
  assert.equal(GS.store.standing().label, 'Rank 1 · Level 1');
});

test('$999.99 is not ranked and exactly $1,000.00 is rank 1, checked to the cent', () => {
  const page = pageWith(99998);
  const { GS } = page;
  const a = give(GS, 1);                              // $999.99
  assert.equal(GS.store.get().totalCents, 99999);
  assert.deepEqual([a.rankedUp, a.rankAfter.label], [false, 'Level 10']);
  const b = give(GS, 1);                              // $1,000.00
  assert.deepEqual([b.rankedUp, b.rankAfter.label], [true, 'Rank 1 · Level 1']);
});

test('a round inside a rank reports levelUp when it crosses a level (rank 2: level 6 begins at $7,500), and neither flag when it does not', () => {
  const page = pageWith(749000);                      // $7,490.00: rank 2 level 5
  const { GS } = page;
  const stay = give(GS, 500);                         // $7,495.00
  assert.deepEqual([stay.rankedUp, stay.levelUp, stay.rankAfter.label], [false, false, 'Rank 2 · Level 5']);
  const up = give(GS, 500);                           // $7,500.00
  assert.equal(GS.store.get().totalCents, 750000);
  assert.deepEqual([up.rankedUp, up.levelUp, up.rankBefore.label, up.rankAfter.label], [false, true, 'Rank 2 · Level 5', 'Rank 2 · Level 6']);
  assert.equal(up.leveledUp, false, 'the XP level is the old one and did not move');
  const next = give(GS, 100);
  assert.deepEqual([next.rankedUp, next.levelUp], [false, false]);
  // one big gift can lift several levels at once: still one level-up, naming where it ended
  const big = give(GS, 140000);                       // $8,901: levels 6, 7, 8
  assert.deepEqual([big.rankedUp, big.levelUp, big.rankAfter.level], [false, true, 8]);
});

test('the last level of a rank leads into the next rank, and one big gift that jumps several ranks is one rank-up that ends on the final rank', () => {
  const page = pageWith(999000);                      // $9,990.00: rank 2 level 10
  const { GS } = page;
  const r = give(GS, 1000);                           // $10,000.00
  assert.deepEqual([r.rankedUp, r.levelUp, r.rankBefore.label, r.rankAfter.label, r.rankAfter.name], [true, false, 'Rank 2 · Level 10', 'Rank 3 · Level 1', 'Champion']);
  const lateral = pageWith(110000);                   // $1,100: rank 1 level 1
  const l = give(lateral.GS, 600000);                 // +$6,000 = $7,100: rank 2 level 5
  assert.deepEqual([l.rankedUp, l.levelUp, l.rankBefore.label, l.rankAfter.label], [true, false, 'Rank 1 · Level 1', 'Rank 2 · Level 5'], 'landing on a higher level of the new rank is still only a rank-up');
  const jump = pageWith(90000);                       // $900 given
  const j = give(jump.GS, 6000000);                   // +$60,000 = $60,900
  assert.deepEqual([j.rankedUp, j.rankBefore.rank, j.rankAfter.rank, j.rankAfter.name], [true, 0, 5, 'Paragon']);
  const top = pageWith(99999000);                     // $999,990.00
  const t = give(top.GS, 1000);                       // $1,000,000.00
  assert.deepEqual([t.rankedUp, t.rankAfter.label, t.rankAfter.name], [true, 'Rank 8 · Level 1', 'Immortal']);
  const more = give(top.GS, 10000000);                // +$100,000
  assert.deepEqual([more.rankedUp, more.levelUp, more.rankAfter.label], [false, true, 'Rank 8 · Level 2']);
});

test('before $1,000 given, levelUp is the old XP level-up, and the rank flags stay off', () => {
  const page = makePage();
  const { GS } = page;
  const first = give(GS, 1000);                       // $10 = 100 XP = level 2
  assert.deepEqual([first.leveledUp, first.levelUp, first.rankedUp, first.rankBefore.label, first.rankAfter.label], [true, true, false, 'Level 1', 'Level 2']);
  const flat = give(GS, 100);
  assert.deepEqual([flat.leveledUp, flat.levelUp, flat.rankedUp], [false, false, false]);
  const bonus = give(GS, 100, { bonusXp: 200 });      // a bonus can lift the level without much money
  assert.equal(bonus.leveledUp, bonus.levelUp);
  assert.equal(bonus.rankedUp, false);
  assert.equal(bonus.rankAfter.label, 'Level ' + GS.core.levelFor(GS.store.get().xp).level);
});

test('XP that is not tied to a gift (a prediction, the Charity Cup) can lift a level before $1,000, and can never lift a rank', () => {
  const young = makePage();
  const g = young.GS.store.grantXp(150);              // level 2 at 100 XP
  assert.deepEqual([g.leveledUp, g.levelUp, g.rankedUp, g.rankAfter.label], [true, true, false, 'Level 2']);
  const ranked = pageWith(750000, 50);                // $7,500 given but little XP (an old save)
  const r = ranked.GS.store.grantXp(900000);
  assert.deepEqual([r.rankedUp, r.levelUp, r.rankBefore.label, r.rankAfter.label], [false, false, 'Rank 2 · Level 6', 'Rank 2 · Level 6'], 'a pile of XP does not move a rank');
  assert.equal(r.leveledUp, true, 'it still lifts the XP level, which still drives the league tiers');
});

test('nothing about ranks is stored: the rank is worked out from totalCents, so the saved text has no rank in it', () => {
  const page = pageWith(99900);
  const { GS } = page;
  const before = Object.keys(JSON.parse(page.data.get(page.KEY) || '{}'));
  give(GS, 100);
  give(GS, 100);
  const saved = JSON.parse(page.data.get(page.KEY));
  assert.equal(saved.totalCents, 100100, '$999.00 and two gifts of $1.00');
  assert.ok(!/rank|standing|patron/i.test(page.data.get(page.KEY)), 'no rank anywhere in the saved text');
  assert.ok(!Object.keys(saved).some((k) => /rank|standing/i.test(k)));
  assert.ok(!Object.keys(saved.history[0]).some((k) => /rank|standing/i.test(k)), 'nor in a saved round');
  const added = Object.keys(saved).filter((k) => before.indexOf(k) < 0 && before.length);
  assert.deepEqual(added, [], 'no new key was added to the save');
});

test('older saves just work: a save with a big total and no rank anywhere gets the rank its total gives it', () => {
  const page = makePage();
  const { GS } = page;
  page.data.set(page.KEY, JSON.stringify({ v: 2, xp: 40, totalCents: 750000, plays: 12 }));   // a lot given, hardly any XP
  GS.store.load();
  assert.equal(GS.store.standing().label, 'Rank 2 · Level 6');
  assert.equal(GS.store.standing().name, 'Benefactor');
  assert.equal(GS.core.levelFor(GS.store.get().xp).level, 1, 'the XP level (and so the tier) is still the XP\'s own: 40 XP is level 1');
  // the first-ever version\'s save, under its own key
  const legacy = makePage();
  legacy.data.set('givespin:v1', JSON.stringify({ xp: 9500, totalCents: 100000 }));
  legacy.GS.store.load();
  assert.equal(legacy.GS.store.standing().label, 'Rank 1 · Level 1');
  // exactly one cent short, and damaged totals, are not ranked
  [{ totalCents: 99999 }, { totalCents: -5 }, { totalCents: 'a lot' }, { totalCents: null }, { totalCents: NaN }].forEach((o) => {
    const p = makePage();
    p.data.set(p.KEY, JSON.stringify(Object.assign({ v: 2, xp: 9000 }, o)));
    p.GS.store.load();
    assert.equal(p.GS.store.standing().rank, 0, JSON.stringify(o) + ' is not ranked');
  });
  // a save that is already past the top
  const top = makePage();
  top.data.set(top.KEY, JSON.stringify({ v: 2, xp: 5, totalCents: 250000000 }));
  top.GS.store.load();
  assert.deepEqual([top.GS.store.standing().label, top.GS.store.standing().maxed], ['Rank 8 · Level 10', true]);
});

test('"Reset my progress" and "Erase my data" take the rank away with the total, and a reload keeps it', () => {
  const page = pageWith(750000);
  const { GS } = page;
  give(GS, 100);
  GS.store.load();
  assert.equal(GS.store.standing().label, 'Rank 2 · Level 6', 'a reload keeps the rank (it comes from the saved total)');
  GS.store.reset();
  assert.equal(GS.store.standing().label, 'Level 1');
  const other = pageWith(1200000);
  give(other.GS, 100);
  other.GS.store.eraseAll();
  assert.equal(other.GS.store.standing().label, 'Level 1');
});

test('what a round reports about ranks is plain data: it survives JSON, and the numbers agree with core.standingFor', () => {
  const page = pageWith(499900);
  const { GS } = page;
  const s = give(GS, 100);
  const copy = JSON.parse(JSON.stringify({ a: s.rankBefore, b: s.rankAfter, up: s.rankedUp, lv: s.levelUp }));
  assert.deepEqual(copy.b, JSON.parse(JSON.stringify(GS.core.standingFor(GS.store.get().xp, GS.store.get().totalCents))));
  assert.equal(copy.up, true);
  assert.equal(s.rankAfter.label, 'Rank 2 · Level 1');
  assert.equal(copy.b.nextRank.name, 'Champion');
});
