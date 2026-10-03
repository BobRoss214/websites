/*
 * The "choose your own charities" dialog used by every solo game.
 *
 *   GS.ui.chooseCharities({ title, sub, selected: [ids], min, max, onDone(ids) })
 *
 * Search by name, cause, place or what a charity does ("animals", "clean water", "Kenya"), narrow with the same
 * filters as the rest of the site (causes, who they help, where, how, when founded), tick the ones you want, or choose
 * everything that is showing. Every row has a short description, a details drawer and a link to the charity's own
 * website. Nothing here changes your saved filters: the list only applies to the game that opened it.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var ui = GS.ui;
  var esc = ui.esc;

  var PAGE = 40;            // rows drawn at a time (the whole roster can be a thousand)
  var modal = null;
  var S = null;             // the state of the open chooser
  var HAY = {};             // search text per charity
  var COUNTS = null;

  function plain(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  function names(group, ids) {
    return (ids || []).map(function (id) { var f = GS.facet(group, id); return f ? f.name : id; });
  }

  function hay(ch) {
    if (!HAY[ch.id]) {
      HAY[ch.id] = {
        name: plain(ch.name + ' ' + ch.short),
        causes: plain(ch.causes.map(function (c) { return GS.cause(c).name; }).join(' ')),
        rest: plain(ch.blurb + ' ' + (ch.hq || '') + ' ' + names('serves', ch.serves).join(' ') + ' ' + names('where', ch.where).join(' ') + ' ' + names('how', ch.how).join(' ') + ' ' + ch.url)
      };
    }
    return HAY[ch.id];
  }

  function tokens(q) { return plain(q).split(/[^a-z0-9&]+/).filter(Boolean); }

  function has(text, t) {
    return text.indexOf(t) >= 0 || (t.length > 3 && t.charAt(t.length - 1) === 's' && text.indexOf(t.slice(0, -1)) >= 0);
  }

  /** How well a charity matches the search words: 0 means it does not match all of them. */
  function score(ch, toks) {
    if (!toks.length) { return 1; }
    var h = hay(ch);
    var total = 0;
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (has(h.name, t)) { total += h.name.indexOf(t) === 0 ? 5 : 3; }
      else if (has(h.causes, t)) { total += 2; }
      else if (has(h.rest, t)) { total += 1; }
      else { return 0; }
    }
    return total;
  }

  function counts() { return COUNTS || (COUNTS = core.facetCounts(GS.charities)); }

  /* --------------------------------------------------------------- data */

  function visible() {
    var toks = tokens(S.q);
    var f = core.normalizeFilters(S.f);
    var rows = [];
    GS.charities.forEach(function (ch) {
      if (S.only && !S.sel[ch.id]) { return; }
      if (!core.matchesFilters(ch, f)) { return; }
      var s = score(ch, toks);
      if (s > 0) { rows.push({ c: ch, s: s }); }
    });
    var az = function (a, b) { return a.c.name.toLowerCase() < b.c.name.toLowerCase() ? -1 : 1; };
    if (S.sort === 'old') { rows.sort(function (a, b) { return (a.c.founded || 9999) - (b.c.founded || 9999) || az(a, b); }); }
    else if (S.sort === 'new') { rows.sort(function (a, b) { return (b.c.founded || 0) - (a.c.founded || 0) || az(a, b); }); }
    else if (S.sort === 'best' && toks.length) { rows.sort(function (a, b) { return b.s - a.s || az(a, b); }); }
    else { rows.sort(az); }
    return rows.map(function (r) { return r.c; });
  }

  function chosenCount() { return Object.keys(S.sel).length; }

  /* ---------------------------------------------------------- rendering */

  function chip(group, id, label, icon, color, n) {
    return '<button type="button" class="chip" data-group="' + group + '" data-id="' + id + '"' + (color ? ' style="--c:' + color + '"' : '') + ' aria-pressed="' + (S.f[group].indexOf(id) >= 0) + '">' +
      (icon ? ui.icon(icon) : '') + esc(label) + '<span class="chip__n">' + n + '</span></button>';
  }

  function filtersHTML() {
    var c = counts();
    var html = '';
    function section(title, body, open) {
      return '<details class="chzf"' + (open ? ' open' : '') + '><summary>' + esc(title) + '<span class="chzf__n" data-sum="' + esc(title) + '"></span></summary><div class="chzf__body">' + body + '</div></details>';
    }
    var causes = '';
    GS.causeGroups.forEach(function (g) {
      var inGroup = GS.causes.filter(function (cs) { return cs.group === g; });
      causes += '<div class="fsub"><span class="fsub__l">' + esc(g) + '</span><div class="chips">' +
        inGroup.map(function (cs) { return chip('causes', cs.id, cs.name, cs.icon, cs.color, c.causes[cs.id] || 0); }).join('') + '</div></div>';
    });
    html += section('Cause (genre)', causes, true);
    function facet(group, title, open) {
      var vals = GS.facets[group].filter(function (v) { return (c[group][v.id] || 0) > 0; });
      if (!vals.length) { return ''; }
      return section(title, '<div class="chips">' + vals.map(function (v) { return chip(group, v.id, v.name, '', '', c[group][v.id] || 0); }).join('') + '</div>', open);
    }
    html += facet('where', 'Where they work', true);
    html += facet('serves', 'Who they help', false);
    html += facet('how', 'How they help', false);
    html += facet('era', 'When they started', false);
    return html;
  }

  function filterCount() {
    return S.f.causes.length + S.f.serves.length + S.f.where.length + S.f.how.length + S.f.era.length;
  }

  function rowHTML(ch) {
    var on = !!S.sel[ch.id];
    var where = names('where', ch.where);
    var meta = [];
    if (ch.hq) { meta.push(ui.icon('landmark') + esc(ch.hq)); }
    if (where.length) { meta.push(ui.icon('globe') + esc(where.slice(0, 3).join(', '))); }
    if (ch.founded) { meta.push(ui.icon('calendar-days') + (ch.foundedFrom === 'register' ? 'Register date ' : 'Since ') + ch.founded); }
    return '<li class="chrow' + (on ? ' is-on' : '') + '" data-id="' + ch.id + '" style="--c:' + ch.accent + '">' +
      '<label class="chrow__pick"><input type="checkbox" data-pick="' + ch.id + '"' + (on ? ' checked' : '') + ' aria-label="Choose ' + esc(ch.name) + '"><span class="chrow__box" aria-hidden="true">' + ui.icon('check') + '</span></label>' +
      ui.mono(ch, 42) +
      '<div class="chrow__main">' +
        '<div class="chrow__name"><b>' + esc(ch.name) + '</b>' + ui.causeTags(ch, 2) + '</div>' +
        '<p class="chrow__blurb">' + esc(ch.blurb) + '</p>' +
        (meta.length ? '<p class="chrow__meta">' + meta.map(function (m) { return '<span>' + m + '</span>'; }).join('') + '</p>' : '') +
        '<div class="chrow__more" hidden></div>' +
      '</div>' +
      '<div class="chrow__links">' +
        '<button type="button" class="btn btn--sm btn--ghost" data-more="' + ch.id + '" aria-expanded="false">' + ui.icon('info') + 'Details</button>' +
        '<a class="btn btn--sm" href="https://' + esc(ch.url) + '" target="_blank" rel="noopener noreferrer" aria-label="Visit the website of ' + esc(ch.name) + ' (opens in a new tab)">' + ui.icon('external-link') + 'Website</a>' +
      '</div>' +
    '</li>';
  }

  function moreHTML(ch) {
    var serves = names('serves', ch.serves), where = names('where', ch.where), how = names('how', ch.how);
    var about = ch.about && ch.about !== ch.blurb ? ch.about : '';
    return (about ? '<p>' + esc(about) + '</p>' : '') +
      '<dl class="chrow__facts">' +
        '<div><dt>Who they help</dt><dd>' + esc(serves.length ? serves.join(', ') : 'People and communities in general') + '</dd></div>' +
        '<div><dt>Where they work</dt><dd>' + esc(where.length ? where.join(', ') : 'Not on file yet') + '</dd></div>' +
        '<div><dt>How they help</dt><dd>' + esc(how.length ? how.join(', ') : 'Not on file yet') + '</dd></div>' +
        '<div><dt>Founded</dt><dd>' + esc(ui.founded(ch)) + '</dd></div>' +
        '<div><dt>Website</dt><dd><a href="https://' + esc(ch.url) + '" target="_blank" rel="noopener noreferrer">' + esc(ch.url) + ' ↗</a></dd></div>' +
      '</dl>' +
      (ch.unverified ? '<p class="chrow__note">' + ui.icon('info') + 'We have fewer verified details on file for this charity. Visit its website for the full story.</p>' : '');
  }

  function paintList(keepScroll) {
    var list = S.list = visible();
    var ul = modal.$('[data-role="list"]');
    var top = ul.scrollTop;
    var shown = list.slice(0, S.limit);
    ul.innerHTML = shown.length
      ? shown.map(rowHTML).join('') + (list.length > shown.length ? '<li class="chrow__more-li"><button type="button" class="btn" data-role="showmore">Show ' + Math.min(PAGE, list.length - shown.length) + ' more <small>(' + (list.length - shown.length) + ' not shown yet)</small></button></li>' : '')
      : '<li class="empty chz__empty">No charity matches. Try a different word, or clear a filter.</li>';
    if (keepScroll) { ul.scrollTop = top; } else { ul.scrollTop = 0; }
    var bits = [];
    var nf = filterCount();
    if (S.q.trim()) { bits.push('matching “' + S.q.trim() + '”'); }
    if (nf) { bits.push(nf + (nf === 1 ? ' filter' : ' filters')); }
    modal.$('[data-role="count"]').innerHTML = '<b>' + ui.num(list.length) + '</b> of ' + ui.num(GS.charities.length) + ' charities' + (bits.length ? ' · ' + esc(bits.join(' · ')) : '');
    var fb = modal.$('[data-role="fcount"]');
    fb.textContent = String(nf);
    fb.hidden = !nf;
    modal.$('[data-role="clearf"]').disabled = nf === 0;
    modal.$('[data-role="all-shown"]').disabled = list.length === 0;
    modal.$('[data-role="none-shown"]').disabled = list.length === 0;
    refreshFoot();
  }

  function refreshFoot() {
    var n = chosenCount();
    var st = modal.$('[data-role="status"]');
    var done = modal.$('[data-role="done"]');
    var short = n < S.min;
    st.classList.toggle('is-bad', short);
    st.innerHTML = '<b>' + n + '</b> chosen' + (S.max ? ' <span>(up to ' + S.max + ' in this game)</span>' : '') + (short ? ' · choose at least ' + S.min : '') + (S.msg ? ' · ' + esc(S.msg) : '');
    done.disabled = short;
    done.querySelector('span').textContent = short ? 'Choose ' + S.min + '+' : 'Use ' + n + (n === 1 ? ' charity' : ' charities');
    var only = modal.$('[data-role="only"]');
    only.querySelector('span').textContent = 'Chosen (' + n + ')';
    only.setAttribute('aria-pressed', String(S.only));
    modal.$('[data-role="clearall"]').disabled = n === 0;
  }

  function syncChips() {
    modal.$$('[data-group]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(S.f[b.getAttribute('data-group')].indexOf(b.getAttribute('data-id')) >= 0));
    });
  }

  /* ------------------------------------------------------------ selection */

  function setRow(id, on) {
    var li = modal.body.querySelector('.chrow[data-id="' + id + '"]');
    if (!li) { return; }
    li.classList.toggle('is-on', on);
    li.querySelector('input[data-pick]').checked = on;
  }

  function choose(id, on) {
    if (on) {
      if (S.sel[id]) { return true; }
      if (S.max && chosenCount() >= S.max) { S.msg = 'that is the most this game can show'; refreshFoot(); return false; }
      S.sel[id] = true;
    } else { delete S.sel[id]; }
    S.msg = '';
    setRow(id, on);
    return true;
  }

  function bulk(on) {
    var added = 0, skipped = 0;
    S.list.forEach(function (c) {
      if (on) {
        if (S.sel[c.id]) { return; }
        if (S.max && chosenCount() >= S.max) { skipped += 1; return; }
        S.sel[c.id] = true;
        added += 1;
      } else if (S.sel[c.id]) { delete S.sel[c.id]; added += 1; }
    });
    S.msg = skipped ? 'added ' + added + '; stopped at the limit of ' + S.max : '';
    ui.announce(on ? 'Chose ' + ui.num(added) + ' charities.' : 'Removed ' + ui.num(added) + ' charities.');
    if (S.only && !on) { paintList(true); } else { modal.$$('.chrow').forEach(function (li) { var id = li.getAttribute('data-id'); li.classList.toggle('is-on', !!S.sel[id]); li.querySelector('input[data-pick]').checked = !!S.sel[id]; }); refreshFoot(); }
  }

  /* ----------------------------------------------------------------- open */

  function build() {
    modal = ui.modal('chooser', { wide: true, className: 'modal--chooser' });
    modal.set(
      '<header class="chz__head"><h2 class="modal__title" id="dlg-chooser-title"></h2><p class="modal__sub" data-role="sub"></p></header>' +
      '<div class="chz__tools">' +
        '<label class="search search--field chz__search"><span class="sr-only">Search charities</span><span class="search__ico">' + ui.icon('search') + '</span>' +
          '<input type="search" class="search__input" data-role="q" placeholder="Search by name, cause, place or what they do (try “animals”)" autocomplete="off" spellcheck="false"></label>' +
        '<button type="button" class="btn btn--sm chz__ftoggle" data-role="ftoggle" aria-expanded="false">' + ui.icon('list-filter') + 'Filters <span class="count" data-role="fcount" hidden></span></button>' +
        '<label class="selectwrap"><span class="sr-only">Sort by</span><select class="select" data-role="sort"><option value="best">Best match</option><option value="az">A to Z</option><option value="old">Oldest first</option><option value="new">Newest first</option></select></label>' +
        '<button type="button" class="btn btn--sm" data-role="only" aria-pressed="false">' + ui.icon('list-checks') + '<span>Chosen (0)</span></button>' +
      '</div>' +
      '<div class="chz__main">' +
        '<aside class="chz__filters" data-role="filters" aria-label="Filters"><div class="chz__fhead"><b>Filter</b><button type="button" class="linkbtn" data-role="clearf">Clear filters</button></div><div data-role="fbody"></div></aside>' +
        '<section class="chz__results" aria-label="Charities">' +
          '<div class="chz__bar"><span data-role="count" aria-live="polite"></span><span class="chz__bulk"><button type="button" class="linkbtn" data-role="all-shown">Choose all shown</button><button type="button" class="linkbtn" data-role="none-shown">Remove shown</button></span></div>' +
          '<ul class="chz__list" data-role="list"></ul>' +
        '</section>' +
      '</div>' +
      '<footer class="chz__foot"><p class="chz__status" data-role="status" aria-live="polite"></p>' +
        '<div class="chz__btns"><button type="button" class="btn btn--ghost" data-role="clearall">Clear all</button><button type="button" class="btn" data-role="cancel">Cancel</button>' +
        '<button type="button" class="btn btn--green" data-role="done">' + ui.icon('check') + '<span>Use these</span></button></div></footer>'
    );
    var body = modal.body;
    var timer = 0;
    body.addEventListener('input', function (e) {
      if (!e.target.matches('[data-role="q"]')) { return; }
      clearTimeout(timer);
      timer = setTimeout(function () { S.q = e.target.value; S.limit = PAGE; if (S.q.trim() && S.sort !== 'best' && !S.sortTouched) { S.sort = 'best'; modal.$('[data-role="sort"]').value = 'best'; } paintList(false); }, 110);
    });
    body.addEventListener('change', function (e) {
      var pick = e.target.closest('input[data-pick]');
      if (pick) {
        GS.audio.click();
        if (!choose(pick.getAttribute('data-pick'), pick.checked)) { pick.checked = false; }
        refreshFoot();
        if (S.only && !pick.checked) { /* keep the row until the list is next repainted */ }
        return;
      }
      if (e.target.matches('[data-role="sort"]')) { S.sort = e.target.value; S.sortTouched = true; S.limit = PAGE; paintList(false); }
    });
    body.addEventListener('click', function (e) {
      var t = e.target;
      var chipEl = t.closest('[data-group]');
      if (chipEl) {
        GS.audio.click();
        var g = chipEl.getAttribute('data-group'), id = chipEl.getAttribute('data-id');
        var i = S.f[g].indexOf(id);
        if (i >= 0) { S.f[g].splice(i, 1); } else { S.f[g].push(id); }
        S.limit = PAGE;
        syncChips();
        paintList(false);
        return;
      }
      var more = t.closest('[data-more]');
      if (more) {
        var li = more.closest('.chrow');
        var box = li.querySelector('.chrow__more');
        var open = box.hidden;
        if (open && !box.firstChild) { box.innerHTML = moreHTML(GS.charity(more.getAttribute('data-more'))); }
        box.hidden = !open;
        more.setAttribute('aria-expanded', String(open));
        return;
      }
      var role = (t.closest('[data-role]') || {}).getAttribute ? t.closest('[data-role]').getAttribute('data-role') : '';
      if (role === 'showmore') { S.limit += PAGE; paintList(true); }
      else if (role === 'all-shown') { GS.audio.click(); bulk(true); }
      else if (role === 'none-shown') { GS.audio.click(); bulk(false); }
      else if (role === 'clearall') { GS.audio.click(); S.sel = {}; S.msg = ''; if (S.only) { paintList(false); } else { bulk(false); modal.$$('.chrow').forEach(function (r) { r.classList.remove('is-on'); r.querySelector('input[data-pick]').checked = false; }); refreshFoot(); } }
      else if (role === 'clearf') { GS.audio.click(); S.f = core.emptyFilters(); S.limit = PAGE; syncChips(); paintList(false); }
      else if (role === 'only') { GS.audio.click(); S.only = !S.only; S.limit = PAGE; paintList(false); }
      else if (role === 'ftoggle') {
        var aside = modal.$('[data-role="filters"]');
        var shown = aside.classList.toggle('is-open');
        modal.$('[data-role="ftoggle"]').setAttribute('aria-expanded', String(shown));
      }
      else if (role === 'cancel') { modal.close(); }
      else if (role === 'done') {
        if (chosenCount() < S.min) { return; }
        var ids = Object.keys(S.sel).sort(function (a, b) { return GS.charity(a).name.toLowerCase() < GS.charity(b).name.toLowerCase() ? -1 : 1; });
        var cb = S.onDone;
        S.done = true;
        modal.close();
        if (cb) { cb(ids); }
      }
    });
    modal.$('[data-role="fbody"]').innerHTML = '';
  }

  function chooseCharities(o) {
    if (!modal) { build(); }
    var valid = (o.selected || []).filter(function (id) { return !!GS.charity(id); });
    S = {
      q: '', f: core.emptyFilters(), sort: 'az', sortTouched: false, only: false, limit: PAGE, sel: {}, list: [], msg: '',
      min: Math.max(1, o.min || 2), max: o.max || 0, onDone: o.onDone, done: false
    };
    valid.slice(0, S.max || valid.length).forEach(function (id) { S.sel[id] = true; });
    modal.$('#dlg-chooser-title').textContent = o.title || 'Choose your charities';
    modal.$('[data-role="sub"]').textContent = o.sub || '';
    modal.$('[data-role="q"]').value = '';
    modal.$('[data-role="sort"]').value = 'az';
    modal.$('[data-role="fbody"]').innerHTML = filtersHTML();
    modal.$('[data-role="filters"]').classList.remove('is-open');
    modal.$('[data-role="ftoggle"]').setAttribute('aria-expanded', 'false');
    paintList(false);
    modal.open();
    modal.$('[data-role="q"]').focus();
  }

  ui.chooseCharities = chooseCharities;
})();
