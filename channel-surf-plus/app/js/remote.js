// The big on-screen remote, for a mouse or a touchscreen. It sits beside the
// TV picture (never on top of it). In "auto" it appears when the mouse moves
// or the screen is touched, and tucks away when only the keyboard/remote is used.
import { S } from './store.js';

const PW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true"><path d="M12 3v8"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/></svg>';

export function buildRemote(el, tv) {
  const stage = document.getElementById('stage');
  let visible = null, pointerRecent = false, touched = false, hideTimer = 0;

  function render() {
    const v = S.viewer;
    const b = (k, label, cls = '', aria = '') => `<button type="button" class="k ${cls}" data-k="${k}"${aria ? ` aria-label="${aria}"` : ''}>${label}</button>`;
    el.innerHTML = `<div class="r-top">${b('power', PW, 'pw', 'Power')}</div>
      <div class="r-row3">${b('guide', 'Guide', 'guide')}${b('menu', 'Menu', 'menu')}${b('info', 'Info', 'info')}</div>
      ${v.search || v.ondemand ? `<div class="r-row3">${v.search ? b('search', 'Search', 'search') : '<span></span>'}${b('live', 'Live TV', 'live')}${v.ondemand ? b('ondemand', 'On Demand', 'ondemand') : '<span></span>'}</div>` : ''}
      <div class="r-pad">${b('back', 'Back', 'corner')}${b('up', '▲', 'arrow', 'Up')}${b('exit', 'Exit', 'corner')}${b('left', '◀', 'arrow', 'Left')}${b('ok', 'OK', 'ok')}${b('right', '▶', 'arrow', 'Right')}${b('fav', 'Fav', 'corner')}${b('down', '▼', 'arrow', 'Down')}${b('cc', 'CC', 'corner')}</div>
      <div class="r-rock"><div class="rock"><span>CH</span>${b('chup', '▲', '', 'Channel up')}${b('chdown', '▼', '', 'Channel down')}</div>${b('mute', 'Mute', 'mute')}<div class="rock"><span>VOL</span>${b('vup', '+', '', 'Volume up')}${b('vdown', '−', '', 'Volume down')}</div></div>
      <div class="r-num">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => b(String(n), n, 'num')).join('')}${b('back', 'Last', 'num sm')}${b('0', '0', 'num')}${b('ok', 'Enter', 'num sm')}</div>
      <div class="r-brand">CHANNEL SURF</div>`;
    el.querySelectorAll('[data-k]').forEach(btn => {
      btn.tabIndex = -1; // keep the keyboard on the TV, not on a button
      btn.addEventListener('mousedown', e => e.preventDefault());
      btn.addEventListener('click', () => tv.press(btn.dataset.k));
    });
  }

  function fit() {
    const W = visible ? 2000 : 1600, H = 900;
    const s = Math.min(innerWidth / W, innerHeight / H);
    stage.style.width = W + 'px';
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  function set(show) { if (visible === show) return; visible = show; el.hidden = !show; fit(); }
  function apply() { const m = S.tv.remote; set(m === 'always' || (m === 'auto' && (pointerRecent || touched))); }
  function pointer(e) {
    if (S.tv.remote !== 'auto') return;
    if (e.pointerType === 'touch' || e.type === 'touchstart') touched = true;
    pointerRecent = true; apply();
    clearTimeout(hideTimer); if (!touched) hideTimer = setTimeout(() => { pointerRecent = false; apply(); }, 45000);
  }
  addEventListener('pointermove', pointer, { passive: true });
  addEventListener('pointerdown', pointer, { passive: true });
  addEventListener('touchstart', pointer, { passive: true });
  addEventListener('keydown', () => { if (S.tv.remote === 'auto' && visible && !touched) { clearTimeout(hideTimer); hideTimer = setTimeout(() => { pointerRecent = false; apply(); }, 8000); } });
  addEventListener('resize', fit);

  render(); apply(); fit();
  return {
    apply, render,
    flash(k) { if (!visible || !k) return; const b = el.querySelector(`[data-k="${k}"]`); if (b) { b.classList.add('flash'); setTimeout(() => b.classList.remove('flash'), 140); } },
  };
}
