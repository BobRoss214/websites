// Your YouTube account, inside the TV menus: subscriptions, your playlists,
// YouTube likes, and writing comments and replies. All optional: these only
// appear once someone signs in from Setup, and everything done here really
// happens on YouTube. Also the on-screen keyboard used for typing text.
import { app } from '../app.js';
import { S, toggleList, inList } from '../store.js';
import { esc, ago, shortNum } from '../util.js';
import { Sound } from '../sound.js';
import { yt } from '../source.js';
import { plain } from '../api.js';
import { account } from '../account.js';
import { Page, ListPage, MessagePage, rows, sideVideo } from './base.js';

const P = () => app.pages;
export const canUseAccount = () => account.signedIn && S.viewer.account !== false;
const toast = text => app.screen.toast('message', { text });
// a YouTube change that didn't go through: say why, in plain words
function failed(e, what) {
  console.warn(e);
  if (e.kind === 'signedOut') { account.signedIn = false; return toast('Signed out of YouTube. Sign in again in Setup.'); }
  if (e.kind === 'scope') return toast('YouTube needs you to sign in again (Setup → YouTube connection).');
  toast(what + ' didn\'t work: ' + plain(e));
}

// ---------------- the on-screen keyboard ----------------
const TKEYS = ['ABCDEFGHIJ', 'KLMNOPQRST', 'UVWXYZ.,?!', '1234567890'];
const TWIDE = [['SHIFT', 2], ['SPACE', 3], ['DELETE', 2], ['DONE', 3]];
export class TextEntryPage extends Page {
  // opts: { prompt, initial, max, doneLabel, onDone(text), sideText }
  constructor(title, opts = {}) {
    super(title); this.o = opts; this.text = opts.initial || ''; this.max = opts.max || 500;
    this.r = 0; this.c = 0; this.shift = false;
  }
  // capital letters at the start of a sentence, like a phone does; SHIFT flips the next letter
  upperNext() { const auto = !this.text.trim() || /[.?!]\s+$/.test(this.text); return this.shift ? !auto : auto; }
  render() {
    const up = this.upperNext(), lab = ch => /[A-Z]/.test(ch) && !up ? ch.toLowerCase() : ch;
    const keyRows = TKEYS.map((row, r) => `<div class="krow">${[...row].map((ch, c) => `<button type="button" class="key bevel${this.r === r && this.c === c ? ' sel' : ''}" data-key="${esc(ch)}">${esc(lab(ch))}</button>`).join('')}</div>`).join('');
    let col = 0;
    const wide = `<div class="krow">${TWIDE.map(([name, span]) => { const sel = this.r === 4 && this.c >= col && this.c < col + span; col += span; const label = name === 'DELETE' ? '⌫ DELETE' : name === 'DONE' ? (this.o.doneLabel || 'DONE') : name === 'SHIFT' ? (up ? 'abc' : 'ABC') : name; return `<button type="button" class="key wide bevel${name === 'DONE' ? ' go' : ''}${this.shift && name === 'SHIFT' ? ' on' : ''}${sel ? ' sel' : ''}" style="flex:${span}" data-key="${name}">${esc(label)}</button>`; }).join('')}</div>`;
    const shown = this.text.length > 260 ? '…' + this.text.slice(-260) : this.text;
    return `${this.o.prompt ? `<p class="tprompt">${esc(this.o.prompt)}</p>` : ''}<div class="sbox goldbox tbox"><span class="q">${esc(shown)}</span><span class="caret"></span>${this.text ? '' : '<span class="ph">Start typing</span>'}</div>
      <div class="tcount dim">${this.text.length} of ${this.max} letters</div><div class="kbd">${keyRows}${wide}</div>`;
  }
  side() { return this.o.sideText || '<b>Typing</b><p>Use the arrows and OK, or a real keyboard. Press DONE when you\'re finished.</p>'; }
  foot() { return '◀ ▶ ▲ ▼ move · OK press a key · BACK goes back without saving'; }
  afterRender(el) { el.querySelectorAll('[data-key]').forEach(b => b.addEventListener('click', () => this.press(b.dataset.key))); }
  add(s) { if (this.text.length + s.length <= this.max) this.text += s; this.shift = false; }
  press(key) {
    Sound.beep();
    if (key === 'SPACE') this.add(' ');
    else if (key === 'DELETE') this.text = this.text.slice(0, -1);
    else if (key === 'SHIFT') this.shift = !this.shift;
    else if (key === 'DONE') return this.finish();
    else this.add(/[A-Z]/.test(key) && !this.upperNext() ? key.toLowerCase() : key);
    this.rerender();
  }
  finish() {
    const t = this.text.trim();
    if (!t && !this.o.allowEmpty) { toast('Type something first'); return; }
    this.o.onDone(t);
  }
  keyAt() { if (this.r < 4) return TKEYS[this.r][this.c]; let col = 0; for (const [name, span] of TWIDE) { if (this.c < col + span) return name; col += span; } return 'DONE'; }
  keyCol() { let col = 0; for (let i = 0; i < TWIDE.length; i++) { if (this.c < col + TWIDE[i][1]) return i; col += TWIDE[i][1]; } return TWIDE.length - 1; }
  wideStart(i) { return TWIDE.slice(0, i).reduce((a, w) => a + w[1], 0); }
  key(k, raw) {
    // a real keyboard types exactly what's pressed
    if (raw && raw.length === 1) { this.add(raw); this.typed = true; this.rerender(); return true; }
    if (raw === 'Backspace') { if (this.text) { this.text = this.text.slice(0, -1); this.rerender(); return true; } return false; }
    // a remote's OK button sends Enter too: Enter only finishes straight after typing on a real keyboard
    if (raw === 'Enter' && this.typed) { this.finish(); return true; }
    if (k !== 'ok') this.typed = false;
    if (k === 'left') { if (this.r === 4) { const c = this.keyCol(); this.c = c > 0 ? this.wideStart(c - 1) : 0; } else this.c = Math.max(0, this.c - 1); }
    else if (k === 'right') { if (this.r === 4) { const c = this.keyCol(); if (c < TWIDE.length - 1) this.c = this.wideStart(c + 1); } else this.c = Math.min(9, this.c + 1); }
    else if (k === 'up') { if (this.r > 0) this.r--; }
    else if (k === 'down') { if (this.r < 4) this.r++; }
    else if (k === 'ok') { this.press(this.keyAt()); return true; }
    else return false;
    Sound.beep(); this.rerender(); return true;
  }
}

// ---------------- writing a comment or a reply ----------------
// type it, then check it before it goes on YouTube for everyone to see
export function writeComment({ title, prompt, parent, videoId, onPosted }) {
  const ask = initial => app.screen.open(new TextEntryPage(title, {
    prompt, initial, max: 1000, doneLabel: 'NEXT',
    sideText: '<b>This goes on YouTube</b><p>Comments are public. Everyone who watches the video can read them, with your YouTube name next to it.</p>',
    onDone: text => app.screen.replace(new MessagePage(title, `<b>Post this on YouTube as ${esc(account.name || 'you')}?</b><p class="quote">${esc(text)}</p><span class="dim">Everyone can read it.</span>`, [
      ['chat', 'Post it', async () => {
        try {
          const c = parent ? await yt.reply(parent.id, text) : await yt.postComment(videoId, text);
          app.screen.back(); toast(parent ? 'Your reply is posted' : 'Your comment is posted'); if (onPosted) onPosted(c);
        } catch (e) { failed(e, 'Posting'); }
      }],
      ['back', 'Change it', () => { app.screen.back(); ask(text); }],
      ['back', 'Don\'t post it', () => app.screen.back()],
    ])),
  }));
  if (!canUseAccount()) return app.screen.open(signInFirst());
  ask('');
}

export function signInFirst() {
  return new MessagePage('Your YouTube', account.configured
    ? 'This needs you to be signed in to YouTube.<br><br>Signing in is done once in <b>Setup → YouTube connection</b>.'
    : 'Likes, subscriptions, playlists and comments can go to your real YouTube account.<br><br>That gets switched on once, in <b>Setup → YouTube connection</b>. The steps are in HOW-TO.md, "Sign in to YouTube".', [['back', 'OK', () => app.screen.back()]]);
}

// ---------------- the "Your YouTube" menu ----------------
export class YourYouTubePage extends ListPage {
  constructor() { super('Your YouTube'); this.rowH = 92; this.build(); }
  onReturn() { this.build(); }
  build() {
    const VL = P().VideoListPage;
    this.items = [
      ['people', 'Your Subscriptions', 'The channels you subscribe to on YouTube', () => app.screen.open(new SubscriptionsPage())],
      ['fire', 'New From Your Subscriptions', 'The latest videos from them, newest first', () => app.screen.open(new VL('New From Your Subscriptions', newFromSubs, { empty: 'Nothing new from your subscriptions.', emptyHint: 'Subscribe to channels and their new videos show up here.' }))],
      ['grid', 'Your Playlists', 'Make playlists and add videos to them', () => app.screen.open(new MyPlaylistsPage())],
      ['heart', 'Videos You Liked', 'Your likes on YouTube', () => app.screen.open(new VL('Videos You Liked', () => yt.myLiked(), { empty: 'No liked videos yet.', emptyHint: 'On any video, choose "Like on YouTube".' }))],
      S.viewer.makeChannels && ['tv', 'Make a TV Channel From Your Subscriptions', 'They take turns on one channel, like a real network', () => makeFromSubs()],
    ].filter(Boolean).map(([icon, label, hint, act]) => ({ html: rows.menu(icon, label, hint), act, side: () => `<b>${esc(label)}</b><p>${esc(hint)}.</p>` }));
    this.crumb = 'Signed in as ' + (account.name || 'you');
    this.sideText = 'Likes, subscriptions, playlists and comments you make here really happen on YouTube.';
  }
}
async function newFromSubs() {
  const subs = await yt.mySubscriptions(60), out = [];
  for (const c of subs.slice(0, 30)) { try { out.push(...(await yt.channelVideos(c.id, 6))); } catch (e) { if (e.kind === 'quota') break; } }
  return out.filter(v => v.live !== 'upcoming').sort((a, b) => b.publishedAt - a.publishedAt).slice(0, 60);
}
async function makeFromSubs() {
  try {
    const subs = await yt.mySubscriptions(200);
    if (!subs.length) return toast('You don\'t have any subscriptions yet');
    const picked = subs.slice(0, 25);
    app.screen.open(new (P().MakeChannelPage)({ title: 'My Subscriptions', sources: picked.map(c => ({ type: 'channel', id: c.id, title: c.title })) }));
  } catch (e) { failed(e, 'Getting your subscriptions'); }
}

export class SubscriptionsPage extends ListPage {
  constructor() { super('Your Subscriptions'); this.rowH = 100; this.empty = 'You don\'t subscribe to any channels yet.'; this.emptyHint = 'Open any channel and choose "Subscribe".'; }
  onShow() { if (!this.loaded) { this.loaded = true; this.fetch(); } }
  onReturn() { this.fetch(); }
  fetch() {
    this.load(async () => {
      const subs = await yt.mySubscriptions();
      this.items = subs.map(c => ({ html: rows.channel({ ...c, subs: undefined, videos: 0 }), act: () => app.screen.open(new (P().ChannelPage)(c)), side: () => `<b>${esc(c.title)}</b><p>${esc((c.desc || '').slice(0, 200))}</p>` }));
      this.crumb = subs.length + ' channels';
    });
  }
}

export class MyPlaylistsPage extends ListPage {
  constructor() { super('Your Playlists'); this.rowH = 100; }
  onShow() { if (!this.loaded) { this.loaded = true; this.fetch(); } }
  onReturn() { this.fetch(); }
  fetch() {
    this.load(async () => {
      const lists = (await yt.myPlaylists()).map(p => ({ ...p, mine: true }));
      this.items = [{ cls: 'act', html: rows.action('plus', 'Make a new playlist', 'Private: only you can see it'), act: () => newPlaylist(() => this.fetch()) },
        ...lists.map(p => ({ html: rows.playlist(p), act: () => app.screen.open(new (P().PlaylistPage)(p)), side: () => `<b>${esc(p.title)}</b><p>${p.count} videos${p.privacy ? ' · ' + esc(p.privacy) : ''}</p>` }))];
    });
  }
}
function newPlaylist(then) {
  app.screen.open(new TextEntryPage('New Playlist', {
    prompt: 'Name the playlist', max: 100, doneLabel: 'MAKE IT',
    onDone: async name => {
      try { const p = await yt.createPlaylist(name); app.screen.back(); toast('Made the playlist "' + name + '"'); then && then(p); }
      catch (e) { failed(e, 'Making the playlist'); }
    },
  }));
}

// pick one of your playlists to put a video in
export class SaveToPlaylistPage extends ListPage {
  constructor(v) { super('Save to a Playlist'); this.v = v; this.rowH = 90; this.crumb = v.title; this.sideText = sideVideo(v); }
  onShow() { if (!this.loaded) { this.loaded = true; this.fetch(); } }
  fetch() {
    this.load(async () => {
      const lists = await yt.myPlaylists();
      this.items = [{ cls: 'act', html: rows.action('plus', 'New playlist…', 'Make one and put this video in it'), act: () => newPlaylist(p => this.add(p)) },
        ...lists.map(p => ({ html: rows.menu('grid', p.title, p.count + ' videos'), act: () => this.add(p) }))];
    });
  }
  async add(p) {
    try { await yt.addToPlaylist(p.id, this.v.id); app.screen.back(); toast('Saved to "' + p.title + '"'); }
    catch (e) { failed(e, 'Saving'); }
  }
}

// ---------------- likes and subscriptions on a video or channel ----------------
// Remembers what YouTube said about this video and channel, so moving around
// the menus doesn't ask again every time.
const rated = new Map(), subbed = new Map();
export async function lookUp(v) {
  if (!canUseAccount()) return;
  const jobs = [];
  if (v.id && !rated.has(v.id)) jobs.push(yt.getRating(v.id).then(r => rated.set(v.id, r)));
  if (v.channelId && !subbed.has(v.channelId)) jobs.push(yt.subscription(v.channelId).then(s => subbed.set(v.channelId, s)));
  await Promise.all(jobs).catch(quiet);
}
export async function lookUpChannel(id) { if (canUseAccount() && !subbed.has(id)) await yt.subscription(id).then(s => subbed.set(id, s)).catch(quiet); }
// looking things up in the background: only speak up if the sign-in stopped working
const quiet = e => { if (e.kind === 'signedOut') failed(e); else console.warn(e); };
export const ratingOf = id => rated.get(id);
export const subOf = id => subbed.get(id);

export async function setRating(v, rating, then) {
  const before = rated.get(v.id) || 'none';
  const next = before === rating ? 'none' : rating;
  try {
    await yt.rate(v.id, next); rated.set(v.id, next);
    // mirror likes into My Stuff on this TV too
    if ((next === 'like') !== inList('liked', v.id)) toggleList('liked', v);
    toast(next === 'like' ? 'Liked on YouTube' : next === 'dislike' ? 'Disliked on YouTube' : 'Rating taken off');
  } catch (e) { failed(e, 'That'); }
  then && then();
}
export function toggleSub(c, then) {
  const id = c.id || c.channelId, title = c.title || c.channelTitle || 'this channel';
  const subId = subbed.get(id);
  const doSub = async () => {
    try { subbed.set(id, await yt.subscribe(id)); toast('Subscribed to ' + title); }
    catch (e) { failed(e, 'Subscribing'); }
    then && then();
  };
  if (!subId) return doSub();
  app.screen.open(new MessagePage('Unsubscribe?', `<b>Unsubscribe from ${esc(title)}?</b><br><span class="dim">You can subscribe again any time.</span>`, [
    ['people', 'Yes, unsubscribe', async () => { try { await yt.unsubscribe(subId); subbed.set(id, null); app.screen.back(); toast('Unsubscribed from ' + title); } catch (e) { failed(e, 'Unsubscribing'); } then && then(); }],
    ['back', 'No, stay subscribed', () => app.screen.back()],
  ]));
}

// ---------------- replies to one comment ----------------
export class RepliesPage extends ListPage {
  constructor(v, c) { super('Replies'); this.v = v; this.c = c; this.rowH = 130; this.headH = 210; this.crumb = v.title; this.sideText = sideVideo(v); }
  onShow() { if (!this.loaded) { this.loaded = true; this.fetch(); } }
  head() { const c = this.c; return `<div class="msgbox bevel comment-top"><b>${esc(c.author)}</b> <span class="dim">${ago(c.at)}${c.likes ? ' · ♥ ' + shortNum(c.likes) : ''}</span><p>${esc(c.text.length > 300 ? c.text.slice(0, 300) + '…' : c.text)}</p></div>`; }
  fetch() {
    this.load(async () => {
      const list = this.c.replies ? await yt.replies(this.c.id) : [];
      const write = canUseAccount() && this.c.canReply !== false && S.viewer.comments !== false;
      this.items = [
        ...(write ? [{ cls: 'act', html: rows.action('chat', 'Write a reply', 'As ' + (account.name || 'you') + ', on YouTube'), act: () => writeComment({ title: 'Reply', prompt: 'Your reply to ' + this.c.author, parent: this.c, onPosted: r => { this.c.replies = (this.c.replies || 0) + 1; this.showNew(r); } }) }] : []),
        ...list.map(r => ({ cls: 'comment', html: `<div class="rt"><b>${esc(r.author)}</b><small>${ago(r.at)}${r.likes ? ' · ♥ ' + shortNum(r.likes) : ''}</small><p>${esc(r.text)}</p></div>` })),
      ];
      this.empty = 'No replies yet.';
    });
  }
  // YouTube can take a moment to list a new reply, so show it right away
  showNew(r) { this.items.push({ cls: 'comment', html: `<div class="rt"><b>${esc(r.author || account.name || 'You')}</b><small>just now</small><p>${esc(r.text)}</p></div>` }); this.sel = this.items.length - 1; this.rerender(); }
}

