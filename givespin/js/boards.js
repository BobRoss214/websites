/*
 * Leaderboards: top crews, top charities and top players for this week and all time, always with the visitor's own row (pure logic, unit-tested in Node; every other player is a labelled bot).
 */
(function (root, factory) {
  'use strict';
  var mod = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = mod; }
  if (typeof window !== 'undefined') { window.GS = window.GS || {}; window.GS.boards = mod; }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';

  return {};
});
