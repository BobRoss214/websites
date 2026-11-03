/*
 * Make it real page (#make-it-real). This is a placeholder that keeps the route working until the page is built.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var ui = GS.ui;
  var esc = ui.esc;

  ui.pages['make-it-real'] = function () {
    var root = ui.$('#view-make-it-real');
    root.innerHTML = '<header class="page-head"><div><h1>' + esc('Make it real') + '</h1><p>' + esc('What real giving would need.') + '</p></div></header>';
  };
})();
