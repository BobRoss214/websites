// Keyboard and TV-remote keys. Cheap USB "air mouse" remotes send these same
// keys (arrows, Enter, Back, numbers, volume, media keys), so they just work.
import { app } from './app.js';

export const KEYMAP = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'ok', ' ': 'ok',
  PageUp: 'chup', PageDown: 'chdown', ChannelUp: 'chup', ChannelDown: 'chdown',
  Backspace: 'back', Escape: 'back', BrowserBack: 'back', GoBack: 'back', x: 'exit', X: 'exit', Exit: 'exit',
  Home: 'menu', ContextMenu: 'menu', Menu: 'menu', BrowserHome: 'menu',
  m: 'mute', M: 'mute', AudioVolumeMute: 'mute', VolumeMute: 'mute',
  '+': 'vup', '=': 'vup', '-': 'vdown', _: 'vdown', AudioVolumeUp: 'vup', AudioVolumeDown: 'vdown', VolumeUp: 'vup', VolumeDown: 'vdown',
  g: 'guide', G: 'guide', Guide: 'guide', i: 'info', I: 'info', Info: 'info', c: 'cc', C: 'cc', ClosedCaptionToggle: 'cc', Subtitle: 'cc',
  f: 'fav', F: 'fav', p: 'power', P: 'power', Power: 'power', PowerOff: 'power',
  s: 'search', S: 'search', '/': 'search', BrowserSearch: 'search', o: 'ondemand', O: 'ondemand', l: 'live', L: 'live', LiveContent: 'live',
  MediaPlayPause: 'ok', MediaPlay: 'ok', MediaPause: 'ok', MediaTrackNext: 'chup', MediaTrackPrevious: 'chdown',
  MediaFastForward: 'right', MediaRewind: 'left', MediaStop: 'exit',
};

export function bindKeys(tv) {
  addEventListener('keydown', e => {
    const t = e.target;
    if (t && t.closest && t.closest('input, textarea, select, [contenteditable]')) { if (e.key === 'Escape') t.blur(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return; // leave browser shortcuts alone
    // in Setup, Enter or Space on a focused button just clicks it
    if (t && t.closest && t.closest('#pages .setup button, #pages .setup label') && (e.key === 'Enter' || e.key === ' ')) return;
    const raw = e.key;
    const k = /^[0-9]$/.test(raw) ? raw : KEYMAP[raw] || null;
    if (!k && !(app.screen.pages.length && raw.length === 1)) return;
    e.preventDefault();
    if (app.remote) app.remote.flash(k);
    tv.press(k, raw);
  });
}
