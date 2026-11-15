/*
 * Leaderboards (#boards): top crews, top charities and top players, for this week and for all time, always with the visitor's own row.
 * js/boards.js has the numbers. Every other name on these boards is a bot (simulated: the page says so in a note, in every label and in the BOT pill
 * next to each name), and their numbers are made up. Nothing is saved: the page is drawn from the clock and from the visitor's own saved history.
 *
 *   - three tabs (Crews, Charities, Players: a real tablist, arrow keys, Home and End) and a This week / All time toggle (buttons with aria-pressed);
 *   - each list is a real table (th scope), top 10, then the visitor's own row at its real rank when it is further down;
 *   - crews show a weekly goal as a progress bar with the words "$X of $Y"; a visitor with no crew can join one from here (the same call the Crews page uses);
 *   - "Share my crew" draws a picture on a canvas (same frame style as the share cards in js/ui/sharecard.js; the drawing code is repeated here because
 *     that file exports no drawing helpers) and shows it in a dialog with Download, Share and Copy;
 *   - a lobby block, "This week's leaders" (top three crews), through ui.lobby.addBlock.
 *
 *   ui.boards.render() draws the page; .openShare() the crew card; .last() / .canvas() what the card dialog shows (tests); .data(date) the three boards at a moment.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var ui = GS.ui;
  var esc = ui.esc;
  var store = GS.store;
  var B = GS.boards;
  var share = GS.share;

  var TABS = [['crews', 'Crews'], ['charities', 'Charities'], ['players', 'Players']];
  var RANGES = [['week', 'This week'], ['all', 'All time']];
  var tab = 'crews';
  var range = 'week';

  var T = {
    lede: 'The high-roller board, where all that is on the line is giving. Crews, charities and players, this week and all time.',
    sim: '<b>Simulated players.</b> Every other name on these boards is a bot standing in for a real person, and their numbers are made up. Yours come from your own gifts on this device. Nothing here costs or pays real money.',
    simCheckout: ' In real-donation mode your gifts finish on the charity’s checkout page, so your numbers count what you sent to checkout.',
    tabsLabel: 'Leaderboards (simulated players)',
    rangeLabel: 'Show',
    bot: 'BOT',
    botTip: 'A simulated player',
    crewBotTip: 'Every member of this crew is a simulated player',
    cappedNote: 'Counted from your latest 60 rounds, which is all this device keeps of this week.'
  };

  function demo() { return GS.payments && GS.payments.mode() === 'demo'; }

  var m = B.money;   // amounts: cents under $1,000, whole dollars from there on

  function botPill(tip) { return '<span class="botpill" title="' + esc(tip || T.botTip) + '">' + T.bot + '</span>'; }

  function dayText(d) { return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  function weekText(info) { return dayText(info.start) + ' to ' + dayText(new Date(info.end.getFullYear(), info.end.getMonth(), info.end.getDate() - 1)); }

  /* ----------------------------------------------------------------- data */

  function ctx(now) {
    var s = store.get();
    var sp = GS.weekly && GS.weekly.current ? GS.weekly.current(GS.charities, now) : null;
    return {
      handles: GS.live && GS.live.HANDLES ? GS.live.HANDLES : [],
      crews: GS.crews.CREWS,
      charityIds: GS.charities.map(function (c) { return c.id; }),
      spotlightId: sp && sp.id ? sp.id : '',
      me: B.mine({ history: s.history, totalCents: s.totalCents, charityCounts: s.charityCounts, crew: store.crew() }, now)
    };
  }

  function youName() { return ui.chosenName ? ui.chosenName() || 'You' : 'You'; }

  /* ----------------------------------------------------------------- tables */

  function rankCell(n) {
    return '<td class="bd__rank"><span class="bd__n bd__n--' + (n <= 3 ? n : 'x') + '">' + n + '</span></td>';
  }

  function table(label, who, body, extra, cls) {
    return '<div class="bd__tablewrap"><table class="bd__table' + (cls ? ' ' + cls : '') + '" aria-label="' + esc(label) + '">' +
      '<colgroup><col class="bd__c1"><col><col class="bd__c3"></colgroup>' +
      '<thead><tr><th scope="col" class="bd__rank"><span aria-hidden="true">#</span><span class="sr-only">Rank</span></th><th scope="col">' + esc(who[0]) + '</th><th scope="col" class="bd__amt">' + esc(who[1]) + '</th></tr></thead>' +
      '<tbody>' + body + '</tbody>' + (extra ? '<tbody class="bd__extra">' + extra + '</tbody>' : '') + '</table></div>';
  }

  function headHTML(title, info, weekly) {
    return '<div class="bd__head"><h2 class="sect__t" id="bd-h" tabindex="-1">' + esc(title) + '</h2>' +
      '<span class="tag tag--plain">' + (weekly ? esc(weekText(info)) + ' · ends in ' + esc(B.timeLeft(info.msLeft)) : 'All-time totals') + '</span></div>';
  }

  /* ----- crews */

  function crewRow(r, weekly, hasCrew) {
    var goal = '';
    if (weekly && r.goal) {
      var words = m(r.cents) + ' of ' + m(r.goal);
      goal = '<span class="bd__goal"><span class="bd__bar' + (r.reached ? ' is-done' : '') + '" role="progressbar" aria-label="' + esc(r.name) + ' weekly goal" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + r.pct + '" aria-valuetext="' + esc(words) + '"><i style="width:' + r.pct + '%"></i></span>' +
        '<span class="bd__goalt">' + esc(words) + (r.reached ? ' · goal reached' : '') + '</span></span>';
    }
    var join = !hasCrew ? '<button type="button" class="btn btn--sm bd__join" data-join="' + esc(r.id) + '" aria-label="Join ' + esc(r.name) + '">' + ui.icon('plus') + 'Join</button>' : '';
    return '<tr class="bd__row' + (r.member ? ' is-you' : '') + '" data-crew="' + esc(r.id) + '">' + rankCell(r.rank) +
      '<th scope="row" class="bd__who"><span class="bd__nm"><b>' + esc(r.name) + '</b>' + botPill(T.crewBotTip) + (r.member ? '<span class="bd__tag">Your crew</span>' : '') + join + '</span>' +
      '<small class="bd__sub">' + r.members + ' bot members' + (r.member ? ' and you' : '') + '</small>' + goal + '</th>' +
      '<td class="bd__amt"><span class="bd__v">' + m(r.cents) + '</span>' + (r.youCents ? '<small>' + m(r.youCents) + ' from you</small>' : '') + '</td></tr>';
  }

  function crewsPanel(now, c) {
    var weekly = range === 'week';
    var b = B.crews(range, now, c);
    var info = B.weekInfo(now);
    var mine = b.you;
    var strip;
    if (mine) {
      strip = '<div class="bd__mine"><p>You are in <b>' + esc(mine.name) + '</b>, #' + mine.rank + ' ' + (weekly ? 'this week' : 'of all time') + '. Your gifts count towards its total' + (weekly ? ' and its weekly goal' : '') + '.</p>' +
        '<div class="bd__act"><button type="button" class="btn btn--green btn--sm" data-role="share-crew">' + ui.icon('share-2') + 'Share my crew</button>' +
        '<a class="btn btn--sm" href="#crews">' + ui.icon('users') + 'Crew chat</a></div></div>';
    } else {
      strip = '<div class="bd__mine"><p>No crew yet. Every table needs a few friends. Join one below and your gifts fill its ' + (weekly ? 'weekly goal' : 'total') + '. Every crewmate is a bot, and you can leave any time on the <a href="#crews">Crews page</a>.</p></div>';
    }
    var rows = b.rows.map(function (r) { return crewRow(r, weekly, !!mine); }).join('');
    return headHTML('Top crews ' + (weekly ? 'this week' : 'of all time'), info, weekly) +
      '<p class="bd__lede">A crew’s total is what its bot members gave, added up' + (mine ? ', plus your own gifts' : ' (and your gifts, once you join)') + '. ' + (weekly ? 'Each crew has a goal for the week, and a new week starts every Monday.' : 'These all-time totals are made up and stay put; your own total is added to your crew.') + '</p>' +
      strip + table('Top crews ' + (weekly ? 'this week' : 'of all time') + '. Simulated crews: every member is a bot.', ['Crew', weekly ? 'Given' : 'Given in all'], rows);
  }

  /* ----- charities */

  function charityRow(r) {
    var ch = GS.charity(r.id);
    if (!ch) { return ''; }
    return '<tr class="bd__row' + (r.you ? ' has-you' : '') + '" style="--c:' + ch.accent + '">' + rankCell(r.rank) +
      '<th scope="row" class="bd__who"><button type="button" class="bd__ch" data-open-charity="' + esc(ch.id) + '" aria-label="About ' + esc(ch.name) + ' (opens its profile)">' + ui.mono(ch, 28) + '<span>' + esc(ch.short) + '</span></button>' +
      (r.spot || r.you ? '<span class="bd__tags">' + (r.spot ? '<span class="tag tag--plain">Charity of the week</span>' : '') + (r.you ? '<span class="bd__tag">You backed it ' + r.you + (r.you === 1 ? ' time' : ' times') + '</span>' : '') + '</span>' : '') + '</th>' +
      '<td class="bd__amt"><span class="bd__v">' + ui.num(r.count) + '</span>' + (r.you ? '<small>' + ui.num(r.you) + ' from you</small>' : '') + '</td></tr>';
  }

  function charitiesPanel(now, c) {
    var weekly = range === 'week';
    var b = B.charities(range, now, c);
    var info = B.weekInfo(now);
    var v = B.visible(b, B.SHOWN);
    var yours = b.rows.filter(function (r) { return r.you > 0; });
    var top = yours.slice().sort(function (x, y) { return y.you - x.you || x.rank - y.rank; })[0];
    var topCh = top ? GS.charity(top.id) : null;
    var line = yours.length && topCh
      ? 'You backed <b>' + yours.length + '</b> ' + (yours.length === 1 ? 'charity' : 'charities') + (weekly ? ' this week' : ' in all') + '. Your most backed is <b>' + esc(topCh.short) + '</b>, #' + top.rank + ' on this list.'
      : 'You have not backed a charity ' + (weekly ? 'this week' : 'yet') + '. Play any game and the charities your gifts land on show up here.';
    return headHTML('Charities ' + (weekly ? 'this week' : 'of all time') + ', by times backed', info, weekly) +
      '<p class="bd__lede">A charity is backed each time a gift lands on it, in any game: by simulated players, and by you. This counts picks in a game. It says nothing about how good or effective a charity is, and it is not an endorsement.</p>' +
      '<p class="bd__you">' + line + '</p>' +
      table('Charities ' + (weekly ? 'this week' : 'of all time') + ' by times backed. Counts from simulated players and from you.', ['Charity', 'Times backed'],
        v.shown.map(charityRow).join(''), v.extra.length ? v.extra.map(charityRow).join('') : '', 'bd__table--count');
  }

  /* ----- players */

  function playerRow(r) {
    var who = r.you
      ? '<span class="bd__nm"><b>' + esc(youName()) + '</b> ' + ui.youChip() + '<span class="bd__tag">You</span></span>'
      : '<span class="bd__nm">' + ui.botName(r.name) + ' ' + ui.botChip(r.name) + botPill() + '</span>';
    var amt = '<td class="bd__amt"' + (r.you && !demo() ? ' aria-label="' + m(r.cents) + ' sent to checkout"' : '') + '><span class="bd__v">' + m(r.cents) + '</span></td>';
    return '<tr class="bd__row' + (r.you ? ' is-you' : '') + '">' + rankCell(r.rank) + '<th scope="row" class="bd__who">' + who + '</th>' + amt + '</tr>';
  }

  function playersPanel(now, c) {
    var weekly = range === 'week';
    var b = B.players(range, now, c);
    var info = B.weekInfo(now);
    var v = B.visible(b, B.SHOWN);
    var you = b.you;
    var inList = you.rank <= B.SHOWN;
    return headHTML('Top players ' + (weekly ? 'this week' : 'of all time') + ', by amount given', info, weekly) +
      '<p class="bd__lede">Simulated players only: each bot’s total fits the rank chip next to its name. ' + (weekly ? 'Yours counts the gifts you gave this week on this device.' : 'Yours is everything you have given on this device.') + '</p>' +
      '<p class="bd__you">You are <b>#' + you.rank + '</b> of ' + b.total + ' ' + (weekly ? 'this week' : 'all time') + ' with <b>' + m(you.cents) + '</b>' + (demo() ? ' given' : ' sent to checkout') + '.' +
        (inList ? '' : ' Your row is under the top ' + B.SHOWN + '.') + (b.capped ? ' ' + esc(T.cappedNote) : '') + '</p>' +
      table('Top players ' + (weekly ? 'this week' : 'of all time') + ' by amount given. Simulated players, each marked BOT, and you.', ['Player', weekly ? 'Given' : 'Given in all'],
        v.shown.map(playerRow).join(''), v.extra.map(playerRow).join(''));
  }

  /* ----------------------------------------------------------------- page */

  function panelHTML(now) {
    var c = ctx(now);
    if (tab === 'charities') { return charitiesPanel(now, c); }
    if (tab === 'players') { return playersPanel(now, c); }
    return crewsPanel(now, c);
  }

  function drawPanel() {
    var root = ui.$('#view-boards');
    var panel = root && ui.$('#bd-panel', root);
    if (!panel) { return; }
    panel.innerHTML = panelHTML(new Date());
    panel.setAttribute('aria-labelledby', 'bd-tab-' + tab);
    ui.hydrate(panel);
    TABS.forEach(function (t) {
      var b = ui.$('#bd-tab-' + t[0], root);
      if (b) { b.setAttribute('aria-selected', String(t[0] === tab)); b.tabIndex = t[0] === tab ? 0 : -1; }
    });
    RANGES.forEach(function (r) {
      var b = ui.$('[data-range="' + r[0] + '"]', root);
      if (b) { b.setAttribute('aria-pressed', String(r[0] === range)); }
    });
  }

  function selectTab(id, focus) {
    tab = id;
    drawPanel();
    if (focus) { var b = ui.$('#bd-tab-' + id); if (b) { b.focus(); } }
  }

  function render() {
    var root = ui.$('#view-boards');
    root.innerHTML = '<header class="page-head"><div><h1>Leaderboards</h1><p>' + esc(T.lede) + '</p></div></header>' +
      '<div class="simbanner" role="note">' + ui.icon('bot') + '<div>' + T.sim + (demo() ? '' : esc(T.simCheckout)) + '</div></div>' +
      '<div class="bd__controls">' +
        '<div class="tabs bd__tabs" role="tablist" aria-label="' + esc(T.tabsLabel) + '">' + TABS.map(function (t) {
          return '<button type="button" class="tab" role="tab" id="bd-tab-' + t[0] + '" data-tab="' + t[0] + '" aria-controls="bd-panel" aria-selected="false" tabindex="-1">' + t[1] + '</button>';
        }).join('') + '</div>' +
        '<div class="bd__range"><span class="bd__lbl" id="bd-range-l">' + T.rangeLabel + '</span><div class="seg" role="group" aria-labelledby="bd-range-l">' + RANGES.map(function (r) {
          return '<button type="button" class="seg__btn" data-range="' + r[0] + '" aria-pressed="false">' + r[1] + '</button>';
        }).join('') + '</div></div>' +
      '</div>' +
      '<section class="bd__panel panel" id="bd-panel" role="tabpanel" aria-labelledby="bd-tab-' + tab + '"></section>';
    drawPanel();
    ui.hydrate(root);

    var list = ui.$('.bd__tabs', root);
    list.addEventListener('keydown', function (e) {
      var ids = TABS.map(function (t) { return t[0]; });
      var i = ids.indexOf(tab);
      var n = null;
      if (e.key === 'ArrowRight') { n = (i + 1) % ids.length; }
      else if (e.key === 'ArrowLeft') { n = (i + ids.length - 1) % ids.length; }
      else if (e.key === 'Home') { n = 0; }
      else if (e.key === 'End') { n = ids.length - 1; }
      if (n === null) { return; }
      e.preventDefault();
      selectTab(ids[n], true);
    });
    root.onclick = function (e) {
      var t = e.target.closest('[data-tab]');
      if (t) { selectTab(t.getAttribute('data-tab'), false); return; }
      var r = e.target.closest('[data-range]');
      if (r) { range = r.getAttribute('data-range'); drawPanel(); return; }
      var j = e.target.closest('[data-join]');
      if (j) { join(j.getAttribute('data-join')); return; }
      if (e.target.closest('[data-role="share-crew"]')) { openShare(); }
    };
  }

  /** Joins a crew from here: the same call the Crews page makes (nothing new is saved: the crew id is in the save already). */
  function join(id) {
    var c = GS.crews.get(id);
    if (!c || store.crew()) { return; }
    var badges = GS.crews.join(id);
    if (badges && badges.length) { GS.bus.emit('badges', badges); }
    GS.audio.click();
    ui.toast('You joined ' + c.name + '. Your gifts now count for it.', 'users');
    drawPanel();
    var btn = ui.$('#view-boards [data-role="share-crew"]');
    if (btn) { btn.focus(); }
  }

  /* ------------------------------------------------------------ the crew card */

  // the same palette as js/ui/sharecard.js (the site's own colours, see css/base.css)
  var C = { bg0: '#0e1b26', bg1: '#091017', ink: '#ecf5f9', muted: '#9bb3c0', dim: '#8aa3b1', green: '#22f07a', gold: '#ffc542', line: '#335468' };
  var DISPLAY = '"Sora", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
  var BODY = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  var HEART = 'M20 28.2c-.4 0-.7-.1-1-.4-4.1-3.6-7-6.2-7-9.6 0-2.3 1.8-4.1 4-4.1 1.6 0 3.1.8 4 2.2.9-1.4 2.4-2.2 4-2.2 2.2 0 4 1.8 4 4.1 0 3.4-2.9 6-7 9.6-.3.3-.6.4-1 .4Z';

  var TC = {
    title: 'Share my crew',
    sub: 'A picture to save or send. Pick a shape, then show it off.',
    shows: 'It shows your crew’s name, rank and weekly goal. It has no name of yours, no balance, email or card.',
    shape: 'Picture shape',
    drawing: 'Drawing your picture…',
    failed: 'Sorry, this browser could not draw the picture. You can still copy the link and text.',
    download: 'Download PNG',
    share: 'Share',
    copy: 'Copy link and text',
    saveHint: 'If nothing was saved, press and hold the picture (or right-click it) and choose Save image.',
    downloadStarted: 'Download started'
  };

  var modal = null;
  var st = null;            // the dialog on show: { size, token, blob, url, canvas, card }
  var closeHandler = null;
  var lastMeta = null;

  function font(g, weight, px, family) { g.font = weight + ' ' + Math.round(px) + 'px ' + family; }
  function measurer(g, weight, px, family) { return function (t) { font(g, weight, px, family); return g.measureText(t).width; }; }
  function text(g, s, x, y, o) {
    g.save();
    font(g, o.weight || 700, o.px, o.family || BODY);
    g.fillStyle = o.color || C.ink;
    g.textAlign = o.align || 'left';
    g.textBaseline = 'alphabetic';
    if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = 24; }
    g.fillText(s, x, y);
    g.restore();
  }
  function fitText(g, s, x, y, maxW, o) {
    var px = share.fitSize(s, maxW, function (t, p) { font(g, o.weight || 700, p, o.family || BODY); return g.measureText(t).width; }, o.px, o.min || 12);
    var f = measurer(g, o.weight || 700, px, o.family || BODY);
    var oo = {}; Object.keys(o).forEach(function (k) { oo[k] = o[k]; }); oo.px = px;
    text(g, f(s) > maxW ? share.ellipsize(s, maxW, f) : s, x, y, oo);
    return px;
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
    g.closePath();
  }
  function glowAt(g, x, y, r, rgb, alpha) {
    var gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(' + rgb + ',' + alpha + ')');
    gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function fontsReady() {
    if (!document.fonts || !document.fonts.load) { return Promise.resolve(); }
    var ask = Promise.all([document.fonts.load('800 64px Sora'), document.fonts.load('700 32px Inter'), document.fonts.load('600 32px Inter')]).catch(function () { /* the fallback fonts will do */ });
    return Promise.race([ask, new Promise(function (r) { setTimeout(r, 1500); })]);
  }

  /** The gold frame for a crew that reached its goal: border with a glow and marquee bulbs (the share cards' fancy frame, without the confetti dots). */
  function goldFrame(g, W, H) {
    var gold = g.createLinearGradient(0, 0, W, H);
    ['#fff1b8', '#ffc542', '#a86f05', '#ffc542', '#fff1b8'].forEach(function (c, i, a) { gold.addColorStop(i / (a.length - 1), c); });
    g.save();
    g.shadowColor = 'rgba(255,197,66,0.85)'; g.shadowBlur = 34; g.lineWidth = 14; g.strokeStyle = gold;
    roundRect(g, 26, 26, W - 52, H - 52, 46); g.stroke();
    g.restore();
    g.lineWidth = 3; g.strokeStyle = 'rgba(255,241,184,0.7)';
    roundRect(g, 50, 50, W - 100, H - 100, 30); g.stroke();
    g.fillStyle = '#fff1b8';
    var bulbs = [], x0, y0;
    for (x0 = 90; x0 <= W - 90; x0 += 54) { bulbs.push([x0, 38], [x0, H - 38]); }
    for (y0 = 90; y0 <= H - 90; y0 += 54) { bulbs.push([38, y0], [W - 38, y0]); }
    bulbs.forEach(function (b, k) {
      g.save(); g.shadowColor = '#ffc542'; g.shadowBlur = 12; g.globalAlpha = k % 2 ? 0.95 : 0.6;
      g.beginPath(); g.arc(b[0], b[1], 5, 0, Math.PI * 2); g.fill(); g.restore();
    });
  }
  function plainFrame(g, W, H) {
    g.lineWidth = 3; g.strokeStyle = C.line;
    roundRect(g, 28, 28, W - 56, H - 56, 40); g.stroke();
  }

  function header(g, W, card, pad) {
    var y = 64;
    var grad = g.createLinearGradient(pad, y, pad + 64, y + 64);
    grad.addColorStop(0, '#22f07a'); grad.addColorStop(1, '#14b8a6');
    g.fillStyle = grad;
    roundRect(g, pad, y, 64, 64, 18); g.fill();
    g.save(); g.translate(pad, y); g.scale(1.6, 1.6); g.fillStyle = '#03210f'; g.fill(new Path2D(HEART)); g.restore();
    font(g, 800, 40, DISPLAY);
    var give = g.measureText('Give').width;
    text(g, 'Give', pad + 84, y + 34, { px: 40, weight: 800, family: DISPLAY, color: C.ink });
    text(g, 'Spin', pad + 84 + give, y + 34, { px: 40, weight: 800, family: DISPLAY, color: C.green });
    fitText(g, card.tagline, pad + 84, y + 62, W - pad * 2 - 84 - (card.demo ? 330 : 0), { px: 22, min: 14, weight: 600, family: BODY, color: C.muted });
    if (card.demo) {
      var label = 'DEMO · Play money';
      font(g, 800, 24, BODY);
      var w = g.measureText(label).width + 44;
      g.fillStyle = 'rgba(255,197,66,0.12)'; g.strokeStyle = 'rgba(255,197,66,0.75)'; g.lineWidth = 3;
      roundRect(g, W - pad - w, y + 10, w, 46, 23); g.fill(); g.stroke();
      text(g, label, W - pad - w / 2, y + 42, { px: 24, weight: 800, family: BODY, color: C.gold, align: 'center' });
    }
  }

  function ribbon(g, W, label, y) {
    font(g, 800, 30, DISPLAY);
    var w = g.measureText(label).width + 96;
    var gr = g.createLinearGradient(W / 2 - w / 2, y, W / 2 + w / 2, y);
    gr.addColorStop(0, '#ffc542'); gr.addColorStop(0.5, '#fff1b8'); gr.addColorStop(1, '#ff8a3d');
    g.save(); g.shadowColor = 'rgba(255,197,66,0.8)'; g.shadowBlur = 26; g.fillStyle = gr;
    roundRect(g, W / 2 - w / 2, y, w, 58, 29); g.fill(); g.restore();
    text(g, label, W / 2, y + 40, { px: 30, weight: 800, family: DISPLAY, color: '#2a1a00', align: 'center' });
  }

  /** The goal bar: a track and a fill as wide as the share of the goal that is done. */
  function goalBar(g, x, y, w, h, pct, done) {
    g.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(g, x, y, w, h, h / 2); g.fill();
    var fw = Math.max(h, w * pct / 100);
    if (pct <= 0) { return; }
    var gr = g.createLinearGradient(x, y, x + w, y);
    if (done) { gr.addColorStop(0, '#ffc542'); gr.addColorStop(1, '#fff1b8'); } else { gr.addColorStop(0, '#17c963'); gr.addColorStop(1, '#34f88c'); }
    g.fillStyle = gr;
    roundRect(g, x, y, fw, h, h / 2); g.fill();
  }

  function paint(g, S, card) {
    var W = S.w, H = S.h, sq = S.id === 'square', pad = 72, big = !!card.big;
    var bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, C.bg0); bg.addColorStop(1, C.bg1);
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    glowAt(g, W / 2, sq ? 420 : 520, W * 0.62, big ? '255,197,66' : '34,240,122', big ? 0.2 : 0.11);
    if (big) { goldFrame(g, W, H); } else { plainFrame(g, W, H); }
    header(g, W, card, pad);
    if (big && card.ribbon) { ribbon(g, W, card.ribbon, sq ? 150 : 158); }
    var maxW = W - pad * 2;
    var y = sq
      ? { eyebrow: 286, name: 386, rank: 452, amount: 580, label: 662, bar: 702, goal: 788, crew: 842, foot: H - 190 }
      : { eyebrow: 350, name: 470, rank: 550, amount: 730, label: 800, bar: 856, goal: 952, crew: 1016, foot: H - 244 };   // (the label sits low enough that the comma of a big amount does not touch it)
    fitText(g, card.eyebrow, W / 2, y.eyebrow, maxW, { px: 36, min: 20, weight: 700, family: BODY, color: C.muted, align: 'center' });
    fitText(g, card.name, W / 2, y.name, maxW, { px: sq ? 92 : 108, min: 44, weight: 800, family: DISPLAY, color: C.ink, align: 'center' });
    fitText(g, card.rankLine, W / 2, y.rank, maxW, { px: 46, min: 26, weight: 800, family: BODY, color: C.green, align: 'center' });
    fitText(g, card.amount, W / 2, y.amount, maxW, { px: sq ? 130 : 150, min: 70, weight: 800, family: DISPLAY, color: C.gold, align: 'center', glow: big ? 'rgba(255,197,66,0.55)' : 0 });
    fitText(g, 'given this week', W / 2, y.label, maxW, { px: 36, min: 20, weight: 600, family: BODY, color: C.muted, align: 'center' });
    var bh = sq ? 40 : 46;
    goalBar(g, pad, y.bar, maxW, bh, card.pct, card.reached);
    fitText(g, card.goalLine, W / 2, y.goal, maxW, { px: 40, min: 22, weight: 700, family: BODY, color: C.ink, align: 'center' });
    fitText(g, card.crewLine, W / 2, y.crew, maxW, { px: 32, min: 20, weight: 600, family: BODY, color: C.muted, align: 'center' });
    // footer: the address and the plain note (the same shape as the other cards)
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(pad, y.foot, maxW, 2);
    var fy = y.foot + 46;
    if (card.site) { fitText(g, card.site, W / 2, fy, maxW, { px: 28, min: 18, weight: 700, family: BODY, color: C.green, align: 'center' }); fy += 40; }
    var f = measurer(g, 600, 22, BODY);
    share.wrapText(card.note + '.', maxW, f, 2).lines.forEach(function (l, i) { text(g, l, W / 2, fy + i * 29, { px: 22, weight: 600, family: BODY, color: C.dim, align: 'center' }); });
  }

  function draw(card, sizeId) {
    var S = share.sizeFor(sizeId);
    var cv = document.createElement('canvas');
    cv.width = S.w; cv.height = S.h;
    var g = cv.getContext('2d');
    return fontsReady().then(function () { paint(g, S, card); return cv; });
  }

  function toBlob(canvas) {
    return new Promise(function (resolve, reject) {
      try {
        if (canvas.toBlob) { canvas.toBlob(function (b) { if (b) { resolve(b); } else { reject(new Error('The picture came out empty')); } }, 'image/png'); return; }
        var bin = atob(canvas.toDataURL('image/png').split(',')[1]);
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) { bytes[i] = bin.charCodeAt(i); }
        resolve(new Blob([bytes], { type: 'image/png' }));
      } catch (e) { reject(e); }
    });
  }

  /** The card for the visitor's crew now, or null when they have none. */
  function crewCardNow(now) {
    var c = ctx(now);
    var b = B.crews('week', now, c);
    var r = b.you;
    if (!r) { return null; }
    var card = B.crewCard({ demo: demo(), name: r.name, rank: r.rank, of: b.total, cents: r.cents, goal: r.goal, members: r.members, member: true, site: share.siteLabel(window.location.href) });
    card.amount = m(r.cents);
    return card;
  }

  function dialogHTML() {
    return '<h2 class="modal__title" id="dlg-crewcard-title">' + esc(TC.title) + '</h2>' +
      '<p class="modal__sub">' + esc(TC.sub) + '</p>' +
      '<div class="sc">' +
        '<div class="sc__preview" data-role="preview" aria-busy="true">' +
          '<img class="sc__img" data-role="img" alt="" width="1080" height="1350" hidden>' +
          '<p class="sc__wait" data-role="wait" role="status">' + esc(TC.drawing) + '</p>' +
        '</div>' +
        '<div class="sc__ctl">' +
          '<div class="sc__row"><span class="sc__lbl" id="cc-shape-l">' + esc(TC.shape) + '</span>' +
            '<div class="seg" role="group" aria-labelledby="cc-shape-l">' +
              Object.keys(share.SIZES).map(function (id) {
                var z = share.SIZES[id];
                return '<button type="button" class="seg__btn" data-size="' + id + '" aria-pressed="' + (st.size === id) + '">' + esc(z.label) + '<small>' + z.w + ' × ' + z.h + '</small></button>';
              }).join('') +
            '</div></div>' +
          '<p class="sc__shows">' + esc(TC.shows) + '</p>' +
          '<div class="sc__act">' +
            '<button type="button" class="btn btn--green" data-role="download" disabled>' + ui.icon('download') + esc(TC.download) + '</button>' +
            '<button type="button" class="btn" data-role="share" hidden>' + ui.icon('share-2') + esc(TC.share) + '</button>' +
            '<button type="button" class="btn" data-role="copy">' + ui.icon('copy') + esc(TC.copy) + '</button>' +
          '</div>' +
          '<p class="sc__hint" data-role="hint" role="status" hidden></p>' +
        '</div>' +
      '</div>';
  }

  function setHint(msg) {
    var h = modal.$('[data-role="hint"]');
    if (!h) { return; }
    h.textContent = msg || '';
    h.hidden = !msg;
  }
  function revoke(s) { s = s || st; if (s && s.url) { try { URL.revokeObjectURL(s.url); } catch (e) { /* already gone */ } s.url = ''; } }
  function pageUrl() { return share.siteUrl(window.location.href); }
  function fileName() { return 'givespin-crew-' + st.size + '.png'; }
  function shareData() {
    var url = pageUrl();
    var t = B.crewText(st.card);
    return { text: t, url: url, both: t + (url ? ' ' + url : '') };
  }

  function render2() {
    var token = ++st.token;
    var card = crewCardNow(new Date());
    var prev = modal.$('[data-role="preview"]');
    var img = modal.$('[data-role="img"]');
    var wait = modal.$('[data-role="wait"]');
    if (!card) { wait.hidden = false; wait.textContent = TC.failed; return; }
    prev.setAttribute('aria-busy', 'true');
    prev.removeAttribute('data-ready');
    wait.hidden = false;
    wait.textContent = TC.drawing;
    modal.$('[data-role="download"]').disabled = true;
    modal.$('[data-role="share"]').hidden = !navigator.share;
    draw(card, st.size).then(function (cv) {
      return toBlob(cv).then(function (blob) {
        if (token !== st.token) { return; }
        revoke();
        var S = share.sizeFor(st.size);
        st.canvas = cv; st.blob = blob; st.url = URL.createObjectURL(blob); st.card = card;
        img.width = S.w; img.height = S.h;
        img.alt = B.crewAlt(card, S);
        img.src = st.url;
        img.hidden = false;
        wait.hidden = true;
        prev.setAttribute('aria-busy', 'false');
        prev.setAttribute('data-frame', card.big ? 'fancy' : 'plain');
        prev.setAttribute('data-shape', st.size);
        prev.setAttribute('data-ready', '1');
        modal.$('[data-role="download"]').disabled = false;
        lastMeta = { kind: 'crew', size: st.size, w: S.w, h: S.h, big: card.big, ribbon: card.ribbon, crew: card.name, rankLine: card.rankLine, goalLine: card.goalLine, text: B.crewText(card), alt: img.alt, file: fileName(), bytes: blob.size };
      });
    }).catch(function (e) {
      if (token !== st.token) { return; }
      wait.hidden = false; wait.textContent = TC.failed;
      prev.setAttribute('aria-busy', 'false'); prev.setAttribute('data-failed', '1');
      if (window.console && console.debug) { console.debug('crew card: ' + (e && e.message)); }
    });
  }

  function onDownload() {
    if (!st || !st.blob) { return; }
    var broken = false;
    try {
      var a = document.createElement('a');
      if (!('download' in a)) { broken = true; }
      a.href = st.url; a.download = fileName(); a.rel = 'noopener'; a.style.display = 'none';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (e) { broken = true; }
    // a page shown inside another page (a published preview) may block downloads without telling us: show how to save by hand
    var framed = false;
    try { framed = window.self !== window.top; } catch (e2) { framed = true; }
    if (broken || framed) { setHint(TC.saveHint); } else { setHint(''); ui.toast(TC.downloadStarted, 'download'); }
  }

  function onShare() {
    if (!st || !st.blob) { return; }
    var d = shareData();
    var file = null;
    try { file = new File([st.blob], fileName(), { type: 'image/png' }); } catch (e) { file = null; }
    function copyInstead() { ui.copyWithToast(d.both, 'Message'); }
    if (!navigator.share) { copyInstead(); return; }
    var canFile = false;
    try { canFile = !!(file && navigator.canShare && navigator.canShare({ files: [file] })); } catch (e3) { canFile = false; }
    var payload = canFile ? { files: [file], title: 'GiveSpin', text: d.text, url: d.url } : { title: 'GiveSpin', text: d.text, url: d.url };
    var p;
    try { p = navigator.share(payload); } catch (e4) { copyInstead(); return; }
    Promise.resolve(p).then(function () { setHint(''); }, function (err) {
      if (err && err.name === 'AbortError') { return; }   // the visitor closed the share sheet
      copyInstead();
    });
  }

  function openShare() {
    if (!crewCardNow(new Date())) { ui.toast('Join a crew first, then you can share it.', 'info'); return; }
    if (!modal) { modal = ui.modal('crewcard', { wide: true, className: 'modal--share' }); }
    // each opening has its own 'close' listener: the dialog's close event arrives a moment after it closes (see ui/sharecard.js)
    if (closeHandler) { modal.el.removeEventListener('close', closeHandler); closeHandler = null; }
    if (st) { st.token++; revoke(st); }
    var p = share.normPrefs(GS.local ? GS.local.get('share', null) : null);
    st = { size: st ? st.size : p.size, token: 0, blob: null, url: '', canvas: null, card: null };
    var mine = st;
    closeHandler = function () { if (modal.el.open) { return; } mine.token++; revoke(mine); };
    modal.el.addEventListener('close', closeHandler);
    modal.set(dialogHTML());
    modal.setLocked(false);
    modal.open();
    var sizeBtns = modal.$$('[data-size]');
    sizeBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-size');
        if (id === st.size) { return; }
        st.size = id;
        sizeBtns.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        render2();
      });
    });
    modal.$('[data-role="download"]').addEventListener('click', onDownload);
    modal.$('[data-role="share"]').addEventListener('click', onShare);
    modal.$('[data-role="copy"]').addEventListener('click', function () { var d = shareData(); ui.copyWithToast(d.both, 'Message'); });
    render2();
  }

  /* ----------------------------------------------------------- the lobby block */

  function lobbyHTML(now) {
    var c = ctx(now);
    var info = B.weekInfo(now);
    var top = B.leaders(now, c, 3);
    return '<div class="sect__head"><h2 class="sect__t">This week’s leaders</h2><a class="linkbtn" href="#boards">See the leaderboards</a></div>' +
      '<div class="bdl panel"><ol class="bdl__list" aria-label="Top three crews this week. Simulated crews: every member is a bot.">' + top.map(function (r) {
        var words = m(r.cents) + ' of ' + m(r.goal);
        return '<li class="bdl__item' + (r.member ? ' is-you' : '') + '"><span class="bd__n bd__n--' + r.rank + '">' + r.rank + '</span>' +
          '<span class="bdl__t"><b>' + esc(r.name) + '</b> ' + botPill(T.crewBotTip) + (r.member ? ' <span class="bd__tag">Your crew</span>' : '') +
          '<span class="bd__bar' + (r.reached ? ' is-done' : '') + '" role="progressbar" aria-label="' + esc(r.name) + ' weekly goal" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + r.pct + '" aria-valuetext="' + esc(words) + '"><i style="width:' + r.pct + '%"></i></span>' +
          '<small>' + esc(words) + ' weekly goal</small></span></li>';
      }).join('') + '</ol>' +
      '<p class="bdl__note">Simulated crews: every member is a bot, and the numbers are made up. This week’s boards end in ' + esc(B.timeLeft(info.msLeft)) + '.</p></div>';
  }

  if (ui.lobby && ui.lobby.addBlock) {
    ui.lobby.addBlock({
      id: 'boards', order: 40, label: 'This week’s leaders',
      mount: function () { /* drawn on every visit */ },
      refresh: function (el) {
        // simulated crews next to real-donation checkout would mislead: like the ticker, the block is demo-mode only
        el.hidden = !demo();
        if (demo()) { el.innerHTML = lobbyHTML(new Date()); ui.hydrate(el); }
      }
    });
  }

  ui.pages['boards'] = render;
  ui.boards = {
    render: render,
    openShare: openShare,
    last: function () { return lastMeta; },
    canvas: function () { return st ? st.canvas : null; },
    state: function () { return { tab: tab, range: range }; },
    /** The three boards at a moment (a Date; now by default), for tests and the curious. */
    data: function (date) {
      var d = date || new Date();
      var c = ctx(d);
      return { week: B.crews('week', d, c), weekAll: B.crews('all', d, c), charities: B.charities('week', d, c), players: B.players('week', d, c) };
    }
  };
})();
