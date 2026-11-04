/*
 * Profile logic (pure, no DOM, unit-tested in Node): the display name rules and a small block-list of rude words, the favourite causes and charities
 * worked out from the saved history, the frames and titles a visitor can pick (with the rule that unlocks each), and the made-up details of a bot.
 *
 *   GS.profile.validateName(text)     { ok, value, reason, message }: 1 to 20 characters, letters, numbers, spaces and simple punctuation, no links, no < >, no rude words
 *   GS.profile.sanitize(raw)          what is kept under GS.local 'profile': { name, frame, title } (anything odd becomes '' / 'plain' / '')
 *   GS.profile.displayName(p, acct)   the chosen name, else the signed-in account's name, else ''
 *   GS.profile.favourites(history, o) { charities: [{ id, count, cents, last }], causes: [...] }, the top three of each, from the rounds in the history
 *   GS.profile.recentRounds(h, n, ok) the newest n rounds that can be shown
 *   GS.profile.facts(save)            the numbers the unlock rules read (rank, streak, totals, badges, cards, sets), safe for any save
 *   GS.profileFrames, GS.profileTitles   registries of the emblem frames and the profile titles; .add(def) lets a later feature register more
 *   GS.profile.botDetails(name, o)    a made-up but steady profile for a simulated player, from the name alone
 *
 * The name, frame and title live under GS.local ('profile'), never in the main save. They are only ever shown on this device and on the cards the visitor shares.
 */
(function (root, factory) {
  'use strict';
  var core = (typeof module === 'object' && module.exports && typeof require === 'function') ? require('./core.js') : ((root.GS && root.GS.core) || null);
  var mod = factory(root, core);
  if (typeof module === 'object' && module.exports) { module.exports = mod; }
  if (typeof window !== 'undefined') {
    window.GS = window.GS || {};
    window.GS.profile = mod;
    window.GS.profileFrames = mod.frames;
    window.GS.profileTitles = mod.titles;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root, core) {
  'use strict';

  /* ------------------------------------------------------------------ small helpers */

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  /** A whole number of 0 or more from anything (junk, strings, negatives and huge numbers included). */
  function whole(v) { var n = Math.floor(Number(v)); return isFinite(n) && n > 0 ? Math.min(n, 1e15) : 0; }
  function charsOf(s) { return typeof Array.from === 'function' ? Array.from(s) : s.split(''); }
  function truthyKeys(o) { return isObj(o) ? Object.keys(o).filter(function (k) { return !!o[k]; }) : []; }
  function dollars(n) { return '$' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  /* ------------------------------------------------------------------ the display name */

  var NAME_MAX = 20;
  var PUNCT = ".,'’!?-_&()~+*";

  // letters, marks and numbers from any language, spaces and the simple punctuation above (a browser without \p{L} falls back to Latin letters)
  var CHARS_OK;
  try { CHARS_OK = new RegExp('^[\\p{L}\\p{M}\\p{N} .,\'’!?\\-_&()~+*]+$', 'u'); }
  catch (e) { CHARS_OK = /^[A-Za-z0-9À-ɏ .,'’!?\-_&()~+*]+$/; }
  var HAS_WORD_CHAR;
  try { HAS_WORD_CHAR = new RegExp('[\\p{L}\\p{N}]', 'u'); } catch (e2) { HAS_WORD_CHAR = /[A-Za-z0-9À-ɏ]/; }
  var TOKEN_SPLIT;
  try { TOKEN_SPLIT = new RegExp('[^\\p{L}\\p{N}]+', 'u'); } catch (e3) { TOKEN_SPLIT = /[^A-Za-z0-9À-ɏ]+/; }

  var LINK_TLDS = 'com|net|org|io|co|uk|me|app|xyz|gg|ly|tv|info|biz|dev|link|site|online|shop|store|ru|cn|de|fr|us|ca|au|in|eu|to|cc|ws|click|top|gov|edu';
  var LINK_RE = new RegExp('(:\\/\\/|[\\/\\\\@]|\\bwww\\b|\\bhttps?\\b|\\.(' + LINK_TLDS + ')(\\b|$))', 'i');

  /**
   * Rude words, kept short on purpose. This is a polite filter for a name that is only shown on the visitor's own device and on cards they share, not a
   * guarantee. `BLOCK_PARTS` are blocked anywhere inside a word (long, and not part of an ordinary word); `BLOCK_WORDS` only when they are a whole word, so
   * that "Scunthorpe", "Assist", "Cassie", "Grape" or "Peacock" are fine. Letters are compared after lower-casing, dropping accents, undoing the usual
   * look-alike digits (sh1t) and a few look-alike Cyrillic and Greek letters, and spaced-out letters ("f u c k") are joined.
   */
  var BLOCK_PARTS = ['fuck', 'shithead', 'shitty', 'bullshit', 'bitch', 'asshole', 'bastard', 'dickhead', 'cocksucker', 'motherf', 'nigger', 'nigga', 'faggot', 'whore', 'hitler',
    'molest', 'paedophil', 'pedophil', 'porn', 'blowjob', 'handjob', 'jizz', 'vagina', 'dildo', 'bollock', 'wanker', 'pussy', 'tranny', 'kkk'];
  var BLOCK_WORDS = ['shit', 'shits', 'shite', 'ass', 'arse', 'cock', 'cocks', 'cum', 'tit', 'tits', 'boob', 'boobs', 'piss', 'pissed', 'penis', 'cunt', 'cunts', 'slut', 'sluts',
    'twat', 'wank', 'sex', 'rape', 'rapist', 'rapists', 'fag', 'fags', 'retard', 'retards', 'retarded', 'nazi', 'nazis', 'spic', 'chink', 'gook', 'kike', 'coon', 'paki', 'wog', 'pedo', 'paedo'];
  var LOOKALIKE = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i',
    'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'і': 'i', 'ѕ': 's', 'ο': 'o', 'α': 'a', 'ε': 'e', 'ι': 'i' };

  /** The text tidied: odd spaces, zero-width and direction-changing characters and control characters removed, runs of spaces made one, trimmed. */
  function cleanName(input) {
    if (typeof input === 'number' && isFinite(input)) { input = String(input); }
    if (typeof input !== 'string') { return ''; }
    var s = input;
    try { s = s.normalize('NFC'); } catch (e) { /* an old browser: leave it */ }
    s = s.replace(/[​-‏‪-‮⁠-⁤⁦-⁩]/g, '');   // zero-width, direction marks and overrides (they can hide or reorder text)
    s = s.replace(/\s+/g, ' ');
    s = s.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
    return s.trim();
  }

  /** A word reduced to plain lower-case letters for the block-list. */
  function skeleton(word) {
    var s = String(word).toLowerCase();
    try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) { /* leave the accents */ }
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = LOOKALIKE[s.charAt(i)] || s.charAt(i);
      if (c >= 'a' && c <= 'z') { out += c; }
    }
    return out;
  }

  /** Whether a (cleaned) name has a word on the block-list. */
  function isBlocked(name) {
    var tokens = String(name).split(TOKEN_SPLIT).filter(Boolean);
    var words = [];
    var run = '';
    tokens.forEach(function (t) {
      if (charsOf(t).length === 1) { run += t; return; }
      if (run.length > 1) { words.push(run); }
      run = '';
      words.push(t);
    });
    if (run.length > 1) { words.push(run); }   // "f u c k" or "f.u.c.k": single letters in a row are read as one word
    return words.some(function (w) {
      var sk = skeleton(w);
      if (!sk) { return false; }
      if (BLOCK_WORDS.indexOf(sk) >= 0) { return true; }
      return BLOCK_PARTS.some(function (p) { return sk.indexOf(p) >= 0; });
    });
  }

  /**
   * Checks a display name. Returns { ok, value (the tidied name), reason, message }. `reason` is '' when ok, else one of
   * 'empty', 'html', 'link', 'chars', 'long', 'blocked'. The messages are written for the visitor and never repeat a refused word.
   */
  function validateName(input) {
    var v = cleanName(input);
    function no(reason, message) { return { ok: false, value: v, reason: reason, message: message }; }
    if (!v) { return no('empty', 'Type a name, 1 to ' + NAME_MAX + ' characters.'); }
    if (/[<>]/.test(v)) { return no('html', 'Names cannot contain < or >.'); }
    if (LINK_RE.test(v)) { return no('link', 'Names cannot contain links or web addresses.'); }
    if (!CHARS_OK.test(v) || !HAS_WORD_CHAR.test(v)) { return no('chars', 'Use letters, numbers, spaces and simple punctuation (. , \' ! ? - _ & ( ) ~ + *), with at least one letter or number.'); }
    var n = charsOf(v).length;
    if (n > NAME_MAX) { return no('long', 'That is ' + n + ' characters. ' + NAME_MAX + ' is the limit.'); }
    if (isBlocked(v)) { return no('blocked', 'That name is not allowed here. Try a different one.'); }
    return { ok: true, value: v, reason: '', message: '' };
  }

  /* ------------------------------------------------------------------ what is kept, and the name that is shown */

  var ID_RE = /^[a-z0-9][a-z0-9-]{0,23}$/;
  var DEFAULT_FRAME = 'plain';

  /** What is kept under GS.local 'profile': { name, frame, title }. A name that fails the rules becomes '' and an odd id becomes the default, whatever was stored. */
  function sanitize(raw) {
    var r = isObj(raw) ? raw : {};
    var nm = typeof r.name === 'string' ? validateName(r.name) : null;
    return {
      name: nm && nm.ok ? nm.value : '',
      frame: typeof r.frame === 'string' && ID_RE.test(r.frame) ? r.frame : DEFAULT_FRAME,
      title: typeof r.title === 'string' && ID_RE.test(r.title) ? r.title : ''
    };
  }

  /** The chosen name, else the signed-in account's name, else ''. */
  function displayName(profile, account) {
    var p = sanitize(profile);
    if (p.name) { return p.name; }
    var a = isObj(account) ? account : {};
    return a.signedIn && typeof a.name === 'string' ? cleanName(a.name).slice(0, 40) : '';
  }

  /* ------------------------------------------------------------------ what the save says (for the unlock rules) */

  /**
   * The numbers the unlock rules read, from a saved game in any state (a missing, empty or odd save gives zeros):
   * { totalCents, rank, xp, plays, streak, bestStreak, badges (how many), badgeIds, cardsOwned, rarity: {common, rare, epic, legendary}, setsDone,
   *   charities (different charities given to), biggestCents, liveRounds, liveWins, verifies, directGifts, jackpots }
   */
  function facts(save) {
    var s = isObj(save) ? save : {};
    var total = whole(s.totalCents);
    var cards = isObj(s.cards) ? s.cards : {};
    var rarity = { common: 0, rare: 0, epic: 0, legendary: 0 };
    var owned = 0;
    Object.keys(cards).forEach(function (id) {
      if (!isObj(cards[id])) { return; }
      owned += 1;
      var r = cards[id].rarity;
      if (Object.prototype.hasOwnProperty.call(rarity, r)) { rarity[r] += 1; } else { rarity.common += 1; }
    });
    var badgeIds = truthyKeys(s.badges);
    var seen = {};
    if (isObj(s.charityCounts)) { Object.keys(s.charityCounts).forEach(function (id) { seen[id] = 1; }); }
    if (Array.isArray(s.history)) {
      s.history.forEach(function (h) {
        if (isObj(h) && Array.isArray(h.allocations)) { h.allocations.forEach(function (a) { if (isObj(a) && typeof a.charityId === 'string') { seen[a.charityId] = 1; } }); }
      });
    }
    var streak = whole(s.streak);
    return {
      totalCents: total, rank: core ? core.rankFor(total).rank : 0, xp: whole(s.xp), plays: whole(s.plays), streak: streak, bestStreak: Math.max(whole(s.bestStreak), streak),
      badges: badgeIds.length, badgeIds: badgeIds, cardsOwned: owned, rarity: rarity, setsDone: truthyKeys(s.setClaims).length,
      charities: Object.keys(seen).length, biggestCents: whole(s.biggestCents), liveRounds: whole(s.liveRounds), liveWins: whole(s.liveWins),
      verifies: whole(s.verifies), directGifts: whole(s.directGifts), jackpots: whole(s.jackpots)
    };
  }

  /* ------------------------------------------------------------------ frames and titles */

  /**
   * A registry of things a visitor can unlock and pick. Each entry is { id, name, description, how (a plain "how to unlock" line), unlocked(facts, save) }.
   * `unlocked` gets the numbers from facts() and the save itself, and answers true or false; an entry without it is always open. A later feature (quests,
   * the season track) adds its own with add(def), and a locked entry is always listed with its `how`, never hidden. A frame can also bring its own picture:
   * `art(px)` returns SVG text drawn around the emblem (otherwise the page's stylesheet draws the frame by its id).
   */
  function makeRegistry(fallback) {
    var items = [];
    var sealed = false;   // the entries added before seal() are the built-in ones
    var reg = {
      fallback: fallback,
      seal: function () { sealed = true; },
      list: function () { return items.slice(); },
      get: function (id) { for (var i = 0; i < items.length; i++) { if (items[i].id === id) { return items[i]; } } return null; },
      has: function (id) { return !!reg.get(id); },
      /** Adds an entry (or replaces one a feature added earlier). Returns true when it was added; a built-in cannot be replaced and a malformed entry is refused. */
      add: function (def) {
        if (!isObj(def) || typeof def.id !== 'string' || !ID_RE.test(def.id) || typeof def.name !== 'string' || !def.name.trim() || def.name.length > 30) { return false; }
        if (def.unlocked !== undefined && typeof def.unlocked !== 'function') { return false; }
        var entry = {
          id: def.id, name: def.name.trim(), description: typeof def.description === 'string' ? def.description : '', how: typeof def.how === 'string' ? def.how : '',
          unlocked: def.unlocked || null, art: typeof def.art === 'function' ? def.art : null, builtin: !sealed
        };
        for (var i = 0; i < items.length; i++) {
          if (items[i].id === entry.id) { if (items[i].builtin) { return false; } items[i] = entry; return true; }
        }
        items.push(entry);
        return true;
      },
      /** True when the entry exists and its rule says yes (a rule that throws counts as no). */
      isUnlocked: function (id, f, save) {
        var e = reg.get(id);
        if (!e) { return false; }
        if (!e.unlocked) { return true; }
        try { return e.unlocked(f || facts(save), save) === true; } catch (err) { return false; }
      },
      /** The ids that are open now. */
      unlockedIds: function (f, save) { return items.filter(function (e) { return reg.isUnlocked(e.id, f, save); }).map(function (e) { return e.id; }); },
      /** `id` when it exists and is open, otherwise the default (the plain frame, no title). */
      resolve: function (id, f, save) { return typeof id === 'string' && reg.isUnlocked(id, f, save) ? id : fallback; }
    };
    return reg;
  }

  var frames = makeRegistry(DEFAULT_FRAME);
  var titles = makeRegistry('');

  [
    { id: 'plain', name: 'Plain', description: 'A simple ring. Always open.', how: 'Open from the start.' },
    { id: 'laurel', name: 'Laurel', description: 'A wreath of leaves, for a first $100 given.', how: 'Give $100 in total.',
      unlocked: function (f) { return f.totalCents >= 10000; } },
    { id: 'flame', name: 'Flame', description: 'Little flames round the base, for a week of giving.', how: 'Keep a giving streak of 7 days (your best streak counts).',
      unlocked: function (f) { return f.bestStreak >= 7; } },
    { id: 'halo', name: 'Halo', description: 'A soft halo above the emblem, for a first rank.', how: 'Earn Rank 1, Patron, by giving ' + dollars(1000) + ' in total.',
      unlocked: function (f) { return f.rank >= 1; } },
    { id: 'stars', name: 'Stars', description: 'A ring of small stars, for a full cabinet of badges.', how: 'Earn 12 badges.',
      unlocked: function (f) { return f.badges >= 12; } },
    { id: 'hex', name: 'Hexagon', description: 'A tidy hexagon, for a growing card collection.', how: 'Collect 25 cards.',
      unlocked: function (f) { return f.cardsOwned >= 25; } },
    { id: 'diamond', name: 'Diamond', description: 'A cut-glass diamond, for finishing a monthly card set.', how: 'Finish a monthly card set (all six cards).',
      unlocked: function (f) { return f.setsDone >= 1; } },
    { id: 'rays', name: 'Sunburst', description: 'Rays all the way round, for a Champion.', how: 'Earn Rank 3, Champion, by giving ' + dollars(10000) + ' in total.',
      unlocked: function (f) { return f.rank >= 3; } }
  ].forEach(frames.add);
  frames.seal();

  [
    { id: 'giver', name: 'Giver', description: 'Where every profile starts.', how: 'Complete your first round.',
      unlocked: function (f) { return f.plays >= 1; } },
    { id: 'streak-keeper', name: 'Streak Keeper', description: 'Shows up day after day.', how: 'Keep a giving streak of 5 days (your best streak counts).',
      unlocked: function (f) { return f.bestStreak >= 5; } },
    { id: 'set-collector', name: 'Set Collector', description: 'Dealt all six cards of a month.', how: 'Finish a monthly card set.',
      unlocked: function (f) { return f.setsDone >= 1; } },
    { id: 'explorer', name: 'Charity Explorer', description: 'Has been round the whole map.', how: 'Give to 10 different charities.',
      unlocked: function (f) { return f.charities >= 10; } },
    { id: 'high-roller', name: 'High Roller', description: 'Gives in big, friendly lumps.', how: 'Give $100 or more in one round.',
      unlocked: function (f) { return f.biggestCents >= 10000; } },
    { id: 'table-regular', name: 'Table Regular', description: 'Has a favourite seat at the live tables.', how: 'Play 5 rounds at live tables.',
      unlocked: function (f) { return f.liveRounds >= 5; } },
    { id: 'fair-play-fan', name: 'Fair Play Fan', description: 'Checks the draw for themselves.', how: 'Verify a result in Fair Play.',
      unlocked: function (f) { return f.verifies >= 1; } },
    { id: 'rank-climber', name: 'Rank Climber', description: 'Moving up the VIP lounge.', how: 'Earn Rank 2, Benefactor, by giving ' + dollars(5000) + ' in total.',
      unlocked: function (f) { return f.rank >= 2; } }
  ].forEach(titles.add);
  titles.seal();

  /* ------------------------------------------------------------------ favourites and recent rounds */

  function byCountThenCents(a, b) {
    return b.count - a.count || b.cents - a.cents || b.last - a.last || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  }

  /**
   * The favourite charities and causes, worked out from the rounds in `history` (the store keeps the latest 60). A charity's count is the number of rounds
   * it got a share of; a cause's count is the number of rounds that gave to at least one charity with that cause (counted once per round), and its cents add up the
   * gifts to those charities. The order is: more rounds, then more cents, then the more recent, then the id, so the same history always gives the same list.
   * `o.limit` (default 3), `o.causesOf(charityId)` gives a charity's cause ids, `o.known(charityId)` leaves out a charity that is no longer on the roster.
   * Anything odd in the history (not a list, rounds without allocations, junk amounts) is skipped.
   */
  function favourites(history, o) {
    o = o || {};
    var limit = o.limit > 0 ? Math.floor(o.limit) : 3;
    var causesOf = typeof o.causesOf === 'function' ? o.causesOf : function () { return []; };
    var known = typeof o.known === 'function' ? o.known : function () { return true; };
    var ch = Object.create(null);
    var cs = Object.create(null);
    var rounds = 0;
    (Array.isArray(history) ? history : []).forEach(function (h) {
      if (!isObj(h) || !Array.isArray(h.allocations)) { return; }
      var ts = whole(h.ts);
      var seenCh = Object.create(null);
      var seenCs = Object.create(null);
      var any = false;
      h.allocations.forEach(function (a) {
        if (!isObj(a) || typeof a.charityId !== 'string' || !a.charityId || !known(a.charityId)) { return; }
        any = true;
        var id = a.charityId;
        var cents = whole(a.cents);
        var e = ch[id] || (ch[id] = { id: id, count: 0, cents: 0, last: 0 });
        if (!seenCh[id]) { seenCh[id] = true; e.count += 1; }
        e.cents += cents;
        e.last = Math.max(e.last, ts);
        var list = causesOf(id);
        (Array.isArray(list) ? list : []).forEach(function (c) {
          if (typeof c !== 'string' || !c) { return; }
          var ce = cs[c] || (cs[c] = { id: c, count: 0, cents: 0, last: 0 });
          if (!seenCs[c]) { seenCs[c] = true; ce.count += 1; }
          ce.cents += cents;
          ce.last = Math.max(ce.last, ts);
        });
      });
      if (any) { rounds += 1; }
    });
    function top(map) { return Object.keys(map).map(function (k) { return map[k]; }).sort(byCountThenCents).slice(0, limit); }
    return { charities: top(ch), causes: top(cs), rounds: rounds };
  }

  /**
   * The newest `limit` rounds that can be shown, like the lobby's "Your latest rounds": a round with no allocation, or whose first charity is no longer on the
   * roster (`known(id)` says), is left out rather than stopping the list.
   */
  function recentRounds(history, limit, known) {
    var ok = typeof known === 'function' ? known : function () { return true; };
    var max = limit > 0 ? Math.floor(limit) : 8;
    var out = [];
    var list = Array.isArray(history) ? history : [];
    for (var i = 0; i < list.length && out.length < max; i++) {
      var h = list[i];
      if (isObj(h) && Array.isArray(h.allocations) && h.allocations.length && isObj(h.allocations[0]) && typeof h.allocations[0].charityId === 'string' && ok(h.allocations[0].charityId)) { out.push(h); }
    }
    return out;
  }

  /* ------------------------------------------------------------------ bots */

  var BOT_TITLES = ['Table Hopper', 'Pot Watcher', 'Steady Hand', 'Night Owl', 'Weekend Warrior', 'Streak Chaser', 'Underdog Fan', 'Early Bird',
    'Big Table Regular', 'Quiet Giver', 'Wheel Whisperer', 'Race Day Regular', 'Confetti Collector', 'Polite Roller', 'Lucky Charm', 'Round Counter'];
  var BOT_HABITS = ['gives most on weekends', 'likes to give just after breakfast', 'tends to back the underdog', 'never skips a Friday table', 'prefers small, steady gifts',
    'likes the big tables', 'waves at everyone in the feed', 'always has an emote ready', 'is happiest when the pot is growing', 'gives a little more when it rains',
    'saves the big gift for the last round', 'cheers every winner, whoever it is'];

  /**
   * A made-up profile for a simulated player, from the name alone (the same every time). Nothing in it is real: there is no person, no history and no
   * giving behind a bot. `o.causes` is [{ id, name }] and `o.games` is [{ id, name }] to pick the favourites from; without them those lines are left out.
   * Returns { name, standing (core.botStanding), title, habit, streak, cause, game }.
   */
  function botDetails(name, o) {
    o = o || {};
    var nm = cleanName(String(name == null ? '' : name)).slice(0, 40);
    var rng = core.seeded('botprofile:' + nm);
    function pick(list) { return list.length ? list[Math.floor(rng() * list.length)] : null; }
    var title = pick(BOT_TITLES);
    var habit = pick(BOT_HABITS);
    var streak = 2 + Math.floor(rng() * 29);
    var cause = Array.isArray(o.causes) ? pick(o.causes) : null;
    var game = Array.isArray(o.games) ? pick(o.games) : null;
    return { name: nm, standing: core.botStanding(nm), title: title, habit: habit, streak: streak, cause: cause, game: game };
  }

  return {
    NAME_MAX: NAME_MAX, PUNCTUATION: PUNCT, cleanName: cleanName, isBlocked: isBlocked, validateName: validateName, sanitize: sanitize, displayName: displayName,
    facts: facts, frames: frames, titles: titles, favourites: favourites, recentRounds: recentRounds, botDetails: botDetails, BOT_TITLES: BOT_TITLES, BOT_HABITS: BOT_HABITS
  };
});
