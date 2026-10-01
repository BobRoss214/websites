// A stand-in for YouTube's IFrame Player API (https://www.youtube.com/iframe_api),
// for automatic tests only. Same method names and events as the real one.
// Video IDs containing "gone" fail with error 100, "noemb" with 150, "slow" never start.
// Every playVideo() call is logged with whether the player was visible, so the
// tests can check we never start playback with the picture hidden or covered.
(function () {
  const log = window.__ytlog = [];
  const DUR = window.__mockDur || {};
  function Player(el, opts) {
    const host = typeof el === 'string' ? document.getElementById(el) : el;
    const box = document.createElement('div'); box.className = 'mock-yt'; box.style.cssText = 'position:absolute;inset:0;background:#111;color:#8f8;font:20px monospace;display:grid;place-items:center';
    host.replaceWith(box);
    this.box = box; this.opts = opts; this.state = -1; this.vid = null; this.t0 = 0; this.base = 0; this.vol = 100; this.muted = false; this.rate = 1;
    log.push({ ev: 'create', host: opts.host, vars: opts.playerVars });
    setTimeout(() => opts.events && opts.events.onReady && opts.events.onReady({ target: this }), 50);
  }
  Player.prototype._set = function (s) { this.state = s; const f = this.opts.events && this.opts.events.onStateChange; f && f({ data: s, target: this }); };
  Player.prototype._err = function (c) { const f = this.opts.events && this.opts.events.onError; f && f({ data: c, target: this }); };
  Player.prototype.cueVideoById = function (o) { clearTimeout(this.tm); clearInterval(this.iv); this.vid = o.videoId; this.base = o.startSeconds || 0; this.t0 = 0; this.box.textContent = 'cued ' + this.vid; log.push({ ev: 'cue', id: this.vid, start: this.base }); setTimeout(() => this._set(5), 20); };
  Player.prototype.playVideo = function () {
    const wrap = document.getElementById('picWrap'), r = wrap.getBoundingClientRect(), stage = document.getElementById('stage');
    const scale = stage.getBoundingClientRect().width / stage.offsetWidth;
    log.push({ ev: 'play', id: this.vid, visible: !wrap.classList.contains('off') && getComputedStyle(wrap).visibility !== 'hidden', w: r.width / scale, h: r.height / scale });
    if (!this.vid) return;
    const id = this.vid;
    if (/gone/.test(id)) { setTimeout(() => this._err(100), 200); return; }
    if (/noemb/.test(id)) { setTimeout(() => this._err(150), 200); return; }
    this._set(3);
    if (/slow/.test(id)) return;
    this.tm = setTimeout(() => {
      if (this.vid !== id) return;
      this.t0 = performance.now(); this._set(1); this.box.textContent = 'playing ' + id;
      clearInterval(this.iv); this.iv = setInterval(() => { if (this.state === 1 && this.getCurrentTime() >= (DUR[id] || 600)) { clearInterval(this.iv); this._set(0); } }, 200);
    }, 250);
  };
  Player.prototype.pauseVideo = function () { if (this.state === 1) { this.base = this.getCurrentTime(); this.t0 = 0; this._set(2); } };
  Player.prototype.stopVideo = function () { clearTimeout(this.tm); clearInterval(this.iv); this.vid = null; this.t0 = 0; this.state = -1; log.push({ ev: 'stop' }); };
  Player.prototype.seekTo = function (s) { this.base = s; if (this.t0) this.t0 = performance.now(); log.push({ ev: 'seek', to: s }); };
  Player.prototype.getCurrentTime = function () { return this.t0 ? this.base + (performance.now() - this.t0) / 1000 * this.rate : this.base; };
  Player.prototype.getDuration = function () { return DUR[this.vid] || 600; };
  Player.prototype.setVolume = function (v) { this.vol = v; };
  Player.prototype.mute = function () { this.muted = true; };
  Player.prototype.unMute = function () { this.muted = false; };
  Player.prototype.loadModule = function (m) { log.push({ ev: 'loadModule', m }); };
  Player.prototype.unloadModule = function (m) { log.push({ ev: 'unloadModule', m }); };
  Player.prototype.setOption = function (m, k, v) { log.push({ ev: 'setOption', m, k, v }); };
  Player.prototype.setPlaybackRate = function (r) { this.base = this.getCurrentTime(); if (this.t0) this.t0 = performance.now(); this.rate = r; log.push({ ev: 'rate', r }); };
  Player.prototype.getAvailablePlaybackRates = function () { return [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]; };
  window.YT = { Player, PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } };
  setTimeout(() => window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady(), 30);
})();
