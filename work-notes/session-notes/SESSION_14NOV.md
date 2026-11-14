# Session of 13-14 Nov 2026 (Claude Code on the builder's laptop). READ THIS FIRST, then FEATURE_PLAN.md.

Stopped early: the builder ran out of usage. This branch (`claude/wise-acres-fixes-14nov`) holds everything done. It was NOT pushed to the real-website branch, because the test run was not finished (see "Not proven").

## Done (in this branch)
- Bug fixes from a code check: `js/live.js` (a closure longer than two weeks no longer gives "Closed for now" or a missing farm badge), `js/main.js` (crop rows redraw only when the width changes; modifier-clicks on group links are left to the browser; a guard in the season cards), `js/i18n.js` (no "null" attribute; an unused line gone), `js/demo-app.js` and `js/demo-store.js` (a hash like #constructor, a saved state with a part missing, only #links in notices), `css/sections.css` (two animations shared the name twinkle; the stars' one is starTwinkle now).
- Owner tools: `tools/close_today.py` (a comment inside closures: [...] no longer breaks the edit), `tools/change_fact.py` (a number in a translation is swapped as a whole number, all pairs at once, never when it is written elsewhere in the text; files saved by Notepad with a byte order mark are read), `tools/i18n.py` (`missing --list es` works).
- `tests/pipeline.test.mjs` skips the `.venv` folder (it crashed on it).
- Known issue 1 and 2 (speed): the three Latin fonts are slimmed by the new `tools/font_subset.py` (full fonts kept in `tools/fonts-full/`, new test `tests/font-letters.test.mjs`). `slow-phone` passed (22 checks).
- Known issue 3 (winter picture at 1440 x 900): `js/hero.js` sets `--hero-above` (the real height above the hero) and `css/hero.css` has a winter rule for wide, short windows. In `tests/hero` the winter 1440 x 900 check passed.

## Not proven
- `node tests/run-all.mjs --changed --run` was stopped part-way: 24 tests passed, 7 were red (moved-pages, doc-commands, tools-safety, close-today, windows-reality, doctor, calendar-doc). The log is `TEST_RUN_14NOV.log` in this folder. NOT yet checked which are from this session and which were red before (the pulled head was never fully tested). moved-pages is red because an optional patch no longer applies to `lang/src/zh.json` (not touched here). close-today, tools-safety, doctor and doc-commands touch the tools edited here: look at these first.
- `tests/hero`: one line is red, "hi: no tag covers a letter of the buttons". It is red on an untouched copy too (old).
- The whole test set was never run.

## Asked for by the builder and NOT started (her words are in the chat; short form here)
1. Christmas trees, confirmed: Friday, Saturday, Sunday right after Thanksgiving (2026: Nov 27, 28, 29) and Saturday, Sunday the first weekend of December (Dec 5, 6). The GreenHouse (trees, pizza kitchen, ice cream shop) 11 am to 7 pm. The farm is open those days with no rides and closes at 5 pm. TVs with Christmas shows, Christmas music, a campfire, s'mores to buy. This replaces "Saturday and Sunday only, 11 am to 8 pm, Not official yet". URGENT: the site is wrong today.
2. "Quick answers" box: first thing in the Visit part and first in the Visit menu, highlighted, bold question and plain answer (reservation, when open, what to pick, what The GreenHouse is, pizza, dogs, rain, paying, parking). Only facts the site already has.
3. New farm map in the layout and names of the farm's own sign (photo `IMG_20261002_193519_947.jpg` in `/home/farming/wise acres products pics/`), clean and simple, numbered list "Attractions" and "Ticketed attractions". Always "Wagon ride", never "hay ride".
4. From the 66 photos: add tomato varieties Red Cherry and Caspian Pink; the flower cutting guide (marigolds, celosia, zinnias) and the u-cut steps with the "wiggle" test; all five candle and spray scents; the two ciders South end semi-sweet 6.2% and Chai jacked semi-sweet 6.25% (they are not sold out); the beer place line "at the barn at Wise Acres and at the ice cream shop at The GreenHouse"; spellings of the red chalkboard (Nobilo, Oskar Blues, Bramblin' Blackberry). Sign conflicts (jam, shrub, juice box) stay as they are. No book drive.
5. The bee is choppy when it follows the mouse: make it smooth.
6. Fall picture: one row of tomato plants right of the pumpkin patch with people picking; people in the pumpkin patch and in the other patches.
7. The approved feature plan: `FEATURE_PLAN.md`. Projects for later: `LATER_PROJECTS.md`. Language feedback page: `LANGUAGE_NOTES.md`.

## Her new standing wish
Do not ask her about tiny details (a spelling, an apostrophe, which of two signs): decide, note it, move on. Real facts are still never invented.
