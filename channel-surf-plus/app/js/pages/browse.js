// YouTube, inside TV menus: search, results, video details, channels,
// playlists, comments, and "make this a TV channel".
import { app } from '../app.js';
import { S, save, toggleList, inList } from '../store.js';
import { esc, ago, shortNum, lengthText, fmtDate, titleCase, hms } from '../util.js';
import { Sound } from '../sound.js';
import * as L from '../lineup.js';
import { yt, isDemo } from '../source.js';
import { searchesLeft, plain } from '../api.js';
import { Page, ListPage, MessagePage, rows, thumb, avatar, sideVideo, videoMeta, tags } from './base.js';

// ---------------- Search ----------------
const KEYS = ['ABCDEFGHIJ', 'KLMNOPQRST', "UVWXYZ'-&.", '1234567890'];
const WIDE = [['SPACE', 3], ['DELETE', 2], ['CLEAR', 2], ['SEARCH', 3]];
export const SEARCH_FILTERS = [
  ['type', 'What', [['video', 'Videos'], ['channel', 'Channels'], ['playlist', 'Playlists']]],
  ['duration', 'Length', [['any', 'Any length'], ['short', 'Under 4 min'], ['medium', '4 to 20 min'], ['long', 'Over 20 min']]],
  ['date', 'Uploaded', [['any', 'Any time'], ['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['year', 'This year']]],
  ['order', 'Sort by', [['relevance', 'Best match'], ['date', 'Newest'], ['viewCount', 'Most viewed'], ['rating', 'Top rated']]],
  ['captions', 'Captions', [[false, 'Any'], [true, 'With captions']]],
  ['hd', 'Picture', [[false, 'Any'], [true, 'HD only']]],
];
export const defaultSearchFilters = () => ({ type: 'video', duration: 'any', date: 'any', order: 'relevance', captions: false, hd: false });
export function filterLabel(f) {
  return SEARCH_FILTERS.filter(([k]) => f[k] !== defaultSearchFilters()[k]).map(([k, , opts]) => (opts.find(o => o[0] === f[k]) || [, ''])[1]).join(' · ');
}

export class SearchPage extends Page {
  constructor(q = '') { super('Search YouTube'); this.q = q; this.f = defaultSearchFilters(); this.area = 'keys'; this.r = 0; this.c = 0; this.fi = 0; this.ri = 0; this.typed = false; }
  render() {
    const keyRows = KEYS.map((row, r) => `<div class="krow">${[...row].map((ch, c) => `<button type="button" class="key bevel${this.area === 'keys' && this.r === r && this.c === c ? ' sel' : ''}" data-key="${esc(ch)}">${esc(ch)}</button>`).join('')}</div>`).join('');
    let col = 0;
    const wide = `<div class="krow">${WIDE.map(([name, span]) => { const sel = this.area === 'keys' && this.r === 4 && this.c >= col && this.c < col + span; col += span; return `<button type="button" class="key wide bevel${name === 'SEARCH' ? ' go' : ''}${sel ? ' sel' : ''}" style="flex:${span}" data-key="${name}">${name === 'DELETE' ? '⌫ DELETE' : name}</button>`; }).join('')}</div>`;
    const chips = SEARCH_FILTERS.map(([k, label, opts], i) => { const o = opts.find(x => x[0] === this.f[k]) || opts[0]; return `<button type="button" class="chip bevel${this.area === 'filters' && this.fi === i ? ' sel' : ''}${o !== opts[0] ? ' on' : ''}" data-chip="${i}"><small>${label}</small>${esc(o[1])}</button>`; }).join('');
    return `<div class="sbox goldbox"><span class="q">${esc(this.q)}</span><span class="caret"></span>${this.q ? '' : '<span class="ph">Type what you\'re looking for</span>'}</div>
      <div class="kbd">${keyRows}${wide}</div>
      <div class="chips">${chips}</div>`;
  }
  side() {
    const recent = S.recentSearches.slice(0, 5);
    const left = isDemo() ? 'Demo mode: searching the practice shows.' : `About ${searchesLeft()} searches left today (YouTube's free daily limit).`;
    return `${recent.length ? `<b>Recent searches</b><div class="recent">${recent.map((r, i) => `<button type="button" class="rs${this.area === 'recent' && this.ri === i ? ' sel' : ''}" data-recent="${i}">${esc(r.q)}${r.label ? `<small>${esc(r.label)}</small>` : ''}</button>`).join('')}</div>` : '<b>Tip</b><p>A keyboard works too: just start typing, then press Enter.</p>'}<p class="dim">${left}</p>`;
  }
  foot() { return '◀ ▶ ▲ ▼ move · OK press a key · ▼ below the keys for filters · BACK goes back'; }
  afterRender(el) {
    el.querySelectorAll('[data-key]').forEach(b => b.addEventListener('click', () => this.press(b.dataset.key)));
    el.querySelectorAll('[data-chip]').forEach(b => b.addEventListener('click', () => { this.area = 'filters'; this.fi = +b.dataset.chip; this.cycle(1); }));
    el.querySelectorAll('[data-recent]').forEach(b => b.addEventListener('click', () => this.useRecent(+b.dataset.recent)));
  }
  press(key) {
    Sound.beep();
    if (key === 'SPACE') this.q += ' ';
    else if (key === 'DELETE') this.q = this.q.slice(0, -1);
    else if (key === 'CLEAR') this.q = '';
    else if (key === 'SEARCH') return this.go();
    else if (this.q.length < 80) this.q += key.length === 1 ? key.toLowerCase() : key;
    this.rerender();
  }
  keyAt() { if (this.r < 4) return KEYS[this.r][this.c]; let col = 0; for (const [name, span] of WIDE) { if (this.c < col + span) return name; col += span; } return 'SEARCH'; }
  cycle(d) { const [k, , opts] = SEARCH_FILTERS[this.fi]; const i = opts.findIndex(o => o[0] === this.f[k]); this.f[k] = opts[(i + d + opts.length) % opts.length][0]; Sound.beep(); this.rerender(); }
  useRecent(i) { const r = S.recentSearches[i]; if (!r) return; this.q = r.q; this.f = { ...defaultSearchFilters(), ...(r.f || {}) }; this.go(); }
  go() {
    const q = this.q.trim();
    if (!q) { app.screen.toast('message', { text: 'Type something to search for first' }); return; }
    if (!isDemo() && searchesLeft() <= 0) { app.screen.open(new MessagePage('Search', 'YouTube\'s free daily searches are used up. They come back after midnight Pacific time.<br><br>Everything else still works: your channels, the guide, On Demand lists and My Stuff.', [['back', 'OK', () => app.screen.back()]])); return; }
    S.recentSearches = [{ q, f: { ...this.f }, label: filterLabel(this.f) }, ...S.recentSearches.filter(r => !(r.q === q && JSON.stringify(r.f) === JSON.stringify(this.f)))].slice(0, 8); save();
    app.screen.open(new ResultsPage(q, { ...this.f }));
  }
  key(k, raw) {
    // typing on a real keyboard
    if (raw && raw.length === 1 && /[\w '&.\-]/.test(raw)) { if (this.q.length < 80) this.q += raw.toLowerCase(); this.typed = true; this.rerender(); return true; }
    if (raw === 'Backspace') { if (this.q) { this.q = this.q.slice(0, -1); this.rerender(); return true; } return false; }
    if (raw === 'Enter') { this.go(); return true; }
    if (this.area === 'keys') {
      if (k === 'left') { if (this.r === 4) { const c = this.keyCol(); this.c = c > 0 ? this.wideStart(c - 1) : 0; } else this.c = Math.max(0, this.c - 1); }
      else if (k === 'right') { if (this.r === 4) { const c = this.keyCol(); if (c < WIDE.length - 1) this.c = this.wideStart(c + 1); else if (S.recentSearches.length) { this.area = 'recent'; this.ri = 0; } } else if (this.c < 9) this.c++; else if (S.recentSearches.length) { this.area = 'recent'; this.ri = Math.min(this.r, S.recentSearches.length - 1); } }
      else if (k === 'up') { if (this.r > 0) this.r--; }
      else if (k === 'down') { if (this.r < 4) this.r++; else { this.area = 'filters'; this.fi = Math.min(5, Math.floor(this.c / 3.4)); } }
      else if (k === 'ok') { this.press(this.keyAt()); return true; }
      else return false;
    } else if (this.area === 'filters') {
      if (k === 'left') { if (this.fi % 3) this.fi--; }
      else if (k === 'right') { if (this.fi % 3 < 2) this.fi++; }
      else if (k === 'up') { if (this.fi >= 3) this.fi -= 3; else { this.area = 'keys'; this.r = 4; this.c = this.wideStart(Math.min(3, this.fi + 1)); } }
      else if (k === 'down') { if (this.fi < 3) this.fi += 3; }
      else if (k === 'ok') { this.cycle(1); return true; }
      else return false;
    } else if (this.area === 'recent') {
      const n = Math.min(5, S.recentSearches.length);
      if (k === 'up') this.ri = Math.max(0, this.ri - 1);
      else if (k === 'down') this.ri = Math.min(n - 1, this.ri + 1);
      else if (k === 'left') { this.area = 'keys'; this.c = 9; this.r = Math.min(3, this.ri); }
      else if (k === 'ok') { this.useRecent(this.ri); return true; }
      else return false;
    }
    Sound.beep(); this.rerender(); return true;
  }
  keyCol() { let col = 0; for (let i = 0; i < WIDE.length; i++) { if (this.c < col + WIDE[i][1]) return i; col += WIDE[i][1]; } return WIDE.length - 1; }
  wideStart(i) { return WIDE.slice(0, i).reduce((a, w) => a + w[1], 0); }
}

// ---------------- lists of videos (results, popular, topics, my stuff) ----------------
export class VideoListPage extends ListPage {
  constructor(title, loader, opts = {}) {
    super(title); this.loader = loader; this.opts = opts; this.rowH = 112; this.results = [];
    this.empty = opts.empty || 'Nothing found.'; this.emptyHint = opts.emptyHint || '';
    if (opts.crumb) this.crumb = opts.crumb;
  }
  onShow() { if (!this.loaded) { this.loaded = true; this.load(async () => { this.results = (await this.loader()) || []; this.build(); }); } }
  videos() { return this.results.filter(x => !x.kind || x.kind === 'video'); }
  build() {
    const vids = this.videos(), items = [];
    const mc = this.opts.makeChannel;
    if (mc && S.viewer.makeChannels && vids.length) items.push({ cls: 'act', html: rows.action('tv', 'Make this a TV channel', 'A channel that always plays shows like these'), act: () => app.screen.open(new MakeChannelPage(mc)), side: () => '<b>Make a TV channel</b><p>Turns this list into a numbered channel in your lineup. It refreshes by itself once a day.</p>' });
    if (vids.length > 1 && !this.opts.live) items.push({ cls: 'act', html: rows.action('play', 'Play all', vids.length + ' videos, one after another'), act: () => app.tv.playVod(vids[0], { queue: vids }), side: () => '<b>Play all</b><p>Plays the list in order. CH ▲ skips to the next one.</p>' });
    for (const x of this.results) {
      if (x.kind === 'channel') items.push({ html: rows.channel(x), act: () => app.screen.open(new ChannelPage(x)), side: () => `<b>${esc(x.title)}</b><p>${esc((x.desc || '').slice(0, 200))}</p>` });
      else if (x.kind === 'playlist') items.push({ html: rows.playlist(x), act: () => app.screen.open(new PlaylistPage(x)), side: () => `<b>${esc(x.title)}</b><p>Playlist by ${esc(x.channelTitle || '')}</p>` });
      else {
        const h = this.opts.history && S.history.find(y => y.id === x.id);
        const extra = h && h.pos && x.dur ? `<span class="watched"><i style="width:${Math.min(100, h.pos / x.dur * 100)}%"></i></span>` : '';
        items.push({ html: rows.video(x) + extra, act: () => app.screen.open(new VideoPage(x, { queue: vids })), side: () => sideVideo(x) });
      }
    }
    if (this.next) items.push({ cls: 'act', html: rows.action('plus', 'More results', isDemo() ? '' : 'Uses one more search'), act: () => this.more() });
    this.items = items;
  }
  async more() {
    const extra = await this.nextLoader(this.next).catch(e => { this.error = e; return null; });
    if (extra) { this.results.push(...extra.items); this.next = extra.next; this.build(); }
    this.rerender();
  }
  foot() { return '▲ ▼ choose · ◀ ▶ page · OK open · BACK goes back · EXIT closes'; }
}

export class ResultsPage extends VideoListPage {
  constructor(q, f) {
    super('Search: ' + q, null, { empty: 'No results for "' + q + '".', emptyHint: 'Try fewer words, or change the filters.' });
    this.q = q; this.f = f; this.crumb = filterLabel(f);
    if (f.type === 'video') this.opts.makeChannel = { type: 'search', q, f: { duration: f.duration, date: f.date, order: f.order, captions: f.captions, hd: f.hd }, title: titleCase(q) };
    this.loader = async () => { const r = await yt.search({ q, ...f }); this.next = r.next; return r.items; };
    this.nextLoader = token => yt.search({ q, ...f, pageToken: token });
  }
}

// ---------------- one video ----------------
export class VideoPage extends ListPage {
  constructor(v, ctx = {}) { super('Video'); this.v = v; this.ctx = ctx; this.rowH = 70; this.headH = 300; this.build(); }
  onShow() {
    // fill in anything missing (likes, length) from YouTube; cached, 1 unit at most
    if (!this.v.fake && (this.v.dur == null || this.v.likes === undefined)) yt.videosInfo([this.v.id]).then(([full]) => { if (full) { this.v = full; this.build(); this.rerender(); } }).catch(() => {});
  }
  onReturn() { this.build(); }
  head() {
    const v = this.v;
    return `<div class="vhead">${thumb(v, true)}<div class="vinfo"><b>${esc(v.title)}</b><small>${esc(v.channelTitle || '')}</small>
      <small>${v.live === 'live' ? '<b class="red">LIVE NOW</b>' : v.publishedAt ? fmtDate(v.publishedAt) + ' · ' + ago(v.publishedAt) : ''}</small>
      <small>${[v.dur ? lengthText(v.dur) : '', v.views ? shortNum(v.views) + ' views' : '', v.likes ? shortNum(v.likes) + ' likes' : ''].filter(Boolean).join(' · ')}</small><span class="tags">${tags(v)}</span></div></div>`;
  }
  build() {
    const v = this.v, tv = app.tv;
    const h = S.history.find(x => x.id === v.id);
    const resume = h && h.pos > 30 && (!v.dur || h.pos < v.dur - 30);
    const playingNow = tv.source === 'vod' && tv.vod && tv.vod.v.id === v.id;
    const queue = this.ctx.queue || [v];
    const it = [];
    if (playingNow) it.push(['film', 'Back to the video', 'It\'s playing in the window', () => app.screen.closePages()]);
    else it.push(['play', resume ? 'Resume at ' + hms(h.pos) : 'Watch now', resume ? 'Pick up where you left off' : v.dur ? lengthText(v.dur) : 'Live', () => tv.playVod(v, { queue })]);
    if (resume && !playingNow) it.push(['back', 'Watch from the start', '', () => tv.playVod(v, { queue, start: 0 })]);
    if (playingNow) it.push(['clock', 'Playback speed', 'Now ' + tv.speed + '×', () => app.screen.open(new SpeedPage())]);
    it.push(['plus', inList('watchLater', v.id) ? 'Remove from Watch Later' : 'Save to Watch Later', 'Saved on this TV only', () => { toggleList('watchLater', v); this.build(); this.rerender(); }]);
    it.push(['heart', inList('liked', v.id) ? 'Unlike' : 'Like', 'Kept in My Stuff on this TV', () => { toggleList('liked', v); this.build(); this.rerender(); }]);
    if (v.channelId) it.push(['people', 'Go to ' + (v.channelTitle || 'the channel'), 'Its videos and playlists', () => app.screen.open(new ChannelPage({ id: v.channelId, title: v.channelTitle }))]);
    if (v.comments !== 0) it.push(['chat', 'Comments' + (v.comments ? ' (' + shortNum(v.comments) + ')' : ''), 'What people are saying', () => app.screen.open(new CommentsPage(v))]);
    it.push(['grid', 'Full description', '', () => app.screen.open(new TextPage('Description', v))]);
    if (v.channelId && S.viewer.makeChannels) it.push(['tv', 'Make a TV channel from ' + (v.channelTitle || 'this channel'), 'Its newest videos, on a schedule', () => app.screen.open(new MakeChannelPage({ type: 'channel', id: v.channelId, title: v.channelTitle || 'New Channel' }))]);
    this.items = it.map(([icon, label, hint, act]) => ({ html: rows.action(icon, label, hint), act }));
    this.sideText = sideVideo(v);
  }
}

export class SpeedPage extends ListPage {
  constructor() {
    super('Playback speed'); this.rowH = 70;
    const tv = app.tv;
    this.items = tv.player.rates().map(r => ({ html: rows.menu('clock', r === 1 ? 'Normal speed' : r + '×', r < 1 ? 'Slower' : r > 1 ? 'Faster' : '', tv.speed === r ? 'Now' : null), act: () => { tv.setSpeed(r); app.screen.back(); app.screen.toast('message', { text: 'Speed ' + (r === 1 ? 'normal' : r + '×') }); } }));
  }
}

export class TextPage extends Page {
  constructor(title, v) { super(title); this.v = v; this.text = v.desc || ''; this.scroll = 0; }
  onShow() { yt.fullDescription(this.v.id).then(t => { if (t) { this.text = t; this.rerender(); } }).catch(() => {}); }
  render() { return `<div class="textpage bevel"><b>${esc(this.v.title)}</b><div class="tp" style="transform:translateY(${-this.scroll}px)">${esc(this.text || 'No description.').replace(/\n/g, '<br>')}</div></div>`; }
  side() { return sideVideo(this.v); }
  key(k) { if (k === 'down') { this.scroll += 140; this.rerender(); return true; } if (k === 'up') { this.scroll = Math.max(0, this.scroll - 140); this.rerender(); return true; } return false; }
  foot() { return '▲ ▼ scroll · BACK goes back'; }
}

export class CommentsPage extends ListPage {
  constructor(v) { super('Comments'); this.v = v; this.rowH = 150; this.order = 'relevance'; this.crumb = v.title; this.sideText = sideVideo(v); }
  onShow() { this.fetch(); }
  fetch() {
    this.load(async () => {
      try {
        const list = await yt.comments(this.v.id, this.order);
        this.items = [{ cls: 'act', html: rows.action('filter', 'Sorted by: ' + (this.order === 'time' ? 'Newest first' : 'Top comments'), 'OK to switch'), act: () => { this.order = this.order === 'time' ? 'relevance' : 'time'; this.fetch(); } },
          ...list.map(c => ({ cls: 'comment', html: `<div class="rt"><small><b>${esc(c.author)}</b> · ${ago(c.at)}${c.likes ? ' · ♥ ' + shortNum(c.likes) : ''}${c.replies ? ' · ' + c.replies + ' replies' : ''}</small><p>${esc(c.text)}</p></div>` }))];
        if (list.length === 0) this.empty = 'No comments yet.';
      } catch (e) { if (e.kind === 'commentsDisabled') { this.items = []; this.empty = 'Comments are turned off for this video.'; } else throw e; }
    });
  }
}

// ---------------- a YouTube channel ----------------
export class ChannelPage extends ListPage {
  constructor(c) { super('Channel'); this.c = c; this.rowH = 104; this.headH = 210; this.vids = []; this.items = []; }
  onShow() {
    this.build();
    this.load(async () => {
      if (this.c.subs === undefined || !this.c.desc) { const [full] = await yt.channelsInfo([this.c.id]); if (full) this.c = { ...this.c, ...full }; }
      this.vids = await yt.channelVideos(this.c.id, 25);
      this.build();
    });
  }
  onReturn() { this.build(); }
  head() { const c = this.c; return `<div class="chead">${avatar(c)}<div class="vinfo"><b>${esc(c.title || '')}</b><small>${[c.handle, c.subs != null ? shortNum(c.subs) + ' subscribers' : '', c.videos ? shortNum(c.videos) + ' videos' : ''].filter(Boolean).map(esc).join(' · ')}</small><p>${esc((c.desc || '').slice(0, 220))}</p></div></div>`; }
  build() {
    const c = this.c, followed = S.follows.some(f => f.id === c.id);
    const inLineup = L.channels().find(ch => ch.sources && ch.sources.length === 1 && ch.sources[0].type === 'channel' && ch.sources[0].id === c.id);
    const it = [
      { cls: 'act', html: rows.action('people', followed ? 'Following ✓ (OK to unfollow)' : 'Follow this channel', 'Its new videos show up in On Demand'), act: () => { if (followed) S.follows = S.follows.filter(f => f.id !== c.id); else S.follows.unshift({ id: c.id, title: c.title, thumb: c.thumb || '', hue: c.hue }); save(); this.build(); this.rerender(); } },
    ];
    if (inLineup) it.push({ cls: 'act', html: rows.action('tv', 'Watch it on channel ' + inLineup.num, 'It\'s already in your lineup'), act: () => app.tv.tune(app.tv.list.indexOf(inLineup)) });
    else if (S.viewer.makeChannels) it.push({ cls: 'act', html: rows.action('tv', 'Make it a TV channel', 'Its videos, on a schedule, like real TV'), act: () => app.screen.open(new MakeChannelPage({ type: 'channel', id: c.id, title: c.title })) });
    it.push({ cls: 'act', html: rows.action('grid', 'Playlists', ''), act: () => app.screen.open(new VideoListPage(c.title + ': Playlists', () => yt.channelPlaylists(c.id), { empty: 'No playlists.' })) });
    if (this.vids.length > 1) it.push({ cls: 'act', html: rows.action('play', 'Play newest videos', this.vids.length + ' videos'), act: () => app.tv.playVod(this.vids[0], { queue: this.vids }) });
    this.vids.forEach(v => it.push({ html: rows.video(v), act: () => app.screen.open(new VideoPage(v, { queue: this.vids })), side: () => sideVideo(v) }));
    this.items = it;
  }
  render() { if (this.loading && !this.items.length) return super.render(); const l = this.loading; this.loading = false; const out = super.render(); this.loading = l; return out; }
}

export class PlaylistPage extends ListPage {
  constructor(p) { super('Playlist'); this.p = p; this.rowH = 104; this.headH = 170; this.vids = []; }
  onShow() { this.build(); this.load(async () => { this.vids = await yt.playlistVideos(this.p.id); this.build(); }); }
  head() { const p = this.p; return `<div class="chead">${thumb({ ...p, dur: 0 })}<div class="vinfo"><b>${esc(p.title)}</b><small>${esc(p.channelTitle || '')}${p.count ? ' · ' + p.count + ' videos' : ''}</small></div></div>`; }
  build() {
    const p = this.p, it = [];
    if (this.vids.length) it.push({ cls: 'act', html: rows.action('play', 'Play all', this.vids.length + ' videos in order'), act: () => app.tv.playVod(this.vids[0], { queue: this.vids }) });
    if (S.viewer.makeChannels) it.push({ cls: 'act', html: rows.action('tv', 'Make it a TV channel', 'This playlist, on a schedule'), act: () => app.screen.open(new MakeChannelPage({ type: 'playlist', id: p.id, title: p.title })) });
    this.vids.forEach(v => it.push({ html: rows.video(v), act: () => app.screen.open(new VideoPage(v, { queue: this.vids })), side: () => sideVideo(v) }));
    this.items = it;
  }
  render() { if (this.loading && !this.items.length) return super.render(); const l = this.loading; this.loading = false; const out = super.render(); this.loading = l; return out; }
}

// ---------------- make a TV channel ----------------
const KIND = { search: 'Shows matching a search', channel: 'A YouTube channel\'s videos', playlist: 'A YouTube playlist', topic: 'Popular videos in a topic', trending: 'What\'s popular on YouTube' };
export class MakeChannelPage extends ListPage {
  constructor(src) {
    super('Make a TV Channel'); this.src = src; this.rowH = 86; this.headH = 170;
    this.name = (src.title || 'My Channel').slice(0, 30); this.f = { length: 'any', age: 'any', captions: false }; this.build();
  }
  head() { return `<div class="msgbox bevel"><b>New channel ${L.nextFreeNum()}: ${esc(this.name)}</b><br><span class="dim">${esc(KIND[this.src.type] || '')}. It refreshes once a day, all by itself. You can rename it or change its number in Setup.</span></div>`; }
  build() {
    const LEN = L.FILTER_CHOICES.length, AGE = L.FILTER_CHOICES.age, lbl = (l, v) => (l.find(x => x[0] === v) || l[0])[1];
    const cyc = (k, l) => () => { const i = l.findIndex(x => x[0] === this.f[k]); this.f[k] = l[(i + 1) % l.length][0]; this.build(); this.rerender(); };
    this.items = [
      { cls: 'act go', html: rows.action('tv', 'Create channel ' + L.nextFreeNum(), 'Add it to the lineup now'), act: () => this.create() },
      { html: rows.menu('clock', 'Show length', 'OK to change', lbl(LEN, this.f.length)), act: cyc('length', LEN) },
      { html: rows.menu('fire', 'How new', 'OK to change', lbl(AGE, this.f.age)), act: cyc('age', AGE) },
      { html: rows.menu('chat', 'Captions only', 'OK to change', this.f.captions ? 'On' : 'Off'), act: () => { this.f.captions = !this.f.captions; this.build(); this.rerender(); } },
      { html: rows.action('back', 'Cancel', ''), act: () => app.screen.back() },
    ];
  }
  create() {
    const src = { ...this.src }; delete src.title; src.title = this.src.title;
    const ch = L.addChannel({ name: this.name, sources: [src], filters: { ...this.f } });
    app.tv.refreshList();
    app.screen.replace(new MessagePage('Channel Added', `<b>Channel ${ch.num}, ${esc(ch.name)}, is in your lineup.</b><br><span class="dim">It's getting its shows from YouTube now. It'll also show up in the guide.</span>`, [
      ['tv', 'Watch channel ' + ch.num + ' now', () => app.tv.tune(app.tv.list.findIndex(c => c.id === ch.id))],
      ['back', 'Keep browsing', () => app.screen.back()],
    ]));
  }
}
export { plain };
