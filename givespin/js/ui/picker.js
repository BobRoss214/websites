/*
 * A searchable charity picker (a dialog). Used to back a charity in a solo game and to add a charity to a live table.
 *
 *   GS.ui.pickCharity({ title, sub, charities, note(c) -> small text, random: true, onPick(id) })
 */
(function () {
  'use strict';
  var GS = window.GS;
  var ui = GS.ui;
  var esc = ui.esc;

  function pickCharity(opts) {
    var list = opts.charities || GS.charities;
    var m = ui.modal('charitypick');
    m.set(
      '<h2 class="modal__title" id="dlg-charitypick-title">' + esc(opts.title || 'Choose a charity') + '</h2>' +
      (opts.sub ? '<p class="modal__sub">' + esc(opts.sub) + '</p>' : '') +
      '<label class="sr-only" for="cp-q">Search charities</label><input id="cp-q" class="input" type="search" placeholder="Search by name or cause" autocomplete="off" spellcheck="false">' +
      (opts.random ? '<button type="button" class="btn btn--sm cp-random" data-role="random">' + ui.icon('shuffle') + 'Surprise me</button>' : '') +
      '<ul class="picklist" data-role="list"></ul>'
    );
    var q = m.$('#cp-q');
    var box = m.$('[data-role="list"]');
    var shown = [];

    function paint() {
      var term = q.value.trim().toLowerCase();
      shown = list.filter(function (c) {
        return !term || (c.name + ' ' + c.short + ' ' + c.causes.map(function (x) { return GS.cause(x).name; }).join(' ')).toLowerCase().indexOf(term) >= 0;
      }).sort(function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; }).slice(0, 40);
      box.innerHTML = shown.length ? shown.map(function (c) {
        var extra = opts.note ? opts.note(c) : '';
        return '<li><button type="button" class="pickitem" data-id="' + c.id + '" style="--c:' + c.accent + '">' + ui.mono(c, 32) +
          '<span class="pickitem__t"><b>' + esc(c.name) + '</b><small>' + esc(c.causes.map(function (x) { return GS.cause(x).name; }).slice(0, 2).join(' · ')) + (extra ? ' · ' + esc(extra) : '') + '</small></span></button></li>';
      }).join('') : '<li class="empty">No charity matches “' + esc(q.value) + '”.</li>';
    }

    function choose(id) {
      m.close();
      if (opts.onPick) { opts.onPick(id); }
    }

    q.oninput = paint;
    box.onclick = function (e) {
      var b = e.target.closest('[data-id]');
      if (b) { choose(b.getAttribute('data-id')); }
    };
    var rnd = m.$('[data-role="random"]');
    if (rnd) { rnd.onclick = function () { choose(list[Math.floor(Math.random() * list.length)].id); }; }
    paint();
    m.open();
    q.focus();
  }

  ui.pickCharity = pickCharity;
})();
