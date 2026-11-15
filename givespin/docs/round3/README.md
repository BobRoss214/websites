# Round 3: four unfinished, unmerged patches

These are the work of four helpers that was stopped part-way (nothing here is in the site, and none of it has been tested together).
Each patch was made against the version-30 tree (commit `ad416a9`) and reads like `diff -ruN base/givespin work/givespin`, so apply it from INSIDE the `givespin` folder with `patch -p2`.

| Patch | What it does | State when stopped |
| --- | --- | --- |
| `lobby.patch` (+ `lobby-CHANGES.md`) | A game tile on the first screen of the lobby at every size; today's quests before the 30-row season track on phones | Finished, own tests `32a..` passed |
| `a11y.patch` (+ `a11y-CHANGES.md`) | Live-table names as one keyboard stop, bigger hit areas, the receipt dialog no longer pans sideways, overlay and toast fixes | Finished, own tests `33a..` passed; it was re-running 25h and 13zu |
| `share.patch` (+ `share-CHANGES.md`) | Share on live-table results, a finished-season card, "Try the checker" on the Fair Play page, one copy of the card drawing code, a "Your crew" row | Built; its last regression runs were cut off |
| `polish.patch` (+ `polish-CHANGES.md`) | New "Protects people" tag for seven charities that are not about land or wildlife, quest links, midnight refresh on Quests, chosen name in the account dialog, the Back-a-charity chip click, "Show all" on Players | Finished; it was re-running 13za alone |

Apply in this order: lobby, a11y, share, polish. Checked: the code hunks of all four apply cleanly one after the other. The only hunks that collide are in `README.md` and `docs/next-steps.md` (each helper edited the same lines); resolve those by hand (keep every helper's sentences).

After applying: set the README unit-test count to `grep -h "^test(" tests/*.test.js | wc -l`, run `node tools/make-precache.mjs` if `index.html` changed, run the unit tests and the whole end-to-end suite (see the README, "Tests"), and have the result read by someone who did not write it before pushing. Read each `*-CHANGES.md` first: they list the tests each helper changed on purpose, the questions for the owner and merge cautions. Delete this folder once it is merged.
