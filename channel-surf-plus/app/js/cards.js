// Our own full-screen pictures, shown *instead of* the video (never on top of it):
// static, color bars, "Please Stand By", channel idents, start-up and messages.
import { esc, clock, fmtDay } from './util.js';

export class Snow {
  constructor(canvas) { this.c = canvas; this.x = canvas.getContext('2d'); this.on = false; this.img = this.x.createImageData(canvas.width, canvas.height); this._loop = this._loop.bind(this); }
  start() { if (!this.on) { this.on = true; requestAnimationFrame(this._loop); } }
  stop() { this.on = false; }
  _loop(now) {
    if (!this.on) return;
    const d = this.img.data, W = this.c.width, H = this.c.height, bar = ((now / 6) % (H * 1.6)) - H * 0.3;
    for (let y = 0; y < H; y++) { const dim = Math.abs(y - bar) < H * 0.12 ? 0.55 : 1; for (let x = 0; x < W; x++) { const v = (Math.random() * 255 * dim) | 0, i = (y * W + x) * 4; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; } }
    this.x.putImageData(this.img, 0, 0); requestAnimationFrame(this._loop);
  }
}

const BARS = `<div class="bars"><div>${['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'].map(c => `<i style="background:${c}"></i>`).join('')}</div><div>${['#0000c0', '#131313', '#c000c0', '#131313', '#00c0c0', '#131313', '#c0c0c0'].map(c => `<i style="background:${c}"></i>`).join('')}</div><div>${['#00214c', '#fff', '#32006a', '#131313', '#131313', '#131313', '#131313'].map(c => `<i style="background:${c}"></i>`).join('')}</div></div>`;

const STANDBY_ART = `<svg viewBox="0 0 290 260" aria-hidden="true">
  <rect x="45" y="40" width="200" height="160" rx="26" fill="#5b3a29" stroke="#2a160b" stroke-width="6"/>
  <rect x="65" y="58" width="135" height="122" rx="18" fill="#cfe8ff" stroke="#2a160b" stroke-width="5"/>
  <circle cx="222" cy="85" r="9" fill="#2a160b"/><circle cx="222" cy="115" r="9" fill="#2a160b"/>
  <path d="M110 18 L140 42 L170 12" fill="none" stroke="#2a160b" stroke-width="6" stroke-linecap="round"/>
  <circle cx="105" cy="108" r="9" fill="#2a160b"/><circle cx="160" cy="108" r="9" fill="#2a160b"/>
  <path d="M110 150 q22 -16 44 0" fill="none" stroke="#2a160b" stroke-width="6" stroke-linecap="round"/>
  <path d="M178 80 q8 14 0 22 q-8 -8 0 -22z" fill="#5ab4ff"/>
  <rect x="72" y="66" width="44" height="14" rx="4" fill="#fff" stroke="#2a160b" stroke-width="3" transform="rotate(-24 94 73)"/>
  <path d="M70 200 l-14 34 M220 200 l14 34" stroke="#2a160b" stroke-width="8" stroke-linecap="round"/>
  <g transform="translate(232 150) rotate(30)"><rect x="-6" y="0" width="12" height="70" rx="5" fill="#9aa3ad" stroke="#2a160b" stroke-width="4"/><path d="M-18 -4 a18 18 0 1 1 36 0 l-10 0 l0 -14 l-16 0 l0 14z" fill="#9aa3ad" stroke="#2a160b" stroke-width="4"/></g>
</svg>`;

export const cards = {
  offair: ch => BARS + `<div class="cardmsg"><b>OFF THE AIR</b><span>${esc(ch.name)} has no shows right now.<br>Try another channel.</span></div>`,
  loading: ch => BARS + `<div class="cardmsg"><b>PLEASE STAND BY</b><span>Tuning in ${esc(ch.name)}…<br>Getting its shows from YouTube.</span></div>`,
  standby: (title, sub) => `<div class="standby">${STANDBY_ART}<b>${esc(title || 'PLEASE STAND BY')}</b><span>${esc(sub || 'We\'re fixing a little trouble. Back in a moment.')}</span></div>`,
  ident: (ch, nx) => `<div class="ident"><i class="s1"></i><i class="s2"></i><i class="s3"></i><i class="s4"></i><div class="badge"><b>${ch.num}</b><span>${esc(ch.name.toUpperCase())}</span></div>${nx ? `<div class="upnext"><small>UP NEXT</small>${esc(nx.v.title)}</div>` : ''}</div>`,
  vodStart: v => `<div class="vodstart bevel"><small>ON DEMAND</small><b>${esc(v.title)}</b><span>${esc(v.channelTitle || '')}</span><div class="seek"><i></i></div></div>`,
  boot: () => `<div class="boot bevel"><b>CHANNEL SURF</b><span>Loading program guide… please wait.</span><div class="seek"><i></i></div></div>`,
  nochannels: () => BARS + `<div class="cardmsg"><b>NO CHANNELS YET</b><span>Press MENU, then Setup, to add channels.</span></div>`,
  problem: (title, sub) => BARS + `<div class="cardmsg"><b>${esc(title)}</b><span>${esc(sub)}</span></div>`,
};

export const frameClock = t => `${clock(t)}<small>${fmtDay(t)}</small>`;
