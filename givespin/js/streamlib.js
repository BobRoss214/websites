/*
 * Stream Mode's pure logic (unit-tested in Node): the simulated chat vote, the keyboard shortcuts and the overlay link.
 *
 * The chat is SIMULATED: "viewers" here are counts made by a seeded random generator, never real people and never named. A vote is a
 * plan (a list of timed votes made once from a seed), so the tally at any moment is a pure function of the time that has passed:
 * the same seed always gives the same votes at the same moments, which is what lets the tests pin it down. The bar is drawn from the
 * counts by `shares`, which both a solo game's vote and a live table's own simulated chat (js/live.js keeps its own counts) use, so
 * there is one way to turn counts into percentages and into a leader.
 *
 * Nothing here touches the page, the clock or storage.
 */
(function (root, factory) {
  'use strict';
  var mod = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = mod; }
  if (typeof window !== 'undefined') { window.GS = window.GS || {}; window.GS.streamlib = mod; }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';

  var core = (root.GS && root.GS.core) || (typeof require === 'function' ? require('./core.js') : null);

  var VOTE_MS = 20000;          // how long the chat votes before it decides (real time; ?fast=1 squeezes it like every other timer)
  var CANDIDATES = 4;           // charities on the vote bar
  var TICKS = 24;               // moments at which a few simulated viewers vote
  var MAX_PER_TICK = 6;

  /* ------------------------------------------------------------------ the vote */

  /** `n` charity ids from `ids`, picked by the seed alone (the same seed and list always give the same ones, whatever order the list came in). */
  function pickCandidates(ids, seed, n) {
    var uniq = [];
    (ids || []).forEach(function (id) { if (uniq.indexOf(id) < 0) { uniq.push(id); } });
    uniq.sort();
    var out = core.seededShuffle(uniq, 'stream-slate:' + seed);
    return out.slice(0, Math.max(0, Math.min(n === undefined ? CANDIDATES : n, out.length)));
  }

  /**
   * The whole vote, made once: `{ seed, ids, durationMs, events: [{ at, id, n }] }` (`n` simulated viewers vote for `id` at `at` ms).
   * Some charities are much more popular with the chat than others, so the bar has a leader, but every charity can get votes.
   */
  function plan(opts) {
    opts = opts || {};
    var ids = (opts.ids || []).slice();
    var duration = opts.durationMs > 0 ? opts.durationMs : VOTE_MS;
    var ticks = opts.ticks > 0 ? Math.floor(opts.ticks) : TICKS;
    var rng = core.seeded('stream-vote:' + opts.seed);
    var weights = ids.map(function () { var r = rng(); return 0.12 + r * r; });
    var sum = weights.reduce(function (a, b) { return a + b; }, 0);
    var events = [];
    for (var k = 0; k < ticks && ids.length; k++) {
      var at = Math.round(((k + 1) / (ticks + 1)) * duration);
      var x = rng() * sum;
      var i = 0;
      while (i < ids.length - 1 && x >= weights[i]) { x -= weights[i]; i++; }
      events.push({ at: at, id: ids[i], n: 1 + Math.floor(rng() * MAX_PER_TICK) });
    }
    return { seed: String(opts.seed), ids: ids, durationMs: duration, events: events };
  }

  /** The votes counted so far, `{ id: n }`, after `elapsedMs` of the vote (every candidate is in it, with 0 if it has none yet). */
  function votesAt(p, elapsedMs) {
    var counts = {};
    p.ids.forEach(function (id) { counts[id] = 0; });
    p.events.forEach(function (e) { if (e.at <= elapsedMs) { counts[e.id] += e.n; } });
    return counts;
  }

  function total(counts) {
    return Object.keys(counts || {}).reduce(function (a, k) { return a + (counts[k] || 0); }, 0);
  }

  /**
   * Rows for the bar: every charity of `ids` with its votes and a whole-number share, biggest first (a tie keeps the order of `ids`).
   * The shares always add up to exactly 100 once there is a vote (largest remainder), and are all 0 before the first one.
   */
  function shares(counts, ids) {
    counts = counts || {};
    var list = (ids || Object.keys(counts)).map(function (id, pos) { return { id: id, n: counts[id] || 0, pos: pos, pct: 0, frac: 0 }; });
    var t = list.reduce(function (a, r) { return a + r.n; }, 0);
    if (t > 0) {
      var used = 0;
      list.forEach(function (r) { var exact = (r.n / t) * 100; r.pct = Math.floor(exact); r.frac = exact - r.pct; used += r.pct; });
      var byFrac = list.slice().sort(function (a, b) { return b.frac - a.frac || b.n - a.n || a.pos - b.pos; });
      for (var i = 0; i < 100 - used; i++) { byFrac[i % byFrac.length].pct += 1; }
    }
    list.sort(function (a, b) { return b.n - a.n || a.pos - b.pos; });
    return list.map(function (r) { return { id: r.id, n: r.n, pct: r.pct }; });
  }

  /** The charity in front, or '' while nobody has voted. A tie goes to the one listed first in `ids`. */
  function leader(counts, ids) {
    var rows = shares(counts, ids);
    return rows.length && rows[0].n > 0 ? rows[0].id : '';
  }

  /** The seconds left, rounded up, for the clock ("12 s"); never below 0. */
  function secondsLeft(msLeft) { return Math.max(0, Math.ceil((msLeft || 0) / 1000)); }

  /* --------------------------------------------------------------- the link */

  /** A route that is safe to put in the link: a game, a live table, a table page or the lobby. Anything else becomes `fallback`. */
  function safeRoute(route, fallback) {
    var r = String(route || '').replace(/^#/, '');
    return /^(game|live|tables)-[a-z0-9]+$/.test(r) || r === 'lobby' ? r : (fallback || 'game-wheel');
  }

  /**
   * The address for an OBS-style browser source: `<origin><path>?stream=1&overlay=1#<route>`. `loc` is `{ protocol, host, pathname }`
   * (what `window.location` has). It names the page, the two switches and the game, and nothing else: no name, no balance, no other query.
   */
  function overlayUrl(loc, route) {
    loc = loc || {};
    var path = String(loc.pathname || '/').split(/[?#]/)[0] || '/';
    return String(loc.protocol || 'https:') + '//' + String(loc.host || '') + path + '?stream=1&overlay=1#' + safeRoute(route);
  }

  /* ------------------------------------------------------------- shortcuts */

  var NOT_TYPING = ['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image'];

  /** Is this a field where letters and digits belong to the person typing? `t` is `{ tag, type, editable, role }`. */
  function isTyping(t) {
    if (!t) { return false; }
    var tag = String(t.tag || '').toUpperCase();
    if (tag === 'TEXTAREA' || tag === 'SELECT') { return true; }
    if (tag === 'INPUT') { return NOT_TYPING.indexOf(String(t.type || 'text').toLowerCase()) < 0; }
    if (t.editable) { return true; }
    var role = String(t.role || '').toLowerCase();
    return role === 'textbox' || role === 'combobox' || role === 'searchbox' || role === 'spinbutton';
  }

  /** True when nothing in particular has the keyboard (the page, or the main area the app focuses after a move). */
  function isIdle(t) {
    if (!t) { return true; }
    var tag = String(t.tag || '').toUpperCase();
    return tag === 'BODY' || tag === 'HTML' || tag === 'MAIN' || t.id === 'main';
  }

  /**
   * What a key press means in Stream Mode: `{ action: 'play' | 'amount' | 'chat' | 'compact' | 'exit' | 'help' | 'close-help', n? }` or null.
   *  ev:  { key, ctrlKey, metaKey, altKey, repeat, target: { tag, type, editable, role, id } }
   *  ctx: { stream, dialogOpen, busy, helpOpen }
   * Never while typing in a field, never with Ctrl, Alt or Meta held (those are the browser's), never while a dialog is open or Stream Mode is off.
   * Space and Enter play only when nothing else has the keyboard: on a focused button they keep doing what a button does.
   */
  function keyAction(ev, ctx) {
    ctx = ctx || {};
    if (!ev || !ctx.stream || ctx.dialogOpen) { return null; }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) { return null; }
    if (isTyping(ev.target)) { return null; }
    var k = ev.key;
    if (k === 'Escape') {
      if (ctx.helpOpen) { return { action: 'close-help' }; }
      return ctx.busy ? null : { action: 'exit' };
    }
    if (ev.repeat) { return null; }
    if (k === ' ' || k === 'Spacebar' || k === 'Enter') { return isIdle(ev.target) && !ctx.busy ? { action: 'play' } : null; }
    if (typeof k === 'string' && /^[1-5]$/.test(k)) { return ctx.busy ? null : { action: 'amount', n: Number(k) }; }
    if (k === 'c' || k === 'C') { return { action: 'chat' }; }
    if (k === 'o' || k === 'O') { return { action: 'compact' }; }
    if (k === '?') { return { action: 'help' }; }
    return null;
  }

  /** The keys the "?" panel and Help list: one source for both, and for the tests. */
  var SHORTCUTS = [
    { keys: ['Space', 'Enter'], what: 'Play (or put up your stake at a live table)' },
    { keys: ['1', '2', '3', '4', '5'], what: 'Pick the amount buttons, left to right' },
    { keys: ['C'], what: 'Show or hide the simulated chat vote' },
    { keys: ['O'], what: 'Compact view: hide the controls and the toolbar' },
    { keys: ['?'], what: 'This list' },
    { keys: ['Esc'], what: 'Leave Stream Mode' }
  ];

  /** A short id for the round from its sealed fingerprint (the public hash shown before the round, never the secret), or "R<n>" without one. */
  function roundId(hash, n) {
    var h = String(hash || '').replace(/[^0-9a-fA-F]/g, '');
    return h.length >= 8 ? h.slice(0, 8).toUpperCase() : 'R' + (Number(n) > 0 ? Math.floor(Number(n)) : 1);
  }

  return {
    VOTE_MS: VOTE_MS, CANDIDATES: CANDIDATES, TICKS: TICKS, SHORTCUTS: SHORTCUTS,
    pickCandidates: pickCandidates, plan: plan, votesAt: votesAt, total: total, shares: shares, leader: leader, secondsLeft: secondsLeft,
    safeRoute: safeRoute, overlayUrl: overlayUrl, isTyping: isTyping, isIdle: isIdle, keyAction: keyAction, roundId: roundId
  };
});
