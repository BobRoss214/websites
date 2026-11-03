/* Wise Acres account demo: the small shared pieces of the screens (a DOM builder, the way dates, times and money are written, a modal, a toast, a status chip,
 * the calendar file download). Used by the demo pages only; nothing here runs unless a demo page calls it. THE DEMO IS PRETEND: see docs/ACCOUNT_DEMO.md.
 *
 *   DemoUI.h(tag, attrs, ...children)     builds an element: attrs { class, text, on: { click: fn }, style: { prop: value }, any attribute }; children are text, elements or lists
 *   DemoUI.dateLong('2026-11-14')         "Saturday, Nov 14"          DemoUI.time12('14:00')  "2:00 pm"          DemoUI.money(4.5)  "$4.50"
 *   DemoUI.modal({ title, body, actions, wide, onClose })  a dialog: returns { el, body, actions, close }      DemoUI.confirm({ title, text, yes, no })  a Promise of true or false
 *   DemoUI.toast(text, { kind })          a short message that fades by itself (one place for the whole demo)
 *   DemoUI.chip(text, kind)               a small status label (kind: wait, good, no, info, weather)         DemoUI.requestStatus(request)  { text, kind }
 *   DemoUI.download(name, text, type)     saves a file (the preview page saves files its own way)            DemoUI.addToCalendar(visit, order)
 * Plain JavaScript, no libraries, written for the same browsers as the rest of the site (no newer syntax). */
(function () {
  'use strict';

  var doc = document, Data = window.DemoData, seq = 0;

  /* ---------------------------------------------------------------- building elements (never innerHTML with other people's words) */
  function add(el, kids) {
    kids.forEach(function (c) {
      if (c == null || c === false || c === true) return;
      if (Array.isArray(c)) add(el, c);
      else el.appendChild(c.nodeType ? c : doc.createTextNode(String(c)));
    });
  }
  function h(tag, attrs) {
    var el = doc.createElement(tag), kids = Array.prototype.slice.call(arguments, 2);
    if (attrs != null && (typeof attrs !== 'object' || attrs.nodeType || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }   // h('p', 'words') and h('p', element)
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'on') Object.keys(v).forEach(function (ev) { el.addEventListener(ev, v[ev]); });
        else if (k === 'style' && typeof v === 'object') Object.keys(v).forEach(function (p) { el.style.setProperty(p, v[p]); });
        else el.setAttribute(k, v === true ? '' : String(v));
      });
    }
    add(el, kids);
    return el;
  }
  // a drawing from the page's own icon sprite: icon('i-bell'). The sprite of a demo page has the drawings its scripts name (tools/pages.py).
  function icon(id, cls) {
    var ns = 'http://www.w3.org/2000/svg', svg = doc.createElementNS(ns, 'svg'), use = doc.createElementNS(ns, 'use');
    svg.setAttribute('class', 'ico' + (cls ? ' ' + cls : '')); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    use.setAttribute('href', '#' + id);
    svg.appendChild(use);
    return svg;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

  /* ---------------------------------------------------------------- words */
  // "Nov 3, 2:14 pm", or "Today, 2:14 pm" for a stamp of the store ('YYYY-MM-DD HH:MM')
  function when(at, today) {
    var m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/.exec(String(at || ''));
    if (!m) return '';
    return (m[1] === (today || Data.today()) ? 'Today' : Data.dateShort(m[1])) + ', ' + Data.time12(m[2]);
  }
  // The side a request goes to, in a sentence: "Mrs. Cathy", "the kitchen"
  function side(to) { var s = Data.WHO[to] || to; return s.replace(/^The /, 'the '); }
  // What a family screen says about a request: { text, kind }. The words of the plan: "Waiting for a reply from Mrs. Cathy" and "Waiting for the kitchen".
  function requestStatus(q) {
    var farm = Data.WHO[q.to] || q.to;
    if (q.status === 'waiting') return { text: q.to === 'kitchen' ? 'Waiting for the kitchen' : 'Waiting for a reply from ' + farm, kind: 'wait' };
    if (q.status === 'yes') return { text: farm + ' said yes', kind: 'good' };
    if (q.status === 'no') return { text: farm + ' said no', kind: 'no' };
    if (q.status === 'suggested') return { text: q.to === 'kitchen' ? 'The kitchen suggests this instead' : farm + ' suggests something else', kind: 'info' };
    if (q.status === 'accepted') return { text: 'You said OK to the new plan', kind: 'good' };
    if (q.status === 'declined') return { text: 'You kept your plan', kind: 'info' };
    if (q.status === 'cancelled') return { text: 'You cancelled your request', kind: 'info' };
    return { text: q.status, kind: 'info' };
  }
  function chip(text, kind) { return h('span', { class: 'demo-chip' + (kind ? ' is-' + kind : '') }, text); }

  /* ---------------------------------------------------------------- focus */
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  function focusables(root) { return Array.prototype.filter.call(root.querySelectorAll(FOCUSABLE), function (e) { return !e.hidden && e.getClientRects().length > 0; }); }

  /* ---------------------------------------------------------------- the modal: a dialog with a focus trap (Escape closes, so does a click outside) */
  var open = [];
  function modal(o) {
    o = o || {};
    var opener = doc.activeElement, id = 'demo-modal-' + (++seq), closed = false;
    var body = h('div', { class: 'demo-modal-body' }, o.body), actions = h('div', { class: 'demo-modal-actions' });
    var box = h('div', { class: 'demo-modal-box' + (o.wide ? ' is-wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': id + '-t', tabindex: '-1' },
      h('button', { type: 'button', class: 'demo-modal-x', 'aria-label': 'Close', on: { click: function () { close(); } } }, '×'),
      h('h2', { id: id + '-t', class: 'demo-modal-title' }, o.title || ''), body, actions);
    var back = h('div', { class: 'demo-modal', 'data-demo-modal': '' }, box);
    function close() {
      if (closed) return;
      closed = true;
      back.remove();
      open = open.filter(function (m) { return m !== api; });
      if (!open.length) doc.documentElement.classList.remove('demo-modal-open');
      doc.removeEventListener('keydown', onKey, true);
      if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus();
      if (o.onClose) o.onClose();
    }
    function onKey(e) {
      if (open[open.length - 1] !== api) return;   // only the top one
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (e.key !== 'Tab') return;
      var list = focusables(box);
      if (!list.length) { e.preventDefault(); box.focus(); return; }
      var first = list[0], lastEl = list[list.length - 1];
      if (e.shiftKey && (doc.activeElement === first || doc.activeElement === box)) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && doc.activeElement === lastEl) { e.preventDefault(); first.focus(); }
    }
    back.addEventListener('mousedown', function (e) { if (e.target === back) close(); });
    (o.actions || []).forEach(function (a) {
      actions.appendChild(h('button', {
        type: 'button', class: 'btn btn-sm ' + (a.kind === 'ghost' ? 'btn-ghost' : a.kind === 'red' ? 'btn-red' : 'btn-sun'), 'data-demo-action': a.id || '',
        on: { click: function () { if (a.onClick && a.onClick() === false) return; if (a.close !== false) close(); } }
      }, a.label));
    });
    var api = { el: box, body: body, actions: actions, close: close };
    open.push(api);
    doc.body.appendChild(back);
    doc.documentElement.classList.add('demo-modal-open');
    doc.addEventListener('keydown', onKey, true);
    var first = o.focus ? box.querySelector(o.focus) : null;
    (first || focusables(body)[0] || actions.querySelector('button') || box).focus();
    return api;
  }
  // confirm({ title, text, yes, no, danger }) -> a Promise of true (the first button) or false (the second, Escape, or a click outside)
  function confirmBox(o) {
    o = o || {};
    return new Promise(function (resolve) {
      var answered = false, answer = function (v) { if (!answered) { answered = true; resolve(v); } };
      modal({
        title: o.title || 'Are you sure?', body: h('p', o.text || ''), onClose: function () { answer(false); },
        actions: [{ label: o.yes || 'Yes', kind: o.danger ? 'red' : 'sun', id: 'yes', onClick: function () { answer(true); } }, { label: o.no || 'No', kind: 'ghost', id: 'no', onClick: function () { answer(false); } }]
      });
    });
  }

  /* ---------------------------------------------------------------- the toast: one polite message place for the whole demo */
  var toastBox = null;
  function toast(text, o) {
    o = o || {};
    if (!toastBox || !toastBox.isConnected) {
      toastBox = h('div', { class: 'demo-toasts', role: 'status', 'aria-live': 'polite', 'data-demo-toasts': '' });
      doc.body.appendChild(toastBox);
    }
    var t = h('p', { class: 'demo-toast' + (o.kind ? ' is-' + o.kind : '') }, text);
    toastBox.appendChild(t);
    while (toastBox.children.length > 3) toastBox.removeChild(toastBox.firstChild);
    setTimeout(function () { t.remove(); }, o.ms || 6000);
    return t;
  }

  /* ---------------------------------------------------------------- files */
  function download(name, text, type) {
    var blob = new Blob([text], { type: type || 'text/calendar;charset=utf-8' }), W = window.WISE_ACRES;
    if (W && typeof W.saveFile === 'function') { W.saveFile(name, blob); return; }   // the preview page saves files its own way
    var url = URL.createObjectURL(blob), a = h('a', { href: url, download: name });
    doc.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  }
  function addToCalendar(visit, order) { download('wise-acres-visit-' + visit.date + '.ics', Data.visitICS(visit, order)); }

  window.DemoUI = {
    h: h, icon: icon, clear: clear, focusables: focusables,
    dateLong: Data.dateLong, dateShort: Data.dateShort, weekdayName: Data.weekdayName, time12: Data.time12, money: Data.money, when: when, side: side,
    chip: chip, requestStatus: requestStatus, modal: modal, confirm: confirmBox, toast: toast, download: download, addToCalendar: addToCalendar
  };
})();
