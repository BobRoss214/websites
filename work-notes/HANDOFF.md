# Hand-off, 21 Oct 2026 (end of a long working session)

Branch: `claude/wise-acres-redesign-w9m4bi` (the repo's default branch). Nothing here is a pull request.
This folder (`work-notes/`) is NOT part of the website. It only keeps notes and tools from the session so nothing is lost.

## In the branch now (each one tested by the helper who made it)
1. Tractor and barrel train no longer freeze: "calm mode" used to rest them (`js/main.js`, `tests/calm.test.mjs`).
2. Add-ons list: a real corn pit picture; the barrel train there has 5 barrels and 5 kids who wave like the wagon riders.
3. "Small Sunn Hemp Maze" card: a better maze picture and a sunn hemp plant on each side (`#sunnhemp`, `#sunnhemp-pods`).
4. Red barn in the hero lost its top on wide windows (a picture strip clipped it): fixed in `css/styles.css`; `tests/barn.test.mjs`.
5. Top menu: Pizza (and the other links) lit the wrong link when the site is shown inside a sandboxed frame like the claude.ai preview (the scroll-spy `rootMargin` is ignored there): fixed in `initNav` (`js/main.js`); `tests/nav-highlight.test.mjs`.
6. First-visit guide is now a section on the home page (`#first-visit`), so the menu link never leaves the page; `tests/first-visit-guide.test.mjs`. The full guide page `first-visit.html` is unchanged and linked from the section.
7. Hero barrel train on the first screen: 3 more barrels and 3 more waving kids (6 and 6), each kid waves a little out of step; wheels match the speed (`js/hero.js`, `css/hero.css`).
8. Products section: the existing Shop section ("What to buy at Wise Acres", `#shop`) now lists every product from the farm's own signs, in 12 groups, each with a price and a small drawing (62 pictures, ids `p-<slug>`). All new texts are translated (es, hi, zh, vi) and were read through once by a second reviewer. Prices not confirmed by the farm show "Prices coming soon".

## Not finished / still to do
- Fix wording in the Shop that the photo audit found unsupported (`AUDIT-photos.md`): pizza "wood-fired style", kettle corn "big bag", Izze "sparkling juice", "tokens at the barn", the wearables notes (sizes, colours), the candle "14 oz" (a saved photo says 16 oz), and the 16 oz elderberry syrup size (a digit is cut off on the sign).
- English wording flagged by all four translation reviewers: the beer/cider/wine note is a fragment ("All beer, cider and wine."), "Pots in yellow, orange, gold and pink" reads as if the pots are coloured (it is the mums), and the pumpkin note ("Medium ones are $4.00") is unclear. Changing English means redoing the key in 4 languages.
- Prices still unconfirmed (the Shop says "Prices coming soon"): jam ($8 vs $9 on two signs), elderberry shrub ($20.99 vs $21.99), hats, T-shirts, sweatshirts, bags, pizza, Christmas trees. Questions for Miss Cathy and Rob were posted in the old Terminal (ids `k-new-*`, see `PRODUCTS.md`).
- A native-speaker read of the es/hi/zh/vi texts would still help (AI-written, AI-reviewed).
- Checked on the final merged state and PASSING: validity, consistency, docs, files-audit, public-site, sprite, hero, barn, calm, pause, nav-highlight, first-visit-guide, i18n-facts, i18n-a11y, languages, link-names, keyboard, axe, axe-wide, layout-sweep, smoke, privacy-static, pipeline, and `tools/check_facts.py` (21 of 21 facts agree).
- FAILING, not caused by this session's merges: `apply-answers` (scenario "2 in place needs yes a clean folder and a patch that passed" ends RED; it fails the same on the commit before the Shop and first-visit merges; the temporary report folder says which check is red: rerun `node tests/run-all.mjs apply-answers` and read `APPLY_REPORT.md`), `plain-lint` (one 45-word README sentence), `option-patches` (privacy page, two checks). `sitecheck-values` failed once under heavy load and passed again.
- NOT run on the final merged state: windows-reality, review-sheet, reader-roundtrip, date-phrases, tools-safety, owner-cheat-sheet, launch-check, deploy, doctor, i18n, slow-phone, interference, dated, contrast-pixels, print-qr, features, games, monkey, owner-input, messages, colour-blind, touch, big-font, no-js.
- The older optional patches (map, winter trees, holiday photos, sunflower field, spots-marks, share picture) are NOT applied; they wait for the owner's say-so (`patches/optional/`, `docs/OPTION_PATCHES.md`).
- The GitHub repo is public. Nothing private is stored here.

## Late findings (from the last helper reports)
- The claude.ai preview shows the site in a sandboxed frame from another address. There the browser ignores `rootMargin` for observers without a root. That was the cause of the wrong menu highlight (fixed in the real site), and it also changes fade-ins and the farm-map pre-drawing in the preview only. `preview/build-artifact.py` now wraps `IntersectionObserver` to use the document as root (preview only; the real site does not need it).
- `first-visit.html`: `#parking` and `#strollers` land 88 px lower than other targets because `.fact-card[id]` has its own `scroll-margin-top` on top of the page's `scroll-padding-top` (`css/extras.css`). Small; remove one of them.
- A few anchors end about 26 px too high (the top of the section is under the sticky header): `#farm` from the top, `#schedule`, `#shop-farm`, `#shop-pumpkins`. Cause not found (page height changes by about 26 px while the smooth scroll runs).
- The barn fix was fuzzed by a second helper (70 random states plus 7 sizes, 0 failures). Still open: the sun can come within 3 px of the barn at some very wide sizes, and the hero is 2.3 times the window height at 3010x519.
- `work-notes/shop-test/` holds an independent test of the Shop made from `SHOP-LIST.md` (it checks every name, price, picture, language and layout). On the merged page it reports real differences that still need a decision (see its README line in `HANDOFF.md` below): the page keeps the old pizza prices ($15 to $17, +$9, +$3) while the list says `?`; some card names differ from the list ("Waxhaw Creamery ice cream", "Local mums", "NC pumpkins"); the beer/cider/wine note has no "each"; group 12 is headed "Farm visit, rides & picking". Fix the list or the page, then move the files into `tests/` (the runner finds `*.test.mjs` there by itself).

## How to rebuild things
- Pages and translations: `python3 tools/pages.py && python3 tools/i18n.py extract && python3 tools/i18n.py build`. Never run `tools/pages.py` alone (it strips the translation tags). Edit translations only in `lang/src/<code>.json`.
- Tests: `NODE_PATH=/opt/node22/lib/node_modules AXE_PATH=<axe-core>/axe.min.js PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/run-all.mjs <test names>`. One at a time; the machine was slow.
- Preview artifact (the claude.ai page): `preview/build-artifact.py` builds one self-contained page plus the 5 inner pages from the repo, `preview/arttest.mjs` checks it, then it is published with the Artifact tool. The scripts have absolute paths from this session; fix the two path lines at the top.
- Product pictures: the drawings live inside `index.html` (sprite at the bottom). `preview/merge_art.py` was the merge step.

## Other files here
- `PRODUCTS.md`: what every photo of the farm's signs said (transcribed), with the gaps.
- `SHOP-LIST.md`: the list the Shop was built from (slug, name, price, note). `?` = price not confirmed.
- `AUDIT-photos.md`: a second reading of the saved photos against that list (the corrections above).
- `terminal-source-oct21.tar.gz`: code only (no answers, no state) of the "Terminal" question page the owner has now moved to a separate project.

## Small things the last helpers noticed (not fixed)
- On screens about 680 to 760 px wide the wagon ride (not the barrel train) still shows at the right edge when its loop ends.
- The Shop notes say "weight station" as the farm's sign does; "weigh station" is the usual word. Also "Medium ones are $4.00" under "$0.84 a pound" does not say whether $4.00 is a flat price.
- The old "Terminal" page stays published as it was (version 3, plus the 14 questions posted today). Its answers to the price questions are the way to confirm the "Prices coming soon" items.
