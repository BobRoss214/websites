/*
 * Sound effects, synthesised live with the Web Audio API (no audio files to load).
 * The AudioContext is only created after a user gesture, as browsers require.
 */
(function () {
  'use strict';
  var GS = (window.GS = window.GS || {});

  var ctx = null;
  var master = null;
  var noiseBuffer = null;
  var muted = false;

  // A browser only lets a page start sound after the visitor has touched it. Until then (a live table left running
  // with no click yet, say) every sound is skipped instead of creating a context the browser will refuse and log.
  var gesture = false;
  function markGesture() {
    gesture = true;
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (t) { document.removeEventListener(t, markGesture, true); });
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (t) { document.addEventListener(t, markGesture, true); });

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') { ctx.resume(); } return ctx; }
    if (!gesture && navigator.userActivation && navigator.userActivation.hasBeenActive) { gesture = true; }
    if (!gesture) { return null; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { return null; }
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.7;
      var comp = ctx.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }

  function noise() {
    if (noiseBuffer) { return noiseBuffer; }
    var len = ctx.sampleRate * 1.5;
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuffer.getChannelData(0);
    for (var i = 0; i < len; i++) { d[i] = Math.random() * 2 - 1; }
    return noiseBuffer;
  }

  /** One enveloped oscillator note. */
  function tone(freq, dur, type, vol, delay, slideTo) {
    var c = ensure();
    if (!c || muted) { return; }
    var t = c.currentTime + (delay || 0);
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) { o.frequency.exponentialRampToValueAtTime(slideTo, t + dur); }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.1, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  function burstNoise(dur, vol, fromHz, toHz, delay) {
    var c = ensure();
    if (!c || muted) { return; }
    var t = c.currentTime + (delay || 0);
    var src = c.createBufferSource();
    src.buffer = noise();
    var f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(fromHz, t);
    f.frequency.exponentialRampToValueAtTime(toHz, t + dur);
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  var lastTick = 0;
  var voice = false;

  GS.audio = {
    /** Call from any click/tap handler so the browser allows sound. */
    unlock: function () { ensure(); },
    setMuted: function (m) {
      muted = !!m;
      if (master) { master.gain.value = muted ? 0 : 0.7; }
    },
    isMuted: function () { return muted; },

    /** Wheel / strip tick. `pitch` 0..1 lets fast ticks sound higher than slow ones. */
    tick: function (pitch) {
      var now = performance.now();
      if (now - lastTick < 28) { return; } // never machine-gun
      lastTick = now;
      var p = pitch == null ? 0.5 : pitch;
      tone(520 + p * 620, 0.045, 'triangle', 0.09);
    },
    click: function () { tone(660, 0.05, 'sine', 0.07); },
    pop: function () { tone(300, 0.12, 'sine', 0.12, 0, 720); },
    whoosh: function () { burstNoise(0.7, 0.16, 300, 3200); },
    thud: function () { tone(150, 0.2, 'sine', 0.22, 0, 45); burstNoise(0.08, 0.06, 1800, 600); },
    reelStop: function () { tone(210, 0.16, 'square', 0.08, 0, 90); tone(880, 0.05, 'triangle', 0.06); },
    bounce: function (i) { tone(700 + (i % 5) * 70 + Math.random() * 40, 0.06, 'sine', 0.08); },
    coin: function () { tone(988, 0.07, 'square', 0.06); tone(1319, 0.32, 'square', 0.06, 0.07); },
    /** Victory fanfare: rising arpeggio with a sparkle on top. */
    win: function () {
      var notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach(function (f, i) { tone(f, 0.28, 'triangle', 0.13, i * 0.085); tone(f * 2, 0.22, 'sine', 0.04, i * 0.085); });
      tone(1318.5, 0.7, 'triangle', 0.12, 0.36);
      tone(1568, 0.8, 'sine', 0.06, 0.4);
    },
    jackpot: function () {
      for (var i = 0; i < 10; i++) { tone(880 + i * 110, 0.12, 'square', 0.05, i * 0.06); }
      this.win();
    },
    levelUp: function () {
      [392, 523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone(f, 0.18, 'square', 0.06, i * 0.07); });
    },
    badge: function () { tone(784, 0.1, 'triangle', 0.1); tone(1175, 0.25, 'triangle', 0.1, 0.09); },
    shuffle: function () { for (var i = 0; i < 6; i++) { burstNoise(0.08, 0.06, 2600, 900, i * 0.075); } },
    flip: function () { burstNoise(0.14, 0.09, 1700, 700); tone(420, 0.1, 'triangle', 0.05, 0.05); },
    scratch: function () { burstNoise(0.1, 0.05, 4200, 2600); },
    rattle: function () { for (var i = 0; i < 8; i++) { tone(260 + Math.random() * 520, 0.04, 'square', 0.035, i * 0.055); } },
    ring: function () { tone(1568, 0.55, 'sine', 0.08); tone(2349, 0.4, 'sine', 0.05, 0.02); },
    thump: function () { tone(120, 0.09, 'sine', 0.12, 0, 60); },
    drum: function () { burstNoise(0.12, 0.05, 700, 300); },
    /** The last-call bell. */
    bell: function () { tone(1318, 0.5, 'sine', 0.09); tone(1976, 0.35, 'sine', 0.05, 0.02); tone(1318, 0.5, 'sine', 0.07, 0.3); },
    /** The jackpot siren: two alternating tones. */
    siren: function () { for (var i = 0; i < 8; i++) { tone(i % 2 ? 740 : 988, 0.2, 'sawtooth', 0.045, i * 0.2); } },

    /** Croupier voice: speaks a short line with the browser's own voice. Off by default; needs sound on. */
    voiceOn: function () { return voice; },
    setVoice: function (v) { voice = !!v; if (!voice && window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ } } },
    voiceSupported: function () { return !!(window.speechSynthesis && window.SpeechSynthesisUtterance); },
    say: function (text) {
      if (!voice || muted || !GS.audio.voiceSupported()) { return; }
      try {
        window.speechSynthesis.cancel();
        var u = new window.SpeechSynthesisUtterance(text);
        u.rate = 1.02; u.pitch = 0.85; u.volume = 0.85;
        window.speechSynthesis.speak(u);
      } catch (e) { /* speech is a nicety */ }
    }
  };
})();
