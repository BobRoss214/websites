/*
 * Slot machines. One engine, five themed machines (Classic, Gold Rush, Deep Sea, Sweet Charity, Cosmic Spin).
 *
 * Every reel is one round: your gift is split evenly across the reels (you choose how many, from 3 up to 12), and
 * each reel stops on one charity, so a single pull can help many causes. Match the same charity on three or more
 * reels (in a pool of five or more) for a Triple Threat bonus.
 *
 * Fairness: the app draws each reel's charity uniformly from the pool before anything moves (see js/fair.js);
 * the reel then rolls to a strip that ends on that charity. The themes, the blur, the slow last reel, the win line and
 * the match banners are show: they do not change who wins. (Borrowed from real slot machines, as display only: a
 * payline with a drawn win line, escalating win tiers, and a "how it pays" guide.)
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var U = GS.util;

  var STD = [3, 4, 5, 6, 8, 10, 12];

  var THEMES = [
    {
      id: 'slots', cls: 'classic', name: 'Classic Slots', label: 'Classic', icon: 'cherry', title: 'GIVE ROLL', badge: '3 to 12 reels', defaultReels: 3,
      tagline: 'The original: a red-and-gold machine with a lever. Choose how many reels your gift splits across.',
      info: [
        'Pull the lever and the reels spin to charities. Your gift is split evenly across the reels, so one pull can help several causes. Start with three reels or go up to twelve.',
        'Land the same charity on three or more reels (in a pool of five or more) and you earn the Triple Threat bonus: extra XP and a shower of confetti.'
      ], fx: 0
    },
    {
      id: 'goldrush', cls: 'gold', name: 'Gold Rush', label: 'Gold Rush', icon: 'gem', title: 'GOLD RUSH', badge: '5 reels · mining', defaultReels: 5,
      tagline: 'Strike it rich for charity. A five-reel mining machine with drifting gold dust.',
      info: [
        'A prospector’s machine: five reels by default, each one a charity your gift is split across. Pick fewer reels for a bigger share on each, or up to twelve to spread the gold around.',
        'Three or more matching charities on the payline is a Triple Threat: bonus XP and confetti. The dust, the glow and the slow last reel are just for show; every reel is an equal-odds draw.'
      ], fx: 16
    },
    {
      id: 'deepsea', cls: 'sea', name: 'Deep Sea Treasure', label: 'Deep Sea', icon: 'waves', title: 'DEEP SEA', badge: '5 reels · ocean', defaultReels: 5,
      tagline: 'Dive for treasure. A five-reel ocean machine with rising bubbles.',
      info: [
        'Dive down and let the reels surface your charities. Five reels by default; choose from three to twelve and your gift splits evenly across them.',
        'Land the same charity on three or more reels for the Triple Threat bonus. The bubbles and waves are decoration; the draw is fair and equal for every charity.'
      ], fx: 14
    },
    {
      id: 'sweets', cls: 'sweets', name: 'Sweet Charity', label: 'Sweet Charity', icon: 'gift', title: 'SWEET CHARITY', badge: '6 reels · candy', defaultReels: 6,
      tagline: 'A six-reel candy machine with sprinkles. Sweet for you, sweeter for the charities.',
      info: [
        'A candy-coloured machine with six reels by default. Your gift is split across the reels, one charity each. Choose three to twelve.',
        'Three or more of the same charity on the payline earns the Triple Threat bonus. The sprinkles are just for fun; every charity has the same chance.'
      ], fx: 18
    },
    {
      id: 'cosmic', cls: 'cosmic', name: 'Cosmic Spin', label: 'Cosmic Spin', icon: 'rocket', title: 'COSMIC SPIN', badge: '8 reels · space', defaultReels: 8,
      tagline: 'Blast off with eight reels of charities under a twinkling sky.',
      info: [
        'The big machine: eight reels by default (up to twelve), so one pull can light up a whole constellation of causes. Fewer reels means a bigger share on each.',
        'Three or more matching charities earns the Triple Threat bonus. The stars and glow are decoration; every reel is an equal-odds draw.'
      ], fx: 26
    }
  ];

  // The size of the show for a match of n reels (a pair, then Triple Threat, then bigger and bigger).
  function tierName(n) {
    if (n >= 6) { return 'EPIC MATCH!'; }
    if (n === 5) { return 'MEGA MATCH!'; }
    if (n === 4) { return 'BIG MATCH!'; }
    if (n === 3) { return 'TRIPLE THREAT!'; }
    return 'PAIR';
  }

  function makeMachine(def) {
    var el = {};
    var api = null;
    var pool = [];
    var reels = [];       // { win, strip, visible: [charity x3] }
    var active = false;
    var locked = false;
    var spinning = false;
    var n = def.defaultReels;
    var turbo = false;
    var bannerTimer = 0;

    var game = {
      id: def.id,
      name: def.name,
      label: def.label,
      icon: def.icon,
      category: 'slots',
      badge: def.badge,
      tagline: def.tagline,
      cta: 'Pull the lever',
      fixedRounds: n,
      reelOptions: STD,
      defaultReels: def.defaultReels,
      info: def.info
    };

    /**
     * One symbol. While the reels stand still, the middle row (the payline) is a real button that opens the charity's profile (`mode` 'btn',
     * one tab stop for the whole row, arrow keys move along it), and the rows above and below are the same for a mouse or a finger (`mode` 'pic',
     * hidden from screen readers). While the reels spin they are plain pictures.
     */
    function tileHTML(ch, mode) {
      var m = GS.mono(ch);
      var inner = '<span class="sym__badge' + (GS.ui.hasLogo(ch) ? ' is-logo' : '') + '" data-len="' + m.length + '" data-mono="' + U.esc(m) + '">' + GS.ui.monoInner(ch) + '</span>' +
        '<span class="sym__name">' + U.esc(ch.short) + '</span>';
      var at = ' data-id="' + ch.id + '" style="--c:' + ch.accent + '"';
      if (mode === 'btn') { return '<button type="button" class="sym sym--btn"' + at + ' tabindex="-1" aria-label="About ' + U.esc(ch.short) + '" title="About ' + U.esc(ch.name) + '">' + inner + '</button>'; }
      if (mode === 'pic') { return '<div class="sym sym--pic"' + at + ' aria-hidden="true" title="About ' + U.esc(ch.name) + '">' + inner + '</div>'; }
      return '<div class="sym"' + at + '>' + inner + '</div>';
    }

    /** Switches the symbols on or off: they open a profile only while the machine stands still and is not busy (never during a spin or while the gift is being sent). */
    function syncTiles() {
      if (!el.reelsBox) { return; }
      var off = locked || spinning;
      Array.prototype.forEach.call(el.reelsBox.querySelectorAll('.sym--btn'), function (b) { b.disabled = off; });
      el.reelsBox.classList.toggle('is-clickable', !off);
      GS.ui.roveSync(el.reelsBox, '.sym--btn');
    }

    function randomFill(count, avoid) {
      var out = [];
      var prev = avoid;
      for (var i = 0; i < count; i++) {
        var c = core.pickOne(pool);
        var guard = 0;
        while (pool.length > 1 && prev && c.id === prev.id && guard++ < 6) { c = core.pickOne(pool); }
        out.push(c);
        prev = c;
      }
      return out;
    }

    function setStatic(r, list) {
      r.visible = list;
      r.strip.style.transition = 'none';
      r.strip.style.transform = 'translateY(0)';
      r.strip.innerHTML = list.map(function (c, i) { return tileHTML(c, i === 1 ? 'btn' : 'pic'); }).join('');
    }

    function clearMarks() {
      reels.forEach(function (r) { r.win.classList.remove('is-hit', 'is-match', 'is-lit', 'is-anticipate'); });
      el.machine.classList.remove('is-jackpot', 'is-anticipating');
      el.machine.removeAttribute('data-tier');
      if (el.winline) { el.winline.classList.remove('is-on'); }
      el.banner.classList.remove('is-on');
      el.banner.textContent = '';
    }

    function seedReels() {
      if (!pool.length || !reels.length) { return; }
      reels.forEach(function (r) { setStatic(r, randomFill(3, null)); });
      clearMarks();
      syncTiles();
    }

    /** Sizes the tiles to the width the reels actually have, so twelve reels still fit a phone. */
    function fit() {
      if (!el.stage || !el.reelsBox) { return; }
      var w = el.reelsBox.clientWidth || el.stage.clientWidth || 400;
      var per = w / n;
      var bs = Math.max(20, Math.min(56, Math.floor(per * 0.66)));
      var dense = per < 74;
      var th = bs + (dense ? 16 : 40);
      el.stage.style.setProperty('--bs', bs + 'px');
      el.stage.style.setProperty('--rh', (th * 3) + 'px');
      el.stage.classList.toggle('is-dense', dense);
    }

    function tileH() { return reels[0].win.clientHeight / 3; }

    function buildReels() {
      var html = '';
      for (var i = 0; i < n; i++) { html += '<div class="reel" data-role="reel"><div class="reel__strip"></div></div>'; }
      el.reelsBox.innerHTML = html;
      el.reelsBox.style.gridTemplateColumns = 'repeat(' + n + ', minmax(0, 1fr))';
      el.stage.style.setProperty('--n', String(n));
      el.stage.setAttribute('data-n', String(n));
      reels = Array.prototype.map.call(el.reelsBox.querySelectorAll('[data-role="reel"]'), function (w) {
        return { win: w, strip: w.querySelector('.reel__strip'), visible: [] };
      });
      fit();
      seedReels();
    }

    function fxHTML() {
      var out = '';
      for (var i = 0; i < def.fx; i++) {
        out += '<i style="--x:' + Math.round(Math.random() * 100) + '%;--s:' + (3 + Math.random() * 6).toFixed(1) + 'px;--d:' + (6 + Math.random() * 9).toFixed(1) + 's;--dl:-' + (Math.random() * 12).toFixed(1) + 's;--h:' + Math.round(Math.random() * 360) + '"></i>';
      }
      return out;
    }

    // Rolls a little past the stop (0.22 of a tile, whatever the distance), then settles back with a clunk.
    var OVERSHOOT = 0.22;
    function reelPosition(t, finalK) {
      if (t < 0.88) { return (finalK + OVERSHOOT) * U.easeOutCubic(t / 0.88); }
      return finalK + OVERSHOOT * (1 - U.easeInOut((t - 0.88) / 0.12));
    }

    function note() {
      if (!el.note) { return; }
      el.note.textContent = n + ' reels: your gift is split evenly across them, one charity each. Every reel is an equal-odds draw from your pool. Three or more of the same charity earns a Triple Threat bonus.';
    }

    /** The app tells the machine how many reels the player chose. */
    game.setReels = function (count) {
      count = Math.max(2, Math.min(12, Math.floor(count) || def.defaultReels));
      game.fixedRounds = count;
      if (count === n && reels.length) { return; }
      n = count;
      if (!el.machine || spinning) { return; }
      buildReels();
      note();
    };

    game.mount = function (container, gameApi) {
      api = gameApi;
      container.innerHTML =
        '<div class="slots slots--' + def.cls + '" data-role="stage">' +
          '<div class="slots__machine" data-role="machine">' +
            '<div class="slots__fx" aria-hidden="true">' + fxHTML() + '</div>' +
            '<div class="slots__top"><span class="slots__lights" aria-hidden="true"></span><span class="slots__title">' + GS.icon(def.icon) + '<span>' + def.title + '</span></span><span class="slots__lights" aria-hidden="true"></span></div>' +
            '<div class="slots__window">' +
              '<div class="slots__reels" data-role="reels" role="group" aria-label="The charities on the payline. Press one to read about it."></div>' +
              '<div class="slots__payline" aria-hidden="true"><i></i><i></i></div>' +
              '<div class="slots__winline" data-role="winline" aria-hidden="true"></div>' +
              '<div class="slots__banner" data-role="banner" role="status" aria-live="polite"></div>' +
            '</div>' +
            '<div class="slots__bar">' +
              '<span class="slots__tools">' +
                '<button type="button" class="slots__turbo" data-role="turbo" aria-pressed="false">' + GS.icon('zap') + 'Turbo</button>' +
                '<button type="button" class="slots__turbo slots__guidebtn" data-role="guide">' + GS.icon('circle-help') + 'How it pays</button>' +
              '</span>' +
              '<button type="button" class="slots__spin" data-role="spin">' + GS.icon('play') + '<span>Spin</span></button>' +
            '</div>' +
            '<button type="button" class="slots__lever" data-role="lever" aria-label="Pull the lever"><span class="slots__knob"></span><span class="slots__arm"></span></button>' +
          '</div>' +
        '</div>' +
        '<p class="game-note" data-role="note"></p>';
      el.machine = container.querySelector('[data-role="machine"]');
      el.note = container.querySelector('[data-role="note"]');
      el.lever = container.querySelector('[data-role="lever"]');
      el.spin = container.querySelector('[data-role="spin"]');
      el.turbo = container.querySelector('[data-role="turbo"]');
      el.banner = container.querySelector('[data-role="banner"]');
      el.winline = container.querySelector('[data-role="winline"]');
      el.guide = container.querySelector('[data-role="guide"]');
      el.reelsBox = container.querySelector('[data-role="reels"]');
      el.stage = container.querySelector('[data-role="stage"]');
      el.lever.addEventListener('click', function () { if (!locked) { api.requestPlay(); } });
      el.spin.addEventListener('click', function () { if (!locked) { api.requestPlay(); } });
      el.turbo.addEventListener('click', function () {
        turbo = !turbo;
        el.turbo.setAttribute('aria-pressed', String(turbo));
        GS.audio.click();
      });
      el.guide.addEventListener('click', function () { openGuide(); });
      // a click or tap on a symbol opens that charity's profile, but only while the machine stands still (the spin button and the lever keep their own click)
      el.reelsBox.addEventListener('click', function (e) {
        var sym = e.target.closest ? e.target.closest('.sym[data-id]') : null;
        if (!sym || spinning || locked || !GS.ui.charity) { return; }
        GS.ui.charity.openProfile(sym.getAttribute('data-id'));
      });
      GS.ui.rove(el.reelsBox, '.sym--btn');
      buildReels();
      note();
      U.observeSize(el.stage, function () { fit(); });
    };

    game.setPool = function (list) {
      pool = list.slice();
      if (!spinning) { seedReels(); }
    };

    game.activate = function () { active = true; fit(); };
    game.deactivate = function () { active = false; };

    game.lock = function (isLocked) {
      locked = !!isLocked;
      syncTiles();
      if (el.lever) { el.lever.disabled = locked; }
      if (el.spin) { el.spin.disabled = locked; }
      if (el.machine) { el.machine.classList.toggle('is-busy', locked); }
    };

    function showBanner(text, strong) {
      clearTimeout(bannerTimer);
      el.banner.textContent = text;
      el.banner.classList.toggle('is-strong', !!strong);
      el.banner.classList.add('is-on');
      bannerTimer = setTimeout(function () { el.banner.classList.remove('is-on'); }, strong ? 2600 : 1700);
    }

    /** Draws the win line through the middle row, from the first matching reel to the last. */
    function drawWinLine(idxs) {
      if (!el.winline || idxs.length < 2 || !reels.length) { return; }
      var a = reels[idxs[0]].win;
      var b = reels[idxs[idxs.length - 1]].win;
      var x1 = a.offsetLeft + a.offsetWidth / 2;
      var x2 = b.offsetLeft + b.offsetWidth / 2;
      el.winline.style.left = x1 + 'px';
      el.winline.style.width = Math.max(4, x2 - x1) + 'px';
      el.winline.classList.remove('is-on');
      void el.winline.offsetWidth;
      el.winline.classList.add('is-on');
    }

    /** "How it pays": a plain-language paytable (nothing here pays you; it shows what each match earns). */
    function openGuide() {
      var m = GS.ui.modal('slotguide');
      var rows = [[2, 'PAIR', 'Two reels land on the same charity. A quick flash, no bonus.'],
                  [3, 'TRIPLE THREAT', 'Three or more reels on the same charity (on a board of five or more). Bonus XP, confetti and the Triple Threat badge.'],
                  [4, 'BIG MATCH', 'Four on the same charity. A bigger light show.'],
                  [5, 'MEGA MATCH', 'Five on the same charity. An even bigger show.'],
                  [6, 'EPIC MATCH', 'Six or more. The biggest show the machine has.']];
      var list = rows.map(function (r) {
        return '<li class="sg-row sg-t' + r[0] + '"><span class="sg-n" aria-hidden="true">' + (r[0] === 6 ? '6+' : r[0]) + '</span><span><b>' + r[1] + '</b><br>' + r[2] + '</span></li>';
      }).join('');
      m.set(
        '<h2 class="modal__title" id="dlg-slotguide-title">How ' + U.esc(def.name) + ' pays</h2>' +
        '<p class="modal__sub">Nothing on this machine pays you. Your gift is split evenly across the reels, one charity each, and every one of those shares really goes to the charity that lands.</p>' +
        '<ul class="sg-list">' + list + '</ul>' +
        '<p class="sg-foot">Every reel is a fair, equal-odds draw from the board of <b>' + Number(pool.length).toLocaleString('en-US') + '</b> charities. The lights, the win line and the slow last reel are only for show: they never change who wins. Tap Fair Play? in the menu to check any spin yourself.</p>'
      );
      m.open();
    }

    /** One pull = every reel. Resolves with the winning charity of each reel. */
    game.play = function (opts) {
      return new Promise(function (resolve) {
        if (!pool.length || !opts.winners || opts.winners.length < n) { resolve([]); return; }
        spinning = true;
        clearMarks();
        syncTiles();
        el.machine.classList.add('is-pulled');
        setTimeout(function () { el.machine.classList.remove('is-pulled'); }, 420);
        GS.audio.whoosh();

        var H = tileH();
        var winners = opts.winners.slice(0, n);
        var finished = 0;
        var t0 = performance.now();
        var speed = turbo ? 0.45 : 1;
        var stagger = (n <= 5 ? 800 : n <= 8 ? 460 : 320) * speed;

        // does the last reel complete a match of three or more? Then it takes its time, as real machines do.
        var lastId = winners[n - 1].id;
        var priorSame = winners.slice(0, n - 1).filter(function (w) { return w.id === lastId; }).length;
        var anticipate = priorSame >= 2 && !turbo;

        var plans = reels.map(function (r, idx) {
          var winner = winners[idx];                // drawn fairly by the app before any reel moves
          var fillCount = Math.min(50, 14 + idx * 3);
          var head = r.visible.slice();
          var fill = randomFill(fillCount, head[2]);
          var pre = core.pickOne(pool);
          var post = core.pickOne(pool);
          var winnerIdx = head.length + fill.length + 1;
          // Two padding tiles after the stop so the overshoot never shows an empty gap.
          var items = head.concat(fill, [pre, winner, post, core.pickOne(pool), core.pickOne(pool)]);
          r.strip.style.transition = 'none';
          r.strip.style.transform = 'translateY(0)';
          r.strip.innerHTML = items.map(function (c) { return tileHTML(c); }).join('');
          r.win.classList.add('is-spinning');
          var dur = (1900 * speed) + idx * stagger + (anticipate && idx === n - 1 ? 1300 : 0);
          return {
            reel: r, items: items, winner: winner, idx: idx, winnerIdx: winnerIdx,
            finalK: winnerIdx - 1,              // the middle row shows items[k + 1]
            dur: U.dur(dur), lastTick: 0, done: false
          };
        });

        if (anticipate) {
          var lastPlan = plans[n - 1];
          setTimeout(function () {
            if (spinning && !lastPlan.done) { el.machine.classList.add('is-anticipating'); lastPlan.reel.win.classList.add('is-anticipate'); GS.audio.tick(0.5); }
          }, Math.max(0, plans[n - 2].dur - 120));
        }

        (function frame(now) {
          var p;
          for (var i = 0; i < plans.length; i++) {
            p = plans[i];
            if (p.done) { continue; }
            var t = Math.min(1, (now - t0) / p.dur);
            var k = reelPosition(t, p.finalK);
            p.reel.strip.style.transform = 'translateY(' + (-k * H).toFixed(1) + 'px)';
            var whole = Math.floor(k);
            if (whole !== p.lastTick) {
              p.lastTick = whole;
              if (t < 0.97 && (n <= 5 || p.idx % 2 === 0)) { GS.audio.tick(0.2 + 0.2 * Math.min(1, p.idx / 4)); }
            }
            if (t >= 1) {
              p.done = true;
              p.reel.strip.style.transform = 'translateY(' + (-p.finalK * H) + 'px)';
              p.reel.win.classList.remove('is-spinning', 'is-anticipate');
              p.reel.win.classList.add('is-hit');
              p.reel.visible = p.items.slice(p.winnerIdx - 1, p.winnerIdx + 2);
              GS.audio.reelStop();
              if (opts && opts.onReveal) { opts.onReveal(p.idx, p.winner); }
              finished += 1;
            }
          }
          if (finished < plans.length) {
            requestAnimationFrame(frame);
          } else {
            spinning = false;
            el.machine.classList.remove('is-anticipating');
            // Re-seat each strip to just the three visible tiles (visually identical, keeps the DOM small).
            plans.forEach(function (pl) { setStatic(pl.reel, pl.reel.visible); });
            syncTiles();
            // matches: any charity on two or more reels
            var counts = {};
            winners.forEach(function (w) { counts[w.id] = (counts[w.id] || 0) + 1; });
            var best = 0, bestId = '';
            Object.keys(counts).forEach(function (id) { if (counts[id] > best) { best = counts[id]; bestId = id; } });
            // sweep the payline left to right, lighting the matches
            reels.forEach(function (r, i) {
              setTimeout(function () {
                r.win.classList.add('is-lit');
                if (counts[winners[i].id] >= 2) { r.win.classList.add('is-match'); }
              }, i * (turbo ? 25 : 70));
            });
            var hitIdx = [];
            winners.forEach(function (w, i) { if (w.id === bestId) { hitIdx.push(i); } });
            if (best >= 3) {
              var tier = Math.min(best, 6);
              el.machine.setAttribute('data-tier', String(tier));
              el.machine.classList.add('is-jackpot');
              setTimeout(function () { drawWinLine(hitIdx); }, turbo ? 120 : 380);
              showBanner(tierName(best) + ' ' + best + ' × ' + GS.charity(bestId).short, true);
              if (tier >= 4) {
                GS.audio.coin();
                var rect = el.machine.getBoundingClientRect();
                GS.confetti.burst({ x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.4, count: 40 + tier * 24, power: 1000, gravity: 1250 });
              }
            } else if (best === 2 && n >= 3) {
              el.machine.setAttribute('data-tier', '2');
              setTimeout(function () { drawWinLine(hitIdx); }, turbo ? 120 : 380);
              showBanner(tierName(2) + ' · ' + GS.charity(bestId).short, false);
            }
            U.sleep(turbo ? 350 : 650).then(function () { resolve(winners); });
          }
        })(performance.now());
      });
    };

    /** Test hooks: charities currently on the payline (middle row), left to right. */
    game._paylineIds = function () { return reels.map(function (r) { return r.visible[1] && r.visible[1].id; }); };
    game._shown = game._paylineIds;
    game._reels = function () { return reels.length; };

    GS.games[def.id] = game;
    return game;
  }

  THEMES.forEach(makeMachine);
  GS.slotThemes = THEMES;
})();
