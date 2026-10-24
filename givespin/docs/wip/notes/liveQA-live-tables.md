# liveQA: changes

STATE: the work copy is NOT half-edited: it is complete and consistent (`snap4` == `work`, the whole suite passed on it: 56 sections, 2,452 checks, 0 failures). Nothing is broken. Open items are listed under "What is left" at the end.

Job: finish, test and prove the one-screen layout for LIVE TABLES (10 live games x 7 sizes) on a laptop, a phone held upright (docked bar + Options sheet) and a phone held sideways.
Starting copy = the merged fitLive patch (`base/givespin` == the starting copy). Everything below was measured in Chromium only (see "Not verified").

## Summary

- The starting patch was in better shape than its "untested" label said: the laptop layout, the docked phone bar, the Options sheet, "Pick a charity" and the join/stake/take-back flow all worked as described, and the whole end-to-end suite passed on it (2,342 checks, 0 failures). The suite simply never looked at it: every live section runs on a 1440x900 window.
- What was really wrong, and is now fixed (details per file below):
  1. a phone held sideways: the picture was cut off by the navigation bar in 50 of 90 table/window cases (title on 2-3 lines, round bar on 2-3 lines, a 40 px high odds board, the picture's own shrink limit);
  2. the page was left scrolled down after a result card (it scrolled to the card, and nothing brought it back when the next round opened);
  3. keyboard: Tab from the Options sheet went on to the page behind it (focus under the sheet); a control reached by keyboard under the docked bar / navigation bar (no `scroll-padding` for live);
  4. a sheet left open when the phone was turned sideways came back, unasked, when it was turned upright; a "Pick a charity" sheet stayed open over the show after bets closed;
  5. the join button changed height by 2 px between phases (an empty hint line was shorter than a filled one);
  6. tall pictures (Standing, Duck/Derby at 500, Marble Run "River" track at 50) were cut by the dock or the window at the solo shrink limit (0.5).
- New end-to-end coverage: section `13zu` (87 checks, laptop, phone, phone held sideways, a whole round, keyboard, axe) and section `13c` now runs its staking/cancelling/add-a-charity checks on a laptop AND on a phone.

## What I changed, per file (shared files: where exactly)

### `css/fit.css` (the live block at the end of the file only; nothing above "LIVE TABLES ON ONE SCREEN" touched)
- all layouts: `#view-game.is-live .playbtn__sub { min-height: 1.3em }` (one line high with or without words, so the join button keeps its height as the text changes each second / phase).
- phone held sideways (561-900 wide, up to 520 tall): the stage title is smaller (0.95rem), "Checkable result" is a shield on its own (words stay for a screen reader), the round bar is two short lines (0.7rem). Together about 50 px more for the picture.
- NEW block "400 px tall or less" (`@media (min-width: 561px) and (max-height: 400px)`): the panel's clock row is left out (the round bar says the same), the board gets its room, the join button's hint line becomes screen-reader-only unless it carries the "press again" confirmation, tighter stage and round bar, smaller title (0.88rem).
- NEW at the very end of the file: `scroll-padding-top` / `scroll-padding-bottom` for `html:has(#view-game.is-live ...)`, the live twin of the solo rules (four media queries, same breakpoints). Without them a control reached by keyboard (the tabs, the footer links, "more tables") stopped under the docked bar and the navigation bar.
- *Merge care*: landQA also edits `css/fit.css`, in the solo parts. My edits are inside the live block and in a new tail appended at the END of the file; if landQA also appends at the end, keep both.

### `js/ui/game.js` (live branches only; three small places)
- near `FIT_MIN`: two constants `FIT_MIN_LIVE = 0.34`, `FIT_MIN_LIVE_LAND = 0.2` (a table's picture may be shrunk further than a solo game's 0.5 / 0.34: boards go up to 500 and the round bar and dock sit above/below it).
- in `fitStage()`: two lines changed: `var shortWin = matches('(max-height: 520px)')` is computed first, `reserve` uses `isLive() ? 10 : 26` for a short window, and `var s = Math.max(isLive() ? (...LIVE...) : (...solo...), ...)`. *Merge care*: these are the two lines landQA is most likely to touch for the solo layout; the solo values (`FIT_MIN`, `FIT_MIN_LAND`, 26, 44) are exactly as before.
- in `build()`, after the live panel's keydown listener: a `focusout` listener on `#livepanel` (the twin of the solo sheet's one): the keyboard that moves on past the live sheet folds it away instead of going on to what it covers (a dialog opened from the sheet keeps it).

### `js/ui/live.js`
- `revealResult()` now remembers where the page was (`revealed = { from, to }`) and does not scroll while the options sheet is open; new `scrollPage(y)` and `revealBack()`; `renderResult()` asks `revealBack()` BEFORE it clears the card and scrolls the page back to where it was when the next round opens (only if the visitor has not scrolled away since; works while a smooth scroll is still running). `attach()`/`detach()` forget it.
- `onPhase()`: when bets close (phase not "open") a sheet that "Pick a charity" opened is shut (`pickDone()`), so it does not cover the show.
- the window-resize listener: when the panel stops being docked (phone turned sideways) the sheet is shut as well (`ui.game.setSheet(false)`), so it cannot be "stuck" open when the phone is turned back.

### `tests/e2e.mjs`
- new helper `openLiveOptions(page)` next to `openOptions` (the live twin: opens the live panel's sheet when a control in it is needed; does nothing on a laptop).
- section `13c` (staking, cancelling, adding a charity) wrapped in a loop over a laptop (1440x900) and a phone (390x844, touch); the phone pass calls `openLiveOptions` before the odds board, other amount and Add charity are used, waits for `.lt-phase` with `state: 'attached'`, and expects "Pick a charity" to be tappable (not disabled) on a phone. Nothing it checks was weakened (all 19 checks run in both layouts: 39 in all).
- new section `13zu. Live tables on one screen` inserted right after `13zq` (before `13zs`): 
  - all 10 live games, table of 25, at 1366x768, 1280x720, 390x844, 568x320: join button and stake buttons on the first screen (above the navigation bar), whole picture clear of the dock/nav (568x320: picture starts on the first screen and shows at least 40 px), scale never below a third (a fifth at 568x320), no sideways scroll, board beside the picture vs behind Options; axe scans of a live table at each of the four sizes;
  - the phone flow for Wheel and Plinko (390x844, touch): docked bar = stake + Options + join (no board, no other amount); "Pick a charity" opens the sheet at the board (radio group with a name, first charity focused); choosing closes it and the join button names the charity; $50 goes in (credit drops by exactly $5,000 cents), "Take my bet back" returns it; Options -> Add charity -> dialog -> the pick comes back; Escape from a field shuts the sheet and focuses Options; Tab past the sheet folds it; the last footer link reached by keyboard is clear of the dock; table hop shuts the sheet and keeps picture/stake/join on the first screen; turning to 844x390 and back leaves no stuck sheet;
  - a whole round at 390x844 and 360x740 (accelerated clocks, frozen on the result): the result card is under the top bar and above the dock and the navigation bar (all of it when it fits, else from its top), the next round brings the page back to the top with the picture on the first screen;
  - accelerated clocks: 40 samples of the join button at 360x740 across phases: no text outside the button, no sideways scroll, button and panel keep their size;
  - laptop: board + stake + join together, the body scrolls while the join button stays put, panel whole after a small page scroll.

### `README.md`
- only the "One screen per game" paragraph (a new paragraph after it: live tables follow it, floors, result card) and the `css/fit.css` line of the file list.

### Not touched
`css/live.css` (nothing needed), `js/live.js`, anything solo.

## Verification, with numbers

Tools I used are in `$S/ag-liveQA/tools` (not part of the patch): `grid.mjs` (every live game at sizes 5/50/500 on a list of window sizes, strict "picture clear of the dock and the navigation bar" check), `batch.mjs`/`shot.mjs` (screenshots), `flow.mjs`, `round.mjs`, `rotate.mjs`, `kbd.mjs`, `axe.mjs`, `vip.mjs`. (`measure-fit.mjs --live` advertises a live mode in its header but has none: that is a bug in the lead's tool; the `S` flag of the fitLive helper's `measure.mjs` only compared with the window height, not with the dock, so it said "fine" for pictures hidden under the dock.)

1. Baseline (untouched copy): unit 288/288; whole suite via the section runner (PAR=3, AXE on): 56 sections, 2,342 checks, 0 failures, no crash. Logs `$S/ag-liveQA/logs/base`. Nothing failed, so there was no test to fix for the moved controls: the tests never reach them (laptop only).
2. Measured and looked at, all 10 games x sizes 5/50/500 (30 tables), contact sheets read: final copy at 1366x768 (50, plus one full-size shot), 844x390, 667x375, 568x320 (all 10 games at 50); untouched copy at 390x844 (5/50/500) and 375x667 (50) (the portrait phone layout did not change after those were read, except the join hint height +1 px and scroll-padding):
   - final strict grid (join + stake buttons on the first screen, picture clear of what covers the bottom, no sideways scroll):
     - 1366x768, 1440x900, 1280x720, 390x844, 360x740, 375x667: 180 of 180 table/window pairs fine, with the shrink floor 0.34 (before: 9 failures at the old floor 0.5: Marble Run River 50 on the three laptop sizes; Standing 50/500, Duck 500, Marble 50 at 375x667; Standing 50/500 at 360x740);
     - 844x390: 30 of 30 fine (before: 5 cut);
     - 667x375: 29 of 30 (Standing 500 is cut by 15 px; before: 15 cut);
     - 568x320: 23 of 30 fully clear, 7 cut at the 0.2 floor: Standing 50/500, Marble River 50, Derby 500, Duck 500, Balloon 50/500 (before: 30 of 30 cut). The picture is shown from its top and the page scrolls for the rest;
     - extra sizes, all fine: 768x1024, 1024x768, 900x700, 901x600, 820x400, 1280x560 (Wheel, Plinko, Standing, Marble, Duck at 25 and 500);
     - with VIP stakes (8 stake buttons, two rows on a phone): everything still on the first screen at 390x844, 360x740, 375x667, 1366x768, 844x390, 568x320.
   - the picture at the floor is small (0.34 on the laptop/portrait, 0.2 sideways): the board is still readable in the sheet or the column, and the game's own names are not needed to bet.
3. Phone behaviour (390x844 and 360x740, touch, frozen tables and accelerated clocks): `flow.mjs` 56/56 (docked bar, sheet at the board, pick closes it, preset, join, take back, Options-first keeps the sheet open, other amount, big-stake confirm, refusal message above join, table hop, chat toggle, prediction, Add charity, last call, laptop column, scrolling body); `rotate.mjs` 14/14 (turning, resizing, stream mode); `round.mjs`: a staked round's card at 390x844 (card 598 px tall, band 613 px: fits), 360x740 and 375x667 (card 540-640 px, band 509 / 436 px: shown from its top) and the page back at the top at the next round: before the fix it stayed at scrollY 517.
4. Accessibility: axe (wcag2a/aa, 21a/aa, 22aa, best-practice) on a live room: 0 violations at 1366x768, 1440x900, 390x844 (shut), 390x844 (sheet open), 360x740 (sheet open), 844x390, 667x375; also in 13zu, 13c (add-a-charity dialog, laptop and phone) and sections 16 (every live room + result card). Keyboard (`kbd.mjs` Tab walk, 70 stops): focus never ends up under the dock, the navigation bar, the top bar or the sheet after the fixes (before: 5 stops under the dock/nav, and the whole tail of the page under the open sheet). Names: the Options button has `aria-label="More options for this table"` (its visible word "Options" is inside the name), the board is a `role="radiogroup"` named by "Who is backing what" with `role="radio"` rows, the table sizes are a `nav` named "Table size".
5. Whole suite on the final snapshot: see "Final run" below.

## Final run

Whole end-to-end suite, section runner, PAR=3, AXE on, on `$S/ag-liveQA/snap4` (identical to the final work copy): 56 sections, 2,452 checks, 0 FAIL, every section printed its summary line. Logs: `$S/ag-liveQA/logs/final2`. Unit tests (on an earlier snapshot, product code unchanged except one constant since): 288/288; `tests/readme.test.js` 16/16 on the final README.
Per section (ok/fail): 1:18/0 2:6/0 3:138/0 4:22/0 5:23/0 6:25/0 6b:127/0 6c:54/0 7:26/0 8:7/0 9:47/0 10:14/0 11:13/0 12:8/0 13:11/0 13a:80/0 13a2:16/0 13b:62/0 13c:39/0 13d:20/0 13e:11/0 13f:22/0 13g:21/0 13h:30/0 13i:21/0 13j:25/0 13k:21/0 13l:21/0 13m:7/0 13n:7/0 13o:47/0 13p:18/0 13q:34/0 13r:11/0 13s:23/0 13t:39/0 13u:18/0 13v:10/0 13w:8/0 13x:27/0 13y:190/0 13z:127/0 13za:116/0 13zm:102/0 13zn:65/0 13zo:19/0 13zp:346/0 13zq:21/0 13zr:102/0 13zs:30/0 13zu:87/0 14:14/0 15:10/0 16:42/0 17:3/0 18:1/0 (some counts differ by a few between runs: a few checks are conditional on the random result of a round, e.g. 13a2, 13h, 13y).
Earlier full run on an older snapshot (`snap2`, 2,443 ok / 6 FAIL): three failures were wrong assumptions in my new 13zu (fixed: the result card of a 360 px wide phone is taller than the room; an ellipsis-cut join label is by design; a page scrolled by a result card on arrival), and 13zp / 13zr failed once each under heavy machine load (a 9.6 s round against a 7.8 s budget; three cancelled logo requests) and passed on re-run (346/0, 102/0). 13zu then passed 87/0 three times.

## Not verified / known limits

- Only Chromium (Playwright), no real phone, no Safari/Firefox (the layout uses `:has()`, `dvh`, `ResizeObserver`; the solo layout already does). No screen reader (VoiceOver/TalkBack) was run; names and roles were checked by axe and by reading the DOM.
- Timing is checked with accelerated clocks (`?fast=1`) and frozen tables; I did not sit through real-speed (about a minute per round, 27-44 s shows at 500) rounds on a phone. The result-card scroll was measured on real card heights, though.
- 568x320 (iPhone 5/SE 1st gen held sideways): the page's own bars (top bar 52, demo strip 44, navigation bar 40 of 320 px) leave about 180 px; the stake buttons and the join button are on screen, the picture is whole for 23 of 30 tables and shown from its top for the 7 tall ones, but the odds board is a window of about 1.5 rows (it scrolls) and "Other amount" is a thin row. That is the geometry of that window; the solo screens have the same limit there (the solo Wheel is cut by the navigation bar at 568x320 as well, landQA's territory).
- A result card for a round you staked in is 540-640 px tall: on a 667 px high phone (room 436 px between the bars) and on a 360 px wide phone it cannot be all in view; it is shown from its top and the rest is one swipe away. Compacting the card was left alone (its wording is the product).
- Marble Run's tracks and the Standing/Duck/Derby pictures themselves (their natural heights at 500) are the games' business: I only changed how far the screen may shrink them.
- Real-speed `?fast=1`-less phone round was not run in the e2e (the e2e uses accelerated clocks); `13zp` (marble, solo) and `13zr` (ranks) each failed once in a full run under heavy machine load (a 9.6 s round against a 7.8 s budget; three cancelled logo requests when a page closed) and passed on the re-run: neither is related to this patch.

## For the lead to merge carefully
- `js/ui/game.js` `fitStage()` (two lines) and `css/fit.css` (end of file): see "Merge care" above; landQA edits the same files.
- `tests/e2e.mjs`: `openLiveOptions` is inserted between `openOptions` and `setAmount`; `13c` is wrapped (indented by one space, deliberately, to keep the diff small); `13zu` sits between `13zq` and `13zs` (landQA's `13zt` goes after `13zs`).
- `README.md`: only the "One screen per game" paragraph and one file-list line (the Live tables paragraph "A table fits on one screen" already says that the page scrolls to the result card; it also comes back up at the next round now, which the new paragraph says).

## What is left (plain words)
- axe `skip-link` (best-practice, moderate) can appear when the sheet is OPEN and scrolled so that the "How it works" link (`href="#help-live"`, inside the "Simulated table" note in `ensurePanel()`) is below the bottom of the screen: axe treats a hash link in a fixed panel that is off screen as a skip link whose target does not exist (the target is a Help page item that is only built when Help is opened). Not a WCAG failure, and no e2e check scans an open sheet (13zu scans shut ones); my `axe.mjs` showed it at 390x844 and 360x740 with the sheet open, and 0 violations on the shut phone, the laptops and both landscape sizes. Fix idea: render the note's link only after Help exists, or give the link a real target.
- `flow.mjs` (my helper script, not part of the patch) says the join button moved by 1 px (572 -> 571) while the body of the laptop panel scrolls: sub-pixel rounding of the 14.97 px hint line; the e2e check for the same thing (13zu, compares the whole box) passes. Could be removed by `min-height: 15px` instead of `1.3em`.
- 568x320 stays cramped (see Not verified); a better answer would need the page's own bars (demo strip, top bar) to shrink in short landscape, which is shared with the solo screens.
- Other live sections (13g, 13l, 13o, 13p, 13zm, 13zq) still run only on a laptop; only 13c runs on a phone as well, plus 13zu. Running 13p (no stale pick when hopping) and 13g (predictions, chat vote) on a phone too would be the next step: use `openLiveOptions(page)` before touching the board, predictions, chat toggle or Add charity.
- The result card (540-640 px) is taller than the room on small phones (see above); a compact card for phones is a product decision.
