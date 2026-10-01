// Start-up: load the saved lineup, build the screen, the TV and the remote.
import { app } from './app.js';
import { S, save } from './store.js';
import { $ } from './util.js';
import * as L from './lineup.js';
import { Screen } from './screen.js';
import { Guide } from './guide.js';
import { TV } from './tv.js';
import { bindKeys } from './keys.js';
import { buildRemote } from './remote.js';
import { isDemo } from './source.js';
import { flush } from './vids.js';
import { ledSVG } from './led.js';
import * as menus from './pages/menus.js';
import * as browse from './pages/browse.js';
import * as setup from './pages/setup.js';

(async function boot() {
  document.body.classList.toggle('big', !!S.tv.bigText);
  await L.loadAll();
  app.pages = { ...menus, ...browse, ...setup };
  app.screen = new Screen();
  app.guide = new Guide($('#guide'));
  app.tv = new TV($('#player'));
  app.remote = buildRemote($('#remote'), app.tv);
  bindKeys(app.tv);
  $('#turnOn').addEventListener('click', () => app.tv.press('power'));
  $('#demoNote').hidden = !isDemo();

  // the cable box shows the time while the TV is off
  const led = () => { const d = new Date(), h = d.getHours() % 12 || 12; $('#led').innerHTML = ledSVG((h < 10 ? ' ' : '') + h + ':' + String(d.getMinutes()).padStart(2, '0')); };
  led(); setInterval(led, 5000);
  app.screen.sync();

  // the browser's Back button (and a Fire TV remote's Back) works like BACK
  history.replaceState({ cs: 0 }, ''); history.pushState({ cs: 1 }, '');
  addEventListener('popstate', () => { history.pushState({ cs: 1 }, ''); app.tv.press('back'); });
  addEventListener('beforeunload', () => { app.tv.leaveVod(); save(true); flush(); });
  // keep channels fresh while the TV stays on all day
  setInterval(() => { if (app.tv.on) L.refreshAll(app.tv.ch.id); }, 30 * 60e3);
  window.channelSurf = app; // handy for troubleshooting from the browser console
})();
