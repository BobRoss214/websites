# Notes: tour chapters 1 to 5 and 11 (helper tour-A)

The owner's rule (10 Nov): in the tour, say what a thing IS and why it helps visitors or the farm, never what was changed.

What changed (all in `js/tour-steps.js`, 79 cards became 88: ch1 3, ch2 11, ch3 4, ch4 7, ch5 10, ch11 3)
- Rewritten, no "new / now says / still / already / older page": `ch1-hello`, `ch1-real`, `ch2-strip` (Summer button), `ch3-menu` (the red dot is a season that is coming up), `ch4-guide`, `ch5-tomatoes`, `ch11-prices`, `ch11-people`.
- `also` added: `ch2-seasons` lights the picture (`#hero-scene`), `ch4-guide` lights its button (`#first-visit .fv-more`).
- New cards: `ch2-notice` (the yellow bar for closures, order 202), `ch2-pill` (the "No reservation?" note, 207, skipIfMissing: hidden in winter), `ch2-friends` (farm friends, 209, skipIfMissing), `ch2-facts` (quick facts, 211), `ch5-year` (farm year, 502), `ch5-glance` (season table, 504), `ch5-tree-weekends` (505), `ch5-varieties` (507), `ch5-bouquet` (509).
- Orders renumbered one by one in chapters 2 and 5 (no tens: chapter 2 has 11 cards and the test wants order = chapter * 100 + a place under 100).
- `ch5-tree-weekends` has no date numbers, only the owner's rule in her words. Re-check it, and the winter cards of chapters 2 to 5, after the winter branches merge.

Tests touched (shared files)
- `tests/tour-seasons.test.mjs`: the card after the strip is now "The yellow bar for closures" (about lines 129 to 141 and the phone line 215). The season-button count (11) is unchanged.
- `tests/tour-targets.test.mjs`: one new block in `wordChecks()`: `NO_CHANGE_NOTES = [1, 2, 3, 4, 5, 11]` refuses the change-note words in a card's title, text and season-button words. Add the other chapter numbers when their cards are written to the same rule.

Text to put in tests/README.md (main applies it)
- `tour-targets`: add "no card of chapters 1 to 5 and 11 says what was changed (\"now says\", \"new this year\", \"still\", \"already\", \"used to\", \"instead of\", \"older page\", \"we need you to\")".

Left alone on purpose (for main)
- `ch11-photos` still asks for "the right Christmas tree dates": the owner has answered, so that line goes when the winter words merge.
- The welcome card in `js/tour.js` says "your new website" (tour-B's file): `tests/tour.test.mjs`, `tests/tour-store.test.mjs` and `tests/tour-seasons.test.mjs` (line 52) check those words.
- Winter words in `ch2-strip`, `ch2-seasons`, `ch2-tags`, `ch2-badges`, `ch2-reserve`, `ch3-countdown`, `ch3-week`, `ch4-places`, `ch5-tabs`, `ch5-cards` are untouched (the winter-text branch owns them).

Browser-support table: nothing new (no new CSS property or script method).
