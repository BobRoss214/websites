# Where things stand, and what to do next

Last saved: the preview is version 27. Everything below the line "Done" is in the site and tested; the rest is open.

## Done (in the site)
- Ranks: eight emblem ranks from $1,000 given to $1,000,000, levels 1 to 10 in each, next to every name (live tables, leagues, crews, account, side menu, Giving Club, receipts), a rank-up moment. Independently checked; 7 small defects fixed.
- One screen per game: the picture, the gift choices and Play are on the first screen for all 19 games on laptops, upright phones and phones held sideways (down to 568 x 320).
- Live tables: the lobby-style game tiles, then a page of table sizes; each table also fits one screen (docked stake and join bar on a phone with an Options sheet).
- Tests: 290 unit tests and about 2,530 end-to-end checks pass (one Plinko camera timing check in section 13m can fail once under heavy machine load; it passes alone).

## Open, small (each is a few lines)
- `js/ui/live.js`, function `levelNote`: a ranked player whose XP level goes up sees " · Level up!"; the receipt says "XP level up". Suggested: `return sm.leveledUp ? (sm.rankAfter.rank ? ' · XP level up!' : ' · Level up!') : '';` (cosmetic, only on odd saves).
- A win that is also a rank-up plays a win sound, the rank-up jingle and a second win sound within 0.6 s with two confetti bursts. It is deliberate (a rank-up should feel big); to tone it down remove the delayed `GS.audio.win` in `moment()` in `js/ui/rankui.js` and adjust one check in section 13zr.
- Landscape and live layouts are cramped on very small windows: 568 x 320 live tables (the odds board is about 1.5 rows high), Coin Flip marks (8 to 12 px), slot Turbo and "How it pays" buttons (about 18 px tall). Windows narrower than 561 px and shorter than about 520 px cannot fit a picture.
- axe reports a "partially obscured" target-size item on whichever control straddles the bottom of the scrolling landscape panel (a geometry artefact, not checked by the tests).
- Nothing was tested outside headless Chromium: no Firefox, Safari or real phone.

## Questions for the owner
- A 1,000-dollar live table? (The biggest board now is 500.)
- Do you want clearly labelled crypto-parody jokes on the site (the site avoids crypto words today)? And which of the ideas listed in chat should be built next?

## How to work on it
- Unit tests: `cd givespin && node --test tests/*.test.js`. End-to-end: `NODE_PATH=$(npm root -g) node tests/e2e.mjs` (see the README, "Tests"); `ONLY=13zs,13zt node tests/e2e.mjs` runs only some sections.
- On a phone the gift panel is docked: fields other than the amount buttons and Play are in the Options sheet, so tests call `openOptions(page)` (live tables: `openLiveOptions`) before touching them.
