# Notes of the winter-text helper (10 Nov 2026): the words of the Christmas tree weekends

For main, who applies README.md, tests/README.md and tests/browser-support.table.json once, after the merges.

## What the pages say now (the builder's words, nothing more)

- Trees: "the last weekend in November and the first weekend in December, Saturday and Sunday only" (this year Nov 28-29 and Dec 5-6), at The GreenHouse. No Friday anywhere.
  The dates are never typed: `<span data-tree-dates>` is filled by js/season.js (the number in the page is only what a page without the script shows). The calendar row has two bars,
  `data-tree-bar="1"` and `"2"`.
- The farm: open only those two weekends, no reservation, no rides.
- The GreenHouse: open those weekends, 11 am-8 pm, serving Wise Pie pizza. The small label "Not official yet" (class `not-official`, css/extras.css, translated es "Aún no es oficial", hi "अभी आधिकारिक नहीं है",
  vi "Chưa chính thức", zh "尚未正式确认") stands right after every winter mention of the pizza and of the 11 am-8 pm hours (index.html: 17 places, pages/wise-pie.html: 6).
  js/live.js puts the same label into the open-now badges (its own helper).
- Pattern: a winter line is `data-only="winter" hidden`, the line it replaces is `data-only="spring summer fall"`, so in spring, summer and fall nothing changes and a page without JavaScript shows the old words.

## README.md (main applies)

- Line 205 ("The seasons switch by themselves, every year"): say "winter from the last Saturday in November (the Christmas tree weekends: the last weekend in November and the first weekend in December, Saturday and Sunday only; the site works the dates out every year)" instead of "winter from the Friday after Thanksgiving".
- Row "Christmas trees" (line 509): "The last weekend in November and the first weekend in December, Saturday and Sunday only, at The GreenHouse. The farm is open those two weekends too (no reservation, no rides). The GreenHouse is open 11 am to 8 pm and serves Wise Pie pizza. Both carry the label "Not official yet" until the farm confirms them."
- Row "Winter and early-spring wording" (line 523): the GreenHouse shows Friday to Sunday, 10 am to 8 pm, in spring, summer and fall only; in winter it shows the tree weekends, 11 am to 8 pm, with "Not official yet". The green line now says "Christmas tree season is on." and shows while the winter season is on (js/season.js), not "until about 10 February".
- New row "Not official yet label": what it is (`.not-official` in css/extras.css, in index.html and pages/wise-pie.html next to the winter pizza and the 11 am-8 pm hours, and in the badges of js/live.js). When the farm confirms the pizza and the hours, delete every `<span class="not-official">...</span>` (search `not-official`), run the full pipeline, and ask Claude to remove it from js/live.js.

## tests/browser-support.table.json (main rebuilds it with network)

Two names are new and not in the table. Both are the plain `hidden` attribute (every browser has it), on elements that had none before:
`html-attr:article.hidden` (index.html and wise-pie.html: the winter card of the Wise Pie ways) and `html-attr:h3.hidden` (index.html: the winter hours heading of The GreenHouse).
tests/browser-support is red only for these two until the table is rebuilt.

## After the merge with winter-logic (names that move)

- docs/OWNER_YEAR_CALENDAR.md and .es.md name the Shop tree card as `data-t="t59d83261"` (I changed only that id; the rest of those two files is winter-logic's).
- docs/DECISION_PLAYBOOK.md (d50, d23) and docs/QUESTIONS_FOR_THE_FARM.md (Q12, Q37) name js/season.js at `{ id: 'winter'` (still there after the merge). I removed the old anchor `function thanksgivingFriday(`.
- lang/src/*.json still has the js text "the Friday after Thanksgiving" (the old `next:` of js/season.js): winter-logic's commit removes it.

- tests/README.md line 151 (row `upcoming-dates`, a winter-logic test) still says "the Friday after Thanksgiving in several years": main rewrites it with winter-logic's test change.
- lang/src/*.json (js section, line 256) still has "the Friday after Thanksgiving" with its four translations: it is the old `next:` of js/season.js. When winter-logic's commit is merged, run the pipeline; if `i18n.py build` names that line as not on any page, delete the four lines.

## Tests I changed (so the merge does not undo them)

- tests/consistency.test.mjs: the tree check reads the rule (`TREE_RULE`) and the two bars of the calendar row; tests/i18n-facts.test.mjs: a block at the end for the two date ranges in every language; tests/tour-seasons.test.mjs: the new name of the green line.
- tests/shop.test.mjs (`readOutside`): the Store tree card keeps only "the page's existing wording" for dates. The page's wording is now the tree rule; the dates after it are written by the script (`data-tree-dates`), so `readOutside` leaves those dates (and the empty brackets) out when it reads the page without #shop. Nothing else about the check changed.
- tools/apply_answers_rules.json: `d50=B` is not in "manual" any more (it has no recipe: a different tree rule is a code change, so it is skipped in tools/rehearse_answers.json like d50=C).

## Not decided (asked in the report)

See the report: the tomato lines left on purpose, the winter lines that say more than the spec (playground and goats, ice cream and drinks, "Picking is seasonal"), the generic how-to-reserve text left as it is, the SEO descriptions.
