/*
 * The live-room transport: one small interface the live tables talk through, so a server could be plugged in later (pure logic, unit-tested in Node).
 */
(function (root, factory) {
  'use strict';
  var mod = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = mod; }
  if (typeof window !== 'undefined') { window.GS = window.GS || {}; window.GS.transport = mod; }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';

  return {};
});
