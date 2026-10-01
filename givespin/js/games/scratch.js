/*
 * Scratch Card. Buy a card, scratch the silver foil with your finger or mouse, and find three matching charities.
 *
 * Fairness: the app draws the winner from the whole pool (see js/fair.js) before the card is printed. Three panels
 * hold the winner; the rest hold decoys (never three of the same, so a match is never ambiguous). Scratching
 * only reveals what is already there.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var U = GS.util;

  var size = 6;           // panels on the card
  var MIN_SIZE = 4;       // three matching panels plus at least one decoy
  var BRUSH = 15;
  var REVEAL_AT = 0.5;

  var el = {};
  var api = null;
  var pool = [];
  var panels = [];       // { el, canvas, ctx, charity, revealed }
  var state = 'idle';    // idle | playing | done
  var winner = null;
  var finish = null;
  var result = null;
  var active = false;
  var locked = false;
  var drawing = null;

  function underHTML(ch) {
    if (!ch) { return ''; }
    var m = GS.mono(ch);
    return GS.ui.mono(ch, 44) + '<span class="spanel__name">' + U.esc(ch.short) + '</span>';
  }

  function buildPanels(n) {
    el.grid.style.setProperty('--cols', String(n <= 6 ? 3 : n <= 12 ? 4 : 6));
    el.card.classList.toggle('scard--big', n > 6);
    el.grid.innerHTML = '';
    panels = [];
    for (var i = 0; i < n; i++) {
      var d = document.createElement('div');
      d.className = 'spanel';
      d.innerHTML = '<div class="spanel__under"></div><canvas class="spanel__foil" aria-hidden="true"></canvas>' +
        '<button type="button" class="spanel__btn" disabled aria-label="Panel ' + (i + 1) + ' of ' + n + ', covered"></button>';
      el.grid.appendChild(d);
      var c = d.querySelector('canvas');
      panels.push({ el: d, under: d.querySelector('.spanel__under'), canvas: c, ctx: c.getContext('2d', { willReadFrequently: true }), btn: d.querySelector('button'), charity: null, revealed: false, checks: 0 });
      wire(panels[i], i);
    }
  }

  function paintFoil(p) {
    var c = p.canvas;
    var w = Math.max(20, Math.round(p.el.clientWidth));
    var h = Math.max(20, Math.round(p.el.clientHeight));
    c.width = w;
    c.height = h;
    var g = p.ctx;
    g.globalCompositeOperation = 'source-over';
    var grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#d5dee4');
    grad.addColorStop(0.45, '#9db0bc');
    grad.addColorStop(1, '#d9e2e7');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 1;
    for (var x = -h; x < w; x += 9) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + h, 0); g.stroke(); }
    g.fillStyle = 'rgba(52,72,86,0.55)';
    g.font = '800 ' + Math.round(h * 0.42) + 'px "Sora", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('?', w / 2, h / 2 + 2);
  }

  function layout() {
    panels.forEach(function (p) { if (!p.revealed) { paintFoil(p); } });
  }

  function cleared(p) {
    var w = p.canvas.width, h = p.canvas.height;
    var d = p.ctx.getImageData(0, 0, w, h).data;
    var total = 0, clear = 0;
    for (var y = 0; y < h; y += 3) {
      for (var x = 0; x < w; x += 3) { total += 1; if (d[(y * w + x) * 4 + 3] < 40) { clear += 1; } }
    }
    return total ? clear / total : 0;
  }

  function reveal(p, silent) {
    if (p.revealed) { return; }
    p.revealed = true;
    p.el.classList.add('is-revealed');
    p.btn.disabled = true;
    p.btn.setAttribute('aria-label', 'Panel revealed: ' + (p.charity ? p.charity.name : ''));
    if (!silent) { GS.audio.flip(); }
    check();
  }

  function check() {
    if (state !== 'playing') { return; }
    var matches = panels.filter(function (p) { return p.revealed && p.charity && p.charity.id === winner.id; }).length;
    el.prompt.textContent = matches ? matches + ' of 3 matching' : 'Scratch to reveal. Find 3 that match!';
    if (matches >= 3) { complete(); }
  }

  function complete() {
    state = 'done';
    el.reveal.hidden = true;
    panels.forEach(function (p) {
      if (!p.revealed) { p.revealed = true; p.el.classList.add('is-revealed', 'is-late'); }
      p.btn.disabled = true;
      if (p.charity.id === winner.id) { p.el.classList.add('is-win'); }
      else { p.el.classList.add('is-dim'); }
    });
    result = winner;
    el.prompt.textContent = 'Three of a kind: ' + winner.name + '!';
    U.sleep(800).then(function () { var f = finish; finish = null; if (f) { f(winner); } });
  }

  function wire(p, i) {
    var c = p.canvas;
    function pos(e) {
      var r = c.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
    }
    c.addEventListener('pointerdown', function (e) {
      if (state !== 'playing' || p.revealed) { return; }
      drawing = { p: p, last: pos(e), n: 0 };
      try { c.setPointerCapture(e.pointerId); } catch (err) { /* not supported */ }
      stroke(p, drawing.last, drawing.last);
      e.preventDefault();
    });
    c.addEventListener('pointermove', function (e) {
      if (!drawing || drawing.p !== p) { return; }
      var q = pos(e);
      stroke(p, drawing.last, q);
      drawing.last = q;
      drawing.n += 1;
      if (drawing.n % 6 === 0) { GS.audio.scratch(); evaluate(p); }
    });
    function up() { if (drawing && drawing.p === p) { drawing = null; evaluate(p); } }
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    p.btn.addEventListener('click', function () { if (state === 'playing') { reveal(p); } });
  }

  function stroke(p, a, b) {
    var g = p.ctx;
    g.globalCompositeOperation = 'destination-out';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = BRUSH * 2;
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x + 0.01, b.y);
    g.stroke();
  }

  function evaluate(p) {
    if (p.revealed || state !== 'playing') { return; }
    if (cleared(p) >= REVEAL_AT) { reveal(p); }
  }

  /** Prints the card: three panels hold the winner, the rest hold decoys. */
  function deal(w) {
    winner = w;
    result = null;
    var others = core.shuffle(pool.filter(function (c) { return c.id !== w.id; }));
    var want = Math.max(0, Math.min(size - 3, others.length * 2));
    var decoys = [];
    for (var k = 0; k < want; k++) { decoys.push(others[k % others.length]); }
    var all = core.shuffle([w, w, w].concat(decoys));
    buildPanels(all.length);
    panels.forEach(function (p, i) {
      p.charity = all[i];
      p.under.innerHTML = underHTML(all[i]);
      p.btn.disabled = false;
    });
    layout();
  }

  function autoReveal() {
    var order = panels.map(function (p, i) { return i; });
    // reveal the three matches first so the card resolves quickly
    order.sort(function (a, b) { return (panels[b].charity.id === winner.id ? 1 : 0) - (panels[a].charity.id === winner.id ? 1 : 0); });
    order.forEach(function (idx, j) {
      setTimeout(function () { if (state === 'playing') { reveal(panels[idx], true); } }, U.dur(260 * (j + 1)));
    });
  }

  function playOne(w, quick) {
    return new Promise(function (resolve) {
      finish = resolve;
      deal(w);
      state = 'playing';
      el.card.classList.add('is-live');
      el.prompt.textContent = 'Scratch to reveal. Find 3 that match!';
      el.reveal.hidden = false;
      el.reveal.onclick = function () { panels.forEach(function (p) { if (!p.revealed) { p.revealed = true; p.el.classList.add('is-revealed'); } }); check(); };
      GS.audio.shuffle();
      if (quick || GS.timeScale < 1) { autoReveal(); }
    });
  }

  function updateNote() {
    if (!el.note) { return; }
    el.note.textContent = pool.length ? 'The winner is drawn from the ' + pool.length + ' charities on this card before it is printed (each has equal odds). Scratching only reveals what is already there.' : '';
  }

  GS.games.scratch = {
    id: 'scratch',
    name: 'Scratch Cards',
    label: 'Scratch',
    icon: 'ticket',
    category: 'instant',
    badge: 'Up to 48 panels',
    maxSize: 48,
    minSize: 4,
    sizes: [{ n: 6, name: 'Classic' }, { n: 12, name: 'Big' }, { n: 24, name: 'Mega' }, { n: 48, name: 'Jumbo' }],
    defaultSize: 6,
    tagline: 'Scratch the foil. Match three charities to win.',
    cta: 'Buy a card',
    info: [
      'Buy a card and scratch the silver foil with your finger or mouse. Find three panels showing the same charity and that charity gets your gift. Set the card to any number of panels, up to 48. Each panel opens once you have scratched about half of it.',
      'In a hurry, or using a keyboard? Press Tab to move between panels and Enter to reveal them, or tap Reveal all.'
    ],

    mount: function (container, gameApi) {
      api = gameApi;
      container.innerHTML =
        '<div class="scratch">' +
          '<div class="scard" data-role="card"><div class="scard__head"><b>GIVING CARD</b><small>Match 3 charities to win</small></div>' +
            '<div class="scard__grid" data-role="grid"></div></div>' +
          '<p class="scratch__prompt" data-role="prompt" aria-live="polite"></p>' +
          '<div class="scratch__act"><button type="button" class="gbtn" data-role="buy">' + GS.icon('ticket') + '<span>Buy card</span></button>' +
          '<button type="button" class="gbtn gbtn--ghost" data-role="reveal" hidden>' + GS.icon('eraser') + '<span>Reveal all</span></button></div>' +
        '</div>' +
        '<p class="game-note" data-role="note"></p>';
      el.card = container.querySelector('[data-role="card"]');
      el.grid = container.querySelector('[data-role="grid"]');
      el.prompt = container.querySelector('[data-role="prompt"]');
      el.buy = container.querySelector('[data-role="buy"]');
      el.reveal = container.querySelector('[data-role="reveal"]');
      el.note = container.querySelector('[data-role="note"]');
      el.buy.addEventListener('click', function () { if (!locked) { api.requestPlay(); } });
      buildPanels(size);
      el.prompt.textContent = 'Buy a card to start scratching.';
      U.observeSize(el.card, function () { if (state !== 'playing') { layout(); } });
    },

    setSize: function (n) { size = n; if (state !== 'playing') { state = 'idle'; buildPanels(size); layout(); el.card.classList.remove('is-live'); } },
    /** A card of n panels has the winner on three of them and n - 3 other charities, so n - 2 charities in all. */
    fieldFor: function (n) { return Math.max(2, n - 2); },
    /** The board for the next card: the charities on it (what the winner is drawn from) and how many panels. */
    setBoard: function (list, n) {
      pool = list.slice();
      size = n;
      updateNote();
      if (state !== 'playing') { state = 'idle'; buildPanels(size); layout(); el.card.classList.remove('is-live'); el.prompt.textContent = pool.length ? 'Buy a card to start scratching.' : ''; }
    },
    setPool: function (list) {
      pool = list.slice();
      updateNote();
      if (state !== 'playing') { state = 'idle'; buildPanels(size); layout(); el.card.classList.remove('is-live'); el.prompt.textContent = pool.length ? 'Buy a card to start scratching.' : ''; }
    },

    activate: function () { active = true; if (state !== 'playing') { layout(); } },
    deactivate: function () { active = false; },

    lock: function (isLocked) {
      locked = !!isLocked;
      if (el.buy) { el.buy.disabled = locked; }
    },

    play: function (opts) {
      var winners = opts.winners;
      var count = winners.length;
      var quick = !!opts.quick || count > 1;
      var i = 0;
      return new Promise(function (resolve) {
        (function next() {
          if (i >= count) { resolve(winners); return; }
          if (opts.onRound) { opts.onRound(i, count); }
          playOne(winners[i], quick).then(function (w) {
            if (opts.onReveal) { opts.onReveal(i, w); }
            i += 1;
            return U.sleep(count > 1 ? 500 : 400);
          }).then(next);
        })();
      });
    },

    _shown: function () { return result ? [result.id] : []; },
    /** Test hook: how many panels currently show the winner, revealed or not. */
    _matches: function () { return winner ? panels.filter(function (p) { return p.charity && p.charity.id === winner.id; }).length : 0; }
  };
})();
