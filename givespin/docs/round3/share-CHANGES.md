# share (wave 3): more ways to show off a gift

STATUS: DRAFT (all five items built and checked on their own sections; the regression runs of the existing sections are in progress). Work tree: `ag-share/work/givespin`. Only headless Chromium was used.

## What I built

1. **Share a live table's result.** A live result (when the visitor had a stake) now has a **Share your gift** button in the same row as the Verify shortcut. It opens the same dialog (`ui.sharecard`). The picture is the round card with the live words: eyebrow "A gift from a simulated table" (with a name: "Sam's gift from a simulated table"), the table's game and size on the lead line ("Charity Derby · Small · 10 runners · went to"), the charity that won the pot, the amount of the visitor's own stake, the rank, the verify code (the live round's `fair`: start of the fingerprint + receipt id), and in the footer the receipt's own sentence "Simulated round: no money moved and nothing was charged" plus "Simulated table: every other player is a BOT" (the note may use a third line on a live card). A live card is always a play-money card (DEMO pill) whatever the site mode. Share text: "My GiveSpin simulated table round (bot players) landed on X (play money). Check it yourself: ... Give it a spin:". Name switch off by default, same rules. A visitor who only watched gets no button. If the next round takes the result card away while the dialog is open, Escape/Close puts the keyboard on the table's Join button (or the page title) instead of nowhere.
2. **Season-complete card.** `js/ui/quests.js` shows **Share my season** next to "Go to my tier" once any tier of 10 or more is claimed (my choice of the two in the brief: claimed, not just reached). The card (`share.seasonCard`, drawn by `sharecard.js`): the season's name ("Gold November") from `GS.quests.seasonName` via the season view, a 30-segment tier ring with the number, "Tier 14 of 30", "N quests done" (counted from the claimed quest keys of that season, so old saves work; `share.seasonQuestsDone`), the line "XP and cosmetics only, never money" (+ "Play money: nothing was charged" in the demo, and the DEMO pill). No amount of money at all. Gold frame + "Season complete" ribbon when all 30 tiers are claimed. Same dialog, same name switch (off by default), file name `givespin-season-2026-11-portrait.png`.
3. **Fair Play page**: a green **Try the checker** button under "The short version" (first screen on a laptop) calling `ui.fairshow.openChecker()`, with the line "A sample round, not one of yours, checked with the real code in three steps." No "provably fair" anywhere.
4. **Crew card duplication removed.** `ui.sharecard.draw = { C, DISPLAY, BODY, MONO, font, measurer, text, fitText, roundRect, glowAt, fontsReady, plainFrame, goldFrame, confettiDots, header, ribbon, footer, toBlob }` is exported (the old `fancyFrame` is split into `confettiDots` + `goldFrame`, drawn in the same order). `js/ui/boards.js` lost its copies (palette, fonts, 11 helper functions, the inline footer): 642 -> 535 lines. **Pixel check, before/after**: the crew card (plain and gold-frame variants, portrait and square, same clock and save) gives the same SHA-256 over all pixels and byte-equal PNGs; the solo round cards (plain, $150 big gift, 3-charity Triple Threat, rank-up, 2 shapes each) and the profile card (2 shapes) are also pixel-identical to the base (10 of 10 hashes equal). Probe scripts: `ag-share/probe/crew-card.mjs`, `share-card.mjs`.
5. **"Your crew" row** on the lobby block "This week's leaders": when the visitor's crew is not in the top three (there are only four crews, so: rank 4), one slim row under the three: `4  Your crew: Paws & Co [BOT] #4 · 7 bot crewmates and you · $198.48 of $700 weekly goal`, in its own `<ol>` with the label "Your crew this week. Simulated crew: every member is a bot." It does not use `.bdl__item`, so a count of the top-three cards stays 3. +48 px on a laptop, about +60 to +100 px on a phone.

## Files changed (what and why)

| File | Change |
|---|---|
| `js/share.js` | `roundCard` takes `live` (simulated table words, forced play-money); new `seasonCard`, `seasonShareable`, `seasonQuestsDone` (+ `SEASON_TIERS`, `SEASON_MIN_TIER`); `shareText`/`altText`/`fileName` know the season card and the live card. Pure, unit-tested. |
| `js/ui/sharecard.js` | `confettiDots`/`goldFrame` split out of `fancyFrame`; `tierRing` + `paintSeason`; the footer note may use 3 lines on a live card; `roundSource` takes `ctx.live`; `seasonSource`; `open(src, {trigger, refocus})` (the opener button is remembered explicitly, because Safari does not focus a button on click, and a fallback place for the keyboard when the button has gone); `addLiveShare`, `openSeason`, `draw`. Existing cards unchanged (pixel-equal). |
| `js/ui/boards.js` | copies deleted, uses `ui.sharecard.draw`; the "Your crew" row (`mineRow`). |
| `css/boards.css`, `css/sharecard.css` | the slim row; `.fs-jump` wraps and has a gap (two buttons now); `.fp-try`. |
| `js/ui/quests.js` (shared) | the Share my season button (1 expression in `seasonHTML`) and its click branch in `wire()`. |
| `js/ui/live.js` (shared) | ONE line after the existing `ui.fairshow.addShortcut(...)` line in `renderResult()`: `if (you && ui.sharecard && ui.sharecard.addLiveShare) { ui.sharecard.addLiveShare(el.result, room, r); }`. |
| `js/ui/pages.js` (shared) | the "Try the checker" paragraph at the end of the "short version" list on the Fair Play page, and 2 lines at the end of `renderFair()` to wire it. |
| `README.md` | Share your gift (live card, season card, `ui.sharecard.draw`), Fair play (page button), Leaderboards (Your crew row), Quests (Share my season) paragraphs; Structure line for `sharecard.js`; section list gets `34-share`; unit-test count 398 -> 406. |
| `docs/next-steps.md` | removed the two "left" items that are done (the crew card copy, live Share / Try the checker); added what is still duplicated (the crew card's dialog code). |
| `tests/share.test.js` | +8 tests (406 `test(` lines in all). |
| `tests/sections/34-share.mjs` | NEW: sections 34a-34f. |

## Tests I changed
None. No existing test, assertion or wording check was edited, loosened or removed.

## Verified (headless Chromium only)
(see the end of this file when the runs are done)

## Questions for the owner
1. **"Share my season": claimed or reached?** I show the button once any tier of 10 or more is **claimed** (the brief's own suggestion), so a visitor who has reached tier 14 but not pressed Claim sees no button until they do. Recommendation: keep it (it also nudges people to claim).
2. **"Quests done" counts claimed quests only**, in the calendar month; a weekly quest counts in the month of its week's Thursday (a week that straddles two months counts once). Recommendation: keep; it is explainable ("quests you claimed this season").
3. **A live card says "$20 went to <winner>"**, because in the simulation the stake is allocated to the winning charity of the pot (that is what the live receipt records), also when the visitor backed another charity. It is true to the receipt, but a reader might think they picked it. Recommendation: keep; the picture's ribbon "Called it" appears only when the backed charity won.
4. **The season card carries a name** only with the name switch (off by default) like every other card. Nothing to decide, listed because it is "personal data" adjacent.

## Merge cautions
- Shared files touched with small localized edits: `js/ui/live.js` (one line in `renderResult()`, right below the `ui.fairshow.addShortcut` line), `js/ui/quests.js` (one expression in `seasonHTML()`'s `.qseason__act` and one `else if` in `wire()`), `js/ui/pages.js` (a paragraph at the end of the "short version" section in `renderFair()` and two lines at the end of that function), `README.md` (5 paragraphs, the Structure line for sharecard.js, the test-section list, the unit-test count: **the lead recounts it**).
- `css/sharecard.css`: `.fs-jump` rule changed (wrap + gap); `css/boards.css`: rules added after `.bdl__item`.
- The a11y helper may also touch `js/ui/live.js` (feed buttons) and the receipt dialog: my line is in `renderResult()` only. The lobby helper may touch `js/ui/quests.js` (Quests page order on phones): my edits are 2 spots, not the layout.
- `index.html` and `sw.js` are untouched (no new script or style file), so `node tools/make-precache.mjs` needs no re-run for my part.
