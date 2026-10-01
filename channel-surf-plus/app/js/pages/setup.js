// Setup: for whoever sets the TV up (keyboard and mouse friendly).
// YouTube key, the channel lineup, importing subscriptions, what the viewer
// can reach, and backups. The picture pauses while you're in here.
import { app } from '../app.js';
import { S, save, exportSetup, replaceAll, db } from '../store.js';
import { esc, ago, $$ } from '../util.js';
import * as L from '../lineup.js';
import { yt, isDemo } from '../source.js';
import { real, plain, quotaUsed, DAILY, searchesLeft } from '../api.js';
import { Page } from './base.js';
import { account } from '../account.js';
import { SEARCH_FILTERS, defaultSearchFilters } from './browse.js';

class SetupPage extends Page {
  constructor(title) { super(title); this.win = false; }
  key(k) { return !['back', 'exit', 'menu', 'vup', 'vdown', 'mute'].includes(k); }
  foot() { return 'Use the mouse, or Tab and Enter · Esc goes back · changes are saved right away'; }
  on(sel, ev, fn) { $$(sel, document.getElementById('pages')).forEach(el => el.addEventListener(ev, e => fn(e, el))); }
  val(id) { const el = document.getElementById(id); return el ? el.value : ''; }
}

const SRC_TEXT = s => ({ channel: 'YouTube channel: ', search: 'Search: ', playlist: 'Playlist: ', topic: 'Topic: ', trending: '' }[s.type] || '') + (s.type === 'search' ? '"' + s.q + '"' : s.type === 'trending' ? 'Popular on YouTube' : s.title || s.id);

export class SetupHome extends SetupPage {
  constructor(tab = 'channels') { super('Setup'); this.tab = isDemo() && tab === 'channels' && !S.setupDone ? 'youtube' : tab; this.msg = ''; this.msgOk = true; }
  onShow() { account.refresh().then(() => { if (this.tab === 'youtube' && !this.typing()) this.rerender(); }); }
  typing() { const a = document.activeElement; return !!(a && a.closest && a.closest('#pages input, #pages textarea')); }
  render() {
    const tabs = [['youtube', 'YouTube connection'], ['channels', 'Channels'], ['viewer', 'What the viewer sees'], ['backup', 'Backup and PIN']];
    return `<div class="setup"><div class="tabs">${tabs.map(([id, t]) => `<button type="button" data-tab="${id}" class="${this.tab === id ? 'on' : ''}">${t}</button>`).join('')}<button type="button" data-done="1">Done</button></div>
      ${this.msg ? `<p class="${this.msgOk ? 'ok' : 'bad'}">${esc(this.msg)}</p>` : ''}${this[this.tab]()}</div>`;
  }
  say(m, ok = true) { this.msg = m; this.msgOk = ok; this.rerender(); }
  afterRender() {
    this.on('[data-tab]', 'click', (e, b) => { this.tab = b.dataset.tab; this.msg = ''; this.rerender(); });
    this.on('[data-done]', 'click', () => app.screen.closePages());
    const fn = this['wire_' + this.tab]; if (fn) fn.call(this);
  }

  // ----- YouTube connection -----
  youtube() {
    const used = quotaUsed(), pct = Math.min(100, used / DAILY * 100);
    return `<div class="card bevel"><h2>${isDemo() ? 'Not connected yet: showing practice channels' : 'Connected to YouTube ✓'}</h2>
      <p>Channel Surf uses YouTube's official service with a free key that you make once. It takes about 5 minutes; the steps are in <b>HOW-TO.md</b> ("Get your free YouTube key").</p>
      <label for="key">Your YouTube API key</label><input type="password" id="key" value="${esc(S.apiKey)}" placeholder="Starts with AIza…" autocomplete="off" spellcheck="false">
      <div class="btns"><button type="button" class="b gold" id="saveKey">Save and test the key</button><button type="button" class="b" id="showKey">Show / hide</button>${S.apiKey ? '<button type="button" class="b red" id="dropKey">Disconnect (back to practice channels)</button>' : ''}</div></div>
      ${isDemo() ? '' : `<div class="card bevel"><h3>Today's YouTube allowance</h3><div class="meter"><i style="width:${pct}%"></i></div><p>${used.toLocaleString()} of ${DAILY.toLocaleString()} units used today (resets at midnight Pacific time). About ${searchesLeft()} searches left. Refreshing a channel costs about 3; a search costs 100.</p></div>`}
      <div class="card bevel grid2"><div><label for="region">Country (for popular videos and what can play here)</label><select id="region">${['US', 'CA', 'GB', 'AU', 'IE', 'NZ', 'IN', 'DE', 'FR', 'ES', 'IT', 'MX', 'BR', 'JP'].map(r => `<option${S.region === r ? ' selected' : ''}>${r}</option>`).join('')}</select></div>
      <div><label for="safe">Safe search</label><select id="safe">${[['moderate', 'Moderate (YouTube\'s default)'], ['strict', 'Strict'], ['none', 'Off']].map(([v, t]) => `<option value="${v}"${S.safeSearch === v ? ' selected' : ''}>${t}</option>`).join('')}</select></div></div>
      ${this.accountCard()}`;
  }
  // Optional: sign in to a YouTube account for real likes, subscriptions, playlists and comments.
  accountCard() {
    const a = account, intro = '<p>Optional. Signing in lets the TV do things on your real YouTube account: like videos, subscribe, use your playlists, and write comments. Watching works the same without it.</p>';
    if (a.demo) return `<div class="card bevel"><h2>YouTube account (optional)</h2>${intro}
      <p>${a.signedIn ? '<b>Signed in to a practice account ✓</b> Try the Your YouTube menu, likes and comments.' : 'In demo mode you can try it with a practice account. Nothing goes to YouTube.'}</p>
      <div class="btns">${a.signedIn ? '<button type="button" class="b red" id="signOut">Sign out of the practice account</button>' : '<button type="button" class="b gold" id="signIn">Sign in to a practice account</button>'}</div></div>`;
    if (!a.available) return `<div class="card bevel"><h2>YouTube account (optional)</h2>${intro}<p class="bad">Signing in needs the TV to be started with <code>python3 tv.py</code> on this computer.</p></div>`;
    if (!a.configured || this.newClient) return `<div class="card bevel"><h2>YouTube account (optional)</h2>${intro}
      <p>First, make a free "sign-in client" in the same Google Cloud project as your key. It takes about 5 minutes; the steps are in <b>HOW-TO.md</b> ("Sign in to YouTube"). Then paste its two codes here:</p>
      <div class="grid2"><div><label for="cid">Client ID</label><input type="text" id="cid" placeholder="Ends with .apps.googleusercontent.com" autocomplete="off" spellcheck="false"></div>
      <div><label for="csecret">Client secret</label><input type="password" id="csecret" placeholder="Starts with GOCSPX-" autocomplete="off" spellcheck="false"></div></div>
      <div class="btns"><button type="button" class="b gold" id="saveClient">Save</button></div></div>`;
    if (!a.signedIn) return `<div class="card bevel"><h2>YouTube account (optional)</h2>${intro}
      <p>Ready. Press the button, pick your Google account, and allow Channel Surf to manage your YouTube account. You'll come back here when it's done.</p>
      <div class="btns"><button type="button" class="b gold" id="signIn">Sign in with Google</button><button type="button" class="b" id="forgetClient">Change the sign-in client</button></div></div>`;
    return `<div class="card bevel"><h2>YouTube account ✓</h2><p><b>Signed in${a.name ? ' as ' + esc(a.name) : ''}.</b> Likes, subscriptions, playlists and comments made on this TV really happen on YouTube. The sign-in is kept in a private file on this computer, never in the browser.</p>
      <p class="dim">What the viewer can do with it is under "What the viewer sees".</p>
      <div class="btns"><button type="button" class="b red" id="signOut">Sign out of YouTube</button></div></div>`;
  }
  wire_youtube() {
    this.on('#showKey', 'click', () => { const k = document.getElementById('key'); k.type = k.type === 'password' ? 'text' : 'password'; });
    this.on('#saveKey', 'click', async () => {
      const key = this.val('key').trim();
      if (!/^AIza[\w-]{30,}$/.test(key)) return this.say('That doesn\'t look like a YouTube key. It should start with AIza and be about 39 characters.', false);
      this.say('Testing the key with YouTube…');
      try { await real.testKey(key); }
      catch (e) { return this.say(plain(e), false); }
      S.apiKey = key; S.setupDone = true; save(true);
      this.say('The key works! Restarting the TV with real YouTube…');
      setTimeout(() => location.reload(), 1200);
    });
    this.on('#dropKey', 'click', () => { S.apiKey = ''; save(true); location.reload(); });
    this.on('#region', 'change', (e, el) => { S.region = el.value; save(); });
    this.on('#signIn', 'click', () => { account.signIn(); if (account.demo) this.say('Signed in to the practice account.'); });
    this.on('#signOut', 'click', async (e, b) => { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Click again to sign out'; return; } await account.signOut(); this.say('Signed out of YouTube.'); });
    this.on('#saveClient', 'click', async () => {
      const id = this.val('cid').trim(), secret = this.val('csecret').trim();
      if (!/\.apps\.googleusercontent\.com$/.test(id)) return this.say('The client ID should end with .apps.googleusercontent.com', false);
      if (!secret) return this.say('Paste the client secret too.', false);
      try { await account.saveClient(id, secret); this.newClient = false; this.say('Saved. Now press "Sign in with Google".'); }
      catch (e) { this.say(e.message, false); }
    });
    this.on('#forgetClient', 'click', () => { this.newClient = true; this.rerender(); });
    this.on('#safe', 'change', (e, el) => { S.safeSearch = el.value; save(); });
  }

  // ----- Channels -----
  channels() {
    const list = L.channels().filter(c => c.kind !== 'guide');
    const rowsHTML = list.map((c, i) => {
      return `<div class="chrow"><div class="n">${c.num}</div><div><b>${c.fav ? '★ ' : ''}${esc(c.name)}</b><small>${c.sources.map(s => esc(SRC_TEXT(s))).join(' + ') || 'No sources yet'} · <span data-st="${i}">${chStatus(c)}</span></small></div>
        <div class="btns" style="margin:0"><button type="button" class="b small" data-up="${i}" aria-label="Move up">▲</button><button type="button" class="b small" data-down="${i}" aria-label="Move down">▼</button><button type="button" class="b small" data-fav="${i}">${c.fav ? '★ Fav' : '☆ Fav'}</button><button type="button" class="b small gold" data-edit="${i}">Edit</button><button type="button" class="b small red" data-del="${i}">Delete</button></div></div>`;
    }).join('');
    return `<div class="card bevel"><h2>${isDemo() ? 'Practice lineup (demo)' : 'Your lineup'} · ${list.length} channels</h2><p>Channel 1 is always the guide. Each channel can mix several YouTube channels, searches, playlists or topics.</p>
      <div class="btns"><button type="button" class="b gold" id="addCh">+ Add a channel</button><button type="button" class="b gold" id="import">Import YouTube subscriptions or links</button><button type="button" class="b" id="renum">Number them 2, 3, 4… in order</button><button type="button" class="b" id="refresh">Refresh all channels now</button></div></div>
      <div class="chlist">${rowsHTML || '<p>No channels yet. Add one, or import your YouTube subscriptions.</p>'}</div>`;
  }
  wire_channels() {
    const list = L.channels().filter(c => c.kind !== 'guide');
    this.on('[data-up]', 'click', (e, b) => { L.moveChannel(list[+b.dataset.up], -1); this.rerender(); });
    this.on('[data-down]', 'click', (e, b) => { L.moveChannel(list[+b.dataset.down], 1); this.rerender(); });
    this.on('[data-fav]', 'click', (e, b) => { const c = list[+b.dataset.fav]; L.updateChannel(c, { fav: !c.fav }); this.rerender(); });
    this.on('[data-edit]', 'click', (e, b) => app.screen.open(new ChannelEditor(list[+b.dataset.edit])));
    this.on('[data-del]', 'click', (e, b) => {
      const c = list[+b.dataset.del];
      if (b.dataset.sure) { L.removeChannel(c); app.tv.refreshList(); this.say('Deleted channel ' + c.num + ', ' + c.name + '.'); }
      else { b.dataset.sure = '1'; b.textContent = 'Really delete?'; }
    });
    this.on('#addCh', 'click', () => app.screen.open(new ChannelEditor(null)));
    this.on('#import', 'click', () => app.screen.open(new ImportPage()));
    this.on('#renum', 'click', () => { L.renumber(); app.tv.refreshList(); this.say('Renumbered.'); });
    this.on('#refresh', 'click', async () => { this.say('Refreshing… this can take a minute.'); for (const c of list) await L.refreshChannel(c, { force: true }); this.say('All channels refreshed.'); });
    // keep the status lines up to date while shows load (in place: nothing else on the page moves)
    clearInterval(this.timer); this.timer = setInterval(() => {
      if (app.screen.top() !== this || this.tab !== 'channels') return clearInterval(this.timer);
      $$('#pages [data-st]').forEach(el => { const c = list[+el.dataset.st]; const h = c ? chStatus(c) : ''; if (el.innerHTML !== h) el.innerHTML = h; });
    }, 2000);
  }
  onHide() { clearInterval(this.timer); }

  // ----- What the viewer sees -----
  viewer() {
    const v = S.viewer, r = S.rules, ck = (id, on, label, hint) => `<label><input type="checkbox" id="${id}"${on ? ' checked' : ''}> ${label}</label><p class="dim">${hint}</p>`;
    return `<div class="card bevel"><h2>Menus the viewer can use</h2><p>Turn these off for a simple TV with just channels, the guide and settings.</p>
      ${ck('vSearch', v.search, 'Search YouTube', 'The Search screen and the SEARCH button.')}
      ${ck('vOnDemand', v.ondemand, 'On Demand and My Stuff', 'Popular videos, topics, live now, watch later, history.')}
      ${ck('vMake', v.makeChannels, 'Let the viewer make new TV channels', '"Make this a TV channel" on searches, channels and playlists.')}
      ${account.signedIn ? ck('vAccount', v.account !== false, 'Use the YouTube account', 'Your YouTube menu, real likes, subscribing, and your playlists.') + ck('vComments', v.comments !== false, 'Let the viewer write comments and replies', 'Comments are public on YouTube. Each one is shown for checking before it\'s posted.') : ''}</div>
      <div class="card bevel"><h2>House rules for every channel</h2><p>Keeps Shorts and very long stream recordings off the schedule. Livestreams, premieres that haven't aired, age-restricted and non-embeddable videos are always left out.</p>
      <div class="grid2"><div><label for="minMin">Shortest show (minutes)</label><input type="number" id="minMin" min="1" max="60" value="${Math.round(r.minSec / 60)}"></div>
      <div><label for="maxMin">Longest show (minutes)</label><input type="number" id="maxMin" min="10" max="600" value="${Math.round(r.maxSec / 60)}"></div></div>
      <div class="btns"><button type="button" class="b gold" id="saveRules">Save house rules</button></div></div>`;
  }
  wire_viewer() {
    const set = (id, key) => this.on('#' + id, 'change', (e, el) => { S.viewer[key] = el.checked; save(); app.remote.render(); });
    set('vSearch', 'search'); set('vOnDemand', 'ondemand'); set('vMake', 'makeChannels'); set('vAccount', 'account'); set('vComments', 'comments');
    this.on('#saveRules', 'click', () => {
      const a = Math.max(1, Math.min(60, +this.val('minMin') || 3)), b = Math.max(a + 1, Math.min(600, +this.val('maxMin') || 180));
      S.rules.minSec = a * 60; S.rules.maxSec = b * 60; save(); L.rescheduleAll(); this.say('House rules saved. The lineup has been updated.');
    });
  }

  // ----- Backup and PIN -----
  backup() {
    return `<div class="card bevel"><h2>Save a backup of this setup</h2><p>Saves your channels, numbers and settings to a file. You can load it on another computer, or here if anything goes wrong.</p>
      <div class="btns"><button type="button" class="b gold" id="export">Save setup to a file</button><label class="b" style="display:inline-block;margin:0;cursor:pointer">Load setup from a file<input type="file" id="importFile" accept=".json,application/json" hidden></label></div></div>
      <div class="card bevel"><h2>Change the Setup PIN</h2><div class="grid2"><div><label for="pin1">New 4-digit PIN</label><input type="password" id="pin1" inputmode="numeric" maxlength="4"></div><div><label for="pin2">Same PIN again</label><input type="password" id="pin2" inputmode="numeric" maxlength="4"></div></div>
      <div class="btns"><button type="button" class="b gold" id="savePin">Change PIN</button></div></div>
      <div class="card bevel"><h2>Start over</h2><p>Erases every channel, setting, history and the key, on this computer only.</p><div class="btns"><button type="button" class="b red" id="reset">Erase everything</button></div></div>`;
  }
  wire_backup() {
    this.on('#export', 'click', () => {
      const blob = new Blob([exportSetup()], { type: 'application/json' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'channel-surf-setup.json'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000); this.say('Saved channel-surf-setup.json to your Downloads folder.');
    });
    this.on('#importFile', 'change', (e, el) => {
      const f = el.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => { try { const o = JSON.parse(r.result); if (!o || !o.settings || !Array.isArray(o.settings.channels)) throw 0; replaceAll(o.settings); this.say('Loaded. Restarting…'); setTimeout(() => location.reload(), 900); } catch { this.say('That file isn\'t a Channel Surf setup file.', false); } };
      r.readAsText(f);
    });
    this.on('#savePin', 'click', () => { const a = this.val('pin1'), b = this.val('pin2'); if (!/^\d{4}$/.test(a)) return this.say('The PIN has to be 4 digits.', false); if (a !== b) return this.say('The two PINs don\'t match.', false); S.pin = a; save(true); this.say('PIN changed.'); });
    this.on('#reset', 'click', async (e, b) => { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Click again to erase everything'; return; } localStorage.clear(); await db.clear(); location.reload(); });
  }
}
function chStatus(c) {
  const st = L.poolStatus(c);
  return st.loading ? 'getting shows…' : st.error && !st.usable ? '<span class="bad">' + esc(plainKind(st.error)) + '</span>' : st.at ? st.usable + ' shows ready · checked ' + ago(st.at) : 'not loaded yet';
}
function plainKind(k) { return { quota: 'YouTube daily limit reached; will retry tomorrow', key: 'the YouTube key isn\'t working', referrer: 'the key doesn\'t allow this address', disabled: 'the YouTube API isn\'t enabled for the key', rate: 'YouTube asked to slow down; will try again soon', busy: 'YouTube was busy; will try again soon', network: 'no internet', notFound: 'not found on YouTube', nokey: 'no YouTube key yet' }[k] || 'had a problem'; }

// ----- add or edit one channel -----
export class ChannelEditor extends SetupPage {
  constructor(ch) {
    super(ch ? 'Edit channel ' + ch.num : 'Add a channel');
    this.ch = ch; this.draft = ch ? JSON.parse(JSON.stringify(ch)) : { name: '', num: L.nextFreeNum(), sources: [], filters: { length: 'any', age: 'any', captions: false, words: '' }, fav: false };
    this.draft.filters = { length: 'any', age: 'any', captions: false, words: '', ...this.draft.filters };
    this.msg = ''; this.ok = true; this.cats = null;
  }
  onShow() { yt.categories().then(c => { this.keepInputs(); this.cats = c; this.rerender(); }).catch(() => { this.cats = []; }); }
  say(m, ok = true) { this.msg = m; this.ok = ok; this.rerender(); } // handlers call keepInputs() first
  keepInputs() { const d = this.draft; if (document.getElementById('cname')) { d.name = this.val('cname'); d.num = +this.val('cnum') || d.num; d.filters.length = this.val('flen'); d.filters.age = this.val('fage'); d.filters.captions = document.getElementById('fcc').checked; d.filters.words = this.val('fwords'); this.pending = { links: this.val('links'), q: this.val('sq'), pl: this.val('pl') }; } }
  render() {
    const d = this.draft, f = d.filters, p = this.pending || {};
    const opt = (list, v) => list.map(([k, t]) => `<option value="${k}"${v === k ? ' selected' : ''}>${esc(t)}</option>`).join('');
    const sf = SEARCH_FILTERS.filter(x => ['duration', 'date', 'order'].includes(x[0]));
    return `<div class="setup">${this.msg ? `<p class="${this.ok ? 'ok' : 'bad'}">${esc(this.msg)}</p>` : ''}
      <div class="card bevel grid2"><div><label for="cname">Channel name</label><input type="text" id="cname" maxlength="40" value="${esc(d.name)}" placeholder="For example: Woodworking"></div><div><label for="cnum">Channel number</label><input type="number" id="cnum" min="2" max="999" value="${d.num}"></div></div>
      <div class="card bevel"><h3>What this channel plays (${d.sources.length})</h3>${d.sources.map((s, i) => `<div class="chrow"><div class="n">${i + 1}</div><div><b>${esc(SRC_TEXT(s))}</b>${s.f ? `<small>${esc(Object.entries(s.f).filter(([k, v]) => v && v !== 'any' && v !== 'relevance').map(([k, v]) => k + ': ' + v).join(', '))}</small>` : ''}</div><div class="btns" style="margin:0"><button type="button" class="b small red" data-rm="${i}">Remove</button></div></div>`).join('') || '<p>Nothing yet. Add at least one below.</p>'}
        <p class="dim">With more than one, they take turns, so no single YouTube channel hogs the TV.</p></div>
      <div class="card bevel"><h3>Add YouTube channels</h3><p>Paste channel links, @handles, or a link to any video from the channel. One per line.</p><textarea id="links" placeholder="@woodworkingchannel&#10;https://www.youtube.com/@someone&#10;https://www.youtube.com/channel/UC...">${esc(p.links || '')}</textarea><div class="btns"><button type="button" class="b gold" id="addLinks">Add these channels</button></div></div>
      <div class="card bevel"><h3>Add a search</h3><p>Plays videos matching these words. (Uses one search a day to stay fresh.)</p><input type="text" id="sq" value="${esc(p.q || '')}" placeholder="For example: bob ross painting">
        <div class="grid2">${sf.map(([k, label, opts]) => `<div><label for="sf_${k}">${label}</label><select id="sf_${k}">${opt(opts, defaultSearchFilters()[k])}</select></div>`).join('')}<div><label><input type="checkbox" id="sf_cc"> Only with captions</label></div></div>
        <div class="btns"><button type="button" class="b gold" id="addSearch">Add this search</button></div></div>
      <div class="card bevel grid2"><div><h3>Add a playlist</h3><input type="text" id="pl" value="${esc(p.pl || '')}" placeholder="Playlist link (has list= in it)"><div class="btns"><button type="button" class="b gold" id="addPl">Add playlist</button></div></div>
        <div><h3>Add a topic</h3><select id="cat">${this.cats ? this.cats.map(c => `<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('') : '<option>Loading topics…</option>'}</select><div class="btns"><button type="button" class="b gold" id="addCat">Add popular videos in this topic</button><button type="button" class="b" id="addTrend">Add "Popular on YouTube"</button></div></div></div>
      <div class="card bevel"><h3>Filters for this channel</h3><div class="grid2"><div><label for="flen">Show length</label><select id="flen">${opt(L.FILTER_CHOICES.length, f.length)}</select></div><div><label for="fage">How new</label><select id="fage">${opt(L.FILTER_CHOICES.age, f.age)}</select></div>
        <div><label for="fwords">Leave out titles with these words (commas between)</label><input type="text" id="fwords" value="${esc(f.words || '')}" placeholder="for example: reaction, unboxing"></div><div><label><input type="checkbox" id="fcc"${f.captions ? ' checked' : ''}> Only shows with captions</label></div></div></div>
      <div class="btns"><button type="button" class="b gold" id="saveCh">${this.ch ? 'Save changes' : 'Create this channel'}</button><button type="button" class="b" id="cancel">Cancel</button></div></div>`;
  }
  afterRender() {
    const d = this.draft;
    this.on('[data-rm]', 'click', (e, b) => { this.keepInputs(); d.sources.splice(+b.dataset.rm, 1); this.rerender(); });
    this.on('#addLinks', 'click', async () => {
      this.keepInputs();
      const lines = (this.pending.links || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
      if (!lines.length) return this.say('Paste at least one link or @handle first.', false);
      this.say('Looking up ' + lines.length + ' on YouTube…');
      const bad = [];
      for (const line of lines) {
        try { const c = await yt.resolveChannel(line); if (!d.sources.some(s => s.type === 'channel' && s.id === c.id)) d.sources.push({ type: 'channel', id: c.id, title: c.title }); if (!d.name) d.name = c.title; }
        catch (e) { bad.push(line + ' (' + plain(e) + ')'); if (e.kind === 'quota' || e.kind === 'key') break; }
      }
      this.pending.links = bad.map(b => b.replace(/ \(.*$/, '')).join('\n');
      this.say(bad.length ? 'Couldn\'t find: ' + bad.join('; ') : 'Added.', !bad.length);
    });
    this.on('#addSearch', 'click', () => {
      this.keepInputs(); const q = (this.pending.q || '').trim();
      if (!q) return this.say('Type some words to search for.', false);
      d.sources.push({ type: 'search', q, f: { duration: this.val('sf_duration'), date: this.val('sf_date'), order: this.val('sf_order'), captions: document.getElementById('sf_cc').checked, hd: false }, title: q });
      if (!d.name) d.name = q.replace(/\b\w/g, c => c.toUpperCase());
      this.pending.q = ''; this.say('Search added.');
    });
    this.on('#addPl', 'click', async () => {
      this.keepInputs(); const m = /[?&]list=([\w-]+)/.exec(this.pending.pl || '') || /^(PL[\w-]{10,}|UU[\w-]+|OL[\w-]+)$/.exec((this.pending.pl || '').trim());
      if (!m) return this.say('That doesn\'t look like a playlist link. It should have "list=" in it.', false);
      try { const p = await yt.playlistInfo(m[1]); d.sources.push({ type: 'playlist', id: p.id, title: p.title }); if (!d.name) d.name = p.title; this.pending.pl = ''; this.say('Playlist added.'); }
      catch (e) { this.say(plain(e), false); }
    });
    this.on('#addCat', 'click', () => { this.keepInputs(); const el = document.getElementById('cat'); const c = (this.cats || []).find(x => x.id === el.value); if (!c) return; d.sources.push({ type: 'topic', cat: c.id, title: c.title }); if (!d.name) d.name = c.title; this.say('Topic added.'); });
    this.on('#addTrend', 'click', () => { this.keepInputs(); d.sources.push({ type: 'trending', title: 'Popular on YouTube' }); if (!d.name) d.name = 'Popular Now'; this.say('Added.'); });
    this.on('#cancel', 'click', () => app.screen.back());
    this.on('#saveCh', 'click', () => {
      this.keepInputs();
      if (!d.name.trim()) return this.say('Give the channel a name.', false);
      if (!d.sources.length) return this.say('Add at least one thing for the channel to play.', false);
      const num = Math.max(2, Math.min(999, Math.round(d.num)));
      const clash = L.channels().find(c => c.num === num && (!this.ch || c.id !== this.ch.id));
      if (clash && !this.confirmClash) { this.confirmClash = true; return this.say(`Channel ${num} is already ${clash.name}. Press the button again to put this one there and move the others up.`, false); }
      if (clash) L.activeList().forEach(c => { if (c.num >= num && (!this.ch || c.id !== this.ch.id)) c.num++; });
      const filters = { ...d.filters };
      const changed = k => JSON.stringify(k === 'filters' ? filters : d[k]) !== JSON.stringify(this.ch[k]);
      if (this.ch) L.updateChannel(this.ch, { name: d.name.trim(), num, ...(changed('filters') ? { filters } : {}), ...(changed('sources') ? { sources: d.sources } : {}) });
      else L.addChannel({ name: d.name.trim(), num, sources: d.sources, filters });
      app.tv.refreshList(); app.screen.back(); const h = app.screen.top(); if (h && h.say) h.say((this.ch ? 'Saved ' : 'Created ') + 'channel ' + num + ', ' + d.name.trim() + '.');
    });
  }
}

// ----- import subscriptions (Google Takeout) or a pasted list -----
export function parseCSV(text) {
  const out = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some(x => x.trim())) out.push(row); row = []; }
    else cell += c;
  }
  row.push(cell); if (row.some(x => x.trim())) out.push(row);
  return out;
}
export function parseTakeout(text) {
  const rows = parseCSV(text.replace(/^﻿/, '')); if (!rows.length) return [];
  const head = rows[0].map(h => h.trim().toLowerCase());
  let iId = head.findIndex(h => h.includes('channel id')), iTitle = head.findIndex(h => h.includes('title')), iUrl = head.findIndex(h => h.includes('url'));
  const body = iId >= 0 || iTitle >= 0 ? rows.slice(1) : rows;
  if (iId < 0) iId = 0; if (iTitle < 0) iTitle = 2;
  return body.map(r => { let id = (r[iId] || '').trim(); if (!/^UC[\w-]{22}$/.test(id)) { const m = /(UC[\w-]{22})/.exec(r[iUrl] || r.join(' ')); id = m ? m[1] : ''; } return { id, title: (r[iTitle] || '').trim() || id }; }).filter(x => x.id);
}

export class ImportPage extends SetupPage {
  constructor() { super('Import channels'); this.subs = []; this.msg = ''; this.ok = true; }
  say(m, ok = true) { this.msg = m; this.ok = ok; this.rerender(); } // handlers call keep() first
  keep() { $$('#pages [data-sub]').forEach(cb => { const s = this.subs[+cb.dataset.sub]; if (s) s.on = cb.checked; }); const n = document.getElementById('comboName'); if (n) this.comboName = n.value; const l = document.getElementById('pasted'); if (l) this.pasted = l.value; }
  render() {
    const on = this.subs.filter(s => s.on).length;
    return `<div class="setup">${this.msg ? `<p class="${this.ok ? 'ok' : 'bad'}">${esc(this.msg)}</p>` : ''}
      <div class="card bevel"><h2>1. Get the list</h2>
        <p><b>From Google Takeout:</b> go to takeout.google.com, choose only "YouTube and YouTube Music", then "All YouTube data included" and pick only <b>subscriptions</b>. Download it, unzip it, and pick the file called <code>subscriptions.csv</code> here:</p>
        <div class="btns"><label class="b gold" style="display:inline-block;margin:0;cursor:pointer">Choose subscriptions.csv<input type="file" id="csv" accept=".csv,text/csv" hidden></label></div>
        <p style="margin-top:16px"><b>Or paste</b> channel links or @handles, one per line:</p><textarea id="pasted">${esc(this.pasted || '')}</textarea><div class="btns"><button type="button" class="b gold" id="usePaste">Use these</button></div></div>
      ${this.subs.length ? `<div class="card bevel"><h2>2. Pick the channels (${on} of ${this.subs.length} picked)</h2><div class="btns"><button type="button" class="b small" id="all">Pick all</button><button type="button" class="b small" id="none">Pick none</button></div>
        <div class="subs">${this.subs.map((s, i) => `<label><input type="checkbox" data-sub="${i}"${s.on ? ' checked' : ''}> ${esc(s.title)}</label>`).join('')}</div>
        <h2>3. Choose what to make</h2>
        <div class="btns"><button type="button" class="b gold" id="each">Make each one its own TV channel</button></div>
        <div class="grid2" style="margin-top:10px"><div><label for="comboName">…or combine the picked ones into one channel called</label><input type="text" id="comboName" value="${esc(this.comboName || '')}" placeholder="For example: Woodworking"></div><div class="btns" style="align-items:end"><button type="button" class="b gold" id="combo">Combine into one channel</button></div></div>
        <div class="btns"><button type="button" class="b" id="follow">Just follow them (shows up in On Demand)</button></div></div>` : ''}</div>`;
  }
  afterRender() {
    this.on('#csv', 'change', (e, el) => {
      this.keep(); const f = el.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => { const list = parseTakeout(String(r.result)); if (!list.length) return this.say('No channels found in that file. Is it subscriptions.csv?', false); this.subs = list.map(s => ({ ...s, on: true })); this.say('Found ' + list.length + ' subscriptions.'); };
      r.readAsText(f);
    });
    this.on('#usePaste', 'click', async () => {
      this.keep(); const lines = (this.pasted || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
      if (!lines.length) return this.say('Paste some links first.', false);
      this.say('Looking them up on YouTube…'); const bad = [];
      for (const line of lines) { try { const c = await yt.resolveChannel(line); if (!this.subs.some(s => s.id === c.id)) this.subs.push({ id: c.id, title: c.title, on: true }); } catch (e) { bad.push(line); if (e.kind === 'quota' || e.kind === 'key') break; } }
      this.pasted = bad.join('\n'); this.say(bad.length ? 'Couldn\'t find: ' + bad.join(', ') : 'Found them all.', !bad.length);
    });
    this.on('#all', 'click', () => { this.keep(); this.subs.forEach(s => s.on = true); this.rerender(); });
    this.on('#none', 'click', () => { this.keep(); this.subs.forEach(s => s.on = false); this.rerender(); });
    this.on('#each', 'click', () => {
      this.keep(); const picked = this.subs.filter(s => s.on); if (!picked.length) return this.say('Pick at least one.', false);
      const existing = new Set(L.channels().flatMap(c => (c.sources || []).filter(s => s.type === 'channel').map(s => s.id)));
      let n = 0; picked.forEach(s => { if (!existing.has(s.id)) { L.addChannel({ name: s.title, sources: [{ type: 'channel', id: s.id, title: s.title }] }); n++; } });
      app.tv.refreshList(); this.say(`Made ${n} new channels${picked.length - n ? ' (' + (picked.length - n) + ' were already in the lineup)' : ''}. They're loading their shows now.`);
    });
    this.on('#combo', 'click', () => {
      this.keep(); const picked = this.subs.filter(s => s.on); if (!picked.length) return this.say('Pick at least one.', false);
      const name = (this.comboName || '').trim(); if (!name) return this.say('Give the combined channel a name.', false);
      const ch = L.addChannel({ name, sources: picked.map(s => ({ type: 'channel', id: s.id, title: s.title })) });
      app.tv.refreshList(); this.say(`Made channel ${ch.num}, ${name}, from ${picked.length} YouTube channels.`);
    });
    this.on('#follow', 'click', () => {
      this.keep(); const picked = this.subs.filter(s => s.on); let n = 0;
      picked.forEach(s => { if (!S.follows.some(f => f.id === s.id)) { S.follows.push({ id: s.id, title: s.title, thumb: '' }); n++; } });
      save(); this.say('Following ' + n + ' more channels.');
    });
  }
}
