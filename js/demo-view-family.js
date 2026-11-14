/* The account demo: the "My family" screen (account.html#family). The grown-ups, the kids (names and ages), allergies and food notes, and the
 * gluten-free and vegan reminders. The family presses Save; the kitchen then sees the food notes on the pizza orders.
 * Pretend only: it is kept by DemoStore in this browser and goes nowhere. Family text is only ever written as text (never as markup).
 * Needs js/demo-view-kit.js (helpers) and the shell (js/demo-app.js). */
(function (W, D) {
  'use strict';
  var K = W.DemoViewKit;
  if (!K) { if (W.console) W.console.warn('Account demo: js/demo-view-kit.js is missing, so the "My family" screen cannot be drawn.'); return; }
  var h = K.h;
  var MAX_ADULTS = 6, MAX_KIDS = 10, MAX_NAME = 40, MAX_NOTES = 300;

  // The form works on a copy (work). Nothing reaches the store until Save, and a redraw by the shell keeps what was typed.
  var work = null, workFor = '', dirty = false, saved = '';

  /* ---- the only two places that know how the store keeps the family: family = {name, adults:[{name}], kids:[{name, age}], allergies, glutenFree, vegan} */
  function nameOf(p) { return typeof p === 'string' ? p : (p && p.name ? String(p.name) : ''); }
  function readFamily(store) {
    var f = null, notes;
    try { f = store.get('family'); } catch (e) { f = null; }
    f = f || {};
    notes = Array.isArray(f.allergies) ? f.allergies.join(', ') : f.allergies;
    return {
      adults: (f.adults || []).map(nameOf),
      kids: (f.kids || []).map(function (k) { return { name: nameOf(k), age: k && k.age !== undefined && k.age !== null ? String(k.age) : '' }; }),
      allergies: notes ? String(notes) : '', glutenFree: !!f.glutenFree, vegan: !!f.vegan
    };
  }
  function writeFamily(store, w) {
    store.update('family', null, {
      adults: w.adults.map(function (n) { return { name: n }; }),
      kids: w.kids.map(function (k) { return { name: k.name, age: Number(k.age) }; }),
      allergies: w.allergies, glutenFree: w.glutenFree, vegan: w.vegan
    });
  }

  var clean = function (s) { return String(s || '').replace(/\s+/g, ' ').trim(); };
  K.onSignOut(function () { work = null; workFor = ''; dirty = false; saved = ''; });   // Sign out or Start over: the next family starts from the store again

  /* ---- "I also plan an event": a small, quiet link at the very bottom, only while the family has no event. It opens a box with the three kinds; pressing one adds that
   * sample event (DemoStore.addEvent) and opens the My event tab, which is not on the bar until there is an event. */
  function openEventBox(d) {
    var uh = d.ui.h, vanessa = d.data.CONTACTS ? d.data.CONTACTS.vanessa : null;
    function pick(kind) {   // (the box closes itself after its button's action)
      var made = d.store.addEvent(kind);
      if (!made) { K.toast('That did not work. Please try again.'); return; }
      K.toast('Added. My event is now in your tabs.');
      if (d.ctx && typeof d.ctx.go === 'function') d.ctx.go('event');
    }
    var kinds = d.data.EVENT_KINDS.filter(function (k) { return k.key !== 'none'; }).map(function (k) {
      return { label: k.short, id: k.key, onClick: function () { pick(k.key); } };
    });
    d.ui.modal({
      title: 'I also plan an event', focus: 'button[data-demo-action="' + (kinds.length ? kinds[0].id : '') + '"]',   // the first kind, not Vanessa's link, has the focus when the box opens
      body: [
        uh('p', null, 'What kind of event do you plan? We add a sample one to try, and a My event tab shows in your tabs.'),
        vanessa ? uh('p', { class: 'demo-hint' }, ['A school trip: ', uh('a', { href: vanessa.href }, vanessa.text)]) : null
      ],
      actions: kinds.concat([{ label: 'Not now', kind: 'ghost' }])
    });
  }
  function eventLink(d) {
    var has = true;
    if (!d.ui || typeof d.ui.modal !== 'function' || !d.data || !d.data.EVENT_KINDS || !d.store || typeof d.store.addEvent !== 'function') return null;
    try { has = (d.store.list('events') || []).length > 0; } catch (e) { has = true; }
    if (has) return null;
    return h('p', { class: 'dvf-event' }, K.h('button', { type: 'button', class: 'demo-linkbtn', 'data-k': 'fam-event', onclick: function () { openEventBox(d); } }, 'I also plan an event'));
  }

  K.css('dvf-css', [
    '.dvk .dvf-grid{align-items:stretch}',
    '.dvk .dvf-after{display:flex;flex-wrap:wrap;align-items:center;gap:6px 16px}',
    '.dvk .dvf-after .dvk-note{margin:0}',
    '.dvk .dvf-who{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin:0;font-weight:700}',
    '.dvk .dvf-list{display:grid;gap:12px;margin:0 0 14px;padding:0;list-style:none}',
    '.dvk .dvf-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 10px;align-items:end}',
    '.dvk .dvf-row.dvf-kid{grid-template-columns:minmax(0,1fr) 5.4rem auto}',
    '.dvk .dvf-row .btn{white-space:nowrap}',
    '@media (max-width:22.5em){.dvk .dvf-row.dvf-kid{grid-template-columns:minmax(0,1fr) 5.4rem}.dvk .dvf-row.dvf-kid .btn{grid-column:1/-1;justify-self:start}}',
    '.dvk .dvf-checks{display:grid;gap:2px;margin:12px 0 4px}',
    '.dvk .dvf-save{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin-top:10px}',
    '.dvk .dvf-status{margin:0;font:700 .98rem/1.3 var(--display);color:var(--green-deep)}',
    '.dvk .dvf-status:empty{display:none}',
    '.dvk .dvf-status.is-bad{color:var(--red-deep)}',
    '.dvk .dvf-event{margin:0}'
  ].join('\n'));

  function paint(root, d, redraw) {
    var acct = K.account(d), who = [acct.id, acct.created, acct.email, acct.name].join('|');   // a new account (after Start over) starts from the store again
    if (!dirty || !work || workFor !== who) { work = readFamily(d.store); workFor = who; dirty = false; }
    var adultFields = [], kidNames = [], kidAges = [];
    var status = h('p', { class: 'dvf-status', role: 'status' }, saved);
    var undo;

    function touch() {   // something was typed or changed: it is not saved yet
      dirty = true; saved = '';
      status.textContent = ''; status.className = 'dvf-status';
      if (undo) undo.disabled = false;
    }
    function bad(text) { status.textContent = text; status.className = 'dvf-status is-bad'; }

    /* ---- grown-ups */
    var adultRows = work.adults.map(function (name, i) {
      var f = K.field({ label: 'Grown-up ' + (i + 1), value: name, max: MAX_NAME, k: 'fam-a-' + i, oninput: function (v) { if (work) work.adults[i] = v; touch(); } });
      adultFields.push(f);
      return h('li', { class: 'dvf-row' }, [f.wrap, K.btn('Remove', {
        kind: 'ghost', disabled: work.adults.length < 2, label: 'Remove grown-up ' + (i + 1) + (clean(name) ? ': ' + clean(name) : ''),
        onclick: function () { if (work) work.adults.splice(i, 1); touch(); K.keepFocus('fam-add-a'); redraw(); }
      })]);
    });
    var addAdult = K.btn('Add a grown-up', { kind: 'ghost', disabled: work.adults.length >= MAX_ADULTS, k: 'fam-add-a', onclick: function () {
      if (!work) return;
      work.adults.push(''); touch(); K.keepFocus('fam-a-' + (work.adults.length - 1)); redraw();
    } });

    /* ---- kids */
    var kidRows = work.kids.map(function (kid, i) {
      var n = i + 1;
      var fn = K.field({ label: 'Child ' + n, value: kid.name, max: MAX_NAME, k: 'fam-k-' + i, oninput: function (v) { if (work && work.kids[i]) work.kids[i].name = v; touch(); } });
      var fa = K.field({ label: ['Age', h('span', { class: 'sr-only' }, ' of child ' + n)], type: 'number', min: 0, value: kid.age, k: 'fam-g-' + i, oninput: function (v) { if (work && work.kids[i]) work.kids[i].age = v; touch(); } });
      fa.input.setAttribute('max', '17');
      kidNames.push(fn); kidAges.push(fa);
      return h('li', { class: 'dvf-row dvf-kid' }, [fn.wrap, fa.wrap, K.btn('Remove', {
        kind: 'ghost', label: 'Remove child ' + n + (clean(kid.name) ? ': ' + clean(kid.name) : ''),
        onclick: function () { if (work) work.kids.splice(i, 1); touch(); K.keepFocus('fam-add-k'); redraw(); }
      })]);
    });
    var addKid = K.btn('Add a child', { kind: 'ghost', disabled: work.kids.length >= MAX_KIDS, k: 'fam-add-k', onclick: function () {
      if (!work) return;
      work.kids.push({ name: '', age: '' }); touch(); K.keepFocus('fam-k-' + (work.kids.length - 1)); redraw();
    } });

    /* ---- food notes */
    var notes = K.field({ label: 'Allergies and food notes', type: 'textarea', value: work.allergies, max: MAX_NOTES, rows: 3, ph: 'For example: no peanuts', k: 'fam-notes',
      hint: 'Up to ' + MAX_NOTES + ' letters.', oninput: function (v) { if (work) work.allergies = v; touch(); } });
    var gf = K.check({ label: 'We need gluten-free crust', checked: work.glutenFree, k: 'fam-gf', onChange: function (v) { if (work) work.glutenFree = v; touch(); } });
    var vg = K.check({ label: 'We need vegan cheese', checked: work.vegan, k: 'fam-vg', onChange: function (v) { if (work) work.vegan = v; touch(); } });

    /* ---- save */
    function save() {
      if (!work) return;   // the form was forgotten (signed out in another tab)
      var adults = work.adults.map(clean), kids = work.kids.map(function (k) { return { name: clean(k.name), age: String(k.age).trim() }; });
      var first = null;
      function flag(f, msg) { f.error(msg); if (msg && !first) first = f; }
      adultFields.forEach(function (f, i) { flag(f, adults[i] ? '' : 'Type a name.'); });
      kidNames.forEach(function (f, i) { flag(f, kids[i].name ? '' : 'Type a name.'); });
      kidAges.forEach(function (f, i) { var a = kids[i].age; flag(f, /^\d{1,2}$/.test(a) && +a <= 17 ? '' : 'Type 0 to 17.'); });
      if (first) { bad('Please fix the boxes marked with !'); first.input.focus(); return; }
      work = { adults: adults, kids: kids, allergies: clean(work.allergies), glutenFree: work.glutenFree, vegan: work.vegan };
      dirty = false;
      saved = 'Saved. The kitchen sees your food notes on pizza orders.';
      K.keepFocus('fam-save');
      status.textContent = saved; status.className = 'dvf-status';   // at once: the shell draws the screen again later (not while a text box has the focus)
      undo.disabled = true;
      writeFamily(d.store, work);
      K.toast('Your family is saved.');
    }
    var saveBtn = K.btn('Save my family', { kind: 'red', type: 'submit', k: 'fam-save' });
    undo = K.btn('Undo my changes', { kind: 'ghost', disabled: !dirty, onclick: function () { dirty = false; saved = ''; work = null; K.keepFocus('fam-save'); redraw(); } });

    var form = h('form', { class: 'dvk-form', novalidate: true }, [
      h('div', { class: 'dvk-grid dvf-grid' }, [
        h('section', { class: 'dvk-card c-sun', 'aria-labelledby': 'dvf-h-a' }, [
          h('h3', { id: 'dvf-h-a' }, 'Grown-ups'),
          h('p', { class: 'dvk-note' }, 'Who usually comes with you.'),
          h('ul', { class: 'dvf-list' }, adultRows), addAdult
        ]),
        h('section', { class: 'dvk-card c-sky', 'aria-labelledby': 'dvf-h-k' }, [
          h('h3', { id: 'dvf-h-k' }, 'Kids'),
          h('p', { class: 'dvk-note' }, 'Names and ages of the children who come.'),
          kidRows.length ? h('ul', { class: 'dvf-list' }, kidRows) : h('p', { class: 'dvk-empty' }, 'No children added.'), addKid
        ]),
        h('section', { class: 'dvk-card c-pink', 'aria-labelledby': 'dvf-h-f' }, [
          h('h3', { id: 'dvf-h-f' }, 'Food notes for the kitchen'),
          h('p', { class: 'dvk-note' }, 'The kitchen sees these on every pizza order from your account.'),
          notes.wrap,
          h('div', { class: 'dvf-checks' }, [gf, vg])
        ])
      ]),
      h('div', { class: 'dvf-save' }, [saveBtn, undo, status])
    ]);
    form.addEventListener('submit', function (ev) { ev.preventDefault(); save(); });

    var name = clean(acct.name), email = clean(acct.email);
    K.add(root, h('div', { class: 'dvk dvk-screen', 'data-tour': 'acct-family' }, [
      K.head(null, null, null, 'Keep your family up to date. The kitchen sees your food notes on every pizza order.'),
      name || email ? h('p', { class: 'dvf-who' }, [K.chip('info', 'Your account'), (name ? name : '') + (name && email ? ' · ' : '') + email]) : null,
      form,
      h('div', { class: 'dvf-after' }, [h('p', { class: 'dvk-note' }, 'Saving this does not change a visit you already booked.'), h('a', { class: 'btn btn-ghost btn-sm', href: '#visits' }, 'Change a visit')]),
      eventLink(d)
    ]));
  }

  K.view('family', 'My family', { paint: paint, slice: function (d) { return d.store ? [d.store.get('family'), dirty] : null; } });
})(window, document);
