/*
 * Charity of the week page (#spotlights). This is a placeholder that keeps the route working until the page is built.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var ui = GS.ui;
  var esc = ui.esc;

  ui.pages['spotlights'] = function () {
    var root = ui.$('#view-spotlights');
    root.innerHTML = '<header class="page-head"><div><h1>' + esc('Charity of the week') + '</h1><p>' + esc('One charity in the spotlight each week.') + '</p></div></header>';
  };
})();
