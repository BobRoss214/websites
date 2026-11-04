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

  /** A whole number with thousands separators, for the words around a board ("1,042"). */
  function fmt(n) { var x = Number(n); return isFinite(x) ? x.toLocaleString('en-US') : ''; }

  var kit = {
    /** How many spots a board of `size` has (never fewer than 2). It can be more than the charities in play: they repeat. */
    sizeNow: function (size) { return Math.max(2, Math.floor(size)); },

    /** `n` board spots from the charities on the board, guaranteed to include `winner`, in random order. */
    boardWith: function (pool, winner, n) { return core.slotsWith(pool, winner, Math.max(2, n)); },

    /** `n` board spots from the charities on the board (a random subset, or repeats when there are more spots than charities). */
    sample: function (pool, n) { return core.fillSlots(pool, Math.max(2, n)); },

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

    /** A live charity's share of the pot as text, or nothing for a catalog charity that only fills a spot on the board (0 tickets). */
    share: function (tickets, total) { return tickets > 0 ? core.fmtShare(tickets, total) : ''; },

    /**
     * How wide each live entrant looks on a board that is sized by stake (wheel slices, strip cards). Charities somebody
     * backed keep their stake; the catalog charities that fill the rest of the board get a thin equal sliver (about a third
     * of the board between them, never wider than the smallest stake) so they are visible but clearly not the favourites.
     */
    liveWeights: function (entrants) {
      var sum = 0, min = Infinity, fillers = 0;
      entrants.forEach(function (e) { if (e.tickets > 0) { sum += e.tickets; if (e.tickets < min) { min = e.tickets; } } else { fillers += 1; } });
      if (!fillers) { return entrants.map(function (e) { return e.tickets; }); }
      var floor = Math.min(min === Infinity ? 1 : min, (sum || 1) * 0.35 / fillers);
      return entrants.map(function (e) { return e.tickets > 0 ? e.tickets : floor; });
    },

    /** True when a live board has catalog charities filling spots (not just the charities that were backed). */
    hasFillers: function (entrants) { return !!entrants && entrants.some(function (e) { return !(e.tickets > 0); }); },

    /** The smallest round badge (px across) that gets a charity's mark drawn in it. Anything smaller stays colour only (or initials, where a game drew those). */
    MARK_MIN: 14,

    /**
     * Draws a charity's mark (GS.markImage: its real logo, or its illustrated emblem) as a round badge centred on (x, y) with radius `r`:
     * a white disc, the picture fitted inside it, and a ring in the charity's colour. Returns true when it drew the badge. It returns false and
     * draws nothing while the picture is still loading, when there is none, or when the badge would be under MARK_MIN px across; the caller then
     * draws what it drew before (the initials, or just the colour). `opts`: ring (false for no ring, or a colour for the ring; the charity's colour by default), pad (share of the disc kept free, 0.22), min (px).
     */
    drawMark: function (ctx, ch, x, y, r, opts) {
      opts = opts || {};
      if (!(r * 2 >= (opts.min || kit.MARK_MIN)) || !GS.markImage) { return false; }
      var img = GS.markImage(ch);
      if (!img) { return false; }
      var iw = img.naturalWidth || img.width || 0;
      var ih = img.naturalHeight || img.height || 0;
      if (!(iw > 0 && ih > 0)) {
        if (img.complete === false) { return false; }
        iw = ih = 1;                       // a picture with no size of its own (some SVG files) is drawn as a square
      }
      var box = 2 * r * (1 - (opts.pad === undefined ? 0.22 : opts.pad));
      var k = Math.min(box / iw, box / ih);
      ctx.save();
      try {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.clip();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';       // (a 96 px logo squeezed into 15 px is smoother, and does not shimmer as the badge moves)
        ctx.drawImage(img, x - iw * k / 2, y - ih * k / 2, iw * k, ih * k);
      } catch (e) {
        ctx.restore();                     // a picture the browser cannot draw: the caller falls back to the initials
        return false;
      }
      ctx.restore();
      if (opts.ring !== false) {
        var lw = Math.max(1, r * 0.12);
        ctx.beginPath();
        ctx.arc(x, y, r - lw / 2, 0, Math.PI * 2);
        ctx.lineWidth = lw;
        ctx.strokeStyle = typeof opts.ring === 'string' ? opts.ring : ch.accent;
        ctx.stroke();
      }
      return true;
    },

    /**
     * Where a click or tap landed on a canvas, in the canvas's own drawing units (what the game drew in), or null when it is outside the canvas.
     * `w` and `h` are the units the game draws in (the canvas's CSS size, before any scaling for pixel density).
     */
    canvasPoint: function (canvas, w, h, clientX, clientY) {
      if (!canvas || !(w > 0) || !(h > 0)) { return null; }
      var rc = canvas.getBoundingClientRect();
      if (!rc.width || !rc.height) { return null; }
      var x = (clientX - rc.left) * w / rc.width;
      var y = (clientY - rc.top) * h / rc.height;
      return x < 0 || y < 0 || x > w || y > h ? null : { x: x, y: y };
    },

    /**
     * How far (point x, y) is into one clickable spot: below 1 when it is on it (0 at the centre), Infinity when it is not. A spot is an ellipse
     * { x, y, rx, ry } (centre and radii) or a rectangle { x0, y0, x1, y1 } (every point on it scores just under 1, so a round mark on top of a
     * label wins where they meet).
     */
    spotScore: function (sp, x, y) {
      if (sp.x0 !== undefined) { return x >= sp.x0 && x <= sp.x1 && y >= sp.y0 && y <= sp.y1 ? 0.99 : Infinity; }
      var dx = (x - sp.x) / sp.rx;
      var dy = (y - sp.y) / sp.ry;
      var d = Math.sqrt(dx * dx + dy * dy);
      return d <= 1 ? d : Infinity;
    },

    /** The one of `spots` that (x, y) is on, or null: the one on top first (higher `z`), then the nearest centre. A spot carries whatever else the caller put on it (an id, say). */
    pickSpot: function (spots, x, y) {
      var best = null, bz = -Infinity, bd = Infinity;
      for (var i = 0; i < spots.length; i++) {
        var d = kit.spotScore(spots[i], x, y);
        if (d === Infinity) { continue; }
        var z = spots[i].z || 0;
        if (z > bz || (z === bz && d < bd)) { best = spots[i]; bz = z; bd = d; }
      }
      return best;
    },

    /** Shortens `text` with an ellipsis until it fits `maxW` in the context's current font. */
    fit: function (ctx, text, maxW) {
      var t = text;
      while (t.length > 2 && ctx.measureText(t).width > maxW) { t = t.slice(0, -2).replace(/\s+$/, '') + '…'; }
      return t;
    },

    /**
     * The one-line note under a board: how many charities are on it, that each has equal odds, and what the spots are.
     * `pool` is the charities on the board, `slots` the spots, `pickId` the charity you backed (or ''), `where` e.g. "on the wheel".
     */
    boardNote: function (pool, slots, pickId, where) {
      var d = pool.length;
      if (!d) { return ''; }
      var s = fmt(d) + (d === 1 ? ' charity is ' : ' charities are ') + where + '. Every one has equal odds.';
      if (slots > d) { s += ' The ' + fmt(slots) + ' spots repeat them (' + kit.repeatsText(slots, d) + '), so odds are per charity, not per spot.'; }
      var pick = pickId ? GS.charity(pickId) : null;
      if (pick) { s += ' You backed ' + pick.short + '.'; }
      return s;
    },

    /** "each appearing 4 times" / "each appearing 1 or 2 times": how often `d` charities repeat across `slots` spots. */
    repeatsText: function (slots, d) {
      if (!d) { return ''; }
      var lo = Math.floor(slots / d);
      var hi = Math.ceil(slots / d);
      return 'each appearing ' + (lo === hi ? fmt(lo) + (lo === 1 ? ' time' : ' times') : fmt(lo) + ' or ' + fmt(hi) + ' times');
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
