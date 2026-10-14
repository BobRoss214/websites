/*
 * The "Track" picker of a race game. Any crowd game can offer variants (see spec.variants in js/games/crowd.js); Marble Run offers its tracks.
 *
 *   var picker = GS.ui.variants.mount(box, { onPick: function (id) { ... } });
 *   picker.update(spec.variants, { choice: 'switchback' | 'random' | ..., next: 'spiral', locked: false });
 *
 * It draws a labelled group of tiles: a small picture of each track (drawn by spec.variants.thumb on a canvas), its name, the chosen one outlined,
 * and (when the game can say what the next round will use, spec.variants.next) a "Surprise me" tile that picks a different track every round and
 * shows which one comes next. The group is one tab stop: the arrow keys (and Home and End) move between the tiles, Space or Enter chooses one.
 * The whole picker folds up into a one-line summary ("Track · Switchback"). While a round runs the tiles are switched off, like the size control.
 * Choosing writes nothing itself: the game panel (js/ui/game.js) stores the choice and deals the board again.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var ui = GS.ui;
  var esc = ui.esc;

  var PIC_W = 96;   // the picture on a tile, in CSS pixels: it is drawn at the screen's pixel density and shown at the width of the tile
  var PIC_H = 64;

  function nameOf(items, id) {
    for (var i = 0; i < items.length; i++) { if (items[i].id === id) { return items[i].name; } }
    return '';
  }

  function blurbOf(items, id) {
    for (var i = 0; i < items.length; i++) { if (items[i].id === id) { return items[i].blurb || ''; } }
    return '';
  }

  /** Draws one tile's picture; a thumb that throws leaves an empty picture instead of breaking the panel. */
  function drawPic(canvas, spec, id) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(PIC_W * dpr);
    canvas.height = Math.round(PIC_H * dpr);
    var ctx = canvas.getContext('2d');
    if (!ctx || !spec.thumb) { return; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    try { spec.thumb(id, ctx, PIC_W, PIC_H); } catch (err) { if (window.console) { console.error(err); } }
  }

  function mount(box, o) {
    var st = { sig: '', items: [], spec: null };
    box.innerHTML =
      '<details class="variants" data-role="det" open>' +
        '<summary class="variants__head"><span class="field__label" id="variants-label" data-role="label"></span> <span class="variants__now" data-role="now"></span></summary>' +
        '<div class="variants__body">' +
          '<div class="variants__grid" role="radiogroup" aria-labelledby="variants-label" data-role="grid"></div>' +
          '<p class="field__hint variants__hint" data-role="hint" aria-live="polite"></p>' +
        '</div>' +
        '<div hidden data-role="descs"></div>' +
      '</details>';
    var grid = box.querySelector('[data-role="grid"]');
    var descs = box.querySelector('[data-role="descs"]');
    var label = box.querySelector('[data-role="label"]');
    var now = box.querySelector('[data-role="now"]');
    var hint = box.querySelector('[data-role="hint"]');

    ui.rove(grid, '.vtile');   // one tab stop: arrow keys, Home and End move between the tiles
    grid.addEventListener('click', function (e) {
      var b = e.target.closest('.vtile');
      if (!b || b.disabled) { return; }
      if (o.onPick) { o.onPick(b.getAttribute('data-v')); }
    });

    function build(spec, items, withRandom) {
      var html = '';
      var d = '';
      items.forEach(function (it) {
        html += '<button type="button" class="vtile" role="radio" aria-checked="false" tabindex="-1" data-v="' + esc(it.id) + '" aria-describedby="vtd-' + esc(it.id) + '">' +
          '<canvas class="vtile__pic" aria-hidden="true"></canvas><span class="vtile__name">' + esc(it.name) + '</span></button>';
        d += '<span id="vtd-' + esc(it.id) + '">' + esc(it.blurb || '') + '</span>';
      });
      if (withRandom) {
        html += '<button type="button" class="vtile vtile--random" role="radio" aria-checked="false" tabindex="-1" data-v="random" aria-describedby="vtd-random">' +
          '<span class="vtile__pic vtile__pic--random" aria-hidden="true">' + ui.icon('shuffle') + '</span><span class="vtile__name">Surprise me</span><span class="vtile__sub" data-role="sub"></span></button>';
        d += '<span id="vtd-random">A different ' + esc((spec.label || 'track').toLowerCase()) + ' every round.</span>';
      }
      grid.innerHTML = html;
      descs.innerHTML = d;
      items.forEach(function (it) {
        var c = grid.querySelector('.vtile[data-v="' + it.id + '"] canvas');
        if (c) { drawPic(c, spec, it.id); }
      });
    }

    /** Draws the picker, or brings it up to date. `view` = { choice: the selected tile ('random' for Surprise me), next: what the next round uses, locked }. */
    function update(spec, view) {
      var items = (spec.items ? spec.items() : []) || [];
      var withRandom = typeof spec.next === 'function' && spec.random !== false;
      var sig = (spec.label || '') + '|' + (withRandom ? 'r' : '-') + '|' + (window.devicePixelRatio || 1) + '|' + items.map(function (it) { return it.id + ':' + it.name; }).join(',');
      if (sig !== st.sig) { st.sig = sig; st.spec = spec; build(spec, items, withRandom); }
      st.items = items;
      var lab = spec.label || 'Track';
      var choice = view.choice;
      var next = view.next || '';
      label.textContent = lab;
      Array.prototype.forEach.call(grid.querySelectorAll('.vtile'), function (b) {
        var on = b.getAttribute('data-v') === choice;
        b.setAttribute('aria-checked', String(on));
        b.classList.toggle('is-on', on);
        b.disabled = !!view.locked;
        // the chosen tile is the tab stop (a tile the keyboard is on keeps it until focus leaves the group)
        if (!grid.contains(document.activeElement)) { b.tabIndex = on ? 0 : -1; }
      });
      if (!grid.querySelector('.vtile[tabindex="0"]')) { var first = grid.querySelector('.vtile'); if (first) { first.tabIndex = 0; } }
      var sub = grid.querySelector('.vtile--random [data-role="sub"]');
      if (sub) { sub.textContent = choice === 'random' && nameOf(items, next) ? 'Next: ' + nameOf(items, next) : ''; }   // (only when Surprise me is the choice: otherwise the next round is the chosen track)
      box.classList.toggle('is-locked', !!view.locked);
      var oddsLine = 'Whichever ' + lab.toLowerCase() + ' you pick, every charity on the board has exactly the same chance.';
      var nextName = nameOf(items, next);
      var summary = choice === 'random' ? 'Surprise me' + (nextName ? ' · next: ' + nextName : '') : nameOf(items, choice);
      var line = choice === 'random'
        ? 'A different ' + lab.toLowerCase() + ' every round' + (nextName ? '. Next round: ' + nextName : '') + '. ' + oddsLine
        : (blurbOf(items, choice) ? blurbOf(items, choice) + ' ' : '') + oddsLine;
      // (only written when it changed: the hint is a live region and the panel is refreshed often)
      if (now.textContent !== summary) { now.textContent = summary; }
      if (hint.textContent !== line) { hint.textContent = line; }
    }

    return { update: update };
  }

  ui.variants = { mount: mount };
})();
