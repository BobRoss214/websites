// TV sounds, all made in code (no sound files): static hiss, button clicks,
// the power-on "bwong", the ident chime. Switchable off in Settings.
import { S } from './store.js';

export const Sound = {
  ctx: null, master: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.45; this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2; this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch { this.ctx = null; }
  },
  get on() { return !!this.ctx && S.tv.sounds && !S.tv.mutedFx; },
  _env(node, t, a, peak, hold, rel) { const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel); node.connect(g); g.connect(this.master); },
  hiss(ms = 380) {
    if (!this.on) return; const t = this.ctx.currentTime, s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter();
    s.buffer = this.noise; f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 0.5; s.connect(f);
    this._env(f, t, 0.01, 0.2, ms / 1000 - 0.06, 0.05); s.start(t); s.stop(t + ms / 1000 + 0.1);
  },
  beep() {
    if (!this.on) return; const t = this.ctx.currentTime, o = this.ctx.createOscillator(), f = this.ctx.createBiquadFilter();
    o.type = 'square'; o.frequency.value = 1320; f.type = 'lowpass'; f.frequency.value = 2500; o.connect(f);
    this._env(f, t, 0.002, 0.05, 0.025, 0.03); o.start(t); o.stop(t + 0.08);
  },
  thunk() {
    if (!this.on) return; const t = this.ctx.currentTime, o = this.ctx.createOscillator();
    o.type = 'triangle'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.12);
    this._env(o, t, 0.002, 0.5, 0.01, 0.15); o.start(t); o.stop(t + 0.2);
  },
  powerOn() {
    if (!this.on) return; this.thunk(); const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), f = this.ctx.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = 60; f.type = 'lowpass'; f.frequency.value = 400; o.connect(f);
    this._env(f, t + 0.05, 0.03, 0.3, 0.1, 0.9); o.start(t + 0.05); o.stop(t + 1.2);
  },
  powerOff() {
    if (!this.on) return; this.thunk(); const t = this.ctx.currentTime, o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(120, t + 0.4);
    this._env(o, t, 0.005, 0.04, 0.05, 0.35); o.start(t); o.stop(t + 0.5);
  },
  chime() {
    if (!this.on) return; const t = this.ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((fr, i) => { const o = this.ctx.createOscillator(); o.frequency.value = fr; this._env(o, t + i * 0.16, 0.01, 0.1, 0.08, 0.6); o.start(t + i * 0.16); o.stop(t + i * 0.16 + 0.9); });
  },
  tone(on) {
    if (!this.ctx) return;
    if (on && !this._tone && this.on) { const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.frequency.value = 1000; g.gain.value = 0.02; o.connect(g); g.connect(this.master); o.start(); this._tone = o; }
    if (!on && this._tone) { try { this._tone.stop(); } catch {} this._tone = null; }
  },
};
