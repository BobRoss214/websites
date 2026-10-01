// Demo mode: a pretend YouTube with practice channels and shows, used until a
// YouTube key is added in Setup (and by the automatic tests). It answers the
// same questions as api.js, so every screen works the same way.
import { hash, rng } from './util.js';
import { putVideo, VIDS } from './vids.js';
import { ApiError } from './api.js';
import { S, save } from './store.js';

const T = {
  wood: ['Workshop Two', 28, ['Hand-Cut Dovetails', 'Saving a Rusty Hand Plane', 'The Shaker Side Table, Part 1', 'The Shaker Side Table, Part 2', 'Sharpening Made Simple', 'A Workbench in a Weekend', 'Turning a Walnut Bowl', 'Fixing a Wobbly Chair', 'Picking the Right Glue', 'Finishing with Oil and Wax']],
  garden: ['Garden Patch', 110, ['Fall Bulbs, Spring Color', 'Tomato Cages the Easy Way', 'Raised Beds for Bad Knees', 'Saving Seeds', 'Roses in Six Steps', 'Composting Without the Smell', 'Herbs on a Windowsill', 'Pruning Fruit Trees', 'Starting Seeds Indoors']],
  kitchen: ['Supper Club', 8, ['Sunday Pot Roast', 'Buttermilk Biscuits', 'Chicken and Dumplings', 'Pies of the Season', 'Apple Pie From Scratch', 'Grandma\'s Meatloaf', 'Pecan Pie the Old Way', 'Homemade Bread for Beginners', 'Soup for a Cold Night', 'Peach Cobbler']],
  travel: ['Wide World', 195, ['Backroads of Portugal', 'A Morning in Kyoto', 'The Scottish Highlands', 'Canal Boats of England', 'The Lakes of Italy', 'Route 66 by Car', 'Small Towns of Vermont', 'A Week in Ireland', 'The Great Train Journeys']],
  space: ['Starwatch', 255, ['The Night Sky This Month', 'Saturn\'s Rings Explained', 'Footprints on the Moon', 'How Telescopes Work', 'The Story of the Space Shuttle', 'Comets and Meteor Showers', 'Life on Mars?', 'The Hubble Years']],
  music: ['Ballroom', 320, ['Swing Era Favorites', 'Saturday Night Polka', 'Crooners and Ballads', 'Big Band Live in Concert', 'Doo-Wop Classics', 'Country Gold', 'Gospel Sunday', 'Jazz Standards Hour']],
  cars: ['Old Iron', 45, ['Restoring a \'57 Pickup, Episode 4', 'Steam in the Rockies', 'Barn Finds', 'The Story of the Model T', 'Rebuilding a Tractor Engine', 'Classic Cars at the Fair', 'Railroads of the Old West']],
  birds: ['Backyard Birds', 140, ['Who\'s at the Feeder?', 'Cardinals Up Close', 'Building a Birdhouse', 'Hummingbird Season', 'Owls at Night', 'Ducks on the Pond', 'Spring Songbirds']],
  history: ['History Hour', 18, ['The Great Depression', 'Life in 1950s America', 'The Golden Age of Radio', 'Building the Interstate', 'The Moon Race', 'Main Street, Then and Now', 'The First Television Sets']],
  fixit: ['The Fix-It Shop', 210, ['Fixing a Leaky Faucet', 'Patching Drywall', 'Unsticking a Window', 'Replacing a Light Switch', 'Quieting a Squeaky Floor', 'Cleaning Gutters Safely']],
};
const DESC = {
  wood: 'Real woodworking at an easy pace, with hand tools and a few power tools.', garden: 'Gardening tips for every season, from the ground up.',
  kitchen: 'Home cooking the way it used to be, step by step.', travel: 'Slow travel to beautiful places, no rushing.',
  space: 'The night sky and the story of space exploration.', music: 'The great songs from the big band days to today.',
  cars: 'Classic cars, trains, tractors and the people who keep them running.', birds: 'The birds in your backyard and how to bring more of them.',
  history: 'Stories from the last hundred years, told plainly.', fixit: 'Small repairs around the house you can do yourself.',
};
const CAT = { wood: '26', garden: '26', kitchen: '26', travel: '19', space: '28', music: '10', cars: '2', birds: '15', history: '27', fixit: '26' };
const PEOPLE = ['Marge', 'Harold', 'Dottie', 'Walt', 'Bev', 'Earl', 'June', 'Frank', 'Lois', 'Gene', 'Ruth', 'Carl'];
const REPLIES = ['Same here!', 'Agreed, very well done.', 'Thanks for sharing that.', 'Me too, every Sunday.', 'Good tip, I\'ll try it.'];
const SAYS = ['I watched this twice. So well explained!', 'This takes me back. Thank you for making it.', 'Tried this last weekend and it worked.', 'My grandson and I watched this together.', 'Clear and calm. Wish all shows were like this.', 'Could you do one on the next step?', 'Beautiful. Brought a tear to my eye.', 'Saved for later, thank you!'];

const NOW = Date.now();
const CH = new Map();     // demo YouTube channels
const BY_CH = new Map();  // channel -> video ids, newest first
const PLAYLISTS = new Map();

(function build() {
  for (const [kind, [name, hue, titles]] of Object.entries(T)) {
    const cid = 'demo-ch-' + kind, r = rng(hash(kind));
    CH.set(cid, { id: cid, title: name, desc: DESC[kind], handle: '@' + name.toLowerCase().replace(/[^a-z0-9]/g, ''), thumb: '', subs: Math.floor(5e3 + r() * 9e5), videos: titles.length, fake: true, hue, at: NOW });
    const ids = [];
    titles.forEach((t, i) => {
      const id = 'demo-' + kind + '-' + i;
      const dur = Math.floor((8 + r() * 34) * 60 + r() * 59);
      putVideo({
        id, title: t, desc: DESC[kind] + ' In this episode: ' + t.toLowerCase() + '. Practice video for demo mode.', channelId: cid, channelTitle: name,
        publishedAt: NOW - Math.floor((i * 4 + r() * 3) * 86400e3), dur, live: 'none', caption: r() > 0.3, hd: r() > 0.2, embeddable: true, public: true, processed: true,
        age: false, views: Math.floor(1e3 + r() * 2e6), likes: Math.floor(10 + r() * 5e4), comments: Math.floor(r() * 900), thumb: '', categoryId: CAT[kind],
        fake: true, look: kind, hue, broken: kind === 'kitchen' && i === 1, at: NOW,
      });
      ids.push(id);
    });
    BY_CH.set(cid, ids);
    PLAYLISTS.set('demo-pl-' + kind, { kind: 'playlist', id: 'demo-pl-' + kind, title: 'Best of ' + name, desc: 'Favorites from ' + name + '.', channelId: cid, channelTitle: name, count: Math.min(6, ids.length), thumb: '', fake: true, hue, ids: ids.slice().reverse().slice(0, 6) });
  }
  // an empty channel, to show what "off the air" looks like
  CH.set('demo-ch-empty', { id: 'demo-ch-empty', title: 'River Country', desc: 'No videos yet.', handle: '@rivercountry', thumb: '', subs: 120, videos: 0, fake: true, hue: 160, at: NOW });
  BY_CH.set('demo-ch-empty', []);
  // a couple of "live right now" videos for On Demand > Live now
  [['Live: Eagle Nest Camera', 'birds', 140], ['Live: Sunday Polka Party', 'music', 320]].forEach(([t, kind, hue], i) => {
    putVideo({ id: 'demo-live-' + i, title: t, desc: 'Streaming live right now (demo).', channelId: 'demo-ch-' + kind, channelTitle: T[kind][0], publishedAt: NOW - 3600e3, dur: 0, live: 'live', caption: false, hd: true, embeddable: true, public: true, processed: true, age: false, views: 1500 + i * 700, likes: 90, comments: 12, thumb: '', categoryId: CAT[kind], fake: true, look: kind, hue, at: NOW });
  });
})();

const vid = id => VIDS.get(id);
const person = r => PEOPLE[Math.floor(r() * PEOPLE.length)] + ' ' + String.fromCharCode(65 + Math.floor(r() * 26)) + '.';
// the pretend signed-in account's likes, subscriptions, playlists and comments (kept on this computer)
const DY = () => { const d = S.demoYT || (S.demoYT = {}); for (const k of ['subs', 'playlists']) d[k] = d[k] || []; for (const k of ['ratings', 'comments', 'replies']) d[k] = d[k] || {}; return d; };
const mustSignIn = () => { if (!S.demoSignedIn) throw new ApiError('signedOut', 'You\'re not signed in to YouTube.'); };
const done = () => save();
const all = () => [...VIDS.values()].filter(v => v.fake && !v.gone);
const words = q => String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
const matches = (text, q) => { const t = text.toLowerCase(); return words(q).every(w => t.includes(w.replace(/s$/, ''))); };
const tick = (ms = 120) => new Promise(r => setTimeout(r, ms)); // pretend network delay
const AGE = { hour: 1 / 24, today: 1, week: 7, month: 31, year: 365 };

export const DEMO_LINEUP = [
  ['Workshop Two', 'wood'], ['Garden Patch', 'garden'], ['Supper Club', 'kitchen'], ['Wide World', 'travel'], ['Starwatch', 'space'],
  ['Ballroom', 'music'], ['Old Iron', 'cars'], ['Backyard Birds', 'birds'], ['History Hour', 'history'], ['River Country', 'empty'],
];

export const demo = {
  async videosInfo(ids) { await tick(30); return ids.map(vid).filter(v => v && !v.gone); },
  async channelUploadIds(id) { await tick(); return (BY_CH.get(id) || []).slice(); },
  async channelsInfo(ids) { await tick(30); return ids.map(id => CH.get(id)).filter(Boolean); },
  async resolveChannel(line) {
    await tick();
    const s = String(line).toLowerCase().replace(/^.*youtube\.com\//, '').replace(/^@/, '').trim();
    const c = [...CH.values()].find(c => c.id.toLowerCase() === s || c.handle.slice(1) === s.replace(/[^a-z0-9]/g, '') || c.title.toLowerCase().includes(s));
    if (!c) throw new ApiError('notFound', 'No practice channel matches "' + line + '". In demo mode, try: workshop, garden, supper, starwatch, ballroom.');
    return c;
  },
  async search(o) {
    await tick(250);
    const type = o.type || 'video';
    if (type === 'channel') return { items: [...CH.values()].filter(c => matches(c.title + ' ' + c.desc, o.q)).map(c => ({ ...c, kind: 'channel' })), next: null };
    if (type === 'playlist') return { items: [...PLAYLISTS.values()].filter(p => matches(p.title + ' ' + p.channelTitle, o.q)), next: null };
    let list = all().filter(v => matches(v.title + ' ' + v.desc + ' ' + v.channelTitle, o.q));
    if (o.live) list = list.filter(v => v.live === 'live'); else list = list.filter(v => v.live === 'none');
    if (o.duration === 'short') list = list.filter(v => v.dur < 240);
    if (o.duration === 'medium') list = list.filter(v => v.dur >= 240 && v.dur <= 1200);
    if (o.duration === 'long') list = list.filter(v => v.dur > 1200);
    if (o.date && AGE[o.date]) list = list.filter(v => NOW - v.publishedAt < AGE[o.date] * 86400e3);
    if (o.captions) list = list.filter(v => v.caption);
    if (o.hd) list = list.filter(v => v.hd);
    if (o.channelId) list = list.filter(v => v.channelId === o.channelId);
    if (o.order === 'date') list.sort((a, b) => b.publishedAt - a.publishedAt);
    else if (o.order === 'viewCount') list.sort((a, b) => b.views - a.views);
    else if (o.order === 'rating') list.sort((a, b) => b.likes - a.likes);
    else if (o.order === 'title') list.sort((a, b) => a.title.localeCompare(b.title));
    return { items: list.slice(0, 25).map(v => ({ ...v, kind: 'video' })), next: null, total: list.length };
  },
  async trending(category) { await tick(); let l = all().filter(v => v.live === 'none'); if (category) l = l.filter(v => v.categoryId === category); return l.sort((a, b) => b.views - a.views).slice(0, 30); },
  async categories() { return [{ id: '2', title: 'Autos & Vehicles' }, { id: '10', title: 'Music' }, { id: '15', title: 'Pets & Animals' }, { id: '19', title: 'Travel & Events' }, { id: '26', title: 'Howto & Style' }, { id: '27', title: 'Education' }, { id: '28', title: 'Science & Technology' }]; },
  async playlistInfo(id) { await tick(); const p = PLAYLISTS.get(id); if (!p) throw new ApiError('notFound', 'That playlist is private or gone.'); return p; },
  async channelPlaylists(cid) { await tick(); return [...PLAYLISTS.values()].filter(p => p.channelId === cid); },
  async playlistVideos(id) { await tick(); return ((PLAYLISTS.get(id) || {}).ids || []).map(vid).filter(Boolean); },
  async playlistIds(id) { return ((PLAYLISTS.get(id) || {}).ids || []).slice(); },
  async channelVideos(cid) { await tick(); return (BY_CH.get(cid) || []).map(vid).filter(Boolean); },
  async comments(id) {
    await tick(); const r = rng(hash(id)); const n = 4 + Math.floor(r() * 6);
    const mine = (DY().comments[id] || []).slice();
    const theirs = Array.from({ length: n }, (_, i) => ({ id: 'demo-c-' + id + '-' + i, author: person(r), text: SAYS[Math.floor(r() * SAYS.length)], likes: Math.floor(r() * 300), at: NOW - Math.floor(r() * 60 * 86400e3), replies: Math.floor(r() * 4), canReply: true }));
    return [...mine, ...theirs].map(c => ({ ...c, replies: c.replies + (DY().replies[c.id] || []).length }));
  },
  async replies(parentId) {
    await tick(); const r = rng(hash(parentId + 'r')); const n = 1 + Math.floor(rng(hash(parentId))() * 3);
    const base = parentId.startsWith('demo-mine-') ? [] : Array.from({ length: n }, (_, i) => ({ id: parentId + '.r' + i, author: person(r), text: REPLIES[Math.floor(r() * REPLIES.length)], likes: Math.floor(r() * 40), at: NOW - Math.floor((n - i) * 86400e3 * r()) }));
    return [...base, ...(DY().replies[parentId] || [])];
  },
  async fullDescription(id) { return (vid(id) || {}).desc || ''; },
  async testKey() { throw new ApiError('key', 'Demo mode has no key to test.'); },
  async channelTab(cid, tab) {
    await tick(); const l = (BY_CH.get(cid) || []).map(vid).filter(Boolean);
    if (tab === 'popular') return l.slice().sort((a, b) => b.views - a.views);
    if (tab === 'live') return all().filter(v => v.channelId === cid && v.live !== 'none');
    return []; // no practice Shorts
  },

  // ---- the pretend signed-in account ----
  async myChannel() { mustSignIn(); await tick(); return { id: 'demo-ch-me', title: 'Demo Viewer', desc: '', handle: '@demoviewer', thumb: '', subs: 0, videos: 0, fake: true, hue: 40 }; },
  async mySubscriptions() { mustSignIn(); await tick(); return DY().subs.map(id => CH.get(id)).filter(Boolean).map(c => ({ subId: 'demo-sub-' + c.id, id: c.id, title: c.title, desc: c.desc, thumb: '', fake: true, hue: c.hue })).sort((a, b) => a.title.localeCompare(b.title)); },
  async subscription(cid) { mustSignIn(); await tick(40); return DY().subs.includes(cid) ? 'demo-sub-' + cid : null; },
  async subscribe(cid) { mustSignIn(); await tick(); const d = DY(); if (!d.subs.includes(cid)) d.subs.push(cid); done(); return 'demo-sub-' + cid; },
  async unsubscribe(subId) { mustSignIn(); await tick(); const d = DY(); d.subs = d.subs.filter(id => 'demo-sub-' + id !== subId); done(); },
  async getRating(id) { mustSignIn(); await tick(40); return DY().ratings[id] || 'none'; },
  async rate(id, rating) { mustSignIn(); await tick(); const d = DY(); if (rating === 'none') delete d.ratings[id]; else d.ratings[id] = rating; done(); },
  async myLiked() { mustSignIn(); await tick(); const d = DY(); return Object.keys(d.ratings).filter(id => d.ratings[id] === 'like').map(vid).filter(Boolean); },
  async myPlaylists() { mustSignIn(); await tick(); return DY().playlists.map(p => ({ kind: 'playlist', id: p.id, title: p.title, desc: '', channelId: 'demo-ch-me', channelTitle: 'Demo Viewer', count: p.ids.length, thumb: '', fake: true, hue: 40, mine: true, privacy: 'private' })); },
  async myPlaylistVideos(id) { mustSignIn(); await tick(); const p = DY().playlists.find(p => p.id === id); return p ? p.ids.map(vid).filter(Boolean) : []; },
  async createPlaylist(title) { mustSignIn(); await tick(); const p = { id: 'demo-mypl-' + Date.now().toString(36), title, ids: [] }; DY().playlists.push(p); done(); return { kind: 'playlist', id: p.id, title, desc: '', channelId: 'demo-ch-me', channelTitle: 'Demo Viewer', count: 0, thumb: '', fake: true, hue: 40, mine: true, privacy: 'private' }; },
  async addToPlaylist(pid, videoId) { mustSignIn(); await tick(); const p = DY().playlists.find(p => p.id === pid); if (!p) throw new ApiError('notFound', 'That playlist is gone.'); if (!p.ids.includes(videoId)) p.ids.push(videoId); done(); },
  async postComment(videoId, text) {
    mustSignIn(); await tick(); const c = { id: 'demo-mine-' + Date.now().toString(36), author: 'Demo Viewer', text, likes: 0, at: Date.now(), replies: 0, canReply: true, mine: true };
    const d = DY(); (d.comments[videoId] = d.comments[videoId] || []).unshift(c); done(); return c;
  },
  async reply(parentId, text) {
    mustSignIn(); await tick(); const c = { id: parentId + '.mine' + Date.now().toString(36), author: 'Demo Viewer', text, likes: 0, at: Date.now(), mine: true };
    const d = DY(); (d.replies[parentId] = d.replies[parentId] || []).push(c); done(); return c;
  },
};
