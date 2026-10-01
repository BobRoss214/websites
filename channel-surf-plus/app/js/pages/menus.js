// The main menu and its simpler screens: On Demand, Topics, My Stuff,
// favorites, lineup filters, settings, and the Setup PIN.
import { app } from '../app.js';
import { S, save } from '../store.js';
import { esc } from '../util.js';
import { Sound } from '../sound.js';
import * as L from '../lineup.js';
import { yt, isDemo } from '../source.js';
import { searchesLeft } from '../api.js';
import { ListPage, Page, rows, sideVideo, MessagePage, ICON } from './base.js';
import { canUseAccount } from './youtube.js';
import { account } from '../account.js';

const P = () => app.pages;

export class MainMenu extends ListPage {
  constructor() {
    super('Main Menu'); this.rowH = 92;
    const tv = app.tv, ch = tv.ch, v = S.viewer;
    const items = [
      ['tv', tv.source === 'vod' ? 'Back to Live TV' : 'Watch TV', tv.source === 'vod' ? 'Go back to channel ' + ch.num : 'Channel ' + ch.num + ' · ' + ch.name, () => tv.source === 'vod' ? tv.goLive() : app.screen.closePages()],
      ['grid', 'Program Guide', 'What\'s on now and for the next 3 hours', () => tv.press('guide')],
      v.search && ['search', 'Search YouTube', 'Find shows, channels and playlists' + (isDemo() ? '' : ' · ' + searchesLeft() + ' searches left today'), () => app.screen.open(new (P().SearchPage)())],
      v.ondemand && ['film', 'On Demand', 'Popular now, topics, live right now', () => app.screen.open(new OnDemandPage())],
      v.ondemand && ['box', 'My Stuff', 'Watch later, history, favorites, followed', () => app.screen.open(new MyStuffPage())],
      v.ondemand && canUseAccount() && ['yt', 'Your YouTube', 'Subscriptions, your playlists, likes · ' + (account.name || 'signed in'), () => app.screen.open(new (P().YourYouTubePage)())],
      !v.ondemand && ['star', 'Favorite Channels', 'Jump to a favorite', () => app.screen.open(new FavChannelsPage())],
      ['filter', 'Lineup Filters', filterSummary(), () => app.screen.open(new FiltersPage())],
      ['gear', 'Settings', 'Captions, bigger text, static, sounds', () => app.screen.open(new SettingsPage())],
      ['lock', 'Setup', 'Add channels, numbers, YouTube key (PIN)', () => app.screen.open(new PinPage())],
    ].filter(Boolean);
    this.items = items.map(([icon, label, hint, act]) => ({ html: rows.menu(icon, label, hint), act, side: () => `<b>${esc(label)}</b><p>${esc(hint)}</p>` }));
  }
  foot() { return '▲ ▼ choose · OK select · MENU or EXIT closes'; }
}

export function filterSummary() {
  const f = S.filters, out = [];
  const L1 = Object.fromEntries(L.FILTER_CHOICES.length), A1 = Object.fromEntries(L.FILTER_CHOICES.age);
  if (f.length !== 'any') out.push(L1[f.length]); if (f.age !== 'any') out.push(A1[f.age]); if (f.captions) out.push('captions only');
  return out.length ? 'Now showing: ' + out.join(', ') : 'Every channel shows everything';
}

export class OnDemandPage extends ListPage {
  constructor() {
    super('On Demand'); this.rowH = 92;
    const VL = P().VideoListPage;
    this.items = [
      ['fire', 'Popular Right Now', 'What\'s popular on YouTube today', () => app.screen.open(new VL('Popular Right Now', () => yt.trending(), { makeChannel: { type: 'trending', title: 'Popular Now' } }))],
      ['topics', 'Browse by Topic', 'Music, travel, how-to, science, and more', () => app.screen.open(new TopicsPage())],
      ['live', 'Live Right Now', 'Streams happening at this moment', () => app.screen.open(new VL('Live Right Now', async () => (await yt.search({ q: '', type: 'video', live: true, order: 'viewCount' })).items, { live: true }))],
      ['people', 'New From Channels You Follow', S.follows.length ? S.follows.length + ' channels' : 'Follow channels from search to fill this', () => app.screen.open(new VL('New From Channels You Follow', newFromFollows, { empty: 'You aren\'t following any channels yet.', emptyHint: 'Find a channel with Search, open it, and choose Follow.' }))],
      ['search', 'Search', 'Find anything on YouTube', () => app.screen.open(new (P().SearchPage)())],
    ].filter(x => S.viewer.search || x[1] !== 'Search').map(([icon, label, hint, act]) => ({ html: rows.menu(icon, label, hint), act, side: () => `<b>${esc(label)}</b><p>${esc(hint)}</p>` }));
  }
}
async function newFromFollows() {
  const out = [];
  for (const f of S.follows.slice(0, 30)) { try { out.push(...(await yt.channelVideos(f.id, 10))); } catch (e) { if (e.kind === 'quota') break; } }
  return out.filter(v => v.live !== 'upcoming').sort((a, b) => b.publishedAt - a.publishedAt).slice(0, 60);
}

export class TopicsPage extends ListPage {
  constructor() { super('Browse by Topic'); this.rowH = 80; }
  onShow() {
    if (this.items.length) return;
    this.load(async () => {
      const cats = await yt.categories();
      const VL = P().VideoListPage;
      this.items = cats.map(c => ({ html: rows.menu('topics', c.title, 'Popular in ' + c.title), act: () => app.screen.open(new VL(c.title, () => yt.trending(c.id).catch(e => { if (e.kind === 'notFound') return []; throw e; }), { makeChannel: { type: 'topic', cat: c.id, title: c.title }, empty: 'Nothing popular in this topic right now.' })) }));
    });
  }
}

export class MyStuffPage extends ListPage {
  constructor() {
    super('My Stuff'); this.rowH = 92;
    const VL = P().VideoListPage;
    const fromList = name => async () => S[name].map(x => ({ ...x }));
    this.items = [
      ['clock', 'Continue Watching', S.history.length + ' in your history', () => app.screen.open(new VL('Continue Watching', fromList('history'), { history: true, empty: 'Nothing watched yet.' }))],
      ['plus', 'Watch Later', S.watchLater.length + ' saved', () => app.screen.open(new VL('Watch Later', fromList('watchLater'), { list: 'watchLater', empty: 'Nothing saved yet.', emptyHint: 'On any video, choose "Save to Watch Later".' }))],
      ['heart', 'Liked Videos', S.liked.length + ' liked', () => app.screen.open(new VL('Liked Videos', fromList('liked'), { list: 'liked', empty: 'No liked videos yet.', emptyHint: 'On any video, choose "Like".' }))],
      ['people', 'Channels You Follow', S.follows.length + ' channels', () => app.screen.open(new FollowsPage())],
      ['star', 'Favorite TV Channels', L.channels().filter(c => c.fav).length + ' favorites · the FAV button jumps between them', () => app.screen.open(new FavChannelsPage())],
    ].map(([icon, label, hint, act]) => ({ html: rows.menu(icon, label, hint), act, side: () => `<b>${esc(label)}</b><p>${esc(hint)}</p>` }));
    this.sideText = 'Everything in My Stuff is saved on this TV only. Nothing is sent to YouTube or anyone else.';
  }
}

export class FollowsPage extends ListPage {
  constructor() { super('Channels You Follow'); this.rowH = 100; this.empty = 'You aren\'t following any channels yet.'; this.emptyHint = 'Find a channel with Search, open it, and choose Follow.'; }
  onShow() { this.items = S.follows.map(c => ({ html: rows.channel(c), act: () => app.screen.open(new (P().ChannelPage)(c)), side: () => `<b>${esc(c.title)}</b><p>Press OK to see its videos.</p>` })); }
}

export class FavChannelsPage extends ListPage {
  constructor() { super('Favorite Channels'); this.rowH = 92; this.empty = 'No favorite channels yet.'; this.emptyHint = 'Favorites are picked in Setup.'; }
  onShow() {
    this.items = L.channels().filter(c => c.fav).map(c => { const a = L.at(c); return { html: rows.menu('star', c.num + '  ' + c.name, a ? 'On now: ' + a.v.title : 'Off the air'), act: () => app.tv.tune(app.tv.list.indexOf(c)), side: () => sideVideo(a && a.v) }; });
  }
}

// Lineup filters: every channel's schedule follows these.
export class FiltersPage extends ListPage {
  constructor() { super('Lineup Filters'); this.rowH = 100; this.sideText = 'These change what every channel shows, starting right now. The guide updates too.'; this.build(); }
  build() {
    const f = S.filters, LEN = L.FILTER_CHOICES.length, AGE = L.FILTER_CHOICES.age;
    const label = (list, v) => (list.find(x => x[0] === v) || list[0])[1];
    const cycle = (key, list) => () => { const i = list.findIndex(x => x[0] === f[key]); f[key] = list[(i + 1) % list.length][0]; this.changed(); };
    this.items = [
      { html: rows.menu('clock', 'Show length', 'OK or ◀ ▶ to change', label(LEN, f.length)), act: cycle('length', LEN), cyc: [cycle('length', LEN), LEN, 'length'] },
      { html: rows.menu('fire', 'How new', 'Only shows uploaded in this time', label(AGE, f.age)), act: cycle('age', AGE), cyc: [cycle('age', AGE), AGE, 'age'] },
      { html: rows.menu('chat', 'Captions only', 'Only shows that have closed captions', f.captions ? 'On' : 'Off'), act: () => { f.captions = !f.captions; this.changed(); } },
      { html: rows.menu('back', 'Reset filters', 'Show everything again'), act: () => { Object.assign(f, { length: 'any', age: 'any', captions: false }); this.changed(); } },
    ];
  }
  changed() { save(); L.rescheduleAll(); this.build(); this.rerender(); app.screen.toast('message', { text: 'Lineup updated' }); }
  key(k) {
    const it = this.items[this.sel];
    if ((k === 'left' || k === 'right') && it && it.cyc) {
      const [, list, key] = it.cyc, i = list.findIndex(x => x[0] === S.filters[key]);
      S.filters[key] = list[(i + (k === 'right' ? 1 : list.length - 1)) % list.length][0]; Sound.beep(); this.changed(); return true;
    }
    return super.key(k);
  }
}

export class SettingsPage extends ListPage {
  constructor() { super('Settings'); this.rowH = 92; this.build(); }
  build() {
    const t = S.tv, onoff = b => (b ? 'On' : 'Off');
    const REM = { auto: 'When the mouse moves', always: 'Always', never: 'Never' };
    this.items = [
      ['chat', 'Closed captions', 'Words on screen for what\'s said', onoff(t.cc), () => { app.tv.toggleCC(); }],
      ['search', 'Bigger text', 'Larger letters on menus, banners and captions', onoff(t.bigText), () => { t.bigText = !t.bigText; document.body.classList.toggle('big', t.bigText); app.tv.player.captions(t.cc, t.bigText); }],
      ['tv', 'Static between channels', 'The short burst of snow when you flip', onoff(t.staticOn), () => { t.staticOn = !t.staticOn; }],
      ['fire', 'Button sounds', 'Clicks, static hiss and chimes', onoff(t.sounds), () => { t.sounds = !t.sounds; }],
      ['film', 'Play the next video', 'On demand: keep going to the next one in the list', onoff(t.autoplayNext), () => { t.autoplayNext = !t.autoplayNext; }],
      ['grid', 'On-screen remote', 'Show the big remote buttons', REM[t.remote], () => { t.remote = { auto: 'always', always: 'never', never: 'auto' }[t.remote]; app.remote.apply(); }],
    ].map(([icon, label, hint, value, fn]) => ({ html: rows.menu(icon, label, hint, value), act: () => { fn(); save(); this.build(); this.rerender(); }, side: () => `<b>${esc(label)}</b><p>${esc(hint)}. Press OK to change.</p>` }));
  }
}

// Setup is behind a 4-digit PIN so the viewer can't wander in by accident.
export class PinPage extends Page {
  constructor() { super('Setup'); this.pin = ''; this.first = !S.pin; this.confirm = null; this.msg = ''; }
  render() {
    const boxes = [0, 1, 2, 3].map(i => `<i class="${i < this.pin.length ? 'goldbox' : 'bevel'}">${i < this.pin.length ? '•' : ''}</i>`).join('');
    const head = this.first ? (this.confirm ? 'Type the same PIN again' : 'Choose a 4-digit PIN for Setup') : 'Enter your 4-digit PIN';
    return `<div class="pinpage"><h2>${head}</h2><p>${this.first ? 'Setup is where channels are added and numbered. The PIN keeps it out of the way for whoever watches.' : 'Use the number buttons.'}</p><div class="pin">${boxes}</div><p class="err">${esc(this.msg)}</p><div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map(n => n === '' ? '<span></span>' : `<button type="button" class="kp bevel" data-kp="${n}">${n}</button>`).join('')}</div></div>`;
  }
  side() { return this.first ? '<b>First time here</b><p>Pick any 4 digits you\'ll remember. You can change it in Setup.</p>' : '<b>Forgot the PIN?</b><p>See HOW-TO.md, "Forgot the Setup PIN".</p>'; }
  foot() { return '0–9 type the PIN · BACK goes back'; }
  afterRender(el) { el.querySelectorAll('[data-kp]').forEach(b => b.addEventListener('click', () => this.key(b.dataset.kp === '⌫' ? 'left' : String(b.dataset.kp)))); }
  key(k) {
    if (k === 'left' || (k === 'back' && this.pin)) { this.pin = this.pin.slice(0, -1); this.rerender(); return true; }
    if (!/^\d$/.test(k)) return false;
    Sound.beep(); this.pin += k; this.msg = '';
    if (this.pin.length === 4) {
      if (this.first && !this.confirm) { this.confirm = this.pin; this.pin = ''; }
      else if (this.first) { if (this.pin === this.confirm) { S.pin = this.pin; save(true); app.screen.replace(new (P().SetupHome)()); return true; } this.msg = 'Those didn\'t match. Try again.'; this.confirm = null; this.pin = ''; }
      else if (this.pin === S.pin) { app.screen.replace(new (P().SetupHome)()); return true; }
      else { this.msg = 'That isn\'t the PIN.'; this.pin = ''; }
    }
    this.rerender(); return true;
  }
}

export { MessagePage, ICON };
