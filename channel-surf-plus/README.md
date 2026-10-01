# Channel Surf Plus

YouTube as old-school cable TV, with search, on demand and more inside 1997-style
cable box menus. Start here: **[HOW-TO.md](HOW-TO.md)** (plain English setup).

```
python3 tv.py                      start the TV (http://localhost:8642, full screen)
python3 tv.py --install-shortcut   add a desktop icon
node tests/run-tests.js            automatic tests against a pretend YouTube
```

Research and design decisions live in [../channel-surf/RESEARCH.md](../channel-surf/RESEARCH.md)
and [../channel-surf/DECISIONS.md](../channel-surf/DECISIONS.md). The look was
picked from the mockups in [../channel-surf/mockups/](../channel-surf/mockups/).

## Files

```
tv.py                 the start program: tiny local web server + opens the browser full screen
app/index.html        the TV screen (one page)
app/css/tv.css        the look: navy bevelled boxes, gold highlights
app/fonts/            Barlow Condensed (bundled, SIL Open Font License)
app/reset-pin.html    clears a forgotten Setup PIN
app/js/
  main.js             start-up
  tv.js               the TV: power, tuning, static, volume, captions, on-demand playback, error recovery
  screen.js           what's on screen and where the picture sits (the "squeeze"; nothing over the video)
  lineup.js           channels, video pools, filters, the clock-based schedule
  guide.js            the guide channel
  player.js           YouTube's embedded player (nocookie) + the practice player for demo mode
  api.js              YouTube Data API v3: quota counting, caching, plain-English errors
  demo.js             the practice catalog used until a key is added
  source.js           picks real YouTube or the demo
  store.js, vids.js   settings (localStorage) and the video shelf (IndexedDB)
  keys.js, remote.js  keyboard / TV remote keys and the on-screen remote
  sound.js, cards.js, led.js   sounds, full-screen cards (static, bars, idents), LED clock
  pages/              menu screens: base (lists), menus, browse (search, video, channel...), setup
tests/                pretend YouTube (player + data API) and the browser test runner
```
