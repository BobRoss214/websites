/* Channel Surf mockups: the screen controller shared by all three looks.
   It decides what's on the screen (picture, guide, menu, cards, static) and where
   the picture sits. The big rule: nothing is ever drawn on top of the picture.
   When a banner, number or volume needs room, the picture shrinks out of the way
   ("squeeze") and the look draws in the space it leaves. Each look supplies the
   drawings through `cfg`. */
(function () {
  'use strict';
  const { airing, listings, clock, halfHourFloor, Picture, Snow, Sound, Menu, CHANNELS } = CS;

  CS.makeScreen = function (cfg) {
    const $ = id => document.getElementById(id);
    const el = { screen: $('screen'), picWrap: $('picWrap'), band: $('band'), guide: $('guide'), menu: $('menu'), card: $('card'), snow: $('snow'), power: $('power'), toast: $('toast'), crt: $('crt') };
    const picture = new Picture($('pic'));
    const fx = cfg.staticFX ? cfg.staticFX(el.snow) : new Snow(el.snow);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let mode = 'off', bandTimer = 0, toastTimer = 0, powerTimer = 0, tv = null, menu = null, showing = null, bandType = null;
    const G = { win: 0, row: 0, col: 0, pausedUntil: 0, scroll: 0, raf: 0 };
    const guideChans = () => CHANNELS.filter(c => c.kind !== 'guide');

    // ---- where the picture sits ----
    function setPic(name) {
      const r = name && cfg.geom[name];
      if (!r) { el.picWrap.hidden = true; picture.stop(); showing = null; return; }
      el.picWrap.hidden = false; el.picWrap.dataset.geom = name;
      Object.assign(el.picWrap.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
    }
    function showPicture(ch, a, where) { showing = { ch, a }; picture.show(ch, a); setPic(where); }

    function setMode(m) {
      mode = m; el.screen.dataset.mode = m;
      el.guide.hidden = m !== 'guide'; el.menu.hidden = m !== 'menu'; el.card.hidden = m !== 'card';
      el.snow.hidden = m !== 'snow'; el.power.hidden = m !== 'off'; el.band.hidden = m !== 'picture';
      if (m !== 'snow') fx.stop();
      if (m !== 'picture') { clearTimeout(bandTimer); el.band.classList.remove('show'); bandType = null; }
      if (m !== 'guide') cancelAnimationFrame(G.raf);
      hideToast();
      if (['off', 'blank', 'snow', 'card'].includes(m)) setPic(null);
    }

    // ---- the squeeze band (only while the picture is showing) ----
    function band(type, data, ms) {
      bandType = type;
      el.band.innerHTML = cfg.band(type, data);
      el.band.dataset.type = type;
      el.band.classList.add('show'); setPic('squeeze');
      clearTimeout(bandTimer); bandTimer = setTimeout(unband, ms);
    }
    function unband() { el.band.classList.remove('show'); bandType = null; if (mode === 'picture') setPic('full'); }
    // ---- toasts: only on our own screens (guide, menu, cards), never over the picture ----
    function toast(type, data) {
      if (!el.toast) return;
      el.toast.innerHTML = cfg.toast ? cfg.toast(type, data) : String(data.text || '');
      el.toast.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(hideToast, 2200);
    }
    function hideToast() { if (el.toast) el.toast.hidden = true; }
    function osd(type, data, ms) { if (mode === 'picture') band(type, data, ms); else if (mode !== 'off' && mode !== 'blank') toast(type, data); }

    // ---- guide ----
    function guideData() {
      const now = Date.now(), span = (cfg.guideSpan || 90) * 60000;
      const from = halfHourFloor(now) + G.win * 1800000, to = from + span;
      const chans = guideChans();
      const rows = chans.map((ch, ri) => {
        const cells = listings(ch, from, to).map((a, ci) => ({
          a, l: Math.max(0, (a.start - from) / span), r: Math.min(1, (a.slotEnd - from) / span),
          cutL: a.start < from, cutR: a.slotEnd > to, now: a.start <= now && now < a.slotEnd, sel: ri === G.row && ci === G.col,
        }));
        return { ch, cells, sel: ri === G.row };
      });
      const r = rows[G.row]; if (G.col > r.cells.length - 1) G.col = Math.max(0, r.cells.length - 1);
      r.cells.forEach((c, ci) => c.sel = ci === G.col);
      const times = []; for (let t = from; t < to; t += 1800000) times.push(t);
      return { now, from, to, times, rows, selCh: r.ch, selA: r.cells[G.col] ? r.cells[G.col].a : null, active: !cfg.guideAutoScroll || now < G.pausedUntil + 6000, G };
    }
    function drawGuide() { cfg.renderGuide(el.guide, guideData()); }
    function guideFrame() {
      if (mode !== 'guide') return;
      if (cfg.guideFrame) cfg.guideFrame(el.guide, G);
      G.raf = requestAnimationFrame(guideFrame);
    }
    function guideKey(k) {
      const n = guideChans().length, now = Date.now(), maxWin = Math.max(0, 6 - (cfg.guideSpan || 90) / 30);
      const cellsIn = () => { const d = guideData(); return d.rows[G.row].cells.length; };
      if (k === 'down') { G.row = (G.row + 1) % n; }
      else if (k === 'up') { G.row = (G.row - 1 + n) % n; }
      else if (k === 'right') { if (G.col < cellsIn() - 1) G.col++; else if (G.win < maxWin) { G.win++; G.col = 0; } }
      else if (k === 'left') { if (G.col > 0) G.col--; else if (G.win > 0) { G.win--; G.col = 99; } }
      else if (k === 'ok') { const ch = guideChans()[G.row]; tv.tune(CHANNELS.indexOf(ch)); return true; }
      else if (k === 'exit') { tv.last(); return true; }
      else return false;
      Sound.beep(); G.pausedUntil = now + 8000; drawGuide(); return true;
    }
    // the guide's little picture shows the channel you came from
    function guidePreview() {
      const from = CHANNELS[tv.lastIdx];
      const a = from && from.shows && from.shows.length ? airing(from, Date.now()) : null;
      if (a && !a.bumper && !a.show.broken) showPicture(from, a, 'guide'); else setPic(null);
      return a && !a.bumper ? from : null;
    }

    // ---- menu ----
    function openMenu() {
      const had = !el.picWrap.hidden && showing;
      menu.show();
      setMode('menu');
      if (had && cfg.geom.menu) setPic('menu'); else setPic(null);
      cfg.renderMenu(el.menu, menu, !!had);
    }

    // ---- what the TV brain calls ----
    const ui = {
      bind(t) { tv = t; menu = new Menu(tv, m => {
        if (m.open) { cfg.renderMenu(el.menu, m, !el.picWrap.hidden); return; }
        const tok = tv.tuneToken; // menu closed: go back to what's on (unless a channel change already happened)
        setTimeout(() => { if (tv.tuneToken === tok && !menu.open && tv.on) tv._present(tok); }, 0);
      }); menu.cols = cfg.menuCols || 1; },
      powerOn(done) {
        clearTimeout(powerTimer); el.screen.dataset.anim = '';
        setMode('blank');
        if (cfg.powerOn) return cfg.powerOn(el, done);
        el.screen.dataset.anim = 'on'; setTimeout(() => { done(); }, reduced ? 200 : 700); setTimeout(() => { el.screen.dataset.anim = ''; }, 1000);
      },
      powerOff() {
        if (menu && menu.open) { menu.open = false; }
        setMode('blank'); el.screen.dataset.anim = 'off';
        clearTimeout(powerTimer); powerTimer = setTimeout(() => { el.screen.dataset.anim = ''; setMode('off'); }, reduced ? 300 : 850);
      },
      blank() { setMode('blank'); },
      snow() { setMode('snow'); fx.start(); },
      picture(ch, a) { setMode('picture'); showPicture(ch, a, 'full'); },
      showGuide(ch) {
        G.pausedUntil = 0; G.scroll = 0; G.win = 0; G.col = 0;
        const i = guideChans().indexOf(CHANNELS[tv.lastIdx]); if (i >= 0) G.row = i;
        setMode('guide'); el.guide.dataset.preview = guidePreview() ? CHANNELS[tv.lastIdx].num : '';
        drawGuide(); cancelAnimationFrame(G.raf); guideFrame();
      },
      offAir(ch) { setMode('card'); el.card.innerHTML = cfg.card('offair', ch); el.card.dataset.kind = 'offair'; },
      standBy(ch) { setMode('card'); el.card.innerHTML = cfg.card('standby', ch); el.card.dataset.kind = 'standby'; },
      ident(ch, nx) { setMode('card'); el.card.innerHTML = cfg.card('ident', ch, nx); el.card.dataset.kind = 'ident'; },
      banner(ch, a, opts = {}) { if (mode === 'picture') band('banner', { ch, a, opts }, opts.info ? 6000 : 4000); },
      typing(s, bad) { osd('number', { s: s.length === 1 ? s + '-' : s, bad }, 2200); },
      volume(v, muted) { osd('volume', { v, muted }, 2500); },
      message(text) { osd('message', { text }, 2500); },
      menu() { openMenu(); },
      keyHook(k) {
        if (menu.open) return menu.key(k);
        if (k === 'menu') { openMenu(); return true; }
        if (mode === 'guide' && !tv.digits) return guideKey(k);
        if (k === 'exit') { if (bandType) { clearTimeout(bandTimer); unband(); } return true; }
        if (k === 'left' || k === 'right') return true; // nothing to do while watching
        return false;
      },
      // for clicks/taps inside the guide and menus
      tuneTo(ch) { tv.tune(CHANNELS.indexOf(ch)); },
      pickMenu(i) { menu.pick(i); },
      menuBack() { menu.key('back'); },
      guideSelect(row, col) { G.row = row; G.col = col; G.pausedUntil = Date.now() + 8000; drawGuide(); },
      get mode() { return mode; },
      get showing() { return showing; },
      el, G,
    };
    // keep the guide clock and "now" markers fresh
    setInterval(() => { if (mode === 'guide') drawGuide(); }, 15000);
    return ui;
  };
})();
