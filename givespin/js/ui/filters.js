/*
 * Filters. Two dialogs share one set of chips (causes, who they help, where, how, when founded):
 *   - the GAME filters ("Filters for games"): which charities can come up when you play. They are saved, apply to every
 *     game (except one where you chose your own charities), and the quick cause chips next to the bet panel and the
 *     "N charities in play" line belong to them;
 *   - the BROWSE filters ("Filter the charities"), opened from the Charities page: they only narrow the list you are
 *     looking at. They never change which charities come up in a game (a separate button inside the dialog copies
 *     them across if you want that).
 * Changes apply instantly and the live count updates as you tap.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var ui = GS.ui;
  var esc = ui.esc;
  var store = GS.store;

  var QUICK = ['kids', 'animals', 'planet', 'hunger', 'health', 'education', 'veterans', 'disaster', 'mental', 'water', 'women', 'arts'];
  var MIN_FACET = 3; // a filter value that fewer than this many charities have is hidden: it would leave next to nothing to play with or to look at
  var counts = null;
  var gameDlg = null;
  var browseDlg = null;
  var browseCtl = null; // what the Charities page hands us: { get(): filters, set(filters), shown(): number }

  function facetCounts() { return counts || (counts = core.facetCounts(GS.charities)); }
  function current() { return core.normalizeFilters(store.prefs().filters); }
  function save(f) { store.setPref('filters', f); GS.app.refreshPool(); }
  function plural(n) { return n === 1 ? 'charity' : 'charities'; }

  function toggled(list, id) {
    var i = list.indexOf(id);
    var out = list.slice();
    if (i >= 0) { out.splice(i, 1); } else { out.push(id); }
    return out;
  }

  /** The visible name of one filter value, for the chips that show what is active. */
  function labelFor(group, id) {
    if (group === 'causes') { return GS.cause(id).name; }
    var list = GS.facets[group] || [];
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) { return list[i].name; } }
    return id;
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

  /** The chips themselves (causes, then the other four groups): the same in both dialogs. */
  function chipsHTML() {
    var c = facetCounts();
    var html = '<section class="fgroup"><h3 class="fgroup__t">Causes</h3>';
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
    html += facetSection('era', 'When they started', 'Founded year. Charities with no founding year on file, or only a register date, never match this filter.');
    return html;
  }

  /**
   * One filter dialog. `cfg`:
   *   id, title, hint (plain text under the title), get() -> filters, set(filters),
   *   status(filters) -> { bad, html, label } (the count line, whether it is a dead end, the text of the main button),
   *   extra (html above the fine print, optional), onExtra(target) for clicks in it, fine (html, optional).
   */
  function makeDialog(cfg) {
    var d = { modal: null };

    function build() {
      return '<h2 class="modal__title" id="dlg-' + cfg.id + '-title">' + esc(cfg.title) + '</h2>' +
        '<p class="modal__hint">' + esc(cfg.hint) + '</p>' +
        '<p class="modal__sub" data-role="count" aria-live="polite"></p>' +
        chipsHTML() +
        (cfg.extra || '') +
        (cfg.fine ? '<p class="modal__fine">' + cfg.fine + '</p>' : '') +
        '<div class="modal__foot"><button type="button" class="btn btn--ghost" data-role="clear">Clear all filters</button><button type="button" class="btn btn--green" data-role="done"></button></div>';
    }

    d.sync = function () {
      var m = d.modal;
      if (!m) { return; }
      var f = cfg.get();
      var st = cfg.status(f);
      var count = m.$('[data-role="count"]');
      count.classList.toggle('is-bad', st.bad);
      count.innerHTML = st.html;
      m.$$('[data-group]').forEach(function (b) {
        b.setAttribute('aria-pressed', String(f[b.getAttribute('data-group')].indexOf(b.getAttribute('data-id')) >= 0));
      });
      m.$('[data-role="clear"]').disabled = core.activeFilterCount(f) === 0;
      m.$('[data-role="done"]').textContent = st.label;
      if (cfg.after) { cfg.after(m, f); }
    };

    d.open = function () {
      if (!d.modal) {
        var m = d.modal = ui.modal(cfg.id, { wide: true });
        m.set(build());
        m.body.addEventListener('click', function (e) {
          var b = e.target.closest('[data-group]');
          if (b && b.type === 'button') {
            GS.audio.click();
            var f = cfg.get();
            var g = b.getAttribute('data-group');
            var id = b.getAttribute('data-id');
            f[g] = toggled(f[g], id);
            cfg.set(f);
            d.sync();
            return;
          }
          if (e.target.closest('[data-role="clear"]')) { GS.audio.click(); cfg.set(core.emptyFilters()); d.sync(); return; }
          if (e.target.closest('[data-role="done"]')) { m.close(); return; }
          if (e.target.closest('[data-role="to-dir"]')) { m.close(); return; }
          if (cfg.onExtra) { cfg.onExtra(e.target, d); }
        });
      }
      d.sync();
      d.modal.open();
      d.modal.body.scrollTop = 0; // always start at the title and the count, not where you left off
    };
    return d;
  }

  /* ----------------------------------------------------- the GAME filters */

  gameDlg = makeDialog({
    id: 'filters',
    title: 'Filters for games',
    hint: 'These choose which charities can come up when you play. They apply to every game, except one where you chose your own charities.',
    get: current,
    set: save,
    status: function () {
      var n = GS.app.state.pool.length;
      var total = GS.charities.length;
      var off = store.prefs().excluded.length;
      var bad = n < GS.config.minPool;
      return {
        bad: bad,
        html: bad
          ? '<b>' + ui.num(n) + '</b> in play. Games need at least ' + GS.config.minPool + '. Loosen a filter.'
          : '<b>' + ui.num(n) + '</b> of ' + ui.num(total) + ' charities in play' + (off ? ' (' + ui.num(off) + ' switched off)' : ''),
        label: bad ? 'Close' : 'Play with ' + ui.num(n) + ' ' + plural(n)
      };
    },
    fine: 'Want to leave out particular charities? <a href="#charities" data-role="to-dir">Open the Charities page</a> and switch them off one by one.'
  });
  var openGame = gameDlg.open;
  gameDlg.open = function () {
    if (GS.app.state.busy) { return; }
    var first = !gameDlg.modal;
    openGame();
    if (first) { GS.bus.on('pool', gameDlg.sync); }
  };

  /* --------------------------------------------- the BROWSE filters (list) */

  function matching(f) {
    return GS.charities.filter(function (ch) { return core.matchesFilters(ch, f); });
  }

  browseDlg = makeDialog({
    id: 'browse-filters',
    title: 'Filter the charities',
    hint: 'Look through the list by cause, who they help, where they work and more. This only changes what you see on the Charities page. It does not change which charities come up in games.',
    get: function () { return core.normalizeFilters(browseCtl ? browseCtl.get() : null); },
    set: function (f) { if (browseCtl) { browseCtl.set(f); } },
    status: function (f) {
      var n = matching(f).length;
      var shown = browseCtl && browseCtl.shown ? browseCtl.shown() : n;
      return {
        bad: n === 0,
        html: n === 0
          ? '<b>0</b> of ' + ui.num(GS.charities.length) + ' charities match. Loosen a filter.'
          : '<b>' + ui.num(n) + '</b> of ' + ui.num(GS.charities.length) + ' charities match',
        label: n === 0 ? 'Close' : 'Show ' + ui.num(shown) + ' ' + plural(shown)
      };
    },
    extra: '<div class="fbridge"><div class="fbridge__t"><b>Want games to use these too?</b><span data-role="bridge-note">Games keep their own filters. This copies yours across.</span></div>' +
      '<button type="button" class="btn btn--sm" data-role="to-games">Use these filters in games</button></div>',
    after: function (m, f) {
      var btn = m.$('[data-role="to-games"]');
      var note = m.$('[data-role="bridge-note"]');
      var nf = core.activeFilterCount(f);
      var inGames = core.buildPool(GS.charities, f, store.prefs().excluded).length;
      var same = JSON.stringify(core.normalizeFilters(store.prefs().filters)) === JSON.stringify(f);
      btn.disabled = nf === 0 || inGames < GS.config.minPool || same;
      note.textContent = nf === 0 ? 'Pick a filter first.'
        : same ? 'Games already use exactly these filters.'
        : inGames < GS.config.minPool ? 'Too few would be left in a game. Loosen a filter.'
        : 'Games would draw from ' + ui.num(inGames) + ' ' + plural(inGames) + '. ' + (core.activeFilterCount(store.prefs().filters) ? 'This replaces the filters games use now.' : 'Games keep their own filters until you do this.');
    },
    onExtra: function (target, d) {
      if (!target.closest('[data-role="to-games"]') || GS.app.state.busy) { return; }
      var f = browseCtl ? core.normalizeFilters(browseCtl.get()) : null;
      if (!f || !core.activeFilterCount(f)) { return; }
      var n = core.buildPool(GS.charities, f, store.prefs().excluded).length;
      if (n < GS.config.minPool) { return; }
      GS.audio.click();
      save(f);
      ui.toast('Games now use these filters and draw from ' + ui.num(n) + ' ' + plural(n) + '.');
      d.sync();
    },
    fine: 'Want to leave out particular charities? Close this and use the <b>In play</b> switch on any charity card.'
  });

  function openBrowse(ctl) {
    browseCtl = ctl;
    browseDlg.open();
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-open-filters]')) { gameDlg.open(); }
  });

  ui.filters = {
    open: gameDlg.open,
    openBrowse: openBrowse,
    syncBrowse: function () { browseDlg.sync(); },
    labelFor: labelFor,
    quickChips: quickChips,
    renderPoolLine: renderPoolLine,
    count: function () { return core.activeFilterCount(current()); }
  };
})();
