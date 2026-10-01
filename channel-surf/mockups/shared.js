/* Channel Surf mockups: shared engine.
   Fake channels, the clock-based schedule, a practice "picture", static,
   synthesized sounds, a blocky 5x7 TV pixel font, LED digits, and the
   remote-control logic. Each look (A, B, C) draws its own screens on top of this. */
(function () {
  'use strict';

  // ---------- fake channels ----------
  // m = minutes. broken: true marks a show that "fails to load" so the
  // mockups can show how a broken video is skipped.
  const CHANNELS = [
    { num: 1, call: 'GUIDE', name: 'TV Listings', kind: 'guide', hue: 220 },
    { num: 2, call: 'SHOP', name: 'Workshop Two', kind: 'wood', hue: 28, shows: [
      { t: 'Hand-Cut Dovetails', m: 24, d: 'Saw, chisel and patience: a drawer joint by hand.' },
      { t: 'Saving a Rusty Hand Plane', m: 31, d: 'A flea-market plane back to shaving whisper-thin curls.' },
      { t: 'The Shaker Side Table', m: 42, d: 'Part one: picking the cherry and cutting the legs.' },
      { t: 'Sharpening Made Simple', m: 17, d: 'Three stones, ten minutes, sharp chisels.' },
      { t: 'Workbench in a Weekend', m: 36, d: 'A sturdy bench from home-center lumber.' },
    ] },
    { num: 3, call: 'GRDN', name: 'Garden Patch', kind: 'garden', hue: 110, shows: [
      { t: 'Fall Bulbs, Spring Color', m: 19, d: 'Tulips and daffodils: how deep and when.' },
      { t: 'Tomato Cages the Easy Way', m: 14, d: 'Cheap wire, strong cages, happy plants.' },
      { t: 'Raised Beds for Bad Knees', m: 27, d: 'Waist-high beds you can tend sitting down.' },
      { t: 'Saving Seeds', m: 22, d: 'Keep this year\'s best beans for next year.' },
    ] },
    { num: 4, call: 'SUPR', name: 'Supper Club', kind: 'kitchen', hue: 8, shows: [
      { t: 'Sunday Pot Roast', m: 26, d: 'The low-and-slow roast with carrots and gravy.' },
      { t: 'Buttermilk Biscuits', m: 15, d: 'Tall, flaky, and ready in twenty minutes.', broken: true },
      { t: 'Chicken & Dumplings', m: 29, d: 'One pot, a cold evening, seconds for everyone.' },
      { t: 'Pies of the Season', m: 33, d: 'Apple, pumpkin and a pecan for good measure.' },
    ] },
    { num: 5, call: 'WRLD', name: 'Wide World', kind: 'travel', hue: 195, shows: [
      { t: 'Backroads of Portugal', m: 28, d: 'Hill towns, tile walls and the long lunch.' },
      { t: 'A Morning in Kyoto', m: 21, d: 'Temple bells, tea, and the quiet side streets.' },
      { t: 'The Scottish Highlands', m: 34, d: 'Lochs, sheep and a castle around every bend.' },
      { t: 'Canal Boats of England', m: 25, d: 'Four miles an hour and not a care in the world.' },
    ] },
    { num: 6, call: 'STAR', name: 'Starwatch', kind: 'space', hue: 255, shows: [
      { t: 'The Night Sky This Month', m: 12, d: 'What to look for after dark, no telescope needed.' },
      { t: 'Saturn\'s Rings Explained', m: 23, d: 'Ice, rock, and why they won\'t last forever.' },
      { t: 'Footprints on the Moon', m: 38, d: 'The landings, told by the people who were there.' },
    ] },
    { num: 7, call: 'BAND', name: 'Ballroom', kind: 'music', hue: 320, shows: [
      { t: 'Swing Era Favorites', m: 30, d: 'A big band plays the hits your parents danced to.' },
      { t: 'Saturday Night Polka', m: 18, d: 'Accordions up, everybody on the floor.' },
      { t: 'Crooners & Ballads', m: 26, d: 'Slow songs for a slow evening.' },
    ] },
    { num: 8, call: 'IRON', name: 'Old Iron', kind: 'cars', hue: 45, shows: [
      { t: 'Restoring a \'57 Pickup', m: 35, d: 'Episode four: the engine comes out.' },
      { t: 'Steam in the Rockies', m: 27, d: 'A narrow-gauge railroad still running on coal.' },
      { t: 'Barn Finds', m: 22, d: 'What\'s under the tarp? A rare convertible.' },
    ] },
    { num: 9, call: 'RIVR', name: 'River Country', kind: 'empty', hue: 160, shows: [] },
  ];

  const BUMPER_SEC = 6; // channel ident between shows
  const ANCHOR = Date.UTC(2026, 0, 1, 11, 0, 0); // fixed starting point for every lineup

  // ---------- deterministic randomness ----------
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // A channel's lineup: its shows in a seeded order, repeated as a loop.
  // Each slot = show length + a short ident. The clock picks the slot.
  const cycleCache = new Map();
  function cycle(ch) {
    if (cycleCache.has(ch.num)) return cycleCache.get(ch.num);
    const r = rng(hash(ch.call + ch.num));
    const order = [];
    // three shuffled passes so repeats don't line up the same way every time
    for (let pass = 0; pass < 3; pass++) {
      const s = ch.shows.slice();
      for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; }
      if (order.length && s[0] === order[order.length - 1] && s.length > 1) s.push(s.shift());
      order.push(...s);
    }
    const slots = []; let at = 0;
    for (const show of order) { const len = show.m * 60 + BUMPER_SEC; slots.push({ show, at, len }); at += len; }
    const c = { slots, total: at };
    cycleCache.set(ch.num, c);
    return c;
  }

  // What's on channel ch at time t (ms)? Returns show, its start/end (ms),
  // seconds into it, and whether we're in the ident after it.
  function airing(ch, t) {
    if (!ch.shows || !ch.shows.length) return null;
    const c = cycle(ch);
    const totalMs = c.total * 1000;
    const loops = Math.floor((t - ANCHOR) / totalMs);
    const pos = (t - ANCHOR) - loops * totalMs;
    const base = ANCHOR + loops * totalMs;
    for (let i = 0; i < c.slots.length; i++) {
      const s = c.slots[i];
      if (pos < (s.at + s.len) * 1000) {
        const start = base + s.at * 1000;
        const offset = (t - start) / 1000;
        return { show: s.show, start, end: start + s.show.m * 60000, slotEnd: start + s.len * 1000, offset, bumper: offset >= s.show.m * 60, index: i };
      }
    }
    return null;
  }

  // Everything airing on ch between from and to (ms), for the guide.
  function listings(ch, from, to) {
    const out = [];
    let a = airing(ch, from);
    let guard = 0;
    while (a && a.start < to && guard++ < 200) {
      out.push(a);
      a = airing(ch, a.slotEnd + 1);
    }
    return out;
  }

  function next(ch, t) { const a = airing(ch, t); return a ? airing(ch, a.slotEnd + 1) : null; }

  // ---------- time formatting ----------
  function clock(t, withAmPm = true) {
    const d = new Date(t); let h = d.getHours(); const m = d.getMinutes();
    const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
    return h + ':' + String(m).padStart(2, '0') + (withAmPm ? ' ' + ap : '');
  }
  function minsLeft(a, t) { return Math.max(1, Math.ceil((a.end - t) / 60000)); }
  function mmss(sec) { sec = Math.max(0, Math.floor(sec)); const m = Math.floor(sec / 60), s = sec % 60; return m + ':' + String(s).padStart(2, '0'); }
  function halfHourFloor(t) { const d = new Date(t); d.setMinutes(d.getMinutes() < 30 ? 0 : 30, 0, 0); return d.getTime(); }

  // ---------- practice picture (stands in for the YouTube player) ----------
  // Draws a moving sample scene so the mockups feel live. In the real app this
  // rectangle is the YouTube player, and nothing is ever drawn on top of it.
  const KIND_STYLE = {
    wood:    { bg: ['#5a3214', '#2a1408'], part: 'dust',  ink: '#f6d9a8' },
    garden:  { bg: ['#3f7a2a', '#13361a'], part: 'leaf',  ink: '#eaf7c8' },
    kitchen: { bg: ['#b8432a', '#4a1408'], part: 'steam', ink: '#fff1df' },
    travel:  { bg: ['#4aa3c8', '#0d3b5c'], part: 'wave',  ink: '#f0fbff' },
    space:   { bg: ['#1a1446', '#03020c'], part: 'star',  ink: '#e6e2ff' },
    music:   { bg: ['#7a1f5c', '#22061a'], part: 'note',  ink: '#ffe6f6' },
    cars:    { bg: ['#9a7a2a', '#2c220a'], part: 'road',  ink: '#fff6d6' },
  };
  class Picture {
    constructor(canvas) {
      this.c = canvas; this.x = canvas.getContext('2d'); this.ch = null; this.a = null; this.t0 = 0;
      this.parts = []; this.running = false; this._loop = this._loop.bind(this);
    }
    show(ch, a) {
      this.ch = ch; this.a = a; this.t0 = performance.now() - a.offset * 1000;
      const r = rng(hash(a.show.t)); this.parts = [];
      for (let i = 0; i < 60; i++) this.parts.push({ x: r(), y: r(), s: 0.4 + r(), v: 0.2 + r(), p: r() * 6.28 });
      if (!this.running) { this.running = true; requestAnimationFrame(this._loop); }
    }
    stop() { this.running = false; }
    elapsed() { return (performance.now() - this.t0) / 1000; }
    _loop(now) {
      if (!this.running) return;
      const { c, x } = this; const W = c.width, H = c.height;
      const st = KIND_STYLE[this.ch.kind] || KIND_STYLE.travel;
      const sec = (now - this.t0) / 1000;
      const g = x.createLinearGradient(0, 0, W * 0.3, H);
      g.addColorStop(0, st.bg[0]); g.addColorStop(1, st.bg[1]);
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      // slow ken-burns light
      const lx = W * (0.5 + 0.3 * Math.sin(sec / 9)), ly = H * (0.4 + 0.15 * Math.cos(sec / 7));
      const rg = x.createRadialGradient(lx, ly, 10, lx, ly, W * 0.6);
      rg.addColorStop(0, 'rgba(255,255,255,0.18)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = rg; x.fillRect(0, 0, W, H);
      this._particles(st, sec, W, H);
      // title card
      x.textAlign = 'center'; x.fillStyle = st.ink;
      x.font = `600 ${Math.round(H * 0.085)}px "Libre Baskerville", Georgia, serif`;
      x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = H * 0.02;
      x.fillText(this.a.show.t, W / 2, H * 0.47);
      x.font = `${Math.round(H * 0.04)}px Georgia, serif`;
      x.globalAlpha = 0.85; x.fillText(this.ch.name, W / 2, H * 0.57); x.globalAlpha = 1;
      x.shadowBlur = 0;
      x.textAlign = 'left'; x.font = `${Math.round(H * 0.032)}px ui-monospace, monospace`;
      x.fillStyle = 'rgba(255,255,255,.55)';
      x.fillText('SAMPLE PICTURE  ·  ' + mmss(sec) + ' / ' + mmss(this.a.show.m * 60), W * 0.03, H * 0.95);
      requestAnimationFrame(this._loop);
    }
    _particles(st, sec, W, H) {
      const x = this.x;
      for (const p of this.parts) {
        let px = p.x * W, py = p.y * H; const s = p.s * H * 0.012;
        x.save();
        switch (st.part) {
          case 'star': x.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(sec * p.v + p.p)); x.fillStyle = '#fff'; x.fillRect(px, py, s * 0.5, s * 0.5); break;
          case 'leaf': py = (p.y * H + sec * 20 * p.v) % H; px += Math.sin(sec * p.v + p.p) * 20; x.translate(px, py); x.rotate(sec * p.v + p.p); x.fillStyle = 'rgba(190,230,120,.55)'; x.beginPath(); x.ellipse(0, 0, s * 1.6, s * 0.7, 0, 0, 6.28); x.fill(); break;
          case 'steam': py = H - ((p.y * H + sec * 25 * p.v) % H); x.globalAlpha = 0.18 * (py / H); x.fillStyle = '#fff'; x.beginPath(); x.arc(px + Math.sin(sec + p.p) * 15, py, s * 4, 0, 6.28); x.fill(); break;
          case 'wave': x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 2; x.beginPath(); for (let i = 0; i <= 20; i++) { const wx = (i / 20) * W; const wy = H * (0.7 + p.y * 0.3) + Math.sin(i * 0.8 + sec * p.v + p.p) * 6; i ? x.lineTo(wx, wy) : x.moveTo(wx, wy); } x.stroke(); break;
          case 'note': py = (p.y * H - sec * 18 * p.v) % H; if (py < 0) py += H; x.fillStyle = 'rgba(255,200,240,.45)'; x.beginPath(); x.ellipse(px, py, s * 1.1, s * 0.8, -0.4, 0, 6.28); x.fill(); x.fillRect(px + s, py - s * 4, s * 0.3, s * 4); break;
          case 'road': x.fillStyle = 'rgba(255,240,200,.3)'; { const ry = (p.y * H + sec * 120 * p.v) % H; x.fillRect(W * 0.49, ry, W * 0.02, H * 0.06); } break;
          default: x.globalAlpha = 0.5; x.fillStyle = 'rgba(255,220,170,.6)'; py = (p.y * H + sec * 8 * p.v) % H; x.fillRect(px + Math.sin(sec * p.v + p.p) * 10, py, s * 0.6, s * 0.6);
        }
        x.restore();
      }
    }
  }

  // ---------- static ("snow") ----------
  class Snow {
    constructor(canvas) { this.c = canvas; this.x = canvas.getContext('2d'); this.on = false; this._loop = this._loop.bind(this); this.img = this.x.createImageData(canvas.width, canvas.height); }
    start() { if (!this.on) { this.on = true; requestAnimationFrame(this._loop); } }
    stop() { this.on = false; }
    _loop(now) {
      if (!this.on) return;
      const d = this.img.data, W = this.c.width, H = this.c.height;
      const bar = ((now / 6) % (H * 1.6)) - H * 0.3;
      for (let y = 0; y < H; y++) {
        const dim = Math.abs(y - bar) < H * 0.12 ? 0.55 : 1;
        for (let x = 0; x < W; x++) { const v = (Math.random() * 255 * dim) | 0; const i = (y * W + x) * 4; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
      }
      this.x.putImageData(this.img, 0, 0);
      requestAnimationFrame(this._loop);
    }
  }

  // ---------- sounds (all synthesized, no files) ----------
  const Sound = {
    ctx: null, master: null, enabled: true,
    init() {
      if (this.ctx) return;
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 2; this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const ch = this.noise.getChannelData(0); for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
      } catch (e) { this.ctx = null; }
    },
    _env(node, t, a, peak, hold, rel) { const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel); node.connect(g); g.connect(this.master); return g; },
    hiss(ms = 350, vol = 0.22) {
      if (!this.ctx || !this.enabled) return; const t = this.ctx.currentTime;
      const s = this.ctx.createBufferSource(); s.buffer = this.noise; const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 0.5;
      s.connect(f); this._env(f, t, 0.01, vol, ms / 1000 - 0.06, 0.05); s.start(t); s.stop(t + ms / 1000 + 0.1);
    },
    click(vol = 0.5) { // dial detent / button
      if (!this.ctx || !this.enabled) return; const t = this.ctx.currentTime;
      const s = this.ctx.createBufferSource(); s.buffer = this.noise; const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1800;
      s.connect(f); this._env(f, t, 0.001, vol, 0.004, 0.03); s.start(t); s.stop(t + 0.06);
      const o = this.ctx.createOscillator(); o.frequency.value = 180; this._env(o, t, 0.001, vol * 0.6, 0.002, 0.05); o.start(t); o.stop(t + 0.07);
    },
    thunk() { // knob / power switch
      if (!this.ctx || !this.enabled) return; const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.12);
      this._env(o, t, 0.002, 0.6, 0.01, 0.15); o.start(t); o.stop(t + 0.2); this.click(0.6);
    },
    powerOn() { // pop + degauss "bwong" + faint whine
      if (!this.ctx || !this.enabled) return; const t = this.ctx.currentTime; this.thunk();
      const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 60;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400; o.connect(f);
      this._env(f, t + 0.05, 0.03, 0.35, 0.1, 0.9); o.start(t + 0.05); o.stop(t + 1.2);
      const w = this.ctx.createOscillator(); w.frequency.value = 7800; this._env(w, t + 0.1, 0.3, 0.012, 0.4, 0.8); w.start(t + 0.1); w.stop(t + 1.8);
    },
    powerOff() {
      if (!this.ctx || !this.enabled) return; const t = this.ctx.currentTime; this.thunk();
      const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(120, t + 0.4);
      this._env(o, t, 0.005, 0.05, 0.05, 0.35); o.start(t); o.stop(t + 0.5);
    },
    beep() { if (!this.ctx || !this.enabled) return; const t = this.ctx.currentTime; const o = this.ctx.createOscillator(); o.type = 'square'; o.frequency.value = 1320; const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2500; o.connect(f); this._env(f, t, 0.002, 0.06, 0.03, 0.03); o.start(t); o.stop(t + 0.08); },
    chime() { // ident jingle: three soft notes
      if (!this.ctx || !this.enabled) return; const t = this.ctx.currentTime;
      [523.25, 659.25, 783.99].forEach((fr, i) => { const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = fr; this._env(o, t + i * 0.16, 0.01, 0.12, 0.08, 0.6); o.start(t + i * 0.16); o.stop(t + i * 0.16 + 0.9); });
    },
    tone(on) { // color-bar test tone
      if (!this.ctx) return;
      if (on && !this._tone && this.enabled) { const o = this.ctx.createOscillator(); o.frequency.value = 1000; const g = this.ctx.createGain(); g.gain.value = 0.025; o.connect(g); g.connect(this.master); o.start(); this._tone = { o, g }; }
      if (!on && this._tone) { this._tone.o.stop(); this._tone = null; }
    },
  };

  // ---------- 5x7 pixel font ----------
  const G = {
    "0": '.###.#...##..###.#.###..##...#.###.', "1": '..#...##....#....#....#....#...###.',
    "2": '.###.#...#....#...#...#...#...#####', "3": '#####...#...#.....#.....##...#.###.',
    "4": '...#...##..#.#.#..#.#####...#....#.', "5": '######....####.....#....##...#.###.',
    "6": '..##..#...#....####.#...##...#.###.', "7": '#####....#...#...#...#....#....#...',
    "8": '.###.#...##...#.###.#...##...#.###.', "9": '.###.#...##...#.####....#...#..##..',
    "A": '.###.#...##...#######...##...##...#', "B": '####.#...##...#####.#...##...#####.',
    "C": '.###.#...##....#....#....#...#.###.', "D": '###..#..#.#...##...##...##..#.###..',
    "E": '######....#....####.#....#....#####', "F": '######....#....####.#....#....#....',
    "G": '.###.#...##....#.####...##...#.####', "H": '#...##...##...#######...##...##...#',
    "I": '.###...#....#....#....#....#...###.', "J": '..###...#....#....#....#.#..#..##..',
    "K": '#...##..#.#.#..##...#.#..#..#.#...#', "L": '#....#....#....#....#....#....#####',
    "M": '#...###.###.#.##.#.##...##...##...#', "N": '#...##...###..##.#.##..###...##...#',
    "O": '.###.#...##...##...##...##...#.###.', "P": '####.#...##...#####.#....#....#....',
    "Q": '.###.#...##...##...##.#.##..#..##.#', "R": '####.#...##...#####.#.#..#..#.#...#',
    "S": '.#####....#.....###.....#....#####.', "T": '#####..#....#....#....#....#....#..',
    "U": '#...##...##...##...##...##...#.###.', "V": '#...##...##...##...##...#.#.#...#..',
    "W": '#...##...##...##.#.##.#.##.#.#.#.#.', "X": '#...##...#.#.#...#...#.#.#...##...#',
    "Y": '#...##...#.#.#...#....#....#....#..', "Z": '#####....#...#...#...#...#....#####',
    "-": '...............#####...............', ":": '......##...##........##...##.......',
    ".": '..........................##...##..', "/": '....#....#...#...#...#...#....#....',
    "+": '.......#....#..#####..#....#.......', "!": '..#....#....#....#....#.........#..',
    "?": '.###.#...#....#...#...#.........#..', "'": '..#....#...........................',
    "&": '.##..#..#.#.#...#...#.#.##..#..##.#', ",": '......................#....#...#...',
    " ": '...................................', "%": '##...##..#...#...#...#...#..##...##',
    ">": '.#.....#.....#.....#...#...#...#...', "<": '...#...#...#...#.....#.....#.....#.',
    "*": '.....#.#.#.###.#####.###.#.#.#.....',
  };

  function pixelText(ctx, text, x, y, px, opts = {}) {
    const color = opts.color || '#3dff6a', outline = opts.outline || 'rgba(0,0,0,.9)', glow = opts.glow !== false, gap = opts.gap ?? 0.12, spacing = opts.spacing ?? 1;
    text = String(text).toUpperCase();
    const adv = (5 + spacing) * px;
    if (opts.align === 'right') x -= text.length * adv - spacing * px;
    if (opts.align === 'center') x -= (text.length * adv - spacing * px) / 2;
    const drawPass = (fill, grow) => {
      ctx.fillStyle = fill;
      for (let i = 0; i < text.length; i++) {
        const g = G[text[i]] || G['?'];
        for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r * 5 + c] === '#')
          ctx.fillRect(x + i * adv + c * px - grow, y + r * px - grow, px * (1 - gap) + grow * 2, px * (1 - gap) + grow * 2);
      }
    };
    if (outline) drawPass(outline, px * 0.35);
    ctx.save(); if (glow) { ctx.shadowColor = color; ctx.shadowBlur = px * 1.2; }
    drawPass(color, 0); ctx.restore();
    return text.length * adv;
  }
  function pixelWidth(text, px, spacing = 1) { return String(text).length * (5 + spacing) * px - spacing * px; }

  // ---------- 7-segment LED digits (SVG) ----------
  const SEG = { a: '6,2 34,2 30,7 10,7', b: '35,4 35,33 31,30 31,8', c: '35,37 35,66 31,62 31,40', d: '6,68 34,68 30,63 10,63', e: '5,37 9,40 9,62 5,66', f: '5,4 9,8 9,30 5,33', g: '7,35 11,31 29,31 33,35 29,39 11,39' };
  const DIGIT = { '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g', ' ': '', 'P': 'abefg', 'O': 'abcdef', 'F': 'aefg', 'n': 'ceg', 'E': 'adefg', 'r': 'eg', 'C': 'adef', 'H': 'bcefg', 'L': 'def', 'U': 'bcdef', 'd': 'bcdeg', 'o': 'cdeg', 't': 'defg', 'A': 'abcefg', 'b': 'cdefg' };
  function ledSVG(str, on = '#ff2b1c', off = 'rgba(255,40,20,.09)') {
    str = String(str); let x = 0; let svg = '';
    for (const ch of str) {
      if (ch === ':') { svg += `<circle cx="${x + 6}" cy="22" r="3" fill="${on}"/><circle cx="${x + 6}" cy="48" r="3" fill="${on}"/>`; x += 14; continue; }
      const lit = DIGIT[ch] ?? '';
      for (const s in SEG) svg += `<polygon transform="translate(${x} 0) skewX(-6)" points="${SEG[s]}" fill="${lit.includes(s) ? on : off}"/>`;
      x += 44;
    }
    return `<svg viewBox="-4 0 ${x + 4} 70" style="height:100%;filter:drop-shadow(0 0 4px ${on})">${svg}</svg>`;
  }

  // ---------- the TV brain (shared by all three looks) ----------
  // The look supplies `ui` callbacks; this handles channel logic.
  class TV {
    constructor(ui, opts = {}) {
      this.ui = ui; this.channels = CHANNELS; this.on = false; this.idx = 1; this.lastIdx = 1;
      this.volume = 60; this.muted = false; this.cc = false; this.favs = new Set([2, 5]);
      this.digits = ''; this.digitTimer = null; this.staticOn = opts.staticOn !== false;
      this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.tuneToken = 0; this.cur = null;
      setInterval(() => this.tick(), 500);
    }
    get ch() { return this.channels[this.idx]; }
    find(num) { return this.channels.findIndex(c => c.num === num); }
    power() {
      Sound.init(); if (Sound.ctx && Sound.ctx.state === 'suspended') Sound.ctx.resume();
      this.on = !this.on;
      if (this.on) { Sound.powerOn(); this.ui.powerOn(() => this.tune(this.idx, { fromPower: true })); }
      else { this.cur = null; this.tuneToken++; Sound.powerOff(); Sound.tone(false); clearTimeout(this.digitTimer); this.digits = ''; this.ui.powerOff(); }
    }
    tune(i, how = {}) {
      if (!this.on) return;
      const n = this.channels.length; i = ((i % n) + n) % n;
      if (i !== this.idx) this.lastIdx = this.idx;
      this.idx = i; const token = ++this.tuneToken;
      const ch = this.ch;
      const go = () => this._present(token);
      this.ui.channelNumber(ch);
      if (how.fromPower || !this.staticOn || this.reduced) { this.ui.blank && this.ui.blank(); setTimeout(go, how.fromPower ? 0 : 180); }
      else { Sound.hiss(380); this.ui.snow(); setTimeout(go, 380); }
    }
    // Put whatever the clock says is on right now onto the screen.
    _present(token) {
      if (token !== this.tuneToken || !this.on) return;
      const ch = this.ch; const now = Date.now();
      Sound.tone(false);
      if (ch.kind === 'guide') { this.cur = { type: 'guide' }; this.ui.showGuide(ch); this.ui.banner(ch, null); return; }
      const a = airing(ch, now);
      if (!a) { this.cur = { type: 'offair' }; Sound.tone(true); this.ui.offAir(ch); this.ui.banner(ch, null); return; }
      if (a.show.broken && !a.bumper) {
        // broken video: brief stand-by card, then the next show takes its slot
        this.cur = { type: 'standby' }; this.ui.standBy(ch);
        setTimeout(() => {
          if (token !== this.tuneToken) return;
          const nx = next(ch, now); const t = Date.now();
          const fake = Object.assign({}, nx, { offset: 0, start: t, end: t + nx.show.m * 60000, slotEnd: t + nx.show.m * 60000 + 6000 });
          this.cur = { type: 'picture', a: fake }; this.ui.picture(ch, fake); this.ui.banner(ch, fake, { replaced: true });
        }, 1800);
        return;
      }
      if (a.bumper) { const nx = next(ch, now); this.cur = { type: 'ident', a }; Sound.chime(); this.ui.ident(ch, nx); this.ui.banner(ch, nx, { upNext: true }); return; }
      this.cur = { type: 'picture', a }; this.ui.picture(ch, a); this.ui.banner(ch, a);
    }
    // Every half second: when a show ends, roll into the ident, then the next show.
    tick() {
      if (!this.on || !this.cur) return; const now = Date.now(); const c = this.cur;
      if ((c.type === 'picture' && now >= c.a.end) || (c.type === 'ident' && now >= c.a.slotEnd)) this._present(this.tuneToken);
    }
    up() { this.tune(this.idx + 1); }
    down() { this.tune(this.idx - 1); }
    last() { this.tune(this.lastIdx); }
    guide() { const g = this.find(1); this.tune(g); }
    digit(d) {
      if (!this.on) return; Sound.beep();
      this.digits = (this.digits + d).slice(-2); this.ui.typing(this.digits);
      clearTimeout(this.digitTimer);
      if (this.digits.length === 2) this.digitTimer = setTimeout(() => this.enter(), 500);
      else this.digitTimer = setTimeout(() => this.enter(), 1800);
    }
    enter() {
      clearTimeout(this.digitTimer);
      if (!this.digits) { this.info(); return; }
      const num = parseInt(this.digits, 10); this.digits = '';
      const i = this.find(num);
      if (i >= 0) this.tune(i); else this.ui.typing('--', true);
    }
    info() { if (!this.on) return; const ch = this.ch; const a = ch.kind === 'guide' ? null : airing(ch, Date.now()); this.ui.banner(ch, a && !a.bumper ? a : null, { info: true }); }
    vol(d) { if (!this.on) return; this.muted = false; this.volume = Math.max(0, Math.min(100, this.volume + d)); Sound.master && (Sound.master.gain.value = this.volume / 120); this.ui.volume(this.volume, false); }
    mute() { if (!this.on) return; this.muted = !this.muted; Sound.master && (Sound.master.gain.value = this.muted ? 0 : this.volume / 120); this.ui.volume(this.volume, this.muted); }
    toggleCC() { if (!this.on) return; this.cc = !this.cc; this.ui.cc && this.ui.cc(this.cc); }
    fav() { if (!this.on) return; const n = this.ch.num; this.favs.has(n) ? this.favs.delete(n) : this.favs.add(n); this.ui.fav && this.ui.fav(this.ch, this.favs.has(n)); }
    favNext() { // jump to the next favorite channel
      if (!this.on || !this.favs.size) return; const n = this.channels.length;
      for (let k = 1; k <= n; k++) { const j = (this.idx + k) % n; if (this.favs.has(this.channels[j].num)) { this.tune(j); return; } }
    }
  }

  // ---------- keyboard: TV-remote style ----------
  function bindKeys(tv, extra = {}) {
    addEventListener('keydown', e => {
      if (e.target.closest && e.target.closest('input,textarea,select')) return;
      const k = e.key;
      if (extra[k]) { e.preventDefault(); extra[k](e); return; }
      if (!tv.on && !(k === 'p' || k === 'P' || k === 'Enter' || k === ' ' || k === 'Power')) return;
      const map = {
        ArrowUp: () => tv.up(), ArrowDown: () => tv.down(), PageUp: () => tv.up(), PageDown: () => tv.down(), ChannelUp: () => tv.up(), ChannelDown: () => tv.down(),
        Backspace: () => tv.last(), Escape: () => tv.last(), BrowserBack: () => tv.last(), l: () => tv.last(),
        m: () => tv.mute(), M: () => tv.mute(), AudioVolumeMute: () => tv.mute(),
        '+': () => tv.vol(10), '=': () => tv.vol(10), '-': () => tv.vol(-10), AudioVolumeUp: () => tv.vol(10), AudioVolumeDown: () => tv.vol(-10),
        g: () => tv.guide(), G: () => tv.guide(), i: () => tv.info(), I: () => tv.info(), c: () => tv.toggleCC(), C: () => tv.toggleCC(),
        f: () => tv.favNext(), F: () => tv.favNext(), p: () => tv.power(), P: () => tv.power(), Power: () => tv.power(),
        Enter: () => tv.on ? tv.enter() : tv.power(), ' ': () => tv.on ? tv.info() : tv.power(),
      };
      // on the guide channel, arrows and Enter move around the guide instead
      if (tv.on && tv.cur && tv.cur.type === 'guide' && !tv.digits && tv.ui.guideKey && tv.ui.guideKey(k)) { e.preventDefault(); return; }
      if (/^[0-9]$/.test(k)) { e.preventDefault(); tv.digit(k); return; }
      if (map[k]) { e.preventDefault(); map[k](); }
    });
  }

  // ---------- fit a fixed-size stage to the window ----------
  function fitStage(stage, W, H) {
    const fit = () => {
      const bar = document.querySelector('.mock-bar'); const bh = bar ? bar.offsetHeight : 0;
      const s = Math.min(innerWidth / W, (innerHeight - bh) / H);
      stage.style.transform = `translate(-50%, 0) scale(${s})`;
      stage.parentElement.style.height = (H * s) + 'px';
    };
    addEventListener('resize', fit); fit();
  }

  // ---------- the mockup switcher bar shown above every look ----------
  function mockBar(current, tv) {
    const bar = document.createElement('div'); bar.className = 'mock-bar';
    const looks = [['look-a-1987.html', 'A · 1987 Console'], ['look-b-1994.html', 'B · 1994 Cable Box'], ['look-c-2003.html', 'C · 2003 Digital']];
    bar.innerHTML = `<span class="mb-name">Channel Surf mockups</span>` +
      looks.map(([href, label]) => `<a href="${href}"${href === current ? ' aria-current="page"' : ''}>${label}</a>`).join('') +
      `<span class="mb-sp"></span><label class="mb-tog"><input type="checkbox" id="mb-static" checked> Static</label><button type="button" id="mb-fs">Full screen</button>` +
      `<span class="mb-keys">Keys: ↑↓ channel · 0-9 · Enter · Backspace = last · G guide · I info · M mute · +/− volume · C captions · F favorites · P power</span>`;
    document.body.prepend(bar);
    bar.querySelector('#mb-static').addEventListener('change', e => { tv.staticOn = e.target.checked; e.target.blur(); });
    bar.querySelector('#mb-fs').addEventListener('click', e => { e.target.blur(); const el = document.documentElement; (document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen && el.requestFullscreen()).catch?.(() => {}); });
  }

  window.CS = { CHANNELS, airing, listings, next, clock, minsLeft, mmss, halfHourFloor, Picture, Snow, Sound, pixelText, pixelWidth, ledSVG, TV, bindKeys, fitStage, mockBar, hash, rng };
})();
