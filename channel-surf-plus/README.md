# Channel Surf Plus

YouTube as old-school cable TV, with search, on demand, chapters, comments and
more inside 1997-style cable box menus. Optional sign-in puts likes,
subscriptions, playlists and comments on your real YouTube account.
Start here: **[HOW-TO.md](HOW-TO.md)** (plain English setup).

```
python3 tv.py                      start the TV (http://localhost:8642, full screen)
python3 tv.py --install-shortcut   add a desktop icon
node tests/run-tests.js            automatic tests in a real browser against a pretend YouTube (84 checks)
python3 -m unittest tests/test_oauth.py   tests for the sign-in part of tv.py (42 checks)
```

Research and design decisions live in [../channel-surf/RESEARCH.md](../channel-surf/RESEARCH.md)
and [../channel-surf/DECISIONS.md](../channel-surf/DECISIONS.md). The look was
picked from the mockups in [../channel-surf/mockups/](../channel-surf/mockups/).

## Files

```
tv.py                 the start program: tiny local web server, opens the browser full screen,
                      and keeps the optional Google sign-in (private file in ~/.config/channel-surf/)
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
  api.js              YouTube Data API v3: quota counting, caching, plain-English errors, signed-in calls
  account.js          the optional sign-in: asks tv.py for short-lived passes
  qr.js               QR codes for "watch on your phone"
  demo.js             the practice catalog used until a key is added
  source.js           picks real YouTube or the demo
  store.js, vids.js   settings (localStorage) and the video shelf (IndexedDB)
  keys.js, remote.js  keyboard / TV remote keys and the on-screen remote
  sound.js, cards.js, led.js   sounds, full-screen cards (static, bars, idents), LED clock
  pages/              menu screens: base (lists), menus, browse (search, video, channel, chapters...),
                      youtube (your account, the typing keyboard), setup (incl. "Check everything")
tests/                pretend YouTube (player + data API, incl. signed-in calls), the browser test runner,
                      the sign-in tests, and the QR code test (checks every code with a decoder)
```
