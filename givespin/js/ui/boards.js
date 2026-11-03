/*
 * Leaderboards page (#boards). This is a placeholder that keeps the route working until the page is built.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var ui = GS.ui;
  var esc = ui.esc;

  ui.pages['boards'] = function () {
    var root = ui.$('#view-boards');
    root.innerHTML = '<header class="page-head"><div><h1>' + esc('Leaderboards') + '</h1><p>' + esc('Top crews, charities and players.') + '</p></div></header>';
  };
})();
