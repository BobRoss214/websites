/*
 * Weekly rhythms: week keys, the charity of the week and the list of past spotlights (pure logic, unit-tested in Node).
 *
 * The charity of the week is a pure function of the week key (core.weekKey, ISO weeks, Monday to Sunday, local time): the whole roster is
 * put in one seeded order (core.seededShuffle over the sorted ids) and walked through one week at a time, so a charity does not come
 * back until every other one has had its turn, everyone sees the same charity, and the list of past spotlights is worked out backwards
 * from the same function: nothing is stored anywhere.
 *
 * The two sentences that explain a charity are built only from what the roster says about it (its own short description, its causes,
 * who it helps, where it works and how), so nothing is invented. A description that is not safe to repeat (it makes a claim such as
 * "leading" or "largest", names a number or has more than one sentence) is left out and the sentence is built from the facts instead.
 */
(function (root, factory) {
  'use strict';
  var mod = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = mod; }
  if (typeof window !== 'undefined') { window.GS = window.GS || {}; window.GS.weekly = mod; }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';

  var core = (root.GS && root.GS.core) || (typeof require === 'function' ? require('./core.js') : null);

  var DAY = 86400000;
  var WEEK = 7 * DAY;
  var EPOCH = Date.UTC(2024, 0, 1);          // a Monday: week number 0 (every later week is one more)
  var SEED = 'spotlight:v1';
  var SPOTLIGHT_XP = 25;                     // XP (never money) for backing the charity of the week, once per round

  /* ----------------------------------------------------------------- weeks */

  /** "2026-W44" -> { year, week }, or null. */
  function parseKey(key) {
    var m = /^(\d{4})-W(\d{2})$/.exec(String(key));
    return m ? { year: Number(m[1]), week: Number(m[2]) } : null;
  }

  /** The number of the week from the first Monday of 2024 (2024-W01 is 0), worked out from the key alone. NaN for a key that is not one. */
  function weekIndex(key) {
    var p = parseKey(key);
    if (!p || p.week < 1 || p.week > 53) { return NaN; }
    var jan4 = Date.UTC(p.year, 0, 4);                   // week 1 is the week with January 4th in it
    var dow = new Date(jan4).getUTCDay() || 7;
    var monday1 = jan4 - (dow - 1) * DAY;
    return Math.round((monday1 + (p.week - 1) * WEEK - EPOCH) / WEEK);
  }

  /** The key of week number `i` (the exact reverse of weekIndex), by asking core.weekKey about that week's Monday. */
  function keyForIndex(i) { return core.weekKey(new Date(2024, 0, 1 + 7 * i, 12)); }

  /** The first day (Monday, local midnight) and the last day (Sunday) of week number `i`. */
  function weekDays(i) { return { start: new Date(2024, 0, 1 + 7 * i), end: new Date(2024, 0, 1 + 7 * i + 6) }; }

  /** Days until the next Monday, when the next charity takes over: 7 on a Monday, 1 on a Sunday. */
  function daysLeft(date) { return 7 - (((date || new Date()).getDay() + 6) % 7); }

  /* ----------------------------------------------------------- the rotation */

  /** The roster's ids in the one seeded order the weeks walk through (the same for the same set of ids, whatever order they come in). */
  function order(ids) { return core.seededShuffle(ids.slice().sort(), SEED); }

  function pickAt(ord, index) {
    var n = ord.length;
    return n ? ord[((index % n) + n) % n] : null;
  }

  /** The id of the charity of the week for a week key, from the ids of the roster. */
  function spotlightId(ids, key) {
    var i = weekIndex(key);
    return isNaN(i) ? null : pickAt(order(ids), i);
  }

  /** The spotlight of the week `date` falls in: { week, index, id, charity }. */
  function current(charities, date) {
    var key = core.weekKey(date || new Date());
    var index = weekIndex(key);
    var id = pickAt(order(charities.map(function (c) { return c.id; })), index);
    var charity = null;
    charities.forEach(function (c) { if (c.id === id) { charity = c; } });
    return { week: key, index: index, id: id, charity: charity };
  }

  /** The `count` weeks before the one `date` is in, most recent first: [{ week, index, id, charity, start, end }]. Recomputed, never stored. */
  function past(charities, date, count) {
    var now = current(charities, date);
    var ord = order(charities.map(function (c) { return c.id; }));
    var byId = {};
    charities.forEach(function (c) { byId[c.id] = c; });
    var out = [];
    for (var k = 1; k <= count; k++) {
      var i = now.index - k;
      var id = pickAt(ord, i);
      var d = weekDays(i);
      out.push({ week: keyForIndex(i), index: i, id: id, charity: byId[id] || null, start: d.start, end: d.end });
    }
    return out;
  }

  /* ------------------------------------------------------------------ XP */

  /**
   * The bonus XP of one round that had a charity backed: `pick` is { id, won, wins, board } (or null), `spotId` the charity of the week.
   * `pick` is the bonus for backing a winner (it grows with the length of the shot, see core.pickBonusXp) and `spotlight` a flat bonus for
   * backing the charity of the week, win or lose, once per round however many rounds a split gift is cut into. They add up.
   */
  function roundBonus(pick, spotId) {
    var p = pick && pick.won ? core.pickBonusXp(pick.board, pick.wins) : 0;
    var s = pick && spotId && pick.id === spotId ? SPOTLIGHT_XP : 0;
    return { pick: p, spotlight: s, total: p + s };
  }

  /* ---------------------------------------------------- the two sentences */

  // Plain words for the roster's own vocabulary (js/data.js facets); a test checks that every id there has one.
  var SERVES = {
    children: 'children', teens: 'teens and young adults', students: 'students and teachers', women: 'women and girls', families: 'families',
    seniors: 'older adults', veterans: 'veterans and military families', disability: 'people with disabilities', refugees: 'refugees and immigrants',
    homeless: 'people experiencing homelessness', patients: 'patients'
  };
  var HOW = {
    direct: 'direct help', research: 'research', advocacy: 'advocacy', training: 'training', funding: 'funding for other groups', protection: 'protection work'
  };
  var HOME = { us: 'the United States', uk: 'the United Kingdom', australia: 'Australia' };
  var FOCUS = { africa: 'Africa', asia: 'Asia', latam: 'Latin America', mideast: 'the Middle East', oceania: 'the Pacific' };

  // A short description that makes a claim, names a number or an amount, or is not one sentence is not repeated; the sentence is built from facts instead.
  var CLAIMS = /\b(best|better|most|least|largest|biggest|greatest|highest|top|leading|leader|leaders|leads?|only|first|premier|finest|foremost|world-class|pioneer|pioneers|pioneering|major|unique|ultimate|number one|trusted|famous|renowned|famed|cost-effective|guarantee[ds]?|miracle|every|always|never|free)\b/i;
  var ABBREV = /\b(St|Dr|Mr|Mrs|Ms|Inc|Ltd|Co|Mt|No|vs)\.|\b(?:[A-Z]\.){2,}/g;

  function safeBlurb(text) {
    var t = String(text || '').trim();
    if (!t || !/[.]$/.test(t) || /[!?]/.test(t) || /[0-9$%#]/.test(t) || CLAIMS.test(t)) { return false; }
    // one sentence only: no full stop followed by another sentence (the abbreviations "U.S.", "D.C." and "St." do not count)
    var inner = t.slice(0, -1).replace(ABBREV, '');
    return !/[.]\s+[A-Z]/.test(inner);
  }

  function joinList(items) {
    var n = items.length;
    if (n <= 1) { return items[0] || ''; }
    var inner = items.some(function (x) { return / (and|&) /.test(x); });   // "teens and young adults" inside a list needs the comma before the last "and"
    if (n === 2) { return items[0] + (inner ? ', and ' : ' and ') + items[1]; }
    return items.slice(0, -1).join(', ') + (inner ? ', and ' : ' and ') + items[n - 1];
  }

  function placeText(where) {
    var home = Object.keys(HOME).filter(function (k) { return where.indexOf(k) >= 0; }).map(function (k) { return HOME[k]; });
    var focus = Object.keys(FOCUS).filter(function (k) { return where.indexOf(k) >= 0; }).map(function (k) { return FOCUS[k]; }).slice(0, 3);
    var world = where.indexOf('global') >= 0;
    var s = '';
    if (home.length) { s = 'in ' + joinList(home) + (world ? ' and worldwide' : ''); }
    else if (world) { s = 'worldwide'; }
    if (focus.length) { s = s ? s + ', with a focus on ' + joinList(focus) : 'in ' + joinList(focus); }
    return s;
  }

  /**
   * The two sentences about a charity, only from its roster entry: { sentences: [first, second], text, from: 'description' | 'facts' }.
   * `lookup` gives the names of causes (GS.cause); it defaults to the page's own GS.
   * The first says what the charity does (its own short description, or its causes when that description is not safe to repeat), the second
   * who it helps, where and how, and that a gift supports that work. It names no amount and compares the charity with no other.
   */
  function explain(ch, lookup) {
    lookup = lookup || root.GS || {};
    var name = /\.$/.test(ch.short) ? ch.name : ch.short;
    var causes = (ch.causes || []).slice(0, 2).map(function (id) {
      var c = lookup.cause ? lookup.cause(id) : null;
      return (c ? c.name : String(id)).toLowerCase();
    });
    var first;
    var from = 'description';
    if (safeBlurb(ch.blurb)) { first = ch.blurb.trim(); }
    else { from = 'facts'; first = name + ' is a ' + (ch.faith ? 'faith-based ' : '') + 'charity working on ' + (joinList(causes) || 'giving') + '.'; }
    var serves = (ch.serves || []).filter(function (k) { return SERVES[k]; }).slice(0, 3).map(function (k) { return SERVES[k]; });
    var hows = (ch.how || []).filter(function (k) { return HOW[k]; }).slice(0, 3).map(function (k) { return HOW[k]; });
    var where = placeText(ch.where || []);
    var second = 'A gift to ' + name + ' supports its work' + (serves.length ? ' helping ' + joinList(serves) : '') + (where ? ' ' + where : '') +
      (hows.length ? ', through ' + joinList(hows) : '') + '.';
    return { sentences: [first, second], text: first + ' ' + second, from: from };
  }

  return {
    SPOTLIGHT_XP: SPOTLIGHT_XP, EPOCH: EPOCH,
    SERVES: SERVES, HOW: HOW, HOME: HOME, FOCUS: FOCUS, CLAIMS: CLAIMS,
    weekIndex: weekIndex, keyForIndex: keyForIndex, weekDays: weekDays, daysLeft: daysLeft,
    order: order, spotlightId: spotlightId, current: current, past: past,
    roundBonus: roundBonus, explain: explain, safeBlurb: safeBlurb
  };
});
