/* Wise Acres account demo: the "My visits" screen (#visits). A plain list for now; the real screen (the visit card, Request a different day, receipts) comes in the next step.
 * THE DEMO IS PRETEND: see docs/ACCOUNT_DEMO.md. */
(function () {
  'use strict';
  if (!window.DemoApp) return;   // the kitchen and the desk load other scripts, not this screen
  var h = DemoUI.h;
  DemoApp.view('visits', {
    label: 'My visits',
    render: function (root, ctx) {
      ctx.store.list('visits').forEach(function (v) {
        root.appendChild(h('section', { class: 'demo-card' }, h('h3', ctx.ui.dateLong(v.date) + ', ' + ctx.ui.time12(v.time)),
          h('p', (ctx.data.PACKAGES[v.package] || {}).name + '. Paid ' + ctx.ui.money(v.paid.total) + '.')));
      });
    }
  });
})();
