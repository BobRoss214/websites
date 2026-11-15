/*
 * Share cards, the pure parts (unit-tested in Node): what text goes on which card, the verify code, file names, the big-win rule
 * and the line-breaking maths. The drawing itself (canvas, dialog, download, Web Share) is js/ui/sharecard.js.
 *
 *   GS.share.SIZES                  the two picture shapes: portrait 1080 x 1350 and square 1080 x 1080
 *   GS.share.bigWin(f)              'jackpot' | 'rankup' | 'called' | 'big' | '' : why a round gets the fancy gold frame (see the rule below)
 *   GS.share.verifyCode(fair, id)   { hash, id, text, hint } for the "Verify this round" line, or null when the round has no draw to check
 *   GS.share.roundCard(input)       the words on a round's card
 *   GS.share.profileCard(input)     the words on the profile card
 *   GS.share.shareText(card, o)     the short text that travels with the picture (never anything personal)
 *   GS.share.altText(card, size)    what a screen reader hears for the picture
 *   GS.share.fileName(kind, id, size)  "givespin-gift-GS-7K2M9Q-portrait.png"
 *   GS.share.wrapText / fitSize / ellipsize   line breaking and font fitting that only need a width function, not a canvas
 *
 * The big-win rule: a round gets the fancy frame (gold border, glow, confetti dots) when it is a Triple Threat (a jackpot), when it took the
 * player into a new rank, when the charity the player backed won, or when the gift was $100 or more (BIG_GIFT_CENTS). Anything else gets the plain
 * frame. It is worked out from the round alone, so the same round always gives the same frame.
 *
 * Privacy: a card only ever holds what is listed here: the display name the visitor chose (and only when they switched "Show my name" on),
 * their rank and level, the amount of the gift, the game, the charity, the receipt id and the first 8 characters of the round's public fingerprint.
 * Never the balance, an email, a phone number, a card, or the secret number.
 */
(function (root, factory) {
  'use strict';
  var mod = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = mod; }
  if (typeof window !== 'undefined') { window.GS = window.GS || {}; window.GS.share = mod; }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';

  var SIZES = {
    portrait: { id: 'portrait', label: 'Portrait', w: 1080, h: 1350 },
    square: { id: 'square', label: 'Square', w: 1080, h: 1080 }
  };
  var BIG_GIFT_CENTS = 10000;   // a gift of $100 or more
  var MAX_NAME = 24;            // letters of a display name that fit a card
  var BIG_LABELS = { jackpot: 'Triple Threat', rankup: 'Rank up', called: 'Called it', big: 'Big gift' };

  function str(v) { return v === undefined || v === null ? '' : String(v); }

  /** The picture shape for an id, portrait when the id is unknown. */
  function sizeFor(id) { return SIZES[id] || SIZES.portrait; }

  /** A display name made safe for a card: one line, no control characters or angle brackets, at most 24 characters, and nothing at all for an email address. */
  function cleanName(s) {
    var t = str(s).replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim();
    if (/\S+@\S+\.\S+/.test(t)) { return ''; }   // an email address is not a display name, and a card is shared in public
    return Array.from(t).slice(0, MAX_NAME).join('').trim();
  }

  /** Why a round gets the fancy frame, or ''. f = { jackpot, rankedUp, pickWon, cents }. */
  function bigWin(f) {
    f = f || {};
    if (f.jackpot) { return 'jackpot'; }
    if (f.rankedUp) { return 'rankup'; }
    if (f.pickWon) { return 'called'; }
    if (Number(f.cents) >= BIG_GIFT_CENTS) { return 'big'; }
    return '';
  }

  /** The words on the gold ribbon for a reason from bigWin ('' for no ribbon). */
  function bigLabel(reason) { return BIG_LABELS[reason] || ''; }

  function cleanId(id) {
    var t = str(id).trim();
    return /^[A-Za-z0-9-]{3,24}$/.test(t) ? t : '';
  }

  /**
   * The "Verify this round" line: the first 8 characters of the round's public fingerprint (the hash that was shown before the draw) and the receipt id.
   * With those two a person can find the round on the Fair Play page. Null when the round has no draw (a direct gift, or a browser that cannot run the check)
   * or the id is missing, so a card never claims a check it cannot back up.
   */
  function verifyCode(fair, id) {
    var h = fair && typeof fair.serverHash === 'string' ? fair.serverHash.toLowerCase() : '';
    var rid = cleanId(id);
    if (!/^[0-9a-f]{16,128}$/.test(h) || !rid) { return null; }
    var hash = h.slice(0, 8);
    return { hash: hash, id: rid, text: 'Verify this round: ' + hash + ' · ' + rid, hint: 'Check it at Fair Play' };
  }

  /** The address people can open: this page without its #route and ?query, and without a trailing index.html. '' for anything that is not http(s). */
  function siteUrl(href) {
    var m = /^(https?:\/\/[^/?#]+)([^?#]*)/i.exec(str(href).trim());
    if (!m) { return ''; }
    return m[1] + m[2].replace(/index\.html?$/i, '');
  }

  /** The address as it is printed on a card: no scheme, no trailing slash ("givespin.example/arcade"). '' for a page opened from a file. */
  function siteLabel(href) {
    var u = siteUrl(href);
    return u ? u.replace(/^https?:\/\//i, '').replace(/\/+$/, '') : '';
  }

  /** A safe file name: kind is 'gift' or 'profile', id the receipt id (leave out for a profile), size 'portrait' or 'square'. */
  function fileName(kind, id, size) {
    var parts = ['givespin', kind === 'profile' ? 'profile' : 'gift'];
    var rid = cleanId(id);
    if (kind !== 'profile' && rid) { parts.push(rid); }
    parts.push(sizeFor(size).id);
    return parts.join('-').replace(/[^A-Za-z0-9-]/g, '') + '.png';
  }

  /** "WaterAid", "A and B", "A, B and C" */
  function joinNames(list) {
    return list.length <= 1 ? str(list[0]) : list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
  }

  /** The standing part of a card from core.standingFor: { rank, level, label ("Rank 2 · Level 6"), name ("Benefactor") }. */
  function standingOf(st) {
    st = st || {};
    var rank = Math.floor(Number(st.rank)) || 0;
    var level = Math.floor(Number(st.level)) || 1;
    return {
      rank: rank, level: level,
      label: str(st.label) || (rank ? 'Rank ' + rank + ' · Level ' + level : 'Level ' + level),
      name: str(st.name)
    };
  }

  var TAGLINE = 'House edge: 0%. The house is a charity.';   // the site's own line (docs/voice.md)

  function demoNote(demo) {
    return demo ? 'Simulated round: no money moved and nothing was charged' : 'The gift is finished on the charity’s own checkout page';
  }

  /**
   * The words on a round's card.
   * input = { demo, amountText ("$25"), cents, game (name), direct, charities: [{ name, short }] (biggest share first), jackpot, pickWon, rankedUp,
   *           standing (core.standingFor), receiptId, fair ({ serverHash }), name (ONLY when the visitor switched it on), site (siteLabel) }
   */
  function roundCard(input) {
    var i = input || {};
    var names = (i.charities || []).map(function (c) { return str(c && c.name); }).filter(Boolean);
    var shorts = (i.charities || []).map(function (c) { return str(c && (c.short || c.name)); }).filter(Boolean);
    var name = cleanName(i.name);
    var reason = bigWin({ jackpot: i.jackpot, rankedUp: i.rankedUp, pickWon: i.pickWon, cents: i.cents });
    var verify = i.direct ? null : verifyCode(i.fair, i.receiptId);
    return {
      kind: 'round',
      demo: !!i.demo,
      name: name,
      big: reason,
      ribbon: bigLabel(reason),
      eyebrow: name ? name + '’s gift' : 'A gift from the arcade',
      amount: str(i.amountText),
      lead: i.demo ? 'went to' : 'is for',
      charity: names.length === 1 ? names[0] : names.length ? names.length + ' charities' : 'a charity',
      charityShort: shorts.length === 1 ? shorts[0] : names.length ? names.length + ' charities' : 'a charity',
      names: names.slice(0, 3),
      shorts: shorts.slice(0, 3),
      more: Math.max(0, names.length - 3),
      count: names.length,
      game: str(i.game),
      standing: standingOf(i.standing),
      receipt: cleanId(i.receiptId),
      verify: verify,
      verifyNote: verify ? (i.demo ? 'In this demo the secret is made on your own device' : '') : '',
      tagline: TAGLINE,
      note: demoNote(i.demo),
      site: str(i.site)
    };
  }

  /**
   * The words on the profile card.
   * input = { demo, name (only when switched on), standing, totalText ("$1,250"), top ({ name } of the charity given to most, or null),
   *           cause (name of the cause given to most, or ''), streak (days), site }
   */
  function profileCard(input) {
    var i = input || {};
    var name = cleanName(i.name);
    var streak = Math.max(0, Math.floor(Number(i.streak)) || 0);
    return {
      kind: 'profile',
      demo: !!i.demo,
      name: name,
      big: '',
      ribbon: '',
      eyebrow: name ? name + '’s giving' : 'My giving',
      standing: standingOf(i.standing),
      total: str(i.totalText),
      totalLine: str(i.totalText) + ' given',
      topCharity: i.top && i.top.name ? str(i.top.name) : '',
      topLine: i.top && i.top.name ? 'Most given to: ' + str(i.top.name) : '',
      cause: str(i.cause),
      causeLine: i.cause ? 'Favourite cause: ' + str(i.cause) : '',
      streak: streak,
      streakLine: streak ? streak + (streak === 1 ? ' day' : ' days') + ' in a row' : '',
      verify: null,
      verifyNote: '',
      tagline: TAGLINE,
      note: i.demo ? 'Simulated: no money moved and nothing was charged' : 'Gifts are finished on each charity’s own checkout page',
      site: str(i.site)
    };
  }

  /**
   * The short text that travels with the picture (Web Share, or copied). It names no one unless the card does (card.name is empty when the switch is off),
   * never holds an amount of credit or anything about the account, and in checkout mode it does not claim a gift that was not finished yet.
   */
  function shareText(card, o) {
    o = o || {};
    var tail = ' Give it a spin:';
    if (card.kind === 'profile') {
      var who = card.name ? card.name + '’s' : 'My';
      return who + ' GiveSpin profile: ' + card.standing.label + (card.total ? ', ' + card.total + ' given' + (card.demo ? ' (play money)' : '') : '') + '.' + tail;
    }
    var list = card.count > 3 ? card.count + ' charities' : joinNames(card.shorts.length ? card.shorts : [card.charityShort]);
    var text = card.demo
      ? (card.name ? card.name + '’s' : 'My') + ' GiveSpin round landed on ' + list + ' (play money).'
      : 'GiveSpin picked ' + list + ' for ' + (card.name ? card.name + '’s' : 'my') + ' ' + card.amount + ' gift.';
    if (card.verify) { text += ' Check it yourself: ' + card.verify.hash + ' · ' + card.verify.id + '.'; }
    return text + tail;
  }

  /** What a screen reader hears for the picture. size is 'portrait' or 'square'. */
  function altText(card, size) {
    var s = sizeFor(size);
    var bits = ['GiveSpin share picture, ' + s.label.toLowerCase() + ' (' + s.w + ' by ' + s.h + ').'];
    if (card.kind === 'profile') {
      bits.push((card.name ? card.name + ': ' : '') + card.standing.label + (card.standing.name ? ', ' + card.standing.name : '') + '.');
      bits.push(card.totalLine + '.');
      if (card.topLine) { bits.push(card.topLine + '.'); }
      if (card.causeLine) { bits.push(card.causeLine + '.'); }
      if (card.streakLine) { bits.push('Streak: ' + card.streakLine + '.'); }
    } else {
      if (card.ribbon) { bits.push('Gold frame: ' + card.ribbon + '.'); }
      bits.push((card.name ? card.name + ': ' : '') + card.standing.label + (card.standing.name ? ', ' + card.standing.name : '') + '.');
      bits.push(card.amount + ' ' + card.lead + ' ' + joinNames(card.count > 3 ? [card.count + ' charities'] : card.names) + (card.game ? ', game: ' + card.game : '') + '.');
      if (card.verify) { bits.push(card.verify.text + '. ' + card.verify.hint + '.'); }
    }
    bits.push(card.tagline + ' ' + card.note + '.');
    return bits.join(' ');
  }

  /* ------------------------------------------------------------------ line breaking (no canvas needed: pass the width function) */

  /** `text` cut to fit `maxWidth` with a trailing "…" (the text itself when it fits). measure(str) gives a width. */
  function ellipsize(text, maxWidth, measure) {
    var t = str(text);
    if (measure(t) <= maxWidth) { return t; }
    var chars = Array.from(t);
    var lo = 0, hi = chars.length;
    while (lo < hi) {   // the longest start that still fits with the dots
      var mid = Math.ceil((lo + hi) / 2);
      if (measure(chars.slice(0, mid).join('').replace(/\s+$/, '') + '…') <= maxWidth) { lo = mid; } else { hi = mid - 1; }
    }
    return chars.slice(0, lo).join('').replace(/\s+$/, '') + '…';
  }

  /**
   * Breaks `text` into lines no wider than maxWidth, at spaces; a word wider than a line is cut by characters. At most `maxLines` lines: when text is left over,
   * the last line ends in "…". Returns { lines, cut }.
   */
  function wrapText(text, maxWidth, measure, maxLines) {
    var words = str(text).split(/\s+/).filter(Boolean);
    var lines = [];
    var line = '';
    var left = false;
    maxLines = Math.max(1, Math.floor(maxLines) || 1);
    function push(l) { lines.push(l); line = ''; }
    for (var w = 0; w < words.length; w++) {
      var word = words[w];
      if (lines.length >= maxLines) { left = true; break; }
      var tryLine = line ? line + ' ' + word : word;
      if (measure(tryLine) <= maxWidth) { line = tryLine; continue; }
      if (line) { push(line); if (lines.length >= maxLines) { left = true; break; } }
      if (measure(word) <= maxWidth) { line = word; continue; }
      // a single word wider than a line: cut it by characters
      var chars = Array.from(word);
      var piece = '';
      for (var c = 0; c < chars.length; c++) {
        if (piece && measure(piece + chars[c]) > maxWidth) {
          push(piece); piece = '';
          if (lines.length >= maxLines) { left = true; break; }
        }
        piece += chars[c];
      }
      if (left) { break; }
      line = piece;
    }
    if (line && !left) { if (lines.length < maxLines) { lines.push(line); } else { left = true; } }
    if (left && lines.length) { lines[lines.length - 1] = ellipsize(lines[lines.length - 1] + '…', maxWidth, measure); }
    return { lines: lines, cut: left };
  }

  /** The biggest whole font size between minPx and maxPx at which `text` fits in maxWidth (minPx when even that is too wide). measureAt(str, px) gives a width. */
  function fitSize(text, maxWidth, measureAt, maxPx, minPx) {
    var lo = Math.floor(minPx), hi = Math.floor(maxPx);
    if (hi < lo) { return lo; }
    while (lo < hi) {
      var mid = Math.ceil((lo + hi) / 2);
      if (measureAt(text, mid) <= maxWidth) { lo = mid; } else { hi = mid - 1; }
    }
    return lo;
  }

  /* ------------------------------------------------------------------ what the profile card says about the history */

  /** The charities given to most, biggest first: [{ id, cents }], from the saved history (so an old save works). Ties go to the earlier id. */
  function topCharities(history, n) {
    var by = {};
    (history || []).forEach(function (h) {
      (h && h.allocations || []).forEach(function (a) {
        if (a && a.charityId) { by[a.charityId] = (by[a.charityId] || 0) + (Number(a.cents) || 0); }
      });
    });
    return Object.keys(by).map(function (id) { return { id: id, cents: by[id] }; })
      .sort(function (a, b) { return b.cents - a.cents || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); })
      .slice(0, n || 3);
  }

  /** The causes given to most, biggest first: [{ id, cents }]. A charity with several causes shares its total equally between them (as My Giving does). */
  function topCauses(history, causesOf, n) {
    var by = {};
    topCharities(history, 100000).forEach(function (c) {
      var causes = causesOf(c.id) || [];
      causes.forEach(function (k) { by[k] = (by[k] || 0) + c.cents / causes.length; });
    });
    return Object.keys(by).map(function (id) { return { id: id, cents: by[id] }; })
      .sort(function (a, b) { return b.cents - a.cents || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); })
      .slice(0, n || 3);
  }

  /** The remembered choices (GS.local key 'share'): whether to show the name, and the last picture shape. Anything odd gives the private defaults (name off). */
  function normPrefs(raw) {
    var r = raw && typeof raw === 'object' ? raw : {};
    return { showName: r.showName === true, size: SIZES[r.size] ? r.size : 'portrait' };
  }

  return {
    SIZES: SIZES, TAGLINE: TAGLINE, BIG_GIFT_CENTS: BIG_GIFT_CENTS, MAX_NAME: MAX_NAME, sizeFor: sizeFor, cleanName: cleanName,
    bigWin: bigWin, bigLabel: bigLabel, verifyCode: verifyCode, siteUrl: siteUrl, siteLabel: siteLabel, fileName: fileName,
    roundCard: roundCard, profileCard: profileCard, shareText: shareText, altText: altText,
    ellipsize: ellipsize, wrapText: wrapText, fitSize: fitSize, topCharities: topCharities, topCauses: topCauses, normPrefs: normPrefs, joinNames: joinNames
  };
});
