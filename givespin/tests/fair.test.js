// Run with:  node --test givespin/tests/fair.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const nodeCrypto = require('node:crypto');
const fair = require('../js/fair.js');

const pool = Array.from({ length: 45 }, (_, i) => ({ id: 'charity-' + String(i).padStart(2, '0') }));

test('sha256 and HMAC agree with Node\'s own implementation', async () => {
  assert.ok(fair.available());
  for (const text of ['', 'abc', 'GiveSpin round seed', 'ünïcode ✓']) {
    assert.equal(await fair.sha256Hex(text), nodeCrypto.createHash('sha256').update(text).digest('hex'));
  }
  const key = 'a'.repeat(64);
  const msg = 'client:7:0';
  const mine = Buffer.from(await fair.hmacBytes(key, msg)).toString('hex');
  assert.equal(mine, nodeCrypto.createHmac('sha256', key).update(msg).digest('hex'));
});

test('draws are deterministic for the same seeds and differ when anything changes', async () => {
  const a = await fair.drawIndices('seed', 'me', 1, 45, 6);
  const b = await fair.drawIndices('seed', 'me', 1, 45, 6);
  assert.deepEqual(a, b);
  assert.equal(a.length, 6);
  assert.ok(a.every((n) => Number.isInteger(n) && n >= 0 && n < 45));
  assert.notDeepEqual(a, await fair.drawIndices('seed2', 'me', 1, 45, 6));
  assert.notDeepEqual(a, await fair.drawIndices('seed', 'you', 1, 45, 6));
  assert.notDeepEqual(a, await fair.drawIndices('seed', 'me', 2, 45, 6));
  // a prefix of a longer draw is the same numbers (cursor order is stable)
  assert.deepEqual((await fair.drawIndices('seed', 'me', 1, 45, 10)).slice(0, 6), a);
});

test('draws are uniform: no bucket is favoured over 30,000 rounds', async () => {
  const n = 12;
  const counts = new Array(n).fill(0);
  const rounds = 30000;
  for (let i = 0; i < rounds; i++) {
    const [idx] = await fair.drawIndices('s' + i, 'client', i, n, 1);
    counts[idx]++;
  }
  const expected = rounds / n;
  counts.forEach((c) => assert.ok(Math.abs(c - expected) < expected * 0.1, `bucket ${c} vs ${expected}`));
});

test('verify passes for an honest round and catches every kind of tampering', async () => {
  const { roundSeed, serverHash } = await fair.newCommit();
  assert.match(roundSeed, /^[0-9a-f]{64}$/);
  assert.equal(serverHash, nodeCrypto.createHash('sha256').update(roundSeed).digest('hex'));
  const ids = fair.sortedIds(pool);
  const idx = await fair.drawIndices(roundSeed, 'my-client-seed', 3, ids.length, 3);
  const round = { roundSeed, serverHash, clientSeed: 'my-client-seed', nonce: 3, poolHash: await fair.poolHash(pool), count: 3, winners: idx.map((i) => ids[i]) };

  const good = await fair.verify(round, pool);
  assert.equal(good.ok, true);
  assert.deepEqual(good.derived, round.winners);

  const swappedWinner = await fair.verify(Object.assign({}, round, { winners: [ids[0], round.winners[1], round.winners[2]].map((w, i) => (i === 0 && w === round.winners[0] ? ids[1] : w)) }), pool);
  assert.equal(swappedWinner.winnersOk, false);
  const wrongSeed = await fair.verify(Object.assign({}, round, { roundSeed: 'f'.repeat(64) }), pool);
  assert.equal(wrongSeed.hashOk, false);
  const smallerPool = await fair.verify(round, pool.slice(0, 40));
  assert.equal(smallerPool.poolOk, false);
  const wrongNonce = await fair.verify(Object.assign({}, round, { nonce: 4 }), pool);
  assert.equal(wrongNonce.winnersOk && wrongNonce.derived.join() === round.winners.join(), false);
});

test('pool hash does not depend on the order the pool arrives in', async () => {
  const shuffled = pool.slice().reverse();
  assert.equal(await fair.poolHash(shuffled), await fair.poolHash(pool));
  assert.notEqual(await fair.poolHash(pool.slice(1)), await fair.poolHash(pool));
});

test('the standalone snippet shown on the Fair Play page matches drawIndices', async () => {
  const ids = ['b', 'a', 'd', 'c', 'e', 'f', 'g'];
  const fn = new Function('crypto', fair.SNIPPET + '\nreturn draw;')(globalThis.crypto);
  for (const nonce of [0, 1, 7]) {
    const mine = await fn('seed-xyz', 'client-1', nonce, ids, 6);
    const idx = await fair.drawIndices('seed-xyz', 'client-1', nonce, ids.length, 6);
    const sorted = [...ids].sort();
    assert.deepEqual(mine, idx.map((i) => sorted[i]));
  }
});

/* ---------------------------------------------------------------- stake-weighted (live tables) */

test('weighted draws follow the stakes (30,000 rounds)', async () => {
  const weights = [['c', 10], ['a', 60], ['b', 30]]; // deliberately not in id order
  const counts = { a: 0, b: 0, c: 0 };
  for (let n = 0; n < 30000; n++) {
    const r = await fair.drawWeighted('seed-' + (n % 97), 'client', n, weights);
    counts[r.winner] += 1;
  }
  const expect = { a: 18000, b: 9000, c: 3000 };
  for (const k of Object.keys(expect)) {
    const sd = Math.sqrt(30000 * (expect[k] / 30000) * (1 - expect[k] / 30000));
    assert.ok(Math.abs(counts[k] - expect[k]) < 5 * sd, k + ' got ' + counts[k] + ' want about ' + expect[k]);
  }
});

test('weighted draws are deterministic and match a plain draw over the expanded ticket list', async () => {
  const weights = [['b', 3], ['a', 2], ['d', 5]];
  const a = await fair.drawWeighted('s1', 'c1', 4, weights);
  const b = await fair.drawWeighted('s1', 'c1', 4, [['d', 5], ['a', 2], ['b', 3]]);
  assert.deepEqual(a, b, 'input order does not matter');
  const expanded = ['a', 'a', 'b', 'b', 'b', 'd', 'd', 'd', 'd', 'd'];
  const idx = (await fair.drawIndices('s1', 'c1', 4, expanded.length, 1))[0];
  assert.equal(a.winner, expanded[idx]);
  assert.equal(a.ticket, idx);
  assert.equal(fair.ticketOwner(fair.sortWeights(weights), 0), 'a');
  assert.equal(fair.ticketOwner(fair.sortWeights(weights), 2), 'b');
  assert.equal(fair.ticketOwner(fair.sortWeights(weights), 9), 'd');
});

test('a charity with no tickets can never win, and one with all of them always does', async () => {
  for (let n = 0; n < 50; n++) {
    assert.equal((await fair.drawWeighted('s', 'c', n, [['x', 0], ['y', 7]])).winner, 'y');
  }
});

test('weighted verification passes for a real round and catches tampering', async () => {
  const commit = await fair.newCommit();
  const weights = [['wateraid', 40], ['unicef-usa', 25], ['red-cross', 35]];
  const d = await fair.drawWeighted(commit.roundSeed, 'me', 3, weights);
  const round = { roundSeed: commit.roundSeed, serverHash: commit.serverHash, clientSeed: 'me', nonce: 3, poolHash: await fair.weightsHash(weights), weights, winners: [d.winner] };
  assert.equal((await fair.verifyWeighted(round)).ok, true);
  const wrongWinner = Object.assign({}, round, { winners: [d.winner === 'wateraid' ? 'red-cross' : 'wateraid'] });
  const v1 = await fair.verifyWeighted(wrongWinner);
  assert.equal(v1.winnersOk, false);
  assert.equal(v1.hashOk, true);
  const wrongStakes = Object.assign({}, round, { weights: [['wateraid', 41], ['unicef-usa', 25], ['red-cross', 35]] });
  assert.equal((await fair.verifyWeighted(wrongStakes)).poolOk, false);
  const wrongSeed = Object.assign({}, round, { roundSeed: 'f'.repeat(64) });
  assert.equal((await fair.verifyWeighted(wrongSeed)).hashOk, false);
});
