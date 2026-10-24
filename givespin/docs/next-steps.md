# Where things stand, and what to do next

Last saved: the preview is version 28. Everything below the line "Done" is in the site and tested; the rest is open.

## Done (in the site)
- Ranks: eight emblem ranks from $1,000 given to $1,000,000, levels 1 to 10 in each, next to every name (live tables, leagues, crews, account, side menu, Giving Club, receipts), a rank-up moment. Independently checked; 7 small defects fixed.
- One screen per game: the picture, the gift choices and Play are on the first screen for all 19 games on laptops, upright phones and phones held sideways (down to 568 x 320).
- Live tables: the lobby-style game tiles, then a page of table sizes; each table also fits one screen (docked stake and join bar on a phone with an Options sheet).
- A review of the recent work (8 real bugs fixed), a walkthrough on phones, tablets and big screens (card layouts, sticky receipt buttons) and a pass on the smallest windows are all in.
- Tests: 290 unit tests and about 2,620 end-to-end checks pass (a few timing-based checks, for example 13m, 13c and 13za, can fail once under heavy machine load; each passes alone).

## Open, small (each is a few lines)
- A win that is also a rank-up plays a win sound, the rank-up jingle and a second win sound within 0.6 s with two confetti bursts. It is deliberate (a rank-up should feel big); to tone it down remove the delayed `GS.audio.win` in `moment()` in `js/ui/rankui.js` and adjust one check in section 13zr.
- The smallest windows are much better but not perfect. Done: live tables on a phone held sideways show 2 board rows at 568 x 320 (it was a third of one) and 3 to 4 from 640 x 360; Coin Flip slots, Dice tiles and the slot machine's Turbo, "How it pays" and lever have bigger hit areas; a narrow AND short window (up to 560 x 520: a small phone held sideways, a phone with its keyboard open) keeps thin bars and a compact dock and scrolls the picture into view; 320 px wide phones fit all 19 games and every live table except the 25-tile Last One Standing board at 320 x 568. Left: on a 568 x 320 phone a Coin Flip slot is about 22 x 15 px with 8 charities and 9 px with 16 (and a slot machine's symbol buttons are about 15 px wide with 12 reels), because the picture is shrunk; they only open a charity's profile. A real phone's on-screen keyboard was never tried: on Android Chrome the keyboard may not shrink the page the way the tests assume, which `interactive-widget=resizes-content` in the viewport meta tag of `index.html` would make so.
- axe's `target-size` rule calls a control that the edge of the scrolling panel cuts in two "partially obscured" at rest (844 x 390, 1280 x 600). It is not a small target, so there is no fix; section 13zt scans where nothing is cut.
- Android Chrome keeps the page the same size when the keyboard opens, so the docked sheet may sit under the keyboard there. Adding `interactive-widget=resizes-content` to the viewport meta tag in `index.html` would make it behave like the tests' emulation; it changes every page, so it needs a real phone to check.
- Other suggestions left by the helpers: a lobby on a 320 to 375 px phone shows no game tile on its first screen (the welcome banner and Live strip fill it); the tour card covers the tile it explains; the docked bar on a tablet is stretched to 700 to 750 px; double-tapping a live join button places and then cancels the bet (a design call).
- Nothing was tested outside headless Chromium: no Firefox, Safari or real phone.

## Questions for the owner
- A 1,000-dollar live table? (The biggest board now is 500.)
- Do you want clearly labelled crypto-parody jokes on the site (the site avoids crypto words today)? And which of the ideas listed in chat should be built next?

## How to work on it
- Unit tests: `cd givespin && node --test tests/*.test.js`. End-to-end: `NODE_PATH=$(npm root -g) node tests/e2e.mjs` (see the README, "Tests"); `ONLY=13zs,13zt node tests/e2e.mjs` runs only some sections.
- On a phone the gift panel is docked: fields other than the amount buttons and Play are in the Options sheet, so tests call `openOptions(page)` (live tables: `openLiveOptions`) before touching them.
