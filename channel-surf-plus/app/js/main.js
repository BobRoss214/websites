// Start-up: load the saved lineup, build the screen, the TV and the remote.
import { app } from './app.js';
import { S, save, db } from './store.js';
import { $ } from './util.js';
import * as L from './lineup.js';
import { Screen } from './screen.js';
import { Guide } from './guide.js';
import { TV } from './tv.js';
import { bindKeys } from './keys.js';
import { buildRemote } from './remote.js';
import { isDemo, yt } from './source.js';
import { account } from './account.js';
import { flush } from './vids.js';
import { ledSVG } from './led.js';
import * as menus from './pages/menus.js';
import * as browse from './pages/browse.js';
import * as setup from './pages/setup.js';
import * as youtube from './pages/youtube.js';

(async function boot() {
  document.body.classList.toggle('big', !!S.tv.bigText);
  // coming back from Google's sign-in page (tv.py sends us back with ?oauth=...)
  const signedBack = new URLSearchParams(location.search).get('oauth');
  if (signedBack) try { history.replaceState(null, '', location.pathname); } catch {}
  await L.loadAll();
  app.pages = { ...menus, ...browse, ...setup, ...youtube };
  app.screen = new Screen();
  app.guide = new Guide($('#guide'));
  app.tv = new TV($('#player'));
  app.remote = buildRemote($('#remote'), app.tv);
  bindKeys(app.tv);
  $('#turnOn').addEventListener('click', () => app.tv.press('power'));
  $('#demoNote').hidden = !isDemo();
  // the online demo (not on this computer) can't connect to YouTube: say so
  if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) $('#demoNote').textContent = 'Online demo with practice channels. The real YouTube version runs on your own computer.';
  const SIGNED = { ok: 'Signed in to YouTube ✓', failed: 'Signing in to YouTube didn\'t finish. You can try again in Setup.', denied: 'YouTube sign-in was cancelled.', notconfigured: 'YouTube sign-in isn\'t set up yet (see Setup).' };
  if (signedBack && SIGNED[signedBack]) { $('#demoNote').hidden = false; $('#demoNote').textContent = SIGNED[signedBack]; }
  // is someone signed in to YouTube? (only matters for the menus, so don't hold up start-up)
  account.refresh().then(a => { if (a.signedIn && (!S.account || signedBack === 'ok')) return yt.myChannel().then(c => { S.account = { name: c ? c.title : 'you' }; save(); }); }).catch(e => console.warn('account', e));

  // the cable box shows the time while the TV is off
  const led = () => { const d = new Date(), h = d.getHours() % 12 || 12; $('#led').innerHTML = ledSVG((h < 10 ? ' ' : '') + h + ':' + String(d.getMinutes()).padStart(2, '0')); };
  led(); setInterval(led, 5000);
  app.screen.sync();

  // the browser's Back button (and a Fire TV remote's Back) works like BACK
  try {
    history.replaceState({ cs: 0 }, ''); history.pushState({ cs: 1 }, '');
    addEventListener('popstate', () => { try { history.pushState({ cs: 1 }, ''); } catch {} app.tv.press('back'); });
  } catch {}
  addEventListener('beforeunload', () => { app.tv.leaveVod(); save(true); flush(); });
  // the "Forgot the Setup PIN" page cleared the PIN in another window: don't save the old one back
  addEventListener('storage', e => { if (e.key !== 'channelSurfPlus.v1' || !e.newValue) return; try { const n = JSON.parse(e.newValue); if (n.pin !== S.pin) S.pin = n.pin || ''; } catch {} });
  // keep channels fresh while the TV stays on all day
  setInterval(() => { if (app.tv.on) L.refreshAll(app.tv.ch.id); }, 30 * 60e3);
  // tidy the browser's database now and then: old YouTube answers (kept for at most a week anyway)
  setTimeout(async () => { try { const keys = await db.keys('api:'); const vals = await db.getMany(keys); keys.forEach((k, i) => { if (!vals[i] || Date.now() - vals[i].at > 7 * 86400e3) db.del(k); }); } catch {} }, 60e3);
  window.channelSurf = Object.assign(app, { lineup: L, settings: S }); // handy for troubleshooting from the browser console
})();
