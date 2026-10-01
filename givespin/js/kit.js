/*
 * Shared game toolkit: the pieces several games need so they behave the same way.
 *
 *  - boardWith / sizeNow: which charities are on a board of a chosen size (always includes the winner)
 *  - Race: the choreography for any race (derby, ducks, marbles, balloons): who crosses first, with lead changes
 *  - pickWeighted: a weighted random pick (used for decoys on stake-weighted live tables)
 *
 * A "field" is the list of charities a game shows. Solo, it is a random sample of the pool; on a live table it is
 * every charity that has money behind it, each with a number of tickets (one per dollar staked).
 */
(function () {
  'use strict';
  var GS = (window.GS = window.GS || {});
  var core = GS.core;

  var kit = {
    /** How many charities a board of `size` can show given the pool (never fewer than 2). */
    sizeNow: function (size, pool) { return Math.max(2, Math.min(size, pool.length)); },

    /** `n` distinct charities from the pool, guaranteed to include `winner`, in random order. */
    boardWith: function (pool, winner, n) { return core.subsetWith(pool, winner, Math.max(2, Math.min(n, pool.length))); },

    /** A random sample of `n` distinct charities. */
    sample: function (pool, n) { return core.sampleSubset(pool, Math.max(2, Math.min(n, pool.length))); },

    /** Weighted pick: index of an item given an array of non-negative weights. */
    pickWeighted: function (weights) {
      var total = weights.reduce(function (s, w) { return s + w; }, 0);
      if (total <= 0) { return core.randomInt(weights.length); }
      var r = core.randomFloat() * total;
      for (var i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r < 0) { return i; }
      }
      return weights.length - 1;
    },

    /** Turns [{ch, t}] entrants into parallel arrays. */
    split: function (entrants) {
      return { items: entrants.map(function (e) { return e.charity; }), tickets: entrants.map(function (e) { return e.tickets; }) };
    },

    /** Shortens `text` with an ellipsis until it fits `maxW` in the context's current font. */
    fit: function (ctx, text, maxW) {
      var t = text;
      while (t.length > 2 && ctx.measureText(t).width > maxW) { t = t.slice(0, -2).replace(/\s+$/, '') + '…'; }
      return t;
    },

    /** "1st", "2nd", "3rd", "4th"... */
    ordinal: function (n) {
      var s = ['th', 'st', 'nd', 'rd'];
      var v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    },

    /**
     * A race. `count` runners, runner `winnerIdx` must cross first. Every runner gets a finishing time (the winner
     * takes `baseSeconds`, the rest a little longer) and a pace curve exponent, so the order changes along the way
     * but everyone arrives in the planned order. `step(elapsedSeconds)` advances the positions.
     */
    Race: function (count, winnerIdx, baseSeconds) {
      var self = this;
      self.runs = [];
      self.finished = 0;
      var spread = count > 24 ? 0.45 : 0.28;
      for (var i = 0; i < count; i++) {
        var win = i === winnerIdx;
        self.runs.push({
          p: 0, place: 0, phase: Math.random(),
          tf: win ? baseSeconds : baseSeconds * core.randomRange(1.03, 1.03 + spread),
          e: win ? core.randomRange(0.9, 1.12) : core.randomRange(0.72, 1.32)
        });
      }
      /** Advances to `t` seconds. Returns true when every runner has finished. */
      self.step = function (t, onPlace) {
        var allDone = true;
        var arrived = [];
        self.runs.forEach(function (r) {
          var u = t / r.tf;
          if (u >= 1) {
            r.p = 1;
            if (!r.place) { arrived.push(r); }
          } else {
            var wob = 0.014 * Math.sin(t * 7 + r.phase * 6) * (1 - u);
            r.p = core.clamp(Math.pow(Math.max(0, u), r.e) + wob, 0, 0.995);
            allDone = false;
          }
        });
        // anyone crossing on the same frame (a throttled tab can batch several) is placed by planned finishing time
        arrived.sort(function (a, b) { return a.tf - b.tf; }).forEach(function (r) {
          self.finished += 1;
          r.place = self.finished;
          if (onPlace) { onPlace(r); }
        });
        return allDone;
      };
    }
  };

  GS.kit = kit;
})();
