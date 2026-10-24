/*
 * The card collection and the daily bonus wheel.
 *
 * Cards: every charity that wins a round for you (a game, a live table or a direct gift) goes in your collection. A card is
 * rarer the less likely that win was. A monthly set of six charities pays 150 XP when you have them all.
 *
 * Daily bonus wheel: one spin a day for free play credit (demo mode only; it is not a charity draw and nothing real moves).
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var ui = GS.ui;
  var U = GS.util;
  var store = GS.store;
  var esc = ui.esc;
  var $ = ui.$;
  var money = core.fmtMoney;

  var filter = 'owned';      // 'owned' | 'rare' | 'locked' | 'set'
  var cause = '';

  /* ------------------------------------------------------------------ cards */

  function cardHTML(ch, info, opts) {
    opts = opts || {};
    if (!info) {
      return '<div class="tcard is-locked" style="--c:' + ch.accent + '"><span class="tcard__mono" aria-hidden="true">?</span><b>' + (opts.reveal ? esc(ch.short) : 'Locked') + '</b><small>' + (opts.reveal ? 'Win it to collect it' : 'Not collected yet') + '</small></div>';
    }
    var c = GS.cause(ch.causes[0]);
    return '<button type="button" class="tcard tcard--' + info.rarity + '" data-open-charity="' + ch.id + '" style="--c:' + ch.accent + '" aria-label="' + esc(ch.name) + ', ' + info.rarity + ' card, ' + info.n + ' won">' +
      '<span class="tcard__rar">' + info.rarity + '</span>' +
      ui.mono(ch, 52) +
      '<b>' + esc(ch.short) + '</b><small>' + esc(c.name) + '</small>' +
      (info.n > 1 ? '<span class="tcard__n">×' + info.n + '</span>' : '') + '</button>';
  }

  function renderCards() {
    var root = $('#view-cards');
    var owned = store.cards();
    var ids = Object.keys(owned);
    var total = GS.charities.length;
    var month = core.monthKey();
    var setIds = core.monthlySet(GS.charities, month);
    var haveSet = setIds.filter(function (id) { return !!owned[id]; }).length;
    var claimed = !!store.get().setClaims[month];
    var byRar = { common: 0, rare: 0, epic: 0, legendary: 0 };
    ids.forEach(function (id) { byRar[owned[id].rarity] += 1; });

    var list;
    if (filter === 'set') { list = setIds; }
    else if (filter === 'locked') { list = GS.charities.map(function (c) { return c.id; }).filter(function (id) { return !owned[id]; }); }
    else if (filter === 'rare') { list = ids.filter(function (id) { return core.rarityRank(owned[id].rarity) >= 1; }); }
    else { list = ids; }
    if (cause) { list = list.filter(function (id) { return GS.charity(id).causes.indexOf(cause) >= 0; }); }
    list = list.slice().sort(function (a, b) {
      var ra = owned[a] ? core.rarityRank(owned[a].rarity) : -1;
      var rb = owned[b] ? core.rarityRank(owned[b].rarity) : -1;
      return rb - ra || (GS.charity(a).name.toLowerCase() < GS.charity(b).name.toLowerCase() ? -1 : 1);
    });
    var shown = list.slice(0, 120);

    var f = function (id, label) { return '<button type="button" class="chip' + (filter === id ? ' is-on' : '') + '" data-filter="' + id + '" aria-pressed="' + (filter === id) + '">' + label + '</button>'; };
    root.innerHTML =
      '<header class="page-head"><div><h1>Your cards</h1><p>Every charity that wins a round for you earns a card, whether it won a game you played, a live pot you were in or a gift you gave directly. The less likely the win, the rarer the card. Collect a set, earn XP.</p></div></header>' +
      '<div class="stats">' +
        '<div class="stat"><b>' + ids.length + ' of ' + ui.num(total) + '</b><span>Cards collected</span></div>' +
        '<div class="stat"><b>' + byRar.common + '</b><span>Common</span></div>' +
        '<div class="stat"><b>' + byRar.rare + '</b><span>Rare</span></div>' +
        '<div class="stat"><b>' + (byRar.epic + byRar.legendary) + '</b><span>Epic and legendary</span></div>' +
      '</div>' +
      '<section class="sect panel" aria-labelledby="cd-set"><div class="sect__head"><h2 class="sect__t" id="cd-set">This month’s set <small>' + month + '</small></h2><span class="tag tag--plain">' + (claimed ? 'complete, +150 XP paid' : haveSet + ' of 6') + '</span></div>' +
        '<p>Win all six charities this month for 150 XP and the Set Complete badge. A new set starts next month. Backing one of them with <b>Back a charity</b> puts it on the board if it was not there already. Putting it on the board is what gives it a chance (with 8 spots, 1 in 8 instead of 1 in over a thousand); once it is there, every charity on the board has equal odds.</p>' +
        '<div class="cardgrid">' + setIds.map(function (id) { return cardHTML(GS.charity(id), owned[id], { reveal: true }); }).join('') + '</div></section>' +
      '<section class="sect" aria-labelledby="cd-all"><div class="sect__head"><h2 class="sect__t" id="cd-all">Collection</h2></div>' +
        '<div class="chips" role="group" aria-label="Show">' + f('owned', 'Collected') + f('rare', 'Rare and better') + f('locked', 'Still to win') + f('set', 'This month’s set') + '</div>' +
        '<div class="field field--row"><label for="cd-cause" class="field__label">Cause</label><select id="cd-cause" class="input input--sm"><option value="">All causes</option>' +
          GS.causes.map(function (c) { return '<option value="' + c.id + '"' + (cause === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></div>' +
        (shown.length ? '<div class="cardgrid">' + shown.map(function (id) { return cardHTML(GS.charity(id), owned[id]); }).join('') + '</div>' +
          (list.length > shown.length ? '<p class="tabnote">Showing ' + ui.num(shown.length) + ' of ' + ui.num(list.length) + '. Use the filters to narrow it down.</p>' : '')
          : '<p class="empty">' + (filter === 'owned' ? 'No cards yet. Play any game, or take a seat at a live table, and the charity that wins is yours to collect.' : 'Nothing matches that filter.') + '</p>') +
      '</section>';
    ui.hydrate(root);
    root.onclick = function (e) {
      var b = e.target.closest('[data-filter]');
      if (b) { filter = b.getAttribute('data-filter'); renderCards(); }
    };
    $('#cd-cause', root).onchange = function () { cause = this.value; renderCards(); };
  }

  /* ------------------------------------------------------------- daily wheel */

  var SEGS = [5, 10, 5, 25, 10, 15, 50, 100];
  var WEIGHTS = [24, 20, 24, 8, 20, 12, 3, 1];
  var COLORS = ['#35d4ff', '#ffc542', '#ff5d9e', '#22f07a', '#9a7bff', '#ff8a3d', '#ff5a6e', '#7cf0c9'];
  var spinning = false;
  var dlg = null;

  function drawWheel(canvas) {
    var s = canvas.width;
    var ctx = canvas.getContext('2d');
    var c = s / 2;
    var step = Math.PI * 2 / SEGS.length;
    ctx.clearRect(0, 0, s, s);
    for (var i = 0; i < SEGS.length; i++) {
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.arc(c, c, c - 4, -Math.PI / 2 + i * step, -Math.PI / 2 + (i + 1) * step);
      ctx.closePath();
      ctx.fillStyle = COLORS[i];
      ctx.fill();
      ctx.strokeStyle = 'rgba(8,14,20,0.55)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.save();
      ctx.translate(c, c);
      ctx.rotate(-Math.PI / 2 + (i + 0.5) * step);
      ctx.fillStyle = '#0b1620';
      ctx.font = '800 ' + Math.round(s * 0.085) + 'px Sora, Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText('$' + SEGS[i], c - 18, 0);
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(c, c, s * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = '#0a1219';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffc542';
    ctx.stroke();
  }

  function pickSeg() {
    var total = WEIGHTS.reduce(function (a, b) { return a + b; }, 0);
    var r = core.randomFloat() * total;
    for (var i = 0; i < WEIGHTS.length; i++) { r -= WEIGHTS[i]; if (r < 0) { return i; } }
    return 0;
  }

  function openDaily() {
    if (!dlg) { dlg = ui.modal('daily'); }
    var avail = store.dailyAvailable();
    dlg.set(
      '<h2 class="modal__title" id="dlg-daily-title">Daily bonus wheel</h2>' +
      '<p class="modal__sub">One free spin a day for play credit. It is not a charity draw, and it is demo credit: nothing real moves.</p>' +
      '<div class="dwheel"><span class="dwheel__ptr" aria-hidden="true"></span><canvas class="dwheel__c" width="320" height="320" data-role="wheel" aria-hidden="true"></canvas></div>' +
      '<p class="dwheel__msg" data-role="msg" aria-live="polite">' + (avail ? 'Spin for $5 up to $100 of free credit.' : 'You have already spun today. Come back tomorrow for another go.') + '</p>' +
      '<button type="button" class="playbtn" data-role="spin"' + (avail ? '' : ' disabled') + '><span class="playbtn__main">' + ui.icon('gift') + '<span>Spin the wheel</span></span></button>'
    );
    var canvas = dlg.$('[data-role="wheel"]');
    drawWheel(canvas);
    var msg = dlg.$('[data-role="msg"]');
    var btn = dlg.$('[data-role="spin"]');
    btn.addEventListener('click', function () {
      if (spinning || !store.dailyAvailable()) { return; }
      spinning = true;
      btn.disabled = true;
      GS.audio.unlock();
      var idx = pickSeg();
      var step = 360 / SEGS.length;
      var target = 360 * 5 + (360 - (idx + 0.5) * step);
      var dur = U.dur(4200);
      canvas.style.transition = 'transform ' + dur + 'ms cubic-bezier(0.15, 0.7, 0.2, 1)';
      void canvas.offsetWidth;
      canvas.style.transform = 'rotate(' + target + 'deg)';
      GS.audio.whoosh();
      setTimeout(function () {
        var badges = store.claimDaily(SEGS[idx] * 100);
        spinning = false;
        GS.audio.coin();
        GS.audio.win();
        GS.confetti.celebrate(0.8);
        msg.textContent = 'You won $' + SEGS[idx] + ' of free credit! Come back tomorrow.';
        GS.bus.emit('balance');
        GS.bus.emit('progress');
        if (badges && badges.length) { GS.bus.emit('badges', badges); }
        refreshDot();
      }, dur + 80);
    });
    dlg.open();
  }

  function refreshDot() {
    var dot = $('#daily-dot');
    if (dot) { dot.hidden = !store.dailyAvailable(); }
    var b = $('#btn-daily');
    if (b) { b.setAttribute('aria-label', store.dailyAvailable() ? 'Daily bonus wheel, a free spin is ready' : 'Daily bonus wheel, already spun today'); }
  }

  function init() {
    var b = $('#btn-daily');
    if (!b) { return; }
    b.innerHTML = GS.icon('gift') + '<span class="daily__dot" id="daily-dot" aria-hidden="true"></span>';
    b.addEventListener('click', openDaily);
    refreshDot();
    GS.bus.on('progress', refreshDot);
  }

  ui.pages.cards = renderCards;
  ui.daily = { init: init, open: openDaily, refresh: refreshDot };
})();
