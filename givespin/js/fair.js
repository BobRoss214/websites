/*
 * Fair play: how a result is derived, in a way anyone can recompute.
 *
 * Before a round, the game shows the SHA-256 hash of a secret "round seed". When the round is played, the winner
 * of each draw comes from HMAC-SHA256(roundSeed, clientSeed:nonce:blockIndex), read as 32-bit numbers with
 * rejection sampling (no modulo bias), applied to the charities in play sorted by id. After the round the seed is
 * revealed, so the player can hash it and match the hash that was shown beforehand, then recompute the draws.
 *
 * Honest limits: in this browser-only build the seed is generated on the same device that plays the game, so
 * this shows how results are derived and that they were fixed before the animation, it is not an audit by a
 * separate party. A real deployment should generate and commit seeds on a server the player does not control.
 *
 * Works in browsers and in Node 18+ (Web Crypto) so it can be unit-tested.
 */
(function (root, factory) {
  'use strict';
  var fair = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = fair; }
  if (typeof window !== 'undefined') { window.GS = window.GS || {}; window.GS.fair = fair; }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';

  var subtle = (root.crypto && root.crypto.subtle) ? root.crypto.subtle : null;
  var rng = root.crypto && root.crypto.getRandomValues ? root.crypto : null;
  var enc = new TextEncoder();

  function toHex(buf) {
    var bytes = new Uint8Array(buf);
    var out = '';
    for (var i = 0; i < bytes.length; i++) { out += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16); }
    return out;
  }

  /** True when this browser can do the maths (needs a secure context for crypto.subtle). */
  function available() { return !!subtle; }

  function randomHex(byteCount) {
    var b = new Uint8Array(byteCount || 32);
    if (rng) { rng.getRandomValues(b); }
    else { for (var i = 0; i < b.length; i++) { b[i] = Math.floor(Math.random() * 256); } }
    return toHex(b);
  }

  function sha256Hex(text) {
    return subtle.digest('SHA-256', enc.encode(text)).then(toHex);
  }

  function hmacBytes(key, message) {
    return subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      .then(function (k) { return subtle.sign('HMAC', k, enc.encode(message)); })
      .then(function (sig) { return new Uint8Array(sig); });
  }

  /**
   * A deterministic stream of unbiased integers for one round.
   * nextInt(max) returns a Promise of an integer in [0, max).
   */
  function stream(roundSeed, clientSeed, nonce) {
    var block = 0;
    var words = [];
    var used = 0;

    function refill() {
      return hmacBytes(roundSeed, clientSeed + ':' + nonce + ':' + block).then(function (bytes) {
        block += 1;
        words = [];
        for (var i = 0; i + 3 < bytes.length; i += 4) {
          words.push(((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0);
        }
        used = 0;
      });
    }

    function nextWord() {
      if (used >= words.length) { return refill().then(nextWord); }
      return Promise.resolve(words[used++]);
    }

    return {
      nextInt: function (max) {
        max = Math.floor(max);
        if (max <= 1) { return Promise.resolve(0); }
        var limit = 4294967296 - (4294967296 % max);
        function attempt() {
          return nextWord().then(function (w) { return w >= limit ? attempt() : w % max; });
        }
        return attempt();
      }
    };
  }

  /** `count` independent winner indices into a pool of `poolSize` (sequential draws from one stream). */
  function drawIndices(roundSeed, clientSeed, nonce, poolSize, count) {
    var s = stream(roundSeed, clientSeed, nonce);
    var out = [];
    function step(i) {
      if (i >= count) { return Promise.resolve(out); }
      return s.nextInt(poolSize).then(function (n) { out.push(n); return step(i + 1); });
    }
    return step(0);
  }

  /** The same pool order every time: sorted by id. */
  function sortedIds(pool) {
    return pool.map(function (c) { return c.id; }).sort();
  }

  /** A fingerprint of the pool so a past round can prove which charities were in play. */
  function poolHash(pool) { return sha256Hex(sortedIds(pool).join(',')); }

  /**
   * Recompute a round and compare. `round` = { roundSeed, serverHash, clientSeed, nonce, poolHash, count, winners[] }.
   * Resolves { hashOk, poolOk, winnersOk, ok, derived: [ids] }.
   */
  function verify(round, pool) {
    var ids = sortedIds(pool);
    return Promise.all([sha256Hex(round.roundSeed), poolHash(pool), drawIndices(round.roundSeed, round.clientSeed, round.nonce, ids.length, round.count)])
      .then(function (r) {
        var derived = r[2].map(function (i) { return ids[i]; });
        var hashOk = r[0] === round.serverHash;
        var poolOk = r[1] === round.poolHash;
        var winnersOk = derived.length === round.winners.length && derived.every(function (id, i) { return id === round.winners[i]; });
        return { hashOk: hashOk, poolOk: poolOk, winnersOk: winnersOk, ok: hashOk && poolOk && winnersOk, derived: derived };
      });
  }

  /* ------------------------------------------------ stake-weighted draws (live tables) */

  /**
   * A live table's draw is stake-weighted: every dollar in the pot is one ticket, and the winner is the charity that
   * owns the drawn ticket. `weights` is a list of [charityId, tickets]; it is always put in id order first, so the
   * same stakes give the same ticket list everywhere. This is exactly a uniform draw over the id-sorted list in
   * which each charity id appears once per ticket.
   */
  function sortWeights(weights) {
    return weights.map(function (w) { return [w[0], Math.floor(w[1])]; })
      .filter(function (w) { return w[1] > 0; })
      .sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
  }

  function weightsTotal(weights) { return weights.reduce(function (s, w) { return s + w[1]; }, 0); }

  /** Which charity owns ticket number `index` (0-based) when tickets are laid out in id order. */
  function ticketOwner(weights, index) {
    var left = index;
    for (var i = 0; i < weights.length; i++) {
      if (left < weights[i][1]) { return weights[i][0]; }
      left -= weights[i][1];
    }
    return weights.length ? weights[weights.length - 1][0] : null;
  }

  /** A fingerprint of the stakes, so a past round can prove what was in the pot. */
  function weightsHash(weights) {
    return sha256Hex(sortWeights(weights).map(function (w) { return w[0] + ':' + w[1]; }).join(','));
  }

  /** Resolves { winner: charityId, ticket: number, weights } for one stake-weighted draw. */
  function drawWeighted(roundSeed, clientSeed, nonce, weights) {
    var sorted = sortWeights(weights);
    var total = weightsTotal(sorted);
    return drawIndices(roundSeed, clientSeed, nonce, total, 1).then(function (idx) {
      return { winner: ticketOwner(sorted, idx[0]), ticket: idx[0], weights: sorted };
    });
  }

  /**
   * Recomputes a live round. `round` = { roundSeed, serverHash, clientSeed, nonce, poolHash (the weights hash),
   * weights, winners[] }. Resolves { hashOk, poolOk, winnersOk, ok, derived }.
   */
  function verifyWeighted(round) {
    var sorted = sortWeights(round.weights || []);
    return Promise.all([sha256Hex(round.roundSeed), weightsHash(sorted), drawWeighted(round.roundSeed, round.clientSeed, round.nonce, sorted)])
      .then(function (r) {
        var hashOk = r[0] === round.serverHash;
        var poolOk = r[1] === round.poolHash;
        var winnersOk = round.winners.length === 1 && round.winners[0] === r[2].winner;
        return { hashOk: hashOk, poolOk: poolOk, winnersOk: winnersOk, ok: hashOk && poolOk && winnersOk, derived: [r[2].winner], weighted: true };
      });
  }

  /** Fresh round seed with its public hash. */
  function newCommit() {
    var seed = randomHex(32);
    return sha256Hex(seed).then(function (hash) { return { roundSeed: seed, serverHash: hash }; });
  }


  /** A standalone copy of the draw, shown on the Fair Play page so anyone can run it in a browser console. */
  var SNIPPET = [
    'async function draw(roundSeed, clientSeed, nonce, ids, count) {',
    '  const enc = new TextEncoder();',
    "  const key = await crypto.subtle.importKey('raw', enc.encode(roundSeed), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);",
    '  let block = 0, words = [], used = 0;',
    '  async function next() {',
    '    if (used >= words.length) {',
    "      const b = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(clientSeed + ':' + nonce + ':' + block++)));",
    '      words = [];',
    '      for (let i = 0; i + 3 < b.length; i += 4) words.push(((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0);',
    '      used = 0;',
    '    }',
    '    return words[used++];',
    '  }',
    '  const sorted = [...ids].sort(), out = [];',
    '  const limit = 2 ** 32 - (2 ** 32 % sorted.length);',
    '  while (out.length < count) { const w = await next(); if (w < limit) out.push(sorted[w % sorted.length]); }',
    '  return out;',
    '}'
  ].join('\n');

  return {
    SNIPPET: SNIPPET, available: available, randomHex: randomHex, sha256Hex: sha256Hex, hmacBytes: hmacBytes, stream: stream,
    drawIndices: drawIndices, sortedIds: sortedIds, poolHash: poolHash, verify: verify, newCommit: newCommit,
    sortWeights: sortWeights, weightsTotal: weightsTotal, ticketOwner: ticketOwner, weightsHash: weightsHash, drawWeighted: drawWeighted, verifyWeighted: verifyWeighted
  };
});
