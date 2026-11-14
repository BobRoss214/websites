# OPEN ITEMS: where the work stands (written 11 Nov 2026, evening). Read this after `work-notes/HANDOFF.md`.

The site builder (she is NOT the farm owner; the bosses are Mrs. Cathy and Rob) stopped the online session on purpose because 15 helpers were waiting on one small computer and on each other.
Everything below is what was true when it stopped. Her own words for every request of 10 Nov are in `REQUESTS_10NOV.md` (same folder).

## 1. Where everything is (on 14 Nov the real website, the default branch `claude/wise-acres-redesign-w9m4bi`, got the latest finished work; it was at 02ffa32 before)
- GitHub branch `claude/wise-acres-everything` (called `integ` in the online session) = everything that is finished and merged, INCLUDING the preview-only things (tour, pretend lists, pop-up). The default branch = the real website without them.
- GitHub branch `claude/wise-acres-kitchenfix` (4 real commits, then a merge of integ, then one WIP commit that is NOT tested): the pizza kitchen screen (`kitchen.html?demo`): the board is put in place on open, after a reload and after
  pressing On; a small strip that stays in sight (Waiting, Late, Sound); the focused ticket is aligned under the sticky bars; the editor and the tab title say which order; the type and the column grow on wide
  screens; change tickets read like order tickets; the Keys switch sits beside Sound; the sound is a little louder. STILL TO DO: run `demo-kitchen demo-live kitchen-tour demo-store demo-data consistency code-rules`
  and the browser tests `kitchen-live tour-targets i18n-early`; look at 1366x768, 1024x768 and 1920x1080 (first ticket's pizzas and its 3 buttons visible without scrolling); then merge into integ.
- GitHub branch `claude/wise-acres-storegaps3` (1 real commit + a merge of integ): Store: a lone last box becomes a strip (class `shop-row3`) and the two Farm fun boxes carry their note beside the name. STILL TO DO: the new
  Beer, cider & wine group leaves a blank of about 270 px under the left column at 1366 (180 px at 1920) above the Farm bar: fix it (idea: end the left column with a short group, or make the Beer group
  denser; keep the page order of the groups and the jump buttons); judge it with AND without the farm group (it is hidden in winter now, so winter has 12 groups, the other seasons 13); run `tests/shop.test.mjs`;
  look at 1920, 1440, 1366, 1280, 1100.
- The private preview https://claude.ai/artifact/BxpyJpFX8bKixnoHnta2wW shows Version 51 (an in-between version built from integ bee8292). Version 52 should be built from the final integ
  (`python3 work-notes/preview/build-artifact.py --out <dir>`, check with `node work-notes/preview/arttest.mjs --dir <dir> --quick`, see work-notes/preview/README.md). Publishing uses the Artifact tool of the
  ONLINE Claude session (root = the built folder, files = its publish-files.json, no capabilities/icon/title): if the terminal has no such tool, ask her to run that step in the online session.

## 2. What was done on 10-11 Nov (all in integ; tests green on each branch before it was merged; the whole set was never run on the final head because the machine was overloaded)
- Christmas trees only the last weekend of November and the first weekend of December, Saturday and Sunday (2026: Nov 28-29 and Dec 5-6), worked out each year (js/season.js); winter = last Saturday of
  November through the Sunday after the first Saturday of December; the site opens on the NEXT season when none is live (Nov 9-27 opens on winter; after Dec 6 on spring); Now/Next tags; countdown; This week box;
  banner, hero line, Two places card, calendar bar, Store tree card, FAQ; 5 languages; date oracle `node /tmp/helpers/winter-oracle/check.mjs` (not in the repo: it compared the code with an independent copy of the rule: 0 mismatches 2026-2060).
- Winter opening: the farm only on those weekends, no reservation, no rides; The GreenHouse pizza 11 am-8 pm with the label "Not official yet" next to the pizza and the hours; tomatoes ended Nov 8 (no tomato words in
  winter-only text). The GreenHouse and Wise Pie live badges follow the winter hours while the page shows winter (only tree days; other days say when it next opens, never "Friday"); the 5 days between the tree
  weekends say what comes next; one pill in the hours box. The Store farm group (#shop-farm) and the "always reservation-only" lines are hidden in winter (`data-only="spring summer fall"`).
- Bigger Christmas trees in the winter picture (x1.5, js/hero.js). Store boxes tighter and uniform; hover grow; click pop-up with PRETEND ingredient lists (js/shop-sample.js, PREVIEW ONLY, never on the real site;
  js/shop-pop.js is dormant without it); new group Beer, cider & wine (16 drinks at $6 from her chalkboard; "NA Brooklyn. Non-alcoholic.").
- Pretend-live desk (`farm-desk.html?demo`) and redesigned pizza kitchen (`kitchen.html?demo`): shared seeded engine js/demo-live.js, rush Off until pressed, timers, keys, sound only after a press, the rush keeps flowing when nobody answers.
- Tour (preview only, English): features for customers and the farm, not "what I changed"; 4 cards made true in winter.
- Fixes from 11 independent reviews: search-engine FAQ text reads "(not official yet)"; pretend lists without allergen lines/brand claims; dates pill, calendar tree bars, "No pizza" line ends Nov 8, announcement bar on phones;
  language polish (e-mail in one piece, no-break dates/units, vi tag, Hindi month names); tests: old winter dates moved, exact counts back; the owner-calendar sanity floors follow the real counts (12 dates, 9 rows).
- `patches/optional/winter-hide-tomatoes.patch` (decision d93) is READY BUT NOT APPLIED: it hides the all-year tomato parts (section, menu link, FAQ, calendar row, Store card, hero line) in winter. It is her call.

## 3. Not done / open, in the order I would do it
1. `tests/shop-pop.test.mjs`: 3 checks failed under load: "every other block of the page is hidden while open" (one body DIV without aria-hidden/inert; the pop-up code skips the "verbs" box on purpose, js/shop-pop-box.js ~line 103,
   the test does not), "page as before after it shuts", then a null-element error. Run it alone on a quiet machine on integ, then decide: fix the code (the dimmed page must not be reachable by a screen reader) or the test (with a reason).
2. Run the WHOLE test set once on a quiet machine on the final head (`node tests/run-all.mjs`, about an hour; browser tests one at a time; see tests/README.md for Playwright and axe-core). The quick set (no browser, plus a few) was green on 366c81e except owner-calendar (fixed since).
3. Finish `kitchenfix` and `storegaps3` (section 1), merge, run the pipeline and the tests again.
4. Reviews that never reported (worth doing, by reading the code): the season/live logic (daylight-saving days, year boundaries, years where Nov 30 is a Saturday, visitors in other time zones; fuzz 2024-2060 against an independent copy of the rule);
   the tour engine (js/tour.js: the welcome card's "Start the tour" click timed out once in a harness run, and a real mouse click on the hero "Fall" button timed out once in English on Dec 1; probably a layer on top, not diagnosed);
   the pretend-live engine (state size after 24 h, timers, junk in storage); accessibility extras (200 % zoom, forced colors, tour + pop-up together, Store at 1264/1280/1440); the docs pass; and the spring page has about 11,000 more
   DOM nodes than in Version 50 (49.0k to 60.4k) while the picture did not change: find why (tests/slow-phone.test.mjs counts nodes; limit 46,000).
5. Smaller findings nobody fixed: the JSON-LD FAQ answers on first-visit/wise-pie join the text of every season (by design, but one answer then says "No ... Yes, on the Christmas tree weekends"); the meta description and JSON-LD say
   "Farm reservations required" (false on the 4 tree days); index.html has 13 typed copies of "Nov 28-29 and Dec 5-6" for visitors without JavaScript (stale in 2027); Wise Pie winter heading "Two ways to get it" sits above one card;
   "See this season's menu" lands on "Fall Menu 2026"; the first-visit map legend lists "Tomatoes and basil" in winter; the school page has no dates after Nov 3; the 404 page is English only; upcoming_dates.py prints one paragraph 3 times;
   the pop-up's hover tilts the picture of cards that do not open (old rule extras.css ~298); "Contains" lines were taken out of the pretend lists (done) but lists "under a maker's name" were only made generic.

## 4. Questions waiting for the builder (plain words; she has seen 1-6 in the online chat)
1. Tomatoes: hide ALL tomato parts in winter? (the ready patch above)  2. GreenHouse in winter: only the tree weekends (what the badges do now) or its usual Friday-Sunday hours?
3. Trees: also the small tree pictures (Winter button, This week row, Store icon)?  4. After Dec 6 the site opens on spring until mid-April: OK?
5. Where are beer, cider and wine sold (the new group has no place line)? The two cider names under the "sold out" note stay out; the chalkboard spellings (Oskars Blues, Dales, Kei Truck, Bev (Gris), Peach crumble) to check.
6. Real site size: index.html is 429.6 KB (limit 420) and pumpkin-patch 310 KB (limit 300); the safe trim is a font subset (-27.6 KB, nothing looks different; `SPEED_BUDGET_OPTIONS.md`): OK to do it?
7. Things without ingredients (hats, plants, pumpkins) show "Made of" in the pop-up: fine?  8. Push decisions in `PUSH_PLAN.md` (demo files A/B/none, leave the dormant pop-up out, push all 337 commits together).

## 5. When she says "push" (not before)
Read `PUSH_PLAN.md` and run `sh work-notes/session-notes/make_real_branch.sh <integ-ref> <out-dir>` (it does NOT push; it builds a clean branch for the real website without the tour, the pretend lists and the dormant pop-up).
