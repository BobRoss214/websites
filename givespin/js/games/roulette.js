/*
 * Roulette. A canvas wheel of charity pockets (16 up to 100); the ball spins the other way, skips across the
 * pockets and settles in one.
 *
 * Fairness: the app draws the winner from the whole pool (see js/fair.js) and hands it over. The wheel shows a
 * sample of the pool that always includes the winner; the ball is animated to land in the winner's pocket.
 *
 * Live tables: every spot on the board owns a pocket (the catalog charities that fill the board included, drawn dimmed), and
 * the pockets on top of those are shared out by stake, so the charities people backed light up and own more of the wheel.
 * The ball lands in one of the winner's pockets, and only a backed charity can be the winner.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var U = GS.util;
  var kit = GS.kit;
  var TAU = Math.PI * 2;

  var LIVE_POCKETS = 24;
  var RED = '#d8344a';
  var BLACK = '#17222c';
  var GREEN = '#169c58';
  // the same three colours, muted: the pockets of catalog charities that only fill a live board (they cannot win)
  var RED_DIM = '#6b2a37';
  var BLACK_DIM = '#0f171e';
  var GREEN_DIM = '#14583a';
  var PALETTE = [RED, BLACK, GREEN, RED_DIM, BLACK_DIM, GREEN_DIM];

  var el = {};
  var api = null;
  var ctx = null;
  var cw = 0;
  var dpr = 1;

  var size = 16;
  var pool = [];
  var pockets = [];
  var field = null;          // live table entrants, or null when playing solo
  var ring = null;           // live: the wheel's pockets, kept for the whole round so a new bet only changes a pocket or two
  var backedAt = [];         // live: true for a pocket whose charity somebody backed (the rest only fill the board)
  var backedIdx = [];        // live: the indexes of those pockets (a few dozen at most, even on a 1,000-pocket wheel)
  var fresh = true;
  var wheelA = Math.random() * TAU;
  var ballA = -Math.PI / 2;
  var ballMode = 'park';       // 'park' | 'orbit' | 'pocket'
  var ballR = 0;
  var winIdx = -1;
  var glowT = 0;
  var anim = null;
  var spinning = false;
  var active = false;
  var locked = false;
  var raf = 0;
  var lastT = 0;
  var flash = 0;

  var pick = '';              // id of the charity you backed (solo), or empty
  var livePick = '';          // the charity you have backed at the live table you are watching, or empty

  function count() { return kit.sizeNow(size); }
  /** The charity you have put your stake on at the live table you are watching (or empty): its pockets get a gold edge. */
  function yourPick() {
    var cur = GS.ui && GS.ui.live && GS.ui.live.current ? GS.ui.live.current() : null;
    return cur && cur.room && cur.room.you ? cur.room.you.charityId : '';
  }
  /** A phone-sized screen: a long list of chips scrolls inside its box sooner there, so it does not push the page down. */
  function narrow() { return !!(window.matchMedia && window.matchMedia('(max-width: 560px)').matches); }
  function maxCanvas() { var n = pockets.length; return n <= 16 ? 520 : n <= 37 ? 600 : 680; }

  /* ------------------------------------------------------------- geometry
   * Up to around a hundred pockets the whole wheel fits the canvas. Beyond that the pockets stay in proportion to the
   * ball and the wheel simply gets bigger than the screen: the camera zooms out to show the whole wheel while the ball
   * is flying, then closes in on the ball as it slows and drops into a pocket.
   */
  var G = null;
  var cam = { z: 1, lz: 0, fx: 0, fy: 0, fb: 0 };   // zoom (and its log), the focus point and how much it follows the ball
  var prevA = null;                                   // last ball / wheel angles, to measure how fast the pockets stream past
  var vS = 0;
  var SPEED_CAP = 900;                                // px per second the pockets may stream past on screen

  function ballRad(n) { return Math.max(4.5, cw * (n > 40 ? 0.014 : 0.021)); }

  function layout() {
    if (!cw) { G = null; return; }
    var n = pockets.length;
    var fitR = cw / 2 - 4;
    G = { R: fitR, rimIn: fitR * 0.93, trackIn: fitR * 0.8, pockOut: fitR * 0.8, pockIn: fitR * 0.5, hub: fitR * 0.12, big: false, zo: 1, zi: 1, skip: fitR * (0.035 + n / 3000) };
    if (n > 40) {
      var ballD = 2 * ballRad(n);
      var arc = ballD * 1.35;                         // each pocket is about as wide as the ball, with some room
      var midR = arc * n / TAU;
      var depth = arc * 1.9, trackW = ballD * 2.3, rimW = ballD * 0.9;
      var pockOut = midR + depth / 2;
      var R = pockOut + trackW + rimW;
      if (R > fitR * 1.6) {
        var zo = fitR / R;
        G = { R: R, rimIn: pockOut + trackW, trackIn: pockOut, pockOut: pockOut, pockIn: midR - depth / 2, hub: (midR - depth / 2) * 0.12, big: true,
          zo: zo, zi: zo >= 0.4 ? zo : 0.85, skip: trackW * 0.45, arc: arc, midR: midR };
      }
    }
    if (!spinning) { resetCamera(); } else { cam.lz = core.clamp(cam.lz, Math.log(G.zo), Math.log(1.2)); cam.z = Math.exp(cam.lz); }
  }

  function idleFocus() { return G.zi === G.zo ? { x: 0, y: 0 } : { x: 0, y: -G.pockOut }; }

  function resetCamera() {
    if (!G) { return; }
    cam.lz = Math.log(G.zi);
    cam.z = G.zi;
    cam.fb = 0;
    var f = G.big ? idleFocus() : { x: 0, y: 0 };
    cam.fx = f.x;
    cam.fy = f.y;
    prevA = null;
    vS = 0;
  }

  function resize() {
    if (!el.canvas) { return; }
    var w = Math.floor(el.stage.clientWidth);
    if (!w) { return; }
    cw = Math.min(w, maxCanvas());
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    // only touch the canvas when its size really changed (a live wheel calls this every time somebody bets)
    if (el.canvas.width !== Math.round(cw * dpr) || el.canvas.style.width !== cw + 'px') {
      el.canvas.width = Math.round(cw * dpr);
      el.canvas.height = Math.round(cw * dpr);
      el.canvas.style.width = cw + 'px';
      el.canvas.style.height = cw + 'px';
    }
    layout();
    draw(performance.now());
  }

  /** Which colour pocket `i` is: 0 red, 1 black, 2 green (the first pocket); a live filler pocket is the muted twin (3 to 5). */
  function pocketGroup(i) { return (field && !backedAt[i] ? 3 : 0) + (i === 0 ? 2 : (i % 2 ? 0 : 1)); }
  function pocketColor(i) { return PALETTE[pocketGroup(i)]; }

  function annulus(g, r0, r1, a0, a1) {
    ctx.beginPath();
    ctx.arc(0, 0, r1, a0, a1);
    ctx.arc(0, 0, r0, a1, a0, true);
    ctx.closePath();
  }

  /** A pocket's slice as part of the current path (so many can be filled at once). */
  function sliceSub(g, a0, a1) {
    ctx.moveTo(Math.cos(a0) * g.pockOut, Math.sin(a0) * g.pockOut);
    ctx.arc(0, 0, g.pockOut, a0, a1);
    ctx.arc(0, 0, g.pockIn, a1, a0, true);
    ctx.closePath();
  }

  /** Where the ball is, in board coordinates (the wheel's centre is the origin). */
  function ballPos(g) {
    if (ballMode === 'park') { return { x: 0, y: -(g.trackIn + g.rimIn) / 2, a: -Math.PI / 2 }; }
    var ang = ballMode === 'pocket' ? wheelA + (winIdx + 0.5) * (TAU / Math.max(1, pockets.length)) : ballA;
    var rad = ballMode === 'pocket' ? (g.pockOut + g.pockIn) / 2 + (g.pockOut - g.pockIn) * 0.18 : ballR;
    return { x: Math.cos(ang) * rad, y: Math.sin(ang) * rad, a: ang };
  }

  /** Eases the camera: zoomed out while the ball is quick, close in as it slows, and right in on the pocket it lands in. */
  function updateCamera(dt) {
    var g = G;
    if (!g || !g.big) { cam.z = 1; cam.lz = 0; cam.fx = 0; cam.fy = 0; return; }
    var bp = ballPos(g);
    var targetZ, fbT, rate;
    if (ballMode === 'park') {
      targetZ = g.zi; fbT = 0; rate = 3; prevA = null; vS = 0;
    } else if (ballMode === 'pocket') {
      targetZ = 1.15; fbT = 1; rate = 3; prevA = null;
    } else {
      fbT = 1; rate = 5;
      if (prevA && dt > 0) {
        var rel = Math.abs((ballA - prevA.b) - (wheelA - prevA.w));
        var v = (ballR * rel) / dt;
        vS += (v - vS) * 0.35;
      }
      prevA = { b: ballA, w: wheelA };
      targetZ = U.reducedMotion() ? g.zi : core.clamp(SPEED_CAP / Math.max(vS, 1), g.zo, 1);
    }
    cam.lz += (Math.log(targetZ) - cam.lz) * (1 - Math.exp(-dt * rate));
    cam.z = Math.exp(cam.lz);
    cam.fb += (fbT - cam.fb) * (1 - Math.exp(-dt * 6));
    var f = idleFocus();
    cam.fx = f.x + (bp.x - f.x) * cam.fb;
    cam.fy = f.y + (bp.y - f.y) * cam.fb;
  }

  function draw(t) {
    if (!ctx || !cw || !G) { return; }
    var g = G;
    var z = cam.z;
    var px = 1 / z;                       // one screen pixel, in board units
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, cw);
    ctx.save();
    ctx.translate(cw / 2, cw / 2);
    ctx.scale(z, z);
    ctx.translate(-cam.fx, -cam.fy);

    ctx.beginPath();
    ctx.arc(0, 0, g.R, 0, TAU);
    var rim = ctx.createLinearGradient(-g.R, -g.R, g.R, g.R);
    rim.addColorStop(0, '#5a3a1a');
    rim.addColorStop(0.5, '#24140a');
    rim.addColorStop(1, '#4a2f16');
    ctx.fillStyle = rim;
    ctx.fill();
    ctx.lineWidth = Math.max(3, 2 * px);
    ctx.strokeStyle = '#ffc542';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, g.rimIn, 0, TAU);
    ctx.fillStyle = '#0f1a16';
    ctx.fill();

    var tr = ctx.createRadialGradient(0, 0, g.trackIn, 0, 0, g.rimIn);
    tr.addColorStop(0, '#1d3028');
    tr.addColorStop(1, '#0a120f');
    ctx.beginPath();
    ctx.arc(0, 0, g.rimIn - 2 * Math.max(1, px), 0, TAU);
    ctx.fillStyle = tr;
    ctx.fill();

    var n = pockets.length;
    if (n) {
      var seg = TAU / n;
      var midR = (g.pockIn + g.pockOut) / 2;
      var arc = midR * seg;
      // which pockets are on screen: all of them when the whole wheel is in view, otherwise an arc of them
      var viewR = cw * 0.76 / z;
      var fd = Math.hypot(cam.fx, cam.fy);
      var iFrom = 0, iTo = n - 1;
      if (g.big && viewR < fd) {
        var half = Math.asin(Math.min(1, viewR / fd)) + seg * 2;
        var mid = Math.atan2(cam.fy, cam.fx);
        iFrom = Math.floor((mid - half - wheelA) / seg);
        iTo = Math.ceil((mid + half - wheelA) / seg);
        if (iTo - iFrom + 1 >= n) { iFrom = 0; iTo = n - 1; }
      }
      var lw = g.big ? core.clamp(1.1 * px, 0.8, 3) : (n > 40 ? 0.6 : 1.5);
      var showEdge = !g.big || arc * z >= 5;
      var winning = winIdx >= 0 && winIdx < n && ballMode === 'pocket' && !spinning;
      // a live wheel tells the charities somebody backed (bright, with a cap in their colour) from the catalog charities that only fill it (muted)
      var live = !!field && backedAt.length === n && backedIdx.length > 0;

      if (g.big) {
        // many pockets: fill them by colour in a few passes (live filler pockets have a muted twin of each colour)
        var groups = [[], [], [], [], [], []];
        for (var m = iFrom; m <= iTo; m++) { groups[pocketGroup(U.mod(m, n))].push(m); }
        PALETTE.forEach(function (col, gk) {
          if (!groups[gk].length) { return; }
          ctx.beginPath();
          groups[gk].forEach(function (mm) { sliceSub(g, wheelA + mm * seg, wheelA + (mm + 1) * seg); });
          ctx.fillStyle = col;
          ctx.fill();
        });
        if (showEdge) {
          ctx.lineWidth = lw;
          if (live) {
            ctx.beginPath();
            for (var mf = iFrom; mf <= iTo; mf++) { if (!backedAt[U.mod(mf, n)]) { sliceSub(g, wheelA + mf * seg, wheelA + (mf + 1) * seg); } }
            ctx.strokeStyle = 'rgba(255,197,66,0.3)';
            ctx.stroke();
            ctx.beginPath();
            for (var mb = iFrom; mb <= iTo; mb++) { if (backedAt[U.mod(mb, n)]) { sliceSub(g, wheelA + mb * seg, wheelA + (mb + 1) * seg); } }
            ctx.strokeStyle = 'rgba(255,214,102,1)';
            ctx.stroke();
          } else {
            ctx.beginPath();
            for (var me = iFrom; me <= iTo; me++) { sliceSub(g, wheelA + me * seg, wheelA + (me + 1) * seg); }
            ctx.strokeStyle = 'rgba(255,197,66,0.85)';
            ctx.stroke();
          }
        }
      } else {
        for (var i = 0; i < n; i++) {
          var a0 = wheelA + i * seg;
          annulus(g, g.pockIn, g.pockOut, a0, a0 + seg);
          ctx.fillStyle = pocketColor(i);
          ctx.fill();
          ctx.lineWidth = lw;
          ctx.strokeStyle = live && !backedAt[i] ? 'rgba(255,197,66,0.3)' : (live ? 'rgba(255,214,102,1)' : 'rgba(255,197,66,0.85)');
          ctx.stroke();
        }
      }
      if (live) {
        // a cap in the charity's own colour at the rim end of every pocket somebody backed, so they stand out even when the wheel is too small to read
        var capIn = g.pockOut - (g.pockOut - g.pockIn) * 0.2;
        for (var cj = iFrom; cj <= iTo; cj++) {
          var ci = U.mod(cj, n);
          if (!backedAt[ci]) { continue; }
          annulus(g, capIn, g.pockOut, wheelA + cj * seg, wheelA + (cj + 1) * seg);
          ctx.fillStyle = pockets[ci].accent;
          ctx.fill();
        }
      }

      var mfs = Math.max(0, Math.min(arc * 0.34, 19));
      if (mfs * z >= 6.5) {
        for (var jj = iFrom; jj <= iTo; jj++) {
          var j = U.mod(jj, n);
          var ca = wheelA + (jj + 0.5) * seg;
          var m2 = GS.mono(pockets[j]);
          ctx.save();
          ctx.translate(Math.cos(ca) * midR, Math.sin(ca) * midR);
          ctx.rotate(ca + Math.PI / 2);
          ctx.fillStyle = live && !backedAt[j] ? 'rgba(255,255,255,0.4)' : '#fff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = '800 ' + (mfs * (m2.length > 2 ? 0.82 : 1)) + 'px "Sora", "Inter", sans-serif';
          ctx.fillText(m2, 0, 2);
          if (cw >= 340 && arc >= 30 && !live) {
            ctx.font = '700 ' + Math.max(8, mfs * 0.5) + 'px "Inter", sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.fillText(String(j), 0, -(g.pockOut - g.pockIn) * 0.36);
          }
          ctx.restore();
        }
      } else if (n <= 64 && !live) {
        // pockets too small for lettering: number every fifth one so the wheel still reads as a wheel
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 ' + Math.max(7, arc * 0.5) + 'px "Inter", sans-serif';
        for (var q = 0; q < n; q += 5) {
          var qa = wheelA + (q + 0.5) * seg;
          ctx.save();
          ctx.translate(Math.cos(qa) * midR, Math.sin(qa) * midR);
          ctx.rotate(qa + Math.PI / 2);
          ctx.fillText(String(q), 0, 0);
          ctx.restore();
        }
      }
      var mine = field ? livePick : pick;
      if (mine) {
        // the charity you backed: a gold edge on each of its pockets
        ctx.lineWidth = g.big ? Math.max(2, 2 * px) : (n > 40 ? 1.6 : 3);
        ctx.strokeStyle = '#ffc542';
        ctx.beginPath();
        for (var pk = iFrom; pk <= iTo; pk++) {
          if (pockets[U.mod(pk, n)].id !== mine) { continue; }
          sliceSub(g, wheelA + pk * seg, wheelA + (pk + 1) * seg);
        }
        ctx.stroke();
      }
      if (winning) {
        var pulse = 0.5 + 0.5 * Math.sin((t - glowT) / 170);
        ctx.beginPath();
        for (var k = iFrom; k <= iTo; k++) {
          if (U.mod(k, n) === winIdx) { continue; }
          sliceSub(g, wheelA + k * seg, wheelA + (k + 1) * seg);
        }
        ctx.fillStyle = 'rgba(4,10,14,0.6)';
        ctx.fill();
        var w0 = wheelA + winIdx * seg;
        annulus(g, g.pockIn, g.pockOut, w0, w0 + seg);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.18 + 0.2 * pulse) + ')';
        ctx.fill();
        ctx.lineWidth = Math.max(n > 40 ? 3 : 4, 2.5 * px);
        ctx.strokeStyle = '#fff';
        ctx.stroke();
      }
    }

    var felt = ctx.createRadialGradient(0, 0, 0, 0, 0, g.pockIn);
    felt.addColorStop(0, '#1c5a3e');
    felt.addColorStop(1, '#0c2e20');
    ctx.beginPath();
    ctx.arc(0, 0, g.pockIn - 1, 0, TAU);
    ctx.fillStyle = felt;
    ctx.fill();
    ctx.lineWidth = Math.max(2, 1.5 * px);
    ctx.strokeStyle = '#ffc542';
    ctx.stroke();
    ctx.save();
    ctx.rotate(wheelA);
    ctx.strokeStyle = '#ffc542';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(3, g.R * 0.022);
    for (var s = 0; s < 4; s++) {
      var sa = s * Math.PI / 2 + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(sa) * g.hub, Math.sin(sa) * g.hub);
      ctx.lineTo(Math.cos(sa) * (g.pockIn * 0.88), Math.sin(sa) * (g.pockIn * 0.88));
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(Math.cos(sa) * g.pockIn * 0.88, Math.sin(sa) * g.pockIn * 0.88, g.R * 0.024, 0, TAU);
      ctx.fillStyle = '#ffe39a';
      ctx.fill();
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(0, 0, g.hub, 0, TAU);
    var hubG = ctx.createRadialGradient(-g.hub * 0.3, -g.hub * 0.3, 1, 0, 0, g.hub);
    hubG.addColorStop(0, '#fff4c4');
    hubG.addColorStop(1, '#d99a14');
    ctx.fillStyle = hubG;
    ctx.fill();

    if (flash > 0.01) {
      ctx.beginPath();
      ctx.arc(0, 0, g.pockOut, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,' + flash * 0.4 + ')';
      ctx.fill();
    }

    // the ball (drawn at least a few pixels across on screen, so it can be followed when the camera is zoomed out)
    var bp = ballPos(g);
    var br = Math.max(ballRad(n), 5 * px);
    var bx = bp.x, by = bp.y;
    if (g.big && z < 0.6 && ballMode !== 'park') {
      // a glow (and a ring that breathes) so the ball can be found on a huge wheel
      var halo = Math.min(br * 6, 90 * px);
      var hg = ctx.createRadialGradient(bx, by, br * 0.4, bx, by, halo);
      hg.addColorStop(0, 'rgba(255,226,140,0.95)');
      hg.addColorStop(0.35, 'rgba(255,176,64,0.45)');
      hg.addColorStop(1, 'rgba(255,140,30,0)');
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(bx, by, halo, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bx, by, br * (2.4 + 0.4 * Math.sin(t / 130)), 0, TAU);
      ctx.lineWidth = Math.max(1.5, 1.8 * px);
      ctx.strokeStyle = 'rgba(255,225,140,0.75)';
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(bx + 1.5, by + 2.5, br, 0, TAU);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();
    var bg = ctx.createRadialGradient(bx - br * 0.35, by - br * 0.35, br * 0.1, bx, by, br);
    bg.addColorStop(0, '#ffffff');
    bg.addColorStop(1, '#c9d6de');
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, TAU);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.restore();

    // a small map of the whole wheel while the camera is in close: where the ball is, and where the winner is
    if (g.big && z > g.zo * 1.3) {
      var mr = 34, mx = cw - mr - 12, my = mr + 12;
      ctx.beginPath();
      ctx.arc(mx, my, mr + 6, 0, TAU);
      ctx.fillStyle = 'rgba(8,16,26,0.72)';
      ctx.fill();
      ctx.lineWidth = 7;
      ctx.strokeStyle = RED;
      ctx.setLineDash([TAU * (mr * 0.72) / 60, TAU * (mr * 0.72) / 60]);
      ctx.beginPath();
      ctx.arc(mx, my, mr * 0.72, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      if (live) {
        // the pockets somebody backed, as gold ticks: the ball can only land in one of them
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffd666';
        ctx.beginPath();
        for (var bt = 0; bt < backedIdx.length; bt++) {
          var ta = wheelA + (backedIdx[bt] + 0.5) * (TAU / n);
          ctx.moveTo(mx + Math.cos(ta) * mr * 0.52, my + Math.sin(ta) * mr * 0.52);
          ctx.lineTo(mx + Math.cos(ta) * mr * 0.92, my + Math.sin(ta) * mr * 0.92);
        }
        ctx.stroke();
      }
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffc542';
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, TAU);
      ctx.stroke();
      var ma = Math.atan2(by, bx);
      ctx.beginPath();
      ctx.arc(mx + Math.cos(ma) * mr * 0.86, my + Math.sin(ma) * mr * 0.86, 4, 0, TAU);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = '#0b1620';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  /* ------------------------------------------------------------ animation */

  function pocketUnder(angle) {
    var n = pockets.length;
    return Math.floor(U.mod(angle - wheelA, TAU) / (TAU / n)) % n;
  }

  function loop(t) {
    if (!active) { raf = 0; return; }
    var dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    flash *= Math.exp(-dt * 7);
    if (anim) {
      var g = G;
      var p = Math.min(1, (t - anim.start) / anim.dur);
      var n = pockets.length;
      var seg = TAU / n;
      wheelA = anim.wA0 + anim.wTurns * TAU * U.easeOutCubic(p);
      var rT = (g.trackIn + g.rimIn) / 2 + (g.rimIn - g.trackIn) * 0.12;
      if (p < anim.p1) {
        var q = p / anim.p1;
        ballMode = 'orbit';
        ballA = anim.bA0 - anim.bTurns * TAU * (1 - Math.pow(1 - q, 2.1));
        ballR = rT;
      } else {
        var q2 = (p - anim.p1) / (1 - anim.p1);
        if (!anim.off0) {
          var pw1 = wheelA + (anim.target + 0.5) * seg;
          var raw = anim.bFreeEnd - pw1;
          anim.off0 = U.mod(raw, TAU) + TAU * (anim.quick ? 0.4 : 1) + (g.big ? TAU * 0.25 : n > 37 ? TAU * 1.5 : 0);
        }
        ballMode = 'orbit';
        var pw = wheelA + (anim.target + 0.5) * seg;
        ballA = pw + anim.off0 * (1 - U.easeOutCubic(q2));
        var rP = (g.pockOut + g.pockIn) / 2 + (g.pockOut - g.pockIn) * 0.18;
        var drop = U.easeInOut(Math.min(1, q2 * 1.15));
        var skip = Math.abs(Math.sin(q2 * Math.PI * (4.5 + Math.min(n, 100) / 9))) * (1 - q2) * g.skip * (q2 > 0.35 ? 1 : 0);
        ballR = rT + (rP - rT) * drop + skip;
        var under = pocketUnder(ballA);
        if (under !== anim.lastUnder) {
          anim.lastUnder = under;
          if (t - anim.lastTick > 34) { anim.lastTick = t; GS.audio.tick(Math.min(1, (1 - q2) * 1.3)); }   // never more than ~30 ticks a second
        }
      }
      if (p >= 1) {
        var done = anim.done;
        anim = null;
        spinning = false;
        ballMode = 'pocket';
        glowT = t;
        GS.audio.thud();
        done();
      }
    } else if (!spinning && !U.reducedMotion()) {
      // a huge wheel turns slowly, so its rim does not stream past faster than the rim of a wheel that fits the screen
      var idle = G && G.big ? Math.min(1, 36 / (G.pockOut * 0.12)) : 1;
      wheelA += dt * (winIdx >= 0 ? 0.05 : 0.12) * idle;
    }
    updateCamera(dt);
    draw(t);
    raf = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (raf || !active) { return; }
    lastT = performance.now();
    raf = requestAnimationFrame(loop);
  }

  /* ----------------------------------------------------------------- logic */

  /** The live entrants one to a charity: a charity that holds several spots (a short roster repeats charities on a big board) counts once, with all of its tickets. */
  function perCharity(entrants) {
    var seen = {};
    var out = [];
    entrants.forEach(function (e) {
      var id = e.charity.id;
      if (!seen[id]) { seen[id] = { charity: e.charity, tickets: 0 }; out.push(seen[id]); }
      seen[id].tickets += e.tickets;
    });
    return out;
  }

  function renderLegend() {
    if (!el.legend) { return; }
    var live = null;
    if (field) {
      // live: a chip for every charity somebody backed (biggest stake first) with its share and its pockets, then the catalog charities
      // that only fill the board, muted (a long list of those is boiled down to one line)
      var rows = perCharity(field);
      var total = rows.reduce(function (s, e) { return s + e.tickets; }, 0);
      var mineBy = {};
      pockets.forEach(function (c) { mineBy[c.id] = (mineBy[c.id] || 0) + 1; });
      var backed = rows.filter(function (e) { return e.tickets > 0; }).sort(function (a, b) { return b.tickets - a.tickets; });
      var fillers = rows.filter(function (e) { return !(e.tickets > 0); });
      var winId = ballMode === 'pocket' && winIdx >= 0 && pockets[winIdx] ? pockets[winIdx].id : '';
      var shownF = fillers.length <= 30 ? fillers : [];
      live = { chips: backed.length + shownF.length + (fillers.length > shownF.length ? 1 : 0) };
      live.html = backed.map(function (e) {
        var mine = mineBy[e.charity.id] || 0;
        return '<li class="' + (e.charity.id === winId ? 'is-win' : 'is-pick') + '" data-id="' + e.charity.id + '">' + GS.ui.mono(e.charity, 20) + '<span>' + U.esc(e.charity.short) + ' · ' + kit.share(e.tickets, total) + ' · ' + mine + (mine === 1 ? ' pocket' : ' pockets') + (e.charity.id === livePick ? ' · you' : '') + '</span></li>';
      }).join('') + shownF.map(function (e) {
        // (only the badge is faded: faded text would not be readable)
        return '<li data-id="' + e.charity.id + '" style="color:var(--dim)" title="Fills the board: this charity cannot win"><span style="opacity:0.55;display:inline-flex">' + GS.ui.mono(e.charity, 20) + '</span><span>' + U.esc(e.charity.short) + '</span></li>';
      }).join('') + (fillers.length > shownF.length ? '<li class="rlegend__more">+ ' + fillers.length + ' more charities fill the wheel, one pocket each. They cannot win.</li>' : '');
    }
    var big = live ? live.chips > (narrow() ? 6 : 14) : pockets.length > 40;
    el.legend.className = 'rlegend' + (big ? ' rlegend--scroll' : '');
    if (big) { el.legend.setAttribute('tabindex', '0'); } else { el.legend.removeAttribute('tabindex'); }
    if (live) { el.legend.innerHTML = live.html; return; }
    if (pockets.length > 40) {
      // too many pockets to list one by one: one chip per charity, with how many pockets it has
      var seen = {};
      var order = [];
      pockets.forEach(function (c) { if (!seen[c.id]) { seen[c.id] = { c: c, n: 0 }; order.push(seen[c.id]); } seen[c.id].n += 1; });
      var shownCh = order.slice(0, 150);
      el.legend.innerHTML = shownCh.map(function (o) {
        var win = ballMode === 'pocket' && winIdx >= 0 && pockets[winIdx] && pockets[winIdx].id === o.c.id;
        return '<li' + (win ? ' class="is-win"' : (o.c.id === pick ? ' class="is-pick"' : '')) + '>' + GS.ui.mono(o.c, 20) + '<span>' + U.esc(o.c.short) + (o.n > 1 ? ' × ' + o.n : '') + '</span></li>';
      }).join('') + (order.length > shownCh.length ? '<li class="rlegend__more">+ ' + (order.length - shownCh.length) + ' more</li>' : '');
      return;
    }
    el.legend.innerHTML = pockets.map(function (c, i) {
      return '<li data-i="' + i + '"' + (i === winIdx && ballMode === 'pocket' ? ' class="is-win"' : (c.id === pick ? ' class="is-pick"' : '')) + '><span class="rlegend__n" style="background:' + pocketColor(i) + '">' + i + '</span><span>' + U.esc(c.short) + '</span></li>';
    }).join('');
  }

  function updateNote() {
    if (!el.note) { return; }
    if (cw) { layout(); }
    if (field) {
      var nb = backedIdx.length ? Object.keys(backedAt.reduce(function (o, v, i) { if (v) { o[pockets[i].id] = 1; } return o; }, {})).length : 0;
      var nf = Math.max(0, field.length - nb);
      el.note.textContent = nb + (nb === 1 ? ' charity is' : ' charities are') + ' backed and light up on the wheel: the more money behind one, the more pockets it owns.' +
        (nf === 1 ? ' The other one fills the board with a pocket, dimmed, and cannot win.' : nf ? ' The other ' + nf.toLocaleString('en-US') + ' fill the board with a pocket each, dimmed, and cannot win.' : '');
      return;
    }
    el.note.textContent = kit.boardNote(pool, pockets.length, pick, 'on the wheel') + (G && G.big ? ' With this many pockets the wheel is far bigger than your screen: the camera pulls back while the ball flies and closes in as it settles.' : '');
  }

  function rebuild() {
    if (field) { return; }
    if (!pool.length) { pockets = []; winIdx = -1; ballMode = 'park'; renderLegend(); updateNote(); resize(); return; }
    pockets = kit.sample(pool, count());
    winIdx = -1;
    ballMode = 'park';
    fresh = true;
    if (el.result) { el.result.textContent = ''; }
    renderLegend();
    updateNote();
    resize();
  }

  /** Makes sure the winner has a pocket; reshuffles only when the wheel has already been used. */
  function showWinner(winner) {
    var has = pockets.some(function (c) { return c.id === winner.id; });
    if (fresh && has) { return; }
    if (fresh) { pockets[core.randomInt(pockets.length)] = winner; renderLegend(); return; }
    pockets = kit.boardWith(pool, winner, count());
    winIdx = -1;
    ballMode = 'park';
    fresh = true;
    flash = 1;
    renderLegend();
    updateNote();
    resize();
  }

  /**
   * The ring of a live wheel. Every spot on the board owns a pocket (the catalog charities that fill it included), and the pockets on
   * top of those are shared out by stake, so the more money behind a charity, the more of the wheel it owns. The ring is kept for the
   * whole round: when somebody bets, only the pocket or two that change hands change, and the rest of the wheel stays where it was.
   */
  function layoutLive(entrants, key) {
    var n = entrants.length;
    var total = Math.max(LIVE_POCKETS, n + Math.min(n, 36));
    var extras = total - n;
    var t;
    if (!ring || ring.key !== key || ring.ch.length !== total) {
      ring = { key: key, extra: [], ch: [] };
      for (t = 0; t < total; t++) {
        ring.extra.push(Math.floor((t + 1) * extras / total) > Math.floor(t * extras / total));   // the extra pockets sit evenly among the others
        ring.ch.push(null);
      }
    }
    // the spots: a charity keeps the pocket it had, and one that is new on the board takes a pocket that a charity which left has given up
    var need = {};
    var byId = {};
    entrants.forEach(function (e) { need[e.charity.id] = (need[e.charity.id] || 0) + 1; byId[e.charity.id] = e.charity; });
    var vacant = [];
    for (t = 0; t < total; t++) {
      if (ring.extra[t]) { continue; }
      var c = ring.ch[t];
      if (c && need[c.id] > 0) { need[c.id] -= 1; } else { ring.ch[t] = null; vacant.push(t); }
    }
    entrants.forEach(function (e) {
      if (need[e.charity.id] > 0 && vacant.length) { need[e.charity.id] -= 1; ring.ch[vacant.shift()] = e.charity; }
    });
    // the extra pockets: shared out by stake. A charity keeps the extra pockets it had while it still deserves them.
    var counts = core.apportion(entrants.map(function (e) { return e.tickets > 0 ? e.tickets : 0; }), extras, 0);
    var want = {};
    entrants.forEach(function (e, i) { want[e.charity.id] = (want[e.charity.id] || 0) + counts[i]; });
    var have = {};
    var free = [];
    for (t = 0; t < total; t++) {
      if (!ring.extra[t]) { continue; }
      var o = ring.ch[t];
      if (o && (have[o.id] || 0) < (want[o.id] || 0)) { have[o.id] = (have[o.id] || 0) + 1; } else { ring.ch[t] = null; free.push(t); }
    }
    // a charity that gained pockets takes free ones, each as far as it can from the pockets it already has (so they spread around the wheel)
    var mineAt = {};
    ring.ch.forEach(function (ch, s) { if (ch) { (mineAt[ch.id] = mineAt[ch.id] || []).push(s); } });
    Object.keys(want).filter(function (id) { return want[id] > (have[id] || 0); }).sort(function (a, b) { return want[b] - want[a] || (a < b ? -1 : 1); }).forEach(function (id) {
      var at = mineAt[id] = mineAt[id] || [];
      while ((have[id] || 0) < want[id] && free.length) {
        var best = 0;
        var bestD = -1;
        for (var f = 0; f < free.length; f++) {
          var d = total;
          for (var u = 0; u < at.length; u++) { var gap = Math.abs(at[u] - free[f]); d = Math.min(d, gap, total - gap); }
          if (d > bestD) { bestD = d; best = f; }
        }
        var slot = free.splice(best, 1)[0];
        ring.ch[slot] = byId[id];
        at.push(slot);
        have[id] = (have[id] || 0) + 1;
      }
    });
    var backedIds = {};
    entrants.forEach(function (e) { if (e.tickets > 0) { backedIds[e.charity.id] = true; } });
    pockets = [];
    backedAt = [];
    backedIdx = [];
    ring.ch.forEach(function (ch) {
      if (!ch) { return; }
      if (backedIds[ch.id]) { backedIdx.push(pockets.length); }
      backedAt.push(!!backedIds[ch.id]);
      pockets.push(ch);
    });
  }

  function setLiveField(entrants, info) {
    field = entrants;
    livePick = yourPick();
    // the same wheel for the whole round (info.key starts with the round number), however the board changes as people back charities
    layoutLive(entrants, (info && info.key ? String(info.key).split(':')[0] : '') + '/' + entrants.length);
    winIdx = -1;
    ballMode = 'park';
    fresh = true;
    renderLegend();
    updateNote();
    resize();
  }

  function spinOnce(winner, quick, durationMs) {
    return new Promise(function (resolve) {
      var mine = [];
      pockets.forEach(function (c, k) { if (c.id === winner.id) { mine.push(k); } });
      var target = mine[core.randomInt(mine.length)];
      var n = pockets.length;
      winIdx = target;
      fresh = false;
      spinning = true;
      ballMode = 'orbit';
      if (el.result) { el.result.textContent = ''; }
      el.legend.querySelectorAll('.is-win').forEach(function (li) { li.classList.remove('is-win'); });
      GS.audio.whoosh();
      var turns = quick ? 3.2 : 6;
      var dur = U.dur(durationMs || ((quick ? 3600 : 7600 + (n > 37 ? 1600 : 0)) + (G && G.big ? (quick ? 800 : 2400) : 0)));
      prevA = null;
      vS = 0;
      anim = {
        start: performance.now(), dur: dur, quick: quick, p1: 0.62,
        wA0: wheelA, wTurns: quick ? 0.9 : 1.7, bA0: -Math.PI / 2, bTurns: turns, target: target, off0: 0, lastUnder: -1, lastTick: 0,
        bFreeEnd: -Math.PI / 2 - turns * TAU,
        done: function () {
          if (el.result) { el.result.textContent = field ? winner.name : 'Pocket ' + target + ': ' + winner.name; }
          renderLegend();
          resolve(winner);
        },
        stop: function () { resolve(winner); }
      };
    });
  }

  /* ------------------------------------------------------------ public API */

  GS.games.roulette = {
    id: 'roulette',
    name: 'Roulette',
    label: 'Roulette',
    icon: 'circle-dot',
    category: 'table',
    badge: 'Up to 1,000',
    live: true,
    maxSize: 1000,
    sizes: [{ n: 16, name: 'Classic' }, { n: 37, name: 'Big' }, { n: 100, name: 'Giant' }, { n: 250, name: 'Mega' }],
    defaultSize: 16,
    tagline: 'The ball spins one way, the wheel the other. It skips across the pockets and settles in a charity’s.',
    cta: 'Spin roulette',
    info: [
      'A roulette wheel where every pocket is a charity. Set the board to any number of pockets, from a few to a thousand: the ball races around the rim in the opposite direction, bounces across the pockets and drops into one.',
      'Casino roulette has 37 or 38 pockets and a house edge. Here there is no house: every charity on the wheel has exactly the same chance and your whole gift goes to whoever the ball picks. Back a charity and, if the ball picks it, you earn a bonus.'
    ],

    mount: function (container, gameApi) {
      api = gameApi;
      container.innerHTML =
        '<div class="roulette" data-role="stage"><canvas class="roulette__canvas" data-role="canvas" aria-hidden="true"></canvas></div>' +
        '<p class="game-result" data-role="result" aria-live="polite"></p>' +
        '<button type="button" class="gbtn" data-role="spin">' + GS.icon('circle-dot') + '<span>Spin</span></button>' +
        '<ul class="rlegend" data-role="legend" aria-label="Pockets on the wheel"></ul>' +
        '<p class="game-note" data-role="note"></p>';
      el.stage = container.querySelector('[data-role="stage"]');
      el.canvas = container.querySelector('[data-role="canvas"]');
      el.legend = container.querySelector('[data-role="legend"]');
      el.note = container.querySelector('[data-role="note"]');
      el.result = container.querySelector('[data-role="result"]');
      el.spin = container.querySelector('[data-role="spin"]');
      ctx = el.canvas.getContext('2d');
      el.spin.addEventListener('click', function () { if (!locked) { api.requestPlay(); } });
      U.observeSize(el.stage, resize);
      resize();
    },

    setSize: function (n) { size = n; if (!spinning && !field) { rebuild(); } },
    /** The board for the next spin: the charities on it (what the winner is drawn from), how many pockets, and the charity you backed. */
    setBoard: function (list, n, pickId) {
      pool = list.slice();
      size = n;
      pick = pickId || '';
      if (!spinning && !field) { rebuild(); }
    },
    setPool: function (list) {
      pool = list.slice();
      if (!spinning && !field) { rebuild(); }
    },
    setField: function (entrants, info) { if (!spinning) { setLiveField(entrants, info); } },
    clearField: function () { field = null; ring = null; backedAt = []; backedIdx = []; livePick = ''; if (!spinning) { rebuild(); } },
    /** Stops a spin in progress (the live table it belonged to has been left): the wheel goes back to rest. */
    abort: function () {
      if (!anim) { return; }
      var a = anim;
      anim = null;
      spinning = false;
      ballMode = 'park';
      winIdx = -1;
      resetCamera();
      a.stop();
    },

    activate: function () { active = true; resize(); startLoop(); },
    deactivate: function () { active = false; },

    lock: function (isLocked) {
      locked = !!isLocked;
      if (el.spin) { el.spin.hidden = !!field; el.spin.disabled = locked; }
    },

    play: function (opts) {
      var winners = opts.winners;
      var count2 = winners.length;
      var quick = !!opts.quick || count2 > 1;
      var i = 0;
      return new Promise(function (resolve) {
        (function next() {
          if (i >= count2) { resolve(winners); return; }
          if (opts.onRound) { opts.onRound(i, count2); }
          showWinner(winners[i]);
          U.sleep(flash > 0.2 ? 350 : 60).then(function () { return spinOnce(winners[i], quick); }).then(function (winner) {
            if (opts.onReveal) { opts.onReveal(i, winner); }
            i += 1;
            return U.sleep(count2 > 1 ? 1000 : 450);
          }).then(next);
        })();
      });
    },

    /** Live table: spin to the winner with the stake-weighted pockets already on the wheel. */
    playLive: function (opts) { return spinOnce(opts.winner, false, opts.durationMs); },

    _shown: function () { return winIdx >= 0 && ballMode === 'pocket' && pockets[winIdx] ? [pockets[winIdx].id] : []; },
    _pockets: function () { return pockets.length; },
    _ring: function () { return pockets.map(function (c) { return c.id; }); },
    _marked: function () { return field ? livePick : pick; },
    _zoom: function () { return cam.z; },
    _big: function () { return !!(G && G.big); }
  };
})();
