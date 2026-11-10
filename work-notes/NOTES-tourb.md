# Notes: the tour, chapters 6 to 9, and the engine (helper tour-B, 10 Nov 2026)

For main, who applies README.md, tests/README.md and tests/browser-support.table.json after the merges.

## What this branch (tourb) changes

- `js/tour-steps-b.js` (chapters 6 to 9, 26 cards before, 32 now). The words say what a thing is and why it helps visitors or the farm, never what was changed.
  - Rewritten: `ch6-two-ways` (adds the pre-order link), `ch7-jump` (no group count in the words: it cannot go stale when the Beer, cider & wine group arrives), `ch7-note` ("is being confirmed"), `ch7-pizza` ("Pizza in the Store", no hours), `ch7-soon-pantry` ("The “Prices coming soon” label"; `ch7-soon-wear` and `ch7-soon-fall` are gone, chapter 11 has the full list), `ch8-corporate` (also lights the draft label and the Request a quote button), `ch8-photos` (also lights the first photo, so the card's "tap any photo" can be tried), `ch8-contact` (names Cathy, Ava, Pranee, Vanessa), `ch6-greenhouse`, `ch6-trees` (fall button) and `ch9-calendar` lost the word "still".
  - New: `ch6-tree-pizza` (W2), `ch7-hover-popup` (S1, lit on `#shop-snacks .shop-card-pop`, skips itself where the Store has no pop-up), `ch7-beer-wine` (S2, `skipIfMissing`), `ch8-last` (P16, placed in page order before the contact card), `ch8-social` (P15), `ch9-pages` (P9), `ch9-bring` and `ch9-comfort` (P10a, P10b, on the first-visit page, last in chapter 9 so the tour goes index -> first-visit -> account with one jump less than the audit's order).
  - Orders are 601 to 607, 701 to 706, 801 to 812, 901 to 907.
- `js/tour.js`, `css/tour.css` (the engine): the Store pop-up (`div.shop-pop`, box `div.shop-pop-box`) opens above the click stopper and the dimmer (z-index 9100, its own dim made transparent and without clicks, only its box takes clicks); any other box with `role="dialog" aria-modal="true"` counts as a dialog of the page (it keeps its Esc, the card keeps off its box) and its overlay gets the class `wa-tour-lift` (z-index 9100, important) while it is shown; the tour gives back its own box when a dialog shuts the rest of the page (`inert`, `aria-hidden` on every child of `<body>`, which the Store pop-up does): without that Next, Back and Close would be dead while a pop-up is open. The welcome card says "This is a tour of your website" (no "new").
- Tests: `tests/tour.test.mjs` (new section 8b: a stand-in Store pop-up built like the real one, and any aria-modal dialog; a computer and a phone), `tests/tour-store.test.mjs` (the ids rule, the words, and a part for the REAL pop-up that prints "skipped: no shop-pop in this repo" when `#shop .shop-card-pop` is not there), `tests/tour-targets.test.mjs` (chapter 11 is the full list of the "Prices coming soon" cards, chapter 7 names the pantry cards that show the label and says how many), `tests/tour-seasons.test.mjs` (one line, the welcome words).
- `docs/TOUR.md`: the layers, the Store pop-up, any other dialog, the test rows.

## Shared test lines I touched (tour-A knows)

- `tests/tour.test.mjs`: header comment (lines 30 to 34, one more bullet), line 202 (welcome regex: "your website"), the new section 8b (lines 872 to 1007: the Store pop-up as a stand-in, and any aria-modal dialog; a computer, a small computer and a phone), and `STORE_WORDS` with the card title next to it (lines 1032 and 1034: the made-up strip card has the words and the title of the real `ch7-jump`).
- `tests/tour-store.test.mjs`: header comment (lines 5 to 17), the `POSITION_WORDS` comment (24), the welcome regex (87), the ids rule and the words check (91, 94), and a new block at the end (127 to 185: the real pop-up).
- `tests/tour-targets.test.mjs`: header (29 to 30), `soonCardsIn()` next to `soonCards()` in `IN_PAGE` (283 to 286), the chapter 7 / 11 block "Prices coming soon" (492, 500 to 509) and one more entry in `CLAIMS` (517). Not `wordChecks()`.
- `tests/tour-seasons.test.mjs`: line 52 only (welcome regex).

## Merge notes (conflicts to expect)

- `js/tour-steps-b.js` with winterlogic: two lines of the card `ch6-trees` (the fall and the winter button). Take MY fall line (`Fall. No green line. It waits for tree season.`, no "still") and winterlogic's winter line.
- `js/tour-steps-b.js` with wintertext: it will edit `ch6-hours` (not touched here) and `ch7-pizza` (rewritten here: keep my text, it has no hours and no dates, so there is nothing to fix in it).
- tour-A's `NO_CHANGE_NOTES = [1, 2, 3, 4, 5, 11]` and `QUOTES_IN_LIT` in `tests/tour-targets.test.mjs`: after both branches are in, make the first `[1, 2, 3, 4, 5, 6, 7, 8, 9, 11]` and add `'ch7-note', 'ch7-soon-pantry', 'ch8-last'` to the second (and `'ch6-tree-pizza'` once wintertext is in: its quote is only in the lit part with the winter text). Tried in a copy of my branch with tour-A's branch merged (the merge has no conflict): tour-targets for those three cards, 66 checks, all passed; the whole file merges without a conflict.
- `docs/TOUR.md` merges with tour-A's without a conflict (I left its "Clicks" line alone; the pop-up is described in the layers paragraph).

## After the winter, shop-pop and beer-wine branches merge: what to re-check

- Run `tour-targets` (whole), `tour-store`, `tour` once on the merged site. In the checks on a copy of my branch with all four merged, every card of chapters 6 to 9 showed and the words each quotes in “ ” were in its lit part (see the report).
- `ch6-trees`: the card's own text (not its buttons) still quotes the green line as “Christmas trees are here”. The winter branches changed that line on the page to "Christmas tree season is on." and winterlogic changed the winter button, so after the merge the own text has to say “Christmas tree season is on” too. Found by a check of all my cards on a copy with every branch merged (it reads the words in “ ” of each card against its lit part); `tour-targets` only checks the quotes of the small buttons, so it will not say. I left it: the winter words of this card are the winter helpers'.
- `ch6-tree-pizza` (W2) needs wintertext: its “Not official yet” has to stand inside `#greenhouse .gh-hours` in winter (it does in wintertext's index.html). Without wintertext the card is not true.
- `ch6-two-ways` shows a fall day while it is up when the page is dressed for winter (wintertext hides the two fall cards of the pizza ways there): `before` asks for `#pizza .way-card:not(.way-card-winter)`. If wintertext renames `way-card-winter`, the card still shows but may be about cards that are hidden.
- `ch7-hover-popup` (S1) is lit on `.shop-card-pop`, the class that shop-pop's script puts on a box that has a pop-up. If shop-pop renames it the card skips itself and the real-pop-up part of `tour-store` fails ("the step shows"), which is the signal. `closeShopPop()` (in `ch7-hover-popup`, `ch7-pizza`, `ch7-soon-pantry`: the pizza bar and the pantry cards have pop-ups too) sends the pop-up the Esc key it listens for, and clicks `.shop-pop-x` or `.shop-pop-done` if it is still open.
- shop-pop's `lock()` sets `inert` and `aria-hidden` on every child of `<body>`, `#wa-tour` too. The engine undoes that for its own box in every frame; nothing in shop-pop has to change. It would also be fine if shop-pop left `#wa-tour` alone.
- `ch7-beer-wine` (S2) is lit on `#shop-beerwine .shop-band`; it skips itself without the group. `ch7-jump` has no count, so nothing there needs a change when the group arrives.

## tests/README.md (main applies)

- Row `tour`: after "a dialog of the page above the dimmer" add "(the pretend account's, the Store's pop-up as a stand-in built like the real one, and any box with `role="dialog" aria-modal="true"`; a computer and a phone: above the dimmer, the card usable and off it, Esc closes the dialog and not the tour, the lift is taken away)".
- Row `tour-store`: replace "(the twelve group buttons, the price note, the pizza group, the groups that wait for prices)" with "(the row of group buttons, the price note, the pizza group, the pantry group with its Prices coming soon label and, when the Store has them, the product pop-up and the Beer, cider & wine group)", and at the end add "With the real Store pop-up (`js/shop-pop.js`, when it is in the site): a click on the lit product box opens it above the dimmer, in the middle of the window, with the tour's card usable and off it; Esc and its Close buttons shut it while the tour stays on its step; Next shuts it (the step's `after()`); a computer and a phone. Without it the part prints `skipped: no shop-pop in this repo`."
- Row `tour-targets`: "the Store's "Prices coming soon" cards are exactly the ones that chapters 7 and 11 name" becomes "chapter 11 names every Store card that says Prices coming soon (the full list), chapter 7 names the pantry cards that show the label and says how many".

## browser-support

Nothing to add to the table. The one failure on the way was `.show(` (a member call named `show` is read as a dialog's method): `js/tour-steps-b.js` calls the season walk's own function through a local (`var show = w.show; show(id)`).

## Things I was not sure about (the default I took)

- `ch7-jump` says no number of groups (the audit proposed "thirteen"): a number is false on this branch (12) and would need a change at every new group.
- `ch6-tree-pizza` says "is open 11 am to 8 pm and serves pizza" (not "serves pizza from 11 am to 8 pm"): the winter spec gives no separate pizza hours.
- `ch8-last` (the closing band) does not promise the Reserve button: in winter the band keeps only "Email us" and a line about the tree weekends.
- `ch8-last` stands before `ch8-contact` (the band is above the contact section on the page); the audit had it after.
- `ch9-bring` and `ch9-comfort` are the last two cards of chapter 9 (the audit had them after `ch9-pages`).
- On a phone the tour's sheet covers the lower part of an open Store pop-up. Its round X at the top and Esc still shut it. I did not change the sheet.
- Request lines in other cards (`ch8-reviews` "we need the review link", `ch8-signup`, `ch8-drive`, `ch8-faq`, `ch9-languages`, `ch6-menu`, `ch6-hours`) are left as they are: they are to-dos, not change notes; tour-A could move them to chapter 11.
