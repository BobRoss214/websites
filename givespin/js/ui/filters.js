/*
 * Filters: the full filter dialog (causes, who they help, where, how, when founded), the quick cause
 * chips shown next to the bet panel, and the "N charities in play" line. Changes apply instantly and the
 * live count updates as you tap.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var ui = GS.ui;
  var esc = ui.esc;
  var store = GS.store;

  var QUICK = ['kids', 'animals', 'planet', 'hunger', 'health', 'education', 'veterans', 'disaster', 'mental', 'water', 'women', 'arts'];
  var MIN_FACET = 3; // a filter value that fewer than this many charities have is hidden: it would just empty the pool
  var counts = null;
  var modal = null;

  function facetCounts() { return counts || (counts = core.facetCounts(GS.charities)); }
  function current() { return core.normalizeFilters(store.prefs().filters); }
  function save(f) { store.setPref('filters', f); GS.app.refreshPool(); }

  function toggled(list, id) {
    var i = list.indexOf(id);
    var out = list.slice();
    if (i >= 0) { out.splice(i, 1); } else { out.push(id); }
    return out;
  }

  /* ------------------------------------------------------------ pool line */

  function poolLine() {
    var n = GS.app.state.pool.length;
    var f = current();
    var nf = core.activeFilterCount(f);
    var off = store.prefs().excluded.length;
    if (n < GS.config.minPool) {
      return { bad: true, html: ui.icon('info') + '<span>Not enough charities in play. <button type="button" class="linkbtn" data-open-filters>Loosen the filters</button>' + (off ? ' or turn some back on.' : '.') + '</span>' };
    }
    var bits = [];
    if (nf) { bits.push(nf + (nf === 1 ? ' filter' : ' filters')); }
    if (off) { bits.push(ui.num(off) + ' switched off'); }
    return { bad: false, html: ui.icon('target') + '<span><b>' + ui.num(n) + '</b> of ' + ui.num(GS.charities.length) + ' charities in play' + (bits.length ? ' · ' + esc(bits.join(' · ')) : '') + '</span>' };
  }

  function renderPoolLine(el) {
    var p = poolLine();
    el.classList.toggle('is-bad', p.bad);
    el.innerHTML = p.html;
  }

  /* ---------------------------------------------------------- quick chips */

  function quickChips(box, o) {
    var list = o && o.max ? QUICK.slice(0, o.max) : QUICK;
    var html = '<button type="button" class="chip chip--all" data-cause="" aria-pressed="false">' + ui.icon('sparkles') + 'All</button>';
    list.forEach(function (id) {
      var c = GS.cause(id);
      html += '<button type="button" class="chip" data-cause="' + id + '" style="--c:' + c.color + '" aria-pressed="false">' + ui.icon(c.icon) + esc(c.name) + '</button>';
    });
    box.innerHTML = html;
    function sync() {
      var sel = current().causes;
      Array.prototype.forEach.call(box.querySelectorAll('.chip'), function (b) {
        var id = b.getAttribute('data-cause');
        b.setAttribute('aria-pressed', String(id ? sel.indexOf(id) >= 0 : sel.length === 0));
      });
    }
    box.addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b || b.disabled) { return; }
      GS.audio.click();
      var f = current();
      var id = b.getAttribute('data-cause');
      f.causes = id ? toggled(f.causes, id) : [];
      save(f);
    });
    GS.bus.on('pool', sync);
    sync();
    return { sync: sync };
  }

  /* --------------------------------------------------------------- dialog */

  function chip(group, id, label, icon, color, n) {
    return '<button type="button" class="chip" data-group="' + group + '" data-id="' + id + '"' + (color ? ' style="--c:' + color + '"' : '') + ' aria-pressed="false">' +
      (icon ? ui.icon(icon) : '') + esc(label) + '<span class="chip__n">' + n + '</span></button>';
  }

  function build() {
    var c = facetCounts();
    var html = '<h2 class="modal__title" id="dlg-filters-title">Filters</h2>' +
      '<p class="modal__sub" data-role="count" aria-live="polite"></p>';

    // causes, grouped
    html += '<section class="fgroup"><h3 class="fgroup__t">Causes</h3>';
    GS.causeGroups.forEach(function (g) {
      var inGroup = GS.causes.filter(function (cs) { return cs.group === g; });
      html += '<div class="fsub"><span class="fsub__l">' + esc(g) + '</span><div class="chips">' +
        inGroup.map(function (cs) { return chip('causes', cs.id, cs.name, cs.icon, cs.color, c.causes[cs.id] || 0); }).join('') + '</div></div>';
    });
    html += '</section>';

    function facetSection(group, title, hint) {
      var vals = GS.facets[group].filter(function (v) { return (c[group][v.id] || 0) >= MIN_FACET; });
      if (!vals.length) { return ''; }
      return '<section class="fgroup"><h3 class="fgroup__t">' + esc(title) + '</h3>' + (hint ? '<p class="fgroup__h">' + esc(hint) + '</p>' : '') +
        '<div class="chips">' + vals.map(function (v) { return chip(group, v.id, v.name, '', '', c[group][v.id] || 0); }).join('') + '</div></section>';
    }
    html += facetSection('serves', 'Who they help', 'Charities that focus on these groups.');
    html += facetSection('where', 'Where they work');
    html += facetSection('how', 'How they help');
    html += facetSection('era', 'When they started', 'Founded year. Charities with no founding year on file never match this filter.');

    html += '<div class="modal__foot"><button type="button" class="btn btn--ghost" data-role="clear">Clear all filters</button><button type="button" class="btn btn--green" data-role="done">Show charities</button></div>' +
      '<p class="modal__fine">Prefer to hand-pick? <a href="#charities" data-role="to-dir">Open the Charities page</a> to switch individual charities on or off.</p>';
    return html;
  }

  function sync() {
    if (!modal) { return; }
    var f = current();
    var n = GS.app.state.pool.length;
    var total = GS.charities.length;
    var off = store.prefs().excluded.length;
    var bad = n < GS.config.minPool;
    var count = modal.$('[data-role="count"]');
    count.classList.toggle('is-bad', bad);
    count.innerHTML = bad
      ? '<b>' + ui.num(n) + '</b> in play. Games need at least ' + GS.config.minPool + '. Loosen a filter.'
      : '<b>' + ui.num(n) + '</b> of ' + ui.num(total) + ' charities in play' + (off ? ' (' + ui.num(off) + ' switched off)' : '');
    modal.$$('[data-group]').forEach(function (b) {
      var g = b.getAttribute('data-group');
      var id = b.getAttribute('data-id');
      b.setAttribute('aria-pressed', String(f[g].indexOf(id) >= 0));
    });
    var clear = modal.$('[data-role="clear"]');
    clear.disabled = core.activeFilterCount(f) === 0;
    var done = modal.$('[data-role="done"]');
    done.textContent = bad ? 'Close' : 'Show ' + ui.num(n) + ' ' + (n === 1 ? 'charity' : 'charities');
  }

  function open() {
    if (GS.app.state.busy) { return; }
    if (!modal) {
      modal = ui.modal('filters', { wide: true });
      modal.set(build());
      modal.body.addEventListener('click', function (e) {
        var b = e.target.closest('[data-group]');
        if (b && b.type === 'button') {
          GS.audio.click();
          var f = current();
          var g = b.getAttribute('data-group');
          var id = b.getAttribute('data-id');
          f[g] = toggled(f[g], id);
          save(f);
          return;
        }
        if (e.target.closest('[data-role="clear"]')) { GS.audio.click(); save(core.emptyFilters()); return; }
        if (e.target.closest('[data-role="done"]')) { modal.close(); return; }
        if (e.target.closest('[data-role="to-dir"]')) { modal.close(); }
      });
      GS.bus.on('pool', sync);
    }
    sync();
    modal.open();
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-open-filters]')) { open(); }
  });

  ui.filters = { open: open, quickChips: quickChips, renderPoolLine: renderPoolLine, count: function () { return core.activeFilterCount(current()); } };
})();
