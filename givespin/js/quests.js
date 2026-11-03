/*
 * Quests and the season track: daily and weekly quests, their progress worked out from the saved history, and the 30 season tiers (pure logic, unit-tested in Node).
 */
(function (root, factory) {
  'use strict';
  var mod = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = mod; }
  if (typeof window !== 'undefined') { window.GS = window.GS || {}; window.GS.quests = mod; }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';

  return {};
});
