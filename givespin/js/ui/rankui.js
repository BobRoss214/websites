/*
 * Ranks on the screen. The rules are in js/core.js (RANKS, rankFor, standingFor, botStanding) and the emblems are drawn by js/ranks.js; this file puts
 * them in front of people:
 *   ui.rankui   the Giving Club's rank card and its ladder of the eight ranks, the "what comes next" sentence, and the side-nav card
 *   ui.rankup   the rank-up moment (the emblem big, "You reached Rank 1: Patron", confetti and a fanfare) and its lighter cousin for a level-up inside a rank
 *
 * A rank is a receipt for giving, like XP: it is worked out from the total given, it is not money, and it unlocks nothing with a cash value.
 * Every other player on a live table, in a league or in a crew is a simulated bot and has a simulated rank (core.botStanding).
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var ui = GS.ui;
  var esc = ui.esc;
  var store = GS.store;
  var money = core.fmtMoney;

  function dollars(cents) { return money(cents, true); }
  function demo() { return GS.payments && GS.payments.mode() === 'demo'; }

  /* ------------------------------------------------------------- what comes next */

  /**
   * One plain sentence about the next step. Before $1,000 given the goal is the first rank; inside a rank it is the next level; from level 10 it is the
   * next rank; at the very top there is nothing left.
   */
  function nextLine(st) {
    if (st.maxed) { return 'You are at the top: Rank 8 · Level 10.'; }
    if (!st.rank) { return 'Next rank: ' + st.nextRank.name + ' at ' + dollars(st.nextRank.at * 100) + ' (' + dollars(st.toRankCents) + ' to go)'; }
    if (st.level < core.RANK_LEVELS || !st.nextRank) { return 'Next: ' + st.nextLabel + ' at ' + dollars(st.nextAt) + ' (' + dollars(st.toNextCents) + ' to go)'; }
    return 'Next rank: ' + st.nextRank.name + ' at ' + dollars(st.nextAt) + ' (' + dollars(st.toNextCents) + ' to go)';
  }

  /* --------------------------------------------------------------- Giving Club */

  /** The rank card that takes the place of the level card once a player has a rank: the ring of ten levels around the emblem, and where they are. */
  function cardHTML(st, lv, s) {
    var tip = demo()
      ? 'Ranks are a receipt for giving, like XP: not money, and they unlock nothing with a cash value. In demo mode the dollars are pretend, so your rank is too.'
      : 'Ranks are a receipt for giving, like XP: not money, and they unlock nothing with a cash value.';
    var goal = st.maxed ? 'Max rank and level reached.' : nextLine(st);
    var ring = ui.rankRing(st.rank, st.level, 112);   // (empty if the emblem file is missing: the words carry the card)
    return '<div class="panel levelcard rankcard rankcard--r' + st.rank + '"' + ui.rankTheme(st.rank) + '>' +
      (ring ? '<div class="rankcard__ring">' + ring + '</div>' : '') +
      '<div class="levelcard__main">' +
        '<div class="lvl__name rankcard__title">' + esc(st.label) + '</div>' +
        '<div class="rankcard__name">' + esc(st.name) + '</div>' +
        '<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + st.pct + '" aria-label="' + (st.maxed ? 'Top rank reached' : 'Progress to ' + esc(st.nextLabel)) + '"><i style="width:' + st.pct + '%"></i></div>' +
        '<div class="lvl__meta" data-role="rank-next">' + esc(goal) + '</div>' +
        '<div class="lvl__meta rankcard__xp">XP: ' + Math.floor(s.xp).toLocaleString('en-US') + ' · ' + esc(lv.name) + '</div>' +
        '<p class="lvl__tip">' + tip + ' <a href="#help-ranks">What are ranks?</a></p></div></div>';
  }

  /** The line added to the old level card before $1,000 given: the first rank is the next goal. */
  function goalHTML(st) {
    return '<div class="lvl__meta rankcard__goal" data-role="rank-next">' + esc(nextLine(st)) + '</div>';
  }

  /** The "Ranks" section: all eight, with their emblem, name, threshold and where the player is (reached, you are here, locked). */
  function ladderSection(st) {
    var rows = core.RANKS.map(function (r) {
      var state = st.rank > r.n ? 'done' : (st.rank === r.n ? 'now' : 'locked');
      var meta = GS.ranks && GS.ranks.META ? GS.ranks.META[r.n - 1] : null;
      var text = state === 'done' ? ui.icon('check') + 'Reached' : (state === 'now' ? 'You are here · Level ' + st.level : ui.icon('lock') + 'Locked');
      return '<li class="rk__row is-' + state + ' rk__row--r' + r.n + '"' + ui.rankTheme(r.n) + (state === 'now' ? ' aria-current="true"' : '') + '>' +
        '<span class="rk__e" aria-hidden="true">' + ui.rankEmblem(r.n, 56, { animated: state !== 'locked' }) + '</span>' +
        '<span class="rk__t"><b>Rank ' + r.n + ' · ' + esc(r.name) + '</b><small>' + dollars(r.at * 100) + ' given</small>' + (meta && meta.blurb ? '<small class="rk__blurb">' + esc(meta.blurb) + '</small>' : '') + '</span>' +
        '<span class="rk__s">' + text + '</span></li>';
    }).join('');
    return '<section class="sect panel rk" aria-labelledby="cl-rank"><div class="sect__head"><h2 class="sect__t" id="cl-rank">Ranks</h2><span class="tag tag--plain">' + core.RANKS.length + ' ranks</span></div>' +
      '<p class="rk__intro">After level 10, at ' + dollars(core.RANKS[0].at * 100) + ' given, you earn a rank, and every rank has its own levels 1 to 10 (' + esc(core.RANKS[1].name) + ' covers ' + dollars(core.RANKS[1].at * 100) + ' to ' + dollars(core.RANKS[2].at * 100) + ', so its level 6 starts at ' + dollars(core.rankLevelAt(2, 6)) + '). ' +
      'Your rank shows next to your name. Ranks, like XP, are a receipt for giving: they are not money and they unlock nothing with a cash value' + (demo() ? ', and in demo mode the dollars are pretend' : '') + '. ' +
      'On live tables, in leagues and in crews the other players’ ranks are simulated, like the players. <a href="#help-ranks">What are ranks?</a></p>' +
      '<ol class="rk__list" aria-label="The eight ranks">' + rows + '</ol></section>';
  }

  /* ------------------------------------------------------------------ side nav */

  /**
   * The level card at the bottom of the side nav. Before $1,000 given it is the card it always was (the level number, its name and the XP bar);
   * from $1,000 it shows the rank's emblem, the rank's name and "Rank 2 · Level 6" with the bar to the next level. js/app.js puts it in #side-level.
   */
  function sideHTML() {
    var st = ui.myStanding();
    var lv = core.levelFor(store.get().xp);
    if (!st.rank) {
      return '<a class="lvlcard" href="#club" aria-label="Level ' + lv.level + ', ' + esc(lv.name) + '. Open the Giving Club">' +
        '<span class="lvlcard__n">' + lv.level + '</span><span class="lvlcard__t"><b>' + esc(lv.name) + '</b><span class="bar"><i style="width:' + lv.pct + '%"></i></span></span></a>';
    }
    return '<a class="lvlcard lvlcard--rank"' + ui.rankTheme(st.rank) + ' href="#club" aria-label="' + esc(st.words) + '. Open the Giving Club">' +
      '<span class="lvlcard__e" aria-hidden="true">' + ui.rankEmblem(st.rank, 40, { animated: false }) + '</span>' +
      '<span class="lvlcard__t"><b>' + esc(st.name) + '</b><small>' + esc(st.label) + '</small><span class="bar"><i style="width:' + st.pct + '%"></i></span></span></a>';
  }

  ui.rankui = { nextLine: nextLine, cardHTML: cardHTML, goalHTML: goalHTML, ladderSection: ladderSection, sideHTML: sideHTML };

  /* ------------------------------------------------------------- rank-up moment */

  var told = [];            // the results already celebrated (by identity), so one result is never celebrated twice
  var momentModal = null;

  function wasTold(summary) { return told.indexOf(summary) >= 0; }
  function note(summary) { told.push(summary); if (told.length > 30) { told.shift(); } }

  /** The big moment for a new rank: a dialog with the emblem, what was reached, what comes next, confetti and a fanfare. */
  function moment(summary) {
    var st = summary.rankAfter;
    if (!momentModal) { momentModal = ui.modal('rankup', { className: 'modal--rankup' }); }
    var m = momentModal;
    var skipped = summary.rankBefore && st.rank - summary.rankBefore.rank > 1;
    var emblem = ui.rankEmblem(st.rank, 176, { animated: true });
    m.set(
      '<div class="rkup rkup--r' + st.rank + '"' + ui.rankTheme(st.rank) + '>' +
        '<div class="rkup__glow" aria-hidden="true"></div>' +
        (emblem ? '<div class="rkup__emblem" aria-hidden="true">' + emblem + '</div>' : '') +
        '<p class="rkup__eyebrow">Rank up!</p>' +
        '<h2 class="rkup__title" id="dlg-rankup-title">You reached Rank ' + st.rank + ': ' + esc(st.name) + '</h2>' +
        '<p class="rkup__lvl">' + esc(st.label) + (skipped ? ' · you jumped ahead' : '') + '</p>' +
        '<p class="rkup__text">You have given ' + dollars(st.cents) + ' in total. Your rank shows next to your name. It is a receipt for giving, like XP: not money, and it unlocks nothing with a cash value' + (demo() ? '. In demo mode the dollars are pretend, so the rank is too' : '') + '.</p>' +
        '<p class="rkup__next">' + esc(st.maxed ? 'You are at the top: Rank 8 · Level 10.' : nextLine(st)) + '</p>' +
        '<div class="rkup__act"><button type="button" class="btn btn--green" data-role="rankup-done">Keep giving</button><a class="btn btn--ghost" href="#club" data-role="rankup-club">See all ranks</a></div>' +
      '</div>');
    m.setLocked(false);
    m.open();
    var done = m.$('[data-role="rankup-done"]');
    if (done) {
      done.addEventListener('click', function () { m.close(); });
      m.$('[data-role="rankup-club"]').addEventListener('click', function () { m.close(); });
      try { done.focus({ preventScroll: true }); } catch (e) { /* not focusable right now */ }
    }
    GS.audio.levelUp();
    setTimeout(function () { GS.audio.win(); }, 420);
    GS.confetti.celebrate(1.5);
    GS.confetti.shower(2200);
  }

  /** The lighter version for a level-up inside a rank: a toast with the small emblem, "Level up! Rank 2 · Level 7". */
  function levelToast(summary) {
    var st = summary.rankAfter;
    var box = ui.$('#toasts');
    if (!box) { return; }
    var t = document.createElement('div');
    t.className = 'toast toast--rank';
    t.innerHTML = '<span class="toast__e" aria-hidden="true">' + ui.rankEmblem(st.rank, 28, { animated: false }) + '</span><span>Level up! ' + esc(st.label) + '</span>';
    box.appendChild(t);
    setTimeout(function () { t.classList.add('is-out'); }, 3200);
    setTimeout(function () { if (t.parentNode) { t.parentNode.removeChild(t); } }, 3600);
    GS.audio.levelUp();
  }

  /**
   * Celebrates what a round (or a live result) did to the player's standing, once. A new rank gets the big moment; a level-up inside a rank gets the
   * lighter toast when `o.toast` is set (a receipt already says it in its own XP card). Anything else, and anything already celebrated, does nothing.
   * Returns true when something was shown.
   */
  function show(summary, o) {
    o = o || {};
    if (!summary || !summary.rankAfter || wasTold(summary)) { return false; }
    if (summary.rankedUp) { note(summary); moment(summary); return true; }
    if (summary.levelUp && summary.rankAfter.rank > 0 && o.toast) { note(summary); levelToast(summary); return true; }
    return false;
  }

  ui.rankup = { show: show };
})();
