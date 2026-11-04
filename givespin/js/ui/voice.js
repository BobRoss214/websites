/*
 * The voice: the few lines that show up in more than one place (the house-edge strip on the lobby, Fair Play and Help; the loading
 * lines) kept in one spot so they never drift apart. The rules and the vocabulary are in docs/voice.md. All other copy lives where it is shown.
 *
 *   GS.ui.voice.HOUSE          "House edge: 0%. The house is a charity."
 *   GS.ui.voice.houseStrip()   that line as a small strip (HTML), with a link to "How we make money"
 *   GS.ui.voice.loading()      the next loading line ("Shuffling the charities…"), in turn, so a test can rely on the order
 */
(function () {
  'use strict';
  var GS = window.GS;
  var ui = GS.ui;

  var LOADING = ['Shuffling the charities…', 'Polishing the confetti…', 'Warming up the tables…'];
  var n = 0;

  function loading() {
    var line = LOADING[n % LOADING.length];
    n += 1;
    return line;
  }

  /** The strip itself: "House edge: 0%." in bold, the rest plain, and the honest follow-up one tap away. */
  function houseStrip() {
    return '<p class="housestrip">' + ui.icon('house') + '<span><b>House edge: 0%.</b> The house is a charity. <a href="#help-money">How we make money: we do not.</a></span></p>';
  }

  ui.voice = { HOUSE: 'House edge: 0%. The house is a charity.', LOADING: LOADING, loading: loading, houseStrip: houseStrip };
})();
