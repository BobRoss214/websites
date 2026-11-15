/*
 * GiveSpin local storage helper for the newer features (quests, season, profile, spotlight, ticker, waitlist ...).
 * Every feature keeps its own key ("givespin:x:<name>") holding a small JSON value. Nothing here is ever required: a missing,
 * broken or blocked key just means the feature starts from nothing, and a full or blocked storage falls back to memory for the visit.
 * The main save (store.js, "givespin:v2") is never touched from here. Nothing leaves this device.
 */
(function (root, factory) {
  'use strict';
  var local = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = local; }
  if (typeof window !== 'undefined') { window.GS = window.GS || {}; window.GS.local = local; }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';

  var PREFIX = 'givespin:x:';
  var memory = {};

  function key(name) { return PREFIX + String(name).replace(/[^a-zA-Z0-9._-]/g, '_'); }
  function clone(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }
  function area() { try { return root.localStorage || null; } catch (e) { return null; } }

  return {
    PREFIX: PREFIX,

    /** The saved value, or `fallback` when there is none or it cannot be read. */
    get: function (name, fallback) {
      var k = key(name);
      try {
        var s = area();
        var raw = s ? s.getItem(k) : null;
        if (raw === null || raw === undefined) { return memory[k] !== undefined ? clone(memory[k]) : fallback; }
        var v = JSON.parse(raw);
        return v === null || v === undefined ? fallback : v;
      } catch (e) {
        return memory[k] !== undefined ? clone(memory[k]) : fallback;
      }
    },

    /** Saves a value (anything JSON can hold). Returns true when it reached storage, false when it only lives in memory for this visit. */
    set: function (name, value) {
      var k = key(name);
      var text;
      try { text = JSON.stringify(value); } catch (e) { return false; }
      if (text === undefined) { return false; }
      memory[k] = JSON.parse(text);
      try { var s = area(); if (!s) { return false; } s.setItem(k, text); delete memory[k]; return true; } catch (e) { return false; }
    },

    remove: function (name) {
      var k = key(name);
      delete memory[k];
      try { var s = area(); if (s) { s.removeItem(k); } } catch (e) { /* nothing to remove */ }
    },

    /** Forgets every key this helper made (the "erase my data" path calls it). */
    clearAll: function () {
      memory = {};
      try {
        var s = area();
        if (!s) { return; }
        var gone = [];
        for (var i = 0; i < s.length; i++) { var k = s.key(i); if (k && k.indexOf(PREFIX) === 0) { gone.push(k); } }
        gone.forEach(function (k) { s.removeItem(k); });
      } catch (e) { /* nothing to clear */ }
    }
  };
});
