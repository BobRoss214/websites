/*
 * Charity of the week (js/weekly.js has the logic): the block on the lobby, the #spotlights page with the past weeks, and the one-line strip in a solo
 * game's "Back a charity" field. One charity a week, picked by a fixed rotation (not a ranking, not an endorsement); its two sentences come only from
 * the roster's own entry for it. Backing it in a game earns a small flat bonus of XP (never money), see receipt.js.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var ui = GS.ui;
  var esc = ui.esc;
  var W = GS.weekly;
  var XP = W.SPOTLIGHT_XP;

  /** This week's spotlight: { week, index, id, charity }. (Worked out again only when the week changes: the game screen asks on every keystroke in the amount box.) */
  var cached = null;
  function now() {
    var wk = GS.core.weekKey(new Date());
    if (!cached || cached.week !== wk || cached.n !== GS.charities.length) { cached = W.current(GS.charities, new Date()); cached.n = GS.charities.length; }
    return cached;
  }
  function isPick(id) { var c = now(); return !!id && c.id === id; }

  function inPool(id) { return GS.app.state.pool.some(function (c) { return c.id === id; }); }

  /** The game "Back it in a game" goes to: the one last played when it has a "Back a charity" step, else the Lucky Wheel (the same test as game.js's canPick). */
  function gameFor() {
    var g = GS.games[GS.store.prefs().game];
    return g && g.setBoard && g.id !== 'cards' && g.id !== 'scratch' ? g.id : 'wheel';
  }

  function dayText(d) { return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  function range(i) { var d = W.weekDays(i); return dayText(d.start) + ' to ' + dayText(d.end); }

  function bonusLine(ch) {
    return 'Back it in a game’s “Back a charity” step and earn ' + XP + ' extra XP, once a round, whether it wins or not. XP only: never money, and in demo mode it is all pretend.' +
      (inPool(ch.id) ? '' : ' (You have switched it off, or your game filters leave it out, so it cannot be backed right now.)');
  }

  /* ----------------------------------------------------------------- lobby */

  function lobbyHTML() {
    var cur = now();
    var ch = cur.charity;
    if (!ch) { return ''; }
    var ex = W.explain(ch);
    return '<div class="sect__head"><h2 class="sect__t">Charity of the week</h2><a class="linkbtn" href="#spotlights">See all spotlights</a></div>' +
      '<article class="spot spot--lobby panel" style="--c:' + ch.accent + '">' +
        '<div class="spot__mark">' + ui.siteMark(ch, 64) + '</div>' +
        '<div class="spot__body">' +
          '<h3 class="spot__name">' + ui.siteName(ch, 'spot__link') + '</h3>' +
          '<p class="spot__text"><span>' + esc(ex.sentences[0]) + '</span> <span class="spot__s2">' + esc(ex.sentences[1]) + '</span></p>' +
          '<p class="spot__meta">This week, ' + esc(range(cur.index)) + '. Back it in a game for +' + XP + ' XP (XP only, never money).</p>' +
        '</div>' +
        '<div class="spot__actions"><a class="btn btn--green btn--sm" href="#game-' + gameFor() + '" data-role="back">' + ui.icon('target') + 'Back it in a game</a></div>' +
      '</article>';
  }

  /* ------------------------------------------------------------------ page */

  function pastHTML() {
    return W.past(GS.charities, new Date(), 12).map(function (p) {
      var c = p.charity;
      if (!c) { return ''; }
      return '<li class="spast" style="--c:' + c.accent + '">' + ui.mono(c, 40) +
        '<span class="spast__t"><b>' + esc(c.name) + '</b><small>' + esc(range(p.index)) + '</small></span>' +
        ui.aboutBtn(c) + '</li>';
    }).join('');
  }

  function pageHTML() {
    var cur = now();
    var ch = cur.charity;
    var head = '<header class="page-head"><div><h1>Charity of the week</h1><p>One charity in the spotlight each week, and a new one every Monday. Backing it in a game earns a little extra XP, never money.</p></div></header>';
    if (!ch) { return head + '<p class="empty">No charity this week.</p>'; }
    var ex = W.explain(ch);
    var days = W.daysLeft(new Date());
    return head +
      '<article class="spot spot--big panel" aria-labelledby="spot-name" style="--c:' + ch.accent + '">' +
        '<div class="spot__mark">' + ui.siteMark(ch, 128) + '<p class="spot__markline">' + (ui.markKind(ch) === 'logo' ? 'Logo shown only to identify the organisation.' : 'Illustrated emblem, not the charity’s official logo.') + '</p></div>' +
        '<div class="spot__body">' +
          '<p class="spot__eyebrow">This week · ' + esc(range(cur.index)) + '</p>' +
          '<h2 class="spot__name" id="spot-name">' + ui.siteName(ch, 'spot__link') + '</h2>' +
          '<div class="spot__tags">' + ui.causeTags(ch) + (ch.faith ? '<span class="tag tag--plain">' + ui.icon('sparkle') + 'Faith-based</span>' : '') + '</div>' +
          '<p class="spot__text spot__text--big" data-role="text"><span>' + esc(ex.sentences[0]) + '</span> <span>' + esc(ex.sentences[1]) + '</span></p>' +
          '<div class="spot__actions">' +
            '<a class="btn btn--green" href="#game-' + gameFor() + '" data-role="back">' + ui.icon('target') + 'Back it in a game</a>' +
            (ui.siteUrl(ch) ? '<a class="btn" href="' + esc(ui.siteUrl(ch)) + '" target="_blank" rel="noopener noreferrer" data-role="visit" aria-label="Visit website of ' + esc(ch.name) + ' (opens in a new tab)">' + ui.icon('external-link') + 'Visit website</a>' : '') +
            ui.aboutBtn(ch) +
          '</div>' +
          '<p class="spot__bonus">' + ui.icon('sparkles') + '<span>' + esc(bonusLine(ch)) + '</span></p>' +
          '<p class="spot__fine">Picked automatically from the whole list, one a week, so every charity gets a turn. It is not a ranking and not an endorsement. ' +
            (days === 1 ? 'The next one starts tomorrow.' : 'The next one starts in ' + days + ' days, on Monday.') + ' Details come from the charity’s public materials and may change.</p>' +
        '</div>' +
      '</article>' +
      '<section class="sect" aria-labelledby="spot-past"><h2 class="sect__t" id="spot-past">Past spotlights</h2>' +
        '<p class="muted spot__pastnote">The last twelve weeks, newest first.</p>' +
        '<ol class="spasts">' + pastHTML() + '</ol></section>';
  }

  ui.pages['spotlights'] = function () {
    var root = ui.$('#view-spotlights');
    root.innerHTML = pageHTML();
  };

  /* ------------------------------------------------------------ lobby block */

  ui.lobby.addBlock({
    id: 'spotlight', order: 30, label: 'Charity of the week',
    mount: function (el) { el.innerHTML = lobbyHTML(); },
    refresh: function (el) { el.innerHTML = lobbyHTML(); }
  });

  /* ------------------------------------------------- the strip in a solo game */

  var strip = null;
  var stripBack = null;
  var stripKey = '';

  /**
   * Adds the one-line strip to a game's "Back a charity" field (`box`): "Charity of the week: <name>, +25 XP if you back it", with a small
   * Back it button. `back(id)` backs a charity in the game. css/ticker.css decides where it shows: in the Options sheet of a phone, and on a
   * tall laptop window; never where it would cost the first screen any height.
   */
  function mountStrip(box, back) {
    stripBack = back;
    strip = document.createElement('p');
    strip.className = 'spotstrip';
    strip.id = 'pick-spot';
    strip.hidden = true;
    box.appendChild(strip);
    strip.addEventListener('click', function (e) {
      var b = e.target.closest('[data-role="spot-back"]');
      if (!b || !stripBack) { return; }
      stripBack(b.getAttribute('data-id'));
      var chip = box.querySelector('.pickchip__open');
      if (chip) { chip.focus(); }
    });
  }

  /** Draws the strip for the charity being backed now (`pickId`, or '') and the charities this game can use (`pool`: the charity of the week can only be backed if it is one of them). */
  function syncStrip(pickId, pool) {
    if (!strip) { return; }
    var ch = now().charity;
    if (!ch) { strip.hidden = true; return; }
    var canBack = (pool || []).some(function (c) { return c.id === ch.id; });
    var mine = !!pickId && pickId === ch.id;
    var key = [ch.id, mine, !!canBack].join('|');
    if (key === stripKey) { return; }
    stripKey = key;
    strip.hidden = false;
    strip.classList.toggle('is-on', mine);
    if (mine) { strip.innerHTML = ui.icon('sparkles') + '<span>You are backing the charity of the week: +' + XP + ' XP when you play.</span>'; }
    else if (!canBack) { strip.innerHTML = ui.icon('sparkles') + '<span>Charity of the week: ' + esc(ch.short) + '. It is switched off or outside your game filters, so it cannot be backed now.</span>'; }
    else {
      strip.innerHTML = ui.icon('sparkles') + '<span>Charity of the week: ' + esc(ch.short) + ', +' + XP + ' XP if you back it.</span> ' +
        '<button type="button" class="linkbtn" data-role="spot-back" data-id="' + esc(ch.id) + '" aria-label="Back ' + esc(ch.name) + ', the charity of the week">Back it</button>';
    }
  }

  ui.spotlight = { current: now, isPick: isPick, mountStrip: mountStrip, syncStrip: syncStrip, XP: XP };
})();
