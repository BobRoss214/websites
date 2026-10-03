/*
 * Charities: the profile dialog (opens from anywhere via [data-open-charity]), the "Give directly" dialog,
 * and the Charities page (searchable directory with in-play switches).
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var ui = GS.ui;
  var esc = ui.esc;
  var store = GS.store;
  var money = core.fmtMoney;

  var profile = null;
  var direct = null;
  var directId = null;
  var directAmount = null;

  function state() { return GS.app.state; }
  function isExcluded(id) { return store.prefs().excluded.indexOf(id) >= 0; }
  function inPool(id) { return state().pool.some(function (c) { return c.id === id; }); }

  function names(group, ids) {
    return ids.map(function (id) { var f = GS.facet(group, id); return f ? f.name : id; });
  }

  function similarTo(ch) {
    return GS.charities.filter(function (o) { return o.id !== ch.id; }).map(function (o) {
      var shared = o.causes.filter(function (c) { return ch.causes.indexOf(c) >= 0; }).length;
      return { c: o, shared: shared };
    }).filter(function (x) { return x.shared > 0; }).sort(function (a, b) {
      return b.shared - a.shared || (a.c.name < b.c.name ? -1 : 1);
    }).slice(0, 4).map(function (x) { return x.c; });
  }

  /* -------------------------------------------------------------- profile */

  function statusLine(ch) {
    if (isExcluded(ch.id)) { return '<span class="pill pill--off">' + ui.icon('eye-off') + 'Switched off</span>'; }
    if (!inPool(ch.id)) { return '<span class="pill pill--off">' + ui.icon('funnel') + 'Outside your filters</span>'; }
    return '<span class="pill pill--on">' + ui.icon('circle-check') + 'In play</span>';
  }

  function profileHTML(ch) {
    var t = store.get().charityTotals[ch.id];
    var serves = names('serves', ch.serves);
    var where = names('where', ch.where);
    var how = names('how', ch.how);
    var facts = [
      ['users', 'Who they help', serves.length ? serves.join(', ') : 'People and communities in general'],
      ['globe', 'Where they work', where.length ? where.join(', ') : 'Not on file yet'],
      ['hand-heart', 'How they help', how.length ? how.join(', ') : 'Not on file yet'],
      ['calendar-days', 'Founded', ch.founded ? String(ch.founded) : 'Not on file yet'],
      ['landmark', 'Headquarters', ch.hq || 'Not on file yet']
    ];
    var similar = similarTo(ch);
    var about = ch.about && ch.about !== ch.blurb ? ch.about : '';
    var excluded = isExcluded(ch.id);

    return '<header class="prof__head" style="--c:' + ch.accent + '">' + ui.mono(ch, 68) +
        '<div class="prof__titles"><h2 class="prof__name" id="dlg-profile-title">' + esc(ch.name) + '</h2>' +
        '<div class="prof__tags">' + ui.causeTags(ch) + (ch.faith ? '<span class="tag tag--plain">' + ui.icon('sparkle') + 'Faith-based</span>' : '') + '</div></div>' +
        '<span data-role="status">' + statusLine(ch) + '</span>' +
      '</header>' +
      '<p class="prof__lead">' + esc(ch.blurb) + '</p>' +
      (about ? '<p class="prof__about">' + esc(about) + '</p>' : '') +
      '<dl class="facts">' + facts.map(function (f) {
        return '<div class="facts__row"><dt>' + ui.icon(f[0]) + esc(f[1]) + '</dt><dd>' + esc(f[2]) + '</dd></div>';
      }).join('') +
        '<div class="facts__row"><dt>' + ui.icon('link') + 'Website</dt><dd><a href="https://' + esc(ch.url) + '" target="_blank" rel="noopener noreferrer">' + esc(ch.url) + ' ↗</a></dd></div>' +
      '</dl>' +
      (ch.unverified ? '<p class="note">' + ui.icon('info') + '<span>We have fewer verified details on file for this charity. Visit its website for the full story.</span></p>' : '') +
      (t ? '<div class="prof__you">' + ui.icon('heart') + '<span>You have given <b>' + money(t.cents, false) + '</b> here across ' + t.hits + (t.hits === 1 ? ' round' : ' rounds') + (t.last ? ' · last on ' + esc(ui.fmtDate(t.last)) : '') + '.</span></div>' : '') +
      '<div class="prof__actions">' +
        '<a class="btn btn--green" href="https://' + esc(ch.url) + '" target="_blank" rel="noopener noreferrer">' + ui.icon('external-link') + 'Visit website</a>' +
        '<button type="button" class="btn" data-role="give">' + ui.icon('hand-heart') + 'Give directly</button>' +
        '<button type="button" class="btn btn--ghost" data-role="toggle" aria-pressed="' + (!excluded) + '">' + ui.icon(excluded ? 'eye' : 'eye-off') + (excluded ? 'Switch back on' : 'Switch off in games') + '</button>' +
      '</div>' +
      (similar.length ? '<section class="prof__similar"><h3>Similar charities</h3><div class="chips">' + similar.map(function (s) {
        return '<button type="button" class="chip chip--link" style="--c:' + s.accent + '" data-open-charity="' + s.id + '">' + ui.mono(s, 22) + esc(s.short) + '</button>';
      }).join('') + '</div></section>' : '') +
      '<p class="modal__fine">Details come from the charity’s public materials and may change. Always check the official site for the latest.</p>';
  }

  function openProfile(id) {
    var ch = GS.charity(id);
    if (!ch) { return; }
    if (!profile) {
      profile = ui.modal('profile', {
        wide: true,
        onClose: function () { GS.app.afterProfileClose(); }
      });
      profile.body.addEventListener('click', function (e) {
        var ch2 = GS.charity(profile.el.getAttribute('data-id'));
        if (!ch2) { return; }
        if (e.target.closest('[data-role="give"]')) { profile.close(); setTimeout(function () { openDirect(ch2.id); }, 80); return; }
        var tg = e.target.closest('[data-role="toggle"]');
        if (tg) {
          var list = store.prefs().excluded.filter(function (x) { return x !== ch2.id; });
          if (!isExcluded(ch2.id)) { list.push(ch2.id); }
          store.setPref('excluded', list);
          GS.audio.click();
          GS.app.refreshPool();
          profile.set(profileHTML(ch2));
          var b = profile.$('[data-role="toggle"]');
          if (b) { b.focus(); }
        }
      });
    }
    profile.el.setAttribute('data-id', ch.id);
    profile.set(profileHTML(ch));
    profile.open();
    GS.app.noteProfileOpen(ch.id);
  }

  /* ---------------------------------------------------------- direct gift */

  function updateDirectSummary() {
    if (!direct) { return; }
    var ch = GS.charity(directId);
    var go = direct.$('[data-role="go"]');
    var sum = direct.$('[data-role="sum"]');
    if (!ch) { return; }
    var v = directAmount.valid();
    var o = ui.opts.read();
    go.disabled = !v.ok;
    go.querySelector('span').textContent = v.ok ? 'Give ' + money(directAmount.cents(), true) + (o.freq === 'once' ? '' : ' ' + o.freq) : 'Give';
    sum.textContent = v.ok ? money(directAmount.cents(), false) + ' to ' + ch.name + ' · ' + ui.opts.summary() : '';
    if (directAmount.aux) { directAmount.aux.textContent = GS.payments.mode() === 'demo' ? 'Credit ' + money(store.balance(), true) : ''; }
  }

  function openDirect(id) {
    var ch = GS.charity(id);
    if (!ch) { return; }
    if (state().busy) { ui.toast('Finish the round in progress first.', 'info'); return; }
    directId = id;
    if (!direct) {
      direct = ui.modal('direct');
      direct.set(
        '<h2 class="modal__title" id="dlg-direct-title">Give directly</h2>' +
        '<p class="modal__sub">No luck involved: you pick the charity, it gets the whole gift.</p>' +
        '<div class="dcharity" data-role="head"></div>' +
        '<div class="field" data-role="amount"></div>' +
        '<details class="opts"><summary>Gift options <span class="opts__sum" data-role="opts-sum"></span></summary><div class="opts__body" data-role="opts"></div></details>' +
        '<p class="field__msg field__msg--block" data-role="msg" role="alert"></p>' +
        '<button type="button" class="playbtn" data-role="go">' + '<span class="playbtn__main">' + ui.icon('hand-heart') + '<span>Give</span></span><span class="playbtn__sub" data-role="sum"></span></button>' +
        '<p class="modal__fine">' + (GS.payments.mode() === 'demo' ? 'Demo mode: nothing is charged and no real donation is made.' : 'You will finish your gift on the charity’s checkout page.') + '</p>'
      );
      directAmount = ui.amount.mount(direct.$('[data-role="amount"]'), updateDirectSummary);
      ui.opts.mount(direct.$('[data-role="opts"]'));
      GS.bus.on('prefs', function () { updateDirectSummary(); var s = direct.$('[data-role="opts-sum"]'); if (s) { s.textContent = ui.opts.summary(); } });
      GS.bus.on('balance', updateDirectSummary);
      direct.$('[data-role="go"]').addEventListener('click', function () {
        var ch2 = GS.charity(directId);
        var v = directAmount.valid();
        var msg = direct.$('[data-role="msg"]');
        if (!v.ok) { directAmount.flash(v.message); return; }
        var cents = directAmount.cents();
        var gate = ui.opts.check(cents);
        if (!gate.ok) {
          msg.textContent = gate.message;
          if (gate.credit) { direct.close(); setTimeout(function () { ui.account.openCredit({ need: cents }); }, 80); }
          return;
        }
        msg.textContent = '';
        direct.close();
        GS.audio.unlock();
        var round = {
          game: 'direct', cents: cents, rounds: 1, direct: true, jackpot: false, triple: false, fair: null,
          allocs: [{ charityId: ch2.id, cents: cents, hits: 1 }], opts: ui.opts.read(), collect: [{ charityId: ch2.id, rarity: 'common' }]
        };
        GS.app.setBusy(true);
        ui.receipt.finish(round).catch(function (err) {
          if (window.console) { console.error(err); }
          ui.receipt.abort();
          ui.toast(err && err.message === 'Not enough demo credit.' ? 'Not enough demo credit.' : 'Something went wrong. Nothing was charged.', 'info');
        }).then(function () { GS.app.setBusy(false); });
      });
    }
    direct.$('[data-role="head"]').innerHTML = '<span style="--c:' + ch.accent + '" class="dcharity__in">' + ui.mono(ch, 48) +
      '<span><b>' + esc(ch.name) + '</b><small>' + esc(ch.causes.map(function (c) { return GS.cause(c).name; }).slice(0, 3).join(' · ')) + '</small></span></span>';
    direct.$('[data-role="msg"]').textContent = '';
    directAmount.reload();
    var s = direct.$('[data-role="opts-sum"]');
    if (s) { s.textContent = ui.opts.summary(); }
    updateDirectSummary();
    direct.open();
  }

  /* ------------------------------------------------------------ directory */

  var dir = { view: 'all', sort: 'az', query: '', root: null, selfChange: false };

  function hay(ch) {
    return (ch.name + ' ' + ch.short + ' ' + ch.blurb + ' ' + ch.hq + ' ' + ch.causes.map(function (c) { return GS.cause(c).name; }).join(' ') + ' ' +
      names('serves', ch.serves).join(' ') + ' ' + names('where', ch.where).join(' ') + ' ' + names('how', ch.how).join(' ')).toLowerCase();
  }

  function cardHTML(ch) {
    var off = isExcluded(ch.id);
    var filtered = !off && !inPool(ch.id);
    var t = store.get().charityTotals[ch.id];
    return '<li class="rcard' + (off ? ' is-off' : '') + (filtered ? ' is-filtered' : '') + '" data-id="' + ch.id + '" style="--c:' + ch.accent + '">' +
      '<div class="rcard__top">' + ui.mono(ch, 44) +
        '<div><button type="button" class="rcard__name" data-open-charity="' + ch.id + '">' + esc(ch.name) + '</button>' +
        '<div class="rcard__tags">' + ui.causeTags(ch, 2) + '</div></div></div>' +
      '<p class="rcard__blurb">' + esc(ch.blurb) + '</p>' +
      (t ? '<p class="rcard__given">' + ui.icon('heart') + 'You gave ' + money(t.cents, true) + '</p>' : '') +
      '<div class="rcard__foot"><a class="rcard__link" href="https://' + esc(ch.url) + '" target="_blank" rel="noopener noreferrer">' + esc(ch.url) + ui.icon('external-link') + '</a>' +
        '<span class="rcard__note" data-role="note">' + (filtered ? 'Outside filters' : '') + '</span>' +
        '<label class="switch"><input type="checkbox" role="switch" data-ch="' + ch.id + '"' + (off ? '' : ' checked') + ' aria-label="' + esc(ch.short) + ' in play"><span class="switch__ui" aria-hidden="true"></span><span class="switch__txt">In play</span></label></div>' +
    '</li>';
  }

  function visibleList() {
    var q = dir.query;
    var totals = store.get().charityTotals;
    var list = GS.charities.filter(function (ch) {
      if (dir.view === 'in' && !inPool(ch.id)) { return false; }
      if (dir.view === 'off' && !isExcluded(ch.id)) { return false; }
      if (dir.view === 'gave' && !totals[ch.id]) { return false; }
      return !q || hay(ch).indexOf(q) >= 0;
    });
    if (dir.sort === 'old') { list.sort(function (a, b) { return (a.founded || 9999) - (b.founded || 9999) || (a.name < b.name ? -1 : 1); }); }
    else if (dir.sort === 'new') { list.sort(function (a, b) { return (b.founded || 0) - (a.founded || 0) || (a.name < b.name ? -1 : 1); }); }
    else if (dir.sort === 'given') { list.sort(function (a, b) { return ((totals[b.id] || {}).cents || 0) - ((totals[a.id] || {}).cents || 0) || (a.name < b.name ? -1 : 1); }); }
    else { list.sort(function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; }); }
    return list;
  }

  function updateCount() {
    var off = store.prefs().excluded.length;
    var el = dir.root.querySelector('[data-role="count"]');
    el.textContent = ui.num(GS.charities.length) + ' charities · ' + ui.num(state().pool.length) + ' in play' + (off ? ' · ' + ui.num(off) + ' switched off' : '');
    var fb = dir.root.querySelector('[data-role="fcount"]');
    var n = ui.filters.count();
    fb.textContent = n ? String(n) : '';
    fb.hidden = !n;
  }

  function renderList() {
    var list = visibleList();
    var ul = dir.root.querySelector('[data-role="list"]');
    ul.innerHTML = list.length ? list.map(cardHTML).join('') : '<li class="empty" style="grid-column:1/-1">No charities match. Try a different search or filter.</li>';
    updateCount();
  }

  function renderDirectory(root) {
    dir.root = root;
    if (!root.firstChild) {
      root.innerHTML =
        '<header class="page-head"><div><h1>Charities</h1><p>' + ui.num(GS.charities.length) + ' organisations across every cause. Tap one to see what it does, visit its website or give to it directly. Switch any off and it will never come up in a game.</p></div></header>' +
        '<div class="dirtools">' +
          '<label class="search search--field"><span class="sr-only">Search charities</span><span class="search__ico">' + ui.icon('search') + '</span><input type="search" class="search__input" data-role="q" placeholder="Search by name, cause, place or who they help" autocomplete="off"></label>' +
          '<button type="button" class="btn btn--sm" data-open-filters>' + ui.icon('list-filter') + 'Filters <span class="count" data-role="fcount" hidden></span></button>' +
          '<div class="seg seg--sm" role="group" aria-label="Show" data-role="view">' +
            [['all', 'All'], ['in', 'In play'], ['off', 'Switched off'], ['gave', 'I’ve given']].map(function (p) {
              return '<button type="button" class="seg__btn" data-v="' + p[0] + '" aria-pressed="' + (dir.view === p[0]) + '">' + p[1] + '</button>';
            }).join('') +
          '</div>' +
          '<label class="selectwrap"><span class="sr-only">Sort by</span><select class="select" data-role="sort">' +
            '<option value="az">A to Z</option><option value="given">Most given by me</option><option value="old">Oldest first</option><option value="new">Newest first</option>' +
          '</select></label>' +
          '<button type="button" class="linkbtn" data-role="allon">Turn all on</button>' +
        '</div>' +
        '<p class="dir-count" data-role="count" aria-live="polite"></p>' +
        '<ul class="dir" data-role="list"></ul>';

      var q = root.querySelector('[data-role="q"]');
      q.addEventListener('input', function () { dir.query = q.value.trim().toLowerCase(); renderList(); });
      root.querySelector('[data-role="view"]').addEventListener('click', function (e) {
        var b = e.target.closest('.seg__btn');
        if (!b) { return; }
        dir.view = b.getAttribute('data-v');
        Array.prototype.forEach.call(root.querySelectorAll('[data-role="view"] .seg__btn'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        renderList();
      });
      root.querySelector('[data-role="sort"]').addEventListener('change', function (e) { dir.sort = e.target.value; renderList(); });
      root.querySelector('[data-role="allon"]').addEventListener('click', function () {
        store.setPref('excluded', []);
        GS.app.refreshPool();
        ui.toast('Every charity is back in play.');
      });
      root.querySelector('[data-role="list"]').addEventListener('change', function (e) {
        var input = e.target.closest('input[data-ch]');
        if (!input) { return; }
        var id = input.getAttribute('data-ch');
        var list = store.prefs().excluded.filter(function (x) { return x !== id; });
        if (!input.checked) { list.push(id); }
        store.setPref('excluded', list);
        GS.audio.click();
        dir.selfChange = true;
        GS.app.refreshPool();
        dir.selfChange = false;
        var card = input.closest('.rcard');
        var ch = GS.charity(id);
        if (card) {
          card.classList.toggle('is-off', !input.checked);
          var filtered = input.checked && !inPool(id);
          card.classList.toggle('is-filtered', filtered);
          card.querySelector('[data-role="note"]').textContent = filtered ? 'Outside filters' : '';
        }
        updateCount();
        ui.announce(ch.short + (input.checked ? ' is in play.' : ' is switched off.'));
      });
      GS.bus.on('pool', function () { if (!dir.selfChange && dir.root.closest('.view') && !dir.root.closest('.view').hidden) { renderList(); } });
      GS.bus.on('progress', function () { if (dir.root.closest('.view') && !dir.root.closest('.view').hidden) { renderList(); } });
    }
    renderList();
  }

  ui.charity = { openProfile: openProfile, openDirect: openDirect, renderDirectory: renderDirectory, refreshProfile: function () {
    if (profile && profile.el.open) { var ch = GS.charity(profile.el.getAttribute('data-id')); if (ch) { profile.set(profileHTML(ch)); } }
  } };

  document.addEventListener('click', function (e) {
    var o = e.target.closest('[data-open-charity]');
    if (!o) { return; }
    e.preventDefault();
    var id = o.getAttribute('data-open-charity');
    // Opening a profile from inside another dialog (receipt, similar charities): swap them.
    var open = document.querySelector('dialog.modal[open]');
    if (open && open._modal && open !== (profile && profile.el) && !open._modal.locked) { open._modal.close(); }
    openProfile(id);
  });
})();
