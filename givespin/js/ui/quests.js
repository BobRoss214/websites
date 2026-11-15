/*
 * Quests page (#quests): today's three quests and this week's three, the 30-tier season track, a small picker for card backs and confetti, the side-menu badge,
 * the toast when a quest is done, and a compact block on the lobby. All of the rules (what the quests are, what counts, the points, the rewards) are in js/quests.js;
 * this file draws them and does the claiming. Nothing here is money: rewards are a little XP and cosmetics.
 *
 *   - What is stored: GS.local 'quests' (claims, high-water marks, when the visitor was first seen, the season's round counts) and 'cosmetics' (what they own and chose).
 *     The main save is only ever changed by store.grantXp (the same call the daily wheel and the Charity Cup use), when a tier pays XP.
 *   - sync() runs after every save and on every route change: it brings the stored state up to date, toasts quests that were just finished (once each, and after
 *     the receipt is closed), and draws the badge. render() draws the page from the same numbers.
 *   - The emblem frames and profile titles from the track are added to the profile page's own lists (GS.profileFrames / GS.profileTitles); the card backs are
 *     CSS (css/quests.css, on face-down cards) and the confetti styles are read by js/confetti.js.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var ui = GS.ui;
  var core = GS.core;
  var Q = GS.quests;
  var store = GS.store;
  var cos = GS.cosmetics;
  var esc = ui.esc;
  var $ = ui.$;

  var KEY = 'quests';
  var busy = false;          // true while this file is claiming (a claim saves the game, which must not start another pass)
  var last = null;           // the latest numbers (Q.advance's view)
  var waiting = [];          // quests finished while a receipt was open: told about when it is closed
  var spot = { week: '', id: '' };

  /* ---------------------------------------------------------------- the numbers */

  function spotlightId() {
    var wk = core.weekKey(new Date());
    if (spot.week !== wk) {
      var cur = null;
      try { cur = GS.weekly ? GS.weekly.current(GS.charities, new Date()) : null; } catch (e) { cur = null; }
      spot = { week: wk, id: cur && cur.id ? cur.id : '' };
    }
    return spot.id;
  }

  function causesOf(id) { var ch = GS.charity(id); return ch ? ch.causes : []; }
  function demo() { return GS.payments.mode() === 'demo'; }
  function reduced() { return GS.util.reducedMotion(); }

  function inputNow() {
    var s = store.get();
    return {
      now: new Date(), history: s.history, save: s, counters: { verifies: s.verifies }, spotlightId: spotlightId(), causesOf: causesOf,
      live: !!(GS.live && GS.live.enabled && GS.live.enabled()), demo: demo(), owns: function (kind, id) { return cos.owns(kind, id); }
    };
  }

  /** Brings the stored state up to date and returns what Q.advance worked out. Writes only when something changed. */
  function run() {
    var out = Q.advance(GS.local.get(KEY, null), inputNow());
    if (out.changed) { GS.local.set(KEY, out.state); }
    last = out.view;
    return out;
  }

  function claimable() { return last ? last.claimable : 0; }

  /* ------------------------------------------------------------ the badge and the toast */

  function drawBadge() {
    var b = $('#quests-badge');
    if (!b) { return; }
    var n = claimable();
    b.hidden = n < 1;
    b.innerHTML = n > 0 ? esc(String(n)) + '<span class="sr-only"> ready to claim</span>' : '';
  }

  function tellNow(list) {
    if (!list.length) { return; }
    var text = list.length === 1 ? 'Quest done: ' + list[0].text + '. Claim it on the Quests page.' : list.length + ' quests done. Claim them on the Quests page.';
    ui.toast(text, 'list-checks');
  }

  function tell(list) {
    if (!list.length) { return; }
    var receipt = document.getElementById('dlg-result');
    if (receipt && receipt.open) { waiting = waiting.concat(list); return; }   // a toast would sit under the receipt: say it when the receipt is closed
    tellNow(list);
  }

  function sync() {
    if (busy || !store.get) { return; }
    var out = run();
    tell(out.view.fresh);
    setBack();   // "Erase my data" empties the cosmetics: the card back on the page must follow, not stay on the erased one until a reload
    drawBadge();
    refreshBlock();
    if (shown()) { renderIfIdle(); }
  }

  /* --------------------------------------------------------------- small pieces */

  function shown() { var v = $('#view-quests'); return !!v && !v.hidden; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  function bar(label, value, max, text) {
    var pct = max > 0 ? Math.max(0, Math.min(100, Math.round(value / max * 100))) : 0;
    return '<span class="bar qbar" role="progressbar" aria-label="' + esc(label) + '" aria-valuemin="0" aria-valuemax="' + max + '" aria-valuenow="' + value + '" aria-valuetext="' + esc(text) + '"><i style="width:' + pct + '%"></i></span>';
  }

  /** A little picture of a reward: an icon, a frame, a card back or a handful of confetti colours. */
  function artFor(r) {
    if (r.kind === 'xp') { return '<span class="qart qart--xp">' + ui.icon('sparkles') + '</span>'; }
    if (r.kind === 'title') { return '<span class="qart qart--title">' + ui.icon('award') + '</span>'; }
    if (r.kind === 'cardback') { return '<span class="qart qart--back" data-back="' + esc(r.id) + '"></span>'; }
    if (r.kind === 'confetti') {
      var st = Q.confettiStyle(r.id);
      return '<span class="qart qart--dots">' + st.colors.slice(0, 5).map(function (c, i) { return '<i style="background:' + c + '"' + (i % 2 ? ' class="is-hi"' : '') + '></i>'; }).join('') + '</span>';
    }
    if (r.kind === 'frame' && ui.profile && ui.profile.frameHTML) { return '<span class="qart qart--frame">' + ui.profile.frameHTML(r.id, '<span class="qdisc"></span>', 'pframe--sm') + '</span>'; }
    return '<span class="qart qart--xp">' + ui.icon('gift') + '</span>';
  }

  /* ------------------------------------------------------------------ the season */

  function tierLabel(t) {
    var s = 'Tier ' + t.tier + ', ' + t.reward.label + '. ';
    if (t.status === 'claimed') { return s + 'Claimed.'; }
    var dup = t.owned ? ' You already have it, so it pays ' + Q.DUPLICATE_XP + ' XP.' : '';
    if (t.status === 'ready') { return s + 'Ready to claim. Press to claim.' + dup; }
    return s + 'Locked. ' + plural(t.toGo, 'point', 'points') + ' to go.' + dup;
  }

  function tierHTML(t, nextTier) {
    var cls = 'qtier is-' + t.status + (t.tier === nextTier ? ' is-next' : '');
    var state = t.status === 'claimed' ? ui.icon('circle-check') + '<span>Claimed</span>' : t.status === 'ready' ? '<span>Claim</span>' : ui.icon('lock') + '<span>' + ui.num(t.toGo) + ' to go</span>';
    var what = t.reward.kind === 'xp' ? '+' + t.reward.xp + ' XP' : t.reward.name;
    var kind = t.reward.kind === 'xp' ? 'Bonus XP' : Q.KIND_NAMES[t.reward.kind].replace(/^./, function (c) { return c.toUpperCase(); });
    return '<li class="' + cls + '"><button type="button" class="qtier__btn" data-tier="' + t.tier + '" aria-disabled="' + (t.status === 'ready' ? 'false' : 'true') + '" aria-label="' + esc(tierLabel(t)) + '">' +
      '<span class="qtier__n" aria-hidden="true">' + t.tier + '</span>' +
      '<span class="qtier__art" aria-hidden="true">' + artFor(t.reward) + '</span>' +
      '<span class="qtier__txt" aria-hidden="true"><b>' + esc(what) + '</b><small>' + esc(kind) + (t.owned && t.status !== 'claimed' ? ' · have it' : '') + '</small></span>' +
      '<span class="qtier__state" aria-hidden="true">' + state + '</span></button></li>';
  }

  function seasonHTML(v) {
    var s = v.season;
    var next = s.maxed ? 0 : s.nextTier;
    var claimedCount = s.tiers.filter(function (t) { return t.status === 'claimed'; }).length;
    var head = s.headStart.points > 0
      ? '<p class="qseason__head">' + ui.icon('sparkles') + '<span>You joined with ' + plural(s.headStart.missed, 'day', 'days') + ' of the season gone, so you started with a head start of <b>' + ui.num(s.headStart.points) + ' points</b>.</span></p>' : '';
    var barText = s.maxed ? 'All 30 tiers reached' : s.into + ' of ' + s.need + ' points to tier ' + next;
    return '<section class="sect panel qseason" aria-labelledby="q-season-h">' +
      '<div class="qseason__top"><div><p class="qseason__eyebrow">Season · ' + esc(s.month) + '</p><h2 class="sect__t" id="q-season-h">' + esc(s.name) + '</h2>' +
        '<p class="qseason__ends">' + ui.icon('clock') + '<span>' + esc(s.endsText) + '</span></p></div>' +
        '<div class="qseason__stats"><div class="qstat"><b>' + s.tier + ' <small>of ' + Q.TIER_COUNT + '</small></b><span>Tier</span></div>' +
        '<div class="qstat"><b>' + ui.num(s.points) + '</b><span>Points</span></div>' +
        '<div class="qstat"><b>' + claimedCount + '</b><span>Claimed</span></div></div></div>' +
      '<div class="qseason__bar">' + bar(s.maxed ? 'Season track' : 'Points to tier ' + next, s.maxed ? s.need : s.into, s.need, barText) + '<span class="qseason__bartxt">' + esc(barText) + '</span></div>' +
      head +
      '<div class="qseason__act">' +
        (v.claimable ? '<button type="button" class="btn btn--green" data-act="claim-all">' + ui.icon('gift') + 'Claim ' + (v.claimable === 1 ? 'the 1 reward' : 'all ' + v.claimable + ' rewards') + '</button>' : '') +
        '<button type="button" class="btn btn--sm" data-act="jump">' + ui.icon('flag-triangle-right') + 'Go to my tier</button></div>' +
      '<ol class="qtrack" role="list" aria-label="Season track, 30 tiers" data-role="track">' + s.tiers.map(function (t) { return tierHTML(t, next); }).join('') + '</ol>' +
      '<p class="qseason__note">Rounds earn ' + Q.POINTS.round + ' points each (the first ' + Q.ROUND_CAP + ' a day), a daily quest ' + Q.POINTS.daily + ' and a weekly one ' + Q.POINTS.weekly + '. Every ' + Q.TIER_POINTS + ' points opens a tier.</p>' +
    '</section>';
  }

  /* ------------------------------------------------------------------- quests */

  function questHTML(q) {
    var text = q.value + ' of ' + q.target;
    var act = q.claimed ? '<span class="tag tag--plain qdone">' + ui.icon('circle-check') + 'Claimed</span>'
      : q.done ? '<button type="button" class="btn btn--green btn--sm" data-claim-quest="' + esc(q.key) + '" aria-label="Claim: ' + esc(q.text) + '. Adds ' + q.points + ' season points">Claim +' + q.points + '</button>'
      : '<span class="qpts">+' + q.points + ' points</span>';
    return '<li class="qcard' + (q.claimed ? ' is-claimed' : q.done ? ' is-done' : '') + '" tabindex="-1" data-key="' + esc(q.key) + '">' +
      '<div class="qcard__main"><b class="qcard__t">' + esc(q.text) + '</b>' + bar(q.text, q.value, q.target, text) + '<span class="qcard__n">' + esc(text) + '</span></div>' +
      '<div class="qcard__act">' + act + '</div></li>';
  }

  function questsHTML(v) {
    var weekEnds = 'Resets Monday';
    return '<div class="twocol qquests">' +
      '<section class="sect panel" aria-labelledby="q-day-h"><div class="sect__head"><h2 class="sect__t" id="q-day-h">Today’s quests</h2><span class="tag tag--plain">Resets at midnight</span></div>' +
        '<ul class="qlist" data-role="daily">' + v.daily.map(questHTML).join('') + '</ul></section>' +
      '<section class="sect panel" aria-labelledby="q-week-h"><div class="sect__head"><h2 class="sect__t" id="q-week-h">This week’s quests</h2><span class="tag tag--plain">' + weekEnds + '</span></div>' +
        '<ul class="qlist" data-role="weekly">' + v.weekly.map(questHTML).join('') + '</ul></section></div>';
  }

  /* --------------------------------------------------------------- cosmetics */

  function pickHTML(kind, title, note, items, current) {
    return '<fieldset class="pick qpick" data-kind="' + kind + '"><legend class="field__label">' + esc(title) + '</legend><p class="qpick__note">' + esc(note) + '</p><div class="pick__grid">' +
      items.map(function (it) {
        var own = cos.owns(kind, it.id);
        var art = kind === 'cardback' ? '<span class="qart qart--back" data-back="' + esc(it.id) + '"></span>' : artFor({ kind: 'confetti', id: it.id });
        var tier = Q.tierOf(kind, it.id);
        return '<label class="pickcard' + (own ? '' : ' is-locked') + (current === it.id ? ' is-on' : '') + '">' +
          '<input type="radio" name="q-' + kind + '" value="' + esc(it.id) + '"' + (current === it.id ? ' checked' : '') + (own ? '' : ' disabled') + '>' +
          '<span class="pickcard__art" aria-hidden="true">' + art + '</span>' +
          '<span class="pickcard__t"><b>' + esc(it.name) + '</b><small>' + esc(it.description) + '</small>' +
          (own ? '' : '<small class="pickcard__lock">' + ui.icon('lock') + '<span>Locked. How to unlock: reach tier ' + tier + ' of the season track.</span></small>') + '</span></label>';
      }).join('') + '</div></fieldset>';
  }

  function cosmeticsHTML() {
    var tryBtn = reduced() ? '' : '<button type="button" class="btn btn--sm" data-act="try-confetti">' + ui.icon('party-popper') + 'Try the confetti</button>';
    return '<section class="sect panel" aria-labelledby="q-cos-h"><h2 class="sect__t" id="q-cos-h">Your cosmetics</h2>' +
      '<p class="qcos__intro">Free things you have unlocked on the track. Emblem frames and profile titles are worn from <a href="#me">your profile</a>. Card backs show on face-down cards (in Pick a Card and on your cards page) and the confetti style is used whenever there is a celebration.</p>' +
      '<div data-role="cos">' + pickHTML('cardback', 'Card back', 'Shown on face-down cards.', Q.CARD_BACKS, cos.active('cardback')) +
      pickHTML('confetti', 'Confetti style', 'Used for every celebration.', Q.CONFETTI, cos.active('confetti')) + '</div>' +
      (tryBtn ? '<div class="qcos__act">' + tryBtn + '</div>' : '') + '</section>';
  }

  function howHTML() {
    return '<section class="sect panel qhow" aria-labelledby="q-how-h"><h2 class="sect__t" id="q-how-h">How quests work</h2>' +
      '<p>Every day has three quests and every week three bigger ones. They are the same for everyone and picked from the date, so there is nothing to sign up for. Finish one, press <b>Claim</b>, and it adds season points: ' + Q.POINTS.daily + ' for a daily, ' + Q.POINTS.weekly + ' for a weekly.</p>' +
      '<p>Every round you play adds ' + Q.POINTS.round + ' points too (the first ' + Q.ROUND_CAP + ' of each day), whatever the size of the gift: points come from playing and finishing quests, never from how much you give. Every ' + Q.TIER_POINTS + ' points opens the next of ' + Q.TIER_COUNT + ' tiers. A new season starts on the 1st of each month.</p>' +
      '<p>Each tier has a free reward: a little bonus XP, an emblem frame, a profile title, a card back or a confetti style. If you already have a cosmetic, it pays ' + Q.DUPLICATE_XP + ' XP instead.</p>' +
      '<p>Joined late? Every day of the season gone before you arrive is worth ' + Q.CATCHUP_PER_DAY + ' points, up to ' + Q.CATCHUP_MAX + ', so tier 10 is only a few days of play away.</p>' +
      '<p><b>No money, ever.</b> Nothing here pays out, can be bought or turns into anything with a cash value. XP is play, and in demo mode the dollars are pretend too.</p></section>';
  }

  /* ---------------------------------------------------------------- the page */

  function pageHTML(v) {
    return '<header class="page-head"><div><h1>Quests</h1><p>Little goals for big hearts. New quests every day and every week, a ' + Q.TIER_COUNT + '-tier season track and rewards that are all free. No money, ever.</p></div></header>' +
      seasonHTML(v) + questsHTML(v) + cosmeticsHTML() + howHTML();
  }

  var wiredRoot = null;

  /**
   * Draws the page. `focus` is a selector to put keyboard focus on afterwards, `keep` true when this is a re-draw of the page the visitor is already on (after a claim,
   * or because something changed in the background): the strip then stays exactly where it was, so the tier under the pointer does not slide away between two clicks.
   * On the first draw of a visit the strip is centred on the visitor's tier (unless they asked for reduced motion).
   */
  function render(focus, keep) {
    var root = $('#view-quests');
    if (!root) { return; }
    if (!last) { run(); }
    var old = keep ? $('[data-role="track"]', root) : null;
    var left = old ? old.scrollLeft : 0;
    root.innerHTML = pageHTML(last);
    var track = $('[data-role="track"]', root);
    if (track) {
      ui.rove(track, '.qtier__btn');
      var all = Array.prototype.slice.call(track.querySelectorAll('.qtier__btn'));
      var start = track.querySelector('.qtier.is-ready .qtier__btn') || track.querySelector('.qtier.is-next .qtier__btn') || all[all.length - 1];
      all.forEach(function (b) { b.tabIndex = b === start ? 0 : -1; });
      if (old) { track.scrollLeft = left; } else if (!reduced()) { centre(track, start, 'auto'); }
    }
    if (!wiredRoot) { wiredRoot = root; wire(root); }
    if (focus) {
      var el = root.querySelector(focus);
      if (el) { try { el.focus({ preventScroll: true }); } catch (e) { /* not focusable */ } }
    }
    drawBadge();
  }

  /** Re-draws the page unless the visitor is in the middle of using it (focus inside), so a change in the background never takes their place away. */
  function renderIfIdle() {
    var root = $('#view-quests');
    if (root && !root.contains(document.activeElement)) { render('', true); }
  }

  /** Scrolls the track so `btn` is in view: along the strip on a wide screen, down the list on a phone. Only the track moves, never the page, unless asked for. */
  function centre(track, btn, behavior) {
    if (!btn) { return; }
    if (track.scrollWidth > track.clientWidth + 4) {
      // (measured from the track itself: the track is not a positioned box, so `offsetLeft` counts from a far ancestor and put the wrong tier in the middle, or none at all on a very wide window)
      var left = btn.parentNode.getBoundingClientRect().left - track.getBoundingClientRect().left + track.scrollLeft - (track.clientWidth - btn.parentNode.offsetWidth) / 2;
      if (track.scrollTo) { track.scrollTo({ left: Math.max(0, left), behavior: behavior }); } else { track.scrollLeft = Math.max(0, left); }
    }
  }

  /* ---------------------------------------------------------------- claiming */

  function giveReward(r) {
    if (r.kind === 'xp') {
      var g = store.grantXp(r.xp);
      if (g.newBadges && g.newBadges.length) { GS.bus.emit('badges', g.newBadges); }
      return g;
    }
    cos.unlock(r.kind, r.id);
    return null;
  }

  function rewardToast(r) {
    if (r.kind === 'xp') { return r.duplicate ? 'You already had ' + r.was.name + ', so it paid ' + r.xp + ' XP.' : '+' + r.xp + ' XP from the season track.'; }
    var where = r.kind === 'frame' || r.kind === 'title' ? ' Wear it from your profile.' : r.kind === 'cardback' ? ' Choose it in Your cosmetics.' : ' Choose it in Your cosmetics.';
    return 'You unlocked the ' + r.label + '.' + where;
  }

  function celebrate() {
    try { GS.audio.badge(); } catch (e) { /* silent */ }
    if (!reduced() && GS.confetti) { GS.confetti.burst({ count: 50, power: 760 }); }
  }

  function claimTier(n) {
    var c;
    busy = true;
    try {
      c = Q.claimTier(GS.local.get(KEY, null), inputNow(), n);
      if (!c.ok) { return; }
      GS.local.set(KEY, c.state);                   // the claim is written first, so it can never be paid twice
      giveReward(c.reward);
    } finally { busy = false; }
    ui.toast(rewardToast(c.reward), c.reward.kind === 'xp' ? 'sparkles' : 'gift');
    celebrate();
    GS.bus.emit('progress');
    afterClaim('.qtier__btn[data-tier="' + n + '"]');
  }

  function claimQuest(key) {
    var c;
    busy = true;
    try {
      c = Q.claimQuest(GS.local.get(KEY, null), inputNow(), key);
      if (!c.ok) { return; }
      GS.local.set(KEY, c.state);
    } finally { busy = false; }
    ui.toast('Quest claimed: +' + c.points + ' season points.', 'list-checks');
    afterClaim('.qcard[data-key="' + key + '"]');
  }

  function claimAll() {
    var res;
    var gain = 0;
    busy = true;
    try {
      var input = inputNow();
      input.give = function (r) { var g = giveReward(r); if (g) { gain += r.xp; } };
      res = Q.claimAll(GS.local.get(KEY, null), input);
      GS.local.set(KEY, res.state);
    } finally { busy = false; }
    if (!res.quests.length && !res.tiers.length) { return; }
    var bits = [];
    if (res.quests.length) { bits.push(plural(res.quests.length, 'quest', 'quests')); }
    if (res.tiers.length) { bits.push(plural(res.tiers.length, 'tier reward', 'tier rewards')); }
    ui.toast('Claimed ' + bits.join(' and ') + (gain ? ', with ' + gain + ' bonus XP' : '') + '.', 'gift');
    celebrate();
    GS.bus.emit('progress');
    afterClaim('[data-act="jump"]');
  }

  function afterClaim(focus) {
    run();
    drawBadge();
    refreshBlock();
    render(focus, true);
  }

  /* --------------------------------------------------------------- the events */

  function setBack() { document.body.setAttribute('data-cardback', cos.active('cardback')); }

  function wire(root) {
    root.addEventListener('click', function (e) {
      var tb = e.target.closest('.qtier__btn');
      if (tb) { if (tb.getAttribute('aria-disabled') !== 'true') { claimTier(Number(tb.getAttribute('data-tier'))); } return; }
      var cq = e.target.closest('[data-claim-quest]');
      if (cq) { claimQuest(cq.getAttribute('data-claim-quest')); return; }
      var act = e.target.closest('[data-act]');
      if (!act) { return; }
      var what = act.getAttribute('data-act');
      if (what === 'claim-all') { claimAll(); }
      else if (what === 'jump') {
        var track = $('[data-role="track"]', root);
        var btn = track && (track.querySelector('.qtier.is-ready .qtier__btn') || track.querySelector('.qtier.is-next .qtier__btn') || track.querySelector('.qtier:last-child .qtier__btn'));
        if (!btn) { return; }
        Array.prototype.forEach.call(track.querySelectorAll('.qtier__btn'), function (b) { b.tabIndex = b === btn ? 0 : -1; });
        if (track.scrollWidth > track.clientWidth + 4) { centre(track, btn, reduced() ? 'auto' : 'smooth'); }
        else { btn.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }); }
        btn.focus({ preventScroll: true });
      } else if (what === 'try-confetti' && GS.confetti && !reduced()) { GS.confetti.burst({ count: 70, power: 800 }); }
    });
    root.addEventListener('change', function (e) {
      var inp = e.target;
      if (!inp.matches || !inp.matches('.qpick input[type="radio"]')) { return; }
      var kind = inp.closest('.qpick').getAttribute('data-kind');
      if (cos.setActive(kind, inp.value)) {
        setBack();
        var it = Q.itemOf(kind, inp.value);
        ui.toast((kind === 'cardback' ? 'Card back' : 'Confetti style') + ': ' + (it ? it.name : '') + '.', kind === 'cardback' ? 'layers' : 'party-popper');
        var box = $('[data-role="cos"]', root);
        if (box) { box.innerHTML = pickHTML('cardback', 'Card back', 'Shown on face-down cards.', Q.CARD_BACKS, cos.active('cardback')) + pickHTML('confetti', 'Confetti style', 'Used for every celebration.', Q.CONFETTI, cos.active('confetti')); }
        var again = root.querySelector('.qpick[data-kind="' + kind + '"] input:checked');
        if (again) { again.focus({ preventScroll: true }); }
      }
    });
  }

  /* ---------------------------------------------------------- the lobby block */

  function blockHTML() {
    if (!last) { run(); }
    var v = last;
    var done = v.daily.filter(function (q) { return q.done; }).length;
    var s = v.season;
    var ready = v.claimable ? '<span class="qblock__ready">' + plural(v.claimable, 'reward', 'rewards') + ' to claim</span>' : '';
    return '<div class="qblock"><span class="qblock__ico" aria-hidden="true">' + ui.icon('list-checks') + '</span>' +
      '<div class="qblock__txt"><h2 class="sect__t">Quests</h2><p>Today: <b>' + done + ' of ' + v.daily.length + '</b> done · Season tier <b>' + s.tier + '</b> of ' + Q.TIER_COUNT + ' · ' + esc(s.endsText) + '. ' + ready + '</p></div>' +
      '<a class="btn btn--sm" href="#quests">Open quests</a></div>';
  }

  var blockEl = null;
  function refreshBlock() { if (blockEl && blockEl.isConnected) { blockEl.innerHTML = blockHTML(); } }

  ui.lobby.addBlock({
    id: 'quests', order: 40, label: 'Quests',
    mount: function (el) { blockEl = el; el.innerHTML = blockHTML(); },
    refresh: function (el) { blockEl = el; el.innerHTML = blockHTML(); }
  });

  /* ----------------------------------- frames and titles for the profile page */

  var ART = {
    marquee: function () {
      var out = '<circle class="s" cx="50" cy="50" r="40.5" stroke-width="1.4"/>';
      for (var k = 0; k < 20; k++) {
        var a = k * 18 * Math.PI / 180;
        out += '<circle class="' + (k % 2 ? 'fa' : 'f') + '" cx="' + (50 + 45 * Math.sin(a)).toFixed(1) + '" cy="' + (50 - 45 * Math.cos(a)).toFixed(1) + '" r="2.6"/>';
      }
      return out;
    },
    chip: function () {
      return '<circle class="s" cx="50" cy="50" r="44" stroke-width="7" stroke-dasharray="11.52 11.52"/><circle class="a" cx="50" cy="50" r="44" stroke-width="7" stroke-dasharray="11.52 11.52" stroke-dashoffset="11.52"/>' +
        '<circle class="s" cx="50" cy="50" r="39.2" stroke-width="1.2"/>';
    },
    suits: function () {
      var heart = 'M0 4.2 C-5.2 0.8 -4.6 -3.8 -2.2 -3.8 C-1 -3.8 0 -3 0 -2 C0 -3 1 -3.8 2.2 -3.8 C4.6 -3.8 5.2 0.8 0 4.2Z';
      var diamond = 'M0 -4.8 L3.8 0 L0 4.8 L-3.8 0Z';
      var spade = 'M0 -4.6 C-5.2 0 -4.6 2.6 -2.3 2.6 C-1.1 2.6 -0.4 2 0 1.3 L-1.3 4.6 L1.3 4.6 L0 1.3 C0.4 2 1.1 2.6 2.3 2.6 C4.6 2.6 5.2 0 0 -4.6Z';
      var club = 'M-1 4.6 L0 1.2 L1 4.6Z M0 -4.6 a2.2 2.2 0 1 0 0.01 0Z M-2.4 0.1 a2.2 2.2 0 1 0 0.01 0Z M2.4 0.1 a2.2 2.2 0 1 0 0.01 0Z';
      var at = [[50, 5.5, heart, 'fa'], [94.5, 50, diamond, 'f'], [50, 94.5, club, 'fa'], [5.5, 50, spade, 'f']];
      return '<circle class="s" cx="50" cy="50" r="40.5" stroke-width="1.6"/><circle class="a" cx="50" cy="50" r="37" stroke-width="0.7" opacity="0.6"/>' +
        at.map(function (p) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="9" fill="#0b161f" stroke="none"/><path class="' + p[3] + '" transform="translate(' + p[0] + ' ' + p[1] + ') scale(1.5)" d="' + p[2] + '"/>'; }).join('');
    },
    clover: function () {
      var leaf = 'M0 5 C-6.4 1.2 -5.4 -4.6 -2.6 -4.6 C-1.2 -4.6 0 -3.6 0 -2.4 C0 -3.6 1.2 -4.6 2.6 -4.6 C5.4 -4.6 6.4 1.2 0 5Z';
      var out = '<circle class="s" cx="50" cy="50" r="39.5" stroke-width="1.8"/>';
      for (var k = 0; k < 4; k++) {
        var deg = 45 + k * 90;
        var a = deg * Math.PI / 180;
        var x = 50 + 44 * Math.sin(a);
        var y = 50 - 44 * Math.cos(a);
        out += '<path class="' + (k % 2 ? 'fa' : 'f') + '" transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + deg + ') scale(1.9)" d="' + leaf + '"/>';
      }
      return out + '<circle class="a" cx="50" cy="50" r="36" stroke-width="0.7" opacity="0.6"/>';
    },
    ribbon: function () {
      return '<circle class="s" cx="50" cy="50" r="43" stroke-width="2.6"/><circle class="a" cx="50" cy="50" r="38.8" stroke-width="0.8" opacity="0.6"/>' +
        '<g transform="translate(50 7) scale(1.7) translate(-50 -7)"><path class="fa" d="M50 7 C43 -1 31 0 33 6 C35 11 44 10 50 7Z"/><path class="fa" d="M50 7 C57 -1 69 0 67 6 C65 11 56 10 50 7Z"/>' +
        '<path class="f" d="M48 8 L41 20 L46 17 L48 22Z"/><path class="f" d="M52 8 L59 20 L54 17 L52 22Z"/><circle class="f" cx="50" cy="7" r="3.3"/></g>';
    },
    crown: function () {
      return '<circle class="s" cx="50" cy="50" r="43" stroke-width="2.2"/><circle class="a" cx="50" cy="50" r="38.8" stroke-width="0.8" opacity="0.6"/>' +
        '<g transform="translate(50 10) scale(1.7) translate(-50 -10)"><path class="fa" d="M35 10 L38 -1.5 L44 5.5 L50 -4 L56 5.5 L62 -1.5 L65 10Z"/><rect class="f" x="35" y="9" width="30" height="4.2" rx="1.6"/>' +
        '<circle class="f" cx="38" cy="-1.5" r="1.9"/><circle class="f" cx="62" cy="-1.5" r="1.9"/><circle class="f" cx="50" cy="-4" r="2.1"/></g>';
    }
  };

  function howTier(kind, id) { return 'Reach tier ' + Q.tierOf(kind, id) + ' of the season track, on the Quests page.'; }

  function register() {
    if (GS.profileFrames) {
      Q.FRAMES.forEach(function (f) {
        GS.profileFrames.add({ id: f.id, name: f.name, description: f.description, how: howTier('frame', f.id), unlocked: function () { return cos.owns('frame', f.id); }, art: ART[f.id] });
      });
    }
    if (GS.profileTitles) {
      Q.TITLES.forEach(function (t) {
        GS.profileTitles.add({ id: t.id, name: t.name, description: t.description, how: howTier('title', t.id), unlocked: function () { return cos.owns('title', t.id); } });
      });
    }
  }
  register();

  /* ------------------------------------------------------------------ boot */

  ui.pages['quests'] = function () { run(); render(); };

  ui.quests = { view: function () { return last; }, sync: sync, claimable: claimable, render: render };

  store.onChange(function () { sync(); });
  GS.bus.on('route', function () { sync(); });
  GS.bus.on('progress', function () { sync(); });
  GS.bus.on('receipt:closed', function () { if (waiting.length) { var list = waiting; waiting = []; tellNow(list); } });
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', setBack); } else { setBack(); }
})();
