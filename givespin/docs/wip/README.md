# Unfinished work, saved as a patch

`one-screen-landscape-and-live.patch` is work that was in progress when the session had to stop. It is **not applied** to the site and
**not fully tested**. Apply it from the `givespin/` folder with `patch -p1 < docs/wip/one-screen-landscape-and-live.patch`.

It is two helpers' work merged together (the merge applied cleanly against the code as committed when this was saved):

1. **Phones held sideways and short windows** (the part that has been measured). `css/fit.css` gets a third layout for a window up to 520 px tall
   (two columns: the gift panel on the left scrolls inside itself with the Play bar kept at its bottom, the picture on the right is fitted to the height),
   `js/ui/game.js` learns about it, and a few games get their own short-window rules: `js/games/slots.js` and `css/slots.css` (lower reels),
   `js/games/plinko.js` (a lower board), `js/games/coin.js` and `css/games.css` (a two-halves bracket, a smaller Dice and Last One Standing),
   and `js/games/drop.js` (a **real bug fix**: a Drop Crate shrunk by the fit could stop on the wrong card, because it took a card's width as drawn instead of its real width).
   Measured with `measure-fit` over 19 games in 12 window sizes (four of them phones held sideways, down to 568 x 320): Play, the amount buttons and the whole
   picture were on the first screen everywhere. The unit tests passed (288/288). The end-to-end sections were NOT run against this merge, except a partial run
   whose result is in the hand-off note, so run them before committing it.
2. **Live tables on one screen** (not measured, not tested). `js/ui/live.js` splits the live panel into a scrolling body and a foot (stake and join button), docks it on a
   phone like the solo panel with an Options sheet, and adds a "Pick a charity" button that opens the odds board; `css/fit.css` has the matching block at its end;
   `js/ui/game.js` shares the docking code. The live end-to-end sections (13o, 13q, 13zq, 15, 16) have not been run against it, and some of them touch controls
   that this moves into the sheet.

When you finish it: apply the patch, run the unit tests, run `tests/e2e.mjs` (sections 13zs, 13o, 13q, 13b, 15, 16 first), fix what the live layout broke, update the
README's list of what the screens do, and delete this folder.
