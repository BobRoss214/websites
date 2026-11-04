/*
 * The live ticker under the top bar: "Given today" and a feed of recent gifts, all from SIMULATED players (js/ticker.js has the numbers).
 *
 * It is on the lobby and on the Live tables pages, and nowhere else: not on a solo game or a live table (the one-screen rule: nothing may cost
 * those screens any height), not in Stream Mode, and not in a very short window (css/ticker.css). The bar keeps one fixed height whatever
 * it says. It is a labelled region with a static note for screen readers; the feed is NOT a live region and is never announced. It stops
 * while the pointer is over it or focus is inside it, the Pause button (aria-pressed) stops it for good, and with reduced motion it starts
 * paused and nothing moves or fades. The visitor's own gifts are never mixed in: these are other (made-up) players.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var ui = GS.ui;
  var esc = ui.esc;
  var T = GS.ticker;

  var SHOWN = 3;                      // lines in the feed (css/ticker.css shows fewer on a narrow screen)
  var NOTE = 'The totals and the gifts in this bar come from simulated players (bots), not from real people, and no real money is involved. Your own gifts are not counted here. The list changes every few seconds; the pause button stops it.';
  var TIP = 'Simulated players: not real people and not real money. Your own gifts are not counted here.';

  // Lucide's "pause", added from here so js/icons.js stays as it is
  if (!GS.iconPaths.pause) { GS.iconPaths.pause = '<rect x="14" y="3" width="5" height="18" rx="1"/> <rect x="5" y="3" width="5" height="18" rx="1"/>'; }

  var el = null;
  var built = false;
  var timer = 0;
  var paused = false;                 // the visitor pressed Pause (or reduced motion asked for calm)
  var held = false;                   // the pointer is over the bar, or focus is inside it
  var skewMs = 0;                     // for tests and demos: how far the bar's clock is moved on
  var shown = { slot: -1, minute: -1 };
  var onPage = false;                 // is this a page that has the ticker (the lobby, the Live tables pages)

  function clock() { return new Date(Date.now() + skewMs); }
  function reduced() { return !!(GS.util && GS.util.reducedMotion && GS.util.reducedMotion()); }
  function money(n) { return GS.core.fmtMoney(n * 100, true); }
  function ids() { return GS.charities.map(function (c) { return c.id; }); }
  function feedCtx() {
    var h = GS.live && GS.live.HANDLES && GS.live.HANDLES.length ? GS.live.HANDLES : ['Bot'];
    return { handles: h, charities: ids() };
  }

  /** Is the bar showing right now (on a page that has it, and not hidden by Stream Mode or a short window)? */
  function visible() { return !!el && !el.hidden && el.offsetParent !== null && !GS.app.state.stream; }

  /* ----------------------------------------------------------------- build */

  function build() {
    el = ui.$('#ticker');
    if (!el || built) { return; }
    built = true;
    el.innerHTML =
      '<p class="sr-only" id="tick-note">' + esc(NOTE) + '</p>' +
      '<div class="tick__total" title="' + esc(TIP) + '"><span class="tick__lbl">Given today</span> <b class="tick__amt" data-role="amt"></b>' +
        '<span class="botpill tick__sim"><span class="tick__sim-l">simulated</span><span class="tick__sim-s" aria-hidden="true">BOT</span></span></div>' +
      '<ol class="tick__feed" data-role="feed" tabindex="0" aria-label="Latest gifts from simulated players"></ol>' +
      '<button type="button" class="tick__btn" data-role="pause" aria-pressed="false" aria-label="Pause the ticker" title="Pause the ticker"></button>';
    el.setAttribute('aria-describedby', 'tick-note');
    paused = reduced();
    setPausedUI();
    ui.$('[data-role="pause"]', el).addEventListener('click', function () { setPaused(!paused); });
    // reading or pressing something in the bar must not have it change underneath: it waits until the pointer and the focus are away
    el.addEventListener('mouseenter', function () { held = true; });
    el.addEventListener('mouseleave', function () { held = false; });
    el.addEventListener('focusin', function () { held = true; });
    el.addEventListener('focusout', function (e) { if (!el.contains(e.relatedTarget)) { held = false; } });
  }

  function setPausedUI() {
    var b = ui.$('[data-role="pause"]', el);
    b.setAttribute('aria-pressed', String(paused));
    b.title = paused ? 'The ticker is paused. Press to start it again.' : 'Pause the ticker';
    b.innerHTML = GS.icon(paused ? 'play' : 'pause');
    el.classList.toggle('is-paused', paused);
  }

  function setPaused(on) {
    paused = !!on;
    setPausedUI();
    if (!paused) { renderAt(clock(), false); }
  }

  /* ---------------------------------------------------------------- paint */

  function itemHTML(f) {
    var ch = GS.charity(f.charityId);
    var name = ch ? (ch.short.length > 30 ? ch.name : ch.short) : '';
    return '<li class="tick__item"><span class="tick__who">' + ui.botChip(f.handle, { px: 16 }) + '<b>' + esc(f.handle) + '</b> ' +
      '<span class="botpill tick__bot" title="A simulated player">BOT</span></span> ' +
      '<span class="tick__what">gave <b>' + money(f.dollars) + '</b> to <span class="tick__ch">' + esc(name) + '</span></span></li>';
  }

  function paintTotal(now) {
    ui.$('[data-role="amt"]', el).textContent = money(T.givenToday(now));
    shown.minute = Math.floor(now.getTime() / 60000);
  }

  function paintFeed(now, animate) {
    var feed = ui.$('[data-role="feed"]', el);
    feed.innerHTML = T.feedAt(now, SHOWN, feedCtx()).map(itemHTML).join('');
    shown.slot = Math.floor(now.getTime() / T.SLOT_MS);
    // a new line slides in a few pixels (inside the list's clipped box: nothing resizes, and it is switched off in css for reduced motion as well)
    if (animate && !reduced()) {
      feed.classList.remove('is-fresh');
      void feed.offsetWidth;
      feed.classList.add('is-fresh');
    }
  }

  /** Draws the bar as it is at `date` (the total and the newest lines). Tests and demos call this with any date. */
  function renderAt(date, animate) {
    if (!built) { build(); }
    if (!el) { return; }
    paintTotal(date);
    paintFeed(date, animate);
  }

  /** A second has passed: put in a new line when a new 12-second slot has begun, and a new total when a new minute has. */
  function tick() {
    if (!visible() || document.hidden || paused || held) { return; }
    var now = clock();
    var slot = Math.floor(now.getTime() / T.SLOT_MS);
    var minute = Math.floor(now.getTime() / 60000);
    if (slot !== shown.slot) { paintFeed(now, true); }
    if (minute !== shown.minute) { paintTotal(now); }
  }

  /* ----------------------------------------------------------------- pages */

  /** The ticker belongs to the lobby and to the Live tables pages (the tiles and a game's table sizes); not to a game or a live table. */
  function showFor(r) {
    build();
    if (!el) { return; }
    // (live tables, and so the simulated crowd around them, only exist in demo mode: in real-donation mode there is no ticker)
    onPage = !!r && (r.view === 'lobby' || r.view === 'live') && GS.live.enabled();
    el.hidden = !onPage;
    if (onPage) {
      if (!paused) { renderAt(clock(), false); }      // a visit to the page shows the moment as it is now (a paused bar keeps what it had)
      else if (shown.slot < 0) { renderAt(clock(), false); }
      if (!timer) { timer = setInterval(tick, 1000); }
    }
  }

  GS.bus.on('route', showFor);

  ui.ticker = {
    renderAt: renderAt,
    setPaused: setPaused,
    isPaused: function () { return paused; },
    visible: visible,
    /** Moves the bar's clock on by `ms` (tests and demos only); the bar catches up at its next tick, unless it is paused or held. */
    skew: function (ms) { skewMs += ms; },
    now: clock
  };
})();
