/* Small shared helpers for the games and the UI. */
(function () {
  'use strict';
  var GS = (window.GS = window.GS || {});

  var reduceMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  // ?fast=1 squeezes every animation (used by automated tests and handy for quick demos).
  GS.timeScale = /[?&]fast=1\b/.test(window.location.search) ? 0.08 : 1;

  GS.util = {
    mod: function (a, n) { return ((a % n) + n) % n; },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    clamp: function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); },
    easeOutQuart: function (t) { return 1 - Math.pow(1 - t, 4); },
    easeOutCubic: function (t) { return 1 - Math.pow(1 - t, 3); },
    easeInOut: function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },

    reducedMotion: function () { return reduceMq.matches; },

    /** Scales a duration in ms for test mode and for people who prefer reduced motion. */
    dur: function (ms) { return ms * GS.timeScale * (reduceMq.matches ? 0.45 : 1); },

    sleep: function (ms) { return new Promise(function (resolve) { setTimeout(resolve, GS.util.dur(ms)); }); },

    /** Waits for the next animation frame. */
    frame: function () { return new Promise(function (resolve) { requestAnimationFrame(resolve); }); },

    esc: function (s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },

    /** Relative luminance of a #rrggbb colour, 0 (black) to 1 (white). */
    luminance: function (hex) {
      var n = parseInt(hex.slice(1), 16);
      var ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (v) {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
    },

    /** Readable label colour for text drawn on `hex`. */
    inkOn: function (hex) { return GS.util.luminance(hex) > 0.3 ? '#0B1020' : '#FFFFFF'; },

    /** #rrggbb + alpha -> rgba() string. */
    rgba: function (hex, a) {
      var n = parseInt(hex.slice(1), 16);
      return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
    },

    /** Returns a function that runs `fn` with a ResizeObserver (falls back to window resize). */
    observeSize: function (el, fn) {
      if (window.ResizeObserver) {
        var ro = new ResizeObserver(function () { fn(); });
        ro.observe(el);
        return function () { ro.disconnect(); };
      }
      window.addEventListener('resize', fn);
      return function () { window.removeEventListener('resize', fn); };
    }
  };

  GS.games = GS.games || {};

  /** A tiny event bus so the UI modules can react to each other without importing each other. */
  var handlers = {};
  GS.bus = {
    on: function (name, fn) { (handlers[name] = handlers[name] || []).push(fn); },
    emit: function (name, data) {
      (handlers[name] || []).slice().forEach(function (fn) {
        try { fn(data); } catch (e) { if (window.console) { console.error(e); } }
      });
    }
  };
})();
