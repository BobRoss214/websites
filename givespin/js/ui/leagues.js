/*
 * Leagues, the Charity Cup and Crews.
 *
 *  - Tiers: Bronze to Diamond by level; higher tiers open VIP stakes at live tables.
 *  - The weekly league: you against 14 simulated rivals, ranked by XP this week.
 *  - The Charity Cup: an eight-charity knockout each week. Back one champion before it starts; only a champion win earns XP (never money).
 *  - Crews: simulated groups with a chat (stays on this device), emotes and a weekly goal.
 *
 * Everyone except you is a bot for now, and the pages say so.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var ui = GS.ui;
  var store = GS.store;
  var esc = ui.esc;
  var $ = ui.$;
  var money = core.fmtMoney;

  function botTag() { return '<span class="botpill" title="A simulated player">BOT</span>'; }

  function pageHead(title, sub) {
    return '<header class="page-head"><div><h1>' + esc(title) + '</h1><p>' + sub + '</p></div></header>';
  }

  function simBanner(text) {
    return '<aside class="simbanner">' + ui.icon('bot') + '<div>' + text + '</div></aside>';
  }

  function timeLeftInWeek() {
    var now = new Date();
    var frac = core.weekFraction(now);
    var ms = (1 - frac) * 7 * 86400000;
    var d = Math.floor(ms / 86400000);
    var h = Math.floor((ms % 86400000) / 3600000);
    return d + (d === 1 ? ' day ' : ' days ') + h + (h === 1 ? ' hour' : ' hours');
  }

  /* ------------------------------------------------------------------ tiers */

  function tierHTML() {
    var lv = core.levelFor(store.get().xp);
    var t = core.tierFor(lv.level);
    var next = t.next;
    var perks = core.TIERS.map(function (x, i) {
      return '<li class="tier' + (i === t.index ? ' is-current' : i < t.index ? ' is-done' : '') + '" data-tier="' + x.id + '"><span class="tier__gem tier__gem--' + x.id + '">' + ui.icon('gem') + '</span>' +
        '<div><b>' + x.name + '</b><small>Level ' + x.minLevel + '+ · ' + esc(x.perk) + '</small></div></li>';
    }).join('');
    return '<section class="sect panel" aria-labelledby="lg-tier"><h2 class="sect__t" id="lg-tier">Your tier: <span class="tier-name tier-name--' + t.tier.id + '">' + t.tier.name + '</span></h2>' +
      '<p>You are level ' + lv.level + ' (' + esc(lv.name) + ').' + (next ? ' Reach level ' + next.minLevel + ' for ' + next.name + ': ' + esc(next.perk) : ' You are at the top tier.') + '</p>' +
      '<ul class="tiers">' + perks + '</ul>' +
      '<p class="tabnote">VIP stakes show up beside the usual presets at <a href="#live">live tables</a>.</p></section>';
  }

  /* ----------------------------------------------------------------- league */

  function leagueHTML() {
    var s = store.get();
    var week = core.weekKey();
    var rows = core.leagueTable(week, core.weekFraction(), store.weekly().xp, s.account.signedIn && s.account.name ? s.account.name : 'You');
    var me = rows.filter(function (r) { return r.you; })[0];
    return '<section class="sect panel" aria-labelledby="lg-league"><div class="sect__head"><h2 class="sect__t" id="lg-league">This week’s league <small>' + week + '</small></h2><span class="tag tag--plain">ends in ' + timeLeftInWeek() + '</span></div>' +
      '<p>You are <b>#' + me.rank + '</b> with <b>' + me.xp + ' XP</b> this week. The top three move up a league next week; the bottom three drop down. Earn XP by giving, backing winners, predicting and finishing card sets.</p>' +
      '<ol class="league" aria-label="Weekly league standings">' + rows.map(function (r) {
        return '<li class="lrow lrow--' + r.zone + (r.you ? ' is-you' : '') + '"><span class="lrow__rank">' + r.rank + '</span><span class="lrow__name">' + esc(r.name) + (r.you ? ' <small>(you)</small>' : ' ' + botTag()) + '</span><span class="lrow__xp">' + r.xp + ' XP</span></li>';
      }).join('') + '</ol>' +
      '<p class="tabnote">The other players are simulated rivals; their totals are the same for everyone this week and grow as the week goes on. Nothing here is money.</p></section>';
  }

  /* -------------------------------------------------------------------- cup */

  function currentCup() {
    var week = core.weekKey();
    var cup = store.cup();
    if (!cup || cup.key !== week) {
      cup = { key: week, field: core.cupField(GS.charities, week), pick: '', rounds: [], done: false, called: false };
      store.setCup(cup);
    }
    return cup;
  }

  /** The bracket as arrays of ids: round 0 is the field, then each completed round's winners. */
  function cupColumns(cup) {
    var cols = [cup.field.slice()];
    cup.rounds.forEach(function (r) { cols.push(r.slice()); });
    return cols;
  }

  function cupHTML() {
    var cup = currentCup();
    var cols = cupColumns(cup);
    var names = ['Quarter-finals', 'Semi-finals', 'Final', 'Champion'];
    var started = cup.rounds.length > 0;
    var champion = cup.done ? cup.rounds[2][0] : '';
    var body = '';
    for (var c = 0; c < 4; c++) {
      var ids = cols[c];
      var expect = c === 0 ? 8 : c === 1 ? 4 : c === 2 ? 2 : 1;
      var cells = '';
      for (var i = 0; i < expect; i++) {
        var id = ids && ids[i];
        var ch = id ? GS.charity(id) : null;
        var next = cols[c + 1];
        var out = ch && c < 3 && next && next.length && next.indexOf(id) < 0;
        cells += '<li class="cupslot' + (ch ? '' : ' is-empty') + (ch && id === cup.pick ? ' is-pick' : '') + (out ? ' is-out' : '') + (champion && id === champion && c === 3 ? ' is-champ' : '') + '"' + (ch ? ' style="--c:' + ch.accent + '"' : '') + '>' +
          (ch ? ui.mono(ch, 24) + '<span>' + esc(ch.short) + '</span>' : '<span>To be decided</span>') + '</li>';
      }
      body += '<div class="cupcol"><h3>' + names[c] + '</h3><ul>' + cells + '</ul></div>';
    }
    var pickRow = '';
    if (!started) {
      pickRow = '<p>Back a champion (XP only). If your charity wins the cup you earn 120 XP and the Cup Seer badge.</p><div class="cuppick" role="radiogroup" aria-label="Back a champion">' + cup.field.map(function (id) {
        var ch = GS.charity(id);
        return '<button type="button" class="chip' + (cup.pick === id ? ' is-on' : '') + '" role="radio" aria-checked="' + (cup.pick === id) + '" data-cup-pick="' + id + '" style="--c:' + ch.accent + '">' + ui.mono(ch, 22) + esc(ch.short) + '</button>';
      }).join('') + '</div>';
    }
    var action;
    if (cup.done) {
      var champCh = GS.charity(champion);
      action = '<p class="cupresult">' + ui.icon('trophy') + '<b>' + esc(champCh.name) + '</b> won this week’s cup.' + (cup.pick ? (cup.pick === champion ? ' You called it! +120 XP.' : ' You backed ' + esc(GS.charity(cup.pick).short) + '; better luck next week.') : ' You did not back a champion.') + '</p>';
    } else {
      action = '<div class="cupact"><button type="button" class="btn btn--green" data-role="cup-next">' + ui.icon('play') + (started ? 'Play the ' + (cup.rounds.length === 1 ? 'semi-finals' : 'final') : 'Start the cup') + '</button>' +
        '<button type="button" class="btn" data-role="cup-all">' + ui.icon('chevrons-right') + 'Play it all</button></div>';
    }
    return '<section class="sect panel" aria-labelledby="lg-cup"><h2 class="sect__t" id="lg-cup">Charity Cup <span class="tag tag--plain">XP only</span></h2>' +
      '<p>Eight charities, three rounds, one champion, new every week. Each match is a fair coin: the winner comes from the browser’s secure random generator. The cup carries no money and no prize for anyone; it is a side game for XP.</p>' +
      pickRow + '<div class="cup" data-role="cup">' + body + '</div>' + action + '</section>';
  }

  function playCupRound() {
    var cup = currentCup();
    if (cup.done) { return false; }
    var cur = cup.rounds.length ? cup.rounds[cup.rounds.length - 1] : cup.field;
    var winners = [];
    for (var i = 0; i < cur.length; i += 2) { winners.push(cur[i + core.randomInt(2)]); }
    cup.rounds.push(winners);
    if (cup.rounds.length === 3) {
      cup.done = true;
      var champ = winners[0];
      if (cup.pick && cup.pick === champ) {
        cup.called = true;
        var g = store.grantXp(120);
        if (g.newBadges.length) { GS.bus.emit('badges', g.newBadges); }
        GS.audio.win();
        GS.confetti.celebrate(1);
        ui.toast('You called the Charity Cup champion! +120 XP', 'trophy');
        GS.bus.emit('progress', g);
      } else { GS.audio.coin(); }
    } else { GS.audio.ring(); }
    var bd = store.setCup(cup);
    if (bd.length) { GS.bus.emit('badges', bd); }
    return true;
  }

  /* ----------------------------------------------------------------- render */

  function renderLeagues() {
    var root = $('#view-leagues');
    var p = store.predictions();
    root.innerHTML = pageHead('Leagues', 'Climb the weekly league, collect your tier, back a champion in the Charity Cup. All of it runs on XP, never money.') +
      simBanner('<b>Simulated rivals.</b> The other players in the league are bots standing in for real people. Nothing here costs or pays real money.') +
      tierHTML() + leagueHTML() + cupHTML() +
      '<section class="sect panel" aria-labelledby="lg-pred"><h2 class="sect__t" id="lg-pred">Side predictions</h2><p>At <a href="#live">live tables</a> you can predict how a round will go (will the pot pass $500, will there be an upset). Right answers earn XP. So far: <b>' + p.right + ' right of ' + p.total + '</b>. Three right earns the Oracle badge.</p></section>';
    ui.hydrate(root);
    root.onclick = function (e) {
      var pk = e.target.closest('[data-cup-pick]');
      if (pk) {
        var cup = currentCup();
        if (cup.rounds.length) { return; }
        cup.pick = cup.pick === pk.getAttribute('data-cup-pick') ? '' : pk.getAttribute('data-cup-pick');
        store.setCup(cup);
        GS.audio.click();
        renderLeagues();
        return;
      }
      if (e.target.closest('[data-role="cup-next"]')) { playCupRound(); renderLeagues(); return; }
      if (e.target.closest('[data-role="cup-all"]')) {
        var step = function () {
          if (!playCupRound()) { return; }
          renderLeagues();
          if (!currentCup().done) { setTimeout(step, Math.max(40, 650 * (GS.timeScale || 1))); }
        };
        step();
      }
    };
  }

  /* ------------------------------------------------------------------ crews */

  function chatHTML(id) {
    var msgs = GS.crews.chat(id).slice(-30);
    return msgs.length ? msgs.map(function (m) {
      var em = m.emote ? GS.crews.EMOTES.filter(function (x) { return x.id === m.emote; })[0] : null;
      return '<li class="cmsg' + (m.bot ? '' : ' is-you') + '"><b>' + esc(m.name) + '</b>' + (m.bot ? ' ' + botTag() : '') + ' ' + (em ? '<span class="cmsg__emote">' + ui.icon(em.icon) + esc(em.label) + '</span>' : esc(m.text)) + '</li>';
    }).join('') : '<li class="empty">No messages yet. Say hello.</li>';
  }

  function renderCrews() {
    var root = $('#view-crews');
    var mine = GS.crews.mine();
    var body;
    if (!mine) {
      body = '<p>Join a crew to chat, share a weekly goal and have crewmates back your charity at live tables. You can leave any time.</p><h2 class="sr-only">Choose a crew</h2><div class="crewgrid">' + GS.crews.CREWS.map(function (c) {
        return '<article class="crewcard"><h3>' + esc(c.name) + '</h3><p>' + esc(c.blurb) + '</p><p class="crewcard__m">' + ui.icon('users') + c.members.length + ' members ' + botTag() + '</p>' +
          '<button type="button" class="btn btn--green" data-crew-join="' + c.id + '">' + ui.icon('plus') + 'Join ' + esc(c.name) + '</button></article>';
      }).join('') + '</div>';
    } else {
      var g = GS.crews.goal();
      body = '<section class="sect panel" aria-labelledby="cr-me"><div class="sect__head"><h2 class="sect__t" id="cr-me">' + esc(mine.name) + '</h2><button type="button" class="btn btn--sm btn--ghost" data-role="crew-leave">Leave the crew</button></div>' +
        '<p>' + esc(mine.blurb) + '</p>' +
        '<div class="jpmeter"><div class="jpmeter__t">' + ui.icon('trophy') + '<b>Weekly crew goal</b> <span class="jpmeter__v">' + g.xp + ' / ' + g.goal + ' XP</span></div><div class="jpmeter__bar" role="img" aria-label="Crew goal ' + g.pct + '% done"><i style="width:' + g.pct + '%"></i></div><small>Your ' + g.myXp + ' XP this week plus your crewmates’ (simulated) ' + g.botXp + '.</small></div>' +
        '<h3 class="crew__h">Crewmates</h3><ul class="crewmates"><li class="is-you">You</li>' + mine.members.map(function (n) { return '<li>' + esc(n) + ' ' + botTag() + '</li>'; }).join('') + '</ul>' +
        '<p class="tabnote">When you put a stake on a charity at a live table, two or three crewmates back it too (simulated stakes).</p></section>' +
        '<section class="sect panel" aria-labelledby="cr-chat"><h2 class="sect__t" id="cr-chat">Crew chat</h2>' +
        '<ol class="chatlog" data-role="chatlog" tabindex="0" aria-label="Crew chat">' + chatHTML(mine.id) + '</ol>' +
        '<div class="chatbar"><label class="sr-only" for="chat-in">Message your crew</label><input id="chat-in" class="input input--sm" type="text" maxlength="80" placeholder="Say something (stays on this device)" autocomplete="off">' +
        '<button type="button" class="btn btn--sm" data-role="chat-send">Send</button></div>' +
        '<div class="emotes">' + GS.crews.EMOTES.map(function (e) { return '<button type="button" class="btn btn--sm btn--ghost" data-emote="' + e.id + '">' + ui.icon(e.icon) + esc(e.label) + '</button>'; }).join('') + '</div>' +
        '<p class="tabnote">The chat is scripted bots plus whatever you type. Nothing you type is sent anywhere.</p></section>';
    }
    root.innerHTML = pageHead('Crews', 'Play alongside a crew: a chat, emotes, a weekly goal, and crewmates who back your charity at live tables.') +
      simBanner('<b>Simulated crews.</b> Every crewmate is a bot standing in for a real person, and the chat is scripted. Real crews would need a server.') + body;
    ui.hydrate(root);
    var log = $('[data-role="chatlog"]', root);
    if (log) { log.scrollTop = log.scrollHeight; }
    root.onclick = function (e) {
      var j = e.target.closest('[data-crew-join]');
      if (j) {
        var b = GS.crews.join(j.getAttribute('data-crew-join'));
        if (b && b.length) { GS.bus.emit('badges', b); }
        GS.audio.coin();
        renderCrews();
        return;
      }
      if (e.target.closest('[data-role="crew-leave"]')) { GS.crews.join(''); renderCrews(); return; }
      var em = e.target.closest('[data-emote]');
      if (em) { GS.crews.emote(em.getAttribute('data-emote')); GS.audio.click(); return; }
      if (e.target.closest('[data-role="chat-send"]')) { sendChat(); }
    };
    var input = $('#chat-in', root);
    if (input) { input.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); sendChat(); } }; }
  }

  function sendChat() {
    var input = $('#chat-in');
    if (!input) { return; }
    if (GS.crews.say(input.value)) { input.value = ''; GS.audio.click(); }
  }

  /** Keeps the chat fresh while the Crews page is open (a full re-render would lose what you are typing). */
  GS.bus.on('crew', function (e) {
    var root = $('#view-crews');
    if (!root || root.hidden || !e || e.type !== 'chat') { return; }
    var log = $('[data-role="chatlog"]', root);
    var mine = GS.crews.mine();
    if (log && mine) {
      var stick = log.scrollTop + log.clientHeight >= log.scrollHeight - 30;
      log.innerHTML = chatHTML(mine.id);
      ui.hydrate(log);
      if (stick) { log.scrollTop = log.scrollHeight; }
    }
  });

  ui.pages.leagues = renderLeagues;
  ui.pages.crews = renderCrews;
})();
