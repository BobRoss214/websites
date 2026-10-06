/*
 * Charity marks for canvas games: GS.markImage(ch) returns a loaded image to draw (the charity's real logo, or its illustrated
 * emblem) or null while it is still loading; draw the monogram until it is not null. See also GS.logoFor (js/data.js) and
 * ui.mono (js/ui/common.js) for the DOM side.
 */
(function () {
  'use strict';
  var GS = (window.GS = window.GS || {});
  var cache = {};

  function sourceFor(ch) {
    var logo = GS.logoFor ? GS.logoFor(ch) : '';
    return logo || '';
  }

  /** A loaded image for this charity's mark, or null (not ready yet, or nothing to show). Call it every frame you draw. */
  GS.markImage = function (ch) {
    if (!ch) { return null; }
    var e = cache[ch.id];
    if (e) { return e.ready ? e.img : null; }
    var src = sourceFor(ch);
    e = cache[ch.id] = { img: null, ready: false };
    if (!src) { return null; }
    var img = new Image();
    e.img = img;
    img.onload = function () { e.ready = true; };
    img.onerror = function () { e.ready = false; };
    img.decoding = 'async';
    img.src = src;
    return null;
  };
})();
