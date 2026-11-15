# Helper "lobby" (wave 3): games first on the lobby, today's quests first on phones

STATUS: FINISHED (hand-off). Work copy `ag-lobby/work/givespin`; patch `handoff/changes.patch` (`cd ag-lobby && diff -ruN base/givespin work/givespin > handoff/changes.patch`).
Verified in headless Chromium only (Playwright 1.63). No real phone, Safari, Firefox or screen reader.

## What a visitor sees now
**Lobby.** A game tile (its picture and its name) is on the first screen at every size asked for, and the Live tables strip is kept (four playable table cards), one row lower.
- The three welcome banners are smaller (about 198 px tall on a laptop, 224 px on a tall phone, was 284 to 366). The little picture sits in the card's corner instead of taking a column; every sentence and button is still shown in full.
- The Live tables strip sits right under the FIRST ROW of tiles (not above the tiles). On a phone (up to 720 px wide) the house-edge strip goes there with it.
- On a short window (up to 759 px high on a phone or small tablet, or any window up to 520 px high, i.e. a phone held sideways) the welcome banners come down under the first row too, so the games are what the first screen shows. On a tall phone (390 x 844, 412 x 915, 360 x 800) and on laptops and tablets the banner row stays on top.
- On a phone the category tabs are one row you swipe (they were 3 rows), with "Filters" at the right; "Repeat last round" is an icon there (see questions), hidden until a round has been played.
- On a phone held sideways the tiles are as many to a row as fit (4 to 5), not two giant ones.
- Nothing was added or removed: same words, same links, same four blocks under the tiles (24e and 31d still pass untouched).

**Quests page on a phone** (windows up to 700 px wide): "Today's quests" and "This week's quests" now come right after the page heading, BEFORE the season section and its 30-row track. Today's quests start 273 px down at 390 x 844 (315 px at 320 x 568); they were about 3,400 px down. Wide windows (701 px and up) are exactly as before (season on top with its strip, the two lists side by side under it).

## Where the first tile starts now (px from the page top, first screen = window height; fresh save, scroll 0)
| window | before (base) | now | the whole tile (picture and name) shows? |
| --- | --- | --- | --- |
| 1366 x 768 | 820 | 464 (bottom 717) | yes |
| 1280 x 720 | 857 | 484 (bottom 716) | yes (by 4 px) |
| 1024 x 768 | 903 | 490 (bottom 760) | yes |
| 768 x 1024 | 1005 | 592 (bottom 856) | yes |
| 390 x 844 | 1086 | 513 (bottom 730 of 781 above the bottom bar) | yes |
| 375 x 667 | 1130 | 279 (bottom 488 of 604) | yes |
| 360 x 640 | 1150 | 279 (bottom 478 of 577) | yes |
| 320 x 568 | 1336 | 299 (bottom 472 of 505) | yes |
| 844 x 390 (phone sideways) | 969 | 206 (bottom 380) | yes |
| 915 x 412 | 969 | 206 (bottom 397) | yes |
| 667 x 375 | 841 | 196 | picture yes (116 px above the 63 px bottom bar), the name is under the bar |
| 568 x 320 (a very small phone sideways) | n/a | 215 | NOT reached: about 105 px of the picture show; not asked for, not tested |
| 1920 x 1080 / 2560 x 1440 | 781 | 525 | yes (roomy banners kept above 1500 px wide and 820 px high) |

## Files
- `js/ui/lobby.js` (shared file, small localized edits): (1) header comment; (2) the "Repeat last round" button's words are wrapped in `<span class="lbl">` and it gets `title="Repeat last round"` (same words, still its name for a screen reader); (3) a new block before `build()`: `placeExtras()`, `onResize()` and two media-query strings (`PHONE`, `GAMES_FIRST`); it moves the SAME nodes (`.promos`, `.housestrip`, the Live tables strip) into the tile grid after the first row (or back to their old place), so ids, handlers and links keep working and the reading and Tab order equal the drawn order; focus is put back if it was inside a node that moved; (4) `window.addEventListener('resize', onResize)` at the end of `build()` (120 ms debounce); (5) `placeExtras()` at the end of `render()` (a category hides tiles, so the first row changes).
- `css/walk.css` (appended at the end, one section "The lobby's first screen"; the file is loaded last): the things that move into the grid take a whole row; smaller banners up to 1500 px wide or 820 px high; phone chip row; landscape-phone tile size and spacing.
- `js/ui/quests.js` (quests helper's file; small localized edit): `arrange()` after `var wiredRoot`, called at the end of `root.innerHTML = pageHTML(last)` in `render()`, plus a debounced resize listener. It moves the `.qquests` node before the `.qseason` node on a window up to 700 px wide and back after it on a wider one. DOM move, not CSS `order`, so the reading and Tab order match the picture.
- `tests/sections/32-lobby.mjs` (new): sections 32a to 32h (below).
- `README.md`: the lobby paragraph, the quests-page sentence, the `css/walk.css` structure line. `docs/next-steps.md`: the two owner questions ("Games first", "Quests on a phone") removed; one line each added to "Done" saying how; one line added to "Open, small" (smallest screens).
- No new top-level js/css file, so no README structure line, no `index.html` / `sw.js` / precache change. No unit test added (the logic is DOM placement; the unit-test count line is unchanged: 488).

## Tests
New, `tests/sections/32-lobby.mjs` (233 checks in the last run: 32a 46, 32b 25, 32c 39, 32d 12, 32e 59, 32f 18, 32g 27, 32h 7):
- 32a: at 1366x768, 1280x720, 1024x768, 768x1024, 390x844, 375x667, 360x640 and 320x568, 844x390, 667x375, 915x412: the first tile's top + 150 px is above the bottom of the window; also above the phone's bottom bar (100 px at 667x375, 150 px elsewhere); and the whole tile (picture and name) fits where it is reachable (every size above except 667x375). I chose the strict "whole tile" form wherever the numbers allow it; 667 x 375 and 568 x 320 are the two that do not (stated in the file's header).
- 32b: the Live tables strip exists at six sizes, sits under exactly one row of tiles (the rest of the tiles follow under it, inside the grid), has four `<a href="#live-...">` cards, "All tables" (#live), the words about bots; pressing the first card opens that live table and "All tables" opens the Live tables page (laptop and 375x667).
- 32c: the three banners keep every sentence (12 phrases), every heading/sentence/button is shown and not clipped or line-clamped (so nothing was hidden to make them smaller), the buttons still go to #game-wheel, #club, #fair, the house-edge strip is shown with its sentence and its "How we make money" link; and the buttons and link are clicked on a laptop and a 375x667 phone.
- 32d: the strips follow the window: 390x844 -> 844x390 -> 390x844 -> 1366x768 (the order of strips, tiles and blocks in the page equals the order drawn; a game tile on the first screen after each resize; a link focused inside a strip that moves keeps focus).
- 32e: at four sizes with a ranked save ($1,000 given), reduced motion, Slots chosen, and Table games chosen on a ranked save: a tile on the first screen, the blocks (about 1,000 px) still under the last tile and above "Pick a cause first", no sideways scroll, only that category's tiles show (5, or 4 for Table games) and the strip is still under the first row.
- 32f: no sideways scroll at ten sizes (320x568 ... 2560x1440), the Filters button on screen, the chip row scrolls inside itself and its last chip is reachable with the keyboard at 320 px, the Repeat button (hidden when disabled; icon 24 px or more with its name when enabled), Stream Mode at 1366x768 and 390x844 (no sideways scroll, the lobby blocks not on screen).
- 32g: Quests: at 390x844, 375x667, 320x568, 700x900 and 667x375 today's, then this week's quests come before the season and the track (DOM and drawn); at 701x900, 1024x768, 1366x800 and 2560x1440 the season stays on top; resizing moves it both ways; 3 daily + 3 weekly quests and 30 tiers all still there; "Go to my tier" works on a phone (focus on a tier button, in view) and on a laptop; the track is still a sideways strip on a laptop.
- 32h: axe 4.10.3 on the lobby at 1366x768, 390x844, 844x390 (ranked save) and on the Quests page at 390x844: 0 violations.

Existing sections run on the final tree (headless Chromium, AXE on, 2 at a time, snapshot of the tree): 1, 2, 11, 13, 13b (both), 13i (the tour), 13q, 13t, 13zs, 13zt, 13zu, 15, 16, 19z, 22a-h, 23a-h, 24a-e, 26a-l, 31a-d, 32a-h (59 sections): 1,441 checks ok, 1 failed in the first run, and that one is the known load-sensitive `13zu` "the whole game picture, clear of the panel and the navigation bar" (standing picture bottom 469 vs floor 467); it passed when re-run alone with the final tree (second run: see "Second run" below). Unit tests: 488 pass.
Second run (final tree, 20 sections): 13zu 32a-h 24e 31d 1 13i 13b 26b 26e 26f 28a 29a 13q.

### Tests I changed
None. No assertion in an existing file was edited, loosened or deleted. (24e, 31d, 26a-l, 22a-h, 13i and the layout sections all pass unchanged.)

## Questions for the owner (judgement calls; none decided beyond what is described above)
1. **Welcome banners under the games on short windows.** On a phone up to 759 px high (375 x 667, 360 x 640, 320 x 568, most Android phones with the browser's bars showing) and on a phone held sideways, the welcome banner row, the house-edge strip and the Live tables strip all start under the first row of tiles, so the first thing a new visitor sees is games (the banner is one scroll away). On a tall phone and every laptop and tablet the banner row is still first. Recommendation: keep, because on a 667 px phone the banner alone would push the tiles behind the bottom bar; if you want the banner always first, set `GAMES_FIRST` in `js/ui/lobby.js` to `'(max-height: 520px)'` (then 667-high phones show the first tile only partly).
2. **House-edge strip under the first row on phones** (the words are unchanged: "House edge: 0%. The house is a charity. How we make money: we do not."). Recommendation: keep; it is still on the lobby, under the first row.
3. **"Repeat last round" as an icon on phones**, switched off and hidden until a round has been played. Its words stay as its name for a screen reader and as its tooltip, but a sighted phone user sees only the loop icon. Recommendation: keep (the row has no room for the words and a fresh visitor has nothing to repeat); alternative: put the words back and let that button join the swipe row.
4. **Quests on a phone: the season summary (tier, points, Claim all, Go to my tier) now sits under the two quest lists**, with the track. Recommendation: keep; a "rewards to claim" count is also on the side menu's badge and the lobby's Quests block. Alternative (more work): split the season section so its summary stays above the lists and only the track moves below.
5. **The Live tables strip splits the tile grid** (row 1, strip, then the other rows). Recommendation: keep (you like the strip, and under the first row it is on or just below the first screen at 1366x768 and 390x844); alternative: under the last tile, above the four blocks.

No wording was changed, added or removed (the lead need not read any text diff). One markup change: the Repeat button's text is inside `<span class="lbl">`.

## Merge cautions
- `js/ui/lobby.js`: five small hunks (header comment; the Repeat button's markup line inside `build()`; the new block between `drawBlocks()` and `build()`; `window.addEventListener('resize', onResize)` at the end of `build()`; `placeExtras()` at the end of `render()`). Anyone else adding to `build()`'s HTML string near the Repeat button will conflict on that one line.
- `css/walk.css`: my block is appended after the last rule (after `.qblock__ready { white-space: nowrap; }`). If other helpers append there too, keep all blocks (mine start at the comment "The lobby's first screen").
- `js/ui/quests.js`: one block after `var wiredRoot = null;` and one added line `arrange();` after `root.innerHTML = pageHTML(last);` in `render()`. Polish helper's quest deep links (if they scroll to a quest card) are unaffected, but if they position something relative to `.qseason` or `.qquests`, run 26 and 32g.
- `README.md`: three small spots (lobby paragraph near the top, the Quests paragraph's page sentence, the `css/walk.css` structure line). `docs/next-steps.md`: the "Games first" and "Quests on a phone" bullets under "Numbers and design" are deleted, one bullet added after "Lobby layout" in Done, one under "Open, small".
- Other helpers' tests that measure the lobby's geometry (a11y target sizes on the lobby, share's lobby checks) should be re-run after the merge: the tiles' first row moved up by 350 to 800 px and the Live strip, the house-edge strip and (on short windows) the banners now sit inside `[data-role="tiles"]`.

## NOT verified
- Any real phone: touch scrolling feel of the swipe chip row and the banner row, the browser's address bar changing the window height (the 759 px "short window" rule uses the height the page reports, which on a real phone changes as the bar hides, so a phone can flip between the two layouts on scroll-resize; the strips then move once per flip), notches, the home bar.
- Safari, Firefox, Edge. `matchMedia`, grid `grid-column: 1 / -1`, `clip-path` and `scrollbar-width: none` are used and work in current Chromium.
- A real screen reader (axe is clean; the reading order was made to match the drawing, not heard).
- Windows between the sizes listed: only the sizes named in 32a/32f were measured as hard checks (a few more in a sweep, see below).

## Left
- 568 x 320 phone held sideways: first tile starts 215 px down (not reached).
- 667 x 375: the bottom bar covers the lower part of the first tile (name hidden).
- The owner questions above.
- Run the whole suite after the merge (I ran 59 sections, not all 141); `13zu`'s 2 px check is the known load-sensitive one.
