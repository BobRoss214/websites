/* The account demo: the "Photos and reviews" screen (account.html#photos).
 *
 * After a visit the family can send a photo, 1 to 5 stars and a sentence to Mrs. Cathy. She looks at each one at her desk page and
 * approves it (or not). An approved one shows under "Shared with the farm (demo)". It never touches the real photo gallery or the
 * real reviews of the website: it only lives in the demo state, and nothing is sent anywhere.
 *
 * The photo is one of THREE SAMPLE PICTURES from the farm's own gallery (assets/photos). Nobody picks a file from a phone or a computer
 * here, and nothing is uploaded: the record only keeps the address of the sample picture (field `thumb`) and its name (`photoName`).
 *
 * Reads : visits (past ones: the date is before today), reviews, photos.
 * Writes: stars chosen    -> submitReview({visitId, stars, text, photoName, thumb})  (the picture rides inside the review)
 *         photo, no stars -> submitPhoto({visitId, name, thumb}) (its caption, if any, is saved with update('photos', id, {text}))
 * The farm desk answers with decideReview(id, ok) and decidePhoto(id, ok); statuses: 'waiting' | 'approved' | 'declined'.
 * Link  : #photos?visit=<id> (the "Leave a review" and "Add photos" buttons of My visits) picks that visit in the form.
 * It uses js/demo-view-kit.js (loaded before this file). Text from the family goes in with textContent only. Plain, older-style JavaScript.
 */
(function () {
  'use strict';
  var W = window, D = document;
  var K = W.DemoViewKit;
  if (!K) {
    if (W.console) W.console.warn('Account demo: js/demo-view-kit.js must be loaded before js/demo-view-photos.js, so "Photos and reviews" is not added.');
    return;
  }
  var h = K.h;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var handled = '';          // the visit a link asked for, handled once

  // The three sample pictures: real photos of the farm that are already on the website (the words are the gallery's own in js/content.js)
  var SAMPLES = [
    { id: 'goat', src: 'assets/photos/goat-with-pumpkins.webp', name: 'Goat meets pumpkins', alt: 'A baby goat standing in the grass behind four small pumpkins' },
    { id: 'fire', src: 'assets/photos/sunflowers-and-pumpkins-by-the-fire.webp', name: 'Pumpkins by the fire', alt: 'A bucket of sunflowers and two pumpkins beside a crackling fire pit' },
    { id: 'berries', src: 'assets/photos/strawberries-in-pink-bucket.webp', name: 'Fresh-picked strawberries', alt: 'A pink bucket piled high with fresh-picked strawberries' }
  ];
  function sampleById(id) {
    var i;
    for (i = 0; i < SAMPLES.length; i++) if (SAMPLES[i].id === id) return SAMPLES[i];
    return null;
  }
  function sampleBySrc(src) {
    var i;
    for (i = 0; i < SAMPLES.length; i++) if (SAMPLES[i].src === src) return SAMPLES[i];
    return null;
  }
  // A picture address is only used when it is a photo of this website (nothing from another site is ever loaded)
  function safeSrc(src) { return /^assets\/photos\/[\w-]+\.(webp|jpg|jpeg|png)$/.test(String(src || '')) ? String(src) : ''; }

  K.css('dvk-css-b2-photos', [
    '.dvk .dvk-ph-stack{display:grid;gap:clamp(14px,2vw,22px);min-width:0}',
    '.dvk .dvk-ph-list{display:grid;gap:12px;margin:0;padding:0;list-style:none}',
    '.dvk .dvk-ph-item{display:flex;align-items:flex-start;gap:14px;min-width:0;padding:12px;background:#fff;border:2.5px solid var(--ink);border-radius:18px}',
    '.dvk .dvk-ph-thumb{flex:none;width:104px;height:104px;object-fit:cover;background:#f3ead2;border:2.5px solid var(--ink);border-radius:14px}',
    '.dvk .dvk-ph-body{display:grid;gap:5px;flex:1 1 auto;min-width:0;justify-items:start}',
    '.dvk .dvk-ph-body p{margin:0}',
    '.dvk .dvk-ph-quote{overflow-wrap:anywhere}',
    '.dvk .dvk-ph-meta{font-size:.88rem;font-weight:600;color:var(--ink-soft);overflow-wrap:anywhere}',
    '.dvk .dvk-ph-stars{display:inline-flex;gap:2px}',
    '.dvk .dvk-star{flex:none;width:22px;height:22px;fill:#fff;stroke:var(--ink);stroke-width:1.7;stroke-linejoin:round}',
    '.dvk .dvk-star-on{fill:var(--sun)}',
    '.dvk .dvk-stars{display:grid;gap:4px;min-width:0;margin:0;padding:0;border:0}',
    '.dvk .dvk-stars legend{padding:0;margin-bottom:4px;font:800 1rem/1.3 var(--display)}',
    '.dvk .dvk-star-row{display:flex;flex-wrap:wrap;gap:2px}',
    '.dvk .dvk-star-pick{position:relative;display:grid;place-items:center;width:46px;height:46px;cursor:pointer;-webkit-tap-highlight-color:transparent}',
    '.dvk .dvk-star-pick input{position:absolute;top:0;left:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}',
    '.dvk .dvk-star-pick .dvk-star{width:36px;height:36px;pointer-events:none}',
    '.dvk .dvk-star-pick input:focus-visible+.dvk-star{outline:4px solid var(--focus);outline-offset:3px;border-radius:6px}',
    '.dvk .dvk-pics{display:grid;gap:6px;min-width:0;margin:0;padding:0;border:0}',
    '.dvk .dvk-pics legend{padding:0;margin-bottom:4px;font:800 1rem/1.3 var(--display)}',
    '.dvk .dvk-pic-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:12px 10px}',
    '.dvk .dvk-pic{position:relative;display:grid;gap:5px;align-content:start;justify-items:center;min-width:0;cursor:pointer;-webkit-tap-highlight-color:transparent}',
    '.dvk .dvk-pic input{position:absolute;top:0;left:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}',
    '.dvk .dvk-pic-frame{position:relative;display:grid;place-items:center;width:100%;max-width:128px;height:96px;background:#f3ead2;border:3px solid var(--ink);border-radius:16px;box-shadow:0 3px 0 var(--ink)}',
    '.dvk .dvk-pic-frame img{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;border-radius:12px}',
    '.dvk .dvk-pic-no{padding:6px;border-style:dashed;font:700 .85rem/1.2 var(--display);color:var(--ink-soft);text-align:center}',
    '.dvk .dvk-pic-name{font:700 .8rem/1.2 var(--display);text-align:center;overflow-wrap:anywhere}',
    '.dvk .dvk-pic input:checked+.dvk-pic-frame{border-color:var(--green-deep);box-shadow:0 0 0 4px var(--green)}',
    '.dvk .dvk-pic input:checked+.dvk-pic-frame::after{content:"\\2713";position:absolute;top:-9px;right:-9px;display:grid;place-items:center;width:28px;height:28px;background:var(--green);border:2.5px solid var(--ink);border-radius:50%;color:#fff;font:800 1rem/1 var(--display)}',
    '.dvk .dvk-pic input:focus-visible+.dvk-pic-frame{outline:4px solid var(--focus);outline-offset:4px}',
    '@media (max-width:30em){.dvk .dvk-ph-item{flex-direction:column;align-items:stretch}}'
  ].join('\n'));

  /* ------------------------------------------------------------ reading the store */
  function listOf(store, coll) {
    var l = [];
    try { l = store.list(coll) || []; } catch (e) { l = []; }
    return Array.isArray(l) ? l : [];
  }
  function pastVisits(store, today) {
    return listOf(store, 'visits').filter(function (v) { return v && String(v.date) < today; })
      .sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  }
  // Reviews and photos, newest first, in one shape
  function sharedItems(store) {
    var out = [];
    listOf(store, 'reviews').forEach(function (r) {
      out.push({ kind: 'review', id: r.id, visitId: r.visitId, stars: Number(r.stars) || 0, text: String(r.text || ''), name: String(r.photoName || ''), thumb: safeSrc(r.thumb), status: String(r.status || 'waiting'), at: r.at });
    });
    listOf(store, 'photos').forEach(function (p) {
      out.push({ kind: 'photo', id: p.id, visitId: p.visitId, stars: 0, text: String(p.text || ''), name: String(p.name || p.photoName || ''), thumb: safeSrc(p.thumb), status: String(p.status || 'waiting'), at: p.at });
    });
    out.sort(function (a, b) { return K.stampMs(b.at) - K.stampMs(a.at); });
    return out;
  }

  /* ------------------------------------------------------------ a star drawn as a picture (no letters, so no font can lack it) */
  var STAR_POINTS = (function () {
    var pts = [], i, a, r;
    for (i = 0; i < 10; i++) {
      a = Math.PI / 5 * i - Math.PI / 2;
      r = i % 2 ? 4.9 : 11;
      pts.push((12 + r * Math.cos(a)).toFixed(2) + ',' + (12.6 + r * Math.sin(a)).toFixed(2));
    }
    return pts.join(' ');
  })();
  function starClass(on) { return 'dvk-star' + (on ? ' dvk-star-on' : ''); }
  function star(on) {
    var s = D.createElementNS(SVGNS, 'svg'), p = D.createElementNS(SVGNS, 'polygon');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('class', starClass(on));
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    p.setAttribute('points', STAR_POINTS);
    s.appendChild(p);
    return s;
  }
  function starsShown(n) {
    var kids = [], i;
    for (i = 1; i <= 5; i++) kids.push(star(i <= n));
    return h('span', { class: 'dvk-ph-stars', role: 'img', 'aria-label': n + ' out of 5 stars' }, kids);
  }
  function starPicker(value, onPick) {
    var name = K.uid('stars'), row = h('div', { class: 'dvk-star-row' }), shapes = [];
    [1, 2, 3, 4, 5].forEach(function (n) {
      var input = h('input', { type: 'radio', name: name, value: String(n), 'aria-label': n + (n === 1 ? ' star' : ' stars'), 'data-k': 'photo-star-' + n });
      var shape = star(n <= value);
      if (n === value) input.checked = true;
      shapes.push(shape);
      input.addEventListener('change', function () {
        shapes.forEach(function (s, i) { s.setAttribute('class', starClass(i < n)); });
        onPick(n);
      });
      row.appendChild(h('label', { class: 'dvk-star-pick' }, [input, shape]));
    });
    return h('fieldset', { class: 'dvk-stars' }, [h('legend', null, 'Your stars (1 to 5)'), row, h('p', { class: 'dvk-hint' }, 'You can leave the stars out if you send a photo.')]);
  }

  /* ------------------------------------------------------------ the three sample pictures */
  function picturePicker(chosen, onPick) {
    var name = K.uid('pic'), row = h('div', { class: 'dvk-pic-row' });
    function tile(id, frame, label) {
      var input = h('input', { type: 'radio', name: name, value: id, 'data-k': 'photo-pic-' + (id || 'none') });
      if (chosen === id) input.checked = true;
      input.addEventListener('change', function () { onPick(id); });
      return h('label', { class: 'dvk-pic' }, [input, frame, h('span', { class: 'dvk-pic-name' }, label)]);
    }
    row.appendChild(tile('', h('span', { class: 'dvk-pic-frame dvk-pic-no', 'aria-hidden': 'true' }, 'No photo'), 'No photo'));
    SAMPLES.forEach(function (s) {
      row.appendChild(tile(s.id, h('span', { class: 'dvk-pic-frame' }, h('img', { src: s.src, alt: '', width: '128', height: '96', loading: 'lazy', decoding: 'async' })), s.name));
    });
    return h('fieldset', { class: 'dvk-pics' }, [
      h('legend', null, 'Pick a photo to share (optional)'),
      row,
      h('p', { class: 'dvk-hint' }, 'These are three sample pictures from the farm’s own gallery. A real account would let you choose your own photo.')
    ]);
  }

  /* ------------------------------------------------------------ the form */
  function formCard(d, past, redraw, wanted) {
    var store = d.store, id = K.uid('phf');
    var ids = past.map(function (v) { return v.id; });
    var visit = K.draft('photos.visit', '');
    if (wanted && wanted !== handled && ids.indexOf(wanted) >= 0) { handled = wanted; visit = wanted; }
    if (!wanted) handled = '';
    if (ids.indexOf(visit) < 0) visit = ids[0];
    K.setDraft('photos.visit', visit);

    var pic = String(K.draft('photos.pic', ''));
    var stars = Number(K.draft('photos.stars', 0)) || 0;
    var err = h('p', { class: 'dvk-err', role: 'alert', hidden: true });
    var visitField = K.field({ label: 'Which visit?', type: 'select', key: 'photos.visit', value: visit, k: 'photo-visit',
      options: past.map(function (v) { return [v.id, K.fmtDate(v.date) + (v.time ? ', ' + K.fmtTime(v.time) : '')]; }) });
    var textField = K.field({ label: 'A sentence about your visit (optional)', type: 'textarea', key: 'photos.text', max: 280, rows: 3, k: 'photo-text',
      ph: 'For example: The kids loved the wagon ride.' });
    var picker = picturePicker(pic, function (v) { K.setDraft('photos.pic', v); err.hidden = true; err.textContent = ''; });
    var starBox = starPicker(stars, function (n) { K.setDraft('photos.stars', n); err.hidden = true; err.textContent = ''; });
    var send = K.btn('Send to Mrs. Cathy', { kind: 'red', type: 'submit', small: false, k: 'photos-send' });
    var form = h('form', { class: 'dvk-form', novalidate: true }, [visitField.wrap, picker, starBox, textField.wrap, err, h('div', { class: 'dvk-actions' }, send)]);

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var visitId = K.draft('photos.visit', visit), n = Number(K.draft('photos.stars', 0)) || 0, chosen = sampleById(String(K.draft('photos.pic', ''))), made;
      var text = String(textField.input.value || '').replace(/\s+/g, ' ').trim();
      if (!n && !chosen) { err.textContent = 'Pick a photo, or give 1 to 5 stars, before you send.'; err.hidden = false; return; }
      K.keepFocus('photos-send');
      K.clearDraft('photos.pic'); K.clearDraft('photos.stars'); K.clearDraft('photos.text');
      try {
        if (n) {
          store.submitReview({ visitId: visitId, stars: n, text: text, photoName: chosen ? chosen.name : '', thumb: chosen ? chosen.src : '' });
        } else {
          made = typeof store.submitPhoto === 'function' ? store.submitPhoto({ visitId: visitId, name: chosen.name, thumb: chosen.src })
            : store.add('photos', { visitId: visitId, name: chosen.name, thumb: chosen.src, status: 'waiting', at: new Date().getTime() });
          if (text && made && made.id !== undefined) store.update('photos', made.id, { text: text });
        }
      } catch (e) {
        K.setDraft('photos.pic', chosen ? chosen.id : ''); K.setDraft('photos.stars', n); K.setDraft('photos.text', text);
        K.toast('Sorry, that did not send. Please try again.');
        redraw();
        return;
      }
      K.toast('Sent to Mrs. Cathy. It shows here when she approves it.');
    });

    return h('section', { class: 'dvk-card c-sun', 'aria-labelledby': id }, [
      h('h3', { id: id }, 'Share your visit'),
      h('p', { class: 'dvk-note' }, 'Send a photo, some stars and a few words. Mrs. Cathy looks at each one before it is shared.'),
      form,
      h('p', { class: 'dvk-demo' }, 'Demo: nothing is uploaded or sent. The photos are samples.')
    ]);
  }

  /* ------------------------------------------------------------ what was sent */
  function itemCard(it, visits) {
    var v = null, i, when = '', sample = it.thumb ? sampleBySrc(it.thumb) : null;
    for (i = 0; i < visits.length; i++) if (visits[i].id === it.visitId) v = visits[i];
    if (v) when = 'Visit: ' + K.fmtDate(v.date);
    var sent = it.at ? 'Sent ' + K.fmtStamp(it.at) : '';
    var pic = it.thumb ? h('img', { class: 'dvk-ph-thumb', src: it.thumb, alt: sample ? sample.alt : 'Your photo' + (it.name ? ': ' + it.name : ''), width: '104', height: '104', loading: 'lazy', decoding: 'async' }) : null;
    var chip = it.status === 'approved' ? K.chip('ok', 'Approved by Mrs. Cathy')
      : it.status === 'declined' ? K.chip('no', 'Not shared this time') : K.chip('wait', 'Waiting for Mrs. Cathy to approve');
    return h('li', { class: 'dvk-ph-item', 'data-status': it.status }, [pic, h('div', { class: 'dvk-ph-body' }, [
      chip,
      it.stars ? starsShown(it.stars) : null,
      it.text ? h('p', { class: 'dvk-ph-quote' }, '“' + it.text + '”') : null,
      it.name ? h('p', { class: 'dvk-ph-meta' }, 'Photo: ' + it.name) : null,
      it.status === 'declined' ? h('p', { class: 'dvk-ph-meta' }, 'Mrs. Cathy did not share this one. It stays private to you.') : null,
      h('p', { class: 'dvk-ph-meta' }, [when, when && sent ? ' · ' : '', sent])
    ])]);
  }
  function group(title, cls, items, visits, empty) {
    var id = K.uid('phg');
    return h('section', { class: 'dvk-card ' + cls, 'aria-labelledby': id }, [
      h('h3', { id: id }, title),
      items.length ? h('ul', { class: 'dvk-ph-list' }, items.map(function (it) { return itemCard(it, visits); })) : h('p', { class: 'dvk-empty' }, empty)
    ]);
  }

  /* ------------------------------------------------------------ the screen */
  function paint(root, d, redraw) {
    var store = d.store, today = K.todayOf(d);
    var params = (d.ctx && d.ctx.params) || {};
    var wanted = params.visit ? String(params.visit) : '';
    var past = pastVisits(store, today);
    var all = sharedItems(store);
    var visits = listOf(store, 'visits');
    var waiting = all.filter(function (x) { return x.status !== 'approved' && x.status !== 'declined'; });
    var approved = all.filter(function (x) { return x.status === 'approved'; });
    var declined = all.filter(function (x) { return x.status === 'declined'; });

    var first = past.length ? formCard(d, past, redraw, wanted)
      : h('section', { class: 'dvk-card c-sun' }, [
        h('h3', null, 'Share your visit'),
        h('p', { class: 'dvk-empty' }, 'After your first visit you can send a photo and a review here.')
      ]);
    var stack = h('div', { class: 'dvk-ph-stack' }, [
      waiting.length ? group('Waiting for Mrs. Cathy to approve', 'c-cream', waiting, visits, '') : null,
      group('Shared with the farm (demo)', 'c-green', approved, visits, 'Nothing here yet. When Mrs. Cathy approves a photo or a review, it shows here.'),
      declined.length ? group('Not shared this time', 'c-pink', declined, visits, '') : null
    ]);
    root.appendChild(h('section', { class: 'dvk dvk-screen', 'aria-label': 'Photos and reviews' }, [
      K.head(null, null, null, 'After a visit, send a photo and a review. Demo: you pick one of three sample photos, and this never touches the farm’s real photo gallery or real reviews.'),
      h('div', { class: 'dvk-grid', 'data-tour': 'acct-photos' }, [first, stack])
    ]));
  }

  function slice(d) {
    return {
      visits: listOf(d.store, 'visits').map(function (v) { return [v.id, v.date]; }),
      shared: sharedItems(d.store).map(function (x) { return [x.kind, x.id, x.status, x.thumb, x.stars, x.text]; })
    };
  }

  K.view('photos', 'Photos and reviews', { paint: paint, slice: slice });
})();
