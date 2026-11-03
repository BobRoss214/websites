/*
 * My profile page (#me). This is a placeholder that keeps the route working until the page is built.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var ui = GS.ui;
  var esc = ui.esc;

  ui.pages['me'] = function () {
    var root = ui.$('#view-me');
    root.innerHTML = '<header class="page-head"><div><h1>' + esc('My profile') + '</h1><p>' + esc('Your rank, your giving and your cards in one place.') + '</p></div></header>';
  };
})();
