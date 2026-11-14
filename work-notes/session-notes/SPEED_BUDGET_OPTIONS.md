# The real website's speed budget: three options (11 Nov 2026)

Base: integ 1eb9015. "Real set" = the tip's files + our changes, no tour, no Store sample lists, and the tip's own `js/demo-header.js` kept
(the 426 / 307 / 330 KB you have are the same set without that file: it is 2.9 KB and 1 file on every page).
"Measured" = the functions of `tests/slow-phone.test.mjs` in a real browser (Slow 4G phone, brotli level 5, cold cache), run by me on copies; nothing in the repo or in a limit was changed.
Another helper's browser run of its own copy (push-plan, tree A) agrees: index 429 KB, first-visit 333 KB.

## 1. Where we are today (measured; the test uses the real clock, 11 Nov)

| page | files (limit) | KB sent (limit) | nodes (limit) |
| --- | --- | --- | --- |
| index.html | 23 (24) | 429.6 (420): OVER by 9.6 | 39,726 (46,000) |
| index.html in Hindi | 23 (25) | 425.8 (440): ok | 66,627 (75,000) |
| first-visit.html | 22 (24) | 332.9 (400): ok | 15,649 (30,000) |
| pumpkin-patch.html | 20 (22) | 310.0 (300): OVER by 10.0 | 3,566 (12,000) |
| the tip, for comparison | 22 / 22 / 20 | 404 / 316 / 293 | 32,530 on index |

Biggest files on index: the page 89.4 KB, Caveat font 49.9, Nunito font 38.3, features.js 36.9, hero.js 31.4, Fredoka font 29.1, main.js 26.7, extras.css 22.6, styles.css 13.2, Nunito Vietnamese font 12.9. Fonts are 130 KB of every page (index 30%, pumpkin 42%).
Growth against the tip, index (+25.4 KB): page +5.7, main.js +5.5, extras.css +4.3, hero.js +2.9, season.js +2.1, sections.css +1.3, hero.css +0.9, live.js +0.9, shop-pop.js +0.5, styles.css +0.5, content.js +0.3, features.js +0.3.
Today's part is +11.9 KB: the 16 drinks and their 17 pictures 4.3 (cards 1.0, pictures 3.3), winter rule, hours and labels in the scripts 4.4, Store boxes and winter labels in extras.css 2.4, the loader 0.5. The older part (main.js +5.4 is the grouped menu and the bee, 3 Nov) came before today.
pumpkin-patch.html was ALREADY 4 KB over before today (304.0 KB): +11.3 KB from the tip before today, +6.0 today.

## 2. A second problem: the node limit depends on the date (measured, the page clock set to each day)

| the page opens on | days of the year | English nodes (limit 46,000) | Hindi nodes (limit 75,000) | 4x phone: menu answers / page loaded |
| --- | --- | --- | --- | --- |
| winter (9 Nov to 6 Dec: today) | about 4 weeks | 39,726 ok | 66,625 ok | 6.6 s / 6.3 s |
| spring (7 Dec to 7 Jun, next or live) | about 6 months | 60,429 to 60,538 OVER | 88,550 to 88,655 OVER | 7.8 s / 7.3 s |
| summer (8 Jun to 10 Jul) | about 5 weeks | 48,394 OVER | 102,078 OVER | 6.5 s / 6.9 s |
| fall (11 Jul to 8 Nov) | about 4 months | 44,265 to 44,354 ok | 74,703 to 74,792 ok (0.2k spare) | 6.5 s / 6.1 s |

The test is green about 5 months of the year (fall, winter) and red the other 7, whatever we do to the bytes. The tip already had this: 48,589 nodes in spring (limit 46,000).
Why spring is heavier than winter: the farm picture at the top holds 3.0k nodes in winter, 5.8k in fall, 9.1k in summer, 12.3k in spring (the spring field alone: 158 strawberry drawings and 126 plants, 9.9k with the drawings counted once; nested drawings count again).
Open point, found by me and not explained yet: the spring page was 49.0k nodes before today (the tip 48.6k) and is 60.4k now, but the picture did not change (10.2k copies in the tip, before today and now; the footer picture also the same). About 11k nodes came from somewhere else on the page, only in spring. Fall grew by just 1.0k (43.4k to 44.4k: the 16 drinks). A part-by-part count of the three trees is queued (`/tmp/helpers/budget-options/logs/final4.json` when it has run). If it is a mistake it is a free trim, and spring would be near 49k.
Seconds: a 4x slower processor on the test's Slow 4G line, median of 3 runs, on a shared computer (so every number is higher than on a free one; the differences between the lines are what counts).

## 3. The options

### A. Trim: nothing a visitor sees changes
| step | KB saved | files | why it is safe |
| --- | --- | --- | --- |
| Cut the 3 Latin fonts (Fredoka, Nunito, Caveat) to the letters the site really uses (133 to 135 of the 217 to 230 each has) | 27.6 on every page (7.8 + 12.7 + 7.1) | 0 | 13,764 site strings, in 5 to 7 weights, are shaped the same by the old and the new font (0 differences); 13 of 16 screen pictures are identical to the pixel, the other 3 differ only by the moving bee and one photo that had not loaded yet; licence test 46 of 46 |
| Do not send the dormant Store loader `js/shop-pop.js` until real ingredient lists exist (the pop-up files are never fetched without them) | 0.6 on index | -1 | it does nothing without `js/shop-sample.js`; put its tag back together with the lists |
| Cut the Store hover rules from `css/extras.css` (they match nothing without the lists) | 0.5 on every page | 0 | nothing uses them yet |
| Measured result on a copy with all three | index 401.0 (22 files), first-visit 304.9, pumpkin 281.9, Hindi 404.2 | index 22 | `tests/slow-phone.test.mjs` on that copy: all passed |

Cost: the fonts are made by a 40-line script (`fonttools` and `brotli`, one `pip install`); the three files are ready in `/tmp/helpers/budget-options/fonts/outN/`. It needs one new test, "every letter a page can show is in the fonts", so that a new letter (an "ü" in a customer review) cannot quietly fall back to another font. About half a day with that test.
Risk: a letter that no page uses today is missing from the font. Safer version, keeping every Western European letter and the usual marks: saves 15.6 KB instead of 27.6 (worked out: index about 413, pumpkin about 294; both still pass with 6 KB to spare).
Not in A, with numbers: (1) the five extra pages load all 5 style sheets (62.6 KB) but a walk through pumpkin-patch used only 12% of those rules (7.8 KB): a home-only style sheet could save up to 35 to 50 KB on each extra page, but it is a 1 to 2 day split with every visual test again, so it is for later; (2) taking comments and spaces out when the upload folder is made saves 75 KB, but the test looks at the repo, and inside the repo it would break 176 places that the docs name; (3) the dormant `analytics.js` (2.3 KB) and `demo-header.js` (2.9 KB) could load only when used (-2 files on every page) but `tests/code-rules` wants both on every page; (4) shorter drawing paths in the sprite 1.5 to 2.4 KB; (5) fetching the Store and its 77 pictures only when scrolled near 27 KB (eight tests would change).
What A cannot do: the node count (section 2).

### B. Raise the limits by small named amounts
| limit | now | to | the real set is at | note |
| --- | --- | --- | --- | --- |
| index KB | 420 | 432 | 429.6 | the smallest that passes is 430 (383 bytes spare); 432 leaves room for one small change |
| pumpkin KB | 300 | 312 | 310.0 | the smallest is 310 (36 bytes spare): too tight |
| index nodes | 46,000 | 62,000 | 60,538 in spring | as the page is today (about 52,000 would do if the 11k of section 2 turns out to be removable) |
| index nodes, Hindi | 75,000 | 105,000 | 102,078 in summer | |

Still fast? Bytes: each KB is 5 ms on the test's line (1.6 Mbit/s), so +12 KB is +0.06 s; the home page is 2.15 s of download at 430 KB against 2.02 s for the tip. Nodes cost more: on a 4x slower phone the spring page needs about 1.2 s longer than winter until the menu answers (7.8 s against 6.6 s) and 1 s longer to finish loading, because every node has to be styled and laid out. That is the real price of the spring page; raising the limit only writes it down.

### C. Leave it as it is
`slow-phone` is red today on index (429.6 > 420) and on pumpkin-patch (310.0 > 300), and again on the nodes from 8 Jun, and all spring: about 7 months a year. Visitors notice nothing: the pages are the same. But a test that is always red hides the next real slowdown, and pumpkin-patch was already red before today.

## 4. My pick
A now (fonts and loader): both pages go back under the old limits with 19 KB (index) and 18 KB (pumpkin) to spare, nothing looks different, no limit moves. Then, for the nodes: first look for the 11k nodes that appeared in spring only (section 2); then B for the node numbers only, because the spring picture is big by design (the limit was set while the page showed fall; the tip was already over it in spring). Or, her call: make the test use a fixed date like the other tests, and add one check for spring. The style-sheet split in A(1) is the big trim for later: it would take 35 to 50 KB off every extra page.
