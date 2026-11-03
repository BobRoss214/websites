/*
 * Quests page (#quests). This is a placeholder that keeps the route working until the page is built.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var ui = GS.ui;
  var esc = ui.esc;

  ui.pages['quests'] = function () {
    var root = ui.$('#view-quests');
    root.innerHTML = '<header class="page-head"><div><h1>' + esc('Quests') + '</h1><p>' + esc('Daily and weekly goals, and the season track.') + '</p></div></header>';
  };
})();
